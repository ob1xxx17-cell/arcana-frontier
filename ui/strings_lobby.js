// strings_lobby.js - ข้อมูลและข้อความทั้งหมดของล็อบบี้ U3-L
(function(global) {
  'use strict';
  const STRINGS_LOBBY = {
  "profile": {
    "name": "ADVENTURER_123",
    "id": "45678",
    "level": 1,
    "hint": "แตะเพื่อดูสถิติและโปรไฟล์"
  },
  "onlineStatus": {
    "count": 1,
    "refFormat": "online: 1 player"
  },
  "currencies": {
    "gold": 950,
    "ticket": 50
  },
  "news": {
    "tag": "NEW HEROES JOIN THE FRAY!",
    "title": "ฮีโร่ใหม่เข้าร่วมศึก!",
    "caption": "ฮีโร่ใหม่เข้าร่วมศึก!",
    "desc": "เหล่ายูนิตผู้กล้ากลุ่มใหม่ก้าวเข้าสู่สนามประลองแล้ววันนี้!"
  },
  "shop": {
    "title": "ร้านค้า",
    "featuredLabel": "FEATURED PACK",
    "packs": [
      {
        "id": "mecha_strike",
        "name": "Dragon's Hoard Cards"
      },
      {
        "id": "mecha_scrap",
        "name": "Mecha Scrap Workshop"
      },
      {
        "id": "luna_guardians",
        "name": "Luna Celestial Guardians"
      }
    ]
  },
  "buttons": {
    "playBot": "เล่นกับบอท",
    "playBotEn": "Play vs Bot",
    "startGame": "เริ่มเกม",
    "startGameEn": "START GAME",
    "onlineSub": "ออนไลน์",
    "onlineSubEn": "(ONLINE)",
    "quiz": "แบบทดสอบ",
    "missions": "ภารกิจ",
    "collection": "คลังการ์ด",
    "deckBuilder": "จัดเด็ค",
    "addFriend": "ช่องเพิ่มเพื่อน",
    "announcement": "ที่แจ้งประกาศ",
    "mailbox": "กล่องจดหมาย",
    "giftCode": "ใส่โค้ด"
  },
  "toast": {
    "comingSoon": "เร็วๆ นี้"
  },
  "rotateNotice": "หมุนจอเป็นแนวนอน"
};
  STRINGS_LOBBY.onlineStatus.format = function(n) { return 'ออนไลน์: ' + n + ' คน'; };
  global.STRINGS_LOBBY = STRINGS_LOBBY;
  if (typeof module !== 'undefined' && module.exports) { module.exports = STRINGS_LOBBY; }
})(typeof window !== 'undefined' ? window : globalThis);
