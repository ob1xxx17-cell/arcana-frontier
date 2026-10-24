// tests/chain.test.js - ทดสอบระบบ Chain, กฎความเร็ว, การตอบโต้, negate และหน้าต่างเหตุการณ์ (ขั้น 5B)
require('./fixtures');
const E = () => CG.engine;
const FX = () => CG.effects;
const game = (o, cfg) => CG.test.makeGame(Object.assign({ deckA: 'dinosaur', deckB: 'aquila', seed: 1 }, o, {
  config: Object.assign({ chainMode: true, autoChoose: false }, cfg)
}));

function withCustomEffects(fn) {
  const rexCard = CG.cards.dinosaur.main.find(c => c.id === 'dino_trex');
  const spearCard = CG.cards.aquila.main.find(c => c.id === 'aq_spear');
  const origRex = rexCard ? rexCard.effects : null;
  const origSpear = spearCard ? spearCard.effects : null;
  try {
    fn(rexCard, spearCard);
  } finally {
    if (rexCard && origRex) rexCard.effects = origRex;
    if (spearCard && origSpear) spearCard.effects = origSpear;
  }
}

module.exports = [
  // ---------------- 1. ลิงก์เดียวไม่มีตอบโต้ (Single link without response) ----------------
  {
    name: '5B-01 chainMode:true ลิงก์เดียวไม่มีการตอบโต้ ข้ามอัตโนมัติและแก้ผลทันที',
    run(assert) {
      // P0 มี dino_trex ใช้ roar_king (speed 1, ลด ATK ศัตรู 300)
      // P1 ไม่มีตัวตอบโต้ (ไม่มี quick / spell)
      const s = game({
        p0: { mana: 2, monsters: { 0: 'dino_trex' } },
        p1: { monsters: { 0: 'aq_spear' }, hand: [] }
      });
      const r = E().applyAction(s, { type: 'activateEffect', player: 0, slot: 0, effectId: 'roar_king' });
      assert.strictEqual(r.ok, true);
      assert.strictEqual(s.pending, null, 'ไม่มีตัวตอบโต้ต้องข้ามหน้าต่างอัตโนมัติ');
      assert.strictEqual(s.chain.length, 0, 'โซ่ต้องแก้ผลและปิดแล้ว');

      // ตรวจสอบ event sequence
      const types = r.events.map(e => e.type);
      assert.ok(types.includes('chainLinkAdded'), 'มี chainLinkAdded');
      assert.ok(types.includes('chainResolving'), 'มี chainResolving');
      assert.ok(types.includes('chainLinkResolved'), 'มี chainLinkResolved');
      assert.ok(types.includes('chainClosed'), 'มี chainClosed');

      // ตรวจสอบผลลัพธ์ของ roar_king: aq_spear โดนลด 300 ATK (800 -> 500)
      assert.strictEqual(E().atk(s.players[1].monsters[0]), 500);
    }
  },

  // ---------------- 2. ตอบโต้ 1 ชั้น 2 ชั้น 3 ชั้น และแก้ผล LIFO ----------------
  {
    name: '5B-02 ตอบโต้ 1 ชั้น 2 ชั้น 3 ชั้น แก้ผลตามลำดับหลังสุดก่อน (LIFO)',
    run(assert) {
      withCustomEffects((rexCard, spearCard) => {
        rexCard.effects = [
          { id: 'eff_p0_1', trigger: 'quick', speed: 2, cost: { mana: 1 }, do: [{ op: 'addMana', amount: 1 }] },
          { id: 'eff_p0_2', trigger: 'quick', speed: 2, cost: { mana: 1 }, do: [{ op: 'addMana', amount: 10 }] }
        ];
        spearCard.effects = [
          { id: 'eff_p1_1', trigger: 'quick', speed: 2, cost: { mana: 1 }, do: [{ op: 'addMana', amount: 2 }] },
          { id: 'eff_p1_2', trigger: 'quick', speed: 2, cost: { mana: 1 }, do: [{ op: 'addMana', amount: 20 }] }
        ];

        const s = game({
          p0: { mana: 10, monsters: { 0: 'dino_trex' } },
          p1: { mana: 10, monsters: { 0: 'aq_spear' } }
        });

        // ลิงก์ 1 (P0): eff_p0_1 (speed 2)
        E().applyAction(s, { type: 'activateEffect', player: 0, slot: 0, effectId: 'eff_p0_1' });
        assert.notStrictEqual(s.pending, null);
        assert.strictEqual(s.pending.player, 1);
        assert.strictEqual(s.chain.length, 1);

        // ลิงก์ 2 (P1): eff_p1_1 (speed 2) ตอบโต้ลิงก์ 1
        E().applyAction(s, { type: 'activateResponse', player: 1, slot: 0, effectId: 'eff_p1_1' });
        assert.notStrictEqual(s.pending, null);
        assert.strictEqual(s.pending.player, 0);
        assert.strictEqual(s.chain.length, 2);

        // ลิงก์ 3 (P0): eff_p0_2 (speed 2) ตอบโต้ลิงก์ 2
        E().applyAction(s, { type: 'activateResponse', player: 0, slot: 0, effectId: 'eff_p0_2' });
        assert.notStrictEqual(s.pending, null);
        assert.strictEqual(s.pending.player, 1);
        assert.strictEqual(s.chain.length, 3);

        // ลิงก์ 4 (P1): eff_p1_2 (speed 2) ตอบโต้ลิงก์ 3
        E().applyAction(s, { type: 'activateResponse', player: 1, slot: 0, effectId: 'eff_p1_2' });
        assert.notStrictEqual(s.pending, null);
        assert.strictEqual(s.pending.player, 0);
        assert.strictEqual(s.chain.length, 4);

        // P0 ผ่าน priority เพื่อให้โซ่เริ่มแก้ผล
        const resPass = E().applyAction(s, { type: 'passPriority', player: 0 });
        assert.strictEqual(resPass.ok, true);
        assert.strictEqual(s.pending, null, 'โซ่ปิดแล้ว');
        assert.strictEqual(s.chain.length, 0);

        // ตรวจสอบลำดับการแก้ผล LIFO: ลิงก์ 4 (P1 +20) -> ลิงก์ 3 (P0 +10) -> ลิงก์ 2 (P1 +2) -> ลิงก์ 1 (P0 +1)
        const resolvedEvents = resPass.events.filter(e => e.type === 'chainLinkResolved');
        assert.strictEqual(resolvedEvents.length, 4);
        assert.strictEqual(resolvedEvents[0].linkId, 4);
        assert.strictEqual(resolvedEvents[1].linkId, 3);
        assert.strictEqual(resolvedEvents[2].linkId, 2);
        assert.strictEqual(resolvedEvents[3].linkId, 1);
      });
    }
  },

  // ---------------- 3. กฎความเร็วทั้งทางผ่านและทางปฏิเสธ ----------------
  {
    name: '5B-03 กฎความเร็ว: ความเร็ว 1 ตอบโต้ไม่ได้, ความเร็ว < ลิงก์บนสุดปฏิเสธด้วย SPEED_TOO_LOW, ผิดลำดับ NO_PRIORITY',
    run(assert) {
      withCustomEffects((rexCard, spearCard) => {
        rexCard.effects = [
          { id: 'rex_speed2', trigger: 'quick', speed: 2, cost: { mana: 1 }, do: [{ op: 'addMana', amount: 1 }] },
          { id: 'rex_speed1', trigger: 'ignition', speed: 1, cost: { mana: 1 }, do: [{ op: 'addMana', amount: 1 }] }
        ];

        spearCard.effects = [
          { id: 'spear_speed1', trigger: 'ignition', speed: 1, cost: { mana: 1 }, do: [{ op: 'addMana', amount: 1 }] },
          { id: 'spear_speed2', trigger: 'quick', speed: 2, cost: { mana: 1 }, do: [{ op: 'addMana', amount: 1 }] },
          { id: 'spear_speed3', trigger: 'quick', speed: 3, cost: { mana: 1 }, do: [{ op: 'addMana', amount: 1 }] }
        ];

        const s = game({
          p0: { mana: 10, monsters: { 0: 'dino_trex' } },
          p1: { mana: 10, monsters: { 0: 'aq_spear' } }
        });

        // P0 เปิดลิงก์ 1 (speed 2)
        E().applyAction(s, { type: 'activateEffect', player: 0, slot: 0, effectId: 'rex_speed2' });

        // P0 พยายามตอบโต้ซ้ำขณะเป็นตาของ P1 -> NO_PRIORITY
        const rWrongPlayer = E().applyAction(s, { type: 'activateResponse', player: 0, slot: 0, effectId: 'rex_speed2' });
        assert.strictEqual(rWrongPlayer.ok, false);
        assert.strictEqual(rWrongPlayer.error, 'NO_PRIORITY');

        // P1 ใช้ความเร็ว 1 ตอบโต้ -> SPEED_TOO_LOW
        const rSpeed1 = E().applyAction(s, { type: 'activateResponse', player: 1, slot: 0, effectId: 'spear_speed1' });
        assert.strictEqual(rSpeed1.ok, false);
        assert.strictEqual(rSpeed1.error, 'SPEED_TOO_LOW');

        // P1 ตอบโต้ด้วยความเร็ว 2 (สำเร็จ)
        const rSpeed2 = E().applyAction(s, { type: 'activateResponse', player: 1, slot: 0, effectId: 'spear_speed2' });
        assert.strictEqual(rSpeed2.ok, true);

        // P0 พยายามตอบโต้ด้วยความเร็ว 1 -> SPEED_TOO_LOW
        const rP0Speed1 = E().applyAction(s, { type: 'activateResponse', player: 0, slot: 0, effectId: 'rex_speed1' });
        assert.strictEqual(rP0Speed1.ok, false);
        assert.strictEqual(rP0Speed1.error, 'SPEED_TOO_LOW');
      });
    }
  },

  // ---------------- 4. passPriority ปิดโซ่ ----------------
  {
    name: '5B-04 passPriority ปิดโซ่ทันทีและเริ่มแก้ผล LIFO',
    run(assert) {
      withCustomEffects((rexCard, spearCard) => {
        rexCard.effects = [{ id: 'rex_q', trigger: 'quick', speed: 2, cost: { mana: 1 }, do: [{ op: 'addMana', amount: 5 }] }];
        spearCard.effects = [{ id: 'spear_q', trigger: 'quick', speed: 2, cost: { mana: 1 }, do: [{ op: 'addMana', amount: 5 }] }];

        const s = game({
          p0: { mana: 10, monsters: { 0: 'dino_trex' } },
          p1: { mana: 10, monsters: { 0: 'aq_spear' } }
        });

        E().applyAction(s, { type: 'activateEffect', player: 0, slot: 0, effectId: 'rex_q' });
        assert.notStrictEqual(s.pending, null);

        // P1 ผ่าน priority
        const rPass = E().applyAction(s, { type: 'passPriority', player: 1 });
        assert.strictEqual(rPass.ok, true);
        assert.strictEqual(s.pending, null);
        assert.strictEqual(s.chain.length, 0);
        assert.ok(rPass.events.some(e => e.type === 'chainClosed'));
      });
    }
  },

  // ---------------- 5. fizzle เมื่อเป้าหมายไม่ถูกต้องแล้วตอนแก้ผล ----------------
  {
    name: '5B-05 fizzle: ถ้าเป้าหมายหายไปจากสนาม ลิงก์นั้น fizzle ทำเฉพาะส่วนที่ไม่ใช้เป้า และไม่คืนต้นทุน',
    run(assert) {
      withCustomEffects((rexCard, spearCard) => {
        rexCard.effects = [{
          id: 'rex_destroy_target',
          trigger: 'quick',
          speed: 2,
          cost: { mana: 2 },
          do: [
            { op: 'destroy', target: { side: 'opp', zone: 'monster' } },
            { op: 'addMana', amount: 1 }
          ]
        }];

        spearCard.effects = [{
          id: 'spear_escape',
          trigger: 'quick',
          speed: 2,
          cost: { mana: 1 },
          do: [
            { op: 'sendToGrave', target: 'self' },
            { op: 'addMana', amount: 2 }
          ]
        }];

        const s = game({
          p0: { mana: 5, monsters: { 0: 'dino_trex' } },
          p1: { mana: 5, monsters: { 0: 'aq_spear' } }
        });

        // P0 เปิดลิงก์ 1 เล็งเป้าที่ spear (targetSlot 0 ของ P1)
        E().applyAction(s, { type: 'activateEffect', player: 0, slot: 0, effectId: 'rex_destroy_target', targetSlot: 0 });

        // P1 ตอบโต้ด้วย spear_escape (ส่งตัวเองลงสุสาน)
        E().applyAction(s, { type: 'activateResponse', player: 1, slot: 0, effectId: 'spear_escape' });

        // P0 ผ่าน
        const rPass = E().applyAction(s, { type: 'passPriority', player: 0 });
        assert.strictEqual(rPass.ok, true);

        // spear_escape สำเร็จก่อน: spear ลงสุสานแล้ว
        assert.strictEqual(s.players[1].monsters[0], null);

        // ลิงก์ 1 ของ P0 fizzle เพราะเป้าหมายไม่อยู่ใน monster zone แล้ว
        const fizzledEvent = rPass.events.find(e => e.type === 'chainLinkFizzled');
        assert.ok(fizzledEvent, 'ต้องยิง chainLinkFizzled');
        assert.strictEqual(fizzledEvent.linkId, 1);

        // ต้นทุนมานา 2 ที่ P0 จ่ายตอนแรกไม่คืน (5 - 2 = 3)
        assert.strictEqual(s.players[0].mana, 3);
      });
    }
  },

  // ---------------- 6. negate ลบล้างลิงก์ใน Chain และการ์ดสเปลไปสุสาน ----------------
  {
    name: '5B-06 negate ลบล้างลิงก์เป้าหมายใน Chain ไม่ให้เกิดผล และการ์ดสเปลไปสุสานตามปกติ',
    run(assert) {
      withCustomEffects((rexCard, spearCard) => {
        const s = game({
          p0: { mana: 5, hand: ['fx_spell'], monsters: {} },
          p1: { mana: 5, monsters: { 0: 'aq_spear' } }
        });

        const spellCard = s.players[0].hand[0];
        const spellDef = E().cardOf(spellCard);
        spellDef.effects = [{ id: 'spell_eff', trigger: 'spell', speed: 1, cost: { mana: 1 }, do: [{ op: 'addMana', amount: 5 }] }];

        spearCard.effects = [{
          id: 'spear_negate',
          trigger: 'quick',
          speed: 2,
          cost: { mana: 2 },
          do: [{ op: 'negate', target: 'previous' }]
        }];

        // P0 ใช้สเปล (ลิงก์ 1)
        E().applyAction(s, { type: 'activateSpell', player: 0, handIdx: 0 });
        assert.strictEqual(s.chain.length, 1);

        // P1 ตอบโต้ด้วย negate (ลิงก์ 2)
        // เนื่องจาก P0 ไม่มีตัวตอบโต้ต่อ เมื่อ P1 ส่งคำสั่ง โซ่จึงเริ่มแก้ผลทันที
        const rResp = E().applyAction(s, { type: 'activateResponse', player: 1, slot: 0, effectId: 'spear_negate' });
        assert.strictEqual(rResp.ok, true);

        // ตรวจสอบ event chainLinkNegated สำหรับลิงก์ 1
        assert.ok(rResp.events.some(e => e.type === 'chainLinkNegated' && e.linkId === 1));

        // เอฟเฟกต์สเปลไม่เกิดผล: P0 ไม่ได้ +5 มานา (จ่าย 1 เหลือ 4)
        assert.strictEqual(s.players[0].mana, 4);

        // การ์ดสเปลต้องถูกส่งไปสุสานของ P0
        assert.strictEqual(s.players[0].hand.length, 0);
        assert.strictEqual(s.players[0].grave.length, 1);
        assert.strictEqual(s.players[0].grave[0].cardId, 'fx_spell');

        // มอนสเตอร์ที่ใช้เอฟเฟกต์ negate (spear) ไม่ออกจากสนาม
        assert.notStrictEqual(s.players[1].monsters[0], null);
      });
    }
  },

  // ---------------- 7. negateAttack ยกเลิกการโจมตี ----------------
  {
    name: '5B-07 negateAttack ยกเลิกการโจมตีปัจจุบัน การต่อสู้จบโดยไม่มีดาเมจ และผู้โจมตีนับว่าโจมตีแล้ว',
    run(assert) {
      withCustomEffects((rexCard, spearCard) => {
        const s = game({
          p0: { monsters: { 0: 'dino_trex' } },
          p1: { monsters: { 0: 'aq_spear' }, mana: 2 },
          phase: 'battle'
        });

        spearCard.effects = [{
          id: 'stop_attack',
          trigger: 'quick',
          speed: 2,
          window: ['attackDeclared'],
          cost: { mana: 1 },
          do: [{ op: 'negateAttack' }]
        }];

        // P0 สั่งเร็กซ์โจมตี spear
        const rAtk = E().applyAction(s, { type: 'attack', player: 0, from: 0, to: 0 });
        assert.strictEqual(rAtk.ok, true);

        // เปิด priority window ให้ P1 ตอบโต้
        assert.notStrictEqual(s.pending, null);
        assert.strictEqual(s.pending.player, 1);
        assert.strictEqual(s.pending.window, 'attackDeclared');

        // P1 ใช้ stop_attack
        const rResp = E().applyAction(s, { type: 'activateResponse', player: 1, slot: 0, effectId: 'stop_attack' });
        assert.strictEqual(rResp.ok, true);

        // ตรวจสอบ event attackNegated
        assert.ok(rResp.events.some(e => e.type === 'attackNegated'));

        // การต่อสู้จบลงโดยไม่มีความเสียหาย
        assert.strictEqual(s.battleStep, null);
        assert.strictEqual(s.attack, null);
        assert.strictEqual(s.players[1].lp, 8000, 'LP ต้องไม่ลด');
        assert.notStrictEqual(s.players[1].monsters[0], null, 'spear ต้องไม่ตาย');

        // เร็กซ์นับว่าโจมตีไปแล้วในเทิร์นนี้
        const rex = s.players[0].monsters[0];
        assert.strictEqual(rex.flags.attackedThisTurn, true);
      });
    }
  },

  // ---------------- 8. หน้าต่างเหตุการณ์ 3 ชนิดเปิดเฉพาะเมื่อมีตัวตอบโต้ ----------------
  {
    name: '5B-08 หน้าต่างเหตุการณ์ summon, flip, attackDeclared เปิดเฉพาะเมื่อมีตัวตอบโต้ที่ตรง window และข้ามเมื่อไม่มี',
    run(assert) {
      withCustomEffects((rexCard, spearCard) => {
        // (1) summon เมื่อไม่มีตัวตอบโต้ -> ข้ามอัตโนมัติ
        let s = game({
          p0: { hand: ['fx_l1a'], monsters: {} },
          p1: { monsters: {}, hand: [] }
        });
        E().applyAction(s, { type: 'normalSummon', player: 0, handIdx: 0, slot: 0 });
        assert.strictEqual(s.pending, null, 'ไม่มีตัวตอบโต้ summon ต้องไม่เปิด pending');

        // (2) summon เมื่อฝ่ายตรงข้ามมีตัวตอบโต้ window: ['summon'] -> เปิด pending
        s = game({
          p0: { hand: ['fx_l1a'], monsters: {} },
          p1: { monsters: { 0: 'aq_spear' }, mana: 2 }
        });
        spearCard.effects = [{
          id: 'anti_summon',
          trigger: 'quick',
          speed: 2,
          window: ['summon'],
          cost: { mana: 1 },
          do: [{ op: 'addMana', amount: 1 }]
        }];
        E().applyAction(s, { type: 'normalSummon', player: 0, handIdx: 0, slot: 0 });
        assert.notStrictEqual(s.pending, null, 'มีตัวตอบโต้ summon ต้องเปิด pending');
        assert.strictEqual(s.pending.player, 1);
        assert.strictEqual(s.pending.window, 'summon');

        // (3) flip เมื่อมีตัวตอบโต้ window: ['flip'] -> เปิด pending
        s = game({
          p0: { monsters: { 0: { cardId: 'fx_l1a', faceDown: true, summonedTurn: 0 } } },
          p1: { monsters: { 0: 'aq_spear' }, mana: 2 }
        });
        spearCard.effects = [{
          id: 'anti_flip',
          trigger: 'quick',
          speed: 2,
          window: ['flip'],
          cost: { mana: 1 },
          do: [{ op: 'addMana', amount: 1 }]
        }];
        E().applyAction(s, { type: 'flipSummon', player: 0, slot: 0 });
        assert.notStrictEqual(s.pending, null, 'มีตัวตอบโต้ flip ต้องเปิด pending');
        assert.strictEqual(s.pending.player, 1);
        assert.strictEqual(s.pending.window, 'flip');
      });
    }
  },

  // ---------------- 9. cloneState กลาง Chain ----------------
  {
    name: '5B-09 cloneState กลาง Chain สามารถ serialize และส่งคำสั่งบน clone ได้ผลเหมือนตัวจริง',
    run(assert) {
      withCustomEffects((rexCard, spearCard) => {
        rexCard.effects = [
          { id: 'rex_q', trigger: 'quick', speed: 2, cost: { mana: 1 }, do: [{ op: 'addMana', amount: 3 }] },
          { id: 'rex_q2', trigger: 'quick', speed: 2, cost: { mana: 1 }, do: [{ op: 'addMana', amount: 1 }] }
        ];
        spearCard.effects = [{ id: 'spear_q', trigger: 'quick', speed: 2, cost: { mana: 1 }, do: [{ op: 'addMana', amount: 7 }] }];

        const s = game({
          p0: { mana: 5, monsters: { 0: 'dino_trex' } },
          p1: { mana: 5, monsters: { 0: 'aq_spear' } }
        });

        E().applyAction(s, { type: 'activateEffect', player: 0, slot: 0, effectId: 'rex_q' });
        assert.notStrictEqual(s.pending, null);

        // clone ระหว่างเปิด chainWindow
        const clone = E().cloneState(s);
        assert.strictEqual(clone.chain.length, 1);
        assert.notStrictEqual(clone.pending, null);

        // บน clone: P1 ตอบโต้ด้วย spear_q (ลิงก์ 2)
        const rClone = E().applyAction(clone, { type: 'activateResponse', player: 1, slot: 0, effectId: 'spear_q' });
        assert.strictEqual(rClone.ok, true);
        assert.strictEqual(clone.chain.length, 2);

        // บน clone: P0 ผ่าน priority เพื่อแก้ผล
        E().applyAction(clone, { type: 'passPriority', player: 0 });
        assert.strictEqual(clone.chain.length, 0);
        assert.strictEqual(clone.players[1].mana, 5 - 1 + 7); // จ่าย 1 ได้ 7 = 11

        // ตัวจริง s ยังคงอยู่ที่เดิม (chain ยาว 1)
        assert.strictEqual(s.chain.length, 1);
        assert.notStrictEqual(s.pending, null);

        // บนตัวจริง: P1 เลือก passPriority เลย
        E().applyAction(s, { type: 'passPriority', player: 1 });
        assert.strictEqual(s.chain.length, 0);
        assert.strictEqual(s.players[0].mana, 5 - 1 + 3); // 7
        assert.strictEqual(s.players[1].mana, 5); // ไม่ได้ใช้มานา
      });
    }
  },

  // ---------------- 10. pending 5A ซ้อนใน Chain ----------------
  {
    name: '5B-10 pending จาก 5A (เลือกเป้า) ซ้อนระหว่างแก้ผล Chain หยุดรอและทำงานต่อจนจบ',
    run(assert) {
      withCustomEffects((rexCard) => {
        const s = game({
          p0: { mana: 5, monsters: { 0: 'dino_trex', 1: 'dino_small_raptor', 2: 'dino_ptero' } },
          p1: { mana: 5, monsters: {} }
        });

        rexCard.effects = [{
          id: 'rex_choose',
          trigger: 'ignition',
          speed: 1,
          cost: { mana: 1 },
          do: [
            { op: 'destroy', target: { side: 'self', zone: 'monster', other: true, count: 1, choose: 'player' } },
            { op: 'addMana', amount: 2 }
          ]
        }];

        E().applyAction(s, { type: 'activateEffect', player: 0, slot: 0, effectId: 'rex_choose' });

        // P1 ไม่มีตัวตอบโต้ โซ่เริ่มแก้ผล ลิงก์ 1 เจอ op destroy ที่มี choose: player
        assert.notStrictEqual(s.pending, null);
        assert.strictEqual(s.pending.kind, 'chooseTarget');
        assert.strictEqual(s.pending.player, 0);

        // ส่ง respond เลือก dino_ptero (index 1)
        const rResp = E().applyAction(s, { type: 'respond', player: 0, choice: [1] });
        assert.strictEqual(rResp.ok, true);
        assert.strictEqual(s.pending, null, 'pending ต้องหมด');
        assert.strictEqual(s.chain.length, 0, 'โซ่ต้องปิดสมบูรณ์');

        // dino_ptero ถูกทำลาย, dino_small_raptor ยังอยู่
        assert.notStrictEqual(s.players[0].monsters[1], null);
        assert.strictEqual(s.players[0].monsters[2], null);

        // addMana ขั้นถัดไปทำงานต่อ: 5 - 1 (cost) + 2 = 6
        assert.strictEqual(s.players[0].mana, 6);
      });
    }
  },

  // ---------------- 11. chainMode: false ได้ผลเหมือนเดิมทุกประการ ----------------
  {
    name: '5B-11 chainMode:false ทำงานทันที ไม่เปิด chain links และไม่เปิดหน้าต่างเหตุการณ์',
    run(assert) {
      withCustomEffects((rexCard) => {
        const s = CG.test.makeGame({
          deckA: 'dinosaur', deckB: 'aquila',
          config: { chainMode: false, autoChoose: true },
          p0: { mana: 5, monsters: { 0: 'dino_trex' } },
          p1: { monsters: { 0: 'aq_spear' } }
        });
        rexCard.effects = [{ id: 'rex_instant', trigger: 'ignition', speed: 1, cost: { mana: 1 }, do: [{ op: 'addMana', amount: 3 }] }];

        const r = E().applyAction(s, { type: 'activateEffect', player: 0, slot: 0, effectId: 'rex_instant' });
        assert.strictEqual(r.ok, true);
        assert.strictEqual(s.chain.length, 0);
        assert.strictEqual(s.pending, null);
        assert.strictEqual(s.players[0].mana, 5 - 1 + 3);

        // ไม่สามารถใช้ activateResponse หรือ passPriority ได้
        const rResp = E().applyAction(s, { type: 'activateResponse', player: 1 });
        assert.strictEqual(rResp.ok, false);
        const rPass = E().applyAction(s, { type: 'passPriority', player: 1 });
        assert.strictEqual(rPass.ok, false);
      });
    }
  }
];
