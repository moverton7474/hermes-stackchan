/**
 * OpenAI Realtime Bridge
 *
 * Manages the WebSocket connection to OpenAI's Realtime API.
 * Handles:
 * - Session configuration (model, voice, system prompt)
 * - Audio streaming (PCM ↔ base64)
 * - Response events (transcript, audio, function calls)
 * - Interruption/cancellation
 */

import WebSocket from 'ws';
import { logger } from './logger.js';

interface EphemeralToken {
  value: string;
  expiresAt: number;
}

interface RealtimeCallbacks {
  onTranscript: (text: string) => void;
  onAudioDelta: (pcm: Int16Array) => void;
  onResponseStart: () => void;
  onSentence: (text: string) => void;
  onResponseEnd: () => void;
  onError: (error: string) => void;
}

const REALTIME_URL = 'wss://api.openai.com/v1/realtime';

export class RealtimeBridge {
  private ws: WebSocket | null = null;
  private token: EphemeralToken;
  private callbacks: RealtimeCallbacks;
  private log = logger.child({ component: 'realtime-bridge' });
  private model: string;
  private voice: string;
  private sentenceBuffer = '';

  constructor(token: EphemeralToken, callbacks: RealtimeCallbacks) {
    this.token = token;
    this.callbacks = callbacks;
    this.model = process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime';
    this.voice = process.env.OPENAI_REALTIME_VOICE || 'marin';
  }

  async connect(): Promise<void> {
    const url = `${REALTIME_URL}?model=${encodeURIComponent(this.model)}`;

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url, {
        headers: {
          'Authorization': `Bearer ${this.token.value}`,
        },
      });

      this.ws.on('open', () => {
        this.log.info('Connected to OpenAI Realtime');
        this.configureSession();
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const event = JSON.parse(data.toString());
          this.handleEvent(event);
        } catch (err) {
          this.log.error({ err }, 'Failed to parse Realtime event');
        }
      });

      this.ws.on('close', (code, reason) => {
        this.log.info({ code, reason: reason.toString() }, 'Realtime disconnected');
      });

      this.ws.on('error', (err) => {
        this.log.error({ err }, 'Realtime WebSocket error');
        reject(err);
      });
    });
  }

  private configureSession(): void {
    this.send({
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        voice: this.voice,
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: {
          model: 'whisper-1',
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
        },
        // System prompt comes from Hermes via the ephemeral token session config
        // No need to set it here — Hermes configures it server-side
      },
    });
  }

  private handleEvent(event: Record<string, unknown>): void {
    const type = event.type as string;

    switch (type) {
      case 'session.created':
      case 'session.updated':
        this.log.debug({ type }, 'Session event');
        break;

      case 'conversation.item.input_audio_transcription.completed':
        // User's speech transcribed
        this.callbacks.onTranscript(event.transcript as string || '');
        break;

      case 'response.created':
        this.callbacks.onResponseStart();
        break;

      case 'response.audio_transcript.delta':
        // Accumulate text for sentence detection
        this.sentenceBuffer += (event.delta as string) || '';
        this.checkSentenceBoundary();
        break;

      case 'response.audio.delta': {
        // Base64-encoded PCM audio
        const b64 = event.delta as string;
        if (b64) {
          const buffer = Buffer.from(b64, 'base64');
          const pcm = new Int16Array(buffer.buffer, buffer.byteOffset, buffer.length / 2);
          this.callbacks.onAudioDelta(pcm);
        }
        break;
      }

      case 'response.done':
        // Flush remaining sentence buffer
        if (this.sentenceBuffer.trim()) {
          this.callbacks.onSentence(this.sentenceBuffer.trim());
          this.sentenceBuffer = '';
        }
        this.callbacks.onResponseEnd();
        break;

      case 'response.function_call_arguments.done':
        // Tool calls are handled by OpenAI Realtime + Hermes server-side
        // The bridge doesn't need to execute them
        this.log.debug({
          function: event.name,
        }, 'Function call (handled server-side)');
        break;

      case 'error':
        this.log.error({ error: event.error }, 'Realtime API error');
        this.callbacks.onError(
          (event.error as Record<string, string>)?.message || 'Unknown error'
        );
        break;

      default:
        this.log.debug({ type }, 'Unhandled Realtime event');
    }
  }

  private checkSentenceBoundary(): void {
    // Detect sentence boundaries for tts:sentence_start
    const sentenceEnd = /[.!?]\s/;
    const match = sentenceEnd.exec(this.sentenceBuffer);
    if (match) {
      const sentence = this.sentenceBuffer.substring(0, match.index + 1);
      this.sentenceBuffer = this.sentenceBuffer.substring(match.index + 2);
      this.callbacks.onSentence(sentence);
    }
  }

  /** Start a new listening turn — clear any buffered audio */
  startListening(): void {
    this.sentenceBuffer = '';
    // OpenAI Realtime uses server VAD, so we just ensure
    // the input buffer is ready
  }

  /** Append PCM audio to the Realtime input buffer */
  appendAudio(pcm: Int16Array): void {
    const buffer = Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength);
    this.send({
      type: 'input_audio_buffer.append',
      audio: buffer.toString('base64'),
    });
  }

  /** Commit the audio buffer (end of user speech) */
  commitAudio(): void {
    this.send({ type: 'input_audio_buffer.commit' });
    this.send({ type: 'response.create' });
  }

  /** Cancel the current response (user interrupted) */
  cancelResponse(): void {
    this.send({ type: 'response.cancel' });
    this.sentenceBuffer = '';
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private send(msg: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }
}
