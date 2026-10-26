/* =====================================================================
   SURVIVAL — endless co-op waves in the Starfall Sanctum
   ---------------------------------------------------------------------
   • Waves never end. Enemy health and incoming damage grow every wave
     (see BAL below — all the tuning knobs live in that one block).
   • Every 5th wave is a boss (a miniboss in the early game). Bosses repeat
     and are buffed by wave. Four hidden bosses are fixed points on the curve:
         wave 100  Infernal Kitten      wave 150  Seraphel
         wave 200  Zenith               wave 250  The Grand Challenger
   • Past wave 250 the scaling keeps climbing and the boss order starts over
     from wave 1 (the wave number keeps counting; position in the cycle wraps).
   • A checkpoint is saved after clearing wave 25, 50, 75 … A party wipe sends
     everybody back to the last checkpoint. A single fall only sidelines you
     until the next wave.
   • The host (slot 0) runs the director and every enemy; guests receive a
     small snapshot (`sv`) with each world update and replay enemies the way
     every other co-op mode already does.
   ===================================================================== */
(function(root){
	'use strict';
	if(typeof IS_SURVIVAL === 'undefined' || !IS_SURVIVAL) return;

	const B = (root.SurvivalArena && SurvivalArena.BOUNDS) || { left: 300, right: 4900, floor: 2000, ceil: 680, mid: 2600 };
	const PROGRESS_KEY = 'magicBattle_survivalProgress';

	/* ------------------------------------------------------------------
	   BALANCE — every number that shapes the difficulty curve
	   ------------------------------------------------------------------ */
	const BAL = {
		// ordinary enemies: health multiplier  1 + a·(w-1) + b·(w-1)²   (≈ x18 at 100, x43 at 250, no cap)
		// (c64: much softer — was 1 + 0.07·(w-1) + 0.0004·(w-1)², ×18 at 100 and ×43 at 250)
		enemyHp:  { base: 0.65, a: 0.025, b: 0.00008 },      // (still used for a boss's adds' display only)
		// c66: ordinary enemies are a lot weaker. Their dungeon health (340 … 7000) is squashed first, so a dungeon
		// heavyweight is no longer 20× an imp, then grown by wave:  hp = (squash(base) ) × (1 + a·(w-1) + b·(w-1)²)
		//   squash(base) = sq · √(base / 100):  imp-sized ≈ 110–190, golems ≈ 260–340, tomb guardians ≈ 450–500
		//   wave 1 ≈ 110–190 · wave 50 ≈ 500–2200 · wave 100 ≈ 1000–4500 · wave 250 ≈ 3000–14000 (a boss there has 236k)
		minion:   { sq: 60, a: 0.06, b: 0.0002 },
		// incoming damage multiplier           1 + a·(w-1) + b·(w-1)²   (≈ x2.8 at 100, x6.6 at 250, no cap)
		// (c64: softer — was 1 + 0.015·(w-1) + 0.00003·(w-1)²; now ×0.7 at 1, ×1.6 at 100, ×3.3 at 250)
		damage:   { base: 0.7, a: 0.008, b: 0.00001 },
		bossDamageScale: 0.85,           // bosses hit a little softer than the same wave's crowd
		// boss health target: T(w) = base + per·w, times a per-boss weight (the hidden bosses are the anchors)
		// boss health by wave (piecewise linear between these anchors; past the last one it keeps growing at the last slope)
		bossHpCurve: [[1, 700], [5, 1000], [50, 15000], [100, 50000], [150, 100000], [200, 170000], [250, 250000]],
		bossHpWeight: {
			elderTreant: 0.55, stormRaptor: 0.5, frostboundKnight: 0.62, magmaWarden: 0.72,
			fireDragon: 0.85, frostColossus: 0.9, earthColossus: 0.9, fireColossus: 1.0,
			ironColossus: 1.05, deepRootHorror: 1.05, voidArbiter: 0.95,
			infernalKitten: 0.98, seraphel: 0.93, zenith: 1.16, challenger: 1.2,
		},
		// boss buffs by wave: faster moves, quicker casts
		bossSpeedPerWave: 0.0015, bossSpeedMax: 1.35, bossCdPerWave: 0.003, bossCdMin: 0.6,
		// crowd size
		crowd: { base: 6, per: 0.35, cap: 60, aliveBase: 10, aliveEvery: 12, aliveCap: 22 },
		prepFrames: 300, prepBossFrames: 420, prepHiddenFrames: 660, wipeFrames: 300,
		checkpointEvery: 25, bossEvery: 5, cycle: 250,
	};
	const HIDDEN = { 100: 'infernalKitten', 150: 'seraphel', 200: 'zenith', 250: 'challenger' };

	const hpMult  = (w) => BAL.enemyHp.base + BAL.enemyHp.a * (w - 1) + BAL.enemyHp.b * (w - 1) * (w - 1);
	const minionMult = (w) => 1 + BAL.minion.a * (w - 1) + BAL.minion.b * (w - 1) * (w - 1);
	const minionHp = (base, w) => Math.round(BAL.minion.sq * Math.sqrt(Math.max(1, base) / 100) * minionMult(w));
	const dmgMult = (w) => BAL.damage.base + BAL.damage.a * (w - 1) + BAL.damage.b * (w - 1) * (w - 1);
	function bossCurve(w){
		const C = BAL.bossHpCurve;
		if(w <= C[0][0]) return C[0][1];
		for(let i = 1; i < C.length; i++) if(w <= C[i][0]){ const a = C[i - 1], b = C[i]; return a[1] + (b[1] - a[1]) * (w - a[0]) / (b[0] - a[0]); }
		const a = C[C.length - 2], b = C[C.length - 1];
		return b[1] + (b[1] - a[1]) * (w - b[0]) / (b[0] - a[0]);
	}
	/* the curve is the boss's whole health; the per-boss weight only nudges pool bosses (0.85–1), and a hidden boss gets exactly the curve */
	const bossHpFor = (type, w) => {
		const hidden = type === 'infernalKitten' || type === 'seraphel' || type === 'zenith' || type === 'challenger';
		const wt = hidden ? 1 : Math.max(0.85, Math.min(1, 0.85 + 0.15 * ((BAL.bossHpWeight[type] || 1) - 0.5) / 0.55));
		return Math.round(bossCurve(w) * wt);
	};

	/* boss order for the non-hidden boss waves, by position in the 250-wave cycle */
	const MINI_UNTIL = 50;      // boss waves up to here are minibosses
	const BOSS_ORDER = {
		5: 'elderTreant', 10: 'stormRaptor', 15: 'frostboundKnight', 20: 'magmaWarden', 25: 'fireDragon',
		30: 'magmaWarden', 35: 'frostColossus', 40: 'frostboundKnight', 45: 'earthColossus', 50: 'fireColossus',
		55: 'elderTreant', 60: 'ironColossus', 65: 'fireDragon', 70: 'deepRootHorror', 75: 'frostColossus',
		80: 'stormRaptor', 85: 'earthColossus', 90: 'ironColossus', 95: 'voidArbiter',
		105: 'fireColossus', 110: 'deepRootHorror', 115: 'fireDragon', 120: 'frostColossus', 125: 'ironColossus',
		130: 'earthColossus', 135: 'voidArbiter', 140: 'deepRootHorror', 145: 'fireColossus',
		155: 'fireDragon', 160: 'frostColossus', 165: 'ironColossus', 170: 'earthColossus', 175: 'deepRootHorror',
		180: 'fireColossus', 185: 'voidArbiter', 190: 'ironColossus', 195: 'voidArbiter',
		205: 'frostColossus', 210: 'earthColossus', 215: 'fireColossus', 220: 'deepRootHorror', 225: 'ironColossus',
		230: 'fireDragon', 235: 'voidArbiter', 240: 'deepRootHorror', 245: 'voidArbiter',
	};
	const cyc = (w) => ((w - 1) % BAL.cycle) + 1;
	function waveInfo(w){
		const c = cyc(w);
		if(c % BAL.bossEvery) return { kind: 'normal', c };
		if(HIDDEN[c]) return { kind: 'hidden', boss: HIDDEN[c], c };
		return { kind: c <= MINI_UNTIL ? 'mini' : 'boss', boss: BOSS_ORDER[c] || 'voidArbiter', c };
	}

	/* enemy pools (stationary types are left out: they cannot hunt) */
	const POOL = {
		t1g: ['flameSerpent', 'emberMage', 'iceArcher', 'cryoMage', 'vineCrawler', 'caveSpider', 'thornWolf', 'glowBeetle', 'crystalScarab'],
		t1f: ['imp', 'furnaceLeech', 'frostWraith', 'willowWisp', 'forgeDrone', 'stalactiteBat', 'windSylph', 'pollenMoth'],
		t2g: ['magmaGolem', 'cinderBeetle', 'ashRevenant', 'magmaHarvester', 'snowBeast', 'glacierSentinel', 'frostMantis', 'rockGolem', 'crystalMage', 'mudElemental', 'ironSentinel', 'slagBrute', 'barkbackBeetle', 'flameSalamander', 'magmaImp'],
		t2f: ['mossWraith', 'boneWraith'],
		t3g: ['darkVineCrawler', 'darkThornWolf', 'abyssalGuardian', 'coralSentinel', 'depthSerpent', 'sandWraith', 'mummyWarrior', 'desertSerpent', 'tombGuardian'],
		t3f: ['darkMossWraith', 'scarabSwarm', 'sandstormDjinn'],
	};
	const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
	function pickType(w){
		const w1 = Math.max(0.25, 1 - w / 150), w2 = clamp((w - 5) / 20, 0, 1.2), w3 = clamp((w - 20) / 30, 0, 1.5);
		const buckets = [];
		const add = (list, wt) => { if(wt > 0) for(const t of list) if(ENEMY_TYPES[t] && !(ST.banned && ST.banned[t])) buckets.push([t, wt / list.length]); };
		add(POOL.t1g, w1 * 0.62); add(POOL.t1f, w1 * 0.38);
		add(POOL.t2g, w2 * 0.7);  add(POOL.t2f, w2 * 0.3);
		add(POOL.t3g, w3 * 0.72); add(POOL.t3f, w3 * 0.28);
		let tot = 0; for(const b of buckets) tot += b[1];
		let r = Math.random() * tot;
		for(const b of buckets){ r -= b[1]; if(r <= 0) return b[0]; }
		return buckets.length ? buckets[0][0] : 'imp';
	}

	/* ------------------------------------------------------------------ state */
	function loadProgress(){ try { return Object.assign({ checkpoint: 1, best: 0 }, JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}')); } catch(e){ return { checkpoint: 1, best: 0 }; } }
	function saveProgress(){ try { localStorage.setItem(PROGRESS_KEY, JSON.stringify({ checkpoint: ST.checkpoint, best: ST.best })); } catch(e){} }
	const qs = new URLSearchParams(location.search);
	const PROG = loadProgress();
	const START_W = Math.max(1, parseInt(qs.get('sw'), 10) || 1);
	const ST = {
		wave: START_W, phase: 'prep', t: 0, prepLen: BAL.prepFrames,
		total: 0, spawned: 0, maxAlive: 8, spawnCd: 0, remaining: 0,
		checkpoint: Math.max(1, Math.floor((START_W - 1) / BAL.checkpointEvery) * BAL.checkpointEvery + 1), best: Math.max(PROG.best || 0, 0),
		down: false, bossEn: null, special: null, uid: 0,
		banner: null, bannerT: 0, lastPhase: '', lastWave: 0,
		bossName: '', bossHp: 0, bossMax: 0, wipeReason: '', banned: {},
	};
	const HOST = () => !COOP_GUEST;
	const info = () => waveInfo(ST.wave);

	/* ------------------------------------------------------------------ banners / messages */
	function banner(text, sub, color, frames){ ST.banner = { text, sub: sub || '', color: color || '#cbbcff' }; ST.bannerT = frames || 190; ST.bannerMax = ST.bannerT; }
	function say(type, data){ if(IS_COOP && COOP_HOST && CoopSync && CoopSync.queueEvent) CoopSync.queueEvent('surv', Object.assign({ k: type }, data || {})); }
	function announceWave(){
		const inf = waveInfo(ST.wave);
		if(inf.kind === 'normal') banner('WAVE ' + ST.wave, '', '#cbbcff', 170);
		else if(inf.kind === 'hidden') banner('WAVE ' + ST.wave, 'A presence from beyond the sanctum stirs…', '#ff6b8a', 280);
		else banner('WAVE ' + ST.wave, (inf.kind === 'mini' ? 'MINIBOSS — ' : 'BOSS — ') + ((ENEMY_TYPES[inf.boss] || {}).name || inf.boss), '#ffb36b', 230);
	}

	/* ------------------------------------------------------------------ spawning */
	function partyPositions(){
		const list = [{ x: player.x, y: player.y }];
		const al = root.__coopAllies; if(al) for(const id in al){ const a = al[id]; if(a && a.active) list.push({ x: a.x, y: a.y }); }
		return list;
	}
	function pickX(w){
		const P = partyPositions();
		for(let i = 0; i < 10; i++){
			const x = B.left + 80 + Math.random() * (B.right - B.left - 160 - w);
			if(P.every(p => Math.abs(p.x - x) > 650) || i === 9) return x;
		}
		return B.mid;
	}
	function fx(x, y, color, n){
		for(let i = 0; i < (n || 14); i++){ const a = Math.random() * 6.283, v = 1 + Math.random() * 4; particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1, life: 30 + Math.random() * 25, color: color || '#b49cff' }); }
	}
	/* a buffed copy of a type definition (faster, quicker casts) — same draw function, same kit */
	function buffedDef(t, w){
		const sp = Math.min(BAL.bossSpeedMax, 1 + BAL.bossSpeedPerWave * w), cd = Math.max(BAL.bossCdMin, 1 - BAL.bossCdPerWave * w);
		if(sp <= 1.02 && cd >= 0.98) return t;
		const d = Object.assign({}, t);
		d.moveSpeed = t.moveSpeed * sp;
		d.spells = (t.spells || []).map(s => Object.assign({}, s, { cooldown: Math.max(20, Math.round(s.cooldown * cd)) }));
		return d;
	}
	function makeEnemy(type, w, o){
		o = o || {};
		const base = ENEMY_TYPES[type]; if(!base) return null;
		const isBoss = !!o.boss;
		const t = isBoss ? buffedDef(base, w) : base;
		const ew = Math.round(base.w * DIFF_SIZE_MULT), eh = Math.round(base.h * DIFF_SIZE_MULT);
		const hp = Math.max(1, Math.round(o.hp != null ? o.hp : minionHp(base.hp, w)));
		const x = o.x != null ? o.x : pickX(ew);
		let y;
		if(o.y != null) y = o.y;
		else if(base.flies) y = B.ceil + 120 + Math.random() * 700;
		else y = B.floor - eh;
		const en = {
			type, typeDef: t, x, y, w: ew, h: eh, vx: 0, vy: 0,
			hp, maxHp: hp, facing: x < B.mid ? 1 : -1,
			patrol: [B.left + 40, B.right - 40], patrolDir: 1, state: 'alert', alertTimer: 600,
			spellCooldowns: (t.spells || []).map(s => Math.round(s.cooldown * (isBoss ? 0.8 : 1) * DIFF_CD_MULT * (0.5 + Math.random() * 0.5))),
			currentSpell: 0, flash: 0, dots: [], stunTimer: isBoss ? 90 : 36, slowTimer: 0, animTimer: 0, attackAnimTimer: 0,
			dead: false, deathTimer: 0, baseY: y, flyOffset: 0,
			charging: false, chargeVx: 0, chargeVy: 0, chargeTimer: 0, chargeCastDone: false,
			bossPhase: 1, bossPhaseTransition: 0, bossCharging: false, bossGlobalCD: 0,
			_safeX: x, _safeY: y, isMiniBoss: !!base.isMiniBoss,
			_coopKey: 'sv' + (++ST.uid), _surv: true, _wave: w,
		};
		enemies.push(en);
		fx(x + ew / 2, y + eh / 2, base.color2 || base.color, isBoss ? 40 : 12);
		return en;
	}
	const PARTY = () => (typeof coopPartySize === 'function' ? coopPartySize() : 1);
	function totalFor(w){ return Math.round(Math.min(BAL.crowd.cap, BAL.crowd.base + BAL.crowd.per * w) * (1 + 0.45 * (PARTY() - 1))); }
	function maxAliveFor(w){ return Math.min(BAL.crowd.aliveCap, BAL.crowd.aliveBase + Math.floor(w / BAL.crowd.aliveEvery)) + 3 * (PARTY() - 1); }

	/* ------------------------------------------------------------------ hidden / special bosses (filled in by the boss adapters below) */
	const SPECIAL = {};
	root.SurvivalSpecial = SPECIAL;      // { start(wave, hp) , alive(), hp(), update(), reset() }


	/* ---- Infernal Kitten (wave 100) --------------------------------------
	   Runs its real attack set (18 attacks, two phases, Fake Cute …). Everything
	   it needs from its arena is a rectangle, and that rectangle is now the whole
	   Sanctum (see KITTEN_ARENA_RECT in dungeon.html). No lock wall, no secret
	   passage, no dungeon reward: the wave system owns entry and exit. */
	function kittenClear(){
		const kb = kittenBoss; if(!kb) return;
		kb.crossActive = false; kb.gridActive = false; kb.yarnActive = false; kb.beamActive = false; kb.pouncing = false; kb.fakeCuteActive = false;
		kb.carpetActive = false; kb.ashfallActive = false; kb.orbitalsActive = false; kb.dashLinesActive = false; kb.pillarsActive = false; kb.tetherActive = false;
		kb.heatwaveActive = false; kb.emberRecallActive = false; kb.surgeWallsActive = false; kb.combustionActive = false; kb._fakeSafeVisible = false;
		kb.ashfallEmbers = []; kb.recallEmbers = []; kb.pillars = []; kb.orbitals = []; kb.dashLines = []; kb.heatwaveRings = []; kb.surgeWalls = [];
		kb.combustionMark = null; kb.carpetData = null; kb.dialogText = ''; kb.dialogAlpha = 0; kb.textAlpha = 0; kb.shakeTimer = 0;
		kb.attackPhase = 1; kb.attackCooldown = 0; kb.lastAttack = -1; kb.comboCount = 0; kb.fakeCuteTimer = 0; kb.totalAttacks = 0; kb.currentAttack = null;
	}
	SPECIAL.infernalKitten = {
		start(w, hp){
			const kb = kittenBoss, kt = ENEMY_TYPES.infernalKitten;
			kittenClear();
			const ew = Math.round(kt.w * DIFF_SIZE_MULT), eh = Math.round(kt.h * DIFF_SIZE_MULT);
			const en = makeEnemy('infernalKitten', w, { boss: true, hp, x: kb.arenaCx - ew / 2, y: kb.arenaCy - eh / 2 });
			en.isKittenBoss = true; en.stunTimer = 0; en.baseY = en.y; en.facing = -1;
			en.spellCooldowns = kt.spells.map(s => Math.round(s.cooldown * 0.6 * 0.8));
			kb.entity = en; kb.hp = hp; kb.maxHp = hp; kb.phase = 'cutscene'; kb.timer = 0; kb.floatTimer = 0;
			ST.bossEn = en;
		},
		alive(){ const e = kittenBoss && kittenBoss.entity; return !!(e && !e.dead && e.hp > 0); },
		bar(){ const e = kittenBoss.entity; return e ? { name: 'Infernal Kitten', hp: e.hp, max: e.maxHp } : null; },
		update(){
			const kb = kittenBoss, e = kb.entity;
			if(e && (e.dead || e.hp <= 0) && kb.phase !== 'defeated'){
				kb.phase = 'defeated'; kittenClear();
				dmgNumbers.push({ x: e.x + e.w / 2, y: e.y - 30, text: '🐱 INFERNAL KITTEN DEFEATED!', age: 0, color: '#ffdd00' });
				for(let i = 0; i < 40; i++) particles.push({ x: e.x + Math.random() * e.w, y: e.y + Math.random() * e.h, vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 10 - 4, life: 60 + Math.random() * 40, color: ['#ff4400', '#ffaa00', '#ffdd00', '#ff6600'][i % 4] });
			}
		},
		reset(){
			const kb = kittenBoss; if(!kb) return;
			if(kb.entity){ const i = enemies.indexOf(kb.entity); if(i >= 0) enemies.splice(i, 1); kb.entity = null; }
			kittenClear(); kb.phase = 'hidden';
		},
	};

	/* ---- Seraphel (wave 150) ---------------------------------------------
	   Real Seraphel: strafing, the divine slash set, the Phase 2 collapse and the
	   "no ultimates" punishment all run unchanged. Only the cathedral's bounds are
	   swapped for the Sanctum's, and the Lightstep Blade reward is not handed out. */
	SPECIAL.seraphel = {
		start(w, hp){
			const sf = seraphelFight;
			sf.arenaLeft = B.left; sf.arenaRight = B.right; sf.arenaY = B.floor;
			sf.phase = 'cutscene'; sf.timer = 0; sf._ultKillTimer = 0; sf._ultPunishCD = 0; sf.dialogText = ''; sf.dialogAlpha = 0;
			const t = ENEMY_TYPES.seraphel, ew = Math.round(t.w * DIFF_SIZE_MULT), eh = Math.round(t.h * DIFF_SIZE_MULT);
			const en = makeEnemy('seraphel', w, { boss: true, hp, x: B.mid - ew / 2, y: 1250 });
			en.baseY = en.y; ST.bossEn = en;
		},
		alive(){ return !!(ST.bossEn && !ST.bossEn.dead && ST.bossEn.hp > 0); },
		bar(){ const e = ST.bossEn; return e ? { name: 'Seraphel', hp: e.hp, max: e.maxHp } : null; },
		update(){ if(seraphelFight.phase === 'waiting' && ST.bossEn && !ST.bossEn.dead && ST.t > 60 && ST.t < 70){ /* the cutscene runs inside update() */ } },
		reset(){
			const sf = seraphelFight; sf.phase = 'waiting'; sf.timer = 0; sf.dialogText = ''; sf.dialogAlpha = 0; sf._ultKillTimer = 0; sf._ultPunishCD = 0;
		},
	};


	/* ---- Zenith (wave 200) ------------------------------------------------
	   The raid boss, unchanged: seven Wills that adapt to how you fight, the
	   Phase 2 shatter and its extra attacks. It reads its arena from
	   ZENITH_RAID_CONFIG, so the config is pointed at the Sanctum and the raid flag
	   is raised only while this fight is live. Dropped on purpose: Phase 2 dragging
	   the platforms around (the room stays exactly as built), the raid victory
	   screen and its item reward. */
	let _zenithPristine = null;
	function zenithResetWills(){
		if(!_zenithPristine) _zenithPristine = JSON.stringify(ZENITH_WILLS);
		const fresh = JSON.parse(_zenithPristine);
		ZENITH_WILLS.length = 0; for(const w of fresh) ZENITH_WILLS.push(w);
	}
	function zenithEnter(hp, asGuest){
		const C = ZENITH_RAID_CONFIG;
		C.arenaLeft = B.left; C.arenaRight = B.right; C.arenaTop = B.ceil; C.arenaBottom = B.floor;
		C.ceilY = B.ceil; C.groundY = B.floor;
		C.boss.x = B.mid - 50; C.boss.y = B.floor - 760;
		ZENITH_BOTTOM_Y = B.floor;
		zenithResetWills();
		zenithIndicators.length = 0;
		IS_ZENITH = true;
		zenithBoss = _mkZenithBoss();
		if(hp){ zenithBoss.hp = hp; zenithBoss.maxHp = hp; }
		zenithBoss._surv = true;
		zenithPlayerTracker = _mkZenithTracker();
	}
	function zenithLeave(){
		if(!IS_ZENITH) return;
		IS_ZENITH = false; zenithBoss = null; zenithPlayerTracker = null;
		zenithIndicators.length = 0;
		for(let i = enemyProjectiles.length - 1; i >= 0; i--){ const p = enemyProjectiles[i]; if(p && (p._zenithWillIdx !== undefined || p._raidBoss)) enemyProjectiles.splice(i, 1); }
	}
	SPECIAL.zenith = {
		start(w, hp){ zenithEnter(hp); ST.bossEn = null; },
		guestEnter(){ if(!IS_ZENITH) zenithEnter(0); },
		alive(){ return !!(zenithBoss && !zenithBoss.dead && zenithBoss.hp > 0); },
		bar(){ return zenithBoss ? { name: 'Zenith, the Final Convergence', hp: zenithBoss.hp, max: zenithBoss.maxHp } : null; },
		leave: zenithLeave, reset: zenithLeave,
	};

	/* ---- The Grand Challenger (wave 250) -----------------------------------
	   All three phases, the Mortal Challenge and the Final Exchange are intact.
	   The room is never touched: the phase-change floor shatter is replaced by a
	   screen-shake, and the two attacks that rip slabs out of the arena (Worldbreaker,
	   Planetary Cataclysm) are removed from his rotation. challenger-raid.js reads
	   its arena from CHALLENGER_RAID_CONFIG, which dungeon.html points at the Sanctum
	   when mode=survival. No victory screen, no reward. */
	function challengerEnter(hp){
		if(window.resetChallengerFx) window.resetChallengerFx();
		raidIndicators.length = 0;
		IS_CHALLENGER = true;
		challengerBoss = _mkChallengerBoss();
		if(hp){ challengerBoss.hp = hp; challengerBoss.maxHp = hp; }
		challengerBoss._surv = true;
	}
	function challengerLeave(){
		if(!IS_CHALLENGER) return;
		IS_CHALLENGER = false; challengerBoss = null;
		if(window.resetChallengerFx) window.resetChallengerFx();
		raidIndicators.length = 0;
		for(let i = enemyProjectiles.length - 1; i >= 0; i--){ const p = enemyProjectiles[i]; if(p && p._raidBoss) enemyProjectiles.splice(i, 1); }
	}
	SPECIAL.challenger = {
		start(w, hp){ challengerEnter(hp); ST.bossEn = null; },
		guestEnter(){ if(!IS_CHALLENGER) challengerEnter(0); },
		alive(){ return !!(challengerBoss && !challengerBoss.dead && challengerBoss.hp > 0); },
		bar(){ return challengerBoss ? { name: 'The Grand Challenger', hp: challengerBoss.hp, max: challengerBoss.maxHp } : null; },
		leave: challengerLeave, reset: challengerLeave,
	};

	for(const k in SPECIAL) SPECIAL[k].key = k;
	function leaveSpecials(){ for(const k in SPECIAL) if(SPECIAL[k].leave) try { SPECIAL[k].leave(); } catch(e){ console.warn('[survival] leave', k, e); } }

	/* ------------------------------------------------------------------ wave flow */
	function aliveMinions(){ let n = 0; for(const e of enemies) if(e._surv && !e.dead && e !== ST.bossEn) n++; return n; }
	function startWave(){
		const w = ST.wave, inf = waveInfo(w);
		leaveSpecials();
		ST.phase = 'fight'; ST.t = 0; ST.spawned = 0; ST.spawnCd = 20; ST.bossEn = null; ST.special = null;
		if(inf.kind === 'normal'){
			ST.total = totalFor(w); ST.maxAlive = maxAliveFor(w);
		} else if(inf.kind === 'hidden'){
			ST.total = 0; ST.maxAlive = 0;
			const sp = SPECIAL[inf.boss];
			if(sp){ ST.special = sp; sp.start(w, bossHpFor(inf.boss, w)); }
			else { ST.bossEn = makeEnemy('voidArbiter', w, { boss: true, hp: bossHpFor(inf.boss, w), x: B.mid - 180 }); }
		} else {
			ST.total = Math.min(18, 4 + Math.floor(w / 12)); ST.maxAlive = Math.min(6, 2 + Math.floor(w / 40));
			ST.bossEn = makeEnemy(inf.boss, w, { boss: true, hp: bossHpFor(inf.boss, w), x: B.mid + (Math.random() < 0.5 ? -900 : 900) });
		}
		shakeScreen(6, 14);
	}
	function bossDefeated(){
		if(ST.special) return !ST.special.alive();
		return ST.bossEn ? ST.bossEn.dead || ST.bossEn.hp <= 0 : false;
	}
	function clearAdds(){ for(const e of enemies) if(e._surv && !e.dead && e !== ST.bossEn){ e.hp = 0; } }
	function waveCleared(){
		const w = ST.wave, inf = waveInfo(w);
		if(inf.kind !== 'normal'){ clearAdds(); banner('WAVE ' + w + ' CLEARED', ((ENEMY_TYPES[inf.boss] || {}).name || 'Boss') + ' defeated', '#9bffb8', 220); }
		else banner('WAVE ' + w + ' CLEARED', '', '#9bffb8', 110);
		if(typeof addXp === 'function'){ try { addXp(inf.kind === 'normal' ? 1 : 5 + Math.floor(w / 10)); } catch(e){} }
		ST.best = Math.max(ST.best, w);
		if(w % BAL.checkpointEvery === 0){
			ST.checkpoint = w + 1;
			banner('CHECKPOINT', 'Wave ' + w + ' secured — a wipe returns you to wave ' + (w + 1), '#7fe9ff', 260);
		}
		saveProgress();
		// breather: patch yourself up
		const heal = inf.kind === 'normal' ? 0.25 : 0.6;
		if(!ST.down){ health = Math.min(maxHealth, health + maxHealth * heal); mana = maxMana; updateHealthHUD(); updateManaHUD(); }
		ST.wave++;
		ST.phase = 'prep'; ST.t = 0;
		const ni = waveInfo(ST.wave);
		ST.prepLen = ni.kind === 'hidden' ? BAL.prepHiddenFrames : ni.kind === 'normal' ? BAL.prepFrames : BAL.prepBossFrames;
		ST.bossEn = null; ST.special = null;
		say('clear', { w });
	}
	/* total party wipe: everyone returns to the last checkpoint */
	function wipe(reason){
		if(ST.phase === 'wipe') return;
		ST.phase = 'wipe'; ST.t = 0; ST.wipeReason = reason || '';
		banner('PARTY DEFEATED', 'Returning to wave ' + ST.checkpoint, '#ff6b6b', BAL.wipeFrames);
		saveProgress();
	}
	function resetToCheckpoint(){
		for(const k in SPECIAL) try { SPECIAL[k].reset && SPECIAL[k].reset(); } catch(e){ console.warn('[survival] reset', k, e); }
		enemies.length = 0; enemyProjectiles.length = 0; if(typeof bossTelegraphs !== 'undefined') bossTelegraphs.length = 0;
		ST.wave = ST.checkpoint; ST.phase = 'prep'; ST.t = 0; ST.bossEn = null; ST.special = null;
		const ni = waveInfo(ST.wave);
		ST.prepLen = ni.kind === 'hidden' ? BAL.prepHiddenFrames : ni.kind === 'normal' ? BAL.prepFrames : BAL.prepBossFrames;
	}

	/* ------------------------------------------------------------------ the player going down / coming back */
	function reviveLocal(full){
		const wasDown = ST.down;
		ST.down = false;
		const p = SurvivalArena.spawnFor(typeof COOP_SLOT !== 'undefined' ? COOP_SLOT : 0);
		if(wasDown || full){
			health = full ? maxHealth : Math.max(1, maxHealth * 0.6); mana = maxMana;
			player.x = p.x; player.y = p.y; player.vx = 0; player.vy = 0; player.launchVx = 0;
			player.dots = []; player.slowTimer = 0; player.stunTimer = 0; player.blindTimer = 0; player.iFrames = 120;
			player.ultCharging = false; player.ultChargeTimer = 0;
			updateHealthHUD(); updateManaHUD();
			dmgNumbers.push({ x: player.x + player.w / 2, y: player.y - 20, text: 'Back in the fight!', age: 0, color: '#9bffb8' });
		}
	}
	function onPlayerDown(){
		if(ST.down) return true;
		ST.down = true; health = 0;
		dmgNumbers.push({ x: player.x + player.w / 2, y: player.y - 30, text: 'DOWN', age: 0, color: '#ff6b6b' });
		return true;
	}
	function partyAllDown(){
		if(!ST.down) return false;
		const al = root.__coopAllies;
		if(al) for(const id in al){ const a = al[id]; if(a && a.active && a.hp > 0) return false; }
		return true;
	}

	/* a boss's art starts downloading and decoding (off the main thread) during the countdown, so the fight does not
	   open with a freeze while a huge sheet is decoded on first draw */
	function prefetchWave(w){
		const inf = waveInfo(w);
		try {
			if(!inf.boss) return;
			if(inf.boss === 'challenger'){ if(root.prefetchChallengerArt) root.prefetchChallengerArt(); return; }
			if(inf.boss === 'zenith'){ if(root.LAZY_IMG) LAZY_IMG.need('zenith-sheet'); return; }
			if(inf.boss !== 'fireDragon' && typeof ENEMY_SPRITE_SHEETS !== 'undefined') ENEMY_SPRITE_SHEETS[inf.boss];
			if(typeof LAZY_SET_SLUG !== 'undefined' && LAZY_SET_SLUG[inf.boss] && root.LAZY_IMG) LAZY_IMG.need(LAZY_SET_SLUG[inf.boss]);
		} catch(e){}
	}

	/* ------------------------------------------------------------------ per-frame */
	function tick(){
		// ---- both sides ----
		if(ST.bannerT > 0) ST.bannerT--;
		if(ST.down){ health = 0; player.stunTimer = Math.max(player.stunTimer || 0, 3); player.iFrames = Math.max(player.iFrames || 0, 60); player.vx = 0; }
		for(let i = enemies.length - 1; i >= 0; i--){ const e = enemies[i]; if(e.dead && e.deathTimer > (HOST() ? 240 : 330) && (e._surv || e._coopKey)) enemies.splice(i, 1); }
		ST.t++;

		if(!HOST()){ guestFollow(); return; }

		// ---- host / solo ----
		if(IS_COOP && ST.bossEn && !ST.bossEn.dead && typeof applyCoopBossHp === 'function') applyCoopBossHp(ST.bossEn);   // party-size HP scaling for pool bosses
		if(ST.phase === 'fight' && partyAllDown()){ wipe('down'); }
		for(const k in SPECIAL) if(ST.special === SPECIAL[k] && SPECIAL[k].update) { try { SPECIAL[k].update(); } catch(e){ console.warn('[survival] special', k, e); } }
		if(ST.phase === 'prep'){
			if(ST.t === 1){ reviveLocal(false); announceWave(); say('wave', { w: ST.wave }); prefetchWave(ST.wave); }
			if(ST.t >= ST.prepLen){ if(ST.down) reviveLocal(false); startWave(); }
		} else if(ST.phase === 'fight'){
			const inf = info();
			if(inf.kind === 'normal' || ST.total > 0){
				if(ST.spawned < ST.total && aliveMinions() < ST.maxAlive && --ST.spawnCd <= 0){
					makeEnemy(pickType(ST.wave), ST.wave); ST.spawned++; ST.spawnCd = 20 + (Math.random() * 40 | 0);
				}
			}
			if(inf.kind === 'normal'){
				if(ST.spawned >= ST.total && aliveMinions() === 0) waveCleared();
			} else if(ST.t > 30 && bossDefeated()) waveCleared();
			// everybody who is not down keeps going; solo death = wipe (handled above through partyAllDown)
		} else if(ST.phase === 'wipe'){
			if(ST.t >= BAL.wipeFrames){ resetToCheckpoint(); }
		}
		refreshBossBar();
	}
	let _lastPhase = '', _lastWaveSeen = 0;
	function guestFollow(){
		// banners and revives are driven off snapshot changes
		if(ST.phase !== _lastPhase){
			if(ST.phase === 'prep'){ reviveLocal(_lastPhase === 'wipe'); }
			if(ST.phase === 'wipe') banner('PARTY DEFEATED', 'Returning to wave ' + ST.checkpoint, '#ff6b6b', BAL.wipeFrames);
			_lastPhase = ST.phase;
		}
		if(ST.wave !== _lastWaveSeen){ if(ST.phase !== 'wipe' && _lastWaveSeen) announceWave(); _lastWaveSeen = ST.wave; prefetchWave(ST.wave); }
	}
	function refreshBossBar(){
		let name = '', hp = 0, mx = 0;
		if(ST.special && ST.special.alive()){ const s = ST.special.bar ? ST.special.bar() : null; if(s){ name = s.name; hp = s.hp; mx = s.max; } }
		else if(ST.bossEn && !ST.bossEn.dead){ name = ST.bossEn.typeDef.name || ST.bossEn.type; hp = ST.bossEn.hp; mx = ST.bossEn.maxHp; }
		ST.bossName = name; ST.bossHp = hp; ST.bossMax = mx;
	}

	/* ------------------------------------------------------------------ incoming damage */
	function incomingMult(){
		const m = dmgMult(ST.wave);
		return (ST.bossMax > 0 && ST.bossHp > 0) ? m * BAL.bossDamageScale : m;
	}

	/* ------------------------------------------------------------------ network */
	const PH = { prep: 0, fight: 1, wipe: 2 }, PHN = ['prep', 'fight', 'wipe'];
	function snap(){
		return { w: ST.wave, p: PH[ST.phase] || 0, t: ST.t, pl: ST.prepLen, r: ST.phase === 'fight' ? (Math.max(0, ST.total - ST.spawned) + aliveMinions() + (ST.bossEn && !ST.bossEn.dead ? 1 : 0)) : 0, n: ST.total,
			sk: ST.special ? ST.special.key : '', ck: ST.checkpoint, b: ST.best, bn: ST.bossName, bh: Math.round(ST.bossHp), bm: Math.round(ST.bossMax) };
	}
	let _lastSk = '';
	function applySnap(s){
		if(!s || HOST()) return;
		ST.wave = s.w; ST.phase = PHN[s.p] || 'prep'; ST.t = s.t; ST.prepLen = s.pl || ST.prepLen; ST.remaining = s.r; ST.total = s.n;
		ST.checkpoint = s.ck; ST.best = Math.max(ST.best, s.b || 0); ST.bossName = s.bn || ''; ST.bossHp = s.bh || 0; ST.bossMax = s.bm || 0;
		if((s.sk || '') !== _lastSk){ _lastSk = s.sk || ''; leaveSpecials(); if(_lastSk && SPECIAL[_lastSk] && SPECIAL[_lastSk].guestEnter) SPECIAL[_lastSk].guestEnter(); }
	}
	function onNet(d){
		if(!d) return;
		if(d.k === 'banner') banner(d.text, d.sub, d.color, d.f);
		if(d.k === 'jump' && !HOST()){
			// the host skipped to another wave: the old wave's enemies, shots and boss fights end here too
			leaveSpecials();
			for(const k in SPECIAL) try { SPECIAL[k].reset && SPECIAL[k].reset(); } catch(e){}
			enemies.length = 0; enemyProjectiles.length = 0; if(typeof bossTelegraphs !== 'undefined') bossTelegraphs.length = 0;
			ST.wave = d.w; ST.bossEn = null; ST.special = null; ST.bossMax = 0; ST.bossHp = 0;
			reviveLocal(true);
		}
	}

	/* ------------------------------------------------------------------ HUD */
	function draw(c){
		// the backing canvas is bigger than its on-screen box: draw in CSS pixels so the HUD keeps its designed size
		const k = c.canvas.width / (c.canvas.clientWidth || c.canvas.width) || 1;
		const cw = c.canvas.width / k, ch = c.canvas.height / k;
		c.save(); c.setTransform(k, 0, 0, k, 0, 0);
		c.textAlign = 'center';
		const inf = info();
		// --- top plate
		const own = (typeof IS_ZENITH !== 'undefined' && IS_ZENITH) || (typeof IS_CHALLENGER !== 'undefined' && IS_CHALLENGER);   // those bosses draw their own HP bar + attack HUD up top
		const pw = own ? 230 : 330, px = own ? 14 : cw / 2 - pw / 2, py = own ? 96 : 10, mx = px + pw / 2;
		c.fillStyle = 'rgba(14,8,34,0.72)'; c.strokeStyle = 'rgba(160,140,255,0.55)'; c.lineWidth = 1.5;
		c.beginPath(); c.roundRect ? c.roundRect(px, py, pw, 58, 10) : c.rect(px, py, pw, 58); c.fill(); c.stroke();
		c.fillStyle = '#e9e2ff'; c.font = 'bold 22px Arial'; c.fillText('WAVE ' + ST.wave, mx, py + 26);
		c.font = '12px Arial'; c.fillStyle = '#a99be0';
		const tag = inf.kind === 'hidden' ? '☠ ??? ' : inf.kind === 'boss' ? '⚔ BOSS ' : inf.kind === 'mini' ? '⚔ MINIBOSS ' : '';
		const nextCk = Math.ceil(ST.wave / BAL.checkpointEvery) * BAL.checkpointEvery;
		c.fillText(tag + (own ? 'Ckpt ' + nextCk + ' · Best ' + ST.best : 'Checkpoint at wave ' + nextCk + '   ·   Best ' + ST.best), mx, py + 44);
		// progress / countdown bar
		const bx = px + 14, bw = pw - 28, by = py + 50;
		c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(bx, by, bw, 4);
		let frac = 0, col = '#9c86ff';
		if(ST.phase === 'prep'){ frac = clamp(ST.t / Math.max(1, ST.prepLen), 0, 1); col = '#7fe9ff'; }
		else if(ST.phase === 'fight'){ const tot = Math.max(1, (ST.total || 0) + (inf.kind === 'normal' ? 0 : 1)); frac = clamp(1 - ST.remaining / tot, 0, 1); if(HOST()) frac = clamp(1 - (Math.max(0, ST.total - ST.spawned) + aliveMinions() + (ST.bossEn && !ST.bossEn.dead ? 1 : (ST.special && ST.special.alive() ? 1 : 0))) / tot, 0, 1); }
		c.fillStyle = col; c.fillRect(bx, by, bw * frac, 4);
		// --- boss bar
		if(!own && ST.bossMax > 0 && ST.bossHp > 0 && ST.phase === 'fight'){
			const w2 = Math.min(640, cw - 80), x2 = cw / 2 - w2 / 2, y2 = 100;
			if(typeof drawBossBar === 'function') drawBossBar(c, { key: 'surv-boss', x: x2, y: y2, w: w2, h: 22, name: ST.bossName, sub: 'Wave ' + ST.wave,
				hp: ST.bossHp, max: ST.bossMax, c1: '#d93a5c', c2: '#ffb36b', accent: '#ff7a9a' });
		}
		// --- big banner
		if(ST.bannerT > 0 && ST.banner){
			const a = clamp(Math.min(ST.bannerT / 30, (ST.bannerMax - ST.bannerT) / 20, 1), 0, 1);
			c.globalAlpha = a;
			c.font = 'bold 54px Arial'; c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillText(ST.banner.text, cw / 2 + 3, ch * 0.30 + 3);
			c.fillStyle = ST.banner.color; c.fillText(ST.banner.text, cw / 2, ch * 0.30);
			if(ST.banner.sub){ c.font = '20px Arial'; c.fillStyle = '#fff'; c.fillText(ST.banner.sub, cw / 2, ch * 0.30 + 34); }
			c.globalAlpha = 1;
		}
		// --- down overlay
		if(ST.down){
			c.fillStyle = 'rgba(40,0,10,0.35)'; c.fillRect(0, 0, cw, ch);
			c.fillStyle = '#ff8a8a'; c.font = 'bold 40px Arial'; c.fillText('YOU ARE DOWN', cw / 2, ch * 0.55);
			c.font = '18px Arial'; c.fillStyle = '#fff'; c.fillText(ST.phase === 'wipe' ? 'The party has fallen…' : 'You return when the next wave begins', cw / 2, ch * 0.55 + 30);
		}
		c.restore();
	}

	/* ------------------------------------------------------------------ TEST MENU: skip to any wave (host / solo only) */
	function jumpTo(w){
		if(!HOST()) return false;
		w = clamp(Math.round(w) || 1, 1, 9999);
		for(const k in SPECIAL) try { SPECIAL[k].leave && SPECIAL[k].leave(); SPECIAL[k].reset && SPECIAL[k].reset(); } catch(e){ console.warn('[survival] jump reset', k, e); }
		enemies.length = 0; enemyProjectiles.length = 0; if(typeof bossTelegraphs !== 'undefined') bossTelegraphs.length = 0;
		ST.wave = w; ST.phase = 'prep'; ST.t = 0; ST.bossEn = null; ST.special = null; ST.bossMax = 0; ST.bossHp = 0; ST.spawned = 0; ST.total = 0;
		const ni = waveInfo(w);
		ST.prepLen = ni.kind === 'hidden' ? 240 : 120;
		ST.checkpoint = Math.max(1, Math.floor((w - 1) / BAL.checkpointEvery) * BAL.checkpointEvery + 1);
		reviveLocal(true);
		say('jump', { w });      // guests clear their copies of the old wave at once
		return true;
	}
	function tierMix(w){
		const w1 = Math.max(0.25, 1 - w / 150), w2 = clamp((w - 5) / 20, 0, 1.2), w3 = clamp((w - 20) / 30, 0, 1.5);
		const tot = w1 + w2 + w3 || 1;
		const nm = (l) => l.filter(t => ENEMY_TYPES[t]).slice(0, 4).map(t => ENEMY_TYPES[t].name || t).join(', ');
		const out = [];
		if(w1 > 0) out.push(['Tier 1', Math.round(w1 / tot * 100), nm(POOL.t1g.concat(POOL.t1f))]);
		if(w2 > 0) out.push(['Tier 2', Math.round(w2 / tot * 100), nm(POOL.t2g.concat(POOL.t2f))]);
		if(w3 > 0) out.push(['Tier 3', Math.round(w3 / tot * 100), nm(POOL.t3g.concat(POOL.t3f))]);
		return out;
	}
	function waveDescribe(w){
		const inf = waveInfo(w), P = (typeof PARTY === 'function') ? PARTY() : 1;
		const L = [];
		const fmt = (n) => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? Math.round(n / 1000) + 'k' : String(Math.round(n));
		if(inf.kind === 'normal'){
			L.push(['h', 'Wave ' + w + ' — Horde']);
			L.push(['t', totalFor(w) + ' enemies · up to ' + maxAliveFor(w) + ' alive at once']);
			for(const m of tierMix(w)) L.push(['t', m[0] + ' ' + m[1] + '% — ' + m[2] + '…']);
		} else if(inf.kind === 'hidden'){
			L.push(['h', 'Wave ' + w + ' — ??? Hidden boss']);
			const nm = { infernalKitten: 'The Infernal Kitten', seraphel: 'Seraphel', zenith: 'Zenith', challenger: 'The Challenger' }[inf.boss] || inf.boss;
			L.push(['t', nm + ' — ' + fmt(bossHpFor(inf.boss, w)) + ' HP']);
			L.push(['t', 'Fought in its own arena; no adds.']);
		} else {
			const nm = (ENEMY_TYPES[inf.boss] || {}).name || inf.boss;
			L.push(['h', 'Wave ' + w + ' — ' + (inf.kind === 'mini' ? 'Miniboss' : 'Boss')]);
			L.push(['t', nm + ' — ' + fmt(bossHpFor(inf.boss, w)) + ' HP']);
			L.push(['t', 'Plus ' + Math.min(18, 4 + Math.floor(w / 12)) + ' adds (max ' + Math.min(6, 2 + Math.floor(w / 40)) + ' at once)']);
		}
		L.push(['s', 'Enemy HP ×' + minionMult(w).toFixed(2) + ' (of a squashed base) · Damage taken ×' + dmgMult(w).toFixed(2) + (inf.kind === 'normal' ? '' : ' (bosses ×' + BAL.bossDamageScale + ')')]);
		if(w % BAL.checkpointEvery === 0) L.push(['c', '✔ Checkpoint — clearing it saves wave ' + (w + 1)]);
		else L.push(['s', 'Respawn checkpoint: wave ' + (Math.floor((w - 1) / BAL.checkpointEvery) * BAL.checkpointEvery + 1)]);
		return L;
	}
	function buildMenu(){
		if(document.getElementById('survTestBtn') || !document.body) return;
		const css = document.createElement('style');
		css.textContent = `
#survTestBtn{position:fixed;top:56px;right:14px;z-index:40;padding:7px 14px;border-radius:8px;border:1px solid #b79cff;background:linear-gradient(#3b2a6e,#241846);color:#efe8ff;font:bold 13px Arial,sans-serif;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.5)}
#survTestBtn:hover{filter:brightness(1.25)}
#survMenu{position:fixed;inset:0;z-index:60;display:none;background:rgba(6,3,16,.78);align-items:center;justify-content:center;font-family:Arial,sans-serif}
#survMenu.open{display:flex}
#survMenu .box{width:min(880px,94vw);max-height:90vh;display:flex;flex-direction:column;background:#150d2c;border:1px solid #8e74e6;border-radius:14px;box-shadow:0 10px 50px #000;color:#e9e2ff}
#survMenu .hd{display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid #3a2a72}
#survMenu .hd b{font-size:18px;flex:1}
#survMenu .hd input{width:70px;padding:5px 7px;border-radius:6px;border:1px solid #6b55c4;background:#0e0820;color:#fff;font-size:14px}
#survMenu button.x{padding:6px 12px;border-radius:6px;border:1px solid #6b55c4;background:#2b1d57;color:#fff;cursor:pointer;font-weight:bold}
#survMenu button.x:hover{background:#43308a}
#survMenu .grid{padding:14px 18px;overflow:auto;display:grid;grid-template-columns:repeat(10,1fr);gap:6px}
#survMenu .w{padding:8px 0;border-radius:6px;border:1px solid #4a3a8f;background:#21164a;color:#e9e2ff;font:bold 13px Arial;cursor:pointer;text-align:center}
#survMenu .w:hover{background:#4a36a0;border-color:#cbbcff}
#survMenu .w.mini{border-color:#e0a24a;background:#3a2a14;color:#ffd9a0}
#survMenu .w.boss{border-color:#ff7a5a;background:#44180f;color:#ffc4b4}
#survMenu .w.hidden{border-color:#ff4f86;background:#42102a;color:#ffb0cc}
#survMenu .w.cur{outline:2px solid #7fe9ff}
#survMenu .lg{padding:8px 18px 12px;font-size:12px;color:#a99be0;border-top:1px solid #3a2a72}
#survTip{position:fixed;z-index:70;display:none;max-width:320px;pointer-events:none;padding:10px 12px;border-radius:8px;background:rgba(12,7,28,.97);border:1px solid #b79cff;color:#e9e2ff;font:12.5px/1.45 Arial,sans-serif;box-shadow:0 6px 24px #000}
#survTip h4{margin:0 0 5px;font-size:14px;color:#fff}#survTip .s{color:#a99be0}#survTip .c{color:#9bffb8}
@media(max-width:700px){#survMenu .grid{grid-template-columns:repeat(5,1fr)}}`;
		document.head.appendChild(css);
		const btn = document.createElement('button'); btn.id = 'survTestBtn'; btn.textContent = '🧪 Test — Waves'; document.body.appendChild(btn);
		const menu = document.createElement('div'); menu.id = 'survMenu';
		menu.innerHTML = '<div class="box"><div class="hd"><b>Test: skip to a wave</b><span>Go to</span><input id="survGo" type="number" min="1" max="250" value="1"><button class="x" id="survGoBtn">Go</button><button class="x" id="survClose">Close</button></div><div class="grid" id="survGrid"></div><div class="lg">Hover a wave for ~1 second to see what is in it. Click to skip there. <span style="color:#ffd9a0">■ miniboss</span> <span style="color:#ffc4b4">■ boss</span> <span style="color:#ffb0cc">■ hidden boss</span> <span style="color:#7fe9ff">▢ current</span></div></div>';
		document.body.appendChild(menu);
		const tip = document.createElement('div'); tip.id = 'survTip'; document.body.appendChild(tip);
		const grid = menu.querySelector('#survGrid');
		let hoverT = 0;
		const hideTip = () => { clearTimeout(hoverT); tip.style.display = 'none'; };
		const showTip = (w, x, y) => {
			tip.innerHTML = waveDescribe(w).map(r => r[0] === 'h' ? '<h4>' + r[1] + '</h4>' : '<div class="' + (r[0] === 's' ? 's' : r[0] === 'c' ? 'c' : '') + '">' + r[1] + '</div>').join('');
			tip.style.display = 'block';
			const tw = tip.offsetWidth, th = tip.offsetHeight;
			tip.style.left = Math.max(8, Math.min(innerWidth - tw - 8, x + 14)) + 'px';
			tip.style.top = Math.max(8, Math.min(innerHeight - th - 8, y + 14)) + 'px';
		};
		function fill(){
			grid.innerHTML = '';
			for(let w = 1; w <= BAL.cycle; w++){
				const inf = waveInfo(w), b = document.createElement('button');
				b.className = 'w' + (inf.kind !== 'normal' ? ' ' + inf.kind : '') + (w === ST.wave ? ' cur' : '');
				b.textContent = inf.kind === 'hidden' ? '☠' + w : inf.kind === 'normal' ? w : '⚔' + w;
				b.dataset.w = w;
				grid.appendChild(b);
			}
		}
		let lastXY = [0, 0];
		grid.addEventListener('mouseover', (e) => {
			const b = e.target.closest('.w'); hideTip(); if(!b) return;
			const w = +b.dataset.w; lastXY = [e.clientX, e.clientY];
			hoverT = setTimeout(() => showTip(w, lastXY[0], lastXY[1]), 1000);
		});
		grid.addEventListener('mousemove', (e) => { lastXY = [e.clientX, e.clientY]; });
		grid.addEventListener('mouseout', hideTip);
		const close = () => { hideTip(); menu.classList.remove('open'); };
		const go = (w) => { if(jumpTo(w)) close(); };
		grid.addEventListener('click', (e) => { const b = e.target.closest('.w'); if(b) go(+b.dataset.w); });
		menu.querySelector('#survClose').onclick = close;
		menu.querySelector('#survGoBtn').onclick = () => go(+menu.querySelector('#survGo').value);
		menu.addEventListener('mousedown', (e) => { if(e.target === menu) close(); });
		for(const ev of ['keydown', 'keyup']) menu.addEventListener(ev, (e) => e.stopPropagation());
		window.addEventListener('keydown', (e) => { if(e.key === 'Escape' && menu.classList.contains('open')){ close(); e.stopPropagation(); } }, true);
		btn.onclick = () => {
			if(!HOST()){ banner('Host only', 'Only the host can skip waves', '#ff9b9b', 120); return; }
			fill(); menu.querySelector('#survGo').value = ST.wave; menu.classList.add('open');
			const cur = grid.querySelector('.cur'); if(cur) cur.scrollIntoView({ block: 'center' });
		};
	}
	if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildMenu); else buildMenu();

	/* ------------------------------------------------------------------ public */
	root.SurvivalMode = {
		BAL, ST, waveInfo, tick, draw, snap, applySnap, onNet, incomingMult, onPlayerDown,
		hpMult, minionMult, minionHp, dmgMult, bossHpFor, makeEnemy, say, banner, fx, B,
		debug: {
			jump(w){ ST.wave = w; ST.phase = 'prep'; ST.t = 0; enemies.length = 0; },
			jumpTo, waveDescribe,
			spawn(type, w, boss){ return makeEnemy(type, w || ST.wave, boss ? { boss: true, hp: bossHpFor(type, w || ST.wave) } : {}); },
			skipPrep(){ ST.t = ST.prepLen; },
		},
	};
	if(START_W > 1) ST.checkpoint = Math.max(1, Math.floor((START_W - 1) / BAL.checkpointEvery) * BAL.checkpointEvery + 1);
})(window);
