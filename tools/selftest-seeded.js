/* node tools/selftest-seeded.js [dir] [seed] — RuneMages.selfTest() with Math.random seeded, for the modules in [dir]
   (default: the game folder). Prints JSON {pass, total, failing}. Used by tools/arcanist-campaign.js to compare the
   rune mages' self-tests before and after a change under identical seeds (the self-tests are random otherwise). */
'use strict';
const path = require('path');
const dir = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const seed = +(process.argv[3] || 1);
globalThis.window = globalThis;      // melee-weapons.js and player-rig.js expect a browser window
let a = seed >>> 0 || 1;
Math.random = function(){ a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
for(const f of [ 'magic-engine.js', 'magic-techniques.js', 'melee-weapons.js', 'player-rig.js', 'rune-mages.js' ]){ try { require(path.join(dir, f)); } catch(e){ if(f === 'rune-mages.js' || f.startsWith('magic')) throw e; } }
const r = globalThis.RuneMages.selfTest({ seconds: 30 });
console.log(JSON.stringify({ seed, pass: r.filter(x => x.pass).length, total: r.length, failing: r.filter(x => !x.pass).map(x => x.name) }));
