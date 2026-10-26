/* Binding Vows — headless checks.  node tools/vow-tests.js
   Loads the engine, techniques and vows, casts real rune spells in a bare world and checks every promise:
   free (cost / cooldown / output), payouts, breaks, failure clauses, one payout per contract, player stat vows. */
'use strict';
const path = require('path');
const dir = path.join(__dirname, '..');
require(path.join(dir, 'magic-engine.js'));
require(path.join(dir, 'magic-techniques.js'));
require(path.join(dir, 'magic-vows.js'));
const ME = globalThis.MagicEngine, MV = globalThis.MagicVows;

const out = [];
const ok = (name, pass, detail) => { out.push({ name, pass: !!pass, detail: detail || '' }); };

function prof(){ const p = ME.deriveProfile({ magicPower: 30, magicControl: 12 }); p.techniquePoints = 20; p.allocations = { thermal: 2, kinetic: 2, light: 2, gravity: 2, spatial: 2, antimagic: 2, infinity: 2, construction: 2 }; return p; }
/* steps: [type, params, link?, children?] — children make a branch */
function tree(name, steps){
	const s = ME.blankSpell(name); let gy = 0;
	function add(list, parent){
		let prev = parent;
		for(const st of list){
			let n;
			if(prev == null){ n = s.nodes[s.rootId]; n.type = st[0]; n.params = ME.paramDefaults(st[0]); }
			else { gy++; n = ME.makeNode(st[0], prev, 's', 0, gy, gy); s.nodes[n.id] = n; }
			Object.assign(n.params, st[1] || {});
			if(st[2]) n.link = Object.assign(n.link, st[2]);
			if(st[3]){ for(const br of st[3]) add(br, n.id); return; }
			prev = n.id;
		}
	}
	add(steps, null);
	s.seq = gy + 1;
	return s;
}
const vow = (family, key, extra, failure) => { const p = { family, vow: key, failure: failure || 'lose' }; for(const k in (extra || {})) p[key + '_' + k] = extra[k]; return ['vow', p]; };
function world(enemies, caster){
	const W = ME.createWorld();
	const host = { mouseWorld: () => ({ x: 2000, y: 100 }), getEnemies: () => enemies.filter(e => !e.dead), isSolid: () => false, inBounds: (x, y) => x > -500 && x < 5000 && y > -500 && y < 1500,
		damageEnemy: (e, d) => { e.hp -= d; e.taken = (e.taken || 0) + d; }, vowText: (at, t) => { W._texts = W._texts || []; W._texts.push(t); } };
	return { W, host, caster: caster || { x: 90, y: 80, w: 20, h: 40, vx: 0, vy: 0, hp: 100, maxHp: 100 } };
}
function enemy(x, hp){ return { x, y: 60, w: 30, h: 60, hp: hp || 5000, maxHp: hp || 5000, vx: 0, vy: 0 }; }
function run(W, host, secs){ for(let i = 0; i < Math.round(secs * 60); i++) W.update(1 / 60, host); }
function cast(W, host, caster, def, extra){ return W.cast(def, Object.assign({ profile: prof(), owner: { id: 'p', entity: caster }, host }, extra || {})); }

/* ---------- it is free ---------- */
{
	const plain = tree('bolt', [ ['generate', { amount: 60 }], ['redirect', { toward: 'right' }] ]);
	const vowed = tree('bolt', [ ['generate', { amount: 60 }], vow('energy', 'unerring'), ['redirect', { toward: 'right' }] ]);
	const a = ME.validate(plain, prof()), b = ME.validate(vowed, prof());
	ok('Free: a vow adds no mana cost', a.ok && b.ok && a.cost === b.cost && a.upfront === b.upfront, a.cost + ' vs ' + b.cost);
	ok('Free: a vow adds no cooldown', ME.castCooldownFrames(plain) === ME.castCooldownFrames(vowed), ME.castCooldownFrames(plain) + ' vs ' + ME.castCooldownFrames(vowed));
	ok('Free: estimated output unchanged', a.peakOutput === b.peakOutput, a.peakOutput + ' vs ' + b.peakOutput);
	const info = b.nodeInfo[Object.keys(vowed.nodes).find(k => vowed.nodes[k].type === 'vow')];
	ok('Forge: the vow describes its contract', info && info.extra && info.extra.vow && /Condition/.test(Object.keys(info.extra.vow).join()), info && info.extra ? Object.keys(info.extra.vow || {}).join(', ') : 'none');
	let all = true, bad = '';
	for(const k of MV.ORDER){ const V = MV.VOWS[k]; const d = tree('v', V.family === 'energy' ? [ ['generate', { amount: 40 }], vow(V.family, k) ] : [ vow(V.family, k), ['generate', { amount: 10 }] ]); const r = ME.validate(d, prof()); const fine = r.ok || (k === 'namedPrey' && r.errors.every(e => e.code === 'VOW_PREY')); if(!fine){ all = false; bad += k + ': ' + r.errors.map(e => e.text).join('; ') + '  '; } }
	ok('All ' + MV.ORDER.length + ' vows validate with their defaults', all, bad);
}

/* ---------- Unerring Path: a straight bolt hits harder; a turned one does not ---------- */
function damageOf(def, ex, secs, enemiesIn){
	const es = enemiesIn || [ enemy(900) ];
	const { W, host, caster } = world(es);
	const r = cast(W, host, caster, def, ex);
	run(W, host, secs || 3);
	return { W, es, r, dmg: es.reduce((s, e) => s + (e.taken || 0), 0) };
}
{
	const base = damageOf(tree('b', [ ['generate', { amount: 60 }], ['redirect', { toward: 'right' }] ]));
	const strt = damageOf(tree('b', [ ['generate', { amount: 60 }], vow('energy', 'unerring', { minDist: 300 }), ['redirect', { toward: 'right' }] ]));
	ok('Unerring Path: a straight 800 px flight hits harder', base.dmg > 0 && strt.dmg > base.dmg * 1.25, Math.round(base.dmg) + ' → ' + Math.round(strt.dmg));
	const turned = damageOf(tree('b', [ ['generate', { amount: 60 }], vow('energy', 'unerring'), ['redirect', { toward: 'right' }], ['redirect', { toward: 'angle', angle: 10 }, { mode: 'delay', delay: 0.3 }], ['redirect', { toward: 'right' }, { mode: 'delay', delay: 0.05 }] ]));
	const C = turned.W.vowHistory().find(c => c.key === 'unerring');
	ok('Unerring Path: turning breaks it (no bonus)', (!C || C.state === 'broken') && turned.dmg <= base.dmg * 1.05, 'state ' + (C ? C.state : 'gone') + ', dmg ' + Math.round(turned.dmg));
	// the bonus is free: the spell's counted output stays the un-vowed share
	const { W, host, caster } = world([ enemy(4000) ]);
	cast(W, host, caster, tree('b', [ ['generate', { amount: 60 }], vow('energy', 'sacrifice', { what: 'health', pct: 40 }) ]));
	W.host = host; host.vowSacrificeHealth = () => 0.4;
	const W2 = world([ enemy(4000) ]); W2.host.vowSacrificeHealth = () => 0.4;
	const r2 = cast(W2.W, W2.host, W2.caster, tree('b', [ ['generate', { amount: 60 }], vow('energy', 'sacrifice', { what: 'health', pct: 40 }) ]));
	W2.W.update(1 / 60, W2.host);
	const body = W2.W.bodies.find(b => b.alive);
	const powAll = body ? Math.abs(ME.bodyPower(body)) : 0;
	ok('Bonus energy never counts against Max Output', body && body.vowShare > 0.3 && r2.instance.outputUsed < powAll * 0.75, body ? 'body ' + Math.round(body.amount) + ' E, share ' + body.vowShare.toFixed(2) + ', counted ' + Math.round(r2.instance.outputUsed) + ' of ' + Math.round(powAll) : 'no body');
}

/* ---------- Long Journey: failure clauses ---------- */
{
	const far = damageOf(tree('j', [ ['generate', { amount: 60 }], vow('energy', 'journey', { distance: 600 }), ['redirect', { toward: 'right' }] ]));
	const base = damageOf(tree('j', [ ['generate', { amount: 60 }], ['redirect', { toward: 'right' }] ]));
	ok('Long Journey: 800 px ≥ 600 → bonus', far.dmg > base.dmg * 1.15, Math.round(base.dmg) + ' → ' + Math.round(far.dmg));
	const lose = damageOf(tree('j', [ ['generate', { amount: 60 }], vow('energy', 'journey', { distance: 2000 }, 'lose'), ['redirect', { toward: 'right' }] ]));
	const drain = damageOf(tree('j', [ ['generate', { amount: 60 }], vow('energy', 'journey', { distance: 2000 }, 'drain'), ['redirect', { toward: 'right' }] ]));
	const destroy = damageOf(tree('j', [ ['generate', { amount: 60 }], vow('energy', 'journey', { distance: 2000 }, 'destroy'), ['redirect', { toward: 'right' }] ]));
	ok('Broken (lose): plain damage', Math.abs(lose.dmg - base.dmg) < base.dmg * 0.06, Math.round(lose.dmg) + ' vs ' + Math.round(base.dmg));
	ok('Broken (drain): about 35% less', drain.dmg < base.dmg * 0.75 && drain.dmg > base.dmg * 0.5, Math.round(drain.dmg));
	ok('Broken (destroy): the energy is gone, no damage', destroy.dmg === 0, Math.round(destroy.dmg));
}

/* ---------- Patience: passes through until the wait is over ---------- */
{
	const es = [ enemy(70, 5000) ];
	const { W, host, caster } = world(es);
	cast(W, host, caster, tree('p', [ ['generate', { amount: 50 }], vow('energy', 'patience', { time: 1 }) ]));
	run(W, host, 0.8);
	const early = es[0].taken || 0;
	run(W, host, 0.6);
	const late = es[0].taken || 0;
	ok('Patience: no damage during the wait, a strong hit after', early === 0 && late > 0, 'at 0.8 s ' + Math.round(early) + ', at 1.4 s ' + Math.round(late));
}

/* ---------- Named Prey: passes the decoy, strikes the prey ---------- */
{
	const decoy = enemy(400, 3000), prey = enemy(800, 6000);
	const r = damageOf(tree('n', [ ['generate', { amount: 60 }], ['target', { kind: 'enemy', select: 'strongest', range: 1500 }], vow('energy', 'namedPrey', { others: 'pass' }), ['redirect', { toward: 'target' }] ]), null, 3, [ decoy, prey ]);
	ok('Named Prey (pass): the decoy is untouched, the prey is struck', !(decoy.taken > 0) && prey.taken > 0, 'decoy ' + Math.round(decoy.taken || 0) + ', prey ' + Math.round(prey.taken || 0));
	const d2 = enemy(400, 3000), p2 = enemy(800, 6000);
	const r2 = damageOf(tree('n', [ ['generate', { amount: 60 }], ['target', { kind: 'enemy', select: 'strongest', range: 1500 }], vow('energy', 'namedPrey', { others: 'cancel' }, 'destroy'), ['redirect', { toward: 'right' }] ]), null, 3, [ d2, p2 ]);
	ok('Named Prey (cancel + destroy): striking the decoy destroys it', !(d2.taken > 0) && !(p2.taken > 0), 'decoy ' + Math.round(d2.taken || 0) + ', prey ' + Math.round(p2.taken || 0));
}

/* ---------- Solitude: splitting breaks it ---------- */
{
	const { W, host, caster } = world([ enemy(4000) ]);
	cast(W, host, caster, tree('s', [ ['generate', { amount: 60 }], vow('energy', 'solitude'), ['split', {}, null, [ [ ['lock', {}] ], [ ['lock', {}] ] ] ] ]));
	run(W, host, 0.1);
	const C = W.vows.find(c => c.key === 'solitude');
	ok('Solitude: a Split breaks it', C && C.state === 'broken', C ? C.state + ' — ' + C.why : 'none');
	const { W: W2, host: h2, caster: c2 } = world([ enemy(4000) ]);
	cast(W2, h2, c2, tree('s', [ ['generate', { amount: 60 }], vow('energy', 'solitude') ]));
	const b = W2.bodies.find(x => x.alive); const a0 = b.amount;
	const { W: W3, host: h3, caster: c3 } = world([ enemy(4000) ]);
	cast(W3, h3, c3, tree('s', [ ['generate', { amount: 60 }] ]));
	const b3 = W3.bodies.find(x => x.alive);
	run(W2, h2, 2); run(W3, h3, 2);
	ok('Solitude: bound energy leaks less', b.amount > b3.amount, Math.round(b.amount * 10) / 10 + ' vs ' + Math.round(b3.amount * 10) / 10 + ' (from ' + a0 + ')');
}

/* ---------- Divide: one contract per piece, split children share (paid once) ---------- */
{
	const es = [ enemy(900) ];
	const { W, host, caster } = world(es);
	cast(W, host, caster, tree('d', [ ['generate', { amount: 90 }], vow('energy', 'journey', { distance: 500 }), ['divide', { count: 3, formation: 'cluster' }], ['redirect', { toward: 'right' }] ]));
	run(W, host, 3);
	const C = W.vowHistory().filter(c => c.key === 'journey');
	const paidN = C.filter(c => c.state === 'paid').length;
	ok('One contract, divided into 3 pieces: it pays exactly once', C.length === 1 && paidN === 1, C.length + ' contract(s), ' + paidN + ' paid');
	const es2 = [ enemy(900) ];
	const w2 = world(es2);
	cast(w2.W, w2.host, w2.caster, tree('d', [ ['generate', { amount: 90 }], ['divide', { count: 3, formation: 'cluster' }], vow('energy', 'journey', { distance: 500 }), ['redirect', { toward: 'right' }] ]));
	run(w2.W, w2.host, 3);
	const C2 = w2.W.vowHistory().filter(c => c.key === 'journey');
	ok('Vow after Divide: one contract per piece, each pays once', C2.length === 3 && C2.every(c => c.state === 'paid'), C2.length + ' contracts: ' + C2.map(c => c.state).join(','));
}

/* ---------- Perfect Sequence ---------- */
{
	const es = [ enemy(700, 9000) ];
	const { W, host, caster } = world(es);
	cast(W, host, caster, tree('q', [ ['generate', { amount: 90 }], ['divide', { count: 3, formation: 'along', spacing: 40 }], vow('energy', 'sequence', { count: 3, window: 2 }), ['redirect', { toward: 'right' }] ]));
	run(W, host, 3);
	const C = W.vowHistory().filter(c => c.key === 'sequence');
	ok('Perfect Sequence: the 3rd piece to strike completes it', C.length === 3 && C.filter(c => c.state === 'paid').length === 1 && C.filter(c => c.state === 'broken').length === 2, C.map(c => c.state).join(','));
}

/* ---------- Stillness / Final Fragment / Sacrifice (paid without a hit) ---------- */
{
	const { W, host, caster } = world([ enemy(4000) ]);
	cast(W, host, caster, tree('st', [ ['generate', { amount: 50 }], vow('energy', 'stillness', { radius: 80, time: 1 }) ]));
	run(W, host, 1.2);
	const C = W.vows.find(c => c.key === 'stillness');
	ok('Stillness: holding still pays at the end', C && C.state === 'paid', C ? C.state + ' +' + Math.round(C.paid || 0) + ' E' : 'none');
	const w2 = world([ enemy(4000) ]);
	cast(w2.W, w2.host, w2.caster, tree('st', [ ['generate', { amount: 50 }], vow('energy', 'stillness', { radius: 40, time: 1 }) ]));
	run(w2.W, w2.host, 0.3); w2.caster.x += 200; run(w2.W, w2.host, 0.2);
	const C2 = w2.W.vows.find(c => c.key === 'stillness');
	ok('Stillness: moving breaks it', C2 && C2.state === 'broken', C2 ? C2.state : 'none');
	const w3 = world([ enemy(4000) ]);
	cast(w3.W, w3.host, w3.caster, tree('ff', [ ['generate', { amount: 30 }], null ].filter(Boolean)));
	const ff = tree('ff', [ ['generate', { amount: 200 }], ['split', { share: 0 }, null, [ [ vow('energy', 'finalFragment') ], [ ['generate', { amount: 10 }, { mode: 'delay', delay: 0.5 }], ['lock', {}], ['color', {}] ] ] ] ]);
	cast(w3.W, w3.host, w3.caster, ff);
	run(w3.W, w3.host, 0.3);
	const F0 = w3.W.vows.find(c => c.key === 'finalFragment');
	const s0 = F0 ? F0.state : 'none';
	run(w3.W, w3.host, 0.5);
	ok('Final Fragment: pays when the rest of the spell is done (not before)', F0 && s0 === 'active' && F0.state === 'paid', s0 + ' → ' + (F0 ? F0.state : 'none') + ' +' + Math.round((F0 && F0.paid) || 0) + ' E');
	const w4 = world([ enemy(4000) ]);
	cast(w4.W, w4.host, w4.caster, tree('sac', [ ['generate', { amount: 200 }], ['split', { share: 0 }, null, [ [ ['lock', {}] ], [ vow('energy', 'sacrifice', { what: 'spell', pct: 50 }) ] ] ] ]));
	const bs = w4.W.bodies.filter(b => b.alive).sort((a, b) => a.amount - b.amount);
	ok('Sacrifice: the rest of the spell feeds the sworn energy', bs.length === 2 && bs[1].amount > bs[0].amount * 2, bs.map(b => Math.round(b.amount)).join(' / '));
}

/* ---------- Compression / Untouched ---------- */
{
	const base = damageOf(tree('c', [ ['generate', { amount: 120 }], ['compress', { power: 16 }], ['redirect', { toward: 'right' }] ]));
	const cv = damageOf(tree('c', [ ['generate', { amount: 120 }], vow('energy', 'compression', { level: 15 }), ['compress', { power: 16 }], ['redirect', { toward: 'right' }] ]));
	ok('Absolute Compression: reaching it and holding it pays', cv.dmg > base.dmg * 1.1, Math.round(base.dmg) + ' → ' + Math.round(cv.dmg));
	const u = damageOf(tree('u', [ ['generate', { amount: 60 }], vow('energy', 'untouched', { time: 1 }), ['redirect', { toward: 'right', speedPct: 40 }] ]), null, 6, [ enemy(700) ]);
	const ub = damageOf(tree('u', [ ['generate', { amount: 60 }], ['redirect', { toward: 'right', speedPct: 40 }] ]), null, 6, [ enemy(700) ]);
	ok('Untouched: survived 1 s, then a stronger hit', u.dmg > ub.dmg * 1.1, Math.round(ub.dmg) + ' → ' + Math.round(u.dmg));
}

/* ---------- player vows ---------- */
{
	const { W, host, caster } = world([ enemy(4000) ]);
	const gc = tree('gc', [ vow('attribute', 'glassCannon', { pct: 30 }), ['generate', { amount: 10 }] ]);
	const r = cast(W, host, caster, gc, { passive: true });
	W.update(1 / 60, host);
	const M = W.vowMods('p');
	ok('Glass Cannon: more damage taken, more power', M.def > 1.25 && M.power > 1.3, 'def ×' + M.def.toFixed(2) + ' power ×' + M.power.toFixed(2));
	W.endInstance(r.instance);
	run(W, host, 3);
	const M2 = W.vowMods('p');
	ok('Player vows end with their spell (after a short grace)', M2.def === 1 && M2.power === 1, 'def ×' + M2.def.toFixed(2) + ' power ×' + M2.power.toFixed(2));
	// clamps
	const w2 = world([ enemy(4000) ]);
	for(let i = 0; i < 4; i++) cast(w2.W, w2.host, w2.caster, tree('gc' + i, [ vow('attribute', 'glassCannon', { pct: 60 }), ['generate', { amount: 10 }] ]), { passive: true });
	w2.W.update(1 / 60, w2.host);
	const M3 = w2.W.vowMods('p');
	ok('Stacked stat vows stay inside their caps', M3.def <= 1.8 && M3.power <= 2.2, 'def ×' + M3.def.toFixed(2) + ' power ×' + M3.power.toFixed(2));
	// Charged Heart → next cast hits harder
	const w3 = world([ enemy(900) ]);
	cast(w3.W, w3.host, w3.caster, tree('ch', [ vow('attribute', 'chargedHeart', { time: 1 }), ['generate', { amount: 10 }] ]), { passive: true });
	run(w3.W, w3.host, 1.2);
	const r3 = cast(w3.W, w3.host, w3.caster, tree('b', [ ['generate', { amount: 40 }], ['redirect', { toward: 'right' }] ]));
	ok('Charged Heart: the cast after the charge is empowered', r3.ok && r3.instance.vowPower > 1.15, 'power ×' + (r3.instance.vowPower || 1).toFixed(2));
	// Still Mind (reserve) → next cast's energy grows, and that growth is free
	const w4 = world([ enemy(4000) ]);
	cast(w4.W, w4.host, w4.caster, tree('sm', [ vow('passive', 'stillMind', { mode: 'reserve', time: 2 }), ['generate', { amount: 10 }] ]), { passive: true });
	run(w4.W, w4.host, 2.2);
	const r4 = cast(w4.W, w4.host, w4.caster, tree('b', [ ['generate', { amount: 50 }] ]));
	const nb = r4.instance && w4.W.bodies.find(b => b.alive && b.inst === r4.instance.id);
	ok('Still Mind: quiet builds a charge the next spell releases (free)', nb && nb.amount > 65 && nb.vowShare > 0.2, nb ? Math.round(nb.amount) + ' E, share ' + nb.vowShare.toFixed(2) : 'no body');
	// suspension: Singular Purpose (melee) is switched off by a spell
	const w5 = world([ enemy(4000) ]);
	cast(w5.W, w5.host, w5.caster, tree('sp', [ vow('passive', 'singularPurpose', { style: 'melee' }), ['generate', { amount: 10 }] ]), { passive: true });
	w5.W.update(1 / 60, w5.host);
	const before = w5.W.vowMods('p').str;
	cast(w5.W, w5.host, w5.caster, tree('b', [ ['generate', { amount: 20 }] ]));
	w5.W.update(1 / 60, w5.host);
	const after = w5.W.vowMods('p').str;
	ok('Singular Purpose (melee): an active spell switches it off', before >= 0.3 && after === 0, 'str +' + before.toFixed(2) + ' → +' + after.toFixed(2));
	// cost: Few Words makes short spells cheaper, never dearer
	const w6 = world([ enemy(4000) ]);
	cast(w6.W, w6.host, w6.caster, tree('fw', [ vow('attribute', 'fewWords', { runes: 4 }), ['generate', { amount: 10 }] ]), { passive: true });
	w6.W.update(1 / 60, w6.host);
	const short = w6.W.vowCostMult('p', tree('s', [ ['generate', { amount: 20 }], ['redirect', {}] ]));
	const long = w6.W.vowCostMult('p', tree('l', [ ['generate', { amount: 20 }], ['redirect', {}], ['lock', {}], ['color', {}], ['redirect', {}], ['lock', {}] ]));
	ok('Few Words: short spells cheaper, long ones unchanged', short < 0.8 && long === 1, 'short ×' + short.toFixed(2) + ', long ×' + long.toFixed(2));
	// Unbroken Thread needs a passive spell
	const w7 = world([ enemy(4000) ]);
	const r7 = cast(w7.W, w7.host, w7.caster, tree('ut', [ vow('passive', 'unbrokenThread'), ['generate', { amount: 10 }] ]));
	ok('Unbroken Thread refuses an active spell', !w7.W.vows.length, r7.ok ? 'contracts ' + w7.W.vows.length : r7.error);
}

/* ---------- Gauntlet ---------- */
{
	const es = [ enemy(1300, 9000) ];
	const { W, host, caster } = world(es);
	// three gates: your own energy held still along the path (Light keeps them from merging with the bolt)
	for(const gx of [ 350, 600, 850 ]){ caster.x = gx; cast(W, host, caster, tree('g', [ ['generate', { amount: 20 }], ['technique', { technique: 'light', power: 2 }], ['anchor', { state: 'anchored' }] ])); }
	caster.x = 90;
	cast(W, host, caster, tree('gb', [ ['generate', { amount: 60 }], vow('energy', 'gauntlet', { gates: 3 }), ['redirect', { toward: 'right' }] ]));
	run(W, host, 4);
	const C = W.vowHistory().find(c => c.key === 'gauntlet');
	ok('Gauntlet: through 3 of your gates, then a bonus hit', C && C.state === 'paid', C ? C.state + ' ' + (C.why || '') + ' +' + Math.round(C.paid || 0) : 'none');
}

let pass = 0;
for(const o of out){ console.log((o.pass ? 'PASS ' : 'FAIL ') + o.name + (o.detail ? '  — ' + o.detail : '')); if(o.pass) pass++; }
console.log(pass + ' / ' + out.length + ' vow checks passed');
if(pass !== out.length) process.exitCode = 1;
