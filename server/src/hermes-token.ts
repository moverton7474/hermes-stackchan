/**
 * Hermes Token Manager
 *
 * Mints ephemeral OpenAI Realtime API tokens by calling the GVC Hermes endpoint.
 * Caches tokens until expiry to avoid redundant requests.
 */

import { logger } from './logger.js';

const HERMES_ENDPOINT = process.env.HERMES_ENDPOINT || 'https://voice.visionaryai.marketing/api/realtime/hermes';
const HERMES_AUTH_TOKEN = process.env.HERMES_AUTH_TOKEN || '';

interface EphemeralToken {
  value: string;
  expiresAt: number;
}

let cachedToken: EphemeralToken | null = null;

/**
 * Mint an ephemeral OpenAI Realtime token via the GVC Hermes endpoint.
 * Returns a cached token if still valid (with 10s safety margin).
 */
export async function mintHermesToken(): Promise<EphemeralToken> {
  // Return cached token if valid
  if (cachedToken && cachedToken.expiresAt > Date.now() / 1000 + 10) {
    logger.debug('Using cached ephemeral token');
    return cachedToken;
  }

  logger.info('Minting new ephemeral token from Hermes');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Support both cookie-based and token-based auth
  if (HERMES_AUTH_TOKEN) {
    if (HERMES_AUTH_TOKEN.startsWith('sk-') || HERMES_AUTH_TOKEN.startsWith('Bearer ')) {
      headers['Authorization'] = HERMES_AUTH_TOKEN.startsWith('Bearer ')
        ? HERMES_AUTH_TOKEN
        : `Bearer ${HERMES_AUTH_TOKEN}`;
    } else {
      // Assume session cookie
      headers['Cookie'] = HERMES_AUTH_TOKEN;
    }
  }

  const response = await fetch(HERMES_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime',
      voice: process.env.OPENAI_REALTIME_VOICE || 'marin',
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Hermes token mint failed (${response.status}): ${body}`);
  }

  const data = await response.json() as {
    client_secret?: { value: string; expires_at: number };
  };

  if (!data.client_secret?.value) {
    throw new Error('Hermes response missing client_secret');
  }

  cachedToken = {
    value: data.client_secret.value,
    expiresAt: data.client_secret.expires_at,
  };

  logger.info({
    expiresAt: new Date(cachedToken.expiresAt * 1000).toISOString(),
  }, 'Ephemeral token minted');

  return cachedToken;
}
