// tests/field_spell.test.js - ทดสอบระบบการ์ดสนาม (Field Spell) และกฎการ์ดสนามมีได้ใบเดียวในเกม
require('./fixtures');
const E = () => CG.engine;
const game = (o, cfg) => CG.test.makeGame(Object.assign({ deckA: 'dinosaur', deckB: 'aquila', seed: 1 }, o, {
  config: Object.assign({ chainMode: true, autoChoose: true }, cfg)
}));

module.exports = [
  {
    name: 'FS-01: activateSpell วางการ์ดสนาม (dino_nest) ลงในช่อง fieldSpell และหักมานา',
    run(assert) {
      const s = game({
        turn: 3, activeIdx: 0, phase: 'main1',
        p0: { hand: ['dino_nest'], mana: 3 }
      });
      assert.strictEqual(s.players[0].fieldSpell, null);
      const r = E().applyAction(s, { type: 'activateSpell', player: 0, handIdx: 0 });
      assert.strictEqual(r.ok, true, 'ร่ายการ์ดสนามสำเร็จ');
      assert.strictEqual(s.players[0].hand.length, 0, 'ออกจากมือแล้ว');
      assert.strictEqual(s.players[0].mana, 2, 'หัก 1 มานา (3 -> 2)');
      assert.ok(s.players[0].fieldSpell, 'ลงในช่อง fieldSpell');
      assert.strictEqual(s.players[0].fieldSpell.cardId, 'dino_nest');
      assert.strictEqual(s.players[0].fieldSpell.faceDown, false);
      assert.strictEqual(s.players[0].spells[0], null, 'ไม่ลงในช่องสเปลปกติ');
    }
  },
  {
    name: 'FS-02: การ์ดสนามมีได้ใบเดียว ถ้าฝ่ายตรงข้ามใช้ใบใหม่ ใบเก่าจะโดนทำลายลงสุสานทันที',
    run(assert) {
      const s = game({
        turn: 4, activeIdx: 1, phase: 'main1',
        p0: { fieldSpell: 'dino_nest', grave: [] },
        p1: { hand: ['aq_castra'], mana: 3, grave: [] }
      });
      const oldNest = s.players[0].fieldSpell;
      assert.ok(oldNest);

      const r = E().applyAction(s, { type: 'activateSpell', player: 1, handIdx: 0 });
      assert.strictEqual(r.ok, true, 'ผู้เล่น 1 ร่าย aq_castra สำเร็จ');
      assert.strictEqual(s.players[0].fieldSpell, null, 'ช่องสนามของ P0 ว่างลง');
      assert.strictEqual(s.players[0].grave.length, 1, 'รังไดโนของ P0 ลงสุสาน P0');
      assert.strictEqual(s.players[0].grave[0].cardId, 'dino_nest');

      // ตรวจ event destroy by rule
      const destrEv = r.events.find(e => e.type === 'destroy' && e.cardId === 'dino_nest');
      assert.ok(destrEv, 'มี event destroy');
      assert.strictEqual(destrEv.by, 'rule', 'ทำลายด้วยกติกา');
      assert.strictEqual(destrEv.player, 0);

      // ตรวจว่าใบใหม่อยู่ใน fieldSpell ของ P1
      assert.ok(s.players[1].fieldSpell);
      assert.strictEqual(s.players[1].fieldSpell.cardId, 'aq_castra');
      assert.strictEqual(s.players[1].mana, 2);
    }
  },
  {
    name: 'FS-03: ผู้เล่นคนเดิมร่ายการ์ดสนามใบใหม่ทับ ใบเก่าของตนจะถูกทำลายลงสุสาน',
    run(assert) {
      const s = game({
        turn: 3, activeIdx: 0, phase: 'main1',
        p0: { fieldSpell: 'dino_nest', hand: ['dino_nest'], mana: 2, grave: [] }
      });
      const r = E().applyAction(s, { type: 'activateSpell', player: 0, handIdx: 0 });
      assert.strictEqual(r.ok, true);
      assert.strictEqual(s.players[0].grave.length, 1, 'ใบเก่าลงสุสาน');
      assert.strictEqual(s.players[0].grave[0].cardId, 'dino_nest');
      assert.ok(s.players[0].fieldSpell, 'มีใบใหม่อยู่บนสนาม');
      assert.strictEqual(s.players[0].fieldSpell.uid !== s.players[0].grave[0].uid, true, 'uid ต่างกัน');
    }
  },
  {
    name: 'FS-04: ห้ามหมอบการ์ดสนามลงในช่องสเปลปกติ (setSpell ปฏิเสธ CANNOT_SET_FIELD และไม่มีใน legalActions)',
    run(assert) {
      const s = game({
        turn: 3, activeIdx: 0, phase: 'main1',
        p0: { hand: ['dino_nest'], mana: 5 }
      });
      const legals = E().getLegalActions(s, 0);
      assert.strictEqual(legals.some(a => a.type === 'setSpell'), false, 'ต้องไม่มีคำสั่ง setSpell สำหรับการ์ดสนาม');

      const r = E().applyAction(s, { type: 'setSpell', player: 0, handIdx: 0, slot: 0 });
      assert.strictEqual(r.ok, false);
      assert.strictEqual(r.error, 'CANNOT_SET_FIELD');
    }
  },
  {
    name: 'FS-05: มานาไม่พอ ไม่สามารถร่ายการ์ดสนามได้ (NOT_ENOUGH_MANA)',
    run(assert) {
      const s = game({
        turn: 3, activeIdx: 0, phase: 'main1',
        p0: { hand: ['dino_nest'], mana: 0 }
      });
      const legals = E().getLegalActions(s, 0);
      assert.strictEqual(legals.some(a => a.type === 'activateSpell'), false, 'มานา 0 ต้องไม่มี activateSpell');

      const r = E().applyAction(s, { type: 'activateSpell', player: 0, handIdx: 0 });
      assert.strictEqual(r.ok, false);
      assert.strictEqual(r.error, 'NOT_ENOUGH_MANA');
    }
  },
  {
    name: 'FS-06: การ์ดสนาม mecha_strike_city สามารถร่ายลงช่องสนามได้สำเร็จ แม้ effect เป็น trigger โจมตี',
    run(assert) {
      const s = game({
        turn: 3, activeIdx: 0, phase: 'main1',
        p0: { hand: ['mecha_strike_city'], mana: 2 }
      });
      const legals = E().getLegalActions(s, 0);
      assert.ok(legals.some(a => a.type === 'activateSpell'), 'ต้องมี activateSpell ใน legalActions');

      const r = E().applyAction(s, { type: 'activateSpell', player: 0, handIdx: 0 });
      assert.strictEqual(r.ok, true, 'ร่าย mecha_strike_city สำเร็จ');
      assert.ok(s.players[0].fieldSpell);
      assert.strictEqual(s.players[0].fieldSpell.cardId, 'mecha_strike_city');
    }
  }
];
