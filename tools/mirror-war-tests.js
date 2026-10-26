/* Mirror War — acceptance checks.   node tools/mirror-war-tests.js
   Real engine, real casts. Covers the design guide's list: structure, five families, sequence, energy accounting, every vow completing / failing /
   expiring, split and merge with vow-bearing bodies, interruption, branch failure, load and cleanup, and the comparison with smaller spells. */
'use strict';
const path = require('path'), fs = require('fs');
const dir = path.join(__dirname, '..');
const SIM = require('./mirror-war-sim.js');
const MW = require('./mirror-war.js');
const ME = globalThis.MagicEngine;
const { runScenario, mkEnemy, profile, FAMS, SMALL } = SIM;
const out = [];
const ok = (name, pass, detail) => out.push({ name, pass: !!pass, detail: detail || '' });
const copy = (o) => JSON.parse(JSON.stringify(o));
const fm = (x, d) => Number(x).toFixed(d == null ? 0 : d);
const base = MW.build(), E = MW.T.energy;
const kidsOf = (sp, id) => Object.values(sp.nodes).filter(n => n.parent === id).sort((a, b) => a.order - b.order);
const findVow = (sp, key, nth) => Object.values(sp.nodes).filter(n => n.type === 'vow' && n.params.vow === key).sort((a, b) => a.id < b.id ? -1 : 1)[nth || 0];
function insertAfter(sp, id, type, params){
	const kids = kidsOf(sp, id), n = ME.makeNode(type, id, 's', 0, 0, 0);
	n.id = 'ins' + Object.keys(sp.nodes).length; Object.assign(n.params, params || {}); sp.nodes[n.id] = n;
	for(const k of kids) k.parent = n.id;
	return n;
}
const stateOf = (s, key) => s.vows.filter(v => v.key === key).map(v => v.state);

/* ---------- structure ---------- */
{
	const need = Math.ceil((Object.keys(base.nodes).length - 10) / 3), profOk = profile(50, need), profLow = profile(50, need - 1);
	const r18 = ME.validate(base, profOk), r17 = ME.validate(base, profLow);
	const n = Object.keys(base.nodes).length;
	ok('Valid serialized rune tree: no validation errors at Energy Control ' + need, r18.ok && !(r18.errors || []).length, (r18.errors || []).map(e => e.text).join('; '));
	ok('Rune capacity is the only gate: Control ' + (need - 1) + ' is refused, Control ' + need + ' casts (window.MIRROR_WAR_NEED_CONTROL = ' + need + ')', !r17.ok && r17.errors.some(e => e.code === 'CAPACITY') && need === 17, n + ' runes · capacity ' + profLow.runeCapacity + ' / ' + profOk.runeCapacity);
	ok('One parent per rune, no loops, everything reachable', ME.structureErrors(base).length === 0);
	ok('Only real rune types (no invented runes)', Object.values(base.nodes).every(x => ME.Runes[x.type]), [...new Set(Object.values(base.nodes).map(x => x.type))].join(', '));
	ok('Within the engine rune cap (' + ME.CONFIG.maxRunes + ')', n <= ME.CONFIG.maxRunes, n + ' runes');
	const rt = copy(base), nm = ME.normalize(rt);
	ok('Survives normalize() + JSON round-trip unchanged (a slot can hold it)', !!nm && Object.keys(nm.nodes).length === n && JSON.stringify(ME.normalize(copy(base))) === JSON.stringify(nm));
	let file = null; try { const sb = { window: {} }; new Function('window', fs.readFileSync(path.join(dir, 'mirror-war-spell.js'), 'utf8'))(sb.window); file = sb.window.MIRROR_WAR_SPELL; } catch(e){ file = null; }
	ok('mirror-war-spell.js is exactly what the builder produces', file && JSON.stringify(file) === JSON.stringify(base), file ? 'in sync' : 'missing — run: node tools/mirror-war.js --write');
	const types = {}; for(const x of Object.values(base.nodes)) types[x.type] = (types[x.type] || 0) + 1;
	ok('Uses only existing connectors (Instant, Delay) — no conditions assumed', Object.values(base.nodes).every(x => !x.link || x.link.mode === 'instant' || x.link.mode === 'delay'), JSON.stringify(types));
}

/* ---------- families, sequence, energy ---------- */
const stat700 = runScenario(base, { enemies: [mkEnemy('still', 700)], secs: 10 });
{
	const L = stat700.launched, T = stat700.launchT;
	ok('Five families launch 3 / 2 / 3 / 2 / 3 projectiles', L.vanguard === 3 && L.sweepers === 2 && L.crossfire === 3 && L.reserves === 2 && L.executors === 3, FAMS.map(f => f + ' ' + L[f]).join(' · '));
	const ord = FAMS.map(f => T.hasOwnProperty(f) ? T[f] : 99);
	ok('Fired in sequence: Vanguard → Sweepers → Crossfire → Reserves → Executors', ord.every((t, i) => i === 0 || t > ord[i - 1]), FAMS.map(f => f + ' ' + fm(T[f], 2) + 's').join(' · '));
	const A = stat700.alloc, tot = FAMS.reduce((s, f) => s + (A[f] || 0), 0);
	ok('Energy is divided, never duplicated: shapes formed hold ≤ Generate', tot <= E && tot > E * 0.85, fm(tot) + ' of ' + E);
	ok('Executors hold the largest share, Reserves the smallest, order E > S > C > V > R', A.executors > A.sweepers && A.sweepers > A.crossfire && A.crossfire > A.vanguard && A.vanguard > A.reserves, FAMS.map(f => f + ' ' + fm(100 * A[f] / tot, 1) + '%').join(' · '));
	ok('Reserves still carry real energy (≥ 8% of E at launch)', stat700.launchAmt.reserves >= E * 0.08, fm(stat700.launchAmt.reserves) + ' E');
	const launched = FAMS.reduce((s, f) => s + stat700.launchAmt[f], 0);
	ok('Nothing created from nothing: launch energy ≤ Generate (vow bonus is separate)', launched <= E, fm(launched) + ' ≤ ' + E + ' · vow bonus ' + stat700.bonus + ' E recorded apart');
}

/* ---------- misses, branch failure, interruption ---------- */
{
	const far = runScenario(base, { enemies: [mkEnemy('still', -3000)], secs: 6 });
	ok('Sequence never waits for a hit: with nothing to hit, all 13 still launch on time', FAMS.reduce((s, f) => s + far.launched[f], 0) === 13 && far.dmg === 0 && Math.abs(far.launchT.executors - stat700.launchT.executors) < 0.05, 'launched ' + FAMS.reduce((s, f) => s + far.launched[f], 0));
	const broken = copy(base);
	const h = Object.values(broken.nodes).find(n => n.type === 'compress' && n.params.shape === 'point'); h.params.power = 30;      // starves a harrier: it collapses
	const bs = runScenario(broken, { enemies: [mkEnemy('still', 700)], secs: 8 });
	ok('One branch failing (a collapsed harrier) leaves the other families untouched', bs.launched.crossfire === 3 && bs.launched.executors === 3 && bs.launched.sweepers === 2 && bs.dmg > 0, 'launched ' + FAMS.map(f => bs.launched[f]).join('/') + ' · dmg ' + fm(bs.dmg));
	const dfl = runScenario(base, { enemies: [mkEnemy('still', 700)], secs: 9, deflect: true });
	ok('A deflecting enemy: the light projectiles are turned, the spears still strike', dfl.deflected >= 8 && dfl.byFam.executors > 0 && dfl.byFam.vanguard === 0, 'turned ' + dfl.deflected + ' · spear dmg ' + fm(dfl.byFam.executors));
	const cut = runScenario(base, { enemies: [mkEnemy('still', 700)], secs: 8, cancelAt: 1.2 });
	ok('Interrupted before the final volley: no executor ever launches, nothing lingers', cut.launched.executors === 0 && cut.liveAtEnd === 0, 'bodies left ' + cut.liveAtEnd);
	const early = runScenario(base, { enemies: [mkEnemy('still', 700)], secs: 6, cancelAt: 0.05 });
	ok('Cancelled before anything lands: no vow pays, no bonus', early.vows.every(v => v.state !== 'paid') && early.bonus === 0, early.vows.map(v => v.state).join(','));
}

/* ---------- vows: complete / fail / expire ---------- */
{
	const s = stat700;
	ok('Unerring Path pays on a long straight flight (700 px)', stateOf(s, 'unerring').includes('paid'), stateOf(s, 'unerring').join(','));
	const near = runScenario(base, { enemies: [mkEnemy('still', 250)], secs: 8 });
	ok('Unerring Path: struck after under 250 px earns nothing (ended, not paid)', stateOf(near, 'unerring').filter(x => x === 'paid').length === 0 && stateOf(near, 'unerring').includes('ended'), stateOf(near, 'unerring').join(','));
	const dfl = runScenario(base, { enemies: [mkEnemy('still', 700)], secs: 9, deflect: true });
	ok('Unerring Path breaks when the path is changed (deflected)', stateOf(dfl, 'unerring').includes('broken'), dfl.vows.filter(v => v.key === 'unerring').map(v => v.state + ' ' + v.why).join(' | '));
	const slow = runScenario(base, { enemies: [mkEnemy('slow', 700)], secs: 9 });
	ok('Long Journey pays after 350 / 500 px', stateOf(slow, 'journey').filter(x => x === 'paid').length >= 1, stateOf(slow, 'journey').join(','));
	ok('Long Journey breaks if it strikes too soon (enemy at 250 px)', stateOf(near, 'journey').filter(x => x === 'broken').length >= 1, near.vows.filter(v => v.key === 'journey').map(v => v.state + ' ' + v.why).join(' | '));
	ok('Absolute Compression pays (compression 10 reached and held)', stateOf(s, 'compression').includes('paid'), stateOf(s, 'compression').join(','));
	const lv = copy(base); findVow(lv, 'compression').params.compression_level = 14;
	const lvs = runScenario(lv, { enemies: [mkEnemy('still', 700)], secs: 9 });
	ok('Absolute Compression breaks if the level is never reached (14 > 10): no pretend payout', stateOf(lvs, 'compression').includes('broken') && !stateOf(lvs, 'compression').includes('paid'), lvs.vows.filter(v => v.key === 'compression').map(v => v.state + ' ' + v.why).join(' | '));
	ok('Solitude pays: the spear stayed one body', stateOf(s, 'solitude').includes('paid'), stateOf(s, 'solitude').join(','));
	const so = copy(base); insertAfter(so, findVow(so, 'solitude').id, 'divide', { count: 2, formation: 'cluster', spacing: 0, motion: 'keep' });
	const sos = runScenario(so, { enemies: [mkEnemy('still', 700)], secs: 9 });
	ok('Solitude breaks if the energy is divided', stateOf(sos, 'solitude').includes('broken') && !stateOf(sos, 'solitude').includes('paid'), sos.vows.filter(v => v.key === 'solitude').map(v => v.state + ' ' + v.why).join(' | '));
	const pat = runScenario(base, { enemies: [mkEnemy('still', 120)], secs: 6 });
	const waveEarly = pat.log.filter(x => x.shape === 'wave' && x.t < 1.0).length;
	ok('Patience: the waiting wave passes through harmlessly until its wait is over', waveEarly === 0, 'wave hits before 1.0 s: ' + waveEarly);
	const waveLate = stat700.log.filter(x => x.shape === 'wave');
	ok('Patience pays once, only for a hit after the wait', stateOf(stat700, 'patience').filter(x => x === 'paid').length === 1 && waveLate.length >= 1 && waveLate[0].t >= 1.0, stateOf(stat700, 'patience').join(',') + ' · first wave hit ' + (waveLate[0] ? fm(waveLate[0].t, 2) + ' s' : '—'));
	ok('No contract ever pays twice (ids unique, ≤ 1 paid state each, 7 contracts)', [stat700, near, slow].every(r => r.contracts.length === 7 && new Set(r.contracts.map(c => c.id)).size === 7), '7 contracts per cast');
	// expire: a vow that never gets its chance simply ends
	const far = runScenario(base, { enemies: [mkEnemy('still', -3000)], secs: 14 });
	ok('Vows with nothing to strike expire without paying', far.vows.every(v => v.state !== 'paid') && far.bonus === 0 && far.liveAtEnd === 0, far.vows.map(v => v.state).join(','));
}

/* ---------- split and merge with vow-bearing bodies ---------- */
{
	const sp = copy(base), un = findVow(sp, 'unerring', 0);
	insertAfter(sp, un.id, 'split', { share: 0, spread: 0 }); const sid = 'ins' + (Object.keys(sp.nodes).length - 1);
	const sNode = Object.values(sp.nodes).find(n => n.type === 'split' && n.parent === un.id);
	// the split needs two children: a mirror of the harrier's (empty) tail
	for(let i = 0; i < 2; i++){ const c = ME.makeNode('color', sNode.id, 's', 0, 0, i); c.id = 'sp' + i; c.params.color = 'azure'; sp.nodes[c.id] = c; }
	const r = runScenario(sp, { enemies: [mkEnemy('still', 700)], secs: 9 });
	const un0 = r.contracts.filter(c => c.V.key === 'unerring');
	ok('A vow before a Split: the halves share ONE contract (still 2 Unerring contracts, not 3) and each pays at most once', un0.length === 2 && new Set(un0.map(c => c.id)).size === 2 && un0.every(c => c.state !== 'paid' || (c.paid > 0 && c.paid <= 0.62 * 20 + 1)) && r.contracts.length === new Set(r.contracts.map(c => c.id)).size, 'unerring states ' + un0.map(c => c.state + (c.paid ? ' +' + Math.round(c.paid) : '')).join(', '));
	// merge two vow-bearing bodies mid-flight
	Math.random = SIM.rng(5);
	const W = ME.createWorld(); const e = mkEnemy('still', 700); const caster = { x: 90, y: 40, w: 20, h: 60, vx: 0, vy: 0, hp: 100, maxHp: 100 };
	const host = { mouseWorld: () => ({ x: 700, y: 70 }), getEnemies: () => [e], isSolid: () => false, inBounds: (x, y) => x > -800 && x < 4000 && y > -800 && y < 1500, damageEnemy: (en, d) => { en.taken += d; }, vowText() {} };
	W.cast(base, { profile: profile(), owner: { id: 'p', entity: caster }, host });
	for(let i = 0; i < 14; i++) W.update(1 / 60, host);
	const vb = W.bodies.filter(b => b.alive && b.vows && b.vows.some(c => c.V.key === 'unerring'));
	let merged = false, info = '';
	if(vb.length >= 2){
		const share0 = vb.map(b => b.vowShare || 0);
		W.T.merge(vb[0], vb[1]);
		merged = vb[0].alive && !vb[1].alive && vb[0].vows.length === new Set(vb[0].vows).size && vb[0].vows.filter(c => c.V.key === 'unerring').length === 2;
		info = 'merged body carries ' + vb[0].vows.length + ' contracts (' + vb[0].vows.map(c => c.V.key).join(',') + ')';
	}
	for(let i = 0; i < 60 * 8; i++) W.update(1 / 60, host);
	const cs = new Map(); for(const c of (W.vows || [])) cs.set(c.id, c); for(const c of W.vowHistory()) cs.set(c.id, c);
	const paidTwice = [...cs.values()].filter(c => c.state === 'paid').length > new Set([...cs.values()].filter(c => c.state === 'paid').map(c => c.id)).size;
	const mergedBody = vb[0];
	ok('Merging two vow-bearing bodies keeps each contract once; no duplicated history or payout', merged && !paidTwice && (!mergedBody || (mergedBody.vowShare || 0) <= 0.6 + 1e-9), info);
	Math.random = Math.random;
}

/* ---------- load and cleanup ---------- */
{
	Math.random = SIM.rng(9);
	const W = ME.createWorld(); const es = [mkEnemy('fast', 700, 3), mkEnemy('slow', 900)];
	const caster = { x: 90, y: 40, w: 20, h: 60, vx: 0, vy: 0, hp: 100, maxHp: 100 };
	const host = { mouseWorld: () => ({ x: es[0].x, y: es[0].y + 30 }), getEnemies: () => es, isSolid: () => false, inBounds: (x, y) => x > -800 && x < 4000 && y > -800 && y < 1500, damageEnemy: (en, d) => { en.taken += d; }, vowText() {} };
	const prof = profile(50, 20);
	let casts = 0; for(let k = 0; k < 6; k++){ const r = W.cast(base, { profile: prof, owner: { id: 'p', entity: caster }, host }); if(r && r.ok !== false) casts++; }
	let peak = 0, maxMs = 0, sum = 0, n = 0;
	for(let i = 0; i < 60 * 16; i++){
		for(const e of es) e.step(i / 60, 1 / 60);
		const t = process.hrtime.bigint(); W.update(1 / 60, host); const ms = Number(process.hrtime.bigint() - t) / 1e6;
		maxMs = Math.max(maxMs, ms); sum += ms; n++;
		peak = Math.max(peak, W.bodies.filter(b => b.alive).length);
	}
	const left = W.bodies.filter(b => b.alive).length, openV = (W.vows || []).filter(c => c.state === 'active' || c.state === 'ready').length;
	ok('Load: ' + casts + ' Mirror Wars at once stay under the body cap and finish cleanly', casts >= 4 && peak <= ME.CONFIG.maxBodiesGlobal && left === 0 && openV === 0 && W.instances.length === 0, casts + ' casts · peak ' + peak + ' bodies · avg ' + fm(sum / n, 2) + ' ms · worst frame ' + fm(maxMs, 1) + ' ms · bodies left ' + left + ' · open vows ' + openV + ' · instances ' + W.instances.length);
	const one = runScenario(base, { enemies: [mkEnemy('still', 700)], secs: 14 });
	ok('One cast cleans up completely (no bodies, no instance, no open contract)', one.liveAtEnd === 0 && one.W.instances.length === 0 && !(one.W.vows || []).some(c => c.state === 'active' || c.state === 'ready'), 'peak ' + one.peakBodies + ' bodies · worst frame ' + fm(one.maxStepMs, 1) + ' ms');
	Math.random = Math.random;
}

/* ---------- comparison with smaller spells of the same Generate amount ---------- */
{
	const prof = profile();
	const fast = (sp) => { let t = 0; const nrun = 8; for(let k = 0; k < nrun; k++) t += runScenario(sp, { enemies: [mkEnemy('fast', 700, 11 + k * 7)], secs: 9 }).dmg; return t / nrun; };
	const rows = {};
	const all = Object.assign({}, SMALL(E), { 'Mirror War': base });
	for(const k in all){
		const cost = ME.validate(all[k], prof).cost;
		const d = [runScenario(all[k], { enemies: [mkEnemy('still', 700)], secs: 9 }).dmg, runScenario(all[k], { enemies: [mkEnemy('still', 250)], secs: 9 }).dmg, runScenario(all[k], { enemies: [mkEnemy('slow', 700)], secs: 9 }).dmg, fast(all[k])];
		rows[k] = { cost, d, avg: d.reduce((a, b) => a + b, 0) / 4, worst: Math.min(...d) };
		rows[k].eff = rows[k].avg / cost;
	}
	const mw = rows['Mirror War'], others = Object.keys(rows).filter(k => k !== 'Mirror War');
	ok('More capable than the plain smaller spells (average damage above Bolt and Fan)', mw.avg > rows['Energy Bolt'].avg && mw.avg > rows['Fan of five'].avg, fm(mw.avg) + ' vs ' + fm(rows['Energy Bolt'].avg) + ' / ' + fm(rows['Fan of five'].avg));
	ok('…but it does not dominate: some smaller spell beats it on damage per mana', others.some(k => rows[k].eff > mw.eff), others.map(k => k + ' ' + fm(rows[k].eff, 2)).join(' · ') + ' vs ' + fm(mw.eff, 2));
	ok('…and no smaller spell is beaten on every measure (cost, average, worst case, efficiency)', others.every(k => rows[k].cost < mw.cost || rows[k].worst > mw.worst || rows[k].eff > mw.eff), 'Mirror War mana ' + mw.cost);
	global.__cmp = rows;
}

/* ---------- report ---------- */
let bad = 0;
for(const r of out){ if(!r.pass) bad++; console.log((r.pass ? '  ok   ' : '  FAIL ') + r.name + (r.detail ? '  [' + r.detail + ']' : '')); }
if(process.argv.includes('--table')){
	console.log('\n  spell              mana   still@700  still@250       slow   fast(8)      avg   dmg/mana   worst');
	for(const k in global.__cmp){ const r = global.__cmp[k]; console.log('  ' + k.padEnd(18) + String(r.cost).padStart(5) + r.d.map(x => String(fm(x)).padStart(11)).join('') + String(fm(r.avg)).padStart(9) + String(fm(r.eff, 2)).padStart(11) + String(fm(r.worst)).padStart(8)); }
}
console.log('\n' + (out.length - bad) + ' / ' + out.length + ' checks passed');
process.exit(bad ? 1 : 0);
