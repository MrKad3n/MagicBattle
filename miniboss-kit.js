/* =============================================================
   MINI-BOSS KIT (window.MiniBossKit) — Frostbound Knight · Magma Warden · Storm Raptor · Elder Treant
   -------------------------------------------------------------
   One engine for all four mini-bosses: new sprite sheets (images/minibosses/<boss>-<tier>.png, built by
   tools/miniboss-art), new movesets, and real differences between the tiers:

     Normal  the moveset, with clear punish windows after big attacks
     ★ Alpha   faster, combos (attacks chain in twos), bigger patterns
     ★★ Elder  new attacks of its own, more mobility, short recovery, a new sheet
     ★★★ Tyrant the Tyrant sheet, every attack, ultimates, a second phase under 55%, relentless AI —
             tougher and deadlier than a dungeon boss

   It takes over a mini-boss once it is awake. Waking stays with the code that owns each place (the Frostbound
   Knight's ice court, the Warden's lever, the Living Wilds arenas, the Sylvaris cave cutscene), so this file
   only acts once the fight has started.

   Every damaging thing is telegraphed: a warning shape fills up before it lands. Hooks (dungeon.html):
     updateEnemies → MiniBossKit.update(en)        (before the old kits)
     drawEnemy     → MiniBossKit.draw(en)
     world pass    → MiniBossKit.drawWorld()       (beside drawIgnarothWorld)
   EliteVariants.apply() hands mini-bosses to MiniBossKit.applyTier().
   ============================================================= */
(function(root){
	'use strict';
	if(typeof window === 'undefined') return;

	const TYPES = { frostboundKnight: 'knight', magmaWarden: 'warden', stormRaptor: 'raptor', elderTreant: 'treant' };
	// sheet geometry (216-px frames): feet line and body height in sheet pixels
	const META = {
		knight: { footY: 208.5, bodyH: 132, flier: false, el: 'ice' },
		warden: { footY: 208.5, bodyH: 135, flier: false, el: 'magma' },
		raptor: { footY: 108, bodyH: 92, flier: true, el: 'lightning' },
		treant: { footY: 210, bodyH: 158, flier: false, el: 'nature' },
	};
	const FRAME = 216, ROWS = { idle: 0, move: 1, attackA: 2, attackB: 3, cast: 4, special: 5, hurt: 6, death: 7 };
	const TIER_KEYS = ['base', 'alpha', 'elder', 'tyrant'];
	// hp/dmg are on top of the type's own numbers; Survival passes its own hp (see applyTier)
	const TIER = [
		{ hp: 1,   dmg: 1,    spd: 1,    cd: 1,    size: 1,    rec: 1,    chain: 1 },
		{ hp: 2.6, dmg: 1.25, spd: 1.12, cd: 0.85, size: 1.12, rec: 0.72, chain: 2 },
		{ hp: 4.5, dmg: 1.5,  spd: 1.22, cd: 0.72, size: 1.22, rec: 0.5,  chain: 3 },
		{ hp: 10,  dmg: 1.85, spd: 1.32, cd: 0.58, size: 1.35, rec: 0.3,  chain: 4 },
	];
	const STARS = ['', '★', '★★', '★★★'];
	const TITLES = {
		knight: ['Frostbound Knight', 'Frostbound Champion', 'Frostbound Paragon', 'Winter Tyrant'],
		warden: ['Magma Warden', 'Magma Warden Alpha', 'Elder Magma Warden', 'Molten Tyrant'],
		raptor: ['Storm Raptor', 'Storm Raptor Alpha', 'Elder Storm Raptor', 'Tempest Sovereign'],
		treant: ['Elder Treant', 'Elder Treant Alpha', 'Ancient Treant', 'Blighted Elder'],
	};
	const TIER_COLOR = ['#e8e8e8', '#ffd166', '#ff9f5a', '#ff4a5e'];

	const rnd = Math.random, TAU = Math.PI * 2;
	const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
	const lerp = (a, b, t) => a + (b - a) * t;
	const owns = (en) => !!(en && TYPES[en.necroType || en.type] && !en.isNecroSummon && !en.necroFriendly);
	const pcx = () => player.x + player.w / 2, pcy = () => player.y + player.h / 2;
	const ecx = (en) => en.x + en.w / 2, ecy = (en) => en.y + en.h / 2;
	const EFXok = () => !!root.EFX;
	const sim = () => (typeof _simTick === 'number' ? _simTick : 0);

	/* ================================================================== sprites */
	const IMG = {};
	function sheet(boss, tier){
		const key = boss + '-' + TIER_KEYS[tier];
		if(IMG[key]) return IMG[key];
		const img = new Image();
		const src = 'images/minibosses/' + key + '.png?v=1';
		if(root.LAZY_IMG && LAZY_IMG.loadDecoded) LAZY_IMG.loadDecoded(img, src); else img.src = src;
		return (IMG[key] = img);
	}
	function prefetch(type, tier){ const b = TYPES[type]; if(b) sheet(b, tier || 0); }

	/* ================================================================== world queries */
	function floorAt(x, y){
		if(typeof fireKitFloorY === 'function'){ const f = fireKitFloorY(x, y); if(isFinite(f)) return f; }
		return (typeof GROUND_Y === 'number') ? GROUND_Y : y + 200;
	}
	function playerFloor(){ return floorAt(pcx(), player.y + player.h - 6); }
	function arenaOf(en){
		const cx = ecx(en), cy = ecy(en);
		const rooms = (typeof dungeon !== 'undefined' && dungeon && dungeon.rooms) || [];
		let room = (en.roomId != null && rooms[en.roomId]) || null;
		if(!room) for(const r of rooms){ if(cx >= r.x && cx <= r.x + r.w && cy >= r.y - 40 && cy <= r.y + r.h + 40){ room = r; break; } }
		if(room) return { l: room.x + 30, r: room.x + room.w - 30, top: room.y + 20 };
		if(typeof IS_SURVIVAL !== 'undefined' && IS_SURVIVAL && root.SurvivalArena){ const B = SurvivalArena.BOUNDS; return { l: B.left + 30, r: B.right - 30, top: B.ceil + 20 }; }
		const half = 1000;
		return { l: cx - half, r: cx + half, top: cy - 900 };
	}

	// the part of the arena around the player that a big pattern should cover (wide arenas would put it off-screen)
	function local(S, half){ const h = half || 820; return { l: Math.max(S.arena.l, pcx() - h), r: Math.min(S.arena.r, pcx() + h), top: Math.max(S.arena.top, pcy() - 760) }; }

	/* ================================================================== damage */
	const DIFF = () => (typeof DIFF_DMG_MULT === 'number' ? DIFF_DMG_MULT : 1);
	function playerIn(x, y, w, h){ return player.x + player.w > x && player.x < x + w && player.y + player.h > y && player.y < y + h; }
	function playerInCirc(x, y, r){ return typeof circRect === 'function' ? circRect(x, y, r, player.x, player.y, player.w, player.h) : Math.hypot(pcx() - x, pcy() - y) < r + 16; }
	function hurt(dmg, eff, kx, ky){
		if(player.iFrames > 0 || typeof damagePlayer !== 'function') return false;
		damagePlayer(Math.round(dmg * DIFF()), eff || []);
		if((kx || ky) && typeof magicLaunchPlayer === 'function') magicLaunchPlayer(kx || 0, ky || 0);
		return true;
	}
	function shake(a, b){ if(typeof shakeScreen === 'function') shakeScreen(a, b); }
	function say(x, y, text, color){ if(typeof dmgNumbers !== 'undefined') dmgNumbers.push({ x, y, text, age: 0, color: color || '#ffffff' }); }
	function banner(en, text){
		const S = en._mb;
		S.banner = { text, t: 120 };
		if(typeof notify === 'function' && S.loud) try { notify(text); } catch(e){}
	}

	/* ================================================================== state */
	function tierOf(en){ return en._elite && en._elite.mb ? en._elite.tier : 0; }
	function init(en){
		const boss = TYPES[en.necroType || en.type], tier = tierOf(en);
		const S = en._mb = {
			boss, tier, T: TIER[tier], key: TIER_KEYS[tier], el: META[boss].el,
			fx: [], atk: null, cd: 70, rec: 0, chain: 0, chainMax: 1, phase: 1, intro: 80, age: 0,
			anim: { row: ROWS.cast, dur: 70, t: 0, loop: false }, arena: arenaOf(en),
			lastHp: en.hp, armor: 0, guard: 0, ultT: 0, used: {}, minions: [], banner: null,
			hover: 0, recent: [], hitFlash: 0, stagger: 0, deadT: 0,
		};
		en._stunResist = Math.max(en._stunResist || 0, 4 + tier);
		en.bossPhase = 1;
		sheet(boss, tier);
		return S;
	}
	// the fight starts when you come within its detection range (rooms and cutscenes gate this further up)
	function engage(en, S){
		S.engaged = true; S.intro = 80; S.arena = arenaOf(en);
		setAnim(S, ROWS.cast, 70, false);
		banner(en, (S.tier ? STARS[S.tier] + ' ' : '') + TITLES[S.boss][S.tier].toUpperCase());
		if(EFXok()){ EFX.burst(ecx(en), ecy(en), S.el, 1.8 + S.tier * 0.4); EFX.ring(ecx(en), en.y + en.h, 10, 160 + S.tier * 40, S.el, 32, { flat: 0.3, width: 6 }); }
		shake(6 + S.tier * 2, 14);
	}
	function disengage(en, S){ S.engaged = false; S.atk = null; S.fx.length = 0; S.armor = 0; S.guard = 0; setAnim(S, ROWS.idle, 60, true); }
	function setAnim(S, row, dur, loop){
		if(S.anim.row === row && S.anim.loop && loop) { S.anim.dur = dur; return; }
		S.anim = { row, dur: Math.max(8, dur), t: 0, loop: !!loop };
	}

	/* ================================================================== the effect engine
	   Everything an attack leaves in the world lives in S.fx and is processed inside the boss's own update,
	   so a boss version's damage scaling (EliteVariants' scope) applies to it. */
	function fx(S, o){ o.t = 0; S.fx.push(o); return o; }
	// warning shapes
	function teleCircle(S, x, y, r, dur, el, follow){ return fx(S, { k: 'tele', shape: 'circle', x, y, r, dur, el: el || S.el, follow }); }
	function teleRect(S, x, y, w, h, dur, el){ return fx(S, { k: 'tele', shape: 'rect', x, y, w, h, dur, el: el || S.el }); }
	function teleLine(S, x0, y0, x1, y1, w, dur, el){ return fx(S, { k: 'tele', shape: 'line', x0, y0, x1, y1, w, dur, el: el || S.el }); }
	// a delayed hit: after `at` frames, damage everyone in the shape and play `boom`
	function strikeCircle(S, x, y, r, at, dmg, eff, el, boom, kx, ky){ teleCircle(S, x, y, r, at, el); return fx(S, { k: 'strike', shape: 'circle', x, y, r, at, dmg, eff, el: el || S.el, boom, kx, ky }); }
	function strikeRect(S, x, y, w, h, at, dmg, eff, el, boom, kx, ky, noTele){ if(!noTele) teleRect(S, x, y, w, h, at, el); return fx(S, { k: 'strike', shape: 'rect', x, y, w, h, at, dmg, eff, el: el || S.el, boom, kx, ky }); }
	// a lingering patch on the floor
	function zone(S, x, y, w, h, life, dmg, tick, eff, style, slow){ return fx(S, { k: 'zone', x, y, w, h, life, dmg, tick: tick || 20, eff, style: style || S.el, slow: slow || 0 }); }
	// a jumpable wave that runs along the floor
	function wave(S, x, y, dir, spd, h, range, dmg, eff, style){ return fx(S, { k: 'wave', x, x0: x, y, dir, spd, h, range, dmg, eff, style: style || S.el, hit: false }); }
	// a column that erupts from the floor after a warning
	function pillar(S, x, floor, w, h, at, dmg, eff, style, life){ return fx(S, { k: 'pillar', x, y: floor, w, h, at, life: life || 26, dmg, eff, style: style || S.el, hit: false }); }

	function tickFx(en, S){
		for(let i = S.fx.length - 1; i >= 0; i--){
			const f = S.fx[i]; f.t++;
			let done = false;
			switch(f.k){
				case 'tele':
					if(f.follow){ const p = f.follow(f); if(p){ f.x = p[0]; f.y = p[1]; } }
					done = f.t >= f.dur; break;
				case 'strike':
					if(f.t >= f.at){
						const hit = f.shape === 'circle' ? playerInCirc(f.x, f.y, f.r) : playerIn(f.x, f.y, f.w, f.h);
						if(hit) hurt(f.dmg, f.eff, f.kx ? (pcx() >= (f.x + (f.w || 0) / 2) ? f.kx : -f.kx) : 0, f.ky || 0);
						if(f.boom) f.boom(f);
						done = true;
					}
					break;
				case 'zone':
					if(f.t <= f.life){
						if(playerIn(f.x, f.y, f.w, f.h)){
							if(f.dmg && f.t % f.tick === 0) hurt(f.dmg, f.eff);
							if(f.slow) player.slowTimer = Math.max(player.slowTimer || 0, f.slow);
						}
					}
					done = f.t > f.life; break;
				case 'wave': {
					f.x += f.dir * f.spd;
					const travelled = Math.abs(f.x - f.x0);
					if(!f.hit && Math.abs(pcx() - f.x) < 26 && player.y + player.h > f.y - f.h + 6 && player.y < f.y){ f.hit = hurt(f.dmg, f.eff, f.dir * 7, -5) || f.hit; }
					if(EFXok() && f.t % 3 === 0) EFX.debris(f.style, f.x, f.y - 6, 1, { speed: 4, floor: f.y, scale: 0.7 });
					done = travelled > f.range; break;
				}
				case 'pillar':
					if(f.t === f.at){
						if(EFXok()){ EFX.burst(f.x, f.y - f.h * 0.4, f.style, 1.2); EFX.debris(f.style, f.x, f.y - 6, 6, { speed: 6, floor: f.y }); }
						shake(3, 6);
					}
					if(f.t >= f.at && f.t < f.at + 8 && !f.hit && playerIn(f.x - f.w / 2, f.y - f.h, f.w, f.h)) f.hit = hurt(f.dmg, f.eff, 0, -8);
					done = f.t >= f.at + f.life; break;
				default:
					if(f.tick) done = f.tick(f, en, S) === true;
					else done = f.t > (f.life || 60);
			}
			if(done) S.fx.splice(i, 1);
		}
	}

	/* ================================================================== drawing the world effects */
	function drawFx(en, S){
		if(!EFXok()) return;
		const E = EFX;
		for(const f of S.fx){
			switch(f.k){
				case 'tele': {
					const p = Math.min(1, f.t / f.dur);
					if(f.shape === 'circle') E.warnCircle(f.x, f.y, f.r, p, f.el, { flat: f.flat || 0.42 });
					else if(f.shape === 'rect') E.warnRect(f.x, f.y, f.w, f.h, p, f.el);
					else E.warnLine(f.x0, f.y0, f.x1, f.y1, f.w, p, f.el);
					break;
				}
				case 'zone': {
					const a = Math.min(1, f.t / 8) * Math.min(1, (f.life - f.t) / 20);
					if(f.style === 'magma' || f.style === 'fire') E.flameStrip(f.x, f.x + f.w, f.y + f.h, f.style, a, { height: Math.min(36, f.h + 10) });
					else { E.warnRect(f.x, f.y, f.w, f.h, 1, f.style, { alpha: 0.55 * a }); if((S.age & 7) === 0) E.emit(f.style, f.x + rnd() * f.w, f.y + f.h * 0.5, 1, { speed: 0.6 }); }
					break;
				}
				case 'wave': {
					for(let k = 0; k < 3; k++) E.spike(f.x - f.dir * k * 18, f.y, f.h * (1 - k * 0.28), 22 - k * 4, f.style, { lean: f.dir * 0.15 });
					break;
				}
				case 'pillar': {
					if(f.t < f.at) E.warnRect(f.x - f.w / 2, f.y - f.h, f.w, f.h, f.t / f.at, f.style);
					else {
						const u = Math.min(1, (f.t - f.at) / 6), fade = Math.min(1, (f.at + f.life - f.t) / 10);
						E.spike(f.x, f.y, f.h * u, f.w, f.style, { alpha: fade });
						if(f.style === 'magma' || f.style === 'fire') E.flameStrip(f.x - f.w / 2, f.x + f.w / 2, f.y, f.style, fade, { height: f.h * u, step: 10 });
					}
					break;
				}
				default:
					if(f.draw) f.draw(f, E, en, S);
			}
		}
	}

	/* ================================================================== movement */
	function grounded(en){ return !META[en._mb.boss].flier; }
	function walk(en, S, vx){
		en.vx = vx;
		if(grounded(en)){
			en.vy = (en.vy || 0) + (typeof GRAVITY === 'number' ? GRAVITY : 0.6);
			if(en.vy > 18) en.vy = 18;
			if(typeof moveEntityTile === 'function') moveEntityTile(en); else { en.x += en.vx; en.y += en.vy; }
		} else {
			if(typeof moveEntityTile === 'function') moveEntityTile(en); else { en.x += en.vx; en.y += en.vy; }
		}
		const A = S.arena;
		if(en.x < A.l){ en.x = A.l; en.vx = 0; }
		if(en.x + en.w > A.r){ en.x = A.r - en.w; en.vx = 0; }
	}
	function face(en){ const d = pcx() - ecx(en); if(Math.abs(d) > 6) en.facing = d > 0 ? 1 : -1; return en.facing || 1; }
	function dist(en){ return Math.hypot(pcx() - ecx(en), pcy() - ecy(en)); }
	function hdist(en){ return Math.abs(pcx() - ecx(en)); }
	// fliers steer toward a point
	function flyTo(en, S, tx, ty, spd, ease){
		const dx = tx - ecx(en), dy = ty - ecy(en), d = Math.hypot(dx, dy);
		const v = d > 1 ? Math.min(spd, d * (ease || 0.08)) : 0;
		en.vx = lerp(en.vx || 0, d > 1 ? dx / d * v : 0, 0.18);
		en.vy = lerp(en.vy || 0, d > 1 ? dy / d * v : 0, 0.18);
		const ovx = en.vx, ovy = en.vy;
		if(typeof moveEntityTile === 'function') moveEntityTile(en); else { en.x += en.vx; en.y += en.vy; }
		en.vx = ovx; en.vy = ovy;
		const A = S.arena;
		en.x = clamp(en.x, A.l, A.r - en.w);
		if(en.y < A.top) en.y = A.top;
		en.baseY = en.y; en.flyOffset = 0;
	}

	/* ================================================================== minions */
	function aliveMinions(S){ S.minions = S.minions.filter(m => m && !m.dead && (typeof enemies === 'undefined' || enemies.indexOf(m) >= 0)); return S.minions.length; }
	function summon(en, S, type, x){
		if(typeof makeWorldEnemy !== 'function' || typeof enemies === 'undefined' || !ENEMY_TYPES[type]) return null;
		if(aliveMinions(S) >= 3) return null;
		const fy = floorAt(x, en.y);
		const m = makeWorldEnemy({ type, x: x - ENEMY_TYPES[type].w / 2, y: fy, face: en.facing || 1 });
		if(!m) return null;
		m._worldFoe = false; m.state = 'alert'; m.alertTimer = 99999;
		for(const k of ['_surv', '_wave', '_sbSpawn', 'roomId']) if(en[k] != null) m[k] = en[k];
		if(en._coopKey) m._coopKey = en._coopKey + '_m' + (S.age % 100000) + '_' + S.minions.length;
		m.hp = m.maxHp = Math.round(m.maxHp * (0.6 + S.tier * 0.25));
		enemies.push(m); S.minions.push(m);
		if(EFXok()){ EFX.burst(x, fy - 20, S.el, 1.2); EFX.ring(x, fy, 6, 70, S.el, 20, { flat: 0.3 }); }
		return m;
	}

	/* ================================================================== attack plumbing */
	// an attack = { name, row, dur (animation frames for the 8-frame row), run(en,S,a) → true when finished, rec (recovery) }
	function start(en, S, def){
		S.atk = { def, name: def.name, t: 0, n: 0, d: {} };
		setAnim(S, def.row != null ? def.row : ROWS.attackA, def.dur || 50, false);
		S.used[def.name] = S.age;
		S.recent.push(def.name); if(S.recent.length > 3) S.recent.shift();
		en.attackAnimTimer = 30;
	}
	function finish(en, S, rec){
		S.atk = null;
		S.chain++;
		const r = (rec == null ? 40 : rec) * S.T.rec * (S.phase > 1 ? 0.75 : 1);
		if(S.chain >= S.chainMax){ S.chain = 0; S.rec = Math.round(r + 16); S.cd = Math.round((55 + rnd() * 40) * S.T.cd * (S.phase > 1 ? 0.8 : 1)); S.chainMax = 1 + Math.floor(rnd() * S.T.chain); }
		else { S.rec = Math.round(r * 0.35); S.cd = 2; }
	}
	// pick an attack: weights from each move's own wants(), skipping repeats and moves still on their personal cooldown
	function pick(en, S, moves){
		const d = dist(en), hd = hdist(en);
		const list = [];
		let tot = 0;
		for(const m of moves){
			if(m.tier != null && S.tier < m.tier) continue;
			if(m.phase && S.phase < m.phase) continue;
			if(m.every && S.used[m.name] != null && S.age - S.used[m.name] < m.every / S.T.cd) continue;
			let w = m.want ? m.want(d, hd, en, S) : 1;
			if(S.recent[S.recent.length - 1] === m.name) w *= 0.15;
			if(w > 0){ list.push([m, w]); tot += w; }
		}
		if(!list.length) return null;
		let r = rnd() * tot;
		for(const [m, w] of list){ r -= w; if(r <= 0) return m; }
		return list[0][0];
	}

	/* ================================================================== shared moves */
	// a ground shockwave pair (jumpable) from x
	function quakeWaves(S, x, y, dmg, range, spd, h, style){
		wave(S, x, y, 1, spd, h, range, dmg, ['stun'], style); wave(S, x, y, -1, spd, h, range, dmg, ['stun'], style);
		if(EFXok()){ EFX.groundWave(x, y, 120, style || S.el); EFX.debris(style || S.el, x, y - 6, 10, { speed: 7, floor: y }); }
		shake(8, 14);
	}
	// meteors / falling objects onto marked circles
	function meteor(S, x, floor, r, at, dmg, eff, style){
		strikeCircle(S, x, floor - 10, r, at, dmg, eff, style, (f) => { if(EFXok()){ EFX.burst(f.x, f.y, style || S.el, 1.6); EFX.debris(style || S.el, f.x, f.y, 8, { speed: 7, floor: floor }); EFX.groundWave(f.x, floor, r, style || S.el); } shake(5, 8); });
		fx(S, { k: 'fall', x, y0: floor - 700, y1: floor - 10, at, style: style || S.el, life: at, draw: (f, E) => { const u = f.t / f.at; if(u > 0.35){ const k = (u - 0.35) / 0.65; E.glow(f.x, lerp(f.y0, f.y1, k * k), 18 + 10 * k, E.pal(f.style).mid, 0.8); E.glow(f.x, lerp(f.y0, f.y1, k * k), 8, E.pal(f.style).core, 1); } } });
	}

	/* ================================================================== FROSTBOUND KNIGHT */
	const KNIGHT = [
		{ name: 'cleave', row: ROWS.attackA, dur: 44, want: (d) => d < 210 ? 4 : 0, rec: 30, run: (en, S, a) => {
			if(a.t === 1){ face(en); a.d.dir = en.facing; a.d.n = 0; a.d.hits = S.tier >= 3 ? 3 : S.tier >= 1 ? 2 : 1; }
			if(a.t === 2 || a.d.next === a.t){
				const dir = a.d.dir, x = dir > 0 ? en.x + en.w * 0.4 : en.x + en.w * 0.6 - 230;
				const at = a.d.n ? 16 : 24;
				strikeRect(S, x, en.y - 20, 230, en.h + 20, at, 34, ['freeze'], 'ice', (f) => {
					if(EFXok()){ EFX.slash(ecx(en) + dir * 70, ecy(en), dir > 0 ? 0.2 : Math.PI - 0.2, 140, 2.2, 'ice', { width: 14 }); EFX.burst(ecx(en) + dir * 140, en.y + en.h - 20, 'ice', 1); }
					if(S.tier >= 3) for(let k = 1; k <= 3; k++) pillar(S, ecx(en) + dir * (90 + k * 60), en.y + en.h, 34, 70 + k * 12, 10 + k * 6, 22, ['freeze'], 'ice');
					shake(4, 6);
				}, 7, -3);
				a.d.n++;
				if(a.d.n < a.d.hits){ a.d.next = a.t + at + 4; if(a.d.n === 1) setAnim(S, ROWS.attackA, 40, false); }
				else a.d.end = a.t + at + 6;
				if(a.d.n > 1){ a.d.dir = face(en); setAnim(S, ROWS.attackA, 36, false); }
			}
			walk(en, S, a.t < 10 ? a.d.dir * 1.5 : 0);
			return a.t >= (a.d.end || 99);
		} },
		{ name: 'lunge', row: ROWS.attackB, dur: 42, want: (d, hd) => hd > 200 && hd < 560 ? 3 : hd >= 560 ? 1 : 0, rec: 42, run: (en, S, a) => {
			if(a.t === 1){
				face(en); a.d.dir = en.facing;
				const len = Math.min(520, Math.max(260, hdist(en) + 120));
				a.d.x0 = ecx(en); a.d.x1 = clamp(a.d.x0 + a.d.dir * len, S.arena.l + en.w / 2, S.arena.r - en.w / 2);
				teleLine(S, a.d.x0, en.y + en.h - 22, a.d.x1, en.y + en.h - 22, 46, 26, 'ice');
			}
			if(a.t >= 26 && a.t < 46){
				walk(en, S, a.d.dir * 24 * S.T.spd);
				if(!a.d.hit && playerIn(en.x - 10, en.y, en.w + 20, en.h)) a.d.hit = hurt(32, ['freeze'], a.d.dir * 8, -4);
				if(EFXok() && a.t % 2 === 0) EFX.emit('ice', ecx(en), en.y + en.h - 10, 3, { speed: 1.4 });
				if((a.d.dir > 0 && ecx(en) >= a.d.x1) || (a.d.dir < 0 && ecx(en) <= a.d.x1)) a.t = Math.max(a.t, 46);
			} else walk(en, S, 0);
			if(a.t === 46){
				const xa = Math.min(a.d.x0, ecx(en)), xb = Math.max(a.d.x0, ecx(en)), fy = en.y + en.h;
				zone(S, xa, fy - 14, xb - xa, 16, 150, 6, 30, ['freeze'], 'ice', 40);
				if(S.tier >= 2) for(let x = xa + 40; x < xb; x += 70) pillar(S, x, fy, 30, 80, 40 + (x - xa) / 30, 20, ['freeze'], 'ice');
			}
			return a.t >= 52;
		} },
		{ name: 'frostWave', row: ROWS.cast, dur: 56, want: (d) => d < 750 ? 2 : 0.5, rec: 38, run: (en, S, a) => {
			walk(en, S, 0);
			if(a.t === 1){ face(en); if(EFXok()) EFX.charge(ecx(en), ecy(en), 'ice', 90, 12, 28); }
			const waves = S.tier >= 3 ? 3 : S.tier >= 1 ? 2 : 1;
			for(let k = 0; k < waves; k++) if(a.t === 30 + k * 26){
				const fy = en.y + en.h;
				quakeWaves(S, ecx(en), fy, 26, 760, 7 + k, 52 + S.tier * 10, 'ice');
				if(k === 0 && EFXok()) EFX.burst(ecx(en) + en.facing * 30, fy - 10, 'ice', 1.4);
			}
			return a.t >= 30 + (waves - 1) * 26 + 18;
		} },
		{ name: 'hailbreaker', row: ROWS.special, dur: 64, want: (d, hd) => hd > 240 ? 2.4 : 0.6, rec: 46, run: (en, S, a) => {
			const leaps = S.tier >= 3 ? 2 : 1;
			if(a.t === 1 || a.d.again === a.t){
				face(en);
				a.d.x0 = en.x; a.d.y0 = en.y; a.d.lock = a.t + 18; a.d.land = a.t + 44; a.d.tx = pcx();
				a.d.tele = teleCircle(S, pcx(), playerFloor(), 120, 44, 'ice', (f) => a.t < a.d.lock ? [pcx(), playerFloor()] : null);
				setAnim(S, ROWS.special, 64, false);
				a.d.n = (a.d.n || 0) + 1;
			}
			if(a.t === a.d.lock) a.d.tx = clamp(pcx(), S.arena.l + en.w / 2, S.arena.r - en.w / 2);
			if(a.t > a.d.lock - 6 && a.t < a.d.land){
				const u = (a.t - (a.d.lock - 6)) / (a.d.land - (a.d.lock - 6));
				const fy = floorAt(a.d.tx, en.y);
				en.x = lerp(a.d.x0, a.d.tx - en.w / 2, u);
				en.y = lerp(a.d.y0, fy - en.h, u) - Math.sin(u * Math.PI) * 260;
				en.vy = 0;
			} else if(a.t !== a.d.land) walk(en, S, 0);
			if(a.t === a.d.land){
				const fy = floorAt(ecx(en), en.y); en.y = fy - en.h;
				if(playerInCirc(ecx(en), fy - 10, 130)) hurt(38, ['freeze'], 9, -7);
				if(EFXok()){ EFX.burst(ecx(en), fy - 10, 'ice', 2); EFX.groundWave(ecx(en), fy, 150, 'ice'); EFX.debris('ice', ecx(en), fy - 6, 12, { speed: 8, floor: fy }); }
				shake(10, 16);
				if(S.tier >= 2) for(let i = 0; i < 6; i++){ const ang = Math.PI + i / 5 * Math.PI; shard(S, ecx(en), fy - 30, Math.cos(ang) * 8, Math.sin(ang) * 8, 18); }
				if(a.d.n < leaps) a.d.again = a.t + 16;
				else a.d.end = a.t + 20;
			}
			return a.t >= (a.d.end || 999);
		} },
		{ name: 'guard', row: ROWS.cast, dur: 20, want: (d, hd, en, S) => d < 260 && S.age - (S.used.guard || -999) > 500 ? 1.2 : 0, rec: 10, run: (en, S, a) => {
			walk(en, S, 0); face(en);
			if(a.t === 1){ S.guard = 80; a.d.hp = en.hp; say(ecx(en), en.y - 40, 'GUARD', '#a6f2ff'); if(EFXok()) EFX.ring(ecx(en), ecy(en), 20, 90, 'ice', 22, { width: 6 }); }
			if(a.t > 1 && en.hp < a.d.hp - 1){
				// struck while guarding: an instant (but flagged) counter-slash
				S.guard = 0; a.d.counter = a.t;
				say(ecx(en), en.y - 50, 'COUNTER!', '#ffffff');
				const dir = face(en), x = dir > 0 ? en.x + en.w * 0.3 : en.x + en.w * 0.7 - 250;
				strikeRect(S, x, en.y - 20, 250, en.h + 20, 12, 30, ['freeze'], 'ice', () => { if(EFXok()) EFX.slash(ecx(en) + dir * 80, ecy(en), dir > 0 ? 0 : Math.PI, 160, 2.6, 'ice', { width: 16 }); shake(5, 8); }, 9, -4);
				setAnim(S, ROWS.attackA, 30, false);
			}
			if(a.d.counter) return a.t >= a.d.counter + 18;
			return a.t >= 80;
		} },
		// ---- Elder
		{ name: 'blizzardSigils', tier: 2, row: ROWS.cast, dur: 60, every: 420, want: (d) => 1.6, rec: 34, run: (en, S, a) => {
			walk(en, S, 0);
			const n = S.tier >= 3 ? 5 : 3;
			if(a.t === 6){
				for(let i = 0; i < n; i++){
					const off = i === 0 ? 0 : (i % 2 ? 1 : -1) * (Math.ceil(i / 2) * 150);
					const x = clamp(pcx() + off, S.arena.l + 40, S.arena.r - 40), fy = floorAt(x, player.y);
					pillar(S, x, fy, 60, 150, 52 + i * 6, 34, ['freeze'], 'ice', 34);
				}
				if(EFXok()) EFX.burst(ecx(en), en.y + 20, 'ice', 1.2);
			}
			return a.t >= 70;
		} },
		{ name: 'frozenEcho', tier: 2, row: ROWS.attackB, dur: 40, every: 540, want: (d, hd) => hd > 160 ? 1.4 : 0.4, rec: 20, run: (en, S, a) => {
			walk(en, S, 0);
			if(a.t === 1){
				face(en);
				// an ice double of the knight: it lunges along the marked line a beat later, while the knight keeps fighting
				const dir = en.facing, x0 = ecx(en), x1 = clamp(x0 + dir * 560, S.arena.l, S.arena.r), y = en.y + en.h - 22;
				teleLine(S, x0, y, x1, y, 48, 50, 'ice');
				fx(S, { k: 'echo', x: en.x, y: en.y, w: en.w, h: en.h, dir, x1, life: 90, hit: false,
					tick: (f) => { if(f.t > 50 && f.t < 72){ f.x += f.dir * 26; if(!f.hit && playerIn(f.x, f.y, f.w, f.h)) f.hit = hurt(30, ['freeze'], f.dir * 7, -4); } return f.t > 90; },
					draw: (f, E) => { const a2 = f.t < 50 ? f.t / 50 : 1 - (f.t - 72) / 18; E.ghost(f.x + f.w / 2, f.y + f.h * 0.6, f.w, f.h, 'ice', clamp(a2, 0, 1) * 0.9); } });
			}
			return a.t >= 30;
		} },
		// ---- Tyrant
		{ name: 'shatterRush', tier: 3, row: ROWS.attackB, dur: 30, every: 360, want: (d, hd) => hd > 180 ? 1.6 : 0.6, rec: 40, run: (en, S, a) => {
			if(a.t === 1) a.d.k = 0;
			const k = a.d.k, base = 1 + k * 36;
			if(a.t === base){ face(en); a.d.dir = en.facing; a.d.x1 = clamp(ecx(en) + a.d.dir * 420, S.arena.l, S.arena.r); teleLine(S, ecx(en), en.y + en.h - 22, a.d.x1, en.y + en.h - 22, 44, 18, 'ice'); setAnim(S, ROWS.attackB, 34, false); a.d.hit = false; }
			if(a.t > base + 18 && a.t < base + 32){ walk(en, S, a.d.dir * 28); if(!a.d.hit && playerIn(en.x - 10, en.y, en.w + 20, en.h)) a.d.hit = hurt(30, ['freeze'], a.d.dir * 8, -4); if(EFXok()) EFX.emit('ice', ecx(en), en.y + en.h - 10, 2, { speed: 1.4 }); }
			else walk(en, S, 0);
			if(a.t === base + 34){ a.d.k++; }
			return a.d.k >= 3;
		} },
		{ name: 'absoluteZero', tier: 3, phase: 2, row: ROWS.cast, dur: 170, every: 1500, want: () => 6, rec: 60, run: (en, S, a) => {
			walk(en, S, 0);
			if(a.t === 1){
				banner(en, 'ABSOLUTE ZERO — reach a glyph');
				S.armor = 0.5;
				// three glyphs, the nearest well away from you, so you have to move
				const A = local(S, 700), gl = [];
				for(let i = 0; i < 3; i++){
					let x, tries = 0;
					do { x = A.l + 80 + rnd() * (A.r - A.l - 160); tries++; } while(tries < 30 && (Math.abs(x - pcx()) < 240 || gl.some(g => Math.abs(g - x) < 220)));
					gl.push(x);
				}
				a.d.glyphs = gl.map(x => ({ x, y: floorAt(x, player.y), r: 78 }));
				fx(S, { k: 'glyphs', life: 150, list: a.d.glyphs, draw: (f, E) => { for(const g of f.list){ E.warnCircle(g.x, g.y - 6, g.r, 1, 'light', { flat: 0.32 }); E.glow(g.x, g.y - 20, g.r * 0.9, '#ffffff', 0.25 + 0.15 * Math.sin(f.t * 0.3)); } } });
				const LA = local(S, 1100); fx(S, { k: 'chill', life: 150, draw: (f, E) => { const p = f.t / 150; E.warnRect(LA.l, LA.top, LA.r - LA.l, floorAt(pcx(), player.y) - LA.top, p * 0.6, 'ice', { alpha: 0.18 + p * 0.22 }); } });
			}
			if(a.t % 8 === 0 && EFXok()) EFX.charge(ecx(en), ecy(en), 'ice', 160, 6, 22);
			if(a.t === 150){
				const safe = a.d.glyphs.some(g => Math.hypot(pcx() - g.x, (player.y + player.h) - g.y) < g.r + 10);
				if(!safe){ hurt(62, ['freeze', 'stun']); say(pcx(), player.y - 30, 'FROZEN', '#c4fcff'); }
				if(EFXok()){ EFX.flash(ecx(en), ecy(en), 900, 'ice', 18); for(let i = 0; i < 12; i++) EFX.burst(S.arena.l + rnd() * (S.arena.r - S.arena.l), floorAt(pcx(), player.y) - rnd() * 300, 'ice', 1.2); }
				shake(16, 24);
				S.armor = 0;
			}
			return a.t >= 170;
		} },
	];
	function shard(S, x, y, vx, vy, dmg, el){
		if(typeof spawnEnemyProj !== 'function') return;
		const p = spawnEnemyProj(x, y, vx, vy, { color: '#9fe9ff', color2: '#ffffff', power: dmg, width: 18, height: 18, shape: 'spike', maxAge: 90, effects: ['freeze'], noWallCollide: true, _noSplit: true });
		if(p) p._efxEl = el || 'ice';
	}
	function knightPhase(en, S){
		if(S.tier >= 3 && S.phase === 1 && en.hp < en.maxHp * 0.55){
			S.phase = 2; en.bossPhase = 2; S.used.absoluteZero = -99999;
			banner(en, 'THE GLACIAL THRONE');
			for(let i = 0; i < 2; i++) summon(en, S, 'frostWraith', ecx(en) + (i ? 220 : -220));
			if(EFXok()) EFX.ring(ecx(en), ecy(en), 30, 320, 'ice', 40, { width: 10 });
			shake(14, 24);
		}
		// Tyrant phase 2: a frost shell while its wraiths live
		if(S.phase >= 2 && S.tier >= 3) S.shell = aliveMinions(S) > 0 ? 0.3 : 0;
	}

	/* ================================================================== MAGMA WARDEN */
	const WARDEN = [
		{ name: 'haymaker', row: ROWS.attackA, dur: 40, want: (d) => d < 220 ? 4 : 0, rec: 30, run: (en, S, a) => {
			if(a.t === 1){ face(en); a.d.dir = en.facing; a.d.n = 0; a.d.hits = S.phase > 1 ? 3 : S.tier >= 1 ? 2 : 1; a.d.next = 2; }
			if(a.t === a.d.next){
				const dir = a.d.dir = face(en), x = dir > 0 ? en.x + en.w * 0.5 : en.x + en.w * 0.5 - 210;
				strikeRect(S, x, en.y, 210, en.h, a.d.n ? 14 : 22, 40, ['burn', 'horizontalLaunch'], 'magma', () => { if(EFXok()){ EFX.burst(ecx(en) + dir * 120, ecy(en), 'magma', 1.6); EFX.slash(ecx(en) + dir * 60, ecy(en), dir > 0 ? 0 : Math.PI, 110, 1.6, 'fire', { width: 18 }); } shake(6, 10); }, 11, -6);
				a.d.n++;
				if(a.d.n < a.d.hits){ a.d.next = a.t + (a.d.n === 1 ? 26 : 20); setAnim(S, ROWS.attackA, 34, false); }
				else a.d.end = a.t + 30;
			}
			walk(en, S, a.t % 30 < 10 ? a.d.dir * 2.4 * S.T.spd : 0);
			return a.t >= (a.d.end || 999);
		} },
		{ name: 'magmaSlam', row: ROWS.attackB, dur: 58, want: (d) => d < 700 ? 2.5 : 0.6, rec: 44, run: (en, S, a) => {
			walk(en, S, 0);
			if(a.t === 1){ face(en); if(EFXok()) EFX.charge(ecx(en), en.y + 10, 'magma', 100, 10, 30); }
			if(a.t === 32){
				const fy = en.y + en.h;
				if(playerInCirc(ecx(en), fy - 20, 120)) hurt(36, ['burn'], 8, -8);
				if(EFXok()){ EFX.burst(ecx(en), fy - 10, 'magma', 2); EFX.groundWave(ecx(en), fy, 140, 'magma'); }
				shake(10, 16);
				const dirs = S.tier >= 1 ? [1, -1] : [face(en)];
				for(const dir of dirs){
					for(let i = 1; i <= 5 + S.tier; i++){
						const x = ecx(en) + dir * (40 + i * 92);
						if(x < S.arena.l || x > S.arena.r) break;
						const fy2 = floorAt(x, en.y);
						pillar(S, x, fy2, 54, 120 + S.tier * 20, 22 + i * 7, 30, ['burn'], 'magma', 28);
						if(S.tier >= 3) fx(S, { k: 'later', at: 22 + i * 7 + 28, x, fy: fy2, tick: (f) => { if(f.t === f.at) zone(S, f.x - 40, f.fy - 14, 80, 16, 140, 8, 20, ['burn'], 'magma'); return f.t >= f.at; } });
					}
				}
			}
			return a.t >= 70;
		} },
		{ name: 'slagHurl', row: ROWS.cast, dur: 44, want: (d, hd) => hd > 240 ? 2.4 : 0.5, rec: 36, run: (en, S, a) => {
			walk(en, S, 0);
			const n = S.tier >= 2 ? 3 : S.tier >= 1 ? 2 : 1;
			for(let k = 0; k < n; k++) if(a.t === 22 + k * 14){
				face(en);
				const tx = clamp(pcx() + (k - (n - 1) / 2) * 150 + (player.vx || 0) * 12, S.arena.l + 30, S.arena.r - 30), fy = floorAt(tx, player.y);
				const sx = ecx(en) + en.facing * 30, sy = en.y + 10, T = 46;
				fx(S, { k: 'boulder', sx, sy, tx, fy, T, at: T, life: T,
					tick: (f) => { if(f.t === f.T){ if(playerInCirc(f.tx, f.fy - 20, 96)) hurt(34, ['burn'], 7, -6); if(EFXok()){ EFX.burst(f.tx, f.fy - 16, 'magma', 1.8); EFX.debris('magma', f.tx, f.fy - 6, 10, { speed: 7, floor: f.fy }); } zone(S, f.tx - 70, f.fy - 14, 140, 16, 150, 8, 20, ['burn'], 'magma'); shake(6, 10);
						if(S.tier >= 3) for(let i = 0; i < 5; i++){ const ang = -Math.PI * (0.15 + i * 0.175); shard(S, f.tx, f.fy - 30, Math.cos(ang) * 7, Math.sin(ang) * 7, 16, 'magma'); } }
						return f.t >= f.T; },
					draw: (f, E) => { const u = f.t / f.T, x = lerp(f.sx, f.tx, u), y = lerp(f.sy, f.fy - 20, u) - Math.sin(u * Math.PI) * 240; E.warnCircle(f.tx, f.fy - 8, 96, u, 'magma', { flat: 0.4 }); E.glow(x, y, 34, E.pal('magma').outer, 0.7); E.glow(x, y, 18, E.pal('magma').core, 1); } });
			}
			return a.t >= 22 + n * 14 + 10;
		} },
		{ name: 'overheatCharge', row: ROWS.special, dur: 40, want: (d, hd) => hd > 260 ? 2 : 0.4, rec: 20, run: (en, S, a) => {
			if(a.t === 1){ face(en); a.d.dir = en.facing; const LA = { l: Math.max(S.arena.l, ecx(en) - 900), r: Math.min(S.arena.r, ecx(en) + 900) }; a.d.x1 = a.d.dir > 0 ? LA.r - en.w : LA.l; teleLine(S, ecx(en), en.y + en.h - 30, a.d.x1 + en.w / 2, en.y + en.h - 30, en.h * 0.8, 34, 'magma'); }
			if(a.t > 34 && !a.d.stop){
				walk(en, S, a.d.dir * 14 * S.T.spd);
				if(!a.d.hit && playerIn(en.x - 10, en.y, en.w + 20, en.h)) a.d.hit = hurt(38, ['burn', 'horizontalLaunch'], a.d.dir * 12, -7);
				if(a.t % 6 === 0) zone(S, ecx(en) - 30, en.y + en.h - 14, 60, 16, 110, 6, 20, ['burn'], 'fire');
				if((a.d.dir > 0 && en.x >= a.d.x1 - 2) || (a.d.dir < 0 && en.x <= a.d.x1 + 2) || a.t > 120){
					a.d.stop = a.t;
					// slammed into the wall: dazed — a real punish window (shorter for a Tyrant)
					if(EFXok()){ EFX.burst(ecx(en) + a.d.dir * en.w / 2, ecy(en), 'magma', 1.8); }
					shake(10, 16); say(ecx(en), en.y - 30, 'DAZED', '#ffb347');
					quakeWaves(S, ecx(en), en.y + en.h, 20, 300, 6, 40, 'magma');
				}
			} else walk(en, S, 0);
			return a.d.stop && a.t > a.d.stop + Math.round(70 * S.T.rec + 10);
		} },
		{ name: 'furnaceBreath', row: ROWS.cast, dur: 90, want: (d, hd) => hd < 380 ? 1.8 : 0, rec: 34, run: (en, S, a) => {
			walk(en, S, 0);
			if(a.t === 1){ face(en); a.d.dir = en.facing; teleRect(S, a.d.dir > 0 ? ecx(en) : ecx(en) - 340, en.y - 10, 340, en.h * 0.7, 26, 'fire'); }
			if(a.t > 26 && a.t < 86){
				const x = a.d.dir > 0 ? ecx(en) : ecx(en) - 340;
				if(a.t % 8 === 0 && playerIn(x, en.y - 10, 340, en.h * 0.7)) hurt(9, ['burn']);
				if(EFXok()){ for(let i = 0; i < 2; i++) EFX.emit('fire', ecx(en) + a.d.dir * 30, en.y + 34, 2, { speed: 6, dir: a.d.dir > 0 ? 0 : Math.PI, spread: 0.3 }); }
			}
			return a.t >= 90;
		} },
		// ---- Elder
		{ name: 'eruptionVents', tier: 2, row: ROWS.cast, dur: 60, every: 480, want: () => 1.5, rec: 30, run: (en, S, a) => {
			walk(en, S, 0);
			if(a.t === 20){
				const A = local(S, 700), n = S.tier >= 3 ? 7 : 5;
				for(let i = 0; i < n; i++){
					const x = A.l + (i + 0.5) * (A.r - A.l) / n + (rnd() - 0.5) * 60, fy = floorAt(x, player.y);
					pillar(S, x, fy, 70, 220, 40 + (i % 2) * 22 + i * 4, 30, ['burn'], 'magma', 34);
				}
			}
			return a.t >= 66;
		} },
		{ name: 'coreOverdrive', tier: 2, row: ROWS.cast, dur: 100, every: 560, want: (d) => d > 160 ? 1.6 : 0.3, rec: 44, run: (en, S, a) => {
			walk(en, S, 0);
			const ox = () => ecx(en) + en.facing * 10, oy = () => en.y + en.h * 0.38;
			if(a.t === 1){ face(en); a.d.ang = Math.atan2(pcy() - oy(), pcx() - ox()); }
			if(a.t < 40){ const t2 = Math.atan2(pcy() - oy(), pcx() - ox()); a.d.ang += clamp(t2 - a.d.ang, -0.05, 0.05); }
			const L = 900;
			if(a.t === 1) fx(S, { k: 'beam', life: 100, draw: (f, E) => {
				const x0 = ox(), y0 = oy(), x1 = x0 + Math.cos(a.d.ang) * L, y1 = y0 + Math.sin(a.d.ang) * L;
				if(f.t < 48) E.warnLine(x0, y0, x1, y1, 30, f.t / 48, 'magma'); else if(f.t < 88) E.beam(x0, y0, x1, y1, 16, 'magma', { speed: 12 });
			} });
			if(a.t >= 48 && a.t < 88 && a.t % 5 === 0){
				const x0 = ox(), y0 = oy();
				// distance from the player to the beam line
				const dx = Math.cos(a.d.ang), dy = Math.sin(a.d.ang), px = pcx() - x0, py = pcy() - y0, along = px * dx + py * dy;
				if(along > 0 && along < L && Math.abs(px * dy - py * dx) < 30) hurt(12, ['burn']);
			}
			return a.t >= 96;
		} },
		// ---- Tyrant
		{ name: 'meltdown', tier: 3, phase: 2, row: ROWS.cast, dur: 200, every: 1500, want: () => 6, rec: 60, run: (en, S, a) => {
			walk(en, S, 0);
			if(a.t === 1){ banner(en, 'MELTDOWN — jump the lava, dodge the meteors'); S.armor = 0.5; }
			for(let k = 0; k < 3; k++) if(a.t === 30 + k * 50){
				const A = local(S, 780), fy = floorAt(pcx(), player.y);
				wave(S, A.l, fy, 1, 6.5, 60, A.r - A.l, 26, ['burn'], 'magma');
				wave(S, A.r, fy, -1, 6.5, 60, A.r - A.l, 26, ['burn'], 'magma');
			}
			if(a.t > 20 && a.t < 180 && a.t % 18 === 0){ const x = clamp(pcx() + (rnd() - 0.5) * 360, S.arena.l + 40, S.arena.r - 40); meteor(S, x, floorAt(x, player.y), 80, 48, 30, ['burn'], 'magma'); }
			if(a.t === 200) S.armor = 0;
			return a.t >= 200;
		} },
	];
	function wardenPhase(en, S){
		if(S.tier >= 3 && S.phase === 1 && en.hp < en.maxHp * 0.55){
			S.phase = 2; en.bossPhase = 2; S.used.meltdown = -99999;
			banner(en, 'UNSHELLED — the Warden sheds its plates');
			if(EFXok()){ EFX.burst(ecx(en), ecy(en), 'magma', 3); for(let i = 0; i < 8; i++) EFX.debris('magma', ecx(en), ecy(en), 4, { speed: 9, floor: en.y + en.h }); }
			shake(16, 26);
		}
		// Tyrant phase 2: a scorching aura you can see (and step out of)
		if(S.phase >= 2 && S.age % 20 === 0 && playerInCirc(ecx(en), ecy(en), 120)) hurt(7, ['burn']);
	}

	/* ================================================================== STORM RAPTOR (flier) */
	const RAPTOR = [
		{ name: 'thunderDive', row: ROWS.attackB, dur: 56, want: () => 2.6, rec: 40, run: (en, S, a) => {
			const dives = S.tier >= 1 ? 2 : 1;
			if(a.t === 1 || a.d.again === a.t){
				a.d.k = (a.d.k || 0) + 1; a.d.start = a.t;
				a.d.tele = teleCircle(S, pcx(), playerFloor(), 110, 46, 'lightning', () => a.t < a.d.start + 26 ? [pcx(), playerFloor()] : null);
				setAnim(S, ROWS.attackB, 56, false);
			}
			const s = a.d.start;
			if(a.t < s + 26){ face(en); flyTo(en, S, ecx(en) - en.facing * 30, Math.min(ecy(en), pcy() - 260), 3, 0.05); }
			if(a.t === s + 26){ a.d.tx = a.d.tele.x; a.d.ty = a.d.tele.y; a.d.x0 = ecx(en); a.d.y0 = ecy(en); teleLine(S, a.d.x0, a.d.y0, a.d.tx, a.d.ty - 30, 40, 20, 'lightning'); }
			if(a.t > s + 46 && a.t <= s + 58){
				const u = (a.t - (s + 46)) / 12;
				en.x = lerp(a.d.x0, a.d.tx, u) - en.w / 2; en.y = lerp(a.d.y0, a.d.ty - en.h * 0.6, u * u) - en.h / 2;
				if(EFXok()) EFX.emit('lightning', ecx(en), ecy(en), 3, { speed: 2 });
				if(!a.d.hit && playerIn(en.x, en.y, en.w, en.h)) a.d.hit = hurt(30, ['stun'], 6, -6);
			}
			if(a.t === s + 58){
				const fy = a.d.ty;
				if(playerInCirc(a.d.tx, fy - 20, 120)) hurt(34, ['stun'], 8, -7);
				if(EFXok()){ EFX.burst(a.d.tx, fy - 14, 'lightning', 2); EFX.groundWave(a.d.tx, fy, 140, 'lightning'); for(let i = 0; i < 4; i++) EFX.lightning(a.d.tx, fy - 10, a.d.tx + (rnd() - 0.5) * 300, fy - 120 - rnd() * 140, 'lightning', { width: 3 }); }
				shake(9, 14);
				if(S.tier >= 2) for(let i = 0; i < 2; i++) wave(S, a.d.tx, fy, i ? 1 : -1, 8, 40, 340, 18, ['stun'], 'lightning');
				if(a.d.k < dives) a.d.again = a.t + 22;
				else a.d.end = a.t + 30;
			}
			if(a.t > s + 58) flyTo(en, S, ecx(en), pcy() - 240, 4, 0.06);    // climbs back — slow, a window to punish
			return a.t >= (a.d.end || 999);
		} },
		{ name: 'talonRake', row: ROWS.attackA, dur: 44, want: (d, hd) => hd < 600 ? 2 : 0.5, rec: 36, run: (en, S, a) => {
			if(a.t === 1){
				const side = pcx() > (S.arena.l + S.arena.r) / 2 ? -1 : 1;
				a.d.y = pcy(); a.d.from = clamp(pcx() + side * 380, S.arena.l + 40, S.arena.r - 40); a.d.to = clamp(pcx() - side * 380, S.arena.l + 40, S.arena.r - 40); a.d.dir = -side;
				teleRect(S, Math.min(a.d.from, a.d.to), a.d.y - 45, Math.abs(a.d.to - a.d.from), 90, 40, 'lightning');
			}
			if(a.t < 30) flyTo(en, S, a.d.from, a.d.y - 10, 12, 0.18);
			if(a.t === 30) en.facing = a.d.dir;
			if(a.t > 40 && a.t < 80){
				en.x += a.d.dir * 18 * S.T.spd; en.y = a.d.y - en.h / 2; en.baseY = en.y;
				if(!a.d.hit && playerIn(en.x, en.y, en.w, en.h)) a.d.hit = hurt(32, ['stun'], a.d.dir * 9, -5);
				if(EFXok() && a.t % 2 === 0) EFX.emit('lightning', ecx(en) - a.d.dir * 30, ecy(en), 2, { speed: 1 });
				if((a.d.dir > 0 && ecx(en) > a.d.to) || (a.d.dir < 0 && ecx(en) < a.d.to)) a.t = Math.max(a.t, 80);
				en.x = clamp(en.x, S.arena.l, S.arena.r - en.w);
			}
			if(a.t >= 80) flyTo(en, S, ecx(en), pcy() - 240, 5, 0.06);
			return a.t >= 96;
		} },
		{ name: 'featherVolley', row: ROWS.special, dur: 40, want: (d) => d > 220 ? 2 : 0.8, rec: 34, run: (en, S, a) => {
			hover(en, S);
			const volleys = S.tier >= 3 ? 3 : S.tier >= 2 ? 2 : 1, n = S.tier >= 1 ? 7 : 5;
			for(let v = 0; v < volleys; v++) if(a.t === 24 + v * 26){
				face(en);
				const x0 = ecx(en), y0 = ecy(en), base = Math.atan2(pcy() - y0, pcx() - x0);
				for(let i = 0; i < n; i++){
					const ang = base + (i - (n - 1) / 2) * 0.13;
					const p = typeof spawnEnemyProj === 'function' ? spawnEnemyProj(x0, y0, Math.cos(ang) * 8.5, Math.sin(ang) * 8.5, { color: '#7fe0ff', color2: '#ffffff', power: 16, width: 22, height: 10, shape: 'blade', maxAge: 160, effects: ['stun'], noWallCollide: true, _noSplit: true, homing: S.tier >= 3, homingStrength: 0.012 }) : null;
					if(p) p._efxEl = 'lightning';
				}
				if(EFXok()) EFX.burst(x0, y0, 'lightning', 1);
			}
			if(a.t === 1 && EFXok()) EFX.charge(ecx(en), ecy(en), 'lightning', 80, 10, 22);
			return a.t >= 24 + (volleys - 1) * 26 + 16;
		} },
		{ name: 'staticOrbs', row: ROWS.cast, dur: 50, every: 300, want: () => 1.2, rec: 26, run: (en, S, a) => {
			hover(en, S);
			if(a.t === 24){
				const n = S.tier >= 2 ? 3 : 2;
				for(let i = 0; i < n; i++){
					const ox = ecx(en) + (i - (n - 1) / 2) * 60, oy = ecy(en) + 30;
					fx(S, { k: 'orb', x: ox, y: oy, life: 240, zap: 0, cool: 40 + i * 20,
						tick: (f) => {
							const dx = pcx() - f.x, dy = pcy() - f.y, d = Math.hypot(dx, dy) || 1;
							f.x += dx / d * 1.3; f.y += dy / d * 1.3;
							if(f.zap > 0){ if(--f.zap === 0){ if(Math.hypot(pcx() - f.x, pcy() - f.y) < 150) hurt(18, ['stun']); f.flash = 8; f.cool = 60; } }
							else if(--f.cool <= 0 && d < 150){ f.zap = 20; }
							if(f.flash > 0) f.flash--;
							return f.t > f.life;
						},
						draw: (f, E) => {
							E.glow(f.x, f.y, 26, E.pal('lightning').outer, 0.6); E.glow(f.x, f.y, 11, '#ffffff', 0.9);
							if(f.zap > 0) E.warnCircle(f.x, f.y, 150, 1 - f.zap / 20, 'lightning', { flat: 1 });
							if(f.flash > 0) E.lightning(f.x, f.y, pcx(), pcy(), 'lightning', { width: 3 });
						} });
				}
			}
			return a.t >= 44;
		} },
		{ name: 'galeBlast', row: ROWS.special, dur: 48, want: (d) => d < 340 ? 1.6 : 0, rec: 20, run: (en, S, a) => {
			hover(en, S);
			if(a.t === 1){ face(en); teleRect(S, en.facing > 0 ? ecx(en) : ecx(en) - 420, ecy(en) - 140, 420, 280, 22, 'wind'); }
			if(a.t > 22 && a.t < 46){
				const x = en.facing > 0 ? ecx(en) : ecx(en) - 420;
				if(playerIn(x, ecy(en) - 140, 420, 280)){ if(typeof magicLaunchPlayer === 'function' && a.t % 6 === 0) magicLaunchPlayer(en.facing * 9, -3); if(a.t === 24) hurt(10, []); }
				if(EFXok() && a.t % 3 === 0) EFX.emit('wind', ecx(en) + en.facing * 40, ecy(en) + (rnd() - 0.5) * 100, 3, { speed: 7, dir: en.facing > 0 ? 0 : Math.PI, spread: 0.2 });
			}
			return a.t >= 48;
		} },
		// ---- Elder
		{ name: 'stormCell', tier: 2, row: ROWS.cast, dur: 56, every: 480, want: () => 1.6, rec: 30, run: (en, S, a) => {
			hover(en, S);
			if(a.t === 20){
				const n = S.tier >= 3 ? 4 : 3;
				for(let i = 0; i < n; i++){
					fx(S, { k: 'cloud', x: pcx() + (i - (n - 1) / 2) * 200, y: Math.max(S.arena.top + 40, pcy() - 520), life: 200, strikes: 0, off: i * 22,
						tick: (f) => {
							f.x += clamp(pcx() + 0 - f.x, -1.2, 1.2) * 0.6;
							const ph = (f.t - f.off) % 60;
							if(f.t > f.off && ph === 1){ f.tx = f.x; f.fy = floorAt(f.tx, player.y); }
							if(f.t > f.off && ph === 40 && f.tx != null){
								if(playerIn(f.tx - 30, f.y, 60, f.fy - f.y)) hurt(30, ['stun']);
								f.bolt = 10; f.strikes++;
								if(EFXok()) EFX.burst(f.tx, f.fy - 10, 'lightning', 1.2);
							}
							if(f.bolt > 0) f.bolt--;
							return f.t > f.life || f.strikes >= 3;
						},
						draw: (f, E) => {
							for(let k = 0; k < 4; k++) E.glow(f.x - 50 + k * 34, f.y + Math.sin(f.t * 0.05 + k) * 6, 46, '#3a4256', 0.5);
							E.glow(f.x, f.y + 10, 70, E.pal('lightning').outer, 0.2);
							const ph = (f.t - f.off) % 60;
							if(f.t > f.off && ph > 1 && ph < 40 && f.tx != null) E.warnRect(f.tx - 30, f.y, 60, f.fy - f.y, ph / 40, 'lightning');
							if(f.bolt > 0) E.lightning(f.tx, f.y, f.tx, f.fy, 'lightning', { width: 6 });
						} });
				}
			}
			return a.t >= 50;
		} },
		{ name: 'chainLightning', tier: 2, row: ROWS.cast, dur: 60, every: 600, want: () => 1.3, rec: 34, run: (en, S, a) => {
			hover(en, S);
			if(a.t === 16){
				const fy = playerFloor(), xs = [pcx() - 260, pcx() + 30, pcx() + 300].map(x => clamp(x, S.arena.l + 30, S.arena.r - 30));
				fx(S, { k: 'rods', xs, fy, life: 150,
					tick: (f) => {
						if(f.t > 50 && f.t < 130 && f.t % 6 === 0){
							for(let i = 0; i < f.xs.length - 1; i++){
								const x0 = f.xs[i], x1 = f.xs[i + 1], y = f.fy - 40;
								if(pcx() > Math.min(x0, x1) && pcx() < Math.max(x0, x1) && Math.abs(pcy() - y) < 42) hurt(12, ['stun']);
							}
						}
						return f.t > f.life;
					},
					draw: (f, E) => {
						for(const x of f.xs){ E.spike(x, f.fy, 70, 12, 'metal', {}); E.glow(x, f.fy - 70, 14, E.pal('lightning').mid, 0.8); }
						for(let i = 0; i < f.xs.length - 1; i++){
							if(f.t < 50) E.warnLine(f.xs[i], f.fy - 40, f.xs[i + 1], f.fy - 40, 40, f.t / 50, 'lightning');
							else if(f.t < 130) E.lightning(f.xs[i], f.fy - 70, f.xs[i + 1], f.fy - 70 + 30 * Math.sin(f.t * 0.3), 'lightning', { width: 4, seed: f.t * 7 + i });
						}
					} });
			}
			return a.t >= 50;
		} },
		// ---- Tyrant
		{ name: 'eyeOfTheStorm', tier: 3, phase: 2, row: ROWS.special, dur: 40, every: 1500, want: () => 6, rec: 60, run: (en, S, a) => {
			if(a.t === 1) a.d.A = local(S, 900);
			const A = a.d.A || local(S, 900), mid = (A.l + A.r) / 2;
			flyTo(en, S, mid, Math.max(S.arena.top + 60, pcy() - 330), 6, 0.08);
			if(a.t === 1){ banner(en, 'EYE OF THE STORM — find the gaps'); S.armor = 0.5; }
			const lanes = Math.max(4, Math.floor((A.r - A.l) / 170));
			for(let k = 0; k < 5; k++) if(a.t === 30 + k * 50){
				const odd = k % 2, fy = playerFloor();
				for(let i = 0; i < lanes; i++){
					if((i % 2) !== odd) continue;
					const x = A.l + (i + 0.5) * (A.r - A.l) / lanes;
					const top = Math.max(S.arena.top, fy - 700);
					strikeRect(S, x - 60, top, 120, fy - top, 38, 26, ['stun'], 'lightning', (f) => { if(EFXok()){ EFX.burst(f.x + 60, fy - 10, 'lightning', 1.1); } }, 0, 0);
					fx(S, { k: 'boltfx', x, top, fy, at: 38, life: 50, draw: (f, E) => { if(f.t >= f.at && f.t < f.at + 10) E.lightning(f.x, f.top, f.x, f.fy, 'lightning', { width: 7 }); } });
				}
			}
			if(a.t === 280) S.armor = 0;
			return a.t >= 280;
		} },
	];
	function hover(en, S){
		// keep a menacing height above the player, drifting side to side
		S.hover += 0.02;
		const side = Math.sin(S.hover) * 160;
		flyTo(en, S, pcx() + side - en.facing * 120, pcy() - 230 + Math.sin(S.hover * 2.3) * 30, 5.5 * S.T.spd, 0.05);
		face(en);
	}
	function raptorPhase(en, S){
		if(S.tier >= 3 && S.phase === 1 && en.hp < en.maxHp * 0.55){
			S.phase = 2; en.bossPhase = 2; S.used.eyeOfTheStorm = -99999;
			banner(en, 'THE STORM SPLITS — afterimages join the hunt');
			shake(14, 22);
		}
		// Tyrant phase 2: storm afterimages copy its dives (each one marked first)
		if(S.phase >= 2 && S.age % 300 === 150){
			const x = clamp(pcx() + (rnd() < 0.5 ? -1 : 1) * 160, S.arena.l + 40, S.arena.r - 40), fy = playerFloor();
			strikeCircle(S, x, fy - 10, 100, 54, 26, ['stun'], 'lightning', (f) => { if(EFXok()){ EFX.burst(f.x, fy - 10, 'lightning', 1.6); EFX.lightning(f.x, S.arena.top, f.x, fy, 'lightning', { width: 6 }); } shake(5, 8); });
			fx(S, { k: 'after', x: ecx(en), y: ecy(en), tx: x, ty: fy - 40, life: 54, draw: (f, E) => { const u = Math.max(0, (f.t - 30) / 24); E.ghost(lerp(f.x, f.tx, u), lerp(f.y, f.ty, u * u), 90, 70, 'lightning', 0.8); } });
		}
	}

	/* ================================================================== ELDER TREANT */
	const TREANT = [
		{ name: 'ancientSmash', row: ROWS.attackA, dur: 52, want: (d) => d < 240 ? 4 : 0, rec: 34, run: (en, S, a) => {
			walk(en, S, 0);
			if(a.t === 1){ face(en); const dir = en.facing, x = dir > 0 ? en.x + en.w * 0.4 : en.x + en.w * 0.6 - 240; a.d.x = x; strikeRect(S, x, en.y - 30, 240, en.h + 30, 30, 40, ['stun'], 'earth', () => { const fy = en.y + en.h, sx = ecx(en) + dir * 140; if(EFXok()){ EFX.burst(sx, fy - 10, 'earth', 1.8); EFX.debris('earth', sx, fy - 6, 10, { speed: 7, floor: fy }); } quakeWaves(S, sx, fy, 20, 240 + S.tier * 80, 6, 40, 'nature'); }, 8, -6); }
			return a.t >= 48;
		} },
		{ name: 'rootUpheaval', row: ROWS.attackB, dur: 60, want: () => 2.4, rec: 40, run: (en, S, a) => {
			walk(en, S, 0);
			const n = 4 + S.tier;
			for(let i = 0; i < n; i++) if(a.t === 30 + i * 16){
				const x = clamp(pcx() + (player.vx || 0) * 10, S.arena.l + 30, S.arena.r - 30), fy = floorAt(x, player.y);
				pillar(S, x, fy, 58, 120 + S.tier * 16, 36, 30, ['stun'], 'nature', 30);
			}
			return a.t >= 30 + n * 16 + 30;
		} },
		{ name: 'barkBarrage', row: ROWS.cast, dur: 40, want: (d, hd) => hd > 200 ? 2 : 0.4, rec: 30, run: (en, S, a) => {
			walk(en, S, 0);
			const n = 3 + S.tier;
			if(a.t === 22){
				face(en);
				for(let i = 0; i < n; i++){
					const tx = pcx() + (i - (n - 1) / 2) * 90, dx = tx - ecx(en), t = 50;
					const vx = dx / t, vy = -9 - rnd() * 2;
					const p = typeof spawnEnemyProj === 'function' ? spawnEnemyProj(ecx(en), en.y + 20, vx, vy, { color: '#7a5a34', color2: '#c8a070', power: 18, width: 22, height: 14, shape: 'spike', gravity: 0.36, maxAge: 140, noWallCollide: false, _noSplit: true }) : null;
					if(p) p._efxEl = 'earth';
				}
				if(EFXok()) EFX.burst(ecx(en), en.y + 20, 'earth', 1);
			}
			return a.t >= 40;
		} },
		{ name: 'stompCharge', row: ROWS.special, dur: 40, want: (d, hd) => hd > 260 ? 1.8 : 0.3, rec: 44, run: (en, S, a) => {
			if(a.t === 1){ face(en); a.d.dir = en.facing; a.d.x1 = clamp(ecx(en) + a.d.dir * 560, S.arena.l + en.w, S.arena.r - en.w); teleLine(S, ecx(en), en.y + en.h - 30, a.d.x1, en.y + en.h - 30, en.h * 0.8, 34, 'nature'); setAnim(S, ROWS.special, 40, true); }
			if(a.t > 34 && !a.d.done){
				walk(en, S, a.d.dir * 9 * S.T.spd);
				if(!a.d.hit && playerIn(en.x - 10, en.y, en.w + 20, en.h)) a.d.hit = hurt(36, ['stun'], a.d.dir * 10, -7);
				if(a.t % 14 === 0){ const fy = en.y + en.h; if(EFXok()) EFX.groundWave(ecx(en), fy, 90, 'earth'); shake(3, 5); if(S.tier >= 2) wave(S, ecx(en), fy, -a.d.dir, 5, 32, 220, 14, ['stun'], 'nature'); }
				if((a.d.dir > 0 && ecx(en) >= a.d.x1) || (a.d.dir < 0 && ecx(en) <= a.d.x1) || a.t > 140) a.d.done = a.t;
			} else walk(en, S, 0);
			return a.d.done && a.t > a.d.done + 16;
		} },
		{ name: 'entanglingRoots', row: ROWS.attackB, dur: 60, every: 420, want: () => 1.2, rec: 30, run: (en, S, a) => {
			walk(en, S, 0);
			if(a.t === 16){
				const x = pcx(), fy = playerFloor(), r = 130;
				fx(S, { k: 'cage', x, fy, r, close: 50, life: 110, caught: false,
					tick: (f) => {
						if(f.t === f.close){
							const inside = Math.abs(pcx() - f.x) < f.r && Math.abs(player.y + player.h - f.fy) < 80;
							if(inside){ hurt(20, ['stun']); player.stunTimer = Math.max(player.stunTimer || 0, 40); f.caught = true; say(pcx(), player.y - 30, 'ROOTED', '#9dff6a'); }
							if(EFXok()) EFX.burst(f.x, f.fy - 20, 'nature', 1.4);
						}
						return f.t > f.life;
					},
					draw: (f, E) => {
						if(f.t < f.close) E.warnCircle(f.x, f.fy - 6, f.r, f.t / f.close, 'nature', { flat: 0.35 });
						const u = f.t < f.close ? f.t / f.close : 1, fade = Math.min(1, (f.life - f.t) / 20);
						for(let i = 0; i < 9; i++){ const xx = f.x - f.r + i * (f.r * 2 / 8); E.spike(xx, f.fy, (40 + 70 * u) * (i === 0 || i === 8 ? 1.3 : u), 16, 'nature', { alpha: fade, lean: (i - 4) * -0.06 * u }); }
					} });
			}
			return a.t >= 50;
		} },
		// ---- Elder
		{ name: 'sporeBloom', tier: 2, row: ROWS.cast, dur: 56, every: 480, want: () => 1.4, rec: 28, run: (en, S, a) => {
			walk(en, S, 0);
			if(a.t === 24){
				const n = S.tier >= 3 ? 5 : 4;
				for(let i = 0; i < n; i++){
					const x = clamp(pcx() + (i - (n - 1) / 2) * 170 + (rnd() - 0.5) * 50, S.arena.l + 40, S.arena.r - 40), fy = floorAt(x, player.y);
					fx(S, { k: 'shroom', x, fy, at: 60, life: 60, tick: (f) => { if(f.t === f.at){ zone(S, f.x - 70, f.fy - 90, 140, 90, 140, 7, 20, ['poison'], 'poison'); if(EFXok()) EFX.burst(f.x, f.fy - 30, 'spore', 1.4); } return f.t >= f.at; },
						draw: (f, E) => { const u = f.t / f.at; E.warnRect(f.x - 70, f.fy - 90, 140, 90, u, 'poison'); E.glow(f.x, f.fy - 14, 12 + 10 * u, E.pal('spore').mid, 0.8); } });
				}
			}
			return a.t >= 56;
		} },
		{ name: 'saplings', tier: 2, row: ROWS.cast, dur: 60, every: 900, want: (d, hd, en, S) => aliveMinions(S) < 2 ? 1.5 : 0, rec: 20, run: (en, S, a) => {
			walk(en, S, 0);
			if(a.t === 30){ for(const s of [-1, 1]) summon(en, S, 'vineCrawler', ecx(en) + s * 160); }
			return a.t >= 56;
		} },
		// ---- Tyrant
		{ name: 'worldTree', tier: 3, phase: 2, row: ROWS.cast, dur: 220, every: 1500, want: () => 6, rec: 60, run: (en, S, a) => {
			walk(en, S, 0);
			if(a.t === 1){ banner(en, 'THE WORLD TREE — jump the thorns'); S.armor = 0.5; }
			for(let k = 0; k < 4; k++) if(a.t === 30 + k * 44){ quakeWaves(S, ecx(en), en.y + en.h, 24, 1200, 6.5, 56, 'nature'); }
			if(a.t > 20 && a.t < 200 && a.t % 30 === 0){ const x = clamp(pcx() + (player.vx || 0) * 14, S.arena.l + 30, S.arena.r - 30); pillar(S, x, floorAt(x, player.y), 56, 150, 38, 28, ['stun'], 'nature', 30); }
			if(a.t % 30 === 0 && aliveMinions(S)) en.hp = Math.min(en.maxHp, en.hp + en.maxHp * 0.004);
			if(a.t === 220) S.armor = 0;
			return a.t >= 220;
		} },
	];
	function treantPhase(en, S){
		if(S.tier >= 3 && S.phase === 1 && en.hp < en.maxHp * 0.55){
			S.phase = 2; en.bossPhase = 2; S.used.worldTree = -99999;
			banner(en, 'BLIGHT — the canopy burns');
			shake(14, 24);
		}
		// Tyrant phase 2: burning leaves keep falling (each one marked)
		if(S.phase >= 2 && S.age % 40 === 0){
			const x = clamp(pcx() + (rnd() - 0.5) * 500, S.arena.l + 30, S.arena.r - 30);
			meteor(S, x, floorAt(x, player.y), 56, 44, 16, ['burn'], 'fire');
		}
	}

	const MOVES = { knight: KNIGHT, warden: WARDEN, raptor: RAPTOR, treant: TREANT };
	const PHASES = { knight: knightPhase, warden: wardenPhase, raptor: raptorPhase, treant: treantPhase };
	// preferred distance and walk speed between attacks
	const STYLE = {
		knight: { range: 170, spd: 1.8, back: 0.25 },
		warden: { range: 150, spd: 1.5, back: 0 },
		raptor: { range: 0, spd: 5.5, back: 0 },
		treant: { range: 200, spd: 1.1, back: 0 },
	};

	/* ================================================================== the update hook */
	function dormant(en){
		if(en.isDormant || en._wardenDormant || en._jungleDormant || en._jungleHidden) return true;
		if((en.necroType || en.type) === 'frostboundKnight' && typeof frostboundKnightDormant === 'function' && frostboundKnightDormant(en)) return true;
		if((en.type === 'elderTreant') && typeof caveBossState !== 'undefined' && caveBossState && caveBossState.bossEnemy === en && caveBossState.phase === 'cutscene') return true;
		return false;
	}
	function update(en){
		if(!owns(en) || en.dead) return false;
		if(typeof COOP_GUEST !== 'undefined' && COOP_GUEST) return false;
		if(dormant(en)) return false;
		const S = en._mb || init(en);
		S.age++;
		S.anim.t++;
		// engagement: idle until you come close, give up if you run far away (never inside an arena that holds you)
		const detect = Math.max(720, (en.typeDef && en.typeDef.detectRange) || 900);
		const held = !!((typeof IS_SURVIVAL !== 'undefined' && IS_SURVIVAL) || (typeof IS_SANDBOX !== 'undefined' && IS_SANDBOX) || en.roomId != null);
		if(!S.engaged){
			if(held || dist(en) < detect) engage(en, S);
			else {
				if(META[S.boss].flier){ en.vx = (en.vx || 0) * 0.9; en.vy = 0; } else walk(en, S, 0);
				setAnim(S, ROWS.idle, 60, true);
				return true;
			}
		} else if(!held && dist(en) > detect * 1.9){ disengage(en, S); return true; }
		if(S.banner && --S.banner.t <= 0) S.banner = null;
		// living-wilds arena events keep running beside the new moveset
		if(typeof updateJungleMiniBoss === 'function' && (en.type === 'elderTreant' || en.type === 'stormRaptor')){ try { const keep = en._mb; updateJungleMiniBoss(en); en._mb = keep; } catch(e){} }
		// damage reduction: guard / ultimate armor / frost shell
		const red = Math.max(S.guard > 0 ? 0.8 : 0, S.armor || 0, S.shell || 0);
		if(en.hp < S.lastHp && red > 0) en.hp = S.lastHp - (S.lastHp - en.hp) * (1 - red);
		if(en.hp < S.lastHp - 1) S.hitFlash = 6;
		S.lastHp = en.hp;
		if(S.guard > 0) S.guard--;
		if(S.hitFlash > 0) S.hitFlash--;
		tickFx(en, S);
		PHASES[S.boss](en, S);
		const fly = META[S.boss].flier;
		if(S.intro > 0){
			S.intro--;
			if(fly) hover(en, S); else walk(en, S, 0);
			return true;
		}
		if(S.atk){
			const a = S.atk; a.t++;
			let done = false;
			try { done = a.def.run(en, S, a); } catch(e){ console.warn('[minibosses]', S.boss, a.name, e); done = true; }
			if(done) finish(en, S, a.def.rec);
			return true;
		}
		// between attacks: recover (punish window), then reposition, then pick
		if(S.rec > 0){
			S.rec--;
			if(fly) hover(en, S); else walk(en, S, (en.vx || 0) * 0.85);
			setAnim(S, fly ? ROWS.idle : ROWS.idle, fly ? 30 : 60, true);
			return true;
		}
		const st = STYLE[S.boss];
		if(fly){ hover(en, S); setAnim(S, ROWS.idle, 30, true); }
		else {
			const d = pcx() - ecx(en), ad = Math.abs(d);
			face(en);
			let vx = 0;
			if(ad > st.range + 40) vx = Math.sign(d) * st.spd * S.T.spd * (S.phase > 1 ? 1.4 : 1);
			else if(ad < st.range * 0.5 && st.back) vx = -Math.sign(d) * st.spd * st.back;
			walk(en, S, vx);
			setAnim(S, Math.abs(vx) > 0.3 ? ROWS.move : ROWS.idle, Math.abs(vx) > 0.3 ? 48 : 60, true);
		}
		if(--S.cd <= 0){
			const m = pick(en, S, MOVES[S.boss]);
			if(m) start(en, S, m); else S.cd = 20;
		}
		return true;
	}

	/* ================================================================== drawing the boss */
	function frameOf(en, S){
		const A = S.anim;
		if(en.dead) return [ROWS.death, Math.min(7, Math.floor((en.deathTimer || 0) / 9))];
		if(S.hitFlash > 3 && !S.atk) return [ROWS.hurt, 7 - S.hitFlash];
		const k = A.t / A.dur;
		return [A.row, A.loop ? Math.floor(k * 8) % 8 : Math.min(7, Math.floor(k * 8))];
	}
	function draw(en){
		if(!owns(en)) return false;
		if(en._jungleHidden || en._jungleDormant) return true;
		let S = en._mb;
		const boss = TYPES[en.necroType || en.type], tier = S ? S.tier : tierOf(en);
		const img = sheet(boss, tier);
		if(!img.complete || !img.naturalWidth) return false;      // the old drawing covers the moment while the sheet loads
		if(!S){
			// dormant / not yet fought: idle row, no state needed
			S = { anim: { row: ROWS.idle, dur: 70, t: (en._mbIdleT = (en._mbIdleT || 0) + 1), loop: true }, tier, boss, hitFlash: 0, atk: null };
		}
		const M = META[boss], [row, col] = frameOf(en, S);
		const s = en.h / M.bodyH;
		const camx = typeof camera !== 'undefined' ? camera.x : 0, camy = typeof camera !== 'undefined' ? camera.y : 0;
		const cx = ecx(en) - camx, feet = en.y + en.h - camy, cy = ecy(en) - camy;
		const dw = FRAME * s, dh = FRAME * s;
		const dy = M.flier ? cy - dh / 2 : feet - M.footY * s;
		ctx.save();
		// tier aura under the boss
		if(tier && EFXok() && !en.dead){
			const P = EFX.pal(M.el);
			ctx.globalCompositeOperation = 'lighter';
			const g = ctx.createRadialGradient(cx, feet - en.h * 0.4, 4, cx, feet - en.h * 0.4, en.w * (0.9 + tier * 0.25));
			g.addColorStop(0, EFX.rgba(tier >= 3 ? '#ff4a5e' : P.mid, 0.16 + tier * 0.06)); g.addColorStop(1, EFX.rgba(P.outer, 0));
			ctx.fillStyle = g; ctx.fillRect(cx - en.w * 2, feet - en.h * 1.6, en.w * 4, en.h * 2);
			ctx.globalCompositeOperation = 'source-over';
		}
		if(en.flash > 0 || S.hitFlash > 4) ctx.filter = 'brightness(1.9) saturate(0.6)';
		if(en.dead) ctx.globalAlpha = Math.max(0, 1 - Math.max(0, (en.deathTimer || 0) - 70) / 60);
		if((en.facing || 1) === -1){ ctx.translate(cx, 0); ctx.scale(-1, 1); ctx.drawImage(img, col * FRAME, row * FRAME, FRAME, FRAME, -dw / 2, dy, dw, dh); }
		else ctx.drawImage(img, col * FRAME, row * FRAME, FRAME, FRAME, cx - dw / 2, dy, dw, dh);
		ctx.restore();
		// guard shimmer / armor
		if(EFXok() && S.guard > 0) EFX.warnCircle(ecx(en), ecy(en), en.w * 0.9, 1, 'ice', { flat: 1, alpha: 0.6 });
		if(EFXok() && (S.armor > 0 || S.shell > 0)) EFX.glow(ecx(en), ecy(en), en.w * 1.1, EFX.pal(M.el).core, 0.25);
		// name plate
		if(!en.dead){
			const title = (tier ? STARS[tier] + ' ' : '') + TITLES[boss][tier];
			ctx.save(); ctx.font = 'bold 13px Arial'; ctx.textAlign = 'center';
			const ty = (M.flier ? cy - dh * 0.36 : feet - en.h - 22);
			ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.strokeText(title, cx, ty);
			ctx.fillStyle = TIER_COLOR[tier]; ctx.fillText(title, cx, ty);
			if(en._mb && en._mb.phase > 1){ ctx.font = 'bold 10px Arial'; ctx.fillStyle = '#ff8a8a'; ctx.strokeText('PHASE II', cx, ty - 14); ctx.fillText('PHASE II', cx, ty - 14); }
			ctx.restore();
		}
		return true;
	}
	function drawWorld(){
		if(typeof enemies === 'undefined') return;
		for(const en of enemies){
			if(!en || !en._mb) continue;
			if(en.dead){ if(en._mb.fx.length) en._mb.fx.length = 0; en._mb.banner = null; continue; }
			try { drawFx(en, en._mb); } catch(e){}
			const B = en._mb.banner;
			if(B && typeof ctx !== 'undefined' && typeof canvas !== 'undefined'){
				const a = Math.min(1, B.t / 20, (120 - B.t) / 12);
				ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = Math.max(0, a);
				ctx.font = 'bold 26px Georgia, serif'; ctx.textAlign = 'center';
				ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.strokeText(B.text, canvas.width / 2, canvas.height * 0.2);
				ctx.fillStyle = TIER_COLOR[en._mb.tier] === '#e8e8e8' ? '#ffe2a6' : TIER_COLOR[en._mb.tier]; ctx.fillText(B.text, canvas.width / 2, canvas.height * 0.2);
				ctx.restore();
			}
		}
	}

	/* ================================================================== tiers */
	// called by EliteVariants.apply for mini-bosses. opts.hp overrides the HP multiplier (Survival scales from its boss curve).
	function applyTier(en, tier, opts){
		opts = opts || {};
		tier = clamp(tier | 0, 0, 3);
		if(!owns(en) || (en._elite && en._elite.mb)) return en;
		const T = TIER[tier];
		if(!opts.visualOnly){
			const cx = ecx(en), feet = en.y + en.h, mid = ecy(en), fl = !!(en.typeDef && en.typeDef.flies);
			en.w = Math.round(en.w * T.size); en.h = Math.round(en.h * T.size);
			en.x = cx - en.w / 2; en.y = fl ? mid - en.h / 2 : feet - en.h; en.baseY = en.y;
			const hm = opts.hp != null ? opts.hp : T.hp;
			en.hp = en.maxHp = Math.round(en.maxHp * hm);
		}
		const boss = TYPES[en.necroType || en.type];
		en._elite = { mb: true, tier, title: ['', 'Alpha', 'Elder', 'Tyrant'][tier], stars: STARS[tier], dmg: T.dmg, atk: 1, spd: 1, gcd: 1, cd: 1, move: 1,
			split: false, echo: false, nova: false, enrage: false, color: TIER_COLOR[tier], el: META[boss].el, pendingSplit: [], waves: [], splitBudget: 0 };
		en._eliteName = TITLES[boss][tier];
		if(en._mb){ en._mb.tier = tier; en._mb.T = TIER[tier]; en._mb.key = TIER_KEYS[tier]; }
		sheet(boss, tier);
		return en;
	}

	// testing: make a mini-boss use a named attack now
	function debugAttack(en, name){
		if(!owns(en)) return false;
		const S = en._mb || init(en);
		if(!S.engaged) engage(en, S);
		S.intro = 0; S.rec = 0;
		const m = MOVES[S.boss].find(x => x.name === name);
		if(!m) return false;
		start(en, S, m); return true;
	}
	root.MiniBossKit = { owns, update, draw, drawWorld, applyTier, prefetch, debugAttack, TYPES, TITLES, TIER, sheet, _moves: MOVES };
})(window);
