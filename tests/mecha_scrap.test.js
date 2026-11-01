// tests/mecha_scrap.test.js - ทดสอบระบบคอมโบเด็ค เมก้าสแครป (MECHA SCRAP)
require('./fixtures');
const E = () => CG.engine;
const FX = () => CG.effects;
const game = (o, cfg) => CG.test.makeGame(Object.assign({ deckA: 'mecha_scrap', deckB: 'dinosaur', seed: 1 }, o, {
  config: Object.assign({ chainMode: true, autoChoose: true }, cfg)
}));

module.exports = [
  // 1. ดรอยด์ โดดลงสนามฟรีเมื่อคุม mecha
  {
    name: 'SCRAP-01: scrap_droid กดใช้จากมือเมื่อคุม mecha บนสนาม จะอัญเชิญพิเศษตัวเองลงสนาม',
    run(assert) {
      const s = game({
        turn: 3, activeIdx: 0, phase: 'main1',
        p0: {
          hand: ['scrap_droid'],
          monsters: { 0: 'scrap_worker' },
          mana: 0
        }
      });

      const droid = s.players[0].hand[0];
      assert.ok(droid);

      const r = E().applyAction(s, { type: 'activateEffect', player: 0, handIdx: 0, effectId: 'scrap_droid_sp' });
      assert.ok(r.ok, 'โดดลงสนามสำเร็จ');

      // ดรอยด์ต้องลงมาอยู่ที่ช่องว่าง (เช่น ช่อง 1)
      assert.strictEqual(s.players[0].hand.length, 0);
      assert.ok(s.players[0].monsters[1]);
      assert.strictEqual(s.players[0].monsters[1].cardId, 'scrap_droid');
    }
  },

  // 2. เวิร์กเกอร์ ชุบ Lv1 จากสุสานเมื่อลงสู่สนาม
  {
    name: 'SCRAP-02: scrap_worker onSummon ชุบ mecha Lv1 จากสุสาน 1 ตัว',
    run(assert) {
      const s = game({
        turn: 3, activeIdx: 0, phase: 'main1',
        p0: {
          hand: ['scrap_worker'],
          grave: ['scrap_magnet'],
          monsters: {},
          mana: 0
        }
      });

      // ลงปกติ Worker
      const r = E().applyAction(s, { type: 'normalSummon', player: 0, handIdx: 0, slot: 0 });
      assert.ok(r.ok, 'ลง Worker สำเร็จ');

      // onSummon ชุบ Magnet จากสุสานลงช่อง 1
      assert.ok(s.players[0].monsters[0]);
      assert.strictEqual(s.players[0].monsters[0].cardId, 'scrap_worker');
      assert.ok(s.players[0].monsters[1]);
      assert.strictEqual(s.players[0].monsters[1].cardId, 'scrap_magnet');
      assert.strictEqual(s.players[0].grave.length, 0);
    }
  },

  // 3. ฟิวชั่นเรียก กอลเลม (Lv2) และ กอลเลม ชุบ Lv1 จากสุสาน
  {
    name: 'SCRAP-03: scrap_fusion ฟิวชั่น Worker + Droid เรียก กอลเลม แล้วกอลเลมชุบ Lv1 จากสุสาน',
    run(assert) {
      const s = game({
        turn: 3, activeIdx: 0, phase: 'main1',
        p0: {
          monsters: { 0: 'scrap_worker', 1: 'scrap_droid' },
          hand: ['scrap_fusion'],
          extra: ['scrap_golem'],
          grave: [],
          mana: 2
        }
      });

      const r = E().applyAction(s, { type: 'activateSpell', player: 0, handIdx: 0 });
      assert.ok(r.ok, 'ร่ายสแครป ฟิวชั่นสำเร็จ');

      // กอลเลมลงสู่สนาม
      assert.ok(s.players[0].monsters.some(m => m && m.cardId === 'scrap_golem'), 'มีกอลเลมลงสู่สนาม');

      // กอลเลม onSummon ชุบ Worker -> Worker onSummon ชุบ Droid (คอมโบคืนชีพครบฝูง 3 ตัว)
      const count = s.players[0].monsters.filter(Boolean).length;
      assert.strictEqual(count, 3, 'กอลเลมชุบ Worker และ Worker ชุบ Droid รวมเป็น 3 ตัวเต็มสนาม');
    }
  },

  // 4. แมกเน็ต ถูกส่งสุสานเป็นวัตถุดิบฟิวชั่น -> ชุบ mecha Lv1 อีกตัวจากสุสาน
  {
    name: 'SCRAP-04: scrap_magnet onSentToGrave เมื่อเป็นวัตถุดิบฟิวชั่น ชุบ mecha Lv1 ตัวอื่นจากสุสาน',
    run(assert) {
      const s = game({
        turn: 3, activeIdx: 0, phase: 'main1',
        p0: {
          monsters: { 0: 'scrap_magnet', 1: 'scrap_droid' },
          hand: ['scrap_fusion'],
          extra: ['scrap_wolf'],
          grave: [],
          mana: 2
        }
      });

      const r = E().applyAction(s, { type: 'activateSpell', player: 0, handIdx: 0 });
      assert.ok(r.ok, 'ฟิวชั่นสำเร็จ');

      // แมกเน็ตยิง onSentToGrave ชุบ ดรอยด์กลับขึ้นสนาม ทั้งสองตัวต้องอยู่บนสนาม
      assert.ok(s.players[0].monsters.some(m => m && m.cardId === 'scrap_wolf'), 'มีวูล์ฟบนสนาม');
      assert.ok(s.players[0].monsters.some(m => m && (m.cardId === 'scrap_droid' || m.cardId === 'scrap_magnet')), 'มีตัวที่ถูกแมกเน็ตชุบกลับขึ้นมา');
    }
  },

  // 5. ไดนาโม onSentToGrave ค้น mecha Lv1 ขึ้นมือ
  {
    name: 'SCRAP-05: scrap_dynamo onSentToGrave เมื่อลงสุสาน ค้น mecha Lv1 1 ใบขึ้นมือ',
    run(assert) {
      const s = game({
        turn: 3, activeIdx: 0, phase: 'main1',
        p0: {
          monsters: { 0: 'scrap_dynamo', 1: 'scrap_collector' },
          hand: ['scrap_fusion'],
          deck: ['scrap_worker'],
          extra: ['scrap_sentinel'],
          mana: 2
        }
      });

      const r = E().applyAction(s, { type: 'activateSpell', player: 0, handIdx: 0 });
      assert.ok(r.ok, 'ฟิวชั่นสำเร็จ');

      // ไดนาโมค้น Worker ขึ้นมือ
      assert.ok(s.players[0].hand.some(c => c.cardId === 'scrap_worker'), 'ได้ Worker ขึ้นมือจากไดนาโม');
    }
  },

  // 6. สแครป รีบิลด์ ฟิวชั่นจากสุสานโดยการ Exile
  {
    name: 'SCRAP-06: scrap_rebuild ฟิวชั่นโดยเนรเทศ (Exile) วัตถุดิบจากสุสานออกนอกเกม',
    run(assert) {
      const s = game({
        turn: 3, activeIdx: 0, phase: 'main1',
        p0: {
          monsters: {},
          hand: ['scrap_rebuild'],
          grave: ['scrap_droid', 'scrap_worker'],
          removed: [],
          extra: ['scrap_golem'],
          mana: 3
        }
      });

      const r = E().applyAction(s, { type: 'activateSpell', player: 0, handIdx: 0 });
      assert.ok(r.ok, 'ร่ายสแครป รีบิลด์สำเร็จ');

      // กอลเลมต้องลงสนาม
      assert.ok(s.players[0].monsters[0]);
      assert.strictEqual(s.players[0].monsters[0].cardId, 'scrap_golem');

      // วัตถุดิบทั้ง 2 ใบต้องไปอยู่นอกเกม (removed)
      assert.strictEqual(s.players[0].removed.length, 2, 'วัตถุดิบถูกเนรเทศออกนอกเกม 2 ใบ');
    }
  },

  // 7. เมก้าสแครป ไฮยีน่า โม่จากเด็ค และแตกตัวชุบ 2 ใบ
  {
    name: 'SCRAP-07: scrap_hyena onSummon โม่ mecha Lv1 ลงสุสาน และกดใช้สละตัวเองชุบ Lv1 2 ตัว',
    run(assert) {
      const s = game({
        turn: 3, activeIdx: 0, phase: 'main1',
        p0: {
          hand: ['scrap_fusion'],
          monsters: { 0: 'scrap_magnet', 1: 'scrap_worker' },
          deck: ['scrap_dynamo'],
          extra: ['scrap_hyena'],
          grave: [],
          mana: 2
        }
      });

      // ฟิวชั่นเรียก ไฮยีน่า
      const r1 = E().applyAction(s, { type: 'activateSpell', player: 0, handIdx: 0 });
      assert.ok(r1.ok);

      // ไฮยีน่า onSummon โม่ ไดนาโม ลงสุสาน
      assert.ok(s.players[0].grave.some(c => c.cardId === 'scrap_dynamo'), 'ไดนาโมถูกโม่ลงสุสาน');

      // ไฮยีน่าอยู่ช่อง 0 กดใช้ hyena_split สละตัวเองลงสุสาน ชุบ 2 ตัว
      const hyenaSlot = s.players[0].monsters.findIndex(m => m && m.cardId === 'scrap_hyena');
      assert.ok(hyenaSlot >= 0);

      const r2 = E().applyAction(s, { type: 'activateEffect', player: 0, slot: hyenaSlot, effectId: 'hyena_split' });
      assert.ok(r2.ok, 'ไฮยีน่าสละตัวเองชุบสำเร็จ');

      // บนสนามต้องมีมอนสเตอร์เพิ่มขึ้น
      const monCount = s.players[0].monsters.filter(Boolean).length;
      assert.ok(monCount >= 2, 'มีมอนสเตอร์ชุบกลับขึ้นมาเต็มสนาม');
    }
  },

  // 8. เมก้าสแครป ไททัน (Apex Boss)
  {
    name: 'SCRAP-08: scrap_titan อัญเชิญ Apex โดยเนรเทศ 5 ใบจากสุสาน วางทับบน Resonance และยิงทำลายพร้อมชุบ',
    run(assert) {
      const s = game({
        turn: 3, activeIdx: 0, phase: 'main1',
        p0: {
          monsters: { 0: 'scrap_golem' },
          grave: ['scrap_droid', 'scrap_worker', 'scrap_magnet', 'scrap_dynamo', 'scrap_wolf'],
          removed: [],
          extra: ['scrap_titan'],
          mana: 4
        },
        p1: {
          monsters: { 0: 'dino_trex' },
          lp: 4000
        }
      });

      // อัญเชิญ Apex Titan วางทับ Golem
      const rOverlay = E().applyAction(s, { type: 'extraSummon', player: 0, extraIdx: 0, targetSlot: 0 });
      assert.ok(rOverlay.ok, 'อัญเชิญ Apex Titan สำเร็จ');

      const titan = s.players[0].monsters[0];
      assert.ok(titan);
      assert.strictEqual(titan.cardId, 'scrap_titan');
      assert.strictEqual(titan.baseAtk, 3200);

      // วัตถุดิบ 5 ใบในสุสานถูกเนรเทศออกนอกเกม
      assert.strictEqual(s.players[0].removed.length, 5, 'สุสานถูกเนรเทศ 5 ใบ');

      // กดใช้เอฟเฟกต์ Titan ทำลาย dino_trex ศัตรู และชุบ Lv1 จากสุสาน
      // ก่อนใช้ เพิ่ม Lv1 ในสุสาน 1 ใบ
      s.players[0].grave.push(E().newInstance(s, E().findCard('scrap_droid'), 0));
      const rAct = E().applyAction(s, { type: 'activateEffect', player: 0, slot: 0, effectId: 'titan_destroy_revive' });
      assert.ok(rAct.ok, 'Titan ทำลายศัตรูและชุบสำเร็จ');

      // มอนสเตอร์ศัตรูต้องถูกทำลาย
      assert.strictEqual(s.players[1].monsters[0], null, 'dino_trex ถูกทำลาย');
    }
  },

  // 9. ลานเศษเหล็ก (Field Spell) เติม Arcana +1 เมื่อฟิวชั่นสำเร็จ
  {
    name: 'SCRAP-09: scrap_yard เพิ่ม +1 Arcana ทุกครั้งที่อัญเชิญฟิวชั่นสำเร็จ',
    run(assert) {
      const s = game({
        turn: 3, activeIdx: 0, phase: 'main1',
        p0: {
          fieldSpell: 'scrap_yard',
          monsters: { 0: 'scrap_worker', 1: 'scrap_droid' },
          hand: ['scrap_fusion'],
          extra: ['scrap_golem'],
          mana: 1
        }
      });

      // ร่ายฟิวชั่น จ่าย 1 -> เหลือ 0 -> ลานเศษเหล็กยิงได้คืน +1 -> สุทธิเหลือ 1
      const r = E().applyAction(s, { type: 'activateSpell', player: 0, handIdx: 0 });
      assert.ok(r.ok, 'ฟิวชั่นสำเร็จ');
      assert.strictEqual(s.players[0].mana, 1, 'ได้รับ +1 Arcana คืนจากลานเศษเหล็ก');
    }
  }
];
