/* =====================================================================
   RAW-ENERGY DISCOVERY SWEEP — node tools/raw-discovery.js [count] [seed]

   The game had no automated spell-discovery system, so this is the first one. It is deliberately narrow: it only
   searches spells made of RAW ENERGY and GENERIC RUNES (no Technique rune, no Infinity, no Construction, no domain),
   because that is what the Grand Arcanist may use.

   1. A grammar builds candidate rune trees from choices: how much energy, how it is compressed and shaped, how it is
      divided or split, how each piece moves (direct, staged and held, staggered, arcing, guided, lurking for a
      condition, rising then dropping) and how it ends (nothing, a burst near the target, a burst on arrival, expand
      then burst). Every tree is an ordinary engine spell (RuneMages.build), the same format the forge saves.
   2. Each candidate is validated by MagicEngine.validate with the boss's profile and rejected if it is invalid, uses
      a technique, or needs more than the profile's Max Output.
   3. Each survivor is cast in a FRESH engine world (MagicEngine.createWorld) in the Mage Arena's real geometry,
      against a bot following each player policy (tools/sim-core.js) from two distances, with a seeded RNG.
   4. Measured: hits, damage, time to first hit, coverage, peak bodies, update time, leftover energy, runtime errors,
      self-damage. A candidate is re-run with the same seed to prove it reproduces.
   5. Bugs (errors, NaN, energy stuck outside the arena, self-hits, budget hits) are minimised by deleting runes while
      the bug still reproduces, and saved.

   Writes sim/raw-discovery/: capability-manifest.json, catalog.json (every verified spell with its serialised tree),
   campaign-summary.json, coverage.json, performance.json, bugs.json (+ minimised repros), README.md.
   ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const S = require('./sim-core.js');
const { ME, RM } = S.loadGame();
const { N, L, build } = RM;

const OUT = path.join(S.ROOT, 'sim', 'raw-discovery');
const COUNT = +(process.argv[2] || 520);
const SEED = +(process.argv[3] || 6060);
const RUN_FRAMES = 360, TAIL_FRAMES = 240;      // 6 s of fight, then 4 s more to see what is left behind
const DISTANCES = [ 380, 720 ];
const POLICY_KEYS = [ 'still', 'strafe', 'jumper', 'reactive', 'aggressive', 'kiter', 'random' ];

/* the caster's profile: the same one the Grand Arcanist uses (kept in sync by the campaign, which checks it) */
const PROFILE_STATS = { magicControl: 30, magicPower: 150, maxMana: 7000 };
const PROFILE = ME.deriveProfile(PROFILE_STATS);
PROFILE.allocations = {}; PROFILE.techniquePoints = 0;

/* ---------- what the sweep may use (the capability manifest) ---------- */
const ALLOWED_RUNES = [ 'target', 'generate', 'compress', 'divide', 'split', 'redirect', 'anchor', 'discharge' ];
const ALLOWED_CONDS = [ 'arrived', 'targetNear', 'enemyNear', 'travelled', 'spellAge' ];
const FORBIDDEN_RUNES = [ 'technique', 'reverseTechnique', 'domain', 'reinforce', 'infuse', 'force', 'attach', 'memory', 'lock', 'zone', 'drawOut' ];

/* ---------- the grammar ---------- */
const AMOUNTS = [ 120, 240, 400 ];
const SHAPES = [ null, 'sphere', 'lance', 'arrow', 'spike', 'ring', 'wave', 'disc' ];
const POWERS = [ 3, 8, 14 ];
const FORMS = [ 'arc', 'circle', 'vertical', 'horizontal', 'cluster' ];
const COUNTS = [ 3, 5, 8 ];
const MOTIONS = [ 'keep', 'outward', 'still' ];
const PROGS = [ 'direct', 'hold', 'stagger', 'guided', 'arc', 'lurk', 'drop' ];
const TERMS = [ 'none', 'burstNear', 'burstArrive', 'expandBurst' ];

function pick(R, arr){ return arr[Math.floor(R() * arr.length)]; }
function randomGenome(R){
	const g = { amt: pick(R, AMOUNTS), shape: pick(R, SHAPES), power: pick(R, POWERS), struct: R() < 0.25 ? 'single' : R() < 0.75 ? 'divide' : 'split',
		form: pick(R, FORMS), count: pick(R, COUNTS), motion: pick(R, MOTIONS), branches: R() < 0.5 ? 2 : 3,
		prog: pick(R, PROGS), term: pick(R, TERMS), delay: pick(R, [ 0.3, 0.6, 1.0 ]), spacing: pick(R, [ 40, 90, 160 ]) };
	if(g.prog === 'stagger' && g.struct !== 'split') g.prog = 'hold';
	if(g.term === 'burstArrive' && !(g.prog === 'lurk' || g.prog === 'drop')) g.term = 'burstNear';
	return g;
}
const key = (g) => [ g.amt, g.shape || 'raw', g.shape ? g.power : 0, g.struct, g.struct === 'divide' ? g.form + g.count + g.motion + g.spacing : g.struct === 'split' ? g.branches : '', g.prog, g.prog === 'hold' || g.prog === 'stagger' || g.prog === 'drop' ? g.delay : '', g.term ].join('|');

/* the motion program for one piece (a chain of runes), ending in the terminal */
function chain(g, i){
	const term = () => {
		if(g.term === 'burstNear') return [ N('discharge', { radius: 1.6 }, L.c('targetNear', { range: 70 }, 4)) ];
		if(g.term === 'burstArrive') return [ N('discharge', { radius: 1.8 }, L.c('arrived', {}, 3)) ];
		if(g.term === 'expandBurst') return [ N('compress', { power: -6, shape: 'keep' }, L.c('targetNear', { range: 110 }, 4), N('discharge', { radius: 1.4 })) ];
		return [];
	};
	const T = term();
	const at = (n) => { if(T.length) n.kids.push(T[0]); return n; };
	switch(g.prog){
		case 'direct': return at(N('redirect', { toward: 'mouse' }));
		case 'hold': return N('redirect', { toward: 'up', arrive: 'stop', speedPct: 60 }, null, at(N('redirect', { toward: 'mouse' }, L.d(g.delay))));
		case 'stagger': return at(N('redirect', { toward: 'mouse' }, L.d(0.2 + i * g.delay * 0.6)));
		case 'guided': return N('redirect', { toward: 'mouse', speedPct: 70 }, null, at(N('anchor', { state: 'guided' })));
		case 'arc': return N('redirect', { toward: 'angle', angle: (i % 2 ? 1 : -1) * 55 - 90 }, null, at(N('redirect', { toward: 'target' }, L.c('travelled', { distance: 200 }, 2))));
		case 'lurk': return N('redirect', { toward: 'mouse', arrive: 'stop', speedPct: 80 }, null,
			N('anchor', { state: 'anchored' }, L.c('arrived', {}, 3), g.term === 'burstArrive' ? N('discharge', { radius: 1.8 }, L.c('enemyNear', { range: 120 }, 4)) : at(N('redirect', { toward: 'target' }, L.c('enemyNear', { range: 180 }, 4)))));
		case 'drop': return N('redirect', { toward: 'up', arrive: 'stop', speedPct: 80 }, null,
			N('redirect', { toward: 'mouse', arrive: g.term === 'burstArrive' ? 'stop' : 'pass' }, L.d(g.delay), ...T));
	}
}
function treeOf(g){
	let body;
	if(g.struct === 'single') body = chain(g, 0);
	else if(g.struct === 'divide') body = N('divide', { count: g.count, formation: g.form, spacing: g.spacing, motion: g.motion }, null, chain(g, 0));
	else { const kids = []; for(let i = 0; i < g.branches; i++) kids.push(chain(g, i)); body = N('split', { spread: 30 }, null, ...kids); }
	const shaped = g.shape ? N('compress', { power: g.power, shape: g.shape }, null, body) : body;
	return N('target', { kind: 'enemy', select: 'nearCaster', range: 1600 }, null, N('generate', { amount: g.amt }, null, shaped));
}

/* ---------- the technique-free check (the same rule the Grand Arcanist's policy applies) ---------- */
function techFree(def){
	for(const id in def.nodes){
		const n = def.nodes[id];
		if(FORBIDDEN_RUNES.indexOf(n.type) >= 0) return 'rune ' + n.type;
		if(n.type === 'target' && n.params && (n.params.kind === 'anchorState' && n.params.astate === 'infinity')) return 'infinity state';
	}
	return null;
}

/* ---------- one run ---------- */
function runOnce(def, policy, dist, seed, opts){
	opts = opts || {};
	return S.seeded(seed, () => {
		const arena = S.makeArena(S.ARENA), A = arena.A;
		const w = ME.createWorld();
		const casterX = A.center - 600;
		const caster = { x: casterX - 16, y: A.groundY - 72, w: 32, h: 72, hp: 1e9 };
		const bot = S.makeBot(A, casterX + dist, policy);
		const R = Math.random;
		const hist = [];
		const res = { hit: 0, dmg: 0, tFirst: null, selfHits: 0, peak: 0, ms: 0, maxMs: 0, errors: [], nan: 0, outside: 0, left: 0, cells: 0 };
		const cov = S.coverage();
		let f = 0;
		const host = S.makeHost(arena, () => [ bot ], () => {}, bot);
		// the caster's cursor: where the bot was 0.2 s ago, led by its velocity then (what a quick player sees)
		const aimNow = () => { const s = hist[0] || { x: S.cx(bot), y: S.cy(bot), vx: 0, vy: 0 }; return { x: s.x + s.vx * 18, y: Math.min(s.y + s.vy * 6, A.groundY - 28) }; };
		const owner = { id: 'sweep', entity: caster, alive: () => true, facing: () => Math.sign(S.cx(bot) - S.cx(caster)) || 1,
			foes: () => [ bot ], allies: () => [],
			hurt: (e, d) => { if(e !== bot) return; res.hit++; res.dmg += d; if(res.tFirst == null) res.tFirst = f / 60; },
			hurtSelf: () => { res.selfHits++; }, aim: aimNow, aimFor: aimNow, health: () => 1, triggers: 0 };
		const r = w.cast(def, { profile: PROFILE, owner, host });
		if(!r || !r.ok){ res.castError = (r && r.error) || 'cast failed'; return res; }
		const ctx = { R, w, foeId: 'sweep', bx: S.cx(caster), f: 0 };
		for(f = 0; f < RUN_FRAMES + TAIL_FRAMES; f++){
			hist.push({ x: S.cx(bot), y: S.cy(bot), vx: bot.vx, vy: bot.vy }); if(hist.length > 12) hist.shift();
			ctx.f = f;
			S.stepBot(bot, ctx, arena);
			const t0 = process.hrtime.bigint();
			w.update(1 / 60, host);
			const ms = Number(process.hrtime.bigint() - t0) / 1e6;
			res.ms += ms; if(ms > res.maxMs) res.maxMs = ms;
			let n = 0;
			for(const b of w.bodies){
				if(!b.alive || b.ownerId !== 'sweep') continue;
				n++;
				if(!isFinite(b.x) || !isFinite(b.y)) res.nan++;
				else if(f < RUN_FRAMES) cov.add(b.x, b.y);
				if(f === RUN_FRAMES + TAIL_FRAMES - 1 && !arena.inBounds(b.x, b.y)) res.outside++;
			}
			if(n > res.peak) res.peak = n;
			if(f === RUN_FRAMES + TAIL_FRAMES - 1) res.left = n;
		}
		res.ms /= (RUN_FRAMES + TAIL_FRAMES);
		res.cells = cov.cells;
		res.errors = (w.errors || []).map(e => e.where + ': ' + e.msg);
		res.budget = (r.instance.log || []).filter(l => /step limit|Too many|budget/i.test(String(l.text || l))).length;
		return res;
	});
}

function evaluate(def, seed){
	const runs = {};
	let s = seed;
	for(const pol of POLICY_KEYS) for(const d of DISTANCES){ runs[pol + '@' + d] = runOnce(def, pol, d, s++); }
	return runs;
}
function summarise(runs){
	const all = Object.values(runs);
	const moving = Object.keys(runs).filter(k => !k.startsWith('still')).map(k => runs[k]);
	const hitRate = (list) => list.filter(r => r.hit > 0).length / Math.max(1, list.length);
	const byPolicy = {};
	for(const k in runs){ const p = k.split('@')[0]; (byPolicy[p] = byPolicy[p] || []).push(runs[k]); }
	const bp = {};
	for(const p in byPolicy) bp[p] = { hitRate: +hitRate(byPolicy[p]).toFixed(2), dmg: Math.round(S.mean(byPolicy[p].map(r => r.dmg))) };
	return {
		hitStill: +hitRate(runs['still@380'] ? [ runs['still@380'], runs['still@720'] ] : []).toFixed(2),
		hitMoving: +hitRate(moving).toFixed(2),
		dmgMoving: Math.round(S.mean(moving.map(r => r.dmg))),
		dmgAll: Math.round(S.mean(all.map(r => r.dmg))),
		tFirst: S.quantile(all.filter(r => r.tFirst != null).map(r => r.tFirst), 0.5),
		cells: Math.round(S.mean(all.map(r => r.cells))),
		peak: Math.max(...all.map(r => r.peak)),
		ms: +S.mean(all.map(r => r.ms)).toFixed(3), maxMs: +Math.max(...all.map(r => r.maxMs)).toFixed(2),
		left: Math.max(...all.map(r => r.left)),
		byPolicy: bp
	};
}
function bugsOf(runs){
	const out = [];
	for(const k in runs){
		const r = runs[k];
		if(r.castError) out.push({ kind: 'castError', run: k, detail: r.castError });
		if(r.errors.length) out.push({ kind: 'runtimeError', run: k, detail: r.errors[0] });
		if(r.nan) out.push({ kind: 'nanPosition', run: k, detail: r.nan + ' frames' });
		if(r.outside) out.push({ kind: 'energyStuckOutside', run: k, detail: r.outside + ' bodies outside the arena after 10 s' });
		if(r.selfHits) out.push({ kind: 'selfDamage', run: k, detail: r.selfHits + ' hits on the caster' });
		if(r.budget) out.push({ kind: 'budgetHit', run: k, detail: r.budget + ' budget notes' });
		if(r.maxMs > 25) out.push({ kind: 'slowFrame', run: k, detail: r.maxMs.toFixed(1) + ' ms' });
		// an exploit rather than a crash: energy that keeps striking and is still alive 10 s later (it never runs out)
		if(r.hit >= 4 && r.left > 0) out.push({ kind: 'lingeringRepeatHits', run: k, detail: r.hit + ' hits, ' + r.left + ' bodies still alive after 10 s' });
	}
	const seen = new Set();
	return out.filter(b => { const k = b.kind + b.detail; if(seen.has(k)) return false; seen.add(k); return true; });
}
const OPS = (g) => {
	const o = new Set();
	if(g.shape) o.add(g.power >= 8 ? 'compress-high' : 'compress');
	if(g.struct === 'divide') o.add('divide-' + g.motion);
	if(g.struct === 'split') o.add('split');
	o.add('prog-' + g.prog);
	if(g.term !== 'none') o.add('term-' + g.term);
	if(g.prog === 'hold' || g.prog === 'stagger' || g.prog === 'drop') o.add('delay');
	if(g.prog === 'lurk' || g.prog === 'arc' || g.term === 'burstNear' || g.term === 'expandBurst') o.add('condition');
	return [ ...o ];
};
function tagsOf(g, s){
	const t = [];
	if(g.struct === 'single' && g.shape && /lance|arrow|spike/.test(g.shape) && g.prog === 'direct') t.push('precision');
	if(g.struct !== 'single' && g.prog !== 'lurk') t.push('multi-branch');
	if(g.prog === 'stagger' || (g.prog === 'hold' && g.struct !== 'single')) t.push('timed-convergence');
	if(g.prog === 'lurk') t.push('area-denial');
	if(g.term !== 'none') t.push('burst');
	if(g.prog === 'guided') t.push('pursuit');
	if(g.prog === 'arc') t.push('flanking');
	if(g.prog === 'drop') t.push('overhead');
	if(s.cells > 220) t.push('wide-coverage');
	return t;
}

/* delete runes one at a time while the bug still shows: the smallest tree that reproduces it */
function minimise(g, def, bug){
	let cur = JSON.parse(JSON.stringify(def));
	const still = (d) => { const r = runOnce(d, bug.run.split('@')[0], +bug.run.split('@')[1], 991); return bugsOf({ [bug.run]: r }).some(b => b.kind === bug.kind); };
	let changed = true, guard = 0;
	while(changed && guard++ < 30){
		changed = false;
		for(const id of Object.keys(cur.nodes)){
			if(id === cur.rootId) continue;
			const n = cur.nodes[id];
			const kids = Object.values(cur.nodes).filter(q => q.parent === id);
			const trial = JSON.parse(JSON.stringify(cur));
			delete trial.nodes[id];
			for(const k of kids) trial.nodes[k.id].parent = n.parent;
			const v = ME.validate(trial, PROFILE);
			if(!v.ok) continue;
			if(still(trial)){ cur = trial; changed = true; break; }
		}
	}
	return cur;
}

/* ---------- the sweep ---------- */
function main(){
	fs.mkdirSync(OUT, { recursive: true });
	const R = S.rng(SEED);
	const seen = new Set();
	const catalog = [], rejected = { invalid: 0, technique: 0, output: 0, reserve: 0, duplicate: 0 }, rejectNotes = [];
	const bugs = [];
	const t0 = Date.now();
	let tries = 0, idx = 0;
	while(catalog.length + rejected.invalid + rejected.technique + rejected.output + rejected.reserve < COUNT && tries++ < COUNT * 20){
		const g = randomGenome(R), k = key(g);
		if(seen.has(k)){ rejected.duplicate++; continue; }
		seen.add(k);
		const id = 'RD-' + String(++idx).padStart(4, '0');
		const def = build(id, treeOf(g));
		const tf = techFree(def);
		if(tf){ rejected.technique++; rejectNotes.push({ id, why: tf }); continue; }
		const v = ME.validate(def, PROFILE);
		if(!v.ok){ rejected.invalid++; rejectNotes.push({ id, why: v.errors[0] ? v.errors[0].code + ': ' + v.errors[0].text : 'invalid' }); continue; }
		if(Object.keys(v.techniques || {}).length){ rejected.technique++; continue; }
		if(v.peakOutput > PROFILE.maxOutput){ rejected.output++; rejectNotes.push({ id, why: 'peak output ' + Math.round(v.peakOutput) + ' > ' + PROFILE.maxOutput }); continue; }
		if(v.upfront > PROFILE.maxEnergy){ rejected.reserve++; continue; }
		const runs = evaluate(def, SEED * 7 + idx * 31);
		const s = summarise(runs);
		const b = bugsOf(runs);
		// reproducible: the same seed, the same result (one run checked twice)
		const k0 = Object.keys(runs)[3], again = runOnce(def, k0.split('@')[0], +k0.split('@')[1], SEED * 7 + idx * 31 + 3);
		const repro = again.hit === runs[k0].hit && Math.abs(again.dmg - runs[k0].dmg) < 1e-6;
		const entry = { id, genome: g, ops: OPS(g), tags: tagsOf(g, s), runes: Object.keys(def.nodes).length, cost: Math.round(v.upfront), peakOutput: Math.round(v.peakOutput),
			stats: s, reproducible: repro, bugs: b.map(x => x.kind), def };
		catalog.push(entry);
		for(const x of b) bugs.push(Object.assign({ id }, x, { genome: g }));
		if(catalog.length % 50 === 0) process.stdout.write('  ' + catalog.length + ' evaluated (' + Math.round((Date.now() - t0) / 1000) + ' s)\n');
	}
	// minimise one example of each kind of bug
	const repros = [];
	const kinds = new Set();
	for(const bug of bugs){
		if(kinds.has(bug.kind)) continue; kinds.add(bug.kind);
		const e = catalog.find(c => c.id === bug.id);
		try { const d = minimise(bug.genome, e.def, bug); repros.push({ kind: bug.kind, from: bug.id, run: bug.run, detail: bug.detail, runes: Object.keys(d.nodes).length, def: d }); } catch(err){ repros.push({ kind: bug.kind, from: bug.id, error: err.message }); }
	}
	// ranking: what holds up against MOVING players, per unit of energy, without bugs
	const clean = catalog.filter(c => !c.bugs.length && c.reproducible);
	for(const c of clean){
		const s = c.stats;
		c.score = +(s.hitMoving * 2 + Math.min(2, s.dmgMoving / 120) + Math.min(1, s.cells / 300) * 0.5 - Math.max(0, c.cost - 300) / 600 + c.ops.length * 0.08).toFixed(3);
	}
	clean.sort((a, b) => b.score - a.score);
	// baseline: the plainest precision shot in the catalog (for "is this more than an ordinary projectile?")
	const plain = clean.filter(c => c.genome.struct === 'single' && c.genome.prog === 'direct' && c.genome.term === 'none');
	const base = plain.length ? Math.max(...plain.map(c => c.stats.hitMoving)) : 0;
	for(const c of clean) c.beatsPlainShot = +(c.stats.hitMoving - base).toFixed(2);

	const manifest = {
		generated: new Date().toISOString(), engine: 'magic-engine.js (CONFIG.maxRunes ' + ME.CONFIG.maxRunes + ', rawMaxSpeed ' + ME.CONFIG.rawMaxSpeed + ')',
		profile: Object.assign({}, PROFILE_STATS, { maxOutput: PROFILE.maxOutput, runeCapacity: PROFILE.runeCapacity, maxEnergy: PROFILE.maxEnergy }),
		allowedRunes: ALLOWED_RUNES, allowedConditions: ALLOWED_CONDS, forbiddenRunes: FORBIDDEN_RUNES,
		grammar: { AMOUNTS, SHAPES: SHAPES.map(s => s || 'raw'), POWERS, FORMS, COUNTS, MOTIONS, PROGS, TERMS },
		arena: 'Mage Arena (9000 × floor 2340, 7 platforms)', policies: POLICY_KEYS.map(k => ({ key: k, name: S.POLICIES[k].name })), distances: DISTANCES,
		runFrames: RUN_FRAMES, tailFrames: TAIL_FRAMES, seed: SEED
	};
	const summary = {
		seed: SEED, requested: COUNT, evaluated: catalog.length, rejected, seconds: Math.round((Date.now() - t0) / 1000),
		clean: clean.length, withBugs: catalog.filter(c => c.bugs.length).length, notReproducible: catalog.filter(c => !c.reproducible).length,
		plainShotHitMoving: base,
		top: clean.slice(0, 25).map(c => ({ id: c.id, score: c.score, tags: c.tags, ops: c.ops, cost: c.cost, hitMoving: c.stats.hitMoving, dmgMoving: c.stats.dmgMoving, cells: c.stats.cells, beatsPlainShot: c.beatsPlainShot })),
		byTag: {}
	};
	for(const c of clean) for(const t of c.tags){ const b = summary.byTag[t] = summary.byTag[t] || { n: 0, best: null }; b.n++; if(!b.best) b.best = c.id; }
	const coverageRep = { opsSeen: {}, policyHitRates: {} };
	for(const c of catalog){ for(const o of c.ops) coverageRep.opsSeen[o] = (coverageRep.opsSeen[o] || 0) + 1; for(const p in c.stats.byPolicy){ const q = coverageRep.policyHitRates[p] = coverageRep.policyHitRates[p] || []; q.push(c.stats.byPolicy[p].hitRate); } }
	for(const p in coverageRep.policyHitRates) coverageRep.policyHitRates[p] = +S.mean(coverageRep.policyHitRates[p]).toFixed(3);
	const perf = { meanUpdateMs: +S.mean(catalog.map(c => c.stats.ms)).toFixed(3), worstUpdateMs: Math.max(...catalog.map(c => c.stats.maxMs)), peakBodies: Math.max(...catalog.map(c => c.stats.peak)),
		slowest: catalog.slice().sort((a, b) => b.stats.maxMs - a.stats.maxMs).slice(0, 10).map(c => ({ id: c.id, maxMs: c.stats.maxMs, peak: c.stats.peak })) };
	const write = (f, o) => fs.writeFileSync(path.join(OUT, f), JSON.stringify(o, null, 1));
	write('capability-manifest.json', manifest);
	write('catalog.json', catalog);
	write('campaign-summary.json', summary);
	write('coverage.json', coverageRep);
	write('performance.json', perf);
	write('bugs.json', { bugs, minimisedRepros: repros, rejectNotes: rejectNotes.slice(0, 200) });
	console.log(JSON.stringify({ evaluated: catalog.length, clean: clean.length, rejected, seconds: summary.seconds, base, top: summary.top.slice(0, 8).map(t => t.id + ' ' + t.score + ' ' + t.tags.join('/')) }, null, 1));
}
if(require.main === module) main();
module.exports = { treeOf, runOnce, evaluate, summarise, PROFILE, PROFILE_STATS, techFree };
