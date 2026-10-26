/* Spell parry & Anti-Magic weapons — the game side.
   • Parrying (Q / right-click) with a weapon now turns aside SPELLS too: enemy projectiles and the energy of enemy casters. Whether the
     weapon can bear a spell depends on the spell's STRENGTH (its damage per blow plus a quarter of its energy) against the weapon's
     PARRY CAPACITY: its own power (the damage of its first strike), the reinforcement poured into it, your Strength, a heavy (Gravity)
     weapon, and — against magic — Anti-Magic. A spell too strong for the weapon goes straight through the guard.
   • A weapon with Anti-Magic reinforcement REFLECTS what it parries (the spell flies back, weaker and dulled).
   • Anti-Magic reinforcement on a held weapon also erodes or erases any magic the weapon touches (the engine's weaponContact).
   The engine does the arithmetic (MagicEngine world: spellStrength / parry / weaponContact / reflectBody); this file feeds it the
   weapon, the guard zone and the reflected projectile, and shows what happened. */
(function(){
	'use strict';
	if(window.SpellParry) return;

	const BAL = {
		weaponK: 0.8,         // capacity from the weapon itself = this × the damage of its first strike
		bare: 10,             // empty-handed
		perReinf: 70,         // capacity per full (100%) reinforcement poured into the weapon
		perStrength: 0.02,    // +2% per point of Strength
		heavy: 0.5,           // Gravity "heavy weapon" adds up to +50%
		anti: 0.5,            // Anti-Magic opposes magic: up to +50% against it
		reach: 92,            // how far in front of you a parry guards
		strain: 0.12,         // a parry strains the weapon's reinforcement by this × the spell's strength (Anti-Magic reflecting: double)
		keep: [0.6, 0.9],     // what a reflected spell keeps of its power (stronger Anti-Magic keeps more)
		strip: 0.35           // Anti-Magic dulls the nature of what it reflects
	};

	const W = () => (typeof MAGIC_WORLD !== 'undefined' ? MAGIC_WORLD : null);
	const MM = () => (typeof MeleeMode !== 'undefined' ? MeleeMode : null);
	const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);

	function weaponKey(wid){ const w = W(), m = MM(); const id = wid || (m && m.armed ? m.weaponId : null); return w && id ? w.weaponKey('player', id) : null; }
	function weaponStates(wid){
		const w = W(), key = weaponKey(wid);
		return w && key ? w.reinf.filter(st => st.kind === 'weapon' && st.key === key && !st.removed) : [];
	}
	function firstStrikeDamage(wid){
		const m = MM(); if(!m) return 0;
		const id = wid || (m.armed ? m.weaponId : null); if(!id) return 0;
		const wp = (m.weapons && m.weapons[id]) || (m.weapon && m.weapon());
		const g1 = wp && wp.moves && wp.moves.g1;
		return g1 && g1.damage > 0 ? g1.damage : 34;
	}
	/* how much of a spell the weapon in your hand (or the named weapon) can bear, and what it does to what it parries */
	function info(wid){
		const w = W(), m = MM();
		const id = wid || (m && m.armed ? m.weaponId : null);
		const out = { cap: BAL.bare, base: BAL.bare, reinf: 0, anti: false, antiK: 0, reflect: false, keep: BAL.keep[0], strip: BAL.strip, armed: !!id, states: [] };
		if(!w || !m) return out;
		const sts = weaponStates(id);
		out.states = sts;
		out.base = id ? BAL.weaponK * firstStrikeDamage(id) : BAL.bare;
		let am = 0, k = 0;
		for(const st of sts){
			out.reinf += (st.strength || 0) * BAL.perReinf;
			const a = (st.tech && st.tech.antimagic) || 0;
			if(a >= 0.03 && !(st.suppressed > w.time) && st.energy > 1){ am = Math.max(am, a); k = Math.max(k, Math.min(1, a) * Math.max(0.3, st.strength || 0)); }
		}
		out.anti = am >= 0.03; out.antiK = k;
		const stat = (typeof stats !== 'undefined' && stats && stats.strength) || 0;
		const vowStr = (window.__vowMods && window.__vowMods.str) || 0;
		const heavy = sts.length ? w.reinforcedValue(weaponKey(id), 'heavyWeapon') : 0;
		out.cap = (out.base + out.reinf) * Math.max(0.4, 1 + stat * BAL.perStrength + vowStr) * (1 + BAL.heavy * heavy) * (1 + BAL.anti * k);
		out.reflect = out.anti && !!id;
		out.keep = BAL.keep[0] + (BAL.keep[1] - BAL.keep[0]) * k;
		return out;
	}
	function describe(wid){
		const I = info(wid);
		return 'Parry (Q): turns aside spells up to strength ' + Math.round(I.cap) + (I.anti ? ' — Anti-Magic: reflects them' : '') + (I.reinf > 1 ? ' (reinforced +' + Math.round(I.reinf) + ')' : '');
	}
	function segment(){
		const h = typeof MAGIC_HOST !== 'undefined' ? MAGIC_HOST : null, m = MM();
		if(!h || !m || !m.armed) return null;
		return h.weaponSegment({ id: 'player' }, { id: m.weaponId });
	}
	/* the guard: the space in front of you, and the weapon itself */
	function zoneFor(seg){
		const f = player.facing || 1, cx = player.x + player.w / 2, len = seg ? Math.hypot(seg.x1 - seg.x0, seg.y1 - seg.y0) : 0;
		const reach = BAL.reach + len * 0.3;
		const x0 = f > 0 ? cx - 10 : cx - reach, x1 = f > 0 ? cx + reach : cx + 10, y0 = player.y - 24, y1 = player.y + player.h + 8;
		return { hits(x, y, r){
			const qx = clamp(x, x0, x1), qy = clamp(y, y0, y1);
			if(Math.hypot(qx - x, qy - y) <= r) return true;
			return !!seg && W().segDist(x, y, seg) <= r + 12;
		} };
	}
	/* nearest foe roughly along the way a spell came from: it is sent back at them, otherwise straight back */
	function aimFor(b){
		const h = typeof MAGIC_HOST !== 'undefined' ? MAGIC_HOST : null; if(!h) return null;
		const vx = b.vx || 0, vy = b.vy || 0; if(!vx && !vy) return null;
		const base = Math.atan2(-vy, -vx);
		let best = null, bd = 1300;
		for(const e of (h.getEnemies() || [])){
			if(!e || e.dead || (e.hp != null && e.hp <= 0)) continue;
			const ex = e.x + (e.w || 0) / 2, ey = e.y + (e.h || 0) / 2, d = Math.hypot(ex - b.x, ey - b.y);
			if(d < 40 || d > bd) continue;
			let da = Math.atan2(ey - b.y, ex - b.x) - base; while(da > Math.PI) da -= Math.PI * 2; while(da < -Math.PI) da += Math.PI * 2;
			if(Math.abs(da) > 1.2) continue;
			bd = d; best = { x: ex, y: ey };
		}
		return best;
	}
	function say(x, y, text, color){ if(typeof dmgNumbers !== 'undefined') dmgNumbers.push({ x, y, text, age: 0, color }); }
	function note(kind, x, y, S, cap, dark){
		if(kind === 'strong'){
			say(x, y - 14, 'Too strong to parry!', '#ff8d8d'); say(x, y + 2, Math.round(S) + ' > ' + Math.round(cap), '#ffb3b3');
			if(typeof spawnImpact === 'function') spawnImpact(x, y, '#ff8d8d');
			if(typeof shakeScreen === 'function') shakeScreen(2, 4);
		} else if(kind === 'reflected'){
			say(x, y - 14, '⚫ Reflected!', '#c9c9dd');
			if(typeof spawnImpact === 'function') spawnImpact(x, y, '#222233');
		} else {
			say(x, y - 14, '✦ Parried ' + Math.round(S), '#fff1b0');
			if(typeof spawnImpact === 'function') spawnImpact(x, y, '#fff4c2');
		}
	}
	/* parrying strains the reinforcement poured into the weapon */
	function strain(I, S, reflected){
		const w = W(); if(!w) return;
		const cost = S * BAL.strain * (reflected ? 2 : 1), sts = I.states.filter(st => !st.item && st.energy > 0);
		if(!sts.length) return;
		const per = cost / sts.length;
		for(const st of sts) st.energy = Math.max(0, st.energy - Math.min(per, st.energy * 0.4));
	}
	/* an enemy's bolt, sent back as one of yours */
	function reflectProjectile(p, o){
		if(typeof projectiles === 'undefined') return;
		const spd = Math.max(5, Math.hypot(p.vx, p.vy)) * 1.15, base = Math.atan2(-p.vy, -p.vx), aim = (o && o.aimFn ? o.aimFn(p) : (o && o.aim)) || null;
		const ang = aim ? Math.atan2(aim.y - p.y, aim.x - p.x) : base, fps = typeof FPS === 'number' ? FPS : 60;
		const dark = !!(o && o.dark);
		projectiles.push({
			spell:{phases:[]}, phaseIdx:0, phase:{effects:[], width:1, height:1, speed:1, duration:1},
			x:p.x, y:p.y, vx:Math.cos(ang) * spd, vy:Math.sin(ang) * spd,
			facing:Math.cos(ang) >= 0 ? 1 : -1, age:0, maxAge:Math.round(fps * 2.2),
			width:p.width, height:p.height, power:Math.max(1, Math.round((p.power || 10) * ((o && o.keep) || 0.8))),
			color: dark ? '#4a4a60' : (p.color || '#f39c12'), trail:'none', shape:({'circle':'missile','spike':'blade'}[p.shape]) || p.shape || 'missile', behavior:'straight',
			effects:[], trailParts:[], orbitAngle:0, orbitRadius:0, orbitSpeed:0, orbitDur:0,
			orbitOriginX:0, orbitOriginY:0, startX:p.x, startY:p.y,
			beamLen:0, beamAngle:ang,
			chainHits:0, chainMax:0, hasHit:false, phaseTriggered:true,
			hitTargets:new Set(), aimAngle:ang,
			timedReleaseDelay:0, timedReleaseTriggered:true,
			phaseForkDelay:0, phaseForkRepeats:0, phaseForkCount:0, phaseForkNextAge:9999,
			isSolidPlatform:false, isUltimate:false, castId:-1, sourceSlot:-1, randomDelay:0,
			afterHitEffect:'none', polygonSides:6, rotAngle:ang, rotSpeed:0.1,
			_reflectedFoe:true
		});
	}

	const SP = { BAL, info, describe, reflectProjectile };

	/* the engine asked the game to take a bolt out of play (parried in flight) */
	function hookHost(){
		if(typeof MAGIC_HOST === 'undefined' || MAGIC_HOST.parryForeign) return;
		MAGIC_HOST.parryForeign = function(p, o){
			const i = enemyProjectiles.indexOf(p); if(i >= 0) enemyProjectiles.splice(i, 1);
			p.hasHit = true; p._parried = true;
			if(o && o.reflect) reflectProjectile(p, o);
		};
	}

	/* ---------- every frame: Anti-Magic contact, and the parry guard while the window is open ---------- */
	function update(dt){
		const w = W(), m = MM();
		if(!w || !m || typeof player === 'undefined') return;
		hookHost();
		const seg = segment();
		if(seg && w.reinf.length) w.weaponContact(weaponKey(), seg, dt, { ownerId: 'player' });
		if(!m.parryWindow || !m.parryWindow()) return;
		const I = info();
		const res = w.parry(zoneFor(seg), { cap: I.cap, ownerId: 'player', reflect: I.reflect, aimFn: aimFor, keep: I.keep, strip: I.strip, dark: I.anti });
		let held = false;
		for(const r of res){
			note(r.kind, r.x, r.y, r.S, r.cap, I.anti);
			if(r.kind !== 'strong'){ held = true; strain(I, r.S, r.kind === 'reflected'); }
		}
		if(held && m.tryParry) m.tryParry();      // the guard held: the usual parry success (hit-stop, shake, riposte)
	}

	/* ---------- a blow that lands inside the parry window: is it a spell the weapon can bear? (called from MeleeMode.tryParry) ---------- */
	function currentSource(){
		const p = window.__curEProj;
		if(p && !p.necroFriendly && !p._parried && !p._reflectedFoe) return { kind: 'proj', ref: p };
		const w = W();
		if(w && w.hitSrc && w.hitSrc.alive !== false) return { kind: 'body', ref: w.hitSrc };
		return null;
	}
	function gate(){
		const src = currentSource();
		if(!src) return true;      // not a spell: any parry holds, as ever
		const w = W(); if(!w) return true;
		const I = info(), S = w.spellStrength(src.ref);
		const x = src.ref.x, y = src.ref.y;
		if(!(S <= I.cap)){ note('strong', player.x + player.w / 2, player.y - 20, S, I.cap, I.anti); return false; }
		let kind = 'parried';
		if(src.kind === 'proj'){
			const p = src.ref;
			if(I.reflect && !p.reflectImmune){ reflectProjectile(p, { reflect: true, aimFn, keep: I.keep, dark: true }); kind = 'reflected'; }
			p.hasHit = true; p._parried = true; p.power = 0;      // the caller takes it out of play
		} else {
			const b = src.ref;
			if(I.reflect){ w.reflectBody(b, { aimFn, keep: I.keep, strip: I.strip, dark: true }); kind = 'reflected'; }
		}
		note(kind, x, y, S, I.cap, I.anti);
		strain(I, S, kind === 'reflected');
		return true;
	}
	function aimFn(b){ return aimFor(b); }

	SP.update = update;
	SP.gate = gate;
	window.SpellParry = SP;
	hookHost();

	if(typeof MeleeMode !== 'undefined') MeleeMode.spellGate = gate;
	const prev = window.magicUpkeep;
	window.magicUpkeep = function(dt){ if(prev) prev(dt); try { update(dt); } catch(e){ if(window.reportGameError) window.reportGameError('spell parry', String(e && e.message || e), '', ''); else console.error(e); } };
})();
