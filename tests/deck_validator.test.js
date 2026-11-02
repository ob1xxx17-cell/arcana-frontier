// tests/deck_validator.test.js - ระบบตรวจสอบความถูกต้องของเด็คและเอฟเฟกต์อัตโนมัติ
(function () {
  const CG = (globalThis.CG = globalThis.CG || {});
  const E = () => CG.engine;
  const FX = () => CG.effects;

  module.exports = [
    {
      name: 'VAL-01: ตรวจสอบ Trigger ของการ์ดสเปลทุกใบในทุกเด็ค ห้ามใช้ onSummon เป็น trigger ร่ายปกติ',
      run(assert) {
        const decks = ['dinosaur', 'aquila', 'mecha_strike', 'mecha_scrap', 'luna_guardians', 'cube_forge'];
        const invalidSpells = [];

        for (const dKey of decks) {
          const d = CG.cards[dKey];
          if (!d) continue;
          const spells = (d.main || []).filter(c => c.type === 'spell');
          for (const sp of spells) {
            for (const eff of (sp.effects || [])) {
              // สเปลปกติ (ไม่ใช่ field หรือ continuous ที่มี watch คอยเฝ้าสังเกตมอนสเตอร์ลงสนาม) ห้ามใช้ onSummon
              if (eff.trigger === 'onSummon' && !eff.watch) {
                invalidSpells.push({ deck: dKey, card: sp.name, cardId: sp.id, effect: eff.name });
              }
            }
          }
        }

        assert.strictEqual(invalidSpells.length, 0, 'ต้องไม่มีสเปลปกติที่ใช้ onSummon: ' + JSON.stringify(invalidSpells));
      }
    },

    {
      name: 'VAL-02: ตรวจสอบทุก Effect OP ในทุกเด็ค ต้องเป็น Primitive ที่ Engine ลงทะเบียนไว้จริง',
      run(assert) {
        const registeredOps = new Set(Object.keys(FX().ops || {}));
        const decks = ['dinosaur', 'aquila', 'mecha_strike', 'mecha_scrap', 'luna_guardians', 'cube_forge'];
        const unknownOps = [];

        function check(step, c, eff) {
          if (!step || typeof step !== 'object') return;
          if (!registeredOps.has(step.op)) {
            unknownOps.push({ card: c.name, id: c.id, effect: eff.name, op: step.op });
          }
          if (step.op === 'choice' && Array.isArray(step.options)) {
            for (const opt of step.options) {
              if (Array.isArray(opt.do)) for (const s of opt.do) check(s, c, eff);
            }
          }
        }

        for (const dKey of decks) {
          const d = CG.cards[dKey];
          if (!d) continue;
          const all = (d.main || []).concat(d.extra || []);
          for (const c of all) {
            for (const eff of (c.effects || [])) {
              for (const s of (eff.do || [])) check(s, c, eff);
            }
          }
        }

        assert.strictEqual(unknownOps.length, 0, 'พบ OP ที่ไม่มีในระบบ: ' + JSON.stringify(unknownOps));
      }
    },

    {
      name: 'VAL-03: ตรวจสอบทุก Condition ในทุกเด็ค ต้องเป็น Condition ที่ Engine ลงทะเบียนไว้จริง',
      run(assert) {
        const registeredConds = new Set(Object.keys(FX().conditions || {}));
        const decks = ['dinosaur', 'aquila', 'mecha_strike', 'mecha_scrap', 'luna_guardians', 'cube_forge'];
        const unknownConds = [];

        function checkCond(cond, c, eff) {
          if (!cond) return;
          if (Array.isArray(cond)) {
            for (const item of cond) checkCond(item, c, eff);
            return;
          }
          if (typeof cond !== 'object') return;
          if (!registeredConds.has(cond.op)) {
            unknownConds.push({ card: c.name, id: c.id, effect: eff.name, cond: cond.op });
          }
        }

        for (const dKey of decks) {
          const d = CG.cards[dKey];
          if (!d) continue;
          const all = (d.main || []).concat(d.extra || []);
          for (const c of all) {
            for (const eff of (c.effects || [])) {
              checkCond(eff.condition || eff.conditions, c, eff);
              for (const s of (eff.do || [])) {
                if (s.condition) checkCond(s.condition, c, eff);
                if (s.op === 'choice' && Array.isArray(s.options)) {
                  for (const opt of s.options) {
                    if (opt && opt.condition) checkCond(opt.condition, c, eff);
                  }
                }
              }
            }
          }
        }

        assert.strictEqual(unknownConds.length, 0, 'พบ Condition ที่ไม่มีในระบบ: ' + JSON.stringify(unknownConds));
      }
    },

    {
      name: 'VAL-04: ตรวจสอบการร่ายสเปลต่อเนื่อง (ดาบ) จากมือ ต้องถูกวางลงในช่อง Spell และแสดงผล Aura บนสนาม',
      run(assert) {
        const s = CG.test.makeGame({
          deckA: 'cube_forge', deckB: 'cube_forge',
          turn: 1, activeIdx: 0, phase: 'main1',
          config: { chainMode: true },
          p0: {
            mana: 2,
            hand: ['cube_wood_sword'],
            monsters: { 0: 'cube_kobo_trainee' }
          }
        });

        const initialAtk = E().atk(s.players[0].monsters[0]);
        assert.strictEqual(initialAtk, 800, 'ATK เริ่มต้นของคูโบคือ 800');

        const castRes = E().applyAction(s, { type: 'activateSpell', player: 0, handIdx: 0 });
        assert.strictEqual(castRes.ok, true, 'ร่ายดาบกิ่งไม้สำเร็จ');

        // ดาบต้องอยู่ในช่องสเปล ไม่ใช่หายไป
        assert.ok(s.players[0].spells.some(sp => sp && sp.cardId === 'cube_wood_sword'), 'ดาบกิ่งไม้ถูกวางในช่องสเปลบนสนาม');

        // รีเฟรชและตรวจสอบพลังโจมตีที่เพิ่มจากออร่าของดาบ (+300 ATK)
        E().refreshAuras(s);
        const buffedAtk = E().atk(s.players[0].monsters[0]);
        assert.strictEqual(buffedAtk, 1100, 'ATK ของคูโบต้องเพิ่มเป็น 1100 จากออร่าดาบกิ่งไม้');
      }
    },

    {
      name: 'VAL-05: ตรวจสอบ Flow อัญเชิญพิเศษในโหมด UI (เลือกตัว -> เลือกช่องลง -> เลือกตั้งตี/กัน)',
      run(assert) {
        const s = CG.test.makeGame({
          deckA: 'luna_guardians', deckB: 'luna_guardians',
          turn: 1, activeIdx: 0, phase: 'main1',
          config: { chainMode: true, autoChoose: false, interactiveChoice: true, interactiveSlot: true, interactivePosition: true },
          p0: {
            mana: 3,
            hand: ['luna_rebirth'],
            grave: ['luna_ember', 'luna_marina']
          }
        });

        // ร่ายเวทชุบชีวิต
        const castRes = E().applyAction(s, { type: 'activateSpell', player: 0, handIdx: 0 });
        assert.strictEqual(castRes.ok, true, 'ร่ายจันทร์คืนชีพสำเร็จ');

        // ขั้นตอนที่ 1: เลือกการ์ดที่จะชุบจากสุสาน (CHOOSE_CARDS)
        assert.ok(s.pending, 'มี pending เลือกการ์ด');
        assert.strictEqual(s.pending.kind, 'chooseCards');
        assert.strictEqual(s.pending.prompt, 'CHOOSE_CARDS');

        // ผู้เล่นเลือกเอมเบอร์ (index 0)
        const rCard = E().applyAction(s, { type: 'respond', player: 0, choice: [0] });
        assert.strictEqual(rCard.ok, true, 'ตอบเลือกเอมเบอร์สำเร็จ');

        // ขั้นตอนที่ 2: เลือกช่องลง (CHOOSE_SLOT)
        assert.ok(s.pending, 'มี pending เกิดขึ้น');
        assert.strictEqual(s.pending.kind, 'chooseSlot', 'ต้องเปิดให้เลือกช่องลง');
        assert.strictEqual(s.pending.prompt, 'CHOOSE_SLOT');

        // ผู้เล่นเลือกช่องที่ 4 (index 3 หรือ slot 3)
        const targetSlotIdx = s.pending.options.findIndex(o => o.slot === 3 || o.index === 3);
        assert.ok(targetSlotIdx >= 0, 'ช่อง 3 ว่างและเลือกได้');
        const rSlot = E().applyAction(s, { type: 'respond', player: 0, choice: [targetSlotIdx] });
        assert.strictEqual(rSlot.ok, true, 'ตอบเลือกช่องสำเร็จ');

        // ขั้นตอนที่ 3: เลือกท่าลง (CHOOSE_SUMMON_POSITION)
        assert.ok(s.pending, 'มี pending เลือกท่า');
        assert.strictEqual(s.pending.kind, 'chooseOption', 'ต้องเปิดให้เลือกท่า');
        assert.strictEqual(s.pending.prompt, 'CHOOSE_SUMMON_POSITION');

        // ผู้เล่นเลือกท่าที่ 1: ตั้งป้องกัน (choice: [1])
        const rPos = E().applyAction(s, { type: 'respond', player: 0, choice: [1] });
        assert.strictEqual(rPos.ok, true, 'ตอบเลือกท่าป้องกันสำเร็จ');

        // ตรวจสอบผลลัพธ์มอนสเตอร์บนสนาม
        const summoned = s.players[0].monsters[3];
        assert.ok(summoned, 'เอมเบอร์ถูกเรียกมาที่ช่อง 3 ตรงตามที่เลือก');
        assert.strictEqual(summoned.cardId, 'luna_ember', 'เป็นการ์ดเอมเบอร์');
        assert.strictEqual(summoned.position, 'def', 'เอมเบอร์ต้องอยู่ในท่าป้องกัน (def) ตามที่ผู้เล่นเลือก');
      }
    }
  ];
})();
