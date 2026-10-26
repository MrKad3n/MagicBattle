/* =============================================================
   CoopCombat — what your allies DO in online co-op (any mode: dungeons, raids, survival).

   Before this, co-op only carried positions and the old phase spells, so with rune magic and melee
   your allies looked like they stood there doing nothing. Now:
   - Rune spells: every cast goes out (the spell definition once, then by hash) and is re-cast on every
     other client as a real spell owned by that ally (MAGIC_WORLD.cast with an ally owner). Their energy
     flies, collides, bends, builds constructs you can stand on and interacts with your own magic.
     Damage is still counted once: the caster's own client reports it (a guest to the host), so the
     copies on other screens never deal damage themselves — but their knockback / statuses act on the
     host's enemies, so an ally's Gravity well really pulls the host's enemies.
   - Melee: each swing is sent (weapon + move + aim) and replayed on the ally's rig.
   - Allies are drawn with the player rig (body, weapon, swing, cast glow), not the old sprite.
   Rides on the existing co-op channel: casts and swings use the 'cast' event (payload .rc / .ma),
   the weapon / aim / cast glow ride in each state message.
   ============================================================= */
(function(root){
	'use strict';
	if(typeof IS_COOP === 'undefined' || !IS_COOP) return;
	const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
	const now = () => performance.now();
	function hash32(s){ let h = 2166136261 >>> 0; for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
	const net = () => root.__coopNet || null;
	const W = () => (typeof MAGIC_WORLD !== 'undefined' && MAGIC_WORLD) ? MAGIC_WORLD : null;

	/* ---------------- remote ally fighters ---------------- */
	const REM = new Map();      // ally id -> fighter
	const defCache = Object.create(null), defSent = new Set();
	let castSeq = 0, lastAtkId = -1, profSent = 0;
	function fighter(id){
		let R = REM.get(id);
		if(R) return R;
		R = { id, weapon: null, armed: false, aimX: 0, aimY: 0, castT: 0, atk: null, walk: 0, t: 0, flash: 0, trail: [], inst: Object.create(null), h: 56 };
		const ENT = { x: 0, y: 0, w: 38, h: 56, hp: 1, maxHp: 1, dead: false, flash: 0, dots: [], stunTimer: 0, slowTimer: 0, facing: 1, vx: 0, vy: 0, _coopAllyProxy: true };
		R.ent = ENT;
		R.owner = {
			id: 'coop-ally-' + id, entity: ENT,
			alive: () => !!(allyRec(id) && allyRec(id).active),
			facing: () => (ENT.facing < 0 ? -1 : 1),
			// their spells meet the enemies on your screen, but only the caster's client counts the damage
			foes: () => (typeof getAllTargets === 'function' ? getAllTargets() : []),
			allies: () => (typeof player !== 'undefined' ? [ player ] : []),
			hurt: () => {},
			hurtSelf: () => {},
			aim: () => ({ x: R.aimX, y: R.aimY }),
			triggers: 0,
			drain: (a) => a,
			hostOverrides: {
				heal: () => {},
				damageEnemy: () => {},
				hurtCaster: () => {},
				isAttacking: (e) => e === ENT ? (R.castT > 0 || !!R.atk) : (typeof MAGIC_HOST !== 'undefined' ? MAGIC_HOST.isAttacking(e) : false),
				portalStrike: () => null,
				storeMagicItem: () => 'Not yours to keep',
				getWeapon: () => R.weapon ? { id: R.weapon, name: R.weapon } : null,
				casterHealth: () => { const a = allyRec(id); return a ? a.hp / Math.max(1, a.maxHp) : 1; }
			}
		};
		REM.set(id, R);
		return R;
	}
	const allyRec = (id) => (root.__coopAllies || {})[id] || null;

	/* ---------------- outgoing: your casts, swings, weapon and aim ---------------- */
	function onLocalCast(def, opts, res){
		const n = net(); if(!n || !n.sendCast) return;
		const json = JSON.stringify(def);
		const k = hash32(json) + json.length.toString(36);
		const msg = { i: ++castSeq, k, x: Math.round(player.x + player.w / 2), y: Math.round(player.y + player.h / 2),
			ax: Math.round(mouseScreenX + camera.x), ay: Math.round(mouseScreenY + camera.y) };
		if(!defSent.has(k)){ msg.d = def; defSent.add(k); }
		if(!profSent || now() - profSent > 15000){ try { msg.p = (typeof magicProfileForGame === 'function') ? magicProfileForGame() : null; } catch(e){} profSent = now(); }
		if(opts && opts.spawnAt) msg.sa = [ Math.round(opts.spawnAt.x), Math.round(opts.spawnAt.y) ];
		if(opts && opts.passive) msg.ps = 1;
		n.sendCast({ rc: msg, slot: typeof COOP_SLOT !== 'undefined' ? COOP_SLOT : 0 });
	}
	function pollLocalAttack(){
		const MM = root.MeleeMode, n = net();
		if(!MM || !MM.atk || !n || !n.sendCast) return;
		const atk = MM.atk;
		if(atk.id === lastAtkId) return;
		lastAtkId = atk.id;
		const w = MM.weapon(), moves = (w && w.moves) || {};
		let key = null;
		for(const k in moves) if(moves[k] && moves[k].name === atk.def.name){ key = k; break; }
		if(!key) return;
		n.sendCast({ ma: { k: key, w: w.id || MM.weaponId, ax: +(atk.aim ? atk.aim.x : player.facing).toFixed(2), ay: +(atk.aim ? atk.aim.y : 0).toFixed(2) } });
	}
	/* extra fields for each state message (the base fields live in dungeon.html) */
	root.__coopStateExtra = function(){
		const MM = root.MeleeMode;
		return {
			w: MM && MM.armed && MM.weaponId ? MM.weaponId : 0,
			ax: Math.round(mouseScreenX + camera.x), ay: Math.round(mouseScreenY + camera.y),
			ct: (player.castTimer > 0 ? Math.min(30, player.castTimer | 0) : 0)
		};
	};

	/* ---------------- incoming ---------------- */
	root.__coopOnState = function(a, s){
		const R = fighter(s.from || a.id);
		R.weapon = s.w || null; R.armed = !!s.w;
		if(s.ax != null){ R.aimX = s.ax; R.aimY = s.ay; }
		if(s.ct > R.castT) R.castT = s.ct;
	};
	function weaponDef(id){
		const MM = root.MeleeMode;
		return (MM && MM.weapons && MM.weapons[id]) || (root.MELEE_WEAPONS && root.MELEE_WEAPONS.weapons && root.MELEE_WEAPONS.weapons[id]) || null;
	}
	function phaseOf(A2){
		const d = A2.def, t = A2.t;
		if(t < d.startup) return 'startup';
		if(t < d.startup + d.active) return 'active';
		if(t < d.startup + d.active + (d.cancel || 0)) return 'cancel';
		if(t < d.startup + d.active + (d.cancel || 0) + (d.recovery || 0)) return 'recovery';
		return 'done';
	}
	function remoteAttack(R, m){
		const w = weaponDef(m.w); if(!w || !w.moves || !w.moves[m.k]) return;
		const base = w.moves[m.k];
		const def = Object.assign({}, base);
		R.atk = { key: m.k, def, t: 3, aim: { x: m.ax, y: m.ay }, phase: 'startup' };
		R.atk.phase = phaseOf(R.atk);
		R.weapon = m.w; R.armed = true;
		const a = allyRec(R.id); if(a && Math.abs(m.ax) > 0.16) a.facing = m.ax > 0 ? 1 : -1;
	}
	function remoteCast(R, c){
		const world = W(); if(!world) return;
		if(c.d) defCache[c.k] = c.d;
		if(c.p) R.profile = c.p;
		const def = defCache[c.k];
		if(!def) return;
		const ENT = R.ent;
		ENT.x = c.x - ENT.w / 2; ENT.y = c.y - ENT.h / 2;
		R.aimX = c.ax; R.aimY = c.ay;
		R.castT = 14;
		const a = allyRec(R.id); if(a){ a.castFlash = 14; }
		const prof = R.profile || (root.MagicEngine && root.MagicEngine.deriveProfile ? root.MagicEngine.deriveProfile({}) : null);
		let res = null;
		try { res = world.cast(def, { profile: prof, owner: R.owner, host: typeof MAGIC_HOST !== 'undefined' ? MAGIC_HOST : null, spawnAt: c.sa ? { x: c.sa[0], y: c.sa[1] } : null, passive: !!c.ps }); } catch(e){ res = null; }
		if(res && res.ok) R.inst[c.i] = res.instance;
	}
	/* returns true when the payload was ours (rune cast or swing) */
	root.__coopOnCombat = function(c){
		if(!c || (!c.rc && !c.ma)) return false;
		const R = fighter(c.from);
		if(c.rc) remoteCast(R, c.rc);
		if(c.ma) remoteAttack(R, c.ma);
		return true;
	};

	/* ---------------- per frame ---------------- */
	function tick(){
		pollLocalAttack();
		const allies = root.__coopAllies || {};
		for(const [id, R] of REM){
			const a = allies[id];
			if(!a || !a.active){
				// they left: end their lingering spells
				const world = W();
				if(world && world.clearOwner && R._cleared !== true){ try { world.clearOwner(R.owner.id); } catch(e){} R._cleared = true; }
				continue;
			}
			R._cleared = false;
			R.t += 1 / 60;
			if(Math.abs(a.vx || 0) > 0.5 && a.onGround) R.walk += Math.abs(a.vx) * 0.12;
			if(R.castT > 0) R.castT--;
			if(R.flash > 0) R.flash--;
			if(R.atk){ R.atk.t++; R.atk.phase = phaseOf(R.atk); if(R.atk.phase === 'done') R.atk = null; }
			const ENT = R.ent;
			ENT.x = a.x; ENT.y = a.y; ENT.facing = a.facing || 1; ENT.vx = a.vx || 0; ENT.vy = a.vy || 0; ENT.hp = Math.max(1, a.hp || 1); ENT.maxHp = a.maxHp || 1;
			ENT._swing = R.atk && (R.atk.phase === 'startup' || R.atk.phase === 'active') ? 2 : 0;
		}
	}

	/* ---------------- drawing an ally with your rig ---------------- */
	const POSE_KEYS = [ 'lean', 'head', 'hat', 'armF', 'armB', 'legF', 'legB', 'sword', 'shift', 'crouch' ];
	const lerpPose = (a, b, t) => { const o = {}; for(const k of POSE_KEYS){ const av = (a && a[k]) || 0, bv = (b && b[k]) || 0; o[k] = av + (bv - av) * t; } return o; };
	function basePose(R, a){
		if(!a.onGround) return (a.vy || 0) < 0 ? { lean: -0.18, head: -0.08, hat: -0.08, armF: -0.9, armB: -0.7, legF: -0.45, legB: 0.55, sword: -0.2, shift: 0, crouch: -2 }
			: { lean: 0.16, head: 0.06, hat: 0.06, armF: -0.25, armB: -0.45, legF: 0.35, legB: -0.2, sword: 0.15, shift: 0, crouch: 0 };
		if(Math.abs(a.vx || 0) > 0.6){ const w = Math.sin(R.walk), bob = Math.abs(Math.sin(R.walk * 2)); return { lean: 0.12, head: 0.02, hat: 0.04, armF: -w * 0.55, armB: w * 0.55, legF: w * 0.95, legB: -w * 0.95, sword: 0.1, shift: 0, crouch: bob * 2 }; }
		const b = Math.sin(R.t * 4.8);
		return { lean: 0.02, head: -0.02, hat: 0, armF: 0.42 + b * 0.04, armB: 0.28, legF: 0.04, legB: -0.04, sword: 0, shift: 0, crouch: (1 - b) * 0.6 };
	}
	function pose(R, a){
		const base = basePose(R, a), A2 = R.atk;
		if(!A2 || !A2.def.poses) return base;
		const d = A2.def, t = A2.t, ps = d.poses;
		const eIn = (x) => x * x, eOut = (x) => 1 - (1 - x) * (1 - x);
		if(A2.phase === 'startup') return lerpPose(base, ps.windup, eOut(d.startup <= 1 ? 1 : t / d.startup));
		if(A2.phase === 'active') return lerpPose(ps.windup, ps.strike, eIn(d.active <= 1 ? 1 : (t - d.startup) / d.active));
		const span = (d.cancel || 0) + (d.recovery || 0);
		return lerpPose(ps.strike, ps.follow, eOut(clamp(span <= 1 ? 1 : (t - d.startup - d.active) / span, 0, 1)));
	}
	function swingOf(R, w, facing){
		const MM = root.MeleeMode; if(!MM || !w || !MM.weaponSwing) return null;
		const A2 = R.atk, f = facing || 1;
		const aim = A2 ? A2.aim : { x: f, y: 0 };
		const proxy = Object.create(MM);
		Object.assign(proxy, { atk: A2 ? { def: A2.def, t: A2.t, aim: A2.aim, missExtra: 0, pulse: 0 } : null, phase: A2 ? A2.phase : '', charge: 0 });
		proxy.weapon = () => w; proxy.sampleAim = () => aim; proxy.toArm = (vec) => -Math.atan2((vec && vec.x || 0) * f, vec && vec.y || 0);
		try { return { swing: MM.weaponSwing.call(proxy), aim }; } catch(e){ return { swing: null, aim }; }
	}
	function reachOf(w){
		if(!w || !w.moves) return 0;
		let best = 0; for(const k of [ 'g1', 'g2', 'g3' ]){ const d = w.moves[k]; if(!d || !d.hitbox) continue; best = Math.max(best, Math.hypot(d.hitbox.ox || 0, d.hitbox.oy || 0) + Math.max(18, d.hitbox.w || 36) * 0.5); }
		return best;
	}
	const TINTS = [ null, '#5fb3ff', '#7dffa8', '#ffd36b' ];
	root.__coopDrawAlly = function(a, w0, h0){
		const Rig = root.PlayerRig;
		if(!Rig || !Rig.isReady || !Rig.isReady() || typeof ctx === 'undefined') return false;
		const R = fighter(a.id);
		const sx = a.x - camera.x, sy = a.y - camera.y;
		if(sx < -200 || sx > canvas.width + 200 || sy < -260 || sy > canvas.height + 200) return true;
		const who = R._who || (R._who = { x: 0, y: 0, w: 38, h: 56, facing: 1, baseH: 56, flash: 0 });
		who.x = a.x; who.y = a.y; who.w = w0 || 38; who.h = h0 || 56; who.facing = a.facing || 1; who.flash = R.flash;
		const w = R.armed && R.weapon ? weaponDef(R.weapon) : null;
		const style = w ? (w.style || R.weapon) : null;
		const sw = style ? (swingOf(R, w, a.facing) || { swing: null, aim: { x: a.facing || 1, y: 0 } }) : { swing: null, aim: { x: R.aimX - (a.x + 19) > 0 ? 1 : -1, y: 0 } };
		const tint = TINTS[(a.slot != null ? a.slot : 1) % 4] || null;
		ctx.save();
		ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(sx + 19, sy + who.h, 20, 5, 0, 0, 7); ctx.fill();
		ctx.strokeStyle = tint || '#9fe6ff'; ctx.globalAlpha = 0.7; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(sx + 19, sy + who.h, 26, 7, 0, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
		let res = null;
		const o = {
			state: a.onGround ? (Math.abs(a.vx || 0) > 0.6 ? 'run' : 'idle') : 'fall', grounded: !!a.onGround, vx: a.vx || 0, vy: a.vy || 0,
			walkPhase: R.walk, frame: Math.floor(R.t * 60), weapon: style, swing: sw.swing, rest: !!style && !R.atk, spellHand: !style,
			castT: Math.max(R.castT, a.castFlash || 0), castColor: a.castColor || '#9fe6ff', aim: { x: sw.aim.x * (a.facing || 1), y: sw.aim.y }, reachPx: style ? reachOf(w) : 0,
			squash: 0, angleLegs: !!R.atk, angleArms: !!R.atk, tint
		};
		try { res = Rig.draw(ctx, sx, sy, who, pose(R, a), o); } catch(e){ res = null; }
		if(res && res.tip && R.atk && (R.atk.phase === 'active' || R.atk.phase === 'startup')) R.trail.push({ x: res.tip.x + camera.x, y: res.tip.y + camera.y, t: R.t });
		while(R.trail.length && (R.t - R.trail[0].t > 0.12 || R.trail.length > 14)) R.trail.shift();
		if(R.trail.length > 1){
			ctx.lineCap = 'round';
			for(let i = 1; i < R.trail.length; i++){ const q = i / R.trail.length; ctx.globalAlpha = q * 0.75; ctx.strokeStyle = tint || '#bcd4ff'; ctx.lineWidth = 2 + 6 * q; ctx.beginPath(); ctx.moveTo(R.trail[i - 1].x - camera.x, R.trail[i - 1].y - camera.y); ctx.lineTo(R.trail[i].x - camera.x, R.trail[i].y - camera.y); ctx.stroke(); }
			ctx.globalAlpha = 1;
		}
		ctx.restore();
		return !!res;
	};

	/* ---------------- hooks ---------------- */
	function install(){
		const world = W();
		if(!world){ setTimeout(install, 300); return; }
		if(!world._coopWrapped){
			const orig = world.cast;
			world.cast = function(def, opts){
				const res = orig.call(this, def, opts);
				if(res && res.ok && opts && typeof MAGIC_OWNER !== 'undefined' && opts.owner === MAGIC_OWNER) try { onLocalCast(def, opts, res); } catch(e){}
				return res;
			};
			world._coopWrapped = true;
		}
	}
	install();
	root.CoopCombat = { tick, fighters: REM, _defCache: defCache };
})(window);
