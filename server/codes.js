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
    unlockedDecks: [],
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
    unlockedDecks: [],
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
    unlockedDecks: [],
    maxUses: null,
    expiresAt: null,
    usedBy: []
  },
  {
    code: 'MECHALUNA',
    title: '🤖🌙 ปลดล็อกเด็ค Mecha & Luna Guardians (VIP Master)',
    description: 'ปลดล็อกเด็ค เมก้าสไตรก์, เมก้าสแครป และลูน่าการ์เดียนส์ พร้อมการ์ดทั้งหมดในเด็ค + แบงก์ 20 x 500 + แบงก์ 100 x 10',
    curr20: 500,
    curr100: 10,
    cards: [],
    unlockedDecks: ['mecha_strike', 'mecha_scrap', 'luna_guardians'],
    maxUses: null,
    expiresAt: null,
    usedBy: []
  },
  {
    code: 'LUNAGUARDIANS',
    title: '🌙 ปลดล็อกเด็ค Luna Guardians (ผู้พิทักษ์แห่งจันทรา)',
    description: 'ปลดล็อกเด็ค ลูน่าการ์เดียนส์ พร้อมการ์ดทั้งหมดในเด็ค + แบงก์ 20 x 200',
    curr20: 200,
    curr100: 5,
    cards: [],
    unlockedDecks: ['luna_guardians'],
    maxUses: null,
    expiresAt: null,
    usedBy: []
  },
  {
    code: 'MECHASTRIKE',
    title: '🤖 ปลดล็อกเด็ค Mecha Strike & Scrap (จักรกลประกอบร่าง)',
    description: 'ปลดล็อกเด็ค เมก้าสไตรก์ และ เมก้าสแครป พร้อมการ์ดทั้งหมดในเด็ค + แบงก์ 20 x 200',
    curr20: 200,
    curr100: 5,
    cards: [],
    unlockedDecks: ['mecha_strike', 'mecha_scrap'],
    maxUses: null,
    expiresAt: null,
    usedBy: []
  },
  {
    code: 'ALLDECKS100',
    title: '👑 มหาเทพ Arcana: ปลดล็อกครบทุกเด็คในเกม + แบงก์ 100 x 100 ใบ!',
    description: 'ปลดล็อกครบทั้ง 6 เด็คหลัก (ไดโนเสาร์, อาควิลา, เมก้าสไตรก์, เมก้าสแครป, ลูน่าการ์เดียนส์, คิวบ์ฟอร์จ) และการ์ดทุกใบ พร้อมรับ แบงก์ 100 จำนวน 100 ใบ (10,000 บาท) + แบงก์ 20 จำนวน 1,000 ใบ',
    curr20: 1000,
    curr100: 100,
    cards: [],
    unlockedDecks: ['dinosaur', 'aquila', 'mecha_strike', 'mecha_scrap', 'luna_guardians', 'cube_forge'],
    maxUses: null,
    expiresAt: null,
    usedBy: []
  },
  {
    code: 'OPENGAME100',
    title: '👑 ปลดล็อกทุกเด็ค + แบงก์ 100 จำนวน 100 ใบ',
    description: 'ปลดล็อกเด็คครบทุกเด็คในเกม พร้อมรับแบงก์ 100 x 100 ใบ + แบงก์ 20 x 1,000 ใบ',
    curr20: 1000,
    curr100: 100,
    cards: [],
    unlockedDecks: ['dinosaur', 'aquila', 'mecha_strike', 'mecha_scrap', 'luna_guardians', 'cube_forge'],
    maxUses: null,
    expiresAt: null,
    usedBy: []
  },
  {
    code: 'UNLOCKALL',
    title: '👑 มหาเทพ Arcana: ปลดล็อกครบทุกเด็ค + แบงก์ 100 x 100 ใบ',
    description: 'ปลดล็อกครบทุกเด็คและรับแบงก์ 100 จำนวน 100 ใบ',
    curr20: 1000,
    curr100: 100,
    cards: [],
    unlockedDecks: ['dinosaur', 'aquila', 'mecha_strike', 'mecha_scrap', 'luna_guardians', 'cube_forge'],
    maxUses: null,
    expiresAt: null,
    usedBy: []
  },
  {
    code: 'FREE100ALL',
    title: '👑 ปลดล็อกทุกเด็ค + แบงก์ 100 จำนวน 100 ใบ',
    description: 'ปลดล็อกครบทุกเด็คและรับแบงก์ 100 x 100 ใบ',
    curr20: 1000,
    curr100: 100,
    cards: [],
    unlockedDecks: ['dinosaur', 'aquila', 'mecha_strike', 'mecha_scrap', 'luna_guardians', 'cube_forge'],
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
              unlockedDecks: Array.isArray(item.unlockedDecks) ? item.unlockedDecks : [],
              maxUses: item.maxUses || null,
              expiresAt: item.expiresAt || null,
              usedBy: Array.isArray(item.usedBy) ? item.usedBy : []
            });
          }
        }
        // Auto-merge new initial codes if missing
        for (const def of INITIAL_CODES) {
          if (!this.codes.has(def.code.toUpperCase())) {
            this.codes.set(def.code.toUpperCase(), JSON.parse(JSON.stringify(def)));
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

  redeem(rawCode, accountId, accountData = null) {
    if (!rawCode) {
      return { success: false, message: 'กรุณากรอกรหัสโค้ด' };
    }

    const cleanAccId = (accountId || 'player').trim();
    const code = rawCode.trim().toUpperCase();
    const entry = this.codes.get(code);

    if (!entry) {
      return { success: false, message: `ไม่พบโค้ด "${code}" ในระบบ หรือโค้ดไม่ถูกต้อง` };
    }

    const accIdKey = cleanAccId.toLowerCase();
    if (entry.usedBy.includes(accIdKey)) {
      return { success: false, message: 'ไอดีนี้เคยแลกรับโค้ดนี้ไปแล้ว (ใช้ได้ 1 ครั้งต่อไอดี)' };
    }

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      return { success: false, message: 'โค้ดนี้หมดอายุการใช้งานแล้ว' };
    }

    if (entry.maxUses && entry.usedBy.length >= entry.maxUses) {
      return { success: false, message: 'โค้ดนี้ถูกใช้งานครบตามจำนวนจำกัดแล้ว' };
    }

    // Apply reward to account (auto-provision if missing from server memory)
    let acc = accountManager.getAccount(cleanAccId);
    if (!acc) {
      const now = Date.now();
      acc = {
        id: cleanAccId,
        username: cleanAccId,
        email: cleanAccId,
        password: (accountData && accountData.password) || '',
        passcode: (accountData && accountData.passcode) || '',
        nickname: (accountData && accountData.nickname) || cleanAccId,
        level: (accountData && accountData.level) || 1,
        rank: (accountData && accountData.rank) || '🥉 Bronze I',
        curr20: (accountData && typeof accountData.curr20 === 'number') ? accountData.curr20 : 100,
        curr100: (accountData && typeof accountData.curr100 === 'number') ? accountData.curr100 : 1,
        starterDeckChosen: (accountData && accountData.starterDeckChosen) || null,
        unlockedDecks: (accountData && Array.isArray(accountData.unlockedDecks)) ? accountData.unlockedDecks : [],
        onboarded: true,
        mailClaimed: !!(accountData && accountData.mailClaimed),
        ownedCards: (accountData && Array.isArray(accountData.ownedCards)) ? accountData.ownedCards : [],
        stats: (accountData && accountData.stats) ? accountData.stats : { wins: 0, losses: 0, currentStreak: 0, maxStreak: 0, maxDmg: 0, deckUsage: {} },
        trialsProgress: (accountData && accountData.trialsProgress) ? accountData.trialsProgress : {},
        createdAt: (accountData && accountData.createdAt) || now,
        lastLoginAt: now
      };
      accountManager.accounts.set(accIdKey, acc);
      accountManager.save();
      console.log(`[CODES] Auto-provisioned missing account "${cleanAccId}" during redeem`);
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

    // Apply any unlocked decks if specified
    if (entry.unlockedDecks && Array.isArray(entry.unlockedDecks) && entry.unlockedDecks.length > 0) {
      acc.unlockedDecks = acc.unlockedDecks || [];
      acc.ownedCards = acc.ownedCards || [];
      const currentCards = new Set(acc.ownedCards);

      entry.unlockedDecks.forEach(deckKey => {
        if (!acc.unlockedDecks.includes(deckKey)) {
          acc.unlockedDecks.push(deckKey);
        }
        const d = (globalThis.CG && globalThis.CG.cards) ? globalThis.CG.cards[deckKey] : null;
        if (d) {
          (d.main || []).forEach(c => currentCards.add(c.id));
          (d.extra || []).forEach(c => currentCards.add(c.id));
          (d.rarePool || []).forEach(c => currentCards.add(c.id));
        }
      });

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
        cards: entry.cards || [],
        unlockedDecks: entry.unlockedDecks || []
      },
      updatedAccount: {
        curr20: acc.curr20,
        curr100: acc.curr100,
        ownedCards: acc.ownedCards,
        unlockedDecks: acc.unlockedDecks
      }
    };
  }
}

module.exports = {
  CodeManager,
  codeManager: new CodeManager()
};
