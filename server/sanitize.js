// server/sanitize.js - Fog of War State Sanitizer
// ป้องกันการแอบส่องการ์ดบนมือ เด็ค และการ์ดคว่ำของคู่แข่งผ่าน F12 DevTools

function sanitizeStateForViewer(rawState, viewerIndex) {
  if (!rawState) return null;

  // Deep clone state to avoid modifying server authoritative state
  const state = JSON.parse(JSON.stringify(rawState));
  const oppIndex = 1 - viewerIndex;

  if (state.players && state.players[oppIndex]) {
    const opp = state.players[oppIndex];

    // 1. ปิดบังการ์ดบนมือของคู่แข่ง (คงเหลือเฉพาะจำนวนและ uid เพื่อ track การเล่น)
    if (Array.isArray(opp.hand)) {
      opp.hand = opp.hand.map(card => {
        if (!card) return null;
        return {
          uid: card.uid,
          cardId: 'hidden',
          faceDown: true,
          name: 'การ์ดบนมือ',
          type: 'card',
          revealed: false
        };
      });
    }

    // 2. ปิดบังเด็คของคู่แข่ง (ซ่อนลำดับและชื่อการ์ดในกอง)
    if (Array.isArray(opp.deck)) {
      opp.deck = opp.deck.map((card, i) => ({
        uid: 'opp_deck_' + i,
        cardId: 'hidden',
        faceDown: true
      }));
    }

    // 3. ปิดบังมอนสเตอร์ที่เซ็ตคว่ำหน้าอยู่บนสนาม
    if (Array.isArray(opp.monsters)) {
      opp.monsters = opp.monsters.map(m => {
        if (!m) return null;
        if (m.faceDown) {
          return {
            uid: m.uid,
            cardId: 'hidden',
            name: 'มอนสเตอร์คว่ำ',
            faceDown: true,
            position: m.position || 'def',
            under: Array.isArray(m.under) ? m.under.map(u => ({ uid: u.uid, faceDown: true, cardId: 'hidden' })) : [],
            atk: 0,
            def: 0,
            effects: []
          };
        }
        return m;
      });
    }

    // 4. ปิดบังการ์ดสเปลที่หมอบคว่ำหน้าอยู่บนสนาม
    if (Array.isArray(opp.spells)) {
      opp.spells = opp.spells.map(s => {
        if (!s) return null;
        if (s.faceDown) {
          return {
            uid: s.uid,
            cardId: 'hidden',
            name: 'การ์ดคว่ำ',
            faceDown: true,
            type: 'spell',
            effects: []
          };
        }
        return s;
      });
    }

    // 5. ปิดบัง Extra Deck ของคู่แข่ง (แสดงเฉพาะจำนวนใบ)
    if (Array.isArray(opp.extra)) {
      opp.extra = opp.extra.map((c, i) => ({
        uid: 'opp_extra_' + i,
        cardId: 'hidden',
        faceDown: true
      }));
    }
  }

  // ปิดบังตัวเลือกใน pending ถ้าเป็นความลับของคู่แข่ง (เช่น การเลือกจั่ว/เสิร์ชลับ)
  if (state.pending && state.pending.player !== viewerIndex) {
    if (state.pending.secret) {
      state.pending = {
        type: state.pending.type,
        player: state.pending.player,
        waiting: true,
        message: 'คู่แข่งกำลังตัดสินใจ...'
      };
    }
  }

  return state;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { sanitizeStateForViewer };
}
