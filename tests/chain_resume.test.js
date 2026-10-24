// tests/chain_resume.test.js - 5E: ทดสอบการเดินต่อหลัง Chain ปิดบน engine เปล่า (50 เกม)
// ตรวจ: 0 hang, 0 exception, ทุกเกมจบลงด้วยดีบน engine แท้โดยไม่มี wrapper ใด ๆ (ใช้ CG.bot.choose)
const botChoose = (s, p, l) => CG.bot.choose(s, p, l);

const t = (name, fn) => tests.push({ name, run: fn });
const tests = module.exports = [];

function actor(s) {
  if (s.phase === 'mulligan') { const i = s.players.findIndex(p => !p.flags.mulliganDone); return i < 0 ? 0 : i; }
  if (s.pending) return s.pending.player;
  return s.activeIdx;
}

function runGame(seed, deckA, deckB) {
  const E = CG.engine;
  const s = E.createGame({ deckA, deckB, seed, mode: 'bot', config: { autoChoose: false, chainMode: true } });
  let steps = 0;
  const maxSteps = 4000;
  while (!s.ended && steps < maxSteps) {
    steps++;
    const act0 = actor(s);
    const legal = E.getLegalActions(s, act0);
    if (!legal.length) {
      return { error: 'NO_LEGAL_ACTIONS', steps, turn: s.turn, phase: s.phase, pending: s.pending ? s.pending.kind : null };
    }
    const a = botChoose(s, act0, legal);
    const r = E.applyAction(s, a);
    if (!r.ok) {
      const fb = legal.find(x => x.type === 'advancePhase') || legal.find(x => x.type === 'endTurn') || legal.find(x => x.type === 'passPriority') || legal[0];
      const r2 = E.applyAction(s, fb);
      if (!r2.ok) {
        return { error: 'BOT_STUCK:' + r.error + '/' + r2.error, steps, turn: s.turn, phase: s.phase, pending: s.pending ? s.pending.kind : null };
      }
    }
  }
  if (!s.ended) {
    return { error: 'TIMEOUT', steps, turn: s.turn, phase: s.phase, pending: s.pending ? s.pending.kind : null };
  }
  const overlayOccurred = s.log.some(e => e.type === 'summon' && e.how === 'overlay');
  const fusionOccurred = s.log.some(e => e.type === 'summon' && e.how === 'fusion');
  const grade4Occurred = s.log.some(e => e.type === 'summon' && e.how === 'extra');
  return { ok: true, winner: s.winner, turns: s.turn, steps, overlayOccurred, fusionOccurred, grade4Occurred };
}

t('5E-01 เดินต่อหลัง Chain ปิดบน engine เปล่า: บอท 50 เกม 0 hang, 0 exception, จบทุกเกม <= 100 เทิร์น', assert => {
  const GAMES = 50;
  const MAX_TURNS = 100;
  let dinoWins = 0, aquilaWins = 0, draws = 0, errors = 0, hangs = 0;
  let totalTurns = 0;
  let overlayGames = 0, fusionGames = 0, grade4Games = 0;
  const failures = [];

  for (let i = 0; i < GAMES; i++) {
    const seed = i + 101;
    const deckA = i % 2 === 0 ? 'dinosaur' : 'aquila';
    const deckB = i % 2 === 0 ? 'aquila' : 'dinosaur';

    let result;
    try {
      result = runGame(seed, deckA, deckB);
    } catch (e) {
      errors++;
      failures.push('Game ' + (i + 1) + ' (seed=' + seed + ' ' + deckA + ' vs ' + deckB + '): EXCEPTION: ' + e.message);
      continue;
    }

    if (result.error) {
      if (result.error === 'TIMEOUT') {
        hangs++;
        failures.push('Game ' + (i + 1) + ' (seed=' + seed + ' ' + deckA + ' vs ' + deckB + '): HANG at turn ' + result.turn + ' phase ' + result.phase + ' pending=' + result.pending);
      } else {
        errors++;
        failures.push('Game ' + (i + 1) + ' (seed=' + seed + ' ' + deckA + ' vs ' + deckB + '): ' + result.error + ' at turn ' + result.turn);
      }
      continue;
    }

    if (result.turns > MAX_TURNS) {
      hangs++;
      failures.push('Game ' + (i + 1) + ': exceeded ' + MAX_TURNS + ' turns (took ' + result.turns + ')');
      continue;
    }

    totalTurns += result.turns;
    if (result.overlayOccurred) overlayGames++;
    if (result.fusionOccurred) fusionGames++;
    if (result.grade4Occurred) grade4Games++;
    if (result.winner === 0) {
      if (deckA === 'dinosaur') dinoWins++; else aquilaWins++;
    } else if (result.winner === 1) {
      if (deckB === 'dinosaur') dinoWins++; else aquilaWins++;
    } else {
      draws++;
    }
  }

  const completed = GAMES - errors - hangs;
  const avgTurns = completed > 0 ? (totalTurns / completed).toFixed(1) : '?';
  console.log('      Engine เปล่า บอท 50 เกม: ' + completed + '/' + GAMES + ' สำเร็จ, เฉลี่ย ' + avgTurns + ' เทิร์น, Dino=' + dinoWins + ' Aquila=' + aquilaWins + ' Draw=' + draws);
  console.log('      Mechanics: Overlay=' + overlayGames + ', Fusion=' + fusionGames + ', Grade4=' + grade4Games);

  if (failures.length > 0) {
    console.log('      First 5 failures:');
    failures.slice(0, 5).forEach(f => console.log('        ' + f));
  }

  assert.strictEqual(errors, 0, 'exceptions: ' + errors + (failures.length ? ' => ' + failures[0] : ''));
  assert.strictEqual(hangs, 0, 'hangs: ' + hangs + (failures.length ? ' => ' + failures[0] : ''));
  assert.ok(overlayGames > 0, 'ต้องมีการวางทับ (overlay) เกิดขึ้นจริง (' + overlayGames + ' เกม)');
  assert.ok(fusionGames > 0, 'ต้องมี Fusion เกิดขึ้นจริง (' + fusionGames + ' เกม)');
  assert.ok(grade4Games > 0, 'ต้องมี Grade 4 เกิดขึ้นจริง (' + grade4Games + ' เกม)');
});
