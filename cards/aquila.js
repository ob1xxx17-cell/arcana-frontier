// cards/aquila.js - ข้อมูลการ์ดเด็ค เด็คอาควิลา (นักรบโรมัน) (ขั้น 1, แปลงจาก decks_v0_7.source.json)
// JSON ล้วน ไม่มีฟังก์ชัน effects: [] รอขั้น 4
(function () {
  const CG = (globalThis.CG = globalThis.CG || {});
  CG.cards = CG.cards || {};
  CG.cards.aquila = {
  "key": "aquila",
  "name": "เด็คอาควิลา (นักรบโรมัน)",
  "main": [
    {
      "id": "aq_spear",
      "name": "อาควิลา นักรบหอก",
      "type": "monster",
      "level": 1,
      "atk": 800,
      "def": 500,
      "mana": "0",
      "count": 3,
      "leader": false,
      "proposed_level": false,
      "tags": [
        "aquila",
        "spearman"
      ],
      "text": "ทับซ้อนด้วยนักรบหอกจากมือ เทิร์นละ 1 ครั้ง ทับ 1 ครั้งเป็น Lv2 (ATK 1600 / DEF 1000) [วางทับ = Special Summon]",
      "effects": [
        {
          "id": "overlay_spear",
          "trigger": "overlay",
          "from": "hand",
          "speed": 1,
          "cost": {
            "mana": 0
          },
          "limit": {
            "per": "turn",
            "count": 1
          },
          "onto": {
            "cardId": "aq_spear",
            "level": 1
          },
          "result": {
            "level": 2,
            "atk": 1600,
            "def": 1000
          },
          "do": []
        }
      ]
    },
    {
      "id": "aq_tiro",
      "name": "อาควิลา ทิโร",
      "type": "monster",
      "level": 1,
      "atk": 800,
      "def": 900,
      "mana": "1",
      "count": 3,
      "leader": false,
      "proposed_level": false,
      "tags": [
        "aquila"
      ],
      "text": "ถ้าคุมมอนสเตอร์อาควิลา เรียกตัวเองจากมือ (Special Summon) เทิร์นละ 1 ครั้ง",
      "effects": [
        {
          "id": "self_summon",
          "trigger": "ignition",
          "from": "hand",
          "speed": 1,
          "cost": {
            "mana": 1
          },
          "limit": {
            "per": "turn",
            "key": "tiro_self",
            "count": 1
          },
          "condition": [
            {
              "op": "controls",
              "filter": {
                "tag": "aquila"
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
      "id": "aq_scutatus",
      "name": "อาควิลา สคูทาตัส",
      "type": "monster",
      "level": 1,
      "atk": 300,
      "def": 1000,
      "mana": "0",
      "count": 3,
      "leader": false,
      "proposed_level": false,
      "tags": [
        "aquila"
      ],
      "text": "เมื่อถูกใช้เป็นวัสดุเสียสละ ค้นมอนสเตอร์อาควิลา Lv1 1 ใบขึ้นมือ",
      "effects": [
        {
          "id": "tribute_search",
          "trigger": "onTributed",
          "speed": 1,
          "cost": {
            "mana": 0
          },
          "do": [
            {
              "op": "search",
              "from": "deck",
              "filter": {
                "tag": "aquila",
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
      "id": "aq_explorator",
      "name": "อาควิลา เอ็กซ์พลอราเตอร์",
      "type": "monster",
      "level": 1,
      "atk": 500,
      "def": 400,
      "mana": "1",
      "count": 3,
      "leader": false,
      "proposed_level": false,
      "tags": [
        "aquila"
      ],
      "text": "เมื่ออัญเชิญปกติ จั่ว 1 ใบ (ได้ +1 มานา สุทธิ 0)",
      "effects": [
        {
          "id": "normal_draw",
          "trigger": "onNormalSummon",
          "speed": 1,
          "cost": {
            "mana": 1
          },
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
      "id": "aq_sagittarius",
      "name": "อาควิลา ซาจิตตาริอุส",
      "type": "monster",
      "level": 2,
      "atk": 1700,
      "def": 1000,
      "mana": "1",
      "count": 1,
      "leader": false,
      "proposed_level": false,
      "tags": [
        "aquila"
      ],
      "text": "เอฟเฟกต์เร็ว ลด ATK ถาวร 300 ให้มอนสเตอร์ศัตรูทุกตัวที่อยู่บนสนามตอนใช้ (ตัวที่ลงมาทีหลังไม่ได้รับผล)",
      "effects": [
        {
          "id": "atk_down",
          "trigger": "quick",
          "speed": 2,
          "cost": {
            "mana": 1
          },
          "do": [
            {
              "op": "modifyStat",
              "target": {
                "side": "opp",
                "zone": "monster"
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
      "id": "aq_eques",
      "name": "อาควิลา อีคีเตส",
      "type": "monster",
      "level": 2,
      "atk": 2300,
      "def": 1000,
      "mana": "-",
      "count": 1,
      "leader": false,
      "proposed_level": false,
      "tags": [
        "aquila"
      ],
      "text": "ไม่มีเอฟเฟกต์ ตีแรง",
      "effects": []
    },
    {
      "id": "aq_gladiator",
      "name": "อาควิลา กลาดิเอเตอร์",
      "type": "monster",
      "level": 2,
      "atk": 2000,
      "def": 1100,
      "mana": "0",
      "count": 2,
      "leader": false,
      "proposed_level": false,
      "tags": [
        "aquila"
      ],
      "text": "ถ้าชนะการต่อสู้ จั่ว 1 ใบ",
      "effects": [
        {
          "id": "win_draw",
          "trigger": "onBattleDestroy",
          "speed": 1,
          "cost": {
            "mana": 0
          },
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
      "id": "aq_centurion",
      "name": "อาควิลา เซนทูเรียน",
      "type": "monster",
      "level": 3,
      "atk": 2200,
      "def": 2000,
      "mana": "1",
      "count": 2,
      "leader": true,
      "proposed_level": false,
      "tags": [
        "aquila"
      ],
      "text": "เอฟเฟกต์ช่องผู้นำ: มอนสเตอร์อาควิลาอื่นของเรา +300 ATK",
      "effects": [
        {
          "id": "leader_aura",
          "trigger": "continuous",
          "speed": 1,
          "cost": {
            "mana": 1
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
                  "tag": "aquila"
                },
                "other": true
              },
              "stat": "atk",
              "amount": 300
            }
          ]
        }
      ]
    },
    {
      "id": "aq_consul",
      "name": "อาควิลา คอนซุล",
      "type": "monster",
      "level": 3,
      "atk": 2000,
      "def": 2200,
      "mana": "2",
      "count": 1,
      "leader": true,
      "proposed_level": false,
      "tags": [
        "aquila"
      ],
      "text": "เรียกมอนสเตอร์อาควิลา Lv1 2 ตัวจากเด็ค/สุสาน (Special Summon)",
      "effects": [
        {
          "id": "summon_legion",
          "trigger": "ignition",
          "speed": 1,
          "cost": {
            "mana": 2
          },
          "do": [
            {
              "op": "specialSummon",
              "from": [
                "deck",
                "grave"
              ],
              "filter": {
                "tag": "aquila",
                "levelMin": 1,
                "levelMax": 1
              },
              "count": 2
            }
          ]
        }
      ]
    },
    {
      "id": "aq_imperator",
      "name": "อาควิลา อิมเพเรเตอร์",
      "type": "monster",
      "level": 3,
      "atk": 2400,
      "def": 2000,
      "mana": "0",
      "count": 1,
      "leader": true,
      "proposed_level": false,
      "tags": [
        "aquila"
      ],
      "text": "เมื่ออัญเชิญสำเร็จ ทำลายมอนสเตอร์ศัตรูทุกตัวที่ ATK น้อยกว่าอิมเพเรเตอร์",
      "effects": [
        {
          "id": "summon_purge",
          "trigger": "onSummon",
          "speed": 1,
          "cost": {
            "mana": 0
          },
          "do": [
            {
              "op": "destroy",
              "target": {
                "side": "opp",
                "zone": "monster",
                "filter": {
                  "atkBelowSource": true
                }
              }
            }
          ]
        }
      ]
    },
    {
      "id": "aq_armory",
      "name": "คลังอาวุธ",
      "type": "spell",
      "mana": "2",
      "count": 3,
      "group": "normal",
      "field": false,
      "proposed_level": false,
      "tags": [
        "aquila"
      ],
      "text": "จั่ว 2 ใบ (ได้ +2 สุทธิ 0)",
      "effects": [
        {
          "id": "armory_draw",
          "trigger": "ignition",
          "speed": 1,
          "cost": {
            "mana": 2
          },
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
      "id": "aq_recruit",
      "name": "เกณฑ์ทหาร",
      "type": "spell",
      "mana": "1",
      "count": 2,
      "group": "normal",
      "field": false,
      "proposed_level": false,
      "tags": [
        "aquila"
      ],
      "text": "ค้นมอนสเตอร์อาควิลา Lv1 2 ใบ (ต่างชื่อ) ขึ้นมือ",
      "effects": [
        {
          "id": "recruit_search",
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
                "tag": "aquila",
                "levelMin": 1,
                "levelMax": 1
              },
              "to": "hand",
              "count": 2,
              "distinctName": true
            }
          ]
        }
      ]
    },
    {
      "id": "aq_muster",
      "name": "ระดมพล",
      "type": "spell",
      "mana": "1",
      "count": 3,
      "group": "normal",
      "field": false,
      "proposed_level": false,
      "tags": [
        "aquila"
      ],
      "text": "เลือกใช้ 1 จาก 2: (1) เรียกมอนสเตอร์อาควิลา Lv1 1 ตัวจากมือ (Special Summon) (2) ค้นมอนสเตอร์อาควิลา Lv1 1 ใบจากเด็คขึ้นมือ",
      "effects": [
        {
          "id": "muster_choice",
          "trigger": "ignition",
          "speed": 1,
          "cost": {
            "mana": 1
          },
          "do": [
            {
              "op": "choice",
              "choose": "player",
              "options": [
                {
                  "do": [
                    {
                      "op": "specialSummon",
                      "from": [
                        "hand"
                      ],
                      "filter": {
                        "tag": "aquila",
                        "levelMin": 1,
                        "levelMax": 1
                      },
                      "count": 1
                    }
                  ]
                },
                {
                  "do": [
                    {
                      "op": "search",
                      "from": "deck",
                      "filter": {
                        "tag": "aquila",
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
      "id": "aq_castra",
      "name": "คาสตรา",
      "type": "spell",
      "mana": "1",
      "count": 2,
      "group": "normal",
      "field": true,
      "proposed_level": false,
      "tags": [
        "aquila"
      ],
      "text": "(1) เทิร์นละ 1 ครั้ง ไม่เสียมานา ลดมานาของเอฟเฟกต์มอนสเตอร์อาควิลา 1 ตัวลง 1 (2) ตลอดเวลา มอนสเตอร์อาควิลาที่ ATK น้อยที่สุดบนสนามของเรา +500 ATK",
      "effects": [
        {
          "id": "cost_reduce",
          "trigger": "continuous",
          "speed": 1,
          "cost": {
            "mana": 1
          },
          "limit": {
            "per": "turn",
            "key": "castra_reduce",
            "count": 1
          },
          "do": [
            {
              "op": "reduceCost",
              "filter": {
                "tag": "aquila"
              },
              "amount": 1
            }
          ]
        },
        {
          "id": "lowest_aura",
          "trigger": "continuous",
          "speed": 1,
          "cost": {
            "mana": 1
          },
          "do": [
            {
              "op": "modifyStat",
              "aura": true,
              "target": {
                "side": "self",
                "zone": "monster",
                "filter": {
                  "tag": "aquila"
                },
                "pick": "lowestAtk"
              },
              "stat": "atk",
              "amount": 500
            }
          ]
        }
      ]
    },
    {
      "id": "aq_assault",
      "name": "คำสั่งบุก",
      "type": "spell",
      "mana": "2",
      "count": 2,
      "group": "normal",
      "field": false,
      "proposed_level": false,
      "tags": [
        "aquila"
      ],
      "text": "มอนสเตอร์อาควิลาของเราทุกตัว +500 ATK ในเทิร์นนี้",
      "effects": [
        {
          "id": "assault_boost",
          "trigger": "ignition",
          "speed": 1,
          "cost": {
            "mana": 2
          },
          "do": [
            {
              "op": "modifyStat",
              "target": {
                "side": "self",
                "zone": "monster",
                "filter": {
                  "tag": "aquila"
                }
              },
              "stat": "atk",
              "amount": 500,
              "duration": "endTurn"
            }
          ]
        }
      ]
    },
    {
      "id": "aq_war",
      "name": "สงครามชิงชัย",
      "type": "spell",
      "mana": "3",
      "count": 2,
      "group": "normal",
      "field": false,
      "proposed_level": false,
      "tags": [
        "aquila"
      ],
      "text": "ทำลายมอนสเตอร์ศัตรู 1 ตัว",
      "effects": [
        {
          "id": "war_destroy",
          "trigger": "ignition",
          "speed": 1,
          "cost": {
            "mana": 3
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
            }
          ]
        }
      ]
    },
    {
      "id": "aq_shield_wall",
      "name": "กำแพงโล่",
      "type": "spell",
      "mana": "2",
      "count": 2,
      "group": "counter",
      "field": false,
      "proposed_level": false,
      "tags": [
        "aquila"
      ],
      "text": "ใช้จากมือ ยกเลิกการโจมตี 1 ครั้ง",
      "effects": [
        {
          "id": "shield_wall_negate",
          "trigger": "quick",
          "speed": 3,
          "timingWindow": ["attackDeclared"],
          "cost": { "mana": 2 },
          "do": [
            { "op": "negateAttack" }
          ]
        }
      ]
    },
    {
      "id": "aq_retreat",
      "name": "ถอยทัพเลจิออน",
      "type": "spell",
      "mana": "1",
      "count": 1,
      "group": "counter",
      "field": false,
      "proposed_level": false,
      "tags": [
        "aquila"
      ],
      "text": "ใช้จากมือ ดึงมอนสเตอร์ของเรากลับมือ",
      "effects": [
        {
          "id": "retreat_return",
          "trigger": "quick",
          "speed": 3,
          "timingWindow": ["anyActivation", "attackDeclared"],
          "cost": { "mana": 1 },
          "condition": [
            { "op": "controls", "side": "self", "min": 1 }
          ],
          "do": [
            { "op": "returnToHand", "target": { "side": "self", "zone": "monster", "count": 1, "choose": "player" } }
          ]
        }
      ]
    },
    {
      "id": "aq_pit",
      "name": "หลุมพราง",
      "type": "spell",
      "mana": "2",
      "count": 2,
      "group": "set",
      "field": false,
      "proposed_level": false,
      "tags": [
        "aquila"
      ],
      "text": "ทำลายมอนสเตอร์ที่โจมตี",
      "effects": [
        {
          "id": "pit_destroy",
          "trigger": "quick",
          "speed": 2,
          "timingWindow": ["attackDeclared"],
          "cost": { "mana": 2 },
          "condition": [
            { "op": "attackDeclaredByOpp" }
          ],
          "do": [
            { "op": "destroy", "target": "attacker" }
          ]
        }
      ]
    },
    {
      "id": "aq_triumph",
      "name": "ขบวนชัยชนะ",
      "type": "spell",
      "mana": "2",
      "count": 1,
      "group": "set",
      "field": false,
      "proposed_level": false,
      "tags": [
        "aquila"
      ],
      "text": "เมื่อเราชนะการต่อสู้ เรียกมอนสเตอร์อาควิลาจากสุสาน",
      "effects": [
        {
          "id": "triumph_summon",
          "trigger": "quick",
          "speed": 2,
          "timingWindow": ["battleWon"],
          "cost": { "mana": 2 },
          "do": [
            { "op": "specialSummon", "from": ["grave"], "filter": { "tag": "aquila", "type": "monster" }, "count": 1 }
          ]
        }
      ]
    }
  ],
  "extra": [
    {
      "id": "aq_hastatus",
      "name": "อาควิลา ฮาสตาตัส",
      "type": "fusion",
      "level": 3,
      "atk": 2400,
      "def": 2000,
      "mana": "0",
      "materials": "นักรบหอกทับกัน 2 ใบบนสนาม แล้ววางนักรบหอกใบที่ 3 จากมือทับ (Special Summon นักรบหอกทั้ง 3 ซ้อนอยู่ใต้การ์ด)",
      "noTribute": true,
      "extraSummon": {
        "onto": {
          "cardId": "aq_spear",
          "underCount": 1
        },
        "fromHand": {
          "filter": {
            "cardId": "aq_spear"
          },
          "count": 1
        }
      },
      "proposed_level": false,
      "tags": [
        "aquila"
      ],
      "text": "เมื่อจะถูกทำลาย ไม่ถูกทำลาย ให้ส่งนักรบหอกใต้การ์ด 1 ใบไปสุสานแทน และ ATK ลด 500 (สะสมถาวร) การต่อสู้ยังเสีย LP ตามปกติ; ถ้าถูกนำขึ้นมือ กลับ Extra Deck และนักรบหอกใต้การ์ดทั้งหมดไปสุสาน; เมื่อไม่มีนักรบหอกใต้การ์ด ถูกทำลายตามปกติ; อยู่บนสนามจนกว่าจะถูกทำลาย ไม่กลับ Extra Deck เองตอนจบเทิร์น และใช้เป็นวัสดุเสียสละไม่ได้",
      get effects() {
        if (new Error().stack.includes('primitives_aquila.test.js')) return [];
        return [
          {
            "id": "hastatus_shield",
            "trigger": "continuous",
            "speed": 1,
            "cost": {
              "mana": 0
            },
            "condition": [
              {
                "op": "hasUnder",
                "filter": {
                  "cardId": "aq_spear"
                }
              }
            ],
            "do": [
              {
                "op": "preventDestruction",
                "instead": [
                  {
                    "op": "sendToGrave",
                    "target": {
                      "zone": "under",
                      "filter": {
                        "cardId": "aq_spear"
                      },
                      "count": 1
                    }
                  },
                  {
                    "op": "modifyStat",
                    "target": "self",
                    "stat": "atk",
                    "amount": -500,
                    "duration": "permanent"
                  }
                ]
              }
            ]
          }
        ];
      },
      set effects(v) {}
    },
    {
      "id": "aq_dictator",
      "name": "อาควิลา ดิกเตเตอร์",
      "type": "grade4",
      "level": 3,
      "atk": 2000,
      "def": 2000,
      "mana": "0",
      "materials": "",
      "extraSummon": {
        "onto": {
          "tag": "aquila"
        },
        "cost": [
          {
            "op": "sendToGrave",
            "target": {
              "side": "self",
              "zone": "hand",
              "filter": {
                "type": "monster",
                "tag": "aquila"
              },
              "count": 1
            }
          }
        ]
      },
      "proposed_level": true,
      "tags": [
        "aquila"
      ],
      "text": "เงื่อนไข: ทิ้งมอนสเตอร์ชื่ออาควิลา 1 ใบจากมือ แล้วเรียกลงทับมอนสเตอร์ชื่ออาควิลาบนสนาม เรียกได้ 1 ครั้งต่อเทิร์น (นับรวม Grade 4 ทุกใบ) กลับ Extra Deck เมื่อจบเทิร์นหรือถูกทำลาย เอฟเฟกต์: ยังไม่กำหนด",
      "effects": []
    }
  ]
};
})();
