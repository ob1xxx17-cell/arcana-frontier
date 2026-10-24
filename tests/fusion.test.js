// tests/fusion.test.js - ชุดทดสอบระบบ Fusion Summon และการแปลงการ์ด Fusion เด็คไดโนเสาร์ (ขั้น 6B)
const E = () => CG.engine;
const FX = () => CG.effects;
const game = o => CG.test.makeGame(Object.assign({ deckA: 'dinosaur', deckB: 'dinosaur', seed: 1 }, o));

module.exports = [
  {
    name: 'FUS-01 ไทรานโนแรปเตอร์ (dino_tyrano_raptor) สำเร็จด้วย dino_trex (มือ) + dino_hunter_raptor (สนาม) และยิง onSummon (chainMode=true, autoChoose=false)',
    run(assert) {
      const s = game({
        config: { chainMode: true, autoChoose: false },
        turn: 3,
        activeIdx: 0,
        phase: 'main1',
        p0: {
          hand: ['dino_fusion', 'dino_trex'],
          monsters: { 1: 'dino_hunter_raptor' },
          extra: ['dino_tyrano_raptor'],
          mana: 5
        },
        p1: {
          monsters: { 0: 'dino_compy' },
          mana: 0
        }
      });

      const r = E().applyAction(s, { type: 'activateSpell', player: 0, handIdx: 0 });
      assert.ok(r.ok, 'เปิดใช้ dino_fusion สำเร็จ: ' + r.error);
      if (s.pending && s.pending.kind === 'chooseSlot') {
        const slot1Idx = s.pending.options.findIndex(o => o.slot === 1);
        E().applyAction(s, { type: 'respond', player: 0, choice: [slot1Idx >= 0 ? slot1Idx : 0] });
      }

      // เมื่อเรียกสำเร็จ ช่อง 1 ที่ว่างจากการส่ง hunter_raptor จะได้รับ tyrano_raptor
      const m = s.players[0].monsters[1];
      assert.ok(m, 'มีมอนสเตอร์ที่ช่อง 1');
      assert.strictEqual(m.cardId, 'dino_tyrano_raptor');
      assert.strictEqual(m.level, 3);
      assert.strictEqual(m.position, 'atk');
      assert.strictEqual(m.faceDown, false);

      // วัสดุทั้งสองใบต้องลงสุสาน
      const graveIds = s.players[0].grave.map(c => c.cardId);
      assert.ok(graveIds.includes('dino_trex'), 'dino_trex ลงสุสาน');
      assert.ok(graveIds.includes('dino_hunter_raptor'), 'dino_hunter_raptor ลงสุสาน');
      assert.ok(graveIds.includes('dino_fusion'), 'dino_fusion ลงสุสานหลังแก้ผล');

      // ตรวจสอบ event summon (how: 'fusion')
      const sumEv = s.log.find(e => e.type === 'summon' && e.how === 'fusion');
      assert.ok(sumEv, 'มี event summon พร้อม how: fusion');
      assert.strictEqual(sumEv.slot, 1);

      // ตรวจสอบ trigger onSummon (hunt_prey ของ tyrano_raptor ยิงทำลายศัตรู)
      assert.ok(s.log.some(e => e.type === 'effectActivated' && e.effectId === 'hunt_prey'), 'onSummon hunt_prey ทำงาน');
    }
  },

  {
    name: 'FUS-02 แรปเตอร์ฝูงผสาน (dino_raptor_swarm) สำเร็จด้วย raptor tag + Lv1 (คนละการ์ดกัน) และยิง onSummon (chainMode=true, autoChoose=false)',
    run(assert) {
      const s = game({
        config: { chainMode: true, autoChoose: false },
        turn: 3,
        activeIdx: 0,
        phase: 'main1',
        p0: {
          hand: ['dino_fusion', 'dino_hunter_raptor', 'dino_compy'],
          extra: ['dino_raptor_swarm'],
          deck: ['dino_small_raptor'],
          mana: 5
        },
        p1: { monsters: {}, mana: 0 }
      });

      const r = E().applyAction(s, { type: 'activateSpell', player: 0, handIdx: 0 });
      assert.ok(r.ok, 'เปิดใช้ dino_fusion สำเร็จ: ' + r.error);
      if (s.pending && s.pending.kind === 'chooseSlot') {
        const slot1Idx = s.pending.options.findIndex(o => o.slot === 1);
        E().applyAction(s, { type: 'respond', player: 0, choice: [slot1Idx >= 0 ? slot1Idx : 0] });
      }

      const m = s.players[0].monsters.find(x => x && x.cardId === 'dino_raptor_swarm');
      assert.ok(m, 'เรียก dino_raptor_swarm สำเร็จ');
      assert.strictEqual(m.level, 2);
      assert.strictEqual(m.baseAtk, 1500);
      assert.strictEqual(m.baseDef, 1000);

      // onSummon pack_summon ของแรปเตอร์ฝูงผสาน เรียก dino_small_raptor จากเด็คลงสนาม
      const small = s.players[0].monsters.find(x => x && x.cardId === 'dino_small_raptor');
      assert.ok(small, 'pack_summon เรียกแรปเตอร์เล็กจากเด็คสำเร็จ');
    }
  },

  {
    name: 'FUS-03 บราคิโอซอรัสผู้ทอดเงา (dino_brachio) สำเร็จด้วยมอนสเตอร์ไดโน Lv2 สองตัวที่ชื่อต่างกัน (dino_stego + dino_trike)',
    run(assert) {
      const s = game({
        config: { chainMode: true, autoChoose: false },
        turn: 3,
        activeIdx: 0,
        phase: 'main1',
        p0: {
          hand: ['dino_fusion', 'dino_stego', 'dino_trike'],
          extra: ['dino_brachio'],
          mana: 5
        },
        p1: { monsters: {}, mana: 0 }
      });

      const r = E().applyAction(s, { type: 'activateSpell', player: 0, handIdx: 0 });
      assert.ok(r.ok, 'เปิดใช้ dino_fusion เรียก brachio สำเร็จ: ' + r.error);
      if (s.pending && s.pending.kind === 'chooseSlot') {
        E().applyAction(s, { type: 'respond', player: 0, choice: [0] });
      }

      const m = s.players[0].monsters.find(x => x && x.cardId === 'dino_brachio');
      assert.ok(m, 'พบ dino_brachio บนสนาม');
      assert.strictEqual(m.level, 3);
      assert.strictEqual(m.baseAtk, 1800);
      assert.strictEqual(m.baseDef, 3000);
    }
  },

  {
    name: 'FUS-04 ข้อลบ: วัสดุผิด / ชื่อซ้ำ (brachio) / ไม่ครบ ถูกปฏิเสธ (chainMode=true, autoChoose=false)',
    run(assert) {
      // 1. วัสดุผิด: มี compy (Lv1) กับ trike (Lv2) แต่ Extra มีแค่ tyrano_raptor (ต้องการ trex + hunter_raptor)
      const sWrong = game({
        config: { chainMode: true, autoChoose: false },
        turn: 3,
        activeIdx: 0,
        phase: 'main1',
        p0: {
          hand: ['dino_fusion', 'dino_compy', 'dino_trike'],
          extra: ['dino_tyrano_raptor'],
          mana: 5
        }
      });
      const rWrong = E().applyAction(sWrong, { type: 'activateSpell', player: 0, handIdx: 0 });
      assert.strictEqual(rWrong.ok, false);
      assert.strictEqual(rWrong.error, 'CONDITION_FAILED', 'วัสดุผิดต้องถูกปฏิเสธ');

      // 2. ชื่อซ้ำสำหรับ brachio: มี dino_trike สองใบ (Lv2 เหมือนกันแต่ชื่อซ้ำ) Extra มีแค่ dino_brachio
      const sDup = game({
        config: { chainMode: true, autoChoose: false },
        turn: 3,
        activeIdx: 0,
        phase: 'main1',
        p0: {
          hand: ['dino_fusion', 'dino_trike', 'dino_trike'],
          extra: ['dino_brachio'],
          mana: 5
        }
      });
      const rDup = E().applyAction(sDup, { type: 'activateSpell', player: 0, handIdx: 0 });
      assert.strictEqual(rDup.ok, false);
      assert.strictEqual(rDup.error, 'CONDITION_FAILED', 'ชื่อซ้ำสำหรับ brachio ต้องถูกปฏิเสธ');

      // 3. วัสดุไม่ครบ: มี dino_trex แค่ใบเดียว ขาด hunter_raptor
      const sIncomplete = game({
        config: { chainMode: true, autoChoose: false },
        turn: 3,
        activeIdx: 0,
        phase: 'main1',
        p0: {
          hand: ['dino_fusion', 'dino_trex'],
          extra: ['dino_tyrano_raptor'],
          mana: 5
        }
      });
      const rIncomplete = E().applyAction(sIncomplete, { type: 'activateSpell', player: 0, handIdx: 0 });
      assert.strictEqual(rIncomplete.ok, false);
      assert.strictEqual(rIncomplete.error, 'CONDITION_FAILED', 'วัสดุไม่ครบต้องถูกปฏิเสธ');
    }
  },

  {
    name: 'FUS-05 วัสดุจากมือและสนามปนกัน (Mix hand and field)',
    run(assert) {
      const s = game({
        config: { chainMode: true, autoChoose: false },
        turn: 3,
        activeIdx: 0,
        phase: 'main1',
        p0: {
          hand: ['dino_fusion', 'dino_trike'],
          monsters: { 2: 'dino_stego' },
          extra: ['dino_brachio'],
          mana: 5
        },
        p1: { monsters: {}, mana: 0 }
      });

      const r = E().applyAction(s, { type: 'activateSpell', player: 0, handIdx: 0 });
      assert.ok(r.ok, 'สำเร็จ');
      if (s.pending && s.pending.kind === 'chooseSlot') {
        const slot2Idx = s.pending.options.findIndex(o => o.slot === 2);
        E().applyAction(s, { type: 'respond', player: 0, choice: [slot2Idx >= 0 ? slot2Idx : 0] });
      }

      const m = s.players[0].monsters[2];
      assert.ok(m, 'วางลงช่อง 2 ที่เพิ่งว่าง');
      assert.strictEqual(m.cardId, 'dino_brachio');
      assert.strictEqual(s.players[0].hand.length, 0);
      assert.strictEqual(s.players[0].grave.filter(c => c.cardId === 'dino_stego').length, 1);
      assert.strictEqual(s.players[0].grave.filter(c => c.cardId === 'dino_trike').length, 1);
    }
  },

  {
    name: 'FUS-06 ไม่มีช่องว่างไม่เริ่ม ไม่จ่ายต้นทุน',
    run(assert) {
      // สนามเต็ม 5 ช่องด้วยมอนสเตอร์ที่ไม่ใช่วัสดุ และวัสดุทั้งสองใบอยู่ในมือ
      const sFull = game({
        config: { chainMode: true, autoChoose: false },
        turn: 3,
        activeIdx: 0,
        phase: 'main1',
        p0: {
          hand: ['dino_fusion', 'dino_trex', 'dino_hunter_raptor'],
          monsters: { 0: 'dino_egg', 1: 'dino_egg', 2: 'dino_egg', 3: 'dino_egg', 4: 'dino_egg' },
          extra: ['dino_tyrano_raptor'],
          mana: 5
        },
        p1: { monsters: {}, mana: 0 }
      });

      const r = E().applyAction(sFull, { type: 'activateSpell', player: 0, handIdx: 0 });
      assert.strictEqual(r.ok, false);
      assert.strictEqual(r.error, 'CONDITION_FAILED', 'ไม่มีช่องว่างต้องถูกปฏิเสธ');
      assert.strictEqual(sFull.players[0].mana, 5, 'มานาไม่ถูกหัก ไม่จ่ายต้นทุน');
      assert.strictEqual(sFull.players[0].hand.length, 3, 'การ์ดในมืออยู่ครบ');

      // แต่ถ้า 1 ใน 5 ตัวบนสนามคือ hunter_raptor (เป็นวัสดุ) ช่องจะว่างจากการเอาวัสดุออก จึงใช้ได้
      sFull.players[0].monsters[2] = E().newInstance(sFull, E().findCard('dino_hunter_raptor'), 0);
      sFull.players[0].hand = [sFull.players[0].hand[0], sFull.players[0].hand[1]]; // เหลือ dino_fusion + dino_trex

      const rOk = E().applyAction(sFull, { type: 'activateSpell', player: 0, handIdx: 0 });
      assert.ok(rOk.ok, 'สำเร็จเมื่อวัสดุบนสนามช่วยเปิดช่องว่าง');
      assert.strictEqual(sFull.players[0].monsters[2].cardId, 'dino_tyrano_raptor');
    }
  },

  {
    name: 'FUS-07 ผ่าน pending เลือก Fusion และเลือกช่อง',
    run(assert) {
      // Extra มีทั้ง tyrano_raptor และ raptor_swarm
      // p0 มี trex, hunter_raptor, compy
      // เมื่อใช้ dino_fusion จะมี Fusion ที่เรียกได้มากกว่า 1 ตัว -> เปิด pending chooseCards
      const s = game({
        config: { chainMode: true, autoChoose: false },
        turn: 3,
        activeIdx: 0,
        phase: 'main1',
        p0: {
          hand: ['dino_fusion', 'dino_trex', 'dino_hunter_raptor', 'dino_compy'],
          extra: ['dino_tyrano_raptor', 'dino_raptor_swarm'],
          deck: ['dino_small_raptor'],
          mana: 5
        },
        p1: { monsters: {}, mana: 0 }
      });

      // 1. เปิดใช้ dino_fusion
      const r1 = E().applyAction(s, { type: 'activateSpell', player: 0, handIdx: 0 });
      assert.ok(r1.ok);

      // มี pending ให้เลือก Fusion Monster จาก Extra Deck
      assert.ok(s.pending, 'มี pending เกิดขึ้น');
      assert.strictEqual(s.pending.kind, 'chooseCards');
      assert.strictEqual(s.pending.options.length, 2);

      // 2. ตอบเลือกตัวเลือกที่ 1 (dino_raptor_swarm)
      const rRespFusion = E().applyAction(s, { type: 'respond', player: 0, choice: [1] });
      assert.ok(rRespFusion.ok);

      // วัสดุของ raptor_swarm (hunter_raptor + compy) ถูกนำออกไปสุสาน
      // สนามเดิมว่างเปล่า 5 ช่อง -> มีช่องว่าง 5 ช่อง -> เปิด pending chooseSlot
      assert.ok(s.pending, 'มี pending chooseSlot เกิดขึ้น');
      assert.strictEqual(s.pending.kind, 'chooseSlot');
      assert.strictEqual(s.pending.options.length, 5);

      // 3. ตอบเลือกช่อง index 3 (slot 3)
      const rRespSlot = E().applyAction(s, { type: 'respond', player: 0, choice: [3] });
      assert.ok(rRespSlot.ok);

      // ตรวจสอบว่าลงที่ช่อง 3 จริง
      assert.strictEqual(s.pending, null);
      assert.ok(s.players[0].monsters[3], 'มีตัวที่ช่อง 3');
      assert.strictEqual(s.players[0].monsters[3].cardId, 'dino_raptor_swarm');
    }
  },

  {
    name: 'FUS-08 กติกาการย้ายโซน: ถูกทำลายลงสุสาน / ถูกนำขึ้นมือกลับ Extra Deck / เป็นวัสดุเสียสละได้',
    run(assert) {
      const s = game({
        turn: 3,
        activeIdx: 0,
        phase: 'main1',
        p0: {
          hand: ['dino_trex'], // Lv3
          monsters: {
            0: 'dino_raptor_swarm', // Lv2 Fusion
            1: 'dino_egg'           // Lv1
          },
          extra: []
        },
        p1: { monsters: {} }
      });

      // 1. เป็นวัสดุเสียสละตามกติกา Level ปกติ: เสียสละ Lv2 (raptor_swarm) + Lv1 (egg) = Lv3 (trex)
      const rTrib = E().applyAction(s, {
        type: 'tributeSummon',
        player: 0,
        handIdx: 0,
        materials: [0, 1],
        slot: 2
      });
      assert.ok(rTrib.ok, 'เสียสละ Fusion สำเร็จ: ' + rTrib.error);
      assert.strictEqual(s.players[0].monsters[2].cardId, 'dino_trex');

      // 2. เมื่อถูกส่งสุสาน (จากการเสียสละ) ไปสุสานจริง ไม่กลับ Extra
      const swarmInGrave = s.players[0].grave.find(c => c.cardId === 'dino_raptor_swarm');
      assert.ok(swarmInGrave, 'raptor_swarm อยู่ในสุสาน');

      // 3. ทดสอบถูกนำขึ้นมือ (returnToHand) → กลับ Extra Deck
      // วาง brachio บนสนาม แล้วใช้ op returnToHand
      s.players[0].monsters[0] = E().newInstance(s, E().findCard('dino_brachio'), 0);
      FX().ops.returnToHand(s, [], { target: { side: 'self', zone: 'monster', filter: { cardId: 'dino_brachio' } } }, { player: 0 });

      assert.strictEqual(s.players[0].monsters[0], null, 'ออกจากสนามแล้ว');
      assert.strictEqual(s.players[0].hand.some(c => c.cardId === 'dino_brachio'), false, 'ไม่อยู่ในมือ');
      assert.strictEqual(s.players[0].extra.some(c => c.cardId === 'dino_brachio'), true, 'กลับ Extra Deck');

      // 4. ทดสอบถูกทำลาย (destroyMonster) → ลงสุสาน
      s.players[0].monsters[0] = E().newInstance(s, E().findCard('dino_brachio'), 0);
      E().destroyMonster(s, [], 0, 0, 'effect');
      assert.strictEqual(s.players[0].monsters[0], null);
      assert.strictEqual(s.players[0].grave.some(c => c.cardId === 'dino_brachio'), true, 'ถูกทำลายลงสุสาน');
    }
  },

  {
    name: 'FUS-09 วัสดุมี under พา under ไปสุสานด้วย (ไม่นับเป็นทำลาย, ยิง onSentToGrave)',
    run(assert) {
      const s = game({
        config: { chainMode: true, autoChoose: false },
        turn: 3,
        activeIdx: 0,
        phase: 'main1',
        p0: {
          hand: ['dino_fusion', 'dino_trike'],
          monsters: {
            2: {
              cardId: 'dino_stego',
              level: 2,
              under: ['dino_small_raptor'] // under card
            }
          },
          extra: ['dino_brachio'],
          grave: [],
          mana: 5
        },
        p1: { monsters: {}, mana: 0 }
      });

      let graveCount = 0;
      const origFire = E().fire;
      E().fire = function (st, evs, trig, ctx) {
        if (trig === 'onSentToGrave') graveCount++;
        return origFire(st, evs, trig, ctx);
      };

      try {
        const r = E().applyAction(s, { type: 'activateSpell', player: 0, handIdx: 0 });
        assert.ok(r.ok, 'สำเร็จ: ' + r.error);
        if (s.pending && s.pending.kind === 'chooseSlot') {
          E().applyAction(s, { type: 'respond', player: 0, choice: [0] });
        }

        // ทั้ง dino_stego (ตัวแม่), dino_small_raptor (under), และ dino_trike (จากมือ) ต้องลงสุสาน
        const graveIds = s.players[0].grave.map(c => c.cardId);
        assert.ok(graveIds.includes('dino_stego'), 'ตัวแม่ลงสุสาน');
        assert.ok(graveIds.includes('dino_small_raptor'), 'under ลงสุสาน');
        assert.ok(graveIds.includes('dino_trike'), 'วัสดุจากมือลงสุสาน');
        assert.ok(graveCount >= 3, 'onSentToGrave ยิงอย่างน้อย 3 ครั้ง');
      } finally {
        E().fire = origFire;
      }
    }
  }
];
