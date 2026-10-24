// tests/ui_pacing.test.js - 7P: Unit tests for UI pacing and action delays
const path = require('path');
const fs = require('fs');
const vm = require('vm');

const root = path.join(__dirname, '..');
if (!CG.ui || !CG.ui.view || !CG.ui.view.getActionDelay) {
  for (const f of ['strings_th.js', 'view.js', 'app.js']) {
    const file = path.join(root, 'ui', f);
    if (fs.existsSync(file)) {
      vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file });
    }
  }
}

const tests = module.exports = [];
const t = (name, fn) => tests.push({ name, run: fn });

t('PACING-01 ทุกระดับความเร็วคืนค่าเวลาหน่วงถูกต้องตามตาราง', assert => {
  const getDelay = CG.ui.view.getActionDelay || CG.ui.getActionDelay;
  assert.strictEqual(typeof getDelay, 'function', 'getActionDelay ต้องเป็นฟังก์ชัน');

  // ตารางความเร็วที่กำหนด
  // slow: major=1500, minor=750
  // normal: major=800, minor=400
  // fast: major=250, minor=125
  const expected = {
    slow: { major: 1500, minor: 750 },
    normal: { base: 800, minor: 400 },
    fast: { base: 250, minor: 125 }
  };

  assert.strictEqual(getDelay('normalSummon', 'slow'), 1500, 'slow major ต้องเป็น 1500');
  assert.strictEqual(getDelay('advancePhase', 'slow'), 750, 'slow minor ต้องเป็น 750');

  assert.strictEqual(getDelay('normalSummon', 'normal'), 800, 'normal major ต้องเป็น 800');
  assert.strictEqual(getDelay('advancePhase', 'normal'), 400, 'normal minor ต้องเป็น 400');

  assert.strictEqual(getDelay('normalSummon', 'fast'), 250, 'fast major ต้องเป็น 250');
  assert.strictEqual(getDelay('advancePhase', 'fast'), 125, 'fast minor ต้องเป็น 125');
});

t('PACING-02 การกระทำเบากับการกระทำสำคัญมีเวลาหน่วงต่างกัน (เบาหน่วงครึ่งหนึ่ง)', assert => {
  const getDelay = CG.ui.view.getActionDelay || CG.ui.getActionDelay;
  const speeds = ['slow', 'normal', 'fast'];
  const minorActions = ['advancePhase', 'endTurn', 'pass', 'passPriority'];
  const majorActions = [
    'normalSummon', 'setMonster', 'tributeSummon', 'attack',
    'activateEffect', 'activateSpell', 'setSpell', 'overlay',
    'extraSummon', 'flipSummon', 'changePosition', 'activateResponse'
  ];

  for (const sp of speeds) {
    for (const minor of minorActions) {
      for (const major of majorActions) {
        const dMinor = getDelay(minor, sp);
        const dMajor = getDelay(major, sp);
        assert.ok(dMinor < dMajor, 'minor (' + minor + ') ต้องหน่วงน้อยกว่า major (' + major + ') ที่ความเร็ว ' + sp);
        assert.strictEqual(dMinor, Math.round(dMajor / 2), 'minor ต้องหน่วงครึ่งหนึ่งของ major ที่ความเร็ว ' + sp);
      }
    }
  }
});

t('PACING-03 ทุกผลลัพธ์ของ getActionDelay เป็นตัวเลขบวก (> 0) เสมอ', assert => {
  const getDelay = CG.ui.view.getActionDelay || CG.ui.getActionDelay;
  const actions = [
    'normalSummon', 'setMonster', 'tributeSummon', 'attack',
    'activateEffect', 'activateSpell', 'setSpell', 'overlay',
    'extraSummon', 'flipSummon', 'changePosition', 'advancePhase',
    'endTurn', 'pass', 'passPriority', 'unknownAction'
  ];
  const speeds = ['slow', 'normal', 'fast', 'unknown', null, undefined];

  for (const act of actions) {
    for (const sp of speeds) {
      const d = getDelay(act, sp);
      assert.strictEqual(typeof d, 'number', 'ผลลัพธ์ต้องเป็นตัวเลข');
      assert.ok(!isNaN(d), 'ผลลัพธ์ต้องไม่ใช่ NaN');
      assert.ok(d > 0, 'เวลาหน่วงต้องมากกว่า 0 เสมอ (ได้: ' + d + ')');
    }
  }
});

t('PACING-04 ความเร็วที่ไม่รู้จักตกกลับเป็น "ปกติ" (normal) เสมอ', assert => {
  const getDelay = CG.ui.view.getActionDelay || CG.ui.getActionDelay;
  const normalMajor = getDelay('normalSummon', 'normal');
  const normalMinor = getDelay('advancePhase', 'normal');

  const unknownSpeeds = ['turbo', 'hyper', 'none', '', 123, null, undefined];
  for (const sp of unknownSpeeds) {
    assert.strictEqual(getDelay('normalSummon', sp), normalMajor, 'ความเร็ว ' + sp + ' สำหรับ major ต้องตกกลับเป็น normal');
    assert.strictEqual(getDelay('advancePhase', sp), normalMinor, 'ความเร็ว ' + sp + ' สำหรับ minor ต้องตกกลับเป็น normal');
  }
});

t('PACING-05 โหมดเทสต์และบอทสู้บอทแยกตัวหน่วงออกจากฟังก์ชันตัดสินใจของบอท (botChoose ทำงานทันที)', assert => {
  const botChoose = (CG.bot && CG.bot.chooseAction) || CG.ui.botChoose;
  assert.strictEqual(typeof botChoose, 'function', 'botChoose ต้องเป็นฟังก์ชัน');

  // ตรวจสอบว่า botChoose ตัดสินใจคืน action เป็น sync ทันที
  const E = CG.engine;
  const s = E.createGame({ deckA: 'dinosaur', deckB: 'aquila', seed: 10, mode: 'bot', config: { autoChoose: false, chainMode: true } });
  const legal = E.getLegalActions(s, 0);
  const start = Date.now();
  const act = botChoose(s, 0, legal);
  const elapsed = Date.now() - start;

  assert.ok(act && typeof act.type === 'string', 'botChoose ต้องคืน action object');
  assert.ok(elapsed < 50, 'botChoose ต้องทำงานทันทีโดยไม่มีการหน่วงเวลา (ใช้เวลา ' + elapsed + 'ms)');
});
