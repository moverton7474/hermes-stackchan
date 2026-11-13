import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export interface ConversationRecord {
  id: number;
  session_id: string;
  user_message: string;
  assistant_response: string;
  model_used: string;
  created_at: string;
  synced: number;
}

export interface HabitUpdateRecord {
  id: number;
  habit_id: string;
  completed_at: string;
  notes: string;
  synced: number;
}

export interface MemoryRecord {
  id: number;
  content: string;
  category: string;
  created_at: string;
  synced: number;
}

export class OfflineStore {
  private db: Database.Database;

  constructor(dbPath = './data/offline.db') {
    // Ensure data directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initTables();
    console.log(`[OfflineStore] Database initialized at ${dbPath}`);
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS offline_conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        user_message TEXT NOT NULL,
        assistant_response TEXT NOT NULL,
        model_used TEXT NOT NULL DEFAULT 'gemma2:2b',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        synced INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS offline_habit_updates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        habit_id TEXT NOT NULL,
        completed_at TEXT NOT NULL DEFAULT (datetime('now')),
        notes TEXT DEFAULT '',
        synced INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS offline_memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'general',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        synced INTEGER NOT NULL DEFAULT 0
      );
    `);
  }

  // ---- Conversations ----

  saveConversation(sessionId: string, userMessage: string, assistantResponse: string, modelUsed = 'gemma2:2b'): number {
    const stmt = this.db.prepare(
      'INSERT INTO offline_conversations (session_id, user_message, assistant_response, model_used) VALUES (?, ?, ?, ?)'
    );
    const result = stmt.run(sessionId, userMessage, assistantResponse, modelUsed);
    return result.lastInsertRowid as number;
  }

  getUnsyncedConversations(): ConversationRecord[] {
    return this.db.prepare('SELECT * FROM offline_conversations WHERE synced = 0').all() as ConversationRecord[];
  }

  // ---- Habit Updates ----

  saveHabitUpdate(habitId: string, notes = ''): number {
    const stmt = this.db.prepare(
      'INSERT INTO offline_habit_updates (habit_id, notes) VALUES (?, ?)'
    );
    const result = stmt.run(habitId, notes);
    return result.lastInsertRowid as number;
  }

  getUnsyncedHabits(): HabitUpdateRecord[] {
    return this.db.prepare('SELECT * FROM offline_habit_updates WHERE synced = 0').all() as HabitUpdateRecord[];
  }

  // ---- Memories ----

  saveMemory(content: string, category = 'general'): number {
    const stmt = this.db.prepare(
      'INSERT INTO offline_memories (content, category) VALUES (?, ?)'
    );
    const result = stmt.run(content, category);
    return result.lastInsertRowid as number;
  }

  getUnsyncedMemories(): MemoryRecord[] {
    return this.db.prepare('SELECT * FROM offline_memories WHERE synced = 0').all() as MemoryRecord[];
  }

  // ---- Sync helpers ----

  markSynced(table: 'offline_conversations' | 'offline_habit_updates' | 'offline_memories', ids: number[]): void {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    this.db.prepare(`UPDATE ${table} SET synced = 1 WHERE id IN (${placeholders})`).run(...ids);
    console.log(`[OfflineStore] Marked ${ids.length} rows synced in ${table}`);
  }

  getPendingSyncCount(): number {
    const conv = (this.db.prepare('SELECT COUNT(*) as c FROM offline_conversations WHERE synced = 0').get() as any).c;
    const habits = (this.db.prepare('SELECT COUNT(*) as c FROM offline_habit_updates WHERE synced = 0').get() as any).c;
    const mem = (this.db.prepare('SELECT COUNT(*) as c FROM offline_memories WHERE synced = 0').get() as any).c;
    return conv + habits + mem;
  }

  close(): void {
    this.db.close();
  }
}
