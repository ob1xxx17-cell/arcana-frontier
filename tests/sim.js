// tests/sim.js - 7A/7B: ตัวจำลองการเล่นบอทสู้บอท (สลับข้างและเด็คครบทุกมิติ)
// การรัน: node tests/sim.js [จำนวนเกม] [ระดับบอท A] [ระดับบอท B]
// เช่น: node tests/sim.js 400 normal easy
//       node tests/sim.js 1000 normal normal
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
globalThis.CG = globalThis.CG || {};

// โหลด cards, effects, engine, bot แบบเดียวกับ tests/run.js
for (const dir of ['cards', 'effects', 'engine', 'bot']) {
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) continue;
  for (const f of fs.readdirSync(full).filter(n => n.endsWith('.js')).sort()) {
    const file = path.join(full, f);
    vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file });
  }
}

const count = parseInt(process.argv[2] || '1000', 10);
const levelA = process.argv[3] || 'easy';
const levelB = process.argv[4] || 'easy';

function actor(s) {
  if (s.phase === 'mulligan') { const i = s.players.findIndex(p => !p.flags.mulliganDone); return i < 0 ? 0 : i; }
  if (s.pending) return s.pending.player;
  return s.activeIdx;
}

// สร้างพจนานุกรมการ์ดทั้งหมดเพื่อเก็บสถิติ
const cardRegistry = {};
function registerDeck(deckKey) {
  const d = CG.cards[deckKey];
  if (!d) return;
  for (const c of d.main) {
    if (!cardRegistry[c.id]) {
      cardRegistry[c.id] = { id: c.id, name: c.name, type: c.type, deck: deckKey, isExtra: false, summoned: 0, activated: 0 };
    }
  }
  for (const c of d.extra) {
    if (!cardRegistry[c.id]) {
      cardRegistry[c.id] = { id: c.id, name: c.name, type: c.type, deck: deckKey, isExtra: true, summoned: 0, activated: 0 };
    }
  }
}
registerDeck('dinosaur');
registerDeck('aquila');

// ตัวแปรสถิติ
const stats = {
  totalGames: count,
  levelAWins: 0,
  levelBWins: 0,
  dinoWins: 0,
  aquilaWins: 0,
  draws: 0,
  p0Wins: 0,
  p1Wins: 0,
  turns: [],
  steps: [],
  gamesWithOverlay: 0,
  gamesWithFusion: 0,
  gamesWithExtra: 0,
  gamesWithChain: 0,
  totalOverlay: 0,
  totalFusion: 0,
  totalExtra: 0,
  totalChain: 0,
  // มิติสลับข้างและเด็คสำหรับ Bot A
  botA_asDino_games: 0,
  botA_asDino_wins: 0,
  botA_asAquila_games: 0,
  botA_asAquila_wins: 0,
  botA_asP0_games: 0,
  botA_asP0_wins: 0,
  botA_asP1_games: 0,
  botA_asP1_wins: 0,
};

const startTime = Date.now();

for (let i = 0; i < count; i++) {
  const seed = i + 1;
  const quad = i % 4;
  let p0Deck, p1Deck, p0Lvl, p1Lvl;

  // สลับข้าง (P0/P1) และเด็ค (Dino/Aquila) ครบ 4 มิติอย่างสมดุล
  if (quad === 0) {
    p0Deck = 'dinosaur'; p0Lvl = levelA;
    p1Deck = 'aquila';   p1Lvl = levelB;
  } else if (quad === 1) {
    p0Deck = 'aquila';   p0Lvl = levelA;
    p1Deck = 'dinosaur'; p1Lvl = levelB;
  } else if (quad === 2) {
    p0Deck = 'dinosaur'; p0Lvl = levelB;
    p1Deck = 'aquila';   p1Lvl = levelA;
  } else {
    p0Deck = 'aquila';   p0Lvl = levelB;
    p1Deck = 'dinosaur'; p1Lvl = levelA;
  }

  // นับจำนวนเกมตามมิติของ Bot A
  const botA_is_p0 = (p0Lvl === levelA && (levelA !== levelB || quad < 2));
  if (botA_is_p0) {
    stats.botA_asP0_games++;
    if (p0Deck === 'dinosaur') stats.botA_asDino_games++;
    else stats.botA_asAquila_games++;
  } else {
    stats.botA_asP1_games++;
    if (p1Deck === 'dinosaur') stats.botA_asDino_games++;
    else stats.botA_asAquila_games++;
  }

  const E = CG.engine;
  const s = E.createGame({
    deckA: p0Deck,
    deckB: p1Deck,
    seed,
    mode: 'bot',
    config: { autoChoose: false, chainMode: true }
  });

  const uidToCardId = {};
  for (const p of s.players) {
    for (const c of [...p.deck, ...p.hand, ...p.extra]) {
      uidToCardId[c.uid] = c.cardId;
    }
  }

  let stepCount = 0;
  const maxSteps = 4000;
  let gameOverlay = 0, gameFusion = 0, gameExtra = 0, gameChain = 0;

  while (!s.ended && stepCount < maxSteps) {
    stepCount++;
    const act0 = actor(s);
    const legal = E.getLegalActions(s, act0);
    if (!legal.length) break;

    const lvl = act0 === 0 ? p0Lvl : p1Lvl;
    const a = CG.bot.choose(s, act0, legal, { level: lvl });

    if (a.type === 'activateSpell') {
      const p = s.players[a.player];
      const inst = a.handIdx !== undefined ? p.hand[a.handIdx] : (a.spellSlot !== undefined ? p.spells[a.spellSlot] : null);
      if (inst && cardRegistry[inst.cardId]) cardRegistry[inst.cardId].activated++;
    } else if (a.type === 'activateEffect') {
      const p = s.players[a.player];
      const inst = a.slot !== undefined ? p.monsters[a.slot] : (a.handIdx !== undefined ? p.hand[a.handIdx] : null);
      if (inst && cardRegistry[inst.cardId]) cardRegistry[inst.cardId].activated++;
    } else if (a.type === 'activateResponse') {
      let cId = a.cardId;
      const p = s.players[a.player];
      if (!cId && a.handIdx !== undefined && p.hand[a.handIdx]) cId = p.hand[a.handIdx].cardId;
      if (!cId && a.spellSlot !== undefined && p.spells[a.spellSlot]) cId = p.spells[a.spellSlot].cardId;
      if (!cId && a.slot !== undefined && p.monsters[a.slot]) cId = p.monsters[a.slot].cardId;
      if (cId && cardRegistry[cId]) cardRegistry[cId].activated++;
    }

    const r = E.applyAction(s, a);
    if (!r.ok) {
      const fb = legal.find(x => x.type === 'advancePhase') || legal.find(x => x.type === 'endTurn') || legal.find(x => x.type === 'passPriority') || legal[0];
      const r2 = E.applyAction(s, fb);
      if (!r2.ok) break;
    }
  }

  for (const ev of s.log) {
    if (ev.type === 'summon') {
      const cId = uidToCardId[ev.uid];
      if (cId && cardRegistry[cId]) {
        cardRegistry[cId].summoned++;
      }
      if (ev.how === 'overlay') gameOverlay++;
      if (ev.how === 'fusion') gameFusion++;
      if (ev.how === 'extra' || ev.how === 'grade4') gameExtra++;
    } else if (ev.type === 'chainLinkAdded' || ev.type === 'chainAdd') {
      gameChain++;
    }
  }

  if (gameOverlay > 0) { stats.gamesWithOverlay++; stats.totalOverlay += gameOverlay; }
  if (gameFusion > 0) { stats.gamesWithFusion++; stats.totalFusion += gameFusion; }
  if (gameExtra > 0) { stats.gamesWithExtra++; stats.totalExtra += gameExtra; }
  if (gameChain > 0) { stats.gamesWithChain++; stats.totalChain += gameChain; }

  stats.turns.push(s.turn);
  stats.steps.push(stepCount);

  // สรุปผลแพ้ชนะ
  if (s.winner === 'draw') {
    stats.draws++;
  } else if (s.winner === 0) {
    stats.p0Wins++;
    if (p0Deck === 'dinosaur') stats.dinoWins++;
    else stats.aquilaWins++;

    if (p0Lvl === levelA && (levelA !== levelB || quad < 2)) {
      stats.levelAWins++;
      stats.botA_asP0_wins++;
      if (p0Deck === 'dinosaur') stats.botA_asDino_wins++;
      else stats.botA_asAquila_wins++;
    } else {
      stats.levelBWins++;
    }
  } else if (s.winner === 1) {
    stats.p1Wins++;
    if (p1Deck === 'dinosaur') stats.dinoWins++;
    else stats.aquilaWins++;

    if (p1Lvl === levelA && (levelA !== levelB || quad >= 2)) {
      stats.levelAWins++;
      stats.botA_asP1_wins++;
      if (p1Deck === 'dinosaur') stats.botA_asDino_wins++;
      else stats.botA_asAquila_wins++;
    } else {
      stats.levelBWins++;
    }
  }
}

const elapsedMs = Date.now() - startTime;
const elapsedSec = (elapsedMs / 1000).toFixed(2);

const avgTurns = (stats.turns.reduce((a, b) => a + b, 0) / count).toFixed(1);
const minTurns = Math.min(...stats.turns);
const maxTurns = Math.max(...stats.turns);
const avgSteps = (stats.steps.reduce((a, b) => a + b, 0) / count).toFixed(1);

const pct = (n, total = count) => total > 0 ? ((n / total) * 100).toFixed(1) + '%' : '0.0%';

const out = [];
out.push('================================================================================');
out.push(`          รายงานจำลองการเล่นบอทสู้บอท (BOT VS BOT SIMULATION REPORT)`);
out.push('================================================================================');
out.push(`จำนวนเกม: ${count.toLocaleString()} เกม | เวลาที่ใช้: ${elapsedSec} วินาที (${(count / (elapsedMs / 1000)).toFixed(0)} เกม/วินาที)`);
out.push(`การตั้งค่า: autoChoose=false, chainMode=true, เมนเด็ค+Extra เด็คจริง (สลับข้างและเด็คครบ 4 มิติ)`);
out.push(`คู่ประลอง: ฝ่าย A = ${levelA.toUpperCase()} vs ฝ่าย B = ${levelB.toUpperCase()}`);
out.push('--------------------------------------------------------------------------------');
out.push(`1. ผลการประลองระหว่างระดับบอท (${levelA.toUpperCase()} vs ${levelB.toUpperCase()}):`);
out.push(`   - ${levelA.toUpperCase()} ชนะ:  ${stats.levelAWins.toString().padStart(5)} เกม (${pct(stats.levelAWins)})`);
out.push(`   - ${levelB.toUpperCase()} ชนะ:  ${stats.levelBWins.toString().padStart(5)} เกม (${pct(stats.levelBWins)})`);
out.push(`   - เสมอ (Draw):    ${stats.draws.toString().padStart(5)} เกม (${pct(stats.draws)})`);
if (levelA !== levelB) {
  out.push('');
  out.push(`   [มิติผลงานของบอท ${levelA.toUpperCase()}]:`);
  out.push(`   - เล่นเด็คไดโนเสาร์:   ${stats.botA_asDino_wins.toString().padStart(5)} / ${stats.botA_asDino_games} (${pct(stats.botA_asDino_wins, stats.botA_asDino_games)})`);
  out.push(`   - เล่นเด็คอาควิลา:    ${stats.botA_asAquila_wins.toString().padStart(5)} / ${stats.botA_asAquila_games} (${pct(stats.botA_asAquila_wins, stats.botA_asAquila_games)})`);
  out.push(`   - เล่นเป็นผู้เริ่มก่อน (P0): ${stats.botA_asP0_wins.toString().padStart(5)} / ${stats.botA_asP0_games} (${pct(stats.botA_asP0_wins, stats.botA_asP0_games)})`);
  out.push(`   - เล่นเป็นผู้เริ่มหลัง (P1): ${stats.botA_asP1_wins.toString().padStart(5)} / ${stats.botA_asP1_games} (${pct(stats.botA_asP1_wins, stats.botA_asP1_games)})`);
}
out.push('');
out.push('2. ผลแพ้-ชนะระหว่างเด็คและการเริ่มก่อน-หลัง (Meta Statistics):');
out.push(`   - ไดโนเสาร์ชนะ (Dinosaur):  ${stats.dinoWins.toString().padStart(5)} เกม (${pct(stats.dinoWins)})`);
out.push(`   - อาควิลาชนะ (Aquila):     ${stats.aquilaWins.toString().padStart(5)} เกม (${pct(stats.aquilaWins)})`);
out.push(`   - ผู้เล่นเริ่มก่อน (P0) ชนะ: ${stats.p0Wins.toString().padStart(5)} เกม (${pct(stats.p0Wins)})`);
out.push(`   - ผู้เล่นเริ่มหลัง (P1) ชนะ: ${stats.p1Wins.toString().padStart(5)} เกม (${pct(stats.p1Wins)})`);
out.push('');
out.push('3. สถิติจำนวนเทิร์นและการกระทำ (Game Length):');
out.push(`   - เทิร์นเฉลี่ย: ${avgTurns} เทิร์น (สั้นสุด: ${minTurns}, ยาวสุด: ${maxTurns})`);
out.push(`   - สเต็ปเฉลี่ยต่อเกม: ${avgSteps} การกระทำ`);
out.push('');
out.push('4. อัตราการเกิดกลไกพิเศษ (Special Mechanics Occurrence):');
out.push(`   - การวางทับ (Overlay):       ${stats.gamesWithOverlay.toString().padStart(5)} เกม (${pct(stats.gamesWithOverlay)}) [รวม ${stats.totalOverlay} ครั้ง]`);
out.push(`   - อัญเชิญฟิวชัน (Fusion):    ${stats.gamesWithFusion.toString().padStart(5)} เกม (${pct(stats.gamesWithFusion)}) [รวม ${stats.totalFusion} ครั้ง]`);
out.push(`   - อัญเชิญ Extra/Grade 4:     ${stats.gamesWithExtra.toString().padStart(5)} เกม (${pct(stats.gamesWithExtra)}) [รวม ${stats.totalExtra} ครั้ง]`);
out.push(`   - การเกิด Chain ตอบโต้:      ${stats.gamesWithChain.toString().padStart(5)} เกม (${pct(stats.gamesWithChain)}) [รวม ${stats.totalChain} ลิงก์]`);
out.push('--------------------------------------------------------------------------------');
out.push('5. ความถี่การใช้งานการ์ดแต่ละใบ (Card Usage Frequency):');
out.push('   รหัสการ์ด             ชื่อการ์ด                  โซน     อัญเชิญ   เอฟเฟกต์    รวม    อัตรา/เกม');
out.push('   -----------------------------------------------------------------------------');

const deadCards = [];

function printDeckCards(deckKey, title) {
  out.push(`   [${title}]`);
  const cards = Object.values(cardRegistry).filter(c => c.deck === deckKey);
  for (const c of cards) {
    const totalUse = c.summoned + c.activated;
    if (totalUse === 0) deadCards.push(c);
    const zoneStr = c.isExtra ? 'Extra ' : 'Main  ';
    const rate = (totalUse / count).toFixed(2);
    const line = `   ${c.id.padEnd(20)} ${c.name.padEnd(24)} ${zoneStr}  ${c.summoned.toString().padStart(6)}  ${c.activated.toString().padStart(8)}  ${totalUse.toString().padStart(6)}   ${rate}x`;
    out.push(line);
  }
}

printDeckCards('dinosaur', 'เด็คไดโนเสาร์ (Dinosaur)');
out.push('   -----------------------------------------------------------------------------');
printDeckCards('aquila', 'เด็คอาควิลา (Aquila)');
out.push('--------------------------------------------------------------------------------');
out.push('6. การ์ดที่ไม่เคยถูกใช้งานเลย (Dead Cards - 0 Usage):');
if (deadCards.length === 0) {
  out.push('   (ไม่มี - การ์ดทุกใบถูกใช้งานอย่างน้อย 1 ครั้ง)');
} else {
  for (const c of deadCards) {
    out.push(`   ⚠️ [${c.deck.toUpperCase()}] ${c.id} (${c.name}) [${c.isExtra ? 'Extra' : 'Main'}]: ไม่เคยถูกอัญเชิญหรือใช้เอฟเฟกต์เลย`);
  }
}
out.push('================================================================================');

const reportText = out.join('\n');
console.log(reportText);

const reportPath = path.join(__dirname, 'sim_report.txt');
fs.writeFileSync(reportPath, reportText, 'utf8');
console.log(`\nบันทึกรายงานลงไฟล์: ${reportPath}`);
