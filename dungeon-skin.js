/* =============================================================
   DungeonSkin (c56) — the Fire, Ice and Earth dungeons painted with the open world's art.

   The tile grid stays exactly as it is for collision. Only how it looks changes:
   - The rock is painted in 1024 px chunks from the same textures as EmberFall's terrain (rockface,
     rockface-cold, deeprock). The tile mask is blurred and thresholded with noise, so corners come out
     rounded and the edges rough instead of square.
   - The rock darkens with its distance to open air, has a lit rim on top and a shadow underneath, and
     casts ambient occlusion onto the cave wall behind it.
   - Floors carry a surface strip like the open world's grass: cave moss (Earth), drifted snow (Ice),
     or ash with embers (Fire).
   - Fire rock has molten cracks that pulse. Ice rock has pale frost veins. Earth rock has faint lichen.
   - Flora props stand on the floors and hang from the ceilings: ferns, mushrooms, roots and vines;
     ice crystals, snowy rocks and icicles; basalt, ember crystals, charred trees and dripstones.
     Glowing props add light to DungeonVision.
   - The cave wall behind everything is the deeprock texture with a slight parallax, tinted per theme.

   dungeon.html calls DungeonSkin.drawBackdrop(ctx) and DungeonSkin.drawTiles(ctx). Both return false
   until the textures are loaded, so the old renderer covers the first frames.
   ============================================================= */
(function (global) {
	'use strict';

	const CH = 1024;          // chunk size (px)
	const Q = 4;              // low-res cell size for the mask (px)
	const PAD = 96;           // context read around a chunk so its edges match its neighbours
	const MAX_CHUNKS = 28;

	const THEMES = {
		fire: {
			rock: 'rockface', tint: 'rgba(40,14,10,0.55)', mul: '#7a5a54',
			back: 'deeprock', backTint: 'rgba(30,10,6,0.52)', backGlow: 'rgba(255,90,20,0.10)',
			fog: [12, 4, 3], rim: [255, 150, 90], rimA: 0.26, strip: 'dg-ash', stripH: 30,
			veins: { col: [255, 110, 30], a: 0.95, near: 9, width: 0.030, pulse: true },
			floor: [['basalt0', 50, 90], ['basalt1', 40, 70], ['basalt2', 90, 150, 6], ['ember0', 40, 80, 0, 1], ['ember1', 50, 100, 0, 1], ['charred0', 180, 300, 7], ['charred1', 150, 240, 7], ['rock-cold0', 30, 50]],
			ceil: [['drip-fire0', 50, 90, 1], ['drip-rock0', 40, 80]],
			light: [255, 130, 40], density: 0.17, ceilDensity: 0.11
		},
		ice: {
			rock: 'rockfaceCold', tint: 'rgba(30,60,90,0.32)', mul: '#a8c0d8',
			back: 'deeprock', backTint: 'rgba(8,22,40,0.46)', backGlow: 'rgba(120,200,255,0.06)',
			fog: [4, 12, 22], rim: [220, 240, 255], rimA: 0.42, strip: 'grassSnow', stripH: 28,
			veins: { col: [190, 235, 255], a: 0.32, near: 7, width: 0.022, pulse: false },
			floor: [['ice0', 50, 100, 0, 1], ['ice1', 70, 140, 0, 1], ['rock-snow0', 40, 70], ['rock-snow1', 40, 80], ['boulder-snow0', 90, 150, 6], ['bush-snow0', 40, 70], ['dead-snow0', 160, 260, 7], ['stump-snow0', 40, 60]],
			ceil: [['icicles0', 50, 100]],
			light: [160, 225, 255], density: 0.16, ceilDensity: 0.16
		},
		earth: {
			rock: 'rockface', tint: 'rgba(20,30,14,0.30)', mul: '#9aa088',
			back: 'deeprock', backTint: 'rgba(6,18,10,0.5)', backGlow: 'rgba(110,220,140,0.05)',
			fog: [4, 10, 5], rim: [200, 240, 160], rimA: 0.24, strip: 'dg-moss', stripH: 34,
			veins: { col: [120, 255, 170], a: 0.20, near: 6, width: 0.016, pulse: true },
			floor: [['fern0', 50, 90], ['fern1', 50, 90], ['bush0', 50, 90], ['bush2', 50, 80], ['bush-berry0', 50, 80], ['rock1', 30, 55], ['rock3', 30, 55], ['shroom0', 50, 90, 0, 1], ['shroom1', 40, 70, 0, 1], ['shroom2', 40, 70], ['crystal-green0', 60, 110, 0, 1], ['stump0', 40, 60], ['log0', 40, 60, 5]],
			ceil: [['vine0', 120, 220], ['vine1', 120, 220], ['roots0', 90, 170], ['roots1', 90, 170]],
			light: [130, 240, 200], density: 0.24, ceilDensity: 0.18
		}
	};
	const STRIPS = { 'dg-ash': 'images/emberfall/dg-ash.png', 'dg-moss': 'images/emberfall/dg-moss.png' };
	const stripImg = {};

	function A() { return global.EmberfallArt; }
	function themeKey() {
		if (typeof IS_DUNGEON === 'undefined' || !IS_DUNGEON) return null;
		if (typeof DUNGEON_TYPE === 'undefined') return null;
		return THEMES[DUNGEON_TYPE] ? DUNGEON_TYPE : null;
	}
	function th() { const k = themeKey(); return k ? THEMES[k] : null; }
	let disabled = false;
	try { disabled = /[?&]skin=0/.test(location.search) || localStorage.getItem('magicBattle_dungeonSkin') === 'off'; } catch (e) {}

	/* ---------------------------------------------------------------- loading */
	let started = false;
	function start() {
		if (started) return;
		started = true;
		const a = A();
		if (a && a.loadAll) a.loadAll();
		for (const k in STRIPS) { const i = new Image(); i.src = STRIPS[k] + '?v=1'; stripImg[k] = i; }
		// tile edits made through the old art kits also refresh our chunks
		for (const name of ['FireArt', 'IceArt', 'JungleArt']) {
			const m = global[name];
			if (m && m.invalidateTiles && !m.invalidateTiles._skin) {
				const f = m.invalidateTiles;
				m.invalidateTiles = function () { invalidate(); return f.apply(this, arguments); };
				m.invalidateTiles._skin = true;
			}
		}
	}
	function strip(t) {
		if (stripImg[t.strip]) return stripImg[t.strip];
		return A().sprite(t.strip);
	}
	let readyFrame = -1, readyVal = false;
	function ready() {
		// asked many times a frame (every platform of every kit asks owns()): answer once per frame
		const now = (typeof performance !== 'undefined') ? Math.floor(performance.now() / 8) : 0;
		if (now === readyFrame) return readyVal;
		readyFrame = now;
		return (readyVal = readyNow());
	}
	function readyNow() {
		const a = A(), t = th();
		if (!a || !t || disabled) return false;
		start();
		if (!a.texReady()) return false;
		const s = strip(t);
		if (!a.ok(s)) return false;
		if (!a.floraInfo('rock0')) return false;
		return typeof tileMap !== 'undefined' && tileMap.length > 0;
	}

	/* ---------------------------------------------------------------- noise (seamless across chunks) */
	function h2(x, y) {
		let n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
		n = Math.imul(n ^ (n >>> 13), 1274126177);
		return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
	}
	function vnoise(x, y) {
		const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
		const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
		const a = h2(ix, iy), b = h2(ix + 1, iy), c = h2(ix, iy + 1), d = h2(ix + 1, iy + 1);
		return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
	}
	function fbm(x, y) { return vnoise(x, y) * 0.6 + vnoise(x * 2.1 + 7, y * 2.1 + 3) * 0.28 + vnoise(x * 4.3 + 1, y * 4.3 + 9) * 0.12; }

	function solidAt(c, r) {
		if (r < 0 || c < 0 || r >= tileMap.length) return true;
		const row = tileMap[r];
		if (!row || c >= row.length) return true;
		return row[c] === 0;
	}

	/* ---------------------------------------------------------------- chunk painter */
	const chunks = new Map();
	let frame = 0;
	function chunkHash(cx, cy) {
		const T = TILE;
		const c0 = Math.floor((cx * CH - PAD) / T), c1 = Math.floor((cx * CH + CH + PAD) / T);
		const r0 = Math.floor((cy * CH - PAD) / T), r1 = Math.floor((cy * CH + CH + PAD) / T);
		let h = 0;
		for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) h = (Math.imul(h, 31) + (solidAt(c, r) ? 1 : 2) + c) | 0;
		return h;
	}
	function boxBlur(src, w, h, rad) {
		const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
		const k = 1 / (rad * 2 + 1);
		for (let y = 0; y < h; y++) {
			let s = 0;
			const o = y * w;
			for (let x = -rad; x <= rad; x++) s += src[o + Math.min(w - 1, Math.max(0, x))];
			for (let x = 0; x < w; x++) {
				tmp[o + x] = s * k;
				s += src[o + Math.min(w - 1, x + rad + 1)] - src[o + Math.max(0, x - rad)];
			}
		}
		for (let x = 0; x < w; x++) {
			let s = 0;
			for (let y = -rad; y <= rad; y++) s += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
			for (let y = 0; y < h; y++) {
				out[y * w + x] = s * k;
				s += tmp[Math.min(h - 1, y + rad + 1) * w + x] - tmp[Math.max(0, y - rad) * w + x];
			}
		}
		return out;
	}
	function lowCanvas(w, h, data) {
		const c = A().canvas(w, h);
		const g = c.getContext('2d');
		const id = g.createImageData(w, h);
		id.data.set(data);
		g.putImageData(id, 0, 0);
		return c;
	}

	function buildChunk(cx, cy) {
		const a = A(), t = th(), T = TILE;
		const ox = cx * CH, oy = cy * CH;
		const n = (CH + PAD * 2) / Q;
		const bx = ox - PAD, by = oy - PAD;
		// 1) the tile mask at low resolution, softened and roughened
		const raw = new Float32Array(n * n);
		for (let j = 0; j < n; j++) {
			const r = Math.floor((by + j * Q + Q / 2) / T);
			for (let i = 0; i < n; i++) raw[j * n + i] = solidAt(Math.floor((bx + i * Q + Q / 2) / T), r) ? 1 : 0;
		}
		const soft = boxBlur(boxBlur(raw, n, n, 2), n, n, 1);
		const wide = boxBlur(boxBlur(raw, n, n, 6), n, n, 5);
		const alpha = new Float32Array(n * n);
		const solid = new Uint8Array(n * n);
		for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
			const k = j * n + i;
			const wx = bx + i * Q, wy = by + j * Q;
			const nz = (fbm(wx / 46, wy / 46) - 0.5) * 0.34 + (vnoise(wx / 11, wy / 11) - 0.5) * 0.1;
			const v = Math.max(0, Math.min(1, (soft[k] + nz - 0.5) * 3.2 + 0.5));
			alpha[k] = v;
			solid[k] = v > 0.5 ? 1 : 0;
		}
		// 2) distance to open air (chamfer, in cells), for depth darkening and the molten veins
		const D = new Float32Array(n * n);
		const BIG = 1e6;
		for (let k = 0; k < n * n; k++) D[k] = solid[k] ? BIG : 0;
		for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
			const k = j * n + i;
			if (!D[k]) continue;
			let m = D[k];
			if (i > 0) m = Math.min(m, D[k - 1] + 1);
			if (j > 0) m = Math.min(m, D[k - n] + 1, i > 0 ? D[k - n - 1] + 1.41 : BIG, i < n - 1 ? D[k - n + 1] + 1.41 : BIG);
			D[k] = m;
		}
		for (let j = n - 1; j >= 0; j--) for (let i = n - 1; i >= 0; i--) {
			const k = j * n + i;
			if (!D[k]) continue;
			let m = D[k];
			if (i < n - 1) m = Math.min(m, D[k + 1] + 1);
			if (j < n - 1) m = Math.min(m, D[k + n] + 1, i < n - 1 ? D[k + n + 1] + 1.41 : BIG, i > 0 ? D[k + n - 1] + 1.41 : BIG);
			D[k] = m;
		}
		const maskD = new Uint8ClampedArray(n * n * 4);
		const darkD = new Uint8ClampedArray(n * n * 4);
		const lightD = new Uint8ClampedArray(n * n * 4);
		const aoD = new Uint8ClampedArray(n * n * 4);
		const veinD = new Uint8ClampedArray(n * n * 4);
		const fog = t.fog, rim = t.rim, vn = t.veins;
		let anyVein = false;
		for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
			const k = j * n + i, p = k * 4;
			const wx = bx + i * Q, wy = by + j * Q;
			maskD[p] = maskD[p + 1] = maskD[p + 2] = 255;
			maskD[p + 3] = Math.round(alpha[k] * 255);
			if (solid[k]) {
				const dpx = D[k] * Q;
				// darker with depth: lit skin near the air, near black deep inside
				const dk = Math.min(0.82, Math.pow(Math.min(1, dpx / 230), 0.85) * 0.82);
				darkD[p] = fog[0]; darkD[p + 1] = fog[1]; darkD[p + 2] = fog[2];
				darkD[p + 3] = Math.round(dk * 255);
				// a lit rim where open air is just above, a shadow where it is just below
				let up = 0, dn = 0;
				for (let q = 1; q <= 4; q++) {
					if (j - q >= 0 && !solid[k - q * n]) { up = up || (1 - (q - 1) / 4); }
					if (j + q < n && !solid[k + q * n]) { dn = dn || (1 - (q - 1) / 4); }
				}
				if (up) { lightD[p] = rim[0]; lightD[p + 1] = rim[1]; lightD[p + 2] = rim[2]; lightD[p + 3] = Math.round(up * t.rimA * 255); }
				if (dn && !up) darkD[p + 3] = Math.max(darkD[p + 3], Math.round(dn * 0.55 * 255));
				// veins: ridges of a slow noise, only within reach of the air
				if (vn && D[k] > 1.5 && D[k] * Q < vn.near * 16) {
					const nv = fbm(wx / 120 + 31, wy / 120 + 17);
					const ridge = 1 - Math.abs(nv - 0.5) / vn.width;
					if (ridge > 0) {
						const fade = Math.max(0, 1 - D[k] * Q / (vn.near * 16));
						const av = Math.min(1, ridge * 1.6) * fade * vn.a * (0.5 + 0.5 * vnoise(wx / 70, wy / 70));
						if (av > 0.02) {
							veinD[p] = vn.col[0]; veinD[p + 1] = vn.col[1]; veinD[p + 2] = vn.col[2];
							veinD[p + 3] = Math.round(av * 255);
							anyVein = true;
						}
					}
				}
			} else {
				// ambient occlusion on the cave wall near rock
				const ao = Math.min(0.7, wide[k] * 1.25);
				aoD[p] = 0; aoD[p + 1] = 0; aoD[p + 2] = 0;
				aoD[p + 3] = Math.round(ao * 255);
			}
		}
		const cv = a.canvas(CH, CH);
		const g = cv.getContext('2d');
		g.imageSmoothingEnabled = true;
		g.imageSmoothingQuality = 'high';
		const drawLow = (data) => g.drawImage(lowCanvas(n, n, data), -PAD - Q / 2, -PAD - Q / 2, n * Q, n * Q);
		// rock body
		drawLow(maskD);
		g.globalCompositeOperation = 'source-in';
		g.fillStyle = a.pattern(g, t.rock, -ox, -oy);
		g.fillRect(0, 0, CH, CH);
		g.globalCompositeOperation = 'source-atop';
		g.fillStyle = t.tint;
		g.fillRect(0, 0, CH, CH);
		g.globalCompositeOperation = 'multiply';
		g.fillStyle = t.mul;
		g.fillRect(0, 0, CH, CH);
		g.globalCompositeOperation = 'destination-in';
		drawLow(maskD);
		g.globalCompositeOperation = 'source-atop';
		drawLow(darkD);
		drawLow(lightD);
		// surface strips on every floor
		const s = strip(t);
		const sh = t.stripH, sk = sh / s.naturalHeight, sw = s.naturalWidth * sk;
		g.globalCompositeOperation = 'source-over';
		const c0 = Math.floor((ox - 60) / T), c1 = Math.floor((ox + CH + 60) / T);
		const r0 = Math.floor((oy - 60) / T), r1 = Math.floor((oy + CH + 60) / T);
		for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
			if (!solidAt(c, r) || solidAt(c, r - 1)) continue;
			const lEnd = !solidAt(c - 1, r) || solidAt(c - 1, r - 1);
			const rEnd = !solidAt(c + 1, r) || solidAt(c + 1, r - 1);
			let x0 = c * T + (lEnd ? 7 : 0), x1 = (c + 1) * T - (rEnd ? 7 : 0);
			const y = r * T - oy - sh * 0.58;
			let wx = x0;
			while (wx < x1) {
				let u = ((wx % sw) + sw) % sw;
				if (sw - u < 0.5) u = 0;          // float wrap right at the strip seam
				const w = Math.min(x1 - wx, sw - u);
				g.drawImage(s, u / sk, 0, w / sk, s.naturalHeight, wx - ox, y, w, sh);
				wx += w;
			}
		}
		// ambient occlusion goes under everything, on the cave wall
		g.globalCompositeOperation = 'destination-over';
		drawLow(aoD);
		g.globalCompositeOperation = 'source-over';
		// the glowing veins are baked into the chunk (a separate 'lighter' pass over every chunk every frame was one of
		// the most expensive things on screen)
		if (anyVein) {
			g.save();
			g.globalCompositeOperation = 'lighter';
			g.globalAlpha = vn.pulse ? 0.8 : 1;
			g.drawImage(lowCanvas(n, n, veinD), -PAD - Q / 2, -PAD - Q / 2, n * Q, n * Q);
			g.restore();
		}
		return { cv, glow: null, hash: chunkHash(cx, cy), used: frame };
	}
	function getChunk(cx, cy, allowBuild) {
		const key = cx + ',' + cy;
		let ch = chunks.get(key);
		if (ch) { ch.used = frame; return ch; }
		if (!allowBuild) return null;
		ch = buildChunk(cx, cy);
		chunks.set(key, ch);
		if (chunks.size > MAX_CHUNKS) {
			let oldK = null, old = Infinity;
			for (const [k, v] of chunks) if (v.used < old) { old = v.used; oldK = k; }
			if (oldK) chunks.delete(oldK);
		}
		return ch;
	}
	/* The tiles changed somewhere (a door, a breakable wall, a platform stamped or broken, lava rising …). This used to throw
	   away every painted chunk, so all of the screen was repainted at once — in the fire dungeon, where tiles change often,
	   that happened again and again. Now every chunk is only marked to be checked: the next time it is drawn its tile
	   fingerprint is compared, and only chunks whose tiles really changed are repainted (a couple a frame). */
	function invalidate() { for (const ch of chunks.values()) ch.check = true; }
	function reset() { chunks.clear(); props = null; }

	/* ---------------------------------------------------------------- props */
	let props = null;     // Map bucketX -> [prop]
	let propsKey = null;
	function hazardRects() {
		const out = [];
		const d = (typeof dungeon !== 'undefined') ? dungeon : null;
		for (const h of (d && d.hazards) || []) if (h && h.w && h.h) out.push(h);
		return out;
	}
	function buildProps() {
		const a = A(), t = th(), T = TILE;
		const list = [];
		const hz = hazardRects();
		const inHaz = (x, y) => hz.some(h => x > h.x - 30 && x < h.x + h.w + 30 && y > h.y - 50 && y < h.y + h.h + 40);
		const rows = tileMap.length, cols = tileMap[0].length;
		const airAbove = (c, r) => { let k = 0; while (k < 8 && !solidAt(c, r - 1 - k)) k++; return k; };
		const airBelow = (c, r) => { let k = 0; while (k < 8 && !solidAt(c, r + 1 + k)) k++; return k; };
		const isFloor = (c, r) => solidAt(c, r) && !solidAt(c, r - 1);
		const d = (typeof dungeon !== 'undefined') ? dungeon : null;
		const start = d && d.playerStart;
		for (let r = 1; r < rows - 1; r++) {
			let skip = 0;
			for (let c = 1; c < cols - 1; c++) {
				if (skip > 0) { skip--; continue; }
				if (!isFloor(c, r)) continue;
				if (!isFloor(c - 1, r) || !isFloor(c + 1, r)) continue;
				const hgt = airAbove(c, r);
				if (hgt < 3) continue;
				const hv = h2(c * 3 + 1, r * 7 + 2);
				if (hv > t.density) continue;
				const def = t.floor[Math.floor(h2(c, r * 13) * t.floor.length)];
				const big = def[3] || 0;
				if (big && (hgt < big || !isFloor(c - 2, r) || !isFloor(c + 2, r))) continue;
				const x = c * T + T / 2 + (h2(c, r) - 0.5) * 20, y = r * T;
				if (inHaz(x, y)) continue;
				if (start && Math.abs(start.x - x) < 80 && Math.abs(start.y - y) < 160) continue;
				const hh = def[1] + h2(c * 5, r) * (def[2] - def[1]);
				list.push({ name: def[0], x, y: y + 3, h: Math.min(hh, hgt * T - 30), flip: h2(c, r * 3) < 0.5, glow: !!def[4], layer: big ? 0 : 1 });
				skip = big ? 3 : 1;
			}
		}
		// things hanging from the ceilings
		for (let r = 1; r < rows - 1; r++) {
			let skip = 0;
			for (let c = 1; c < cols - 1; c++) {
				if (skip > 0) { skip--; continue; }
				if (!solidAt(c, r) || solidAt(c, r + 1) || !solidAt(c - 1, r) || !solidAt(c + 1, r)) continue;
				if (solidAt(c - 1, r + 1) || solidAt(c + 1, r + 1)) continue;
				const drop = airBelow(c, r);
				if (drop < 4) continue;
				if (h2(c * 11 + 5, r * 3 + 1) > t.ceilDensity) continue;
				const def = t.ceil[Math.floor(h2(c * 7, r) * t.ceil.length)];
				const x = c * T + T / 2, y = (r + 1) * T;
				if (inHaz(x, y)) continue;
				const hh = def[1] + h2(c, r * 5) * (def[2] - def[1]);
				list.push({ name: def[0], x, y: y - 4, h: Math.min(hh, drop * T * 0.45), flip: h2(c * 2, r) < 0.5, hang: true, glow: !!def[3], layer: 0 });
				skip = 2;
			}
		}
		const m = new Map();
		for (const p of list) {
			const k = Math.floor(p.x / CH);
			if (!m.has(k)) m.set(k, []);
			m.get(k).push(p);
		}
		for (const arr of m.values()) arr.sort((p, q) => p.layer - q.layer);
		return m;
	}
	const scaled = new Map();
	function scaledSprite(name, h, flip) {
		const a = A();
		const im = a.floraImg(name);
		if (!a.ok(im)) return null;
		const hq = Math.max(8, Math.round(h / 6) * 6);
		const key = name + '|' + hq + '|' + (flip ? 1 : 0);
		let s = scaled.get(key);
		if (s) return s;
		const k = hq / im.naturalHeight;
		const w = Math.max(1, Math.round(im.naturalWidth * k));
		const c = a.canvas(w, hq);
		const g = c.getContext('2d');
		g.imageSmoothingQuality = 'high';
		if (flip) { g.translate(w, 0); g.scale(-1, 1); }
		g.drawImage(im, 0, 0, w, hq);
		const info = a.floraInfo(name) || { ax: 0.5, base: im.naturalHeight };
		s = { c, w, h: hq, ax: flip ? 1 - info.ax : info.ax, base: info.base * k };
		scaled.set(key, s);
		if (scaled.size > 260) scaled.delete(scaled.keys().next().value);
		return s;
	}
	function drawProps(ctx, cam, vw, vh) {
		const t = th();
		const key = (typeof DUNGEON_TYPE !== 'undefined' ? DUNGEON_TYPE : '') + ':' + tileMap.length + 'x' + tileMap[0].length;
		if (!props || propsKey !== key) { props = buildProps(); propsKey = key; }
		const vis = global.DungeonVision;
		const k0 = Math.floor((cam.x - 300) / CH), k1 = Math.floor((cam.x + vw + 300) / CH);
		const now = performance.now() / 1000;
		for (let k = k0; k <= k1; k++) {
			const arr = props.get(k);
			if (!arr) continue;
			for (const p of arr) {
				const s = scaledSprite(p.name, p.h, p.flip);
				if (!s) continue;
				const x = p.x - s.w * s.ax - cam.x;
				if (x > vw + 20 || x + s.w < -20) continue;
				const y = (p.hang ? p.y : p.y - s.base) - cam.y;
				if (y > vh + 20 || y + s.h < -20) continue;
				ctx.drawImage(s.c, Math.round(x), Math.round(y));
				if (p.glow && vis && vis.addLight) {
					const fl = 0.85 + Math.sin(now * 2.3 + p.x * 0.01) * 0.08;
					vis.addLight(p.x, p.hang ? p.y + p.h * 0.6 : p.y - p.h * 0.5, 90 + p.h * 0.9, 0.42 * fl, t.light);
				}
			}
		}
	}


	/* ---------------------------------------------------------------- platforms
	   Platforms stamped into the tile grid are already painted as rock by the chunks. The skin also paints the
	   moving ones (and any static ones left out of the grid) as slabs of the same rock with the same floor strip.
	   Platforms whose look carries a gameplay tell (collapsing, thin ice, growing vines) stay with their kits. */
	function owns(p) {
		if (!p || !ready()) return false;
		if (p.kind === 'collapse' || p.kind === 'thinIce' || p._iceFragile || p._growT > 0 || p.vineRung || p._jungleHidden || p.growthId) return false;
		return true;
	}
	const slabs = new Map();
	function slab(p) {
		const a = A(), t = th();
		const w = Math.max(8, Math.round(p.w)), h = Math.max(10, Math.round(p.h || 20));
		const raft = p.kind === 'raft';
		const key = (DUNGEON_TYPE || '') + '|' + w + '|' + h + '|' + (raft ? 'r' : 's');
		let c = slabs.get(key);
		if (c) return c;
		const hang = raft ? 6 : Math.min(46, 14 + h * 0.5);
		const cv = a.canvas(w + 16, h + hang + 30);
		const g = cv.getContext('2d');
		const ox = 8, oy = 22;
		const rr = a.rnd ? a.rnd(w * 7 + h) : Math.random;
		if (raft) {
			// lashed logs (earth) or a floe of packed ice (ice) or a basalt raft (fire)
			const n = Math.max(2, Math.round(h / 12));
			for (let i = 0; i < n; i++) {
				const y = oy + i * (h / n);
				const gr = g.createLinearGradient(0, y, 0, y + h / n);
				const base = DUNGEON_TYPE === 'ice' ? ['#e8f6ff', '#9cc6e0', '#5f8fb0'] : DUNGEON_TYPE === 'fire' ? ['#5a4a46', '#2e2422', '#140e0c'] : ['#9a7246', '#6a4a2a', '#3a2614'];
				gr.addColorStop(0, base[0]); gr.addColorStop(0.45, base[1]); gr.addColorStop(1, base[2]);
				g.fillStyle = gr;
				g.beginPath();
				g.ellipse(ox + 6, y + h / n / 2, 6, h / n / 2, 0, 0, Math.PI * 2);
				g.rect(ox + 6, y, w - 12, h / n);
				g.ellipse(ox + w - 6, y + h / n / 2, 6, h / n / 2, 0, 0, Math.PI * 2);
				g.fill();
			}
			g.fillStyle = 'rgba(40,24,12,0.8)';
			for (const f of [0.18, 0.82]) g.fillRect(ox + w * f - 3, oy - 1, 6, h + 2);
		} else {
			// a rough-edged rock slab
			g.save();
			g.beginPath();
			g.moveTo(ox + 4, oy + 2);
			for (let x = 0; x <= w; x += 12) g.lineTo(ox + x, oy + (rr() - 0.5) * 3);
			g.lineTo(ox + w - 2, oy + h * 0.55);
			for (let x = w; x >= 0; x -= 10) g.lineTo(ox + x, oy + h + (Math.sin(x * 0.07) * 0.5 + 0.5) * hang * (0.35 + rr() * 0.65) * (1 - Math.pow(Math.abs(x / w - 0.5) * 2, 3)));
			g.lineTo(ox + 2, oy + h * 0.55);
			g.closePath();
			g.clip();
			g.fillStyle = a.pattern(g, t.rock, rr() * 400, rr() * 400);
			g.fillRect(0, 0, cv.width, cv.height);
			g.fillStyle = t.tint;
			g.fillRect(0, 0, cv.width, cv.height);
			g.globalCompositeOperation = 'multiply';
			g.fillStyle = t.mul;
			g.fillRect(0, 0, cv.width, cv.height);
			g.globalCompositeOperation = 'source-over';
			const sh = g.createLinearGradient(0, oy, 0, oy + h + hang);
			sh.addColorStop(0, 'rgba(' + t.rim.join(',') + ',' + (t.rimA * 0.8) + ')');
			sh.addColorStop(0.18, 'rgba(0,0,0,0)');
			sh.addColorStop(1, 'rgba(' + t.fog.join(',') + ',0.85)');
			g.fillStyle = sh;
			g.fillRect(0, 0, cv.width, cv.height);
			g.restore();
		}
		// the floor strip along the top, as on the rock
		const st = strip(t), sh2 = t.stripH * 0.9, sk = sh2 / st.naturalHeight, sw = st.naturalWidth * sk;
		let wx = 0;
		const off = Math.floor(rr() * sw);
		while (wx < w - 2) {
			let u = (wx + off) % sw;
			if (sw - u < 0.5) u = 0;
			const ww = Math.min(w - 2 - wx, sw - u);
			g.drawImage(st, u / sk, 0, ww / sk, st.naturalHeight, ox + 1 + wx, oy - sh2 * 0.58, ww, sh2);
			wx += ww;
		}
		c = { cv, ox, oy };
		slabs.set(key, c);
		if (slabs.size > 120) slabs.delete(slabs.keys().next().value);
		return c;
	}
	function drawPlatforms(ctx, cam, vw, vh) {
		const d = (typeof dungeon !== 'undefined') ? dungeon : null;
		if (!d || !d.platforms) return;
		for (const p of d.platforms) {
			if (!p || p._gone || p._stamped || !owns(p)) continue;
			const x = p.x - cam.x, y = p.y - cam.y;
			if (x + p.w < -40 || x > vw + 40 || y + (p.h || 20) < -80 || y > vh + 40) continue;
			const c = slab(p);
			ctx.drawImage(c.cv, Math.round(x - c.ox), Math.round(y - c.oy));
		}
	}

	/* ---------------------------------------------------------------- public draw hooks */
	function cam() { return (typeof camera !== 'undefined') ? camera : { x: 0, y: 0 }; }
	let backTile = null, backKey = '', backGrad = null, backGradKey = '';
	function drawBackdrop(ctx) {
		if (!ready()) return false;
		const a = A(), t = th(), c = cam();
		const vw = ctx.canvas.width, vh = ctx.canvas.height;
		// the cave wall: the deeprock texture, scaled and tinted once into a tile, then blitted with parallax
		if (backKey !== themeKey()) {
			// deeprock is 512 px: two repeats at ×1.15 make a seamless 1178 px tile
			const S = 1178, k = 589 / 512;
			backTile = a.canvas(S, S);
			const g = backTile.getContext('2d');
			g.fillStyle = a.pattern(g, t.back, 0, 0, k, k);
			g.fillRect(0, 0, S, S);
			g.fillStyle = t.backTint;
			g.fillRect(0, 0, S, S);
			backKey = themeKey();
		}
		const S = backTile.width;
		const px = ((-c.x * 0.82) % S + S) % S - S, py = ((-c.y * 0.82) % S + S) % S - S;
		for (let y = Math.round(py); y < vh; y += S) for (let x = Math.round(px); x < vw; x += S) ctx.drawImage(backTile, x, y);
		if (backGradKey !== themeKey() + vw + 'x' + vh) {
			backGrad = a.canvas(vw, vh);
			const g = backGrad.getContext('2d');
			const gr = g.createLinearGradient(0, 0, 0, vh);
			gr.addColorStop(0, 'rgba(0,0,0,0.35)');
			gr.addColorStop(0.6, 'rgba(0,0,0,0)');
			gr.addColorStop(1, t.backGlow);
			g.fillStyle = gr;
			g.fillRect(0, 0, vw, vh);
			backGradKey = themeKey() + vw + 'x' + vh;
		}
		ctx.drawImage(backGrad, 0, 0);
		return true;
	}
	function drawTiles(ctx) {
		if (!ready()) return false;
		frame++;
		const c = cam();
		const vw = ctx.canvas.width, vh = ctx.canvas.height;
		const vx = Math.round(c.x), vy = Math.round(c.y);
		const x0 = Math.floor(vx / CH), x1 = Math.floor((vx + vw) / CH);
		const y0 = Math.floor(vy / CH), y1 = Math.floor((vy + vh) / CH);
		// chunks whose tiles changed (doors, breakable walls): one visible chunk is checked each frame anyway, and every chunk
		// marked by invalidate() is checked when drawn; a changed chunk keeps being drawn until it has been repainted
		const cols = x1 - x0 + 1, total = cols * (y1 - y0 + 1);
		const pick = frame % Math.max(1, total);
		const pc = chunks.get((x0 + (pick % cols)) + ',' + (y0 + Math.floor(pick / cols)));
		if (pc) pc.check = true;
		let rebuilt = 0;
		const t = th();
		const pulse = t.veins && t.veins.pulse ? 0.72 + Math.sin(performance.now() / 700) * 0.2 : 1;
		const glows = [];
		for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
			let ch = getChunk(cx, cy, true);
			if (ch.check) {
				ch.check = false;
				if (ch.hash !== chunkHash(cx, cy)) ch.stale = true;
			}
			if (ch.stale && rebuilt < 2) {
				rebuilt++;
				const nc = buildChunk(cx, cy);
				nc.used = frame;
				chunks.set(cx + ',' + cy, nc);
				ch = nc;
				props = null;
			}
			ctx.drawImage(ch.cv, cx * CH - vx, cy * CH - vy);
			if (ch.glow) glows.push([ch.glow, cx * CH - vx, cy * CH - vy]);
		}
		if (glows.length) {
			ctx.save();
			ctx.globalCompositeOperation = 'lighter';
			ctx.globalAlpha = pulse;
			for (const [gcv, gx, gy] of glows) ctx.drawImage(gcv, gx, gy);
			ctx.restore();
		}
		// warm up one neighbouring chunk per frame so walking into new rock doesn't hitch
		if (frame % 2 === 0) {
			const dirs = [[x1 + 1, y0], [x0 - 1, y0], [x0, y1 + 1], [x0, y0 - 1], [x1 + 1, y1], [x0 - 1, y1], [x1, y1 + 1], [x1, y0 - 1]];
			for (const [cx, cy] of dirs) if (!chunks.has(cx + ',' + cy) && cx >= 0 && cy >= 0) { getChunk(cx, cy, true); break; }
		}
		drawPlatforms(ctx, { x: vx, y: vy }, vw, vh);
		drawProps(ctx, { x: vx, y: vy }, vw, vh);
		return true;
	}

	global.DungeonSkin = {
		drawBackdrop, drawTiles, invalidate, owns,
		enabled: () => ready(),
		setEnabled(on) { disabled = !on; try { localStorage.setItem('magicBattle_dungeonSkin', on ? 'on' : 'off'); } catch (e) {} reset(); },
		reset
	};
})(typeof window !== 'undefined' ? window : globalThis);
