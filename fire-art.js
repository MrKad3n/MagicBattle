/* =============================================================
   Infernal Depths — tile / sprite assembly.

   Walls, floors, platforms, backgrounds, and dressing are blitted
   from modular 40px sheets the way a cemetery tileset is stacked:
   repeat tiles, end-caps + middles, pillars under beams, props at
   1x or 2x nearest-neighbor. Lava stays on DungeonFluid.
   ============================================================= */
(function(global){
	const T = 40;
	const DRAW = 2;
	const DT = T * DRAW;
	const PROP = 80;
	const PROP_SCALE = 3;
	const VER = '9';

	const CELLS = {
		wallA:[0,0], wallB:[1,0], wallVein:[2,0], wallDark:[3,0], wallBrick:[4,0], wallHot:[5,0], ceilA:[6,0], ceilB:[7,0],
		floorAshA:[0,1], floorAshB:[1,1], floorBrick:[2,1], floorCrack:[3,1], floorHot:[4,1], floorTop:[5,1], floorDirt:[6,1], floorEdge:[7,1],
		beamL:[0,2], beamM:[1,2], beamR:[2,2], beamT:[3,2], beamJoin:[4,2], beamCrack:[5,2], beamThin:[6,2], beamEnd:[7,2],
		pilTop:[0,3], pilMid:[1,3], pilBase:[2,3], pilThin:[3,3], pilHot:[4,3], pilWide:[5,3], pilStub:[6,3], chain:[7,3],
		grate:[0,4], fence:[1,4], bush:[2,4], mound:[3,4], glow:[4,4], crackDec:[5,4], face:[6,4], arch:[7,4],
		doorL:[0,5], doorR:[1,5], doorTop:[2,5], doorBot:[3,5], bracket:[4,5], statueBase:[5,5], rubble:[6,5], vent:[7,5],
		rampL:[0,6], rampR:[1,6], rampM:[2,6], beamShadow:[3,6], wallL:[4,6], wallR:[5,6], wallTop:[6,6], wallBot:[7,6],
		wallC:[0,7], floorC:[1,7], beamM2:[2,7], pilMid2:[3,7], bush2:[4,7], mound2:[5,7], fence2:[6,7], glow2:[7,7],
	};

	/* Extra wall/floor cells live on the baked atlas (rows 8-11). */
	const EXTRA = {
		wallA2:[0,8], wallA3:[1,8], wallB2:[2,8], wallDark2:[3,8],
		wallBrick2:[4,8], wallBrick3:[5,8], wallHot2:[6,8], wallVein2:[7,8],
		wallC2:[0,9], wallSoot:[1,9], wallAsh:[2,9], wallPitted:[3,9],
		floorAshC:[4,9], floorAshD:[5,9], floorBrick2:[6,9], floorCrack2:[7,9],
		floorHot2:[0,10], floorTop2:[1,10], floorDirt2:[2,10], floorC2:[3,10],
		ceilC:[4,10], ceilD:[5,10], wallHot3:[6,10], wallVein3:[7,10],
		floorSpeck:[0,11], floorWarm:[1,11], wallMottled:[2,11], wallSeam:[3,11],
		floorAshHot:[4,11], wallBrickHot:[5,11], floorChip:[6,11], wallScar:[7,11],
	};
	const EXTRA_FALLBACK = {
		wallA2:'wallA', wallA3:'wallB', wallB2:'wallB', wallDark2:'wallDark',
		wallBrick2:'wallBrick', wallBrick3:'wallBrick', wallHot2:'wallHot', wallVein2:'wallVein',
		wallC2:'wallC', wallSoot:'wallDark', wallAsh:'wallB', wallPitted:'wallA',
		floorAshC:'floorAshA', floorAshD:'floorAshB', floorBrick2:'floorBrick', floorCrack2:'floorCrack',
		floorHot2:'floorHot', floorTop2:'floorTop', floorDirt2:'floorDirt', floorC2:'floorC',
		ceilC:'ceilA', ceilD:'ceilB', wallHot3:'wallHot', wallVein3:'wallVein',
		floorSpeck:'floorAshB', floorWarm:'floorTop', wallMottled:'wallC', wallSeam:'wallBrick',
		floorAshHot:'floorHot', wallBrickHot:'wallBrick', floorChip:'floorCrack', wallScar:'wallVein',
	};

	const PROP_CELLS = {
		furnace:[0,0], altar:[1,0], anvil:[2,0], brazier:[3,0],
		gate:[0,1], idol:[1,1], basalt:[2,1], containment:[3,1],
		chain:[0,2], pipe:[1,2], debris:[2,2], hangBrazier:[3,2],
		bush:[0,3], mound:[1,3], fence:[2,3], vent:[3,3],
	};

	const DECOR_PROP = {
		fireFurnace:{ name:'furnace', scale:PROP_SCALE },
		fireAltar:{ name:'altar', scale:PROP_SCALE },
		fireAnvil:{ name:'anvil', scale:PROP_SCALE },
		fireBrazier:{ name:'brazier', scale:PROP_SCALE },
		fireGate:{ name:'gate', scale:PROP_SCALE },
		fireBasalt:{ name:'basalt', scale:PROP_SCALE },
		fireContainment:{ name:'containment', scale:PROP_SCALE },
		fireChain:{ name:'chain', scale:PROP_SCALE, hang:true },
		fireLavaPipe:{ name:'pipe', scale:PROP_SCALE, hang:true },
		pipe:{ name:'pipe', scale:PROP_SCALE, hang:true },
		fireDebris:{ name:'debris', scale:PROP_SCALE },
		rubble:{ name:'debris', scale:PROP_SCALE },
		fireVent:{ name:'vent', scale:PROP_SCALE },
		fireCrackFloor:{ tile:'floorCrack', scale:DRAW },
		fireReservoir:{ tile:'glow', scale:DRAW },
		fireTrench:{ tile:'floorHot', scale:DRAW },
		firePillar:{ stack:true },
		column:{ stack:true },
		fireBridge:{ beam:true },
		fireValveWheel:{ name:'containment', scale:PROP_SCALE },
		firePressureGauge:{ name:'altar', scale:PROP_SCALE },
		fireNest:{ name:'idol', scale:PROP_SCALE },
		firePiston:{ name:'gate', scale:PROP_SCALE, hang:true },
		fireGear:{ name:'anvil', scale:PROP_SCALE },
		firePour:{ name:'pipe', scale:PROP_SCALE, hang:true },
	};

	function img(src){
		const el = new Image();
		el.src = src + '?v=' + VER;
		return el;
	}
	const sheet = img('images/dungeon/fire-tileset.png');
	const props = img('images/dungeon/fire-props-sheet.png');

	function D(){
		return (typeof dungeon !== 'undefined' && dungeon && dungeon._theme === 'fire') ? dungeon : null;
	}
	function cam(){ return (typeof camera !== 'undefined') ? camera : { x:0, y:0 }; }
	function readySheet(){ return sheet.complete && sheet.naturalWidth > 8; }
	function readyProps(){ return props.complete && props.naturalWidth > 8; }
	function hash(a, b){ return h2(a, b, 19); }
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
		if(!room) return 7;
		return (room.id * 31 + (room.section || 1) * 17 + (room.kind ? room.kind.length * 13 : 0)) | 0;
	}
	function field(c, r, room, cell, saltAdd){
		const s = roomSalt(room) + (saltAdd || 0);
		const coarse = cell || 7;
		return Math.max(0, Math.min(1,
			valueNoise(c, r, coarse, s) * 0.62 +
			valueNoise(c + 9, r - 4, coarse * 1.7, s + 91) * 0.28 +
			valueNoise(c, r, 3.2, s + 4) * 0.10
		));
	}
	function vis(x, y, w, h, pad){
		pad = pad || 80;
		const c = cam();
		return x - c.x + w > -pad && x - c.x < canvas.width + pad && y - c.y + h > -pad && y - c.y < canvas.height + pad;
	}

	let _atlas = null;
	function srcImg(name){
		if(EXTRA[name] && _atlas) return _atlas;
		return _atlas || sheet;
	}
	function cellOf(name){
		if(EXTRA[name] && _atlas) return EXTRA[name];
		if(CELLS[name]) return CELLS[name];
		const fb = EXTRA_FALLBACK[name];
		return fb ? CELLS[fb] : null;
	}
	function blitCell(ctx, name, dx, dy, scale, flipX){
		if(!readySheet()) return false;
		ensureAtlas();
		const cell = cellOf(name);
		if(!cell) return false;
		scale = scale || DRAW;
		const dw = T * scale, dh = T * scale;
		const img = srcImg(name);
		ctx.imageSmoothingEnabled = false;
		if(flipX){
			ctx.save();
			ctx.translate(dx + dw, dy);
			ctx.scale(-1, 1);
			ctx.drawImage(img, cell[0] * T, cell[1] * T, T, T, 0, 0, dw, dh);
			ctx.restore();
		} else {
			ctx.drawImage(img, cell[0] * T, cell[1] * T, T, T, dx, dy, dw, dh);
		}
		return true;
	}
	function flipImageDataX(img){
		const w = img.width, h = img.height, d = img.data;
		for(let y = 0; y < h; y++){
			for(let x = 0; x < (w >> 1); x++){
				const i = (y * w + x) * 4, j = (y * w + (w - 1 - x)) * 4;
				const r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3];
				d[i] = d[j]; d[i + 1] = d[j + 1]; d[i + 2] = d[j + 2]; d[i + 3] = d[j + 3];
				d[j] = r; d[j + 1] = g; d[j + 2] = b; d[j + 3] = a;
			}
		}
	}
	function mutateCell(img, mut, seed){
		const w = img.width, h = img.height, d = img.data;
		let rng = seed || 1;
		function rnd(){ rng = (Math.imul(rng, 1664525) + 1013904223) | 0; return (rng >>> 0) / 4294967296; }
		function px(x, y){ return ((y * w + x) * 4); }
		function darken(i, amt){
			d[i] = Math.max(0, d[i] - amt);
			d[i + 1] = Math.max(0, d[i + 1] - amt);
			d[i + 2] = Math.max(0, d[i + 2] - Math.floor(amt * 0.85));
		}
		function lighten(i, amt){
			d[i] = Math.min(255, d[i] + amt);
			d[i + 1] = Math.min(255, d[i + 1] + Math.floor(amt * 0.82));
			d[i + 2] = Math.min(255, d[i + 2] + Math.floor(amt * 0.55));
		}
		function ember(i, hot){
			d[i] = Math.min(255, 180 + (hot ? 50 : 20));
			d[i + 1] = Math.min(255, 70 + (hot ? 40 : 10));
			d[i + 2] = 18;
		}
		if(mut.soot){
			const cx = 8 + rnd() * 24, cy = 8 + rnd() * 24, rad = 7 + rnd() * 10;
			for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){
				const dd = (x - cx) * (x - cx) + (y - cy) * (y - cy);
				if(dd < rad * rad) darken(px(x, y), Math.floor(18 * (1 - dd / (rad * rad))));
			}
		}
		if(mut.ash){
			for(let n = 0; n < 28; n++){
				const x = (rnd() * w) | 0, y = (rnd() * (h * 0.55)) | 0;
				lighten(px(x, y), 14 + (rnd() * 16) | 0);
			}
		}
		if(mut.brick){
			const off = (rnd() * 6) | 0;
			const gap = 8 + ((rnd() * 3) | 0);
			for(let y = 3 + off; y < h - 2; y += gap){
				for(let x = 0; x < w; x++){
					if(((x + (y / gap | 0) * 9) % 13) === 0) continue;
					darken(px(x, y), 12);
					if(y + 1 < h) darken(px(x, y + 1), 6);
				}
			}
		}
		if(mut.pit){
			for(let n = 0; n < 10; n++){
				const x = 3 + (rnd() * (w - 6)) | 0, y = 3 + (rnd() * (h - 6)) | 0;
				darken(px(x, y), 28);
				if(x + 1 < w) darken(px(x + 1, y), 16);
			}
		}
		if(mut.cracks){
			let x = 4 + (rnd() * (w - 8)) | 0, y = 2 + (rnd() * (h - 6)) | 0;
			const steps = 10 + (rnd() * 14) | 0;
			for(let s = 0; s < steps; s++){
				ember(px(x, y), mut.ember && rnd() < 0.2);
				x += (rnd() < 0.55 ? 1 : -1);
				if(rnd() < 0.55) y += (rnd() < 0.45 ? 1 : 0);
				if(x < 1) x = 1; if(x > w - 2) x = w - 2;
				if(y < 1) y = 1; if(y > h - 2) y = h - 2;
			}
		}
		if(mut.ember){
			for(let n = 0; n < 5; n++){
				if(rnd() > 0.7) continue;
				ember(px((rnd() * w) | 0, (rnd() * h) | 0), true);
			}
		}
		if(mut.mottle){
			for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){
				if(((x * 17 + y * 13 + seed) & 15) === 0) darken(px(x, y), 10);
				if(((x * 11 + y * 19 + seed) & 21) === 0) lighten(px(x, y), 8);
			}
		}
	}
	function bakeCell(g, from, destCol, destRow, mut){
		const src = CELLS[from];
		if(!src) return;
		g.drawImage(sheet, src[0] * T, src[1] * T, T, T, destCol * T, destRow * T, T, T);
		const img = g.getImageData(destCol * T, destRow * T, T, T);
		if(mut.flipX) flipImageDataX(img);
		mutateCell(img, mut, destCol * 97 + destRow * 53 + (mut.seed || 0));
		g.putImageData(img, destCol * T, destRow * T);
	}
	function ensureAtlas(){
		if(_atlas || !readySheet() || typeof document === 'undefined') return _atlas;
		const el = document.createElement('canvas');
		el.width = 8 * T;
		el.height = 12 * T;
		const g = el.getContext('2d');
		g.imageSmoothingEnabled = false;
		g.drawImage(sheet, 0, 0);
		const rec = [
			['wallA', 0, 8, { flipX:true, mottle:true }],
			['wallA', 1, 8, { soot:true, pit:true, seed:2 }],
			['wallB', 2, 8, { flipX:true, cracks:true, seed:3 }],
			['wallDark', 3, 8, { soot:true, mottle:true, seed:4 }],
			['wallBrick', 4, 8, { flipX:true, brick:true, seed:5 }],
			['wallBrick', 5, 8, { brick:true, soot:true, seed:6 }],
			['wallHot', 6, 8, { flipX:true, ember:true, cracks:true, seed:7 }],
			['wallVein', 7, 8, { flipX:true, cracks:true, seed:8 }],
			['wallC', 0, 9, { flipX:true, mottle:true, seed:9 }],
			['wallDark', 1, 9, { soot:true, pit:true, seed:10 }],
			['wallB', 2, 9, { ash:true, mottle:true, seed:11 }],
			['wallA', 3, 9, { pit:true, cracks:true, seed:12 }],
			['floorAshA', 4, 9, { flipX:true, ash:true, seed:13 }],
			['floorAshB', 5, 9, { ash:true, mottle:true, seed:14 }],
			['floorBrick', 6, 9, { flipX:true, brick:true, seed:15 }],
			['floorCrack', 7, 9, { cracks:true, pit:true, seed:16 }],
			['floorHot', 0, 10, { flipX:true, ember:true, cracks:true, seed:17 }],
			['floorTop', 1, 10, { ash:true, mottle:true, seed:18 }],
			['floorDirt', 2, 10, { flipX:true, soot:true, ash:true, seed:19 }],
			['floorC', 3, 10, { mottle:true, pit:true, seed:20 }],
			['ceilA', 4, 10, { flipX:true, soot:true, seed:21 }],
			['ceilB', 5, 10, { mottle:true, pit:true, seed:22 }],
			['wallHot', 6, 10, { soot:true, ember:true, seed:23 }],
			['wallVein', 7, 10, { cracks:true, ember:true, seed:24 }],
			['floorAshB', 0, 11, { pit:true, ash:true, seed:25 }],
			['floorTop', 1, 11, { ember:true, ash:true, seed:26 }],
			['wallC', 2, 11, { mottle:true, soot:true, seed:27 }],
			['wallBrick', 3, 11, { flipX:true, brick:true, soot:true, seed:28 }],
			['floorHot', 4, 11, { ash:true, ember:true, seed:29 }],
			['wallBrick', 5, 11, { ember:true, brick:true, seed:30 }],
			['floorCrack', 6, 11, { flipX:true, pit:true, seed:31 }],
			['wallA', 7, 11, { cracks:true, soot:true, seed:32 }],
		];
		for(let i = 0; i < rec.length; i++){
			const r = rec[i];
			bakeCell(g, r[0], r[1], r[2], r[3]);
		}
		_atlas = el;
		return _atlas;
	}

	function blitProp(ctx, name, dx, dy, scale){
		if(!readyProps()) return false;
		const cell = PROP_CELLS[name];
		if(!cell) return false;
		scale = scale || PROP_SCALE;
		const dw = PROP * scale, dh = PROP * scale;
		ctx.imageSmoothingEnabled = false;
		ctx.drawImage(props, cell[0] * PROP, cell[1] * PROP, PROP, PROP, dx, dy, dw, dh);
		return true;
	}

	function tileAcross(ctx, nameA, nameB, x, y, w, scale){
		scale = scale || DRAW;
		const step = T * scale;
		const n = Math.max(1, Math.ceil(w / step));
		for(let i = 0; i < n; i++){
			const nm = (h2(i, y | 0, 44) & 3) === 0 ? nameB : nameA;
			blitCell(ctx, nm, x + i * step, y, scale, !!(h2(i, y | 0, 45) & 1));
		}
	}

	function assembleBeam(ctx, x, y, w, cracked, seedY){
		const hy = seedY != null ? seedY : y;
		const n = Math.max(1, Math.ceil(w / DT));
		for(let i = 0; i < n; i++){
			let name = 'beamM';
			if(n === 1) name = 'beamEnd';
			else if(i === 0) name = 'beamL';
			else if(i === n - 1) name = 'beamR';
			else {
				const roll = h2(i, hy | 0, 61) % 10;
				if(cracked && roll < 3) name = 'beamCrack';
				else if(roll === 3) name = 'beamM2';
				else if(roll === 4) name = 'beamT';
				else if(roll === 5) name = 'beamThin';
				else name = 'beamM';
			}
			const flipMid = (name === 'beamM' || name === 'beamM2' || name === 'beamCrack') && !!(h2(i, 3, 62) & 1);
			blitCell(ctx, name, x + i * DT, y, DRAW, flipMid);
		}
	}

	function assemblePillar(ctx, x, floorY, h, hot){
		const tiles = Math.max(2, Math.round(h / DT));
		const topY = floorY - tiles * DT;
		blitCell(ctx, 'pilWide', x, topY, DRAW);
		for(let i = 1; i < tiles - 1; i++){
			blitCell(ctx, hot ? 'pilHot' : (i & 1 ? 'pilMid2' : 'pilMid'), x, topY + i * DT, DRAW);
		}
		blitCell(ctx, 'pilBase', x, topY + (tiles - 1) * DT, DRAW);
	}

	function assembleSupportUnder(ctx, beamX, beamY, beamW, drop){
		const span = Math.max(1, Math.floor(beamW / DT));
		const count = span >= 6 ? 2 : 1;
		for(let s = 0; s < count; s++){
			const tx = beamX + (count === 1 ? Math.floor((span - 1) / 2) * DT : (s === 0 ? DT : (span - 2) * DT));
			const tiles = Math.max(2, Math.round(drop / DT));
			blitCell(ctx, 'pilTop', tx, beamY + 8, DRAW);
			for(let i = 1; i < tiles; i++){
				const name = i === tiles - 1 ? 'pilBase' : ((i + s) & 1 ? 'pilMid' : 'pilThin');
				blitCell(ctx, name, tx, beamY + 8 + i * DT, DRAW);
			}
		}
	}

	function kindVariant(kind){
		const hot = { furnace:1, warden:1, boss:1, eruption:1, flood:1, stabilize:1 };
		const ash = { start:1, cooling:1, cache:1, shrine:1, secretShrine:1 };
		if(hot[kind]) return 'hot';
		if(ash[kind]) return 'ash';
		return 'stone';
	}

	let _hintRm = null;
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

	function neighborSolid(c, r){
		if(typeof tileMap === 'undefined') return true;
		if(r < 0 || c < 0 || r >= tileMap.length || !tileMap[r] || c >= tileMap[r].length) return true;
		return tileMap[r][c] === 0;
	}

	function drawBackdrop(ctx){
		const d = D();
		if(!d) return false;
		ctx.fillStyle = d.bgColor || '#120806';
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		return true;
	}

	function drawRoomDress(ctx){
		const d = D();
		if(!d || !readySheet()) return;
		const c = cam();
		const rooms = d.rooms || [];
		for(let i = 0; i < rooms.length; i++){
			const rm = rooms[i];
			if(!vis(rm.x, rm.y, rm.w, rm.h, 60)) continue;
			const walk = rm.y + rm.h - (rm.raisedFloor || 0);
			const k = rm.kind;
			const seed = rm.id * 17 + (rm.section || 1) * 9;
			const wet = !!(rm.lavaLake || rm._wetFloor);

			if(!wet && k !== 'combat' && k !== 'elite' && k !== 'eliteChamber' && k !== 'risk' && k !== 'trial'){
				const bushEvery = k === 'crossing' || k === 'river' ? 520 : 480;
				const sink = k === 'start' ? 12 : 0;
				let placed = 0;
				for(let x = rm.x + 80; x < rm.x + rm.w - 120 && placed < 2; x += bushEvery){
					if(rm.floorHoles && rm.floorHoles.some(function(h){ return x > h.x - 20 && x < h.x + h.w; })) continue;
					const sx = x - c.x, sy = walk + sink - c.y;
					blitCell(ctx, (x + seed) % 80 < 40 ? 'bush' : 'bush2', sx, sy - DT, DRAW);
					placed++;
				}
			}
			if((k === 'start' || k === 'preboss' || k === 'cooling') && !wet){
				const sink = k === 'start' ? 12 : 0;
				blitCell(ctx, 'fence', rm.x + 100 - c.x, walk - DT + sink - c.y, DRAW);
				blitCell(ctx, 'fence', rm.x + rm.w - 180 - c.x, walk - DT + sink - c.y, DRAW);
			}
			if(k === 'furnace' || k === 'warden' || k === 'stabilize'){
				assemblePillar(ctx, rm.x + 80 - c.x, walk - c.y, 240, true);
				assemblePillar(ctx, rm.x + rm.w - 160 - c.x, walk - c.y, 240, true);
			}
			if(k === 'boss'){
				assemblePillar(ctx, rm.x + 160 - c.x, walk - c.y, 280, true);
				assemblePillar(ctx, rm.x + rm.w - 240 - c.x, walk - c.y, 280, true);
				if(readyProps()) blitProp(ctx, 'idol', rm.x + rm.w * 0.72 - c.x, walk - PROP * PROP_SCALE - c.y, PROP_SCALE);
			}
			if(k === 'shrine' || k === 'secretShrine' || k === 'secretCave'){
				if(readyProps()) blitProp(ctx, 'idol', rm.x + rm.w * 0.5 - PROP * PROP_SCALE * 0.5 - c.x, walk - PROP * PROP_SCALE - c.y, PROP_SCALE);
			}
		}
	}

	const WALL_BAG = {
		plain: ['wallA', 'wallB', 'wallC', 'wallA2', 'wallA3', 'wallB2', 'wallC2', 'wallMottled'],
		brick: ['wallBrick', 'wallBrick2', 'wallBrick3', 'wallSeam', 'wallBrickHot'],
		dark:  ['wallDark', 'wallDark2', 'wallSoot', 'wallPitted'],
		ash:   ['wallAsh', 'wallB', 'wallA2', 'wallMottled'],
		hot:   ['wallHot', 'wallHot2', 'wallHot3', 'wallBrickHot'],
		vein:  ['wallVein', 'wallVein2', 'wallVein3', 'wallScar'],
	};
	const FLOOR_BAG = {
		plain: ['floorTop', 'floorTop2', 'floorC', 'floorC2', 'floorWarm', 'floorChip'],
		brick: ['floorBrick', 'floorBrick2', 'floorTop', 'floorEdge'],
		ash:   ['floorAshA', 'floorAshB', 'floorAshC', 'floorAshD', 'floorSpeck', 'floorDirt'],
		hot:   ['floorHot', 'floorHot2', 'floorAshHot', 'floorCrack', 'floorWarm'],
		crack: ['floorCrack', 'floorCrack2', 'floorChip', 'floorDirt2'],
		dirt:  ['floorDirt', 'floorDirt2', 'floorAshB', 'floorSpeck'],
	};
	const CEIL_BAG = ['ceilA', 'ceilB', 'ceilC', 'ceilD'];

	function bagPick(bag, c, r, salt){
		if(!bag || !bag.length) return 'wallA';
		return bag[h2(c, r, salt) % bag.length];
	}
	function wallFamily(c, r, room){
		const v = room ? kindVariant(room.kind) : 'stone';
		const n = field(c, r, room, 7, 0);
		const ridge = Math.abs(field(c, r, room, 4.2, 200) - 0.5);
		if(ridge < 0.038 && n > 0.22 && n < 0.82) return 'vein';
		if(v === 'hot'){
			if(n > 0.74) return 'hot';
			if(n > 0.50) return 'brick';
			if(n > 0.28) return 'plain';
			return 'dark';
		}
		if(v === 'ash'){
			if(n > 0.64) return 'ash';
			if(n > 0.36) return 'plain';
			return 'dark';
		}
		if(n > 0.78) return 'brick';
		if(n > 0.54) return 'plain';
		if(n > 0.30) return 'ash';
		return 'dark';
	}
	function floorFamily(c, r, room){
		const v = room ? kindVariant(room.kind) : 'stone';
		const n = field(c, r, room, 6.5, 11);
		const wet = !!(room && (room.lavaLake || room._wetFloor));
		const ridge = Math.abs(field(c, r, room, 3.8, 220) - 0.5);
		if(ridge < 0.04) return wet || v === 'hot' ? 'hot' : 'crack';
		if(v === 'hot' || wet){
			if(n > 0.68) return 'hot';
			if(n > 0.42) return 'crack';
			return 'plain';
		}
		if(v === 'ash'){
			if(n > 0.58) return 'ash';
			if(n > 0.32) return 'dirt';
			return 'plain';
		}
		if(n > 0.72) return 'brick';
		if(n > 0.48) return 'plain';
		if(n > 0.26) return 'ash';
		return 'dirt';
	}

	function pickRamp(c, r, edges){
		if(!(edges && edges.airTop) || (edges && edges.airBot)) return null;
		const leftAir = !neighborSolid(c - 1, r);
		const rightAir = !neighborSolid(c + 1, r);
		const leftDown = leftAir && neighborSolid(c - 1, r + 1);
		const rightDown = rightAir && neighborSolid(c + 1, r + 1);
		if(leftDown && !rightAir) return 'rampL';
		if(rightDown && !leftAir) return 'rampR';
		if(leftDown && rightDown) return 'rampM';
		return null;
	}
	function pickFloor(c, r, edges, room){
		if(edges && edges.airTop && edges.airBot) return null;
		if(!(edges && edges.airTop)) return null;
		const ramp = pickRamp(c, r, edges);
		if(ramp) return ramp;
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
		const below = neighborSolid(c, r + 1);
		if(below) return 'beamT';
		if(leftAir && rightAir) return 'beamEnd';
		if(leftAir) return 'beamL';
		if(rightAir) return 'beamR';
		const roll = h2(c, r, 55) % 8;
		if(roll === 0) return 'beamCrack';
		if(roll === 1) return 'beamM2';
		if(roll === 2) return 'beamThin';
		return 'beamM';
	}

	function quadSolid(c0, r0){
		return neighborSolid(c0, r0) && neighborSolid(c0 + 1, r0) &&
			neighborSolid(c0, r0 + 1) && neighborSolid(c0 + 1, r0 + 1);
	}
	function shouldSplitBlock(c0, r0, room){
		const f00 = field(c0, r0, room, 7, 0);
		const f11 = field(c0 + 1, r0 + 1, room, 7, 0);
		if(Math.abs(f00 - f11) > 0.12) return true;
		if(wallFamily(c0, r0, room) !== wallFamily(c0 + 1, r0 + 1, room)) return true;
		return (h2(c0, r0, 41) % 3) !== 0;
	}
	function tileFlip(c, r){
		return !!(h2(c, r, 102) & 1);
	}

	function drawSolidTile(ctx, c, r, sx, sy, edges){
		if(!readySheet()) return false;
		if(typeof tileMap !== 'undefined' && tileMap[r] && tileMap[r][c] !== 0) return true;
		const edged = !!(edges && (edges.airTop || edges.airBot || edges.airLeft || edges.airRight));
		const room = roomAt(c, r);
		if(!edged && ((c & 1) || (r & 1))){
			const c0 = c & ~1, r0 = r & ~1;
			if(quadSolid(c0, r0) && !shouldSplitBlock(c0, r0, roomAt(c0, r0))) return true;
		}
		const canBlock = !edged && !(c & 1) && !(r & 1) && quadSolid(c, r) && !shouldSplitBlock(c, r, room);
		const scale = canBlock ? DRAW : 1;
		const beam = pickBeam(c, r, edges);
		if(beam){
			blitCell(ctx, beam, sx, sy, 1);
			return true;
		}
		const floor = pickFloor(c, r, edges, room);
		if(floor){
			blitCell(ctx, floor, sx, sy, 1, tileFlip(c, r));
			return true;
		}
		const wall = pickWall(c, r, edges, room);
		const flipWall = wall !== 'wallL' && wall !== 'wallR' && wall !== 'wallTop' && wall !== 'wallBot' && tileFlip(c, r);
		blitCell(ctx, wall, sx, sy, scale, flipWall);
		return true;
	}

	const CHUNK = 320;
	const CHUNK_PAD = 40;
	const _chunks = new Map();
	const _platCache = new Map();
	function invalidateTiles(){ _chunks.clear(); _platCache.clear(); _hintRm = null; }
	if(sheet && sheet.addEventListener){
		sheet.addEventListener('load', function(){ _atlas = null; ensureAtlas(); invalidateTiles(); });
	}
	function chunkCanvas(cx, cy){
		const key = cx + ',' + cy;
		let ch = _chunks.get(key);
		if(ch) return ch;
		if(typeof document === 'undefined') return null;
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
		if(!D() || !readySheet() || typeof tileMap === 'undefined' || !tileMap.length) return false;
		const c = cam();
		const vx = Math.round(c.x);
		const vy = Math.round(c.y);
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

	function paintPlatform(g, p, ox, oy){
		const seedY = p.homeY != null ? p.homeY : (p.y | 0);
		assembleBeam(g, ox, oy - 8, p.w, p.kind === 'collapse', seedY);
		if(p.kind === 'pillar' || p.pillar || (p.h && p.h > T + 4)){
			assembleSupportUnder(g, ox, oy - 8, p.w, Math.max(80, p.h || 120));
		} else if((p.kind === 'raft' || p.kind === 'orbit') && p.axis !== 'y'){
			assembleSupportUnder(g, ox, oy - 8, p.w, 80);
		}
	}
	function drawPlatform(ctx, p){
		if(!p || p._gone) return false;
		if(!vis(p.x, p.y, p.w, p.h || T, 40)) return true;
		const c = cam();
		const sx = p.x - c.x, sy = p.y - c.y;
		const live = p.kind === 'move' || p.kind === 'raft' || p.kind === 'orbit' || p.kind === 'collapse';
		if(!live && readySheet() && typeof document !== 'undefined'){
			const key = (p.x|0) + ',' + (p.y|0) + ',' + (p.w|0) + ',' + (p.h||T) + ',' + (p.kind||'s');
			let el = _platCache.get(key);
			if(!el){
				el = document.createElement('canvas');
				el.width = Math.ceil(p.w) + 16;
				el.height = Math.max(DT + 16, (p.h || T) + 24);
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
		if((p.kind === 'collapse' || p.kind === 'pillar') && (p._tick || 0) > 10){
			const pulse = 0.35 + 0.35 * Math.sin((typeof performance !== 'undefined' ? performance.now() : Date.now()) * 0.02);
			ctx.strokeStyle = 'rgba(255,180,60,' + pulse + ')';
			ctx.lineWidth = 2;
			ctx.strokeRect(sx - 1, sy - 1, p.w + 2, (p.h || T) + 2);
		}
		return true;
	}

	function drawStack(ctx, dec){
		const c = cam();
		const pieces = dec.pieces || ['pilBase', 'pilMid', 'pilTop'];
		const hang = !!dec.hang;
		const sc = dec.scale || DRAW;
		const step = T * sc;
		let y = (dec.y || 0) - c.y;
		if(!hang) y -= pieces.length * step;
		for(let i = 0; i < pieces.length; i++){
			blitCell(ctx, pieces[i], dec.x - c.x, y + i * step, sc);
		}
		return true;
	}

	function flickerFlame(ctx, x, y){
		const t = (typeof performance !== 'undefined' ? performance.now() : Date.now()) * 0.008;
		const f = Math.sin(t + x * 0.05) * 2;
		ctx.fillStyle = '#ff8800';
		ctx.beginPath(); ctx.arc(x + 20, y + 8 + f, 5, 0, Math.PI * 2); ctx.fill();
		ctx.fillStyle = '#ffcc44';
		ctx.beginPath(); ctx.arc(x + 20, y + 7 + f, 3, 0, Math.PI * 2); ctx.fill();
	}

	function drawDecor(ctx, dec){
		if(!D() || !dec) return false;
		const c = cam();
		const dw = dec.w || 80, dh = dec.h || 80;
		const sx = dec.x - c.x;
		const sy = (dec.y || 0) - c.y;
		if(sx + Math.max(dw, 240) < -80 || sx > canvas.width + 80 ||
			sy + Math.max(dh, 240) < -80 || sy - 260 > canvas.height + 80) return true;

		if(dec.type === 'lava' || dec.type === 'lavaWell' || dec.type === 'embers') return false;
		if(dec._fluidConsumed) return true;

		if(dec.type === 'fireStack' || dec.type === 'fireSupport') return drawStack(ctx, dec);
		if(dec.type === 'fireBeam'){
			assembleBeam(ctx, sx, sy - (dec.h || T), dec.w || T * 4, !!dec.cracked);
			return true;
		}
		if(dec.type === 'doorway'){
			if(dec.dir === 'left' || dec.dir === 'right'){
				const tiles = Math.max(2, Math.ceil((dec.h || 160) / DT));
				for(let i = 0; i < tiles; i++){
					blitCell(ctx, dec.dir === 'left' ? 'doorL' : 'doorR', sx, sy + i * DT, DRAW);
				}
				blitCell(ctx, 'doorTop', sx, sy - 8, DRAW);
			} else {
				tileAcross(ctx, 'doorTop', 'doorBot', sx, sy, dec.w || 240, DRAW);
			}
			return true;
		}
		if(dec.type === 'torch'){
			blitCell(ctx, 'bracket', sx, sy, DRAW);
			flickerFlame(ctx, sx + 20, sy);
			return true;
		}
		if(dec.type === 'stalactite'){
			blitCell(ctx, 'pilThin', sx, sy, DRAW);
			return true;
		}
		if(dec.type === 'stalagmite'){
			blitCell(ctx, 'pilStub', sx, sy - DT, DRAW);
			return true;
		}
		if(dec.type === 'glowCrack' || dec.type === 'crystal'){
			blitCell(ctx, hash(dec.x|0, dec.y|0) % 2 ? 'glow' : 'glow2', sx, sy - (dec.hang ? 0 : DT), DRAW);
			return true;
		}
		if(dec.type === 'vein'){
			const n = Math.max(1, Math.ceil((dec.h || 80) / DT));
			for(let i = 0; i < n; i++) blitCell(ctx, 'wallVein', sx, sy + i * DT, DRAW);
			return true;
		}
		if(dec.type === 'crack'){
			blitCell(ctx, 'crackDec', sx, sy, DRAW);
			return true;
		}

		const spec = DECOR_PROP[dec.type];
		if(!spec) return false;
		if(spec.stack){
			const h = dec.h || 160;
			assemblePillar(ctx, sx, (dec.hang ? sy + h : sy), h, (D() && D().rooms && D().rooms[dec.roomId] && kindVariant(D().rooms[dec.roomId].kind) === 'hot'));
			return true;
		}
		if(spec.beam){
			assembleBeam(ctx, sx, sy - (dec.hang ? 0 : T), dec.w || 160, false);
			assembleSupportUnder(ctx, sx, sy - (dec.hang ? 0 : T), dec.w || 160, 80);
			return true;
		}
		if(spec.tile){
			blitCell(ctx, spec.tile, sx, dec.hang ? sy : sy - T * (spec.scale || 1), spec.scale || 1);
			return true;
		}
		if(spec.name){
			const scale = spec.scale || 2;
			const hang = spec.hang || dec.hang;
			if(dec.type === 'fireVent' || dec._geyserBase){
				const sink = dec._sink != null ? dec._sink : 36;
				blitCell(ctx, 'vent', sx, sy - DT + sink, DRAW);
				return true;
			}
			const dest = PROP * scale;
			const sink = dec._sink != null ? dec._sink : 0;
			blitProp(ctx, spec.name, sx, hang ? sy : sy - dest + sink, scale);
			return true;
		}
		return false;
	}

	function drawLivePlatforms(ctx){
		const d = D();
		if(!d || !d.platforms) return;
		for(let i = 0; i < d.platforms.length; i++){
			const p = d.platforms[i];
			if(!p || p._gone) continue;
			if(p.kind === 'move' || p.kind === 'raft' || p.kind === 'orbit'){
				drawPlatform(ctx, p);
			} else if((p.kind === 'collapse' || p.kind === 'pillar') && !p._stamped){
				drawPlatform(ctx, p);
			}
		}
	}

	function handlesDecor(dec){
		if(!D()) return false;
		if(!dec) return false;
		if(dec._fireArt) return true;
		if(DECOR_PROP[dec.type]) return true;
		return dec.type === 'torch' || dec.type === 'stalactite' || dec.type === 'stalagmite' ||
			dec.type === 'glowCrack' || dec.type === 'crystal' || dec.type === 'vein' ||
			dec.type === 'doorway' || dec.type === 'rubble' || dec.type === 'column' ||
			dec.type === 'pipe' || dec.type === 'crack' || dec.type === 'fireStack' ||
			dec.type === 'fireBeam' || dec.type === 'fireSupport';
	}

	global.FireArt = {
		drawBackdrop: drawBackdrop,
		drawRoomDress: drawRoomDress,
		drawSolidTile: drawSolidTile,
		drawTiles: drawTiles,
		drawPlatform: drawPlatform,
		drawLivePlatforms: drawLivePlatforms,
		drawDecor: drawDecor,
		handlesDecor: handlesDecor,
		ready: function(){ return !!D() && readySheet(); },
		isFire: function(){ return !!D(); },
		invalidateTiles: invalidateTiles,
	};
})(typeof window !== 'undefined' ? window : globalThis);
