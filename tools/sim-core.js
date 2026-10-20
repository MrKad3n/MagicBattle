/* =====================================================================
   SIM CORE — the shared headless harness for the raw-energy discovery sweep (tools/raw-discovery.js) and the
   Grand Arcanist campaign (tools/arcanist-campaign.js).

   It loads the real game modules (magic-engine.js, magic-techniques.js, rune-mages.js and, when asked,
   grand-arcanist.js) into Node, and gives:
   · a seeded RNG that replaces Math.random while a run lasts (every run is reproducible from its seed);
   · the Mage Arena's real geometry (dungeon.html, IS_MAGE_ARENA): a 9000 px floor at y 2340 with seven platforms;
   · a stand-in for the player: 38 × 56, runs at 7 px/frame, jumps at 16, gravity 0.55 (dungeon.html's numbers),
     steered by a POLICY (still, strafe, jumper, aggressive, kiter, reactive, random, baseline);
   · a host for the engine (solid ground and platforms, bounds, damage hooks, knockback onto the bot).

   Nothing here re-implements a rune: every spell runs through MagicEngine.createWorld().cast / update.
   ===================================================================== */
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');

function loadGame(opts){
	opts = opts || {};
	if(!globalThis.MagicEngine){
		require(path.join(ROOT, 'magic-engine.js'));
		require(path.join(ROOT, 'magic-techniques.js'));
	}
	if(!globalThis.RuneMages) require(path.join(ROOT, 'rune-mages.js'));
	if(opts.arcanist && !globalThis.GrandArcanist) require(path.join(ROOT, 'grand-arcanist.js'));
	return { ME: globalThis.MagicEngine, RM: globalThis.RuneMages, GA: globalThis.GrandArcanist || null };
}

/* mulberry32: small, fast, good enough for reproducible runs */
function rng(seed){
	let a = (seed >>> 0) || 1;
	return function(){
		a = (a + 0x6D2B79F5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
/* run fn with Math.random seeded; always restores the real one */
function seeded(seed, fn){
	const keep = Math.random;
	Math.random = rng(seed);
	try { return fn(); } finally { Math.random = keep; }
}

/* the Mage Arena (dungeon.html: IS_MAGE_ARENA) */
const ARENA = {
	worldW: 9000, groundY: 2340, center: 4500, gravity: 0.55,
	platforms: [
		{ x: 2300, y: 2140, w: 260, h: 20 }, { x: 2900, y: 1990, w: 220, h: 20 },
		{ x: 4280, y: 1880, w: 440, h: 20 },
		{ x: 5880, y: 1990, w: 220, h: 20 }, { x: 6440, y: 2140, w: 260, h: 20 },
		{ x: 1200, y: 2060, w: 300, h: 20 }, { x: 7500, y: 2060, w: 300, h: 20 }
	]
};
/* a smaller, walled room — the same rules, for "confined arena" checks */
const CONFINED = {
	worldW: 2200, groundY: 1200, center: 1100, gravity: 0.55, walls: true,
	platforms: [ { x: 500, y: 1010, w: 240, h: 20 }, { x: 1460, y: 1010, w: 240, h: 20 }, { x: 980, y: 880, w: 240, h: 20 } ]
};

const PLAYER = { w: 38, h: 56, speed: 7.0, jump: 16, hp: 500 };
const REACT = 13;      // frames (≈ 0.22 s): the reactive policy's reaction time

function makeArena(A){
	A = A || ARENA;
	const solid = (x, y) => y >= A.groundY || x < 0 || x > A.worldW || A.platforms.some(q => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h);
	const inBounds = (x, y) => x > -400 && x < A.worldW + 400 && y > -2000 && y < A.groundY + 400;
	const move = (e) => {
		const prevBottom = e.y + e.h;
		e.x += e.vx; e.y += e.vy; e.onGround = false;
		if(e.y + e.h >= A.groundY){ e.y = A.groundY - e.h; if(e.vy > 0) e.vy = 0; e.onGround = true; }
		for(const q of A.platforms){
			if(e.vy >= 0 && e.x + e.w > q.x && e.x < q.x + q.w && e.y + e.h >= q.y && prevBottom <= q.y + 1){ e.y = q.y - e.h; e.vy = 0; e.onGround = true; }
		}
		if(e.x < 0){ e.x = 0; e._wall = -1; } else if(e.x > A.worldW - e.w){ e.x = A.worldW - e.w; e._wall = 1; } else e._wall = 0;
	};
	return { A, solid, inBounds, move };
}

const cx = (e) => e.x + e.w / 2, cy = (e) => e.y + e.h / 2;

/* ---------- player policies: the bot decides vx and when to jump; nothing it does is hidden from the boss ---------- */
function makeBot(A, x, policy, R){
	const bot = { x: x - PLAYER.w / 2, y: A.groundY - PLAYER.h, w: PLAYER.w, h: PLAYER.h, vx: 0, vy: 0, onGround: true, launchVx: 0,
		kbx: 0, stun: 0, policy, dir: 1, dirT: 0, jumps: 0, casts: 0, castT: 0, hp: PLAYER.hp, maxHp: PLAYER.hp, hurt: 0, hits: 0, iT: 0 };
	return bot;
}
/* threats: the boss's energy coming at the bot (what a player can see on screen) */
function incoming(bot, w, foeOwnerId, within){
	let best = null;
	for(const b of w.bodies){
		if(!b.alive || b.ownerId !== foeOwnerId || b.isZone || b.zoneBlob) continue;
		const dx = cx(bot) - b.x, dy = cy(bot) - b.y, d = Math.hypot(dx, dy);
		if(d > within) continue;
		const sp = Math.hypot(b.vx, b.vy);
		const closing = sp > 0.5 ? (b.vx * dx + b.vy * dy) / (sp * (d || 1)) : 0;
		if(closing < 0.6 && d > 90) continue;
		if(!best || d < best.d) best = { b, d, dx, dy, sp };
	}
	return best;
}
const POLICIES = {
	still: { name: 'Stands still', step(bot){ bot.vx = 0; } },
	strafe: { name: 'Strafes left and right', step(bot, ctx){
		bot.dirT -= 1 / 60; if(bot.dirT <= 0){ bot.dir = ctx.R() < 0.5 ? -1 : 1; bot.dirT = 0.5 + ctx.R() * 1.0; }
		keepRange(bot, ctx, 260, 9999); bot.vx = bot.dir * PLAYER.speed; } },
	jumper: { name: 'Jumps on a fixed rhythm', step(bot, ctx){
		bot.dirT -= 1 / 60; if(bot.dirT <= 0){ bot.dir = -bot.dir || 1; bot.dirT = 1.2; }
		keepRange(bot, ctx, 260, 9999); bot.vx = bot.dir * PLAYER.speed * 0.7;
		if(bot.onGround && ctx.f % 70 === 0) jump(bot); } },
	aggressive: { name: 'Rushes in close and stays there', step(bot, ctx){
		const dx = ctx.bx - cx(bot);
		bot.vx = Math.abs(dx) > 90 ? Math.sign(dx) * PLAYER.speed : (ctx.R() < 0.5 ? -1 : 1) * PLAYER.speed * 0.4;
		if(bot.onGround && ctx.R() < 0.01) jump(bot); } },
	kiter: { name: 'Keeps far away', step(bot, ctx){
		const dx = cx(bot) - ctx.bx, d = Math.abs(dx);
		if(d < 900) bot.dir = Math.sign(dx) || 1; else { bot.dirT -= 1 / 60; if(bot.dirT <= 0){ bot.dir = ctx.R() < 0.5 ? -1 : 1; bot.dirT = 0.6 + ctx.R(); } }
		if(bot._wall) bot.dir = -bot._wall;
		bot.vx = bot.dir * PLAYER.speed;
		if(bot.onGround && ctx.R() < 0.006) jump(bot); } },
	reactive: { name: 'Dodges what it sees coming (human reaction: ~0.22 s late)', step(bot, ctx){
		// what it reacts to now is what it saw REACT frames ago (a person needs that long to respond)
		const seen = incoming(bot, ctx.w, ctx.foeId, 300);
		bot._seen = bot._seen || [];
		bot._seen.push(seen ? { x: seen.b.x, y: seen.b.y, d: seen.d } : null);
		const th = bot._seen.length > REACT ? bot._seen.shift() : null;
		if(th){
			// step out of its line: away along x, jump if it comes in low
			const away = Math.sign(cx(bot) - th.x) || (ctx.R() < 0.5 ? -1 : 1);
			bot.vx = away * PLAYER.speed;
			if(bot.onGround && Math.abs(th.y - cy(bot)) < 40 && th.d < 180) jump(bot);
		} else {
			bot.dirT -= 1 / 60; if(bot.dirT <= 0){ bot.dir = ctx.R() < 0.5 ? -1 : 1; bot.dirT = 0.4 + ctx.R() * 1.2; }
			keepRange(bot, ctx, 320, 700); bot.vx = bot.dir * PLAYER.speed * 0.8;
		} } },
	random: { name: 'Random movement', step(bot, ctx){
		if(ctx.f % 12 === 0){ const r = ctx.R(); bot.dir = r < 0.4 ? -1 : r < 0.8 ? 1 : 0; }
		bot.vx = bot.dir * PLAYER.speed;
		if(bot.onGround && ctx.R() < 0.02) jump(bot); } },
	skilled: { name: 'Skilled (dodges late, reads his tells: leaves mine and burst circles, punishes his rooted casts)', step(bot, ctx){
		const T = ctx.tell || {};
		// a burst ring or a mine circle it can see around it: walk out of it first
		let out = null;
		for(const z of T.zones || []){ const dx = cx(bot) - z.x, d = Math.abs(dx); if(d < z.r + 30 && Math.abs(cy(bot) - z.y) < z.r + 40){ out = Math.sign(dx) || 1; break; } }
		if(out){ bot.vx = out * PLAYER.speed; if(bot._wall) bot.vx = -bot._wall * PLAYER.speed; return; }
		POLICIES.reactive.step(bot, ctx);
		// he is rooted (gathering, or recovering): close to a good casting range
		if(T.rooted && !incoming(bot, ctx.w, ctx.foeId, 300)){ const dx = ctx.bx - cx(bot), d = Math.abs(dx); if(d > 650) bot.vx = Math.sign(dx) * PLAYER.speed; else if(d < 380) bot.vx = -Math.sign(dx) * PLAYER.speed; }
		ctx.wantShot = true; } },
	baseline: { name: 'Baseline fighter (dodges late, holds mid range, hops now and then)', step(bot, ctx){
		POLICIES.reactive.step(bot, ctx);
		// a plainer player than "reactive": it drifts back to 450–650 px and hops on a loose rhythm
		const dx = cx(bot) - ctx.bx, d = Math.abs(dx);
		if(d < 450) bot.vx = (Math.sign(dx) || 1) * PLAYER.speed * 0.8;
		else if(d > 650) bot.vx = -Math.sign(dx) * PLAYER.speed * 0.8;
		if(bot._wall) bot.vx = -bot._wall * PLAYER.speed;
		if(bot.onGround && ctx.R() < 0.012) jump(bot);
		ctx.wantShot = true; } }
};
function keepRange(bot, ctx, lo, hi){
	const dx = cx(bot) - ctx.bx, d = Math.abs(dx);
	if(d < lo) bot.dir = Math.sign(dx) || 1;
	else if(d > hi) bot.dir = -Math.sign(dx);
	if(bot._wall) bot.dir = -bot._wall;
}
function jump(bot){ bot.vy = -PLAYER.jump; bot.onGround = false; bot.jumps++; }

/* move the bot one frame (knockback and stun from the engine land on it) */
function stepBot(bot, ctx, arena){
	if(bot.stun > 0){ bot.stun--; bot.vx = bot.kbx; }
	else { POLICIES[bot.policy].step(bot, ctx); bot.vx += bot.kbx; }
	bot.kbx *= 0.85;
	bot.vy = Math.min(18, bot.vy + arena.A.gravity);
	arena.move(bot);
	if(bot.iT > 0) bot.iT--;
}

/* the engine's host, with the bot as the only enemy of whoever casts */
function makeHost(arena, getEnemies, onEnemyHurt, bot){
	return {
		mouseWorld: () => ({ x: 0, y: 0 }),
		getEnemies,
		isSolid: arena.solid, inBounds: arena.inBounds,
		damageEnemy: onEnemyHurt,
		nudge: (e, dx, dy) => { e.x += dx; e.y += dy; },
		teleport: () => false,
		hitRect: (e) => ({ x: e.x, y: e.y, w: e.w, h: e.h }),
		applyStatus: (e, type, mag, dur) => { if(e === bot && type === 'stunned'){ bot.stun = Math.max(bot.stun, dur * 60); return true; } return false; },
		knockback: (e, vx, vy) => { if(e === bot){ bot.kbx += vx * 0.5; bot.vy += vy * 0.4; } else { e._kbVx = vx; e._kbVy = vy; e._kbTimer = 12; } }
	};
}

/* a fixed-size grid of cells an attack's energy passed through: how much of the arena it covered */
function coverage(){
	const cells = new Set(), C = 64;
	return { add(x, y){ cells.add(Math.floor(x / C) + ',' + Math.floor(y / C)); }, get area(){ return cells.size * C * C; }, get cells(){ return cells.size; } };
}

function quantile(arr, q){ if(!arr.length) return null; const s = arr.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; }
function mean(arr){ return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }

module.exports = { ROOT, loadGame, rng, seeded, ARENA, CONFINED, PLAYER, makeArena, makeBot, stepBot, POLICIES, makeHost, incoming, coverage, quantile, mean, cx, cy, jump };
