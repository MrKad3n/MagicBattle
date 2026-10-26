/* Mirror War — simulation & balance report.   node tools/mirror-war-sim.js
   Runs the real rune engine headless (the same world the game uses) against the enemy behaviours the design guide lists,
   attributing every hit to a projectile family by its shape, and checks vows / energy accounting / cleanup / load. */
'use strict';
const path = require('path');
const dir = path.join(__dirname, '..');
require(path.join(dir, 'magic-engine.js')); require(path.join(dir, 'magic-techniques.js')); require(path.join(dir, 'magic-vows.js'));
const ME = globalThis.MagicEngine;
const MW = require('./mirror-war.js');

/* deterministic randomness (sparks and enemy wobble) */
function rng(seed){ return function(){ seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const realRandom = Math.random;
const FAMILY = { point: 'vanguard', wave: 'sweepers', cone: 'sweepers', arrow: 'crossfire', disc: 'reserves', star: 'reserves', lance: 'executors' };
const FAMS = ['vanguard', 'sweepers', 'crossfire', 'reserves', 'executors'];

function profile(P, ctl){ const p = ME.deriveProfile({ magicPower: P || 50, magicControl: ctl || 20, maxMana: 4000 }); p.techniquePoints = 20; p.allocations = {}; return p; }

/* enemies: x is its centre line; step(t, dt) moves it */
function mkEnemy(kind, x, seed){
	const r = rng(seed || 7);
	const e = { kind, x, y: 40, w: 30, h: 60, hp: 1e9, maxHp: 1e9, vx: 0, vy: 0, taken: 0, x0: x, dir: 1, nextTurn: 0, speed: 0 };
	e.step = (t, dt) => {
		if(kind === 'slow'){ e.x += 60 * dt * e.dir; if(Math.abs(e.x - e.x0) > 140) e.dir *= -1; }
		else if(kind === 'fast'){
			if(t >= e.nextTurn){ e.dir = r() < 0.5 ? -1 : 1; e.speed = 180 + r() * 160; e.nextTurn = t + 0.25 + r() * 0.5; if(e.y >= 40 && r() < 0.45) e.vy = -13; }
			e.y += e.vy; e.vy += 0.75; if(e.y >= 40){ e.y = 40; e.vy = 0; }      // it jumps as well as running
			e.x += e.speed * dt * e.dir;
			if(e.x > e.x0 + 260){ e.x = e.x0 + 260; e.dir = -1; }
			if(e.x < e.x0 - 260){ e.x = e.x0 - 260; e.dir = 1; }
		}
	};
	return e;
}

function runScenario(spell, opts){
	opts = opts || {};
	Math.random = rng(1234);
	const W = ME.createWorld();
	const caster = { x: 90, y: 40, w: 20, h: 60, vx: 0, vy: 0, hp: 100, maxHp: 100 };
	const enemies = opts.enemies || [mkEnemy('still', 700)];
	const trail = [];                                   // a cursor that lags the enemy a little (human aim)
	const lag = opts.lag == null ? 12 : opts.lag;
	const fam = opts.famOf || ((b) => FAMILY[b.shape] || 'other');
	const stats = { alloc: {}, dmg: 0, byFam: {}, hits: {}, launched: {}, seen: new Map(), launchAmt: {}, peakBodies: 0, launchT: {}, lastHit: 0, firstHit: null, vows: [] };
	for(const f of FAMS.concat(['other'])){ stats.byFam[f] = 0; stats.hits[f] = 0; stats.launched[f] = 0; stats.launchAmt[f] = 0; }
	let now = 0;
	const host = {
		mouseWorld: () => { const e = enemies[0]; const c = trail.length > lag ? trail[trail.length - 1 - lag] : { x: e.x, y: e.y + 30 }; return { x: c.x, y: c.y }; },
		getEnemies: () => enemies.filter(e => e.hp > 0), isSolid: () => false, inBounds: (x, y) => x > -800 && x < 4000 && y > -800 && y < 1500,
		damageEnemy: (e, d) => {
			e.hp -= d; e.taken += d; stats.dmg += d;
			const b = W.hitSrc, f = b ? fam(b) : 'other';
			stats.byFam[f] = (stats.byFam[f] || 0) + d;
			const s = b ? stats.seen.get(b.id) : null;
			if(s && !s.hit){ s.hit = true; stats.hits[f]++; }
			stats.log.push({ t: now, shape: b ? b.shape : null, d });
			stats.lastHit = now; if(stats.firstHit == null) stats.firstHit = now;
		},
		vowText: () => {}
	};
	stats.log = [];
	const owner = { id: 'p', entity: caster };
	const r = W.cast(spell, { profile: opts.profile || profile(), owner, host });
	const frames = Math.round((opts.secs || 8) * 60);
	const t0 = process.hrtime.bigint();
	let maxStepMs = 0;
	for(let i = 0; i < frames; i++){
		now = i / 60;
		for(const e of enemies) e.step(now, 1 / 60);
		trail.push({ x: enemies[0].x, y: enemies[0].y + 30 });
		if(opts.deflect){
			for(const b of W.bodies){
				if(!b.alive || b.defl || b.amount >= 28) continue;      // the deflector only turns projectiles under 28 E (the harriers, arrows and reserves — not the spears)
				if(Math.hypot(b.x - enemies[0].x, b.y - 70) < 80 && Math.hypot(b.vx, b.vy) > 1){ b.vx = -b.vx; b.vy = -b.vy * 0.6; b.defl = true; stats.deflected = (stats.deflected || 0) + 1; }
			}
		}
		if(opts.cancelAt != null && i === Math.round(opts.cancelAt * 60)){ if(W.clearOwner) W.clearOwner('p'); stats.cancelled = true; }
		const ts = process.hrtime.bigint();
		W.update(1 / 60, host);
		maxStepMs = Math.max(maxStepMs, Number(process.hrtime.bigint() - ts) / 1e6);
		let live = 0;
		for(const b of W.bodies){
			if(!b.alive || b.isZone || b.zoneBlob) continue;
			live++;
			const f = fam(b), sp = Math.hypot(b.vx, b.vy);
			let s = stats.seen.get(b.id);
			if(!s){ s = { born: now }; stats.seen.set(b.id, s); }
			s.f = f; s.amt = b.amount; s.share = b.vowShare || 0;
			if(f !== 'other' && !s.launched && sp > 1.2){
				s.launched = true; s.launchAmt = b.amount; s.launchT = now; stats.launched[f]++; stats.launchAmt[f] += b.amount;
				if(stats.launchT[f] == null) stats.launchT[f] = now;
			}
		}
		if(i === 2){ for(const b of W.bodies){ if(!b.alive || b.isZone) continue; const f = fam(b); if(f !== 'other') stats.alloc[f] = (stats.alloc[f] || 0) + b.amount; } }
		stats.peakBodies = Math.max(stats.peakBodies, live);
	}
	stats.ms = Number(process.hrtime.bigint() - t0) / 1e6; stats.maxStepMs = maxStepMs;
	stats.liveAtEnd = W.bodies.filter(b => b.alive && !b.isZone && !b.zoneBlob).length;
	const cons = new Map();
	for(const c of (W.vows || [])) cons.set(c.id, c);
	for(const c of W.vowHistory()) cons.set(c.id, c);
	stats.contracts = [...cons.values()];
	stats.vows = stats.contracts.map(c => ({ key: c.V.key, state: c.state, paid: Math.round(c.paid || 0), why: c.why || '' }));
	stats.bonus = stats.vows.reduce((s, v) => s + v.paid, 0);
	stats.report = r; stats.enemies = enemies; stats.W = W; stats.host = host; stats.caster = caster;
	Math.random = realRandom;
	return stats;
}

/* comparison spells: same Generate amount */
function plain(name, E, steps){
	const s = ME.blankSpell(name); let gy = 0, prev = null;
	steps = [['generate', { amount: E }]].concat(steps);
	for(const st of steps){
		let n;
		if(prev == null){ n = s.nodes[s.rootId]; n.type = st[0]; n.params = ME.paramDefaults(st[0]); }
		else { gy++; n = ME.makeNode(st[0], prev, 's', 0, gy, gy); s.nodes[n.id] = n; }
		Object.assign(n.params, st[1] || {}); prev = n.id;
	}
	s.seq = gy + 1; return s;
}
const SMALL = (E) => ({
	'Energy Bolt':     plain('Energy Bolt', E, [['redirect', { toward: 'mouse' }]]),
	'Spear (comp 10)': plain('Spear', E, [['compress', { shape: 'lance', power: 10 }], ['redirect', { toward: 'mouse', speedPct: 75 }]]),
	'Fan of five':     plain('Fan', E, [['divide', { count: 5, formation: 'arc', spacing: 30, motion: 'keep' }], ['redirect', { toward: 'mouse' }]]),
	'Bolt (comp 6)':   plain('Bolt6', E, [['compress', { shape: 'sphere', power: 6 }], ['redirect', { toward: 'mouse' }]]),
	'Fan ×5 (comp 5)': plain('Fan5', E, [['compress', { shape: 'sphere', power: 5 }], ['divide', { count: 5, formation: 'arc', spacing: 30, motion: 'keep' }], ['redirect', { toward: 'mouse' }]])
});

module.exports = { runScenario, mkEnemy, profile, FAMS, FAMILY, SMALL, plain, rng };

if(require.main === module){
	const fmt = (x, d) => Number(x).toFixed(d == null ? 0 : d);
	const E = MW.T.energy;
	const spell = MW.build();
	const prof = profile();
	const rep = ME.validate(spell, prof);
	console.log('=== Mirror War: ' + Object.keys(spell.nodes).length + ' runes · Generate ' + E + ' · mana ' + rep.cost + ' · est. peak output ' + rep.peakOutput + ' · Power 50 / Control 20 ===\n');
	const scen = [
		['stationary @700px', () => [mkEnemy('still', 700)]],
		['stationary @250px', () => [mkEnemy('still', 250)]],
		['slow walker ±140px', () => [mkEnemy('slow', 700)]],
		['fast & erratic ±260px', () => [mkEnemy('fast', 700, 11)]],
		['deflector (turns bodies)', () => [mkEnemy('still', 700)], { deflect: true }],
		['cast cancelled at 1.2 s', () => [mkEnemy('still', 700)], { cancelAt: 1.2 }]
	];
	for(const [name, mk, extra] of scen){
		const s = runScenario(spell, Object.assign({ enemies: mk(), secs: 9 }, extra));
		console.log('— ' + name + ': total damage ' + fmt(s.dmg) + ' · peak bodies ' + s.peakBodies + ' · bodies left ' + s.liveAtEnd + ' · last hit ' + (s.lastHit ? fmt(s.lastHit, 2) + ' s' : '—') + ' · sim ' + fmt(s.ms) + ' ms (max frame ' + fmt(s.maxStepMs, 2) + ' ms)');
		console.log('   family      launched  E formed  E at launch   hit   damage   launched at');
		for(const f of FAMS) console.log('   ' + f.padEnd(11) + String(s.launched[f]).padStart(5) + String(fmt(s.alloc[f] || 0)).padStart(10) + String(fmt(s.launchAmt[f])).padStart(12) + String(s.hits[f]).padStart(8) + String(fmt(s.byFam[f])).padStart(9) + String(s.launchT[f] == null ? '—' : fmt(s.launchT[f], 2) + ' s').padStart(13));
		console.log('   vows: ' + (s.vows.map(v => v.key + ' ' + v.state + (v.paid ? ' +' + v.paid + 'E' : '') + (v.why ? ' (' + v.why + ')' : '')).join(' | ') || 'none'));
		if(s.deflected) console.log('   deflected bodies: ' + s.deflected);
	}
	console.log('\n=== Same Generate amount (' + E + ') — smaller spells vs Mirror War, damage dealt ===');
	const spells = Object.assign({}, SMALL(E), { 'Mirror War': spell });
	const head = ['still @700', 'still @250', 'slow', 'fast (8 runs)'];
	const fastAvg = (sp) => { let t = 0, n = 8; for(let k = 0; k < n; k++) t += runScenario(sp, { enemies: [mkEnemy('fast', 700, 11 + k * 7)], secs: 9 }).dmg; return t / n; };
	const mk4 = [() => [mkEnemy('still', 700)], () => [mkEnemy('still', 250)], () => [mkEnemy('slow', 700)], null];
	console.log('   ' + 'spell'.padEnd(18) + 'mana'.padStart(6) + head.map(h => h.padStart(12)).join('') + 'avg'.padStart(8) + 'dmg/mana'.padStart(10) + 'worst'.padStart(8));
	for(const k in spells){
		const rr = ME.validate(spells[k], prof);
		const d = mk4.map(m => m ? runScenario(spells[k], { enemies: m(), secs: 9 }).dmg : fastAvg(spells[k]));
		const avg = d.reduce((a, b) => a + b, 0) / d.length;
		console.log('   ' + k.padEnd(18) + String(rr.cost).padStart(6) + d.map(x => String(fmt(x)).padStart(12)).join('') + String(fmt(avg)).padStart(8) + String(fmt(avg / rr.cost, 2)).padStart(10) + String(fmt(Math.min(...d))).padStart(8));
	}
}
