/* EmberFall interior props — transparent sheet, no backdrop. */
(function (global) {
	'use strict';

	const CELL = 128;
	const COLS = 4;
	const NAMES = [
		'throne', 'chandelier', 'statue', 'rack',
		'dummy', 'chest', 'altar', 'maptable',
		'crystal', 'cauldron', 'cell', 'urn',
		'candles', 'banner', 'marker',
		'torch', 'brazier', 'lantern', 'candelabra',
		'ladder', 'bookcase', 'armor', 'fountain',
		'bed', 'glass', 'plant', 'coins'
	];
	const INDEX = {};
	NAMES.forEach((n, i) => { INDEX[n] = i; });

	const sheet = new Image();
	let ready = false;
	sheet.onload = () => { ready = true; };
	sheet.src = 'images/props/emberfall-props-sheet.png?v=3';

	const DRESS_CELL = 256;
	const DRESS_COLS = 8;
	const DRESS = [
		'drape', 'curtain', 'column', 'grandthrone', 'shelfwall', 'warmap', 'council', 'hearth',
		'canopy', 'stores', 'prison', 'magewell', 'hoard', 'dais', 'knight', 'bower',
		'oaktree', 'feast', 'rosewin', 'pews', 'armory', 'infirm', 'guestbed', 'sewerarch',
		'runepillar', 'planter', 'desk', 'telescope', 'flight'
	];
	const DRESS_INDEX = {};
	DRESS.forEach((n, i) => { DRESS_INDEX[n] = i; });
	/* Opaque pixels only, so drawing uses the real shape instead of the square cell. */
	const DRESS_CROP = {
		drape: [61, 2, 134, 252], curtain: [2, 41, 252, 173], column: [80, 2, 96, 252],
		grandthrone: [56, 2, 144, 252], shelfwall: [35, 2, 186, 252], warmap: [2, 43, 252, 170],
		council: [2, 57, 252, 142], hearth: [3, 10, 250, 236], canopy: [2, 3, 252, 250],
		stores: [6, 3, 244, 250], prison: [4, 3, 248, 250], magewell: [19, 2, 217, 251],
		hoard: [2, 73, 252, 110], dais: [2, 68, 252, 120], knight: [85, 2, 86, 252],
		bower: [3, 50, 250, 155], oaktree: [2, 4, 252, 247], feast: [2, 68, 252, 121],
		rosewin: [3, 2, 250, 252], pews: [2, 71, 252, 114], armory: [3, 6, 250, 244],
		infirm: [2, 49, 252, 158], guestbed: [3, 13, 250, 231], sewerarch: [3, 18, 250, 220],
		runepillar: [84, 2, 88, 252], planter: [2, 42, 252, 172], desk: [3, 22, 250, 212],
		telescope: [21, 3, 214, 250], flight: [0, 0, 256, 256]
	};
	const SMALL_CROP = {
		throne: [22, 8, 85, 111], chandelier: [11, 0, 106, 128], statue: [32, 16, 65, 109],
		rack: [18, 16, 93, 103], dummy: [24, 18, 81, 105], chest: [24, 48, 81, 61],
		altar: [16, 16, 97, 103], maptable: [10, 40, 109, 79], crystal: [28, 8, 61, 109],
		cauldron: [24, 40, 81, 73], cell: [30, 8, 69, 113], urn: [40, 36, 49, 83],
		candles: [36, 24, 57, 95], banner: [20, 10, 89, 103], marker: [48, 16, 33, 75],
		torch: [34, 0, 60, 128], brazier: [28, 40, 73, 85], lantern: [39, 0, 50, 128],
		candelabra: [30, 1, 68, 127], ladder: [36, 4, 57, 121], bookcase: [16, 8, 97, 113],
		armor: [36, 8, 57, 113], fountain: [16, 16, 97, 105], bed: [18, 28, 93, 83],
		glass: [16, 8, 97, 113], plant: [30, 20, 71, 101], coins: [20, 40, 87, 65]
	};
	function cropOf(name) {
		return DRESS_CROP[name] || SMALL_CROP[name] || null;
	}
	function size(name, height) {
		const c = cropOf(name);
		const h = height || 80;
		if (!c) return { w: h, h: h };
		return { w: Math.max(8, Math.round(h * c[2] / c[3])), h: h };
	}
	const dress = new Image();
	let dressReady = false;
	dress.onload = () => { dressReady = true; };
	dress.src = 'images/props/emberfall-castle-dress.png?v=7';

	function drawOne(ctx, name, x, y, camera, w, h, flipX) {
		const di = DRESS_INDEX[name];
		const i = INDEX[name];
		if (di == null && i == null) return;
		const dw = w || 88;
		const dh = h || 88;
		const dx = x - camera.x;
		const dy = y - camera.y;
		if (dx + dw < -40 || dx > ctx.canvas.width + 40) return;
		if (dy + dh < -40 || dy > ctx.canvas.height + 40) return;
		if (di != null) {
			if (!dressReady) return;
			const crop = DRESS_CROP[name];
			const sx = (di % DRESS_COLS) * DRESS_CELL + crop[0];
			const sy = Math.floor(di / DRESS_COLS) * DRESS_CELL + crop[1];
			if (flipX) {
				ctx.save();
				ctx.translate(dx + dw, dy);
				ctx.scale(-1, 1);
				ctx.drawImage(dress, sx, sy, crop[2], crop[3], 0, 0, dw, dh);
				ctx.restore();
			} else {
				ctx.drawImage(dress, sx, sy, crop[2], crop[3], dx, dy, dw, dh);
			}
			return;
		}
		if (!ready) return;
		const crop = SMALL_CROP[name] || [0, 0, CELL, CELL];
		const sx = (i % COLS) * CELL + crop[0];
		const sy = Math.floor(i / COLS) * CELL + crop[1];
		ctx.drawImage(sheet, sx, sy, crop[2], crop[3], dx, dy, dw, dh);
	}

	function drawList(ctx, camera, list) {
		if (!list) return;
		for (let i = 0; i < list.length; i++) {
			const p = list[i];
			drawOne(ctx, p.name, p.x, p.y, camera, p.w, p.h, p.flipX);
		}
	}

	global.EmberfallProps = { drawOne, drawList, size, ensure() { return sheet; } };
})(typeof window !== 'undefined' ? window : globalThis);
