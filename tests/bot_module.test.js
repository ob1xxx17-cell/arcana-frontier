// tests/bot_module.test.js - 7A: ยูนิตเทสต์สำหรับโมดูล bot/bot.js
const assert = require('assert');

const t = (name, fn) => tests.push({ name, run: fn });
const tests = module.exports = [];

// อ้างอิงตรรกะบอทเดิม (baseline fallbackBot ก่อนย้ายโมดูล)
function referenceBot(st, idx, legal) {
  const E = CG.engine;
  const by = (t) => legal.filter(x => x.type === t);
  const cardLv = (a) => E.cardOf(st.players[idx].hand[a.handIdx]) || {};

  if (st.phase === 'mulligan') return by('pass')[0] || legal[0];

  if (st.pending && st.pending.kind === 'chainWindow') {
    const pass = by('passPriority');
    const resp = by('activateResponse');
    if (resp.length > 0) return resp[0];
    return pass[0] || legal[0];
  }

  if (st.pending && st.pending.resume) {
    const pd = st.pending;
    const respond = (choice) => ({ type: 'respond', player: idx, choice });

    if (pd.kind === 'chooseOption' || pd.kind === 'yesNo') return respond([0]);
    if (pd.kind === 'chooseSlot') return respond([0]);

    const opts = pd.options || [];
    const count = pd.min;

    if (opts.length <= count) {
      const all = [];
      for (let i = 0; i < opts.length; i++) all.push(i);
      return respond(all);
    }

    const oppIndices = [], selfIndices = [];
    for (let i = 0; i < opts.length; i++) {
      if (opts[i].side === 'opp') oppIndices.push(i);
      else selfIndices.push(i);
    }

    const prompt = (pd.prompt || '').toUpperCase();
    const isDestroy = prompt.includes('DESTROY') || prompt.includes('TARGET');
    const isSelf = prompt.includes('TRIBUTE') || prompt.includes('COST') || prompt.includes('SEND') || prompt.includes('MATERIAL');
    const isSearch = prompt.includes('SEARCH') || prompt.includes('SUMMON') || prompt.includes('CARDS') || prompt.includes('FUSION') || prompt.includes('EXTRA');

    let selected = [];
    if (isDestroy && oppIndices.length >= count) {
      const sorted = oppIndices.slice().sort((a, b) => {
        const da = E.findCard(opts[a].cardId), db = E.findCard(opts[b].cardId);
        return ((db && db.atk) || 0) - ((da && da.atk) || 0);
      });
      selected = sorted.slice(0, count);
    } else if (isSelf && selfIndices.length >= count) {
      const sorted = selfIndices.slice().sort((a, b) => {
        const da = E.findCard(opts[a].cardId), db = E.findCard(opts[b].cardId);
        return ((da && da.atk) || 0) - ((db && db.atk) || 0);
      });
      selected = sorted.slice(0, count);
    } else if (isSearch) {
      const sorted = opts.map((_, i) => i).sort((a, b) => {
        const da = E.findCard(opts[a].cardId), db = E.findCard(opts[b].cardId);
        return ((db && db.atk) || 0) - ((da && da.atk) || 0);
      });
      selected = sorted.slice(0, count);
    }

    if (selected.length < count) {
      selected = [];
      for (let i = 0; i < count && i < opts.length; i++) selected.push(i);
    }

    return respond(selected.sort((a, b) => a - b));
  }

  if (st.pending) {
    const r = by('respond');
    return r[0] || legal[0];
  }

  const me = st.players[idx], op = st.players[1 - idx];

  const setSpells = by('setSpell').filter(a => {
    const def = E.cardOf(me.hand[a.handIdx]);
    return def && def.group === 'set';
  });
  if (setSpells.length > 0) return setSpells[0];

  const actSpells = by('activateSpell').filter(a => {
    const def = a.handIdx !== undefined ? E.cardOf(me.hand[a.handIdx]) : (a.spellSlot !== undefined ? E.cardOf(me.spells[a.spellSlot]) : null);
    return def && def.effects && def.effects.length > 0 && (def.group === 'normal' || a.spellSlot !== undefined);
  });
  if (actSpells.length > 0) return actSpells[0];

  const ov = by('overlay');
  if (ov.length > 0) return ov[0];

  const exs = by('extraSummon');
  if (exs.length > 0) return exs[0];

  const sum = by('tributeSummon').sort((x, y) => (cardLv(y).level || 0) - (cardLv(x).level || 0) || (cardLv(y).atk || 0) - (cardLv(x).atk || 0))
    .filter(x => x.materials.length <= 2);
  if (sum.length) return sum[0];
  const ns = by('normalSummon').sort((x, y) => (cardLv(y).atk || 0) - (cardLv(x).atk || 0));
  if (ns.length) return ns.sort((x, y) => Math.abs(x.slot - 2) - Math.abs(y.slot - 2))[0];
  const fl = by('flipSummon'); if (fl.length) return fl[0];
  if (st.phase === 'battle') {
    const at = by('attack').filter(x => {
      const m = me.monsters[x.from]; if (x.to === null) return true;
      const t = op.monsters[x.to]; if (t.faceDown) return true;
      return E.atk(m) > (t.position === 'atk' ? E.atk(t) : E.def(t));
    });
    if (at.length) return at[0];
  }

  const actEff = by('activateEffect');
  if (actEff.length > 0) return actEff[0];

  return by('advancePhase')[0] || by('endTurn')[0] || legal[0];
}

function actor(s) {
  if (s.phase === 'mulligan') { const i = s.players.findIndex(p => !p.flags.mulliganDone); return i < 0 ? 0 : i; }
  if (s.pending) return s.pending.player;
  return s.activeIdx;
}

// 1. ตรวจสอบว่าบอทระดับ 'easy' ให้ผลเหมือนบอทเดิมทุกประการข้าม 20 เกม
t('7A-1: CG.bot.choose ระดับ easy ตัดสินใจเหมือนบอทเดิมทุกประการข้าม 20 เกม', assert => {
  const E = CG.engine;
  for (let i = 1; i <= 20; i++) {
    const deckA = i % 2 === 1 ? 'dinosaur' : 'aquila';
    const deckB = i % 2 === 1 ? 'aquila' : 'dinosaur';
    const s = E.createGame({ deckA, deckB, seed: i, mode: 'bot', config: { autoChoose: false, chainMode: true } });
    let steps = 0;
    while (!s.ended && steps < 2000) {
      steps++;
      const act0 = actor(s);
      const legal = E.getLegalActions(s, act0);
      if (!legal.length) break;

      const expected = referenceBot(s, act0, legal);
      const actual = CG.bot.choose(s, act0, legal, { level: 'easy' });
      const defOpt = CG.bot.choose(s, act0, legal);

      assert.deepStrictEqual(actual, expected, `Seed ${i} step ${steps}: การตัดสินใจไม่ตรงกับบอทเดิม`);
      assert.deepStrictEqual(defOpt, expected, `Seed ${i} step ${steps}: options ค่าเริ่มต้นไม่ตรงกับ easy`);

      const r = E.applyAction(s, actual);
      if (!r.ok) {
        const fb = legal.find(x => x.type === 'advancePhase') || legal.find(x => x.type === 'endTurn') || legal[0];
        E.applyAction(s, fb);
      }
    }
    assert.strictEqual(s.ended, true, `Seed ${i} ต้องจบเกมได้`);
  }
});

// 2. ตรวจสอบว่า CG.bot.choose เป็น Pure function (ไม่แก้ไข state)
t('7A-2: CG.bot.choose เป็น Pure Function ไม่กลายพันธุ์ (mutate) state', assert => {
  const E = CG.engine;
  const s = E.createGame({ deckA: 'dinosaur', deckB: 'aquila', seed: 42, mode: 'bot', config: { autoChoose: false, chainMode: true } });

  // ฟังก์ชัน deep freeze วัตถุ
  function deepFreeze(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    Object.freeze(obj);
    Object.keys(obj).forEach(key => deepFreeze(obj[key]));
    return obj;
  }

  // ทดสอบ 50 สเต็ปแรก
  let steps = 0;
  while (!s.ended && steps < 50) {
    steps++;
    const act0 = actor(s);
    const legal = E.getLegalActions(s, act0);
    if (!legal.length) break;

    // โคลน state ก่อนเรียก bot.choose
    const snapshotBefore = JSON.stringify(s);

    // สร้างสำเนาแช่แข็งเพื่อตรวจจับการพยายามเขียนทับ
    const frozenCopy = deepFreeze(JSON.parse(snapshotBefore));

    let action;
    assert.doesNotThrow(() => {
      action = CG.bot.choose(frozenCopy, act0, legal, { level: 'easy' });
    }, `CG.bot.choose ต้องไม่พยายามแก้ state ที่ถูก freeze`);

    // ตรวจสอบว่า snapshot เดิมก่อน-หลังเรียก bot.choose บน s จริงไม่มีการเปลี่ยนแปลง
    const snapshotMid = JSON.stringify(s);
    assert.strictEqual(snapshotMid, snapshotBefore, `State ต้องไม่ถูกแก้ไขโดย CG.bot.choose`);

    const r = E.applyAction(s, action);
    if (!r.ok) {
      const fb = legal.find(x => x.type === 'advancePhase') || legal.find(x => x.type === 'endTurn') || legal[0];
      E.applyAction(s, fb);
    }
  }
});

// 3. ตรวจสอบว่าระดับที่ไม่รู้จักจะถอยกลับมาใช้ 'easy' เสมอ
t('7A-3: options.level ที่ไม่รู้จักจะ fallback กลับมาใช้ easy', assert => {
  const E = CG.engine;
  const s = E.createGame({ deckA: 'aquila', deckB: 'dinosaur', seed: 99, mode: 'bot', config: { autoChoose: false, chainMode: true } });
  const act0 = actor(s);
  const legal = E.getLegalActions(s, act0);

  const easyAction = CG.bot.choose(s, act0, legal, { level: 'easy' });
  const unknown1 = CG.bot.choose(s, act0, legal, { level: 'hard' });
  const unknown2 = CG.bot.choose(s, act0, legal, { level: 'master_ai_9000' });
  const unknown3 = CG.bot.choose(s, act0, legal, { level: null });
  const unknown4 = CG.bot.choose(s, act0, legal, {});

  assert.deepStrictEqual(unknown1, easyAction);
  assert.deepStrictEqual(unknown2, easyAction);
  assert.deepStrictEqual(unknown3, easyAction);
  assert.deepStrictEqual(unknown4, easyAction);
});

// 4. ตรวจสอบ Alias: CG.ui.botChoose และ CG.bot.chooseAction ทำงานตรงกัน
t('7A-4: CG.ui.botChoose และ CG.bot.chooseAction ชี้มาที่ตรรกะเดียวกัน', assert => {
  const E = CG.engine;
  const s = E.createGame({ deckA: 'dinosaur', deckB: 'aquila', seed: 123, mode: 'bot', config: { autoChoose: false, chainMode: true } });
  const act0 = actor(s);
  const legal = E.getLegalActions(s, act0);

  const a1 = CG.bot.choose(s, act0, legal);
  const a2 = CG.bot.chooseAction(s, act0, legal);
  const a3 = CG.ui.botChoose(s, act0, legal);

  assert.deepStrictEqual(a1, a2);
  assert.deepStrictEqual(a1, a3);
});
