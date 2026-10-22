// engine/core.js - พื้นฐานร่วมของ engine (ขั้น 2): config, rng, ตัวช่วย state, cloneState
// ตรรกะล้วน ไม่มี DOM/setTimeout ไม่เรียกโมดูลอื่นตอนโหลดไฟล์
(function () {
  const CG = (globalThis.CG = globalThis.CG || {});
  CG.engine = CG.engine || {};
  const E = CG.engine;
  E.hooks = E.hooks || {};            // จุดต่อของขั้น 4-6 (เช่น E.hooks.priorityWindow)
  // ยิง trigger ของเอฟเฟกต์ (ตัวจริงอยู่ engine/effectBridge.js) ข้ามเงียบถ้ายังไม่ได้โหลด effects/
  E.fire = E.fire || function (state, events, trigger, ctx) { const F = CG.effects && CG.effects.fire; if (F) F(state, events, trigger, ctx); };
  E.pendingHandlers = E.pendingHandlers || {}; // ขั้น 5 ลงทะเบียนตัวจัดการ pending.kind ของตัวเอง

  // ---- config (ค่าเริ่มต้นอยู่ที่นี่ที่เดียว ตรงกับ CONTRACT ข้อ 1) ----
  const DEFAULT_CONFIG = {
    startLp: 8000, startMana: 5, startHand: 5, handLimit: 7, mulliganCount: 1,
    firstTurnNoAttack: true, monsterSlots: 5, spellSlots: 5, maxCopies: 3,
    extraSize: { fusion: 10, grade4: 10 }, tiebreakTurn: 50,
    damageStepAllowSpeed2: true, chainTimeoutSec: null, stackMaxLayers: null,
    overlayDestroyTogether: true
  };
  E.mergeConfig = function (over) {
    const c = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    for (const k of Object.keys(over || {})) {
      if (c[k] && typeof c[k] === 'object' && over[k] && typeof over[k] === 'object') Object.assign(c[k], over[k]);
      else c[k] = over[k];
    }
    return c;
  };

  // ---- rng แบบกำหนด seed (mulberry32) state อยู่ใน rng.s เพื่อ clone ได้ ----
  function rngNext() {
    this.s = (this.s + 0x6D2B79F5) | 0;
    let t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  E.makeRng = function (seed, s) {
    const sd = seed === undefined || seed === null ? 1 : seed;
    return { seed: sd, s: s === undefined ? (Number(sd) | 0) : s, next: rngNext };
  };
  E.shuffle = function (arr, rng) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };

  // ---- ค้นข้อมูลการ์ดจาก CG.cards (id ไม่ซ้ำทั้งเกม) ----
  let cache = null, cacheN = -1;
  function buildIndex() {
    const idx = {}; const decks = CG.cards || {};
    for (const k of Object.keys(decks)) for (const c of (decks[k].main || []).concat(decks[k].extra || [])) idx[c.id] = c;
    cache = idx; cacheN = Object.keys(decks).length;
  }
  E.findCard = function (id) {
    if (!cache || cacheN !== Object.keys(CG.cards || {}).length) buildIndex();
    if (!cache[id]) buildIndex();
    return cache[id] || null;
  };
  E.cardOf = function (inst) { return E.findCard(inst.cardId); };

  // ---- CardInstance ----
  E.newInstance = function (state, def, ownerIdx) {
    const mon = def.type !== 'spell';
    return {
      uid: state.nextUid++, cardId: def.id, owner: ownerIdx, controller: ownerIdx,
      faceDown: false, position: 'atk',
      level: mon ? def.level : null, baseAtk: mon ? def.atk : null, baseDef: mon ? def.def : null,
      atkMod: 0, defMod: 0, tempAtkMod: 0, tempDefMod: 0, under: [],
      flags: { summonedTurn: null, canAttack: true, attackedThisTurn: false, positionChangedThisTurn: false, setTurn: null }
    };
  };
  E.resetInstance = function (inst) {
    const def = E.cardOf(inst);
    inst.controller = inst.owner; inst.faceDown = false; inst.position = 'atk';
    if (def && def.type !== 'spell') { inst.level = def.level; inst.baseAtk = def.atk; inst.baseDef = def.def; }
    inst.atkMod = inst.defMod = inst.tempAtkMod = inst.tempDefMod = 0;
    delete inst.auraAtk; delete inst.auraDef;   // aura ผูกกับการอยู่บนสนาม ออกจากสนามแล้วหาย
    inst.under = [];
    inst.flags = { summonedTurn: null, canAttack: true, attackedThisTurn: false, positionChangedThisTurn: false, setTurn: null };
  };
  // auraAtk/auraDef = ค่าจาก continuous aura (4E-2B) คำนวณใหม่โดย CG.effects.refreshAuras ไม่ใช่ค่าถาวร (ไม่มีฟิลด์ = 0)
  E.atk = function (m) { return Math.max(0, m.baseAtk + m.atkMod + m.tempAtkMod + (m.auraAtk || 0)); };
  E.def = function (m) { return Math.max(0, m.baseDef + m.defMod + m.tempDefMod + (m.auraDef || 0)); };
  // คำนวณ aura ใหม่ (ข้ามเงียบถ้ายังไม่ได้โหลด effects/)
  E.refreshAuras = function (state) { const F = CG.effects && CG.effects.refreshAuras; if (F) F(state); };

  // ---- ตัวช่วย state ----
  E.setPhase = function (state, events, phase) {
    state.phase = phase;
    events.push({ type: 'phaseChange', phase, turn: state.turn, activeIdx: state.activeIdx });
  };
  // หน้าต่างตอบโต้ (priority window): ขั้น 2 ไม่มีลิงก์ใน Chain จึงข้ามอัตโนมัติ
  // ขั้น 5 ตั้ง E.hooks.priorityWindow(state, events, ctx) คืน true ถ้าเปิด pending แล้วหยุดรอ
  E.openWindow = function (state, events, ctx) {
    const h = E.hooks.priorityWindow;
    return h ? !!h(state, events, ctx) : false;
  };
  // จั่ว (ได้มานา +1 ต่อใบ) บนสุดของเด็ค = deck[0] เด็คหมดจั่วไม่ได้ ไม่ได้มานา
  E.drawCard = function (state, events, pIdx, withMana) {
    const p = state.players[pIdx];
    if (!p.deck.length) return null;
    const c = p.deck.shift(); p.hand.push(c);
    events.push({ type: 'draw', player: pIdx, uid: c.uid });
    if (withMana) { p.mana += 1; events.push({ type: 'manaChange', player: pIdx, delta: 1, reason: 'draw' }); }
    return c;
  };
  E.endGame = function (state, events, winner, reason) {
    if (state.ended) return;
    state.ended = true; state.winner = winner; state.pending = null; state.chain = [];
    events.push({ type: 'gameEnd', winner, reason });
  };
  E.changeLp = function (state, events, pIdx, delta, reason) {
    const p = state.players[pIdx];
    const applied = Math.max(delta, -p.lp);   // LP ไม่ต่ำกว่า 0
    p.lp += applied;
    events.push({ type: 'lpChange', player: pIdx, delta: applied, reason });
    E.checkLpEnd(state, events);
    return applied;
  };
  E.checkLpEnd = function (state, events) {
    if (state.ended) return;
    const a = state.players[0].lp <= 0, b = state.players[1].lp <= 0;
    if (a && b) E.endGame(state, events, 'draw', 'lp');
    else if (a) E.endGame(state, events, 1, 'lp');
    else if (b) E.endGame(state, events, 0, 'lp');
  };
  // นำมอนสเตอร์ออกจากสนาม dest: grave | extra | removed (การ์ดใต้ตัวมันไปสุสานเสมอ)
  E.leaveField = function (state, events, pIdx, slot, dest) {
    const p = state.players[pIdx]; const m = p.monsters[slot];
    p.monsters[slot] = null;
    const unders = m.under;
    const moved = [];
    const put = (inst, d) => {
      E.resetInstance(inst);
      state.players[inst.owner][d].push(inst);
      events.push({ type: 'moveCard', uid: inst.uid, from: 'monster', to: d, player: pIdx, slot });
      if (d === 'grave') moved.push(inst);
    };
    m.under = [];
    put(m, dest);
    unders.forEach(u => put(u, 'grave'));
    E.refreshAuras(state);   // ต้นทาง aura ออกจากสนามแล้ว ค่า aura ต้องหายก่อนยิง trigger ต่อ
    moved.forEach(inst => E.fire(state, events, 'onSentToGrave', { source: inst }));   // ยิงหลังย้ายครบทุกใบ
    return m;
  };
  // ทำลายมอนสเตอร์ (ข้อ 1 overlayDestroyTogether: ตัวใต้ถูกทำลายด้วยนับเป็นหน่วยเดียว)
  E.destroyMonster = function (state, events, pIdx, slot, by) {
    const m = state.players[pIdx].monsters[slot];
    const def = E.cardOf(m);
    const unders = state.config.overlayDestroyTogether ? m.under.slice() : [];
    events.push({ type: 'destroy', uid: m.uid, by });
    unders.forEach(u => events.push({ type: 'destroy', uid: u.uid, by }));
    E.leaveField(state, events, pIdx, slot, def && def.type === 'grade4' ? 'extra' : 'grave');
    E.fire(state, events, 'onDestroyed', { source: m, by });
    unders.forEach(u => E.fire(state, events, 'onDestroyed', { source: u, by }));
  };
  E.boardCount = function (p) {
    return p.monsters.filter(Boolean).length + p.spells.filter(Boolean).length + (p.fieldSpell ? 1 : 0);
  };

  // ---- cloneState: สำเนาลึก (log แชร์ event ที่ไม่เปลี่ยนแปลงเพื่อความเร็วของบอท) ----
  E.cloneState = function (state) {
    const { rng, log, ...rest } = state;
    const c = JSON.parse(JSON.stringify(rest));
    c.log = log.slice();
    c.rng = E.makeRng(rng.seed, rng.s);
    return c;
  };
})();
