// engine/setup.js - สร้างเกม (createGame) และตัวสร้าง state ฐานที่ใช้ร่วมกับ testSetup
(function () {
  const CG = (globalThis.CG = globalThis.CG || {});
  CG.engine = CG.engine || {};
  const E = CG.engine;

  function createPlayer(state, idx, deckKey, name) {
    const deck = CG.cards && CG.cards[deckKey];
    if (!deck) throw new Error('UNKNOWN_DECK:' + deckKey);
    const cfg = state.config;
    const main = [];
    for (const def of deck.main) for (let i = 0; i < (def.count || 1); i++) main.push(E.newInstance(state, def, idx));
    E.shuffle(main, state.rng);
    return {
      idx, name, deckKey, lp: cfg.startLp, mana: cfg.startMana,
      deck: main, hand: [], extra: deck.extra.map(def => E.newInstance(state, def, idx)),
      grave: [], removed: [],
      monsters: new Array(cfg.monsterSlots).fill(null),
      spells: new Array(cfg.spellSlots).fill(null),
      fieldSpell: null,
      flags: { normalSummonUsed: false, tributeSummonUsed: false, mulliganUsed: 0, mulliganDone: false, grade4SummonedThisTurn: false },
      usedEffects: {}
    };
  }

  // state ฐาน: สับเด็คแล้ว ยังไม่แจกมือ ยังไม่เริ่มเทิร์น
  E.buildState = function (opts) {
    const state = {
      config: E.mergeConfig(opts.config), turn: 1, activeIdx: 0, phase: 'mulligan', battleStep: null,
      chain: [], pending: null, attack: null, winner: null, ended: false, log: [],
      rng: E.makeRng(opts.seed), mode: opts.mode || 'pvp', players: [], nextUid: 1
    };
    state.players = [
      createPlayer(state, 0, opts.deckA, 'P1'),
      createPlayer(state, 1, opts.deckB, state.mode === 'bot' ? 'BOT' : 'P2')
    ];
    return state;
  };

  E.createGame = function (opts) {
    opts = opts || {};
    const state = E.buildState(opts);
    const events = [];
    state.players.forEach(p => { for (let i = 0; i < state.config.startHand; i++) E.drawCard(state, events, p.idx, false); });
    state.players.forEach(p => { p.mana = state.config.startMana; }); // เริ่มต้นไม่ได้มานาจากการจั่วเริ่มเกม
    if (state.config.mulliganCount > 0) {
      state.phase = 'mulligan';
    } else {
      state.players.forEach(p => { p.flags.mulliganDone = true; });
      E.startTurn(state, events);
    }
    state.log.push(...events);
    return state;
  };
})();
