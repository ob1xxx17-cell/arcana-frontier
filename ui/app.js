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

  // ---------------- ล็อบบี้ ----------------
  function lobby() {
    clearTimeout(timer); state = null;
    $('game').classList.add('hidden'); $('lobby').classList.remove('hidden'); $('overlayRoot').innerHTML = '';
    const keys = Object.keys(CG.cards || {}); const a = S().app;
    if (!deckA || !CG.cards[deckA]) deckA = keys[0]; if (!deckB || !CG.cards[deckB]) deckB = keys[1] || keys[0];
    const picker = (who, cur) => keys.map(k => {
      const d = CG.cards[k], n = d.main.reduce((x, c) => x + (c.count || 1), 0);
      return '<button class="deckbtn ' + (cur === k ? 'active' : '') + '" data-deck="' + who + ':' + k + '">' + V().esc(d.name) + '<small>main ' + n + ' · extra ' + d.extra.length + '</small></button>';
    }).join('');
    $('lobby').innerHTML = '<div class="lobby-box"><h1>🃏 ' + a.title + '</h1><div class="sub">' + a.subtitle + '</div>' +
      '<div class="row seg"><button data-mode="bot" class="' + (mode === 'bot' ? 'active' : '') + '">' + a.modeBot + '</button><button data-mode="pvp" class="' + (mode === 'pvp' ? 'active' : '') + '">' + a.modePvp + '</button></div>' +
      '<div class="decks"><div><h2>' + a.p1 + '</h2>' + picker('A', deckA) + '</div><div><h2>' + (mode === 'bot' ? a.bot : a.p2) + '</h2>' + picker('B', deckB) + '</div></div>' +
      '<div class="lobby-start"><button class="gold" id="btnStart">' + a.start + '</button></div></div>';
    $('lobby').onclick = (e) => {
      const m = e.target.closest('[data-mode]'), d = e.target.closest('[data-deck]');
      if (m) { mode = m.dataset.mode; lobby(); }
      else if (d) { const [w, k] = d.dataset.deck.split(':'); if (w === 'A') deckA = k; else deckB = k; lobby(); }
      else if (e.target.closest('#btnStart')) start();
    };
  }

  function start() {
    seed = (Math.random() * 1e9) | 0;
    state = E().createGame({ deckA, deckB, seed, mode });
    sel = null; handSel = new Set(); evBuf = []; confirmedViewer = null;
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
    V().render($('game'), { state, viewer: v, sel, legal, handSel });
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
    if ((sel.kind === 'field' || sel.kind === 'attack') && !p.monsters[sel.slot]) return true;
    return false;
  }
  function animate(v) {
    evBuf.forEach(ev => {
      if (ev.type === 'attackDeclared') { const el = document.querySelector('.card[data-p="' + ev.player + '"][data-slot="' + ev.from + '"]'); if (el) el.classList.add('atk-anim'); }
      if (ev.type === 'lpChange') { const el = document.querySelector('[data-lp="' + ev.player + '"]'); if (el) el.classList.add('pulse'); }
    });
    evBuf = [];
  }

  // ---------------- overlay: mulligan / ทิ้งมือ / pending / ส่งเครื่อง / จบเกม ----------------
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
    } else if (st.pending && st.pending.player === v) {
      const pd = st.pending, label = S().prompts[pd.prompt] || S().prompts.unknown;
      const opts = E().getLegalActions(st, v).filter(x => x.type === 'respond');
      h = '<div class="overlay"><div class="modal"><h2>' + V().esc(label) + '</h2><div class="row" style="justify-content:center">' +
        opts.map((x, i) => '<button data-ov="resp:' + i + '">' + V().esc(typeof x.choice === 'boolean' ? (x.choice ? S().chain.yes : S().chain.no) : JSON.stringify(x.choice)) + '</button>').join('') + '</div></div></div>';
    }
    root.innerHTML = h;
    root.onclick = onOverlay;
  }

  function showZone(pi, z) {
    const p = state.players[pi], a = S().app, vw = viewer();
    const secret = (z === 'deck') || (z === 'extra' && pi !== vw);
    const names = secret ? [] : p[z].map(c => V().def(c).name);
    const body = secret ? '<div class="m" style="color:var(--mut)">' + p[z].length + ' ' + a.count + '</div>' : (names.length ? names.map(n => '<div>' + V().esc(n) + '</div>').join('') : '<div>' + a.empty + '</div>');
    const o = document.createElement('div'); o.className = 'overlay'; o.style.zIndex = 70;
    o.innerHTML = '<div class="modal"><h2>' + V().esc(V().pname(state, pi)) + ' — ' + a[z === 'extra' ? 'extraDeck' : z] + '</h2><div class="list">' + body + '</div><br><button>' + a.close + '</button></div>';
    o.onclick = (e) => { if (e.target === o || e.target.tagName === 'BUTTON') o.remove(); };
    document.body.appendChild(o);
  }

  // ---------------- ลงมือ ----------------
  function toast(msg) {
    const t = document.createElement('div'); t.id = 'toast'; t.textContent = msg;
    $('toastRoot').innerHTML = ''; $('toastRoot').appendChild(t); setTimeout(() => { if (t.parentNode) t.remove(); }, 2600);
  }
  function act(action) {
    const r = E().applyAction(state, action);
    if (!r.ok) { toast(V().errorText(r.error)); return false; }
    evBuf = evBuf.concat(r.events); sel = null; handSel = new Set();
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
  }

  function onClick(e) {
    if (!state || state.ended) return;
    const v = viewer(), p = state.players[v];
    if (e.target.closest('#btnMenu')) { lobby(); return; }
    const z = e.target.closest('[data-zone]'); if (z) { const [i, n] = z.dataset.zone.split(':'); showZone(Number(i), n); return; }
    const card = e.target.closest('.card');
    if (card && card.dataset.uid) { const m = V().uidMap(state)[card.dataset.uid]; if (m) $('inspect').innerHTML = V().inspectHtml(m, v); }
    const b = e.target.closest('[data-act]');
    if (b) { return onAct(b.dataset.act, v); }
    if (state.pending || state.phase === 'mulligan' || state.activeIdx !== v) return;
    const hand = e.target.closest('[data-hand]'), slot = e.target.closest('[data-slot]');
    if (hand) { sel = { kind: 'hand', idx: Number(hand.dataset.hand), mode: null, mats: [] }; render(); return; }
    if (!slot) return;
    const pi = Number(slot.dataset.p), si = Number(slot.dataset.slot);
    if (sel && sel.kind === 'hand') {
      if (sel.mode === 'normal' && pi === v) act({ type: 'normalSummon', player: v, handIdx: sel.idx, slot: si });
      else if (sel.mode === 'set' && pi === v) act({ type: 'setMonster', player: v, handIdx: sel.idx, slot: si });
      else if (sel.mode === 'tribute' && pi === v) {
        if (!sel.matsOk) { if (p.monsters[si]) { const k = sel.mats.indexOf(si); k >= 0 ? sel.mats.splice(k, 1) : sel.mats.push(si); render(); } }
        else act({ type: 'tributeSummon', player: v, handIdx: sel.idx, materials: sel.mats.slice(), slot: si });
      }
      return;
    }
    if (sel && sel.kind === 'attack' && pi !== v) { act({ type: 'attack', player: v, from: sel.slot, to: si }); return; }
    if (pi === v && p.monsters[si]) { sel = { kind: 'field', slot: si }; render(); }
  }

  function onAct(k, v) {
    if (k === 'cancel') { sel = null; render(); }
    else if (k === 'next') act({ type: 'advancePhase', player: v });
    else if (k === 'end') act({ type: 'endTurn', player: v });
    else if (k.startsWith('mode:')) { sel.mode = k.slice(5); sel.mats = []; sel.matsOk = false; render(); }
    else if (k === 'mats') { if (!sel.mats.length) return toast(S().errors.MATERIAL_INVALID); sel.matsOk = true; render(); }
    else if (k === 'flip') act({ type: 'flipSummon', player: v, slot: sel.slot });
    else if (k === 'pos') act({ type: 'changePosition', player: v, slot: sel.slot });
    else if (k === 'atk') { sel = { kind: 'attack', slot: sel.slot }; render(); }
    else if (k === 'direct') act({ type: 'attack', player: v, from: sel.slot, to: null });
  }

  // ---------------- บอท ----------------
  function fallbackBot(st, idx, legal) {
    const by = (t) => legal.filter(x => x.type === t);
    const cardLv = (a) => E().cardOf(st.players[idx].hand[a.handIdx]) || {};
    if (st.phase === 'mulligan') return by('pass')[0] || legal[0];
    if (st.pending) { const r = by('respond'); return r[0] || legal[0]; }
    const me = st.players[idx], op = st.players[1 - idx];
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
        return E().atk(m) > (t.position === 'atk' ? E().atk(t) : E().def(t));
      });
      if (at.length) return at[0];
    }
    return by('advancePhase')[0] || by('endTurn')[0] || legal[0];
  }
  function botStep(idx) {
    if (!state || state.ended || botToAct() !== idx) return;
    const legal = E().getLegalActions(state, idx); if (!legal.length) return;
    const chooser = (CG.bot && CG.bot.chooseAction) || fallbackBot;
    let a = chooser(state, idx, legal);
    let r = E().applyAction(state, a);
    if (!r.ok) { a = legal.find(x => x.type === 'advancePhase') || legal.find(x => x.type === 'endTurn') || legal[0]; r = E().applyAction(state, a); }
    if (!r.ok) { console.error('bot stuck', a, r.error); return; }
    evBuf = evBuf.concat(r.events); afterAction();
  }
  function schedule() {
    clearTimeout(timer);
    const b = botToAct(); if (b === null) return;
    timer = setTimeout(() => botStep(b), state.phase === 'mulligan' ? 150 : cfg.botDelayMs);
  }

  CG.ui.app = { start: lobby, _render: () => render(), _debug: () => ({ state, mode }) };
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', lobby); else lobby();
  }
})();
