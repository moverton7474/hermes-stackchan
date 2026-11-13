/**
 * Logger
 *
 * Structured logging for the bridge server.
 * Uses a simple console-based logger with child context support.
 * Replace with pino or winston for production.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel = LOG_LEVELS[(process.env.LOG_LEVEL || 'info') as LogLevel] ?? 1;

interface Logger {
  debug: (msg: string | Record<string, unknown>, text?: string) => void;
  info: (msg: string | Record<string, unknown>, text?: string) => void;
  warn: (msg: string | Record<string, unknown>, text?: string) => void;
  error: (msg: string | Record<string, unknown>, text?: string) => void;
  child: (context: Record<string, unknown>) => Logger;
}

function createLogger(context: Record<string, unknown> = {}): Logger {
  function log(level: LogLevel, msg: string | Record<string, unknown>, text?: string): void {
    if (LOG_LEVELS[level] < currentLevel) return;

    const timestamp = new Date().toISOString();
    const contextStr = Object.keys(context).length
      ? ' ' + JSON.stringify(context)
      : '';

    if (typeof msg === 'string') {
      console.log(`[${timestamp}] ${level.toUpperCase()}${contextStr}: ${msg}`);
    } else {
      const msgStr = text || '';
      console.log(`[${timestamp}] ${level.toUpperCase()}${contextStr}: ${msgStr} ${JSON.stringify(msg)}`);
    }
  }

  return {
    debug: (msg, text) => log('debug', msg, text),
    info: (msg, text) => log('info', msg, text),
    warn: (msg, text) => log('warn', msg, text),
    error: (msg, text) => log('error', msg, text),
    child: (childContext) => createLogger({ ...context, ...childContext }),
  };
}

export const logger = createLogger();
