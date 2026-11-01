// server/codes.js - Redeem Code Management System
const fs = require('fs');
const path = require('path');
const { accountManager } = require('./accounts.js');

const DATA_DIR = path.join(__dirname, 'data');
const CODES_FILE = path.join(DATA_DIR, 'codes.json');

const INITIAL_CODES = [
  {
    code: 'WELCOME2026',
    title: '🎁 ของขวัญต้อนรับผู้เล่นใหม่',
    description: 'รับ แบงก์ 20 จำนวน 200 ใบ + แบงก์ 100 จำนวน 5 ใบ',
    curr20: 200,
    curr100: 5,
    cards: [],
    maxUses: null,
    expiresAt: null,
    usedBy: []
  },
  {
    code: 'ARCANAFREE',
    title: '✨ โค้ดฉลองเปิดทดสอบ Arcana Frontier',
    description: 'รับ แบงก์ 20 จำนวน 150 ใบ + แบงก์ 100 จำนวน 3 ใบ',
    curr20: 150,
    curr100: 3,
    cards: [],
    maxUses: null,
    expiresAt: null,
    usedBy: []
  },
  {
    code: 'LUNAGIFT',
    title: '🌙 พลังแห่งจันทราผู้พิทักษ์',
    description: 'รับ แบงก์ 20 จำนวน 300 ใบ สำหรับสุ่มการ์ด',
    curr20: 300,
    curr100: 2,
    cards: [],
    maxUses: null,
    expiresAt: null,
    usedBy: []
  }
];

class CodeManager {
  constructor() {
    this.codes = new Map(); // code (uppercase) -> code object
    this.ensureDataFile();
    this.load();
  }

  ensureDataFile() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (!fs.existsSync(CODES_FILE)) {
        fs.writeFileSync(CODES_FILE, JSON.stringify(INITIAL_CODES, null, 2), 'utf8');
      }
    } catch (e) {
      console.error('[CODES] Error ensuring codes file:', e);
    }
  }

  load() {
    try {
      if (fs.existsSync(CODES_FILE)) {
        const raw = fs.readFileSync(CODES_FILE, 'utf8');
        const list = JSON.parse(raw);
        this.codes.clear();
        for (const item of list) {
          if (item && item.code) {
            this.codes.set(item.code.toUpperCase(), {
              code: item.code.toUpperCase(),
              title: item.title || 'ของขวัญพิเศษ',
              description: item.description || '',
              curr20: Number(item.curr20) || 0,
              curr100: Number(item.curr100) || 0,
              cards: Array.isArray(item.cards) ? item.cards : [],
              maxUses: item.maxUses || null,
              expiresAt: item.expiresAt || null,
              usedBy: Array.isArray(item.usedBy) ? item.usedBy : []
            });
          }
        }
        console.log(`[CODES] Loaded ${this.codes.size} redeem code(s).`);
      }
    } catch (e) {
      console.error('[CODES] Error loading codes:', e);
    }
  }

  save() {
    try {
      const list = Array.from(this.codes.values());
      fs.writeFileSync(CODES_FILE, JSON.stringify(list, null, 2), 'utf8');
    } catch (e) {
      console.error('[CODES] Error saving codes:', e);
    }
  }

  getAllCodes() {
    return Array.from(this.codes.values()).map(c => ({
      code: c.code,
      title: c.title,
      description: c.description,
      curr20: c.curr20,
      curr100: c.curr100,
      cardsCount: (c.cards || []).length,
      usedCount: (c.usedBy || []).length,
      maxUses: c.maxUses,
      expiresAt: c.expiresAt
    }));
  }

  createCode({ code, title, description, curr20 = 0, curr100 = 0, cards = [], maxUses = null, expiresAt = null }) {
    if (!code) return { success: false, message: 'กรุณาระบุรหัสโค้ด' };
    const cleanCode = code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (cleanCode.length < 3 || cleanCode.length > 24) {
      return { success: false, message: 'โค้ดต้องมีความยาว 3-24 ตัวอักษร (A-Z, 0-9)' };
    }

    if (this.codes.has(cleanCode)) {
      return { success: false, message: `โค้ด "${cleanCode}" มีอยู่ในระบบแล้ว` };
    }

    const newCode = {
      code: cleanCode,
      title: title || `โค้ด ${cleanCode}`,
      description: description || '',
      curr20: Math.max(0, Number(curr20) || 0),
      curr100: Math.max(0, Number(curr100) || 0),
      cards: Array.isArray(cards) ? cards : [],
      maxUses: maxUses ? Number(maxUses) : null,
      expiresAt: expiresAt ? Number(expiresAt) : null,
      usedBy: []
    };

    this.codes.set(cleanCode, newCode);
    this.save();
    console.log(`[CODES] Created new code: ${cleanCode}`);
    return { success: true, code: newCode };
  }

  redeem(rawCode, accountId) {
    if (!rawCode || !accountId) {
      return { success: false, message: 'ข้อมูลไม่ครบถ้วน กรุณากรอกโค้ดและไอดีผู้เล่น' };
    }

    const code = rawCode.trim().toUpperCase();
    const entry = this.codes.get(code);

    if (!entry) {
      return { success: false, message: `ไม่พบโค้ด "${code}" ในระบบ หรือโค้ดไม่ถูกต้อง` };
    }

    const accIdKey = accountId.toLowerCase();
    if (entry.usedBy.includes(accIdKey)) {
      return { success: false, message: 'ไอดีนี้เคยแลกรับโค้ดนี้ไปแล้ว (ใช้ได้ 1 ครั้งต่อไอดี)' };
    }

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      return { success: false, message: 'โค้ดนี้หมดอายุการใช้งานแล้ว' };
    }

    if (entry.maxUses && entry.usedBy.length >= entry.maxUses) {
      return { success: false, message: 'โค้ดนี้ถูกใช้งานครบตามจำนวนจำกัดแล้ว' };
    }

    // Apply reward to account
    const acc = accountManager.getAccount(accountId);
    if (!acc) {
      return { success: false, message: 'ไม่พบบัญชีผู้เล่นในระบบ' };
    }

    acc.curr20 = (Number(acc.curr20) || 0) + (entry.curr20 || 0);
    acc.curr100 = (Number(acc.curr100) || 0) + (entry.curr100 || 0);

    // Apply any cards if specified
    if (entry.cards && entry.cards.length > 0) {
      acc.ownedCards = acc.ownedCards || [];
      const currentCards = new Set(acc.ownedCards);
      entry.cards.forEach(cardId => currentCards.add(cardId));
      acc.ownedCards = Array.from(currentCards);
    }

    // Mark as used
    entry.usedBy.push(accIdKey);
    this.save();
    accountManager.save();

    console.log(`[CODES] Account "${accountId}" successfully redeemed "${code}"!`);

    return {
      success: true,
      message: `แลกรับสำเร็จ! ได้รับ ${entry.title}`,
      reward: {
        title: entry.title,
        curr20: entry.curr20 || 0,
        curr100: entry.curr100 || 0,
        cards: entry.cards || []
      },
      updatedAccount: {
        curr20: acc.curr20,
        curr100: acc.curr100,
        ownedCards: acc.ownedCards
      }
    };
  }
}

module.exports = {
  CodeManager,
  codeManager: new CodeManager()
};
