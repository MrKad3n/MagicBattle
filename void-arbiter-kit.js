/* =============================================================
   void-arbiter-kit.js — The Void Arbiter raid boss (dungeon.html?mode=raid)
   -------------------------------------------------------------
   Frame-driven raid encounter: intro → idle/cast loop → phase set pieces
   (65% / 30%) → enrage. Every attack is a timeline stepped once per tick
   (no setTimeout, so pausing the game pauses the boss).

   The host runs the AI (VoidArbiter.update, called from updateRaidBoss under
   the co-op aim context). Attacks spawn *hazards* — beams, shockwaves,
   pillars, novas, rifts, the rising tide — which every client simulates on
   its own and which only ever hurt the local player (VoidArbiter.tick). New
   hazards are broadcast to guests once per tick as a single 'va' event.

   Hooks (dungeon.html):
     VoidArbiter.update(boss)  host AI, from updateRaidBoss
     VoidArbiter.tick()        every client, once per game tick
     VoidArbiter.drawSky()     after the raid sky gradient
     VoidArbiter.drawBack()    after platforms, before the boss sprite
     VoidArbiter.drawAura(b)   right before the boss sprite
     VoidArbiter.drawFront()   after the player (beams, tide, darkness, HUD)
     VoidArbiter.drawProj(p)   enemy projectiles tagged _vaStyle
     VoidArbiter.onNet(d)      guest: replay a host 'va' event
   ============================================================= */
(function(){
	'use strict';
	const TAU = Math.PI * 2;
	const rnd = Math.random;
	const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
	const lerp = (a, b, k) => a + (b - a) * k;
	const ease = k => k * k * (3 - 2 * k);
	const angN = a => { while(a > Math.PI) a -= TAU; while(a < -Math.PI) a += TAU; return a; };

	const ENRAGE_AT = 60 * 60 * 7;          // 7 minutes in: the Arbiter grows impatient
	const H = [];                           // live hazards (every client)
	let pending = [];                       // host: hazards spawned this tick, sent as one event
	let F = 0, deadDone = false;
	const HUD = { cast: null, castT: 0, castDur: 1, stagger: 0, enraged: false, tgt: null, tgtT: 0 };

	/* ---------------------------------------------------------- palettes */
	let palOk = false;
	function ensurePal(){
		if(palOk || !window.EFX) return;
		EFX.EL.arbiter  = { core:'#fff0f4', mid:'#ff3a66', outer:'#a3093c', dark:'#14000a', style:'void', mote:'wisp' };
		EFX.EL.nullvoid = { core:'#ffffff', mid:'#b46cff', outer:'#4a128f', dark:'#07000f', style:'void', mote:'wisp' };
		EFX.EL.verdict  = { core:'#fffbe6', mid:'#ffd166', outer:'#ff5a3a', dark:'#2a0a00', style:'spark', mote:'spark' };
		palOk = true;
	}

	/* ---------------------------------------------------------- arena */
	function plats(){ return (typeof RAID_CONFIG !== 'undefined' && RAID_CONFIG.platforms) || []; }
	const CEIL = () => (typeof RAID_CONFIG !== 'undefined' ? RAID_CONFIG.ceilY : 80);
	const BOT = () => (typeof RAID_BOTTOM_Y !== 'undefined' ? RAID_BOTTOM_Y : 1500);
	const WW = () => (typeof WORLD_W !== 'undefined' ? WORLD_W : 4000);
	// the first platform surface at or below y over x
	function platBelow(x, y){
		let best = null;
		for(const p of plats()) if(x >= p.x && x <= p.x + p.w && p.y >= y - 6 && (!best || p.y < best.y)) best = p;
		return best;
	}
	function platTop(x){ return platBelow(x, -1e9); }
	// Court layers are 260px apart (a plain jump reaches ~364px), but every mechanic can still be dodged
	// by moving sideways or jumping in place, so builds without mobility are never forced to climb.
	// Arbiter's Verdict: lanes of judgement; a lane is condemned when its index has the given parity.
	const laneIdx = (h, x) => Math.floor((x - h.x0) / h.lw);
	const laneDoomed = (h, x) => (((laneIdx(h, x) % 2) + 2) % 2) === h.par;
	// where he hovers between attacks, relative to his target: close enough to stay on screen
	const OFFS = [[-420, -250], [420, -250], [-300, -330], [300, -330], [0, -370], [-520, -190], [520, -190]];

	/* ---------------------------------------------------------- player + damage */
	const PX = () => player.x + player.w / 2;
	const PY = () => player.y + player.h / 2;
	const PR = () => Math.min(player.w, player.h) * 0.45;
	function dmgMult(){
		return (typeof DIFF_DMG_MULT === 'number' ? DIFF_DMG_MULT : 1) *
			(typeof coopBossDmgMult === 'function' ? coopBossDmgMult() : 1) * (HUD.enraged ? 1.25 : 1);
	}
	function hurt(n, eff, el){
		if(typeof player === 'undefined' || player.iFrames > 0) return false;
		if(typeof health !== 'undefined' && health <= 0) return false;
		damagePlayer(n * dmgMult(), eff || []);
		if(window.EFX) EFX.hit(PX(), PY(), el || 'arbiter', n);
		return true;
	}
	function segDist(px, py, x0, y0, x1, y1){
		const dx = x1 - x0, dy = y1 - y0, L = dx * dx + dy * dy || 1;
		const k = clamp(((px - x0) * dx + (py - y0) * dy) / L, 0, 1);
		return Math.hypot(px - (x0 + dx * k), py - (y0 + dy * k));
	}
	function inRect(x, y, w, h){ return player.x + player.w > x && player.x < x + w && player.y + player.h > y && player.y < y + h; }
	function shake(a, d){ if(typeof shakeScreen === 'function') shakeScreen(a, d); }
	function warn(t, ms){ if(typeof showRaidWarning === 'function') showRaidWarning(t, ms); }

	/* ---------------------------------------------------------- hazards + net */
	function isHost(){ return !(typeof COOP_GUEST !== 'undefined' && COOP_GUEST); }
	function net(d){ if(typeof CoopSync !== 'undefined' && typeof COOP_HOST !== 'undefined' && COOP_HOST) CoopSync.queueEvent('va', d); }
	function addLocal(h){
		h.t = 0;
		if(h.k === 'fx'){ fxNow(h); return; }
		H.push(h);
	}
	function spawn(h){
		addLocal(h);
		if(typeof COOP_HOST !== 'undefined' && COOP_HOST){ const o = Object.assign({}, h); delete o.t; pending.push(o); }
		return h;
	}
	function fxNow(h){
		if(!window.EFX) return;
		EFX.burst(h.x, h.y, h.el || 'arbiter', h.s || 1.5);
		if(h.ring) EFX.ring(h.x, h.y, 20, h.ring, h.el || 'arbiter', 26, { width: 6 });
		if(h.shake) shake(h.shake, 14);
	}
	function find(k){ for(const h of H) if(h.k === k) return h; return null; }

	/* ---------------------------------------------------------- HUD state */
	function setCast(name, dur){ HUD.cast = name; HUD.castT = 0; HUD.castDur = Math.max(1, dur || 1); }
	function setTgt(id){ if(id !== HUD.tgt){ HUD.tgt = id; HUD.tgtT = 0; } }

	/* ---------------------------------------------------------- party (co-op)
	   Every living player as this client sees them. On the host during the boss update `player` stands in
	   for whoever he is aiming at, so the host's real self comes from the co-op aim snapshot. */
	function selfId(){ return (typeof window.__coopSelf === 'function' && window.__coopSelf()) || 'me'; }
	function party(){
		const out = [];
		if(typeof player === 'undefined') return out;
		const sn = window.__coopAimSnap, hx = sn ? sn.x : player.x, hy = sn ? sn.y : player.y;
		const hw = sn ? sn.w : player.w, hh = sn ? sn.h : player.h;
		if(typeof health !== 'number' || health > 0) out.push({ id: selfId(), me: true, cx: hx + hw / 2, cy: hy + hh / 2, h: hh, feet: hy + hh });
		if(typeof IS_COOP === 'undefined' || !IS_COOP) return out;
		const allies = window.__coopAllies || {}, t = performance.now();
		for(const id in allies){
			const a = allies[id];
			if(!a || !a.active || !(a.hp > 0) || !a.snap || t - a.snap.t > 3000) continue;
			const x = a.renderX != null ? a.renderX : a.x, y = a.renderY != null ? a.renderY : a.y;
			out.push({ id, me: false, cx: x + 19, cy: y + 28, h: 56, feet: y + 56, name: a.name });
		}
		return out;
	}
	function posOf(tid){
		const P = party();
		for(const p of P) if(p.id === tid) return p;
		return P[0] || null;
	}
	// host: the party ordered with his current focus first
	function foes(s){
		const P = party();
		const i = P.findIndex(p => p.id === s.tgt);
		if(i > 0) P.unshift(P.splice(i, 1)[0]);
		return P;
	}
	// host: pick who he hunts next — someone he has not hunted lately, leaning toward whoever hurts him most
	function chooseTarget(B, s){
		const P = party();
		if(P.length < 2){ if(s.tgt){ s.tgt = null; setTgt(null); net({ k:'tgt', id: null }); } return; }
		s.hist = s.hist || {};
		const thr = B._thr || {};
		let maxT = 1;
		for(const p of P) maxT = Math.max(maxT, thr[p.me ? 'host' : p.id] || 0);
		let best = P[0], bs = -1e9;
		for(const p of P){
			const since = s.fightT - (s.hist[p.id] != null ? s.hist[p.id] : -9999);
			let sc = Math.min(1.5, since / 600) + 0.6 * ((thr[p.me ? 'host' : p.id] || 0) / maxT) + rnd() * 0.5;
			if(p.id === s.tgt) sc -= 0.8;
			if(sc > bs){ bs = sc; best = p; }
		}
		s.tgt = best.id; s.hist[best.id] = s.fightT;
		B._tgtId = best.me ? 'host' : best.id; B._tgtT = 1e9;      // the co-op aim keeps him on this player
		setTgt(best.id); net({ k:'tgt', id: best.id });
	}

	/* =============================================================
	   HOST AI
	   ============================================================= */
	function st(B){
		if(!B.va) B.va = { mode:'intro', t:0, cast:null, tx:2000, ty:1060, ease:0.04, moveMax:6, recent:[], fightT:0, idleFor:40,
			tideAt:0, horizonAt:0, forced:null, enraged:false, hpLock:null, stagger:false };
		return B.va;
	}
	const bc = B => ({ x: B.x + B.w / 2, y: B.y + B.h / 2 });
	function steer(B, s, free){
		const c = bc(B);
		const tx = s.tx, ty = s.ty + (s.mode === 'stagger' ? 0 : Math.sin(s.fightT * 0.035) * 12);
		let vx = (tx - c.x) * s.ease, vy = (ty - c.y) * s.ease;
		const v = Math.hypot(vx, vy);
		if(v > s.moveMax){ vx *= s.moveMax / v; vy *= s.moveMax / v; }
		B.x += vx; B.y += vy; B.vx = vx; B.vy = vy;
		if(!free){
			B.x = clamp(B.x, 40, WW() - B.w - 40);
			B.y = clamp(B.y, CEIL() - 40, BOT() - B.h + 30);
		}
	}
	function face(B){ const dx = PX() - (B.x + B.w / 2); if(Math.abs(dx) > 12) B.facing = dx > 0 ? 1 : -1; }
	function holdHere(B, s){ const c = bc(B); s.tx = c.x; s.ty = c.y; }
	function goTo(s, x, y, ease, max){ s.tx = x; s.ty = y; s.ease = ease || 0.06; s.moveMax = max || 8; }

	function update(B){
		if(!B || B.dead) return;
		ensurePal();
		const s = st(B);
		s.fightT++; s.t++;
		B.stunTimer = 0;                                   // raid boss: crowd-control immune
		if(s.hpLock != null && B.hp < s.hpLock) B.hp = s.hpLock;
		if(!s.enraged && s.fightT > ENRAGE_AT){
			s.enraged = true; HUD.enraged = true; net({ k:'enr' });
			warn('🔥 ENRAGED — THE ARBITER GROWS IMPATIENT', 2600);
			spawn({ k:'fx', x: bc(B).x, y: bc(B).y, s: 2.4, ring: 320, shake: 8 });
		}
		const pct = B.hp / Math.max(1, B.maxHp);
		if(s.mode !== 'transition' && s.mode !== 'intro'){
			if(B.phase === 1 && pct <= 0.65) startTransition(B, s, 2);
			else if(B.phase === 2 && pct <= 0.30) startTransition(B, s, 3);
		}
		// Phase 3: the void encroaches from one edge on its own clock, whatever he is casting
		if(B.phase >= 3 && s.mode !== 'transition' && s.tideAt && s.fightT >= s.tideAt && !find('tide')){
			s.tideAt = s.fightT + (s.enraged ? 900 : 1260);
			s.tideSide = s.tideSide === -1 ? 1 : -1;
			warn(s.tideSide < 0 ? '🌊 THE VOID ENCROACHES — MOVE RIGHT!' : '🌊 THE VOID ENCROACHES — MOVE LEFT!', 2400);
			spawn({ k:'tide', side: s.tideSide, front: s.tideSide < 0 ? 1700 : WW() - 1700, warn: 120, rise: 60, hold: 300, fall: 70 });
		}
		switch(s.mode){
			case 'intro': stepIntro(B, s); break;
			case 'idle': stepIdle(B, s); break;
			case 'cast': stepCast(B, s); break;
			case 'transition': stepTransition(B, s); break;
			case 'stagger': stepStagger(B, s); break;
		}
		steer(B, s, s.mode === 'intro');
		if(s.mode !== 'stagger' && !(s.cast && s.cast.noFace)) face(B);
		if(pending.length){ net({ k:'hzs', l: pending }); pending = []; }
	}

	function stepIntro(B, s){
		if(s.t === 1){
			B.x = 2000 - B.w / 2; B.y = -320;
			goTo(s, 2000, 1060, 0.035, 9);
			warn('🌑 THE VOID ARBITER AWAKENS', 2600);
			spawn({ k:'charge', x: 2000, y: 1060, d: 70 });
		}
		if(s.t === 75){
			spawn({ k:'fx', x: bc(B).x, y: bc(B).y, s: 2.6, ring: 420, shake: 10 });
			spawn({ k:'nova', x: bc(B).x, y: bc(B).y, r0: 80, spd: 12, maxR: 1800, th: 30, gaps: [], gw: 0, dmg: 0 });
			B.armRaised = 40;
		}
		if(s.t >= 140){ s.mode = 'idle'; s.t = 0; s.idleFor = 30; chooseTarget(B, s); }
	}

	function idleTime(B, s){ return Math.round([48, 34, 24][B.phase - 1] * (s.enraged ? 0.6 : 1)); }
	function pickAnchor(B, s){
		const c = bc(B), px = PX(), py = PY();
		let best = null, bs = 1e9;
		for(const o of OFFS){
			const x = clamp(px + o[0], 200, WW() - 200), y = clamp(py + o[1], CEIL() + 140, BOT() - B.h / 2 - 90);
			// favour a fresh spot that is not a long flight away
			const sc = Math.abs(Math.hypot(x - c.x, y - c.y) - 320) + rnd() * 260;
			if(sc < bs){ bs = sc; best = [x, y]; }
		}
		goTo(s, best[0], best[1], 0.045, 5 + B.phase * 1.5);
	}
	function stepIdle(B, s){
		if(s.t === 1) pickAnchor(B, s);
		if(s.t >= s.idleFor) beginCast(B, s, pickAttack(B, s));
	}

	function pickAttack(B, s){
		if(s.forced){ const f = s.forced; s.forced = null; return f; }
		const pool = []; let tot = 0;
		for(const id in ATK){
			const a = ATK[id];
			if(a.phase > B.phase || s.recent.indexOf(id) >= 0) continue;
			if(a.ok && !a.ok(B, s)) continue;
			const w = a.w[B.phase - 1] || 0;
			if(w <= 0) continue;
			pool.push([id, w]); tot += w;
		}
		if(!pool.length) return 'orbs';
		let r = rnd() * tot, id = pool[0][0];
		for(const p of pool){ r -= p[1]; if(r <= 0){ id = p[0]; break; } }
		s.recent.push(id);
		if(s.recent.length > (B.phase >= 2 ? 3 : 2)) s.recent.shift();
		return id;
	}
	function beginCast(B, s, id){
		s.mode = 'cast'; s.t = 0;
		s.cast = { id, t: 0 };
		const a = ATK[id], dur = a.dur ? a.dur(B, s) : 120;
		setCast(a.name, dur); net({ k:'cast', n: a.name, d: dur });
	}
	function stepCast(B, s){
		const c = s.cast, a = ATK[c.id];
		const done = a.step(B, s, c);
		c.t++;
		if(done){
			s.cast = null; setCast(null); net({ k:'cast', n: null });
			if(s.stagger){ s.stagger = false; startStagger(B, s); return; }
			s.mode = 'idle'; s.t = 0;
			s.idleFor = idleTime(B, s);
			chooseTarget(B, s);
		}
	}

	function startTransition(B, s, to){
		B.phase = to;
		s.mode = 'transition'; s.t = 0; s.cast = null; s.stagger = false;
		setCast(null); net({ k:'cast', n: null });
		s.hpLock = B.hp;
		goTo(s, 2000, 1020, 0.06, 12);
		warn(to === 2 ? '⚠️ PHASE 2 — THE VEIL TEARS' : '💀 FINAL PHASE — JUDGEMENT', 2800);
		if(typeof dmgNumbers !== 'undefined') dmgNumbers.push({ x: bc(B).x, y: B.y - 40, text: to === 2 ? '🌑 PHASE 2' : '💀 PHASE 3', age: 0, color: '#ff3a66' });
		spawn({ k:'charge', x: 2000, y: 1020, d: 90 });
	}
	function stepTransition(B, s){
		B.phaseTransition = Math.max(0, 210 - s.t);
		B.armRaised = 20;
		if(s.t === 95){
			const o = bc(B), n = 4, base = rnd() * TAU, gaps = [];
			for(let i = 0; i < n; i++) gaps.push(base + i * TAU / n);
			spawn({ k:'fx', x: o.x, y: o.y, s: 3, ring: 520, shake: 14 });
			spawn({ k:'nova', x: o.x, y: o.y, r0: 90, spd: 9, maxR: 2600, th: 46, gaps, gw: 0.62, dmg: 22, eff: ['knockback'] });
			if(B.phase >= 3){ s.forced = 'verdict'; s.tideAt = s.fightT + 900; s.horizonAt = s.fightT + 1500; }
			else s.forced = 'rifts';
		}
		if(s.t >= 210){
			s.hpLock = null; B.phaseTransition = 0;
			s.mode = 'idle'; s.t = 0; s.idleFor = 24;
		}
	}
	function startStagger(B, s){
		s.mode = 'stagger'; s.t = 0;
		const c = bc(B);
		goTo(s, c.x, Math.min(BOT() - 120, c.y + 160), 0.03, 3);
		HUD.stagger = 300; net({ k:'stag', d: 300 });
		warn('💥 THE ARBITER IS STAGGERED — STRIKE NOW!', 2400);
	}
	function stepStagger(B, s){
		B.armRaised = 0;
		if(s.t >= 300){ s.mode = 'idle'; s.t = 0; s.idleFor = 20; }
	}

	/* =============================================================
	   ATTACKS — step(B, s, c) runs once per tick; return true when done
	   ============================================================= */
	const ATK = {
		/* A sweeping lance. The marked arc shows exactly where it will travel. With a party, one lance hunts each player. */
		lance: { name: 'Abyssal Lance', phase: 1, w: [3, 3, 2],
			dur: (B, s) => (s.enraged ? 46 : 58) + 12 + 110 + 16,
			step(B, s, c){
				if(c.t === 0){
					warn('🔴 ABYSSAL LANCE — LEAVE THE MARKED ARC!', 1500);
					holdHere(B, s);
					const o = bc(B), dir = rnd() < 0.5 ? 1 : -1, F = foes(s);
					const wt = s.enraged ? 46 : 58, sw = 0.8 * dir;
					const beam = (a0, d) => spawn({ k:'beam', ox: o.x, oy: o.y, a0, sw: sw * d, warn: wt, grow: 12, sweep: 110, len: 2100, w: 30, dmg: 14, el: 'arbiter' });
					if(F.length >= 2){
						F.slice(0, 4).forEach((p, i) => beam(Math.atan2(p.cy - o.y, p.cx - o.x), i % 2 ? -1 : 1));
						if(B.phase >= 3) beam(Math.atan2(PY() - o.y, PX() - o.x) + Math.PI, 1);
					} else {
						const a0 = Math.atan2(PY() - o.y, PX() - o.x), n = B.phase;
						for(let i = 0; i < n; i++) beam(a0 + i * TAU / n, 1);
					}
					c.end = wt + 12 + 110 + 16;
					B.armRaised = c.end;
				}
				return c.t >= c.end;
			} },

		/* He dives onto his focus's platform and the impact runs down every chain: shockwaves race along every platform at once. */
		slam: { name: 'Sundering Slam', phase: 1, w: [3, 2, 2],
			dur: () => 118,
			step(B, s, c){
				if(c.t === 0){
					warn('⬇️ SUNDERING SLAM — JUMP THE SHOCKWAVES!', 1400);
					const pl = platBelow(PX(), player.y + player.h - 12) || platTop(2000) || plats()[0];
					c.pl = pl; c.ix = clamp(PX(), pl.x + 70, pl.x + pl.w - 70);
					goTo(s, c.ix, pl.y - 470, 0.1, 18);
					for(const q of plats()) spawn({ k:'tel', s:'rect', x: q.x, y: q.y - 74, w: q.w, h: 74, d: 60, el: 'arbiter' });
					spawn({ k:'blast', x: c.ix, y: pl.y - 30, r: 170, delay: 60, dmg: 30, eff: ['knockback'], el: 'arbiter', flat: 0.42 });
				}
				if(c.t === 47){ goTo(s, c.ix, c.pl.y - B.h / 2 - 4, 0.4, 46); B.armRaised = 30; }
				// every platform shudders from the point closest to the impact, so the waves spread outward from him
				const quake = (sp, h, dmg, el, big) => {
					for(const q of plats()){
						const ox = clamp(c.ix, q.x + 20, q.x + q.w - 20);
						if(q !== c.pl) spawn({ k:'fx', x: ox, y: q.y - 8, s: big ? 1.4 : 1, el });
						for(const d of [-1, 1]){
							if((d < 0 && ox - q.x < 40) || (d > 0 && q.x + q.w - ox < 40)) continue;      // nothing left to run along
							spawn({ k:'wave', x: ox, y: q.y, dir: d, spd: sp, x0: q.x, x1: q.x + q.w, h, dmg, el });
						}
					}
				};
				if(c.t === 60){
					shake(12, 16);
					spawn({ k:'fx', x: c.ix, y: c.pl.y - 8, s: 2.6, ring: 260 });
					quake(B.phase >= 3 ? 11 : 9, 64, 28, 'arbiter', true);
				}
				if(B.phase >= 2 && c.t === 84) quake(7.5, 52, 22, 'nullvoid', false);
				if(c.t === 100) goTo(s, c.ix, c.pl.y - 500, 0.06, 8);
				return c.t >= 118;
			} },

		/* Orbs gather around him, then peel off one by one and hunt you. */
		orbs: { name: 'Null Orbs', phase: 1, w: [3, 2, 2],
			dur: () => 80,
			step(B, s, c){
				if(c.t === 0){ warn('🔮 NULL ORBS — KEEP MOVING!', 1100); B.armRaised = 60; c.n = [5, 7, 9][B.phase - 1] + Math.min(4, party().length - 1) * 2; c.gap = c.n > 9 ? 4 : 6; }
				if(c.t < c.n * c.gap && c.t % c.gap === 0 && typeof spawnRaidBossProj === 'function'){
					const i = c.t / c.gap, o = bc(B), a = (i / c.n) * TAU - Math.PI / 2, hold = 58 - c.t + i * 7;
					const p = spawnRaidBossProj(o.x + Math.cos(a) * 140, o.y + Math.sin(a) * 140, 0, 0, {
						color: '#2a0040', color2: '#b46cff', power: 24, width: 30, height: 30, shape: 'orb',
						effects: ['slow'], maxAge: hold + 330, homingStrength: 0.024,
					});
					if(p){
						p._vaStyle = 'orb'; p._vaEl = 'nullvoid'; p._vaHold = hold; p._vaSpd = 6.4 + B.phase * 0.4;
						p._vaOx = o.x; p._vaOy = o.y; p._vaA = a; p._vaR = 140; p.noWallCollide = true;
					}
				}
				return c.t >= 80;
			} },

		/* Eruptions march along every platform at once, starting from the end nearest him. */
		pillars: { name: 'Rift Eruption', phase: 1, w: [3, 3, 2],
			dur: () => 115,
			step(B, s, c){
				if(c.t === 0){
					warn('⚡ RIFT ERUPTION — OUTRUN THE CRACKS!', 1300);
					B.armRaised = 50;
					const gap = s.enraged ? 4 : 6;
					let last = 0;
					const march = (pl, fromLeft, t0) => {
						const n = Math.max(3, Math.floor((pl.w - 60) / 110));
						for(let i = 0; i < n; i++){
							const k = fromLeft ? i : n - 1 - i;
							const x = pl.x + 40 + k * ((pl.w - 80) / Math.max(1, n - 1));
							const w = t0 + 36 + i * gap;
							spawn({ k:'pillar', x, y: pl.y, w: 72, hh: 290, warn: w, show: w - 36, life: 24, dmg: 32, el: 'arbiter' });
							last = Math.max(last, w);
						}
					};
					const bx = bc(B).x;
					for(const pl of plats()){
						const fromLeft = bx < pl.x + pl.w / 2;
						march(pl, fromLeft, 0);
						// phase 3: the widest floor cracks from both ends and meets in the middle
						if(B.phase >= 3 && pl.court === 'dais') march(pl, !fromLeft, 14);
					}
					c.end = last + 26;
				}
				return c.t >= c.end;
			} },

		/* Vanish, reappear at your side, cleave. Chains in later phases; with a party he hops from player to player. */
		blink: { name: 'Blink Cleave', phase: 1, w: [2, 3, 3],
			dur: (B, s) => (B.phase + (party().length > 1 ? 1 : 0) - 1) * (s.enraged ? 42 : B.phase >= 3 ? 48 : 54) + 46,
			step(B, s, c){
				const per = s.enraged ? 42 : (B.phase >= 3 ? 48 : 54);
				if(c.t === 0){
					warn('⚡ BLINK CLEAVE — GET BEHIND HIM!', 900);
					c.F = foes(s); c.n = B.phase + (c.F.length > 1 ? 1 : 0); c.i = 0; c.next = 0;
				}
				if(c.i < c.n && c.t === c.next){
					// re-read positions every hop: the party has moved since the last cleave
					const F = foes(s), tg = F.length ? F[c.i % F.length] : { cx: PX(), cy: PY() };
					const o = bc(B), side = rnd() < 0.5 ? -1 : 1;
					const nx = clamp(tg.cx + side * 170, 140, WW() - 140);
					const ny = clamp(tg.cy - 24, CEIL() + B.h / 2, BOT() - B.h / 2 + 10);
					spawn({ k:'ghost', x: B.x, y: B.y, w: B.w, h: B.h, f: B.facing, life: 34 });
					spawn({ k:'blink', x0: o.x, y0: o.y, x1: nx, y1: ny, d: 14 });
					B.x = nx - B.w / 2; B.y = ny - B.h / 2; s.tx = nx; s.ty = ny; s.ease = 0.05; s.moveMax = 2;
					B.facing = tg.cx > nx ? 1 : -1; c.noFace = true;
					const ang = Math.atan2(tg.cy - ny, tg.cx - nx);
					spawn({ k:'slash', x: nx, y: ny, ang, r: 270, arc: 2.3, warn: B.phase >= 3 ? 24 : 28, dmg: 38, el: 'arbiter' });
					B.armRaised = 32;
					c.i++; c.next = c.t + per;
				}
				return c.i >= c.n && c.t >= c.next - per + 46;
			} },

		/* Pulls everyone in, then implodes into a ring with a few safe lanes. */
		well: { name: 'Gravity Well', phase: 1, w: [2, 3, 3],
			dur: () => 172,
			step(B, s, c){
				if(c.t === 0){
					warn('🌀 GRAVITY WELL — STAND IN A GAP!', 1500);
					const F = foes(s);
					const mx = F.length ? F.reduce((a, p) => a + p.cx, 0) / F.length : PX();      // the middle of the party
					goTo(s, clamp(mx, 1350, 2650), 1130, 0.12, 14);
					B.armRaised = 170;
				}
				if(c.t === 24){
					const o = bc(B), n = B.phase >= 2 ? 2 : 3, gw = B.phase >= 3 ? 0.44 : 0.56, base = rnd() * TAU;
					c.gaps = []; for(let i = 0; i < n; i++) c.gaps.push(base + i * TAU / n + (rnd() - 0.5) * 0.5);
					c.gw = gw; c.o = o; holdHere(B, s);
					spawn({ k:'well', x: o.x, y: o.y, r: 950, dur: 120, str: 2.2 + B.phase * 0.3, gaps: c.gaps, gw });
				}
				if(c.t === 144){
					shake(14, 18);
					spawn({ k:'fx', x: c.o.x, y: c.o.y, s: 2.8, ring: 200, el: 'nullvoid' });
					spawn({ k:'blast', x: c.o.x, y: c.o.y, r: 150, delay: 0, dmg: 40, eff: ['knockback'], el: 'nullvoid' });
					spawn({ k:'nova', x: c.o.x, y: c.o.y, r0: 60, spd: 8.5, maxR: 2300, th: 40, gaps: c.gaps, gw: c.gw, dmg: 28, el: 'nullvoid' });
				}
				return c.t >= 172;
			} },

		/* Portals open around the party; each locks on and fires a lance. */
		rifts: { name: 'Dimensional Rifts', phase: 2, w: [0, 3, 2],
			dur: (B) => 50 + (B.phase >= 3 ? 6 : 4) * 13 + 26,
			step(B, s, c){
				if(c.t === 0){
					warn('🌀 DIMENSIONAL RIFTS — WATCH THE LINES!', 1300);
					B.armRaised = 50;
					const F = foes(s), n = (B.phase >= 3 ? 6 : 4) + Math.min(2, F.length - 1), base = rnd() * TAU;
					for(let i = 0; i < n; i++){
						const p = F.length ? F[i % F.length] : { cx: PX(), cy: PY() };
						const a = base + i * TAU / n + (rnd() - 0.5) * 0.4, d = 520 + rnd() * 180;
						const x = clamp(p.cx + Math.cos(a) * d, 80, WW() - 80);
						const y = clamp(p.cy + Math.sin(a) * d * 0.7, CEIL() + 60, BOT() - 40);
						spawn({ k:'rift', x, y, warn: 50 + i * 13, fire: 22, len: 1500, w: 24, dmg: 22, el: 'nullvoid' });
					}
					c.end = 50 + n * 13 + 26;
				}
				return c.t >= c.end;
			} },

		/* Stars fall onto the highest surface below them; platforms give cover. Every third one hunts a player. */
		starfall: { name: 'Void Starfall', phase: 2, w: [0, 3, 2],
			dur: (B) => (B.phase >= 3 ? 12 : 9) * 8 + 56,
			step(B, s, c){
				if(c.t === 0){ warn('☄️ VOID STARFALL — TAKE COVER!', 1200); B.armRaised = 40; c.n = (B.phase >= 3 ? 12 : 9) + Math.min(3, party().length - 1) * 2; c.hunt = 0; }
				if(c.t % 8 === 0 && c.t / 8 < c.n){
					const i = c.t / 8;
					let x;
					if(i % 3 === 0){ const F = foes(s), p = F.length ? F[c.hunt++ % F.length] : null; x = (p ? p.cx : PX()) + (rnd() - 0.5) * 160; }
					else { const ps = plats(), p = ps[rnd() * ps.length | 0]; x = p.x + 30 + rnd() * (p.w - 60); }
					x = clamp(x, 60, WW() - 60);
					const pl = platTop(x);
					spawn({ k:'star', x, ty: pl ? pl.y : BOT() + 260, y0: CEIL() - 160, sx: (rnd() - 0.5) * 360, warn: 52, fall: 22, dmg: 30, pool: pl ? 1 : 0, el: 'arbiter' });
				}
				return c.t >= c.n * 8 + 56;
			} },

		/* Watching eyes that keep firing while he moves on to other attacks — one for every player. */
		eyes: { name: 'Eyes of the Abyss', phase: 2, w: [0, 2, 2],
			ok: () => !find('eye'),
			dur: () => 40,
			step(B, s, c){
				if(c.t === 0){
					warn('👁️ EYES OF THE ABYSS — BREAK THEIR LINE OF SIGHT!', 1400);
					B.armRaised = 40;
					const F = foes(s), off = [[-430, -170], [430, -170], [0, -440]];
					const n = F.length > 1 ? Math.min(4, F.length + (B.phase >= 3 ? 1 : 0)) : (B.phase >= 3 ? 3 : 2);
					for(let i = 0; i < n; i++){
						const p = F.length ? F[i % F.length] : { cx: PX(), cy: PY() }, o = off[i % 3];
						const x = clamp(p.cx + o[0], 120, WW() - 120), y = clamp(p.cy + o[1], CEIL() + 80, BOT() - 120);
						spawn({ k:'eye', x, y, life: 460, per: 90, off: 26 + i * 30, ch: 38, fire: 16, w: 16, len: 1500, dmg: 18, el: 'arbiter' });
					}
				}
				return c.t >= 40;
			} },

		/* NEW — a sigil follows his focus, then locks and detonates. With a party the blast is split between everyone
		   standing inside (stack up!) and nobody answering it hurts the whole raid. Alone: step out once it locks. */
		sentence: { name: 'Sentence of Ruin', phase: 1, w: [2, 2, 2],
			dur: () => 176,
			step(B, s, c){
				if(c.t === 0){
					const F = foes(s), multi = F.length > 1;
					warn(multi ? '⚖️ SENTENCE OF RUIN — STACK IN THE SIGIL TO SHARE IT!' : '⚖️ SENTENCE OF RUIN — LEAVE THE SIGIL WHEN IT LOCKS!', 2000);
					B.armRaised = 150;
					spawn({ k:'sentence', tid: F.length ? F[0].id : null, follow: 120, lock: 44, r: 190, dmg: 72, el: 'arbiter' });
					if(multi && F.length >= 3 && B.phase >= 3) spawn({ k:'sentence', tid: F[1].id, follow: 120, lock: 44, r: 190, dmg: 72, el: 'nullvoid' });
				}
				// later phases: echoes crack the floor across the court while the sigil hunts
				if(B.phase >= 2 && (c.t === 50 || c.t === 90)){
					// one echo on every platform (two on the dais)
					for(const pl of plats()){
						for(let i = 0; i < (pl.court === 'dais' ? 2 : 1); i++){
							const x = pl.x + 60 + rnd() * Math.max(1, pl.w - 120);
							spawn({ k:'blast', x, y: pl.y - 30, r: 110, delay: 46, dmg: 24, el: 'nullvoid', flat: 0.42 });
						}
					}
				}
				return c.t >= 176;
			} },

		/* NEW — he splits into reflections around the arena; each in turn tears straight through a player. */
		mirror: { name: 'Mirror Court', phase: 2, w: [0, 3, 3],
			ok: () => !find('clone'),
			dur: (B) => 46 + (B.phase >= 3 ? 5 : 4) * 20 + 40,
			step(B, s, c){
				if(c.t === 0){
					warn('🪞 MIRROR COURT — EVERY REFLECTION STRIKES!', 1500);
					B.armRaised = 9999;
					const F = foes(s), n = (B.phase >= 3 ? 5 : 4) + Math.min(2, F.length - 1);
					const base = -Math.PI / 2 + (rnd() - 0.5) * 0.6;
					for(let i = 0; i < n; i++){
						const p = F.length ? F[i % F.length] : { cx: PX(), cy: PY() };
						// spread around the upper arc so every dash crosses the floor at an angle
						const a = base + (i - (n - 1) / 2) * (2.6 / Math.max(1, n - 1)), d = 560;
						const x = clamp(p.cx + Math.cos(a) * d, 100, WW() - 100), y = clamp(p.cy + Math.sin(a) * d, CEIL() + 60, BOT() - 60);
						spawn({ k:'clone', x, y, ax: p.cx, ay: p.cy, warn: 46 + i * 20, dash: 16, len: 1150, w: 84, dmg: 34, f: p.cx > x ? 1 : -1, el: i % 2 ? 'nullvoid' : 'arbiter' });
					}
					c.end = 46 + n * 20 + 40;
				}
				const done = c.t >= c.end;
				if(done) B.armRaised = 0;
				return done;
			} },

		/* Lanes of judgement fall from the sky: every other lane, then the rest. Step sideways between strikes. */
		verdict: { name: "Arbiter's Verdict", phase: 3, w: [0, 0, 2],
			dur: (B, s) => 10 + 88 + ((s.enraged ? 3 : 2) - 1) * 76 + 40,
			step(B, s, c){
				if(c.t === 0){
					warn("⚖️ ARBITER'S VERDICT — STEP OUT OF THE LIT LANES!", 2400);
					goTo(s, clamp(PX(), 1300, 2700), clamp(PY() - 360, CEIL() + 140, 1100), 0.07, 14);
					c.k = 0; c.n = s.enraged ? 3 : 2; c.next = 10;
					c.lw = 380; c.x0 = PX() - c.lw * (0.25 + rnd() * 0.5);        // you start inside a condemned lane
					c.par = 0;
					B.armRaised = 9999;
				}
				if(c.k < c.n && c.t === c.next){
					const w = c.k === 0 ? 88 : 66;
					spawn({ k:'verdict', x0: c.x0, lw: c.lw, par: c.par, warn: w, fire: 30, dmg: 55 });
					c.par = 1 - c.par;
					c.next = c.t + w + 10; c.k++;
				}
				const done = c.k >= c.n && c.t >= c.next + 30;
				if(done) B.armRaised = 0;
				return done;
			} },

		/* Damage check: break his shield before the horizon collapses — or hide in the light. */
		horizon: { name: 'Event Horizon', phase: 3, w: [0, 0, 3],
			ok: (B, s) => s.fightT >= s.horizonAt,
			dur: () => 420,
			step(B, s, c){
				if(c.t === 0){
					warn('🌑 EVENT HORIZON — BREAK HIS SHIELD OR FIND THE LIGHT!', 2800);
					goTo(s, 2000, 1000, 0.08, 14);
					// two sanctuaries on the dais, one on a higher platform; none inside the encroaching void
					const tide = find('tide');
					const ok = p => !(tide && (tide.side < 0 ? p[0] < tide.front + 80 : p[0] > tide.front - 80));
					const dais = plats().find(p => p.court === 'dais') || plats()[0];
					const low = [0.12, 0.37, 0.63, 0.88].map(u => [dais.x + dais.w * u, dais.y - 60]).filter(ok);
					const high = plats().filter(p => p !== dais).map(p => [p.x + p.w / 2, p.y - 60]).filter(ok);
					const lights = [];
					for(let i = 0; i < 2 && low.length; i++){ const p = low.splice(rnd() * low.length | 0, 1)[0]; lights.push({ x: p[0], y: p[1], r: 115 }); }
					if(high.length){ const p = high[rnd() * high.length | 0]; lights.push({ x: p[0], y: p[1], r: 115 }); }
					c.hp0 = B.hp; c.need = Math.round(B.maxHp * 0.045);
					spawn({ k:'dark', dur: 420, lights, need: c.need, hp0: c.hp0 });
					s.horizonAt = s.fightT + 2700;
					B.armRaised = 9999;
				}
				if(c.t >= 60 && c.t % 70 === 0 && c.t < 380 && typeof spawnRaidBossProj === 'function'){
					const o = bc(B);
					for(let i = 0; i < 2; i++){
						const a = rnd() * TAU;
						const p = spawnRaidBossProj(o.x + Math.cos(a) * 120, o.y + Math.sin(a) * 120, Math.cos(a) * 2.6, Math.sin(a) * 2.6, {
							color: '#14000a', color2: '#ff3a66', power: 26, width: 30, height: 30, shape: 'orb',
							effects: ['slow'], maxAge: 300, homing: true, homingStrength: 0.03,
						});
						if(p){ p._vaStyle = 'orb'; p._vaEl = 'arbiter'; p.noWallCollide = true; }
					}
				}
				const dealt = c.hp0 - B.hp;
				if(dealt >= c.need){
					B.armRaised = 0; net({ k:'res', ok: 1 }); resolveHorizon(true);
					s.stagger = true; return true;
				}
				if(c.t >= 420){
					B.armRaised = 0; net({ k:'res', ok: 0 }); resolveHorizon(false);
					return true;
				}
				return false;
			} },
	};

	/* =============================================================
	   HAZARDS — tick (every client, hurts only the local player)
	   ============================================================= */
	function beamAng(h){ const k = clamp((h.t - h.warn - h.grow) / h.sweep, 0, 1); return h.a0 + h.sw * ease(k); }
	function beamLen(h){ return h.len * clamp((h.t - h.warn) / Math.max(1, h.grow), 0, 1); }
	function beamEnd(h){ const a = beamAng(h), L = beamLen(h); return [h.ox + Math.cos(a) * L, h.oy + Math.sin(a) * L]; }
	// x of the encroaching void's leading edge
	function tideFront(h){
		const edge = h.side < 0 ? -60 : WW() + 60, t = h.t;
		if(t < h.warn) return edge;
		if(t < h.warn + h.rise) return lerp(edge, h.front, ease((t - h.warn) / h.rise));
		if(t < h.warn + h.rise + h.hold) return h.front;
		return lerp(h.front, edge, ease(clamp((t - h.warn - h.rise - h.hold) / h.fall, 0, 1)));
	}
	const inTide = (h, x) => h.side < 0 ? x < tideFront(h) : x > tideFront(h);
	function inLight(h){
		if(!h || !h.lights) return false;
		for(const L of h.lights) if(Math.hypot(PX() - L.x, PY() - L.y) < L.r + 10) return true;
		return false;
	}
	function resolveHorizon(ok){
		const h = find('dark');
		const B = typeof raidBoss !== 'undefined' ? raidBoss : null;
		const o = B ? bc(B) : { x: 2000, y: 1000 };
		if(ok){
			if(window.EFX){ EFX.burst(o.x, o.y, 'verdict', 3); EFX.ring(o.x, o.y, 40, 520, 'verdict', 30, { width: 8 }); }
			shake(10, 14);
		} else {
			if(window.EFX){ EFX.burst(o.x, o.y, 'arbiter', 3.4); EFX.ring(o.x, o.y, 40, 1400, 'arbiter', 40, { width: 12 }); }
			shake(20, 26);
			// the collapse is the mechanic's whole point: hit-recovery frames from a tendril a moment ago don't save you
			if(!inLight(h) && typeof player !== 'undefined'){ player.iFrames = 0; hurt(70, ['knockback']); }
		}
		if(h) H.splice(H.indexOf(h), 1);
	}

	const TICK = {
		tel(h){ return h.t < h.d; },
		charge(h){
			if(window.EFX && h.t % 3 === 0) EFX.charge(h.x, h.y, 'arbiter', 220, 5, 26);
			return h.t < h.d;
		},
		beam(h){
			const end = h.warn + h.grow + h.sweep + 14;
			if(h.t >= h.warn){
				if(h.t === h.warn){ shake(5, 10); if(window.EFX) EFX.flash(h.ox, h.oy, 90, h.el, 12); }
				const e = beamEnd(h);
				if(window.EFX && h.t % 3 === 0) EFX.sparks(h.el, e[0], e[1], 3, { speed: 6 });
				if(h.t < end - 10 && h.t - (h.hit || -99) >= 10 && segDist(PX(), PY(), h.ox, h.oy, e[0], e[1]) < h.w * 0.5 + PR()){
					if(hurt(h.dmg, [], h.el)) h.hit = h.t;
				}
			}
			return h.t < end;
		},
		wave(h){
			h.x += h.dir * h.spd;
			if(window.EFX && h.t % 2 === 0) EFX.emit(h.el, h.x, h.y - 10, 2, { speed: 1.5, ang: -Math.PI / 2, spread: 1 });
			if(!h.hit && Math.abs(PX() - h.x) < 34 && player.y + player.h > h.y - h.h && player.y < h.y + 4){
				if(hurt(h.dmg, ['knockback'], h.el)) h.hit = 1;
			}
			return h.x > h.x0 - 30 && h.x < h.x1 + 30;
		},
		pillar(h){
			if(h.t === h.warn){
				if(window.EFX){ EFX.burst(h.x, h.y - 10, h.el, 1.4); EFX.debris('arbiter', h.x, h.y - 4, 5, { floor: h.y, speed: 5, kind: 'shard' }); }
				shake(4, 6);
			}
			if(h.t >= h.warn && h.t < h.warn + 8 && !h.hit && inRect(h.x - h.w / 2, h.y - h.hh, h.w, h.hh)){
				if(hurt(h.dmg, ['knockback'], h.el)) h.hit = 1;
			}
			return h.t < h.warn + h.life;
		},
		blast(h){
			if(h.t >= h.delay){
				if(window.EFX){ EFX.burst(h.x, h.y, h.el, h.r / 70); EFX.ring(h.x, h.y, 10, h.r, h.el, 18, { width: 5, flat: h.flat || 1 }); }
				const dy = (PY() - h.y) / (h.flat || 1);
				if(h.dmg > 0 && Math.hypot(PX() - h.x, dy) < h.r + PR()) hurt(h.dmg, h.eff, h.el);
				return false;
			}
			return true;
		},
		nova(h){
			const r = h.r0 + h.spd * h.t;
			if(h.dmg > 0 && !h.hit){
				const d = Math.hypot(PX() - h.x, PY() - h.y);
				if(Math.abs(d - r) < h.th * 0.5 + PR()){
					const a = Math.atan2(PY() - h.y, PX() - h.x);
					let safe = false;
					for(const g of h.gaps) if(Math.abs(angN(a - g)) < h.gw * 0.5) safe = true;
					if(!safe && hurt(h.dmg, h.eff || [], h.el || 'arbiter')) h.hit = 1;
				}
			}
			return r < h.maxR;
		},
		well(h){
			const dx = h.x - PX(), d = Math.abs(dx);
			if(d > 30 && d < h.r && !(player.iFrames > 0 && player.dashing)){
				const k = h.str * (0.45 + 0.55 * (1 - d / h.r)) * Math.min(1, h.t / 20);
				player.x += Math.sign(dx) * k;
			}
			if(window.EFX && h.t % 2 === 0) EFX.charge(h.x, h.y, 'nullvoid', 320 + rnd() * 300, 2, 34);
			return h.t < h.dur;
		},
		slash(h){
			if(h.t === h.warn){
				if(window.EFX){
					EFX.slash(h.x, h.y, h.ang, h.r * 0.82, h.arc, h.el, { life: 16, width: 46 });
					EFX.slash(h.x, h.y, h.ang, h.r * 0.6, h.arc * 0.9, 'nullvoid', { life: 12, width: 24, dir: -1 });
					EFX.sparks(h.el, h.x + Math.cos(h.ang) * h.r * 0.7, h.y + Math.sin(h.ang) * h.r * 0.7, 10, { speed: 9 });
				}
				shake(7, 10);
				const d = Math.hypot(PX() - h.x, PY() - h.y), a = Math.atan2(PY() - h.y, PX() - h.x);
				if(d < h.r + PR() && Math.abs(angN(a - h.ang)) < h.arc * 0.5) hurt(h.dmg, ['knockback'], h.el);
				return true;
			}
			return h.t < h.warn + 14;
		},
		rift(h){
			const lockT = h.warn - 34;
			if(h.t === lockT || (h.t < lockT && h.a == null)) h.a = Math.atan2(PY() - h.y, PX() - h.x);
			if(h.t === h.warn){ if(window.EFX) EFX.flash(h.x, h.y, 70, h.el, 10); shake(3, 6); }
			if(h.t >= h.warn && h.t < h.warn + h.fire && !h.hit){
				const ex = h.x + Math.cos(h.a) * h.len, ey = h.y + Math.sin(h.a) * h.len;
				if(segDist(PX(), PY(), h.x, h.y, ex, ey) < h.w * 0.5 + PR() && hurt(h.dmg, [], h.el)) h.hit = 1;
			}
			return h.t < h.warn + h.fire + 16;
		},
		star(h){
			if(h.t === h.warn){
				if(window.EFX){ EFX.burst(h.x, h.ty - 6, h.el, 1.8); EFX.ring(h.x, h.ty - 4, 10, 120, h.el, 20, { width: 5, flat: 0.35 }); }
				shake(4, 6);
				if(Math.abs(PX() - h.x) < 85 + PR() && Math.abs(player.y + player.h - h.ty) < 110) hurt(h.dmg, [], h.el);
				if(h.pool) addLocal({ k:'pool', x: h.x, y: h.ty, w: 150, dur: 240, dmg: 8 });
				return false;
			}
			return true;
		},
		pool(h){
			if(h.t % 24 === 0 && Math.abs(PX() - h.x) < h.w / 2 && Math.abs(player.y + player.h - h.y) < 14) hurt(h.dmg, ['slow'], 'nullvoid');
			if(window.EFX && h.t % 7 === 0 && h.t < h.dur - 20) EFX.emit('arbiter', h.x + (rnd() - 0.5) * h.w * 0.8, h.y - 4, 1, { speed: 0.8, ang: -Math.PI / 2, spread: 0.6 });
			return h.t < h.dur;
		},
		eye(h){
			const cyc = h.t - h.off;
			if(cyc >= 0 && cyc % h.per === 0 && h.t < h.life - h.ch - h.fire){ h.a = Math.atan2(PY() - eyeY(h), PX() - eyeX(h)); h.shot = h.t; h.hit = 0; }
			if(h.shot != null){
				const k = h.t - h.shot;
				if(k === h.ch && window.EFX) EFX.flash(eyeX(h), eyeY(h), 40, h.el, 8);
				if(k >= h.ch && k < h.ch + h.fire && !h.hit){
					const x = eyeX(h), y = eyeY(h);
					if(segDist(PX(), PY(), x, y, x + Math.cos(h.a) * h.len, y + Math.sin(h.a) * h.len) < h.w * 0.5 + PR() && hurt(h.dmg, [], h.el)) h.hit = 1;
				}
				if(k >= h.ch + h.fire) h.shot = null;
			}
			if(h.t === h.life - 1 && window.EFX) EFX.burst(eyeX(h), eyeY(h), h.el, 1.2);
			return h.t < h.life;
		},
		verdict(h){
			if(h.t === h.warn){
				shake(14, 20);
				if(laneDoomed(h, PX())) hurt(h.dmg, ['knockback'], 'verdict');
			}
			if(window.EFX && h.t > h.warn && h.t < h.warn + h.fire && h.t % 2 === 0){
				for(const p of plats()){
					const x = p.x + rnd() * p.w;
					if(laneDoomed(h, x)) EFX.sparks('verdict', x, p.y - 6, 2, { speed: 7, up: 3 });
				}
			}
			return h.t < h.warn + h.fire;
		},
		dark(h){ return h.t < h.dur + 90; },        // the host resolves it; this is only a safety net
		tide(h){
			const fx = tideFront(h);
			if(h.t % 15 === 0 && inTide(h, PX())) hurt(14, ['slow'], 'nullvoid');
			if(window.EFX && h.t >= h.warn && h.t % 3 === 0){
				const y = (typeof camera !== 'undefined' ? camera.y : 900) + rnd() * (typeof canvas !== 'undefined' ? canvas.height : 720);
				EFX.emit('arbiter', fx, y, 1, { speed: 1.4, ang: h.side < 0 ? 0 : Math.PI, spread: 0.8 });
			}
			return h.t < h.warn + h.rise + h.hold + h.fall;
		},
		ghost(h){ return h.t < h.life; },
		sentence(h){
			const end = h.follow + h.lock;
			if(h.t <= h.follow){ const p = posOf(h.tid); if(p){ h.x = p.cx; h.y = p.cy; } }
			if(h.x == null) return false;
			if(h.t === h.follow && window.EFX){ EFX.ring(h.x, h.y, h.r * 1.5, h.r, h.el, 14, { width: 5 }); EFX.flash(h.x, h.y, 60, h.el, 8); }
			if(h.t === end){
				const P = party(), me = P.find(p => p.me);
				const inside = P.filter(p => Math.hypot(p.cx - h.x, p.cy - h.y) < h.r + 16);
				if(window.EFX){
					EFX.burst(h.x, h.y, h.el, 2.6); EFX.ring(h.x, h.y, 20, h.r * 1.35, h.el, 22, { width: 9 });
					EFX.sparks(h.el, h.x, h.y, 14, { speed: 10 });
				}
				shake(10, 16);
				if(me && inside.indexOf(me) >= 0) hurt(h.dmg / inside.length, ['knockback'], h.el);      // shared between everyone who answered it
				else if(P.length > 1 && !inside.length) hurt(h.dmg * 0.45, [], h.el);                  // nobody answered: the whole raid pays
				return false;
			}
			return true;
		},
		clone(h){
			const ca = Math.cos(h.ang = Math.atan2(h.ay - h.y, h.ax - h.x)), sa = Math.sin(h.ang);
			if(h.t === h.warn){ if(window.EFX) EFX.flash(h.x, h.y, 70, h.el, 8); shake(3, 5); }
			if(h.t >= h.warn && h.t <= h.warn + h.dash){
				const k0 = Math.max(0, (h.t - 1 - h.warn) / h.dash), k1 = (h.t - h.warn) / h.dash;
				const x0 = h.x + ca * h.len * k0, y0 = h.y + sa * h.len * k0, x1 = h.x + ca * h.len * k1, y1 = h.y + sa * h.len * k1;
				if(!h.hit && segDist(PX(), PY(), x0, y0, x1, y1) < h.w * 0.5 + PR() && hurt(h.dmg, ['knockback'], h.el)) h.hit = 1;
				if(window.EFX && h.t % 2 === 0) EFX.emit(h.el, x1, y1, 2, { speed: 2 });
				if(h.t === h.warn + h.dash && window.EFX){ EFX.burst(x1, y1, h.el, 1.4); }
			}
			return h.t < h.warn + h.dash + 18;
		},
		blink(h){
			if(h.t === 1 && window.EFX){ EFX.burst(h.x0, h.y0, 'nullvoid', 1.3); }
			if(h.t === (h.d >> 1) && window.EFX){ EFX.burst(h.x1, h.y1, 'arbiter', 1.6); EFX.ring(h.x1, h.y1, 20, 160, 'arbiter', 16, { width: 5 }); }
			return h.t < h.d;
		},
	};
	function eyeX(h){ return h.x + Math.sin(h.t * 0.021 + h.off) * 34; }
	function eyeY(h){ return h.y + Math.cos(h.t * 0.017 + h.off) * 20; }

	// orbs: orbit while held, then launch at the local player; homing only for a while so they can be outrun
	function projTick(p){
		if(p._vaHold){
			if(p.age < p._vaHold){
				const a = p._vaA + p.age * 0.035;
				p.x = p._vaOx + Math.cos(a) * p._vaR; p.y = p._vaOy + Math.sin(a) * p._vaR; p.vx = 0; p.vy = 0;
			} else if(!p._vaGo){
				p._vaGo = 1;
				const a = Math.atan2(PY() - p.y, PX() - p.x);
				p.vx = Math.cos(a) * p._vaSpd; p.vy = Math.sin(a) * p._vaSpd; p.homing = true;
				if(window.EFX) EFX.flash(p.x, p.y, 30, p._vaEl || 'nullvoid', 8);
			} else if(p.age - p._vaHold > 80) p.homing = false;
		}
	}

	function deathFx(B){
		if(!window.EFX) return;
		const o = bc(B), t = B.deathTimer;
		if(t < 100 && t % 3 === 0) EFX.charge(o.x, o.y, 'arbiter', 260, 4, 22);
		if(t % 14 === 0 && t < 100) EFX.burst(o.x + (rnd() - 0.5) * B.w, o.y + (rnd() - 0.5) * B.h, rnd() < 0.5 ? 'arbiter' : 'nullvoid', 1.2);
		if(t === 100){ EFX.burst(o.x, o.y, 'arbiter', 4); EFX.ring(o.x, o.y, 30, 900, 'arbiter', 40, { width: 14 }); EFX.ring(o.x, o.y, 30, 600, 'verdict', 34, { width: 6 }); shake(18, 30); }
	}

	function tick(){
		if(typeof IS_RAID === 'undefined' || !IS_RAID || typeof raidBoss === 'undefined' || !raidBoss) return;
		ensurePal();
		F++;
		const B = raidBoss;
		if(B.dead){
			if(!deadDone){
				deadDone = true; H.length = 0; setCast(null); HUD.stagger = 0;
				if(typeof enemyProjectiles !== 'undefined') for(let i = enemyProjectiles.length - 1; i >= 0; i--) if(enemyProjectiles[i]._vaStyle) enemyProjectiles.splice(i, 1);
			}
			deathFx(B);
			return;
		}
		if(HUD.cast) HUD.castT++;
		if(HUD.stagger > 0) HUD.stagger--;
		if(typeof enemyProjectiles !== 'undefined') for(const p of enemyProjectiles) if(p._vaStyle) projTick(p);
		for(let i = H.length - 1; i >= 0; i--){
			const h = H[i];
			if(!h) continue;
			h.t++;
			const fn = TICK[h.k];
			if(!fn || fn(h) === false){ const j = H.indexOf(h); if(j >= 0) H.splice(j, 1); }
		}
	}

	/* guest: replay host events */
	function onNet(d){
		if(!d) return;
		if(d.k === 'hzs'){ for(const h of (d.l || [])) addLocal(Object.assign({}, h)); }
		else if(d.k === 'cast') setCast(d.n, d.d);
		else if(d.k === 'res') resolveHorizon(!!d.ok);
		else if(d.k === 'stag') HUD.stagger = d.d || 300;
		else if(d.k === 'enr') HUD.enraged = true;
		else if(d.k === 'tgt') setTgt(d.id);
	}

	/* =============================================================
	   DRAWING
	   ============================================================= */
	const G = (x, y, r, hex, a, hard) => EFX.glow(x, y, r, hex, a, hard);
	function wedge(c, x, y, a0, a1, r, prog, col, colEdge){
		const sx = x - camera.x, sy = y - camera.y, lo = Math.min(a0, a1), hi = Math.max(a0, a1);
		c.save();
		const g = c.createRadialGradient(sx, sy, 0, sx, sy, r);
		g.addColorStop(0, col.replace('A', (0.05 + 0.12 * prog).toFixed(3)));
		g.addColorStop(1, col.replace('A', (0.16 + 0.16 * prog).toFixed(3)));
		c.fillStyle = g;
		c.beginPath(); c.moveTo(sx, sy); c.arc(sx, sy, r, lo, hi); c.closePath(); c.fill();
		c.strokeStyle = colEdge; c.lineWidth = 1.5; c.setLineDash([12, 8]); c.lineDashOffset = -F;
		c.stroke(); c.setLineDash([]);
		c.restore();
	}

	/* =============================================================
	   THE ARBITER'S COURT — arena art
	   A tribunal hung over the void on chains. Static stone is rendered once into
	   offscreen canvases; each frame only blits them and adds a few cheap glows.
	   ============================================================= */
	function seeded(n){ let s = (n * 9301 + 49297) % 233280 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
	function mk(w, h){ const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.ceil(w)); cv.height = Math.max(1, Math.ceil(h)); return cv; }

	// distant court: broken colonnade, floating ruins and the Arbiter's seal (a ring holding a balance), half resolution
	const BG_W = 1700, BG_H = 950, BG_PX = 0.3, BG_PY = 0.18;
	let bgCv = null;
	function buildBackdrop(){
		bgCv = mk(BG_W, BG_H);
		const d = bgCv.getContext('2d'), R = seeded(7);
		// the seal glows behind everything
		const sx = 640, sy = 300;
		let g = d.createRadialGradient(sx, sy, 20, sx, sy, 420);
		g.addColorStop(0, 'rgba(120,10,50,0.4)'); g.addColorStop(0.5, 'rgba(60,6,40,0.18)'); g.addColorStop(1, 'rgba(20,0,20,0)');
		d.fillStyle = g; d.fillRect(0, 0, BG_W, BG_H);
		// far floating ruins
		for(let i = 0; i < 16; i++){
			const x = R() * BG_W, y = 120 + R() * 420, w = 18 + R() * 60, h = 10 + R() * 26;
			d.fillStyle = 'rgba(14,6,26,' + (0.5 + R() * 0.4) + ')';
			d.beginPath(); d.moveTo(x, y); d.lineTo(x + w, y + R() * 4); d.lineTo(x + w * 0.7, y + h); d.lineTo(x + w * 0.3, y + h * 1.4); d.closePath(); d.fill();
			d.fillStyle = 'rgba(255,58,102,0.35)'; d.fillRect(x + w * 0.4, y + 2, 2, 2);
		}
		// the seal: double ring, rune ticks, and a balance hanging inside
		d.save(); d.translate(sx, sy);
		d.strokeStyle = 'rgba(255,58,102,0.32)'; d.lineWidth = 5; d.beginPath(); d.arc(0, 0, 250, 0, TAU); d.stroke();
		d.strokeStyle = 'rgba(255,58,102,0.18)'; d.lineWidth = 2; d.beginPath(); d.arc(0, 0, 225, 0, TAU); d.stroke();
		d.fillStyle = 'rgba(255,90,130,0.3)';
		for(let i = 0; i < 36; i++){ const a = i * TAU / 36; d.save(); d.rotate(a); d.fillRect(232, -2, i % 3 ? 8 : 14, 4); d.restore(); }
		d.strokeStyle = 'rgba(30,6,30,0.9)'; d.fillStyle = 'rgba(22,4,24,0.92)'; d.lineWidth = 6;
		d.beginPath(); d.moveTo(0, -200); d.lineTo(0, 170); d.stroke();                       // the spire
		d.beginPath(); d.moveTo(-170, -110); d.lineTo(170, -90); d.stroke();                   // the beam, never level
		for(const [bx, by] of [[-170, -110], [170, -90]]){
			d.lineWidth = 2; d.beginPath(); d.moveTo(bx, by); d.lineTo(bx - 40, by + 110); d.moveTo(bx, by); d.lineTo(bx + 40, by + 110); d.stroke();
			d.beginPath(); d.ellipse(bx, by + 112, 52, 12, 0, 0, Math.PI); d.fill();
		}
		d.beginPath(); d.moveTo(-26, 170); d.lineTo(26, 170); d.lineTo(0, 210); d.closePath(); d.fill();
		d.restore();
		// broken colonnade along the bottom
		for(let i = 0; i < 22; i++){
			const x = i * 82 + R() * 30, w = 26 + R() * 14, top = 470 + R() * 220, broken = R() < 0.45;
			const cg = d.createLinearGradient(x, 0, x + w, 0);
			cg.addColorStop(0, '#0a0414'); cg.addColorStop(0.5, '#1a0c28'); cg.addColorStop(1, '#08030f');
			d.fillStyle = cg;
			d.beginPath(); d.moveTo(x, BG_H);
			if(broken){ d.lineTo(x, top + 20); d.lineTo(x + w * 0.4, top); d.lineTo(x + w * 0.7, top + 30); d.lineTo(x + w, top + 12); }
			else { d.lineTo(x - 6, top); d.lineTo(x + w + 6, top); d.lineTo(x + w + 6, top + 12); d.lineTo(x + w, top + 14); d.lineTo(x, top + 14); d.lineTo(x - 6, top + 12); d.lineTo(x - 6, top); }
			d.lineTo(x + w, BG_H); d.closePath(); d.fill();
			d.fillStyle = 'rgba(255,58,102,' + (0.2 + R() * 0.3) + ')';
			d.fillRect(x + w * 0.45, top + 40 + R() * 60, 2, 30 + R() * 80);          // rune slit
		}
		// arches linking pairs of whole columns
		d.strokeStyle = 'rgba(18,8,30,0.95)'; d.lineWidth = 16;
		for(let i = 1; i < 20; i += 3){ const x = i * 82 + 20; d.beginPath(); d.arc(x + 41, 560, 58, Math.PI, TAU); d.stroke(); }
		// low haze
		g = d.createLinearGradient(0, BG_H - 260, 0, BG_H);
		g.addColorStop(0, 'rgba(10,0,20,0)'); g.addColorStop(1, 'rgba(10,0,20,0.9)');
		d.fillStyle = g; d.fillRect(0, BG_H - 260, BG_W, 260);
	}
	function drawBackdrop(){
		if(!bgCv) buildBackdrop();
		const sx = -camera.x * BG_PX, sy = -camera.y * BG_PY + 40;
		ctx.drawImage(bgCv, sx, sy, BG_W * 2, BG_H * 2);
		// the seal breathes with his rage
		const p = raidBoss ? raidBoss.phase : 1;
		ctx.save(); ctx.globalCompositeOperation = 'lighter';
		EFX.glowS(sx + 640 * 2, sy + 300 * 2, 300 + 40 * Math.sin(F * 0.02), '#a3093c', 0.05 + 0.04 * p);
		ctx.restore();
	}

	// one cached slab per platform: rune-cut top, obsidian face, broken rock hanging beneath
	const slabs = new Map();
	const DEPTH = { dais: 150, stand: 100, gallery: 80, shard: 70 };
	function buildSlab(pl){
		const kind = pl.court || 'stand', depth = DEPTH[kind] || 90, pad = 24;
		const W = pl.w + pad * 2, Hh = pl.h + depth + pad;
		const cv = mk(W, Hh), d = cv.getContext('2d'), R = seeded(pl.x + pl.y * 7);
		const crack = mk(W, Hh), k = crack.getContext('2d');
		const x0 = pad, top = 0, bot = pl.h;
		// jagged underside, tapering to a point toward the middle
		d.beginPath(); d.moveTo(x0 - 6, bot);
		const n = Math.max(6, pl.w / 40 | 0);
		for(let i = 0; i <= n; i++){
			const u = i / n, taper = Math.sin(u * Math.PI);
			d.lineTo(x0 + u * pl.w + (R() - 0.5) * 14, bot + 10 + taper * depth * (0.55 + R() * 0.45));
		}
		d.lineTo(x0 + pl.w + 6, bot); d.closePath();
		let g = d.createLinearGradient(0, bot, 0, bot + depth);
		g.addColorStop(0, '#1d0f2a'); g.addColorStop(0.6, '#0c0516'); g.addColorStop(1, '#040108');
		d.fillStyle = g; d.fill();
		d.strokeStyle = 'rgba(255,58,102,0.12)'; d.lineWidth = 1; d.stroke();
		// strata lines in the hanging rock
		d.strokeStyle = 'rgba(60,30,80,0.35)';
		for(let i = 0; i < 3; i++){ const y = bot + 14 + i * depth * 0.18; d.beginPath(); d.moveTo(x0 + pl.w * 0.12, y); d.lineTo(x0 + pl.w * 0.88, y + (R() - 0.5) * 6); d.stroke(); }
		// obsidian face
		g = d.createLinearGradient(0, top, 0, bot);
		g.addColorStop(0, '#3c2850'); g.addColorStop(0.18, '#2a1a3a'); g.addColorStop(1, '#140a1e');
		d.fillStyle = g; d.fillRect(x0 - 6, top, pl.w + 12, pl.h);
		// worn top edge and highlight
		d.fillStyle = '#5a4270'; d.fillRect(x0 - 6, top, pl.w + 12, 3);
		d.fillStyle = 'rgba(255,220,240,0.25)'; d.fillRect(x0 - 6, top, pl.w + 12, 1);
		// block seams
		d.fillStyle = 'rgba(0,0,0,0.45)';
		for(let x = x0 + 50 + R() * 30; x < x0 + pl.w - 20; x += 70 + R() * 40) d.fillRect(x, top + 4, 2, pl.h - 4);
		// rune groove (lit at runtime)
		const gy = top + Math.round(pl.h * 0.55);
		d.fillStyle = 'rgba(8,2,12,0.8)'; d.fillRect(x0 + 10, gy - 2, pl.w - 20, 4);
		d.fillStyle = 'rgba(255,58,102,0.45)';
		for(let x = x0 + 18; x < x0 + pl.w - 18; x += 22 + R() * 10){ const s = 2 + (R() * 3 | 0); d.fillRect(x, gy - s / 2, s, s); }
		// end caps: bronze-dark trim with a diamond stud
		for(const ex of [x0 - 6, x0 + pl.w - 6]){
			d.fillStyle = '#4a2a3a'; d.fillRect(ex, top, 12, pl.h);
			d.fillStyle = 'rgba(255,120,150,0.6)';
			d.beginPath(); d.moveTo(ex + 6, top + pl.h * 0.5 - 4); d.lineTo(ex + 10, top + pl.h * 0.5); d.lineTo(ex + 6, top + pl.h * 0.5 + 4); d.lineTo(ex + 2, top + pl.h * 0.5); d.closePath(); d.fill();
		}
		// the dais carries the Arbiter's mark on its face
		if(kind === 'dais'){
			const cx = x0 + pl.w / 2, cy = bot + 46;
			d.strokeStyle = 'rgba(255,58,102,0.55)'; d.lineWidth = 2;
			d.beginPath(); d.arc(cx, cy, 30, 0, TAU); d.stroke();
			d.beginPath(); d.moveTo(cx - 22, cy); d.quadraticCurveTo(cx, cy - 16, cx + 22, cy); d.quadraticCurveTo(cx, cy + 16, cx - 22, cy); d.stroke();
			d.fillStyle = 'rgba(255,58,102,0.7)'; d.beginPath(); d.ellipse(cx, cy, 3, 9, 0, 0, TAU); d.fill();
		}
		// cracks that only glow once the court starts to break (phase 2+)
		k.lineCap = 'round';
		const cracks = Math.max(2, pl.w / 260 | 0);
		for(let i = 0; i < cracks; i++){
			let x = x0 + 30 + R() * (pl.w - 60), y = top + 2;
			k.beginPath(); k.moveTo(x, y);
			const len = 4 + (R() * 4 | 0);
			for(let j = 0; j < len; j++){ x += (R() - 0.5) * 30; y += 8 + R() * (depth / len); k.lineTo(x, y); }
			k.strokeStyle = 'rgba(255,58,102,0.9)'; k.lineWidth = 2.2; k.stroke();
			k.strokeStyle = 'rgba(255,230,240,0.8)'; k.lineWidth = 0.8; k.stroke();
		}
		const o = { cv, crack, pad, depth, gy };
		slabs.set(pl, o);
		return o;
	}

	function drawChain(c, x, y0, y1, sway, broken){
		const sx = x - camera.x;
		if(sx < -40 || sx > canvas.width + 40 || y1 - camera.y < -20) return;
		const top = Math.max(y0, camera.y - 40);
		const len = y1 - top;
		if(len <= 0) return;
		c.lineCap = 'butt';
		c.strokeStyle = '#1a1024'; c.lineWidth = 6; c.setLineDash([12, 6]);
		c.beginPath(); c.moveTo(sx, top - camera.y); c.quadraticCurveTo(sx + sway, (top + y1) / 2 - camera.y, sx, y1 - camera.y); c.stroke();
		c.strokeStyle = '#3a2a48'; c.lineWidth = 2; c.lineDashOffset = 9;
		c.beginPath(); c.moveTo(sx, top - camera.y); c.quadraticCurveTo(sx + sway, (top + y1) / 2 - camera.y, sx, y1 - camera.y); c.stroke();
		c.setLineDash([]); c.lineDashOffset = 0;
		if(broken){ c.fillStyle = 'rgba(255,58,102,0.6)'; c.fillRect(sx - 3, top - camera.y - 2, 6, 3); }
	}

	function drawAbyss(){
		const c = ctx, W = canvas.width, Ht = canvas.height, ay = BOT() + 60 - camera.y;
		if(ay > Ht + 20) return;
		const g = c.createLinearGradient(0, ay, 0, ay + 520);
		g.addColorStop(0, 'rgba(12,0,22,0.25)'); g.addColorStop(0.45, 'rgba(6,0,12,0.75)'); g.addColorStop(1, '#010003');
		c.fillStyle = g; c.fillRect(0, ay, W, Ht - ay + 40);
		// a slow maelstrom churning under the dais
		const mx = 2000 - camera.x, my = BOT() + 520 - camera.y, p = raidBoss ? raidBoss.phase : 1;
		c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
		EFX.glowS(mx, my, 520, '#4a128f', 0.25 + 0.08 * p);
		EFX.glowS(mx, my, 220, '#a3093c', 0.2 + 0.1 * p);
		for(let i = 0; i < 9; i++){
			const r = 160 + i * 130, a0 = F * (0.006 + (8 - i) * 0.0012) * (i % 2 ? 1 : -1) + i * 1.3;
			c.strokeStyle = (i % 2 ? 'rgba(180,108,255,' : 'rgba(255,58,102,') + (0.2 - i * 0.015) + ')';
			c.lineWidth = 3 - i * 0.2;
			c.beginPath(); c.ellipse(mx, my, r, r * 0.22, 0, a0, a0 + 1.9); c.stroke();
			c.beginPath(); c.ellipse(mx, my, r, r * 0.22, 0, a0 + Math.PI, a0 + Math.PI + 1.2); c.stroke();
		}
		// motes rising out of the abyss
		for(let i = 0; i < 18; i++){
			const wx = (i * 241.7) % WW(), rise = (F * (0.6 + (i % 5) * 0.25) + i * 97) % 520;
			const x = wx - camera.x + Math.sin(F * 0.02 + i) * 14, y = BOT() + 480 - rise - camera.y;
			if(x < -20 || x > W + 20) continue;
			EFX.glowS(x, y, 4 + (i % 3) * 2, i % 2 ? '#ff3a66' : '#b46cff', 0.5 * Math.sin(rise / 520 * Math.PI));
		}
		c.restore();
	}

	function drawPlatforms(){
		const c = ctx, W = canvas.width, p = raidBoss ? raidBoss.phase : 1, t = F;
		const list = (typeof sandboxPlatforms !== 'undefined' ? sandboxPlatforms : plats());
		// chains first, behind the stone
		c.save();
		for(const pl of list){
			if(pl.isWall || !pl.court) continue;
			if(pl.x - camera.x > W + 60 || pl.x + pl.w - camera.x < -60) continue;
			const ends = pl.court === 'dais' ? [pl.x + 60, pl.x + pl.w * 0.33, pl.x + pl.w * 0.67, pl.x + pl.w - 60] : [pl.x + 30, pl.x + pl.w - 30];
			ends.forEach((x, i) => {
				// from phase 2 a few chains have snapped and hang loose
				const broken = p >= 2 && (pl.court === 'shard' || (pl.court === 'stand' && i === 1));
				const y0 = broken ? pl.y - 160 - (i * 37 % 60) : -200;
				drawChain(c, x, y0, pl.y + 2, broken ? Math.sin(t * 0.04 + x) * 18 : Math.sin(t * 0.01 + x * 0.01) * 4, broken);
			});
		}
		c.restore();
		for(const pl of list){
			if(pl.isWall) continue;
			if(pl.x - camera.x > W + 60 || pl.x + pl.w - camera.x < -60) continue;
			const S = slabs.get(pl) || buildSlab(pl);
			const dx = pl.x - S.pad - camera.x, dy = pl.y - camera.y;
			c.drawImage(S.cv, dx, dy);
			if(p >= 2){
				c.save(); c.globalCompositeOperation = 'lighter';
				c.globalAlpha = (p >= 3 ? 0.55 : 0.25) + 0.2 * Math.sin(t * 0.06 + pl.x);
				c.drawImage(S.crack, dx, dy);
				c.restore();
			}
			// living runes: a glow that runs along the groove
			c.save(); c.globalCompositeOperation = 'lighter';
			const gy = dy + S.gy, run = ((t * 3 + pl.x) % (pl.w + 200)) - 100;
			const g = c.createLinearGradient(pl.x - camera.x + run - 120, 0, pl.x - camera.x + run + 120, 0);
			g.addColorStop(0, 'rgba(255,58,102,0)'); g.addColorStop(0.5, 'rgba(255,90,130,' + (0.45 + 0.1 * p) + ')'); g.addColorStop(1, 'rgba(255,58,102,0)');
			c.fillStyle = g; c.fillRect(pl.x - camera.x + 10, gy - 2, pl.w - 20, 4);
			if(pl.court === 'dais') EFX.glowS(pl.x + pl.w / 2 - camera.x, dy + pl.h + 46, 46 + 6 * Math.sin(t * 0.05), '#ff3a66', 0.35 + 0.1 * p);
			// void dripping from the broken underside
			for(let i = 0; i < 3; i++){
				const k = ((t * 0.9 + i * 53 + pl.x) % 90) / 90, x = pl.x + pl.w * (0.25 + i * 0.25) - camera.x;
				EFX.glowS(x, dy + pl.h + S.depth * 0.55 + k * 70, 4, '#b46cff', 0.6 * (1 - k));
			}
			c.restore();
		}
	}

	function drawArena(){
		if(!window.EFX) return;
		ensurePal(); EFX.bind();
		drawAbyss();
		drawPlatforms();
	}

	function drawSky(){
		if(typeof raidBoss === 'undefined' || !raidBoss || !window.EFX) return;
		ensurePal(); EFX.bind();
		drawBackdrop();
		const c = ctx, W = canvas.width, Ht = canvas.height, p = raidBoss.phase, t = F;
		c.save(); c.globalCompositeOperation = 'lighter';
		// drifting motes, parallax 0.25
		for(let i = 0; i < 26; i++){
			const wx = (i * 997 % 4400), wy = (i * 613 % 2000);
			const sx = ((wx - camera.x * 0.25 + t * (0.2 + (i % 5) * 0.08)) % (W + 80) + W + 80) % (W + 80) - 40;
			const sy = ((wy - camera.y * 0.25 - t * (0.15 + (i % 3) * 0.1)) % (Ht + 80) + Ht + 80) % (Ht + 80) - 40;
			EFX.glowS(sx, sy, 3 + (i % 4) * 2, i % 3 ? '#a3093c' : '#4a128f', 0.35 + 0.25 * Math.sin(t * 0.03 + i));
		}
		// phase 2+: tears in the sky
		if(p >= 2){
			const tears = [[0.18, 0.2, 0.9], [0.62, 0.12, 1.2], [0.86, 0.34, 0.7]];
			for(let k = 0; k < tears.length; k++){
				const T = tears[k], bx = T[0] * W - camera.x * 0.08 % W, by = T[1] * Ht - camera.y * 0.05, L = 220 * T[2];
				const pul = 0.6 + 0.4 * Math.sin(t * 0.04 + k * 2);
				c.lineCap = 'round';
				for(const pass of [[14, 'rgba(163,9,60,0.25)'], [5, 'rgba(255,58,102,0.7)'], [1.6, 'rgba(255,240,244,0.9)']]){
					c.strokeStyle = pass[1]; c.lineWidth = pass[0] * pul; c.beginPath();
					for(let j = 0; j <= 8; j++){
						const u = j / 8, x = bx + u * L * 0.35 + Math.sin(j * 2.3 + k) * 16, y = by + u * L;
						j ? c.lineTo(x, y) : c.moveTo(x, y);
					}
					c.stroke();
				}
				EFX.glowS(bx + L * 0.17, by + L * 0.5, L * 0.5, '#a3093c', 0.22 * pul);
			}
		}
		// phase 3: a vast eye watches from beyond the veil
		if(p >= 3){
			const ex = W * 0.5 - (camera.x - 1700) * 0.05, ey = Ht * 0.16 - (camera.y - 900) * 0.03;
			const open = 0.7 + 0.3 * Math.sin(t * 0.012), A = Math.min(260, W * 0.22), Bh = A * 0.34 * open;
			EFX.glowS(ex, ey, A * 1.5, '#a3093c', 0.2);
			c.globalCompositeOperation = 'source-over';
			c.save(); c.translate(ex, ey); c.globalAlpha = 0.3;
			const lid = () => { c.beginPath(); c.moveTo(-A, 0); c.quadraticCurveTo(0, -Bh * 2, A, 0); c.quadraticCurveTo(0, Bh * 2, -A, 0); c.closePath(); };
			lid(); c.fillStyle = '#3a0618'; c.fill();
			c.save(); lid(); c.clip();
			const look = Math.sin(t * 0.008) * A * 0.25, ir = Bh * 1.05;
			const ig = c.createRadialGradient(look, 0, 0, look, 0, ir);
			ig.addColorStop(0, '#ffb0c0'); ig.addColorStop(0.45, '#ff3a66'); ig.addColorStop(1, '#5a0624');
			c.fillStyle = ig; c.beginPath(); c.arc(look, 0, ir, 0, TAU); c.fill();
			c.fillStyle = '#0a0004'; c.beginPath(); c.ellipse(look, 0, ir * 0.16, ir * 0.85, 0, 0, TAU); c.fill();
			c.restore();
			lid(); c.strokeStyle = 'rgba(255,58,102,0.8)'; c.lineWidth = 2; c.stroke();
			c.restore();
		}
		c.restore();
	}

	function drawAura(B){
		if(!window.EFX || !B) return;
		ensurePal(); EFX.bind();
		const c = ctx, o = bc(B), p = B.phase, t = F, casting = B.armRaised > 0;
		const st_ = HUD.stagger > 0 || (B.va && B.va.mode === 'stagger');
		c.save(); c.globalCompositeOperation = 'lighter';
		G(o.x, o.y, B.w * (0.9 + 0.2 * p) * (1 + 0.05 * Math.sin(t * 0.08)), '#a3093c', st_ ? 0.25 : 0.42 + 0.08 * p);
		G(o.x, o.y, B.w * 0.55, '#ff3a66', st_ ? 0.1 : 0.22);
		// rune halo below him
		const sx = o.x - camera.x, sy = o.y + B.h * 0.42 - camera.y, spin = t * (casting ? 0.05 : 0.015);
		c.save();
		c.translate(sx, sy); c.scale(1, 0.32);
		c.strokeStyle = casting ? 'rgba(255,90,130,0.85)' : 'rgba(255,58,102,0.45)'; c.lineWidth = 3;
		c.beginPath(); c.arc(0, 0, 118, spin, spin + TAU * 0.82); c.stroke();
		c.strokeStyle = 'rgba(180,108,255,0.5)'; c.lineWidth = 2;
		c.beginPath(); c.arc(0, 0, 92, -spin * 1.6, -spin * 1.6 + TAU * 0.7); c.stroke();
		c.fillStyle = casting ? 'rgba(255,220,230,0.9)' : 'rgba(255,120,150,0.6)';
		for(let i = 0; i < 8; i++){ const a = spin + i * TAU / 8; c.fillRect(Math.cos(a) * 118 - 3, Math.sin(a) * 118 - 3, 6, 6); }
		c.restore();
		// orbiting void motes (phase 2+)
		if(p >= 2 && !st_){
			for(let i = 0; i < 3 + p; i++){
				const a = t * 0.03 + i * TAU / (3 + p), rr = B.w * 0.62;
				G(o.x + Math.cos(a) * rr, o.y + Math.sin(a) * rr * 0.55, 9, i % 2 ? '#b46cff' : '#ff3a66', 0.9, true);
			}
		}
		c.restore();
	}

	// colour the sprite's own silhouette (no box): one small offscreen pass
	let tc = null;
	function tintSprite(sx, sy, fw, fh, bx, by, B, col, a){
		if(a <= 0.01) return;
		const w = Math.ceil(B.w), h = Math.ceil(B.h);
		if(!tc) tc = document.createElement('canvas');
		if(tc.width !== w || tc.height !== h){ tc.width = w; tc.height = h; }
		const d = tc.getContext('2d');
		d.globalCompositeOperation = 'source-over'; d.clearRect(0, 0, w, h);
		if(B.facing > 0){ d.save(); d.translate(w, 0); d.scale(-1, 1); d.drawImage(BOSS_SPRITE, sx, sy, fw, fh, 0, 0, w, h); d.restore(); }
		else d.drawImage(BOSS_SPRITE, sx, sy, fw, fh, 0, 0, w, h);
		d.globalCompositeOperation = 'source-in'; d.fillStyle = col; d.fillRect(0, 0, w, h);
		ctx.save(); ctx.globalAlpha = a; ctx.drawImage(tc, bx, by); ctx.restore();
	}

	function bossAlpha(){
		const b = find('blink'), mir = find('clone') ? 0.4 : 1;      // during Mirror Court he is only one reflection among many
		if(!b) return mir;
		const half = b.d / 2;
		return mir * (b.t < half ? Math.max(0.05, 1 - b.t / half) : Math.min(1, (b.t - half) / half));
	}

	function drawGhost(h){
		if(typeof BOSS_SPRITE === 'undefined' || !BOSS_SPRITE.complete || !BOSS_SPRITE.naturalWidth) return;
		const c = ctx, fw = BOSS_SPRITE.naturalWidth / BOSS_SPRITE_COLS, fh = BOSS_SPRITE.naturalHeight / BOSS_SPRITE_ROWS;
		const a = (1 - h.t / h.life) * 0.5, sx = h.x - camera.x - h.t * 0.6 * (h.f > 0 ? 1 : -1), sy = h.y - camera.y;
		c.save(); c.globalAlpha = a;
		if(h.f > 0){ c.translate(sx + h.w, sy); c.scale(-1, 1); c.drawImage(BOSS_SPRITE, 0, fh, fw, fh, 0, 0, h.w, h.h); }
		else c.drawImage(BOSS_SPRITE, 0, fh, fw, fh, sx, sy, h.w, h.h);
		c.restore();
		c.save(); c.globalCompositeOperation = 'lighter';
		G(h.x + h.w / 2, h.y + h.h / 2, h.w * 0.7, '#4a128f', a);
		c.restore();
	}

	function drawPillar(h){
		const c = ctx;
		if(h.t < h.warn){
			if(h.show != null && h.t < h.show) return;
			const prog = clamp((h.t - (h.show != null ? h.show : 0)) / Math.max(1, h.warn - (h.show != null ? h.show : 0)), 0, 1);
			EFX.warnRect(h.x - h.w / 2, h.y - h.hh, h.w, h.hh, prog, h.el, { alpha: 0.7 });
			c.save(); c.globalCompositeOperation = 'lighter';
			G(h.x, h.y - 3, h.w * (0.6 + prog * 0.6), '#ff3a66', 0.5 + 0.4 * prog);
			c.restore();
			return;
		}
		const k = h.t - h.warn, grow = ease(Math.min(1, k / 5)), fade = 1 - clamp((k - h.life + 10) / 10, 0, 1);
		const H_ = h.hh * grow, sx = h.x - camera.x, sy = h.y - camera.y;
		c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = fade;
		const g = c.createLinearGradient(sx - h.w / 2, 0, sx + h.w / 2, 0);
		g.addColorStop(0, 'rgba(163,9,60,0)'); g.addColorStop(0.3, 'rgba(255,58,102,0.55)'); g.addColorStop(0.5, 'rgba(255,240,244,0.95)');
		g.addColorStop(0.7, 'rgba(255,58,102,0.55)'); g.addColorStop(1, 'rgba(163,9,60,0)');
		c.fillStyle = g; c.fillRect(sx - h.w / 2, sy - H_, h.w, H_);
		G(h.x, h.y - H_, h.w * 0.9, '#ff3a66', 0.9);
		G(h.x, h.y - 4, h.w * 1.1, '#a3093c', 0.8);
		c.restore();
		c.save(); c.globalAlpha = fade;
		EFX.spike(h.x, h.y, H_ * 0.62, h.w * 0.55, 'arbiter');
		EFX.spike(h.x - h.w * 0.32, h.y, H_ * 0.34, h.w * 0.4, 'nullvoid', { lean: -0.12 });
		EFX.spike(h.x + h.w * 0.32, h.y, H_ * 0.38, h.w * 0.4, 'nullvoid', { lean: 0.12 });
		c.restore();
	}

	function drawWell(h){
		const c = ctx, sx = h.x - camera.x, sy = h.y - camera.y, a = Math.min(1, h.t / 20) * (1 - clamp((h.t - h.dur + 12) / 12, 0, 1));
		// safe lanes
		c.save();
		for(const g of h.gaps){
			const lo = g - h.gw / 2, hi = g + h.gw / 2;
			const gr = c.createRadialGradient(sx, sy, 60, sx, sy, 1100);
			gr.addColorStop(0, 'rgba(255,230,160,' + (0.22 * a) + ')'); gr.addColorStop(1, 'rgba(255,230,160,0)');
			c.fillStyle = gr; c.beginPath(); c.moveTo(sx, sy); c.arc(sx, sy, 1100, lo, hi); c.closePath(); c.fill();
		}
		c.restore();
		c.save(); c.globalCompositeOperation = 'lighter';
		G(h.x, h.y, 260, '#4a128f', 0.6 * a);
		c.lineCap = 'round';
		for(let i = 0; i < 7; i++){
			const r = 110 + i * 62, sp = h.t * (0.09 - i * 0.008) + i * 1.7;
			c.strokeStyle = 'rgba(180,108,255,' + (0.5 * a * (1 - i / 8)) + ')'; c.lineWidth = 3.2 - i * 0.3;
			c.beginPath(); c.arc(sx, sy, r, sp, sp + 1.6); c.stroke();
			c.beginPath(); c.arc(sx, sy, r, sp + Math.PI, sp + Math.PI + 1.1); c.stroke();
		}
		c.restore();
		c.save();
		const core = c.createRadialGradient(sx, sy, 0, sx, sy, 100);
		core.addColorStop(0, 'rgba(0,0,0,' + (0.95 * a) + ')'); core.addColorStop(0.7, 'rgba(7,0,15,' + (0.8 * a) + ')'); core.addColorStop(1, 'rgba(74,18,143,0)');
		c.fillStyle = core; c.beginPath(); c.arc(sx, sy, 100, 0, TAU); c.fill();
		c.restore();
	}

	function drawRift(h){
		const c = ctx, open = ease(Math.min(1, h.t / 12)) * (1 - clamp((h.t - h.warn - h.fire) / 16, 0, 1));
		if(open <= 0.01) return;
		const lockT = h.warn - 34;
		if(h.t >= lockT && h.t < h.warn && h.a != null){
			EFX.warnLine(h.x, h.y, h.x + Math.cos(h.a) * h.len, h.y + Math.sin(h.a) * h.len, h.w * 1.4, (h.t - lockT) / 34, h.el, { alpha: 0.85 });
		}
		if(h.t >= h.warn && h.t < h.warn + h.fire && h.a != null){
			const f = 1 - (h.t - h.warn) / h.fire;
			EFX.beam(h.x, h.y, h.x + Math.cos(h.a) * h.len, h.y + Math.sin(h.a) * h.len, h.w * (0.8 + 0.5 * f), h.el, { alpha: 0.6 + 0.4 * f });
		}
		const sx = h.x - camera.x, sy = h.y - camera.y, ang = h.a != null ? h.a : 0;
		c.save(); c.translate(sx, sy); c.rotate(ang);
		c.globalCompositeOperation = 'lighter';
		EFX.glowS(0, 0, 70 * open, '#4a128f', 0.7);
		c.strokeStyle = 'rgba(180,108,255,0.9)'; c.lineWidth = 3;
		c.beginPath(); c.ellipse(0, 0, 16 * open, 54 * open, 0, 0, TAU); c.stroke();
		c.strokeStyle = 'rgba(255,58,102,0.7)'; c.lineWidth = 2;
		for(let i = 0; i < 2; i++){ const s0 = h.t * 0.2 + i * Math.PI; c.beginPath(); c.ellipse(0, 0, 10 * open, 40 * open, 0, s0, s0 + 1.8); c.stroke(); }
		c.globalCompositeOperation = 'source-over';
		c.fillStyle = 'rgba(7,0,15,0.92)';
		c.beginPath(); c.ellipse(0, 0, 11 * open, 44 * open, 0, 0, TAU); c.fill();
		c.restore();
	}

	function drawEye(h){
		const c = ctx, x = eyeX(h), y = eyeY(h), sx = x - camera.x, sy = y - camera.y;
		const life = Math.min(1, h.t / 16) * Math.min(1, (h.life - h.t) / 16);
		if(life <= 0.01) return;
		let charge = 0;
		if(h.shot != null){
			const k = h.t - h.shot;
			if(k < h.ch){
				charge = k / h.ch;
				EFX.warnLine(x, y, x + Math.cos(h.a) * h.len, y + Math.sin(h.a) * h.len, h.w * 1.6, charge, h.el, { alpha: 0.75 });
			} else if(k < h.ch + h.fire){
				const f = 1 - (k - h.ch) / h.fire;
				EFX.beam(x, y, x + Math.cos(h.a) * h.len, y + Math.sin(h.a) * h.len, h.w * 1.0, h.el, { alpha: 0.5 + 0.5 * f });
				charge = 1;
			}
		}
		c.save(); c.globalCompositeOperation = 'lighter';
		EFX.glowS(sx, sy, 58 + 30 * charge, '#a3093c', 0.55 * life);
		c.restore();
		c.save(); c.globalAlpha = life; c.translate(sx, sy); c.scale(1.35, 1.35);
		const open = 0.55 + 0.45 * Math.min(1, h.t / 20);
		c.fillStyle = '#1a0010';
		c.beginPath(); c.ellipse(0, 0, 34, 22 * open, 0, 0, TAU); c.fill();
		const sg = c.createRadialGradient(0, 0, 2, 0, 0, 30);
		sg.addColorStop(0, '#ffe8ee'); sg.addColorStop(0.7, '#ff9ab0'); sg.addColorStop(1, '#7a0828');
		c.fillStyle = sg; c.beginPath(); c.ellipse(0, 0, 30, 18 * open, 0, 0, TAU); c.fill();
		const la = h.a != null && h.shot != null ? h.a : Math.atan2(PY() - y, PX() - x);
		const ix = Math.cos(la) * 8, iy = Math.sin(la) * 5;
		c.fillStyle = charge > 0 ? '#ff2050' : '#c4123e';
		c.beginPath(); c.arc(ix, iy, 11, 0, TAU); c.fill();
		c.fillStyle = '#0a0004';
		c.beginPath(); c.ellipse(ix, iy, 3, 9 * open, 0, 0, TAU); c.fill();
		c.fillStyle = 'rgba(255,255,255,0.8)'; c.fillRect(ix - 6, iy - 6, 3, 3);
		c.restore();
	}

	function drawStar(h){
		const prog = h.t / h.warn;
		EFX.warnCircle(h.x, h.ty - 4, 85, prog, h.el, { flat: 0.32 });
		const k = (h.t - (h.warn - h.fall)) / h.fall;
		if(k < 0) return;
		const x = h.x + h.sx * (1 - k), y = lerp(h.y0, h.ty, k * k);
		const px = h.x + h.sx * (1 - (k - 0.18)), py = lerp(h.y0, h.ty, Math.max(0, k - 0.18) ** 2);
		const c = ctx;
		c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
		const g = c.createLinearGradient(px - camera.x, py - camera.y, x - camera.x, y - camera.y);
		g.addColorStop(0, 'rgba(255,58,102,0)'); g.addColorStop(1, 'rgba(255,190,205,0.95)');
		c.strokeStyle = g; c.lineWidth = 14; c.beginPath(); c.moveTo(px - camera.x, py - camera.y); c.lineTo(x - camera.x, y - camera.y); c.stroke();
		G(x, y, 46, '#a3093c', 0.8); G(x, y, 18, '#fff0f4', 1, true);
		c.restore();
	}

	function drawPool(h){
		const c = ctx, a = Math.min(1, h.t / 10) * (1 - clamp((h.t - h.dur + 30) / 30, 0, 1));
		const sx = h.x - camera.x, sy = h.y - camera.y;
		c.save(); c.globalAlpha = a;
		const g = c.createRadialGradient(sx, sy, 0, sx, sy, h.w / 2);
		g.addColorStop(0, 'rgba(20,0,10,0.85)'); g.addColorStop(0.7, 'rgba(120,8,48,0.55)'); g.addColorStop(1, 'rgba(255,58,102,0)');
		c.fillStyle = g; c.beginPath(); c.ellipse(sx, sy, h.w / 2, 14, 0, 0, TAU); c.fill();
		c.restore();
		EFX.flameStrip(h.x - h.w * 0.42, h.x + h.w * 0.42, h.y, 'arbiter', a * 0.8, { height: 18, emit: false });
	}

	function drawBeam(h){
		const c = ctx;
		if(h.t < h.warn){
			const prog = h.t / h.warn, a1 = h.a0 + h.sw;
			wedge(c, h.ox, h.oy, h.a0, a1, h.len * 0.75, prog, 'rgba(255,58,102,A)', 'rgba(255,170,190,0.55)');
			EFX.warnLine(h.ox, h.oy, h.ox + Math.cos(h.a0) * h.len, h.oy + Math.sin(h.a0) * h.len, h.w, prog, h.el);
			c.save(); c.globalCompositeOperation = 'lighter';
			G(h.ox, h.oy, 40 + 70 * prog, '#ff3a66', 0.5 + 0.5 * prog);
			c.restore();
			return;
		}
		const end = h.warn + h.grow + h.sweep + 14, fade = Math.min(1, (end - h.t) / 14);
		const e = beamEnd(h);
		EFX.beam(h.ox, h.oy, e[0], e[1], h.w * 0.9, h.el, { alpha: fade, speed: 9 });
		EFX.beam(h.ox, h.oy, e[0], e[1], h.w * 0.32, 'nullvoid', { alpha: 0.7 * fade, speed: 14 });
		c.save(); c.globalCompositeOperation = 'lighter';
		G(h.ox, h.oy, 90, '#ff3a66', 0.8 * fade); G(h.ox, h.oy, 34, '#ffffff', 0.9 * fade, true);
		G(e[0], e[1], 60, '#a3093c', 0.7 * fade);
		c.restore();
	}

	function drawWave(h){
		const c = ctx, sx = h.x - camera.x, sy = h.y - camera.y, d = h.dir;
		if(sx < -200 || sx > canvas.width + 200) return;
		c.save(); c.globalCompositeOperation = 'lighter';
		for(let k = 1; k <= 6; k++) G(h.x - d * k * 24, h.y - 12, 26 - k * 2.5, h.el === 'nullvoid' ? '#b46cff' : '#ff3a66', 0.5 - k * 0.07);
		const g = c.createLinearGradient(0, sy - h.h, 0, sy);
		g.addColorStop(0, 'rgba(255,240,244,0.95)'); g.addColorStop(0.35, h.el === 'nullvoid' ? 'rgba(180,108,255,0.85)' : 'rgba(255,58,102,0.85)'); g.addColorStop(1, 'rgba(163,9,60,0.25)');
		c.fillStyle = g;
		const wob = Math.sin(h.t * 0.6) * 4;
		c.beginPath();
		c.moveTo(sx - d * 64, sy);
		c.quadraticCurveTo(sx - d * 18, sy - h.h * 0.95 - wob, sx + d * 14, sy - h.h * 0.55);
		c.quadraticCurveTo(sx + d * 24, sy - h.h * 0.2, sx + d * 30, sy);
		c.closePath(); c.fill();
		G(h.x, h.y - h.h * 0.6, 40, '#fff0f4', 0.6, true);
		c.restore();
	}

	function drawNova(h){
		const c = ctx, r = h.r0 + h.spd * h.t, sx = h.x - camera.x, sy = h.y - camera.y;
		const a = 1 - clamp((r - h.maxR * 0.7) / (h.maxR * 0.3), 0, 1);
		const col = h.el === 'nullvoid' ? ['rgba(74,18,143,', 'rgba(180,108,255,', 'rgba(255,255,255,'] : ['rgba(163,9,60,', 'rgba(255,58,102,', 'rgba(255,240,244,'];
		// arc segments between the gaps
		const segs = [];
		if(!h.gaps.length) segs.push([0, TAU]);
		else {
			const g = h.gaps.map(x => ((x % TAU) + TAU) % TAU).sort((p, q) => p - q);
			for(let i = 0; i < g.length; i++){
				const s0 = g[i] + h.gw / 2, s1 = (i + 1 < g.length ? g[i + 1] : g[0] + TAU) - h.gw / 2;
				if(s1 > s0) segs.push([s0, s1]);
			}
		}
		c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
		for(const pass of [[h.th * 1.5, 0, 0.22], [h.th * 0.6, 1, 0.6], [Math.max(2, h.th * 0.16), 2, 0.95]]){
			c.strokeStyle = col[pass[1]] + (pass[2] * a) + ')';
			c.lineWidth = pass[0];
			for(const sg of segs){ c.beginPath(); c.arc(sx, sy, r, sg[0], sg[1]); c.stroke(); }
		}
		c.restore();
	}

	function drawVerdict(h){
		const c = ctx, W = canvas.width, Ht = canvas.height;
		const i0 = laneIdx(h, camera.x) - 1, i1 = laneIdx(h, camera.x + W) + 1;
		const top = -10, bot = Ht + 10;
		for(let i = i0; i <= i1; i++){
			const lx = h.x0 + i * h.lw, sx = lx - camera.x;
			const doomed = (((i % 2) + 2) % 2) === h.par;
			if(!doomed){
				if(h.t < h.warn){
					c.save(); c.globalAlpha = 0.45 + 0.25 * Math.sin(F * 0.2);
					c.font = 'bold 18px Georgia, serif'; c.textAlign = 'center'; c.fillStyle = '#fff0c8';
					c.shadowColor = '#ffcc66'; c.shadowBlur = 10;
					c.fillText('✦ SAFE ✦', sx + h.lw / 2, PY() - camera.y - 70);
					c.restore();
				}
				continue;
			}
			if(h.t < h.warn){
				EFX.warnRect(lx, camera.y + top, h.lw, bot - top, h.t / h.warn, 'verdict', { alpha: 0.8 });
				continue;
			}
			// a column of judgement slams down the whole lane
			const k = (h.t - h.warn) / h.fire, a = k < 0.12 ? k / 0.12 : 1 - (k - 0.12) / 0.88;
			c.save(); c.globalCompositeOperation = 'lighter';
			const g = c.createLinearGradient(sx, 0, sx + h.lw, 0);
			g.addColorStop(0, 'rgba(255,90,58,0)'); g.addColorStop(0.2, 'rgba(255,90,58,' + (0.35 * a) + ')');
			g.addColorStop(0.5, 'rgba(255,209,102,' + (0.75 * a) + ')'); g.addColorStop(0.8, 'rgba(255,90,58,' + (0.35 * a) + ')'); g.addColorStop(1, 'rgba(255,90,58,0)');
			c.fillStyle = g; c.fillRect(sx, top, h.lw, bot - top);
			c.fillStyle = 'rgba(255,251,230,' + (0.9 * a) + ')';
			const cw = h.lw * 0.08 * (0.6 + 0.4 * a);
			c.fillRect(sx + h.lw / 2 - cw / 2, top, cw, bot - top);
			c.restore();
			for(const p of plats()){
				const x0 = Math.max(p.x, lx), x1 = Math.min(p.x + p.w, lx + h.lw);
				if(x1 > x0) EFX.flameStrip(x0, x1, p.y, 'verdict', a, { height: 54, emit: false });
			}
		}
	}

	function drawTide(h){
		const c = ctx, W = canvas.width, Ht = canvas.height, fx = tideFront(h), sx = fx - camera.x, d = h.side;
		if(h.t < h.warn){
			// the edge of the arena boils before the void pours in
			const prog = h.t / h.warn, ex = (d < 0 ? 0 : WW()) - camera.x;
			c.save(); c.globalCompositeOperation = 'lighter';
			for(let i = 0; i < 12; i++){
				const y = ((i * 173 + F * 2.5) % (Ht + 60)) - 30;
				EFX.glowS(ex - d * (20 + (i * 37) % 90) * prog, y, 22, '#ff3a66', 0.45 * prog);
			}
			c.restore();
			if(ex < -120 || ex > W + 120) return;
		}
		const x0 = d < 0 ? -20 : sx, x1 = d < 0 ? sx : W + 20;
		if(x1 < -40 || x0 > W + 40) return;
		c.save();
		const g = c.createLinearGradient(sx, 0, sx - d * 420, 0);
		g.addColorStop(0, 'rgba(120,8,48,0.6)'); g.addColorStop(0.3, 'rgba(40,0,24,0.84)'); g.addColorStop(1, 'rgba(6,0,10,0.95)');
		c.fillStyle = g;
		const edge = y => sx + d * (Math.sin((y + camera.y) * 0.02 + F * 0.09) * 9 + Math.sin((y + camera.y) * 0.006 - F * 0.05) * 7);
		c.beginPath(); c.moveTo(d < 0 ? -20 : W + 20, -20);
		for(let y = -20; y <= Ht + 24; y += 24) c.lineTo(edge(y), y);
		c.lineTo(d < 0 ? -20 : W + 20, Ht + 24); c.closePath(); c.fill();
		c.globalCompositeOperation = 'lighter'; c.lineWidth = 4; c.strokeStyle = 'rgba(255,58,102,0.75)';
		c.beginPath();
		for(let y = -20; y <= Ht + 24; y += 24){ const xx = edge(y); y > -20 ? c.lineTo(xx, y) : c.moveTo(xx, y); }
		c.stroke();
		c.lineWidth = 1.2; c.strokeStyle = 'rgba(255,240,244,0.65)'; c.stroke();
		for(let i = 0; i < 6; i++){ const y = ((i * 211 + F * 1.5) % (Ht + 80)) - 40; EFX.glowS(edge(y), y, 30, '#ff3a66', 0.35); }
		c.restore();
	}

	let dk = null;
	function drawDark(h){
		const c = ctx, W = canvas.width, Ht = canvas.height;
		const a = 0.88 * Math.min(1, h.t / 40) * Math.min(1, Math.max(0, h.dur + 20 - h.t) / 30);
		if(!dk) dk = document.createElement('canvas');
		if(dk.width !== W || dk.height !== Ht){ dk.width = W; dk.height = Ht; }
		const d = dk.getContext('2d');
		d.globalCompositeOperation = 'source-over';
		d.clearRect(0, 0, W, Ht);
		d.fillStyle = 'rgba(4,0,10,' + a + ')'; d.fillRect(0, 0, W, Ht);
		d.globalCompositeOperation = 'destination-out';
		const hole = (x, y, r, s) => {
			const g = d.createRadialGradient(x, y, 0, x, y, r);
			g.addColorStop(0, 'rgba(0,0,0,' + s + ')'); g.addColorStop(0.6, 'rgba(0,0,0,' + (s * 0.8) + ')'); g.addColorStop(1, 'rgba(0,0,0,0)');
			d.fillStyle = g; d.beginPath(); d.arc(x, y, r, 0, TAU); d.fill();
		};
		for(const Lt of h.lights) hole(Lt.x - camera.x, Lt.y - camera.y, Lt.r * (1.35 + 0.08 * Math.sin(F * 0.1)), 1);
		hole(PX() - camera.x, PY() - camera.y, 130, 0.75);
		if(typeof raidBoss !== 'undefined' && raidBoss) hole(raidBoss.x + raidBoss.w / 2 - camera.x, raidBoss.y + raidBoss.h / 2 - camera.y, 170, 0.8);
		c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(dk, 0, 0); c.restore();
		// the sanctuaries themselves
		c.save(); c.globalCompositeOperation = 'lighter';
		for(const Lt of h.lights){
			const p = 0.85 + 0.15 * Math.sin(F * 0.1 + Lt.x);
			G(Lt.x, Lt.y, Lt.r * 1.2 * p, '#ffd166', 0.45); G(Lt.x, Lt.y, 22, '#fffbe6', 0.95, true);
			const sx = Lt.x - camera.x, sy = Lt.y - camera.y;
			c.strokeStyle = 'rgba(255,230,160,0.6)'; c.lineWidth = 2; c.setLineDash([8, 8]); c.lineDashOffset = -F * 0.6;
			c.beginPath(); c.arc(sx, sy, Lt.r, 0, TAU); c.stroke(); c.setLineDash([]);
		}
		c.restore();
	}

	const ELC = el => el === 'nullvoid' ? ['#4a128f', '#b46cff', 'rgba(180,108,255,'] : ['#a3093c', '#ff3a66', 'rgba(255,90,130,'];

	function drawSentence(h){
		if(h.x == null) return;
		const c = ctx, locked = h.t > h.follow, k = locked ? clamp((h.t - h.follow) / h.lock, 0, 1) : h.t / h.follow;
		const sx = h.x - camera.x, sy = h.y - camera.y, spin = F * (locked ? 0.09 : 0.03), col = ELC(h.el);
		const appear = Math.min(1, h.t / 12);
		c.save(); c.globalCompositeOperation = 'lighter';
		// a shaft of judgement pinning the sigil from the sky
		const cw = locked ? 22 + 34 * k : 14;
		const g = c.createLinearGradient(0, sy - 900, 0, sy);
		g.addColorStop(0, col[2] + '0)'); g.addColorStop(1, col[2] + ((locked ? 0.3 + 0.35 * k : 0.16) * appear) + ')');
		c.fillStyle = g; c.fillRect(sx - cw / 2, sy - 900, cw, 900);
		G(h.x, h.y, h.r * (locked ? 1.15 : 0.9), col[0], (0.3 + 0.35 * k) * appear);
		c.lineCap = 'round';
		c.strokeStyle = col[2] + ((0.6 + 0.35 * k) * appear) + ')'; c.lineWidth = 3;
		c.beginPath(); c.arc(sx, sy, h.r * appear, spin, spin + TAU * 0.86); c.stroke();
		c.lineWidth = 2;
		c.beginPath(); c.arc(sx, sy, h.r * 0.7 * appear, -spin * 1.4, -spin * 1.4 + TAU * 0.72); c.stroke();
		c.fillStyle = col[2] + (0.85 * appear) + ')';
		for(let i = 0; i < 6; i++){
			const a = spin + i * TAU / 6, rx = sx + Math.cos(a) * h.r * 0.85 * appear, ry = sy + Math.sin(a) * h.r * 0.85 * appear;
			c.beginPath(); c.moveTo(rx, ry - 7); c.lineTo(rx + 5, ry); c.lineTo(rx, ry + 7); c.lineTo(rx - 5, ry); c.closePath(); c.fill();
		}
		if(locked){
			// the closing core shows how long until it detonates
			c.fillStyle = col[2] + (0.14 + 0.22 * k) + ')';
			c.beginPath(); c.arc(sx, sy, h.r * (1 - k), 0, TAU); c.fill();
		}
		c.restore();
		const multi = party().length > 1;
		c.save();
		c.font = 'bold 16px Georgia, serif'; c.textAlign = 'center'; c.fillStyle = '#ffe6ee'; c.shadowColor = col[1]; c.shadowBlur = 10;
		c.globalAlpha = appear * (0.75 + 0.25 * Math.sin(F * 0.3));
		c.fillText(multi ? '✦ STACK ✦' : (locked ? '✦ MOVE! ✦' : '✦ CONDEMNED ✦'), sx, sy - h.r - 14);
		c.restore();
	}

	function drawClone(h){
		const ang = h.ang != null ? h.ang : Math.atan2(h.ay - h.y, h.ax - h.x), ca = Math.cos(ang), sa = Math.sin(ang);
		const appear = Math.min(1, h.t / 14), k = h.t < h.warn ? 0 : Math.min(1, (h.t - h.warn) / h.dash);
		const fade = h.t > h.warn + h.dash ? Math.max(0, 1 - (h.t - h.warn - h.dash) / 18) : 1;
		const x = h.x + ca * h.len * k, y = h.y + sa * h.len * k, col = ELC(h.el);
		// only the next few reflections show their line, so the order reads clearly
		if(h.t < h.warn && h.t > h.warn - 44) EFX.warnLine(h.x, h.y, h.x + ca * h.len, h.y + sa * h.len, h.w, 1 - (h.warn - h.t) / 44, h.el, { alpha: 0.8 });
		if(k > 0){
			const kb = Math.max(0, k - 0.4);
			EFX.beam(h.x + ca * h.len * kb, h.y + sa * h.len * kb, x, y, h.w * 0.32, h.el, { alpha: 0.85 * fade });
		}
		const B = raidBoss;
		if(!B || typeof BOSS_SPRITE === 'undefined' || !BOSS_SPRITE.complete || !BOSS_SPRITE.naturalWidth) return;
		const fw = BOSS_SPRITE.naturalWidth / BOSS_SPRITE_COLS, fh = BOSS_SPRITE.naturalHeight / BOSS_SPRITE_ROWS;
		const row = k > 0 && k < 1 ? 1 : (h.t > h.warn - 20 ? 2 : 0), col_ = ((F + h.warn) / 10 | 0) % BOSS_SPRITE_COLS;
		const w = B.w, hh = B.h, bx = x - w / 2 - camera.x, by = y - hh / 2 - camera.y + Math.sin((F + h.warn) * 0.05) * 6;
		const a = appear * fade * (0.55 + 0.15 * Math.sin(F * 0.2 + h.warn));
		ctx.save(); ctx.globalCompositeOperation = 'lighter';
		G(x, y, w * 0.75, col[0], 0.6 * a);
		ctx.restore();
		ctx.save(); ctx.globalAlpha = a;
		if(h.f > 0){ ctx.translate(bx + w, by); ctx.scale(-1, 1); ctx.drawImage(BOSS_SPRITE, col_ * fw, row * fh, fw, fh, 0, 0, w, hh); }
		else ctx.drawImage(BOSS_SPRITE, col_ * fw, row * fh, fw, fh, bx, by, w, hh);
		ctx.restore();
		tintSprite(col_ * fw, row * fh, fw, fh, bx, by, { w, h: hh, facing: h.f }, col[1], a * 0.6);
	}

	// co-op: a sigil over whoever he is hunting, and a faint tether back to him
	function drawTarget(){
		if(!HUD.tgt || typeof raidBoss === 'undefined' || !raidBoss || raidBoss.dead) return;
		const P = party();
		if(P.length < 2) return;
		const p = P.find(q => q.id === HUD.tgt);
		if(!p) return;
		HUD.tgtT++;
		const c = ctx, o = bc(raidBoss), pop = Math.min(1, HUD.tgtT / 12);
		c.save(); c.globalCompositeOperation = 'lighter';
		c.strokeStyle = 'rgba(255,58,102,0.3)'; c.lineWidth = 2; c.setLineDash([10, 12]); c.lineDashOffset = -F * 1.5;
		c.beginPath(); c.moveTo(o.x - camera.x, o.y - camera.y); c.lineTo(p.cx - camera.x, p.cy - camera.y); c.stroke(); c.setLineDash([]);
		const wy = p.cy - p.h / 2 - 40 + Math.sin(F * 0.12) * 3, sx = p.cx - camera.x, sy = wy - camera.y;
		G(p.cx, wy, 30 * pop, '#ff3a66', 0.75);
		c.translate(sx, sy); c.scale(pop * (1 + 0.5 * Math.max(0, 1 - HUD.tgtT / 10)), pop);
		c.rotate(Math.sin(F * 0.05) * 0.2);
		c.strokeStyle = 'rgba(255,170,190,0.95)'; c.lineWidth = 2.5;
		c.beginPath(); c.moveTo(0, -16); c.lineTo(13, 0); c.lineTo(0, 16); c.lineTo(-13, 0); c.closePath(); c.stroke();
		c.fillStyle = 'rgba(255,58,102,0.9)';
		c.beginPath(); c.ellipse(0, 0, 7, 4.5, 0, 0, TAU); c.fill();
		c.fillStyle = '#14000a'; c.beginPath(); c.ellipse(0, 0, 1.6, 4, 0, 0, TAU); c.fill();
		c.restore();
	}

	const BACK = { tel: 1, charge: 0, pillar: 1, blast: 1, well: 1, rift: 1, star: 1, pool: 1, eye: 1, ghost: 1, slash: 1, clone: 1 };
	function drawBack(){
		if(!window.EFX || !H.length) return;
		ensurePal(); EFX.bind();
		for(const h of H){
			if(!BACK[h.k]) continue;
			switch(h.k){
				case 'tel':
					if(h.s === 'rect') EFX.warnRect(h.x, h.y, h.w, h.h, h.t / h.d, h.el, { alpha: 0.8 });
					else if(h.s === 'circle') EFX.warnCircle(h.x, h.y, h.r, h.t / h.d, h.el);
					break;
				case 'pillar': drawPillar(h); break;
				case 'blast': if(h.delay > 0) EFX.warnCircle(h.x, h.y, h.r, h.t / h.delay, h.el, { flat: h.flat || 1 }); break;
				case 'well': drawWell(h); break;
				case 'rift': drawRift(h); break;
				case 'star': drawStar(h); break;
				case 'pool': drawPool(h); break;
				case 'eye': drawEye(h); break;
				case 'ghost': drawGhost(h); break;
				case 'clone': drawClone(h); break;
				case 'slash':
					if(h.t < h.warn) wedge(ctx, h.x, h.y, h.ang - h.arc / 2, h.ang + h.arc / 2, h.r, h.t / h.warn, 'rgba(255,58,102,A)', 'rgba(255,200,215,0.7)');
					break;
			}
		}
	}

	function drawHud(){
		if(typeof raidBoss === 'undefined' || !raidBoss || raidBoss.dead || typeof drawBossBar !== 'function') return;
		const B = raidBoss, c = ctx, W = canvas.width;
		const bw = Math.min(620, W - 80), x = (W - bw) / 2, y = 100;
		const sub = (HUD.enraged ? 'ENRAGED · ' : '') + ['Phase I — The Arbiter', 'Phase II — The Veil Torn', 'Phase III — Judgement'][Math.max(0, Math.min(2, B.phase - 1))];
		c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
		drawBossBar(c, { key: B, x, y, w: bw, h: 22, name: 'The Void Arbiter', sub, hp: B.hp, max: B.maxHp,
			accent: HUD.enraged ? '#ff7a3a' : '#ff3a66', c1: '#5a0624', c2: HUD.enraged ? '#ff7a3a' : '#ff3a66', nameColor: '#ffe6ee', ticks: [0.65, 0.30] });
		let yy = y + 50;
		const P = party(), hunted = P.length > 1 ? P.find(p => p.id === HUD.tgt) : null;
		// cast bar
		if(HUD.cast){
			const cw = 300, cx0 = (W - cw) / 2, k = clamp(HUD.castT / HUD.castDur, 0, 1);
			c.fillStyle = 'rgba(6,4,12,0.8)'; c.fillRect(cx0 - 2, yy - 2, cw + 4, 14);
			const g = c.createLinearGradient(cx0, 0, cx0 + cw, 0); g.addColorStop(0, '#6a0a2a'); g.addColorStop(1, '#ff90a8');
			c.fillStyle = g; c.fillRect(cx0, yy, cw * k, 10);
			c.font = 'bold 11px Arial'; c.textAlign = 'center'; c.fillStyle = '#ffe6ee'; c.shadowColor = '#000'; c.shadowBlur = 4;
			c.fillText(HUD.cast.toUpperCase(), W / 2, yy + 24); c.shadowBlur = 0;
			yy += 34;
		}
		// Event Horizon shield
		const dh = find('dark');
		if(dh){
			const sw = 360, sx = (W - sw) / 2, k = clamp((dh.hp0 - B.hp) / Math.max(1, dh.need), 0, 1);
			c.fillStyle = 'rgba(6,4,12,0.85)'; c.fillRect(sx - 3, yy - 3, sw + 6, 18);
			c.fillStyle = '#2a1a40'; c.fillRect(sx, yy, sw, 12);
			const g = c.createLinearGradient(sx, 0, sx + sw, 0); g.addColorStop(0, '#ffd166'); g.addColorStop(1, '#fffbe6');
			c.fillStyle = g; c.fillRect(sx, yy, sw * (1 - k), 12);
			c.strokeStyle = '#ffd166'; c.lineWidth = 1.2; c.strokeRect(sx, yy, sw, 12);
			c.font = 'bold 12px Arial'; c.textAlign = 'center'; c.fillStyle = '#fff4d0'; c.shadowColor = '#000'; c.shadowBlur = 4;
			const secs = Math.max(0, Math.ceil((dh.dur - dh.t) / 60));
			c.fillText('HORIZON SHIELD — BREAK IT (' + secs + 's)', W / 2, yy + 30); c.shadowBlur = 0;
		}
		// who he is hunting (co-op)
		if(HUD.tgt && hunted){
			c.font = 'bold 12px Georgia, serif'; c.textAlign = 'center'; c.shadowColor = '#000'; c.shadowBlur = 4;
			c.fillStyle = hunted.me ? '#ff7088' : '#ffd0da';
			c.globalAlpha = hunted.me ? 0.75 + 0.25 * Math.sin(F * 0.2) : 0.9;
			c.fillText(hunted.me ? '◆ THE ARBITER HUNTS YOU ◆' : 'Hunting: ' + (hunted.name || 'ally'), W / 2, yy + 4);
			c.globalAlpha = 1; c.shadowBlur = 0;
			yy += 20;
		}
		if(HUD.stagger > 0){
			c.font = 'bold 20px Georgia, serif'; c.textAlign = 'center'; c.fillStyle = '#ffd166';
			c.shadowColor = '#ff7a3a'; c.shadowBlur = 14;
			c.globalAlpha = 0.7 + 0.3 * Math.sin(F * 0.25);
			c.fillText('STAGGERED', W / 2, yy + 20);
		}
		c.restore();
	}

	function drawFront(){
		if(typeof raidBoss === 'undefined' || !raidBoss || !window.EFX) return;
		ensurePal(); EFX.bind();
		let dark = null;
		for(const h of H){
			switch(h.k){
				case 'beam': drawBeam(h); break;
				case 'wave': drawWave(h); break;
				case 'nova': drawNova(h); break;
				case 'verdict': drawVerdict(h); break;
				case 'tide': drawTide(h); break;
				case 'sentence': drawSentence(h); break;
				case 'dark': dark = h; break;
			}
		}
		if(dark) drawDark(dark);
		drawTarget();
		drawHud();
	}

	function drawProj(p){
		if(!window.EFX) return false;
		ensurePal(); EFX.bind();
		const r = Math.max(9, (p.width || 24) * 0.5), el = p._vaEl || 'nullvoid';
		if(p._vaHold && p.age < p._vaHold){
			const k = p.age / p._vaHold;
			ctx.save(); ctx.globalCompositeOperation = 'lighter';
			G(p.x, p.y, r * (2.6 + 0.6 * Math.sin(p.age * 0.3)), el === 'arbiter' ? '#a3093c' : '#4a128f', 0.6);
			ctx.restore();
			EFX.bolt(null, p.x, p.y, r * (0.7 + 0.3 * k), el, { trail: false, ang: p.age * 0.1 });
			return true;
		}
		EFX.bolt(p, p.x, p.y, r, el, { trailLen: 8 });
		return true;
	}

	window.VoidArbiter = {
		update, tick, onNet, drawSky, drawArena, drawBack, drawAura, drawFront, drawProj, bossAlpha, tintSprite,
		get hazards(){ return H; }, get hud(){ return HUD; }, ATK,
	};
})();
