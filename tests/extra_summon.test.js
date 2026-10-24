// tests/extra_summon.test.js - ชุดทดสอบ Extra Summon (Grade 4 และฮาสตาตัส) ขั้น 6C
const E = () => CG.engine;
const FX = () => CG.effects;
const game = o => CG.test.makeGame(Object.assign({ deckA: 'dinosaur', deckB: 'aquila', seed: 1 }, o));

module.exports = [
  {
    name: 'EXS-01 เรียก Grade 4 (aq_dictator) สำเร็จ: จ่ายต้นทุนทิ้งมอนสเตอร์อาควิลา 1 ใบจากมือ วางทับมอนสเตอร์อาควิลา (chainMode=true, autoChoose=false)',
    run(assert) {
      const s = game({
        config: { chainMode: true, autoChoose: false },
        turn: 3,
        activeIdx: 0,
        phase: 'main1',
        p0: {
          extra: ['aq_dictator'],
          hand: ['aq_sagittarius'],
          monsters: { 0: 'aq_spear' },
          mana: 5
        },
        p1: { monsters: {}, mana: 0 }
      });

      const r = E().applyAction(s, { type: 'extraSummon', player: 0, extraIdx: 0, targetSlot: 0 });
      assert.ok(r.ok, 'เรียก extraSummon สำเร็จ: ' + r.error);

      // มอนสเตอร์ในช่อง 0 ต้องกลายเป็น aq_dictator
      const m = s.players[0].monsters[0];
      assert.ok(m, 'พบมอนสเตอร์ที่ช่อง 0');
      assert.strictEqual(m.cardId, 'aq_dictator');
      assert.strictEqual(m.level, 3);
      assert.strictEqual(m.baseAtk, 2000);
      assert.strictEqual(m.baseDef, 2000);

      // ตัวใต้ต้องเป็น aq_spear
      assert.strictEqual(m.under.length, 1);
      assert.strictEqual(m.under[0].cardId, 'aq_spear');

      // จ่ายต้นทุน: aq_sagittarius จากมือลงสุสาน
      assert.strictEqual(s.players[0].hand.length, 0);
      assert.ok(s.players[0].grave.some(c => c.cardId === 'aq_sagittarius'), 'aq_sagittarius ลงสุสานเป็นต้นทุน');

      // Grade 4 flag ถูกตั้งค่า
      assert.strictEqual(s.players[0].flags.grade4SummonedThisTurn, true);

      // บันทึก event summon how: extra
      const sumEv = s.log.find(e => e.type === 'summon' && e.how === 'extra');
      assert.ok(sumEv, 'มี event summon พร้อม how: extra');
    }
  },

  {
    name: 'EXS-02 เรียก Grade 4 (dino_mega_tyrant) สำเร็จ: เอาไข่ 3 ใบจากสุสานกลับเด็คและสับเด็ค (chainMode=true, autoChoose=false)',
    run(assert) {
      const s = game({
        config: { chainMode: true, autoChoose: false },
        turn: 3,
        activeIdx: 0,
        phase: 'main1',
        p0: {
          extra: ['dino_mega_tyrant'],
          grave: ['dino_egg', 'dino_egg', 'dino_egg'],
          monsters: { 1: 'dino_trike' },
          deck: ['dino_compy'],
          mana: 5
        },
        p1: { monsters: {}, mana: 0 }
      });

      const r = E().applyAction(s, { type: 'extraSummon', player: 0, extraIdx: 0, targetSlot: 1 });
      assert.ok(r.ok, 'เรียก extraSummon เมกะไทแรนต์สำเร็จ: ' + r.error);

      const m = s.players[0].monsters[1];
      assert.ok(m, 'พบเมกะไทแรนต์ที่ช่อง 1');
      assert.strictEqual(m.cardId, 'dino_mega_tyrant');
      assert.strictEqual(m.level, 3);
      assert.strictEqual(m.baseAtk, 3000);
      assert.strictEqual(m.baseDef, 2000);

      // ตัวใต้มี dino_trike 1 ตัว
      assert.strictEqual(m.under.length, 1);
      assert.strictEqual(m.under[0].cardId, 'dino_trike');

      // สุสานไม่มีไข่แล้ว ไข่ทั้ง 3 ใบกลับเข้าเด็ค
      assert.strictEqual(s.players[0].grave.filter(c => c.cardId === 'dino_egg').length, 0);
      assert.strictEqual(s.players[0].deck.filter(c => c.cardId === 'dino_egg').length, 3);
      assert.strictEqual(s.players[0].flags.grade4SummonedThisTurn, true);
    }
  },

  {
    name: 'EXS-03 ข้อลบ: เรียก Grade 4 ใบที่ 2 ในเทิร์นเดียวกันถูกปฏิเสธ (GRADE4_LIMIT)',
    run(assert) {
      const s = game({
        config: { chainMode: true, autoChoose: false },
        turn: 3,
        activeIdx: 0,
        phase: 'main1',
        p0: {
          extra: ['aq_dictator', 'aq_dictator'],
          hand: ['aq_sagittarius', 'aq_eques'],
          monsters: { 0: 'aq_spear', 1: 'aq_spear' },
          mana: 5
        },
        p1: { monsters: {}, mana: 0 }
      });

      // เรียกใบแรกสำเร็จ
      const r1 = E().applyAction(s, { type: 'extraSummon', player: 0, extraIdx: 0, targetSlot: 0 });
      assert.ok(r1.ok, 'ใบแรกสำเร็จ');

      // เรียกใบที่สองในเทิร์นเดียวกันต้องโดน GRADE4_LIMIT
      const r2 = E().applyAction(s, { type: 'extraSummon', player: 0, extraIdx: 0, targetSlot: 1 });
      assert.strictEqual(r2.ok, false);
      assert.strictEqual(r2.error, 'GRADE4_LIMIT', 'ใบที่สองต้องโดนปฏิเสธด้วย GRADE4_LIMIT');
      // มือและการ์ดในสนามยังอยู่ครบ ไม่เสียต้นทุน
      assert.strictEqual(s.players[0].hand.length, 1);
      assert.strictEqual(s.players[0].monsters[1].cardId, 'aq_spear');
    }
  },

  {
    name: 'EXS-04 ข้อลบ: ต้นทุนไม่ครบถูกปฏิเสธโดยไม่จ่ายต้นทุน (chainMode=true, autoChoose=false)',
    run(assert) {
      // 1. เมกะไทแรนต์: ไข่ในสุสานมีแค่ 2 ใบ (ต้องการ 3)
      const sDino = game({
        config: { chainMode: true, autoChoose: false },
        turn: 3,
        activeIdx: 0,
        phase: 'main1',
        p0: {
          extra: ['dino_mega_tyrant'],
          grave: ['dino_egg', 'dino_egg'],
          monsters: { 0: 'dino_trike' }
        }
      });
      const rDino = E().applyAction(sDino, { type: 'extraSummon', player: 0, extraIdx: 0, targetSlot: 0 });
      assert.strictEqual(rDino.ok, false);
      assert.strictEqual(rDino.error, 'CONDITION_FAILED');
      assert.strictEqual(sDino.players[0].grave.length, 2, 'ไข่ยังอยู่ในสุสานครบ ไม่เสียต้นทุน');

      // 2. ดิกเตเตอร์: ในมือไม่มีมอนสเตอร์อาควิลา (มีแต่ไข่ไดโน)
      const sAq = game({
        config: { chainMode: true, autoChoose: false },
        turn: 3,
        activeIdx: 0,
        phase: 'main1',
        p0: {
          extra: ['aq_dictator'],
          hand: ['dino_egg'],
          monsters: { 0: 'aq_spear' }
        }
      });
      const rAq = E().applyAction(sAq, { type: 'extraSummon', player: 0, extraIdx: 0, targetSlot: 0 });
      assert.strictEqual(rAq.ok, false);
      assert.strictEqual(rAq.error, 'CONDITION_FAILED');
      assert.strictEqual(sAq.players[0].hand.length, 1, 'การ์ดในมือยังอยู่ครบ ไม่เสียต้นทุน');
    }
  },

  {
    name: 'EXS-05 จบเทิร์น Grade 4 (aq_dictator) กลับ Extra Deck และตัวใต้ขึ้นมาเป็นตัวบนโดยไม่ถูกทำลาย (ล้าง result/บัฟเดิม)',
    run(assert) {
      const s = game({
        config: { chainMode: true, autoChoose: false },
        turn: 3,
        activeIdx: 0,
        phase: 'main1',
        p0: {
          extra: ['aq_dictator'],
          hand: ['aq_sagittarius'],
          monsters: {
            0: {
              cardId: 'aq_spear',
              level: 1,
              atkMod: 300,
              defMod: 200
            }
          },
          mana: 5
        },
        p1: { monsters: {}, mana: 0 }
      });

      // 1. เรียก Dictator ลงทับ aq_spear
      assert.ok(E().applyAction(s, { type: 'extraSummon', player: 0, extraIdx: 0, targetSlot: 0 }).ok);
      assert.strictEqual(s.players[0].monsters[0].cardId, 'aq_dictator');

      // 2. จบเทิร์น
      assert.ok(E().applyAction(s, { type: 'endTurn', player: 0 }).ok);

      // Dictator ต้องกลับไป Extra Deck
      assert.ok(s.players[0].extra.some(c => c.cardId === 'aq_dictator'), 'Dictator กลับ Extra Deck');

      // aq_spear ตัวใต้ต้องขึ้นมาเป็นตัวบนใหม่ที่ช่อง 0
      const restored = s.players[0].monsters[0];
      assert.ok(restored, 'aq_spear ขึ้นมาเป็นตัวบน');
      assert.strictEqual(restored.cardId, 'aq_spear');
      assert.strictEqual(restored.level, 1, 'level กลับเป็น 1');
      assert.strictEqual(restored.baseAtk, 800, 'baseAtk กลับเป็น 800');
      assert.strictEqual(restored.baseDef, 500, 'baseDef กลับเป็น 500');
      assert.strictEqual(restored.atkMod, 0, 'ล้าง atkMod เดิม');
      assert.strictEqual(restored.defMod, 0, 'ล้าง defMod เดิม');
      assert.strictEqual(restored.under.length, 0);

      // สุสานต้องไม่มี aq_spear (ไม่ถูกทำลาย)
      assert.strictEqual(s.players[0].grave.some(c => c.cardId === 'aq_spear'), false, 'aq_spear ไม่ได้ลงสุสาน');
    }
  },

  {
    name: 'EXS-06 เมกะไทแรนต์ (dino_mega_tyrant) ทำลายตัวใต้ตอน End Phase ด้วยเอฟเฟกต์ของตัวเอง แล้วกลับ Extra Deck ตอนจบเทิร์น',
    run(assert) {
      const s = game({
        config: { chainMode: true, autoChoose: false },
        turn: 3,
        activeIdx: 0,
        phase: 'main1',
        p0: {
          extra: ['dino_mega_tyrant'],
          grave: ['dino_egg', 'dino_egg', 'dino_egg'],
          monsters: { 0: 'dino_trike' },
          mana: 5
        },
        p1: { monsters: {}, mana: 0 }
      });

      // 1. เรียก เมกะไทแรนต์
      assert.ok(E().applyAction(s, { type: 'extraSummon', player: 0, extraIdx: 0, targetSlot: 0 }).ok);
      assert.strictEqual(s.players[0].monsters[0].cardId, 'dino_mega_tyrant');
      assert.strictEqual(s.players[0].monsters[0].under.length, 1);

      // 2. จบเทิร์น (จะเข้าสู่ End Phase ก่อน แล้ว trigger onEndPhase ทำลายตัวใต้ จากนั้นกลับ Extra)
      assert.ok(E().applyAction(s, { type: 'endTurn', player: 0 }).ok);

      // ตรวจสอบ event onDestroyed ของ dino_trike
      assert.ok(s.log.some(e => e.type === 'destroy' && e.by === 'effect'), 'มี event destroy ตัวใต้');
      assert.ok(s.players[0].grave.some(c => c.cardId === 'dino_trike'), 'dino_trike ลงสุสานจากการถูกทำลาย');

      // เมกะไทแรนต์กลับ Extra Deck
      assert.ok(s.players[0].extra.some(c => c.cardId === 'dino_mega_tyrant'), 'เมกะไทแรนต์กลับ Extra');

      // ช่อง 0 ต้องว่างเปล่า (เพราะตัวใต้ถูกทำลายไปแล้วก่อนกลับ Extra)
      assert.strictEqual(s.players[0].monsters[0], null, 'ช่อง 0 ว่างเปล่า');
    }
  },

  {
    name: 'EXS-07 Grade 4 ถูกทำลายระหว่างเทิร์น: ตัวบนกลับ Extra และตัวใต้ถูกทำลายตาม overlayDestroyTogether',
    run(assert) {
      const s = game({
        config: { chainMode: true, autoChoose: false, overlayDestroyTogether: true },
        turn: 3,
        activeIdx: 0,
        phase: 'main1',
        p0: {
          extra: ['dino_mega_tyrant'],
          grave: ['dino_egg', 'dino_egg', 'dino_egg'],
          monsters: { 0: 'dino_trike' },
          mana: 5
        },
        p1: { monsters: {}, mana: 0 }
      });

      // เรียกเมกะไทแรนต์
      assert.ok(E().applyAction(s, { type: 'extraSummon', player: 0, extraIdx: 0, targetSlot: 0 }).ok);

      // ทำลายเมกะไทแรนต์ด้วยเอฟเฟกต์ระหว่างเทิร์น
      E().destroyMonster(s, [], 0, 0, 'effect');

      // เมกะไทแรนต์กลับ Extra Deck
      assert.ok(s.players[0].extra.some(c => c.cardId === 'dino_mega_tyrant'), 'Grade 4 ที่ถูกทำลายกลับ Extra');

      // ตัวใต้ (dino_trike) ต้องถูกทำลายลงสุสานตาม overlayDestroyTogether
      assert.ok(s.players[0].grave.some(c => c.cardId === 'dino_trike'), 'ตัวใต้ลงสุสาน');
      assert.strictEqual(s.players[0].monsters[0], null, 'ช่องสนามว่าง');
    }
  },

  {
    name: 'EXS-08 ความสามารถ immune {source:spell}: บล็อกเอฟเฟกต์สเปลทุกใบ แต่เอฟเฟกต์มอนสเตอร์ยังผ่าน',
    run(assert) {
      const s = game({
        config: { chainMode: true, autoChoose: false },
        turn: 3,
        activeIdx: 0,
        phase: 'main1',
        p0: {
          monsters: {
            0: {
              cardId: 'dino_mega_tyrant',
              position: 'atk',
              faceDown: false
            }
          }
        },
        p1: {
          monsters: { 0: 'aq_imperator' },
          hand: ['aq_war'], // สเปลทำลายมอนสเตอร์ 1 ตัว
          mana: 5
        }
      });

      const tyrant = s.players[0].monsters[0];
      assert.strictEqual(tyrant.cardId, 'dino_mega_tyrant');

      // 1. ลองใช้เอฟเฟกต์สเปลทำลาย (aq_war)
      const warDef = E().findCard('aq_war');
      const warEff = warDef.effects[0];
      const warCtx = { source: E().newInstance(s, warDef, 1), player: 1, trigger: 'spell' };

      // filter/selector ของสเปลต้องไม่เห็นเมกะไทแรนต์
      assert.strictEqual(FX().matchFilter(tyrant, warEff.do[0].target.filter, warCtx), false, 'matchFilter ปฏิเสธสเปล');
      FX().run(s, [], warEff, warCtx);
      assert.ok(s.players[0].monsters[0], 'เมกะไทแรนต์ไม่ถูกทำลายด้วยสเปล');

      // 2. ลองใช้เอฟเฟกต์มอนสเตอร์ทำลาย (เช่น อิมเพเรเตอร์ aq_imperator onSummon ทำลายตัว ATK น้อยกว่า หรือมอนสเตอร์อื่น)
      const monEff = {
        id: 'mon_destroy',
        trigger: 'ignition',
        do: [{ op: 'destroy', target: { side: 'opp', count: 1 } }]
      };
      const monCtx = { source: s.players[1].monsters[0], player: 1, trigger: 'ignition' };
      assert.strictEqual(FX().matchFilter(tyrant, {}, monCtx), true, 'matchFilter ยอมรับเอฟเฟกต์มอนสเตอร์');
      FX().run(s, [], monEff, monCtx);
      assert.strictEqual(s.players[0].monsters[0], null, 'เมกะไทแรนต์ถูกทำลายด้วยเอฟเฟกต์มอนสเตอร์ได้');
    }
  },

  {
    name: 'EXS-09 ฮาสตาตัส (aq_hastatus): เรียกด้วยกองนักรบหอก 2 ใบ + 1 ใบจากมือ (รวม 3 ใบใต้ฮาสตาตัส), ไม่กลับ Extra เอง, และเป็นวัสดุเสียสละไม่ได้',
    run(assert) {
      const s = game({
        config: { chainMode: true, autoChoose: false },
        turn: 3,
        activeIdx: 0,
        phase: 'main1',
        p0: {
          extra: ['aq_hastatus'],
          hand: ['aq_spear', 'aq_sagittarius'], // sagittarius Lv3 สำหรับลองเสียสละ
          monsters: {
            0: {
              cardId: 'aq_spear',
              under: ['aq_spear'] // รวมเป็น 2 ใบ
            }
          },
          mana: 5
        },
        p1: { monsters: {}, mana: 0 }
      });

      // 1. เรียก ฮาสตาตัส
      const r = E().applyAction(s, { type: 'extraSummon', player: 0, extraIdx: 0, targetSlot: 0 });
      assert.ok(r.ok, 'เรียกฮาสตาตัสสำเร็จ: ' + r.error);

      const h = s.players[0].monsters[0];
      assert.ok(h, 'พบฮาสตาตัสบนสนาม');
      assert.strictEqual(h.cardId, 'aq_hastatus');
      assert.strictEqual(h.baseAtk, 2400);
      assert.strictEqual(h.baseDef, 2000);

      // มีการ์ดใต้ฮาสตาตัสทั้งหมด 3 ใบ (2 ใบเดิม + 1 ใบจากมือ)
      assert.strictEqual(h.under.length, 3);
      assert.ok(h.under.every(c => c.cardId === 'aq_spear'), 'การ์ดใต้ทั้งหมดเป็น aq_spear');
      assert.strictEqual(s.players[0].hand.some(c => c.cardId === 'aq_spear'), false, 'aq_spear ออกจากมือไปอยู่ใน under แล้ว');

      // 2. จบเทิร์น: ฮาสตาตัสต้องไม่ออกจากสนาม (ไม่กลับ Extra เอง)
      assert.ok(E().applyAction(s, { type: 'endTurn', player: 0 }).ok);
      assert.strictEqual(s.players[0].monsters[0].cardId, 'aq_hastatus', 'ฮาสตาตัสยังคงอยู่บนสนามหลังจบเทิร์น');

      // 3. ทดสอบการเป็นวัสดุเสียสละ (noTribute): ใช้ฮาสตาตัสเป็นวัสดุเสียสละเรียก sagittarius (Lv3) ต้องโดนปฏิเสธ
      // สลับเทิร์นกลับมาที่ player 0
      assert.ok(E().applyAction(s, { type: 'endTurn', player: 1 }).ok);
      assert.strictEqual(s.activeIdx, 0);

      const rTrib = E().applyAction(s, {
        type: 'tributeSummon',
        player: 0,
        handIdx: 0, // aq_sagittarius (Lv3)
        materials: [0], // ฮาสตาตัส (Lv3)
        slot: 1
      });
      assert.strictEqual(rTrib.ok, false);
      assert.strictEqual(rTrib.error, 'MATERIAL_INVALID', 'ฮาสตาตัสมี noTribute: true เสียสละไม่ได้');
    }
  },

  {
    name: 'EXS-10 Chain fizzle: เมื่อเป้าหมายหายไปก่อน Chain แก้ผล การ์ดยังคงอยู่ใน Extra Deck และไม่คืนต้นทุน (chainMode=true, autoChoose=false)',
    run(assert) {
      const s = game({
        config: { chainMode: true, autoChoose: false },
        turn: 3,
        activeIdx: 0,
        phase: 'main1',
        p0: {
          extra: ['aq_dictator'],
          hand: ['aq_sagittarius'],
          monsters: { 0: 'aq_spear' },
          mana: 5
        },
        p1: { monsters: {}, mana: 0 }
      });

      // 1. ประกาศ extraSummon (จ่ายต้นทุนทิ้ง aq_sagittarius ไปแล้ว)
      // แทรกการทำลายเป้าหมายก่อนแก้ผล (จำลอง fizzle)
      const origResolve = E().resolveChain;
      let intercepted = false;
      E().resolveChain = function (st, evs) {
        if (!intercepted) {
          intercepted = true;
          // ลบเป้าหมายออกจากสนามก่อน chain resolve
          st.players[0].monsters[0] = null;
        }
        return origResolve(st, evs);
      };

      try {
        const r = E().applyAction(s, { type: 'extraSummon', player: 0, extraIdx: 0, targetSlot: 0 });
        assert.ok(r.ok);

        // ตรวจสอบว่าลิงก์ fizzle
        assert.ok(s.log.some(e => e.type === 'chainLinkFizzled'), 'มี event chainLinkFizzled');

        // การ์ดยังคงอยู่ใน Extra Deck
        assert.ok(s.players[0].extra.some(c => c.cardId === 'aq_dictator'), 'Dictator ยังอยู่ใน Extra Deck');

        // ต้นทุนไม่คืน: aq_sagittarius ยังอยู่ในสุสาน
        assert.ok(s.players[0].grave.some(c => c.cardId === 'aq_sagittarius'), 'ต้นทุนไม่คืน (ยังอยู่ในสุสาน)');
      } finally {
        E().resolveChain = origResolve;
      }
    }
  }
];
