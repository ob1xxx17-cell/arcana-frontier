// tests/effects.test.js - เทสต์ effects/runner.js และ effects/primitives_core.js (ขั้น 4A-1)
const assert = require('assert');
require('./fixtures');
require('../engine/core.js');
require('../effects/runner.js');
require('../effects/primitives_core.js');
require('../effects/primitives_combat.js');
require('../effects/primitives_move.js');
require('../engine/summon.js');
const CG = globalThis.CG, E = CG.engine, FX = CG.effects;

// run.js คาดว่าไฟล์เทสต์ export ลิสต์ {name, run(assert)} ; ถ้ามี globalThis.test (runner อื่น) ใช้ตัวนั้นแทน
const tests = [];
const T = typeof globalThis.test === 'function' ? globalThis.test
  : (name, fn) => tests.push({ name: 'effects: ' + name, run: () => fn() });

function mkState() {
  const st = { turn: 1, activeIdx: 0, ended: false, nextUid: 1, config: E.mergeConfig(), log: [], rng: E.makeRng(1), players: [] };
  for (let i = 0; i < 2; i++) st.players.push({ lp: 8000, mana: 5, deck: [], hand: [], grave: [], monsters: [null, null, null, null, null], spells: [null, null, null, null, null] });
  const defs = ['fx_l1a', 'fx_l2a', 'fx_l3a'];
  for (let i = 0; i < 4; i++) st.players[0].deck.push(E.newInstance(st, E.findCard(defs[i % 3]), 0));
  return st;
}
function put(st, p, slot, id) {
  const m = E.newInstance(st, E.findCard(id), p); st.players[p].monsters[slot] = m; return m;
}
const ctxOf = (m, p) => ({ player: p === undefined ? 0 : p, source: m });

T('draw: จั่วตามจำนวน ได้มานา +1 ต่อใบ', () => {
  const st = mkState(), ev = [];
  const r = FX.run(st, ev, { id: 'd', do: [{ op: 'draw', count: 2 }] }, ctxOf(null));
  assert.strictEqual(r.ok, true);
  assert.strictEqual(st.players[0].hand.length, 2);
  assert.strictEqual(st.players[0].mana, 7);
  assert.strictEqual(ev.filter(e => e.type === 'draw').length, 2);
});

T('draw: เด็คหมดหยุดจั่ว ไม่ได้มานาเกิน', () => {
  const st = mkState(), ev = [];
  FX.run(st, ev, { id: 'd', do: [{ op: 'draw', count: 9 }] }, ctxOf(null));
  assert.strictEqual(st.players[0].hand.length, 4);
  assert.strictEqual(st.players[0].mana, 9);
});

T('addMana: เพิ่มมานาให้ผู้ใช้เอฟเฟกต์ และให้ฝ่ายตรงข้ามได้ด้วย player:opp', () => {
  const st = mkState(), ev = [];
  FX.run(st, ev, { id: 'a', do: [{ op: 'addMana', amount: 3 }, { op: 'addMana', amount: 1, player: 'opp' }] }, ctxOf(null));
  assert.strictEqual(st.players[0].mana, 8);
  assert.strictEqual(st.players[1].mana, 6);
  assert.ok(ev.some(e => e.type === 'manaChange' && e.reason === 'effect' && e.delta === 3));
});

T('modifyStat permanent: self เปลี่ยน atkMod ถาวร', () => {
  const st = mkState(), m = put(st, 0, 0, 'fx_l1a');
  FX.run(st, [], { id: 'm', do: [{ op: 'modifyStat', target: 'self', stat: 'atk', amount: 500, duration: 'permanent' }] }, ctxOf(m));
  assert.strictEqual(m.atkMod, 500); assert.strictEqual(m.tempAtkMod, 0);
  assert.strictEqual(E.atk(m), 1500);
});

T('modifyStat endTurn: def ใช้ tempDefMod ไม่แตะค่าถาวร', () => {
  const st = mkState(), m = put(st, 0, 0, 'fx_l1b');
  FX.run(st, [], { id: 'm', do: [{ op: 'modifyStat', target: 'self', stat: 'def', amount: -300, duration: 'endTurn' }] }, ctxOf(m));
  assert.strictEqual(m.tempDefMod, -300); assert.strictEqual(m.defMod, 0);
  assert.strictEqual(E.def(m), 900);
});

T('modifyStat: selector ฝ่ายตรงข้ามตาม filter และ count', () => {
  const st = mkState(), src = put(st, 0, 0, 'fx_l1a');
  const a = put(st, 1, 0, 'fx_l1b'), b = put(st, 1, 1, 'fx_l3a'), c = put(st, 1, 2, 'fx_l3b');
  const tgt = { side: 'opp', zone: 'monster', filter: { levelMin: 3 }, count: 1 };
  FX.run(st, [], { id: 'm', do: [{ op: 'modifyStat', target: tgt, stat: 'atk', amount: -1000, duration: 'endTurn' }] }, ctxOf(src));
  assert.strictEqual(a.tempAtkMod, 0); assert.strictEqual(b.tempAtkMod, -1000); assert.strictEqual(c.tempAtkMod, 0);
});

T('condition ไม่ผ่าน: ไม่จ่ายมานา ไม่รัน do ไม่นับ limit', () => {
  const st = mkState(), ev = [];
  FX.registerCondition('testNever', () => false);
  const eff = { id: 'c', cost: { mana: 2 }, limit: { per: 'turn', key: 'c', count: 1 }, condition: [{ op: 'testNever' }], do: [{ op: 'draw', count: 1 }] };
  const r = FX.run(st, ev, eff, ctxOf({ uid: 1, cardId: 'fx_l1a', controller: 0 }));
  assert.deepStrictEqual([r.ok, r.reason], [false, 'conditionFailed']);
  assert.strictEqual(st.players[0].mana, 5); assert.strictEqual(st.players[0].hand.length, 0);
  assert.strictEqual(ev.length, 0);
  assert.deepStrictEqual((st.effectLimits && st.effectLimits.turn.used) || {}, {});
});

T('cost: จ่ายมานาตอนประกาศ / มานาไม่พอไม่รัน', () => {
  const st = mkState(), ev = [], src = { uid: 1, cardId: 'fx_l1a', controller: 0 };
  const eff = { id: 'p', cost: { mana: 3 }, do: [{ op: 'addMana', amount: 1 }] };
  assert.strictEqual(FX.run(st, ev, eff, ctxOf(src)).ok, true);
  assert.strictEqual(st.players[0].mana, 3);   // 5 - 3 + 1
  assert.ok(ev.some(e => e.type === 'manaChange' && e.delta === -3 && e.reason === 'cost'));
  st.players[0].mana = 2;
  const r = FX.run(st, ev, eff, ctxOf(src));
  assert.deepStrictEqual([r.ok, r.reason], [false, 'notEnoughMana']);
  assert.strictEqual(st.players[0].mana, 2);
});

T('limit: per turn รีเซ็ตเมื่อเปลี่ยนเทิร์น, per game ไม่รีเซ็ต, นับแยกตามการ์ดและเจ้าของ', () => {
  const st = mkState(), src = { uid: 1, cardId: 'fx_l1a', controller: 0 }, other = { uid: 2, cardId: 'fx_l1b', controller: 0 };
  const turnEff = { id: 't', limit: { per: 'turn', key: 'k', count: 1 }, do: [{ op: 'addMana', amount: 1 }] };
  const gameEff = { id: 'g', limit: { per: 'game', key: 'g', count: 2 }, do: [{ op: 'addMana', amount: 1 }] };
  assert.strictEqual(FX.run(st, [], turnEff, ctxOf(src)).ok, true);
  assert.strictEqual(FX.run(st, [], turnEff, ctxOf(src)).reason, 'limitReached');
  assert.strictEqual(FX.run(st, [], turnEff, ctxOf(other)).ok, true);
  st.turn = 2;
  assert.strictEqual(FX.run(st, [], turnEff, ctxOf(src)).ok, true);
  assert.strictEqual(FX.run(st, [], gameEff, ctxOf(src)).ok, true);
  st.turn = 3;
  assert.strictEqual(FX.run(st, [], gameEff, ctxOf(src)).ok, true);
  assert.strictEqual(FX.run(st, [], gameEff, ctxOf(src)).reason, 'limitReached');
  const copy = E.cloneState(st);   // limit ต้อง clone ได้
  assert.strictEqual(FX.run(copy, [], gameEff, ctxOf(src)).reason, 'limitReached');
});

T('op ที่ไม่รู้จัก: ปฏิเสธก่อนจ่าย cost และ do ลำดับถูกต้อง', () => {
  const st = mkState();
  const bad = { id: 'u', cost: { mana: 1 }, do: [{ op: 'addMana', amount: 1 }, { op: 'noSuchOp' }] };
  const r = FX.run(st, [], bad, ctxOf(null));
  assert.deepStrictEqual([r.ok, r.reason, r.op], [false, 'unknownOp', 'noSuchOp']);
  assert.strictEqual(st.players[0].mana, 5);
  const order = [];
  FX.register('testMark', (s, e, step) => order.push(step.n));
  FX.run(st, [], { id: 'o', do: [{ op: 'testMark', n: 1 }, { op: 'testMark', n: 2 }, { op: 'testMark', n: 3 }] }, ctxOf(null));
  assert.deepStrictEqual(order, [1, 2, 3]);
});

// ---- ขั้น 4A-3: primitives_combat (destroy, sendToGrave, damage, heal) ----
function withUnder(st, p, m, id) {
  const u = E.newInstance(st, E.findCard(id), p); m.under.push(u); return u;
}
const destroyEff = target => ({ id: 'x', do: [{ op: 'destroy', target }] });

T('destroy self: มอนสเตอร์ลงสุสานพร้อม event destroy', () => {
  const st = mkState(), ev = [], m = put(st, 0, 2, 'fx_l1a');
  assert.strictEqual(FX.run(st, ev, destroyEff('self'), ctxOf(m)).ok, true);
  assert.strictEqual(st.players[0].monsters[2], null);
  assert.deepStrictEqual(st.players[0].grave.map(c => c.uid), [m.uid]);
  assert.strictEqual(ev.filter(e => e.type === 'destroy' && e.uid === m.uid).length, 1);
});

T('destroy + overlayDestroyTogether เปิด: ตัวใต้ถูกทำลายด้วย (มี event destroy) และลงสุสาน', () => {
  const st = mkState(), ev = [], m = put(st, 0, 2, 'fx_l2a');
  const u = withUnder(st, 0, m, 'fx_l1a');
  assert.strictEqual(st.config.overlayDestroyTogether, true);
  FX.run(st, ev, destroyEff('self'), ctxOf(m));
  assert.strictEqual(st.players[0].grave.length, 2);
  assert.strictEqual(ev.filter(e => e.type === 'destroy' && e.uid === u.uid).length, 1);
});

T('destroy + overlayDestroyTogether ปิด: ตัวใต้ไปสุสานแต่ไม่นับว่าถูกทำลาย', () => {
  const st = mkState(), ev = [], m = put(st, 0, 2, 'fx_l2a');
  const u = withUnder(st, 0, m, 'fx_l1a');
  st.config.overlayDestroyTogether = false;
  FX.run(st, ev, destroyEff('self'), ctxOf(m));
  assert.strictEqual(st.players[0].grave.length, 2);
  assert.strictEqual(ev.filter(e => e.type === 'destroy' && e.uid === u.uid).length, 0);
  assert.strictEqual(ev.filter(e => e.type === 'destroy' && e.uid === m.uid).length, 1);
});

T('destroy selector: ฝ่ายตรงข้าม + filter + count ทำลายเฉพาะที่ตรง', () => {
  const st = mkState(), ev = [], src = put(st, 0, 0, 'fx_l3a');
  const a = put(st, 1, 0, 'fx_l1a'), b = put(st, 1, 1, 'fx_l2a'), c = put(st, 1, 2, 'fx_l2b');
  FX.run(st, ev, destroyEff({ side: 'opp', zone: 'monster', filter: { levelMin: 2 }, count: 1 }), ctxOf(src));
  assert.strictEqual(st.players[1].monsters[0], a);
  assert.strictEqual(st.players[1].monsters[1], null);
  assert.strictEqual(st.players[1].monsters[2], c);
  assert.strictEqual(st.players[0].monsters[0], src);
});

T('destroy + preventDestruction: ไม่ถูกทำลาย และทำ instead แทน', () => {
  const fixMain = CG.cards.fixture.main;   // เด็คจำลองใช้ร่วมกับเทสต์อื่น ต้องคืนสภาพเสมอ
  CG.cards.fixture.main.push({ id: 'fx_guard', name: 'fx_guard', type: 'monster', level: 2, atk: 1000, def: 1000, mana: '0', count: 1,
    leader: false, proposed_level: false, text: '',
    effects: [{ id: 'g', trigger: 'continuous', do: [{ op: 'preventDestruction', instead: [{ op: 'addMana', amount: 3 }] }] }] });
  try {
    const st = mkState(), ev = [], g = put(st, 1, 0, 'fx_guard'), src = put(st, 0, 0, 'fx_l3a');
    FX.run(st, ev, destroyEff({ side: 'opp', zone: 'monster' }), ctxOf(src));
    assert.strictEqual(st.players[1].monsters[0], g);
    assert.strictEqual(st.players[1].grave.length, 0);
    assert.strictEqual(st.players[1].mana, 8);   // instead ทำงานให้เจ้าของการ์ดที่กัน
    assert.strictEqual(ev.filter(e => e.type === 'destroyPrevented').length, 1);
  } finally { fixMain.pop(); }
});

T('sendToGrave monster: ไม่นับเป็นการทำลาย ตัวใต้ลงสุสานด้วย', () => {
  const st = mkState(), ev = [], m = put(st, 0, 1, 'fx_l2a');
  withUnder(st, 0, m, 'fx_l1a');
  FX.run(st, ev, { id: 's', do: [{ op: 'sendToGrave', target: 'self' }] }, ctxOf(m));
  assert.strictEqual(st.players[0].monsters[1], null);
  assert.strictEqual(st.players[0].grave.length, 2);
  assert.strictEqual(ev.filter(e => e.type === 'destroy').length, 0);
  assert.strictEqual(ev.filter(e => e.type === 'moveCard' && e.to === 'grave').length, 2);
});

T('sendToGrave จากมือ/สเปล: ย้ายจากโซนปัจจุบันลงสุสานเจ้าของ', () => {
  const st = mkState(), ev = [];
  const h = E.newInstance(st, E.findCard('fx_l1b'), 0); st.players[0].hand.push(h);
  const sp = E.newInstance(st, E.findCard('fx_spell'), 0); st.players[0].spells[3] = sp;
  FX.run(st, ev, { id: 's', do: [
    { op: 'sendToGrave', target: { side: 'self', zone: 'hand', count: 1 } },
    { op: 'sendToGrave', target: { side: 'self', zone: 'spell' } }] }, ctxOf(null));
  assert.strictEqual(st.players[0].hand.length, 0);
  assert.strictEqual(st.players[0].spells[3], null);
  assert.deepStrictEqual(st.players[0].grave.map(c => c.uid), [h.uid, sp.uid]);
  assert.deepStrictEqual(ev.filter(e => e.type === 'moveCard').map(e => e.from), ['hand', 'spell']);
});

T('damage: ลด LP ผู้เล่นที่ระบุ ไม่ต่ำกว่า 0 และ LP 0 จบเกม', () => {
  const st = mkState(), ev = [];
  FX.run(st, ev, { id: 'd', do: [{ op: 'damage', player: 'opp', amount: 500 }] }, ctxOf(null));
  assert.strictEqual(st.players[1].lp, 7500);
  assert.strictEqual(st.players[0].lp, 8000);
  FX.run(st, ev, { id: 'd2', do: [{ op: 'damage', player: 'opp', amount: 99999 }] }, ctxOf(null));
  assert.strictEqual(st.players[1].lp, 0);
  assert.strictEqual(st.ended, true);
  assert.strictEqual(st.winner, 0);
});

T('heal: เพิ่ม LP ผู้ใช้เป็นค่าตั้งต้น เลือกฝ่ายตรงข้ามได้ amount ติดลบไม่มีผล', () => {
  const st = mkState(), ev = [];
  st.players[0].lp = 3000;
  FX.run(st, ev, { id: 'h', do: [{ op: 'heal', amount: 1000 }, { op: 'heal', player: 'opp', amount: 200 }, { op: 'heal', amount: -700 }] }, ctxOf(null));
  assert.strictEqual(st.players[0].lp, 4000);
  assert.strictEqual(st.players[1].lp, 8200);
  assert.strictEqual(ev.filter(e => e.type === 'lpChange').length, 2);
});

// ---- ขั้น 4B: primitives_move (search, specialSummon, returnToHand, returnToDeck, banish) ----
function mkMove() {
  const st = mkState();
  for (const p of st.players) { p.flags = {}; p.removed = []; }
  return st;
}
const inst = (st, p, id) => E.newInstance(st, E.findCard(id), p);

T('move: ลงทะเบียนครบ 5 ชิ้นส่วน', () => {
  for (const op of ['search', 'specialSummon', 'returnToHand', 'returnToDeck', 'banish']) assert.strictEqual(typeof FX.ops[op], 'function', op);
});

T('search: ได้การ์ดตามฟิลเตอร์จากเด็คเข้ามือ ไม่ได้มานา', () => {
  const st = mkMove(), ev = [];
  const before = st.players[0].deck.length;
  const r = FX.run(st, ev, { id: 's', do: [{ op: 'search', from: 'deck', filter: { cardId: 'fx_l2a' }, to: 'hand' }] }, ctxOf(null));
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(st.players[0].hand.map(c => c.cardId), ['fx_l2a']);
  assert.strictEqual(st.players[0].deck.length, before - 1);
  assert.strictEqual(st.players[0].mana, 5);
  assert.ok(!ev.some(e => e.type === 'draw' || e.type === 'manaChange'));
});

T('search: ไม่มีการ์ดตรงฟิลเตอร์ = ไม่ย้ายอะไร', () => {
  const st = mkMove();
  FX.run(st, [], { id: 's', do: [{ op: 'search', from: 'deck', filter: { cardId: 'fx_g4' }, to: 'hand' }] }, ctxOf(null));
  assert.strictEqual(st.players[0].hand.length, 0);
  assert.strictEqual(st.players[0].deck.length, 4);
});

T('specialSummon: ลงช่องว่างแรกจากมือ ไม่แตะโควตาลงปกติ', () => {
  const st = mkMove(), ev = [];
  put(st, 0, 0, 'fx_l1a');
  st.players[0].hand.push(inst(st, 0, 'fx_l3a'));
  FX.run(st, ev, { id: 'ss', do: [{ op: 'specialSummon', from: ['hand'], filter: { cardId: 'fx_l3a' }, count: 1 }] }, ctxOf(null));
  assert.strictEqual(st.players[0].monsters[1].cardId, 'fx_l3a');
  assert.strictEqual(st.players[0].hand.length, 0);
  assert.deepStrictEqual(st.players[0].flags, {});            // ไม่มีธง/ตัวนับโควตาถูกแตะ
  assert.ok(ev.some(e => e.type === 'summon' && e.how === 'special'));
});

T('specialSummon: ช่องเต็มเรียกไม่ได้ การ์ดยังอยู่ที่ต้นทาง', () => {
  const st = mkMove(), ev = [];
  for (let s = 0; s < 5; s++) put(st, 0, s, 'fx_l1a');
  st.players[0].hand.push(inst(st, 0, 'fx_l2a'));
  FX.run(st, ev, { id: 'ss', do: [{ op: 'specialSummon', from: ['hand'], count: 1 }] }, ctxOf(null));
  assert.strictEqual(st.players[0].hand.length, 1);
  assert.ok(!ev.some(e => e.type === 'summon'));
});

T('specialSummon: slot ที่ระบุมีของอยู่แล้ว = เรียกไม่ได้', () => {
  const st = mkMove();
  put(st, 0, 2, 'fx_l1a');
  st.players[0].hand.push(inst(st, 0, 'fx_l2a'));
  FX.run(st, [], { id: 'ss', do: [{ op: 'specialSummon', from: ['hand'], slot: 2 }] }, ctxOf(null));
  assert.strictEqual(st.players[0].hand.length, 1);
  assert.strictEqual(st.players[0].monsters[2].cardId, 'fx_l1a');
});

T('specialSummon: หลายตัวจากหลายโซน หยุดเมื่อช่องหมด', () => {
  const st = mkMove();
  for (let s = 0; s < 3; s++) put(st, 0, s, 'fx_l1a');          // เหลือช่องว่าง 2 ช่อง
  st.players[0].hand.push(inst(st, 0, 'fx_l1b'));
  st.players[0].deck.length = 0;
  st.players[0].deck.push(inst(st, 0, 'fx_l1b'), inst(st, 0, 'fx_l1b'));
  FX.run(st, [], { id: 'ss', do: [{ op: 'specialSummon', from: ['hand', 'deck'], filter: { cardId: 'fx_l1b' }, count: 3 }] }, ctxOf(null));
  assert.deepStrictEqual(st.players[0].monsters.map(m => m && m.cardId), ['fx_l1a', 'fx_l1a', 'fx_l1a', 'fx_l1b', 'fx_l1b']);
  assert.strictEqual(st.players[0].hand.length, 0);
  assert.strictEqual(st.players[0].deck.length, 1);
});

T('returnToHand: มอนสเตอร์บนสนามกลับมือเจ้าของ ค่าที่บวกไว้ถูกล้าง ตัวซ้อนใต้ไปด้วย', () => {
  const st = mkMove(), ev = [];
  const m = put(st, 1, 0, 'fx_l1a'); m.atkMod = 700; m.under.push(inst(st, 1, 'fx_l1b'));
  FX.run(st, ev, { id: 'r', do: [{ op: 'returnToHand', target: { side: 'opp', zone: 'monster' } }] }, ctxOf(null));
  assert.strictEqual(st.players[1].monsters[0], null);
  assert.deepStrictEqual(st.players[1].hand.map(c => c.cardId), ['fx_l1a', 'fx_l1b']);
  assert.strictEqual(st.players[1].hand[0].atkMod, 0);
  assert.deepStrictEqual(st.players[1].hand[0].under, []);
  assert.ok(ev.some(e => e.type === 'moveCard' && e.from === 'monster' && e.to === 'hand'));
});

T('returnToDeck: self กลับเด็คเจ้าของ (ค่าเริ่มต้นใต้เด็ค, position:top = บนสุด)', () => {
  const st = mkMove();
  const a = put(st, 0, 0, 'fx_l2a'), b = put(st, 0, 1, 'fx_l2b');
  FX.run(st, [], { id: 'rd', do: [{ op: 'returnToDeck', target: 'self' }] }, ctxOf(a));
  const d = st.players[0].deck;
  assert.strictEqual(d[d.length - 1].cardId, 'fx_l2a');
  FX.run(st, [], { id: 'rd', do: [{ op: 'returnToDeck', target: 'self', position: 'top' }] }, ctxOf(b));
  assert.strictEqual(st.players[0].deck[0].cardId, 'fx_l2b');
  assert.strictEqual(st.players[0].monsters[0], null);
});

T('banish: ย้ายจากสนามและสุสานไป removed', () => {
  const st = mkMove(), ev = [];
  put(st, 0, 0, 'fx_l1a');
  st.players[1].grave.push(inst(st, 1, 'fx_l3a'));
  FX.run(st, ev, { id: 'b', do: [{ op: 'banish', target: { side: 'self', zone: 'monster' } }, { op: 'banish', target: { side: 'opp', zone: 'grave' } }] }, ctxOf(null));
  assert.deepStrictEqual(st.players[0].removed.map(c => c.cardId), ['fx_l1a']);
  assert.deepStrictEqual(st.players[1].removed.map(c => c.cardId), ['fx_l3a']);
  assert.strictEqual(st.players[1].grave.length, 0);
  assert.strictEqual(st.players[0].monsters[0], null);
});

module.exports = tests;
