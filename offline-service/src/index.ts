import http from 'http';
import { randomUUID } from 'crypto';
import { ConnectivityMonitor, ConnectivityState } from './connectivity';
import { OllamaClient } from './ollama-client';
import { OfflineStore } from './offline-store';
import { SyncEngine } from './sync-engine';

const PORT = 12900;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://edaigbnnofyxcfbpcvct.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

// ---- Initialize components ----
const connectivity = new ConnectivityMonitor(30000);
const ollama = new OllamaClient('http://localhost:11434', 'gemma2:2b');
const store = new OfflineStore('./data/offline.db');
const sync = new SyncEngine(store, {
  supabaseUrl: SUPABASE_URL,
  supabaseServiceKey: SUPABASE_KEY,
});

// Wire sync to connectivity
sync.bindToMonitor(connectivity);

// Session ID for this run
const sessionId = randomUUID();

// ---- HTTP helpers ----
function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function json(res: http.ServerResponse, status: number, data: any): void {
  const str = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(str),
  });
  res.end(str);
}

// ---- HTTP Server ----
const server = http.createServer(async (req, res) => {
  const url = req.url || '/';
  const method = req.method || 'GET';

  try {
    // GET /status
    if (method === 'GET' && url === '/status') {
      const state = connectivity.getState();
      const model = state === 'OFFLINE' ? 'ollama' : 'openai';
      const pendingSync = store.getPendingSyncCount();
      const ollamaOk = await ollama.isAvailable();
      json(res, 200, { state: state.toLowerCase(), model, pendingSync, ollamaAvailable: ollamaOk, sessionId });
      return;
    }

    // POST /chat
    if (method === 'POST' && url === '/chat') {
      const body = JSON.parse(await readBody(req));
      const message = body.message;
      if (!message) {
        json(res, 400, { error: 'message is required' });
        return;
      }

      const response = await ollama.chat(message);
      const modelUsed = ollama.getModel();

      // Always save to offline store (we're the offline service)
      store.saveConversation(sessionId, message, response, modelUsed);

      json(res, 200, { response, model: modelUsed, offline: true });
      return;
    }

    // POST /habit
    if (method === 'POST' && url === '/habit') {
      const body = JSON.parse(await readBody(req));
      const habitId = body.habitId;
      if (!habitId) {
        json(res, 400, { error: 'habitId is required' });
        return;
      }

      const id = store.saveHabitUpdate(habitId, body.notes || '');
      json(res, 200, { saved: true, id, habitId });
      return;
    }

    // POST /memory
    if (method === 'POST' && url === '/memory') {
      const body = JSON.parse(await readBody(req));
      const content = body.content;
      if (!content) {
        json(res, 400, { error: 'content is required' });
        return;
      }

      const id = store.saveMemory(content, body.category || 'general');
      json(res, 200, { saved: true, id });
      return;
    }

    // 404
    json(res, 404, { error: 'Not found' });
  } catch (err: any) {
    console.error('[Server] Error:', err.message);
    json(res, 500, { error: err.message || 'Internal server error' });
  }
});

// ---- Startup ----
server.listen(PORT, () => {
  console.log('====================================');
  console.log('  AMIE Offline Service v1.0');
  console.log('====================================');
  console.log(`  HTTP API:  http://localhost:${PORT}`);
  console.log(`  Session:   ${sessionId}`);
  console.log(`  Supabase:  ${SUPABASE_URL}`);
  console.log(`  Supabase key: ${SUPABASE_KEY ? 'configured' : 'NOT SET'}`);
  console.log('  Endpoints:');
  console.log('    GET  /status  - service status');
  console.log('    POST /chat    - chat with AMIE');
  console.log('    POST /habit   - record habit completion');
  console.log('    POST /memory  - save a memory');
  console.log('====================================');

  // Start connectivity monitoring
  connectivity.start();
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Shutdown] Stopping...');
  connectivity.stop();
  store.close();
  server.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  connectivity.stop();
  store.close();
  server.close();
  process.exit(0);
});
