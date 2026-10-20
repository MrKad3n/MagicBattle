/* =====================================================================
   THE GRAND ARCANIST — a technique-free master of raw magic (endgame boss, Mage Arena)

   He uses NO technique. Every attack is an ordinary rune tree (the forge's format), cast through the real engine
   (MagicEngine world.cast, via RuneMages' caster) with his own reserve and his own per-spell cursor. His power is
   raw energy handled precisely: compression and shape, Divide and Split, staged holds, Delay and Wait-Until
   conditions, Draw Out streams, Redirect, Anchor, Discharge and expansion.

   Where things live
   · CONFIG    — every balance number (health, reserve and regeneration, phases, timings, caps, prediction).
   · ATTACKS   — the attack library: each attack is a rune tree plus the metadata that decides when and how he casts it
                 (role, phases, range, prep / telegraph / recovery, cooldown, intended response, counters, source).
                 Sources are honest: 'authored' (an initial authored spell) or a discovery id (RD-xxxx) from
                 sim/raw-discovery/catalog.json — those trees are copied unchanged from the catalog.
   · POLICY    — the technique ban, enforced in code: a static check of every tree before it is registered AND before
                 every cast, and a runtime scan of everything he owns every frame (energy, reinforcements, constructs,
                 domains). Anything technique-bearing that appears on his energy (e.g. pushed onto it by another
                 caster) is stripped back to raw energy and recorded.
   · the mind  — perception (delayed), a model of what the player keeps doing, a utility score per attack with
                 controlled variety, sequences, three phases, movement, interruption and clean-up.
   · drawing   — his figure, the hands that gather energy, and telegraphs built from the engine's own geometry.

   Integration: registers RuneMages.KINDS.arcanist with a custom mind (RuneMages calls K.custom.init / frame / draw /
   onDeath), so he appears in the Mage Arena's summon panel and is hit, killed and cleared like any rune mage.
   Tests: tools/arcanist-campaign.js (individual attacks, full encounters, technique-free checks, stability).
   ===================================================================== */
(function(root){
	'use strict';
	const ME = root.MagicEngine, RM = root.RuneMages;
	if(!ME || !RM){ root.GrandArcanist = null; return; }
	const { N, L, build } = RM;

	/* =========================== CONFIG (balance, all in one place) =========================== */
	const CONFIG = {
		hp: 5600,                            // tuned by the campaign: a skilled player (dodges late, punishes his rooted casts) wins about two fights in three
		// his magic profile: Max Output = 60 + 6 × power = 960; rune capacity 100. No technique points at all.
		stats: { magicControl: 30, magicPower: 150 },
		// BOSS-SPECIFIC ALLOWANCE (documented): a reserve and regeneration well above a player's. Every cast still pays
		// its validated upfront cost, and his Draw Out pays for every unit drawn (owner.drain) — nothing is free.
		reserve: 30000, regen: 900, reserveFloor: 350,         // c61: a far larger reserve that refills about six times faster
		dmgScale: 0.33,                      // engine damage → your health (rune mages use 0.3)
		evade: 0.55,                         // chance he sidesteps or jumps a projectile of yours he sees coming (not while rooted)
		phase2: 0.66, phase3: 0.33,          // health fractions
		transition: 1.8,                     // seconds of the phase shift (no casting; he can be hit)
		maxBodies: 90,                       // his own live energy bodies; an attack that would exceed this waits
		maxInstances: 18,                    // his own live spell instances (the engine's own cap is 24)
		speed: 4.2, jump: 15.5, size: { w: 40, h: 96 },
		react: 0.2,                          // seconds: he sees you this late
		aimErr: 10,                          // px of aim noise (plus distance), never perfect
		range: [ [ 460, 640 ], [ 420, 600 ], [ 380, 560 ] ],      // preferred distance per phase
		rest: [ [ 0.25, 0.4 ], [ 0.18, 0.32 ], [ 0.12, 0.24 ] ],    // breath between decisions per phase (c61: much faster)
		recoveryMul: [ 0.45, 0.38, 0.3 ],
		telegraphMul: 0.3,                   // c61: wind-ups are 30 % of each attack's listed telegraph
		cooldownMul: 0.4,                    // c61: cooldowns are 40 % of each attack's listed cooldown
		showTelegraphs: false,               // c61: no warning circles, aim lines or projections are drawn
		minTelegraph: 0.1,                   // no wind-up is ever shorter
		topK: 3, temperature: 0.35,          // choose among the best three with softmax (controlled variety)
		repeatHalfLife: 8,                   // seconds until a used attack loses half its "recently seen" penalty
		tidyAge: 7.5, mineAge: 11,           // his loose energy is let go after this many seconds (mines live longer)
		minFirstHit: 0.2,                   // the campaign fails any attack that can hit sooner than this after its telegraph starts
		poise: 3.0,                          // after you interrupt him, 3 s in which stuns and knockback do not stop him (no stun-lock)
		kbCap: 8,                            // frames: the longest knockback he takes
		resetOnPlayerDeath: true             // you fall: his spells end, he recovers fully and the fight starts again from phase I
	};
	const PH = (m) => m.GA ? m.GA.phase : 1;

	/* =========================== spell trees =========================== */
	const atFoe = (...k) => N('target', { kind: 'enemy', select: 'nearCaster', range: 1600 }, null, ...k);
	const raw = (amount, ...k) => N('generate', { amount }, null, N('color', { color: 'gold' }, null, ...k));
	const comp = (power, shape, ...k) => N('compress', { power, shape }, null, ...k);
	const toCursor = (extra, link, ...k) => N('redirect', Object.assign({ toward: 'mouse' }, extra || {}), link, ...k);

	/* discovered trees are copied from the catalog unchanged; the browser build keeps a frozen copy here */
	const DISCOVERED = {
		/* RD-0099 (sim/raw-discovery/catalog.json): 400 E → Compress 8 disc → Divide 5 horizontal, spacing 160, keep → Redirect
		   cursor → when the target is within 110: Compress −6 (expand) → Discharge 1.4. Five narrow, fast discs in a line
		   swell into wide bursts only as they reach you: dodging the disc is not enough, you have to leave the burst. */
		'RD-0099': null,
		/* RD-0234: 240 E → Compress 8 sphere → Divide 3 cluster, keep → Redirect cursor, stop → when arrived: Anchor →
		   when an enemy is within 120: Discharge 1.8 — mines dropped where you are heading. */
		'RD-0234': null
	};
	function discovered(id){
		const d = DISCOVERED[id];
		if(d && d.nodes) return JSON.parse(JSON.stringify(d));
		return null;
	}

	/* =========================== the attack library =========================== */
	// tele: how it is telegraphed — 'line' aim line · 'mark' a target circle · 'ring' a burst radius around him ·
	// 'fuse' staged pieces with fuses · 'stream' a sweeping line · 'eye' a watching shard · 'curtain' the signature
	const ATTACKS = {
		lance: {
			name: 'Precision Lance', role: 'A', source: 'authored', tier: 1, phases: [ 1, 1, 0.8 ],
			tree: () => atFoe(raw(70, comp(9, 'lance', toCursor()))),
			range: [ 200, 1300 ], prep: 0.1, telegraph: 0.5, recovery: 0.35, cooldown: 1.6, bodies: 1, speed: 9, tele: 'line',
			response: 'Keep moving: it is aimed where you are going, so change direction or jump as the line locks.',
			counters: 'One narrow projectile; a change of direction after the line locks makes it miss. Punishes standing still and slow recovery.',
			fit: (G, c) => 1 + Math.min(1.6, c.pStill / 0.9) + (c.d > 700 ? 0.3 : 0)
		},
		volley: {
			name: 'Converging Volley', role: 'B', source: 'authored', tier: 1, phases: [ 1, 1, 1 ],
			// six arrows set in a ring around him (Divide circle, still), held 0.5 s, then all fly at one point
			tree: () => atFoe(raw(220, comp(4, 'arrow', N('divide', { count: 6, formation: 'circle', spacing: 150, motion: 'still' }, null,
				toCursor(null, L.d(0.5), N('discharge', { radius: 1.2 }, L.c('targetNear', { range: 60 }, 3))))))),
			range: [ 300, 1100 ], prep: 0.1, telegraph: 0.4, recovery: 0.5, cooldown: 4.5, bodies: 6, speed: 9, tele: 'mark', fireAt: 0.5, burstR: 1.2,
			response: 'They all meet at the marked point: leave it — sideways, or jump over the meeting point.',
			counters: 'All six converge on one point chosen when they launch; anywhere outside the mark is safe.',
			fit: (G, c) => 1 + G.model.jumpReg * 1.4 + (c.pAir ? 0.4 : 0)
		},
		orb: {
			name: 'Heavy Orb', role: 'F', source: 'authored', tier: 2, phases: [ 0.9, 0.8, 0.6 ],
			tree: () => atFoe(raw(480, comp(2, 'sphere', toCursor({ speedPct: 28 }, null, N('discharge', { radius: 1.6 }, L.c('targetNear', { range: 90 }, 6)))))),
			range: [ 250, 1200 ], prep: 0.2, telegraph: 0.9, recovery: 0.6, cooldown: 9, bodies: 1, speed: 2.5, tele: 'line', burstR: 1.6,
			response: 'Slow and huge: keep the drawn burst circle off you — walk away from it, or get past it.',
			counters: 'It moves at a third of your speed; it bursts only when within 90 px of you.',
			fit: (G, c) => 1 + (c.d > 500 ? 0.4 : 0) + G.model.closeFrac * 0.3
		},
		snare: {
			name: 'Watching Shard', role: 'H', source: 'authored', tier: 2, phases: [ 0.5, 1, 1 ],
			// a lance raised over him that waits for you to attack or cast (Wait Until "target attacks"), then strikes you
			tree: () => atFoe(raw(90, comp(8, 'lance', N('redirect', { toward: 'up', arrive: 'stop', speedPct: 50 }, null,
				N('redirect', { toward: 'target' }, L.c('targetAttacks', {}, 5)))))),
			range: [ 250, 1100 ], prep: 0.1, telegraph: 0.45, recovery: 0.3, cooldown: 11, bodies: 1, speed: 9, tele: 'eye', live: 5,
			response: 'While the shard watches, attacking or casting releases it at you — wait it out (5 s), or attack and dodge at once.',
			counters: 'It only reacts to you attacking or casting (the same thing a forge spell can see), and it flies straight at where you are then.',
			fit: (G, c) => 1 + Math.min(1.5, G.model.casts * 0.35)
		},
		crossfire: {
			name: 'Delayed Crossfire', role: 'C', source: 'authored', tier: 2, phases: [ 0, 1, 1 ],
			// three spikes raised to three heights; each fires at the cursor at its own moment (0.35 / 0.8 / 1.25 s)
			tree: () => atFoe(raw(240, comp(5, 'spike', N('split', { spread: 30 }, null,
				N('redirect', { toward: 'up', arrive: 'stop', speedPct: 40 }, null, toCursor(null, L.d(0.35))),
				N('redirect', { toward: 'up', arrive: 'stop', speedPct: 70 }, null, toCursor(null, L.d(0.8))),
				N('redirect', { toward: 'up', arrive: 'stop', speedPct: 100 }, null, toCursor(null, L.d(1.25))))))),
			range: [ 300, 1100 ], prep: 0.1, telegraph: 0.4, recovery: 0.5, cooldown: 6, bodies: 3, speed: 9, tele: 'fuse', fuses: [ 0.35, 0.8, 1.25 ],
			response: 'Three shots on three fuses: dodge each as its fuse runs out — dodging only the first is not enough.',
			counters: 'Each spike is aimed when its own fuse ends; a change of direction between fuses beats the next one.',
			fit: (G, c) => 1 + G.model.dodgeAway * 0.6 + (c.d > 500 ? 0.3 : 0)
		},
		stream: {
			name: 'Saturation Stream', role: 'E', source: 'authored', tier: 2, phases: [ 0, 1, 1 ],
			// Draw Out from his own reserve as a flow: a stream of arrows for 2.4 s that follows a lagging cursor
			tree: () => N('target', { kind: 'self' }, null, N('drawOut', { from: 'target', flow: 'flow', flowRate: 10, duration: 2.4, infAmount: 240 }, null,
				N('color', { color: 'gold' }, null, comp(3, 'arrow', toCursor())))),
			range: [ 450, 1600 ], prep: 0.15, telegraph: 0.5, recovery: 0.6, cooldown: 10, bodies: 22, speed: 9, tele: 'stream', sweep: 0.035, drawn: 240,
			response: 'The stream follows you slowly: keep running one way, or cut back through behind it.',
			counters: 'Its aim lags (it sweeps toward you); a steady run outpaces it. Long range only.',
			fit: (G, c) => 1 + G.model.farFrac * 1.6 + (c.d > 800 ? 0.4 : 0)
		},
		pursuit: {
			name: 'Branching Pursuit', role: 'G', source: 'authored', tier: 2, phases: [ 0, 1, 1 ],
			// one cast split in two: the first branch takes the escape you are on, the second the one you usually switch to
			tree: () => atFoe(raw(200, comp(5, 'arrow', N('split', { spread: 40 }, null, toCursor(null, L.d(0.45)), toCursor(null, L.d(0.9)))))),
			range: [ 280, 1000 ], prep: 0.1, telegraph: 0.45, recovery: 0.45, cooldown: 7, bodies: 2, speed: 9, tele: 'fuse', fuses: [ 0.45, 0.9 ], branchAim: true,
			response: 'Two arrows covering two escapes: the first where you are heading, the second where you tend to dodge to. Break your habit.',
			counters: 'The second branch reads your usual dodge (toward / away / up). Do something else, or stand your ground between them.',
			fit: (G, c) => 1 + Math.abs(G.model.dodgeBias) * 1.2 + G.model.jumpReg * 0.4
		},
		nova: {
			name: 'Expanding Burst', role: 'D', source: 'authored', tier: 2, phases: [ 0.6, 1, 1 ],
			// a dense core held at him; after 0.7 s it is expanded (Compress −5) and discharged: a wide burst around him
			tree: () => atFoe(raw(260, comp(6, 'sphere', N('anchor', { state: 'anchored' }, null, N('compress', { power: -5, shape: 'keep' }, L.d(0.7), N('discharge', { radius: 2.2 })))))),
			range: [ 0, 320 ], prep: 0.05, telegraph: 0.45, recovery: 0.55, cooldown: 7, bodies: 1, speed: 0, tele: 'ring', burstR: 2.2, burstAt: 0.7,
			response: 'Get out of the drawn ring before it fills (about 1.1 s from the first glow).',
			counters: 'Only reaches the ring; he is rooted while it builds, so it is also an opening from outside the ring.',
			fit: (G, c) => (c.d < 320 ? 1.6 + G.model.closeFrac * 2 : 0)
		},
		ward: {
			name: 'Gilded Ward', role: 'I', source: 'authored', tier: 2, phases: [ 0.5, 0.8, 0.8 ],
			// raw energy reinforced into himself (≈ 28 % less damage for a while — the engine's ordinary rule, never
			// immunity) and a ring of six motes attached to him that burst outward after 3.5 s
			tree: () => N('target', { kind: 'self' }, null,
				N('generate', { amount: 120 }, null, N('reinforce', { portion: 100 })),
				N('generate', { amount: 220 }, null, N('color', { color: 'gold' }, null, N('divide', { count: 6, formation: 'circle', spacing: 100, motion: 'still' }, null,
					N('attach', { offset: 'keep' }, null, N('discharge', { radius: 1.0 }, L.c('spellAge', { time: 3.5 }, 5))))))),
			range: [ 0, 700 ], prep: 0.05, telegraph: 0.35, recovery: 0.4, cooldown: 18, bodies: 6, speed: 0, tele: 'ring', burstR: 1.0, burstAt: 3.5, self: true,
			response: 'Back off from the ring of motes before it bursts; his guard only blunts damage, so keep attacking from range.',
			counters: 'The motes burst at 3.5 s around him; the reinforcement lowers damage, it does not stop it.',
			fit: (G, c) => (G.recentHurt > 220 ? 1.8 : 0.4) + G.model.closeFrac * 1.2
		},
		lattice: {
			name: 'Lattice of Mines', role: 'K', source: 'authored', tier: 3, phases: [ 0, 0.8, 1 ],
			// one core carried to where you are heading (visible all the way), then divided there into a line of five mines
			// (Divide horizontal, still, 260 apart) and anchored; each arms for 0.35 s (a Lock rune used as a fuse), then
			// bursts if you come within 110 px. The gaps between them (≈ 260 px) are safe lanes.
			tree: () => atFoe(raw(300, comp(6, 'sphere', toCursor({ arrive: 'stop', speedPct: 80 }, null,
				N('divide', { count: 5, formation: 'horizontal', spacing: 260, motion: 'still' }, L.c('arrived', {}, 3),
					N('anchor', { state: 'anchored' }, null, N('lock', { prop: 'direction' }, L.d(0.35), N('discharge', { radius: 1.4 }, L.c('enemyNear', { range: 110 }, 9))))))))),
			range: [ 300, 1300 ], prep: 0.1, telegraph: 0.45, recovery: 0.5, cooldown: 14, bodies: 5, speed: 7, tele: 'mark', burstR: 1.4, mine: true,
			response: 'Mines settle in a line: stay in the lanes between them; do not walk into the drawn circles.',
			counters: 'They only burst when you come within 110 px; lanes of ≈ 100 px between bursts are always safe.',
			fit: (G, c) => 1 + G.model.farFrac * 0.4 + (G.model.stillish ? 0.4 : 0)
		},
		apex: {
			name: 'Absolute Output', role: 'J', source: 'authored', tier: 3, phases: [ 0, 0, 1 ],
			// a dense sphere raised over him and held 1.4 s; then split three ways: a fast lance at you, a ring of eight
			// shards flung outward, and a slow core that bursts when it reaches you
			tree: () => atFoe(raw(300, comp(6, 'sphere', N('redirect', { toward: 'up', arrive: 'stop', speedPct: 40 }, null, N('split', { spread: 0 }, L.d(1.4),
				comp(6, 'lance', toCursor()),
				N('divide', { count: 8, formation: 'circle', spacing: 60, motion: 'outward' }),
				toCursor({ speedPct: 35 }, null, N('discharge', { radius: 2.0 }, L.c('targetNear', { range: 100 }, 5)))))))),
			range: [ 250, 1300 ], prep: 0.3, telegraph: 1.0, recovery: 0.9, cooldown: 16, bodies: 10, speed: 9, tele: 'apex', fireAt: 1.4, burstR: 2.0,
			response: 'A long, loud wind-up: when the sphere splits, sidestep the lance, slip between the ring shards and outrun the slow core.',
			counters: 'Everything leaves from one point over his head after a 1.4 s hold; he is rooted for all of it — the best opening to punish.',
			fit: (G, c) => 1.3
		},
		signature: {
			name: 'Blooming Line', role: 'L', source: 'RD-0099', tier: 3, phases: [ 0, 0.6, 1.2 ],
			// the discovered tree, unchanged (see DISCOVERED)
			tree: () => discovered('RD-0099'),
			range: [ 380, 1200 ], prep: 0.2, telegraph: 0.7, recovery: 0.7, cooldown: 12, bodies: 5, speed: 9, tele: 'curtain', burstR: 1.4, bloom: 110,
			response: 'Five small discs in a line that swell into wide bursts when they reach you: get out of the drawn bloom circles — sideways, or over the line.',
			counters: 'Each disc only blooms within 110 px of you; the circles drawn round each disc are the real burst size.',
			fit: (G, c) => 1 + G.model.dodgeAway * 0.5 + (c.d > 500 ? 0.3 : 0)
		},
		minefall: {
			name: 'Waiting Mines', role: 'H', source: 'RD-0234', tier: 2, phases: [ 0, 0.7, 0.7 ],
			tree: () => discovered('RD-0234'),
			range: [ 300, 1000 ], prep: 0.1, telegraph: 0.45, recovery: 0.45, cooldown: 12, bodies: 3, speed: 7, tele: 'mark', burstR: 1.8, mine: true,
			response: 'Three mines settle where you were heading and wait: change course, and never run back through them.',
			counters: 'They only burst within 120 px; a change of direction before they land leaves them behind you.',
			fit: (G, c) => 1 + G.model.dodgeAway * 0.8
		}
	};
	/* sequences: attacks that work together, with the gaps between them (phase 2 and 3) */
	const SEQUENCES = {
		pinAndLance: { name: 'Pin and Lance', phases: [ 0, 1, 1 ], steps: [ 'lattice', { wait: 0.6 }, 'lance' ], cooldown: 16 },
		crossAndVolley: { name: 'Crossfire into Volley', phases: [ 0, 0.8, 1 ], steps: [ 'crossfire', { wait: 1.0 }, 'volley' ], cooldown: 15 },
		pressure: { name: 'Pressure', phases: [ 0, 0, 1 ], steps: [ 'lattice', { wait: 0.5 }, 'stream' ], cooldown: 20 },
		bloomChase: { name: 'Bloom and Chase', phases: [ 0, 0, 1 ], steps: [ 'signature', { wait: 0.8 }, 'pursuit' ], cooldown: 18 }
	};

	/* =========================== POLICY: no technique, ever =========================== */
	const ALLOWED_RUNES = { target: 1, generate: 1, color: 1, compress: 1, divide: 1, split: 1, redirect: 1, anchor: 1, attach: 1, discharge: 1, drawOut: 1, reinforce: 1, rotate: 1, lock: 1 };
	const ALLOWED_TARGETS = { enemy: 1, self: 1, anchorState: 1 };      // nothing that could grab another caster's energy
	const ALLOWED_CONDS = { arrived: 1, targetNear: 1, enemyNear: 1, travelled: 1, spellAge: 1, targetAttacks: 1, targetMoving: 1, stopped: 1, casterFar: 1, targetFar: 1, spellHit: 1 };
	const policy = {
		profile: null,
		/* the static check: returns null (allowed) or the reason it is refused */
		check(def){
			if(!def || !def.nodes) return 'no spell';
			for(const id in def.nodes){
				const n = def.nodes[id], p = n.params || {};
				if(!ALLOWED_RUNES[n.type]) return 'rune not allowed: ' + n.type;
				if(n.type === 'target'){
					if(!ALLOWED_TARGETS[p.kind]) return 'target kind not allowed: ' + p.kind;
					if(p.kind === 'anchorState' && (p.astate === 'infinity' || p.select !== 'thisSpell')) return 'anchor-state target must be this spell and not Infinity';
					if(p.techFilter && p.techFilter !== 'any') return 'technique filter on a target';
				}
				if(n.type === 'drawOut'){
					// Draw Out only from his own reserve (target: self) — never from another caster's energy or the world
					const par = def.nodes[n.parent];
					if(!par || par.type !== 'target' || par.params.kind !== 'self') return 'Draw Out not from himself';
				}
				if(n.type === 'reinforce'){
					const par = def.nodes[n.parent];
					if(!par || par.type !== 'generate') return 'reinforcement must be fresh raw energy';
				}
				const lk = n.link;
				if(lk && lk.mode === 'condition' && lk.cond && !ALLOWED_CONDS[lk.cond.type]) return 'condition not allowed: ' + lk.cond.type;
				for(const k in p) if(/^(thermal|spatial|gravity|kinetic|light|antimagic|infinity|construction)_/.test(k)) return 'technique parameter: ' + k;
			}
			const rep = ME.validate(def, policy.profile);
			if(!rep.ok) return 'invalid: ' + (rep.errors[0] ? rep.errors[0].code + ' ' + rep.errors[0].text : '?');
			if(Object.keys(rep.techniques || {}).length) return 'uses a technique: ' + Object.keys(rep.techniques).join(', ');
			if(rep.peakOutput > policy.profile.maxOutput) return 'peak output ' + Math.round(rep.peakOutput) + ' > Max Output ' + policy.profile.maxOutput;
			if(rep.upfront > policy.profile.maxEnergy) return 'costs more than his reserve';
			return null;
		},
		/* the runtime scan: everything he owns, every frame. Returns what it had to correct. */
		scan(m, w){
			const G = m.GA, id = m.owner.id;
			let fixed = 0;
			for(const b of w.bodies){
				if(!b.alive || b.ownerId !== id) continue;
				G.audit.bodiesSeen++;
				const bad = (b.tech && Object.keys(b.tech).some(k => Math.abs(b.tech[k]) > 0)) || b.technique || b.infSource || b.infDerived || b.spatial || b.rupture || b.focus;
				if(!bad){ b._gaSeen = true; continue; }
				const what = b.tech ? Object.keys(b.tech).filter(k => Math.abs(b.tech[k]) > 0).join('+') : (b.infSource ? 'infinity' : b.spatial ? 'spatial' : b.rupture ? 'rupture' : 'technique');
				// whose doing: energy that is already technique-bearing the first time the scan sees it came out of his own
				// cast (a policy failure); energy that was raw when first seen and changed later had it done to it from outside
				const own = !b._gaSeen;
				b._gaSeen = true;
				if(own) G.audit.ownViolations.push({ t: m.t, what, key: m.instKey[b.inst] || '?' }); else G.audit.stripped.push({ t: m.t, what });
				b.tech = null; b.technique = null; b.focus = null; b.lightBounces = null; b.infSource = null; b.infDerived = false; b.infStress = 0;
				if(b.spatial){ b.spatial = null; b.immovable = false; b.noContact = false; b.keepEnergy = false; b.hideBody = false; }
				if(b.rupture){ b.amount = 0; try { w.T.kill(b, 'fade'); } catch(e){ b.alive = false; } }
				fixed++;
			}
			// reinforcements on him: raw only (an Infinity layer or a technique would be removed)
			if(w.reinf) for(let i = w.reinf.length - 1; i >= 0; i--){
				const st = w.reinf[i];
				if(st.ownerId !== id && st.ref !== m) continue;
				if(st.inf > 0 || (st.tech && Object.keys(st.tech).length)){ w.reinf.splice(i, 1); G.audit.stripped.push({ t: m.t, what: 'reinforcement' }); fixed++; }
			}
			// constructs and domains are techniques' work: he never keeps one
			for(const c of w.constructs || []) if(c.alive && c.ownerId === id){ c.alive = false; G.audit.ownViolations.push({ t: m.t, what: 'construct' }); fixed++; }
			for(const D of w.domains || []) if(D.alive && D.ownerId === id){ D.alive = false; G.audit.ownViolations.push({ t: m.t, what: 'domain' }); fixed++; }
			return fixed;
		}
	};

	/* =========================== registration =========================== */
	const KIND = {
		id: 'arcanist', name: 'The Grand Arcanist', title: 'Master of Raw Magic', boss: true, color: '#ffd98a', robe: '#1c1a24', trim: '#e9c46a', hp: CONFIG.hp,
		techniques: [ 'No techniques — raw energy only' ],
		stats: { magicControl: CONFIG.stats.magicControl, magicPower: CONFIG.stats.magicPower, allocations: {} },
		mana: CONFIG.reserve, regen: CONFIG.regen, range: CONFIG.range[0], speed: CONFIG.speed, jump: CONFIG.jump,
		react: CONFIG.react, dodge: 0, aimErr: CONFIG.aimErr, think: CONFIG.rest[0], dmgScale: CONFIG.dmgScale,
		blurb: 'ENDGAME BOSS. Uses no technique at all — only raw energy, handled with absolute precision: compressed lances, converging volleys, staged crossfire, Draw Out streams, mines, expanding bursts and a finisher of pure output. Three phases.',
		spells: {}, custom: null
	};
	const rejected = {};
	function register(){
		policy.profile = ME.deriveProfile({ magicControl: CONFIG.stats.magicControl, magicPower: CONFIG.stats.magicPower, maxMana: CONFIG.reserve });
		policy.profile.allocations = {}; policy.profile.techniquePoints = 0;
		for(const key in ATTACKS){
			const A = ATTACKS[key];
			const t = A.tree();
			if(!t){ rejected[key] = 'tree unavailable (' + A.source + ')'; continue; }
			const def = t.nodes ? t : build(A.name, t);
			def.name = A.name;
			const why = policy.check(def);
			if(why){ rejected[key] = why; continue; }
			A.def = def;
			KIND.spells[key] = { name: A.name, cd: 0, wind: 0, tree: null, def };
		}
	}
	/* =========================== the mind =========================== */
	let IN = null;      // RuneMages.INTERNAL
	const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
	const cxm = (e) => e.x + e.w / 2, cym = (e) => e.y + e.h / 2;
	function init(m, internal){
		IN = internal;
		const Z = CONFIG.size;
		m.x = cxm(m) - Z.w / 2; m.y = m.y + m.h - Z.h; m.w = Z.w; m.h = Z.h;
		m.maxHp = m.hp = m.lastHp = CONFIG.hp;
		m.mana = m.maxMana = CONFIG.reserve;
		// the book: his checked defs (RuneMages' cast() reads m.book.spells[key])
		m.book = { profile: policy.profile, errors: Object.keys(rejected).map(k => k + ': ' + rejected[k]), spells: {} };
		for(const key in ATTACKS){
			const A = ATTACKS[key]; if(!A.def) continue;
			const rep = ME.validate(A.def, policy.profile);
			m.book.spells[key] = { key, name: A.name, cd: 0, wind: 0, def: A.def, ok: true, cost: rep.upfront, runes: rep.runeCount, peak: rep.peakOutput };
		}
		// his Draw Out spends his own reserve, unit for unit
		m.owner.drain = (amt) => { const got = Math.max(0, Math.min(m.mana - 1, amt)); m.mana -= got; m.GA.drained += got; return got; };
		m.isBoss = true;
		m.GA = {
			phase: 1, state: 'intro', t: 0, act: null, seq: null, rest: 1.4, cd: {}, seqCd: {}, used: {}, lastUse: {}, history: [],
			model: { jumps: [], jumpReg: 0, closeFrac: 0, farFrac: 0, casts: 0, castT: [], dodgeBias: 0, dodgeAway: 0, stillish: false, wasGround: true, wasCasting: false, watch: null },
			recentHurt: 0, hurtLog: [], prevHp: m.hp, audit: { bodiesSeen: 0, ownViolations: [], stripped: [], castRefusals: [] },
			fx: [], drained: 0, decisions: [], transitions: [], interrupts: 0, refusedBusy: 0, errors: 0, cursor: null, introT: 1.2
		};
		say(m, 'The Grand Arcanist', '#ffd98a');
	}
	function say(m, text, col){ IN.label(m, text); const env = IN.env(); if(env && env.say) env.say(cxm(m), m.y - 40, text, col || '#ffe7b0'); }

	/* --- what he has seen you do (only things anyone watching could see) --- */
	function observe(m, c, dt){
		const G = m.GA, M = G.model, S = c.S;
		// jumps: leaving the ground fast upward
		if(M.wasGround && !S.ground && S.vy < -5) M.jumps.push(m.t);
		M.wasGround = S.ground;
		while(M.jumps.length && M.jumps[0] < m.t - 10) M.jumps.shift();
		if(M.jumps.length >= 3){
			const iv = []; for(let i = 1; i < M.jumps.length; i++) iv.push(M.jumps[i] - M.jumps[i - 1]);
			const mu = iv.reduce((a, b) => a + b, 0) / iv.length, sd = Math.sqrt(iv.reduce((a, b) => a + (b - mu) * (b - mu), 0) / iv.length);
			M.jumpReg = clamp(1 - (sd / Math.max(0.1, mu)) * 2, 0, 1) * Math.min(1, M.jumps.length / 5);
		} else M.jumpReg *= 0.995;
		// how you keep your distance (a few seconds' memory)
		const k = dt / 5;
		M.closeFrac += ((c.d < 260 ? 1 : 0) - M.closeFrac) * k;
		M.farFrac += ((c.d > 760 ? 1 : 0) - M.farFrac) * k;
		M.stillish = c.pStill > 1.0;
		// attacks and casts (rising edges)
		if(c.pCasting && !M.wasCasting) M.castT.push(m.t);
		M.wasCasting = c.pCasting;
		while(M.castT.length && M.castT[0] < m.t - 10) M.castT.shift();
		M.casts = M.castT.length;
		// how you dodge: in the 0.8 s after one of his projectiles leaves, which way do you go?
		if(M.watch && m.t - M.watch.t > 0.8){
			const dx = S.x - M.watch.x, away = Math.sign(dx) === Math.sign(M.watch.x - cxm(m)) ? 1 : -1;
			const up = M.watch.y - S.y > 60;
			const v = Math.abs(dx) < 40 ? 0 : away;
			M.dodgeBias += ((up ? 0 : v) - M.dodgeBias) * 0.3;
			M.dodgeAway += ((v > 0 ? 1 : 0) - M.dodgeAway) * 0.3;
			M.dodgeUp = (M.dodgeUp || 0) + ((up ? 1 : 0) - (M.dodgeUp || 0)) * 0.3;
			M.watch = null;
		}
		// damage taken lately
		if(m.hp < G.prevHp) G.hurtLog.push({ t: m.t, d: G.prevHp - m.hp });
		G.prevHp = m.hp;
		while(G.hurtLog.length && G.hurtLog[0].t < m.t - 4) G.hurtLog.shift();
		G.recentHurt = G.hurtLog.reduce((s, h) => s + h.d, 0);
	}

	/* --- his own energy on the field --- */
	function ownCount(m){
		const w = IN.world(); if(!w) return { bodies: 0, inst: 0, nearYou: 0 };
		let bodies = 0, nearYou = 0;
		const p = IN.player(), px = p ? cxm(p) : 0, py = p ? cym(p) : 0;
		for(const b of w.bodies){ if(!b.alive || b.ownerId !== m.owner.id) continue; bodies++; if(p && Math.hypot(b.x - px, b.y - py) < 260) nearYou++; }
		const inst = w.instances.filter(i => !i.done && i.owner && i.owner.id === m.owner.id).length;
		return { bodies, inst, nearYou };
	}

	/* --- aim: where the energy should meet you. Leads what he SAW (late), never your inputs. --- */
	function leadFor(m, c, flight){
		const S = (m.ctx && m.ctx.S) || c.S;
		const P = IN.lead(S, flight);
		const e = IN.noisy(m, P, 0.5);
		return { x: e.x, y: Math.min(e.y, IN.groundY() - 26) };
	}
	function flightTime(m, c, A){ return A.speed > 0 ? c.d / A.speed / 60 : 0; }
	function aimFn(m, c, key){
		const A = ATTACKS[key];
		const base = (age) => { const cc = m.ctx || c; return leadFor(m, cc, flightTime(m, cc, A) + Math.max(0, (A.fireAt || 0) - age)); };
		if(key === 'stream'){
			// a lagging cursor that sweeps toward you
			let cur = null;
			return (age) => { const cc = m.ctx || c, tgt = leadFor(m, cc, 0.2); if(!cur) cur = { x: tgt.x - Math.sign(tgt.x - cxm(m)) * 160, y: tgt.y }; cur.x += (tgt.x - cur.x) * A.sweep; cur.y += (tgt.y - cur.y) * A.sweep; m.GA.cursor = cur; return cur; };
		}
		if(key === 'pursuit'){
			// branch 1 (0.45 s): where you are going; branch 2 (0.9 s): where you usually dodge to from there
			return (age) => {
				const cc = m.ctx || c, S = cc.S, M = m.GA.model;
				if(age < 0.65) return base(age);
				const T = flightTime(m, cc, A);
				const toward = Math.sign(cxm(m) - S.x) || 1;
				const habit = M.dodgeBias >= 0 ? -toward : toward;      // away from him, or toward him
				const p = { x: S.x + habit * IN.clamp(Math.abs(S.vx) * 60 * T, 120, 260), y: (M.dodgeUp || 0) > 0.5 ? S.y - 90 : S.y };
				return { x: clamp(p.x, 40, IN.worldW() - 40), y: Math.min(p.y, IN.groundY() - 26) };
			};
		}
		if(key === 'lattice' || key === 'minefall'){
			// the mines go where you are heading, a little ahead
			let fixed = null;
			return (age) => { if(!fixed){ const cc = m.ctx || c; fixed = leadFor(m, cc, 0.5); fixed.y = IN.groundY() - 30; } return fixed; };
		}
		return base;
	}

	/* --- choosing what to do: a utility score per attack --- */
	function phaseWeight(A, ph){ return A.phases[ph - 1] || 0; }
	function scoreAttack(m, c, key){
		const G = m.GA, A = ATTACKS[key], ph = G.phase;
		if(!A.def) return 0;
		const w0 = phaseWeight(A, ph); if(!(w0 > 0)) return 0;
		if((G.cd[key] || 0) > 0) return 0;
		const sp = IN.spellOf(m, key); if(!sp) return 0;
		const drawCost = A.drawn || 0;
		if(m.mana - sp.cost - drawCost < CONFIG.reserveFloor) return 0;      // affordable, with a floor kept back
		// range fit: full inside the band, falling off outside
		const [lo, hi] = A.range;
		let rf = c.d < lo ? clamp(1 - (lo - c.d) / 200, 0, 1) : c.d > hi ? clamp(1 - (c.d - hi) / 300, 0, 1) : 1;
		if(!(rf > 0)) return 0;
		// redundancy: his energy is already pressing you — prefer setups, avoid stacking more shots
		const own = G.own || { bodies: 0, nearYou: 0 };
		if(own.bodies + (A.bodies || 1) > CONFIG.maxBodies) return 0;
		let red = 1;
		if(own.nearYou > 2 && !A.self && !A.mine) red = 0.45;
		// recently seen: a used attack is less interesting for a while
		const since = m.t - (G.lastUse[key] != null ? G.lastUse[key] : -99);
		const seen = 1 - 0.55 * Math.pow(0.5, since / CONFIG.repeatHalfLife);
		// risk: a long, rooted cast with you right next to him
		const risk = (A.telegraph + (A.fireAt || 0) > 1 && c.d < 220) ? 0.5 : 1;
		let fit = 1; try { fit = A.fit(G, c); } catch(e){}
		const tier = A.tier === 3 ? (ph === 3 ? 1.25 : 0.7) : 1;
		return w0 * rf * fit * red * seen * risk * tier;
	}
	function choose(m, c){
		const G = m.GA, ph = G.phase, opts = [];
		for(const key in ATTACKS){ const s = scoreAttack(m, c, key); if(s > 0) opts.push({ key, s }); }
		// sequences (phase 2+): scored by their first attack, plus a bonus for chaining
		for(const k in SEQUENCES){
			const Q = SEQUENCES[k]; if(!(Q.phases[ph - 1] > 0) || (G.seqCd[k] || 0) > 0) continue;
			const first = Q.steps[0]; const s = scoreAttack(m, c, first);
			const allOk = Q.steps.every(st => typeof st !== 'string' || (ATTACKS[st].def && (G.cd[st] || 0) <= 0));
			if(s > 0 && allOk) opts.push({ key: k, seq: true, s: s * 1.15 * Q.phases[ph - 1] });
		}
		if(!opts.length) return null;
		opts.sort((a, b) => b.s - a.s);
		const top = opts.slice(0, CONFIG.topK);
		const mx = top[0].s, ws = top.map(o => Math.exp((o.s - mx) / Math.max(0.05, CONFIG.temperature * mx)));
		const tot = ws.reduce((a, b) => a + b, 0);
		let r = Math.random() * tot, pick = top[0];
		for(let i = 0; i < top.length; i++){ r -= ws[i]; if(r <= 0){ pick = top[i]; break; } }
		G.decisions.push({ t: +m.t.toFixed(2), phase: ph, pick: pick.key, top: top.map(o => o.key + ':' + o.s.toFixed(2)), d: Math.round(c.d), still: +c.pStill.toFixed(1),
			jumpReg: +G.model.jumpReg.toFixed(2), close: +G.model.closeFrac.toFixed(2), far: +G.model.farFrac.toFixed(2), casts: G.model.casts, dodge: +G.model.dodgeBias.toFixed(2) });
		if(G.decisions.length > 400) G.decisions.shift();
		return pick;
	}

	/* --- running an attack: prep → telegraph (rooted, visible) → cast → recovery --- */
	function startAttack(m, c, key){
		const G = m.GA, A = ATTACKS[key];
		G.lastStart = G.lastStart || {}; G.lastStart[key] = m.t;
		const tel = Math.max(CONFIG.minTelegraph, A.telegraph * CONFIG.telegraphMul);
		G.act = { key, t: 0, prep: A.prep, tel, fired: false, inst: null, aim: aimFn(m, c, key), rec: A.recovery * CONFIG.recoveryMul[G.phase - 1] };
		G.used[key] = (G.used[key] || 0) + 1;
		G.lastUse[key] = m.t;
		IN.label(m, A.name);
		if(A.tier === 3) chime(m, A.tele === 'apex' ? 'big' : 'mid');
	}
	function fire(m, c){
		const G = m.GA, a = G.act, A = ATTACKS[a.key];
		const w = IN.world();
		// the policy, again, at the moment of casting: his tree must still pass
		const why = policy.check(A.def);
		if(why){ G.audit.castRefusals.push({ t: m.t, key: a.key, why }); return false; }
		const own = ownCount(m);
		if(own.inst >= CONFIG.maxInstances || own.bodies + (A.bodies || 1) > CONFIG.maxBodies){ G.refusedBusy++; return false; }
		const inst = IN.cast(m, a.key, a.aim, 0.6);
		if(!inst){ G.audit.castRefusals.push({ t: m.t, key: a.key, why: m.lastErr || 'cast failed' }); return false; }
		a.inst = inst;
		G.cd[a.key] = A.cooldown * CONFIG.cooldownMul * (G.phase >= 3 ? 0.85 : 1);
		// what he will watch for: how you dodge this one
		if(A.speed > 0 && !A.self){ const S = (m.ctx || c).S; G.model.watch = { t: m.t, x: S.x, y: S.y }; }
		return true;
	}
	function runAttack(m, c, dt){
		const G = m.GA, a = G.act;
		a.t += dt;
		const fireT = a.prep + a.tel;
		if(!a.fired && a.t >= fireT){
			a.fired = true;
			if(!fire(m, c)){ G.act = null; G.rest = 0.3; return; }
		}
		if(a.fired && a.t >= fireT + a.rec){ G.act = null; nextStep(m); }
	}
	function nextStep(m){
		const G = m.GA, ph = G.phase;
		if(G.seq){
			G.seq.i++;
			const st = G.seq.steps[G.seq.i];
			if(st != null){ if(typeof st === 'object'){ G.seq.wait = st.wait; } return; }
			G.seq = null;
		}
		const R = CONFIG.rest[ph - 1];
		G.rest = R[0] + Math.random() * (R[1] - R[0]);
	}
	function cancel(m, why){
		const G = m.GA;
		if(G.act && !G.act.fired){ G.interrupts++; if(why) say(m, why, '#ffb0a0'); }
		G.act = null; G.seq = null; G.rest = 0.6;
	}

	/* --- phases --- */
	function checkPhase(m){
		const G = m.GA, f = m.hp / m.maxHp;
		const to = f <= CONFIG.phase3 ? 3 : f <= CONFIG.phase2 ? 2 : 1;
		if(to <= G.phase) return;
		G.phase = to;
		G.state = 'transition'; G.trT = 0;
		G.act = null; G.seq = null;
		// every spell of his still on the field ends harmlessly (no orphaned energy, nothing lands during the shift)
		const w = IN.world(); if(w) try { w.clearOwner(m.owner.id); } catch(e){}
		G.transitions.push({ t: +m.t.toFixed(2), to, hp: Math.round(m.hp) });
		G.fx.push({ k: 'shift', t: 0, life: CONFIG.transition });
		say(m, to === 2 ? 'Phase II — Multi-branch Control' : 'Phase III — Absolute Output', to === 2 ? '#ffe7b0' : '#ffffff');
		chime(m, 'phase');
		const env = IN.env(), h = env && env.host && env.host(); if(h && h.shake) h.shake(5);
	}

	/* --- tidy: his loose energy does not linger (a shard that missed, a mine nobody came near) --- */
	function tidy(m, w){
		for(const b of w.bodies){
			if(!b.alive || b.ownerId !== m.owner.id) continue;
			const key = m.instKey[b.inst] || '';
			const A = ATTACKS[key];
			const life = A && A.mine ? CONFIG.mineAge : A && A.live ? A.live + 1.5 : CONFIG.tidyAge;
			if(b.age > life || !(isFinite(b.x) && isFinite(b.y)) || (IN.env().worldW && (b.x < -300 || b.x > IN.worldW() + 300 || b.y > IN.groundY() + 300 || b.y < -2400))){
				b.amount = 0; try { w.T.kill(b, 'fade'); } catch(e){ b.alive = false; }
			}
		}
	}

	/* --- movement: keeps his distance, rooted while he casts; no teleport, no flight --- */
	function move(m, c, dt){
		const G = m.GA, ph = G.phase;
		const [lo, hi] = CONFIG.range[ph - 1];
		const a = G.act;
		const rooted = (a && (!a.fired || a.t < a.prep + a.tel + 0.15)) || G.state === 'transition';
		const slow = a && a.fired ? 0.4 : 1;
		let goal = 0;
		if(!rooted){
			if(c.absDx > hi) goal = c.dir;
			else if(c.absDx < lo) goal = -c.dir;
			else { G.strafeT = (G.strafeT || 0) - dt; if(G.strafeT <= 0){ G.strafe = Math.random() < 0.5 ? -1 : 1; G.strafeT = 0.6 + Math.random() * 0.8; } goal = G.strafe * 0.35; }
			if(c.edge < 260) goal = cxm(m) < IN.worldW() / 2 ? 1 : -1;
			// you stand on a ledge above him: he climbs after you now and then
			if(c.pAbove && m.onGround && Math.random() < 0.01 && m.jumpCd <= 0){ m.vy = -CONFIG.jump; m.jumpCd = 1.5; }
		}
		// your spells coming at him: he reads them a moment late and, not always, steps or jumps out of the way
		if(!rooted && c.threat && c.threat.length && (G.evadeCd || 0) <= 0){
			const th = c.threat[0];
			if(th.eta < 0.5){
				G.evadeCd = 0.9;
				if(Math.random() < CONFIG.evade){
					G.evades = (G.evades || 0) + 1;
					if(m.onGround && Math.abs(th.b.y - cym(m)) < 50 && Math.random() < 0.6){ m.vy = -CONFIG.jump; m.jumpCd = 1.0; }
					else { const side = Math.sign(cxm(m) - th.b.x) || 1; m.vx = side * CONFIG.speed * 1.6; goal = side; }
				}
			}
		}
		if(G.evadeCd > 0) G.evadeCd -= dt;
		const spd = CONFIG.speed * (ph >= 3 ? 1.12 : 1) * slow * (m.slowTimer > 0 ? 0.6 : 1);
		m.vx += (goal * spd - m.vx) * (rooted ? 0.35 : 0.18);
		if(rooted) m.vx *= 0.8;
		if(Math.abs(c.dx) > 8) m.facing = c.dir;
		return false;      // he never hovers
	}

	/* --- the frame (called by RuneMages.update) --- */
	function frame(m, p, c, dt){
		const G = m.GA, w = IN.world();
		G.t += dt;
		for(const k in G.cd) if(G.cd[k] > 0) G.cd[k] -= dt;
		for(const k in G.seqCd) if(G.seqCd[k] > 0) G.seqCd[k] -= dt;
		if(w){
			policy.scan(m, w);
			tidy(m, w);
		}
		G.own = ownCount(m);
		if(!p || !c) return false;
		const env = IN.env();
		// you are down: he lets his spells go and waits (no damage on a fallen player)
		if(env.playerHp && env.playerHp() <= 0){
			if(!G.idle){
				G.idle = true; cancel(m); if(w) try { w.clearOwner(m.owner.id); } catch(e){}
				if(CONFIG.resetOnPlayerDeath){
					m.hp = m.lastHp = m.maxHp; m.mana = m.maxMana; G.phase = 1; G.cd = {}; G.seqCd = {}; G.state = 'intro'; G.introT = 2.5; G.resets = (G.resets || 0) + 1;
					say(m, 'You are not ready.', '#ffd98a');
				}
			}
			return false;
		}
		G.idle = false;
		observe(m, c, dt);
		checkPhase(m);
		// stunned (your magic or blows can do it): the gathering is broken — an interrupt
		if(m.stunTimer > 0){ if(G.act && !G.act.fired){ cancel(m, 'Interrupted!'); G.poise = CONFIG.poise; } return move(m, c, dt); }
		if(G.state === 'intro'){ G.introT -= dt; if(G.introT <= 0) G.state = 'fight'; return move(m, c, dt); }
		if(G.state === 'transition'){ G.trT += dt; if(G.trT >= CONFIG.transition){ G.state = 'fight'; G.rest = 0.4; } return move(m, c, dt); }
		if(G.act) runAttack(m, c, dt);
		else if(G.seq){
			const st = G.seq.steps[G.seq.i];
			if(G.seq.wait > 0){ G.seq.wait -= dt; if(G.seq.wait <= 0) nextStep(m); }
			else if(typeof st === 'string'){ if(scoreAttack(m, c, st) > 0 || ATTACKS[st].range[0] <= c.d) startAttack(m, c, st); else { G.seq = null; G.rest = 0.3; } }
			else nextStep(m);
		} else if(!G.manual){
			G.rest -= dt;
			if(G.rest <= 0){
				const pick = choose(m, c);
				if(!pick) G.rest = 0.3;
				else if(pick.seq){ const Q = SEQUENCES[pick.key]; G.seq = { key: pick.key, steps: Q.steps, i: 0, wait: 0 }; G.seqCd[pick.key] = Q.cooldown; G.used['seq:' + pick.key] = (G.used['seq:' + pick.key] || 0) + 1; startAttack(m, c, Q.steps[0]); }
				else startAttack(m, c, pick.key);
			}
		}
		return move(m, c, dt);
	}
	/* every frame before RuneMages moves him: poise against stun-lock (interrupts are real, but not back to back) */
	function pre(m){
		const G = m.GA; if(!G) return;
		if(G.poise > 0){ G.poise -= 1 / 60; m.stunTimer = 0; m._kbTimer = Math.min(m._kbTimer || 0, 2); }
		else m._kbTimer = Math.min(m._kbTimer || 0, CONFIG.kbCap);
	}
	function onDeath(m){ const G = m.GA; if(G){ G.act = null; G.seq = null; G.state = 'dead'; } chime(m, 'end'); }

	/* =========================== sound (a tiny synth: the game has no audio system of its own) =========================== */
	let AC = null;
	function chime(m, kind){
		if(typeof window === 'undefined' || !window.AudioContext && !window.webkitAudioContext) return;
		try {
			if(!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
			if(AC.state === 'suspended') AC.resume();
			const t0 = AC.currentTime;
			const tones = kind === 'phase' ? [ [ 110, 1.4, 0.18 ], [ 165, 1.2, 0.12 ], [ 220, 1.0, 0.08 ] ] : kind === 'big' ? [ [ 82, 1.6, 0.16 ], [ 123, 1.4, 0.1 ] ] : kind === 'end' ? [ [ 220, 1.8, 0.12 ], [ 330, 1.6, 0.08 ], [ 440, 1.4, 0.06 ] ] : [ [ 330, 0.5, 0.06 ] ];
			for(const [f, dur, vol] of tones){
				const o = AC.createOscillator(), g = AC.createGain();
				o.type = 'sine'; o.frequency.setValueAtTime(f, t0);
				if(kind === 'phase' || kind === 'big') o.frequency.exponentialRampToValueAtTime(f * 0.5, t0 + dur);
				g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
				o.connect(g); g.connect(AC.destination); o.start(t0); o.stop(t0 + dur + 0.05);
			}
		} catch(e){}
	}

	/* =========================== drawing =========================== */
	const GOLD = '#ffd98a', GOLD2 = '#e9c46a', IVORY = '#f4ecd8';
	function burstRadius(b, k){ return (ME.bodyRadius(b) * 2.6 + 28) * k; }      // the engine's own Discharge radius (magic-engine.js, discharge)
	function draw(ctx, m, camX, camY){
		const G = m.GA; if(!G) return;
		const a = m.dead ? Math.max(0, 1 - m.deathT / 1.4) : 1;
		const t = m.t, x = cxm(m) - camX, foot = m.y + m.h - camY, top = m.y - camY, f = m.facing || 1;
		const act = G.act, gather = CONFIG.showTelegraphs && act && !act.fired ? clamp((act.t - act.prep) / act.tel, 0, 1) : 0;      // no tell at all when telegraphs are off
		const ph = G.phase;
		ctx.save();
		ctx.globalAlpha = a;
		if(CONFIG.showTelegraphs) drawLiveTelegraphs(ctx, m, camX, camY);
		// the phase shift: a slow ring and a pause (no damage)
		for(let i = G.fx.length - 1; i >= 0; i--){
			const e = G.fx[i]; e.t += 1 / 60; if(e.t > e.life){ G.fx.splice(i, 1); continue; }
			const q = e.t / e.life;
			if(e.k === 'shift'){ ctx.strokeStyle = GOLD; ctx.lineWidth = 3 * (1 - q) + 1; ctx.globalAlpha = a * (1 - q); for(let k = 0; k < 3; k++){ ctx.beginPath(); ctx.arc(x, top + m.h * 0.45, 30 + q * 420 * (1 - k * 0.22), 0, Math.PI * 2); ctx.stroke(); } ctx.globalAlpha = a; }
		}
		// aura: restrained, brighter as he gathers, and in phase 3
		const glow = 0.18 + (CONFIG.showTelegraphs ? 0.5 * gather : 0) + (ph === 3 ? 0.15 : 0);
		const au = ctx.createRadialGradient(x, top + 40, 6, x, top + 40, 90 + 30 * gather);
		au.addColorStop(0, 'rgba(255,217,138,' + glow.toFixed(3) + ')'); au.addColorStop(1, 'rgba(255,217,138,0)');
		ctx.fillStyle = au; ctx.beginPath(); ctx.arc(x, top + 40, 90 + 30 * gather, 0, Math.PI * 2); ctx.fill();
		// drawn a head taller than his hitbox suggests (like Aster Vael): an imposing, narrow silhouette
		ctx.save(); ctx.translate(x, foot); ctx.scale(1.22, 1.22); ctx.translate(-x, -foot);
		const hi = m.flash > 0;
		// mantle: wide stiff shoulders that flare out behind him
		ctx.fillStyle = hi ? '#ffffff' : '#0f0d14';
		ctx.beginPath(); ctx.moveTo(x - 22, top + 30); ctx.quadraticCurveTo(x - 6, top + 10, x, top + 14); ctx.quadraticCurveTo(x + 6, top + 10, x + 22, top + 30);
		ctx.lineTo(x + 17 - f * 4, top + 62); ctx.lineTo(x - 17 - f * 4, top + 62); ctx.closePath(); ctx.fill();
		ctx.strokeStyle = GOLD2; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x - 22, top + 30); ctx.quadraticCurveTo(x - 6, top + 10, x, top + 14); ctx.quadraticCurveTo(x + 6, top + 10, x + 22, top + 30); ctx.stroke();
		// robe: a tall, narrow silhouette — dark, with ivory panels and gold rune bands
		const bob = m.onGround ? Math.sin(t * 7 * Math.min(1, Math.abs(m.vx) / 3)) * 1.2 : 0, sway = clamp(-m.vx * 1.6, -8, 8);
		ctx.fillStyle = hi ? '#ffffff' : '#1c1a24';
		ctx.beginPath(); ctx.moveTo(x - 9, top + 18 + bob); ctx.lineTo(x + 9, top + 18 + bob); ctx.lineTo(x + 20 + sway, foot); ctx.lineTo(x - 20 + sway, foot); ctx.closePath(); ctx.fill();
		ctx.fillStyle = hi ? '#ffffff' : IVORY;
		ctx.beginPath(); ctx.moveTo(x - 3, top + 22 + bob); ctx.lineTo(x + 3, top + 22 + bob); ctx.lineTo(x + 7 + sway * 0.6, foot - 2); ctx.lineTo(x - 7 + sway * 0.6, foot - 2); ctx.closePath(); ctx.fill();
		ctx.strokeStyle = GOLD2; ctx.lineWidth = 1.5;
		for(const k of [ 0.42, 0.62, 0.82 ]){ const yy = top + (foot - top) * k + bob * (1 - k), hw = 8 + 12 * k; ctx.beginPath(); ctx.moveTo(x - hw + sway * k, yy); ctx.lineTo(x + hw + sway * k, yy); ctx.stroke(); for(let j = -2; j <= 2; j++){ ctx.fillStyle = GOLD; ctx.fillRect(x + j * hw * 0.4 + sway * k - 1, yy - 3, 2, 2); } }
		// hood and mask: a deep hood with a pale, featureless mask and two gold eye-slits
		ctx.fillStyle = hi ? '#ffffff' : '#14121a';
		ctx.beginPath(); ctx.moveTo(x - 13, top + 22 + bob); ctx.quadraticCurveTo(x - 15, top - 4 + bob, x + f * 2, top - 8 + bob); ctx.quadraticCurveTo(x + 15, top - 2 + bob, x + 13, top + 22 + bob); ctx.closePath(); ctx.fill();
		ctx.fillStyle = '#e8e0cc'; ctx.beginPath(); ctx.ellipse(x + f * 3, top + 9 + bob, 6.5, 8.5, 0, 0, Math.PI * 2); ctx.fill();
		ctx.fillStyle = GOLD; ctx.shadowColor = GOLD; ctx.shadowBlur = 6 + 10 * gather; ctx.fillRect(x + f * 3 - 4, top + 7 + bob, 3, 1.6); ctx.fillRect(x + f * 3 + 1, top + 7 + bob, 3, 1.6); ctx.shadowBlur = 0;
		// arms: the forward hand reaches while he gathers; the energy forms there
		const hx = x + f * (14 + 10 * gather), hy = top + 36 - 10 * gather + bob;
		ctx.strokeStyle = hi ? '#fff' : '#1c1a24'; ctx.lineWidth = 6; ctx.lineCap = 'round';
		ctx.beginPath(); ctx.moveTo(x + f * 6, top + 24 + bob); ctx.lineTo(hx, hy); ctx.moveTo(x - f * 6, top + 24 + bob); ctx.lineTo(x - f * 12, top + 44 + bob); ctx.stroke();
		ctx.fillStyle = IVORY; ctx.beginPath(); ctx.arc(hx, hy, 3, 0, Math.PI * 2); ctx.fill();
		// orbiting rune plates (six; they glow with his reserve; in phase 3 they become a wide halo)
		const res = clamp(m.mana / m.maxMana, 0, 1), R0 = ph === 3 ? 34 : 24;
		for(let k = 0; k < 6; k++){
			const an = t * (ph === 3 ? 1.8 : 1.1) + k * Math.PI / 3, px = x + Math.cos(an) * R0, py = top + 4 + bob + Math.sin(an) * R0 * 0.45;
			ctx.fillStyle = k / 6 < res ? GOLD : '#5b5446'; ctx.globalAlpha = a * (0.55 + 0.45 * Math.sin(t * 3 + k));
			ctx.save(); ctx.translate(px, py); ctx.rotate(an); ctx.fillRect(-3, -2, 6, 4); ctx.restore();
		}
		ctx.globalAlpha = a;
		ctx.restore();
		// the gathering: energy condensing in the hand — size shows how much, the shape shows the attack
		const HX = x + (hx - x) * 1.22, HY = foot + (hy - foot) * 1.22;
		if(CONFIG.showTelegraphs && act && !act.fired) drawGather(ctx, m, act, HX, HY, gather, camX, camY);
		// name and the attack he is about to cast
		if(!m.dead){
			ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
			const topS = foot - (foot - top) * 1.22;
			ctx.fillStyle = '#000'; ctx.fillText(m.name, x + 1, topS - 25);
			ctx.fillStyle = GOLD; ctx.fillText(m.name, x, topS - 26);
			if(CONFIG.showTelegraphs && m.castNameT > 0){ ctx.globalAlpha = a * Math.min(1, m.castNameT / 20); ctx.font = 'italic 13px serif'; ctx.fillStyle = '#fff'; ctx.fillText('« ' + m.castName + ' »', x, topS - 42); ctx.globalAlpha = a; }
		}
		ctx.restore();
		if(!m.dead) drawBar(ctx, m);
	}
	/* the gather in his hand and the telegraph of the attack about to leave */
	function drawGather(ctx, m, act, hx, hy, q, camX, camY){
		const A = ATTACKS[act.key];
		const r = 3 + q * (A.tier === 3 ? 16 : 9);
		ctx.fillStyle = GOLD; ctx.shadowColor = GOLD; ctx.shadowBlur = 10 + 14 * q;
		ctx.beginPath(); ctx.arc(hx, hy, r, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
		// compression lines drawing in
		ctx.strokeStyle = 'rgba(255,217,138,0.7)'; ctx.lineWidth = 1;
		for(let k = 0; k < 6; k++){ const an = k * 1.047 + m.t * 5, rr = 30 * (1 - q) + r + 4; ctx.beginPath(); ctx.moveTo(hx + Math.cos(an) * rr, hy + Math.sin(an) * rr); ctx.lineTo(hx + Math.cos(an) * (rr + 6), hy + Math.sin(an) * (rr + 6)); ctx.stroke(); }
		const aim = act.aim ? act.aim(0) : null;
		if(!aim) return;
		const ax = aim.x - camX, ay = aim.y - camY;
		ctx.save();
		if(A.tele === 'line'){
			// the aim line, as wide as the projectile (the lance: thin; the orb: its burst circle at the end)
			ctx.globalAlpha = 0.25 + 0.55 * q; ctx.strokeStyle = GOLD; ctx.lineWidth = act.key === 'orb' ? 3 : 1.5; ctx.setLineDash([ 10, 8 ]);
			ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + (ax - hx) * 1.6, hy + (ay - hy) * 1.6); ctx.stroke(); ctx.setLineDash([]);
		} else if(A.tele === 'mark' || A.tele === 'curtain'){
			// (the signature's own circles are drawn round each disc once it flies — see drawLiveTelegraphs)
			ctx.globalAlpha = 0.3 + 0.5 * q; ctx.strokeStyle = GOLD; ctx.lineWidth = 2;
			// the real burst sizes, measured from the engine at load time (MEASURED)
			const R = MEASURED[act.key] || 46;
			if(act.key === 'lattice'){ for(let k = -2; k <= 2; k++){ ctx.beginPath(); ctx.arc(ax + k * 260, ay, MEASURED.lattice || 64, 0, Math.PI * 2); ctx.stroke(); } }
			else { ctx.beginPath(); ctx.arc(ax, ay, R * (1.3 - 0.3 * q), 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(ax - 10, ay); ctx.lineTo(ax + 10, ay); ctx.moveTo(ax, ay - 10); ctx.lineTo(ax, ay + 10); ctx.stroke(); }
		} else if(A.tele === 'ring'){
			// the burst radius (measured from the engine at load time)
			const R = MEASURED[act.key] || 160;
			ctx.globalAlpha = 0.2 + 0.6 * q; ctx.strokeStyle = '#fff2c6'; ctx.lineWidth = 2;
			ctx.beginPath(); ctx.arc(cxm(m) - camX, cym(m) - camY, R, 0, Math.PI * 2); ctx.stroke();
			ctx.globalAlpha = 0.08 + 0.12 * q; ctx.fillStyle = GOLD; ctx.fill();
		} else if(A.tele === 'apex'){
			ctx.globalAlpha = 0.25 + 0.5 * q; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
			const cxp = cxm(m) - camX, cyp = m.y - camY - 120 * q;
			ctx.beginPath(); ctx.arc(cxp, cyp, 18 + 30 * q, 0, Math.PI * 2); ctx.stroke();
			for(let k = 0; k < 8; k++){ const an = k * Math.PI / 4; ctx.beginPath(); ctx.moveTo(cxp + Math.cos(an) * 60, cyp + Math.sin(an) * 60); ctx.lineTo(cxp + Math.cos(an) * (60 + 40 * q), cyp + Math.sin(an) * (60 + 40 * q)); ctx.stroke(); }
			// screen-edge warning
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			const W0 = ctx.canvas.width, H0 = ctx.canvas.height, g = ctx.createRadialGradient(W0 / 2, H0 / 2, Math.min(W0, H0) * 0.35, W0 / 2, H0 / 2, Math.max(W0, H0) * 0.7);
			g.addColorStop(0, 'rgba(255,217,138,0)'); g.addColorStop(1, 'rgba(255,217,138,' + (0.25 * q).toFixed(3) + ')');
			ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(0, 0, W0, H0);
		} else if(A.tele === 'fuse' || A.tele === 'eye' || A.tele === 'stream'){
			ctx.globalAlpha = 0.3 + 0.5 * q; ctx.strokeStyle = GOLD; ctx.lineWidth = 1.5; ctx.setLineDash([ 4, 6 ]);
			ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(ax, ay); ctx.stroke(); ctx.setLineDash([]);
		}
		ctx.restore();
	}
	/* telegraphs of his spells already on the field: drawn from the live bodies, at their real sizes */
	function drawLiveTelegraphs(ctx, m, camX, camY){
		const w = IN.world(); if(!w) return;
		ctx.save();
		for(const b of w.bodies){
			if(!b.alive || b.ownerId !== m.owner.id || b.isZone) continue;
			const key = m.instKey[b.inst]; const A = ATTACKS[key]; if(!A) continue;
			const bx = b.x - camX, by = b.y - camY;
			if(A.mine && b.anchored){
				const R = burstRadius(b, A.burstR);
				ctx.globalAlpha = 0.35 + 0.15 * Math.sin(m.t * 6); ctx.strokeStyle = '#ffcf6b'; ctx.lineWidth = 1.5; ctx.setLineDash([ 6, 6 ]);
				ctx.beginPath(); ctx.arc(bx, by, R, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
			} else if(key === 'orb' || (key === 'apex' && b.amount > 60 && Math.hypot(b.vx, b.vy) < 4)){
				const R = burstRadius(b, A.burstR);
				ctx.globalAlpha = 0.3; ctx.strokeStyle = '#fff2c6'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bx, by, R, 0, Math.PI * 2); ctx.stroke();
			} else if(key === 'signature'){
				// each disc: the bloom it becomes (expanded, then discharged) — drawn as the radius it will have
				const R = (MEASURED.signature || 120);
				ctx.globalAlpha = 0.28; ctx.strokeStyle = '#fff2c6'; ctx.lineWidth = 1.5; ctx.setLineDash([ 3, 5 ]); ctx.beginPath(); ctx.arc(bx, by, R, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
			} else if(A.fuses && b.inst && !b.guided){
				const inst = w.instances.find(i => i.id === b.inst); if(!inst) continue;
				// a fuse ring that closes as its moment comes (staged pieces only, before they leave)
				const sp = Math.hypot(b.vx, b.vy); if(sp > 2) continue;
				const nextF = A.fuses.find(fz => fz > inst.age); if(nextF == null) continue;
				const q = clamp(1 - (nextF - inst.age) / 0.5, 0, 1);
				ctx.globalAlpha = 0.5; ctx.strokeStyle = GOLD; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bx, by, 22 - 12 * q, 0, Math.PI * 2); ctx.stroke();
			} else if(key === 'snare' && Math.hypot(b.vx, b.vy) < 1){
				const p = IN.player(); if(!p) continue;
				ctx.globalAlpha = 0.25 + 0.2 * Math.sin(m.t * 8); ctx.strokeStyle = '#ffb36b'; ctx.lineWidth = 1; ctx.setLineDash([ 2, 6 ]);
				ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(cxm(p) - camX, cym(p) - camY); ctx.stroke(); ctx.setLineDash([]);
				ctx.globalAlpha = 0.8; ctx.fillStyle = '#ffb36b'; ctx.beginPath(); ctx.ellipse(bx, by - 18, 7, 3.5, 0, 0, Math.PI * 2); ctx.fill();
			} else if(key === 'volley' && b.inst){
				const inst = w.instances.find(i => i.id === b.inst); if(!inst || inst.age > 0.55) continue;
				const aim = m.owner.aimFor(inst); if(!aim) continue;
				ctx.globalAlpha = 0.35; ctx.strokeStyle = GOLD; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(aim.x - camX, aim.y - camY); ctx.stroke();
			} else if(key === 'stream' && m.GA.cursor){
				ctx.globalAlpha = 0.25; ctx.strokeStyle = GOLD; ctx.beginPath(); ctx.arc(m.GA.cursor.x - camX, m.GA.cursor.y - camY, 26, 0, Math.PI * 2); ctx.stroke();
			}
		}
		ctx.restore();
	}
	function drawBar(ctx, m){
		const G = m.GA;
		ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
		const W0 = ctx.canvas.width, bw = Math.min(600, W0 * 0.52), bx = (W0 - bw) / 2, by = 80;
		ctx.fillStyle = '#000b'; ctx.fillRect(bx - 3, by - 3, bw + 6, 24);
		ctx.fillStyle = '#2a2316'; ctx.fillRect(bx, by, bw, 11);
		ctx.fillStyle = G.phase === 3 ? '#fff2c6' : G.phase === 2 ? '#f0c46a' : '#c9a24a';
		ctx.fillRect(bx, by, bw * clamp(m.hp / m.maxHp, 0, 1), 11);
		ctx.fillStyle = '#ffffff66'; ctx.fillRect(bx + bw * CONFIG.phase2, by, 1, 11); ctx.fillRect(bx + bw * CONFIG.phase3, by, 1, 11);
		ctx.fillStyle = '#8fb8ff'; ctx.fillRect(bx, by + 13, bw * clamp(m.mana / m.maxMana, 0, 1), 3);
		ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
		const label = G.state === 'transition' ? 'shifting…' : [ 'Controlled Mastery', 'Multi-branch Control', 'Absolute Output' ][G.phase - 1];
		ctx.fillText(m.name + '  ·  Phase ' + [ 'I', 'II', 'III' ][G.phase - 1] + ' — ' + label + '  ·  no techniques', W0 / 2, by + 34);
		ctx.restore();
	}

	/* =========================== measurements from the engine (telegraph sizes) =========================== */
	const MEASURED = {};
	/* cast a spell in a private world and read the size its burst will have, so the drawn ring is the real one */
	function measure(){
		try {
			const w = ME.createWorld();
			const dummy = { x: 1000, y: 900, w: 40, h: 96 };
			const foe = { x: 1300, y: 948, w: 38, h: 56 };
			const host = { mouseWorld: () => ({ x: 1300, y: 970 }), getEnemies: () => [ foe ], isSolid: (x, y) => y >= 1000, inBounds: () => true, damageEnemy(){}, hitRect: (e) => e };
			const owner = { id: 'measure', entity: dummy, alive: () => true, facing: () => 1, foes: () => [ foe ], allies: () => [], hurt(){}, hurtSelf(){}, aim: () => ({ x: 1300, y: 970 }), aimFor: () => ({ x: 1300, y: 970 }), health: () => 1, triggers: 0 };
			for(const key of [ 'nova', 'ward', 'signature', 'lattice', 'volley' ]){
				const A = ATTACKS[key]; if(!A.def) continue;
				const r = w.cast(A.def, { profile: policy.profile, owner, host });
				if(!r || !r.ok) continue;
				let R = 0;
				for(let i = 0; i < 400; i++){
					w.update(1 / 60, host);
					for(const b of w.bodies) if(b.alive && b.inst === r.instance.id){
						if(key === 'signature' && Math.hypot(b.x - (foe.x + 19), b.y - (foe.y + 28)) < 260){ foe.x = b.x - 19 + (b.x < foe.x ? 60 : -60); }      // let it come near so it blooms
						const r0 = burstRadius(b, A.burstR || 1.4); if(isFinite(r0)) R = Math.max(R, r0);
					}
				}
				MEASURED[key] = Math.round(R);
				w.clearOwner('measure');
			}
		} catch(e){ MEASURED.error = e.message; }
	}

	/* =========================== exports =========================== */
	function library(){
		const out = [];
		for(const key in ATTACKS){
			const A = ATTACKS[key];
			const rep = A.def ? ME.validate(A.def, policy.profile) : null;
			out.push({ id: 'GA-' + key, key, name: A.name, role: A.role, source: A.source, tier: A.tier, phases: A.phases,
				range: A.range, prep: A.prep, telegraph: Math.max(CONFIG.minTelegraph, A.telegraph * CONFIG.telegraphMul), recovery: A.recovery, cooldown: +(A.cooldown * CONFIG.cooldownMul).toFixed(2),
				response: A.response, counters: A.counters, cost: rep ? Math.round(rep.upfront + (A.drawn || 0)) : null, peakOutput: rep ? Math.round(rep.peakOutput) : null,
				runes: rep ? rep.runeCount : null, techniques: rep ? Object.keys(rep.techniques || {}) : null, policy: A.def ? (policy.check(A.def) || 'ok') : rejected[key],
				tree: A.def || null });
		}
		return out;
	}
	function setDiscovered(map){ for(const k in map) DISCOVERED[k] = map[k]; }
	function boot(){
		register();
		measure();
		KIND.custom = { init, frame, draw, onDeath, pre };
		RM.KINDS.arcanist = KIND;
	}
	/* for tests: make him cast one attack now (he must have perceived you at least once) */
	function force(m, key){ if(!m.ctx || !m.GA || !ATTACKS[key] || !ATTACKS[key].def) return false; m.GA.state = 'fight'; m.GA.act = null; m.GA.seq = null; startAttack(m, m.ctx, key); return true; }
	const API = { force, CONFIG, ATTACKS, SEQUENCES, policy, KIND, MEASURED, rejected, library, setDiscovered, boot, register, measure, scoreAttack, choose, aimFn };
	root.GrandArcanist = API;
	// the browser build carries its discovered trees inline (grand-arcanist-discovered.js sets them before this file);
	// in Node the campaign calls setDiscovered() with the catalog's trees, then boot()
	if(root.GRAND_ARCANIST_DISCOVERED) setDiscovered(root.GRAND_ARCANIST_DISCOVERED);
	if(root.GRAND_ARCANIST_DISCOVERED || typeof window !== 'undefined') boot();
})(typeof window !== 'undefined' ? window : globalThis);
