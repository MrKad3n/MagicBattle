/* =============================================================
   Glacial Reach — tile / sprite assembly.
   Walls and floors from ice-tileset.png (8x6, 40px), fire/jungle style.
   Props from ice-props-sheet.png, ice-crystal-sheet.png, ice-light-sheet.png,
   and ice-ruin-sheet.png (4x4, 80px), punched transparent, no backdrop.
   ============================================================= */
(function(global){
	const T = 40;
	const DRAW = 2;
	const DT = T * DRAW;
	const PROP = 80;
	const PROP_SCALE = 2.4;
	const VER = '6';

	const CELLS = {
		wallPackedA:[0,0], wallPackedB:[1,0], wallCrackA:[2,0], wallCrackB:[3,0],
		wallSnowA:[4,0], wallSnowB:[5,0], wallDeepA:[6,0], wallDeepB:[7,0],
		floorSnowA:[0,1], floorSnowB:[1,1], floorIceA:[2,1], floorIceB:[3,1],
		floorStoneA:[4,1], floorStoneB:[5,1], floorThin:[6,1], floorCrack:[7,1],
		ceilA:[0,2], ceilB:[1,2], wallL:[2,2], wallR:[3,2],
		rampL:[4,2], rampR:[5,2], rampM:[6,2], floorEdge:[7,2],
		beamL:[0,3], beamM:[1,3], beamR:[2,3], beamT:[3,3],
		pilTop:[4,3], pilMid:[5,3], pilBase:[6,3], iceHang:[7,3],
		wallPackedC:[0,4], wallCrackC:[1,4], wallSnowC:[2,4], wallDeepC:[3,4],
		floorSnowC:[4,4], floorIceC:[5,4], transSI:[6,4], transID:[7,4],
		wallRime:[0,5], wallVein:[1,5], floorRime:[2,5], floorPebble:[3,5],
		ceilC:[4,5], ceilIcicle:[5,5], rampL2:[6,5], rampR2:[7,5],
	};
	const WALL_BAG = {
		packed: ['wallPackedA', 'wallPackedB', 'wallPackedC', 'wallRime'],
		crack:  ['wallCrackA', 'wallCrackB', 'wallCrackC', 'wallVein'],
		snow:   ['wallSnowA', 'wallSnowB', 'wallSnowC', 'wallRime'],
		deep:   ['wallDeepA', 'wallDeepB', 'wallDeepC', 'wallVein'],
	};
	const FLOOR_BAG = {
		packed: ['floorIceA', 'floorIceB', 'floorIceC', 'floorPebble'],
		crack:  ['floorCrack', 'floorThin', 'floorIceB', 'transID'],
		snow:   ['floorSnowA', 'floorSnowB', 'floorSnowC', 'floorRime'],
		deep:   ['floorStoneA', 'floorStoneB', 'floorPebble', 'transSI'],
	};
	const CEIL_BAG = ['ceilA', 'ceilB', 'ceilC', 'ceilIcicle'];

	const PROP_CELLS = {
		column:[0,0,'props'], altar:[1,0,'props'], gate:[2,0,'props'], icicle:[3,0,'props'],
		mirror:[0,1,'props'], statue:[1,1,'props'], crystal:[2,1,'props'], rings:[3,1,'props'],
		barrier:[0,2,'props'], door:[1,2,'props'], lantern:[2,2,'props'], mound:[3,2,'props'],
		fence:[0,3,'props'], crack:[1,3,'props'], banner:[2,3,'props'], cache:[3,3,'props'],

		shard:[0,0,'crystal'], clusterB:[1,0,'crystal'], spike:[2,0,'crystal'], geode:[3,0,'crystal'],
		crystalPillar:[0,1,'crystal'], orb:[1,1,'crystal'], crystalShelf:[2,1,'crystal'], ruinCrystal:[3,1,'crystal'],
		needle:[0,2,'crystal'], trio:[2,2,'crystal'], sprout:[3,2,'crystal'],
		core:[0,3,'crystal'], crystalColumn:[2,3,'crystal'], heart:[3,3,'crystal'],

		hangLantern:[0,0,'light'], bowlLamp:[1,0,'light'], iceShaft:[2,0,'light'], iceTorch:[3,0,'light'],
		glowBowl:[0,1,'light'], frostLamp:[1,1,'light'], hangGlow:[2,1,'light'], rimeLantern:[3,1,'light'],
		iceBrazier:[0,2,'light'], glowMound:[1,2,'light'], tallLamp:[2,2,'light'], crystalLamp:[3,2,'light'],
		wellLamp:[0,3,'light'], frostBowl:[1,3,'light'], canopyIce:[2,3,'light'], spireLamp:[3,3,'light'],

		ruinWall:[0,0,'ruin'], ruinShrine:[1,0,'ruin'], ruinRubble:[2,0,'ruin'], ruinPillar:[3,0,'ruin'],
		ruinArch:[0,1,'ruin'], ruinWell:[1,1,'ruin'], ruinHang:[2,1,'ruin'], ruinIce:[3,1,'ruin'],
		ruinCol:[0,2,'ruin'], ruinDoor:[1,2,'ruin'], ruinBust:[2,2,'ruin'], ruinAltar:[3,2,'ruin'],
		ruinColonnade:[0,3,'ruin'], ruinVault:[3,3,'ruin'],
	};
	const DECOR_PROP = {
		iceColumn:{ name:'column', scale:PROP_SCALE },
		carvedPillar:{ name:'column', scale:PROP_SCALE },
		frozenAltar:{ name:'altar', scale:PROP_SCALE },
		frozenCamp:{ name:'altar', scale:PROP_SCALE },
		buriedDoor:{ name:'gate', scale:PROP_SCALE },
		iceArch:{ name:'ruinArch', scale:PROP_SCALE },
		ancientWallFace:{ name:'ruinWall', scale:PROP_SCALE },
		iceGlyphs:{ name:'ruinAltar', scale:PROP_SCALE },
		icicleCluster:{ name:'icicle', scale:PROP_SCALE, hang:true },
		mirrorPlane:{ name:'mirror', scale:PROP_SCALE },
		frozenStatue:{ name:'statue', scale:PROP_SCALE },
		preservedBeast:{ name:'ruinBust', scale:PROP_SCALE },
		crystalCluster:{ name:'clusterB', scale:PROP_SCALE },
		ancientMechanism:{ name:'rings', scale:PROP_SCALE },
		prisonBlock:{ name:'barrier', scale:PROP_SCALE },
		iceLantern:{ name:'lantern', scale:PROP_SCALE },
		snowDrift:{ name:'mound', scale:PROP_SCALE },
		iceRidge:{ name:'mound', scale:PROP_SCALE },
		iceFence:{ name:'fence', scale:PROP_SCALE },
		crackedPlateHint:{ name:'crack', scale:DRAW },
		crackedPlate:{ name:'crack', scale:DRAW },
		frozenBanner:{ name:'banner', scale:PROP_SCALE },
		iceCacheProp:{ name:'cache', scale:PROP_SCALE },
		warmHearth:{ name:'bowlLamp', scale:PROP_SCALE },
		iceIdol:{ name:'ruinShrine', scale:PROP_SCALE },
		buriedRuin:{ name:'ruinWall', scale:PROP_SCALE },
		iceDoor:{ name:'ruinDoor', scale:PROP_SCALE },
		runeTablet:{ name:'ruinAltar', scale:PROP_SCALE },
	};

	function img(src){
		const el = new Image();
		el.src = src + '?v=' + VER;
		return el;
	}
	const sheet = img('images/dungeon/ice-tileset.png');
	const sheets = {
		props: img('images/dungeon/ice-props-sheet.png'),
		crystal: img('images/dungeon/ice-crystal-sheet.png'),
		light: img('images/dungeon/ice-light-sheet.png'),
		ruin: img('images/dungeon/ice-ruin-sheet.png'),
	};
	const props = sheets.props;

	let _atlas = null;
	const CHUNK = 320, CHUNK_PAD = 40;
	const _chunks = new Map();
	const _platCache = new Map();
	let _hintRm = null;
	const _punched = {};

	function D(){
		return (typeof dungeon !== 'undefined' && dungeon && dungeon._theme === 'ice') ? dungeon : null;
	}
	function cam(){ return (typeof camera !== 'undefined') ? camera : { x:0, y:0 }; }
	function h2(x, y, salt){
		let n = Math.imul((x + 0x9e3779b9) | 0, 0x85ebca6b) ^ Math.imul((y + 0x165667b1) | 0, 0xc2b2ae35) ^ Math.imul(salt | 0, 0x27d4eb2f);
		n = Math.imul(n ^ (n >>> 15), 0x85ebca6b);
		n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35);
		return (n ^ (n >>> 16)) >>> 0;
	}
	function fade(t){ return t * t * (3 - 2 * t); }
	function valueNoise(c, r, cell, salt){
		const x = c / cell, y = r / cell;
		const x0 = Math.floor(x), y0 = Math.floor(y);
		const fx = fade(x - x0), fy = fade(y - y0);
		const n00 = (h2(x0, y0, salt) & 0xffff) / 65535;
		const n10 = (h2(x0 + 1, y0, salt) & 0xffff) / 65535;
		const n01 = (h2(x0, y0 + 1, salt) & 0xffff) / 65535;
		const n11 = (h2(x0 + 1, y0 + 1, salt) & 0xffff) / 65535;
		return n00 + (n10 - n00) * fx + (n01 - n00) * fy + (n00 - n10 - n01 + n11) * fx * fy;
	}
	function roomSalt(room){
		if(!room) return 11;
		return (room.id * 29 + (room.section || 1) * 19 + (room.kind ? room.kind.length * 11 : 0)) | 0;
	}
	function field(c, r, room, cell, saltAdd){
		const s = roomSalt(room) + (saltAdd || 0);
		const coarse = cell || 7;
		return Math.max(0, Math.min(1,
			valueNoise(c, r, coarse, s) * 0.60 +
			valueNoise(c + 7, r - 3, coarse * 1.6, s + 71) * 0.28 +
			valueNoise(c, r, 3.1, s + 5) * 0.12
		));
	}
	function vis(x, y, w, h, pad){
		pad = pad || 80;
		const c = cam();
		return x - c.x + w > -pad && x - c.x < canvas.width + pad && y - c.y + h > -pad && y - c.y < canvas.height + pad;
	}
	function neighborSolid(c, r){
		if(typeof tileMap === 'undefined') return true;
		if(r < 0 || c < 0 || r >= tileMap.length || !tileMap[r] || c >= tileMap[r].length) return true;
		return tileMap[r][c] === 0;
	}
	function roomAt(c, r){
		const d = D();
		if(!d || !d.rooms) return null;
		const x = c * T + T / 2, y = r * T + T / 2;
		if(_hintRm && x >= _hintRm.x && x < _hintRm.x + _hintRm.w && y >= _hintRm.y && y < _hintRm.y + _hintRm.h) return _hintRm;
		for(let i = 0; i < d.rooms.length; i++){
			const rm = d.rooms[i];
			if(x >= rm.x && x < rm.x + rm.w && y >= rm.y && y < rm.y + rm.h){ _hintRm = rm; return rm; }
		}
		return null;
	}
	function kindFamily(kind, section){
		const snow = { start:1, shrine:1, cache:1, warming:1, secretCave:1, secretMemory:1 };
		const deep = { crevasse:1, descent:1, heart:1, boss:1, knight:1, preboss:1 };
		const crack = { shatter:1, shatterMaze:1, collapseEvent:1, trial:1, lake:1, frozenLake:1 };
		if(snow[kind]) return 'snow';
		if(deep[kind] || (section || 1) >= 4) return 'deep';
		if(crack[kind] || (section || 1) >= 3) return 'crack';
		if((section || 1) <= 1) return 'snow';
		return 'packed';
	}
	function wallFamily(c, r, room){
		const base = kindFamily(room && room.kind, room && room.section);
		const mix = field(c, r, room, 3.4, 0);
		if(base === 'snow') return mix > 0.62 ? 'packed' : 'snow';
		if(base === 'packed') return mix > 0.72 ? 'crack' : (mix > 0.28 ? 'packed' : 'snow');
		if(base === 'crack') return mix > 0.55 ? 'crack' : 'packed';
		return mix > 0.45 ? 'deep' : 'packed';
	}
	function floorFamily(c, r, room){
		const base = kindFamily(room && room.kind, room && room.section);
		const mix = field(c, r, room, 3.1, 13);
		if(base === 'snow') return mix > 0.58 ? 'packed' : 'snow';
		if(base === 'crack') return mix > 0.5 ? 'crack' : 'packed';
		if(base === 'deep') return mix > 0.4 ? 'deep' : 'packed';
		return mix > 0.66 ? 'snow' : 'packed';
	}
	function bagPick(bag, c, r, salt){
		if(!bag || !bag.length) return 'wallPackedA';
		return bag[h2(c, r, salt) % bag.length];
	}

	function put(g, col, row, paint){
		const x = col * T, y = row * T;
		const imgd = g.getImageData(x, y, T, T);
		const d = imgd.data;
		for(let yy = 0; yy < T; yy++){
			for(let xx = 0; xx < T; xx++){
				const c = paint(xx, yy);
				const i = (yy * T + xx) * 4;
				d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = c[3] == null ? 255 : c[3];
			}
		}
		g.putImageData(imgd, x, y);
	}
	function mix(a, b, t){
		return [(a[0] + (b[0] - a[0]) * t) | 0, (a[1] + (b[1] - a[1]) * t) | 0, (a[2] + (b[2] - a[2]) * t) | 0, 255];
	}
	const ICE_PAL = {
		packed:{ mortar:[52,74,94], a:[96,128,152], b:[118,150,174], c:[84,114,138], hi:[148,176,196] },
		crack:{ mortar:[48,70,90], a:[110,142,166], b:[132,164,186], c:[90,122,146], hi:[168,196,214], crack:[196,220,232] },
		snow:{ mortar:[72,96,116], a:[140,168,188], b:[158,184,202], c:[122,150,172], hi:[178,200,214] },
		deep:{ mortar:[28,44,62], a:[46,72,96], b:[58,86,112], c:[38,60,82], hi:[78,108,132] },
	};
	function brickCol(pal, row, col, seed){
		const n = h2(row, col, seed) & 3;
		if(n === 0) return pal.a;
		if(n === 1) return pal.b;
		if(n === 2) return pal.c;
		return [(pal.a[0] + pal.b[0]) >> 1, (pal.a[1] + pal.b[1]) >> 1, (pal.a[2] + pal.b[2]) >> 1];
	}
	function rgba(c){ return [c[0], c[1], c[2], 255]; }
	function paintWall(kind, col, row, seed){
		const pal = ICE_PAL[kind] || ICE_PAL.packed;
		return function(x, y){
			if(y % 10 === 0) return rgba(pal.mortar);
			const brow = (y / 10) | 0;
			const odd = brow & 1;
			const bx = odd ? ((x + 10) / 20) | 0 : (x / 20) | 0;
			if((odd && (x + 10) % 20 === 0) || (!odd && x % 20 === 0)) return rgba(pal.mortar);
			const colr = brickCol(pal, brow, bx + seed, seed);
			const ly = y % 10;
			if(ly === 2) return rgba(pal.hi);
			if(ly === 9) return mix(colr, pal.mortar, 0.35);
			if(kind === 'crack' && x === 12 + ((y / 8) | 0)) return rgba(pal.crack || pal.hi);
			return rgba(colr);
		};
	}
	function paintFloor(kind, col, row, seed){
		const pal = ICE_PAL[kind] || ICE_PAL.packed;
		const base = kind === 'snow' ? pal.b : pal.a;
		return function(x, y){
			if(y >= 38) return mix(base, pal.mortar, 0.25);
			if(seed & 1){
				if(x === 19) return rgba(pal.mortar);
			} else if(y === 19) return rgba(pal.mortar);
			if(kind === 'crack' && x === 8 + ((y / 2) | 0)) return rgba(pal.crack || pal.hi);
			return rgba(base);
		};
	}
	function paintCeil(col, row, seed, ice){
		const pal = ICE_PAL.deep;
		return function(x, y){
			if(ice && y > 22){
				const drips = [8, 20, 32];
				for(let i = 0; i < drips.length; i++){
					const cx = drips[i];
					const h = 16 + (i * 3) % 11;
					const dy = y - 22;
					if(dy >= 0 && dy < h && Math.abs(x - cx) <= Math.max(0, 2 - (dy / 4) | 0)) return [112, 160, 186, 255];
				}
			}
			if(y < 12) return rgba(pal.c);
			return rgba(pal.a);
		};
	}
	function paintRamp(dir, col, row, seed){
		return function(x, y){
			const t = dir === 'L' ? (T - 1 - x) / (T - 1) : dir === 'R' ? x / (T - 1) : 0.5;
			const cut = ((1 - t) * (T - 6)) + 3;
			if(y < cut) return [0, 0, 0, 0];
			const pal = ICE_PAL.packed;
			if(y === (cut | 0)) return rgba(pal.hi);
			return ((((x / 10) | 0) + ((y / 10) | 0) + seed) & 1) ? rgba(pal.a) : rgba(pal.b);
		};
	}
	function paintSide(dir){
		const inner = paintWall('packed', 0, 0, dir === 'L' ? 11 : 17);
		return function(x, y){
			if(dir === 'L' && x < 3) return rgba(ICE_PAL.packed.hi);
			if(dir === 'R' && x > 36) return rgba(ICE_PAL.packed.hi);
			return inner(x, y);
		};
	}
	function paintBeam(part, col, row, seed){
		const inner = paintWall(part === 'T' ? 'packed' : 'snow', col, row, seed);
		return function(x, y){
			if(part === 'T' && (x < 6 || x > 33)) return [0, 0, 0, 0];
			if(part === 'L' && x < 4) return rgba(ICE_PAL.snow.hi);
			if(part === 'R' && x > 35) return rgba(ICE_PAL.snow.hi);
			return inner(x, y);
		};
	}

	function ensureAtlas(){
		if(_atlas || typeof document === 'undefined') return _atlas;
		const el = document.createElement('canvas');
		el.width = 8 * T;
		el.height = 6 * T;
		const g = el.getContext('2d');
		g.imageSmoothingEnabled = false;
		if(sheet.complete && sheet.naturalWidth > 64){
			g.drawImage(sheet, 0, 0, sheet.naturalWidth, sheet.naturalHeight, 0, 0, el.width, el.height);
		} else {
			put(g, 0, 0, paintWall('packed', 0, 0, 1));
			put(g, 1, 0, paintWall('packed', 1, 0, 2));
			put(g, 2, 0, paintWall('crack', 2, 0, 3));
			put(g, 3, 0, paintWall('crack', 3, 0, 4));
			put(g, 4, 0, paintWall('snow', 4, 0, 5));
			put(g, 5, 0, paintWall('snow', 5, 0, 6));
			put(g, 6, 0, paintWall('deep', 6, 0, 7));
			put(g, 7, 0, paintWall('deep', 7, 0, 8));
			put(g, 0, 1, paintFloor('snow', 0, 1, 11));
			put(g, 1, 1, paintFloor('snow', 1, 1, 12));
			put(g, 2, 1, paintFloor('packed', 2, 1, 13));
			put(g, 3, 1, paintFloor('packed', 3, 1, 14));
			put(g, 4, 1, paintFloor('deep', 4, 1, 15));
			put(g, 5, 1, paintFloor('deep', 5, 1, 16));
			put(g, 6, 1, paintFloor('crack', 6, 1, 17));
			put(g, 7, 1, paintFloor('crack', 7, 1, 18));
			put(g, 0, 2, paintCeil(0, 2, 21, false));
			put(g, 1, 2, paintCeil(1, 2, 22, false));
			put(g, 2, 2, paintSide('L'));
			put(g, 3, 2, paintSide('R'));
			put(g, 4, 2, paintRamp('L', 4, 2, 31));
			put(g, 5, 2, paintRamp('R', 5, 2, 32));
			put(g, 6, 2, paintRamp('M', 6, 2, 33));
			put(g, 7, 2, paintFloor('snow', 7, 2, 19));
			put(g, 0, 3, paintBeam('L', 0, 3, 41));
			put(g, 1, 3, paintBeam('M', 1, 3, 42));
			put(g, 2, 3, paintBeam('R', 2, 3, 43));
			put(g, 3, 3, paintBeam('T', 3, 3, 44));
			put(g, 4, 3, paintWall('packed', 4, 3, 45));
			put(g, 5, 3, paintWall('packed', 5, 3, 46));
			put(g, 6, 3, paintWall('deep', 6, 3, 47));
			put(g, 7, 3, paintCeil(7, 3, 23, true));
			put(g, 0, 4, paintWall('packed', 0, 4, 51));
			put(g, 1, 4, paintWall('crack', 1, 4, 52));
			put(g, 2, 4, paintWall('snow', 2, 4, 53));
			put(g, 3, 4, paintWall('deep', 3, 4, 54));
			put(g, 4, 4, paintFloor('snow', 4, 4, 55));
			put(g, 5, 4, paintFloor('packed', 5, 4, 56));
			put(g, 6, 4, paintFloor('snow', 6, 4, 57));
			put(g, 7, 4, paintFloor('deep', 7, 4, 58));
			put(g, 0, 5, paintWall('snow', 0, 5, 61));
			put(g, 1, 5, paintWall('crack', 1, 5, 62));
			put(g, 2, 5, paintFloor('snow', 2, 5, 63));
			put(g, 3, 5, paintFloor('deep', 3, 5, 64));
			put(g, 4, 5, paintCeil(4, 5, 24, false));
			put(g, 5, 5, paintCeil(5, 5, 25, true));
			put(g, 6, 5, paintRamp('L', 6, 5, 65));
			put(g, 7, 5, paintRamp('R', 7, 5, 66));
		}
		_atlas = el;
		return _atlas;
	}

	function blitCell(ctx, name, dx, dy, scale, flipX){
		ensureAtlas();
		const cell = CELLS[name];
		if(!cell || !_atlas) return false;
		scale = scale || DRAW;
		const dw = T * scale, dh = T * scale;
		ctx.imageSmoothingEnabled = false;
		if(flipX){
			ctx.save();
			ctx.translate(dx + dw, dy);
			ctx.scale(-1, 1);
			ctx.drawImage(_atlas, cell[0] * T, cell[1] * T, T, T, 0, 0, dw, dh);
			ctx.restore();
		} else {
			ctx.drawImage(_atlas, cell[0] * T, cell[1] * T, T, T, dx, dy, dw, dh);
		}
		return true;
	}

	function pickFloor(c, r, edges, room){
		if(edges && edges.airTop && edges.airBot) return null;
		if(!(edges && edges.airTop)) return null;
		return bagPick(FLOOR_BAG[floorFamily(c, r, room)], c, r, 81);
	}
	function pickWall(c, r, edges, room){
		if(edges && edges.airBot && !edges.airTop) return bagPick(CEIL_BAG, c, r, 90);
		if(edges && edges.airLeft && !edges.airRight) return 'wallL';
		if(edges && edges.airRight && !edges.airLeft) return 'wallR';
		return bagPick(WALL_BAG[wallFamily(c, r, room)], c, r, 73);
	}
	function pickBeam(c, r, edges){
		if(!(edges && edges.airTop && edges.airBot)) return null;
		const leftAir = !neighborSolid(c - 1, r);
		const rightAir = !neighborSolid(c + 1, r);
		if(leftAir && rightAir) return 'beamT';
		if(leftAir) return 'beamL';
		if(rightAir) return 'beamR';
		return 'beamM';
	}

	function drawSolidTile(ctx, c, r, sx, sy, edges){
		ensureAtlas();
		const room = roomAt(c, r);
		const beam = pickBeam(c, r, edges);
		if(beam){ blitCell(ctx, beam, sx, sy - 8, DRAW); return true; }
		const fl = pickFloor(c, r, edges, room);
		if(fl){ blitCell(ctx, fl, sx, sy, DRAW); return true; }
		blitCell(ctx, pickWall(c, r, edges, room), sx, sy, DRAW);
		return true;
	}

	function chunkCanvas(cx, cy){
		const key = cx + ',' + cy;
		let ch = _chunks.get(key);
		if(ch) return ch;
		if(typeof document === 'undefined' || typeof tileMap === 'undefined') return null;
		const el = document.createElement('canvas');
		el.width = CHUNK + CHUNK_PAD * 2;
		el.height = CHUNK + CHUNK_PAD * 2;
		const g = el.getContext('2d');
		g.imageSmoothingEnabled = false;
		const wx = cx * CHUNK, wy = cy * CHUNK;
		const cols = tileMap[0] ? tileMap[0].length : 0;
		const c0 = Math.max(0, Math.floor((wx - CHUNK_PAD) / T));
		const r0 = Math.max(0, Math.floor((wy - CHUNK_PAD) / T));
		const c1 = Math.min(cols - 1, Math.ceil((wx + CHUNK + CHUNK_PAD) / T));
		const r1 = Math.min(tileMap.length - 1, Math.ceil((wy + CHUNK + CHUNK_PAD) / T));
		const edges = (typeof tileEdges !== 'undefined') ? tileEdges : null;
		for(let r = r0; r <= r1; r++){
			if(!tileMap[r]) continue;
			for(let ccol = c0; ccol <= c1; ccol++){
				if(tileMap[r][ccol] !== 0) continue;
				drawSolidTile(g, ccol, r, ccol * T - wx + CHUNK_PAD, r * T - wy + CHUNK_PAD, edges && edges[r] && edges[r][ccol]);
			}
		}
		_chunks.set(key, el);
		return el;
	}
	function drawTiles(ctx){
		if(!D() || typeof tileMap === 'undefined' || !tileMap.length) return false;
		ensureAtlas();
		if(!_atlas) return false;
		const c = cam();
		const vx = Math.round(c.x), vy = Math.round(c.y);
		const pad = 40;
		const x0 = Math.floor((vx - pad) / CHUNK);
		const y0 = Math.floor((vy - pad) / CHUNK);
		const x1 = Math.floor((vx + canvas.width + pad) / CHUNK);
		const y1 = Math.floor((vy + canvas.height + pad) / CHUNK);
		ctx.imageSmoothingEnabled = false;
		for(let cy = y0; cy <= y1; cy++){
			for(let cx = x0; cx <= x1; cx++){
				const el = chunkCanvas(cx, cy);
				if(el) ctx.drawImage(el, cx * CHUNK - vx - CHUNK_PAD, cy * CHUNK - vy - CHUNK_PAD);
			}
		}
		return true;
	}
	function drawBackdrop(ctx){
		const d = D();
		if(!d) return false;
		const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
		g.addColorStop(0, '#06101c');
		g.addColorStop(0.45, d.bgColor || '#04101c');
		g.addColorStop(1, '#030810');
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		return true;
	}
	function assembleBeam(ctx, x, y, w){
		const n = Math.max(1, Math.ceil(w / DT));
		for(let i = 0; i < n; i++){
			let name = 'beamM';
			if(i === 0 && n > 1) name = 'beamL';
			else if(i === n - 1 && n > 1) name = 'beamR';
			blitCell(ctx, name, x + i * DT, y, DRAW);
		}
	}
	function drawPlatform(ctx, p){
		if(!p || p._gone) return false;
		if(!vis(p.x, p.y, p.w, p.h || T, 40)) return true;
		ensureAtlas();
		const c = cam();
		assembleBeam(ctx, p.x - c.x, p.y - c.y - 8, p.w);
		return true;
	}
	function drawLivePlatforms(ctx){
		const d = D();
		if(!d || !d.platforms) return;
		for(let i = 0; i < d.platforms.length; i++){
			const p = d.platforms[i];
			if(!p || p._gone) continue;
			if(p.kind === 'move' || p.kind === 'raft' || p.kind === 'orbit' || p.kind === 'thinIce' || p.kind === 'shelf'){
				drawPlatform(ctx, p);
			}
		}
	}
	function invalidateTiles(){ _chunks.clear(); _platCache.clear(); _hintRm = null; if(!sheet.complete) _atlas = null; }

	function punchSheet(key){
		if(_punched[key]) return _punched[key];
		const im = sheets[key] || sheets.props;
		if(!im || !im.complete || im.naturalWidth < 8 || typeof document === 'undefined') return null;
		const el = document.createElement('canvas');
		el.width = 320;
		el.height = 320;
		const g = el.getContext('2d');
		g.imageSmoothingEnabled = true;
		g.drawImage(im, 0, 0, im.naturalWidth, im.naturalHeight, 0, 0, 320, 320);
		try{
			const id = g.getImageData(0, 0, el.width, el.height);
			const d = id.data;
			for(let i = 0; i < d.length; i += 4){
				if(d[i] < 18 && d[i + 1] < 18 && d[i + 2] < 22) d[i + 3] = 0;
			}
			g.putImageData(id, 0, 0);
		}catch(e){}
		_punched[key] = el;
		return el;
	}
	function blitProp(ctx, name, dx, dy, scale){
		const cell = PROP_CELLS[name];
		if(!cell) return false;
		const key = cell[2] || 'props';
		const im = punchSheet(key);
		if(!im) return false;
		const src = im.width / 4;
		const dest = PROP * (scale || PROP_SCALE);
		ctx.imageSmoothingEnabled = false;
		ctx.drawImage(im, cell[0] * src, cell[1] * src, src, src, dx, dy, dest, dest);
		return true;
	}
	function drawDecor(ctx, dec){
		if(!D() || !dec) return false;
		const spec = DECOR_PROP[dec.type];
		if(!spec || !spec.name) return false;
		const c = cam();
		const dest = PROP * (spec.scale || PROP_SCALE);
		const hang = spec.hang || dec.hang;
		const sx = dec.x - c.x;
		const top = (dec.y || 0);
		const foot = top + (dec.h || 0);
		const sy = hang ? (top - c.y) : (foot - dest - c.y);
		return blitProp(ctx, spec.name, sx, sy, spec.scale);
	}
	function handlesDecor(dec){
		if(!D() || !dec || !DECOR_PROP[dec.type]) return false;
		const spec = DECOR_PROP[dec.type];
		const cell = PROP_CELLS[spec.name];
		if(!cell) return false;
		return !!punchSheet(cell[2] || 'props');
	}

	if(sheet) sheet.addEventListener('load', function(){ _atlas = null; invalidateTiles(); });
	['props','crystal','light','ruin'].forEach(function(k){
		if(sheets[k]) sheets[k].addEventListener('load', function(){ _punched[k] = null; });
	});

	global.IceArt = {
		drawBackdrop: drawBackdrop,
		drawSolidTile: drawSolidTile,
		drawTiles: drawTiles,
		drawPlatform: drawPlatform,
		drawLivePlatforms: drawLivePlatforms,
		drawDecor: drawDecor,
		handlesDecor: handlesDecor,
		ready: function(){ return !!D() && !!ensureAtlas(); },
		isIce: function(){ return !!D(); },
		invalidateTiles: invalidateTiles,
	};
})(typeof window !== 'undefined' ? window : globalThis);
