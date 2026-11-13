import https from 'https';
import { OfflineStore } from './offline-store';
import { ConnectivityMonitor } from './connectivity';

interface SyncConfig {
  supabaseUrl: string;
  supabaseServiceKey: string;
  userId?: string;
}

export class SyncEngine {
  private store: OfflineStore;
  private config: SyncConfig;
  private isSyncing = false;
  private retryCount = 0;
  private maxRetries = 5;
  private baseDelay = 30000; // 30s

  constructor(store: OfflineStore, config: SyncConfig) {
    this.store = store;
    this.config = config;
  }

  bindToMonitor(monitor: ConnectivityMonitor): void {
    monitor.on('stateChange', (newState: string) => {
      if (newState === 'RECONNECTED') {
        console.log('[SyncEngine] Reconnection detected — starting sync');
        this.retryCount = 0;
        this.sync();
      }
    });
  }

  async sync(): Promise<void> {
    if (this.isSyncing) {
      console.log('[SyncEngine] Sync already in progress, skipping');
      return;
    }

    this.isSyncing = true;

    try {
      // 1. Sync conversations
      const conversations = this.store.getUnsyncedConversations();
      if (conversations.length > 0) {
        console.log(`[SyncEngine] Syncing ${conversations.length} conversations...`);
        const convRows = conversations.map((c) => ({
          session_type: 'offline_voice',
          transcript: JSON.stringify({ user: c.user_message, assistant: c.assistant_response }),
          model_used: c.model_used,
          session_metadata: JSON.stringify({ offline: true, session_id: c.session_id }),
          created_at: c.created_at,
          user_id: this.config.userId || null,
        }));

        await this.supabaseInsert('voice_coach_sessions', convRows);
        this.store.markSynced('offline_conversations', conversations.map((c) => c.id));
      }

      // 2. Sync habit updates
      const habits = this.store.getUnsyncedHabits();
      if (habits.length > 0) {
        console.log(`[SyncEngine] Syncing ${habits.length} habit updates...`);
        const habitRows = habits.map((h) => ({
          id: h.habit_id,
          last_completed: h.completed_at,
          notes: h.notes,
        }));

        // For habits, we use upsert (PATCH-like) via Supabase's prefer header
        for (const row of habitRows) {
          await this.supabaseUpsert('habits', row, 'id');
        }
        this.store.markSynced('offline_habit_updates', habits.map((h) => h.id));
      }

      // 3. Sync memories
      const memories = this.store.getUnsyncedMemories();
      if (memories.length > 0) {
        console.log(`[SyncEngine] Syncing ${memories.length} memories...`);
        const memRows = memories.map((m) => ({
          content: m.content,
          source_type: 'offline_capture',
          metadata: JSON.stringify({ category: m.category, offline: true }),
          created_at: m.created_at,
          user_id: this.config.userId || null,
        }));

        await this.supabaseInsert('user_knowledge_sources', memRows);
        this.store.markSynced('offline_memories', memories.map((m) => m.id));
      }

      console.log('[SyncEngine] Sync complete');
      this.retryCount = 0;
    } catch (err) {
      console.error('[SyncEngine] Sync failed:', err);
      this.retryCount++;

      if (this.retryCount <= this.maxRetries) {
        const delay = this.baseDelay * Math.pow(2, this.retryCount - 1);
        console.log(`[SyncEngine] Retrying in ${delay / 1000}s (attempt ${this.retryCount}/${this.maxRetries})`);
        setTimeout(() => this.sync(), delay);
      } else {
        console.error(`[SyncEngine] Max retries (${this.maxRetries}) exceeded. Will retry on next reconnection.`);
      }
    } finally {
      this.isSyncing = false;
    }
  }

  private supabaseInsert(table: string, rows: any[]): Promise<void> {
    return this.supabaseRequest('POST', `/${table}`, rows, {
      Prefer: 'return=minimal',
    });
  }

  private supabaseUpsert(table: string, row: any, onConflict: string): Promise<void> {
    return this.supabaseRequest('POST', `/${table}`, [row], {
      Prefer: 'resolution=merge-duplicates,return=minimal',
    });
  }

  private supabaseRequest(method: string, path: string, body: any, extraHeaders: Record<string, string> = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = new URL(`/rest/v1${path}`, this.config.supabaseUrl);
      const bodyStr = JSON.stringify(body);

      const options: https.RequestOptions = {
        hostname: url.hostname,
        port: 443,
        path: url.pathname + url.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr),
          apikey: this.config.supabaseServiceKey,
          Authorization: `Bearer ${this.config.supabaseServiceKey}`,
          ...extraHeaders,
        },
        timeout: 15000,
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
          } else {
            reject(new Error(`Supabase ${method} ${path} failed (${res.statusCode}): ${data.substring(0, 300)}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Supabase request timed out')); });
      req.write(bodyStr);
      req.end();
    });
  }
}
