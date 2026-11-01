// server/accounts.js - Centralized Server-Side Account & Persistence Manager
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json');

class AccountManager {
  constructor() {
    this.accounts = new Map(); // id (lowercase) -> account object
    this.ensureDataFile();
    this.load();
  }

  ensureDataFile() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (!fs.existsSync(ACCOUNTS_FILE)) {
        fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify([], null, 2), 'utf8');
      }
    } catch (e) {
      console.error('[ACCOUNTS] Error ensuring data file:', e);
    }
  }

  load() {
    try {
      if (fs.existsSync(ACCOUNTS_FILE)) {
        const raw = fs.readFileSync(ACCOUNTS_FILE, 'utf8');
        const list = JSON.parse(raw);
        this.accounts.clear();
        for (const acc of list) {
          if (acc && acc.id) {
            this.accounts.set(acc.id.toLowerCase(), acc);
          }
        }
        console.log(`[ACCOUNTS] Loaded ${this.accounts.size} account(s) from database.`);
      }
    } catch (e) {
      console.error('[ACCOUNTS] Error loading accounts:', e);
    }
  }

  save() {
    try {
      const list = Array.from(this.accounts.values());
      fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(list, null, 2), 'utf8');
    } catch (e) {
      console.error('[ACCOUNTS] Error saving accounts:', e);
    }
  }

  getAccount(id) {
    if (!id) return null;
    return this.accounts.get(id.toLowerCase()) || null;
  }

  getAllAccounts() {
    return Array.from(this.accounts.values());
  }

  register({ id, password, nickname, starterDeckChosen = null, legacyData = null }) {
    id = (id || '').trim();
    password = (password || '').trim();
    nickname = (nickname || '').trim() || id;

    if (!id || id.length < 3 || id.length > 20 || !/^[A-Za-z0-9]+$/.test(id)) {
      return { success: false, message: 'ไอดีต้องเป็นภาษาอังกฤษและตัวเลข 3-20 ตัวอักษร' };
    }
    if (!password || password.length < 6 || !/^[A-Za-z0-9]+$/.test(password)) {
      return { success: false, message: 'รหัสผ่านต้องเป็นภาษาอังกฤษและตัวเลข 6 ตัวขึ้นไป' };
    }

    const key = id.toLowerCase();
    if (this.accounts.has(key)) {
      return { success: false, message: `ไอดี "${id}" มีอยู่ในระบบแล้ว กรุณาเข้าสู่ระบบ` };
    }

    const now = Date.now();
    const newAcc = {
      id,
      username: id,
      email: id,
      password,
      passcode: password,
      nickname,
      level: (legacyData && legacyData.level) || 1,
      rank: (legacyData && legacyData.rank) || '🥉 Bronze I',
      curr20: (legacyData && typeof legacyData.curr20 === 'number') ? legacyData.curr20 : 100,
      curr100: (legacyData && typeof legacyData.curr100 === 'number') ? legacyData.curr100 : 1,
      starterDeckChosen: starterDeckChosen || (legacyData && legacyData.starterDeckChosen) || null,
      unlockedDecks: (legacyData && Array.isArray(legacyData.unlockedDecks)) ? legacyData.unlockedDecks : [],
      onboarded: (legacyData && typeof legacyData.onboarded === 'boolean') ? legacyData.onboarded : (starterDeckChosen ? true : false),
      mailClaimed: (legacyData && typeof legacyData.mailClaimed === 'boolean') ? legacyData.mailClaimed : false,
      ownedCards: (legacyData && Array.isArray(legacyData.ownedCards)) ? legacyData.ownedCards : [],
      stats: (legacyData && legacyData.stats) ? legacyData.stats : { wins: 0, losses: 0, currentStreak: 0, maxStreak: 0, maxDmg: 0, deckUsage: {} },
      trialsProgress: (legacyData && legacyData.trialsProgress) ? legacyData.trialsProgress : {},
      createdAt: (legacyData && legacyData.createdAt) || now,
      lastLoginAt: now
    };

    this.accounts.set(key, newAcc);
    this.save();
    console.log(`[ACCOUNTS] Registered new account: "${id}" (${nickname})`);
    return { success: true, account: this.sanitizeAccount(newAcc) };
  }

  login({ id, password, legacyData = null }) {
    id = (id || '').trim();
    password = (password || '').trim();

    if (!id || !password) {
      return { success: false, message: 'กรุณากรอกไอดีและรหัสผ่าน' };
    }

    const key = id.toLowerCase();
    let acc = this.accounts.get(key);

    // Auto-migrate from legacy localStorage data if exists on client but not on server
    if (!acc && legacyData && legacyData.id && legacyData.id.toLowerCase() === key) {
      if (legacyData.password === password || legacyData.passcode === password) {
        console.log(`[ACCOUNTS] Migrating legacy account "${id}" to server database...`);
        const regRes = this.register({
          id: legacyData.id,
          password,
          nickname: legacyData.nickname,
          legacyData
        });
        if (regRes.success) {
          return regRes;
        }
      }
    }

    if (!acc) {
      return { success: false, message: `ไม่พบบัญชีไอดี "${id}" ในระบบ` };
    }

    if (acc.password !== password && acc.passcode !== password) {
      return { success: false, message: 'รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง' };
    }

    acc.lastLoginAt = Date.now();
    this.save();
    return { success: true, account: this.sanitizeAccount(acc) };
  }

  sync({ id, password, updates }) {
    if (!id) return { success: false, message: 'Invalid ID' };
    const key = id.toLowerCase();
    const acc = this.accounts.get(key);
    if (!acc) return { success: false, message: 'Account not found' };

    if (password && acc.password !== password && acc.passcode !== password) {
      return { success: false, message: 'Unauthorized' };
    }

    // Apply allowed updates
    const allowed = [
      'nickname', 'level', 'rank', 'curr20', 'curr100',
      'starterDeckChosen', 'unlockedDecks', 'onboarded', 'mailClaimed',
      'ownedCards', 'stats', 'trialsProgress'
    ];

    for (const k of allowed) {
      if (updates && updates[k] !== undefined) {
        acc[k] = updates[k];
      }
    }

    acc.lastLoginAt = Date.now();
    this.save();
    return { success: true, account: this.sanitizeAccount(acc) };
  }

  sanitizeAccount(acc) {
    if (!acc) return null;
    const safe = { ...acc };
    delete safe.password;
    delete safe.passcode;
    return safe;
  }

  getStats(wss, roomManager) {
    const list = this.getAllAccounts();
    const onlineCount = (wss && wss.clients) ? wss.clients.size : 0;
    const activeRooms = (roomManager && roomManager.rooms) ? roomManager.rooms.size : 0;

    return {
      onlineCount,
      totalAccounts: list.length,
      activeRooms,
      accounts: list.map(a => ({
        id: a.id,
        nickname: a.nickname || a.id,
        level: a.level || 1,
        rank: a.rank || '🥉 Bronze I',
        curr20: a.curr20 || 0,
        curr100: a.curr100 || 0,
        starterDeck: a.starterDeckChosen || '-',
        unlockedDecksCount: (a.unlockedDecks || []).length,
        ownedCardsCount: (a.ownedCards || []).length,
        wins: (a.stats && a.stats.wins) || 0,
        losses: (a.stats && a.stats.losses) || 0,
        createdAt: a.createdAt,
        lastLoginAt: a.lastLoginAt
      }))
    };
  }
}

module.exports = {
  AccountManager,
  accountManager: new AccountManager()
};
