// cards/cube_forge.js - ข้อมูลการ์ดเด็ค คิวบ์ฟอร์จ (Cube Forge)
// ธีม ตัวเหลี่ยม ผจญภัย สาย Forge & Equip + ถมสุสาน | ระบบวางทับ Apex (Grade 4) เผ่าเหลี่ยมล้วน
(function () {
  const CG = (globalThis.CG = globalThis.CG || {});
  CG.cards = CG.cards || {};
  CG.cards.cube_forge = {
  "key": "cube_forge",
  "name": "เด็คคิวบ์ฟอร์จ (Cube Forge)",
  "main": [
    {
      "id": "cube_kobo_trainee",
      "name": "เหลี่ยม คูโบ ฝึกหัด",
      "type": "monster",
      "level": 1,
      "atk": 800,
      "def": 600,
      "mana": "0",
      "count": 3,
      "leader": false,
      "proposed_level": false,
      "tags": [
        "เหลี่ยม"
      ],
      "text": "[เมื่ออัญเชิญปกติสำเร็จ]: เลือก 1 จาก 2 (choice) ค้น \"ดาบกิ่งไม้\" หรือ \"แท่นประกอบ\" 1 ใบจาก Chronicle ขึ้นมือ",
      "effects": [
        {
          "id": "cube_kobo_search",
          "name": "ค้นหาอาวุธตั้งต้น",
          "trigger": "onNormalSummon",
          "speed": 1,
          "cost": {
            "mana": 0
          },
          "do": [
            {
              "op": "choice",
              "options": [
                {
                  "label": "ค้น ดาบกิ่งไม้",
                  "do": [
                    {
                      "op": "search",
                      "from": "deck",
                      "filter": {
                        "cardId": "cube_wood_sword"
                      },
                      "to": "hand",
                      "count": 1
                    }
                  ]
                },
                {
                  "label": "ค้น แท่นประกอบ",
                  "do": [
                    {
                      "op": "search",
                      "from": "deck",
                      "filter": {
                        "cardId": "cube_crafting_table"
                      },
                      "to": "hand",
                      "count": 1
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "id": "cube_bella_trainee",
      "name": "เหลี่ยม เบลลา ฝึกหัด",
      "type": "monster",
      "level": 1,
      "atk": 700,
      "def": 700,
      "mana": "1",
      "count": 2,
      "leader": false,
      "proposed_level": false,
      "tags": [
        "เหลี่ยม"
      ],
      "text": "[เมื่ออัญเชิญสำเร็จ]: จ่าย 1 Arcana อัญเชิญพิเศษ \"เหลี่ยม คูโบ ฝึกหัด\" 1 ตัวจาก Chronicle ลงสนาม",
      "effects": [
        {
          "id": "cube_bella_summon",
          "name": "เรียกคู่หูคูโบ",
          "trigger": "onSummon",
          "speed": 1,
          "cost": {
            "mana": 1
          },
          "do": [
            {
              "op": "specialSummon",
              "from": "deck",
              "filter": {
                "cardId": "cube_kobo_trainee"
              },
              "count": 1,
              "to": "field"
            }
          ]
        }
      ]
    },
    {
      "id": "cube_slime",
      "name": "เหลี่ยมโคลน",
      "type": "monster",
      "level": 1,
      "atk": 700,
      "def": 500,
      "mana": "0",
      "count": 2,
      "leader": false,
      "proposed_level": false,
      "tags": [
        "เหลี่ยม"
      ],
      "text": "[ดรอป - เมื่อถูกส่งลง Abyss]: ค้น \"ดาบกิ่งไม้\" หรือ \"ดาบก้อนหิน\" 1 ใบขึ้นมือ (ใช้ตัวจำกัดดรอปร่วมกัน 1 ครั้ง/เทิร์น)",
      "effects": [
        {
          "id": "cube_slime_drop",
          "name": "ดรอปดาบ",
          "trigger": "onSentToGrave",
          "speed": 1,
          "limit": {
            "per": "turn",
            "key": "cube_drop_limit",
            "count": 1
          },
          "do": [
            {
              "op": "choice",
              "options": [
                {
                  "label": "ค้น ดาบกิ่งไม้",
                  "do": [
                    {
                      "op": "search",
                      "from": "deck",
                      "filter": {
                        "cardId": "cube_wood_sword"
                      },
                      "to": "hand",
                      "count": 1
                    }
                  ]
                },
                {
                  "label": "ค้น ดาบก้อนหิน",
                  "do": [
                    {
                      "op": "search",
                      "from": "deck",
                      "filter": {
                        "cardId": "cube_stone_sword"
                      },
                      "to": "hand",
                      "count": 1
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "id": "cube_skeleton",
      "name": "เหลี่ยมกระดูก",
      "type": "monster",
      "level": 1,
      "atk": 900,
      "def": 400,
      "mana": "0",
      "count": 2,
      "leader": false,
      "proposed_level": false,
      "tags": [
        "เหลี่ยม"
      ],
      "text": "[ดรอป - เมื่อถูกส่งลง Abyss]: ค้น \"ธนูลูกบาศก์\" 1 ใบจาก Chronicle ขึ้นมือ (ใช้ตัวจำกัดดรอปร่วม)",
      "effects": [
        {
          "id": "cube_skeleton_drop",
          "name": "ดรอปธนู",
          "trigger": "onSentToGrave",
          "speed": 1,
          "limit": {
            "per": "turn",
            "key": "cube_drop_limit",
            "count": 1
          },
          "do": [
            {
              "op": "search",
              "from": "deck",
              "filter": {
                "cardId": "cube_bow"
              },
              "to": "hand",
              "count": 1
            }
          ]
        }
      ]
    },
    {
      "id": "cube_miner",
      "name": "เหลี่ยมขุดหิน",
      "type": "monster",
      "level": 1,
      "atk": 700,
      "def": 500,
      "mana": "0",
      "count": 1,
      "leader": false,
      "proposed_level": false,
      "tags": [
        "เหลี่ยม"
      ],
      "text": "[เมื่ออัญเชิญปกติสำเร็จ]: ส่งการ์ด 3 ใบบนสุดของ Chronicle ลง Abyss แล้วถ้าสำเร็จ ยูนิตนี้ได้ +300 ATK จนจบเทิร์น",
      "effects": [
        {
          "id": "cube_miner_mill",
          "name": "ขุดหาแร่",
          "trigger": "onNormalSummon",
          "speed": 1,
          "cost": {
            "mana": 0
          },
          "do": [
            {
              "op": "sendToGrave",
              "from": "deckTop",
              "count": 3
            },
            {
              "op": "modifyStat",
              "target": "self",
              "stat": "atk",
              "val": 300,
              "duration": "turn",
              "condition": {
                "op": "previousOpSuccess"
              }
            }
          ]
        }
      ]
    },
    {
      "id": "cube_scout",
      "name": "เหลี่ยมสำรวจ",
      "type": "monster",
      "level": 1,
      "atk": 600,
      "def": 600,
      "mana": "0",
      "count": 2,
      "leader": false,
      "proposed_level": false,
      "tags": [
        "เหลี่ยม"
      ],
      "text": "[เมื่ออัญเชิญปกติสำเร็จ]: ทิ้งการ์ด 1 ใบจากมือลง Abyss แล้วค้น Entity \"เหลี่ยม\" เวล 1 ชื่ออื่น 1 ใบขึ้นมือ\n[ดรอป - เมื่อถูกส่งลง Abyss]: ค้นการ์ด \"เหลี่ยม\" เวล 1 ที่ไม่ใช่ใบนี้ 1 ใบขึ้นมือ (ใช้ตัวจำกัดดรอปร่วม)",
      "effects": [
        {
          "id": "cube_scout_search",
          "name": "สำรวจเพื่อนร่วมทีม",
          "trigger": "onNormalSummon",
          "speed": 1,
          "do": [
            {
              "op": "discard",
              "count": 1
            },
            {
              "op": "search",
              "from": "deck",
              "filter": {
                "tag": "เหลี่ยม",
                "levelMin": 1,
                "levelMax": 1,
                "excludeId": "cube_scout"
              },
              "to": "hand",
              "count": 1,
              "condition": {
                "op": "previousOpSuccess"
              }
            }
          ]
        },
        {
          "id": "cube_scout_drop",
          "name": "ดรอปเหลี่ยมเวล 1",
          "trigger": "onSentToGrave",
          "speed": 1,
          "limit": {
            "per": "turn",
            "key": "cube_drop_limit",
            "count": 1
          },
          "do": [
            {
              "op": "search",
              "from": "deck",
              "filter": {
                "tag": "เหลี่ยม",
                "levelMin": 1,
                "levelMax": 1,
                "excludeId": "cube_scout"
              },
              "to": "hand",
              "count": 1
            }
          ]
        }
      ]
    },
    {
      "id": "cube_bomb",
      "name": "เหลี่ยมระเบิด",
      "type": "monster",
      "level": 1,
      "atk": 1000,
      "def": 200,
      "mana": "0",
      "count": 1,
      "leader": false,
      "proposed_level": false,
      "tags": [
        "เหลี่ยม"
      ],
      "text": "[กดใช้บนสนาม - 1 ครั้ง/เทิร์น]: ส่งตัวเองลง Abyss แล้วทำลายยูนิตศัตรูที่ ATK ต่ำสุด 1 ตัว",
      "effects": [
        {
          "id": "cube_bomb_detonate",
          "name": "ระเบิดพลีชีพ",
          "trigger": "ignition",
          "speed": 1,
          "cost": {
            "mana": 0
          },
          "limit": {
            "per": "turn",
            "key": "cube_bomb_detonate",
            "count": 1
          },
          "do": [
            {
              "op": "sendToGrave",
              "target": "self"
            },
            {
              "op": "destroy",
              "target": {
                "side": "opp",
                "zone": "monster",
                "pick": "lowestAtk",
                "count": 1
              }
            }
          ]
        }
      ]
    },
    {
      "id": "cube_metal_giant",
      "name": "ยักษ์เหลี่ยมโลหะ",
      "type": "monster",
      "level": 2,
      "atk": 1600,
      "def": 1600,
      "mana": "1",
      "count": 1,
      "leader": false,
      "proposed_level": false,
      "tags": [
        "เหลี่ยม"
      ],
      "text": "[เมื่ออัญเชิญสำเร็จ]: จ่าย 1 Arcana ค้น \"ดาบโลหะ\" 1 ใบจาก Chronicle ขึ้นมือ",
      "effects": [
        {
          "id": "cube_giant_search",
          "name": "หาดาบโลหะ",
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
                "cardId": "cube_iron_sword"
              },
              "to": "hand",
              "count": 1
            }
          ]
        }
      ]
    },
    {
      "id": "cube_blacksmith",
      "name": "ช่างเหลี่ยมตีโลหะ",
      "type": "monster",
      "level": 2,
      "atk": 1200,
      "def": 1800,
      "mana": "0",
      "count": 2,
      "leader": false,
      "proposed_level": false,
      "tags": [
        "เหลี่ยม"
      ],
      "text": "[ตีโลหะ - กดใช้บนสนาม 1 ครั้ง/เทิร์น]: จ่าย 2 Arcana ส่งอุปกรณ์สายดาบของเรา 1 ใบลง Abyss แล้วเลือก 1 จาก 2 ทาง: ค้นหา 'ดาบกิ่งไม้' 1 ใบ หรือ ค้นหา 'ดาบก้อนหิน'/'ดาบโลหะ' 1 ใบขึ้นมือ",
      "effects": [
        {
          "id": "blacksmith_forge",
          "name": "ตีโลหะหลอมดาบ",
          "trigger": "ignition",
          "speed": 1,
          "cost": {
            "mana": 2
          },
          "limit": {
            "per": "turn",
            "key": "cube_blacksmith_forge",
            "count": 1
          },
          "do": [
            {
              "op": "sendToGrave",
              "target": {
                "side": "self",
                "zone": "spell",
                "filter": {
                  "tag": "sword"
                },
                "count": 1,
                "choose": "player"
              }
            },
            {
              "op": "choice",
              "condition": {
                "op": "previousOpSuccess"
              },
              "options": [
                {
                  "label": "ค้นหา ดาบกิ่งไม้ (1 ใบ)",
                  "do": [
                    {
                      "op": "search",
                      "from": "deck",
                      "filter": {
                        "cardId": "cube_wood_sword"
                      },
                      "to": "hand",
                      "count": 1
                    }
                  ]
                },
                {
                  "label": "ค้นหา ดาบก้อนหิน หรือ ดาบโลหะ (1 ใบ)",
                  "do": [
                    {
                      "op": "search",
                      "from": "deck",
                      "filter": {
                        "tag": "sword",
                        "levelMax": 2,
                        "excludeId": "cube_wood_sword"
                      },
                      "to": "hand",
                      "count": 1
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "id": "cube_tall_shadow",
      "name": "เหลี่ยมเงาสูง",
      "type": "monster",
      "level": 3,
      "atk": 2400,
      "def": 2000,
      "mana": "0",
      "count": 1,
      "leader": true,
      "proposed_level": false,
      "tags": [
        "เหลี่ยม",
        "pioneer"
      ],
      "text": "[ต่อเนื่อง]: +100 ATK ต่อ Entity เวล 1 ใน Abyss ของเรา (สูงสุด +800)\n[กดใช้บนสนาม - 1 ครั้ง/เทิร์น]: จ่าย 1 Arcana เลือกเปลี่ยนท่าต่อสู้ยูนิตศัตรู 1 ตัว หรืออัญเชิญพิเศษ Entity เวล 1 จาก Abyss 1 ตัว",
      "effects": [
        {
          "id": "cube_shadow_aura",
          "name": "พลังเงาจากสุสาน",
          "trigger": "continuous",
          "speed": 1,
          "do": [
            {
              "op": "modifyStat",
              "target": "self",
              "stat": "atk",
              "val": 100,
              "multiplier": {
                "from": "grave",
                "filter": {
                  "tag": "เหลี่ยม",
                  "levelMin": 1,
                  "levelMax": 1
                },
                "max": 8
              },
              "aura": true
            }
          ]
        },
        {
          "id": "cube_shadow_ability",
          "name": "ควบคุมเงา",
          "trigger": "ignition",
          "speed": 1,
          "cost": {
            "mana": 1
          },
          "limit": {
            "per": "turn",
            "key": "cube_shadow_ability",
            "count": 1
          },
          "do": [
            {
              "op": "choice",
              "options": [
                {
                  "label": "เปลี่ยนท่าต่อสู้ยูนิตศัตรู",
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
                },
                {
                  "label": "ชุบชีวิต Entity เวล 1",
                  "do": [
                    {
                      "op": "specialSummon",
                      "from": "grave",
                      "filter": {
                        "tag": "เหลี่ยม",
                        "levelMin": 1,
                        "levelMax": 1
                      },
                      "count": 1,
                      "to": "field"
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "id": "cube_kobo_adventurer",
      "name": "เหลี่ยม คูโบ นักผจญภัย",
      "type": "monster",
      "level": 3,
      "atk": 2500,
      "def": 2000,
      "mana": "2",
      "count": 1,
      "leader": true,
      "proposed_level": false,
      "tags": [
        "เหลี่ยม",
        "pioneer"
      ],
      "text": "[เมื่ออัญเชิญสำเร็จ]: จ่าย 2 Arcana ค้นอุปกรณ์ที่ไม่ใช่ดาบแกนดำ 1 ใบขึ้นมือ แล้วถม 2 ใบบนของ Chronicle\n[ดรอป - เมื่อถูกส่งลง Abyss]: คืนอุปกรณ์จาก Abyss 1 ใบขึ้นมือ",
      "effects": [
        {
          "id": "cube_adventurer_summon",
          "name": "ค้นหาอุปกรณ์ผจญภัย",
          "trigger": "onSummon",
          "speed": 1,
          "cost": {
            "mana": 2
          },
          "do": [
            {
              "op": "search",
              "from": "deck",
              "filter": {
                "tag": "equip",
                "excludeId": "cube_dark_core_sword"
              },
              "to": "hand",
              "count": 1
            },
            {
              "op": "sendToGrave",
              "from": "deckTop",
              "count": 2
            }
          ]
        },
        {
          "id": "cube_adventurer_drop",
          "name": "กู้อุปกรณ์กลับมือ",
          "trigger": "onSentToGrave",
          "speed": 1,
          "do": [
            {
              "op": "returnToHand",
              "from": "grave",
              "filter": {
                "tag": "equip"
              },
              "count": 1
            }
          ]
        }
      ]
    },
    {
      "id": "cube_wood_sword",
      "name": "ดาบกิ่งไม้",
      "type": "spell",
      "group": "continuous",
      "mana": "0",
      "count": 2,
      "field": false,
      "proposed_level": false,
      "tags": [
        "เหลี่ยม",
        "equip",
        "sword"
      ],
      "text": "[ต่อเนื่อง]: ยูนิต \"เหลี่ยม\" ของเราทุกตัว +300 ATK\n[เมื่อใช้]: ส่งอุปกรณ์สายดาบใบอื่นของเราบนสนามลง Abyss",
      "effects": [
        {
          "id": "wood_sword_aura",
          "name": "พลังดาบกิ่งไม้",
          "trigger": "continuous",
          "speed": 1,
          "do": [
            {
              "op": "modifyStat",
              "target": {
                "side": "self",
                "zone": "monster",
                "filter": {
                  "tag": "เหลี่ยม"
                }
              },
              "stat": "atk",
              "val": 300,
              "aura": true
            }
          ]
        },
        {
          "id": "wood_sword_replace",
          "name": "สลับดาบ",
          "trigger": "onSummon",
          "speed": 1,
          "do": [
            {
              "op": "sendToGrave",
              "target": {
                "side": "self",
                "zone": "spell",
                "filter": {
                  "tag": "sword"
                },
                "other": true
              }
            }
          ]
        }
      ]
    },
    {
      "id": "cube_stone_sword",
      "name": "ดาบก้อนหิน",
      "type": "spell",
      "group": "continuous",
      "mana": "1",
      "count": 2,
      "field": false,
      "proposed_level": false,
      "tags": [
        "เหลี่ยม",
        "equip",
        "sword"
      ],
      "text": "[ต่อเนื่อง]: ยูนิต \"เหลี่ยม\" ของเราทุกตัว +600 ATK\n[เมื่อใช้]: ส่งอุปกรณ์สายดาบใบอื่นของเราบนสนามลง Abyss",
      "effects": [
        {
          "id": "stone_sword_aura",
          "name": "พลังดาบก้อนหิน",
          "trigger": "continuous",
          "speed": 1,
          "do": [
            {
              "op": "modifyStat",
              "target": {
                "side": "self",
                "zone": "monster",
                "filter": {
                  "tag": "เหลี่ยม"
                }
              },
              "stat": "atk",
              "val": 600,
              "aura": true
            }
          ]
        },
        {
          "id": "stone_sword_replace",
          "name": "สลับดาบ",
          "trigger": "onSummon",
          "speed": 1,
          "do": [
            {
              "op": "sendToGrave",
              "target": {
                "side": "self",
                "zone": "spell",
                "filter": {
                  "tag": "sword"
                },
                "other": true
              }
            }
          ]
        }
      ]
    },
    {
      "id": "cube_iron_sword",
      "name": "ดาบโลหะ",
      "type": "spell",
      "group": "continuous",
      "mana": "1",
      "count": 2,
      "field": false,
      "proposed_level": false,
      "tags": [
        "เหลี่ยม",
        "equip",
        "sword"
      ],
      "text": "[ต่อเนื่อง]: ยูนิต \"เหลี่ยม\" เวล 2 ขึ้นไป ของเรา +900 ATK\n[เมื่อใช้]: ส่งอุปกรณ์สายดาบใบอื่นของเราบนสนามลง Abyss",
      "effects": [
        {
          "id": "iron_sword_aura",
          "name": "พลังดาบโลหะ",
          "trigger": "continuous",
          "speed": 1,
          "do": [
            {
              "op": "modifyStat",
              "target": {
                "side": "self",
                "zone": "monster",
                "filter": {
                  "tag": "เหลี่ยม",
                  "levelMin": 2
                }
              },
              "stat": "atk",
              "val": 900,
              "aura": true
            }
          ]
        },
        {
          "id": "iron_sword_replace",
          "name": "สลับดาบ",
          "trigger": "onSummon",
          "speed": 1,
          "do": [
            {
              "op": "sendToGrave",
              "target": {
                "side": "self",
                "zone": "spell",
                "filter": {
                  "tag": "sword"
                },
                "other": true
              }
            }
          ]
        }
      ]
    },
    {
      "id": "cube_crystal_sword",
      "name": "ดาบผลึก",
      "type": "spell",
      "group": "continuous",
      "mana": "2",
      "count": 2,
      "field": false,
      "proposed_level": false,
      "tags": [
        "เหลี่ยม",
        "equip",
        "sword"
      ],
      "text": "[ต่อเนื่อง]: ยูนิต \"เหลี่ยม\" เวล 3 ขึ้นไป ของเรา +1300 ATK\n[เมื่อใช้]: ส่งอุปกรณ์สายดาบใบอื่นของเราบนสนามลง Abyss",
      "effects": [
        {
          "id": "crystal_sword_aura",
          "name": "พลังดาบผลึก",
          "trigger": "continuous",
          "speed": 1,
          "do": [
            {
              "op": "modifyStat",
              "target": {
                "side": "self",
                "zone": "monster",
                "filter": {
                  "tag": "เหลี่ยม",
                  "levelMin": 3
                }
              },
              "stat": "atk",
              "val": 1300,
              "aura": true
            }
          ]
        },
        {
          "id": "crystal_sword_replace",
          "name": "สลับดาบ",
          "trigger": "onSummon",
          "speed": 1,
          "do": [
            {
              "op": "sendToGrave",
              "target": {
                "side": "self",
                "zone": "spell",
                "filter": {
                  "tag": "sword"
                },
                "other": true
              }
            }
          ]
        }
      ]
    },
    {
      "id": "cube_dark_core_sword",
      "name": "ดาบแกนดำ",
      "type": "spell",
      "group": "continuous",
      "mana": "0",
      "count": 1,
      "field": false,
      "proposed_level": false,
      "tags": [
        "เหลี่ยม",
        "equip",
        "sword"
      ],
      "text": "[ต้นทุน]: ส่ง \"ดาบผลึก\" ของเราบนสนามลง Abyss\n[ต่อเนื่อง]: ยูนิต \"เหลี่ยม\" เวล 3 ขึ้นไป ของเรา +1800 ATK และไม่ถูกทำลายจากเอฟเฟกต์",
      "effects": [
        {
          "id": "dark_sword_cost",
          "name": "สังเวยดาบผลึก",
          "trigger": "onSummon",
          "speed": 1,
          "do": [
            {
              "op": "sendToGrave",
              "target": {
                "side": "self",
                "zone": "spell",
                "filter": {
                  "cardId": "cube_crystal_sword"
                }
              }
            }
          ]
        },
        {
          "id": "dark_sword_aura",
          "name": "พลังดาบแกนดำ",
          "trigger": "continuous",
          "speed": 1,
          "do": [
            {
              "op": "modifyStat",
              "target": {
                "side": "self",
                "zone": "monster",
                "filter": {
                  "tag": "เหลี่ยม",
                  "levelMin": 3
                }
              },
              "stat": "atk",
              "val": 1800,
              "aura": true
            },
            {
              "op": "preventDestruction",
              "target": {
                "side": "self",
                "zone": "monster",
                "filter": {
                  "tag": "เหลี่ยม",
                  "levelMin": 3
                }
              },
              "cause": "effect"
            }
          ]
        }
      ]
    },
    {
      "id": "cube_bow",
      "name": "ธนูลูกบาศก์",
      "type": "spell",
      "group": "continuous",
      "mana": "1",
      "count": 2,
      "field": false,
      "proposed_level": false,
      "tags": [
        "เหลี่ยม",
        "equip",
        "bow"
      ],
      "text": "[ต่อเนื่อง]: ยูนิต \"เหลี่ยม\" ของเราทุกตัว +500 ATK\n[เมื่อประกาศโจมตี]: ยูนิต \"เหลี่ยม\" ที่ประกาศโจมตีทำความเสียหาย FP ศัตรู 300",
      "effects": [
        {
          "id": "bow_aura",
          "name": "พลังธนู",
          "trigger": "continuous",
          "speed": 1,
          "do": [
            {
              "op": "modifyStat",
              "target": {
                "side": "self",
                "zone": "monster",
                "filter": {
                  "tag": "เหลี่ยม"
                }
              },
              "stat": "atk",
              "val": 500,
              "aura": true
            }
          ]
        },
        {
          "id": "bow_shot",
          "name": "ยิงธนูเจาะเกราะ",
          "trigger": "onAttackDeclared",
          "speed": 1,
          "do": [
            {
              "op": "damage",
              "target": "opp",
              "val": 300
            }
          ]
        }
      ]
    },
    {
      "id": "cube_crafting_table",
      "name": "แท่นประกอบ",
      "type": "spell",
      "group": "normal",
      "mana": "0",
      "count": 1,
      "field": false,
      "proposed_level": false,
      "tags": [
        "เหลี่ยม",
        "forge"
      ],
      "text": "[เมื่อใช้ (0 Arcana)]: เลือกทิ้ง Entity เวล 1 จากมือ 1 ใบเพื่อค้นหา 'ดาบกิ่งไม้' หรือทิ้ง 2 ใบเพื่อค้นหา 'ดาบก้อนหิน' ขึ้นมือ (ถ้ามีในมือไม่ถึง 2 ตัวจะเลือกได้แค่ทางเลือกที่ 1)",
      "effects": [
        {
          "id": "crafting_table_craft",
          "name": "ประกอบอาวุธ",
          "trigger": "onSummon",
          "speed": 1,
          "cost": {
            "mana": 0
          },
          "do": [
            {
              "op": "choice",
              "options": [
                {
                  "label": "ทิ้ง 1 ใบ ค้นหาดาบกิ่งไม้",
                  "do": [
                    {
                      "op": "discard",
                      "filter": {
                        "tag": "เหลี่ยม",
                        "levelMin": 1,
                        "levelMax": 1
                      },
                      "count": 1
                    },
                    {
                      "op": "search",
                      "from": "deck",
                      "filter": {
                        "cardId": "cube_wood_sword"
                      },
                      "to": "hand",
                      "count": 1,
                      "condition": {
                        "op": "previousOpSuccess"
                      }
                    }
                  ]
                },
                {
                  "label": "ทิ้ง 2 ใบ ค้นหาดาบก้อนหิน",
                  "condition": {
                    "op": "handCount",
                    "filter": {
                      "tag": "เหลี่ยม",
                      "levelMin": 1,
                      "levelMax": 1
                    },
                    "min": 2
                  },
                  "do": [
                    {
                      "op": "discard",
                      "filter": {
                        "tag": "เหลี่ยม",
                        "levelMin": 1,
                        "levelMax": 1
                      },
                      "count": 2
                    },
                    {
                      "op": "search",
                      "from": "deck",
                      "filter": {
                        "cardId": "cube_stone_sword"
                      },
                      "to": "hand",
                      "count": 1,
                      "condition": {
                        "op": "previousOpSuccess"
                      }
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "id": "cube_forge_station",
      "name": "แท่นหลอมอัป",
      "type": "spell",
      "group": "normal",
      "mana": "1",
      "count": 1,
      "field": false,
      "proposed_level": false,
      "tags": [
        "เหลี่ยม",
        "forge"
      ],
      "text": "ส่งอุปกรณ์สายดาบของเราบนสนาม 1 ใบลง Abyss แล้วถ้าสำเร็จ ค้นดาบ tier ถัดไปขึ้นมือ",
      "effects": [
        {
          "id": "forge_upgrade",
          "name": "หลอมอัปเกรดดาบ",
          "trigger": "onSummon",
          "speed": 1,
          "cost": {
            "mana": 1
          },
          "do": [
            {
              "op": "sendToGrave",
              "target": {
                "side": "self",
                "zone": "spell",
                "filter": {
                  "tag": "sword"
                },
                "count": 1,
                "choose": "player"
              }
            },
            {
              "op": "search",
              "from": "deck",
              "filter": {
                "tag": "sword"
              },
              "to": "hand",
              "count": 1,
              "condition": {
                "op": "previousOpSuccess"
              }
            }
          ]
        }
      ]
    },
    {
      "id": "cube_crystal_mine",
      "name": "เหมืองผลึก",
      "type": "spell",
      "group": "field",
      "field": true,
      "mana": "1",
      "count": 2,
      "proposed_level": false,
      "tags": [
        "เหลี่ยม",
        "field"
      ],
      "text": "[ผู้เฝ้าดู]: เมื่อการ์ดอุปกรณ์ของเราถูกส่งลง Abyss (เทิร์นละ 2 ครั้ง) ได้รับ +1 Arcana",
      "effects": [
        {
          "id": "mine_mana_gain",
          "name": "เก็บผลึกมานา",
          "trigger": "onSentToGrave",
          "speed": 1,
          "watch": {
            "zone": "field",
            "side": "self",
            "filter": {
              "tag": "equip"
            }
          },
          "limit": {
            "per": "turn",
            "key": "mine_mana_gain",
            "count": 2
          },
          "do": [
            {
              "op": "addMana",
              "val": 1
            }
          ]
        }
      ]
    },
    {
      "id": "cube_shield_block",
      "name": "โล่บล็อก",
      "type": "spell",
      "group": "counter",
      "mana": "2",
      "count": 2,
      "field": false,
      "proposed_level": false,
      "tags": [
        "เหลี่ยม",
        "shield"
      ],
      "text": "สั่งใช้จากมือ เมื่อยูนิตของเราตกเป็นเป้าโจมตี ยกเลิกการโจมตีนั้น 1 ครั้ง",
      "effects": [
        {
          "id": "shield_block_negate",
          "name": "ยกเลิกการโจมตี",
          "trigger": "quick",
          "speed": 3,
          "timingWindow": [
            "attackDeclared"
          ],
          "cost": {
            "mana": 2
          },
          "do": [
            {
              "op": "negateAttack"
            }
          ]
        }
      ]
    },
    {
      "id": "cube_recycle_forge",
      "name": "ซากหลอมใหม่",
      "type": "spell",
      "group": "normal",
      "mana": "1",
      "count": 1,
      "field": false,
      "proposed_level": false,
      "tags": [
        "เหลี่ยม",
        "recycle"
      ],
      "text": "เลือก 1 จาก 2 (choice): (1) คืนอุปกรณ์จาก Abyss 1 ใบขึ้นมือ (2) อัญเชิญพิเศษ Entity เวล 1 จาก Abyss 1 ตัว",
      "effects": [
        {
          "id": "recycle_choice",
          "name": "กู้ซาก",
          "trigger": "onSummon",
          "speed": 1,
          "cost": {
            "mana": 1
          },
          "do": [
            {
              "op": "choice",
              "options": [
                {
                  "label": "คืนอุปกรณ์จาก Abyss 1 ใบ",
                  "do": [
                    {
                      "op": "returnToHand",
                      "from": "grave",
                      "filter": {
                        "tag": "equip"
                      },
                      "count": 1
                    }
                  ]
                },
                {
                  "label": "ชุบ Entity เวล 1 จาก Abyss",
                  "do": [
                    {
                      "op": "specialSummon",
                      "from": "grave",
                      "filter": {
                        "tag": "เหลี่ยม",
                        "levelMin": 1,
                        "levelMax": 1
                      },
                      "count": 1,
                      "to": "field"
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "id": "cube_map",
      "name": "แผนที่เหลี่ยม",
      "type": "spell",
      "group": "normal",
      "mana": "1",
      "count": 1,
      "field": false,
      "proposed_level": false,
      "tags": [
        "เหลี่ยม",
        "map"
      ],
      "text": "เลือก 1 จาก 2 (choice): (1) ค้น Entity \"เหลี่ยม\" เวล 1 หรือ 2 ขึ้นมือ (2) ทิ้งการ์ด 1 ใบจากมือลง Abyss แล้วค้น Entity \"เหลี่ยม\" เวล 1 2 ใบขึ้นมือ",
      "effects": [
        {
          "id": "map_search",
          "name": "แผนที่นำทาง",
          "trigger": "onSummon",
          "speed": 1,
          "cost": {
            "mana": 1
          },
          "do": [
            {
              "op": "choice",
              "options": [
                {
                  "label": "ค้น Entity เวล 1 หรือ 2 (1 ใบ)",
                  "do": [
                    {
                      "op": "search",
                      "from": "deck",
                      "filter": {
                        "tag": "เหลี่ยม",
                        "levelMin": 1,
                        "levelMax": 2
                      },
                      "to": "hand",
                      "count": 1
                    }
                  ]
                },
                {
                  "label": "ทิ้ง 1 ใบ ค้น Entity เวล 1 (2 ใบ)",
                  "do": [
                    {
                      "op": "discard",
                      "count": 1
                    },
                    {
                      "op": "search",
                      "from": "deck",
                      "filter": {
                        "tag": "เหลี่ยม",
                        "levelMin": 1,
                        "levelMax": 1
                      },
                      "to": "hand",
                      "count": 2,
                      "condition": {
                        "op": "previousOpSuccess"
                      }
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "id": "cube_scrap_storage",
      "name": "คลังทิ้งเหลี่ยม",
      "type": "spell",
      "group": "normal",
      "mana": "1",
      "count": 1,
      "field": false,
      "proposed_level": false,
      "tags": [
        "เหลี่ยม",
        "storage"
      ],
      "text": "ทิ้งการ์ด 1 ใบจากมือลง Abyss แล้วถ้าสำเร็จ เลือก 1 จาก 2: ค้นดาบ tier กิ่งไม้หรือก้อนหิน 1 ใบ หรือ Entity \"เหลี่ยม\" เวล 1 1 ใบขึ้นมือ",
      "effects": [
        {
          "id": "storage_recycle",
          "name": "แลกเปลี่ยนชิ้นส่วน",
          "trigger": "onSummon",
          "speed": 1,
          "cost": {
            "mana": 1
          },
          "do": [
            {
              "op": "discard",
              "count": 1
            },
            {
              "op": "choice",
              "condition": {
                "op": "previousOpSuccess"
              },
              "options": [
                {
                  "label": "ค้นดาบ tier กิ่งไม้/ก้อนหิน",
                  "do": [
                    {
                      "op": "search",
                      "from": "deck",
                      "filter": {
                        "tag": "sword",
                        "levelMax": 1
                      },
                      "to": "hand",
                      "count": 1
                    }
                  ]
                },
                {
                  "label": "ค้น Entity เวล 1",
                  "do": [
                    {
                      "op": "search",
                      "from": "deck",
                      "filter": {
                        "tag": "เหลี่ยม",
                        "levelMin": 1,
                        "levelMax": 1
                      },
                      "to": "hand",
                      "count": 1
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "id": "cube_the_end",
      "name": "ปลายทางเหลี่ยม (The End)",
      "type": "spell",
      "group": "field",
      "field": true,
      "mana": "1",
      "count": 2,
      "proposed_level": false,
      "tags": [
        "เหลี่ยม",
        "field"
      ],
      "text": "[เมื่อใช้]: ส่ง 3 ใบบน Chronicle ลง Abyss แล้วค้น Entity \"เหลี่ยม\" เวล 1 1 ใบขึ้นมือ\n[กดใช้ (1 Arcana)]: รันเอฟเฟกต์ดรอปของ Entity ใน Abyss ทันที\n[ต่อเนื่อง]: Apex ได้ +300 ATK",
      "effects": [
        {
          "id": "the_end_open",
          "name": "เปิดมิติปลายทาง",
          "trigger": "onSummon",
          "speed": 1,
          "cost": {
            "mana": 1
          },
          "limit": {
            "per": "turn",
            "key": "the_end_open",
            "count": 1
          },
          "do": [
            {
              "op": "sendToGrave",
              "from": "deckTop",
              "count": 3
            },
            {
              "op": "search",
              "from": "deck",
              "filter": {
                "tag": "เหลี่ยม",
                "levelMin": 1,
                "levelMax": 1
              },
              "to": "hand",
              "count": 1,
              "condition": {
                "op": "previousOpSuccess"
              }
            }
          ]
        },
        {
          "id": "the_end_fire_drop",
          "name": "กระตุ้นพลังดรอป",
          "trigger": "ignition",
          "speed": 1,
          "cost": {
            "mana": 1
          },
          "limit": {
            "per": "turn",
            "key": "the_end_fire_drop",
            "count": 1
          },
          "do": [
            {
              "op": "fireEffect",
              "from": "grave",
              "filter": {
                "tag": "เหลี่ยม"
              },
              "count": 1
            }
          ]
        },
        {
          "id": "the_end_apex_buff",
          "name": "พลังแห่งปลายทาง",
          "trigger": "continuous",
          "speed": 1,
          "do": [
            {
              "op": "modifyStat",
              "target": {
                "side": "self",
                "zone": "monster",
                "filter": {
                  "tag": "apex"
                }
              },
              "stat": "atk",
              "val": 300,
              "aura": true
            }
          ]
        }
      ]
    }
  ],
  "extra": [
    {
      "id": "cube_kobo_conqueror",
      "name": "เหลี่ยม คูโบ ผู้พิชิต",
      "type": "grade4",
      "level": 3,
      "atk": 2900,
      "def": 2400,
      "mana": "0",
      "count": 1,
      "leader": false,
      "proposed_level": false,
      "tags": [
        "เหลี่ยม",
        "apex"
      ],
      "extraSummon": {
        "type": "overlay",
        "materials": "ส่งอุปกรณ์สายดาบ 1 ใบลง Abyss และวางทับ 'เหลี่ยม คูโบ' 1 ตัว"
      },
      "text": "[เงื่อนไข Apex]: ส่งอุปกรณ์สายดาบ 1 ใบลง Abyss และวางทับ 'เหลี่ยม คูโบ' 1 ตัว (กลายเป็น Core)\n[ต่อเนื่อง]: ATK +300 ต่ออุปกรณ์ในสนาม และ +200 ต่ออุปกรณ์ใน Abyss (สูงสุด 3 ใบ)",
      "effects": [
        {
          "id": "kobo_conqueror_aura",
          "name": "พลังแห่งผู้พิชิต",
          "trigger": "continuous",
          "speed": 1,
          "do": [
            {
              "op": "modifyStat",
              "target": "self",
              "stat": "atk",
              "val": 300,
              "multiplier": {
                "from": "fieldSpells",
                "filter": {
                  "tag": "equip"
                },
                "max": 3
              },
              "aura": true
            },
            {
              "op": "modifyStat",
              "target": "self",
              "stat": "atk",
              "val": 200,
              "multiplier": {
                "from": "grave",
                "filter": {
                  "tag": "equip"
                },
                "max": 3
              },
              "aura": true
            }
          ]
        }
      ]
    },
    {
      "id": "cube_bella_conqueror",
      "name": "เหลี่ยม เบลลา ผู้พิชิต",
      "type": "grade4",
      "level": 3,
      "atk": 2700,
      "def": 2200,
      "mana": "0",
      "count": 1,
      "leader": false,
      "proposed_level": false,
      "tags": [
        "เหลี่ยม",
        "apex"
      ],
      "extraSummon": {
        "type": "overlay",
        "materials": "ทิ้ง Entity เวล 1 ลง Abyss 1 ใบ และวางทับ 'เหลี่ยม เบลลา' หรือ 'เหลี่ยม คูโบ' 1 ตัว"
      },
      "text": "[เงื่อนไข Apex]: ทิ้ง Entity เวล 1 ลง Abyss 1 ใบ และวางทับ 'เหลี่ยม เบลลา' หรือ 'เหลี่ยม คูโบ' 1 ตัว\n[เมื่ออัญเชิญสำเร็จ]: นำอุปกรณ์จาก Abyss 2 ใบขึ้นมือ\n[กดใช้ (1 Arcana)]: เทิร์นละ 1 ครั้ง โจมตีเพิ่มได้ 1 ครั้ง",
      "effects": [
        {
          "id": "bella_conqueror_salvage",
          "name": "เก็บกู้อุปกรณ์",
          "trigger": "onSummon",
          "speed": 1,
          "cost": {
            "mana": 0
          },
          "do": [
            {
              "op": "returnToHand",
              "from": "grave",
              "filter": {
                "tag": "equip"
              },
              "count": 2
            }
          ]
        },
        {
          "id": "bella_conqueror_extra_atk",
          "name": "จู่โจมซ้ำ",
          "trigger": "ignition",
          "speed": 1,
          "cost": {
            "mana": 1
          },
          "limit": {
            "per": "turn",
            "key": "bella_extra_atk",
            "count": 1
          },
          "do": [
            {
              "op": "extraAttack",
              "target": "self",
              "count": 1
            }
          ]
        }
      ]
    },
    {
      "id": "cube_king",
      "name": "ราชาเหลี่ยม",
      "type": "grade4",
      "level": 3,
      "atk": 3300,
      "def": 2700,
      "mana": "0",
      "count": 1,
      "leader": false,
      "proposed_level": false,
      "tags": [
        "เหลี่ยม",
        "apex"
      ],
      "extraSummon": {
        "type": "overlay",
        "materials": "ส่ง 'ดาบแกนดำ' ลง Abyss และวางทับ 'เหลี่ยมเงาสูง' หรือ 'เหลี่ยม คูโบ นักผจญภัย' 1 ตัว"
      },
      "text": "[เงื่อนไข Apex]: ส่ง 'ดาบแกนดำ' ลง Abyss และวางทับ 'เหลี่ยมเงาสูง' หรือ 'เหลี่ยม คูโบ นักผจญภัย' 1 ตัว\n[ต่อเนื่อง]: ไม่ถูกทำลายจากเอฟเฟกต์\n[เมื่ออัญเชิญสำเร็จ]: จ่าย 2 Arcana ทำลายยูนิตศัตรู 2 ตัว",
      "effects": [
        {
          "id": "cube_king_protection",
          "name": "เกราะราชัน",
          "trigger": "continuous",
          "speed": 1,
          "do": [
            {
              "op": "preventDestruction",
              "target": "self",
              "cause": "effect"
            }
          ]
        },
        {
          "id": "cube_king_destroy",
          "name": "พลังแห่งราชันย์",
          "trigger": "onSummon",
          "speed": 1,
          "cost": {
            "mana": 2
          },
          "do": [
            {
              "op": "destroy",
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
    }
  ]
};
})();
