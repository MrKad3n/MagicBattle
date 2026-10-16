/* =============================================================
   Living Wilds — tile / sprite assembly.

   Walls, floors, and ramps are blitted from a baked 40px atlas
   the way Infernal Depths uses its cavern tileset: repeat cells,
   grass / dirt / stone / vine families, and sloped floor caps.
   ============================================================= */
(function(global){
	const T = 40;
	const DRAW = 2;
	const DT = T * DRAW;

	const CELLS = {
		wallGrassA:[0,0], wallGrassB:[1,0], wallDirtA:[2,0], wallDirtB:[3,0],
		wallStoneA:[4,0], wallStoneB:[5,0], wallVineA:[6,0], wallVineB:[7,0],
		floorGrassA:[0,1], floorGrassB:[1,1], floorDirtA:[2,1], floorDirtB:[3,1],
		floorStoneA:[4,1], floorStoneB:[5,1], floorMoss:[6,1], floorRoots:[7,1],
		ceilA:[0,2], ceilB:[1,2], wallL:[2,2], wallR:[3,2],
		rampL:[4,2], rampR:[5,2], rampM:[6,2], floorEdge:[7,2],
		beamL:[0,3], beamM:[1,3], beamR:[2,3], beamT:[3,3],
		pilTop:[4,3], pilMid:[5,3], pilBase:[6,3], vineHang:[7,3],
		wallGrassC:[0,4], wallDirtC:[1,4], wallStoneC:[2,4], wallVineC:[3,4],
		floorGrassC:[4,4], floorDirtC:[5,4], transGS:[6,4], transSD:[7,4],
		wallMoss:[0,5], wallRoot:[1,5], floorLeaf:[2,5], floorPebble:[3,5],
		ceilC:[4,5], ceilVine:[5,5], rampL2:[6,5], rampR2:[7,5],
	};

	const WALL_BAG = {
		grass: ['wallGrassA', 'wallGrassB', 'wallGrassC', 'wallMoss'],
		dirt:  ['wallDirtA', 'wallDirtB', 'wallDirtC', 'wallRoot'],
		stone: ['wallStoneA', 'wallStoneB', 'wallStoneC', 'wallMoss'],
		vine:  ['wallVineA', 'wallVineB', 'wallVineC', 'wallRoot'],
	};
	const FLOOR_BAG = {
		grass: ['floorGrassA', 'floorGrassB', 'floorGrassC', 'floorLeaf'],
		dirt:  ['floorDirtA', 'floorDirtB', 'floorDirtC', 'floorPebble'],
		stone: ['floorStoneA', 'floorStoneB', 'floorPebble', 'transSD'],
		vine:  ['floorMoss', 'floorRoots', 'floorLeaf', 'transGS'],
	};
	const CEIL_BAG = ['ceilA', 'ceilB', 'ceilC', 'ceilVine'];

	let _atlas = null;
	const CHUNK = 320;
	const CHUNK_PAD = 40;
	const _chunks = new Map();
	const _platCache = new Map();
	let _hintRm = null;

	function D(){
		return (typeof dungeon !== 'undefined' && dungeon && dungeon._jungle) ? dungeon : null;
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
		const grass = { start:1, shrine:1, cache:1, warming:1, canopy:1, overgrownCanopy:1 };
		const vine = { sporeGarden:1, rootboundRuins:1, overgrown:1, miniBoss:1 };
		const stone = { vault:1, ruins:1, boss:1, trial:1 };
		if(grass[kind]) return 'grass';
		if(vine[kind]) return 'vine';
		if(stone[kind] || (section || 1) >= 4) return 'stone';
		if((section || 1) >= 3) return 'stone';
		if((section || 1) <= 1) return 'grass';
		return 'dirt';
	}

	function wallFamily(c, r, room){
		const base = kindFamily(room && room.kind, room && room.section);
		const n = field(c, r, room, 3.4, 0);
		const speck = (h2(c, r, roomSalt(room) + 3) & 255) / 255;
		const mix = n * 0.62 + speck * 0.38;
		if(base === 'grass'){
			if(mix > 0.78) return 'vine';
			if(mix > 0.52) return 'dirt';
			if(mix > 0.18) return 'grass';
			return speck > 0.45 ? 'dirt' : 'grass';
		}
		if(base === 'dirt'){
			if(mix > 0.76) return 'stone';
			if(mix > 0.48) return 'dirt';
			if(mix > 0.22) return 'grass';
			return speck > 0.5 ? 'vine' : 'dirt';
		}
		if(base === 'stone'){
			if(mix > 0.74) return 'vine';
			if(mix > 0.40) return 'stone';
			return speck > 0.55 ? 'dirt' : 'stone';
		}
		if(mix > 0.70) return 'stone';
		if(mix > 0.42) return 'vine';
		if(mix > 0.20) return 'dirt';
		return 'grass';
	}
	function floorFamily(c, r, room){
		const base = kindFamily(room && room.kind, room && room.section);
		const n = field(c, r, room, 3.1, 13);
		const speck = (h2(c, r, roomSalt(room) + 9) & 255) / 255;
		const mix = n * 0.58 + speck * 0.42;
		if(base === 'grass'){
			if(mix > 0.70) return 'dirt';
			if(mix > 0.28) return 'grass';
			return speck > 0.5 ? 'vine' : 'grass';
		}
		if(base === 'dirt'){
			if(mix > 0.72) return 'stone';
			if(mix > 0.38) return 'dirt';
			return speck > 0.48 ? 'grass' : 'dirt';
		}
		if(base === 'stone'){
			if(mix > 0.68) return 'vine';
			if(mix > 0.30) return 'stone';
			return 'dirt';
		}
		if(mix > 0.62) return 'stone';
		if(mix > 0.34) return 'vine';
		return 'dirt';
	}

	function bagPick(bag, c, r, salt){
		if(!bag || !bag.length) return 'wallGrassA';
		return bag[h2(c, r, salt) % bag.length];
	}

	function put(g, col, row, paint){
		const x = col * T, y = row * T;
		const img = g.getImageData(x, y, T, T);
		const d = img.data;
		function px(i, r, gch, b, a){
			d[i] = r; d[i + 1] = gch; d[i + 2] = b; d[i + 3] = a == null ? 255 : a;
		}
		for(let yy = 0; yy < T; yy++){
			for(let xx = 0; xx < T; xx++){
				const c = paint(xx, yy);
				px((yy * T + xx) * 4, c[0], c[1], c[2], c[3]);
			}
		}
		g.putImageData(img, x, y);
	}
	function mix(a, b, t){
		return [
			(a[0] + (b[0] - a[0]) * t) | 0,
			(a[1] + (b[1] - a[1]) * t) | 0,
			(a[2] + (b[2] - a[2]) * t) | 0,
			255
		];
	}
	function clamp(n, lo, hi){ return n < lo ? lo : n > hi ? hi : n; }
	function speckle(x, y, seed, amt){
		return ((h2(x, y, seed) & 255) / 255 - 0.5) * amt;
	}

	function paintWall(kind, col, row, seed){
		const pal = {
			grass: [[46, 78, 38], [68, 108, 52], [32, 54, 28], [90, 132, 64]],
			dirt:  [[72, 52, 30], [96, 70, 40], [48, 34, 20], [118, 86, 50]],
			stone: [[58, 64, 56], [78, 86, 76], [40, 44, 40], [98, 108, 96]],
			vine:  [[40, 62, 36], [54, 80, 44], [28, 42, 26], [70, 118, 58]],
		}[kind] || [[50, 70, 40], [70, 90, 55], [30, 45, 28], [90, 120, 70]];
		return function(x, y){
			const n = ((h2(x + col * 9, y + row * 7, seed) & 255) / 255);
			const band = ((y + (h2(col, row, seed + 3) & 7)) % 11) < 1;
			let c = n > 0.72 ? pal[3] : n > 0.42 ? pal[1] : n > 0.18 ? pal[0] : pal[2];
			if(kind === 'vine' && ((x + y * 2 + seed) % 17) < 2) c = pal[3];
			if(kind === 'grass' && y < 8 && n > 0.55) c = pal[3];
			if(band) c = mix(c, pal[2], 0.35);
			const s = speckle(x, y, seed, 16);
			return [clamp(c[0] + s, 0, 255), clamp(c[1] + s, 0, 255), clamp(c[2] + s * 0.7, 0, 255), 255];
		};
	}
	function paintFloor(kind, col, row, seed){
		const pal = {
			grass: [[86, 128, 58], [112, 158, 72], [60, 92, 42], [142, 186, 88]],
			dirt:  [[108, 78, 44], [132, 96, 56], [78, 54, 32], [154, 114, 68]],
			stone: [[92, 98, 86], [114, 122, 108], [68, 72, 64], [132, 140, 124]],
			vine:  [[70, 108, 56], [88, 134, 70], [48, 76, 40], [118, 168, 86]],
		}[kind] || [[90, 120, 60], [110, 140, 75], [70, 90, 45], [130, 160, 90]];
		return function(x, y){
			const n = ((h2(x + col * 5, y + row * 11, seed) & 255) / 255);
			let c = y < 7 ? pal[3] : (n > 0.7 ? pal[1] : n > 0.3 ? pal[0] : pal[2]);
			if(y < 5) c = mix(c, pal[3], 0.45);
			if(kind === 'grass' && y < 10 && ((x * 3 + y + seed) % 9) === 0) c = pal[3];
			if(kind === 'vine' && ((x + y + seed) % 13) === 0) c = [52, 96, 44, 255];
			const s = speckle(x, y, seed + 4, 14);
			return [clamp(c[0] + s, 0, 255), clamp(c[1] + s, 0, 255), clamp(c[2] + s * 0.65, 0, 255), 255];
		};
	}
	function paintCeil(col, row, seed, vine){
		return function(x, y){
			const n = ((h2(x, y + row * 8, seed) & 255) / 255);
			let c = n > 0.6 ? [28, 40, 24] : [18, 28, 18];
			if(vine && ((x + y * 2) % 15) < 2) c = [46, 82, 40];
			if(y > 28) c = mix(c, [36, 52, 30], 0.4);
			return [c[0], c[1], c[2], 255];
		};
	}
	function paintRamp(dir, col, row, seed){
		return function(x, y){
			const t = dir === 'L' ? (T - 1 - x) / (T - 1) : dir === 'R' ? x / (T - 1) : 0.45;
			const cut = (1 - t) * (T - 6) + 3;
			if(y < cut) return [0, 0, 0, 0];
			const n = ((h2(x + col, y + row, seed) & 255) / 255);
			const c = n > 0.55 ? [108, 148, 70] : [78, 108, 50];
			const edge = y < cut + 4;
			return edge ? [128, 172, 86, 255] : [c[0], c[1], c[2], 255];
		};
	}
	function paintSide(dir){
		return function(x, y){
			const edge = dir === 'L' ? x < 8 : x > 31;
			const n = ((h2(x, y, dir === 'L' ? 3 : 8) & 255) / 255);
			const c = edge ? [92, 128, 64] : (n > 0.5 ? [52, 72, 40] : [36, 52, 30]);
			return [c[0], c[1], c[2], 255];
		};
	}
	function paintBeam(part, col, row, seed){
		return function(x, y){
			const bark = y < 10 || y > 30;
			let c = bark ? [86, 62, 34] : [64, 46, 26];
			if(part === 'L' && x < 8) c = [102, 76, 40];
			if(part === 'R' && x > 31) c = [102, 76, 40];
			if(((x + y + seed) % 11) === 0) c = [48, 34, 18];
			if(y < 5) c = [92, 138, 62];
			return [c[0], c[1], c[2], 255];
		};
	}

	function ensureAtlas(){
		if(_atlas || typeof document === 'undefined') return _atlas;
		const el = document.createElement('canvas');
		el.width = 8 * T;
		el.height = 6 * T;
		const g = el.getContext('2d');
		g.imageSmoothingEnabled = false;
		put(g, 0, 0, paintWall('grass', 0, 0, 1));
		put(g, 1, 0, paintWall('grass', 1, 0, 2));
		put(g, 2, 0, paintWall('dirt', 2, 0, 3));
		put(g, 3, 0, paintWall('dirt', 3, 0, 4));
		put(g, 4, 0, paintWall('stone', 4, 0, 5));
		put(g, 5, 0, paintWall('stone', 5, 0, 6));
		put(g, 6, 0, paintWall('vine', 6, 0, 7));
		put(g, 7, 0, paintWall('vine', 7, 0, 8));
		put(g, 0, 1, paintFloor('grass', 0, 1, 11));
		put(g, 1, 1, paintFloor('grass', 1, 1, 12));
		put(g, 2, 1, paintFloor('dirt', 2, 1, 13));
		put(g, 3, 1, paintFloor('dirt', 3, 1, 14));
		put(g, 4, 1, paintFloor('stone', 4, 1, 15));
		put(g, 5, 1, paintFloor('stone', 5, 1, 16));
		put(g, 6, 1, paintFloor('vine', 6, 1, 17));
		put(g, 7, 1, paintFloor('vine', 7, 1, 18));
		put(g, 0, 2, paintCeil(0, 2, 21, false));
		put(g, 1, 2, paintCeil(1, 2, 22, false));
		put(g, 2, 2, paintSide('L'));
		put(g, 3, 2, paintSide('R'));
		put(g, 4, 2, paintRamp('L', 4, 2, 31));
		put(g, 5, 2, paintRamp('R', 5, 2, 32));
		put(g, 6, 2, paintRamp('M', 6, 2, 33));
		put(g, 7, 2, paintFloor('grass', 7, 2, 19));
		put(g, 0, 3, paintBeam('L', 0, 3, 41));
		put(g, 1, 3, paintBeam('M', 1, 3, 42));
		put(g, 2, 3, paintBeam('R', 2, 3, 43));
		put(g, 3, 3, paintBeam('T', 3, 3, 44));
		put(g, 4, 3, paintWall('dirt', 4, 3, 45));
		put(g, 5, 3, paintWall('dirt', 5, 3, 46));
		put(g, 6, 3, paintWall('stone', 6, 3, 47));
		put(g, 7, 3, paintCeil(7, 3, 23, true));
		put(g, 0, 4, paintWall('grass', 0, 4, 51));
		put(g, 1, 4, paintWall('dirt', 1, 4, 52));
		put(g, 2, 4, paintWall('stone', 2, 4, 53));
		put(g, 3, 4, paintWall('vine', 3, 4, 54));
		put(g, 4, 4, paintFloor('grass', 4, 4, 55));
		put(g, 5, 4, paintFloor('dirt', 5, 4, 56));
		put(g, 6, 4, paintFloor('grass', 6, 4, 57));
		put(g, 7, 4, paintFloor('stone', 7, 4, 58));
		put(g, 0, 5, paintWall('vine', 0, 5, 61));
		put(g, 1, 5, paintWall('dirt', 1, 5, 62));
		put(g, 2, 5, paintFloor('grass', 2, 5, 63));
		put(g, 3, 5, paintFloor('stone', 3, 5, 64));
		put(g, 4, 5, paintCeil(4, 5, 24, false));
		put(g, 5, 5, paintCeil(5, 5, 25, true));
		put(g, 6, 5, paintRamp('L', 6, 5, 65));
		put(g, 7, 5, paintRamp('R', 7, 5, 66));
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
		if(neighborSolid(c, r + 1)) return 'beamT';
		if(leftAir && rightAir) return 'beamM';
		if(leftAir) return 'beamL';
		if(rightAir) return 'beamR';
		return 'beamM';
	}

	function drawSolidTile(ctx, c, r, sx, sy, edges){
		ensureAtlas();
		if(typeof tileMap !== 'undefined' && tileMap[r] && tileMap[r][c] !== 0) return true;
		const room = roomAt(c, r);
		const beam = pickBeam(c, r, edges);
		if(beam){
			blitCell(ctx, beam, sx, sy, 1);
			return true;
		}
		const floor = pickFloor(c, r, edges, room);
		if(floor){
			blitCell(ctx, floor, sx, sy, 1, !!(h2(c, r, 102) & 1) && floor.indexOf('ramp') < 0 && floor !== 'wallL' && floor !== 'wallR');
			return true;
		}
		const wall = pickWall(c, r, edges, room);
		const flip = wall !== 'wallL' && wall !== 'wallR' && !!(h2(c, r, 103) & 1);
		blitCell(ctx, wall, sx, sy, 1, flip);
		return true;
	}

	function invalidateTiles(){ _chunks.clear(); _platCache.clear(); _hintRm = null; }

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
		g.addColorStop(0, '#0a1a10');
		g.addColorStop(0.45, d.bgColor || '#07140d');
		g.addColorStop(1, '#06100a');
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		return true;
	}

	function assembleBeam(ctx, x, y, w){
		const n = Math.max(1, Math.ceil(w / DT));
		for(let i = 0; i < n; i++){
			let name = 'beamM';
			if(n === 1) name = 'beamM';
			else if(i === 0) name = 'beamL';
			else if(i === n - 1) name = 'beamR';
			blitCell(ctx, name, x + i * DT, y, DRAW);
		}
	}
	function paintPlatform(g, p, ox, oy){
		assembleBeam(g, ox, oy - 8, p.w);
	}
	function drawPlatform(ctx, p){
		if(!p || p._gone || p._jungleHidden) return false;
		if(!vis(p.x, p.y, p.w, p.h || T, 40)) return true;
		ensureAtlas();
		const c = cam();
		const sx = p.x - c.x, sy = p.y - c.y;
		const live = p.kind === 'move' || p.kind === 'raft' || p.kind === 'orbit' || p.kind === 'collapse' || p._growT;
		if(!live && typeof document !== 'undefined'){
			const key = (p.x|0) + ',' + (p.y|0) + ',' + (p.w|0) + ',' + (p.h||T);
			let el = _platCache.get(key);
			if(!el){
				el = document.createElement('canvas');
				el.width = Math.ceil(p.w) + 16;
				el.height = DT + 16;
				const g = el.getContext('2d');
				g.imageSmoothingEnabled = false;
				paintPlatform(g, p, 8, 8);
				_platCache.set(key, el);
			}
			ctx.imageSmoothingEnabled = false;
			ctx.drawImage(el, sx - 8, sy - 8);
			return true;
		}
		paintPlatform(ctx, p, sx, sy);
		return true;
	}
	function drawLivePlatforms(ctx){
		const d = D();
		if(!d || !d.platforms) return;
		for(let i = 0; i < d.platforms.length; i++){
			const p = d.platforms[i];
			if(!p || p._gone || p._jungleHidden) continue;
			if(global.DungeonSkin && DungeonSkin.owns && DungeonSkin.owns(p)) continue;
			if(p.kind === 'move' || p.kind === 'raft' || p.kind === 'orbit' || p._growT){
				drawPlatform(ctx, p);
			}
		}
	}
	function drawStaticPlatforms(ctx){
		const d = D();
		if(!d || !d.platforms) return;
		for(let i = 0; i < d.platforms.length; i++){
			const p = d.platforms[i];
			if(!p || p._gone || p._jungleHidden) continue;
			if(global.DungeonSkin && DungeonSkin.owns && DungeonSkin.owns(p)) continue;
			if(p.kind === 'move' || p.kind === 'raft' || p.kind === 'orbit') continue;
			drawPlatform(ctx, p);
		}
	}

	global.JungleArt = {
		drawBackdrop: drawBackdrop,
		drawSolidTile: drawSolidTile,
		drawTiles: drawTiles,
		drawPlatform: drawPlatform,
		drawLivePlatforms: drawLivePlatforms,
		drawStaticPlatforms: drawStaticPlatforms,
		ready: function(){ return !!D() && !!ensureAtlas(); },
		isJungle: function(){ return !!D(); },
		invalidateTiles: invalidateTiles,
	};
})(typeof window !== 'undefined' ? window : globalThis);
