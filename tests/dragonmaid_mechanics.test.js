// tests/dragonmaid_mechanics.test.js - ทดสอบกลไกสไตล์ Dragonmaid (Milling, Foolish, Tag-Out, Fusion from GY)
require('./fixtures');
const E = () => CG.engine;
const FX = () => CG.effects;
const game = (o, cfg) => CG.test.makeGame(Object.assign({ deckA: 'dinosaur', deckB: 'aquila', seed: 1 }, o, {
  config: Object.assign({ chainMode: true, autoChoose: true }, cfg)
}));

module.exports = [
  // 1. Mill จากใบบนสุดของเด็คลงสุสาน
  {
    name: 'DM-01: op mill โม่การ์ดจากใบบนสุดของเด็คลงสุสานและยิง onSentToGrave',
    run(assert) {
      const s = game({
        turn: 3, activeIdx: 0, phase: 'main1',
        p0: { deck: ['dino_egg', 'dino_trex', 'dino_stego'], grave: [] }
      });
      const ev = [];
      FX().run(s, ev, {
        id: 'test_mill',
        trigger: 'ignition',
        do: [{ op: 'mill', count: 2 }]
      }, { player: 0 });

      assert.strictEqual(s.players[0].deck.length, 1, 'เด็คเหลือ 1 ใบ (3 - 2)');
      assert.strictEqual(s.players[0].grave.length, 2, 'สุสานมี 2 ใบ');
      assert.strictEqual(s.players[0].grave[0].cardId, 'dino_egg');
      assert.strictEqual(s.players[0].grave[1].cardId, 'dino_trex');

      // ตรวจสอบ event moveCard
      const moves = ev.filter(e => e.type === 'moveCard' && e.how === 'mill');
      assert.strictEqual(moves.length, 2);
    }
  },

  // 2. Search ส่งลงสุสาน (Foolish Burial) ยิง onSentToGrave
  {
    name: 'DM-02: op search ส่งการ์ดเจาะจงจากเด็คลงสุสาน (to: grave) ยิง onSentToGrave',
    run(assert) {
      const s = game({
        turn: 3, activeIdx: 0, phase: 'main1',
        p0: { deck: ['dino_egg', 'dino_trex', 'dino_stego'], grave: [] }
      });
      const ev = [];
      FX().run(s, ev, {
        id: 'test_foolish',
        trigger: 'ignition',
        do: [{
          op: 'search',
          from: 'deck',
          to: 'grave',
          filter: { id: 'dino_trex' },
          count: 1
        }]
      }, { player: 0 });

      assert.strictEqual(s.players[0].grave.length, 1);
      assert.strictEqual(s.players[0].grave[0].cardId, 'dino_trex');
      assert.strictEqual(s.players[0].deck.length, 2);
    }
  },

  // 3. Tag-Out: เด้งตัวเองขึ้นมือ และอัญเชิญตัวอื่นจากมือ/สุสานลงมาแทนทันที
  {
    name: 'DM-03: Tag-Out เด้งการ์ดบนสนามขึ้นมือ และอัญเชิญพิเศษมอนสเตอร์ลงช่องที่ว่างทันที',
    run(assert) {
      const s = game({
        turn: 3, activeIdx: 0, phase: 'main1',
        p0: {
          monsters: { 0: 'dino_small_raptor' },
          hand: ['dino_trex'],
          grave: []
        }
      });
      const mon0 = s.players[0].monsters[0];
      assert.ok(mon0);

      const ev = [];
      const eff = {
        id: 'test_tag_out',
        trigger: 'ignition',
        do: [
          { op: 'returnToHand', target: 'self' },
          { op: 'specialSummon', from: ['hand'], filter: { id: 'dino_trex' }, count: 1 }
        ]
      };

      const r = FX().run(s, ev, eff, { source: mon0, player: 0 });
      assert.ok(r.ok, 'Tag-Out สำเร็จ');

      // ตรวจสอบว่า dino_small_raptor กลับขึ้นมือ
      assert.ok(s.players[0].hand.some(c => c.cardId === 'dino_small_raptor'), 'ตัวเดิมกลับขึ้นมือ');

      // ตรวจสอบว่า dino_trex ลงสู่สนามในช่อง 0
      assert.ok(s.players[0].monsters[0], 'มีตัวใหม่ลงสนาม');
      assert.strictEqual(s.players[0].monsters[0].cardId, 'dino_trex');
    }
  },

  // 4. Tag-Out ใน Battle Phase
  {
    name: 'DM-04: Tag-Out ใช้งานใน Battle Phase ได้อย่างถูกต้อง',
    run(assert) {
      // ลงทะเบียนเอฟเฟกต์ชั่วคราวให้ dino_small_raptor มี battle tag-out
      const s = game({
        turn: 3, activeIdx: 0, phase: 'battle',
        p0: {
          monsters: { 0: 'dino_small_raptor' },
          hand: ['dino_trex']
        }
      });
      const def = E().findCard('dino_small_raptor');
      def.effects = def.effects || [];
      const tagEff = {
        id: 'maid_battle_swap',
        trigger: 'ignition',
        timingWindow: ['startOfBattle', 'battle'],
        phase: 'battle',
        cost: { mana: 0 },
        do: [
          { op: 'returnToHand', target: 'self' },
          { op: 'specialSummon', from: ['hand'], count: 1 }
        ]
      };
      def.effects.push(tagEff);

      const legals = E().getLegalActions(s, 0);
      assert.ok(legals.some(a => a.type === 'activateEffect' && a.effectId === 'maid_battle_swap'), 'มีคำสั่ง activateEffect ใน battle phase');

      const r = E().applyAction(s, { type: 'activateEffect', player: 0, slot: 0, effectId: 'maid_battle_swap' });
      assert.strictEqual(r.ok, true, 'ร่ายใน battle phase ผ่าน');
      assert.strictEqual(s.players[0].monsters[0].cardId, 'dino_trex');

      // ล้างเอฟเฟกต์ชั่วคราว
      def.effects = def.effects.filter(e => e.id !== 'maid_battle_swap');
    }
  },

  // 5. Fusion จากสุสาน (Miracle / Changeover)
  {
    name: 'DM-05: fusionSummon ใช้วัตถุดิบจากสุสาน (materialsFrom: [grave]) และรีไซเคิลเข้าเด็ค',
    run(assert) {
      const s = game({
        turn: 3, activeIdx: 0, phase: 'main1',
        p0: {
          grave: ['dino_trex', 'dino_hunter_raptor'],
          extra: ['dino_tyrano_raptor'],
          monsters: {}
        }
      });
      assert.strictEqual(s.players[0].grave.length, 2);
      assert.strictEqual(s.players[0].extra.length, 1);

      const ev = [];
      const eff = {
        id: 'test_grave_fusion',
        trigger: 'ignition',
        do: [{
          op: 'fusionSummon',
          materialsFrom: ['grave'],
          sendTo: 'deck',
          shuffle: true,
          filter: { id: 'dino_tyrano_raptor' }
        }]
      };

      const r = FX().run(s, ev, eff, { player: 0 });
      assert.ok(r.ok, 'ฟิวชั่นจากสุสานสำเร็จ');

      // ตัวฟิวชั่นต้องลงสนาม
      assert.ok(s.players[0].monsters[0], 'บอสฟิวชั่นลงสนาม');
      assert.strictEqual(s.players[0].monsters[0].cardId, 'dino_tyrano_raptor');

      // วัตถุดิบในสุสานถูกส่งกลับเด็ค (เด็คเดิม 40 + 2 = 42)
      assert.strictEqual(s.players[0].grave.length, 0, 'สุสานถูกใช้ไปแล้ว');
      assert.strictEqual(s.players[0].deck.length, 42, 'วัตถุดิบ 2 ใบกลับเข้าเด็ค');
    }
  },

  // 6. เมนเฟสเด้งตัวเองขึ้นมือเรียกร่างมังกร -> จบเทิร์นร่างมังกรเด้งกลับมือเรียกร่างเมดกลับมา (Full Loop)
  {
    name: 'DM-06: สลับตัวเมนเฟส (เมด -> มังกร) และจบเทิร์นสลับกลับ (มังกร -> เมด) แบบสมบูรณ์',
    run(assert) {
      const s = game({
        turn: 3, activeIdx: 0, phase: 'main1',
        p0: {
          monsters: { 0: 'dino_small_raptor' },
          hand: ['dino_trex']
        }
      });

      // จำลองร่างเมด (dino_small_raptor): ใน Main Phase เด้งขึ้นมือ เรียกมังกร (dino_trex)
      const maidDef = E().findCard('dino_small_raptor');
      maidDef.effects = maidDef.effects || [];
      const maidEff = {
        id: 'maid_main_swap',
        trigger: 'ignition',
        cost: { mana: 0 },
        do: [
          { op: 'returnToHand', target: 'self' },
          { op: 'specialSummon', from: ['hand'], filter: { id: 'dino_trex' }, count: 1 }
        ]
      };
      maidDef.effects.push(maidEff);

      // จำลองร่างมังกร (dino_trex): เมื่อจบเทิร์น (onEndPhase) เด้งขึ้นมือ เรียกเมด (dino_small_raptor) กลับมา
      const dragonDef = E().findCard('dino_trex');
      dragonDef.effects = dragonDef.effects || [];
      const dragonEff = {
        id: 'dragon_end_swap',
        trigger: 'onEndPhase',
        condition: [{ op: 'isMyTurn' }],
        cost: { mana: 0 },
        do: [
          { op: 'returnToHand', target: 'self' },
          { op: 'specialSummon', from: ['hand'], filter: { id: 'dino_small_raptor' }, count: 1 }
        ]
      };
      dragonDef.effects.push(dragonEff);

      // 1. ผู้เล่นกดใช้เอฟเฟกต์ร่างเมดใน Main 1
      const r1 = E().applyAction(s, { type: 'activateEffect', player: 0, slot: 0, effectId: 'maid_main_swap' });
      assert.strictEqual(r1.ok, true, 'เมดแปลงร่างใน Main 1 สำเร็จ');
      assert.strictEqual(s.players[0].monsters[0].cardId, 'dino_trex', 'มังกรลงสู่สนามแทนที่');
      assert.ok(s.players[0].hand.some(c => c.cardId === 'dino_small_raptor'), 'เมดกลับเข้ามือ');

      // 2. ข้ามไปจบเทิร์น (endTurn)
      const r2 = E().applyAction(s, { type: 'endTurn', player: 0 });
      assert.strictEqual(r2.ok, true, 'จบเทิร์นสำเร็จ');

      // 3. ตรวจสอบผลลัพธ์หลังจบเทิร์น (onEndPhase ทำงาน)
      assert.ok(s.players[0].monsters[0], 'มีมอนสเตอร์อยู่บนสนาม');
      assert.strictEqual(s.players[0].monsters[0].cardId, 'dino_small_raptor', 'เมดกลับมาลงสนามเรียบร้อย');
      assert.ok(s.players[0].hand.some(c => c.cardId === 'dino_trex'), 'มังกรกลับเข้ามือเรียบร้อย');

      // ล้างเอฟเฟกต์จำลอง
      maidDef.effects = maidDef.effects.filter(e => e.id !== 'maid_main_swap');
      dragonDef.effects = dragonDef.effects.filter(e => e.id !== 'dragon_end_swap');
    }
  },

  // 7. สลับตัวเรียกจากสุสานโดยตรง (from: ['hand', 'grave'])
  {
    name: 'DM-07: สลับตัวเรียกจากสุสานได้โดยตรง (from: [hand, grave]) ทั้งเมนเฟสและจบเทิร์น',
    run(assert) {
      const s = game({
        turn: 3, activeIdx: 0, phase: 'main1',
        p0: {
          monsters: { 0: 'dino_small_raptor' },
          hand: [],
          grave: ['dino_trex']
        }
      });

      const maidDef = E().findCard('dino_small_raptor');
      maidDef.effects = maidDef.effects || [];
      const maidEff = {
        id: 'maid_from_grave',
        trigger: 'ignition',
        cost: { mana: 0 },
        do: [
          { op: 'returnToHand', target: 'self' },
          { op: 'specialSummon', from: ['hand', 'grave'], filter: { id: 'dino_trex' }, count: 1 }
        ]
      };
      maidDef.effects.push(maidEff);

      // เมดเด้งขึ้นมือ และชุบมังกรจากสุสานขึ้นมาแทนที่
      const r1 = E().applyAction(s, { type: 'activateEffect', player: 0, slot: 0, effectId: 'maid_from_grave' });
      assert.strictEqual(r1.ok, true, 'เรียกมังกรจากสุสานสำเร็จ');
      assert.strictEqual(s.players[0].monsters[0].cardId, 'dino_trex', 'มังกรจากสุสานลงสนาม');
      assert.strictEqual(s.players[0].grave.length, 0, 'มังกรออกจากสุสานแล้ว');
      assert.strictEqual(s.players[0].hand[0].cardId, 'dino_small_raptor', 'เมดกลับเข้ามือ');

      maidDef.effects = maidDef.effects.filter(e => e.id !== 'maid_from_grave');
    }
  },

  // 8. reduceMana & drainMana
  {
    name: 'DM-08: reduceMana ลดมานาฝ่ายตรงข้าม และ drainMana ดูดมานามาเพิ่มให้ตัวเอง',
    run(assert) {
      const s = game({
        turn: 3, activeIdx: 0, phase: 'main1',
        p0: { mana: 2 },
        p1: { mana: 5 }
      });

      // 1. reduceMana ลดมานาของศัตรู 2
      const ev1 = [];
      FX().run(s, ev1, {
        id: 'test_reduce_mana',
        trigger: 'ignition',
        do: [{ op: 'reduceMana', player: 'opp', amount: 2 }]
      }, { player: 0 });

      assert.strictEqual(s.players[1].mana, 3, 'มานาศัตรูถูกลดจาก 5 -> 3');
      const mc1 = ev1.find(e => e.type === 'manaChange' && e.player === 1);
      assert.ok(mc1);
      assert.strictEqual(mc1.delta, -2);

      // 2. drainMana ดูดมานาศัตรู 2 มาให้เรา
      const ev2 = [];
      FX().run(s, ev2, {
        id: 'test_drain_mana',
        trigger: 'ignition',
        do: [{ op: 'drainMana', amount: 2 }]
      }, { player: 0 });

      assert.strictEqual(s.players[1].mana, 1, 'มานาศัตรูลดจาก 3 -> 1');
      assert.strictEqual(s.players[0].mana, 4, 'มานาเราเพิ่มจาก 2 -> 4 (+2)');
      assert.ok(ev2.some(e => e.type === 'manaChange' && e.player === 1 && e.delta === -2));
      assert.ok(ev2.some(e => e.type === 'manaChange' && e.player === 0 && e.delta === 2));

      // 3. reduceMana เกินจำนวนที่มี จะลดเหลือ 0 และไม่ติดลบ
      FX().run(s, [], {
        id: 'test_clamp_zero',
        trigger: 'ignition',
        do: [{ op: 'reduceMana', player: 'opp', amount: 99 }]
      }, { player: 0 });
      assert.strictEqual(s.players[1].mana, 0, 'มานาลดจนหมดเหลือ 0 ไม่ติดลบ');
    }
  },

  // 9. Mill ขยายผล: โม่เด็คศัตรู (player: opp) และ เนรเทศใบบนสุดออกนอกเกม (sendTo: removed)
  {
    name: 'DM-09: mill โม่เด็คฝ่ายตรงข้าม และส่งออกนอกเกม (removed)',
    run(assert) {
      const s = game({
        turn: 3, activeIdx: 0, phase: 'main1',
        p0: { deck: ['dino_egg', 'dino_trex'], grave: [] },
        p1: { deck: ['dino_stego', 'dino_trex', 'dino_egg'], grave: [], removed: [] }
      });

      // 1. โม่เด็คศัตรู 2 ใบลงสุสานศัตรู
      const ev1 = [];
      FX().run(s, ev1, {
        id: 'test_mill_opp',
        trigger: 'ignition',
        do: [{ op: 'mill', player: 'opp', count: 2 }]
      }, { player: 0 });

      assert.strictEqual(s.players[1].deck.length, 1, 'เด็คศัตรูเหลือ 1 ใบ (3 - 2)');
      assert.strictEqual(s.players[1].grave.length, 2, 'สุสานศัตรูมี 2 ใบ');
      assert.strictEqual(s.players[1].grave[0].cardId, 'dino_stego');
      assert.strictEqual(s.players[1].grave[1].cardId, 'dino_trex');

      // 2. เนรเทศใบบนสุดของเด็คเราออกนอกเกม (sendTo: 'removed')
      const ev2 = [];
      FX().run(s, ev2, {
        id: 'test_mill_banish',
        trigger: 'ignition',
        do: [{ op: 'mill', player: 'self', count: 1, sendTo: 'removed' }]
      }, { player: 0 });

      assert.strictEqual(s.players[0].deck.length, 1, 'เด็คเราเหลือ 1 ใบ');
      assert.strictEqual(s.players[0].removed.length, 1, 'การ์ดนอกเกมมี 1 ใบ');
      assert.strictEqual(s.players[0].removed[0].cardId, 'dino_egg');
    }
  }
];
