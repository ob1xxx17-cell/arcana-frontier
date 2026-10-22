// tests/engine.test.js - เทสต์ engine ขั้น 2
// รหัสเทสต์ V<ข้อ>-<ลำดับ> อ้างเช็กลิสต์ 14 ข้อของ HANDOFF ข้อ 7 (ขั้น 2 ครอบคลุมข้อ 1-9 และ 14)
//   ข้อ 10-13 (สเปล/Chain/อาควิลา/บอท) เป็นของขั้น 4-7 ส่วนรหัส E-* คือเทสต์เสริมของ engine (อัญเชิญเพิ่มเติม, หน้าต่างตอบโต้, จังหวะเทิร์น, จบเกมด้วย LP, ความถูกต้องของ API)
//
require('./fixtures');
const fs = require('fs');
const path = require('path');
const E = () => CG.engine;
const G = o => CG.test.makeGame(o);
const A = (s, a) => E().applyAction(s, a);
const snap = s => { const { rng, ...r } = s; return JSON.stringify(r) + '|' + rng.s; };
const T = [];
const t = (name, run) => T.push({ name, run });

function okA(assert, s, a) { const r = A(s, a); assert.ok(r.ok, `ควรสำเร็จ ${JSON.stringify(a)} แต่ได้ ${r.error}`); return r; }
function rej(assert, s, a, code) {
  const before = snap(s), logN = s.log.length;
  const r = A(s, a);
  assert.strictEqual(r.ok, false, `ควรถูกปฏิเสธ ${JSON.stringify(a)}`);
  assert.strictEqual(r.error, code);
  assert.deepStrictEqual(r.events, [{ type: 'rejected', code }]);
  assert.strictEqual(snap(s), before, 'state ต้องไม่เปลี่ยนเมื่อถูกปฏิเสธ');
  assert.strictEqual(s.log.length, logN);
}
const mon = (s, p, slot) => s.players[p].monsters[slot];
const ids = arr => arr.map(c => c.cardId);

// ================= V1 อัญเชิญ =================
t('V3-01 อัญเชิญปกติ Lv1 ลงช่อง ใช้สิทธิ์ปกติ', assert => {
  const s = G({ p0: { hand: ['fx_l1a', 'fx_l2a'] } });
  const r = okA(assert, s, { type: 'normalSummon', player: 0, handIdx: 0, slot: 2 });
  assert.strictEqual(mon(s, 0, 2).cardId, 'fx_l1a');
  assert.strictEqual(mon(s, 0, 2).faceDown, false);
  assert.strictEqual(mon(s, 0, 2).position, 'atk');
  assert.deepStrictEqual(ids(s.players[0].hand), ['fx_l2a']);
  assert.ok(s.players[0].flags.normalSummonUsed);
  assert.ok(r.events.some(e => e.type === 'summon' && e.how === 'normal' && e.slot === 2));
  assert.ok(r.events.some(e => e.type === 'moveCard' && e.from === 'hand' && e.to === 'monster'));
  assert.strictEqual(s.log.length, r.events.length);
});
t('V3-02 อัญเชิญปกติซ้ำในเทิร์นเดียวไม่ได้ (รวม Set)', assert => {
  const s = G({ p0: { hand: ['fx_l1a', 'fx_l1b', 'fx_l1c'] } });
  okA(assert, s, { type: 'normalSummon', player: 0, handIdx: 0, slot: 0 });
  rej(assert, s, { type: 'normalSummon', player: 0, handIdx: 0, slot: 1 }, 'NORMAL_SUMMON_USED');
  rej(assert, s, { type: 'setMonster', player: 0, handIdx: 0, slot: 1 }, 'NORMAL_SUMMON_USED');
});
t('V3-03 เสียสละ Lv2 หลังลง Lv1 (โควตาปกติกับเสียสละแยกกัน)', assert => {
  const s = G({ p0: { hand: ['fx_l1b', 'fx_l2a'], monsters: { 0: 'fx_l1a' } } });
  okA(assert, s, { type: 'normalSummon', player: 0, handIdx: 0, slot: 1 });
  const r = okA(assert, s, { type: 'tributeSummon', player: 0, handIdx: 0, materials: [0, 1], slot: 2 });
  assert.strictEqual(mon(s, 0, 2).cardId, 'fx_l2a');
  assert.strictEqual(mon(s, 0, 0), null); assert.strictEqual(mon(s, 0, 1), null);
  assert.deepStrictEqual(ids(s.players[0].grave).sort(), ['fx_l1a', 'fx_l1b']);
  assert.ok(s.players[0].flags.tributeSummonUsed && s.players[0].flags.normalSummonUsed);
  assert.ok(r.events.some(e => e.type === 'summon' && e.how === 'tribute'));
  assert.ok(!r.events.some(e => e.type === 'destroy'), 'เสียสละไม่ใช่การทำลาย');
});
t('V4-01 วัสดุ Level เท่ากับตัวที่เรียกไม่ได้ (MATERIAL_LEVEL_EQUAL)', assert => {
  const s = G({ p0: { hand: ['fx_l2a', 'fx_l3a'], monsters: { 0: 'fx_l2b', 1: 'fx_l3b' } } });
  rej(assert, s, { type: 'tributeSummon', player: 0, handIdx: 0, materials: [0], slot: 0 }, 'MATERIAL_LEVEL_EQUAL');
  rej(assert, s, { type: 'tributeSummon', player: 0, handIdx: 1, materials: [1], slot: 1 }, 'MATERIAL_LEVEL_EQUAL');
});
t('V4-02 ผลรวม Level วัสดุต้องเท่ากับตัวที่เรียก (MATERIAL_LEVEL_SUM)', assert => {
  const s = G({ p0: { hand: ['fx_l2a', 'fx_l3a'], monsters: { 0: 'fx_l1a', 1: 'fx_l2b', 3: 'fx_l1b' } } });
  rej(assert, s, { type: 'tributeSummon', player: 0, handIdx: 0, materials: [0], slot: 0 }, 'MATERIAL_LEVEL_SUM'); // Lv2 ใช้ Lv1 ตัวเดียวไม่พอ
  rej(assert, s, { type: 'tributeSummon', player: 0, handIdx: 1, materials: [1, 1], slot: 0 }, 'MATERIAL_INVALID');
  rej(assert, s, { type: 'tributeSummon', player: 0, handIdx: 1, materials: [0, 3], slot: 0 }, 'MATERIAL_LEVEL_SUM'); // Lv1+Lv1 = 2 ไม่พอ Lv3
});
t('V3-04 Lv3 = Lv1+Lv2 สำเร็จ', assert => {
  const s = G({ p0: { hand: ['fx_l3a'], monsters: { 0: 'fx_l1a', 1: 'fx_l2b' } } });
  okA(assert, s, { type: 'tributeSummon', player: 0, handIdx: 0, materials: [0, 1], slot: 2 });
  assert.strictEqual(mon(s, 0, 2).cardId, 'fx_l3a');
});
t('V3-05 Lv3 = Lv1×3 สำเร็จ', assert => {
  const s = G({ p0: { hand: ['fx_l3a'], monsters: { 0: 'fx_l1a', 1: 'fx_l1b', 4: 'fx_l1c' } } });
  okA(assert, s, { type: 'tributeSummon', player: 0, handIdx: 0, materials: [0, 1, 4], slot: 2 });
  assert.strictEqual(s.players[0].grave.length, 3);
});
t('V3-06 เสียสละได้ 1 ครั้ง/เทิร์น แต่ลงปกติหลังเสียสละได้', assert => {
  const s = G({ p0: { hand: ['fx_l2a', 'fx_l2b', 'fx_l1c'], monsters: { 0: 'fx_l1a', 1: 'fx_l1b', 3: 'fx_l1a', 4: 'fx_l1b' } } });
  okA(assert, s, { type: 'tributeSummon', player: 0, handIdx: 0, materials: [0, 1], slot: 0 });
  rej(assert, s, { type: 'tributeSummon', player: 0, handIdx: 0, materials: [3, 4], slot: 1 }, 'TRIBUTE_SUMMON_USED');
  okA(assert, s, { type: 'normalSummon', player: 0, handIdx: 1, slot: 1 });
});
t('V6-02 ช่องเสียสละ: ใช้ช่องวัสดุได้ ช่องของตัวอื่นไม่ได้ (SLOT_FULL)', assert => {
  const s = G({ p0: { hand: ['fx_l2a'], monsters: { 0: 'fx_l1a', 1: 'fx_l1b', 2: 'fx_l1c' } } });
  rej(assert, s, { type: 'tributeSummon', player: 0, handIdx: 0, materials: [0, 1], slot: 2 }, 'SLOT_FULL');
  okA(assert, s, { type: 'tributeSummon', player: 0, handIdx: 0, materials: [0, 1], slot: 1 });
  assert.strictEqual(mon(s, 0, 1).cardId, 'fx_l2a');
});
t('V5-01 Set: คว่ำท่าป้องกัน ใช้สิทธิ์ปกติ เฉพาะ Lv1', assert => {
  const s = G({ p0: { hand: ['fx_l1a', 'fx_l2a'] } });
  rej(assert, s, { type: 'setMonster', player: 0, handIdx: 1, slot: 0 }, 'LEVEL_NOT_1');
  const r = okA(assert, s, { type: 'setMonster', player: 0, handIdx: 0, slot: 0 });
  const m = mon(s, 0, 0);
  assert.ok(m.faceDown && m.position === 'def');
  assert.ok(s.players[0].flags.normalSummonUsed);
  assert.ok(r.events.some(e => e.type === 'summon' && e.how === 'set'));
});
t('V5-02 Flip Summon: ต้องคว่ำมาก่อนเทิร์นนี้ → หงายท่าโจมตี', assert => {
  const s = G({ p0: { hand: ['fx_l1a'], monsters: { 1: { cardId: 'fx_l1b', faceDown: true, setTurn: 1 } } } });
  okA(assert, s, { type: 'setMonster', player: 0, handIdx: 0, slot: 0 });
  rej(assert, s, { type: 'flipSummon', player: 0, slot: 0 }, 'SET_THIS_TURN');
  rej(assert, s, { type: 'flipSummon', player: 0, slot: 2 }, 'NO_MONSTER');
  const r = okA(assert, s, { type: 'flipSummon', player: 0, slot: 1 });
  assert.ok(!mon(s, 0, 1).faceDown && mon(s, 0, 1).position === 'atk');
  assert.ok(r.events.some(e => e.type === 'summon' && e.how === 'flip'));
  assert.ok(r.events.some(e => e.type === 'positionChange' && e.position === 'atk'));
  assert.strictEqual(s.players[0].flags.normalSummonUsed, true, 'Flip ไม่ใช้/คืนโควตา (ยังเป็นผลจาก Set)');
  rej(assert, s, { type: 'flipSummon', player: 0, slot: 1 }, 'NOT_FACE_DOWN');
});
t('V5-03 Flip Summon ไม่ใช้โควตาลงปกติ/เสียสละ', assert => {
  const s = G({ p0: { hand: ['fx_l1a'], monsters: { 1: { cardId: 'fx_l1b', faceDown: true, setTurn: 1 } } } });
  okA(assert, s, { type: 'flipSummon', player: 0, slot: 1 });
  assert.ok(!s.players[0].flags.normalSummonUsed && !s.players[0].flags.tributeSummonUsed);
  okA(assert, s, { type: 'normalSummon', player: 0, handIdx: 0, slot: 0 });
});
t('V6-01 ช่องมอนสเตอร์เต็ม 5 ลงเพิ่มไม่ได้ / ช่องไม่ถูกต้อง', assert => {
  const full = { 0: 'fx_l1a', 1: 'fx_l1a', 2: 'fx_l1a', 3: 'fx_l1a', 4: 'fx_l1a' };
  const s = G({ p0: { hand: ['fx_l1b'], monsters: full } });
  rej(assert, s, { type: 'normalSummon', player: 0, handIdx: 0, slot: 2 }, 'SLOT_FULL');
  rej(assert, s, { type: 'normalSummon', player: 0, handIdx: 0, slot: 9 }, 'INVALID_SLOT');
  rej(assert, s, { type: 'normalSummon', player: 0, handIdx: 3, slot: 0 }, 'INVALID_HAND_INDEX');
  assert.strictEqual(E().getLegalActions(s, 0).filter(a => a.type === 'normalSummon').length, 0);
});
t('E-SUMMON-01 ชนิดการ์ด/Level ผิด: Lv2 ลงปกติไม่ได้ สเปลไม่ใช่มอนสเตอร์', assert => {
  const s = G({ p0: { hand: ['fx_l2a', 'fx_spell', 'fx_l1a'], monsters: { 0: 'fx_l1b' } } });
  rej(assert, s, { type: 'normalSummon', player: 0, handIdx: 0, slot: 1 }, 'LEVEL_NOT_1');
  rej(assert, s, { type: 'normalSummon', player: 0, handIdx: 1, slot: 1 }, 'NOT_A_MONSTER');
  rej(assert, s, { type: 'tributeSummon', player: 0, handIdx: 2, materials: [0], slot: 0 }, 'LEVEL_NOT_TRIBUTE');
  rej(assert, s, { type: 'tributeSummon', player: 0, handIdx: 1, materials: [0], slot: 0 }, 'NOT_A_MONSTER');
});
t('E-SUMMON-02 อัญเชิญได้เฉพาะ Main Phase ของเทิร์นตัวเอง', assert => {
  const s = G({ phase: 'battle', p0: { hand: ['fx_l1a'] }, p1: { hand: ['fx_l1a'] } });
  rej(assert, s, { type: 'normalSummon', player: 0, handIdx: 0, slot: 0 }, 'WRONG_PHASE');
  rej(assert, s, { type: 'normalSummon', player: 1, handIdx: 0, slot: 0 }, 'NOT_YOUR_TURN');
  const s2 = G({ phase: 'main2', p0: { hand: ['fx_l1a'] } });
  okA(assert, s2, { type: 'normalSummon', player: 0, handIdx: 0, slot: 0 });
});
t('E-SUMMON-03 Special Summon (ตัวช่วยสำหรับขั้น 4-6): ไม่ใช้โควตา ช่องเต็มไม่ได้ Grade 4 1 ครั้ง/เทิร์น', assert => {
  const s = G({ p0: { hand: ['fx_l1a'], extra: ['fx_g4', 'fx_g4', 'fx_fusion'], monsters: { 0: 'fx_l1b', 1: 'fx_l1b', 2: 'fx_l1b', 3: 'fx_l1b' } } });
  const p = s.players[0], ev = [];
  assert.strictEqual(E().specialSummon(s, ev, 0, p.hand[0], 4, 'hand'), null);
  assert.ok(ev.some(e => e.type === 'summon' && e.how === 'special'));
  assert.ok(!p.flags.normalSummonUsed && !p.flags.tributeSummonUsed);
  assert.strictEqual(E().specialSummon(s, ev, 0, p.extra[2], 0, 'extra'), 'SLOT_FULL');
  p.monsters[3] = null;
  assert.strictEqual(E().specialSummon(s, ev, 0, p.extra[0], 3, 'extra'), null);
  p.monsters[1] = null;
  const before = snap(s);
  assert.strictEqual(E().specialSummon(s, ev, 0, p.extra[0], 1, 'extra'), 'GRADE4_LIMIT');
  assert.strictEqual(snap(s), before);
});
t('E-SUMMON-04 getLegalActions ตรงกับ applyAction (ลง/Set/เสียสละ/Flip)', assert => {
  const s = G({ p0: { hand: ['fx_l1a', 'fx_l2a'], monsters: { 0: 'fx_l1b', 1: 'fx_l1c', 2: { cardId: 'fx_l1a', faceDown: true, setTurn: 1 } } } });
  const acts = E().getLegalActions(s, 0);
  const has = f => acts.some(f);
  assert.ok(has(a => a.type === 'normalSummon' && a.handIdx === 0 && a.slot === 3));
  assert.ok(!has(a => a.type === 'normalSummon' && a.handIdx === 1), 'Lv2 ลงปกติไม่ได้');
  assert.ok(has(a => a.type === 'tributeSummon' && a.handIdx === 1 && a.materials.join() === '0,1' && a.slot === 0));
  assert.ok(!has(a => a.type === 'tributeSummon' && a.materials.length === 1));
  assert.ok(has(a => a.type === 'flipSummon' && a.slot === 2));
  assert.ok(has(a => a.type === 'advancePhase') && has(a => a.type === 'endTurn'));
  for (const a of acts) assert.ok(E().applyAction(E().cloneState(s), a).ok, JSON.stringify(a));
  assert.deepStrictEqual(E().getLegalActions(s, 1), []);
});

// ================= V2 เปลี่ยนท่า =================
t('V5-04 เปลี่ยนท่า โจมตี ⇄ ป้องกัน (1 ครั้ง/ตัว/เทิร์น)', assert => {
  const s = G({ p0: { monsters: { 0: 'fx_l1a' } } });
  const r = okA(assert, s, { type: 'changePosition', player: 0, slot: 0 });
  assert.strictEqual(mon(s, 0, 0).position, 'def');
  assert.ok(r.events.some(e => e.type === 'positionChange' && e.position === 'def' && e.faceDown === false));
  rej(assert, s, { type: 'changePosition', player: 0, slot: 0 }, 'POSITION_ALREADY_CHANGED');
});
t('V5-05 เทิร์นที่ลงสนามเปลี่ยนท่าไม่ได้', assert => {
  const s = G({ p0: { hand: ['fx_l1a'] } });
  okA(assert, s, { type: 'normalSummon', player: 0, handIdx: 0, slot: 0 });
  rej(assert, s, { type: 'changePosition', player: 0, slot: 0 }, 'SUMMONED_THIS_TURN');
});
t('V5-06 ตัวคว่ำเปลี่ยนท่าตรง ๆ ไม่ได้ ต้อง Flip Summon', assert => {
  const s = G({ p0: { monsters: { 0: { cardId: 'fx_l1a', faceDown: true, setTurn: 1 } } } });
  rej(assert, s, { type: 'changePosition', player: 0, slot: 0 }, 'USE_FLIP_SUMMON');
});
t('V5-07 Flip แล้วเปลี่ยนท่าต่อในเทิร์นเดียวกันไม่ได้', assert => {
  const s = G({ p0: { monsters: { 0: { cardId: 'fx_l1a', faceDown: true, setTurn: 1 } } } });
  okA(assert, s, { type: 'flipSummon', player: 0, slot: 0 });
  rej(assert, s, { type: 'changePosition', player: 0, slot: 0 }, 'POSITION_ALREADY_CHANGED');
});
t('V5-08 ช่องว่าง/ช่องผิด/เฟสผิด/ไม่ใช่เทิร์นตัวเอง', assert => {
  const s = G({ p0: { monsters: { 0: 'fx_l1a' } }, p1: { monsters: { 0: 'fx_l1a' } } });
  rej(assert, s, { type: 'changePosition', player: 0, slot: 1 }, 'NO_MONSTER');
  rej(assert, s, { type: 'changePosition', player: 0, slot: 7 }, 'INVALID_SLOT');
  rej(assert, s, { type: 'changePosition', player: 1, slot: 0 }, 'NOT_YOUR_TURN');
  const b = G({ phase: 'battle', p0: { monsters: { 0: 'fx_l1a' } } });
  rej(assert, b, { type: 'changePosition', player: 0, slot: 0 }, 'WRONG_PHASE');
  const m2 = G({ phase: 'main2', p0: { monsters: { 0: 'fx_l1a' } } });
  okA(assert, m2, { type: 'changePosition', player: 0, slot: 0 });
});
t('V5-09 ข้ามเทิร์นแล้วเปลี่ยนท่าได้อีก (flag รีเซ็ต)', assert => {
  const s = G({ p0: { monsters: { 0: 'fx_l1a' } }, p1: { deck: ['fx_l1a', 'fx_l1b'] } });
  okA(assert, s, { type: 'changePosition', player: 0, slot: 0 });
  okA(assert, s, { type: 'endTurn', player: 0 });
  okA(assert, s, { type: 'endTurn', player: 1 });
  assert.strictEqual(s.activeIdx, 0);
  okA(assert, s, { type: 'changePosition', player: 0, slot: 0 });
  assert.strictEqual(mon(s, 0, 0).position, 'atk');
});

// ================= V3 ต่อสู้ตามตารางข้อ 1 =================
const duel = (a, d, o) => G(Object.assign({ phase: 'battle', p0: { monsters: { 2: a } }, p1: { monsters: { 1: d } } }, o || {}));
const hit = (assert, s) => okA(assert, s, { type: 'attack', player: 0, from: 2, to: 1 });
t('V7-01 ATK>ATK: เป้าตาย เสีย LP เท่าส่วนต่าง ผู้โจมตีรอด', assert => {
  const s = duel('fx_l2a', 'fx_l1a'); const r = hit(assert, s);
  assert.strictEqual(mon(s, 1, 1), null); assert.ok(mon(s, 0, 2));
  assert.strictEqual(s.players[1].lp, 8000 - 600); assert.strictEqual(s.players[0].lp, 8000);
  assert.deepStrictEqual(ids(s.players[1].grave), ['fx_l1a']);
  assert.ok(r.events.some(e => e.type === 'destroy' && e.by === 'battle'));
  assert.ok(r.events.some(e => e.type === 'lpChange' && e.player === 1 && e.delta === -600 && e.reason === 'battle'));
  assert.ok(r.events.some(e => e.type === 'attackDeclared' && e.from === 2 && e.to === 1));
});
t('V7-02 ATK<ATK: ผู้โจมตีตาย เสีย LP เท่าส่วนต่าง', assert => {
  const s = duel('fx_l1a', 'fx_l2a'); hit(assert, s);
  assert.strictEqual(mon(s, 0, 2), null); assert.ok(mon(s, 1, 1));
  assert.strictEqual(s.players[0].lp, 8000 - 600); assert.strictEqual(s.players[1].lp, 8000);
  assert.deepStrictEqual(ids(s.players[0].grave), ['fx_l1a']);
});
t('V7-03 ATK=ATK: ผู้โจมตีทำลายเป้า ไม่เสีย LP', assert => {
  const s = duel('fx_l3a', 'fx_l3b'); hit(assert, s);
  assert.strictEqual(mon(s, 1, 1), null); assert.ok(mon(s, 0, 2));
  assert.strictEqual(s.players[0].lp, 8000); assert.strictEqual(s.players[1].lp, 8000);
});
t('V7-04 ATK>DEF (หงาย): เป้าตาย ไม่เสีย LP', assert => {
  const s = duel('fx_l3a', { cardId: 'fx_l1a', position: 'def' }); hit(assert, s);
  assert.strictEqual(mon(s, 1, 1), null);
  assert.strictEqual(s.players[1].lp, 8000); assert.strictEqual(s.players[0].lp, 8000);
});
t('V7-05 ATK=DEF: ไม่มีอะไรเกิดขึ้น', assert => {
  const s = duel('fx_l2b', { cardId: 'fx_l2b', position: 'def' }); hit(assert, s);
  assert.ok(mon(s, 0, 2) && mon(s, 1, 1));
  assert.strictEqual(s.players[0].lp, 8000); assert.strictEqual(s.players[1].lp, 8000);
});
t('V7-06 ATK<DEF: ผู้โจมตีเสีย LP เท่าส่วนต่าง ไม่มีใครตาย', assert => {
  const s = duel('fx_l1a', { cardId: 'fx_l2b', position: 'def' }); hit(assert, s);
  assert.ok(mon(s, 0, 2) && mon(s, 1, 1));
  assert.strictEqual(s.players[0].lp, 8000 - 500); assert.strictEqual(s.players[1].lp, 8000);
});
t('V7-07 ป้องกันคว่ำ: พลิกหงายก่อนคำนวณ แล้วตายถ้า ATK>DEF', assert => {
  const s = duel('fx_l2a', { cardId: 'fx_l1b', faceDown: true, setTurn: 1 }); const r = hit(assert, s);
  assert.strictEqual(mon(s, 1, 1), null); assert.strictEqual(s.players[1].lp, 8000);
  const i = r.events.findIndex(e => e.type === 'positionChange' && e.faceDown === false);
  const j = r.events.findIndex(e => e.type === 'destroy');
  assert.ok(i >= 0 && j > i, 'ต้องพลิกก่อนทำลาย');
});
t('V7-08 ป้องกันคว่ำ ATK<DEF: พลิกหงายค้างอยู่ ผู้โจมตีเสีย LP', assert => {
  const s = duel('fx_l1a', { cardId: 'fx_l1b', faceDown: true, setTurn: 1 }); hit(assert, s);
  const m = mon(s, 1, 1);
  assert.ok(m && !m.faceDown && m.position === 'def');
  assert.strictEqual(s.players[0].lp, 8000 - 200);
});
t('V7-09 คำนวณจาก ATK/DEF จริง (รวมตัวปรับถาวร/ชั่วคราว)', assert => {
  const s = duel({ cardId: 'fx_l1a', atkMod: 700 }, { cardId: 'fx_l2a' });   // 1700 vs 1600
  mon(s, 1, 1).tempAtkMod = 100;                                            // 1700 vs 1700 เท่ากัน
  hit(assert, s);
  assert.strictEqual(mon(s, 1, 1), null); assert.strictEqual(s.players[1].lp, 8000);
});
t('V7-10 ทำลายมอนสเตอร์ที่มีวางทับ: ตัวใต้ถูกทำลายด้วย (overlayDestroyTogether)', assert => {
  const s = duel('fx_l3a', { cardId: 'fx_l2a', under: ['fx_l1a', 'fx_l1b'] });
  const r = hit(assert, s);
  assert.strictEqual(mon(s, 1, 1), null);
  assert.deepStrictEqual(ids(s.players[1].grave).sort(), ['fx_l1a', 'fx_l1b', 'fx_l2a']);
  assert.strictEqual(r.events.filter(e => e.type === 'destroy').length, 3);
});
t('V7-11 Grade 4 ถูกทำลายในต่อสู้ → กลับ Extra Deck ไม่ลงสุสาน', assert => {
  const s = duel('fx_l3a', { cardId: 'fx_g4', position: 'def' }, { p1: { extra: [], monsters: { 1: { cardId: 'fx_g4', position: 'def' } } } });
  s.players[0].monsters[2].atkMod = 1000;                                     // 3400 > DEF 2500
  hit(assert, s);
  assert.strictEqual(mon(s, 1, 1), null);
  assert.deepStrictEqual(ids(s.players[1].extra), ['fx_g4']); assert.strictEqual(s.players[1].grave.length, 0);
});
t('V7-12 โจมตีเสร็จ: battleStep/attack ถูกเคลียร์ ใช้สิทธิ์โจมตีแล้ว', assert => {
  const s = duel('fx_l2a', 'fx_l1a'); hit(assert, s);
  assert.strictEqual(s.battleStep, null); assert.strictEqual(s.attack, null); assert.strictEqual(s.pending, null);
  assert.ok(mon(s, 0, 2).flags.attackedThisTurn);
  rej(assert, s, { type: 'attack', player: 0, from: 2, to: null }, 'ALREADY_ATTACKED');
});
t('E-BATTLE-01 หน้าต่างตอบโต้: เปิดที่ declare → battleStep → damageStep ข้ามอัตโนมัติถ้าไม่มี hook', assert => {
  const seen = [];
  E().hooks.priorityWindow = (st, ev, ctx) => { seen.push(ctx.kind + ':' + (ctx.step || '')); return false; };
  try {
    const s = duel('fx_l2a', 'fx_l1a'); hit(assert, s);
    assert.deepStrictEqual(seen, ['battle:declare', 'battle:battleStep', 'battle:damageStep']);
    assert.strictEqual(s.players[1].lp, 7400);
  } finally { delete E().hooks.priorityWindow; }
});
t('E-BATTLE-02 หน้าต่างตอบโต้เปิด pending ได้ แล้วเดินต่อด้วย battleResume (จุดต่อขั้น 5)', assert => {
  let opened = false;
  E().hooks.priorityWindow = (st, ev, ctx) => {
    if (ctx.kind === 'battle' && ctx.step === 'battleStep' && !opened) {
      opened = true;
      st.pending = { kind: 'chainWindow', player: 1, prompt: 'CHAIN_WINDOW', options: ['pass'], min: 1, max: 1 };
      return true;
    }
    return false;
  };
  E().pendingHandlers.chainWindow = (st, a, ev) => { st.pending = null; E().battleResume(st, ev); return null; };
  try {
    const s = duel('fx_l2a', 'fx_l1a'); hit(assert, s);
    assert.strictEqual(s.battleStep, 'battleStep'); assert.ok(s.pending);
    assert.strictEqual(s.players[1].lp, 8000, 'ยังไม่คำนวณระหว่างรอ');
    rej(assert, s, { type: 'advancePhase', player: 0 }, 'PENDING_UNRESOLVED');
    rej(assert, s, { type: 'respond', player: 0, choice: 'pass' }, 'NOT_YOUR_TURN');
    assert.deepStrictEqual(E().getLegalActions(s, 0), []);
    assert.ok(E().getLegalActions(s, 1).length > 0);
    okA(assert, s, { type: 'respond', player: 1, choice: 'pass' });
    assert.strictEqual(s.players[1].lp, 7400); assert.strictEqual(s.battleStep, null);
  } finally { delete E().hooks.priorityWindow; delete E().pendingHandlers.chainWindow; }
});
t('E-BATTLE-03 ผู้โจมตีหายไปในหน้าต่างตอบโต้ → ยกเลิกการโจมตี ไม่คำนวณ', assert => {
  E().hooks.priorityWindow = (st, ev, ctx) => {
    if (ctx.step === 'declare') E().leaveField(st, ev, 0, 2, 'grave');
    return false;
  };
  try {
    const s = duel('fx_l2a', 'fx_l1a'); hit(assert, s);
    assert.strictEqual(s.players[1].lp, 8000); assert.ok(mon(s, 1, 1)); assert.strictEqual(s.battleStep, null);
  } finally { delete E().hooks.priorityWindow; }
});

// ================= V4 เงื่อนไขโจมตี / โจมตีตรง =================
t('V7-13 โจมตีตรงเมื่อฝ่ายตรงข้ามไม่มีมอนสเตอร์ เสีย LP เท่า ATK', assert => {
  const s = G({ phase: 'battle', p0: { monsters: { 2: 'fx_l3a' } } });
  okA(assert, s, { type: 'attack', player: 0, from: 2, to: null });
  assert.strictEqual(s.players[1].lp, 8000 - 2400);
});
t('V7-14 มีมอนสเตอร์ฝ่ายตรงข้ามต้องโจมตีมอนสเตอร์ ตรงไม่ได้ (MUST_ATTACK_MONSTER)', assert => {
  const s = duel('fx_l3a', 'fx_l1a');
  rej(assert, s, { type: 'attack', player: 0, from: 2, to: null }, 'MUST_ATTACK_MONSTER');
  rej(assert, s, { type: 'attack', player: 0, from: 2, to: 3 }, 'INVALID_TARGET');
  rej(assert, s, { type: 'attack', player: 0, from: 2, to: 9 }, 'INVALID_TARGET');
  rej(assert, s, { type: 'attack', player: 0, from: 2 }, 'INVALID_TARGET');
});
t('V2-01 เทิร์นแรกของเกมโจมตีไม่ได้ (firstTurnNoAttack) เทิร์น 2 ได้', assert => {
  const s = G({ turn: 1, phase: 'battle', p0: { monsters: { 2: 'fx_l3a' } } });
  rej(assert, s, { type: 'attack', player: 0, from: 2, to: null }, 'FIRST_TURN_NO_ATTACK');
  assert.strictEqual(E().getLegalActions(s, 0).filter(a => a.type === 'attack').length, 0);
  const s2 = G({ turn: 1, phase: 'battle', config: { firstTurnNoAttack: false }, p0: { monsters: { 2: 'fx_l3a' } } });
  okA(assert, s2, { type: 'attack', player: 0, from: 2, to: null });
  const s3 = G({ turn: 2, phase: 'battle', p1: { monsters: { 2: 'fx_l3a' } } });
  okA(assert, s3, { type: 'attack', player: 1, from: 2, to: null });
});
t('V7-15 ท่าป้องกัน/คว่ำ/ไม่มีมอนสเตอร์/ไม่ใช่เฟสต่อสู้/ไม่ใช่เทิร์นตัวเอง โจมตีไม่ได้', assert => {
  const s = G({ phase: 'battle', p0: { monsters: { 0: { cardId: 'fx_l1a', position: 'def' }, 1: { cardId: 'fx_l1a', faceDown: true } } } });
  rej(assert, s, { type: 'attack', player: 0, from: 0, to: null }, 'NOT_ATTACK_POSITION');
  rej(assert, s, { type: 'attack', player: 0, from: 1, to: null }, 'NOT_ATTACK_POSITION');
  rej(assert, s, { type: 'attack', player: 0, from: 3, to: null }, 'NO_MONSTER');
  rej(assert, s, { type: 'attack', player: 0, from: 8, to: null }, 'INVALID_SLOT');
  rej(assert, s, { type: 'attack', player: 1, from: 0, to: null }, 'NOT_YOUR_TURN');
  const m = G({ phase: 'main1', p0: { monsters: { 0: 'fx_l1a' } } });
  rej(assert, m, { type: 'attack', player: 0, from: 0, to: null }, 'WRONG_PHASE');
});
t('V7-16 มอนสเตอร์ที่เพิ่งลงเทิร์นนี้โจมตีได้ / เปลี่ยนจากป้องกันเป็นโจมตีแล้วโจมตีได้', assert => {
  const s = G({ p0: { hand: ['fx_l1a'], monsters: { 1: { cardId: 'fx_l1b', position: 'def' } } } });
  okA(assert, s, { type: 'normalSummon', player: 0, handIdx: 0, slot: 0 });
  okA(assert, s, { type: 'changePosition', player: 0, slot: 1 });
  okA(assert, s, { type: 'advancePhase', player: 0 });
  okA(assert, s, { type: 'attack', player: 0, from: 0, to: null });
  okA(assert, s, { type: 'attack', player: 0, from: 1, to: null });
  assert.strictEqual(s.players[1].lp, 8000 - 1000 - 800);
});

// ================= V5 มานา =================
t('V1-01 เริ่มเกม: มานา 5 มือ 5 ทั้งสองฝ่าย LP ตาม config', assert => {
  const s = E().createGame({ deckA: 'fixture', deckB: 'fixture', seed: 3 });
  for (const p of s.players) {
    assert.strictEqual(p.mana, 5); assert.strictEqual(p.hand.length, 5); assert.strictEqual(p.lp, 8000);
    assert.strictEqual(p.deck.length, 24 - 5);
  }
});
t('V8-01 จั่วในเฟส draw: มือ +1 และมานา +1 (event draw + manaChange reason draw)', assert => {
  const s = G({ p0: { deck: ['fx_l1a', 'fx_l1b'], mana: 3 }, p1: { deck: ['fx_l1a', 'fx_l1b'] } });
  okA(assert, s, { type: 'endTurn', player: 0 });
  const r = okA(assert, s, { type: 'endTurn', player: 1 });
  const p = s.players[0];
  assert.strictEqual(p.mana, 4); assert.deepStrictEqual(ids(p.hand), ['fx_l1a']); assert.strictEqual(p.deck.length, 1);
  assert.ok(r.events.some(e => e.type === 'draw' && e.player === 0));
  assert.ok(r.events.some(e => e.type === 'manaChange' && e.player === 0 && e.delta === 1 && e.reason === 'draw'));
});
t('V8-02 เด็คหมด: จั่วไม่ได้ ไม่ได้มานา ไม่แพ้ เกมเดินต่อ', assert => {
  const s = G({ p0: { deck: [], mana: 4 }, p1: { deck: [] } });
  okA(assert, s, { type: 'endTurn', player: 0 });
  const r = okA(assert, s, { type: 'endTurn', player: 1 });
  assert.strictEqual(s.players[0].mana, 4); assert.strictEqual(s.players[0].hand.length, 0);
  assert.ok(!r.events.some(e => e.type === 'draw' || e.type === 'manaChange'));
  assert.ok(!s.ended); assert.strictEqual(s.phase, 'main1');
});
t('V8-03 มานาสะสมไม่รีเซ็ต/ไม่มีเพดาน (เล่นจริงจาก createGame)', assert => {
  const s = E().createGame({ deckA: 'fixture', deckB: 'fixture', seed: 5, config: { mulliganCount: 0 } });
  assert.strictEqual(s.players[0].mana, 6);                     // 5 + จั่วเทิร์น 1
  const pass = () => {                                           // จบเทิร์น (ทิ้งมือเกินถ้าถูกถาม)
    okA(assert, s, { type: 'endTurn', player: s.activeIdx });
    if (s.pending) okA(assert, s, { type: 'respond', player: s.pending.player, choice: s.pending.options.slice(0, s.pending.min) });
  };
  pass(); assert.strictEqual(s.players[1].mana, 6);
  pass(); assert.strictEqual(s.players[0].mana, 7);
  for (let i = 0; i < 6; i++) pass();
  assert.strictEqual(s.players[0].mana, 5 + 5); assert.strictEqual(s.players[1].mana, 5 + 4); // เทิร์น 1,3,5,7,9 กับ 2,4,6,8
});
t('V8-04 อัญเชิญ/เปลี่ยนท่า/ต่อสู้ ไม่เปลี่ยนมานา (ค่ามานาของเอฟเฟกต์รอขั้น 4)', assert => {
  const s = G({ p0: { hand: ['fx_l1a', 'fx_l1b'], mana: 2, monsters: { 0: 'fx_l1c' } } });
  okA(assert, s, { type: 'normalSummon', player: 0, handIdx: 0, slot: 1 });
  okA(assert, s, { type: 'changePosition', player: 0, slot: 0 });
  assert.strictEqual(s.players[0].mana, 2);
});
t('V8-05 ทิ้งมือเกินไป removed ไม่ให้มานา และจั่วทุกใบให้มานา +1 (หลายใบ)', assert => {
  const s = G({ p0: { mana: 0 } });
  const ev = [];
  E().drawCard(s, ev, 0, true); E().drawCard(s, ev, 0, true); E().drawCard(s, ev, 0, true);
  assert.strictEqual(s.players[0].mana, 3);
});

// ================= V6 จังหวะเทิร์น / ทิ้งมือ =================
t('E-TURN-01 main1 → battle → main2 → end → เทิร์นถัดไป (draw/standby/main1 อัตโนมัติ)', assert => {
  const s = G({ p1: { deck: ['fx_l1a'] } });
  okA(assert, s, { type: 'advancePhase', player: 0 }); assert.strictEqual(s.phase, 'battle');
  okA(assert, s, { type: 'advancePhase', player: 0 }); assert.strictEqual(s.phase, 'main2');
  const r = okA(assert, s, { type: 'advancePhase', player: 0 });
  const phases = r.events.filter(e => e.type === 'phaseChange').map(e => e.phase);
  assert.deepStrictEqual(phases, ['end', 'draw', 'standby', 'main1']);
  assert.strictEqual(s.turn, 4); assert.strictEqual(s.activeIdx, 1);
  assert.strictEqual(r.events.filter(e => e.type === 'phaseChange').pop().activeIdx, 1);
});
t('E-TURN-02 endTurn ลัดไปจบเทิร์นได้จากทุก Main/Battle', assert => {
  for (const ph of ['main1', 'battle', 'main2']) {
    const s = G({ phase: ph, p1: { deck: ['fx_l1a'] } });
    okA(assert, s, { type: 'endTurn', player: 0 });
    assert.strictEqual(s.activeIdx, 1); assert.strictEqual(s.phase, 'main1');
  }
});
t('V9-01 มือเกิน 7 ตอนจบเทิร์น: ผู้เล่นเลือกทิ้ง ส่วนเกินไป removed', assert => {
  const hand = ['fx_l1a', 'fx_l1b', 'fx_l1c', 'fx_l2a', 'fx_l2b', 'fx_l3a', 'fx_l3b', 'fx_spell', 'fx_spell'];
  const s = G({ p0: { hand }, p1: { deck: ['fx_l1a'] } });
  okA(assert, s, { type: 'endTurn', player: 0 });
  assert.strictEqual(s.phase, 'end'); assert.strictEqual(s.turn, 3);
  assert.strictEqual(s.pending.kind, 'chooseCards'); assert.strictEqual(s.pending.prompt, 'DISCARD_EXCESS');
  assert.strictEqual(s.pending.player, 0); assert.strictEqual(s.pending.min, 2); assert.strictEqual(s.pending.max, 2);
  rej(assert, s, { type: 'advancePhase', player: 0 }, 'PENDING_UNRESOLVED');
  rej(assert, s, { type: 'respond', player: 1, choice: [1, 2] }, 'NOT_YOUR_TURN');
  const u = s.players[0].hand.map(c => c.uid);
  rej(assert, s, { type: 'respond', player: 0, choice: [u[0]] }, 'INVALID_CHOICE');
  rej(assert, s, { type: 'respond', player: 0, choice: [u[0], u[0]] }, 'INVALID_CHOICE');
  rej(assert, s, { type: 'respond', player: 0, choice: [u[0], 99999] }, 'INVALID_CHOICE');
  assert.strictEqual(E().getLegalActions(s, 0).length, 36);        // C(9,2)
  assert.deepStrictEqual(E().getLegalActions(s, 1), []);
  const r = okA(assert, s, { type: 'respond', player: 0, choice: [u[0], u[8]] });
  assert.strictEqual(s.players[0].hand.length, 7);
  assert.deepStrictEqual(ids(s.players[0].removed), ['fx_l1a', 'fx_spell']);
  assert.strictEqual(s.pending, null); assert.strictEqual(s.turn, 4); assert.strictEqual(s.activeIdx, 1);
  assert.ok(r.events.filter(e => e.type === 'moveCard' && e.to === 'removed').length === 2);
});
t('V9-02 ไม่จำกัดมือระหว่างเทิร์น: มือ 7 + จั่ว = 8 ได้ จบเทิร์นทิ้ง 1', assert => {
  const hand = Array(7).fill('fx_l1a');
  const s = G({ turn: 2, p0: { hand, deck: ['fx_l1b', 'fx_l1b'] }, p1: { deck: ['fx_l1a'] } });
  okA(assert, s, { type: 'endTurn', player: 1 });
  assert.strictEqual(s.players[0].hand.length, 8);
  okA(assert, s, { type: 'endTurn', player: 0 });
  assert.strictEqual(s.pending.min, 1);
  okA(assert, s, { type: 'respond', player: 0, choice: [s.pending.options[0]] });
  assert.strictEqual(s.players[0].hand.length, 7);
});
t('V9-03 มือพอดี 7 ไม่ต้องทิ้ง', assert => {
  const s = G({ p0: { hand: Array(7).fill('fx_l1a') }, p1: { deck: ['fx_l1a'] } });
  okA(assert, s, { type: 'endTurn', player: 0 });
  assert.strictEqual(s.pending, null); assert.strictEqual(s.activeIdx, 1);
});
t('V9-04 handLimit อ่านจาก config', assert => {
  const s = G({ config: { handLimit: 2 }, p0: { hand: ['fx_l1a', 'fx_l1b', 'fx_l1c'] }, p1: { deck: ['fx_l1a'] } });
  okA(assert, s, { type: 'endTurn', player: 0 });
  assert.strictEqual(s.pending.min, 1);
});
t('E-TURN-03 จบเทิร์น: ล้าง tempMod, Grade 4 กลับ extra, รีเซ็ต flags', assert => {
  const s = G({ p0: { extra: [], monsters: { 0: { cardId: 'fx_l1a', attackedThisTurn: true, positionChangedThisTurn: true }, 1: 'fx_g4' }, flags: { normalSummonUsed: true, tributeSummonUsed: true, grade4SummonedThisTurn: true } }, p1: { deck: ['fx_l1a'] } });
  mon(s, 0, 0).tempAtkMod = 500; mon(s, 0, 0).tempDefMod = -200; mon(s, 0, 0).atkMod = 100;
  const r = okA(assert, s, { type: 'endTurn', player: 0 });
  const m = mon(s, 0, 0);
  assert.strictEqual(m.tempAtkMod, 0); assert.strictEqual(m.tempDefMod, 0); assert.strictEqual(m.atkMod, 100);
  assert.ok(!m.flags.attackedThisTurn && !m.flags.positionChangedThisTurn);
  assert.strictEqual(mon(s, 0, 1), null); assert.deepStrictEqual(ids(s.players[0].extra), ['fx_g4']);
  assert.ok(r.events.some(e => e.type === 'moveCard' && e.from === 'monster' && e.to === 'extra'));
  const f = s.players[0].flags;
  assert.ok(!f.normalSummonUsed && !f.tributeSummonUsed && !f.grade4SummonedThisTurn);
});
t('E-TURN-04 ผู้เล่นฝ่ายตรงข้ามสั่งในเทิร์นเราไม่ได้ / เฟสผิด', assert => {
  const s = G({ p1: { hand: ['fx_l1a'] } });
  rej(assert, s, { type: 'endTurn', player: 1 }, 'NOT_YOUR_TURN');
  rej(assert, s, { type: 'advancePhase', player: 1 }, 'NOT_YOUR_TURN');
  rej(assert, s, { type: 'pass', player: 0 }, 'NO_WINDOW');
  rej(assert, s, { type: 'respond', player: 0, choice: [] }, 'NO_PENDING');
});

// ================= V7 จบเกม =================
t('E-END-01 LP ถึง 0: ผู้ชนะถูกต้อง ended + gameEnd + ห้ามสั่งต่อ', assert => {
  const s = G({ phase: 'battle', p1: { lp: 2000 }, p0: { monsters: { 2: 'fx_l3a' } } });
  const r = okA(assert, s, { type: 'attack', player: 0, from: 2, to: null });
  assert.strictEqual(s.players[1].lp, 0);                       // ไม่ติดลบ
  assert.ok(s.ended); assert.strictEqual(s.winner, 0);
  assert.ok(r.events.some(e => e.type === 'gameEnd' && e.winner === 0 && e.reason === 'lp'));
  assert.ok(r.events.some(e => e.type === 'lpChange' && e.delta === -2000));
  rej(assert, s, { type: 'endTurn', player: 0 }, 'GAME_ENDED');
  assert.deepStrictEqual(E().getLegalActions(s, 0), []); assert.deepStrictEqual(E().getLegalActions(s, 1), []);
});
t('E-END-02 ผู้โจมตีตายจาก LP สะท้อน (ATK<DEF) ฝ่ายตรงข้ามชนะ', assert => {
  const s = duel('fx_l1a', { cardId: 'fx_l2b', position: 'def' }, { p0: { lp: 400, monsters: { 2: 'fx_l1a' } }, p1: { monsters: { 1: { cardId: 'fx_l2b', position: 'def' } } } });
  hit(assert, s);
  assert.ok(s.ended); assert.strictEqual(s.winner, 1);
});
t('E-END-03 LP ผู้เล่นทั้งสองถึง 0 พร้อมกัน = เสมอ', assert => {
  const s = G({ p0: { lp: 100 }, p1: { lp: 100 } }); const ev = [];
  E().changeLp(s, ev, 0, -100, 'effect'); assert.ok(s.ended && s.winner === 1);
  const s2 = G({}); s2.players[0].lp = 0; s2.players[1].lp = 0; E().checkLpEnd(s2, ev);
  assert.strictEqual(s2.winner, 'draw');
});
t('V14-01 เด็คหมดไม่แพ้ (ก่อนถึง tiebreakTurn)', assert => {
  const s = G({ turn: 20, p0: { deck: [] }, p1: { deck: [] } });
  okA(assert, s, { type: 'endTurn', player: s.activeIdx });
  assert.ok(!s.ended);
});
t('V14-02 tiebreak: เด็คหมดทั้งคู่ + เกินเทิร์น 50 คนมีการ์ดบนสนามมากกว่าชนะ', assert => {
  const s = G({ turn: 51, p0: { deck: [], monsters: { 0: 'fx_l1a', 1: 'fx_l1a' }, spells: { 0: 'fx_spell' } }, p1: { deck: [], monsters: { 0: 'fx_l1a', 1: 'fx_l1a' } } });
  const r = okA(assert, s, { type: 'endTurn', player: 0 });
  assert.ok(s.ended); assert.strictEqual(s.winner, 0);
  assert.ok(r.events.some(e => e.type === 'gameEnd' && e.reason === 'tiebreak'));
  const s2 = G({ turn: 52, p0: { deck: [], monsters: { 0: 'fx_l1a' } }, p1: { deck: [], monsters: { 0: 'fx_l1a', 1: 'fx_l1a' }, fieldSpell: 'fx_spell' } });
  okA(assert, s2, { type: 'endTurn', player: 1 });
  assert.strictEqual(s2.winner, 1);
});
t('V14-03 tiebreak เท่ากัน = เสมอ / ไม่ทำงานเมื่อเด็คยังเหลือหรือยังไม่เกินเทิร์น', assert => {
  const a = G({ turn: 51, p0: { deck: [], monsters: { 0: 'fx_l1a' } }, p1: { deck: [], monsters: { 0: 'fx_l1b' } } });
  okA(assert, a, { type: 'endTurn', player: 0 }); assert.ok(a.ended); assert.strictEqual(a.winner, 'draw');
  const b = G({ turn: 50, p0: { deck: [] }, p1: { deck: [] } });
  okA(assert, b, { type: 'endTurn', player: 1 }); assert.ok(!b.ended);
  const c = G({ turn: 99, p0: { deck: [] }, p1: { deck: ['fx_l1a', 'fx_l1b'] } });
  okA(assert, c, { type: 'endTurn', player: 0 }); assert.ok(!c.ended);
  const d = G({ turn: 3, config: { tiebreakTurn: 2 }, p0: { deck: [] }, p1: { deck: [] } });
  okA(assert, d, { type: 'endTurn', player: 0 }); assert.ok(d.ended);
});

// ================= V8 ความถูกต้องของ API =================
t('E-API-01 คำสั่งผิดกติกาไม่เปลี่ยน state/log และคืน event rejected', assert => {
  const s = G({ p0: { hand: ['fx_l1a', 'fx_l2a'] }, p1: { hand: ['fx_l1b'] } });
  rej(assert, s, { type: 'normalSummon', player: 0, handIdx: 1, slot: 0 }, 'LEVEL_NOT_1');
  rej(assert, s, { type: 'normalSummon', player: 1, handIdx: 0, slot: 0 }, 'NOT_YOUR_TURN');
  rej(assert, s, { type: 'tributeSummon', player: 0, handIdx: 1, materials: [0], slot: 0 }, 'MATERIAL_INVALID');
  rej(assert, s, { type: 'attack', player: 0, from: 0, to: null }, 'WRONG_PHASE');
});
t('E-API-02 action แปลก: UNKNOWN_ACTION / INVALID_PLAYER / ยังไม่ทำ = NOT_IMPLEMENTED', assert => {
  const s = G({ p0: { hand: ['fx_spell'] } });
  rej(assert, s, { type: 'dance', player: 0 }, 'UNKNOWN_ACTION');
  rej(assert, s, null, 'UNKNOWN_ACTION');
  rej(assert, s, { type: 'endTurn', player: 5 }, 'INVALID_PLAYER');
  for (const type of ['overlay', 'setSpell', 'activateSpell']) {
    rej(assert, s, { type, player: 0, handIdx: 0, slot: 0 }, 'NOT_IMPLEMENTED');
  }
});
t('E-API-03 cloneState: เป็นสำเนาอิสระ rng เดินต่อเหมือนกัน และ state JSON ได้', assert => {
  const s = G({ seed: 11, p0: { hand: ['fx_l1a'], monsters: { 0: 'fx_l1b' } } });
  const c = E().cloneState(s);
  assert.deepStrictEqual(JSON.parse(JSON.stringify({ ...c, rng: 0 })), JSON.parse(JSON.stringify({ ...s, rng: 0 })));
  okA(assert, c, { type: 'normalSummon', player: 0, handIdx: 0, slot: 1 });
  assert.ok(mon(s, 0, 1) === null && s.players[0].hand.length === 1 && s.log.length === 0);
  assert.ok(mon(c, 0, 1) && c.log.length > 0);
  assert.strictEqual(c.rng.next(), s.rng.next());
  assert.notStrictEqual(c.players[0], s.players[0]);
  assert.doesNotThrow(() => JSON.stringify({ ...s, rng: undefined }));
});
t('E-API-04 seed เดียวกัน = เกมเหมือนกัน / seed ต่างกัน = สับต่างกัน', assert => {
  const mk = sd => E().createGame({ deckA: 'aquila', deckB: 'dinosaur', seed: sd });
  const sig = s => JSON.stringify(s.players.map(p => p.hand.map(c => c.cardId)));
  assert.strictEqual(sig(mk(42)), sig(mk(42)));
  assert.notStrictEqual(sig(mk(1)), sig(mk(2)));
});
t('E-API-05 เล่นสุ่มจริง 40 เกม (aquila/dinosaur/fixture): ทุก legal action สำเร็จ ไม่ throw การ์ดไม่หาย/ไม่เกิน', assert => {
  const decks = ['aquila', 'dinosaur', 'fixture'];
  const total = s => s.players.reduce((n, p) => {
    const cnt = c => 1 + c.under.length;
    return n + p.deck.length + p.hand.length + p.extra.length + p.grave.length + p.removed.length +
      p.monsters.reduce((x, c) => x + (c ? cnt(c) : 0), 0);
  }, 0);
  for (let seed = 1; seed <= 40; seed++) {
    const s = E().createGame({ deckA: decks[seed % 3], deckB: decks[(seed + 1) % 3], seed, config: { mulliganCount: seed % 2 } });
    const n0 = total(s); let r = seed * 7919, steps = 0;
    const rnd = k => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r % k; };
    while (!s.ended && steps++ < 600) {
      let acts = [];
      for (const p of [0, 1]) acts = acts.concat(E().getLegalActions(s, p));
      assert.ok(acts.length > 0, `ติดตายที่ seed ${seed} step ${steps}`);
      // เอนเอียงให้ลง/โจมตีก่อนจบเทิร์น เพื่อให้เกมเกิดเหตุการณ์จริง
      const pri = acts.filter(a => !['advancePhase', 'endTurn'].includes(a.type));
      const pool = pri.length && rnd(4) ? pri : acts;
      const a = pool[rnd(pool.length)];
      const res = E().applyAction(s, a);
      assert.ok(res.ok, `seed ${seed}: ${JSON.stringify(a)} → ${res.error}`);
      assert.strictEqual(total(s), n0, 'จำนวนการ์ดรวมต้องคงที่');
    }
  }
});
t('E-API-06 engine/ ไม่มี DOM/setTimeout/alert และไม่อ่าน card.text / switch(card.id)', assert => {
  const dir = path.join(__dirname, '..', 'engine');
  for (const f of fs.readdirSync(dir).filter(n => n.endsWith('.js'))) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8').split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
    assert.ok(!/setTimeout|setInterval|\balert\(|\bdocument\b|\bwindow\b|localStorage/.test(src), f + ' มี API เบราว์เซอร์/เวลา');
    assert.ok(!/switch\s*\(\s*[\w.]*\.id\s*\)/.test(src), f + ' มี switch ตาม id การ์ด');
    assert.ok(!/\.text\b/.test(src), f + ' อ่านฟิลด์ text');
    assert.ok(!/Math\.random/.test(src), f + ' ใช้ Math.random (ต้องใช้ rng ของ state)');
  }
});
t('E-API-07 API สาธารณะครบ 4 ฟังก์ชันตามข้อ 7', assert => {
  for (const k of ['createGame', 'getLegalActions', 'applyAction', 'cloneState']) assert.strictEqual(typeof E()[k], 'function', k);
  assert.strictEqual(typeof CG.test.makeGame, 'function');
});

// ================= V9 เริ่มเกม / mulligan =================
const newGame = (o) => E().createGame(Object.assign({ deckA: 'fixture', deckB: 'fixture', seed: 9 }, o));
t('V1-02 createGame: เฟส mulligan ก่อนเริ่มเทิร์น 1 ยังไม่จั่ว', assert => {
  const s = newGame();
  assert.strictEqual(s.phase, 'mulligan'); assert.strictEqual(s.turn, 1); assert.strictEqual(s.activeIdx, 0);
  assert.strictEqual(s.players[0].hand.length, 5);
  assert.strictEqual(s.winner, null); assert.strictEqual(s.ended, false);
  assert.strictEqual(s.config.startLp, 8000); assert.strictEqual(s.players[0].extra.length, 2);
  assert.deepStrictEqual(E().getLegalActions(s, 0).map(a => a.type), ['mulligan', 'pass']);
  assert.deepStrictEqual(E().getLegalActions(s, 1).map(a => a.type), ['mulligan', 'pass']);
});
t('V1-03 mulligan: เปลี่ยนเฉพาะที่เลือก มือ/เด็ค/มานาไม่เปลี่ยนจำนวน ทำได้ครั้งเดียว', assert => {
  const s = newGame(); const p = s.players[0];
  const keep = p.hand.slice(2).map(c => c.uid), deckN = p.deck.length;
  okA(assert, s, { type: 'mulligan', player: 0, indices: [0, 1] });
  assert.deepStrictEqual(p.hand.slice(0, 3).map(c => c.uid), keep);
  assert.strictEqual(p.hand.length, 5); assert.strictEqual(p.deck.length, deckN); assert.strictEqual(p.mana, 5);
  assert.strictEqual(p.flags.mulliganUsed, 1);
  rej(assert, s, { type: 'mulligan', player: 0 }, 'MULLIGAN_USED');
  rej(assert, s, { type: 'pass', player: 0 }, 'MULLIGAN_USED');
  assert.deepStrictEqual(E().getLegalActions(s, 0), []);
});
t('V2-02 ทั้งสองฝ่ายตัดสินใจแล้ว เทิร์น 1 เริ่ม: ผู้เริ่มจั่ว +1 มานา เข้า main1', assert => {
  const s = newGame();
  okA(assert, s, { type: 'pass', player: 1 }); assert.strictEqual(s.phase, 'mulligan');
  const r = okA(assert, s, { type: 'mulligan', player: 0 });          // เปลี่ยนทั้งมือ
  assert.strictEqual(s.phase, 'main1'); assert.strictEqual(s.turn, 1);
  assert.strictEqual(s.players[0].hand.length, 6); assert.strictEqual(s.players[0].mana, 6);
  assert.strictEqual(s.players[1].hand.length, 5); assert.strictEqual(s.players[1].mana, 5);
  assert.deepStrictEqual(r.events.filter(e => e.type === 'phaseChange').map(e => e.phase), ['draw', 'standby', 'main1']);
});
t('V1-04 mulligan ผิด: ดัชนีผิด/ซ้ำ/ว่าง, สั่งอย่างอื่นระหว่าง mulligan, mulligan นอกช่วง', assert => {
  const s = newGame();
  rej(assert, s, { type: 'mulligan', player: 0, indices: [7] }, 'INVALID_CHOICE');
  rej(assert, s, { type: 'mulligan', player: 0, indices: [1, 1] }, 'INVALID_CHOICE');
  rej(assert, s, { type: 'mulligan', player: 0, indices: [] }, 'INVALID_CHOICE');
  rej(assert, s, { type: 'normalSummon', player: 0, handIdx: 0, slot: 0 }, 'WRONG_PHASE');
  rej(assert, s, { type: 'endTurn', player: 0 }, 'WRONG_PHASE');
  okA(assert, s, { type: 'pass', player: 0 }); okA(assert, s, { type: 'pass', player: 1 });
  rej(assert, s, { type: 'mulligan', player: 0 }, 'WRONG_PHASE');
});
t('V1-05 mulliganCount = 0: ข้าม mulligan เข้าเทิร์น 1 ทันที', assert => {
  const s = newGame({ config: { mulliganCount: 0 } });
  assert.strictEqual(s.phase, 'main1'); assert.strictEqual(s.players[0].hand.length, 6);
});
t('V1-06 mulligan ใช้ rng ของ state (seed เดียวกัน ผลเหมือนกัน)', assert => {
  const run = () => { const s = newGame({ seed: 77 }); E().applyAction(s, { type: 'mulligan', player: 0 }); return s.players[0].hand.map(c => c.cardId).join(); };
  assert.strictEqual(run(), run());
});
t('E-API-08 makeGame: วางสนาม/สุสาน/มือ/มานา/LP ตามที่ระบุ และใช้การ์ดไม่รู้จักแล้ว throw', assert => {
  const s = G({ turn: 4, p1: { hand: ['fx_l1a'], grave: ['fx_l2a'], mana: 9, lp: 1234, monsters: { 2: { cardId: 'fx_l2a', under: ['fx_l1a'], position: 'def' } } } });
  assert.strictEqual(s.activeIdx, 1); assert.strictEqual(s.phase, 'main1');
  const p = s.players[1];
  assert.strictEqual(p.mana, 9); assert.strictEqual(p.lp, 1234); assert.deepStrictEqual(ids(p.grave), ['fx_l2a']);
  assert.strictEqual(p.monsters[2].position, 'def'); assert.strictEqual(p.monsters[2].under.length, 1);
  assert.strictEqual(new Set([].concat(...s.players.map(q => [...q.hand, ...q.deck, ...q.grave].map(c => c.uid)))).size,
    [].concat(...s.players.map(q => [...q.hand, ...q.deck, ...q.grave])).length, 'uid ต้องไม่ซ้ำ');
  assert.throws(() => G({ p0: { hand: ['no_such_card'] } }));
});

// ================= 4A-2: trigger + activateEffect (effectBridge) =================
function withFx(cardId, effects, fn) {   // ใส่ effects ให้การ์ด fixture ชั่วคราว แล้วคืนค่าเดิมเสมอ
  const def = CG.engine.findCard(cardId), old = def.effects;
  def.effects = effects;
  try { fn(); } finally { def.effects = old; }
}
const mana = (id, trigger, amount, extra) => Object.assign({ id, trigger, speed: 1, do: [{ op: 'addMana', amount }] }, extra || {});
const fired = (r, id) => r.events.filter(e => e.type === 'effectActivated' && e.effectId === id).length;

t('FX-01 onSummon ยิงตอนอัญเชิญปกติ แต่ Set คว่ำและ onFlip ไม่ปนกัน', assert => {
  withFx('fx_l1a', [mana('s', 'onSummon', 2), mana('f', 'onFlip', 5)], () => {
    const s = G({ p0: { hand: ['fx_l1a', 'fx_l1a'], mana: 0 } });
    const r = okA(assert, s, { type: 'normalSummon', player: 0, handIdx: 0, slot: 0 });
    assert.strictEqual(s.players[0].mana, 2); assert.strictEqual(fired(r, 's'), 1); assert.strictEqual(fired(r, 'f'), 0);
    const s2 = G({ p0: { hand: ['fx_l1a'], mana: 0 } });
    okA(assert, s2, { type: 'setMonster', player: 0, handIdx: 0, slot: 0 });
    assert.strictEqual(s2.players[0].mana, 0, 'Set คว่ำไม่ยิง onSummon');
  });
});

t('FX-02 onFlip ยิงตอน Flip Summon และตอนถูกโจมตีแล้วพลิกหงาย', assert => {
  withFx('fx_l1a', [mana('f', 'onFlip', 2)], () => {
    const s = G({ p0: { mana: 0, monsters: { 0: { cardId: 'fx_l1a', faceDown: true, setTurn: 1 } } } });
    okA(assert, s, { type: 'flipSummon', player: 0, slot: 0 });
    assert.strictEqual(s.players[0].mana, 2);
    const b = G({ phase: 'battle', p0: { monsters: { 0: 'fx_l2a' } }, p1: { mana: 0, monsters: { 0: { cardId: 'fx_l1a', faceDown: true } } } });
    okA(assert, b, { type: 'attack', player: 0, from: 0, to: 0 });
    assert.strictEqual(b.players[1].mana, 2, 'พลิกหงายตอน damageStep');
  });
});

t('FX-03 onStandby ยิงเฉพาะการ์ดเจ้าของเทิร์น + limit ต่อเทิร์น', assert => {
  withFx('fx_l1a', [mana('sb', 'onStandby', 3, { limit: { per: 'turn', key: 'sb', count: 1 } })], () => {
    const s = G({ turn: 3, p0: { mana: 0, monsters: { 0: 'fx_l1a', 1: 'fx_l1a' } }, p1: { mana: 0, monsters: { 0: 'fx_l1a' } } });
    okA(assert, s, { type: 'endTurn', player: 0 });
    assert.strictEqual(s.turn, 4);
    assert.strictEqual(s.players[1].mana, 1 + 3, 'ผู้เล่น 1: จั่ว +1 และ onStandby +3 (ใบเดียวตาม limit)');
    assert.strictEqual(s.players[0].mana, 0, 'การ์ดของฝ่ายที่ไม่ใช่เจ้าของเทิร์นไม่ยิง');
  });
});

t('FX-04 onEndPhase ยิงทั้งสองฝ่าย (เจ้าของเทิร์นก่อน) ก่อนทิ้งมือเกิน', assert => {
  withFx('fx_l1a', [mana('e', 'onEndPhase', 1)], () => {
    const s = G({ p0: { mana: 0, monsters: { 0: 'fx_l1a' }, hand: Array(8).fill('fx_l2a') }, p1: { mana: 0, monsters: { 0: 'fx_l1a' } } });
    const r = okA(assert, s, { type: 'endTurn', player: 0 });
    assert.strictEqual(s.players[0].mana, 1); assert.strictEqual(s.players[1].mana, 1);
    assert.strictEqual(s.pending && s.pending.prompt, 'DISCARD_EXCESS', 'ยังต้องทิ้งมือหลังเอฟเฟกต์');
    assert.deepStrictEqual(r.events.filter(e => e.type === 'effectActivated').map(e => e.uid), [s.players[0].monsters[0].uid, s.players[1].monsters[0].uid]);
  });
});

t('FX-05 onAttackDeclared (ผู้โจมตี) และ onBattleDestroy (ผู้ทำลาย ทั้งสองทิศ)', assert => {
  withFx('fx_l2a', [mana('ad', 'onAttackDeclared', 1), mana('bd', 'onBattleDestroy', 4)], () => {
    const s = G({ phase: 'battle', p0: { mana: 0, monsters: { 0: 'fx_l2a' } }, p1: { mana: 0, monsters: { 0: 'fx_l1a' } } });
    okA(assert, s, { type: 'attack', player: 0, from: 0, to: 0 });
    assert.strictEqual(s.players[0].mana, 1 + 4, 'ประกาศโจมตี +1 และทำลายเป้า +4');
    assert.strictEqual(s.players[1].mana, 0);
    const s2 = G({ phase: 'battle', p0: { monsters: { 0: 'fx_l1a' } }, p1: { mana: 0, monsters: { 0: 'fx_l2a' } } });
    okA(assert, s2, { type: 'attack', player: 0, from: 0, to: 0 });   // Lv1 ชน Lv2: เป้าเป็นฝ่ายทำลาย
    assert.strictEqual(s2.players[1].mana, 4, 'เป้าที่ชนะการต่อสู้ได้ onBattleDestroy');
  });
});

t('FX-06 onDestroyed + onSentToGrave เมื่อถูกทำลาย แต่เสียสละยิงเฉพาะ onSentToGrave', assert => {
  withFx('fx_l1a', [mana('d', 'onDestroyed', 2), mana('g', 'onSentToGrave', 5)], () => {
    const s = G({ phase: 'battle', p0: { mana: 0, monsters: { 0: 'fx_l3a' } }, p1: { mana: 0, monsters: { 0: 'fx_l1a' } } });
    okA(assert, s, { type: 'attack', player: 0, from: 0, to: 0 });
    assert.strictEqual(s.players[1].mana, 2 + 5);
    const t2 = G({ p0: { mana: 0, hand: ['fx_l2a'], monsters: { 0: 'fx_l1a', 1: 'fx_l1a' } } });
    okA(assert, t2, { type: 'tributeSummon', player: 0, handIdx: 0, materials: [0, 1], slot: 0 });
    assert.strictEqual(t2.players[0].mana, 10, 'วัสดุ 2 ใบ ได้ onSentToGrave ใบละ 5 ไม่ได้ onDestroyed');
  });
});

t('FX-07 activateEffect ทำงานจริง: จ่ายมานา, นับ limit, ออก event; ใช้ซ้ำเกิน limit ถูกปฏิเสธ', assert => {
  const ef = { id: 'ig', trigger: 'ignition', speed: 1, cost: { mana: 2 }, limit: { per: 'turn', key: 'ig', count: 1 }, do: [{ op: 'draw', count: 1 }] };
  withFx('fx_l1a', [ef], () => {
    const s = G({ p0: { mana: 5, monsters: { 0: 'fx_l1a' } } });
    const h = s.players[0].hand.length;
    const r = okA(assert, s, { type: 'activateEffect', player: 0, slot: 0, effectId: 'ig' });
    assert.strictEqual(s.players[0].hand.length, h + 1); assert.strictEqual(s.players[0].mana, 5 - 2 + 1);
    assert.strictEqual(fired(r, 'ig'), 1);
    rej(assert, s, { type: 'activateEffect', player: 0, slot: 0, effectId: 'ig' }, 'LIMIT_REACHED');
  });
});

t('FX-08 activateEffect ผิดกติกา: state ไม่เปลี่ยนเลย', assert => {
  const ig = { id: 'ig', trigger: 'ignition', speed: 1, cost: { mana: 3 }, do: [{ op: 'draw', count: 1 }] };
  const bad = { id: 'bad', trigger: 'ignition', speed: 1, do: [{ op: 'noSuchOp' }] };
  const on = { id: 'on', trigger: 'onSummon', speed: 1, do: [{ op: 'draw', count: 1 }] };
  withFx('fx_l1a', [ig, bad, on], () => {
    const mk = o => G(Object.assign({ p0: { mana: 5, monsters: { 0: 'fx_l1a', 1: { cardId: 'fx_l1a', faceDown: true } } } }, o));
    const a = (slot, id, p) => ({ type: 'activateEffect', player: p === undefined ? 0 : p, slot, effectId: id });
    rej(assert, mk({ phase: 'battle' }), a(0, 'ig'), 'WRONG_PHASE');
    rej(assert, mk(), a(3, 'ig'), 'NO_MONSTER');
    rej(assert, mk(), a(9, 'ig'), 'INVALID_SLOT');
    rej(assert, mk(), a(1, 'ig'), 'FACE_DOWN');
    rej(assert, mk(), a(0, 'zzz'), 'NO_SUCH_EFFECT');
    rej(assert, mk(), a(0, 'on'), 'WRONG_TRIGGER');
    rej(assert, mk(), a(0, 'bad'), 'NOT_IMPLEMENTED');
    rej(assert, G({ p0: { mana: 1, monsters: { 0: 'fx_l1a' } } }), a(0, 'ig'), 'NOT_ENOUGH_MANA');
    rej(assert, mk(), a(0, 'ig', 1), 'NOT_YOUR_TURN');
  });
});

t('FX-09 getLegalActions แสดง activateEffect เฉพาะที่ใช้ได้จริง และ applyAction ยอมรับทุกอัน', assert => {
  const ig = { id: 'ig', trigger: 'ignition', speed: 1, cost: { mana: 3 }, do: [{ op: 'addMana', amount: 1 }] };
  withFx('fx_l1a', [ig], () => {
    const s = G({ p0: { mana: 5, monsters: { 0: 'fx_l1a', 1: { cardId: 'fx_l1a', faceDown: true } } } });
    const acts = E().getLegalActions(s, 0).filter(a => a.type === 'activateEffect');
    assert.deepStrictEqual(acts, [{ type: 'activateEffect', player: 0, slot: 0, effectId: 'ig' }]);
    for (const a of acts) assert.ok(A(E().cloneState(s), a).ok);
    s.players[0].mana = 2;
    assert.strictEqual(E().getLegalActions(s, 0).filter(a => a.type === 'activateEffect').length, 0, 'มานาไม่พอ = ไม่แสดง');
    assert.strictEqual(E().getLegalActions(s, 1).filter(a => a.type === 'activateEffect').length, 0);
  });
});

t('FX-10 trigger ที่เงื่อนไข/มานา/op ใช้ไม่ได้ถูกข้ามเงียบ เกมเดินต่อ และการ์ดไม่มีเอฟเฟกต์ไม่กระทบ', assert => {
  const fx = [{ id: 'x', trigger: 'onSummon', speed: 1, do: [{ op: 'noSuchOp' }] },
    { id: 'c', trigger: 'onSummon', speed: 1, cost: { mana: 99 }, do: [{ op: 'addMana', amount: 1 }] },
    { id: 'k', trigger: 'onSummon', speed: 1, condition: [{ op: 'noSuchCond' }], do: [{ op: 'addMana', amount: 1 }] },
    mana('ok', 'onSummon', 2)];
  withFx('fx_l1a', fx, () => {
    const s = G({ p0: { mana: 0, hand: ['fx_l1a'] } });
    const r = okA(assert, s, { type: 'normalSummon', player: 0, handIdx: 0, slot: 0 });
    assert.strictEqual(s.players[0].mana, 2); assert.strictEqual(fired(r, 'ok'), 1);
    assert.strictEqual(r.events.filter(e => e.type === 'effectActivated').length, 1);
    assert.ok(s.players[0].monsters[0], 'การอัญเชิญสำเร็จตามปกติ');
  });
});

const key = n => { const m = /^(V(\d+)|E)-?(\w*)-?(\d+)/.exec(n.name); const g = n.name.split(' ')[0];
  const mm = /^V(\d+)-(\d+)$/.exec(g); return mm ? [0, +mm[1], +mm[2], ''] : [1, 0, 0, g]; };
T.sort((a, b) => { const x = key(a), y = key(b); for (let i = 0; i < 4; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1; return 0; });
module.exports = T;
