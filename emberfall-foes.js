/* EmberFall's roadside bandits — hedge-mages turned highwaymen, drawn with the player's own character rig (tinted
   cloaks, real weapon art) and run by a small brain of their own:
     bandit         — closes in with twin daggers: a short wind-up you can read, a lunge, a slash, then a step back
     banditSlinger  — keeps its distance and throws knives in a shallow arc, backing off if you rush it
     banditCaptain  — slow and heavy with a sword, a big overhead chop with a long tell and a shove
   They register themselves into ENEMY_TYPES (customUpdate / customDraw hooks in dungeon.html's enemy loop), so
   damage, death, XP and loot work like every other enemy. */
(function (global) {
	'use strict';
	const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
	const cx = e => e.x + e.w / 2;
	const cy = e => e.y + e.h / 2;

	const TYPES = {
		bandit: {
			name: 'Roadside Bandit', w: 34, h: 74, hp: 260, color: '#6b4a3a', color2: '#a07050', flies: false, moveSpeed: 2.4,
			detectRange: 560, attackRange: 70, xp: 10, spells: [], tint: '#5a3a2a', weapon: 'daggers',
			reach: 66, windup: 16, active: 7, recover: 26, dmg: 16, cd: 46, kb: 7
		},
		banditSlinger: {
			name: 'Bandit Slinger', w: 34, h: 74, hp: 190, color: '#5a5a3a', color2: '#8a8a50', flies: false, moveSpeed: 2.1,
			detectRange: 720, attackRange: 460, xp: 10, spells: [], tint: '#4a4a2c', weapon: 'daggers', ranged: true,
			windup: 20, active: 4, recover: 30, dmg: 12, cd: 96
		},
		banditCaptain: {
			name: 'Bandit Captain', w: 40, h: 80, hp: 620, color: '#3a2a3a', color2: '#7a4a6a', flies: false, moveSpeed: 1.6,
			detectRange: 600, attackRange: 96, xp: 26, spells: [], tint: '#3c2440', weapon: 'sword',
			reach: 96, windup: 30, active: 9, recover: 40, dmg: 30, cd: 70, kb: 13
		}
	};

	function sees(en, p, range) {
		const dx = cx(p) - cx(en), dy = cy(p) - cy(en);
		if (Math.abs(dx) > range || Math.abs(dy) > 260) return false;
		if (typeof hasLineOfSight === 'function' && !hasLineOfSight(cx(en), en.y + 20, cx(p), p.y + 20)) return false;
		return true;
	}
	function hurtPlayer(dmg, kbx, kby) {
		if (typeof damagePlayer !== 'function') return;
		const h0 = typeof health === 'number' ? health : 0;
		damagePlayer(dmg, []);
		if (typeof health === 'number' && health < h0 && typeof player !== 'undefined') {
			player._knockbackVx = kbx; player._knockbackVy = kby; player._knockbackTimer = 14;
		}
	}
	function throwKnife(en, p) {
		if (typeof enemyProjectiles === 'undefined') return;
		const sx = cx(en) + en.facing * 18, sy = en.y + 26;
		const tx = cx(p), ty = cy(p) - 10;
		const dx = tx - sx;
		const t = clamp(Math.abs(dx) / 11, 18, 46);           // frames in the air
		const g = 0.18;
		const vx = dx / t, vy = (ty - sy) / t - g * t / 2;
		enemyProjectiles.push({
			x: sx, y: sy, vx, vy, color: '#d8d0c0', color2: '#8a8070', power: en.typeDef.dmg, width: 18, height: 6, shape: 'blade',
			effects: [], maxAge: 140, age: 0, hasHit: false, trail: 'none', aoe: false, aoeRadius: 0, aoeMax: 0, aoeTimer: 0,
			homing: false, homingStrength: 0, homingSpeed: 0, moveSpeed: 0, dispellable: true, linger: false, lingerTimer: 0, lingerMax: 0,
			lingerDmgInterval: 30, lingerLastDmg: 0, gravity: g, rotAngle: 0, rotSpeed: 0.35 * Math.sign(vx || 1), pierce: false, isSolidPlatform: false
		});
	}

	function update(en, p) {
		const T = en.typeDef;
		const B = en._b || (en._b = { st: 'idle', t: 0, cd: 30, walk: 0, home: en.x, hit: false });
		en.animTimer = (en.animTimer || 0) + 1;
		B.t++;
		if (B.cd > 0) B.cd--;
		const dx = cx(p) - cx(en), dist = Math.abs(dx);
		const alive = typeof health !== 'number' || health > 0;
		const aware = alive && (B.st !== 'idle' && B.st !== 'patrol' ? dist < T.detectRange * 1.5 : sees(en, p, en._detect || T.detectRange));
		let want = 0;
		if (B.st === 'windup' || B.st === 'strike' || B.st === 'recover') {
			// committed to an attack
			if (B.st === 'windup' && B.t >= T.windup) { B.st = 'strike'; B.t = 0; B.hit = false; if (!T.ranged) en.vx = en.facing * (T.weapon === 'sword' ? 3 : 6); }
			else if (B.st === 'strike') {
				if (T.ranged) { if (!B.hit) { B.hit = true; throwKnife(en, p); } }
				else if (!B.hit) {
					const fx = cx(en) + en.facing * T.reach * 0.55;
					if (Math.abs(cx(p) - fx) < T.reach * 0.6 + p.w / 2 && Math.abs(cy(p) - cy(en)) < 60) { B.hit = true; hurtPlayer(T.dmg, en.facing * T.kb, -4); }
				}
				if (B.t >= T.active) { B.st = 'recover'; B.t = 0; }
			} else if (B.st === 'recover' && B.t >= T.recover) { B.st = 'chase'; B.t = 0; B.cd = T.cd + ((Math.random() * 20) | 0); if (!T.ranged && Math.random() < 0.45) B.back = 24; }
			en.vx *= 0.82;
		} else if (aware) {
			en.facing = dx > 0 ? 1 : -1;
			B.st = 'chase';
			if (T.ranged) {
				if (dist < 220) want = -en.facing;           // too close: back off
				else if (dist > 420) want = en.facing;
				if (B.cd <= 0 && dist < T.attackRange && dist > 140) { B.st = 'windup'; B.t = 0; }
			} else {
				if (B.back > 0) { B.back--; want = -en.facing * 0.8; }
				else if (dist > T.reach * 0.7) want = en.facing;
				if (B.cd <= 0 && dist < T.reach + 10 && Math.abs(cy(p) - cy(en)) < 70) { B.st = 'windup'; B.t = 0; }
			}
		} else {
			// patrol between the posts of its camp, pausing now and then
			B.st = 'patrol';
			const lo = en.patrol ? en.patrol[0] : B.home - 160, hi = en.patrol ? en.patrol[1] : B.home + 160;
			if (B.pause > 0) B.pause--;
			else {
				if (cx(en) < lo) en.facing = 1;
				else if (cx(en) > hi) en.facing = -1;
				want = en.facing * 0.45;
				if (Math.random() < 0.004) B.pause = 90 + (Math.random() * 120 | 0);
			}
		}
		const sp = T.moveSpeed * (en.slowTimer > 0 ? 0.5 : 1);
		if (want) en.vx += (want * sp - en.vx) * 0.25;
		else if (B.st !== 'strike') en.vx *= 0.75;
		// a step up a small lip: hop
		if (want && en.onGround && typeof EmberfallWorld !== 'undefined') {
			const ahead = EmberfallWorld.surf(cx(en) + en.facing * 30);
			if (en.y + en.h - ahead > 24 && en.y + en.h - ahead < 120) { en.vy = -9; en.onGround = false; }
		}
		en.vy = Math.min(14, (en.vy || 0) + 0.55);
		if (typeof moveEntityTile === 'function') moveEntityTile(en);
		if (Math.abs(en.vx) > 0.3) B.walk += Math.abs(en.vx) * 0.09;
	}

	/* ---------------------------------------------------------------- drawing with the player rig */
	function pose(en) {
		const B = en._b || {}, T = en.typeDef;
		if (en.stunTimer > 0 || en._kbTimer > 0) return { lean: -0.5, head: 0.28, hat: 0.2, armF: 0.95, armB: -1.3, legF: 0.2, legB: -0.35, shift: -4, crouch: 2 };
		if (!en.onGround) return { lean: -0.18, head: -0.08, hat: -0.08, armF: -0.9, armB: -0.7, legF: -0.45, legB: 0.55, shift: 0, crouch: -2 };
		if (B.st === 'windup') {
			const k = clamp(B.t / T.windup, 0, 1);
			return { lean: -0.15 * k, head: 0.05, hat: 0.05, armF: -1.9 * k, armB: 0.6 * k, legF: 0.35 * k, legB: -0.3 * k, shift: -3 * k, crouch: 4 * k };
		}
		if (B.st === 'strike') return { lean: 0.45, head: 0.1, hat: 0.1, armF: 1.35, armB: -0.6, legF: 0.7, legB: -0.6, shift: 5, crouch: 3 };
		if (B.st === 'recover') { const k = 1 - clamp(B.t / T.recover, 0, 1); return { lean: 0.25 * k, head: 0.04, hat: 0.04, armF: 0.9 * k + 0.3, armB: -0.3 * k, legF: 0.4 * k, legB: -0.4 * k, shift: 2 * k, crouch: 2 * k }; }
		if (Math.abs(en.vx) > 0.4) { const w = Math.sin(B.walk || 0), bob = Math.abs(Math.sin((B.walk || 0) * 2)); return { lean: 0.12, head: 0.02, hat: 0.04, armF: -w * 0.55, armB: w * 0.55, legF: w * 0.95, legB: -w * 0.95, shift: 0, crouch: bob * 2 }; }
		const b = Math.sin((en.animTimer || 0) * 0.08);
		return { lean: 0.02, head: -0.02, hat: 0, armF: 0.42 + b * 0.04, armB: 0.28, legF: 0.04, legB: -0.04, shift: 0, crouch: (1 - b) * 0.6 };
	}
	function draw(ctx, en, cam) {
		const R = global.PlayerRig, T = en.typeDef, B = en._b || {};
		const a = en.dead ? Math.max(0, 1 - (en.deathTimer || 0) / 50) : 1;
		if (a <= 0) return;
		const who = en._who || (en._who = { x: 0, y: 0, w: 38, h: en.h, facing: 1, baseH: 56, flash: 0 });
		who.x = en.x + (en.w - 38) / 2; who.y = en.y; who.h = en.h; who.facing = en.facing || 1; who.flash = en.flash || 0;
		ctx.save();
		ctx.globalAlpha *= a;
		let ok = false;
		if (R && R.isReady && R.isReady()) {
			const o = {
				state: en.onGround ? (Math.abs(en.vx) > 0.4 ? 'run' : 'idle') : 'fall', grounded: !!en.onGround, vx: en.vx || 0, vy: en.vy || 0,
				walkPhase: B.walk || 0, frame: en.animTimer || 0, weapon: T.weapon, swing: null, rest: B.st !== 'windup' && B.st !== 'strike',
				spellHand: false, aim: { x: en.facing || 1, y: 0 }, reachPx: T.reach || 40, squash: 0,
				angleLegs: B.st === 'windup' || B.st === 'strike', angleArms: B.st === 'windup' || B.st === 'strike', tint: T.tint
			};
			try { R.draw(ctx, who.x - cam.x, who.y - cam.y, who, pose(en), o); ok = true; } catch (e) { ok = false; }
		}
		if (!ok) {
			// fallback: a cloaked figure
			ctx.fillStyle = T.tint;
			ctx.fillRect(en.x - cam.x + 4, en.y - cam.y + 16, en.w - 8, en.h - 16);
			ctx.beginPath(); ctx.arc(cx(en) - cam.x, en.y - cam.y + 12, 10, 0, Math.PI * 2); ctx.fill();
		}
		// a dark scarf over the face (they are bandits, not wizards)
		const fx = cx(en) - cam.x + (en.facing || 1) * 3, fy = en.y - cam.y + en.h * 0.27;
		ctx.fillStyle = 'rgba(30,22,18,0.85)';
		ctx.beginPath(); ctx.ellipse(fx, fy, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
		// the tell: a glint at the blade before a strike
		if (B.st === 'windup') {
			const k = clamp(B.t / T.windup, 0, 1);
			ctx.globalCompositeOperation = 'lighter';
			const gx = cx(en) - cam.x - (en.facing || 1) * 16, gy = en.y - cam.y + 6;
			const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, 14 + 10 * k);
			g.addColorStop(0, 'rgba(255,240,200,' + (0.4 + 0.5 * k) + ')');
			g.addColorStop(1, 'rgba(255,240,200,0)');
			ctx.fillStyle = g; ctx.fillRect(gx - 26, gy - 26, 52, 52);
		}
		ctx.restore();
	}

	function register(ENEMY_TYPES) {
		for (const k in TYPES) {
			if (ENEMY_TYPES[k]) continue;
			ENEMY_TYPES[k] = Object.assign({ customUpdate: update, customDraw: draw }, TYPES[k]);
		}
	}
	global.EmberfallFoes = { register, TYPES };
})(typeof window !== 'undefined' ? window : globalThis);
