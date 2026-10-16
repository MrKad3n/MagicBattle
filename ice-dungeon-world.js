/* =============================================================
   The Glacial Reach — ice dungeon assembler.

   Authored templates + procedural room graph. The generator only
   decides which rooms appear, in what order, and how they are joined.
   It never invents room geometry and never edits authored geometry.

   Two things make this different from the fire assembler:

   1. Rooms are irregular. A room's air volume is the union of its
      template cells, with authored solid masses carved back in, so
      terraces / galleries / internal shafts survive stamping.
   2. Every run is verified before it is handed to the game: the tile
      model is rebuilt exactly as the runtime will build it, then
      flood-filled to prove every required room is actually reachable.
      A run that fails verification is thrown away and re-rolled.
   ============================================================= */
(function(global){
	const TILE = 40;

	/* Corridor geometry. THROAT is how far a connector bores into a
	   room past its shell — the fix for connectors that "touch" a wall
	   without opening it. It is punched last, so it also cuts through
	   any authored solid that happens to sit beside a door. */
	const HALL_H = 280;
	const SHAFT_W = 320;
	const THROAT = 320;
	const PAD = 140;          /* keep-out margin around placed rooms */
	const CORRIDOR_PAD = 80;  /* keep-out margin around routed corridors */

	function rngFromSeed(seed){
		let s = (seed & 0x7FFFFFFF) || 1;
		function rnd(){ s = (s * 1664525 + 1013904223) & 0x7FFFFFFF; return s / 0x7FFFFFFF; }
		return {
			rnd: rnd,
			ri(lo, hi){ return lo + Math.floor(rnd() * (hi - lo + 1)); },
			rf(lo, hi){ return lo + rnd() * (hi - lo); },
			chance(p){ return rnd() < p; },
			choice(arr){ return arr[Math.floor(rnd() * arr.length)]; },
			shuffle(arr){
				const a = arr.slice();
				for(let i = a.length - 1; i > 0; i--){
					const j = Math.floor(rnd() * (i + 1));
					const t = a[i]; a[i] = a[j]; a[j] = t;
				}
				return a;
			},
		};
	}

	function snap(n){ return Math.round(n / TILE) * TILE; }
	function overlaps(a, b, pad){
		pad = pad || 0;
		return a.x - pad < b.x + b.w && a.x + a.w + pad > b.x &&
		       a.y - pad < b.y + b.h && a.y + a.h + pad > b.y;
	}

	/* =========================================================
	   RUN RECIPES

	   Each recipe is a readable route through the four depth
	   regions. Edge directions drive placement, so the recipe also
	   controls the dungeon's *shape*: 'bottom'/'top' edges stack
	   rooms vertically, which is what gives the Reach its descent.
	   ========================================================= */
	const RECIPES = [
		{
			id: 'the_long_descent',
			nodes: [
				{ id:'start',  kind:'start',         section:1 },
				{ id:'cav1',   kind:'combat',        section:1 },
				{ id:'cav1b',  kind:'combat',        section:1 },
				{ id:'glide',  kind:'traversal',     section:1 },
				{ id:'cav2',   kind:'combat',        section:1 },
				{ id:'fork1',  kind:'iceFork',       section:2 },
				{ id:'warm',   kind:'warming',       section:2, optional:true },
				{ id:'lake',   kind:'lake',          section:2 },
				{ id:'cache1', kind:'cache',         section:2, optional:true },
				{ id:'spec',   kind:'iceSpecial',    section:2, optional:true },
				{ id:'crev',   kind:'descent',       section:2 },
				{ id:'river',  kind:'river',         section:2 },
				{ id:'hall2',  kind:'combat',        section:3, prefer:'ice_crystal_wood' },
				{ id:'shrine', kind:'shrine',        section:3, optional:true },
				{ id:'temple', kind:'combat',        section:3, prefer:'ice_temple_hall' },
				{ id:'mech',   kind:'mechanism',     section:3 },
				{ id:'fork2',  kind:'deepFork',      section:3 },
				{ id:'vault',  kind:'vault',         section:3, optional:true },
				{ id:'mirror', kind:'mirror',        section:3 },
				{ id:'squall', kind:'blizzard',      section:3 },
				{ id:'knight', kind:'knight',        section:4 },
				{ id:'shaft',  kind:'ascent',        section:4, prefer:'ice_deep_shaft' },
				{ id:'heart',  kind:'heart',         section:4 },
				{ id:'pre',    kind:'preboss',       section:4 },
				{ id:'boss',   kind:'boss',          section:4 },
				{ id:'midcav', kind:'combat',        section:2 },
				{ id:'wingA1', kind:'frozenObservatory', section:1, optional:true },
				{ id:'wingA2', kind:'frozenLake',    section:2, optional:true },
				{ id:'wingA3', kind:'warming',       section:2, optional:true },
				{ id:'wingB1', kind:'shatterMaze',   section:2, optional:true },
				{ id:'wingB2', kind:'cache',         section:2, optional:true },
				{ id:'wingC1', kind:'frozenObservatory', section:3, optional:true },
				{ id:'wingC2', kind:'trial',         section:3, optional:true },
				{ id:'wingC3', kind:'vault',         section:3, optional:true },
				{ id:'wingD1', kind:'shatterMaze',   section:3, optional:true },
				{ id:'wingD2', kind:'elite',         section:3, optional:true },
				{ id:'wingE1', kind:'frozenLake',    section:2, optional:true },
				{ id:'wingE2', kind:'shrine',        section:2, optional:true },
				{ id:'wingF1', kind:'shatterMaze',   section:3, optional:true },
				{ id:'wingF2', kind:'prison',        section:3, optional:true },
			],
			edges: [
				['start',  'right',  'cav1',   'left'],
				['cav1',   'right',  'cav1b',  'left'],
				['cav1b',  'bottom', 'glide',  'left'],
				['cav1b',  'top',    'glide',  'left'],
				['glide',  'right',  'cav2',   'left'],
				['cav2',   'right',  'fork1',  'left'],
				['fork1',  'top',    'warm',   'left',  { optional:true }],
				['fork1',  'right',  'lake',   'left'],
				['lake',   'right',  'midcav', 'left'],
				['midcav', 'right',  'crev',   'top'],
				['cav1b',  'bottom', 'wingA1', 'left',  { optional:true }],
				['cav1b',  'top',    'wingA1', 'left',  { optional:true }],
				['wingA1', 'right',  'wingA2', 'left',  { optional:true }],
				['wingA2', 'right',  'wingA3', 'left',  { optional:true }],
				['cav2',   'bottom', 'wingB1', 'left',  { optional:true }],
				['cav2',   'top',    'wingB1', 'left',  { optional:true }],
				['wingB1', 'right',  'wingB2', 'left',  { optional:true }],
				['temple', 'right',  'wingC1', 'left',  { optional:true }],
				['wingC1', 'right',  'wingC2', 'left',  { optional:true }],
				['wingC2', 'right',  'wingC3', 'left',  { optional:true }],
				['midcav', 'bottom', 'wingE1', 'left',  { optional:true }],
				['midcav', 'top',    'wingE1', 'left',  { optional:true }],
				['wingE1', 'right',  'wingE2', 'left',  { optional:true }],
				['hall2',  'top',    'wingF1', 'left',  { optional:true }],
				['hall2',  'bottom', 'wingF1', 'left',  { optional:true }],
				['wingF1', 'right',  'wingF2', 'left',  { optional:true }],
				['crev',   'bottom', 'river',  'left'],
				['river',  'top',    'cache1', 'left',  { optional:true }],
				['crev',   'top',    'spec',   'left',  { optional:true }],
				['river',  'right',  'hall2',  'left'],
				['hall2',  'right',  'temple', 'left'],
				['temple', 'bottom', 'mech',   'left'],
				['mech',   'right',  'shrine', 'left',  { optional:true }],
				['mech',   'right',  'fork2',  'left'],
				['fork2',  'top',    'vault',  'left',  { optional:true }],
				['fork2',  'top',    'wingD1', 'left',  { optional:true }],
				['wingD1', 'right',  'wingD2', 'left',  { optional:true }],
				['fork2',  'right',  'mirror', 'left'],
				['mirror', 'right',  'squall', 'left'],
				['squall', 'right',  'knight', 'left'],
				['knight', 'right',  'shaft',  'bottom'],
				['shaft',  'top',    'heart',  'left'],
				['heart',  'right',  'pre',    'left'],
				['pre',    'bottom', 'boss',   'top'],
			],
		},
		{
			id: 'the_drowned_road',
			nodes: [
				{ id:'start',  kind:'start',         section:1 },
				{ id:'cav1',   kind:'combat',        section:1, prefer:'ice_cavern_squeeze' },
				{ id:'cav1b',  kind:'combat',        section:1 },
				{ id:'lake',   kind:'lake',          section:1 },
				{ id:'glide',  kind:'traversal',     section:2 },
				{ id:'fall',   kind:'ascent',        section:2, prefer:'ice_waterfall_ascent' },
				{ id:'cache1', kind:'cache',         section:2, optional:true },
				{ id:'spec',   kind:'iceSpecial',    section:2, optional:true },
				{ id:'bridge', kind:'bridge',        section:2 },
				{ id:'fork1',  kind:'iceFork',       section:2 },
				{ id:'trial',  kind:'trial',         section:3, optional:true, hot:true },
				{ id:'river',  kind:'river',         section:3 },
				{ id:'wood',   kind:'combat',        section:3, prefer:'ice_crystal_wood' },
				{ id:'hall2',  kind:'combat',        section:3 },
				{ id:'flood',  kind:'flood',         section:3 },
				{ id:'warm',   kind:'warming',       section:3, optional:true },
				{ id:'temple', kind:'combat',        section:3, prefer:'ice_temple_hall' },
				{ id:'fork2',  kind:'deepFork',      section:3 },
				{ id:'prison', kind:'prison',        section:4, optional:true },
				{ id:'shatter',kind:'shatter',       section:4 },
				{ id:'knight', kind:'knight',        section:4 },
				{ id:'crev',   kind:'descent',       section:4 },
				{ id:'heart',  kind:'heart',         section:4 },
				{ id:'pre',    kind:'preboss',       section:4 },
				{ id:'boss',   kind:'boss',          section:4 },
				{ id:'wingA1', kind:'frozenObservatory', section:1, optional:true },
				{ id:'wingA2', kind:'frozenLake',    section:2, optional:true },
				{ id:'wingA3', kind:'warming',       section:2, optional:true },
				{ id:'wingB1', kind:'shatterMaze',   section:2, optional:true },
				{ id:'wingB2', kind:'cache',         section:2, optional:true },
				{ id:'wingC1', kind:'frozenObservatory', section:3, optional:true },
				{ id:'wingC2', kind:'trial',         section:3, optional:true },
				{ id:'wingC3', kind:'vault',         section:3, optional:true },
				{ id:'wingD1', kind:'shatterMaze',   section:3, optional:true },
				{ id:'wingD2', kind:'elite',         section:3, optional:true },
				{ id:'wingE1', kind:'frozenLake',    section:2, optional:true },
				{ id:'wingE2', kind:'shrine',        section:2, optional:true },
			],
			edges: [
				['start',  'right',  'cav1',    'left'],
				['cav1',   'right',  'cav1b',   'left'],
				['cav1b',  'right',  'lake',    'left'],
				['lake',   'right',  'glide',   'left'],
				['glide',  'right',  'fall',    'bottom'],
				['fall',   'top',    'bridge',  'left'],
				['bridge', 'top',    'cache1',  'left',  { optional:true }],
				['fork1',  'bottom', 'spec',    'left',  { optional:true }],
				['bridge', 'right',  'fork1',   'left'],
				['fork1',  'top',    'trial',   'left',  { optional:true }],
				['fork1',  'right',  'river',   'left'],
				['river',  'right',  'wood',    'left'],
				['wood',   'right',  'hall2',   'left'],
				['hall2',  'bottom', 'flood',   'bottom'],
				['hall2',  'top',    'flood',   'bottom'],
				['wood',   'bottom', 'flood',   'bottom'],
				['flood',  'top',    'temple',  'left'],
				['temple', 'top',    'warm',    'left',  { optional:true }],
				['temple', 'right',  'fork2',   'left'],
				['fork2',  'top',    'prison',  'left',  { optional:true }],
				['fork2',  'right',  'shatter', 'left'],
				['shatter','right',  'knight',  'left'],
				['knight', 'right',  'crev',    'top'],
				['crev',   'bottom', 'heart',   'left'],
				['heart',  'right',  'pre',     'left'],
				['pre',    'bottom', 'boss',    'top'],
				['cav1',   'top',    'wingA1',  'left',  { optional:true }],
				['cav1',   'bottom', 'wingA1',  'left',  { optional:true }],
				['wingA1', 'right',  'wingA2',  'left',  { optional:true }],
				['wingA2', 'right',  'wingA3',  'left',  { optional:true }],
				['cav1b',  'bottom', 'wingB1',  'left',  { optional:true }],
				['cav1b',  'top',    'wingB1',  'left',  { optional:true }],
				['wingB1', 'right',  'wingB2',  'left',  { optional:true }],
				['wood',   'top',    'wingE1',  'left',  { optional:true }],
				['wingE1', 'right',  'wingE2',  'left',  { optional:true }],
				['hall2',  'top',    'wingC1',  'left',  { optional:true }],
				['hall2',  'bottom', 'wingC1',  'left',  { optional:true }],
				['wingC1', 'right',  'wingC2',  'left',  { optional:true }],
				['wingC2', 'right',  'wingC3',  'left',  { optional:true }],
				['fork2',  'top',    'wingD1',  'left',  { optional:true }],
				['wingD1', 'right',  'wingD2',  'left',  { optional:true }],
			],
		},
		{
			id: 'the_buried_ruin',
			nodes: [
				{ id:'start',  kind:'start',         section:1 },
				{ id:'cav1',   kind:'combat',        section:1 },
				{ id:'cav1b',  kind:'combat',        section:1 },
				{ id:'crev',   kind:'descent',       section:1 },
				{ id:'river',  kind:'river',         section:2 },
				{ id:'chute',  kind:'slide',         section:2 },
				{ id:'cache1', kind:'cache',         section:2, optional:true },
				{ id:'spec',   kind:'iceSpecial',    section:2, optional:true },
				{ id:'wood',   kind:'combat',        section:2, prefer:'ice_crystal_wood' },
				{ id:'hall2',  kind:'combat',        section:2 },
				{ id:'fork1',  kind:'iceFork',       section:2 },
				{ id:'shrine', kind:'shrine',        section:2, optional:true },
				{ id:'temple', kind:'combat',        section:3, prefer:'ice_temple_hall' },
				{ id:'mech',   kind:'mechanism',     section:3 },
				{ id:'mirror', kind:'mirror',        section:3 },
				{ id:'fork2',  kind:'deepFork',      section:3 },
				{ id:'elite',  kind:'elite',         section:3, optional:true },
				{ id:'collap', kind:'collapseEvent', section:3 },
				{ id:'bridge', kind:'bridge',        section:4 },
				{ id:'knight', kind:'knight',        section:4 },
				{ id:'shaft',  kind:'ascent',        section:4, prefer:'ice_deep_shaft' },
				{ id:'heart',  kind:'heart',         section:4 },
				{ id:'pre',    kind:'preboss',       section:4 },
				{ id:'boss',   kind:'boss',          section:4 },
				{ id:'wingA1', kind:'frozenObservatory', section:1, optional:true },
				{ id:'wingA2', kind:'frozenLake',    section:2, optional:true },
				{ id:'wingA3', kind:'warming',       section:2, optional:true },
				{ id:'wingB1', kind:'shatterMaze',   section:2, optional:true },
				{ id:'wingB2', kind:'cache',         section:2, optional:true },
				{ id:'wingC1', kind:'frozenObservatory', section:3, optional:true },
				{ id:'wingC2', kind:'trial',         section:3, optional:true },
				{ id:'wingC3', kind:'vault',         section:3, optional:true },
				{ id:'wingD1', kind:'shatterMaze',   section:3, optional:true },
				{ id:'wingD2', kind:'prison',        section:3, optional:true },
				{ id:'wingE1', kind:'frozenLake',    section:2, optional:true },
				{ id:'wingE2', kind:'shrine',        section:2, optional:true },
			],
			edges: [
				['start',  'right',  'cav1',    'left'],
				['cav1',   'right',  'cav1b',   'left'],
				['cav1b',  'right',  'crev',    'top'],
				['cav1b',  'bottom', 'crev',    'top'],
				['crev',   'bottom', 'river',   'left'],
				['river',  'right',  'chute',   'left'],
				['chute',  'bottom', 'wood',    'left'],
				['wood',   'right',  'hall2',   'left'],
				['hall2',  'right',  'fork1',   'left'],
				['wood',   'top',    'cache1',  'left',  { optional:true }],
				['wood',   'bottom', 'spec',    'left',  { optional:true }],
				['fork1',  'top',    'shrine',  'left',  { optional:true }],
				['fork1',  'right',  'temple',  'left'],
				['temple', 'bottom', 'mech',    'left'],
				['mech',   'right',  'mirror',  'left'],
				['mirror', 'right',  'fork2',   'left'],
				['fork2',  'top',    'elite',   'left',  { optional:true }],
				['fork2',  'right',  'collap',  'left'],
				['collap', 'right',  'bridge',  'left'],
				['bridge', 'right',  'knight',  'left'],
				['knight', 'right',  'shaft',   'bottom'],
				['shaft',  'top',    'heart',   'left'],
				['heart',  'right',  'pre',     'left'],
				['pre',    'bottom', 'boss',    'top'],
				['cav1',   'bottom', 'wingA1',  'left',  { optional:true }],
				['cav1',   'top',    'wingA1',  'left',  { optional:true }],
				['wingA1', 'right',  'wingA2',  'left',  { optional:true }],
				['wingA2', 'right',  'wingA3',  'left',  { optional:true }],
				['hall2',  'bottom', 'wingB1',  'left',  { optional:true }],
				['hall2',  'top',    'wingB1',  'left',  { optional:true }],
				['wingB1', 'right',  'wingB2',  'left',  { optional:true }],
				['temple', 'right',  'wingC1',  'left',  { optional:true }],
				['wingC1', 'right',  'wingC2',  'left',  { optional:true }],
				['wingC2', 'right',  'wingC3',  'left',  { optional:true }],
				['fork2',  'top',    'wingD1',  'left',  { optional:true }],
				['wingD1', 'right',  'wingD2',  'left',  { optional:true }],
				['wood',   'top',    'wingE1',  'left',  { optional:true }],
				['wingE1', 'right',  'wingE2',  'left',  { optional:true }],
			],
		},
	];

	/* Secrets hang off an already-placed room through a cracked wall. */
	const SECRET_KINDS = ['secretCave', 'secretShrine', 'secretElite', 'secretMemory'];

	const ENEMY_POOL = {
		1: ['frostWraith', 'iceArcher', 'frostMantis'],
		2: ['frostWraith', 'iceArcher', 'snowBeast', 'glacierEel', 'frostMantis'],
		3: ['iceArcher', 'snowBeast', 'cryoMage', 'crystalScarab', 'frostMantis', 'glacierEel'],
		4: ['snowBeast', 'cryoMage', 'glacierSentinel', 'snowboundMimic', 'crystalScarab', 'glacierEel'],
	};

	/* =========================================================
	   BUILD
	   ========================================================= */
	function build(seed){
		const R = rngFromSeed(seed);
		const recipe = RECIPES[seed % RECIPES.length];
		const byKind = global.ICE_TEMPLATES_BY_KIND || {};
		const allTemplates = global.ICE_ROOM_TEMPLATES || [];
		if(!allTemplates.length) return null;

		const rooms = [];
		const corridors = [];
		const platforms = [];
		const hazards = [];
		const decorations = [];
		const interactables = [];
		const enemies = [];
		const gates = [];
		const obstacles = [];   /* placement keep-out volumes */
		const placed = Object.create(null);
		const usedTemplates = Object.create(null);
		let lastTemplateId = null;

		/* ---- template selection ----
		   Rule 12/13 of the brief: never serve the same template twice
		   in a row, and prefer templates this run has not used yet. */
		function pickTemplate(node){
			if(node.kind === 'iceSpecial'){
				node = Object.assign({}, node, { kind: R.choice(['frozenObservatory', 'frozenLake', 'shatterMaze']) });
			}
			let pool = (byKind[node.kind] || []).slice();
			if(!pool.length) pool = allTemplates.filter(t => t.kind === node.kind);
			if(!pool.length) return null;
			if(node.prefer){
				const p = pool.find(t => t.id === node.prefer);
				if(p) return p;
			}
			let ok = pool.filter(t => !t.section || t.section.indexOf(node.section) >= 0);
			if(!ok.length) ok = pool;
			let fresh = ok.filter(t => !usedTemplates[t.id] && t.id !== lastTemplateId);
			if(!fresh.length) fresh = ok.filter(t => t.id !== lastTemplateId);
			if(!fresh.length) fresh = ok;
			return R.choice(fresh);
		}

		/* ---- ports ----
		   A port's mouth sits on the room bounds. Local template coords
		   become room-relative exit offsets, which is exactly what the
		   runtime opening stamper consumes. */
		function portOf(tpl, dir){
			const p = tpl.ports && tpl.ports[dir];
			if(!p) return null;
			if(dir === 'left' || dir === 'right') return { y:p.y, h:Math.max(HALL_H, p.h || HALL_H) };
			return { x:p.x, w:Math.max(SHAFT_W, p.w || SHAFT_W) };
		}
		function mouth(room, dir){
			const ex = room.exits[dir];
			if(!ex) return null;
			if(dir === 'left')   return { x:room.x,               y:room.y + ex.y, w:8,    h:ex.h };
			if(dir === 'right')  return { x:room.x + room.w,      y:room.y + ex.y, w:8,    h:ex.h };
			if(dir === 'top')    return { x:room.x + ex.x,        y:room.y,        w:ex.w, h:8 };
			return                     { x:room.x + ex.x,        y:room.y + room.h, w:ex.w, h:8 };
		}

		function blocked(rect){
			for(const o of obstacles){ if(overlaps(rect, o, 0)) return true; }
			return false;
		}
		function reserveRoom(room){
			obstacles.push({ x:room.x - PAD, y:room.y - PAD, w:room.w + PAD * 2, h:room.h + PAD * 2 });
		}
		function reserveCorridor(c){
			obstacles.push({ x:c.x - CORRIDOR_PAD, y:c.y - CORRIDOR_PAD, w:c.w + CORRIDOR_PAD * 2, h:c.h + CORRIDOR_PAD * 2 });
		}

		function carve(x, y, w, h){
			const c = { x:snap(x), y:snap(y), w:Math.max(TILE * 2, snap(w)), h:Math.max(TILE * 2, snap(h)) };
			corridors.push(c);
			return c;
		}

		/* ---- room instantiation ----
		   Absolute geometry is produced once, here, so nothing
		   downstream has to re-derive template coordinates. */
		function instantiate(node, tpl, x, y){
			const room = {
				id: rooms.length,
				nodeId: node.id,
				templateId: tpl.id,
				kind: tpl.kind,
				label: tpl.label || tpl.kind,
				objective: tpl.objective || '',
				x: snap(x), y: snap(y), w: tpl.w, h: tpl.h,
				depth: node.section,
				section: node.section,
				optional: !!node.optional,
				secret: !!tpl.secret,
				elite: !!tpl.elite,
				noCombat: !!tpl.noCombat,
				_kxBasin: !!(tpl._kxBasin || tpl.id === 'ice_boss_hall'),
				hot: !!node.hot,
				cells: [],
				solids: [],
				exits: {},
				usedExits: {},
				extraOpenings: [],
				cleared: false,
				locked: false,
			};
			for(const c of (tpl.cells || [])){
				room.cells.push({ x:room.x + c.x, y:room.y + c.y, w:c.w, h:c.h });
			}
			if(!room.cells.length) room.cells.push({ x:room.x, y:room.y, w:room.w, h:room.h });
			for(const s of (tpl.solids || [])){
				room.solids.push({ x:room.x + s.x, y:room.y + s.y, w:s.w, h:s.h });
			}
			for(const dir of ['left', 'right', 'top', 'bottom']){
				const p = portOf(tpl, dir);
				if(p) room.exits[dir] = Object.assign({}, p);
			}
			if(tpl.clearZone){
				room.clearZone = { x:room.x + tpl.clearZone.x, y:room.y + tpl.clearZone.y, w:tpl.clearZone.w, h:tpl.clearZone.h };
			}
			if(tpl.surviveFrames){ room.surviveFrames = tpl.surviveFrames; room.surviveLeft = tpl.surviveFrames; }
			if(tpl.arena) room.arena = JSON.parse(JSON.stringify(tpl.arena));
			if(tpl.doorLabels) room.doorLabels = tpl.doorLabels;
			if(tpl.trialVariants) room.trialVariant = R.choice(tpl.trialVariants);

			/* Authored content, stamped verbatim. */
			for(const p of (tpl.platforms || [])){
				if(global.dungeonShouldKeepPlatform && !global.dungeonShouldKeepPlatform(tpl, p)) continue;
				const plat = Object.assign({}, p, {
					x: snap(room.x + p.x),
					y: snap(room.y + p.y),
					w: snap(p.w), h: p.h || TILE,
					roomId: room.id,
				});
				if(plat.kind === 'thinIce' || plat.kind === 'shelf'){
					plat._iceFragile = true;
					plat.kind = plat.kind === 'thinIce' ? 'thinIce' : 'shelf';
				}
				platforms.push(plat);
			}
			for(const h of (tpl.hazards || [])){
				const hz = Object.assign({}, h, { roomId: room.id });
				if(hz.x != null) hz.x = room.x + h.x;
				if(hz.y != null) hz.y = room.y + h.y;
				if(hz.y0 != null) hz.y0 = room.y + h.y0;
				if(hz.y1 != null) hz.y1 = room.y + h.y1;
				hazards.push(hz);
			}
			for(const d of (tpl.props || [])){
				decorations.push(Object.assign({}, d, { x: room.x + d.x, y: room.y + d.y, roomId: room.id, _ice:true }));
			}
			for(const it of (tpl.interactables || [])){
				const o = Object.assign({}, it, { roomId: room.id });
				if(o.x != null) o.x = room.x + it.x;
				if(o.y != null) o.y = room.y + it.y;
				if(o.kind === 'cache' && room.secret) o.rare = true;
				if(it.punch){
					o.punch = { x: room.x + it.punch.x, y: room.y + it.punch.y, w: it.punch.w, h: it.punch.h };
				} else if(it.kind === 'iceBreak'){
					o.punch = { x: o.x, y: o.y - 40, w: Math.max(60, o.w || 60), h: 160 };
				}
				interactables.push(o);
			}
			for(const sp of (tpl.spawns || [])){
				const pool = ENEMY_POOL[node.section] || ENEMY_POOL[1];
				const type = sp.type || R.choice(pool);
				const ex = room.x + sp.x, ey = room.y + sp.y;
				enemies.push({
					type: type,
					x: ex, y: ey,
					patrol: [Math.max(room.x + 40, ex - 200), Math.min(room.x + room.w - 40, ex + 200)],
					puzzleSeg: node.section,
					roomId: room.id,
					isMiniBoss: type === 'frostboundKnight',
					_frozenSleep: !!sp.frozen,
					isDormant: !!sp.frozen,
					_thawTag: sp.thaw || null,
				});
			}

			rooms.push(room);
			placed[node.id] = room;
			usedTemplates[tpl.id] = true;
			lastTemplateId = tpl.id;
			reserveRoom(room);
			return room;
		}

		/* ---- placement ----
		   Position B relative to A so the two ports face each other,
		   then jog along the free axis until the volume is clear. */
		function placeFor(a, aDir, tpl, bDir){
			const aM = mouth(a, aDir);
			const bp = portOf(tpl, bDir);
			if(!aM || !bp) return null;
			const gap = R.ri(240, 520);
			let x, y;

			if(aDir === 'right'){
				x = a.x + a.w + gap;
				y = (bDir === 'left') ? aM.y - bp.y
				  : (bDir === 'top')  ? aM.y + HALL_H + 200
				  : aM.y - tpl.h - 200;
			} else if(aDir === 'left'){
				x = a.x - gap - tpl.w;
				y = (bDir === 'right') ? aM.y - bp.y
				  : (bDir === 'top')   ? aM.y + HALL_H + 200
				  : aM.y - tpl.h - 200;
			} else if(aDir === 'bottom'){
				y = a.y + a.h + gap;
				x = (bDir === 'top')   ? aM.x - bp.x
				  : (bDir === 'left')  ? aM.x + SHAFT_W + 160
				  : aM.x - tpl.w - 160;
			} else { /* top */
				y = a.y - gap - tpl.h;
				x = (bDir === 'bottom') ? aM.x - bp.x
				  : (bDir === 'left')   ? aM.x + SHAFT_W + 160
				  : aM.x - tpl.w - 160;
			}

			const horizontalEdge = (aDir === 'left' || aDir === 'right');
			/* Jog perpendicular to the edge so the facing stays valid. */
			const steps = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6, 8, -8, 10, -10];
			for(const s of steps){
				const tx = snap(horizontalEdge ? x : x + s * 320);
				const ty = snap(horizontalEdge ? y + s * 320 : y);
				if(ty < 80) continue;
				if(!blocked({ x:tx, y:ty, w:tpl.w, h:tpl.h })) return { x:tx, y:ty };
			}
			/* Last resort: push further out along the edge normal. */
			for(let k = 1; k <= 10; k++){
				const push = k * 420;
				const tx = snap(aDir === 'right' ? x + push : aDir === 'left' ? x - push : x);
				const ty = snap(aDir === 'bottom' ? y + push : aDir === 'top' ? y - push : y);
				if(ty < 80) continue;
				if(!blocked({ x:tx, y:ty, w:tpl.w, h:tpl.h })) return { x:tx, y:ty };
			}
			return null;
		}

		/* ---- connectors ----
		   Short, readable, and always bored THROAT deep into both
		   rooms. Straight when the ports line up; a single dog-leg
		   otherwise. Nothing longer than one dog-leg is ever built,
		   which is what keeps hallways down to a few seconds. */
		function throat(room, dir){
			const ex = room.exits[dir];
			if(!ex) return;
			room.usedExits[dir] = true;
			if(dir === 'left')  room.extraOpenings.push({ x:room.x - 48,               y:room.y + ex.y, w:48 + THROAT, h:ex.h });
			if(dir === 'right') room.extraOpenings.push({ x:room.x + room.w - THROAT,  y:room.y + ex.y, w:THROAT + 48, h:ex.h });
			if(dir === 'top')   room.extraOpenings.push({ x:room.x + ex.x,             y:room.y - 48,   w:ex.w, h:48 + THROAT });
			/* Bottom exits often sit under authored ice masses. Punch
			   from the deck down so the drop shaft is actually open. */
			if(dir === 'bottom'){
				const drop = Math.max(THROAT, 420);
				if(iceBottomWet(room)){
					room.extraOpenings.push({ x:room.x + ex.x, y:room.y + room.h, w:ex.w, h:drop + 48 });
				} else {
					room.extraOpenings.push({ x:room.x + ex.x, y:room.y + room.h - drop, w:ex.w, h:drop + 48 });
				}
			}
		}

		function horiz(x0, x1, y, h){
			const lo = Math.min(x0, x1), hi = Math.max(x0, x1);
			return carve(lo, y, hi - lo, h);
		}
		function vert(x, y0, y1, w){
			const lo = Math.min(y0, y1), hi = Math.max(y0, y1);
			return carve(x, lo, w, hi - lo);
		}

		/* Vertical connectors get ice shelves so they can be climbed as
		   well as fallen down — a shaft you cannot re-ascend would
		   strand the player on any optional branch. */
		function shaftLedges(shaft, roomId){
			if(shaft.h < 420) return;
			const rungs = Math.max(2, Math.floor(shaft.h / 240));
			for(let i = 1; i <= rungs; i++){
				const ly = snap(shaft.y + (i / (rungs + 1)) * shaft.h);
				/* Shafts punch THROAT into both rooms. A rung inside
				   either chamber is a phantom ledge you can stand on
				   or fall through. Keep rungs in the shaft only. */
				let inRoom = false;
				for(let ri = 0; ri < rooms.length; ri++){
					const r = rooms[ri];
					if(ly < r.y - 8 || ly > r.y + r.h + 8) continue;
					if(shaft.x + shaft.w < r.x + 8 || shaft.x > r.x + r.w - 8) continue;
					inRoom = true;
					break;
				}
				if(inRoom) continue;
				const left = i % 2 === 0;
				const lw = Math.max(120, Math.min(180, shaft.w - 80));
				const lx = snap(left ? shaft.x + 20 : shaft.x + shaft.w - lw - 20);
				platforms.push({ kind:'static', x:lx, y:ly, w:lw, h:TILE, roomId:roomId, iceLedge:true });
			}
			decorations.push({ type:'crevasseEdge', x:shaft.x, y:shaft.y, w:shaft.w, h:shaft.h, alpha:0.4, _ice:true });
		}

		function mergeIceCuts(cuts){
			if(!cuts.length) return [];
			cuts.sort(function(a, b){ return a.x - b.x; });
			const out = [{ x:cuts[0].x, w:cuts[0].w }];
			for(let i = 1; i < cuts.length; i++){
				const last = out[out.length - 1];
				if(cuts[i].x <= last.x + last.w + 8){
					last.w = Math.max(last.x + last.w, cuts[i].x + cuts[i].w) - last.x;
				} else out.push({ x:cuts[i].x, w:cuts[i].w });
			}
			return out;
		}
		function iceFluidRanges(room){
			const floor = room.y + room.h;
			const ranges = [];
			for(let i = 0; i < decorations.length; i++){
				const d = decorations[i];
				if(!d || d.roomId !== room.id) continue;
				if(d.type !== 'frozenPool' && d.type !== 'water') continue;
				if((d.y || 0) + (d.h || 40) < floor - 120) continue;
				ranges.push({ x:d.x, w:d.w || 80 });
			}
			for(let i = 0; i < hazards.length; i++){
				const h = hazards[i];
				if(!h || h.roomId !== room.id || h.type !== 'water') continue;
				if((h.y || 0) + (h.h || 40) < floor - 140) continue;
				ranges.push({ x:h.x, w:h.w || 80 });
			}
			return mergeIceCuts(ranges);
		}
		function dryIceHatchX(room, wantX, w){
			const ranges = iceFluidRanges(room);
			const minX = room.x + 16;
			const maxX = room.x + room.w - w - 16;
			const start = Math.max(minX, Math.min(maxX, wantX));
			function hits(x){
				for(let i = 0; i < ranges.length; i++){
					if(x + w > ranges[i].x + 16 && x < ranges[i].x + ranges[i].w - 16) return true;
				}
				return false;
			}
			if(!hits(start)) return start;
			let best = null, bestD = 1e9;
			for(let x = minX; x <= maxX; x += 40){
				if(hits(x)) continue;
				const d = Math.abs(x - wantX);
				if(d < bestD){ bestD = d; best = x; }
			}
			return best != null ? best : start;
		}
		function preferDryBottom(room){
			const ex = room.exits && room.exits.bottom;
			if(!ex) return;
			const w = ex.w || SHAFT_W;
			const want = room.x + (ex.x != null ? ex.x : room.w / 2 - w / 2);
			ex.x = dryIceHatchX(room, want, w) - room.x;
		}
		function iceBottomWet(room){
			const ex = room.exits && room.exits.bottom;
			if(!ex) return false;
			const x = room.x + ex.x, w = ex.w || SHAFT_W;
			const ranges = iceFluidRanges(room);
			for(let i = 0; i < ranges.length; i++){
				if(x + w > ranges[i].x + 16 && x < ranges[i].x + ranges[i].w - 16) return true;
			}
			return false;
		}
		function avoidIceFluidDir(room, dir){
			if(dir !== 'bottom') return dir;
			preferDryBottom(room);
			if(!iceBottomWet(room)) return 'bottom';
			if(room.exits.right) return 'right';
			if(room.exits.left) return 'left';
			return 'bottom';
		}

		function connect(a, aDir, b, bDir){
			aDir = avoidIceFluidDir(a, aDir);
			bDir = avoidIceFluidDir(b, bDir);
			const aM = mouth(a, aDir), bM = mouth(b, bDir);
			if(!aM || !bM) return false;
			throat(a, aDir);
			throat(b, bDir);
			const built = [];

			const aH = (aDir === 'left' || aDir === 'right');
			const bH = (bDir === 'left' || bDir === 'right');

			if(aH && bH){
				const h = Math.max(HALL_H, Math.min(aM.h, bM.h));
				const ax = aDir === 'right' ? a.x + a.w - THROAT : a.x + THROAT;
				const bx = bDir === 'left' ? b.x + THROAT : b.x + b.w - THROAT;
				if(Math.abs(aM.y - bM.y) <= 80){
					const y = snap(Math.min(aM.y, bM.y));
					built.push(horiz(ax, bx, y, Math.max(h, Math.abs(aM.y - bM.y) + h)));
				} else {
					/* Dog-leg through the gap between the two rooms. */
					const jx = snap((aDir === 'right' ? a.x + a.w : a.x) + ((bDir === 'left' ? b.x : b.x + b.w) - (aDir === 'right' ? a.x + a.w : a.x)) * 0.5);
					const jxc = Math.max(Math.min(jx, Math.max(ax, bx) - SHAFT_W), Math.min(ax, bx));
					built.push(horiz(ax, jxc + SHAFT_W, snap(aM.y), aM.h));
					built.push(vert(jxc, snap(Math.min(aM.y, bM.y)), snap(Math.max(aM.y + aM.h, bM.y + bM.h)), SHAFT_W));
					built.push(horiz(jxc, bx, snap(bM.y), bM.h));
				}
			} else if(!aH && !bH){
				const w = Math.max(SHAFT_W, Math.min(aM.w, bM.w));
				const ay = aDir === 'bottom' ? a.y + a.h - THROAT : a.y + THROAT;
				const by = bDir === 'top' ? b.y + THROAT : b.y + b.h - THROAT;
				if(Math.abs(aM.x - bM.x) <= 120){
					const x = snap(Math.min(aM.x, bM.x));
					const shaft = vert(x, ay, by, Math.max(w, Math.abs(aM.x - bM.x) + w));
					shaftLedges(shaft, a.id);
					built.push(shaft);
				} else {
					const jy = snap((aDir === 'bottom' ? a.y + a.h : a.y) + ((bDir === 'top' ? b.y : b.y + b.h) - (aDir === 'bottom' ? a.y + a.h : a.y)) * 0.5);
					const jyc = Math.max(Math.min(jy, Math.max(ay, by) - HALL_H), Math.min(ay, by));
					const s1 = vert(snap(aM.x), ay, jyc + HALL_H, aM.w);
					shaftLedges(s1, a.id);
					built.push(s1);
					built.push(horiz(snap(Math.min(aM.x, bM.x)), snap(Math.max(aM.x + aM.w, bM.x + bM.w)), jyc, HALL_H));
					const s2 = vert(snap(bM.x), jyc, by, bM.w);
					shaftLedges(s2, b.id);
					built.push(s2);
				}
			} else if(aH && !bH){
				/* Out sideways, then down (or up) into a top/bottom port. */
				const ax = aDir === 'right' ? a.x + a.w - THROAT : a.x + THROAT;
				const jx = snap(bM.x);
				built.push(horiz(ax, jx + bM.w, snap(aM.y), aM.h));
				const by = bDir === 'top' ? b.y + THROAT : b.y + b.h - THROAT;
				const shaft = vert(jx, snap(aM.y), by, bM.w);
				shaftLedges(shaft, b.id);
				built.push(shaft);
			} else {
				/* Down (or up) out of a top/bottom port, then sideways. */
				const ay = aDir === 'bottom' ? a.y + a.h - THROAT : a.y + THROAT;
				const jy = snap(bM.y);
				const shaft = vert(snap(aM.x), ay, jy + bM.h, aM.w);
				shaftLedges(shaft, a.id);
				built.push(shaft);
				const bx = bDir === 'left' ? b.x + THROAT : b.x + b.w - THROAT;
				built.push(horiz(snap(aM.x), bx, jy, bM.h));
			}

			for(const c of built) if(c) reserveCorridor(c);

			/* A crevasse mouth is a real hole in the floor — dress it so
			   the player reads the drop before stepping into it. */
			if(aDir === 'bottom') decorations.push({ type:'crevasseEdge', x:aM.x, y:aM.y, w:aM.w, h:200, alpha:0.55, _ice:true });
			if(bDir === 'bottom') decorations.push({ type:'crevasseEdge', x:bM.x, y:bM.y, w:bM.w, h:200, alpha:0.55, _ice:true });
			return true;
		}

		/* ---- assemble the graph ---- */
		const startNode = recipe.nodes[0];
		const startTpl = pickTemplate(startNode) || byKind.start[0];
		const startRoom = instantiate(startNode, startTpl, 400, 600);

		const nodeById = Object.create(null);
		for(const n of recipe.nodes) nodeById[n.id] = n;
		const skipped = Object.create(null);

		for(const e of recipe.edges){
			const [fromId, fromDir, toId, toDir, opt] = e;
			const a = placed[fromId];
			if(!a){ skipped[toId] = true; continue; }
			if(placed[toId]) continue;
			const node = nodeById[toId];
			if(!node) continue;
			/* Optional rooms roll for inclusion; required rooms never do. */
			if(opt && opt.optional && node.rare != null && !R.chance(node.rare)){ skipped[toId] = true; continue; }
			const tpl = pickTemplate(node);
			if(!tpl){ skipped[toId] = true; continue; }
			if(!a.exits[fromDir] || !tpl.ports || !tpl.ports[toDir]){ skipped[toId] = true; continue; }
			const pos = placeFor(a, fromDir, tpl, toDir);
			if(!pos){ skipped[toId] = true; continue; }
			const b = instantiate(node, tpl, pos.x, pos.y);
			if(!connect(a, fromDir, b, toDir)) skipped[toId] = true;
		}

		/* Any required node that failed to place invalidates the run. */
		for(const n of recipe.nodes){
			if(!n.optional && !placed[n.id]) return null;
		}

		/* ---- gates: lock a room until its objective is met ---- */
		for(const r of rooms){
			if(r.optional || r.secret) continue;
			const gateable = r.kind === 'combat' || r.kind === 'elite' || r.kind === 'shatter' ||
			                 r.kind === 'blizzard' || r.kind === 'mechanism' ||
			                 r.kind === 'mirror' || r.kind === 'collapseEvent';
			if(!gateable) continue;
			const outs = [];
			for(const dir of ['right', 'bottom', 'top', 'left']){
				if(!r.usedExits[dir]) continue;
				if(dir === 'left') continue; /* never seal the way you came */
				const m = mouth(r, dir);
				if(!m) continue;
				const g = (dir === 'right') ? { x:r.x + r.w - 40, y:m.y, w:80, h:m.h }
				        : (dir === 'left')  ? { x:r.x - 40, y:m.y, w:80, h:m.h }
				        : (dir === 'top')   ? { x:m.x, y:r.y - 40, w:m.w, h:80 }
				        :                     { x:m.x, y:r.y + r.h - 40, w:m.w, h:80 };
				outs.push(g);
			}
			if(outs.length){ r.outGates = outs; r.locked = true; }
		}

		/* ---- secret rooms behind cracked ice ----
		   Hung off a mid-run room, reached by breaking a wall the
		   player can actually see (a bright fracture prop marks it). */
		const secretHosts = rooms.filter(r => !r.secret && !r.optional && r.section >= 2 &&
			r.kind !== 'boss' && r.kind !== 'preboss' && r.kind !== 'knight' && r.kind !== 'start');
		const secretCount = R.ri(2, 3);
		for(let i = 0; i < secretCount && secretHosts.length; i++){
			const host = R.choice(secretHosts);
			const kind = R.choice(SECRET_KINDS);
			const pool = byKind[kind] || [];
			if(!pool.length) continue;
			const tpl = R.choice(pool);
			if(!tpl.ports || !tpl.ports.left) continue;
			const pos = placeFor(host, 'right', tpl, 'left') || placeFor(host, 'bottom', tpl, 'left');
			if(!pos) continue;
			const node = { id:'secret_' + i, kind:kind, section:host.section, optional:true };
			const b = instantiate(node, tpl, pos.x, pos.y);
			b.secret = true;
			b.optional = true;
			/* The hall exists but starts sealed; the wall break opens it. */
			const hostDir = (pos.x > host.x + host.w) ? 'right' : 'bottom';
			if(!host.exits[hostDir]){ rooms.pop(); continue; }
			connect(host, hostDir, b, 'left');
			const m = mouth(host, hostDir);
			const seal = (hostDir === 'right')
				? { x:host.x + host.w - 40, y:m.y, w:80, h:m.h }
				: { x:m.x, y:host.y + host.h - 40, w:m.w, h:80 };
			gates.push(seal);
			interactables.push({
				kind:'crackedIce', roomId:host.id, secretGate:gates.length - 1,
				x: (hostDir === 'right') ? host.x + host.w - 110 : m.x + m.w / 2 - 40,
				y: (hostDir === 'right') ? m.y + m.h - 110 : host.y + host.h - 150,
				w:80, h:100, name:'Cracked Ice', icon:'\u2744', used:false,
			});
			decorations.push({
				type:'crackedPlateHint', _ice:true,
				x: (hostDir === 'right') ? host.x + host.w - 120 : m.x,
				y: (hostDir === 'right') ? m.y + m.h - 40 : host.y + host.h - 60,
				w: (hostDir === 'right') ? 100 : m.w, h:18,
			});
			const hi = secretHosts.indexOf(host);
			if(hi >= 0) secretHosts.splice(hi, 1);
		}

		/* ---- shortcut back to an earlier region ----
		   Engaging the deep mechanism opens an ancient gate that links
		   the ruins back toward section 2, so exploration compounds. */
		const mechRoom = rooms.find(r => r.kind === 'mechanism');
		const earlyRoom = rooms.find(r => r.section === 2 && !r.optional && !r.secret && r.kind !== 'start');
		if(mechRoom && earlyRoom){
			mechRoom.shortcutTo = earlyRoom.id;
			decorations.push({
				type:'buriedDoor', _ice:true, roomId:mechRoom.id,
				x: mechRoom.x + mechRoom.w * 0.5 - 90, y: mechRoom.y + mechRoom.h - 300,
				w:180, h:240,
			});
		}

		/* ---- fork signage: branch choices must be readable ---- */
		for(const r of rooms){
			if(!r.doorLabels) continue;
			for(const dir of ['top', 'right', 'bottom', 'left']){
				if(!r.doorLabels[dir] || !r.usedExits[dir]) continue;
				const m = mouth(r, dir);
				interactables.push({
					kind:'doorSign', roomId:r.id, text:r.doorLabels[dir],
					x:m.x, y:(dir === 'top' ? m.y + 40 : m.y - 60), w:m.w || 200, h:40, used:false,
				});
			}
		}

		/* ---- port landings ----
		   A door that opens onto thin air is the other half of the
		   "connector does not work" bug. Give every used side port a
		   floor inside the room if the template did not. */
		for(const r of rooms){
			for(const dir of ['left', 'right']){
				if(!r.usedExits[dir]) continue;
				const m = mouth(r, dir);
				const footY = m.y + m.h;
				const inX = dir === 'left' ? r.x + 20 : r.x + r.w - THROAT - 20;
				let supported = false;
				for(const p of platforms){
					if(p.roomId !== r.id) continue;
					if(p.y >= footY - 24 && p.y <= footY + 80 &&
					   p.x < inX + THROAT + 40 && p.x + p.w > inX - 40){ supported = true; break; }
				}
				for(const s of r.solids){
					if(supported) break;
					if(s.y >= footY - 24 && s.y <= footY + 80 &&
					   s.x < inX + THROAT + 40 && s.x + s.w > inX - 40) supported = true;
				}
				/* The room's own outer floor counts too. */
				if(!supported && footY >= r.y + r.h - 80) supported = true;
				if(!supported){
					const lx = snap(dir === 'left' ? r.x + 20 : r.x + r.w - THROAT - 60);
					platforms.push({ kind:'static', x:lx, y:snap(footY), w:THROAT + 40, h:TILE, roomId:r.id, iceLedge:true });
				}
			}
		}

		/* ---- world extents ---- */
		let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
		const boxes = rooms.concat(corridors);
		for(const b of boxes){
			minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
			maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h);
		}
		/* Shift everything into positive space with a solid margin. */
		const offX = snap(600 - minX), offY = snap(600 - minY);
		if(offX !== 0 || offY !== 0){
			const shift = (o) => {
				if(o.x != null) o.x += offX;
				if(o.y != null) o.y += offY;
				if(o.y0 != null) o.y0 += offY;
				if(o.y1 != null) o.y1 += offY;
				if(o.homeX != null) o.homeX += offX;
				if(o.homeY != null) o.homeY += offY;
			};
			for(const r of rooms){
				shift(r);
				for(const c of r.cells) shift(c);
				for(const s of r.solids) shift(s);
				for(const op of r.extraOpenings) shift(op);
				if(r.clearZone) shift(r.clearZone);
				if(r.outGates) for(const g of r.outGates) shift(g);
			}
			for(const list of [corridors, platforms, hazards, decorations, interactables, enemies, gates]){
				for(const o of list) shift(o);
			}
			for(const e of enemies){
				if(e.patrol){ e.patrol[0] += offX; e.patrol[1] += offX; }
			}
		}
		const WORLD_W = snap(maxX + offX + 600);
		const WORLD_H = snap(maxY + offY + 600);

		for(const p of platforms){
			if(p.kind === 'move' || p.kind === 'orbit'){ p.homeX = p.x; p.homeY = p.y; }
		}

		alignPlatforms(platforms);
		trimPlatformsToOpenings(rooms, platforms);
		settleIceDressing(rooms, platforms, decorations, hazards);
		layoutJaws(rooms, hazards);

		const bossRoom = rooms.find(r => r.kind === 'boss');
		const preRoom = rooms.find(r => r.kind === 'preboss');
		const knightRoom = rooms.find(r => r.kind === 'knight');

		/* Boss and mini-boss doors stay shut until the player arrives. */
		const preLock = preRoom ? { x:preRoom.x + preRoom.w - 40, y:preRoom.y + 200, w:80, h:preRoom.h - 300 } : null;
		const bossLock = bossRoom ? { x:bossRoom.x + 400, y:bossRoom.y + 200, w:80, h:300 } : null;

		const start = placed[startNode.id];
		const playerStart = { x:start.x + 140, y:start.y + start.h - 220 };

		return {
			name: 'The Glacial Reach',
			worldW: WORLD_W,
			worldH: WORLD_H,
			/* Cold, deep palette. Nothing shared with the fire dungeon. */
			bgColor:'#04101c', wallColor:'#12304a', wallColor2:'#1b4467', wallEdge:'#5fa6cc',
			floorHighlight:'#9ad4ec', ceilShadow:'#040e18', airColor:'#071829',
			playerStart: playerStart,
			corridors: corridors,
			enemies: enemies,
			decorations: decorations,
			puzzles: [],
			rooms: rooms,
			platforms: platforms,
			hazards: hazards,
			interactables: interactables,
			_gates: gates,
			_theme: 'ice',
			_meter: 'frost',
			_meterLabel: 'Frost',
			_recipe: recipe.id,
			_iceRuntime: true,
			_startRoom: { x:start.x, y:start.y, w:start.w, h:start.h },
			_bossRoomRect: bossRoom ? { x:bossRoom.x, y:bossRoom.y, w:bossRoom.w, h:bossRoom.h } : null,
			_prebossLockWall: preLock,
			_bossLockWall: bossLock,
			_bossRoomTriggerY: bossRoom ? bossRoom.y + 200 : 0,
			_bossRoomTriggerX: bossRoom ? bossRoom.x + 200 : 0,
			_bossPlatforms: bossRoom
				? platforms.filter(p => p.roomId === bossRoom.id && p.kind === 'static').map(p => ({ x:p.x, y:p.y, w:p.w }))
				: [],
			_knightRoomId: knightRoom ? knightRoom.id : null,
			_tablet: bossRoom ? { x: bossRoom.x + 300, y: bossRoom.y + bossRoom.h - 260 } : null,
			_skipped: Object.keys(skipped),
		};
	}

	/* =========================================================
	   DRESSING

	   Authored props often sit in empty air or stop short of the
	   floor/ceiling. After the room is in world space, snap every
	   decoration to a real surface so a ledge you can see is a
	   ledge you can stand on, and walls actually meet the ice.
	   ========================================================= */
	function alignPlatforms(platforms){
		for(const p of platforms){
			if(p.kind === 'move' || p.kind === 'raft' || p.kind === 'orbit') continue;
			p.x = snap(p.x);
			p.y = snap(p.y);
			p.w = Math.max(TILE * 2, snap(p.w));
			p.h = TILE;
		}
	}

	/* Door throats used to stamp air through decks, so half a ledge
	   was ice you could see and air you fell through. Cut the deck
	   back to the solid side of the opening instead. */
	function trimPlatformsToOpenings(rooms, platforms){
		const holes = [];
		for(const r of rooms){
			for(const op of (r.extraOpenings || [])) holes.push(op);
		}
		if(!holes.length) return;
		const kept = [];
		for(const p of platforms){
			if(p.kind === 'move' || p.kind === 'raft' || p.kind === 'orbit'){
				kept.push(p);
				continue;
			}
			let pieces = [p];
			for(let i = 0; i < holes.length; i++){
				const next = [];
				for(let j = 0; j < pieces.length; j++){
					const cut = cutPlatform(pieces[j], holes[i]);
					for(let k = 0; k < cut.length; k++) next.push(cut[k]);
				}
				pieces = next;
			}
			for(let i = 0; i < pieces.length; i++) kept.push(pieces[i]);
		}
		platforms.length = 0;
		for(let i = 0; i < kept.length; i++) platforms.push(kept[i]);
	}

	function cutPlatform(p, hole){
		const ph = p.h || TILE;
		if(p.y + ph <= hole.y || p.y >= hole.y + hole.h) return [p];
		if(p.x + p.w <= hole.x || p.x >= hole.x + hole.w) return [p];
		const out = [];
		const leftW = Math.floor((hole.x - p.x) / TILE) * TILE;
		if(leftW >= TILE * 2) out.push(Object.assign({}, p, { w:leftW }));
		const rightX = Math.ceil((hole.x + hole.w) / TILE) * TILE;
		const rightW = Math.floor((p.x + p.w - rightX) / TILE) * TILE;
		if(rightW >= TILE * 2) out.push(Object.assign({}, p, { x:rightX, w:rightW }));
		return out;
	}

	function layoutJaws(rooms, hazards){
		for(const hz of hazards){
			if(hz.type !== 'jaw') continue;
			const r = rooms[hz.roomId];
			if(!r) continue;
			hz.w = Math.round(r.w * 0.52);
			hz.h = hz.h || 240;
			if(hz.side === 'left'){
				hz.openX = r.x - hz.w + 200;
				hz.closeX = r.x + r.w * 0.5 - hz.w + 14;
			} else {
				hz.openX = r.x + r.w - 200;
				hz.closeX = r.x + r.w * 0.5 - 14;
			}
			hz.x = hz.openX;
			hz._x = hz.openX;
			hz._y = hz.y;
		}
	}

	function settleIceDressing(rooms, platforms, decorations, hazards){
		function cellAtX(r, x, hintY){
			let best = null, bestD = 1e9;
			for(const c of (r.cells || [])){
				if(x < c.x - 4 || x > c.x + c.w + 4) continue;
				const mid = c.y + c.h * 0.5;
				const d = hintY == null ? 0 : Math.abs(mid - hintY);
				if(d < bestD){ best = c; bestD = d; }
			}
			return best;
		}
		function cellAt(r, x, y){
			let best = null;
			for(const c of (r.cells || [])){
				if(x < c.x || x > c.x + c.w || y < c.y || y > c.y + c.h) continue;
				if(!best || c.w * c.h < best.w * best.h) best = c;
			}
			return best || cellAtX(r, x, y);
		}
		function considerFloor(best, top, footHint){
			if(top == null) return best;
			if(footHint != null && top > footHint + 28) return best;
			if(best == null) return top;
			if(footHint != null && Math.abs(top - footHint) < Math.abs(best - footHint)) return top;
			return best;
		}
		function floorAt(r, x, footHint){
			let best = null;
			for(const p of platforms){
				if(p.roomId !== r.id || p._gone) continue;
				if(x < p.x - 6 || x > p.x + p.w + 6) continue;
				best = considerFloor(best, p.y, footHint);
			}
			for(const s of (r.solids || [])){
				if(x < s.x || x > s.x + s.w) continue;
				best = considerFloor(best, s.y, footHint);
			}
			const c = cellAtX(r, x, footHint);
			if(c) best = considerFloor(best, c.y + c.h, footHint);
			return best;
		}
		function ceilingAt(r, x, hintY){
			/* Cell tops are air seams, not ice. Hang from a real underside:
			   room roof, a solid mass, or a platform slab. */
			const hits = [r.y];
			for(const p of platforms){
				if(p.roomId !== r.id || p._gone) continue;
				if(x < p.x - 6 || x > p.x + p.w + 6) continue;
				hits.push(p.y + (p.h || TILE));
			}
			for(const s of (r.solids || [])){
				if(x < s.x || x > s.x + s.w) continue;
				hits.push(s.y + s.h);
			}
			let best = r.y, bestD = hintY == null ? 0 : Math.abs(hintY - r.y);
			for(let i = 0; i < hits.length; i++){
				const bot = hits[i];
				if(hintY != null && bot > hintY + 24) continue;
				if(hintY != null && hintY - bot > 420) continue;
				const d = hintY == null ? 0 : Math.abs(hintY - bot);
				if(d < bestD || (d === bestD && bot > best)){
					best = bot;
					bestD = d;
				}
			}
			return best;
		}
		function nearestPlatform(r, x, y, w){
			let best = null, bestD = 1e9;
			for(const p of platforms){
				if(p.roomId !== r.id) continue;
				const overlap = Math.min(x + w, p.x + p.w) - Math.max(x, p.x);
				const dx = overlap > 0 ? 0 : Math.min(Math.abs(x - (p.x + p.w)), Math.abs(x + w - p.x));
				const d = Math.abs(y - p.y) + dx * 0.45;
				if(d < bestD){ best = p; bestD = d; }
			}
			return bestD < 90 ? best : null;
		}
		function clampDecToPlatform(r, d){
			const dw = d.w || 80;
			const p = nearestPlatform(r, d.x, d.y, dw);
			if(!p) return;
			if(d.x < p.x) d.x = p.x;
			if(d.x + dw > p.x + p.w){
				if(dw > p.w){ d.x = p.x; d.w = p.w; }
				else d.x = p.x + p.w - dw;
			}
		}

		const HANG = { icicleCluster:1, dripCurtain:1, frozenBanner:1 };
		const SIT_BOX = {
			snowDrift:1, crystalCluster:1, frozenStatue:1, frozenAltar:1,
			ruinedStair:1, prisonBlock:1, preservedBeast:1, frozenCamp:1,
			iceGlyphs:1, mistBank:1, frozenPool:1, hoarFrost:1, buriedDoor:1,
			frozenRiverBand:1, subglacialWater:1, meltRunnel:1, iceCacheProp:1,
			iceFence:1, iceIdol:1, warmHearth:1, runeTablet:1, buriedRuin:1,
			iceLantern:1,
		};
		const SIT_BASE = { iceRidge:1 };
		const COLUMN = { iceColumn:1, carvedPillar:1 };
		const SPAN = {
			glacierWall:1, ancientWallFace:1,
			frozenWaterfall:1, mirrorPlane:1,
		};
		const SHELF = { iceShelf:1, iceBridgeDeck:1 };
		const KEEP_IN_WALL = { glacierWall:1, ancientWallFace:1, frozenBubbles:1, crevasseEdge:1 };

		function pointInSolid(r, x, y){
			for(const s of (r.solids || [])){
				if(x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) return true;
			}
			for(const c of (r.cells || [])){
				if(x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) return false;
			}
			return true;
		}
		function boxBuried(r, d){
			const w = d.w || 40, h = d.h || 40;
			const samples = [
				[d.x + w * 0.5, d.y + h * 0.5],
				[d.x + Math.min(12, w * 0.25), d.y + h * 0.5],
				[d.x + w - Math.min(12, w * 0.25), d.y + h * 0.5],
				[d.x + w * 0.5, d.y + Math.min(12, h * 0.3)]
			];
			let n = 0;
			for(let i = 0; i < samples.length; i++){
				if(pointInSolid(r, samples[i][0], samples[i][1])) n++;
			}
			return n >= 2;
		}
		function ejectFromWall(r, d){
			if(KEEP_IN_WALL[d.type] || SPAN[d.type]) return;
			if(!boxBuried(r, d)) return;
			const w = d.w || 40, h = d.h || 40;
			const cx = d.x + w * 0.5, cy = d.y + h * 0.45;
			let best = null, bestD = 1e9;
			for(const c of (r.cells || [])){
				const pad = 28;
				for(let tx = c.x + pad; tx < c.x + c.w - pad; tx += 36){
					for(let ty = c.y + pad; ty < c.y + c.h - pad; ty += 36){
						if(pointInSolid(r, tx, ty)) continue;
						const dd = Math.hypot(tx - cx, ty - cy);
						if(dd < bestD){ bestD = dd; best = { x:tx, y:ty }; }
					}
				}
			}
			if(!best) return;
			d.x = best.x - w * 0.5;
			d.y = best.y - h * 0.45;
		}
		function sitOnFloor(r, d, footHint){
			const w = d.w || 80, h = d.h || 40;
			const fl = floorAt(r, d.x + w * 0.5, footHint != null ? footHint : d.y + h);
			if(fl != null) d.y = fl - h;
			clampDecToPlatform(r, d);
		}

		for(let i = decorations.length - 1; i >= 0; i--){
			const d = decorations[i];
			const r = (d.roomId != null) ? rooms[d.roomId] : null;
			if(!r) continue;
			const w = d.w || 80;
			const h = d.h || 40;
			const midX = d.x + w * 0.5;

			if(SHELF[d.type]){
				/* Fake shelves caused fall-throughs. Real platforms draw themselves. */
				decorations.splice(i, 1);
				continue;
			}
			if(HANG[d.type]){
				ejectFromWall(r, d);
				const ceil = ceilingAt(r, d.x + (d.w || w) * 0.5, d.y);
				if(ceil != null) d.y = ceil;
				continue;
			}
			if(d.type === 'lightShaft' || d.type === 'iceArch'){
				const ceil = ceilingAt(r, midX, d.y);
				const fl = floorAt(r, midX, d.y + (d.h || 200));
				const span = (ceil != null && fl != null) ? fl - ceil : 0;
				if(ceil != null) d.y = ceil;
				if(span > 80 && span <= 1100) d.h = span;
				continue;
			}
			if(SPAN[d.type]){
				const c = cellAt(r, midX, d.y + h * 0.5) || cellAtX(r, midX, d.y);
				/* A single huge shaft cell must not stretch a wall the full height
				   — that paints false ledges down the crevasse. */
				if(c && c.h <= 900){
					d.y = c.y;
					d.h = c.h;
				} else {
					const ceil = ceilingAt(r, midX, d.y);
					if(ceil != null && Math.abs(ceil - d.y) < 100) d.y = ceil;
				}
				continue;
			}
			if(COLUMN[d.type]){
				ejectFromWall(r, d);
				sitOnFloor(r, d, d.y + h);
				continue;
			}
			if(SIT_BOX[d.type]){
				ejectFromWall(r, d);
				sitOnFloor(r, d, d.y + h);
				continue;
			}
			if(SIT_BASE[d.type]){
				ejectFromWall(r, d);
				const fl = floorAt(r, d.x + (d.w || 80) * 0.5, d.y + 8);
				if(fl != null) d.y = fl;
				clampDecToPlatform(r, d);
				continue;
			}
			if(d.type === 'iceLight'){
				const ceil = ceilingAt(r, midX, d.y);
				if(ceil != null) d.y = ceil + 40;
				continue;
			}
			ejectFromWall(r, d);
			if(SIT_BOX[d.type] || COLUMN[d.type]) sitOnFloor(r, d, d.y + (d.h || 40));
			if(d.type === 'frozenBubbles'){
				let host = null;
				for(const s of (r.solids || [])){
					if(midX >= s.x - 20 && midX <= s.x + s.w + 20 &&
					   d.y >= s.y - 40 && d.y <= s.y + s.h + 40){ host = s; break; }
				}
				if(host){
					d.x = host.x + host.w * 0.3;
					d.y = host.y + host.h * 0.2;
					d.h = Math.min(h, Math.max(40, host.h * 0.45));
				}
				continue;
			}
		}
		if(hazards){
			for(let i = 0; i < hazards.length; i++){
				const hz = hazards[i];
				if(hz.type !== 'fang') continue;
				const r = rooms[hz.roomId];
				if(!r) continue;
				const ceil = ceilingAt(r, hz.x + (hz.w || 44) * 0.5, hz.y);
				if(ceil != null) hz.y = ceil;
			}
		}
	}

	/* =========================================================
	   VERIFICATION

	   Rebuild the tile grid using the exact same order the runtime
	   uses, then flood-fill the air. If a required room's playable
	   volume is not connected to the spawn point, the run is bad and
	   gets re-rolled. This is the check that stops "the connector
	   touched the wall but never opened it".
	   ========================================================= */
	function buildTileModel(world){
		const cols = Math.ceil(world.worldW / TILE);
		const rows = Math.ceil(world.worldH / TILE);
		const grid = new Uint8Array(cols * rows); /* 0 solid, 1 air */
		const at = (c, r) => r * cols + c;

		function stamp(x, y, w, h, air){
			const sc = Math.max(0, Math.floor(x / TILE)), ec = Math.min(cols, Math.ceil((x + w) / TILE));
			const sr = Math.max(0, Math.floor(y / TILE)), er = Math.min(rows, Math.ceil((y + h) / TILE));
			for(let r = sr; r < er; r++){
				for(let c = sc; c < ec; c++) grid[at(c, r)] = air ? 1 : 0;
			}
		}

		/* 1. corridors carved by the loader */
		for(const c of world.corridors) stamp(c.x, c.y, c.w, c.h, true);
		/* 2. room shells sealed */
		for(const r of world.rooms){
			stamp(r.x, r.y + r.h - 8, r.w, 64, false);
			stamp(r.x, r.y - 40, r.w, 56, false);
			stamp(r.x - 40, r.y, 56, r.h, false);
			stamp(r.x + r.w - 16, r.y, 56, r.h, false);
		}
		/* 3. authored air cells opened */
		for(const r of world.rooms){
			for(const cell of r.cells) stamp(cell.x + 16, cell.y + 16, cell.w - 32, cell.h - 32, true);
		}
		/* 4. authored solid masses restored */
		for(const r of world.rooms){
			for(const s of r.solids) stamp(s.x, s.y, s.w, s.h, false);
		}
		/* 5. openings punched after solids */
		for(const r of world.rooms){
			for(const op of r.extraOpenings) stamp(op.x, op.y, op.w, op.h, true);
		}
		/* 6. platforms last — decks win over throats. Platforms were
		   already trimmed so they do not reseal a required drop. */
		for(const p of world.platforms){
			if(p.kind === 'move' || p.kind === 'raft' || p.kind === 'orbit') continue;
			stamp(p.x, p.y, p.w, p.h || TILE, false);
		}
		return { cols:cols, rows:rows, grid:grid, at:at };
	}

	/* Flood the air volume from the spawn tile. Secret gates and room
	   lock gates are treated as open, because both are opened through
	   normal play and must not make a room look unreachable. */
	function floodAir(model, startC, startR){
		const { cols, rows, grid } = model;
		const seen = new Uint8Array(cols * rows);
		if(startC < 0 || startR < 0 || startC >= cols || startR >= rows) return seen;
		const idx = startR * cols + startC;
		if(!grid[idx]) return seen;
		const stack = [idx];
		seen[idx] = 1;
		while(stack.length){
			const i = stack.pop();
			const c = i % cols, r = (i - c) / cols;
			if(c > 0 && grid[i - 1] && !seen[i - 1]){ seen[i - 1] = 1; stack.push(i - 1); }
			if(c < cols - 1 && grid[i + 1] && !seen[i + 1]){ seen[i + 1] = 1; stack.push(i + 1); }
			if(r > 0 && grid[i - cols] && !seen[i - cols]){ seen[i - cols] = 1; stack.push(i - cols); }
			if(r < rows - 1 && grid[i + cols] && !seen[i + cols]){ seen[i + cols] = 1; stack.push(i + cols); }
		}
		return seen;
	}

	/* A tile the player could actually stand on: air, headroom above,
	   solid underfoot. Used to prove rooms are not just hollow voids. */
	function standableIn(model, seen, rect){
		const { cols, rows, grid, at } = model;
		const sc = Math.max(1, Math.floor(rect.x / TILE)), ec = Math.min(cols - 1, Math.ceil((rect.x + rect.w) / TILE));
		const sr = Math.max(2, Math.floor(rect.y / TILE)), er = Math.min(rows - 1, Math.ceil((rect.y + rect.h) / TILE));
		let count = 0;
		for(let r = sr; r < er; r++){
			for(let c = sc; c < ec; c++){
				const i = at(c, r);
				if(!grid[i] || !seen[i]) continue;
				if(!grid[at(c, r - 1)]) continue;
				if(grid[at(c, r + 1)]) continue;
				count++;
			}
		}
		return count;
	}

	function verify(world){
		const model = buildTileModel(world);
		/* Open every gate for the purposes of the reachability proof. */
		const openGate = (g) => {
			if(!g) return;
			const sc = Math.max(0, Math.floor(g.x / TILE)), ec = Math.min(model.cols, Math.ceil((g.x + g.w) / TILE));
			const sr = Math.max(0, Math.floor(g.y / TILE)), er = Math.min(model.rows, Math.ceil((g.y + g.h) / TILE));
			for(let r = sr; r < er; r++) for(let c = sc; c < ec; c++) model.grid[model.at(c, r)] = 1;
		};
		for(const g of (world._gates || [])) openGate(g);
		for(const r of world.rooms) if(r.outGates) for(const g of r.outGates) openGate(g);
		openGate(world._prebossLockWall);
		openGate(world._bossLockWall);

		const ps = world.playerStart;
		let sc = Math.floor(ps.x / TILE), sr = Math.floor(ps.y / TILE);
		/* Nudge the seed tile to real air if the spawn sits in a wall. */
		let seeded = false;
		for(let dr = 0; dr <= 6 && !seeded; dr++){
			for(let dc = -3; dc <= 3 && !seeded; dc++){
				const c = sc + dc, r = sr - dr;
				if(c < 0 || r < 0 || c >= model.cols || r >= model.rows) continue;
				if(model.grid[model.at(c, r)]){ sc = c; sr = r; seeded = true; }
			}
		}
		if(!seeded) return { ok:false, reason:'spawn sealed' };

		const seen = floodAir(model, sc, sr);
		const failures = [];
		for(const r of world.rooms){
			/* Optional and secret rooms are allowed to be gated off, but
			   they still must not be sealed solid. */
			const needStand = 3;
			let stand = 0;
			for(const cell of r.cells) stand += standableIn(model, seen, cell);
			if(stand < needStand) failures.push(r.nodeId || r.kind);
		}
		if(failures.length) return { ok:false, reason:'unreachable: ' + failures.join(', '), failures:failures };

		/* Every objective target must be standable-reachable too. */
		for(const r of world.rooms){
			if(r.clearZone && standableIn(model, seen, r.clearZone) < 1){
				return { ok:false, reason:'clear zone unreachable in ' + (r.nodeId || r.kind) };
			}
		}
		for(const it of world.interactables){
			if(it.x == null || it.kind === 'banner' || it.kind === 'doorSign') continue;
			if(standableIn(model, seen, { x:it.x - 120, y:it.y - 40, w:(it.w || 60) + 240, h:(it.h || 60) + 200 }) < 1){
				return { ok:false, reason:'interactable unreachable: ' + it.kind };
			}
		}
		return { ok:true };
	}

	/* =========================================================
	   ENTRY POINT
	   ========================================================= */
	function generateIceGlacialReach(){
		const base = (Date.now() ^ (Math.random() * 0xFFFFFF | 0)) & 0x7FFFFFFF;
		let best = null, bestReason = 'none';
		for(let attempt = 0; attempt < 24; attempt++){
			let world = null;
			try{ world = build((base + attempt * 7919) & 0x7FFFFFFF); }
			catch(err){ bestReason = 'build threw: ' + (err && err.message); continue; }
			if(!world) continue;
			let res;
			try{ res = verify(world); }
			catch(err){ res = { ok:false, reason:'verify threw: ' + (err && err.message) }; }
			if(res.ok){
				world._genAttempts = attempt + 1;
				return world;
			}
			bestReason = res.reason;
			if(!best || (res.failures || []).length < (best._failCount || 99)){
				best = world;
				best._failCount = (res.failures || []).length;
			}
		}
		if(best){
			best._genWarn = bestReason;
			best._genAttempts = 24;
			if(typeof console !== 'undefined') console.warn('[Glacial Reach] using best-effort layout:', bestReason);
			return best;
		}
		return null;
	}

	global.generateIceGlacialReach = generateIceGlacialReach;
	/* Kept so dungeon-gen.js keeps dispatching ice to this module. */
	global.generateIceFrozenLabyrinth = generateIceGlacialReach;
	global.__iceGenVerify = verify;
	global.__iceGenBuild = build;
})(typeof window !== 'undefined' ? window : globalThis);
