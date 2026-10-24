// tests/primitives_dino.test.js - เทสต์ชิ้นส่วนใหม่ขั้น 4E-2C-1:
// 1. ค่าตามสัดส่วน (proportional/dynamic value)
// 2. op changePosition
// 3. op extraAttack
// 4. op restrictAttack
require('./fixtures');
const E = () => CG.engine;
const FX = () => CG.effects;
const game = o => CG.test.makeGame(Object.assign({ deckA: 'dinosaur', deckB: 'dinosaur', seed: 1 }, o));
const atk = m => E().atk(m);
const def = m => E().def(m);
const mon = (s, p, slot) => s.players[p].monsters[slot];

module.exports = [
  // ---------------- 1. ค่าตามสัดส่วน ----------------
  { name: 'D4C-01 ค่าตามสัดส่วน (+) modifyStat: +200 ATK ต่อไดโน 1 ใบในสุสาน และ base โบนัส', run(assert) {
    const s = game({
      p0: {
        monsters: { 0: 'dino_small_raptor' },
        grave: ['dino_small_raptor', 'dino_egg', 'fx_l1a']  // ไดโน 2 ใบ, ไม่ใช่ไดโน 1 ใบ
      }
    });
    const m = mon(s, 0, 0);
    const startAtk = atk(m);
    // +200 ต่อไดโนในสุสาน (2 ใบ = +400)
    FX().ops.modifyStat(s, [], {
      target: 'self', stat: 'atk', duration: 'permanent',
      amount: { zone: 'grave', filter: { tag: 'dino' }, multiplier: 200 }
    }, { player: 0, source: m });
    assert.strictEqual(atk(m), startAtk + 400, '2 ไดโนในสุสาน x 200 = +400 ATK');

    // ทดสอบ format perCard + base
    FX().ops.modifyStat(s, [], {
      target: 'self', stat: 'atk', duration: 'permanent',
      base: 100, multiplier: 50, perCard: { zone: 'grave', filter: { tag: 'dino' } }
    }, { player: 0, source: m });
    assert.strictEqual(atk(m), startAtk + 400 + (100 + 2 * 50), 'base 100 + 2x50 = +200 ATK');
  } },

  { name: 'D4C-02 ค่าตามสัดส่วน (+) damage & heal: คำนวณจากจำนวนมอนสเตอร์ในสนามและสุสาน', run(assert) {
    const s = game({
      p0: { lp: 5000, monsters: { 0: 'dino_small_raptor', 1: 'dino_egg' } },
      p1: { lp: 8000, monsters: { 0: 'dino_trike', 1: 'dino_ptero' } }
    });
    // damage ศัตรู 300 ต่อมอนสเตอร์ฝั่งเรา (2 ตัว = 600)
    FX().ops.damage(s, [], {
      player: 'opp',
      amount: { side: 'self', zone: 'monster', multiplier: 300 }
    }, { player: 0 });
    assert.strictEqual(s.players[1].lp, 7400, 'โดนดาเมจ 600');

    // heal ตัวเอง 250 ต่อมอนสเตอร์ทุกตัวบนสนามทั้งสองฝ่าย (4 ตัว = 1000)
    FX().ops.heal(s, [], {
      player: 'self',
      amount: { side: 'both', zone: 'monster', multiplier: 250 }
    }, { player: 0 });
    assert.strictEqual(s.players[0].lp, 6000, 'ฮีล 1000');
  } },

  { name: 'D4C-03 ค่าตามสัดส่วน (-): 0 ใบที่ตรงตัวกรอง = ค่าไม่เปลี่ยน, การ์ดของศัตรูไม่นับเมื่อ side: self', run(assert) {
    const s = game({
      p0: { lp: 8000, monsters: { 0: 'dino_small_raptor' }, grave: [] },
      p1: { lp: 8000, monsters: { 0: 'dino_trike' }, grave: ['dino_small_raptor', 'dino_egg'] }
    });
    const m = mon(s, 0, 0);
    const startAtk = atk(m);
    // สุสานฝั่งเราว่าง แต่ศัตรูมี 2 ใบ
    FX().ops.modifyStat(s, [], {
      target: 'self', stat: 'atk', duration: 'permanent',
      amount: { side: 'self', zone: 'grave', filter: { tag: 'dino' }, multiplier: 500 }
    }, { player: 0, source: m });
    assert.strictEqual(atk(m), startAtk, 'สุสานฝั่งเราไม่มีไดโน ATK ต้องไม่เพิ่ม');

    // damage ด้วย filter ที่ไม่มีใครตรง
    FX().ops.damage(s, [], {
      player: 'opp',
      amount: { zone: 'monster', filter: { tag: 'non_existent_tag' }, multiplier: 1000 }
    }, { player: 0 });
    assert.strictEqual(s.players[1].lp, 8000, 'ไม่มีการ์ดตรงตัวกรอง LP ศัตรูไม่ลด');
  } },

  { name: 'D4C-04 ค่าตามสัดส่วน continuous aura (+/-): ปรับตามจำนวนการ์ดแบบไดนามิกและหายเมื่อเงื่อนไขเปลี่ยน', run(assert) {
    const s = game({
      p0: {
        monsters: { 0: 'dino_small_raptor', 1: 'dino_egg' },
        grave: ['dino_small_raptor']
      }
    });
    // จำลองการ์ดที่มี continuous aura คำนวณจากไดโนในสุสาน
    const auraDef = {
      id: 'dino_aura_test', name: 'aura_test', type: 'monster', level: 1, atk: 1000, def: 1000, mana: '0',
      effects: [{
        id: 'grave_boost', trigger: 'continuous', speed: 1, cost: { mana: 0 },
        do: [{
          op: 'modifyStat', aura: true, stat: 'atk', target: 'self',
          amount: { zone: 'grave', filter: { tag: 'dino' }, multiplier: 300 }
        }]
      }]
    };
    CG.cards.fixture.main.push(auraDef);
    try {
      s.players[0].monsters[2] = E().newInstance(s, auraDef, 0);
      FX().refreshAuras(s);
      assert.strictEqual(atk(mon(s, 0, 2)), 1300, 'ไดโนในสุสาน 1 ใบ = +300');

      // เพิ่มไดโนในสุสาน
      s.players[0].grave.push(E().newInstance(s, E().findCard('dino_egg'), 0));
      FX().refreshAuras(s);
      assert.strictEqual(atk(mon(s, 0, 2)), 1600, 'ไดโนในสุสาน 2 ใบ = +600');

      // ล้างสุสาน
      s.players[0].grave = [];
      FX().refreshAuras(s);
      assert.strictEqual(atk(mon(s, 0, 2)), 1000, 'สุสานว่าง โบนัส aura เป็น 0');
    } finally {
      CG.cards.fixture.main.pop();
    }
  } },

  // ---------------- 2. op changePosition ----------------
  { name: 'D4C-05 changePosition (+): เปลี่ยน atk -> def, สลับท่า, และเปลี่ยนคว่ำ def -> หงาย atk ยิง onFlip', run(assert) {
    const flipDef = {
      id: 'dino_flip_test', name: 'flip_test', type: 'monster', level: 1, atk: 500, def: 500, mana: '0',
      effects: [{ id: 'flip_fx', trigger: 'onFlip', speed: 1, cost: { mana: 0 }, do: [{ op: 'addMana', amount: 1 }] }]
    };
    CG.cards.fixture.main.push(flipDef);
    try {
      const s = game({
        p0: {
          monsters: {
            0: 'dino_small_raptor'
          }
        }
      });
      const m0 = mon(s, 0, 0);
      assert.strictEqual(m0.position, 'atk');
      // เปลี่ยน m0 เป็น def
      FX().ops.changePosition(s, [], { target: 'self', position: 'def' }, { player: 0, source: m0 });
      assert.strictEqual(m0.position, 'def');

      // สลับท่า toggle m0 กลับเป็น atk
      FX().ops.changePosition(s, [], { target: 'self', position: 'toggle' }, { player: 0, source: m0 });
      assert.strictEqual(m0.position, 'atk');

      // m1 คว่ำอยู่ท่า def เปลี่ยนเป็น atk ต้องหงายและยิง onFlip
      s.players[0].monsters[1] = E().newInstance(s, flipDef, 0);
      const m1 = mon(s, 0, 1);
      m1.position = 'def';
      m1.faceDown = true;
      const ev = [];
      FX().ops.changePosition(s, ev, {
        target: { side: 'self', zone: 'monster', filter: { cardId: 'dino_flip_test' } },
        position: 'atk'
      }, { player: 0, source: m0 });
      assert.strictEqual(m1.position, 'atk');
      assert.strictEqual(m1.faceDown, false);
      assert.ok(ev.some(e => e.type === 'positionChange' && e.uid === m1.uid && e.position === 'atk' && e.faceDown === false));
      assert.ok(ev.some(e => e.type === 'effectActivated' && e.trigger === 'onFlip' && e.uid === m1.uid), 'ยิง onFlip สำเร็จ');
    } finally {
      CG.cards.fixture.main.pop();
    }
  } },

  { name: 'D4C-06 changePosition (-): ท่าเดิมไม่สร้าง event ซ้ำ, ไม่พังเมื่อเป้าหมายไม่อยู่', run(assert) {
    const s = game({ p0: { monsters: { 0: 'dino_small_raptor' } } });
    const m = mon(s, 0, 0);
    const ev = [];
    // เปลี่ยนเป็น atk ทั้งที่อยู่ atk อยู่แล้ว
    FX().ops.changePosition(s, ev, { target: 'self', position: 'atk' }, { player: 0, source: m });
    assert.strictEqual(ev.length, 0, 'ท่าเดิมต้องไม่ยิง positionChange event');
    assert.strictEqual(m.position, 'atk');

    // สั่งเป้าหมายที่ไม่มีตัวตน
    FX().ops.changePosition(s, ev, { target: { side: 'opp', zone: 'monster' }, position: 'def' }, { player: 0, source: m });
    assert.strictEqual(ev.length, 0);
  } },

  // ---------------- 3. op extraAttack ----------------
  { name: 'D4C-07 extraAttack (+): มอนสเตอร์โจมตีได้เพิ่มในเทิร์นนั้น และรองรับการให้สิทธิ์หลังโจมตีไปแล้ว', run(assert) {
    const s = game({
      phase: 'battle', turn: 3,
      p0: { monsters: { 0: 'dino_small_raptor' } },
      p1: { monsters: { 0: 'dino_egg', 1: 'dino_egg' } }
    });
    const m = mon(s, 0, 0);
    // ให้ extraAttack 1 ครั้ง
    FX().ops.extraAttack(s, [], { target: 'self', count: 1 }, { player: 0, source: m });

    // โจมตีครั้งที่ 1
    let r1 = E().applyAction(s, { type: 'attack', player: 0, from: 0, to: 0 });
    assert.ok(r1.ok, r1.error);
    assert.strictEqual(m.flags.attackedThisTurn, false, 'ยังโจมตีได้อีกครั้ง attackedThisTurn ยังไม่เป็น true');

    // เช็คว่า getLegalActions ยังมี action โจมตีสำหรับมอนสเตอร์ตัวนี้
    const legals = E().getLegalActions(s, 0);
    assert.ok(legals.some(a => a.type === 'attack' && a.from === 0 && a.to === 1), 'มี action โจมตีครั้งที่ 2');

    // โจมตีครั้งที่ 2
    let r2 = E().applyAction(s, { type: 'attack', player: 0, from: 0, to: 1 });
    assert.ok(r2.ok, r2.error);
    assert.strictEqual(m.flags.attackedThisTurn, true, 'โจมตีครบแล้ว attackedThisTurn ต้องเป็น true');

    // มอนสเตอร์โจมตีไปแล้ว ได้รับ extraAttack อีก 1 ครั้งหลังโจมตีเสร็จ
    FX().ops.extraAttack(s, [], { target: 'self', count: 1 }, { player: 0, source: m });
    assert.strictEqual(m.flags.attackedThisTurn, false, 'ได้รับสิทธิ์เพิ่ม attackedThisTurn ถูกปลดเป็น false');
    // โจมตีตรงครั้งที่ 3 (ศัตรูไม่มีมอนสเตอร์แล้ว)
    let r3 = E().applyAction(s, { type: 'attack', player: 0, from: 0, to: null });
    assert.ok(r3.ok, r3.error);
  } },

  { name: 'D4C-08 extraAttack (-): มอนสเตอร์ทั่วไปตีได้ครั้งเดียว, เกินโควตา extra โดนปฏิเสธ, canAttack: false ตีไม่ได้, ไม่ข้ามไปเทิร์นหน้า', run(assert) {
    const s = game({
      phase: 'battle', turn: 3,
      p0: { monsters: { 0: 'dino_small_raptor' } },
      p1: { monsters: { 0: 'dino_egg', 1: 'dino_egg', 2: 'dino_egg' } }
    });
    const m = mon(s, 0, 0);
    // ไม่มี extraAttack: ตีครั้งที่ 1 ผ่าน ตีครั้งที่ 2 ALREADY_ATTACKED
    assert.ok(E().applyAction(s, { type: 'attack', player: 0, from: 0, to: 0 }).ok);
    const fail1 = E().applyAction(s, { type: 'attack', player: 0, from: 0, to: 1 });
    assert.strictEqual(fail1.ok, false);
    assert.strictEqual(fail1.error, 'ALREADY_ATTACKED');

    // ให้ extraAttack 1 ครั้ง แล้วตีครั้งที่ 2 ผ่าน ตีครั้งที่ 3 ต้อง ALREADY_ATTACKED
    FX().ops.extraAttack(s, [], { target: 'self', count: 1 }, { player: 0, source: m });
    assert.ok(E().applyAction(s, { type: 'attack', player: 0, from: 0, to: 1 }).ok);
    const fail2 = E().applyAction(s, { type: 'attack', player: 0, from: 0, to: 2 });
    assert.strictEqual(fail2.ok, false);
    assert.strictEqual(fail2.error, 'ALREADY_ATTACKED');

    // canAttack: false
    m.flags.canAttack = false;
    FX().ops.extraAttack(s, [], { target: 'self', count: 5 }, { player: 0, source: m });
    const fail3 = E().applyAction(s, { type: 'attack', player: 0, from: 0, to: 2 });
    assert.strictEqual(fail3.ok, false);
    assert.strictEqual(fail3.error, 'CANNOT_ATTACK');

    // เทิร์นถัดไป (turn 5) โควตา extraAttacks จาก turn 3 ต้องไม่ตามมา
    s.turn = 5;
    m.flags.canAttack = true;
    m.flags.attackedThisTurn = false;
    delete m.attacksTurn;
    delete m.attacksThisTurn;
    assert.ok(E().applyAction(s, { type: 'attack', player: 0, from: 0, to: 2 }).ok);
    assert.strictEqual(E().applyAction(s, { type: 'attack', player: 0, from: 0, to: null }).error, 'ALREADY_ATTACKED');
  } },

  // ---------------- 4. op restrictAttack ----------------
  { name: 'D4C-09 restrictAttack (+): ศัตรูต้องตีตัวที่ติด restrictAttack ก่อน, ห้ามตีตัวอื่นหรือตีตรง, ถ้ามี 2 ตัวเลือกได้', run(assert) {
    const s = game({
      phase: 'battle', turn: 3,
      p0: { monsters: { 0: 'dino_trike' } },
      p1: { monsters: { 0: 'dino_small_raptor', 1: 'dino_egg' } }
    });
    // p1 ช่อง 1 (ไข่ไดโน) ติด restrictAttack
    const egg = mon(s, 1, 1);
    FX().ops.restrictAttack(s, [], { target: 'self' }, { player: 1, source: egg });
    assert.strictEqual(egg.restrictAttack, true);

    // p0 พยายามตีตรง -> MUST_ATTACK_RESTRICTED
    const direct = E().applyAction(s, { type: 'attack', player: 0, from: 0, to: null });
    assert.strictEqual(direct.ok, false);
    assert.strictEqual(direct.error, 'MUST_ATTACK_RESTRICTED');

    // p0 พยายามตีช่อง 0 (ตัวที่ไม่ติด restrict) -> MUST_ATTACK_RESTRICTED
    const attackOther = E().applyAction(s, { type: 'attack', player: 0, from: 0, to: 0 });
    assert.strictEqual(attackOther.ok, false);
    assert.strictEqual(attackOther.error, 'MUST_ATTACK_RESTRICTED');

    // ตรวจสอบ getLegalActions ว่ามีเฉพาะการตีไปที่ช่อง 1
    const legals = E().getLegalActions(s, 0).filter(a => a.type === 'attack');
    assert.strictEqual(legals.length, 1);
    assert.strictEqual(legals[0].to, 1);

    // ตีช่อง 1 (ตัวที่ติด restrict) -> ผ่าน
    const attackRestricted = E().applyAction(s, { type: 'attack', player: 0, from: 0, to: 1 });
    assert.ok(attackRestricted.ok, attackRestricted.error);

    // กรณีมี 2 ตัวติด restrictAttack (เช่น ช่อง 0 และ ช่อง 2)
    const s2 = game({
      phase: 'battle', turn: 3,
      p0: { monsters: { 0: 'dino_trike' } },
      p1: { monsters: { 0: 'dino_small_raptor', 2: 'dino_ptero' } }
    });
    mon(s2, 1, 0).restrictAttack = true;
    mon(s2, 1, 2).restrictAttack = true;
    const legals2 = E().getLegalActions(s2, 0).filter(a => a.type === 'attack');
    assert.strictEqual(legals2.length, 2);
    assert.ok(legals2.some(a => a.to === 0));
    assert.ok(legals2.some(a => a.to === 2));
  } },

  { name: 'D4C-10 restrictAttack (-): ตัวติด restrict ตายแล้วปลดล็อค, ตัวคว่ำไม่มีผล restrict, ฝั่งตัวเองตีได้ปกติ', run(assert) {
    const s = game({
      phase: 'battle', turn: 3,
      p0: { monsters: { 0: 'dino_trike' } },
      p1: { monsters: { 0: 'dino_small_raptor', 1: 'dino_egg' } }
    });
    const egg = mon(s, 1, 1);
    egg.restrictAttack = true;

    // ทำลายตัวไข่ไดโน
    E().destroyMonster(s, [], 1, 1, 'effect');
    assert.strictEqual(mon(s, 1, 1), null);

    // ตอนนี้ตีช่อง 0 ได้ตามปกติ
    const r = E().applyAction(s, { type: 'attack', player: 0, from: 0, to: 0 });
    assert.ok(r.ok, r.error);

    // ตัวที่ติด restrict แต่คว่ำอยู่ (faceDown) จะไม่ส่งผล restrict
    const s2 = game({
      phase: 'battle', turn: 3,
      p0: { monsters: { 0: 'dino_trike' } },
      p1: { monsters: { 0: 'dino_small_raptor', 1: { cardId: 'dino_egg', faceDown: true } } }
    });
    mon(s2, 1, 1).restrictAttack = true;
    // ตีช่อง 0 ได้เพราะช่อง 1 คว่ำอยู่
    assert.ok(E().applyAction(s2, { type: 'attack', player: 0, from: 0, to: 0 }).ok);
  } }
];
