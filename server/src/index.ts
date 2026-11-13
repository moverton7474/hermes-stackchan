/**
 * Hermes StackChan Bridge Server
 *
 * Connects M5Stack StackChan robot (xiaozhi-esp32 firmware) to GVC Hermes
 * via OpenAI Realtime API. The robot speaks the xiaozhi WebSocket protocol;
 * this server translates to/from OpenAI Realtime.
 */

import 'dotenv/config';
import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import { handleOTARequest } from './ota.js';
import { handleXiaozhiConnection } from './xiaozhi-ws.js';
import { logger } from './logger.js';

const BRIDGE_PORT = parseInt(process.env.BRIDGE_PORT || '8000');
const OTA_PORT = parseInt(process.env.OTA_PORT || '8003');
const HOST = process.env.BRIDGE_HOST || '0.0.0.0';

// --- OTA Bootstrap Server (port 8003) ---
const otaApp = express();
otaApp.use(express.json());
otaApp.post('/xiaozhi/ota/', handleOTARequest);
otaApp.get('/xiaozhi/ota/', (req, res) => {
  res.send('Hermes StackChan Bridge - OTA endpoint');
});

const otaServer = http.createServer(otaApp);
otaServer.listen(OTA_PORT, HOST, () => {
  logger.info(`OTA server listening on ${HOST}:${OTA_PORT}`);
});

// --- WebSocket Audio Server (port 8000) ---
const wsApp = express();
const wsServer = http.createServer(wsApp);
const wss = new WebSocketServer({
  server: wsServer,
  path: '/xiaozhi/v1/',
});

wss.on('connection', (ws, req) => {
  const deviceId = req.headers['device-id'] as string || 'unknown';
  const clientId = req.headers['client-id'] as string || 'unknown';
  const protocolVersion = req.headers['protocol-version'] as string || '1';

  logger.info(`Device connected: ${deviceId} (client: ${clientId}, protocol: v${protocolVersion})`);

  handleXiaozhiConnection(ws, {
    deviceId,
    clientId,
    protocolVersion,
  });
});

wsServer.listen(BRIDGE_PORT, HOST, () => {
  logger.info(`WebSocket server listening on ${HOST}:${BRIDGE_PORT}`);
  logger.info('Hermes StackChan Bridge ready');
  logger.info(`OTA URL: http://${HOST}:${OTA_PORT}/xiaozhi/ota/`);
  logger.info(`WS URL:  ws://${HOST}:${BRIDGE_PORT}/xiaozhi/v1/`);
});
