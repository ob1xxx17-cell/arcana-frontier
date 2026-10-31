// tests/extended_tcg_mechanics.test.js - ทดสอบ 7 ระบบ TCG เสริม (Excavate, Discard, Exile Retrieval, Silence, Piercing, Freeze, Take Control)
require('./fixtures');
const E = () => CG.engine;
const FX = () => CG.effects;
const game = (o, cfg) => CG.test.makeGame(Object.assign({ deckA: 'dinosaur', deckB: 'dinosaur', seed: 1 }, o, {
  config: Object.assign({ chainMode: true, autoChoose: true }, cfg)
}));

module.exports = [
  // 1. Excavate (ขุดดูใบบนสุดของเด็ค N ใบ)
  {
    name: 'EXT-01: excavate ขุดดูใบบนสุด 3 ใบ หยิบใบที่ตรงเงื่อนไขเข้ามือ ใบที่เหลือคืนใต้เด็ค',
    run(assert) {
      const s = game({
        turn: 3, activeIdx: 0, phase: 'main1',
        p0: {
          deck: ['dino_egg', 'dino_trex', 'dino_stego', 'dino_small_raptor'],
          hand: [],
          grave: []
        }
      });
      const ev = [];
      FX().run(s, ev, {
        id: 'test_excavate',
        trigger: 'ignition',
        do: [{
          op: 'excavate',
          count: 3,
          pick: 1,
          filter: { id: 'dino_trex' },
          to: 'hand',
          restTo: 'deckBottom'
        }]
      }, { player: 0 });

      // dino_trex ถูกหยิบเข้ามือ
      assert.strictEqual(s.players[0].hand.length, 1, 'มีการ์ดขึ้นมือ 1 ใบ');
      assert.strictEqual(s.players[0].hand[0].cardId, 'dino_trex', 'การ์ดในมือคือ dino_trex');

      // อีก 2 ใบ (dino_egg, dino_stego) กลับไปอยู่ใต้เด็ค ต่อจาก dino_small_raptor
      assert.strictEqual(s.players[0].deck.length, 3, 'เด็คเหลือ 3 ใบ (4 - 1)');
      assert.strictEqual(s.players[0].deck[0].cardId, 'dino_small_raptor', 'ใบบนสุดของเด็คคือ dino_small_raptor');
      assert.strictEqual(s.players[0].deck[1].cardId, 'dino_egg');
      assert.strictEqual(s.players[0].deck[2].cardId, 'dino_stego');
    }
  },

  // 2. Excavate พร้อมส่งใบที่เหลือลงสุสาน (restTo: grave)
  {
    name: 'EXT-02: excavate ส่งใบที่ไม่ถูกเลือกทิ้งลงสุสาน (restTo: grave)',
    run(assert) {
      const s = game({
        turn: 3, activeIdx: 0, phase: 'main1',
        p0: {
          deck: ['dino_egg', 'dino_trex', 'dino_stego'],
          hand: [],
          grave: []
        }
      });
      const ev = [];
      FX().run(s, ev, {
        id: 'test_excavate_grave',
        trigger: 'ignition',
        do: [{
          op: 'excavate',
          count: 3,
          pick: 1,
          filter: { id: 'dino_stego' },
          to: 'hand',
          restTo: 'grave'
        }]
      }, { player: 0 });

      assert.strictEqual(s.players[0].hand.length, 1);
      assert.strictEqual(s.players[0].hand[0].cardId, 'dino_stego');
      assert.strictEqual(s.players[0].grave.length, 2, '2 ใบที่เหลือลงสุสาน');
      assert.strictEqual(s.players[0].deck.length, 0, 'เด็คถูกขุดจนหมด');
    }
  },

  // 3. Discard (ทิ้งการ์ดบนมือ)
  {
    name: 'EXT-03: discard สั่งทิ้งการ์ดบนมือศัตรูลงสุสาน และทิ้งลงนอกเกม (removed)',
    run(assert) {
      const s = game({
        turn: 3, activeIdx: 0, phase: 'main1',
        p1: {
          hand: ['dino_egg', 'dino_trex'],
          grave: [],
          removed: []
        }
      });

      // 1. สั่งศัตรูทิ้งการ์ด 1 ใบลงสุสาน
      FX().run(s, [], {
        id: 'test_discard_opp',
        trigger: 'ignition',
        do: [{ op: 'discard', player: 'opp', count: 1, mode: 'first', sendTo: 'grave' }]
      }, { player: 0 });

      assert.strictEqual(s.players[1].hand.length, 1, 'ศัตรูเหลือการ์ดบนมือ 1 ใบ');
      assert.strictEqual(s.players[1].grave.length, 1, 'การ์ดที่ถูกทิ้งไปสุสาน');

      // 2. ทิ้งอีกใบออกนอกเกม (sendTo: removed)
      FX().run(s, [], {
        id: 'test_discard_banish',
        trigger: 'ignition',
        do: [{ op: 'discard', player: 'opp', count: 1, sendTo: 'removed' }]
      }, { player: 0 });

      assert.strictEqual(s.players[1].hand.length, 0, 'ศัตรูไม่มีการ์ดบนมือแล้ว');
      assert.strictEqual(s.players[1].removed.length, 1, 'การ์ดไปอยู่นอกเกม');
    }
  },

  // 4. Exile Retrieval (ดึงการ์ดนอกเกมกลับมา)
  {
    name: 'EXT-04: returnToGrave ดึงการ์ดนอกเกม (removed) กลับสู่สุสานหรือขึ้นมือ',
    run(assert) {
      const s = game({
        turn: 3, activeIdx: 0, phase: 'main1',
        p0: {
          removed: ['dino_trex', 'dino_egg'],
          grave: [],
          hand: []
        }
      });

      // 1. ดึง dino_trex จากนอกเกมกลับสุสาน
      FX().run(s, [], {
        id: 'test_ret_grave',
        trigger: 'ignition',
        do: [{
          op: 'returnToGrave',
          target: { side: 'self', zone: 'removed', filter: { id: 'dino_trex' }, count: 1 }
        }]
      }, { player: 0 });

      assert.strictEqual(s.players[0].grave.length, 1, 'เข้าสุสาน 1 ใบ');
      assert.strictEqual(s.players[0].grave[0].cardId, 'dino_trex');
      assert.strictEqual(s.players[0].removed.length, 1, 'นอกเกมเหลือ 1 ใบ');

      // 2. ดึง dino_egg จากนอกเกมขึ้นมือ
      FX().run(s, [], {
        id: 'test_ret_hand',
        trigger: 'ignition',
        do: [{
          op: 'returnToHand',
          target: { side: 'self', zone: 'removed', filter: { id: 'dino_egg' }, count: 1 }
        }]
      }, { player: 0 });

      assert.strictEqual(s.players[0].hand.length, 1, 'ขึ้นมือ 1 ใบ');
      assert.strictEqual(s.players[0].hand[0].cardId, 'dino_egg');
      assert.strictEqual(s.players[0].removed.length, 0, 'นอกเกมหมด');
    }
  },

  // 5. Silence / Negate Monster Effect (ใบ้เอฟเฟกต์มอนสเตอร์)
  {
    name: 'EXT-05: silence ใบ้เอฟเฟกต์มอนสเตอร์เป้าหมาย ทำให้ใช้เอฟเฟกต์ไม่ได้ และหายเมื่อจบเทิร์น',
    run(assert) {
      const s = game({
        turn: 3, activeIdx: 0, phase: 'main1',
        p0: {
          monsters: { 0: 'dino_anky' },
          deck: ['dino_trike'],
          mana: 3
        }
      });
      const mon = s.players[0].monsters[0];
      assert.ok(mon);

      // ก่อนโดนใบ้: validateActivateEffect ผ่าน
      const valBefore = E().validateActivateEffect(s, { type: 'activateEffect', player: 0, slot: 0, effectId: 'swap' });
      assert.strictEqual(valBefore, null, 'ก่อนใบ้ ใช้เอฟเฟกต์ได้');

      // ใบ้ตัวนี้ (duration: endTurn)
      FX().run(s, [], {
        id: 'test_silence',
        trigger: 'ignition',
        do: [{ op: 'silence', target: 'self', duration: 'endTurn' }]
      }, { source: mon, player: 0 });

      assert.strictEqual(mon.silenced, true);
      assert.strictEqual(mon.negated, true);

      // หลังโดนใบ้: validateActivateEffect ต้องปฏิเสธ
      const valAfter = E().validateActivateEffect(s, { type: 'activateEffect', player: 0, slot: 0, effectId: 'swap' });
      assert.strictEqual(valAfter, 'EFFECT_NEGATED', 'หลังโดนใบ้ ต้องติด EFFECT_NEGATED');

      // จบเทิร์น: สถานะใบ้ต้องหลุด
      E().finishTurn(s, []);
      assert.strictEqual(mon.silenced, false, 'จบเทิร์นแล้วหลุดใบ้');
      assert.strictEqual(mon.negated, false);
    }
  },

  // 6. Piercing Battle Damage (ดาเมจเจาะเกราะ)
  {
    name: 'EXT-06: Piercing Battle Damage โจมตีมอนสเตอร์ DEF แล้วทะลุเข้า LP',
    run(assert) {
      // dino_trex (ATK 2200) vs dino_egg (DEF 1000)
      const s = game({
        turn: 3, activeIdx: 0, phase: 'battle',
        p0: { monsters: { 0: 'dino_trex' } },
        p1: { monsters: { 0: 'dino_egg' }, lp: 4000 }
      }, { chainMode: false });
      const attacker = s.players[0].monsters[0];
      const defender = s.players[1].monsters[0];
      defender.position = 'def';
      attacker.piercing = true; // เปิดเจาะเกราะ

      // ประกาศโจมตี
      const r = E().applyAction(s, { type: 'attack', player: 0, from: 0, to: 0 });
      assert.ok(r.ok, 'โจมตีสำเร็จ');

      // dino_egg ถูกทำลาย
      assert.strictEqual(s.players[1].monsters[0], null, 'ตัวป้องกันถูกทำลาย');

      // ดาเมจทะลุเจาะเกราะ: 2200 - 1000 = 1200 ดาเมจ
      // LP ศัตรู: 4000 - 1200 = 2800
      assert.strictEqual(s.players[1].lp, 2800, 'LP ฝ่ายตรงข้ามโดนดาเมจทะลุเกราะ 1200 เหลือ 2800');
    }
  },

  // 7. Freeze / Cannot Attack / Cannot Change Position (แช่แข็ง)
  {
    name: 'EXT-07: freeze ล็อกมอนสเตอร์ห้ามโจมตีและห้ามเปลี่ยนท่าต่อสู้',
    run(assert) {
      const s = game({
        turn: 3, activeIdx: 0, phase: 'main1',
        p0: { monsters: { 0: 'dino_trex' } }
      });
      const mon = s.players[0].monsters[0];

      // แช่แข็ง
      FX().run(s, [], {
        id: 'test_freeze',
        trigger: 'ignition',
        do: [{ op: 'freeze', target: 'self', duration: 'endTurn' }]
      }, { source: mon, player: 0 });

      assert.strictEqual(mon.frozen, true);

      // ลองเปลี่ยนท่าต่อสู้
      const posErr = E().validateChangePosition(s, { type: 'changePosition', player: 0, slot: 0 });
      assert.strictEqual(posErr, 'CANNOT_CHANGE_POSITION', 'เปลี่ยนท่าไม่ได้');

      // ลองโจมตี
      s.phase = 'battle';
      const atkErr = E().validateAttack(s, { type: 'attack', player: 0, from: 0, to: null });
      assert.strictEqual(atkErr, 'CANNOT_ATTACK', 'โจมตีไม่ได้');

      // จบเทิร์น หลุดแช่แข็ง
      E().finishTurn(s, []);
      assert.strictEqual(mon.frozen, false, 'จบเทิร์นแล้วหลุดแช่แข็ง');
    }
  },

  // 8. Take Control (ยึดบอร์ดชั่วคราว)
  {
    name: 'EXT-08: takeControl ยึดมอนสเตอร์ศัตรูมาฝั่งเราชั่วคราว และคืนเมื่อจบเทิร์น',
    run(assert) {
      const s = game({
        turn: 3, activeIdx: 0, phase: 'main1',
        p0: { monsters: {} },
        p1: { monsters: { 0: 'dino_trex' } }
      });

      // ผู้เล่น 0 สั่งยึดบอร์ดตัวช่อง 0 ของศัตรู
      const ev = [];
      FX().run(s, ev, {
        id: 'test_take_control',
        trigger: 'ignition',
        do: [{
          op: 'takeControl',
          target: { side: 'opp', zone: 'monster', slot: 0 },
          duration: 'endTurn'
        }]
      }, { player: 0 });

      // ตรวจสอบว่ามอนสเตอร์ย้ายมาฝั่งผู้เล่น 0 ช่อง 0
      assert.strictEqual(s.players[1].monsters[0], null, 'ช่องของศัตรูว่าง');
      assert.ok(s.players[0].monsters[0], 'ผู้เล่น 0 ได้ตัวมาคุม');
      assert.strictEqual(s.players[0].monsters[0].cardId, 'dino_trex');
      assert.strictEqual(s.players[0].monsters[0].controller, 0);

      // เมื่อจบเทิร์น (finishTurn) ตัวต้องคืนกลับไปฝั่งผู้เล่น 1 ช่อง 0
      E().finishTurn(s, []);
      assert.strictEqual(s.players[0].monsters[0], null, 'ฝั่งผู้เล่น 0 คืนตัวไปแล้ว');
      assert.ok(s.players[1].monsters[0], 'ผู้เล่น 1 ได้ตัวกลับคืนมา');
      assert.strictEqual(s.players[1].monsters[0].cardId, 'dino_trex');
      assert.strictEqual(s.players[1].monsters[0].controller, 1);
    }
  }
];
