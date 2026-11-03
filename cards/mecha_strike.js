// cards/mecha_strike.js - ข้อมูลการ์ดเด็ค เมก้าสไตรก์ (MECHA STRIKE) 
// ธีมหุ่นยนต์ประกอบร่างสาย Toolbox & Cross-Resonance และระบบ Apex วางทับร่าง
(function () {
  const CG = (globalThis.CG = globalThis.CG || {});
  CG.cards = CG.cards || {};
  CG.cards.mecha_strike = {
    "key": "mecha_strike",
    "name": "เด็คเมก้าสไตรก์ (จักรกลประกอบร่าง)",
    "main": [
      {
        "id": "mecha_falcon",
        "name": "ฟอลคอน (แกน 1)",
        "type": "monster",
        "level": 1,
        "atk": 900,
        "def": 600,
        "mana": "1",
        "count": 3,
        "leader": false,
        "proposed_level": false,
        "tags": ["mecha", "core"],
        "text": "[เมื่อลงสู่สนามสำเร็จ]: จ่าย 1 Arcana ค้นหา Entity \"เมก้าสไตรก์\" เวล 1 ชื่ออื่น 1 ใบจาก Chronicle ขึ้นมือ",
        "effects": [
          {
            "id": "falcon_search",
            "name": "ค้นหาชิ้นส่วน",
            "trigger": "onSummon",
            "speed": 1,
            "cost": {
              "mana": 1
            },
            "limit": {
              "per": "turn",
              "key": "falcon_search",
              "count": 1
            },
            "do": [
              {
                "op": "search",
                "from": "deck",
                "filter": {
                  "tag": "mecha",
                  "levelMin": 1,
                  "levelMax": 1
                },
                "to": "hand",
                "count": 1
              }
            ]
          }
        ]
      },
      {
        "id": "mecha_lion",
        "name": "ไลออน (แกน 2)",
        "type": "monster",
        "level": 1,
        "atk": 1200,
        "def": 800,
        "mana": "0",
        "count": 3,
        "leader": false,
        "proposed_level": false,
        "tags": ["mecha", "core"],
        "text": "[เมื่อเป็นวัสดุ Resonance]: เมื่อถูกส่งลง Abyss หรือ Exile เพื่ออัญเชิญยูนิต Resonance ยูนิตนั้นรับพลังโจมตี +300 จนจบเทิร์น",
        "effects": [
          {
            "id": "lion_material_buff",
            "name": "พลังขับเคลื่อนไลออน",
            "trigger": "onSentToGrave",
            "speed": 1,
            "cost": {
              "mana": 0
            },
            "do": [
              {
                "op": "modifyStat",
                "target": {
                  "side": "self",
                  "zone": "monster",
                  "filter": {
                    "tag": "resonance"
                  },
                  "count": 1
                },
                "stat": "atk",
                "amount": 300,
                "duration": "endTurn"
              }
            ]
          }
        ]
      },
      {
        "id": "mecha_rhino",
        "name": "ไรโน (แกน 3)",
        "type": "monster",
        "level": 1,
        "atk": 500,
        "def": 1500,
        "mana": "0",
        "count": 3,
        "leader": false,
        "proposed_level": false,
        "tags": ["mecha", "core"],
        "text": "[เมื่อเป็นวัสดุ Resonance]: เมื่อถูกส่งลง Abyss หรือ Exile เพื่ออัญเชิญยูนิต Resonance ผู้เล่นได้รับ +1 Arcana ทันที",
        "effects": [
          {
            "id": "rhino_material_mana",
            "name": "พลังงานไรโน",
            "trigger": "onSentToGrave",
            "speed": 1,
            "cost": {
              "mana": 0
            },
            "do": [
              {
                "op": "addMana",
                "player": "self",
                "amount": 1
              }
            ]
          }
        ]
      },
      {
        "id": "mecha_dolphin",
        "name": "ดอลฟิน (แกน 4)",
        "type": "monster",
        "level": 1,
        "atk": 700,
        "def": 900,
        "mana": "0",
        "count": 2,
        "leader": false,
        "proposed_level": false,
        "tags": ["mecha", "core"],
        "text": "[กดใช้จากมือ - 1 ครั้ง/เทิร์น]: หากเรามียูนิต \"เมก้าสไตรก์\" หงายหน้าบนสนาม อัญเชิญพิเศษการ์ดใบนี้จากมือลงสนาม",
        "effects": [
          {
            "id": "dolphin_self_summon",
            "name": "อัญเชิญพิเศษจากมือ",
            "trigger": "ignition",
            "from": "hand",
            "speed": 1,
            "cost": {
              "mana": 0
            },
            "limit": {
              "per": "turn",
              "key": "dolphin_self",
              "count": 1
            },
            "condition": [
              {
                "op": "controls",
                "filter": {
                  "tag": "mecha"
                },
                "min": 1
              },
              {
                "op": "freeMonsterSlot"
              }
            ],
            "do": [
              {
                "op": "specialSummon",
                "from": [
                  "hand"
                ],
                "self": true,
                "count": 1
              }
            ]
          }
        ]
      },
      {
        "id": "mecha_prism",
        "name": "ปริซึม",
        "type": "monster",
        "level": 1,
        "atk": 800,
        "def": 800,
        "mana": "1",
        "count": 2,
        "leader": false,
        "proposed_level": false,
        "tags": ["mecha"],
        "text": "[กดใช้บนสนาม - 1 ครั้ง/เทิร์น]: จ่าย 1 Arcana ส่งตัวเองลง Abyss; อัญเชิญพิเศษ Entity เวล 1 ชื่ออื่น 1 ใบจาก Chronicle ลงสนาม",
        "effects": [
          {
            "id": "prism_summon",
            "name": "แยกส่วนปริซึม",
            "trigger": "ignition",
            "speed": 1,
            "cost": {
              "mana": 1
            },
            "limit": {
              "per": "turn",
              "key": "prism_summon",
              "count": 1
            },
            "do": [
              {
                "op": "sendToGrave",
                "target": "self"
              },
              {
                "op": "specialSummon",
                "from": [
                  "deck"
                ],
                "filter": {
                  "tag": "mecha",
                  "levelMin": 1,
                  "levelMax": 1,
                  "excludeId": "mecha_prism"
                },
                "count": 1
              }
            ]
          }
        ]
      },
      {
        "id": "mecha_spark_tiger",
        "name": "สปาร์คไทเกอร์ (แกน 5)",
        "type": "monster",
        "level": 2,
        "atk": 1900,
        "def": 1200,
        "mana": "1",
        "count": 2,
        "leader": false,
        "proposed_level": false,
        "tags": ["mecha", "core"],
        "text": "[กดใช้บนสนาม - 1 ครั้ง/เทิร์น]: จ่าย 1 Arcana เลือกเปลี่ยนท่าต่อสู้ของยูนิตบนสนามศัตรู 1 ตัว (พลิกหงายถ้าคว่ำ)",
        "effects": [
          {
            "id": "spark_tiger_position",
            "name": "สปาร์คเปลี่ยนท่า",
            "trigger": "ignition",
            "speed": 1,
            "cost": {
              "mana": 1
            },
            "limit": {
              "per": "turn",
              "key": "spark_tiger_pos",
              "count": 1
            },
            "do": [
              {
                "op": "changePosition",
                "target": {
                  "side": "opp",
                  "zone": "monster",
                  "count": 1,
                  "choose": "player"
                }
              }
            ]
          }
        ]
      },
      {
        "id": "mecha_mechanic",
        "name": "เมคานิก",
        "type": "monster",
        "level": 2,
        "atk": 1200,
        "def": 1800,
        "mana": "1",
        "count": 1,
        "leader": false,
        "proposed_level": false,
        "tags": ["mecha"],
        "text": "[เมื่ออัญเชิญสำเร็จ]: จ่าย 1 Arcana ค้นหาการ์ด Distortion ที่มีคำว่า \"เรโซแนนซ์\" 1 ใบจาก Chronicle ขึ้นมือ",
        "effects": [
          {
            "id": "mechanic_search",
            "name": "ค้นหาเรโซแนนซ์",
            "trigger": "onSummon",
            "speed": 1,
            "cost": {
              "mana": 1
            },
            "do": [
              {
                "op": "search",
                "from": "deck",
                "filter": {
                  "tag": "resonance_spell"
                },
                "to": "hand",
                "count": 1
              }
            ]
          }
        ]
      },
      {
        "id": "mecha_bear",
        "name": "แบร์",
        "type": "monster",
        "level": 2,
        "atk": 1600,
        "def": 1600,
        "mana": "1",
        "count": 1,
        "leader": false,
        "proposed_level": false,
        "tags": ["mecha"],
        "text": "[เมื่อถูกส่งลง Abyss]: จ่าย 1 Arcana เลือกนำ Entity \"เมก้าสไตรก์\" เวล 1 จาก Abyss 1 ใบกลับขึ้นมือ",
        "effects": [
          {
            "id": "bear_salvage",
            "name": "กู้คืนชิ้นส่วน",
            "trigger": "onSentToGrave",
            "speed": 1,
            "cost": {
              "mana": 1
            },
            "do": [
              {
                "op": "search",
                "from": "grave",
                "filter": {
                  "tag": "mecha",
                  "levelMin": 1,
                  "levelMax": 1
                },
                "to": "hand",
                "count": 1
              }
            ]
          }
        ]
      },
      {
        "id": "mecha_commander",
        "name": "ยานแม่คอสมิก (คอมมานเดอร์)",
        "type": "monster",
        "level": 3,
        "atk": 2200,
        "def": 2000,
        "mana": "0",
        "count": 2,
        "leader": true,
        "proposed_level": false,
        "tags": ["mecha", "pioneer"],
        "text": "[ช่อง Pioneer - ต่อเนื่อง]: ยูนิต Resonance ทุกตัวรับพลังโจมตี +200 และเมื่ออัญเชิญ Resonance สำเร็จ (1 ครั้ง/เทิร์น) จั่วการ์ด 1 ใบ (+1 Arcana)",
        "effects": [
          {
            "id": "commander_resonance_aura",
            "name": "บัฟยานแม่",
            "trigger": "continuous",
            "speed": 1,
            "cost": {
              "mana": 0
            },
            "condition": [
              {
                "op": "inLeaderSlot"
              }
            ],
            "do": [
              {
                "op": "modifyStat",
                "aura": true,
                "target": {
                  "side": "self",
                  "zone": "monster",
                  "filter": {
                    "tag": "resonance"
                  }
                },
                "stat": "atk",
                "amount": 200
              }
            ]
          },
          {
            "id": "commander_resonance_draw",
            "name": "คำสั่งเสริมกำลัง",
            "trigger": "onSummon",
            "speed": 1,
            "cost": {
              "mana": 0
            },
            "watch": {
              "zone": "field",
              "side": "self",
              "filter": {
                "tag": "resonance"
              }
            },
            "limit": {
              "per": "turn",
              "key": "commander_draw",
              "count": 1
            },
            "condition": [
              {
                "op": "inLeaderSlot"
              }
            ],
            "do": [
              {
                "op": "draw",
                "count": 1
              }
            ]
          }
        ]
      },
      {
        "id": "mecha_admiral",
        "name": "แอดมิรัล",
        "type": "monster",
        "level": 3,
        "atk": 2400,
        "def": 1800,
        "mana": "1",
        "count": 1,
        "leader": true,
        "proposed_level": false,
        "tags": ["mecha", "pioneer"],
        "text": "[กดใช้บนสนาม - 1 ครั้ง/เทิร์น]: จ่าย 1 Arcana เลือกอัญเชิญพิเศษยูนิต \"เมก้าสไตรก์\" เวล 1 หรือ 2 จาก Abyss 1 ตัวลงสนาม",
        "effects": [
          {
            "id": "admiral_revive",
            "name": "เรียกกำลังพล",
            "trigger": "ignition",
            "speed": 1,
            "cost": {
              "mana": 1
            },
            "limit": {
              "per": "turn",
              "key": "admiral_revive",
              "count": 1
            },
            "condition": [
              {
                "op": "freeMonsterSlot"
              }
            ],
            "do": [
              {
                "op": "specialSummon",
                "from": [
                  "grave"
                ],
                "filter": {
                  "tag": "mecha",
                  "levelMin": 1,
                  "levelMax": 2
                },
                "count": 1
              }
            ]
          }
        ]
      },
      {
        "id": "mecha_resonance",
        "name": "เมก้า เรโซแนนซ์",
        "type": "spell",
        "group": "normal",
        "mana": "1",
        "count": 3,
        "field": false,
        "proposed_level": false,
        "tags": ["mecha", "resonance_spell"],
        "text": "ส่งยูนิตวัสดุจากบนมือ/สนามลง Abyss ตามที่ระบุ อัญเชิญพิเศษยูนิต Resonance 1 ใบจาก Astral Gate",
        "effects": [
          {
            "id": "mecha_resonance_fusion",
            "name": "ผสานร่างเมก้า",
            "trigger": "ignition",
            "speed": 1,
            "cost": {
              "mana": 1
            },
            "condition": [
              {
                "op": "canFusionSummon",
                "filter": {
                  "tag": "mecha"
                },
                "materialsFrom": [
                  "hand",
                  "monster"
                ]
              }
            ],
            "do": [
              {
                "op": "fusionSummon",
                "filter": {
                  "tag": "mecha"
                },
                "materialsFrom": [
                  "hand",
                  "monster"
                ]
              }
            ]
          }
        ]
      },
      {
        "id": "mecha_miracle_reboot",
        "name": "มิราเคิล รีบูต เรโซแนนซ์",
        "type": "spell",
        "group": "normal",
        "mana": "2",
        "count": 2,
        "field": false,
        "proposed_level": false,
        "tags": ["mecha", "resonance_spell"],
        "text": "นำยูนิตวัสดุจาก Abyss ไป Exile ตามที่ระบุ อัญเชิญพิเศษยูนิต Resonance 1 ใบจาก Astral Gate",
        "effects": [
          {
            "id": "mecha_miracle_reboot_fusion",
            "name": "มิราเคิล รีบูต",
            "trigger": "ignition",
            "speed": 1,
            "cost": {
              "mana": 2
            },
            "condition": [
              {
                "op": "canFusionSummon",
                "filter": {
                  "tag": "mecha"
                },
                "materialsFrom": [
                  "grave"
                ]
              }
            ],
            "do": [
              {
                "op": "fusionSummon",
                "filter": {
                  "tag": "mecha"
                },
                "materialsFrom": [
                  "grave"
                ],
                "sendTo": "removed"
              }
            ]
          }
        ]
      },
      {
        "id": "mecha_energy_recovery",
        "name": "กู้คืนพลังงาน",
        "type": "spell",
        "group": "normal",
        "mana": "1",
        "count": 2,
        "field": false,
        "proposed_level": false,
        "tags": ["mecha"],
        "text": "เลือกการ์ด Distortion \"เมก้า เรโซแนนซ์\" 1 ใบ และยูนิต \"เมก้าสไตรก์\" 1 ใบจาก Abyss นำกลับขึ้นมือ",
        "effects": [
          {
            "id": "mecha_energy_salvage",
            "name": "กู้คืนพลังงาน",
            "trigger": "ignition",
            "speed": 1,
            "cost": {
              "mana": 1
            },
            "do": [
              {
                "op": "search",
                "from": "grave",
                "filter": {
                  "cardId": "mecha_resonance"
                },
                "to": "hand",
                "count": 1
              },
              {
                "op": "search",
                "from": "grave",
                "filter": {
                  "tag": "mecha",
                  "levelMin": 1
                },
                "to": "hand",
                "count": 1
              }
            ]
          }
        ]
      },
      {
        "id": "mecha_form_swap",
        "name": "สลับฟอร์ม",
        "type": "spell",
        "group": "normal",
        "mana": "1",
        "count": 2,
        "field": false,
        "proposed_level": false,
        "tags": ["mecha"],
        "text": "ส่งยูนิต Resonance บนสนาม 1 ตัวกลับ Astral Gate; อัญเชิญพิเศษ Entity \"เมก้าสไตรก์\" เวล 1 หรือ 2 ที่มีชื่อต่างกันสูงสุด 2 ตัวจาก Abyss ลงสนาม",
        "effects": [
          {
            "id": "mecha_form_swap_eff",
            "name": "สลับฟอร์ม",
            "trigger": "ignition",
            "speed": 1,
            "cost": {
              "mana": 1
            },
            "condition": [
              {
                "op": "controls",
                "filter": {
                  "tag": "resonance"
                },
                "min": 1
              }
            ],
            "do": [
              {
                "op": "returnToDeck",
                "target": {
                  "side": "self",
                  "zone": "monster",
                  "filter": {
                    "tag": "resonance"
                  },
                  "count": 1,
                  "choose": "player"
                }
              },
              {
                "op": "specialSummon",
                "from": [
                  "grave"
                ],
                "filter": {
                  "tag": "mecha",
                  "levelMin": 1,
                  "levelMax": 2
                },
                "count": 2,
                "distinctName": true
              }
            ]
          }
        ]
      },
      {
        "id": "mecha_call_signal",
        "name": "สัญญาณเรียกพล",
        "type": "spell",
        "group": "normal",
        "mana": "1",
        "count": 3,
        "field": false,
        "proposed_level": false,
        "tags": ["mecha"],
        "text": "ค้นหา Entity \"เมก้าสไตรก์\" เวล 1 จาก Chronicle 1 ใบขึ้นมือ (ไม่ได้รับ Arcana เพิ่มจากการจั่ว/ค้นหา)",
        "effects": [
          {
            "id": "mecha_signal_search",
            "name": "สัญญาณเรียกพล",
            "trigger": "ignition",
            "speed": 1,
            "cost": {
              "mana": 1
            },
            "do": [
              {
                "op": "search",
                "from": "deck",
                "filter": {
                  "tag": "mecha",
                  "levelMin": 1,
                  "levelMax": 1
                },
                "to": "hand",
                "count": 1
              }
            ]
          }
        ]
      },
      {
        "id": "mecha_emergency_supply",
        "name": "เสบียงฉุกเฉิน",
        "type": "spell",
        "group": "normal",
        "mana": "1",
        "count": 2,
        "field": false,
        "proposed_level": false,
        "tags": ["mecha"],
        "text": "[เงื่อนไข: คุมยูนิต \"เมก้าสไตรก์\"]: จั่วการ์ด 2 ใบจาก Chronicle (+2 Arcana จากการจั่ว หักลบค่าร่ายได้กำไรสุทธิ +1 Arcana)",
        "effects": [
          {
            "id": "mecha_supply_draw",
            "name": "เบิกเสบียงฉุกเฉิน",
            "trigger": "ignition",
            "speed": 1,
            "cost": {
              "mana": 1
            },
            "condition": [
              {
                "op": "controls",
                "filter": {
                  "tag": "mecha"
                },
                "min": 1
              }
            ],
            "do": [
              {
                "op": "draw",
                "count": 2
              }
            ]
          }
        ]
      },
      {
        "id": "mecha_strike_city",
        "name": "สไตรก์ซิตี้",
        "type": "spell",
        "group": "normal",
        "field": true,
        "mana": "1",
        "count": 2,
        "proposed_level": false,
        "tags": ["mecha", "field_spell"],
        "text": "[เมื่อประกาศโจมตี]: เมื่อยูนิต \"เมก้าสไตรก์\" ของเราประกาศโจมตี รับพลังโจมตี +500 จนจบเทิร์น",
        "effects": [
          {
            "id": "strike_city_buff",
            "name": "สนามรบสไตรก์ซิตี้",
            "trigger": "onAttackDeclared",
            "speed": 1,
            "cost": {
              "mana": 0
            },
            "condition": [
              {
                "op": "attackTarget",
                "side": "opp"
              }
            ],
            "do": [
              {
                "op": "modifyStat",
                "target": "attacker",
                "stat": "atk",
                "amount": 500,
                "duration": "endTurn"
              }
            ]
          }
        ]
      },
      {
        "id": "mecha_shield_reflect",
        "name": "เกราะสะท้อนพลังงาน",
        "type": "spell",
        "group": "counter",
        "mana": "1",
        "count": 2,
        "field": false,
        "proposed_level": false,
        "tags": ["mecha"],
        "text": "[สั่งใช้จากมือ เมื่อถูกโจมตี]: เมื่อยูนิตของเราตกเป็นเป้าโจมตี จ่าย 1 Arcana ยกเลิกการโจมตีนั้น 1 ครั้ง",
        "effects": [
          {
            "id": "shield_reflect_negate",
            "name": "เกราะสะท้อนพลังงาน",
            "trigger": "quick",
            "speed": 3,
            "timingWindow": [
              "attackDeclared"
            ],
            "cost": {
              "mana": 1
            },
            "condition": [
              {
                "op": "attackTarget",
                "side": "self",
                "filter": {
                  "tag": "mecha"
                }
              }
            ],
            "do": [
              {
                "op": "negateAttack"
              }
            ]
          }
        ]
      },
      {
        "id": "mecha_vital_sign",
        "name": "สัญญาณชีพจักรกล",
        "type": "spell",
        "group": "set",
        "mana": "1",
        "count": 1,
        "field": false,
        "proposed_level": false,
        "tags": ["mecha"],
        "text": "[เมื่อยูนิตถูกทำลายจากการต่อสู้]: เปิดใช้งานเพื่ออัญเชิญพิเศษ Entity \"เมก้าสไตรก์\" เวล 1 จาก Chronicle 1 ตัวลงสนาม",
        "effects": [
          {
            "id": "vital_sign_summon",
            "name": "สัญญาณชีพจักรกล",
            "trigger": "quick",
            "speed": 2,
            "timingWindow": [
              "monsterDestroyed"
            ],
            "cost": {
              "mana": 1
            },
            "condition": [
              {
                "op": "destroyedMonster",
                "side": "self",
                "filter": {
                  "tag": "mecha"
                }
              },
              {
                "op": "freeMonsterSlot"
              }
            ],
            "do": [
              {
                "op": "specialSummon",
                "from": [
                  "deck"
                ],
                "filter": {
                  "tag": "mecha",
                  "levelMin": 1,
                  "levelMax": 1
                },
                "count": 1
              }
            ]
          }
        ]
      },
      {
        "id": "mecha_intercept_beam",
        "name": "ลำแสงสกัดกั้น",
        "type": "spell",
        "group": "set",
        "mana": "1",
        "count": 1,
        "field": false,
        "proposed_level": false,
        "tags": ["mecha"],
        "text": "[เมื่อศัตรูอัญเชิญยูนิต]: บังคับเปลี่ยนยูนิตที่ถูกอัญเชิญเป็นท่าป้องกันหงายหน้า และลด DEF ลง 500 จนจบเทิร์น",
        "effects": [
          {
            "id": "intercept_beam_pos",
            "name": "ลำแสงสกัดกั้น",
            "trigger": "quick",
            "speed": 2,
            "timingWindow": [
              "summon"
            ],
            "cost": {
              "mana": 1
            },
            "condition": [
              {
                "op": "targetLink",
                "side": "opp"
              }
            ],
            "do": [
              {
                "op": "changePosition",
                "target": {
                  "side": "opp",
                  "zone": "monster",
                  "count": 1,
                  "choose": "player"
                },
                "position": "def"
              },
              {
                "op": "modifyStat",
                "target": {
                  "side": "opp",
                  "zone": "monster",
                  "count": 1,
                  "choose": "player"
                },
                "stat": "def",
                "amount": -500,
                "duration": "endTurn"
              }
            ]
          }
        ]
      }
    ],
    "extra": [
      {
        "id": "mecha_skyburner",
        "name": "สกายเบิร์นเนอร์",
        "type": "fusion",
        "level": 2,
        "atk": 1900,
        "def": 1400,
        "mana": "1",
        "leader": false,
        "proposed_level": false,
        "tags": ["mecha", "resonance"],
        "materials": "ฟอลคอน + ไลออน",
        "materialSlots": [
          {
            "cardId": "mecha_falcon"
          },
          {
            "cardId": "mecha_lion"
          }
        ],
        "text": "[เมื่อทำลายยูนิตจากการต่อสู้]: จ่าย 1 Arcana สร้างความเสียหายใส่ FP ศัตรูเท่ากับ 800 FP",
        "effects": [
          {
            "id": "skyburner_burn",
            "name": "เบิร์นเนอร์สไตรก์",
            "trigger": "onBattleDestroy",
            "speed": 1,
            "cost": {
              "mana": 1
            },
            "do": [
              {
                "op": "damage",
                "player": "opp",
                "amount": 800
              }
            ]
          }
        ]
      },
      {
        "id": "mecha_fortress_cannon",
        "name": "ฟอร์เทรส แคนนอน",
        "type": "fusion",
        "level": 2,
        "atk": 1500,
        "def": 2300,
        "mana": "2",
        "leader": false,
        "proposed_level": false,
        "tags": ["mecha", "resonance"],
        "materials": "ไลออน + ไรโน",
        "materialSlots": [
          {
            "cardId": "mecha_lion"
          },
          {
            "cardId": "mecha_rhino"
          }
        ],
        "text": "[กดใช้บนสนาม - 1 ครั้ง/เทิร์น]: ขณะอยู่ในท่าป้องกัน จ่าย 2 Arcana เลือกยูนิตศัตรู 1 ตัว ลด ATK ลง 300 ถาวร",
        "effects": [
          {
            "id": "fortress_debuff",
            "name": "ปืนใหญ่ฟอร์เทรส",
            "trigger": "ignition",
            "speed": 1,
            "cost": {
              "mana": 2
            },
            "limit": {
              "per": "turn",
              "key": "fortress_cannon",
              "count": 1
            },
            "condition": [
              {
                "op": "selfPosition",
                "position": "def"
              }
            ],
            "do": [
              {
                "op": "modifyStat",
                "target": {
                  "side": "opp",
                  "zone": "monster",
                  "count": 1,
                  "choose": "player"
                },
                "stat": "atk",
                "amount": -300,
                "duration": "permanent"
              }
            ]
          }
        ]
      },
      {
        "id": "mecha_hydro_storm",
        "name": "ไฮโดร สตอร์ม",
        "type": "fusion",
        "level": 2,
        "atk": 1800,
        "def": 1600,
        "mana": "1",
        "leader": false,
        "proposed_level": false,
        "tags": ["mecha", "resonance"],
        "materials": "ฟอลคอน + ดอลฟิน",
        "materialSlots": [
          {
            "cardId": "mecha_falcon"
          },
          {
            "cardId": "mecha_dolphin"
          }
        ],
        "text": "[กดใช้บนสนาม - 1 ครั้ง/เทิร์น]: จ่าย 1 Arcana เลือกการ์ดบนสนามศัตรู 1 ใบ ส่งกลับขึ้นมือ",
        "effects": [
          {
            "id": "hydro_bounce",
            "name": "พายุกวาดล้าง",
            "trigger": "ignition",
            "speed": 1,
            "cost": {
              "mana": 1
            },
            "limit": {
              "per": "turn",
              "key": "hydro_bounce",
              "count": 1
            },
            "do": [
              {
                "op": "returnToHand",
                "target": {
                  "side": "opp",
                  "zone": "monster",
                  "count": 1,
                  "choose": "player"
                }
              }
            ]
          }
        ]
      },
      {
        "id": "mecha_thunder_juggernaut",
        "name": "ธันเดอร์ จั๊กเกอร์นอต",
        "type": "fusion",
        "level": 2,
        "atk": 2100,
        "def": 1800,
        "mana": "1",
        "leader": false,
        "proposed_level": false,
        "tags": ["mecha", "resonance"],
        "materials": "ไรโน + สปาร์คไทเกอร์",
        "materialSlots": [
          {
            "cardId": "mecha_rhino"
          },
          {
            "cardId": "mecha_spark_tiger"
          }
        ],
        "text": "[กดใช้บนสนาม - 1 ครั้ง/เทิร์น]: จ่าย 1 Arcana + ทิ้งการ์ดมือ 1 ใบลง Abyss; ทำลายยูนิตศัตรูที่มี ATK น้อยกว่าการ์ดนี้ 1 ตัว",
        "effects": [
          {
            "id": "thunder_destroy",
            "name": "สายฟ้าทำลายล้าง",
            "trigger": "ignition",
            "speed": 1,
            "cost": {
              "mana": 1
            },
            "limit": {
              "per": "turn",
              "key": "thunder_destroy",
              "count": 1
            },
            "do": [
              {
                "op": "sendToGrave",
                "target": {
                  "side": "self",
                  "zone": "hand",
                  "count": 1,
                  "choose": "player"
                }
              },
              {
                "op": "destroy",
                "target": {
                  "side": "opp",
                  "zone": "monster",
                  "filter": {
                    "atkBelowSource": true
                  },
                  "count": 1,
                  "choose": "player"
                }
              }
            ]
          }
        ]
      },
      {
        "id": "mecha_trinity_tempest",
        "name": "ทรินิตี้ เทมเพสต์",
        "type": "fusion",
        "level": 3,
        "atk": 2600,
        "def": 2100,
        "mana": "1",
        "leader": false,
        "proposed_level": false,
        "tags": ["mecha", "resonance"],
        "materials": "ฟอลคอน + ไลออน + สปาร์คไทเกอร์",
        "materialSlots": [
          {
            "cardId": "mecha_falcon"
          },
          {
            "cardId": "mecha_lion"
          },
          {
            "cardId": "mecha_spark_tiger"
          }
        ],
        "text": "[ต่อเนื่อง (0 Arcana)]: รับ ATK +100 ตามจำนวนการ์ด \"เมก้าสไตรก์\" ใน Abyss\n[เอฟเฟกต์เร็ว (1 Arcana)]: เทิร์นละ 1 ครั้ง ไม่ถูกทำลายจากการต่อสู้หรือเอฟเฟกต์ในเทิร์นนี้",
        "effects": [
          {
            "id": "trinity_abyss_boost",
            "name": "พลังสะสมอบิส",
            "trigger": "continuous",
            "speed": 1,
            "cost": {
              "mana": 0
            },
            "do": [
              {
                "op": "modifyStat",
                "aura": true,
                "target": "self",
                "stat": "atk",
                "per": 100,
                "zone": "grave",
                "side": "self",
                "filter": {
                  "tag": "mecha"
                }
              }
            ]
          },
          {
            "id": "trinity_shield",
            "name": "บาเรียทรินิตี้",
            "trigger": "quick",
            "speed": 2,
            "timingWindow": [
              "anyActivation",
              "attackDeclared"
            ],
            "cost": {
              "mana": 1
            },
            "limit": {
              "per": "turn",
              "key": "trinity_shield",
              "count": 1
            },
            "do": [
              {
                "op": "preventDestruction",
                "target": "self",
                "duration": "endTurn"
              }
            ]
          }
        ]
      },
      {
        "id": "mecha_genesis_core",
        "name": "เจเนซิส คอร์",
        "type": "fusion",
        "level": 3,
        "atk": 3000,
        "def": 3000,
        "mana": "2",
        "leader": false,
        "proposed_level": false,
        "tags": ["mecha", "resonance"],
        "materials": "ฟอลคอน + ไลออน + ไรโน + ดอลฟิน + สปาร์คไทเกอร์",
        "materialSlots": [
          {
            "cardId": "mecha_falcon"
          },
          {
            "cardId": "mecha_lion"
          },
          {
            "cardId": "mecha_rhino"
          },
          {
            "cardId": "mecha_dolphin"
          },
          {
            "cardId": "mecha_spark_tiger"
          }
        ],
        "text": "[ต่อเนื่อง (0 Arcana)]: ไม่ถูกทำลายจากเอฟเฟกต์ศัตรู\n[กดใช้ (2 Arcana)]: 1 ครั้ง/เทิร์น นำการ์ดใน Exile 2 ใบเข้า Chronicle; เด้งการ์ดบนสนามศัตรูสูงสุด 2 ใบคืนขึ้นมือ",
        "effects": [
          {
            "id": "genesis_immune",
            "name": "เกราะเจเนซิส",
            "trigger": "continuous",
            "speed": 1,
            "cost": {
              "mana": 0
            },
            "do": [
              {
                "op": "preventDestruction",
                "target": "self",
                "condition": [
                  {
                    "op": "cause",
                    "cause": "effect"
                  }
                ]
              }
            ]
          },
          {
            "id": "genesis_bounce_eff",
            "name": "คลื่นกระแทกเจเนซิส",
            "trigger": "ignition",
            "speed": 1,
            "cost": {
              "mana": 2
            },
            "limit": {
              "per": "turn",
              "key": "genesis_bounce",
              "count": 1
            },
            "do": [
              {
                "op": "returnToDeck",
                "target": {
                  "side": "self",
                  "zone": "removed",
                  "filter": {
                    "tag": "mecha"
                  },
                  "count": 2,
                  "choose": "player"
                }
              },
              {
                "op": "returnToHand",
                "target": {
                  "side": "opp",
                  "zone": "monster",
                  "count": 2,
                  "choose": "player"
                }
              }
            ]
          }
        ]
      },
      {
        "id": "mecha_cosmic_omega",
        "name": "คอสมิก โอเมก้า",
        "type": "grade4",
        "level": 3,
        "atk": 2900,
        "def": 2500,
        "mana": "2",
        "leader": false,
        "proposed_level": false,
        "tags": ["mecha", "apex"],
        "materials": "นำ Exile 2 ใบเข้าเด็ค + วางทับบน Resonance",
        "extraSummon": {
          "onto": {
            "tag": "resonance"
          },
          "cost": [
            {
              "op": "returnToDeck",
              "target": {
                "side": "self",
                "zone": "removed",
                "filter": {
                  "tag": "mecha"
                },
                "count": 2
              },
              "shuffle": true
            }
          ]
        },
        "text": "[เงื่อนไขอัญเชิญ Apex]: นำการ์ด \"เมก้าสไตรก์\" ใน Exile 2 ใบเข้า Chronicle และวางการ์ดใบนี้ทับซ้อนบนยูนิต Resonance บนสนามเรา 1 ตัว (กลายเป็น Core)\n[กดใช้ (2 Arcana)]: 1 ครั้ง/เทิร์น ทำลายยูนิตศัตรู 1 ตัว และยิง 1000 FP ศัตรู",
        "effects": [
          {
            "id": "cosmic_omega_blast",
            "name": "โอเมก้าแคนนอน",
            "trigger": "ignition",
            "speed": 1,
            "cost": {
              "mana": 2
            },
            "limit": {
              "per": "turn",
              "key": "omega_blast",
              "count": 1
            },
            "do": [
              {
                "op": "destroy",
                "target": {
                  "side": "opp",
                  "zone": "monster",
                  "count": 1,
                  "choose": "player"
                }
              },
              {
                "op": "damage",
                "player": "opp",
                "amount": 1000
              }
            ]
          }
        ]
      }
    ]
  };
})();