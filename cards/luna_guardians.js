// cards/luna_guardians.js - ข้อมูลการ์ดเด็ค LUNA GUARDIANS (ผู้พิทักษ์แห่งจันทรา)
(function () {
  const CG = (globalThis.CG = globalThis.CG || {});
  CG.cards = CG.cards || {};
  CG.cards.luna_guardians = {
    "key": "luna_guardians",
    "name": "LUNA GUARDIANS (ผู้พิทักษ์แห่งจันทรา)",
    "main": [
      // 1. เอมเบอร์ (Lv1)
      {
        "id": "luna_ember",
        "name": "เอมเบอร์",
        "type": "monster",
        "level": 1,
        "atk": 800,
        "def": 600,
        "mana": "0",
        "count": 3,
        "leader": false,
        "proposed_level": false,
        "tags": ["luna", "normal_form"],
        "text": "LUNA GUARDIANS เอมเบอร์\n[เมื่ออัญเชิญ]: ค้นหามอนสเตอร์ LUNA GUARDIANS 1 ใบจากเด็คขึ้นมือ แล้วทิ้งการ์ด 1 ใบจากมือลงสุสาน (เทิร์นละ 1 ครั้ง)\n[แปลงกาย - Main Phase]: จ่าย 1 Arcana คืนการ์ดนี้จากสนามขึ้นมือ; อัญเชิญพิเศษ \"เอมเบอร์ ร่างอัคนี\" จากมือหรือสุสานลงสนาม (เทิร์นละ 1 ครั้ง)",
        "effects": [
          {
            "id": "luna_ember_search",
            "name": "ค้นหาเพลิงจันทร์",
            "trigger": "onSummon",
            "speed": 1,
            "cost": { "mana": 0 },
            "limit": { "per": "turn", "key": "luna_ember_search", "count": 1 },
            "condition": [
              { "op": "cause", "notHow": "revert" }
            ],
            "do": [
              { "op": "search", "filter": { "tag": "luna", "type": "monster" }, "to": "hand", "choose": "player" },
              { "op": "discard", "count": 1, "player": "self", "choose": "player" }
            ]
          },
          {
            "id": "luna_ember_transform",
            "name": "แปลงกายสู่ร่างอัคนี",
            "trigger": "ignition",
            "speed": 1,
            "cost": { "mana": 1 },
            "limit": { "per": "turn", "key": "luna_ember_transform", "count": 1 },
            "condition": [
              { "op": "hasCard", "from": ["hand", "grave"], "filter": { "cardId": "luna_ember_blaze" } }
            ],
            "do": [
              { "op": "returnToHand", "target": "self" },
              { "op": "specialSummon", "from": ["hand", "grave"], "filter": { "cardId": "luna_ember_blaze" }, "how": "transform" }
            ]
          }
        ]
      },
      // 2. มาริน่า (Lv1)
      {
        "id": "luna_marina",
        "name": "มาริน่า",
        "type": "monster",
        "level": 1,
        "atk": 900,
        "def": 1000,
        "mana": "0",
        "count": 3,
        "leader": false,
        "proposed_level": false,
        "tags": ["luna", "normal_form"],
        "text": "LUNA GUARDIANS มาริน่า\n[เมื่ออัญเชิญ]: อัญเชิญพิเศษ LUNA GUARDIANS Lv1 (ชื่ออื่นที่ไม่ใช่มาริน่า) 1 ตัวจากสุสานลงสนาม (เทิร์นละ 1 ครั้ง)\n[แปลงกาย - Main Phase]: จ่าย 1 Arcana คืนการ์ดนี้จากสนามขึ้นมือ; อัญเชิญพิเศษ \"มาริน่า ร่างมหานที\" จากมือหรือสุสานลงสนาม (เทิร์นละ 1 ครั้ง)",
        "effects": [
          {
            "id": "luna_marina_revive",
            "name": "เสียงเรียกแห่งเกลียวคลื่น",
            "trigger": "onSummon",
            "speed": 1,
            "cost": { "mana": 0 },
            "limit": { "per": "turn", "key": "luna_marina_revive", "count": 1 },
            "condition": [
              { "op": "freeMonsterSlot" },
              { "op": "cause", "notHow": "revert" }
            ],
            "do": [
              { "op": "specialSummon", "from": ["grave"], "filter": { "tag": "luna", "level": 1, "notCardId": "luna_marina" }, "count": 1, "choose": "player" }
            ]
          },
          {
            "id": "luna_marina_transform",
            "name": "แปลงกายสู่ร่างมหานที",
            "trigger": "ignition",
            "speed": 1,
            "cost": { "mana": 1 },
            "limit": { "per": "turn", "key": "luna_marina_transform", "count": 1 },
            "condition": [
              { "op": "hasCard", "from": ["hand", "grave"], "filter": { "cardId": "luna_marina_ocean" } }
            ],
            "do": [
              { "op": "returnToHand", "target": "self" },
              { "op": "specialSummon", "from": ["hand", "grave"], "filter": { "cardId": "luna_marina_ocean" }, "how": "transform" }
            ]
          }
        ]
      },
      // 3. โวลตา (Lv1)
      {
        "id": "luna_volta",
        "name": "โวลตา",
        "type": "monster",
        "level": 1,
        "atk": 800,
        "def": 700,
        "mana": "0",
        "count": 3,
        "leader": false,
        "proposed_level": false,
        "tags": ["luna", "normal_form"],
        "text": "LUNA GUARDIANS โวลตา\n[เมื่ออัญเชิญ]: ค้นการ์ดเวทมนตร์/กับดักของเด็ค LUNA 1 ใบจากเด็คขึ้นมือ (เทิร์นละ 1 ครั้ง)\n[แปลงกาย - Main Phase]: จ่าย 1 Arcana คืนการ์ดนี้จากสนามขึ้นมือ; อัญเชิญพิเศษ \"โวลตา ร่างวัชระ\" จากมือหรือสุสานลงสนาม (เทิร์นละ 1 ครั้ง)",
        "effects": [
          {
            "id": "luna_volta_search",
            "name": "อสนีบาตนำทาง",
            "trigger": "onSummon",
            "speed": 1,
            "cost": { "mana": 0 },
            "limit": { "per": "turn", "key": "luna_volta_search", "count": 1 },
            "condition": [
              { "op": "cause", "notHow": "revert" }
            ],
            "do": [
              { "op": "search", "filter": { "tag": "luna", "type": "spell" }, "to": "hand", "choose": "player" }
            ]
          },
          {
            "id": "luna_volta_transform",
            "name": "แปลงกายสู่ร่างวัชระ",
            "trigger": "ignition",
            "speed": 1,
            "cost": { "mana": 1 },
            "limit": { "per": "turn", "key": "luna_volta_transform", "count": 1 },
            "condition": [
              { "op": "hasCard", "from": ["hand", "grave"], "filter": { "cardId": "luna_volta_vajra" } }
            ],
            "do": [
              { "op": "returnToHand", "target": "self" },
              { "op": "specialSummon", "from": ["hand", "grave"], "filter": { "cardId": "luna_volta_vajra" }, "how": "transform" }
            ]
          }
        ]
      },
      // 4. ไอวี่ (Lv1)
      {
        "id": "luna_ivy",
        "name": "ไอวี่",
        "type": "monster",
        "level": 1,
        "atk": 800,
        "def": 1300,
        "mana": "0",
        "count": 3,
        "leader": false,
        "proposed_level": false,
        "tags": ["luna", "normal_form"],
        "text": "LUNA GUARDIANS ไอวี่\n[เมื่ออัญเชิญ]: อัญเชิญพิเศษ LUNA GUARDIANS Lv1 (ชื่ออื่นที่ไม่ใช่ไอวี่) 1 ตัวจากมือลงสนาม (เทิร์นละ 1 ครั้ง)\n[แปลงกาย - Main Phase]: จ่าย 1 Arcana คืนการ์ดนี้จากสนามขึ้นมือ; อัญเชิญพิเศษ \"ไอวี่ ร่างพฤกษา\" จากมือหรือสุสานลงสนาม (เทิร์นละ 1 ครั้ง)",
        "effects": [
          {
            "id": "luna_ivy_hand_summon",
            "name": "พฤกษาโอบเอื้อ",
            "trigger": "onSummon",
            "speed": 1,
            "cost": { "mana": 0 },
            "limit": { "per": "turn", "key": "luna_ivy_hand_summon", "count": 1 },
            "condition": [
              { "op": "freeMonsterSlot" },
              { "op": "cause", "notHow": "revert" }
            ],
            "do": [
              { "op": "specialSummon", "from": ["hand"], "filter": { "tag": "luna", "level": 1, "notCardId": "luna_ivy" }, "count": 1, "choose": "player" }
            ]
          },
          {
            "id": "luna_ivy_transform",
            "name": "แปลงกายสู่ร่างพฤกษา",
            "trigger": "ignition",
            "speed": 1,
            "cost": { "mana": 1 },
            "limit": { "per": "turn", "key": "luna_ivy_transform", "count": 1 },
            "condition": [
              { "op": "hasCard", "from": ["hand", "grave"], "filter": { "cardId": "luna_ivy_forest" } }
            ],
            "do": [
              { "op": "returnToHand", "target": "self" },
              { "op": "specialSummon", "from": ["hand", "grave"], "filter": { "cardId": "luna_ivy_forest" }, "how": "transform" }
            ]
          }
        ]
      },
      // 5. ลูน่า (Lv2 - ผู้นำ)
      {
        "id": "luna_leader",
        "name": "ลูน่า",
        "type": "monster",
        "level": 2,
        "atk": 1400,
        "def": 1200,
        "mana": "0",
        "count": 2,
        "leader": true,
        "proposed_level": false,
        "tags": ["luna", "normal_form", "leader"],
        "text": "LUNA GUARDIANS ลูน่า\n[จากมือ - Main Phase]: หากคุม LUNA GUARDIANS บนสนาม >= 2 ตัว และช่องผู้นำว่าง; อัญเชิญพิเศษการ์ดนี้จากมือลงสู่ช่องผู้นำ\n[ต่อเนื่อง]: ตราบใดที่การ์ดนี้อยู่ในช่องผู้นำ จะไม่ถูกทำลายจากการต่อสู้",
        "effects": [
          {
            "id": "luna_leader_summon",
            "name": "ผู้นำจันทราจุติ",
            "trigger": "ignition",
            "from": "hand",
            "speed": 1,
            "cost": { "mana": 0 },
            "condition": [
              { "op": "controls", "count": 2, "filter": { "tag": "luna" } },
              { "op": "emptyLeaderSlot" }
            ],
            "do": [
              { "op": "specialSummon", "self": true, "slot": "leader" }
            ]
          },
          {
            "id": "luna_leader_battle_protect",
            "name": "เกราะพิทักษ์แห่งจันทร์",
            "trigger": "continuous",
            "condition": [
              { "op": "inLeaderSlot" }
            ],
            "do": [
              { "op": "preventDestruction", "target": "self", "cause": "battle" }
            ]
          }
        ]
      },
      // 6. เอมเบอร์ ร่างอัคนี (Lv3)
      {
        "id": "luna_ember_blaze",
        "name": "เอมเบอร์ ร่างอัคนี",
        "type": "monster",
        "level": 3,
        "atk": 2000,
        "def": 1400,
        "mana": "1",
        "count": 2,
        "leader": false,
        "proposed_level": false,
        "tags": ["luna", "transform_form"],
        "text": "LUNA GUARDIANS เอมเบอร์ ร่างอัคนี\n[เมื่ออัญเชิญ - จ่าย 1 Arcana]: เมื่ออัญเชิญด้วยแปลงกาย ยิง Effect Damage 500 ใส่ LP ฝ่ายตรงข้าม\n[End Phase - 0 Arcana]: นำการ์ดนี้จากสนามขึ้นมือ แล้วอัญเชิญพิเศษ \"เอมเบอร์\" จากมือหรือสุสานลงสนาม",
        "effects": [
          {
            "id": "luna_ember_blaze_damage",
            "name": "เพลิงอัคนีสังหาร",
            "trigger": "onSummon",
            "speed": 1,
            "cost": { "mana": 0 },
            "condition": [
              { "op": "cause", "how": "transform" }
            ],
            "do": [
              { "op": "damage", "player": "opp", "amount": 500 }
            ]
          },
          {
            "id": "luna_ember_blaze_revert",
            "name": "คืนร่างยามจันทราลา",
            "trigger": "onEndPhase",
            "speed": 1,
            "cost": { "mana": 0 },
            "do": [
              { "op": "returnToHand", "target": "self" },
              { "op": "specialSummon", "from": ["hand", "grave"], "filter": { "cardId": "luna_ember" }, "how": "revert" }
            ]
          }
        ]
      },
      // 7. มาริน่า ร่างมหานที (Lv3)
      {
        "id": "luna_marina_ocean",
        "name": "มาริน่า ร่างมหานที",
        "type": "monster",
        "level": 3,
        "atk": 1800,
        "def": 1900,
        "mana": "1",
        "count": 2,
        "leader": false,
        "proposed_level": false,
        "tags": ["luna", "transform_form"],
        "text": "LUNA GUARDIANS มาริน่า ร่างมหานที\n[เมื่ออัญเชิญ - จ่าย 1 Arcana]: เมื่ออัญเชิญด้วยแปลงกาย ดีดมอนสเตอร์ฝ่ายตรงข้าม 1 ตัวกลับขึ้นมือ\n[End Phase - 0 Arcana]: นำการ์ดนี้จากสนามขึ้นมือ แล้วอัญเชิญพิเศษ \"มาริน่า\" จากมือหรือสุสานลงสนาม",
        "effects": [
          {
            "id": "luna_marina_ocean_bounce",
            "name": "ระลอกคลื่นย้อนพัด",
            "trigger": "onSummon",
            "speed": 1,
            "cost": { "mana": 0 },
            "condition": [
              { "op": "cause", "how": "transform" }
            ],
            "do": [
              { "op": "returnToHand", "target": { "side": "opp", "zone": "monster", "count": 1, "choose": "player" } }
            ]
          },
          {
            "id": "luna_marina_ocean_revert",
            "name": "คืนร่างยามจันทราลา",
            "trigger": "onEndPhase",
            "speed": 1,
            "cost": { "mana": 0 },
            "do": [
              { "op": "returnToHand", "target": "self" },
              { "op": "specialSummon", "from": ["hand", "grave"], "filter": { "cardId": "luna_marina" }, "how": "revert" }
            ]
          }
        ]
      },
      // 8. โวลตา ร่างวัชระ (Lv3)
      {
        "id": "luna_volta_vajra",
        "name": "โวลตา ร่างวัชระ",
        "type": "monster",
        "level": 3,
        "atk": 1900,
        "def": 1200,
        "mana": "0",
        "count": 2,
        "leader": false,
        "proposed_level": false,
        "tags": ["luna", "transform_form"],
        "text": "LUNA GUARDIANS โวลตา ร่างวัชระ\n[Main Phase - จ่าย 1 Arcana]: การ์ดนี้ได้รับ +300 ATK จนจบเทิร์น (เทิร์นละ 1 ครั้ง)\n[End Phase - 0 Arcana]: นำการ์ดนี้จากสนามขึ้นมือ แล้วอัญเชิญพิเศษ \"โวลตา\" จากมือหรือสุสานลงสนาม",
        "effects": [
          {
            "id": "luna_volta_vajra_buff",
            "name": "สายฟ้าเกรี้ยวกราด",
            "trigger": "ignition",
            "speed": 1,
            "cost": { "mana": 1 },
            "limit": { "per": "turn", "key": "luna_volta_vajra_buff", "count": 1 },
            "do": [
              { "op": "modifyStat", "target": "self", "stat": "atk", "amount": 300, "duration": "turn" }
            ]
          },
          {
            "id": "luna_volta_vajra_revert",
            "name": "คืนร่างยามจันทราลา",
            "trigger": "onEndPhase",
            "speed": 1,
            "cost": { "mana": 0 },
            "do": [
              { "op": "returnToHand", "target": "self" },
              { "op": "specialSummon", "from": ["hand", "grave"], "filter": { "cardId": "luna_volta" }, "how": "revert" }
            ]
          }
        ]
      },
      // 9. ไอวี่ ร่างพฤกษา (Lv3)
      {
        "id": "luna_ivy_forest",
        "name": "ไอวี่ ร่างพฤกษา",
        "type": "monster",
        "level": 3,
        "atk": 1700,
        "def": 2000,
        "mana": "0",
        "count": 2,
        "leader": false,
        "proposed_level": false,
        "tags": ["luna", "transform_form"],
        "text": "LUNA GUARDIANS ไอวี่ ร่างพฤกษา\n[เมื่ออัญเชิญ - จ่าย 1 Arcana]: เมื่ออัญเชิญด้วยแปลงกาย ฟื้นฟู 500 LP\n[End Phase - 0 Arcana]: นำการ์ดนี้จากสนามขึ้นมือ แล้วอัญเชิญพิเศษ \"ไอวี่\" จากมือหรือสุสานลงสนาม",
        "effects": [
          {
            "id": "luna_ivy_forest_heal",
            "name": "พฤกษาฟื้นชีวา",
            "trigger": "onSummon",
            "speed": 1,
            "cost": { "mana": 0 },
            "condition": [
              { "op": "cause", "how": "transform" }
            ],
            "do": [
              { "op": "heal", "player": "self", "amount": 500 }
            ]
          },
          {
            "id": "luna_ivy_forest_revert",
            "name": "คืนร่างยามจันทราลา",
            "trigger": "onEndPhase",
            "speed": 1,
            "cost": { "mana": 0 },
            "do": [
              { "op": "returnToHand", "target": "self" },
              { "op": "specialSummon", "from": ["hand", "grave"], "filter": { "cardId": "luna_ivy" }, "how": "revert" }
            ]
          }
        ]
      },
      // 10. แสงจันทร์เตรียมพร้อม (เวทปกติ)
      {
        "id": "luna_prep",
        "name": "แสงจันทร์เตรียมพร้อม",
        "type": "spell",
        "group": "normal",
        "mana": "1",
        "count": 3,
        "field": false,
        "proposed_level": false,
        "image": "assets/cards/luna_prep.png",
        "tags": ["luna"],
        "text": "ส่งมอนสเตอร์ LUNA GUARDIANS 1 ใบจากเด็คลงสุสาน",
        "effects": [
          {
            "id": "luna_prep_mill",
            "name": "ส่งกำลังพลจันทรา",
            "trigger": "ignition",
            "speed": 1,
            "cost": { "mana": 1 },
            "do": [
              { "op": "search", "from": "deck", "to": "grave", "filter": { "tag": "luna", "type": "monster" }, "count": 1, "choose": "player" }
            ]
          }
        ]
      },
      // 11. จันทร์คืนชีพ (เวทปกติ)
      {
        "id": "luna_rebirth",
        "name": "จันทร์คืนชีพ",
        "type": "spell",
        "group": "normal",
        "mana": "1",
        "count": 3,
        "field": false,
        "proposed_level": false,
        "image": "assets/cards/luna_rebirth.png",
        "tags": ["luna"],
        "text": "อัญเชิญพิเศษ LUNA GUARDIANS ร่างปกติ (รวมลูน่า) 1 ตัวจากสุสานลงสนาม",
        "effects": [
          {
            "id": "luna_rebirth_summon",
            "name": "คืนชีพผู้พิทักษ์",
            "trigger": "ignition",
            "speed": 1,
            "cost": { "mana": 1 },
            "condition": [{ "op": "freeMonsterSlot" }],
            "do": [
              { "op": "specialSummon", "from": ["grave"], "filter": { "tag": "normal_form" }, "count": 1, "choose": "player" }
            ]
          }
        ]
      },
      // 12. LUNA เรโซแนนซ์ (เวทปกติ / ฟิวชั่น)
      {
        "id": "luna_resonance",
        "name": "LUNA เรโซแนนซ์",
        "type": "spell",
        "group": "normal",
        "mana": "1",
        "count": 3,
        "field": false,
        "proposed_level": false,
        "image": "assets/cards/luna_resonance.png",
        "tags": ["luna", "resonance_spell"],
        "text": "ส่งวัตถุดิบ (ร่างแรก + ร่างแปลงกาย) จากมือหรือสนามลงสุสาน อัญเชิญ Resonance จาก Extra Deck\n[จากสุสาน - 0 Arcana]: ส่ง LUNA GUARDIANS บนสนาม 1 ตัวลงสุสาน; นำการ์ดนี้จากสุสานขึ้นมือ",
        "effects": [
          {
            "id": "luna_resonance_fusion",
            "name": "ผสานพลังจันทรา",
            "trigger": "ignition",
            "from": "hand",
            "speed": 1,
            "cost": { "mana": 1 },
            "condition": [
              {
                "op": "canFusionSummon",
                "filter": { "tag": "luna" },
                "materialsFrom": ["hand", "monster"]
              }
            ],
            "do": [
              {
                "op": "fusionSummon",
                "filter": { "tag": "luna" },
                "materialsFrom": ["hand", "monster"],
                "sendTo": "grave"
              }
            ]
          },
          {
            "id": "luna_resonance_salvage",
            "name": "กู้คืนเรโซแนนซ์",
            "trigger": "ignition",
            "from": "grave",
            "speed": 1,
            "cost": { "mana": 0 },
            "condition": [
              { "op": "controls", "count": 1, "filter": { "tag": "luna" } }
            ],
            "do": [
              { "op": "sendToGrave", "target": { "zone": "monster", "side": "self", "filter": { "tag": "luna" }, "count": 1, "choose": "player" } },
              { "op": "returnToHand", "target": "self" }
            ]
          }
        ]
      },
      // 13. สวนจันทร์ (เวทสนาม)
      {
        "id": "luna_garden",
        "name": "สวนจันทร์",
        "type": "spell",
        "group": "normal",
        "field": true,
        "mana": "0",
        "count": 2,
        "proposed_level": false,
        "image": "assets/cards/luna_garden.png",
        "tags": ["luna", "field_spell"],
        "text": "[เวทสนาม]\n[Main Phase - เทิร์นละ 1 ครั้ง - จ่าย 2 Arcana]: ในเทิร์นนี้การใช้มานา (Cost) ของการ์ดเผ่า LUNA ทั้งหมดของเราจะลดลง 1 มานา",
        "effects": [
          {
            "id": "luna_garden_cost_down",
            "name": "แสงจันทร์อำนวยพร",
            "trigger": "ignition",
            "speed": 1,
            "cost": { "mana": 2 },
            "limit": { "per": "turn", "key": "luna_garden_cost_down", "count": 1 },
            "do": [
              { "op": "reduceTurnCost", "amount": 1, "tag": "luna" }
            ]
          }
        ]
      },
      // 14. ราตรีรีไซเคิล (เวทปกติ)
      {
        "id": "luna_recycle",
        "name": "ราตรีรีไซเคิล",
        "type": "spell",
        "group": "normal",
        "mana": "1",
        "count": 2,
        "field": false,
        "proposed_level": false,
        "image": "assets/cards/luna_recycle.png",
        "tags": ["luna"],
        "text": "นำ LUNA GUARDIANS สูงสุด 3 ใบจากสุสานคืนเข้าเด็ค สับเด็ค แล้วจั่ว 1 ใบ",
        "effects": [
          {
            "id": "luna_recycle_draw",
            "name": "วัฏจักรแห่งราตรี",
            "trigger": "ignition",
            "speed": 1,
            "cost": { "mana": 1 },
            "condition": [
              { "op": "hasCard", "from": ["grave"], "filter": { "tag": "luna" } }
            ],
            "do": [
              { "op": "returnToDeck", "target": { "zone": "grave", "side": "self", "filter": { "tag": "luna" }, "count": 3, "choose": "player" }, "shuffle": true },
              { "op": "draw", "count": 1 }
            ]
          }
        ]
      },
      // 15. ม่านจันทร์เด้งกลับ (กับดักหมอบ)
      {
        "id": "luna_bounce_screen",
        "name": "ม่านจันทร์เด้งกลับ",
        "type": "spell",
        "group": "set",
        "mana": "1",
        "count": 3,
        "field": false,
        "proposed_level": false,
        "image": "assets/cards/luna_bounce_screen.png",
        "tags": ["luna"],
        "text": "[กับดักหมอบ]\nเมื่อศัตรูอัญเชิญมอนสเตอร์: ดีดมอนสเตอร์ที่เพิ่งลงนั้นกลับมือ และเลือกคืน LUNA GUARDIANS ร่างปกติของเรา 1 ตัวขึ้นมือเพื่ออัญเชิญพิเศษร่างแปลงกายจากมือหรือสุสานทันที",
        "effects": [
          {
            "id": "luna_bounce_summon_trigger",
            "name": "ม่านจันทราขับไล่",
            "trigger": "quick",
            "speed": 2,
            "timingWindow": ["summon"],
            "cost": { "mana": 1 },
            "do": [
              { "op": "returnToHand", "target": "summoned" },
              { "op": "returnToHand", "target": { "side": "self", "zone": "monster", "filter": { "tag": "normal_form" }, "count": 1, "choose": "player" } },
              { "op": "specialSummon", "from": ["hand", "grave"], "filter": { "tag": "transform_form" }, "count": 1, "how": "transform", "choose": "player" }
            ]
          }
        ]
      },
      // 16. ม่านจันทร์สะท้อน (เวทสวนกลับ)
      {
        "id": "luna_reflection_veil",
        "name": "ม่านจันทร์สะท้อน",
        "type": "spell",
        "group": "counter",
        "mana": "1",
        "count": 2,
        "field": false,
        "proposed_level": false,
        "image": "assets/cards/luna_reflection_veil.png",
        "tags": ["luna"],
        "text": "[เวทสวนกลับ]\nเมื่อมอนสเตอร์ของเราถูกประกาศโจมตี: ยอมให้การโจมตีดำเนินต่อไปจนจบการต่อสู้ แต่บังคับให้จบเทิร์นทันทีหลังจากจังหวะการโจมตีสิ้นสุดลง",
        "effects": [
          {
            "id": "luna_reflection_end_turn",
            "name": "ม่านสะท้อนกาลเวลา",
            "trigger": "quick",
            "speed": 3,
            "timingWindow": ["attackDeclared", "battle"],
            "cost": { "mana": 1 },
            "condition": [
              { "op": "attackDeclaredByOpp" }
            ],
            "do": [
              { "op": "forceEndTurnAfterBattle" }
            ]
          }
        ]
      }
    ],
    "extra": [
      // 17. เอมเบอร์ ราชินีแห่งเปลวจันทร์ (Resonance)
      {
        "id": "luna_ember_queen",
        "name": "เอมเบอร์ ราชินีแห่งเปลวจันทร์",
        "type": "fusion",
        "level": 3,
        "atk": 2500,
        "def": 1800,
        "mana": "0",
        "count": 1,
        "image": "assets/cards/luna_ember_queen.png",
        "proposed_level": false,
        "tags": ["luna", "resonance"],
        "materials": "เอมเบอร์ Lv1 + ร่างอัคนี Lv3",
        "materialSlots": [
          { "cardId": "luna_ember" },
          { "cardId": "luna_ember_blaze" }
        ],
        "text": "[Resonance - ฟิวชั่น]: เอมเบอร์ Lv1 + ร่างอัคนี Lv3\n[เมื่ออัญเชิญ - จ่าย 1 Arcana]: ยิง Effect Damage 1000 และทำลายมอนสเตอร์ศัตรู ATK <= 1500 1 ตัว\n[เมื่อตกสู่ Abyss]: ค้นหา \"LUNA เรโซแนนซ์\" 1 ใบขึ้นมือ",
        "effects": [
          {
            "id": "luna_ember_queen_summon",
            "name": "เพลิงพิโรธราชินี",
            "trigger": "onSummon",
            "speed": 1,
            "cost": { "mana": 0 },
            "do": [
              { "op": "damage", "player": "opp", "amount": 1000 },
              { "op": "destroy", "target": { "side": "opp", "zone": "monster", "filter": { "maxAtk": 1500 }, "count": 1, "choose": "player" } }
            ]
          },
          {
            "id": "luna_ember_queen_salvage",
            "name": "มรดกเพลิงจันทรา",
            "trigger": "onSentToGrave",
            "speed": 1,
            "cost": { "mana": 0 },
            "do": [
              { "op": "search", "filter": { "cardId": "luna_resonance" }, "to": "hand" }
            ]
          }
        ]
      },
      // 18. มาริน่า ราชินีแห่งน้ำขึ้น (Resonance)
      {
        "id": "luna_marina_queen",
        "name": "มาริน่า ราชินีแห่งน้ำขึ้น",
        "type": "fusion",
        "level": 3,
        "atk": 2300,
        "def": 2100,
        "mana": "0",
        "count": 1,
        "proposed_level": false,
        "tags": ["luna", "resonance"],
        "materials": "มาริน่า Lv1 + ร่างมหานที Lv3",
        "materialSlots": [
          { "cardId": "luna_marina" },
          { "cardId": "luna_marina_ocean" }
        ],
        "text": "[Resonance - ฟิวชั่น]: มาริน่า Lv1 + ร่างมหานที Lv3\n[เมื่ออัญเชิญ - จ่าย 1 Arcana]: ดีดมอนสเตอร์ศัตรูสูงสุด 2 ตัวกลับขึ้นมือ\n[เมื่อตกสู่ Abyss]: ค้นหา \"LUNA เรโซแนนซ์\" 1 ใบขึ้นมือ",
        "effects": [
          {
            "id": "luna_marina_queen_summon",
            "name": "มหาคลื่นย้อนซัด",
            "trigger": "onSummon",
            "speed": 1,
            "cost": { "mana": 0 },
            "do": [
              { "op": "returnToHand", "target": { "side": "opp", "zone": "monster", "count": 2, "choose": "player" } }
            ]
          },
          {
            "id": "luna_marina_queen_salvage",
            "name": "มรดกวารีจันทรา",
            "trigger": "onSentToGrave",
            "speed": 1,
            "cost": { "mana": 0 },
            "do": [
              { "op": "search", "filter": { "cardId": "luna_resonance" }, "to": "hand" }
            ]
          }
        ]
      },
      // 19. โวลตา ราชินีแห่งอสนี (Resonance)
      {
        "id": "luna_volta_queen",
        "name": "โวลตา ราชินีแห่งอสนี",
        "type": "fusion",
        "level": 3,
        "atk": 2000,
        "def": 1400,
        "mana": "0",
        "count": 1,
        "proposed_level": false,
        "tags": ["luna", "resonance"],
        "materials": "โวลตา Lv1 + ร่างวัชระ Lv3",
        "materialSlots": [
          { "cardId": "luna_volta" },
          { "cardId": "luna_volta_vajra" }
        ],
        "text": "[Resonance - ฟิวชั่น]: โวลตา Lv1 + ร่างวัชระ Lv3\n[Main Phase - จ่าย 1 Arcana]: การ์ดนี้ได้รับ +600 ATK จนจบเทิร์น (เทิร์นละ 1 ครั้ง)\n[เมื่อตกสู่ Abyss]: ค้นหา \"LUNA เรโซแนนซ์\" 1 ใบขึ้นมือ",
        "effects": [
          {
            "id": "luna_volta_queen_buff",
            "name": "สายฟ้าฟาดทลาย",
            "trigger": "ignition",
            "speed": 1,
            "cost": { "mana": 1 },
            "limit": { "per": "turn", "key": "luna_volta_queen_buff", "count": 1 },
            "do": [
              { "op": "modifyStat", "target": "self", "stat": "atk", "amount": 600, "duration": "turn" }
            ]
          },
          {
            "id": "luna_volta_queen_salvage",
            "name": "มรดกอสนีจันทรา",
            "trigger": "onSentToGrave",
            "speed": 1,
            "cost": { "mana": 0 },
            "do": [
              { "op": "search", "filter": { "cardId": "luna_resonance" }, "to": "hand" }
            ]
          }
        ]
      },
      // 20. ไอวี่ ราชินีแห่งพงไพร (Resonance)
      {
        "id": "luna_ivy_queen",
        "name": "ไอวี่ ราชินีแห่งพงไพร",
        "type": "fusion",
        "level": 3,
        "atk": 2200,
        "def": 2400,
        "mana": "0",
        "count": 1,
        "proposed_level": false,
        "tags": ["luna", "resonance"],
        "materials": "ไอวี่ Lv1 + ร่างพฤกษา Lv3",
        "materialSlots": [
          { "cardId": "luna_ivy" },
          { "cardId": "luna_ivy_forest" }
        ],
        "text": "[Resonance - ฟิวชั่น]: ไอวี่ Lv1 + ร่างพฤกษา Lv3\n[เมื่ออัญเชิญ - จ่าย 1 Arcana]: ฟื้นฟู 1000 LP และอัญเชิญพิเศษ LUNA Lv1 จากสุสาน 1 ตัว\n[เมื่อตกสู่ Abyss]: ค้นหา \"LUNA เรโซแนนซ์\" 1 ใบขึ้นมือ",
        "effects": [
          {
            "id": "luna_ivy_queen_summon",
            "name": "พฤกษาฟื้นแดนจันทร์",
            "trigger": "onSummon",
            "speed": 1,
            "cost": { "mana": 0 },
            "do": [
              { "op": "heal", "player": "self", "amount": 1000 },
              { "op": "specialSummon", "from": ["grave"], "filter": { "tag": "luna", "level": 1 }, "count": 1, "choose": "player" }
            ]
          },
          {
            "id": "luna_ivy_queen_salvage",
            "name": "มรดกพงไพจันทรา",
            "trigger": "onSentToGrave",
            "speed": 1,
            "cost": { "mana": 0 },
            "do": [
              { "op": "search", "filter": { "cardId": "luna_resonance" }, "to": "hand" }
            ]
          }
        ]
      },
      // 21. ลูน่า ผู้เฝ้ายามค่ำ (ร่างฟิวชั่น)
      {
        "id": "luna_night_watcher",
        "name": "ลูน่า ผู้เฝ้ายามค่ำ (ร่างฟิวชั่น)",
        "type": "fusion",
        "level": 3,
        "atk": 2200,
        "def": 1800,
        "mana": "0",
        "count": 1,
        "leader": true,
        "proposed_level": false,
        "tags": ["luna", "resonance", "leader"],
        "materials": "นำ \"ลูน่า (Lv2)\" ในช่องผู้นำ ออกนอกเกม (Exile)",
        "extraSummon": {
          "onto": {
            "cardId": ["luna_leader", "luna_leader_rare"],
            "inLeaderSlot": true
          },
          "banishOnto": true
        },
        "text": "[วิธีลง]: นำ \"ลูน่า (Lv2)\" ในช่องผู้นำ ออกนอกเกม (Exile)\n[เมื่ออัญเชิญ - จ่าย 1 Arcana]: ค้นหาการ์ด LUNA GUARDIANS 1 ใบขึ้นมือ\n[ต่อเนื่อง]: LUNA ทุกตัวฝั่งเราได้ +200 ATK และการ์ดนี้ไม่ถูกทำลายจากการต่อสู้",
        "effects": [
          {
            "id": "luna_night_watcher_search",
            "name": "เนตรยามค่ำนำทาง",
            "trigger": "onSummon",
            "speed": 1,
            "cost": { "mana": 0 },
            "do": [
              { "op": "search", "filter": { "tag": "luna" }, "to": "hand", "choose": "player" }
            ]
          },
          {
            "id": "luna_night_watcher_aura",
            "name": "รัศมีแห่งผู้เฝ้ายาม",
            "trigger": "continuous",
            "do": [
              { "op": "modifyStat", "filter": { "tag": "luna" }, "stat": "atk", "amount": 200 },
              { "op": "preventDestruction", "target": "self", "cause": "battle" }
            ]
          }
        ]
      },
      // 22. LUNA GUARDIANS ลูน่า อีคลิปส์ (Grade 4 Apex)
      {
        "id": "luna_eclipse",
        "name": "ลูน่า อีคลิปส์",
        "type": "grade4",
        "level": 3,
        "atk": 2500,
        "def": 2000,
        "mana": "2",
        "count": 1,
        "leader": true,
        "proposed_level": false,
        "image": "assets/cards/luna_eclipse.png",
        "tags": ["luna", "apex", "leader"],
        "materials": "วางทับ: ลูน่า (ร่างปกติ Lv2) ในช่องผู้นำเท่านั้น + ส่งมอนสเตอร์เผ่า LUNA 2 ตัวบนสนามลงสุสาน",
        "extraSummon": {
          "onto": {
            "cardId": ["luna_leader", "luna_leader_rare"],
            "inLeaderSlot": true
          },
          "cost": [
            {
              "op": "sendToGrave",
              "target": {
                "zone": "monster",
                "filter": { "tag": "luna" },
                "count": 2
              }
            }
          ]
        },
        "text": "[Apex - วางทับช่องผู้นำ]: ลูน่า (ร่างปกติ Lv2) ในช่องผู้นำเท่านั้น + ส่งมอนสเตอร์เผ่า LUNA 2 ตัวบนสนามลงสุสาน\n[Main Phase - จ่าย 2 Arcana]: เพิ่ม FP ของเรา +2000 และในเทิร์นถัดไปฝ่ายตรงข้ามไม่สามารถจั่วการ์ดได้ (เทิร์นละ 1 ครั้ง)",
        "effects": [
          {
            "id": "luna_eclipse_skill",
            "name": "คราสจันทร์กลืนสุริยา",
            "trigger": "ignition",
            "speed": 1,
            "cost": { "mana": 2 },
            "limit": { "per": "turn", "key": "luna_eclipse_skill", "count": 1 },
            "do": [
              { "op": "heal", "player": "self", "amount": 2000 },
              { "op": "skipOpponentDraw" }
            ]
          }
        ]
      },
      // 23. LUNA GUARDIANS ลูน่า ฟูลมูน (Grade 4 Apex)
      {
        "id": "luna_full_moon",
        "name": "ลูน่า ฟูลมูน",
        "type": "grade4",
        "level": 3,
        "atk": 2600,
        "def": 1800,
        "mana": "4",
        "count": 1,
        "leader": true,
        "proposed_level": false,
        "image": "assets/cards/luna_full_moon.png",
        "tags": ["luna", "apex", "leader"],
        "materials": "วางทับ: ลูน่า ผู้เฝ้ายามค่ำ (ร่างฟิวชั่น) ในช่องผู้นำเท่านั้น + เงื่อนไข: มีมอนสเตอร์ฟิวชั่นเผ่า LUNA บนสนาม >= 2 ตัว",
        "extraSummon": {
          "onto": {
            "cardId": "luna_night_watcher",
            "inLeaderSlot": true
          },
          "condition": [
            {
              "op": "controls",
              "count": 2,
              "filter": { "tag": "resonance" }
            }
          ]
        },
        "text": "[Apex - วางทับช่องผู้นำ]: ลูน่า ผู้เฝ้ายามค่ำ (ร่างฟิวชั่น) ในช่องผู้นำเท่านั้น + เงื่อนไข: มีมอนสเตอร์ฟิวชั่นเผ่า LUNA บนสนาม >= 2 ตัว\n[Main Phase - จ่าย 4 Arcana]: มอนสเตอร์ฝั่งเราไม่ได้รับผลจากเอฟเฟกต์การ์ดศัตรูในเทิร์นนี้ และถ้าบนสนามมีมอนสเตอร์ฟิวชั่นเผ่า LUNA ครบ 4 ใบขึ้นไป: เพิ่ม FP เรา +4000 และลด FP ศัตรู -4000 ทันที (เทิร์นละ 1 ครั้ง)",
        "effects": [
          {
            "id": "luna_full_moon_skill",
            "name": "จันทร์เต็มดวงล้างสวรรค์",
            "trigger": "ignition",
            "speed": 1,
            "cost": { "mana": 4 },
            "limit": { "per": "turn", "key": "luna_full_moon_skill", "count": 1 },
            "do": [
              { "op": "immuneEffects", "target": { "side": "self", "zone": "monster" }, "duration": "turn" },
              { "op": "checkAndNukeFP", "count": 4, "filter": { "tag": "resonance" }, "amount": 4000 }
            ]
          }
        ]
      }
    ],
    "rarePool": [
      // 24. ลูน่า (Secret Rare - ตัวบนหลังวาฬ ภาพหายากพิเศษ)
      {
        "id": "luna_leader_rare",
        "baseCardId": "luna_leader",
        "name": "ลูน่า (Secret Rare)",
        "type": "monster",
        "level": 2,
        "atk": 1400,
        "def": 1200,
        "mana": "0",
        "count": 0,
        "leader": true,
        "rare": true,
        "image": "assets/cards/luna_leader_rare.png",
        "proposed_level": false,
        "tags": ["luna", "normal_form", "leader", "rare"],
        "text": "LUNA GUARDIANS ลูน่า (Secret Rare)\n★ การ์ดหายากระดับ Secret Rare สุ่มได้จากร้านค้า (Alt Art) ★\n[จากมือ - Main Phase]: หากคุม LUNA GUARDIANS บนสนาม >= 2 ตัว และช่องผู้นำว่าง; อัญเชิญพิเศษการ์ดนี้จากมือลงสู่ช่องผู้นำ\n[ต่อเนื่อง]: ตราบใดที่การ์ดนี้อยู่ในช่องผู้นำ จะไม่ถูกทำลายจากการต่อสู้",
        "effects": [
          {
            "id": "luna_leader_rare_summon",
            "name": "ผู้นำจันทราจุติ",
            "trigger": "ignition",
            "from": "hand",
            "speed": 1,
            "cost": { "mana": 0 },
            "condition": [
              { "op": "controls", "count": 2, "filter": { "tag": "luna" } },
              { "op": "emptyLeaderSlot" }
            ],
            "do": [
              { "op": "specialSummon", "self": true, "slot": "leader" }
            ]
          },
          {
            "id": "luna_leader_rare_battle_protect",
            "name": "เกราะพิทักษ์แห่งจันทร์",
            "trigger": "continuous",
            "condition": [
              { "op": "inLeaderSlot" }
            ],
            "do": [
              { "op": "preventDestruction", "target": "self", "cause": "battle" }
            ]
          }
        ]
      },
      // 25. ลูน่า ร่างจันทราสถิต (Lv3 - ตัวยืนเต็มตัว)
      {
        "id": "luna_leader_lv3",
        "baseCardId": "luna_leader",
        "name": "ลูน่า ร่างจันทราสถิต",
        "type": "monster",
        "level": 3,
        "atk": 1800,
        "def": 1600,
        "mana": "1",
        "count": 0,
        "leader": true,
        "rare": true,
        "image": "assets/cards/luna_leader_lv3.png",
        "proposed_level": false,
        "tags": ["luna", "transform_form", "leader", "rare"],
        "text": "LUNA GUARDIANS ลูน่า ร่างจันทราสถิต (Lv3)\n[จากมือ - Main Phase]: หากมีลูน่าอยู่ในช่องผู้นำ; นำการ์ดนี้วางทับลงสู่ช่องผู้นำ\n[ต่อเนื่อง]: ตราบใดที่การ์ดนี้อยู่ในช่องผู้นำ มอนสเตอร์ LUNA GUARDIANS ฝั่งเราทั้งหมดได้รับ +300 ATK/DEF และไม่ถูกทำลายจากการต่อสู้",
        "effects": [
          {
            "id": "luna_leader_lv3_overlay",
            "name": "จันทราสถิตจุติ",
            "trigger": "ignition",
            "from": "hand",
            "speed": 1,
            "cost": { "mana": 1 },
            "condition": [
              { "op": "controls", "count": 1, "filter": { "cardId": ["luna_leader", "luna_leader_rare"] } }
            ],
            "do": [
              { "op": "specialSummon", "self": true, "slot": "leader" }
            ]
          },
          {
            "id": "luna_leader_lv3_aura",
            "name": "รัศมีจันทราสถิต",
            "trigger": "continuous",
            "condition": [
              { "op": "inLeaderSlot" }
            ],
            "do": [
              { "op": "modifyStat", "filter": { "tag": "luna" }, "stat": "atk", "amount": 300 },
              { "op": "modifyStat", "filter": { "tag": "luna" }, "stat": "def", "amount": 300 },
              { "op": "preventDestruction", "target": "self", "cause": "battle" }
            ]
          }
        ]
      }
    ]
  };
})();
