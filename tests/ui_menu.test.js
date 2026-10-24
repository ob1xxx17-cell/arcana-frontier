// tests/ui_menu.test.js - 6E: Accessibility tests for human UI menu actions
// 100 bot-vs-bot games: every non-pending legal action MUST have a corresponding button in V.getMenuActions
const path = require('path');
const fs = require('fs');
const vm = require('vm');

const root = path.join(__dirname, '..');
if (!CG.ui || !CG.ui.view || !CG.ui.view.getMenuActions) {
  for (const f of ['strings_th.js', 'view.js', 'app.js']) {
    const file = path.join(root, 'ui', f);
    if (fs.existsSync(file)) {
      vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file });
    }
  }
}

const tests = module.exports = [];
const t = (name, fn) => tests.push({ name, run: fn });

function actor(s) {
  if (s.phase === 'mulligan') {
    const i = s.players.findIndex(p => !p.flags.mulliganDone);
    return i < 0 ? 0 : i;
  }
  if (s.pending) return s.pending.player;
  return s.activeIdx;
}

function isSameAction(a, b) {
  if (!a || !b) return false;
  if (a.type !== b.type || a.player !== b.player) return false;
  const fields = ['handIdx', 'slot', 'spellSlot', 'extraIdx', 'targetSlot', 'from', 'to', 'effectId'];
  for (const f of fields) {
    if (a[f] !== b[f]) return false;
  }
  if (a.materials || b.materials) {
    if (!a.materials || !b.materials) return false;
    if (a.materials.length !== b.materials.length) return false;
    const ma = a.materials.slice().sort(), mb = b.materials.slice().sort();
    for (let i = 0; i < ma.length; i++) {
      if (ma[i] !== mb[i]) return false;
    }
  }
  return true;
}

function getSelectionForAction(act) {
  if (act.handIdx !== undefined) return { kind: 'hand', idx: act.handIdx };
  if (act.spellSlot !== undefined) return { kind: 'spell', slot: act.spellSlot };
  if (act.slot !== undefined) return { kind: 'field', slot: act.slot };
  if (act.from !== undefined) return { kind: 'field', slot: act.from };
  if (act.extraIdx !== undefined) return { kind: 'extra', idx: act.extraIdx };
  if (act.type === 'advancePhase' || act.type === 'endTurn') return { kind: 'global' };
  if (act.type === 'activateResponse') return { kind: 'chain' };
  if (act.type === 'mulligan' || act.type === 'pass') return { kind: 'mulligan' };
  return null;
}

function getCardForAction(state, act) {
  const p = state.players[act.player];
  if (!p) return null;
  const E = CG.engine;
  if (act.handIdx !== undefined && p.hand[act.handIdx]) return E.cardOf(p.hand[act.handIdx]);
  if (act.spellSlot !== undefined && p.spells[act.spellSlot]) return E.cardOf(p.spells[act.spellSlot]);
  if (act.slot !== undefined && p.monsters[act.slot]) return E.cardOf(p.monsters[act.slot]);
  if (act.from !== undefined && p.monsters[act.from]) return E.cardOf(p.monsters[act.from]);
  if (act.extraIdx !== undefined && p.extra && p.extra[act.extraIdx]) return E.cardOf(p.extra[act.extraIdx]);
  return null;
}

t('UI-01 ครอบคลุมการเข้าถึงได้: 100 เกม bot vs bot ทุก legalAction (ยกเว้น respond/passPriority) ต้องมีปุ่มตรงเป๊ะใน V.getMenuActions', assert => {
  const E = CG.engine, V = CG.ui.view;
  const botChoose = (CG.bot && CG.bot.chooseAction) || CG.ui.botChoose;
  const GAMES = 100;
  let totalActionsChecked = 0;
  let totalDecisions = 0;
  const actionTypeCounts = {};

  for (let i = 0; i < GAMES; i++) {
    const seed = i + 1;
    const deckA = i % 2 === 0 ? 'dinosaur' : 'aquila';
    const deckB = i % 2 === 0 ? 'aquila' : 'dinosaur';
    const s = E.createGame({ deckA, deckB, seed, mode: 'bot', config: { autoChoose: false, chainMode: true } });
    let steps = 0;
    const maxSteps = 4000;

    while (!s.ended && steps < maxSteps) {
      steps++;
      const act0 = actor(s);
      const legal = E.getLegalActions(s, act0);
      if (!legal.length) break;

      totalDecisions++;
      const testActions = legal.filter(a => a.type !== 'respond' && a.type !== 'passPriority');

      if (testActions.length > 0) {
        // 1. ตรวจสอบจากผลลัพธ์ระดับรวม (selection = null)
        const allButtons = V.getMenuActions(s, act0, null, legal);
        assert.ok(Array.isArray(allButtons), 'getMenuActions ต้องคืนค่าเป็น Array');

        for (const act of testActions) {
          totalActionsChecked++;
          actionTypeCounts[act.type] = (actionTypeCounts[act.type] || 0) + 1;

          const matchAll = allButtons.find(b => isSameAction(b.action, act));
          if (!matchAll) {
            const card = getCardForAction(s, act);
            const cardName = card ? card.name : '(ไม่มี)';
            assert.fail('ไม่พบบุ่มสำหรับ action ชนิด ' + act.type + ' ของการ์ด ' + cardName + ' (action: ' + JSON.stringify(act) + ')');
          }
          assert.strictEqual(matchAll.enabled, true, 'ปุ่มที่มาจาก legalAction ต้อง enabled: true');
          assert.ok(typeof matchAll.label === 'string' && matchAll.label.length > 0, 'ปุ่มต้องมีข้อความ label');

          // 2. ตรวจสอบจากการเลือกเป้าหมายเฉพาะเจาะจง (selection-specific)
          const sel = getSelectionForAction(act);
          if (sel) {
            const selButtons = V.getMenuActions(s, act0, sel, legal);
            const matchSel = selButtons.find(b => isSameAction(b.action, act));
            if (!matchSel) {
              const card = getCardForAction(s, act);
              const cardName = card ? card.name : '(ไม่มี)';
              assert.fail('ไม่พบบุ่มเฉพาะส่วนสำหรับ action ชนิด ' + act.type + ' ของการ์ด ' + cardName + ' (sel: ' + JSON.stringify(sel) + ', action: ' + JSON.stringify(act) + ')');
            }
          }
        }
      }

      // เดินเกมต่อด้วยบอท
      const a = botChoose(s, act0, legal);
      const r = E.applyAction(s, a);
      if (!r.ok) {
        const fb = legal.find(x => x.type === 'advancePhase') || legal.find(x => x.type === 'endTurn') || legal.find(x => x.type === 'passPriority') || legal[0];
        const r2 = E.applyAction(s, fb);
        if (!r2.ok) break;
      }
    }
  }

  assert.ok(totalActionsChecked > 1000, 'ต้องมีการตรวจเช็ค actions จำนวนมากพอ (ตรวจไป ' + totalActionsChecked + ' ครั้ง)');
  // ยืนยันว่ามีการตรวจ action หลากหลายชนิดจริง
  assert.ok(actionTypeCounts['advancePhase'] > 0, 'ต้องมี advancePhase');
  assert.ok(actionTypeCounts['endTurn'] > 0, 'ต้องมี endTurn');
});

t('UI-02 ตรวจสอบปุ่ม disabled และเหตุผลสั้น ๆ ภาษาไทยสำหรับมอนสเตอร์ สเปล และการหมอบ', assert => {
  const E = CG.engine, V = CG.ui.view, S = CG.ui.strings;
  // สร้างเกมทดสอบสถานการณ์
  const s = E.createGame({ deckA: 'dinosaur', deckB: 'aquila', seed: 42, mode: 'pvp', config: { autoChoose: false, chainMode: true } });
  // ข้าม mulligan
  E.applyAction(s, { type: 'pass', player: 0 });
  E.applyAction(s, { type: 'pass', player: 1 });

  // Main 1 ของ P0
  const legal = E.getLegalActions(s, 0);

  // ตรวจการ์ดในมือ P0 ทุกใบ
  const p0 = s.players[0];
  for (let i = 0; i < p0.hand.length; i++) {
    const c = p0.hand[i];
    const d = E.cardOf(c);
    const btns = V.getMenuActions(s, 0, { kind: 'hand', idx: i }, legal);
    assert.ok(btns.length > 0, 'ต้องมีปุ่มอย่างน้อย 1 ปุ่มสำหรับการ์ดในมือ');

    if (d.type === 'spell') {
      // สเปลต้องมีปุ่มใช้สเปล และ/หรือ หมอบสเปล
      const hasSpellBtn = btns.some(b => b.type === 'activateSpell' || b.type === 'setSpell');
      assert.ok(hasSpellBtn, 'สเปลต้องมีปุ่ม activateSpell หรือ setSpell');
    } else {
      // มอนสเตอร์ต้องมีปุ่ม summon / set
      const hasMonBtn = btns.some(b => b.type === 'normalSummon' || b.type === 'setMonster');
      assert.ok(hasMonBtn, 'มอนสเตอร์ต้องมีปุ่ม summon หรือ setMonster');
    }

    // ทุกปุ่มที่ disabled ต้องมีเหตุผลภาษาไทย
    btns.filter(b => !b.enabled).forEach(b => {
      assert.ok(typeof b.reason === 'string' && b.reason.length > 0, 'ปุ่ม disabled ต้องมีเหตุผลภาษาไทย');
    });
  }
});

t('UI-03 ลบข้อความ notUsable สมบูรณ์ และสถานะสเปลในมือแสดงชัดเจน', assert => {
  const S = CG.ui.strings;
  assert.strictEqual(S.app.notUsable, undefined, 'S.app.notUsable ต้องถูกลบออกแล้ว');
  assert.ok(S.app.activateSpell, 'ต้องมีข้อความ activateSpell');
  assert.ok(S.app.setSpell, 'ต้องมีข้อความ setSpell');
  assert.ok(S.app.activateEffect, 'ต้องมีข้อความ activateEffect');

  // ตรวจกลุ่มสเปล
  const groups = ['normal', 'set', 'counter', 'continuous', 'field'];
  for (const g of groups) {
    assert.ok(S.spellGroup[g], 'ต้องมีชื่อกลุ่มสเปล ' + g);
  }

  // ตรวจการเรนเดอร์ cardHtml ของสเปล
  const V = CG.ui.view;
  const spellCard = { uid: 999, cardId: 'dino_call', faceDown: false, position: 'atk' };
  const html = V.cardHtml(spellCard, { reveal: true });
  assert.ok(html.includes('sp-badge'), 'ต้องมีคลาส sp-badge ในการแสดงกลุ่มสเปล');
  assert.ok(!html.includes('undefined'), 'ต้องไม่มี undefined ใน html การ์ด');
});
