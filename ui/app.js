// ui/app.js - ตัวควบคุม: ล็อบบี้, วนเกิม, รับคลิก -> applyAction, บอท (ใช้ CG.bot ถ้ามี ไม่งั้นใช้ตัวสำรองง่าย ๆ)
// UI เปลี่ยนสถานะผ่าน CG.engine.applyAction เท่านั้น (CONTRACT ข้อ 12) และไม่คำนวณกติกาซ้ำ
(function () {
  const CG = (globalThis.CG = globalThis.CG || {});
  CG.ui = CG.ui || {};
  const E = () => CG.engine, V = () => CG.ui.view, S = () => CG.ui.strings;
  const $ = (id) => document.getElementById(id);
  const cfg = (CG.ui.cfg = Object.assign({ botDelayMs: 550 }, CG.ui.cfg));

  let state = null, mode = 'bot', deckA = null, deckB = null;
  let sel = null, handSel = new Set(), timer = null, confirmedViewer = null, seed = 1;
  let evBuf = [];
  let pendingSel = new Set();  // 5D: ดัชนีที่ผู้เล่นเลือกใน pending picker

  // 7P: Pacing, animations & banner state
  let currentSpeed = getSavedSpeed();
  // 7B: Bot difficulty
  let currentDifficulty = getSavedDifficulty();
  let botBusy = false;
  let botBannerText = null, botBannerFade = false, bannerTimer = null;
  let cardHl = {}, hlTimer = null;
  let ghosts = {};

  // Phase menu state & dual player timers
  let phaseMenuOpen = false;
  CG.ui.timers = CG.ui.timers || { p0: 0, p1: 0, lastTick: null, intervalId: null };

  function ensureTimer() {
    if (typeof window !== 'undefined' && !CG.ui.timers.intervalId) {
      CG.ui.timers.intervalId = setInterval(tickTimers, 250);
    }
  }

  function tickTimers() {
    if (!state || state.ended || state.phase === 'mulligan') {
      CG.ui.timers.lastTick = Date.now();
      return;
    }
    const now = Date.now();
    const dt = (now - (CG.ui.timers.lastTick || now)) / 1000;
    CG.ui.timers.lastTick = now;

    const b = botToAct();
    const activeP = (mode === 'bot' && (botBusy || b !== null)) ? 1 : state.activeIdx;
    if (activeP === 0) CG.ui.timers.p0 += dt;
    else if (activeP === 1) CG.ui.timers.p1 += dt;

    const el0 = document.querySelector('[data-time-p="0"]');
    if (el0) el0.textContent = formatTime(CG.ui.timers.p0);
    const el1 = document.querySelector('[data-time-p="1"]');
    if (el1) el1.textContent = formatTime(CG.ui.timers.p1);
  }

  function formatTime(s) {
    const sec = Math.floor(s || 0);
    const mm = String(Math.floor(sec / 60)).padStart(2, '0');
    const ss = String(sec % 60).padStart(2, '0');
    return mm + ':' + ss;
  }
  CG.ui.formatTime = formatTime;

  function getSavedSpeed() {
    try {
      if (typeof localStorage !== 'undefined') {
        const s = localStorage.getItem('cg_bot_speed');
        if (s === 'slow' || s === 'normal' || s === 'fast') return s;
      }
    } catch (e) {}
    return 'normal';
  }

  function setSpeed(sp) {
    if (sp === 'slow' || sp === 'normal' || sp === 'fast') {
      currentSpeed = sp;
      try {
        if (typeof localStorage !== 'undefined') localStorage.setItem('cg_bot_speed', sp);
      } catch (e) {}
      if (state) render();
    }
  }

  function getSavedDifficulty() {
    try {
      if (typeof localStorage !== 'undefined') {
        const d = localStorage.getItem('cg_bot_difficulty');
        if (d === 'easy' || d === 'normal') return d;
      }
    } catch (e) {}
    return 'normal';
  }

  function setDifficulty(d) {
    if (d === 'easy' || d === 'normal') {
      currentDifficulty = d;
      try {
        if (typeof localStorage !== 'undefined') localStorage.setItem('cg_bot_difficulty', d);
      } catch (e) {}
      lobby();
    }
  }

  // ---------------- ล็อบบี้ ----------------
  function lobby() {
    clearTimeout(timer); state = null;
    phaseMenuOpen = false;
    CG.ui.inspectCard = null;
    CG.ui.timers.p0 = 0; CG.ui.timers.p1 = 0; CG.ui.timers.lastTick = null;
    botBusy = false; botBannerText = null; botBannerFade = false; cardHl = {}; ghosts = {};
    $('game').classList.add('hidden'); $('lobby').classList.remove('hidden'); $('overlayRoot').innerHTML = '';
    const keys = Object.keys(CG.cards || {}); const a = S().app;
    if (!deckA || !CG.cards[deckA]) deckA = keys[0]; if (!deckB || !CG.cards[deckB]) deckB = keys[1] || keys[0];
    const picker = (who, cur) => keys.map(k => {
      const d = CG.cards[k], n = d.main.reduce((x, c) => x + (c.count || 1), 0);
      return '<button class="deckbtn ' + (cur === k ? 'active' : '') + '" data-deck="' + who + ':' + k + '">' + V().esc(d.name) + '<small>main ' + n + ' · extra ' + d.extra.length + '</small></button>';
    }).join('');
    const spLabels = a.speed || {};
    const diffLabels = a.difficulty || {};
    $('lobby').innerHTML = '<div class="lobby-box"><h1>🃏 ' + a.title + '</h1><div class="sub">' + a.subtitle + '</div>' +
      '<div class="row seg"><button data-mode="bot" class="' + (mode === 'bot' ? 'active' : '') + '">' + a.modeBot + '</button><button data-mode="pvp" class="' + (mode === 'pvp' ? 'active' : '') + '">' + a.modePvp + '</button></div>' +
      (mode === 'bot' ? '<div class="row seg diff-seg">' +
        '<button data-diff="easy" class="' + (currentDifficulty === 'easy' ? 'active' : '') + '">' + (diffLabels.easy || '🌱 ง่าย') + '</button>' +
        '<button data-diff="normal" class="' + (currentDifficulty === 'normal' ? 'active' : '') + '">' + (diffLabels.normal || '⚔️ ปกติ') + '</button>' +
      '</div>' +
      '<div class="row seg speed-seg">' +
        '<button data-speed="slow" class="' + (currentSpeed === 'slow' ? 'active' : '') + '">' + (spLabels.slow || '🐢 ช้า') + '</button>' +
        '<button data-speed="normal" class="' + (currentSpeed === 'normal' ? 'active' : '') + '">' + (spLabels.normal || '⏱ ปกติ') + '</button>' +
        '<button data-speed="fast" class="' + (currentSpeed === 'fast' ? 'active' : '') + '">' + (spLabels.fast || '⚡ เร็ว') + '</button>' +
      '</div>' : '') +
      '<div class="decks"><div><h2>' + a.p1 + '</h2>' + picker('A', deckA) + '</div><div><h2>' + (mode === 'bot' ? a.bot : a.p2) + '</h2>' + picker('B', deckB) + '</div></div>' +
      '<div class="lobby-start"><button class="gold" id="btnStart">' + a.start + '</button></div></div>';
    $('lobby').onclick = (e) => {
      const m = e.target.closest('[data-mode]'), d = e.target.closest('[data-deck]'), sp = e.target.closest('[data-speed]'), df = e.target.closest('[data-diff]');
      if (m) { mode = m.dataset.mode; lobby(); }
      else if (df) { setDifficulty(df.dataset.diff); }
      else if (sp) { setSpeed(sp.dataset.speed); lobby(); }
      else if (d) { const [w, k] = d.dataset.deck.split(':'); if (w === 'A') deckA = k; else deckB = k; lobby(); }
      else if (e.target.closest('#btnStart')) start();
    };
  }

  function start() {
    seed = (Math.random() * 1e9) | 0;
    state = E().createGame({ deckA, deckB, seed, mode, config: { autoChoose: false, chainMode: true } });
    sel = null; handSel = new Set(); pendingSel = new Set(); evBuf = []; confirmedViewer = null;
    phaseMenuOpen = false;
    CG.ui.inspectCard = null;
    CG.ui.timers.p0 = 0; CG.ui.timers.p1 = 0; CG.ui.timers.lastTick = Date.now();
    ensureTimer();
    botBusy = false; botBannerText = null; botBannerFade = false; cardHl = {}; ghosts = {};
    $('lobby').classList.add('hidden'); $('game').classList.remove('hidden');
    $('game').onclick = onClick;
    render(); schedule();
  }

  // ---------------- ใครต้องตัดสินใจ / ใครเป็นผู้ดู ----------------
  function actor() {                       // ผู้เล่นที่ต้องลงมือ (mulligan: คนแรกที่ยังไม่เสร็จ)
    if (state.phase === 'mulligan') { const i = state.players.findIndex(p => !p.flags.mulliganDone); return i < 0 ? 0 : i; }
    if (state.pending) return state.pending.player;
    return state.activeIdx;
  }
  function viewer() { return mode === 'bot' ? 0 : actor(); }
  function botToAct() {
    if (mode !== 'bot' || state.ended) return null;
    if (state.phase === 'mulligan') return state.players[1].flags.mulliganDone ? null : 1;
    return actor() === 1 ? 1 : null;
  }

  // ---------------- วาด ----------------
  function render() {
    if (!state) return;
    const v = viewer(), legal = E().getLegalActions(state, v);
    if (selStale()) sel = null;
    V().render($('game'), {
      state,
      viewer: v,
      sel,
      legal,
      handSel,
      speed: currentSpeed,
      botBusy: (mode === 'bot' && (botBusy || botToAct() !== null)),
      botBanner: botBannerText,
      botBannerFade,
      cardHl,
      ghosts,
      phaseMenuOpen,
      timers: CG.ui.timers,
      inspectCard: CG.ui.inspectCard
    });
    // log
    const map = V().uidMap(state), lines = [];
    state.log.slice(-120).forEach(ev => { const t = V().eventText(state, ev, v, map); if (t) lines.push('<div' + (ev.type === 'phaseChange' ? ' class="sep"' : '') + '>' + V().esc(t) + '</div>'); });
    $('log').innerHTML = lines.join(''); $('log').scrollTop = $('log').scrollHeight;
    animate(v);
    overlays(v);
  }
  function selStale() {
    if (!sel) return false;
    const v = viewer(), p = state.players[v];
    if (state.phase === 'mulligan' || state.pending) return true;
    if (state.activeIdx !== v) return true;
    if (sel.kind === 'hand' && !p.hand[sel.idx]) return true;
    if (sel.kind === 'extra' && !p.extra[sel.idx]) return true;
    if ((sel.kind === 'field' || sel.kind === 'attack') && !p.monsters[sel.slot]) return true;
    if (sel.kind === 'spell' && !p.spells[sel.slot]) return true;
    return false;
  }
  function animate(v) {
    evBuf.forEach(ev => {
      if (ev.type === 'attackDeclared') { const el = document.querySelector('.card[data-p="' + ev.player + '"][data-slot="' + ev.from + '"]'); if (el) el.classList.add('atk-anim'); }
      if (ev.type === 'lpChange') { const el = document.querySelector('[data-lp="' + ev.player + '"]'); if (el) el.classList.add('pulse'); }
    });
    evBuf = [];
  }

  // ---------------- overlay: mulligan / ทิ้งมือ / pending / Chain / ส่งเครื่อง / จบเกม ----------------
  function overlays(v) {
    const root = $('overlayRoot'), a = S().app, st = state; let h = '';
    const p = st.players[v];
    const handCards = () => '<div class="handrow">' + p.hand.map((c, i) => V().cardHtml(c, { reveal: true, sel: handSel.has(c.uid), attrs: ' data-pick="' + c.uid + '" data-hand="' + i + '"' })).join('') + '</div>';
    if (st.ended) {
      const w = st.winner === 'draw' ? a.drawGame : a.winner + ': ' + V().pname(st, st.winner);
      h = '<div class="overlay"><div class="modal"><h2>' + a.gameOver + '</h2><div class="big">' + V().esc(w) + '</div><p>' + V().esc(S().endReason[(st.log.slice().reverse().find(e => e.type === 'gameEnd') || {}).reason] || '') + '</p>' +
        '<div class="row" style="justify-content:center"><button class="gold" data-ov="again">' + a.playAgain + '</button><button data-ov="menu">' + a.back + '</button></div></div></div>';
    } else if (mode === 'pvp' && confirmedViewer !== v) {
      h = '<div class="overlay handoff"><div class="modal"><h2>' + a.handoff + '</h2><div class="big">' + V().esc(V().pname(st, v)) + '</div><button class="gold" data-ov="ready">' + a.handoffReady + '</button></div></div>';
    } else if (st.phase === 'mulligan' && !p.flags.mulliganDone) {
      h = '<div class="overlay"><div class="modal"><h2>' + a.mulliganTitle + ' — ' + V().esc(V().pname(st, v)) + '</h2><p>' + a.mulliganHint + '</p>' + handCards() +
        '<div class="row" style="justify-content:center"><button class="primary" data-ov="mulSel" ' + (handSel.size ? '' : 'disabled') + '>' + a.mulliganSwapSel + '</button><button data-ov="mulAll">' + a.mulliganSwapAll + '</button><button class="gold" data-ov="keep">' + a.mulliganKeep + '</button></div></div></div>';
    } else if (st.phase === 'mulligan') {
      h = '<div class="overlay"><div class="modal"><p>' + a.waitOther + '</p></div></div>';
    } else if (st.pending && st.pending.player === v && st.pending.prompt === 'DISCARD_EXCESS') {
      const n = st.pending.min;
      h = '<div class="overlay"><div class="modal"><h2>' + a.discardTitle + '</h2><p>' + a.discardHint + ' (' + a.selectedN + ' ' + handSel.size + ' ' + a.ofN + ' ' + n + ')</p>' + handCards() +
        '<button class="danger" data-ov="discard" ' + (handSel.size === n ? '' : 'disabled') + '>' + a.confirm + '</button></div></div>';
    } else if (st.pending && st.pending.player === v && st.pending.kind === 'chainWindow') {
      // 5D: Chain response window
      h = buildChainOverlay(st, v);
    } else if (st.pending && st.pending.player === v && st.pending.resume) {
      // 5D: pending with resume (chooseTarget, chooseCards, chooseOption, chooseSlot, yesNo)
      h = buildPendingOverlay(st, v);
    } else if (st.pending && st.pending.player === v) {
      // fallback for other pending types
      const pd = st.pending, label = S().prompts[pd.prompt] || S().prompts.unknown;
      const opts = E().getLegalActions(st, v).filter(x => x.type === 'respond');
      h = '<div class="overlay"><div class="modal"><h2>' + V().esc(label) + '</h2><div class="row" style="justify-content:center">' +
        opts.map((x, i) => '<button data-ov="resp:' + i + '">' + V().esc(typeof x.choice === 'boolean' ? (x.choice ? S().chain.yes : S().chain.no) : JSON.stringify(x.choice)) + '</button>').join('') + '</div></div></div>';
    }
    // 5D: Chain stack display (shown when chain is active but pending is not for this viewer, or alongside chain window)
    if (st.chain && st.chain.length > 0 && !st.ended) {
      h = buildChainStack(st, v) + h;
    }
    root.innerHTML = h;
    root.onclick = onOverlay;
  }

  // 5D: Build chain stack display
  function buildChainStack(st, v) {
    const cs = S().chain;
    let links = '';
    for (let i = 0; i < st.chain.length; i++) {
      const lk = st.chain[i];
      const def = E().findCard(lk.cardId);
      const name = def ? def.name : lk.cardId;
      const cls = lk.negated ? 'chain-link negated' : 'chain-link';
      links += '<div class="' + cls + '"><span class="lnum">' + lk.linkId + '</span><span class="lname">' + V().esc(name) + '</span></div>';
    }
    return '<div class="chain-stack" style="position:fixed;top:60px;right:260px;z-index:35;width:200px"><h4>⛓ ' + cs.title + '</h4>' + links + '</div>';
  }

  // 5D: Build chain window overlay (priority/response)
  function buildChainOverlay(st, v) {
    const pd = st.pending, cs = S().chain;
    const label = S().prompts[pd.prompt] || S().prompts.chainWindow;
    const pname = V().pname(st, v);
    let btns = '';
    // Response buttons from legal actions
    const legal = E().getLegalActions(st, v);
    const responses = legal.filter(x => x.type === 'activateResponse');
    const passAct = legal.find(x => x.type === 'passPriority');
    for (let i = 0; i < responses.length; i++) {
      const r = responses[i];
      const name = r.name || r.cardId || '?';
      btns += '<button class="resp-btn" data-ov="chainResp:' + i + '">' + cs.use + ' ' + V().esc(name) + '</button>';
    }
    if (passAct) {
      btns += '<button class="pass-btn" data-ov="chainPass">' + cs.pass + '</button>';
    }
    return '<div class="overlay"><div class="modal"><h2>' + V().esc(label) + '</h2>' +
      '<div class="priority-tag">' + cs.priority + ' ' + V().esc(pname) + '</div>' +
      '<div class="resp-btns">' + btns + '</div></div></div>';
  }

  // 5D: Build pending overlay (chooseTarget, chooseCards, chooseOption, yesNo, chooseSlot)
  function buildPendingOverlay(st, v) {
    const pd = st.pending;
    const label = S().prompts[pd.prompt] || S().prompts.unknown;
    const ps = S().pending;
    const kind = pd.kind;

    if (kind === 'yesNo') {
      return '<div class="overlay"><div class="modal"><h2>' + V().esc(label) + '</h2>' +
        '<div class="opt-btns"><button class="gold" data-ov="pendYes">' + S().chain.yes + '</button>' +
        '<button data-ov="pendNo">' + S().chain.no + '</button></div></div></div>';
    }

    if (kind === 'chooseOption') {
      let btns = '';
      for (let i = 0; i < pd.options.length; i++) {
        const o = pd.options[i];
        const nm = o.name || o.text || ('ตัวเลือก ' + (i + 1));
        btns += '<button data-ov="pendOpt:' + i + '">' + V().esc(nm) + '</button>';
      }
      return '<div class="overlay"><div class="modal"><h2>' + V().esc(label) + '</h2>' +
        '<div class="opt-btns">' + btns + '</div></div></div>';
    }

    if (kind === 'chooseSlot') {
      let btns = '';
      for (let i = 0; i < pd.options.length; i++) {
        const o = pd.options[i];
        btns += '<button data-ov="pendSlot:' + i + '">' + (ps.slotPrompt + ' ' + ((o.slot !== undefined ? o.slot : o.index) + 1)) + '</button>';
      }
      return '<div class="overlay"><div class="modal"><h2>' + V().esc(label) + '</h2>' +
        '<div class="opt-btns">' + btns + '</div></div></div>';
    }

    // chooseTarget / chooseCards: grid picker
    let items = '';
    for (let i = 0; i < pd.options.length; i++) {
      const o = pd.options[i];
      const def = o.uid ? E().findCard(o.cardId) : null;
      const name = def ? def.name : (o.name || o.cardId || '?');
      const picked = pendingSel.has(i);
      const statLine = def && def.type !== 'spell'
        ? ps.lvLabel + (def.level || '?') + ' ' + ps.atkLabel + ' ' + (def.atk || '?') + ' / ' + ps.defLabel + ' ' + (def.def || '?')
        : '';
      const zoneLine = o.side ? (ps.sideLabel[o.side] || '') : '';
      items += '<div class="pick-item' + (picked ? ' picked' : '') + '" data-ov="pickIdx:' + i + '">' +
        '<div class="pi-name">' + V().esc(name) + '</div>' +
        (statLine ? '<div class="pi-stat">' + statLine + '</div>' : '') +
        (zoneLine ? '<div class="pi-zone">' + zoneLine + '</div>' : '') +
        '</div>';
    }

    const n = pendingSel.size;
    const countText = ps.selected.replace('{n}', n).replace('{max}', pd.max);
    const canConfirm = n >= pd.min && n <= pd.max;

    return '<div class="overlay"><div class="modal"><h2>' + V().esc(label) + '</h2>' +
      '<div class="select-count">' + countText + '</div>' +
      '<div class="picker-grid">' + items + '</div>' +
      '<div class="confirm-bar"><button class="gold" data-ov="pendConfirm" ' + (canConfirm ? '' : 'disabled') + '>' + S().app.confirm + '</button></div></div></div>';
  }

  function showZone(pi, z) {
    const p = state.players[pi], a = S().app, vw = viewer();
    const secret = (z === 'deck') || (z === 'extra' && pi !== vw);
    let body = '';
    if (secret) {
      body = '<div class="m" style="color:var(--mut)">' + p[z].length + ' ' + a.count + '</div>';
    } else if (z === 'extra' && pi === vw) {
      const legal = E().getLegalActions(state, vw);
      body = p.extra.length ? p.extra.map((c, i) => {
        const def = V().def(c);
        const canSummon = legal.some(x => x.type === 'extraSummon' && x.extraIdx === i);
        return '<div class="row" style="justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid var(--bd)">' +
          '<div><b>' + V().esc(def.name) + '</b> <small>(Lv' + (def.level || '?') + ' ' + (def.atk || 0) + '/' + (def.def || 0) + ')</small></div>' +
          (canSummon ? '<button class="gold" data-ov="callExtra:' + i + '">' + a.extraSummon + '</button>' : '') +
          '</div>';
      }).join('') : '<div>' + a.empty + '</div>';
    } else {
      const names = p[z].map(c => V().def(c).name);
      body = p[z].length ? p[z].map((c, i) => '<div class="row zone-card-row" data-zone-cuid="' + c.uid + '" style="cursor:pointer;justify-content:space-between;align-items:center;padding:4px 2px;border-bottom:1px solid var(--bd)"><span>' + V().esc(V().def(c).name) + '</span><small class="pill">🔍 ดูการ์ด</small></div>').join('') : '<div>' + a.empty + '</div>';
    }
    const o = document.createElement('div'); o.className = 'overlay'; o.style.zIndex = 70;
    o.innerHTML = '<div class="modal"><h2>' + V().esc(V().pname(state, pi)) + ' — ' + a[z === 'extra' ? 'extraDeck' : z] + '</h2><div class="list">' + body + '</div><br><button>' + a.close + '</button></div>';
    o.onclick = (e) => {
      const b = e.target.closest('[data-ov]');
      if (b && b.dataset.ov.startsWith('callExtra:')) {
        const extraIdx = Number(b.dataset.ov.slice(10));
        o.remove();
        const legals = E().getLegalActions(state, vw).filter(x => x.type === 'extraSummon' && x.extraIdx === extraIdx);
        if (legals.length === 1) {
          act(legals[0]);
        } else if (legals.length > 1) {
          sel = { kind: 'extra', idx: extraIdx };
          render();
        }
        return;
      }
      const it = e.target.closest('[data-zone-cuid]');
      if (it) {
        const uid = Number(it.dataset.zoneCuid);
        const inst = V().uidMap(state)[uid];
        if (inst) {
          o.remove();
          CG.ui.inspectCard = { inst, isOpponent: pi !== vw };
          render();
          return;
        }
      }
      if (e.target === o || e.target.tagName === 'BUTTON') o.remove();
    };
    document.body.appendChild(o);
  }

  // ---------------- ลงมือ ----------------
  function toast(msg) {
    const t = document.createElement('div'); t.id = 'toast'; t.textContent = msg;
    $('toastRoot').innerHTML = ''; $('toastRoot').appendChild(t); setTimeout(() => { if (t.parentNode) t.remove(); }, 2600);
  }
  function act(action) {
    phaseMenuOpen = false;
    CG.ui.inspectCard = null;
    const r = E().applyAction(state, action);
    if (!r.ok) { toast(V().errorText(r.error)); return false; }
    evBuf = evBuf.concat(r.events); sel = null; handSel = new Set(); pendingSel = new Set();
    afterAction(); return true;
  }
  function afterAction() {
    render(); schedule();
  }

  function onOverlay(e) {
    const b = e.target.closest('[data-ov]'), pick = e.target.closest('[data-pick]'), v = viewer();
    if (pick) { const u = Number(pick.dataset.pick); handSel.has(u) ? handSel.delete(u) : handSel.add(u); render(); return; }
    if (!b) return; const k = b.dataset.ov;
    if (k === 'ready') { confirmedViewer = v; render(); }
    else if (k === 'again') start();
    else if (k === 'menu') lobby();
    else if (k === 'keep') act({ type: 'pass', player: v });
    else if (k === 'mulAll') act({ type: 'mulligan', player: v });
    else if (k === 'mulSel') { const p = state.players[v]; act({ type: 'mulligan', player: v, indices: p.hand.map((c, i) => handSel.has(c.uid) ? i : -1).filter(i => i >= 0) }); }
    else if (k === 'discard') act({ type: 'respond', player: v, choice: Array.from(handSel) });
    else if (k.startsWith('resp:')) { const x = E().getLegalActions(state, v).filter(y => y.type === 'respond')[Number(k.slice(5))]; if (x) act(x); }
    // 5D: Chain window actions
    else if (k === 'chainPass') { act({ type: 'passPriority', player: v }); }
    else if (k.startsWith('chainResp:')) {
      const idx = Number(k.slice(10));
      const legal = E().getLegalActions(state, v);
      const responses = legal.filter(x => x.type === 'activateResponse');
      if (responses[idx]) act(responses[idx]);
    }
    // 5D: Pending actions
    else if (k === 'pendYes') { act({ type: 'respond', player: v, choice: [0] }); }
    else if (k === 'pendNo') { act({ type: 'respond', player: v, choice: [1] }); }
    else if (k.startsWith('pendOpt:')) { act({ type: 'respond', player: v, choice: [Number(k.slice(8))] }); }
    else if (k.startsWith('pendSlot:')) { act({ type: 'respond', player: v, choice: [Number(k.slice(9))] }); }
    else if (k.startsWith('pickIdx:')) {
      const idx = Number(k.slice(8));
      if (pendingSel.has(idx)) pendingSel.delete(idx); else pendingSel.add(idx);
      // enforce max
      const pd = state.pending;
      if (pd && pendingSel.size > pd.max) {
        // remove oldest
        const arr = Array.from(pendingSel);
        pendingSel.delete(arr[0]);
      }
      render();
    }
    else if (k === 'pendConfirm') {
      const choice = Array.from(pendingSel).sort((a, b) => a - b);
      act({ type: 'respond', player: v, choice });
    }
  }

  function onClick(e) {
    if (!state || state.ended) return;
    const v = viewer(), p = state.players[v];
    if (phaseMenuOpen && !e.target.closest('.phase-btn-wrap')) {
      phaseMenuOpen = false;
      render();
    }
    if (e.target.closest('#btnMenu')) { lobby(); return; }
    if (e.target.closest('#btnSpeed')) {
      const next = currentSpeed === 'normal' ? 'fast' : currentSpeed === 'fast' ? 'slow' : 'normal';
      setSpeed(next);
      return;
    }
    // คลิกช่อง disabled หรือ effect cell ที่ไม่พร้อมใช้เพื่อแสดงเหตุผล
    const disCell = e.target.closest('[data-reason]');
    if (disCell && (disCell.classList.contains('disabled') || disCell.classList.contains('detail-effect-cell'))) {
      const reason = disCell.getAttribute('data-reason');
      const rBox = $('cmdReasonBox');
      if (rBox) {
        rBox.textContent = reason ? ('⚠ ' + reason) : '⚠ ไม่สามารถทำได้ในขณะนี้';
      }
      return;
    }
    // การ์ดบนมือคู่แข่ง: ห้ามเปิดหน้าต่างและห้ามเผยเนื้อหา
    if (e.target.closest('.handrow.opp')) return;

    const z = e.target.closest('[data-zone]'); if (z) { const [i, n] = z.dataset.zone.split(':'); showZone(Number(i), n); return; }
    const card = e.target.closest('.card');
    if (card && card.dataset.uid) { const m = V().uidMap(state)[card.dataset.uid]; if (m) $('inspect').innerHTML = V().inspectHtml(m, v); }
    if (mode === 'bot' && (botBusy || botToAct() !== null)) return;
    const b = e.target.closest('[data-act]');
    if (b) { return onAct(b.dataset.act, v); }
    if (state.pending || state.phase === 'mulligan' || state.activeIdx !== v) return;

    const hand = e.target.closest('[data-hand]'), slot = e.target.closest('[data-slot]'), spellSlot = e.target.closest('[data-spell-slot]');

    // ตรวจสอบการคลิกช่องของคู่แข่ง
    if (slot) {
      const pi = Number(slot.dataset.p), si = Number(slot.dataset.slot);
      if (pi !== v) {
        if (sel && sel.kind === 'attack') {
          act({ type: 'attack', player: v, from: sel.slot, to: si });
          return;
        }
        const oppM = state.players[pi].monsters[si];
        if (!oppM || oppM.faceDown) return; // การ์ดคว่ำของคู่แข่ง: ห้ามเปิดหน้าต่าง
        CG.ui.inspectCard = { inst: oppM, isOpponent: true };
        sel = null;
        render();
        return;
      }
    }
    if (spellSlot) {
      const pi = Number(spellSlot.dataset.p), si = Number(spellSlot.dataset.spellSlot);
      if (pi !== v) {
        const oppSp = state.players[pi].spells[si];
        if (!oppSp || oppSp.faceDown) return; // การ์ดคว่ำของคู่แข่ง: ห้ามเปิดหน้าต่าง
        CG.ui.inspectCard = { inst: oppSp, isOpponent: true };
        sel = null;
        render();
        return;
      }
    }
    const fz = e.target.closest('[data-zone2="field"]');
    if (fz) {
      const fsCard = p.fieldSpell || state.players[1 - v].fieldSpell;
      if (fsCard) {
        CG.ui.inspectCard = { inst: fsCard, isOpponent: !p.fieldSpell };
        sel = null;
        render();
        return;
      }
    }

    if (hand) {
      sel = { kind: 'hand', idx: Number(hand.dataset.hand), mode: null, mats: [] };
      CG.ui.inspectCard = null;
      render();
      return;
    }

    if (spellSlot) {
      const pi = Number(spellSlot.dataset.p), si = Number(spellSlot.dataset.spellSlot);
      if (sel && sel.kind === 'hand' && sel.mode === 'setSpell' && pi === v) {
        act({ type: 'setSpell', player: v, handIdx: sel.idx, slot: si });
        return;
      }
      if (pi === v && p.spells[si]) {
        sel = { kind: 'spell', slot: si };
        CG.ui.inspectCard = null;
        render();
        return;
      }
    }
    if (!slot) return;
    const pi = Number(slot.dataset.p), si = Number(slot.dataset.slot);
    if (sel && sel.kind === 'hand') {
      if (sel.mode === 'normal' && pi === v) act({ type: 'normalSummon', player: v, handIdx: sel.idx, slot: si });
      else if (sel.mode === 'set' && pi === v) act({ type: 'setMonster', player: v, handIdx: sel.idx, slot: si });
      else if (sel.mode === 'overlay' && pi === v) act({ type: 'overlay', player: v, handIdx: sel.idx, targetSlot: si });
      else if (sel.mode === 'tribute' && pi === v) {
        if (!sel.matsOk) { if (p.monsters[si]) { const k = sel.mats.indexOf(si); k >= 0 ? sel.mats.splice(k, 1) : sel.mats.push(si); render(); } }
        else act({ type: 'tributeSummon', player: v, handIdx: sel.idx, materials: sel.mats.slice(), slot: si });
      }
      return;
    }
    if (sel && sel.kind === 'extra' && pi === v) {
      act({ type: 'extraSummon', player: v, extraIdx: sel.idx, targetSlot: si });
      return;
    }
    if (pi === v && p.monsters[si]) {
      sel = { kind: 'field', slot: si };
      CG.ui.inspectCard = null;
      render();
    }
  }

  function onAct(k, v) {
    if (k === 'closeModal') { sel = null; CG.ui.inspectCard = null; render(); return; }
    if (k === 'togglePhaseMenu') { phaseMenuOpen = !phaseMenuOpen; render(); return; }
    if (k === 'cancel') { sel = null; CG.ui.inspectCard = null; render(); }
    else if (k === 'next') { phaseMenuOpen = false; act({ type: 'advancePhase', player: v }); }
    else if (k === 'end') { phaseMenuOpen = false; act({ type: 'endTurn', player: v }); }
    else if (k.startsWith('mode:')) { sel.mode = k.slice(5); sel.mats = []; sel.matsOk = false; CG.ui.inspectCard = null; render(); }
    else if (k === 'mats') { if (!sel.mats.length) return toast(S().errors.MATERIAL_INVALID); sel.matsOk = true; render(); }
    else if (k === 'flip') act({ type: 'flipSummon', player: v, slot: sel.slot });
    else if (k === 'pos') act({ type: 'changePosition', player: v, slot: sel.slot });
    else if (k === 'atk') { sel = { kind: 'attack', slot: sel.slot }; CG.ui.inspectCard = null; render(); }
    else if (k === 'direct') act({ type: 'attack', player: v, from: sel.slot, to: null });
    else if (k === 'actSpell') act({ type: 'activateSpell', player: v, handIdx: sel.idx });
    else if (k === 'actSpellField') act({ type: 'activateSpell', player: v, spellSlot: sel.slot });
    else if (k.startsWith('actEff:hand:')) act({ type: 'activateEffect', player: v, handIdx: sel.idx, effectId: k.slice(12) });
    else if (k.startsWith('actEff:field:')) act({ type: 'activateEffect', player: v, slot: sel.slot, effectId: k.slice(13) });
  }

  // ---------------- บอท (ตรรกะตัดสินใจย้ายไป bot/bot.js ตาม 7A) ----------------
  // 7P: Event highlights & destruction ghosts
  function processEventHighlights(events) {
    cardHl = {};
    clearTimeout(hlTimer);
    if (!events || !events.length) return;
    events.forEach(ev => {
      if (ev.type === 'summon') {
        cardHl[ev.uid] = ev.how === 'overlay' ? 'ev-overlay' : 'ev-summon';
      } else if (ev.type === 'attackDeclared') {
        const p = state.players[ev.player];
        if (p && p.monsters[ev.from]) cardHl[p.monsters[ev.from].uid] = 'atk-anim';
        if (ev.to !== null) {
          const opp = state.players[1 - ev.player];
          if (opp && opp.monsters[ev.to]) cardHl[opp.monsters[ev.to].uid] = 'ev-attacked';
        }
      } else if (ev.type === 'positionChange') {
        cardHl[ev.uid] = 'ev-pos';
      }
    });
    hlTimer = setTimeout(() => {
      cardHl = {};
      render();
    }, 700);
  }

  // 7P: Format Thai banner for bot actions
  function formatBotBanner(st, act, events) {
    const s = S(), a = s.app, b = s.app.banner || {};
    const p = st.players[act.player];
    const def = (c) => V().def(c);
    const cardName = (c) => c ? def(c).name : '';

    switch (act.type) {
      case 'normalSummon': {
        const m = p.monsters[act.slot];
        const nm = m ? cardName(m) : '';
        return (b.summon || 'บอท {how} {c} ที่ช่อง {s}').replace('{how}', s.how.normal).replace('{c}', nm).replace('{s}', act.slot + 1);
      }
      case 'setMonster': {
        return (b.summonHidden || 'บอท {how} มอนสเตอร์ ที่ช่อง {s}').replace('{how}', s.how.set).replace('{s}', act.slot + 1);
      }
      case 'tributeSummon': {
        const m = p.monsters[act.slot];
        const nm = m ? cardName(m) : '';
        return (b.summon || 'บอท {how} {c} ที่ช่อง {s}').replace('{how}', s.how.tribute).replace('{c}', nm).replace('{s}', act.slot + 1);
      }
      case 'overlay': {
        const m = p.monsters[act.targetSlot];
        const nm = m ? cardName(m) : '';
        return (b.summon || 'บอท {how} {c} ที่ช่อง {s}').replace('{how}', s.how.overlay).replace('{c}', nm).replace('{s}', act.targetSlot + 1);
      }
      case 'extraSummon': {
        const m = p.monsters[act.targetSlot];
        const nm = m ? cardName(m) : '';
        return (b.summon || 'บอท {how} {c} ที่ช่อง {s}').replace('{how}', s.how.extra).replace('{c}', nm).replace('{s}', act.targetSlot + 1);
      }
      case 'flipSummon': {
        const m = p.monsters[act.slot];
        return 'บอท ' + s.how.flip + (m ? ' ' + cardName(m) : '');
      }
      case 'changePosition': {
        const m = p.monsters[act.slot];
        return 'บอท ' + s.app.changePos + (m ? ' ' + cardName(m) : '');
      }
      case 'attack': {
        const toText = act.to === null ? s.ev.attackDirect : ('ช่อง ' + (act.to + 1));
        return (b.attack || 'บอท โจมตี: ช่อง {from} → {to}').replace('{from}', act.from + 1).replace('{to}', toText);
      }
      case 'activateSpell': {
        let nm = '';
        if (act.handIdx !== undefined && p.hand[act.handIdx]) nm = cardName(p.hand[act.handIdx]);
        else if (act.spellSlot !== undefined && p.spells[act.spellSlot]) nm = cardName(p.spells[act.spellSlot]);
        return (b.actSpell || 'บอท ใช้สเปล {c}').replace('{c}', nm);
      }
      case 'setSpell': {
        return (b.setSpell || 'บอท หมอบสเปล ที่ช่อง {s}').replace('{s}', act.slot + 1);
      }
      case 'activateEffect': {
        let nm = '';
        if (act.slot !== undefined && p.monsters[act.slot]) nm = cardName(p.monsters[act.slot]);
        else if (act.handIdx !== undefined && p.hand[act.handIdx]) nm = cardName(p.hand[act.handIdx]);
        return (b.actEffect || 'บอท ใช้เอฟเฟกต์ {c}').replace('{c}', nm);
      }
      case 'advancePhase': {
        return (b.phaseChange || 'บอท เปลี่ยนเฟสเป็น {ph}').replace('{ph}', s.phase[st.phase] || st.phase);
      }
      case 'endTurn': {
        return b.endTurn || 'บอท จบเทิร์น';
      }
      case 'activateResponse': {
        return (b.chainResp || 'บอท ตอบโต้ใน Chain: {c}').replace('{c}', act.name || act.cardId || '');
      }
      default:
        return 'บอท: ' + act.type;
    }
  }

  function showBotBanner(text, delayMs) {
    clearTimeout(bannerTimer);
    botBannerText = text;
    botBannerFade = false;
    render();
    bannerTimer = setTimeout(() => {
      botBannerFade = true;
      render();
      bannerTimer = setTimeout(() => {
        botBannerText = null;
        botBannerFade = false;
        render();
      }, 350);
    }, Math.max(300, delayMs - 350));
  }

  function botStep(idx) {
    if (!state || state.ended || botToAct() !== idx) {
      botBusy = false;
      render();
      return;
    }
    const legal = E().getLegalActions(state, idx);
    if (!legal.length) {
      botBusy = false;
      render();
      return;
    }
    const chooser = (CG.bot && (CG.bot.choose || CG.bot.chooseAction)) || CG.ui.botChoose;
    let a = chooser(state, idx, legal, { level: currentDifficulty });
    let r = E().applyAction(state, a);
    if (!r.ok) {
      a = legal.find(x => x.type === 'advancePhase') || legal.find(x => x.type === 'endTurn') || legal[0];
      r = E().applyAction(state, a);
    }
    if (!r.ok) {
      console.error('bot stuck', a, r.error);
      botBusy = false;
      return;
    }

    evBuf = evBuf.concat(r.events);
    processEventHighlights(r.events);

    const delay = V().getActionDelay(a.type, currentSpeed);
    const bannerMsg = formatBotBanner(state, a, r.events);
    showBotBanner(bannerMsg, delay);

    render();

    clearTimeout(timer);
    const nextBot = botToAct();
    if (nextBot !== null) {
      botBusy = true;
      timer = setTimeout(() => botStep(nextBot), delay);
    } else {
      botBusy = false;
      render();
    }
  }

  function schedule() {
    clearTimeout(timer);
    const b = botToAct();
    if (b === null) {
      botBusy = false;
      return;
    }
    botBusy = true;
    const delay = state.phase === 'mulligan' ? 200 : V().getActionDelay('normal', currentSpeed);
    timer = setTimeout(() => botStep(b), delay);
  }

  // 5D/7A: Alias botChoose to CG.bot.choose
  CG.ui.botChoose = (st, idx, legal, opts) => (CG.bot && CG.bot.choose ? CG.bot.choose(st, idx, legal, opts) : null);
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { chooseAction: CG.ui.botChoose, botChoose: CG.ui.botChoose };
  }

  CG.ui.app = { start: lobby, _render: () => render(), _debug: () => ({ state, mode }) };
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', lobby); else lobby();
  }
})();
