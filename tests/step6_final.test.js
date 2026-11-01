// tests/step6_final.test.js - ชุดทดสอบปิดขั้น 6 (6D): preventDestruction ทุกเส้นทาง, บราคิโอ, ฮาสตาตัส, Extra Deck
const E = () => CG.engine;
const FX = () => CG.effects;
const game = o => CG.test.makeGame(Object.assign({ deckA: 'dinosaur', deckB: 'aquila', seed: 1 }, o));

module.exports = [
  {
    name: '6D-01 preventDestruction ในการต่อสู้: ตายตอนไม่มีเงื่อนไข/รอดตอนมีเงื่อนไข (chainMode=true, autoChoose=false)',
    run(assert) {
      // ทดสอบการ์ดทั่วไปที่ไม่มี preventDestruction จะต้องตายในการต่อสู้ตามปกติ
      const s1 = game({
        config: { chainMode: true, autoChoose: false },
        phase: 'battle', turn: 3,
        p0: { monsters: { 0: { cardId: 'aq_gladiator', position: 'atk' } } }, // ATK 1800
        p1: { monsters: { 0: { cardId: 'dino_small_raptor', position: 'atk' } } } // ATK 1000
      });
      const r1 = E().applyAction(s1, { type: 'attack', player: 0, from: 0, to: 0 });
      assert.ok(r1.ok, r1.error);
      assert.strictEqual(s1.players[1].monsters[0], null, 'ตัวที่ไม่มีเงื่อนไขป้องกันต้องถูกทำลาย');
      assert.ok(s1.players[1].grave.some(c => c.cardId === 'dino_small_raptor'), 'ลงสุสานตามปกติ');

      // ทดสอบตัวที่มี preventDestruction และเงื่อนไขตรง รอดจากการต่อสู้
      const s2 = game({
        config: { chainMode: true, autoChoose: false },
        phase: 'battle', turn: 3,
        p0: { monsters: { 0: { cardId: 'aq_gladiator', position: 'atk' } } }, // ATK 1800
        p1: { monsters: { 0: { cardId: 'dino_brachio', position: 'def' } } } // DEF 3000 -> แต่ถ้าเราให้อีกฝ่าย ATK 4000
      });
      // เพิ่ม ATK ให้กลาดิเอเตอร์เป็น 4000
      s2.players[0].monsters[0].atkMod = 2200;
      const r2 = E().applyAction(s2, { type: 'attack', player: 0, from: 0, to: 0 });
      assert.ok(r2.ok, r2.error);
      assert.notStrictEqual(s2.players[1].monsters[0], null, 'บราคิโอในท่าป้องกันต้องรอดจากการต่อสู้');
      assert.strictEqual(s2.players[1].monsters[0].cardId, 'dino_brachio');
      assert.ok(r2.events.some(e => e.type === 'destroyPrevented'), 'มี event destroyPrevented');
    }
  },

  {
    name: '6D-02 บราคิโอซอรัสผู้ทอดเงา (dino_brachio): รอดการต่อสู้เฉพาะท่าป้องกัน แต่ท่าโจมตีตายตามปกติ และ LP คิดตามกติกา',
    run(assert) {
      // 1. ท่าโจมตี (position: 'atk'): ATK 1800 โดนตัว ATK 3000 ตี -> ต้องถูกทำลาย และเสีย LP 1200
      const sAtk = game({
        config: { chainMode: true, autoChoose: false },
        phase: 'battle', turn: 3,
        p0: { monsters: { 0: { cardId: 'aq_gladiator', position: 'atk', atkMod: 1000 } } }, // ATK 2000 + 1000 = 3000
        p1: { lp: 8000, monsters: { 0: { cardId: 'dino_brachio', position: 'atk' } } } // ATK 1800
      });
      const rAtk = E().applyAction(sAtk, { type: 'attack', player: 0, from: 0, to: 0 });
      assert.ok(rAtk.ok);
      assert.strictEqual(sAtk.players[1].monsters[0], null, 'บราคิโอท่าโจมตีต้องถูกทำลาย');
      assert.strictEqual(sAtk.players[1].lp, 6800, 'เสีย LP 1200 จากส่วนต่าง ATK');

      // 2. ท่าป้องกัน (position: 'def'): DEF 3000 โดนตัว ATK 3500 ตี -> ไม่ถูกทำลาย และไม่เสีย LP (เพราะท่าป้องกัน)
      const sDef = game({
        config: { chainMode: true, autoChoose: false },
        phase: 'battle', turn: 3,
        p0: { monsters: { 0: { cardId: 'aq_gladiator', position: 'atk', atkMod: 1700 } } }, // ATK 3500
        p1: { lp: 8000, monsters: { 0: { cardId: 'dino_brachio', position: 'def' } } } // DEF 3000
      });
      const rDef = E().applyAction(sDef, { type: 'attack', player: 0, from: 0, to: 0 });
      assert.ok(rDef.ok);
      assert.notStrictEqual(sDef.players[1].monsters[0], null, 'บราคิโอท่าป้องกันรอด');
      assert.strictEqual(sDef.players[1].lp, 8000, 'ท่าป้องกันตีทะลุไม่เข้า ไม่เสีย LP');
      assert.ok(rDef.events.some(e => e.type === 'destroyPrevented'));
    }
  },

  {
    name: '6D-03 ฮาสตาตัส (aq_hastatus): กันถูกทำลายจากการต่อสู้และเอฟเฟกต์ ส่ง under ลงสุสาน 1 ใบ และลด ATK 500 ถาวรสะสม (เสีย LP ตามปกติ)',
    run(assert) {
      // 1. ถูกโจมตีในการต่อสู้: ATK 2400 โดนตัว 3000 ตี -> เสีย 600 LP แต่ไม่ตาย, under หลุด 1 ใบ, ATK ลดเหลือ 1900
      const s = game({
        config: { chainMode: true, autoChoose: false },
        phase: 'battle', turn: 3,
        p0: { monsters: { 0: { cardId: 'dino_trex', position: 'atk', atkMod: 800 } } }, // ATK 2200 + 800 = 3000
        p1: {
          lp: 8000,
          monsters: {
            0: {
              cardId: 'aq_hastatus',
              position: 'atk',
              under: ['aq_spear', 'aq_spear', 'aq_spear']
            }
          }
        }
      });

      const rAtk = E().applyAction(s, { type: 'attack', player: 0, from: 0, to: 0 });
      assert.ok(rAtk.ok);
      assert.strictEqual(s.players[1].lp, 7400, 'เสีย 600 LP ตามปกติ');
      const h = s.players[1].monsters[0];
      assert.ok(h, 'ฮาสตาตัสยังคงอยู่บนสนาม');
      assert.strictEqual(h.under.length, 2, 'under ลดลงเหลือ 2 ใบ');
      assert.strictEqual(s.players[1].grave.length, 1, 'under 1 ใบลงสุสาน');
      assert.strictEqual(h.atkMod, -500, 'ATK ลดลง 500');
      assert.strictEqual(E().atk(h), 1900, 'ATK สุทธิเหลือ 1900');

      // 2. ถูกทำลายด้วยเอฟเฟกต์ (เช่น สูญพันธุ์ dino_extinct) -> ไม่ตาย, under หลุดอีก 1 ใบ, ATK ลดสะสมเป็น -1000
      const ev = [];
      FX().ops.destroy(s, ev, { target: { side: 'opp', zone: 'monster', filter: { cardId: 'aq_hastatus' } } }, { player: 0 });
      assert.ok(ev.some(e => e.type === 'destroyPrevented'));
      assert.strictEqual(h.under.length, 1, 'under ลดลงเหลือ 1 ใบ');
      assert.strictEqual(s.players[1].grave.length, 2, 'under 2 ใบลงสุสาน');
      assert.strictEqual(h.atkMod, -1000, 'ATK ลดลงสะสมเป็น -1000');
      assert.strictEqual(E().atk(h), 1400, 'ATK สุทธิเหลือ 1400');
    }
  },

  {
    name: '6D-04 ฮาสตาตัส (aq_hastatus): เมื่อไม่มี under ถูกทำลายตามปกติ',
    run(assert) {
      const s = game({
        config: { chainMode: true, autoChoose: false },
        phase: 'battle', turn: 3,
        p0: { monsters: { 0: { cardId: 'dino_trex', position: 'atk', atkMod: 800 } } }, // ATK 3000 > 2400
        p1: {
          lp: 8000,
          monsters: {
            0: {
              cardId: 'aq_hastatus',
              position: 'atk',
              under: [] // ไม่มี under
            }
          }
        }
      });

      const r = E().applyAction(s, { type: 'attack', player: 0, from: 0, to: 0 });
      assert.ok(r.ok);
      assert.strictEqual(s.players[1].monsters[0], null, 'เมื่อไม่มี under ต้องถูกทำลายตามปกติ');
      assert.ok(s.players[1].grave.some(c => c.cardId === 'aq_hastatus'), 'ฮาสตาตัสลงสุสาน');
    }
  },

  {
    name: '6D-05 Extra Deck Monster (ฮาสตาตัส) ถูกนำขึ้นมือ: กลับ Extra Deck และ under ทั้งหมดไปสุสาน',
    run(assert) {
      const s = game({
        config: { chainMode: true, autoChoose: false },
        turn: 3,
        p0: {
          extra: [],
          hand: [],
          grave: [],
          monsters: {
            0: {
              cardId: 'aq_hastatus',
              position: 'atk',
              under: ['aq_spear', 'aq_spear']
            }
          }
        }
      });

      // สั่ง returnToHand
      const ev = [];
      FX().ops.returnToHand(s, ev, { target: { side: 'self', zone: 'monster', filter: { cardId: 'aq_hastatus' } } }, { player: 0 });

      assert.strictEqual(s.players[0].monsters[0], null, 'ออกจากสนามแล้ว');
      assert.strictEqual(s.players[0].hand.length, 0, 'ไม่เข้ามือ');
      assert.strictEqual(s.players[0].extra.length, 1, 'ฮาสตาตัสกลับ Extra Deck');
      assert.strictEqual(s.players[0].extra[0].cardId, 'aq_hastatus');
      assert.strictEqual(s.players[0].grave.length, 2, 'under ทั้งหมด 2 ใบต้องไปสุสาน');
      assert.strictEqual(s.players[0].grave[0].cardId, 'aq_spear');
      assert.strictEqual(s.players[0].grave[1].cardId, 'aq_spear');
    }
  },

  {
    name: '6D-06 การจำลองโหลดตามแท็ก index.html ไม่มี error',
    run(assert) {
      const fs = require('fs');
      const path = require('path');
      const vm = require('vm');

      const indexPath = path.join(__dirname, '..', 'index.html');
      const html = fs.readFileSync(indexPath, 'utf8');

      // ดึง script tags ตามลำดับ
      const scriptTags = [];
      const re = /<script\s+src="([^"]+)"><\/script>/g;
      let match;
      while ((match = re.exec(html)) !== null) {
        scriptTags.push(match[1]);
      }

      assert.ok(scriptTags.length >= 15, 'มี script tags ครบถ้วน');

      // สร้าง sandbox เปล่า และจำลอง DOM จำลองพื้นฐาน
      const sandbox = {
        globalThis: {},
        console: { log() {}, warn() {}, error() {} },
        setTimeout(fn) { return 1; },
        clearTimeout(id) {},
        document: {
          getElementById() { return { classList: { add() {}, remove() {} }, innerHTML: '', appendChild() {} }; },
          addEventListener() {},
          readyState: 'complete'
        },
        window: {}
      };
      sandbox.globalThis = sandbox;
      vm.createContext(sandbox);

      // โหลดตามลำดับแท็กจริงใน index.html
      for (const rawSrc of scriptTags) {
        const src = rawSrc.split('?')[0];
        const fullPath = path.join(__dirname, '..', src);
        assert.ok(fs.existsSync(fullPath), `ไฟล์ตามแท็กต้องมีอยู่จริง: ${src}`);
        const code = fs.readFileSync(fullPath, 'utf8');
        try {
          vm.runInContext(code, sandbox, { filename: fullPath });
        } catch (e) {
          assert.fail(`เกิดข้อผิดพลาดในการโหลด ${src}: ${e.message}`);
        }
      }

      assert.ok(sandbox.globalThis.CG, 'CG ถูกสร้าง');
      assert.ok(sandbox.globalThis.CG.engine, 'CG.engine ถูกสร้าง');
      assert.ok(sandbox.globalThis.CG.cards, 'CG.cards ถูกสร้าง');
      assert.ok(sandbox.globalThis.CG.effects, 'CG.effects ถูกสร้าง');
      assert.ok(sandbox.globalThis.CG.ui, 'CG.ui ถูกสร้าง');
    }
  }
];
