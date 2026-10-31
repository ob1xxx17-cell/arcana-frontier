// ui/network.js - WebSocket Client Network Adapter for Online Multiplayer
(function () {
  const CG = (globalThis.CG = globalThis.CG || {});

  class NetworkClient {
    constructor() {
      this.ws = null;
      this.status = 'disconnected'; // 'disconnected' | 'connecting' | 'connected' | 'in_room' | 'in_game'
      this.roomCode = null;
      this.playerIndex = null;
      this.playerName = 'Player';
      this.opponentName = 'Opponent';
      this.events = new Map();
      this.pingInterval = null;
    }

    on(event, callback) {
      if (!this.events.has(event)) this.events.set(event, []);
      this.events.get(event).push(callback);
    }

    emit(event, data) {
      const callbacks = this.events.get(event) || [];
      callbacks.forEach(cb => {
        try { cb(data); } catch (e) { console.error(`[NET] Error in listener for ${event}:`, e); }
      });
    }

    connect(customUrl) {
      if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
        return Promise.resolve();
      }

      return new Promise((resolve, reject) => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const url = customUrl || `${protocol}//${window.location.host}`;

        this.status = 'connecting';
        this.emit('statusChange', this.status);

        try {
          this.ws = new WebSocket(url);
        } catch (err) {
          this.status = 'disconnected';
          this.emit('statusChange', this.status);
          reject(err);
          return;
        }

        this.ws.onopen = () => {
          this.status = 'connected';
          this.emit('statusChange', this.status);
          this.startPing();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            this.handleMessage(msg);
          } catch (e) {
            console.error('[NET] Failed to parse incoming message:', e);
          }
        };

        this.ws.onclose = () => {
          this.status = 'disconnected';
          this.emit('statusChange', this.status);
          this.stopPing();
          this.emit('disconnected');
        };

        this.ws.onerror = (err) => {
          console.error('[NET] WebSocket error:', err);
          this.emit('error', 'การเชื่อมต่อขัดข้อง');
        };
      });
    }

    handleMessage(msg) {
      switch (msg.type) {
        case 'roomCreated':
          this.status = 'in_room';
          this.roomCode = msg.roomCode;
          this.playerIndex = msg.playerIndex;
          this.emit('roomCreated', msg);
          break;

        case 'roomJoined':
          this.status = 'in_room';
          this.roomCode = msg.roomCode;
          this.playerIndex = msg.playerIndex;
          this.emit('roomJoined', msg);
          break;

        case 'gameStart':
          this.status = 'in_game';
          this.playerIndex = msg.playerIndex;
          this.roomCode = msg.roomCode;
          this.opponentName = msg.opponentName || 'คู่แข่ง';
          this.emit('gameStart', msg);
          break;

        case 'stateUpdate':
          this.emit('stateUpdate', msg);
          break;

        case 'actionRejected':
          this.emit('actionRejected', msg);
          break;

        case 'opponentDisconnected':
          this.emit('opponentDisconnected', msg);
          break;

        case 'opponentReconnected':
          this.emit('opponentReconnected', msg);
          break;

        case 'timerTick':
          this.emit('timerTick', msg);
          break;

        case 'error':
          this.emit('error', msg.message);
          break;

        case 'pong':
          // Heartbeat response
          break;

        default:
          console.warn('[NET] Unhandled message:', msg);
      }
    }

    createRoom({ deckKey, playerName }) {
      this.playerName = playerName || 'Player 1';
      this.send({
        type: 'createRoom',
        deckKey,
        playerName: this.playerName
      });
    }

    joinRoom({ roomCode, deckKey, playerName }) {
      this.playerName = playerName || 'Player 2';
      this.send({
        type: 'joinRoom',
        roomCode,
        deckKey,
        playerName: this.playerName
      });
    }

    sendAction(action) {
      if (this.status !== 'in_game') return;
      this.send({
        type: 'action',
        action
      });
    }

    surrender() {
      if (this.status !== 'in_game') return;
      this.send({ type: 'surrender' });
    }

    send(data) {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(data));
      } else {
        console.warn('[NET] Cannot send message, WebSocket not open.');
      }
    }

    startPing() {
      this.stopPing();
      this.pingInterval = setInterval(() => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.send({ type: 'ping' });
        }
      }, 15000);
    }

    stopPing() {
      if (this.pingInterval) {
        clearInterval(this.pingInterval);
        this.pingInterval = null;
      }
    }

    disconnect() {
      this.stopPing();
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }
      this.status = 'disconnected';
      this.roomCode = null;
      this.playerIndex = null;
    }
  }

  CG.network = new NetworkClient();
})();
