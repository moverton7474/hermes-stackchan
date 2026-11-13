/**
 * OTA Bootstrap Endpoint
 *
 * The StackChan robot hits this endpoint on boot to get:
 * 1. WebSocket URL for audio sessions
 * 2. Server time for clock sync
 * 3. Firmware version (echo back device version, no OTA)
 *
 * Protocol: xiaozhi-esp32 v2.2.4 OTA spec
 * See: docs/ARCHITECTURE.md#xiaozhi-wire-protocol-summary
 */

import type { Request, Response } from 'express';
import { logger } from './logger.js';

const BRIDGE_PORT = process.env.BRIDGE_PORT || '8000';
const TIMEZONE_OFFSET = parseInt(process.env.ROBOT_TIMEZONE_OFFSET || '-300');

export function handleOTARequest(req: Request, res: Response): void {
  const deviceId = req.headers['device-id'] || 'unknown';
  const userAgent = req.headers['user-agent'] || '';
  const body = req.body || {};

  logger.info(`OTA request from device ${deviceId} (${userAgent})`);

  // Determine the bridge server's LAN IP for the WS URL
  // The robot needs to reach us over WiFi
  const host = req.headers.host?.split(':')[0] || req.socket.localAddress || '127.0.0.1';

  const response = {
    server_time: {
      timestamp: Date.now(),
      timezone_offset: TIMEZONE_OFFSET,
    },
    firmware: {
      // Echo device version so no OTA update is triggered
      version: body.version?.toString() || userAgent.split('/')[1] || '1.0.0',
      url: '',
    },
    websocket: {
      url: `ws://${host}:${BRIDGE_PORT}/xiaozhi/v1/`,
      token: '',
    },
  };

  logger.info(`OTA response: ws://${host}:${BRIDGE_PORT}/xiaozhi/v1/`);
  res.json(response);
}
