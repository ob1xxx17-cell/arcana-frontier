// server/server.js - HTTP Static File & WebSocket Game Server
const http = require('http');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { WebSocketServer } = require('ws');
const { RoomManager } = require('./rooms.js');

const PORT = process.env.PORT || 3000;
const ROOT = path.resolve(__dirname, '..');

// 1. โหลด Engine, Cards, Effects และ Bot เข้า global context ของ Node.js
globalThis.CG = globalThis.CG || {};

const loadDirectories = ['cards', 'effects', 'engine', 'bot'];
for (const dir of loadDirectories) {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) continue;
  for (const f of fs.readdirSync(full).filter(n => n.endsWith('.js')).sort()) {
    const file = path.join(full, f);
    try {
      vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file });
    } catch (e) {
      console.error(`[SERVER] Error loading ${file}:`, e);
    }
  }
}

console.log('[SERVER] Game engine and card database loaded successfully.');

// 2. แผนที่ MIME Types สำหรับให้บริการ Static Files
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf'
};

// 3. HTTP Server
const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // ป้องกัน Path Traversal
  let reqPath = decodeURI(req.url.split('?')[0]);
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

  const filePath = path.normalize(path.join(ROOT, reqPath));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    const isAsset = (ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.mp3' || ext === '.wav');
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': isAsset ? 'public, max-age=86400' : 'no-cache, no-store, must-revalidate'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

// 4. WebSocket Server & Room Manager
const wss = new WebSocketServer({ server });
const roomManager = new RoomManager();

wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress;
  console.log(`[WS] Client connected from ${ip}`);

  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      switch (msg.type) {
        case 'createRoom':
          roomManager.createRoom(ws, {
            deckKey: msg.deckKey,
            playerName: msg.playerName
          });
          break;

        case 'joinRoom':
          roomManager.joinRoom(ws, {
            roomCode: msg.roomCode,
            deckKey: msg.deckKey,
            playerName: msg.playerName
          });
          break;

        case 'action':
          roomManager.handleAction(ws, msg.action);
          break;

        case 'surrender':
          roomManager.handleSurrender(ws);
          break;

        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;

        default:
          console.warn('[WS] Unknown message type:', msg.type);
      }
    } catch (e) {
      console.error('[WS] Malformed message:', e);
      try {
        ws.send(JSON.stringify({ type: 'error', message: 'ข้อมูลคำสั่งไม่ถูกต้อง' }));
      } catch (_) {}
    }
  });

  ws.on('close', () => {
    console.log(`[WS] Client disconnected (${ip})`);
    roomManager.handleDisconnect(ws);
  });

  ws.on('error', (err) => {
    console.error(`[WS] Error on connection (${ip}):`, err.message);
  });
});

// Heartbeat interval to detect stale WebSocket connections
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach(ws => {
    if (ws.isAlive === false) {
      console.log('[WS] Terminating inactive connection');
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

// 5. Start Server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`  🌐 Arcana Frontier Online Server`);
  console.log(`  🚀 Web & WebSocket running at http://localhost:${PORT}`);
  console.log(`====================================================`);
});
