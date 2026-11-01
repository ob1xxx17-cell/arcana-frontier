// ui/deck_builder.js - หน้าต่างจัดการและปรับแต่งเด็ค (Deck Builder UI)
(function () {
  const CG = (globalThis.CG = globalThis.CG || {});
  CG.ui = CG.ui || {};
  const DB = CG.deckBuilder;
  const V = () => CG.ui.view;
  const S = () => CG.ui.strings;
  const $ = (id) => document.getElementById(id);

  // เชื่อมต่อ LocalStorage ของเบราว์เซอร์เข้ากับระบบ Engine Deck Builder
  if (typeof window !== 'undefined' && window.localStorage && DB) {
    DB.setStorageAdapter(window.localStorage);
    DB.syncToCGCards();
  }

  let activeDeck = null;
  let activeKey = null;
  let activeTab = 'all'; // 'all', 'monster', 'spell', 'extra'
  let deckSectionTab = 'all'; // 'all', 'main', 'extra'
  let deckViewMode = 'grid'; // 'grid', 'list'
  let searchQuery = '';
  let inspectCardDef = null;
  let onSaveCallback = null;
  let lastRenderedTab = null;
  let lastRenderedDeckKey = null;

  function initDeckBuilder() {
    if (!DB) return;
    DB.syncToCGCards();
  }

  function openDeckBuilder(defaultDeckKey, onSave) {
    onSaveCallback = onSave;
    const cards = CG.cards || {};
    const acc = CG.account && CG.account.current;
    const unlocked = (acc && Array.isArray(acc.unlockedDecks) && acc.unlockedDecks.length)
      ? acc.unlockedDecks
      : null;

    const availableKeys = Object.keys(cards).filter(k => {
      const d = cards[k];
      if (!d) return false;
      if (d.isCustom) return true;
      if (!unlocked) return true;
      return unlocked.includes(k);
    });

    let chosen = defaultDeckKey;
    if (!chosen || !cards[chosen] || (unlocked && !availableKeys.includes(chosen))) {
      chosen = availableKeys[0] || Object.keys(cards)[0] || 'dinosaur';
    }

    activeKey = chosen;
    loadDeckToEdit(activeKey);
    renderModal();
  }

  function closeDeckBuilder() {
    const el = $('deckBuilderModal');
    if (el) el.remove();
    if (onSaveCallback) onSaveCallback(activeKey);
  }

  function loadDeckToEdit(key) {
    activeKey = key;
    const cards = CG.cards || {};
    const src = cards[key];
    if (!src) return;

    // ทำ deep copy เพื่อไม่ให้กระทบเด็คจริงจนกว่าจะกดบันทึก
    activeDeck = {
      key: src.key,
      name: src.name,
      isCustom: !!src.isCustom,
      main: (src.main || []).map(c => Object.assign({}, DB.findCardDef(c.id) || {}, c)),
      extra: (src.extra || []).map(c => Object.assign({}, DB.findCardDef(c.id) || {}, c))
    };
  }

  function countCardInDeck(cardId) {
    if (!activeDeck) return 0;
    let n = 0;
    for (const c of (activeDeck.main || [])) {
      if (c.id === cardId) n += (c.count || 1);
    }
    for (const c of (activeDeck.extra || [])) {
      if (c.id === cardId) n += (c.count || 1);
    }
    return n;
  }

  function addCardToDeck(cardDef) {
    if (!activeDeck || !cardDef) return;
    const isExtra = cardDef.isExtra || cardDef.type === 'fusion' || cardDef.type === 'grade4';
    const currentCount = countCardInDeck(cardDef.id);

    if (currentCount >= DB.RULES.maxCopies) {
      toast('ใส่การ์ด "' + cardDef.name + '" ได้ไม่เกิน ' + DB.RULES.maxCopies + ' ใบ');
      return;
    }

    if (isExtra) {
      if (cardDef.type === 'fusion') {
        const currentFusion = (activeDeck.extra || []).reduce((sum, c) => {
          const d = DB.findCardDef(c.id);
          return (d && d.type === 'fusion') ? sum + (c.count || 1) : sum;
        }, 0);
        if (currentFusion >= DB.RULES.maxFusion) {
          toast('การ์ด Fusion ใน Extra Deck ครบโควตา ' + DB.RULES.maxFusion + ' ใบแล้ว');
          return;
        }
      } else if (cardDef.type === 'grade4') {
        const currentGrade4 = (activeDeck.extra || []).reduce((sum, c) => {
          const d = DB.findCardDef(c.id);
          return (d && d.type === 'grade4') ? sum + (c.count || 1) : sum;
        }, 0);
        if (currentGrade4 >= DB.RULES.maxGrade4) {
          toast('การ์ด Grade 4 ใน Extra Deck ครบโควตา ' + DB.RULES.maxGrade4 + ' ใบแล้ว');
          return;
        }
      }
    }

    const list = isExtra ? activeDeck.extra : activeDeck.main;
    const maxLimit = isExtra ? DB.RULES.maxExtra : DB.RULES.maxMain;
    const currentTotal = list.reduce((sum, c) => sum + (c.count || 1), 0);

    if (currentTotal >= maxLimit) {
      toast((isExtra ? 'Extra Deck' : 'เด็คหลัก') + ' เต็มแล้ว (' + maxLimit + ' ใบ)');
      return;
    }

    const item = list.find(c => c.id === cardDef.id);
    if (item) {
      item.count = (item.count || 1) + 1;
    } else {
      list.push(Object.assign({}, cardDef, { count: 1 }));
    }

    renderModal();
  }

  function removeCardFromDeck(cardId, isExtra) {
    if (!activeDeck) return;
    const list = isExtra ? activeDeck.extra : activeDeck.main;
    const idx = list.findIndex(c => c.id === cardId);
    if (idx < 0) return;

    if ((list[idx].count || 1) > 1) {
      list[idx].count -= 1;
    } else {
      list.splice(idx, 1);
    }

    renderModal();
  }

  function deleteCardEntry(cardId, isExtra) {
    if (!activeDeck) return;
    const list = isExtra ? activeDeck.extra : activeDeck.main;
    const idx = list.findIndex(c => c.id === cardId);
    if (idx >= 0) {
      list.splice(idx, 1);
      renderModal();
    }
  }

  function saveCurrentDeck() {
    if (!activeDeck) return;
    if (!activeDeck.isCustom) {
      // หากเป็นเด็คระบบ บังคับให้คัดลอกเป็นเด็คใหม่
      cloneCurrentDeck();
      return;
    }

    const nameInput = $('dbDeckNameInput');
    if (nameInput && nameInput.value.trim()) {
      activeDeck.name = nameInput.value.trim();
    }

    const val = DB.validateDeck(activeDeck);
    if (!val.valid) {
      alert('เด็คยังไม่ถูกต้องตามกติกา:\n\n• ' + val.errors.join('\n• '));
      return;
    }

    const res = DB.saveCustomDeck(activeDeck);
    if (res.ok) {
      if (CG.cards) CG.cards[activeDeck.key] = res.deck || activeDeck;
      toast('💾 บันทึกเด็ค "' + activeDeck.name + '" เรียบร้อยแล้ว!');
      loadDeckToEdit(activeDeck.key);
      renderModal();
    } else {
      alert('เกิดข้อผิดพลาดในการบันทึก: ' + (res.errors ? res.errors.join(', ') : res.error));
    }
  }

  function createNewDeck() {
    const count = DB.loadCustomDecks().length + 1;
    // ใช้เด็คปัจจุบันเป็นโครงร่างเริ่มต้น หรือสร้างใหม่
    const baseKey = (activeDeck && activeDeck.key) ? activeDeck.key : null;
    const newDeck = DB.createTemplateDeck('เด็คของฉัน ' + count, baseKey);
    newDeck.isCustom = true;
    if (CG.cards) CG.cards[newDeck.key] = newDeck;
    activeDeck = newDeck;
    activeKey = newDeck.key;
    renderModal();
    toast('✨ สร้างเด็คใหม่ "' + newDeck.name + '" สำเร็จ! สามารถแก้ไขและเปลี่ยนการ์ดได้ตามใจชอบ');
  }

  function cloneCurrentDeck() {
    if (!activeDeck) return;
    const count = DB.loadCustomDecks().length + 1;
    const clone = DB.createTemplateDeck(activeDeck.name + ' (ฉบับแก้ไข ' + count + ')', activeDeck.key);
    clone.isCustom = true;
    if (CG.cards) CG.cards[clone.key] = clone;
    activeDeck = clone;
    activeKey = clone.key;
    renderModal();
    toast('📋 คัดลอกเด็ค "' + clone.name + '" เรียบร้อย คุณสามารถปรับแต่งและบันทึกได้เลย');
  }

  function deleteCurrentDeck() {
    if (!activeDeck || !activeDeck.isCustom) return;
    if (confirm('คุณต้องการลบเด็ค "' + activeDeck.name + '" ใช่หรือไม่?')) {
      DB.deleteCustomDeck(activeDeck.key);
      const keys = Object.keys(CG.cards || {});
      loadDeckToEdit(keys[0] || 'dinosaur');
      renderModal();
      toast('🗑️ ลบเด็คเรียบร้อยแล้ว');
    }
  }

  function toast(msg) {
    const root = $('toastRoot');
    if (!root) return;
    const t = document.createElement('div');
    t.id = 'toast';
    t.textContent = msg;
    root.innerHTML = '';
    root.appendChild(t);
    setTimeout(() => { if (t.parentNode) t.remove(); }, 2600);
  }

  function renderModal() {
    let modal = $('deckBuilderModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'deckBuilderModal';
      modal.className = 'overlay deck-builder-overlay';
      modal.style.zIndex = '95';
      document.body.appendChild(modal);
    }

    // เก็บตำแหน่ง Scroll เดิมของทั้งสองฝั่ง (เด็คฝั่งซ้าย และ แคตตาล็อกการ์ดฝั่งขวา) ป้องกันไม่ให้เด้งขึ้นบนสุดเวลาบวก/ลบการ์ด
    let deckScrollTop = 0;
    let catalogScrollTop = 0;
    const oldDeckScroll = modal.querySelector('.db-deck-scroll');
    if (oldDeckScroll) deckScrollTop = oldDeckScroll.scrollTop;
    const oldCatalogScroll = modal.querySelector('.db-catalog-grid');
    if (oldCatalogScroll) catalogScrollTop = oldCatalogScroll.scrollTop;

    // หากมีการเปลี่ยนแท็บประเภทการ์ด หรือสลับเด็ค ให้เริ่มเลื่อนจากบนสุด
    if (lastRenderedTab !== activeTab) {
      catalogScrollTop = 0;
      lastRenderedTab = activeTab;
    }
    if (lastRenderedDeckKey !== activeKey) {
      deckScrollTop = 0;
      catalogScrollTop = 0;
      lastRenderedDeckKey = activeKey;
    }

    const cards = CG.cards || {};
    const acc = CG.account && CG.account.current;
    const unlocked = (acc && Array.isArray(acc.unlockedDecks) && acc.unlockedDecks.length)
      ? acc.unlockedDecks
      : null;

    // โหลดเด็ค Custom ทั้งหมดที่บันทึกไว้เข้าสู่ cards
    const savedCustom = DB.loadCustomDecks();
    if (Array.isArray(savedCustom)) {
      savedCustom.forEach(cd => {
        if (cd && cd.key) cards[cd.key] = cd;
      });
    }

    // ถ้ามี activeDeck ที่กำลังสร้างใหม่หรือแก้ไขอยู่ ให้แน่ใจว่าอยู่ใน cards เสมอ
    if (activeDeck && activeDeck.key) {
      cards[activeDeck.key] = activeDeck;
    }

    // เลือกเฉพาะเด็คที่ปลดล็อกแล้ว หรือเด็ค Custom
    const allKeys = Object.keys(cards);
    const deckKeys = allKeys.filter(k => {
      const d = cards[k];
      if (!d) return false;
      if (d.isCustom) return true;
      if (!unlocked) return true;
      return unlocked.includes(k);
    });

    if (!deckKeys.includes(activeKey) && deckKeys.length > 0) {
      activeKey = deckKeys[0];
      loadDeckToEdit(activeKey);
    }

    // รวบรวมการ์ดของผู้เล่น (Owned Cards / Starter Deck Cards)
    let ownedCardIds = null;
    if (acc && Array.isArray(acc.ownedCards) && acc.ownedCards.length > 0) {
      ownedCardIds = acc.ownedCards;
    } else {
      try {
        const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('cg_owned_cards') : null;
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) ownedCardIds = parsed;
        }
      } catch (_) {}
    }

    let allDefs = [];
    if (ownedCardIds && ownedCardIds.length > 0) {
      const seen = new Set();
      ownedCardIds.forEach(id => {
        if (!seen.has(id)) {
          seen.add(id);
          const def = DB.findCardDef(id);
          if (def) allDefs.push(def);
        }
      });
      // รวมการ์ดที่มีอยู่ในเด็คปัจจุบันด้วย (เผื่อมี)
      if (activeDeck) {
        const checkList = [].concat(activeDeck.main || [], activeDeck.extra || []);
        checkList.forEach(item => {
          if (item && item.id && !seen.has(item.id)) {
            seen.add(item.id);
            const def = DB.findCardDef(item.id);
            if (def) allDefs.push(def);
          }
        });
      }
    } else if (unlocked && unlocked.length > 0) {
      allDefs = DB.getAllCardDefs(unlocked);
    } else {
      allDefs = DB.getAllCardDefs(activeKey ? [activeKey] : ['dinosaur']);
    }

    const val = DB.validateDeck(activeDeck);
    const isCustom = activeDeck && activeDeck.isCustom;

    // Deck Selector Dropdown Options
    const deckOptions = deckKeys.map(k => {
      const d = cards[k];
      const isCur = (k === activeKey);
      const tag = d.isCustom ? '🛠️ ' : '👑 ';
      return '<option value="' + k + '" ' + (isCur ? 'selected' : '') + '>' + tag + V().esc(d.name) + '</option>';
    }).join('');

    // Catalog filtering
    const filteredDefs = allDefs.filter(def => {
      // 1. Tab filter
      if (activeTab === 'monster' && (def.type === 'spell' || def.isExtra)) return false;
      if (activeTab === 'spell' && def.type !== 'spell') return false;
      if (activeTab === 'extra' && !def.isExtra && def.type !== 'fusion' && def.type !== 'grade4') return false;

      // 2. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchName = (def.name || '').toLowerCase().includes(q);
        const matchText = (def.text || '').toLowerCase().includes(q);
        const matchTags = (def.tags || []).some(t => t.toLowerCase().includes(q));
        const matchType = (def.type || '').toLowerCase().includes(q);
        if (!matchName && !matchText && !matchTags && !matchType) return false;
      }
      return true;
    });

    // Deck contents rendering
    const mainList = activeDeck ? (activeDeck.main || []) : [];
    const extraList = activeDeck ? (activeDeck.extra || []) : [];
    const mainCount = mainList.reduce((sum, c) => sum + (c.count || 1), 0);
    const extraCount = extraList.reduce((sum, c) => sum + (c.count || 1), 0);
    const fusionCount = extraList.reduce((sum, c) => {
      const def = DB.findCardDef(c.id);
      return (def && def.type === 'fusion') ? sum + (c.count || 1) : sum;
    }, 0);
    const grade4Count = extraList.reduce((sum, c) => {
      const def = DB.findCardDef(c.id);
      return (def && def.type === 'grade4') ? sum + (c.count || 1) : sum;
    }, 0);

    const mainValid = mainCount >= DB.RULES.minMain && mainCount <= DB.RULES.maxMain;
    const fusionValid = fusionCount <= DB.RULES.maxFusion;
    const grade4Valid = grade4Count <= DB.RULES.maxGrade4;
    const extraValid = extraCount <= DB.RULES.maxExtra && fusionValid && grade4Valid;

    const renderDeckCardGrid = (list, isExtra) => {
      if (!list.length) return '<div class="db-empty-list">(ยังไม่มีการ์ดในส่วนนี้ — แตะการ์ดจากฝั่งขวาเพื่อเพิ่มลงเด็ค)</div>';
      return '<div class="db-deck-card-grid">' + list.map(item => {
        const def = DB.findCardDef(item.id) || { id: item.id, cardId: item.id, name: item.id, type: 'monster', atk: 0, def: 0, level: 1 };
        const isMax = (item.count || 1) >= DB.RULES.maxCopies;
        return '<div class="db-deck-card-item" data-db-card="' + def.id + '" data-db-extra="' + (isExtra ? '1' : '0') + '" title="' + V().esc(def.name) + '">' +
          '<div class="db-deck-card-badge">x' + (item.count || 1) + '</div>' +
          '<div class="db-deck-card-wrap" data-db-act="inspectDeckCard" title="แตะเพื่อดูการ์ดขยาย">' +
            V().cardHtml(Object.assign({ cardId: def.id }, def), { reveal: true, field: false }) +
          '</div>' +
          '<div class="db-deck-card-name" title="' + V().esc(def.name) + '">' + V().esc(def.name) + '</div>' +
          '<div class="db-deck-card-controls">' +
            '<button class="db-btn-step" data-db-act="minus" title="ลด 1 ใบ">-</button>' +
            '<span class="db-count-badge">' + (item.count || 1) + '</span>' +
            '<button class="db-btn-step ' + (isMax ? 'disabled' : '') + '" data-db-act="plus" ' + (isMax ? 'disabled' : '') + ' title="เพิ่ม 1 ใบ">+</button>' +
            '<button class="db-btn-inspect" data-db-act="inspectDeckCard" title="ดูการ์ดขยายเต็ม">🔍</button>' +
            '<button class="db-btn-del" data-db-act="del" title="ลบทั้งหมด">✕</button>' +
          '</div>' +
        '</div>';
      }).join('') + '</div>';
    };

    const renderDeckList = (list, isExtra) => {
      if (!list.length) return '<div class="db-empty-list">(ยังไม่มีการ์ดในส่วนนี้)</div>';
      return '<div class="db-deck-rows">' + list.map(item => {
        const def = DB.findCardDef(item.id) || { id: item.id, cardId: item.id, name: item.id, type: 'monster', atk: 0, def: 0, level: 1 };
        const mon = def.type !== 'spell';
        const statLine = mon
          ? 'Lv' + (def.level || 1) + ' · ' + (def.atk || 0) + '/' + (def.def || 0)
          : (def.group || 'ปกติ');
        const isMax = (item.count || 1) >= DB.RULES.maxCopies;

        return '<div class="db-deck-card-row" data-db-card="' + def.id + '" data-db-extra="' + (isExtra ? '1' : '0') + '">' +
          '<div class="db-row-card-mini" data-db-act="inspectDeckCard" title="แตะเพื่อดูการ์ดขยาย">' +
            V().cardHtml(Object.assign({ cardId: def.id }, def), { reveal: true, field: false }) +
          '</div>' +
          '<div class="db-row-info">' +
            '<div class="db-row-name" title="' + V().esc(def.name) + '">' + V().esc(def.name) + '</div>' +
            '<div class="db-row-stats">' + V().esc(statLine) + '</div>' +
          '</div>' +
          '<div class="db-row-controls">' +
            '<button class="db-btn-step" data-db-act="minus" title="ลด 1 ใบ">-</button>' +
            '<span class="db-count-badge">' + (item.count || 1) + '</span>' +
            '<button class="db-btn-step ' + (isMax ? 'disabled' : '') + '" data-db-act="plus" ' + (isMax ? 'disabled' : '') + ' title="เพิ่ม 1 ใบ">+</button>' +
            '<button class="db-btn-inspect" data-db-act="inspectDeckCard" title="ดูการ์ดขยาย">🔍</button>' +
            '<button class="db-btn-del" data-db-act="del" title="ลบทั้งหมด">✕</button>' +
          '</div>' +
        '</div>';
      }).join('') + '</div>';
    };

    const renderDeckContent = (list, isExtra) => {
      return (deckViewMode === 'grid') ? renderDeckCardGrid(list, isExtra) : renderDeckList(list, isExtra);
    };

    // Zoom modal preview for inspected card
    const renderZoomModal = (def) => {
      const inDeck = countCardInDeck(def.id);
      const isExtra = def.isExtra || def.type === 'fusion' || def.type === 'grade4';
      const mon = def.type !== 'spell';
      const statLine = mon
        ? 'Level ' + (def.level || 1) + ' · ATK ' + (def.atk || 0) + ' / DEF ' + (def.def || 0)
        : 'สเปล (' + (def.group || 'ปกติ') + ') · ค่าร่ายมานา ' + (def.cost || 0);

      return '<div class="db-zoom-overlay" id="dbZoomOverlay">' +
        '<div class="db-zoom-modal">' +
          '<div class="db-zoom-card-col">' +
            '<div class="db-zoom-card-wrap">' +
              V().cardHtml(Object.assign({ cardId: def.id }, def), { reveal: true, field: false }) +
            '</div>' +
          '</div>' +
          '<div class="db-zoom-info-col">' +
            '<div class="db-zoom-header">' +
              '<h3 class="db-zoom-name">' + V().esc(def.name) + '</h3>' +
              '<button class="db-zoom-close" data-db-zoom-act="close" title="ปิด">✕</button>' +
            '</div>' +
            '<div class="db-zoom-type-tag">' + V().esc(def.type.toUpperCase()) + (def.tags && def.tags.length ? ' · ' + V().esc(def.tags.join(' / ')) : '') + '</div>' +
            '<div class="db-zoom-stats">' + V().esc(statLine) + '</div>' +
            '<div class="db-zoom-effect-title">📜 ความสามารถ (Effect):</div>' +
            '<div class="db-zoom-effect-text">' + V().esc(def.text || '(ไม่มีความสามารถพิเศษ)') + '</div>' +
            '<div class="db-zoom-in-deck-status">ในเด็คปัจจุบันมี: <strong>' + inDeck + ' / ' + DB.RULES.maxCopies + ' ใบ</strong></div>' +
            '<div class="db-zoom-actions">' +
              '<button class="gold db-zoom-btn ' + (inDeck >= DB.RULES.maxCopies ? 'disabled' : '') + '" data-db-zoom-act="add" ' + (inDeck >= DB.RULES.maxCopies ? 'disabled' : '') + '>+ เพิ่มลงเด็ค</button>' +
              '<button class="db-zoom-btn danger ' + (inDeck <= 0 ? 'disabled' : '') + '" data-db-zoom-act="remove" ' + (inDeck <= 0 ? 'disabled' : '') + '>- เอาออกจากเด็ค</button>' +
              '<button class="db-zoom-btn" data-db-zoom-act="close">✕ ปิดหน้าต่าง</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    };

    // Catalog card grid rendering
    const catalogCardsHtml = filteredDefs.map(def => {
      const inDeckCount = countCardInDeck(def.id);
      const isMax = inDeckCount >= DB.RULES.maxCopies;
      const countTag = inDeckCount > 0
        ? '<div class="db-catalog-count-badge ' + (isMax ? 'maxed' : '') + '">' + inDeckCount + '/' + DB.RULES.maxCopies + '</div>'
        : '';

      return '<div class="db-catalog-card-item" data-db-cat-card="' + def.id + '" title="' + V().esc(def.name) + ' (แตะเพื่อใส่ลงเด็ค)">' +
        countTag +
        '<div class="db-cat-card-wrap">' +
          V().cardHtml(Object.assign({ cardId: def.id }, def), { reveal: true, field: false }) +
        '</div>' +
        '<div class="db-cat-card-meta">' +
          '<div class="db-cat-name">' + V().esc(def.name) + '</div>' +
          '<div class="db-cat-actions">' +
            '<button class="db-btn-add ' + (isMax ? 'disabled' : '') + '" data-db-act="addToDeck" ' + (isMax ? 'disabled' : '') + '>+ ใส่เด็ค</button>' +
            '<button class="db-btn-inspect" data-db-act="inspectCatCard" title="ดูรายละเอียดเต็ม">🔍</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    // Deck sections HTML based on deckSectionTab
    let deckSectionsHtml = '';
    if (deckSectionTab === 'all' || deckSectionTab === 'main') {
      deckSectionsHtml += '<div class="db-section-header">⭐ Main Deck (' + mainCount + '/' + DB.RULES.maxMain + ' ใบ)</div>' +
        renderDeckContent(mainList, false);
    }
    if (deckSectionTab === 'all' || deckSectionTab === 'extra') {
      deckSectionsHtml += '<div class="db-section-header" style="margin-top:' + (deckSectionTab === 'all' ? '18px' : '0') + '">🌀 Extra Deck (' + extraCount + '/' + DB.RULES.maxExtra + ' ใบ — Fusion ' + fusionCount + '/' + DB.RULES.maxFusion + ' · Apex ' + grade4Count + '/' + DB.RULES.maxGrade4 + ')</div>' +
        renderDeckContent(extraList, true);
    }

    modal.innerHTML = '<div class="db-container">' +
      // HEADER BAR
      '<div class="db-header">' +
        '<div class="db-header-left">' +
          '<h2>🛠️ ระบบจัดเด็ค (Deck Builder)</h2>' +
          '<div class="db-select-wrap">' +
            '<label>เลือกเด็ค:</label>' +
            '<select id="dbDeckSelect">' + deckOptions + '</select>' +
            '<button class="db-tool-btn" id="dbBtnNew">➕ เด็คใหม่</button>' +
            '<button class="db-tool-btn" id="dbBtnClone">📑 คัดลอก</button>' +
            (isCustom ? '<button class="db-tool-btn danger" id="dbBtnDel">🗑️ ลบเด็ค</button>' : '') +
            (isCustom ? '<button class="db-tool-btn" id="dbBtnClear" title="ล้างการ์ดทั้งหมดเพื่อเริ่มใส่ใหม่จากเด็คว่าง">🧹 ล้างการ์ดในเด็ค</button>' : '') +
          '</div>' +
        '</div>' +
        '<div class="db-header-right">' +
          '<button class="gold db-save-btn" id="dbBtnSave">' + (isCustom ? '💾 บันทึกเด็ค' : '📑 คัดลอกและบันทึก') + '</button>' +
          '<button class="db-close-btn" id="dbBtnClose">✕ ปิด</button>' +
        '</div>' +
      '</div>' +

      // DECK META & STATUS BAR
      '<div class="db-status-bar">' +
        '<div class="db-name-editor">' +
          '<label>ชื่อเด็ค:</label>' +
          '<input type="text" id="dbDeckNameInput" value="' + V().esc(activeDeck ? activeDeck.name : '') + '" ' + (isCustom ? '' : 'disabled') + ' placeholder="ตั้งชื่อเด็คของคุณ...">' +
          (!isCustom ? '<span class="db-builtin-notice">🔒 เด็คระบบ (กด "คัดลอก" เพื่อนำไปแก้ไข)</span>' : '') +
        '</div>' +
        '<div class="db-counters">' +
          '<div class="db-badge ' + (mainValid ? 'ok' : 'err') + '">' +
            'Main: ' + mainCount + '/' + DB.RULES.maxMain + ' ใบ (' + DB.RULES.minMain + '-' + DB.RULES.maxMain + ')' +
          '</div>' +
          '<div class="db-badge ' + (extraValid ? 'ok' : 'err') + '">' +
            'Extra: ' + extraCount + '/' + DB.RULES.maxExtra + ' ใบ (Fusion ' + fusionCount + '/' + DB.RULES.maxFusion + ' · Apex ' + grade4Count + '/' + DB.RULES.maxGrade4 + ')' +
          '</div>' +
          '<div class="db-status-text ' + (val.valid ? 'ok' : 'err') + '">' +
            (val.valid ? '✅ พร้อมใช้งาน' : '⚠️ ยังไม่ครบกติกา') +
          '</div>' +
        '</div>' +
      '</div>' +

      // MAIN SPLIT BODY (50% LEFT: DECK / 50% RIGHT: ALL CARDS)
      '<div class="db-body">' +
        // LEFT HALF (50%): Current Deck List / Grid
        '<div class="db-deck-pane">' +
          '<div class="db-pane-header">' +
            '<div class="db-pane-title-wrap">' +
              '<div class="db-pane-title">⭐ เด็คของคุณ <span class="db-pane-count">(' + (mainCount + extraCount) + ' ใบ)</span></div>' +
            '</div>' +
            '<div class="db-deck-toolbar">' +
              '<div class="db-deck-tabs">' +
                '<button class="db-tab ' + (deckSectionTab === 'all' ? 'active' : '') + '" data-db-deck-tab="all">ทั้งหมด</button>' +
                '<button class="db-tab ' + (deckSectionTab === 'main' ? 'active' : '') + '" data-db-deck-tab="main">Main (' + mainCount + ')</button>' +
                '<button class="db-tab ' + (deckSectionTab === 'extra' ? 'active' : '') + '" data-db-deck-tab="extra">Extra (' + extraCount + ')</button>' +
              '</div>' +
              '<div class="db-view-mode-toggle">' +
                '<button class="db-view-btn ' + (deckViewMode === 'grid' ? 'active' : '') + '" data-db-view="grid" title="แสดงแบบกริดการ์ด (เห็นภาพการ์ดชัด)">🃏 การ์ด</button>' +
                '<button class="db-view-btn ' + (deckViewMode === 'list' ? 'active' : '') + '" data-db-view="list" title="แสดงแบบรายการ">📋 รายการ</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="db-deck-scroll">' +
            deckSectionsHtml +
          '</div>' +
        '</div>' +

        // RIGHT HALF (50%): Card Collection Catalog
        '<div class="db-catalog-pane">' +
          '<div class="db-pane-header">' +
            '<div class="db-pane-title-wrap">' +
              '<div class="db-pane-title">📦 การ์ดทั้งหมด <span class="db-pane-count">(' + filteredDefs.length + '/' + allDefs.length + ' ใบ)</span></div>' +
            '</div>' +
            '<div class="db-catalog-toolbar">' +
              '<div class="db-tabs">' +
                '<button class="db-tab ' + (activeTab === 'all' ? 'active' : '') + '" data-db-tab="all">ทั้งหมด (' + allDefs.length + ')</button>' +
                '<button class="db-tab ' + (activeTab === 'monster' ? 'active' : '') + '" data-db-tab="monster">มอนสเตอร์</button>' +
                '<button class="db-tab ' + (activeTab === 'spell' ? 'active' : '') + '" data-db-tab="spell">สเปล</button>' +
                '<button class="db-tab ' + (activeTab === 'extra' ? 'active' : '') + '" data-db-tab="extra">Extra Deck</button>' +
              '</div>' +
              '<div class="db-search">' +
                '<input type="text" id="dbSearchInput" value="' + V().esc(searchQuery) + '" placeholder="🔍 ค้นหาชื่อการ์ด / เผ่า / เลเวล...">' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="db-catalog-grid">' +
            (filteredDefs.length ? catalogCardsHtml : '<div class="db-no-results">ไม่พบการ์ดที่ตรงกับเงื่อนไขค้นหา</div>') +
          '</div>' +
        '</div>' +
      '</div>' +

      // ZOOM PREVIEW MODAL
      (inspectCardDef ? renderZoomModal(inspectCardDef) : '') +
    '</div>';

    // คืนค่าตำแหน่ง Scroll เดิมทันที เพื่อให้หน้าจอไม่เด้งขึ้นบนสุดเวลาผู้เล่นกดเพิ่ม/ลดการ์ด
    const newDeckScroll = modal.querySelector('.db-deck-scroll');
    if (newDeckScroll && deckScrollTop > 0) {
      newDeckScroll.scrollTop = deckScrollTop;
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => { if (newDeckScroll) newDeckScroll.scrollTop = deckScrollTop; });
      }
    }
    const newCatalogScroll = modal.querySelector('.db-catalog-grid');
    if (newCatalogScroll && catalogScrollTop > 0) {
      newCatalogScroll.scrollTop = catalogScrollTop;
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => { if (newCatalogScroll) newCatalogScroll.scrollTop = catalogScrollTop; });
      }
    }

    attachModalEvents(modal);
  }

  function attachModalEvents(modal) {
    // Dropdown change
    const select = $('dbDeckSelect');
    if (select) {
      select.onchange = (e) => {
        loadDeckToEdit(e.target.value);
        renderModal();
      };
    }

    // Name change
    const nameInput = $('dbDeckNameInput');
    if (nameInput) {
      nameInput.oninput = (e) => {
        if (activeDeck && activeDeck.isCustom) {
          activeDeck.name = e.target.value;
        }
      };
    }

    // Search input
    const searchInput = $('dbSearchInput');
    if (searchInput) {
      searchInput.oninput = (e) => {
        searchQuery = e.target.value;
        renderModal();
        const inp = $('dbSearchInput');
        if (inp) {
          inp.focus();
          inp.selectionStart = inp.selectionEnd = inp.value.length;
        }
      };
    }

    // Toolbar & action buttons
    modal.onclick = (e) => {
      // Zoom modal actions
      const zoomActBtn = e.target.closest('[data-db-zoom-act]');
      if (zoomActBtn) {
        const zAct = zoomActBtn.dataset.dbZoomAct;
        if (zAct === 'close') {
          inspectCardDef = null;
          renderModal();
          return;
        }
        if (zAct === 'add' && inspectCardDef) {
          addCardToDeck(inspectCardDef);
          return;
        }
        if (zAct === 'remove' && inspectCardDef) {
          const isExtra = inspectCardDef.isExtra || inspectCardDef.type === 'fusion' || inspectCardDef.type === 'grade4';
          removeCardFromDeck(inspectCardDef.id, isExtra);
          return;
        }
      }
      if (e.target.id === 'dbZoomOverlay') {
        inspectCardDef = null;
        renderModal();
        return;
      }

      // Close
      if (e.target.closest('#dbBtnClose')) {
        closeDeckBuilder();
        return;
      }
      // Save
      if (e.target.closest('#dbBtnSave')) {
        saveCurrentDeck();
        return;
      }
      // New
      if (e.target.closest('#dbBtnNew')) {
        createNewDeck();
        return;
      }
      // Clone
      if (e.target.closest('#dbBtnClone')) {
        cloneCurrentDeck();
        return;
      }
      // Delete
      if (e.target.closest('#dbBtnDel')) {
        deleteCurrentDeck();
        return;
      }
      // Clear
      if (e.target.closest('#dbBtnClear')) {
        if (!activeDeck || !activeDeck.isCustom) return;
        if (confirm('ต้องการล้างการ์ดทั้งหมดออกจากเด็คเพื่อเริ่มใส่ใหม่ใช่หรือไม่?')) {
          activeDeck.main = [];
          activeDeck.extra = [];
          renderModal();
          toast('🧹 ล้างการ์ดในเด็คเรียบร้อยแล้ว แตะการ์ดฝั่งขวาเพื่อเพิ่มการ์ดใหม่ได้เลย');
        }
        return;
      }

      // Catalog Tab switch
      const tabBtn = e.target.closest('[data-db-tab]');
      if (tabBtn) {
        activeTab = tabBtn.dataset.dbTab;
        renderModal();
        return;
      }

      // Deck Tab switch
      const deckTabBtn = e.target.closest('[data-db-deck-tab]');
      if (deckTabBtn) {
        deckSectionTab = deckTabBtn.dataset.dbDeckTab;
        renderModal();
        return;
      }

      // Deck View Mode switch (grid vs list)
      const viewBtn = e.target.closest('[data-db-view]');
      if (viewBtn) {
        deckViewMode = viewBtn.dataset.dbView;
        renderModal();
        return;
      }

      // Deck card inspect
      const deckInspectBtn = e.target.closest('[data-db-act="inspectDeckCard"]');
      if (deckInspectBtn) {
        const itemEl = deckInspectBtn.closest('[data-db-card]');
        if (itemEl) {
          const cardId = itemEl.dataset.dbCard;
          inspectCardDef = DB.findCardDef(cardId);
          renderModal();
          return;
        }
      }

      // Deck row/grid controls (minus, plus, del)
      const ctrlBtn = e.target.closest('[data-db-act]');
      const deckRow = e.target.closest('[data-db-card]');
      if (ctrlBtn && deckRow) {
        const cardId = deckRow.dataset.dbCard;
        const isExtra = deckRow.dataset.dbExtra === '1';
        const act = ctrlBtn.dataset.dbAct;
        if (act === 'minus') {
          removeCardFromDeck(cardId, isExtra);
          return;
        } else if (act === 'plus') {
          const def = DB.findCardDef(cardId);
          addCardToDeck(def);
          return;
        } else if (act === 'del') {
          deleteCardEntry(cardId, isExtra);
          return;
        }
      }

      // Catalog card click / actions
      const catAddBtn = e.target.closest('[data-db-act="addToDeck"]');
      const catInspectBtn = e.target.closest('[data-db-act="inspectCatCard"]');
      const catItem = e.target.closest('.db-catalog-card-item');

      if (catInspectBtn && catItem) {
        const cardId = catItem.dataset.dbCatCard;
        inspectCardDef = DB.findCardDef(cardId);
        renderModal();
        return;
      }

      if ((catAddBtn || catItem) && catItem) {
        const cardId = catItem.dataset.dbCatCard;
        const def = DB.findCardDef(cardId);
        addCardToDeck(def);
        return;
      }
    };
  }

  CG.ui.deckBuilder = {
    init: initDeckBuilder,
    open: openDeckBuilder,
    close: closeDeckBuilder,
    render: renderModal
  };
})();
