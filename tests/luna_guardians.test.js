// tests/luna_guardians.test.js - ทดสอบระบบคอมโบเด็ค LUNA GUARDIANS (ผู้พิทักษ์แห่งจันทรา)
require('./fixtures');
const E = () => CG.engine;
const FX = () => CG.effects;
const game = (o, cfg) => CG.test.makeGame(Object.assign({ deckA: 'luna_guardians', deckB: 'dinosaur', seed: 1 }, o, {
  config: Object.assign({ chainMode: true, autoChoose: true }, cfg)
}));

module.exports = [
  // 1. Deck structure
  {
    name: 'LUNA-01: โครงสร้างเด็ค LUNA GUARDIANS มี 40 ใบใน Main Deck และ 7 ใบใน Extra Deck',
    run(assert) {
      const d = CG.cards.luna_guardians;
      assert.ok(d, 'โหลดเด็คสำเร็จ');
      const totalMain = d.main.reduce((acc, c) => acc + (c.count || 1), 0);
      assert.strictEqual(totalMain, 40, 'Main Deck ครบ 40 ใบ');
      assert.strictEqual(d.extra.length, 7, 'Extra Deck ครบ 7 ใบ');
    }
  },

  // 2. Transform: Ember Lv1 -> Blaze Lv3
  {
    name: 'LUNA-02: เอมเบอร์ (Lv1) แปลงกาย คืนตัวเองขึ้นมือและอัญเชิญพิเศษเอมเบอร์ร่างอัคนี (Lv3) พร้อมยิง 500 Effect Damage',
    run(assert) {
      const s = game({
        turn: 3, activeIdx: 0, phase: 'main1',
        p0: {
          hand: ['luna_ember_blaze'],
          monsters: { 0: 'luna_ember' },
          mana: 5
        },
        p1: { lp: 8000 }
      });

      const p0 = s.players[0];
      const act = { type: 'activateEffect', player: 0, slot: 0, effectId: 'luna_ember_transform' };
      const err = E().validateActivateEffect(s, act);
      assert.strictEqual(err, null, 'เอฟเฟกต์แปลงกายถูกต้องตามเงื่อนไข');

      const r = E().applyAction(s, act);
      assert.ok(r.ok, 'รันเอฟเฟกต์แปลงกายสำเร็จ');

      // ตรวจสอบว่าช่อง 0 กลายเป็นร่างอัคนี และเอมเบอร์ Lv1 กลับขึ้นมือ
      assert.strictEqual(p0.monsters[0].cardId, 'luna_ember_blaze');
      assert.ok(p0.hand.some(c => c.cardId === 'luna_ember'), 'เอมเบอร์ Lv1 กลับขึ้นมือ');
      // ตรวจสอบดาเมจ 500 จากการแปลงกาย
      assert.strictEqual(s.players[1].lp, 7500, 'ยิงดาเมจ 500 ใส่ฝ่ายตรงข้าม');
    }
  },

  // 3. Revert: Blaze Lv3 -> Ember Lv1 at End Phase
  {
    name: 'LUNA-03: เอมเบอร์ร่างอัคนี (Lv3) คืนร่างยามจันทราลาในช่วง End Phase กลับขึ้นมือแล้วเรียกร่างปกติลงสนามแทน',
    run(assert) {
      const s = game({
        turn: 3, activeIdx: 0, phase: 'main1',
        p0: {
          hand: ['luna_ember'],
          monsters: { 0: 'luna_ember_blaze' },
          mana: 0
        }
      });

      const p0 = s.players[0];
      const r = E().applyAction(s, { type: 'endTurn', player: 0 });
      assert.ok(r.ok, 'จบเทิร์นสำเร็จ');

      // ตรวจสอบว่าช่อง 0 สลับเป็นร่างปกติ และร่างอัคนีออกจากสนาม
      assert.strictEqual(p0.monsters[0].cardId, 'luna_ember', 'คืนร่างปกติสำเร็จ');
      assert.ok(p0.hand.some(c => c.cardId === 'luna_ember_blaze') || p0.grave.some(c => c.cardId === 'luna_ember_blaze'), 'ร่างอัคนีออกจากสนาม');
    }
  },

  // 4. Leader Summon: Luna Lv2 to Leader Slot
  {
    name: 'LUNA-04: ลูน่า (Lv2) อัญเชิญพิเศษจากมือลงสู่ช่องผู้นำเมื่อมีมอนสเตอร์ LUNA บนสนาม >= 2 ตัว',
    run(assert) {
      const s = game({
        turn: 3, activeIdx: 0, phase: 'main1',
        p0: {
          hand: ['luna_leader'],
          monsters: { 0: 'luna_ember', 1: 'luna_marina' },
          mana: 0
        }
      });

      const p0 = s.players[0];
      const act = { type: 'activateEffect', player: 0, handIdx: 0, effectId: 'luna_leader_summon' };
      const err = E().validateActivateEffect(s, act);
      assert.strictEqual(err, null, 'เงื่อนไขอัญเชิญผู้นำผ่าน');

      const r = E().applyAction(s, act);
      assert.ok(r.ok, 'อัญเชิญผู้นำสำเร็จ');

      // ลูน่าต้องอยู่ในช่องผู้นำ (ช่อง 2)
      assert.ok(p0.monsters[2], 'ช่องผู้นำมีมอนสเตอร์');
      assert.strictEqual(p0.monsters[2].cardId, 'luna_leader');
      assert.strictEqual(p0.hand.length, 0);
    }
  },

  // 5. Resonance Fusion: Ember Queen
  {
    name: 'LUNA-05: LUNA เรโซแนนซ์ ฟิวชั่นร่าง Lv1 + Lv3 เรียกราชินีเอมเบอร์และยิง 1000 Effect Damage',
    run(assert) {
      const s = game({
        turn: 3, activeIdx: 0, phase: 'main1',
        p0: {
          hand: ['luna_resonance', 'luna_ember', 'luna_ember_blaze'],
          monsters: {},
          extra: ['luna_ember_queen'],
          mana: 5
        },
        p1: { lp: 8000 }
      });

      const p0 = s.players[0];
      const act = { type: 'activateSpell', player: 0, handIdx: 0 };
      const r = E().applyAction(s, act);
      assert.ok(r.ok, 'ร่ายเรโซแนนซ์สำเร็จ');

      // ตรวจสอบว่าราชินีเอมเบอร์ถูกอัญเชิญลงสนาม
      const queen = p0.monsters.find(m => m && m.cardId === 'luna_ember_queen');
      assert.ok(queen, 'อัญเชิญราชินีเอมเบอร์ลงสนามสำเร็จ');
      assert.strictEqual(s.players[1].lp, 7000, 'ยิงดาเมจ 1000 ใส่ LP ศัตรู');
    }
  },

  // 6. Resonance Grave Salvage
  {
    name: 'LUNA-06: LUNA เรโซแนนซ์ เอฟเฟกต์ในสุสาน สังเวย LUNA 1 ตัวบนสนามเพื่อนำการ์ดนี้กลับขึ้นมือ',
    run(assert) {
      const s = game({
        turn: 3, activeIdx: 0, phase: 'main1',
        p0: {
          hand: [],
          monsters: { 0: 'luna_ember' },
          grave: ['luna_resonance'],
          mana: 0
        }
      });

      const p0 = s.players[0];
      const act = { type: 'activateEffect', player: 0, graveIdx: 0, effectId: 'luna_resonance_salvage' };
      const err = E().validateActivateEffect(s, act);
      assert.strictEqual(err, null, 'กดใช้สกิลจากสุสานได้');

      const r = E().applyAction(s, act);
      assert.ok(r.ok, 'ใช้สกิลกู้คืนเรโซแนนซ์สำเร็จ');

      // มอนสเตอร์ช่อง 0 ต้องลงสุสาน และเรโซแนนซ์กลับขึ้นมือ
      assert.strictEqual(p0.monsters[0], null, 'สังเวยมอนสเตอร์บนสนาม');
      assert.ok(p0.hand.some(c => c.cardId === 'luna_resonance'), 'เรโซแนนซ์กลับขึ้นมือ');
    }
  },

  // 7. Moon Garden Cost Reduction
  {
    name: 'LUNA-07: สวนจันทร์ (เวทสนาม) จ่าย 2 Arcana ลดค่าร่าย LUNA ทั้งหมด 1 มานาในเทิร์นนั้น',
    run(assert) {
      const s = game({
        turn: 3, activeIdx: 0, phase: 'main1',
        p0: {
          hand: ['luna_garden', 'luna_prep'],
          monsters: {},
          mana: 2
        }
      });

      const p0 = s.players[0];
      // วางสวนจันทร์ลงสนาม
      E().applyAction(s, { type: 'activateSpell', player: 0, handIdx: 0 });
      assert.ok(p0.fieldSpell, 'มีเวทสนาม');

      // กดใช้สกิลลดคอส
      const act = { type: 'activateEffect', player: 0, fieldSpell: true, effectId: 'luna_garden_cost_down' };
      const r = E().applyAction(s, act);
      assert.ok(r.ok, 'กดใช้สกิลสวนจันทร์สำเร็จ');

      // ตรวจสอบว่า flag ลดมานาถูกบันทึกไว้ในเทิร์นนี้
      assert.ok(p0.flags.turnCostReduction, 'มีบัฟลดมานา');
      assert.strictEqual(p0.flags.turnCostReduction.amount, 1);
    }
  },

  // 8. Luna Night Watcher: Banish Leader to Summon from Extra Deck
  {
    name: 'LUNA-08: ลูน่า ผู้เฝ้ายามค่ำ อัญเชิญโดยเนรเทศลูน่า Lv2 ในช่องผู้นำออกนอกเกม',
    run(assert) {
      const s = game({
        turn: 3, activeIdx: 0, phase: 'main1',
        p0: {
          hand: [],
          monsters: { 2: 'luna_leader' },
          extra: ['luna_night_watcher'],
          mana: 2
        }
      });

      const p0 = s.players[0];
      const act = { type: 'extraSummon', player: 0, extraIdx: 0, targetSlot: 2 };
      const err = E().validateExtraSummon(s, act);
      assert.strictEqual(err, null, 'เงื่อนไขอัญเชิญผู้เฝ้ายามค่ำผ่าน');

      const r = E().applyAction(s, act);
      assert.ok(r.ok, 'อัญเชิญสำเร็จ');

      // ลูน่า Lv2 ต้องถูกนำไป Exile (removed)
      assert.ok(p0.removed.some(c => c.cardId === 'luna_leader'), 'ลูน่าเดิมถูกเนรเทศไป Exile');
      // ช่องผู้นำกลายเป็นผู้เฝ้ายามค่ำ
      assert.strictEqual(p0.monsters[2].cardId, 'luna_night_watcher');
    }
  },

  // 9. Luna Eclipse: Overlay on Leader by sending 2 LUNA monsters to grave
  {
    name: 'LUNA-09: ลูน่า อีคลิปส์ (Apex) วางทับลูน่าในช่องผู้นำโดยส่งมอนสเตอร์ LUNA บนสนาม 2 ตัวลงสุสาน',
    run(assert) {
      const s = game({
        turn: 3, activeIdx: 0, phase: 'main1',
        p0: {
          hand: [],
          monsters: { 0: 'luna_ember', 1: 'luna_marina', 2: 'luna_leader' },
          extra: ['luna_eclipse'],
          mana: 5
        }
      });

      const p0 = s.players[0];
      const act = { type: 'extraSummon', player: 0, extraIdx: 0, targetSlot: 2 };
      const err = E().validateExtraSummon(s, act);
      assert.strictEqual(err, null, 'เงื่อนไขอัญเชิญอีคลิปส์ผ่าน');

      const r = E().applyAction(s, act);
      assert.ok(r.ok, 'อัญเชิญอีคลิปส์สำเร็จ');

      // มอนสเตอร์ 2 ตัวบนสนาม (ช่อง 0 และ 1) ต้องถูกส่งลงสุสาน
      assert.strictEqual(p0.monsters[0], null, 'ช่อง 0 ว่างลง');
      assert.strictEqual(p0.monsters[1], null, 'ช่อง 1 ว่างลง');
      assert.strictEqual(p0.monsters[2].cardId, 'luna_eclipse', 'ช่องผู้นำกลายเป็นอีคลิปส์');
    }
  },

  // 10. Luna Full Moon: Overlay on Night Watcher with 2 Fusions on field
  {
    name: 'LUNA-10: ลูน่า ฟูลมูน (Apex) วางทับผู้เฝ้ายามค่ำในช่องผู้นำเมื่อมีฟิวชั่น LUNA บนสนาม >= 2 ตัว',
    run(assert) {
      const s = game({
        turn: 3, activeIdx: 0, phase: 'main1',
        p0: {
          hand: [],
          monsters: { 0: 'luna_ember_queen', 1: 'luna_marina_queen', 2: 'luna_night_watcher' },
          extra: ['luna_full_moon'],
          mana: 5
        }
      });

      const p0 = s.players[0];
      const act = { type: 'extraSummon', player: 0, extraIdx: 0, targetSlot: 2 };
      const err = E().validateExtraSummon(s, act);
      assert.strictEqual(err, null, 'เงื่อนไขฟูลมูนผ่าน');

      const r = E().applyAction(s, act);
      assert.ok(r.ok, 'อัญเชิญฟูลมูนสำเร็จ');

      // ช่องผู้นำกลายเป็นฟูลมูน
      assert.strictEqual(p0.monsters[2].cardId, 'luna_full_moon');
    }
  },

  // 11. Luna Secret Rare: Alternate artwork card has identical stats and effects to Luna Lv2
  {
    name: 'LUNA-11: ลูน่า Secret Rare (ภาพหายากตัวบนหลังวาฬ) มีความสามารถและสเตตัสเหมือนลูน่าเวล 2 ทุกประการ',
    run(assert) {
      const defRare = E().findCard('luna_leader_rare');
      assert.ok(defRare, 'ค้นหาการ์ด luna_leader_rare พบ');
      assert.strictEqual(defRare.baseCardId, 'luna_leader', 'baseCardId ชี้ไปที่ luna_leader');
      assert.strictEqual(defRare.level, 2, 'Level 2');
      assert.strictEqual(defRare.atk, 1400, 'ATK 1400');
      assert.strictEqual(defRare.def, 1200, 'DEF 1200');
      assert.strictEqual(defRare.leader, true, 'เป็น Leader');
      assert.strictEqual(defRare.rare, true, 'เป็น Rare card');

      // ทดสอบอัญเชิญลงช่องผู้นำจากมือ
      const s = game({
        turn: 3, activeIdx: 0, phase: 'main1',
        p0: {
          hand: ['luna_leader_rare'],
          monsters: { 0: 'luna_ember', 1: 'luna_marina' },
          mana: 2
        }
      });
      const p0 = s.players[0];
      const act = { type: 'activateEffect', player: 0, handIdx: 0, effectId: 'luna_leader_rare_summon' };
      const err = E().validateActivateEffect(s, act);
      assert.strictEqual(err, null, 'เงื่อนไขอัญเชิญลูน่า Secret Rare ผ่าน');

      const r = E().applyAction(s, act);
      assert.ok(r.ok, 'อัญเชิญลงช่องผู้นำสำเร็จ');
      assert.strictEqual(p0.monsters[2].cardId, 'luna_leader_rare', 'ช่อง 2 (ผู้นำ) เป็น luna_leader_rare');
    }
  },

  // 12. Luna Night Watcher and Luna Eclipse can extraSummon onto luna_leader_rare
  {
    name: 'LUNA-12: ผู้เฝ้ายามค่ำ (ฟิวชั่น) และ ลูน่า อีคลิปส์ (Grade 4) สามารถอัญเชิญทับ ลูน่า Secret Rare ในช่องผู้นำได้',
    run(assert) {
      // 1) ทดสอบ Night Watcher บน luna_leader_rare
      const s1 = game({
        turn: 3, activeIdx: 0, phase: 'main1',
        p0: {
          hand: [],
          monsters: { 2: 'luna_leader_rare' },
          extra: ['luna_night_watcher'],
          mana: 2
        }
      });
      const act1 = { type: 'extraSummon', player: 0, extraIdx: 0, targetSlot: 2 };
      const err1 = E().validateExtraSummon(s1, act1);
      assert.strictEqual(err1, null, 'Night Watcher อัญเชิญทับ luna_leader_rare ได้');
      const r1 = E().applyAction(s1, act1);
      assert.ok(r1.ok, 'อัญเชิญ Night Watcher สำเร็จ');
      assert.strictEqual(s1.players[0].monsters[2].cardId, 'luna_night_watcher');
      assert.ok(s1.players[0].removed.some(c => c.cardId === 'luna_leader_rare'), 'luna_leader_rare ถูกนำออกนอกเกมตามเงื่อนไข');

      // 2) ทดสอบ Luna Eclipse บน luna_leader_rare
      const s2 = game({
        turn: 3, activeIdx: 0, phase: 'main1',
        p0: {
          hand: [],
          monsters: { 0: 'luna_ember', 1: 'luna_marina', 2: 'luna_leader_rare' },
          extra: ['luna_eclipse'],
          mana: 3
        }
      });
      const act2 = { type: 'extraSummon', player: 0, extraIdx: 0, targetSlot: 2 };
      const err2 = E().validateExtraSummon(s2, act2);
      assert.strictEqual(err2, null, 'Luna Eclipse อัญเชิญทับ luna_leader_rare ได้');
      const r2 = E().applyAction(s2, act2);
      assert.ok(r2.ok, 'อัญเชิญ Luna Eclipse สำเร็จ');
      assert.strictEqual(s2.players[0].monsters[2].cardId, 'luna_eclipse');
    }
  },

  // 13. Luna Reflection Veil: Counter spell activates only on attack declaration and forcefully ends turn after battle
  {
    name: 'LUNA-13: ม่านจันทร์สะท้อน ห้ามกดใช้ใน Main Phase และจะทำงานเมื่อศัตรูประกาศโจมตี เพื่อบังคับจบเทิร์นหลังจบการต่อสู้',
    run(assert) {
      // 1) ใน Main Phase ไม่สามารถกด activateSpell จากมือได้
      const s1 = game({
        turn: 1, activeIdx: 0, phase: 'main1',
        p0: { hand: ['luna_reflection_veil'], mana: 3 }
      });
      const legals = E().getLegalActions(s1, 0);
      const canCastInMain = legals.some(a => a.type === 'activateSpell' && a.handIdx === 0);
      assert.strictEqual(canCastInMain, false, 'ต้องไม่มีปุ่มร่ายสเปลม่านจันทร์สะท้อนใน Main Phase');

      const badAct = { type: 'activateSpell', player: 0, handIdx: 0 };
      const err = E().applyAction(s1, badAct);
      assert.strictEqual(err.ok, false, 'ไม่ยอมให้กดใช้ทิ้งลงสุสานฟรี');

      // 2) เมื่อศัตรูประกาศโจมตีใน Battle Phase: เปิดหน้าต่างตอบโต้ และใช้จบเทิร์นได้
      const s2 = game({
        turn: 2, activeIdx: 1, phase: 'battle',
        p1: { mana: 2, monsters: { 0: { cardId: 'aq_spear', position: 'atk' } } },
        p0: { mana: 1, hand: ['luna_reflection_veil'], monsters: { 0: { cardId: 'luna_ember', position: 'atk' } } }
      });

      // P1 ประกาศโจมตีใส่ luna_ember ของ P0
      const atkAct = { type: 'attack', player: 1, from: 0, to: 0 };
      const atkRes = E().applyAction(s2, atkAct);
      assert.strictEqual(atkRes.ok, true, 'ศัตรูประกาศโจมตีสำเร็จ');
      assert.ok(s2.pending && s2.pending.kind === 'chainWindow', 'เปิดหน้าต่างตอบโต้ให้ P0');
      assert.strictEqual(s2.pending.player, 0, 'ให้สิทธิ์ P0 ตอบโต้');

      // P0 ตอบโต้ด้วยม่านจันทร์สะท้อน
      const respAct = { type: 'activateResponse', player: 0, handIdx: 0, effectId: 'luna_reflection_end_turn' };
      const respRes = E().applyAction(s2, respAct);
      assert.strictEqual(respRes.ok, true, 'ร่ายม่านจันทร์สะท้อนสำเร็จ');

      // หลังจบการต่อสู้ เทิร์นของ P1 ต้องจบลงทันที (เทิร์นเปลี่ยนเป็นของ P0)
      assert.strictEqual(s2.activeIdx, 0, 'บังคับจบเทิร์นศัตรูทันทีหลังต่อสู้เสร็จ');
      assert.strictEqual(s2.players[0].grave.some(c => c.cardId === 'luna_reflection_veil'), true, 'ม่านจันทร์สะท้อนลงสุสาน');
    }
  },

  // 14. Interactive targeting & card choices for player
  {
    name: 'LUNA-14: เอฟเฟกต์การเลือกการ์ด (จันทร์คืนชีพ, ทิ้งการ์ด, ดีดการ์ด) ต้องเปิดให้ผู้เล่นเลือกเองเมื่ออยู่ในโหมดเกม UI',
    run(assert) {
      // 1) จันทร์คืนชีพ: มีมอนสเตอร์ในสุสาน ต้องเปิด pending ให้เลือก ไม่เลือกเองอัตโนมัติ
      const s = game({
        turn: 1, activeIdx: 0, phase: 'main1',
        p0: {
          mana: 2,
          hand: ['luna_rebirth'],
          grave: ['luna_marina', 'luna_leader']
        }
      }, { autoChoose: false, interactiveChoice: true });

      const castRes = E().applyAction(s, { type: 'activateSpell', player: 0, handIdx: 0 });
      assert.strictEqual(castRes.ok, true, 'ร่ายจันทร์คืนชีพสำเร็จ');
      assert.ok(s.pending, 'ต้องเปิด pending ให้ผู้เล่นเลือกมอนสเตอร์');
      assert.strictEqual(s.pending.kind, 'chooseCards', 'kind ต้องเป็น chooseCards');
      assert.strictEqual(s.pending.options.length, 2, 'มี 2 ตัวเลือกในสุสาน (marina, leader)');

      // ผู้เล่นจงใจเลือก leader (ดัชนี 1) ไม่ใช่ marina
      const respRes = E().applyAction(s, { type: 'respond', player: 0, choice: [1] });
      assert.strictEqual(respRes.ok, true, 'เลือกสำเร็จ');
      assert.strictEqual(s.pending, null, 'pending ปิดแล้ว');
      assert.strictEqual(s.players[0].monsters[0].cardId, 'luna_leader', 'ต้องคืนชีพตัวที่ผู้เล่นเลือก (leader) ไม่เลือกเอง');

      // 2) กรณีมีตัวเดียวในสุสาน ในโหมด interactiveChoice ก็ยังต้องเปิดให้ผู้เล่นยืนยันเลือก
      const sSolo = game({
        turn: 1, activeIdx: 0, phase: 'main1',
        p0: {
          mana: 2,
          hand: ['luna_rebirth'],
          grave: ['luna_marina']
        }
      }, { autoChoose: false, interactiveChoice: true });
      const castSolo = E().applyAction(sSolo, { type: 'activateSpell', player: 0, handIdx: 0 });
      assert.strictEqual(castSolo.ok, true);
      assert.ok(sSolo.pending, 'แม้มีตัวเดียวก็ต้องเปิดหน้าต่างให้ผู้เล่นเลือก');
      assert.strictEqual(sSolo.pending.options.length, 1);
      assert.strictEqual(sSolo.pending.options[0].cardId, 'luna_marina');

      // 3) ทิ้งการ์ดของ luna_ember: ต้องเปิด pending ให้เลือกการ์ดที่จะทิ้ง
      const sDiscard = game({
        turn: 1, activeIdx: 0, phase: 'main1',
        p0: {
          mana: 2,
          hand: ['luna_ember', 'luna_garden', 'luna_bounce_screen'],
          deck: ['luna_volta']
        }
      }, { autoChoose: false, interactiveChoice: true });
      // ลง ember
      const sumRes = E().applyAction(sDiscard, { type: 'normalSummon', player: 0, handIdx: 0, slot: 0 });
      assert.strictEqual(sumRes.ok, true);
      // ติด trigger search: เลือก volta
      assert.ok(sDiscard.pending && sDiscard.pending.kind === 'chooseCards');
      const pickSearch = E().applyAction(sDiscard, { type: 'respond', player: 0, choice: [0] });
      assert.strictEqual(pickSearch.ok, true);

      // ต่อเนื่องด้วยขั้นตอนทิ้งการ์ด: ต้องเปิด pending ให้เลือกการ์ดที่จะทิ้ง ไม่ทิ้งมั่ว
      assert.ok(sDiscard.pending, 'ขั้นตอนทิ้งการ์ดต้องเปิด pending ให้เลือก');
      assert.strictEqual(sDiscard.pending.kind, 'chooseCards');
      // ผู้เล่นเลือกทิ้ง luna_garden
      const gardenOptIdx = sDiscard.pending.options.findIndex(o => o.cardId === 'luna_garden');
      assert.ok(gardenOptIdx >= 0, 'มี luna_garden ในตัวเลือกทิ้ง');
      const pickDiscard = E().applyAction(sDiscard, { type: 'respond', player: 0, choice: [gardenOptIdx] });
      assert.strictEqual(pickDiscard.ok, true);
      assert.strictEqual(sDiscard.pending, null);
      assert.strictEqual(sDiscard.players[0].grave.some(c => c.cardId === 'luna_garden'), true, 'การ์ดที่ผู้เล่นเลือกทิ้งลงสุสานถูกต้อง');
    }
  },

  // 15. Luna Prep, Luna Leader Battle Protection, Volta Vajra Buff
  {
    name: 'LUNA-15: แสงจันทร์เตรียมพร้อมส่งการ์ดลงสุสานได้จริง, ลูน่าในช่องผู้นำไม่ตายจากการต่อสู้, โวลตาร่างวัชระเพิ่ม ATK ได้',
    run(assert) {
      // 1) แสงจันทร์เตรียมพร้อม (luna_prep) ส่งมอนสเตอร์จากเด็คลงสุสาน
      const sPrep = game({
        turn: 1, activeIdx: 0, phase: 'main1',
        p0: { mana: 2, hand: ['luna_prep'], deck: ['luna_marina', 'luna_ember'] }
      }, { autoChoose: true });
      const prepRes = E().applyAction(sPrep, { type: 'activateSpell', player: 0, handIdx: 0 });
      assert.strictEqual(prepRes.ok, true, 'ร่ายแสงจันทร์เตรียมพร้อมสำเร็จ');
      assert.strictEqual(sPrep.players[0].grave.some(c => c.cardId === 'luna_marina' || c.cardId === 'luna_ember'), true, 'มอนสเตอร์จากเด็คถูกส่งลงสุสานสำเร็จ');

      // 2) ลูน่าในช่องผู้นำ (slot 2) มีเกราะพิทักษ์ ไม่ถูกทำลายจากการต่อสู้
      const sLead = game({
        turn: 2, activeIdx: 1, phase: 'battle',
        p1: { mana: 2, monsters: { 2: { cardId: 'aq_spear', position: 'atk' } } }, // 1600 ATK
        p0: { mana: 0, monsters: { 2: { cardId: 'luna_leader', position: 'atk' } } } // 1400 ATK in leader slot
      }, { autoChoose: true });
      const atkLead = E().applyAction(sLead, { type: 'attack', player: 1, from: 2, to: 2 });
      assert.strictEqual(atkLead.ok, true, 'โจมตีใส่ลูน่า');
      assert.ok(sLead.players[0].monsters[2], 'ลูน่ายังคงรอดชีวิตบนสนาม ไม่ถูกทำลายจากการต่อสู้');
      assert.strictEqual(sLead.players[0].monsters[2].cardId, 'luna_leader');

      // 3) โวลตา ร่างวัชระ (luna_volta_vajra) บัฟ ATK +300
      const sBuff = game({
        turn: 1, activeIdx: 0, phase: 'main1',
        p0: { mana: 2, monsters: { 0: { cardId: 'luna_volta_vajra', position: 'atk' } } }
      }, { autoChoose: true });
      const atkBefore = E().atk(sBuff.players[0].monsters[0]);
      const buffRes = E().applyAction(sBuff, { type: 'activateEffect', player: 0, slot: 0, effectId: 'luna_volta_vajra_buff' });
      assert.strictEqual(buffRes.ok, true, 'กดใช้เอฟเฟกต์บัฟโวลตาร่างวัชระสำเร็จ');
      const atkAfter = E().atk(sBuff.players[0].monsters[0]);
      assert.strictEqual(atkAfter, atkBefore + 300, 'ATK เพิ่มขึ้น 300');
    }
  },

  // 16. Transformed summon 0-cost and End Phase revert without onSummon loop
  {
    name: 'LUNA-16: ร่างแปลงกายใช้เอฟเฟกต์ตอนลงโดยไม่กินมานาซ้ำซ้อน และเมื่อคืนร่างตอน End Phase จะไม่ติดลูป onSummon',
    run(assert) {
      // 1) แปลงกายใช้ 1 Arcana ร่าง Blaze ลงมาจะยิง 500 damage โดยไม่ต้องจ่าย 1 Arcana ซ้ำอีก
      const s = game({
        turn: 1, activeIdx: 0, phase: 'main1',
        p0: {
          mana: 1, // มีมานาเพียง 1 Arcana สำหรับค่าแปลงกาย
          hand: ['luna_ember_blaze'],
          monsters: { 0: { cardId: 'luna_ember', position: 'atk' } }
        },
        p1: { lp: 8000 }
      }, { autoChoose: true });

      const transRes = E().applyAction(s, { type: 'activateEffect', player: 0, slot: 0, effectId: 'luna_ember_transform' });
      assert.strictEqual(transRes.ok, true, 'แปลงกายสำเร็จ');
      assert.strictEqual(s.players[0].monsters[0].cardId, 'luna_ember_blaze', 'เอมเบอร์ร่างอัคนีลงสนาม');
      assert.strictEqual(s.players[1].lp, 7500, 'ยิง 500 Effect Damage สำเร็จด้วยมานา 0');
      assert.strictEqual(s.players[0].mana, 0, 'มานาเหลือ 0 (ไม่ถูกหักซ้ำ)');

      // 2) เข้าสู่ End Phase: คืนร่างเป็นเอมเบอร์ Lv1 โดยไม่เด้งหน้าต่าง search/discard กวนใจ
      const endAct = E().applyAction(s, { type: 'endTurn', player: 0 });
      assert.strictEqual(endAct.ok, true, 'จบเทิร์นสำเร็จ');
      assert.strictEqual(s.pending, null, 'ไม่มีหน้าต่างเลือกการ์ดค้างตอนจบเทิร์น');
      assert.strictEqual(s.players[0].monsters[0].cardId, 'luna_ember', 'คืนร่างกลับเป็นเอมเบอร์ Lv1 สำเร็จ');
      assert.strictEqual(s.players[0].hand.some(c => c.cardId === 'luna_ember_blaze'), true, 'ร่างอัคนีกลับขึ้นมือ');
    }
  }
];
