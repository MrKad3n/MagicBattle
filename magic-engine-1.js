/*
 * MAGIC ENGINE — programmable magical energy.
 * -------------------------------------------------------------------------
 * A spell is a TREE of rune slots. The thing that travels down the tree is
 * magical energy. Every rune operates on the energy its branch is currently
 * targeting and passes the result to its children. The connector on each
 * parent→child edge decides WHEN the child runs (Instant / Delay / Condition).
 *
 *   SpellDefinition  plain JSON saved in a spell slot (never mutated by casting)
 *   SpellInstance    one cast executing in a World (own branches/bodies/timers)
 *   EnergyBody       the simulated mass of energy a branch manipulates
 *
 * Everything content-like (runes, conditions, techniques, shapes) lives in
 * registries so new entries can be added without touching the executor.
 * Techniques (magic-techniques.js) and Reinforcement targets register into the
 * registries below; the executor never special-cases an individual technique.
 * Enemy attacks never go through this file.
 */
(function(root){
	'use strict';

	/* =====================================================================
	   CONFIG
	   ===================================================================== */
	const CONFIG = {
		maxRunes: 100,              // absolute cap on rune slots (Energy Control decides the real cap)
		lifetime: 120,              // seconds — no spell instance may outlive this
		maxInstancesPerOwner: 24,
		maxBodiesPerInstance: 64,
		// performance: a crowd of energy is handled with a spatial grid and drawn from cached frames
		perf: { gridAt: 40, gridCell: 96, crowdAt: 24, sparkCrowd: 260, ringCap: 160, lightCap: 24, emitMax: 160 },
		maxBodiesGlobal: 640,
		maxBranchesPerInstance: 256,
		maxStepsPerFrame: 600,      // rune executions per instance per frame (tree is finite, this is a seatbelt)
		condCheckFrames: 3,         // waiting conditions re-check every N frames (they only exist once reached)
		condTimeoutDefault: 10,
		condTimeoutMax: 120,
		delayMax: 60,
		baseSpeed: 9,               // px/frame for Redirect when no speed is specified
		maxSpeed: 26,
		damagePerPower: 0.6,
		minEnergy: 0.6,
		leakMoving: 0.025,          // fraction of energy lost per second while flying
		leakIdle: 0.14,             // …while sitting still (raw energy is unstable)
		leakAnchored: 0.05,
		leakZone: 0.012,
		leakScale: 1 / 1.3,         // every leak above runs at this rate: energy lasts 30% longer before it disappears
		ambientCell: 160,
		ambientMax: 30,
		ambientRegen: 0.6,          // per second per cell
		castBaseCost: 2,
		minScale: 0.08,
		zoneMaxBlobs: 90,
		zoneBlob: 8,                // E per blob when Draw Out fills a zone
		zoneCost: 50,               // reserve spent to open a zone (the zone itself, not the energy drawn into it)
		drawPerSec: 9.9,            // E/s Draw Out pulls at zone scale 1 and ordinary power (45% slower than 18)
		rawAttract: 42,             // extra px where environmental energy begins a weak pull toward its own kind
		zoneCollect: 0.85,          // share of a zone's energy a branch can gather from it
		zoneLifetime: 60,
		rawMaxSpeed: 9,             // the fastest ordinary energy can travel (Kinetic 8–15, Light 12–18; Kinetic reinforcement adds on top)
		recoilFrom: 60,
		itemReachMax: 260,          // hard safety limit on a magical item's physical reach (px)             // launching energy more powerful than this pushes you back
		itemMinOver: 10,            // compression 20+ (over-compression 10+) can become a magical item
		redirectFreeSpeed: 9,       // Redirect speeds above this use energy …
		redirectSpeedCost: 0.015,   // … this share per unit of speed over it           // seconds — a zone (and the untouched energy in it) fades after this
		maxScale: 6,
		/* technique balance shared by every technique (per-technique numbers live in each definition) */
		tech: {
			intensityScale: 2.2,     // intensity = scale × (power/10) × access(points) × technique strength
			accessRate: 0.55,        // access(points) = 1 − e^(−rate·points): diminishing returns per point
			maxIntensity: 3,
			minIntensity: 0.03,      // below this a technique state is neutral (kept, but does nothing)
			baseLoss: 0.2,           // conversion loss at 0 efficiency (scaled down by efficiency)
			fieldDrain: 0.035,       // fraction of a field's energy used per second per unit of intensity
			zoneChargePerPower: 6    // energy a Technique rune routes into a zone per point of technique power
		},
		/* reinforcement balance */
		reinforce: {
			K: 55,                   // strength = 1 − e^(−(energy × density × efficiency) / K)
			upkeepFrac: 0.008,       // energy used per second (fraction) …
			upkeepFlat: 0.12,        // … plus a flat amount
			baseEfficiency: 0.6, efficiencyFromControl: 0.4, controlScale: 15,
			techWeight: 1,           // how much technique intensity adds to a property
			caps: { meleeDamage: 1.0, impact: 1.2, forceTransfer: 1.5, reach: 0.4, damageResist: 0.6, knockbackResist: 0.85,
				moveForce: 0.7, jumpForce: 0.6, stability: 0.8, elementResist: 0.7, spellStability: 0.85, spellImpact: 0.8, illumination: 1,
				burnOnHit: 1, chillOnHit: 1, dazzleOnHit: 1, bindOnHit: 1, pullOnHit: 1, portalStrike: 1,
				heavyGravity: 1, lowGravity: 0.9,
				heavyWeapon: 1, lightWeapon: 1 }          // host: heavy → slower swings (×1+0.7h) and more damage (×1+0.9h); light → faster (÷1+0.7l), less damage (×1−0.75l)        // the host scales its gravity by 1 + heavy×1.4 − low×0.75
		}
	};

	const DIRS = { n:{x:0,y:-1}, e:{x:1,y:0}, s:{x:0,y:1}, w:{x:-1,y:0} };
	const OPPOSITE = { n:'s', s:'n', e:'w', w:'e' };

	function clamp(v, a, b){ return v < a ? a : (v > b ? b : v); }
	function num(v, d){ v = Number(v); return isFinite(v) ? v : d; }
	function clone(o){ return JSON.parse(JSON.stringify(o)); }
	function center(ent){
		if(!ent) return null;
		if(ent.w != null && ent.h != null) return { x: ent.x + ent.w / 2, y: ent.y + ent.h / 2 };
		return { x: ent.x, y: ent.y };
	}
	function dist(ax, ay, bx, by){ const dx = ax - bx, dy = ay - by; return Math.sqrt(dx*dx + dy*dy); }
	function mulberry32(a){
		return function(){
			a |= 0; a = a + 0x6D2B79F5 | 0;
			let t = Math.imul(a ^ a >>> 15, 1 | a);
			t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
			return ((t ^ t >>> 14) >>> 0) / 4294967296;
		};
	}

	/* =====================================================================
	   CATEGORIES (editor grouping + colour language)
	   ===================================================================== */
	const CATEGORIES = [
		{ id:'generation',  label:'Generation',   color:'#8ff0c0' },
		{ id:'zone',        label:'Zone',         color:'#7dffe1' },
		{ id:'target',      label:'Target',       color:'#8fd0ff' },
		{ id:'redirection', label:'Redirection',  color:'#9ee7ff' },
		{ id:'split',       label:'Split',        color:'#ffd0a1' },
		{ id:'divide',      label:'Divide',       color:'#ffe59a' },
		{ id:'compression', label:'Compress / Shape', color:'#ffb3c7' },
		{ id:'movement',    label:'Movement',     color:'#b5f0ff' },
		{ id:'attachment',  label:'Attachment',   color:'#b7d0ff' },
		{ id:'anchor',      label:'Energy State', color:'#c9c2ff' },
		{ id:'lock',        label:'Lock',         color:'#e3c9ff' },
		{ id:'release',     label:'Release',      color:'#ffcf7a' },
		{ id:'technique',   label:'Technique',    color:'#d2c4ff' },
		{ id:'reinforcement', label:'Reinforcement', color:'#9dffcf' },
		{ id:'memory',      label:'Spell Memory', color:'#ffc8ec' }
	];
	const CATEGORY_MAP = {};
	CATEGORIES.forEach(c => { CATEGORY_MAP[c.id] = c; });

	/* =====================================================================
	   SHAPES — real silhouettes. Each is resampled to N_PTS outline points
	   (forward = +x) so raw energy can flow point-by-point into the form.
	   How closely energy holds a shape depends on compression ("form").
	   ===================================================================== */
	const N_PTS = 64;
	function arcPts(cx, cy, r, a0, a1, n){ const o = []; for(let i = 0; i <= n; i++){ const a = a0 + (a1 - a0) * i / n; o.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return o; }
	function ellipsePoly(ax, by){ const o = []; for(let i = 0; i < 48; i++){ const a = i / 48 * Math.PI * 2; o.push([Math.cos(a) * ax, Math.sin(a) * by]); } return o; }
	function crescentPoly(){
		// curved slash: a tapering arc of energy, convex side forward
		const cx = -0.95, r = 1.75, span = 70 * Math.PI / 180, n = 24, outer = [], inner = [];
		for(let i = 0; i <= n; i++){
			const a = -span + 2 * span * i / n;
			const w = 0.6 * Math.pow(Math.cos((a / span) * Math.PI / 2), 0.8) + 0.02;
			outer.push([cx + Math.cos(a) * (r + w / 2), Math.sin(a) * (r + w / 2)]);
			inner.push([cx + Math.cos(a) * (r - w / 2), Math.sin(a) * (r - w / 2)]);
		}
		const mid = n / 2;
		// front (a=0, outer) → +y tip → back along inner edge → -y tip → front
		return outer.slice(mid).concat(inner.slice().reverse()).concat(outer.slice(0, mid));
	}
	function wavePoly(){
		const top = [], bot = [], n = 28, w = 0.17;
		for(let i = 0; i <= n; i++){
			const x = 1.7 - 3.4 * i / n, y = 0.42 * Math.sin(x * 2.6);
			top.push([x, y + w]); bot.push([x, y - w]);
		}
		return [[1.75, 0.42 * Math.sin(1.7 * 2.6)]].concat(top).concat([[-1.75, 0.42 * Math.sin(-1.7 * 2.6)]]).concat(bot.reverse());
	}
	function bandPoly(center, w){
		// a band of width w along a centre line (list of [x, y]) → closed outline
		const top = [], bot = [];
		for(let i = 0; i < center.length; i++){
			const a = center[Math.max(0, i - 1)], b = center[Math.min(center.length - 1, i + 1)];
			let nx = -(b[1] - a[1]), ny = b[0] - a[0]; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
			const ww = w * (i === 0 || i === center.length - 1 ? 0.6 : 1);
			top.push([center[i][0] + nx * ww, center[i][1] + ny * ww]); bot.push([center[i][0] - nx * ww, center[i][1] - ny * ww]);
		}
		return top.concat(bot.reverse());
	}
	function arcBand(){ const c = []; for(let i = 0; i <= 26; i++){ const a = -1.15 + 2.3 * i / 26; c.push([Math.cos(a) * 1.4 - 0.5, Math.sin(a) * 1.4]); } return bandPoly(c, 0.13); }
	function spiralBand(){ const c = []; for(let i = 0; i <= 44; i++){ const th = i / 44 * Math.PI * 3.2; const r = 0.12 + 1.25 * i / 44; c.push([Math.cos(th) * r, Math.sin(th) * r]); } return bandPoly(c, 0.1); }
	function tetherPoly(){
		// a thin cord with a knot of energy at each end
		const o = [];
		for(let i = 0; i <= 10; i++){ const a = -Math.PI / 2 + Math.PI * i / 10; o.push([2.0 + Math.cos(a) * 0.3, Math.sin(a) * 0.3]); }
		o.push([1.7, 0.05], [-1.7, 0.05]);
		for(let i = 0; i <= 10; i++){ const a = Math.PI / 2 + Math.PI * i / 10; o.push([-2.0 + Math.cos(a) * 0.3, Math.sin(a) * 0.3]); }
		o.push([-1.7, -0.05], [1.7, -0.05]);
		return o;
	}
	function starPoly(points, ro, ri){ const o = []; for(let i = 0; i < points * 2; i++){ const a = i / (points * 2) * Math.PI * 2; const r = i % 2 ? ri : ro; o.push([Math.cos(a) * r, Math.sin(a) * r]); } return o; }
	const SHAPES = {
		raw:    { label:'Raw flow', poly:null },
		sphere: { label:'Sphere', poly: ellipsePoly(1, 1), smooth:true },
		sword:  { label:'Sword', poly: [[2.3,0],[1.85,0.2],[-0.3,0.23],[-0.3,0.72],[-0.55,0.72],[-0.55,0.14],[-1.25,0.14],[-1.25,0.27],[-1.55,0.27],[-1.55,-0.27],[-1.25,-0.27],[-1.25,-0.14],[-0.55,-0.14],[-0.55,-0.72],[-0.3,-0.72],[-0.3,-0.23],[1.85,-0.2]] },
		blade:  { label:'Crescent Blade', poly: crescentPoly() },
		lance:  { label:'Spear', poly: [[2.4,0],[1.7,0.38],[1.5,0.11],[-2.0,0.11],[-2.12,0],[-2.0,-0.11],[1.5,-0.11],[1.7,-0.38]] },
		spike:  { label:'Spike', poly: [[2.1,0],[0.6,0.32],[-0.85,0.62],[-1.1,0],[-0.85,-0.62],[0.6,-0.32]] },
		arrow:  { label:'Arrow', poly: [[1.9,0],[0.95,0.62],[0.95,0.19],[-1.35,0.19],[-1.75,0.55],[-1.95,0.55],[-1.6,0],[-1.95,-0.55],[-1.75,-0.55],[-1.35,-0.19],[0.95,-0.19],[0.95,-0.62]] },
		disc:   { label:'Disc', poly: ellipsePoly(0.42, 1.4), smooth:true },
		ring:   { label:'Ring', poly: ellipsePoly(1.2, 1.2), smooth:true, hole: 0.66 },
		star:   { label:'Star', poly: starPoly(5, 1.35, 0.56) },
		cube:   { label:'Cube', poly: [[0.88,0],[0.88,0.88],[-0.88,0.88],[-0.88,-0.88],[0.88,-0.88]] },
		wave:   { label:'Wave', poly: wavePoly() },
		fist:   { label:'Fist', poly: [
			[0.9,0.62],[1.12,0.5],[1.02,0.36],[1.2,0.24],[1.08,0.1],[1.22,-0.04],[1.08,-0.18],[1.18,-0.32],[1.0,-0.46],[0.92,-0.62],
			[0.62,-0.7],[0.42,-0.92],[0.12,-0.96],[-0.12,-0.78],[-0.32,-0.5],[-0.5,-0.36],[-1.55,-0.3],[-1.66,0],[-1.55,0.3],[-0.5,0.36],[-0.34,0.56],[0.1,0.7],[0.55,0.7] ] },
		hammer: { label:'Hammer', poly: [[1.75,0.95],[1.75,-0.95],[0.85,-0.95],[0.85,-0.16],[-2.0,-0.16],[-2.12,0],[-2.0,0.16],[0.85,0.16],[0.85,0.95]] },
		point:  { label:'Point', poly: ellipsePoly(0.42, 0.42), smooth:true },
		line:   { label:'Line', poly: [[2.3,0.07],[-2.3,0.07],[-2.3,-0.07],[2.3,-0.07]] },
		arc:    { label:'Arc', poly: arcBand() },
		cone:   { label:'Cone', poly: [[1.55,1.05],[1.78,0.55],[1.85,0],[1.78,-0.55],[1.55,-1.05],[-1.4,-0.06],[-1.45,0],[-1.4,0.06]] },
		wall:   { label:'Wall', poly: [[0.22,1.5],[-0.22,1.5],[-0.22,-1.5],[0.22,-1.5]] },
		tether: { label:'Tether', poly: tetherPoly() },
		spiral: { label:'Spiral', poly: spiralBand() }
	};
	// resample a polygon to N_PTS points, keeping every corner vertex
	function resample(poly){
		const n = poly.length, lens = []; let per = 0;
		for(let i = 0; i < n; i++){ const a = poly[i], b = poly[(i + 1) % n]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]); lens.push(l); per += l; }
		const counts = lens.map(l => Math.max(1, Math.round(l / per * N_PTS)));
		let tot = counts.reduce((x, y) => x + y, 0);
		while(tot > N_PTS){ let k = 0; for(let i = 1; i < n; i++) if(counts[i] > counts[k]) k = i; counts[k]--; tot--; }
		while(tot < N_PTS){ let k = 0; for(let i = 1; i < n; i++) if(lens[i] / counts[i] > lens[k] / counts[k]) k = i; counts[k]++; tot++; }
		const out = new Float32Array(N_PTS * 2); let j = 0;
		for(let i = 0; i < n; i++){
			const a = poly[i], b = poly[(i + 1) % n];
			for(let c = 0; c < counts[i]; c++){ const t = c / counts[i]; out[j++] = a[0] + (b[0] - a[0]) * t; out[j++] = a[1] + (b[1] - a[1]) * t; }
		}
		return out;
	}
	for(const k in SHAPES){
		const sh = SHAPES[k];
		if(!sh.poly) continue;
		sh.pts = resample(sh.poly);
		let fx = 0, bx = 0, area = 0;
		for(const q of sh.poly){ fx = Math.max(fx, q[0]); bx = Math.max(bx, -q[0]); }
		for(let i = 0; i < sh.poly.length; i++){ const a = sh.poly[i], c = sh.poly[(i + 1) % sh.poly.length]; area += a[0] * c[1] - c[0] * a[1]; }
		area = Math.abs(area) / 2;
		sh.front = fx; sh.back = bx; sh.thick = clamp(area / (fx + bx) / 2 * 1.3, 0.3, 1.2);
	}
	/* How firmly energy holds its shape: low compression only begins to form it,
	   high compression is the exact shape; expanded energy holds shapes loosely. */
	function formFor(power){
		const p = num(power, 0);
		if(p > 0) return clamp(Math.pow(p / 10, 0.6), 0.1, 1);
		if(p < 0) return clamp(0.12 + 0.3 * (-p / 10), 0.12, 0.42);
		return 0;
	}

	/* =====================================================================
	   TECHNIQUE FRAMEWORK
	   A technique is a magical law: it gives the energy flowing through a spell a
	   property (heat, space, gravity, motion, light, binding …). It is NOT an attack.
	   Every technique implements the same interface and is looked up by id; the
	   executor, targeting, rendering and reinforcement never branch on a technique.

	   TechniqueDefinition {
	     id, name, reversedName, description, color, reversedColor, balance:{ strength, … }
	     targets: { energy, zone, spell, environment, surface, self, ally, enemy }   ← what it can manipulate
	     targetNotes: { kind: 'why not' }       params: [extra rune parameters]
	     onApply(T, body, s, ctx)               tick(T, body, s)               field(T, src, s)
	     onHit(T, body, s, ent, info)           onSurface(T, body, s) → 'pass' | 'reflect' | null
	     onForeign(T, projectile, s, ctx)       onCancel(T, a, b, amount)
	     draw(ctx, body, x, y, R, s, t, lod)    drawField(ctx, src, x, y, s, t)
	     reinforce: { self:{ normal:{prop:w}, reverse:{…} }, weapon:{…}, ally:{…}, spell:{…} }
	     onReinforcedHit(T, state, s, ent, ev)  drawReinforce(ctx, state, s, geo, t)
	   }
	   Technique state on energy: body.tech = { id: signed intensity }. Positive is the
	   technique, negative its reverse; opposite states cancel by magnitude. Several
	   techniques live side by side on the same energy — they never fuse.
	   ===================================================================== */
	const Techniques = {
		defs: {}, order: [],
		register(def){
			if(!def || !def.id) throw new Error('technique needs an id');
			const d = Object.assign({
				name: def.id, reversedName: 'Reverse ' + (def.name || def.id), description: '',
				color: '#d8b8ff', reversedColor: '#ff9ad8',
				baseLoss: CONFIG.tech.baseLoss,
				params: [], targetNotes: {}, reinforce: {},
				targets: { energy:true, zone:true }
			}, def);
			d.balance = Object.assign({ strength: 1 }, def.balance || {});
			if(!this.defs[d.id]) this.order.push(d.id);
			this.defs[d.id] = d;
			// technique-specific parameters ride on the one generic Technique rune
			const R = Runes.technique;
			if(R){
				for(const pd of d.params){
					const key = d.id + '_' + pd.key;
					if(R.params.some(x => x.key === key)) continue;
					const inner = pd.show;
					R.params.push(Object.assign({}, pd, { key, techParam: pd.key, show: (pp) => pp.technique === d.id && (!inner || inner(pp)) }));
				}
			}
			return d;
		},
		get(id){ return this.defs[id] || null; },
		list(){ return this.order.map(k => this.defs[k]); },
		points(profile, id){ return Math.max(0, num(profile && profile.allocations && profile.allocations[id], 0)); },
		/* diminishing returns on investment */
		access(points){ points = Math.max(0, num(points, 0)); return points <= 0 ? 0 : 1 - Math.exp(-CONFIG.tech.accessRate * points); },
		power(points){ points = Math.max(0, num(points, 0)); return points <= 0 ? 0 : 1 + 0.6 * Math.log2(1 + points); },
		efficiency(points){ points = Math.max(0, num(points, 0)); return 1 - Math.exp(-0.6 * points); },
		loss(id, points){ const d = this.get(id); const base = d ? d.baseLoss : CONFIG.tech.baseLoss; return base * (1 - this.efficiency(points)); },
		/* how strongly one Technique rune sets the property (relative to the energy's own power) */
		intensity(id, points, power){
			const d = this.get(id); if(!d) return 0;
			return clamp(CONFIG.tech.intensityScale * clamp(num(power, 5), 1, 10) / 10 * this.access(points) * (d.balance.strength || 1), 0, CONFIG.tech.maxIntensity);
		},
		/* a technique's parameter as stored on a rune node */
		param(p, id, key, dflt){ const v = p ? p[id + '_' + key] : undefined; return v === undefined ? dflt : v; },
		canUse(profile, id){ return !!(this.get(id) && this.points(profile, id) > 0); },
		accessError(id){ const d = this.get(id); return 'Insufficient Technique Access: ' + (d ? d.name : id) + ' requires at least 1 Technique Point.'; },
		allows(id, kind){ const d = this.get(id); return !!(d && d.targets && d.targets[kind]); },
		incompatible(id, kind){
			const d = this.get(id); if(!d) return 'Unknown technique';
			const why = d.targetNotes && d.targetNotes[kind];
			return 'Incompatible technique operation: ' + d.name + ' cannot manipulate ' + (TARGET_NOUN[kind] || kind) + (why ? ' — ' + why : '');
		},
		validateAllocations(profile){
			const errs = [];
			const al = (profile && profile.allocations) || {};
			const ids = Object.keys(al).filter(k => al[k] > 0);
			const spent = ids.reduce((s, k) => s + al[k], 0);
			if(spent > (profile.techniquePoints || 0)) errs.push('More Technique Points spent than available');
			return errs;
		}
	};
	const TARGET_NOUN = { energy:'raw energy', zone:'a zone', spell:'an active spell', environment:'environment energy', surface:'surfaces', self:'yourself', legs:'your legs', arms:'your arms', ally:'allies', enemy:'enemies', weapon:'weapons' };

	/* ---- technique state helpers (body.tech = { id: signed intensity }) ---- */
	function techOf(b, id){ return b && b.tech ? (b.tech[id] || 0) : 0; }
	function hasTech(b){ if(!b || !b.tech) return false; for(const k in b.tech) if(Math.abs(b.tech[k]) >= CONFIG.tech.minIntensity) return true; return false; }
	function addTech(b, id, delta){
		if(!b.tech) b.tech = {};
		let v = (b.tech[id] || 0) + delta;
		if(Math.abs(v) < CONFIG.tech.minIntensity) v = 0;      // neutral: the property is balanced out, the energy remains
		b.tech[id] = clamp(v, -CONFIG.tech.maxIntensity, CONFIG.tech.maxIntensity);
		return b.tech[id];
	}
	/* the latest technique converts the energy: any other technique on it is gone (the same technique still adds / cancels) */
	function convertTech(b, id){
		if(!b || !b.tech) return false;
		let changed = false;
		for(const k in b.tech){ if(k === id) continue; if(Math.abs(b.tech[k]) >= CONFIG.tech.minIntensity) changed = true; delete b.tech[k]; }
		if(changed && b.spatial && id !== 'spatial'){
			// it stops being a portal / surface and is loose energy again
			b.spatial = null; b.immovable = false; b.noContact = false; b.keepEnergy = false; b.hideBody = false; b.anchored = false;
		}
		return changed;
	}
	/* energy of the same kind: raw, or the same technique with the same sign */
	function techKey(b){ const d = dominantTech(b); return d ? d.id + (d.s < 0 ? '-' : '+') : 'raw'; }

	/* ---- SPELL MEMORY: what has already happened to this energy (kept through split / merge) ---- */
	const MEM_EVENTS = [
		{ value:'portal',     label:'Passed through a portal' },
		{ value:'hitEnemy',   label:'Hit an enemy' },
		{ value:'hitSurface', label:'Hit a surface' },
		{ value:'collided',   label:'Collided (enemy or surface)' },
		{ value:'compressed', label:'Was compressed' },
		{ value:'split',      label:'Was split / divided' },
		{ value:'reinforced', label:'Was reinforced by other energy' },
		{ value:'redirected', label:'Was redirected' },
		{ value:'merged',     label:'Combined with other energy' },
		{ value:'bound',      label:'Was bound to something' },
		{ value:'lodged',     label:'Lodged in what it hit' },
		{ value:'bondBroken', label:'Its tether was snapped' },
		{ value:'reflected',  label:'Its kinetic tether flung back enemy magic' },
		{ value:'antiMagicContact',   label:'Touched Anti-Magic' },
		{ value:'antiMagicConsumed',  label:'Lost energy to Anti-Magic' },
		{ value:'antiMagicDisrupted', label:'Had its technique / structure disrupted by Anti-Magic' },
		{ value:'magicRestored',      label:'Was restored / stabilised (reverse Anti-Magic)' },
		{ value:'infinityCreated',    label:'Became an Infinity source' },
		{ value:'infinityExtracted',  label:'Was drawn from Infinity / had energy drawn from it' },
		{ value:'infinityDestabilized', label:'Its Infinity source became unstable' },
		{ value:'infinityDisrupted',  label:'Its Infinity was disrupted (Anti-Magic / a powerful spell)' },
		{ value:'infinityExploded',   label:'Its Infinity source exploded (backlash)' },
		{ value:'infinityCollapsed',  label:'Its Infinity source collapsed' },
		{ value:'infinitySpatialReinforced', label:'Became an Infinity spatial layer (reinforcement)' },
		{ value:'infinityEntered',    label:'Entered an Infinity spatial layer' },
		{ value:'infinityExited',     label:'Left an Infinity spatial layer' },
		{ value:'infinityBlocked',    label:'An Infinity layer held something back' },
		{ value:'infinityCombined',   label:'Opposing Infinity energy combined (spatial rupture)' }
	];
	function remember(b, key, n){ if(!b || b.foreign) return; const m = b.mem || (b.mem = {}); m[key] = (m[key] || 0) + (n == null ? 1 : n); }
	function memCount(b, key){
		if(!b || b.foreign) return 0;
		const m = b.mem || {};
		if(key === 'collided') return (m.hitEnemy || 0) + (m.hitSurface || 0);
		if(key === 'merged') return b.mergeCount || 0;
		return m[key] || 0;
	}
	function memList(b){ const m = b && b.mem; if(!m) return ''; return Object.keys(m).filter(k => m[k] > 0).map(k => k + (m[k] > 1 ? '×' + m[k] : '')).join(' '); }

	function dominantTech(b){
		let best = null, bs = 0;
		if(b && b.tech) for(const k in b.tech){ const v = b.tech[k]; if(Math.abs(v) > Math.abs(bs) && Math.abs(v) >= CONFIG.tech.minIntensity){ bs = v; best = k; } }
		return best ? { id: best, s: bs } : null;
	}
	/* energy whose technique states all allow it may still combine like raw energy (Thermal, Kinetic …) */
	function techCombines(b){
		if(!b || !b.tech) return true;
		for(const k in b.tech){ if(Math.abs(b.tech[k]) < CONFIG.tech.minIntensity) continue; const d = Techniques.get(k); if(!d || !d.combines) return false; }
		return true;
	}
	function techList(b){ const o = []; if(b && b.tech) for(const k in b.tech) o.push(k + (b.tech[k] > 0 ? ' +' : (b.tech[k] < 0 ? ' ' : ' ±')) + b.tech[k].toFixed(2)); return o.join('  '); }

	/* =====================================================================
	   REINFORCEMENT — not a technique: a way of applying raw energy directly to
	   an existing thing. Target types register which properties reinforcement can
	   change; techniques already on the energy add properties through their data.
	   One shared state model for every target (see World: W.reinf).
	   ===================================================================== */
	const Reinforcement = {
		targets: {},
		registerTarget(kind, def){ this.targets[kind] = Object.assign({ label: kind, props: {} }, def); },
		/* centralized aggregation: additive with a soft cap → never multiplicative or exponential */
		combine(total, cap){ cap = cap || 1; return cap * (1 - Math.exp(-Math.max(0, total) / cap)); },
		strength(energy, density, efficiency){ return 1 - Math.exp(-Math.max(0, energy) * (density || 1) * (efficiency || 1) / CONFIG.reinforce.K); },
		efficiency(profile){ const c = Math.max(0, num(profile && profile.energyControl, 5)); const R = CONFIG.reinforce; return clamp(R.baseEfficiency + R.efficiencyFromControl * (1 - Math.exp(-c / R.controlScale)), 0.05, 1); },
		/* what one state contributes to each property of its target */
		props(kind, strength, tech){
			const td = this.targets[kind]; const out = {};
			if(!td) return out;
			for(const k in td.props) out[k] = (out[k] || 0) + strength * td.props[k];
			if(tech) for(const id in tech){
				const s = tech[id]; if(Math.abs(s) < CONFIG.tech.minIntensity) continue;
				const d = Techniques.get(id); const tbl = d && d.reinforce && (d.reinforce[kind] || (td.techAs ? d.reinforce[td.techAs] : null));
				const w = tbl && (s > 0 ? tbl.normal : tbl.reverse);
				if(w) for(const k in w) out[k] = (out[k] || 0) + strength * Math.abs(s) * w[k] * CONFIG.reinforce.techWeight;
			}
			return out;
		}
	};
	// yourself: mostly toughness (you take less damage); it still helps running, jumping and striking, but only up to a lower maximum
	Reinforcement.registerTarget('self',   { label:'yourself', props:{ damageResist:0.45, knockbackResist:0.45, stability:0.35, meleeDamage:0.2, moveForce:0.08, jumpForce:0.07 },
		kindCaps:{ meleeDamage:0.25, moveForce:0.15, jumpForce:0.12 } });
	// legs: run faster and jump higher · arms: your swings hit harder (techniques act as they do on yourself)
	Reinforcement.registerTarget('legs',   { label:'your legs', props:{ moveForce:0.55, jumpForce:0.55, stability:0.1 }, techAs:'self' });
	Reinforcement.registerTarget('arms',   { label:'your arms', props:{ meleeDamage:0.75, impact:0.1 }, techAs:'self' });
	Reinforcement.registerTarget('ally',   { label:'an ally', props:{ damageResist:0.3, knockbackResist:0.4, meleeDamage:0.25, moveForce:0.08, stability:0.3 } });
	Reinforcement.registerTarget('weapon', { label:'your weapon', props:{ impact:0.45, forceTransfer:0.35, stability:0.3 } });
	Reinforcement.registerTarget('spell',  { label:'an active spell', props:{ spellStability:0.6, spellImpact:0.35 } });
	Reinforcement.registerTarget('energy', { label:'energy', props:{ spellStability:0.6, spellImpact:0.35 } });

	/* =====================================================================
	   PLAYER MAGIC PROFILE
	   ===================================================================== */
	function deriveProfile(src){
		src = src || {};
		const control = Math.max(0, num(src.magicControl, 5));
		const powerStat = Math.max(0, num(src.magicPower, 10));
		const mp = src.magicProfile || {};
		return {
			maxEnergy: Math.max(10, Math.round(num(src.maxMana, 1500))),
			maxOutput: Math.max(20, Math.round(num(src.maxOutput, 60 + powerStat * 6))),
			energyControl: control,
			runeCapacity: clamp(Math.round(num(src.runeCapacity, 10 + control * 3)), 2, CONFIG.maxRunes),
			zoneRadiusMax: zoneRadiusLimit(control),
			techniquePoints: Math.max(0, Math.round(num(mp.techniquePoints, 4))),
			allocations: (function(a){ const o = Object.assign({}, a || {}); if(o.binding != null) delete o.binding; return o; })(mp.allocations),      // Binding no longer exists: its points come back
			negativePower: mp.negativePower !== false
		};
	}
	function defaultMagicProfile(){ return { techniquePoints: 4, allocations: {}, negativePower: true }; }
	function zoneRadiusLimit(control){
		control = Math.max(0, num(control, 5));
		// stays at 520 until Energy Control rises, then opens up to 1800px
		return Math.round(Math.min(1800, 520 + Math.max(0, control - 6) * 60));
	}

	/* =====================================================================
	   RUNE REGISTRY
	   ===================================================================== */
	const Runes = {};
	function defineRune(def){
		if(!def.id || !def.category || typeof def.exec !== 'function') throw new Error('bad rune ' + def.id);
		def.params = def.params || [];
		def.input = def.input || { energy: 'none' };
		def.cost = def.cost || (() => 1);
		def.loss = def.loss || (() => 0);
		def.summary = def.summary || (() => '');
		Runes[def.id] = def;
		return def;
	}
	function paramDefaults(type){
		const d = Runes[type]; const out = {};
		if(!d) return out;
		for(const p of d.params) out[p.key] = clone(p.default);
		return out;
	}
	function paramVisible(p, params){ return !p.show || p.show(params || {}); }
	function paramOptions(p, params){ const o = p && p.options; return typeof o === 'function' ? o(params || {}) : (o || []); }

	const TARGET_KINDS = [
		{ value:'enemy',       label:'Enemy' },
		{ value:'ally',        label:'Ally' },
		{ value:'self',        label:'Self (you)' },
		{ value:'legs',        label:'Your legs (reinforcement)' },
		{ value:'arms',        label:'Your arms (reinforcement)' },
		{ value:'surface',     label:'Surface' },
		{ value:'environment', label:'Environment energy' },
		{ value:'spell',       label:'Active spell / projectile' },
		{ value:'energy',      label:'Raw energy' },
		{ value:'anchorState', label:'Energy in an anchor state' },
		{ value:'zone',        label:'Zone' },
		{ value:'weapon',      label:'Your weapon' }
	];
	/* Target → "Energy in an anchor state": which state to look for (your own energy only) */
	const ASTATE_OPTS = [
		{ value:'anchored', label:'Anchored' },
		{ value:'free',     label:'Free' },
		{ value:'attached', label:'Attached / lodged' },
		{ value:'guided',   label:'Guided' },
		{ value:'bound',    label:'Bound' },
		{ value:'infinity', label:'Infinity source' }
	];
	const isEnergyKind = (k) => k === 'energy' || k === 'anchorState';
	const PICKS = { enemy:1, ally:1, spell:1, energy:1, anchorState:1, zone:1 };
	/* Target → Zone: which zone */
	const ZONE_SELECT = [
		{ value:'nearEnergy', label:'Nearest to energy' },
		{ value:'nearCaster', label:'Nearest to you' },
		{ value:'nearMouse',  label:'Nearest to cursor' },
		{ value:'largest',    label:'Largest' },
		{ value:'thisSpell',  label:'A zone of this spell' }
	];
	/* Target → energy / active spell: only what carries a certain technique right now */
	const TECH_FILTER_KINDS = { energy:1, anchorState:1, spell:1 };
	const techFilterOpts = () => [ { value:'any', label:'Any' }, { value:'raw', label:'Raw only (no technique)' } ].concat(Techniques.list().map(d => ({ value: d.id, label: d.name })));
	const TECH_SIGN = [ { value:'any', label:'Normal or reverse' }, { value:'normal', label:'Normal only' }, { value:'reverse', label:'Reverse only' } ];
	/* does this energy carry the technique a Target filter asks for? */
	function techMatch(b, p){
		const f = p && p.techFilter; if(!f || f === 'any') return true;
		if(!b || b.foreign) return false;
		if(f === 'raw') return !hasTech(b) && !b.infSource;
		if(f === 'infinity') return !!b.infSource;
		const s = techOf(b, f); if(Math.abs(s) < CONFIG.tech.minIntensity) return false;
		const sg = p.techSign || 'any';
		return sg === 'any' || (sg === 'normal' ? s > 0 : s < 0);
	}
	const TARGET_SELECT = [
		{ value:'nearEnergy', label:'Nearest to energy' },
		{ value:'nearCaster', label:'Nearest to you' },
		{ value:'nearMouse',  label:'Nearest to cursor' },
		{ value:'strongest',  label:'Highest health / power' },
		{ value:'weakest',    label:'Lowest health / power' },
		{ value:'inZone',     label:'Inside the zone' }
	];
	const ENERGY_SELECT = TARGET_SELECT.map(o => o.value === 'strongest' ? { value:'strongest', label:'Strongest (most power)' } : (o.value === 'weakest' ? { value:'weakest', label:'Weakest (least power)' } : o)).concat([
		{ value:'all', label:'All raw energy' },
		{ value:'around', label:'Radius around you' },
		{ value:'thisSpell', label:'All energy inside this spell' }
	]);
	const SPELL_SELECT = TARGET_SELECT.concat([ { value:'thisSpell', label:'All energy inside this spell' } ]);
	const ALL_SELECT = { all:1, around:1, thisSpell:1 };
	const SPAWN_OPTS = [
		{ value:'caster', label:'At you' },
		{ value:'energy', label:'At current energy' },
		{ value:'target', label:'At current target' },
		{ value:'mouse',  label:'At cursor' }
	];
	const GEN_SPAWN_OPTS = SPAWN_OPTS.filter(o => o.value !== 'mouse');      // energy is generated where you are, never conjured at the cursor

	/* ---- GENERATE ENERGY ---- */
	defineRune({
		id:'generate', name:'Generate Energy', glyph:'✦', category:'generation',
		description:'Creates new raw magical energy. The new energy becomes what this branch targets. Drawn from your reserve when cast.',
		params:[
			{ key:'amount', label:'Energy', type:'int', min:4, max:1000, step:1, default:20, unit:'E' },
			{ key:'spawn', label:'Spawn', type:'select', options:GEN_SPAWN_OPTS, default:'caster' },
			{ key:'inherit', label:'Technique', type:'select', options:[ { value:'yes', label:'Take on that energy\'s technique' }, { value:'no', label:'Raw (no technique)' } ], default:'yes', show:(p) => p.spawn === 'energy' }
		],
		input:{ energy:'none' },
		provides:'energy',
		perBody:false,
		cost:(p) => num(p.amount, 20) + 1,
		summary:(p) => (p.amount|0) + ' E · ' + labelOf(GEN_SPAWN_OPTS, p.spawn),
		analyze(p, a){
			const prev = a.ctx.body;
			const b = a.newBody(num(p.amount, 20), 'generated');
			if(p.spawn === 'energy' && p.inherit !== 'no' && prev && !prev.foreign && prev.tech) b.tech = Object.assign({}, prev.tech);
			a.ctx.body = b; a.ctx.groupN = 1;
		},
		exec(api, br, p){
			const pos = api.spawnPoint(br, p.spawn === 'mouse' ? 'caster' : p.spawn);
			if(!pos) return api.fail('No valid spawn point');
			const prev = br.ctx.body && !br.ctx.body.foreign ? br.ctx.body : null;
			const want = clamp(num(p.amount, 20), 1, 1000);
			const amount = api.drawBudget(want);
			if(amount < 1) return api.fail('Not enough energy');
			const allowed = api.outputHeadroom();
			const finalAmt = Math.min(amount, allowed);
			if(finalAmt < 1) return api.fail('Max Output reached');
			const b = api.createBody(pos.x, pos.y, finalAmt, 'generated');
			if(!b) return api.fail('Too much active energy');
			b.spawned = true;
			{ const c = api.casterPos(); if(c && dist(pos.x, pos.y, c.x, c.y) < 80) b.nearGen = true; }      // made right at you: launching it hard recoils
			if(prev && (p.spawn === 'energy')){
				b.vx = prev.vx; b.vy = prev.vy;
				// grown out of that energy: it carries the same technique (unless asked for raw energy)
				if(p.inherit !== 'no' && prev.tech && hasTech(prev)){
					b.tech = Object.assign({}, prev.tech);
					if(prev.technique) b.technique = Object.assign({}, prev.technique);
					if(prev.lightBounces != null) b.lightBounces = prev.lightBounces;
				}
			}
			br.ctx.body = b;
		}
	});

	/* ---- CREATE ZONE (empty until Draw Out fills it) ---- */
	defineRune({
		id:'zone', name:'Create Zone', glyph:'◎', category:'zone',
		description:'Opens an empty zone. It does not gather energy on its own. To charge it, Target environment energy and then Draw Out — the drawn energy condenses inside the zone and becomes what this branch targets. A larger zone draws more. Opening the zone itself is expensive.',
		params:[
			{ key:'radius', label:'Radius', type:'int', min:60, max:1800, step:10, default:180, unit:'px', cap:'zoneRadiusMax' },
			{ key:'spawn', label:'Spawn', type:'select', options:SPAWN_OPTS, default:'caster' }
		],
		input:{ energy:'none' },
		provides:'energy',
		perBody:false,
		cost:() => CONFIG.zoneCost,
		summary:(p) => 'r ' + (p.radius|0) + ' · ' + CONFIG.zoneCost + ' E',
		note:() => 'Costs ' + CONFIG.zoneCost + ' energy to open. Stays empty until Draw Out. Higher Energy Control allows a much larger zone. A Technique on the zone gives it a zone law for its whole minute (Thermal: heat damage / reverse: slow + freeze · Light: bright, faster light / reverse: darkness · Gravity: heavy / reverse: low gravity · Kinetic: everything speeds up / reverse: slows · Anti-Magic: magic withers / reverse: your magic does not shrink · Spatial: portals last longer / reverse: portals shut). Infinity zones are not possible.',
		analyze(p, a, node){
			const cap = (a.profile && a.profile.zoneRadiusMax) || 520;
			if(num(p.radius, 180) > cap) a.error(node, 'ZONE_SIZE', 'Zone radius is limited to ' + cap + ' px at your Energy Control');
			const b = a.newBody(0, 'zone');
			b.zone = true;
			b.zoneRadius = clamp(num(p.radius, 180), 40, cap);
			a.ctx.body = b; a.ctx.zone = b; a.ctx.groupN = 1;
		},
		exec(api, br, p){
			const pos = api.spawnPoint(br, p.spawn);
			if(!pos) return api.fail('No valid spawn point');
			const b = api.createBody(pos.x, pos.y, 0, 'zone');
			if(!b) return api.fail('Too much active energy');
			const cap = (api.profile && api.profile.zoneRadiusMax) || 520;
			b.isZone = true; b.anchored = true; b.zoneRadius = clamp(num(p.radius, 180), 40, cap);
			b.shape = 'sphere'; b.amount = 0;
			api.closeOtherZones(b);      // you can hold only one zone at a time: opening a new one closes the old
			br.ctx.body = b; br.ctx.zone = b;
		}
	});

	/* ---- TARGET ---- */
	defineRune({
		id:'target', name:'Target', glyph:'⌖', category:'target',
		description:'Chooses what the following runes interact with. Targeting never moves energy by itself — use Draw Out to pull energy from the target, or Redirect to turn energy you already have. The target is kept even if it dies.',
		params:[
			{ key:'kind', label:'Target', type:'select', options:TARGET_KINDS, default:'enemy' },
			{ key:'astate', label:'Anchor state', type:'select', options:ASTATE_OPTS, default:'anchored',
				show:(p) => p.kind === 'anchorState' },
			{ key:'select', label:'Selection', type:'select', options:(p) => isEnergyKind(p.kind) ? ENERGY_SELECT : (p.kind === 'spell' ? SPELL_SELECT : (p.kind === 'zone' ? ZONE_SELECT : TARGET_SELECT)), default:'nearEnergy',
				show:(p) => !!PICKS[p.kind] },
			{ key:'techFilter', label:'With technique', type:'select', options: techFilterOpts, default:'any', show:(p) => !!TECH_FILTER_KINDS[p.kind],
				hint:'Only energy that carries this technique right now (e.g. only your Thermal spells, only reverse Light).' },
			{ key:'techSign', label:'Technique form', type:'select', options: TECH_SIGN, default:'any', show:(p) => !!TECH_FILTER_KINDS[p.kind] && p.techFilter && p.techFilter !== 'any' && p.techFilter !== 'raw' && p.techFilter !== 'infinity' },
			{ key:'radius', label:'Radius', type:'int', min:40, max:900, step:10, default:220, unit:'px',
				show:(p) => isEnergyKind(p.kind) && p.select === 'around' },
			{ key:'range', label:'Range', type:'int', min:40, max:1600, step:10, default:600, unit:'px',
				show:(p) => p.kind !== 'self' && p.kind !== 'legs' && p.kind !== 'arms' && p.kind !== 'surface' && p.kind !== 'weapon' && !((isEnergyKind(p.kind) || p.kind === 'spell') && ALL_SELECT[p.select] && (p.kind !== 'spell' || p.select === 'thisSpell')) }
		],
		input:{ energy:'optional' },
		cost:(p) => p.kind === 'environment' ? 1 + num(p.range, 600) * 0.004 : 1,
		summary:(p) => {
			if(isEnergyKind(p.kind)){
				const sel = labelOf(ENERGY_SELECT, p.select || 'nearEnergy') + (p.techFilter && p.techFilter !== 'any' ? ' · ' + labelOf(techFilterOpts(), p.techFilter) : '');
				return (p.kind === 'anchorState' ? labelOf(ASTATE_OPTS, p.astate || 'anchored') + ' energy' : 'Raw energy') + ' · ' + sel + (p.select === 'around' ? ' ' + (num(p.radius, 220)|0) : '');
			}
			const tf = TECH_FILTER_KINDS[p.kind] && p.techFilter && p.techFilter !== 'any' ? ' · ' + labelOf(techFilterOpts(), p.techFilter) + (p.techSign === 'normal' ? ' (normal)' : p.techSign === 'reverse' ? ' (reverse)' : '') : '';
			return labelOf(TARGET_KINDS, p.kind) + (PICKS[p.kind] ? ' · ' + labelOf(p.kind === 'spell' ? SPELL_SELECT : (p.kind === 'zone' ? ZONE_SELECT : TARGET_SELECT), p.select) : '') + tf;
		},
		analyze(p, a, node){
			if(p.kind === 'anchorState' || (p.kind === 'spell' && p.select === 'thisSpell')) p = Object.assign({}, p, { kind:'energy' });      // handled like raw energy
			if(p.select === 'inZone' && PICKS[p.kind] && !a.ctx.zone)
				a.error(node, 'NO_ZONE', 'No valid target — "Inside the zone" needs a Create Zone earlier in this branch');
			const prev = a.ctx.body;
			if(prev && !prev.foreign && prev.reinforcePending){
				// "… → Reinforcement → Target X": the pending reinforcement lands on X
				if(!Reinforcement.targets[p.kind]) a.error(node, 'REINF_TARGET', 'Reinforcement cannot strengthen ' + (TARGET_NOUN[p.kind] || p.kind) + ' — it works on yourself, an ally, your weapon or an active spell');
				else if(prev.reinforcePending.portion >= 100) prev.released = true;
				prev.reinforcePending = null;
			} else if(prev && !prev.foreign && prev.tech && TECH_FOCUS[p.kind]){
				// techniques already on this energy must be able to act on what it now targets
				for(const id in prev.tech) if(Math.abs(prev.tech[id]) >= CONFIG.tech.minIntensity && !Techniques.allows(id, p.kind)) a.error(node, 'TECH_TARGET', Techniques.incompatible(id, p.kind));
			}
			if(p.kind === 'zone'){
				// the zone becomes what this branch works on: Technique gives it a zone law, Draw Out pulls from what it holds
				const z = a.newBody(0, 'zone'); z.zone = true; z.zoneRadius = (a.ctx.zone && a.ctx.zone.zoneRadius) || 300;
				a.ctx.body = z; a.ctx.zone = z; a.ctx.groupN = 1;
			} else if(p.kind === 'spell'){
				a.ctx.body = a.newBody(0, 'foreign'); a.ctx.body.foreign = true; a.ctx.groupN = 1;
			} else if(p.kind === 'energy'){
				a.ctx.body = a.newBody(10, 'foreign'); a.ctx.groupN = 1;
			}
			a.ctx.target = p.kind;
		},
		exec(api, br, p){
			const r = targetExec(api, br, p);
			if(r === false) return false;
			// targeting lets the energy interact with the target (techniques act on it, a pending reinforcement lands on it)
			const prev = br._prevBody, t = br.ctx.target;
			br._prevBody = null;
			if(prev && api.bodyValid(prev) && !prev.foreign && t){
				if(prev.reinforcePending){
					const pend = prev.reinforcePending; prev.reinforcePending = null;
					const res = api.reinforce(prev, t, pend.portion);
					if(res !== true) api.note(res);
				} else if(TECH_FOCUS[t.kind] && prev === br.ctx.body){
					prev.focus = t;
				}
			}
		}
	});

	function targetExec(api, br, p){
		const kind = p.kind;
		br._prevBody = br.ctx.body && !br.ctx.body.foreign ? br.ctx.body : null;
		if(kind === 'self' || kind === 'legs' || kind === 'arms'){
			br.ctx.target = { kind, ref: api.owner.entity || null, owner: true };
			return;
		}
		if(kind === 'weapon'){
			const w = api.host.getWeapon ? api.host.getWeapon(api.owner) : null;
			if(!w) return api.fail('No weapon to target — put a weapon in one of your slots');
			br.ctx.target = { kind:'weapon', ref: w };
			return;
		}
		if(kind === 'surface'){
			br.ctx.target = { kind:'surface', ref:null };
			if(br.ctx.body && !br.ctx.body.foreign) br.ctx.body.surfaceMode = 'stick';
			return;
		}
		if(kind === 'environment'){
			const z = br.ctx.zone && br.ctx.zone.alive ? br.ctx.zone : null;
			const from = z ? { x: z.x, y: z.y } : api.refPoint(br);
			const range = z ? z.zoneRadius : num(p.range, 600);
			// selection only — Draw Out is what pulls the energy in
			br.ctx.target = { kind:'environment', ref:null, point:{ x: from.x, y: from.y }, range };
			return;
		}
		if(kind === 'energy' || kind === 'anchorState'){
			const list = api.pickRawBodies(br, p);
			if(!list.length) return api.fail(kind === 'anchorState' ? 'None of your energy is ' + labelOf(ASTATE_OPTS, p.astate || 'anchored').toLowerCase() + ' in range' + ((p.astate || 'anchored') === 'bound' ? ' — nothing has been bound yet (use Anchor / State → Bound first)' : '') : 'No raw energy in range');
			for(let i = 0; i < list.length; i++) api.releaseBlob(list[i]);
			const lock = (b) => ({ kind:'energy', ref:b });
			br.ctx.body = list[0];
			br.ctx.target = lock(list[0]);
			if(list.length > 1){ br.divided = list; br.dividedOwn = true; }
			return;
		}
		if(kind === 'zone'){
			const z = api.pickZone(br, p);
			if(!z) return api.fail(p.select === 'thisSpell' ? 'This spell has no zone' : 'No zone in range');
			br.ctx.body = z; br.ctx.zone = z;
			br.ctx.target = { kind:'zone', ref:z };
			return;
		}
		if(kind === 'spell' && p.select === 'thisSpell'){
			// every piece of energy this spell has made, as a group
			const list = api.pickRawBodies(br, p);
			if(!list.length) return api.fail('This spell has no other energy');
			br.ctx.body = list[0];
			br.ctx.target = { kind:'spell', ref:list[0] };
			if(list.length > 1){ br.divided = list; br.dividedOwn = true; }
			return;
		}
		if(kind === 'spell'){
			const tb = api.pickSpellBody(br, p);
			if(!tb) return api.fail('No active spell in range');
			br.ctx.body = tb;
			br.ctx.target = { kind:'spell', ref:tb };
			return;
		}
		const ent = api.pickEntity(br, kind, p);
		if(!ent) return api.fail('No ' + kind + ' in range');
		br.ctx.target = { kind, ref: ent };
	}

	/* ---- DRAW OUT ---- */
	function drawNeedsHit(api, t){
		if(!t) return false;
		if(t.kind === 'enemy') return true;
		if(t.kind !== 'ally' || !t.ref) return false;
		if(api.owner.entity && t.ref === api.owner.entity) return false;
		if(api.host.isPlayer && api.host.isPlayer(t.ref)) return true;
		return !!(t.ref.isPlayer || t.ref.player || t.ref.playerId != null);
	}
	function zoneDrawMul(zoneRadius){
		if(!zoneRadius) return 1;
		const rel = zoneRadius / 180;
		// grows a little slower than the area: a 1800px zone draws 60× (40% less than before), while
		// small zones are better than before (90px ≈ 0.5×, was 0.25×) — big and small sit closer together
		return clamp(1.5 * Math.pow(rel, 1.6), 0.2, 60);
	}
	/* Draw Out from an Infinity source: the energy is pulled out of the orb itself, as its own kind of energy.
	   The source stays; pulling faster than the caster can control stresses it (see the world's infDraw). */
	const DRAW_FROM = [
		{ value:'target', label:'The current target' },
		{ value:'held', label:'The energy this branch holds (split part of it off)' }
	];
	const DRAW_FLOW = [
		{ value:'auto', label:'Auto — Infinity: constant flow · others: one energy' },
		{ value:'one', label:'Gather it into one energy' },
		{ value:'flow', label:'A constant flow of small pieces' }
	];
	function drawFlows(p, infinity){ const f = p.flow || 'auto'; return f === 'flow' || (f === 'auto' && infinity); }
	/* Draw Out from an Infinity source: the energy is pulled out of the orb itself, as its own kind of energy, over the
	   Draw Out duration. The source stays; pulling faster than the caster can control stresses it (see the world's infDraw). */
	function drawFromInfinity(api, br, p, s){
		const amount = clamp(num(p.infAmount, 300), 1, 20000), dur = clamp(num(p.duration, 1.25), 0.2, 30);
		if(drawFlows(p, true)){
			api.infBurst(s, amount);
			let given = 0;
			return drawFlow(api, br, p, {
				label: 'drawing from Infinity', infinity: s,
				alive: () => s.alive && !!s.infSource,
				take(api2, want, dt){ const w = Math.min(amount - given, want); if(w <= 0.0001) return 0; const got = api2.infDraw(s, w, dt); given += got; return got; },
				rate: () => amount / dur,
				finished: () => given >= amount - 0.01,
				prepare(api2, piece){ api2.infVessel(s, piece); },
				fx(api2, piece, got){ api2.infStream(s, piece, got); }
			});
		}
		const vessel = api.beginDraw(br, 'drawn');
		if(!vessel) return api.fail('Could not hold the energy');
		api.infVessel(s, vessel);
		api.infBurst(s, amount);              // a huge single pull is a strain of its own
		let given = 0;
		br.hold = { time: dur, elapsed: 0, label: 'drawing from Infinity', tick(api2, br2, dt){
			if(!vessel.alive) return 'fail';
			if(!s.alive || !s.infSource) return given >= 1 ? 'done' : 'fail';      // a backlash / collapse ends the draw
			const want = Math.min(amount - given, amount / dur * dt);
			if(want <= 0.0001) return 'done';
			const got = api2.infDraw(s, want, dt);
			if(got > 0){ vessel.amount += got; given += got; api2.infStream(s, vessel, got); }
			return given >= amount - 0.01 ? 'done' : null;
		}, end(){
			vessel.drawing = false;
			if(!vessel.alive || vessel.amount < 1){ if(vessel.alive) api.consumeBody(vessel, 'drawn'); br.note = 'Nothing was drawn'; return false; }
			br.ctx.body = vessel;
			br.ctx.target = { kind:'energy', ref: vessel };
		} };
	}
	/* Draw Out as a constant flow: what is drawn leaves in small pieces, several times a second, for the whole duration —
	   like a beam made of the energy. Every piece goes on through the rest of the branch the moment it comes out.
	   S = { label, alive(), take(api, want, dt) → drawn, rate() → E/s, finished(), prepare(api, piece), fx(api, piece, got), infinity?, from? }
	   or S = { label, parts: [ such specs ], oneShot } to draw from several sources at once (each gets its own stream);
	   oneShot: each source's share comes out as one energy at the end instead of a flow. */
	function drawFlow(api, br, p, S){
		const dur = clamp(num(p.duration, 1.25), 0.2, 30), every = 1 / clamp(num(p.flowRate, 14), 2, 30);
		const parts = (S.parts || [ S ]).map(P => Object.assign({ pending: 0, clock: 0, done: false }, P));
		const bank = { pending: 0, total: 0, blobs: [], clock: 0, forked: false, fid: 'f' + Math.floor(Math.random() * 1e9) };
		const emit = (api2, br2, P, amt) => {
			const at = api2.flowPoint(br2, P);
			const piece = api2.createBody(at.x, at.y, amt, 'drawn', null);
			if(!piece) return false;
			piece.drawnOut = true; piece.flowId = bank.fid;      // pieces of one flow are one energy: they may combine again once they slow down
			if(P.prepare) P.prepare(api2, piece);
			if(P.from) api2.separateFrom(piece, P.from);
			piece.x = at.x; piece.y = at.y;
			if(at.vx || at.vy){ piece.vx = at.vx; piece.vy = at.vy; }
			bank.blobs.push(piece); bank.total += amt;
			api2.forkChildren(br2, piece, bank);      // the following runes act on this piece right away
			if(api2.hasChildren(br2)) bank.forked = true;
			return true;
		};
		br.hold = { time: dur, elapsed: 0, label: S.label || 'drawing out', tick(api2, br2, dt){
			let running = 0;
			for(const P of parts){
				if(P.done) continue;
				const ok = P.alive();
				// the body limit is full: hold what was drawn until a piece can leave, and draw no more meanwhile
				const backed = !S.oneShot && P.pending > P.rate() * every * 3 + 2;
				if(ok && !backed){ const got = P.take(api2, P.rate() * dt, dt); if(got > 0){ P.pending += got; bank.pending += got; if(P.fx && P.last) P.fx(api2, P.last, got); } }
				P.clock += dt;
				if(!S.oneShot && P.clock >= every && P.pending >= Math.max(CONFIG.minEnergy * 2, 0.5)){
					if(emit(api2, br2, P, P.pending)){ bank.pending -= P.pending; P.pending = 0; P.clock = 0; P.last = bank.blobs[bank.blobs.length - 1]; }
				}
				if(!ok || (P.finished && P.finished())) P.done = true;
				else running++;
			}
			if(!running) return bank.total + bank.pending >= 1 ? 'done' : 'fail';
			return null;
		}, end(){
			for(const P of parts) if(P.pending >= CONFIG.minEnergy * 2){ if(emit(api, br, P, P.pending)){ bank.pending -= P.pending; P.pending = 0; } }
			bank.pending = 0; bank.done = true;      // the set of drawn pieces is complete ("wait until combined" can now finish)
			const live = bank.blobs.filter(b => b.alive);
			if(bank.forked) return 'stop';           // every piece already went on through the rest of the branch
			if(!live.length){ br.note = 'Nothing was drawn'; return false; }
			br.ctx.body = live[0];
			br.ctx.target = { kind:'energy', ref: live[0] };
			br.ctx.group = live.length > 1 ? live.map(b => ({ body: b, target: { kind:'energy', ref: b } })) : null;
		} };
	}
	/* Draw Out from several energies at once (the branch holds a group — e.g. Target → All raw energy with technique
	   Infinity): every one is drawn from at the same time. Infinity sources share "Amount from an Infinity source"
	   equally (5000 E from 4 sources = 1250 E from each, so each one is stressed only by its own share). */
	function drawFromMany(api, br, p, list){
		const dur = clamp(num(p.duration, 1.25), 0.2, 30);
		const srcs = list.filter(b => b.infSource), others = list.filter(b => !b.infSource && !b.isZone);
		const share = clamp(num(p.infAmount, 300), 1, 20000) / Math.max(1, srcs.length);
		const parts = [];
		for(const s of srcs){
			api.infBurst(s, share);
			let given = 0;
			parts.push({ infinity: s, alive: () => s.alive && !!s.infSource,
				take(api2, want, dt){ const w = Math.min(share - given, want); if(w <= 0.0001) return 0; const got = api2.infDraw(s, w, dt); given += got; return got; },
				rate: () => share / dur, finished: () => given >= share - 0.01,
				prepare(api2, piece){ api2.infVessel(s, piece); }, fx(api2, piece, got){ api2.infStream(s, piece, got); } });
		}
		for(const o of others){
			const own = o.ownerId === api.owner.id;
			let dry = 0;
			parts.push({ from: own ? o : null, alive: () => api.bodyValid(o),
				take(api2, want, dt){ const got = api2.takeFromBody(o, want); dry = got < want * 0.35 ? dry + dt : 0; return got; },
				rate: () => CONFIG.drawPerSec * drawFactors(0, api.bodyValid(o) ? Math.abs(api.bodyPower(o)) : 0), finished: () => dry > 0.25,
				prepare(api2, piece){ if(own) api2.inheritKind(piece, o); }, fx: null });
		}
		if(!parts.length) return api.fail('Nothing in the group can be drawn from');
		return drawFlow(api, br, p, { label: 'drawing from ' + parts.length + ' sources', parts, oneShot: !drawFlows(p, srcs.length > 0) });
	}
		function drawFactors(zoneRadius, power){
		const zoneMul = zoneDrawMul(zoneRadius);
		const powerMul = power != null ? clamp(power / 12, 0.35, 4) : 1;
		return zoneMul * powerMul;
	}
	function drawPiece(zoneRadius){
		return Math.max(4, 4 * (zoneRadius ? zoneRadius / 180 : 1));
	}
	function drawSourcePower(api, src){
		if(!src || (src.kind !== 'energy' && src.kind !== 'spell') || !src.ref) return null;
		if(!api.bodyValid(src.ref)) return 0;
		return Math.abs(api.bodyPower(src.ref));
	}
	defineRune({
		id:'drawOut', name:'Draw Out', glyph:'⇩', category:'zone',
		description:'Pulls energy out of the current target over a short time, then this branch targets the energy that was drawn. A zone earlier in the branch stores it — that is the only way a zone fills. A larger zone, and a more powerful energy source, pull more. Environment, yourself, allies, surfaces, spells and raw energy can be drawn as soon as the draw starts. Another player or an enemy gives up energy only after this spell has hit them.',
		params:[
			{ key:'duration', label:'Duration', type:'float', min:0.35, max:20, step:0.05, default:1.25, unit:'s' },
			{ key:'from', label:'Draw from', type:'select', options:DRAW_FROM, default:'target', hint:'The energy this branch holds: part of it is pulled out and separated, and the rest of the branch acts on that part — the main energy keeps doing what it was doing (works on an Infinity source too).' },
			{ key:'flow', label:'Drawn energy comes out as', type:'select', options:DRAW_FLOW, default:'auto', hint:'A constant flow: small pieces leave several times a second for the whole duration, and each goes on through the rest of the branch at once (like a beam).' },
			{ key:'flowRate', label:'Pieces per second', type:'int', min:2, max:30, step:1, default:14, unit:'/s', show:(p) => p.flow !== 'one' },
			{ key:'infAmount', label:'Amount from an Infinity source', type:'int', min:10, max:20000, step:10, default:300, unit:'E', hint:'Only used when drawing from an Infinity source: how much to pull out over the duration. Pulling faster than you can control stresses the source — too much and it backlashes.' }
		],
		input:{ energy:'optional', targetFor:(p, ctx) => p.from !== 'held' && !(ctx && ctx.body && ctx.body.infSource) },      // an Infinity source in hand, or the held energy, is drawn from directly
		perBody:false,
		cost:() => 2,
		summary:(p) => 'draw ' + num(p.duration, 1.25) + 's',
		note:(p) => 'Pulls for ' + num(p.duration, 1.25) + 's. Amount scales with the zone\'s area and, when the target is energy, its power. Afterwards you are targeting the drawn energy' + (p.from === 'held' ? ' — split off from the energy this branch held, which carries on as it was' : '') + (drawFlows(p, true) ? '. From an Infinity source' + (p.flow === 'flow' ? ' (or anything else)' : '') + ' it comes out as a constant flow of small pieces, ' + (num(p.flowRate, 14) | 0) + ' a second, each sent through the rest of the branch at once' : '') + '.',
		analyze(p, a, node){
			if(p.from === 'held'){
				const hb = a.ctx.body;
				if(!hb || hb.foreign){ a.error(node, 'DRAW_HELD', 'No valid target — this branch holds no energy of yours to draw from'); return; }
				if(hb.zone){ a.error(node, 'DRAW_HELD', 'No valid target — a zone is drawn into, not from (Target its energy instead)'); return; }
				if(!hb.infSource){
					// part of the held energy is pulled out and separated; it keeps the energy's own kind
					const dur = clamp(num(p.duration, 1.25), 0.2, 30);
					const est = Math.min(hb.amount * 0.95, CONFIG.drawPerSec * dur * drawFactors(0, hb.amount));
					const b = a.newBody(est, 'drawn');
					b.drawnOut = true; if(hb.tech) b.tech = Object.assign({}, hb.tech); if(hb.infDerived) b.infDerived = true;
					a.ctx.body = b; a.ctx.target = 'energy'; a.ctx.groupN = 1;
					return;
				}
			}
			const srcB = a.ctx.body && !a.ctx.body.foreign && a.ctx.body.infSource ? a.ctx.body : null;
			if(srcB && (!a.ctx.target || a.ctx.target === 'energy' || p.from === 'held')){
				// drawing from an Infinity source: the energy comes out as the source's own kind
				const amt = clamp(num(p.infAmount, 300), 1, 20000), dur = clamp(num(p.duration, 1.25), 0.2, 30);
				const cap = INF.cap(srcB.comp, a.profile);
				if(amt / dur > cap) a.warn(node, 'INF_DRAW', 'Drawing ' + amt + ' E in ' + dur + ' s (' + Math.round(amt / dur) + ' E/s) is beyond what you can control (about ' + Math.round(cap) + ' E/s at compression ' + srcB.comp + ') — the source will destabilise and may backlash');
				const b = a.newBody(amt, 'drawn');
				b.drawnOut = true; b.infDerived = true;
				if(srcB.tech) b.tech = Object.assign({}, srcB.tech);
				a.ctx.body = b; a.ctx.target = 'energy'; a.ctx.groupN = 1;
				return;
			}
			if(!a.ctx.target) return;
			if(a.ctx.target === 'zone'){
				const dur = clamp(num(p.duration, 1.25), 0.2, 30), zr = a.ctx.zone && a.ctx.zone.zoneRadius;
				const b = a.newBody(CONFIG.drawPerSec * dur * drawFactors(zr, null), 'drawn');
				b.drawnOut = true; a.ctx.body = b; a.ctx.target = 'energy'; a.ctx.groupN = 1; a.ctx.zone = null;
				return;
			}
			if(a.ctx.target === 'enemy') a.warn(node, 'DRAW_HIT', 'Enemies and other players must be hit by this spell before Draw Out can take their energy');
			const dur = clamp(num(p.duration, 1.25), 0.2, 30);
			const zoneR = a.ctx.zone && a.ctx.zone.zoneRadius;
			const power = (a.ctx.target === 'energy' || a.ctx.target === 'spell') && a.ctx.body && !a.ctx.body.zone
				? a.ctx.body.amount : null;
			const est = CONFIG.drawPerSec * dur * drawFactors(zoneR, power);
			const b = a.newBody(est, a.ctx.target === 'environment' ? 'environment' : 'drawn');
			b.drawnOut = true;
			a.ctx.body = b; a.ctx.target = 'energy'; a.ctx.groupN = 1;
			if(a.ctx.zone) a.ctx.zone.amount += est;
		},
		exec(api, br, p){
			const held = p.from === 'held';
			const hb = br.ctx.body && !br.ctx.body.foreign ? br.ctx.body : null;
			// the branch holds several energies (Divide, Target → all …): draw from every one of them at once
			const tk = br.ctx.target && br.ctx.target.kind;
			if(br.ctx.group && br.ctx.group.length > 1 && (held || tk === 'energy' || tk === 'spell')){
				const list = []; for(const m of br.ctx.group){ const b = m && m.body; if(b && !b.foreign && api.bodyValid(b) && list.indexOf(b) < 0) list.push(b); }
				if(list.length > 1) return drawFromMany(api, br, p, list);
			}
			if(held){
				if(!hb || !api.bodyValid(hb)) return api.fail('This branch holds no energy to draw from');
				if(hb.isZone) return api.fail('A zone is drawn into, not from — Target its energy instead');
				if(hb.infSource) return drawFromInfinity(api, br, p, hb);
			}
			const t = held ? { kind:'energy', ref: hb } : br.ctx.target;
			const infSrc = held ? null : (t && (t.kind === 'energy' || t.kind === 'spell') && t.ref && !t.ref.foreign && t.ref.infSource) ? t.ref
				: (hb && hb.infSource ? hb : null);
			if(infSrc) return drawFromInfinity(api, br, p, infSrc);
			if(!t) return api.fail('No valid target');
			if(drawNeedsHit(api, t)){
				if(!t.ref || !api.wasStruck(t.ref)) return api.fail('Hit them first');
			}
			const src = { kind: t.kind, ref: t.ref || null, point: t.point ? { x: t.point.x, y: t.point.y } : null, range: t.range };
			const tag = src.kind === 'environment' ? 'environment' : 'drawn';
			const fromZone = t && t.kind === 'zone';      // Target → Zone → Draw Out: pull out what the zone holds
			const intoZone = !!(br.ctx.zone && br.ctx.zone.alive) && !held && !fromZone;
			// your own energy (in this spell or another of yours): the drawn part is separated from it and keeps its kind
			const ownSrc = (src.kind === 'energy' || src.kind === 'spell') && src.ref && !src.ref.foreign && src.ref.ownerId === api.owner.id ? src.ref : null;
			const takeFn = (api2, br2, want) => {
				if(src.kind === 'environment'){ const pt = src.point || api2.refPoint(br2); return api2.harvestAmbient(pt.x, pt.y, num(src.range, 600), want); }
				if(src.kind === 'self') return api2.drainReserve(want);
				if(src.kind === 'surface'){ const pt = src.point || api2.targetPos(br2); return pt ? api2.harvestAmbient(pt.x, pt.y, 180, want) : 0; }
				if(src.kind === 'energy' || src.kind === 'spell'){ if(!api2.bodyValid(src.ref)) return 0; return api2.takeFromBody(src.ref, want); }
				if(src.kind === 'zone') return src.ref && src.ref.alive ? api2.takeFromZone(src.ref, want) : 0;
				return src.ref ? api2.siphon(src.ref, want) : 0;
			};
			if(!intoZone && drawFlows(p, false)){
				const dur = clamp(num(p.duration, 1.25), 0.2, 30);
				let dry = 0;
				return drawFlow(api, br, p, {
					label: 'drawing out', from: ownSrc,
					alive: () => (src.kind !== 'energy' && src.kind !== 'spell') || api.bodyValid(src.ref),
					rate: () => CONFIG.drawPerSec * drawFactors(fromZone && src.ref ? src.ref.zoneRadius : 0, drawSourcePower(api, src)),
					take(api2, want, dt){ const got = takeFn(api2, br, want); dry = got < want * 0.35 ? dry + dt : 0; return got; },
					finished: () => dry > 0.25,
					prepare(api2, piece){ if(src.kind === 'environment'){ piece.natural = true; piece.source = 'environment'; } if(ownSrc){ api2.inheritKind(piece, ownSrc); } if(fromZone) api2.zoneKind(piece, src.ref); },
					fx: null
				});
			}
			const vessel = intoZone ? null : api.beginDraw(br, tag, true);
			if(!intoZone && !vessel) return api.fail('Could not hold the energy');
			if(vessel && ownSrc){ api.inheritKind(vessel, ownSrc); api.separateFrom(vessel, ownSrc); }
			if(vessel && fromZone) api.zoneKind(vessel, src.ref);      // a zone with a technique gives that technique's energy
			const bank = { pending: 0, total: 0, blobs: [] };
			const dur = clamp(num(p.duration, 1.25), 0.2, 30);
			br.hold = { time: dur, elapsed: 0, label: 'drawing out', tick(api2, br2, dt){
				const z = intoZone && br2.ctx.zone && br2.ctx.zone.alive ? br2.ctx.zone : null;
				if(z){
					for(let i = bank.blobs.length - 1; i >= 0; i--) if(!bank.blobs[i].alive) bank.blobs.splice(i, 1);
				} else if(!vessel || !vessel.alive) return 'fail';
				const rate = CONFIG.drawPerSec * drawFactors(z ? z.zoneRadius : (fromZone && src.ref ? src.ref.zoneRadius : 0), drawSourcePower(api2, src)) * (z ? 1 - clamp(z.amSupp || 0, 0, 0.95) : 1);      // Anti-Magic suppression weakens the zone
				const want = rate * dt;
				let got = 0;
				if(src.kind === 'environment'){
					const pt = z ? { x: z.x, y: z.y } : (src.point || api2.refPoint(br2));
					const range = z ? z.zoneRadius : num(src.range, 600);
					got = api2.harvestAmbient(pt.x, pt.y, range, want);
				} else if(src.kind === 'zone'){
					got = src.ref && src.ref.alive ? api2.takeFromZone(src.ref, want) : 0;
				} else if(src.kind === 'self'){
					got = api2.drainReserve(want);
				} else if(src.kind === 'surface'){
					const pt = src.point || api2.targetPos(br2);
					if(pt) got = api2.harvestAmbient(pt.x, pt.y, 180, want);
				} else if(src.kind === 'energy' || src.kind === 'spell'){
					if(src.ref === vessel || (z && src.ref === z)) return 'done';
					if(!api2.bodyValid(src.ref)) return (z ? bank.total : vessel.amount) >= 1 ? 'done' : 'fail';
					got = api2.takeFromBody(src.ref, want);
					if(vessel && ownSrc){ const at = api2.flowPoint(br2, { from: ownSrc }); vessel.x = at.x; vessel.y = at.y; }      // it forms at the edge of the energy it is pulled from
				} else {
					if(!src.ref) return 'fail';
					got = api2.siphon(src.ref, want);
				}
				if(z){
					if(got > 0){ bank.pending += got; bank.total += got; }
					const piece = drawPiece(z.zoneRadius);
					let guard = 0;
					while(bank.pending >= piece && guard++ < 6){
						const blob = api2.spawnZoneBlob(z, piece);
						if(!blob){
							const live = bank.blobs.filter(o => o.alive);
							if(live.length){
								const share = bank.pending / live.length;
								for(const o of live) o.amount += share;
								bank.pending = 0;
							}
							break;
						}
						blob.drawnOut = true;
						blob.natural = src.kind === 'environment' || src.kind === 'surface';
						bank.blobs.push(blob);
						bank.pending -= piece;
						api2.forkChildren(br2, blob, bank);      // the following runes act on this piece right away
						bank.forked = true;
					}
				} else if(got > 0) api2.addDrawn(vessel, got);
				const have = z ? bank.total : vessel.amount;
				if(got < want * 0.35) return have >= 1 ? 'done' : 'fail';
				return null;
			}, end(){
				const z = intoZone && br.ctx.zone && br.ctx.zone.alive ? br.ctx.zone : null;
				if(z){
					if(bank.pending >= 1){
						const blob = api.spawnZoneBlob(z, bank.pending);
						if(blob){
							blob.drawnOut = true;
							blob.natural = src.kind === 'environment' || src.kind === 'surface';
							bank.blobs.push(blob);
							bank.total += bank.pending;
							bank.pending = 0;
							api.forkChildren(br, blob, bank);
							bank.forked = true;
						}
					}
					const blobs = bank.blobs.filter(b => b.alive);
					bank.done = true;      // the set of drawn pieces is complete ("wait until combined" can now finish)
					if(bank.forked) return 'stop';      // every piece already went on through the rest of the branch
					if(!blobs.length || bank.total < 1){
						br.note = 'Nothing was drawn';
						return false;
					}
					br.ctx.body = blobs[0];
					br.ctx.target = { kind:'energy', ref: blobs[0] };
					if(blobs.length > 1) br.ctx.group = blobs.map(b => ({ body: b, target: { kind:'energy', ref: b } }));
					return;
				}
				vessel.drawing = false;
				if(!vessel.alive || vessel.amount < 1){
					if(vessel.alive) api.consumeBody(vessel, 'drawn');
					br.note = 'Nothing was drawn';
					return false;
				}
				br.ctx.body = vessel;
				br.ctx.target = { kind:'energy', ref: vessel };
			} };
		}
	});

	/* ---- REDIRECT ---- */
	const REDIRECT_OPTS = [
		{ value:'mouse',  label:'Cursor position' },
		{ value:'target', label:'Toward target' },
		{ value:'away',   label:'Away from target' },
		{ value:'facing', label:'Facing direction' },
		{ value:'caster', label:'Toward you' },
		{ value:'up', label:'Up' }, { value:'down', label:'Down' },
		{ value:'left', label:'Left' }, { value:'right', label:'Right' },
		{ value:'angle', label:'Fixed angle' },
		{ value:'inventory', label:'Into your inventory (magical item)' }
	];
	const ARRIVE_OPTS = [
		{ value:'pass', label:'Keep going' },
		{ value:'stop', label:'Slow to a stop' }
	];
	function redirectSpeedLoss(spd){ return clamp((num(spd, 0) - CONFIG.redirectFreeSpeed) * CONFIG.redirectSpeedCost, 0, 0.6); }
	function redirectHasPoint(toward){ return toward === 'mouse' || toward === 'target' || toward === 'caster'; }
	defineRune({
		id:'redirect', movesEnergy:true, name:'Redirect', glyph:'➹', category:'redirection',
		description:'Changes the targeted energy\'s direction ONCE. It does not home or keep tracking — add another Redirect to turn again. Slow to a stop eases it down so it halts at the cursor, the target, or you.',
		params:[
			{ key:'toward', label:'Toward', type:'select', options:REDIRECT_OPTS, default:'mouse' },
			{ key:'angle', label:'Angle', type:'int', min:-180, max:180, step:5, default:0, unit:'°', show:(p) => p.toward === 'angle' },
			{ key:'arrive', label:'At that position', type:'select', options:ARRIVE_OPTS, default:'pass', show:(p) => redirectHasPoint(p.toward) },
			{ key:'speedPct', label:'Speed', type:'int', min:0, max:100, step:5, default:100, unit:'%', hint:'Percent of the fastest this energy may travel: raw 9, Kinetic 15 (never under 8), plus any Kinetic reinforcement bonus. Light always travels at 18. 0% keeps its current speed.', show:(p) => p.toward !== 'inventory' }
		],
		note:(p) => p.toward === 'inventory' ? 'Fist / sword / spear / hammer energy compressed 20+ becomes (or feeds) the magical item in your slots — the safe way to move unstable over-compressed energy' : 'Speed is a share of the energy\'s top speed: raw ' + CONFIG.rawMaxSpeed + ' · Kinetic 15 (min 8) · Light always 18. Redirecting over-compressed energy (past 10) can make it explode.',
		analyze(p, a, node){
			const b = a.ctx.body;
			if(p.toward === 'inventory' && b && !b.foreign){
				const why = (b.zone ? 'A zone cannot become a magical item' : null) || (!ITEM_SHAPES[b.shape] && b.shape ? 'Only energy compressed into a fist, sword, spear or hammer can become a magical item' : null) || ((b.over || 0) < CONFIG.itemMinOver ? 'It must be compressed to 20 or more to become a magical item' : null);
				if(why) a.warn(node, 'ITEM', why);
			}
		},
		input:{ energy:'required', targetFor:(p) => p.toward === 'target' || p.toward === 'away' },
		cost:() => 1,
		summary:(p) => '→ ' + labelOf(REDIRECT_OPTS, p.toward) + (p.toward === 'angle' ? ' ' + p.angle + '°' : '') + (p.arrive === 'stop' && redirectHasPoint(p.toward) ? ' · stop' : '') + (p.toward === 'inventory' ? '' : ' · ' + (num(p.speedPct, 100) > 0 ? (num(p.speedPct, 100) | 0) + '%' : 'keep speed')),
		exec(api, br, p){
			const b = br.ctx.body;
			if(!api.bodyValid(b)) return api.fail('Energy is gone');
			if(b.immovable) return api.note('Spatial energy cannot be moved — it has become a ' + (b.spatial ? b.spatial.kind : 'fixed form'));
			if(b.locks && b.locks.direction) return api.note('Direction is locked');
			const bp = api.bodyPos(b);
			let dx = 0, dy = 0, dest = null;
			switch(p.toward){
				case 'mouse': { const m = api.host.mouseWorld(); dest = m; dx = m.x - bp.x; dy = m.y - bp.y; break; }
				case 'target': case 'away': {
					const tp = api.targetPos(br);
					if(!tp) return api.fail('No valid target');
					if(p.toward === 'target') dest = tp;
					dx = tp.x - bp.x; dy = tp.y - bp.y;
					if(p.toward === 'away'){ dx = -dx; dy = -dy; }
					break;
				}
				case 'caster': { const c = api.casterPos(); dest = c; dx = c.x - bp.x; dy = c.y - bp.y; break; }
				case 'facing': dx = api.owner.facing ? api.owner.facing() : 1; dy = 0; break;
				case 'up': dy = -1; break; case 'down': dy = 1; break;
				case 'left': dx = -1; break; case 'right': dx = 1; break;
				case 'angle': { const a = num(p.angle, 0) * Math.PI / 180; dx = Math.cos(a); dy = Math.sin(a); break; }
				case 'inventory': {
					const why = itemEligible(b); if(why){ if(api.host.say) api.host.say(why); return api.fail(why); }
					const c = api.casterPos(); dx = c.x - bp.x; dy = c.y - bp.y;
					b.toInventory = true;
					break;
				}
			}
			// over-compressed energy is unstable: pushing it around can set it off (sending it into your inventory is safe)
			if(!b.foreign && p.toward !== 'inventory' && (b.comp || 0) > 10){
				const ch = unstableChance(b.comp, api.profile && api.profile.energyControl) * (b.stabilized > b.age ? 0.25 : 1);      // reverse Anti-Magic steadies it
				if(Math.random() < ch){ api.explode(b); return api.fail('The over-compressed energy was unstable and exploded (' + Math.round(ch * 100) + '% chance)'); }
			}
			const len = Math.sqrt(dx*dx + dy*dy);
			const pct = clamp(num(p.speedPct, 100), 0, 100);
			let spd;
			if(pct <= 0){ spd = api.bodySpeed(b); if(spd < 0.5) spd = CONFIG.baseSpeed; }
			else if(b.foreign) spd = Math.max(CONFIG.rawMaxSpeed, api.bodySpeed(b)) * pct / 100;
			else spd = speedRange(b).hi * pct / 100;
			spd = clamp(spd, 0, CONFIG.maxSpeed);
			if(!b.foreign){ const rg = speedRange(b); spd = clamp(spd, rg.lo, rg.hi); }      // each kind of energy has its own speed range
			const stop = p.arrive === 'stop' && dest && !b.foreign;
			if(len < 0.0001){
				if(stop){ api.setVelocity(b, 0, 0); b.arrive = null; b.guided = true; b.aim = dest ? { x: dest.x, y: dest.y } : b.aim; return; }
				dx = api.owner.facing ? api.owner.facing() : 1; dy = 0;
			}
			let l2 = Math.sqrt(dx*dx + dy*dy) || 1;
			if(b.rupture){
				// torn space barely answers: it only partly turns toward where it is sent
				const os = Math.hypot(b.vx, b.vy);
				if(os > 0.2){ dx = dx / l2 * 0.4 + b.vx / os * 0.6; dy = dy / l2 * 0.4 + b.vy / os * 0.6; l2 = Math.hypot(dx, dy) || 1; }
			}
			api.setVelocity(b, dx / l2 * spd, dy / l2 * spd);
			remember(b, 'redirected');
			b.follow = null; b.lodged = false;
			// recoil: launching something very powerful that you generated right at yourself pushes you back.
			// Kinetic energy in your legs, or anchoring yourself, soaks it up.
			if(!b.foreign && b.nearGen && p.toward !== 'inventory' && api.owner.entity && api.host.knockback){
				const c = api.casterPos(), P = Math.abs(api.bodyPower(b));
				if(P > CONFIG.recoilFrom && dist(c.x, c.y, b.x, b.y) < 180){
					const raw = Math.min(14, (P - CONFIG.recoilFrom) * 0.034 * (0.5 + spd / 18));
					const res = api.recoilResist(), k = raw * (1 - res);
					if(k > 0.3) api.host.knockback(api.owner.entity, -dx / l2 * k, -dy / l2 * k * 0.6 - (dy / l2 > 0.5 || k < 1 ? 0 : 1.2), 12);
					if(k > 3) api.note('Recoil'); else if(raw > 3 && res > 0.3) api.note('Recoil absorbed');
				}
			}
			b.guided = true;
			b.aim = dest ? { x: dest.x, y: dest.y } : null;
			b.arrive = stop ? { x: dest.x, y: dest.y, speed: spd } : null;
		}
	});

	/* ---- SPLIT ---- */
	defineRune({
		id:'split', movesEnergy:true, name:'Split', glyph:'⑂', category:'split',
		description:'Divides the targeted energy between this rune\'s child branches. Energy is divided, never duplicated: 100 split two ways is 50 + 50.',
		params:[
			{ key:'share', label:'First branch share', type:'int', min:0, max:90, step:5, default:0, unit:'%', hint:'0 = divide evenly' },
			{ key:'spread', label:'Spread', type:'int', min:0, max:90, step:5, default:20, unit:'°' }
		],
		input:{ energy:'required' },
		splits:true,
		cost:(p, n) => 1 + (n || 2) * 0.5,
		loss:() => 0.02,
		summary:(p, node, kids) => '÷ ' + Math.max(1, kids || 0) + (num(p.share,0) > 0 ? ' · ' + p.share + '% first' : ' evenly'),
		analyze(p, a, node, kids){
			if(kids < 2) a.warn(node, 'SPLIT_ONE', 'Split needs 2+ child branches to divide energy');
			if(a.ctx.body && a.ctx.body.foreign) a.warn(node, 'SPLIT_FOREIGN', 'Another spell\'s energy cannot be split — branches will share it');
			a.splitShares = splitShares(p, kids);
		},
		exec(api, br, p, node, kids){
			const b = br.ctx.body;
			if(!api.bodyValid(b)) return api.fail('Energy is gone');
			if(kids < 2 || b.foreign || b.isZone || b.immovable) return;
			const shares = splitShares(p, kids);
			const total = b.amount * (1 - 0.02);
			const spd = api.bodySpeed(b);
			const baseAng = spd > 0.2 ? Math.atan2(b.vy, b.vx) : (api.owner.facing && api.owner.facing() < 0 ? Math.PI : 0);
			const spread = num(p.spread, 20) * Math.PI / 180;
			const out = [];
			for(let i = 0; i < kids; i++){
				const t = kids === 1 ? 0 : (i / (kids - 1)) * 2 - 1;
				const ang = baseAng + t * spread;
				const nb = api.createBody(b.x + Math.cos(ang) * 4, b.y + Math.sin(ang) * 4, total * shares[i], b.source, b);
				if(!nb){ out.push(null); continue; }
				remember(nb, 'split');
				if(spd > 0.2){ nb.vx = Math.cos(ang) * spd; nb.vy = Math.sin(ang) * spd; }
				else { nb.vx = Math.cos(ang) * 1.2 * (spread > 0 ? 1 : 0); nb.vy = Math.sin(ang) * 1.2 * (spread > 0 ? 1 : 0); }
				out.push(nb);
			}
			api.consumeBody(b, 'split');
			br.splitBodies = out;
		}
	});
	function splitShares(p, kids){
		kids = Math.max(1, kids | 0);
		const first = num(p.share, 0) / 100;
		const out = [];
		if(first <= 0 || kids < 2){ for(let i = 0; i < kids; i++) out.push(1 / kids); return out; }
		out.push(first);
		for(let i = 1; i < kids; i++) out.push((1 - first) / (kids - 1));
		return out;
	}

	/* ---- DIVIDE ---- */
	const DIV_DIST = [ {value:'even', label:'Evenly'}, {value:'front', label:'Front-loaded'}, {value:'center', label:'Center-heavy'}, {value:'edges', label:'Edge-heavy'} ];
	const DIV_FORM = [
		{value:'across', label:'Line across its path'}, {value:'along', label:'Line along its path'},
		{value:'horizontal', label:'Horizontal line'}, {value:'vertical', label:'Vertical line'},
		{value:'circle', label:'Circle'}, {value:'arc', label:'Arc (fan)'}, {value:'cluster', label:'Cluster (same spot)'}
	];
	const DIV_MOTION = [ {value:'keep', label:'Keep moving together'}, {value:'outward', label:'Burst outward'}, {value:'still', label:'Stop in place'} ];
	function divideShares(p, n){
		const w = [];
		for(let i = 0; i < n; i++){
			const c = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;      // -1 … 1 across the formation
			if(p.dist === 'front') w.push(n - i);
			else if(p.dist === 'center') w.push(1.6 - Math.abs(c));
			else if(p.dist === 'edges') w.push(0.6 + Math.abs(c));
			else w.push(1);
		}
		const t = w.reduce((x, y) => x + y, 0);
		return w.map(x => x / t);
	}
	function divideOffsets(p, n, ang, spacing){
		const out = [];
		const ca = Math.cos(ang), sa = Math.sin(ang);
		for(let i = 0; i < n; i++){
			const k = i - (n - 1) / 2;
			let x = 0, y = 0;
			switch(p.formation){
				case 'along':      x = ca * k * spacing; y = sa * k * spacing; break;
				case 'horizontal': x = k * spacing; break;
				case 'vertical':   y = k * spacing; break;
				case 'circle':     { const a = ang + i / n * Math.PI * 2; x = Math.cos(a) * spacing; y = Math.sin(a) * spacing; break; }
				case 'arc':        { const span = Math.min(Math.PI * 1.2, 0.35 * (n - 1) + 0.4); const a = ang + (n === 1 ? 0 : (i / (n - 1) - 0.5) * span); x = Math.cos(a) * spacing; y = Math.sin(a) * spacing; break; }
				case 'cluster':    break;
				default:           x = -sa * k * spacing; y = ca * k * spacing;      // across the path
			}
			out.push({ x, y });
		}
		return out;
	}
	defineRune({
		id:'divide', movesEnergy:true, name:'Divide', glyph:'⁂', category:'divide',
		description:'Divides the targeted energy into several pieces that all continue down THIS branch together — every rune after it acts on each piece. No extra branches needed. Energy is divided, never duplicated.',
		params:[
			{ key:'count', label:'Pieces', type:'int', min:2, max:16, step:1, default:3 },
			{ key:'dist', label:'Divide the energy', type:'select', options:DIV_DIST, default:'even' },
			{ key:'formation', label:'Initial formation', type:'select', options:DIV_FORM, default:'across' },
			{ key:'spacing', label:'Spacing / radius', type:'int', min:0, max:300, step:5, default:40, unit:'px', show:(p) => p.formation !== 'cluster' },
			{ key:'motion', label:'Then', type:'select', options:DIV_MOTION, default:'keep' }
		],
		input:{ energy:'required' },
		cost:(p) => 1 + num(p.count, 3) * 0.5,
		loss:() => 0.02,
		note:(p) => { const sh = divideShares(p, clamp(num(p.count, 3) | 0, 2, 16)); return 'Shares: ' + sh.map(x => Math.round(x * 100) + '%').join(' · '); },
		summary:(p) => '×' + (p.count|0) + ' · ' + labelOf(DIV_FORM, p.formation) + (p.motion !== 'keep' ? ' · ' + labelOf(DIV_MOTION, p.motion).toLowerCase() : ''),
		analyze(p, a, node){
			const b = a.ctx.body;
			const n = clamp(num(p.count, 3) | 0, 2, 16);
			if(b && b.foreign){ a.warn(node, 'DIV_FOREIGN', 'Another spell\'s projectile cannot be divided'); return; }
			if(!b) return;
			const shares = divideShares(p, n);
			const nb = a.newBody(0, b.source);
			nb.amount = b.amount * shares[0] * 0.98 * (p.dist === 'even' ? 1 : 1); nb.scale = b.scale; nb.technique = b.technique;
			nb.mult = (b.mult || 1) * n; nb.amount = b.amount * 0.98 / n;    // average piece for estimates
			nb.maxPower = nb.amount * densityFactor(nb.scale);
			b.splitParent = true;
			a.ctx.body = nb;
			a.ctx.groupN = (a.ctx.groupN || 1) * n;
			if(a.ctx.groupN > CONFIG.maxBodiesPerInstance) a.warn(node, 'DIV_MANY', 'Up to ' + a.ctx.groupN + ' pieces — only ' + CONFIG.maxBodiesPerInstance + ' energy bodies can exist per spell');
		},
		exec(api, br, p){
			const b = br.ctx.body;
			if(!api.bodyValid(b)) return api.fail('Energy is gone');
			if(b.foreign) return api.note('Another spell\'s projectile cannot be divided');
			if(b.immovable) return api.note('Spatial energy cannot be moved — it has become a ' + (b.spatial ? b.spatial.kind : 'fixed form'));
			const n = clamp(num(p.count, 3) | 0, 2, 16);
			const shares = divideShares(p, n);
			const total = b.amount * (1 - 0.02);
			const spd = Math.sqrt(b.vx*b.vx + b.vy*b.vy);
			const ang = spd > 0.2 ? Math.atan2(b.vy, b.vx) : (b.angleSet ? b.angle : (api.owner.facing && api.owner.facing() < 0 ? Math.PI : 0));
			const spacing = p.formation === 'cluster' ? 0 : num(p.spacing, 40);
			const offs = divideOffsets(p, n, ang, spacing);
			const out = [];
			for(let i = 0; i < n; i++){
				const nb = api.createBody(b.x, b.y, total * shares[i], b.source, b);
				if(!nb) break;
				remember(nb, 'split');
				nb.angle = b.angle; nb.angleSet = b.angleSet;
				nb.anchored = b.anchored; nb.attach = b.attach ? { target: b.attach.target, ox: b.attach.ox + offs[i].x, oy: b.attach.oy + offs[i].y } : null;
				// glide out into the formation over a few frames
				if(!nb.attach) nb.slide = { x: offs[i].x / 8, y: offs[i].y / 8, n: 8 };
				if(p.motion === 'still'){ nb.vx = 0; nb.vy = 0; }
				else if(p.motion === 'outward'){
					let dx = offs[i].x, dy = offs[i].y, l = Math.sqrt(dx*dx + dy*dy);
					if(l < 0.01){ const a = ang + i / n * Math.PI * 2; dx = Math.cos(a); dy = Math.sin(a); l = 1; }
					const sp = Math.max(4, spd);
					nb.vx = dx / l * sp; nb.vy = dy / l * sp; nb.anchored = false;
				} else { nb.vx = b.vx; nb.vy = b.vy; }
				out.push(nb);
			}
			if(!out.length) return api.fail('Too much active energy');
			api.consumeBody(b, 'split');
			br.divided = out;
		}
	});

	/* ---- COMPRESS / SHAPE ---- */
	const SHAPE_OPTS = Object.keys(SHAPES).map(k => ({ value: k === 'raw' ? 'keep' : k, label: k === 'raw' ? 'Keep current shape' : SHAPES[k].label }));
	SHAPE_OPTS.push({ value:'raw', label:'Raw flow' });
	defineRune({
		id:'compress', name:'Compress / Shape', glyph:'◈', category:'compression',
		description:'Positive power compresses the energy (denser, stronger, smaller). Negative power expands it (larger, weaker, wispier). The energy rearranges itself into the chosen shape. Builds on the current state: Expand ×2 then Compress ×5 = 0.4×. Past 10 it OVER-compresses (up to 50): the energy shrinks further, keeps getting stronger, pierces through enemies, lasts much longer and glows brighter until it is white-hot at 50 — but it costs far more. Gravity energy cannot be compressed.',
		params:[
			{ key:'power', label:'Power', type:'signed', min:-10, max:50, step:1, default:5, nonZero:true, hint:'Over 10 over-compresses: smaller, piercing, longer-lasting, much more costly' },
			{ key:'shape', label:'Shape', type:'select', options:SHAPE_OPTS, default:'sphere' }
		],
		input:{ energy:'required' },
		cost:(p) => compressCost(num(p.power, 5)),
		loss:(p) => compressLoss(num(p.power, 5)),
		note:(p) => num(p.power, 0) > 0 ? 'Compression ' + num(p.power, 0) + ' needs at least ' + Math.ceil(compMin(num(p.power, 0))) + ' E or the energy collapses.' + (num(p.power, 0) > 10 ? ' Over-compressed energy is a little unstable: redirecting it can make it explode (less likely with more Energy Control) — sending it into your inventory is safe.' : '') : '',
		summary:(p) => (num(p.power,0) > 0 ? '+' : '') + p.power + (num(p.power, 0) > 10 ? ' (over)' : '') + ' · ' + labelOf(SHAPE_OPTS, p.shape),
		analyze(p, a, node){
			const pw = num(p.power, 0);
			if(pw === 0) a.error(node, 'PARAM', 'Invalid parameter — Power cannot be 0');
			const b = a.ctx.body;
			if(b && !b.foreign && pw > 0 && b.tech && Math.abs(b.tech.gravity || 0) >= CONFIG.tech.minIntensity && !b.infSource){ a.error(node, 'COMPRESS_GRAVITY', 'Gravity energy cannot be compressed (compress first, then apply Gravity — or compress a Gravity Infinity source)'); return; }
			if(b && !b.foreign){
				const f = compressFactor(Math.min(10, pw));
				let ns = pw > 0 ? b.scale / f : b.scale * f;
				const over = pw > 10 ? clamp(pw - 10, 0, 40) / 40 : 0;
				ns = clamp(ns, minScaleFor(b.amount) / (1 + 3 * over), CONFIG.maxScale);
				if(over > 0) ns = Math.min(ns, minScaleFor(b.amount) / (1 + 3 * over));
				b.scale = ns;
				b.amount *= 1 - compressLoss(pw);
				// the checker follows over-compression and shape too (Redirect "Into your inventory" needs them)
				if(pw > 10 && !b.zone) b.over = Math.max(b.over || 0, clamp(pw - 10, 0, 40)); else if(pw < 0) b.over = 0;
				if(!b.zone){
					b.comp = pw > 0 ? Math.max(b.comp || 0, pw) : 0;
					const m = compMin(b.comp);
					if(m > 0 && b.amount < m) a.warn(node, 'COMPRESS_MIN', 'Compression ' + b.comp + ' needs at least ' + Math.ceil(m) + ' E — this energy (about ' + Math.round(b.amount) + ' E) would collapse');
				}
				if(p.shape && p.shape !== 'keep') b.shape = p.shape;
				a.touch(b);
			}
		},
		exec(api, br, p){
			const b = br.ctx.body;
			if(!api.bodyValid(b)) return api.fail('Energy is gone');
			if(b.foreign) return api.note('This energy cannot be compressed');
			const pw = num(p.power, 0);
			if(pw === 0) return api.fail('Invalid power');
			if(pw > 0 && techOf(b, 'gravity') && Math.abs(techOf(b, 'gravity')) >= CONFIG.tech.minIntensity && !b.infSource) return api.fail('Gravity energy cannot be compressed (compress first, then apply Gravity)');
			if(!(b.locks && b.locks.size)){
				const f = compressFactor(Math.min(10, pw));
				let ns = pw > 0 ? b.scale / f : b.scale * f;
				const over = pw > 10 ? clamp(pw - 10, 0, 40) / 40 : 0;      // over-compression 0…1 (power 10…50)
				const minS = minScaleFor(b.amount) / (1 + 3 * over);
				ns = clamp(ns, minS, CONFIG.maxScale);
				if(over > 0) ns = Math.min(ns, minS);
				// Max Output: compression raises power; clamp so the spell stays under its ceiling
				const headroom = api.outputHeadroom() + Math.abs(api.bodyPower(b));
				const powerAt = (s) => b.amount * densityFactor(s) * techMult(b);
				if(powerAt(ns) > headroom){
					let lo = ns, hi = b.scale;
					for(let i = 0; i < 18; i++){ const mid = (lo + hi) / 2; if(powerAt(mid) > headroom) lo = mid; else hi = mid; }
					ns = hi; api.note('Clamped by Max Output');
				}
				if(b.isZone) b.zoneRadius = clamp(b.zoneRadius * (ns / b.scale), 30, 1800);
				b.scale = ns;
				b.amount *= 1 - compressLoss(pw);
				if(pw > 10 && !b.isZone) b.over = Math.max(b.over || 0, clamp(pw - 10, 0, 40));
				else if(pw < 0) b.over = 0;
				if(pw > 0) remember(b, 'compressed');
				if(!b.isZone){
					b.comp = pw > 0 ? Math.max(b.comp || 0, pw) : 0;
					if(b.comp > 0 && b.amount < compMin(b.comp)){ api.collapse(b); return api.fail('Too little energy for compression ' + b.comp + ' — it needs at least ' + Math.ceil(compMin(b.comp)) + ' E, so it collapsed'); }
				}
			}
			if(!(b.locks && b.locks.shape)){
				const target = (p.shape && p.shape !== 'keep') ? p.shape : b.shape;
				api.setShape(b, target, target === 'raw' ? 0 : formFor(pw));
			}
			api.flashBody(b);
		}
	});
	function compressFactor(p){ return 1 + Math.abs(num(p, 0)) * 0.5; }
	/* past 10 the cost climbs steeply (power 50 ≈ 110 energy for the rune alone) */
	function compressCost(pw){ const a = Math.abs(pw); return a <= 10 ? 1 + a * 0.4 : 5 + (a - 10) * 0.9; }      // power 20 → 14, 50 → 41
	function compressLoss(pw){ const a = Math.abs(pw); return 0.01 * Math.min(10, a) + (a > 10 ? 0.002 * (a - 10) : 0); }
	function overK(b){ return b && b.over ? clamp(b.over / 40, 0, 1) : 0; }
	/* massive compression packs density (more power) — its hits are damped hard so it is about piercing and lasting, not one-shotting */
	function overDamp(b){ const o = overK(b); return o > 0 ? 1 / (1 + 2.2 * o) : 1; }
	/* ---- ANTI-MAGIC: how hard a piece of energy is to erase (per unit of energy) ----
	   Each technique states its own resistance (def.antiResist); active spatial structures, Infinity and
	   over-compression make energy harder to consume. Generic: enemy magic uses the same rule. */
	function magicResist(b){
		if(!b) return 1;
		if(b.rupture) return 6;
		let r = 1;
		const d = dominantTech(b);
		if(d){ const def = Techniques.get(d.id); r *= (def && def.antiResist) || 1; }
		if(b.spatial) r *= 1.6;
		if(b.infSource) r *= 3;                      // an Infinity source is not consumed — Anti-Magic disrupts its flow instead
		if(b.over) r *= 1 + 0.5 * overK(b);
		return r;
	}
	function antiOf(b){ return techOf(b, 'antimagic'); }
	/* ---- INFINITY: a technique that turns dense, powerful energy (450+ E, compression 20+) into a reservoir ----
	   The source keeps its own kind of energy; its stability comes from its compression. */
	const INF = {
		minEnergy: 450, minComp: 20,
		/* 20 → 0.14 · 30 → 0.43 · 40 → 0.71 · 50 → 1 */
		stab(comp){ return clamp((num(comp, 0) - 15) / 35, 0.14, 1); },
		label(comp){ const c = num(comp, 0); return c < 30 ? 'extremely unstable' : (c < 40 ? 'very unstable' : (c < 50 ? 'relatively stable' : 'maximum stability')); },
		/* how fast (E/s) the caster can safely draw from it: compression, Infinity technique strength, Energy Control */
		cap(comp, profile){
			const S = INF.stab(comp), pts = Techniques.points(profile, 'infinity');
			return (20 + 330 * Math.pow(S, 1.6)) * Techniques.power(Math.max(1, pts)) * (0.5 + num(profile && profile.energyControl, 5) / 20);
		},
		/* stress a powerful spell of power P adds when it strikes a source (≈2000+ starts to matter; compression resists) */
		disruption(P, comp){ const k = Math.abs(num(P, 0)) / (2000 * (0.5 + 1.5 * INF.stab(comp))); return k * k; },
		/* Spatial Infinity reinforcement: how much of an approach still gets through at distance d (1 = all, never 0) */
		approach(d, r0, R, L){ const u = clamp((d - r0) / Math.max(1, R - r0), 0, 1); return clamp(Math.pow(u, 0.35 + 0.25 * L), 0.015, 1); }
	};
	/* positive / negative spatial behaviour: spatial (portal vs surface) or gravity (attract vs repel) */
	function spatialPolarity(b){
		const sp = techOf(b, 'spatial'), g = techOf(b, 'gravity');
		if(Math.abs(sp) >= CONFIG.tech.minIntensity) return Math.sign(sp);
		if(Math.abs(g) >= CONFIG.tech.minIntensity) return Math.sign(g);
		return 0;
	}
	/* each compression level needs a minimum of energy to hold together — below it the energy collapses */
	function compMin(c){ c = num(c, 0); return c <= 0 ? 0 : 2 + 0.5 * c + 0.04 * c * c; }      // 5 → 5.5 E · 10 → 11 · 20 → 28 · 30 → 53 · 50 → 127
	/* highly compressed energy is dense: gravity moves it less */
	function gravResist(b){ const c = (b && b.comp) || 0; return c <= 5 ? 1 : 1 / (1 + (c - 5) / 12); }      // 10 → 0.7 · 20 → 0.44 · 50 → 0.21
	/* the chance that redirecting over-compressed energy makes it explode (more compression → likelier, more Energy Control → rarer) */
	function unstableChance(c, control){ c = num(c, 0); if(c <= 10) return 0; return clamp(0.5 * Math.pow((c - 10) / 40, 1.4) / (1 + Math.max(0, num(control, 5)) * 0.12), 0, 0.6); }
	/* how fast this kind of energy may travel: raw ≤ 9, Kinetic 8–15, Light 12–18 (+ any Kinetic reinforcement bonus) */
	function speedRange(b){
		if(b && b.rupture) return { lo: 0, hi: 7 };                     // a spatial rupture is hard to steer
		const d = dominantTech(b), bonus = Math.max(0, (b && b.speedBonus) || 0);
		let lo = 0, hi = CONFIG.rawMaxSpeed;
		if(d && d.s > 0 && d.id === 'kinetic'){ lo = 8; hi = 15; }
		else if(d && d.s > 0 && d.id === 'light'){ const v = 18 * (1 + 0.6 * ((b._zf && b._zf.light) || 0)); return { lo: v, hi: v }; }      // light always travels at 18 (faster inside a Light zone)
		return { lo, hi: hi + bonus };
	}
	const ITEM_SHAPES = { fist: 1, sword: 1, lance: 1, hammer: 1 };      // 'lance' is the Spear shape
	const ITEM_DRAW_SHAPE = { fist: 'fist', sword: 'sword', spear: 'lance', hammer: 'hammer' };
	// how far each shape's outline reaches behind / ahead of its centre, in radii (measured from SHAPES)
	const ITEM_EXTENT = { fist: [1.66, 1.22], sword: [1.55, 2.30], lance: [2.12, 2.40], hammer: [2.09, 1.78] };
	/* the item as an energy body, so it is drawn exactly as the compressed shape it was made from */
	function itemBody(item){
		const sh = ITEM_DRAW_SHAPE[item.shape] || item.shape;
		return { id: -1, shape: sh, shapePrev: sh, form: 1, formPrev: 1, morph: 1, scale: item.scale || 0.1, amount: item.amount || 0, over: item.over || 0,
			tech: item.tech ? Object.assign({}, item.tech) : null, source: 'generated', alive: true, age: 10, seed: 3.7, angle: 0, angleSet: true,
			flash: 0, dying: 0, grow: 1, small: 0, vx: 0, vy: 0, locks: {} };
	}
	/* the item's radius as loose energy of that shape (over-compression shrinks it), never too small to hold */
	function itemVisualR(item){ const b = itemBody(item); return Math.max(7, bodyRadius(b)); }
	/* the item drawn loose in the world (a thrown magical weapon) */
	function drawItemAt(ctx, item, x, y, angle, t){
		const b = itemBody(item); b.formRadius = itemVisualR(item); b.angle = angle || 0;
		ctx.save(); drawBody(ctx, b, x, y, t || 0); ctx.restore();
	}
	/* a small picture of the item (hotbar, inventory, slot chooser) */
	function drawItemIcon(canvas, item){
		if(!canvas || !item) return;
		const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height);
		const b = itemBody(item), ext = ITEM_EXTENT[b.shape] || [1.6, 1.6];
		const L = Math.min(canvas.width, canvas.height) * 1.15;
		b.formRadius = L / (ext[0] + ext[1]);
		b.angle = -Math.PI / 4;
		const off = (ext[1] - ext[0]) / 2 * b.formRadius;
		ctx.save(); drawBody(ctx, b, canvas.width / 2 - Math.cos(b.angle) * off, canvas.height / 2 - Math.sin(b.angle) * off, 1.3); ctx.restore();
	}
	function itemEligible(b){
		if(!b || b.foreign || b.isZone || b.immovable) return 'Only your own energy can become a magical item';
		if(!ITEM_SHAPES[b.shape]) return 'Only energy compressed into a fist, sword, spear or hammer can become a magical item';
		if((b.over || 0) < CONFIG.itemMinOver) return 'It must be compressed to 20 or more to become a magical item';
		return null;
	}
	/* what a magical item keeps of the energy it was made from */
	function itemFromBody(b){
		return { shape: b.shape === 'lance' ? 'spear' : b.shape, amount: b.amount, over: b.over || 0, scale: b.scale, tech: b.tech ? Object.assign({}, b.tech) : null };
	}
	function itemStats(item){
		if(!item) return null;
		const amt = Math.max(0, item.amount || 0), scale = item.scale || 0.1;
		const R = itemVisualR(item);                       // the size it is drawn at — exactly the compressed shape
		const ext = ITEM_EXTENT[ITEM_DRAW_SHAPE[item.shape] || item.shape] || [1.6, 1.6];
		const length = (ext[0] + ext[1]) * R;              // the whole item, end to end
		const inf = clamp(num(item.inf, 0), 0, 5);
		// from your hand to its tip (it is held a little in from its back end); Infinity distorts the distance — never past the hard limit
		const reach = Math.min(CONFIG.itemReachMax, (ext[1] + 0.8 * ext[0]) * R * (1 + 0.07 * inf));
		const power = amt * densityFactor(scale), o = clamp((item.over || 0) / 40, 0, 1);
		// highly compressed items hit much harder (compression 50 ≈ 2.4× the damage of compression 20 at the same energy)
		// keeps growing with energy (√power) — every bit you feed it makes it hit harder
		return { R, length, reach, power, range: clamp(0.35 + length / 45, 0.5, 2.4), damage: (1 + 0.28 * Math.sqrt(power / 20)) * (1 + 0.5 * o),
			upkeep: 2 + Math.sqrt(amt) * 0.3 + (item.over || 0) * 0.05 + 2 * Math.pow(inf, 1.5), inf };      // energy per second while it sits in a slot (10k energy ≈ 34/s)      // energy per second while it sits in a slot
	}
	function minScaleFor(amount){ return clamp(1 / (1 + Math.max(0, amount) / 8), CONFIG.minScale, 1); }
	function densityFactor(scale){ return Math.pow(1 / Math.max(0.01, scale), 0.6); }
	function techMult(b){ return b && b.technique ? (b.technique.mult || 1) : 1; }

	/* ---- ANCHOR ---- */
	const STATE_OPTS = [
		{ value:'anchored', label:'Anchored — fixed to a location' },
		{ value:'free',     label:'Free — moves normally' },
		{ value:'attached', label:'Attached — rides on the target' },
		{ value:'guided',   label:'Guided — keeps following the target' },
		{ value:'bound',    label:'Bound — tethered to the target' }
	];
	const BIND_TO_OPTS = [
		{ value:'target', label:'Current target' },
		{ value:'self',   label:'You' },
		{ value:'energy', label:'Nearest other energy of yours' }
	];
	const BIND_SELF_OPTS = [
		{ value:'follow', label:'Energy follows you' },
		{ value:'pull',   label:'Energy pulls you' }
	];
	defineRune({
		id:'anchor', name:'Anchor / State', glyph:'⚓', category:'anchor',
		description:'Sets the energy\'s physical state. ANCHORED: held at a location. FREE: released, moves normally. ATTACHED: rides along on the target. GUIDED: keeps steering after the target or point. BOUND: a magical tether to the target, to you, or to another of your energies — if the target moves farther than the tether allows it is dragged back and slowed (bound to you, the energy either follows you or pulls you toward it; bound to energy, the two are drawn together). Bound can make several tethers at once (Tethers): to the target plus your nearest other energies, or — for a group of pieces — each piece to the next ones. States combine: Bound + Anchored is a restraint fixed in place. Example: Redirect at an enemy → Wait until the spell hits (the energy lodges in what it hit) → Bound → Anchored.',
		params:[
			{ key:'state', label:'State', type:'select', options:STATE_OPTS, default:'anchored' },
			{ key:'where', label:'Anchor at', type:'select', options:[ {value:'here', label:'Where it is'}, {value:'target', label:'Target position'}, {value:'self', label:'Anchor yourself (resist recoil)'} ], default:'here', show:(p) => (p.state || 'anchored') === 'anchored' },
			{ key:'offset', label:'Keep offset', type:'select', options:[ {value:'keep', label:'Keep current offset'}, {value:'snap', label:'Snap to centre'} ], default:'keep', show:(p) => p.state === 'attached' },
			{ key:'len', label:'Tether length', type:'int', min:10, max:600, step:10, default:60, unit:'px', show:(p) => p.state === 'bound' },
			{ key:'bindTo', label:'Bind to', type:'select', options:BIND_TO_OPTS, default:'target', show:(p) => p.state === 'bound' },
			{ key:'selfMode', label:'Bound to you', type:'select', options:BIND_SELF_OPTS, default:'follow', show:(p) => p.state === 'bound' && (p.bindTo || 'target') !== 'energy' },
			{ key:'strength', label:'Bond strength', type:'int', min:1, max:10, step:1, default:5, show:(p) => p.state === 'bound' },
			{ key:'count', label:'Tethers', type:'int', min:1, max:8, step:1, default:1, show:(p) => p.state === 'bound', hint:'How many tethers this energy makes. Extra tethers go to your nearest other energies — or, in a group of pieces, to the next pieces along.' }
		],
		input:{ energy:'required', targetFor:(p) => (p.where === 'target' && (p.state || 'anchored') === 'anchored') || p.state === 'attached' || p.state === 'guided' },
		cost:(p) => p.state === 'bound' ? (1 + 0.3 * clamp(num(p.strength, 5), 1, 10)) * clamp(num(p.count, 1) | 0, 1, 8) : 1,
		summary:(p) => {
			const s = p.state || 'anchored';
			if(s === 'anchored') return p.where === 'target' ? 'anchored at target' : (p.where === 'self' ? 'anchor yourself' : 'anchored in place');
			if(s !== 'bound') return s;
			const to = p.bindTo || 'target';
			const n = clamp(num(p.count, 1) | 0, 1, 8);
			return 'bound ' + (to === 'self' ? 'to you (' + (p.selfMode === 'pull' ? 'pulls you' : 'follows you') + ')' : to === 'energy' ? 'to energy' : '') + (n > 1 ? ' ×' + n + ' tethers' : '') + ' · ' + (num(p.len, 60) | 0) + 'px · str ' + (clamp(num(p.strength, 5), 1, 10) | 0);
		},
		note:(p) => p.state === 'bound' ? 'Strong or fast energy crossing the tether can snap it — a stronger bond holds more. Bound energy that carries Kinetic makes a kinetic bond: enemy magic that hits the tether stretches it and is flung back like a rubber band.'
			: null,
		exec(api, br, p){
			const b = br.ctx.body;
			if(!api.bodyValid(b)) return api.fail('Energy is gone');
			const s = p.state || 'anchored';
			if(b.foreign && s !== 'anchored') return api.note('Another caster\'s projectile can only be anchored');
			const t = br.ctx.target;
			switch(s){
				case 'anchored':
					if(p.where === 'self'){
						// the energy roots you to the ground: recoil is mostly soaked up while it lasts
						const me = api.owner.entity; if(!me) return api.fail('Nothing to anchor');
						if(b.foreign) return api.note('Another caster\'s projectile cannot anchor you');
						b.attach = { target: { kind:'self', ref: me, owner: true }, ox: 0, oy: (me.h || 40) / 2 - 4 };
						b.selfAnchor = true; b.noContact = true; b.anchored = false; b.follow = null; b.vx = 0; b.vy = 0;
						api.note('You are anchored — recoil is reduced');
						return;
					}
					if(p.where === 'target'){ const tp = api.targetPos(br); if(!tp) return api.fail('No valid target'); api.moveBody(b, tp.x, tp.y); }
					api.setVelocity(b, 0, 0);
					if(!b.foreign){ b.anchored = true; b.attach = null; b.follow = null; b.lodged = false; }
					return;
				case 'free':
					b.anchored = false; b.attach = null; b.follow = null; b.bond = null; b.bondsX = null; b.lodged = false; b.arrive = null; b.held = null;
					return;
				case 'attached': {
					if(b.immovable) return api.note('Spatial energy cannot be moved');
					if(!t || t.kind === 'surface' || t.kind === 'environment') return api.fail('No valid target');
					const tp = api.targetPos(br); if(!tp) return api.fail('No valid target');
					if(t.ref === b) return api.fail('Energy cannot attach to itself');
					b.attach = { target: t, ox: p.offset === 'snap' ? 0 : b.x - tp.x, oy: p.offset === 'snap' ? 0 : b.y - tp.y };
					b.anchored = false; b.follow = null; b.vx = 0; b.vy = 0;
					return;
				}
				case 'guided': {
					if(b.immovable) return api.note('Spatial energy cannot be moved');
					if(!t || t.kind === 'environment') return api.fail('No valid target to follow');
					b.follow = t; b.anchored = false; b.attach = null; b.lodged = false; b.arrive = null; b.guided = true;
					if(api.bodySpeed(b) < 0.5){ const tp = api.targetPos(br); if(tp){ const dx = tp.x - b.x, dy = tp.y - b.y, l = Math.hypot(dx, dy) || 1; api.setVelocity(b, dx / l * CONFIG.baseSpeed * 0.7, dy / l * CONFIG.baseSpeed * 0.7); } }
					return;
				}
				case 'bound': {
					if(b.infSource) return api.note('An Infinity source cannot be tethered');
					const to = p.bindTo || 'target';
					let tt = null;
					if(to === 'self'){
						if(!api.owner.entity) return api.fail('Nothing to bind to');
						tt = { kind:'self', ref: api.owner.entity, owner: true };
					} else if(to === 'energy'){
						const o = api.nearestOwnEnergy(b, 600);
						if(!o) return api.fail('No other energy of yours nearby to bind to');
						tt = { kind:'energy', ref: o };
					} else if(t && t.ref === b){
						// each piece is its own target (e.g. Target → energy, all): tie the pieces to each other — a ring
						const g = br.ctx.group;
						let o = null;
						if(g && g.length > 1){
							const i = g.findIndex(m => m.body === b);
							for(let k = 1; k < g.length && !o; k++){ const m = g[(i + k) % g.length]; if(m && m.body && m.body !== b && !m.body.foreign && api.bodyValid(m.body)) o = m.body; }
						}
						if(!o) o = api.nearestOwnEnergy(b, 600);
						if(!o) return api.fail('Nothing to bind to — no other energy of yours nearby');
						if(o.bond && o.bond.t && o.bond.t.ref === b && clamp(num(p.count, 1) | 0, 1, 8) === 1) return;      // already tied the other way
						tt = (o.bond && o.bond.t && o.bond.t.ref === b) ? null : { kind:'energy', ref: o };
					} else {
						// tether to the current target — or to whatever this energy is lodged in
						tt = (t && t.kind !== 'environment' && t.kind !== 'surface' && t.ref !== b) ? t : (b.attach ? b.attach.target : null);
					}
					const n = clamp(num(p.count, 1) | 0, 1, 8);
					const mk = (t2) => ({ t: t2, len: clamp(num(p.len, 60), 10, 600), str: clamp(num(p.strength, 5), 1, 10), mode: p.selfMode === 'pull' ? 'pull' : 'follow' });
					const list = tt ? [ tt ] : [];
					// more tethers: the next pieces of the group, then your nearest other energies
					const used = new Set(list.map(q => q.ref)); used.add(b);
					const g = br.ctx.group;
					if(list.length < n && g && g.length > 1){
						const i = g.findIndex(m => m.body === b);
						for(let k = 1; k < g.length && list.length < n; k++){
							const m = g[(i + k) % g.length]; const o = m && m.body;
							if(!o || used.has(o) || o.foreign || !api.bodyValid(o)) continue;
							if((o.bond && o.bond.t && o.bond.t.ref === b) || (o.bondsX || []).some(q => q.t && q.t.ref === b)) continue;      // already tied the other way
							list.push({ kind:'energy', ref: o }); used.add(o);
						}
					}
					if(list.length < n) for(const o of api.nearestOwnEnergies(b, 600, n - list.length, used)) list.push({ kind:'energy', ref: o });
					const hadSrc = list.some(q => q && q.ref && q.ref.infSource);
					for(let i = list.length - 1; i >= 0; i--) if(list[i] && list[i].ref && list[i].ref.infSource) list.splice(i, 1);      // an Infinity source cannot be tethered
					if(!list.length) return api.fail(hadSrc ? 'An Infinity source cannot be tethered' : 'Nothing to bind to — target something first (or let the energy lodge in what it hits)');
					b.bond = mk(list[0]); b.bondsX = list.slice(1).map(mk);
					remember(b, 'bound');
					return;
				}
			}
		}
	});
	/* the energy's physical state (several can hold at once: e.g. anchored + bound) */
	function stateOf(b){
		if(!b || b.foreign) return [];
		const s = [];
		if(b.attach) s.push(b.lodged ? 'attached (lodged)' : 'attached');
		else if(b.anchored) s.push('anchored');
		else if(b.follow) s.push('guided');
		else s.push('free');
		if(b.bond) s.push('bound');
		if(b.infSource) s.push('infinity source');
		return s;
	}
	function hasState(b, st){
		if(!b || b.foreign) return st === 'free';
		switch(st){
			case 'anchored': return !!b.anchored && !b.attach;
			case 'attached': return !!b.attach;
			case 'guided': return !!b.follow;
			case 'bound': return !!b.bond;
			case 'infinity': return !!b.infSource;
			case 'free': return !b.anchored && !b.attach && !b.follow;
		}
		return false;
	}

	/* ---- ATTACH ---- */
	defineRune({
		id:'attach', movesEnergy:true, name:'Attach', glyph:'⛓', category:'attachment',
		description:'Binds the targeted energy to the current target so it travels with it. Energy attached to a creature does not strike that creature.',
		params:[ { key:'offset', label:'Keep offset', type:'select', options:[ {value:'keep', label:'Keep current offset'}, {value:'snap', label:'Snap to centre'} ], default:'keep' } ],
		input:{ energy:'required', targetFor:() => true },
		cost:() => 1.5,
		summary:(p) => p.offset === 'snap' ? 'snap' : 'keep offset',
		exec(api, br, p){
			const b = br.ctx.body;
			if(!api.bodyValid(b)) return api.fail('Energy is gone');
			if(b.foreign) return api.note('Cannot attach another spell\'s projectile');
			if(b.immovable) return api.note('Spatial energy cannot be moved — it has become a ' + (b.spatial ? b.spatial.kind : 'fixed form'));
			const t = br.ctx.target;
			if(!t || t.kind === 'surface' || t.kind === 'environment') return api.fail('No valid target');
			const tp = api.targetPos(br);
			if(!tp) return api.fail('No valid target');
			if(t.ref === b) return api.fail('Energy cannot attach to itself');
			const ox = p.offset === 'snap' ? 0 : b.x - tp.x, oy = p.offset === 'snap' ? 0 : b.y - tp.y;
			b.attach = { target: t, ox, oy };
			b.anchored = false; b.follow = null; b.vx = 0; b.vy = 0;
		}
	});

	/* ---- LOCK ---- */
	const LOCK_OPTS = [ {value:'direction', label:'Direction'}, {value:'shape', label:'Shape'}, {value:'size', label:'Size / compression'} ];
	defineRune({
		id:'lock', name:'Lock', glyph:'🔒', category:'lock',
		description:'Prevents later modifications from changing one property of the targeted energy.',
		params:[ { key:'prop', label:'Lock', type:'select', options:LOCK_OPTS, default:'direction' } ],
		input:{ energy:'required' },
		cost:() => 1,
		summary:(p) => labelOf(LOCK_OPTS, p.prop),
		exec(api, br, p){
			const b = br.ctx.body;
			if(!api.bodyValid(b)) return api.fail('Energy is gone');
			if(b.foreign) return api.note('Cannot lock another spell\'s projectile');
			b.locks = b.locks || {}; b.locks[p.prop] = true;
		}
	});

	/* ---- FORCE (signed power → negative reverses) ---- */
	defineRune({
		id:'force', name:'Force', glyph:'⇶', category:'movement',
		description:'Uses the energy to push the current target away from it. Negative power reverses the effect into a pull. Works on yourself (a launch), allies, enemies and other spells\' energy.',
		params:[ { key:'power', label:'Power', type:'signed', min:-10, max:10, step:1, default:5, nonZero:true } ],
		input:{ energy:'required', targetFor:() => true },
		cost:(p) => 1 + Math.abs(num(p.power, 5)) * 0.6,
		loss:(p) => 0.03 * Math.abs(num(p.power, 5)),
		summary:(p) => (num(p.power,0) > 0 ? 'push +' : 'pull ') + p.power,
		analyze(p, a, node){ if(num(p.power,0) === 0) a.error(node, 'PARAM', 'Invalid parameter — Power cannot be 0'); },
		exec(api, br, p){
			const b = br.ctx.body;
			if(!api.bodyValid(b)) return api.fail('Energy is gone');
			const t = br.ctx.target;
			if(!t || t.kind === 'surface' || t.kind === 'environment') return api.fail('No valid target');
			const tp = api.targetPos(br);
			if(!tp) return api.fail('No valid target');
			const bp = api.bodyPos(b);
			let dx = tp.x - bp.x, dy = tp.y - bp.y;
			const l = Math.sqrt(dx*dx + dy*dy) || 1; dx /= l; dy /= l;
			const pw = num(p.power, 5);
			const mag = Math.sign(pw) * Math.min(26, 2 + Math.abs(pw) * (0.6 + Math.sqrt(Math.abs(api.bodyPower(b))) * 0.18));
			if((t.kind === 'spell' || t.kind === 'energy') && t.ref){
				const r = t.ref;
				api.setVelocity(r, api.bodyVel(r).x + dx * mag * 0.6, api.bodyVel(r).y + dy * mag * 0.6);
			} else if(t.ref){
				api.host.applyImpulse(t.ref, dx * mag, dy * mag, { self: t.kind === 'self', caster: api.owner.entity });
			}
			if(!b.foreign) b.amount *= 1 - 0.03 * Math.abs(pw);
			api.pulseFx(bp.x, bp.y, b, 0.6);
		}
	});

	/* ---- ROTATE ---- */
	const ROT_MODE = [ { value:'continuous', label:'Spin continuously' }, { value:'set', label:'Turn by an angle' } ];
	const ROT_WHAT = [ { value:'shape', label:'Its facing (the shape)' }, { value:'path', label:'Its direction of travel' }, { value:'both', label:'Both' } ];
	const ROT_DIR = [ { value:'cw', label:'Clockwise' }, { value:'ccw', label:'Counter-clockwise' } ];
	defineRune({
		id:'rotate', name:'Rotate', glyph:'⟳', category:'movement',
		movesEnergy:(p) => p.turns !== 'shape',
		description:'Turns the targeted energy. Spin continuously keeps it rotating until the spell ends; Turn by an angle rotates it by a set number of degrees, instantly or over a short time. Choose what turns: its facing (a sword or hammer shape swings around), its direction of travel (it curves — a continuous spin makes it circle), or both.',
		params:[
			{ key:'mode', label:'Rotation', type:'select', options:ROT_MODE, default:'continuous' },
			{ key:'turns', label:'What turns', type:'select', options:ROT_WHAT, default:'shape' },
			{ key:'dir', label:'Direction', type:'select', options:ROT_DIR, default:'cw' },
			{ key:'speed', label:'Speed', type:'int', min:10, max:1440, step:10, default:360, unit:'°/s', show:(p) => p.mode !== 'set' },
			{ key:'degrees', label:'Angle', type:'int', min:1, max:360, step:1, default:90, unit:'°', show:(p) => p.mode === 'set' },
			{ key:'time', label:'Over', type:'float', min:0, max:5, step:0.05, default:0.25, unit:'s', show:(p) => p.mode === 'set', hint:'0 = instantly' }
		],
		input:{ energy:'required' },
		cost:(p) => p.mode === 'set' ? 1 : 2,
		summary:(p) => (p.mode === 'set' ? (p.dir === 'ccw' ? '↺ ' : '↻ ') + num(p.degrees, 90) + '°' : (p.dir === 'ccw' ? '↺ ' : '↻ ') + num(p.speed, 360) + '°/s') + ' · ' + (p.turns === 'path' ? 'path' : (p.turns === 'both' ? 'shape + path' : 'shape')),
		exec(api, br, p){
			const b = br.ctx.body;
			if(!api.bodyValid(b)) return api.fail('Energy is gone');
			const sign = p.dir === 'ccw' ? -1 : 1;
			const shape = p.turns !== 'path', path = p.turns !== 'shape';
			if(b.foreign){
				// another caster's projectile: only its path can be turned, by a set angle
				if(p.mode !== 'set' || !path) return api.note('Another caster\'s projectile can only be turned by an angle');
				const a = sign * num(p.degrees, 90) * Math.PI / 180, v = api.bodyVel(b), c = Math.cos(a), s = Math.sin(a);
				api.setVelocity(b, v.x * c - v.y * s, v.x * s + v.y * c);
				return;
			}
			if(path && (b.immovable || (b.locks && b.locks.direction)) && !shape) return api.note(b.immovable ? 'Spatial energy cannot be moved' : 'Direction is locked');
			if(p.mode === 'set'){
				const total = sign * num(p.degrees, 90) * Math.PI / 180, time = Math.max(0, num(p.time, 0.25));
				if(time <= 0){ applyTurn(b, total, shape, path); return; }
				b.turn = { left: total, rate: Math.abs(total) / time, shape, path };
			} else {
				b.spin = { rate: sign * num(p.speed, 360) * Math.PI / 180, shape, path };      // until the spell ends
			}
		}
	});
	/* rotate a body's facing and/or its velocity by a (signed, radians) angle */
	function applyTurn(b, a, shape, path){
		if(path && !b.anchored && !b.attach && !b.immovable && !(b.locks && b.locks.direction)){
			const c = Math.cos(a), s = Math.sin(a), vx = b.vx * c - b.vy * s;
			b.vy = b.vx * s + b.vy * c; b.vx = vx;
			if(b.arrive) b.arrive = null;
		}
		if(shape){ b.angleOffset = (b.angleOffset || 0) + a; if(Math.hypot(b.vx, b.vy) <= 0.3) b.angle += a; }
	}

	/* ---- DISCHARGE ---- */
	defineRune({
		id:'discharge', name:'Discharge', glyph:'✸', category:'release',
		description:'Releases all of the targeted energy at once as a burst around it. Damage scales with power; expanded energy covers a wider area. Your own spells never hurt you.',
		params:[ { key:'radius', label:'Burst size', type:'float', min:0.5, max:3, step:0.1, default:1.4, unit:'×' } ],
		input:{ energy:'required' },
		cost:() => 2,
		summary:(p) => 'burst ×' + num(p.radius, 1.4).toFixed(1),
		analyze(p, a){ if(a.ctx.body && !a.ctx.body.foreign){ a.touch(a.ctx.body); a.ctx.body.released = true; } },
		exec(api, br, p){
			const b = br.ctx.body;
			if(!api.bodyValid(b)) return api.fail('Energy is gone');
			if(b.foreign) return api.note('Cannot discharge another spell\'s projectile');
			const r = (b.isZone ? b.zoneRadius : bodyRadius(b) * 2.6 + 28) * num(p.radius, 1.4);
			const dmg = Math.abs(api.bodyPower(b)) * 0.85;
			api.burst(b.x, b.y, r, dmg, b);
			api.consumeBody(b, 'discharge');
		}
	});

	/* ---- INFUSE (beneficial; self/ally) ---- */
	defineRune({
		id:'infuse', name:'Infuse', glyph:'✚', category:'release',
		description:'Pours the targeted energy into the current target as restoration. Valid on yourself and allies. The energy is used up.',
		params:[ { key:'portion', label:'Portion', type:'int', min:10, max:100, step:5, default:100, unit:'%' } ],
		input:{ energy:'required', targetFor:() => true, targetKinds:['self','ally'] },
		cost:() => 2,
		summary:(p) => p.portion + '% → heal',
		exec(api, br, p){
			const b = br.ctx.body;
			if(!api.bodyValid(b)) return api.fail('Energy is gone');
			if(b.foreign) return api.note('Cannot infuse another spell\'s energy');
			const t = br.ctx.target;
			if(!t || (t.kind !== 'self' && t.kind !== 'ally') || !t.ref) return api.fail('No valid target');
			const part = clamp(num(p.portion, 100), 1, 100) / 100;
			const heal = Math.abs(api.bodyPower(b)) * part * 0.5;
			api.host.heal(t.ref, heal, { self: t.kind === 'self' });
			const tp = api.targetPos(br);
			if(tp) api.pulseFx(tp.x, tp.y, b, 1);
			if(part >= 0.999) api.consumeBody(b, 'infuse'); else b.amount *= 1 - part;
		}
	});

	/* ---- TECHNIQUE — one rune for every technique ---- */
	/* power is signed: positive = the technique, negative = its reverse */
	function techReversed(p, force){ return !!force || num(p && p.power, 5) < 0 || (p && p.mode === 'reverse'); }
	function techPower(p){ return Math.abs(num(p && p.power, 5)) || 5; }
	const TECH_FOCUS = { enemy:1, ally:1, self:1, surface:1, environment:1, weapon:1 };
	function techEnergyKind(b){ return !b ? null : (b.foreign ? 'spell' : ((b.zone || b.isZone) ? 'zone' : 'energy')); }
	/* Technique → Remove: the energy goes back to plain raw energy (any portal / surface form ends) */
	function stripTech(b){
		b.tech = null; b.technique = null; b.focus = null; b.lightBounces = null; b._bounces = 0;
		if(b.infSource){ b.infSource = null; b.infStress = 0; remember(b, 'infinityCollapsed'); }      // the reservoir goes with it
		if(b.spatial || b.immovable){ b.spatial = null; b.immovable = false; b.noContact = false; b.keepEnergy = false; b.hideBody = false; }
		b.angleSet = false;
	}
	/* ---- INFINITY (a layer technique): it does not convert the energy — it turns it into a reservoir of its own kind ---- */
	function infinityAnalyze(d, p, a, node, forceReverse){
		if(Techniques.points(a.profile, d.id) <= 0) a.error(node, 'TECH_LOCKED', Techniques.accessError(d.id));
		const b = a.ctx.body;
		a.report.techniques[d.id] = true;
		if(!b || b.foreign || b.zone){ a.error(node, 'INF_TARGET', 'Infinity needs energy of your own — not a zone or another caster\'s projectile'); return; }
		if(techReversed(p, forceReverse)){ b.infSource = false; return; }
		let ok = true;
		if(b.amount < INF.minEnergy){ ok = false; a.warn(node, 'INF_ENERGY', 'Infinity needs at least ' + INF.minEnergy + ' energy — this energy is about ' + Math.round(b.amount) + ', so the rune will fail (nothing is used up)'); }
		if((b.comp || 0) < INF.minComp){ ok = false; a.warn(node, 'INF_COMPRESS', 'Infinity needs Compression ' + INF.minComp + '+ (this energy is at ' + (b.comp || 0) + ') — the rune will fail'); }
		if(!ok) return;
		b.infSource = true;
		a.extra({ tech: { technique: 'Infinity source', keeps: b.tech ? (techList(b) || 'raw') : 'raw energy', stability: INF.label(b.comp) + ' (compression ' + b.comp + ')', safe: 'draw about ' + Math.round(INF.cap(b.comp, a.profile)) + ' E/s safely' } });
		if(Math.abs((b.tech && b.tech.antimagic) || 0) >= CONFIG.tech.minIntensity) a.warn(node, 'INF_ANTI', 'An Anti-Magic Infinity source is at war with itself — it destabilises steadily');
	}
	function infinityExec(api, br, p, b, forceReverse){
		if(b.foreign) return api.note('Another caster\'s projectile cannot become Infinity');
		if(b.isZone) return api.fail('A zone cannot become Infinity — use energy');
		if(techReversed(p, forceReverse)){ if(!b.infSource) return api.note('This energy is not an Infinity source'); api.endInfinity(b, 'dissolved'); return; }
		if(b.infSource) return api.note('Already an Infinity source');
		// both requirements, checked before anything is used up
		if(b.amount < INF.minEnergy) return api.fail('Infinity needs at least ' + INF.minEnergy + ' energy (this has ' + Math.floor(b.amount) + ')');
		if((b.comp || 0) < INF.minComp) return api.fail('Infinity needs Compression ' + INF.minComp + ' or more (this is at ' + (b.comp || 0) + ')');
		api.makeInfinity(b);
	}
	function techniqueAnalyze(p, a, node, forceReverse){
		const d = Techniques.get(p.technique);
		if(!p.technique || !d){ a.error(node, 'TECH_NONE', Techniques.list().length ? 'Choose a technique' : 'No techniques exist yet'); return; }
		if(d.layer && a.ctx.body && a.ctx.body.zone){ a.error(node, 'TECH_ZONE', d.name + ' zones are not possible — a zone cannot become ' + d.name); return; }
		if(d.layer){ infinityAnalyze(d, p, a, node, forceReverse); return; }
		const pts = Techniques.points(a.profile, d.id);
		const rev = techReversed(p, forceReverse);
		const b = a.ctx.body;
		const kind = techEnergyKind(b);
		let valid = true;
		if(pts <= 0){ a.error(node, 'TECH_LOCKED', Techniques.accessError(d.id)); valid = false; }
		if(kind && !Techniques.allows(d.id, kind)){ a.error(node, 'TECH_TARGET', Techniques.incompatible(d.id, kind)); valid = false; }
		const tk = a.ctx.target;
		if(tk && TECH_FOCUS[tk] && !Techniques.allows(d.id, tk)){ a.error(node, 'TECH_TARGET', Techniques.incompatible(d.id, tk)); valid = false; }
		const inten = Techniques.intensity(d.id, Math.max(1, pts), techPower(p));
		const loss = Techniques.loss(d.id, pts) * (0.5 + techPower(p) / 20);
		let charge = 0;
		if(b && !b.foreign){
			b.tech = Object.assign({}, b.tech || {});
			if(convertTech(b, d.id)) a.warn(node, 'TECH_CONVERT', 'This energy already has a different technique — it is converted to ' + d.name + ' energy only');
			addTech(b, d.id, (rev ? -1 : 1) * (pts > 0 ? inten : 0));
			if(b.infSource && d.id === 'antimagic') a.warn(node, 'INF_ANTI', 'An Anti-Magic Infinity source is at war with itself — it destabilises steadily');
			if(kind === 'zone'){ charge = techPower(p) * CONFIG.tech.zoneChargePerPower; a.report.cost += charge; a.report.upfront += charge; }
			else { a.report.efficiencyLoss += b.amount * loss; b.amount *= 1 - loss; }
		}
		a.report.techniques[d.id] = true;
		const techExtra = { tech: {
			technique: rev ? d.reversedName + ' (reverse ' + d.name + ')' : d.name,
			points: pts, power: pts > 0 ? inten.toFixed(2) : '0', state: b && b.tech ? techList(b) : '—',
			cost: Math.round((Runes.technique.cost(p) + charge) * 10) / 10,
			efficiency: Math.round((1 - loss) * 100) + '%', valid: valid ? 'Yes' : 'No',
			reverse: d.reversedName ? 'Available (' + d.reversedName + ')' : '—'
		} };
		if(kind === 'zone' && d.zoneInfo) techExtra.tech.zone = d.zoneInfo(rev);
		a.extra(techExtra);
		if(d.analyze && kind !== 'zone') d.analyze(p, a, node);         // technique-specific checks (e.g. Spatial needs a destination)
	}
	function techniqueExec(api, br, p, forceReverse){
		const d = Techniques.get(p.technique);
		if(!d) return api.fail('Choose a technique');
		if(!Techniques.canUse(api.profile, d.id)) return api.fail(Techniques.accessError(d.id));
		const b = br.ctx.body;
		if(!api.bodyValid(b)) return api.fail('Energy is gone');
		if(d.layer && b.isZone) return api.fail(d.name + ' cannot be given to a zone — a zone is not energy that can become a reservoir');
		if(d.layer) return infinityExec(api, br, p, b, forceReverse);
		const kind = techEnergyKind(b);
		if(!Techniques.allows(d.id, kind)) return api.fail(Techniques.incompatible(d.id, kind));
		const t = br.ctx.target;
		if(t && TECH_FOCUS[t.kind] && !Techniques.allows(d.id, t.kind)) return api.fail(Techniques.incompatible(d.id, t.kind));
		const pts = Techniques.points(api.profile, d.id);
		const s = (techReversed(p, forceReverse) ? -1 : 1) * Techniques.intensity(d.id, pts, techPower(p));
		const T = api.T();
		const ctx = { api, br, params: p, sign: Math.sign(s), points: pts, power: techPower(p) };
		if(b.foreign){
			// another caster's projectile: manipulate it, never delete / duplicate / steal it
			if(d.onForeign) d.onForeign(T, b.ref, s, ctx);
			api.pulseFx(b.ref.x, b.ref.y, { tech: { [d.id]: s } }, 0.5);
			return;
		}
		if(kind === 'zone') b.fieldCharge = (b.fieldCharge || 0) + techPower(p) * CONFIG.tech.zoneChargePerPower;
		else if(b.inst === api.instance.id){
			const loss = Techniques.loss(d.id, pts) * (0.5 + techPower(p) / 20);
			api.instance.effLoss = (api.instance.effLoss || 0) + b.amount * loss;
			b.amount *= 1 - loss;
		}
		if(d.canApply && kind !== 'zone'){ const why = d.canApply(T, b, s, ctx); if(why) return api.fail(why); }
		if(convertTech(b, d.id)) api.note('Converted to ' + d.name + ' ' + (kind === 'zone' ? 'zone' : 'energy'));
		const before = techOf(b, d.id);
		addTech(b, d.id, s);
		if(t && TECH_FOCUS[t.kind] && kind !== 'zone') b.focus = t;
		if(kind === 'zone'){ remember(b, 'zoneLaw'); api.flashBody(b); return; }      // a zone does not change form: it changes the rules inside it (see the technique's zone law)
		if(d.onApply) d.onApply(T, b, techOf(b, d.id), Object.assign(ctx, { before }));
		api.flashBody(b);
	}
	defineRune({
		id:'technique', name:'Technique', glyph:'✧', category:'technique',
		description:'Applies a technique — a magical law you have put Technique Points into — to the energy this branch targets. It gives the energy a property (heat, space, gravity, motion, light, binding); what that property does depends on how the rest of the spell is built. Techniques do not stack: applying a different technique converts the energy to that technique only. The same technique adds to itself, and a technique and its reverse cancel by magnitude.',
		params:[
			{ key:'action', label:'Action', type:'select', options:[ { value:'apply', label:'Apply a technique' }, { value:'remove', label:'Remove its technique (back to raw energy)' } ], default:'apply' },
			{ key:'technique', label:'Technique', type:'technique', default:'', show:(p) => p.action !== 'remove' },
			{ key:'power', label:'Technique power', type:'signed', min:-10, max:10, step:1, default:5, nonZero:true, hint:'Negative power is the reverse of the technique', show:(p) => p.action !== 'remove' }
		],
		input:{ energy:'required' },
		cost:(p) => p.action === 'remove' ? 1 : (p.technique === 'infinity' && !techReversed(p) ? 40 + techPower(p) * 4 : 2 + techPower(p) * 0.6),
		summary:(p) => { if(p.action === 'remove') return 'remove technique'; const d = Techniques.get(p.technique); return d ? (techReversed(p) ? d.reversedName : d.name) + ' · ' + num(p.power, 5) : 'choose technique'; },
		analyze(p, a, node){
			if(p.action === 'remove'){ const b = a.ctx.body; if(b && !b.foreign){ b.tech = null; b.technique = null; } return; }
			techniqueAnalyze(p, a, node, false);
		},
		exec(api, br, p){
			if(p.action === 'remove'){
				const b = br.ctx.body;
				if(!api.bodyValid(b)) return api.fail('Energy is gone');
				if(b.foreign) return api.note('Another caster\'s projectile keeps its own nature');
				if(!hasTech(b) && !b.spatial) return api.note('This energy has no technique');
				stripTech(b);
				api.flashBody(b);
				return;
			}
			return techniqueExec(api, br, p, false);
		}
	});
	/* old saved spells: "Reverse Technique" is now the Technique rune's reverse form */
	defineRune({
		id:'reverseTechnique', name:'Reverse Technique', glyph:'☯', category:'technique', hidden:true,
		description:'Legacy — use the Technique rune with its reverse form.',
		params: Runes.technique.params,
		input:{ energy:'required' },
		cost:(p) => 2 + techPower(p) * 0.6,
		summary:(p) => { const d = Techniques.get(p.technique); return d ? d.reversedName : 'none chosen'; },
		analyze(p, a, node){ techniqueAnalyze(p, a, node, true); },
		exec(api, br, p){ return techniqueExec(api, br, p, true); }
	});

	/* ---- REINFORCEMENT — pour energy into an existing thing ---- */
	defineRune({
		id:'reinforce', name:'Reinforcement', glyph:'⛨', category:'reinforcement',
		description:'Pours the energy into something that already exists to strengthen it physically: yourself, an ally, your weapon, or an active spell. It is not a technique and needs no Technique Points. What gets stronger depends on the target — and on techniques already shaping the energy (Kinetic energy adds striking and movement force, Thermal makes a weapon burn …). It lasts while its energy holds out, never longer than the spell. With no target yet, it applies to the next Target in this branch.',
		params:[ { key:'portion', label:'Energy used', type:'int', min:10, max:100, step:5, default:100, unit:'%' } ],
		input:{ energy:'required' },
		cost:() => 2,
		summary:(p) => num(p.portion, 100) + '% of the energy',
		analyze(p, a, node){
			const b = a.ctx.body;
			if(!b) return;
			if(b.foreign){ a.error(node, 'REINF_FOREIGN', 'Reinforcement needs energy of your own — another caster\'s projectile cannot be poured into anything'); return; }
			if(b.zone){ a.error(node, 'REINF_ZONE', 'Reinforcement needs energy — a zone itself cannot be poured in. Draw Out first.'); return; }
			const t = a.ctx.target;
			if(t && t !== 'energy' && t !== 'spell'){
				if(!Reinforcement.targets[t]) a.error(node, 'REINF_TARGET', 'Reinforcement cannot strengthen ' + (TARGET_NOUN[t] || t) + ' — it works on yourself, an ally, your weapon or an active spell');
				else if(num(p.portion, 100) >= 100) b.released = true;
			} else {
				b.reinforcePending = { node: node.id, portion: num(p.portion, 100) };
			}
			const eff = Reinforcement.efficiency(a.profile);
			const E = b.amount * num(p.portion, 100) / 100;
			const st = Reinforcement.strength(E, densityFactor(b.scale), eff);
			a.report.efficiencyLoss += E * (1 - eff);
			a.extra({ reinf: { energy: Math.round(E), efficiency: Math.round(eff * 100) + '%', strength: Math.round(st * 100) + '%', target: t || 'next Target' } });
		},
		exec(api, br, p){
			const b = br.ctx.body;
			if(!api.bodyValid(b)) return api.fail('Energy is gone');
			if(b.foreign) return api.fail('Reinforcement needs energy of your own');
			if(b.isZone) return api.fail('A zone itself cannot be poured into anything — Draw Out first');
			const t = br.ctx.target;
			const portion = clamp(num(p.portion, 100), 1, 100);
			if(t && t.kind !== 'energy' && t.kind !== 'spell'){
				const r = api.reinforce(b, t, portion);
				if(r !== true) return api.fail(r);
				return;
			}
			b.reinforcePending = { portion };
			api.note('Reinforcement waits for a target');
		}
	});

	/* ---- SPELL MEMORY — continue only if the energy's history matches ---- */
	defineRune({
		id:'memory', name:'Spell Memory', glyph:'⟲', category:'memory',
		description:'Checks what has already happened to this energy and only lets the branch continue if it matches — e.g. "if it has passed through a portal", "if it has collided twice", "if it was never compressed". Energy that does not match ends this branch quietly (on divided energy, only the matching pieces carry on). Memory is kept through Split, Divide and combining. Use it after a Wait until to react to what the energy went through.',
		params:[
			{ key:'event', label:'If the energy', type:'select', options: MEM_EVENTS, default:'collided' },
			{ key:'test', label:'Test', type:'select', options:[ { value:'atLeast', label:'At least … times' }, { value:'exactly', label:'Exactly … times' }, { value:'never', label:'Never' } ], default:'atLeast' },
			{ key:'count', label:'Times', type:'int', min:1, max:20, step:1, default:1, show:(p) => p.test !== 'never' }
		],
		input:{ energy:'required' },
		cost:() => 0.5,
		summary:(p) => (p.test === 'never' ? 'never ' : '') + labelOf(MEM_EVENTS, p.event || 'collided').toLowerCase() + (p.test === 'never' ? '' : (p.test === 'exactly' ? ' exactly ' : ' ≥ ') + Math.max(1, num(p.count, 1)) + '×'),
		exec(api, br, p){
			const b = br.ctx.body;
			if(!api.bodyValid(b)) return api.fail('Energy is gone');
			const n = memCount(b, p.event || 'collided'), want = Math.max(1, num(p.count, 1));
			const pass = p.test === 'never' ? n === 0 : (p.test === 'exactly' ? n === want : n >= want);
			if(!pass) return api.fail('Memory: ' + labelOf(MEM_EVENTS, p.event || 'collided').toLowerCase() + ' ' + n + '× — no match');
		}
	});

	function labelOf(opts, v){ const o = opts.find(x => x.value === v); return o ? o.label : String(v == null ? '' : v); }

	/* =====================================================================
	   CONDITIONS (connector mode "condition")
	   Evaluated only once execution reaches the connector.
	   ===================================================================== */
	const Conditions = {};
	function defineCondition(def){ def.params = def.params || []; Conditions[def.id] = def; return def; }
	function condDefaults(id){ const d = Conditions[id]; const o = {}; if(d) for(const p of d.params) o[p.key] = p.default; return o; }

	defineCondition({ id:'targetNear', name:'Target is nearby', needs:'target',
		description:'Waits until the current target is within range of the energy (or of you if there is no energy).',
		params:[ { key:'range', label:'Range', type:'int', min:10, max:1200, step:10, default:120, unit:'px' } ],
		check(api, br, p){
			const tp = api.targetPos(br); if(!tp) return 'fail';
			const rp = api.refPoint(br);
			return dist(tp.x, tp.y, rp.x, rp.y) <= num(p.range, 120);
		} });
	defineCondition({ id:'enemyNear', name:'Enemy is nearby',
		description:'Waits until any enemy is within range of the energy.',
		params:[ { key:'range', label:'Range', type:'int', min:10, max:1200, step:10, default:140, unit:'px' } ],
		check(api, br, p){
			const rp = api.refPoint(br); const r = num(p.range, 140);
			const list = api.host.getEnemies();
			for(let i = 0; i < list.length; i++){
				const e = list[i]; if(!e || e.dead) continue;
				const c = center(e); if(dist(c.x, c.y, rp.x, rp.y) <= r) return true;
			}
			return false;
		} });
	defineCondition({ id:'targetDead', name:'Target is dead', needs:'target',
		description:'Waits until the current target has died.',
		check(api, br){ const t = br.ctx.target; if(!t || !t.ref) return 'fail'; return !!(t.ref.dead || (t.ref.hp != null && t.ref.hp <= 0) || t.ref.alive === false); } });
	defineCondition({ id:'targetInZone', name:'Target enters the zone', needs:'target',
		description:'Waits until the current target is inside the zone created earlier in this branch.',
		check(api, br){
			const z = br.ctx.zone; if(!z || !z.alive) return 'fail';
			const tp = api.targetPos(br); if(!tp) return 'fail';
			return dist(tp.x, tp.y, z.x, z.y) <= z.zoneRadius;
		} });
	defineCondition({ id:'surfaceContact', name:'Energy contacts a surface', needs:'energy',
		description:'Waits until the energy touches a wall, floor or other physical surface.',
		check(api, br){ const b = br.ctx.body; if(!b) return 'fail'; if(b.touchedSurface) return true; return api.bodyValid(b) ? false : 'fail'; } });
	defineCondition({ id:'spellContact', name:'Energy contacts another spell', needs:'energy',
		description:'Waits until the energy overlaps energy belonging to a different spell.',
		check(api, br){ const b = br.ctx.body; if(!api.bodyValid(b)) return 'fail'; return api.touchingOtherSpell(b); } });
	defineCondition({ id:'energyGone', name:'Targeted spell is destroyed', needs:'energy',
		description:'Waits until the energy this branch targets no longer exists (e.g. another spell you targeted).',
		check(api, br){ const b = br.ctx.body; return !api.bodyValid(b); } });
	defineCondition({ id:'travelled', name:'Energy has travelled', needs:'energy',
		description:'Waits until the energy has moved a distance since reaching this connector.',
		params:[ { key:'distance', label:'Distance', type:'int', min:10, max:2000, step:10, default:200, unit:'px' } ],
		start(api, br){
			br.condMemo = {};
			const list = br.ctx.group ? br.ctx.group.map(m => m.body) : [br.ctx.body];
			for(const b of list) if(b && api.bodyValid(b)){ const q = api.bodyPos(b); br.condMemo[b.id] = { x: q.x, y: q.y }; }
		},
		check(api, br, p){ const b = br.ctx.body; const m = br.condMemo && b && br.condMemo[b.id]; if(!api.bodyValid(b) || !m) return 'fail'; const bp = api.bodyPos(b); return dist(bp.x, bp.y, m.x, m.y) >= num(p.distance, 200); } });
	defineCondition({ id:'stopped', name:'Energy has stopped', needs:'energy',
		description:'Waits until the energy is no longer moving.',
		check(api, br){ const b = br.ctx.body; if(!api.bodyValid(b)) return 'fail'; return api.bodySpeed(b) < 0.4; } });
	defineCondition({ id:'casterNear', name:'You are nearby', needs:'energy',
		description:'Waits until you (the caster) are within range of the energy.',
		params:[ { key:'range', label:'Range', type:'int', min:10, max:1200, step:10, default:120, unit:'px' } ],
		check(api, br, p){ const b = br.ctx.body; if(!api.bodyValid(b)) return 'fail'; const c = api.casterPos(); const bp = api.bodyPos(b); return dist(c.x, c.y, bp.x, bp.y) <= num(p.range, 120); } });
	defineCondition({ id:'casterFar', name:'You are far away', needs:'energy',
		description:'Waits until you (the caster) are farther than the range from the energy.',
		params:[ { key:'range', label:'Range', type:'int', min:10, max:2000, step:10, default:300, unit:'px' } ],
		check(api, br, p){ const b = br.ctx.body; if(!api.bodyValid(b)) return 'fail'; const c = api.casterPos(); const bp = api.bodyPos(b); return dist(c.x, c.y, bp.x, bp.y) > num(p.range, 300); } });

	/* ---- more "wait until" conditions ---- */
	function groupBodies(br){
		const out = [], seen = new Set();
		const list = br.ctx.cohort ? br.ctx.cohort.blobs : (br.ctx.group ? br.ctx.group.map(m => m.body) : [br.ctx.body]);
		for(const b of list) if(b && !seen.has(b)){ seen.add(b); out.push(b); }
		return out;
	}
	defineCondition({ id:'combined', name:'Energy has combined', needs:'energy', wholeGroup:true,
		description:'Waits until the energy merges with other energy. With several pieces (Divide, Draw Out) it waits until they have all become one.',
		start(api, br){
			const list = groupBodies(br);
			br.condMemo = { n: list.length, merges: list.reduce((s, b) => s + (b && !b.foreign ? (b.mergeCount || 0) : 0), 0) };
		},
		check(api, br){
			const m = br.condMemo || { n: 1, merges: 0 };
			const alive = groupBodies(br).filter(b => api.bodyValid(b));
			if(!alive.length) return 'fail';
			// pieces handed on one by one by Draw Out: wait for the whole draw, then for them all to be one
			if(br.ctx.cohort){ if(!api.bodyValid(br.ctx.body)) return 'fail'; return !!br.ctx.cohort.done && alive.length <= 1; }
			if(m.n > 1) return alive.length <= 1;
			const merges = alive.reduce((s, b) => s + (b.mergeCount || 0), 0);
			return merges > m.merges;
		} });
	defineCondition({ id:'arrived', name:'Energy reaches its destination', needs:'energy',
		description:'Waits until the energy has arrived where a Redirect sent it (its cursor / target / you point), or has come to rest.',
		check(api, br){
			const b = br.ctx.body; if(!api.bodyValid(b)) return 'fail';
			if(b.foreign) return api.bodySpeed(b) < 0.4;
			const p = b.aim;
			if(p && dist(b.x, b.y, p.x, p.y) <= Math.max(18, bodyRadius(b))) return true;
			return !b.arrive && api.bodySpeed(b) < 0.4;
		} });
	defineCondition({ id:'energyAbove', name:'Energy is at least', needs:'energy',
		description:'Waits until the targeted energy holds at least this much (e.g. while Draw Out or merging fills it).',
		params:[ { key:'amount', label:'Energy', type:'int', min:1, max:2000, step:1, default:40, unit:'E' } ],
		check(api, br, p){ const b = br.ctx.body; if(!api.bodyValid(b)) return 'fail'; return !b.foreign && b.amount >= num(p.amount, 40); } });
	defineCondition({ id:'energyBelow', name:'Energy has fallen to', needs:'energy',
		description:'Waits until the targeted energy has leaked or been spent down to this amount.',
		params:[ { key:'amount', label:'Energy', type:'int', min:1, max:2000, step:1, default:10, unit:'E' } ],
		check(api, br, p){ const b = br.ctx.body; if(!api.bodyValid(b)) return 'fail'; return !b.foreign && b.amount <= num(p.amount, 10); } });
	defineCondition({ id:'powerAbove', name:'Power is at least', needs:'energy',
		description:'Waits until the energy\'s power (energy × density) reaches this value.',
		params:[ { key:'power', label:'Power', type:'int', min:1, max:2000, step:1, default:40 } ],
		check(api, br, p){ const b = br.ctx.body; if(!api.bodyValid(b)) return 'fail'; return Math.abs(api.bodyPower(b)) >= num(p.power, 40); } });
	defineCondition({ id:'targetFar', name:'Target is far away', needs:'target',
		description:'Waits until the current target is farther than the range from the energy (or you).',
		params:[ { key:'range', label:'Range', type:'int', min:10, max:2000, step:10, default:300, unit:'px' } ],
		check(api, br, p){ const tp = api.targetPos(br); if(!tp) return 'fail'; const rp = api.refPoint(br); return dist(tp.x, tp.y, rp.x, rp.y) > num(p.range, 300); } });
	defineCondition({ id:'targetHurt', name:'Target health is below', needs:'target',
		description:'Waits until the current target\'s health drops under this percentage.',
		params:[ { key:'pct', label:'Health', type:'int', min:1, max:100, step:1, default:50, unit:'%' } ],
		check(api, br, p){
			const t = br.ctx.target; const e = t && t.ref;
			if(!e || e.hp == null) return 'fail';
			if(e.dead) return true;
			return e.hp / Math.max(1, e.maxHp || e.hp) * 100 <= num(p.pct, 50);
		} });
	defineCondition({ id:'noEnemyNear', name:'No enemy is nearby',
		description:'Waits until there is no enemy within range of the energy (or you).',
		params:[ { key:'range', label:'Range', type:'int', min:10, max:1200, step:10, default:200, unit:'px' } ],
		check(api, br, p){
			const rp = api.refPoint(br), r = num(p.range, 200), list = api.host.getEnemies() || [];
			for(let i = 0; i < list.length; i++){ const e = list[i]; if(!e || e.dead) continue; const c = center(e); if(dist(c.x, c.y, rp.x, rp.y) <= r) return false; }
			return true;
		} });
	defineCondition({ id:'enemiesNear', name:'Several enemies are nearby',
		description:'Waits until at least this many enemies are within range of the energy (or you).',
		params:[ { key:'count', label:'Enemies', type:'int', min:1, max:20, step:1, default:2 }, { key:'range', label:'Range', type:'int', min:10, max:1200, step:10, default:250, unit:'px' } ],
		check(api, br, p){
			const rp = api.refPoint(br), r = num(p.range, 250), list = api.host.getEnemies() || [];
			let n = 0;
			for(let i = 0; i < list.length; i++){ const e = list[i]; if(!e || e.dead) continue; const c = center(e); if(dist(c.x, c.y, rp.x, rp.y) <= r) n++; }
			return n >= num(p.count, 2);
		} });
	defineCondition({ id:'spellHit', name:'This spell hits an enemy',
		description:'Waits until any energy of this spell strikes an enemy (counted from the moment execution reaches this connector).',
		start(api, br){ br.condMemo = { hits: api.instance.strikes || 0 }; },
		check(api, br){ return (api.instance.strikes || 0) > ((br.condMemo && br.condMemo.hits) || 0); } });
	defineCondition({ id:'casterHurt', name:'Your health is below',
		description:'Waits until your health drops under this percentage.',
		params:[ { key:'pct', label:'Health', type:'int', min:1, max:100, step:1, default:50, unit:'%' } ],
		check(api, br, p){
			const h = api.host.casterHealth ? api.host.casterHealth(api.owner) : null;
			const e = api.owner.entity;
			const frac = h != null ? h : (e && e.hp != null ? e.hp / Math.max(1, e.maxHp || e.hp) : null);
			if(frac == null) return 'fail';
			return frac * 100 <= num(p.pct, 50);
		} });
	defineCondition({ id:'casterGrounded', name:'You are on the ground',
		description:'Waits until you are standing on the ground.',
		check(api){ const e = api.owner.entity; if(!e) return 'fail'; return !!e.onGround; } });
	defineCondition({ id:'casterAirborne', name:'You are in the air',
		description:'Waits until you leave the ground (jump, launch, fall).',
		check(api){ const e = api.owner.entity; if(!e) return 'fail'; return !e.onGround; } });
	defineCondition({ id:'casterMoving', name:'You are moving',
		description:'Waits until you are moving.',
		check(api){ const e = api.owner.entity; if(!e) return 'fail'; return Math.hypot(e.vx || 0, e.vy || 0) > 1; } });
	defineCondition({ id:'casterStill', name:'You stand still',
		description:'Waits until you have stopped moving.',
		check(api){ const e = api.owner.entity; if(!e) return 'fail'; return Math.hypot(e.vx || 0, e.vy || 0) < 0.5 && e.onGround !== false; } });
	defineCondition({ id:'trigger', name:'You press the trigger key (T)',
		description:'Waits until you press T — detonate, release or turn your spell exactly when you want.',
		start(api, br){ br.condMemo = { n: api.host.triggerCount ? api.host.triggerCount() : 0 }; },
		check(api, br){ if(!api.host.triggerCount) return false; return api.host.triggerCount() > ((br.condMemo && br.condMemo.n) || 0); } });
	defineCondition({ id:'cursorNear', name:'Cursor is near the energy', needs:'energy',
		description:'Waits until your cursor is within range of the energy.',
		params:[ { key:'range', label:'Range', type:'int', min:10, max:800, step:10, default:60, unit:'px' } ],
		check(api, br, p){ const b = br.ctx.body; if(!api.bodyValid(b)) return 'fail'; const m = api.host.mouseWorld(), q = api.bodyPos(b); return dist(m.x, m.y, q.x, q.y) <= num(p.range, 60); } });
	defineCondition({ id:'ownContact', name:'Energy touches your other energy', needs:'energy',
		description:'Waits until the energy overlaps other energy you created (another branch or another of your spells).',
		check(api, br){
			const b = br.ctx.body; if(!api.bodyValid(b) || b.foreign) return 'fail';
			const rb = bodyRadius(b);
			for(const o of api.world.bodies){ if(!o.alive || o === b || o.isZone || o.ownerId !== b.ownerId) continue; if(dist(o.x, o.y, b.x, b.y) < rb + bodyRadius(o)) return true; }
			return false;
		} });
	defineCondition({ id:'zoneFull', name:'Zone holds at least', needs:'zone',
		description:'Waits until the zone created earlier in this branch holds this much energy.',
		params:[ { key:'amount', label:'Energy', type:'int', min:1, max:5000, step:5, default:100, unit:'E' } ],
		check(api, br, p){ const z = br.ctx.zone; if(!z || !z.alive) return 'fail'; return z.amount >= num(p.amount, 100); } });
	defineCondition({ id:'spellAge', name:'Spell has lasted', 
		description:'Waits until this spell has existed for this long (counted from the cast, not from this connector).',
		params:[ { key:'time', label:'Time', type:'float', min:0.1, max:119, step:0.1, default:3, unit:'s' } ],
		check(api, br, p){ return api.instance.age >= num(p.time, 3); } });
	defineCondition({ id:'state', name:'Energy is in a state', needs:'energy',
		description:'Waits until the energy is in a physical state: anchored, free, attached, guided or bound (see the Anchor / State rune).',
		params:[ { key:'state', label:'State', type:'select', options:[ {value:'anchored', label:'Anchored'}, {value:'free', label:'Free'}, {value:'attached', label:'Attached / lodged'}, {value:'guided', label:'Guided'}, {value:'bound', label:'Bound'}, {value:'infinity', label:'Infinity'} ], default:'attached' } ],
		check(api, br, p){ const b = br.ctx.body; if(!api.bodyValid(b)) return 'fail'; return hasState(b, p.state || 'attached'); } });
	defineCondition({ id:'memory', name:'Its energy remembers… (spell memory)', needs:'energy',
		description:'Waits until something has happened to this energy a number of times: it passed through a portal, hit an enemy or a surface, was compressed, split, redirected, reinforced or combined. Energy keeps its memory when it is split or merged.',
		params:[
			{ key:'event', label:'What happened', type:'select', options: MEM_EVENTS, default:'collided' },
			{ key:'count', label:'At least (times)', type:'int', min:1, max:20, step:1, default:1 }
		],
		check(api, br, p){
			const list = br.ctx.group ? br.ctx.group.map(m => m.body) : [br.ctx.body];
			let alive = false;
			for(const b of list){ if(!api.bodyValid(b)) continue; alive = true; if(memCount(b, p.event || 'collided') >= Math.max(1, num(p.count, 1))) return true; }
			return alive ? false : 'fail';
		} });
	defineCondition({ id:'restFinished', name:'The rest of the spell is finished',
		description:'Waits until every other part of this spell has finished running its runes (branches still waiting, delayed, drawing or charging count as unfinished). Branches that are also waiting for this do not block each other. Optionally also waits until the spell\'s other energy is gone.',
		params:[ { key:'energy', label:'Finished means', type:'select', options:[ { value:'runes', label:'All other runes have run' }, { value:'all', label:'…and its other energy is gone' } ], default:'runes' } ],
		check(api, br, p){
			const inst = api.instance;
			for(const o of inst.branches){
				if(o === br || o.state === 'done') continue;
				if(o.state === 'cond'){
					const n = inst.def.nodes[o.nodeId];
					if(n && n.link && n.link.cond && n.link.cond.type === 'restFinished') continue;
				}
				return false;
			}
			if(p.energy === 'all'){
				const mine = new Set((br.ctx.group ? br.ctx.group.map(m => m.body) : [br.ctx.body]).filter(Boolean));
				for(const b of api.world.bodies) if(b.alive && b.inst === inst.id && !mine.has(b) && !b.isZone && !b.zoneBlob) return false;
			}
			return true;
		} });
	defineCondition({ id:'techNeutral', name:'Its technique is cancelled out', needs:'energy',
		description:'Waits until every technique state on the energy has been cancelled to neutral (e.g. by opposing energy).',
		check(api, br){ const b = br.ctx.body; if(!api.bodyValid(b) || b.foreign) return 'fail'; if(!b.tech) return false; for(const k in b.tech) if(Math.abs(b.tech[k]) >= CONFIG.tech.minIntensity) return false; return true; } });

	/* =====================================================================
	   SPELL DEFINITIONS
	   ===================================================================== */
	let defSeq = 0;
	function nodeId(){ defSeq += 1; return 'r' + Date.now().toString(36).slice(-4) + defSeq.toString(36) + Math.floor(Math.random() * 1296).toString(36); }
	function defaultLink(){ return { mode:'instant', delay:1, cond:{ type:'enemyNear', params: condDefaults('enemyNear'), timeout: CONFIG.condTimeoutDefault } }; }
	function makeNode(type, parent, dir, gx, gy, order){
		return { id: nodeId(), type: type || null, params: type ? paramDefaults(type) : {}, parent: parent || null, dir: dir || null, gx: gx | 0, gy: gy | 0, order: order | 0, link: defaultLink() };
	}
	function blankSpell(name){
		const r = makeNode(null, null, null, 0, 0, 0);
		const nodes = {}; nodes[r.id] = r;
		return { kind:'magic', v:1, name: name || 'New Spell', rootId: r.id, seq: 1, nodes, phases: [] };
	}
	function starterSpell(){
		const s = blankSpell('Energy Bolt');
		const r = s.nodes[s.rootId];
		r.type = 'generate'; r.params = paramDefaults('generate');
		const c = makeNode('redirect', r.id, 's', 0, 1, 1);
		c.params.toward = 'mouse';
		s.nodes[c.id] = c; s.seq = 2;
		return s;
	}
	function isWeaponSlot(sp){ return !!(sp && sp.kind === 'weapon' && typeof sp.weaponId === 'string'); }
	function makeWeaponSlot(id, name){ return { kind:'weapon', v:1, weaponId:id, name: name || id, phases: [] }; }
	function isMagicSpell(sp){ return !!(sp && sp.kind === 'magic' && sp.nodes && sp.rootId); }

	/* Tree index: children sorted by creation order (deterministic) */
	function indexOf(def){
		const kids = {}; let count = 0;
		for(const id in def.nodes){ kids[id] = []; count++; }
		for(const id in def.nodes){
			const n = def.nodes[id];
			if(n.parent && kids[n.parent]) kids[n.parent].push(id);
		}
		for(const id in kids) kids[id].sort((a, b) => (def.nodes[a].order - def.nodes[b].order) || (a < b ? -1 : 1));
		return { kids, count };
	}

	/* Structural check: true tree, one parent, no cycles, everything reachable */
	function structureErrors(def){
		const errs = [];
		if(!def || !def.nodes || !def.rootId || !def.nodes[def.rootId]){ errs.push({ code:'NO_ROOT', text:'Spell has no root rune' }); return errs; }
		if(def.nodes[def.rootId].parent) errs.push({ node: def.rootId, code:'ROOT_PARENT', text:'Root rune cannot have a parent' });
		const ids = Object.keys(def.nodes);
		for(const id of ids){
			const n = def.nodes[id];
			if(id === def.rootId) continue;
			if(!n.parent || !def.nodes[n.parent]){ errs.push({ node:id, code:'ORPHAN', text:'Rune is not connected to the tree' }); continue; }
			if(n.parent === id){ errs.push({ node:id, code:'SELF_REF', text:'Rune cannot reference itself' }); continue; }
			// walk to root; a cycle means we revisit
			let cur = n, steps = 0;
			while(cur && cur.parent && steps <= ids.length){ cur = def.nodes[cur.parent]; steps++; }
			if(steps > ids.length || !cur || cur.id !== def.rootId) errs.push({ node:id, code:'CYCLE', text:'Rune is part of a loop — loops are not allowed' });
		}
		return errs;
	}

	function normalize(def){
		if(!isMagicSpell(def)) return null;
		def.name = String(def.name || 'Spell').slice(0, 32);
		def.phases = [];
		def.v = 1;
		for(const id in def.nodes){
			const n = def.nodes[id];
			n.id = id;
			if(n.type && !Runes[n.type]) n.type = n.type; // keep unknown; validation reports it
			n.params = n.params || {};
			if(n.type === 'reverseTechnique'){ n.type = 'technique'; n.params.mode = 'reverse'; }       // legacy rune → reverse form
			if(n.type === 'technique' && n.params.mode != null){                                        // the reverse is now negative power
				if(n.params.mode === 'reverse') n.params.power = -Math.abs(num(n.params.power, 5) || 5);
				delete n.params.mode;
			}
			if(n.type === 'generate' && n.params.spawn === 'mouse') n.params.spawn = 'caster';
			if(n.type === 'anchor' && n.params.state === 'infinity'){ n.type = 'technique'; n.params = { technique: 'infinity', power: String(n.params.inf) === '0' ? -5 : 5 }; }
			if(n.type === 'redirect' && n.params.speed != null){                                        // speed is now a share of the energy's top speed
				const s = num(n.params.speed, 0);
				if(n.params.speedPct == null) n.params.speedPct = s <= 0 ? 0 : clamp(Math.round(s / CONFIG.rawMaxSpeed * 20) * 5, 5, 100);
				delete n.params.speed;
			}         // energy is no longer conjured at the cursor
			if(n.type === 'technique' && n.params.technique === 'binding'){                             // the Binding technique is gone: it is now the Bound state
				n.type = 'anchor'; n.params = { state: num(n.params.power, 5) < 0 ? 'free' : 'bound' };
			}
			if(n.type && Runes[n.type]){
				const d = paramDefaults(n.type);
				for(const k in d) if(n.params[k] === undefined) n.params[k] = d[k];
			}
			n.link = Object.assign(defaultLink(), n.link || {});
			n.link.cond = Object.assign(defaultLink().cond, n.link.cond || {});
			n.gx = n.gx | 0; n.gy = n.gy | 0; n.order = n.order | 0;
		}
		return def;
	}

	/* =====================================================================
	   STATIC ANALYSIS / VALIDATION (separate from runtime)
	   ===================================================================== */
	function validate(def, profile){
		profile = profile || deriveProfile({});
		const report = {
			ok: true, errors: [], warnings: [], byNode: {}, byLink: {},
			runeCount: 0, cost: CONFIG.castBaseCost, peakOutput: 0, energyCreated: 0,
			techniques: {}, efficiencyLoss: 0, nodeInfo: {}, upfront: CONFIG.castBaseCost, channel: 0
		};
		const push = (list, item) => {
			list.push(item);
			if(item.link){ (report.byLink[item.link] = report.byLink[item.link] || []).push(item); }
			else if(item.node){ (report.byNode[item.node] = report.byNode[item.node] || []).push(item); }
		};
		const error = (node, code, text) => push(report.errors, { node: node && node.id ? node.id : node, code, text, level:'error' });
		const warn  = (node, code, text) => push(report.warnings, { node: node && node.id ? node.id : node, code, text, level:'warn' });
		const linkError = (nodeId, code, text) => push(report.errors, { link: nodeId, code, text, level:'error' });

		const se = structureErrors(def);
		for(const e of se){ e.level = 'error'; push(report.errors, e); }
		if(se.some(e => e.code === 'NO_ROOT')){ report.ok = false; return report; }

		const idx = indexOf(def);
		report.runeCount = idx.count;
		if(idx.count > profile.runeCapacity) error(def.rootId, 'CAPACITY', 'Rune capacity exceeded — ' + idx.count + ' / ' + profile.runeCapacity + ' (raise Energy Control)');

		const bodies = [];
		let bodySeq = 0;
		const A = {
			profile, report,
			error, warn,
			newBody(amount, source){
				const b = { id: ++bodySeq, amount, scale: 1, source, technique: null, maxPower: amount, mult: 1 };
				bodies.push(b);
				if(source === 'generated' || source === 'zone') report.energyCreated += amount;
				return b;
			},
			touch(b){ b.maxPower = Math.max(b.maxPower, b.amount * densityFactor(b.scale)); },
			extra(o){ A.nodeExtra = Object.assign(A.nodeExtra || {}, o); }
		};

		// DFS with explicit stack (no recursion limits); ctx copied per branch
		const stack = [{ id: def.rootId, ctx: { body:null, target:null, zone:null, groupN:1 }, depth:0 }];
		const seen = {};
		while(stack.length){
			const fr = stack.pop();
			const node = def.nodes[fr.id];
			if(!node || seen[fr.id]) continue;
			seen[fr.id] = true;
			const ctx = fr.ctx;
			const kids = idx.kids[node.id] || [];
			A.ctx = ctx; A.splitShares = null; A.nodeExtra = null;
			const info = { energyIn: ctx.body ? Math.round(ctx.body.amount) : 0 };

			if(!node.type){ error(node, 'EMPTY', 'Empty rune slot — choose a rune'); }
			else if(!Runes[node.type]){ error(node, 'UNKNOWN', 'Unknown rune "' + node.type + '"'); }
			else {
				const R = Runes[node.type];
				const p = node.params || {};
				// parameters
				for(const pd of R.params){
					if(!paramVisible(pd, p)) continue;
					let v = p[pd.key];
					if(v == null && pd.default != null) v = pd.default;
					if(pd.type === 'int' || pd.type === 'float' || pd.type === 'signed'){
						let hi = pd.max;
						if(pd.cap && profile && profile[pd.cap] != null) hi = Math.min(hi, profile[pd.cap]);
						if(!isFinite(Number(v)) || Number(v) < pd.min || Number(v) > hi) error(node, 'PARAM', 'Invalid parameter — ' + pd.label + ' must be ' + pd.min + '…' + hi);
						else if(pd.nonZero && Number(v) === 0) error(node, 'PARAM', 'Invalid parameter — ' + pd.label + ' cannot be 0');
						else if(pd.type === 'signed' && Number(v) < 0 && profile.negativePower === false) error(node, 'NEG_LOCKED', 'Negative power is not unlocked yet');
					} else if(pd.type === 'select'){
						if(!paramOptions(pd, p).some(o => String(o.value) === String(v))) error(node, 'PARAM', 'Invalid parameter — ' + pd.label);
					}
				}
				// inputs
				if(R.input.energy === 'required' && !ctx.body) error(node, 'NO_ENERGY', 'Rune requires energy — Generate or target energy first');
				const needT = R.input.targetFor ? R.input.targetFor(p, ctx) : false;
				if(needT && !ctx.target) error(node, 'NO_TARGET', 'No valid target — add a Target rune earlier in this branch');
				if(needT && ctx.target && R.input.targetKinds && R.input.targetKinds.indexOf(ctx.target) < 0)
					error(node, 'BAD_TARGET', 'No valid target — this rune works on ' + R.input.targetKinds.join(' / '));
				if(needT && (ctx.target === 'surface' || ctx.target === 'environment') && (node.type === 'force' || node.type === 'attach'))
					error(node, 'BAD_TARGET', 'No valid target — cannot use ' + R.name + ' on ' + ctx.target);
				if(ctx.body && ctx.body.released && R.input.energy === 'required') error(node, 'SPENT', 'Rune requires energy — the energy was already released');
				if(ctx.body && ctx.body.immovable && ((typeof R.movesEnergy === 'function' ? R.movesEnergy(p) : R.movesEnergy) || (node.type === 'anchor' && p.where === 'target')))
					error(node, 'IMMOVABLE', 'Spatial energy cannot be moved — it has become a ' + ctx.body.immovable + ' (' + R.name + ' cannot act on it)');
				const perB = isPerBody(R) ? (ctx.groupN || 1) : 1;
				const c1 = R.cost(p, kids.length) * perB;
				report.cost += c1; report.upfront += c1;
				if(R.channelCost){ const cc = R.channelCost(p); report.cost += cc; report.channel += cc; }
				if(R.analyze) R.analyze(p, A, node, kids.length);
				if(ctx.body) A.touch(ctx.body);
			}
			info.energyOut = ctx.body ? Math.round(ctx.body.amount) : 0;
			info.pieces = ctx.groupN || 1;
			info.power = ctx.body ? Math.round(ctx.body.amount * densityFactor(ctx.body.scale)) : 0;
			info.target = ctx.target;
			if(ctx.body && ctx.body.tech) info.tech = techList(ctx.body);
			if(A.nodeExtra) info.extra = A.nodeExtra;
			if(!kids.length && ctx.body && ctx.body.reinforcePending) warn(node, 'REINF_PENDING', 'Reinforcement never reaches a target — add a Target (self, ally, your weapon or an active spell) after it');
			report.nodeInfo[node.id] = info;

			// children (push in reverse so the first child is processed first)
			for(let i = kids.length - 1; i >= 0; i--){
				const cid = kids[i];
				const child = def.nodes[cid];
				const link = child.link || defaultLink();
				if(link.mode === 'delay'){
					const d = num(link.delay, -1);
					if(!(d >= 0.05 && d <= CONFIG.delayMax)) linkError(cid, 'DELAY', 'Delay must be 0.05…' + CONFIG.delayMax + 's');
				} else if(link.mode === 'condition'){
					const cd = link.cond && Conditions[link.cond.type];
					if(!cd) linkError(cid, 'COND', 'Choose a condition');
					else {
						if(cd.needs === 'target' && !ctx.target) linkError(cid, 'COND_TARGET', 'No valid target for this condition');
						if(cd.needs === 'energy' && !ctx.body) linkError(cid, 'COND_ENERGY', 'Condition requires energy');
						if((cd.id === 'targetInZone' || cd.needs === 'zone') && !ctx.zone) linkError(cid, 'COND_ZONE', 'Condition needs a zone earlier in this branch');
						const to = num(link.cond.timeout, -1);
						if(!(to >= 0.5 && to <= CONFIG.condTimeoutMax)) linkError(cid, 'COND_TIMEOUT', 'Give-up time must be 0.5…' + CONFIG.condTimeoutMax + 's');
					}
				} else if(link.mode !== 'instant'){
					linkError(cid, 'LINK', 'Unknown connector mode');
				}
				let childCtx = { body: ctx.body, target: ctx.target, zone: ctx.zone, groupN: ctx.groupN || 1 };
				if(node.type === 'split' && A.splitShares && ctx.body && !ctx.body.foreign && kids.length > 1 && !(R_isUnsafe(ctx))){
					const share = A.splitShares[i] || 0;
					const nb = A.newBody(0, ctx.body.source);
					nb.amount = ctx.body.amount * share * 0.98; nb.scale = ctx.body.scale; nb.technique = ctx.body.technique; nb.tech = ctx.body.tech ? Object.assign({}, ctx.body.tech) : null; nb.reinforcePending = ctx.body.reinforcePending || null; nb.maxPower = nb.amount * densityFactor(nb.scale); nb.mult = ctx.body.mult || 1;
					childCtx.body = nb;
				} else if(kids.length > 1 && ctx.body){
					childCtx.body = ctx.body; // shared reference — same energy, no duplication
				}
				stack.push({ id: cid, ctx: childCtx, depth: fr.depth + 1 });
			}
			if(node.type === 'split' && ctx.body && kids.length > 1 && !ctx.body.foreign) ctx.body.splitParent = true;
		}
		for(const id in def.nodes) if(!seen[id] && !report.byNode[id]) error(id, 'UNREACHABLE', 'Rune is not reachable from the first rune');

		// peak output — sum of each body's maximum |power| (split parents excluded; children carry their share)
		let peak = 0;
		for(const b of bodies){ if(b.source === 'foreign' || b.splitParent || b.zone || b.drawnOut) continue; peak += b.maxPower * (b.mult || 1); }
		report.peakOutput = Math.round(peak);
		report.cost = Math.round(report.cost);
		report.upfront = Math.round(report.upfront);
		report.channel = Math.round(report.channel);
		report.efficiencyLoss = Math.round(report.efficiencyLoss);
		if(report.peakOutput > profile.maxOutput) push(report.warnings, { node:def.rootId, code:'OUTPUT', text:'Estimated output ' + report.peakOutput + ' exceeds Max Output ' + profile.maxOutput + ' — energy will be clamped while casting', level:'warn' });
		if(report.upfront > profile.maxEnergy) error(def.rootId, 'RESERVE', 'Costs ' + report.cost + ' energy — more than your maximum reserve (' + profile.maxEnergy + ')');
		const ae = Techniques.validateAllocations(profile);
		for(const t of ae) error(def.rootId, 'TECH_POINTS', t);
		if(report.cost > (profile.maxEnergy || 1500) * 0.6) push(report.warnings, { node:def.rootId, code:'COST_HIGH', text:'This spell may exceed practical energy requirements (' + Math.round(report.cost) + ' of ' + (profile.maxEnergy || 1500) + ' energy)', level:'warn' });
		report.ok = report.errors.length === 0;
		return report;
	}
	function R_isUnsafe(){ return false; }
	/* runes that act on the energy itself run once per piece of divided energy */
	function isPerBody(R){ if(R.perBody != null) return !!R.perBody; return R.input.energy === 'required' || R.id === 'target'; }

	/* =====================================================================
	   ENERGY BODY helpers
	   ===================================================================== */
	function bodyRadius(b){
		if(b.isZone) return b.zoneRadius;
		if(b.rupture) return 8 + Math.sqrt(Math.max(0, b.amount)) * 2.2;      // torn space: big, shrinking as it burns out
		if(b.formRadius) return b.formRadius;
		if(b.small > 0){
			const small = (2.5 + Math.sqrt(Math.max(0, b.amount)) * 1.5) * (b.grow == null ? 1 : 0.3 + 0.7 * b.grow);
			const big = (9 + Math.sqrt(Math.max(0, b.amount)) * 2.5) * Math.pow(b.scale, 0.5) * (1 + 0.55 * curForm(b));
			let r = big + (small - big) * b.small;
			if(b.zoneBlob && b.zoneOf && b.zoneOf.zoneRadius > 180) r *= Math.sqrt(b.zoneOf.zoneRadius / 180);
			return r;
		}
		// shaped energy spreads out into its form, so it stays readable even when dense
		// (over-compressed energy pulls in much tighter: at 50 it is under a third of its size)
		return (9 + Math.sqrt(Math.max(0, b.amount)) * 2.5) * Math.pow(b.scale, 0.5) * (1 + 0.55 * curForm(b)) * overShrink(b);
	}
	function overShrink(b){ const o = overK(b); return o > 0 ? 1 / (1 + 2.5 * o * o) : 1; }
	function bodyPower(b){
		if(!b) return 0;
		if(b.foreign) return num(b.ref && (b.ref.dmg || b.ref.damage || b.ref.power), 10);
		return b.amount * densityFactor(b.scale) * techMult(b) * (b.polarity || 1);
	}

	/* contact test that follows the energy's form: a capsule along its axis */
	function shapeHit(b, r, hr){
		const sh = SHAPES[b.shape] || SHAPES.raw;
		const f = (function(){ const m = b.morph == null ? 1 : b.morph; return (b.formPrev || 0) + ((b.form || 0) - (b.formPrev || 0)) * m; })();
		const front = sh.front ? 1 + (sh.front - 1) * f : 1, back = sh.back ? 1 + (sh.back - 1) * f : 1;
		const thick = sh.thick ? 1 + (Math.min(1, sh.thick) - 1) * f : 1;
		const rad = r * Math.max(0.35, thick);
		const ca = Math.cos(b.angle), sa = Math.sin(b.angle);
		const steps = (front > 1.15 || back > 1.15) ? 6 : 0;
		for(let i = 0; i <= steps; i++){
			const d = steps ? (-back + (front + back) * i / steps) * r : 0;
			const px = b.x + ca * d, py = b.y + sa * d;
			const cx = clamp(px, hr.x, hr.x + hr.w), cy = clamp(py, hr.y, hr.y + hr.h);
			const dx = cx - px, dy = cy - py;
			if(dx*dx + dy*dy <= rad * rad) return { x: cx, y: cy };
		}
		return null;
	}

	/* =====================================================================
	   WORLD (one per simulation: the game has one, the editor preview has one)
	   ===================================================================== */
	function createWorld(opts){
		opts = opts || {};
		const W = {
			instances: [], bodies: [], sparks: [], rings: [], ambient: new Map(),
			frame: 0, time: 0, debug: !!opts.debug, nextId: 1, host: null,
			foreignCache: new WeakMap(), events: [],
			reinf: [], status: new Map(), fields: [], fmods: new Map(), lights: []
		};

		/* ---------- casting ---------- */
		W.cast = function(defIn, castOpts){
			castOpts = castOpts || {};
			if(castOpts.host) W.host = withDefaults(castOpts.host);
			if(!W.host) W.host = withDefaults({});
			const profile = castOpts.profile || deriveProfile({});
			const report = validate(defIn, profile);
			if(!report.ok) return { ok:false, error: report.errors[0] ? report.errors[0].text : 'Invalid spell', report };
			const owner = castOpts.owner || { id:'player', entity:null };
			const live = W.instances.filter(i => i.owner.id === owner.id).length;
			if(live >= CONFIG.maxInstancesPerOwner) return { ok:false, error:'Too many active spells' };
			const def = Object.freeze(clone(defIn));        // instance never touches the saved definition
			const idx = indexOf(def);
			const inst = {
				id: W.nextId++, def, kids: idx.kids, owner, profile,
				budget: report.upfront - CONFIG.castBaseCost, paid: report.upfront, drained: 0,
				age: 0, lifetime: CONFIG.lifetime, branches: [], bodyCount: 0, nextBranch: 1,
				outputUsed: 0, maxOutput: profile.maxOutput, done: false, struck: new Set(),
				lastCaster: null, exec: {}, log: [], seed: (W.nextId * 2654435761) >>> 0, steps: 0,
				spawnAt: castOpts.spawnAt ? { x: castOpts.spawnAt.x, y: castOpts.spawnAt.y } : null,     // e.g. an engraved weapon special: energy appears where it strikes
				passive: !!castOpts.passive      // a passive spell: never times out; its reinforcement holds steady (the host drains mana instead)
			};
			if(inst.passive) inst.lifetime = Infinity;
			const cp = owner.entity ? center(owner.entity) : (castOpts.origin || { x:0, y:0 });
			inst.lastCaster = { x: cp.x, y: cp.y };
			W.instances.push(inst);
			const br = newBranch(inst, def.rootId, { body:null, target:null, zone:null }, null);
			br.state = 'run';
			pumpInstance(inst);
			return { ok:true, instance: inst, report };
		};

		function newBranch(inst, nodeId, ctx, parent){
			if(inst.branches.length >= CONFIG.maxBranchesPerInstance){ logI(inst, 'Branch limit reached'); return null; }
			const br = { id: inst.nextBranch++, nodeId, ctx, state:'pending', wait:0, condAge:0, condTick:0, parent: parent ? parent.id : null, note:'', splitBodies:null, condMemo:null };
			inst.branches.push(br);
			return br;
		}
		function logI(inst, text){ inst.log.push({ t: inst.age, text }); if(inst.log.length > 40) inst.log.shift(); }

		/* ---------- API given to rune handlers ---------- */
		function makeApi(inst){
			let failReason = null, noteText = null;
			const api = {
				host: W.host, owner: inst.owner, profile: inst.profile, world: W, instance: inst,
				fail(reason){ failReason = reason || 'failed'; return false; },
				note(t){ noteText = t; },
				_take(){ const f = failReason, n = noteText; failReason = null; noteText = null; return { f, n }; },
				casterPos(){
					const e = inst.owner.entity;
					const alive = e && (!inst.owner.alive || inst.owner.alive());
					if(alive){ const c = center(e); inst.lastCaster = { x:c.x, y:c.y }; }
					return inst.lastCaster;
				},
				bodyValid(b){ return !!(b && (b.foreign ? (b.ref && !b.ref._magicGone && W.host.foreignAlive(b.ref)) : b.alive)); },
				bodyPos(b){ return b.foreign ? { x: b.ref.x, y: b.ref.y } : { x: b.x, y: b.y }; },
				bodyVel(b){ return b.foreign ? { x: b.ref.vx || 0, y: b.ref.vy || 0 } : { x: b.vx, y: b.vy }; },
				bodySpeed(b){ const v = api.bodyVel(b); return Math.sqrt(v.x*v.x + v.y*v.y); },
				bodyPower(b){ return bodyPower(b); },
				setVelocity(b, vx, vy){
					if(b.immovable) return;
					if(b.foreign){ b.ref.vx = vx; b.ref.vy = vy; b.ref._magicRedirected = true; return; }
					b.vx = vx; b.vy = vy;
					if(vx || vy){ b.anchored = false; b.attach = null; }
				},
				moveBody(b, x, y){ if(b.immovable) return; if(b.foreign){ b.ref.x = x; b.ref.y = y; } else { b.x = x; b.y = y; } },
				targetPos(br){
					const t = br.ctx.target; if(!t) return null;
					if(t.kind === 'self' || t.kind === 'legs' || t.kind === 'arms'){ return api.casterPos(); }
					if(t.kind === 'environment'){
						if(t.point) return t.point;
						const b = t.ref; if(!b) return t.last || null;
						if(!api.bodyValid(b)) return t.last || null;
						const p = api.bodyPos(b); t.last = p; return p;
					}
					if(t.kind === 'spell' || t.kind === 'energy'){ const b = t.ref; if(!b) return null; if(!api.bodyValid(b)) return t.last || null; const p = api.bodyPos(b); t.last = p; return p; }
					if(t.kind === 'surface'){ return t.point || null; }
					if(t.kind === 'weapon'){ const seg = W.host.weaponSegment ? W.host.weaponSegment(inst.owner, t.ref) : null; return seg ? { x: (seg.x0 + seg.x1) / 2, y: (seg.y0 + seg.y1) / 2 } : api.casterPos(); }
					if(t.ref){ const c = center(t.ref); if(c && isFinite(c.x)) { t.last = c; return c; } return t.last || null; }
					return null;
				},
				refPoint(br){
					const b = br.ctx.body;
					if(b && api.bodyValid(b)) return api.bodyPos(b);
					return api.casterPos();
				},
				spawnPoint(br, mode){
					if(mode === 'energy'){ const b = br.ctx.body; if(b && api.bodyValid(b)) return api.bodyPos(b); return api.casterPos(); }
					if(mode === 'target'){ return api.targetPos(br); }
					if(mode === 'mouse'){ return W.host.mouseWorld(); }
					if(inst.spawnAt && inst.age < 0.05) return { x: inst.spawnAt.x, y: inst.spawnAt.y };
					const c = api.casterPos();
					return { x: c.x, y: c.y };
				},
				drawBudget(want){ const got = Math.max(0, Math.min(want, inst.budget)); inst.budget -= got; return got; },
				outputHeadroom(){ recomputeOutput(inst); return Math.max(0, inst.maxOutput - inst.outputUsed); },
				createBody(x, y, amount, source, from){ return createBody(inst, x, y, amount, source, from); },
				consumeBody(b, why){ killBody(b, why); },
				setShape(b, shape, form){
					if(!SHAPES[shape]) return;
					form = form == null ? 1 : form;
					if(b.shape === shape && Math.abs((b.form || 0) - form) < 0.001) return;
					const m = easeInOut(b.morph == null ? 1 : b.morph);
					b.formPrev = (b.formPrev || 0) + ((b.form || 0) - (b.formPrev || 0)) * m;
					b.shapePrev = m < 0.5 ? b.shapePrev : b.shape;
					b.shape = shape; b.form = form; b.morph = 0;
				},
				flashBody(b){ b.flash = 1; },
				pickEntity(br, kind, p){ return pickEntity(inst, api, br, kind, p); },
				pickSpellBody(br, p){ return pickSpellBody(inst, api, br, p); },
				pickZone(br, p){
					const sel = p.select || 'nearEnergy', range = num(p.range, 600);
					const ref = sel === 'nearMouse' ? W.host.mouseWorld() : (sel === 'nearCaster' ? api.casterPos() : api.refPoint(br));
					let best = null, bs = Infinity;
					for(const z of W.bodies){
						if(!z.alive || !z.isZone) continue;
						if(sel === 'thisSpell'){ if(z.inst !== inst.id) continue; }
						else if(dist(z.x, z.y, ref.x, ref.y) - z.zoneRadius > range) continue;      // in range: you only need to reach its edge
						const score = sel === 'largest' ? -z.zoneRadius : (sel === 'thisSpell' ? -z.id : dist(z.x, z.y, ref.x, ref.y));
						if(score < bs){ bs = score; best = z; }
					}
					return best;
				},
				takeFromZone(z, want){
					// pull stored energy out of a zone's blobs (Target → Zone → Draw Out)
					let got = 0;
					for(const o of W.bodies){
						if(got >= want) break;
						if(!o.alive || !o.zoneBlob || o.zoneOf !== z) continue;
						const t = Math.min(o.amount, want - got); o.amount -= t; got += t;
						if(o.amount < CONFIG.minEnergy) killBody(o, 'drawn');
					}
					return got;
				},
				harvestAmbient(x, y, r, want){ return harvestAmbient(x, y, r, want); },
				wasStruck(ent){ return !!(ent && inst.struck && inst.struck.has(ent)); },
				siphon(ent, amount){ return W.host.siphonEnergy(ent, amount); },
				takeFromBody(body, want){ return takeFromBody(body, want); },
				receiveDrawn(br, amt, source){ return receiveDrawn(api, br, amt, source); },
				pickRawBodies(br, p){ return pickRawBodies(inst, api, br, p); },
				collapse(b){ collapseBody(b); },
				explode(b){ explodeBody(b); },
				/* 0…0.95: how much of a recoil you shrug off (Kinetic in your legs, energy anchoring you) */
				recoilResist(){
					let r = 0;
					for(const st of W.reinf){
						if(st.ownerId !== inst.owner.id || st.kind !== 'legs') continue;
						const k = (st.tech && st.tech.kinetic) || 0;
						if(k >= CONFIG.tech.minIntensity) r += 0.55 * Math.min(1, k) * Math.min(1, 0.4 + st.energy / 60);
					}
					for(const o of W.bodies) if(o.alive && o.selfAnchor && o.ownerId === inst.owner.id) r += 0.55 + Math.min(0.35, o.amount / 150);
					return clamp(r, 0, 0.95);
				},
				makeInfinity(b){ makeInfinity(b, inst); },
				endInfinity(b, why){ endInfinity(b, why); },
				infDraw(s, want, dt){ return infDraw(s, want, dt, inst); },
				infBurst(s, amount){ infBurst(s, amount, inst); },
				/* the drawn energy forms at the edge of the source, as the source's own kind of energy */
				infVessel(s, v){
					const c = casterPosOf(inst) || { x: s.x + 1, y: s.y };
					const dx = c.x - s.x, dy = c.y - s.y, d = Math.hypot(dx, dy) || 1, r = bodyRadius(s) + 10;
					v.x = s.x + dx / d * r; v.y = s.y + dy / d * r;
					v.tech = s.tech ? Object.assign({}, s.tech) : null;
					v.infDerived = true; v.infFrom = s.id;
					remember(v, 'infinityExtracted'); remember(s, 'infinityExtracted');
				},
				infStream(s, v, got){
					s.infSource.pulse = 1;
					const n = Math.min(5, 1 + Math.floor(got / 4));
					for(let i = 0; i < n; i++){
						const a = Math.random() * Math.PI * 2, r = bodyRadius(s) * 0.8;
						const sx = s.x + Math.cos(a) * r, sy = s.y + Math.sin(a) * r, life = 10 + Math.random() * 6;
						const k = 1 / ((1 - Math.pow(0.94, life)) / 0.06);
						spark(sx, sy, (v.x - sx) * k, (v.y - sy) * k, s, life);
					}
				},
				nearestOwnEnergies(b, range, n, exclude){
					const out = [];
					for(const o of W.bodies){
						if(!o.alive || o === b || o.isZone || o.zoneBlob || o.foreign || o.drawing || o.infSource || o.ownerId !== inst.owner.id || (exclude && exclude.has(o))) continue;
						const d = dist(o.x, o.y, b.x, b.y); if(d < (range || 600)) out.push({ o, d });
					}
					return out.sort((p, q) => p.d - q.d).slice(0, n).map(p => p.o);
				},
				time(){ return W.time; },
				/* the nearest other energy of yours (for a Bound tether between two energies) */
				nearestOwnEnergy(b, range){
					let best = null, bd = range || 600;
					for(const o of W.bodies){
						if(!o.alive || o === b || o.isZone || o.zoneBlob || o.foreign || o.drawing || o.infSource || o.ownerId !== inst.owner.id) continue;
						const d = dist(o.x, o.y, b.x, b.y); if(d < bd){ bd = d; best = o; }
					}
					return best;
				},
				releaseBlob(b){ if(b && b.zoneBlob){ claimBlob(b); b.anchored = false; } },
				closeOtherZones(keep){
					for(const z of W.bodies){
						if(!z.alive || !z.isZone || z === keep || z.ownerId !== inst.owner.id) continue;
						killBody(z, 'leak');
						const zi = instById(z.inst); if(zi) logI(zi, 'Zone closed — a new zone was opened');
					}
				},
				/* energy taken out of a zone with a technique is that technique's energy */
				zoneKind(piece, z){ zoneKind(piece, z); },
				hasChildren(br){ const node = inst.def.nodes[br.nodeId]; return !!(node && (inst.kids[node.id] || []).length); },
				/* where a drawn piece forms: at the edge of what it is drawn from, on the side facing you */
				flowPoint(br, S){
					const from = (S && (S.infinity || S.from)) || null;
					if(from && from.alive){
						const c = casterPosOf(inst) || { x: from.x + 1, y: from.y };
						const dx = c.x - from.x, dy = c.y - from.y, d = Math.hypot(dx, dy) || 1, r = bodyRadius(from) + 8;
						return { x: from.x + dx / d * r, y: from.y + dy / d * r };
					}
					return api.targetPos(br) || api.refPoint(br);
				},
				/* drawn energy keeps the kind of the energy of yours it came from */
				inheritKind(piece, src){
					if(!piece || !src) return;
					if(src.tech) piece.tech = Object.assign({}, src.tech);
					if(src.scale) piece.scale = src.scale;
					if(src.infDerived){ piece.infDerived = true; piece.infFrom = src.infFrom; }
				},
				/* …and stays apart from it: it never merges back into the energy it was drawn from */
				separateFrom(piece, src){ if(piece && src){ piece.drawnFrom = src.id; remember(piece, 'split'); } },
				/* start this rune's children on one body now (Draw Out hands each piece on as it is drawn) */
				forkChildren(br, body, cohort){
					const node = inst.def.nodes[br.nodeId];
					const kids = node ? (inst.kids[node.id] || []) : [];
					for(const cid of kids){
						const nb = newBranch(inst, cid, { body, target: { kind:'energy', ref: body }, zone: br.ctx.zone, group: null, cohort: cohort || null }, br);
						if(!nb) continue;
						enterLink(inst, nb, inst.def.nodes[cid].link, []);
					}
					if(kids.length) inst._needPump = true;
				},
				T(){ return T; },
				reinforce(b, t, portion){ return reinforceApply(inst, b, t, portion); },
				beginDraw(br, source, noZone){ return beginDraw(inst, api, br, source, noZone); },
				addDrawn(b, amt){ return addDrawn(b, amt); },
				drainReserve(amount){
					const e = inst.owner.entity;
					if(inst.owner.alive && !inst.owner.alive()) return 0;      // a dead caster cannot feed a zone
					const got = Math.max(0, Math.min(amount, num(W.host.drainEnergy(inst.owner, amount), 0)));
					inst.drained += got; inst.paid += got;
					return got;
				},
				convergeFx(b, r){ for(let i = 0; i < 18; i++){ const a = (i / 18) * Math.PI * 2; const rr = r * (0.5 + 0.5 * ((i * 7919) % 13) / 13); spark(b.x + Math.cos(a) * rr, b.y + Math.sin(a) * rr, -Math.cos(a) * rr / 30, -Math.sin(a) * rr / 30, b, 30); } },
				spawnZoneBlob(z, amt){ return spawnZoneBlob(z, amt); },
				gatherZoneBlobs(z, to, max){ return gatherZoneBlobs(z, to, max); },
				pulseFx(x, y, b, k){ W.rings.push({ x, y, r: 6, max: 40 + 40 * (k || 1), age: 0, life: 18, color: bodyColors(b).mid }); },
				burst(x, y, r, dmg, b){ burst(inst, x, y, r, dmg, b); },
				touchingOtherSpell(b){
					const rb = bodyRadius(b);
					for(const o of W.bodies){ if(!o.alive || o.inst === inst.id || o.isZone) continue; if(dist(o.x, o.y, b.x, b.y) < rb + bodyRadius(o)) return true; }
					const fl = W.host.getForeignProjectiles();
					for(let i = 0; i < fl.length; i++){ const f = fl[i]; if(f && dist(f.x, f.y, b.x, b.y) < rb + 10) return true; }
					return false;
				}
			};
			return api;
		}

		function createBody(inst, x, y, amount, source, from){
			if(inst.bodyCount >= (inst.maxBodies || CONFIG.maxBodiesPerInstance) || W.bodies.length >= CONFIG.maxBodiesGlobal) return null;
			const rng = mulberry32((inst.seed + W.bodies.length * 977 + W.frame * 31) >>> 0);
			const b = {
				id: W.nextId++, inst: inst.id, alive: true, dying: 0, x, y, vx: 0, vy: 0,
				amount: Math.max(0, amount), scale: from ? from.scale : 1, polarity: 1,
				shape: from ? from.shape : 'raw', shapePrev: from ? from.shape : 'raw', morph: 1,
				form: from ? (from.form || 0) : 0, formPrev: from ? (from.form || 0) : 0,
				technique: from && from.technique ? Object.assign({}, from.technique) : null,
				tech: from && from.tech ? Object.assign({}, from.tech) : null, focus: from ? (from.focus || null) : null,
				spin: from && from.spin ? Object.assign({}, from.spin) : null, angleOffset: from ? (from.angleOffset || 0) : 0,
				reinforcePending: from && from.reinforcePending ? Object.assign({}, from.reinforcePending) : null,
				source: source || 'generated', ownerId: inst.owner && inst.owner.id, spawned: !!(from && from.spawned),
				natural: source === 'environment' || !!(from && from.natural),
				guided: !!(from && from.guided),
				aim: from && from.aim ? { x: from.aim.x, y: from.aim.y } : null,
				arrive: from && from.arrive ? { x: from.arrive.x, y: from.arrive.y, speed: from.arrive.speed } : null,
				anchored: false, attach: null, locks: from && from.locks ? Object.assign({}, from.locks) : {},
				surfaceMode: from ? from.surfaceMode : null, touchedSurface: false, isZone: false, zoneRadius: 0,
				age: 0, seed: rng() * 1000, angle: 0, flash: 0, birth: 0, pts: null, hitIds: null, attachedTo: null,
				mem: from && from.mem ? Object.assign({}, from.mem) : null, over: from ? (from.over || 0) : 0,
				speedBonus: from ? (from.speedBonus || 0) : 0, burnOnHit: from ? (from.burnOnHit || 0) : 0, chillOnHit: from ? (from.chillOnHit || 0) : 0,
				heavy: from ? (from.heavy || 0) : 0, lift: from ? (from.lift || 0) : 0,
				follow: from ? (from.follow || null) : null, bond: from && from.bond ? { t: from.bond.t, len: from.bond.len, str: from.bond.str, mode: from.bond.mode } : null,
				comp: from ? (from.comp || 0) : 0, nearGen: !!(from && from.nearGen),
				infDerived: !!(from && from.infDerived), infFrom: from ? (from.infFrom || 0) : 0,
				bondsX: from && from.bondsX ? from.bondsX.map(B => ({ t: B.t, len: B.len, str: B.str, mode: B.mode })) : null
			};
			W.bodies.push(b);
			inst.bodyCount++;
			inst.outputUsed += Math.abs(bodyPower(b));      // the frame's recount keeps it exact; counting every body for each new one was O(n²)
			return b;
		}
		function killBody(b, why){
			if(!b || b.foreign || !b.alive) return;
			b.alive = false; b.dying = 0.0001; b.deathWhy = why || '';
			const inst = W.instances.find(i => i.id === b.inst);
			if(inst && !b.zoneBlob){ inst.bodyCount = Math.max(0, inst.bodyCount - 1); }
			if(why !== 'split' && why !== 'merge' && why !== 'fade'){
				const col = bodyColors(b);
				W.rings.push({ x: b.x, y: b.y, r: bodyRadius(b) * 0.6, max: bodyRadius(b) * 2.2 + 12, age: 0, life: 16, color: col.mid });
				const n = why === 'leak' ? 4 : 10;
				for(let i = 0; i < n; i++){ const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 3; spark(b.x, b.y, Math.cos(a) * s, Math.sin(a) * s, b, 20 + Math.random() * 14); }
			}
		}
		function recomputeOutput(inst){
			let s = 0;
			for(const b of W.bodies) if(b.alive && b.inst === inst.id && !b.isZone && !b.zoneBlob && !b.drawnOut) s += Math.abs(bodyPower(b));      // gathered and drawn energy is not the spell's output
			for(let i = 0; i < W.reinf.length; i++){ const st = W.reinf[i]; if(st.inst === inst.id) s += st.energy * st.density * (1 + 0.5 * (st.inf || 0)); }     // reinforcement still holds its energy (an Infinity layer weighs heavily)
			inst.outputUsed = s;
		}

		function entityCandidates(kind){
			if(kind === 'enemy') return W.host.getEnemies() || [];
			if(kind === 'ally') return W.host.getAllies() || [];
			return [];
		}
		function pickEntity(inst, api, br, kind, p){
			const list = entityCandidates(kind);
			const range = num(p.range, 600);
			const ref = p.select === 'nearCaster' ? api.casterPos() : (p.select === 'nearMouse' ? W.host.mouseWorld() : api.refPoint(br));
			const zone = br.ctx.zone;
			let best = null, bestScore = Infinity;
			for(let i = 0; i < list.length; i++){
				const e = list[i];
				if(!e || e.dead) continue;
				if(inst.owner.entity && e === inst.owner.entity) continue;
				const c = center(e);
				const d = dist(c.x, c.y, ref.x, ref.y);
				if(p.select === 'inZone'){ if(!zone || !zone.alive || dist(c.x, c.y, zone.x, zone.y) > zone.zoneRadius) continue; }
				else if(d > range) continue;
				let score = d;
				if(p.select === 'strongest') score = -(e.hp || 0);
				else if(p.select === 'weakest') score = (e.hp || 0);
				if(score < bestScore){ bestScore = score; best = e; }
			}
			return best;
		}
		function foreignWrap(ref){
			let w = W.foreignCache.get(ref);
			if(!w){ w = { foreign: true, ref, id: 'f' + (W.nextId++), alive: true }; W.foreignCache.set(ref, w); }
			return w;
		}
		function pickSpellBody(inst, api, br, p){
			const ref = p.select === 'nearCaster' ? api.casterPos() : (p.select === 'nearMouse' ? W.host.mouseWorld() : api.refPoint(br));
			const range = num(p.range, 600);
			const zone = br.ctx.zone;
			let best = null, bestScore = Infinity;
			const consider = (cand, x, y, power) => {
				const d = dist(x, y, ref.x, ref.y);
				if(p.select === 'inZone'){ if(!zone || !zone.alive || dist(x, y, zone.x, zone.y) > zone.zoneRadius) return; }
				else if(d > range) return;
				let score = d;
				if(p.select === 'strongest') score = -power; else if(p.select === 'weakest') score = power;
				if(score < bestScore){ bestScore = score; best = cand; }
			};
			for(const b of W.bodies){
				if(!b.alive || b.inst === inst.id || b.isZone || !techMatch(b, p)) continue;   // a spell never targets itself through ordinary acquisition
				consider(b, b.x, b.y, Math.abs(bodyPower(b)));
			}
			const fl = (p.techFilter && p.techFilter !== 'any') ? [] : (W.host.getForeignProjectiles() || []);      // other casters' projectiles carry no technique state
			for(let i = 0; i < fl.length; i++){
				const f = fl[i]; if(!f) continue;
				consider(foreignWrap(f), f.x, f.y, num(f.dmg || f.damage, 10));
			}
			return best;
		}

		function pickRawBodies(inst, api, br, p){
			const sel = p.select || 'nearEnergy';
			const byState = p.kind === 'anchorState' ? (p.astate || 'anchored') : null;
			const own = sel === 'thisSpell';
			const zone = br.ctx.zone;
			const caster = api.casterPos();
			const ref = (sel === 'nearCaster' || sel === 'around' || sel === 'all') ? caster : (sel === 'nearMouse' ? W.host.mouseWorld() : api.refPoint(br));
			const range = sel === 'around' ? num(p.radius, 220) : num(p.range, 600);
			const mine = {};
			if(sel !== 'all' && !own){
				if(br.ctx.body) mine[br.ctx.body.id] = true;
				if(br.ctx.group) for(const m of br.ctx.group) if(m.body) mine[m.body.id] = true;
			}
			const found = [];
			for(const b of W.bodies){
				if(!b.alive || b.isZone || b.technique || b.foreign || mine[b.id] || b.drawing) continue;
				if(b.ownerId !== inst.owner.id) continue;
				if(own && b.inst !== inst.id) continue;          // "inside this spell": only energy this spell made
				if(!techMatch(b, p)) continue;                    // "With technique": only energy carrying it now
				if(byState){ if(b.zoneBlob || !hasState(b, byState)) continue; }      // Target → energy in an anchor state
				else if(!own && !b.spawned && !b.drawnOut && !b.zoneBlob) continue;     // energy you spawned, or drew into a zone
				if(own){ /* no range */ }
				else if(sel === 'inZone'){ if(!zone || !zone.alive || dist(b.x, b.y, zone.x, zone.y) > zone.zoneRadius) continue; }
				else if(sel !== 'all' && dist(b.x, b.y, ref.x, ref.y) > range) continue;
				found.push(b);
			}
			if(sel === 'all' || sel === 'around' || own) return found;
			let best = null, bestScore = Infinity;
			for(const b of found){
				const d = dist(b.x, b.y, ref.x, ref.y);
				let score = d;
				if(sel === 'strongest') score = -Math.abs(bodyPower(b));
				else if(sel === 'weakest') score = Math.abs(bodyPower(b));
				if(score < bestScore){ bestScore = score; best = b; }
			}
			return best ? [best] : [];
		}

		/* ---------- environment (ambient energy field) ---------- */
		function cellKey(cx, cy){ return cx + ',' + cy; }
		function harvestAmbient(x, y, r, want){
			const cs = CONFIG.ambientCell;
			const c0x = Math.floor((x - r) / cs), c1x = Math.floor((x + r) / cs);
			const c0y = Math.floor((y - r) / cs), c1y = Math.floor((y + r) / cs);
			let got = 0;
			for(let cy = c0y; cy <= c1y && got < want; cy++){
				for(let cx = c0x; cx <= c1x && got < want; cx++){
					const k = cellKey(cx, cy);
					let cell = W.ambient.get(k);
					if(!cell){ cell = { e: CONFIG.ambientMax * (W.host.ambientDensity ? W.host.ambientDensity((cx + 0.5) * cs, (cy + 0.5) * cs) : 1) }; W.ambient.set(k, cell); }
					const take = Math.min(cell.e, want - got);
					cell.e -= take; got += take;
				}
			}
			return got;
		}
		function regenAmbient(dt){
			if(!W.ambient.size) return;
			W.ambient.forEach((cell, k) => {
				cell.e += CONFIG.ambientRegen * dt;
				if(cell.e >= CONFIG.ambientMax) W.ambient.delete(k);
			});
		}

		/* ---------- area burst ---------- */
		function burst(inst, x, y, r, dmg, b){
			const col = bodyColors(b);
			W.rings.push({ x, y, r: 4, max: r, age: 0, life: 22, color: col.mid, fill: true });
			W.rings.push({ x, y, r: 4, max: r * 0.7, age: 0, life: 14, color: '#ffffff' });
			for(let i = 0; i < 26; i++){ const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 6; spark(x, y, Math.cos(a) * s, Math.sin(a) * s, b, 24 + Math.random() * 20); }
			if(dmg <= 0) return;
			const list = W.host.getEnemies() || [];
			for(let i = 0; i < list.length; i++){
				const e = list[i]; if(!e || e.dead) continue;
				const hr = W.host.hitRect(e);
				const cx = clamp(x, hr.x, hr.x + hr.w), cy = clamp(y, hr.y, hr.y + hr.h);
				const d = dist(cx, cy, x, y);
				if(d > r) continue;
				markStruck(inst.id, e);
				const fall = 1 - 0.5 * (d / r);
				W.host.damageEnemy(e, dmg * fall, { x: cx, y: cy, color: col.mid, area: true, instance: inst.id });
			}
			if(W.host.shake) W.host.shake(Math.min(10, 2 + dmg * 0.05));
		}

		/* ---------- executing the tree ---------- */
		function runOnce(inst, api, R, br, node, kids){
			br.splitBodies = null; br.divided = null; br.dividedOwn = false;
			let ok = true;
			try { const r = R.exec(api, br, node.params || {}, node, kids.length); if(r === false) ok = false; }
			catch(e){ ok = false; api.fail('error: ' + e.message); if(W.debug) console.warn('[magic]', e); }
			const t = api._take();
			if(t.f) ok = false;
			// a zone blob that a rune (other than Target) acts on is now under the caster's control
			if(R.id !== 'target' && R.id !== 'zone' && R.id !== 'drawOut'){
				if(br.ctx.body && br.ctx.body.zoneBlob) claimBlob(br.ctx.body, inst);
				if(br.ctx.group) for(const m of br.ctx.group) if(m.body && m.body.zoneBlob) claimBlob(m.body, inst);
			}
			return { ok, t };
		}
		function execNode(inst, br){
			const node = inst.def.nodes[br.nodeId];
			if(!node){ br.state = 'done'; br.note = 'missing rune'; return false; }
			const R = Runes[node.type];
			if(!R){ br.state = 'done'; br.note = 'unknown rune'; return false; }
			const api = inst._api || (inst._api = makeApi(inst));
			api.host = W.host;
			const kids = inst.kids[node.id] || [];
			br.splitGroups = null;
			let ok = true, note = '';
			const group = br.ctx.group;
			if(group && group.length > 1 && isPerBody(R)){
				// divided energy: the rune acts on every piece
				const out = [], splitAcc = [];
				let any = false, lastFail = '';
				for(const m of group){
					if(R.input.energy === 'required' && !api.bodyValid(m.body)) continue;
					br.ctx.body = m.body; br.ctx.target = m.target;
					const res = runOnce(inst, api, R, br, node, kids);
					if(!res.ok){ lastFail = res.t.f || 'failed'; continue; }
					if(res.t.n) note = res.t.n;
					any = true;
					if(br.divided) for(const d of br.divided) out.push({ body: d, target: br.dividedOwn ? { kind:'energy', ref: d } : br.ctx.target });
					else out.push({ body: br.ctx.body, target: br.ctx.target });
					if(br.splitBodies) splitAcc.push(br.splitBodies);
				}
				br.divided = null; br.splitBodies = null;
				if(!any){ ok = false; note = lastFail || 'no piece could run'; }
				else {
					setGroup(br, out);
					if(splitAcc.length){
						br.splitGroups = [];
						for(let i = 0; i < kids.length; i++) br.splitGroups.push(splitAcc.map(s => s[i]).filter(Boolean).map(b => ({ body: b, target: br.ctx.target })));
					}
				}
			} else {
				// a rune runs at most once on the same energy: when pieces merged, their branches would
				// otherwise both carry on with the combined energy and repeat every rune after it
				const ob = br.ctx.body;
				if(ob && !ob.foreign){
					const runs = ob._ranNodes || (ob._ranNodes = {});
					if(runs[node.id] && runs[node.id] !== br.id){ br.state = 'done'; br.note = 'merged with another branch'; return false; }
					runs[node.id] = br.id;
				}
				const res = runOnce(inst, api, R, br, node, kids);
				ok = res.ok; note = res.t.f || res.t.n || '';
				if(ok){
					if(br.divided){ const own = br.dividedOwn; setGroup(br, br.divided.map(d => ({ body: d, target: own ? { kind:'energy', ref: d } : br.ctx.target }))); br.divided = null; br.dividedOwn = false; }
					else if(!isPerBody(R) || !group) br.ctx.group = null;     // new single energy replaces a group
					else setGroup(br, [{ body: br.ctx.body, target: br.ctx.target }]);
				}
			}
			inst.exec[node.id] = { frame: W.frame, ok, note };
			if(ok && note) logI(inst, R.name + ': ' + note);
			if(!ok){ br.state = 'done'; br.note = note || 'failed'; br.hold = null; logI(inst, R.name + ' ended branch: ' + br.note); return false; }
			return true;
		}
		function setGroup(br, members){
			members = members.filter(m => m && m.body);
			if(members.length > CONFIG.maxBodiesPerInstance) members.length = CONFIG.maxBodiesPerInstance;
			br.ctx.group = members.length > 1 ? members : null;
			if(members.length){ br.ctx.body = members[0].body; br.ctx.target = members[0].target; }
		}

		function advance(inst, br, queue){
			const node = inst.def.nodes[br.nodeId];
			const kids = inst.kids[node.id] || [];
			if(!kids.length){ br.state = 'done'; br.note = 'complete'; return; }
			const splitB = br.splitBodies, splitG = br.splitGroups;
			for(let i = 0; i < kids.length; i++){
				const cid = kids[i];
				const ctx = { body: br.ctx.body, target: br.ctx.target, zone: br.ctx.zone, group: br.ctx.group ? br.ctx.group.slice() : null, cohort: br.ctx.cohort || null };
				if(splitG){ const g = splitG[i] || []; ctx.group = g.length > 1 ? g : null; ctx.body = g[0] ? g[0].body : null; }
				else if(splitB){ ctx.body = splitB[i] || null; ctx.group = null; }
				let nb;
				if(kids.length === 1){ nb = br; nb.nodeId = cid; nb.ctx = ctx; }
				else { nb = newBranch(inst, cid, ctx, br); if(!nb) continue; }
				enterLink(inst, nb, inst.def.nodes[cid].link, queue);
			}
			if(kids.length > 1){ br.state = 'done'; br.note = 'branched'; }
		}

		function enterLink(inst, br, link, queue){
			link = link || defaultLink();
			if(link.mode === 'delay'){
				br.state = 'delay'; br.wait = clamp(num(link.delay, 1), 0.05, CONFIG.delayMax);
			} else if(link.mode === 'condition'){
				br.state = 'cond'; br.condAge = 0; br.condTick = 0;
				const cd = Conditions[link.cond && link.cond.type];
				if(cd && cd.start) cd.start(inst._api || (inst._api = makeApi(inst)), br, link.cond.params || {});
				// evaluate immediately on arrival
				const r = checkCond(inst, br);
				if(r === true){ br.state = 'run'; queue.push(br); }
				else if(r === 'fail'){ br.state = 'done'; br.note = 'condition can never be met'; }
			} else {
				br.state = 'run'; queue.push(br);
			}
		}

		function checkCond(inst, br){
			const node = inst.def.nodes[br.nodeId];
			const link = node.link || defaultLink();
			const cd = Conditions[link.cond && link.cond.type];
			if(!cd) return 'fail';
			const api = inst._api || (inst._api = makeApi(inst));
			api.host = W.host;
			const params = link.cond.params || {};
			if(br.ctx.group && br.ctx.group.length > 1 && !cd.wholeGroup){
				// divided energy: the condition is met as soon as any piece meets it
				const keepB = br.ctx.body, keepT = br.ctx.target;
				let allFail = true, hit = false;
				for(const m of br.ctx.group){
					br.ctx.body = m.body; br.ctx.target = m.target;
					let r; try { r = cd.check(api, br, params); } catch(e){ r = 'fail'; }
					if(r === true){ hit = true; break; }
					if(r !== 'fail') allFail = false;
				}
				br.ctx.body = keepB; br.ctx.target = keepT;
				return hit ? true : (allFail ? 'fail' : false);
			}
			try { return cd.check(api, br, params); } catch(e){ return 'fail'; }
		}

		function pumpInstance(inst){
			// run every branch that is ready, depth-first through Instant links, deterministic FIFO
			const queue = [];
			for(const br of inst.branches) if(br.state === 'run' || br.state === 'resume') queue.push(br);
			let steps = 0;
			while(queue.length){
				const br = queue.shift();
				if(br.state === 'resume'){ br.state = 'busy'; advance(inst, br, queue); if(br.state === 'busy') br.state = 'done'; continue; }
				if(br.state !== 'run') continue;
				if(++steps > CONFIG.maxStepsPerFrame){ br.state = 'done'; br.note = 'step limit'; continue; }
				br.state = 'busy';
				if(!execNode(inst, br)) continue;
				if(br.hold){ br.state = 'hold'; continue; }      // channelled rune (e.g. a charging zone)
				advance(inst, br, queue);
				if(br.state === 'busy') br.state = 'done';
			}
			inst.steps = steps;
			if(inst.branches.length > 32) inst.branches = inst.branches.filter(b => b.state !== 'done');
		}

		/* =================================================================
		   TECHNIQUE RUNTIME — the shared interface every technique talks to.
		   Techniques never touch the host directly; they use T.
		   ================================================================= */
		function instById(id){ for(let i = 0; i < W.instances.length; i++) if(W.instances[i].id === id) return W.instances[i]; return null; }
		function casterPosOf(inst){
			const e = inst && inst.owner && inst.owner.entity;
			if(e && (!inst.owner.alive || inst.owner.alive())){ const c = center(e); inst.lastCaster = { x: c.x, y: c.y }; }
			return inst ? inst.lastCaster : null;
		}
		const T = {
			W, dt: 1 / 60, f: 1, time: 0, enemies: [], allies: [],
			clamp, dist, num,
			host(){ return W.host; },
			power(b){ return b.isZone ? (b.amount + (b.fieldCharge || 0)) : Math.abs(bodyPower(b)); },
			radius(b){ return bodyRadius(b); },
			center(e){ return center(e); },
			rect(e){ return W.host.hitRect(e); },
			instOf(b){ return instById(b.inst); },
			caster(b){ const i = instById(b.inst); return i && i.owner ? i.owner.entity : null; },
			casterPos(b){ return casterPosOf(instById(b.inst)); },
			focusEnt(b){
				const f = b.focus; if(!f) return null;
				if(f.kind === 'self'){ const i = instById(b.inst); return i && i.owner ? i.owner.entity : null; }
				if((f.kind === 'enemy' || f.kind === 'ally') && f.ref && !f.ref.dead && !(f.ref.hp != null && f.ref.hp <= 0)) return f.ref;
				return null;
			},
			focusPos(b){
				const f = b.focus; if(!f) return null;
				if(f.kind === 'surface' || f.kind === 'environment') return f.point || null;
				const e = T.focusEnt(b); return e ? center(e) : null;
			},
			isEnemy(e){ return T.enemies.indexOf(e) >= 0; },
			isCaster(b, e){ const i = instById(b.inst); return !!(i && i.owner && i.owner.entity === e); },
			impulse(e, ix, iy, opt){ if(e && isFinite(ix) && isFinite(iy)) W.host.applyImpulse(e, ix, iy, opt || {}); },
			status(e, type, mag, dur, data){ applyStatus(e, type, mag, dur, data); },
			hasStatus(e, type){ const st = W.status.get(e); return !!(st && st[type]); },
			clearStatus(e, type){ const st = W.status.get(e); if(st && st[type]){ delete st[type]; if(W.host.clearStatus) W.host.clearStatus(e, type); return true; } return false; },
			damage(e, dmg, info, b){
				if(!e || e.dead || !(dmg > 0)) return;
				if(b) markStruck(b.inst, e);
				W.host.damageEnemy(e, dmg, Object.assign({ instance: b ? b.inst : 0, color: b ? bodyColors(b).mid : '#ffffff' }, info || {}));
			},
			foreign(){ return W.host.getForeignProjectiles() || []; },
			bodies(){ return W.bodies; },
			nearBodies(x, y, r, skip){
				const out = [];
				// a crowd: look only in the grid cells the circle covers (results keep their world order)
				if(W.bodies.length >= CONFIG.perf.gridAt && r < 1500){
					const G = bodyGrid(), C = G.cell, M = 24, r2 = r * r;
					const x0 = Math.floor((x - r - M) / C), x1 = Math.floor((x + r + M) / C), y0 = Math.floor((y - r - M) / C), y1 = Math.floor((y + r + M) / C);
					for(let cx = x0; cx <= x1; cx++) for(let cy = y0; cy <= y1; cy++){
						const cell = G.m.get(cx * 73856093 ^ cy * 19349663); if(!cell) continue;
						for(let i = 0; i < cell.length; i++){ const o = cell[i]; if(!o.alive || o === skip) continue; const dx = o.x - x, dy = o.y - y; if(dx * dx + dy * dy <= r2) out.push(o); }
					}
					for(let i = G.n; i < G.ref.length; i++){ const o = G.ref[i]; if(!o.alive || o === skip || o.isZone) continue; o._gi = i; const dx = o.x - x, dy = o.y - y; if(dx * dx + dy * dy <= r2) out.push(o); }
					if(out.length > 1){ out.sort((a, b) => a._gi - b._gi); let w = 1; for(let i = 1; i < out.length; i++) if(out[i] !== out[w - 1]) out[w++] = out[i]; out.length = w; }
					return out;
				}
				for(const o of W.bodies){ if(!o.alive || o === skip || o.isZone) continue; const dx = o.x - x, dy = o.y - y; if(dx * dx + dy * dy <= r * r) out.push(o); }
				return out;
			},
			solid(x, y){ return W.host.isSolid(x, y); },
			kill(b, why){ killBody(b, why); },
			remember(b, key, n){ remember(b, key, n); },
			/* two of the caster's energies become one (keep absorbs drop, like raw energy combining) */
			merge(keep, drop){ if(keep && drop && keep !== drop && keep.alive && drop.alive) mergeRaw(keep, drop); },
			setVel(b, vx, vy){ b.vx = vx; b.vy = vy; if(vx || vy){ b.anchored = false; } },
			capSpeed(b, max){ const s = Math.hypot(b.vx, b.vy); if(s > max){ const k = max / s; b.vx *= k; b.vy *= k; } },
			spark(x, y, vx, vy, color, life, size){
				if(W.sparks.length > W._sparkCap) return;
				W.sparks.push({ x, y, vx, vy, age: 0, life: life || 20, color: color || '#ffffff', size: size || (1 + Math.random() * 2) });
			},
			ring(x, y, r, max, life, color, fill){ W.rings.push({ x, y, r, max, age: 0, life: life || 16, color: color || '#ffffff', fill: !!fill }); },
			/* once-per-cooldown helper (e.g. a field ticking an enemy) */
			every(obj, key, sec){ const k = '_t_' + key; if((obj[k] || 0) > T.time) return false; obj[k] = T.time + sec; return true; },
			techColor(id, s){ const d = Techniques.get(id); return d ? (s < 0 ? d.reversedColor : d.color) : '#ffffff'; },
			/* a one-off shove through the host's knockback (falls back to an impulse) */
			/* place a creature's centre at (x, y) — the host keeps it out of walls */
			teleport(e, x, y){
				if(!e) return false;
				if(W.host.teleport) return W.host.teleport(e, x, y) !== false;
				const w = e.w || 0, h = e.h || 0; e.x = x - w / 2; e.y = y - h / 2; return true;
			},
			/* reflect a creature's motion off a surface with normal (nx, ny) */
			bounce(e, nx, ny, rest){
				if(!e) return;
				if(W.host.bounce) return W.host.bounce(e, nx, ny, rest);
				const vn = (e.vx || 0) * nx + (e.vy || 0) * ny;
				if(vn < 0){ e.vx -= (1 + rest) * vn * nx; e.vy -= (1 + rest) * vn * ny; }
			},
			knock(e, vx, vy, frames){ if(!e) return; if(W.host.knockback) W.host.knockback(e, vx, vy, frames || 14); else W.host.applyImpulse(e, vx, vy, {}); },
			light(x, y, r, c, i){ if(W.lights.length < 160) W.lights.push({ x, y, r, i: i == null ? 0.6 : i, c: c || [255, 240, 200] }); },
			/* a projectile bent by your gravity / sent through your portal now hurts its own side too */
			gravResist(b){ return gravResist(b); },
			isInfinitySource(b){ return !!(b && b.infSource); },
			magicResist(b){ return magicResist(b); },
			/* ANTI-MAGIC — src spends up to `budget` of its energy consuming o.
			   Energy is conserved by magnitude: the weaker side is used up, the stronger keeps the rest. */
			antiMagic(src, o, budget){ return antiMagicExchange(src, o, budget); },
			antiForeign(src, p, budget){ return antiForeignExchange(src, p, budget); },
			antiZone(z, push){ antiZoneSuppress(z, push); },
			antiReinf(st, budget){ return antiReinfExchange(st, budget); },
			/* REVERSE ANTI-MAGIC — restores / stabilises magic that already exists (never creates energy) */
			restore(src, o, budget){ return magicRestore(src, o, budget); },
			removeForeign(p){ removeForeign(p); },
			reinf(){ return W.reinf; },
			magicalEnemy(e){ return magicalEnemy(e); },
			portalGuard(obj){ return portalGuard(obj); },
			turnForeign(ref, amount){ if(!ref) return; ref._magicBend = (ref._magicBend || 0) + (amount == null ? 99 : Math.abs(amount)); if(ref._magicBend >= 1.2) ref._magicTurned = true; },
			/* lasting changes to another caster's projectile (it is manipulated, never removed) */
			modForeign(ref, key, val, dur){
				if(!ref) return;
				let m = W.fmods.get(ref); if(!m){ m = {}; W.fmods.set(ref, m); }
				const cur = m[key];
				if(cur){ cur.t = Math.max(cur.t, dur); cur.v = val; }
				else m[key] = key === 'freeze' ? { t: dur, v: val, vx: ref.vx || 0, vy: ref.vy || 0 } : { t: dur, v: val };
			},
			unmodForeign(ref, key){
				const m = W.fmods.get(ref); if(!m || !m[key]) return false;
				if(key === 'freeze'){ ref.vx = m[key].vx; ref.vy = m[key].vy; }
				delete m[key]; return true;
			}
		};
		function updateForeignMods(dt, f){
			if(!W.fmods.size) return;
			W.fmods.forEach((m, ref) => {
				if(!W.host.foreignAlive(ref)){ W.fmods.delete(ref); return; }
				let any = false;
				for(const k in m){
					const s = m[k]; s.t -= dt;
					if(s.t <= 0){ if(k === 'freeze'){ ref.vx = s.vx; ref.vy = s.vy; } delete m[k]; continue; }
					any = true;
					if(k === 'gravity') ref.vy = (ref.vy || 0) + s.v * f;
					else if(k === 'freeze'){ ref.vx = 0; ref.vy = 0; }
				}
				if(!any) W.fmods.delete(ref);
			});
		}
		W.T = T;

		/* ---------- statuses on creatures (heat, chill, restraint …) ----------
		   One generic store. The host may map a status onto its own systems
		   (burn → damage-over-time, chill → slow …) by returning true from applyStatus. */
		function applyStatus(e, type, mag, dur, data){
			if(!e || e.dead) return;
			let st = W.status.get(e);
			if(!st){ st = {}; W.status.set(e, st); }
			const cur = st[type];
			if(cur){ cur.mag = Math.max(cur.mag, mag); cur.t = Math.max(cur.t, dur); if(data) Object.assign(cur, data); }
			else st[type] = Object.assign({ mag, t: dur, max: dur, tick: 0, seed: Math.random() * 10 }, data || {});
			st[type].native = !!(W.host.applyStatus && W.host.applyStatus(e, type, st[type].mag, st[type].t, st[type]) === true);
		}
		function updateStatuses(dt){
			if(!W.status.size) return;
			W.status.forEach((st, e) => {
				if(!e || e.dead || (e.hp != null && e.hp <= 0)){ W.status.delete(e); return; }
				let any = false;
				for(const k in st){
					const s = st[k];
					s.t -= dt;
					if(s.t <= 0){ delete st[k]; if(W.host.clearStatus) W.host.clearStatus(e, k); continue; }
					any = true;
					if(k === 'burn' && !s.native){
						s.tick += dt;
						if(s.tick >= 0.5){ s.tick = 0; W.host.damageEnemy(e, s.mag * 0.5, { color:'#ff8a3d', dot:true }); }
					} else if((k === 'chill' || k === 'dazzle') && !s.native){
						if(e.vx != null) e.vx *= 1 - 0.5 * clamp(s.mag, 0, 1);
					}
					if(k === 'bound'){
						const c = center(e);
						if(s.x == null){ s.x = c.x; s.y = c.y; }
						if(s.follow && s.follow.alive){ s.x = s.follow.x; s.y = s.follow.y; }
						const hold = clamp(s.mag, 0, 1) * 0.45;
						const dx = s.x - c.x, dy = s.y - c.y;
						if(Math.hypot(dx, dy) > (s.slack || 0)){ e.x += dx * hold; e.y += dy * hold; }
						if(e.vx != null){ e.vx *= 1 - hold; e.vy = (e.vy || 0) * (1 - hold); }
					}
				}
				if(!any) W.status.delete(e);
			});
		}

		/* ---------- reinforcement states (one model for every target) ---------- */
		function reinfKind(st){ return st.kind === 'energy' ? 'spell' : st.kind; }
		function refreshReinf(st){
			st.strength = Reinforcement.strength(st.energy, st.density, st.efficiency);
			st.props = Reinforcement.props(reinfKind(st), st.strength, st.tech);
			if(st.inf > 0){
				const k = st.strength * st.inf;
				if(st.kind === 'weapon' || st.kind === 'arms') st.props.reach = (st.props.reach || 0) + 0.08 * k;      // the strike reaches through distorted space
				if(st.kind === 'legs') st.props.moveForce = (st.props.moveForce || 0) + 0.06 * k;
				if(st.kind === 'self' || st.kind === 'ally') st.props.knockbackResist = (st.props.knockbackResist || 0) + 0.1 * k;
			}
			if(st.suppressed > W.time) for(const k in st.props) st.props[k] *= 0.3;      // Anti-Magic touching it: suppressed, not removed
		}
		function reinforceApply(inst, b, t, portion){
			const kind = t.kind;
			const td = Reinforcement.targets[kind];
			if(!td) return 'Reinforcement cannot strengthen ' + (TARGET_NOUN[kind] || kind);
			let ref = t.ref || null, key = null;
			if(kind === 'self' || kind === 'legs' || kind === 'arms'){ ref = inst.owner.entity; if(!ref) return 'Nothing to reinforce'; }
			else if(kind === 'ally'){ if(!ref || ref.dead) return 'No ally to reinforce'; }
			else if(kind === 'weapon'){ if(!ref || !ref.id) return 'No weapon to reinforce'; key = 'weapon:' + inst.owner.id + ':' + ref.id; }
			else if(kind === 'spell' || kind === 'energy'){
				if(!ref || ref.foreign) return 'Reinforcement cannot strengthen another caster\'s projectile';
				if(!ref.alive) return 'That spell is gone';
				if(ref === b) return 'Energy cannot reinforce itself';
			}
			const E = b.amount * clamp(portion, 1, 100) / 100;
			if(E < 1) return 'Not enough energy to reinforce';
			if((kind === 'spell' || kind === 'energy') && !ref.isZone){
				const ka = techKey(b), kb = techKey(ref);
				const da = dominantTech(b), db = dominantTech(ref);
				const opposite = da && db && da.id === db.id && Math.sign(da.s) !== Math.sign(db.s);
				if(ka === kb || opposite){
					const tp = { x: ref.x, y: ref.y };
					for(let i = 0; i < 12; i++){
						const sx = b.x + (Math.random() - 0.5) * bodyRadius(b), sy = b.y + (Math.random() - 0.5) * bodyRadius(b), life = 16 + Math.random() * 8;
						const k = 1 / ((1 - Math.pow(0.94, life)) / 0.06);
						spark(sx, sy, (tp.x - sx) * k, (tp.y - sy) * k, b, life);
					}
					if(portion >= 99.9) killBody(b, 'reinforce'); else b.amount -= E;
					remember(ref, 'reinforced');
					if(!opposite){
						// the same kind of energy: it simply adds to it
						ref.amount += E;
						W.rings.push({ x: ref.x, y: ref.y, r: bodyRadius(ref), max: bodyRadius(ref) + 18, age: 0, life: 16, color: bodyColors(ref).mid });
						logI(inst, 'Added ' + Math.round(E) + ' energy to the same kind of energy');
					} else {
						// a technique and its reverse cancel: what is left keeps the stronger side
						const net = ref.amount - E;
						W.rings.push({ x: ref.x, y: ref.y, r: 4, max: bodyRadius(ref) + 26, age: 0, life: 18, color: '#ffffff' });
						if(net > CONFIG.minEnergy){ ref.amount = net; logI(inst, 'Cancelled ' + Math.round(E) + ' — ' + Math.round(net) + ' remains'); }
						else if(net < -CONFIG.minEnergy){ ref.amount = -net; ref.tech = Object.assign({}, b.tech || {}); logI(inst, 'Cancelled it out — ' + Math.round(-net) + ' of the reverse remains'); }
						else { killBody(ref, 'cancel'); logI(inst, 'The energies cancelled each other out'); }
					}
					recomputeOutput(inst);
					return true;
				}
			}
			if((kind === 'spell' || kind === 'energy') && !ref.isZone){
				const odd = oddReinforce(inst, b, ref, E);
				if(odd){
					if(portion >= 99.9) killBody(b, 'reinforce'); else b.amount -= E;
					remember(ref, 'reinforced');
					W.rings.push({ x: ref.x, y: ref.y, r: 4, max: bodyRadius(ref) + 22, age: 0, life: 16, color: bodyColors(b).mid });
					logI(inst, odd);
					recomputeOutput(inst);
					return true;
				}
			}
			const eff = Reinforcement.efficiency(inst.profile);
			// Spatial energy that came from Infinity, poured into a body: an Infinity layer (the distance effect)
			let infL = 0;
			if((kind === 'self' || kind === 'ally' || kind === 'legs') && (b.infDerived || b.infSource) && Math.abs(techOf(b, 'spatial')) >= CONFIG.tech.minIntensity){
				infL = clamp(E * eff / 90, 0, 5);
				if(infL < 0.5) infL = 0;
				if(infL){ remember(b, 'infinitySpatialReinforced'); logI(inst, 'Infinity spatial layer — strength ' + infL.toFixed(1)); }
				else logI(inst, 'Too little Infinity Spatial energy to hold space apart (needs about ' + Math.ceil(45 / eff) + ' E)');
			}
			const st = {
				id: W.nextId++, inst: inst.id, ownerId: inst.owner.id, kind, ref, key,
				energy: E * eff, invested: E, density: densityFactor(b.scale), efficiency: eff,
				tech: b.tech ? Object.assign({}, b.tech) : {}, start: W.time, end: inst.passive ? Infinity : W.time + Math.max(0, inst.lifetime - inst.age), passive: !!inst.passive,
				strength: 0, props: {}, color: bodyColors(b), seed: Math.random() * 1000,
				inf: infL
			};
			inst.effLoss = (inst.effLoss || 0) + E * (1 - eff);
			refreshReinf(st);
			W.reinf.push(st);
			if(kind === 'spell' || kind === 'energy') remember(ref, 'reinforced');
			// the energy visibly pours into its target
			const tp = reinfAnchor(st) || { x: b.x, y: b.y };
			for(let i = 0; i < 14; i++){
				const a = Math.random() * Math.PI * 2, r = bodyRadius(b) * Math.random();
				const sx = b.x + Math.cos(a) * r, sy = b.y + Math.sin(a) * r, life = 18 + Math.random() * 10;
				const k = 1 / ((1 - Math.pow(0.94, life)) / 0.06);
				spark(sx, sy, (tp.x - sx) * k, (tp.y - sy) * k, b, life);
			}
			W.rings.push({ x: tp.x, y: tp.y, r: 8, max: 46, age: 0, life: 20, color: st.color.mid });
			if(portion >= 99.9) killBody(b, 'reinforce'); else b.amount -= E;
			logI(inst, 'Reinforced ' + td.label + ' — strength ' + Math.round(st.strength * 100) + '%');
			return true;
		}
		/* energy of one kind poured into energy of another kind: each technique does something of its own */
		function oddReinforce(inst, b, ref, E){
			const d = dominantTech(b);
			if(!d) return null;                      // raw energy into technique energy: ordinary reinforcement
			const def = Techniques.get(d.id);
			if(def && def.onReinforceEnergy){ const r = def.onReinforceEnergy(T, b, ref, E, d.s); if(r) return r; }
			const pos = d.s > 0;
			switch(d.id){
				case 'kinetic': {
					if(pos){
						// +0.1 speed for every point of kinetic energy, at once — past any normal maximum
						const add = 0.1 * E; ref.speedBonus = (ref.speedBonus || 0) + add;
						const sp = Math.hypot(ref.vx, ref.vy);
						if(sp > 0.2){ const k = (sp + add) / sp; ref.vx *= k; ref.vy *= k; }
						return 'Kinetic surge: +' + add.toFixed(1) + ' speed';
					}
					const k = Math.max(0.1, 1 - 0.02 * E); ref.vx *= k; ref.vy *= k; ref.speedBonus = Math.max(0, (ref.speedBonus || 0) * k);
					return 'Kinetic drain: slowed to ' + Math.round(k * 100) + '%';
				}
				case 'light':
					// light feeds any energy, whatever it is
					ref.amount += E;
					return 'Light feeds it: +' + Math.round(E) + ' energy';
				case 'thermal':
					if(pos){ ref.burnOnHit = (ref.burnOnHit || 0) + E * 0.03; return 'Heated: its hits now burn'; }
					ref.chillOnHit = (ref.chillOnHit || 0) + E * 0.03; return 'Chilled: its hits now chill';
				case 'gravity':
					if(pos){ ref.heavy = (ref.heavy || 0) + E * 0.02; return 'Weighed down: it arcs downward and hits harder'; }
					ref.lift = (ref.lift || 0) + E * 0.02; return 'Lightened: it floats upward';

				case 'spatial':
					if(ref.immovable) return null;
					if(pos){ ref.x = b.x; ref.y = b.y; return 'Spatial swap: it jumped to the reinforcing energy'; }
					return null;
			}
			return null;
		}
		/* where a target is right now (for Guided / Bound energy) */
		/* ---- Bound tethers ----
		   str 1–10 sets how hard it pulls, how much it slows and how much it takes to snap it.
		   Bound to you: 'follow' — the energy trails after you; 'pull' — it reels you toward it.
		   Bound to energy: the two are drawn together (the bigger one moves less).
		   Fast / strong energy crossing the cord snaps it; a kinetic cord catches enemy magic and slings it back. */
		/* compressed energy below the minimum for its compression level simply ceases to exist */
		function collapseBody(b){
			if(!b || !b.alive) return;
			W.rings.push({ x: b.x, y: b.y, r: 2, max: bodyRadius(b) + 14, age: 0, life: 12, color: '#ffffff' });
			const inst = instById(b.inst);
			if(inst) logI(inst, 'Compressed energy fell below ' + Math.ceil(compMin(b.comp)) + ' E (compression ' + b.comp + ') and collapsed');
			killBody(b, 'collapse');
		}
		/* unstable over-compressed energy going off: hurts everything close by — you included */
		function explodeBody(b){
			if(!b || !b.alive) return;
			if(b.infSource){ if(!infAntiOnly(b)) infBacklash(b, 'its unstable compression went off'); return; }
			const P = Math.abs(bodyPower(b)), R = 50 + Math.sqrt(P) * 9, col = bodyColors(b), inst = instById(b.inst);
			const dmgAt = (d) => P * CONFIG.damagePerPower * 0.9 * Math.max(0, 1 - d / R);
			for(const e of (W.host.getEnemies() || [])){
				if(!e || e.dead) continue;
				const c = center(e), d = dist(c.x, c.y, b.x, b.y);
				if(d < R){ const dm = dmgAt(d * 0.7); if(dm > 0) W.host.damageEnemy(e, dm, { x: b.x, y: b.y, color: col.mid, instance: b.inst }); if(W.host.knockback){ const l = d || 1; W.host.knockback(e, (c.x - b.x) / l * 6, -3, 12); } }
			}
			const me = inst && inst.owner ? inst.owner.entity : null;
			if(me){
				const c = center(me), d = dist(c.x, c.y, b.x, b.y);
				if(d < R){
					if(W.host.hurtCaster) W.host.hurtCaster(me, dmgAt(d * 0.7), { x: b.x, y: b.y, color: col.mid });
					if(W.host.knockback){ const l = d || 1; W.host.knockback(me, (c.x - b.x) / l * 7 * (1 - d / R), -3, 12); }
				}
			}
			W.rings.push({ x: b.x, y: b.y, r: 6, max: R, age: 0, life: 22, color: '#ffffff' });
			W.rings.push({ x: b.x, y: b.y, r: 4, max: R * 0.7, age: 0, life: 18, color: col.mid });
			if(W.lights.length < 64) W.lights.push({ x: b.x, y: b.y, r: R * 1.4, i: 1, c: [255, 245, 220] });
			for(let i = 0; i < 24; i++){ const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 6; spark(b.x, b.y, Math.cos(a) * s, Math.sin(a) * s, b, 18 + Math.random() * 16); }
			if(inst) logI(inst, 'Unstable compression exploded');
			if(W.host.say) W.host.say('Unstable compression exploded!');
			killBody(b, 'explode');
		}
		/* ================= ANTI-MAGIC exchange rules (generic: player and enemy magic alike) ================= */
		function removeForeign(p){
			if(!p || p._magicGone) return;
			p._magicGone = true;
			W.rings.push({ x: p.x, y: p.y, r: 3, max: 26, age: 0, life: 14, color: '#3a3a3a' });
			if(W.host.removeForeign) W.host.removeForeign(p); else { p.dead = true; p.alive = false; }
		}
		function magicalEnemy(e){
			if(!e) return false;
			const td = e.typeDef || {};
			return !!(e.isMagical || e.magic || e.mana != null || e.element || td.magic || td.caster || td.element || td.isCaster || W.status.get(e));
		}
		function amEpisode(o, key){ const k = '_am' + key; const fresh = (o[k] || -9) < W.time - 0.4; o[k] = W.time; return fresh; }
		function antiMagicExchange(src, o, budget){
			if(!o || !o.alive || o.isZone || !(budget > 0)) return 0;
			if(o.infSource){
				const spend = Math.min(budget, src ? Math.max(0, src.amount) : budget);
				if(!(spend > 0)) return 0;
				if(src) src.amount -= spend;
				o._amSpent = (o._amSpent || 0) + spend;
				if(amEpisode(o, 'C')) remember(o, 'antiMagicContact');
				if(amEpisode(o, 'D')){ remember(o, 'antiMagicDisrupted'); remember(o, 'infinityDisrupted'); infFamily(o, 'infinityDisrupted'); }
				infStress(o, spend / (30 + 220 * INF.stab(o.comp)), 'its flow was disrupted by Anti-Magic');
				return spend;
			}
			const res = magicResist(o), before = o.amount;
			const spend = Math.min(budget, before * res, src ? Math.max(0, src.amount) : budget);
			if(!(spend > 0)) return 0;
			const eaten = spend / res;
			o.amount -= eaten; if(src) src.amount -= spend;
			if(amEpisode(o, 'C')){ remember(o, 'antiMagicContact'); remember(o, 'antiMagicConsumed'); }
			const frac = clamp(eaten / Math.max(0.001, before), 0, 1);
			let disrupted = false;
			// its technique is suppressed faster than its energy is consumed
			if(o.tech) for(const k in o.tech){
				if(k === 'antimagic') continue;
				const v = o.tech[k]; if(!v) continue;
				const lost = v * Math.min(1, frac * 1.6);
				o.tech[k] = v - lost;
				(o._techLost || (o._techLost = {}))[k] = (o._techLost[k] || 0) + lost;
				if(Math.abs(o.tech[k]) < CONFIG.tech.minIntensity){ o.tech[k] = 0; disrupted = true; }
			}
			// kinetic force and stored speed drain away with it
			if(o.speedBonus) o.speedBonus *= 1 - frac;
			o.vx *= 1 - 0.5 * frac; o.vy *= 1 - 0.5 * frac;
			// a portal / surface is an active structure: it destabilises (its time runs out) rather than simply shrinking
			if(o.spatial){ o.spatial.end -= spend * 0.04; disrupted = true; }
			if(disrupted && amEpisode(o, 'D')) remember(o, 'antiMagicDisrupted');
			if(o.amount < CONFIG.minEnergy) killBody(o, 'antimagic');
			return spend;
		}
		function foreignStrength(p){ return num(p.power != null ? p.power : (p.dmg != null ? p.dmg : p.damage), 10); }
		function antiForeignExchange(src, p, budget){
			if(!p || p._magicGone || !(budget > 0)) return 0;
			const cur = foreignStrength(p), res = 1 + 0.25 * ((p.effects && p.effects.length) || 0);
			const spend = Math.min(budget, cur * res, src ? Math.max(0, src.amount) : budget);
			if(!(spend > 0)) return 0;
			const eaten = spend / res, k = Math.max(0, (cur - eaten) / Math.max(0.001, cur));
			if(p.power != null) p.power *= k; if(p.dmg != null) p.dmg *= k; if(p.damage != null) p.damage *= k;
			p.vx = (p.vx || 0) * (0.5 + 0.5 * k); p.vy = (p.vy || 0) * (0.5 + 0.5 * k);
			if(k < 0.5 && p.effects && p.effects.length) p.effects = [];          // its elemental nature is suppressed: inert energy
			if(src) src.amount -= spend;
			if(cur - eaten <= 1) removeForeign(p);
			return spend;
		}
		function antiZoneSuppress(z, push){
			if(!z || !z.alive || !z.isZone) return;
			if(push > 0 && techOf(z, 'antimagic') >= CONFIG.tech.minIntensity) return;      // an Anti-Magic zone is not broken down by Anti-Magic
			z.amSupp = Math.max(0, (z.amSupp || 0) + push);
			if(push > 0 && amEpisode(z, 'C')) remember(z, 'antiMagicContact');
			if(z.amSupp >= 1){
				remember(z, 'antiMagicDisrupted');
				const inst = instById(z.inst); if(inst) logI(inst, 'Zone collapsed — suppressed by Anti-Magic');
				W.rings.push({ x: z.x, y: z.y, r: z.zoneRadius, max: 6, age: 0, life: 24, color: '#2a2a2a' });
				killBody(z, 'suppressed');
			}
		}
		function antiReinfExchange(st, budget){
			if(!st || !(budget > 0) || st.energy <= 0) return 0;
			const res = st.inf > 0 ? 0.7 : 1;                    // Infinity held as reinforcement is badly exposed to Anti-Magic
			const spend = Math.min(budget, st.energy * res);
			st.energy -= spend / res;
			st.suppressed = W.time + 0.5;                        // suppressed while it is touched — the rest resumes afterwards
			return spend;
		}
		function magicRestore(src, o, budget){
			if(!o || !o.alive || !(budget > 0)) return 0;
			let left = Math.min(budget, src ? Math.max(0, src.amount) : budget), used = 0;
			if(o.isZone){ const take = Math.min(o.amSupp || 0, left * 0.02); o.amSupp = (o.amSupp || 0) - take; used += take * 50; }
			else {
				const room = Math.max(0, (o.peakAmt || o.amount) - o.amount);
				const give = Math.min(left, room);
				if(give > 0){ o.amount += give; used += give; left -= give; }
				if(o._techLost) for(const k in o._techLost){
					if(!(o._techLost[k] > 0) || left <= 0) continue;
					const back = Math.min(Math.abs(o._techLost[k]), left * 0.02);
					o.tech = o.tech || {}; o.tech[k] = (o.tech[k] || 0) + Math.sign(o._techLost[k]) * back;
					o._techLost[k] -= Math.sign(o._techLost[k]) * back;
					used += back * 50; left -= back * 50;
				}
				o.stabilized = o.age + 0.5;      // over-compression, Infinity and portals hold together better for a moment
				if(o.spatial && left > 0){ const ext = Math.min(left * 0.05, 0.5 * T.dt * 60); o.spatial.end += ext; used += ext * 20; }
				if(o.infSource && o.infStress > 0 && left > 0){ const k = Math.min(o.infStress, left * 0.004); o.infStress -= k; used += k * 250; }      // it calms a stressed Infinity source
			}
			used = Math.min(used, budget);
			if(src) src.amount -= used;
			if(used > 0.01 && amEpisode(o, 'R')) remember(o, 'magicRestored');
			return used;
		}
		/* a condensed Anti-Magic weapon sweeping through magic: anything under 10% of its energy is erased outright */
		W.antiSweep = function(x, y, r, energy, ownerId){
			let erased = 0;
			const pseudo = { amount: Math.max(1, energy * 0.02) };
			for(const o of W.bodies){
				if(!o.alive || (o.ownerId === ownerId && !o.hostile) || antiOf(o) > 0 || o.zoneBlob) continue;
				if(o.isZone){ if(dist(o.x, o.y, x, y) < o.zoneRadius + r) antiZoneSuppress(o, 0.02 + energy / 6000); continue; }
				if(dist(o.x, o.y, x, y) > r + bodyRadius(o)) continue;
				if(!o.infSource && o.amount * magicResist(o) < energy * 0.1){
					remember(o, 'antiMagicContact'); remember(o, 'antiMagicConsumed'); remember(o, 'antiMagicDisrupted');
					W.rings.push({ x: o.x, y: o.y, r: bodyRadius(o), max: 4, age: 0, life: 14, color: '#1a1a1a' });
					killBody(o, 'antimagic'); erased++;
				} else antiMagicExchange(pseudo, o, pseudo.amount);
			}
			for(const p of (W.host.getForeignProjectiles() || [])){
				if(!p || p._magicGone) continue;
				if(dist(p.x, p.y, x, y) > r + Math.max(p.width || 8, p.height || 8) * 0.5) continue;
				if(foreignStrength(p) * (1 + 0.25 * ((p.effects && p.effects.length) || 0)) < energy * 0.1){ removeForeign(p); erased++; }
				else antiForeignExchange(pseudo, p, pseudo.amount);
			}
			return erased;
		};
		/* ================= INFINITY ================= */
		/* portal / spatial / infinity recursion: something bouncing between portals is stopped safely */
		function portalGuard(obj){
			if(!obj || obj.alive === false) return false;
			if(obj._portalBlock > W.time) return false;
			const h = obj._portalHist || (obj._portalHist = []);
			h.push(W.time); while(h.length && h[0] < W.time - 1) h.shift();
			if(h.length > 6){
				h.length = 0;
				if(!obj.foreign && obj.amount != null && obj.alive !== undefined && obj.inst != null){
					const inst = instById(obj.inst);
					if(inst){
						logI(inst, 'Spatial recursion detected — the branch holding this energy was ended');
						for(const br of inst.branches) if(br.ctx.body === obj && br.state !== 'done'){ br.state = 'done'; br.note = 'spatial recursion'; }
					}
					if(obj.infSource) endInfinity(obj, 'spatial recursion');
					killBody(obj, 'recursion');
				} else obj._portalBlock = W.time + 1.5;
				return false;
			}
			// an Infinity source carried through a portal is strained
			if(obj.infSource) infStress(obj, 0.25, 'carried through a portal');
			return true;
		}
		/* ================= INFINITY — a reservoir made from dense, powerful energy =================
		   b.infSource = { origin, born, flow, pulse, drawnAt } on an ordinary energy body that keeps its own kind (b.tech).
		   It never leaks or runs dry. b.infStress (0…1) rises when it is drawn faster than the caster can control,
		   when Anti-Magic disrupts its flow, or when a very powerful spell strikes it; it eases while left alone.
		   At 1 it backlashes: a violent release that destroys the source. */
		function infFamily(src, key){ for(const o of W.bodies) if(o.alive && o.infFrom === src.id) remember(o, key); }
		function makeInfinity(b, inst){
			b.infSource = { origin: techKey(b), born: W.time, flow: 0, pulse: 0, drawnAt: -9 };
			b.infStress = 0; b.charging = false;
			remember(b, 'infinityCreated');
			b.flash = 1;
			const R = bodyRadius(b);
			W.rings.push({ x: b.x, y: b.y, r: R * 3 + 30, max: R + 2, age: 0, life: 24, color: '#e8fbff' });
			W.rings.push({ x: b.x, y: b.y, r: R * 2 + 16, max: R + 2, age: 0, life: 18, color: bodyColors(b).mid });
			if(inst) logI(inst, 'Infinity source formed (' + (b.infSource.origin === 'raw' ? 'raw energy' : b.infSource.origin.replace(/[+-]$/, '')) + ', ' + INF.label(b.comp) + ')');
		}
		/* a calm end (dissolved / stripped) — the energy stays as ordinary energy of its kind */
		function endInfinity(b, why){
			if(!b || !b.infSource) return;
			b.infSource = null; b.infStress = 0;
			remember(b, 'infinityCollapsed');
			const inst = instById(b.inst); if(inst) logI(inst, 'Infinity source ' + (why === 'dissolved' ? 'dissolved' : 'collapsed — ' + why));
			W.rings.push({ x: b.x, y: b.y, r: bodyRadius(b), max: bodyRadius(b) + 40, age: 0, life: 20, color: '#d8f4ff' });
		}
		/* a Spatial Infinity source is a master portal: nothing but Anti-Magic can harm it */
		function infAntiOnly(b){ return !!(b && b.infSource && techOf(b, 'spatial') >= CONFIG.tech.minIntensity); }
		function infStress(b, add, why){
			if(!b || !b.alive || !b.infSource || !(add > 0)) return;
			if(infAntiOnly(b) && !/anti-magic/i.test(String(why || ''))) return;
			const before = b.infStress || 0;
			b.infStress = before + add;
			b.infSource.lastWhy = why;
			if(b.infStress >= 0.6 && before < 0.6){
				remember(b, 'infinityDestabilized'); infFamily(b, 'infinityDestabilized');
				const inst = instById(b.inst); if(inst) logI(inst, 'Infinity source destabilising — ' + why);
				if(W.host.say) W.host.say('Infinity is destabilising!');
			}
			if(b.infStress >= 1) infBacklash(b, why);
		}
		/* the violent failure: everything the source was holding back is released at once */
		function infBacklash(b, why){
			if(!b || !b.alive || !b.infSource) return;
			const S = INF.stab(b.comp), flow = b.infSource.flow || 0;
			const P = b.amount * (0.6 + 0.8 * S) * (1 + Math.min(2, flow / 250)) + (b._amSpent || 0) * 2;
			const R = 70 + Math.sqrt(P) * 4.5;
			const inst = instById(b.inst);
			remember(b, 'infinityExploded'); remember(b, 'infinityCollapsed'); infFamily(b, 'infinityExploded');
			for(const e of (W.host.getEnemies() || [])){
				if(!e || e.dead) continue;
				const c = center(e), d = dist(c.x, c.y, b.x, b.y); if(d > R) continue;
				const k = 1 - d / R;
				W.host.damageEnemy(e, P * 0.18 * k, { x: c.x, y: c.y, color: bodyColors(b).mid, instance: b.inst });
				if(W.host.knockback) W.host.knockback(e, (c.x - b.x) / (d || 1) * 12 * k, -4 * k, 16);
			}
			const me = inst && inst.owner ? inst.owner.entity : null;
			if(me){ const c = center(me), d = dist(c.x, c.y, b.x, b.y); if(d < R){ const k = 1 - d / R; if(W.host.hurtCaster) W.host.hurtCaster(me, P * 0.1 * k, { x: c.x, y: c.y, color: '#ffffff' }); if(W.host.knockback) W.host.knockback(me, (c.x - b.x) / (d || 1) * 12 * k, -4 * k, 16); } }
			for(const o of W.bodies){
				if(!o.alive || o === b || o.isZone) continue;
				const d = dist(o.x, o.y, b.x, b.y); if(d > R) continue;
				const k = 1 - d / R;
				remember(o, 'infinityDisrupted');
				o.amount *= 1 - 0.5 * k;
				if(!o.anchored && d > 1){ o.vx += (o.x - b.x) / d * 9 * k; o.vy += (o.y - b.y) / d * 9 * k; }
				if(o.amount < CONFIG.minEnergy) killBody(o, 'backlash');
			}
			for(const p of (W.host.getForeignProjectiles() || [])){ if(!p || p._magicGone) continue; const d = dist(p.x, p.y, b.x, b.y); if(d < R * 0.5) removeForeign(p); else if(d < R && d > 1){ const k = 8 * (1 - d / R); p.vx = (p.vx || 0) + (p.x - b.x) / d * k; p.vy = (p.vy || 0) + (p.y - b.y) / d * k; } }
			W.rings.push({ x: b.x, y: b.y, r: 8, max: R, age: 0, life: 26, color: '#ffffff' });
			W.rings.push({ x: b.x, y: b.y, r: 6, max: R * 0.75, age: 0, life: 22, color: bodyColors(b).mid });
			if(W.lights.length < 64) W.lights.push({ x: b.x, y: b.y, r: R * 1.4, i: 1, c: [230, 245, 255] });
			for(let i = 0; i < 30; i++){ const a = Math.random() * Math.PI * 2, s2 = 2 + Math.random() * 7; spark(b.x, b.y, Math.cos(a) * s2, Math.sin(a) * s2, b, 18 + Math.random() * 18); }
			if(W.host.shake) W.host.shake(12);
			if(inst) logI(inst, 'INFINITY BACKLASH — ' + (why || 'its flow broke') + ' (' + Math.round(P) + ' power released)');
			if(W.host.say) W.host.say('Infinity backlash!');
			b.infSource = null;
			killBody(b, 'backlash');
		}
		/* drawing from a source: always hands back what is asked — but a pull past the caster's control stresses it */
		function infDraw(s, want, dt, inst){
			if(!s || !s.alive || !s.infSource || !(want > 0)) return 0;
			const cap = INF.cap(s.comp, inst && inst.profile);
			const rate = want / Math.max(1e-4, dt);
			s.infSource.flow = Math.max(s.infSource.flow * 0.9, rate);
			s.infSource.drawnAt = W.time;
			if(rate > cap) infStress(s, (rate / cap - 1) * dt * (1.6 - INF.stab(s.comp)), 'drawn faster than its caster can control');
			if(!s.alive || !s.infSource) return 0;
			return want;
		}
		/* one huge pull (far more than a few seconds of safe drawing) is itself a strain */
		function infBurst(s, amount, inst){
			if(!s || !s.infSource) return;
			const cap = INF.cap(s.comp, inst && inst.profile), burst = cap * 3;
			if(amount > burst) infStress(s, Math.min(0.6, (amount / burst - 1) * 0.25 * (1.6 - INF.stab(s.comp))), 'too much asked of it at once');
		}
		/* every frame: stress eases, powerful magic striking a source disrupts it, opposing Infinity energy tears space */
		function infinitySourcePass(dt){
			const linked = [];
			for(const b of W.bodies) if(b.alive && (b.infSource || b.infDerived) && !b.rupture && spatialPolarity(b)) linked.push(b);
			for(let i = 0; i < linked.length; i++) for(let j = i + 1; j < linked.length; j++){
				const a = linked[i], c = linked[j];
				if(!a.alive || !c.alive || spatialPolarity(a) !== -spatialPolarity(c)) continue;
				if(dist(a.x, a.y, c.x, c.y) > bodyRadius(a) + bodyRadius(c)) continue;
				if(a.amount + c.amount < 300) continue;
				makeRupture(a, c);
			}
			for(const s of W.bodies){
				if(!s.alive || !s.infSource) continue;
				const S = INF.stab(s.comp), I = s.infSource;
				if(!(I.drawnAt > W.time - 0.12)) s.infStress = Math.max(0, (s.infStress || 0) - (0.05 + 0.3 * S) * dt);
				I.flow *= Math.pow(0.2, dt);
				if(I.pulse > 0) I.pulse = Math.max(0, I.pulse - dt * 3);
				if(Math.abs(antiOf(s)) >= CONFIG.tech.minIntensity) infStress(s, 0.08 * dt, 'Anti-Magic at war with its own Infinity');
				if(!s.alive) continue;
				const R = bodyRadius(s);
				for(const o of W.bodies){
					if(!o.alive || o === s || o.isZone || o.zoneBlob || o.infFrom === s.id || o.rupture || antiOf(o) > 0) continue;
					if(dist(o.x, o.y, s.x, s.y) > R + bodyRadius(o)) continue;
					if(!T.every(o, 'infHit' + s.id, 0.5)) continue;
					const d = INF.disruption(bodyPower(o), s.comp);
					if(d > 0.02){ if(amEpisode(s, 'Q')){ remember(s, 'infinityDisrupted'); infFamily(s, 'infinityDisrupted'); } infStress(s, d, 'struck by a powerful spell'); if(!s.alive) break; }
				}
				if(!s.alive) continue;
				for(const p of (W.host.getForeignProjectiles() || [])){
					if(!p || p._magicGone || dist(p.x, p.y, s.x, s.y) > R + 8 || !T.every(p, 'infHit' + s.id, 0.5)) continue;
					const d = INF.disruption(foreignStrength(p) * 3, s.comp);
					if(d > 0.02){ remember(s, 'infinityDisrupted'); infStress(s, d, 'struck by enemy magic'); }
				}
			}
		}
		function makeRupture(a, c){
			const keep = a.amount >= c.amount ? a : c, drop = keep === a ? c : a;
			const sum = a.amount + c.amount, total = sum * 0.85;
			const vx = (a.vx * a.amount + c.vx * c.amount) / sum, vy = (a.vy * a.amount + c.vy * c.amount) / sum;
			const x = (a.x * a.amount + c.x * c.amount) / sum, y = (a.y * a.amount + c.y * c.amount) / sum;
			remember(keep, 'infinityCombined'); remember(drop, 'infinityCombined');
			retargetBody(drop, keep); killBody(drop, 'merge');
			Object.assign(keep, { amount: total, x, y, vx, vy, tech: null, technique: null, infSource: null, infDerived: false, infStress: 0, comp: 0, over: 40, shape: 'sphere',
				anchored: false, attach: null, bond: null, follow: null, arrive: null, spatial: null, immovable: false, noContact: false, hideBody: false, keepEnergy: false, focus: null,
				rupture: { born: W.time, start: total } });
			keep.scale = Math.min(keep.scale, 0.3);
			const inst = instById(keep.inst);
			if(inst) logI(inst, 'Opposing Infinity energy tore space — a spatial rupture formed (' + Math.round(total) + ' E)');
			if(W.host.say) W.host.say('Space tears apart!');
			// enormous recoil: the caster is hurled away from it
			const me = inst && inst.owner ? inst.owner.entity : null;
			if(me && W.host.knockback){ const c0 = center(me), d = dist(c0.x, c0.y, x, y); if(d < 420){ const k = 12 * (1 - d / 420); W.host.knockback(me, (c0.x - x) / (d || 1) * k, -4 * (1 - d / 420), 16); } }
			if(W.host.shake) W.host.shake(14);
			W.rings.push({ x, y, r: 8, max: 160, age: 0, life: 26, color: '#c9a7ff' });
			W.rings.push({ x, y, r: 4, max: 110, age: 0, life: 20, color: '#ffffff' });
			if(W.lights.length < 64) W.lights.push({ x, y, r: 260, i: 1, c: [200, 160, 255] });
		}
		function ruptureTick(b, dt, f, enemies){
			const R = bodyRadius(b), reach = R * 1.4 + 6, pullR = R * 4 + 80;
			b.amount -= (b.amount * 0.12 + 4) * dt;
			if(W.time - b.rupture.born > 6) b.amount -= b.amount * 0.6 * dt;
			const inst = instById(b.inst);
			for(const o of W.bodies){
				if(!o.alive || o === b) continue;
				if(o.isZone){ if(dist(o.x, o.y, b.x, b.y) < o.zoneRadius) antiZoneSuppress(o, 2.5 * dt); continue; }
				const d = dist(o.x, o.y, b.x, b.y);
				if(d < reach + bodyRadius(o) * 0.5){
					// magic that touches it is erased
					remember(o, 'antiMagicDisrupted');
					b.amount -= o.amount * 0.25; killBody(o, 'erased'); continue;
				}
				if(d < pullR && !o.anchored && !o.attach){
					const g = (Math.abs(techOf(o, 'gravity')) >= CONFIG.tech.minIntensity ? 3 : 1) * 0.6 * (1 - d / pullR) * f;      // gravity is dragged in violently
					o.vx += (b.x - o.x) / d * g; o.vy += (b.y - o.y) / d * g;
				}
			}
			for(const p of (W.host.getForeignProjectiles() || [])){
				if(!p || p._magicGone) continue;
				const d = dist(p.x, p.y, b.x, b.y);
				if(d < reach + 6){ removeForeign(p); continue; }
				if(d < pullR){ const g = 0.5 * (1 - d / pullR) * f; p.vx = (p.vx || 0) + (b.x - p.x) / d * g; p.vy = (p.vy || 0) + (b.y - p.y) / d * g; T.turnForeign(p, 0.2); }
			}
			const dmg = 6 + Math.sqrt(Math.max(0, b.amount)) * 3.5 + b.amount * 0.04;
			for(const e of enemies){
				if(!e || e.dead) continue;
				const hr = W.host.hitRect(e);
				if(!shapeHit(b, reach, hr)) continue;
				if(T.every(e, 'rup' + b.id, 0.12)){ markStruck(b.inst, e); remember(b, 'hitEnemy'); W.host.damageEnemy(e, dmg, { x: b.x, y: b.y, color: '#c9a7ff', instance: b.inst }); }
				for(const st of W.reinf) if(st.ref === e) st.energy -= st.energy * 0.8 * dt;
			}
			const me = inst && inst.owner ? inst.owner.entity : null;
			if(me && shapeHit(b, reach, W.host.hitRect(me)) && T.every(me, 'rup' + b.id, 0.25) && W.host.hurtCaster) W.host.hurtCaster(me, dmg * 0.6, { x: b.x, y: b.y, color: '#c9a7ff' });
			if(Math.random() < 0.6 * f){ const a = Math.random() * Math.PI * 2, rr = pullR * (0.6 + 0.4 * Math.random()); spark(b.x + Math.cos(a) * rr, b.y + Math.sin(a) * rr, -Math.cos(a) * 3, -Math.sin(a) * 3, b, 18); }
		}
		/* Spatial Infinity reinforcement: space around the body is held apart — approaches slow ever more, never arriving */
		function infinityFields(){
			const F = [];
			for(const st of W.reinf){
				if(!(st.inf > 0) || !st.ref || st.suppressed > W.time) continue;
				if(st.kind !== 'self' && st.kind !== 'ally' && st.kind !== 'legs') continue;
				const c = center(st.ref), r0 = Math.max(st.ref.w || 30, st.ref.h || 40) * 0.55, L = st.kind === 'legs' ? st.inf * 0.5 : st.inf;
				F.push({ x: c.x, y: c.y, r0, R: r0 + 18 + 14 * L, L, st, owner: st.ownerId, ownerEnt: st.ref });
			}
			return F;
		}
		function infinityPass(dt, f, enemies, allies){
			const F = infinityFields();
			W._infFields = F;
			for(const b of W.bodies) b._infF = null;
			if(!F.length){ for(const b of W.bodies) if(b._inInf){ b._inInf = false; remember(b, 'infinityExited'); } return; }
			const best = (x, y, rad, ownerEnt, isOwn, o) => {
				let bt = null, inside = false;
				for(const fl of F){
					if(ownerEnt && fl.st.ref === ownerEnt) continue;                 // the layer moves with the body wearing it
					if(isOwn && fl.owner === isOwn) continue;                         // your own spells pass your own layer
					const d = dist(x, y, fl.x, fl.y); if(d >= fl.R) continue;
					inside = true;
					let k = INF.approach(d, fl.r0 + rad, fl.R, fl.L);
					if(o){ const am = antiOf(o); if(am >= CONFIG.tech.minIntensity) k += (1 - k) * Math.min(1, 0.6 * am); }      // Anti-Magic cuts through
					if(!bt || k < bt.k) bt = { x: fl.x, y: fl.y, k, fl, d };
				}
				return { bt, inside };
			};
			for(const o of W.bodies){
				if(!o.alive || o.isZone || o.zoneBlob || o.rupture) continue;
				const r = best(o.x, o.y, bodyRadius(o) * 0.3, null, o.ownerId, o);
				if(r.inside && !o._inInf){ o._inInf = true; remember(o, 'infinityEntered'); }
				else if(!r.inside && o._inInf){ o._inInf = false; remember(o, 'infinityExited'); }
				const B = r.bt; if(!B || B.k >= 0.999) continue;
				o._infF = B;
				const dx = B.x - o.x, dy = B.y - o.y, d = Math.hypot(dx, dy) || 1, vr = (o.vx * dx + o.vy * dy) / d;
				if(vr > 0.5){ B.fl.st.energy -= vr * (1 - B.k) * Math.abs(bodyPower(o)) * dt * 0.02; if(B.k < 0.25 && T.every(B.fl.st, 'infBlk' + o.id, 1)) remember(o, 'infinityBlocked'); }
			}
			for(const p of T.foreign()){
				if(!p || p._magicGone) continue;
				const r = best(p.x, p.y, 6, null, null, null);
				const B = r.bt; if(!B) continue;
				const dx = B.x - p.x, dy = B.y - p.y, d = Math.hypot(dx, dy) || 1, vr = ((p.vx || 0) * dx + (p.vy || 0) * dy) / d;
				if(vr > 0){ p.vx -= dx / d * vr * (1 - B.k); p.vy -= dy / d * vr * (1 - B.k); B.fl.st.energy -= vr * (1 - B.k) * foreignStrength(p) * dt * 0.02; }
				const floor = B.fl.r0 + 6;
				if(d < floor){ const push = Math.min(6, floor - d); p.x -= dx / d * push; p.y -= dy / d * push; }
			}
			const ents = enemies.concat(allies);
			for(const inst of W.instances) if(inst.owner && inst.owner.entity && ents.indexOf(inst.owner.entity) < 0) ents.push(inst.owner.entity);
			for(const e of ents){
				if(!e || e.dead) continue;
				const c = center(e), rad = Math.max(e.w || 30, e.h || 40) * 0.35;
				const r = best(c.x, c.y, rad, e, null, null);
				const B = r.bt, prev = W._infPrev.get(e);
				if(B && prev){
					const dx = B.x - c.x, dy = B.y - c.y, d = Math.hypot(dx, dy) || 1;
					const pd = dist(prev.x, prev.y, B.x, B.y), inward = pd - d;
					let back = inward > 0 ? inward * (1 - B.k) : 0;
					const floor = B.fl.r0 + rad;
					if(d < floor && pd >= floor - 1) back = Math.max(back, Math.min(12, floor - d));
					if(back > 0.01 && W.host.nudge) W.host.nudge(e, -dx / d * back, -dy / d * back);
				}
				const c2 = center(e); W._infPrev.set(e, { x: c2.x, y: c2.y });
			}
		}
		const isSelfT = (t) => !!t && (t.owner || t.kind === 'self' || t.kind === 'legs' || t.kind === 'arms');
		function bondHold(b){ const B = b.bond; return (8 + 9 * (B.str || 5)) * (1 + Math.sqrt(Math.max(0, b.amount)) / 12); }
		function bondKinetic(b){ const k = techOf(b, 'kinetic'); return Math.abs(k) >= CONFIG.tech.minIntensity ? Math.abs(k) : 0; }
		function snapBond(b, x, y, why){
			const col = bodyColors(b);
			W.rings.push({ x, y, r: 3, max: 30, age: 0, life: 14, color: col.mid });
			if(b.bond && b.bond.catch){ const c = b.bond.catch; if(c.ref){ c.ref.vx = c.vx; c.ref.vy = c.vy; } }
			b.bond = null; b._tgtPt = null; b._bendPt = null;
			remember(b, 'bondBroken');
			const inst = instById(b.inst); if(inst) logI(inst, 'Tether snapped — ' + why);
		}
		function bondTick(b, dt, f){
			const B = b.bond, tp = tgtPoint(b, B.t), ent = B.t.ref;
			b._tgtPt = tp;
			if(!tp){ b.bond = null; b._bendPt = null; return; }
			const k = (B.str || 5) / 5;
			const dx = b.x - tp.x, dy = b.y - tp.y, d = Math.hypot(dx, dy) || 1, ex = d - B.len;
			const bFree = !b.anchored && !b.attach && !b.immovable;
			const self = isSelfT(B.t);
			if(ex > 0){
				if(self){
					if(B.mode === 'pull'){
						// reels you in toward the energy (a grapple)
						const m = Math.min(ex * 0.3, 2.5 + 2.2 * k) * f;
						if(ent && W.host.nudge) W.host.nudge(ent, dx / d * m, dy / d * m);
						if(ent && dy < 0 && (ent.vy || 0) > 0) ent.vy *= 0.6;
					} else if(bFree){
						// trails after you
						const m = Math.min(ex * 0.25, 3 + 3 * k) * f;
						b.x -= dx / d * m; b.y -= dy / d * m;
					}
				} else if(ent && ent.foreign){
					// another caster's projectile on a leash
					const r = ent.ref, m = Math.min(ex * 0.25, 3 * k) * f;
					if(r){ r.x += dx / d * m; r.y += dy / d * m; }
					if(bFree){ b.x -= dx / d * m * 0.3; b.y -= dy / d * m * 0.3; }
				} else if(ent && ent.amount != null && ent.alive !== undefined){
					// energy bound to energy: both are drawn together; the larger one moves less
					const oFree = !ent.anchored && !ent.attach && !ent.immovable;
					const m = Math.min(ex * 0.25, 4 * k) * f;
					const ab = Math.max(1, b.amount), ao = Math.max(1, ent.amount);
					const sb = bFree ? (oFree ? ao / (ab + ao) : 1) : 0, so = oFree ? (bFree ? ab / (ab + ao) : 1) : 0;
					b.x -= dx / d * m * sb; b.y -= dy / d * m * sb;
					ent.x += dx / d * m * so; ent.y += dy / d * m * so;
				} else {
					// a creature: dragged back and slowed
					if(ent && ent.w != null && W.host.nudge) W.host.nudge(ent, dx / d * Math.min(ex * 0.35, 9 * k) * f, dy / d * Math.min(ex * 0.35, 9 * k) * f);
					if(bFree){ b.x -= dx / d * Math.min(ex * 0.2, 4) * f; b.y -= dy / d * Math.min(ex * 0.2, 4) * f; }
				}
			}
			if(!self && ent && ent.w != null && ent.amount == null && (b._bondSlow || 0) <= W.time){ b._bondSlow = W.time + 0.3; applyStatus(ent, 'slowed', Math.min(0.85, 0.3 + 0.05 * (B.str || 5)), 0.4); }
			b.amount -= 0.07 * (B.str || 5) * dt;      // holding a tether uses a little energy (more for a stronger one)
			tetherCuts(b, tp, dt, f);
		}
		function tetherCuts(b, tp, dt, f){
			const B = b.bond; if(!B) return;
			const ax = b.x, ay = b.y, vx = tp.x - ax, vy = tp.y - ay, L2 = vx * vx + vy * vy;
			const kin = bondKinetic(b);
			if(!B.catch && b._bendPt && !(b._bendUntil > W.time)) b._bendPt = null;
			// a kinetic cord holding a caught projectile: stretch, then let go
			if(B.catch){
				const c = B.catch, r = c.ref;
				if(!r || !W.host.foreignAlive(r)){ B.catch = null; b._bendPt = null; }
				else {
					c.age += dt;
					const q = Math.min(1, c.age / c.dur), px = ax + vx * c.u, py = ay + vy * c.u;
					const st = c.depth * Math.sin(q * Math.PI / 2);
					r.x = px + c.nx * st; r.y = py + c.ny * st; r.vx = 0; r.vy = 0;
					b._bendPt = { x: r.x, y: r.y };
					if(q >= 1){
						const out = c.sp * (1.25 + 0.25 * Math.min(2, kin));
						r.vx = -c.nx * out + c.tx * 0.3; r.vy = -c.ny * out + c.ty * 0.3;
						r._magicTurned = true; r._magicBend = 99; if(r.homing) r.homing = false;
						W.rings.push({ x: px, y: py, r: 4, max: 34, age: 0, life: 14, color: '#ffd84d' });
						B.catch = null; b._bendPt = null;
						b.amount *= 0.97;
					}
					return;
				}
			}
			if(L2 < 400) return;
			const hold = bondHold(b);
			const seen = B.seen || (B.seen = new Map());
			if(seen.size > 60) seen.clear();
			const cross = (x, y, rad) => {
				const u = ((x - ax) * vx + (y - ay) * vy) / L2;
				if(u < 0.06 || u > 0.94) return -1;
				const cx = ax + vx * u, cy = ay + vy * u;
				return Math.hypot(x - cx, y - cy) <= rad ? u : -1;
			};
			// your own (or any) energy flying through the cord
			for(const o of W.bodies){
				if(!o.alive || o === b || o === B.t.ref || o.isZone || o.zoneBlob || o.foreign) continue;
				const sp = Math.hypot(o.vx, o.vy); if(sp < 0.5) continue;
				const u = cross(o.x, o.y, bodyRadius(o) * 0.6 + 3); if(u < 0) continue;
				if((seen.get(o) || 0) > W.time) continue;
				seen.set(o, W.time + 0.4);
				const impact = Math.abs(bodyPower(o)) * (0.4 + sp / 8);
				if(kin > 0 && impact <= hold * 3 && !o.anchored && !o.attach && !o.immovable){
					// kinetic cord: energy (yours too) bounces off it like a rubber band
					const L = Math.sqrt(L2); let nx = -vy / L, ny = vx / L;
					if(nx * o.vx + ny * o.vy < 0){ nx = -nx; ny = -ny; }
					const vn = o.vx * nx + o.vy * ny, k = 1.15 + 0.15 * Math.min(2, kin);
					o.vx = (o.vx - 2 * vn * nx) * k; o.vy = (o.vy - 2 * vn * ny) * k;
					o.x -= nx * 4; o.y -= ny * 4; o.arrive = null; o.angleSet = false;
					if(o.guided && !o.follow) o.guided = false;
					W.rings.push({ x: ax + vx * u, y: ay + vy * u, r: 3, max: 22, age: 0, life: 12, color: '#ffd84d' });
					remember(b, 'reflected');
					continue;
				}
				if(impact > hold){ snapBond(b, ax + vx * u, ay + vy * u, 'struck by fast / strong energy'); return; }
			}
			// enemy magic
			const list = W.host.getForeignProjectiles ? (W.host.getForeignProjectiles() || []) : [];
			for(const r of list){
				if(!r || r._magicTurned || (B.t.ref && B.t.ref.foreign && B.t.ref.ref === r)) continue;
				const sp = Math.hypot(r.vx || 0, r.vy || 0); if(sp < 0.5) continue;
				const u = cross(r.x, r.y, Math.max(r.width || 8, r.height || 8) * 0.5 + 3); if(u < 0) continue;
				if((seen.get(r) || 0) > W.time) continue;
				seen.set(r, W.time + 0.6);
				const impact = Math.abs(r.power || r.damage || 10) * (0.4 + sp / 8);
				if(kin > 0 && impact <= hold * 3){
					// kinetic cord: catch it, stretch like a rubber band, fling it back
					const L = Math.sqrt(L2); let nx = -vy / L, ny = vx / L;
					if(nx * r.vx + ny * r.vy < 0){ nx = -nx; ny = -ny; }       // normal along the way it was travelling
					const tx = vx / L, ty = vy / L, along = (r.vx || 0) * tx + (r.vy || 0) * ty;
					B.catch = { ref: r, age: 0, dur: 0.16 + 0.1 * Math.min(1, sp / 10), u, nx, ny, tx: tx * along, ty: ty * along, sp, depth: clamp(sp * 5, 18, 60), vx: r.vx, vy: r.vy };
					remember(b, 'reflected');
					return;
				}
				if(impact > hold){ snapBond(b, ax + vx * u, ay + vy * u, 'struck by enemy magic'); return; }
			}
			// creatures touching the cord: an ordinary cord is part of the energy and strikes enemies that touch it;
			// a kinetic cord is solid to everything — creatures (you included) are thrown back off it
			const inst = instById(b.inst), me = inst && inst.owner ? inst.owner.entity : null;
			const ents = (W.host.getEnemies() || []).concat(W.host.getAllies() || []);
			if(kin > 0 && me && ents.indexOf(me) < 0) ents.push(me);
			const L = Math.sqrt(L2);
			for(const e of ents){
				if(!e || e.dead || e === B.t.ref) continue;
				if(b.attach && b.attach.target && b.attach.target.ref === e) continue;
				const c = center(e), rad = Math.max(e.w || 30, e.h || 40) * 0.42 + 3;
				const u = ((c.x - ax) * vx + (c.y - ay) * vy) / L2;
				if(u < 0.04 || u > 0.96) continue;
				const qx = ax + vx * u, qy = ay + vy * u, d = Math.hypot(c.x - qx, c.y - qy);
				if(d > rad) continue;
				const isEnemy = e !== me && (W.host.getEnemies() || []).indexOf(e) >= 0;
				if(kin > 0){
					let nx = -vy / L, ny = vx / L;
					if((c.x - qx) * nx + (c.y - qy) * ny < 0){ nx = -nx; ny = -ny; }      // push out on the side it is on
					if(W.host.nudge) W.host.nudge(e, nx * Math.min(8, rad - d + 1), ny * Math.min(8, rad - d + 1));
					if(T.every(e, 'kcord' + b.id, 0.25)){
						const k = (4 + 3 * Math.min(2, kin)) * (0.6 + 0.4 * (B.str || 5) / 5);
						if(W.host.knockback) W.host.knockback(e, nx * k, ny * k - 2, 12);
						W.rings.push({ x: qx, y: qy, r: 4, max: 28, age: 0, life: 12, color: '#ffd84d' });
						b._bendPt = { x: qx - nx * 10, y: qy - ny * 10 }; b._bendUntil = W.time + 0.15;      // the cord gives a little where it was hit
						if(isEnemy){ markStruck(b.inst, e); W.host.damageEnemy(e, Math.abs(bodyPower(b)) * CONFIG.damagePerPower * 0.2, { x: qx, y: qy, color: '#ffd84d', instance: b.inst }); }
						remember(b, 'reflected');
					}
				} else if(isEnemy && T.every(e, 'cord' + b.id, 0.5)){
					// the cord itself strikes: weaker than a direct hit, with the energy's own technique effects
					const info = { mult: 0.35, keep: true, cost: 0.02, noDamage: false, x: qx, y: qy };
					if(b.tech) for(const id in b.tech){ const s = b.tech[id]; if(Math.abs(s) < CONFIG.tech.minIntensity) continue; const dd = Techniques.get(id); if(dd && dd.onHit) dd.onHit(T, b, s, e, info); }
					markStruck(b.inst, e); remember(b, 'hitEnemy');
					if(!info.noDamage) W.host.damageEnemy(e, Math.abs(bodyPower(b)) * CONFIG.damagePerPower * info.mult, { x: qx, y: qy, color: bodyColors(b).mid, instance: b.inst });
					b.amount *= 1 - 0.02;
				}
			}
		}
		function tgtPoint(b, t){
			if(!t) return null;
			if(t.kind === 'self'){ const inst = instById(b.inst); return inst ? casterPosOf(inst) : null; }
			if(t.kind === 'spell' || t.kind === 'energy'){ const r = t.ref; if(r && (r.foreign ? W.host.foreignAlive(r.ref) : r.alive)) return r.foreign ? { x: r.ref.x, y: r.ref.y } : { x: r.x, y: r.y }; return null; }
			if(t.point) return t.point;
			if(t.ref){ if(t.ref.dead || (t.ref.hp != null && t.ref.hp <= 0)) return null; return center(t.ref); }
			return null;
		}
		/* energy waiting on "the spell hits" survives its hit and lodges in what it struck */
		const LODGE_CONDS = { spellHit: 1, targetHurt: 1, memory: 1, state: 1 };
		function waitsOnHit(b){
			const inst = instById(b.inst); if(!inst) return false;
			for(const br of inst.branches){
				if(br.state !== 'cond') continue;
				if(br.ctx.body !== b && !(br.ctx.group && br.ctx.group.some(m => m.body === b))) continue;
				const n = inst.def.nodes[br.nodeId], c = n && n.link && n.link.cond;
				if(c && LODGE_CONDS[c.type]) return true;
			}
			return false;
		}
		function reinfAnchor(st){
			if(st.kind === 'weapon'){
				const seg = W.host.weaponSegment ? W.host.weaponSegment({ id: st.ownerId }, st.ref) : null;
				if(seg) return { x: (seg.x0 + seg.x1) / 2, y: (seg.y0 + seg.y1) / 2 };
				const inst = instById(st.inst); return inst ? casterPosOf(inst) : null;
			}
			if(st.kind === 'spell' || st.kind === 'energy') return st.ref && st.ref.alive ? { x: st.ref.x, y: st.ref.y } : null;
			return st.ref ? center(st.ref) : null;
		}
		function updateReinforcement(dt){
			for(const b of W.bodies){ if(b.reinfStab) b.reinfStab = 0; if(b.reinfImpact) b.reinfImpact = 0; }
			if(!W.reinf.length) return;
			const R = CONFIG.reinforce, acc = new Map();
			let n = 0;
			for(let i = 0; i < W.reinf.length; i++){
				const st = W.reinf[i];
				const inst = st.item ? null : instById(st.inst);
				let end = st.item ? !!st.removed : (!inst || inst.done || W.time >= st.end);
				if(st.kind === 'self' || st.kind === 'ally' || st.kind === 'legs' || st.kind === 'arms') end = end || !st.ref || st.ref.dead || (st.kind === 'ally' && st.ref.hp != null && st.ref.hp <= 0);
				if(st.kind === 'spell' || st.kind === 'energy') end = end || !st.ref || !st.ref.alive;
				if(!st.passive && !st.item) st.energy -= (st.energy * R.upkeepFrac + R.upkeepFlat) * dt;      // passive / item reinforcement holds steady
				if(st.inf > 0 && !st.item) st.energy -= (1.5 * Math.pow(st.inf, 1.6) + st.energy * 0.04 * st.inf) * dt;      // an Infinity layer is a huge, constant commitment
				for(const id in st.tech){ const s = st.tech[id]; if(Math.abs(s) < CONFIG.tech.minIntensity) continue; const d = Techniques.get(id); if(d && d.reinforceTick) d.reinforceTick(T, st, s, dt); }
				if(st.energy < 0.8) end = true;
				if(end) continue;
				refreshReinf(st);
				W.reinf[n++] = st;
				if(st.props.illumination > 0.02){ const p = reinfAnchor(st); if(p) T.light(p.x, p.y, 120 + 160 * st.props.illumination, [255, 240, 200], 0.4 + 0.5 * st.props.illumination); }
				if(st.kind === 'spell' || st.kind === 'energy'){
					const a = acc.get(st.ref) || { s: 0, i: 0 };
					a.s += st.props.spellStability || 0; a.i += st.props.spellImpact || 0;
					acc.set(st.ref, a);
				}
			}
			W.reinf.length = n;
			acc.forEach((a, b) => { b.reinfStab = Reinforcement.combine(a.s, R.caps.spellStability); b.reinfImpact = Reinforcement.combine(a.i, R.caps.spellImpact); });
		}
		/* aggregated value of one property on a target (entity object, or a weapon key string) */
		W.reinforcedValue = function(target, prop){
			// each kind (yourself / legs / arms …) adds up on its own, softly capped by its own maximum if it has one
			const byKind = {};
			for(let i = 0; i < W.reinf.length; i++){
				const st = W.reinf[i];
				if(typeof target === 'string' ? st.key === target : st.ref === target){ const v = st.props[prop] || 0; if(v) byKind[st.kind] = (byKind[st.kind] || 0) + v; }
			}
			let tot = 0;
			for(const k in byKind){ const td = Reinforcement.targets[k], kc = td && td.kindCaps && td.kindCaps[prop]; tot += kc ? Reinforcement.combine(byKind[k], kc) : byKind[k]; }
			return tot > 0 ? Reinforcement.combine(tot, CONFIG.reinforce.caps[prop] || 1) : 0;
		};
		W.weaponKey = function(ownerId, weaponId){ return 'weapon:' + ownerId + ':' + weaponId; };
		W.reinforcementsOn = function(target){ return W.reinf.filter(st => typeof target === 'string' ? st.key === target : st.ref === target); };
		/* a melee strike landed: technique states inside the striker's reinforcement act on the creature hit */
		W.onMeleeHit = function(ownerId, weaponId, ent, ev){
			const key = W.weaponKey(ownerId, weaponId);
			for(const st of W.reinf){
				if(!(st.key === key || ((st.kind === 'self' || st.kind === 'arms') && st.ownerId === ownerId))) continue;
				for(const id in st.tech){
					const s = st.tech[id]; if(Math.abs(s) < CONFIG.tech.minIntensity) continue;
					const d = Techniques.get(id);
					if(d && d.onReinforcedHit) d.onReinforcedHit(T, st, s, ent, ev || {});
				}
			}
		};

		/* ---------- ZONE LAWS: a zone with a technique changes the rules inside it ----------
		   Each technique decides what its zone does (def.zone(T, Z, s, dt) with Z = { z, x, y, r, k, owner }; k is the
		   law's strength 0…1 from the technique's intensity, weakened by Anti-Magic suppression). The engine gathers the
		   laws, gives techniques helpers to act on what is inside, and keeps a few per-frame marks:
		     body._zf      { light, dark, leak, noLeak } — read by speed / leak / drawing
		     creature._zm  { gravity, speed }            — read by the host (W.zoneMod(ent, key))
		     _zKin         speed multiplier that ramps up (Kinetic) or down (reverse) while something stays inside */
		W.zoneLaws = []; W.darks = []; W.brights = [];
		const ZONE_SEEN = new Set(), KIN_SET = new Set();
		function zoneK(z, s){ return clamp(Math.abs(s) / 1.2, 0.15, 1) * (1 - clamp(z.amSupp || 0, 0, 1)); }
		function zoneCreatures(){
			const out = [], seen = new Set();
			for(const inst of W.instances){ const e = inst.owner && inst.owner.entity; if(e && !seen.has(e) && (!inst.owner.alive || inst.owner.alive())){ seen.add(e); out.push(e); } }
			for(const e of (T.enemies || [])) if(e && !e.dead && !seen.has(e)){ seen.add(e); out.push(e); }
			for(const e of (T.allies || [])) if(e && !e.dead && !seen.has(e)){ seen.add(e); out.push(e); }
			return out;
		}
		function zoneMods(ent){ if(!ent) return null; if(!ent._zm || ent._zmF !== W.frame){ ent._zm = { gravity: 1, speed: ent._zKin || 1 }; ent._zmF = W.frame; ZONE_SEEN.add(ent); } return ent._zm; }
		const ZF_SET = new Set();
		function zoneFlags(b){ if(!b._zf){ b._zf = {}; ZF_SET.add(b); } return b._zf; }
		/* the signed strength of every law of a technique at a point (overlapping zones add up, capped) */
		function zoneLaw(x, y, id){
			let v = 0;
			for(const L of W.zoneLaws){ const s = L.tech[id]; if(!s) continue; const dx = x - L.x, dy = y - L.y; if(dx * dx + dy * dy <= L.r * L.r) v += Math.sign(s) * L.k; }
			return clamp(v, -1.5, 1.5);
		}
		W.zoneLaw = zoneLaw;
		W.zoneMod = function(ent, key){ return ent && ent._zm && ent._zmF >= W.frame - 1 ? (ent._zm[key] == null ? 1 : ent._zm[key]) : 1; };
		function kinStep(obj, law, dt){
			// Kinetic: faster the longer it stays inside (reverse: slower); outside it eases back to normal
			const cur = obj._zKin || 1;
			const target = law > 0 ? 1 + 0.9 * law : (law < 0 ? 1 / (1 + 0.9 * -law) : 1);
			const rate = law ? 0.35 : 1.0;
			const next = cur < target ? Math.min(target, cur + rate * dt) : Math.max(target, cur - rate * dt);
			obj._zKin = next;
			if(Math.abs(next - 1) < 0.001){ obj._zKin = 1; KIN_SET.delete(obj); } else KIN_SET.add(obj);
		}
		function zonePass(dt){
			W.zoneLaws.length = 0; W.darks.length = 0; W.brights.length = 0;
			for(const b of ZF_SET) b._zf = null;
			ZF_SET.clear();
			for(const ent of ZONE_SEEN) if(ent._zmF !== W.frame) ent._zm = null;
			ZONE_SEEN.clear();
			for(const z of W.bodies){
				if(!z.alive || !z.isZone || !z.tech) continue;
				const tech = {}; let any = false;
				for(const id in z.tech){ const s = z.tech[id]; const d = Techniques.get(id); if(d && d.zone && Math.abs(s) >= CONFIG.tech.minIntensity){ tech[id] = s; any = true; } }
				if(!any) continue;
				const k = zoneK(z, Math.max(...Object.values(tech).map(Math.abs)));
				if(k <= 0.01) continue;
				W.zoneLaws.push({ z, x: z.x, y: z.y, r: z.zoneRadius, k, tech, owner: z.ownerId });
			}
			const kinTouched = new Set();
			if(W.zoneLaws.length){
				for(const L of W.zoneLaws) for(const id in L.tech){
					const d = Techniques.get(id);
					try { d.zone(T, { z: L.z, x: L.x, y: L.y, r: L.r, k: L.k, owner: L.owner }, L.tech[id], dt); } catch(e){ magicError('zone ' + id, e, L.z); }
				}
				// Kinetic laws: everything inside ramps toward its speed
				if(W.zoneLaws.some(L => L.tech.kinetic)){
					const inside = (x, y) => zoneLaw(x, y, 'kinetic');
					for(const e of zoneCreatures()){ const c = center(e); const law = inside(c.x, c.y); if(law){ kinStep(e, law, dt); kinTouched.add(e); zoneMods(e).speed = e._zKin; } }
					for(const b of W.bodies){ if(!b.alive || b.isZone || b.zoneBlob || b.immovable) continue; const law = inside(b.x, b.y); if(law){ kinStep(b, law, dt); kinTouched.add(b); } }
					for(const p of (W.host.getForeignProjectiles() || [])){ if(!p) continue; const law = inside(p.x, p.y); if(law){ kinStep(p, law, dt); p._zSpeed = p._zKin; kinTouched.add(p); } }
				}
			}
			for(const o of Array.from(KIN_SET)){
				if(kinTouched.has(o)) continue;
				kinStep(o, 0, dt);
				if(o._zSpeed != null) o._zSpeed = o._zKin;                  // a projectile
				else if(o.amount == null) zoneMods(o).speed = o._zKin;     // a creature easing back to normal speed
			}
		}
		/* helpers the techniques' zone laws use */
		Object.assign(T, {
			zoneLaw,
			zoneCreatures(Z){ const out = []; for(const e of zoneCreatures()){ const c = center(e); if(c && (c.x - Z.x) * (c.x - Z.x) + (c.y - Z.y) * (c.y - Z.y) <= Z.r * Z.r) out.push(e); } return out; },
			zoneBodies(Z){ return T.nearBodies(Z.x, Z.y, Z.r, Z.z).filter(o => o.zoneOf !== Z.z); },
			zoneForeign(Z){ return (W.host.getForeignProjectiles() || []).filter(p => p && !p._magicGone && (p.x - Z.x) * (p.x - Z.x) + (p.y - Z.y) * (p.y - Z.y) <= Z.r * Z.r); },
			zoneMod(ent, key, v){ const m = zoneMods(ent); if(m) m[key] = (m[key] == null ? 1 : m[key]) * v; },
			zoneFlag(b, key, v){ const f = zoneFlags(b); f[key] = key === 'leak' ? Math.max(f[key] || 1, v) : (typeof v === 'number' ? Math.max(f[key] || 0, v) : v); },
			dark(x, y, r, k){ W.darks.push({ x, y, r, k }); },
			bright(x, y, r, k, c){ W.brights.push({ x, y, r, k, c }); },
			isOwner(ent, ownerId){ for(const inst of W.instances) if(inst.owner && inst.owner.id === ownerId && inst.owner.entity === ent) return true; return false; }
		});
		/* ---------- technique behaviour on each energy body ---------- */
		function techFieldSrc(b){
			const r = b.isZone ? b.zoneRadius : (b.focus && b.focus.kind === 'surface' ? 50 + bodyRadius(b) * 2 : 80 + bodyRadius(b) * 2.5);
			return { x: b.x, y: b.y, r, P: T.power(b) * (1 - clamp(b.amSupp || 0, 0, 1)), body: b, tech: {}, zone: !!b.isZone };
		}
		function techTick(b, dt){
			b.hitScale = 1; b.techSpeedCap = 0;
			if(!b.tech) return;
			const fieldy = b.isZone || (b.focus && (b.focus.kind === 'environment' || b.focus.kind === 'surface'));
			let src = null, total = 0;
			for(const id in b.tech){
				const s = b.tech[id];
				if(Math.abs(s) < CONFIG.tech.minIntensity) continue;
				const d = Techniques.get(id);
				if(!d) continue;
				if(b.isZone && d.zone) continue;      // a zone with this technique works through its zone law (see zonePass)
				if(d.tick) d.tick(T, b, s);
				if(fieldy && d.field && !(b.amSupp > 0.85)){
					if(!src) src = techFieldSrc(b);
					src.tech[id] = s; total += Math.abs(s);
					d.field(T, src, s);
				}
			}
			if(src){
				W.fields.push(src);
				// manipulating the surroundings uses the energy up
				const k = CONFIG.tech.fieldDrain * total * dt;
				if(b.isZone) b.fieldCharge = Math.max(0, (b.fieldCharge || 0) * (1 - k) - 0.05 * dt);
				else b.amount -= b.amount * k;
			}
		}
		/* a creature's hit box, asked of the host once per frame (every energy body checks every creature) */
		function frameRect(e){
			if(e._mhrF === W.frame && e._mhr) return e._mhr;
			const r = W.host.hitRect(e);
			try { e._mhrF = W.frame; e._mhr = r; } catch(err){}
			return r;
		}
		/* the world's bodies sorted into grid cells, built once per frame (only used when there is a crowd) */
		function bodyGrid(){
			const G = W._grid;
			if(G && G.frame === W.frame && G.ref === W.bodies) return G;
			const C = CONFIG.perf.gridCell, m = new Map(), arr = W.bodies;
			for(let i = 0; i < arr.length; i++){
				const o = arr[i]; o._gi = i;
				if(!o.alive || o.isZone) continue;
				const k = Math.floor(o.x / C) * 73856093 ^ Math.floor(o.y / C) * 19349663;
				let cell = m.get(k); if(!cell) m.set(k, cell = []); cell.push(o);
			}
			return (W._grid = { frame: W.frame, ref: arr, n: arr.length, m, cell: C });
		}
		/* opposite states of the same technique cancel by magnitude when their energy meets */
		function techniqueInteractions(){
			const tb = [];
			for(const b of W.bodies) if(b.alive && !b.isZone && hasTech(b)) tb.push(b);
			if(tb.length < 2) return;
			const rad = new Float32Array(tb.length), pos = new Uint32Array(tb.length), neg = new Uint32Array(tb.length), act = new Uint8Array(tb.length);
			let maxR = 0;
			const bit = W._techBit || (W._techBit = new Map());
			for(let i = 0; i < tb.length; i++){
				const b = tb[i]; rad[i] = bodyRadius(b); if(rad[i] > maxR) maxR = rad[i];
				// which states it carries (+ / −), and whether any of them reacts to meeting other energy
				for(const id in b.tech){
					const s = b.tech[id]; if(!s) continue;
					let k = bit.get(id); if(k == null){ k = 1 << (bit.size % 31); bit.set(id, k); }
					if(s > 0) pos[i] |= k; else neg[i] |= k;
					const d = Techniques.get(id); if(d && d.interact) act[i] = 1;
				}
			}
			let anyP = 0, anyN = 0, anyA = 0;
			for(let i = 0; i < tb.length; i++){ anyP |= pos[i]; anyN |= neg[i]; anyA |= act[i]; }
			if(!anyA && !(anyP & anyN)) return;      // no opposite states anywhere and nothing that reacts: nothing to do
			// with a crowd only nearby pairs are checked (a grid of cells at least as wide as two radii); same pairs, same order
			let pairs = null;
			if(tb.length >= CONFIG.perf.gridAt){
				const C = Math.max(48, maxR * 2), m = new Map();
				for(let i = 0; i < tb.length; i++){ const k = Math.floor(tb[i].x / C) * 73856093 ^ Math.floor(tb[i].y / C) * 19349663; let cell = m.get(k); if(!cell) m.set(k, cell = []); cell.push(i); }
				pairs = [];
				for(let i = 0; i < tb.length; i++){
					const cx = Math.floor(tb[i].x / C), cy = Math.floor(tb[i].y / C), js = [];
					for(let ox = -1; ox <= 1; ox++) for(let oy = -1; oy <= 1; oy++){ const cell = m.get((cx + ox) * 73856093 ^ (cy + oy) * 19349663); if(cell) for(const j of cell) if(j > i && (act[i] || act[j] || ((pos[i] & neg[j]) | (neg[i] & pos[j])))) js.push(j); }
					if(js.length > 1) js.sort((p, q) => p - q);
					for(let q = 0; q < js.length; q++) if(q === 0 || js[q] !== js[q - 1]) pairs.push(i, js[q]);
				}
			}
			const nP = pairs ? pairs.length / 2 : tb.length * (tb.length - 1) / 2;
			for(let p = 0, i = 0, j = 1; p < nP; p++){
				if(pairs){ i = pairs[p * 2]; j = pairs[p * 2 + 1]; }
				else if(p > 0){ j++; if(j >= tb.length){ i++; j = i + 1; } }
				if(!act[i] && !act[j] && !((pos[i] & neg[j]) | (neg[i] & pos[j]))) continue;      // nothing that could cancel or react
				const a = tb[i], c = tb[j];
				const dx = a.x - c.x, dy = a.y - c.y, rr = rad[i] + rad[j];
				if(dx * dx + dy * dy > rr * rr) continue;
				// opposing spatial behaviour held by Infinity does not simply cancel: Infinity decides what happens (see infinityMeet)
				if((a.infSource || a.infDerived) && (c.infSource || c.infDerived)){ const pa = spatialPolarity(a); if(pa && pa === -spatialPolarity(c)) continue; }
				for(const id in a.tech){
					const sa = a.tech[id], sc = techOf(c, id);
					if(!sa || !sc || Math.sign(sa) === Math.sign(sc)) continue;
					const ea = Math.abs(sa) * a.amount, ec = Math.abs(sc) * c.amount;
					const m = Math.min(ea, ec);
					if(m <= 0) continue;
					a.tech[id] = Math.sign(sa) * (ea - m) / Math.max(0.001, a.amount);
					c.tech[id] = Math.sign(sc) * (ec - m) / Math.max(0.001, c.amount);
					if(Math.abs(a.tech[id]) < CONFIG.tech.minIntensity) a.tech[id] = 0;
					if(Math.abs(c.tech[id]) < CONFIG.tech.minIntensity) c.tech[id] = 0;
					const d = Techniques.get(id);
					if(d && d.onCancel) d.onCancel(T, a, c, m);
					else W.rings.push({ x: (a.x + c.x) / 2, y: (a.y + c.y) / 2, r: 4, max: 34, age: 0, life: 16, color: '#ffffff' });
				}
				for(const id in a.tech){ const d = Techniques.get(id); if(d && d.interact && Math.abs(a.tech[id]) >= CONFIG.tech.minIntensity) d.interact(T, a, a.tech[id], c); }
				for(const id in c.tech || {}){ const d = Techniques.get(id); if(d && d.interact && Math.abs(c.tech[id]) >= CONFIG.tech.minIntensity) d.interact(T, c, c.tech[id], a); }
			}
		}

		/* ---------- per-frame update ---------- */
		W._infPrev = new WeakMap(); W._infFields = [];
		/* how much a creature's own Infinity layer weighs it down (1 = not at all) */
		W.infinitySlow = function(ent){ let L = 0; for(const st of W.reinf) if(st.ref === ent && st.inf > 0 && (st.kind === 'self' || st.kind === 'ally')) L = Math.max(L, st.inf); return 1 / (1 + 0.12 * L); };
		W.infinityFields = function(){ return W._infFields || []; };
		/* A runtime error anywhere in the magic update must never freeze the game: the energy that was being
		   handled when it happened is removed (it fizzles), the error is kept for the host to show, and if errors
		   keep coming every frame the caster's spells are ended so the game recovers. */
		W.errors = []; W._errStreak = 0;
		function magicError(where, e, b){
			const msg = (e && e.message) || String(e);
			const at = e && e.stack ? String(e.stack).split('\n').slice(1, 3).map(s => s.trim().replace(/^at /, '')).join(' ← ') : '';
			const rec = { t: W.time, where, msg, at, body: b ? { id: b.id, amount: Math.round(b.amount || 0), tech: techList(b) || 'raw', shape: b.shape, comp: b.comp || 0, zone: !!b.isZone } : null };
			W.lastError = rec; W.errors.push(rec); if(W.errors.length > 20) W.errors.shift();
			if(W.host && W.host.onMagicError){ try { W.host.onMagicError(rec); } catch(err){} }
			return rec;
		}
		W.update = function(dt, host){
			try { updateWorld(dt, host); W._errStreak = 0; }
			catch(e){
				const b = W._curBody && W._curBody.alive ? W._curBody : null;
				magicError('update', e, b);
				if(b){ try { b.alive = false; b.dying = 0.0001; b.deathWhy = 'error'; const inst = instById(b.inst); if(inst && !b.zoneBlob) inst.bodyCount = Math.max(0, inst.bodyCount - 1); } catch(err){} }
				if(++W._errStreak > 30){
					// the same failure every frame and no culprit to remove: end every spell so the game recovers
					for(const inst of W.instances.slice()){ try { endInstance(inst, 'error'); } catch(err){ inst.done = true; } }
					W.instances = W.instances.filter(i => !i.done); W.reinf.length = 0; W._errStreak = 0;
					magicError('recovered', { message: 'Magic kept failing — every active spell was ended' }, null);
				}
			}
			W._curBody = null;
		};
		function updateWorld(dt, host){
			if(host) W.host = withDefaults(host);
			if(!W.host) W.host = withDefaults({});
			dt = dt || 1 / 60;
			W.frame++; W.time += dt;
			const f = dt * 60;
			T.dt = dt; T.f = f; T.time = W.time;
			W.fields.length = 0; W.lights.length = 0;

			// 1) spell instances (creation order → deterministic)
			for(let i = 0; i < W.instances.length; i++){
				const inst = W.instances[i];
				inst.age += dt;
				if(inst.age >= inst.lifetime){ endInstance(inst, 'lifetime'); continue; }
				let any = false;
				for(const br of inst.branches){
					if(br.state === 'delay'){
						br.wait -= dt;
						if(br.wait <= 0){ br.state = 'run'; any = true; }
					} else if(br.state === 'hold'){
						const H = br.hold;
						const api = inst._api || (inst._api = makeApi(inst));
						api.host = W.host;
						H.elapsed += dt;
						let r = null;
						try { r = H.tick ? H.tick(api, br, dt) : null; } catch(e){ r = 'fail'; }
						let ended = false, stop = false;
						if(r === 'fail' || r === 'done' || H.elapsed >= H.time){ const er = H.end ? H.end() : undefined; ended = er === false; stop = er === 'stop'; }
						if(stop){ br.hold = null; br.state = 'done'; br.note = 'complete'; }
						else if(r === 'fail' || ended){ br.hold = null; br.state = 'done'; if(!br.note) br.note = (H.label || 'channel') + (r === 'fail' ? ' broken' : ' failed'); }
						else if(r === 'done' || H.elapsed >= H.time){ br.hold = null; br.state = 'resume'; any = true; }
					} else if(br.state === 'cond'){
						br.condAge += dt;
						const node = inst.def.nodes[br.nodeId];
						const to = clamp(num(node.link.cond.timeout, CONFIG.condTimeoutDefault), 0.5, CONFIG.condTimeoutMax);
						if(br.condAge > to){ br.state = 'done'; br.note = 'condition never met'; logI(inst, 'Condition timed out'); continue; }
						if(++br.condTick % CONFIG.condCheckFrames !== 0) continue;
						const r = checkCond(inst, br);
						if(r === true){ br.state = 'run'; any = true; }
						else if(r === 'fail'){ br.state = 'done'; br.note = 'condition can never be met'; }
					}
				}
				if(any || inst._needPump){ inst._needPump = false; pumpInstance(inst); }
			}

			// zone tallies: a zone's energy is the sum of its untouched blobs
			for(const b of W.bodies) if(b.isZone){ b._sum = 0; b._n = 0; }
			for(const b of W.bodies) if(b.alive && b.zoneBlob && b.zoneOf){ b.zoneOf._sum += b.amount; b.zoneOf._n++; }
			for(const b of W.bodies) if(b.isZone && b.alive){ b.blobN = b._n; b.amount = b._sum; if(b.amSupp > 0) b.amSupp = Math.max(0, b.amSupp - 0.04 * dt); }
			// 2) energy bodies
			const enemies = W.host.getEnemies() || [];
			const allies = W.host.getAllies() || [];
			T.enemies = enemies; T.allies = allies;
			updateReinforcement(dt);
			zonePass(dt);
			infinitySourcePass(dt);
			infinityPass(dt, f, enemies, allies);
			let liveN = 0;
			for(const b of W.bodies) if(b.alive && !b.isZone) liveN++;
			const sparkK = liveN > 30 ? 30 / liveN : 1;      // many bodies → each one throws fewer idle sparks
			W._sparkCap = liveN > 60 ? CONFIG.perf.sparkCrowd : 480;       // and the world keeps fewer of them
			for(let i = 0; i < W.bodies.length; i++){
				const b = W.bodies[i];
				if(!b.alive){ b.dying += dt; continue; }
				W._curBody = b;
				b.age += dt;
				if(b.dieAt && W.time >= b.dieAt){ killBody(b, 'fade'); continue; }      // energy given a set life (e.g. one blob of a beam) simply fades
				// zones fade after a minute, taking the energy nobody touched with them
				if(b.isZone && b.age >= CONFIG.zoneLifetime){ killBody(b, 'leak'); continue; }
				if(b.zoneBlob && b.zoneOf && !b.zoneOf.alive){ killBody(b, 'leak'); continue; }
				if(b.morph < 1) b.morph = Math.min(1, b.morph + dt * 2.2);
				if(b.flash > 0) b.flash = Math.max(0, b.flash - dt * 3);
				// motion
				if(b.attach){
					const t = b.attach.target; let tp = null;
					if(t.kind === 'self'){ const inst = W.instances.find(x => x.id === b.inst); tp = inst ? (inst._api ? inst._api.casterPos() : inst.lastCaster) : null; }
					else if(t.kind === 'spell' || t.kind === 'energy'){ const r = t.ref; if(r && (r.foreign ? W.host.foreignAlive(r.ref) : r.alive)) tp = r.foreign ? { x:r.ref.x, y:r.ref.y } : { x:r.x, y:r.y }; }
					else if(t.ref){ tp = center(t.ref); }
					if(tp){ b.x = tp.x + b.attach.ox; b.y = tp.y + b.attach.oy; }
				} else if(!b.anchored){
					if(b.toInventory){
						// flying into your inventory: home on you, then become (or feed) a magical item
						const inst = instById(b.inst), c = inst ? casterPosOf(inst) : null;
						if(c){
							const ax = c.x - b.x, ay = c.y - b.y, ad = Math.hypot(ax, ay) || 1, sp = Math.max(6, Math.hypot(b.vx, b.vy));
							b.vx = ax / ad * sp; b.vy = ay / ad * sp;
							if(ad < bodyRadius(b) + 26){
								const res = W.host.storeMagicItem ? W.host.storeMagicItem(itemFromBody(b), inst.owner, b) : 'No inventory to store it in';
								if(res === true){
									W.rings.push({ x: c.x, y: c.y, r: 6, max: 44, age: 0, life: 18, color: bodyColors(b).mid });
									killBody(b, 'stored'); continue;
								}
								b.toInventory = false; b.vx = 0; b.vy = 0; b.guided = false;
								if(inst) logI(inst, String(res || 'Could not store it'));
								if(W.host.say) W.host.say(String(res || 'Could not store it'));
							}
						}
					}
					if(b.held){
						// bound by Binding reinforcement: frozen in place for a moment, then released with its old motion
						if(W.time < b.held.until){ b.vx = 0; b.vy = 0; }
						else { b.vx = b.held.vx; b.vy = b.held.vy; b.held = null; }
					}
					if(b.follow){
						// Guided: keeps steering after its target
						const tp = tgtPoint(b, b.follow);
						if(!tp) b.follow = null;
						else {
							const dx = tp.x - b.x, dy = tp.y - b.y, d = Math.hypot(dx, dy) || 1, sp = Math.max(4, Math.hypot(b.vx, b.vy));
							const k = Math.min(1, 0.14 * f);
							b.vx += (dx / d * sp - b.vx) * k; b.vy += (dy / d * sp - b.vy) * k;
						}
					}
					if(b.heavy) b.vy += 0.12 * b.heavy * f;       // weighed down by Gravity reinforcement: it arcs downward
					if(b.lift) b.vy -= 0.08 * b.lift * f;         // lightened by reverse Gravity: it floats up
					if(b.arrive && !(b.locks && b.locks.direction)){
						const ax = b.arrive.x - b.x, ay = b.arrive.y - b.y;
						const ad = Math.hypot(ax, ay);
						const as = b.arrive.speed || CONFIG.baseSpeed;
						if(ad <= Math.max(2.5, as * 0.35)){
							b.x = b.arrive.x; b.y = b.arrive.y;
							b.vx = 0; b.vy = 0; b.arrive = null;
						} else {
							const slowR = Math.max(36, as * 11);
							const s = ad < slowR ? Math.max(0.35, as * (ad / slowR)) : as;
							b.vx = ax / ad * s; b.vy = ay / ad * s;
						}
					}
					let mvx = b.vx, mvy = b.vy;
					if(b._infF){
						const F = b._infF, dx = F.x - b.x, dy = F.y - b.y, d = Math.hypot(dx, dy) || 1, vr = (mvx * dx + mvy * dy) / d;
						if(vr > 0){ mvx -= dx / d * vr * (1 - F.k); mvy -= dy / d * vr * (1 - F.k); }
					}
					if(b._zKin && b._zKin !== 1){ mvx *= b._zKin; mvy *= b._zKin; }      // a Kinetic zone speeds it up over time (reverse: slows it)
					b.x += mvx * f; b.y += mvy * f;
				}
				// Bound: a tether — the target cannot get farther than its length (it is dragged back and slowed)
				if(b.bond || (b.bondsX && b.bondsX.length)){
					// one or more tethers, each handled on its own
					const list = [ b.bond ].concat(b.bondsX || []).filter(Boolean), keep = [];
					for(const B of list){
						b.bond = B; b._tgtPt = B._tp || null; b._bendPt = B._bend || null; b._bendUntil = B._bendUntil || 0;
						bondTick(b, dt, f);
						if(b.bond){ B._tp = b._tgtPt; B._bend = b._bendPt; B._bendUntil = b._bendUntil; keep.push(B); }
						if(!b.alive) break;
					}
					b.bond = keep[0] || null; b.bondsX = keep.length > 1 ? keep.slice(1) : null;
					if(!b.alive) continue;
				}
				if(b.slide && b.slide.n > 0 && !b.attach){ b.x += b.slide.x * Math.min(f, b.slide.n); b.y += b.slide.y * Math.min(f, b.slide.n); b.slide.n -= f; if(b.slide.n <= 0) b.slide = null; }
				// Rotate: continuous spin (until the spell ends) or a set turn in progress
				if(b.spin) applyTurn(b, b.spin.rate * dt, b.spin.shape, b.spin.path);
				if(b.turn){
					let a = b.turn.rate * dt * Math.sign(b.turn.left);
					if(Math.abs(a) >= Math.abs(b.turn.left)) a = b.turn.left;
					b.turn.left -= a;
					applyTurn(b, a, b.turn.shape, b.turn.path);
					if(Math.abs(b.turn.left) < 1e-5) b.turn = null;
				}
				const spd = Math.sqrt(b.vx*b.vx + b.vy*b.vy);
				if(spd > 0.3 && !(b.locks && b.locks.direction && b.angleSet)){
					// faces where it travels, plus any rotation a Rotate rune gave it
					const ta = Math.atan2(b.vy, b.vx) + (b.angleOffset || 0);
					b.angle = (b.spin || b.turn) ? ta : lerpAngle(b.angle, ta, Math.min(1, 0.35 * f)); b.angleSet = true;
				}
				// leak (raw energy is unstable)
				let leak = b.zoneBlob ? CONFIG.leakZone : (b.anchored || b.attach ? CONFIG.leakAnchored : (spd > 0.3 ? CONFIG.leakMoving : CONFIG.leakIdle));
				if(!b.isZone && !b.zoneBlob) leak *= b.scale < 1 ? 0.65 : 1 + (b.scale - 1) * 0.25;
				if(b.reinfStab) leak *= 1 - b.reinfStab;          // reinforced spells hold together
				if(b.over) leak *= 0.6 / (1 + 3 * overK(b));      // over-compressed energy holds together far longer
				if(b.infSource) leak = 0;                         // an Infinity source never runs dry
				if(b._zf && b._zf.leak) leak *= b._zf.leak;        // an Anti-Magic zone: magic withers much faster
				if(b.keepEnergy) leak = 0;                        // a portal / surface lasts its set time instead
				if(b.amount > (b.peakAmt || 0)) b.peakAmt = b.amount;
				if(b.zoneBlob && b.zoneOf && b.zoneOf.amSupp > 0) b.amount -= b.amount * 0.6 * b.zoneOf.amSupp * dt;      // a suppressed zone cannot hold what it drew
				if(!b.charging && !b.isZone && !(b._zf && b._zf.noLeak)) b.amount -= (b.amount * leak * (b.zoneBlob ? 0.5 : 1) * dt + (b.zoneBlob ? 0.004 : 0.02) * dt) * CONFIG.leakScale;      // reverse Anti-Magic zone: your magic does not shrink
				if(b.small > 0 && !b.zoneBlob) b.small = Math.max(0, b.small - dt * 3);     // a claimed blob grows into normal size
				if(b.grow < 1) b.grow = Math.min(1, (b.grow || 0) + dt * 4);
				if(b.amount < CONFIG.minEnergy && !b.charging && !b.isZone && !b.drawing){ killBody(b, 'leak'); continue; }
				if(b.comp > 0 && !b.isZone && !b.charging && b.amount < compMin(b.comp)){ collapseBody(b); continue; }
				// over-compressed energy is a little unstable until it is safely in your inventory
				if(b.comp > 10 && !b.toInventory && !(b.stabilized > b.age) && !b.infSource){
					const o = overK(b);
					b.amount -= b.amount * 0.003 * o * dt;
					if(Math.random() < dt * (0.8 + 4 * o)){ const a = Math.random() * Math.PI * 2; spark(b.x, b.y, Math.cos(a) * 2.5, Math.sin(a) * 2.5, b, 10 + Math.random() * 8); }
				}
				// bounds
				if(!W.host.inBounds(b.x, b.y)){ killBody(b, 'bounds'); continue; }
				// techniques: each state on this energy does its part (motion, fields, …)
				if(b.tech){ techTick(b, dt); if(!b.alive) continue; }
				// speed range for this kind of energy (Light never drops below 12 while it travels)
				if(!b.held && !b.arrive && !b.toInventory){
					const rg = speedRange(b), sp2 = Math.hypot(b.vx, b.vy);
					if(sp2 > rg.hi){ const k = rg.hi / sp2; b.vx *= k; b.vy *= k; }
					else if(rg.lo > 0 && sp2 > 0.3 && sp2 < rg.lo){ const k = rg.lo / sp2; b.vx *= k; b.vy *= k; }
				}
				if(b.rupture){ ruptureTick(b, dt, f, enemies); continue; }      // a spatial rupture: erases what it touches (passes through walls)
				if(b.isZone || b.zoneBlob) continue;     // untouched blobs just sit there, harmless
				if(b.noContact) continue;                // e.g. a portal: it is no longer energy that strikes
				const r = bodyRadius(b);
				// surface contact
				const probe = b.surfaceProbe != null ? b.surfaceProbe : 0.5;      // how far ahead of its centre it meets a surface (a slash only at its centre)
				const onSurf = !b.attach && W.host.isSolid(b.x + Math.sign(b.vx) * r * probe, b.y + Math.sign(b.vy) * r * probe);
				if(onSurf && !b._surfWas) remember(b, 'hitSurface');      // spell memory: one collision per contact
				b._surfWas = onSurf;
				if(onSurf){
					b.touchedSurface = true;
					let how = null;
					if(b.tech) for(const id in b.tech){
						const s = b.tech[id]; if(Math.abs(s) < CONFIG.tech.minIntensity) continue;
						const d = Techniques.get(id); const res = d && d.onSurface ? d.onSurface(T, b, s) : null;
						if(res === 'pass' || (res && !how)) how = res;
					}
					if(how === 'pass'){ /* the energy slips through the surface */ }
					else if(how === 'reflect'){
						const bx = W.host.isSolid(b.x + Math.sign(b.vx) * r * 0.5, b.y), by = W.host.isSolid(b.x, b.y + Math.sign(b.vy) * r * 0.5);
						b.x -= b.vx * f; b.y -= b.vy * f;
						if(bx || !by) b.vx = -b.vx;
						if(by) b.vy = -b.vy;
						b.angleSet = false; b.amount *= 0.96;
					}
					else if(how === 'rest' || (b.infSource && !how)){ b.x -= b.vx * f; b.y -= b.vy * f; b.vx = 0; b.vy = 0; b.anchored = true; }      // strong Infinity is not undone by a wall: it holds there as a barrier
					else if(b.surfaceMode === 'stick' || b.anchored){
						b.x -= b.vx * f; b.y -= b.vy * f; b.vx = 0; b.vy = 0; b.anchored = true;
						for(const inst of W.instances) if(inst.id === b.inst) for(const br of inst.branches) if(br.ctx.target && br.ctx.target.kind === 'surface' && br.ctx.body === b) br.ctx.target.point = { x: b.x, y: b.y };
					} else { killBody(b, 'surface'); continue; }
				}
				if(b.infSource) continue;                // a reservoir, not an attack: it does not strike what it touches
				// energy working on its surroundings (a technique field) acts through the field, not by striking
				if(b.focus && (b.focus.kind === 'environment' || b.focus.kind === 'surface') && hasTech(b)) continue;
				// contact: a hit is remembered so Draw Out can pull from that creature.
				// Enemies (and other players treated as enemies) take damage. Allies are only marked.
				let hit = false;
				for(let pass = 0; pass < 2 && !hit; pass++){
					const list = pass === 0 ? enemies : allies;
					const hurt = pass === 0;
					for(let j = 0; j < list.length; j++){
						const e = list[j];
						if(!e || e.dead) continue;
						if(b.attach && b.attach.target && b.attach.target.ref === e) continue;
						if(b.bond && b.bond.t && b.bond.t.ref === e) continue;          // what it is tethered to, it holds — it does not strike
						const hr = frameRect(e);
						// quick reject: nowhere near the creature's box (a shape reaches at most ~2.6 radii from its centre)
						const reach = r * (b.hitScale || 1) * 2.6;
						if(b.x < hr.x - reach || b.x > hr.x + hr.w + reach || b.y < hr.y - reach || b.y > hr.y + hr.h + reach) continue;
						const hp = shapeHit(b, r * (b.hitScale || 1), hr);
						if(!hp) continue;
						if(b.hitIds && (b.hitIds.get(e) || 0) > W.time) continue;     // energy that passed through recently
						markStruck(b.inst, e);
						if(!hurt) continue;
						remember(b, 'hitEnemy');
						// techniques shape the contact (heat burns, kinetic shoves, binding holds, light pierces …)
						const info = { mult: 1, keep: !!b.pierce, cost: b.pierce ? 0 : 0.25, noDamage: false, x: hp.x, y: hp.y };
						if(b.tech) for(const id in b.tech){
							const s = b.tech[id]; if(Math.abs(s) < CONFIG.tech.minIntensity) continue;
							const d = Techniques.get(id); if(d && d.onHit) d.onHit(T, b, s, e, info);
						}
						if(b.heavy) info.mult *= 1 + 0.4 * Math.min(3, b.heavy);
						if(b.burnOnHit) applyStatus(e, 'burn', Math.abs(bodyPower(b)) * 0.04 * b.burnOnHit, 2.5);
						if(b.chillOnHit) applyStatus(e, 'chill', Math.min(1.2, 0.3 * b.chillOnHit), 2);
						// over-compressed energy pierces straight through, losing only a little each time
						if(b.over > 0 && !info.noDamage){ const ok = overK(b); info.keep = true; info.cost = Math.min(info.cost, 0.15 - 0.1 * ok); info.mult *= 1 + 0.35 * ok; }
						const dmg = info.noDamage ? 0 : (b.hitDamage != null ? b.hitDamage : Math.abs(bodyPower(b)) * CONFIG.damagePerPower * info.mult * (1 + (b.reinfImpact || 0)) * overDamp(b));      // energy emitted with a set damage per hit (a beam's blobs) keeps it
						if(dmg > 0) W.host.damageEnemy(e, dmg, { x: hp.x, y: hp.y, color: bodyColors(b).mid, instance: b.inst, vx: b.vx, vy: b.vy });
						if(info.keep){
							(b.hitIds || (b.hitIds = new Map())).set(e, W.time + 0.45);
							b.amount *= 1 - info.cost;
							if(b.amount < CONFIG.minEnergy){ killBody(b, 'impact'); hit = true; }
							break;
						}
						if(waitsOnHit(b)){
							// the branch is waiting for this hit: the energy lodges in the creature instead of bursting
							const c = center(e);
							b.attach = { target: { kind: 'enemy', ref: e }, ox: hp.x - c.x, oy: hp.y - c.y };
							b.vx = 0; b.vy = 0; b.anchored = false; b.follow = null; b.lodged = true;
							remember(b, 'lodged');
							(b.hitIds || (b.hitIds = new Map())).set(e, W.time + 1e6);      // it has struck this one; from now on it holds it
							b.amount *= 0.85;
							break;
						}
						hit = true; break;
					}
				}
				// energy an enemy's gravity / portal took hold of can strike you too
				if(!hit && b.hostile && W.host.hurtCaster){
					const inst = instById(b.inst), me = inst && inst.owner ? inst.owner.entity : null;
					if(me && !(b.hitIds && (b.hitIds.get(me) || 0) > W.time)){
						const hp = shapeHit(b, r * (b.hitScale || 1), W.host.hitRect(me));
						if(hp){ W.host.hurtCaster(me, Math.abs(bodyPower(b)) * CONFIG.damagePerPower, { x: hp.x, y: hp.y, color: bodyColors(b).mid }); hit = !(b.over > 0); (b.hitIds || (b.hitIds = new Map())).set(me, W.time + 0.6); }
					}
				}
				if(hit){ killBody(b, 'impact'); continue; }
				// secondary sparks
				if(Math.random() < 0.18 * f * sparkK * (b.scale >= 1 ? 1 : 0.5)){
					const a = Math.random() * Math.PI * 2;
					spark(b.x + Math.cos(a) * r * 0.9, b.y + Math.sin(a) * r * 0.9, Math.cos(a) * 0.6 - b.vx * 0.2, Math.sin(a) * 0.6 - b.vy * 0.2, b, 14 + Math.random() * 12);
				}
			}
			// technique energy interacting with other technique energy (generic; technique defs decide)
			W._curBody = null;
			coalesceRaw(dt);
			techniqueInteractions();
			updateStatuses(dt);
			updateForeignMods(dt, f);

			// remove dead bodies after their fade
			if(W.frame % 4 === 0) W.bodies = W.bodies.filter(b => b.alive || b.dying < 0.35);

			// 3) finished instances (every spell's output in one pass over the bodies)
			const outBy = new Map();
			for(const b of W.bodies) if(b.alive && !b.isZone && !b.zoneBlob && !b.drawnOut) outBy.set(b.inst, (outBy.get(b.inst) || 0) + Math.abs(bodyPower(b)));
			for(let i = 0; i < W.reinf.length; i++){ const st = W.reinf[i]; outBy.set(st.inst, (outBy.get(st.inst) || 0) + st.energy * st.density * (1 + 0.5 * (st.inf || 0))); }
			for(const inst of W.instances){
				inst.outputUsed = outBy.get(inst.id) || 0;
				const live = inst.branches.some(br => br.state !== 'done');
				if(!live){
					// the spell is finished (no runes left, no conditions waiting, nothing drawing): its zones dissipate
					for(const z of W.bodies){
						if(!z.alive || !z.isZone || z.inst !== inst.id) continue;
						if(W.zoneLaws.some(L => L.z === z)) continue;      // a zone with a technique keeps its law for its whole lifetime
						if(W.bodies.some(o => o.alive && o.drawing && o.zoneOf === z)){ z._idleT = 0; continue; }
						z._idleT = (z._idleT || 0) + dt;
						if(z._idleT >= 0.5){ killBody(z, 'leak'); logI(inst, 'Zone dissipated — the spell is finished'); }
					}
				}
				if(!live && inst.bodyCount <= 0 && !W.reinf.some(st => st.inst === inst.id)) inst.done = true;
			}
			if(W.instances.some(i => i.done)) W.instances = W.instances.filter(i => !i.done);

			regenAmbient(dt);
			updateFx(f);
			if(W.rings.length > CONFIG.perf.ringCap) W.rings.splice(0, W.rings.length - CONFIG.perf.ringCap);      // the oldest flashes go first
			if(W.lights.length > CONFIG.perf.lightCap) mergeLights();
		}
		/* many small lights close together → one light each (the lighting pass costs per light) */
		function mergeLights(){
			const C = 140, m = new Map(), out = [];
			for(const L of W.lights){
				const k = Math.floor(L.x / C) * 73856093 ^ Math.floor(L.y / C) * 19349663;
				let M = m.get(k);
				if(!M){ M = { x: 0, y: 0, w: 0, r: 0, i: 0, c: L.c, n: 0 }; m.set(k, M); out.push(M); }
				const w = L.i * L.r; M.x += L.x * w; M.y += L.y * w; M.w += w; M.r = Math.max(M.r, L.r); M.i = Math.max(M.i, L.i); M.n++;
			}
			W.lights.length = 0;
			// still too many: only the strongest are kept (each one is a full lighting pass)
			if(out.length > CONFIG.perf.lightCap){ out.sort((a, b) => b.w - a.w); out.length = CONFIG.perf.lightCap; }
			for(const M of out){ const w = M.w || 1; W.lights.push({ x: M.x / w, y: M.y / w, r: M.r * (M.n > 1 ? 1.15 : 1), i: Math.min(1, M.i * (M.n > 1 ? 1.1 : 1)), c: M.c }); }
		}

		function capBodySpeed(b){
			const s = Math.hypot(b.vx, b.vy);
			if(s > CONFIG.maxSpeed){ const k = CONFIG.maxSpeed / s; b.vx *= k; b.vy *= k; }
		}
		function retargetBody(from, to){
			for(const inst of W.instances){
				for(const br of inst.branches){
					const ctx = br.ctx;
					if(!ctx) continue;
					if(ctx.body === from) ctx.body = to;
					if(ctx.target && ctx.target.ref === from) ctx.target.ref = to;
					if(!ctx.group) continue;
					const seen = new Set();
					ctx.group = ctx.group.filter(m => {
						if(!m) return false;
						if(m.body === from) m.body = to;
						if(m.target && m.target.ref === from) m.target.ref = to;
						if(!m.body || seen.has(m.body)) return false;
						seen.add(m.body);
						return true;
					});
					if(ctx.group.length < 2) ctx.group = null;
				}
			}
		}
		function mergeRaw(keep, drop){
			if(!keep.alive || !drop.alive || keep === drop) return;
			if(keep.drawnFrom === drop.id || drop.drawnFrom === keep.id) return;      // energy drawn out of another stays separate from it
			if(keep.infFrom || drop.infFrom){
				const ids = new Set([].concat(keep.infFromList || (keep.infFrom ? [ keep.infFrom ] : []), drop.infFromList || (drop.infFrom ? [ drop.infFrom ] : [])));
				keep.infFromList = Array.from(ids); if(!keep.infFrom) keep.infFrom = keep.infFromList[0];
				if(drop.infDerived) keep.infDerived = true;
			}
			if(drop.zoneHome && !keep.zoneHome) keep.zoneHome = drop.zoneHome;
			const total = keep.amount + drop.amount;
			const traj = keep.guided && drop.guided ? (keep.arrive ? keep : (drop.arrive ? drop : keep)) : (keep.guided ? keep : (drop.guided ? drop : null));
			if(traj && !(keep.locks && keep.locks.direction)){
				keep.vx = traj.vx; keep.vy = traj.vy;
				keep.guided = true;
				keep.arrive = traj.arrive ? { x: traj.arrive.x, y: traj.arrive.y, speed: traj.arrive.speed } : null;
				if(!traj.anchored) keep.anchored = false;
				capBodySpeed(keep);
			} else if(total > 0 && !keep.anchored && !drop.anchored && !(keep.locks && keep.locks.direction)){
				keep.vx = (keep.vx * keep.amount + drop.vx * drop.amount) / total;
				keep.vy = (keep.vy * keep.amount + drop.vy * drop.amount) / total;
				capBodySpeed(keep);
			}
			if(keep.tech || drop.tech){
				const ids = {}; for(const k in keep.tech || {}) ids[k] = 1; for(const k in drop.tech || {}) ids[k] = 1;
				const nt = {};
				for(const k in ids) nt[k] = total > 0 ? (techOf(keep, k) * keep.amount + techOf(drop, k) * drop.amount) / total : 0;
				keep.tech = nt;
			}
			keep.amount = total;
			keep.mergeCount = (keep.mergeCount || 0) + 1 + (drop.mergeCount || 0);
			if(drop.mem){ keep.mem = keep.mem || {}; for(const k in drop.mem) keep.mem[k] = Math.max(keep.mem[k] || 0, drop.mem[k]); }
			if(drop.over) keep.over = Math.max(keep.over || 0, drop.over);
			if(drop._ranNodes){ keep._ranNodes = keep._ranNodes || {}; for(const k in drop._ranNodes) if(!keep._ranNodes[k]) keep._ranNodes[k] = drop._ranNodes[k]; }
			if(drop.spawned) keep.spawned = true;
			const n = 8;
			for(let i = 0; i < n; i++){
				const a = (i / n) * Math.PI * 2;
				spark(drop.x, drop.y, (keep.x - drop.x) * 0.12 + Math.cos(a) * 0.4, (keep.y - drop.y) * 0.12 + Math.sin(a) * 0.4, keep, 16);
			}
			W.rings.push({ x: keep.x, y: keep.y, r: bodyRadius(drop), max: bodyRadius(keep) + 10, age: 0, life: 12, color: bodyColors(keep).mid });
			retargetBody(drop, keep);
			killBody(drop, 'merge');
		}
		function nudgeNatural(b, nx, ny, step){
			if(b.guided || (b.locks && b.locks.direction)) return;
			b.x += nx * step;
			b.y += ny * step;
		}
		/* Environmental energy from the same caster drifts together slowly, then merges only when it actually meets. */
		function coalesceRaw(dt){
			const raw = [];
			for(const b of W.bodies){
				if(!b.alive || b.isZone || b.foreign || b.technique || b.attach || b.drawing || !b.ownerId || b.immovable || b.spatial || b.noContact || b.infSource) continue;
				if(b.flowId){ raw.push(b); continue; }                     // pieces of one Draw Out flow (any kind: they were one energy)
				if(!techCombines(b)) continue;
				if(!b.natural && !(b.spawned && b.guided)) continue;      // generated energy joins only where it is sent to the same point
				raw.push(b);
			}
			if(raw.length < 2) return;
			const f = (dt || 1 / 60) * 60;
			const aimOf = (b) => b.aim || b.arrive || null;
			const sameAim = (a, b) => {
				const pa = aimOf(a), pb = aimOf(b);
				return !!(pa && pb && Math.hypot(pa.x - pb.x, pa.y - pb.y) < 16);
			};
			const atAim = (b) => {
				const p = aimOf(b);
				return !!(p && Math.hypot(b.x - p.x, b.y - p.y) <= 28);
			};
			// spatial grid (cells ≥ the 56px reach) so this is ~linear instead of every pair
			const CELL = 120, grid = new Map();
			for(let i = 0; i < raw.length; i++){
				const o = raw[i]; o._ci = i;
				const key = (Math.floor(o.x / CELL) * 73856093) ^ (Math.floor(o.y / CELL) * 19349663);
				let cell = grid.get(key); if(!cell) grid.set(key, cell = []); cell.push(o);
			}
			const near = [];
			for(let i = 0; i < raw.length; i++){
				const a = raw[i];
				if(!a.alive) continue;
				near.length = 0;
				const gx = Math.floor(a.x / CELL), gy = Math.floor(a.y / CELL);
				for(let ox = -1; ox <= 1; ox++) for(let oy = -1; oy <= 1; oy++){
					const cell = grid.get(((gx + ox) * 73856093) ^ ((gy + oy) * 19349663));
					if(cell) for(const o of cell) if(o._ci > i) near.push(o);
				}
				for(let j = 0; j < near.length; j++){
					const b = near[j];
					if(!a.alive || !b.alive || a.ownerId !== b.ownerId) continue;
					if(techKey(a) !== techKey(b)) continue;          // only the same kind of energy combines
					// pieces of the same Draw Out flow: while they stream they stay apart; once both have slowed right down
					// (stopped, arrived, or nearly still) they draw together and become one energy again
					const mates = !!a.flowId && a.flowId === b.flowId;
					const rest = mates && Math.hypot(a.vx, a.vy) < 1.2 && Math.hypot(b.vx, b.vy) < 1.2 && !a.anchored === !b.anchored;
					if(mates && !rest && !(a.guided && b.guided && sameAim(a, b) && atAim(a) && atAim(b))) continue;
					if(!mates && (a.flowId || b.flowId) && !(a.natural && b.natural)) continue;
					// A redirect keeps its course. Natural energy may combine with it only after both have reached that point.
					const bothHome = a.guided && b.guided && sameAim(a, b) && atAim(a) && atAim(b);
					if(!mates && (a.guided || b.guided || !a.natural || !b.natural) && !bothHome) continue;
					const dx = b.x - a.x, dy = b.y - a.y;
					const d = Math.hypot(dx, dy) || 0.001;
					const reach = mates ? 120 : (bothHome ? 56 : 14);
					if(d > reach) continue;
					const meet = mates ? Math.max(24, (bodyRadius(a) + bodyRadius(b)) * 0.7) : (bothHome ? 40 : 8);
					if(mates && d > meet){
						// resting pieces of one flow pull straight together (even if a Redirect left them guided)
						const k = Math.min(0.5, 0.06 + 0.25 * (1 - d / reach)) * f, nx = dx / d, ny = dy / d;
						if(!a.anchored){ a.x += nx * Math.min(d / 2, 6 * k); a.y += ny * Math.min(d / 2, 6 * k); }
						if(!b.anchored){ b.x -= nx * Math.min(d / 2, 6 * k); b.y -= ny * Math.min(d / 2, 6 * k); }
						continue;
					}
					if(d <= meet){
						const keep = a.amount >= b.amount ? a : b;
						const drop = keep === a ? b : a;
						mergeRaw(keep, drop);
						continue;
					}
					const nx = dx / d, ny = dy / d;
					const nearK = 1 - d / reach;
					const g = 0.16 * nearK * nearK * f;
					nudgeNatural(a, nx, ny, g);
					nudgeNatural(b, -nx, -ny, g);
				}
			}
		}

		function endInstance(inst, why){
			for(const br of inst.branches) if(br.state !== 'done'){ br.state = 'done'; br.note = why; }
			for(const b of W.bodies) if(b.alive && b.inst === inst.id) killBody(b, 'leak');
			if(W.reinf.length) W.reinf = W.reinf.filter(st => st.inst !== inst.id);
			inst.done = true;
		}
		/* Energy put straight into the world by the host — e.g. the stream of blobs a compressed Light / darkness weapon
		   fires as its beam. No runes: each blob belongs to a small emitter instance of the owner's, so it is ordinary
		   energy to everything else (its techniques act, Anti-Magic erases it, gravity bends it, portals carry it …).
		   o = { owner, profile, host, key, x, y, vx, vy, amount, scale, tech, life (s), hitDamage, source } */
		W.emitEnergy = function(o){
			o = o || {};
			if(o.host) W.host = withDefaults(o.host);
			if(!W.host) W.host = withDefaults({});
			const owner = o.owner || { id: 'player', entity: null }, key = String(o.key || 'emit');
			let inst = W.instances.find(i => i.emitKey === key && i.owner.id === owner.id && !i.done);
			if(!inst){
				inst = { id: W.nextId++, def: { nodes: {}, rootId: null }, kids: {}, owner, profile: o.profile || deriveProfile({}),
					budget: 0, paid: 0, drained: 0, age: 0, lifetime: CONFIG.lifetime, branches: [], bodyCount: 0, nextBranch: 1,
					outputUsed: 0, maxOutput: Infinity, done: false, struck: new Set(), lastCaster: null, exec: {}, log: [],
					seed: (W.nextId * 2654435761) >>> 0, steps: 0, spawnAt: null, passive: false, emitKey: key, maxBodies: CONFIG.perf.emitMax };
				const cp = owner.entity ? center(owner.entity) : { x: num(o.x, 0), y: num(o.y, 0) };
				inst.lastCaster = { x: cp.x, y: cp.y };
				W.instances.push(inst);
			}
			inst.age = 0;                 // an emitter lasts as long as it keeps emitting
			const b = createBody(inst, num(o.x, 0), num(o.y, 0), Math.max(CONFIG.minEnergy * 2, num(o.amount, 4)), o.source || 'generated', null);
			if(!b) return null;
			b.vx = num(o.vx, 0); b.vy = num(o.vy, 0); b.spawned = true; b.emitted = key;
			if(o.tech){ b.tech = {}; for(const k in o.tech) if(Techniques.get(k) && isFinite(o.tech[k])) b.tech[k] = o.tech[k]; }
			if(o.scale) b.scale = clamp(num(o.scale, 1), 0.05, 4);
			if(o.life) b.dieAt = W.time + Math.max(0.05, num(o.life, 1));
			if(o.hitDamage != null) b.hitDamage = Math.max(0, num(o.hitDamage, 0));
			if(o.pierce) b.pierce = true;
			if(o.surfaceProbe != null) b.surfaceProbe = clamp(num(o.surfaceProbe, 0.5), 0, 1);
			if(o.speedBonus) b.speedBonus = Math.max(0, num(o.speedBonus, 0));      // may travel faster than raw energy's limit                                     // passes through what it strikes (each creature once)
			if(o.shape && SHAPES[o.shape]){ b.shape = b.shapePrev = o.shape; b.form = b.formPrev = clamp(num(o.form, 1), 0, 1); b.morph = 1; }
			if(o.radius) b.formRadius = clamp(num(o.radius, 20), 2, 400);      // a set size (and reach) instead of one from its energy
			if(b.vx || b.vy){ b.angle = Math.atan2(b.vy, b.vx); b.angleSet = true; }
			b.age = 0.17;                 // already formed: it leaves at full size
			recomputeOutput(inst);
			return b;
		};
		/* an enemy's gravity / portal took hold of your energy: from now on it can hit you as well */
		W.turnHostile = function(b){ if(b && !b.foreign && b.alive) b.hostile = true; };
		W.endInstance = function(inst){ if(inst && !inst.done){ endInstance(inst, 'stopped'); W.instances = W.instances.filter(i => !i.done); } };
		/* a magical item's built-in reinforcement (the effects of the energy it is made of) — lives until removed */
		W.addItemReinforcement = function(ownerId, weaponRef, item, profile, host){
			const td = Reinforcement.targets.weapon; if(!td || !item) return null;
			if(!W.host && host) W.host = withDefaults(host);
			const eff = Reinforcement.efficiency(profile || null);
			const st = {
				id: W.nextId++, inst: null, item: true, passive: true, ownerId, kind: 'weapon', ref: weaponRef, key: W.weaponKey(ownerId, weaponRef.id),
				energy: Math.max(1, item.amount) * eff, invested: item.amount, density: densityFactor(item.scale || 0.1), efficiency: eff,
				tech: item.tech ? Object.assign({}, item.tech) : {}, start: W.time, end: Infinity, itemData: item, inf: num(item.inf, 0),
				strength: 0, props: {}, color: bodyColors({ tech: item.tech, over: item.over, source: 'generated' }), seed: Math.random() * 1000
			};
			refreshReinf(st);
			W.reinf.push(st);
			return st;
		};
		W.removeItemReinforcement = function(st){ if(st){ st.removed = true; W.reinf = W.reinf.filter(x => x !== st); } };
		W._sparkCap = 480;
		W.clear = function(){ W.instances.length = 0; W.bodies.length = 0; W.sparks.length = 0; W.rings.length = 0; W.ambient.clear(); W.reinf.length = 0; W.status.clear(); W.fields.length = 0; W.fmods.clear(); W.lights.length = 0; };
		/* end every spell a caster has running (the game binds this to O) */
		W.clearOwner = function(ownerId){
			let n = 0;
			for(const inst of W.instances) if(inst.owner && inst.owner.id === ownerId && !inst.done){ endInstance(inst, 'cleared'); n++; }
			if(n) W.instances = W.instances.filter(i => !i.done);
			return n;
		};

		/* ---------- secondary fx ---------- */
		function markStruck(instId, ent){
			if(!ent) return;
			const inst = W.instances.find(i => i.id === instId);
			if(!inst) return;
			if(!inst.struck) inst.struck = new Set();
			inst.struck.add(ent);
			inst.strikes = (inst.strikes || 0) + 1;
		}
		function takeFromBody(body, want){
			if(!body || !(want > 0)) return 0;
			if(body.foreign){
				const ref = body.ref;
				const pool = num(ref && (ref.dmg != null ? ref.dmg : (ref.damage != null ? ref.damage : ref.power)), body.amount || 0);
				const got = Math.min(want, Math.max(0, pool));
				if(ref && got > 0){
					if(ref.dmg != null) ref.dmg = Math.max(0, ref.dmg - got);
					else if(ref.damage != null) ref.damage = Math.max(0, ref.damage - got);
					else if(ref.power != null) ref.power = Math.max(0, ref.power - got);
				}
				return got;
			}
			if(!body.alive) return 0;
			const got = Math.min(want, Math.max(0, body.amount));
			body.amount -= got;
			if(body.amount < CONFIG.minEnergy && !body.isZone) killBody(body, 'drawn');
			return got;
		}
		function receiveDrawn(api, br, amt, source){
			if(!(amt > 0)) return 0;
			const z = br.ctx.zone && br.ctx.zone.alive ? br.ctx.zone : null;
			if(z){
				const placed = depositZone(z, amt);
				if(placed < 0.5){ api.fail('The zone cannot hold more energy'); return false; }
				return placed;
			}
			const b = br.ctx.body;
			if(b && !b.foreign && !b.isZone && api.bodyValid(b)){
				const dens = (densityFactor(b.scale) * techMult(b)) || 1;
				const cap = (api.outputHeadroom() + Math.abs(bodyPower(b))) / dens;
				const add = Math.min(amt, Math.max(0, cap - b.amount));
				if(add < 1){ api.fail('Max Output reached'); return false; }
				b.amount += add;
				return add;
			}
			const head = api.outputHeadroom();
			const finalAmt = Math.min(amt, head);
			if(finalAmt < 1){ api.fail('Max Output reached'); return false; }
			const pos = api.targetPos(br) || api.refPoint(br);
			const nb = createBody(api.instance, pos.x, pos.y, finalAmt, source || 'drawn');
			if(!nb){ api.fail('Too much active energy'); return false; }
			br.ctx.body = nb;
			return finalAmt;
		}
		function beginDraw(inst, api, br, source, noZone){
			const z = !noZone && br.ctx.zone && br.ctx.zone.alive ? br.ctx.zone : null;
			let b = null;
			if(z) b = spawnZoneBlob(z, 0);
			else {
				const pos = api.targetPos(br) || api.refPoint(br);
				b = createBody(inst, pos.x, pos.y, 0, source || 'drawn');
			}
			if(b){ b.drawing = true; b.amount = 0; b.drawnOut = true; if(source === 'environment') b.natural = true; }
			return b;
		}
		function addDrawn(b, amt){
			if(!b || !b.alive || !(amt > 0)) return 0;
			if(b.zoneBlob || b.isZone || b.drawnOut){ b.amount += amt; return amt; }
			const dens = (densityFactor(b.scale) * techMult(b)) || 1;
			const inst = W.instances.find(i => i.id === b.inst);
			if(inst) recomputeOutput(inst);
			const head = inst ? Math.max(0, inst.maxOutput - inst.outputUsed) : amt;
			const cap = (head + Math.abs(bodyPower(b))) / dens;
			const add = Math.min(amt, Math.max(0, cap - b.amount));
			if(add <= 0) return 0;
			b.amount += add;
			if(inst) recomputeOutput(inst);
			return add;
		}
		function depositZone(z, amt){
			let left = amt, guard = 0;
			const piece = CONFIG.zoneBlob;
			while(left >= 0.5 && guard++ < 48){
				const take = Math.min(piece, left);
				if(!spawnZoneBlob(z, take)){
					let host = null;
					for(const o of W.bodies) if(o.alive && o.zoneBlob && o.zoneOf === z){ host = o; break; }
					if(!host) break;
					host.amount += left;
					left = 0;
					break;
				}
				left -= take;
			}
			return amt - left;
		}

		/* ---------- zone blobs: small raw energy bodies that condense inside a zone ---------- */
		function spawnZoneBlob(z, amt){
			const blobCap = Math.min(220, Math.max(CONFIG.zoneMaxBlobs, Math.round(28 * zoneDrawMul(z.zoneRadius))));
			if((z.blobN || 0) >= blobCap) return null;
			const inst = W.instances.find(i => i.id === z.inst); if(!inst) return null;
			let x = 0, y = 0, okPos = false, spread = false;
			for(let k = 0; k < 14 && !spread; k++){
				const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * z.zoneRadius * 0.92;
				x = z.x + Math.cos(a) * r; y = z.y + Math.sin(a) * r;
				okPos = !(W.host.isSolid && W.host.isSolid(x, y)) && (!W.host.inBounds || W.host.inBounds(x, y));
				if(!okPos) continue;
				spread = true;
				const near = W.bodies.length >= CONFIG.perf.gridAt ? T.nearBodies(x, y, 26, null) : W.bodies;
				for(const o of near){
					if(!o.alive || o.zoneOf !== z) continue;
					if(Math.hypot(o.x - x, o.y - y) < 26){ spread = false; break; }
				}
			}
			if(!okPos) return null;
			const b = createBody(inst, x, y, amt, 'zone');
			if(!b) return null;
			inst.bodyCount = Math.max(0, inst.bodyCount - 1);     // untouched blobs belong to the zone, not the spell's body limit
			b.zoneBlob = true; b.zoneOf = z; b.anchored = true; b.small = 1; b.grow = 0;
			z.blobN = (z.blobN || 0) + 1;
			W.rings.push({ x, y, r: 2, max: 16, age: 0, life: 14, color: bodyColors(b).mid });
			for(let i = 0; i < 4; i++){ const a = Math.random() * Math.PI * 2; spark(x + Math.cos(a) * 14, y + Math.sin(a) * 14, -Math.cos(a) * 1.1, -Math.sin(a) * 1.1, b, 14); }
			return b;
		}
		function zoneKind(b, z){
			if(!b || !z || !z.tech) return;
			const t = {}; let any = false;
			for(const id in z.tech){ const s = z.tech[id]; const d = Techniques.get(id); if(d && !d.layer && Math.abs(s) >= CONFIG.tech.minIntensity){ t[id] = s; any = true; } }
			if(!any) return;
			b.tech = t;
			b.zoneHome = { id: z.id, x: z.x, y: z.y };      // Spatial energy from a zone opens its portal back to the zone once enough is stored
		}
		function claimBlob(b, byInst){
			b.zoneBlob = false; b.claimed = true;
			if(b.zoneOf && b.zoneOf.alive && b.zoneOf.tech) zoneKind(b, b.zoneOf);
			const inst = W.instances.find(i => i.id === b.inst);
			if(inst) inst.bodyCount++;
		}
		function gatherZoneBlobs(z, to, max){
			let got = 0;
			const list = W.bodies.filter(b => b.alive && b.zoneBlob && b.zoneOf === z)
				.sort((a, b) => dist(a.x, a.y, to.x, to.y) - dist(b.x, b.y, to.x, to.y));
			for(const b of list){
				if(got + b.amount * CONFIG.zoneCollect > max + 0.5) break;
				got += b.amount * CONFIG.zoneCollect;
				// the blob streaks to the gather point
				const life = 22 + Math.random() * 10, k = 1 / ((1 - Math.pow(0.94, life)) / 0.06);
				for(let i = 0; i < 3; i++) spark(b.x, b.y, (to.x - b.x) * k * (0.9 + i * 0.05), (to.y - b.y) * k * (0.9 + i * 0.05), b, life);
				killBody(b, 'gathered');
			}
			return got;
		}
		function spark(x, y, vx, vy, b, life){
			if(W.sparks.length > W._sparkCap) return;
			const c = bodyColors(b);
			W.sparks.push({ x, y, vx, vy, age: 0, life: life || 20, color: Math.random() < 0.4 ? c.core : c.mid, size: 1 + Math.random() * 2 });
		}
		function updateFx(f){
			const sp = W.sparks; let n = 0;
			const damp = Math.pow(0.94, f);
			for(let i = 0; i < sp.length; i++){
				const s = sp[i]; s.age += f; s.x += s.vx * f; s.y += s.vy * f; s.vx *= damp; s.vy *= damp;
				if(s.age < s.life) sp[n++] = s;
			}
			sp.length = n;
			for(let i = W.rings.length - 1; i >= 0; i--){
				const r = W.rings[i]; r.age += f;
				if(r.age >= r.life) W.rings.splice(i, 1);
			}
		}

		/* ---------- rendering ---------- */
		W.draw = function(ctx, camX, camY, viewW, viewH){
			ctx.save();
			try { drawWorld(ctx, camX, camY, viewW, viewH); }
			catch(e){ const b = W._drawBody; if(b) b._drawErr = true; magicError('draw', e, b); }
			finally { ctx.restore(); W._drawBody = null; }
		};
		function drawWorld(ctx, camX, camY, viewW, viewH){
			camX = camX || 0; camY = camY || 0;
			viewW = viewW || ctx.canvas.width; viewH = viewH || ctx.canvas.height;
			const t = W.time;
			ctx.save();
			ctx.shadowBlur = 0; ctx.setLineDash([]);
			W._camX = camX; W._camY = camY;
			// zones first (underlay)
			for(const b of W.bodies){ if(b.isZone) drawZone(ctx, b, b.x - camX, b.y - camY, t, W.host && W.host.isSolid); }
			drawZoneLaws(ctx, camX, camY, viewW, viewH, t);
			// technique fields (heat haze, gravity wells …) under the energy
			for(const src of W.fields){
				const x = src.x - camX, y = src.y - camY;
				if(x < -src.r || y < -src.r || x > viewW + src.r || y > viewH + src.r) continue;
				for(const id in src.tech){ const d = Techniques.get(id); if(d && d.drawField){ ctx.save(); d.drawField(ctx, src, x, y, src.tech[id], t); ctx.restore(); } }
			}
			ctx.globalCompositeOperation = 'lighter';
			for(const r of W.rings){
				const k = r.age / r.life, rad = r.r + (r.max - r.r) * easeOut(k);
				const x = r.x - camX, y = r.y - camY;
				if(x < -rad || y < -rad || x > viewW + rad || y > viewH + rad) continue;
				ctx.globalAlpha = (1 - k) * (r.fill ? 0.35 : 0.8);
				if(r.fill){ const g = ctx.createRadialGradient(x, y, 0, x, y, rad); g.addColorStop(0, 'rgba(255,255,255,0.0)'); g.addColorStop(0.7, r.color); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill(); }
				ctx.strokeStyle = r.color; ctx.lineWidth = 2 + 3 * (1 - k);
				ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.stroke();
			}
			// visible bodies first, so the draw can pick its level of detail
			const vis = W._vis || (W._vis = []);
			vis.length = 0;
			for(const b of W.bodies){
				if(b.isZone) continue;
				const x = b.x - camX, y = b.y - camY, R = bodyRadius(b) * 2.6;
				if(!b.hideBody && (x < -R || y < -R || x > viewW + R || y > viewH + R)) continue;
				vis.push(b);
			}
			LOD_CROWD = vis.length;
			const crowd = LOD_CROWD > CONFIG.perf.crowdAt && LOD_ENABLED.on && typeof document !== 'undefined';
			STAMP_M.m = null;
			for(let i = 0; i < vis.length; i++){
				const b = vis[i];
				if(b._drawErr) continue;
				W._drawBody = b;
				// a crowd of technique energy: each one is stamped from cached frames of its look (body + technique overlays)
				if(crowd && stampCrowd(ctx, b, b.x - camX, b.y - camY, t)){ b._stampT = t; continue; }
				drawBody(ctx, b, b.x - camX, b.y - camY, t);
			}
			// each technique state shows itself on the energy that carries it
			const lod = LOD_CROWD > 30;
			for(let i = 0; i < vis.length; i++){
				const b = vis[i];
				if(!b.tech || !b.alive || b._stampT === t || b._drawErr || (b._zf && b._zf.dark > 0.3)) continue;
				W._drawBody = b;
				const x = b.x - camX, y = b.y - camY, R = bodyRadius(b);
				for(const id in b.tech){
					const s = b.tech[id]; if(Math.abs(s) < CONFIG.tech.minIntensity) continue;
					const d = Techniques.get(id); if(!d || !d.draw) continue;
					ctx.save(); d.draw(ctx, b, x, y, R, s, t, lod); ctx.restore();
				}
			}
			ctx.globalCompositeOperation = 'lighter';
			// sparks: tiny squares are far cheaper than arcs and look the same at this size
			// batched: one fill per colour and fade step instead of one per spark
			const batch = W._sparkBatch || (W._sparkBatch = new Map());
			batch.forEach(v => { v.length = 0; });
			for(const s of W.sparks){
				const k = s.age / s.life; const x = s.x - camX, y = s.y - camY;
				if(x < -5 || y < -5 || x > viewW + 5 || y > viewH + 5) continue;
				const step = Math.min(5, Math.floor(k * 6)), key = s.color + '|' + step;
				let arr = batch.get(key); if(!arr){ arr = []; batch.set(key, arr); arr.color = s.color; arr.alpha = (1 - (step + 0.5) / 6) * 0.9; }
				const r = s.size * (1 - k * 0.5);
				arr.push(x - r, y - r, r * 2);
			}
			batch.forEach((arr, key) => {
				if(!arr.length) return;
				ctx.globalAlpha = arr.alpha; ctx.fillStyle = arr.color; ctx.beginPath();
				for(let i = 0; i < arr.length; i += 3) ctx.rect(arr[i], arr[i + 1], arr[i + 2], arr[i + 2]);
				ctx.fill();
			});
			if(batch.size > 200) batch.clear();
			ctx.restore();
			drawStatuses(ctx, camX, camY, t);
			if(!W.hostDrawsReinforcement) W.drawReinforcements(ctx, camX, camY);
			W._drawBody = null;
			if(W.debug){ drawDebug(ctx, camX, camY); drawBodyDebug(ctx, camX, camY); }
		}
		/* ---------- statuses, reinforcement and debug drawing ---------- */
		/* zones with a technique: a faint boundary in its colour; Light zones glow, reverse Light zones darken the area */
		function drawZoneLaws(ctx, camX, camY, viewW, viewH, t){
			if(!W.zoneLaws.length) return;
			ctx.save();
			for(const D of W.darks){
				const x = D.x - camX, y = D.y - camY; if(x < -D.r || y < -D.r || x > viewW + D.r || y > viewH + D.r) continue;
				ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
				const g = ctx.createRadialGradient(x, y, D.r * 0.15, x, y, D.r);
				g.addColorStop(0, 'rgba(2,0,8,' + (0.78 * D.k).toFixed(3) + ')'); g.addColorStop(0.75, 'rgba(2,0,8,' + (0.62 * D.k).toFixed(3) + ')'); g.addColorStop(1, 'rgba(2,0,8,0)');
				ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, D.r, 0, Math.PI * 2); ctx.fill();
			}
			for(const B of W.brights){
				const x = B.x - camX, y = B.y - camY; if(x < -B.r || y < -B.r || x > viewW + B.r || y > viewH + B.r) continue;
				ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1;
				const g = ctx.createRadialGradient(x, y, 0, x, y, B.r);
				g.addColorStop(0, 'rgba(255,244,200,' + (0.22 * B.k).toFixed(3) + ')'); g.addColorStop(0.8, 'rgba(255,236,170,' + (0.12 * B.k).toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,236,170,0)');
				ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, B.r, 0, Math.PI * 2); ctx.fill();
			}
			ctx.lineWidth = 1.5; ctx.setLineDash([10, 8]);
			for(const L of W.zoneLaws){
				const x = L.x - camX, y = L.y - camY; if(x < -L.r || y < -L.r || x > viewW + L.r || y > viewH + L.r) continue;
				for(const id in L.tech){
					const d = Techniques.get(id); if(!d) continue;
					const col = L.tech[id] < 0 ? d.reversedColor : d.color;
					ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.18 + 0.25 * L.k;
					ctx.strokeStyle = col; ctx.lineDashOffset = -t * 20;
					ctx.beginPath(); ctx.arc(x, y, L.r, 0, Math.PI * 2); ctx.stroke();
					ctx.globalAlpha = 0.05 + 0.05 * L.k; ctx.fillStyle = col;
					ctx.beginPath(); ctx.arc(x, y, L.r, 0, Math.PI * 2); ctx.fill();
				}
			}
			ctx.restore();
		}
		function rectOf(e){
			if(!e) return null;
			if(W.host.visualRect){ const v = W.host.visualRect(e); if(v) return v; }
			if(e.w != null) return { x: e.x, y: e.y, w: e.w, h: e.h };
			const r = W.host.hitRect(e); return r;
		}
		function drawStatuses(ctx, camX, camY, t){
			if(!W.status.size) return;
			ctx.save();
			W.status.forEach((st, e) => {
				const r = rectOf(e); if(!r) return;
				const x = r.x - camX, y = r.y - camY, w = r.w, h = r.h;
				for(const k in st){
					const s = st[k], fade = clamp(s.t / 0.4, 0, 1), m = clamp(s.mag, 0.2, 1.5);
					if(k === 'burn'){
						ctx.globalCompositeOperation = 'lighter';
						for(let i = 0; i < 5; i++){
							const fx = x + w * (0.15 + 0.7 * ((i * 0.37 + s.seed) % 1)), ph = t * 6 + i * 1.7 + s.seed;
							const fh = (6 + 10 * m) * (0.7 + 0.3 * Math.sin(ph));
							const fy = y + h * (0.25 + 0.6 * ((i * 0.53 + s.seed * 0.3) % 1));
							ctx.globalAlpha = 0.55 * fade;
							ctx.fillStyle = i % 2 ? '#ffb347' : '#ff6a2a';
							ctx.beginPath(); ctx.moveTo(fx - 3, fy); ctx.quadraticCurveTo(fx - 2, fy - fh * 0.6, fx + Math.sin(ph) * 2, fy - fh); ctx.quadraticCurveTo(fx + 2, fy - fh * 0.6, fx + 3, fy); ctx.fill();
						}
					} else if(k === 'chill'){
						ctx.globalCompositeOperation = 'source-over';
						ctx.globalAlpha = 0.16 * m * fade; ctx.fillStyle = '#bfefff'; ctx.fillRect(x, y, w, h);
						ctx.globalAlpha = 0.85 * fade; ctx.strokeStyle = '#e8fbff'; ctx.lineWidth = 1.2;
						for(let i = 0; i < 6; i++){
							const a = i / 6 * Math.PI * 2 + s.seed, px = x + w / 2 + Math.cos(a) * w * 0.55, py = y + h / 2 + Math.sin(a) * h * 0.5, L = 3 + 4 * m;
							ctx.beginPath();
							for(let j = 0; j < 3; j++){ const b = j / 3 * Math.PI; ctx.moveTo(px - Math.cos(b) * L, py - Math.sin(b) * L); ctx.lineTo(px + Math.cos(b) * L, py + Math.sin(b) * L); }
							ctx.stroke();
						}
					} else if(k === 'bound'){
						ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.75 * fade;
						ctx.strokeStyle = s.color || '#7dffb0'; ctx.lineWidth = 1.6;
						for(let i = 0; i < 3; i++){
							const yy = y + h * (0.3 + i * 0.22) + Math.sin(t * 3 + i) * 1.5;
							ctx.beginPath(); ctx.ellipse(x + w / 2, yy, w * 0.62, 4 + i, Math.sin(t + i) * 0.15, 0, Math.PI * 2); ctx.stroke();
						}
						if(s.x != null){ ctx.globalAlpha = 0.45 * fade; ctx.beginPath(); ctx.moveTo(x + w / 2, y + h / 2); ctx.lineTo(s.x - camX, s.y - camY); ctx.stroke(); }
					} else if(k === 'dazzle'){
						ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.8 * fade;
						const cx = x + w / 2, cy = y + h * 0.18, L = 8 + 8 * m * (0.8 + 0.2 * Math.sin(t * 9));
						ctx.strokeStyle = '#fffbe0'; ctx.lineWidth = 1.5;
						ctx.beginPath(); ctx.moveTo(cx - L, cy); ctx.lineTo(cx + L, cy); ctx.moveTo(cx, cy - L); ctx.lineTo(cx, cy + L); ctx.stroke();
					} else if(k === 'displaced'){
						ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35 * fade;
						ctx.strokeStyle = '#b48cff'; ctx.lineWidth = 1.2;
						ctx.strokeRect(x + (s.dx || 0) * 0.5, y + (s.dy || 0) * 0.5, w, h);
					}
				}
			});
			ctx.restore();
		}
		/* reinforcement: magic visibly applied to an existing thing */
		W.drawReinforcements = function(ctx, camX, camY){
			if(!W.reinf.length) return;
			camX = camX || 0; camY = camY || 0;
			const t = W.time;
			ctx.save();
			ctx.setLineDash([]);
			for(const st of W.reinf){
				const caps = CONFIG.reinforce.caps, P = st.props, s = st.strength, col = st.color;
				const geo = { kind: st.kind, camX, camY, host: W.host };
				if(st.kind === 'weapon'){
					const seg = W.host.weaponSegment ? W.host.weaponSegment({ id: st.ownerId }, st.ref) : null;
					if(!seg) continue;      // not in hand right now
					geo.x0 = seg.x0 - camX; geo.y0 = seg.y0 - camY; geo.x1 = seg.x1 - camX; geo.y1 = seg.y1 - camY;
					if(st.item){ drawItemInHand(ctx, st, geo, t); continue; }      // a magical item IS the compressed energy — no weapon, no reinforcement glow
					drawReinfWeapon(ctx, st, geo, t);
				} else if(st.kind === 'spell' || st.kind === 'energy'){
					const b = st.ref; if(!b || !b.alive) continue;
					geo.x = b.x - camX; geo.y = b.y - camY; geo.r = bodyRadius(b) * 1.5;
					ctx.globalCompositeOperation = 'lighter';
					ctx.globalAlpha = 0.25 + 0.5 * s; ctx.strokeStyle = col.mid; ctx.lineWidth = 1.5;
					ctx.beginPath();
					for(let i = 0; i <= 6; i++){ const a = t * 0.8 + i / 6 * Math.PI * 2; const px = geo.x + Math.cos(a) * geo.r, py = geo.y + Math.sin(a) * geo.r; if(i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
					ctx.stroke();
				} else {
					const r = rectOf(st.ref); if(!r) continue;
					geo.x = r.x - camX; geo.y = r.y - camY; geo.w = r.w; geo.h = r.h;
					geo.facing = st.ref.facing || 1;
					drawReinfBody(ctx, st, geo, t, P, caps);
				}
				for(const id in st.tech){
					const sv = st.tech[id]; if(Math.abs(sv) < CONFIG.tech.minIntensity) continue;
					const d = Techniques.get(id);
					if(d && d.drawReinforce){ ctx.save(); d.drawReinforce(ctx, st, sv, geo, t); ctx.restore(); }
				}
			}
			// Infinity layers around creatures
			for(const fl of (W._infFields || [])){ if(!fl.st) continue; ctx.save(); drawInfinityRings(ctx, fl.x - camX, fl.y - camY, fl.r0, fl.R, fl.L, t, 1, fl.st.suppressed > W.time); ctx.restore(); }
			ctx.restore();
		};
		/* a magical item in your hand: the compressed shape itself, from your grip out to where the weapon reaches */
		function drawItemInHand(ctx, st, g, t){
			const item = st.itemData; if(!item || st.hidden) return;      // thrown: it is out of your hand
			const b = st._body || (st._body = itemBody(item));
			b.amount = item.amount; b.over = item.over || 0; b.tech = item.tech;
			const dx = g.x1 - g.x0, dy = g.y1 - g.y0, L = Math.hypot(dx, dy);
			const ext = ITEM_EXTENT[b.shape] || [1.6, 1.6];
			// drawn at its own size — exactly the shape it was compressed into — held by its back end
			b.formRadius = itemVisualR(item);
			b.angle = L > 0.5 ? Math.atan2(dy, dx) : 0;
			let cx, cy;
			if(b.shape === 'fist' || L < 0.5){ cx = g.x1; cy = g.y1; }
			else {
				const ux = dx / L, uy = dy / L, back = ext[0] * b.formRadius * 0.8;
				cx = g.x0 + ux * back; cy = g.y0 + uy * back;
			}
			ctx.save(); drawBody(ctx, b, cx, cy, t); ctx.restore();
		}
		function drawItemBlade(ctx, st, g, t){
			const col = st.color, dx = g.x1 - g.x0, dy = g.y1 - g.y0, L = Math.hypot(dx, dy);
			ctx.save();
			ctx.globalCompositeOperation = 'lighter';
			ctx.lineCap = 'round';
			const pulse = 0.85 + 0.15 * Math.sin(t * 7 + st.seed);
			if(L < 12){
				// a fist: a burning knot of energy around the hand
				const r = 11 * pulse;
				const gg = ctx.createRadialGradient(g.x1, g.y1, 0, g.x1, g.y1, r * 2.2);
				gg.addColorStop(0, hexA('#ffffff', 0.9)); gg.addColorStop(0.35, hexA(col.mid, 0.7)); gg.addColorStop(1, hexA(col.outer, 0));
				ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(g.x1, g.y1, r * 2.2, 0, Math.PI * 2); ctx.fill();
			} else {
				ctx.strokeStyle = hexA(col.outer, 0.35 * pulse); ctx.lineWidth = 14;
				ctx.beginPath(); ctx.moveTo(g.x0, g.y0); ctx.lineTo(g.x1, g.y1); ctx.stroke();
				ctx.strokeStyle = hexA(col.mid, 0.75); ctx.lineWidth = 6;
				ctx.beginPath(); ctx.moveTo(g.x0, g.y0); ctx.lineTo(g.x1, g.y1); ctx.stroke();
				ctx.strokeStyle = hexA('#ffffff', 0.9); ctx.lineWidth = 2;
				ctx.beginPath(); ctx.moveTo(g.x0, g.y0); ctx.lineTo(g.x1, g.y1); ctx.stroke();
			}
			ctx.restore();
		}
		function drawReinfBody(ctx, st, g, t, P, caps){
			const s = st.strength, col = st.color;
			const cx = g.x + g.w / 2, bot = g.y + g.h;
			ctx.globalCompositeOperation = 'lighter';
			// a thin shell — stronger with durability / stability
			const guard = ((P.damageResist || 0) / caps.damageResist + (P.stability || 0) / caps.stability + (P.knockbackResist || 0) / caps.knockbackResist) / 3;
			ctx.globalAlpha = clamp(0.12 + 0.45 * guard + 0.15 * s, 0, 0.7);
			ctx.strokeStyle = col.mid; ctx.lineWidth = 1.4;
			ctx.setLineDash([6, 7]); ctx.lineDashOffset = -t * 18;
			ctx.beginPath(); ctx.ellipse(cx, g.y + g.h * 0.52, g.w * 0.62, g.h * 0.56, 0, 0, Math.PI * 2); ctx.stroke();
			ctx.setLineDash([]);
			// energy flowing up around the body
			const n = 2 + Math.round(4 * s);
			ctx.lineWidth = 1.6; ctx.lineCap = 'round';
			for(let i = 0; i < n; i++){
				const side = i % 2 ? 1 : -1, ph = (t * 0.55 + i * 0.37 + st.seed) % 1;
				const xo = side * g.w * (0.32 + 0.14 * ((i * 0.61) % 1));
				ctx.globalAlpha = (0.25 + 0.5 * s) * Math.sin(ph * Math.PI);
				ctx.strokeStyle = i % 3 ? col.mid : col.core;
				ctx.beginPath();
				for(let k = 0; k <= 6; k++){
					const u = ph - k * 0.035; if(u < 0) break;
					const yy = bot - u * g.h * 1.05, xx = cx + xo + Math.sin(u * 9 + t * 3 + i) * 3;
					if(k) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy);
				}
				ctx.stroke();
			}
			// concentrated where the strengthening matters
			const legs = ((P.moveForce || 0) / caps.moveForce + (P.jumpForce || 0) / caps.jumpForce) / 2;
			const arms = (P.meleeDamage || 0) / caps.meleeDamage;
			const glow = (x, y, r, a) => {
				if(a <= 0.02) return;
				const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
				gr.addColorStop(0, hexA(col.mid, 0.55 * a)); gr.addColorStop(1, hexA(col.outer, 0));
				ctx.globalAlpha = 1; ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
			};
			glow(cx, bot - g.h * 0.1, g.w * 0.8, clamp(legs, 0, 1) * (0.7 + 0.3 * Math.sin(t * 5)));
			glow(cx + g.facing * g.w * 0.42, g.y + g.h * 0.48, g.w * 0.55, clamp(arms, 0, 1) * (0.7 + 0.3 * Math.sin(t * 6 + 1)));
		}
		function drawReinfWeapon(ctx, st, g, t){
			const s = st.strength, col = st.color;
			const dx = g.x1 - g.x0, dy = g.y1 - g.y0, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, px = -uy, py = ux;
			ctx.globalCompositeOperation = 'lighter';
			ctx.lineCap = 'round';
			ctx.globalAlpha = 0.12 + 0.25 * s; ctx.strokeStyle = col.mid; ctx.lineWidth = 7 + 5 * s;
			ctx.beginPath(); ctx.moveTo(g.x0, g.y0); ctx.lineTo(g.x1, g.y1); ctx.stroke();
			const amp = 2.5 + 3 * s, N = Math.max(8, Math.round(L / 6));
			for(let k = 0; k < 2; k++){
				ctx.globalAlpha = 0.45 + 0.4 * s; ctx.strokeStyle = k ? col.core : col.mid; ctx.lineWidth = 1.5;
				ctx.beginPath();
				for(let i = 0; i <= N; i++){
					const u = i / N, o = Math.sin(u * 12 - t * 9 + k * Math.PI) * amp * (0.4 + 0.6 * u);
					const x = g.x0 + dx * u + px * o, y = g.y0 + dy * u + py * o;
					if(i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
				}
				ctx.stroke();
			}
			const tw = 3 + 4 * s * (0.7 + 0.3 * Math.sin(t * 11));
			ctx.globalAlpha = 0.8; ctx.strokeStyle = col.core; ctx.lineWidth = 1.2;
			ctx.beginPath(); ctx.moveTo(g.x1 - tw, g.y1); ctx.lineTo(g.x1 + tw, g.y1); ctx.moveTo(g.x1, g.y1 - tw); ctx.lineTo(g.x1, g.y1 + tw); ctx.stroke();
			if(Math.random() < 0.25 * s){ const u = Math.random(); T.spark(g.x0 + dx * u + g.camX, g.y0 + dy * u + g.camY, px * 0.6, py * 0.6 - 0.4, col.mid, 16); }
		}
		/* developer view: what every piece of energy is doing and why */
		function drawBodyDebug(ctx, camX, camY){
			const K = W.debugScale || 1;
			ctx.save();
			ctx.font = Math.round(10 * K) + 'px monospace'; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
			ctx.globalCompositeOperation = 'source-over';
			let n = 0;
			for(const b of W.bodies){
				if(!b.alive || b.zoneBlob || n > 40) continue;
				const x = b.x - camX, y = b.y - camY;
				if(x < -50 || y < -50 || x > ctx.canvas.width + 50 || y > ctx.canvas.height + 50) continue;
				n++;
				const sp = Math.hypot(b.vx, b.vy);
				const lines = [ (b.isZone ? 'ZONE r' + Math.round(b.zoneRadius) + ' E' + b.amount.toFixed(0) + ' charge ' + (b.fieldCharge || 0).toFixed(0) + '  ' + Math.max(0, CONFIG.zoneLifetime - b.age).toFixed(0) + 's'
					: 'E' + b.amount.toFixed(1) + ' P' + Math.abs(bodyPower(b)).toFixed(1) + (sp > 0.3 ? ' v' + sp.toFixed(1) + ' ' + Math.round(Math.atan2(b.vy, b.vx) * 180 / Math.PI) + '°' : ' still')) ];
				if(b.tech && techList(b)) lines.push(techList(b));
				if(b.over) lines.push('over-compressed +' + Math.round(b.over));
				if(b.mem && memList(b)) lines.push('memory: ' + memList(b));
				lines.push('state: ' + stateOf(b).join(' + '));
				if(b.focus) lines.push('focus ' + b.focus.kind);
				if(b.reinfStab || b.reinfImpact) lines.push('reinforced stab ' + Math.round((b.reinfStab || 0) * 100) + '% impact +' + Math.round((b.reinfImpact || 0) * 100) + '%');
				const w = Math.max.apply(null, lines.map(l => l.length)) * 6.2 * K + 8, h = lines.length * 12 * K + 4;
				const bx = x + 14, by = y - h - 8;
				ctx.globalAlpha = 0.8; ctx.fillStyle = 'rgba(6,10,22,0.85)'; ctx.fillRect(bx, by, w, h);
				ctx.globalAlpha = 1; ctx.fillStyle = '#d6f2ff';
				lines.forEach((l, i) => ctx.fillText(l, bx + 4, by + 2 + i * 12 * K));
			}
			for(const st of W.reinf){
				const p = reinfAnchor(st); if(!p) continue;
				const props = Object.keys(st.props).filter(k => st.props[k] > 0.005).map(k => k + ' +' + Math.round(st.props[k] * 100) + '%');
				const lines = [ '⛨ ' + st.kind + ' ' + Math.round(st.strength * 100) + '%  E' + st.energy.toFixed(1) + '  eff ' + Math.round(st.efficiency * 100) + '%  ' + Math.max(0, st.end - W.time).toFixed(0) + 's', props.join(' ') ];
				const tl = techList({ tech: st.tech }); if(tl) lines.push(tl);
				const w = Math.max.apply(null, lines.map(l => l.length)) * 6.2 * K + 8, h = lines.length * 12 * K + 4;
				const bx = p.x - camX - w / 2, by = p.y - camY + 40;
				ctx.globalAlpha = 0.85; ctx.fillStyle = 'rgba(8,24,16,0.88)'; ctx.fillRect(bx, by, w, h);
				ctx.globalAlpha = 1; ctx.fillStyle = '#c8ffe0';
				lines.forEach((l, i) => ctx.fillText(l, bx + 4, by + 2 + i * 12 * K));
			}
			ctx.restore();
		}


		function drawDebug(ctx, camX, camY){
			ctx.save();
			const K = W.debugScale || 1;
			ctx.font = Math.round(11 * K) + 'px monospace'; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
			ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0;
			for(const inst of W.instances){
				const anchorB = W.bodies.find(b => b.alive && b.inst === inst.id);
				let ax = (anchorB ? anchorB.x : inst.lastCaster.x) - camX + 18;
				let ay = (anchorB ? anchorB.y : inst.lastCaster.y) - camY - 70 * K;
				const vw = ctx.canvas.width;
				if(ax + 250 * K > vw) ax = Math.max(4, vw - 250 * K - 4);
				if(ay < 4) ay = 4;
				const waiting = inst.branches.filter(b => b.state === 'delay' || b.state === 'cond' || b.state === 'hold');
				const lines = [
					'Spell #' + inst.id + '  ' + inst.def.name,
					'life ' + (inst.lifetime - inst.age).toFixed(1) + 's  branches ' + inst.branches.filter(b => b.state !== 'done').length,
					'output ' + Math.round(inst.outputUsed) + ' / ' + inst.maxOutput + '  budget ' + Math.round(inst.budget),
					'efficiency loss ' + (inst.effLoss || 0).toFixed(1) + ' E  reinforcements ' + W.reinf.filter(st => st.inst === inst.id).length
				];
				for(const br of waiting.slice(0, 4)){
					const n = inst.def.nodes[br.nodeId]; const R = n && Runes[n.type];
					if(br.state === 'hold'){ lines.push('  b' + br.id + ' ' + (br.hold ? br.hold.label : 'hold') + ' ' + (br.hold ? br.hold.elapsed.toFixed(1) + '/' + br.hold.time + 's' : '')); continue; }
					lines.push('  b' + br.id + ' → ' + (R ? R.name : '?') + (br.state === 'delay' ? '  ⏱ ' + br.wait.toFixed(2) + 's' : '  ◆ ' + ((Conditions[n.link.cond.type] || {}).name || '?') + ' ' + br.condAge.toFixed(1) + 's'));
				}
				if(anchorB){
					lines.push('E ' + anchorB.amount.toFixed(1) + '  P ' + bodyPower(anchorB).toFixed(1) + '  ' + (techList(anchorB) || 'no technique'));
				}
				const w = 250 * K, h = (lines.length * 13 + 8) * K;
				ctx.fillStyle = 'rgba(6,10,22,0.78)'; ctx.fillRect(ax, ay, w, h);
				ctx.strokeStyle = 'rgba(140,200,255,0.5)'; ctx.strokeRect(ax + 0.5, ay + 0.5, w, h);
				ctx.fillStyle = '#cfe8ff';
				lines.forEach((l, i) => ctx.fillText(l, ax + 6 * K, ay + (4 + i * 13) * K));
			}
			ctx.restore();
		}

		W.instancesFor = function(ownerId){ return W.instances.filter(i => i.owner.id === ownerId); };
		W._crowd = CROWD;
		W.setDetail = function(on){ LOD_ENABLED.on = on !== false; };
		W.stats = function(){ return { instances: W.instances.length, bodies: W.bodies.filter(b => b.alive).length, sparks: W.sparks.length }; };
		return W;
	}

	function withDefaults(h){
		const d = {
			mouseWorld: () => ({ x: 0, y: 0 }),
			getEnemies: () => [], getAllies: () => [],
			hitRect: (e) => ({ x: e.x, y: e.y, w: e.w || 1, h: e.h || 1 }),
			isSolid: () => false, inBounds: () => true,
			damageEnemy: (e, dmg) => { if(e.hp != null) e.hp -= dmg; },
			heal: () => {}, applyImpulse: (e, ix, iy) => { if(e.vx != null){ e.vx += ix; e.vy += iy; } },
			nudge: (e, dx, dy) => { e.x += dx; e.y += dy; },
			isPlayer: (e) => !!(e && (e.isPlayer || e.player || e.playerId != null)),
			siphonEnergy: (ent, amount) => {
				if(!ent || !(amount > 0)) return 0;
				if(typeof ent.mana === 'number'){
					const got = Math.max(0, Math.min(ent.mana, amount));
					ent.mana -= got; return got;
				}
				if(typeof ent.energy === 'number'){
					const got = Math.max(0, Math.min(ent.energy, amount));
					ent.energy -= got; return got;
				}
				if(ent._drawLeft == null) ent._drawLeft = Math.max(12, Math.min(80, (ent.maxHp || ent.hp || 40) * 0.2));
				const got = Math.max(0, Math.min(ent._drawLeft, amount));
				ent._drawLeft -= got;
				return got;
			},
			getForeignProjectiles: () => [], foreignAlive: (p) => !!p && !p.dead && p.alive !== false && !p._magicGone,
			removeForeign: (p) => { if(p){ p.dead = true; p.alive = false; } },
			ambientDensity: null, shake: null,
			drainEnergy: (owner, amount) => amount
		};
		for(const k in d) if(typeof h[k] !== 'function') h[k] = d[k];
		return h;
	}

	/* =====================================================================
	   ENERGY RENDERER — a flowing, unstable mass (not an orb, not dots)
	   ===================================================================== */
	const RAW_COLORS = { core:'#ffffff', mid:'#9fe6ff', outer:'#6f5cff' };
	function mixHex(a, b, t){
		const pa = parseInt(a.replace('#', ''), 16), pb = parseInt(b.replace('#', ''), 16);
		const ch = (n, s) => (n >> s) & 255, m = (s) => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * t);
		return '#' + ((1 << 24) | (m(16) << 16) | (m(8) << 8) | m(0)).toString(16).slice(1);
	}
	/* over-compressed energy burns brighter, white-hot at 50, its own colour only at the rim */
	function bodyColors(b){
		const base = bodyColorsBase(b);
		const o = overK(b);
		if(!(o > 0)) return base;
		const w = 0.25 + 0.75 * o;
		return { core: '#ffffff', mid: mixHex(base.mid, '#ffffff', 0.6 * w), outer: mixHex(base.outer, base.mid, 0.3 * w) };
	}
	function bodyColorsBase(b){
		const dt = b && b.tech ? dominantTech(b) : null;
		if(dt){
			const d = Techniques.get(dt.id);
			if(d){
				const pal = dt.s < 0 ? (d.reversePalette || null) : (d.palette || null);
				if(pal) return pal;
				const c = dt.s < 0 ? d.reversedColor : d.color;
				return { core:'#ffffff', mid:c, outer:c };
			}
		}
		if(b && b.technique){
			const d = Techniques.get(b.technique.id);
			if(d){ const c = b.technique.sign < 0 ? d.reversedColor : d.color; return { core:'#ffffff', mid:c, outer:c }; }
		}
		if(b && b.source === 'environment') return { core:'#f2fffb', mid:'#8fffe0', outer:'#3fbfa8' };
		return RAW_COLORS;
	}
	function easeOut(k){ return 1 - (1 - k) * (1 - k); }
	function easeInOut(k){ return k < 0.5 ? 2*k*k : 1 - Math.pow(-2*k + 2, 2) / 2; }
	function lerpAngle(a, b, t){
		if(!isFinite(a)) a = isFinite(b) ? b : 0;
		if(!isFinite(b)) return a;
		let d = (b - a) % (Math.PI * 2);      // modulo, not a loop: a huge angle can never hang the game
		if(d > Math.PI) d -= Math.PI * 2; else if(d < -Math.PI) d += Math.PI * 2;
		return a + d * t;
	}

	function hexA(hex, a){
		const h = hex.replace('#', '');
		const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
		return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
	}

	function curForm(b){ const m = easeInOut(b.morph == null ? 1 : b.morph); return (b.formPrev || 0) + ((b.form || 0) - (b.formPrev || 0)) * m; }
	function buildOutline(b, x, y, R, t, out){
		const pts = out || b.pts || (b.pts = new Float32Array(N_PTS * 2));
		const m = easeInOut(b.morph == null ? 1 : b.morph);
		const fCur = b.form || 0, fPrev = b.formPrev || 0;
		const fNow = fPrev + (fCur - fPrev) * m;
		const sc = (SHAPES[b.shape] || SHAPES.raw).pts, sp = (SHAPES[b.shapePrev] || SHAPES.raw).pts;
		// unstable when loose, nearly still when fully formed; stirred up while rearranging
		const inst = clamp(0.2 * Math.sqrt(b.scale), 0.05, 0.42) * (1 - 0.9 * fNow) * (1 + (1 - m) * 1.5);
		const ca = Math.cos(b.angle), sa = Math.sin(b.angle), sd = b.seed;
		const swirl = (1 - m) * 0.9;
		for(let i = 0; i < N_PTS; i++){
			const th = (i / N_PTS) * Math.PI * 2;
			const n = 0.5 * Math.sin(3 * th + t * 2.3 + sd) + 0.3 * Math.sin(5 * th - t * 3.4 + sd * 1.7) + 0.2 * Math.sin(8 * th + t * 5.1 + sd * 0.3);
			const k = 1 + n * inst;
			// raw blob point (index 0 faces forward so it lines up with the shape outline)
			const bt = th + b.angle + swirl;
			let bx = Math.cos(bt) * k, by = Math.sin(bt) * k;
			// current and previous shape points in local space
			let cx = bx, cy = by, px = bx, py = by;
			if(sc){ const lx = sc[i*2] * k, ly = sc[i*2+1] * k; cx = bx + ((lx * ca - ly * sa) - bx) * fCur; cy = by + ((lx * sa + ly * ca) - by) * fCur; }
			if(sp){ const lx = sp[i*2] * k, ly = sp[i*2+1] * k; px = bx + ((lx * ca - ly * sa) - bx) * fPrev; py = by + ((lx * sa + ly * ca) - by) * fPrev; }
			pts[i*2] = x + (px + (cx - px) * m) * R;
			pts[i*2+1] = y + (py + (cy - py) * m) * R;
		}
		return pts;
	}
	function tracePath(ctx, pts, sharp){
		if(sharp){
			ctx.moveTo(pts[0], pts[1]);
			for(let i = 1; i < N_PTS; i++) ctx.lineTo(pts[i*2], pts[i*2+1]);
			ctx.closePath(); return;
		}
		ctx.moveTo((pts[0] + pts[N_PTS*2-2]) / 2, (pts[1] + pts[N_PTS*2-1]) / 2);
		for(let i = 0; i < N_PTS; i++){
			const x0 = pts[i*2], y0 = pts[i*2+1];
			const j = (i + 1) % N_PTS; const x1 = pts[j*2], y1 = pts[j*2+1];
			ctx.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
		}
		ctx.closePath();
	}

	/* ---------- fast path: loose (unshaped) energy is drawn from pre-rendered animation frames ----------
	   A full body costs three gradients, a clipped path and ~200 path points per frame. Loose blobs all look
	   alike apart from colour, size and density, so their animation is rendered once per look into small
	   canvases and stamped with drawImage. Additive ('lighter') blending makes the stamp identical to drawing
	   the layers in place. */
	const SPRITE = { R: 22, frames: 24, fps: 15, cache: new Map() };
	let LOD_CROWD = 0;     // visible bodies this frame (set by W.draw) — more bodies → more of them use the fast path
	function spriteScaleBucket(scale){ return clamp(Math.round(scale * 4) / 4, 0.25, 3); }
	function spriteSet(col, sb){
		const key = col.core + col.mid + col.outer + '|' + sb;
		let set = SPRITE.cache.get(key);
		if(!set){
			if(typeof document === 'undefined') return null;
			const half = Math.ceil(SPRITE.R * (2.3 + 0.25 / Math.max(0.25, sb)) + 4);
			set = { half, frames: new Array(SPRITE.frames), col, sb };
			SPRITE.cache.set(key, set);
		}
		return set;
	}
	function spriteFrame(set, i){
		let c = set.frames[i];
		if(c) return c;
		c = document.createElement('canvas');
		c.width = c.height = set.half * 2;
		const g = c.getContext('2d');
		const fake = { shape:'raw', shapePrev:'raw', form:0, formPrev:0, morph:1, scale:set.sb, angle:0, seed:0, flash:0, alive:true };
		drawBodyFull(g, fake, set.half, set.half, i / SPRITE.fps, SPRITE.R, 1, set.col);
		set.frames[i] = c;
		return c;
	}
	function canSprite(b){
		if(!LOD_ENABLED.on || typeof document === 'undefined') return false;
		if(b.flash > 0 || (b.morph != null && b.morph < 1) || (b.form || 0) > 0.03) return false;
		if(b.scale < 0.2 || b.scale > 3.2) return false;
		return true;
	}
	const LOD_ENABLED = { on: true };
	function drawBodySprite(ctx, b, x, y, t, R, alpha, col){
		const set = spriteSet(col, spriteScaleBucket(b.scale));
		if(!set) return false;
		const fi = Math.floor(t * SPRITE.fps + b.seed * 7.3) % SPRITE.frames;
		const img = spriteFrame(set, fi < 0 ? fi + SPRITE.frames : fi);
		const k = R / SPRITE.R, h = set.half * k;
		ctx.globalCompositeOperation = 'lighter';
		ctx.globalAlpha = alpha;
		const a = b.angle + b.seed;
		const ca = Math.cos(a), sa = Math.sin(a);
		ctx.save();
		ctx.transform(ca, sa, -sa, ca, x, y);
		ctx.drawImage(img, -h, -h, h * 2, h * 2);
		ctx.restore();
		ctx.globalAlpha = 1;
		return true;
	}
	/* ---------- crowd stamps: loose technique energy drawn from cached animation frames ----------
	   With dozens of bodies on screen every flame / spark / streak costs paths, gradients and clips. Loose energy
	   with the same techniques looks alike apart from size and speed, so each look (colour, technique states,
	   density, speed bucket) is rendered once per animation frame into a small canvas and stamped with drawImage.
	   Techniques that draw along the energy's motion (spriteRotate) are rendered facing right and rotated. */
	const STAMP_M = { m: null };      // the draw's base transform (read once per frame)
	const CROWD = { R: 16, frames: 8, fps: 10, cache: new Map(), max: 140 };
	function crowdOk(b){
		if(b.isZone || b.rupture || b.infSource || b.hideBody || b.over > 0 || b.bond || b.bondsX) return false;
		if(b.flash > 0 || (b.morph != null && b.morph < 1) || (b.form || 0) > 0.03 || b.scale < 0.2 || b.scale > 3.2) return false;
		return true;
	}
	function stampCrowd(ctx, b, x, y, t){
		if(!crowdOk(b)) return false;
		let R = bodyRadius(b), alpha = 1;
		if(!b.alive){ const k = Math.min(1, b.dying / 0.35); alpha = 1 - k; R *= 1 + k * 0.8; }
		R *= 0.4 + 0.6 * easeOut(Math.min(1, b.age * 6));
		if(b._zf && b._zf.dark) alpha *= 1 - 0.8 * Math.min(1, b._zf.dark);
		if(R < 0.5 || alpha <= 0) return true;
		let sig = '', rot = false, dark = false, lean = false, n = 0;
		const tq = {};
		if(b.tech) for(const id in b.tech){
			const s = b.tech[id]; if(Math.abs(s) < CONFIG.tech.minIntensity) continue;
			const d = Techniques.get(id); if(!d) return false;
			const q = Math.sign(s) * Math.max(CONFIG.tech.minIntensity, Math.round(Math.min(3, Math.abs(s)) * 2) / 2);
			tq[id] = q; sig += id + q + ','; n++;
			if(d.spriteRotate) rot = true;
			if(d.spriteDir) lean = true;
			if(d.spriteBlend && d.spriteBlend(s) === 'source-over') dark = true;
		}
		if(!n) sig = 'raw';      // loose raw energy: the same stamps, from its plain look
		const k = R / CROWD.R, sp = Math.hypot(b.vx, b.vy);
		// speed is part of the look only for techniques drawn along the motion (in the stamp's own scale)
		const spb = rot ? (sp < 0.4 ? 0 : sp < 6.5 ? 3 : Math.min(30, Math.round(sp / k / 4) * 4 + 4)) : 0;
		// techniques that lean with the motion without turning (a flame trails behind) keep 8 directions × a few speeds
		const dirb = !rot && lean && sp > 0.4 ? ((Math.round(Math.atan2(b.vy, b.vx) / (Math.PI / 4)) % 8) + 8) % 8 : -1;
		const lsp = dirb < 0 ? 0 : (sp < 3 ? 2 : sp < 6 ? 4.5 : 8);
		const col = bodyColors(b), sb = spriteScaleBucket(b.scale);
		const key = sig + '|' + sb + '|' + spb + '|' + dirb + ':' + lsp + '|' + col.core + col.mid + col.outer + '|' + (b.source || '');
		let set = CROWD.cache.get(key);
		if(!set){
			if(CROWD.cache.size >= CROWD.max) CROWD.cache.delete(CROWD.cache.keys().next().value);      // oldest look goes first
			set = { half: Math.ceil(CROWD.R * 3.6 + spb * 4.5 + 6), frames: new Array(CROWD.frames), tq, sb, spb, col, source: b.source,
				lvx: dirb < 0 ? 0 : Math.cos(dirb * Math.PI / 4) * lsp, lvy: dirb < 0 ? 0 : Math.sin(dirb * Math.PI / 4) * lsp };
			CROWD.cache.set(key, set);
		}
		const fi = (Math.floor(t * CROWD.fps + b.seed * 7.3) % CROWD.frames + CROWD.frames) % CROWD.frames;
		let fr = set.frames[fi];
		if(!fr){ fr = set.frames[fi] = renderCrowdFrame(set, fi / CROWD.fps); if(!fr) return false; }
		if(b.comp > 10 && b.alive && !b.toInventory){ const j = 0.5 + 2.2 * overK(b); x += (Math.random() - 0.5) * j; y += (Math.random() - 0.5) * j; }
		if(!fr.c) return true;      // nothing visible in this frame
		ctx.globalCompositeOperation = dark ? 'source-over' : 'lighter';
		ctx.globalAlpha = alpha;
		const ox = fr.ox * k, oy = fr.oy * k, w = fr.c.width * k, hh = fr.c.height * k;
		if(rot && sp > 0.3){
			const a = Math.atan2(b.vy, b.vx), ca = Math.cos(a), sa = Math.sin(a);
			const M = STAMP_M.m || (STAMP_M.m = ctx.getTransform ? ctx.getTransform() : null);
			if(M){ ctx.setTransform(M.a * ca + M.c * sa, M.b * ca + M.d * sa, M.c * ca - M.a * sa, M.d * ca - M.b * sa, M.a * x + M.c * y + M.e, M.b * x + M.d * y + M.f); ctx.drawImage(fr.c, ox, oy, w, hh); ctx.setTransform(M); }
			else { ctx.save(); ctx.transform(ca, sa, -sa, ca, x, y); ctx.drawImage(fr.c, ox, oy, w, hh); ctx.restore(); }
		} else ctx.drawImage(fr.c, x + ox, y + oy, w, hh);
		ctx.globalAlpha = 1;
		return true;
	}
	function renderCrowdFrame(set, ft){
		CROWD.made = (CROWD.made || 0) + 1;
		const c = document.createElement('canvas');
		c.width = c.height = set.half * 2;
		const g = c.getContext('2d'); if(!g) return null;
		const fake = { shape:'raw', shapePrev:'raw', form:0, formPrev:0, morph:1, scale:set.sb, angle:0, seed:0, flash:0, alive:true, age:9,
			amount: 40, tech: Object.assign({}, set.tq), vx: set.spb || set.lvx || 0, vy: set.lvy || 0, source: set.source, polarity: 1, comp: 0, over: 0, id: -1 };
		const X = set.half, Y = set.half, R = CROWD.R;
		g.save();
		const dtq = dominantTech(fake), dq = dtq ? Techniques.get(dtq.id) : null;
		let done = false;
		try { if(dq && dq.drawBody) done = !!dq.drawBody(g, fake, X, Y, R, dtq.s, ft, 1); } catch(err){ done = false; }
		g.restore();
		if(!done){ g.save(); drawBodyFull(g, fake, X, Y, ft, R, 1, set.col); g.restore(); }
		for(const id in fake.tech){
			const d = Techniques.get(id); if(!d || !d.draw) continue;
			g.save(); try { d.draw(g, fake, X, Y, R, fake.tech[id], ft, true); } catch(err){} g.restore();
		}
		// trimmed to what was actually drawn: the stamp covers as few pixels as possible
		let px = null; try { px = g.getImageData(0, 0, c.width, c.height).data; } catch(err){ return { c, ox: -X, oy: -Y }; }
		const W2 = c.width, H2 = c.height; let x0 = W2, y0 = H2, x1 = -1, y1 = -1;
		for(let yy = 0; yy < H2; yy++){ const row = yy * W2 * 4; for(let xx = 0; xx < W2; xx++){ if(px[row + xx * 4 + 3] > 3){ if(xx < x0) x0 = xx; if(xx > x1) x1 = xx; if(yy < y0) y0 = yy; if(yy > y1) y1 = yy; } } }
		if(x1 < 0) return { c: null, ox: 0, oy: 0 };
		const tw = x1 - x0 + 1, th = y1 - y0 + 1, tc = document.createElement('canvas');
		tc.width = tw; tc.height = th; tc.getContext('2d').drawImage(c, x0, y0, tw, th, 0, 0, tw, th);
		return { c: tc, ox: x0 - X, oy: y0 - Y };
	}
	/* Infinity: space drawn inward toward the energy — rings that shrink forever without arriving */
	function drawInfinityRings(ctx, x, y, r0, R, L, t, stab, suppressed){
		const n = 3 + Math.round(L);
		ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 1;
		const jit = stab < 1 ? (1 - stab) * 4 : 0;
		for(let i = 0; i < n; i++){
			const ph = 1 - ((t * (0.25 + 0.06 * L) + i / n) % 1);
			const u = Math.pow(ph, 1.6 + 0.25 * L);                     // crowding toward the centre: the closer, the slower
			const rr = r0 + (R - r0) * u + (jit ? (Math.random() - 0.5) * jit : 0);
			ctx.globalAlpha = (0.05 + 0.04 * L) * (0.3 + 0.7 * ph) * (suppressed ? 0.35 : 1);
			ctx.strokeStyle = i % 2 ? '#d8f4ff' : '#ffffff';
			ctx.beginPath(); ctx.arc(x, y, Math.max(1, rr), 0, Math.PI * 2); ctx.stroke();
		}
		ctx.globalAlpha = (0.04 + 0.03 * L) * (suppressed ? 0.35 : 1);
		const g = ctx.createRadialGradient(x, y, r0, x, y, R);
		g.addColorStop(0, hexA('#e8fbff', 0.5)); g.addColorStop(1, hexA('#e8fbff', 0));
		ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
		ctx.globalAlpha = 1;
	}
	function drawInfinitySource(ctx, b, x, y, t, st){
		const R = bodyRadius(b), col = bodyColors(b), I = b.infSource;
		const R2 = R * 2.4 + 14;
		drawInfinityRings(ctx, x, y, R + 2, R2, 2 + 2 * (1 - st), t, 1 - st, false);
		// its own colour, pulsing while it is drawn from
		ctx.globalCompositeOperation = 'lighter';
		ctx.globalAlpha = 0.25 + 0.35 * (I.pulse || 0);
		const g = ctx.createRadialGradient(x, y, R * 0.4, x, y, R * 1.9);
		g.addColorStop(0, hexA(col.mid, 0.8)); g.addColorStop(1, hexA(col.outer, 0));
		ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R * 1.9, 0, Math.PI * 2); ctx.fill();
		// the ∞ mark that tells it apart
		ctx.globalAlpha = 0.55 + 0.25 * Math.sin(t * 3);
		ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.4;
		const w = R * 0.75, h = R * 0.32;
		ctx.beginPath();
		for(let i = 0; i <= 40; i++){ const a = i / 40 * Math.PI * 2, d = 1 + Math.sin(a) * Math.sin(a); const px = x + w * Math.cos(a) / d, py = y - R * 1.35 + h * Math.sin(a) * Math.cos(a) / d * 2; if(i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
		ctx.stroke();
		// instability: cracks of light reaching out of it
		if(st > 0.3){
			ctx.strokeStyle = hexA(st > 0.7 ? '#ff6a6a' : '#ffffff', 0.4 + 0.5 * st); ctx.lineWidth = 1;
			for(let i = 0; i < 2 + Math.round(st * 5); i++){
				let a = Math.random() * Math.PI * 2, px = x + Math.cos(a) * R, py = y + Math.sin(a) * R;
				ctx.beginPath(); ctx.moveTo(px, py);
				for(let k = 0; k < 3; k++){ a += (Math.random() - 0.5) * 0.9; px += Math.cos(a) * R * 0.35 * (1 + st); py += Math.sin(a) * R * 0.35 * (1 + st); ctx.lineTo(px, py); }
				ctx.stroke();
			}
		}
		ctx.globalAlpha = 1;
	}
	/* a spatial rupture: a hole in space with a violet rim, things streaming into it */
	function drawRupture(ctx, b, x, y, t){
		const R = bodyRadius(b) * (b.alive ? 1 : 1 + Math.min(1, b.dying / 0.35) * 2), a = b.alive ? 1 : 1 - Math.min(1, b.dying / 0.35);
		ctx.save();
		ctx.globalCompositeOperation = 'lighter';
		ctx.globalAlpha = 0.35 * a;
		let g = ctx.createRadialGradient(x, y, R * 0.8, x, y, R * 3.2);
		g.addColorStop(0, hexA('#c9a7ff', 0.9)); g.addColorStop(0.4, hexA('#7a3cff', 0.35)); g.addColorStop(1, hexA('#2a0a5e', 0));
		ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R * 3.2, 0, Math.PI * 2); ctx.fill();
		for(let i = 0; i < 4; i++){
			ctx.globalAlpha = 0.5 * a; ctx.strokeStyle = i % 2 ? '#ffffff' : '#c9a7ff'; ctx.lineWidth = 1.5;
			ctx.beginPath(); ctx.arc(x, y, R * (1.15 + 0.25 * i), t * (3 + i) + i, t * (3 + i) + i + Math.PI * 1.2); ctx.stroke();
		}
		ctx.globalCompositeOperation = 'source-over';
		ctx.globalAlpha = a;
		g = ctx.createRadialGradient(x, y, 0, x, y, R);
		g.addColorStop(0, '#000000'); g.addColorStop(0.8, '#05010d'); g.addColorStop(1, 'rgba(40,10,80,0.8)');
		ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
		ctx.globalCompositeOperation = 'lighter';
		ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.9 * a;
		ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.stroke();
		ctx.restore();
	}
	function drawBody(ctx, b, x, y, t){
		if(b.rupture){ drawRupture(ctx, b, x, y, t); return; }
		if(b.zoneBlob && b.zoneOf && b.zoneOf.amSupp > 0.15){ const j = b.zoneOf.amSupp * 3; x += (Math.random() - 0.5) * j; y += (Math.random() - 0.5) * j; }      // a suppressed zone flickers
		// an Infinity source: its own kind of energy, wrapped in endlessly inward-falling space; stress makes it shake and crackle
		if(b.infSource && b.alive){
			const st = clamp(b.infStress || 0, 0, 1);
			if(st > 0.25){ const j = st * st * 6; x += (Math.random() - 0.5) * j; y += (Math.random() - 0.5) * j; }
			ctx.save(); drawInfinitySource(ctx, b, x, y, t, st); ctx.restore();
		}
		if(b.alive && b.bond){
			// every tether this energy holds
			const own = b.bond;
			for(const B of [ b.bond ].concat(b.bondsX || [])){
				if(!B) continue;
				const tp = B === own ? (B._tp || b._tgtPt) : B._tp; if(!tp) continue;
				const bend = B === own ? (B._bend || b._bendPt) : B._bend;
				b.bond = B;
				drawTether(ctx, b, x, y, tp.x - (b.x - x), tp.y - (b.y - y), t, bend ? { x: bend.x - (b.x - x), y: bend.y - (b.y - y) } : null);
			}
			b.bond = own;
		}
		if(b.hideBody) return;               // a technique has given it another form (portal, surface) and draws that
		if(b.comp > 10 && b.alive && !b.toInventory){ const j = 0.5 + 2.2 * overK(b); x += (Math.random() - 0.5) * j; y += (Math.random() - 0.5) * j; }      // unstable: it trembles
		drawBodyMain(ctx, b, x, y, t);
		if(b.over > 0 && b.alive) drawOverGlow(ctx, b, x, y, t);
	}
	/* over-compressed energy glows from inside its own shape (a sword glows as a sword), with only a thin rim of light */
	/* a Bound tether: a taut, shimmering cord of the energy's colour */
	function drawTether(ctx, b, x0, y0, x1, y1, t, bend){
		const col = bodyColors(b), L = Math.hypot(x1 - x0, y1 - y0) || 1, nx = -(y1 - y0) / L, ny = (x1 - x0) / L;
		const slack = b.bond ? clamp(1 - (L - b.bond.len) / 40, 0, 1) : 0;
		const str = b.bond ? (b.bond.str || 5) / 5 : 1, kin = !!b.bond && Math.abs(techOf(b, 'kinetic')) >= CONFIG.tech.minIntensity;
		ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
		if(bend){
			// a kinetic cord stretched around what it caught
			for(const [w, a, c] of [[6 * str, 0.3, col.outer], [2.6, 0.8, '#ffd84d'], [1, 0.95, '#ffffff']]){
				ctx.strokeStyle = hexA(c, a); ctx.lineWidth = w; ctx.beginPath();
				ctx.moveTo(x0, y0); ctx.lineTo(bend.x, bend.y); ctx.lineTo(x1, y1);
				ctx.stroke();
			}
			ctx.restore(); return;
		}
		for(const [w, a, c] of [[5 * (0.6 + 0.4 * str), 0.25, col.outer], [2.2 * (0.7 + 0.3 * str), 0.7, kin ? '#ffd84d' : col.mid], [0.9, 0.9, '#ffffff']]){
			ctx.strokeStyle = hexA(c, a); ctx.lineWidth = w; ctx.beginPath();
			for(let i = 0; i <= 16; i++){
				const u = i / 16, sag = Math.sin(u * Math.PI) * (6 * slack + 1.5 * Math.sin(t * 8 + u * 9 + b.seed));
				const px = x0 + (x1 - x0) * u + nx * sag, py = y0 + (y1 - y0) * u + ny * sag + Math.sin(u * Math.PI) * 4 * slack;
				if(i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
			}
			ctx.stroke();
		}
		ctx.fillStyle = hexA(col.mid, 0.8); ctx.beginPath(); ctx.arc(x1, y1, 3, 0, Math.PI * 2); ctx.fill();
		ctx.restore();
	}
	function drawOverGlow(ctx, b, x, y, t){
		const o = overK(b), R = bodyRadius(b), col = bodyColorsBase(b);
		const pulse = 0.9 + 0.1 * Math.sin(t * 9 + b.seed);
		const pts = buildOutline(b, x, y, R, t, b._ogPts || (b._ogPts = new Float32Array(N_PTS * 2)));
		const sh = SHAPES[b.shape] || SHAPES.raw, sharp = curForm(b) > 0.72 && !sh.smooth && !!sh.poly;
		ctx.save();
		ctx.globalCompositeOperation = 'lighter';
		// inner heat, clipped to the outline
		ctx.save();
		ctx.beginPath(); tracePath(ctx, pts, sharp); ctx.clip();
		const g = ctx.createRadialGradient(x, y, 0, x, y, R * 1.3);
		g.addColorStop(0, hexA('#ffffff', (0.25 + 0.35 * o) * pulse)); g.addColorStop(1, hexA(col.mid, 0.12 * o));
		ctx.fillStyle = g; ctx.fillRect(x - R * 1.5, y - R * 1.5, R * 3, R * 3);
		ctx.restore();
		// a thin rim that follows the shape
		ctx.shadowColor = col.mid; ctx.shadowBlur = 3 + 4 * o;
		ctx.strokeStyle = hexA(col.mid, 0.25 + 0.3 * o); ctx.lineWidth = 1 + 0.6 * o;
		ctx.beginPath(); tracePath(ctx, pts, sharp); ctx.stroke();
		ctx.restore();
	}
	function drawBodyMain(ctx, b, x, y, t){
		const col = bodyColors(b);
		let R = bodyRadius(b);
		let alpha = 1;
		if(!b.alive){ const k = Math.min(1, b.dying / 0.35); alpha = 1 - k; R *= 1 + k * 0.8; }
		const birth = Math.min(1, b.age * 6); R *= 0.4 + 0.6 * easeOut(birth);
		if(b._zf && b._zf.dark) alpha *= 1 - 0.8 * Math.min(1, b._zf.dark);      // darkness inside a reverse Light zone: it blends in
		if(R < 0.5 || alpha <= 0) return;
		// a technique can give loose energy its own body (a flame, a snowflake …)
		const dtq = b.tech ? dominantTech(b) : null;
		if(dtq){ const dq = Techniques.get(dtq.id); if(dq && dq.drawBody && dq.drawBody(ctx, b, x, y, R, dtq.s, t, alpha)) return; }
		// small or crowded loose energy → stamped frames; big single blobs and anything taking a shape → full detail
		if(!b.over && canSprite(b) && (R <= 26 || LOD_CROWD > 24) && drawBodySprite(ctx, b, x, y, t, R, alpha, col)) return;
		drawBodyFull(ctx, b, x, y, t, R, alpha, col);
	}
	function drawBodyFull(ctx, b, x, y, t, R, alpha, col){
		const dense = clamp(1 / b.scale, 0.2, 8);
		ctx.globalCompositeOperation = 'lighter';
		// outer glow
		const oG = overK(b);
		ctx.globalAlpha = alpha * clamp(0.22 + 0.05 * dense, 0.2, 0.55) * (1 - 0.7 * oG);       // over-compressed: light stays in the shape
		const shG = SHAPES[b.shape] || SHAPES.raw, fG = curForm(b);
		const gr = R * (oG > 0 ? 1.5 : 2.1 + 0.25 / Math.max(0.25, b.scale)) * (shG.front ? 1 + (shG.front - 1) * fG * 0.6 : 1);
		let g = ctx.createRadialGradient(x, y, R * 0.2, x, y, gr);
		g.addColorStop(0, hexA(col.mid, 0.9)); g.addColorStop(0.45, hexA(col.outer, 0.35)); g.addColorStop(1, hexA(col.outer, 0));
		ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, gr, 0, Math.PI * 2); ctx.fill();

		// the mass
		const pts = buildOutline(b, x, y, R, t);
		const sh = SHAPES[b.shape] || SHAPES.raw;
		const f = curForm(b);
		const sharp = f > 0.72 && !sh.smooth && !!sh.poly;
		const front = sh.front ? 1 + (sh.front - 1) * f : 1, thick = sh.thick ? 1 + (sh.thick - 1) * f : 1;
		ctx.globalAlpha = alpha * clamp(0.55 + 0.08 * dense, 0.45, 0.95);
		g = ctx.createRadialGradient(x, y, 0, x, y, R * 1.4 * Math.max(1, front));
		g.addColorStop(0, hexA(col.core, 0.7)); g.addColorStop(0.3, hexA(col.mid, 0.75)); g.addColorStop(0.75, hexA(col.outer, 0.6)); g.addColorStop(1, hexA(col.outer, 0.25));
		ctx.fillStyle = g;
		ctx.beginPath(); tracePath(ctx, pts, sharp);
		const holeK = (b.shape === 'ring' ? f : 0);
		if(sh.hole && holeK > 0.35){
			const inner = buildInner(b, x, y, R * sh.hole * (holeK - 0.35) / 0.65, t);
			tracePath(ctx, inner);
			ctx.fill('evenodd');
		} else ctx.fill();

		// internal flow — currents that follow the form (along the blade of a sword, etc.)
		ctx.save();
		ctx.beginPath(); tracePath(ctx, pts, sharp); ctx.clip();
		const flowSpd = 1.1 + Math.min(4, dense) * 0.8;
		ctx.lineCap = 'round';
		const flows = LOD_CROWD > 40 ? 3 : 5;
		for(let k = 0; k < flows; k++){
			const a0 = t * flowSpd * (k % 2 ? -1 : 1) * (0.7 + k * 0.15) + b.seed + k * 1.7;
			ctx.globalAlpha = alpha * (0.22 + 0.1 * Math.sin(t * 2 + k));
			ctx.strokeStyle = k % 2 ? hexA(col.core, 0.9) : hexA(col.mid, 0.9);
			ctx.lineWidth = Math.max(0.8, R * (0.09 - k * 0.01) * (1 - 0.4 * f));
			const rot = (a0 * 0.6 + b.angle) * (1 - f) + (b.angle + 0.08 * Math.sin(a0)) * f;
			const rx = R * ((0.85 - k * 0.12) * (1 - f) + (front * (0.95 - k * 0.12)) * f);
			const ry = R * ((0.32 + k * 0.06) * (1 - f) + (thick * (0.22 + k * 0.1)) * f);
			const off = R * 0.18 * (1 - f);
			ctx.beginPath();
			ctx.ellipse(x + Math.cos(a0 * 0.7) * off, y + Math.sin(a0 * 0.9) * off, Math.max(0.5, rx), Math.max(0.5, ry), rot, 0, Math.PI * (0.8 + 0.4 * Math.sin(t * 1.3 + k)));
			ctx.stroke();
		}
		// a bright streak running along the shape's spine once it is well formed
		if(f > 0.4 && sh.front > 1.3){
			ctx.globalAlpha = alpha * (f - 0.4) * 1.2;
			const sl = R * sh.front * 0.9, bl = R * sh.back * 0.5;
			const pos = ((t * 1.6 + b.seed) % 1);
			const sx0 = -bl + (sl + bl) * pos;
			ctx.strokeStyle = hexA(col.core, 0.9); ctx.lineWidth = Math.max(1, R * 0.08);
			ctx.beginPath();
			ctx.moveTo(x + Math.cos(b.angle) * (sx0 - R * 0.5), y + Math.sin(b.angle) * (sx0 - R * 0.5));
			ctx.lineTo(x + Math.cos(b.angle) * sx0, y + Math.sin(b.angle) * sx0);
			ctx.stroke();
		}
		ctx.restore();

		// bright unstable heart — stretches along the form as it takes shape
		ctx.globalAlpha = alpha * (0.55 + 0.2 * Math.sin(t * 9 + b.seed)) * clamp(0.6 + dense * 0.15, 0.6, 1);
		const cr = R * (0.42 + 0.06 * Math.sin(t * 7 + b.seed));
		ctx.save();
		ctx.translate(x, y); ctx.rotate(b.angle);
		ctx.scale(Math.max(1, front * 0.85), clamp(thick * 0.9, 0.35, 1));
		const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, cr);
		cg.addColorStop(0, hexA(col.core, 1)); cg.addColorStop(0.5, hexA(col.core, 0.55)); cg.addColorStop(1, hexA(col.mid, 0));
		ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(0, 0, cr, 0, Math.PI * 2); ctx.fill();
		ctx.restore();

		// edge — crisper as the form solidifies
		ctx.globalAlpha = alpha * (0.5 + 0.4 * f);
		ctx.strokeStyle = hexA(f > 0.6 ? col.core : col.mid, 0.85); ctx.lineWidth = 1.2 + f * 0.6;
		ctx.lineJoin = 'round';
		ctx.beginPath(); tracePath(ctx, pts, sharp); ctx.stroke();
		if(b.flash > 0){
			ctx.globalAlpha = alpha * b.flash * 0.8; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5;
			const fp = buildOutline(b, x, y, R * (1 + (1 - b.flash) * 0.6), t, b.flashPts || (b.flashPts = new Float32Array(N_PTS * 2)));
			ctx.beginPath(); tracePath(ctx, fp, sharp); ctx.stroke();
		}
		ctx.globalAlpha = 1;
	}
	function buildInner(b, x, y, R, t){
		if(!b.innerPts) b.innerPts = new Float32Array(N_PTS * 2);
		const p = b.innerPts;
		for(let i = N_PTS - 1, k = 0; i >= 0; i--, k++){
			const th = (i / N_PTS) * Math.PI * 2;
			const n = 0.5 * Math.sin(4 * th - t * 3 + b.seed);
			const r = R * (1 + n * 0.12);
			p[k*2] = x + Math.cos(th) * r; p[k*2+1] = y + Math.sin(th) * r;
		}
		return p;
	}
	/* Zones are invisible — only the blobs of energy they gather (normal bodies) are drawn. */
	function drawZone(){}

	/* =====================================================================
	   SLOT / SAVE HELPERS
	   ===================================================================== */
	function sanitizeSlots(arr, opts){
		opts = opts || {};
		if(!Array.isArray(arr)) return false;
		let changed = false, anyMagic = false;
		for(let i = 0; i < arr.length; i++){
			const sp = arr[i];
			if(!sp) continue;
			if(isWeaponSlot(sp)){       // weapons live in spell slots too (an engraved special carries its own spell)
				anyMagic = true;
				if(opts.dropItems && sp.item){ delete sp.item; changed = true; }      // magical items only last for the run (gone on reload / death)
				if(sp.engraved){ if(isMagicSpell(sp.engraved)) normalize(sp.engraved); else { delete sp.engraved; changed = true; } }
				continue;
			}
			if(!isMagicSpell(sp)){ arr[i] = null; changed = true; continue; }
			normalize(sp); anyMagic = true;
		}
		if(opts.ensureStarter && !anyMagic){ arr[0] = starterSpell(); changed = true; }
		return changed;
	}
	function encode(def){
		const d = clone(def);
		return 'MR1:' + btoa(unescape(encodeURIComponent(JSON.stringify(d))));
	}
	function decode(code){
		try {
			code = String(code || '').trim();
			if(!code.startsWith('MR1:')) return null;
			const d = JSON.parse(decodeURIComponent(escape(atob(code.slice(4)))));
			if(!isMagicSpell(d)) return null;
			if(Object.keys(d.nodes).length > CONFIG.maxRunes) return null;
			if(structureErrors(d).length) return null;
			return normalize(d);
		} catch(e){ return null; }
	}
	function castCooldownFrames(def){
		const n = def && def.nodes ? Object.keys(def.nodes).length : 1;
		return Math.round(10 + n * 1.5);
	}

	/* =====================================================================
	   EXPORT
	   ===================================================================== */
	root.MagicEngine = {
		divideOffsets,
		CONFIG, DIRS, OPPOSITE, CATEGORIES, CATEGORY_MAP, SHAPES, SHAPE_OPTS,
		Runes, defineRune, paramDefaults, paramVisible,
		Conditions, defineCondition, condDefaults,
		Techniques,
		deriveProfile, defaultMagicProfile,
		blankSpell, starterSpell, makeNode, isWeaponSlot, makeWeaponSlot, defaultLink, isMagicSpell, indexOf, structureErrors, normalize,
		validate, createWorld, sanitizeSlots, encode, decode, castCooldownFrames,
		bodyRadius, bodyPower, densityFactor, labelOf,
		Reinforcement, techOf, techList, hasTech, dominantTech, addTech, convertTech, techKey, bodyColors, hexA, TARGET_NOUN,
		remember, memCount, MEM_EVENTS, stateOf, hasState, compMin, gravResist, unstableChance, magicResist, spatialPolarity, INF, speedRange, itemEligible, itemFromBody, itemStats, ITEM_SHAPES,
		_drawBody: drawBody, drawItemIcon, drawItemAt, ITEM_DRAW_SHAPE,
		/* the energy's current outline (shape + raw flow), for techniques that restyle a body */
		outline(b, x, y, R, t){ return buildOutline(b, x, y, R, t, b._olPts || (b._olPts = new Float32Array(N_PTS * 2))); },
		tracePath(ctx, pts, sharp){ tracePath(ctx, pts, sharp); }, N_PTS, curForm
	};
})(typeof window !== 'undefined' ? window : globalThis);
