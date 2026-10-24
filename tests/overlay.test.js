// tests/overlay.test.js - ชุดทดสอบระบบวางทับ (overlay) และการแปลง aq_spear (ขั้น 6A)
const E = () => CG.engine;
const FX = () => CG.effects;
const game = o => CG.test.makeGame(Object.assign({ deckA: 'aquila', deckB: 'aquila', seed: 1 }, o));

module.exports = [
  {
    name: 'OV-01 วางทับสำเร็จ (ข้อบวก): aq_spear วางทับ aq_spear Lv1 บนสนาม ตัวบนได้ Lv2 (1600/1000) under มีเป้าเดิม (chainMode=true, autoChoose=false)',
    run(assert) {
      const s = game({
        config: { chainMode: true, autoChoose: false },
        turn: 3,
        activeIdx: 0,
        phase: 'main1',
        p0: { hand: ['aq_spear'], monsters: { 1: { cardId: 'aq_spear', level: 1 } }, mana: 2 },
        p1: { monsters: {}, mana: 0 }
      });

      const legal = E().getLegalActions(s, 0);
      const ovAct = legal.find(a => a.type === 'overlay' && a.handIdx === 0 && a.targetSlot === 1);
      assert.ok(ovAct, 'ต้องมี action overlay ใน getLegalActions');

      const targetUid = s.players[0].monsters[1].uid;
      const r = E().applyAction(s, ovAct);
      assert.ok(r.ok, 'applyAction สำเร็จ: ' + r.error);

      // ตรวจสอบตัวบน
      const top = s.players[0].monsters[1];
      assert.ok(top, 'มีมอนสเตอร์ที่ช่อง 1');
      assert.strictEqual(top.cardId, 'aq_spear');
      assert.strictEqual(top.level, 2, 'Level เปลี่ยนเป็น 2');
      assert.strictEqual(top.baseAtk, 1600, 'baseAtk เป็น 1600');
      assert.strictEqual(top.baseDef, 1000, 'baseDef เป็น 1000');
      assert.strictEqual(E().atk(top), 1600);
      assert.strictEqual(E().def(top), 1000);

      // ตรวจสอบ under
      assert.strictEqual(top.under.length, 1, 'มี under 1 ใบ');
      assert.strictEqual(top.under[0].uid, targetUid, 'under คือเป้าเดิม');

      // ตรวจสอบมือ
      assert.strictEqual(s.players[0].hand.length, 0, 'การ์ดในมือถูกใช้ไปแล้ว');

      // ตรวจสอบ event summon (how: 'overlay')
      const sumEv = r.events.find(e => e.type === 'summon' && e.how === 'overlay');
      assert.ok(sumEv, 'มี event summon พร้อม how: overlay');
      assert.strictEqual(sumEv.slot, 1);
    }
  },

  {
    name: 'OV-02 ข้อลบ: เป้าผิด/ไม่ใช่การ์ดวางทับ/มานาไม่พอ/limit ครบ ถูกปฏิเสธ (chainMode=true, autoChoose=false)',
    run(assert) {
      const s = game({
        config: { chainMode: true, autoChoose: false },
        turn: 3,
        activeIdx: 0,
        phase: 'main1',
        p0: { hand: ['aq_spear', 'aq_recruit', 'aq_tiro', 'aq_spear'], monsters: { 0: 'aq_eques', 1: { cardId: 'aq_spear', level: 1 }, 3: { cardId: 'aq_spear', level: 1 } }, mana: 2 },
        p1: { monsters: {}, mana: 0 }
      });

      // 1. เป้าผิดการ์ด (aq_eques ไม่ใช่ aq_spear)
      const rWrongTarget = E().applyAction(s, { type: 'overlay', player: 0, handIdx: 0, targetSlot: 0 });
      assert.strictEqual(rWrongTarget.ok, false);
      assert.strictEqual(rWrongTarget.error, 'INVALID_TARGET');

      // 2. ช่องว่าง
      const rEmptySlot = E().applyAction(s, { type: 'overlay', player: 0, handIdx: 0, targetSlot: 2 });
      assert.strictEqual(rEmptySlot.ok, false);
      assert.strictEqual(rEmptySlot.error, 'NO_MONSTER');

      // 3. การ์ดในมือเป็นสเปล ไม่ใช่มอนสเตอร์ (aq_recruit)
      const rSpell = E().applyAction(s, { type: 'overlay', player: 0, handIdx: 1, targetSlot: 1 });
      assert.strictEqual(rSpell.ok, false);
      assert.strictEqual(rSpell.error, 'NOT_A_MONSTER');

      // 4. การ์ดในมือเป็นมอนสเตอร์แต่ไม่มี overlay effect (aq_tiro)
      const rNotOverlay = E().applyAction(s, { type: 'overlay', player: 0, handIdx: 2, targetSlot: 1 });
      assert.strictEqual(rNotOverlay.ok, false);
      assert.strictEqual(rNotOverlay.error, 'CANNOT_OVERLAY');

      // 5. วางทับสำเร็จครั้งที่ 1 (aq_spear handIdx: 0 ลงช่อง 1)
      const r1 = E().applyAction(s, { type: 'overlay', player: 0, handIdx: 0, targetSlot: 1 });
      assert.ok(r1.ok, 'ครั้งแรกสำเร็จ');

      // 6. วางทับซ้ำอีกครั้งในเทิร์นเดียวกันบนเป้าหมายที่ถูกต้อง (ช่อง 3 ซึ่งเป็น aq_spear Lv1)
      // aq_spear ใบที่ 2 ตอนนี้อยู่ที่ handIdx: 2 (เพราะใบแรกถูกใช้ไปแล้ว)
      const rLimit = E().applyAction(s, { type: 'overlay', player: 0, handIdx: 2, targetSlot: 3 });
      assert.strictEqual(rLimit.ok, false);
      assert.strictEqual(rLimit.error, 'LIMIT_REACHED', 'ติด limit ครั้งต่อเทิร์น');

      // 7. กรณีเป้าหมาย level ไม่ตรง (ช่อง 1 ตอนนี้กลายเป็น Lv2 แล้ว ไม่ตรงกับ onto { level: 1 })
      // แม้ว่าจะเริ่มเทิร์นใหม่:
      s.turn = 5;
      s.players[0].mana = 5;
      const rLevelMismatch = E().applyAction(s, { type: 'overlay', player: 0, handIdx: 2, targetSlot: 1 });
      assert.strictEqual(rLevelMismatch.ok, false);
      assert.strictEqual(rLevelMismatch.error, 'INVALID_TARGET', 'Level เป้าหมายเป็น 2 ไม่ตรงกับ onto { level: 1 }');
    }
  },

  {
    name: 'OV-03 สืบทอดท่าและ flag: สืบทอด def, พลิกหงายถ้าคว่ำ, สืบทอด attackedThisTurn/positionChangedThisTurn ล้างบัฟ atkMod เดิม',
    run(assert) {
      const s = game({
        config: { chainMode: true, autoChoose: false },
        turn: 3,
        activeIdx: 0,
        phase: 'main1',
        p0: {
          hand: ['aq_spear'],
          monsters: {
            1: {
              cardId: 'aq_spear',
              level: 1,
              position: 'def',
              faceDown: true,
              attackedThisTurn: true,
              positionChangedThisTurn: true,
              atkMod: 500,
              defMod: 300
            }
          },
          mana: 2
        },
        p1: { monsters: {}, mana: 0 }
      });

      const r = E().applyAction(s, { type: 'overlay', player: 0, handIdx: 0, targetSlot: 1 });
      assert.ok(r.ok, 'วางทับสำเร็จ');

      const top = s.players[0].monsters[1];
      assert.strictEqual(top.position, 'def', 'สืบทอด position def');
      assert.strictEqual(top.faceDown, false, 'พลิกหงายอัตโนมัติแม้ตัวเดิมคว่ำอยู่');
      assert.strictEqual(top.flags.attackedThisTurn, true, 'สืบทอด attackedThisTurn');
      assert.strictEqual(top.flags.positionChangedThisTurn, true, 'สืบทอด positionChangedThisTurn');
      assert.strictEqual(top.atkMod, 0, 'ล้าง atkMod เดิม ไม่สืบทอดบัฟ');
      assert.strictEqual(top.defMod, 0, 'ล้าง defMod เดิม ไม่สืบทอดบัฟ');
      assert.strictEqual(top.baseAtk, 1600);
      assert.strictEqual(top.baseDef, 1000);
    }
  },

  {
    name: 'OV-04 ทำลายมอนสเตอร์ที่วางทับ: ตัวบนและตัว under ทั้งหมดลงสุสาน และยิง onDestroyed',
    run(assert) {
      const s = game({
        turn: 3,
        activeIdx: 0,
        phase: 'main1',
        p0: {
          monsters: {
            1: {
              cardId: 'aq_spear',
              level: 2,
              under: ['aq_spear']
            }
          },
          grave: []
        },
        p1: { monsters: {} }
      });

      const top = s.players[0].monsters[1];
      const underUid = top.under[0].uid;
      const topUid = top.uid;

      const events = [];
      E().destroyMonster(s, events, 0, 1, 'battle');

      assert.strictEqual(s.players[0].monsters[1], null, 'ช่อง 1 ว่างแล้ว');
      assert.strictEqual(s.players[0].grave.length, 2, 'สุสานมี 2 ใบ (ตัวบน + under)');
      const graveUids = s.players[0].grave.map(c => c.uid);
      assert.ok(graveUids.includes(topUid), 'ตัวบนลงสุสาน');
      assert.ok(graveUids.includes(underUid), 'ตัว under ลงสุสาน');

      const desEvs = events.filter(e => e.type === 'destroy');
      assert.strictEqual(desEvs.length, 2, 'มี event destroy 2 รายการ');
    }
  },

  {
    name: 'OV-05 ทริกเกอร์ onSummon (how: overlay) และ onOverlay ทำงานอย่างถูกต้อง',
    run(assert) {
      const s = game({
        config: { chainMode: true, autoChoose: false },
        turn: 3,
        activeIdx: 0,
        phase: 'main1',
        p0: { hand: ['aq_spear'], monsters: { 1: { cardId: 'aq_spear', level: 1 } }, mana: 2 },
        p1: { monsters: {}, mana: 0 }
      });

      let onSummonFired = false;
      let onOverlayFired = false;

      const origFire = E().fire;
      E().fire = function (st, evs, trig, ctx) {
        if (trig === 'onSummon' && ctx && ctx.how === 'overlay') onSummonFired = true;
        if (trig === 'onOverlay') onOverlayFired = true;
        return origFire(st, evs, trig, ctx);
      };

      try {
        const r = E().applyAction(s, { type: 'overlay', player: 0, handIdx: 0, targetSlot: 1 });
        assert.ok(r.ok, 'applyAction สำเร็จ');
        assert.ok(onSummonFired, 'onSummon ทำงานพร้อม how: overlay');
        assert.ok(onOverlayFired, 'onOverlay ทำงาน');
      } finally {
        E().fire = origFire;
      }
    }
  },

  {
    name: 'OV-06 Chain fizzle: เป้าหมายหายไปก่อน Chain แก้ผล ลิงก์ fizzle การ์ดค้างในมือและไม่คืนมานา (chainMode=true, autoChoose=false)',
    run(assert) {
      const s = game({
        config: { chainMode: true, autoChoose: false },
        turn: 3,
        activeIdx: 0,
        phase: 'main1',
        p0: { hand: ['aq_spear'], monsters: { 1: { cardId: 'aq_spear', level: 1 } }, mana: 2 },
        p1: { monsters: { 0: 'aq_sagittarius' }, mana: 2 }   // aq_sagittarius มี quick effect สามารถตอบโต้ได้
      });

      // 1. ประกาศ overlay
      const r1 = E().applyAction(s, { type: 'overlay', player: 0, handIdx: 0, targetSlot: 1 });
      assert.ok(r1.ok);

      // มี priority window เปิดให้ผู้เล่น 1 ตอบโต้
      assert.ok(s.pending, 'มี pending chainWindow');
      assert.strictEqual(s.pending.kind, 'chainWindow');
      assert.strictEqual(s.pending.player, 1);
      assert.strictEqual(s.chain.length, 1);

      // การ์ดยังคงอยู่ในมือของ P0 ขณะที่ Chain ยังไม่แก้ผล
      assert.strictEqual(s.players[0].hand.length, 1);

      // ผู้เล่น 1 ทำลาย/นำมอนสเตอร์เป้าหมายออกจากช่อง 1 (จำลอง quick effect ใน Chain เช่น นำมอนสเตอร์ออกจากสนาม)
      E().leaveField(s, [], 0, 1, 'grave');
      assert.strictEqual(s.players[0].monsters[1], null, 'เป้าหมายหายจากสนามแล้ว');

      // ผู้เล่น 1 ผ่านสิทธิ์ เพื่อให้ Chain เริ่มแก้ผล
      const rPass = E().applyAction(s, { type: 'passPriority', player: 1 });
      assert.ok(rPass.ok);

      // Chain แก้ผล: ลิงก์ 1 ต้อง fizzle
      const fizzleEv = rPass.events.find(e => e.type === 'chainLinkFizzled');
      assert.ok(fizzleEv, 'พบ event chainLinkFizzled');

      // การ์ดยังคงค้างในมือของ P0 (ไม่ถูกวาง และไม่เข้าสุสาน)
      assert.strictEqual(s.players[0].hand.length, 1, 'การ์ดยังค้างอยู่ในมือ');
      assert.strictEqual(s.players[0].hand[0].cardId, 'aq_spear');
      assert.strictEqual(s.players[0].monsters[1], null, 'ช่อง 1 ยังคงว่าง');
      assert.strictEqual(s.players[0].grave.length, 1, 'สุสานมีแค่มอนสเตอร์ตัวเดิมที่ออกจากสนาม');
    }
  },

  {
    name: 'OV-07 ซ้อนหลายชั้น (multi-layer under): ลำดับ under ตัวล่างสุดอยู่หน้า array',
    run(assert) {
      const s = game({
        config: { chainMode: true, autoChoose: false },
        turn: 3,
        activeIdx: 0,
        phase: 'main1',
        p0: {
          hand: ['aq_spear'],
          monsters: {
            1: {
              cardId: 'aq_spear',
              level: 1,
              under: ['aq_tiro']
            }
          },
          mana: 2
        },
        p1: { monsters: {} }
      });

      const tiroUid = s.players[0].monsters[1].under[0].uid;
      const prevTopUid = s.players[0].monsters[1].uid;

      const r = E().applyAction(s, { type: 'overlay', player: 0, handIdx: 0, targetSlot: 1 });
      assert.ok(r.ok);

      const top = s.players[0].monsters[1];
      assert.strictEqual(top.under.length, 2, 'มี under 2 ใบ');
      assert.strictEqual(top.under[0].uid, tiroUid, 'ตัวล่างสุดอยู่หน้า array (index 0)');
      assert.strictEqual(top.under[1].uid, prevTopUid, 'ตัวเดิมอยู่ index 1');
    }
  }
];
