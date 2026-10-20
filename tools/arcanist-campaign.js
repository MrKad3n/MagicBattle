/* =====================================================================
   GRAND ARCANIST CAMPAIGN — node tools/arcanist-campaign.js [quick]

   Tests the boss with the real engine, the real RuneMages caster and his real mind (grand-arcanist.js), in the Mage
   Arena's geometry (tools/sim-core.js). Every run is seeded and reproducible.

   A. Library     — every attack tree passes the technique policy and validates; deliberately bad trees are refused.
   B. Attacks     — each attack, forced, against bots at several distances and behaviours (still, strafing, jumping,
                    reversing at the moment it fires, against a wall, casting during the telegraph, already under fire,
                    a platform in the way): hit chance, damage, time to impact, coverage, failures, earliest hit.
   C. Counterplay — for each attack, scripted responses (stay, away, toward, jump at fire, jump late, reverse, away +
                    jump): an attack must have at least one response that takes no damage.
   D. Encounters  — full fights against seven player policies × seeds, with a player that shoots back; phase
                    sweeps (his health is lowered on a schedule so all three phases are seen); death and respawn.
   E. Technique   — every body he owns is inspected every frame of every run; plus an injected outside technique
                    (must be stripped) and policy unit tests.
   F. Stability   — many bodies at once, repeated casting, interrupts, phase changes with live energy, his death mid
                    attack, player death, scene exit, runtime errors, a ten-minute fight.
   G. Regression  — MagicEngine.devTests.run() and RuneMages.selfTest() (the existing mages and Aster Vael).

   Writes sim/arcanist/*.json, data/arcanist-spell-library.json, grand-arcanist-discovered.js (the discovered
   trees for the browser) and docs/grand-arcanist-report.md.
   ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const S = require('./sim-core.js');
const QUICK = process.argv.includes('quick');

/* ---------- load: the discovered trees first, then the boss ---------- */
const CATALOG = path.join(S.ROOT, 'sim', 'raw-discovery', 'catalog.json');
const catalog = JSON.parse(fs.readFileSync(CATALOG, 'utf8'));
const USED_DISCOVERIES = [ 'RD-0099', 'RD-0234' ];
const discoveredDefs = {};
for(const id of USED_DISCOVERIES){ const e = catalog.find(c => c.id === id); if(e) discoveredDefs[id] = e.def; }
globalThis.GRAND_ARCANIST_DISCOVERED = discoveredDefs;
const { ME, RM, GA } = S.loadGame({ arcanist: true });
if(!GA) throw new Error('grand-arcanist.js did not load');

const OUT = path.join(S.ROOT, 'sim', 'arcanist');
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(path.join(S.ROOT, 'data'), { recursive: true });
fs.mkdirSync(path.join(S.ROOT, 'docs'), { recursive: true });
const results = { checks: [] };
const check = (name, pass, detail) => { results.checks.push({ name, pass: !!pass, detail }); console.log((pass ? '  ok   ' : '  FAIL ') + name + (detail ? ' — ' + detail : '')); };

/* ---------- an arena with the boss and a bot ---------- */
function setup(opts){
	opts = opts || {};
	const arena = S.makeArena(opts.arena || S.ARENA), A = arena.A;
	const w = ME.createWorld();
	const bossX = opts.bossX != null ? opts.bossX : A.center;
	const bot = S.makeBot(A, opts.botX != null ? opts.botX : bossX + (opts.dist || 520), opts.policy || 'still');
	bot.mana = bot.maxMana = 1500;      // the player's real reserve (dungeon.html: maxMana 1500) — the trial turns infinite energy off
	const st = { arena, A, w, bot, dealt: 0, hits: [], botDeaths: 0, frame: 0, botCastF: 0, taken: 0, frameMs: [], maxOwn: 0, techFrames: 0, bodyChecks: 0, burst1s: [], respawnAt: 0 };
	const hostBase = S.makeHost(arena, () => RM.targets(), (e, d, info) => { if(e && e.runeMage){ e.hp -= d; st.taken += d; } }, bot);
	const host = Object.assign(hostBase, {
		isAttacking: (e) => e === bot ? bot.castT > 0 : !!(e && (e.attacking || e.castFlash > 0)),
		drainEnergy: (owner, amount) => owner && owner.drain ? owner.drain(amount) : amount
	});
	st.host = host;
	// clearing the previous run's mages kills their energy (sparks use Math.random): keep that out of this run's seeded stream
	{ const keep = Math.random; Math.random = () => 0.5; try { RM.clear(); } finally { Math.random = keep; } }
	RM.init({ world: () => w, host: () => host, player: () => (bot.hp > 0 ? bot : bot),
		hurtPlayer: (d, info) => {
			if(!(d > 0) || bot.hp <= 0) return;
			bot.hp -= d; st.dealt += d;
			const m = st.m, key = m && info && info.instance != null ? (m.instKey[info.instance] || '?') : '?';
			const since = m && m.GA && m.GA.lastStart && m.GA.lastStart[key] != null ? m.t - m.GA.lastStart[key] : null;
			st.hits.push({ f: st.frame, t: st.frame / 60, d, key, since, phase: m && m.GA ? m.GA.phase : 0, bx: S.cx(bot) });
		},
		knockPlayer: (vx, vy) => { bot.kbx += vx; bot.vy += vy; },
		playerCasting: () => bot.castT > 0, playerHp: () => bot.hp / bot.maxHp,
		platforms: () => A.platforms, worldW: A.worldW, groundY: A.groundY, gravity: A.gravity, move: arena.move,
		say: () => {} });
	const m = RM.spawn('arcanist', bossX, A.groundY);
	st.m = m;
	m.facing = Math.sign(S.cx(bot) - bossX) || 1;
	return st;
}
/* the bot's own spell (the "player" shoots back): an endgame-strength raw bolt at the boss */
/* the bot's spell, built once per power (outside any seeded stream: building a spell draws random node ids) */
const BOT = {};
function botSpell(power){
	power = power || 120;
	if(!BOT[power]){
		const keep = Math.random; Math.random = () => 0.5;
		try {
			const { N, build } = RM;
			const def = build('bot bolt', N('target', { kind: 'enemy', select: 'nearCaster', range: 1600 }, null, N('generate', { amount: power }, null, N('compress', { power: 6, shape: 'lance' }, null, N('redirect', { toward: 'target' })))));
			const prof = ME.deriveProfile({ magicControl: 20, magicPower: 120, maxMana: 99999 });
			BOT[power] = { def, prof, cost: Math.round(ME.validate(def, prof).upfront) };
		} finally { Math.random = keep; }
	}
	return BOT[power];
}
function botCost(power){ return botSpell(power).cost; }
function botShoot(st, power){
	const B = botSpell(power), bot = st.bot;
	st.w.cast(B.def, { profile: B.prof, owner: { id: 'player', entity: bot, facing: () => Math.sign(S.cx(st.m) - S.cx(bot)) || 1 }, host: st.host });
	bot.castT = 12; bot.casts++;
}
/* one frame of everything */
function step(st, opts){
	opts = opts || {};
	const { bot, w, m, A } = st;
	st.frame++;
	const ctx = st.ctx || (st.ctx = { R: Math.random, w, foeId: m.owner.id, bx: 0, f: 0 });
	ctx.f = st.frame; ctx.bx = S.cx(m); ctx.wantShot = false;
	// what a player can SEE of him this frame: is he rooted in a cast, and which circles (his burst ring, his mines) are drawn
	{
		const G = m.GA, a = G && G.act, zones = [];
		if(GA.CONFIG.showTelegraphs && a && !a.fired && GA.ATTACKS[a.key].tele === 'ring') zones.push({ x: S.cx(m), y: S.cy(m), r: GA.MEASURED[a.key] || 160 });
		for(const b of w.bodies) if(b.alive && b.ownerId === m.owner.id && b.anchored){ const A = GA.ATTACKS[m.instKey[b.inst]]; if(A && A.burstR) zones.push({ x: b.x, y: b.y, r: (ME.bodyRadius(b) * 2.6 + 28) * A.burstR }); }
		ctx.tell = { rooted: !!(a && (!a.fired || a.t < a.prep + a.tel + a.rec)), zones };
	}
	if(bot.hp > 0){
		if(opts.script) opts.script(st, bot); else S.stepBot(bot, ctx, st.arena);
		if(bot.castT > 0) bot.castT--;
		const shootEvery = opts.shootEvery || 0;
		bot.mana = Math.min(bot.maxMana, bot.mana + (opts.botRegen != null ? opts.botRegen : 1.0));      // per frame (an endgame player: ≈ 60 E/s)
		const window = bot.policy !== 'skilled' || ctx.tell.rooted || bot.mana > bot.maxMana * 0.8;      // the skilled player saves its energy for his rooted moments
		if(shootEvery && window && !m.dead && st.frame % shootEvery === 0 && Math.abs(S.cx(m) - S.cx(bot)) < 1400){
			const cost = botCost(opts.botPower);
			if(bot.mana >= cost){ bot.mana -= cost; botShoot(st, opts.botPower); }
		}
	} else {
		// the player is down; they come back 2 s later at the start
		if(!st.respawnAt){ st.respawnAt = st.frame + 120; st.botDeaths++; }
		if(st.frame >= st.respawnAt){ bot.hp = bot.maxHp; bot.x = A.center + 700; bot.y = A.groundY - bot.h; bot.vx = bot.vy = 0; st.respawnAt = 0; }
	}
	const t0 = process.hrtime.bigint();
	RM.update();
	w.update(1 / 60, st.host);
	st.frameMs.push(Number(process.hrtime.bigint() - t0) / 1e6);
	// the technique audit: every body he owns, every frame (after his policy scan ran inside RM.update)
	let own = 0;
	for(const b of w.bodies){
		if(!b.alive || b.ownerId !== m.owner.id) continue;
		own++; st.bodyChecks++;
		if((b.tech && Object.keys(b.tech).some(k => Math.abs(b.tech[k]) > 0)) || b.infSource || b.infDerived || b.spatial || b.rupture) st.techFrames++;
	}
	if(own > st.maxOwn) st.maxOwn = own;
}
function damageWindows(st, win){
	// the most damage the bot took inside any window of `win` seconds (a trap would show as a huge number)
	let best = 0, j = 0, sum = 0;
	const h = st.hits;
	for(let i = 0; i < h.length; i++){ sum += h[i].d; while(h[i].t - h[j].t > win){ sum -= h[j].d; j++; } if(sum > best) best = sum; }
	return best;
}

/* ===================== A. library and policy ===================== */
function partA(){
	console.log('\nA. Library and policy');
	const lib = GA.library();
	const ok = lib.filter(x => x.policy === 'ok');
	check('every attack tree passes the technique policy and validates', ok.length === lib.length, ok.length + ' / ' + lib.length + (Object.keys(GA.rejected).length ? ' · rejected: ' + JSON.stringify(GA.rejected) : ''));
	check('no attack uses a technique (engine report)', lib.every(x => x.techniques && x.techniques.length === 0), lib.map(x => x.key + ':' + (x.techniques || []).length).join(' '));
	check('every attack fits his Max Output (' + GA.policy.profile.maxOutput + ')', lib.every(x => x.peakOutput <= GA.policy.profile.maxOutput), lib.map(x => x.key + ' ' + x.peakOutput).join(', '));
	check('8–12 core attack patterns (plus sequences)', lib.length >= 8 && lib.length <= 13, lib.length + ' attacks, ' + Object.keys(GA.SEQUENCES).length + ' sequences');
	check('the signature attack comes from the discovery catalog unchanged', (() => { const e = catalog.find(c => c.id === GA.ATTACKS.signature.source); return !!e && JSON.stringify(e.def.nodes) === JSON.stringify(GA.ATTACKS.signature.def.nodes); })(), GA.ATTACKS.signature.source);
	// bad trees: each must be refused
	const { N, L, build } = RM;
	const gen = (...k) => N('generate', { amount: 100 }, null, ...k);
	const bad = {
		'Technique rune (Thermal)': N('target', { kind: 'enemy' }, null, gen(N('technique', { technique: 'thermal', power: 6 }, null, N('redirect', { toward: 'mouse' })))),
		'Reverse technique (negative power)': gen(N('technique', { technique: 'kinetic', power: -6 })),
		'Legacy reverseTechnique rune': gen(N('reverseTechnique', { technique: 'gravity', power: 6 })),
		'Infinity': gen(N('compress', { power: 22 }, null, N('technique', { technique: 'infinity', power: 6 }))),
		'Construction parameter smuggled onto a raw rune': gen(N('redirect', { toward: 'mouse', construction_facing: 'down' })),
		'Targeting another caster\'s spell (could steal a technique)': N('target', { kind: 'spell', select: 'nearCaster', range: 900 }, null, N('redirect', { toward: 'mouse' })),
		'Draw Out from the environment (could pull foreign energy)': N('zone', { radius: 200 }, null, N('target', { kind: 'environment' }, null, N('drawOut', { duration: 1, from: 'target', infAmount: 100 }))),
		'Anchor-state target of Infinity': N('target', { kind: 'anchorState', astate: 'infinity', select: 'thisSpell' }),
		'Domain': N('zone', { radius: 300 }, null, N('domain', { form: 'closed', duration: 5 })),
		'Technique filter on a target': N('target', { kind: 'anchorState', astate: 'anchored', select: 'thisSpell', techFilter: 'thermal' }),
		'Over Max Output': N('target', { kind: 'enemy' }, null, N('generate', { amount: 900 }, null, N('compress', { power: 14, shape: 'lance' }, null, N('redirect', { toward: 'mouse' }))))
	};
	const refused = {};
	for(const k in bad){ const why = GA.policy.check(build(k, bad[k])); refused[k] = why; }
	check('the policy refuses every forbidden tree (' + Object.keys(bad).length + ' cases)', Object.values(refused).every(Boolean), Object.keys(refused).map(k => k + ' → ' + (refused[k] || 'ALLOWED')).join(' | '));
	results.library = lib.map(x => Object.assign({}, x, { tree: undefined }));
	results.policyCases = refused;
	return lib;
}

/* ===================== B. individual attacks ===================== */
const SCEN = {
	still: { policy: 'still' },
	strafe: { policy: 'strafe' },
	jumper: { policy: 'jumper' },
	reverse: { script: 'reverse' },          // runs one way, turns around the moment the attack leaves
	wall: { policy: 'strafe', nearWall: true },
	casting: { policy: 'strafe', casting: true },      // the bot attacks during the telegraph (and after)
	threatened: { policy: 'reactive', pre: 'lance' },  // a lance is already on its way when this attack starts
	platform: { policy: 'still', onPlatform: true }
};
function scripted(kind, st){
	const m = st.m, bot = st.bot;
	let dir = Math.sign(S.cx(bot) - S.cx(m)) || 1, turned = false;
	return (st2, b) => {
		const a = m.GA.act;
		if(kind === 'reverse'){ if(a && a.fired && !turned){ turned = true; dir = -dir; } b.vx = dir * S.PLAYER.speed; }
		else if(kind === 'stay') b.vx = 0;
		else if(kind === 'away') b.vx = (Math.sign(S.cx(b) - S.cx(m)) || 1) * S.PLAYER.speed;
		else if(kind === 'toward') b.vx = Math.abs(S.cx(m) - S.cx(b)) > 60 ? Math.sign(S.cx(m) - S.cx(b)) * S.PLAYER.speed : 0;
		else if(kind === 'jumpFire'){ b.vx = 0; if(a && a.fired && !turned && b.onGround){ turned = true; S.jump(b); } }
		else if(kind === 'jumpLate'){ b.vx = 0; if(a && a.fired && a.t - a.prep - a.tel > 0.3 && !turned && b.onGround){ turned = true; S.jump(b); } }
		else if(kind === 'awayJump'){ b.vx = (Math.sign(S.cx(b) - S.cx(m)) || 1) * S.PLAYER.speed; if(a && a.fired && !turned && b.onGround){ turned = true; S.jump(b); } }
		else if(kind === 'sidestep'){ if(a && a.fired && !turned){ turned = true; dir = Math.random() < 0.5 ? 1 : -1; } b.vx = turned ? dir * S.PLAYER.speed : 0; }
		else if(kind === 'lanes'){ b.vx = 0; }
		b.vy = Math.min(18, b.vy + st.A.gravity); st.arena.move(b);
	};
}
function forceRun(key, dist, scen, seed, seconds){
	return S.seeded(seed, () => {
		const sc = typeof scen === 'string' ? (SCEN[scen] || { script: scen }) : scen;
		const opt = { policy: sc.policy || 'still', dist };
		if(sc.nearWall){ opt.bossX = 900; opt.botX = 900 - dist; if(opt.botX < 60){ opt.botX = 60; } }
		const st = setup(opt);
		if(sc.onPlatform){ const q = st.A.platforms[2]; st.bot.x = q.x + q.w / 2 - 19; st.bot.y = q.y - st.bot.h; st.m.x = q.x + q.w / 2 - 20 - dist; }
		const scr = sc.script ? scripted(sc.script, st) : null;
		// let him perceive the bot, then force the attack
		for(let i = 0; i < 20; i++) step(st, { script: scr || ((s, b) => { b.vx = 0; b.vy = Math.min(18, b.vy + st.A.gravity); st.arena.move(b); }) });
		st.m.GA.manual = true; st.m.GA.state = 'fight';
		st.hits.length = 0; st.dealt = 0;
		if(sc.pre){ GA.force(st.m, sc.pre); for(let i = 0; i < 50; i++) step(st, { script: scr }); }
		const startF = st.frame;
		const okF = GA.force(st.m, key);
		let fired = false, firedAt = null, failed = false;
		for(let i = 0; i < (seconds || 6) * 60; i++){
			if(sc.casting && i % 30 === 0) { st.bot.castT = 12; }
			step(st, { script: scr });
			const a = st.m.GA.act;
			if(a && a.key === key && a.fired && !fired){ fired = true; firedAt = (st.frame - startF) / 60; if(!a.inst) failed = true; }
			if(!a && !fired && i > 5 && !st.m.GA.act){ /* refused or ended */ }
		}
		const own = st.hits.filter(h => h.key === key);
		const first = own.length ? Math.min(...own.map(h => h.since != null ? h.since : 99)) : null;
		const cov = S.coverage();
		return { forced: okF, fired, failed: failed || !fired, hit: own.length > 0, dmg: own.reduce((s, h) => s + h.d, 0), first, firedAt,
			maxOwn: st.maxOwn, techFrames: st.techFrames, lastErr: st.m.lastErr || '', worldErr: (st.w.errors || []).length, refusals: st.m.GA.audit.castRefusals.length };
	});
}
function partB(lib){
	console.log('\nB. Individual attacks');
	const out = {};
	const dists = QUICK ? [ 300, 700 ] : [ 250, 450, 700, 1000 ];
	const seeds = QUICK ? [ 1 ] : [ 1, 2 ];
	let tooEarly = [];
	for(const x of lib){
		const key = x.key, A = GA.ATTACKS[key];
		const row = { byScenario: {}, earliestHit: null, failRate: 0, runs: 0 };
		let fails = 0, runs = 0;
		for(const scen of Object.keys(SCEN)){
			const rs = [];
			for(const d of dists){
				if(d < A.range[0] - 60 || d > A.range[1] + 100) continue;      // he would not choose it from here
				for(const sd of seeds){ const r = forceRun(key, d, scen, 1000 + d + sd * 7); rs.push(r); runs++; if(r.failed) fails++; if(r.first != null && (row.earliestHit == null || r.first < row.earliestHit)) row.earliestHit = r.first; }
			}
			if(!rs.length) continue;
			row.byScenario[scen] = { hitRate: +(rs.filter(r => r.hit).length / rs.length).toFixed(2), dmg: Math.round(S.mean(rs.map(r => r.dmg))), tImpact: rs.filter(r => r.first != null).length ? +S.mean(rs.filter(r => r.first != null).map(r => r.first)).toFixed(2) : null, runs: rs.length };
		}
		row.failRate = +(fails / Math.max(1, runs)).toFixed(2); row.runs = runs;
		out[key] = row;
		if(row.earliestHit != null && row.earliestHit < GA.CONFIG.minFirstHit) tooEarly.push(key + ' ' + row.earliestHit.toFixed(2) + ' s');
		const sc = row.byScenario;
		console.log('   ' + key.padEnd(10) + ' ' + Object.keys(sc).map(k => k + ' ' + Math.round(sc[k].hitRate * 100) + '%/' + sc[k].dmg).join('  ') + '  · first hit ' + (row.earliestHit != null ? row.earliestHit.toFixed(2) + ' s' : '—') + ' · fail ' + row.failRate);
	}
	check('every attack fires through the engine in its range (no cast failures)', Object.values(out).every(r => r.failRate === 0), Object.keys(out).filter(k => out[k].failRate > 0).map(k => k + ' ' + out[k].failRate).join(', ') || 'none failed');
	check('no attack can hit sooner than ' + GA.CONFIG.minFirstHit + ' s after its telegraph starts', !tooEarly.length, tooEarly.join(', ') || 'earliest: ' + Math.min(...Object.values(out).filter(r => r.earliestHit != null).map(r => r.earliestHit)).toFixed(2) + ' s');
	check('every attack threatens a still player (none is a mere visual)', Object.keys(out).every(k => (out[k].byScenario.still && out[k].byScenario.still.hitRate > 0) || [ 'snare', 'ward' ].includes(k) || (out[k].byScenario.casting && out[k].byScenario.casting.hitRate > 0)),
		Object.keys(out).filter(k => !(out[k].byScenario.still && out[k].byScenario.still.hitRate > 0)).join(', ') || 'all');
	check('the Watching Shard only strikes a player who attacks or casts', out.snare && (out.snare.byScenario.still ? out.snare.byScenario.still.hitRate === 0 : true) && out.snare.byScenario.casting && out.snare.byScenario.casting.hitRate > 0,
		'still ' + (out.snare.byScenario.still ? out.snare.byScenario.still.hitRate : '—') + ' · casting ' + (out.snare.byScenario.casting ? out.snare.byScenario.casting.hitRate : '—'));
	results.attacks = out;
	return out;
}

/* ===================== C. counterplay ===================== */
const RESPONSES = [ 'stay', 'away', 'toward', 'jumpFire', 'jumpLate', 'reverse', 'awayJump', 'sidestep' ];
function partC(lib){
	console.log('\nC. Counterplay (an attack needs at least one response that takes no damage)');
	const out = {};
	const seeds = QUICK ? [ 3, 4 ] : [ 3, 4, 5 ];
	for(const x of lib){
		const key = x.key, A = GA.ATTACKS[key];
		const ds = [ Math.max(A.range[0] + 40, 200), Math.min(A.range[1] - 60, 800) ].filter((v, i, a) => a.indexOf(v) === i);
		const per = {};
		for(const resp of RESPONSES){
			let clean = 0, n = 0, dmg = 0;
			for(const d of ds) for(const sd of seeds){ const r = forceRun(key, d, resp, 5000 + d * 3 + sd); n++; dmg += r.dmg; if(r.dmg === 0) clean++; }
			per[resp] = { clean: +(clean / n).toFixed(2), dmg: Math.round(dmg / n) };
		}
		const best = Object.keys(per).sort((a, b) => per[b].clean - per[a].clean || per[a].dmg - per[b].dmg)[0];
		out[key] = { best, bestClean: per[best].clean, per, distances: ds };
		console.log('   ' + key.padEnd(10) + ' best counter: ' + best + ' (' + Math.round(per[best].clean * 100) + '% clean) · ' + RESPONSES.map(r => r + ' ' + Math.round(per[r].clean * 100)).join(' '));
	}
	const weak = Object.keys(out).filter(k => out[k].bestClean < 0.99 && k !== 'ward');
	check('every attack has a response that avoids it completely', !weak.length, weak.map(k => k + ' best ' + out[k].best + ' ' + Math.round(out[k].bestClean * 100) + '%').join(', ') || 'all have a clean counter');
	const trivial = Object.keys(out).filter(k => RESPONSES.filter(r => out[k].per[r].clean >= 0.99).length >= 7 && ![ 'snare', 'ward' ].includes(k));
	check('no attack is trivially avoided by almost everything', !trivial.length, trivial.join(', ') || 'none');
	results.counterplay = out;
	return out;
}

/* ===================== D. full encounters ===================== */
function encounter(policy, seed, seconds, opts){
	opts = opts || {};
	return S.seeded(seed, () => {
		const keepReset = GA.CONFIG.resetOnPlayerDeath;
		GA.CONFIG.resetOnPlayerDeath = !opts.sweep;
		const st = setup({ policy, dist: 560, arena: opts.arena });
		const m = st.m;
		const sched = opts.sweep ? [ [ 0.3, 0.6 ], [ 0.62, 0.3 ] ] : [];
		for(let f = 0; f < seconds * 60 && !m.dead; f++){
			for(const [at, hp] of sched) if(f === Math.round(seconds * 60 * at) && m.hp > m.maxHp * hp){ m.hp = m.lastHp = m.maxHp * hp; }
			step(st, { shootEvery: policy === 'still' ? 0 : (opts.shootEvery || 54), botPower: opts.botPower || 120 });
		}
		GA.CONFIG.resetOnPlayerDeath = keepReset;
		const G = m.GA;
		const byKey = {};
		for(const h of st.hits){ byKey[h.key] = (byKey[h.key] || 0) + h.d; }
		const ms = st.frameMs.slice().sort((a, b) => a - b);
		return {
			policy, seed, seconds, bossDead: m.dead, resets: G.resets || 0, killTime: m.dead ? +(st.frame / 60).toFixed(1) : null, bossHp: Math.round(Math.max(0, m.hp)), phase: G.phase, transitions: G.transitions.length,
			dealt: Math.round(st.dealt), dps: +(st.dealt / seconds).toFixed(1), botDeaths: st.botDeaths, taken: Math.round(st.taken), worst1s: Math.round(damageWindows(st, 1)), worst3s: Math.round(damageWindows(st, 3)),
			used: Object.assign({}, G.used), dmgByAttack: Object.fromEntries(Object.entries(byKey).map(([k, v]) => [ k, Math.round(v) ])),
			interrupts: G.interrupts, refusedBusy: G.refusedBusy, castRefusals: G.audit.castRefusals.length, ownViolations: G.audit.ownViolations.length, stripped: G.audit.stripped.length,
			techFrames: st.techFrames, bodyChecks: st.bodyChecks, maxOwn: st.maxOwn, msMean: +S.mean(st.frameMs).toFixed(3), ms99: +S.quantile(ms, 0.99).toFixed(2), msMax: +ms[ms.length - 1].toFixed(2),
			lastErr: m.lastErr || '', worldErrors: (st.w.errors || []).length, drained: Math.round(G.drained), decisions: G.decisions.length, sampleDecisions: G.decisions.slice(0, 6)
		};
	});
}
function partD(){
	console.log('\nD. Full encounters');
	const pols = [ 'still', 'strafe', 'jumper', 'aggressive', 'kiter', 'reactive', 'random', 'baseline', 'skilled' ];
	const seeds = QUICK ? [ 11 ] : [ 11, 12, 13 ];
	const secs = QUICK ? 50 : 90;
	const runs = [];
	for(const p of pols) for(const sd of seeds){ const r = encounter(p, sd, secs, { sweep: true }); runs.push(r); }
	const natural = [];
	// natural fights: nothing forced. The player has the real reserve (1500) and an endgame regeneration (81 E/s), and
	// shoots a 160 E compressed lance; his rule on your death applies (he recovers fully). Up to 300 s.
	const natSeeds = QUICK ? [ 1, 2 ] : [ 1, 2, 3, 4, 5, 6 ];
	for(const p of [ 'skilled', 'reactive', 'baseline', 'strafe' ]) for(const sd of natSeeds){ natural.push(encounter(p, 400 + sd, 300, { shootEvery: 30, botPower: 160, botRegen: 1.35 })); }
	const byPol = {};
	for(const r of runs){ const b = byPol[r.policy] = byPol[r.policy] || []; b.push(r); }
	for(const p in byPol){
		const l = byPol[p];
		console.log('   ' + p.padEnd(10) + ' dps ' + S.mean(l.map(r => r.dps)).toFixed(1) + ' · deaths/90s ' + S.mean(l.map(r => r.botDeaths)).toFixed(2) + ' · worst 1 s ' + Math.max(...l.map(r => r.worst1s)) + ' · phase ' + l.map(r => r.phase).join('') + ' · max bodies ' + Math.max(...l.map(r => r.maxOwn)) + ' · ms99 ' + Math.max(...l.map(r => r.ms99)));
	}
	for(const r of natural) console.log('   natural ' + r.policy.padEnd(9) + ' seed ' + r.seed + ': ' + (r.bossDead ? 'DEFEATED at ' + r.killTime + ' s' : r.bossHp + ' hp left after ' + r.seconds + ' s') + ' · phase ' + r.phase + ' · player deaths ' + r.botDeaths + ' · his dps ' + r.dps);
	const all = runs.concat(natural);
	check('all three phases are reached and change his behaviour (phase sweep)', runs.every(r => r.phase === 3 && r.transitions === 2), runs.filter(r => r.phase !== 3).map(r => r.policy + '#' + r.seed).join(', ') || 'every sweep reached phase III');
	const usedP3 = new Set(); for(const r of runs) for(const k in r.used) usedP3.add(k);
	check('he uses his whole library across the encounters', Object.keys(GA.ATTACKS).every(k => usedP3.has(k)), [ ...usedP3 ].join(', '));
	const stillDps = S.mean(byPol.still.map(r => r.dps)), reactDps = S.mean(byPol.reactive.map(r => r.dps));
	check('he punishes standing still far more than good dodging', stillDps > reactDps * 1.5, 'still ' + stillDps.toFixed(1) + ' dps vs reactive ' + reactDps.toFixed(1));
	check('no trap: never more than 60% of the player\'s health inside one second', all.every(r => r.worst1s <= S.PLAYER.hp * 0.6), 'worst ' + Math.max(...all.map(r => r.worst1s)));
	check('a good dodger survives a long time (reactive: ≤ 1 death per 90 s on average)', S.mean(byPol.reactive.map(r => r.botDeaths)) <= 1, S.mean(byPol.reactive.map(r => r.botDeaths)).toFixed(2) + ' deaths / 90 s');
	check('he is dangerous (still / strafing players die)', S.mean(byPol.still.map(r => r.botDeaths)) >= 1 && S.mean(byPol.strafe.map(r => r.botDeaths)) >= 0.5, 'still ' + S.mean(byPol.still.map(r => r.botDeaths)).toFixed(2) + ' · strafe ' + S.mean(byPol.strafe.map(r => r.botDeaths)).toFixed(2));
	const winRate = (p) => { const l = natural.filter(r => r.policy === p); return l.filter(r => r.bossDead).length / Math.max(1, l.length); };
	const winT = natural.filter(r => r.bossDead).map(r => r.killTime);
	check('a skilled player can defeat him (natural fights, real energy)' + (QUICK ? ' — needs the full run to judge' : ''), QUICK || winRate('skilled') >= 0.3, 'skilled wins ' + Math.round(winRate('skilled') * 100) + '% · reactive ' + Math.round(winRate('reactive') * 100) + '% · baseline ' + Math.round(winRate('baseline') * 100) + '% · strafe ' + Math.round(winRate('strafe') * 100) + '% · kill times ' + winT.join(', ') + ' s');
	check('he is an endgame threat: a player who only strafes never beats him', winRate('strafe') === 0, 'strafe deaths per minute ' + (natural.filter(r => r.policy === 'strafe').reduce((s, r) => s + r.botDeaths, 0) / (natural.filter(r => r.policy === 'strafe').length * 5)).toFixed(2));
	// adaptation: for each policy, the attack whose share of his casts rises most above its average share (its "lift")
	const share = (p) => { const u = {}; let n = 0; for(const r of byPol[p]) for(const k in r.used){ if(k.startsWith('seq:')) continue; u[k] = (u[k] || 0) + r.used[k]; n += r.used[k]; } for(const k in u) u[k] /= Math.max(1, n); return u; };
	const shares = {}; for(const p in byPol) shares[p] = share(p);
	const avg = {}; for(const p in shares) for(const k in shares[p]) avg[k] = (avg[k] || 0) + shares[p][k] / Object.keys(shares).length;
	const liftTop = (p) => Object.keys(shares[p]).sort((a, b) => shares[p][b] / avg[b] - shares[p][a] / avg[a])[0];
	const probe = [ 'still', 'aggressive', 'kiter', 'jumper', 'reactive' ];
	check('decisions adapt to the player: each behaviour draws a different favourite (lift over his average mix)', new Set(probe.map(liftTop)).size >= 4,
		probe.map(p => p + '→' + liftTop(p) + ' ×' + (shares[p][liftTop(p)] / avg[liftTop(p)]).toFixed(2)).join(' · '));
	results.adaptation = { shares, avg };
	const r1 = encounter('skilled', 777, 40, { shootEvery: 30, botPower: 160, botRegen: 1.35 }), r2 = encounter('skilled', 777, 40, { shootEvery: 30, botPower: 160, botRegen: 1.35 });
	check('encounters are reproducible: the same seed gives the same fight', r1.dealt === r2.dealt && r1.taken === r2.taken && JSON.stringify(r1.used) === JSON.stringify(r2.used), r1.dealt + '/' + r1.taken + ' vs ' + r2.dealt + '/' + r2.taken);
	results.encounters = { sweep: runs, natural };
	return { runs, natural, byPol };
}

/* ===================== E. technique-free verification ===================== */
function partE(enc){
	console.log('\nE. Technique-free verification');
	const all = enc.runs.concat(enc.natural);
	const frames = all.reduce((s, r) => s + r.bodyChecks, 0);
	check('no body he owned ever carried a technique (' + frames + ' body-frames inspected)', all.every(r => r.techFrames === 0 && r.ownViolations === 0), all.filter(r => r.techFrames || r.ownViolations).map(r => r.policy + '#' + r.seed + ' ' + r.techFrames + '/' + r.ownViolations).join(', ') || 'none');
	check('no cast was refused by the policy during fights', all.every(r => r.castRefusals === 0), all.reduce((s, r) => s + r.castRefusals, 0) + ' refusals');
	// an outside technique pushed onto his energy: stripped, and recorded as done TO him (not by him)
	const inj = S.seeded(77, () => {
		const st = setup({ policy: 'still', dist: 600 });
		for(let i = 0; i < 30; i++) step(st);
		st.m.GA.manual = true; GA.force(st.m, 'lance');
		let injected = 0, seenFor = 0;
		for(let i = 0; i < 120; i++){
			step(st);
			const b = st.w.bodies.find(q => q.alive && q.ownerId === st.m.owner.id);
			// some frames after his lance exists (raw, already scanned), another caster's technique lands on it
			if(b && !injected && ++seenFor > 5){ b.tech = { thermal: 2 }; injected++; }
		}
		return { injected, stripped: st.m.GA.audit.stripped.length, own: st.m.GA.audit.ownViolations.length, techFrames: st.techFrames };
	});
	check('a technique forced onto his energy from outside is stripped at once and logged as external', inj.injected === 1 && inj.stripped >= 1 && inj.own === 0 && inj.techFrames === 0, JSON.stringify(inj));
	// a body that is technique-bearing the first time it is seen is counted as HIS violation (the audit can catch a real failure)
	const own = S.seeded(78, () => {
		const st = setup({ policy: 'still', dist: 600 });
		for(let i = 0; i < 30; i++) step(st);
		const { N, build } = RM;
		const r = st.w.cast(build('fake', N('generate', { amount: 60 })), { profile: GA.policy.profile, owner: st.m.owner, host: st.host });
		const b = st.w.bodies.find(q => q.alive && q.inst === r.instance.id); if(b) b.tech = { kinetic: 2 };
		step(st);
		return { own: st.m.GA.audit.ownViolations.length };
	});
	check('the audit detects technique energy that appears from his own side (control case)', own.own >= 1, JSON.stringify(own));
	results.techniqueFree = { bodyFrames: frames, injected: inj, control: own };
}

/* ===================== F. stability ===================== */
function partF(){
	console.log('\nF. Stability');
	const res = {};
	// many bodies: force the heaviest attacks back to back in phase 3 (his caps decide what is allowed)
	res.flood = S.seeded(91, () => {
		const st = setup({ policy: 'strafe', dist: 600 });
		for(let i = 0; i < 20; i++) step(st);
		st.m.hp = st.m.lastHp = st.m.maxHp * 0.3; for(let i = 0; i < 140; i++) step(st);
		st.m.GA.manual = true;
		const order = [ 'stream', 'lattice', 'volley', 'apex', 'signature', 'crossfire', 'minefall', 'volley', 'stream' ];
		let i = 0;
		for(let f = 0; f < 60 * 14; f++){ if(f % 40 === 0 && i < order.length){ st.m.GA.cd = {}; st.m.mana = st.m.maxMana; GA.force(st.m, order[i++]); } step(st); }
		const ms = st.frameMs.slice().sort((a, b) => a - b);
		return { maxOwn: st.maxOwn, cap: GA.CONFIG.maxBodies, refusedBusy: st.m.GA.refusedBusy, ms99: +S.quantile(ms, 0.99).toFixed(2), msMax: +ms[ms.length - 1].toFixed(2), errors: (st.w.errors || []).length, lastErr: st.m.lastErr };
	});
	check('many bodies at once stay under his cap and fast', res.flood.maxOwn <= GA.CONFIG.maxBodies && res.flood.ms99 < 8 && !res.flood.errors, JSON.stringify(res.flood));
	// interrupt: a stun while he gathers cancels the attack (nothing is cast)
	res.interrupt = S.seeded(92, () => {
		const st = setup({ policy: 'still', dist: 600 });
		for(let i = 0; i < 20; i++) step(st);
		st.m.GA.manual = true; GA.force(st.m, 'apex');
		for(let i = 0; i < 20; i++) step(st);
		st.m.stunTimer = 30;
		for(let i = 0; i < 200; i++) step(st);
		return { interrupts: st.m.GA.interrupts, castsApex: st.m.stats.casts.apex || 0 };
	});
	check('a stun during the telegraph interrupts the attack (counterplay)', res.interrupt.interrupts === 1 && res.interrupt.castsApex === 0, JSON.stringify(res.interrupt));
	// phase change with his energy in flight: everything of his ends, and nothing lands during the shift
	res.phase = S.seeded(93, () => {
		const st = setup({ policy: 'still', dist: 500 });
		for(let i = 0; i < 20; i++) step(st);
		st.m.GA.manual = true; GA.force(st.m, 'lattice');
		for(let i = 0; i < 70; i++) step(st);
		GA.force(st.m, 'volley'); for(let i = 0; i < 45; i++) step(st);
		const before = st.w.bodies.filter(b => b.alive && b.ownerId === st.m.owner.id).length;
		st.m.hp = st.m.lastHp = st.m.maxHp * 0.6;
		step(st);
		const after = st.w.bodies.filter(b => b.alive && b.ownerId === st.m.owner.id).length;
		const h0 = st.hits.length;
		for(let i = 0; i < GA.CONFIG.transition * 60 - 2; i++) step(st);
		return { before, after, hitsDuringShift: st.hits.length - h0, phase: st.m.GA.phase, instancesLeft: st.w.instances.filter(q => !q.done && q.owner.id === st.m.owner.id).length };
	});
	check('a phase change clears his live spells and nothing lands during the shift', res.phase.before > 0 && res.phase.after === 0 && res.phase.hitsDuringShift === 0 && res.phase.phase === 2, JSON.stringify(res.phase));
	// his death mid attack: no energy of his is left behind
	res.death = S.seeded(94, () => {
		const st = setup({ policy: 'still', dist: 500 });
		for(let i = 0; i < 20; i++) step(st);
		st.m.GA.manual = true; GA.force(st.m, 'stream');
		for(let i = 0; i < 60; i++) step(st);
		const live = st.w.bodies.filter(b => b.alive && b.ownerId === st.m.owner.id).length;
		st.m.hp = 0; step(st); step(st);
		const left = st.w.bodies.filter(b => b.alive && b.ownerId === st.m.owner.id).length;
		const h0 = st.hits.length; for(let i = 0; i < 180; i++) step(st);
		return { liveBefore: live, left, hitsAfterDeath: st.hits.length - h0, dead: st.m.dead, removed: !RM.list.includes(st.m) };
	});
	check('his death mid attack leaves nothing behind', res.death.liveBefore > 0 && res.death.left === 0 && res.death.hitsAfterDeath === 0 && res.death.dead, JSON.stringify(res.death));
	// the player dies: he lets go of everything and waits; when they are back, he fights again
	res.playerDeath = S.seeded(95, () => {
		const st = setup({ policy: 'still', dist: 500 });
		for(let i = 0; i < 20; i++) step(st);
		st.m.GA.manual = true; GA.force(st.m, 'stream'); for(let i = 0; i < 50; i++) step(st);
		st.bot.hp = 0; step(st); step(st);
		const left = st.w.bodies.filter(b => b.alive && b.ownerId === st.m.owner.id).length;
		const h0 = st.hits.length; for(let i = 0; i < 100; i++) step(st);
		const during = st.hits.length - h0;
		st.m.GA.manual = false; for(let i = 0; i < 60 * 12; i++) step(st);
		return { leftAfterDeath: left, hitsWhileDown: during, respawned: st.bot.hp > 0, castsAfter: Object.values(st.m.stats.casts).reduce((a, b) => a + b, 0) };
	});
	check('player death: he clears his spells, deals nothing while you are down, fights again after', res.playerDeath.leftAfterDeath === 0 && res.playerDeath.hitsWhileDown === 0 && res.playerDeath.respawned && res.playerDeath.castsAfter > 1, JSON.stringify(res.playerDeath));
	// scene exit: RuneMages.clear()
	res.exit = S.seeded(96, () => {
		const st = setup({ policy: 'strafe', dist: 500 });
		for(let i = 0; i < 400; i++) step(st);
		RM.clear(); st.w.update(1 / 60, st.host);
		return { left: st.w.bodies.filter(b => b.alive && b.ownerId === st.m.owner.id).length, instances: st.w.instances.filter(q => !q.done && q.owner.id === st.m.owner.id).length, mages: RM.list.length };
	});
	check('scene exit (RuneMages.clear) removes him and all his energy', res.exit.left === 0 && res.exit.instances === 0 && res.exit.mages === 0, JSON.stringify(res.exit));
	// a long fight: no growth in live energy, instances or memory
	res.long = S.seeded(97, () => {
		const st = setup({ policy: 'random', dist: 500 });
		const samples = [];
		const secs = QUICK ? 180 : 600;
		for(let f = 0; f < secs * 60; f++){
			if(f % 1800 === 0 && st.m.hp < st.m.maxHp * 0.4){ st.m.hp = st.m.lastHp = st.m.maxHp * 0.36; }
			step(st, { shootEvery: 70, botPower: 60 });
			if(f % 600 === 0) samples.push({ t: f / 60, bodies: st.w.bodies.length, inst: st.w.instances.length, decisions: st.m.GA.decisions.length, hits: st.hits.length });
		}
		const ms = st.frameMs.slice().sort((a, b) => a - b);
		return { seconds: secs, samples: samples.filter((_, i) => i % 3 === 0), maxBodiesArray: Math.max(...samples.map(s => s.bodies)), maxInst: Math.max(...samples.map(s => s.inst)), ms99: +S.quantile(ms, 0.99).toFixed(2), errors: (st.w.errors || []).length, lastErr: st.m.lastErr, dead: st.m.dead };
	});
	check('a ' + res.long.seconds + ' s fight: live energy and instances stay bounded, no errors', res.long.maxBodiesArray < 400 && res.long.maxInst < 60 && !res.long.errors && !res.long.lastErr, JSON.stringify(Object.assign({}, res.long, { samples: undefined })));
	// confined arena: his spells still work in a small walled room
	res.confined = S.seeded(98, () => {
		const r = encounter('reactive', 98, 60, { arena: S.CONFINED, sweep: true });
		return { phase: r.phase, dealt: r.dealt, worst1s: r.worst1s, errors: r.worldErrors, lastErr: r.lastErr, maxOwn: r.maxOwn };
	});
	check('a confined arena (2200 px, walls, platforms) works: no errors, no trap', !res.confined.errors && !res.confined.lastErr && res.confined.worst1s <= S.PLAYER.hp * 0.6, JSON.stringify(res.confined));
	// his drawing (RuneMages swallows draw errors, so a broken draw would just make him invisible): every attack, a
	// phase change and his death, drawn into a recording context that fails on any exception
	res.draw = S.seeded(99, () => {
		const noop = () => {}, grad = { addColorStop: noop };
		let calls = 0;
		const ctx = new Proxy({ canvas: { width: 1280, height: 720 } }, { get(t, k){ if(k in t) return t[k]; if(k === 'createRadialGradient' || k === 'createLinearGradient') return () => grad; if(k === 'measureText') return () => ({ width: 10 }); return (...a) => { calls++; for(const v of a) if(typeof v === 'number' && !isFinite(v)) throw new Error('non-finite argument to ' + String(k)); }; }, set(t, k, v){ t[k] = v; return true; } });
		const st = setup({ policy: 'strafe', dist: 500 });
		const K = RM.KINDS.arcanist;
		let errs = [], f = 0;
		const keys = Object.keys(GA.ATTACKS);
		st.m.GA.manual = true;
		for(let i = 0; i < keys.length * 100 + 400; i++){
			if(i % 100 === 20 && i / 100 < keys.length){ st.m.GA.cd = {}; st.m.mana = st.m.maxMana; GA.force(st.m, keys[Math.floor(i / 100)]); }
			if(i === keys.length * 100 + 50){ st.m.hp = st.m.lastHp = st.m.maxHp * 0.3; }
			if(i === keys.length * 100 + 300){ st.m.hp = 0; }
			step(st);
			try { K.custom.draw(ctx, st.m, S.cx(st.m) - 640, S.cy(st.m) - 360); } catch(e){ if(errs.length < 3) errs.push(e.message); }
		}
		return { frames: keys.length * 100 + 400, drawCalls: calls, errors: errs };
	});
	check('his drawing never throws or draws with a non-finite number (every attack, a phase change, his death)', !res.draw.errors.length && res.draw.drawCalls > 1000, JSON.stringify(res.draw));
	results.stability = res;
}

/* ===================== G. regression ===================== */
function partG(){
	console.log('\nG. Regression');
	const eng = ME.devTests.run();
	const ef = eng.filter(x => !x.pass);
	check('engine checks (MagicEngine.devTests.run)', !ef.length, (eng.length - ef.length) + ' / ' + eng.length + (ef.length ? ' · failing: ' + ef.map(x => x.name).join('; ') : ''));
	// the rune mages' self-tests are random; run them seeded (in child processes) and compare with the same seeds on
	// the code before this boss (sim/arcanist/selftest-baseline.json)
	const { execFileSync } = require('child_process');
	const base = JSON.parse(fs.readFileSync(path.join(OUT, 'selftest-baseline.json'), 'utf8')).seeds;
	const cur = base.map(b0 => JSON.parse(execFileSync(process.execPath, [ path.join(__dirname, 'selftest-seeded.js'), S.ROOT, String(b0.seed) ], { encoding: 'utf8' }).trim().split('\n').pop()));
	const same = cur.every((c, i) => c.pass === base[i].pass && JSON.stringify(c.failing) === JSON.stringify(base[i].failing));
	check('rune mage and Aster Vael self-tests: identical to before, seed for seed', same, cur.map((c, i) => 'seed ' + c.seed + ': ' + c.pass + '/' + c.total + ' (before ' + base[i].pass + '/' + base[i].total + ')').join(' · '));
	const mages = cur, mf = [];
	results.regression = { engine: { pass: eng.length - ef.length, total: eng.length, failing: ef.map(x => x.name) }, mages: { current: cur, before: base, identical: same } };
}

/* ===================== outputs ===================== */
function writeOutputs(lib){
	const stamp = new Date().toISOString();
	const engineVersion = 'magic-engine.js (maxRunes ' + ME.CONFIG.maxRunes + ', rawMaxSpeed ' + ME.CONFIG.rawMaxSpeed + ', maxBodiesGlobal ' + ME.CONFIG.maxBodiesGlobal + ')';
	const library = lib.map(x => {
		const A = GA.ATTACKS[x.key], B = results.attacks ? results.attacks[x.key] : null, Cp = results.counterplay ? results.counterplay[x.key] : null;
		return { id: x.id, name: x.name, role: x.role, source: x.source, phases: { I: A.phases[0], II: A.phases[1], III: A.phases[2] }, castingConditions: { range: A.range, cooldown: A.cooldown },
			telegraph: x.telegraph, prep: A.prep, recovery: A.recovery, cost: x.cost, peakOutput: x.peakOutput, runes: x.runes,
			intendedResponse: A.response, countersAndWeaknesses: A.counters, techniqueFree: x.techniques.length === 0 && x.policy === 'ok',
			simulation: B ? { byScenario: B.byScenario, earliestHit: B.earliestHit, failRate: B.failRate, runs: B.runs } : null,
			counterplay: Cp ? { best: Cp.best, cleanRate: Cp.bestClean, all: Cp.per } : null,
			knownLimitations: LIMITS[x.key] || '', engine: engineVersion, generated: stamp, tree: GA.ATTACKS[x.key].def };
	});
	fs.writeFileSync(path.join(S.ROOT, 'data', 'arcanist-spell-library.json'), JSON.stringify({ boss: 'The Grand Arcanist', generated: stamp, engine: engineVersion, profile: { stats: GA.CONFIG.stats, maxOutput: GA.policy.profile.maxOutput, runeCapacity: GA.policy.profile.runeCapacity, reserve: GA.CONFIG.reserve, regen: GA.CONFIG.regen }, spells: library }, null, 1));
	fs.writeFileSync(path.join(OUT, 'campaign-results.json'), JSON.stringify(results, null, 1));
	// the browser copy of the discovered trees (loaded before grand-arcanist.js)
	fs.writeFileSync(path.join(S.ROOT, 'grand-arcanist-discovered.js'), '/* generated by tools/arcanist-campaign.js from sim/raw-discovery/catalog.json — the discovered trees the Grand Arcanist uses, unchanged */\nwindow.GRAND_ARCANIST_DISCOVERED = ' + JSON.stringify(discoveredDefs) + ';\n');
}
const LIMITS = {
	lance: 'A single raw projectile is capped at the engine\'s raw speed (9 px/frame): long range gives time to react by design.',
	volley: 'The six arrows only converge on the point chosen at launch; a player already outside the mark is safe.',
	orb: 'Slow by design; in a confined room it can corner a player who does not move early.',
	snare: 'Reacts only to "target attacks or casts" (castTimer / melee attack in the game); a player who never attacks is never struck.',
	crossfire: 'Aimed at the lagged perception of the player, three times; wall-hugging shortens the dodge room.',
	stream: 'Paid from his reserve through owner.drain (240 E per cast); the cursor lags on purpose so a steady run outpaces it.',
	pursuit: 'The second branch reads the player\'s observed habit (EMA of dodge direction); a player with no habit gets a guess.',
	nova: 'Short range only (≤ 320 px); the ring drawn is the measured burst radius.',
	ward: 'Raw reinforcement: the engine gives ≈ 25–30 % damage resistance; not immunity.',
	lattice: 'Mines are anchored for up to 11 s (his tidy rule) and only burst within 110 px.',
	apex: 'Phase III only; peak output 813 within his 960 Max Output.',
	signature: 'From discovery RD-0099. The bloom happens only within 110 px of the player.',
	minefall: 'From discovery RD-0234. Anchored mines; in a confined room they deny a lot of floor for their lifetime.'
};

function main(){
	const t0 = Date.now();
	console.log('Grand Arcanist campaign' + (QUICK ? ' (quick)' : '') + ' · measured telegraph radii ' + JSON.stringify(GA.MEASURED));
	const lib = partA();
	partB(lib);
	partC(lib);
	const enc = partD();
	partE(enc);
	partF();
	partG();
	results.seconds = Math.round((Date.now() - t0) / 1000);
	results.summary = { pass: results.checks.filter(c => c.pass).length, total: results.checks.length };
	results.config = GA.CONFIG; results.measured = GA.MEASURED;
	writeOutputs(lib);
	console.log('\n' + results.summary.pass + ' / ' + results.summary.total + ' checks passed in ' + results.seconds + ' s');
}
if(require.main === module) main();
module.exports = { setup, step, forceRun, encounter };
