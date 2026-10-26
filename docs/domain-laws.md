# Domain Laws — rule-based domains

Domains used to be a sure-hit field with spell branches inside. They can now hold **laws**: standing rules read as a sentence, in the way a JJK domain works (a trial, a copy, a sentence handed down).

- **Law rune** (`magic-domain.js`): place it directly under a Domain Expansion. *Who* (every foe / you / everyone) · *When* · *Then*.
- **Opening** (`cinematic`): gather ~1 s → everything freezes ~0.9 s (game time stops) → bursts out in 0.38 s. Quick and None are shorter. Online (PvP, co-op) there is no freeze.
- **Looks** (`magic-domain-art.js`): 10 themes, accent colour, 10 patterns, motes, interior air, 4 bursts, a title. Sealed domains hide their inside from anyone outside.
- **Conditions** are grouped in the connector's "Wait until" panel.
- **Authentic Mutual Love** (Yuta): 💞 Mutual Love button in the inventory, next to Mirror War. `node tools/yuta-domain.js --write` rebuilds `yuta-spell.js`.

## When (events)

always · every N s · domain opens · they step in · they try to leave · they cast · they attack · they move fast · they stand still · they jump · they take a blow (of at least N) · their health is low · they carry N marks.

## Then (effects)

damage · burn · execute below N% · drain energy into the domain · stun · slow · bind · pull toward the centre · seal casting / techniques · negate their energy · mark · clear marks · expose (blows hurt more) · heal · copy the spell they cast · cast a copy · run the runes below the law.

## Cost and budget

Each law has a weight; the total must fit `10 + 1.8 × Control` (×1.35 with a Declared vow, ×1.25 shared, ×1.15 brief or narrow). Every application takes a little of the zone's energy; a thin domain does less. Per-foe cooldowns and limits apply to every law.

## Recipes

| Domain | Laws |
| --- | --- |
| Trial | foe · attacks · mark (OFFENCE) → foe · carries 3 marks · damage 250 (GUILTY), marks spent |
| Copy (Yuta) | foe · attacks · copy (4 kept) → foe · every 1.2 s · cast a copy → you · always · heal 5 |
| Silence | foe · always · seal casting → foe · every 2 s · drain |
| Cleave | foe · health low (30%) · execute → foe · moves fast · slow |

## Limits

Seals only affect rune casters. Domains cannot be copied. Copies are cast at most 3 at a time, scaled by what the zone holds. Boss and rival-mage domains use Opening: None, so they look and behave as before.

## Tests

`node tools/domain-tests.js` (61 checks) and `node tools/engine-checks.js magic-domain.js magic-domain-art.js` (194; one failure predates this work).
