/* =====================================================================
   RUNE MAGES v2 — enemy casters that fight the way a decent player does.

   Each mage owns a real magic profile and a spell book of rune spells (built from the same runes as the player's
   forge) and casts them through the same engine: their tethers, portals, constructs, zones, reinforcements,
   domains and trademark zone spells are the real thing, aimed with their own "cursor" (one per spell).

   How a mage plays (the "mind"):
   · It perceives you with a human reaction delay (it sees where you were ~0.25 s ago) and leads its aim imperfectly.
   · It thinks in TACTICS — short plans of several steps (set up → wait for the opening → spring the combo). Every
     tactic scores itself against the situation (range, your height, whether you stand still, cast, rush in, its
     health and energy, what it already has on the field), and the mage picks among the best with some variety.
   · Between plans it takes a breath (decision time), so it never machine-guns spells.
   · It reacts to your spells — not always (a skill chance), and late (reaction time).
   · It moves like a player: keeps its preferred range, strafes, jumps, climbs platforms, uses movement spells
     (grapple, blink, floating, platforms), retreats to refill from a mana zone, and clears its own spells when
     the field is cluttered or stale.
   · Each has a trademark spell: a large zone of energy turned into a signature attack (20+ runes, with conditions).
   · No condensed weapons and no reverse techniques.

   Kinds
   · Vesk, the Tether Weaver       — Kinetic + Light
   · Morrow, the Gravewright       — Construction + Gravity
   · Sola, the Ember Cartographer  — Thermal + Spatial
   · BOSS: Aster Vael, the Boundless — Infinity + Gravity (real rune spells, coloured; see the ASTER VAEL section)

   Usage (dungeon.html):  RuneMages.init({ world, host, player, hurtPlayer, knockPlayer, move, say, playerCasting,
                                          playerHp, platforms, worldW, groundY, gravity });
                          RuneMages.spawn('vesk', x, y);  RuneMages.update();  RuneMages.draw(ctx, camX, camY);
   ===================================================================== */
(function(root){
	'use strict';
	const ME = root.MagicEngine;
	if(!ME){ root.RuneMages = null; return; }

	/* ---------- spell building (the same tree the forge saves) ---------- */
	// N(type, params, link, ...children) — link: null (instant) | L.d(seconds) | L.c(condition, params, timeout)
	const L = {
		d: (s) => ({ mode: 'delay', delay: s }),
		c: (type, params, timeout) => ({ mode: 'condition', cond: { type, params: params || {}, timeout: timeout == null ? 8 : timeout } })
	};
	function N(type, params, link){ return { type, params: params || {}, link: link || null, kids: Array.prototype.slice.call(arguments, 3) }; }
	function build(name, tree){
		const def = ME.blankSpell(name);
		let seq = 0;
		const put = (t, node) => {
			node.type = t.type;
			node.params = Object.assign(ME.paramDefaults(t.type), t.params);
			if(t.link){
				node.link = Object.assign(ME.defaultLink(), t.link);
				if(t.link.cond) node.link.cond = Object.assign(ME.defaultLink().cond, t.link.cond);
			}
			t.kids.forEach((k, i) => {
				seq++;
				const n = ME.makeNode(k.type, node.id, 's', node.gx + i, node.gy + 1, seq);
				def.nodes[n.id] = n;
				put(k, n);
			});
		};
		put(tree, def.nodes[def.rootId]);
		def.seq = seq + 1;
		return def;
	}
	const gen = (amount, link, ...k) => N('generate', { amount }, link, ...k);
	const tech = (technique, power, extra, link, ...k) => N('technique', Object.assign({ technique, power }, extra || {}), link, ...k);
	const atFoe = (...k) => N('target', { kind: 'enemy', select: 'nearCaster', range: 1500 }, null, ...k);
	const comp = (power, shape, link, ...k) => N('compress', { power, shape }, link, ...k);
	const toMouse = (extra, link, ...k) => N('redirect', Object.assign({ toward: 'mouse' }, extra || {}), link, ...k);
	const toFoe = (extra, link, ...k) => N('redirect', Object.assign({ toward: 'target' }, extra || {}), link, ...k);
	const anchorIt = (link, ...k) => N('anchor', { state: 'anchored' }, link, ...k);
	const arrived = (t) => L.c('arrived', {}, t || 3);

	/* linear chains: C([type, params, link], [type, params, link], …) — each step is the parent of the next (a step may be an N() node) */
	function C(...steps){ let node = null; for(let i = steps.length - 1; i >= 0; i--){ const s = steps[i]; const n = s.kids ? s : N(s[0], s[1], s[2] || null); if(node) n.kids.push(node); node = n; } return node; }
	const zoneOf = (link) => [ 'target', { kind: 'zone', select: 'thisSpell' }, link ];
	const pull = (amount, duration) => [ 'drawOut', { duration: duration || 0.6, from: 'target', infAmount: amount, flow: 'one' } ];
	const T_ = (technique, power, extra, link) => [ 'technique', Object.assign({ technique, power }, extra || {}), link ];
	const foe = (link) => [ 'target', { kind: 'enemy', select: 'nearCaster', range: 1500 }, link ];
	const runes = (t) => 1 + t.kids.reduce((s, k) => s + runes(k), 0);
	const hasRune = (t, type) => t.type === type || t.kids.some(k => hasRune(k, type));
	const hasReverse = (t) => (t.type === 'technique' && Number(t.params.power) < 0) || t.kids.some(hasReverse);

	/* ---------- the trademark spells: a large zone of energy, then that energy turned into something only this mage does ----------
	   (each is one spell of 20+ runes with delays and conditions; the mage keeps fighting while it plays out) */
	// VESK — Lumen Loom: the zone's energy is woven into a crown of kinetic nodes above him, tied together with tethers.
	// Come close and the crown flashes into Light lances that hunt you; a fan of Light lances is drawn from the zone;
	// at the end the whole crown falls on you as light.
	const LUMEN_LOOM = N('zone', { radius: 300, spawn: 'caster' }, null,
		C([ 'target', { kind: 'environment' } ], [ 'drawOut', { duration: 1.4, from: 'target', infAmount: 420 } ]),
		C(zoneOf(L.d(1.6)), pull(260, 0.8), T_('kinetic', 6), [ 'redirect', { toward: 'mouse', arrive: 'stop' } ],
			[ 'divide', { count: 6, formation: 'circle', spacing: 105, motion: 'still' }, L.c('arrived', {}, 2) ], [ 'anchor', { state: 'anchored' } ],
			[ 'anchor', { state: 'bound', len: 600, strength: 7, count: 2 } ],
			foe(), T_('light', 6, null, L.c('enemyNear', { range: 170 }, 9)), [ 'redirect', { toward: 'target' } ]),
		C(zoneOf(L.d(2.6)), pull(130, 0.5), T_('light', 6), [ 'compress', { power: 4, shape: 'lance' } ],
			[ 'divide', { count: 3, formation: 'arc', spacing: 22, motion: 'keep' } ], foe(), [ 'redirect', { toward: 'target' } ]),
		C([ 'target', { kind: 'anchorState', astate: 'bound', select: 'thisSpell' }, L.c('spellAge', { time: 9 }, 10) ], [ 'anchor', { state: 'free' } ],
			T_('light', 6), [ 'redirect', { toward: 'mouse' } ]));
	// MORROW — Cathedral Fall: the zone's energy becomes a row of greatswords built point-down over you and weighted to fall
	// (gravity cores), a fan of stone spikes to drive you under them, and last a great weighted hammer dropped where you are.
	const CATHEDRAL_FALL = N('zone', { radius: 320, spawn: 'caster' }, null,
		C([ 'target', { kind: 'environment' } ], [ 'drawOut', { duration: 1.4, from: 'target', infAmount: 440 } ]),
		C(zoneOf(L.d(1.6)), pull(240, 0.7), [ 'compress', { power: 4, shape: 'sword' } ], [ 'divide', { count: 5, formation: 'horizontal', spacing: 42, motion: 'keep' } ],
			[ 'redirect', { toward: 'mouse', arrive: 'stop' } ], T_('construction', 6, { construction_facing: 'down' }, L.c('arrived', {}, 2.5)),
			[ 'target', { kind: 'construct', select: 'thisSpell' } ], [ 'generate', { amount: 40 } ], T_('gravity', 6, { gravity_you: 'no' }), [ 'reinforce', { portion: 100 } ]),
		C(zoneOf(L.d(2.6)), pull(140, 0.5), [ 'compress', { power: 6, shape: 'spike' } ], [ 'divide', { count: 3, formation: 'arc', spacing: 24, motion: 'keep' } ], foe(), [ 'redirect', { toward: 'target' } ]),
		C(zoneOf(L.d(3.4)), pull(200, 0.6), [ 'compress', { power: 5, shape: 'hammer' } ], [ 'redirect', { toward: 'mouse', arrive: 'stop' } ],
			T_('construction', 6, { construction_facing: 'down' }, L.c('arrived', {}, 2.5)), [ 'target', { kind: 'construct', select: 'thisSpell' } ],
			[ 'generate', { amount: 40 } ], T_('gravity', 7, { gravity_you: 'no' }), [ 'reinforce', { portion: 100 } ]));
	// SOLA — Ember Orrery: the zone's energy becomes a ring of burning stars around her, tied with burning cords. A portal
	// opened on you drops you into the middle of it; stars hurl themselves at you and burst; a fan of ember arrows follows.
	const EMBER_ORRERY = N('zone', { radius: 440, spawn: 'caster' }, null,
		C([ 'target', { kind: 'environment' } ], [ 'drawOut', { duration: 1.5, from: 'target', infAmount: 460 } ]),
		C(zoneOf(L.d(1.6)), pull(240, 0.8), T_('thermal', 7), [ 'redirect', { toward: 'mouse', arrive: 'stop' } ],
			[ 'divide', { count: 6, formation: 'circle', spacing: 220, motion: 'still' }, L.c('arrived', {}, 2.5) ], [ 'anchor', { state: 'anchored' } ],
			[ 'anchor', { state: 'bound', len: 600, strength: 6, count: 2 } ],
			// once you are inside (or close), the stars hold for 1.8 s — time to get out — then come in slowly and burst
			foe(L.c('enemyNear', { range: 290 }, 12)), [ 'redirect', { toward: 'target', speedPct: 55 }, L.d(1.8) ], [ 'discharge', { radius: 1.7 }, L.c('targetNear', { range: 60 }, 2.5) ]),
		C(foe(L.c('spellAge', { time: 3.2 }, 5)), [ 'generate', { amount: 120, spawn: 'target' } ], T_('spatial', 6, { spatial_dest: 'mouse' })),
		C(zoneOf(L.d(4.2)), pull(140, 0.6), T_('thermal', 7), [ 'compress', { power: 4, shape: 'arrow' } ],
			[ 'divide', { count: 4, formation: 'arc', spacing: 20, motion: 'keep' } ], [ 'redirect', { toward: 'mouse' } ]));

	/* ---------- ASTER VAEL's book: Infinity + Gravity, coloured (see the ASTER VAEL section) ----------
	   A Gravity Infinity source is formed in his hand (560 E → Compress 22 → Gravity → Infinity, held still, coloured);
	   the energy drawn out of it is Infinity Gravity: it drags creatures hard and crushes at its core (attraction), or
	   throws everything away when it is discharged (repulsion). */
	const fromCore = (link) => [ 'target', { kind: 'anchorState', astate: 'infinity', select: 'thisSpell' }, link || L.d(0.05) ];
	const infDraw = (amt, dur) => [ 'drawOut', { duration: dur || 0.6, infAmount: amt, flow: 'one' } ];
	const infCore = (g, col, ...after) => C([ 'generate', { amount: 560 } ], [ 'compress', { power: 22 } ], T_('gravity', g, { gravity_you: 'no' }), T_('infinity', 6), [ 'anchor', { state: 'anchored' } ], [ 'color', { color: col } ], ...after);
	// half of the Violet Void: energy sent to a point in front of him, made into an Infinity source there
	const voidHalf = (g, col, amt, speed, ...after) => C([ 'generate', { amount: amt } ], [ 'color', { color: col } ], [ 'redirect', { toward: 'mouse', arrive: 'stop', speedPct: speed } ],
		[ 'compress', { power: 22 }, L.c('arrived', {}, 2) ], T_('gravity', g, { gravity_you: 'no' }), T_('infinity', 6), ...after);
	const VIOLET = (amt) => N('target', { kind: 'self' }, null,
		voidHalf(7, 'azure', amt, 100, [ 'color', { color: 'violet' }, L.c('memory', { event: 'infinityCombined' }, 4) ], foe(),
			[ 'redirect', { toward: 'target' } ], [ 'redirect', { toward: 'target' }, L.d(0.12) ], [ 'redirect', { toward: 'target' }, L.d(0.12) ]),
		voidHalf(-7, 'crimson', amt, 45));
	const fist = (link, amt) => C([ 'generate', { amount: amt }, link ], T_('kinetic', 7), [ 'compress', { power: 6, shape: 'fist' } ], [ 'color', { color: 'azure' } ], [ 'redirect', { toward: 'mouse' } ]);
	const ASTER_SPELLS = {
		// Spatial energy made Infinity, drawn out and reinforced into himself: the Infinity layer
		boundless: { name: 'Boundless', cd: 0.5, wind: 0, tree: C([ 'generate', { amount: 560 } ], T_('spatial', 6), [ 'compress', { power: 24 } ], T_('infinity', 6), [ 'anchor', { state: 'anchored' } ], [ 'color', { color: 'white' } ],
			fromCore(), infDraw(360, 0.6), [ 'reinforce', {} ], [ 'target', { kind: 'self' } ]) },
		azure: { name: 'Azure Collapse', cd: 0.5, wind: 0, tree: infCore(7, 'azure', fromCore(), infDraw(220, 0.6), [ 'redirect', { toward: 'mouse', arrive: 'stop', speedPct: 100 } ], [ 'discharge', { radius: 1.5 }, L.d(1.6) ]) },
		crimson: { name: 'Crimson Repulse', cd: 0.5, wind: 0, tree: infCore(-7, 'crimson', fromCore(), infDraw(200, 0.5), [ 'redirect', { toward: 'mouse' } ], [ 'discharge', { radius: 1.6 }, L.c('enemyNear', { range: 64 }, 2.2) ]) },
		reversal: { name: 'Crimson Repulse', cd: 0.5, wind: 0, tree: infCore(-7, 'crimson', fromCore(L.d(0.05)), infDraw(200, 0.35), [ 'discharge', { radius: 2 } ]) },
		strikes: { name: 'Azure Strikes', cd: 0.5, wind: 0, tree: N('target', { kind: 'self' }, null, fist(null, 30), fist(L.d(0.17), 30), fist(L.d(0.38), 56)) },
		violet: { name: 'Violet Void', cd: 0.5, wind: 0, tree: VIOLET(560) },
		violet2: { name: 'Violet Void: Unbound', cd: 0.5, wind: 0, tree: VIOLET(720) },
		maxazure: { name: 'Maximum Azure', cd: 0.5, wind: 0, tree: C([ 'generate', { amount: 560 } ], [ 'color', { color: 'azure' } ], [ 'redirect', { toward: 'mouse', arrive: 'stop', speedPct: 100 } ],
			[ 'compress', { power: 22 }, L.c('arrived', {}, 2.5) ], T_('gravity', 7, { gravity_you: 'no' }), T_('infinity', 6), [ 'anchor', { state: 'anchored' } ],
			fromCore(), infDraw(320, 0.8), [ 'redirect', { toward: 'mouse', speedPct: 40 }, L.d(0.7) ], [ 'discharge', { radius: 2.2 }, L.c('enemyNear', { range: 70 }, 3) ]) },
		// a vast domain for a moment, fuelled straight from his own energy (no Draw Out): it opens with Overwhelm and closes
		// again (a binding vow makes it brief); no rules — the Overwhelm is the attack, he follows it with a single strike
		domain: { name: 'Domain: Endless Expanse', cd: 0.5, wind: 0, tree:
			N('zone', { radius: 820, spawn: 'caster' }, null,
				N('domain', { form: 'closed', duration: 3, sureHit: 'yes', vow: 'brief', opening: 'overwhelm', fuel: 'self', selfFuel: 520, cinematic: 'none' })) }
	};

	/* melee energy: a fist or a blade thrown at point-blank range that bursts where its reach ends (a blow, not a shot) */
	/* (the melee fighters' blows are real weapon attacks — see NPC MELEE below) */

	/* ---------- ASTER VAEL's models: his energy is ordinary engine energy, drawn as his signature attacks ---------- */
	if(ME.registerSkin){
		const TAU = Math.PI * 2;
		const glow = (ctx, x, y, r, stops) => { const g = ctx.createRadialGradient(x, y, 0, x, y, r); stops.forEach(s => g.addColorStop(s[0], s[1])); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); };
		const ring = (ctx, x, y, r, col, w, a) => { ctx.globalAlpha = a; ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, TAU); ctx.stroke(); };
		const rand = (seed) => { const s = Math.sin(seed * 127.1) * 43758.5453; return s - Math.floor(s); };
		/* Azure — a point of collapsing space: a tiny black centre in blinding blue, space spiralling in, rings closing */
		const azure = (scale) => (ctx, b, x, y, R, t, alpha) => {
			const r = Math.max(10, Math.min(40 * scale, R * 0.75 * scale)), sd = b.seed || 0;
			ctx.globalCompositeOperation = 'lighter';
			ctx.globalAlpha = alpha * 0.55;
			glow(ctx, x, y, r * 4.2, [ [ 0, 'rgba(120,190,255,0.55)' ], [ 0.35, 'rgba(40,110,255,0.22)' ], [ 1, 'rgba(10,30,120,0)' ] ]);
			// closing rings (space being pulled in)
			for(let k = 0; k < 3; k++){ const ph = (t * 1.1 + k / 3 + sd) % 1; ring(ctx, x, y, r * (4 - 3.1 * ph), '#8cc8ff', 1.4, alpha * 0.45 * ph); }
			// spiral streaks falling inward
			ctx.lineWidth = 1.6;
			for(let k = 0; k < 12; k++){
				const u = (t * 0.9 + k / 12 + sd * 0.3) % 1, a0 = k * 0.523 + t * 2.6, r0 = r * (3.6 - 2.6 * u), r1 = r0 * 0.62;
				ctx.globalAlpha = alpha * (0.15 + 0.6 * u); ctx.strokeStyle = k % 3 ? '#4aa3ff' : '#e6f4ff';
				ctx.beginPath(); ctx.moveTo(x + Math.cos(a0) * r0, y + Math.sin(a0) * r0);
				ctx.quadraticCurveTo(x + Math.cos(a0 + 0.5) * (r0 + r1) / 2, y + Math.sin(a0 + 0.5) * (r0 + r1) / 2, x + Math.cos(a0 + 0.95) * r1, y + Math.sin(a0 + 0.95) * r1);
				ctx.stroke();
			}
			// debris dragged along the spiral
			for(let k = 0; k < 9; k++){ const u = (t * 0.7 + rand(k + sd)) % 1, a = k * 0.7 + t * (2 + u * 3), rr = r * 3.2 * (1 - u); ctx.globalAlpha = alpha * u; ctx.fillStyle = '#cfe8ff'; ctx.fillRect(x + Math.cos(a) * rr - 1, y + Math.sin(a) * rr - 1, 2, 2); }
			// the core: blinding blue around a pinpoint of black
			ctx.globalAlpha = alpha;
			glow(ctx, x, y, r * 1.35, [ [ 0, '#ffffff' ], [ 0.35, '#bfe2ff' ], [ 0.7, '#2f7dff' ], [ 1, 'rgba(20,60,255,0)' ] ]);
			ctx.globalCompositeOperation = 'source-over';
			ctx.fillStyle = '#01030c'; ctx.beginPath(); ctx.arc(x, y, r * (0.28 + 0.03 * Math.sin(t * 9)), 0, TAU); ctx.fill();
			ctx.strokeStyle = '#d9efff'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, y, r * 0.3, 0, TAU); ctx.stroke();
		};
		/* Crimson — repulsion: a small white-hot star in red, light flaring outward, rings pushing away, a lens streak */
		const crimson = (scale) => (ctx, b, x, y, R, t, alpha) => {
			const r = Math.max(8, Math.min(26 * scale, R * 0.6 * scale)), sd = b.seed || 0, pulse = 1 + 0.12 * Math.sin(t * 14 + sd);
			ctx.globalCompositeOperation = 'lighter';
			ctx.globalAlpha = alpha * 0.6;
			glow(ctx, x, y, r * 4.6, [ [ 0, 'rgba(255,80,80,0.6)' ], [ 0.3, 'rgba(255,30,60,0.25)' ], [ 1, 'rgba(120,0,20,0)' ] ]);
			for(let k = 0; k < 2; k++){ const ph = (t * 1.8 + k / 2 + sd) % 1; ring(ctx, x, y, r * (1.2 + 3 * ph), '#ff5a64', 2 * (1 - ph) + 0.5, alpha * 0.6 * (1 - ph)); }
			// rays flaring outward
			for(let k = 0; k < 14; k++){
				const a = k * 0.4488 + t * 0.6 + sd, len = r * (1.6 + 0.9 * rand(k + Math.floor(t * 12)));
				ctx.globalAlpha = alpha * 0.55; ctx.strokeStyle = k % 2 ? '#ff8a7a' : '#ffd0c8'; ctx.lineWidth = k % 2 ? 1 : 1.6;
				ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9); ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); ctx.stroke();
			}
			// lens streak
			ctx.globalAlpha = alpha * 0.5; ctx.fillStyle = '#ff6a6a';
			ctx.beginPath(); ctx.ellipse(x, y, r * 4.2, Math.max(1.2, r * 0.12), 0, 0, TAU); ctx.fill();
			ctx.globalAlpha = alpha;
			glow(ctx, x, y, r * pulse * 1.25, [ [ 0, '#ffffff' ], [ 0.3, '#fff0f0' ], [ 0.55, '#ff3a48' ], [ 1, 'rgba(160,0,24,0)' ] ]);
		};
		/* Violet — the void: a sphere of erasure, black-violet within, bands of violet light wound around it, crackling */
		const violet = (ctx, b, x, y, R, t, alpha) => {
			const r = Math.max(30, R * 1.05), sd = b.seed || 0, sp = Math.hypot(b.vx || 0, b.vy || 0);
			ctx.globalCompositeOperation = 'lighter';
			// the wake: space behind it still closing
			if(sp > 0.5){ const ux = -b.vx / sp, uy = -b.vy / sp; for(let k = 1; k <= 4; k++){ ctx.globalAlpha = alpha * 0.12 * (5 - k) / 4; ctx.fillStyle = '#7a2cff'; ctx.beginPath(); ctx.arc(x + ux * r * 0.55 * k, y + uy * r * 0.55 * k, r * (1 - 0.13 * k), 0, TAU); ctx.fill(); } }
			ctx.globalAlpha = alpha * 0.7;
			glow(ctx, x, y, r * 2.1, [ [ 0.35, 'rgba(190,140,255,0.55)' ], [ 0.6, 'rgba(120,40,255,0.25)' ], [ 1, 'rgba(40,0,90,0)' ] ]);
			// bands wound around it
			for(let k = 0; k < 7; k++){
				const sp2 = (k % 2 ? 1 : -1) * (1.2 + k * 0.25), a0 = t * sp2 + k * 0.9 + sd, rr = r * (0.95 + 0.06 * k);
				ctx.globalAlpha = alpha * 0.75; ctx.strokeStyle = [ '#f0e4ff', '#b77bff', '#7a2cff', '#d9b8ff' ][k % 4]; ctx.lineWidth = k < 2 ? 3 : 1.6;
				ctx.beginPath(); ctx.ellipse(x, y, rr, rr * (0.35 + 0.08 * k), a0 * 0.3, a0, a0 + 2.2); ctx.stroke();
			}
			// a wisp of blue and a wisp of red still turning inside it
			for(const w of [ [ '#5ab8ff', 0 ], [ '#ff4a5a', Math.PI ] ]){ const a = t * 3 + w[1]; ctx.globalAlpha = alpha * 0.8; ctx.strokeStyle = w[0]; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(x, y, r * 0.7, a, a + 0.9); ctx.stroke(); }
			// crackling
			ctx.strokeStyle = '#fbf2ff'; ctx.lineWidth = 1.2;
			const tick = Math.floor(t * 18);
			for(let k = 0; k < 4; k++){
				const a = rand(tick * 3.1 + k + sd) * TAU; let px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
				ctx.globalAlpha = alpha * 0.8; ctx.beginPath(); ctx.moveTo(px, py);
				for(let j = 1; j <= 3; j++){ const aa = a + (rand(tick + k * 7 + j) - 0.5) * 0.9; px += Math.cos(aa) * r * 0.22; py += Math.sin(aa) * r * 0.22; ctx.lineTo(px, py); }
				ctx.stroke();
			}
			// the body: violet light round a core of nothing
			ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = alpha;
			glow(ctx, x, y, r, [ [ 0, '#05000c' ], [ 0.55, '#24004a' ], [ 0.8, '#7a2cff' ], [ 0.93, '#d2adff' ], [ 1, 'rgba(210,173,255,0.0)' ] ]);
		};
		/* a source in his hand: small, bright, the colour of what it will become (it is let go a moment later) */
		const core = (inner, mid, rays) => (ctx, b, x, y, R, t, alpha) => {
			const r = 9 + 2 * Math.sin(t * 10 + (b.seed || 0));
			ctx.globalCompositeOperation = 'lighter';
			ctx.globalAlpha = alpha * 0.7;
			glow(ctx, x, y, r * 3.2, [ [ 0, mid + 'aa' ], [ 1, mid + '00' ] ]);
			for(let k = 0; k < rays; k++){ const a = k * TAU / rays + t * 3; ctx.globalAlpha = alpha * 0.5; ctx.strokeStyle = inner; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 1.2, y + Math.sin(a) * r * 1.2); ctx.lineTo(x + Math.cos(a) * r * 2.4, y + Math.sin(a) * r * 2.4); ctx.stroke(); }
			ctx.globalAlpha = alpha;
			glow(ctx, x, y, r * 1.2, [ [ 0, '#ffffff' ], [ 0.5, inner ], [ 1, mid + '00' ] ]);
		};
		/* energy on its way (a Void half, the seed of Maximum Azure): a comet of its colour */
		const seed = (inner, mid) => (ctx, b, x, y, R, t, alpha) => {
			const sp = Math.hypot(b.vx || 0, b.vy || 0), r = 10;
			ctx.globalCompositeOperation = 'lighter';
			if(sp > 0.4){ const ux = -b.vx / sp, uy = -b.vy / sp; for(let k = 1; k <= 6; k++){ ctx.globalAlpha = alpha * 0.18 * (7 - k) / 6; ctx.fillStyle = mid; ctx.beginPath(); ctx.arc(x + ux * k * 6, y + uy * k * 6, r * (1 - k * 0.11), 0, TAU); ctx.fill(); } }
			ctx.globalAlpha = alpha * 0.6; glow(ctx, x, y, r * 2.6, [ [ 0, mid + 'cc' ], [ 1, mid + '00' ] ]);
			ctx.globalAlpha = alpha; glow(ctx, x, y, r, [ [ 0, '#ffffff' ], [ 0.5, inner ], [ 1, mid + '00' ] ]);
		};
		/* a blow: a pale-blue fist of force with a shock crescent ahead of it */
		const strike = (ctx, b, x, y, R, t, alpha) => {
			const sp = Math.hypot(b.vx || 0, b.vy || 0) || 1, ux = (b.vx || 1) / sp, uy = (b.vy || 0) / sp, a = Math.atan2(uy, ux), r = Math.max(9, Math.min(18, R * 0.7));
			ctx.globalCompositeOperation = 'lighter';
			ctx.globalAlpha = alpha * 0.5; ctx.fillStyle = '#9fd8ff';
			ctx.beginPath(); ctx.ellipse(x - ux * r * 1.4, y - uy * r * 1.4, r * 2.4, r * 0.55, a, 0, TAU); ctx.fill();
			ctx.globalAlpha = alpha * 0.9; ctx.strokeStyle = '#e8f6ff'; ctx.lineWidth = 2.2;
			ctx.beginPath(); ctx.arc(x - ux * r * 0.4, y - uy * r * 0.4, r * 1.5, a - 1.0, a + 1.0); ctx.stroke();
			ctx.globalAlpha = alpha; glow(ctx, x, y, r * 1.1, [ [ 0, '#ffffff' ], [ 0.55, '#bfe4ff' ], [ 1, 'rgba(90,170,255,0)' ] ]);
		};
		ME.registerSkin('aster.azure', azure(1));
		ME.registerSkin('aster.azureMax', azure(2.2));
		ME.registerSkin('aster.crimson', crimson(1));
		ME.registerSkin('aster.violet', violet);
		ME.registerSkin('aster.azureCore', core('#8cc8ff', '#2f7dff', 6));
		ME.registerSkin('aster.crimsonCore', core('#ff9a9a', '#ff2a3a', 8));
		ME.registerSkin('aster.boundlessCore', core('#f2fbff', '#9fe8ff', 4));
		ME.registerSkin('aster.azureSeed', seed('#9fd0ff', '#2f7dff'));
		ME.registerSkin('aster.crimsonSeed', seed('#ffb0b0', '#ff2a3a'));
		ME.registerSkin('aster.strike', strike);
		ME.registerSkin('aster.hidden', () => {});
	}

	/* ---------- the three kinds (no reverse techniques: every power is positive) ---------- */
	const KINDS = {
		vesk: {
			id: 'vesk', name: 'Vesk', title: 'the Tether Weaver', color: '#ffd84d', robe: '#3b2f5c', trim: '#ffd84d', hp: 800,
			techniques: [ 'Kinetic', 'Light' ],
			stats: { magicControl: 13, magicPower: 60, allocations: { kinetic: 6, light: 5 } },
			mana: 1000, regen: 55, range: [ 240, 460 ], speed: 5.0, jump: 14.5,
			react: 0.26, dodge: 0.6, aimErr: 22, think: [ 0.35, 0.8 ],
			blurb: 'A control duelist: cages you in kinetic tethers and collapses them, banks shots off the floor, throws Light lances that pierce, blinds you up close and grapples around. Trademark: the Lumen Loom.',
			spells: {
				node:  { name: 'Kinetic Node', cd: 0.5, tree: gen(36, null, tech('kinetic', 6, null, null, toMouse({ arrive: 'stop', speedPct: 90 }, null, anchorIt(arrived(3))))) },
				// a node that first rises over you, then drops to its spot on your far side (its path never runs through you)
				node2: { name: 'Kinetic Node', cd: 0.5, tree: gen(36, null, tech('kinetic', 6, null, null, toMouse({ arrive: 'stop', speedPct: 100 }, null, toMouse({ arrive: 'stop', speedPct: 90 }, arrived(2), anchorIt(arrived(3)))))) },
				web:   { name: 'Weave', cd: 2, tree: N('target', { kind: 'anchorState', astate: 'anchored', select: 'all', techFilter: 'kinetic' }, null, N('anchor', { state: 'bound', len: 600, strength: 7, count: 2 })) },
				collapse: { name: 'Collapse the Web', cd: 5, tree: N('target', { kind: 'anchorState', astate: 'bound', select: 'all', techFilter: 'kinetic' }, null, N('anchor', { state: 'free' }, null, toMouse({ speedPct: 75 }))) },
				lance: { name: 'Kinetic Lance', cd: 1.6, tree: atFoe(gen(30, null, tech('kinetic', 7, null, null, comp(5, 'lance', null, toMouse())))) },
				bank:  { name: 'Bank Shot', cd: 2.4, tree: gen(34, null, tech('kinetic', 6, { kinetic_bounces: 3 }, null, comp(4, 'sphere', null, toMouse()))) },
				snare: { name: 'Tether Snare', cd: 7, tree: atFoe(gen(40, null, tech('kinetic', 5, null, null, toFoe(null, null, N('anchor', { state: 'bound', len: 60, strength: 8 }, L.c('spellHit', {}, 3), anchorIt()))))) },
				// Light always flies at 18 and passes through you: a lance of it pierces and dazzles
				prism: { name: 'Prism Lance', cd: 2.2, tree: gen(32, null, tech('light', 6, null, null, comp(4, 'lance', null, toMouse()))) },
				// up close: a burst of light all around him that dazzles (slows) you, then he gets out
				flare: { name: 'Flashpoint', cd: 6, wind: 0.12, tree: gen(54, null, tech('light', 6, null, null, N('divide', { count: 6, formation: 'circle', spacing: 18, motion: 'outward' }))) },
				grapple: { name: 'Grapple Line', cd: 4.5, tree: gen(30, null, toMouse({ arrive: 'stop', speedPct: 100 }, null, anchorIt(arrived(2), N('anchor', { state: 'bound', bindTo: 'self', selfMode: 'pull', len: 20, strength: 8 })))) },
				legs:  { name: 'Kinetic Stride', cd: 16, tree: N('target', { kind: 'legs' }, null, gen(60, null, tech('kinetic', 6, null, null, N('reinforce', { portion: 100 })))) },
				loom:  { name: 'Lumen Loom', cd: 26, wind: 0.45, trademark: true, tree: LUMEN_LOOM }
			}
		},
		morrow: {
			id: 'morrow', name: 'Morrow', title: 'the Gravewright', color: '#b48cff', robe: '#2b3138', trim: '#9aa6b8', hp: 1000,
			techniques: [ 'Construction', 'Gravity' ],
			stats: { magicControl: 13, magicPower: 70, allocations: { construction: 6, gravity: 5 } },
			mana: 1100, regen: 68, range: [ 300, 580 ], speed: 4.2, jump: 14.5,
			react: 0.32, dodge: 0.5, aimErr: 26, think: [ 0.45, 0.95 ],
			blurb: 'A builder and zoner: walls himself in, slows you with gravity, drops weighted stone on you, hurls his constructs and opens the Crushing Court. Trademark: Cathedral Fall.',
			spells: {
				shard: { name: 'Stone Shards', cd: 1.5, tree: gen(84, null, comp(6, 'spike', null, N('divide', { count: 4, formation: 'arc', spacing: 30, motion: 'keep' }, null, toMouse()))) },
				hurl:  { name: 'Hurled Stone', cd: 2.6, tree: gen(90, null, comp(4, 'cube', null, tech('construction', 6, null, null,
					N('target', { kind: 'construct', select: 'thisSpell' }, null, gen(50, null, tech('gravity', 6, { gravity_you: 'no' }, null, N('reinforce', { portion: 100 }, null,
						N('target', { kind: 'energy', select: 'thisSpell', techFilter: 'gravity' }, L.d(0.15), toMouse({ speedPct: 100 }, null, anchorIt(L.c('travelled', { distance: 800 }, 3))))))))))) },
				wall:  { name: 'Bulwark', cd: 6, wind: 0.25, tree: gen(135, null, comp(3, 'wall', null, toMouse({ arrive: 'stop', speedPct: 100 }, null, anchorIt(arrived(2), tech('construction', 6, { construction_facing: 'right' }))))) },
				// gravity energy conjured right on you (Generate → at current target) and held there: it drags at you
				well:  { name: 'Gravity Well', cd: 5, wind: 0.3, tree: atFoe(N('generate', { amount: 100, spawn: 'target' }, null, tech('gravity', 6, { gravity_you: 'no' }, null, anchorIt()))) },
				// a greatsword raised high over his head, carried over you, built point-down and weighted with a gravity core: it drops and
				// sticks in the ground (raised first so it travels high — out of reach of his own well on the ground)
				drop:  { name: 'Grave Spike', cd: 3.5, wind: 0.25, tree: gen(120, null, comp(4, 'sword', null, toMouse({ arrive: 'stop', speedPct: 100 }, null,
					toMouse({ arrive: 'stop', speedPct: 100 }, arrived(1.2),
						tech('construction', 6, { construction_facing: 'down' }, arrived(2),
							N('target', { kind: 'construct', select: 'thisSpell' }, null, gen(70, null, tech('gravity', 7, { gravity_you: 'no' }, null, N('reinforce', { portion: 100 }))))))))) },
				platform: { name: 'Raise Ledge', cd: 9, tree: gen(110, null, comp(2, 'line', null, toMouse({ arrive: 'stop', speedPct: 100 }, null, anchorIt(arrived(2), tech('construction', 6, { construction_facing: 'right', construction_aspect: 1.4 }))))) },
				crush: { name: 'Crushing Field', cd: 12, tree: N('zone', { radius: 170, spawn: 'mouse' }, null, tech('gravity', 7, null, null, N('target', { kind: 'environment' }, null, N('drawOut', { duration: 1.4, from: 'target', infAmount: 170 })))) },
				cathedral: { name: 'Cathedral Fall', cd: 26, wind: 0.45, trademark: true, tree: CATHEDRAL_FALL },
				court: { name: 'Domain: Crushing Court', cd: 30, tree:
					N('zone', { radius: 340, spawn: 'caster' }, null,
						N('target', { kind: 'environment' }, null, N('drawOut', { duration: 1.4, from: 'target', infAmount: 420 })),
						N('domain', { form: 'closed', duration: 7, sureHit: 'yes', vow: 'none', cinematic: 'none' }, L.d(1.55),
							gen(30, L.d(1.1), comp(6, 'spike', null, toFoe())),
							gen(60, L.c('targetMoving', {}, 30), tech('gravity', 6, { gravity_you: 'no' }, null, N('redirect', { toward: 'caster', arrive: 'stop', speedPct: 60 }))))) }
			}
		},
		sola: {
			id: 'sola', name: 'Sola', title: 'the Ember Cartographer', color: '#ff8a3d', robe: '#4a1d14', trim: '#ffb36b', hp: 700,
			techniques: [ 'Thermal', 'Spatial' ],
			stats: { magicControl: 12, magicPower: 65, allocations: { thermal: 6, spatial: 5 } },
			mana: 1000, regen: 55, range: [ 320, 600 ], speed: 5.4, jump: 14.5,
			react: 0.24, dodge: 0.62, aimErr: 20, think: [ 0.35, 0.8 ],
			blurb: 'A mobile trickster: mines your path, portals you into her traps, shoots through gates at your back, sends your own spells back through a portal and blinks away when you close in. Trademark: the Ember Orrery.',
			spells: {
				bolt:  { name: 'Cinder Bolt', cd: 1.2, tree: gen(26, null, tech('thermal', 6, null, null, comp(4, 'sphere', null, toMouse()))) },
				fireball: { name: 'Fireball', cd: 3, tree: atFoe(gen(50, null, tech('thermal', 7, null, null, comp(5, 'sphere', null, toMouse({ speedPct: 85 }, null, N('discharge', { radius: 1.8 }, L.c('targetNear', { range: 60 }, 3))))))) },
				fan:   { name: 'Ember Fan', cd: 3, tree: atFoe(gen(66, null, tech('thermal', 6, null, null, toMouse(null, null, N('divide', { count: 3, formation: 'vertical', spacing: 40, motion: 'keep' }))))) },
				mine:  { name: 'Ember Mine', cd: 0.6, tree: gen(28, null, tech('thermal', 6, null, null, toMouse({ arrive: 'stop', speedPct: 90 }, null, anchorIt(arrived(3), N('discharge', { radius: 1.6 }, L.c('enemyNear', { range: 80 }, 40)))))) },
				detonate: { name: 'Detonate', cd: 4, tree: N('target', { kind: 'anchorState', astate: 'anchored', select: 'all', techFilter: 'thermal' }, null, N('discharge', { radius: 1.7 })) },
				heat:  { name: 'Scorched Ground', cd: 11, tree: N('zone', { radius: 150, spawn: 'mouse' }, null, tech('thermal', 7, null, null, N('target', { kind: 'environment' }, null, N('drawOut', { duration: 1.4, from: 'target', infAmount: 160 })))) },
				gate:  { name: 'Cartographer\'s Gate', cd: 7, tree: gen(120, null, toMouse({ arrive: 'stop', speedPct: 90 }, null, tech('spatial', 6, { spatial_dest: 'mouse' }, arrived(2)))) },
				volley: { name: 'Gate Volley', cd: 0.5, tree: gen(22, null, tech('thermal', 6, null, null, comp(4, 'arrow', null, toMouse()))) },
				displace: { name: 'Displace', cd: 10, tree: atFoe(N('generate', { amount: 120, spawn: 'target' }, null, tech('spatial', 6, { spatial_dest: 'mouse' }))) },
				blink: { name: 'Blink', cd: 5, wind: 0.1, tree: gen(75, null, tech('spatial', 6, { spatial_dest: 'mouse' })) },
				// a portal opened in front of her, its exit just behind you: your own spell comes out of it at your back
				mirror: { name: 'Mirror Gate', cd: 8, wind: 0, tree: gen(100, null, toMouse({ arrive: 'stop', speedPct: 100 }, null, tech('spatial', 6, { spatial_dest: 'mouse' }, arrived(1.2)))) },
				orrery: { name: 'Ember Orrery', cd: 26, wind: 0.45, trademark: true, tree: EMBER_ORRERY }
			}
		},
		/* the boss: every move is a rune spell from ASTER_SPELLS (see the ASTER VAEL section for how he plays) */
		/* ---------- three melee fighters: they fight with the same weapons and attack data as you (melee-weapons.js) —
		   the same combos, hitboxes, launchers, plunges and knockback, and you can parry them — and use one technique for
		   utility spells. They think with the boss's planner. ---------- */
		// KAEL — Kinetic · Gauntlets: a rushdown boxer. Grapples in, works jab–cross–heavy strings, launches you and follows you up.
		kael: {
			id: 'kael', name: 'Kael', title: 'the Ironfist', planner: true, weapon: 'gauntlets', look: 'fists', color: '#7fe0ff', robe: '#2c4a6e', trim: '#7fe0ff', hp: 900,
			techniques: [ 'Kinetic' ],
			stats: { magicControl: 13, magicPower: 65, allocations: { kinetic: 8 } },
			mana: 1000, regen: 70, speed: 6.6, jump: 15, react: 0.22, dodge: 0.55, aimErr: 14, engage: 34, idle: 150, rest: [ 0.5, 0.85 ], meleeMul: 1.0, dashSpeed: 14, dashCd: 0.8,
			blurb: 'Melee · Gauntlets · Kinetic. A rushdown boxer: grapples in on a kinetic line, jab–cross–heavy strings, launches you and follows you into the air, breaks free with a shockwave.',
			spells: {
				grapple: { name: 'Grapple Line', cd: 0.3, wind: 0, tree: gen(30, null, toMouse({ arrive: 'stop', speedPct: 100 }, null, anchorIt(arrived(2), N('anchor', { state: 'bound', bindTo: 'self', selfMode: 'pull', len: 20, strength: 8 })))) },
				stride:  { name: 'Kinetic Stride', cd: 0.3, wind: 0, tree: N('target', { kind: 'legs' }, null, gen(60, null, tech('kinetic', 6, null, null, N('reinforce', { portion: 100 })))) },
				guard:   { name: 'Kinetic Guard', cd: 0.3, wind: 0, tree: N('target', { kind: 'self' }, null, gen(70, null, tech('kinetic', 6, null, null, N('reinforce', { portion: 100 })))) },
				shock:   { name: 'Shockwave', cd: 0.3, wind: 0, tree: gen(96, null, tech('kinetic', 7, null, null, N('divide', { count: 6, formation: 'circle', spacing: 24, motion: 'outward' }))) }
			},
			moves: {
				grapple: { name: 'Grapple Line', wind: 0.18, col: '#7fe0ff', fire(m, p, c){ const inst = bossCast(m, 'grapple', () => ({ x: cx(p), y: cy(p) - 10 }), 0.6); if(inst) m.grapple = { inst: inst.id, until: m.t + 1.6 }; }, hold: 0.3 },
				stride:  { name: 'Kinetic Stride', wind: 0.2, col: '#7fe0ff', fire: (m) => bossCast(m, 'stride'), hold: 0.2 },
				guard:   { name: 'Kinetic Guard', wind: 0.25, col: '#7fe0ff', fire: (m) => bossCast(m, 'guard'), hold: 0.25 },
				shock:   { name: 'Shockwave', wind: 0.2, col: '#bff0ff', fire: (m) => bossCast(m, 'shock'), hold: 0.3 },
				backstep: { name: '', wind: 0.02, col: '#7fe0ff', fire(m, p, c){ m.vx = -c.dir * 9; m.vy = Math.min(m.vy, -7); }, hold: 0.3 }
			},
			plans: {
				guard:   { name: 'Guard Up', cd: 14, score: (m, c) => hasReinf(m, 'self') ? 0 : 2.2, steps: () => [ S_.move('guard') ] },
				stride:  { name: 'Stride', cd: 16, score: (m, c) => hasReinf(m, 'legs') ? 0 : 1.4, steps: () => [ S_.move('stride') ] },
				// the line pulls him in; the string starts the moment he lands next to you
				rush:    { name: 'Rush In', cd: 5, score: (m, c) => c.d > 230 && c.d < 700 ? 2 : 0, steps: () => [ S_.move('grapple'), S_.until((m, c) => c.d < 110, 1.4), S_.melee([ 'g1', 'g2', 'g3' ]) ] },
				string:  { name: 'Jab–Cross–Heavy', cd: 2.2, score: (m, c) => c.d < 320 ? 1.6 : 0.3, steps: () => [ S_.melee([ 'g1', 'g2', 'g3' ]) ] },
				// up you go — he jumps after you and finishes in the air, then drives you down
				launch:  { name: 'Launcher', cd: 6, score: (m, c) => c.d < 300 ? 1.4 : 0, steps: () => [ S_.melee([ 'launcher' ]), S_.do((m) => { if(m.onGround) m.vy = -m.K.jump; }), S_.wait(0.12), S_.melee([ 'nair', 'nair2' ], 200), S_.melee([ 'down' ], 260) ] },
				counter: { name: 'Counter', cd: 5, score: (m, c) => c.d < 200 && c.pCasting ? 2.2 : 0, steps: () => [ S_.melee([ 'heavy' ]) ] },
				rising:  { name: 'Rising Strike', cd: 8, score: (m, c) => c.d < 260 ? 1.0 : 0, steps: () => [ S_.melee([ 'special' ]) ] },
				break:   { name: 'Break Free', cd: 8, score: (m, c) => c.d < 130 && c.recentHurt > 25 ? 2.6 : 0, steps: () => [ S_.move('shock'), S_.move('backstep') ] }
			}
		},
		// BRANNOC — Thermal · War Hammer: a heavy bruiser. Slow, tanky, huge hits; freezes you in place and erupts the ground,
		// and leaps onto you with a downward smash.
		brannoc: {
			id: 'brannoc', name: 'Brannoc', title: 'the Hearthbreaker', planner: true, weapon: 'hammer', look: 'hammer', color: '#ff7a3d', robe: '#6e2e1a', trim: '#ffb36b', hp: 1200,
			techniques: [ 'Thermal' ],
			stats: { magicControl: 13, magicPower: 75, allocations: { thermal: 8 } },
			mana: 1100, regen: 70, speed: 4.3, jump: 14, react: 0.3, dodge: 0.35, aimErr: 18, engage: 48, idle: 170, rest: [ 0.7, 1.1 ], meleeMul: 0.95, dashSpeed: 9, dashCd: 1.6,
			blurb: 'Melee · War Hammer · Thermal. A heavy bruiser: hammer swings, a rising hammer, the Groundbreaker and an overhead smash; a frost breath to hold you still, the ground erupting under you, and a leaping downward smash.',
			spells: {
				erupt:  { name: 'Eruption', cd: 0.3, wind: 0, tree: atFoe(N('generate', { amount: 110, spawn: 'target' }, null, tech('thermal', 7, null, null, anchorIt(null, N('discharge', { radius: 1.9 }, L.d(0.9)))))) },
				frost:  { name: 'Frost Breath', cd: 0.3, wind: 0, tree: gen(84, null, tech('thermal', -6, null, null, toMouse(null, null, N('divide', { count: 3, formation: 'vertical', spacing: 34, motion: 'keep' })))) },
				scorch: { name: 'Scorched Ground', cd: 0.3, wind: 0, tree: N('zone', { radius: 150, spawn: 'mouse' }, null, tech('thermal', 7, null, null, N('target', { kind: 'environment' }, null, N('drawOut', { duration: 1.2, from: 'target', infAmount: 160 })))) },
				guard:  { name: 'Ember Guard', cd: 0.3, wind: 0, tree: gen(80, null, tech('thermal', 6, null, null, N('reinforce', { portion: 100 }, null, N('target', { kind: 'self' })))) }
			},
			moves: {
				erupt:  { name: 'Eruption', wind: 0.35, col: '#ff5a1f', fire: (m, p, c) => bossCast(m, 'erupt'), hold: 0.35 },
				frost:  { name: 'Frost Breath', wind: 0.3, col: '#8fe3ff', fire: (m, p, c) => bossCast(m, 'frost', () => meleeAim(m, p, 0), 0.5), hold: 0.4 },
				scorch: { name: 'Scorched Ground', wind: 0.3, col: '#ff7a3d', fire: (m, p, c) => bossCast(m, 'scorch', () => lead(nowS(m, c), 0.6), 0.6), hold: 0.4 },
				guard:  { name: 'Ember Guard', wind: 0.3, col: '#ffb36b', fire: (m) => bossCast(m, 'guard'), hold: 0.3 },
				leap:   { name: 'Furnace Leap', wind: 0.25, col: '#ff7a3d', fire(m, p, c){ const dx = cx(p) - cx(m); m.vy = -m.K.jump * 1.15; m._leapVx = clamp(dx / 34, -9, 9); m.leaping = true; }, hold: 0.2 }
			},
			plans: {
				guard:    { name: 'Ember Guard', cd: 14, score: (m, c) => hasReinf(m, 'self') ? 0 : 2.0, steps: () => [ S_.move('guard') ] },
				swing:    { name: 'Hammer String', cd: 3, score: (m, c) => c.d < 320 ? 1.6 : 0.3, steps: () => [ S_.melee([ 'g1', 'g2', 'g3' ]) ] },
				overhead: { name: 'Overhead Smash', cd: 7, score: (m, c) => c.d < 260 ? 1.2 : 0, steps: () => [ S_.melee([ 'special' ]) ] },
				// the frost slows you; then the hammer finds you
				trap:     { name: 'Freeze and Crush', cd: 9, score: (m, c) => c.d < 360 ? 1.4 : 0, steps: () => [ S_.move('frost'), S_.wait(0.3), S_.melee([ 'g1', 'heavy' ]) ] },
				erupt:    { name: 'Eruption', cd: 7, score: (m, c) => c.d > 220 && c.d < 650 ? 1.1 : 0, steps: () => [ S_.move('erupt') ] },
				scorch:   { name: 'Scorch', cd: 12, score: (m, c) => c.d > 360 ? 0.9 : 0, steps: () => [ S_.move('scorch') ] },
				// a leap onto you, driven down as a smash
				leap:     { name: 'Leaping Smash', cd: 7, score: (m, c) => c.d > 180 && c.d < 620 ? 1.6 : 0,
					steps: () => [ S_.move('leap'), S_.until((m, c) => !m.onGround && m.vy > -2 && Math.abs(cx(c.p) - cx(m)) < 110, 1.2), S_.melee([ 'down' ], 400), S_.until((m) => m.onGround, 1), S_.melee([ 'g2' ], 260) ] }
			}
		},
		// SYTHE — Spatial · Twin Daggers: a duelist. Opens a portal and steps through it to land in front of you, cuts fast
		// strings and flurries, launches you into air combos; pulls you in with Displace and raises a mirror of reversed space.
		sythe: {
			id: 'sythe', name: 'Sythe', title: 'the Rift Dancer', planner: true, weapon: 'daggers', look: 'blades', color: '#c79bff', robe: '#3a2860', trim: '#e3c9ff', hp: 760,
			techniques: [ 'Spatial' ],
			stats: { magicControl: 13, magicPower: 65, allocations: { spatial: 8 } },
			mana: 1000, regen: 65, speed: 6.4, jump: 15.5, react: 0.2, dodge: 0.7, aimErr: 12, engage: 30, idle: 190, rest: [ 0.45, 0.8 ], meleeMul: 1.1,
			blurb: 'Melee · Twin Daggers · Spatial. A duelist: steps through a portal to land in front of you, fast cut strings and a flurry, launches you into air combos, pulls you in with Displace and throws your spells back with a mirror of reversed space.',
			spells: {
				// a portal opened where she stands, its exit just short of you: she steps through, then it closes
				rift:     { name: 'Rift Step', cd: 0.3, wind: 0, tree: gen(80, null, tech('spatial', 6, { spatial_dest: 'mouse' })) },
				mirror:   { name: 'Rift Mirror', cd: 0.3, wind: 0, tree: gen(90, null, tech('spatial', -6, null, null, toMouse({ arrive: 'stop', speedPct: 100 }))) },
				displace: { name: 'Displace', cd: 0.3, wind: 0, tree: atFoe(N('generate', { amount: 120, spawn: 'target' }, null, tech('spatial', 6, { spatial_dest: 'mouse' }))) }
			},
			moves: {
				rift:     { name: 'Rift Step', wind: 0.18, col: '#c79bff', fire(m, p, c){ riftStep(m, p, c); }, hold: 0.35 },
				mirror:   { name: 'Rift Mirror', wind: 0.12, col: '#e3c9ff', fire: (m, p, c) => bossCast(m, 'mirror', () => ({ x: cx(m) + c.dir * 60, y: cy(m) - 6 }), 0.5), hold: 0.3 },
				// you are sent through space to the point right in front of her blades
				displace: { name: 'Displace', wind: 0.3, col: '#c79bff', fire: (m, p, c) => bossCast(m, 'displace', () => ({ x: cx(m) + m.facing * 60, y: cy(m) }), 0.8), hold: 0.25 },
				away:     { name: '', wind: 0.02, col: '#c79bff', fire(m, p, c){ m.vx = -c.dir * 10; m.vy = Math.min(m.vy, -8); }, hold: 0.25 }
			},
			plans: {
				// through the portal, straight into a string
				lunge:   { name: 'Rift Lunge', cd: 4, score: (m, c) => { const d = Math.abs(cx(c.p) - cx(m)); return d > 220 && d < 640 ? 1.8 : 0; }, steps: () => [ S_.move('rift'), S_.melee([ 'g1', 'g2', 'g3' ]) ] },
				string:  { name: 'Cut String', cd: 2, score: (m, c) => c.d < 280 ? 1.5 : 0.2, steps: () => [ S_.melee([ 'g1', 'g2', 'g3' ]) ] },
				flurry:  { name: 'Flurry', cd: 6, score: (m, c) => c.d < 200 ? 1.3 : 0, steps: () => [ S_.melee([ 'special' ]) ] },
				air:     { name: 'Air Combo', cd: 7, score: (m, c) => c.d < 240 ? 1.2 : 0, steps: () => [ S_.melee([ 'launcher' ]), S_.do((m) => { if(m.onGround) m.vy = -m.K.jump; }), S_.wait(0.1), S_.melee([ 'nair', 'nair2' ], 200), S_.melee([ 'down' ], 260) ] },
				pull:    { name: 'Pull and Cut', cd: 8, score: (m, c) => c.d > 220 && c.d < 600 ? 1.2 : 0, steps: () => [ S_.move('displace'), S_.wait(0.12), S_.melee([ 'g1', 'g2', 'g3' ]) ] },
				dance:   { name: 'Cut and Away', cd: 5, score: (m, c) => c.d < 160 && c.recentHurt > 15 ? 2 : 0, steps: () => [ S_.melee([ 'g3' ]), S_.move('away') ] },
				mirror:  { name: 'Rift Mirror', cd: 7, score: (m, c) => (c.threat.length || c.pCasting) && c.d > 160 ? 2.2 : 0, steps: () => [ S_.move('mirror') ] }
			}
		},
		aster: {
			id: 'aster', name: 'Aster Vael', title: 'the Boundless', boss: true, color: '#9fe8ff', robe: '#141a2e', trim: '#7fd6ff', hp: 4200,
			techniques: [ 'Infinity', 'Gravity' ],
			stats: { magicControl: 24, magicPower: 200, allocations: { infinity: 8, gravity: 8, spatial: 6, kinetic: 6 } },
			mana: 9999, regen: 999, range: [ 200, 420 ], speed: 7.6, jump: 16.5,
			react: 0.12, dodge: 0.85, aimErr: 8, think: [ 0.15, 0.4 ],
			blurb: 'BOSS. Every move is a real rune spell: an Infinity layer reinforced into himself (drain it until it shatters, suppress it with Anti-Magic, or bypass it with a sure-hit domain), Azure Collapse and Crimson Repulse drawn from Gravity Infinity sources, blink strikes, Maximum Azure, the Violet Void (opposing Infinity tearing space) and the domain Endless Expanse.',
			dmgScale: 0.32, spells: ASTER_SPELLS
		}
	};

	/* ---------- environment (given by the game) ---------- */
	let env = null;
	const mages = [];
	let nextId = 1;
	function init(e){ env = e; }
	const W = () => env && env.world && env.world();
	const P = () => env && env.player && env.player();
	const cx = (e) => e.x + (e.w || 0) / 2, cy = (e) => e.y + (e.h || 0) / 2;
	const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
	const rnd = (a, b) => a + Math.random() * (b - a);
	const sgn = (v) => v < 0 ? -1 : 1;
	const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;      // −1…1, bunched in the middle
	const groundY = () => (env && env.groundY) || 1e9;
	const worldW = () => (env && env.worldW) || 9000;

	function profileFor(K){
		const p = ME.deriveProfile({ magicControl: K.stats.magicControl, magicPower: K.stats.magicPower, maxMana: K.mana });
		p.allocations = Object.assign({}, K.stats.allocations);
		p.techniquePoints = Math.max(20, Object.keys(p.allocations).reduce((t, k) => t + p.allocations[k], 0));
		return p;
	}
	/* every spell is checked with the mage's own profile once — a broken one is reported, never cast */
	const book = {};
	function bookFor(kind){
		if(book[kind]) return book[kind];
		const K = KINDS[kind], prof = profileFor(K), out = { profile: prof, spells: {}, errors: [] };
		for(const key in K.spells){
			const s = K.spells[key], def = s.def || build(s.name, s.tree), rep = ME.validate(def, prof);      // a kind may hand over ready, checked defs
			if(!rep.ok) out.errors.push(key + ': ' + (rep.errors[0] ? rep.errors[0].text : 'invalid'));
			out.spells[key] = { key, name: s.name, cd: s.cd, wind: s.wind != null ? s.wind : 0.2, def, ok: rep.ok, cost: rep.upfront != null ? rep.upfront : rep.cost,
				trademark: !!s.trademark, runes: s.tree ? runes(s.tree) : Object.keys(def.nodes).length, draws: s.tree ? hasRune(s.tree, 'drawOut') : Object.values(def.nodes).some(n => n.type === 'drawOut'), reverse: s.tree ? hasReverse(s.tree) : false };
		}
		book[kind] = out;
		return out;
	}

	function spawn(kind, x, y){
		const K = KINDS[kind]; if(!K) return null;
		const B = bookFor(kind);
		const m = {
			runeMage: true, kind, name: K.name, title: K.title, id: nextId++, K,
			x: x - 16, y: y - 74, w: 32, h: 72, vx: 0, vy: 0, hp: K.hp, maxHp: K.hp, dead: false, deathT: 0,
			facing: -1, onGround: false, flash: 0, dots: [], stunTimer: 0, slowTimer: 0, _kbVx: 0, _kbVy: 0, _kbTimer: 0,
			mana: K.mana, maxMana: K.mana, castFlash: 0, castName: '', castNameT: 0, aim: { x: x, y: y }, aimFn: null, aimT: 0, aimLock: 0,
			cds: {}, tcd: {}, gcd: 1.0, t: 0, walk: 0, lastErr: '',
			plan: null, nextThink: 0.8, lastTactic: '', hist: [], handled: new Set(), dodgeCd: 0, jumpCd: 0,
			strafe: 1, strafeT: 0, goal: null, grapple: null, hurtLog: [], prevHp: K.hp,
			mem: { nodeIds: new Set(), gateInst: 0, wells: [] }, stats: { casts: {}, tactics: {}, dmg: {}, via: {} }, instKey: {}, instAim: {}, tmInst: 0
		};
		m.owner = {
			id: 'mage' + m.id, entity: m,
			alive: () => !m.dead,
			facing: () => m.facing,
			foes: () => { const p = P(); return p && !m.dead ? [ p ] : []; },
			allies: () => [],
			hurt: (e, dmg, info) => {
				if(e !== P() || !env.hurtPlayer) return;
				const k = (info && info.instance != null && m.instKey[info.instance]) || (info && info.dot ? 'burn' : 'other');
				const sc = m.K.dmgScale || API.damageScale;
				m.stats.dmg[k] = (m.stats.dmg[k] || 0) + dmg * sc;
				env.hurtPlayer(dmg * sc, info, m);
			},
			hurtSelf: (dmg) => { if(m.blockHit && m.blockHit(dmg, null)) return; m.hp -= dmg; m.flash = 6; },
			aim: () => m.aim,
			aimFor: (inst) => { const f = inst && m.instAim[inst.id]; return f ? (f(inst.age) || m.aim) : m.aim; },
			health: () => m.hp / m.maxHp,
			triggers: 0
		};
		m.book = B;
		mages.push(m);
		if(K.custom){ if(K.custom.init) K.custom.init(m, INTERNAL); }      // a kind that brings its own mind (grand-arcanist.js)
		else if(K.boss){ m.maxHp = m.hp = BOSS.hp; m.lastHp = m.hp; bossInit(m); }
		else if(K.planner) plannerInit(m);
		return m;
	}
	function clear(){
		const w = W();
		for(const m of mages) if(w) try { w.clearOwner(m.owner.id); } catch(e){}
		mages.length = 0;
	}
	function targets(){ return mages.filter(m => !m.dead); }

	/* ---------- casting ---------- */
	const spellOf = (m, key) => m.book.spells[key];
	function ready(m, key){ const s = spellOf(m, key); return !!(s && s.ok && (m.cds[key] || 0) <= 0 && m.mana >= s.cost && m.stunTimer <= 0 && !(s.draws && !s.trademark && trademarkLive(m))); }
	function label(m, text){ m.castName = text; m.castNameT = 70; }
	/* aim: a point (or a function of time since the cast, for spells whose later runes read the cursor again) */
	function cast(m, key, aim, lock){
		const w = W(); const s = spellOf(m, key);
		if(!w || !s || !s.ok || m.mana < s.cost) return null;
		let fn = null;
		if(aim){
			fn = typeof aim === 'function' ? aim : (() => aim);
			m.aimFn = fn; m.aimT = 0; m.aim = fn(0) || m.aim; m.aimLock = lock == null ? 0.25 : lock;
		}
		let res;
		try { res = w.cast(s.def, { profile: m.book.profile, owner: m.owner, host: env.host() }); }
		catch(e){ res = { ok: false, error: e && e.message }; }
		if(!res || !res.ok){ m.lastErr = (res && res.error) || 'failed'; m.cds[key] = 0.6; return null; }
		m.mana -= s.cost;
		m.cds[key] = s.cd; m.gcd = 0.3;
		m.castFlash = 16; label(m, s.name);
		m.stats.casts[key] = (m.stats.casts[key] || 0) + 1;
		if(SETUP_KEYS[key]) m.lastSetup = m.t;
		m.instKey[res.instance.id] = key;
		if(fn) m.instAim[res.instance.id] = fn;      // this spell keeps its own cursor for its whole life
		if(API.log) API.log(m, 'cast ' + key + (m.plan ? ' [' + m.plan.name + ']' : ''));
		return res.instance;
	}
	const PORTAL_LIFE = { mirror: 2.2, blink: 1.2, displace: 1.8, gate: 4, trademark: 1.6 };      // seconds a portal of each kind stays open
	const SHOT_KEYS = { lance: 13, bank: 9, shard: 9, bolt: 9, prism: 18, fireball: 8, fan: 9, volley: 9 };      // shot → its speed (px / frame), for leading
	const SETUP_KEYS = { node: 1, web: 1, mine: 1, gate: 1, wall: 1, platform: 1, well: 1, heat: 1, crush: 1, court: 1, loom: 1, cathedral: 1, orrery: 1 };
	/* a player's aim is never perfect: a little error that grows with distance */
	function noisy(m, p, extra){
		const d = Math.hypot(p.x - cx(m), p.y - cy(m));
		const e = (m.K.aimErr + d * 0.03) * (extra == null ? 1 : extra);
		return { x: p.x + gauss() * e, y: p.y + gauss() * e * 0.6 };
	}
	const ownBodies = (m, test) => { const w = W(); return w ? w.bodies.filter(b => b.alive && b.ownerId === m.owner.id && (!test || test(b))) : []; };
	const ownCons = (m) => { const w = W(); return w ? w.constructs.filter(c => c.alive && c.ownerId === m.owner.id) : []; };
	const ownZones = (m) => ownBodies(m, b => b.isZone);

	/* ---------- perception: you are seen a moment late ---------- */
	function perceive(m, p){
		const now = { x: cx(p), y: cy(p), vx: (p.vx || 0) + (p.launchVx || 0), vy: p.vy || 0, ground: !!p.onGround, top: p.y, bottom: p.y + p.h, t: m.t };
		m.hist.push(now);
		while(m.hist.length > 2 && m.hist[1].t <= m.t - m.K.react) m.hist.shift();
		return m.hist[0];
	}
	/* where you will be in t seconds (from what the mage has seen) */
	function lead(S, t){
		const f = t * 60;
		let y = S.y + S.vy * f * 0.5;
		if(S.ground || y > groundY() - 24) y = Math.min(y, groundY() - 24);
		return { x: clamp(S.x + S.vx * f * 0.85, 40, worldW() - 40), y };
	}

	/* the player's energy heading this way (spells the mage could react to) */
	function threats(m, within){
		const w = W(); if(!w) return [];
		const mx = cx(m), my = cy(m), out = [];
		for(const b of w.bodies){
			if(!b.alive || b.ownerId !== 'player' || b.isZone || b.zoneBlob || b.spatial || b.anchored || b.attach || b.coreOf) continue;
			const dx = mx - b.x, dy = my - b.y, d = Math.hypot(dx, dy);
			if(d > within) continue;
			const sp = Math.hypot(b.vx, b.vy); if(sp < 1.2) continue;
			if((b.vx * dx + b.vy * dy) / (sp * d || 1) < 0.8) continue;      // not coming at me
			out.push({ b, d, eta: d / sp / 60, power: Math.abs(ME.bodyPower(b)) });
		}
		return out.sort((a, b) => a.eta - b.eta);
	}

	/* ---------- the situation, as the mage reads it ---------- */
	function readSituation(m, p, S){
		const mx = cx(m), my = cy(m);
		const dx = S.x - mx, dy = S.y - my, d = Math.hypot(dx, dy);
		// how long you have stayed in roughly one place
		if(!m.still || Math.hypot(S.x - m.still.x, S.y - m.still.y) > 70) m.still = { x: S.x, y: S.y, t: m.t };
		// damage taken lately
		if(m.hp < m.prevHp){ m.hurtLog.push({ t: m.t, d: m.prevHp - m.hp }); }
		m.prevHp = m.hp;
		while(m.hurtLog.length && m.hurtLog[0].t < m.t - 3) m.hurtLog.shift();
		const recentHurt = m.hurtLog.reduce((s, h) => s + h.d, 0);
		const w = W();
		// forget nodes that are gone
		if(m.mem.nodeIds.size && (m._pruneT || 0) < m.t){
			m._pruneT = m.t + 0.5;
			const live = new Set(ownBodies(m).map(b => b.inst));
			for(const id of Array.from(m.mem.nodeIds)) if(!live.has(id)) m.mem.nodeIds.delete(id);
		}
		const ctx = {
			p, S, mx, my, dx, dy, d, dir: sgn(dx), absDx: Math.abs(dx),
			pAir: !S.ground, pAbove: S.bottom < m.y + 10,
			pStill: m.t - m.still.t,
			pCasting: !!(env.playerCasting && env.playerCasting()),
			pHp: env.playerHp ? env.playerHp() : 1,
			hp: m.hp / m.maxHp, mana: m.mana, manaPct: m.mana / m.maxMana,
			recentHurt, threat: threats(m, 360),
			zones: ownZones(m), cons: ownCons(m),
			mine: ownBodies(m),
			ground: groundY(),
			edge: Math.min(mx, worldW() - mx),
			domain: w && w.domains ? w.domains.find(D => D.alive && D.ownerId === m.owner.id) : null,
			burnout: w && w.burnoutLeft ? w.burnoutLeft(m.owner.id) : 0,
			inWell: null
		};
		ctx.inWell = ctx.zones.find(z => z.amount > 10 && Math.hypot(z.x - mx, z.y - my) < z.zoneRadius && !(z.tech && Object.keys(z.tech).some(k => Math.abs(z.tech[k]) > 0.05)) && !(w && w.domains && w.domains.some(D => D.alive && D.z === z))) || null;
		return ctx;
	}

	/* ---------- plans: short scripts of steps ---------- */
	const STEP = {
		cast: (key, aim, lock) => ({ k: 'cast', key, aim, lock }),
		wait: (s) => ({ k: 'wait', s }),
		until: (fn, timeout, soft) => ({ k: 'until', fn, timeout: timeout || 2, soft: !!soft }),      // soft: on timeout carry on instead of giving up
		go: (fn, timeout) => ({ k: 'go', fn, timeout: timeout || 2 }),
		do: (fn) => ({ k: 'do', fn })
	};
	function startPlan(m, name, steps){
		m.plan = { name, steps, i: 0, t: 0, data: {} };
		m.lastTactic = name;
		m.stats.tactics[name] = (m.stats.tactics[name] || 0) + 1;
		if(API.log) API.log(m, 'plan ' + name);
	}
	function runPlan(m, ctx, dt){
		const pl = m.plan; if(!pl) return;
		pl.t += dt;
		let guard = 0;
		while(pl && pl.i < pl.steps.length && guard++ < 4){
			const st = pl.steps[pl.i];
			if(st.k === 'cast'){
				if(m.gcd > 0){ if(pl.t > 1.2) return abort(m); return; }
				if(!ready(m, st.key)){ if(pl.t > 1.2 || !spellOf(m, st.key) || m.mana < spellOf(m, st.key).cost) return abort(m); return; }
				// the wind-up: it gathers the spell for a moment first (the staff glows, the name shows) — you can read it
				if(!pl.wound){
					const wd = spellOf(m, st.key).wind * (m.K.windMul || 1);
					if(wd > 0.02){ pl.wound = true; m.wind = { key: st.key, t: 0, dur: wd }; label(m, spellOf(m, st.key).name); return; }
				}
				if(m.wind && m.wind.t < m.wind.dur) return;
				m.wind = null; pl.wound = false;
				let aim = typeof st.aim === 'function' && st.aim.length === 1 ? st.aim(ctx) : st.aim;
				if(aim == null && SHOT_KEYS[st.key]){
					const sol = solveShot(m, ctx, st.key);
					if(sol === 'blocked'){ m.wind = null; pl.wound = false; return abort(m); }      // a wall or a portal in the way: move first
					aim = sol;
				}
				const inst = cast(m, st.key, aim, st.lock);
				if(!inst) return abort(m);
				pl.data.last = inst; pl.data[st.key] = inst;
				next(pl);
			} else if(st.k === 'wait'){
				if(pl.t < st.s) return;
				next(pl);
			} else if(st.k === 'until'){
				const r = st.fn(ctx, pl.data);
				if(r === 'abort') return abort(m);
				if(r){ next(pl); continue; }
				if(pl.t > st.timeout){ if(st.soft){ next(pl); continue; } return abort(m); }
				return;
			} else if(st.k === 'go'){
				const g = st.fn(ctx, pl.data);
				if(!g) { next(pl); continue; }
				m.goal = g;
				if(Math.abs(g.x - ctx.mx) < 26 || pl.t > st.timeout){ m.goal = null; next(pl); continue; }
				return;
			} else if(st.k === 'do'){
				const r = st.fn(ctx, pl.data, m);
				if(r === 'abort') return abort(m);
				next(pl);
			}
		}
		if(pl && pl.i >= pl.steps.length) finish(m);
		function next(q){ q.i++; q.t = 0; }
	}
	function abort(m){ if(API.log && m.plan) API.log(m, 'abort ' + m.plan.name + ' at step ' + m.plan.i + ' (' + (m.plan.steps[m.plan.i] || {}).k + (m.plan.steps[m.plan.i] && m.plan.steps[m.plan.i].key ? ' ' + m.plan.steps[m.plan.i].key : '') + ')' + (m.lastErr ? ' err: ' + m.lastErr : '')); finish(m); }
	function finish(m){
		m.plan = null; m.goal = null; m.wind = null;
		m.nextThink = m.t + rnd(m.K.think[0], m.K.think[1]);      // a breath before the next decision
	}

	/* choose a tactic: every tactic scores itself; pick among the best with some variety */
	function choose(m, ctx){
		const list = TACTICS[m.kind];
		const opts = [];
		for(const T of list){
			if((m.tcd[T.name] || 0) > m.t) continue;
			let s = 0;
			try { s = T.score(m, ctx); } catch(e){ s = 0; }
			if(!(s > 0)) continue;
			if(T.name === m.lastTactic) s *= 0.55;           // players mix it up
			opts.push({ T, s: s * rnd(0.8, 1.2) });
		}
		if(!opts.length) return false;
		opts.sort((a, b) => b.s - a.s);
		// mostly the best, sometimes the second best (a decent player, not a perfect one)
		if(opts.length > 1 && Math.random() < 0.22){ const q = opts[0]; opts[0] = opts[1]; opts[1] = q; }
		for(const pick of opts){ if(tryTactic(m, ctx, pick)) return true; }
		return false;
	}
	function tryTactic(m, ctx, pick){
		const steps = pick.T.plan(m, ctx);
		if(!steps || !steps.length) return false;
		const first = steps.find(st => st.k === 'cast');
		if(first && !ready(m, first.key)){ m.tcd[pick.T.name] = m.t + 0.5; return false; }
		// a decent player keeps a little energy back: a plan it cannot pay for (plus a reserve) is skipped
		const cost = steps.reduce((sum, st) => sum + (st.k === 'cast' && spellOf(m, st.key) ? spellOf(m, st.key).cost : 0), 0);
		const reserve = pick.T.name === 'Recover' || pick.T.name === 'Close Quarters' ? 0 : Math.min(160, m.maxMana * 0.12);
		if(cost > m.mana - reserve && steps.some(st => st.k === 'cast')){
			m.tcd[pick.T.name] = m.t + 1;
			return false;
		}
		m.tcd[pick.T.name] = m.t + (pick.T.cd || 0);
		startPlan(m, pick.T.name, steps);
		return true;
	}

	/* ---------- the tactics (what each mage knows how to do) ---------- */
	const aimFoe = (m, t, extra) => (ctx) => noisy(m, lead(ctx.S, t), extra);
	const T = {};      // shared helpers for the tactic lists

	/* a mage's "O key": let go of everything it has out (stale nodes, mines, old constructs) */
	function release(m, why){
		const w = W(); if(!w) return;
		try { w.clearOwner(m.owner.id); } catch(e){}
		m.grapple = null; m.mem.nodeIds.clear(); m.mem.gateInst = 0; m.tmInst = 0;
		label(m, 'Release' + (why ? ' — ' + why : ''));
	}
	/* common tactics every mage has */
	function commonTactics(kind){
		const K = KINDS[kind], tmKey = Object.keys(K.spells).find(k => K.spells[k].trademark);
		return [
			// the trademark: a large zone of energy turned into this mage's signature attack (it keeps fighting while it plays out)
			{ name: 'Trademark', cd: 4, score: (m, c) => {
					if(!tmKey || !ready(m, tmKey) || trademarkLive(m) || c.d < 140 || c.d > 760 || c.domain) return 0;
					const sp = spellOf(m, tmKey);
					return m.mana >= sp.cost + 120 ? 3.6 + (c.pStill > 0.8 ? 0.8 : 0) + (c.hp < 0.6 ? 0.6 : 0) : 0;
				},
				plan: (m, c) => [ STEP.do(() => { m.tmAnchor = null; }), STEP.cast(tmKey, (cc) => trademarkAim(m, tmKey), 0.6), STEP.do((cc, data) => { if(data.last) m.tmInst = data.last.id; }), STEP.wait(0.35) ] },
			{ name: 'Tidy Up', cd: 12, score: (m, c) => {
					const stale = c.mine.filter(b => !b.isZone && Math.hypot(b.x - c.S.x, b.y - c.S.y) > 900).length + c.cons.filter(k => Math.hypot(k.x - c.S.x, k.y - c.S.y) > 1100).length;
					return (stale >= 4 && !c.domain && !trademarkLive(m) && m.t - (m.lastSetup || 0) > 6) ? 1.5 + stale * 0.3 : 0;
				},
				plan: (m) => [ STEP.do(() => release(m, 'too much out')) ] },
			// no spell at all: move to a better spot (a flank, a platform, out of the corner) — players spend a lot of time moving
			{ name: 'Reposition', cd: 2.5, score: (m, c) => 0.55 + (c.edge < 300 ? 1 : 0) + (c.threat.length ? 0.3 : 0) + (m.blocked && m.t - m.blocked.t < 1.2 ? 2.5 : 0),
				plan: (m, c) => {
					const pl = nearestPlatform(m, c, 520);
					let x;
					if(m.blocked && m.t - m.blocked.t < 1.2 && m.blocked.c){
						// a construct between us: go around it (past its nearer end), or over it if it is low
						const k = m.blocked.c, mid = (k.bx0 + k.bx1) / 2;
						x = c.mx < mid ? Math.min(c.mx - 120, k.bx0 - 140) : Math.max(c.mx + 120, k.bx1 + 140);
						if(k.by1 - k.by0 < 140 && m.onGround){ m.vy = -m.K.jump * jumpMul(m); m.onGround = false; }
						m.blocked = null;
					}
					else if(m.blocked && m.t - m.blocked.t < 1.2){ x = c.mx + (Math.random() < 0.5 ? -1 : 1) * rnd(140, 240); if(m.onGround && Math.random() < 0.6){ m.vy = -m.K.jump * jumpMul(m); m.onGround = false; } m.blocked = null; }
					else if(c.edge < 300) x = c.mx < worldW() / 2 ? c.mx + 380 : c.mx - 380;
					else if(pl && !c.pAbove && Math.random() < 0.4) x = pl.x + pl.w / 2;
					else x = c.S.x - c.dir * rnd(K.range[0], K.range[1]) + gauss() * 120;
					x = clamp(x, 100, worldW() - 100);
					return [ STEP.do(() => { if(m.onGround && Math.random() < 0.5){ m.vy = -m.K.jump * jumpMul(m); m.onGround = false; } }),
						STEP.go(() => ({ x, run: true }), rnd(0.6, 1.1)), STEP.wait(rnd(0.1, 0.35)) ];
				} }
		];
	}

	const TACTICS = {
		/* ---------------- VESK ---------------- */
		vesk: commonTactics('vesk').concat([
			{ name: 'Lance', cd: 3, score: (m, c) => (c.d < 900 ? 0.8 : 0) + (c.pAir ? 0.4 : 0),
				plan: (m) => [ STEP.cast('lance', null) ] },
			// a Light lance: always 18 px/frame and it passes through you — fast, piercing, it dazzles
			{ name: 'Prism Lance', cd: 2.6, score: (m, c) => (c.d > 200 && c.d < 1000 && ready(m, 'prism')) ? 0.9 + (c.pAir ? 0.4 : 0) : 0,
				plan: () => [ STEP.cast('prism', null) ] },
			// you got close: a flash of light all around him (it dazzles you), then he grapples out
			{ name: 'Flashpoint', cd: 6, score: (m, c) => (c.d < 190 && ready(m, 'flare')) ? 4.2 : 0,
				plan: (m, c) => [ STEP.cast('flare', null), STEP.wait(0.2),
					STEP.do((cc) => { if(ready(m, 'grapple')){ const away = cc.edge < 200 ? (cc.mx < worldW() / 2 ? 1 : -1) : -cc.dir; m.plan.steps.push(STEP.cast('grapple', { x: clamp(cc.mx + away * 360, 80, worldW() - 80), y: cc.my - 180 }, 0.4), STEP.do((c2, data) => { if(data.last) m.grapple = { inst: data.last.id, until: m.t + 1.8 }; })); } }) ] },
			{ name: 'Bank Shot', cd: 4.5, score: (m, c) => (c.d > 200 && c.d < 700 && !c.pAir) ? 1.1 : 0,
				// aim at your mirror image below the floor: the shot bounces up into you
				plan: (m) => [ STEP.cast('bank', (c) => { const t = lead(c.S, 0.5); return noisy(m, { x: t.x, y: 2 * c.ground - t.y }, 0.8); }, 0.2) ] },
			{ name: 'Snare and Punish', cd: 9, score: (m, c) => (c.d < 650 && ready(m, 'snare') && c.mana > 160) ? 2.6 + (c.pStill > 0.8 ? 1 : 0) : 0,
				plan: (m) => [
					STEP.cast('snare', null),
					STEP.until((c, data) => {
						const inst = data.snare; if(!inst) return 'abort';
						const b = ownBodies(m, q => q.inst === inst.id)[0];
						if(!b) return 'abort';                                 // missed: it flew off
						return !!(b.bond && b.anchored);                        // it lodged in you and is holding
					}, 2.5),
					STEP.wait(0.15),
					STEP.cast('lance', null),
					STEP.wait(0.5),
					STEP.cast('bank', (c) => { const t = lead(c.S, 0.3); return noisy(m, { x: t.x, y: 2 * c.ground - t.y }, 0.6); })
				] },
			// his signature: four nodes boxed around where you will be (the far ones arc over you), woven into a cage of kinetic
			// tethers — the sides stop you, the top bounces you back down — then collapsed onto you
			{ name: 'Cage', cd: 6, score: (m, c) => (c.d < 680 && c.d > 120 && c.mana > 260 && ready(m, 'node') && webNear(m, c) < 3) ? 3.3 + (c.pStill > 0.8 ? 1.2 : 0) + (c.pAir ? -0.8 : 0) : 0,
				plan: (m, c) => {
					const steps = [];
					const sd = c.dir;
					let ctr = null;
					const center = (cc) => { if(!ctr){ const t = lead(cc.S, 0.8); ctr = { x: t.x, y: Math.min(t.y, cc.ground - 24) }; } return ctr; };
					const box = [ [ -sd * 165, 14, false ], [ -sd * 165, -190, false ], [ sd * 165, -190, true ], [ sd * 165, 14, true ] ];
					for(const [ ox, oy, far ] of box){
						if(!far) steps.push(STEP.cast('node', (cc) => { const q = center(cc); return { x: q.x + ox + gauss() * 12, y: Math.min(q.y + oy, cc.ground - 22) }; }, 0.3));
						else steps.push(STEP.cast('node2', (cc) => { const q = center(cc); const fin = { x: q.x + ox + gauss() * 12, y: Math.min(q.y + oy, cc.ground - 22) };
							const over = { x: q.x + ox * 0.2, y: q.y - 260 }; return (t) => t < 0.05 ? over : fin; }, 1.4));
						steps.push(STEP.do((cc, data) => { if(data.last) m.mem.nodeIds.add(data.last.id); }));
						steps.push(STEP.wait(0.14));
					}
					steps.push(STEP.until(() => ownBodies(m, b => m.mem.nodeIds.has(b.inst) && b.anchored).length >= 3, 2.4));
					steps.push(STEP.cast('web', null));
					steps.push(STEP.wait(0.5));
					steps.push(STEP.until((cc) => {
						const web = ownBodies(m, b => b.bond && b.tech && b.tech.kinetic > 0);
						if(web.length < 3) return 'abort';
						let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
						for(const b of web){ x0 = Math.min(x0, b.x); x1 = Math.max(x1, b.x); y0 = Math.min(y0, b.y); y1 = Math.max(y1, b.y); }
						return cc.S.x > x0 - 60 && cc.S.x < x1 + 60 && cc.S.y > y0 - 80 && cc.S.y < y1 + 80;
					}, 2.6, true));      // you stayed out of it: it holds a while, then collapses at you anyway
					steps.push(STEP.wait(0.5));
					steps.push(STEP.cast('collapse', (cc) => lead(cc.S, 0.3), 0.5));
					steps.push(STEP.do(() => m.mem.nodeIds.clear()));
					return steps;
				} },
			// a quick web: two nodes and a tether across the way you are running (a wall that stops or flings you)
			{ name: 'Tripline', cd: 5, score: (m, c) => (c.d > 220 && c.d < 700 && Math.abs((c.S.vx || 0)) > 2.5 && ready(m, 'node') && c.mana > 180 && webNear(m, c) < 2) ? 2.6 : 0,
				plan: (m, c) => {
					const dir = sgn(c.S.vx || c.dir), x = lead(c.S, 0.9).x + dir * 60;
					const ids = [];
					return [ STEP.cast('node', (cc) => ({ x, y: cc.ground - 22 }), 0.3), STEP.do((cc, data) => { if(data.last){ m.mem.nodeIds.add(data.last.id); ids.push(data.last.id); } }), STEP.wait(0.12),
						STEP.cast('node', (cc) => ({ x: x + dir * 6, y: cc.ground - 200 }), 0.3), STEP.do((cc, data) => { if(data.last){ m.mem.nodeIds.add(data.last.id); ids.push(data.last.id); } }),
						STEP.until(() => ownBodies(m, b => ids.indexOf(b.inst) >= 0 && b.anchored).length >= 2, 1.8), STEP.cast('web', null) ];
				} },
			{ name: 'Mirror Wall', cd: 12, score: (m, c) => ((c.pCasting || c.threat.length) && c.d > 300 && c.mana > 220 && m.mem.nodeIds.size === 0) ? 2.2 + (c.recentHurt > 30 ? 1.5 : 0) : 0,
				// two nodes stacked between us, woven: a kinetic wall that throws your spells back
				plan: (m, c) => {
					const x = c.mx + c.dir * 120;
					return [
						STEP.cast('node', { x, y: c.ground - 30 }, 0.2), STEP.do((cc, data) => { if(data.last) m.mem.nodeIds.add(data.last.id); }), STEP.wait(0.15),
						STEP.cast('node', { x: x + c.dir * 6, y: c.ground - 190 }, 0.2), STEP.do((cc, data) => { if(data.last) m.mem.nodeIds.add(data.last.id); }),
						STEP.until(() => ownBodies(m, b => m.mem.nodeIds.has(b.inst) && b.anchored).length >= 2, 1.6),
						STEP.cast('web', null)
					];
				} },
			{ name: 'Grapple Away', cd: 6, score: (m, c) => (ready(m, 'grapple') && ((c.d < 200 && (c.hp < 0.6 || !ready(m, 'flare'))) || c.edge < 160)) ? 3.2 : 0,
				plan: (m, c) => {
					const away = c.edge < 160 ? (c.mx < worldW() / 2 ? 1 : -1) : -c.dir;
					const spot = { x: clamp(c.mx + away * 380, 80, worldW() - 80), y: c.my - 200 };
					return [ STEP.cast('grapple', spot, 0.4), STEP.do((cc, data) => { m.grapple = { inst: data.last.id, until: m.t + 1.8 }; }) ];
				} },
			{ name: 'Take High Ground', cd: 10, score: (m, c) => {
					const pl = nearestPlatform(m, c, 600);
					return (pl && ready(m, 'grapple') && c.d > 260 && !c.pAbove) ? 1.1 : 0;
				},
				plan: (m, c) => { const pl = nearestPlatform(m, c, 600); return pl ? [ STEP.cast('grapple', { x: pl.x + pl.w / 2, y: pl.y - 30 }, 0.4), STEP.do((cc, data) => { m.grapple = { inst: data.last.id, until: m.t + 2 }; }) ] : null; } },
			// kinetic legs when there is ground to cover (chasing you, or getting out)
			{ name: 'Kinetic Stride', cd: 20, score: (m, c) => (ready(m, 'legs') && !hasReinf(m, 'legs') && c.mana > 300 && (c.d > m.K.range[1] + 150 || (c.hp < 0.5 && c.d < 300) || c.pAbove)) ? 2 : 0,
				plan: () => [ STEP.cast('legs', null) ] }
		]),

		/* ---------------- MORROW ---------------- */
		morrow: commonTactics('morrow').concat([
			{ name: 'Shard', cd: 3.2, score: (m, c) => (c.d < 900 ? 0.8 : 0) + (c.pAir ? 0.3 : 0), plan: () => [ STEP.cast('shard', null) ] },
			{ name: 'Hurl Stone', cd: 2, score: (m, c) => (c.d > 220 && c.d < 900 && !c.pAir && c.cons.length < 5) ? 1.6 : 0,
				plan: (m) => [ STEP.cast('hurl', (c) => (t) => t < 0.1 ? c.S : noisy(m, lead(c.S, 0.4), 0.5), 0.35) ] },
			{ name: 'Fortify', cd: 7, score: (m, c) => {
					if(c.d < 230 || c.cons.length >= 5) return 0;
					const covered = c.cons.some(k => k.shape === 'wall' && Math.sign(k.x - c.mx) === c.dir && Math.abs(k.x - c.mx) < 220);
					return covered ? 0 : (c.pCasting || c.threat.length ? 3 : 0) + (c.recentHurt > 25 ? 1.5 : 0) + 0.4;
				},
				// a real wall between us, standing on the ground
				plan: (m, c) => [ STEP.cast('wall', { x: c.mx + c.dir * 95, y: c.ground - 90 }, 0.3), STEP.wait(0.3) ] },
			{ name: 'Pin and Drop', cd: 6, score: (m, c) => (c.d < 760 && c.d > 160 && ready(m, 'well') && ready(m, 'drop') && c.mana > 340 && c.cons.length < 7) ? 2.6 + (c.pStill > 0.7 ? 1 : 0) : 0,
				plan: (m) => [
					STEP.cast('well', (c) => { m.mem.wellPt = { x: c.S.x, y: c.S.y }; return null; }),
					STEP.wait(0.15),
					// a greatsword built point-down high over the well that holds you; its gravity core drops it
					STEP.cast('drop', (c) => {
						// over the well if it is holding you, otherwise where you will be when it lands
						const w0 = m.mem.wellPt, held = w0 && Math.abs(c.S.x - w0.x) < 90;
						const t = held ? lead(c.S, 0.5) : lead(c.S, 1.1);
						const over = noisy(m, { x: t.x, y: Math.min(c.S.y, c.ground - 30) - 330 }, 0.25);
						const up = { x: c.mx + (over.x - c.mx) * 0.25, y: Math.min(c.my, c.ground - 30) - 320 };
						return (tt) => tt < 0.05 ? up : { x: over.x + (lead(m.ctx.S, 0.45).x - over.x) * 0.6, y: over.y };      // it keeps adjusting over you until it is built
					}, 1.6),
					STEP.wait(1.4),
					// the well has done its job: let it go (so it does not drag the stuck sword into the ground)
					STEP.do((c, data) => { const wl = data.well; if(wl) for(const b of ownBodies(m, q => q.inst === wl.id)) b.amount = 0; })
				] },
			{ name: 'Crushing Field', cd: 12, score: (m, c) => (c.d < 700 && ready(m, 'crush') && c.mana > 300) ? 1.6 + (c.pStill > 1 ? 1.2 : 0) + (c.pAir ? 0.6 : 0) : 0,
				plan: (m) => [
					STEP.cast('crush', (c) => noisy(m, lead(c.S, 0.6), 0.4), 0.3),
					STEP.wait(0.9),
					STEP.cast('hurl', (c) => (t) => t < 0.1 ? c.S : noisy(m, lead(c.S, 0.4), 0.5), 0.35)
				] },
			{ name: 'High Ground', cd: 14, score: (m, c) => (ready(m, 'platform') && c.d > 300 && c.d < 800 && !c.pAbove && c.cons.length < 4 && m.onGround) ? 1.1 : 0,
				// raise a ledge beside himself and step up onto it
				plan: (m, c) => {
					const sx = c.mx - c.dir * 70;
					return [ STEP.cast('platform', { x: sx, y: c.ground - 120 }, 0.4), STEP.wait(0.9),
						STEP.do(() => { m.vy = -m.K.jump * jumpMul(m); m.onGround = false; m.vx = -sgn(c.dir) * 2.2; }), STEP.wait(0.6) ];
				} },
			// you rushed in: a wall between us, then he backs off and shards you
			// he lets his own stone go: walls between him and you, the oldest when there are too many, the one you stand on
			{ name: 'Clear the Field', cd: 3, score: (m, c) => {
					const pick = morrowClearList(m, c);
					return pick.length ? 2.2 + pick.length * 0.5 + (pick.some(k => k._why === 'block') ? 2.5 : 0) : 0;
				},
				plan: (m, c) => [ STEP.do(() => { label(m, 'Release the Stone'); m.wind = { key: 'clear', t: 0, dur: 0.25 }; }), STEP.wait(0.25),
					STEP.do((cc) => { const w = W(); const pick = morrowClearList(m, cc); for(const k of pick) if(w.breakConstruct) w.breakConstruct(k, 'released'); m.wind = null; m.blocked = null; m.wallAhead = null; }) ] },
			{ name: 'Stonewall', cd: 7, score: (m, c) => (c.d < 200 && ready(m, 'wall') && c.cons.length < 5) ? 3.6 : 0,
				plan: (m, c) => [ STEP.cast('wall', { x: c.mx + c.dir * 70, y: c.ground - 90 }, 0.3), STEP.go((cc) => ({ x: clamp(cc.mx - cc.dir * 260, 100, worldW() - 100), run: true }), 0.8), STEP.cast('shard', null) ] },
			{ name: 'Crushing Court', cd: 30, score: (m, c) => (!c.domain && !trademarkLive(m) && c.d < 280 && c.mana > 500 && c.burnout <= 0 && ready(m, 'court')) ? 4 + (inWellOf(m, c) ? 2 : 0) : 0,
				plan: (m, c) => [ STEP.cast('court', { x: c.S.x, y: c.S.y }), STEP.until((cc) => !!cc.domain, 3.2), STEP.do(() => { m.courtUntil = m.t + 7; }) ] },
			{ name: 'Court Pressure', cd: 0, score: (m, c) => c.domain ? 6 : 0,
				plan: () => [ STEP.cast('shard', null), STEP.wait(0.6) ] }
		]),

		/* ---------------- SOLA ---------------- */
		sola: commonTactics('sola').concat([
			{ name: 'Bolt', cd: 1.9, score: (m, c) => (c.d < 900 ? 0.8 : 0) + (c.pAir ? 0.4 : 0), plan: () => [ STEP.cast('bolt', null) ] },
			{ name: 'Fan', cd: 3, score: (m, c) => (c.d > 250 && c.d < 800) ? 1.3 + (c.pAir ? 0.8 : 0) : 0, plan: () => [ STEP.cast('fan', null) ] },
			// a fan to make you move, then the fireball where you are moving to
			{ name: 'Fan then Fire', cd: 7, score: (m, c) => (c.d > 220 && c.d < 750 && ready(m, 'fan') && ready(m, 'fireball')) ? 2.1 : 0,
				plan: () => [ STEP.cast('fan', null), STEP.wait(0.45), STEP.cast('fireball', null) ] },
			{ name: 'Minefield', cd: 9, score: (m, c) => {
					const mines = c.mine.filter(b => b.anchored && b.tech && b.tech.thermal > 0 && !b.spatial).length;
					return (mines < 3 && c.d < 700 && c.mana > 220) ? 1.8 + (c.d < 400 ? 0.8 : 0) : 0;
				},
				// mines on the ground between us and where you are heading — then she backs off over them
				plan: (m, c) => {
					const steps = [];
					const spots = [ 0.35, 0.6, 0.85 ].map(u => () => ({ x: c.mx + (lead(c.S, 0.8).x - c.mx) * u + gauss() * 25, y: c.ground - 12 }));
					for(const s of spots){ steps.push(STEP.cast('mine', s(), 0.25)); steps.push(STEP.wait(0.12)); }
					return steps;
				} },
			{ name: 'Trap Spring', cd: 6, score: (m, c) => {
					const near = c.mine.some(b => b.anchored && b.tech && b.tech.thermal > 0 && Math.hypot(b.x - c.S.x, b.y - c.S.y) < 110);
					return (near && ready(m, 'detonate')) ? 4.5 : 0;
				},
				plan: () => [ STEP.cast('detonate', null) ] },
			{ name: 'Displace into Trap', cd: 14, score: (m, c) => {
					const mines = c.mine.filter(b => b.anchored && b.tech && b.tech.thermal > 0 && !b.spatial);
					const heat = c.zones.some(z => z.tech && z.tech.thermal > 0);
					return (ready(m, 'displace') && ownPortals(m) < 2 && c.d < 650 && (mines.length >= 2 || heat) && c.mana > 200) ? 2.8 : 0;
				},
				// a portal opens on you; its exit drops you over her mines (or her scorched ground)
				plan: (m, c) => {
					const mines = c.mine.filter(b => b.anchored && b.tech && b.tech.thermal > 0 && !b.spatial);
					const heat = c.zones.find(z => z.tech && z.tech.thermal > 0);
					const tgt = heat ? { x: heat.x, y: heat.y - 120 } : { x: mines.reduce((s, b) => s + b.x, 0) / mines.length, y: c.ground - 170 };
					return [ STEP.cast('displace', tgt, 0.5), STEP.wait(0.3),
						// wait for you to drop onto them, then set them all off
						STEP.until((cc) => ownBodies(m, b => b.anchored && b.tech && b.tech.thermal > 0 && !b.spatial).some(b => Math.hypot(b.x - cc.p.x - cc.p.w / 2, b.y - cc.p.y - cc.p.h / 2) < 100), 1.4, true),
						STEP.cast('detonate', null) ];
				} },
			{ name: 'Scorched Ground', cd: 12, score: (m, c) => (ready(m, 'heat') && c.d < 700 && (c.pStill > 0.9 || c.pAbove)) ? 2.4 : 0,
				plan: (m) => [ STEP.cast('heat', (c) => noisy(m, { x: c.S.x, y: Math.min(c.S.y + 20, c.ground - 10) }, 0.4), 0.3), STEP.wait(0.8), STEP.cast('fan', null) ] },
			{ name: 'Flank Gate', cd: 10, score: (m, c) => (ready(m, 'gate') && ownPortals(m) === 0 && c.d > 300 && c.d < 800 && Math.abs(c.dy) < 120 && c.mana > 300) ? 2.2 : 0,
				// entrance just behind her, exit past you: arrows into the gate hit you in the back
				plan: (m, c) => {
					const side = -c.dir;
					const entrance = { x: c.mx + side * 120, y: c.my - 6 };
					const steps = [ STEP.do(() => { m.hold = m.t + 1.6; }),      // she stands still while it opens (so she does not back into it)
						STEP.cast('gate', (cc) => (t) => t < 0.05 ? entrance : { x: cc.S.x - side * 130, y: cc.S.y - 6 }, 1.3),
						STEP.do((cc, data) => { m.mem.gateInst = data.last.id; }),
						STEP.until(() => !!gateOf(m), 1.8) ];
					for(let i = 0; i < 4; i++){
						steps.push(STEP.until((cc) => {
							const g = gateOf(m); if(!g) return 'abort';
							const travel = sgn(g.x - cc.mx), ex = cc.S.x - g.spatial.x1;
							return sgn(ex) === travel && Math.abs(ex) < 650 && Math.abs(cc.S.y - g.spatial.y1) < 70;
						}, 1.2));
						steps.push(STEP.cast('volley', null));      // aimed by the shot solver: into the gate when it lines up with you
						steps.push(STEP.wait(0.15));
					}
					return steps;
				} },
			// a portal of hers already near her whose other end is well away from you: she just steps through it (no new portal)
			{ name: 'Portal Step', cd: 2, score: (m, c) => (stepPortal(m, c) && (c.d < 240 || (c.recentHurt > 40 && c.d < 380) || c.edge < 160)) ? 4.6 : 0,
				plan: (m, c) => { const q = stepPortal(m, c); return q ? [ STEP.do(() => { m.portalIntent = m.t + 1.4; label(m, 'Portal Step'); }), STEP.go(() => ({ x: q.x, run: true }), 1.2), STEP.do(() => { m.portalIntent = 0; }) ] : null; } },
			{ name: 'Blink Out', cd: 4, score: (m, c) => (ready(m, 'blink') && ownPortals(m) < 3 && !stepPortal(m, c) && (c.d < 210 || (c.recentHurt > 40 && c.d < 350) || c.edge < 140)) ? 4 : 0,
				plan: (m, c) => {
					const pl = nearestPlatform(m, c, 500);
					const away = c.edge < 140 ? (c.mx < worldW() / 2 ? 1 : -1) : -c.dir;
					const tgt = (pl && Math.random() < 0.5) ? { x: pl.x + pl.w / 2, y: pl.y - 40 } : { x: clamp(c.mx + away * 420, 80, worldW() - 80), y: c.my - 40 };
					return [ STEP.cast('blink', tgt, 0.3), STEP.wait(0.2) ];
				} },
			{ name: 'Blink Behind', cd: 12, score: (m, c) => (ready(m, 'blink') && ownPortals(m) < 2 && ready(m, 'fireball') && c.d > 280 && c.d < 600 && c.hp > 0.5) ? 1.2 : 0,
				// pop out behind you and fire while you are still turning around
				plan: (m, c) => [ STEP.cast('blink', { x: c.S.x + c.dir * 260, y: c.S.y - 30 }, 0.3), STEP.wait(0.35), STEP.cast('fireball', null) ] }
		])
	};
	/* how much of YOUR set-up is around the mage (zones, a domain, parked or tethered energy, gravity wells) */
	function foeSetupNear(m, c, r){
		const w = W(); if(!w) return 0;
		let n = 0;
		for(const b of w.bodies){
			if(!b.alive || b.ownerId !== 'player' || b.zoneBlob) continue;
			const d = Math.hypot(b.x - c.mx, b.y - c.my);
			if(b.isZone){ if(d < (b.zoneRadius || 0) + 40) n += 2; continue; }
			if(d > r) continue;
			if(b.anchored || b.bond || b.spatial || (b.tech && Math.abs(b.tech.gravity || 0) > 0.05)) n += 1;
		}
		if(w.domains && w.domains.some(D => D.alive && D.ownerId === 'player' && Math.hypot(D.x - c.mx, D.y - c.my) < D.r)) n += 3;
		return n;
	}
	/* is the player standing in one of this mage's gravity wells right now */
	function inWellOf(m, c){ return ownBodies(m, b => !b.isZone && b.tech && (b.tech.gravity || 0) > 0.05 && Math.hypot(b.x - c.S.x, b.y - c.S.y) < 120).length > 0; }
	/* ---------- the field: constructs and portals that stand in the way of a shot or a step ---------- */
	/* the first construct a straight line runs into (sampled every 14 px, padded by the shot's size) */
	function constructOnLine(ax, ay, bx, by, pad){
		const w = W(); if(!w || !w.constructs.length) return null;
		pad = pad == null ? 6 : pad;
		const d = Math.hypot(bx - ax, by - ay), n = Math.max(2, Math.ceil(d / 14));
		const live = w.constructs.filter(c => c.alive && !(bx < c.bx0 - pad && ax < c.bx0 - pad) && !(bx > c.bx1 + pad && ax > c.bx1 + pad) && !(by < c.by0 - pad && ay < c.by0 - pad) && !(by > c.by1 + pad && ay > c.by1 + pad));
		if(!live.length) return null;
		for(let i = 1; i < n; i++){
			const x = ax + (bx - ax) * i / n, y = ay + (by - ay) * i / n;
			for(const c of live){ if(x < c.bx0 - pad || x > c.bx1 + pad || y < c.by0 - pad || y > c.by1 + pad) continue; if(w.T.constructTouches(c, x, y, pad)) return c; }
		}
		return null;
	}
	/* every open portal (anyone's): its two ends */
	function portals(){
		const w = W(); if(!w) return [];
		const out = [];
		for(const b of w.bodies) if(b.alive && b.spatial && b.spatial.kind === 'portal' && b.spatial.x1 != null) out.push({ b, ends: [ { x: b.x, y: b.y }, { x: b.spatial.x1, y: b.spatial.y1 } ], r: (b.spatial.r || 30) * 0.75, own: b.ownerId });
		return out;
	}
	/* the first portal end a straight line passes through (skip = an end to ignore, e.g. the one it is aimed at) */
	function portalOnLine(ax, ay, bx, by, skip){
		let best = null, bt = 2;
		const vx = bx - ax, vy = by - ay, L2 = vx * vx + vy * vy || 1;
		for(const P of portals()) for(let e = 0; e < 2; e++){
			const q = P.ends[e]; if(skip && skip.P.b === P.b && skip.e === e) continue;
			const u = ((q.x - ax) * vx + (q.y - ay) * vy) / L2; if(u < 0.02 || u > 1) continue;
			const px = ax + vx * u, py = ay + vy * u;
			if(Math.hypot(q.x - px, q.y - py) < P.r && u < bt){ bt = u; best = { P, e }; }
		}
		return best;
	}
	/* where to aim a shot: straight at where you will be if the line is clear — or into one of its own portals when
	   the shot comes out of the other end on a line through you (a decent player uses the portals it opened) —
	   otherwise 'blocked' (a construct or a portal would swallow it): it moves instead of wasting the shot */
	function solveShot(m, ctx, key){
		const sp = (SHOT_KEYS[key] || 9) * 60, ox = cx(m), oy = cy(m);
		const direct = lead(ctx.S, Math.min(1.1, ctx.d / sp));
		const dBlock = constructOnLine(ox, oy, direct.x, direct.y, 6), dPort = portalOnLine(ox, oy, direct.x, direct.y);
		let best = null;
		for(const P of portals()){
			if(P.own !== m.owner.id) continue;
			for(let e = 0; e < 2; e++){
				const A = P.ends[e], B = P.ends[1 - e];
				const da = Math.hypot(A.x - ox, A.y - oy); if(da < 30 || da > 900) continue;
				if(constructOnLine(ox, oy, A.x, A.y, 6)) continue;
				const other = portalOnLine(ox, oy, A.x, A.y, { P, e }); if(other) continue;
				const ux = (A.x - ox) / da, uy = (A.y - oy) / da;
				// where you will be when it comes out of B and reaches you
				let s1 = (ctx.S.x - B.x) * ux + (ctx.S.y - B.y) * uy, Pt = ctx.S;
				for(let k = 0; k < 2; k++){ Pt = lead(ctx.S, (da + Math.max(0, s1)) / sp); s1 = (Pt.x - B.x) * ux + (Pt.y - B.y) * uy; }
				if(s1 < 20 || s1 > 950) continue;
				const perp = Math.abs((Pt.x - B.x) * uy - (Pt.y - B.y) * ux);
				if(perp > 34 || constructOnLine(B.x, B.y, B.x + ux * s1, B.y + uy * s1, 6)) continue;
				const sc = perp + s1 * 0.02;
				if(!best || sc < best.sc) best = { sc, aim: { x: A.x + gauss() * 4, y: A.y + gauss() * 4 } };
			}
		}
		const clear = !dBlock && !dPort;
		if(best && (!clear || Math.random() < 0.65)){ m.lastShotVia = 'portal'; m.stats.via.portal = (m.stats.via.portal || 0) + 1; return best.aim; }      // a shot through its own portal (a flank)
		if(clear){ m.lastShotVia = 'direct'; m.stats.via.direct = (m.stats.via.direct || 0) + 1; return noisy(m, direct); }
		m.blocked = { t: m.t, by: dBlock ? 'construct' : 'portal', c: dBlock || null };
		m.stats.via['blocked by ' + m.blocked.by] = (m.stats.via['blocked by ' + m.blocked.by] || 0) + 1;
		return 'blocked';
	}
	/* how many of its tethered kinetic nodes are around you already */
	function webNear(m, c){ return ownBodies(m, b => b.bond && b.tech && b.tech.kinetic > 0 && Math.hypot(b.x - c.S.x, b.y - c.S.y) < 420).length; }
	/* which of Morrow's constructs to let go: one blocking his way / line to you, one you are standing on, the oldest beyond four */
	function morrowClearList(m, c){
		const out = [], add = (k, why) => { if(k && k.alive && k.ownerId === m.owner.id && out.indexOf(k) < 0){ k._why = why; out.push(k); } };
		if(m.wallAhead && m.t - m.wallAhead.t < 0.8) add(m.wallAhead.c, 'block');
		if(m.blocked && m.t - m.blocked.t < 1.2 && m.blocked.c) add(m.blocked.c, 'block');
		const w = W(), p = c.p;
		if(w && w.constructAt && p){ const under = w.constructAt(p.x + p.w / 2, p.y + p.h + 4); if(under) add(under, 'under'); }
		const mine = c.cons.filter(k => k.inst !== m.tmInst || !trademarkLive(m)).sort((a, b) => (a.born || 0) - (b.born || 0));
		for(let i = 0; i < mine.length - 4; i++) add(mine[i], 'old');
		return out;
	}
	const ownPortals = (m) => portals().filter(P => P.own === m.owner.id).length;
	/* an end of one of her portals close to her (on her level) whose other end is far from you: a way out on foot */
	function stepPortal(m, c){
		let best = null, bd = 1e9;
		for(const P of portals()){
			if(P.own !== m.owner.id) continue;
			for(let e = 0; e < 2; e++){
				const A = P.ends[e], B = P.ends[1 - e];
				const d = Math.abs(A.x - c.mx); if(d > 280 || Math.abs(A.y - c.my) > 70) continue;
				if(Math.hypot(B.x - c.S.x, B.y - c.S.y) < 380 || sgn(A.x - c.mx) === c.dir && d > 60) continue;      // not toward you, and it must take her away
				if(d < bd){ bd = d; best = A; }
			}
		}
		return best;
	}
	function trademarkLive(m){ const w = W(); return !!(m.tmInst && w && w.instances.some(i => i.id === m.tmInst && !i.done)); }
	/* the cursor each trademark follows over its life (each spell has its own cursor, see owner.aimFor) */
	function trademarkAim(m, key){
		const S = () => (m.ctx && m.ctx.S) || { x: cx(m) + m.facing * 300, y: cy(m), vx: 0, vy: 0, ground: true };
		const ground = () => groundY() - 30;
		if(key === 'loom'){      // the crown is woven above him, then everything aims at you
			let crown = null;
			return (t) => { if(t > 1.5 && t < 3.6){ if(!crown){ crown = { x: cx(m), y: cy(m) - 215 }; m.tmAnchor = crown; } return crown; } return lead(S(), 0.25); };
		}
		if(key === 'cathedral'){      // always high over where you will be
			return () => { const q = lead(S(), 0.9); return { x: q.x, y: Math.min(S().y, ground()) - 300 }; };
		}
		if(key === 'orrery'){      // the ring forms around her; the portal on you exits in the ring's centre; then you again
			let ring = null;
			return (t) => { if(t > 1.5 && t < 4.0){ if(!ring){ ring = { x: cx(m), y: cy(m) - 200 }; m.tmAnchor = ring; } return ring; } return lead(S(), 0.4); };
		}
		return null;
	}
	function hasReinf(m, kind){ const w = W(); return !!(w && w.reinf.some(st => st.ownerId === m.owner.id && st.kind === kind)); }
	function gateOf(m){ return m.mem.gateInst ? ownBodies(m, b => b.spatial && b.spatial.kind === 'portal' && b.spatial.x1 != null && b.inst === m.mem.gateInst)[0] : null; }
	function nearestPlatform(m, c, within){
		const list = (env.platforms && env.platforms()) || [];
		let best = null, bd = within;
		for(const pl of list){
			if(pl.w > 2000 || pl.y >= groundY() - 10 || pl.y < groundY() - 520) continue;
			const px = clamp(c.mx, pl.x + 20, pl.x + pl.w - 20), d = Math.abs(px - c.mx) + Math.abs(pl.y - m.y) * 0.5;
			if(d < bd){ bd = d; best = pl; }
		}
		return best;
	}
	function jumpMul(m){ const w = W(); return 1 + (w ? 0.5 * w.reinforcedValue(m, 'jumpForce') + 0.4 * w.reinforcedValue(m, 'lowGravity') : 0); }

	/* ---------- reactions: a late, imperfect read of your spells ---------- */
	function react(m, ctx){
		if(m.stunTimer > 0) return;
		for(const th of ctx.threat){
			const b = th.b;
			if(m.handled.has(b.id)) continue;
			if((b.age || 0) < m.K.react) continue;            // not noticed yet
			m.handled.add(b.id);
			if(m.handled.size > 200) m.handled.clear();
			if(Math.random() > m.K.dodge) continue;          // didn't see it / misjudged it
			if(defend(m, ctx, th)) return;
		}
	}
	function defend(m, ctx, th){
		const b = th.b, k = m.kind;
		// big or close spells get the spell answer, small ones a jump / sidestep
		const big = th.power > 60 || th.eta < 0.5;
		if(k === 'morrow' && big && th.eta > 0.35 && ready(m, 'wall') && m.gcd <= 0 && !m.plan && ownCons(m).length < 7){
			const dir = sgn(b.x - ctx.mx);
			if(cast(m, 'wall', { x: ctx.mx + dir * 80, y: ctx.ground - 90 }, 0.3)) return true;
		}
		if(k === 'sola' && th.eta > 0.35 && th.d > 150 && ready(m, 'mirror') && ownPortals(m) < 2 && m.gcd <= 0 && !m.plan && Math.random() < 0.55){
			// the entrance in its path, a little in front of her; the exit behind you, so it carries on into your back
			const sp = Math.hypot(b.vx, b.vy) || 1, ux = b.vx / sp, uy = b.vy / sp;
			const ent = { x: ctx.mx - ux * 75, y: ctx.my - uy * 75 };
			const S = ctx.S;
			if(cast(m, 'mirror', (t) => t < 0.05 ? ent : { x: S.x - ux * 120, y: S.y - uy * 120 }, 1.4)) return true;
		}
		if(k === 'sola' && big && ready(m, 'blink') && ownPortals(m) < 3 && m.gcd <= 0 && th.eta < 0.6){
			const away = -sgn(b.vx || ctx.dx);
			if(cast(m, 'blink', { x: clamp(ctx.mx + away * 300, 80, worldW() - 80), y: ctx.my - 40 }, 0.25)) return true;
		}
		// body dodge: jump over low shots, step out of high ones
		if(m.onGround && m.jumpCd <= 0 && (b.y > m.y + 20 || Math.random() < 0.5)){ m.vy = -m.K.jump * jumpMul(m); m.onGround = false; m.jumpCd = 0.9; return true; }
		m.dodgeDir = -sgn(b.vy > 0 ? ctx.dx : b.vx); m.dodgeT = 0.35;
		return true;
	}

	/* ---------- movement: range, strafing, platforms, edges ---------- */
	function moveMind(m, ctx, dt){
		const K = m.K;
		m.facing = ctx.dx >= 0 ? 1 : -1;
		let want = 0, run = false;
		if(m.goal){
			const gd = m.goal.x - ctx.mx;
			want = Math.abs(gd) > 14 ? sgn(gd) : 0; run = !!m.goal.run;
			if(Math.abs(gd) > 40) m.facing = sgn(gd);
			if(m.goal.run) m.facing = ctx.dx >= 0 ? 1 : -1;
		} else if(m.tmAnchor && trademarkLive(m) && Math.abs(m.tmAnchor.x - ctx.mx) > 110){
			want = sgn(m.tmAnchor.x - ctx.mx); run = true;      // it fights from its trademark (Vesk's crown, Sola's ring)
		} else {
			const [ r0, r1 ] = K.range;
			if(ctx.absDx < r0) want = -ctx.dir;
			else if(ctx.absDx > r1) want = ctx.dir;
			else {
				m.strafeT -= dt;
				if(m.strafeT <= 0){ m.strafe = [ -1, 0, 0, 1 ][Math.floor(Math.random() * 4)]; m.strafeT = rnd(0.5, 1.4); }
				want = m.strafe * 0.6;
				if(m.onGround && m.jumpCd <= 0 && Math.random() < 0.004){ m.vy = -K.jump * jumpMul(m) * rnd(0.6, 1); m.onGround = false; m.jumpCd = 1.2; }
			}
			// backed against the edge of the arena: go around instead
			if(want && ((ctx.mx < 140 && want < 0) || (ctx.mx > worldW() - 140 && want > 0))){ want = -want; if(m.onGround && m.jumpCd <= 0){ m.vy = -K.jump * jumpMul(m); m.onGround = false; m.jumpCd = 1.2; } }
		}
		if(m.hold > m.t && !(m.dodgeT > 0)) want = 0;
		if(m.dodgeT > 0){ m.dodgeT -= dt; want = m.dodgeDir; run = true; }
		// a construct where it is walking: hop a low one; stop at a tall one and remember it (it goes around, or Morrow lets his own go)
		const w0 = W();
		if(want && w0 && w0.constructs.length && w0.constructAt){
			const px = ctx.mx + sgn(want) * (m.w / 2 + 14);
			const k = w0.constructAt(px, m.y + m.h - 12) || w0.constructAt(px, m.y + m.h * 0.5) || w0.constructAt(px, m.y + 10);
			if(k && k.alive){
				const rise = (m.y + m.h) - k.by0;      // how far above its feet the top of the construct is
				m.wallAhead = { c: k, t: m.t };
				if(rise < 150 && m.onGround && m.jumpCd <= 0){ m.vy = -K.jump * jumpMul(m) * (rise < 70 ? 0.8 : 1); m.onGround = false; m.jumpCd = 0.5; }
				else if(rise >= 150 && m.onGround) want = 0;
			}
		}
		// a portal end where it is walking: never walk into one by accident (only when it means to: Sola's Portal Step)
		if(want && !(m.portalIntent > m.t)){
			for(const P of portals()) for(const q of P.ends){
				if(Math.abs(q.y - ctx.my) < 85 && Math.abs(q.x - ctx.mx) < 95 && sgn(q.x - ctx.mx) === sgn(want)){ want = -sgn(want) * 0.5; break; }
			}
		}
		// the player is up on a ledge: hop after them (if it can reach)
		if(!m.goal && m.onGround && m.jumpCd <= 0 && ctx.S.bottom < m.y + m.h - 60 && ctx.absDx < K.range[1] && ctx.S.bottom > m.y + m.h - 200){ m.vy = -K.jump * jumpMul(m); m.onGround = false; m.jumpCd = 1.3; want = ctx.dir; }
		const w = W();
		const zoneSpd = w && w.zoneMod ? w.zoneMod(m, 'speed') : 1;
		const sp = K.speed * (run ? 1.25 : 1) * (m.slowTimer > 0 ? 0.45 : 1) * (m.castFlash > 10 || m.wind ? 0.55 : 1) * (1 + 0.8 * (w ? w.reinforcedValue(m, 'moveForce') : 0)) * zoneSpd;
		const target = want * sp;
		if(Math.abs(m.vx) > sp * 1.4 && sgn(m.vx) !== sgn(target || m.vx)) m.vx *= 0.9;          // a launch carries
		else if(Math.abs(m.vx) > sp * 1.4) m.vx *= 0.97;
		else m.vx += (target - m.vx) * (m.onGround ? 0.25 : 0.09);
		if(Math.abs(m.vx) > 0.2 && m.onGround) m.walk += Math.abs(m.vx) * 0.12;
	}

	/* =====================================================================
	   ASTER VAEL, THE BOUNDLESS — an Infinity + Gravity boss.
	   An original character whose moveset follows the classic "limitless" sorcerer archetype. Every attack is a real rune
	   spell cast through the same engine as yours (his book is in KINDS.aster.spells), coloured with the Colour rune:
	   · Boundless       — Spatial energy made into an Infinity source, drawn out and reinforced into himself: the same
	                       Infinity layer you can build. Your energy slows and never arrives; anything that does is nullified
	                       while it holds. Hits drain it until it shatters; Anti-Magic suppresses it; your sure-hit domain
	                       bypasses it; it lapses while he forms the Violet Void and during his burnout.
	   · Azure Collapse  — a Gravity Infinity source formed in his hand; energy drawn from it (Infinity Gravity) is placed
	                       past you: it drags you in, crushes you at its core, then implodes (Discharge).
	   · Crimson Repulse — Reverse Gravity drawn from Infinity, fired at you; it discharges on contact and hurls you away.
	   · Point Blank     — the same, discharged at his hand.
	   · Azure Strikes   — he blinks behind you and throws three kinetic fists.
	   · Maximum Azure   — an Infinity Gravity source formed over you; drawn energy sinks onto you and implodes.
	   · Violet Void     — an Azure and a Crimson Infinity source forced together: opposing Infinity tears space (a spatial
	                       rupture) that erases every spell it touches. He steers it at you.
	   · Domain: Endless Expanse — a closed sure-hit domain that opens with Overwhelm (you cannot act for a moment), with
	                       rules of fists, Crimson bursts and Azure wells. Burnout afterwards: no techniques, Boundless down.
	   ===================================================================== */
	const BOSS = { hp: 4200, speed: 7.6, jump: 16.5, layerHold: 0.9,
		SRC_LIFE: { boundless: 1.0, azure: 1.1, crimson: 1.0, reversal: 0.7, maxazure: 1.8, bluered: 1.1 } };      // seconds his Infinity sources are kept before he lets them go
	function bossCd(m, key, s){ const B = m.B; B.cd[key] = s * (B.phase >= 3 ? 0.72 : 1); }
	function bossInit(m){
		m.boss = true; m.isBoss = true;
		m.B = { phase: 1, cd: { boundless: 0, azure: 1.4, crimson: 1.0, strikes: 2.2, violet: 7, maxazure: 9, domain: 4, reversal: 0, bluered: 4, blink: 0 },
			act: null, plan: null, pcd: { lapse: 1.5, blink: 2.5, repel: 1, void: 8, hollow: 10, domain: 6 }, rest: 0.6, ghosts: [], fx: [], used: {}, blocked: 0, lastSay: 0, srcs: {}, hover: 0, downWhy: '', layerMax: 1, lapseUntil: 0 };
		m.blockHit = (dmg, info) => bossBlock(m, dmg, info);
	}
	/* his Infinity layer is an ordinary reinforcement of the engine (st.inf > 0 on him) */
	function bossLayer(m){ const w = W(); return w ? w.reinf.find(st => st.ref === m && st.inf > 0 && st.energy > 0) : null; }
	function playerDomainOn(m){
		const w = W(); if(!w || !w.domains) return null;
		return w.domains.find(D => D.alive && D.ownerId === 'player' && D.sureHit && Math.hypot(D.x - cx(m), D.y - cy(m)) < D.r) || null;
	}
	function bossBarrierUp(m){
		if(!m.B || m.dead) return false;
		const st = bossLayer(m), w = W();
		return !!(st && !(st.suppressed > w.time) && !playerDomainOn(m));
	}
	function bossLapse(m, s, why){ const st = bossLayer(m), w = W(); if(st && w) st.suppressed = Math.max(st.suppressed || 0, w.time + s); m.B.downWhy = why; m.B.lapseUntil = Math.max(m.B.lapseUntil, m.t + s); }
	function bossBlock(m, dmg, info){
		if(info && info.rupture){ m._letThrough = (m._letThrough || 0) + dmg; return false; }      // torn space is not slowed by Infinity: a Hollow Purple goes straight through
		if(!bossBarrierUp(m)) return false;
		const B = m.B, st = bossLayer(m);
		st.energy -= dmg * BOSS.layerHold; B.blocked += dmg;
		if(env.say && m.t - B.lastSay > 0.35){ B.lastSay = m.t; env.say(cx(m) + rnd(-20, 20), m.y - 18, '∞', '#9fe8ff'); }
		B.fx.push({ k: 'ripple', x: info && info.x != null ? info.x : cx(m), y: info && info.y != null ? info.y : cy(m), t: 0, life: 0.35 });
		if(st.energy <= 1){
			st.energy = 0; B.downWhy = 'shattered';
			B.cd.boundless = Math.max(B.cd.boundless, 3.5);
			if(env.say) env.say(cx(m), m.y - 44, 'Boundless shattered!', '#ffffff');
			B.fx.push({ k: 'shatter', x: cx(m), y: cy(m), t: 0, life: 0.6 });
			const h = env.host && env.host(); if(h && h.shake) h.shake(6);
		}
		return true;
	}
	/* --- small helpers --- */
	const pc = (p) => ({ x: cx(p), y: cy(p) });
	function bossSay(m, text, color){ label(m, text); if(env.say) env.say(cx(m), m.y - 40, text, color || '#c9b6ff'); }
	function bossBlink(m, x, y){
		const B = m.B;
		B.ghosts.push({ x: m.x, y: m.y, f: m.facing, t: 0 });
		B.fx.push({ k: 'blink', x: cx(m), y: cy(m), t: 0, life: 0.3 });
		x = clamp(x, 30, worldW() - 30); y = Math.min(y, groundY() - m.h / 2 - 1);
		const h = env.host && env.host();
		let ok = false;
		if(h && h.teleport) ok = h.teleport(m, x, y);
		if(!ok){ m.x = x - m.w / 2; m.y = y - m.h / 2; }
		m.vx = 0; m.vy = Math.min(0, m.vy);
		B.fx.push({ k: 'blink', x: cx(m), y: cy(m), t: 0, life: 0.3 });
		B.used.blink = (B.used.blink || 0) + 1;
	}
	/* cast one of his spells; his Infinity sources are let go a moment after he has drawn from them */
	function bossCast(m, key, aim, lock){
		const s = spellOf(m, key); if(!s) return null;
		m.cds[key] = 0;
		const inst = cast(m, key, aim, lock);
		if(inst){ m.B.srcs[inst.id] = { t: m.t, life: BOSS.SRC_LIFE[key] || 1.2 }; m.B.lastCast = key; }
		return inst;
	}
	function bossTidy(m){
		const w = W(); if(!w) return;
		for(const b of w.bodies){
			if(!b.alive || !b.infSource || b.ownerId !== m.owner.id) continue;
			const S = m.B.srcs[b.inst];
			if(!S || m.t - S.t > S.life){ b.amount = 0; try { w.T.kill(b, 'fade'); } catch(e){ b.alive = false; } }
		}
		// a Blue or Red that found nothing to burst on does not linger on the field
		for(const b of w.bodies){
			if(!b.alive || b.ownerId !== m.owner.id || b.isZone || b.zoneBlob || b.infSource || b.drawing) continue;
			if(b.age > (b.rupture ? 3.4 : b.infDerived ? 3.2 : 9)){ b.amount = 0; try { w.T.kill(b, 'fade'); } catch(e){ b.alive = false; } }
		}
		for(const id in m.B.srcs) if(m.t - m.B.srcs[id].t > 12) delete m.B.srcs[id];
	}
	/* where the energy will meet you: led by the perceived motion (his reaction is fast but not instant) */
	const nowS = (m, c) => (m.ctx && m.ctx.S) || c.S;
	/* his own energy still at work on the field (a Blue, a Red, a Void, energy on its way to become one): his next
	   projectile waits for it, so his spells never pull, push or tear into each other by accident */
	function fieldBusy(m){
		const w = W(); if(!w) return 0;
		let n = 0;
		for(const b of w.bodies){
			if(!b.alive || b.ownerId !== m.owner.id || b.isZone || b.zoneBlob || b.infSource) continue;
			if(b.rupture){ const p = P(); if(p && Math.hypot(b.x - cx(p), b.y - cy(p)) < 520) n++; continue; }      // a Void that has passed you no longer matters
			if(b.infDerived || (b.tint && b.tech && b.tech.gravity) || (b.tint && !b.tech && b.amount > 300)) n++;
		}
		return n;
	}
	const ownOf = (m, key) => { const w = W(); if(!w) return []; return w.bodies.filter(b => b.alive && b.ownerId === m.owner.id && m.instKey[b.inst] === key && !b.infSource && !b.isZone && !b.zoneBlob); };
	/* --- his moves: each one cast, with its own tell; plans string them together --- */
	const BOSS_MOVES = {
		boundless: {
			name: 'Boundless', wind: 0.3, col: '#e8fbff',
			fire(m, p, c){ if(bossCast(m, 'boundless')) bossCd(m, 'boundless', 6); else bossCd(m, 'boundless', 1.5); },
			hold: 0.6
		},
		azure: {
			name: 'Azure Collapse', wind: 0.4, col: '#3f9dff', busy: true,
			// placed just short of you (seen from him): it drags you toward him, then implodes
			fire(m, p, c){
				const aim = (age) => { const S = nowS(m, c), Lp = lead(S, 0.4), dir = sgn(cx(m) - Lp.x); return { x: Lp.x + dir * 70, y: Math.min(Lp.y - 10, groundY() - 40) }; };
				bossCast(m, 'azure', aim, 1.1);
			},
			hold: 0.9
		},
		crimson: {
			name: 'Crimson Repulse', wind: 0.45, col: '#ff3048', busy: true,
			// the drawn energy leaves his hand ~0.55 s after the cast and flies at 9: aimed where you will be when it arrives
			fire(m, p, c){
				const aim = (age) => { const S = nowS(m, c), d = Math.hypot(S.x - cx(m), S.y - cy(m)); return lead(S, Math.max(0, 0.55 - age) + d / 9 / 60); };
				bossCast(m, 'crimson', aim, 0.9);
			},
			hold: 0.7
		},
		reversal: {
			name: 'Crimson Repulse', wind: 0.18, col: '#ff3048',
			fire(m, p, c){ bossCast(m, 'reversal', () => pc(p), 0.5); },
			hold: 0.5
		},
		strikes: {
			name: 'Azure Strikes', wind: 0.12, col: '#9fd8ff',
			fire(m, p, c){
				const pp = pc(p), behind = -sgn(p.vx || (cx(m) - pp.x)) || 1;
				bossBlink(m, pp.x + behind * 70, pp.y);
				m.facing = sgn(pp.x - cx(m));
				bossCast(m, 'strikes', () => pc(p), 0.7);      // three fists at you, the last one heaviest
			},
			hold: 0.65, still: true
		},
		violet: {
			name: 'Violet Void', wind: 0.35, col: '#a24dff', hover: true,
			say: (m) => m.B.phase >= 3 ? 'Violet Void: Unbound' : 'Violet Void',
			// the two sources meet at a point in front of him; the rupture is then sent at you
			fire(m, p, c){
				const f = m.facing, pt = { x: cx(m) + f * 175, y: cy(m) - 70 };
				bossCast(m, m.B.phase >= 3 ? 'violet2' : 'violet', () => pt, 1.4);
				bossLapse(m, 1.6, 'forming the Void');      // the Boundless lapses while he forces the two together — punish it
			},
			hold: 1.2, still: true
		},
		maxazure: {
			name: 'Maximum Azure', wind: 0.45, col: '#3f9dff', hover: true, busy: true, say: () => 'Maximum Azure',
			// first the point over your head where the source forms; once its energy is drawn, you (it sinks onto you)
			fire(m, p, c){
				const aim = (age) => { const S = nowS(m, c); if(age < 1.4){ const Lp = lead(S, 0.6); return { x: Lp.x, y: Math.max(60, groundY() - 330) }; } return lead(S, 0.6); };
				bossCast(m, 'maxazure', aim, 3.2);
			},
			hold: 1.0
		},
		domain: {
			name: 'Endless Expanse', wind: 0.6, col: '#e3d6ff', hover: true, say: () => 'Domain Expansion: Endless Expanse',
			fire(m, p, c){ if(bossCast(m, 'domain')) m.B.used.domain = (m.B.used.domain || 0) + 1; },
			hold: 0.4, still: true
		}
	};
	/* --- his plans: moves that work together, with the waits between them --- */
	const S_ = {
		move: (k) => ({ k: 'move', move: k }),
		wait: (s) => ({ k: 'wait', s }),
		until: (fn, timeout) => ({ k: 'until', fn, timeout: timeout || 2 }),
		do: (fn) => ({ k: 'do', fn }),
		melee: (keys, range) => ({ k: 'melee', keys, range })      // a string of weapon attacks (chained like yours)
	};
	const azureDone = (m, c) => { const a = ownOf(m, 'azure'); if(!a.length) return true; const p = c.S; return a.some(b => Math.hypot(b.x - p.x, b.y - p.y) < 110); };
	const domainOpen = (m) => { const w = W(); return !!(w && w.domains && w.domains.some(D => D.alive && D.ownerId === m.owner.id)); };
	const BOSS_PLANS = {
		boundless:  { name: 'Boundless', cd: 1, score: (m, c) => bossLayer(m) ? 0 : 8, steps: () => [ S_.move('boundless') ] },
		lapse:      { name: 'Lapse Strike', cd: 7, score: (m, c) => c.d > 200 && c.d < 750 ? 1.3 : 0.2,
			// Blue drags you in toward him; when it has you (or it has imploded) he blinks in with his fists
			steps: () => [ S_.move('azure'), S_.until((m, c) => azureDone(m, c), 2.6), S_.move('strikes') ] },
		repel:      { name: 'Repel', cd: 4, score: (m, c) => c.d > 260 && c.d < 900 ? 1.1 : 0.3, steps: () => [ S_.move('crimson') ] },
		closeBurst: { name: 'Point Blank', cd: 4, score: (m, c) => c.d < 140 ? 2.6 : 0, steps: () => [ S_.move('reversal') ] },
		blink:      { name: 'Blink Combo', cd: 6, score: (m, c) => c.d < 520 ? 1.1 : 0.4,
			// fists that knock you away, then Red where you land
			steps: () => [ S_.move('strikes'), S_.wait(0.45), S_.move('crimson') ] },
		void:       { name: 'Void', cd: 12, score: (m, c) => m.B.phase >= 2 && c.d > 260 ? 1.2 : 0, steps: () => [ S_.move('violet') ] },
		hollow:     { name: 'Collapse and Void', cd: 18, score: (m, c) => m.B.phase >= 2 ? 1.3 : 0,
			// Maximum Azure lifts you and holds you in the air — the Void is sent at the one place you cannot dodge from
			steps: () => [ S_.move('maxazure'), S_.wait(1.1), S_.move('violet') ] },
		domain:     { name: 'Domain', cd: 40, score: (m, c) => m.B.phase >= 2 && c.d < 600 ? 3 : 0,
			// a vast domain for a moment: you are overwhelmed, he strikes once, it is over
			steps: () => [ S_.move('domain'), S_.until((m) => domainOpen(m), 2.4), S_.move('strikes') ] },
		blueRed:    { name: 'Blue then Red', cd: 9, score: (m, c) => m.B.phase >= 3 && c.d < 700 ? 1.4 : 0,
			// Blue pulls you in and implodes; only then Red throws you out (never the two at once by accident)
			steps: () => [ S_.move('azure'), S_.until((m, c) => azureDone(m, c), 2.6), S_.wait(0.25), S_.move('crimson') ] },
		limitless:  { name: 'Limitless', cd: 16, score: (m, c) => m.B.phase >= 3 ? 1.2 : 0,
			steps: () => [ S_.move('azure'), S_.until((m, c) => azureDone(m, c), 2.6), S_.move('strikes'), S_.wait(0.5), S_.move('violet') ] }
	};
	function bossStartMove(m, key, c){
		const M = (m.K.moves || BOSS_MOVES)[key];
		m.B.act = { key, t: 0, wind: M.wind, col: M.col, name: M.name, hover: !!M.hover, fired: false };
		m.wind = { t: 0, dur: M.wind };
		if(M.say) bossSay(m, M.say(m), M.col); else label(m, M.name);
		m.B.used[key] = (m.B.used[key] || 0) + 1;
	}
	function bossRunMove(m, p, c, dt){
		const a = m.B.act, M = (m.K.moves || BOSS_MOVES)[a.key];
		a.t += dt; if(m.wind) m.wind.t = a.t;
		if(M.still) m.vx *= 0.6;
		if(!a.fired && a.t >= a.wind){ a.fired = true; m.wind = null; try { M.fire(m, p, c); } catch(e){ m.lastErr = e.message; } }
		return a.t < a.wind + M.hold;
	}
	function bossChoosePlan(m, c){
		const B = m.B, burnt = c.burnout > 0;
		if(burnt) return false;      // burnout: no techniques
		let best = null, bs = 0;
		const PL = m.K.plans || BOSS_PLANS;
		for(const k in PL){
			const P = PL[k];
			if((B.pcd[k] || 0) > 0) continue;
			if(k === 'domain' && c.domain) continue;
			let s = P.score(m, c); if(!(s > 0)) continue;
			if(k === B.lastPlan && k !== 'boundless') s *= 0.4;
			s *= 0.75 + Math.random() * 0.5;
			if(s > bs){ bs = s; best = k; }
		}
		if(!best) return false;
		const P = PL[best];
		B.plan = { key: best, name: P.name, steps: P.steps(), i: 0, t: 0 };
		B.pcd[best] = P.cd * (B.phase >= 3 ? 0.8 : 1);
		B.lastPlan = best;
		m.stats.tactics[P.name] = (m.stats.tactics[P.name] || 0) + 1;
		if(API.log) API.log(m, 'plan ' + best);
		return true;
	}
	function bossRunPlan(m, p, c, dt){
		const B = m.B, P = B.plan;
		if(B.act){ if(!bossRunMove(m, p, c, dt)){ B.act = null; P.i++; P.t = 0; } return; }
		const st = P.steps[P.i];
		if(!st){ B.plan = null; B.rest = m.K.rest ? rnd(m.K.rest[0], m.K.rest[1]) : B.phase >= 3 ? rnd(0.4, 0.7) : B.phase === 2 ? rnd(0.55, 0.9) : rnd(0.7, 1.1); return; }
		P.t += dt;
		if(st.k === 'wait'){ if(P.t >= st.s){ P.i++; P.t = 0; } return; }
		if(st.k === 'until'){ if(st.fn(m, c) || P.t >= st.timeout){ P.i++; P.t = 0; } return; }
		if(st.k === 'do'){ try { st.fn(m, c); } catch(e){ m.lastErr = e.message; } P.i++; P.t = 0; return; }
		if(st.k === 'melee'){ const r = meleeStep(m, p, c, st, P); if(r === 'abort'){ B.plan = null; B.rest = 0.2; } else if(!r){ P.i++; P.t = 0; } return; }
		if(st.k === 'move'){
			const M = (m.K.moves || BOSS_MOVES)[st.move];
			if(c.burnout > 0){ B.plan = null; B.rest = 0.5; return; }
			// a projectile waits until his own last one has done its work (at most 2.5 s, then the plan is dropped)
			if(M.busy && fieldBusy(m) > 0){ if(P.t > 2.5){ B.plan = null; B.rest = 0.3; } return; }
			bossStartMove(m, st.move, c);
		}
	}
	/* --- movement: very fast, always repositioning, blinks to close in and to get out of trouble --- */
	function bossMove(m, c, dt){
		const B = m.B, spd = BOSS.speed * (B.phase >= 3 ? 1.15 : 1) * (m.slowTimer > 0 ? 0.6 : 1);
		const a = B.act, burnt = c.burnout > 0;
		const want = burnt ? 520 : (B.phase >= 2 ? 340 : 300);      // in burnout he keeps his distance
		let goal = 0;
		if(!a){
			if(c.absDx > want + 160) goal = c.dir;
			else if(c.absDx < want - 140) goal = -c.dir;
			else { B.strafeT = (B.strafeT || 0) - dt; if(B.strafeT <= 0){ B.strafe = Math.random() < 0.5 ? -1 : 1; B.strafeT = rnd(0.4, 1.0); } goal = B.strafe * 0.5; }
			if(c.edge < 120) goal = cx(m) < worldW() / 2 ? 1 : -1;
			if(c.d > 950 && B.cd.blink <= 0 && !burnt){ B.cd.blink = 1.6; const Lp = lead(c.S, 0.2); bossBlink(m, Lp.x - c.dir * want, Math.min(Lp.y, groundY() - 40)); }
			if(m.onGround && Math.random() < 0.008 && m.jumpCd <= 0){ m.vy = -BOSS.jump; m.jumpCd = 1.2; }
		}
		m.vx += (goal * spd - m.vx) * 0.22;
		if(Math.abs(c.dx) > 8 && !(a && a.key === 'strikes')) m.facing = c.dir;
		// a threat he can't simply let his Boundless take (it is down, or Anti-Magic is coming): blink out of its way
		if(B.cd.blink <= 0 && c.threat.length){
			const up = bossBarrierUp(m), th = c.threat[0];
			const anti = th.b.tech && th.b.tech.antimagic > 0.05;
			if((anti || !up) && th.eta < 0.45 && Math.random() < 0.85){
				B.cd.blink = 1.3;
				const side = Math.random() < 0.5 ? -1 : 1;
				bossBlink(m, cx(m) + side * rnd(220, 360), cy(m) - rnd(0, 90));
			}
		}
		if(B.phase >= 2 && !a && Math.random() < 0.003) B.hover = rnd(1.5, 3);
		if(B.hover > 0) B.hover -= dt;
		return !!((a && a.hover) || (B.phase >= 2 && B.hover > 0));
	}
	/* his signature models: which look each of his energies wears (the energy itself is ordinary) */
	function bossSkins(m){
		const w = W(); if(!w) return;
		for(const b of w.bodies){
			if(!b.alive || b.ownerId !== m.owner.id || b.isZone) continue;
			// his domain is fuelled straight from him: its energy is not shown as drifting pieces (the void itself is the look)
			if(b.zoneBlob){ b.skin = 'aster.hidden'; continue; }
			const key = m.instKey[b.inst] || '', g = b.tech ? (b.tech.gravity || 0) : 0;
			let s = null;
			if(b.rupture) s = 'aster.violet';
			else if(b.infSource) s = (b.tech && b.tech.spatial > 0.05) ? 'aster.boundlessCore' : (g < 0 ? 'aster.crimsonCore' : 'aster.azureCore');
			else if(b.infDerived) s = g < 0 ? 'aster.crimson' : (key === 'maxazure' ? 'aster.azureMax' : 'aster.azure');
			else if(b.tech && b.tech.kinetic > 0.05) s = 'aster.strike';
			else if(b.tint && !b.tech) s = b.tint.mid === '#ff3048' ? 'aster.crimsonSeed' : 'aster.azureSeed';
			else if(b.tint && g) s = g < 0 ? 'aster.crimsonSeed' : 'aster.azureSeed';
			b.skin = s;
		}
	}
	/* --- the boss's frame (replaces the mage mind) --- */
	function bossFrame(m, p, ctx, dt){
		const B = m.B, w = W();
		for(const k in B.cd) if(B.cd[k] > 0) B.cd[k] -= dt;
		for(const k in B.pcd) if(B.pcd[k] > 0) B.pcd[k] -= dt;
		const hpPct = m.hp / m.maxHp;
		if(B.phase === 1 && hpPct < 0.6){ B.phase = 2; bossSay(m, 'The Boundless awakens', '#9fe8ff'); B.pcd.domain = Math.min(B.pcd.domain || 0, 3); B.pcd.void = Math.min(B.pcd.void || 0, 5); B.hover = 2; }
		if(B.phase === 2 && hpPct < 0.25){ B.phase = 3; bossSay(m, 'Unbound', '#ffffff'); B.pcd.limitless = 0; if((B.pcd.domain || 0) > 18) B.pcd.domain = 18; }
		bossTidy(m);
		bossSkins(m);
		const st = bossLayer(m);
		if(st) B.layerMax = Math.max(B.layerMax || 1, st.energy); else B.layerMax = 1;
		// your sure-hit domain around him: his Infinity does nothing there
		if(st && playerDomainOn(m)) st.suppressed = Math.max(st.suppressed || 0, w.time + 0.1);
		// burnout after his domain: no techniques — and no Boundless
		if(ctx && ctx.burnout > 0){ if(!B.burnSaid){ B.burnSaid = true; if(env.say) env.say(cx(m), m.y - 44, 'Burnout — the Boundless is down', '#ffffff'); } bossLapse(m, 0.1, 'burnout'); }
		else B.burnSaid = false;
		// your blows stop short of him (not only spells)
		if(bossBarrierUp(m) && p){
			const pp = pc(p), d = Math.hypot(pp.x - cx(m), pp.y - cy(m)), floor = 66;
			if(d < floor){ const h = env.host && env.host(), k = Math.min(5, floor - d); if(h && h.nudge) h.nudge(p, (pp.x - cx(m)) / (d || 1) * k, 0); }
		}
		if(!p) return false;
		if(m.stunTimer > 0){ B.act = null; B.plan = null; m.wind = null; }
		else if(B.plan) bossRunPlan(m, p, ctx, dt);
		else {
			B.rest -= dt;
			if(B.rest <= 0 && !bossChoosePlan(m, ctx)) B.rest = 0.25;
		}
		return bossMove(m, ctx, dt);
	}
	/* =====================================================================
	   THE MELEE FIGHTERS (Kael, Brannoc, Sythe) — the boss's planner on a close-quarters body: they pick plans of moves
	   (each move a real rune spell or a step), keep to arm's reach while a plan runs and circle you between them.
	   ===================================================================== */
	function plannerInit(m){
		m.B = { phase: 1, cd: { blink: 0 }, act: null, plan: null, pcd: {}, rest: 0.9, ghosts: [], fx: [], used: {}, srcs: {}, hover: 0, downWhy: '', layerMax: 1, lapseUntil: 0 };
	}
	/* where a blow should go: at you (a little ahead if you move), lifted by dy */
	function meleeAim(m, p, dy){ const S = (m.ctx && m.ctx.S) || { x: cx(p), y: cy(p), vx: 0, vy: 0, ground: true }; const L0 = lead(S, 0.12); return { x: L0.x, y: L0.y + (dy || 0) }; }
	function meleeMove(m, c, dt){
		const K = m.K, B = m.B, a = B.act;
		const spd = K.speed * (m.slowTimer > 0 ? 0.6 : 1) * (1 + 0.4 * (W() ? W().reinforcedValue(m, 'moveForce') : 0));
		if(m.leaping){ m.vx = m._leapVx || 0; if(m.onGround && m.vy >= 0 && (m._leapT = (m._leapT || 0) + dt) > 0.15){ m.leaping = false; m._leapT = 0; } return; }
		// a dash: a short burst of speed (like yours)
		if(m._dashT > 0){ m._dashT--; m.vx = m._dashDir * (K.dashSpeed || 12); if(m._dashT % 3 === 0) B.ghosts.push({ x: m.x, y: m.y, f: m.facing, t: 0.15 }); return; }
		// mid-swing: rooted in the startup, carried by the lunge, then settling
		if(m.mel){ const ph = m.mel.phase; m.vx *= ph === 'startup' ? 0.78 : ph === 'active' ? 0.94 : 0.82; if(Math.abs(m.vx) > 0.2 && m.onGround) m.walk += Math.abs(m.vx) * 0.12; return; }
		const stepNow = B.plan && B.plan.steps[B.plan.i];
		const want = stepNow && stepNow.k === 'melee' ? 14 : (B.plan ? K.engage : K.idle);      // a string to throw: walk right into reach
		let goal = 0;
		const M = a ? (K.moves[a.key] || {}) : null;
		if(!(M && M.still)){
			if(c.absDx > want + 30) goal = c.dir;
			else if(c.absDx < want - 45) goal = -c.dir * 0.8;
			else { B.strafeT = (B.strafeT || 0) - dt; if(B.strafeT <= 0){ B.strafe = Math.random() < 0.5 ? -1 : 1; B.strafeT = rnd(0.35, 0.8); } goal = B.plan ? 0 : B.strafe * 0.45; }
			// don't stand inside you between blows: keep a body's width apart
			if(c.absDx < 26 && !m.mel && m.onGround && !c.pAbove) goal = -c.dir * 0.7;
			if(c.edge < 90) goal = cx(m) < worldW() / 2 ? 1 : -1;
			// you are above: jump to you
			if(c.pAbove && c.absDx < 220 && m.onGround && m.jumpCd <= 0){ m.vy = -K.jump; m.jumpCd = 0.9; }
			// something in the way on the ground: hop it
			if(m.onGround && Math.abs(m.vx) < 0.5 && Math.abs(goal) > 0.5 && m.jumpCd <= 0 && c.absDx > want + 30){ m.vy = -K.jump * 0.85; m.jumpCd = 0.7; }
		}
		m.vx += (goal * spd - m.vx) * (m.onGround ? 0.3 : 0.1);
		if(Math.abs(c.dx) > 6) m.facing = c.dir;
		// a spell coming at them: Sythe steps out of it through space, the others jump or roll aside (a skill chance)
		B.dodgeCd = (B.dodgeCd || 0) - dt;
		if(c.threat.length && B.dodgeCd <= 0){
			const th = c.threat[0];
			if(th.eta < 0.4){
				B.dodgeCd = 1.0;
				if(Math.random() < K.dodge){
					if(K.dodgeBlink && B.cd.blink <= 0){ B.cd.blink = 1.4; bossBlink(m, cx(m) + (Math.random() < 0.5 ? -1 : 1) * rnd(180, 260), cy(m) - 10); }
					else if(m.onGround){ m.vy = -K.jump * 0.9; m.vx = (Math.random() < 0.5 ? -1 : 1) * spd; }
				}
			}
		}
		if(Math.abs(m.vx) > 0.2 && m.onGround) m.walk += Math.abs(m.vx) * 0.12;
	}
	/* =====================================================================
	   NPC MELEE — the fighters swing the same weapons you do (window.MELEE_WEAPONS): every attack keeps its startup,
	   active and recovery frames, its hitbox, lunge, plunge, launch and knockback, chains into the next one during its
	   cancel window, pauses on hit (hitstop), and can be parried by you (they are a threat while they swing).
	   ===================================================================== */
	const fWeapon = (m) => { const W0 = root.MELEE_WEAPONS && root.MELEE_WEAPONS.weapons; return W0 && m.K.weapon ? W0[m.K.weapon] : null; };
	const overlapR = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
	function meleePhase(A){
		const d = A.def, t = A.t, rec = d.recovery + (A.missExtra || 0);
		if(t < d.startup) return 'startup';
		if(t < d.startup + d.active) return 'active';
		if(t < d.startup + d.active + d.cancel) return 'cancel';
		if(t < d.startup + d.active + d.cancel + rec) return 'recovery';
		return 'done';
	}
	/* which way the blow goes: at you, lifted for a launcher, down for a plunge */
	function meleeAimVec(m, p, def){
		const dx = cx(p) - cx(m), dy = cy(p) - (m.y + m.h * 0.42);
		let x = dx, y = dy;
		if(def.attackType === 'launcher') { x = sgn(dx) * 0.55; y = -1; }
		else if(def.attackType === 'downward' || def.plunge) { x = sgn(dx) * 0.3; y = 1; }
		else { const l = Math.hypot(x, y) || 1; x /= l; y = clamp(y / l, -0.55, 0.55); }
		const l = Math.hypot(x, y) || 1;
		return { x: x / l || m.facing, y: y / l };
	}
	function meleeStart(m, p, key){
		const w = fWeapon(m), base = w && w.moves[key]; if(!base) return false;
		const def = Object.assign({}, base, { hitbox: Object.assign({}, base.hitbox), knockback: Object.assign({}, base.knockback) });
		const aim = meleeAimVec(m, p, def);
		m.facing = aim.x >= 0 ? 1 : -1;
		m.mel = { key, def, t: 0, phase: 'startup', aim, confirmed: false, missExtra: 0, lunged: false, stop: 0, hit: false, pulse: 0 };
		m._swing = def.startup + def.active;
		m.stats.casts['m:' + key] = (m.stats.casts['m:' + key] || 0) + 1;
		if(def.attackType === 'heavy' && def.poiseDamage >= 6) label(m, def.name);
		return true;
	}
	/* the attack's hit area (the same shape as yours: a box at reach along the aim, turned with the aim) */
	function meleeRect(m, A){
		const d = A.def, hb = d.hitbox || { ox: 24, oy: 0, w: 36, h: 24 };
		let aim = { x: A.aim.x, y: A.aim.y };
		if((d.sweep || d.motion === 'cleave' || d.motion === 'chargeCleave') && A.phase === 'active'){
			const u = d.active <= 1 ? 1 : (A.t - d.startup) / d.active, sw = (u - 0.45) * (d.motion === 'chargeCleave' ? 1.7 : (d.sweep ? 1.9 : 1.25)) * m.facing;
			const c = Math.cos(sw), s = Math.sin(sw); aim = { x: aim.x * c - aim.y * s, y: aim.x * s + aim.y * c };
		}
		let reach = Math.max(12, Math.hypot(hb.ox || 0, hb.oy || 0));
		if(d.motion === 'spin' || d.motion === 'slam') reach *= 0.35;
		const px = cx(m), py = m.y + m.h * 0.42, ccx = px + aim.x * reach, ccy = py + aim.y * reach;
		const long = Math.max(18, hb.w || 36), thick = Math.max(14, hb.h || 24);
		const hw = Math.abs(aim.x) * long * 0.5 + Math.abs(aim.y) * thick * 0.5, hh = Math.abs(aim.y) * long * 0.5 + Math.abs(aim.x) * thick * 0.5;
		return { x: ccx - hw, y: ccy - hh, w: Math.max(14, hw * 2), h: Math.max(14, hh * 2) };
	}
	function meleeTick(m, p){
		const A = m.mel; if(!A) return;
		if(A.stop > 0){ A.stop--; m.vx *= 0.5; m.vy *= 0.5; return; }      // hitstop: the blow lands, everything holds for a moment
		const d = A.def, prev = A.phase;
		A.t++; A.phase = meleePhase(A);
		m._swing = (A.phase === 'startup' || A.phase === 'active') ? 2 : 0;
		if(prev === 'startup' && A.phase === 'active' && !A.lunged){
			A.lunged = true;
			m.vx = m.facing * (d.lunge || 0) * 1.25;
			if(d.plunge) m.vy = d.plunge;
			if(d.hop){ m.vx += m.facing * d.hop.x * 0.4; m.vy = d.hop.y; }
			if(d.motion === 'rise') m.vy = Math.min(m.vy, -11);
		}
		if(A.phase === 'active' && p){
			if(d.pulses && d.pulseEvery){ const pulse = Math.floor((A.t - d.startup) / d.pulseEvery); if(pulse !== A.pulse){ A.pulse = pulse; A.hit = false; } }
			if(!A.hit && overlapR(meleeRect(m, A), { x: p.x, y: p.y, w: p.w, h: p.h })){
				A.hit = true; A.confirmed = true;
				const dmg = d.damage * (m.K.meleeMul || 1), dir = A.aim.x >= 0 ? 1 : -1;
				const kx = (d.knockback.x || 0) * Math.max(0.35, Math.abs(A.aim.x)) * dir, ky = (d.knockback.y || 0) + A.aim.y * Math.abs(d.knockback.x || 0) * 0.8;
				const res = env.meleeHitPlayer ? env.meleeHitPlayer(dmg, kx, ky, d.knockback.duration || 10, d.hitstun || 8, { x: cx(p), y: cy(p), color: m.K.color, attacker: m, name: d.name })
					: (env.hurtPlayer ? (env.hurtPlayer(dmg, { x: cx(p), y: cy(p) }, m), 'hit') : 'hit');
				if(res === 'parried'){ m.stunTimer = Math.max(m.stunTimer, 34); m._kbVx = -dir * 6; m._kbVy = -2; m._kbTimer = 10; m.mel = null; m._swing = 0; return; }
				if(res !== 'missed'){ m.stats.dmg['m:' + A.key] = (m.stats.dmg['m:' + A.key] || 0) + dmg; A.stop = d.hitstop || 2; }
			}
		}
		if(prev === 'active' && A.phase !== 'active' && !A.confirmed) A.missExtra = d.missRecovery || 0;
		// an air attack ends when he lands (a plunge that hit bounces him back up)
		if(d.aerial && m.onGround && A.phase !== 'startup' && A.t > 2){ if(d.plunge && A.confirmed) m.vy = -9; m.mel = null; m._swing = 0; return; }
		if(A.phase === 'done'){ m.mel = null; m._swing = 0; }
	}
	/* a plan step: a string of attacks — walk into reach, then swing; the next one chains in the cancel window */
	function meleeStep(m, p, c, st, P){
		st.i = st.i || 0;
		const A = m.mel;
		if(A){
			if(A.phase === 'cancel' && st.i < st.keys.length && !m.K.noChain){
				const w = fWeapon(m), nd = w && w.moves[st.keys[st.i]];
				if(nd && !(nd.aerial && m.onGround)){ meleeStart(m, p, st.keys[st.i]); st.i++; }
			}
			return true;
		}
		if(st.i >= st.keys.length) return false;
		const w = fWeapon(m), def = w && w.moves[st.keys[st.i]];
		if(!def){ st.i++; return true; }
		if(def.aerial && m.onGround){ st.i++; return true; }                     // an air attack after he has already landed: skip it
		if(def.ground && !def.aerial && !m.onGround){ return P.t < 1.2 ? true : 'abort'; }     // a ground attack waits for the ground
		const hb = def.hitbox, reach = (st.range || (Math.hypot(hb.ox || 0, hb.oy || 0) + (hb.w || 36) * 0.5 + 12 + (def.lunge || 0) * 3));
		const dReal = Math.hypot(cx(p) - cx(m), cy(p) - cy(m));      // up close he sees you as you are (no reaction lag on his reach)
		if(dReal > reach){
			// still closing in: a dash when you are a few steps away (the same burst you have), give up after 2 s
			if(m.onGround && !m._dashT && (m.B.cd.dash || 0) <= 0 && dReal > reach + 40 && dReal < 300){ m.B.cd.dash = m.K.dashCd || 1.1; m._dashT = 9; m._dashDir = c.dir; }
			return P.t < 2 ? true : 'abort';
		}
		meleeStart(m, p, st.keys[st.i]); st.i++;
		return true;
	}
	/* Sythe's Rift Step: a portal where she stands, its exit just short of you; she steps through — and it closes */
	function riftStep(m, p, c){
		if(Math.abs(cx(p) - cx(m)) < 170) return;      // already close: no portal needed
		const dir = sgn(cx(p) - cx(m)), ex = clamp(cx(p) - dir * 80, 40, worldW() - 40), ey = Math.min(cy(p), groundY() - m.h / 2 - 2);
		const inst = bossCast(m, 'rift', () => ({ x: ex, y: ey }), 0.8);
		if(inst) m._rift = { inst: inst.id, t: m.t, x0: cx(m), y0: cy(m), ex, ey };
	}
	function riftTick(m){
		const R = m._rift; if(!R) return;
		const w = W(), moved = Math.hypot(cx(m) - R.x0, cy(m) - R.y0) > 120, age = m.t - R.t;
		// she has not been carried through yet: step her into the portal (a short hop forward into it)
		if(!moved && age > 0.45){ const h = env.host && env.host(); m.B.ghosts.push({ x: m.x, y: m.y, f: m.facing, t: 0 }); if(h && h.teleport) h.teleport(m, R.ex, R.ey); else { m.x = R.ex - m.w / 2; m.y = R.ey - m.h / 2; } }
		if((moved && age > 0.28) || age > 0.6){
			// through: the portal closes behind her
			if(w) for(const b of w.bodies) if(b.alive && b.inst === R.inst){ b.amount = 0; try { w.T.kill(b, 'fade'); } catch(e){ b.alive = false; } }
			m.facing = c0dir(m);
			m._rift = null;
		}
	}
	const c0dir = (m) => { const p = P(); return p ? sgn(cx(p) - cx(m)) : m.facing; };

	function plannerFrame(m, p, ctx, dt){
		const B = m.B, w = W();
		// a mirror, a used portal or a blow that hit nothing does not linger
		if(w) for(const b of w.bodies) if(b.alive && b.ownerId === m.owner.id && !b.isZone && !b.zoneBlob && !b.drawing && b.age > (b.spatial ? 3.5 : 4)){ b.amount = 0; try { w.T.kill(b, 'fade'); } catch(e){ b.alive = false; } }
		for(const k in B.cd) if(B.cd[k] > 0) B.cd[k] -= dt;
		for(const k in B.pcd) if(B.pcd[k] > 0) B.pcd[k] -= dt;
		if(!p) return;
		if(m.stunTimer > 0){ B.act = null; B.plan = null; m.wind = null; m.mel = null; m._swing = 0; m.vx *= 0.8; return; }
		meleeTick(m, p);
		riftTick(m);
		if(B.plan) bossRunPlan(m, p, ctx, dt);
		else { B.rest -= dt; if(B.rest <= 0 && !bossChoosePlan(m, ctx)) B.rest = 0.25; }
		meleeMove(m, ctx, dt);
	}

	/* --- drawing --- */
	function drawBoss(ctx, m, camX, camY){
		const B = m.B, t = m.t, a = m.dead ? Math.max(0, 1 - m.deathT / 1.4) : 1;
		const x = cx(m) - camX, foot = m.y + m.h - camY, top = m.y - camY, f = m.facing;
		ctx.save();
		// his domain (the engine's): a vast starfield inside it
		const w = W(), Dm = w && w.domains ? w.domains.find(D => D.alive && D.ownerId === m.owner.id) : null;
		if(Dm){
			const D = { x: Dm.x, y: Dm.y, r: Dm.r, t: w.time - Dm.born, life: Dm.dur }, q = Math.min(1, D.t / 0.4) * Math.min(1, (D.life - D.t) / 0.5), dx = D.x - camX, dy = D.y - camY;
			ctx.globalAlpha = 0.45 * clamp(q, 0, 1);
			const g = ctx.createRadialGradient(dx, dy, 20, dx, dy, D.r);
			g.addColorStop(0, '#0b0820'); g.addColorStop(0.8, '#120a35'); g.addColorStop(1, '#3a2a8a');
			ctx.fillStyle = g; ctx.beginPath(); ctx.arc(dx, dy, D.r, 0, Math.PI * 2); ctx.fill();
			ctx.globalAlpha = 0.85 * q; ctx.fillStyle = '#e8e4ff';
			for(let k = 0; k < 70; k++){ const an = k * 2.399 + t * 0.05, rr = D.r * Math.sqrt(((k * 0.618) % 1)); ctx.fillRect(dx + Math.cos(an) * rr, dy + Math.sin(an) * rr, 1.6, 1.6); }
			ctx.strokeStyle = '#cbbaff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(dx, dy, D.r, 0, Math.PI * 2); ctx.stroke();
			ctx.globalAlpha = 1;
		}
		// after-images of his blinks
		for(let i = B.ghosts.length - 1; i >= 0; i--){
			const gh = B.ghosts[i]; gh.t += 1 / 60; if(gh.t > 0.35){ B.ghosts.splice(i, 1); continue; }
			ctx.globalAlpha = 0.4 * (1 - gh.t / 0.35); ctx.fillStyle = '#7fd6ff';
			ctx.fillRect(gh.x - camX + 6, gh.y - camY + 4, m.w - 12, m.h - 4);
		}
		ctx.globalAlpha = a;
		ctx.save(); ctx.translate(x, foot); ctx.scale(1.3, 1.3); ctx.translate(-x, -foot);      // drawn a head taller than a mage
		// body: a long open coat (midnight blue, silver lining), dark hair swept back, a turning halo of six points
		const bob = m.onGround ? Math.sin(m.walk) * 1.2 : Math.sin(t * 3) * 2, wk = m.onGround ? Math.sin(m.walk) : 0.4;
		const hi = m.flash > 0;
		const aura = ctx.createRadialGradient(x, top + 36, 4, x, top + 36, 58);
		aura.addColorStop(0, '#7fd6ff55'); aura.addColorStop(1, '#7fd6ff00');
		ctx.fillStyle = aura; ctx.beginPath(); ctx.arc(x, top + 36, 58, 0, Math.PI * 2); ctx.fill();
		// legs
		ctx.strokeStyle = hi ? '#fff' : '#0d1020'; ctx.lineWidth = 5; ctx.lineCap = 'round';
		ctx.beginPath(); ctx.moveTo(x - 4, top + 48 + bob); ctx.lineTo(x - 5 - wk * 6, foot - 2); ctx.moveTo(x + 4, top + 48 + bob); ctx.lineTo(x + 5 + wk * 6, foot - 2); ctx.stroke();
		ctx.fillStyle = '#c9d3e6'; ctx.fillRect(x - 9 - wk * 6, foot - 4, 8, 4); ctx.fillRect(x + 1 + wk * 6, foot - 4, 8, 4);
		// coat: two panels open at the front, flaring behind as he moves
		const fl = clamp(-m.vx * 1.4, -10, 10);
		ctx.fillStyle = hi ? '#ffffff' : '#2a3a68';
		ctx.beginPath(); ctx.moveTo(x - 10, top + 20 + bob); ctx.lineTo(x - 2, top + 22 + bob); ctx.lineTo(x - 4, foot - 10); ctx.lineTo(x - 15 + fl, foot - 6); ctx.closePath(); ctx.fill();
		ctx.beginPath(); ctx.moveTo(x + 10, top + 20 + bob); ctx.lineTo(x + 2, top + 22 + bob); ctx.lineTo(x + 4, foot - 10); ctx.lineTo(x + 15 + fl, foot - 6); ctx.closePath(); ctx.fill();
		ctx.fillStyle = hi ? '#ffffff' : '#e6ecf7'; ctx.fillRect(x - 3, top + 22 + bob, 6, 24);      // shirt
		ctx.strokeStyle = '#9fe8ff'; ctx.lineWidth = 1.4;
		ctx.beginPath(); ctx.moveTo(x - 2, top + 22 + bob); ctx.lineTo(x - 4, foot - 10); ctx.moveTo(x + 2, top + 22 + bob); ctx.lineTo(x + 4, foot - 10); ctx.stroke();
		ctx.strokeStyle = '#b07bff'; ctx.beginPath(); ctx.moveTo(x - 15 + fl, foot - 6); ctx.lineTo(x - 4, foot - 10); ctx.moveTo(x + 15 + fl, foot - 6); ctx.lineTo(x + 4, foot - 10); ctx.stroke();
		// arms (the forward one reaches out while he gathers a technique)
		const reach = (B.act && B.act.t < B.act.wind) || m.castFlash > 0;
		ctx.strokeStyle = hi ? '#fff' : '#2a3a68'; ctx.lineWidth = 5;
		ctx.beginPath(); ctx.moveTo(x - f * 8, top + 24 + bob); ctx.lineTo(x - f * 11, top + 42 + bob);
		ctx.moveTo(x + f * 8, top + 24 + bob); ctx.lineTo(x + f * (reach ? 18 : 11), top + (reach ? 32 : 42) + bob); ctx.stroke();
		ctx.fillStyle = '#e6ecf7'; ctx.beginPath(); ctx.arc(x + f * (reach ? 18 : 11), top + (reach ? 32 : 42) + bob, 2.6, 0, Math.PI * 2); ctx.arc(x - f * 11, top + 42 + bob, 2.6, 0, Math.PI * 2); ctx.fill();
		ctx.fillStyle = hi ? '#fff' : '#33467a'; ctx.fillRect(x - 9, top + 15 + bob, 18, 8);      // high collar
		ctx.strokeStyle = '#9fe8ff'; ctx.lineWidth = 1; ctx.strokeRect(x - 9, top + 15 + bob, 18, 8);
		// head
		ctx.fillStyle = '#d9b99a'; ctx.beginPath(); ctx.arc(x + f * 1.5, top + 9 + bob, 7.5, 0, Math.PI * 2); ctx.fill();
		ctx.fillStyle = '#17121f';      // short dark hair swept back
		ctx.beginPath(); ctx.moveTo(x - f * 8, top + 12 + bob); ctx.quadraticCurveTo(x - f * 11, top - 3 + bob, x + f * 6, top + 0 + bob); ctx.quadraticCurveTo(x + f * 10, top + 3 + bob, x + f * 8, top + 6 + bob); ctx.lineTo(x - f * 2, top + 5 + bob); ctx.closePath(); ctx.fill();
		ctx.fillStyle = '#9fe8ff'; ctx.shadowColor = '#9fe8ff'; ctx.shadowBlur = 8; ctx.fillRect(x + f * 4 - 1.5, top + 8 + bob, 3, 2); ctx.shadowBlur = 0;
		const up = bossBarrierUp(m);
		ctx.strokeStyle = up ? '#9fe8ff' : '#55606f'; ctx.lineWidth = 1.4;
		ctx.beginPath(); ctx.arc(x - f * 4, top + 7 + bob, 15, 0, Math.PI * 2); ctx.stroke();
		for(let k = 0; k < 6; k++){ const an = t * 1.4 + k * Math.PI / 3; ctx.fillStyle = up ? '#c9f4ff' : '#666'; ctx.beginPath(); ctx.arc(x - f * 4 + Math.cos(an) * 15, top + 7 + bob + Math.sin(an) * 15, 2.2, 0, Math.PI * 2); ctx.fill(); }
		ctx.restore();
		const topS = foot - (foot - top) * 1.3;
		// hands: the charge he is gathering (the tell)
		const act = B.act;
		if(act && act.t < act.wind){
			const q = clamp(act.t / Math.max(0.05, act.wind), 0, 1), hx = x + f * 22, hy = topS + 42 + bob;
			if(act.key === 'violet'){
				const sep = 40 * (1 - q);
				for(const s of [ [ -1, '#5ab8ff' ], [ 1, '#ff4a5a' ] ]){ ctx.fillStyle = s[1]; ctx.shadowColor = s[1]; ctx.shadowBlur = 14; ctx.beginPath(); ctx.arc(hx + s[0] * sep, hy - 20, 7 + 6 * q, 0, Math.PI * 2); ctx.fill(); }
				ctx.shadowBlur = 0;
				ctx.strokeStyle = '#b07bff'; ctx.globalAlpha = a * 0.4; ctx.lineWidth = 2;
				for(let k = 0; k < 3; k++){ ctx.beginPath(); ctx.arc(hx, hy - 20, 20 + k * 14 + (1 - q) * 40, 0, Math.PI * 2); ctx.stroke(); }
				ctx.globalAlpha = a;
			} else if(act.key === 'domain'){
				ctx.strokeStyle = '#e3d6ff'; ctx.lineWidth = 2; ctx.globalAlpha = a * (0.4 + 0.6 * q);
				ctx.beginPath(); ctx.arc(x, topS + 40, 34 + q * 60, 0, Math.PI * 2); ctx.stroke();
				ctx.beginPath(); ctx.moveTo(x - 7, topS + 32); ctx.lineTo(x + 7, topS + 46); ctx.moveTo(x + 7, topS + 32); ctx.lineTo(x - 7, topS + 46); ctx.stroke();      // crossed fingers
				ctx.globalAlpha = a;
			} else {
				ctx.fillStyle = act.col; ctx.shadowColor = act.col; ctx.shadowBlur = 12;
				ctx.beginPath(); ctx.arc(hx, hy, 3 + 6 * q, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
				ctx.strokeStyle = act.col; ctx.lineWidth = 1;
				for(let k = 0; k < 5; k++){ const an = k * 1.26 + t * 6, rr = 22 * (1 - q) + 6; ctx.beginPath(); ctx.moveTo(hx + Math.cos(an) * rr, hy + Math.sin(an) * rr); ctx.lineTo(hx + Math.cos(an) * (rr + 4), hy + Math.sin(an) * (rr + 4)); ctx.stroke(); }
			}
		}
		// effects
		for(let i = B.fx.length - 1; i >= 0; i--){
			const e = B.fx[i]; e.t += 1 / 60; if(e.t > e.life){ B.fx.splice(i, 1); continue; }
			const q = e.t / e.life, ex = e.x - camX, ey = e.y - camY;
			ctx.globalAlpha = a * (1 - q);
			if(e.k === 'pop'){ ctx.strokeStyle = e.col; ctx.lineWidth = 4 * (1 - q) + 1; ctx.beginPath(); ctx.arc(ex, ey, e.r * (0.3 + 0.7 * q), 0, Math.PI * 2); ctx.stroke(); }
			else if(e.k === 'blink'){ ctx.strokeStyle = '#9fe8ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ex, ey, 10 + 30 * q, 0, Math.PI * 2); ctx.stroke(); }
			else if(e.k === 'ripple'){ ctx.strokeStyle = '#c9f4ff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(ex, ey, 6 + 16 * q, 0, Math.PI * 2); ctx.stroke(); }
			else if(e.k === 'shatter'){ ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; for(let k = 0; k < 10; k++){ const an = k * 0.628, r1 = 30 + 90 * q; ctx.beginPath(); ctx.moveTo(ex + Math.cos(an) * r1 * 0.6, ey + Math.sin(an) * r1 * 0.6); ctx.lineTo(ex + Math.cos(an) * r1, ey + Math.sin(an) * r1); ctx.stroke(); } }
			else if(e.k === 'slash'){ ctx.strokeStyle = '#bfe4ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(ex - e.f * 20, ey, 34, -0.9 * e.f + (e.f < 0 ? Math.PI : 0), 0.9 * e.f + (e.f < 0 ? Math.PI : 0), e.f < 0); ctx.stroke(); }
			else if(e.k === 'trail'){ ctx.globalAlpha = a * 0.25 * (1 - q); ctx.fillStyle = '#7a2cff'; ctx.beginPath(); ctx.arc(ex, ey, e.r * (1 - 0.5 * q), 0, Math.PI * 2); ctx.fill(); }
		}
		ctx.globalAlpha = a;
		// name over his head
		if(!m.dead){
			ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
			ctx.fillStyle = '#000'; ctx.fillText(m.name + ', ' + m.title, x + 1, topS - 22);
			ctx.fillStyle = '#9fe8ff'; ctx.fillText(m.name + ', ' + m.title, x, topS - 23);
			if(m.castNameT > 0){ ctx.globalAlpha = a * Math.min(1, m.castNameT / 20); ctx.font = 'italic 13px serif'; ctx.fillStyle = '#fff'; ctx.fillText('« ' + m.castName + ' »', x, topS - 39); }
		}
		ctx.restore();
		// the boss bar (screen space)
		if(!m.dead){
			ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
			const W0 = ctx.canvas.width, bw = Math.min(560, W0 * 0.5), bx = (W0 - bw) / 2, by = 80;
			ctx.fillStyle = '#000b'; ctx.fillRect(bx - 3, by - 3, bw + 6, 22);
			ctx.fillStyle = '#3a0d18'; ctx.fillRect(bx, by, bw, 10);
			ctx.fillStyle = B.phase >= 3 ? '#ff4a5a' : B.phase === 2 ? '#b07bff' : '#5ab8ff'; ctx.fillRect(bx, by, bw * clamp(m.hp / m.maxHp, 0, 1), 10);
			ctx.fillStyle = '#ffffff55'; ctx.fillRect(bx + bw * 0.6, by, 1, 10); ctx.fillRect(bx + bw * 0.25, by, 1, 10);
			const st = bossLayer(m), wq = W();
			ctx.fillStyle = up ? '#9fe8ff' : '#55606f'; ctx.fillRect(bx, by + 12, bw * (st ? clamp(st.energy / (B.layerMax || 1), 0, 1) : 0), 4);
			ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
			const why = !st ? (B.downWhy === 'shattered' ? 'shattered' : 'not raised') : playerDomainOn(m) ? 'your domain' : (m.t < B.lapseUntil ? B.downWhy : 'suppressed');
			ctx.fillText(m.name + ', ' + m.title + '  ·  ' + (up ? 'Boundless ∞' : 'Boundless DOWN (' + why + ')'), W0 / 2, by + 32);
			ctx.restore();
		}
	}

	/* ---------- the frame ---------- */
	function update(){
		if(!env) return;
		const dt = 1 / 60, p = P(), w = W();
		for(let i = mages.length - 1; i >= 0; i--){
			const m = mages[i];
			if(m.dead){ m.deathT += dt; if(m.deathT > 1.6) mages.splice(i, 1); continue; }
			m.t += dt;
			if(m.flash > 0) m.flash--;
			if(m.castFlash > 0) m.castFlash--;
			if(m.castNameT > 0) m.castNameT--;
			if(m.slowTimer > 0) m.slowTimer--;
			for(const k in m.cds) if(m.cds[k] > 0) m.cds[k] -= dt;
			m.gcd -= dt; m.dodgeCd -= dt; m.jumpCd -= dt; m.aimLock -= dt; m.aimT += dt;
			if(m.wind){ m.wind.t += dt; if(m.stunTimer > 0 || m._kbTimer > 6){ m.wind = null; if(m.plan) abort(m); } }
			m.mana = Math.min(m.maxMana, m.mana + m.K.regen * dt);
			if(m.boss){
				// the Boundless: whatever got through this frame never arrived (a safety net under the hit hooks)
				if(bossBarrierUp(m)){ if(m.lastHp != null && m.hp < m.lastHp - (m._letThrough || 0)){ const ok = m._letThrough || 0; bossBlock(m, m.lastHp - m.hp - ok, null); m.hp = m.lastHp - ok; } m.stunTimer = 0; m._kbTimer = 0; m.dots.length = 0; }
				else { m.stunTimer = Math.min(m.stunTimer, 12); m._kbTimer = Math.min(m._kbTimer, 8); }
				m._letThrough = 0;
			}
			// reinforcement on itself: it takes less damage (the same rule as for you)
			if(w && m.hp < m.lastHp){ const r = Math.min(0.6, w.reinforcedValue(m, 'damageResist')); if(r > 0.01) m.hp += (m.lastHp - m.hp) * r; }
			// burns and other damage over time
			for(let di = m.dots.length - 1; di >= 0; di--){
				const dot = m.dots[di]; dot.timer++;
				if(dot.timer >= dot.interval){ dot.timer = 0; m.hp -= dot.dmg; m.flash = 4; if(env.say) env.say(cx(m), m.y - 10, Math.round(dot.dmg) + '', dot.color || '#ff8a3d'); if(--dot.ticks <= 0) m.dots.splice(di, 1); }
			}
			m.lastHp = m.hp;
			if(m.hp <= 0){
				m.dead = true; m.hp = 0; m.deathT = 0;
				if(w) try { w.clearOwner(m.owner.id); } catch(e){}
				if(m.K.custom && m.K.custom.onDeath) try { m.K.custom.onDeath(m); } catch(e){}
				if(env.say) env.say(cx(m), m.y - 30, m.name + ' is defeated', m.K.color);
				continue;
			}
			const mxx = cx(m), myy = cy(m);
			if(m.drawing > 0) m.drawing--;
			// she closes her portals once they have done their job (a portal left open only gets in her way)
			if(w) for(const b of w.bodies){
				if(!b.alive || !b.spatial || b.spatial.kind !== 'portal' || b.ownerId !== m.owner.id) continue;
				const key = m.instKey[b.inst] || (b.inst === m.tmInst ? 'trademark' : '');
				const life = PORTAL_LIFE[key] != null ? PORTAL_LIFE[key] : (spellOf(m, key) && spellOf(m, key).trademark ? PORTAL_LIFE.trademark : null); if(life == null) continue;
				if(b.age > life && !(key === 'gate' && m.plan && m.plan.name === 'Flank Gate')){ b.amount = 0; w.T.kill(b, 'fade'); }
			}
			let S = null, ctx = null;
			if(p){
				S = perceive(m, p);
				ctx = readSituation(m, p, S);
				m.ctx = ctx;
			}
			// the cursor: follows the plan of the last spell, otherwise rests on the player
			if(p){ m.aim = (m.aimFn && m.aimLock > 0) ? (m.aimFn(m.aimT) || m.aim) : { x: S.x, y: S.y }; }
			if(m.aimLock <= 0) m.aimFn = null;
			if(m.K.custom && m.K.custom.pre) try { m.K.custom.pre(m); } catch(e){ m.lastErr = e.message; }      // e.g. a boss's poise against stun-lock
			const stunned = m.stunTimer > 0;
			if(stunned) m.stunTimer--;
			// grappling: the tether pulls; let go once there
			if(m.grapple){
				const g = ownBodies(m, b => b.inst === m.grapple.inst)[0];
				if(!g || m.t > m.grapple.until || (g.bond && Math.hypot(g.x - mxx, g.y - myy) < 44)){ if(g) g.amount = 0; m.grapple = null; m.vy = Math.min(m.vy, -3); }
			}
			if(m._kbTimer > 0){
				m._kbTimer--; const k = m._kbTimer / 20;
				m.vx = (m._kbVx || 0) * k; m.vy = (m._kbVy || 0) * k;
			} else {
				if(m.K.custom){
					let hover = false;
					try { hover = m.K.custom.frame(m, p, ctx, 1 / 60); } catch(e){ m.lastErr = e.message; }
					if(hover){ const ty = groundY() - m.h - 150; m.vy += ((ty - m.y) * 0.06 - m.vy) * 0.2; m.vy = clamp(m.vy, -6, 6); }
					else m.vy = Math.min(18, m.vy + (env.gravity || 0.55));
				} else if(m.boss){
					const hover = bossFrame(m, p, ctx, 1 / 60);
					if(stunned) m.vx *= 0.8;
					if(hover){ const ty = groundY() - m.h - 150; m.vy += ((ty - m.y) * 0.06 - m.vy) * 0.2; m.vy = clamp(m.vy, -6, 6); }
					else m.vy = Math.min(18, m.vy + (env.gravity || 0.55));
				} else if(m.K.planner){
					if(p) plannerFrame(m, p, ctx, 1 / 60); else m.vx *= 0.8;
					const gmulP = (1 + 1.4 * (w ? w.reinforcedValue(m, 'heavyGravity') : 0) - 0.75 * (w ? w.reinforcedValue(m, 'lowGravity') : 0)) * (w && w.zoneMod ? w.zoneMod(m, 'gravity') : 1);
					m.vy = Math.min(18, m.vy + (env.gravity || 0.55) * (m.grapple ? 0.15 : gmulP));
				} else {
				if(p && !stunned){
					react(m, ctx);
					if(m.plan) runPlan(m, ctx, dt);
					else if(m.t >= m.nextThink && m.gcd <= 0) { if(!choose(m, ctx)) m.nextThink = m.t + 0.25; }
					moveMind(m, ctx, dt);
				} else m.vx *= 0.8;
				const gmul = (1 + 1.4 * (w ? w.reinforcedValue(m, 'heavyGravity') : 0) - 0.75 * (w ? w.reinforcedValue(m, 'lowGravity') : 0)) * (w && w.zoneMod ? w.zoneMod(m, 'gravity') : 1);
				m.vy = Math.min(18, m.vy + (env.gravity || 0.55) * (m.grapple ? 0.15 : gmul));
				}
			}
			const wasY = m.y;
			if(env.move) env.move(m); else { m.x += m.vx; m.y += m.vy; }
			if(m.vy >= 0 && Math.abs(m.y - wasY) < 0.01 && m.vy > 0.5) m.onGround = true;
			m.x = clamp(m.x, 0, worldW() - m.w);
		}
	}

	/* ---------- drawing ---------- */
	function draw(ctx, camX, camY){
		for(const m of mages){
			if(m.K.custom && m.K.custom.draw){ try { m.K.custom.draw(ctx, m, camX, camY); } catch(e){} continue; }
			if(m.boss){ try { drawBoss(ctx, m, camX, camY); } catch(e){} continue; }
			if(m.B && m.B.ghosts){
				// after-images of a step through space / a blink
				for(let i = m.B.ghosts.length - 1; i >= 0; i--){ const gh = m.B.ghosts[i]; gh.t += 1 / 60; if(gh.t > 0.35){ m.B.ghosts.splice(i, 1); continue; } ctx.globalAlpha = 0.4 * (1 - gh.t / 0.35); ctx.fillStyle = m.K.color; ctx.fillRect(gh.x - camX + 6, gh.y - camY + 4, m.w - 12, m.h - 4); }
				for(let i = m.B.fx.length - 1; i >= 0; i--){ const e = m.B.fx[i]; e.t += 1 / 60; if(e.t > e.life){ m.B.fx.splice(i, 1); continue; } const q = e.t / e.life; ctx.globalAlpha = 1 - q; ctx.strokeStyle = m.K.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x - camX, e.y - camY, 10 + 30 * q, 0, Math.PI * 2); ctx.stroke(); }
				ctx.globalAlpha = 1;
			}
			if(m.K.planner && rigReady() && drawFighter(ctx, m, camX, camY)) continue;
			const x = m.x - camX, K = m.K, S = m.h / 62, y = m.y - camY + m.h - 62;      // drawn at 62 px tall, scaled about the feet
			const a = m.dead ? Math.max(0, 1 - m.deathT / 1.4) : 1;
			if(a <= 0) continue;
			ctx.save();
			ctx.globalAlpha = a;
			const fx = x + m.w / 2, foot = y + 62, f = m.facing;
			ctx.translate(fx, foot); ctx.scale(S, S); ctx.translate(-fx, -foot);
			const bob = m.onGround ? Math.sin(m.walk) * 1.5 : 0;
			const t = m.t;
			// aura (brighter while drawing from a mana zone)
			const g = ctx.createRadialGradient(fx, y + 34, 4, fx, y + 34, 46);
			g.addColorStop(0, K.color + (m.drawing > 0 ? '99' : '55')); g.addColorStop(1, K.color + '00');
			ctx.fillStyle = g; ctx.beginPath(); ctx.arc(fx, y + 34, 46 + Math.sin(t * 3) * 3, 0, Math.PI * 2); ctx.fill();
			// robe
			ctx.fillStyle = m.flash > 0 ? '#ffffff' : K.robe;
			ctx.beginPath();
			ctx.moveTo(fx - 7, y + 20 + bob); ctx.lineTo(fx + 7, y + 20 + bob);
			ctx.lineTo(fx + 15 + Math.sin(m.walk) * 2, foot); ctx.lineTo(fx - 15 - Math.sin(m.walk) * 2, foot); ctx.closePath(); ctx.fill();
			ctx.strokeStyle = K.trim; ctx.lineWidth = 2;
			ctx.beginPath(); ctx.moveTo(fx - 14, foot - 3); ctx.lineTo(fx + 14, foot - 3); ctx.stroke();
			ctx.beginPath(); ctx.moveTo(fx, y + 22 + bob); ctx.lineTo(fx, foot - 4); ctx.stroke();
			// head + hood
			ctx.fillStyle = '#e7c9a8'; ctx.beginPath(); ctx.arc(fx + f * 1.5, y + 12 + bob, 7, 0, Math.PI * 2); ctx.fill();
			ctx.fillStyle = m.flash > 0 ? '#ffffff' : K.robe;
			ctx.beginPath(); ctx.moveTo(fx - 10, y + 16 + bob); ctx.quadraticCurveTo(fx - f * 4, y - 8 + bob, fx + f * 2 + (-f) * 12, y - 6 + bob); ctx.quadraticCurveTo(fx + 12 * f, y + 2 + bob, fx + 10, y + 16 + bob); ctx.closePath(); ctx.fill();
			ctx.fillStyle = K.color; ctx.fillRect(fx + f * 4 - 1, y + 11 + bob, 2, 2);
			if(K.look) drawMeleeLook(ctx, m, K, fx, y, bob, f, t, camX, camY, a);
			else {
				// staff, raised while casting, the orb pointed at the cursor
				const cast = m.castFlash > 0 ? m.castFlash / 16 : 0;
				const ax = m.aim.x - camX - fx, ay = m.aim.y - camY - (y + 28), al = Math.hypot(ax, ay) || 1;
				const hx = fx + f * 10, hy = y + 32 + bob - cast * 6;
				const sx = hx + (cast > 0 ? ax / al * 26 : f * 3), sy = hy + (cast > 0 ? ay / al * 26 : -30);
				ctx.strokeStyle = '#6b4a2b'; ctx.lineWidth = 3;
				ctx.beginPath(); ctx.moveTo(hx - (sx - hx) * 0.5, hy - (sy - hy) * 0.5 + 10); ctx.lineTo(sx, sy); ctx.stroke();
				ctx.fillStyle = K.color; ctx.shadowColor = K.color; ctx.shadowBlur = 10 + cast * 16;
				ctx.beginPath(); ctx.arc(sx, sy, 4.5 + cast * 3 + Math.sin(t * 6) * 0.6, 0, Math.PI * 2); ctx.fill();
				ctx.shadowBlur = 0;
				if(m.wind){
					// gathering a spell: a turning glyph ring grows around the orb (the tell you can react to)
					const q = clamp(m.wind.t / Math.max(0.05, m.wind.dur), 0, 1), R = 7 + 9 * q;
					ctx.strokeStyle = K.color; ctx.globalAlpha = a * (0.45 + 0.5 * q); ctx.lineWidth = 1.6;
					ctx.beginPath(); ctx.arc(sx, sy, R, 0, Math.PI * 2); ctx.stroke();
					for(let k = 0; k < 6; k++){ const an = t * 4 + k * Math.PI / 3; ctx.beginPath(); ctx.moveTo(sx + Math.cos(an) * R, sy + Math.sin(an) * R); ctx.lineTo(sx + Math.cos(an) * (R + 4), sy + Math.sin(an) * (R + 4)); ctx.stroke(); }
					ctx.globalAlpha = a;
				}
			}
			if(m.stunTimer > 0){ ctx.fillStyle = '#fff6'; for(let k = 0; k < 3; k++){ const an = t * 5 + k * 2.1; ctx.beginPath(); ctx.arc(fx + Math.cos(an) * 12, y - 8 + Math.sin(an) * 4, 2, 0, Math.PI * 2); ctx.fill(); } }
			// name, health, energy
			if(!m.dead){
				const bw = 70, bx = fx - bw / 2, by = y - 26;
				ctx.fillStyle = '#000a'; ctx.fillRect(bx - 1, by - 1, bw + 2, 8);
				ctx.fillStyle = '#c0392b'; ctx.fillRect(bx, by, bw * clamp(m.hp / m.maxHp, 0, 1), 4);
				ctx.fillStyle = K.color; ctx.fillRect(bx, by + 4, bw * clamp(m.mana / m.maxMana, 0, 1), 2);
				ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
				ctx.fillStyle = '#000'; ctx.fillText(m.name + ', ' + m.title, fx + 1, by - 5);
				ctx.fillStyle = K.color; ctx.fillText(m.name + ', ' + m.title, fx, by - 6);
				if(m.castNameT > 0){
					ctx.globalAlpha = a * Math.min(1, m.castNameT / 20);
					ctx.font = 'italic 12px serif'; ctx.fillStyle = '#fff';
					ctx.fillText('« ' + m.castName + ' »', fx, by - 20);
				}
			}
			ctx.restore();
		}
	}

	/* ---------- the fighters drawn with your own character rig (player-rig.js), posed by the same attack data ---------- */
	const POSE_KEYS = [ 'lean', 'head', 'hat', 'armF', 'armB', 'legF', 'legB', 'sword', 'shift', 'crouch' ];
	const lerpPoseF = (a, b, t) => { const o = {}; for(const k of POSE_KEYS){ const av = (a && a[k]) || 0, bv = (b && b[k]) || 0; o[k] = av + (bv - av) * t; } return o; };
	const eIn = (t) => t * t, eOut = (t) => 1 - (1 - t) * (1 - t);
	function fighterBasePose(m){
		if(m.stunTimer > 0 || m._kbTimer > 0) return { lean: -0.5, head: 0.28, hat: 0.2, armF: 0.95, armB: -1.3, legF: 0.2, legB: -0.35, sword: 0.4, shift: -4, crouch: 2 };
		if(m._dashT > 0) return { lean: 0.72, head: 0.1, hat: 0.12, armF: -0.35, armB: 0.9, legF: 1.05, legB: -0.7, sword: 0.2, shift: 3, crouch: 2 };
		if(!m.onGround) return m.vy < 0 ? { lean: -0.18, head: -0.08, hat: -0.08, armF: -0.9, armB: -0.7, legF: -0.45, legB: 0.55, sword: -0.2, shift: 0, crouch: -2 }
			: { lean: 0.16, head: 0.06, hat: 0.06, armF: -0.25, armB: -0.45, legF: 0.35, legB: -0.2, sword: 0.15, shift: 0, crouch: 0 };
		if(Math.abs(m.vx) > 0.6){ const w = Math.sin(m.walk), bob = Math.abs(Math.sin(m.walk * 2)); return { lean: 0.12, head: 0.02, hat: 0.04, armF: -w * 0.55, armB: w * 0.55, legF: w * 0.95, legB: -w * 0.95, sword: 0.1, shift: 0, crouch: bob * 2 }; }
		const b = Math.sin(m.t * 4.8);
		return { lean: 0.02, head: -0.02, hat: 0, armF: 0.42 + b * 0.04, armB: 0.28, legF: 0.04, legB: -0.04, sword: 0, shift: 0, crouch: (1 - b) * 0.6 };
	}
	function fighterPose(m){
		const base = fighterBasePose(m), A = m.mel;
		if(!A) return base;
		const d = A.def, t = A.t, poses = d.poses;
		if(!poses) return base;
		if(A.phase === 'startup') return lerpPoseF(base, poses.windup, eOut(d.startup <= 1 ? 1 : t / d.startup));
		if(A.phase === 'active') return lerpPoseF(poses.windup, poses.strike, eIn(d.active <= 1 ? 1 : (t - d.startup) / d.active));
		const span = d.cancel + d.recovery + (A.missExtra || 0);
		return lerpPoseF(poses.strike, poses.follow, eOut(clamp(span <= 1 ? 1 : (t - d.startup - d.active) / span, 0, 1)));
	}
	/* the swing of the weapon arm, from your own melee code (run with this fighter's attack, facing and aim) */
	function fighterSwing(m){
		const MM = root.MeleeMode, w = fWeapon(m); if(!MM || !w) return null;
		const A = m.mel, f = m.facing || 1;
		const aim = A ? A.aim : (() => { const p = P(); if(!p) return { x: f, y: 0 }; const dx = cx(p) - cx(m), dy = cy(p) - cy(m), l = Math.hypot(dx, dy) || 1; return { x: dx / l, y: dy / l }; })();
		const proxy = Object.create(MM);
		Object.assign(proxy, { atk: A ? { def: A.def, t: A.t, aim: A.aim, missExtra: A.missExtra, pulse: A.pulse } : null, phase: A ? A.phase : '', charge: 0 });
		proxy.weapon = () => w; proxy.sampleAim = () => aim; proxy.toArm = (vec) => -Math.atan2((vec && vec.x || 0) * f, vec && vec.y || 0);
		try { return { swing: MM.weaponSwing.call(proxy), aim }; } catch(e){ return { swing: null, aim }; }
	}
	function weaponReachOf(w){
		if(!w || !w.moves) return 0;
		if(w._npcReach) return w._npcReach;
		let best = 0; for(const k of [ 'g1', 'g2', 'g3' ]){ const d = w.moves[k]; if(!d || !d.hitbox) continue; best = Math.max(best, Math.hypot(d.hitbox.ox || 0, d.hitbox.oy || 0) + Math.max(18, d.hitbox.w || 36) * 0.5); }
		w._npcReach = best; return best;
	}
	const rigReady = () => !!(root.PlayerRig && root.PlayerRig.isReady && root.PlayerRig.isReady() && root.MeleeMode && fWeapon({ K: { weapon: 'sword' } }));
	function drawFighter(ctx, m, camX, camY){
		const K = m.K, w = fWeapon(m), a = m.dead ? Math.max(0, 1 - m.deathT / 1.4) : 1;
		if(a <= 0 || !w) return false;
		const who = m._who || (m._who = { x: 0, y: 0, w: 38, h: m.h, facing: 1, baseH: 56, flash: 0 });
		who.x = m.x + (m.w - 38) / 2; who.y = m.y; who.h = m.h; who.facing = m.facing; who.flash = m.flash;
		const sw = fighterSwing(m) || { swing: null, aim: { x: m.facing, y: 0 } };
		const style = w.style || K.weapon;
		const o = {
			state: m.onGround ? (Math.abs(m.vx) > 0.6 ? 'run' : 'idle') : 'fall', grounded: !!m.onGround, vx: m.vx || 0, vy: m.vy || 0,
			walkPhase: m.walk, frame: Math.floor(m.t * 60), weapon: style, swing: sw.swing, rest: !m.mel, spellHand: false,
			aim: { x: sw.aim.x * (m.facing || 1), y: sw.aim.y }, reachPx: weaponReachOf(w), squash: 0, angleLegs: !!m.mel, angleArms: !!m.mel, tint: K.robe
		};
		ctx.save();
		ctx.globalAlpha = a;
		// a faint aura of his technique
		const g = ctx.createRadialGradient(cx(m) - camX, cy(m) - camY, 4, cx(m) - camX, cy(m) - camY, 46);
		g.addColorStop(0, K.color + '44'); g.addColorStop(1, K.color + '00');
		ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx(m) - camX, cy(m) - camY, 46, 0, Math.PI * 2); ctx.fill();
		let res = null;
		try { res = root.PlayerRig.draw(ctx, who.x - camX, who.y - camY, who, fighterPose(m), o); } catch(e){ res = null; }
		// the weapon's trail while it swings
		const T = m._trail || (m._trail = []);
		const hot = m.mel && (m.mel.phase === 'active' || m.mel.phase === 'startup' && m.mel.t > m.mel.def.startup - 3);
		if(res && res.tip && hot) T.push({ x: res.tip.x + camX, y: res.tip.y + camY, t: m.t });
		while(T.length && (m.t - T[0].t > 0.12 || T.length > 14)) T.shift();
		if(T.length > 1){
			ctx.lineCap = 'round';
			for(let i = 1; i < T.length; i++){ const q = i / T.length; ctx.globalAlpha = a * q * 0.8; ctx.strokeStyle = K.color; ctx.lineWidth = 2 + 6 * q; ctx.beginPath(); ctx.moveTo(T[i - 1].x - camX, T[i - 1].y - camY); ctx.lineTo(T[i].x - camX, T[i].y - camY); ctx.stroke(); }
			ctx.globalAlpha = a;
		}
		// a spell being gathered: a turning ring at his hand (the tell)
		if(m.wind && res && res.hand){
			const q = clamp(m.wind.t / Math.max(0.05, m.wind.dur), 0, 1), R = 7 + 9 * q;
			ctx.strokeStyle = K.color; ctx.globalAlpha = a * (0.45 + 0.5 * q); ctx.lineWidth = 1.6;
			ctx.beginPath(); ctx.arc(res.hand.x, res.hand.y, R, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = a;
		}
		if(m.stunTimer > 0){ ctx.fillStyle = '#fff6'; for(let k = 0; k < 3; k++){ const an = m.t * 5 + k * 2.1; ctx.beginPath(); ctx.arc(cx(m) - camX + Math.cos(an) * 12, m.y - camY - 6 + Math.sin(an) * 4, 2, 0, Math.PI * 2); ctx.fill(); } }
		if(!m.dead){
			const fx = cx(m) - camX, bw = 70, bx = fx - bw / 2, by = m.y - camY - 30;
			ctx.fillStyle = '#000a'; ctx.fillRect(bx - 1, by - 1, bw + 2, 8);
			ctx.fillStyle = '#c0392b'; ctx.fillRect(bx, by, bw * clamp(m.hp / m.maxHp, 0, 1), 4);
			ctx.fillStyle = K.color; ctx.fillRect(bx, by + 4, bw * clamp(m.mana / m.maxMana, 0, 1), 2);
			ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
			ctx.fillStyle = '#000'; ctx.fillText(m.name + ', ' + m.title, fx + 1, by - 5);
			ctx.fillStyle = K.color; ctx.fillText(m.name + ', ' + m.title, fx, by - 6);
			if(m.castNameT > 0){ ctx.globalAlpha = a * Math.min(1, m.castNameT / 20); ctx.font = 'italic 12px serif'; ctx.fillStyle = '#fff'; ctx.fillText('« ' + m.castName + ' »', fx, by - 20); }
		}
		ctx.restore();
		return true;
	}

	/* the melee fighters carry no staff: gauntlets, a burning hammer, or twin rift blades — swung toward you as they strike */
	function drawMeleeLook(ctx, m, K, fx, y, bob, f, t, camX, camY, a){
		const cast = m.castFlash > 0 ? m.castFlash / 16 : 0, wind = m.wind ? clamp(m.wind.t / Math.max(0.05, m.wind.dur), 0, 1) : 0;
		const ax = m.aim.x - camX - fx, ay = m.aim.y - camY - (y + 30), al = Math.hypot(ax, ay) || 1, ux = ax / al, uy = ay / al;
		const sh = { x: fx + f * 5, y: y + 26 + bob };      // shoulder
		ctx.lineCap = 'round';
		if(K.look === 'fists'){
			// two glowing gauntlets: one cocked back while winding up, thrust at you as he strikes
			const reach = cast > 0 ? 20 * cast : -6 * wind;
			const h1 = { x: sh.x + ux * (12 + reach), y: sh.y + uy * (12 + reach) }, h2 = { x: fx - f * 7, y: y + 34 + bob };
			ctx.strokeStyle = K.robe; ctx.lineWidth = 4;
			ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.lineTo(h1.x, h1.y); ctx.moveTo(fx - f * 4, y + 26 + bob); ctx.lineTo(h2.x, h2.y); ctx.stroke();
			for(const h of [ h1, h2 ]){ ctx.fillStyle = K.color; ctx.shadowColor = K.color; ctx.shadowBlur = 8 + cast * 14 + wind * 8; ctx.beginPath(); ctx.arc(h.x, h.y, 4.5 + (h === h1 ? cast * 2 : 0), 0, Math.PI * 2); ctx.fill(); }
			ctx.shadowBlur = 0;
		} else if(K.look === 'hammer'){
			// a great hammer: raised over the shoulder while winding, brought down as he strikes
			const ang = cast > 0 ? Math.atan2(uy, ux) + f * 0.3 : (f > 0 ? -Math.PI / 2 - 0.6 * wind - 0.3 : -Math.PI / 2 + 0.6 * wind + 0.3);
			const hx = sh.x, hy = sh.y + 4, L = 30, ex = hx + Math.cos(ang) * L, ey = hy + Math.sin(ang) * L;
			ctx.strokeStyle = '#4a3020'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(ex, ey); ctx.stroke();
			ctx.save(); ctx.translate(ex, ey); ctx.rotate(ang + Math.PI / 2);
			ctx.fillStyle = '#5a3a2a'; ctx.fillRect(-9, -6, 18, 12);
			ctx.fillStyle = K.color; ctx.shadowColor = K.color; ctx.shadowBlur = 10 + cast * 16 + wind * 10; ctx.globalAlpha = a * (0.55 + 0.45 * Math.max(cast, wind)); ctx.fillRect(-9, -6, 18, 3); ctx.fillRect(-9, 3, 18, 3);
			ctx.restore(); ctx.globalAlpha = a; ctx.shadowBlur = 0;
		} else if(K.look === 'blades'){
			// twin short blades of folded space
			for(const s of [ 1, -1 ]){
				const base = s > 0 ? Math.atan2(uy, ux) : Math.atan2(uy, ux) + f * 2.4;
				const ang = base + (cast > 0 ? s * (1 - cast) * 1.2 : s * 0.5 - f * wind * 0.8);
				const hx = sh.x + (s < 0 ? -f * 6 : 0), hy = sh.y + 6, ex = hx + Math.cos(ang) * 22, ey = hy + Math.sin(ang) * 22;
				ctx.strokeStyle = K.color; ctx.shadowColor = K.color; ctx.shadowBlur = 8 + cast * 12; ctx.lineWidth = 2.5;
				ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(ex, ey); ctx.stroke();
				ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(hx + Math.cos(ang) * 6, hy + Math.sin(ang) * 6); ctx.lineTo(ex, ey); ctx.stroke();
			}
			ctx.shadowBlur = 0;
		}
		if(m.wind){
			const q = wind, R = 8 + 10 * q, cxp = sh.x + ux * 16, cyp = sh.y + uy * 16;
			ctx.strokeStyle = K.color; ctx.globalAlpha = a * (0.4 + 0.5 * q); ctx.lineWidth = 1.5;
			ctx.beginPath(); ctx.arc(cxp, cyp, R, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = a;
		}
	}

	/* ---------- headless check ----------
	   every spell validates; each mage, against a bot that moves, jumps and shoots back, uses a range of tactics,
	   lands damage, and does not just spam projectiles */
	function selfTest(opts){
		opts = opts || {};
		const out = [];
		const kinds = opts.kinds || Object.keys(KINDS).filter(k => !KINDS[k].boss);
		// the melee fighters: their own checks
		for(const kind of kinds.filter(k => KINDS[k].planner)){
			const B = bookFor(kind);
			out.push({ name: kind + ' spells validate (one technique: ' + KINDS[kind].techniques[0] + ')', pass: B.errors.length === 0 && Object.keys(KINDS[kind].stats.allocations).length === 1, detail: B.errors.join('; ') || Object.keys(B.spells).length + ' spells' });
			const r = duel(kind, opts.seconds || 30, opts.bot || 'active');
			const plans = Object.keys(r.m.stats.tactics), melee = Object.keys(r.m.stats.dmg).filter(k => k.indexOf('m:') === 0).reduce((t, k) => t + r.m.stats.dmg[k], 0);
			out.push({ name: kind + ' fights up close with its weapon (the player\'s melee attacks) and planned combos', pass: r.dealt > 60 && plans.length >= 4 && melee >= r.dealt * 0.6,
				detail: Math.round(r.dealt) + ' damage dealt (' + Math.round(melee / Math.max(1, r.dealt) * 100) + '% from blows) · took ' + Math.round(r.taken) + ' · plans: ' + plans.map(k => k + '×' + r.m.stats.tactics[k]).join(', ') + (r.m.lastErr ? ' · last error: ' + r.m.lastErr : '') });
		}
		if(!opts.kinds || opts.kinds.indexOf('aster') >= 0) out.push(...bossTest(opts));
		for(const kind of kinds){
			if(KINDS[kind].boss || KINDS[kind].planner) continue;
			const B = bookFor(kind);
			out.push({ name: kind + ' spells validate', pass: B.errors.length === 0, detail: B.errors.join('; ') || Object.keys(B.spells).length + ' spells' });
			const tm = Object.values(B.spells).find(q => q.trademark), rev = Object.values(B.spells).filter(q => q.reverse).map(q => q.key);
			out.push({ name: kind + ' has a trademark zone spell (20+ runes, conditions) and no reverse techniques / weapons', pass: !!tm && tm.runes >= 20 && !rev.length && !Object.keys(B.spells).some(k => /blade|gauntlet|maul|weapon/i.test(k)),
				detail: (tm ? tm.name + ' · ' + tm.runes + ' runes · cost ' + Math.round(tm.cost) : 'none') + (rev.length ? ' · reverse: ' + rev.join(', ') : '') });
			const r = duel(kind, opts.seconds || 30, opts.bot || 'active');
			out.push({ name: kind + ' casts its trademark in a duel and it lands', pass: (r.m.stats.casts[tm && tm.key] || 0) > 0 && (r.m.stats.dmg[tm && tm.key] || 0) > 0, detail: (r.m.stats.casts[tm && tm.key] || 0) + ' casts · ' + Math.round(r.m.stats.dmg[tm && tm.key] || 0) + ' damage' });
			const projectileish = [ 'lance', 'bank', 'shard', 'bolt', 'fan', 'prism' ].reduce((s, k) => s + (r.m.stats.casts[k] || 0), 0);
			const total = Object.values(r.m.stats.casts).reduce((s, v) => s + v, 0) || 1;
			const tactics = Object.keys(r.m.stats.tactics);
			out.push({ name: kind + ' fights like a player (varied tactics, not just shots)', pass: r.dealt > 0 && tactics.length >= 5 && projectileish / total < 0.6,
				detail: Math.round(r.dealt) + ' damage dealt · took ' + Math.round(r.taken) + ' · ' + total + ' casts (' + Math.round(projectileish / total * 100) + '% plain shots) · tactics: ' + tactics.map(k => k + '×' + r.m.stats.tactics[k]).join(', ') + (r.m.lastErr ? ' · last error: ' + r.m.lastErr : '') });
		}
		return out;
	}
	/* the boss: his layer holds, he uses his whole kit, hits far harder than a mage, and the Violet Void erases */
	function bossTest(opts){
		const out = [];
		// drop his health at set times so every phase is seen (the bot alone cannot break the layer)
		const secs = opts.bossSeconds || 60, keepHook = API.frameHook;
		let clash = 0, stray = 0;
		API.frameHook = (f, bot, w, m) => {
			if(f === Math.round(secs * 60 * 0.3)){ m.hp = m.lastHp = m.maxHp * 0.55; } if(f === Math.round(secs * 60 * 0.65)){ m.hp = m.lastHp = m.maxHp * 0.2; }
			// his own Blue and Red never out at once; no rupture he did not mean (only the Violet Void tears space)
			const mine = w.bodies.filter(b => b.alive && b.ownerId === m.owner.id && b.infDerived && !b.infSource);
			if(mine.some(b => b.tech && b.tech.gravity > 0) && mine.some(b => b.tech && b.tech.gravity < 0)) clash++;
			for(const b of w.bodies) if(b.alive && b.rupture && b.ownerId === m.owner.id && !/violet/.test(m.instKey[b.inst] || '') && !b._counted){ b._counted = true; stray++; }
			if(keepHook) keepHook(f, bot, w, m);
		};
		let r; try { r = duel('aster', secs, 'active'); } finally { API.frameHook = keepHook; }
		const used = Object.keys(r.m.stats.casts);
		out.push({ name: 'aster: the Boundless stops the bot\'s spells', pass: r.m.B.blocked > 0 && (r.m.stats.casts.boundless || 0) > 0, detail: Math.round(r.m.B.blocked) + ' damage held off · ' + Math.round(r.taken) + ' got through · raised ' + (r.m.stats.casts.boundless || 0) + '×' });
		out.push({ name: 'aster: uses his whole moveset (6+ moves, blinks)', pass: used.length >= 6 && (r.m.B.used.blink || 0) > 0, detail: used.map(k => k + '×' + r.m.stats.casts[k]).join(', ') + ' · blinks ' + (r.m.B.used.blink || 0) + ' · phase ' + r.m.B.phase + (r.m.lastErr ? ' · err ' + r.m.lastErr : '') });
		out.push({ name: 'aster: his spells work together, never against each other (planned combos)', pass: clash === 0 && stray === 0 && Object.keys(r.m.stats.tactics).length >= 5,
			detail: 'frames with his own Blue and Red out together: ' + clash + ' · accidental ruptures: ' + stray + ' · plans: ' + Object.keys(r.m.stats.tactics).map(k => k + '×' + r.m.stats.tactics[k]).join(', ') });
		out.push({ name: 'aster: far deadlier than a mage', pass: r.dealt > 350, detail: Math.round(r.dealt) + ' damage dealt · by move: ' + Object.keys(r.m.stats.dmg).map(k => k + ' ' + Math.round(r.m.stats.dmg[k])).join(', ') });
		// his book validates, and every attack is a real rune spell (no boss-side projectiles)
		{
			const B = bookFor('aster');
			out.push({ name: 'aster: his spell book validates (Infinity sources, Colour runes, a domain with Overwhelm)', pass: B.errors.length === 0 && Object.values(B.spells).every(q => hasRune(KINDS.aster.spells[q.key].tree, 'color') || q.key === 'domain'),
				detail: B.errors.join('; ') || Object.keys(B.spells).length + ' spells · ' + Object.values(B.spells).map(q => q.key + ' ' + q.runes).join(', ') });
		}
		// the Violet Void, cast for real, erases your energy on its path; his Infinity layer is real to the engine
		{
			const w = ME.createWorld(), keep = env, keepList = mages.splice(0);
			const bot = { x: 1500, y: 952, w: 24, h: 48, vx: 0, vy: 0, onGround: true };
			let hurt = 0;
			const host = { mouseWorld: () => ({ x: 1400, y: 900 }), getEnemies: () => targets(), isSolid: (x, y) => y >= 1000, inBounds: () => true, damageEnemy: (e, d, info) => { if(e && e.blockHit && e.blockHit(d, info)) return; if(e) e.hp -= d; },
				nudge: (e, dx, dy) => { e.x += dx; e.y = Math.min(e.y + dy, 1000 - e.h); }, teleport: () => false, hitRect: (e) => ({ x: e.x, y: e.y, w: e.w, h: e.h }) };
			init({ world: () => w, host: () => host, player: () => bot, hurtPlayer: (d) => { hurt += d; }, worldW: 3000, groundY: 1000, gravity: 0.55 });
			const m = spawn('aster', 1000, 1000); m.facing = 1;
			const prof = ME.deriveProfile({ magicControl: 10, magicPower: 60 });
			w.cast(build('ward', gen(60, null, N('anchor', { state: 'anchored' }))), { profile: prof, owner: { id: 'player', entity: { x: 1300, y: 860, w: 24, h: 48 }, facing: () => 1 }, host });
			for(let i = 0; i < 3; i++) w.update(1 / 60, host);
			const b0 = w.bodies.find(b => b.alive && b.ownerId === 'player');
			if(b0){ b0.x = 1330; b0.y = 940; }
			const inst = cast(m, 'violet', () => ({ x: cx(m) + 175, y: cy(m) - 70 }), 2);
			let rup = null;
			for(let i = 0; i < 200; i++){ w.update(1 / 60, host); rup = rup || w.bodies.find(q => q.alive && q.rupture); }
			out.push({ name: 'aster: Violet Void — opposing Infinity tears space, it is sent at you, erases your energy and hits', pass: !!inst && !!rup && !!b0 && !b0.alive && hurt > 60,
				detail: (inst ? 'cast' : 'cast failed: ' + m.lastErr) + ' · rupture ' + (rup ? Math.round(rup.start || rup.amount) + ' E' : 'none') + ' · your ward ' + (b0 ? (b0.alive ? 'survived' : 'erased') : '-') + ' · hit for ' + Math.round(hurt) + ' (scaled)' });
			// the layer: cast Boundless, then your energy is held off
			const w2 = ME.createWorld(); init({ world: () => w2, host: () => host, player: () => bot, hurtPlayer: () => {}, worldW: 3000, groundY: 1000, gravity: 0.55 });
			mages.splice(0); const m2 = spawn('aster', 1000, 1000);
			cast(m2, 'boundless');
			for(let i = 0; i < 60; i++) w2.update(1 / 60, host);
			const up = bossBarrierUp(m2);
			w2.cast(build('shot', gen(30, null, N('redirect', { toward: 'mouse' }))), { profile: prof, owner: { id: 'player', entity: { x: 700, y: 900, w: 24, h: 48 }, facing: () => 1 }, host: Object.assign({}, host, { mouseWorld: () => ({ x: cx(m2), y: cy(m2) }) }) });
			let minD = 1e9;
			for(let i = 0; i < 120; i++){ w2.update(1 / 60, host); const b = w2.bodies.find(q => q.alive && q.ownerId === 'player'); if(b) minD = Math.min(minD, Math.hypot(b.x - cx(m2), b.y - cy(m2))); }
			const st = bossLayer(m2);
			out.push({ name: 'aster: Boundless is a real Infinity reinforcement — your energy never arrives', pass: up && !!st && minD > 30 && m2.hp === m2.maxHp, detail: (st ? 'layer ' + st.inf.toFixed(1) + ', ' + Math.round(st.energy) + ' E' : 'no layer: ' + m2.lastErr) + ' · closest ' + Math.round(minD) + ' px · hp ' + Math.round(m2.hp) });
			// your Hollow Purple is not stopped by his Infinity: it goes straight through and hurts him
			{
				const pp = ME.deriveProfile({ magicControl: 20, magicPower: 200, maxMana: 5000 }); pp.techniquePoints = 30; pp.allocations = { gravity: 8, infinity: 8 };
				const pown = { id: 'player', entity: { x: 600, y: 900, w: 24, h: 48 }, facing: () => 1 };
				const ph = Object.assign({}, host, { mouseWorld: () => ({ x: cx(m2), y: cy(m2) }) });
				const half = (g, x) => { const r = w2.cast(build('h', gen(560, null, N('compress', { power: 22 }, null, N('technique', { technique: 'gravity', power: g }, null, N('technique', { technique: 'infinity', power: 6 }))))), { profile: pp, owner: pown, host: ph }); w2.update(1 / 60, ph); const b = r && r.instance ? w2.bodies.find(q => q.alive && q.inst === r.instance.id) : null; if(b){ b.x = x; b.y = cy(m2); } return b; };
				for(const q of w2.bodies) if(q.alive && q.ownerId === 'player'){ q.amount = 0; w2.T.kill(q, 'fade'); }
				const A = half(7, cx(m2) - 330), B2 = half(-7, cx(m2) - 290);
				let rp = null; for(let i = 0; i < 30 && !rp; i++){ w2.update(1 / 60, ph); rp = w2.bodies.find(q => q.alive && q.rupture && q.ownerId === 'player'); }
				let sent = null; if(rp) sent = w2.cast(build('send', N('target', { kind: 'spell', select: 'nearCaster', range: 1600 }, null, N('redirect', { toward: 'mouse' }))), { profile: pp, owner: pown, host: ph });
				const hp0 = m2.hp, layerBefore = bossBarrierUp(m2);
				for(let i = 0; i < 60; i++) w2.update(1 / 60, ph);
				out.push({ name: 'aster: your Hollow Purple goes straight through his Boundless', pass: !!rp && layerBefore && m2.hp < hp0 - 50, detail: (rp ? 'your rupture ' + Math.round(rp.rupture ? rp.rupture.start : 0) + ' E' + (sent && !sent.ok ? ' (not sent: ' + sent.error + ')' : '') : 'no rupture formed') + ' · Boundless ' + (layerBefore ? 'up' : 'down') + ' · he took ' + Math.round(hp0 - m2.hp) });
			}
			mages.splice(0); keepList.forEach(q => mages.push(q)); env = keep;
		}
		return out;
	}
	/* a headless duel against a simple player bot (strafes, jumps, shoots raw bolts at the mage) */
	function duel(kind, seconds, botMode){
		const w = ME.createWorld(), FLOOR = 1000, Wd = 3000;
		const bot = { x: 1500, y: FLOOR - 48, w: 24, h: 48, vx: 0, vy: 0, onGround: true, launchVx: 0, kbx: 0 };
		let dealt = 0, taken = 0, botCast = 0;
		const plats = [ { x: 1100, y: FLOOR - 190, w: 260, h: 20 }, { x: 1700, y: FLOOR - 190, w: 260, h: 20 } ];
		const solid = (x, y) => y >= FLOOR || x < 0 || x > Wd || plats.some(q => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h);
		const host = { mouseWorld: () => ({ x: 0, y: 0 }), getEnemies: () => targets(), isSolid: solid, inBounds: (x, y) => x > -400 && x < Wd + 400 && y > -2000 && y < FLOOR + 400,
			damageEnemy: (e, d, info) => { if(e && e.runeMage){ if(e.blockHit && e.blockHit(d, info)) return; e.hp -= d; taken += d; } },
			nudge: (e, dx, dy) => { e.x += dx; e.y += dy; }, teleport: (e, x, y) => { e.x = x - e.w / 2; e.y = y - e.h / 2; return true; },
			applyStatus: (e, type, mag, dur) => { if(e === bot && type === 'stunned'){ botStun = Math.max(botStun, dur * 60); return true; } return false; },
			knockback: (e, vx, vy) => { if(e === bot){ bot.kbx += vx * 0.5; bot.vy += vy * 0.4; } else { e._kbVx = vx; e._kbVy = vy; e._kbTimer = 12; } } };
		const move = (e) => {
			e.x += e.vx; e.y += e.vy; e.onGround = false;
			if(e.y + e.h >= FLOOR){ e.y = FLOOR - e.h; if(e.vy > 0) e.vy = 0; e.onGround = true; }
			for(const q of plats){ if(e.vy >= 0 && e.x + e.w > q.x && e.x < q.x + q.w && e.y + e.h >= q.y && e.y + e.h - e.vy <= q.y + 1){ e.y = q.y - e.h; e.vy = 0; e.onGround = true; } }
			e.x = clamp(e.x, 0, Wd - e.w);
		};
		const keep = env, keepList = mages.splice(0);
		let botStun = 0;
		init({ world: () => w, host: () => host, player: () => bot, hurtPlayer: (d) => { dealt += d; }, knockPlayer: (vx, vy) => { bot.kbx += vx; bot.vy += vy; },
			meleeHitPlayer: (d, kx, ky) => { dealt += d; bot.kbx += kx * 0.6; bot.vy += Math.min(0, ky) * 0.6; return 'hit'; },

			playerCasting: () => botCast > 0, platforms: () => plats, worldW: Wd, groundY: FLOOR, gravity: 0.55, move });
		const m = spawn(kind, 1000, FLOOR);
		const prof = ME.deriveProfile({ magicControl: 10, magicPower: 60 });
		const shot = build('bot', N('target', { kind: 'enemy', select: 'nearCaster', range: 1500 }, null, gen(40, null, toFoe())));
		let dirT = 0, dir = 1;
		for(let f = 0; f < seconds * 60; f++){
			if(botStun > 0){ botStun--; bot.vx = bot.kbx; bot.kbx *= 0.85; }
			else if(botMode !== 'still'){
				dirT -= 1 / 60; if(dirT <= 0){ dir = Math.random() < 0.5 ? -1 : 1; dirT = rnd(0.4, 1.4); }
				const dd = cx(m) - cx(bot);
				if(Math.abs(dd) < 250) dir = -sgn(dd);
				if(bot.x < 200) dir = 1; if(bot.x > Wd - 200) dir = -1;
				bot.vx = dir * 6.2 + bot.kbx; bot.kbx *= 0.85;
				if(bot.onGround && Math.random() < 0.012){ bot.vy = -12; }
				if(f % 80 === 0 && !m.dead){ w.cast(shot, { profile: prof, owner: { id: 'player', entity: bot, facing: () => 1 }, host }); botCast = 10; }
			} else { bot.vx = 0; }
			if(botCast > 0) botCast--;
			bot.vy = Math.min(18, bot.vy + 0.55);
			move(bot);
			update(); w.update(1 / 60, host);
			if(API.frameHook) API.frameHook(f, bot, w, m);
		}
		mages.splice(0); keepList.forEach(q => mages.push(q)); env = keep;
		return { m, dealt, taken, w, bot };
	}
	/* what a kind with its own mind (K.custom) may use: the same casting, perception and helpers the mages use */
	const INTERNAL = { env: () => env, world: W, player: P, cast, label, lead, perceive, ownBodies, cx, cy, clamp, rnd, sgn, gauss, groundY, worldW, noisy, spellOf };
	const API = { damageScale: 0.3, INTERNAL, selfTest, duel, castNow: (m, key, aim, lock) => cast(m, key, aim, lock), KINDS, TACTICS, init, spawn, clear, update, draw, targets, list: mages, bookFor, build, N, L };
	root.RuneMages = API;
})(typeof window !== 'undefined' ? window : globalThis);
