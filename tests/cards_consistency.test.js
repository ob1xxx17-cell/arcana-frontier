// tests/cards_consistency.test.js - ทดสอบความถูกต้องของเอฟเฟกต์การ์ดที่ตรงกับคำอธิบายการ์ด
require('./fixtures');
const E = () => CG.engine;
const FX = () => CG.effects;
const game = (o, cfg) => CG.test.makeGame(Object.assign({ deckA: 'dinosaur', deckB: 'aquila', seed: 1 }, o, {
  config: Object.assign({ chainMode: true, autoChoose: true }, cfg)
}));

module.exports = [
  // 1. mecha_trinity_tempest: Quick effect barrier (Speed 2)
  {
    name: 'CONSIST-01: mecha_trinity_tempest สามารถเปิดใช้บาเรียแบบเอฟเฟกต์เร็ว (Speed 2) ตอนศัตรูประกาศโจมตีได้',
    run(assert) {
      const s = game({
        turn: 2, activeIdx: 1, phase: 'battle',
        p1: { monsters: { 0: { cardId: 'aq_imperator', position: 'atk' } } }, // ATK 2600
        p0: { mana: 1, monsters: { 0: { cardId: 'mecha_trinity_tempest', position: 'atk' } } }
      });

      // P1 โจมตีใส่ trinity_tempest
      E().applyAction(s, { type: 'attack', player: 1, from: 0, to: 0 });
      assert.ok(s.pending && s.pending.player === 0, 'เปิดหน้าต่างตอบโต้ให้ P0');

      // P0 เปิดใช้ trinity_shield (Speed 2) จ่าย 1 Arcana
      const r = E().applyAction(s, { type: 'activateResponse', player: 0, slot: 0, effectId: 'trinity_shield' });
      assert.strictEqual(r.ok, true, 'เปิดใช้บาเรียความเร็ว 2 สำเร็จ');
      assert.strictEqual(s.players[0].mana, 0, 'จ่าย 1 Arcana');

      // โซ่แก้ผล
      assert.strictEqual(s.pending, null);
      // trinity_tempest ได้รับการคุ้มครองไม่ถูกทำลาย
      assert.strictEqual(s.players[0].monsters[0].cardId, 'mecha_trinity_tempest');
    }
  },

  // 2. cube_blacksmith: Requires sword on field to activate
  {
    name: 'CONSIST-02: cube_blacksmith ไม่สามารถกดใช้ได้หากบนสนามเราไม่มีอุปกรณ์สายดาบ',
    run(assert) {
      const s = game({
        turn: 1, activeIdx: 0, phase: 'main1',
        p0: { mana: 2, monsters: { 0: { cardId: 'cube_blacksmith', position: 'atk' } } } // ไม่มีดาบบนสนาม
      });

      const r = E().applyAction(s, { type: 'activateEffect', player: 0, slot: 0, effectId: 'blacksmith_forge' });
      assert.strictEqual(r.ok, false, 'ไม่ผ่านเงื่อนไขเพราะไม่มีดาบบนสนาม');
      assert.strictEqual(s.players[0].mana, 2, 'ไม่เสียมานาฟรี');
    }
  },

  // 3. cube_forge_station: Requires sword on field to cast
  {
    name: 'CONSIST-03: cube_forge_station ไม่สามารถร่ายได้หากบนสนามเราไม่มีอุปกรณ์สายดาบ',
    run(assert) {
      const s = game({
        turn: 1, activeIdx: 0, phase: 'main1',
        p0: { mana: 1, hand: ['cube_forge_station'], monsters: { 0: { cardId: 'cube_kobo_trainee', position: 'atk' } } } // ไม่มีดาบบนสนาม
      });

      const r = E().applyAction(s, { type: 'activateSpell', player: 0, handIdx: 0 });
      assert.strictEqual(r.ok, false, 'ร่ายไม่สำเร็จเพราะไม่มีดาบให้ส่งลง Abyss');
      assert.strictEqual(s.players[0].mana, 1, 'ไม่เสียมานาฟรี');
    }
  },

  // 4. luna_ember_queen: onSummon costs 1 Arcana as stated on card
  {
    name: 'CONSIST-04: luna_ember_queen เมื่ออัญเชิญสำเร็จ จ่าย 1 Arcana ตามที่ระบุบนการ์ด',
    run(assert) {
      const s = game({
        turn: 3, activeIdx: 0, phase: 'main1',
        p0: {
          mana: 2, // 1 สำหรับ luna_resonance + 1 สำหรับ luna_ember_queen
          hand: ['luna_resonance', 'luna_ember', 'luna_ember_blaze'],
          extra: ['luna_ember_queen']
        },
        p1: { lp: 8000 }
      });

      const r = E().applyAction(s, { type: 'activateSpell', player: 0, handIdx: 0 });
      assert.strictEqual(r.ok, true, 'ฟิวชั่นสำเร็จ');
      assert.strictEqual(s.players[1].lp, 7000, 'ยิง 1000 Effect Damage สำเร็จ');
      assert.strictEqual(s.players[0].mana, 0, 'จ่าย 1 มานาร่ายฟิวชั่น + จ่าย 1 Arcana ตอนอัญเชิญราชินี');
    }
  }
];
