// tests/primitives_pending.test.js - ทดสอบระบบ pending และการโต้ตอบของผู้เล่น (ขั้น 5A)
require('./fixtures');
const E = () => CG.engine;
const FX = () => CG.effects;
const game = (o, cfg) => CG.test.makeGame(Object.assign({ deckA: 'dinosaur', deckB: 'aquila', seed: 1 }, o, {
  config: Object.assign({ autoChoose: false }, cfg)
}));

module.exports = [
  // ---------------- (ก) autoChoose: true ----------------
  {
    name: '5A-01 autoChoose:true (ค่าเริ่มต้น) ทำงานอัตโนมัติเหมือนเดิม ไม่เปิด pending',
    run(assert) {
      // dino_trex มี eat_king: ทำลายไดโนอื่น 1 ตัว (choose:"player")
      const s = CG.test.makeGame({
        deckA: 'dinosaur', deckB: 'dinosaur',
        config: { autoChoose: true },
        p0: { mana: 3, monsters: { 0: 'dino_trex', 1: 'dino_small_raptor', 2: 'dino_ptero' } }
      });
      const r = E().applyAction(s, { type: 'activateEffect', player: 0, slot: 0, effectId: 'eat_king' });
      assert.strictEqual(r.ok, true);
      assert.strictEqual(s.pending, null, 'autoChoose:true ต้องไม่เปิด pending');
      assert.strictEqual(s.players[0].monsters[1], null, 'ตัวแรก (small_raptor) ถูกเลือกอัตโนมัติ');
      assert.strictEqual(s.players[0].monsters[2].cardId, 'dino_ptero', 'ptero ยังอยู่');
      assert.strictEqual(E().atk(s.players[0].monsters[0]), 2500, 'เร็กซ์ได้ +300 ATK (ครึ่งของ 600 จาก 2200)');
    }
  },

  // ---------------- (ข) autoChoose: false เมื่อตัวเลือก <= จำนวนที่ต้องการ ----------------
  {
    name: '5A-02 autoChoose:false ถ้าตัวเลือกพอดีหรือน้อยกว่าจำนวนที่ต้องเลือก เลือกครบอัตโนมัติ ไม่เปิด pending',
    run(assert) {
      // มีไดโนอื่นแค่ 1 ตัว (small_raptor) ต้องการเลือก 1 ตัว -> ตัวเลือกพอดี
      const s = game({
        p0: { mana: 3, monsters: { 0: 'dino_trex', 1: 'dino_small_raptor' } }
      });
      const r = E().applyAction(s, { type: 'activateEffect', player: 0, slot: 0, effectId: 'eat_king' });
      assert.strictEqual(r.ok, true);
      assert.strictEqual(s.pending, null, 'ตัวเลือกพอดีไม่ต้องเปิด pending');
      assert.strictEqual(s.players[0].monsters[1], null, 'small_raptor ถูกทำลาย');
      assert.strictEqual(E().atk(s.players[0].monsters[0]), 2500);
    }
  },

  // ---------------- (ค) & (ง) & (ซ) เปิด pending, ผู้เล่นเป็น controller, respond ทำงานต่อจนจบ ไม่หักมานา/limit ซ้ำ ----------------
  {
    name: '5A-03 autoChoose:false ตัวเลือกมากกว่า เปิด pending {kind, player, prompt, options, min, max, resume}',
    run(assert) {
      const s = game({
        p0: { mana: 3, monsters: { 0: 'dino_trex', 1: 'dino_small_raptor', 2: 'dino_ptero' } }
      });
      const r = E().applyAction(s, { type: 'activateEffect', player: 0, slot: 0, effectId: 'eat_king' });
      assert.strictEqual(r.ok, true);
      assert.notStrictEqual(s.pending, null, 'ต้องเปิด pending');
      assert.strictEqual(s.pending.kind, 'chooseTarget');
      assert.strictEqual(s.pending.player, 0, 'player ต้องเป็น controller');
      assert.strictEqual(s.pending.min, 1);
      assert.strictEqual(s.pending.max, 1);
      assert.strictEqual(s.pending.options.length, 2);
      assert.strictEqual(s.pending.options[0].cardId, 'dino_small_raptor');
      assert.strictEqual(s.pending.options[1].cardId, 'dino_ptero');
      assert.ok(s.pending.resume, 'ต้องมี resume object');
      assert.strictEqual(s.pending.resume.effectId, 'eat_king');

      // มานาถูกหักไปแล้ว (3 -> 0)
      assert.strictEqual(s.players[0].mana, 0);

      // เลือกตัวที่ 1 (dino_ptero, index 1)
      const res = E().applyAction(s, { type: 'respond', player: 0, choice: [1] });
      assert.strictEqual(res.ok, true);
      assert.strictEqual(s.pending, null, 'pending ต้องถูกล้างหลัง respond');
      assert.strictEqual(s.players[0].monsters[1].cardId, 'dino_small_raptor', 'small_raptor ต้องยังอยู่');
      assert.strictEqual(s.players[0].monsters[2], null, 'ptero ถูกเลือกและทำลาย');
      // เร็กซ์เดิม 2200 + ครึ่งของ 700 = 2550
      assert.strictEqual(E().atk(s.players[0].monsters[0]), 2550);
      // ได้มานา +1 จาก requireSuccess ของ eat_king (0 + 1 = 1) และไม่ถูกหักค่าร่าย 3 ซ้ำ
      assert.strictEqual(s.players[0].mana, 1);

      // ตรวจสอบ limit: เทิร์นนี้ใช้ซ้ำไม่ได้
      s.players[0].mana = 3;
      const r2 = E().applyAction(s, { type: 'activateEffect', player: 0, slot: 0, effectId: 'eat_king' });
      assert.strictEqual(r2.ok, false);
      assert.strictEqual(r2.error, 'LIMIT_REACHED');
    }
  },

  // ---------------- (จ) การตรวจความถูกต้องของ respond และสถานะไม่เปลี่ยนเมื่อ error ----------------
  {
    name: '5A-04 respond ปฏิเสธ NOT_YOUR_PENDING และ INVALID_CHOICE โดย state ไม่เปลี่ยน',
    run(assert) {
      const s = game({
        p0: { mana: 3, monsters: { 0: 'dino_trex', 1: 'dino_small_raptor', 2: 'dino_ptero' } }
      });
      E().applyAction(s, { type: 'activateEffect', player: 0, slot: 0, effectId: 'eat_king' });

      // ผู้เล่นผิดฝั่ง (P1 ส่งแทน P0)
      const rWrongPlayer = E().applyAction(s, { type: 'respond', player: 1, choice: [0] });
      assert.strictEqual(rWrongPlayer.ok, false);
      assert.strictEqual(rWrongPlayer.error, 'NOT_YOUR_PENDING');
      assert.notStrictEqual(s.pending, null, 'pending ยังต้องอยู่');

      // choice ไม่ใช่ array
      const rNotArray = E().applyAction(s, { type: 'respond', player: 0, choice: 0 });
      assert.strictEqual(rNotArray.ok, false);
      assert.strictEqual(rNotArray.error, 'INVALID_CHOICE');

      // choice จำนวนไม่ตรง min/max (ส่งว่างเปล่า)
      const rEmpty = E().applyAction(s, { type: 'respond', player: 0, choice: [] });
      assert.strictEqual(rEmpty.ok, false);
      assert.strictEqual(rEmpty.error, 'INVALID_CHOICE');

      // choice จำนวนเกิน min/max (ส่ง 2 ตัว ทั้งที่ max = 1)
      const rTooMany = E().applyAction(s, { type: 'respond', player: 0, choice: [0, 1] });
      assert.strictEqual(rTooMany.ok, false);
      assert.strictEqual(rTooMany.error, 'INVALID_CHOICE');

      // index เกินขอบเขต options
      const rOutOfBound = E().applyAction(s, { type: 'respond', player: 0, choice: [99] });
      assert.strictEqual(rOutOfBound.ok, false);
      assert.strictEqual(rOutOfBound.error, 'INVALID_CHOICE');

      // index ซ้ำ
      const rDup = E().applyAction(s, { type: 'respond', player: 0, choice: [0, 0] });
      assert.strictEqual(rDup.ok, false);
      assert.strictEqual(rDup.error, 'INVALID_CHOICE');

      // มอนสเตอร์ทั้งสองตัวยังคงอยู่บนสนาม ไม่เสียหาย
      assert.strictEqual(s.players[0].monsters[1].cardId, 'dino_small_raptor');
      assert.strictEqual(s.players[0].monsters[2].cardId, 'dino_ptero');
    }
  },

  // ---------------- (ฉ) action อื่นระหว่างมี pending ถูกปฏิเสธด้วย PENDING_OPEN ----------------
  {
    name: '5A-05 ขณะ pending เปิดอยู่ ส่ง action อื่นจะถูกปฏิเสธด้วย PENDING_OPEN',
    run(assert) {
      const s = game({
        p0: { mana: 3, monsters: { 0: 'dino_trex', 1: 'dino_small_raptor', 2: 'dino_ptero' } }
      });
      E().applyAction(s, { type: 'activateEffect', player: 0, slot: 0, effectId: 'eat_king' });

      const rAtk = E().applyAction(s, { type: 'attack', player: 0, from: 0, to: 0 });
      assert.strictEqual(rAtk.ok, false);
      assert.strictEqual(rAtk.error, 'PENDING_OPEN');

      const rEnd = E().applyAction(s, { type: 'endTurn', player: 0 });
      assert.strictEqual(rEnd.ok, false);
      assert.strictEqual(rEnd.error, 'PENDING_OPEN');

      const rChange = E().applyAction(s, { type: 'changePosition', player: 0, slot: 1 });
      assert.strictEqual(rChange.ok, false);
      assert.strictEqual(rChange.error, 'PENDING_OPEN');
    }
  },

  // ---------------- (ช) cloneState ระหว่างมี pending ----------------
  {
    name: '5A-06 cloneState ระหว่างมี pending สามารถ serialize และ respond บน clone ได้ผลสมบูรณ์',
    run(assert) {
      const s = game({
        p0: { mana: 3, monsters: { 0: 'dino_trex', 1: 'dino_small_raptor', 2: 'dino_ptero' } }
      });
      E().applyAction(s, { type: 'activateEffect', player: 0, slot: 0, effectId: 'eat_king' });

      const clone = E().cloneState(s);
      assert.notStrictEqual(clone.pending, null);
      assert.strictEqual(clone.pending.kind, 'chooseTarget');

      // respond บน clone เลือก index 0 (small_raptor)
      const rClone = E().applyAction(clone, { type: 'respond', player: 0, choice: [0] });
      assert.strictEqual(rClone.ok, true);
      assert.strictEqual(clone.players[0].monsters[1], null, 'clone: small_raptor ถูกทำลาย');
      assert.strictEqual(clone.players[0].monsters[2].cardId, 'dino_ptero', 'clone: ptero ยังอยู่');
      assert.strictEqual(E().atk(clone.players[0].monsters[0]), 2500, 'clone: เร็กซ์ได้ +300');

      // ตัวจริง original ยังมี pending อยู่ และมอนสเตอร์ยังอยู่ครบ
      assert.notStrictEqual(s.pending, null);
      assert.strictEqual(s.players[0].monsters[1].cardId, 'dino_small_raptor');

      // respond บนตัวจริง เลือก index 1 (ptero)
      const rOrig = E().applyAction(s, { type: 'respond', player: 0, choice: [1] });
      assert.strictEqual(rOrig.ok, true);
      assert.strictEqual(s.players[0].monsters[1].cardId, 'dino_small_raptor', 'orig: small_raptor ยังอยู่');
      assert.strictEqual(s.players[0].monsters[2], null, 'orig: ptero ถูกทำลาย');
      assert.strictEqual(E().atk(s.players[0].monsters[0]), 2550, 'orig: เร็กซ์ได้ +350');
    }
  },

  // ---------------- (ฌ) pending ต่อเนื่องกันหลายขั้นใน effect เดียว ----------------
  {
    name: '5A-07 เอฟเฟกต์ที่มี pending ต่อเนื่อง 2 ขั้น เปิดทีละขั้นและทำงานจนจบ',
    run(assert) {
      const multiStepEff = {
        id: 'multi_choose',
        trigger: 'ignition',
        cost: { mana: 0 },
        do: [
          { op: 'destroy', target: { side: 'self', zone: 'monster', count: 1, choose: 'player' } },
          { op: 'modifyStat', target: { side: 'self', zone: 'monster', count: 1, choose: 'player' }, stat: 'atk', amount: 500, duration: 'permanent' }
        ]
      };

      const s = game({
        p0: { monsters: { 0: 'dino_trex', 1: 'dino_small_raptor', 2: 'dino_ptero' } }
      });
      const rex = s.players[0].monsters[0];

      // เริ่มรัน
      FX().run(s, [], multiStepEff, { source: rex, player: 0, effect: multiStepEff });

      // ขั้นที่ 1: destroy pending
      assert.notStrictEqual(s.pending, null);
      assert.strictEqual(s.pending.resume.stepIndex, 0);
      assert.strictEqual(s.pending.options.length, 3);

      // ตอบขั้น 1: ทำลาย index 1 (small_raptor)
      const r1 = E().applyAction(s, { type: 'respond', player: 0, choice: [1] });
      assert.strictEqual(r1.ok, true);
      assert.strictEqual(s.players[0].monsters[1], null, 'small_raptor ถูกทำลายแล้ว');

      // ขั้นที่ 2: modifyStat pending ทันที (เหลือ trex กับ ptero รวม 2 ตัว > want 1)
      assert.notStrictEqual(s.pending, null, 'ต้องเปิด pending ขั้นที่ 2');
      assert.strictEqual(s.pending.resume.stepIndex, 1);
      assert.strictEqual(s.pending.options.length, 2);

      // ตอบขั้น 2: เพิ่มพลังให้ index 0 (trex)
      const r2 = E().applyAction(s, { type: 'respond', player: 0, choice: [0] });
      assert.strictEqual(r2.ok, true);
      assert.strictEqual(s.pending, null, 'รันครบทุกขั้นแล้ว pending ต้องหมด');
      assert.strictEqual(E().atk(s.players[0].monsters[0]), 2700, 'เร็กซ์ได้ +500 ATK (2200 + 500)');
    }
  },

  // ---------------- (ญ-1) search op กับ choose: "player" ----------------
  {
    name: '5A-08 search op: เปิด chooseCards pending และย้ายการ์ดที่เลือกเข้ามือ',
    run(assert) {
      const searchEff = {
        id: 'search_test',
        trigger: 'ignition',
        cost: { mana: 0 },
        do: [
          { op: 'search', from: 'deck', filter: { tag: 'dino' }, count: 1, choose: 'player' }
        ]
      };
      const s = game({
        p0: {
          hand: [],
          deck: ['dino_small_raptor', 'dino_ptero', 'dino_trike']
        }
      });
      FX().run(s, [], searchEff, { player: 0, effect: searchEff });

      assert.notStrictEqual(s.pending, null);
      assert.strictEqual(s.pending.kind, 'chooseCards');
      assert.strictEqual(s.pending.options.length, 3);
      assert.strictEqual(s.pending.options[1].cardId, 'dino_ptero');

      // ตอบเลือก ptero (index 1)
      const r = E().applyAction(s, { type: 'respond', player: 0, choice: [1] });
      assert.strictEqual(r.ok, true);
      assert.strictEqual(s.pending, null);
      assert.strictEqual(s.players[0].hand.length, 1);
      assert.strictEqual(s.players[0].hand[0].cardId, 'dino_ptero');
      assert.strictEqual(s.players[0].deck.length, 2);
    }
  },

  // ---------------- (ญ-2) specialSummon op กับ choose: "player" ----------------
  {
    name: '5A-09 specialSummon op: เปิด chooseCards pending จากสุสานและเรียกมอนสเตอร์ลงสนาม',
    run(assert) {
      const summonEff = {
        id: 'ss_test',
        trigger: 'ignition',
        cost: { mana: 0 },
        do: [
          { op: 'specialSummon', from: 'grave', filter: { tag: 'dino' }, count: 1, choose: 'player' }
        ]
      };
      const s = game({
        p0: {
          grave: ['dino_small_raptor', 'dino_ptero'],
          monsters: {}
        }
      });
      FX().run(s, [], summonEff, { player: 0, effect: summonEff });

      assert.notStrictEqual(s.pending, null);
      assert.strictEqual(s.pending.kind, 'chooseCards');
      assert.strictEqual(s.pending.options.length, 2);

      // ตอบเลือก ptero (index 1)
      const r = E().applyAction(s, { type: 'respond', player: 0, choice: [1] });
      assert.strictEqual(r.ok, true);
      assert.strictEqual(s.pending, null);
      assert.strictEqual(s.players[0].monsters[0].cardId, 'dino_ptero');
      assert.strictEqual(s.players[0].grave.length, 1);
      assert.strictEqual(s.players[0].grave[0].cardId, 'dino_small_raptor');
    }
  },

  // ---------------- (ญ-3) choice op กับ chooseOption pending ----------------
  {
    name: '5A-10 choice op: เปิด chooseOption pending และรัน option ที่เลือก',
    run(assert) {
      const choiceEff = {
        id: 'choice_test',
        trigger: 'ignition',
        cost: { mana: 0 },
        do: [
          {
            op: 'choice',
            choose: 'player',
            options: [
              { name: 'opt_mana', text: 'ได้มานา +2', do: [{ op: 'addMana', amount: 2 }] },
              { name: 'opt_draw', text: 'จั่วการ์ด 1 ใบ', do: [{ op: 'draw', count: 1 }] }
            ]
          }
        ]
      };
      const s = game({
        p0: { mana: 0, hand: [], deck: ['dino_egg'] }
      });
      FX().run(s, [], choiceEff, { player: 0, effect: choiceEff });

      assert.notStrictEqual(s.pending, null);
      assert.strictEqual(s.pending.kind, 'chooseOption');
      assert.strictEqual(s.pending.options.length, 2);
      assert.strictEqual(s.pending.options[0].name, 'opt_mana');
      assert.strictEqual(s.pending.options[1].name, 'opt_draw');

      // ตอบเลือก option 1 (draw)
      const r = E().applyAction(s, { type: 'respond', player: 0, choice: [1] });
      assert.strictEqual(r.ok, true);
      assert.strictEqual(s.pending, null);
      assert.strictEqual(s.players[0].hand.length, 1, 'ได้จั่วการ์ด 1 ใบ');
      assert.strictEqual(s.players[0].hand[0].cardId, 'dino_egg');
      // จั่วการ์ด 1 ใบได้รับมานา +1 ตามกติกาจั่ว
      assert.strictEqual(s.players[0].mana, 1);
    }
  },

  // ---------------- (ญ-4) getLegalActions ระหว่างมี pending ----------------
  {
    name: '5A-11 getLegalActions เสนอเฉพาะ respond ให้ผู้เล่นที่ต้องตอบ และเสนอ [] ให้อีกฝ่าย',
    run(assert) {
      const s = game({
        p0: { mana: 3, monsters: { 0: 'dino_trex', 1: 'dino_small_raptor', 2: 'dino_ptero' } }
      });
      E().applyAction(s, { type: 'activateEffect', player: 0, slot: 0, effectId: 'eat_king' });

      assert.notStrictEqual(s.pending, null);
      assert.strictEqual(s.pending.player, 0);

      const legalP0 = E().getLegalActions(s, 0);
      assert.ok(legalP0.length > 0);
      assert.ok(legalP0.every(a => a.type === 'respond' && a.player === 0));
      // ตัวเลือก 2 ตัว เลือกลำดับ 1 ตัว = 2 combos ([0] และ [1])
      assert.strictEqual(legalP0.length, 2);
      assert.deepStrictEqual(legalP0[0].choice, [0]);
      assert.deepStrictEqual(legalP0[1].choice, [1]);

      const legalP1 = E().getLegalActions(s, 1);
      assert.strictEqual(legalP1.length, 0, 'ผู้เล่นที่ไม่ได้คุม pending ต้องได้ legal actions เป็น []');
    }
  }
];
