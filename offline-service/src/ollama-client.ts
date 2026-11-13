import http from 'http';

const AMIE_SYSTEM_PROMPT = `You are AMIE, a warm and motivational AI coach. You are currently in offline mode.
You can help with: guided breathing, meditation, scripture readings, habit reminders,
workout timers, rep counting, and encouraging conversation.
You CANNOT: send texts/emails, check calendar, search knowledge base, or sync goals.
If asked about unavailable features, say "I'll help with that when we're back online."
Keep responses under 3 sentences. Be warm, faith-grounded, and encouraging.`;

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class OllamaClient {
  private baseUrl: string;
  private model: string;
  private history: ChatMessage[] = [];
  private maxHistory = 10;

  constructor(baseUrl = 'http://localhost:11434', model = 'gemma2:2b') {
    this.baseUrl = baseUrl;
    this.model = model;
  }

  getModel(): string {
    return this.model;
  }

  async chat(userMessage: string): Promise<string> {
    // Add user message to history
    this.history.push({ role: 'user', content: userMessage });

    // Trim history to last N turns
    if (this.history.length > this.maxHistory * 2) {
      this.history = this.history.slice(-this.maxHistory * 2);
    }

    // Build the prompt with system prompt + history
    const prompt = this.buildPrompt();

    try {
      const response = await this.generate(prompt);
      this.history.push({ role: 'assistant', content: response });
      return response;
    } catch (err) {
      const errorMsg = 'I\'m having trouble thinking right now. Let me try again in a moment.';
      console.error('[Ollama] Error:', err);
      return errorMsg;
    }
  }

  clearHistory(): void {
    this.history = [];
  }

  private buildPrompt(): string {
    let prompt = `${AMIE_SYSTEM_PROMPT}\n\n`;
    for (const msg of this.history) {
      if (msg.role === 'user') {
        prompt += `User: ${msg.content}\n`;
      } else if (msg.role === 'assistant') {
        prompt += `AMIE: ${msg.content}\n`;
      }
    }
    prompt += 'AMIE:';
    return prompt;
  }

  private generate(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const body = JSON.stringify({
        model: this.model,
        prompt,
        stream: false,
        options: {
          temperature: 0.7,
          num_predict: 200,
        },
      });

      const url = new URL(`${this.baseUrl}/api/generate`);
      const options: http.RequestOptions = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: 30000,
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            const response = (parsed.response || '').trim();
            resolve(response);
          } catch (e) {
            reject(new Error(`Failed to parse Ollama response: ${data.substring(0, 200)}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Ollama request timed out'));
      });

      req.write(body);
      req.end();
    });
  }

  async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const url = new URL(`${this.baseUrl}/api/tags`);
      const req = http.request(
        { hostname: url.hostname, port: url.port, path: url.pathname, method: 'GET', timeout: 3000 },
        (res) => {
          let data = '';
          res.on('data', (c) => { data += c; });
          res.on('end', () => resolve(res.statusCode === 200));
        }
      );
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.end();
    });
  }
}
