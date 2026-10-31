// cards/mecha_scrap.js - ข้อมูลการ์ดเด็ค เมก้าสแครป (MECHA SCRAP)
// ธีมมหานครจักรกล วนเศษซากคืนชีพจากสุสานและฟิวชั่นต่อเนื่อง
(function () {
  const CG = (globalThis.CG = globalThis.CG || {});
  CG.cards = CG.cards || {};
  CG.cards.mecha_scrap = {
    "key": "mecha_scrap",
    "name": "เด็คเมก้าสแครป (จักรกลคืนชีพ)",
    "main": [
      // 1. เมก้าสแครป ดรอยด์ x3
      {
        "id": "scrap_droid",
        "name": "เมก้าสแครป ดรอยด์",
        "type": "monster",
        "level": 1,
        "atk": 600,
        "def": 400,
        "mana": "0",
        "count": 3,
        "leader": false,
        "proposed_level": false,
        "tags": ["mecha", "scrap"],
        "text": "[กดใช้จากมือ, เทิร์นละ 1]: ถ้าคุณควบคุมยูนิต mecha บนสนาม อัญเชิญพิเศษการ์ดใบนี้จากมือ",
        "effects": [
          {
            "id": "scrap_droid_sp",
            "name": "โดดลงสนาม",
            "trigger": "ignition",
            "from": "hand",
            "speed": 1,
            "cost": { "mana": 0 },
            "limit": { "per": "turn", "key": "scrap_droid_sp", "count": 1 },
            "condition": [
              { "op": "controls", "filter": { "tag": "mecha" }, "min": 1 }
            ],
            "do": [
              { "op": "specialSummon", "self": true, "count": 1 }
            ]
          }
        ]
      },

      // 2. เมก้าสแครป เวิร์กเกอร์ x3
      {
        "id": "scrap_worker",
        "name": "เมก้าสแครป เวิร์กเกอร์",
        "type": "monster",
        "level": 1,
        "atk": 400,
        "def": 800,
        "mana": "0",
        "count": 3,
        "leader": false,
        "proposed_level": false,
        "tags": ["mecha", "scrap"],
        "text": "[เมื่อลงสู่สนามสำเร็จ, เทิร์นละ 1]: อัญเชิญพิเศษ mecha Lv1 จากสุสาน 1 ตัว",
        "effects": [
          {
            "id": "scrap_worker_revive",
            "name": "เก็บกู้ซาก",
            "trigger": "onSummon",
            "speed": 1,
            "cost": { "mana": 0 },
            "limit": { "per": "turn", "key": "scrap_worker_revive", "count": 1 },
            "do": [
              {
                "op": "specialSummon",
                "from": ["grave"],
                "filter": { "tag": "mecha", "levelMin": 1, "levelMax": 1 },
                "count": 1,
                "choose": "player"
              }
            ]
          }
        ]
      },

      // 3. เมก้าสแครป แมกเน็ต x2
      {
        "id": "scrap_magnet",
        "name": "เมก้าสแครป แมกเน็ต",
        "type": "monster",
        "level": 1,
        "atk": 700,
        "def": 200,
        "mana": "0",
        "count": 2,
        "leader": false,
        "proposed_level": false,
        "tags": ["mecha", "scrap"],
        "text": "[เมื่อถูกส่งลงสุสาน, เทิร์นละ 1]: อัญเชิญพิเศษ mecha Lv1 ตัวอื่น 1 ตัวจากสุสาน",
        "effects": [
          {
            "id": "scrap_magnet_revive",
            "name": "แรงดึงดูดแม่เหล็ก",
            "trigger": "onSentToGrave",
            "speed": 1,
            "cost": { "mana": 0 },
            "limit": { "per": "turn", "key": "scrap_magnet_revive", "count": 1 },
            "do": [
              {
                "op": "specialSummon",
                "from": ["grave"],
                "filter": { "tag": "mecha", "levelMin": 1, "levelMax": 1, "other": true },
                "count": 1,
                "choose": "player"
              }
            ]
          }
        ]
      },

      // 4. เมก้าสแครป ไดนาโม x2
      {
        "id": "scrap_dynamo",
        "name": "เมก้าสแครป ไดนาโม",
        "type": "monster",
        "level": 1,
        "atk": 300,
        "def": 300,
        "mana": "0",
        "count": 2,
        "leader": false,
        "proposed_level": false,
        "tags": ["mecha", "scrap"],
        "text": "[เมื่อถูกส่งลงสุสาน]: ค้นหา mecha Lv1 1 ใบจากเด็คขึ้นมือ",
        "effects": [
          {
            "id": "scrap_dynamo_search",
            "name": "กำเนิดพลังงาน",
            "trigger": "onSentToGrave",
            "speed": 1,
            "cost": { "mana": 0 },
            "do": [
              {
                "op": "search",
                "from": "deck",
                "to": "hand",
                "filter": { "tag": "mecha", "levelMin": 1, "levelMax": 1 },
                "count": 1,
                "choose": "player"
              }
            ]
          }
        ]
      },

      // 5. เมก้าสแครป คอลเลคเตอร์ x2
      {
        "id": "scrap_collector",
        "name": "เมก้าสแครป คอลเลคเตอร์",
        "type": "monster",
        "level": 1,
        "atk": 500,
        "def": 500,
        "mana": "1",
        "count": 2,
        "leader": false,
        "proposed_level": false,
        "tags": ["mecha", "scrap"],
        "text": "[เมื่ออัญเชิญปกติสำเร็จ]: จ่าย 1 Arcana ค้นหาการ์ด Distortion ที่มีแท็ก mecha 1 ใบขึ้นมือ",
        "effects": [
          {
            "id": "scrap_collector_search",
            "name": "รวบรวมชิ้นส่วน",
            "trigger": "onNormalSummon",
            "speed": 1,
            "cost": { "mana": 1 },
            "do": [
              {
                "op": "search",
                "from": "deck",
                "to": "hand",
                "filter": { "tag": "mecha", "type": "spell" },
                "count": 1,
                "choose": "player"
              }
            ]
          }
        ]
      },

      // 6. เมก้าสแครป ฟอร์จแมน x2
      {
        "id": "scrap_forgeman",
        "name": "เมก้าสแครป ฟอร์จแมน",
        "type": "monster",
        "level": 2,
        "atk": 1700,
        "def": 1400,
        "mana": "1",
        "count": 2,
        "leader": false,
        "proposed_level": false,
        "tags": ["mecha", "scrap"],
        "text": "[กดใช้บนสนาม, เทิร์นละ 1]: จ่าย 1 Arcana ส่ง scrap Lv1 บนสนามเรา 1 ตัวลงสุสาน แล้วทำลายยูนิตศัตรู 1 ตัว",
        "effects": [
          {
            "id": "scrap_forgeman_destroy",
            "name": "หลอมทำลาย",
            "trigger": "ignition",
            "speed": 1,
            "cost": { "mana": 1 },
            "limit": { "per": "turn", "key": "scrap_forgeman_destroy", "count": 1 },
            "condition": [
              { "op": "controls", "filter": { "tag": "scrap", "levelMin": 1, "levelMax": 1 }, "min": 1 }
            ],
            "do": [
              {
                "op": "sendToGrave",
                "target": { "side": "self", "zone": "monster", "filter": { "tag": "scrap", "levelMin": 1, "levelMax": 1 }, "count": 1, "choose": "player" }
              },
              {
                "op": "destroy",
                "target": { "side": "opp", "zone": "monster", "count": 1, "choose": "player" }
              }
            ]
          }
        ]
      },

      // 7. เมก้าสแครป เฟนิกซ์ x2
      {
        "id": "scrap_phoenix",
        "name": "เมก้าสแครป เฟนิกซ์",
        "type": "monster",
        "level": 2,
        "atk": 1600,
        "def": 1200,
        "mana": "1",
        "count": 2,
        "leader": false,
        "proposed_level": false,
        "tags": ["mecha", "scrap"],
        "text": "[เมื่อลงสู่สนามสำเร็จ]: จ่าย 1 Arcana นำ mecha 2 ใบจากสุสานขึ้นมือ และอัญเชิญพิเศษ Lv1 จากมือ 1 ตัว",
        "effects": [
          {
            "id": "scrap_phoenix_salvage",
            "name": "นกเพลิงคืนชีพ",
            "trigger": "onSummon",
            "speed": 1,
            "cost": { "mana": 1 },
            "do": [
              {
                "op": "search",
                "from": "grave",
                "to": "hand",
                "filter": { "tag": "mecha" },
                "count": 2,
                "choose": "player"
              },
              {
                "op": "specialSummon",
                "from": ["hand"],
                "filter": { "levelMin": 1, "levelMax": 1 },
                "count": 1,
                "choose": "player"
              }
            ]
          }
        ]
      },

      // 8. เมก้าสแครป เครน x1
      {
        "id": "scrap_crane",
        "name": "เมก้าสแครป เครน",
        "type": "monster",
        "level": 2,
        "atk": 1500,
        "def": 1800,
        "mana": "1",
        "count": 1,
        "leader": false,
        "proposed_level": false,
        "tags": ["mecha", "scrap"],
        "text": "[กดใช้บนสนาม, เทิร์นละ 1]: จ่าย 1 Arcana ดีดยูนิตศัตรู 1 ตัวกลับขึ้นมือ",
        "effects": [
          {
            "id": "scrap_crane_bounce",
            "name": "ปั้นจั่นยก",
            "trigger": "ignition",
            "speed": 1,
            "cost": { "mana": 1 },
            "limit": { "per": "turn", "key": "scrap_crane_bounce", "count": 1 },
            "do": [
              {
                "op": "returnToHand",
                "target": { "side": "opp", "zone": "monster", "count": 1, "choose": "player" }
              }
            ]
          }
        ]
      },

      // 9. เมก้าสแครป สมาเชอร์ x1
      {
        "id": "scrap_smasher",
        "name": "เมก้าสแครป สมาเชอร์",
        "type": "monster",
        "level": 2,
        "atk": 2100,
        "def": 800,
        "mana": "1",
        "count": 1,
        "leader": false,
        "proposed_level": false,
        "tags": ["mecha", "scrap"],
        "text": "[เมื่อทำลายยูนิตจากการต่อสู้]: ยิงความเสียหาย 500 ใส่ LP ฝ่ายตรงข้าม",
        "effects": [
          {
            "id": "scrap_smasher_burn",
            "name": "ค้อนทุบทำลาย",
            "trigger": "onBattleDestroy",
            "speed": 1,
            "cost": { "mana": 0 },
            "do": [
              {
                "op": "damage",
                "player": "opp",
                "amount": 500
              }
            ]
          }
        ]
      },

      // 10. เมก้าสแครป มาร์แชล x2 (Pioneer Leader)
      {
        "id": "scrap_marshal",
        "name": "เมก้าสแครป มาร์แชล",
        "type": "monster",
        "level": 3,
        "atk": 2400,
        "def": 1800,
        "mana": "3",
        "count": 2,
        "leader": true,
        "proposed_level": false,
        "tags": ["mecha", "scrap"],
        "text": "[ต่อเนื่อง]: ยูนิต Resonance ทุกตัวรับพลังโจมตี +300\n[เมื่ออัญเชิญฟิวชั่นสำเร็จ, เทิร์นละ 1]: อัญเชิญพิเศษ mecha Lv1 1 ตัวจากสุสาน",
        "effects": [
          {
            "id": "marshal_aura",
            "name": "บัญชาการมาร์แชล",
            "trigger": "continuous",
            "cost": { "mana": 0 },
            "do": [
              {
                "op": "modifyStat",
                "target": { "side": "self", "zone": "monster", "filter": { "tag": "resonance" } },
                "stat": "atk",
                "amount": 300
              }
            ]
          },
          {
            "id": "marshal_revive_on_fusion",
            "name": "ปลุกระดมเศษซาก",
            "trigger": "onSummon",
            "watch": { "zone": "field", "side": "self", "filter": { "tag": "resonance" } },
            "limit": { "per": "turn", "key": "marshal_revive", "count": 1 },
            "cost": { "mana": 0 },
            "do": [
              {
                "op": "specialSummon",
                "from": ["grave"],
                "filter": { "tag": "mecha", "levelMin": 1, "levelMax": 1 },
                "count": 1,
                "choose": "player"
              }
            ]
          }
        ]
      },

      // 11. สแครป ฟิวชั่น x3
      {
        "id": "scrap_fusion",
        "name": "สแครป ฟิวชั่น",
        "type": "spell",
        "group": "normal",
        "field": false,
        "mana": "1",
        "count": 3,
        "proposed_level": false,
        "tags": ["mecha", "scrap"],
        "text": "ใช้วัตถุดิบจากบนมือหรือสนาม ส่งลงสุสาน เพื่ออัญเชิญยูนิต Resonance mecha 1 ตัวจาก Astral Gate",
        "effects": [
          {
            "id": "scrap_fusion_act",
            "name": "ฟิวชั่นเศษซาก",
            "trigger": "ignition",
            "speed": 1,
            "cost": { "mana": 1 },
            "do": [
              {
                "op": "fusionSummon",
                "filter": { "tag": "mecha" },
                "materialsFrom": ["hand", "monster"],
                "sendTo": "grave"
              }
            ]
          }
        ]
      },

      // 12. สแครป รีบิลด์ x2
      {
        "id": "scrap_rebuild",
        "name": "สแครป รีบิลด์",
        "type": "spell",
        "group": "normal",
        "field": false,
        "mana": "2",
        "count": 2,
        "proposed_level": false,
        "tags": ["mecha", "scrap"],
        "text": "เนรเทศ (Exile) การ์ด mecha จากสุสานเป็นวัตถุดิบ เพื่ออัญเชิญยูนิต Resonance mecha 1 ตัวจาก Astral Gate",
        "effects": [
          {
            "id": "scrap_rebuild_act",
            "name": "ฟื้นฟูโครงสร้าง",
            "trigger": "ignition",
            "speed": 1,
            "cost": { "mana": 2 },
            "do": [
              {
                "op": "fusionSummon",
                "filter": { "tag": "mecha" },
                "materialsFrom": ["grave"],
                "sendTo": "removed"
              }
            ]
          }
        ]
      },

      // 13. ถังรีไซเคิล x2
      {
        "id": "scrap_recycle_bin",
        "name": "ถังรีไซเคิล",
        "type": "spell",
        "group": "normal",
        "field": false,
        "mana": "1",
        "count": 2,
        "proposed_level": false,
        "tags": ["mecha", "scrap"],
        "text": "นำ mecha Lv1 2 ใบจากสุสานขึ้นมือ",
        "effects": [
          {
            "id": "recycle_bin_act",
            "name": "คัดแยกขยะ",
            "trigger": "ignition",
            "speed": 1,
            "cost": { "mana": 1 },
            "do": [
              {
                "op": "search",
                "from": "grave",
                "to": "hand",
                "filter": { "tag": "mecha", "levelMin": 1, "levelMax": 1 },
                "count": 2,
                "choose": "player"
              }
            ]
          }
        ]
      },

      // 14. สายพานลำเลียง x3
      {
        "id": "scrap_conveyor",
        "name": "สายพานลำเลียง",
        "type": "spell",
        "group": "normal",
        "field": false,
        "mana": "1",
        "count": 3,
        "proposed_level": false,
        "tags": ["mecha", "scrap"],
        "text": "ค้นหา mecha Lv1 1 ใบจากเด็คขึ้นมือ (ไม่ได้รับ Arcana จากการค้น)",
        "effects": [
          {
            "id": "conveyor_search",
            "name": "ส่งสายพาน",
            "trigger": "ignition",
            "speed": 1,
            "cost": { "mana": 1 },
            "do": [
              {
                "op": "search",
                "from": "deck",
                "to": "hand",
                "filter": { "tag": "mecha", "levelMin": 1, "levelMax": 1 },
                "count": 1,
                "choose": "player"
              }
            ]
          }
        ]
      },

      // 15. เสบียงฉุกเฉิน x2
      {
        "id": "scrap_emergency_supply",
        "name": "เสบียงฉุกเฉิน",
        "type": "spell",
        "group": "normal",
        "field": false,
        "mana": "1",
        "count": 2,
        "proposed_level": false,
        "tags": ["mecha", "scrap"],
        "text": "[เงื่อนไข: ควบคุม mecha บนสนาม]: จั่วการ์ด 2 ใบ",
        "effects": [
          {
            "id": "emergency_supply_draw",
            "name": "เสบียงฉุกเฉิน",
            "trigger": "ignition",
            "speed": 1,
            "cost": { "mana": 1 },
            "condition": [
              { "op": "controls", "filter": { "tag": "mecha" }, "min": 1 }
            ],
            "do": [
              { "op": "draw", "count": 2 }
            ]
          }
        ]
      },

      // 16. ซ่อมด่วน x2
      {
        "id": "scrap_quick_repair",
        "name": "ซ่อมด่วน",
        "type": "spell",
        "group": "normal",
        "field": false,
        "mana": "0",
        "count": 2,
        "proposed_level": false,
        "tags": ["mecha", "scrap"],
        "text": "อัญเชิญพิเศษ mecha Lv1 1 ตัวจากสุสาน (ยูนิตนี้จะถูกทำลายทิ้งเมื่อจบเทิร์น)",
        "effects": [
          {
            "id": "quick_repair_act",
            "name": "ซ่อมชั่วคราว",
            "trigger": "ignition",
            "speed": 1,
            "cost": { "mana": 0 },
            "do": [
              {
                "op": "specialSummon",
                "from": ["grave"],
                "filter": { "tag": "mecha", "levelMin": 1, "levelMax": 1 },
                "count": 1,
                "choose": "player"
              }
            ]
          }
        ]
      },

      // 17. ลานเศษเหล็ก x2 (Field Spell)
      {
        "id": "scrap_yard",
        "name": "ลานเศษเหล็ก",
        "type": "spell",
        "group": "normal",
        "field": true,
        "mana": "0",
        "count": 2,
        "proposed_level": false,
        "tags": ["mecha", "scrap"],
        "text": "[เวทสนาม]: เมื่ออัญเชิญฟิวชั่นสำเร็จ (เทิร์นละ 1 ครั้ง) ได้รับ +1 Arcana",
        "effects": [
          {
            "id": "scrap_yard_mana",
            "name": "พลังงานจากกองขยะ",
            "trigger": "onSummon",
            "watch": { "zone": "field", "side": "self", "filter": { "tag": "resonance" } },
            "limit": { "per": "turn", "key": "scrap_yard_mana", "count": 1 },
            "cost": { "mana": 0 },
            "do": [
              { "op": "addMana", "amount": 1 }
            ]
          }
        ]
      },

      // 18. หลุมฝังกลบ x2 (Trap / Set Spell)
      {
        "id": "scrap_landfill",
        "name": "หลุมฝังกลบ",
        "type": "spell",
        "group": "set",
        "field": false,
        "mana": "1",
        "count": 2,
        "proposed_level": false,
        "tags": ["mecha", "scrap"],
        "text": "[กับดักหมอบรอ]: เมื่อยูนิตเราถูกทำลาย อัญเชิญพิเศษ mecha Lv1 2 ตัวจากสุสาน",
        "effects": [
          {
            "id": "landfill_trap",
            "name": "เศษขยะทะลัก",
            "trigger": "onSentToGrave",
            "watch": { "zone": "field", "side": "self" },
            "speed": 2,
            "cost": { "mana": 1 },
            "do": [
              {
                "op": "specialSummon",
                "from": ["grave"],
                "filter": { "tag": "mecha", "levelMin": 1, "levelMax": 1 },
                "count": 2,
                "choose": "player"
              }
            ]
          }
        ]
      },

      // 19. เกราะเศษเหล็ก x1 (Counter Trap)
      {
        "id": "scrap_armor",
        "name": "เกราะเศษเหล็ก",
        "type": "spell",
        "group": "counter",
        "field": false,
        "mana": "1",
        "count": 1,
        "proposed_level": false,
        "tags": ["mecha", "scrap"],
        "text": "[เคาน์เตอร์]: ยกเลิกการโจมตี 1 ครั้ง",
        "effects": [
          {
            "id": "scrap_armor_negate",
            "name": "กำบังเศษเหล็ก",
            "trigger": "quick",
            "speed": 3,
            "timingWindow": ["attackDeclared", "battle"],
            "cost": { "mana": 1 },
            "do": [
              { "op": "negateAttack" }
            ]
          }
        ]
      },

      // 20. ไฟฉุกเฉิน x1
      {
        "id": "scrap_emergency_flare",
        "name": "ไฟฉุกเฉิน",
        "type": "spell",
        "group": "normal",
        "field": false,
        "mana": "1",
        "count": 1,
        "proposed_level": false,
        "tags": ["mecha", "scrap"],
        "text": "นำการ์ด Distortion ฟิวชั่น 1 ใบจากสุสานขึ้นมือ",
        "effects": [
          {
            "id": "emergency_flare_act",
            "name": "สัญญาณฉุกเฉิน",
            "trigger": "ignition",
            "speed": 1,
            "cost": { "mana": 1 },
            "do": [
              {
                "op": "search",
                "from": "grave",
                "to": "hand",
                "filter": { "type": "spell", "id": ["scrap_fusion", "scrap_rebuild"] },
                "count": 1,
                "choose": "player"
              }
            ]
          }
        ]
      }
    ],

    "extra": [
      // 21. เมก้าสแครป กอลเลม (Resonance Lv2)
      {
        "id": "scrap_golem",
        "name": "เมก้าสแครป กอลเลม",
        "type": "fusion",
        "level": 2,
        "atk": 1800,
        "def": 1500,
        "mana": "0",
        "leader": false,
        "proposed_level": false,
        "tags": ["mecha", "resonance"],
        "materials": "ดรอยด์ + เวิร์กเกอร์",
        "materialSlots": [
          { "tag": "mecha", "level": 1 },
          { "tag": "mecha", "level": 1 }
        ],
        "text": "[เมื่อลงสู่สนามสำเร็จ]: ชุบ mecha Lv1 จากสุสาน 1 ตัว (0 Arcana)",
        "effects": [
          {
            "id": "golem_on_summon",
            "name": "ประกอบร่างกอลเลม",
            "trigger": "onSummon",
            "speed": 1,
            "cost": { "mana": 0 },
            "do": [
              {
                "op": "specialSummon",
                "from": ["grave"],
                "filter": { "tag": "mecha", "levelMin": 1, "levelMax": 1 },
                "count": 1,
                "choose": "player"
              }
            ]
          }
        ]
      },

      // 22. เมก้าสแครป วูล์ฟ (Resonance Lv2)
      {
        "id": "scrap_wolf",
        "name": "เมก้าสแครป วูล์ฟ",
        "type": "fusion",
        "level": 2,
        "atk": 1900,
        "def": 1200,
        "mana": "0",
        "leader": false,
        "proposed_level": false,
        "tags": ["mecha", "resonance"],
        "materials": "ดรอยด์ + แมกเน็ต",
        "materialSlots": [
          { "tag": "mecha", "level": 1 },
          { "tag": "mecha", "level": 1 }
        ],
        "text": "[เมื่อทำลายยูนิตจากการต่อสู้]: จั่วการ์ด 1 ใบ",
        "effects": [
          {
            "id": "wolf_on_destroy",
            "name": "ล่าขย้ำเศษซาก",
            "trigger": "onBattleDestroy",
            "speed": 1,
            "cost": { "mana": 0 },
            "do": [
              { "op": "draw", "count": 1 }
            ]
          }
        ]
      },

      // 23. เมก้าสแครป เซนทิเนล (Resonance Lv2)
      {
        "id": "scrap_sentinel",
        "name": "เมก้าสแครป เซนทิเนล",
        "type": "fusion",
        "level": 2,
        "atk": 1600,
        "def": 2000,
        "mana": "1",
        "leader": false,
        "proposed_level": false,
        "tags": ["mecha", "resonance"],
        "materials": "ไดนาโม + คอลเลคเตอร์",
        "materialSlots": [
          { "tag": "mecha", "level": 1 },
          { "tag": "mecha", "level": 1 }
        ],
        "text": "[กดใช้ขณะท่าป้องกัน, เทิร์นละ 1]: จ่าย 1 Arcana ลด ATK ศัตรู 1 ตัวลง 300 ถาวร",
        "effects": [
          {
            "id": "sentinel_debuff",
            "name": "ป้อมเซนทิเนล",
            "trigger": "ignition",
            "speed": 1,
            "cost": { "mana": 1 },
            "limit": { "per": "turn", "key": "sentinel_debuff", "count": 1 },
            "condition": [
              { "op": "position", "position": "def" }
            ],
            "do": [
              {
                "op": "modifyStat",
                "target": { "side": "opp", "zone": "monster", "count": 1, "choose": "player" },
                "stat": "atk",
                "amount": -300,
                "duration": "permanent"
              }
            ]
          }
        ]
      },

      // 24. เมก้าสแครป ไฮยีน่า (Resonance Lv2)
      {
        "id": "scrap_hyena",
        "name": "เมก้าสแครป ไฮยีน่า",
        "type": "fusion",
        "level": 2,
        "atk": 1700,
        "def": 1300,
        "mana": "0",
        "leader": false,
        "proposed_level": false,
        "tags": ["mecha", "resonance"],
        "materials": "แมกเน็ต + เวิร์กเกอร์",
        "materialSlots": [
          { "tag": "mecha", "level": 1 },
          { "tag": "mecha", "level": 1 }
        ],
        "text": "[เมื่อลงสู่สนามสำเร็จ]: ส่ง mecha Lv1 จากเด็ค 1 ใบลงสุสาน\n[กดใช้บนสนาม, เทิร์นละ 1, 0 Arcana]: ส่งตัวเองลงสุสาน แล้วอัญเชิญพิเศษ mecha Lv1 2 ตัวจากสุสาน",
        "effects": [
          {
            "id": "hyena_foolish",
            "name": "ขุดเศษลงหลุม",
            "trigger": "onSummon",
            "speed": 1,
            "cost": { "mana": 0 },
            "do": [
              {
                "op": "search",
                "from": "deck",
                "to": "grave",
                "filter": { "tag": "mecha", "levelMin": 1, "levelMax": 1 },
                "count": 1,
                "choose": "player"
              }
            ]
          },
          {
            "id": "hyena_split",
            "name": "แยกชิ้นส่วนชุบฝูง",
            "trigger": "ignition",
            "speed": 1,
            "cost": { "mana": 0 },
            "limit": { "per": "turn", "key": "hyena_split", "count": 1 },
            "do": [
              {
                "op": "sendToGrave",
                "target": "self"
              },
              {
                "op": "specialSummon",
                "from": ["grave"],
                "filter": { "tag": "mecha", "levelMin": 1, "levelMax": 1 },
                "count": 2,
                "choose": "player"
              }
            ]
          }
        ]
      },

      // 25. เมก้าสแครป เบฮีมอธ (Resonance Lv3)
      {
        "id": "scrap_behemoth",
        "name": "เมก้าสแครป เบฮีมอธ",
        "type": "fusion",
        "level": 3,
        "atk": 2300,
        "def": 2000,
        "mana": "1",
        "leader": false,
        "proposed_level": false,
        "tags": ["mecha", "resonance"],
        "materials": "ดรอยด์ + แมกเน็ต + ไดนาโม",
        "materialSlots": [
          { "tag": "mecha", "level": 1 },
          { "tag": "mecha", "level": 1 },
          { "tag": "mecha", "level": 1 }
        ],
        "text": "[เมื่อลงสู่สนามสำเร็จ]: จ่าย 1 Arcana ทำลายยูนิตศัตรู 1 ตัว",
        "effects": [
          {
            "id": "behemoth_destroy",
            "name": "พลังทำลายเบฮีมอธ",
            "trigger": "onSummon",
            "speed": 1,
            "cost": { "mana": 1 },
            "do": [
              {
                "op": "destroy",
                "target": { "side": "opp", "zone": "monster", "count": 1, "choose": "player" }
              }
            ]
          }
        ]
      },

      // 26. เมก้าสแครป ออโตมาตา (Resonance Lv3)
      {
        "id": "scrap_automata",
        "name": "เมก้าสแครป ออโตมาตา",
        "type": "fusion",
        "level": 3,
        "atk": 2300,
        "def": 2300,
        "mana": "2",
        "leader": false,
        "proposed_level": false,
        "tags": ["mecha", "resonance"],
        "materials": "เวิร์กเกอร์ + แมกเน็ต + คอลเลคเตอร์",
        "materialSlots": [
          { "tag": "mecha", "level": 1 },
          { "tag": "mecha", "level": 1 },
          { "tag": "mecha", "level": 1 }
        ],
        "text": "[กดใช้บนสนาม, เทิร์นละ 1]: จ่าย 2 Arcana + เนรเทศ mecha 2 ใบจากสุสาน ทำลายยูนิตศัตรู 1 ตัว",
        "effects": [
          {
            "id": "automata_destroy",
            "name": "ลำแสงออโตมาตา",
            "trigger": "ignition",
            "speed": 1,
            "cost": { "mana": 2 },
            "limit": { "per": "turn", "key": "automata_destroy", "count": 1 },
            "do": [
              {
                "op": "banish",
                "target": { "side": "self", "zone": "grave", "filter": { "tag": "mecha" }, "count": 2, "choose": "player" }
              },
              {
                "op": "destroy",
                "target": { "side": "opp", "zone": "monster", "count": 1, "choose": "player" }
              }
            ]
          }
        ]
      },

      // 27. เมก้าสแครป เซอร์เบอรัส (Apex เปิดเกม - Lv4)
      {
        "id": "scrap_cerberus",
        "name": "เมก้าสแครป เซอร์เบอรัส",
        "type": "grade4",
        "level": 3,
        "atk": 2000,
        "def": 2000,
        "mana": "3",
        "leader": false,
        "proposed_level": false,
        "tags": ["mecha", "apex"],
        "materials": "Exile mecha 2 ใบจากสุสาน + วางทับบน Resonance mecha",
        "extraSummon": {
          "onto": {
            "tag": "resonance"
          },
          "cost": [
            {
              "op": "banish",
              "target": {
                "side": "self",
                "zone": "grave",
                "filter": { "tag": "mecha" },
                "count": 2
              }
            }
          ]
        },
        "text": "[เงื่อนไขอัญเชิญ Apex]: จ่าย 3 Arcana + Exile mecha 2 ใบจากสุสาน แล้ววางทับบน Resonance mecha บนสนามเรา 1 ตัว\n[เมื่อลงสู่สนามสำเร็จ]: อัญเชิญพิเศษ mecha Lv1 2 ตัวจากมือ\n[จบเทิร์น]: กลับ Astral Gate ตามกติกา Apex",
        "effects": [
          {
            "id": "cerberus_summon_hand",
            "name": "เปิดประตูคลังเศษซาก",
            "trigger": "onSummon",
            "speed": 1,
            "cost": { "mana": 0 },
            "do": [
              {
                "op": "specialSummon",
                "from": ["hand"],
                "filter": { "tag": "mecha", "levelMin": 1, "levelMax": 1 },
                "count": 2,
                "choose": "player"
              }
            ]
          }
        ]
      },

      // 28. เมก้าสแครป ไททัน (Apex ปิดเกม - Lv4)
      {
        "id": "scrap_titan",
        "name": "เมก้าสแครป ไททัน",
        "type": "grade4",
        "level": 3,
        "atk": 3200,
        "def": 2800,
        "mana": "0",
        "leader": false,
        "proposed_level": false,
        "tags": ["mecha", "apex"],
        "materials": "Exile mecha 5 ใบจากสุสาน (มี Resonance >= 1) + วางทับบน Resonance",
        "extraSummon": {
          "onto": {
            "tag": "resonance"
          },
          "cost": [
            {
              "op": "banish",
              "target": {
                "side": "self",
                "zone": "grave",
                "filter": { "tag": "mecha" },
                "count": 5
              }
            }
          ]
        },
        "text": "[เงื่อนไขอัญเชิญ Apex]: Exile การ์ด mecha 5 ใบจากสุสาน (ต้องมี Resonance อย่างน้อย 1 ใบ) แล้ววางทับบน Resonance mecha บนสนามเรา 1 ตัว\n[ต่อเนื่อง]: ไม่ถูกทำลายจากการต่อสู้\n[กดใช้ (2 Arcana, 1 ครั้ง/เทิร์น)]: ทำลายยูนิตศัตรู 1 ตัว แล้วอัญเชิญพิเศษ mecha Lv1 จากสุสาน 1 ตัว\n[เมื่อทำลายยูนิตจากการต่อสู้]: สร้างความเสียหายใส่ LP ศัตรูเท่ากับครึ่งหนึ่งของ ATK ตัวที่ตาย\n[จบเทิร์น]: กลับ Astral Gate ตามกติกา Apex",
        "effects": [
          {
            "id": "titan_battle_immune",
            "name": "เกราะไททันไร้พ่าย",
            "trigger": "continuous",
            "speed": 1,
            "cost": { "mana": 0 },
            "do": [
              {
                "op": "preventDestruction",
                "condition": [
                  { "op": "cause", "cause": "battle" }
                ]
              }
            ]
          },
          {
            "id": "titan_destroy_revive",
            "name": "บดขยี้และกู้ซาก",
            "trigger": "ignition",
            "speed": 1,
            "cost": { "mana": 2 },
            "limit": { "per": "turn", "key": "titan_act", "count": 1 },
            "do": [
              {
                "op": "destroy",
                "target": { "side": "opp", "zone": "monster", "count": 1, "choose": "player" }
              },
              {
                "op": "specialSummon",
                "from": ["grave"],
                "filter": { "tag": "mecha", "levelMin": 1, "levelMax": 1 },
                "count": 1,
                "choose": "player"
              }
            ]
          },
          {
            "id": "titan_burn",
            "name": "เพลิงแผดเผาเศษซาก",
            "trigger": "onBattleDestroy",
            "speed": 1,
            "cost": { "mana": 0 },
            "do": [
              {
                "op": "damage",
                "player": "opp",
                "fromVictim": "halfAtk"
              }
            ]
          }
        ]
      }
    ]
  };
})();
