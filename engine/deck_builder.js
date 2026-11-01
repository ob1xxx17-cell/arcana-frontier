// engine/deck_builder.js - ระบบจัดเด็ค คลังการ์ด ตรวจสอบกฎการจัดเด็ค และบันทึกเด็คผู้เล่น
(function () {
  const CG = (globalThis.CG = globalThis.CG || {});
  CG.deckBuilder = CG.deckBuilder || {};
  const DB = CG.deckBuilder;

  const STORAGE_KEY = 'cg_custom_decks';
  let memoryStorage = [];
  let customCounter = 0;

  // storage adapter ให้ภายนอก (UI/Browser) เสียบเข้ามาได้โดย engine ไม่แตะ API เบราว์เซอร์ตรง
  DB.storageAdapter = null;
  DB.setStorageAdapter = function (adapter) {
    DB.storageAdapter = adapter;
  };

  // กฎการจัดเด็ค
  DB.RULES = {
    minMain: 40,
    maxMain: 50,
    maxFusion: 10,
    maxGrade4: 10,
    maxExtra: 20,
    maxCopies: 3
  };

  // ดึงการ์ดทั้งหมดที่มีในเกมจากเด็คที่กำหนด
  // ถ้าไม่ระบุ scope จะคืนค่า 48 ใบจาก dinosaur และ aquila (เพื่อ backward compatibility กับ test)
  // ถ้า scope === 'all' จะดึงจากทุกเด็คใน CG.cards
  // ถ้า scope เป็น Array จะดึงเฉพาะเด็คที่ระบุใน Array
  DB.getAllCardDefs = function (scope) {
    const cards = CG.cards || {};
    const map = new Map();
    let keys;
    if (Array.isArray(scope)) {
      keys = scope;
    } else if (scope === 'all') {
      keys = Object.keys(cards).filter(k => cards[k] && !cards[k].isCustom && !k.startsWith('custom_'));
    } else {
      keys = ['dinosaur', 'aquila'];
    }
    keys.forEach(k => {
      const d = cards[k];
      if (!d) return;
      (d.main || []).forEach(c => {
        if (!map.has(c.id)) map.set(c.id, Object.assign({}, c, { isExtra: false, archetype: k }));
      });
      (d.extra || []).forEach(c => {
        if (!map.has(c.id)) map.set(c.id, Object.assign({}, c, { isExtra: true, archetype: k }));
      });
      (d.rarePool || []).forEach(c => {
        const isEx = !!(c.isExtra || c.type === 'fusion' || c.type === 'grade4');
        if (!map.has(c.id)) map.set(c.id, Object.assign({}, c, { isExtra: isEx, archetype: k }));
      });
    });
    return Array.from(map.values());
  };

  // ค้นหาการ์ดตาม cardId จากทุกเด็คที่มีในเกม
  DB.findCardDef = function (cardId) {
    if (!cardId) return null;
    const cards = CG.cards || {};

    // 1. ตรวจสอบในเด็คหลัก (dinosaur, aquila) ก่อนเพื่อความรวดเร็ว
    const baseCards = DB.getAllCardDefs();
    const found = baseCards.find(c => c && c.id === cardId);
    if (found) return found;

    // 2. ถ้าไม่พบ ให้ค้นจากทุกเด็คที่มีใน CG.cards (เช่น mecha_strike, mecha_scrap, luna_guardians, ฯลฯ)
    for (const [k, d] of Object.entries(cards)) {
      if (!d || typeof d !== 'object' || k === 'dinosaur' || k === 'aquila' || d.isCustom || k.startsWith('custom_')) continue;
      if (Array.isArray(d.main)) {
        const m = d.main.find(c => c && c.id === cardId);
        if (m) return Object.assign({}, m, { isExtra: false, archetype: k });
      }
      if (Array.isArray(d.extra)) {
        const e = d.extra.find(c => c && c.id === cardId);
        if (e) return Object.assign({}, e, { isExtra: true, archetype: k });
      }
      if (Array.isArray(d.rarePool)) {
        const r = d.rarePool.find(c => c && c.id === cardId);
        if (r) {
          const isEx = !!(r.isExtra || r.type === 'fusion' || r.type === 'grade4');
          return Object.assign({}, r, { isExtra: isEx, archetype: k });
        }
      }
    }
    return null;
  };

  // ตรวจสอบความถูกต้องของเด็ค
  DB.validateDeck = function (deck) {
    const rules = DB.RULES;
    const errors = [];
    if (!deck || typeof deck !== 'object') {
      return { valid: false, errors: ['ข้อมูลเด็คไม่ถูกต้อง'], mainCount: 0, extraCount: 0 };
    }

    const main = Array.isArray(deck.main) ? deck.main : [];
    const extra = Array.isArray(deck.extra) ? deck.extra : [];

    // นับจำนวนการ์ด
    let mainCount = 0;
    const copyMap = new Map();

    for (const item of main) {
      const count = Number(item.count || 1);
      const id = item.id;
      const def = DB.findCardDef(id);
      if (!def) {
        errors.push(`ไม่พบการ์ดรหัส: ${id}`);
        continue;
      }
      if (def.isExtra || def.type === 'fusion' || def.type === 'grade4') {
        errors.push(`การ์ด ${def.name} เป็นการ์ด Extra Deck ไม่สามารถใส่ในเด็คหลักได้`);
      }
      mainCount += count;
      copyMap.set(id, (copyMap.get(id) || 0) + count);
    }

    let extraCount = 0;
    let fusionCount = 0;
    let grade4Count = 0;
    for (const item of extra) {
      const count = Number(item.count || 1);
      const id = item.id;
      const def = DB.findCardDef(id);
      if (!def) {
        errors.push(`ไม่พบการ์ด Extra รหัส: ${id}`);
        continue;
      }
      if (!def.isExtra && def.type !== 'fusion' && def.type !== 'grade4') {
        errors.push(`การ์ด ${def.name} เป็นการ์ดเด็คหลัก ไม่สามารถใส่ใน Extra Deck ได้`);
      }
      if (def.type === 'fusion') {
        fusionCount += count;
      } else if (def.type === 'grade4') {
        grade4Count += count;
      }
      extraCount += count;
      copyMap.set(id, (copyMap.get(id) || 0) + count);
    }

    // ตรวจสอบขีดจำกัดจำนวนซ้ำ
    copyMap.forEach((count, id) => {
      if (count > rules.maxCopies) {
        const def = DB.findCardDef(id);
        const name = def ? def.name : id;
        errors.push(`การ์ด "${name}" ใส่ได้ไม่เกิน ${rules.maxCopies} ใบ (มี ${count} ใบ)`);
      }
    });

    if (mainCount < rules.minMain) {
      errors.push(`เด็คหลักต้องมีอย่างน้อย ${rules.minMain} ใบ (ปัจจุบันมี ${mainCount} ใบ)`);
    }
    if (mainCount > rules.maxMain) {
      errors.push(`เด็คหลักใส่ได้ไม่เกิน ${rules.maxMain} ใบ (ปัจจุบันมี ${mainCount} ใบ)`);
    }
    if (fusionCount > rules.maxFusion) {
      errors.push(`การ์ด Fusion ใน Extra Deck ใส่ได้ไม่เกิน ${rules.maxFusion} ใบ (ปัจจุบันมี ${fusionCount} ใบ)`);
    }
    if (grade4Count > rules.maxGrade4) {
      errors.push(`การ์ด Grade 4 ใน Extra Deck ใส่ได้ไม่เกิน ${rules.maxGrade4} ใบ (ปัจจุบันมี ${grade4Count} ใบ)`);
    }
    if (extraCount > rules.maxExtra) {
      errors.push(`Extra Deck รวมใส่ได้ไม่เกิน ${rules.maxExtra} ใบ (ปัจจุบันมี ${extraCount} ใบ)`);
    }

    return {
      valid: errors.length === 0,
      errors,
      mainCount,
      extraCount,
      fusionCount,
      grade4Count
    };
  };

  // สร้างเด็คใหม่จาก Template (ถ้าไม่ระบุ cloneFromKey จะได้เด็คว่างเปล่า main: [], extra: [])
  DB.createTemplateDeck = function (name, cloneFromKey) {
    customCounter += 1;
    const id = 'custom_' + Date.now() + '_' + customCounter;
    const deckName = name || 'เด็คของฉัน ' + (DB.loadCustomDecks().length + 1);
    const source = (cloneFromKey && CG.cards && CG.cards[cloneFromKey]) || null;

    if (!source) {
      return {
        key: id,
        name: deckName,
        isCustom: true,
        main: [],
        extra: []
      };
    }

    // คัดลอกการ์ดจากเด็คต้นทาง
    return {
      key: id,
      name: deckName,
      isCustom: true,
      main: (source.main || []).map(c => Object.assign({}, c)),
      extra: (source.extra || []).map(c => Object.assign({}, c))
    };
  };

  // โหลดเด็คที่ผู้เล่นสร้างจาก Storage
  DB.loadCustomDecks = function () {
    try {
      const adapter = DB.storageAdapter || (globalThis.CG && globalThis.CG.customStorage);
      if (adapter && typeof adapter.getItem === 'function') {
        const raw = adapter.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed;
        }
      }
    } catch (e) {
      // fallback to memory
    }
    return memoryStorage;
  };

  // บันทึกรายการเด็คทั้งหมด
  DB.saveAllCustomDecks = function (decks) {
    if (!Array.isArray(decks)) return false;
    memoryStorage = decks;
    try {
      const adapter = DB.storageAdapter || (globalThis.CG && globalThis.CG.customStorage);
      if (adapter && typeof adapter.setItem === 'function') {
        adapter.setItem(STORAGE_KEY, JSON.stringify(decks));
      }
    } catch (e) {
      // fallback
    }
    DB.syncToCGCards();
    return true;
  };

  // บันทึกหรืออัปเดตเด็คใบเดี่ยว
  DB.saveCustomDeck = function (deck) {
    if (!deck || !deck.key) return { ok: false, error: 'ข้อมูลเด็คไม่ครบถ้วน' };
    const val = DB.validateDeck(deck);
    if (!val.valid) {
      return { ok: false, errors: val.errors };
    }

    const decks = DB.loadCustomDecks();
    const idx = decks.findIndex(d => d.key === deck.key);
    deck.isCustom = true;
    deck.main = (deck.main || []).map(c => {
      const full = DB.findCardDef(c.id);
      return full ? Object.assign({}, full, c) : Object.assign({}, c);
    });
    deck.extra = (deck.extra || []).map(c => {
      const full = DB.findCardDef(c.id);
      return full ? Object.assign({}, full, c) : Object.assign({}, c);
    });
    if (idx >= 0) {
      decks[idx] = deck;
    } else {
      decks.push(deck);
    }
    DB.saveAllCustomDecks(decks);
    return { ok: true, deck };
  };

  // ลบเด็ค
  DB.deleteCustomDeck = function (deckKey) {
    const decks = DB.loadCustomDecks();
    const filtered = decks.filter(d => d.key !== deckKey);
    DB.saveAllCustomDecks(filtered);
    if (CG.cards && CG.cards[deckKey]) {
      delete CG.cards[deckKey];
    }
    return true;
  };

  // ซิงค์เด็คที่สร้างเองเข้าสู่ CG.cards เพื่อให้ createGame / lobby ใช้งานได้ทันที
  DB.syncToCGCards = function () {
    const decks = DB.loadCustomDecks();
    CG.cards = CG.cards || {};
    decks.forEach(d => {
      if (!d || !d.key) return;
      const hydratedMain = (d.main || []).map(c => {
        const full = DB.findCardDef(c.id);
        return full ? Object.assign({}, full, c) : Object.assign({}, c);
      });
      const hydratedExtra = (d.extra || []).map(c => {
        const full = DB.findCardDef(c.id);
        return full ? Object.assign({}, full, c) : Object.assign({}, c);
      });
      CG.cards[d.key] = Object.assign({}, d, {
        isCustom: true,
        main: hydratedMain,
        extra: hydratedExtra
      });
    });
  };

  // เรียกซิงค์ทันทีเมื่อโหลดโมดูล
  DB.syncToCGCards();
})();
