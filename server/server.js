// server/server.js - HTTP Static File, API & WebSocket Game Server
const http = require('http');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { WebSocketServer } = require('ws');
const { RoomManager } = require('./rooms.js');
const { accountManager } = require('./accounts.js');
const { codeManager } = require('./codes.js');

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

function parseJsonBody(req, callback) {
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
    if (body.length > 2e6) req.destroy();
  });
  req.on('end', () => {
    try {
      const data = body ? JSON.parse(body) : {};
      callback(null, data);
    } catch (e) {
      callback(e);
    }
  });
}

function renderStatusHtml(stats, codes) {
  const accountsHtml = stats.accounts.length === 0
    ? '<tr><td colspan="8" style="text-align:center;padding:24px;color:#94a3b8">ยังไม่มีไอดีลงทะเบียนในระบบ</td></tr>'
    : stats.accounts.map((a, i) => {
        const createdDate = a.createdAt ? new Date(a.createdAt).toLocaleString('th-TH') : '-';
        const lastLoginDate = a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString('th-TH') : '-';
        return `
          <tr style="border-bottom:1px solid #e2e8f0;transition:background 0.2s" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
            <td style="padding:12px;font-weight:700;color:#64748b">${i + 1}</td>
            <td style="padding:12px;font-weight:900;color:#0f172a">
              <span style="background:#f1f5f9;padding:3px 8px;border-radius:6px;border:1px solid #cbd5e1">${escapeHtml(a.id)}</span>
            </td>
            <td style="padding:12px;font-weight:800;color:#2563eb">${escapeHtml(a.nickname)}</td>
            <td style="padding:12px;font-weight:700">Lv.${a.level} <span style="font-size:0.85rem;color:#64748b">(${escapeHtml(a.rank)})</span></td>
            <td style="padding:12px;font-weight:700;color:#16a34a">💵 ${a.curr20} / 🎫 ${a.curr100}</td>
            <td style="padding:12px;font-weight:700;color:#475569">
              ${escapeHtml(a.starterDeck)}
              <div style="font-size:0.75rem;color:#94a3b8">การ์ด: ${a.ownedCardsCount} ใบ • ชนะ: ${a.wins} แพ้: ${a.losses}</div>
            </td>
            <td style="padding:12px;font-size:0.85rem;color:#64748b">${createdDate}</td>
            <td style="padding:12px;font-size:0.85rem;color:#059669;font-weight:600">${lastLoginDate}</td>
          </tr>
        `;
      }).join('');

  const codesHtml = (!codes || codes.length === 0)
    ? '<tr><td colspan="5" style="text-align:center;padding:20px;color:#94a3b8">ยังไม่มีโค้ดในระบบ</td></tr>'
    : codes.map((c, i) => {
        return `
          <tr style="border-bottom:1px solid #e2e8f0;transition:background 0.2s" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
            <td style="padding:10px 12px;font-weight:900;color:#7c3aed">
              <span style="background:#f5f3ff;border:1px solid #ddd6fe;padding:4px 10px;border-radius:6px;letter-spacing:1px">${escapeHtml(c.code)}</span>
            </td>
            <td style="padding:10px 12px;font-weight:800;color:#0f172a">
              ${escapeHtml(c.title)}
              <div style="font-size:0.8rem;color:#64748b;font-weight:500">${escapeHtml(c.description)}</div>
            </td>
            <td style="padding:10px 12px;font-weight:700;color:#16a34a">💵 +${c.curr20} / 🎫 +${c.curr100}</td>
            <td style="padding:10px 12px;font-weight:700;color:#334155">${c.usedCount} ${c.maxUses ? '/ ' + c.maxUses : ''} ครั้ง</td>
            <td style="padding:10px 12px"><span style="background:#dcfce7;color:#15803d;padding:2px 8px;border-radius:999px;font-weight:800;font-size:0.75rem">ใช้งานได้</span></td>
          </tr>
        `;
      }).join('');

  return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Arcana Frontier - สถิติและระบบหลังบ้าน</title>
<link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;600;700;900&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; font-family: 'Kanit', sans-serif; }
  body { background: #0f172a; color: #1e293b; margin: 0; padding: 24px; min-height: 100vh; }
  .container { max-width: 1200px; margin: 0 auto; }
  .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; color: white; flex-wrap: wrap; gap: 16px; }
  .title { font-size: 1.8rem; font-weight: 900; margin: 0; display: flex; align-items: center; gap: 10px; }
  .live-badge { display: inline-flex; align-items: center; gap: 6px; background: rgba(34,197,94,0.2); border: 1px solid #22c55e; color: #4ade80; padding: 4px 12px; border-radius: 999px; font-size: 0.85rem; font-weight: 700; }
  .pulse-dot { width: 8px; height: 8px; background: #22c55e; border-radius: 50%; animation: pulse 1.5s infinite; }
  @keyframes pulse { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(1.3); } 100% { opacity: 1; transform: scale(1); } }
  .grid-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-bottom: 24px; }
  .stat-card { background: white; border-radius: 14px; padding: 20px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3); border: 2px solid #334155; }
  .stat-label { font-size: 0.9rem; font-weight: 700; color: #64748b; margin-bottom: 6px; }
  .stat-val { font-size: 2.2rem; font-weight: 900; color: #0f172a; display: flex; align-items: center; justify-content: space-between; }
  .panel { background: white; border-radius: 16px; padding: 24px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3); margin-bottom: 24px; }
  .panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px; }
  .panel-title { font-size: 1.3rem; font-weight: 900; color: #0f172a; margin: 0; }
  .btn-refresh { background: #2563eb; color: white; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 700; cursor: pointer; transition: 0.2s; }
  .btn-refresh:hover { background: #1d4ed8; }
  table { width: 100%; border-collapse: collapse; text-align: left; }
  th { padding: 12px; background: #f8fafc; font-weight: 800; color: #475569; font-size: 0.85rem; border-bottom: 2px solid #cbd5e1; }
  .back-btn { color: #94a3b8; text-decoration: none; font-weight: 700; font-size: 0.9rem; transition: 0.2s; }
  .back-btn:hover { color: white; }
  .input-create { padding: 8px 12px; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 0.88rem; font-weight: 700; }
  .btn-create { background: #7c3aed; color: white; border: none; padding: 8px 18px; border-radius: 8px; font-weight: 800; cursor: pointer; transition: 0.2s; }
  .btn-create:hover { background: #6d28d9; }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div>
      <a href="/" class="back-btn">← กลับไปที่หน้าเกม (Back to Game)</a>
      <h1 class="title">⚔️ Arcana Frontier Server Status <span class="live-badge"><span class="pulse-dot"></span> Live Realtime</span></h1>
    </div>
    <button class="btn-refresh" onclick="location.reload()">🔄 รีเฟรชข้อมูล (Refresh)</button>
  </div>

  <div class="grid-stats">
    <div class="stat-card" style="border-top:5px solid #22c55e">
      <div class="stat-label">🟢 ผู้เล่นออนไลน์ขณะนี้ (Active Players)</div>
      <div class="stat-val"><span id="valOnline">${stats.onlineCount}</span> <span style="font-size:1.8rem">🎮</span></div>
    </div>
    <div class="stat-card" style="border-top:5px solid #3b82f6">
      <div class="stat-label">⚔️ ห้อง PvP ที่กำลังเล่น (Active Rooms)</div>
      <div class="stat-val"><span>${stats.activeRooms}</span> <span style="font-size:1.8rem">🏟️</span></div>
    </div>
    <div class="stat-card" style="border-top:5px solid #f59e0b">
      <div class="stat-label">👥 ไอดีที่สมัครทั้งหมด (Total Registered)</div>
      <div class="stat-val"><span>${stats.totalAccounts}</span> <span style="font-size:1.8rem">📜</span></div>
    </div>
    <div class="stat-card" style="border-top:5px solid #8b5cf6">
      <div class="stat-label">🎁 โค้ดรางวัลที่เปิดใช้งาน (Gift Codes)</div>
      <div class="stat-val"><span>${codes.length}</span> <span style="font-size:1.8rem">🎟️</span></div>
    </div>
  </div>

  <!-- GIFT CODES PANEL -->
  <div class="panel">
    <div class="panel-header">
      <h2 class="panel-title">🎁 ระบบโค้ดของขวัญ (Gift Codes)</h2>
    </div>

    <!-- Create Code Form -->
    <div style="background:#f8fafc;border:2px dashed #cbd5e1;border-radius:12px;padding:16px;margin-bottom:20px">
      <div style="font-weight:900;font-size:1rem;color:#0f172a;margin-bottom:10px">➕ สร้างโค้ดแจกรางวัลใหม่ (Create New Code)</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <input type="text" id="inpNewCode" class="input-create" placeholder="รหัสโค้ด เช่น LUNA2026" style="text-transform:uppercase;width:180px" />
        <input type="number" id="inpNewCurr20" class="input-create" placeholder="แบงก์ 20 (ใบ)" style="width:130px" value="100" />
        <input type="number" id="inpNewCurr100" class="input-create" placeholder="แบงก์ 100 (ใบ)" style="width:130px" value="2" />
        <input type="text" id="inpNewTitle" class="input-create" placeholder="ชื่อของขวัญ / รายละเอียด" style="flex:1;min-width:200px" />
        <button class="btn-create" onclick="createNewCode()">✨ สร้างโค้ดทันที</button>
      </div>
    </div>

    <div style="overflow-x:auto">
      <table>
        <thead>
          <tr>
            <th>รหัสโค้ด (Code)</th>
            <th>ชื่อของขวัญ / คำอธิบาย</th>
            <th>ของรางวัล</th>
            <th>จำนวนการใช้งาน</th>
            <th>สถานะ</th>
          </tr>
        </thead>
        <tbody>
          ${codesHtml}
        </tbody>
      </table>
    </div>
  </div>

  <!-- PLAYERS ACCOUNTS PANEL -->
  <div class="panel">
    <div class="panel-header">
      <h2 class="panel-title">📋 รายชื่อผู้เล่นทั้งหมดในเซิร์ฟเวอร์ (${stats.totalAccounts} ไอดี)</h2>
      <div style="font-size:0.85rem;color:#64748b">อัปเดตอัตโนมัติทุก 10 วินาที</div>
    </div>
    <div style="overflow-x:auto">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>ไอดี (ID)</th>
            <th>ชื่อผู้เล่น (Nickname)</th>
            <th>เลเวล / ยศ</th>
            <th>เงิน (แบงก์ 20 / 100)</th>
            <th>เด็ค & สถิติ</th>
            <th>วันที่สมัคร</th>
            <th>เข้าสู่ระบบล่าสุด</th>
          </tr>
        </thead>
        <tbody>
          ${accountsHtml}
        </tbody>
      </table>
    </div>
  </div>
</div>
<script>
  async function createNewCode() {
    const code = document.getElementById('inpNewCode').value.trim().toUpperCase();
    const curr20 = Number(document.getElementById('inpNewCurr20').value) || 0;
    const curr100 = Number(document.getElementById('inpNewCurr100').value) || 0;
    const title = document.getElementById('inpNewTitle').value.trim() || ('โค้ด ' + code);

    if (!code) return alert('กรุณาระบุรหัสโค้ด');

    try {
      const res = await fetch('/api/code/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, curr20, curr100, title, description: 'แจกแบงก์ 20 x' + curr20 + ' และแบงก์ 100 x' + curr100 })
      });
      const data = await res.json();
      if (data.success) {
        alert('🎉 สร้างโค้ด \"' + code + '\" สำเร็จเรียบร้อย!');
        location.reload();
      } else {
        alert('⚠ ' + data.message);
      }
    } catch (e) {
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    }
  }

  // รีเฟรชข้อมูลทุก 10 วินาที
  setTimeout(() => { location.reload(); }, 10000);
</script>
</body>
</html>`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 3. HTTP Server
const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;

  // --- API: STATS & DASHBOARD ---
  if (pathname === '/status' || pathname === '/stats' || pathname === '/admin') {
    const stats = accountManager.getStats(wss, roomManager);
    const codes = codeManager.getAllCodes();
    const html = renderStatusHtml(stats, codes);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
    res.end(html);
    return;
  }

  if (pathname === '/api/stats') {
    const stats = accountManager.getStats(wss, roomManager);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-cache' });
    res.end(JSON.stringify(stats));
    return;
  }

  // --- API: REDEEM CODES ---
  if (pathname === '/api/code/redeem' && req.method === 'POST') {
    parseJsonBody(req, (err, data) => {
      if (err || !data || !data.code) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'ข้อมูลไม่ครบถ้วน กรุณากรอกโค้ด' }));
        return;
      }
      const result = codeManager.redeem(data.code, data.accountId, data.accountData);
      res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
    });
    return;
  }

  if (pathname === '/api/code/create' && req.method === 'POST') {
    parseJsonBody(req, (err, data) => {
      if (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Invalid JSON body' }));
        return;
      }
      const result = codeManager.createCode(data);
      res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
    });
    return;
  }

  if (pathname === '/api/codes' && req.method === 'GET') {
    const list = codeManager.getAllCodes();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-cache' });
    res.end(JSON.stringify({ success: true, codes: list }));
    return;
  }

  // --- API: AUTHENTICATION ---
  if (pathname === '/api/auth/register' && req.method === 'POST') {
    parseJsonBody(req, (err, data) => {
      if (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Invalid JSON body' }));
        return;
      }
      const result = accountManager.register(data);
      res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
    });
    return;
  }

  if (pathname === '/api/auth/login' && req.method === 'POST') {
    parseJsonBody(req, (err, data) => {
      if (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Invalid JSON body' }));
        return;
      }
      const result = accountManager.login(data);
      res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
    });
    return;
  }

  if (pathname === '/api/auth/sync' && req.method === 'POST') {
    parseJsonBody(req, (err, data) => {
      if (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Invalid JSON body' }));
        return;
      }
      const result = accountManager.sync(data);
      res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
    });
    return;
  }

  // ป้องกัน Path Traversal
  let reqPath = decodeURI(pathname);
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

function broadcastPresence() {
  const onlineCount = wss.clients.size;
  const msg = JSON.stringify({ type: 'presence', onlineCount });
  wss.clients.forEach(c => {
    if (c.readyState === 1) { // OPEN
      c.send(msg);
    }
  });
}

wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress;
  console.log(`[WS] Client connected from ${ip} (Total online: ${wss.clients.size})`);

  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  // ส่งสถานะผู้เล่นออนไลน์ให้ทันทีเมื่อเชื่อมต่อ
  ws.send(JSON.stringify({ type: 'presence', onlineCount: wss.clients.size }));
  broadcastPresence();

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      switch (msg.type) {
        case 'presence':
          ws.send(JSON.stringify({ type: 'presence', onlineCount: wss.clients.size }));
          break;

        case 'quickMatch':
          roomManager.queueQuickMatch(ws, {
            deckKey: msg.deckKey,
            playerName: msg.playerName,
            customDeck: msg.customDeck
          });
          break;

        case 'cancelQuickMatch':
          roomManager.cancelQuickMatch(ws);
          break;

        case 'createRoom':
          roomManager.createRoom(ws, {
            deckKey: msg.deckKey,
            playerName: msg.playerName,
            customDeck: msg.customDeck
          });
          break;

        case 'joinRoom':
          roomManager.joinRoom(ws, {
            roomCode: msg.roomCode,
            deckKey: msg.deckKey,
            playerName: msg.playerName,
            customDeck: msg.customDeck
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
    console.log(`[WS] Client disconnected (${ip}) (Remaining: ${wss.clients.size})`);
    roomManager.handleDisconnect(ws);
    broadcastPresence();
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
  console.log(`  📊 Admin / Status Dashboard at http://localhost:${PORT}/status`);
  console.log(`====================================================`);
});
