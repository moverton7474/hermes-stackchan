import { EventEmitter } from 'events';
import https from 'https';

export type ConnectivityState = 'ONLINE' | 'OFFLINE' | 'RECONNECTED';

export class ConnectivityMonitor extends EventEmitter {
  private state: ConnectivityState = 'ONLINE';
  private consecutiveFailures = 0;
  private intervalMs: number;
  private timer: NodeJS.Timeout | null = null;
  private readonly failureThreshold = 3;

  constructor(intervalMs = 30000) {
    super();
    this.intervalMs = intervalMs;
  }

  getState(): ConnectivityState {
    return this.state;
  }

  isOnline(): boolean {
    return this.state !== 'OFFLINE';
  }

  start(): void {
    console.log(`[Connectivity] Starting monitor (ping every ${this.intervalMs / 1000}s)`);
    this.check(); // immediate first check
    this.timer = setInterval(() => this.check(), this.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    console.log('[Connectivity] Monitor stopped');
  }

  private check(): void {
    const req = https.request(
      'https://api.openai.com/v1/models',
      { method: 'HEAD', timeout: 5000 },
      (res) => {
        // Any response (even 401) means the API is reachable
        this.onSuccess();
      }
    );

    req.on('error', () => this.onFailure());
    req.on('timeout', () => {
      req.destroy();
      this.onFailure();
    });

    req.end();
  }

  private onSuccess(): void {
    this.consecutiveFailures = 0;
    const prev = this.state;

    if (prev === 'OFFLINE') {
      this.state = 'RECONNECTED';
      console.log('[Connectivity] RECONNECTED — back online');
      this.emit('stateChange', this.state, prev);
      // After emitting RECONNECTED, transition to ONLINE
      setTimeout(() => {
        this.state = 'ONLINE';
        this.emit('stateChange', 'ONLINE', 'RECONNECTED');
      }, 1000);
    } else if (prev !== 'ONLINE') {
      this.state = 'ONLINE';
      this.emit('stateChange', this.state, prev);
    }
  }

  private onFailure(): void {
    this.consecutiveFailures++;
    const prev = this.state;

    if (this.consecutiveFailures >= this.failureThreshold && prev !== 'OFFLINE') {
      this.state = 'OFFLINE';
      console.log(`[Connectivity] OFFLINE after ${this.consecutiveFailures} failures`);
      this.emit('stateChange', this.state, prev);
    }
  }
}
