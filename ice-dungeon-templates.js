/* =============================================================
   The Glacial Reach — authored ice room library.

   Rooms are NOT rectangles. Each template's air volume is a union of
   overlapping cells (basins, terraces, upper galleries, internal
   shafts), with solid masses carved back in. The generator stamps
   these verbatim and only chooses which rooms appear and in what
   order — it never invents geometry.

   Local coordinates. Origin = top-left of the template bounds.
   ============================================================= */
(function(global){
	const T = 40;

	/* ---- authoring helpers ---- */

	/* Air cell. The union of these is the room's walkable volume. */
	function C(x, y, w, h){ return { x:x, y:y, w:w, h:h }; }
	/* Solid mass carved back into the air (terraces, spurs, plinths). */
	function S(x, y, w, h){ return { x:x, y:y, w:w, h:h }; }
	/* Platform. y is absolute-local (top edge). */
	function P(kind, x, y, w, extra){
		return Object.assign({ kind:kind, x:x, y:y, w:w, h:T }, extra || {});
	}
	/* Ice deck that fractures under sustained weight, then drops away. */
	function Thin(x, y, w, extra){
		return Object.assign({ kind:'thinIce', x:x, y:y, w:w, h:T, life:150, regrow:520 }, extra || {});
	}
	/* Shelf that fails once, on a timer, after first contact. */
	function Shelf(x, y, w, extra){
		return Object.assign({ kind:'shelf', x:x, y:y, w:w, h:T, life:96 }, extra || {});
	}
	function Spawn(x, y, type){ return { x:x, y:y, type:type || null }; }
	function Pr(type, x, y, extra){ return Object.assign({ type:type, x:x, y:y }, extra || {}); }

	/* ---- ice hazards (nothing here mirrors a fire hazard) ---- */

	/* Low-traction surface. Momentum, never damage. */
	function Slick(x, y, w, slip){ return { type:'slick', x:x, y:y, w:w, h:T, slip:slip == null ? 0.42 : slip }; }
	/* Ceiling icicle on a slow cycle: shadow warning, then a fall. */
	function Fang(x, y, period, phase){
		return { type:'fang', x:x, y:y, w:44, period:period || 260, phase:phase || 0, warn:70, drop:0 };
	}
	/* Water current across or beneath ice. Pushes, does not damage. */
	function Current(x, y, w, h, dir, force){
		return { type:'current', x:x, y:y, w:w, h:h, dir:dir || 1, force:force == null ? 2.6 : force };
	}
	/* Open water: entering costs frost and buoyancy, not instant death. */
	function Water(x, y, w, h, extra){
		return Object.assign({ type:'water', x:x, y:y, w:w, h:h }, extra || {});
	}
	/* Subglacial geyser: launches the player upward. Traversal tool. */
	function Geyser(x, y, period, phase, lift){
		return { type:'geyser', x:x, y:y, w:72, period:period || 300, phase:phase || 0, warn:62, lift:lift || 17 };
	}
	/* Snow squall: cuts sight lines on a cycle, with readable lulls. */
	function Squall(period, strength){
		return { type:'squall', period:period || 620, strength:strength == null ? 0.72 : strength, phase:0 };
	}
	/* Glacier creep: a mass slides in and out, closing a route. */
	function Press(x, y, w, h, axis, dist, period, phase){
		return { type:'press', x:x, y:y, w:w, h:h, axis:axis || 'x', dist:dist || 160, period:period || 420, phase:phase || 0 };
	}
	/* Paired jaws. Layout (open/close X) is resolved from the room. */
	function Jaw(y, h, side, extra){
		return Object.assign({ type:'jaw', x:0, y:y, w:80, h:h || 240, side:side || 'left', period:200, phase:0 }, extra || {});
	}
	/* Reflective plane. Paints a false room; the real route is elsewhere. */
	function Mirror(x, y, w, h, extra){
		return Object.assign({ type:'mirror', x:x, y:y, w:w, h:h }, extra || {});
	}
	/* Meltwater rise. Authored levels; forces upward route choice. */
	function Rise(x, y0, y1, w, extra){
		return Object.assign({ type:'rise', x:x, y0:y0, y1:y1, w:w, speed:0.3, armed:true, active:false }, extra || {});
	}
	/* Authored collapse sequence: ceiling gives way along a known line. */
	function Collapse(x, y, w, h, delay){
		return { type:'collapse', x:x, y:y, w:w, h:h, delay:delay || 0 };
	}
	/* Frost field: standing here accumulates frost. Route pressure. */
	function FrostField(x, y, w, h, rate){
		return { type:'frostField', x:x, y:y, w:w, h:h, rate:rate == null ? 0.06 : rate };
	}

	const ICE_ROOM_TEMPLATES = [

		/* ================= SECTION 1 — FROZEN CAVERNS ================= */

		/* Entry. Reads as a natural cave mouth with a descending floor,
		   not a rectangular antechamber. */
		{
			id:'ice_start_cavemouth', kind:'start', category:'required', section:[1],
			w:1080, h:760, noCombat:true, label:'The Cave Mouth', objective:'',
			cells:[ C(0, 200, 1080, 560), C(120, 60, 620, 200) ],
			solids:[ S(0, 620, 300, 140), S(760, 660, 320, 100) ],
			ports:{ right:{ y:430, h:200 } },
			platforms:[ P('static', 300, 600, 200), P('static', 560, 540, 180) ],
			hazards:[ Slick(320, 580, 220, 0.2) ],
			props:[
				Pr('lightShaft', 180, 0, { w:200, h:520, alpha:0.2 }),
				Pr('glacierWall', 0, 200, { w:180, h:420, alpha:0.7 }),
				Pr('icicleCluster', 200, 240, { w:180, h:52 }),
				Pr('icicleCluster', 520, 220, { w:140, h:44 }),
				Pr('snowDrift', 60, 736, { w:220, h:30 }),
				Pr('snowDrift', 840, 736, { w:200, h:26 }),
				Pr('iceColumn', 700, 260, { w:52, h:400 }),
				Pr('frozenCamp', 380, 756, { w:120, h:52 }),
				Pr('iceLight', 900, 400, { r:120 }),
				Pr('mistBank', 300, 700, { w:500, h:80 }),
			],
			spawns:[],
		},

		/* Natural combat cavern: three elevations, a slick basin floor. */
		{
			id:'ice_cavern_basin', kind:'combat', category:'required', section:[1,2],
			w:1720, h:900, label:'Meltwater Basin', objective:'CLEAR THE CAVERN',
			cells:[ C(0, 300, 1720, 600), C(140, 120, 1440, 200) ],
			solids:[ S(0, 760, 260, 140), S(1460, 720, 260, 180), S(700, 300, 120, 120) ],
			ports:{ left:{ y:560, h:200 }, right:{ y:520, h:200 }, bottom:{ x:820, w:220 } },
			platforms:[
				P('static', 300, 700, 260),
				P('static', 660, 620, 300),
				P('static', 1080, 700, 240),
				P('static', 460, 480, 200),
				P('static', 940, 440, 220),
			],
			hazards:[
				Slick(260, 860, 1200, 0.44),
				Fang(520, 300, 280, 0),
				Fang(1180, 300, 300, 140),
			],
			props:[
				Pr('glacierWall', 0, 300, { w:260, h:460 }),
				Pr('glacierWall', 1460, 300, { w:260, h:420 }),
				Pr('frozenPool', 300, 856, { w:700, h:44 }),
				Pr('iceColumn', 780, 420, { w:46, h:340 }),
				Pr('iceRidge', 1060, 700, { w:200, h:34 }),
				Pr('icicleCluster', 420, 320, { w:200, h:60 }),
				Pr('icicleCluster', 1080, 320, { w:220, h:56 }),
				Pr('crystalCluster', 1240, 720, { w:90, h:130, n:4 }),
				Pr('snowDrift', 1140, 876, { w:240, h:28 }),
				Pr('iceLight', 640, 520, { r:110 }),
				Pr('hoarFrost', 320, 690, { w:220, h:14 }),
			],
			spawns:[ Spawn(360, 690, 'frostMantis'), Spawn(760, 610), Spawn(1140, 690, 'glacierEel') ],
		},

		/* Narrow cave with a squeeze and a raised gallery — compact pacing. */
		{
			id:'ice_cavern_squeeze', kind:'combat', category:'required', section:[1,2],
			w:1180, h:720, label:'The Squeeze', objective:'CLEAR THE CAVERN',
			cells:[ C(0, 340, 1180, 380), C(80, 120, 480, 240), C(700, 160, 420, 200) ],
			solids:[ S(520, 340, 220, 120), S(0, 640, 160, 80) ],
			ports:{ left:{ y:460, h:180 }, right:{ y:440, h:180 }, top:{ x:820, w:200 } },
			platforms:[
				P('static', 200, 560, 220),
				P('static', 520, 500, 200),
				P('static', 820, 540, 220),
				P('static', 700, 340, 180),
			],
			hazards:[ Slick(160, 680, 900, 0.38), Fang(760, 340, 240, 60) ],
			props:[
				Pr('glacierWall', 520, 340, { w:220, h:300, alpha:0.85 }),
				Pr('icicleCluster', 560, 360, { w:160, h:48 }),
				Pr('iceArch', 60, 300, { w:240, h:130 }),
				Pr('snowDrift', 240, 696, { w:180, h:24 }),
				Pr('frozenBubbles', 980, 420, { w:40, h:120 }),
				Pr('crystalCluster', 380, 690, { w:70, h:90, n:3 }),
				Pr('iceLight', 900, 460, { r:100 }),
			],
			spawns:[ Spawn(260, 550), Spawn(880, 530) ],
		},

		/* First slippery-momentum lesson, safe consequences. */
		{
			id:'ice_glide_hollow', kind:'traversal', category:'required', section:[1],
			w:1560, h:640, label:'Glide Hollow', objective:'REACH THE FAR SIDE',
			cells:[ C(0, 240, 1560, 400) ],
			solids:[ S(0, 560, 200, 80), S(1360, 560, 200, 80) ],
			ports:{ left:{ y:380, h:180 }, right:{ y:380, h:180 } },
			platforms:[
				P('static', 240, 520, 260),
				P('static', 620, 480, 300),
				P('static', 1040, 520, 280),
			],
			hazards:[
				Slick(240, 500, 260, 0.55),
				Slick(620, 460, 300, 0.58),
				Slick(1040, 500, 280, 0.55),
				Fang(500, 240, 220, 40),
				Fang(940, 240, 240, 130),
			],
			clearZone:{ x:1380, y:420, w:180, h:200 },
			props:[
				Pr('glacierWall', 0, 240, { w:200, h:320 }),
				Pr('glacierWall', 1360, 240, { w:200, h:320 }),
				Pr('crevasseEdge', 500, 600, { w:520, h:40 }),
				Pr('icicleCluster', 460, 260, { w:200, h:56 }),
				Pr('icicleCluster', 900, 260, { w:200, h:52 }),
				Pr('mistBank', 400, 580, { w:700, h:70 }),
				Pr('iceLight', 780, 340, { r:120 }),
			],
			spawns:[],
		},

		/* ================= SECTION 2 — GLACIAL DEPTHS ================= */

		/* Enormous frozen lake. Authored thin-ice route, islands, ridges. */
		{
			id:'ice_lake_crossing', kind:'lake', category:'required', section:[2,3],
			w:2960, h:1180, label:'The Still Lake', objective:'CROSS THE FROZEN LAKE',
			cells:[ C(0, 260, 2960, 920), C(200, 80, 2560, 200) ],
			solids:[ S(0, 1000, 320, 180), S(2640, 1000, 320, 180) ],
			ports:{ left:{ y:800, h:200 }, right:{ y:800, h:200 } },
			platforms:[
				/* Shore shelves. */
				P('static', 320, 1000, 200),
				P('static', 2440, 1000, 200),
				/* Islands — always safe. */
				P('static', 900, 1000, 220),
				P('static', 1560, 1000, 200),
				P('static', 2080, 1000, 220),
				/* Authored thin-ice spans between islands. */
				Thin(520, 1000, 200, { life:150 }),
				Thin(720, 1000, 180, { life:130 }),
				Thin(1120, 1000, 200, { life:140 }),
				Thin(1320, 1000, 240, { life:130 }),
				Thin(1760, 1000, 160, { life:120 }),
				Thin(1920, 1000, 160, { life:120 }),
				Thin(2300, 1000, 140, { life:150 }),
				/* Pressure ridge shortcut, higher and stable but exposed. */
				P('static', 1080, 760, 240),
				P('static', 1500, 700, 220),
				P('static', 1920, 760, 240),
			],
			hazards:[
				Slick(320, 980, 2320, 0.5),
				Water(320, 1040, 2320, 140, { deep:true }),
				Current(320, 1040, 2320, 140, 1, 1.4),
				Fang(1240, 260, 300, 0),
				Fang(1840, 260, 320, 150),
				FrostField(320, 1040, 2320, 140, 0.1),
			],
			clearZone:{ x:2660, y:880, w:280, h:200 },
			props:[
				Pr('glacierWall', 0, 260, { w:320, h:740 }),
				Pr('glacierWall', 2640, 260, { w:320, h:740 }),
				Pr('frozenPool', 320, 1000, { w:2320, h:56 }),
				Pr('iceRidge', 1060, 760, { w:280, h:40 }),
				Pr('iceRidge', 1880, 760, { w:280, h:38 }),
				Pr('iceShelf', 900, 990, { w:220, h:24 }),
				Pr('iceShelf', 2080, 990, { w:220, h:24 }),
				Pr('lightShaft', 1180, 80, { w:180, h:900, alpha:0.16 }),
				Pr('lightShaft', 2000, 80, { w:150, h:900, alpha:0.12 }),
				Pr('icicleCluster', 760, 280, { w:240, h:64 }),
				Pr('icicleCluster', 1600, 280, { w:260, h:70 }),
				Pr('icicleCluster', 2280, 280, { w:220, h:58 }),
				Pr('preservedBeast', 1380, 1060, { w:160, h:100 }),
				Pr('mistBank', 700, 1100, { w:900, h:80 }),
				Pr('mistBank', 1800, 1100, { w:800, h:80 }),
				Pr('crystalCluster', 2480, 1000, { w:100, h:140, n:5 }),
			],
			spawns:[ Spawn(960, 990), Spawn(1600, 990), Spawn(2140, 990) ],
		},

		/* Vertical crevasse. Descend on ledges; the bottom stays visible. */
		{
			id:'ice_crevasse_descent', kind:'descent', category:'required', section:[2,3],
			w:1400, h:2400, label:'The Blue Crevasse', objective:'DESCEND THE CREVASSE',
			cells:[ C(0, 0, 1400, 2400) ],
			solids:[
				/* Corner ice only — no wide ceiling slab you can stand on. */
				S(0, 0, 260, 120), S(1140, 0, 260, 100),
				S(0, 2260, 340, 140), S(1060, 2260, 340, 140),
			],
			ports:{ top:{ x:560, w:280 }, bottom:{ x:600, w:260 } },
			platforms:[
				P('static', 420, 280, 260),
				P('static', 820, 500, 220),
				P('static', 300, 720, 220),
				P('static', 840, 940, 220),
				P('static', 360, 1120, 240),
				/* Clear bite — jaws close through this gap. */
				P('static', 380, 1720, 240),
				P('static', 820, 1920, 240),
				P('static', 420, 2120, 260),
			],
			hazards:[
				Fang(560, 120, 260, 0),
				Fang(900, 100, 280, 90),
				Fang(460, 720, 300, 50),
				Slick(420, 260, 260, 0.4),
				Slick(360, 1100, 240, 0.42),
				Jaw(1260, 380, 'left'),
				Jaw(1260, 380, 'right'),
			],
			clearZone:{ x:600, y:2200, w:240, h:200 },
			props:[
				Pr('crevasseEdge', 0, 0, { w:1400, h:2400, alpha:0.45 }),
				Pr('glacierWall', 0, 120, { w:240, h:720, alpha:0.55 }),
				Pr('glacierWall', 1160, 100, { w:240, h:720, alpha:0.55 }),
				Pr('glacierWall', 0, 1720, { w:240, h:540, alpha:0.55 }),
				Pr('glacierWall', 1160, 1720, { w:240, h:540, alpha:0.55 }),
				Pr('lightShaft', 540, 0, { w:280, h:1100, alpha:0.18 }),
				Pr('icicleCluster', 480, 120, { w:220, h:70 }),
				Pr('icicleCluster', 860, 100, { w:200, h:64 }),
				Pr('mistBank', 300, 2320, { w:800, h:90 }),
				Pr('iceLight', 700, 400, { r:120 }),
				Pr('iceLight', 620, 1960, { r:130 }),
			],
			spawns:[
				Spawn(440, 270, 'frostWraith'),
				Spawn(840, 490, 'frostWraith'),
				Spawn(320, 710, 'frostWraith'),
				Spawn(860, 930, 'frostWraith'),
				Spawn(380, 1110, 'iceArcher'),
				Spawn(400, 1710, 'frostWraith'),
				Spawn(840, 1910, 'frostWraith'),
				Spawn(440, 2110, 'frostWraith'),
			],
		},

		/* Ascend a frozen waterfall on carved shelves. */
		{
			id:'ice_waterfall_ascent', kind:'ascent', category:'required', section:[2,3],
			w:1520, h:2200, label:'The Hanging Fall', objective:'CLIMB THE FROZEN FALL',
			cells:[ C(0, 0, 1520, 2200) ],
			solids:[ S(1180, 0, 340, 1900), S(0, 2040, 340, 160) ],
			ports:{ bottom:{ x:520, w:240 }, top:{ x:760, w:220 } },
			platforms:[
				P('static', 340, 1960, 260),
				P('static', 700, 1820, 220),
				P('static', 380, 1660, 200),
				Shelf(720, 1500, 200),
				P('static', 400, 1340, 220),
				P('static', 780, 1180, 200),
				Shelf(420, 1020, 200),
				P('static', 800, 860, 220),
				P('static', 440, 700, 220),
				P('static', 820, 540, 240),
				P('static', 560, 380, 240),
				P('static', 760, 220, 260),
			],
			hazards:[
				Geyser(620, 2000, 300, 0, 18),
				Geyser(980, 1200, 320, 160, 17),
				Fang(500, 1300, 280, 40),
				Fang(860, 500, 300, 120),
				Current(1140, 200, 60, 1700, 1, 0.9),
				Slick(400, 1320, 220, 0.42),
				Slick(820, 520, 240, 0.44),
			],
			clearZone:{ x:700, y:180, w:300, h:180 },
			props:[
				Pr('frozenWaterfall', 1120, 0, { w:200, h:1900 }),
				Pr('frozenWaterfall', 40, 240, { w:150, h:1700 }),
				Pr('glacierWall', 1300, 0, { w:220, h:1900, alpha:0.75 }),
				Pr('lightShaft', 700, 0, { w:220, h:1200, alpha:0.2 }),
				Pr('iceShelf', 340, 1952, { w:260, h:26 }),
				Pr('iceShelf', 700, 1812, { w:220, h:24 }),
				Pr('iceShelf', 380, 1652, { w:200, h:24 }),
				Pr('iceShelf', 400, 1332, { w:220, h:24 }),
				Pr('iceShelf', 780, 1172, { w:200, h:24 }),
				Pr('iceShelf', 800, 852, { w:220, h:24 }),
				Pr('iceShelf', 440, 692, { w:220, h:24 }),
				Pr('iceShelf', 820, 532, { w:240, h:26 }),
				Pr('dripCurtain', 480, 1240, { w:140, h:70 }),
				Pr('dripCurtain', 840, 760, { w:160, h:80 }),
				Pr('crystalCluster', 300, 1940, { w:90, h:120, n:4 }),
				Pr('mistBank', 400, 2100, { w:700, h:90 }),
				Pr('iceLight', 620, 1000, { r:140 }),
			],
			spawns:[ Spawn(420, 1330, 'frostWraith'), Spawn(800, 850, 'iceArcher') ],
		},

		/* Huge suspended bridge over an open void. Landmark room. */
		{
			id:'ice_great_bridge', kind:'bridge', category:'required', section:[2,3,4],
			w:3000, h:1400, label:'The Long Span', objective:'CROSS THE SPAN',
			cells:[ C(0, 0, 3000, 1400) ],
			solids:[ S(0, 900, 420, 500), S(2580, 860, 420, 540) ],
			ports:{ left:{ y:700, h:200 }, right:{ y:660, h:200 } },
			platforms:[
				P('static', 420, 900, 200),
				/* The span: mostly solid with two authored fragile bays. */
				P('static', 620, 900, 260),
				Shelf(880, 900, 200, { life:110 }),
				P('static', 1080, 900, 300),
				P('static', 1380, 900, 260),
				Shelf(1640, 900, 220, { life:104 }),
				P('static', 1860, 900, 300),
				P('static', 2160, 900, 240),
				P('static', 2400, 860, 180),
				/* Upper maintenance walk — safer, longer, guarded. */
				P('static', 760, 560, 240),
				P('static', 1180, 500, 260),
				P('static', 1620, 500, 240),
				P('static', 2040, 560, 240),
			],
			hazards:[
				Slick(420, 880, 2160, 0.36),
				Fang(1000, 0, 280, 0),
				Fang(1500, 0, 300, 100),
				Fang(2000, 0, 290, 200),
				Press(1240, 620, 220, 280, 'y', 200, 500, 0),
			],
			clearZone:{ x:2620, y:740, w:340, h:180 },
			props:[
				Pr('crevasseEdge', 420, 940, { w:2160, h:460, alpha:0.6 }),
				Pr('glacierWall', 0, 0, { w:420, h:900 }),
				Pr('glacierWall', 2580, 0, { w:420, h:860 }),
				Pr('iceBridgeDeck', 420, 892, { w:2160, h:26 }),
				Pr('ropeBridge', 760, 552, { w:1520, h:22 }),
				Pr('carvedPillar', 1060, 300, { w:44, h:600 }),
				Pr('carvedPillar', 1900, 300, { w:44, h:600 }),
				Pr('lightShaft', 1400, 0, { w:260, h:1000, alpha:0.15 }),
				Pr('icicleCluster', 900, 920, { w:200, h:80 }),
				Pr('icicleCluster', 1660, 920, { w:220, h:86 }),
				Pr('mistBank', 800, 1320, { w:1400, h:90 }),
				Pr('frozenBanner', 1080, 320, { w:28, h:90 }),
				Pr('frozenBanner', 1920, 320, { w:28, h:90 }),
			],
			spawns:[ Spawn(1120, 890, 'iceArcher'), Spawn(1900, 890), Spawn(1240, 490, 'frostWraith') ],
		},

		/* Underground river: current fights positioning, banks are safe. */
		{
			id:'ice_river_run', kind:'river', category:'required', section:[2,3],
			w:2600, h:1000, label:'The Under-River', objective:'CROSS THE RIVER',
			cells:[ C(0, 220, 2600, 780), C(240, 60, 2120, 180) ],
			solids:[ S(0, 780, 300, 220), S(2300, 780, 300, 220) ],
			ports:{ left:{ y:580, h:200 }, right:{ y:580, h:200 } },
			platforms:[
				P('static', 300, 780, 220),
				P('static', 2080, 780, 220),
				/* Ice floes: stable but the current shoves you off. */
				P('static', 640, 800, 180),
				P('static', 1000, 800, 160),
				P('static', 1320, 800, 180),
				P('static', 1700, 800, 160),
				/* High dry ledges — slower but out of the flow. */
				P('static', 700, 540, 200),
				P('static', 1120, 480, 220),
				P('static', 1560, 540, 200),
			],
			hazards:[
				Water(520, 860, 1560, 140),
				Current(520, 800, 1560, 200, 1, 3.4),
				FrostField(520, 860, 1560, 140, 0.14),
				Fang(880, 60, 280, 0),
				Fang(1480, 60, 300, 140),
				Geyser(1160, 860, 280, 80, 15),
			],
			clearZone:{ x:2320, y:660, w:260, h:180 },
			props:[
				Pr('glacierWall', 0, 220, { w:300, h:560 }),
				Pr('glacierWall', 2300, 220, { w:300, h:560 }),
				Pr('frozenRiverBand', 520, 840, { w:1560, h:120, dir:1 }),
				Pr('iceShelf', 640, 792, { w:180, h:22 }),
				Pr('iceShelf', 1000, 792, { w:160, h:22 }),
				Pr('iceShelf', 1320, 792, { w:180, h:22 }),
				Pr('iceShelf', 1700, 792, { w:160, h:22 }),
				Pr('iceRidge', 700, 540, { w:220, h:34 }),
				Pr('icicleCluster', 840, 60, { w:220, h:60 }),
				Pr('icicleCluster', 1440, 60, { w:240, h:64 }),
				Pr('subglacialWater', 300, 960, { w:2000, h:40, flow:2 }),
				Pr('mistBank', 700, 900, { w:1200, h:80 }),
				Pr('iceLight', 1180, 620, { r:130 }),
			],
			spawns:[ Spawn(1140, 470, 'iceArcher'), Spawn(1360, 790), Spawn(760, 530) ],
		},

		/* Combat over authored fragile floor bays. Reposition or fall. */
		{
			id:'ice_shatter_arena', kind:'shatter', category:'required', section:[2,3,4],
			w:1960, h:1000, label:'The Shatter Floor', objective:'CLEAR THE CHAMBER',
			cells:[ C(0, 240, 1960, 760), C(200, 80, 1560, 180) ],
			solids:[ S(0, 820, 260, 180), S(1700, 820, 260, 180) ],
			ports:{ left:{ y:620, h:200 }, right:{ y:620, h:200 } },
			platforms:[
				P('static', 260, 820, 200),
				P('static', 1500, 820, 200),
				/* Safe piers — guaranteed to remain. */
				P('static', 700, 820, 200),
				P('static', 1120, 820, 200),
				/* Fragile bays between the piers. */
				Thin(460, 820, 240, { life:130 }),
				Thin(900, 820, 220, { life:120 }),
				Thin(1320, 820, 180, { life:130 }),
				/* Upper ring for archers and for player retreat. */
				P('static', 420, 540, 220),
				P('static', 880, 480, 240),
				P('static', 1340, 540, 220),
			],
			hazards:[
				Slick(260, 800, 1440, 0.4),
				Water(260, 940, 1440, 60),
				Fang(680, 240, 250, 0),
				Fang(1180, 240, 260, 120),
				FrostField(260, 940, 1440, 60, 0.12),
			],
			props:[
				Pr('glacierWall', 0, 240, { w:260, h:580 }),
				Pr('glacierWall', 1700, 240, { w:260, h:580 }),
				Pr('frozenPool', 260, 900, { w:1440, h:60 }),
				Pr('crackedPlateHint', 460, 810, { w:240, h:16 }),
				Pr('iceShelf', 700, 812, { w:200, h:24 }),
				Pr('iceShelf', 1120, 812, { w:200, h:24 }),
				Pr('crystalCluster', 900, 460, { w:100, h:130, n:4 }),
				Pr('icicleCluster', 620, 260, { w:220, h:66 }),
				Pr('icicleCluster', 1120, 260, { w:220, h:62 }),
				Pr('iceLight', 960, 660, { r:120 }),
				Pr('mistBank', 500, 960, { w:1000, h:60 }),
			],
			spawns:[ Spawn(760, 810, 'crystalScarab'), Spawn(1180, 810, 'snowboundMimic'), Spawn(920, 470, 'iceArcher'), Spawn(440, 530, 'cryoMage') ],
		},

		/* Squall arena: sight lines drop on a cycle, landmarks persist. */
		{
			id:'ice_squall_hollow', kind:'blizzard', category:'required', section:[2,3,4],
			w:2080, h:960, label:'Squall Hollow', objective:'SURVIVE THE SQUALL',
			surviveFrames:1140,
			cells:[ C(0, 240, 2080, 720), C(160, 60, 1760, 200) ],
			solids:[ S(0, 800, 240, 160), S(1840, 800, 240, 160) ],
			ports:{ left:{ y:600, h:200 }, right:{ y:600, h:200 } },
			platforms:[
				P('static', 240, 800, 240),
				P('static', 1600, 800, 240),
				P('static', 620, 800, 240),
				P('static', 1200, 800, 240),
				/* Windbreaks: standing behind these blunts the squall. */
				P('static', 520, 560, 160, { windbreak:true }),
				P('static', 1100, 520, 180, { windbreak:true }),
				P('static', 1560, 560, 160, { windbreak:true }),
			],
			hazards:[
				Squall(560, 0.78),
				Slick(240, 780, 1600, 0.46),
				FrostField(240, 700, 1600, 260, 0.05),
				Fang(760, 240, 240, 0),
				Fang(1340, 240, 260, 110),
			],
			props:[
				Pr('glacierWall', 0, 240, { w:240, h:560 }),
				Pr('glacierWall', 1840, 240, { w:240, h:560 }),
				/* Deliberately bold landmarks so the room stays readable. */
				Pr('iceColumn', 500, 300, { w:60, h:500 }),
				Pr('iceColumn', 1080, 260, { w:64, h:540 }),
				Pr('iceColumn', 1540, 300, { w:60, h:500 }),
				Pr('crystalCluster', 860, 780, { w:110, h:150, n:5 }),
				Pr('crystalCluster', 1380, 790, { w:100, h:140, n:4 }),
				Pr('snowDrift', 300, 940, { w:280, h:36 }),
				Pr('snowDrift', 1420, 940, { w:300, h:34 }),
				Pr('iceLight', 660, 620, { r:120 }),
				Pr('iceLight', 1420, 620, { r:120 }),
			],
			spawns:[ Spawn(680, 790), Spawn(1260, 790), Spawn(1140, 510, 'cryoMage') ],
		},

		/* Authored ice slide: one short, fast, branching run. */
		{
			id:'ice_slide_chute', kind:'slide', category:'required', section:[2,3],
			w:2600, h:1200, label:'The Chute', objective:'RIDE THE CHUTE',
			cells:[ C(0, 0, 2600, 1200) ],
			solids:[
				/* Thin ceiling so the channel stays walkable (player is 56px). */
				S(0, 0, 2600, 80),
				S(300, 420, 440, 780),
				S(1060, 560, 400, 640),
				S(1780, 700, 360, 500),
				/* Landing only — the drop shaft at the far right stays open. */
				S(2340, 840, 140, 360),
			],
			ports:{ left:{ y:100, h:280 }, bottom:{ x:2280, w:320 } },
			platforms:[
				/* Descending run. Wide enough that a slide never wedges. */
				P('static', 0, 380, 360, { slideRun:true }),
				P('static', 300, 420, 460, { slideRun:true }),
				P('static', 740, 540, 340, { slideRun:true }),
				P('static', 1060, 560, 420, { slideRun:true }),
				P('static', 1460, 680, 340, { slideRun:true }),
				P('static', 1780, 700, 400, { slideRun:true }),
				P('static', 2140, 820, 340, { slideRun:true }),
				P('static', 2340, 840, 140, { slideRun:true }),
				/* Optional high line: faster, needs a clean jump. */
				P('static', 880, 240, 280),
				P('static', 1400, 320, 280),
				P('static', 1940, 420, 280),
			],
			hazards:[
				Slick(0, 360, 2600, 0.72),
				Slick(880, 220, 280, 0.72),
				Slick(1400, 300, 280, 0.72),
				Slick(1940, 400, 280, 0.72),
				Fang(700, 80, 200, 0),
				Fang(1300, 80, 210, 70),
				Fang(1880, 80, 200, 140),
				/* Hanging slab — never seals the channel. */
				Press(1180, 90, 140, 70, 'y', 90, 420, 0),
			],
			clearZone:{ x:2280, y:700, w:320, h:180 },
			props:[
				Pr('glacierWall', 0, 0, { w:2600, h:80, alpha:0.6 }),
				Pr('iceShelf', 0, 372, { w:360, h:22 }),
				Pr('iceShelf', 300, 412, { w:460, h:22 }),
				Pr('iceShelf', 1060, 552, { w:420, h:22 }),
				Pr('iceShelf', 1780, 692, { w:400, h:22 }),
				Pr('iceShelf', 2340, 832, { w:140, h:22 }),
				Pr('icicleCluster', 640, 90, { w:220, h:66 }),
				Pr('icicleCluster', 1240, 90, { w:220, h:62 }),
				Pr('icicleCluster', 1820, 90, { w:220, h:60 }),
				Pr('lightShaft', 1500, 80, { w:200, h:500, alpha:0.14 }),
				Pr('mistBank', 400, 1120, { w:900, h:80 }),
				Pr('frozenBubbles', 240, 460, { w:44, h:180 }),
			],
			spawns:[],
		},

		/* Crystal forest: sight lines and movement broken up by crystals. */
		{
			id:'ice_crystal_wood', kind:'combat', category:'required', section:[2,3,4],
			w:2200, h:1040, label:'The Crystal Wood', objective:'CLEAR THE CAVERN',
			cells:[ C(0, 220, 2200, 820), C(200, 60, 1800, 180) ],
			solids:[
				S(0, 880, 220, 160), S(1980, 880, 220, 160),
				/* Crystal trunks are solid: real line-of-sight blockers. */
				S(520, 480, 70, 400), S(900, 380, 80, 500), S(1340, 460, 70, 420), S(1700, 400, 80, 480),
			],
			ports:{ left:{ y:660, h:200 }, right:{ y:660, h:200 }, top:{ x:1000, w:220 } },
			platforms:[
				P('static', 220, 880, 300),
				P('static', 590, 880, 310),
				P('static', 980, 880, 360),
				P('static', 1410, 880, 290),
				P('static', 1780, 880, 200),
				P('static', 640, 620, 220),
				P('static', 1120, 560, 240),
				P('static', 1480, 620, 220),
			],
			hazards:[
				Slick(220, 860, 1760, 0.34),
				Fang(760, 220, 260, 0),
				Fang(1200, 220, 270, 90),
				Fang(1620, 220, 250, 180),
			],
			props:[
				Pr('crystalCluster', 480, 480, { w:150, h:400, n:5 }),
				Pr('crystalCluster', 860, 380, { w:160, h:500, n:6 }),
				Pr('crystalCluster', 1300, 460, { w:150, h:420, n:5 }),
				Pr('crystalCluster', 1660, 400, { w:160, h:480, n:6 }),
				Pr('glacierWall', 0, 220, { w:220, h:660 }),
				Pr('glacierWall', 1980, 220, { w:220, h:660 }),
				Pr('iceLight', 700, 700, { r:140 }),
				Pr('iceLight', 1500, 700, { r:140 }),
				Pr('frozenPool', 240, 950, { w:400, h:40 }),
				Pr('snowDrift', 1000, 1010, { w:280, h:30 }),
				Pr('icicleCluster', 700, 240, { w:240, h:66 }),
			],
			spawns:[ Spawn(640, 870), Spawn(1080, 870), Spawn(1520, 870), Spawn(1160, 550, 'cryoMage') ],
		},

		/* ================= SECTION 3 — THE FROZEN RUINS ================= */

		/* Buried temple hall. Architecture, not cave. */
		{
			id:'ice_temple_hall', kind:'combat', category:'required', section:[3,4],
			w:2400, h:1200, label:'The Drowned Hall', objective:'CLEAR THE HALL',
			cells:[ C(0, 200, 2400, 1000), C(300, 60, 1800, 160) ],
			solids:[
				S(0, 1020, 280, 180), S(2120, 1020, 280, 180),
				/* Collapsed roof slab wedged across the hall. */
				S(1080, 300, 280, 90),
			],
			ports:{ left:{ y:800, h:200 }, right:{ y:800, h:200 }, bottom:{ x:1140, w:220 } },
			platforms:[
				P('static', 280, 1020, 280),
				P('static', 620, 1020, 280),
				P('static', 960, 1020, 480),
				P('static', 1500, 1020, 280),
				P('static', 1840, 1020, 280),
				/* Upper walkway along the colonnade. */
				P('static', 480, 700, 220),
				P('static', 1060, 660, 300),
				P('static', 1700, 700, 220),
			],
			hazards:[
				Slick(280, 1000, 1840, 0.28),
				Fang(1200, 390, 260, 0),
				Fang(700, 200, 280, 130),
				FrostField(280, 1080, 1840, 120, 0.04),
			],
			props:[
				Pr('ancientWallFace', 0, 200, { w:280, h:820 }),
				Pr('ancientWallFace', 2120, 200, { w:280, h:820 }),
				/* Visual colonnade only — walk through it. */
				Pr('carvedPillar', 550, 420, { w:80, h:600, ghost:true }),
				Pr('carvedPillar', 890, 420, { w:80, h:600, ghost:true }),
				Pr('carvedPillar', 1430, 420, { w:80, h:600, ghost:true }),
				Pr('carvedPillar', 1770, 420, { w:80, h:600, ghost:true }),
				Pr('frozenStatue', 380, 910, { w:52, h:120 }),
				Pr('frozenStatue', 1960, 910, { w:52, h:120 }),
				Pr('iceGlyphs', 1020, 980, { w:360, scale:1.1 }),
				Pr('buriedDoor', 1120, 200, { w:180, h:200 }),
				Pr('deadBrazier', 700, 976, { w:38, h:56 }),
				Pr('deadBrazier', 1640, 976, { w:38, h:56 }),
				Pr('frozenBanner', 620, 460, { w:30, h:110 }),
				Pr('frozenBanner', 1740, 460, { w:30, h:110 }),
				Pr('lightShaft', 1140, 60, { w:220, h:800, alpha:0.16 }),
				Pr('icicleCluster', 960, 400, { w:240, h:70 }),
				Pr('hoarFrost', 300, 1010, { w:1800, h:16 }),
				Pr('mistBank', 700, 1160, { w:1000, h:70 }),
			],
			spawns:[ Spawn(700, 1010), Spawn(1200, 1010), Spawn(1700, 1010), Spawn(1120, 650, 'iceArcher') ],
		},

		/* Ancient mechanism room: three rings, one authored order. */
		{
			id:'ice_mechanism_vault', kind:'mechanism', category:'required', section:[3,4],
			w:2000, h:1100, label:'The Ring Chamber', objective:'ENGAGE THE RINGS IN ORDER',
			cells:[ C(0, 220, 2000, 880), C(260, 80, 1480, 160) ],
			solids:[
				S(0, 940, 240, 160), S(1760, 940, 240, 160),
				S(620, 480, 80, 460), S(1300, 480, 80, 460),
			],
			ports:{ left:{ y:740, h:200 }, right:{ y:740, h:200 } },
			platforms:[
				P('static', 240, 940, 380),
				P('static', 700, 940, 600),
				P('static', 1380, 940, 380),
				P('static', 460, 700, 200),
				P('static', 900, 620, 240),
				P('static', 1340, 700, 200),
			],
			hazards:[
				Slick(240, 920, 1520, 0.26),
				Press(860, 300, 280, 200, 'y', 180, 460, 0),
				Fang(1000, 500, 280, 60),
			],
			interactables:[
				{ kind:'ring', x:480, y:600, w:64, h:64, order:1, name:'Outer Ring', icon:'\u2744' },
				{ kind:'ring', x:960, y:520, w:64, h:64, order:2, name:'Middle Ring', icon:'\u2744' },
				{ kind:'ring', x:1360, y:600, w:64, h:64, order:3, name:'Inner Ring', icon:'\u2744' },
			],
			props:[
				Pr('ancientWallFace', 0, 220, { w:240, h:720 }),
				Pr('ancientWallFace', 1760, 220, { w:240, h:720 }),
				Pr('carvedPillar', 610, 480, { w:100, h:460 }),
				Pr('carvedPillar', 1290, 480, { w:100, h:460 }),
				Pr('iceGlyphs', 700, 900, { w:600, scale:1 }),
				Pr('frozenAltar', 920, 860, { w:100, h:70 }),
				Pr('frozenStatue', 320, 830, { w:50, h:110 }),
				Pr('frozenStatue', 1620, 830, { w:50, h:110 }),
				Pr('iceLight', 980, 700, { r:150 }),
				Pr('icicleCluster', 820, 240, { w:240, h:64 }),
				Pr('hoarFrost', 260, 930, { w:1480, h:14 }),
			],
			spawns:[ Spawn(760, 930), Spawn(1300, 930) ],
		},

		/* Reflections paint routes that do not exist. */
		{
			id:'ice_mirror_gallery', kind:'mirror', category:'required', section:[3,4],
			w:2200, h:1000, label:'The Mirror Gallery', objective:'TURN THE MIRRORS — FEED THE TRUE CRYSTAL',
			cells:[ C(0, 220, 2200, 780), C(240, 80, 1720, 160) ],
			solids:[
				S(0, 840, 240, 160), S(1960, 840, 240, 160),
				/* Mirror plinths are solid — the reflections are not. */
				S(700, 620, 60, 220), S(1180, 560, 60, 280), S(1620, 620, 60, 220),
			],
			ports:{ left:{ y:640, h:200 }, right:{ y:640, h:200 } },
			platforms:[
				P('static', 240, 840, 300),
				P('static', 620, 840, 200),
				P('static', 1000, 780, 220),
				P('static', 1400, 840, 220),
				P('static', 1740, 840, 220),
				/* True upper route. */
				P('static', 520, 600, 180),
				P('static', 900, 520, 200),
				P('static', 1320, 560, 200),
				P('static', 320, 590, 200),
				P('static', 900, 590, 220),
			],
			hazards:[
				Slick(240, 820, 1720, 0.36),
				/* Painted decoys. Walking into one costs nothing but time. */
				Mirror(760, 480, 380, 340, { fake:'ledge' }),
				Mirror(1240, 520, 360, 300, { fake:'ledge' }),
				Mirror(400, 700, 300, 140, { fake:'floor' }),
				Fang(1080, 220, 280, 40),
			],
			clearZone:{ x:1980, y:700, w:220, h:180 },
			props:[
				Pr('mirrorPlane', 700, 300, { w:60, h:540 }),
				Pr('mirrorPlane', 1180, 260, { w:60, h:580 }),
				Pr('mirrorPlane', 1620, 300, { w:60, h:540 }),
				Pr('ancientWallFace', 0, 220, { w:240, h:620 }),
				Pr('ancientWallFace', 1960, 220, { w:240, h:620 }),
				Pr('iceGlyphs', 320, 800, { w:260, scale:0.9 }),
				Pr('iceLight', 980, 620, { r:160 }),
				Pr('crystalCluster', 1740, 830, { w:90, h:120, n:4 }),
				Pr('icicleCluster', 900, 240, { w:220, h:62 }),
				Pr('mistBank', 600, 950, { w:900, h:60 }),
			],
			spawns:[ Spawn(1040, 770, 'frostWraith'), Spawn(1440, 830) ],
		},

		/* Meltwater floods in. Vertical escape, authored levels. */
		{
			id:'ice_flood_stair', kind:'flood', category:'required', section:[3,4],
			w:1800, h:1700, label:'The Rising Stair', objective:'REACH HIGHER GROUND',
			cells:[ C(0, 0, 1800, 1700) ],
			solids:[ S(0, 0, 480, 300), S(1420, 0, 380, 260), S(0, 1560, 300, 140) ],
			ports:{ bottom:{ x:700, w:240 }, top:{ x:560, w:240 } },
			platforms:[
				P('static', 300, 1500, 300),
				P('static', 720, 1380, 240),
				P('static', 1080, 1440, 260),
				P('static', 480, 1220, 240),
				P('static', 940, 1140, 260),
				P('static', 1340, 1220, 260),
				P('static', 620, 960, 240),
				P('static', 1080, 880, 240),
				P('static', 400, 700, 240),
				P('static', 880, 620, 260),
				P('static', 1280, 700, 240),
				P('static', 560, 420, 300),
				P('static', 1000, 340, 260),
				/* Two viable ladders so the escape is a choice, not a rail. */
				Shelf(1340, 980, 200),
				Shelf(300, 900, 200),
			],
			ports_note:'bottom entry, top exit',
			hazards:[
				Rise(0, 1700, 300, 1800, { speed:0.34, hold:520 }),
				Slick(300, 1480, 300, 0.4),
				Slick(940, 1120, 260, 0.42),
				Fang(760, 300, 240, 0),
				Fang(1180, 260, 260, 110),
				FrostField(0, 1400, 1800, 300, 0.08),
			],
			clearZone:{ x:540, y:280, w:280, h:180 },
			props:[
				Pr('glacierWall', 0, 300, { w:300, h:1260 }),
				Pr('glacierWall', 1500, 260, { w:300, h:1300 }),
				Pr('ruinedStair', 480, 1180, { w:280, h:180, steps:5 }),
				Pr('ruinedStair', 1080, 820, { w:280, h:180, steps:5, dir:'down' }),
				Pr('iceShelf', 300, 1492, { w:300, h:26 }),
				Pr('iceShelf', 720, 1372, { w:240, h:24 }),
				Pr('iceShelf', 940, 1132, { w:260, h:24 }),
				Pr('iceShelf', 880, 612, { w:260, h:24 }),
				Pr('carvedPillar', 1240, 380, { w:44, h:320 }),
				Pr('lightShaft', 540, 260, { w:240, h:900, alpha:0.17 }),
				Pr('icicleCluster', 700, 320, { w:240, h:70 }),
				Pr('subglacialWater', 300, 1660, { w:1200, h:40, flow:1.4 }),
				Pr('mistBank', 400, 1620, { w:1000, h:80 }),
			],
			spawns:[ Spawn(960, 1130, 'iceArcher'), Spawn(900, 610) ],
		},

		/* Authored collapse: the ceiling comes down along a known line. */
		{
			id:'ice_collapse_run', kind:'collapseEvent', category:'required', section:[3,4],
			w:2800, h:1000, label:'The Failing Gallery', objective:'ESCAPE THE COLLAPSE',
			cells:[ C(0, 200, 2800, 800), C(200, 60, 2400, 160) ],
			solids:[ S(0, 840, 240, 160), S(2560, 840, 240, 160) ],
			ports:{ left:{ y:640, h:200 }, right:{ y:640, h:200 } },
			platforms:[
				P('static', 240, 840, 280),
				P('static', 620, 800, 240),
				P('static', 1000, 840, 260),
				P('static', 1400, 780, 240),
				P('static', 1780, 840, 260),
				P('static', 2160, 800, 240),
				P('static', 2480, 840, 200),
				Shelf(520, 840, 100, { life:70 }),
				Shelf(1260, 840, 140, { life:70 }),
				Shelf(2020, 840, 140, { life:70 }),
			],
			hazards:[
				/* Collapse marches left to right behind the player. */
				Collapse(240, 200, 320, 120, 0),
				Collapse(560, 200, 320, 120, 70),
				Collapse(880, 200, 320, 120, 140),
				Collapse(1200, 200, 320, 120, 210),
				Collapse(1520, 200, 320, 120, 280),
				Collapse(1840, 200, 320, 120, 350),
				Collapse(2160, 200, 320, 120, 420),
				Slick(240, 820, 2320, 0.44),
				Water(240, 960, 2320, 40),
			],
			clearZone:{ x:2580, y:720, w:220, h:180 },
			props:[
				Pr('glacierWall', 0, 200, { w:240, h:640 }),
				Pr('glacierWall', 2560, 200, { w:240, h:640 }),
				Pr('icicleCluster', 400, 220, { w:240, h:76 }),
				Pr('icicleCluster', 1000, 220, { w:260, h:80 }),
				Pr('icicleCluster', 1600, 220, { w:240, h:74 }),
				Pr('icicleCluster', 2200, 220, { w:240, h:72 }),
				Pr('iceRidge', 620, 800, { w:260, h:36 }),
				Pr('iceRidge', 1780, 840, { w:280, h:34 }),
				Pr('frozenPool', 240, 940, { w:2320, h:50 }),
				Pr('mistBank', 800, 960, { w:1200, h:60 }),
				Pr('iceLight', 1400, 620, { r:120 }),
			],
			spawns:[],
		},

		/* ================= SECTION 4 — THE GLACIAL HEART ================= */

		/* Enormous crystalline chamber. Pure spectacle plus real climbing. */
		{
			id:'ice_heart_chamber', kind:'heart', category:'required', section:[4],
			w:3400, h:2200, label:'The Glacial Heart', objective:'CROSS THE HEART',
			cells:[ C(0, 0, 3400, 2200) ],
			solids:[
				S(0, 1900, 460, 300), S(2940, 1860, 460, 340),
				S(0, 0, 700, 320), S(2700, 0, 700, 280),
				/* Colossal crystal spires reaching floor to ceiling. */
				S(1180, 700, 110, 1200), S(2100, 620, 120, 1240),
			],
			ports:{ left:{ y:1680, h:220 }, right:{ y:1640, h:220 }, top:{ x:1600, w:240 } },
			platforms:[
				P('static', 460, 1900, 320),
				P('static', 2620, 1860, 320),
				/* Lower gallery. */
				P('static', 820, 1880, 300),
				P('static', 1400, 1900, 320),
				P('static', 1900, 1880, 200),
				P('static', 2280, 1900, 340),
				/* Mid tier: suspended shelves off the spires. */
				P('static', 700, 1560, 260),
				P('static', 1300, 1480, 280),
				P('static', 1820, 1560, 260),
				P('static', 2360, 1480, 280),
				/* Upper tier. */
				P('static', 900, 1180, 260),
				P('static', 1480, 1080, 300),
				P('static', 2060, 1180, 260),
				/* Crown walk to the top exit. */
				P('static', 1180, 780, 280),
				P('static', 1700, 680, 320),
				P('static', 2180, 780, 280),
				Shelf(1520, 1300, 220),
				Shelf(1080, 960, 200),
			],
			hazards:[
				Slick(460, 1880, 2480, 0.4),
				Water(460, 2040, 2480, 160),
				Geyser(1000, 2040, 320, 0, 19),
				Geyser(1760, 2040, 340, 160, 19),
				Geyser(2480, 2040, 330, 80, 18),
				Fang(1420, 620, 300, 0),
				Fang(2000, 560, 320, 140),
				Press(0, 1200, 420, 300, 'x', 260, 520, 0),
				Press(2980, 900, 420, 300, 'x', 260, 520, 260),
				FrostField(460, 2040, 2480, 160, 0.12),
			],
			clearZone:{ x:1560, y:620, w:320, h:200 },
			props:[
				Pr('glacierWall', 0, 320, { w:460, h:1580 }),
				Pr('glacierWall', 2940, 280, { w:460, h:1580 }),
				Pr('crystalCluster', 1120, 700, { w:230, h:1200, n:7 }),
				Pr('crystalCluster', 2040, 620, { w:240, h:1240, n:7 }),
				Pr('crystalCluster', 620, 1840, { w:150, h:280, n:5 }),
				Pr('crystalCluster', 2700, 1800, { w:160, h:300, n:5 }),
				Pr('frozenWaterfall', 480, 320, { w:180, h:1560 }),
				Pr('frozenWaterfall', 2760, 280, { w:170, h:1560 }),
				Pr('lightShaft', 1560, 280, { w:300, h:1700, alpha:0.18 }),
				Pr('lightShaft', 900, 320, { w:200, h:1500, alpha:0.11 }),
				Pr('iceBridgeDeck', 1300, 1472, { w:280, h:26 }),
				Pr('iceBridgeDeck', 1480, 1072, { w:300, h:26 }),
				Pr('iceShelf', 700, 1552, { w:260, h:26 }),
				Pr('iceShelf', 1820, 1552, { w:260, h:26 }),
				Pr('iceShelf', 2360, 1472, { w:280, h:26 }),
				Pr('iceShelf', 1700, 672, { w:320, h:28 }),
				Pr('buriedDoor', 1580, 0, { w:220, h:300 }),
				Pr('frozenStatue', 780, 1780, { w:60, h:130 }),
				Pr('frozenStatue', 2560, 1740, { w:60, h:130 }),
				Pr('preservedBeast', 1900, 2020, { w:200, h:130 }),
				Pr('mistBank', 700, 2120, { w:1000, h:100 }),
				Pr('mistBank', 1900, 2120, { w:1000, h:100 }),
				Pr('iceLight', 1440, 1420, { r:180 }),
				Pr('iceLight', 1900, 1000, { r:160 }),
			],
			spawns:[
				Spawn(880, 1870, 'snowBeast'), Spawn(1460, 1890), Spawn(2340, 1890),
				Spawn(1340, 1470, 'iceArcher'), Spawn(1520, 1070, 'cryoMage'),
			],
		},

		/* Vertical shaft in the deepest ice — heavy climbing, big drops. */
		{
			id:'ice_deep_shaft', kind:'ascent', category:'required', section:[4],
			w:1600, h:2600, label:'The Deep Shaft', objective:'CLIMB THE SHAFT',
			cells:[ C(0, 0, 1600, 2600) ],
			solids:[ S(0, 2440, 420, 160), S(1180, 0, 420, 240) ],
			ports:{ bottom:{ x:560, w:240 }, top:{ x:820, w:220 } },
			platforms:[
				P('static', 420, 2360, 280),
				P('static', 820, 2220, 240),
				P('static', 380, 2060, 240),
				Shelf(800, 1900, 200),
				P('static', 400, 1740, 240),
				P('static', 860, 1580, 240),
				P('static', 380, 1420, 220),
				Shelf(840, 1260, 200),
				P('static', 420, 1100, 240),
				P('static', 880, 940, 240),
				P('static', 400, 780, 220),
				P('static', 840, 620, 240),
				P('static', 520, 440, 240),
				P('static', 860, 280, 260),
			],
			hazards:[
				Geyser(700, 2400, 300, 0, 19),
				Geyser(1060, 1620, 320, 150, 18),
				Fang(560, 2000, 260, 0),
				Fang(960, 1300, 280, 90),
				Fang(500, 700, 270, 180),
				Press(0, 1500, 340, 260, 'x', 240, 480, 0),
				Press(1260, 900, 340, 260, 'x', 240, 480, 240),
				Slick(400, 1720, 240, 0.44),
				Slick(880, 920, 240, 0.44),
			],
			clearZone:{ x:800, y:240, w:280, h:180 },
			props:[
				Pr('crevasseEdge', 0, 0, { w:1600, h:2600, alpha:0.45 }),
				Pr('glacierWall', 0, 240, { w:340, h:2200, alpha:0.66 }),
				Pr('glacierWall', 1260, 240, { w:340, h:2200, alpha:0.66 }),
				Pr('frozenWaterfall', 300, 240, { w:130, h:2100 }),
				Pr('lightShaft', 800, 240, { w:240, h:1600, alpha:0.16 }),
				Pr('iceShelf', 420, 2352, { w:280, h:26 }),
				Pr('iceShelf', 820, 2212, { w:240, h:24 }),
				Pr('iceShelf', 400, 1732, { w:240, h:24 }),
				Pr('iceShelf', 860, 1572, { w:240, h:24 }),
				Pr('iceShelf', 420, 1092, { w:240, h:24 }),
				Pr('iceShelf', 880, 932, { w:240, h:24 }),
				Pr('iceShelf', 840, 612, { w:240, h:24 }),
				Pr('crystalCluster', 1080, 2320, { w:120, h:200, n:5 }),
				Pr('frozenBubbles', 340, 1400, { w:48, h:280 }),
				Pr('frozenBubbles', 1220, 600, { w:48, h:260 }),
				Pr('mistBank', 300, 2520, { w:900, h:90 }),
				Pr('iceLight', 700, 1500, { r:150 }),
			],
			spawns:[ Spawn(420, 1730, 'frostWraith'), Spawn(880, 930, 'iceArcher') ],
		},

		/* ================= BRANCH FORKS ================= */

		/* Warm route vs deep-frozen route. Both reconnect. */
		{
			id:'ice_fork_warmdeep', kind:'iceFork', category:'required', section:[2,3],
			w:1600, h:900, noCombat:true, label:'The Parting', objective:'CHOOSE A ROUTE',
			cells:[ C(0, 300, 1600, 600), C(200, 100, 500, 220), C(900, 100, 500, 220) ],
			solids:[ S(700, 300, 200, 160), S(0, 780, 200, 120), S(1400, 780, 200, 120) ],
			ports:{ left:{ y:560, h:200 }, top:{ x:300, w:220 }, right:{ y:560, h:200 } },
			platforms:[
				P('static', 200, 780, 300),
				P('static', 620, 720, 360),
				P('static', 1100, 780, 300),
				P('static', 260, 460, 240),
				P('static', 1060, 460, 240),
			],
			hazards:[ Slick(200, 760, 1200, 0.3) ],
			doorLabels:{ top:'THE WARM WAY — SAFER', right:'THE DEEP FROZEN — RICHER' },
			props:[
				Pr('ancientWallFace', 700, 300, { w:200, h:480 }),
				Pr('iceGlyphs', 720, 620, { w:160, scale:0.9 }),
				Pr('deadBrazier', 320, 424, { w:38, h:56 }),
				Pr('deadBrazier', 1200, 424, { w:38, h:56 }),
				/* The two routes are visually pre-announced. */
				Pr('warmHint', 300, 320, { w:220, h:140 }),
				Pr('deepHint', 1060, 320, { w:220, h:140 }),
				Pr('frozenStatue', 620, 660, { w:50, h:110 }),
				Pr('frozenStatue', 940, 660, { w:50, h:110 }),
				Pr('iceLight', 800, 560, { r:130 }),
				Pr('snowDrift', 240, 876, { w:200, h:26 }),
			],
			spawns:[],
		},

		/* Ruins route vs glacier route. */
		{
			id:'ice_fork_ruinglacier', kind:'deepFork', category:'required', section:[3,4],
			w:1700, h:1000, noCombat:true, label:'The Divide', objective:'CHOOSE A ROUTE',
			cells:[ C(0, 340, 1700, 660), C(160, 120, 560, 240), C(980, 120, 560, 240) ],
			solids:[ S(760, 340, 180, 200), S(0, 880, 220, 120), S(1480, 880, 220, 120) ],
			ports:{ left:{ y:640, h:200 }, top:{ x:260, w:220 }, right:{ y:600, h:200 } },
			platforms:[
				P('static', 220, 880, 320),
				P('static', 660, 820, 380),
				P('static', 1160, 880, 320),
				P('static', 240, 520, 240),
				P('static', 1120, 500, 240),
			],
			hazards:[ Slick(220, 860, 1260, 0.3), Fang(860, 540, 280, 0) ],
			doorLabels:{ top:'THE BURIED RUINS', right:'THE OPEN GLACIER' },
			props:[
				Pr('ancientWallFace', 760, 340, { w:180, h:480 }),
				Pr('buriedDoor', 240, 200, { w:160, h:200 }),
				Pr('glacierWall', 1080, 140, { w:300, h:360 }),
				Pr('iceGlyphs', 780, 700, { w:140, scale:0.9 }),
				Pr('carvedPillar', 700, 440, { w:44, h:380 }),
				Pr('frozenStatue', 1000, 760, { w:52, h:120 }),
				Pr('iceLight', 860, 640, { r:140 }),
				Pr('crystalCluster', 1300, 860, { w:100, h:140, n:4 }),
			],
			spawns:[],
		},

		/* ================= OPTIONAL / REWARD ================= */

		/* Frost Shrine — rare, calm, four authored blessings. */
		{
			id:'ice_shrine_still', kind:'shrine', category:'optional', section:[1,2,3,4],
			w:1100, h:760, noCombat:true, label:'Frost Shrine', objective:'CHOOSE ONE BLESSING',
			cells:[ C(0, 260, 1100, 500), C(240, 80, 620, 200) ],
			solids:[ S(0, 660, 180, 100), S(920, 660, 180, 100) ],
			ports:{ left:{ y:480, h:180 } },
			platforms:[ P('static', 180, 660, 320), P('static', 560, 620, 360) ],
			hazards:[],
			interactables:[
				{ kind:'shrine', x:500, y:520, w:96, h:100, name:'Frost Shrine', icon:'\u2744' },
			],
			props:[
				Pr('lightShaft', 440, 80, { w:220, h:560, alpha:0.24 }),
				Pr('frozenAltar', 480, 540, { w:130, h:80 }),
				Pr('carvedPillar', 320, 300, { w:44, h:360 }),
				Pr('carvedPillar', 720, 300, { w:44, h:360 }),
				Pr('iceGlyphs', 420, 640, { w:260, scale:1.1 }),
				Pr('frozenStatue', 240, 560, { w:52, h:110 }),
				Pr('frozenStatue', 800, 560, { w:52, h:110 }),
				Pr('iceLight', 550, 420, { r:170 }),
				Pr('crystalCluster', 860, 640, { w:90, h:120, n:4 }),
				Pr('snowDrift', 220, 736, { w:200, h:26 }),
			],
			spawns:[],
		},

		/* Warming Chamber — the one warm-lit room in the dungeon. */
		{
			id:'ice_warming_hearth', kind:'warming', category:'optional', section:[2,3,4],
			w:1000, h:700, noCombat:true, label:'Warming Chamber', objective:'SHED YOUR FROST',
			cells:[ C(0, 240, 1000, 460), C(200, 80, 600, 180) ],
			solids:[ S(0, 620, 160, 80), S(840, 620, 160, 80) ],
			ports:{ left:{ y:460, h:180 } },
			platforms:[ P('static', 160, 620, 320), P('static', 540, 580, 300) ],
			hazards:[],
			interactables:[
				{ kind:'hearth', x:460, y:500, w:90, h:90, name:'Ancient Hearth', icon:'\u2668' },
			],
			props:[
				/* Deliberate warm palette break — this room must feel different. */
				Pr('warmHearth', 440, 500, { w:130, h:100 }),
				Pr('warmGlow', 500, 460, { r:230 }),
				Pr('ancientWallFace', 0, 240, { w:160, h:380 }),
				Pr('ancientWallFace', 840, 240, { w:160, h:380 }),
				Pr('carvedPillar', 280, 280, { w:40, h:340 }),
				Pr('carvedPillar', 680, 280, { w:40, h:340 }),
				Pr('meltRunnel', 200, 660, { w:600, h:26 }),
				Pr('frozenCamp', 700, 616, { w:110, h:50 }),
				Pr('iceGlyphs', 400, 600, { w:200, scale:0.9, glow:false }),
			],
			spawns:[],
		},

		/* Frozen Vault — opening it wakes the room. */
		{
			id:'ice_vault_cache', kind:'vault', category:'optional', section:[2,3,4],
			w:1500, h:900, label:'Frozen Vault', objective:'SURVIVE THE VAULT',
			cells:[ C(0, 280, 1500, 620), C(260, 100, 980, 180) ],
			solids:[ S(0, 780, 200, 120), S(1300, 780, 200, 120), S(660, 280, 180, 140) ],
			ports:{ left:{ y:580, h:200 } },
			platforms:[
				P('static', 200, 780, 340),
				P('static', 620, 740, 260),
				P('static', 960, 780, 340),
				P('static', 400, 560, 200),
				P('static', 940, 540, 220),
			],
			hazards:[
				Rise(0, 900, 460, 1500, { speed:0.42, hold:400, vault:true, armed:false }),
				Slick(200, 760, 1100, 0.34),
			],
			interactables:[
				{ kind:'vault', x:700, y:660, w:80, h:80, name:'Frozen Vault', icon:'\uD83D\uDC8E' },
			],
			props:[
				Pr('ancientWallFace', 660, 280, { w:180, h:460 }),
				Pr('buriedDoor', 660, 420, { w:180, h:240 }),
				Pr('iceGlyphs', 620, 720, { w:260, scale:1 }),
				Pr('frozenStatue', 320, 680, { w:52, h:110 }),
				Pr('frozenStatue', 1140, 680, { w:52, h:110 }),
				Pr('crystalCluster', 1000, 760, { w:110, h:150, n:5 }),
				Pr('iceLight', 740, 560, { r:150 }),
				Pr('icicleCluster', 500, 300, { w:220, h:64 }),
				Pr('subglacialWater', 200, 870, { w:1100, h:30, flow:1 }),
			],
			spawns:[],
		},

		/* Frozen Prison — leave it, or break it for a harder, richer fight. */
		{
			id:'ice_prison_cell', kind:'prison', category:'optional', section:[3,4],
			w:1400, h:900, label:'The Sealed Cell', objective:'FREE IT, OR LEAVE IT',
			cells:[ C(0, 300, 1400, 600), C(240, 120, 920, 180) ],
			solids:[ S(0, 780, 200, 120), S(1200, 780, 200, 120) ],
			ports:{ left:{ y:600, h:200 } },
			platforms:[
				P('static', 200, 780, 360),
				P('static', 620, 780, 320),
				P('static', 1000, 780, 200),
				P('static', 420, 560, 220),
				P('static', 880, 540, 220),
			],
			hazards:[ Slick(200, 760, 1000, 0.36), FrostField(200, 600, 1000, 180, 0.07) ],
			interactables:[
				{ kind:'prison', x:660, y:620, w:100, h:150, name:'Sealed Warrior', icon:'\u26D3' },
			],
			props:[
				Pr('prisonBlock', 620, 580, { w:180, h:200 }),
				Pr('ancientWallFace', 0, 300, { w:200, h:480 }),
				Pr('ancientWallFace', 1200, 300, { w:200, h:480 }),
				Pr('iceGlyphs', 560, 760, { w:300, scale:1 }),
				Pr('frozenStatue', 340, 670, { w:52, h:110 }),
				Pr('frozenStatue', 1020, 670, { w:52, h:110 }),
				Pr('carvedPillar', 460, 340, { w:44, h:220 }),
				Pr('carvedPillar', 900, 340, { w:44, h:200 }),
				Pr('iceLight', 700, 500, { r:150 }),
				Pr('mistBank', 400, 860, { w:700, h:50 }),
			],
			spawns:[],
		},

		/* Frost Trial — authored variants, one chosen per run. */
		{
			id:'ice_trial_court', kind:'trial', category:'optional', section:[2,3,4],
			w:1900, h:1000, label:'Frost Trial', objective:'COMPLETE THE TRIAL',
			cells:[ C(0, 260, 1900, 740), C(200, 80, 1500, 180) ],
			solids:[ S(0, 860, 220, 140), S(1680, 860, 220, 140) ],
			ports:{ left:{ y:660, h:200 } },
			platforms:[
				P('static', 220, 860, 260),
				P('static', 1420, 860, 260),
				P('static', 620, 860, 200),
				P('static', 1040, 860, 200),
				Thin(480, 860, 140),
				Thin(820, 860, 220),
				Thin(1240, 860, 180),
				P('static', 520, 620, 200),
				P('static', 940, 560, 220),
				P('static', 1340, 620, 200),
			],
			hazards:[
				Slick(220, 840, 1460, 0.5),
				Water(220, 960, 1460, 40),
				Fang(700, 260, 240, 0),
				Fang(1180, 260, 250, 110),
			],
			interactables:[
				{ kind:'trial', x:300, y:780, w:80, h:80, name:'Trial Marker', icon:'\u2744' },
			],
			trialVariants:['momentum', 'precision', 'cracking', 'squall', 'current'],
			props:[
				Pr('ancientWallFace', 0, 260, { w:220, h:600 }),
				Pr('ancientWallFace', 1680, 260, { w:220, h:600 }),
				Pr('frozenAltar', 260, 800, { w:100, h:70 }),
				Pr('iceGlyphs', 600, 840, { w:700, scale:0.95 }),
				Pr('carvedPillar', 560, 320, { w:44, h:300 }),
				Pr('carvedPillar', 1300, 320, { w:44, h:300 }),
				Pr('frozenPool', 220, 940, { w:1460, h:50 }),
				Pr('iceLight', 940, 700, { r:150 }),
				Pr('crystalCluster', 1460, 840, { w:100, h:140, n:4 }),
			],
			spawns:[],
		},

		/* Elite chamber: multi-level with a slick shelf ring. */
		{
			id:'ice_elite_terrace', kind:'elite', category:'optional', section:[2,3,4],
			w:1900, h:1100, label:'The Warden Terrace', objective:'DEFEAT THE ELITE',
			elite:true,
			cells:[ C(0, 300, 1900, 800), C(200, 100, 1500, 200) ],
			solids:[ S(0, 940, 240, 160), S(1660, 940, 240, 160), S(880, 300, 160, 160) ],
			ports:{ left:{ y:740, h:200 } },
			platforms:[
				P('static', 240, 940, 360),
				P('static', 700, 940, 500),
				P('static', 1300, 940, 360),
				P('static', 420, 720, 220),
				P('static', 860, 640, 240),
				P('static', 1300, 720, 220),
				P('static', 640, 460, 200),
				P('static', 1080, 460, 200),
			],
			hazards:[
				Slick(240, 920, 1420, 0.48),
				Fang(760, 460, 230, 0),
				Fang(1140, 460, 240, 100),
				Geyser(960, 1080, 300, 60, 16),
			],
			props:[
				Pr('glacierWall', 0, 300, { w:240, h:640 }),
				Pr('glacierWall', 1660, 300, { w:240, h:640 }),
				Pr('ancientWallFace', 880, 300, { w:160, h:340 }),
				Pr('iceRidge', 420, 720, { w:240, h:36 }),
				Pr('iceRidge', 1300, 720, { w:240, h:34 }),
				Pr('crystalCluster', 600, 920, { w:110, h:150, n:5 }),
				Pr('crystalCluster', 1220, 920, { w:110, h:150, n:5 }),
				Pr('frozenStatue', 340, 830, { w:56, h:120 }),
				Pr('frozenStatue', 1500, 830, { w:56, h:120 }),
				Pr('iceLight', 940, 780, { r:160 }),
				Pr('icicleCluster', 700, 320, { w:240, h:70 }),
			],
			spawns:[ Spawn(940, 930, 'glacierSentinel'), Spawn(500, 710), Spawn(1360, 710) ],
		},

		/* Small optional cache tucked off the main line. */
		{
			id:'ice_cache_hollow', kind:'cache', category:'optional', section:[1,2,3,4],
			w:760, h:520, noCombat:true, label:'Ice Hollow', objective:'',
			cells:[ C(0, 200, 760, 320), C(140, 80, 400, 140) ],
			solids:[ S(0, 440, 140, 80), S(620, 440, 140, 80) ],
			ports:{ left:{ y:340, h:180 } },
			platforms:[ P('static', 140, 440, 260), P('static', 440, 400, 200) ],
			hazards:[],
			interactables:[
				{ kind:'cache', x:480, y:340, w:60, h:60, name:'Frozen Cache', icon:'\uD83E\uDDCA' },
			],
			props:[
				Pr('glacierWall', 0, 200, { w:140, h:240 }),
				Pr('icicleCluster', 200, 220, { w:180, h:52 }),
				Pr('crystalCluster', 300, 430, { w:80, h:110, n:3 }),
				Pr('snowDrift', 160, 496, { w:180, h:24 }),
				Pr('iceLight', 460, 300, { r:110 }),
				Pr('frozenBubbles', 620, 260, { w:40, h:120 }),
			],
			spawns:[],
		},

		/* ================= SECRETS ================= */

		{
			id:'ice_secret_cave', kind:'secretCave', category:'secret', section:[2,3,4],
			w:900, h:640, noCombat:true, secret:true, label:'Hidden Glacier Cave', objective:'',
			cells:[ C(0, 240, 900, 400), C(160, 80, 520, 160) ],
			solids:[ S(0, 560, 160, 80), S(740, 560, 160, 80) ],
			ports:{ left:{ y:400, h:180 } },
			platforms:[ P('static', 160, 560, 300), P('static', 520, 520, 220) ],
			hazards:[],
			interactables:[
				{ kind:'cache', x:560, y:440, w:64, h:64, rare:true, name:'Deep Cache', icon:'\uD83D\uDC8E' },
			],
			props:[
				Pr('crystalCluster', 240, 550, { w:130, h:200, n:6 }),
				Pr('crystalCluster', 620, 510, { w:120, h:180, n:5 }),
				Pr('lightShaft', 380, 80, { w:180, h:480, alpha:0.2 }),
				Pr('icicleCluster', 300, 250, { w:200, h:60 }),
				Pr('frozenBubbles', 800, 300, { w:44, h:180 }),
				Pr('iceLight', 460, 380, { r:150 }),
			],
			spawns:[],
		},

		{
			id:'ice_secret_shrine', kind:'secretShrine', category:'secret', section:[3,4],
			w:960, h:700, noCombat:true, secret:true, label:'Ancient Frozen Shrine', objective:'CLAIM THE RELIC',
			cells:[ C(0, 260, 960, 440), C(200, 80, 560, 180) ],
			solids:[ S(0, 620, 160, 80), S(800, 620, 160, 80) ],
			ports:{ left:{ y:440, h:180 } },
			platforms:[ P('static', 160, 620, 300), P('static', 540, 580, 260) ],
			hazards:[],
			interactables:[
				{ kind:'relic', x:520, y:500, w:80, h:80, name:'Glacier Relic', icon:'\u2744' },
			],
			props:[
				Pr('buriedDoor', 380, 80, { w:200, h:240 }),
				Pr('frozenAltar', 500, 520, { w:120, h:70 }),
				Pr('carvedPillar', 300, 300, { w:44, h:320 }),
				Pr('carvedPillar', 660, 300, { w:44, h:320 }),
				Pr('iceGlyphs', 420, 600, { w:240, scale:1.2 }),
				Pr('lightShaft', 420, 80, { w:200, h:520, alpha:0.26 }),
				Pr('frozenStatue', 220, 520, { w:56, h:120 }),
				Pr('frozenStatue', 700, 520, { w:56, h:120 }),
				Pr('iceLight', 560, 420, { r:190 }),
			],
			spawns:[],
		},

		{
			id:'ice_secret_arena', kind:'secretElite', category:'secret', section:[3,4],
			w:1500, h:900, secret:true, elite:true, label:'Secret Ice Arena', objective:'DEFEAT THE CHALLENGER',
			cells:[ C(0, 260, 1500, 640), C(240, 80, 1020, 180) ],
			solids:[ S(0, 760, 200, 140), S(1300, 760, 200, 140) ],
			ports:{ left:{ y:560, h:200 } },
			platforms:[
				P('static', 200, 760, 380),
				P('static', 680, 760, 400),
				P('static', 1140, 760, 200),
				P('static', 420, 560, 200),
				P('static', 900, 540, 220),
			],
			hazards:[ Slick(200, 740, 1100, 0.5), Fang(720, 260, 220, 0), Fang(1040, 260, 230, 90) ],
			props:[
				Pr('glacierWall', 0, 260, { w:200, h:500 }),
				Pr('glacierWall', 1300, 260, { w:200, h:500 }),
				Pr('crystalCluster', 620, 740, { w:110, h:150, n:5 }),
				Pr('frozenStatue', 300, 650, { w:56, h:120 }),
				Pr('frozenStatue', 1140, 650, { w:56, h:120 }),
				Pr('iceGlyphs', 560, 730, { w:400, scale:1 }),
				Pr('iceLight', 740, 560, { r:160 }),
			],
			spawns:[ Spawn(760, 750, 'glacierSentinel') ],
		},

		{
			id:'ice_secret_memory', kind:'secretMemory', category:'secret', section:[2,3,4],
			w:1200, h:760, noCombat:true, secret:true, label:'Frozen Memory', objective:'READ THE ICE',
			cells:[ C(0, 240, 1200, 520), C(200, 80, 800, 160) ],
			solids:[ S(0, 660, 180, 100), S(1020, 660, 180, 100) ],
			ports:{ left:{ y:480, h:180 } },
			platforms:[ P('static', 180, 660, 340), P('static', 620, 620, 400) ],
			hazards:[],
			interactables:[
				{ kind:'memory', x:560, y:540, w:80, h:80, rare:true, name:'Frozen Memory', icon:'\uD83D\uDC41' },
			],
			props:[
				/* A frozen battle, held mid-moment. */
				Pr('preservedBeast', 220, 540, { w:200, h:120 }),
				Pr('frozenStatue', 500, 540, { w:56, h:120 }),
				Pr('frozenStatue', 620, 540, { w:56, h:120 }),
				Pr('frozenStatue', 740, 545, { w:52, h:115 }),
				Pr('frozenBanner', 860, 420, { w:30, h:110 }),
				Pr('iceGlyphs', 400, 640, { w:400, scale:1 }),
				Pr('lightShaft', 540, 80, { w:220, h:560, alpha:0.2 }),
				Pr('frozenCamp', 940, 656, { w:110, h:50 }),
				Pr('iceLight', 600, 440, { r:170 }),
				Pr('mistBank', 300, 720, { w:700, h:60 }),
			],
			spawns:[],
		},

		/* ================= MINI-BOSS + BOSS APPROACH ================= */

		/* Frostbound Knight arena. Authored break sections and safe zones. */
		{
			id:'ice_knight_court', kind:'knight', category:'required', section:[4],
			w:2600, h:1300, label:'The Warrior\u2019s Court', objective:'DEFEAT THE FROSTBOUND KNIGHT',
			cells:[ C(0, 200, 2600, 1100), C(300, 60, 2000, 160) ],
			solids:[ S(0, 1060, 300, 240), S(2300, 1060, 300, 240) ],
			ports:{ left:{ y:860, h:200 }, right:{ y:860, h:200 } },
			platforms:[
				/* Entry aprons — never break. */
				P('static', 300, 1060, 200),
				P('static', 2100, 1060, 200),
				/* The court floor, in authored sections the Knight can shatter.
				   The centre ring is permanent so the fight always has ground. */
				P('static', 500, 1060, 260, { arenaSection:'outerL' }),
				P('static', 760, 1060, 260, { arenaSection:'midL' }),
				P('static', 1020, 1060, 560, { arenaSection:'core' }),
				P('static', 1580, 1060, 260, { arenaSection:'midR' }),
				P('static', 1840, 1060, 260, { arenaSection:'outerR' }),
				/* Raised corner daises: the Knight's safe zones in phase 3. */
				P('static', 600, 800, 220, { arenaSection:'daisL', safeZone:true }),
				P('static', 1180, 720, 240, { arenaSection:'daisC', safeZone:true }),
				P('static', 1780, 800, 220, { arenaSection:'daisR', safeZone:true }),
			],
			arena:{
				/* Authored shatter patterns. Every pattern leaves the core
				   plus at least one dais reachable. */
				sections:['outerL', 'midL', 'core', 'midR', 'outerR', 'daisL', 'daisC', 'daisR'],
				permanent:['core', 'daisC'],
				patterns:[
					{ id:'ring', breaks:['outerL', 'outerR'] },
					{ id:'left', breaks:['outerL', 'midL'] },
					{ id:'right', breaks:['outerR', 'midR'] },
					{ id:'flanks', breaks:['midL', 'midR'] },
					{ id:'daises', breaks:['daisL', 'daisR'] },
				],
				safeZones:['daisL', 'daisC', 'daisR', 'core'],
			},
			hazards:[
				Slick(300, 1040, 2000, 0.34),
				Water(300, 1180, 2000, 120),
				Fang(900, 220, 300, 0),
				Fang(1700, 220, 320, 150),
			],
			interactables:[
				{ kind:'banner', text:'THE ICE KEPT ITS WARRIOR', fired:false },
			],
			props:[
				Pr('ancientWallFace', 0, 200, { w:300, h:860 }),
				Pr('ancientWallFace', 2300, 200, { w:300, h:860 }),
				Pr('carvedPillar', 480, 300, { w:50, h:500 }),
				Pr('carvedPillar', 900, 260, { w:50, h:540 }),
				Pr('carvedPillar', 1650, 260, { w:50, h:540 }),
				Pr('carvedPillar', 2060, 300, { w:50, h:500 }),
				Pr('frozenStatue', 400, 940, { w:60, h:130 }),
				Pr('frozenStatue', 2160, 940, { w:60, h:130 }),
				Pr('iceGlyphs', 1020, 1030, { w:560, scale:1.2 }),
				Pr('iceBridgeDeck', 600, 792, { w:220, h:24 }),
				Pr('iceBridgeDeck', 1180, 712, { w:240, h:24 }),
				Pr('iceBridgeDeck', 1780, 792, { w:220, h:24 }),
				Pr('lightShaft', 1180, 60, { w:280, h:900, alpha:0.2 }),
				Pr('frozenBanner', 940, 300, { w:32, h:120 }),
				Pr('frozenBanner', 1660, 300, { w:32, h:120 }),
				Pr('frozenPool', 300, 1170, { w:2000, h:60 }),
				Pr('mistBank', 700, 1240, { w:1200, h:70 }),
				Pr('iceLight', 1300, 900, { r:200 }),
			],
			spawns:[ Spawn(1300, 1050, 'frostboundKnight') ],
		},

		/* Boss approach: a long ceremonial descent, no combat. */
		{
			id:'ice_preboss_gate', kind:'preboss', category:'required', section:[4],
			w:2200, h:1000, noCombat:true, label:'The Last Gate', objective:'ENTER THE COLOSSUS HALL',
			cells:[ C(0, 260, 2200, 740), C(300, 80, 1600, 180) ],
			solids:[ S(0, 860, 260, 140), S(1940, 860, 260, 140) ],
			ports:{ left:{ y:660, h:200 }, bottom:{ x:1000, w:240 } },
			platforms:[
				P('static', 260, 860, 400),
				P('static', 760, 860, 680),
				P('static', 1540, 860, 400),
				P('static', 520, 640, 220),
				P('static', 1440, 640, 220),
			],
			hazards:[ Slick(260, 840, 1680, 0.28) ],
			props:[
				Pr('ancientWallFace', 0, 260, { w:260, h:600 }),
				Pr('ancientWallFace', 1940, 260, { w:260, h:600 }),
				Pr('buriedDoor', 960, 480, { w:280, h:380 }),
				Pr('carvedPillar', 620, 320, { w:50, h:540 }),
				Pr('carvedPillar', 860, 320, { w:50, h:540 }),
				Pr('carvedPillar', 1300, 320, { w:50, h:540 }),
				Pr('carvedPillar', 1540, 320, { w:50, h:540 }),
				Pr('frozenStatue', 400, 740, { w:64, h:130 }),
				Pr('frozenStatue', 1700, 740, { w:64, h:130 }),
				Pr('iceGlyphs', 700, 830, { w:800, scale:1.3 }),
				Pr('lightShaft', 1000, 80, { w:260, h:800, alpha:0.22 }),
				Pr('deadBrazier', 700, 804, { w:44, h:60 }),
				Pr('deadBrazier', 1420, 804, { w:44, h:60 }),
				Pr('mistBank', 600, 950, { w:1000, h:60 }),
				Pr('iceLight', 1080, 700, { r:190 }),
			],
			spawns:[],
		},

		/* Kryonax basin. The arena amplifies him; it does not define him.
		   Central floor is continuous so the titan can walk. Shelves are
		   for the player. Authored ice reacts to attacks as spectacle. */
		{
			id:'ice_boss_hall', kind:'boss', category:'required', section:[4],
			w:4600, h:2100, noCombat:true, _kxBasin:true,
			label:'The Glacial Heart', objective:'DEFEAT KRYONAX',
			cells:[ C(0, 0, 4600, 2100) ],
			solids:[
				S(0, 0, 360, 420), S(4240, 0, 360, 420),
				S(0, 1880, 200, 220), S(4400, 1880, 200, 220),
			],
			ports:{ top:{ x:400, w:280 } },
			platforms:[
				P('static', 200, 1880, 4200, { central:true, arenaSection:'core' }),
			],
			hazards:[
				Slick(200, 1860, 4200, 0.28),
				Water(200, 1940, 4200, 160),
				Fang(1100, 80, 380, 0),
				Fang(2300, 80, 400, 140),
				Fang(3500, 80, 380, 80),
			],
			props:[
				Pr('glacierWall', 0, 200, { w:360, h:1680 }),
				Pr('glacierWall', 4240, 200, { w:360, h:1680 }),
				Pr('frozenWaterfall', 360, 80, { w:220, h:1800 }),
				Pr('frozenWaterfall', 4020, 80, { w:220, h:1800 }),
				Pr('crystalCluster', 640, 1760, { w:200, h:360, n:7, _kxReact:'fist' }),
				Pr('crystalCluster', 3760, 1760, { w:200, h:360, n:7, _kxReact:'fist' }),
				Pr('crystalCluster', 1680, 1800, { w:140, h:260, n:5, _kxReact:'tremor' }),
				Pr('crystalCluster', 2780, 1800, { w:140, h:260, n:5, _kxReact:'tremor' }),
				Pr('carvedPillar', 1080, 520, { w:64, h:900, _kxReact:'charge' }),
				Pr('carvedPillar', 3456, 520, { w:64, h:900, _kxReact:'charge' }),
				Pr('iceColumn', 300, 1560, { w:70, h:400, _kxReact:'tremor' }),
				Pr('iceColumn', 4230, 1560, { w:70, h:400, _kxReact:'tremor' }),
				Pr('buriedDoor', 2080, 40, { w:280, h:320 }),
				Pr('ancientWallFace', 1860, 80, { w:160, h:420 }),
				Pr('ancientWallFace', 2580, 80, { w:160, h:420 }),
				Pr('iceGlyphs', 1500, 1930, { w:1600, scale:1.6, _kxReact:'heart' }),
				Pr('frozenStatue', 480, 1820, { w:90, h:150, _kxReact:'roar' }),
				Pr('frozenStatue', 4030, 1820, { w:90, h:150, _kxReact:'roar' }),
				Pr('lightShaft', 400, 40, { w:3800, h:1860, alpha:0.42 }),
				Pr('frozenPool', 200, 2000, { w:4200, h:80 }),
				Pr('mistBank', 600, 2080, { w:1600, h:90 }),
				Pr('mistBank', 2400, 2080, { w:1600, h:90 }),
				Pr('iceLight', 2300, 900, { r:720 }),
				Pr('iceLight', 900, 1100, { r:560 }),
				Pr('iceLight', 3700, 1100, { r:560 }),
				Pr('iceLight', 1500, 1400, { r:480 }),
				Pr('iceLight', 3100, 1400, { r:480 }),
			],
			spawns:[ Spawn(2100, 1400, 'frostColossus') ],
		},

		/* ---------- SPECIAL MODULES ---------- */
		{
			id:'ice_observatory_a', kind:'frozenObservatory', category:'optional', section:[2,3],
			w:1800, h:980, label:'Frozen Observatory', objective:'ALIGN THE STAR PATH', optional:true,
			cells:[ C(0, 200, 1800, 780), C(400, 40, 1000, 180) ],
			solids:[ S(0, 860, 220, 120), S(1580, 860, 220, 120), S(820, 200, 160, 120) ],
			ports:{ left:{ y:680, h:200 }, right:{ y:680, h:200 }, top:{ x:780, w:240 } },
			platforms:[
				P('static', 80, 840, 280), P('static', 1440, 840, 280),
				P('static', 400, 640, 200), P('static', 1200, 640, 200),
				P('static', 780, 520, 240),
			],
			hazards:[ Mirror(820, 200, 160, 400, { false:true }) ],
			interactables:[
				{ kind:'obsMirror', x:180, y:760, w:50, h:70, name:'Mirror', ang:0, want:1, faces:4 },
				{ kind:'obsMirror', x:460, y:560, w:50, h:70, name:'Mirror', ang:2, want:0, faces:4 },
				{ kind:'obsMirror', x:860, y:440, w:50, h:70, name:'Mirror', ang:1, want:3, faces:4 },
				{ kind:'obsMirror', x:1280, y:560, w:50, h:70, name:'Mirror', ang:3, want:2, faces:4 },
				{ kind:'obsMirror', x:1560, y:760, w:50, h:70, name:'Mirror', ang:0, want:0, faces:4 },
				{ kind:'obsMirror', x:860, y:220, w:50, h:70, name:'False Reflection', _secret:true, ang:0, want:2, faces:4, _wrong:true },
				{ kind:'cache', x:860, y:780, w:80, h:70, name:'Astral Frost Cache', icon:'💎', _mainCache:true, _locked:true, _lootTier:'challenge' },
				{ kind:'cache', x:860, y:280, w:70, h:60, name:'Secret Astral Cache', icon:'💎', rare:true, _lockTag:'secret', _locked:true, _lootTier:'secret' },
			],
			props:[
				Pr('iceLight', 900, 120, { r:260 }),
				Pr('carvedPillar', 820, 240, { w:40, h:280 }),
				Pr('iceGlyphs', 700, 500, { w:400, glow:true }),
			],
			spawns:[
				{ x:200, y:760, type:'frostWraith', frozen:true, thaw:'ring1' },
				{ x:1500, y:760, type:'iceArcher', frozen:true, thaw:'ring1' },
				{ x:900, y:460, type:'cryoMage', frozen:true, thaw:'ring2' },
			],
		},
		{
			id:'ice_observatory_b', kind:'frozenObservatory', category:'optional', section:[2,3],
			w:1680, h:900, label:'Frozen Observatory', objective:'ALIGN THE STAR PATH', optional:true,
			cells:[ C(0, 160, 1680, 740) ],
			solids:[ S(0, 780, 180, 120), S(1500, 780, 180, 120) ],
			ports:{ left:{ y:620, h:200 }, right:{ y:280, h:180 } },
			platforms:[ P('static', 60, 760, 260), P('static', 600, 560, 240), P('static', 1100, 400, 240), P('static', 1360, 760, 260) ],
			interactables:[
				{ kind:'obsMirror', x:140, y:680, w:50, h:70, ang:1, want:0, faces:4 },
				{ kind:'obsMirror', x:680, y:480, w:50, h:70, ang:0, want:2, faces:4 },
				{ kind:'obsMirror', x:1180, y:320, w:50, h:70, ang:3, want:1, faces:4 },
				{ kind:'obsMirror', x:1480, y:680, w:50, h:70, ang:2, want:3, faces:4 },
				{ kind:'obsMirror', x:820, y:200, w:50, h:70, _secret:true, _wrong:true, ang:1, want:0, faces:4 },
				{ kind:'cache', x:700, y:700, w:80, h:70, name:'Astral Frost Cache', _mainCache:true, _locked:true, _lootTier:'challenge' },
				{ kind:'cache', x:820, y:260, w:70, h:60, name:'Secret Astral Cache', rare:true, _lockTag:'secret', _locked:true, _lootTier:'secret' },
			],
			spawns:[ { x:200, y:700, type:'snowBeast', frozen:true }, { x:1400, y:700, type:'glacierSentinel', frozen:true } ],
		},
		{
			id:'ice_frozen_lake_a', kind:'frozenLake', category:'optional', section:[2,3],
			w:2400, h:860, label:'Frozen Lake', objective:'CROSS THE ICE', optional:true, noCombat:true,
			cells:[ C(0, 200, 2400, 660) ],
			solids:[ S(0, 740, 280, 120), S(2120, 740, 280, 120) ],
			ports:{ left:{ y:560, h:200 }, right:{ y:560, h:200 } },
			platforms:[
				P('static', 40, 720, 280),
				Object.assign(P('static', 360, 720, 280), { _iceState:'thick' }),
				Object.assign(P('static', 680, 720, 260), { _iceState:'thin' }),
				Object.assign(P('static', 980, 720, 240), { _iceState:'veryThin' }),
				Object.assign(P('static', 1260, 720, 260), { _iceState:'thin' }),
				Object.assign(P('static', 1560, 720, 280), { _iceState:'thick' }),
				P('static', 2040, 720, 320),
				P('static', 900, 520, 200),
			],
			clearZone:{ x:2080, y:560, w:280, h:220 },
			interactables:[
				{ kind:'iceBreak', x:980, y:700, w:80, h:30, name:'Dark Water', lore:'Something waits beneath.', punch:{ x:0, y:0, w:1, h:1 } },
				{ kind:'cache', x:920, y:480, w:60, h:50, name:'Small Cache', _lootTier:'explore' },
				{ kind:'cache', x:1000, y:780, w:70, h:50, name:'Sunken Cache', rare:true, _lootTier:'challenge', _locked:true, _lockTag:'main' },
				{ kind:'cache', x:2100, y:640, w:80, h:70, name:'Ancient Cache', rare:true, _mainCache:true, _lootTier:'secret' },
			],
			props:[ Pr('iceLight', 1200, 300, { r:300 }), Pr('mistBank', 400, 600, { w:1600, h:80 }) ],
			spawns:[ { x:700, y:640, type:'iceArcher' }, { x:1500, y:640, type:'frostWraith' }, { x:1100, y:480, type:'cryoMage' } ],
		},
		{
			id:'ice_frozen_lake_b', kind:'frozenLake', category:'optional', section:[2,3],
			w:2200, h:820, label:'Frozen Lake', objective:'CROSS THE ICE', optional:true, noCombat:true,
			cells:[ C(0, 180, 2200, 640) ],
			solids:[ S(0, 700, 240, 120), S(1960, 700, 240, 120) ],
			ports:{ left:{ y:520, h:200 }, right:{ y:520, h:200 }, bottom:{ x:980, w:240 } },
			platforms:[
				P('static', 20, 680, 260),
				Object.assign(P('static', 400, 680, 400), { _iceState:'thick' }),
				Object.assign(P('static', 900, 680, 280), { _iceState:'veryThin' }),
				Object.assign(P('static', 1280, 680, 360), { _iceState:'thin' }),
				P('static', 1880, 680, 280),
			],
			clearZone:{ x:1900, y:520, w:260, h:200 },
			interactables:[
				{ kind:'cache', x:1940, y:600, w:70, h:60, name:'Ancient Cache', _mainCache:true, _lootTier:'challenge' },
				{ kind:'cache', x:960, y:640, w:60, h:50, name:'Sunken Cache', rare:true, _lootTier:'secret' },
			],
			spawns:[ { x:500, y:600, type:'snowBeast' }, { x:1400, y:600, type:'frostWraith' } ],
		},
		{
			id:'ice_shatter_maze_a', kind:'shatterMaze', category:'optional', section:[2,3],
			w:2000, h:1000, label:'Shatter Maze', objective:'REACH THE VAULT', optional:true,
			cells:[ C(0, 160, 2000, 840) ],
			solids:[
				S(360, 200, 60, 520), S(720, 360, 60, 520), S(1080, 200, 60, 520),
				S(1440, 360, 60, 400), S(0, 860, 200, 140), S(1800, 860, 200, 140),
			],
			ports:{ left:{ y:680, h:200 }, right:{ y:680, h:200 } },
			platforms:[ P('static', 40, 840, 240), P('static', 420, 700, 220), P('static', 820, 560, 220), P('static', 1180, 700, 220), P('static', 1680, 840, 280) ],
			interactables:[
				{ kind:'iceBreak', x:360, y:700, w:60, h:80, name:'Brittle Wall', lore:'A passage hides in the reflection.' },
				{ kind:'iceBreak', x:1080, y:700, w:60, h:80, name:'Brittle Wall' },
				{ kind:'iceBreak', x:1440, y:520, w:60, h:80, name:'Hidden Reflection', lore:'The ice shows a hall that is not there.' },
				{ kind:'cache', x:920, y:480, w:80, h:70, name:'Shattered Vault', _mainCache:true, _lootTier:'challenge' },
				{ kind:'cache', x:1500, y:480, w:70, h:60, name:'Reflection Cache', rare:true, _lootTier:'secret' },
			],
			spawns:[
				{ x:480, y:640, type:'iceArcher' }, { x:900, y:500, type:'frostWraith' },
				{ x:1240, y:640, type:'cryoMage' }, { x:920, y:440, type:'glacierSentinel' },
			],
		},
		{
			id:'ice_shatter_maze_b', kind:'shatterMaze', category:'optional', section:[3],
			w:1880, h:920, label:'Shatter Maze', objective:'REACH THE VAULT', optional:true,
			cells:[ C(0, 140, 1880, 780) ],
			solids:[ S(480, 180, 50, 480), S(960, 320, 50, 480), S(0, 780, 180, 140), S(1700, 780, 180, 140) ],
			ports:{ left:{ y:600, h:200 }, top:{ x:800, w:240 } },
			platforms:[ P('static', 40, 760, 240), P('static', 560, 620, 240), P('static', 1040, 480, 240), P('static', 1480, 760, 280) ],
			interactables:[
				{ kind:'iceBreak', x:480, y:640, w:50, h:80, name:'Brittle Wall' },
				{ kind:'iceBreak', x:960, y:500, w:50, h:80, name:'Brittle Wall' },
				{ kind:'cache', x:1100, y:420, w:80, h:70, name:'Shattered Vault', _mainCache:true, _lootTier:'challenge' },
			],
			spawns:[ { x:200, y:700, type:'iceArcher' }, { x:700, y:560, type:'cryoMage' }, { x:1200, y:420, type:'glacierSentinel' } ],
		},
	];

	/* Rarity weights straight from the design brief so the generator
	   cannot quietly over-serve rare rooms. */
	const ICE_FREQUENCY = {
		common:   ['ice_cavern_basin', 'ice_cavern_squeeze', 'ice_lake_crossing', 'ice_river_run', 'ice_glide_hollow', 'ice_crystal_wood'],
		uncommon: ['ice_waterfall_ascent', 'ice_crevasse_descent', 'ice_mechanism_vault', 'ice_mirror_gallery', 'ice_squall_hollow', 'ice_great_bridge', 'ice_slide_chute', 'ice_shatter_arena', 'ice_temple_hall'],
		rare:     ['ice_shrine_still', 'ice_vault_cache', 'ice_prison_cell', 'ice_trial_court', 'ice_warming_hearth', 'ice_elite_terrace', 'ice_flood_stair', 'ice_collapse_run'],
		veryRare: ['ice_secret_shrine', 'ice_secret_arena', 'ice_secret_memory', 'ice_secret_cave'],
	};

	global.ICE_ROOM_TEMPLATES = ICE_ROOM_TEMPLATES;
	global.ICE_FREQUENCY = ICE_FREQUENCY;
	global.ICE_TEMPLATES_BY_KIND = (function(){
		const map = Object.create(null);
		for(const t of ICE_ROOM_TEMPLATES){
			(map[t.kind] = map[t.kind] || []).push(t);
		}
		return map;
	})();
})(typeof window !== 'undefined' ? window : globalThis);
