# Domain looks and the Domain Designer

Every domain is exactly **1400 px** in radius (2800 px across), whatever zone it grew from; the Narrow vow still squeezes it to 840 px. A Domain Expansion paints a world of its own inside its barrier. It replaces the level behind every creature: a sky, a landmark on the horizon, and a floor that meets the real ground under the caster. Over the creatures go particles, the edge and the burst. From outside, a sealed domain shows a solid sphere instead.

## Where to find it

- **Rune Forge → Domain rune → Domain look → 🎨 Design the look**. The card also has 🎲 (a random look) and ↺ (forget the look and use the theme).
- Keys in the Designer:
  - R rolls every unlocked layer.
  - Space plays the opening.
  - Ctrl+Z and Ctrl+Y undo and redo.
  - Ctrl+S uses the look.
  - Esc cancels.

## Layers

| Tab | Settings |
| --- | --- |
| Colours | Primary, highlight, second colour and deep colour. You can also pick one of 18 palettes, or use the tools: hue ±30°, lighter, darker, swap, pale world. |
| World | Sky (15) · landmark (20: moon, sun, eclipse, ringed planet, great eye, halo, rift, clock, gate, temple, spires, throne, great tree, mountains, rising hands, scales, lotus, colonnade, sword ring, or nothing) · landmark size · horizon height. |
| Floor | Floor (16: water, mirror, tiles, flagstones, neon grid, flower field, field of swords, dunes, ice, lava, ash, sea of clouds, starry void, petal carpet, bone field, or the real ground) · sigil (18) · where the sigil sits (floor, around you, both, sky) · sigil size. |
| Air | Two particle layers. Each picks one of 18 kinds (embers, sparks, ash, smoke, snow, rain, petals, leaves, feathers, butterflies, fireflies, bubbles, stars, glyphs, shards, ink, lightning) and an amount. Drift speed applies to both. |
| Edge | Edge (11: glass orb, dome, thin ring, rune band, thorns, cage, flames, ribbons, facets, hex shell, soft edge) · width · glow · an extra rune band. |
| Light | Dark, dim, natural or bright · light rays · vignette · pulse · how much it replaces the level · animation speed. |
| Opening | Burst (12) · frozen-world tint (grey, old photograph, negative, tinted, darkness, untouched) · cinema bars · title font (7) · layout (centred, low, vertical, split) · title colour · subtitle. |
| Outside | Six looks: glowing shell, black sphere, mirror sphere, woven cocoon, hex shell, storm globe. |

The choices alone give about 3 × 10¹⁴ combinations, before colours and sliders.

## Ways to get a look you like

- **Presets** (25): start from a finished domain.
- **Ideas**: 10 random looks that still hold together. **Variations** keep your colours, sky and landmark and change the rest.
- **🔒 and 🎲** on every field. Lock what you like, then roll the rest.
- **Hover a choice** to preview it before clicking.
- **⇄ Code**: copy the look as a `DOM1:` code to keep or share, or paste one in to load it.

## For developers

- **Files.**
  - `magic-domain-look.js` holds the schema, presets, palettes, `resolve` / `sanitize` / `random` / `encode` / `decode`.
  - `magic-domain-art.js` is the painter.
  - `magic-domain-designer.js` is the window.
- **Storage.** The look is one object in the Domain rune's `look` param. Without it, the older theme / colour / pattern params decide the look, as before.
- **Host calls.**
  - `W.drawDomainBackdrop(ctx, camX, camY, t)` goes behind terrain and creatures. Set `W.hostDrawsDomainBackdrop = true`.
  - `W.drawDomainVeil(...)` goes after creatures.
  - `W.drawDomainCine(...)` is drawn in screen space.
  - `W.clipToDomains(ctx, camX, camY)` lets a host redraw its platforms inside a domain.
- **Painting without a world.** `MagicDomainArt.thumbnail(ctx, look, w, h, t, opts)`.
- **Tests.** `node tools/domain-tests.js` (72 checks).

## Limits

- Platforms in the open world, the city and other non-tile, non-arena modes are not redrawn inside a domain. Lower "Replaces the world" to see them better.
- Brush and blackletter title fonts depend on the fonts installed; they fall back to a serif.
