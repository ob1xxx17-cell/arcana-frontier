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
  let endSoundPlayed = false;
  let dragState = null, ghostEl = null, justDragged = false;
  let dndInitialized = false;
  CG.ui.timers = CG.ui.timers || { p0: 0, p1: 0, lastTick: null, intervalId: null };

  // ---------------- ระบบเสียงสังเคราะห์แบบยูกิ (Web Audio API: 0ms latency, zero files) ----------------
  const AudioFX = (function () {
    let ctx = null, enabled = true;
    function getCtx() {
      if (!ctx && typeof window !== 'undefined') {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) ctx = new AC();
      }
      if (ctx && ctx.state === 'suspended') ctx.resume();
      return ctx;
    }

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      const unlock = () => {
        const c = getCtx();
        if (c && c.state === 'suspended') c.resume();
      };
      ['click', 'pointerdown', 'keydown', 'touchstart'].forEach(ev => {
        window.addEventListener(ev, unlock, { passive: true });
      });
    }

    let bgmInterval = null, tensionMode = false;
    const chords = [
      [146.83, 220.00, 261.63, 349.23], // Dm (D3, A3, C4, F4)
      [174.61, 220.00, 261.63, 349.23], // F (F3, A3, C4, F4)
      [130.81, 196.00, 261.63, 329.63], // C (C3, G3, C4, E4)
      [110.00, 164.81, 220.00, 261.63]  // Am (A2, E3, A3, C4)
    ];
    let chordIdx = 0, noteIdx = 0;

    function playBgmNote() {
      if (!enabled) return;
      try {
        const c = getCtx();
        if (!c) return;
        const t = c.currentTime;
        const currentChord = chords[chordIdx];
        const freq = currentChord[noteIdx % currentChord.length] * (tensionMode ? 1.5 : 1.0);

        const osc = c.createOscillator();
        const g = c.createGain();
        const filter = c.createBiquadFilter();

        osc.type = tensionMode ? 'sawtooth' : 'sine';
        osc.frequency.setValueAtTime(freq, t);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(tensionMode ? 1800 : 850, t);

        const vol = tensionMode ? 0.045 : 0.035;
        g.gain.setValueAtTime(0.001, t);
        g.gain.linearRampToValueAtTime(vol, t + 0.08);
        g.gain.exponentialRampToValueAtTime(0.0001, t + (tensionMode ? 0.38 : 0.75));

        osc.connect(filter);
        filter.connect(g);
        g.connect(c.destination);

        osc.start(t);
        osc.stop(t + (tensionMode ? 0.42 : 0.8));

        noteIdx++;
        if (noteIdx >= 8) {
          noteIdx = 0;
          chordIdx = (chordIdx + 1) % chords.length;
        }
      } catch (_) {}
    }

    function startBgmLoop() {
      if (bgmInterval || typeof window === 'undefined') return;
      bgmInterval = setInterval(playBgmNote, tensionMode ? 260 : 420);
    }

    function stopBgmLoop() {
      if (bgmInterval) {
        clearInterval(bgmInterval);
        bgmInterval = null;
      }
    }

    function createNoiseBuffer(c, duration) {
      const size = Math.floor(c.sampleRate * duration);
      const buf = c.createBuffer(1, size, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < size; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (size * 0.4));
      }
      return buf;
    }

    return {
      toggle() {
        enabled = !enabled;
        if (!enabled) stopBgmLoop();
        else if (typeof state !== 'undefined' && state && !state.ended) startBgmLoop();
        return enabled;
      },
      isEnabled() { return enabled; },
      startBGM() { startBgmLoop(); },
      stopBGM() { stopBgmLoop(); },
      setTension(isCritical) {
        if (tensionMode !== isCritical) {
          tensionMode = isCritical;
          if (bgmInterval) {
            stopBgmLoop();
            startBgmLoop();
          }
        }
      },
      play(name) {
        if (!enabled) return;
        try {
          const c = getCtx();
          if (!c) return;
          const t = c.currentTime;

          if (name === 'click') {
            const osc = c.createOscillator(), g = c.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(750, t);
            osc.frequency.exponentialRampToValueAtTime(140, t + 0.04);
            g.gain.setValueAtTime(0.12, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
            osc.connect(g); g.connect(c.destination);
            osc.start(t); osc.stop(t + 0.04);
          } else if (name === 'draw') {
            const dur = 0.22;
            const src = c.createBufferSource();
            src.buffer = createNoiseBuffer(c, dur);
            const filter = c.createBiquadFilter();
            filter.type = 'bandpass';
            filter.Q.setValueAtTime(2.2, t);
            filter.frequency.setValueAtTime(900, t);
            filter.frequency.exponentialRampToValueAtTime(2600, t + 0.1);
            filter.frequency.exponentialRampToValueAtTime(700, t + dur);
            const g = c.createGain();
            g.gain.setValueAtTime(0.01, t);
            g.gain.linearRampToValueAtTime(0.32, t + 0.06);
            g.gain.exponentialRampToValueAtTime(0.001, t + dur);
            src.connect(filter); filter.connect(g); g.connect(c.destination);
            src.start(t);
          } else if (name === 'card_drag') {
            const dur = 0.12;
            const src = c.createBufferSource();
            src.buffer = createNoiseBuffer(c, dur);
            const filter = c.createBiquadFilter();
            filter.type = 'bandpass'; filter.Q.setValueAtTime(1.8, t);
            filter.frequency.setValueAtTime(1600, t);
            const g = c.createGain();
            g.gain.setValueAtTime(0.15, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + dur);
            src.connect(filter); filter.connect(g); g.connect(c.destination);
            src.start(t);
          } else if (name === 'card_drop') {
            const osc = c.createOscillator(), g = c.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(130, t);
            osc.frequency.exponentialRampToValueAtTime(45, t + 0.08);
            g.gain.setValueAtTime(0.28, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
            osc.connect(g); g.connect(c.destination);
            osc.start(t); osc.stop(t + 0.08);
          } else if (name === 'summon') {
            const osc = c.createOscillator(), g = c.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(220, t);
            osc.frequency.exponentialRampToValueAtTime(42, t + 0.26);
            g.gain.setValueAtTime(0.48, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
            osc.connect(g); g.connect(c.destination);
            osc.start(t); osc.stop(t + 0.28);

            const snap = c.createOscillator(), sg = c.createGain();
            snap.type = 'sawtooth';
            snap.frequency.setValueAtTime(440, t);
            snap.frequency.exponentialRampToValueAtTime(110, t + 0.08);
            sg.gain.setValueAtTime(0.18, t);
            sg.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
            snap.connect(sg); sg.connect(c.destination);
            snap.start(t); snap.stop(t + 0.08);
          } else if (name === 'tribute') {
            const osc = c.createOscillator(), g = c.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(140, t);
            osc.frequency.linearRampToValueAtTime(380, t + 0.18);
            osc.frequency.exponentialRampToValueAtTime(35, t + 0.45);
            const filter = c.createBiquadFilter();
            filter.type = 'lowpass'; filter.frequency.setValueAtTime(950, t);
            g.gain.setValueAtTime(0.01, t);
            g.gain.linearRampToValueAtTime(0.55, t + 0.18);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
            osc.connect(filter); filter.connect(g); g.connect(c.destination);
            osc.start(t); osc.stop(t + 0.45);
          } else if (name === 'flip') {
            [0, 0.04].forEach((dt, idx) => {
              const osc = c.createOscillator(), g = c.createGain();
              osc.type = 'sine';
              osc.frequency.setValueAtTime(idx === 0 ? 540 : 760, t + dt);
              osc.frequency.exponentialRampToValueAtTime(180, t + dt + 0.035);
              g.gain.setValueAtTime(0.2, t + dt);
              g.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.035);
              osc.connect(g); g.connect(c.destination);
              osc.start(t + dt); osc.stop(t + dt + 0.035);
            });
          } else if (name === 'phase') {
            [587.33, 880.00].forEach((freq) => {
              const osc = c.createOscillator(), g = c.createGain();
              osc.type = 'sine';
              osc.frequency.setValueAtTime(freq, t);
              g.gain.setValueAtTime(0.12, t);
              g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
              osc.connect(g); g.connect(c.destination);
              osc.start(t); osc.stop(t + 0.35);
            });
          } else if (name === 'spell') {
            [523.25, 659.25, 783.99, 987.77, 1046.5].forEach((freq, idx) => {
              const osc = c.createOscillator(), g = c.createGain();
              osc.type = 'sine'; osc.frequency.setValueAtTime(freq, t + idx * 0.045);
              g.gain.setValueAtTime(0.18, t + idx * 0.045);
              g.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.045 + 0.28);
              osc.connect(g); g.connect(c.destination);
              osc.start(t + idx * 0.045); osc.stop(t + idx * 0.045 + 0.3);
            });
          } else if (name === 'attack') {
            const osc = c.createOscillator(), g = c.createGain();
            osc.type = 'sawtooth'; osc.frequency.setValueAtTime(950, t);
            osc.frequency.exponentialRampToValueAtTime(80, t + 0.22);
            g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
            osc.connect(g); g.connect(c.destination);
            osc.start(t); osc.stop(t + 0.22);
          } else if (name === 'destroy') {
            const src = c.createBufferSource();
            src.buffer = createNoiseBuffer(c, 0.32);
            const filter = c.createBiquadFilter();
            filter.type = 'lowpass'; filter.frequency.setValueAtTime(750, t);
            const g = c.createGain(); g.gain.setValueAtTime(0.5, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
            src.connect(filter); filter.connect(g); g.connect(c.destination);
            src.start(t);

            [2600, 3400].forEach(freq => {
              const osc = c.createOscillator(), sg = c.createGain();
              osc.type = 'triangle'; osc.frequency.setValueAtTime(freq, t);
              sg.gain.setValueAtTime(0.12, t);
              sg.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
              osc.connect(sg); sg.connect(c.destination);
              osc.start(t); osc.stop(t + 0.15);
            });
          } else if (name === 'lp') {
            [0, 0.08].forEach((dt) => {
              const osc = c.createOscillator(), g = c.createGain();
              osc.type = 'square'; osc.frequency.setValueAtTime(320, t + dt);
              osc.frequency.exponentialRampToValueAtTime(140, t + dt + 0.07);
              g.gain.setValueAtTime(0.15, t + dt);
              g.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.07);
              osc.connect(g); g.connect(c.destination);
              osc.start(t + dt); osc.stop(t + dt + 0.07);
            });
          } else if (name === 'chime') {
            [783.99, 1046.50, 1318.51, 1567.98].forEach((freq, idx) => {
              const osc = c.createOscillator(), g = c.createGain();
              osc.type = 'sine'; osc.frequency.setValueAtTime(freq, t + idx * 0.06);
              g.gain.setValueAtTime(0.16, t + idx * 0.06);
              g.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.06 + 0.35);
              osc.connect(g); g.connect(c.destination);
              osc.start(t + idx * 0.06); osc.stop(t + idx * 0.06 + 0.38);
            });
          } else if (name === 'fanfare') {
            const notes = [
              { f: 261.63, t: 0, d: 0.12 },
              { f: 329.63, t: 0.12, d: 0.12 },
              { f: 392.00, t: 0.24, d: 0.12 },
              { f: 523.25, t: 0.38, d: 0.45 },
              { f: 659.25, t: 0.38, d: 0.45 }
            ];
            notes.forEach(n => {
              const osc = c.createOscillator(), g = c.createGain();
              osc.type = 'triangle'; osc.frequency.setValueAtTime(n.f, t + n.t);
              g.gain.setValueAtTime(0.24, t + n.t);
              g.gain.exponentialRampToValueAtTime(0.001, t + n.t + n.d);
              osc.connect(g); g.connect(c.destination);
              osc.start(t + n.t); osc.stop(t + n.t + n.d);
            });
          } else if (name === 'defeat') {
            [220, 196, 174.61, 130.81].forEach((freq, idx) => {
              const osc = c.createOscillator(), g = c.createGain();
              osc.type = 'sawtooth'; osc.frequency.setValueAtTime(freq, t + idx * 0.16);
              g.gain.setValueAtTime(0.2, t + idx * 0.16);
              g.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.16 + 0.6);
              osc.connect(g); g.connect(c.destination);
              osc.start(t + idx * 0.16); osc.stop(t + idx * 0.16 + 0.65);
            });
          } else if (name === 'pack_tear') {
            // Realistic foil rip noise
            const dur = 0.45;
            const src = c.createBufferSource();
            src.buffer = createNoiseBuffer(c, dur);
            const filter = c.createBiquadFilter();
            filter.type = 'bandpass';
            filter.Q.setValueAtTime(2.8, t);
            filter.frequency.setValueAtTime(3400, t);
            filter.frequency.exponentialRampToValueAtTime(950, t + dur);

            const g = c.createGain();
            g.gain.setValueAtTime(0.01, t);
            g.gain.linearRampToValueAtTime(0.48, t + 0.05);
            g.gain.exponentialRampToValueAtTime(0.001, t + dur);

            src.connect(filter); filter.connect(g); g.connect(c.destination);
            src.start(t);

            // Foil crunch & pop
            const snap = c.createOscillator(), sg = c.createGain();
            snap.type = 'triangle';
            snap.frequency.setValueAtTime(280, t + 0.06);
            snap.frequency.exponentialRampToValueAtTime(50, t + 0.22);
            sg.gain.setValueAtTime(0.35, t + 0.06);
            sg.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
            snap.connect(sg); sg.connect(c.destination);
            snap.start(t + 0.06); snap.stop(t + 0.22);

            // Magical foil shimmer chime
            [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((freq, idx) => {
              const osc = c.createOscillator(), mg = c.createGain();
              osc.type = 'sine';
              osc.frequency.setValueAtTime(freq, t + 0.12 + idx * 0.05);
              mg.gain.setValueAtTime(0.18, t + 0.12 + idx * 0.05);
              mg.gain.exponentialRampToValueAtTime(0.0001, t + 0.48 + idx * 0.05);
              osc.connect(mg); mg.connect(c.destination);
              osc.start(t + 0.12 + idx * 0.05); osc.stop(t + 0.52 + idx * 0.05);
            });
          }
        } catch (_) {}
      }
    };
  })();
  CG.ui.audio = AudioFX;

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
        if (d === 'easy' || d === 'normal' || d === 'hard') return d;
      }
    } catch (e) {}
    return 'normal';
  }

  function setDifficulty(d) {
    if (d === 'easy' || d === 'normal' || d === 'hard') {
      currentDifficulty = d;
      try {
        if (typeof localStorage !== 'undefined') localStorage.setItem('cg_bot_difficulty', d);
      } catch (e) {}
      lobby();
    }
  }

  function getDeckAceDef(deckKey) {
    const d = (CG.cards || {})[deckKey];
    if (!d) return null;
    const E = CG.engine;
    const pool = (d.extra && d.extra.length) ? d.extra.concat(d.main || []) : (d.main || []);
    let best = null, bestAtk = -1;
    for (const item of pool) {
      const id = item.cardId || item.id;
      const def = E.findCard(id);
      if (def && def.atk != null && def.atk > bestAtk) {
        bestAtk = def.atk;
        best = def;
      }
    }
    return best || (pool[0] ? E.findCard(pool[0].cardId || pool[0].id) : null);
  }

  function showRulesModal() {
    const root = $('overlayRoot');
    if (!root) return;
    const modal = document.createElement('div');
    modal.className = 'overlay';
    modal.style.zIndex = '98';
    modal.innerHTML = '<div class="modal" style="max-width: 650px; text-align: left; background: rgba(14, 18, 42, 0.98); border: 1px solid var(--gold); box-shadow: 0 10px 40px rgba(0,0,0,0.9);">' +
      '<h2 style="color: var(--gold); margin-top:0; font-size:1.25rem;">📖 กติกาการเล่นพื้นฐาน (ASTRAL DUEL)</h2>' +
      '<div style="font-size: 0.86rem; line-height: 1.6; color: #ddd; max-height: 65vh; overflow-y: auto; padding-right: 6px;">' +
        '<p><strong style="color: #00d2ff;">1. โครงสร้างเทิร์น (Phases):</strong><br>' +
        '• <strong>จั่ว (Draw)</strong>: จั่วการ์ด 1 ใบและรับมานาตามลำดับเทิร์น<br>' +
        '• <strong>สแตนด์บาย (Standby)</strong>: แสดงผลเอฟเฟกต์อัตโนมัติ<br>' +
        '• <strong>เมน 1 (Main 1)</strong>: อัญเชิญ Entity, ใช้หรือหมอบ Distortion<br>' +
        '• <strong>ต่อสู้ (Battle)</strong>: สั่ง Entity ท่าโจมตีเข้าโจมตี หรือโจมตีตรง<br>' +
        '• <strong>เมน 2 (Main 2)</strong>: จัดการสนามและตั้งรับก่อนส่งเทิร์น<br>' +
        '• <strong>จบเทิร์น (End)</strong>: ทิ้งการ์ดหากการ์ดบนมือเกิน 6 ใบ</p>' +

        '<p><strong style="color: #ffd700;">2. การอัญเชิญมอนสเตอร์ (Summoning):</strong><br>' +
        '• <strong>Lv 1</strong>: อัญเชิญปกติได้เทิร์นละ 1 ตัว หรือ Set คว่ำป้องกัน<br>' +
        '• <strong>Lv 2 & 3</strong>: เสียสละมอนสเตอร์ (Lv2 ใช้ 1+1, Lv3 ใช้ 1+2 หรือ 1+1+1)<br>' +
        '• <strong>Grade 4 / Fusion</strong>: อัญเชิญพิเศษจาก Astral Gate (Extra Deck)</p>' +

        '<p><strong style="color: #2ecc71;">3. สเปล (Distortion):</strong><br>' +
        '• ปกติ (Normal): ร่ายจากมือในเมนเฟส<br>' +
        '• หมอบ/สวนกลับ (Set/Counter): หมอบคว่ำไว้ แล้วเปิดใช้ตอบโต้ในหน้าต่าง Chain Window</p>' +

        '<p><strong style="color: #ff6b81;">4. เงื่อนไขชนะ (Win Condition):</strong><br>' +
        '• ลด LP ศัตรูจาก 8,000 ให้เหลือ 0 หรือทำให้เด็คศัตรูหมดก่อน</p>' +
      '</div>' +
      '<div style="text-align: right; margin-top: 14px;">' +
        '<button class="gold" id="btnCloseRules">เข้าใจแล้ว ปิดหน้าต่าง</button>' +
      '</div>' +
    '</div>';
    modal.onclick = (e) => {
      if (e.target === modal || e.target.id === 'btnCloseRules') modal.remove();
    };
    root.appendChild(modal);
  }

  // ---------------- ด่านฝึกสอน (Tutorial Trials) ----------------
  function showTutorialModal() {
    const root = $('overlayRoot');
    if (!root) return;
    const modal = document.createElement('div');
    modal.className = 'overlay';
    modal.style.zIndex = '98';
    modal.innerHTML = '<div class="modal tutorial-modal">' +
      '<div class="tut-modal-header">' +
        '<h2>🎓 ด่านฝึกสอน & การทดสอบการดวล (Duel Trials)</h2>' +
        '<button class="detail-close-btn" id="btnCloseTutModal" style="position:static; margin:0;">✕</button>' +
      '</div>' +
      '<p class="tut-intro-desc">เลือกบทเรียนฝึกฝนกลยุทธ์สำคัญ เพื่อเริ่มต้นสถานการณ์จริงพร้อมคำแนะนำทีละขั้นตอน:</p>' +
      '<div class="trial-cards-grid">' +
        '<div class="trial-card">' +
          '<div class="trial-card-header">' +
            '<span class="trial-badge gold">บทเรียน 1</span>' +
            '<h3 class="trial-title">🌟 อัญเชิญระดับสูง (Tribute Summon)</h3>' +
          '</div>' +
          '<p class="trial-desc">เรียนรู้วิธีการสละชีพมอนสเตอร์ Lv1 บนสนามเพื่ออัญเชิญบอสระดับ Lv3 ที่มีพลังโจมตีมหาศาล</p>' +
          '<div class="trial-objective"><strong>เป้าหมาย:</strong> เสียสละมอนสเตอร์ 2 ตัวเพื่ออัญเชิญ Lv3 ลงสนาม</div>' +
          '<button class="gold btn-trial-start" data-trial="tribute">⚔️ เริ่มการฝึกซ้อม</button>' +
        '</div>' +
        '<div class="trial-card">' +
          '<div class="trial-card-header">' +
            '<span class="trial-badge cyan">บทเรียน 2</span>' +
            '<h3 class="trial-title">⚡ สเปลหมอบ & การตอบโต้ (Chain Window)</h3>' +
          '</div>' +
          '<p class="trial-desc">วางหมอบ Quick-Play สเปลในเทิร์นของคุณ เพื่อเตรียมเปิดใช้งานตอบโต้ฉับพลันเมื่อศัตรูเคลื่อนไหว</p>' +
          '<div class="trial-objective"><strong>เป้าหมาย:</strong> หมอบสเปล และเปิดใช้งานในหน้าต่างตอบโต้</div>' +
          '<button class="gold btn-trial-start" data-trial="chain">⚡ เริ่มการฝึกซ้อม</button>' +
        '</div>' +
        '<div class="trial-card">' +
          '<div class="trial-card-header">' +
            '<span class="trial-badge purple">บทเรียน 3</span>' +
            '<h3 class="trial-title">🌀 ศาสตร์แห่งการฟิวชั่น (Fusion Summon)</h3>' +
          '</div>' +
          '<p class="trial-desc">ใช้งานสเปลฟิวชั่นเพื่อคัดเลือกวัตถุดิบ 2 ตัวจากมือหรือสนาม รวมร่างเป็น Fusion Monster สุดแกร่ง</p>' +
          '<div class="trial-objective"><strong>เป้าหมาย:</strong> รวมร่างวัตถุดิบให้สำเร็จเป็นมอนสเตอร์ฟิวชั่น</div>' +
          '<button class="gold btn-trial-start" data-trial="fusion">🌀 เริ่มการฝึกซ้อม</button>' +
        '</div>' +
      '</div>' +
    '</div>';

    modal.onclick = (e) => {
      if (e.target === modal || e.target.id === 'btnCloseTutModal') {
        modal.remove();
        return;
      }
      const btn = e.target.closest('[data-trial]');
      if (btn) {
        modal.remove();
        startTutorial(btn.dataset.trial);
      }
    };
    root.appendChild(modal);
  }

  function startTutorial(trialId) {
    endSoundPlayed = false;
    cleanupDragVisuals();
    seed = 12345;
    state = E().createGame({
      deckA: 'aquila',
      deckB: 'dinosaur',
      seed,
      mode: 'bot',
      config: { autoChoose: false, chainMode: true, interactiveFusion: true, interactiveChoice: true }
    });

    sel = null; handSel = new Set(); pendingSel = new Set(); evBuf = []; confirmedViewer = null;
    phaseMenuOpen = false;
    CG.ui.inspectCard = null;
    CG.ui.inspectPendingCard = null;
    CG.ui.timers.p0 = 0; CG.ui.timers.p1 = 0; CG.ui.timers.lastTick = Date.now();
    ensureTimer();
    botBusy = false; botBannerText = null; botBannerFade = false; cardHl = {}; ghosts = {};

    state.players[0].flags.mulliganDone = true;
    state.players[1].flags.mulliganDone = true;
    state.phase = 'main1';
    state.activeIdx = 0;
    state.turn = 2;

    const p0 = state.players[0];
    const p1 = state.players[1];

    if (trialId === 'tribute') {
      p0.mana = 4;
      p0.flags.tributeSummonUsed = false;
      p0.flags.normalSummonUsed = false;

      p0.monsters[1] = E().createCardInstance('aq_spear', 0);
      p0.monsters[1].position = 'atk';
      p0.monsters[1].faceDown = false;

      p0.monsters[2] = E().createCardInstance('aq_shield', 0);
      p0.monsters[2].position = 'atk';
      p0.monsters[2].faceDown = false;

      p0.hand = [
        E().createCardInstance('aq_centurion', 0),
        E().createCardInstance('aq_spear', 0)
      ];

      p1.monsters[2] = E().createCardInstance('dino_egg', 1);
      p1.monsters[2].position = 'def';
      p1.monsters[2].faceDown = true;

      state.tutorial = {
        id: 'tribute',
        title: 'การอัญเชิญระดับสูง (Tribute Summon)',
        hint: 'แตะมอนสเตอร์ Lv3 ในมือ เลือก "เสียสละ" เลือกช่อง 2 และ 3 บนสนาม แล้วยืนยันเพื่ออัญเชิญ!'
      };
    } else if (trialId === 'chain') {
      p0.mana = 4;
      p0.hand = [
        E().createCardInstance('aq_sagittarius', 0),
        E().createCardInstance('aq_spear', 0)
      ];
      p0.monsters[2] = E().createCardInstance('aq_spear', 0);
      p0.monsters[2].position = 'atk';
      p0.monsters[2].faceDown = false;

      p1.monsters[2] = E().createCardInstance('dino_stego', 1);
      p1.monsters[2].position = 'atk';
      p1.monsters[2].faceDown = false;

      state.tutorial = {
        id: 'chain',
        title: 'สเปลหมอบ & ตอบโต้ (Set Spell & Chain)',
        hint: 'แตะสเปลในมือ เลือก "หมอบสเปล" เพื่อตั้งรับ! เมื่ออีกฝ่ายเคลื่อนไหว หน้าต่าง Chain จะทำงาน!'
      };
    } else if (trialId === 'fusion') {
      p0.mana = 5;
      p0.extra = [
        E().createCardInstance('dino_tyrano_raptor', 0)
      ];
      p0.hand = [
        E().createCardInstance('dino_fusion', 0),
        E().createCardInstance('dino_trex', 0),
        E().createCardInstance('dino_hunter_raptor', 0)
      ];

      state.tutorial = {
        id: 'fusion',
        title: 'ศาสตร์แห่งการฟิวชั่น (Fusion Summon)',
        hint: 'ใช้สเปลฟิวชั่นเพื่อเปิดหน้าต่างรวมร่าง จากนั้นเลือกมอนสเตอร์วัตถุดิบ 2 ตัวเพื่ออัญเชิญ!'
      };
    }

    $('lobby').classList.add('hidden'); $('game').classList.remove('hidden');
    $('game').onclick = onClick;
    $('game').onmouseover = onHover;
    AudioFX.startBGM();
    render(); schedule();
  }

  // ---------------- ระบบบัญชีผู้เล่น (Account / ID / Login / Register / Starter Deck) ----------------
  const Account = {
    CURRENT_KEY: 'af_current_account',
    ACCOUNTS_KEY: 'af_saved_accounts',
    current: null,

    init() {
      try {
        if (typeof localStorage !== 'undefined') {
          const raw = localStorage.getItem(this.CURRENT_KEY);
          if (raw) {
            this.current = JSON.parse(raw);
          }
        }
      } catch (_) {}

      if (this.current) {
        if (!this.current.level) this.current.level = 1;
        if (!this.current.stats) {
          this.current.stats = { wins: 0, losses: 0, currentStreak: 0, maxStreak: 0, maxDmg: 0, deckUsage: {} };
        }
        CG.ui.curr20 = this.current.curr20 !== undefined ? this.current.curr20 : 100;
        CG.ui.curr100 = this.current.curr100 !== undefined ? this.current.curr100 : 1;
        CG.ui.mailClaimed = !!this.current.mailClaimed;
      }
      return this.current;
    },

    isLoggedIn() {
      return !!(this.current && this.current.id);
    },

    recordMatchResult(st, v) {
      if (!this.current) return;
      if (!this.current.stats) {
        this.current.stats = { wins: 0, losses: 0, currentStreak: 0, maxStreak: 0, maxDmg: 0, deckUsage: {} };
      }
      const s = this.current.stats;
      const isDraw = st.winner === 'draw';
      const isWin = !isDraw && (st.winner === v);

      if (isWin) {
        s.wins = (s.wins || 0) + 1;
        s.currentStreak = (s.currentStreak || 0) + 1;
        if (s.currentStreak > (s.maxStreak || 0)) {
          s.maxStreak = s.currentStreak;
        }
      } else if (!isDraw) {
        s.losses = (s.losses || 0) + 1;
        s.currentStreak = 0;
      }

      // Track max damage dealt by player v
      let matchMaxDmg = 0;
      (st.log || []).forEach(ev => {
        if (ev.type === 'lpChange' && ev.delta < 0 && ev.player !== v) {
          const dmg = Math.abs(ev.delta);
          if (dmg > matchMaxDmg) matchMaxDmg = dmg;
        }
      });
      if (matchMaxDmg > (s.maxDmg || 0)) {
        s.maxDmg = matchMaxDmg;
      }

      // Track deck usage
      if (!s.deckUsage) s.deckUsage = {};
      const playedDeck = deckA || (this.current.unlockedDecks && this.current.unlockedDecks[0]) || 'dinosaur';
      s.deckUsage[playedDeck] = (s.deckUsage[playedDeck] || 0) + 1;

      this.save();
    },

    save() {
      if (!this.current) return;
      this.current.curr20 = (CG.ui.curr20 !== undefined) ? CG.ui.curr20 : this.current.curr20;
      this.current.curr100 = (CG.ui.curr100 !== undefined) ? CG.ui.curr100 : this.current.curr100;
      this.current.mailClaimed = !!CG.ui.mailClaimed;

      try {
        if (typeof localStorage !== 'undefined') {
          const s = localStorage.getItem('cg_owned_cards');
          if (s) this.current.ownedCards = JSON.parse(s);

          localStorage.setItem(this.CURRENT_KEY, JSON.stringify(this.current));

          let all = [];
          const rawAll = localStorage.getItem(this.ACCOUNTS_KEY);
          if (rawAll) all = JSON.parse(rawAll);
          const idx = all.findIndex(a => a.id === this.current.id || (a.email && this.current.email && a.email.toLowerCase() === this.current.email.toLowerCase()));
          if (idx >= 0) all[idx] = this.current;
          else all.push(this.current);
          localStorage.setItem(this.ACCOUNTS_KEY, JSON.stringify(all));
        }
      } catch (_) {}
    },

    setNickname(name) {
      if (!this.current) return;
      this.current.nickname = (name || 'ผู้ท้าชิงนิรนาม').trim().slice(0, 16);
      this.save();
    },

    register(email, password, nickname) {
      email = (email || '').trim();
      password = (password || '').trim();
      nickname = (nickname || '').trim();

      if (!email) return { success: false, message: 'กรุณากรอกอีเมลหรือชื่อบัญชี' };
      if (!password || password.length < 6) return { success: false, message: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษรขึ้นไป' };

      try {
        if (typeof localStorage !== 'undefined') {
          let all = [];
          const rawAll = localStorage.getItem(this.ACCOUNTS_KEY);
          if (rawAll) all = JSON.parse(rawAll);

          const exists = all.some(a => (a.email && a.email.toLowerCase() === email.toLowerCase()) || (a.id && a.id.toUpperCase() === email.toUpperCase()));
          if (exists) {
            return { success: false, message: 'อีเมลหรือชื่อบัญชีนี้มีอยู่ในระบบแล้ว กรุณาเข้าสู่ระบบ' };
          }

          const randomNum = Math.floor(10000 + Math.random() * 90000);
          const id = 'AF-' + randomNum;

          this.current = {
            id,
            email,
            password,
            passcode: password,
            nickname: nickname || ('ผู้ท้าชิง ' + id),
            level: 1, // เริ่มต้น Level 1
            rank: '🥉 Bronze I',
            curr20: 100, // เริ่มต้นแบงก์ 20 จำนวน 100 ใบ
            curr100: 1,  // เริ่มต้นแบงก์ 100 จำนวน 1 ใบ
            starterDeckChosen: null,
            unlockedDecks: [],
            onboarded: false,
            mailClaimed: false,
            ownedCards: [],
            stats: { wins: 0, losses: 0, maxStreak: 0, maxDmg: 0 },
            createdAt: Date.now()
          };

          CG.ui.curr20 = 100;
          CG.ui.curr100 = 1;
          CG.ui.mailClaimed = false;
          try { localStorage.setItem('cg_owned_cards', JSON.stringify([])); } catch (_) {}
          this.save();
          return { success: true, account: this.current };
        }
      } catch (err) {
        return { success: false, message: err.message };
      }
      return { success: false, message: 'ไม่สามารถสร้างบัญชีได้' };
    },

    login(emailOrId, password) {
      emailOrId = (emailOrId || '').trim();
      password = (password || '').trim();

      if (!emailOrId) return { success: false, message: 'กรุณากรอกอีเมลหรือ Account ID' };
      if (!password || password.length < 6) return { success: false, message: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษรขึ้นไป' };

      try {
        if (typeof localStorage !== 'undefined') {
          let all = [];
          const rawAll = localStorage.getItem(this.ACCOUNTS_KEY);
          if (rawAll) all = JSON.parse(rawAll);

          const query = emailOrId.toLowerCase();
          let found = all.find(a => (a.email && a.email.toLowerCase() === query) || (a.id && a.id.toLowerCase() === query));

          if (!found) {
            return { success: false, message: 'ไม่พบบัญชีนี้ในระบบ กรุณากด "สร้างไอดีใหม่"' };
          }

          const accPass = found.password || found.passcode;
          if (accPass && accPass !== password) {
            return { success: false, message: 'รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง' };
          }

          this.current = found;
          CG.ui.curr20 = this.current.curr20 !== undefined ? this.current.curr20 : 100;
          CG.ui.curr100 = this.current.curr100 !== undefined ? this.current.curr100 : 1;
          CG.ui.mailClaimed = !!this.current.mailClaimed;

          if (this.current.ownedCards && this.current.ownedCards.length) {
            try { localStorage.setItem('cg_owned_cards', JSON.stringify(this.current.ownedCards)); } catch (_) {}
          }
          this.save();
          return { success: true, account: this.current };
        }
      } catch (err) {
        return { success: false, message: err.message };
      }
      return { success: false, message: 'ไม่สามารถเข้าสู่ระบบได้' };
    },

    createGuest() {
      const randomNum = Math.floor(10000 + Math.random() * 90000);
      const id = 'AF-' + randomNum;
      const pass = 'guest' + randomNum;
      return this.register('guest_' + randomNum + '@arcana.game', pass, 'ผู้ท้าชิง ' + id);
    },

    chooseStarterDeck(deckKey) {
      if (!this.current) return;
      this.current.starterDeckChosen = deckKey;
      this.current.unlockedDecks = [deckKey];
      this.current.onboarded = true;

      const d = CG.cards && CG.cards[deckKey];
      const owned = new Set();
      if (d) {
        (d.main || []).forEach(c => owned.add(c.id));
        (d.extra || []).forEach(c => owned.add(c.id));
      }
      this.current.ownedCards = Array.from(owned);
      try {
        localStorage.setItem('cg_owned_cards', JSON.stringify(this.current.ownedCards));
      } catch (_) {}
      this.save();
    },

    logout() {
      this.current = null;
      try {
        localStorage.removeItem(this.CURRENT_KEY);
      } catch (_) {}
      showAuthScreen();
    },

    importBackup(jsonStr) {
      try {
        const data = JSON.parse(jsonStr);
        if (!data.id) return { success: false, message: 'ไม่พบ Account ID ในข้อมูลสำรอง' };
        this.current = data;
        CG.ui.curr20 = data.curr20 !== undefined ? data.curr20 : 100;
        CG.ui.curr100 = data.curr100 !== undefined ? data.curr100 : 1;
        CG.ui.mailClaimed = !!data.mailClaimed;
        if (data.ownedCards) {
          try { localStorage.setItem('cg_owned_cards', JSON.stringify(data.ownedCards)); } catch (_) {}
        }
        this.save();
        return { success: true, account: data };
      } catch (e) {
        return { success: false, message: 'JSON ไม่ถูกต้อง: ' + e.message };
      }
    }
  };
  CG.account = Account;

  // ---------------- ระบบ Modal กลาง (Modal Helper) ----------------
  function showWfModal(title, contentHtml, extraCls, options = {}) {
    const root = $('overlayRoot') || (typeof document !== 'undefined' ? document.body : null);
    if (!root || typeof document.createElement !== 'function') return null;
    const modalEl = document.createElement('div');
    modalEl.className = 'wf-modal-overlay' + (extraCls ? (' ' + extraCls) : '');
    const hideClose = (options && options.hideClose) || false;
    const headerHtml = title ? (
      '<div class="wf-modal-header">' +
        '<div class="wf-modal-title">' + V().esc(title) + '</div>' +
        (!hideClose ? '<button class="wf-modal-close" id="btnModalClose">✕</button>' : '') +
      '</div>'
    ) : '';
    modalEl.innerHTML = 
      '<div class="wf-modal-box">' +
        headerHtml +
        '<div class="wf-modal-content">' + contentHtml + '</div>' +
      '</div>';
    root.appendChild(modalEl);
    return modalEl;
  }

  // ---------------- หน้าเข้าสู่ระบบครั้งแรก (Auth Screen) ----------------
  function showAuthScreen() {
    if (typeof document === 'undefined') return;
    const authEl = $('authScreen');
    if (!authEl) return;

    if ($('lobby')) $('lobby').classList.add('hidden');
    if ($('game')) $('game').classList.add('hidden');
    authEl.classList.remove('hidden');

    authEl.innerHTML = 
      '<div class="auth-box">' +
        '<div class="auth-title-badge">⚔️ ARCANA FRONTIER ⚔️</div>' +
        '<div class="auth-subtitle">การ์ดเกมต่อสู้ข้ามมิติ • Online Card Battle</div>' +
        '<div class="auth-tabs">' +
          '<button id="tabAuthLogin" class="auth-tab-btn active">🔐 เข้าสู่ระบบ (Login)</button>' +
          '<button id="tabAuthRegister" class="auth-tab-btn">✨ สร้างไอดีใหม่ (Register)</button>' +
        '</div>' +

        // FORM LOGIN
        '<div id="formAuthLogin">' +
          '<div class="auth-field-group">' +
            '<label class="auth-field-label">อีเมล หรือ Account ID:</label>' +
            '<input type="text" id="inpAuthLoginEmail" class="auth-input" placeholder="เช่น player@gmail.com หรือ AF-12345" />' +
          '</div>' +
          '<div class="auth-field-group">' +
            '<label class="auth-field-label">รหัสผ่าน (6 ตัวอักษรขึ้นไป):</label>' +
            '<input type="password" id="inpAuthLoginPass" class="auth-input" placeholder="รหัสผ่านของคุณ" />' +
          '</div>' +
          '<button id="btnDoAuthLogin" class="auth-submit-btn">🔓 เข้าสู่ระบบ (Login)</button>' +
          '<div style="margin:14px 0 4px;font-size:0.75rem;color:#94a3b8">หรือทดลองเล่นทันที</div>' +
          '<button id="btnDoAuthGuest" class="auth-guest-btn">👤 เข้าเล่นแบบ Guest ทันที</button>' +
        '</div>' +

        // FORM REGISTER
        '<div id="formAuthRegister" style="display:none">' +
          '<div class="auth-field-group">' +
            '<label class="auth-field-label">ชื่อผู้เล่น (Nickname):</label>' +
            '<input type="text" id="inpAuthRegNick" class="auth-input" maxlength="14" placeholder="เช่น จอมเวทโอเมก้า" />' +
          '</div>' +
          '<div class="auth-field-group">' +
            '<label class="auth-field-label">อีเมลของคุณ:</label>' +
            '<input type="email" id="inpAuthRegEmail" class="auth-input" placeholder="เช่น player@gmail.com" />' +
          '</div>' +
          '<div class="auth-field-group">' +
            '<label class="auth-field-label">ตั้งรหัสผ่าน (อย่างน้อย 6 ตัวอักษร):</label>' +
            '<input type="password" id="inpAuthRegPass" class="auth-input" placeholder="รหัสผ่าน 6 ตัวขึ้นไป" />' +
          '</div>' +
          '<div class="auth-field-group">' +
            '<label class="auth-field-label">ยืนยันรหัสผ่านอีกครั้ง:</label>' +
            '<input type="password" id="inpAuthRegPass2" class="auth-input" placeholder="กรอกรหัสผ่านซ้ำอีกครั้ง" />' +
          '</div>' +
          '<button id="btnDoAuthRegister" class="auth-submit-btn">✨ สร้างบัญชีใหม่และเริ่มเล่น (Register)</button>' +
        '</div>' +
      '</div>';

    authEl.onclick = (e) => {
      if (e.target.closest('#tabAuthLogin')) {
        authEl.querySelector('#formAuthLogin').style.display = 'block';
        authEl.querySelector('#formAuthRegister').style.display = 'none';
        authEl.querySelector('#tabAuthLogin').classList.add('active');
        authEl.querySelector('#tabAuthRegister').classList.remove('active');
        AudioFX.play('click');
        return;
      }
      if (e.target.closest('#tabAuthRegister')) {
        authEl.querySelector('#formAuthLogin').style.display = 'none';
        authEl.querySelector('#formAuthRegister').style.display = 'block';
        authEl.querySelector('#tabAuthLogin').classList.remove('active');
        authEl.querySelector('#tabAuthRegister').classList.add('active');
        AudioFX.play('click');
        return;
      }
      if (e.target.closest('#btnDoAuthLogin')) {
        const email = (authEl.querySelector('#inpAuthLoginEmail').value || '').trim();
        const pass = (authEl.querySelector('#inpAuthLoginPass').value || '').trim();
        const res = Account.login(email, pass);
        if (res.success) {
          toast('✅ เข้าสู่ระบบสำเร็จ! ยินดีต้อนรับ ' + res.account.nickname);
          AudioFX.play('chime');
          authEl.classList.add('hidden');
          if (!res.account.onboarded) {
            showOnboardingModal();
          } else {
            lobby();
          }
        } else {
          toast('⚠ ' + res.message);
          AudioFX.play('cancel');
        }
        return;
      }
      if (e.target.closest('#btnDoAuthRegister')) {
        const nick = (authEl.querySelector('#inpAuthRegNick').value || '').trim();
        const email = (authEl.querySelector('#inpAuthRegEmail').value || '').trim();
        const pass = (authEl.querySelector('#inpAuthRegPass').value || '').trim();
        const pass2 = (authEl.querySelector('#inpAuthRegPass2').value || '').trim();

        if (!email) return toast('⚠ กรุณากรอกอีเมล');
        if (!pass || pass.length < 6) return toast('⚠ รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษรขึ้นไป');
        if (pass !== pass2) return toast('⚠ รหัสผ่านทั้งสองช่องไม่ตรงกัน');

        const res = Account.register(email, pass, nick);
        if (res.success) {
          toast('🎉 สร้างบัญชีใหม่สำเร็จ! ยินดีต้อนรับ ' + res.account.nickname);
          AudioFX.play('chime');
          authEl.classList.add('hidden');
          showOnboardingModal();
        } else {
          toast('⚠ ' + res.message);
          AudioFX.play('cancel');
        }
        return;
      }
      if (e.target.closest('#btnDoAuthGuest')) {
        const res = Account.createGuest();
        if (res.success) {
          toast('👤 สร้างไอดี Guest สำเร็จ! รหัสประจำตัว: ' + res.account.id);
          AudioFX.play('chime');
          authEl.classList.add('hidden');
          showOnboardingModal();
        }
        return;
      }
    };
  }

  // ---------------- ลำดับการต้อนรับ: สอนเล่น & เลือกเด็คเริ่มต้น ----------------
  function showOnboardingModal() {
    if (typeof document === 'undefined') return;
    try {
      // STEP 1: คำถามถามว่าจะเล่นโหมดสอนเล่นหรือไม่?
      const step1Html = 
        '<div style="text-align:center;padding:10px">' +
          '<div style="font-size:3rem;margin-bottom:8px">🎓</div>' +
          '<h3 style="margin:0 0 8px;font-size:1.35rem;font-weight:900;color:#1e293b">ยินดีต้อนรับสู่อาร์คานา ฟรอนเทียร์!</h3>' +
          '<p style="font-size:0.95rem;color:#475569;line-height:1.5;margin-bottom:20px">' +
            'คุณต้องการเข้าร่วม <strong>โหมดสอนเล่น (Tutorial)</strong> เพื่อเรียนรู้กติกาการดวลการ์ดก่อนหรือไม่?' +
          '</p>' +
          '<div style="display:flex;flex-direction:column;gap:10px">' +
            '<button id="btnChooseTutorial" class="gold" style="padding:12px;font-size:1rem;font-weight:900;border:2.5px solid #2b1f1d">' +
              '🎓 เข้าร่วมโหมดฝึกสอน (Tutorial)' +
            '</button>' +
            '<button id="btnSkipTutorial" style="background:#f1f5f9;border:2px solid #2b1f1d;padding:12px;font-size:1rem;font-weight:900;border-radius:8px;cursor:pointer">' +
              '⚔️ เล่นเกมเลย (ไม่ต้องสอน / ข้ามการฝึกสอน)' +
            '</button>' +
          '</div>' +
        '</div>';

      const modalEl = showWfModal('🎮 ยินดีต้อนรับนักดวลการ์ดหน้าใหม่', step1Html, '', { hideClose: true });
      if (!modalEl) {
        showStarterDeckSelectionModal();
        return;
      }

      modalEl.onclick = (e) => {
        if (e.target.closest('#btnChooseTutorial')) {
          toast('🚧 โหมดฝึกสอนกำลังพัฒนา (เร็วๆ นี้!) กำลังนำคุณไปเลือกเด็คเริ่มต้น...');
          AudioFX.play('click');
          modalEl.remove();
          showStarterDeckSelectionModal();
          return;
        }
        if (e.target.closest('#btnSkipTutorial')) {
          toast('⚔️ ยอดเยี่ยม! ไปเลือกเด็คเริ่มต้นของคุณกันเลย');
          AudioFX.play('click');
          modalEl.remove();
          showStarterDeckSelectionModal();
          return;
        }
      };
    } catch (err) {
      console.error('showOnboardingModal error:', err);
      showStarterDeckSelectionModal();
    }
  }

  function showStarterDeckSelectionModal() {
    try {
      let selectedDeck = 'dinosaur';

    const starterOptions = [
      {
        key: 'dinosaur',
        name: '🦖 ไดโนเสาร์จอมพลัง (Dinosaur)',
        icon: '🦖',
        desc: 'เน้นพลังโจมตีสูง บุกทำลายคู่แข่ง อัญเชิญราชันย์ไทแรนโนซอรัส',
        ace: 'ไทแรนโนซอรัส จอมราชันย์ (ATK 2800)'
      },
      {
        key: 'aquila',
        name: '🦅 กองทัพโรมันอควิลา (Roman Aquila)',
        icon: '🦅',
        desc: 'รวมพลกองทัพกล้า สเปลสนับสนุนยุทธวิธี เคลื่อนทัพรวดเร็วทรงพลัง',
        ace: 'จักรพรรดิออเรเลียน (ATK 2600)'
      },
      {
        key: 'mecha_strike',
        name: '🤖 เมก้าสไตรก์ (Mecha Strike)',
        icon: '🤖',
        desc: 'หุ่นยนต์ประกอบร่าง 5 แกนหลัก รวมร่างจุติ Apex คอสมิก โอเมก้า',
        ace: 'คอสมิก โอเมก้า (ATK 2700)'
      }
    ];

    const cardsHtml = starterOptions.map(opt => `
      <div class="starter-deck-card ${opt.key === selectedDeck ? 'selected' : ''}" data-starter="${opt.key}">
        <div class="starter-deck-badge">${opt.key === selectedDeck ? '✓ เลือกแล้ว' : 'แตะเพื่อเลือก'}</div>
        <div style="font-size:2.2rem;margin-bottom:4px">${opt.icon}</div>
        <div style="font-weight:900;font-size:1.05rem;color:#1e293b;margin-bottom:4px">${V().esc(opt.name)}</div>
        <div style="font-size:0.8rem;color:#475569;line-height:1.4;margin-bottom:8px">${V().esc(opt.desc)}</div>
        <div style="font-size:0.75rem;font-weight:800;color:#b45309;background:#fef3c7;padding:3px 6px;border-radius:4px">👑 เอซ: ${V().esc(opt.ace)}</div>
      </div>
    `).join('');

    const html = 
      '<div style="text-align:center;margin-bottom:8px">' +
        '<h3 style="margin:0 0 4px;font-size:1.25rem;font-weight:900;color:#1e293b">🃏 เลือกเด็คเริ่มต้นของคุณ (เลือกได้ 1 เด็คเท่านั้น)</h3>' +
        '<div style="font-size:0.85rem;color:#64748b;line-height:1.4">' +
          'ทุกคนจะเริ่มต้นด้วย <strong>Level 1</strong>, ได้รับ <strong>100 แบงก์ 20</strong>, <strong>1 แบงก์ 100</strong> และใช้ได้เฉพาะเด็คนี้ก่อน<br>' +
          'ส่วนเด็คอื่นๆ สามารถสะสมและปลดล็อกได้จากภารกิจหรือการสุ่มซองการ์ดในภายหลัง' +
        '</div>' +
      '</div>' +
      '<div class="starter-deck-grid" id="starterDeckGrid">' +
        cardsHtml +
      '</div>' +
      '<button id="btnConfirmStarterDeck" class="gold" style="width:100%;padding:12px;font-weight:900;font-size:1.05rem;border:2.5px solid #2b1f1d">' +
        '✓ ยืนยันเลือกเด็คนี้และเข้าสู่เกม' +
      '</button>';

    const modalEl = showWfModal('🎁 เลือกเด็คเริ่มต้นของคุณ', html, '', { hideClose: true });
    if (!modalEl) {
      Account.chooseStarterDeck(selectedDeck);
      lobby();
      return;
    }

    modalEl.onclick = (e) => {
      const card = e.target.closest('[data-starter]');
      if (card) {
        selectedDeck = card.dataset.starter;
        modalEl.querySelectorAll('.starter-deck-card').forEach(el => {
          const isSel = el.dataset.starter === selectedDeck;
          el.classList.toggle('selected', isSel);
          const badge = el.querySelector('.starter-deck-badge');
          if (badge) badge.textContent = isSel ? '✓ เลือกแล้ว' : 'แตะเพื่อเลือก';
        });
        AudioFX.play('click');
        return;
      }
      if (e.target.closest('#btnConfirmStarterDeck')) {
        Account.chooseStarterDeck(selectedDeck);
        toast('🎉 ยินดีด้วย! คุณได้รับเด็คเริ่มต้นเรียบร้อยแล้ว ยินดีต้อนรับสู่ Arcana Frontier!');
        AudioFX.play('chime');
        modalEl.remove();
        lobby();
        return;
      }
    };
    } catch (err) {
      console.error('showStarterDeckSelectionModal error:', err);
      if (Account.current && !Account.current.onboarded) {
        Account.chooseStarterDeck('dinosaur');
      }
      lobby();
    }
  }

  function boot() {
    Account.init();
    if (!Account.isLoggedIn()) {
      showAuthScreen();
    } else if (!Account.current.onboarded) {
      showOnboardingModal();
    } else {
      lobby();
    }
  }
  CG.account = Account;

  // ---------------- ล็อบบี้ ----------------
  function lobby() {
    Account.init();
    if (!Account.isLoggedIn()) {
      showAuthScreen();
      return;
    }
    if (!Account.current.onboarded) {
      showOnboardingModal();
      return;
    }

    if (mode === 'online' && CG.network) {
      if (state && !state.ended) {
        CG.network.surrender();
      }
      CG.network.disconnect();
    }
    mode = 'bot';
    AudioFX.stopBGM();
    endSoundPlayed = false;
    cleanupDragVisuals();
    clearTimeout(timer); state = null;
    phaseMenuOpen = false;
    CG.ui.inspectCard = null;
    CG.ui.inspectPendingCard = null;
    CG.ui.timers.p0 = 0; CG.ui.timers.p1 = 0; CG.ui.timers.lastTick = null;
    botBusy = false; botBannerText = null; botBannerFade = false; cardHl = {}; ghosts = {};
    if ($('authScreen')) $('authScreen').classList.add('hidden');
    $('game').classList.add('hidden'); $('lobby').classList.remove('hidden'); $('overlayRoot').innerHTML = '';
    if (CG.deckBuilder && CG.deckBuilder.syncToCGCards) CG.deckBuilder.syncToCGCards();
    const keys = Object.keys(CG.cards || {}); const a = S().app;
    const unlocked = (Account.current && Account.current.unlockedDecks && Account.current.unlockedDecks.length) ? Account.current.unlockedDecks : [keys[0]];
    if (!deckA || !unlocked.includes(deckA)) deckA = unlocked[0];
    if (!deckB || !CG.cards[deckB]) deckB = keys.find(k => k !== deckA) || keys[0];

    const curA = CG.cards[deckA] || {};
    const aceA = getDeckAceDef(deckA);
    const aceHtmlA = aceA
      ? V().cardHtml(Object.assign({ cardId: aceA.id }, aceA), { reveal: true, field: false })
      : '<div class="card back"></div>';
    const mainCountA = (curA.main || []).reduce((x, c) => x + (c.count || 1), 0);
    const extraCountA = (curA.extra || []).reduce((x, c) => x + (c.count || 1), 0);

    const curB = CG.cards[deckB] || {};
    const aceB = getDeckAceDef(deckB);
    const aceHtmlB = aceB
      ? V().cardHtml(Object.assign({ cardId: aceB.id }, aceB), { reveal: true, field: false })
      : '<div class="card back"></div>';
    const mainCountB = (curB.main || []).reduce((x, c) => x + (c.count || 1), 0);
    const extraCountB = (curB.extra || []).reduce((x, c) => x + (c.count || 1), 0);

    const renderDeckPicker = (who, cur) => keys.map(k => {
      const d = CG.cards[k], n = d.main.reduce((x, c) => x + (c.count || 1), 0);
      const isCur = (cur === k);
      const tag = d.isCustom ? '🛠️ ' : '👑 ';
      return '<button class="deck-option-btn ' + (isCur ? 'active' : '') + '" data-deck="' + who + ':' + k + '">' +
        '<div class="opt-name">' + tag + V().esc(d.name) + '</div>' +
        '<div class="opt-sub">Main ' + n + ' · Extra ' + (d.extra ? d.extra.length : 0) + '</div>' +
      '</button>';
    }).join('');

    // Currencies and Banknote Helpers
    CG.ui.note20Html = function(extraCls) {
      return '<span class="note-bill note-bill-20' + (extraCls ? ' ' + extraCls : '') + '" title="แบงก์ 20">' +
        '<svg class="note-svg" viewBox="0 0 42 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
          '<rect x="1" y="1" width="40" height="22" rx="3" fill="#15803d" stroke="#14532d" stroke-width="1.5"/>' +
          '<rect x="3.5" y="3.5" width="35" height="17" rx="2" stroke="#86efac" stroke-width="0.8" stroke-dasharray="2 1.5"/>' +
          '<circle cx="21" cy="12" r="6" fill="#166534"/>' +
          '<text x="21" y="15" font-family="sans-serif" font-weight="900" font-size="8.5" fill="#f0fdf4" text-anchor="middle">20</text>' +
          '<text x="6" y="8" font-family="sans-serif" font-weight="800" font-size="4.5" fill="#bbf7d0">฿</text>' +
          '<text x="36" y="20" font-family="sans-serif" font-weight="800" font-size="4.5" fill="#bbf7d0">฿</text>' +
        '</svg>' +
      '</span>';
    };

    CG.ui.note100Html = function(extraCls) {
      return '<span class="note-bill note-bill-100' + (extraCls ? ' ' + extraCls : '') + '" title="แบงก์ 100">' +
        '<svg class="note-svg" viewBox="0 0 42 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
          '<rect x="1" y="1" width="40" height="22" rx="3" fill="#b91c1c" stroke="#7f1d1d" stroke-width="1.5"/>' +
          '<rect x="3.5" y="3.5" width="35" height="17" rx="2" stroke="#fca5a5" stroke-width="0.8" stroke-dasharray="2 1.5"/>' +
          '<circle cx="21" cy="12" r="6" fill="#991b1b"/>' +
          '<text x="21" y="15" font-family="sans-serif" font-weight="900" font-size="7.5" fill="#fef2f2" text-anchor="middle">100</text>' +
          '<text x="6" y="8" font-family="sans-serif" font-weight="800" font-size="4.5" fill="#fecaca">฿</text>' +
          '<text x="36" y="20" font-family="sans-serif" font-weight="800" font-size="4.5" fill="#fecaca">฿</text>' +
        '</svg>' +
      '</span>';
    };

    let curr20 = CG.ui.curr20 !== undefined ? CG.ui.curr20 : 340;
    let curr100 = CG.ui.curr100 !== undefined ? CG.ui.curr100 : 5;
    CG.ui.curr20 = curr20; CG.ui.curr100 = curr100;

    const newsItems = [
      {
        tag: "🔥 เปิดตัวเด็คใหม่",
        title: "เมก้าสไตรก์ (MECHA STRIKE) จุติแล้ว!",
        desc: "สัมผัสพลังหุ่นยนต์ประกอบร่าง 5 แกนหลัก และบอส Apex คอสมิก โอเมก้า พร้อมให้ทดสอบแล้ววันนี้",
        icon: "🤖",
        image: "assets/promo/mecha_strike_promo.jpg"
      },
      {
        tag: "🏆 กิจกรรมซีซัน",
        title: "Arcana Frontier Ranked Season 1",
        desc: "ดวลสะสมแต้มชัยชนะไต่ระดับแรงก์ รับรางวัล แบงก์ 100 และฉายาผู้พิทักษ์ตำนาน",
        icon: "👑"
      },
      {
        tag: "🎯 เควสทดสอบ",
        title: "บททดสอบผู้กล้า (Hero's Trials)",
        desc: "เคลียร์พัซเซิลดวลการ์ดเทิร์นเดียวจบ รับรางวัลเงินและเพชรฟรีเพื่อสะสมการ์ด",
        icon: "🎯"
      },
      {
        tag: "📜 เควสภารกิจ",
        title: "ภารกิจท้าทายประจำวัน & อัปเดต",
        desc: "ทำภารกิจดวลการ์ด อัญเชิญมอนสเตอร์ และเปิดซองการ์ดเพื่อปลดล็อกรางวัลพิเศษ",
        icon: "📜"
      },
      {
        tag: "💡 เคล็ดลับมือโปร",
        title: "จังหวะตอบโต้ Chain & Counter Trap",
        desc: "ชิงความได้เปรียบด้วยเวทสวนกลับในเทิร์นศัตรู พลิกกระดานสู่ชัยชนะในเสี้ยววินาที",
        icon: "⚡"
      },
      {
        tag: "🎁 แจกรางวัล",
        title: "โบนัสนักดวลหน้าใหม่ รับฟรี แบงก์ 20",
        desc: "นำไปเปิดซองการ์ดกาชาไดโนเสาร์ โรมัน หรือเมก้าสไตรก์ได้ทันทีที่ร้านค้า",
        icon: "🎉"
      }
    ];

    let newsIdx = 0;
    if (CG.ui.newsTimer) clearInterval(CG.ui.newsTimer);
    if (typeof setInterval === 'function') {
      CG.ui.newsTimer = setInterval(() => {
        newsIdx = (newsIdx + 1) % newsItems.length;
        updateNewsUI();
      }, 10000);
    }

    function updateNewsUI() {
      const item = newsItems[newsIdx];
      const elTag = $('wfNewsTag'), elHead = $('wfNewsHeadline'), elDesc = $('wfNewsDesc');
      if (elTag) elTag.textContent = item.tag;
      if (elHead) elHead.textContent = item.title;
      if (elDesc) elDesc.textContent = item.desc;
      if (typeof document.querySelectorAll === 'function') {
        const dots = document.querySelectorAll('.wf-news-dot');
        dots.forEach((d, i) => d.classList.toggle('active', i === newsIdx));
      }
      const img = $('wfNewsImg');
      if (img) {
        img.src = item.image || 'assets/promo/mecha_strike_promo.jpg';
      }
    }

    function openProfileModal(initialTab = 'info') {
      const acc = Account.current || {};
      const isLogin = (initialTab === 'login');

      const stats = acc.stats || { wins: 0, losses: 0, currentStreak: 0, maxStreak: 0, maxDmg: 0, deckUsage: {} };
      const wins = stats.wins || 0;
      const losses = stats.losses || 0;
      const totalGames = wins + losses;
      const winRate = totalGames > 0 ? ((wins / totalGames) * 100).toFixed(1) + '%' : '0.0%';
      const maxDmg = (stats.maxDmg || 0).toLocaleString();
      const maxStreak = stats.maxStreak || 0;

      const deckUsageEntries = Object.entries(stats.deckUsage || {}).sort((a, b) => b[1] - a[1]);
      let deckUsageHtml = '';
      if (deckUsageEntries.length === 0 || totalGames === 0) {
        deckUsageHtml = '<div style="font-size:0.8rem;color:#94a3b8;font-style:italic">ยังไม่มีประวัติการต่อสู้ (0 นัด)</div>';
      } else {
        deckUsageHtml = deckUsageEntries.map(([dk, count]) => {
          const pct = Math.round((count / totalGames) * 100);
          const deckInfo = CG.cards && CG.cards[dk];
          const deckName = deckInfo ? deckInfo.name : dk;
          const icon = dk === 'dinosaur' ? '🦖 ' : (dk === 'aquila' ? '🦅 ' : (dk === 'mecha_strike' ? '🤖 ' : '🎴 '));
          return '<div style="font-size:0.8rem;margin-bottom:2px;display:flex;justify-content:space-between"><span>' + icon + V().esc(deckName) + '</span><span style="font-weight:700">' + pct + '% (' + count + ' นัด)</span></div>';
        }).join('');
      }

      const html = 
        '<div style="display:flex;gap:8px;margin-bottom:14px;border-bottom:2px solid #2b1f1d;padding-bottom:8px">' +
          '<button id="tabProfileInfo" class="profile-tab-btn" style="flex:1;padding:8px 12px;border:2px solid #2b1f1d;border-radius:8px;font-weight:900;font-size:0.88rem;cursor:pointer;background:' + (isLogin ? '#e2e8f0' : '#fef08a') + ';box-shadow:1.5px 2px 0 #2b1f1d">👤 ข้อมูลผู้เล่น & สถิติ</button>' +
          '<button id="tabProfileLogin" class="profile-tab-btn" style="flex:1;padding:8px 12px;border:2px solid #2b1f1d;border-radius:8px;font-weight:900;font-size:0.88rem;cursor:pointer;background:' + (isLogin ? '#fef08a' : '#e2e8f0') + ';box-shadow:1.5px 2px 0 #2b1f1d">🔐 เข้าสู่ระบบ / กู้คืนไอดี</button>' +
        '</div>' +

        // SECTION 1: PROFILE INFO & STATS
        '<div id="secProfileInfo" style="' + (isLogin ? 'display:none' : 'display:block') + '">' +
          '<div style="text-align:center;margin-bottom:14px">' +
            '<div style="width:68px;height:68px;border-radius:50%;background:#fef08a;border:3px solid #2b1f1d;display:flex;align-items:center;justify-content:center;font-size:2rem;margin:0 auto 6px">👤</div>' +
            '<div style="display:flex;align-items:center;justify-content:center;gap:6px">' +
              '<h3 id="txtProfileNickname" style="margin:0;font-size:1.3rem;font-weight:900">' + V().esc(acc.nickname || 'ผู้ท้าชิงนิรนาม') + '</h3>' +
              '<button id="btnEditNickname" title="แก้ไขชื่อผู้เล่น" style="background:#f1f5f9;border:1.5px solid #2b1f1d;border-radius:4px;padding:2px 6px;cursor:pointer;font-size:0.8rem">✏️</button>' +
            '</div>' +
            '<div id="boxEditNickname" style="display:none;margin-top:8px">' +
              '<div style="display:flex;gap:6px;max-width:260px;margin:0 auto">' +
                '<input type="text" id="inpNewNickname" maxlength="14" value="' + V().esc(acc.nickname || 'ผู้ท้าชิงนิรนาม') + '" style="flex:1;padding:4px 8px;border:2px solid #2b1f1d;border-radius:6px;font-weight:700;font-size:0.85rem" />' +
                '<button id="btnSaveNickname" class="gold" style="padding:4px 10px;font-size:0.85rem">บันทึก</button>' +
              '</div>' +
            '</div>' +
            '<div style="color:#64748b;font-size:0.82rem;margin-top:2px">Level ' + (acc.level || 1) + ' • ' + V().esc(acc.rank || '🥉 Bronze I') + '</div>' +
          '</div>' +

          // ID and Passcode Cards
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">' +
            '<div style="background:#fff;border:2px solid #2b1f1d;border-radius:8px;padding:10px;box-shadow:1.5px 2px 0 #2b1f1d">' +
              '<div style="font-size:0.72rem;color:#64748b;font-weight:800">ID ประจำตัว:</div>' +
              '<div style="font-size:1.1rem;font-weight:900;color:#1e293b;letter-spacing:1px;margin:2px 0 6px">' + V().esc(acc.id || 'AF-00000') + '</div>' +
              '<button id="btnCopyProfileId" style="width:100%;background:#fef08a;border:1.5px solid #2b1f1d;padding:4px;border-radius:5px;font-weight:900;font-size:0.75rem;cursor:pointer">📋 คัดลอก ID</button>' +
            '</div>' +
            '<div style="background:#fff;border:2px solid #2b1f1d;border-radius:8px;padding:10px;box-shadow:1.5px 2px 0 #2b1f1d">' +
              '<div style="font-size:0.72rem;color:#64748b;font-weight:800">PIN กู้คืนบัญชี:</div>' +
              '<div id="txtProfilePin" style="font-size:1.1rem;font-weight:900;color:#1e293b;letter-spacing:2px;margin:2px 0 6px">••••••</div>' +
              '<div style="display:flex;gap:4px">' +
                '<button id="btnToggleProfilePin" style="flex:1;background:#f1f5f9;border:1.5px solid #2b1f1d;padding:4px;border-radius:5px;font-weight:800;font-size:0.75rem;cursor:pointer">👁️ ดู</button>' +
                '<button id="btnCopyProfilePin" style="flex:1;background:#fef08a;border:1.5px solid #2b1f1d;padding:4px;border-radius:5px;font-weight:900;font-size:0.75rem;cursor:pointer">📋 ก็อป</button>' +
              '</div>' +
            '</div>' +
          '</div>' +

          '<div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:8px;padding:8px 12px;font-size:0.78rem;color:#166534;margin-bottom:12px;line-height:1.4">' +
            '💡 <strong>เคล็ดลับสำคัญ:</strong> บันทึก <strong>ID (' + V().esc(acc.id || '') + ')</strong> และ <strong>PIN</strong> นี้ไว้ เมื่อเปลี่ยนอุปกรณ์หรือเปิดเว็บใหม่ สามารถนำมากรอกในแท็บ <strong>"เข้าสู่ระบบ"</strong> เพื่อเล่นไอดีเดิม ข้อมูลเหรียญและการ์ดจะกลับมาครบถ้วน!' +
          '</div>' +

          // Stats row
          '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center;margin-bottom:12px">' +
            '<div style="padding:8px;background:#fff;border:2px solid #2b1f1d;border-radius:8px"><div style="font-size:0.72rem;color:#64748b">อัตราชนะ</div><div style="font-size:1.15rem;font-weight:900;color:#15803d">' + winRate + '</div><div style="font-size:0.68rem;color:#94a3b8">' + wins + 'W / ' + losses + 'L</div></div>' +
            '<div style="padding:8px;background:#fff;border:2px solid #2b1f1d;border-radius:8px"><div style="font-size:0.72rem;color:#64748b">ดาเมจสูงสุด</div><div style="font-size:1.15rem;font-weight:900;color:#b91c1c">' + maxDmg + '</div><div style="font-size:0.68rem;color:#94a3b8">FP ใน 1 ตา</div></div>' +
            '<div style="padding:8px;background:#fff;border:2px solid #2b1f1d;border-radius:8px"><div style="font-size:0.72rem;color:#64748b">ชนะต่อเนื่อง</div><div style="font-size:1.15rem;font-weight:900;color:#d97706">' + maxStreak + ' WIN</div><div style="font-size:0.68rem;color:#94a3b8">สตรีคสูงสุด</div></div>' +
          '</div>' +
          '<div style="border-top:2px solid #e2e8f0;padding-top:10px;margin-bottom:10px">' +
            '<div style="font-weight:800;font-size:0.85rem;margin-bottom:4px">เด็คที่ใช้งานบ่อยที่สุด:</div>' +
            deckUsageHtml +
          '</div>' +
          '<button id="btnProfileLogout" style="width:100%;margin-top:8px;background:#fee2e2;border:2px solid #b91c1c;color:#b91c1c;padding:10px;border-radius:8px;font-weight:900;font-size:0.9rem;cursor:pointer">🚪 ออกจากระบบ (Logout)</button>' +
        '</div>' +

        // SECTION 2: LOGIN & RESTORE ACCOUNT
        '<div id="secProfileLogin" style="' + (isLogin ? 'display:block' : 'display:none') + '">' +
          '<div style="background:#fff;border:2.5px solid #2b1f1d;border-radius:10px;padding:14px;margin-bottom:14px;box-shadow:2px 3px 0 #2b1f1d">' +
            '<div style="font-weight:900;font-size:1.05rem;color:#1e293b;margin-bottom:4px">🔐 เข้าสู่ระบบด้วยไอดีเดิม (Restore Account)</div>' +
            '<div style="font-size:0.78rem;color:#64748b;margin-bottom:10px">กรอก Account ID และ PIN 6 หลักที่คุณบันทึกไว้ เพื่อดึงข้อมูลเดิมกลับมา:</div>' +
            '<div style="margin-bottom:8px">' +
              '<label style="display:block;font-size:0.75rem;font-weight:800;margin-bottom:2px">Account ID:</label>' +
              '<input type="text" id="inpRestoreId" placeholder="เช่น AF-88294" style="width:100%;padding:8px;border:2px solid #2b1f1d;border-radius:6px;font-size:0.95rem;font-weight:800;letter-spacing:1px;text-transform:uppercase" />' +
            '</div>' +
            '<div style="margin-bottom:12px">' +
              '<label style="display:block;font-size:0.75rem;font-weight:800;margin-bottom:2px">PIN กู้คืนบัญชี (6 หลัก):</label>' +
              '<input type="password" id="inpRestorePin" placeholder="เช่น 123456" maxlength="6" style="width:100%;padding:8px;border:2px solid #2b1f1d;border-radius:6px;font-size:0.95rem;font-weight:800;letter-spacing:2px" />' +
            '</div>' +
            '<button id="btnDoRestoreLogin" class="gold" style="width:100%;padding:10px;font-weight:900;font-size:0.95rem">🔓 ยืนยันการเข้าสู่ระบบ</button>' +
          '</div>' +

          '<div style="background:#fff;border:2px solid #2b1f1d;border-radius:10px;padding:12px;margin-bottom:12px">' +
            '<div style="font-weight:900;font-size:0.95rem;margin-bottom:4px">➕ สลับสร้างไอดีใหม่ (New Guest ID)</div>' +
            '<div style="font-size:0.78rem;color:#64748b;margin-bottom:8px">สร้างบัญชีผู้เล่นใหม่เพื่อเริ่มเล่นตั้งแต่ต้น (ระบบจะบันทึกไอดีปัจจุบันไว้ในเครื่อง)</div>' +
            '<button id="btnDoCreateGuest" style="background:#f1f5f9;border:2px solid #2b1f1d;padding:8px 12px;border-radius:6px;font-weight:800;font-size:0.85rem;cursor:pointer">➕ สร้างไอดีใหม่ทันที</button>' +
          '</div>' +

          '<div style="display:flex;gap:8px">' +
            '<button id="btnExportJson" style="flex:1;background:#fff;border:1.5px solid #2b1f1d;padding:8px;border-radius:6px;font-weight:800;font-size:0.78rem;cursor:pointer">📤 สำรองข้อมูล JSON</button>' +
            '<button id="btnImportJson" style="flex:1;background:#fff;border:1.5px solid #2b1f1d;padding:8px;border-radius:6px;font-weight:800;font-size:0.78rem;cursor:pointer">📥 กู้คืนจาก JSON</button>' +
          '</div>' +
        '</div>';

      const m = showWfModal('👤 โปรไฟล์และจัดการบัญชีผู้เล่น', html);
      if (m) {
        m.onclick = (e) => {
          if (e.target.closest('#tabProfileInfo')) {
            const s1 = m.querySelector('#secProfileInfo'), s2 = m.querySelector('#secProfileLogin');
            const t1 = m.querySelector('#tabProfileInfo'), t2 = m.querySelector('#tabProfileLogin');
            if (s1) s1.style.display = 'block';
            if (s2) s2.style.display = 'none';
            if (t1) t1.style.background = '#fef08a';
            if (t2) t2.style.background = '#e2e8f0';
            AudioFX.play('click');
            return;
          }
          if (e.target.closest('#tabProfileLogin')) {
            const s1 = m.querySelector('#secProfileInfo'), s2 = m.querySelector('#secProfileLogin');
            const t1 = m.querySelector('#tabProfileInfo'), t2 = m.querySelector('#tabProfileLogin');
            if (s1) s1.style.display = 'none';
            if (s2) s2.style.display = 'block';
            if (t1) t1.style.background = '#e2e8f0';
            if (t2) t2.style.background = '#fef08a';
            AudioFX.play('click');
            return;
          }
          if (e.target.closest('#btnEditNickname')) {
            const box = m.querySelector('#boxEditNickname');
            if (box) box.style.display = (box.style.display === 'none' ? 'block' : 'none');
            return;
          }
          if (e.target.closest('#btnSaveNickname')) {
            const inp = m.querySelector('#inpNewNickname');
            const val = inp ? inp.value.trim() : '';
            if (!val) return toast('กรุณาระบุชื่อผู้เล่น');
            Account.setNickname(val);
            toast('✅ เปลี่ยนชื่อเป็น "' + val + '" เรียบร้อย!');
            AudioFX.play('chime');
            m.remove();
            lobby();
            return;
          }
          if (e.target.closest('#btnCopyProfileId')) {
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(acc.id);
            toast('📋 คัดลอก ID: ' + acc.id + ' เรียบร้อย!');
            AudioFX.play('chime');
            return;
          }
          if (e.target.closest('#btnToggleProfilePin')) {
            const el = m.querySelector('#txtProfilePin');
            const btn = m.querySelector('#btnToggleProfilePin');
            if (el) {
              if (el.textContent === '••••••') {
                el.textContent = acc.passcode;
                if (btn) btn.textContent = '🙈 ซ่อน';
              } else {
                el.textContent = '••••••';
                if (btn) btn.textContent = '👁️ ดู';
              }
            }
            return;
          }
          if (e.target.closest('#btnCopyProfilePin')) {
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(acc.passcode);
            toast('📋 คัดลอก PIN กู้คืนบัญชีเรียบร้อย!');
            AudioFX.play('chime');
            return;
          }
          if (e.target.closest('#btnDoRestoreLogin')) {
            const inpId = m.querySelector('#inpRestoreId');
            const inpPin = m.querySelector('#inpRestorePin');
            const res = Account.login(inpId ? inpId.value : '', inpPin ? inpPin.value : '');
            if (res.success) {
              toast('✅ เข้าสู่ระบบสำเร็จ! ยินดีต้อนรับ ' + res.account.nickname + ' (' + res.account.id + ')');
              AudioFX.play('chime');
              m.remove();
              lobby();
            } else {
              toast('⚠ ' + res.message);
              AudioFX.play('cancel');
            }
            return;
          }
          if (e.target.closest('#btnDoCreateGuest')) {
            const newAcc = Account.switchNewGuest();
            toast('✨ สร้างไอดีใหม่สำเร็จ! ID: ' + newAcc.id);
            AudioFX.play('chime');
            m.remove();
            lobby();
            return;
          }
          if (e.target.closest('#btnExportJson')) {
            const json = JSON.stringify(Account.current, null, 2);
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(json);
              toast('📋 คัดลอกข้อมูลสำรอง JSON ลงคลิปบอร์ดแล้ว!');
            } else {
              prompt('ข้อมูลสำรอง JSON ของคุณ (คัดลอกเก็บไว้):', json);
            }
            return;
          }
          if (e.target.closest('#btnImportJson')) {
            const code = prompt('วางโค้ดสำรองข้อมูล JSON ของคุณ:');
            if (!code) return;
            const res = Account.importBackup(code);
            if (res.success) {
              toast('✅ นำเข้าข้อมูลสำเร็จ! ยินดีต้อนรับ ' + res.account.nickname);
              AudioFX.play('chime');
              m.remove();
              lobby();
            } else {
              toast('⚠ ' + res.message);
            }
            return;
          }
          if (e.target.closest('#btnProfileLogout')) {
            m.remove();
            Account.logout();
            toast('🚪 ออกจากระบบเรียบร้อยแล้ว');
            return;
          }
          if (e.target.closest('#btnModalClose') || e.target === m) m.remove();
        };
      }
    }

    function getOwnedCards() {
      try {
        if (typeof localStorage !== 'undefined') {
          const s = localStorage.getItem('cg_owned_cards');
          if (s) return new Set(JSON.parse(s));
        }
      } catch (e) {}
      const starter = new Set();
      const keys = ['aquila', 'dino', 'mecha_strike'];
      keys.forEach(k => {
        const d = CG.cards && CG.cards[k];
        if (d) {
          (d.main || []).slice(0, 5).forEach(c => starter.add(c.id));
          if (d.extra && d.extra.length) starter.add(d.extra[0].id);
        }
      });
      return starter;
    }

    function saveOwnedCards(owned) {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('cg_owned_cards', JSON.stringify(Array.from(owned)));
        }
      } catch (e) {}
      if (Account && Account.save) Account.save();
    }

    function pullGachaPack(deckKey, count) {
      const d = CG.cards && CG.cards[deckKey];
      if (!d) return [];
      const allCards = [].concat(d.main || [], d.extra || []);
      const rarePool = d.rarePool || [];
      const owned = getOwnedCards();
      const pulled = [];

      for (let i = 0; i < count; i++) {
        const unownedList = allCards.filter(c => !owned.has(c.id));
        let picked;
        // Secret rare card chance from rarePool
        const rareChance = (count === 10 && i === count - 1) ? 0.35 : 0.12;
        if (rarePool.length > 0 && Math.random() < rareChance) {
          picked = rarePool[(Math.random() * rarePool.length) | 0];
        } else if (count === 10 && i === count - 1 && d.extra && d.extra.length > 0) {
          picked = d.extra[(Math.random() * d.extra.length) | 0];
        } else if (unownedList.length > 0 && Math.random() < 0.65) {
          picked = unownedList[(Math.random() * unownedList.length) | 0];
        } else {
          picked = allCards[(Math.random() * allCards.length) | 0];
        }
        const isNew = !owned.has(picked.id);
        if (isNew) {
          owned.add(picked.id);
        }
        pulled.push({ card: picked, isNew });
      }
      saveOwnedCards(owned);
      return pulled;
    }

    function showCardFullModal(cardDef) {
      if (!cardDef) return;
      const d = E().findCard(cardDef.id || cardDef.cardId) || cardDef;
      const mon = d.type !== 'spell';
      const s = S(), a = s.app;
      const atk = d.atk != null ? d.atk : 0;
      const def = d.def != null ? d.def : 0;
      const lvl = d.level != null ? d.level : 1;

      let typeLabel = '';
      if (d.type === 'spell') {
        const grpKey = (d.field || d.group === 'field') ? 'field' : d.group;
        typeLabel = 'สเปล (' + (s.spellGroup[grpKey] || d.group || 'ปกติ') + ')';
      } else if (d.type === 'fusion') {
        typeLabel = 'Resonance Fusion (ฟิวชั่นรวมร่าง)';
      } else if (d.type === 'grade4') {
        typeLabel = 'Apex Boss (ยูนิตสูงสุด)';
      } else {
        typeLabel = 'มอนสเตอร์ (Entity)';
      }

      let statsBadgeHtml = '';
      if (mon) {
        statsBadgeHtml = 
          '<div style="display:flex;gap:8px;align-items:center;margin:10px 0 14px">' +
            '<span style="background:#ff3344;color:#fff;font-weight:900;padding:4px 12px;border-radius:999px;border:2px solid #000;box-shadow:0 2px 5px rgba(0,0,0,0.4);font-size:0.95rem">⚔️ ATK ' + atk + '</span>' +
            '<span style="background:#ffd60a;color:#000;font-weight:900;padding:4px 10px;border-radius:50%;border:2px solid #000;box-shadow:0 2px 5px rgba(0,0,0,0.4);font-size:0.95rem;min-width:32px;text-align:center">★ ' + lvl + '</span>' +
            '<span style="background:#007aff;color:#fff;font-weight:900;padding:4px 12px;border-radius:999px;border:2px solid #000;box-shadow:0 2px 5px rgba(0,0,0,0.4);font-size:0.95rem">🛡️ DEF ' + def + '</span>' +
          '</div>';
      } else {
        const manaVal = d.mana != null ? d.mana : (d.cost && d.cost.mana != null ? d.cost.mana : 0);
        statsBadgeHtml = 
          '<div style="display:flex;gap:8px;align-items:center;margin:10px 0 14px">' +
            '<span style="background:linear-gradient(135deg,#0284c7,#0369a1);color:#fff;font-weight:900;padding:4px 14px;border-radius:999px;border:2px solid #000;box-shadow:0 2px 5px rgba(0,0,0,0.4);font-size:0.95rem">💧 ค่าร่าย ' + manaVal + ' Arcana</span>' +
          '</div>';
      }

      const cardViewHtml = V().cardHtml(d, { reveal: true, field: false });

      const overlay = document.createElement('div');
      overlay.className = 'wf-modal-overlay';
      overlay.style.zIndex = '10020';
      overlay.innerHTML = 
        '<div class="wf-modal-box" style="max-width:680px;padding:22px;border:3.5px solid #2b1f1d;background:#fbf7ee;border-radius:14px;box-shadow:8px 8px 0 #2b1f1d">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #2b1f1d;padding-bottom:10px;margin-bottom:16px">' +
            '<div style="font-size:1.3rem;font-weight:900;color:#2b1f1d">🔍 รายละเอียดการ์ดฉบับเต็ม</div>' +
            '<button class="wf-modal-close" id="btnFullModalClose" style="font-size:1.1rem;padding:2px 10px">✕ ปิด</button>' +
          '</div>' +
          '<div style="display:grid;grid-template-columns:180px 1fr;gap:20px;align-items:start">' +
            '<div style="width:180px;height:252px;border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,0.35);overflow:hidden">' +
              cardViewHtml +
            '</div>' +
            '<div>' +
              '<h3 style="font-size:1.4rem;font-weight:900;margin:0 0 4px;color:#1e293b">' + V().esc(d.name) + '</h3>' +
              '<div style="font-size:0.85rem;font-weight:700;color:#64748b;margin-bottom:6px">' + V().esc(typeLabel) + ' • รหัส: ' + V().esc(d.id) + '</div>' +
              statsBadgeHtml +
              '<div style="background:#fff;border:2px solid #2b1f1d;border-radius:8px;padding:12px;margin-bottom:12px;box-shadow:2px 2px 0 #2b1f1d">' +
                '<div style="font-size:0.8rem;font-weight:900;color:#2b1f1d;margin-bottom:6px">📜 ข้อความเอฟเฟกต์เต็ม:</div>' +
                '<div style="font-size:0.95rem;line-height:1.55;color:#1e293b;font-weight:600;white-space:pre-wrap">' + V().esc(d.text || '(การ์ดใบนี้ไม่มีข้อความเอฟเฟกต์พิเศษ)') + '</div>' +
              '</div>' +
              (d.tags && d.tags.length ? '<div style="font-size:0.75rem;color:#64748b">แท็ก: ' + d.tags.map(t => '#' + t).join(' ') + '</div>' : '') +
            '</div>' +
          '</div>' +
        '</div>';

      document.body.appendChild(overlay);
      overlay.onclick = (e) => {
        if (e.target.closest('#btnFullModalClose') || e.target === overlay) {
          AudioFX.play('draw');
          overlay.remove();
        }
      };
    }
    CG.ui.showCardFullModal = showCardFullModal;

    function openPackTearAnimation(pulledList, deckKey, onDone) {
      const curDeck = CG.cards[deckKey] || { name: 'เด็คการ์ด', main: [], extra: [] };
      const allCards = [].concat(curDeck.main || [], curDeck.extra || [], curDeck.rarePool || []);
      const rawAce = (curDeck.extra && curDeck.extra.length)
        ? curDeck.extra[curDeck.extra.length - 1]
        : (allCards[0] || { id: 'card', name: curDeck.name });
      const aceCard = V().def(rawAce);
      const aceCardHtml = V().cardHtml(aceCard, { reveal: true, field: false });

      const firstPulled = (pulledList && pulledList.length && pulledList[0].card)
        ? V().def(pulledList[0].card)
        : aceCard;
      const firstPulledHtml = V().cardHtml(firstPulled, { reveal: true, field: false });

      let themeClass = 'theme-mecha';
      let deckBrandName = 'MECHA STRIKE';
      let deckSubtitle = 'ไซเบอร์เร็กซ์ & กองทัพกลจักร';
      const editionTag = '1st EDITION';

      const dk = (deckKey || '').toLowerCase();
      if (dk.includes('dino')) {
        themeClass = 'theme-dino';
        deckBrandName = 'PRIMEVAL DINOSAUR';
        deckSubtitle = 'ไทรันโนส & ราชันย์ดึกดำบรรพ์';
      } else if (dk.includes('aquila')) {
        themeClass = 'theme-aquila';
        deckBrandName = 'IMPERIAL AQUILA';
        deckSubtitle = 'อควิลา & จักรวรรดิอินทรีทอง';
      } else if (curDeck.name) {
        deckBrandName = curDeck.name;
        deckSubtitle = 'ซองการ์ดนักสู้พลังเวท';
      }

      const countLabel = pulledList.length + ' ใบ';
      const hasRare = pulledList.some(item => {
        const c = item.card;
        return c && (c.type === 'fusion' || c.type === 'grade4' || (c.atk && c.atk >= 2000));
      });

      const overlay = document.createElement('div');
      overlay.className = 'pack-tear-overlay';

      overlay.innerHTML =
        '<div class="pack-tear-container">' +
          '<div class="pack-tear-instruction" id="packTearInstruction">' +
            '✂️ ลากนิ้วหรือแตะที่รอยประเพื่อฉีกซอง!' +
          '</div>' +
          '<div class="booster-pack ' + themeClass + '" id="boosterPackEntity">' +
            '<div class="pack-wrapper-shadow"></div>' +
            '<div class="pack-top-crimp-piece" id="packTopCrimp" title="แตะหรือลากเพื่อฉีกซอง">' +
              '<div class="pack-crimp-pattern"></div>' +
              '<div class="pack-euro-punch"></div>' +
              '<div class="pack-tear-guide">' +
                '<span class="tear-notch-handle">✂️ ── ลากฉีก ── ⇥</span>' +
                '<span>TEAR HERE</span>' +
              '</div>' +
            '</div>' +
            '<div class="pack-divine-burst" id="packDivineBurst">' +
              '<div class="burst-ray-radial"></div>' +
              '<div class="burst-rays-spikes"></div>' +
            '</div>' +
            '<div class="pack-inside-card-stack" id="packCardStack">' +
              '<div class="inside-card-phantom c3">✦</div>' +
              '<div class="inside-card-phantom c2">✦</div>' +
              '<div class="inside-card-phantom c1 pack-sliding-front">' +
                firstPulledHtml +
              '</div>' +
            '</div>' +
            '<div class="pack-body-wrap">' +
              '<div class="pack-hologram-sweep"></div>' +
              '<div class="pack-branding-header">' +
                '<div class="pack-brand-badge">✦ ' + V().esc(deckBrandName) + ' ✦</div>' +
                '<div class="pack-edition-tag">' + V().esc(editionTag) + '</div>' +
              '</div>' +
              '<div class="pack-card-showcase" id="packCardShowcase" title="แตะเพื่อดูรายละเอียดการ์ดเต็มใบ">' +
                '<div class="pack-card-frame-wrapper">' +
                  aceCardHtml +
                  '<div class="pack-card-holo-foil"></div>' +
                '</div>' +
                '<div class="pack-inspect-pill">' +
                  '🔍 แตะการ์ดเพื่อดูเต็มใบ' +
                '</div>' +
              '</div>' +
              '<div class="pack-footer-info">' +
                '<div class="pack-deck-headline">' + V().esc(curDeck.name) + '</div>' +
                '<div class="pack-deck-subhead">บรรจุการ์ด ' + countLabel + ' • ' + V().esc(deckSubtitle) + '</div>' +
              '</div>' +
              '<div class="pack-crimp-pattern bottom"></div>' +
            '</div>' +
          '</div>' +
          '<button class="btn-quick-tear" id="btnQuickTear">' +
            '✂️ ฉีกซองทันที (Quick Tear)' +
          '</button>' +
        '</div>';

      document.body.appendChild(overlay);

      const cardShowcaseEl = overlay.querySelector('#packCardShowcase');
      if (cardShowcaseEl) {
        cardShowcaseEl.onclick = (e) => {
          e.stopPropagation();
          AudioFX.play('draw');
          showCardFullModal(aceCard);
        };
      }

      let isTorn = false;
      const packEl = overlay.querySelector('#boosterPackEntity');
      const topCrimpEl = overlay.querySelector('#packTopCrimp');
      const burstEl = overlay.querySelector('#packDivineBurst');
      const instrEl = overlay.querySelector('#packTearInstruction');
      const quickBtn = overlay.querySelector('#btnQuickTear');

      function executeTear() {
        if (isTorn) return;
        isTorn = true;

        // เสียงฟอยล์ฉีกสมจริง (Web Audio API procedural rip)
        AudioFX.play('pack_tear');

        // แสดงแอนิเมชันฉีกซอง: ท่อนบนปลิวกระเด็น, แสงระเบิด, ซองตัวหลักยุบ, การ์ดพุ่งขึ้น
        if (packEl) packEl.classList.add('is-torn');
        if (burstEl) burstEl.classList.add('active');

        if (instrEl) {
          instrEl.style.opacity = '0';
          instrEl.style.pointerEvents = 'none';
        }
        if (quickBtn) {
          quickBtn.style.opacity = '0';
          quickBtn.style.pointerEvents = 'none';
        }

        setTimeout(() => {
          AudioFX.play('draw');
          if (hasRare) {
            setTimeout(() => AudioFX.play('fanfare'), 320);
          } else {
            setTimeout(() => AudioFX.play('chime'), 280);
          }
        }, 220);

        setTimeout(() => {
          overlay.style.transition = 'opacity 0.42s cubic-bezier(0.4, 0, 0.2, 1)';
          overlay.style.opacity = '0';
          setTimeout(() => {
            overlay.remove();
            if (onDone) onDone();
          }, 420);
        }, 1200);
      }

      // ตรวจจับการลาก/ปาดนิ้ว (Gesture swipe / drag)
      let startX = 0;
      let startY = 0;
      let isPointerDown = false;

      if (packEl) {
        packEl.addEventListener('pointerdown', (e) => {
          isPointerDown = true;
          startX = e.clientX;
          startY = e.clientY;
        });

        window.addEventListener('pointermove', (e) => {
          if (!isPointerDown || isTorn) return;
          const dx = e.clientX - startX;
          const dy = e.clientY - startY;
          if (Math.abs(dx) >= 42 || Math.hypot(dx, dy) >= 60) {
            isPointerDown = false;
            executeTear();
          }
        });

        window.addEventListener('pointerup', () => {
          isPointerDown = false;
        });
      }

      if (topCrimpEl) {
        topCrimpEl.onclick = (e) => {
          e.stopPropagation();
          executeTear();
        };
      }

      if (packEl) {
        packEl.onclick = (e) => {
          e.stopPropagation();
          executeTear();
        };
      }

      if (quickBtn) {
        quickBtn.onclick = (e) => {
          e.stopPropagation();
          executeTear();
        };
      }
    }
    CG.ui.openPackTearAnimation = openPackTearAnimation;

    function openGachaRevealModal(pulledList, deckKey, onClose) {
      const curDeck = CG.cards[deckKey] || { name: 'เด็ค' };
      const isSingle = pulledList.length === 1;

      const overlay = document.createElement('div');
      overlay.className = 'gacha-reveal-overlay';

      let cardsHtml = '';
      pulledList.forEach((item, idx) => {
        const c = item.card;
        const isRare = c.rare || (c.id && c.id.endsWith('_rare')) || c.type === 'fusion' || c.type === 'grade4' || (c.atk && c.atk >= 2000);
        const cardFaceHtml = V().cardHtml(c, { reveal: true });
        cardsHtml += 
          '<div class="gacha-card-slot ' + (isRare ? 'is-rare' : '') + '" data-slot-idx="' + idx + '">' +
            '<div class="gacha-card-inner">' +
              '<div class="gacha-card-back ' + (isRare ? 'rare-glow' : '') + '">' +
                '<div class="gacha-seal">✦</div>' +
                '<div class="gacha-card-label">ARCANA</div>' +
                '<div class="gacha-touch-hint">แตะเพื่อเปิด</div>' +
              '</div>' +
              '<div class="gacha-card-front">' +
                cardFaceHtml +
                (item.isNew ? '<span class="gacha-new-badge">✨ NEW!</span>' : '') +
              '</div>' +
            '</div>' +
          '</div>';
      });

      overlay.innerHTML = 
        '<div class="gacha-reveal-header">' +
          '<div class="gacha-reveal-title">🎉 สุ่มการ์ด: ' + V().esc(curDeck.name) + ' (' + (isSingle ? '1 ใบ' : '10 ใบ') + ')</div>' +
          '<div class="gacha-reveal-sub">' +
            'แตะที่การ์ดเพื่อเปิดทีละใบ หรือกดปุ่มเปิดทั้งหมด • เปิดแล้ว <span id="revCounter" style="color:#fef08a;font-weight:900">0</span> / ' + pulledList.length + ' ใบ' +
          '</div>' +
        '</div>' +
        '<div class="' + (isSingle ? 'gacha-grid-1' : 'gacha-grid-10') + '" id="gachaCardsGrid">' +
          cardsHtml +
        '</div>' +
        '<div class="gacha-footer-bar">' +
          (!isSingle ? '<button class="gacha-btn-action primary" id="btnRevealAll">✨ เปิดทั้งหมด (Reveal All)</button>' : '') +
          '<button class="gacha-btn-action gold" id="btnGachaFinish">ตกลง (เสร็จสิ้น)</button>' +
        '</div>';

      document.body.appendChild(overlay);

      let revealedCount = 0;
      const counterEl = overlay.querySelector('#revCounter');
      const finishBtn = overlay.querySelector('#btnGachaFinish');
      const revealAllBtn = overlay.querySelector('#btnRevealAll');

      function flipSlot(slotEl) {
        if (!slotEl || slotEl.classList.contains('flipped')) return;
        slotEl.classList.add('flipped');
        revealedCount++;
        if (counterEl) counterEl.textContent = revealedCount;

        const isRare = slotEl.classList.contains('is-rare');
        if (isRare) {
          AudioFX.play('fanfare');
        } else {
          AudioFX.play('chime');
        }

        if (revealedCount >= pulledList.length) {
          if (revealAllBtn) {
            revealAllBtn.disabled = true;
            revealAllBtn.style.opacity = '0.4';
          }
          if (finishBtn) {
            finishBtn.style.boxShadow = '0 0 15px rgba(254, 240, 138, 0.8)';
          }
        }
      }

      overlay.onclick = (e) => {
        const slot = e.target.closest('.gacha-card-slot');
        if (slot) {
          if (!slot.classList.contains('flipped')) {
            flipSlot(slot);
          } else {
            const idx = Number(slot.dataset.slotIdx);
            if (pulledList[idx]) {
              showCardFullModal(pulledList[idx].card);
            }
          }
          return;
        }

        if (e.target.closest('#btnRevealAll')) {
          const unrevealed = Array.from(overlay.querySelectorAll('.gacha-card-slot:not(.flipped)'));
          if (!unrevealed.length) return;
          if (revealAllBtn) {
            revealAllBtn.disabled = true;
            revealAllBtn.style.opacity = '0.4';
          }
          unrevealed.forEach((s, i) => {
            setTimeout(() => {
              flipSlot(s);
            }, i * 130);
          });
          return;
        }

        if (e.target.closest('#btnGachaFinish')) {
          AudioFX.play('draw');
          overlay.remove();
          if (onClose) onClose();
        }
      };
    }

    let currentShopDeck = 'mecha_strike';
    function openShopModal(deckKey) {
      if (deckKey) currentShopDeck = deckKey;
      const keys = Object.keys(CG.cards || {});
      if (!CG.cards[currentShopDeck]) currentShopDeck = keys[0] || 'mecha_strike';
      const curDeck = CG.cards[currentShopDeck] || { name: 'เด็ค', main: [], extra: [] };
      const allCards = [].concat(curDeck.main || [], curDeck.extra || [], curDeck.rarePool || []);

      const leftCard = allCards[0] || { name: '?' };
      const centerCard = (curDeck.extra && curDeck.extra.length)
        ? curDeck.extra[curDeck.extra.length - 1]
        : (allCards[allCards.length - 1] || leftCard);
      const rightCard = (curDeck.extra && curDeck.extra.length > 1)
        ? curDeck.extra[0]
        : (allCards[1] || leftCard);

      const leftCardHtml = V().cardHtml(leftCard, { reveal: true });
      const centerCardHtml = V().cardHtml(centerCard, { reveal: true });
      const rightCardHtml = V().cardHtml(rightCard, { reveal: true });

      const tabsHtml = keys.map(k => {
        const d = CG.cards[k];
        const isActive = k === currentShopDeck;
        return '<button class="shop-deck-tab-btn' + (isActive ? ' active' : '') + '" data-shopdeck="' + k + '">' + V().esc(d.name) + '</button>';
      }).join('');

      const html = 
        '<div class="shop-sketch-modal">' +
          '<div class="shop-sketch-left">' +
            '<div>' +
              '<div class="shop-sketch-title-box">ร้านค้า</div>' +
              '<div class="shop-sketch-deck-list">' + tabsHtml + '</div>' +
            '</div>' +
            '<div class="shop-currency-mini">' +
              '<span style="display:inline-flex;align-items:center;gap:6px;color:#15803d;font-weight:900">' + CG.ui.note20Html('mini') + ' <span id="shopValCurr20">' + CG.ui.curr20 + '</span></span>' +
              '<span style="display:inline-flex;align-items:center;gap:6px;color:#b91c1c;font-weight:900">' + CG.ui.note100Html('mini') + ' <span id="shopValCurr100">' + CG.ui.curr100 + '</span></span>' +
            '</div>' +
          '</div>' +
          '<div class="shop-sketch-right">' +
            '<button class="shop-sketch-close" id="btnShopClose" title="ปิดหน้าร้านค้า">✕</button>' +
            '<div class="shop-cards-fanned">' +
              '<div class="fanned-card fan-left" data-fanned-idx="0" style="cursor:pointer" title="แตะเพื่ออ่านเอฟเฟกต์เต็ม">' + leftCardHtml + '</div>' +
              '<div class="fanned-card fan-right" data-fanned-idx="2" style="cursor:pointer" title="แตะเพื่ออ่านเอฟเฟกต์เต็ม">' + rightCardHtml + '</div>' +
              '<div class="fanned-card fan-center" data-fanned-idx="1" style="cursor:pointer" title="แตะเพื่ออ่านเอฟเฟกต์เต็ม">' + centerCardHtml + '</div>' +
            '</div>' +
            '<div class="shop-deck-name-tag">' + V().esc(curDeck.name) + '</div>' +
            '<div class="shop-sketch-actions">' +
              '<button class="shop-buy-btn" data-gacha="' + currentShopDeck + ':1">' +
                '<strong>1 ครั้ง</strong>' +
                '<small style="display:flex;align-items:center;justify-content:center;gap:4px">ราคา ' + CG.ui.note20Html('mini') + ' × 5</small>' +
              '</button>' +
              '<button class="shop-buy-btn gold-btn" data-gacha="' + currentShopDeck + ':10">' +
                '<strong>10 ครั้ง</strong>' +
                '<small style="display:flex;align-items:center;justify-content:center;gap:4px">ราคา ' + CG.ui.note100Html('mini') + ' × 1</small>' +
              '</button>' +
            '</div>' +
          '</div>' +
        '</div>';

      const m = showWfModal('', html, 'shop-full-container');
      if (m) m.onclick = (e) => {
        const tabBtn = e.target.closest('[data-shopdeck]');
        if (tabBtn) {
          m.remove();
          openShopModal(tabBtn.dataset.shopdeck);
          return;
        }
        const fanned = e.target.closest('[data-fanned-idx]');
        if (fanned) {
          const idx = Number(fanned.dataset.fannedIdx);
          const target = idx === 0 ? leftCard : (idx === 1 ? centerCard : rightCard);
          showCardFullModal(target);
          return;
        }
        const g = e.target.closest('[data-gacha]');
        if (g) {
          const [dKey, cntStr] = g.dataset.gacha.split(':');
          const isSingle = cntStr === '1';
          const cost = isSingle ? 5 : 1;
          if (isSingle && CG.ui.curr20 < cost) return toast('แบงก์ 20 ไม่พอ!');
          if (!isSingle && CG.ui.curr100 < cost) return toast('แบงก์ 100 ไม่พอ!');
          if (isSingle) CG.ui.curr20 -= cost; else CG.ui.curr100 -= cost;
          Account.save();
          const v20 = $('valCurr20'); if (v20) v20.textContent = CG.ui.curr20;
          const v100 = $('valCurr100'); if (v100) v100.textContent = CG.ui.curr100;
          const sv20 = $('shopValCurr20'); if (sv20) sv20.textContent = CG.ui.curr20;
          const sv100 = $('shopValCurr100'); if (sv100) sv100.textContent = CG.ui.curr100;
          
          AudioFX.play('draw');
          const pulled = pullGachaPack(dKey, isSingle ? 1 : 10);
          openPackTearAnimation(pulled, dKey, () => {
            openGachaRevealModal(pulled, dKey, () => {
              m.remove();
              openShopModal(dKey);
            });
          });
          return;
        }
        if (e.target.closest('#btnShopClose') || e.target === m) {
          m.remove();
        }
      };
    }

    function openBotModal() {
      const keys = Object.keys(CG.cards || {});
      const unlocked = (Account.current && Account.current.unlockedDecks && Account.current.unlockedDecks.length) ? Account.current.unlockedDecks : [keys[0]];
      const deckOpts = keys.map(k => {
        const d = CG.cards[k];
        const isUnlocked = unlocked.includes(k);
        return '<option value="' + k + '" ' + (deckA === k ? 'selected' : '') + (!isUnlocked ? ' disabled style="color:#94a3b8"' : '') + '>' + (isUnlocked ? '👑 ' : '🔒 [ล็อก] ') + V().esc(d.name) + '</option>';
      }).join('');

      const html = 
        '<div style="margin-bottom:14px">' +
          '<label style="display:block;font-weight:800;font-size:0.9rem;margin-bottom:6px">เลือกระดับความฉลาดของบอท AI:</label>' +
          '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">' +
            '<button class="wf-diff-btn ' + (currentDifficulty === 'easy' ? 'active' : '') + '" data-setdiff="easy">🌱 ง่าย (Easy)</button>' +
            '<button class="wf-diff-btn ' + (currentDifficulty === 'normal' ? 'active' : '') + '" data-setdiff="normal">⚔️ ปานกลาง (Normal)</button>' +
            '<button class="wf-diff-btn ' + (currentDifficulty === 'hard' ? 'active' : '') + '" data-setdiff="hard">🔥 ปรมาจารย์ (Hard)</button>' +
          '</div>' +
        '</div>' +
        '<div style="margin-bottom:14px">' +
          '<label style="display:block;font-weight:800;font-size:0.9rem;margin-bottom:6px">เลือกเด็คของคุณ:</label>' +
          '<select id="selPlayerDeck" style="width:100%;padding:10px;border:2px solid #2b1f1d;background:#fff;border-radius:6px;font-weight:700;font-size:0.95rem">' +
            deckOpts +
          '</select>' +
        '</div>' +
        '<div style="background:#fff;border:2px dashed #2b1f1d;border-radius:8px;padding:12px;margin-bottom:18px;font-size:0.82rem;color:#475569;line-height:1.4">' +
          (currentDifficulty === 'hard'
            ? '🔥 <strong>ระดับปรมาจารย์ (Hard):</strong> บอทจะเล่นคอมโบการ์ดเต็มสูบ! สลับมือหาการ์ดเริ่มคอมโบ, จั่ว/ค้นหาก่อนลงตัว, รวมร่าง Fusion / Overlay เรียกบอสใหญ่, วางการ์ดสวนกลับขัดขวางคุณ และคำนวณวันเทิร์นคิล (Lethal) โหดขั้นสุด!'
            : (currentDifficulty === 'normal'
                ? '⚔️ <strong>ระดับปานกลาง (Normal):</strong> บอทเล่นรอบคอบ รู้จักป้องกันตัวและเลือกลงการ์ดที่คุ้มค่า'
                : '🌱 <strong>ระดับง่าย (Easy):</strong> บอทเล่นสบายๆ เหมาะสำหรับการซ้อมและการทดสอบเบื้องต้น')) + '<br><br>' +
          '🤖 <strong>กติกาการซ้อมกับบอท:</strong> บอทจะสุ่มเด็คสำเร็จรูป (ไดโนเสาร์, โรมันอควิลา หรือเมก้าสไตรก์) มาเป็นคู่ต่อสู้ของคุณ<br>' +
          '<em>หมายเหตุ: การฟาร์มแบงก์ 20 จากบอทจะได้รับน้อยกว่าการดวลกับผู้เล่นคนจริง</em>' +
        '</div>' +
        '<button class="wf-modal-action-btn" id="btnStartBotDuel">⚔️ เริ่มการดวลกับบอททันที</button>';
      const m = showWfModal('🤖 เล่นกับบอท AI (Solo Practice)', html);
      if (m) m.onclick = (e) => {
        const diffBtn = e.target.closest('[data-setdiff]');
        if (diffBtn) {
          const selD = m.querySelector('#selPlayerDeck');
          if (selD) deckA = selD.value;
          setDifficulty(diffBtn.dataset.setdiff);
          m.remove();
          openBotModal();
        } else if (e.target.closest('#btnStartBotDuel')) {
          const selD = m.querySelector('#selPlayerDeck');
          if (selD) deckA = selD.value;
          const otherKeys = keys.filter(k => k !== deckA);
          deckB = otherKeys.length ? otherKeys[(Math.random() * otherKeys.length) | 0] : deckA;
          mode = 'bot';
          m.remove();
          start();
        } else if (e.target.closest('#btnModalClose') || e.target === m) {
          m.remove();
        }
      };
    }

    function openPvpModal() {
      const keys = Object.keys(CG.cards || {});
      const unlocked = (Account.current && Account.current.unlockedDecks && Account.current.unlockedDecks.length) ? Account.current.unlockedDecks : [keys[0]];
      const deckOpts = keys.map(k => {
        const d = CG.cards[k];
        const isUnlocked = unlocked.includes(k);
        return '<option value="' + k + '" ' + (deckA === k ? 'selected' : '') + (!isUnlocked ? ' disabled style="color:#94a3b8"' : '') + '>' + (isUnlocked ? '👑 ' : '🔒 [ล็อก] ') + V().esc(d.name) + '</option>';
      }).join('');

      let savedName = (Account.current && Account.current.nickname) ? Account.current.nickname : ('ผู้ท้าชิง ' + Math.floor(100 + Math.random() * 900));

      const html = 
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">' +
          '<div>' +
            '<label style="display:block;font-weight:800;font-size:0.85rem;margin-bottom:4px">ชื่อผู้เล่นของคุณ:</label>' +
            '<input type="text" id="inputPlayerName" value="' + V().esc(savedName) + '" maxlength="14" style="width:100%;padding:8px 12px;border:2px solid #2b1f1d;background:#fff;border-radius:6px;font-weight:700;font-size:0.9rem">' +
          '</div>' +
          '<div>' +
            '<label style="display:block;font-weight:800;font-size:0.85rem;margin-bottom:4px">เด็คที่คุณใช้ดวล:</label>' +
            '<select id="selPvpDeck" style="width:100%;padding:8px 12px;border:2px solid #2b1f1d;background:#fff;border-radius:6px;font-weight:700;font-size:0.9rem">' +
              deckOpts +
            '</select>' +
          '</div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">' +
          '<div style="background:#fff;border:2.5px solid #2b1f1d;border-radius:10px;padding:14px;text-align:center;display:flex;flex-direction:column;justify-content:space-between">' +
            '<div>' +
              '<div style="font-size:2rem;margin-bottom:2px">🏠</div>' +
              '<div style="font-weight:900;font-size:1.05rem;margin-bottom:4px">สร้างห้องดวลใหม่</div>' +
              '<div style="font-size:0.75rem;color:#64748b;line-height:1.3">สร้างห้องออนไลน์และรับรหัส 5 ตัว เพื่อส่งให้เพื่อนเชื่อมต่อเข้ามา</div>' +
            '</div>' +
            '<button class="wf-modal-action-btn" id="btnCreateOnlineRoom" style="margin-top:12px;font-size:0.9rem;padding:10px;background:#bbf7d0">✨ สร้างห้องใหม่</button>' +
          '</div>' +
          '<div style="background:#fff;border:2.5px solid #2b1f1d;border-radius:10px;padding:14px;text-align:center;display:flex;flex-direction:column;justify-content:space-between">' +
            '<div>' +
              '<div style="font-size:2rem;margin-bottom:2px">🚪</div>' +
              '<div style="font-weight:900;font-size:1.05rem;margin-bottom:4px">เข้าร่วมห้องเพื่อน</div>' +
              '<div style="font-size:0.75rem;color:#64748b;margin-bottom:6px">ใส่รหัสห้อง 5 ตัวอักษร:</div>' +
              '<input type="text" id="inputFriendCode" placeholder="เช่น ARC89" maxlength="5" style="width:100%;padding:8px;border:2px solid #2b1f1d;border-radius:6px;font-size:1rem;text-align:center;font-weight:900;letter-spacing:3px;text-transform:uppercase">' +
            '</div>' +
            '<button class="wf-modal-action-btn" id="btnJoinOnlineRoom" style="margin-top:12px;font-size:0.9rem;padding:10px;background:#fef08a">⚡ เข้าร่วมการดวล</button>' +
          '</div>' +
        '</div>';

      const m = showWfModal('⚔️ ดวลออนไลน์ (Online PVP)', html);
      if (m) m.onclick = async (e) => {
        const selD = m.querySelector('#selPvpDeck');
        if (selD) deckA = selD.value;
        const nameInp = m.querySelector('#inputPlayerName');
        const pName = nameInp ? nameInp.value.trim() : 'Player';
        if (nameInp && pName) Account.setNickname(pName);
        try { localStorage.setItem('arcana_player_name', pName); } catch (_) {}

        if (e.target.closest('#btnCreateOnlineRoom')) {
          if (!CG.network) return toast('ระบบออนไลน์ไม่พร้อมใช้งาน');
          toast('🔄 กำลังเชื่อมต่อไปยังเซิร์ฟเวอร์...');
          try {
            await CG.network.connect();
            CG.network.createRoom({ deckKey: deckA, playerName: pName });
            showWaitingModal();
          } catch (err) {
            toast('❌ ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้: ' + (err.message || 'Server Offline'));
          }
        } else if (e.target.closest('#btnJoinOnlineRoom')) {
          const inp = m.querySelector('#inputFriendCode');
          const code = inp ? inp.value.trim().toUpperCase() : '';
          if (!code || code.length < 3) return toast('กรุณาใส่รหัสห้องให้ถูกต้อง');
          if (!CG.network) return toast('ระบบออนไลน์ไม่พร้อมใช้งาน');
          toast('🔄 กำลังเข้าร่วมห้อง ' + code + '...');
          try {
            await CG.network.connect();
            CG.network.joinRoom({ roomCode: code, deckKey: deckA, playerName: pName });
          } catch (err) {
            toast('❌ ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
          }
        } else if (e.target.closest('#btnModalClose') || e.target === m) {
          m.remove();
        }
      };

      function showWaitingModal() {
        if (m) m.remove();
        const waitHtml = 
          '<div style="text-align:center;padding:12px 4px">' +
            '<div style="font-size:0.85rem;color:#64748b;margin-bottom:6px">รหัสห้องดวลของคุณ (ส่งให้เพื่อนเพื่อเข้าร่วม):</div>' +
            '<div id="waitingRoomCodeBox" style="font-size:2.2rem;font-weight:900;letter-spacing:4px;color:#1e293b;background:#fef08a;border:3px solid #2b1f1d;border-radius:10px;padding:10px 24px;display:inline-block;margin-bottom:10px">' +
              (CG.network.roomCode || 'กำลังสร้าง...') +
            '</div>' +
            '<div><button id="btnCopyWaitingCode" style="font-size:0.8rem;padding:6px 14px;cursor:pointer;border:2px solid #2b1f1d;background:#fff;border-radius:6px;font-weight:700">📋 คัดลอกรหัสห้อง</button></div>' +
            '<div style="margin-top:16px;color:#475569;font-size:0.85rem;display:flex;align-items:center;justify-content:center;gap:8px">' +
              '<span style="display:inline-block;animation:spin 1.5s linear infinite;font-size:1.1rem">⏳</span> กำลังรอคู่แข่งเข้าร่วมห้อง...' +
            '</div>' +
            '<button class="wf-modal-action-btn" id="btnCancelWaiting" style="margin-top:16px;background:#fee2e2;color:#991b1b;border-color:#b91c1c;padding:6px 16px;font-size:0.85rem">✕ ยกเลิกและกลับ</button>' +
          '</div>';

        const wm = showWfModal('🏠 ห้องดวลออนไลน์', waitHtml);
        const onCreated = (res) => {
          const box = document.getElementById('waitingRoomCodeBox');
          if (box) box.textContent = res.roomCode;
        };
        CG.network.on('roomCreated', onCreated);

        if (wm) wm.onclick = (e) => {
          if (e.target.closest('#btnCopyWaitingCode')) {
            const code = CG.network.roomCode;
            if (code && navigator.clipboard) {
              navigator.clipboard.writeText(code);
              toast('📋 คัดลอกรหัสห้อง ' + code + ' เรียบร้อยแล้ว!');
            }
          } else if (e.target.closest('#btnCancelWaiting') || e.target.closest('#btnModalClose') || e.target === wm) {
            CG.network.disconnect();
            wm.remove();
          }
        };
      }
    }

    let currentCodexDeck = 'mecha_strike';
    let currentCodexPage = 0;
    function openCodexModal(deckKey, pageIdx) {
      if (deckKey) currentCodexDeck = deckKey;
      if (pageIdx !== undefined) currentCodexPage = pageIdx;
      const keys = Object.keys(CG.cards || {});
      if (!CG.cards[currentCodexDeck]) currentCodexDeck = keys[0] || 'mecha_strike';
      const curDeck = CG.cards[currentCodexDeck] || { name: 'เด็ค', main: [], extra: [] };
      const allCards = [].concat(curDeck.main || [], curDeck.extra || [], curDeck.rarePool || []);
      const owned = getOwnedCards();
      
      const cardsPerPage = 4;
      const spreadSize = cardsPerPage * 2;
      const totalSpreads = Math.ceil(allCards.length / spreadSize) || 1;
      if (currentCodexPage < 0) currentCodexPage = 0;
      if (currentCodexPage >= totalSpreads) currentCodexPage = totalSpreads - 1;

      const startIdx = currentCodexPage * spreadSize;
      const leftCards = allCards.slice(startIdx, startIdx + cardsPerPage);
      const rightCards = allCards.slice(startIdx + cardsPerPage, startIdx + spreadSize);

      let ownedInDeck = 0;
      allCards.forEach(c => { if (owned.has(c.id)) ownedInDeck++; });

      function renderCardCell(c) {
        if (!c) return '';
        const isOwned = owned.has(c.id);
        const cardHtml = V().cardHtml(c, { reveal: true });
        return '<div class="codex-card-cell ' + (isOwned ? 'owned' : 'unowned') + '" data-inspect-card="' + c.id + '" title="' + V().esc(c.name) + '">' +
          '<div class="codex-card-wrapper">' + cardHtml + '</div>' +
          '<div class="codex-status-tag">' + (isOwned ? 'ครอบครองแล้ว ✓' : 'ยังไม่ค้นพบ ?') + '</div>' +
        '</div>';
      }

      const leftGrid = leftCards.map(renderCardCell).join('');
      const rightGrid = rightCards.map(renderCardCell).join('');

      const tabsHtml = keys.map(k => {
        const d = CG.cards[k];
        const isActive = k === currentCodexDeck;
        return '<button class="shop-deck-tab-btn' + (isActive ? ' active' : '') + '" style="padding:6px 16px;font-size:0.85rem" data-codexdeck="' + k + '">' + V().esc(d.name) + '</button>';
      }).join('');

      const html = 
        '<div class="codex-fullscreen-book">' +
          '<div class="codex-header-bar">' +
            '<div style="display:flex;align-items:center;gap:14px">' +
              '<div class="codex-title">📖 สารานุกรมคลังการ์ด (Codex)</div>' +
              '<div style="display:flex;gap:6px">' + tabsHtml + '</div>' +
            '</div>' +
            '<div style="display:flex;align-items:center;gap:12px">' +
              '<span style="font-size:0.85rem;font-weight:800;color:#15803d">ครอบครอง: ' + ownedInDeck + '/' + allCards.length + ' ใบ</span>' +
              '<button class="codex-close-btn" id="btnCodexClose">✕ ปิดหน้าคลัง</button>' +
            '</div>' +
          '</div>' +
          '<div class="codex-pages-spread">' +
            // LEFT PAGE
            '<div class="codex-page codex-page-left">' +
              '<div class="codex-grid">' + leftGrid + '</div>' +
              '<button class="codex-flip-btn codex-prev" id="btnCodexPrev" ' + (currentCodexPage === 0 ? 'style="opacity:0.3;cursor:not-allowed"' : '') + ' title="เปิดหน้าก่อนหน้า">⬅</button>' +
            '</div>' +
            // SPINE
            '<div class="codex-spine-divider"></div>' +
            // RIGHT PAGE
            '<div class="codex-page codex-page-right">' +
              '<div class="codex-grid">' + rightGrid + '</div>' +
              '<div style="text-align:center;font-size:0.8rem;font-weight:800;color:#64748b;margin-top:8px">หน้า ' + (currentCodexPage * 2 + 1) + ' - ' + (currentCodexPage * 2 + 2) + ' / ' + (totalSpreads * 2) + '</div>' +
              '<button class="codex-flip-btn codex-next" id="btnCodexNext" ' + (currentCodexPage >= totalSpreads - 1 ? 'style="opacity:0.3;cursor:not-allowed"' : '') + ' title="เปิดหน้าถัดไป">➡</button>' +
            '</div>' +
          '</div>' +
        '</div>';

      const m = showWfModal('', html, 'codex-full-container');
      if (m) m.onclick = (e) => {
        const deckBtn = e.target.closest('[data-codexdeck]');
        if (deckBtn) {
          m.remove();
          openCodexModal(deckBtn.dataset.codexdeck, 0);
          return;
        }
        if (e.target.closest('#btnCodexPrev')) {
          if (currentCodexPage > 0) {
            AudioFX.play('draw');
            m.remove();
            openCodexModal(currentCodexDeck, currentCodexPage - 1);
          }
          return;
        }
        if (e.target.closest('#btnCodexNext')) {
          if (currentCodexPage < totalSpreads - 1) {
            AudioFX.play('draw');
            m.remove();
            openCodexModal(currentCodexDeck, currentCodexPage + 1);
          }
          return;
        }
        const cell = e.target.closest('[data-inspect-card]');
        if (cell) {
          const cardId = cell.dataset.inspectCard;
          const targetCard = allCards.find(c => c.id === cardId);
          if (targetCard) {
            showCardFullModal(targetCard);
          }
          return;
        }
        if (e.target.closest('#btnCodexClose') || e.target === m) {
          m.remove();
        }
      };
    }

    function openMissionsModal() {
      const html = 
        '<div style="display:flex;flex-direction:column;gap:10px">' +
          '<div style="padding:12px;background:#fff;border:2px solid #2b1f1d;border-radius:8px;display:flex;justify-content:space-between;align-items:center">' +
            '<div><div style="font-weight:800;font-size:0.9rem">ดวลชนะบอท 1 ครั้ง</div><div style="font-size:0.75rem;color:#64748b">ความคืบหน้า: 1/1 (สำเร็จ)</div></div>' +
            '<button class="wf-gacha-btn gold-btn" id="btnClaim1" style="display:inline-flex;align-items:center;gap:4px">รับ ' + CG.ui.note20Html('mini') + ' × 5</button>' +
          '</div>' +
          '<div style="padding:12px;background:#fff;border:2px solid #2b1f1d;border-radius:8px;display:flex;justify-content:space-between;align-items:center">' +
            '<div><div style="font-weight:800;font-size:0.9rem">อัญเชิญฟิวชั่น Resonance 2 ครั้ง</div><div style="font-size:0.75rem;color:#64748b">ความคืบหน้า: 1/2</div></div>' +
            '<span style="font-size:0.75rem;color:#15803d;font-weight:800;display:inline-flex;align-items:center;gap:4px">รางวัล ' + CG.ui.note20Html('mini') + ' × 10</span>' +
          '</div>' +
          '<div style="padding:12px;background:#fff;border:2px solid #2b1f1d;border-radius:8px;display:flex;justify-content:space-between;align-items:center">' +
            '<div><div style="font-weight:800;font-size:0.9rem">สร้างดาเมจเกิน 3,000 ในเทิร์นเดียว</div><div style="font-size:0.75rem;color:#64748b">ความคืบหน้า: 0/1</div></div>' +
            '<span style="font-size:0.75rem;color:#b91c1c;font-weight:800;display:inline-flex;align-items:center;gap:4px">รางวัล ' + CG.ui.note100Html('mini') + ' × 1</span>' +
          '</div>' +
        '</div>';
      const m = showWfModal('📜 ภารกิจและรางวัล (Daily Quests)', html);
      if (m) m.onclick = (e) => {
        if (e.target.closest('#btnClaim1')) {
          CG.ui.curr20 += 5;
          Account.save();
          const v20 = $('valCurr20'); if (v20) v20.textContent = CG.ui.curr20;
          AudioFX.play('chime');
          toast('🎉 ได้รับรางวัล แบงก์ 20 จำนวน 5 ใบ เรียบร้อย!');
          e.target.textContent = 'รับแล้ว ✓';
          e.target.disabled = true;
          e.target.style.opacity = '0.5';
        } else if (e.target.closest('#btnModalClose') || e.target === m) {
          m.remove();
        }
      };
    }

    function openTrialsModal() {
      const html = 
        '<div style="display:flex;flex-direction:column;gap:10px">' +
          '<div style="padding:12px;background:#fff;border:2px solid #2b1f1d;border-radius:8px;display:flex;justify-content:space-between;align-items:center">' +
            '<div><div style="font-weight:800;font-size:0.9rem">บทที่ 1: กฎการอัญเชิญและการสังเวย</div><div style="font-size:0.75rem;color:#64748b">เรียนรู้การลงมอนสเตอร์ปกติและการ Tribute</div></div>' +
            '<button class="wf-gacha-btn" id="btnTry1">เริ่มทดสอบ ▶</button>' +
          '</div>' +
          '<div style="padding:12px;background:#fff;border:2px solid #2b1f1d;border-radius:8px;display:flex;justify-content:space-between;align-items:center">' +
            '<div><div style="font-weight:800;font-size:0.9rem">บทที่ 2: ระบบรวมร่าง Resonance Fusion</div><div style="font-size:0.75rem;color:#64748b">ทดลองรวมร่างมอนสเตอร์ Extra Deck</div></div>' +
            '<button class="wf-gacha-btn" id="btnTry2">เริ่มทดสอบ ▶</button>' +
          '</div>' +
          '<div style="padding:12px;background:#fff;border:2px solid #2b1f1d;border-radius:8px;display:flex;justify-content:space-between;align-items:center">' +
            '<div><div style="font-weight:800;font-size:0.9rem">บทที่ 3: ปริศนา 1 เทิร์นปิดเกม (Lethal)</div><div style="font-size:0.75rem;color:#64748b">คิดคำนวณ Damage เพื่อชนะในเทิร์นเดียว</div></div>' +
            '<button class="wf-gacha-btn gold-btn" id="btnTry3">เริ่มทดสอบ ▶</button>' +
          '</div>' +
        '</div>';
      const m = showWfModal('🎯 แบบทดสอบและโหมดฝึกสอน (Trials)', html);
      if (m) m.onclick = (e) => {
        if (e.target.closest('#btnTry1') || e.target.closest('#btnTry2') || e.target.closest('#btnTry3')) {
          m.remove();
          mode = 'bot';
          start();
        } else if (e.target.closest('#btnModalClose') || e.target === m) {
          m.remove();
        }
      };
    }

    // Modal: เพิ่มเพื่อน
    function openFriendModal() {
      const myId = (Account.current && Account.current.id) ? Account.current.id : 'AF-88294';
      const html =
        '<div style="text-align:center;margin-bottom:16px">' +
          '<div style="font-size:2rem;margin-bottom:4px">👥</div>' +
          '<h3 style="margin:0;font-size:1.25rem;font-weight:900">เพิ่มเพื่อน & ค้นหานักดวล</h3>' +
          '<div style="font-size:0.85rem;color:#64748b;margin-top:4px">แชร์ ID ของคุณหรือค้นหาเพื่อนเพื่อท้าดวลการ์ด</div>' +
        '</div>' +
        '<div style="background:#fff;border:2.5px solid #2b1f1d;border-radius:10px;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;box-shadow:2px 3px 0 #2b1f1d">' +
          '<div>' +
            '<div style="font-size:0.75rem;color:#64748b;font-weight:700">ID ประจำตัวของคุณ:</div>' +
            '<div style="font-size:1.2rem;font-weight:900;color:#1e293b;letter-spacing:1px">' + V().esc(myId) + '</div>' +
          '</div>' +
          '<button id="btnCopyMyId" style="background:#fef08a;border:2px solid #2b1f1d;padding:6px 14px;border-radius:6px;font-weight:900;font-size:0.85rem;cursor:pointer;box-shadow:1.5px 2px 0 #2b1f1d">📋 คัดลอก ID</button>' +
        '</div>' +
        '<div style="display:flex;gap:8px;margin-bottom:16px">' +
          '<input type="text" id="inputFriendId" placeholder="พิมพ์ ID เพื่อน เช่น AF-12345" style="flex:1;padding:8px 12px;border:2px solid #2b1f1d;border-radius:8px;font-size:0.9rem;font-weight:700" />' +
          '<button id="btnSearchFriend" class="gold" style="padding:8px 16px;font-weight:900;font-size:0.9rem">🔍 ค้นหา</button>' +
        '</div>' +
        '<div style="font-weight:800;font-size:0.9rem;margin-bottom:8px">รายชื่อเพื่อน:</div>' +
        '<div style="display:flex;flex-direction:column;gap:8px;max-height:190px;overflow-y:auto">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;background:#fff;border:1.5px solid #e2e8f0;padding:8px 12px;border-radius:8px">' +
            '<div style="display:flex;align-items:center;gap:10px"><span style="font-size:1.4rem">🦖</span><div><div style="font-weight:800;font-size:0.9rem">ไดโนมาสเตอร์</div><div style="font-size:0.72rem;color:#15803d;font-weight:700">🟢 ออนไลน์ (พร้อมดวล)</div></div></div>' +
            '<button class="btn-friend-duel" style="background:#dbeafe;border:1.5px solid #1e3a5f;padding:4px 10px;border-radius:6px;font-weight:800;font-size:0.78rem;cursor:pointer">⚔️ ชวนดวล</button>' +
          '</div>' +
          '<div style="display:flex;justify-content:space-between;align-items:center;background:#fff;border:1.5px solid #e2e8f0;padding:8px 12px;border-radius:8px">' +
            '<div style="display:flex;align-items:center;gap:10px"><span style="font-size:1.4rem">🦅</span><div><div style="font-weight:800;font-size:0.9rem">ผู้พิทักษ์แห่งโรม</div><div style="font-size:0.72rem;color:#b45309;font-weight:700">⚔️ กำลังดวลการ์ด</div></div></div>' +
            '<button disabled style="background:#f1f5f9;border:1.5px solid #cbd5e1;padding:4px 10px;border-radius:6px;font-size:0.78rem;color:#94a3b8">ไม่ว่าง</button>' +
          '</div>' +
          '<div style="display:flex;justify-content:space-between;align-items:center;background:#fff;border:1.5px solid #e2e8f0;padding:8px 12px;border-radius:8px">' +
            '<div style="display:flex;align-items:center;gap:10px"><span style="font-size:1.4rem">🤖</span><div><div style="font-weight:800;font-size:0.9rem">ไซเบอร์เร็กซ์</div><div style="font-size:0.72rem;color:#64748b;font-weight:700">⚫ ออฟไลน์ 3 ชม. ที่แล้ว</div></div></div>' +
            '<button class="btn-friend-duel" style="background:#f1f5f9;border:1.5px solid #cbd5e1;padding:4px 10px;border-radius:6px;font-weight:800;font-size:0.78rem;cursor:pointer">✉️ ทัก</button>' +
          '</div>' +
        '</div>';
      const m = showWfModal('👥 ช่องเพิ่มเพื่อน & ค้นหานักดวล', html);
      if (m) {
        m.onclick = (e) => {
          if (e.target.closest('#btnCopyMyId')) {
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(myId);
            toast('คัดลอก ID: ' + myId + ' เรียบร้อยแล้ว!');
            AudioFX.play('chime');
            return;
          }
          if (e.target.closest('#btnSearchFriend')) {
            toast('ส่งคำขอเป็นเพื่อนเรียบร้อย!');
            AudioFX.play('click');
            return;
          }
          if (e.target.closest('.btn-friend-duel')) {
            m.remove();
            openPvpModal();
            return;
          }
          if (e.target.closest('#btnModalClose') || e.target === m) m.remove();
        };
      }
    }

    // Modal: ที่แจ้งประกาศ
    function openNoticeModal() {
      const listHtml = newsItems.map((item) => (
        '<div style="background:#fff;border:2px solid #2b1f1d;border-radius:10px;padding:12px 14px;box-shadow:2px 3px 0 #2b1f1d">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">' +
            '<span style="background:#fef08a;border:1.5px solid #2b1f1d;padding:2px 8px;border-radius:4px;font-size:0.75rem;font-weight:900;color:#1e293b">' + V().esc(item.tag) + '</span>' +
            '<span style="font-size:0.75rem;color:#64748b;font-weight:700">อัปเดตล่าสุด</span>' +
          '</div>' +
          '<div style="font-weight:900;font-size:1.05rem;color:#1e293b;margin-bottom:4px">' + V().esc(item.title) + '</div>' +
          '<div style="font-size:0.85rem;color:#475569;line-height:1.45">' + V().esc(item.desc) + '</div>' +
        '</div>'
      )).join('');
      const html = 
        '<div style="display:flex;flex-direction:column;gap:10px;max-height:60vh;overflow-y:auto;padding-right:4px">' +
          listHtml +
        '</div>';
      const m = showWfModal('📢 ที่แจ้งประกาศ & ข่าวสารกิจกรรม', html);
      if (m) m.onclick = (e) => { if (e.target.closest('#btnModalClose') || e.target === m) m.remove(); };
    }

    // Modal: กล่องจดหมาย
    function openMailModal() {
      const claimed = CG.ui.mailClaimed;
      const html = 
        '<div style="margin-bottom:14px;display:flex;justify-content:space-between;align-items:center">' +
          '<div style="font-size:0.9rem;color:#64748b;font-weight:700">จดหมายทั้งหมด 2 ฉบับ</div>' +
          (!claimed ? '<button id="btnClaimAllMail" class="gold" style="padding:6px 14px;font-weight:900;font-size:0.85rem">🎁 รับรางวัลทั้งหมด</button>' : '<span style="font-size:0.85rem;color:#15803d;font-weight:800">✅ รับรางวัลครบแล้ว</span>') +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:10px;max-height:55vh;overflow-y:auto">' +
          '<div style="background:#fff;border:2px solid #2b1f1d;border-radius:10px;padding:12px 14px;box-shadow:2px 3px 0 #2b1f1d">' +
            '<div style="display:flex;justify-content:space-between;margin-bottom:4px">' +
              '<span style="font-weight:900;font-size:0.98rem;color:#1e293b">🎁 ยินดีต้อนรับนักดวลหน้าใหม่</span>' +
              '<span style="font-size:0.75rem;color:#64748b">ระบบ</span>' +
            '</div>' +
            '<div style="font-size:0.85rem;color:#475569;margin-bottom:8px">ของขวัญเริ่มต้นการเดินทางสู่ Arcana Frontier มอบ แบงก์ 20 จำนวน 100 ใบ</div>' +
            '<div style="display:flex;align-items:center;gap:6px">' +
              '<span style="font-weight:800;font-size:0.82rem;color:#15803d">รางวัล: 💵 +100 แบงก์ 20</span>' +
            '</div>' +
          '</div>' +
          '<div style="background:#fff;border:2px solid #2b1f1d;border-radius:10px;padding:12px 14px;box-shadow:2px 3px 0 #2b1f1d">' +
            '<div style="display:flex;justify-content:space-between;margin-bottom:4px">' +
              '<span style="font-weight:900;font-size:0.98rem;color:#1e293b">🛠️ ฉลองอัปเดตระบบ v1.2</span>' +
              '<span style="font-size:0.75rem;color:#64748b">ทีมผู้พัฒนา</span>' +
            '</div>' +
            '<div style="font-size:0.85rem;color:#475569;margin-bottom:8px">ขอบคุณที่ร่วมทดสอบเด็คและส่งฟีดแบ็ก มอบ แบงก์ 100 จำนวน 2 ใบ</div>' +
            '<div style="display:flex;align-items:center;gap:6px">' +
              '<span style="font-weight:800;font-size:0.82rem;color:#b91c1c">รางวัล: 💴 +2 แบงก์ 100</span>' +
            '</div>' +
          '</div>' +
        '</div>';
      const m = showWfModal('✉️ กล่องจดหมาย (Mailbox)', html);
      if (m) {
        m.onclick = (e) => {
          if (e.target.closest('#btnClaimAllMail')) {
            CG.ui.mailClaimed = true;
            CG.ui.curr20 = (CG.ui.curr20 || 340) + 100;
            CG.ui.curr100 = (CG.ui.curr100 || 5) + 2;
            Account.save();
            const el20 = $('valCurr20'), el100 = $('valCurr100');
            if (el20) el20.textContent = CG.ui.curr20;
            if (el100) el100.textContent = CG.ui.curr100;
            const badge = document.querySelector('.wf-mail-badge');
            if (badge) badge.style.display = 'none';
            AudioFX.play('chime');
            toast('รับของขวัญเรียบร้อย! (+100 แบงก์ 20, +2 แบงก์ 100)');
            m.remove();
            return;
          }
          if (e.target.closest('#btnModalClose') || e.target === m) m.remove();
        };
      }
    }

    // รายการเด็คในร้านค้า
    const shopPacks = [
      { key: 'luna_guardians', name: 'LUNA ผู้พิทักษ์จันทรา' },
      { key: 'mecha_strike', name: 'เมก้าสไตรก์' },
      { key: 'mecha_scrap', name: 'เมก้าสแครป' },
      { key: 'dinosaur', name: 'ไดโนเสาร์' },
      { key: 'aquila', name: 'กองทัพโรมัน' }
    ];
    let shopPackIdx = 0;

    // RENDER LOBBY
    $('lobby').innerHTML = '<div class="grimoire-lobby">' +
      '<div class="wf-lobby-stage">' +
        // TOP ROW: Profile on left, Action buttons & Currencies on right
        '<div class="wf-top-row">' +
          // PROFILE BOX (บนซ้าย)
          '<div style="display:flex;align-items:center;gap:8px">' +
            '<div class="wf-profile-box" id="btnProfile" title="แตะเพื่อดูสถิติและโปรไฟล์">' +
              '<div class="wf-avatar-circle">' +
                '<span>👤</span>' +
                '<small>Lv.' + ((Account.current && Account.current.level) || 1) + '</small>' +
              '</div>' +
              '<div class="wf-profile-meta">' +
                '<div class="wf-profile-name">' + V().esc((Account.current && Account.current.nickname) || 'ผู้ท้าชิงนิรนาม') + '</div>' +
                '<div class="wf-profile-id">ID: ' + V().esc((Account.current && Account.current.id) || 'AF-88294') + '</div>' +
                '<div style="font-size:0.65rem;color:#b45309;font-weight:800;margin-top:1px">แตะดู PIN / ล็อกอิน 🔑</div>' +
              '</div>' +
            '</div>' +
            '<button class="wf-top-btn wf-btn-login" id="btnTopLogin" title="เข้าสู่ระบบด้วยไอดีเดิม หรือสลับบัญชี">' +
              '<span>🔐</span>' +
              '<span>เข้าสู่ระบบ</span>' +
            '</button>' +
          '</div>' +

          // TOP ACTIONS & CURRENCIES (บนขวา)
          '<div class="wf-top-actions">' +
            '<button class="wf-top-btn wf-btn-friend" id="btnTopFriend" title="ช่องเพิ่มเพื่อน">' +
              '<span>👥</span>' +
              '<span>ช่องเพิ่มเพื่อน</span>' +
            '</button>' +
            '<button class="wf-top-btn wf-btn-notice" id="btnTopNotice" title="ที่แจ้งประกาศ">' +
              '<span>📢</span>' +
              '<span>ที่แจ้งประกาศ</span>' +
            '</button>' +
            '<button class="wf-top-btn wf-btn-mail" id="btnTopMail" title="กล่องจดหมาย">' +
              '<span>✉️</span>' +
              '<span>กล่องจดหมาย</span>' +
              (!CG.ui.mailClaimed ? '<span class="wf-mail-badge">2</span>' : '') +
            '</button>' +
            '<div class="wf-curr-badge wf-curr-green" id="btnCurrGreen" title="แบงก์ 20: ได้จากการเล่น ใช้สุ่มการ์ด">' +
              CG.ui.note20Html() + '<span class="curr-val" id="valCurr20">' + CG.ui.curr20 + '</span>' +
            '</div>' +
            '<div class="wf-curr-badge wf-curr-red" id="btnCurrRed" title="แบงก์ 100: ได้จากภารกิจหรือเติมเงิน">' +
              CG.ui.note100Html() + '<span class="curr-val" id="valCurr100">' + CG.ui.curr100 + '</span>' +
            '</div>' +
            '<button class="wf-sound-btn mini" id="btnLobbySound" title="เปิด/ปิดเสียง">' +
              (AudioFX.isEnabled() ? '🔊' : '🔇') +
            '</button>' +
          '</div>' +
        '</div>' +

        // MIDDLE ROW: Pinned Poster on left, Shop Banner on right
        '<div class="wf-mid-area">' +
          // PINNED POSTER (รูปภาพพร้อมหมุดสีแดงปักบนกระดาษด้านซ้าย)
          '<div class="wf-pinned-poster" id="newsBillboard" title="แตะเพื่อดูรายละเอียด">' +
            '<div class="wf-pin-head">📌</div>' +
            '<div class="wf-poster-frame">' +
              '<img src="assets/promo/mecha_strike_promo.jpg" alt="Promo" class="wf-poster-img" />' +
              '<div class="wf-poster-badge">🔥 เมก้าสไตรก์ จุติแล้ว!</div>' +
            '</div>' +
          '</div>' +

          // SHOP BANNER (กล่องร้านค้าขนาดใหญ่ ⬅️ ร้านค้า ➡️ ด้านขวาบน/กลาง)
          '<div class="wf-shop-banner" id="btnShop" title="เปิดร้านค้ากาชาการ์ด">' +
            '<button class="wf-shop-arrow" id="btnShopPrev" title="เด็คก่อนหน้า">◀</button>' +
            '<div class="wf-shop-center">' +
              '<div class="wf-shop-title">🏪 ร้านค้า</div>' +
              '<div class="wf-shop-subtitle">ซองการ์ด: <span id="wfShopDeckName">' + shopPacks[shopPackIdx].name + '</span></div>' +
            '</div>' +
            '<button class="wf-shop-arrow" id="btnShopNext" title="เด็คถัดไป">▶</button>' +
          '</div>' +
        '</div>' +

        // BOTTOM ROW: 4 Nav Buttons (Left/Center) + Play Buttons (Right)
        '<div class="wf-bottom-row">' +
          // 4 NAV BUTTONS HORIZONTAL
          '<div class="wf-nav-horizontal">' +
            '<button class="wf-nav-btn wf-pill-btn" id="btnNavTrials" title="แบบทดสอบ">' +
              '<img class="pill-icon" src="assets/icons/icon_3_trials.png" alt="" />' +
              '<span>แบบทดสอบ</span>' +
            '</button>' +
            '<button class="wf-nav-btn wf-pill-btn" id="btnNavMissions" title="ภารกิจ">' +
              '<img class="pill-icon" src="assets/icons/icon_2_missions.png" alt="" />' +
              '<span>ภารกิจ</span>' +
            '</button>' +
            '<button class="wf-nav-btn wf-pill-btn" id="btnNavCodex" title="คลังการ์ด">' +
              '<img class="pill-icon" src="assets/icons/icon_1_codex.png" alt="" />' +
              '<span>คลังการ์ด</span>' +
            '</button>' +
            '<button class="wf-nav-btn wf-pill-btn" id="btnNavDeck" title="จัดเด็ค">' +
              '<img class="pill-icon" src="assets/icons/icon_0_deck.png" alt="" />' +
              '<span>จัดเด็ค</span>' +
            '</button>' +
          '</div>' +

          // PLAY BUTTONS (BOTTOM RIGHT: เล่นกับบอทด้านบน, เริ่มเกม ออนไลน์ ด้านล่าง)
          '<div class="wf-play-group">' +
            '<button class="wf-btn-bot wf-pill-btn" id="btnPlayBot" title="เล่นกับบอท เลือกระดับความยากได้">' +
              '<img class="pill-icon" src="assets/icons/icon_4_bot.png" alt="" />' +
              '<span>เล่นกับบอท</span>' +
            '</button>' +
            '<button class="wf-start-hero-btn" id="btnPlayPvp" title="เล่นกับคนออนไลน์ หรือสร้างห้องกับเพื่อน">' +
              '<img class="hero-icon" src="assets/icons/icon_5_pvp.png" alt="" />' +
              '<div class="wf-start-text-col">' +
                '<span class="wf-start-main">เริ่มเกม</span>' +
                '<span class="wf-start-sub">ออนไลน์</span>' +
              '</div>' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';

    $('lobby').onclick = (e) => {
      if (e.target.closest('#btnShopPrev')) {
        shopPackIdx = (shopPackIdx - 1 + shopPacks.length) % shopPacks.length;
        const el = $('wfShopDeckName');
        if (el) el.textContent = shopPacks[shopPackIdx].name;
        AudioFX.play('click');
        return;
      }
      if (e.target.closest('#btnShopNext')) {
        shopPackIdx = (shopPackIdx + 1) % shopPacks.length;
        const el = $('wfShopDeckName');
        if (el) el.textContent = shopPacks[shopPackIdx].name;
        AudioFX.play('click');
        return;
      }
      if (e.target.closest('#btnTopFriend')) { AudioFX.play('click'); openFriendModal(); return; }
      if (e.target.closest('#btnTopNotice')) { AudioFX.play('click'); openNoticeModal(); return; }
      if (e.target.closest('#btnTopMail')) { AudioFX.play('click'); openMailModal(); return; }
      if (e.target.closest('#btnCurrGreen') || e.target.closest('#btnCurrRed')) { AudioFX.play('click'); openShopModal(shopPacks[shopPackIdx].key); return; }
      if (e.target.closest('#newsBillboard')) {
        AudioFX.play('click');
        openNoticeModal();
        return;
      }
      if (e.target.closest('#btnLobbySound')) {
        const en = AudioFX.toggle();
        const btn = $('btnLobbySound');
        if (btn) btn.innerHTML = en ? '🔊' : '🔇';
        if (en) AudioFX.play('chime');
        return;
      }
      if (e.target.closest('#btnTopLogin')) { AudioFX.play('click'); openProfileModal('login'); return; }
      if (e.target.closest('#btnProfile')) { AudioFX.play('click'); openProfileModal('info'); return; }
      if (e.target.closest('#btnShop')) { openShopModal(shopPacks[shopPackIdx].key); return; }
      if (e.target.closest('#btnNavDeck')) {
        if (CG.ui.deckBuilder) CG.ui.deckBuilder.open(deckA, () => lobby());
        return;
      }
      if (e.target.closest('#btnNavCodex')) { openCodexModal(); return; }
      if (e.target.closest('#btnNavMissions')) { openMissionsModal(); return; }
      if (e.target.closest('#btnNavTrials')) { openTrialsModal(); return; }
      if (e.target.closest('#btnPlayBot')) { openBotModal(); return; }
      if (e.target.closest('#btnPlayPvp')) { openPvpModal(); return; }
    };
  }

  function start() {
    if (CG.ui.newsTimer) clearInterval(CG.ui.newsTimer);
    AudioFX.startBGM();
    endSoundPlayed = false;
    cleanupDragVisuals();
    seed = (Math.random() * 1e9) | 0;
    state = E().createGame({ deckA, deckB, seed, mode, config: { autoChoose: false, chainMode: true, interactiveFusion: true, interactiveChoice: true } });
    // หากผู้เล่นครอบครองการ์ด Secret Rare ลูน่า ให้เปลี่ยนการ์ด luna_leader ในเด็คเป็นการ์ด Secret Rare (alt-art)
    try {
      const owned = getOwnedCards();
      if (owned.has('luna_leader_rare') && state && state.players) {
        const p0 = state.players[0];
        if (p0) {
          ['deck', 'hand', 'grave'].forEach(z => {
            if (Array.isArray(p0[z])) {
              p0[z].forEach(c => {
                if (c && c.cardId === 'luna_leader') c.cardId = 'luna_leader_rare';
              });
            }
          });
        }
      }
    } catch (e) {}
    sel = null; handSel = new Set(); pendingSel = new Set(); evBuf = []; confirmedViewer = null;
    phaseMenuOpen = false;
    CG.ui.inspectCard = null;
    CG.ui.inspectPendingCard = null;
    CG.ui.timers.p0 = 0; CG.ui.timers.p1 = 0; CG.ui.timers.lastTick = Date.now();
    ensureTimer();
    botBusy = false; botBannerText = null; botBannerFade = false; cardHl = {}; ghosts = {};
    $('lobby').classList.add('hidden'); $('game').classList.remove('hidden');
    $('game').onclick = onClick;
    $('game').onmouseover = onHover;
    render(); schedule();
  }

  function onHover(e) {
    if (!state) return;
    const v = viewer();
    const card = e.target.closest('.card');
    if (card && card.dataset.uid) {
      const m = V().uidMap(state)[card.dataset.uid];
      if (m && (!m.faceDown || m.controller === v)) {
        CG.ui.lastInspectedInst = m;
        const insp = $('inspect');
        if (insp) insp.innerHTML = V().inspectHtml(m, v);
      }
    }
  }

  // ---------------- ใครต้องตัดสินใจ / ใครเป็นผู้ดู ----------------
  function actor() {                       // ผู้เล่นที่ต้องลงมือ (mulligan: คนแรกที่ยังไม่เสร็จ)
    if (state.phase === 'mulligan') { const i = state.players.findIndex(p => !p.flags.mulliganDone); return i < 0 ? 0 : i; }
    if (state.pending) return state.pending.player;
    return state.activeIdx;
  }
  function viewer() {
    if (mode === 'online') {
      return (CG.network && CG.network.playerIndex != null) ? CG.network.playerIndex : 0;
    }
    return mode === 'bot' ? 0 : actor();
  }
  function botToAct() {
    if (mode !== 'bot' || state.ended) return null;
    if (state.phase === 'mulligan') return state.players[1].flags.mulliganDone ? null : 1;
    return actor() === 1 ? 1 : null;
  }

  // ---------------- วาด ----------------
  function render() {
    if (!state) return;
    if (!state.ended) {
      AudioFX.setTension(state.players.some(p => p.lp <= 2500));
    } else {
      AudioFX.stopBGM();
    }
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
    if (CG.ui.lastInspectedInst && $('inspect')) {
      $('inspect').innerHTML = V().inspectHtml(CG.ui.lastInspectedInst, v);
    }
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
  function spawnFloatingNumber(anchorEl, delta) {
    if (!anchorEl || typeof document === 'undefined') return;
    try {
      const isHeal = delta > 0;
      const numEl = document.createElement('div');
      numEl.className = 'floating-stat-num ' + (isHeal ? 'heal' : 'damage');
      numEl.textContent = (isHeal ? '+' : '') + delta;

      const rect = anchorEl.getBoundingClientRect();
      numEl.style.left = (rect.left + rect.width / 2) + 'px';
      numEl.style.top = (rect.top + rect.height / 2) + 'px';

      document.body.appendChild(numEl);
      setTimeout(() => {
        if (numEl.parentNode) numEl.parentNode.removeChild(numEl);
      }, 1000);
    } catch (_) {}
  }

  function spawnCombatSlash(targetEl, isDirect) {
    if (!targetEl || typeof document === 'undefined') return;
    try {
      const rect = targetEl.getBoundingClientRect();
      const slash = document.createElement('div');
      slash.className = 'combat-slash-vfx' + (isDirect ? ' direct' : '');
      slash.style.left = (rect.left + rect.width / 2) + 'px';
      slash.style.top = (rect.top + rect.height / 2) + 'px';

      document.body.appendChild(slash);
      setTimeout(() => {
        if (slash.parentNode) slash.parentNode.removeChild(slash);
      }, 1000);
    } catch (_) {}
  }

  function spawnCardShatter(cardEl) {
    if (!cardEl || typeof document === 'undefined') return;
    try {
      const rect = cardEl.getBoundingClientRect();
      const shatter = document.createElement('div');
      shatter.className = 'card-shatter-burst';
      shatter.style.left = (rect.left + rect.width / 2) + 'px';
      shatter.style.top = (rect.top + rect.height / 2) + 'px';

      document.body.appendChild(shatter);
      setTimeout(() => {
        if (shatter.parentNode) shatter.parentNode.removeChild(shatter);
      }, 1000);
    } catch (_) {}
  }

  function spawnSummonImpact(slotEl, glowColor) {
    if (!slotEl || typeof document === 'undefined') return;
    try {
      const ring = document.createElement('div');
      ring.className = 'summon-shockwave' + (glowColor === 'gold' ? ' gold' : '');
      slotEl.appendChild(ring);
      setTimeout(() => { if (ring.parentNode) ring.parentNode.removeChild(ring); }, 1300);
    } catch (_) {}
  }

  function spawnTurnBanner(type, turnNum) {
    if (typeof document === 'undefined') return;
    try {
      const boardEl = document.querySelector('.board') || document.body;
      const old = document.querySelector('.cinematic-banner-overlay');
      if (old && old.parentNode) old.parentNode.removeChild(old);

      const isMe = type === 'YOUR_TURN';
      const isBattle = type === 'BATTLE';
      const cls = isBattle ? 'phase-battle' : (isMe ? 'turn-me' : 'turn-opp');
      const title = isBattle ? '⚔️ BATTLE PHASE' : (isMe ? '⚔️ YOUR TURN' : '🤖 OPPONENT\'S TURN');
      const sub = isBattle ? 'เข้าสู่ช่วงต่อสู้' : (isMe ? '── เทิร์นของคุณ ──' : '── เทิร์นของฝ่ายตรงข้าม ──');

      const banner = document.createElement('div');
      banner.className = 'cinematic-banner-overlay';
      banner.innerHTML = '<div class="cinematic-banner-box ' + cls + '">' +
        '<div class="cb-title">' + title + '</div>' +
        '<div class="cb-sub">' + sub + '</div>' +
      '</div>';

      boardEl.appendChild(banner);
      setTimeout(() => { if (banner.parentNode) banner.parentNode.removeChild(banner); }, 1850);
    } catch (_) {}
  }

  function triggerScreenShake() {
    if (typeof document === 'undefined') return;
    try {
      const boardEl = document.querySelector('.board');
      if (!boardEl) return;
      boardEl.classList.remove('screen-shake');
      void boardEl.offsetWidth;
      boardEl.classList.add('screen-shake');
      setTimeout(() => { boardEl.classList.remove('screen-shake'); }, 550);
    } catch (_) {}
  }

  function animate(v) {
    if (typeof document === 'undefined') { evBuf = []; return; }
    evBuf.forEach(ev => {
      if (ev.type === 'draw') AudioFX.play('draw');
      if (ev.type === 'turnStart') {
        spawnTurnBanner(ev.player === v ? 'YOUR_TURN' : 'OPP_TURN', ev.turn || (state && state.turn));
      }
      if (ev.type === 'phaseChange') {
        AudioFX.play('phase');
        if (ev.phase === 'battle') {
          spawnTurnBanner('BATTLE');
        }
      }
      if (ev.type === 'summon') {
        const isSet = ev.how === 'set';
        if (isSet) {
          AudioFX.play('flip');
          const targetCard = document.querySelector('.slot[data-p="' + ev.player + '"][data-slot="' + ev.slot + '"] .card');
          if (targetCard) targetCard.classList.add('set-anim');
        } else {
          if (ev.how === 'tribute' || (ev.materials && ev.materials.length > 0)) AudioFX.play('tribute');
          else AudioFX.play('summon');

          const targetCard = document.querySelector('.card[data-uid="' + ev.uid + '"]') ||
                             document.querySelector('.slot[data-p="' + ev.player + '"][data-slot="' + ev.slot + '"] .card');
          if (targetCard) targetCard.classList.add('summon-anim');

          const slotEl = document.querySelector('.slot[data-p="' + ev.player + '"][data-slot="' + ev.slot + '"]');
          if (slotEl) spawnSummonImpact(slotEl, ev.how === 'tribute' ? 'gold' : 'cyan');
        }
      }
      if (ev.type === 'setSpell') {
        AudioFX.play('card_drop');
        const targetCard = document.querySelector('[data-spell-slot="' + ev.slot + '"][data-p="' + ev.player + '"] .card');
        if (targetCard) targetCard.classList.add('set-anim');
      }
      if (ev.type === 'positionChange') AudioFX.play('flip');
      if (ev.type === 'attackDeclared') {
        AudioFX.play('attack');
        const atkEl = document.querySelector('.card[data-p="' + ev.player + '"][data-slot="' + ev.from + '"]');
        if (atkEl) {
          atkEl.classList.add(ev.player === v ? 'lunge-up' : 'lunge-down');
        }

        if (ev.to !== null && ev.to !== undefined) {
          const targetEl = document.querySelector('.card[data-p="' + (1 - ev.player) + '"][data-slot="' + ev.to + '"]') ||
                           document.querySelector('.slot[data-p="' + (1 - ev.player) + '"][data-slot="' + ev.to + '"]');
          if (targetEl) spawnCombatSlash(targetEl, false);
        } else {
          const targetEl = document.querySelector('[data-lp="' + (1 - ev.player) + '"]');
          if (targetEl) spawnCombatSlash(targetEl, true);
        }
      }
      if (ev.type === 'destroy') {
        AudioFX.play('destroy');
        if (ev.uid) {
          const destroyedEl = document.querySelector('.card[data-uid="' + ev.uid + '"]');
          if (destroyedEl) spawnCardShatter(destroyedEl);
        }
      }
      if (ev.type === 'lpChange') {
        AudioFX.play('lp');
        const el = document.querySelector('[data-lp="' + ev.player + '"]');
        if (el) {
          el.classList.add('pulse');
          if (ev.delta !== 0 && ev.delta !== undefined) {
            spawnFloatingNumber(el, ev.delta);
          }
        }
        if (ev.delta && ev.delta <= -800) {
          triggerScreenShake();
        }
      }
      if (ev.type === 'chainAdd') AudioFX.play('spell');
    });
    evBuf = [];
  }

  // ---------------- overlay: mulligan / ทิ้งมือ / pending / Chain / ส่งเครื่อง / จบเกม ----------------
  function buildCinematicGameOver(st, v) {
    const a = S().app;
    const isDraw = st.winner === 'draw';
    const isWin = !isDraw && (st.winner === v);
    const winnerName = isDraw ? a.drawGame : V().pname(st, st.winner);
    const endEvent = st.log.slice().reverse().find(e => e.type === 'gameEnd') || {};
    const reasonKey = endEvent.reason || '';
    const reasonText = S().endReason[reasonKey] || (reasonKey === 'lp' ? 'LP ของอีกฝ่ายลดลงจนเหลือ 0' : reasonKey);

    const totalTurns = st.turn || 1;
    let maxDamage = 0;
    let cardsDestroyed = 0;
    st.log.forEach(ev => {
      if (ev.type === 'lpChange' && ev.delta < 0) {
        const dmg = Math.abs(ev.delta);
        if (dmg > maxDamage) maxDamage = dmg;
      }
      if (ev.type === 'destroy') {
        cardsDestroyed++;
      }
    });

    const winnerLp = !isDraw && st.players[st.winner] ? st.players[st.winner].lp : 0;

    const bannerClass = isDraw ? 'draw-banner' : (isWin ? 'victory-banner' : 'defeat-banner');
    const titleText = isDraw ? 'DRAW DUEL' : (isWin ? 'VICTORY' : 'DEFEAT');
    const subtitleText = isDraw ? 'ผลการดวล: เสมอกันอย่างสมศักดิ์ศรี' :
      (isWin ? ('ผู้ชนะ: ' + V().esc(winnerName) + ' • ชัยชนะอันยิ่งใหญ่แห่งดวงดาว!') :
               ('พ่ายแพ้การต่อสู้ • พยายามอีกครั้งในศึกต่อไป!'));
    const emblemIcon = isDraw ? '⚖️' : (isWin ? '👑' : '💀');

    return '<div class="overlay cinematic-end-overlay">' +
      '<div class="cinematic-backdrop-rays ' + bannerClass + '"></div>' +
      '<div class="modal cinematic-end-modal ' + bannerClass + '">' +
        '<div class="cinematic-emblem-wrap">' +
          '<div class="cinematic-emblem-glow"></div>' +
          '<div class="cinematic-emblem">' + emblemIcon + '</div>' +
        '</div>' +
        '<h1 class="cinematic-title">' + titleText + '</h1>' +
        '<div class="cinematic-subtitle">' + subtitleText + '</div>' +
        (reasonText ? '<div class="cinematic-reason-pill">🎯 ' + V().esc(reasonText) + '</div>' : '') +

        '<div class="match-stats-grid">' +
          '<div class="stat-badge">' +
            '<div class="sb-label">⏱️ เทิร์นที่ใช้</div>' +
            '<div class="sb-val">' + totalTurns + ' <small>เทิร์น</small></div>' +
          '</div>' +
          '<div class="stat-badge">' +
            '<div class="sb-label">💥 ดาเมจสูงสุด</div>' +
            '<div class="sb-val damage-val">' + maxDamage.toLocaleString() + ' <small>DMG</small></div>' +
          '</div>' +
          '<div class="stat-badge">' +
            '<div class="sb-label">⚔️ การ์ดที่ทำลาย</div>' +
            '<div class="sb-val">' + cardsDestroyed + ' <small>ใบ</small></div>' +
          '</div>' +
          '<div class="stat-badge">' +
            '<div class="sb-label">🛡️ LP ที่เหลือ</div>' +
            '<div class="sb-val lp-val">' + winnerLp.toLocaleString() + ' <small>LP</small></div>' +
          '</div>' +
        '</div>' +

        '<div class="cinematic-action-row">' +
          '<button class="gold btn-duel-again" data-ov="again">🔁 ' + a.playAgain + '</button>' +
          '<button class="btn-lobby-return" data-ov="menu">↩ ' + a.back + '</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function overlays(v) {
    const root = $('overlayRoot'), a = S().app, st = state; let h = '';
    const p = st.players[v];
    const handCards = () => '<div class="handrow">' + p.hand.map((c, i) => V().cardHtml(c, { reveal: true, sel: handSel.has(c.uid), attrs: ' data-pick="' + c.uid + '" data-hand="' + i + '"' })).join('') + '</div>';
    if (st.ended) {
      if (!endSoundPlayed) {
        endSoundPlayed = true;
        if (st.winner === v) AudioFX.play('fanfare');
        else if (st.winner !== 'draw') AudioFX.play('defeat');
        try { Account.recordMatchResult(st, v); } catch (_) {}
      }
      h = buildCinematicGameOver(st, v);
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
    if (CG.ui.inspectPendingCard) {
      h += V().cardDetailModal(st, v, CG.ui.inspectPendingCard, true, null, E().getLegalActions(st, v));
    }
    if (CG.ui.inspectCard && st.phase === 'mulligan') {
      h += V().cardDetailModal(st, v, CG.ui.inspectCard.inst, CG.ui.inspectCard.isOpponent, null, E().getLegalActions(st, v));
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
    const uidMap = V().uidMap(st);

    // 1. เหนือปุ่มทั้งหมดแสดงการ์ดที่เพิ่งถูกใช้ (จาก state.chain ล่าสุด) พร้อมปุ่ม "อ่านเอฟเฟกต์"
    let triggerCardHtml = '';
    const lastLink = (st.chain && st.chain.length > 0) ? st.chain[st.chain.length - 1] : null;
    if (lastLink) {
      const def = E().findCard(lastLink.cardId);
      const inst = (lastLink.uid && uidMap[lastLink.uid]) || {
        uid: lastLink.uid,
        cardId: lastLink.cardId,
        baseAtk: def ? def.atk : 0,
        baseDef: def ? def.def : 0,
        level: def ? def.level : 1,
        faceDown: false
      };
      const cardFace = V().cardHtml(inst, { reveal: true, field: false });
      const cname = def ? def.name : lastLink.cardId;
      triggerCardHtml = '<div class="chain-trigger-card-box">' +
        '<div class="chain-trigger-title">⚡ การ์ดที่เพิ่งถูกใช้ (Chain Link ' + lastLink.linkId + ')</div>' +
        '<div class="chain-trigger-content">' +
          '<div class="chain-card-wrap">' + cardFace + '</div>' +
          '<div class="chain-trigger-meta">' +
            '<div class="chain-trigger-name">' + V().esc(cname) + '</div>' +
            '<button class="btn-read-eff" data-ov="inspectChainLast" title="อ่านรายละเอียดเอฟเฟกต์">📖 อ่านเอฟเฟกต์</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    }

    // 2. ตัวเลือกตอบโต้แต่ละอัน (จาก pending.options / getLegalActions) แสดงหน้าการ์ดของการ์ดที่จะใช้
    const legal = E().getLegalActions(st, v);
    const responses = legal.filter(x => x.type === 'activateResponse');
    const p = st.players[v];

    let responseCards = '';
    for (let i = 0; i < responses.length; i++) {
      const r = responses[i];
      let cardInst = null;
      if (r.handIdx !== undefined && p.hand[r.handIdx]) {
        cardInst = p.hand[r.handIdx];
      } else if (r.spellSlot !== undefined && p.spells[r.spellSlot]) {
        cardInst = p.spells[r.spellSlot];
      } else if (r.slot !== undefined && p.spells[r.slot]) {
        cardInst = p.spells[r.slot];
      } else if (r.slot !== undefined && p.monsters[r.slot]) {
        cardInst = p.monsters[r.slot];
      }

      if (!cardInst) {
        const def = E().findCard(r.cardId);
        cardInst = {
          uid: 9100 + i,
          cardId: r.cardId,
          baseAtk: def ? def.atk : 0,
          baseDef: def ? def.def : 0,
          level: def ? def.level : 1,
          faceDown: false
        };
      }

      // การ์ดคว่ำของเราที่จะใช้ได้แสดงหน้าการ์ดจริงให้ผู้เล่นฝั่งตัวเองเห็น (reveal: true)
      const cardFace = V().cardHtml(cardInst, { reveal: true, field: false });
      const rName = r.name || (E().findCard(r.cardId) || {}).name || r.cardId;

      responseCards += '<div class="chain-response-col">' +
        '<div class="chain-card-wrap">' + cardFace + '</div>' +
        '<div class="chain-response-btns">' +
          '<button class="resp-use-btn" data-ov="chainResp:' + i + '">' + cs.use + ' ' + V().esc(rName) + '</button>' +
          '<button class="btn-read-eff" data-ov="inspectRespCard:' + i + '">📖 อ่านเอฟเฟกต์</button>' +
        '</div>' +
      '</div>';
    }

    const passAct = legal.find(x => x.type === 'passPriority');
    const passBtnHtml = passAct
      ? '<div class="chain-pass-wrap"><button class="pass-btn-large" data-ov="chainPass">' + cs.pass + '</button></div>'
      : '';

    return '<div class="overlay"><div class="modal chain-window-modal">' +
      '<h2>' + V().esc(label) + '</h2>' +
      '<div class="priority-tag">' + cs.priority + ' ' + V().esc(pname) + '</div>' +
      triggerCardHtml +
      (responseCards ? '<div class="chain-responses-title">เลือกการ์ดตอบโต้:</div><div class="chain-responses-row">' + responseCards + '</div>' : '') +
      passBtnHtml +
      '</div></div>';
  }

  // 🌀 Fusion Step 1: Monster Picker from Extra Deck
  function buildFusionMonsterPickerOverlay(st, v, pd) {
    const uidMap = V().uidMap(st);
    let items = '';

    for (let i = 0; i < pd.options.length; i++) {
      const o = pd.options[i];
      const def = E().findCard(o.cardId);
      const inst = (o.uid && uidMap[o.uid]) || {
        uid: o.uid || (9000 + i),
        cardId: o.cardId,
        baseAtk: def ? def.atk : (o.atk || 0),
        baseDef: def ? def.def : (o.def || 0),
        level: def ? def.level : (o.level || 1),
        faceDown: false
      };
      const picked = pendingSel.has(i);
      const cardFaceHtml = V().cardHtml(inst, { reveal: true, field: false });
      const recipeText = o.materials || (def && def.materials) || '';

      items += '<div class="picker-card-col fusion-monster-col' + (picked ? ' picked' : '') + '">' +
        '<div class="picker-card-wrap fusion-card-glow" data-ov="pickIdx:' + i + '" title="แตะเพื่อเลือกมอนสเตอร์">' +
          cardFaceHtml +
        '</div>' +
        '<div class="fusion-recipe-tag">🎯 สูตร: ' + V().esc(recipeText) + '</div>' +
        '<button class="fusion-pick-card-btn ' + (picked ? 'selected' : '') + '" data-ov="pickIdx:' + i + '">' +
          (picked ? '✓ เลือกตัวนี้แล้ว' : 'แตะเพื่อเลือก') +
        '</button>' +
        '<button class="btn-read-eff" data-ov="inspectPendingCard:' + i + '" title="อ่านเอฟเฟกต์">📖 อ่านเอฟเฟกต์</button>' +
      '</div>';
    }

    const canConfirm = pendingSel.size === 1;

    return '<div class="overlay"><div class="modal card-picker-modal fusion-modal">' +
      '<button class="detail-close-btn fusion-modal-close" data-ov="cancelFusion" title="ยกเลิกการฟิวชั่น">✕</button>' +
      '<div class="fusion-step-tag">🌀 FUSION SUMMON · ขั้นที่ 1 / 2</div>' +
      '<h2 style="margin:4px 0 2px 0;">เลือกมอนสเตอร์ Fusion จาก Extra Deck</h2>' +
      '<div class="select-count" style="color:#00e5ff;margin-bottom:8px;">เลือกมอนสเตอร์ที่คุณต้องการอัญเชิญสู่สนาม</div>' +
      '<div class="picker-cards-row">' + items + '</div>' +
      '<div class="confirm-bar fusion-actions-bar">' +
        '<button class="gold confirm-btn-large fusion-confirm-btn" data-ov="pendConfirm" ' + (canConfirm ? '' : 'disabled') + '>' +
          '🌀 ดำเนินการต่อ: เลือกวัตถุดิบ ➔' +
        '</button>' +
        '<button class="fusion-cancel-btn" data-ov="cancelFusion">' +
          '✕ ยกเลิกการฟิวชั่น' +
        '</button>' +
      '</div>' +
    '</div></div>';
  }

  // 🌀 Fusion Step 2: Materials Picker from Hand and Field with Live Validation
  function buildFusionMaterialsPickerOverlay(st, v, pd) {
    const uidMap = V().uidMap(st);
    const validCombos = pd.validCombos || [];
    const selArray = Array.from(pendingSel).sort((a, b) => a - b);
    const isMatch = validCombos.some(combo => {
      if (combo.length !== selArray.length) return false;
      return combo.every((idx, i) => idx === selArray[i]);
    });

    const fusionName = pd.fusionName || (pd.fusionDef && pd.fusionDef.name) || 'Fusion Monster';
    const fusionRecipe = pd.fusionMaterials || (pd.fusionDef && pd.fusionDef.materials) || '';
    const fusionLvl = pd.fusionDef ? pd.fusionDef.level : '';
    const fusionAtk = pd.fusionDef ? pd.fusionDef.atk : '';
    const fusionDef = pd.fusionDef ? pd.fusionDef.def : '';

    const isExile = pd.sendTo === 'removed';
    const destNoticeHtml = isExile
      ? '<div class="fusion-dest-badge exile">⚡ วัตถุดิบที่ใช้จะถูก <b>Exile (นำออกนอกเกม)</b></div>'
      : '<div class="fusion-dest-badge grave">⚡ วัตถุดิบที่ใช้จะถูกส่งลง <b>Abyss (สุสาน)</b></div>';

    const bannerHtml = '<div class="fusion-target-banner">' +
      '<div class="fusion-target-left">' +
        '<div class="fusion-step-tag">🌀 FUSION SUMMON · ขั้นที่ 2 / 2</div>' +
        '<h3 class="fusion-target-name">อัญเชิญ: <strong>' + V().esc(fusionName) + '</strong>' + (fusionLvl ? (' (Lv' + fusionLvl + ' · ATK ' + fusionAtk + ' / DEF ' + fusionDef + ')') : '') + '</h3>' +
        '<div class="fusion-target-recipe">🎯 <b>สูตรฟิวชั่นที่ต้องใช้:</b> <span class="recipe-text">' + V().esc(fusionRecipe) + '</span></div>' +
        destNoticeHtml +
      '</div>' +
    '</div>';

    let statusHtml = '';
    if (isMatch) {
      statusHtml = '<div class="fusion-validation-status ok">✅ วัตถุดิบถูกต้องครบถ้วนตามสูตร! สามารถกดยืนยันอัญเชิญได้</div>';
    } else if (pendingSel.size < pd.min) {
      statusHtml = '<div class="fusion-validation-status waiting">⏳ กรุณาเลือกวัตถุดิบให้ครบ ' + pd.min + ' ใบ (เลือกแล้ว ' + pendingSel.size + '/' + pd.min + ' ใบ)</div>';
    } else {
      statusHtml = '<div class="fusion-validation-status err">⚠️ วัตถุดิบที่เลือก (' + pendingSel.size + ' ใบ) ไม่ตรงตามสูตรฟิวชั่น กรุณาตรวจสอบสูตรด้านบน</div>';
    }

    const handOpts = [];
    const fieldOpts = [];
    const graveOpts = [];
    const removedOpts = [];
    for (let i = 0; i < pd.options.length; i++) {
      const o = pd.options[i];
      if (o.zone === 'monster') fieldOpts.push({ opt: o, idx: i });
      else if (o.zone === 'grave') graveOpts.push({ opt: o, idx: i });
      else if (o.zone === 'removed') removedOpts.push({ opt: o, idx: i });
      else handOpts.push({ opt: o, idx: i });
    }

    function renderMatCol(item) {
      const o = item.opt, i = item.idx;
      const def = E().findCard(o.cardId);
      const inst = (o.uid && uidMap[o.uid]) || {
        uid: o.uid || (9000 + i),
        cardId: o.cardId,
        baseAtk: def ? def.atk : (o.atk || 0),
        baseDef: def ? def.def : (o.def || 0),
        level: def ? def.level : (o.level || 1),
        faceDown: false
      };
      const picked = pendingSel.has(i);
      const cardFaceHtml = V().cardHtml(inst, { reveal: true, field: false });
      let zoneLabel = '🖐️ บนมือ';
      if (o.zone === 'monster') zoneLabel = '⚔️ สนาม ช่อง ' + ((o.slot !== undefined ? o.slot : o.index) + 1);
      else if (o.zone === 'grave') zoneLabel = '🪦 ใน Abyss (สุสาน)';
      else if (o.zone === 'removed') zoneLabel = '🌌 ใน Exile (นอกเกม)';

      return '<div class="picker-card-col fusion-mat-col' + (picked ? ' picked' : '') + '">' +
        '<div class="fusion-zone-chip ' + (o.zone || 'hand') + '">' + zoneLabel + '</div>' +
        '<div class="picker-card-wrap fusion-mat-card-wrap" data-ov="pickIdx:' + i + '" title="แตะเพื่อเลือก/ยกเลิก">' +
          cardFaceHtml +
        '</div>' +
        '<button class="fusion-pick-card-btn ' + (picked ? 'selected' : '') + '" data-ov="pickIdx:' + i + '">' +
          (picked ? '✓ เลือกแล้ว' : 'แตะเพื่อเลือก') +
        '</button>' +
        '<button class="btn-read-eff" data-ov="inspectPendingCard:' + i + '" title="อ่านเอฟเฟกต์">📖 อ่านเอฟเฟกต์</button>' +
      '</div>';
    }

    let groupsHtml = '';
    if (handOpts.length > 0) {
      groupsHtml += '<div class="fusion-group-section">' +
        '<div class="fusion-group-title">🖐️ วัตถุดิบบนมือ (' + handOpts.length + ' ใบ)</div>' +
        '<div class="picker-cards-row">' + handOpts.map(renderMatCol).join('') + '</div>' +
      '</div>';
    }
    if (fieldOpts.length > 0) {
      groupsHtml += '<div class="fusion-group-section">' +
        '<div class="fusion-group-title">⚔️ วัตถุดิบบนสนาม (' + fieldOpts.length + ' ตัว)</div>' +
        '<div class="picker-cards-row">' + fieldOpts.map(renderMatCol).join('') + '</div>' +
      '</div>';
    }
    if (graveOpts.length > 0) {
      groupsHtml += '<div class="fusion-group-section">' +
        '<div class="fusion-group-title">🪦 วัตถุดิบใน Abyss (สุสาน) (' + graveOpts.length + ' ใบ) ' + (isExile ? '<span style="color:#fcd34d;">(จะถูก Exile ออกนอกเกม)</span>' : '') + '</div>' +
        '<div class="picker-cards-row">' + graveOpts.map(renderMatCol).join('') + '</div>' +
      '</div>';
    }
    if (removedOpts.length > 0) {
      groupsHtml += '<div class="fusion-group-section">' +
        '<div class="fusion-group-title">🌌 วัตถุดิบใน Exile (' + removedOpts.length + ' ใบ)</div>' +
        '<div class="picker-cards-row">' + removedOpts.map(renderMatCol).join('') + '</div>' +
      '</div>';
    }

    return '<div class="overlay"><div class="modal card-picker-modal fusion-modal fusion-materials-modal">' +
      '<button class="detail-close-btn fusion-modal-close" data-ov="cancelFusion" title="ยกเลิกการฟิวชั่น">✕</button>' +
      bannerHtml +
      statusHtml +
      '<div class="fusion-scrollable-groups">' + groupsHtml + '</div>' +
      '<div class="confirm-bar fusion-actions-bar">' +
        '<button class="fusion-back-btn" data-ov="backToFusionMonster">' +
          '⬅ เปลี่ยนมอนสเตอร์ฟิวชั่น' +
        '</button>' +
        '<button class="gold confirm-btn-large fusion-confirm-btn" data-ov="pendConfirm" ' + (isMatch ? '' : 'disabled') + '>' +
          '🌀 ยืนยันการฟิวชั่น (Summon Fusion)' +
        '</button>' +
        '<button class="fusion-cancel-btn" data-ov="cancelFusion">' +
          '✕ ยกเลิก' +
        '</button>' +
      '</div>' +
    '</div></div>';
  }

  // 🌀 Fusion Step 3: Slot Picker
  function buildFusionSlotPickerOverlay(st, v, pd) {
    const p = st.players[v];
    const fusionName = pd.fusionName || 'มอนสเตอร์ฟิวชั่น';
    const optSlotMap = new Map();
    for (let i = 0; i < pd.options.length; i++) {
      const o = pd.options[i];
      optSlotMap.set(o.slot !== undefined ? o.slot : o.index, i);
    }

    const maxSlots = 5;
    let slotBoxes = '';
    for (let slot = 0; slot < maxSlots; slot++) {
      const existing = p.monsters[slot];
      if (existing) {
        const def = E().findCard(existing.cardId);
        slotBoxes += '<div class="fusion-slot-item occupied">' +
          '<div class="slot-idx-tag">ช่อง ' + (slot + 1) + '</div>' +
          '<div class="slot-occ-name">' + V().esc(def ? def.name : existing.cardId) + '</div>' +
          '<div class="slot-occ-badge">มีมอนสเตอร์อยู่</div>' +
        '</div>';
      } else if (optSlotMap.has(slot)) {
        const optIdx = optSlotMap.get(slot);
        slotBoxes += '<button class="fusion-slot-btn" data-ov="pendSlot:' + optIdx + '">' +
          '<div class="slot-callout">⬇️ วางที่นี่</div>' +
          '<div class="slot-number">ช่องที่ ' + (slot + 1) + '</div>' +
          '<div class="slot-free-badge">ช่องว่าง (แตะเพื่อลง)</div>' +
        '</button>';
      } else {
        slotBoxes += '<div class="fusion-slot-item occupied">' +
          '<div class="slot-idx-tag">ช่อง ' + (slot + 1) + '</div>' +
          '<div class="slot-occ-badge">ไม่สามารถลงได้</div>' +
        '</div>';
      }
    }

    return '<div class="overlay"><div class="modal card-picker-modal fusion-modal">' +
      '<button class="detail-close-btn fusion-modal-close" data-ov="cancelFusion" title="ยกเลิกการฟิวชั่น">✕</button>' +
      '<div class="fusion-step-tag">🌀 FUSION SUMMON · ขั้นสุดท้าย</div>' +
      '<h2 style="margin:4px 0 2px 0;">เลือกช่องสำหรับวาง ' + V().esc(fusionName) + '</h2>' +
      '<div class="select-count" style="color:#00e5ff;margin-bottom:12px;">แตะที่ช่องว่างบนสนามที่คุณต้องการอัญเชิญมอนสเตอร์ลง</div>' +
      '<div class="fusion-slot-grid">' + slotBoxes + '</div>' +
      '<div class="confirm-bar fusion-actions-bar">' +
        '<button class="fusion-cancel-btn" data-ov="cancelFusion">✕ ยกเลิกการฟิวชั่น</button>' +
      '</div>' +
    '</div></div>';
  }

  // 5D: Build pending overlay (chooseTarget, chooseCards, chooseOption, yesNo, chooseSlot)
  function buildPendingOverlay(st, v) {
    const pd = st.pending;
    const label = S().prompts[pd.prompt] || S().prompts.unknown;
    const ps = S().pending;
    const kind = pd.kind;

    // Special Fusion Overlays
    if (pd.stage === 'fusion' || pd.prompt === 'CHOOSE_FUSION_MONSTER') {
      return buildFusionMonsterPickerOverlay(st, v, pd);
    }
    if (pd.stage === 'materials' || pd.prompt === 'CHOOSE_FUSION_MATERIALS') {
      return buildFusionMaterialsPickerOverlay(st, v, pd);
    }
    if (pd.stage === 'slot' || pd.prompt === 'CHOOSE_FUSION_SLOT') {
      return buildFusionSlotPickerOverlay(st, v, pd);
    }

    if (kind === 'yesNo') {
      return '<div class="overlay"><div class="modal"><h2>' + V().esc(label) + '</h2>' +
        '<div class="opt-btns"><button class="gold" data-ov="pendYes">' + S().chain.yes + '</button>' +
        '<button data-ov="pendNo">' + S().chain.no + '</button></div></div></div>';
    }

    if (kind === 'chooseOption') {
      let btns = '';
      let sourceCardHtml = '';
      if (pd.resume && pd.resume.ctx && pd.resume.ctx.source) {
        const srcCard = pd.resume.ctx.source;
        const srcDef = E().findCard(srcCard.cardId);
        if (srcDef) {
          sourceCardHtml = '<div class="chain-trigger-card-box" style="margin-bottom:12px;width:100%">' +
            '<div class="chain-trigger-title">เอฟเฟกต์ของการ์ด: ' + V().esc(srcDef.name) + '</div>' +
            '<div class="chain-trigger-content">' +
              '<div class="chain-card-wrap">' + V().cardHtml(srcCard, { reveal: true, field: false }) + '</div>' +
              '<div class="chain-trigger-meta">' +
                '<div class="chain-trigger-name">' + V().esc(srcDef.name) + '</div>' +
                '<div style="font-size:0.8rem;color:#ddd;line-height:1.3;max-width:320px;">' + V().esc(srcDef.text || '') + '</div>' +
              '</div>' +
            '</div>' +
          '</div>';
        }
      }

      for (let i = 0; i < pd.options.length; i++) {
        const o = pd.options[i];
        let title = o.name || o.text || ('ตัวเลือก ' + (i + 1));
        let subtitle = (o.name && o.text && o.text !== o.name) ? o.text : '';
        if (title.startsWith('option_')) {
          title = 'ตัวเลือกที่ ' + (i + 1);
        }
        btns += '<button class="opt-btn-big" data-ov="pendOpt:' + i + '">' +
          '<div class="opt-btn-title">🔹 ' + V().esc(title) + '</div>' +
          (subtitle ? '<div class="opt-btn-desc">' + V().esc(subtitle) + '</div>' : '') +
          '</button>';
      }
      return '<div class="overlay"><div class="modal choose-opt-modal">' +
        '<h2>' + V().esc(label) + '</h2>' +
        sourceCardHtml +
        '<div class="opt-btns-vertical">' + btns + '</div>' +
        '</div></div>';
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

    // chooseTarget / chooseCards: row picker with real cardHtml
    const s = S();
    const countLabel = pd.min === pd.max ? (pd.min + ' ใบ') : (pd.min + ' ถึง ' + pd.max + ' ใบ');
    let sourceZoneName = '';
    if (pd.sourceZone) {
      sourceZoneName = (ps.zoneLabel && ps.zoneLabel[pd.sourceZone]) || s.zone[pd.sourceZone] || pd.sourceZone;
    } else if (pd.options && pd.options[0] && pd.options[0].zone) {
      const z = pd.options[0].zone;
      sourceZoneName = (ps.zoneLabel && ps.zoneLabel[z]) || s.zone[z] || z;
    }
    const titleText = 'เลือก ' + countLabel + (sourceZoneName ? (' จาก ' + sourceZoneName) : '');

    let items = '';
    const uidMap = V().uidMap(st);
    for (let i = 0; i < pd.options.length; i++) {
      const o = pd.options[i];
      const def = E().findCard(o.cardId);
      const inst = (o.uid && uidMap[o.uid]) || {
        uid: o.uid || (9000 + i),
        cardId: o.cardId,
        baseAtk: def ? def.atk : 0,
        baseDef: def ? def.def : 0,
        level: def ? def.level : 1,
        faceDown: false
      };
      const picked = pendingSel.has(i);
      const cardFaceHtml = V().cardHtml(inst, { reveal: true, field: false });

      items += '<div class="picker-card-col' + (picked ? ' picked' : '') + '">' +
        '<div class="picker-card-wrap" data-ov="pickIdx:' + i + '" title="แตะเพื่อเลือก/ยกเลิก">' +
          cardFaceHtml +
        '</div>' +
        '<button class="pick-toggle-btn ' + (picked ? 'selected' : '') + '" data-ov="pickIdx:' + i + '">' +
          (picked ? '✓ เลือกแล้ว' : 'แตะเพื่อเลือก') +
        '</button>' +
        '<button class="btn-read-eff" data-ov="inspectPendingCard:' + i + '" title="อ่านเอฟเฟกต์">📖 อ่านเอฟเฟกต์</button>' +
      '</div>';
    }

    const n = pendingSel.size;
    const countText = 'เลือกแล้ว ' + n + ' จาก ' + pd.max;
    const canConfirm = n >= pd.min && n <= pd.max;

    return '<div class="overlay"><div class="modal card-picker-modal">' +
      '<h2>' + V().esc(titleText) + '</h2>' +
      '<div class="select-count">' + V().esc(countText) + '</div>' +
      '<div class="picker-cards-row">' + items + '</div>' +
      '<div class="confirm-bar"><button class="gold confirm-btn-large" data-ov="pendConfirm" ' + (canConfirm ? '' : 'disabled') + '>' + s.app.confirm + '</button></div>' +
      '</div></div>';
  }

  function showExtraSummonPicker(extraIdx) {
    const v = viewer(), p = state.players[v];
    const card = p.extra[extraIdx];
    if (!card) return;
    const def = E().findCard(card.cardId);
    const legal = E().getLegalActions(state, v);
    const validActs = legal.filter(x => x.type === 'extraSummon' && x.extraIdx === extraIdx);
    const validSlotMap = new Map();
    validActs.forEach(act => validSlotMap.set(act.targetSlot, act));

    const matReq = V().formatMaterialsRequirement ? V().formatMaterialsRequirement(def) : (def.materials || '');
    const isGrade4 = def.type === 'grade4';
    const typeTitle = isGrade4 ? '👑 GRADE 4 · EXTRA SUMMON' : '🌀 SPECIAL OVERLAY · EXTRA SUMMON';

    let slotItems = '';
    const maxSlots = (state.config && state.config.monsterSlots) || 5;
    for (let slot = 0; slot < maxSlots; slot++) {
      const mon = p.monsters[slot];
      if (validSlotMap.has(slot)) {
        slotItems += '<div class="extra-slot-target valid">' +
          '<div class="slot-idx-pill">ช่องที่ ' + (slot + 1) + '</div>' +
          '<div class="extra-target-card-preview" data-ov="execExtra:' + extraIdx + ':' + slot + '" title="แตะเพื่อเลือกวางทับ">' +
            V().cardHtml(mon, { reveal: true, field: false }) +
          '</div>' +
          '<button class="gold extra-target-confirm-btn" data-ov="execExtra:' + extraIdx + ':' + slot + '">' +
            '✨ วางทับตัวนี้' +
          '</button>' +
        '</div>';
      } else if (mon) {
        slotItems += '<div class="extra-slot-target invalid">' +
          '<div class="slot-idx-pill">ช่องที่ ' + (slot + 1) + '</div>' +
          '<div class="extra-target-card-preview dimmed">' +
            V().cardHtml(mon, { reveal: true, field: false }) +
          '</div>' +
          '<div class="slot-invalid-reason">❌ ไม่ตรงเงื่อนไข</div>' +
        '</div>';
      } else {
        slotItems += '<div class="extra-slot-target empty">' +
          '<div class="slot-idx-pill">ช่องที่ ' + (slot + 1) + '</div>' +
          '<div class="slot-empty-box">(ช่องว่าง — ต้องวางทับ)</div>' +
        '</div>';
      }
    }

    const modal = document.createElement('div');
    modal.className = 'overlay extra-summon-overlay';
    modal.style.zIndex = '95';
    modal.innerHTML = '<div class="modal card-picker-modal extra-picker-modal">' +
      '<div class="extra-step-tag">' + typeTitle + '</div>' +
      '<h2 style="margin:4px 0 2px 0;">เลือกมอนสเตอร์เป้าหมายที่จะวางทับ</h2>' +
      '<div class="extra-target-desc">' +
        'อัญเชิญ: <strong style="color:#00e5ff;">' + V().esc(def.name) + '</strong> (Lv' + (def.level || '?') + ' · ATK ' + (def.atk || 0) + ' / DEF ' + (def.def || 0) + ')<br>' +
        '<span style="color:#ffd700;">🎯 เงื่อนไข: ' + V().esc(matReq) + '</span>' +
      '</div>' +
      '<div class="extra-slot-grid">' + slotItems + '</div>' +
      '<div class="confirm-bar">' +
        '<button class="btn-cancel-extra" data-ov="cancelExtra">↩ ยกเลิก / กลับไปเลือกใบอื่น</button>' +
      '</div>' +
    '</div>';

    modal.onclick = (e) => {
      const b = e.target.closest('[data-ov]');
      if (!b) return;
      const ov = b.dataset.ov;
      if (ov === 'cancelExtra') {
        modal.remove();
        showZone(v, 'extra');
      } else if (ov.startsWith('execExtra:')) {
        const parts = ov.split(':');
        const exIdx = Number(parts[1]);
        const sIdx = Number(parts[2]);
        modal.remove();
        act({ type: 'extraSummon', player: v, extraIdx: exIdx, targetSlot: sIdx });
      }
    };

    document.body.appendChild(modal);
  }

  function showZone(pi, z) {
    const p = state.players[pi], a = S().app, vw = viewer();
    const secret = (z === 'deck') || (z === 'extra' && pi !== vw);
    const isGallery = (z === 'grave' || z === 'removed' || (z === 'extra' && pi === vw));
    let body = '';

    if (secret) {
      body = '<div class="m" style="color:var(--mut)">' + p[z].length + ' ' + a.count + '</div>';
    } else if (isGallery) {
      const legals = (pi === vw && z === 'grave') ? E().getLegalActions(state, vw) : [];
      body = p[z].length ? '<div class="zone-gallery-grid">' + p[z].map((c, i) => {
        const def = V().def(c);
        const req = (z === 'extra' && V().formatMaterialsRequirement) ? V().formatMaterialsRequirement(def) : '';
        const canActGrave = (z === 'grave' && pi === vw) ? legals.find(x => x.type === 'activateEffect' && x.graveIdx === i) : null;
        const graveBtn = canActGrave ? ('<button class="gold btn-mini" style="margin-top:4px;width:100%;font-size:0.75rem;cursor:pointer" data-ov="actGraveEff:' + i + ':' + canActGrave.effectId + '">✨ ใช้สกิลในสุสาน</button>') : '';
        return '<div class="zone-gallery-card-item" data-zone-cuid="' + c.uid + '" title="' + V().esc(def.name) + ' (แตะเพื่อดูรายละเอียด)">' +
          V().cardHtml(c, { reveal: true, field: false }) +
          '<div class="zone-card-caption">' + V().esc(def.name) + '</div>' +
          (req ? '<div class="zone-card-req-pill">' + (def.type === 'fusion' ? '🌀 ' : '👑 ') + V().esc(req) + '</div>' : '') +
          graveBtn +
        '</div>';
      }).join('') + '</div>' : '<div class="zone-empty-notice">' + a.empty + '</div>';
    } else {
      const names = p[z].map(c => V().def(c).name);
      body = p[z].length ? p[z].map((c, i) => '<div class="row zone-card-row" data-zone-cuid="' + c.uid + '" style="cursor:pointer;justify-content:space-between;align-items:center;padding:4px 2px;border-bottom:1px solid var(--bd)"><span>' + V().esc(V().def(c).name) + '</span><small class="pill">🔍 ดูการ์ด</small></div>').join('') : '<div>' + a.empty + '</div>';
    }

    const o = document.createElement('div'); o.className = 'overlay'; o.style.zIndex = 70;
    o.innerHTML = '<div class="modal ' + (isGallery ? 'modal-zone-gallery' : '') + '"><h2>' + V().esc(V().pname(state, pi)) + ' — ' + a[z === 'extra' ? 'extraDeck' : z] + ' (' + p[z].length + ' ' + a.count + ')</h2><div class="list ' + (isGallery ? 'gallery-list' : '') + '">' + body + '</div><br><button class="gold">' + a.close + '</button></div>';
    o.onclick = (e) => {
      const b = e.target.closest('[data-ov]');
      if (b && b.dataset.ov && b.dataset.ov.startsWith('callExtra:')) {
        const extraIdx = Number(b.dataset.ov.slice(10));
        o.remove();
        showExtraSummonPicker(extraIdx);
        return;
      }
      if (b && b.dataset.ov && b.dataset.ov.startsWith('actGraveEff:')) {
        const parts = b.dataset.ov.split(':');
        const gIdx = Number(parts[1]);
        const effId = parts[2];
        const legals = E().getLegalActions(state, vw);
        const actObj = legals.find(x => x.type === 'activateEffect' && x.graveIdx === gIdx && x.effectId === effId);
        if (actObj) {
          o.remove();
          act(actObj);
          return;
        }
      }
      const it = e.target.closest('[data-zone-cuid]');
      if (it) {
        const uid = Number(it.dataset.zoneCuid);
        const inst = V().uidMap(state)[uid];
        if (inst) {
          o.remove();
          if (z === 'extra') {
            const extraIdx = p.extra.findIndex(c => c.uid === uid);
            sel = { kind: 'extra', idx: extraIdx };
          }
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
    CG.ui.inspectPendingCard = null;
    if (mode === 'online') {
      if (CG.network) CG.network.sendAction(action);
      sel = null; handSel = new Set(); pendingSel = new Set();
      render();
      return true;
    }
    const r = E().applyAction(state, action);
    if (!r.ok) { toast(V().errorText(r.error)); return false; }
    evBuf = evBuf.concat(r.events); sel = null; handSel = new Set(); pendingSel = new Set();
    afterAction(); return true;
  }
  function afterAction() {
    render(); schedule();
  }

  function onOverlay(e) {
    const b = e.target.closest('[data-ov], [data-act]'), pick = e.target.closest('[data-pick]'), v = viewer();
    if (pick) {
      const u = Number(pick.dataset.pick);
      if (handSel.has(u)) {
        // แตะซ้ำที่การ์ดที่เลือกแล้วในมัลลิแกน -> เปิดดูการ์ดเต็มจอ!
        const cardInst = state.players[v].hand.find(c => c.uid === u);
        if (cardInst) {
          CG.ui.inspectCard = { inst: cardInst, isOpponent: false };
          render();
          return;
        }
      }
      handSel.add(u);
      render();
      return;
    }
    if (!b) return;
    if (b.classList.contains('card-detail-overlay') && e.target.closest('.card-detail-modal')) return;
    const k = b.dataset.ov || b.dataset.act;
    if (k === 'closeModal') {
      CG.ui.inspectPendingCard = null;
      CG.ui.inspectCard = null;
      render();
      return;
    }
    if (k === 'deselectMulligan') {
      if (CG.ui.inspectCard && CG.ui.inspectCard.inst) {
        handSel.delete(CG.ui.inspectCard.inst.uid);
      }
      CG.ui.inspectCard = null;
      render();
      return;
    }
    if (k.startsWith('inspectUnder:')) {
      const uUid = Number(k.slice(13));
      const uidMap = V().uidMap(state);
      const uCard = uidMap[uUid];
      if (uCard) {
        CG.ui.inspectCard = { inst: uCard, isOpponent: false };
        render();
      }
      return;
    }
    if (k.startsWith('inspectPendingCard:')) {
      const idx = Number(k.slice(19));
      const pd = state.pending;
      if (pd && pd.options && pd.options[idx]) {
        const opt = pd.options[idx];
        const def = E().findCard(opt.cardId);
        const uidMap = V().uidMap(state);
        const inst = (opt.uid && uidMap[opt.uid]) || {
          uid: opt.uid || (9000 + idx),
          cardId: opt.cardId,
          baseAtk: def ? def.atk : 0,
          baseDef: def ? def.def : 0,
          level: def ? def.level : 1,
          faceDown: false
        };
        CG.ui.inspectPendingCard = inst;
        render();
      }
      return;
    }
    if (k === 'inspectChainLast') {
      const lastLink = (state.chain && state.chain.length > 0) ? state.chain[state.chain.length - 1] : null;
      if (lastLink) {
        const def = E().findCard(lastLink.cardId);
        const uidMap = V().uidMap(state);
        const inst = (lastLink.uid && uidMap[lastLink.uid]) || {
          uid: lastLink.uid,
          cardId: lastLink.cardId,
          baseAtk: def ? def.atk : 0,
          baseDef: def ? def.def : 0,
          level: def ? def.level : 1,
          faceDown: false
        };
        CG.ui.inspectPendingCard = inst;
        render();
      }
      return;
    }
    if (k.startsWith('inspectRespCard:')) {
      const idx = Number(k.slice(16));
      const legal = E().getLegalActions(state, v);
      const responses = legal.filter(x => x.type === 'activateResponse');
      const r = responses[idx];
      if (r) {
        const p = state.players[v];
        let cardInst = null;
        if (r.handIdx !== undefined && p.hand[r.handIdx]) cardInst = p.hand[r.handIdx];
        else if (r.spellSlot !== undefined && p.spells[r.spellSlot]) cardInst = p.spells[r.spellSlot];
        else if (r.slot !== undefined && p.spells[r.slot]) cardInst = p.spells[r.slot];
        else if (r.slot !== undefined && p.monsters[r.slot]) cardInst = p.monsters[r.slot];
        if (!cardInst) {
          const def = E().findCard(r.cardId);
          cardInst = {
            uid: 9100 + idx,
            cardId: r.cardId,
            baseAtk: def ? def.atk : 0,
            baseDef: def ? def.def : 0,
            level: def ? def.level : 1,
            faceDown: false
          };
        }
        CG.ui.inspectPendingCard = cardInst;
        render();
      }
      return;
    }
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
    else if (k.startsWith('quickCastFusion:')) {
      const spec = k.slice(16);
      const parts = spec.split(':');
      const actObj = parts[0] === 'h' ? { type: 'activateSpell', player: v, handIdx: Number(parts[1]) } : { type: 'activateSpell', player: v, spellSlot: Number(parts[1]) };
      const overlay = e.target.closest('.overlay');
      if (overlay) overlay.remove();
      act(actObj);
    }
    else if (k === 'pendYes') { act({ type: 'respond', player: v, choice: [0] }); }
    else if (k === 'pendNo') { act({ type: 'respond', player: v, choice: [1] }); }
    else if (k.startsWith('pendOpt:')) { act({ type: 'respond', player: v, choice: [Number(k.slice(8))] }); }
    else if (k.startsWith('pendSlot:')) { act({ type: 'respond', player: v, choice: [Number(k.slice(9))] }); }
    else if (k.startsWith('pickIdx:')) {
      const idx = Number(k.slice(8));
      if (pendingSel.has(idx)) {
        pendingSel.delete(idx);
      } else {
        pendingSel.add(idx);
        const pd = state.pending;
        if (pd && pendingSel.size > pd.max) {
          const arr = Array.from(pendingSel);
          pendingSel.delete(arr[0]);
        }
      }
      render();
    }
    else if (k === 'pendConfirm') {
      const choice = Array.from(pendingSel).sort((a, b) => a - b);
      act({ type: 'respond', player: v, choice });
    }
    else if (k === 'cancelFusion') {
      const pd = state.pending;
      if (pd) {
        state.pending = null;
        pendingSel.clear();
        CG.ui.inspectPendingCard = null;
        if (state.chain && state.chain.length > 0) {
          const link = state.chain.pop();
          if (link) {
            const p = state.players[link.controller];
            if (link.effect && link.effect.cost && link.effect.cost.mana) {
              p.mana += link.effect.cost.mana;
            }
            if (link.spellCard) {
              if (link.fromZone === 'spells' && p.spells) {
                link.spellCard.faceDown = true;
                const spSlot = link.spellSlot !== undefined ? link.spellSlot : link.slot;
                p.spells[spSlot] = link.spellCard;
              } else if (p.hand) {
                p.hand.push(link.spellCard);
              }
            }
          }
          state.chainResolving = false;
        }
        toast('ยกเลิกการฟิวชั่น');
        render();
        schedule();
      }
    }
    else if (k === 'backToFusionMonster') {
      const pd = state.pending;
      if (pd && pd.resume && CG.effects && CG.effects.resumeEffect) {
        pendingSel.clear();
        CG.ui.inspectPendingCard = null;
        if (pd.resume.ctx) {
          delete pd.resume.ctx._fusionData;
          delete pd.resume.ctx._stepChoice;
        }
        state.pending = null;
        CG.effects.resumeEffect(state, evBuf, pd.resume, null);
        render();
      }
    }
  }

  function onClick(e) {
    if (justDragged) { justDragged = false; return; }
    if (!state || state.ended) return;
    const v = viewer(), p = state.players[v];

    // ปิดหน้าต่างดูการ์ด หรือเมนูปิด (ทำได้ตลอดเวลาไม่ว่าเทิร์นใคร)
    const bClose = e.target.closest('[data-act="closeModal"]') || e.target.closest('.detail-close-btn');
    if (bClose || (e.target.classList && e.target.classList.contains('card-detail-overlay'))) {
      CG.ui.inspectCard = null;
      CG.ui.inspectPendingCard = null;
      render();
      return;
    }

    if (phaseMenuOpen && !e.target.closest('.phase-btn-wrap')) {
      phaseMenuOpen = false;
      render();
    }
    if (e.target.closest('#btnMenu')) { lobby(); return; }
    if (e.target.closest('#btnSound')) {
      AudioFX.toggle();
      render();
      return;
    }
    if (e.target.closest('#btnSpeed')) {
      const next = currentSpeed === 'normal' ? 'fast' : currentSpeed === 'fast' ? 'slow' : 'normal';
      setSpeed(next);
      return;
    }
    AudioFX.play('click');

    // คลิกช่อง disabled หรือ effect cell ที่ไม่พร้อมใช้เพื่อแสดงเหตุผล
    const disCell = e.target.closest('[data-reason]');
    if (disCell && (disCell.classList.contains('disabled') || disCell.classList.contains('detail-effect-cell'))) {
      const reason = disCell.getAttribute('data-reason');
      const rBox = $('cmdReasonBox');
      if (rBox) {
        rBox.textContent = reason ? ('⚠ ' + reason) : '⚠ ไม่สามารถทำได้ในขณะนี้';
      }
      if (reason) toast('⚠ ' + reason);
      return;
    }

    // การ์ดบนมือคู่แข่ง: ปิดความลับ ห้ามเปิด
    if (e.target.closest('.handrow.opp')) return;

    // ตรวจสอบการเปิดดูโซน (Abyss / Astral Gate / Exile) - ดูได้ตลอดเวลาทั้ง 2 ฝ่าย
    const z = e.target.closest('[data-zone]');
    if (z) {
      const [i, n] = z.dataset.zone.split(':');
      showZone(Number(i), n);
      return;
    }

    // อัปเดต sidebar inspect
    const cardEl = e.target.closest('.card');
    if (cardEl && cardEl.dataset.uid) {
      const m = V().uidMap(state)[cardEl.dataset.uid];
      if (m) {
        CG.ui.lastInspectedInst = m;
        if ($('inspect')) $('inspect').innerHTML = V().inspectHtml(m, v);
      }
    }

    const hand = e.target.closest('[data-hand]'),
          slot = e.target.closest('[data-slot]'),
          spellSlot = e.target.closest('[data-spell-slot]'),
          fz = e.target.closest('[data-zone2="field"]');

    const isMyTurn = (state.activeIdx === v && (mode !== 'bot' || (botToAct() === null && !botBusy)) && !state.pending && state.phase !== 'mulligan');

    // ตรวจสอบการคลิกช่องสนามหรือการ์ดเพื่อเปิดดูการ์ดเต็มใบ (Inspect Modal)
    // 1) ช่องของฝ่ายตรงข้าม (มอนสเตอร์)
    if (slot) {
      const pi = Number(slot.dataset.p), si = Number(slot.dataset.slot);
      if (pi !== v) {
        if (isMyTurn && sel && sel.kind === 'attack') {
          act({ type: 'attack', player: v, from: sel.slot, to: si });
          return;
        }
        const oppM = state.players[pi].monsters[si];
        if (!oppM || oppM.faceDown) return; // การ์ดคว่ำคู่แข่งห้ามดู
        CG.ui.inspectCard = { inst: oppM, isOpponent: true };
        sel = null;
        render();
        return;
      }
    }

    // 2) ช่องของฝ่ายตรงข้าม (สเปล)
    if (spellSlot) {
      const pi = Number(spellSlot.dataset.p), si = Number(spellSlot.dataset.spellSlot);
      if (pi !== v) {
        const oppSp = state.players[pi].spells[si];
        if (!oppSp || oppSp.faceDown) return; // การ์ดคว่ำคู่แข่งห้ามดู
        CG.ui.inspectCard = { inst: oppSp, isOpponent: true };
        sel = null;
        render();
        return;
      }
    }

    // 3) การ์ดฟิลด์สเปล
    if (fz) {
      const fsCard = p.fieldSpell || state.players[1 - v].fieldSpell;
      if (fsCard) {
        CG.ui.inspectCard = { inst: fsCard, isOpponent: !p.fieldSpell };
        sel = null;
        render();
        return;
      }
    }

    // 4) หากไม่ใช่เทิร์นเรา: อนุญาตให้คลิกดูการ์ดเต็มจอฝั่งเราได้ทุกใบ (มือ, มอนสเตอร์บนสนาม, สเปล)
    if (!isMyTurn) {
      if (hand) {
        const clickedIdx = Number(hand.dataset.hand);
        if (p.hand[clickedIdx]) {
          CG.ui.inspectCard = { inst: p.hand[clickedIdx], isOpponent: false };
          render();
          return;
        }
      }
      if (slot) {
        const pi = Number(slot.dataset.p), si = Number(slot.dataset.slot);
        if (pi === v && p.monsters[si]) {
          CG.ui.inspectCard = { inst: p.monsters[si], isOpponent: false };
          render();
          return;
        }
      }
      if (spellSlot) {
        const pi = Number(spellSlot.dataset.p), si = Number(spellSlot.dataset.spellSlot);
        if (pi === v && p.spells[si]) {
          CG.ui.inspectCard = { inst: p.spells[si], isOpponent: false };
          render();
          return;
        }
      }
      // หากไม่ใช่การคลิกดูการ์ด ไม่ทำคำสั่งแอ็กชันในเทิร์นฝ่ายตรงข้าม
      return;
    }

    // 5) หากเป็นเทิร์นเรา: จัดการปุ่มคำสั่ง Quick Action
    const b = e.target.closest('[data-act]');
    if (b && b.classList.contains('card-detail-overlay') && e.target.closest('.card-detail-modal')) return;
    if (b) { return onAct(b.dataset.act, v); }
    if (hand) {
      const clickedIdx = Number(hand.dataset.hand);
      if (sel && sel.kind === 'hand' && sel.idx === clickedIdx && !sel.mode) {
        // แตะซ้ำที่การ์ดใบเดิมบนมือ -> เปิดดูการ์ดเต็มจอ!
        CG.ui.inspectCard = { inst: p.hand[clickedIdx], isOpponent: false };
        render();
        return;
      }
      sel = { kind: 'hand', idx: clickedIdx, mode: null, mats: [] };
      CG.ui.inspectCard = null;
      if (p.hand[sel.idx]) {
        CG.ui.lastInspectedInst = p.hand[sel.idx];
      }
      render();
      return;
    }

    if (spellSlot) {
      const pi = Number(spellSlot.dataset.p), si = Number(spellSlot.dataset.spellSlot);
      if (sel && sel.kind === 'hand' && pi === v) {
        if (sel.mode === 'setSpell' || sel.mode === null) {
          const legals = E().getLegalActions(state, v);
          const legalSet = legals.find(x => x.type === 'setSpell' && x.handIdx === sel.idx && x.slot === si);
          if (legalSet) {
            act(legalSet);
            return;
          } else {
            const card = p.hand[sel.idx];
            const cd = card ? E().cardOf(card) : null;
            if (cd && cd.type !== 'spell') {
              toast('⚠ ช่องนี้สำหรับวางหมอบการ์ดสเปลเท่านั้น');
            } else if (p.spells[si]) {
              toast('⚠ ช่องนี้มีสเปลวางอยู่แล้ว');
            } else {
              toast('⚠ ไม่สามารถหมอบสเปลในช่องนี้ได้');
            }
            return;
          }
        }
      }
      if (pi === v && p.spells[si]) {
        if (sel && sel.kind === 'spell' && sel.slot === si) {
          // แตะซ้ำที่สเปลใบเดิมบนสนาม -> เปิดดูการ์ดเต็มจอ!
          CG.ui.inspectCard = { inst: p.spells[si], isOpponent: false };
          render();
          return;
        }
        sel = { kind: 'spell', slot: si };
        CG.ui.inspectCard = null;
        CG.ui.lastInspectedInst = p.spells[si];
        render();
        return;
      }
    }
    if (!slot) {
      if (sel && sel.kind === 'hand' && !b) {
        const card = p.hand[sel.idx];
        const cd = card ? E().cardOf(card) : null;
        if (cd && cd.type === 'spell' && cd.group === 'normal') {
          const legals = E().getLegalActions(state, v);
          const actSpell = legals.find(a => a.type === 'activateSpell' && a.handIdx === sel.idx);
          if (actSpell) {
            act(actSpell);
            return;
          }
        }
      }
      if (sel && !b) {
        sel = null;
        render();
      }
      return;
    }
    const pi = Number(slot.dataset.p), si = Number(slot.dataset.slot);
    if (sel && sel.kind === 'hand') {
      if (sel.mode === 'normal' && pi === v) act({ type: 'normalSummon', player: v, handIdx: sel.idx, slot: si });
      else if (sel.mode === 'set' && pi === v) act({ type: 'setMonster', player: v, handIdx: sel.idx, slot: si });
      else if (sel.mode === 'overlay' && pi === v) act({ type: 'overlay', player: v, handIdx: sel.idx, targetSlot: si });
      else if (sel.mode === 'tribute' && pi === v) {
        if (!sel.matsOk) { if (p.monsters[si]) { const k = sel.mats.indexOf(si); k >= 0 ? sel.mats.splice(k, 1) : sel.mats.push(si); render(); } }
        else act({ type: 'tributeSummon', player: v, handIdx: sel.idx, materials: sel.mats.slice(), slot: si });
      } else if (!sel.mode && pi === v) {
        // Direct click on empty monster slot without needing to click mode:normal button first!
        const legals = E().getLegalActions(state, v);
        const actSummon = legals.find(a => a.type === 'normalSummon' && a.handIdx === sel.idx && a.slot === si);
        const actOverlay = legals.find(a => a.type === 'overlay' && a.handIdx === sel.idx && a.targetSlot === si);
        if (actSummon) {
          act(actSummon);
          return;
        } else if (actOverlay) {
          act(actOverlay);
          return;
        } else {
          const card = p.hand[sel.idx];
          const cd = card ? E().cardOf(card) : null;
          if (cd) {
            if (cd.type === 'spell') {
              toast('⚠ ' + (cd.name || 'สเปล') + ' เป็นการ์ดสเปล หมอบที่ช่องสเปลด้านล่าง หรือกด [⚡ ร่ายสเปล]');
            } else if (cd.level > 1) {
              toast('⚠ ' + (cd.name || 'มอนสเตอร์') + ' เป็น Lv.' + cd.level + ' ต้องสังเวยมอนสเตอร์บนสนาม (Tribute) ก่อนลง');
            } else if (p.monsters[si]) {
              toast('⚠ ช่องนี้มีมอนสเตอร์อยู่แล้ว');
            } else if (p.flags.normalSummonUsed) {
              toast('⚠ ' + S().errors.NORMAL_SUMMON_USED);
            } else if (p.mana < (Number(cd.mana) || 0)) {
              toast('⚠ ' + S().errors.NOT_ENOUGH_MANA);
            } else {
              toast('⚠ ไม่สามารถอัญเชิญลงช่องนี้ได้');
            }
          }
        }
      }
      return;
    }
    if (sel && sel.kind === 'extra' && pi === v) {
      const legals = E().getLegalActions(state, v);
      const legalAct = legals.find(x => x.type === 'extraSummon' && x.extraIdx === sel.idx && x.targetSlot === si);
      if (legalAct) {
        act(legalAct);
      } else {
        const m = p.monsters[si];
        const cardName = m ? V().def(m).name : ('ช่อง ' + (si + 1));
        const exCard = p.extra[sel.idx];
        const exName = exCard ? V().def(exCard).name : 'การ์ดนี้';
        toast(cardName + ' ไม่สามารถใช้เป็นเป้าหมายวางทับของ ' + exName + ' ได้');
      }
      return;
    }
    if (pi === v && p.monsters[si]) {
      if (sel && sel.kind === 'field' && sel.slot === si) {
        // แตะซ้ำที่มอนสเตอร์เดิมบนสนาม -> เปิดดูการ์ดเต็มจอ!
        CG.ui.inspectCard = { inst: p.monsters[si], isOpponent: false };
        render();
        return;
      }
      sel = { kind: 'field', slot: si };
      CG.ui.inspectCard = null;
      CG.ui.lastInspectedInst = p.monsters[si];
      render();
    }
  }

  function onAct(k, v) {
    if (k === 'exitTutorial') { lobby(); return; }
    if (k === 'closeModal') { sel = null; CG.ui.inspectCard = null; CG.ui.inspectPendingCard = null; render(); return; }
    if (k === 'deselectMulligan') {
      if (CG.ui.inspectCard && CG.ui.inspectCard.inst) {
        handSel.delete(CG.ui.inspectCard.inst.uid);
      }
      CG.ui.inspectCard = null;
      render();
      return;
    }
    if (k === 'zoomCardDetail') {
      if (CG.ui.lastInspectedInst) {
        CG.ui.inspectCard = { inst: CG.ui.lastInspectedInst, isOpponent: false };
        render();
      }
      return;
    }
    if (k === 'togglePhaseMenu') { phaseMenuOpen = !phaseMenuOpen; render(); return; }
    if (k === 'reselectMats') { if (sel && sel.mode === 'tribute') { sel.matsOk = false; render(); } return; }
    if (k.startsWith('callExtra:')) { const extraIdx = Number(k.slice(10)); sel = { kind: 'extra', idx: extraIdx }; CG.ui.inspectCard = null; render(); return; }
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
    else if (k.startsWith('actEff:hand:')) {
      const rest = k.slice(12);
      const parts = rest.split(':');
      let handIdx = sel ? sel.idx : undefined;
      let effectId = parts[0];
      if (parts.length >= 2) {
        handIdx = Number(parts[0]);
        effectId = parts[1];
      }
      CG.ui.inspectCard = null;
      act({ type: 'activateEffect', player: v, handIdx, effectId });
    }
    else if (k.startsWith('actEff:field:')) {
      const rest = k.slice(13);
      const parts = rest.split(':');
      let slot = sel ? sel.slot : undefined;
      let effectId = parts[0];
      if (parts.length >= 2) {
        slot = Number(parts[0]);
        effectId = parts[1];
      }
      CG.ui.inspectCard = null;
      act({ type: 'activateEffect', player: v, slot, effectId });
    }
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

  // 7P: Format Thai banner for bot actions with rich visual announcement
  function formatBotBanner(st, act, events, cardBeforeAct) {
    const s = S(), a = s.app;
    const p = st.players[act.player];
    const def = (c) => V().def(c);

    let res = {
      type: act.type,
      icon: '🤖',
      title: 'บอทดำเนินการ',
      cardName: '',
      stats: '',
      desc: '',
      inst: null,
      cardId: null,
      isSet: false
    };

    switch (act.type) {
      case 'normalSummon': {
        const m = cardBeforeAct || (act.slot !== undefined ? p.monsters[act.slot] : null);
        const d = m ? def(m) : null;
        res.icon = '⚔️';
        res.title = 'บอทอัญเชิญมอนสเตอร์';
        res.cardName = d ? d.name : 'มอนสเตอร์';
        res.stats = d ? ('Lv' + (d.level || 1) + ' • ATK ' + (d.atk || 0) + ' / DEF ' + (d.def || 0)) : '';
        res.desc = 'อัญเชิญลงที่ช่อง ' + (act.slot + 1) + (d && d.text ? ' • ' + d.text : '');
        res.inst = m;
        res.cardId = d ? d.id : null;
        break;
      }
      case 'setMonster': {
        res.icon = '🛡️';
        res.title = 'บอท Set คว่ำมอนสเตอร์';
        res.cardName = 'มอนสเตอร์คว่ำ';
        res.desc = 'Set คว่ำป้องกันที่ช่อง ' + (act.slot + 1);
        res.isSet = true;
        break;
      }
      case 'tributeSummon': {
        const m = cardBeforeAct || (act.slot !== undefined ? p.monsters[act.slot] : null);
        const d = m ? def(m) : null;
        res.icon = '💀';
        res.title = 'บอทเสียสละอัญเชิญ (Tribute)';
        res.cardName = d ? d.name : 'มอนสเตอร์';
        res.stats = d ? ('Lv' + (d.level || 2) + ' • ATK ' + (d.atk || 0) + ' / DEF ' + (d.def || 0)) : '';
        res.desc = 'เสียสละมอนสเตอร์ ' + (act.materials ? act.materials.length : 1) + ' ตัว อัญเชิญลงช่อง ' + (act.slot + 1) + (d && d.text ? ' • ' + d.text : '');
        res.inst = m;
        res.cardId = d ? d.id : null;
        break;
      }
      case 'overlay': {
        const m = cardBeforeAct || (act.targetSlot !== undefined ? p.monsters[act.targetSlot] : null);
        const d = m ? def(m) : null;
        res.icon = '🪐';
        res.title = 'บอท Eclipse วางทับ';
        res.cardName = d ? d.name : 'มอนสเตอร์';
        res.stats = d ? ('Lv' + (d.level || 1) + ' • ATK ' + (d.atk || 0)) : '';
        res.desc = 'วางทับมอนสเตอร์ที่ช่อง ' + (act.targetSlot + 1);
        res.inst = m;
        res.cardId = d ? d.id : null;
        break;
      }
      case 'extraSummon': {
        const m = cardBeforeAct || (act.targetSlot !== undefined ? p.monsters[act.targetSlot] : null);
        const d = m ? def(m) : null;
        res.icon = '🌟';
        res.title = 'บอทอัญเชิญพิเศษ (Extra Deck)';
        res.cardName = d ? d.name : 'มอนสเตอร์';
        res.stats = d ? ('Lv' + (d.level || 3) + ' • ATK ' + (d.atk || 0) + ' / DEF ' + (d.def || 0)) : '';
        res.desc = 'อัญเชิญพิเศษวางทับที่ช่อง ' + (act.targetSlot + 1) + (d && d.text ? ' • ' + d.text : '');
        res.inst = m;
        res.cardId = d ? d.id : null;
        break;
      }
      case 'activateSpell': {
        const card = cardBeforeAct || (act.handIdx !== undefined ? p.hand[act.handIdx] : (act.spellSlot !== undefined ? p.spells[act.spellSlot] : null));
        const d = card ? def(card) : null;
        res.icon = '🪄';
        res.title = 'บอทร่ายการ์ดสเปล';
        res.cardName = d ? d.name : 'สเปล';
        const grpKey = d ? ((d.field || d.group === 'field') ? 'field' : d.group) : 'normal';
        res.stats = d ? ('สเปล ' + (s.spellGroup[grpKey] || d.group) + ' • จ่าย ' + (d.mana || 0) + ' มานา') : '';
        res.desc = d ? (d.text || '') : '';
        res.inst = card;
        res.cardId = d ? d.id : null;
        break;
      }
      case 'setSpell': {
        res.icon = '📜';
        res.title = 'บอทหมอบสเปล';
        res.desc = 'หมอบสเปลที่ช่อง ' + (act.slot + 1);
        res.isSet = true;
        break;
      }
      case 'activateEffect': {
        const card = cardBeforeAct || (act.slot !== undefined ? p.monsters[act.slot] : (act.handIdx !== undefined ? p.hand[act.handIdx] : null));
        const d = card ? def(card) : null;
        res.icon = '⚡';
        res.title = 'บอทเปิดใช้เอฟเฟกต์';
        res.cardName = d ? d.name : 'เอฟเฟกต์';
        res.stats = d ? ('Lv' + (d.level || 1) + ' • ATK ' + (d.atk || 0)) : '';
        res.desc = d ? (d.text || '') : '';
        res.inst = card;
        res.cardId = d ? d.id : null;
        break;
      }
      case 'attack': {
        const atkMon = cardBeforeAct || p.monsters[act.from];
        const d = atkMon ? def(atkMon) : null;
        const toText = act.to === null ? 'โจมตีตรงใส่ผู้เล่น!' : ('มอนสเตอร์ช่อง ' + (act.to + 1));
        res.icon = '⚔️';
        res.title = 'บอทประกาศโจมตี!';
        res.cardName = d ? d.name : 'มอนสเตอร์';
        res.stats = atkMon ? ('ATK ' + E().atk(atkMon)) : '';
        res.desc = 'จากช่อง ' + (act.from + 1) + ' โจมตี → ' + toText;
        res.inst = atkMon;
        res.cardId = d ? d.id : null;
        break;
      }
      case 'flipSummon': {
        const m = cardBeforeAct || p.monsters[act.slot];
        const d = m ? def(m) : null;
        res.icon = '✨';
        res.title = 'บอทพลิกหงายมอนสเตอร์';
        res.cardName = d ? d.name : 'มอนสเตอร์';
        res.stats = d ? ('Lv' + (d.level || 1) + ' • ATK ' + (d.atk || 0) + ' / DEF ' + (d.def || 0)) : '';
        res.desc = 'พลิกหงายขึ้นมาเป็นท่าโจมตีที่ช่อง ' + (act.slot + 1);
        res.inst = m;
        res.cardId = d ? d.id : null;
        break;
      }
      case 'changePosition': {
        const m = cardBeforeAct || p.monsters[act.slot];
        res.icon = '🔄';
        res.title = 'บอทเปลี่ยนท่า';
        res.cardName = m ? (def(m).name) : 'มอนสเตอร์';
        res.desc = 'เปลี่ยนเป็นท่า ' + (m && m.position === 'atk' ? 'โจมตี' : 'ป้องกัน') + ' ที่ช่อง ' + (act.slot + 1);
        res.inst = m;
        break;
      }
      case 'advancePhase': {
        res.icon = '⏩';
        res.title = 'บอทเปลี่ยนเฟส';
        res.desc = 'เปลี่ยนเป็น ' + (s.phase[st.phase] || st.phase);
        break;
      }
      case 'endTurn': {
        res.icon = '⏭️';
        res.title = 'บอทจบเทิร์น';
        res.desc = 'สิ้นสุดเทิร์นของบอท';
        break;
      }
      case 'activateResponse': {
        res.icon = '⛓️';
        res.title = 'บอทตอบโต้ใน Chain';
        res.cardName = act.name || act.cardId || '';
        res.desc = 'ใช้งานการตอบโต้ใน Chain';
        break;
      }
      default:
        res.title = 'บอท: ' + act.type;
        break;
    }
    return res;
  }

  function showBotBanner(bannerData, delayMs) {
    clearTimeout(bannerTimer);
    botBannerText = bannerData;
    botBannerFade = false;

    // Auto-inspect the bot's card so the sidebar shows full card text immediately
    if (bannerData && bannerData.inst) {
      CG.ui.lastInspectedInst = bannerData.inst;
      const inspectEl = $('inspect');
      if (inspectEl) inspectEl.innerHTML = V().inspectHtml(bannerData.inst, viewer());
    }

    render();
    const fadeAfter = Math.max(700, delayMs - 450);
    bannerTimer = setTimeout(() => {
      botBannerFade = true;
      render();
      bannerTimer = setTimeout(() => {
        botBannerText = null;
        botBannerFade = false;
        render();
      }, 450);
    }, fadeAfter);
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

    // Snapshot card before action executes and alters hands/slots
    let cardBeforeAct = null;
    const botPlayer = state.players[idx];
    if (botPlayer) {
      if (a.handIdx !== undefined && botPlayer.hand && botPlayer.hand[a.handIdx]) {
        cardBeforeAct = botPlayer.hand[a.handIdx];
      } else if (a.slot !== undefined && botPlayer.monsters && botPlayer.monsters[a.slot]) {
        cardBeforeAct = botPlayer.monsters[a.slot];
      } else if (a.from !== undefined && botPlayer.monsters && botPlayer.monsters[a.from]) {
        cardBeforeAct = botPlayer.monsters[a.from];
      } else if (a.spellSlot !== undefined && botPlayer.spells && botPlayer.spells[a.spellSlot]) {
        cardBeforeAct = botPlayer.spells[a.spellSlot];
      } else if (a.extraIdx !== undefined && botPlayer.extra && botPlayer.extra[a.extraIdx]) {
        cardBeforeAct = botPlayer.extra[a.extraIdx];
      }
    }

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

    const isMajor = ['normalSummon', 'tributeSummon', 'extraSummon', 'overlay', 'activateSpell', 'activateEffect', 'attack', 'flipSummon'].includes(a.type);
    const isSet = ['setMonster', 'setSpell'].includes(a.type);

    let bannerDelay;
    if (currentSpeed === 'slow') {
      bannerDelay = isMajor ? 5200 : (isSet ? 4200 : 2800);
    } else if (currentSpeed === 'fast') {
      bannerDelay = isMajor ? 2000 : (isSet ? 1400 : 900);
    } else {
      // Normal speed (default) - much slower, calm, cinematic and readable
      bannerDelay = isMajor ? 3800 : (isSet ? 3000 : 2000);
    }

    const bannerData = formatBotBanner(state, a, r.events, cardBeforeAct);
    showBotBanner(bannerData, bannerDelay);

    render();

    clearTimeout(timer);
    const nextBot = botToAct();
    if (nextBot !== null) {
      botBusy = true;
      timer = setTimeout(() => botStep(nextBot), bannerDelay);
    } else {
      // Even if nextBot is null (e.g. turn ended / handed to player), keep botBusy = true until the banner finishes!
      botBusy = true;
      timer = setTimeout(() => {
        botBusy = false;
        render();
      }, bannerDelay);
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
    const thinkDelay = state.phase === 'mulligan'
      ? 300
      : (currentSpeed === 'slow' ? 3500 : currentSpeed === 'fast' ? 800 : 2400);
    timer = setTimeout(() => botStep(b), thinkDelay);
  }

  // ---------------- ระบบลากวางการ์ด (Drag & Drop Summon & Attack) ----------------
  function updateTargetArrow(x1, y1, x2, y2) {
    if (typeof document === 'undefined' || typeof document.createElementNS !== 'function') return;
    let svg = document.getElementById('dragTargetSvg');
    if (!svg) {
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.id = 'dragTargetSvg';
      svg.setAttribute('style', 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;');
      svg.innerHTML = '<defs>' +
        '<marker id="dndArrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">' +
          '<polygon points="0 0, 8 3, 0 6" fill="#ff2a6d" />' +
        '</marker>' +
      '</defs>' +
      '<line id="dndTargetLineBg" stroke="#ff0055" stroke-width="6" stroke-linecap="round" opacity="0.4" />' +
      '<line id="dndTargetLineFg" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-dasharray="6 4" marker-end="url(#dndArrowhead)" />';
      document.body.appendChild(svg);
    }
    const bg = svg.getElementById('dndTargetLineBg');
    const fg = svg.getElementById('dndTargetLineFg');
    if (bg && fg) {
      bg.setAttribute('x1', x1); bg.setAttribute('y1', y1); bg.setAttribute('x2', x2); bg.setAttribute('y2', y2);
      fg.setAttribute('x1', x1); fg.setAttribute('y1', y1); fg.setAttribute('x2', x2); fg.setAttribute('y2', y2);
    }
  }

  function removeTargetArrow() {
    if (typeof document === 'undefined') return;
    const svg = document.getElementById('dragTargetSvg');
    if (svg && svg.parentNode) svg.parentNode.removeChild(svg);
  }

  function cleanupDragVisuals() {
    if (typeof document === 'undefined') return;
    if (ghostEl && ghostEl.parentNode) {
      ghostEl.parentNode.removeChild(ghostEl);
      ghostEl = null;
    }
    removeTargetArrow();
    if (typeof document.querySelectorAll === 'function') {
      document.querySelectorAll('.drag-legal-slot, .drag-legal-board, .attack-target-legal, .drag-hover-active')
        .forEach(el => el.classList.remove('drag-legal-slot', 'drag-legal-board', 'attack-target-legal', 'drag-hover-active'));
    }
  }

  function onPointerDown(e) {
    if (!state || state.ended || botToAct() !== null || state.pending) return;
    const v = viewer(), p = state.players[v];
    if (state.activeIdx !== v) return;

    const game = $('game');
    if (!game || !game.contains(e.target)) return;
    if (e.target.closest('button, [data-ov], .quick-act-btn, .modal')) return;

    const handCardEl = e.target.closest('.card[data-hand]');
    if (handCardEl) {
      const idx = Number(handCardEl.dataset.hand);
      if (p.hand[idx]) {
        dragState = {
          type: 'hand',
          handIdx: idx,
          card: p.hand[idx],
          startX: e.clientX,
          startY: e.clientY,
          isDragging: false,
          sourceEl: handCardEl
        };
        return;
      }
    }

    if (state.phase === 'battle') {
      const fieldCardEl = e.target.closest('.slot[data-p="' + v + '"][data-slot] .card');
      if (fieldCardEl) {
        const slotEl = fieldCardEl.closest('[data-slot]');
        const slotIdx = Number(slotEl.dataset.slot);
        const m = p.monsters[slotIdx];
        if (m && !m.faceDown && m.position === 'atk') {
          const legals = E().getLegalActions(state, v);
          const hasAtk = legals.some(a => a.type === 'attack' && a.from === slotIdx);
          if (hasAtk) {
            dragState = {
              type: 'attack',
              fromSlot: slotIdx,
              startX: e.clientX,
              startY: e.clientY,
              isDragging: false,
              sourceEl: fieldCardEl
            };
            return;
          }
        }
      }
    }
  }

  function onPointerMove(e) {
    if (!dragState) return;
    const isTouch = e.pointerType === 'touch';
    const dist = Math.hypot(e.clientX - dragState.startX, e.clientY - dragState.startY);
    const threshold = isTouch ? 25 : 10;

    if (!dragState.isDragging && dist > threshold) {
      dragState.isDragging = true;
      AudioFX.play('card_drag');
      const v = viewer(), legals = E().getLegalActions(state, v);

      if (dragState.type === 'hand') {
        ghostEl = dragState.sourceEl.cloneNode(true);
        ghostEl.className = 'card dragging-card-ghost';
        ghostEl.style.left = e.clientX + 'px';
        ghostEl.style.top = e.clientY + 'px';
        document.body.appendChild(ghostEl);

        const myLegals = legals.filter(a => a.handIdx === dragState.handIdx);
        myLegals.forEach(a => {
          if (a.type === 'normalSummon' || a.type === 'setMonster') {
            const slotEl = document.querySelector('.slot[data-p="' + v + '"][data-slot="' + a.slot + '"]');
            if (slotEl) slotEl.classList.add('drag-legal-slot');
          }
          if (a.type === 'setSpell') {
            const slotEl = document.querySelector('.slot[data-p="' + v + '"][data-spell-slot="' + a.slot + '"]');
            if (slotEl) slotEl.classList.add('drag-legal-slot');
          }
          if (a.type === 'activateSpell') {
            const c = p.hand[dragState.handIdx];
            const d = E().cardOf(c);
            if (d && (d.field || d.group === 'field')) {
              const fieldEl = document.querySelector('.sketch-field-slot');
              if (fieldEl) fieldEl.classList.add('drag-legal-slot');
            }
            const boardEl = document.querySelector('.board');
            if (boardEl) boardEl.classList.add('drag-legal-board');
          }
          if (a.type === 'overlay') {
            const slotEl = document.querySelector('.slot[data-p="' + v + '"][data-slot="' + a.targetSlot + '"]');
            if (slotEl) slotEl.classList.add('drag-legal-slot');
          }
        });
      } else if (dragState.type === 'attack') {
        const atkLegals = legals.filter(a => a.type === 'attack' && a.from === dragState.fromSlot);
        atkLegals.forEach(a => {
          if (a.to !== null) {
            const targetEl = document.querySelector('.slot[data-p="' + (1 - v) + '"][data-slot="' + a.to + '"]');
            if (targetEl) targetEl.classList.add('attack-target-legal');
          } else {
            const lpEl = document.querySelector('[data-lp="' + (1 - v) + '"]') || document.querySelector('.opp .player-avatar-circle');
            if (lpEl) lpEl.classList.add('attack-target-legal');
          }
        });
      }
    }

    if (dragState.isDragging) {
      if (e.cancelable) e.preventDefault();
      if (ghostEl) {
        ghostEl.style.left = e.clientX + 'px';
        ghostEl.style.top = e.clientY + 'px';
      }
      if (dragState.type === 'attack') {
        const rect = dragState.sourceEl.getBoundingClientRect();
        updateTargetArrow(rect.left + rect.width / 2, rect.top + rect.height / 2, e.clientX, e.clientY);
      }

      document.querySelectorAll('.drag-hover-active').forEach(el => el.classList.remove('drag-hover-active'));
      const hoverEl = document.elementFromPoint(e.clientX, e.clientY);
      if (hoverEl) {
        const targetSlot = hoverEl.closest('.drag-legal-slot, .attack-target-legal');
        if (targetSlot) targetSlot.classList.add('drag-hover-active');
      }
    }
  }

  function onPointerUp(e) {
    if (!dragState) return;
    let didAction = false;
    if (dragState.isDragging) {
      const v = viewer(), legals = E().getLegalActions(state, v);
      const hoverEl = document.elementFromPoint(e.clientX, e.clientY);

      if (dragState.type === 'hand' && hoverEl) {
        const myLegals = legals.filter(a => a.handIdx === dragState.handIdx);

        const monSlotEl = hoverEl.closest('.slot[data-p="' + v + '"][data-slot]');
        if (monSlotEl) {
          const slot = Number(monSlotEl.dataset.slot);
          const actSummon = myLegals.find(a => a.type === 'normalSummon' && a.slot === slot);
          const actSet = myLegals.find(a => a.type === 'setMonster' && a.slot === slot);
          const actOverlay = myLegals.find(a => a.type === 'overlay' && a.targetSlot === slot);
          if (actSummon) { act(actSummon); didAction = true; }
          else if (actSet) { act(actSet); didAction = true; }
          else if (actOverlay) { act(actOverlay); didAction = true; }
        } else {
          const spellSlotEl = hoverEl.closest('.slot[data-p="' + v + '"][data-spell-slot]');
          if (spellSlotEl) {
            const slot = Number(spellSlotEl.dataset.spellSlot);
            const actSetSpell = myLegals.find(a => a.type === 'setSpell' && a.slot === slot);
            if (actSetSpell) { act(actSetSpell); didAction = true; }
          } else {
            const fieldSlotEl = hoverEl.closest('.sketch-field-slot');
            if (fieldSlotEl) {
              const actSpell = myLegals.find(a => a.type === 'activateSpell');
              if (actSpell) { act(actSpell); didAction = true; }
            } else {
              const boardEl = hoverEl.closest('.board');
              if (boardEl) {
                const actSpell = myLegals.find(a => a.type === 'activateSpell');
                if (actSpell) { act(actSpell); didAction = true; }
              }
            }
          }
        }
      } else if (dragState.type === 'attack' && hoverEl) {
        const atkLegals = legals.filter(a => a.type === 'attack' && a.from === dragState.fromSlot);

        const oppSlotEl = hoverEl.closest('.slot[data-p="' + (1 - v) + '"][data-slot]');
        if (oppSlotEl) {
          const targetSlot = Number(oppSlotEl.dataset.slot);
          const attackAct = atkLegals.find(a => a.to === targetSlot);
          if (attackAct) { act(attackAct); didAction = true; }
        } else {
          const isOppArea = hoverEl.closest('[data-lp="' + (1 - v) + '"]') ||
                            hoverEl.closest('.opp') ||
                            hoverEl.closest('.opp-row');
          if (isOppArea) {
            const directAct = atkLegals.find(a => a.to === null);
            if (directAct) { act(directAct); didAction = true; }
          }
        }
      }
    }

    if (didAction) {
      justDragged = true;
      setTimeout(() => { justDragged = false; }, 120);
    } else {
      justDragged = false;
    }

    cleanupDragVisuals();
    dragState = null;
  }

  function onPointerCancel() {
    cleanupDragVisuals();
    dragState = null;
  }

  function initDragAndDrop() {
    if (dndInitialized || typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
    dndInitialized = true;
    window.addEventListener('pointerdown', onPointerDown, { passive: false });
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp, { passive: false });
    window.addEventListener('pointercancel', onPointerCancel, { passive: false });
  }

  function setupNetworkHandlers() {
    if (!CG.network) return;

    CG.network.on('gameStart', (msg) => {
      const modals = document.querySelectorAll('.wf-modal-overlay');
      modals.forEach(m => m.remove());

      mode = 'online';
      state = msg.state;
      toast('⚔️ เริ่มการดวล! คุณกำลังสู้กับ ' + (msg.opponentName || 'คู่แข่ง'));
      AudioFX.startBGM();
      endSoundPlayed = false;
      cleanupDragVisuals();
      sel = null; handSel = new Set(); pendingSel = new Set(); evBuf = []; confirmedViewer = null;
      phaseMenuOpen = false;
      CG.ui.inspectCard = null;
      CG.ui.inspectPendingCard = null;
      CG.ui.timers.p0 = 0; CG.ui.timers.p1 = 0; CG.ui.timers.lastTick = Date.now();
      ensureTimer();
      botBusy = false; botBannerText = null; botBannerFade = false; cardHl = {}; ghosts = {};
      $('lobby').classList.add('hidden'); $('game').classList.remove('hidden');
      $('game').onclick = onClick;
      $('game').onmouseover = onHover;
      render();
    });

    CG.network.on('stateUpdate', (msg) => {
      state = msg.state;
      if (msg.events && msg.events.length) {
        evBuf = evBuf.concat(msg.events);
      }
      afterAction();
    });

    CG.network.on('actionRejected', (msg) => {
      toast('⚠ ' + (msg.reason || 'คำสั่งไม่สามารถทำได้'));
      render();
    });

    CG.network.on('opponentDisconnected', (msg) => {
      toast('⏳ คู่แข่งหลุดการเชื่อมต่อ รอเชื่อมต่อใหม่ ' + (msg.graceSeconds || 45) + ' วินาที...');
      render();
    });

    CG.network.on('opponentReconnected', () => {
      toast('⚡ คู่แข่งเชื่อมต่อกลับเข้ามาแล้ว!');
      render();
    });

    CG.network.on('error', (err) => {
      toast('❌ ' + err);
    });
  }

  // 5D/7A: Alias botChoose to CG.bot.choose
  CG.ui.botChoose = (st, idx, legal, opts) => (CG.bot && CG.bot.choose ? CG.bot.choose(st, idx, legal, opts) : null);
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { chooseAction: CG.ui.botChoose, botChoose: CG.ui.botChoose };
  }

  CG.ui.app = { start: lobby, _render: () => render(), _debug: () => ({ state, mode }) };
  if (typeof document !== 'undefined') {
    initDragAndDrop();
    setupNetworkHandlers();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  }
})();
