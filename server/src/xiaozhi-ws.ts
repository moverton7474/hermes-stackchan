/**
 * Xiaozhi WebSocket Session Handler
 *
 * Manages a per-device WebSocket session speaking the xiaozhi protocol.
 * Each session:
 * 1. Completes the hello handshake
 * 2. Mints an OpenAI Realtime token via Hermes
 * 3. Opens a Realtime WS connection
 * 4. Bridges audio: device OPUS ↔ PCM ↔ OpenAI Realtime
 * 5. Maps emotions to face expressions
 */

import type { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { mintHermesToken } from './hermes-token.js';
import { RealtimeBridge } from './realtime-bridge.js';
import { AudioPipeline } from './audio.js';
import { mapEmotion } from './emotion.js';
import { logger } from './logger.js';

interface DeviceInfo {
  deviceId: string;
  clientId: string;
  protocolVersion: string;
}

interface XiaozhiMessage {
  type: string;
  session_id?: string;
  state?: string;
  mode?: string;
  text?: string;
  reason?: string;
  version?: number;
  transport?: string;
  audio_params?: {
    format?: string;
    sample_rate?: number;
    channels?: number;
    frame_duration?: number;
  };
}

type SessionState = 'connecting' | 'hello_pending' | 'idle' | 'listening' | 'speaking';

const HELLO_TIMEOUT_MS = 10_000;
const IDLE_TIMEOUT_MS = 120_000;
const PREBUFFER_FRAMES = 5;
const FRAME_DURATION_MS = 60;

export function handleXiaozhiConnection(ws: WebSocket, device: DeviceInfo): void {
  const sessionId = uuidv4();
  let state: SessionState = 'hello_pending';
  let realtimeBridge: RealtimeBridge | null = null;
  let audioPipeline: AudioPipeline | null = null;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;

  const log = logger.child({ session: sessionId, device: device.deviceId });

  // Hello timeout: device must send hello within 10s
  const helloTimer = setTimeout(() => {
    if (state === 'hello_pending') {
      log.warn('Hello timeout — closing connection');
      ws.close(1008, 'no client hello');
    }
  }, HELLO_TIMEOUT_MS);

  function resetIdleTimer(): void {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      log.info('Idle timeout — closing session');
      ws.close(1000, 'idle timeout');
    }, IDLE_TIMEOUT_MS);
  }

  function sendJSON(msg: Record<string, unknown>): void {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  // --- Handle incoming messages ---
  ws.on('message', async (data, isBinary) => {
    resetIdleTimer();

    if (isBinary) {
      // Binary frame = OPUS audio from device (v1: raw opus, no header)
      if (state !== 'listening') return;

      try {
        const opusFrame = Buffer.from(data as ArrayBuffer);
        // Decode OPUS → PCM 16kHz
        const pcm = audioPipeline?.decodeOpus(opusFrame);
        if (pcm && realtimeBridge) {
          // Forward PCM to OpenAI Realtime
          realtimeBridge.appendAudio(pcm);
        }
      } catch (err) {
        log.error({ err }, 'Failed to decode OPUS frame');
      }
      return;
    }

    // Text frame = JSON control message
    let msg: XiaozhiMessage;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      log.warn('Invalid JSON from device');
      return;
    }

    log.debug({ msg_type: msg.type, state: msg.state }, 'Device message');

    switch (msg.type) {
      case 'hello':
        await handleHello(msg);
        break;
      case 'listen':
        handleListen(msg);
        break;
      case 'abort':
        handleAbort(msg);
        break;
      default:
        log.debug({ type: msg.type }, 'Unhandled message type');
    }
  });

  ws.on('close', (code, reason) => {
    log.info({ code, reason: reason.toString() }, 'Device disconnected');
    cleanup();
  });

  ws.on('error', (err) => {
    log.error({ err }, 'WebSocket error');
    cleanup();
  });

  // --- Hello handshake ---
  async function handleHello(msg: XiaozhiMessage): Promise<void> {
    clearTimeout(helloTimer);

    log.info({
      transport: msg.transport,
      audio: msg.audio_params,
      version: msg.version,
    }, 'Client hello received');

    // Initialize audio pipeline
    const inputSampleRate = msg.audio_params?.sample_rate || 16000;
    const outputSampleRate = 24000;
    const frameDuration = msg.audio_params?.frame_duration || 60;
    audioPipeline = new AudioPipeline(inputSampleRate, outputSampleRate, frameDuration);

    // Mint Hermes token and connect to OpenAI Realtime
    try {
      const token = await mintHermesToken();
      realtimeBridge = new RealtimeBridge(token, {
        onTranscript: (text: string) => {
          sendJSON({ type: 'stt', text, session_id: sessionId });
        },
        onAudioDelta: (pcm: Int16Array) => {
          // Encode PCM → OPUS and send to device
          const opus = audioPipeline?.encodeOpus(pcm);
          if (opus && ws.readyState === ws.OPEN) {
            ws.send(opus);
          }
        },
        onResponseStart: () => {
          state = 'speaking';
          sendJSON({ type: 'tts', state: 'start', session_id: sessionId });
        },
        onSentence: (text: string) => {
          sendJSON({ type: 'tts', state: 'sentence_start', text, session_id: sessionId });
          // Send emotion based on content
          const emotion = mapEmotion(text);
          if (emotion !== 'neutral') {
            sendJSON({ type: 'llm', emotion, text: '', session_id: sessionId });
          }
        },
        onResponseEnd: () => {
          // Wait for audio drain + slack before sending tts:stop
          const drainMs = (PREBUFFER_FRAMES + 2) * FRAME_DURATION_MS;
          setTimeout(() => {
            sendJSON({ type: 'tts', state: 'stop', session_id: sessionId });
            state = 'idle';
          }, drainMs);
        },
        onError: (error: string) => {
          log.error({ error }, 'Realtime bridge error');
          sendJSON({
            type: 'alert',
            status: 'error',
            message: error,
            emotion: 'sad',
          });
        },
      });

      await realtimeBridge.connect();
      log.info('OpenAI Realtime connected');
    } catch (err) {
      log.error({ err }, 'Failed to connect to OpenAI Realtime');
      sendJSON({
        type: 'alert',
        status: 'error',
        message: 'Failed to connect to Hermes AI backend',
        emotion: 'sad',
      });
    }

    // Reply hello
    sendJSON({
      type: 'hello',
      transport: 'websocket',
      session_id: sessionId,
      audio_params: {
        sample_rate: 24000,
        frame_duration: FRAME_DURATION_MS,
      },
    });

    state = 'idle';
    resetIdleTimer();
    log.info('Session established');
  }

  // --- Listen state machine ---
  function handleListen(msg: XiaozhiMessage): void {
    switch (msg.state) {
      case 'start':
        state = 'listening';
        realtimeBridge?.startListening();
        log.debug({ mode: msg.mode }, 'Listening started');
        break;

      case 'stop':
        if (state === 'listening') {
          realtimeBridge?.commitAudio();
          log.debug('Listening stopped, audio committed');
        }
        break;

      case 'detect':
        // Wake word detected — treat as start + transcript
        state = 'listening';
        realtimeBridge?.startListening();
        if (msg.text) {
          log.debug({ wake_phrase: msg.text }, 'Wake word detected');
        }
        break;
    }
  }

  // --- Abort (user interrupt) ---
  function handleAbort(msg: XiaozhiMessage): void {
    log.debug({ reason: msg.reason }, 'User abort');
    realtimeBridge?.cancelResponse();
    sendJSON({ type: 'tts', state: 'stop', session_id: sessionId });
    state = 'idle';
  }

  // --- Cleanup ---
  function cleanup(): void {
    clearTimeout(helloTimer);
    if (idleTimer) clearTimeout(idleTimer);
    realtimeBridge?.disconnect();
    audioPipeline?.destroy();
    realtimeBridge = null;
    audioPipeline = null;
  }
}
