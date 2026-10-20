/* Western approach (I6–J6) and the King's North Road (J6–J5). */
(function (global) {
	'use strict';

	const ASPECT = {
		wagon: 784 / 512,
		cart: 755 / 671,
		wheel: 913 / 898,
		fence: 1120 / 405,
		pathdirt: 1280 / 246,
		pathstone: 1280 / 250,
		bush: 713 / 521,
		sign: 383 / 944,
		hay: 807 / 519,
		pine: 339 / 1071,
		shrine: 465 / 686,
		tent: 694 / 409,
		tower: 379 / 1087,
		gate: 1195 / 689,
		bridge: 1050 / 625,
		crates: 526 / 509,
		bannerpole: 369 / 1098,
		sacks: 691 / 557
	};
	const FILES = {
		wagon: 'road-wagon', cart: 'road-cart', wheel: 'road-wheel', fence: 'road-fence',
		pathdirt: 'road-path-dirt', pathstone: 'road-path-stone', bush: 'road-bush',
		sign: 'road-sign', hay: 'road-hay', pine: 'road-pine', shrine: 'road-shrine',
		tent: 'road-tent', tower: 'road-tower', gate: 'road-gate', bridge: 'road-bridge',
		crates: 'road-crates', bannerpole: 'road-banner', sacks: 'road-sacks'
	};
	const imgs = {};
	Object.keys(FILES).forEach(name => {
		const img = new Image();
		img.src = 'images/props/' + FILES[name] + '.png?v=2';
		imgs[name] = img;
	});

	const props = [];
	const loots = [];
	let joints = [];
	let api = null;
	/* Mill race. Floor sits on a tile boundary so the dungeon fluid can pool on it. */
	const MILL_C0 = 222;
	const MILL_C1 = 266;
	const MILL_FLOOR_ROW = 78;
	const MILL_DEPTH = 200;
	/* North road river, in tiles from the start of J6–J5. The deck meets both banks. */
	const RIVER_L0 = 508;
	const RIVER_L1 = 616;
	const GAP_L0 = 560;
	const GAP_L1 = 568;
	const RIVER_FLOOR_ROW = 82;
	const RIVER_DEPTH = 360;
	let northLift = null;
	let fluidSeeded = false;

	function northOrigin() {
		return ((api && api.SEG) ? api.SEG : 800) * 2;
	}
	function buildNorthLift() {
		const h = new Array(800).fill(0);
		const pin = new Array(800).fill(false);
		const pinRange = (a, b) => { for (let i = a; i < b && i < 800; i++) if (i >= 0) pin[i] = true; };
		const setH = (a, b, v) => { for (let i = a; i < b && i < 800; i++) if (i >= 0 && !pin[i]) h[i] = v; };
		const ramp = (a, b, v0, v1) => {
			const n = Math.max(1, b - a);
			for (let i = a; i < b && i < 800; i++) {
				if (i < 0 || pin[i]) continue;
				h[i] = v0 + (v1 - v0) * ((i - a) / n);
			}
		};
		pinRange(0, 72);
		pinRange(100, 148);
		pinRange(468, 512);
		pinRange(500, 624);
		pinRange(790, 800);
		ramp(72, 100, 0, 2);
		ramp(148, 196, 0, 2);
		setH(196, 214, 2);
		ramp(214, 236, 2, 5);
		setH(236, 262, 5);
		ramp(262, 292, 5, 2);
		setH(292, 318, 2);
		ramp(318, 336, 2, 4);
		setH(336, 368, 4);
		ramp(368, 408, 4, 1);
		setH(408, 442, 1);
		ramp(442, 468, 1, 2);
		ramp(624, 658, 0, 2);
		setH(658, 704, 2);
		ramp(704, 742, 2, 1);
		setH(742, 772, 1);
		ramp(772, 790, 1, 0);
		const clampStep = () => {
			for (let i = 1; i < 800; i++) {
				if (pin[i]) continue;
				if (h[i] > h[i - 1] + 1) h[i] = h[i - 1] + 1;
				if (h[i] < h[i - 1] - 1) h[i] = h[i - 1] - 1;
			}
			for (let i = 798; i >= 0; i--) {
				if (pin[i]) continue;
				if (h[i] > h[i + 1] + 1) h[i] = h[i + 1] + 1;
				if (h[i] < h[i + 1] - 1) h[i] = h[i + 1] - 1;
			}
		};
		for (let pass = 0; pass < 6; pass++) clampStep();
		for (let i = 0; i < 800; i++) h[i] = Math.max(0, Math.round(h[i]));
		for (let pass = 0; pass < 4; pass++) clampStep();
		return h;
	}
	function liftAt(col) {
		if (!northLift) return 0;
		const local = col - northOrigin();
		if (local < 0 || local >= 800) return 0;
		return northLift[local] || 0;
	}
	function footY(col) {
		const TS = api ? api.TS : 40;
		const ground = api ? api.GROUND : 72;
		return (ground - liftAt(col)) * TS;
	}

	function hash(x, y) {
		let n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
		n = Math.imul(n ^ (n >>> 13), 1274126177);
		return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
	}
	function pick(x, y, list) {
		const t = hash(Math.floor(x / 5), Math.floor(y / 4));
		return list[Math.min(list.length - 1, Math.floor(t * list.length))];
	}

	function propLayer(name) {
		if (name.indexOf('path') === 0) return 0;
		if (name === 'fence' || name === 'bush' || name === 'hay' || name === 'pine') return 1;
		return 2;
	}
	function prop(name, tileX, groundY, height, sink) {
		const h = height;
		const w = Math.round(h * ASPECT[name]);
		props.push({ name, x: tileX * api.TS, y: groundY - h + (sink || 0), w, h, layer: propLayer(name) });
	}
	function propAt(name, pixelX, groundY, height, sink) {
		const h = height;
		const w = Math.round(h * ASPECT[name]);
		props.push({ name, x: pixelX, y: groundY - h + (sink || 0), w, h, layer: propLayer(name) });
		return w;
	}
	function pathRun(name, x0, x1, groundY, height) {
		const h = height;
		const w = Math.round(h * ASPECT[name]);
		const step = Math.max(48, w - 80);
		for (let x = x0; x < x1; x += step) {
			props.push({ name, x, y: groundY - h, w, h, layer: 0 });
		}
	}

	function tree(tileX, groundY, height) {
		if (!global.EmberfallProps || !global.EmberfallProps.size) return;
		const s = global.EmberfallProps.size('oaktree', height);
		api.exteriorProps.push({ name: 'oaktree', x: tileX * api.TS, y: groundY - s.h, w: s.w, h: s.h });
	}
	function banner(tileX, row) {
		if (!global.EmberfallProps || !global.EmberfallProps.size) return;
		const s = global.EmberfallProps.size('banner', 130);
		api.exteriorProps.push({ name: 'banner', x: tileX * api.TS, y: row * api.TS, w: s.w, h: s.h });
	}

	function bed(x0, x1, surface) {
		const { T, GROUND, ROWS, set } = api;
		const cob = [T.COBBLE, T.COB_A, T.COB_B, T.COB_C, T.COB_D];
		const dirt = [T.DIRT, T.DIRT_C, T.DIRT_D, T.DIRT_M, T.DIRT_P, T.DIRT_L];
		for (let x = x0; x < x1; x++) {
			let top = T.GRASS;
			if (surface === 'dirt') top = pick(x, GROUND, dirt);
			else if (surface === 'road') top = pick(x, GROUND, cob);
			else if (surface === 'stone') top = pick(x, GROUND, [T.STONE, T.ST_A, T.ST_B, T.ST_C]);
			else if (surface === 'field') top = (x % 7 === 0) ? T.GRASS_D : pick(x, GROUND, dirt);
			else if (surface === 'cold') top = hash(x, 3) > 0.55 ? T.STONE_W : T.GRASS_B;
			set(api.map, x, GROUND, top);
			set(api.map, x, GROUND + 1, pick(x, GROUND + 1, dirt));
			for (let y = GROUND + 2; y < ROWS; y++) set(api.map, x, y, pick(x, y, dirt));
		}
	}

	function fences(x0, x1, groundY) {
		for (let x = x0; x < x1 - 6; x += 9) prop('fence', x, groundY, 128, 4);
	}
	function bushes(x0, x1, groundY) {
		for (let x = x0; x < x1; x += 13) {
			const h = 108 + Math.floor(hash(x, 4) * 28);
			prop('bush', x, groundY, h, 10);
		}
	}
	function hayLine(x0, x1, groundY) {
		for (let x = x0; x < x1; x += 15) prop('hay', x, groundY, 118 + (x % 4) * 10, 8);
	}
	function farmstead(tileX, gy, groundY, id, label) {
		const { T, house } = api;
		house(api.map, tileX, gy, 14, 10, T.PLASTER, T.WIN_WARM, T.DOOR_W, T.ROOF_T, {
			timber: T.TIMBER, flower: true, chimney: true, id: id, label: label, kind: 'inn'
		});
		house(api.map, tileX + 16, gy, 11, 8, T.WOOD, T.WIN_TIMBER, T.DOOR_W2, T.ROOF_T2, {
			timber: T.TIMBER_D, foundation: T.WOOD, id: id + '-barn', label: label + ' Barn', kind: 'shop'
		});
		prop('sacks', tileX - 8, groundY, 120, 6);
		prop('crates', tileX + 29, groundY, 110, 6);
	}

	function paintApproach(gy) {
		const { T, TS, SEG, GROUND, set, fill, house } = api;
		const gY = gy * TS;
		bed(0, SEG, 'grass');
		bed(8, 200, 'field');
		bed(275, 385, 'field');
		bed(515, 650, 'field');
		fences(8, 200, gY);
		fences(275, 385, gY);
		fences(515, 650, gY);
		hayLine(12, 78, gY);
		hayLine(108, 190, gY);
		hayLine(278, 308, gY);
		hayLine(348, 382, gY);
		hayLine(518, 640, gY);
		bushes(8, 190, gY);
		bushes(270, 480, gY);
		bushes(520, 700, gY);
		for (let x = 18; x < 190; x += 22) tree(x, gY, 340 + (x % 3) * 24);
		for (let x = 360; x < 500; x += 28) tree(x, gY, 300 + (x % 4) * 18);
		for (let x = 650; x < 720; x += 28) tree(x, gY, 280);
		prop('sign', 28, gY, 220, 6);
		prop('hay', 58, gY, 150, 8);
		prop('hay', 132, gY, 130, 8);
		prop('sign', 168, gY, 200, 6);

		house(api.map, 86, gy, 16, 10, T.PLASTER, T.WIN_WARM, T.DOOR_W, T.ROOF_T, {
			timber: T.TIMBER, flower: true, id: 'approach-farm', label: 'West Farm', kind: 'inn'
		});
		prop('crates', 78, gY, 130, 6);
		house(api.map, 200, gy, 18, 12, T.WOOD, T.WIN_TIMBER, T.DOOR_W, T.ROOF_T2, {
			timber: T.TIMBER_D, foundation: T.STONE, id: 'river-mill', label: 'River Mill', kind: 'shop'
		});
		for (let x = MILL_C0; x < MILL_C1; x++) {
			set(api.map, x, GROUND, T.DIRT);
			set(api.map, x, GROUND + 1, T.DIRT);
			set(api.map, x, GROUND + 2, T.DIRT);
		}
		prop('wheel', 234, gY, 340, 48);
		prop('sacks', 252, gY, 150, 6);
		fill(api.map, 258, gy - 2, 8, 2, T.WOOD);
		farmstead(312, gy, gY, 'mill-field', 'Mill Field');
		farmstead(500, gy, gY, 'gate-field', 'Gate Field');

		house(api.map, 390, gy, 22, 12, T.PLASTER_S, T.WIN_WARM, T.DOOR_W, T.ROOF_R, {
			timber: T.HALF_A, chimney: true, flower: true, id: 'waystation', label: 'Roadside Waystation', kind: 'inn'
		});
		prop('crates', 414, gY, 140, 6);
		prop('cart', 430, gY, 170, 4);
		prop('wagon', 490, gY, 220, 4);
		prop('cart', 560, gY, 160, 4);
		prop('hay', 600, gY, 140, 8);
		prop('sign', 640, gY, 230, 6);
		prop('bannerpole', 660, gY, 300, 4);

		house(api.map, 690, gy, 12, 8, T.STONE_M, T.WIN_DARK, T.DOOR_I, T.ROOF_S, {
			foundation: T.STONE_D, timber: T.STONE_T, doorOff: 5, id: 'checkpoint', label: 'Gate Checkpoint', kind: 'shop'
		});
		/* Open arch. The road keeps going through it into the city. */
		const gateH = 520;
		const gateW = Math.round(gateH * ASPECT.gate);
		propAt('gate', SEG * TS - gateW - 40, gY, gateH, 8);

		loots.push({
			id: 'wagon-note', x: 500 * TS, w: 120, text: 'A torn note under the axle: "They came out of the trees west of the mill. Do not camp on the open road."',
			item: 'ember_rations'
		});
		loots.push({
			id: 'river-cache', x: 268 * TS, w: 70, text: 'A crate tucked in the reeds. Someone meant to come back for it.',
			item: 'ember_herb'
		});
		loots.push({
			id: 'farm-chest', x: 96 * TS, w: 80, text: 'Under the loose board: a wrapped bundle the farmer pretends not to see.',
			item: 'ember_bandage'
		});
	}

	function raiseNorth(x0) {
		const { T, GROUND, ROWS, set } = api;
		const dirt = [T.DIRT, T.DIRT_C, T.DIRT_D, T.DIRT_M, T.DIRT_P, T.DIRT_L];
		for (let local = 0; local < 800; local++) {
			const lift = northLift[local] || 0;
			if (lift <= 0) continue;
			const x = x0 + local;
			const surface = GROUND - lift;
			let top = T.GRASS;
			if (local >= 700) top = hash(x, 3) > 0.55 ? T.STONE_W : T.GRASS_B;
			else if (local % 11 === 0) top = T.GRASS_D;
			set(api.map, x, surface, top);
			for (let y = surface + 1; y < ROWS; y++) set(api.map, x, y, pick(x, y, dirt));
		}
	}
	function carveRiver(x0) {
		const { T, GROUND, ROWS, set } = api;
		const dirt = [T.DIRT, T.DIRT_C, T.DIRT_D, T.DIRT_M, T.DIRT_P, T.DIRT_L];
		const c0 = x0 + RIVER_L0;
		const c1 = x0 + RIVER_L1;
		const g0 = x0 + GAP_L0;
		const g1 = x0 + GAP_L1;
		for (let x = c0; x < c1; x++) {
			for (let y = GROUND - 4; y < RIVER_FLOOR_ROW; y++) set(api.map, x, y, 0);
			set(api.map, x, RIVER_FLOOR_ROW, T.DIRT_D);
			for (let y = RIVER_FLOOR_ROW + 1; y < ROWS; y++) set(api.map, x, y, pick(x, y, dirt));
		}
		set(api.map, c0 - 1, GROUND, T.STONE_D);
		set(api.map, c0 - 1, GROUND + 1, T.STONE);
		set(api.map, c1, GROUND, T.STONE_D);
		set(api.map, c1, GROUND + 1, T.STONE);
		for (let x = c0; x < c1; x++) {
			if (x >= g0 && x < g1) continue;
			set(api.map, x, GROUND, T.WOOD);
			set(api.map, x, GROUND + 1, T.TIMBER);
			if ((x - c0) % 6 === 0) {
				set(api.map, x, GROUND - 1, T.TIMBER);
				set(api.map, x, GROUND - 2, T.WOOD_D);
			}
			if ((x - c0) % 5 === 2) {
				set(api.map, x, GROUND + 2, T.TIMBER_D);
				set(api.map, x, GROUND + 3, T.TIMBER_D);
			}
		}
		set(api.map, g0 - 1, GROUND, T.WOOD_D);
		set(api.map, g1, GROUND, T.WOOD_D);
		for (let x = c0 + 10; x < c1 - 6; x += 12) {
			if (x + 1 >= g0 - 1 && x < g1 + 1) continue;
			for (let col = x; col < x + 2; col++) {
				for (let y = GROUND + 2; y <= RIVER_FLOOR_ROW; y++) {
					set(api.map, col, y, (y % 3 === 0) ? T.STONE_D : T.STONE_M);
				}
			}
		}
	}

	function paintNorth(gy) {
		const { T, TS, SEG, GROUND, set, house } = api;
		const x0 = SEG * 2;
		northLift = buildNorthLift();
		bed(x0 + 1, x0 + SEG, 'grass');
		bed(x0 + 40, x0 + 290, 'field');
		bed(x0 + 400, x0 + 500, 'field');
		bed(x0 + 700, x0 + SEG, 'cold');
		raiseNorth(x0);
		carveRiver(x0);
		const on = (x0a, x1) => {
			for (let x = x0a; x < x1 - 6; x += 9) {
				if (x >= x0 + RIVER_L0 && x < x0 + RIVER_L1) continue;
				prop('fence', x, footY(x), 128, 4);
			}
		};
		on(x0 + 40, x0 + 290);
		on(x0 + 400, x0 + 500);
		for (let x = x0 + 48; x < x0 + 100; x += 15) prop('hay', x, footY(x), 118, 8);
		for (let x = x0 + 160; x < x0 + 280; x += 15) prop('hay', x, footY(x), 118, 8);
		for (let x = x0 + 408; x < x0 + 460; x += 15) prop('hay', x, footY(x), 118, 8);
		for (let x = x0 + 20; x < x0 + 500; x += 13) {
			if (x >= x0 + RIVER_L0) break;
			prop('bush', x, footY(x), 108 + Math.floor(hash(x, 4) * 28), 10);
		}
		for (let x = x0 + 630; x < x0 + 760; x += 13) prop('bush', x, footY(x), 108 + Math.floor(hash(x, 4) * 28), 10);
		for (let x = x0 + 16; x < x0 + 80; x += 24) tree(x, footY(x), 300);
		for (let x = x0 + 360; x < x0 + 500; x += 18) prop('pine', x, footY(x), 400 + (x % 5) * 16, 6);
		for (let x = x0 + 630; x < x0 + 700; x += 18) prop('pine', x, footY(x), 360 + (x % 5) * 16, 6);
		for (let x = x0 + 710; x < x0 + SEG - 10; x += 28) {
			if (hash(x, 9) > 0.35) prop('pine', x, footY(x), 260 + Math.floor(hash(x, 2) * 80), 6);
		}

		prop('bannerpole', x0 + 18, footY(x0 + 18), 300, 4);
		prop('bannerpole', x0 + 36, footY(x0 + 36), 280, 4);
		prop('sign', x0 + 70, footY(x0 + 70), 220, 6);
		prop('hay', x0 + 180, footY(x0 + 180), 140, 8);
		prop('hay', x0 + 250, footY(x0 + 250), 120, 8);
		farmstead(x0 + 108, gy, gy * TS, 'north-field', 'North Field');

		const towerH = 680;
		const towerW = Math.round(towerH * ASPECT.tower);
		propAt('tower', (x0 + 300) * TS - towerW / 2, footY(x0 + 300), towerH, 4);
		prop('crates', x0 + 318, footY(x0 + 318), 120, 6);

		house(api.map, x0 + 470, gy, 16, 9, T.PLASTER_D, T.WIN_DARK, T.DOOR_W2, T.ROOF_T, {
			timber: T.TIMBER, id: 'abandoned-farm', label: 'Abandoned Farmstead', kind: 'inn'
		});
		house(api.map, x0 + 490, gy, 12, 8, T.WOOD_D, T.WIN_TIMBER, T.DOOR_W, T.ROOF_T2, {
			timber: T.TIMBER, foundation: T.WOOD, id: 'abandoned-barn', label: 'Abandoned Barn', kind: 'shop'
		});
		prop('hay', x0 + 456, footY(x0 + 456), 110, 8);

		prop('tent', x0 + 636, footY(x0 + 636), 210, 8);
		prop('crates', x0 + 658, footY(x0 + 658), 120, 6);
		prop('wagon', x0 + 678, footY(x0 + 678), 190, 4);

		prop('shrine', x0 + 740, footY(x0 + 740), 280, 10);
		prop('sign', x0 + 770, footY(x0 + 770), 200, 6);

		loots.push({
			id: 'bridge-cache', x: (x0 + RIVER_L0 - 6) * TS, w: 90, text: 'Tucked in the dry stones of the abutment: a traveler’s stash.',
			item: 'ember_stone'
		});
		loots.push({
			id: 'farmstead-note', x: (x0 + 478) * TS, w: 80, text: 'A letter left on the table: "The northern wind came early. We are not waiting for the third night."',
			item: 'ember_rations'
		});
	}

	function paint(passed) {
		api = passed;
		props.length = 0;
		loots.length = 0;
		fluidSeeded = false;
		const gy = api.GROUND;
		paintApproach(gy);
		paintNorth(gy);
		const seam = api.SEG * api.TS;
		const north = api.SEG * 2 * api.TS;
		joints = [
			{ x: seam - 80, w: 200, to: north + 48 * api.TS },
			{ x: north + 40 * api.TS, w: 180, to: seam + 80 }
		];
	}

	function millSpan() {
		const TS = api ? api.TS : 40;
		return {
			x: MILL_C0 * TS,
			w: (MILL_C1 - MILL_C0) * TS,
			floor: MILL_FLOOR_ROW * TS,
			depth: MILL_DEPTH
		};
	}
	function riverBox() {
		const TS = api ? api.TS : 40;
		const origin = northOrigin();
		const ground = (api ? api.GROUND : 72) * TS;
		const x = (origin + RIVER_L0) * TS;
		const gapX = (origin + GAP_L0) * TS;
		const gapW = (GAP_L1 - GAP_L0) * TS;
		return {
			x: x,
			w: (RIVER_L1 - RIVER_L0) * TS,
			floor: RIVER_FLOOR_ROW * TS,
			depth: RIVER_DEPTH,
			deck: ground - 1,
			gapX: gapX,
			gapW: gapW
		};
	}
	function overlaps(x, w, boxX, boxW) {
		return x + (w || 0) > boxX && x < boxX + boxW;
	}
	function onDeck(x, w) {
		const r = riverBox();
		const right = x + (w || 0);
		if (!overlaps(x, w, r.x, r.w)) return false;
		if (right <= r.gapX || x >= r.gapX + r.gapW) return true;
		if (x >= r.gapX && right <= r.gapX + r.gapW) return false;
		const deck = Math.max(0, Math.min(right, r.gapX) - Math.max(x, r.x))
			+ Math.max(0, Math.min(right, r.x + r.w) - Math.max(x, r.gapX + r.gapW));
		return deck >= (w || 1) * 0.5;
	}
	function inWaterColumn(x, w) {
		const s = millSpan();
		if (overlaps(x, w, s.x, s.w)) return true;
		const r = riverBox();
		return overlaps(x, w, r.x, r.w);
	}
	function waterFloor(x, w) {
		const s = millSpan();
		if (overlaps(x, w, s.x, s.w)) return s.floor;
		const r = riverBox();
		if (!overlaps(x, w, r.x, r.w)) return null;
		return onDeck(x, w) ? r.deck : r.floor;
	}
	function bedSolid(col, row) {
		if (col >= MILL_C0 && col < MILL_C1 && row >= MILL_FLOOR_ROW) return true;
		const origin = northOrigin();
		return col >= origin + RIVER_L0 && col < origin + RIVER_L1 && row >= RIVER_FLOOR_ROW;
	}
	function groundPieces(groundY, worldW) {
		const TS = api ? api.TS : 40;
		const s = millSpan();
		const r = riverBox();
		const cuts = [{ x: s.x, w: s.w }, { x: r.x, w: r.w }].sort((a, b) => a.x - b.x);
		const pieces = [];
		let cursor = 0;
		for (let i = 0; i < cuts.length; i++) {
			const cut = cuts[i];
			if (cut.x > cursor) pieces.push({ x: cursor, y: groundY, w: cut.x - cursor, h: 200 });
			cursor = cut.x + cut.w;
		}
		if (cursor < worldW) pieces.push({ x: cursor, y: groundY, w: Math.max(40, worldW - cursor), h: 200 });
		pieces.push({ x: s.x, y: s.floor, w: s.w, h: 120 });
		pieces.push({ x: r.x, y: r.floor, w: r.w, h: 160 });
		const deckH = 40;
		if (r.gapX > r.x) pieces.push({ x: r.x, y: r.deck, w: r.gapX - r.x, h: deckH, roadStep: true });
		const deckRight = r.gapX + r.gapW;
		if (r.x + r.w > deckRight) pieces.push({ x: deckRight, y: r.deck, w: r.x + r.w - deckRight, h: deckH, roadStep: true });
		if (northLift) {
			const origin = northOrigin();
			const row = Math.round(groundY / TS);
			let i = 0;
			while (i < 800) {
				const lift = northLift[i] || 0;
				if (lift <= 0) { i++; continue; }
				let j = i + 1;
				while (j < 800 && (northLift[j] || 0) === lift) j++;
				pieces.push({
					x: (origin + i) * TS,
					y: (row - lift) * TS,
					w: (j - i) * TS,
					h: 40,
					roadStep: true
				});
				i = j;
			}
		}
		return pieces;
	}
	function structureClip() {
		const TS = api ? api.TS : 40;
		const origin = northOrigin();
		const ground = api ? api.GROUND : 72;
		return {
			x: (origin + RIVER_L0) * TS,
			y: (ground - 4) * TS,
			w: (RIVER_L1 - RIVER_L0) * TS,
			h: (RIVER_FLOOR_ROW - ground + 6) * TS
		};
	}
	function ensureFluid() {
		if (fluidSeeded) return;
		const Fluid = global.DungeonFluid;
		if (!Fluid || !Fluid.setBandHeight) return;
		if (!Fluid.streams) Fluid.streams = { lava: [], water: [] };
		const s = millSpan();
		const r = riverBox();
		Fluid.setBandHeight('water', s.x, s.w, s.floor, s.depth);
		Fluid.setBandHeight('water', r.x, r.w, r.floor, r.depth);
		const keys = Fluid.keys || [];
		for (let i = 0; i < keys.length; i++) {
			const c = keys[i];
			if (!c) continue;
			c.visWater = c.water;
			c.visLava = c.lava;
		}
		Fluid.ready = true;
		fluidSeeded = true;
	}

	function draw(ctx, camera, layer) {
		if (!api) return;
		const gy = api.GROUND * api.TS;
		for (let i = 0; i < props.length; i++) {
			const p = props[i];
			const pl = p.layer || 0;
			if (layer != null && pl !== layer) continue;
			const img = imgs[p.name];
			if (!img || !img.complete || !img.naturalWidth) continue;
			const dx = p.x - camera.x;
			const dy = p.y - camera.y;
			if (dx + p.w < -80 || dx > ctx.canvas.width + 80) continue;
			if ((p.layer || 0) === 0) {
				ctx.drawImage(img, dx, dy, p.w, p.h);
			} else {
				withDepth(ctx, camera, p.x, p.y, p.w, p.h, function () {
					ctx.drawImage(img, dx, dy, p.w, p.h);
				});
			}
		}
		if (layer === 0) return;
		if (layer !== 2) return;
		const pulse = 0.35 + Math.sin(Date.now() / 180) * 0.2;
		for (let i = 0; i < joints.length; i++) {
			const j = joints[i];
			const sx = j.x - camera.x + j.w * 0.5;
			const sy = gy - camera.y;
			if (sx < -120 || sx > ctx.canvas.width + 120) continue;
			const g = ctx.createRadialGradient(sx, sy, 6, sx, sy, 78);
			g.addColorStop(0, 'rgba(255,214,64,' + (0.55 + pulse) + ')');
			g.addColorStop(1, 'rgba(255,214,64,0)');
			ctx.fillStyle = g;
			ctx.fillRect(sx - 90, sy - 80, 180, 100);
			ctx.fillStyle = '#ffe9a0';
			ctx.font = 'bold 14px Georgia';
			ctx.textAlign = 'center';
			ctx.fillText('L', sx, sy - 18);
		}
		if (camera.x > api.SEG * 2 * api.TS + 500 * api.TS) {
			ctx.strokeStyle = 'rgba(220,230,240,0.35)';
			ctx.lineWidth = 1;
			const t = Date.now() / 400;
			for (let i = 0; i < 5; i++) {
				const y = 80 + i * 36;
				const x = ((t * 40 + i * 90) % (ctx.canvas.width + 80)) - 40;
				ctx.beginPath();
				ctx.moveTo(x, y);
				ctx.lineTo(x + 28, y - 4);
				ctx.stroke();
			}
		}
	}

	let flip = null;
	const FLIP_DUR = 1200;
	const FLIP_TURN = 0.42;
	const FLIP_WALK = 150;

	function flipT() {
		if (!flip) return 0;
		return Math.min(1, (performance.now() - flip.start) / flip.dur);
	}
	function depthK() {
		const t = flipT();
		if (!flip) return 0;
		if (t < 0.45) return t / 0.45;
		return Math.max(0, 1 - (t - 0.45) / 0.55);
	}
	function withDepth(ctx, camera, x, y, w, h, draw) {
		const k = depthK();
		if (k < 0.02) { draw(); return; }
		const ax = x + w * 0.5 - camera.x;
		const ay = y + h - camera.y;
		ctx.save();
		ctx.globalAlpha *= (1 - k * 0.34);
		ctx.translate(ax, ay - k * 150);
		ctx.scale(1 - k * 0.62, 1 - k * 0.62);
		ctx.translate(-ax, -ay);
		draw();
		ctx.restore();
	}
	function turnHaze() {
		if (!flip) return 0;
		const d = Math.abs(flipT() - FLIP_TURN);
		if (d > 0.14) return 0;
		return (1 - d / 0.14) * 0.5;
	}
	function playerTurn() {
		if (!flip) return null;
		const t = flipT();
		let scale;
		let facing;
		let walk = false;
		if (t < FLIP_TURN) {
			scale = Math.cos((t / FLIP_TURN) * Math.PI * 0.5);
			facing = flip.fromFacing;
		} else {
			const u = (t - FLIP_TURN) / (1 - FLIP_TURN);
			scale = Math.sin(Math.min(1, u / 0.28) * Math.PI * 0.5);
			facing = flip.toFacing;
			walk = u < 0.92;
		}
		return { scale: Math.max(0.04, scale), facing: facing, walk: walk };
	}

	const BG_NAMES = ['bg-far-farm', 'bg-mid-farm', 'bg-near-farm', 'bg-clouds', 'bg-far-north', 'bg-mid-north', 'bg-near-north'];
	const bgImgs = {};
	BG_NAMES.forEach(name => {
		const img = new Image();
		img.src = 'images/props/' + name + '.png?v=2';
		bgImgs[name] = img;
	});

	function blitStrip(ctx, img, scroll, y, drawW, drawH, viewW) {
		const dw = Math.round(drawW);
		const dh = Math.round(drawH);
		const y0 = Math.round(y);
		let x = -((scroll % dw) + dw) % dw;
		while (x < viewW + 1) {
			ctx.drawImage(img, Math.round(x), y0, dw + 1, dh);
			x += dw;
		}
	}
	function drawBackdrop(ctx, camera, canvas, groundY) {
		if (!api) return;
		const north = Math.max(0, Math.min(1, (camera.x - api.SEG * 2 * api.TS) / (api.SEG * api.TS)));
		/* Pinned to the screen. Climbing and jumping move the ground, not these layers. */
		const rest = canvas.height * 0.5 + 56;
		const bands = [
			{ farm: 'bg-far-farm', cold: 'bg-far-north', parallax: 0.12, h: rest * 0.58, lift: rest * 0.08, alpha: 0.82 },
			{ farm: 'bg-mid-farm', cold: 'bg-mid-north', parallax: 0.28, h: rest * 0.44, lift: rest * 0.03, alpha: 0.92 },
			{ farm: 'bg-near-farm', cold: 'bg-near-north', parallax: 0.46, h: rest * 0.3, lift: 0, alpha: 1 }
		];
		const smooth = ctx.imageSmoothingEnabled;
		ctx.imageSmoothingEnabled = true;
		for (let i = 0; i < bands.length; i++) {
			const band = bands[i];
			const paint = (img, fade) => {
				if (!img || !img.complete || !img.naturalWidth || fade < 0.02) return;
				const drawH = band.h;
				const drawW = Math.max(drawH, drawH * (img.naturalWidth / img.naturalHeight));
				ctx.save();
				ctx.globalAlpha *= fade * band.alpha;
				blitStrip(ctx, img, camera.x * band.parallax, rest - drawH - band.lift, drawW, drawH, canvas.width);
				ctx.restore();
			};
			paint(bgImgs[band.farm], 1 - north);
			paint(bgImgs[band.cold], north);
		}
		const clouds = bgImgs['bg-clouds'];
		if (clouds && clouds.complete && clouds.naturalWidth) {
			const inFarm = camera.x < api.SEG * api.TS;
			const drawH = canvas.height * 0.2;
			const drawW = drawH * (clouds.naturalWidth / clouds.naturalHeight);
			ctx.save();
			ctx.globalAlpha *= 0.88;
			if (inFarm) {
				const step = drawW * 2.8;
				const scroll = camera.x * 0.04;
				const dw = Math.round(drawW);
				const dh = Math.round(drawH);
				const y0 = Math.round(canvas.height * 0.02);
				let x = -((scroll % step) + step) % step;
				while (x < canvas.width + 1) {
					ctx.drawImage(clouds, Math.round(x), y0, dw, dh);
					x += step;
				}
			} else {
				blitStrip(ctx, clouds, camera.x * 0.04, canvas.height * 0.02, drawW, drawH, canvas.width);
			}
			ctx.restore();
		}
		const haze = ctx.createLinearGradient(0, rest - 80, 0, rest + 6);
		haze.addColorStop(0, 'rgba(214,206,180,0)');
		haze.addColorStop(1, north > 0.4 ? 'rgba(198,210,216,0.28)' : 'rgba(214,206,180,0.18)');
		ctx.fillStyle = haze;
		ctx.fillRect(0, rest - 80, canvas.width, 88);
		ctx.imageSmoothingEnabled = smooth;
	}

	function tryPerspective(player) {
		if (!player) return false;
		if (flip) return true;
		const feet = player.y + player.h;
		if (!api || Math.abs(feet - api.GROUND * api.TS) > 36) return false;
		for (let i = 0; i < joints.length; i++) {
			const j = joints[i];
			if (player.x + player.w > j.x && player.x < j.x + j.w) {
				flip = {
					from: player.x,
					to: j.to,
					fromFacing: player.facing || 1,
					toFacing: j.to >= player.x ? 1 : -1,
					start: performance.now(),
					dur: FLIP_DUR
				};
				player.vx = 0;
				player.vy = 0;
				return true;
			}
		}
		return false;
	}

	function holdPlayer(player) {
		if (!flip || !player) return;
		const t = flipT();
		if (t < FLIP_TURN) {
			player.x = flip.from;
			player.facing = flip.fromFacing;
		} else {
			const u = Math.min(1, (t - FLIP_TURN) / (1 - FLIP_TURN));
			const ease = u * u * (3 - 2 * u);
			player.x = flip.to + ease * FLIP_WALK * flip.toFacing;
			player.facing = flip.toFacing;
		}
		player.vx = 0;
		player.vy = 0;
		if (t >= 1) flip = null;
	}

	function flipScale() {
		return null;
	}

	function tryLoot(player) {
		if (!player || !api) return false;
		const feet = player.y + player.h;
		if (Math.abs(feet - api.GROUND * api.TS) > 40) return false;
		for (let i = 0; i < loots.length; i++) {
			const loot = loots[i];
			if (player.x + player.w < loot.x || player.x > loot.x + loot.w) continue;
			const key = 'magicBattle_road_' + loot.id;
			if (global.localStorage && localStorage.getItem(key)) {
				if (typeof startDialogue === 'function') {
					startDialogue([{ name: 'Already taken', icon: '📦', text: 'Nothing useful left.' }]);
				}
				return true;
			}
			if (global.localStorage) localStorage.setItem(key, '1');
			if (typeof global.addRoadFind === 'function' && loot.item) global.addRoadFind(loot.item);
			if (typeof startDialogue === 'function') {
				startDialogue([{ name: 'Found', icon: '📜', text: loot.text }]);
			}
			return true;
		}
		return false;
	}

	function npcs(gy, talk, npc) {
		const y = gy - 90;
		const S = api ? api.SEG : 800;
		const TS = api ? api.TS : 40;
		const north = S * 2 * TS;
		const stand = local => y - ((northLift && northLift[local]) || 0) * TS;
		return [
			npc({ road: true, id: 'gate_captain', name: 'Gate Captain', x: 760 * TS, y, minX: 748 * TS, maxX: 780 * TS, icon: '🛡️', color: '#5a6470',
				dialogue: {
					FIRST_MEETING: talk('Gate Captain', '🛡️', [
						'Emberfall takes in more travelers than any city for three valleys. Keep your weapons sheathed inside the walls.',
						'West is Valedorn and the farms. South of the river road is the Verdant Basin. North, past the watchtower, is the way toward Frostmere. Cinder Ridge burns on the far horizon if you ever go east.'
					]),
					BASIC_DIALOGUE: talk('Gate Captain', '🛡️', ['The gate is open. The rules are not.'])
				} }),
			npc({ road: true, id: 'stablemaster', name: 'Stablemaster Brom', x: 400 * TS, y, minX: 380 * TS, maxX: 430 * TS, icon: '🐴', color: '#8a6840',
				dialogue: {
					FIRST_MEETING: talk('Stablemaster Brom', '🐴', ['Horses rest here. Riders usually do too. I have no mount to sell you yet — just feed, a stall, and the news from the road.']),
					BASIC_DIALOGUE: talk('Stablemaster Brom', '🐴', ['If you hear hooves after dark, it is the patrol, not a story.'])
				} }),
			npc({ road: true, id: 'road_merchant', name: 'Traveling Merchant', x: 424 * TS, y, minX: 410 * TS, maxX: 450 * TS, icon: '🛒', color: '#c09040', hubShop: 'waystation',
				dialogue: {
					FIRST_MEETING: talk('Traveling Merchant', '🛒', ['I change the crates every morning. Today’s stock is whatever the last wagon did not eat.']),
					BASIC_DIALOGUE: talk('Traveling Merchant', '🛒', ['Look again tomorrow. The unusual things never stay long.'])
				} }),
			npc({ road: true, id: 'millwright', name: 'Millwright Osric', x: 214 * TS, y, minX: 200 * TS, maxX: 250 * TS, icon: '⚙️', color: '#7a6248',
				dialogue: {
					FIRST_MEETING: talk('Millwright Osric', '⚙️', ['This wheel turns the stones that feed the fields you just walked through. The river does the work. I only keep it honest.']),
					BASIC_DIALOGUE: talk('Millwright Osric', '⚙️', ['When the wheel stops, the bread stops. That is the whole lesson.'])
				} }),
			npc({ road: true, id: 'farmer_nell', name: 'Farmer Nell', x: 100 * TS, y, minX: 86 * TS, maxX: 120 * TS, icon: '🌾', color: '#6a8a48',
				dialogue: {
					FIRST_MEETING: talk('Farmer Nell', '🌾', ['The city starts where the paving starts. Everything west of that is still ours.']),
					BASIC_DIALOGUE: talk('Farmer Nell', '🌾', ['If you are hungry, the waystation stew is honest. Mine is better.'])
				} }),
			npc({ road: true, id: 'north_commander', name: 'Northwatch Commander', x: north + 312 * TS, y: stand(312), minX: north + 300 * TS, maxX: north + 340 * TS, icon: '🛡️', color: '#4a5870',
				dialogue: {
					FIRST_MEETING: talk('Northwatch Commander', '🛡️', [
						'This tower watches the King’s North Road. Frostmere is beyond the passes. The things that come down from there do not always use the road.',
						'If you scout, look for tracks that stop in the middle of a field. That is never the wind.'
					]),
					BASIC_DIALOGUE: talk('Northwatch Commander', '🛡️', ['Report what you see. Do not decorate it.'])
				} }),
			npc({ road: true, id: 'pilgrim', name: 'Pilgrim', x: north + 724 * TS, y: stand(724), minX: north + 710 * TS, maxX: north + 750 * TS, icon: '🕯️', color: '#c8c0a8',
				dialogue: {
					FIRST_MEETING: talk('Pilgrim', '🕯️', ['Three roads left this shrine once. Two grew shut. The one that remains still climbs toward the cold.']),
					BASIC_DIALOGUE: talk('Pilgrim', '🕯️', ['The north does not hurry. Neither should you.'])
				} }),
			npc({ road: true, id: 'royal_hunter', name: 'Royal Hunter', x: north + 650 * TS, y: stand(650), minX: north + 632 * TS, maxX: north + 680 * TS, icon: '🏹', color: '#5a6840',
				dialogue: {
					FIRST_MEETING: talk('Royal Hunter', '🏹', ['Wolves work the tree line. Slimes keep to the wet grass. I pay attention to both, and to anything that is neither.']),
					BASIC_DIALOGUE: talk('Royal Hunter', '🏹', ['Bring me news of a pack and I will remember your name.'])
				} })
		];
	}

	function slimeSpawns(TS) {
		const S = 800;
		const north = S * 2;
		const spots = [42, 112, 176, 300, 360, 460, 545, 630];
		const northSpots = [90, 200, 270, 400, 455, 590, 700, 780, 330, 350];
		const out = [];
		const body = { w: 60, h: 46 };
		spots.forEach(t => out.push({ x: t * TS, ...body }));
		northSpots.forEach(t => {
			const lift = (northLift && northLift[t]) || 0;
			out.push({ x: (north + t) * TS, y: (72 - lift) * TS - body.h, ...body });
		});
		return out;
	}

	global.EmberfallRoads = {
		paint, draw, tryPerspective, tryLoot, npcs, slimeSpawns, holdPlayer, flipScale,
		depthK, withDepth, drawBackdrop, playerTurn, turnHaze,
		inWaterColumn, waterFloor, bedSolid, groundPieces, ensureFluid, millSpan, structureClip
	};
})(typeof window !== 'undefined' ? window : globalThis);
