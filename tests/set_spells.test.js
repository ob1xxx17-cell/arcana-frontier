// tests/set_spells.test.js - ทดสอบกลไกสเปลหมอบรอ (ความเร็ว 2) และสเปลสวนกลับ (ความเร็ว 3) ทั้ง 9 ใบ (ขั้น 5C)
require('./fixtures');
const E = () => CG.engine;
const FX = () => CG.effects;
const game = (o, cfg) => CG.test.makeGame(Object.assign({ deckA: 'dinosaur', deckB: 'aquila', seed: 1 }, o, {
  config: Object.assign({ chainMode: true, autoChoose: true }, cfg)
}));

module.exports = [
  // ================= 1. setSpell Action =================
  {
    name: '5C-SET-01 setSpell: ผู้เล่นสามารถหมอบสเปลจากมือลงช่องสเปลใน Main Phase',
    run(assert) {
      const s = game({
        turn: 3, activeIdx: 0, phase: 'main1',
        p0: { hand: ['dino_mud'], spells: {} }
      });
      const r = E().applyAction(s, { type: 'setSpell', player: 0, handIdx: 0, slot: 0 });
      assert.strictEqual(r.ok, true, 'setSpell สำเร็จ');
      assert.strictEqual(s.players[0].hand.length, 0, 'การ์ดออกจากมือ');
      const setCard = s.players[0].spells[0];
      assert.ok(setCard, 'การ์ดอยู่ในช่องสเปล 0');
      assert.strictEqual(setCard.cardId, 'dino_mud');
      assert.strictEqual(setCard.faceDown, true, 'การ์ดคว่ำอยู่');
      assert.strictEqual(setCard.flags.setTurn, 3, 'บันทึก setTurn = 3');
    }
  },
  {
    name: '5C-SET-02 setSpell: ปฏิเสธถ้าช่องไม่ว่าง หรือไม่ใช่สเปล หรือผิดเฟส',
    run(assert) {
      const s = game({
        turn: 3, activeIdx: 0, phase: 'main1',
        p0: { hand: ['dino_mud', 'dino_trike'], spells: { 0: 'dino_escape' } }
      });
      // ช่อง 0 ไม่ว่าง
      const r1 = E().applyAction(s, { type: 'setSpell', player: 0, handIdx: 0, slot: 0 });
      assert.strictEqual(r1.ok, false);
      assert.strictEqual(r1.error, 'SLOT_FULL');

      // มอนสเตอร์หมอบในช่องสเปลไม่ได้
      const r2 = E().applyAction(s, { type: 'setSpell', player: 0, handIdx: 1, slot: 1 });
      assert.strictEqual(r2.ok, false);
      assert.strictEqual(r2.error, 'NOT_A_SPELL');

      // ผิดเฟส (Battle Phase)
      s.phase = 'battle';
      const r3 = E().applyAction(s, { type: 'setSpell', player: 0, handIdx: 0, slot: 1 });
      assert.strictEqual(r3.ok, false);
      assert.strictEqual(r3.error, 'WRONG_PHASE');
    }
  },

  // ================= 2. dino_roar (counter speed 3, from hand) =================
  {
    name: '5C-ROAR-01 dino_roar (positive): สวนกลับจากมือ ยกเลิกเอฟเฟกต์มอนสเตอร์ศัตรู ส่งไดโนเราไปสุสาน',
    run(assert) {
      // P1 ใช้ roar_king ของ dino_trex -> P0 สวนกลับด้วย dino_roar จากมือ
      const s = game({
        turn: 3, activeIdx: 1, phase: 'main1',
        p1: { mana: 2, monsters: { 0: 'dino_trex' } },
        p0: { mana: 2, hand: ['dino_roar'], monsters: { 0: 'dino_small_raptor' } }
      });
      const r1 = E().applyAction(s, { type: 'activateEffect', player: 1, slot: 0, effectId: 'roar_king' });
      assert.strictEqual(r1.ok, true);
      assert.ok(s.pending && s.pending.kind === 'chainWindow', 'เปิด chainWindow ให้ P0');
      assert.strictEqual(s.pending.player, 0);

      // P0 ตอบโต้ด้วย dino_roar (speed 3) จากมือ
      const r2 = E().applyAction(s, { type: 'activateResponse', player: 0, handIdx: 0, effectId: 'roar_negate' });
      assert.strictEqual(r2.ok, true);

      // P1 ไม่มีตัวตอบโต้ความเร็ว 3 โซ่แก้ผลอัตโนมัติทันที
      assert.strictEqual(s.pending, null, 'โซ่แก้ผลและปิดอัตโนมัติ');

      // โซ่แก้ผล: dino_roar ทำงาน ส่ง dino_small_raptor ไปสุสาน และยกเลิก roar_king
      assert.strictEqual(s.players[0].hand.length, 0, 'dino_roar ออกจากมือ');
      assert.strictEqual(s.players[0].grave.some(c => c.cardId === 'dino_roar'), true, 'dino_roar ไปสุสาน');
      assert.strictEqual(s.players[0].monsters[0], null, 'dino_small_raptor ถูกส่งไปสุสาน');
      assert.strictEqual(s.players[0].grave.some(c => c.cardId === 'dino_small_raptor'), true, 'ไดโนไปสุสาน');
      assert.strictEqual(s.players[0].mana, 0, 'จ่าย 2 มานา');
    }
  },
  {
    name: '5C-ROAR-02 dino_roar (negative): ไม่มีไดโนบนสนาม ไม่สามารถใช้งานได้',
    run(assert) {
      const s = game({
        turn: 3, activeIdx: 1, phase: 'main1',
        p1: { mana: 2, monsters: { 0: 'dino_trex' } },
        p0: { mana: 2, hand: ['dino_roar'], monsters: {} }
      });
      E().applyAction(s, { type: 'activateEffect', player: 1, slot: 0, effectId: 'roar_king' });
      // P0 ไม่มีไดโนบนสนาม จึงไม่มีสิทธิ์ตอบโต้ด้วย dino_roar
      assert.strictEqual(s.pending, null, 'ไม่มีตัวตอบโต้ ข้าม chainWindow อัตโนมัติ');
    }
  },

  // ================= 3. dino_escape (counter speed 3, from hand) =================
  {
    name: '5C-ESCAPE-01 dino_escape (positive): เมื่อไดโนถูกโจมตี ใช้จากมือ เปลี่ยนเป็นท่าป้องกันและ DEF +800',
    run(assert) {
      const s = game({
        turn: 3, activeIdx: 1, phase: 'battle',
        p1: { mana: 0, monsters: { 0: { cardId: 'aq_spear', position: 'atk' } } }, // ATK 800
        p0: { mana: 1, hand: ['dino_escape'], monsters: { 0: { cardId: 'dino_trike', position: 'atk' } } } // DEF 1800
      });
      // P1 โจมตี dino_trike
      const r1 = E().applyAction(s, { type: 'attack', player: 1, from: 0, to: 0 });
      assert.strictEqual(r1.ok, true);
      assert.ok(s.pending && s.pending.kind === 'chainWindow', 'เปิดหน้าต่างตอบโต้ attackDeclared');
      assert.strictEqual(s.pending.player, 0);

      // P0 ใช้ dino_escape (speed 3)
      const r2 = E().applyAction(s, { type: 'activateResponse', player: 0, handIdx: 0, effectId: 'escape_def' });
      assert.strictEqual(r2.ok, true);

      // P1 ไม่มีตัวตอบโต้ โซ่แก้ผลอัตโนมัติแล้วกลับไปคำนวณการต่อสู้
      assert.strictEqual(s.pending, null);

      // ผล: dino_trike กลายเป็นท่าป้องกัน และ DEF เพิ่ม 800 (2300 + 800 = 3100)
      const trike = s.players[0].monsters[0];
      assert.strictEqual(trike.position, 'def');
      assert.strictEqual(E().def(trike), 3100);
      assert.strictEqual(s.players[0].grave.some(c => c.cardId === 'dino_escape'), true, 'dino_escape ไปสุสาน');
      // aq_spear ATK 800 ตี trike DEF 3100 -> P1 เสีย 2300 LP
      assert.strictEqual(s.players[1].lp, 8000 - 2300);
    }
  },
  {
    name: '5C-ESCAPE-02 dino_escape (negative): โจมตีตรงหรือเป้าไม่ใช่ไดโน ไม่เปิดให้ใช้',
    run(assert) {
      const s = game({
        turn: 3, activeIdx: 1, phase: 'battle',
        p1: { mana: 0, monsters: { 0: { cardId: 'aq_spear', position: 'atk' } } },
        p0: { mana: 1, hand: ['dino_escape'], monsters: { 0: { cardId: 'aq_spear', position: 'atk' } } } // ไม่ใช่ไดโน
      });
      E().applyAction(s, { type: 'attack', player: 1, from: 0, to: 0 });
      // เป้าหมายไม่ใช่ tag dino -> escape_def ไม่ทำงาน
      assert.strictEqual(s.pending, null, 'ไม่เข้าเงื่อนไข ข้ามอัตโนมัติ');
    }
  },

  // ================= 4. dino_mud (set speed 2, on field) =================
  {
    name: '5C-MUD-01 dino_mud (positive): สเปลหมอบ เมื่อศัตรูประกาศโจมตี บังคับเป็นท่าป้องกันและโจมตีไม่ได้ในเทิร์นนี้',
    run(assert) {
      const s = game({
        turn: 3, activeIdx: 1, phase: 'battle',
        p1: { mana: 0, monsters: { 0: { cardId: 'aq_spear', position: 'atk' } } },
        p0: { mana: 1, spells: { 0: 'dino_mud' }, monsters: { 0: 'dino_egg' } }
      });
      s.players[0].spells[0].flags.setTurn = 1; // เซ็ตไว้ตั้งแต่เทิร์น 1

      const r1 = E().applyAction(s, { type: 'attack', player: 1, from: 0, to: 0 });
      assert.strictEqual(r1.ok, true);
      assert.ok(s.pending && s.pending.kind === 'chainWindow', 'เปิดหน้าต่างตอบโต้ให้ P0');

      // P0 เปิดใช้ dino_mud จากช่องสเปล 0
      const r2 = E().applyAction(s, { type: 'activateResponse', player: 0, spellSlot: 0, effectId: 'mud_trap' });
      assert.strictEqual(r2.ok, true);

      // P1 ไม่มีตัวตอบโต้ โซ่แก้ผลอัตโนมัติ
      assert.strictEqual(s.pending, null);

      // ผล: ผู้โจมตี (aq_spear) กลายเป็นท่าป้องกัน และโจมตีไม่ได้ในเทิร์นนี้
      const attacker = s.players[1].monsters[0];
      assert.strictEqual(attacker.position, 'def');
      assert.strictEqual(attacker.tempCannotAttackTurn, 3);
      assert.strictEqual(s.players[0].spells[0], null, 'สเปลออกจากช่องหลังแก้ผล');
      assert.strictEqual(s.players[0].grave.some(c => c.cardId === 'dino_mud'), true, 'สเปลไปสุสาน');
      // การโจมตียุติเพราะผู้โจมตีกลายเป็นท่าป้องกัน
      assert.strictEqual(s.attack, null, 'การโจมตียุติ');
    }
  },
  {
    name: '5C-MUD-02 dino_mud (negative): เซ็ตในเทิร์นเดียวกันไม่สามารถเปิดใช้ได้',
    run(assert) {
      const s = game({
        turn: 3, activeIdx: 1, phase: 'battle',
        p1: { mana: 0, monsters: { 0: { cardId: 'aq_spear', position: 'atk' } } },
        p0: { mana: 1, spells: { 0: 'dino_mud' }, monsters: { 0: 'dino_egg' } }
      });
      s.players[0].spells[0].flags.setTurn = 3; // เซ็ตในเทิร์น 3 เดียวกัน

      E().applyAction(s, { type: 'attack', player: 1, from: 0, to: 0 });
      // เปิดใช้ไม่ได้เพราะเซ็ตในเทิร์นนี้
      assert.strictEqual(s.pending, null, 'สเปลเซ็ตในเทิร์นนี้ไม่สามารถตอบโต้ได้');
    }
  },

  // ================= 5. dino_hidden_egg (set speed 2, on field) =================
  {
    name: '5C-EGG-01 dino_hidden_egg (positive): เมื่อไดโนเราถูกทำลาย เรียกไข่ไดโนจากเด็ค',
    run(assert) {
      const s = game({
        turn: 3, activeIdx: 1, phase: 'main1',
        p0: { mana: 1, spells: { 0: 'dino_hidden_egg' }, monsters: { 0: 'dino_trike' }, deck: ['dino_egg'] },
        p1: { mana: 5, monsters: {} }
      });
      s.players[0].spells[0].flags.setTurn = 1;

      // ทำลาย dino_trike ด้วย effect
      E().destroyMonster(s, [], 0, 0, 'effect');

      assert.ok(s.pending && s.pending.kind === 'chainWindow', 'เปิดหน้าต่าง monsterDestroyed');
      assert.strictEqual(s.pending.player, 0);

      // P0 ใช้ dino_hidden_egg
      const r = E().applyAction(s, { type: 'activateResponse', player: 0, spellSlot: 0, effectId: 'hidden_egg_summon' });
      assert.strictEqual(r.ok, true);

      // P1 ไม่มีตัวตอบโต้ โซ่แก้ผลอัตโนมัติ
      assert.strictEqual(s.pending, null);

      // ผล: dino_egg ถูกเรียกจากเด็กลงสนาม
      assert.strictEqual(s.players[0].monsters.some(m => m && m.cardId === 'dino_egg'), true, 'ไข่ไดโนลงสนาม');
      assert.strictEqual(s.players[0].spells[0], null);
      assert.strictEqual(s.players[0].grave.some(c => c.cardId === 'dino_hidden_egg'), true);
    }
  },
  {
    name: '5C-EGG-02 dino_hidden_egg (negative): มอนสเตอร์ศัตรูถูกทำลาย ไม่เปิดให้ใช้งาน',
    run(assert) {
      const s = game({
        turn: 3, activeIdx: 1, phase: 'main1',
        p0: { mana: 1, spells: { 0: 'dino_hidden_egg' }, monsters: {}, deck: ['dino_egg'] },
        p1: { mana: 5, monsters: { 0: 'dino_compy' } }
      });
      s.players[0].spells[0].flags.setTurn = 1;

      // ทำลายมอนสเตอร์ของ P1
      E().destroyMonster(s, [], 1, 0, 'effect');
      // P0 ต้องไม่ได้รับหน้าต่างใช้งาน hidden_egg
      assert.strictEqual(s.pending, null);
    }
  },

  // ================= 6. dino_pack_hunt (set speed 2, on field) =================
  {
    name: '5C-PACK-01 dino_pack_hunt (positive): เมื่อศัตรูโจมตี เรียกแรปเตอร์เล็ก 2 ตัวจากเด็ค/สุสาน',
    run(assert) {
      const s = game({
        turn: 3, activeIdx: 1, phase: 'battle',
        p1: { monsters: { 0: { cardId: 'aq_spear', position: 'atk' } } },
        p0: { mana: 2, spells: { 0: 'dino_pack_hunt' }, monsters: { 0: 'dino_trike' }, deck: ['dino_small_raptor'], grave: ['dino_small_raptor'] }
      });
      s.players[0].spells[0].flags.setTurn = 1;

      E().applyAction(s, { type: 'attack', player: 1, from: 0, to: 0 });
      assert.ok(s.pending && s.pending.kind === 'chainWindow');

      const r = E().applyAction(s, { type: 'activateResponse', player: 0, spellSlot: 0, effectId: 'pack_hunt_summon' });
      assert.strictEqual(r.ok, true);

      // P1 ไม่มีตัวตอบโต้ โซ่แก้ผลอัตโนมัติ
      assert.strictEqual(s.pending, null);

      const raptors = s.players[0].monsters.filter(m => m && m.cardId === 'dino_small_raptor');
      assert.strictEqual(raptors.length, 2, 'เรียกแรปเตอร์เล็กครบ 2 ตัว');
      assert.strictEqual(s.players[0].spells[0], null);
    }
  },
  {
    name: '5C-PACK-02 dino_pack_hunt (negative): มานาไม่พอ (0 มานา) ใช้งานไม่ได้',
    run(assert) {
      const s = game({
        turn: 3, activeIdx: 1, phase: 'battle',
        p1: { monsters: { 0: { cardId: 'aq_spear', position: 'atk' } } },
        p0: { mana: 0, spells: { 0: 'dino_pack_hunt' }, monsters: { 0: 'dino_trike' }, deck: ['dino_small_raptor', 'dino_small_raptor'] }
      });
      s.players[0].spells[0].flags.setTurn = 1;

      E().applyAction(s, { type: 'attack', player: 1, from: 0, to: 0 });
      assert.strictEqual(s.pending, null, 'มานาไม่พอ ข้ามอัตโนมัติ');
    }
  },

  // ================= 7. aq_shield_wall (counter speed 3, from hand) =================
  {
    name: '5C-SHIELD-01 aq_shield_wall (positive): ใช้จากมือ ยกเลิกการโจมตี 1 ครั้ง',
    run(assert) {
      const s = game({
        turn: 3, activeIdx: 1, phase: 'battle',
        p1: { monsters: { 0: { cardId: 'dino_trex', position: 'atk' } } }, // ATK 2200
        p0: { mana: 2, hand: ['aq_shield_wall'], monsters: { 0: { cardId: 'aq_spear', position: 'atk' } } } // ATK 800
      });
      E().applyAction(s, { type: 'attack', player: 1, from: 0, to: 0 });
      assert.ok(s.pending && s.pending.kind === 'chainWindow');

      const r = E().applyAction(s, { type: 'activateResponse', player: 0, handIdx: 0, effectId: 'shield_wall_negate' });
      assert.strictEqual(r.ok, true);

      // P1 ไม่มีตัวตอบโต้ โซ่แก้ผลอัตโนมัติ
      assert.strictEqual(s.pending, null);

      assert.strictEqual(s.attack, null, 'การโจมตีถูกยกเลิก');
      assert.strictEqual(s.players[0].monsters[0] !== null, true, 'มอนสเตอร์ฝ่ายรับรอด');
      assert.strictEqual(s.players[0].lp, 8000, 'ไม่เสีย LP');
      assert.strictEqual(s.players[0].grave.some(c => c.cardId === 'aq_shield_wall'), true);
    }
  },
  {
    name: '5C-SHIELD-02 aq_shield_wall (negative): มานาไม่พอ (มี 1 มานา ต้องการ 2) ใช้งานไม่ได้',
    run(assert) {
      const s = game({
        turn: 3, activeIdx: 1, phase: 'battle',
        p1: { monsters: { 0: { cardId: 'dino_trex', position: 'atk' } } },
        p0: { mana: 1, hand: ['aq_shield_wall'], monsters: { 0: { cardId: 'aq_spear', position: 'atk' } } }
      });
      E().applyAction(s, { type: 'attack', player: 1, from: 0, to: 0 });
      assert.strictEqual(s.pending, null, 'มานาไม่พอ ข้ามอัตโนมัติ');
    }
  },

  // ================= 8. aq_retreat (counter speed 3, from hand) =================
  {
    name: '5C-RETREAT-01 aq_retreat (positive): ใช้จากมือ ดึงมอนสเตอร์ของเรากลับมือ',
    run(assert) {
      const s = game({
        turn: 3, activeIdx: 1, phase: 'battle',
        p1: { monsters: { 0: { cardId: 'dino_trex', position: 'atk' } } },
        p0: { mana: 1, hand: ['aq_retreat'], monsters: { 0: 'aq_centurion' } }
      });
      E().applyAction(s, { type: 'attack', player: 1, from: 0, to: 0 });
      assert.ok(s.pending && s.pending.kind === 'chainWindow');

      const r = E().applyAction(s, { type: 'activateResponse', player: 0, handIdx: 0, effectId: 'retreat_return' });
      assert.strictEqual(r.ok, true);

      // P1 ไม่มีตัวตอบโต้ โซ่แก้ผลอัตโนมัติ
      assert.strictEqual(s.pending, null);

      assert.strictEqual(s.players[0].monsters[0], null, 'มอนสเตอร์ออกจากสนาม');
      assert.strictEqual(s.players[0].hand.some(c => c.cardId === 'aq_centurion'), true, 'มอนสเตอร์กลับขึ้นมือ');
      assert.strictEqual(s.players[0].grave.some(c => c.cardId === 'aq_retreat'), true, 'retreat ไปสุสาน');
    }
  },
  {
    name: '5C-RETREAT-02 aq_retreat (negative): ไม่มีมอนสเตอร์บนสนาม เงื่อนไขไม่ผ่าน',
    run(assert) {
      const s = game({
        turn: 3, activeIdx: 1, phase: 'battle',
        p1: { monsters: { 0: { cardId: 'dino_trex', position: 'atk' } } },
        p0: { mana: 1, hand: ['aq_retreat'], monsters: {} }
      });
      // โจมตีตรง
      E().applyAction(s, { type: 'attack', player: 1, from: 0, to: null });
      // ไม่มีมอนสเตอร์บนสนามที่จะดึงกลับมือได้
      assert.strictEqual(s.pending, null);
    }
  },

  // ================= 9. aq_pit (set speed 2, on field) =================
  {
    name: '5C-PIT-01 aq_pit (positive): ทำลายมอนสเตอร์ที่โจมตี',
    run(assert) {
      const s = game({
        turn: 3, activeIdx: 1, phase: 'battle',
        p1: { monsters: { 0: { cardId: 'dino_trex', position: 'atk' } } },
        p0: { mana: 2, spells: { 0: 'aq_pit' }, monsters: { 0: 'aq_spear' } }
      });
      s.players[0].spells[0].flags.setTurn = 1;

      E().applyAction(s, { type: 'attack', player: 1, from: 0, to: 0 });
      assert.ok(s.pending && s.pending.kind === 'chainWindow');

      const r = E().applyAction(s, { type: 'activateResponse', player: 0, spellSlot: 0, effectId: 'pit_destroy' });
      assert.strictEqual(r.ok, true);

      // P1 ไม่มีตัวตอบโต้ โซ่แก้ผลอัตโนมัติ
      assert.strictEqual(s.pending, null);

      assert.strictEqual(s.players[1].monsters[0], null, 'มอนสเตอร์ที่โจมตีถูกทำลาย');
      assert.strictEqual(s.players[1].grave.some(c => c.cardId === 'dino_trex'), true);
      assert.strictEqual(s.attack, null, 'การต่อสู้อวสาน');
      assert.strictEqual(s.players[0].spells[0], null);
    }
  },
  {
    name: '5C-PIT-02 aq_pit (negative): ศัตรูไม่ได้โจมตี (Main Phase) ไม่สามารถเปิดใช้ได้',
    run(assert) {
      const s = game({
        turn: 3, activeIdx: 0, phase: 'main1',
        p0: { mana: 2, spells: { 0: 'aq_pit' }, monsters: {} },
        p1: { monsters: { 0: 'dino_trex' } }
      });
      s.players[0].spells[0].flags.setTurn = 1;

      // ใน Main Phase ไม่มี attackDeclared
      const actions = E().getLegalActions(s, 0);
      assert.strictEqual(actions.some(a => a.type === 'activateSpell' && a.spellSlot === 0), false);
    }
  },

  // ================= 10. aq_triumph (set speed 2, on field) =================
  {
    name: '5C-TRIUMPH-01 aq_triumph (positive): เมื่อชนะการต่อสู้ เรียกมอนสเตอร์อาควิลาจากสุสาน',
    run(assert) {
      const s = game({
        turn: 3, activeIdx: 0, phase: 'battle',
        p0: { mana: 2, spells: { 0: 'aq_triumph' }, monsters: { 0: { cardId: 'aq_imperator', position: 'atk' } }, grave: ['aq_centurion'] }, // ATK 2600
        p1: { monsters: { 0: { cardId: 'dino_small_raptor', position: 'atk' } } } // ATK 600
      });
      s.players[0].spells[0].flags.setTurn = 1;

      // P0 โจมตี small_raptor และชนะการต่อสู้
      E().applyAction(s, { type: 'attack', player: 0, from: 0, to: 0 });

      // หลังคำนวณดาเมจ ทำลายศัตรู เกิดหน้าต่าง battleWon
      assert.ok(s.pending && s.pending.kind === 'chainWindow', 'เปิดหน้าต่าง battleWon');
      assert.strictEqual(s.pending.player, 0);

      const r = E().applyAction(s, { type: 'activateResponse', player: 0, spellSlot: 0, effectId: 'triumph_summon' });
      assert.strictEqual(r.ok, true);

      // P1 ไม่มีตัวตอบโต้ โซ่แก้ผลอัตโนมัติ
      assert.strictEqual(s.pending, null);

      assert.strictEqual(s.players[0].monsters.some(m => m && m.cardId === 'aq_centurion'), true, 'เรียกเซนทูเรียนจากสุสาน');
      assert.strictEqual(s.players[0].spells[0], null);
    }
  },
  {
    name: '5C-TRIUMPH-02 aq_triumph (negative): แพ้การต่อสู้ หน้าต่าง battleWon ไม่เปิดให้ใช้งาน',
    run(assert) {
      const s = game({
        turn: 3, activeIdx: 0, phase: 'battle',
        p0: { mana: 2, spells: { 0: 'aq_triumph' }, monsters: { 0: { cardId: 'aq_spear', position: 'atk' } }, grave: ['aq_centurion'] }, // ATK 800
        p1: { monsters: { 0: { cardId: 'dino_trex', position: 'atk' } } } // ATK 2200
      });
      s.players[0].spells[0].flags.setTurn = 1;

      // P0 โจมตีและตายเอง
      E().applyAction(s, { type: 'attack', player: 0, from: 0, to: 0 });
      // P0 ไม่ชนะการต่อสู้ หน้าต่าง battleWon จึงไม่เปิดให้ P0
      assert.strictEqual(s.pending, null);
    }
  },

  // ================= 11. Negate monster effect by Counter Spell =================
  {
    name: '5C-NEGATE-01 เอฟเฟกต์มอนสเตอร์ถูกลบล้างด้วย Counter Spell (Speed 3)',
    run(assert) {
      const s = game({
        turn: 3, activeIdx: 1, phase: 'battle',
        p1: { mana: 2, monsters: { 0: { cardId: 'dino_trex', position: 'atk' } }, hand: ['dino_roar'] },
        p0: { mana: 1, monsters: { 0: { cardId: 'aq_sagittarius', position: 'atk' } } }
      });

      // P1 โจมตี
      E().applyAction(s, { type: 'attack', player: 1, from: 0, to: 0 });
      assert.ok(s.pending && s.pending.player === 0);

      // Link 1: P0 เปิดใช้เอฟเฟกต์มอนสเตอร์ aq_sagittarius (speed 2)
      E().applyAction(s, { type: 'activateResponse', player: 0, slot: 0, effectId: 'atk_down' });
      assert.ok(s.pending && s.pending.player === 1, 'P1 มี dino_roar จึงเปิดหน้าต่างตอบโต้ให้ P1');

      // Link 2: P1 สวนกลับด้วย dino_roar (speed 3) โดยส่ง dino_trex ไปสุสาน
      const r2 = E().applyAction(s, { type: 'activateResponse', player: 1, handIdx: 0, effectId: 'roar_negate' });
      assert.strictEqual(r2.ok, true);

      // P0 ไม่มีตัวตอบโต้ความเร็ว 3 โซ่แก้ผลอัตโนมัติ
      assert.strictEqual(s.pending, null);

      // ผล: dino_roar ทำงาน ส่ง dino_roar ไปสุสาน และ atk_down ถูกลบล้าง
      assert.strictEqual(s.players[1].grave.some(c => c.cardId === 'dino_roar'), true, 'dino_roar ถูกส่งไปสุสาน');
    }
  },

  // ================= 12. passPriority closes chain =================
  {
    name: '5C-PRIORITY-01 passPriority ปิดโซ่เมื่อผู้เล่นเลือกผ่านสิทธิ์',
    run(assert) {
      const s = game({
        turn: 3, activeIdx: 1, phase: 'battle',
        p1: { mana: 2, monsters: { 0: { cardId: 'dino_trex', position: 'atk' } }, hand: ['dino_roar'] },
        p0: { mana: 1, monsters: { 0: { cardId: 'aq_sagittarius', position: 'atk' } } }
      });

      E().applyAction(s, { type: 'attack', player: 1, from: 0, to: 0 });

      // Link 1: P0 เปิด aq_sagittarius
      E().applyAction(s, { type: 'activateResponse', player: 0, slot: 0, effectId: 'atk_down' });
      assert.ok(s.pending && s.pending.player === 1);

      // P1 มี dino_roar แต่เลือก passPriority
      const rPass = E().applyAction(s, { type: 'passPriority', player: 1 });
      assert.strictEqual(rPass.ok, true);
      assert.strictEqual(s.pending, null, 'โซ่ปิดแล้ว');

      // atk_down ทำงานสำเร็จ dino_trex ถูกลด ATK 300 (2200 -> 1900)
      assert.strictEqual(E().atk(s.players[1].monsters[0]), 1900);
    }
  }
];
