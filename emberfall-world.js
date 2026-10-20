/* EmberFall region engine: heightfield terrain with cliffs and hollows, collision, lazily painted terrain
   chunks, placed buildings/props, water, and the render passes. The layout itself is in emberfall-layout.js,
   interiors in emberfall-interiors.js, ambient life in emberfall-life.js. Exposes EmberfallWorld. */
(function (global) {
	'use strict';
	const A = global.EmberfallArt;

	const TS = 40;
	const BASE = 4600;
	const WORLD_W = 200000;      // the Western Approach, the city and the North Road (0 – 78000) and the northern frontier (78000 – 194000)
	const WORLD_H = 6400;
	const BEDROCK = WORLD_H - 80;
	const STEP = 8;
	const NCOL = Math.ceil(WORLD_W / STEP) + 2;

	/* materials for the surface strip and the body */
	const M = { meadow: 1, town: 2, cobble: 3, dirt: 4, rock: 5, dry: 6, cold: 7, snow: 8, sand: 9, flag: 10, plank: 11, frost: 12, ice: 13 };

	const W = {
		TS, BASE, WORLD_W, WORLD_H, BEDROCK, M,
		H: new Float32Array(NCOL),
		mat: new Uint8Array(NCOL),
		body: new Uint8Array(NCOL),      // 0 soil, 1 rock
		voids: [],
		plats: [],
		stairs: [],
		bldgs: [],
		props: [],
		back: [],
		structs: [],
		water: [],
		falls: [],
		lamps: [],
		bunting: [],
		smoke: [],
		fences: [],
		npcs: [],
		walkers: [],
		loots: [],
		districts: [],
		joints: [],
		dummies: [],
		slimes: [],
		rooms: {},
		walls: [],
		ladders: [],
		zones: [],          // climate zones: { x0, x1, set, c0, c1 } (see climate())
		interacts: [],      // levers, lore stones, keys: things you press E at
		signs: []           // the junction signposts
	};

	/* ------------------------------------------------------------------ terrain construction */
	function ground(keys) {
		for (let i = 0; i < keys.length - 1; i++) {
			const [x0, y0, mode] = keys[i];
			const [x1, y1] = keys[i + 1];
			const c0 = Math.max(0, Math.floor(x0 / STEP));
			const c1 = Math.min(NCOL - 1, Math.ceil(x1 / STEP));
			for (let c = c0; c <= c1; c++) {
				const t = Math.max(0, Math.min(1, (c * STEP - x0) / Math.max(1, x1 - x0)));
				const k = mode === 'l' ? t : (1 - Math.cos(t * Math.PI)) / 2;
				W.H[c] = y0 + (y1 - y0) * k;
			}
		}
	}
	function hash(n) {
		n = Math.imul(n | 0, 374761393) ^ 0x5bd1e995;
		n = Math.imul(n ^ (n >>> 13), 1274126177);
		return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
	}
	function vnoise(x, seed) {
		const i = Math.floor(x);
		const f = x - i;
		const s = f * f * (3 - 2 * f);
		return hash(i * 7919 + seed) * (1 - s) + hash((i + 1) * 7919 + seed) * s;
	}
	function rough(x0, x1, amp, seed, freq) {
		const c0 = Math.floor(x0 / STEP);
		const c1 = Math.ceil(x1 / STEP);
		freq = freq || 1 / 380;
		for (let c = c0; c <= c1 && c < NCOL; c++) {
			const x = c * STEP;
			const edge = Math.min(1, (x - x0) / 200, (x1 - x) / 200);
			if (edge <= 0) continue;
			const n = (vnoise(x * freq, seed) - 0.5) * 2 * amp + (vnoise(x * freq * 3.1, seed + 9) - 0.5) * amp * 0.45;
			W.H[c] += n * edge;
		}
	}
	function material(x0, x1, m) {
		for (let c = Math.max(0, Math.floor(x0 / STEP)); c <= Math.min(NCOL - 1, Math.ceil(x1 / STEP)); c++) W.mat[c] = m;
	}
	function rockBody(x0, x1) {
		for (let c = Math.max(0, Math.floor(x0 / STEP)); c <= Math.min(NCOL - 1, Math.ceil(x1 / STEP)); c++) W.body[c] = 1;
	}
	function flatten(x0, x1, y, feather) {
		/* level a pad for a building, easing back into the surrounding ground so it never leaves a step */
		const fe = feather == null ? 160 : feather;
		for (let c = Math.max(0, Math.floor((x0 - fe) / STEP)); c <= Math.min(NCOL - 1, Math.ceil((x1 + fe) / STEP)); c++) {
			const x = c * STEP;
			let k = 1;
			if (x < x0) k = 1 - (x0 - x) / fe;
			else if (x > x1) k = 1 - (x - x1) / fe;
			k = Math.max(0, Math.min(1, k));
			k = k * k * (3 - 2 * k);
			W.H[c] = W.H[c] * (1 - k) + y * k;
		}
	}

	/* ------------------------------------------------------------------ climate
	   Each stretch of the map has a band set (the painted backdrop) and a coldness 0..1 that drives the sky, the rock
	   faces, snowfall and the flora on ledges. Neighbouring zones cross-fade over a short distance, so walking north
	   the countryside slowly gives way to pines, frost and snow. */
	const BANDS = {
		farm: { far: 'bg-far-farm', mid: 'bg-mid-farm', near: 'bg-near-farm' },
		north: { far: 'bg-far-north', mid: 'bg-mid-north', near: 'bg-near-north' },
		pine: { far: 'bg-far-north', mid: 'bg-mid-forest', near: 'bg-near-pines' },
		frostpine: { far: 'bg-far-north', mid: 'bg-mid-north', near: 'bg-near-frostpines' },
		alpine: { far: 'bg-far-north', mid: 'bg-mid-north', near: null, farScale: 1.45, farLift: 0.1 }
	};
	function zone(x0, x1, set, c0, c1) { W.zones.push({ x0, x1, set, c0, c1: c1 == null ? c0 : c1 }); W.zones.sort((a, b) => a.x0 - b.x0); }
	function zoneAt(x) {
		for (const z of W.zones) if (x >= z.x0 && x < z.x1) return z;
		return null;
	}
	function coldAt(x) {
		const z = zoneAt(x);
		if (!z) return x > 55000 ? 1 : 0;
		const t = Math.max(0, Math.min(1, (x - z.x0) / Math.max(1, z.x1 - z.x0)));
		return z.c0 + (z.c1 - z.c0) * t;
	}
	const FADE = 900;
	function climate(x) {
		/* { a: set name, b: set name, t: how much of b, cold } */
		const z = zoneAt(x);
		const cold = coldAt(x);
		if (!z) return { a: x > 55000 ? 'north' : 'farm', b: null, t: 0, cold };
		// near a zone edge with a different set: blend toward the neighbour
		if (x - z.x0 < FADE) {
			const n = zoneAt(z.x0 - 1);
			if (n && n.set !== z.set && n.x1 === z.x0) return { a: z.set, b: n.set, t: 0.5 * (1 - (x - z.x0) / FADE), cold };
		}
		if (z.x1 - x < FADE) {
			const n = zoneAt(z.x1 + 1);
			if (n && n.set !== z.set && n.x0 === z.x1) return { a: z.set, b: n.set, t: 0.5 * (1 - (z.x1 - x) / FADE), cold };
		}
		return { a: z.set, b: null, t: 0, cold };
	}

	/* ------------------------------------------------------------------ props by bucket (draw only what is near the camera) */
	const PB = 2048;
	let buckets = null;
	function indexProps() {
		buckets = new Map();
		for (let i = 0; i < W.props.length; i++) {
			const p = W.props[i];
			p._i = i;
			const k = Math.floor(p.x / PB);
			let b = buckets.get(k);
			if (!b) { b = { back: [], mid: [], front: [], cave: [] }; buckets.set(k, b); }
			(b[p.layer] || b.mid).push(p);
		}
	}
	function propsNear(layer, x0, x1, out) {
		if (!buckets || buckets._n !== W.props.length) { indexProps(); buckets._n = W.props.length; }
		out = out || [];
		out.length = 0;
		for (let k = Math.floor((x0 - 900) / PB); k <= Math.floor((x1 + 900) / PB); k++) {
			const b = buckets.get(k);
			if (b) for (const p of b[layer]) out.push(p);
		}
		out.sort((a, b) => a._i - b._i);      // keep the layout's drawing order
		return out;
	}

	/* surface at x (linear between columns) */
	function surf(x) {
		if (x <= 0) return W.H[0];
		const f = x / STEP;
		const c = Math.floor(f);
		if (c >= NCOL - 1) return W.H[NCOL - 1];
		const t = f - c;
		return W.H[c] * (1 - t) + W.H[c + 1] * t;
	}
	function inVoid(x, y) {
		const v = W.voids;
		for (let i = 0; i < v.length; i++) {
			const r = v[i];
			if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r;
		}
		return null;
	}
	function solidAt(x, y) {
		if (y >= BEDROCK) return true;
		if (y < surf(x)) return false;
		return !inVoid(x, y);
	}

	/* ------------------------------------------------------------------ collision (called from moveEntitySandbox) */
	let inside = false;
	function setInside(v) { inside = !!v; }
	function collide(ent, prevX, prevY) {
		if (inside || !ent) return;
		const w = ent.w;
		const h = ent.h;
		const vx = ent.x - prevX;
		let cx = ent.x + w / 2;
		let feet = ent.y + h;
		if (inVoid(cx, feet - 6)) { ent._tg = false; return; }
		// walls: the leading edge meets terrain that rises more than a step above the feet
		if (vx !== 0) {
			const lead = vx > 0 ? ent.x + w - 3 : ent.x + 3;
			const sl = surf(lead);
			const rise = feet - sl;
			const grounded = ent._tg || ent.onGround;
			const step = grounded ? 16 + Math.abs(vx) * 1.25 : 6;
			if (rise > step && !inVoid(lead, feet - 12)) {
				// let a jump clear the lip: only block if the body actually overlaps the rock
				if (sl < feet - 4) {
					ent.x = prevX;
					if (ent.vx) ent.vx = 0;
					if (ent.launchVx) ent.launchVx = 0;
					cx = ent.x + w / 2;
				}
			}
		}
		const s = surf(cx);
		feet = ent.y + h;
		if (feet >= s) {
			const depth = feet - s;
			if (ent.vy >= 0 || depth > 40) {
				ent.y = s - h;
				ent.vy = 0;
				ent.onGround = true;
			} else {
				ent.y = s - h;
			}
		} else if (ent._tg && ent.vy >= 0 && !ent.onGround && s - feet <= 12 + Math.abs(vx) * 1.4) {
			// walking downhill: stay on the ground instead of hopping
			ent.y = s - h;
			ent.vy = 0;
			ent.onGround = true;
		}
		ent._tg = !!ent.onGround;
	}
	function footY(x, w) {
		return surf(x + (w || 0) / 2);
	}

	/* stairs (both outdoors and in interiors) */
	function stairSurface(ent, list) {
		const L = list || W.stairs;
		if (!ent || !L.length) return null;
		const down = typeof keys !== 'undefined' && (keys['s'] || keys['arrowdown'] || keys['ArrowDown']);
		if (down) return null;
		const cx = ent.x + (ent.w || 0) * 0.5;
		const feet = ent.y + ent.h;
		let best = null;
		for (let i = 0; i < L.length; i++) {
			const s = L[i];
			if (cx < s.x || cx > s.x + s.w) continue;
			const t = Math.max(0, Math.min(1, (cx - s.x) / s.w));
			const y = s.y0 + (s.y1 - s.y0) * t;
			if (feet < y - 10 || feet > y + 18) continue;
			if (best == null || y < best) best = y;
		}
		return best;
	}

	/* ------------------------------------------------------------------ terrain chunk painter */
	const CHUNK = 1024;
	const chunks = new Map();
	const SOIL_SHOW = 560;
	function chunkRange(i) {
		const x0 = i * CHUNK;
		let lo = Infinity;
		let hi = -Infinity;
		for (let x = x0 - 16; x <= x0 + CHUNK + 16; x += STEP) {
			const s = surf(x);
			if (s < lo) lo = s;
			if (s > hi) hi = s;
		}
		for (const v of W.voids) {
			if (v.x > x0 + CHUNK || v.x + v.w < x0) continue;
			hi = Math.max(hi, v.y + v.h + 40);
		}
		return { x0, y0: Math.floor(lo - 120), y1: Math.ceil(Math.min(WORLD_H, hi + SOIL_SHOW)) };
	}
	function stripImg(m) {
		if (m === M.meadow) return A.sprite('grassMeadow');
		if (m === M.town) return A.sprite('grassTown');
		if (m === M.dry) return A.sprite('grassDry');
		if (m === M.cold) return A.sprite('grassCold');
		if (m === M.frost) return A.sprite('grassFrost');
		if (m === M.snow) return A.sprite('grassSnow');
		return null;
	}
	function paintChunk(i) {
		const R = chunkRange(i);
		const cw = CHUNK;
		const chh = R.y1 - R.y0;
		const cv = A.canvas(cw, chh);
		const g = cv.getContext('2d');
		const x0 = R.x0;
		const y0 = R.y0;
		const sAt = x => surf(x0 + x) - y0;
		// the surface for shading purposes: a channel full of water counts as filled to its water line
		const sAtW = (x) => {
			const wx = x0 + x;
			let sv = surf(wx);
			for (const wv of W.water) if (wx >= wv.x0 && wx <= wv.x1 && wv.y < sv) sv = wv.y;
			return sv - y0;
		};
		// 1) body path (soil or rock)
		g.save();
		g.beginPath();
		g.moveTo(0, chh);
		for (let x = 0; x <= cw; x += STEP) g.lineTo(x, sAt(x));
		g.lineTo(cw, chh);
		g.closePath();
		g.clip();
		g.fillStyle = A.pattern(g, 'soil', -x0 % 512, -y0 % 512);
		g.fillRect(0, 0, cw, chh);
		// rock body and steep faces get the bedded rock face (cooler grey in the north)
		const rockTex = coldAt(x0 + CHUNK / 2) > 0.45 ? 'rockfaceCold' : 'rockface';
		g.fillStyle = A.pattern(g, rockTex, -x0 % 768, -y0 % 768);
		// bedrock everywhere under a ragged layer of soil (none on the crag and steep faces), so every
		// cut through the ground shows topsoil over stone; near a rock body the soil thins out gradually
		const rockNear = (wx) => {
			let best = 1e9;
			for (let o = -240; o <= 240; o += 24) if (W.body[Math.floor((wx + o) / STEP)] === 1) best = Math.min(best, Math.abs(o));
			return best;
		};
		for (let x = 0; x < cw; x += STEP) {
			const wx = x0 + x;
			const c = Math.floor(wx / STEP);
			const slope = Math.abs(surf(wx + STEP) - surf(wx - STEP)) / (2 * STEP);
			const top = sAt(x);
			let depth;
			if (W.body[c] === 1) depth = 0;
			else {
				depth = 150 + vnoise(wx / 340, 401) * 120 + vnoise(wx / 60, 402) * 26;
				const rn = rockNear(wx);
				if (rn < 240) depth *= rn / 240;
				depth *= Math.max(0, 1 - Math.max(0, slope - 0.6) * 1.6);
			}
			// measure the bedrock line from the lie of the land around, not this column alone, so a ditch or
			// canal doesn't leave a deep tongue of soil under it
			let avg = 0;
			let n = 0;
			for (let o = -240; o <= 240; o += 40) { avg += sAtW(x + o) + y0; n++; }
			const rockTop = Math.max(top, avg / n - y0 + depth);
			g.globalAlpha = 1;
			g.fillRect(x, rockTop, STEP, chh - rockTop);
			// a soft fringe where soil meets stone
			if (rockTop > top + 4) {
				g.globalAlpha = 0.45;
				g.fillRect(x, rockTop - 6, STEP, 6);
			}
		}
		g.globalAlpha = 1;
		// buried stones, bigger and darker the deeper they sit
		const rr = A.rnd(i * 7919 + 13);
		const rocks = ['rock0', 'rock1', 'rock2', 'rock3', 'rock4'];
		for (let k = 0; k < 5; k++) {
			const x = rr() * cw;
			const depth = 70 + rr() * 380;
			const im = A.floraImg(rocks[(rr() * rocks.length) | 0]);
			if (!A.ok(im)) continue;
			const h = 34 + rr() * 70 + depth * 0.12;
			const w = h * im.naturalWidth / im.naturalHeight;
			const top = sAt(x) + depth;
			g.save();
			g.globalAlpha = Math.max(0.18, 0.55 - depth / 900);
			g.drawImage(im, x - w / 2, top - h / 2, w, h);

			g.restore();
		}
		// roots under the turf
		g.strokeStyle = 'rgba(40,26,14,0.55)';
		for (let k = 0; k < 14; k++) {
			const x = rr() * cw;
			const c = Math.floor((x0 + x) / STEP);
			if (W.body[c] === 1 || W.mat[c] === M.cobble || W.mat[c] === M.rock) continue;
			let px = x;
			let py = sAt(x) + 14;
			g.lineWidth = 1.5 + rr() * 2.5;
			g.beginPath();
			g.moveTo(px, py);
			for (let s2 = 0; s2 < 6; s2++) {
				px += (rr() - 0.5) * 30;
				py += 8 + rr() * 14;
				g.lineTo(px, py);
			}
			g.stroke();
		}
		// depth darkening: by the distance to open air (straight down from the surface, or sideways out of a
		// cliff face), so gorge walls and crag faces stay lit while the ground deep under a field goes dark
		{
			const CS = 8;
			const R = SOIL_SHOW;
			const nx = Math.ceil(cw / CS) + 1;
			const ny = Math.ceil(chh / CS) + 1;
			const pad = Math.ceil(R / CS);
			const sc = new Float32Array(nx + pad * 2);
			for (let k = 0; k < sc.length; k++) sc[k] = sAtW((k - pad) * CS);
			const dc = A.canvas(nx, ny);
			const dg = dc.getContext('2d');
			const id = dg.createImageData(nx, ny);
			const D = id.data;
			const stops = [[0, 0], [0.08, 0.12], [0.3, 0.42], [0.62, 0.72], [1, 0.95]];
			const curve = (t) => {
				if (t >= 1) return 0.95;
				for (let q = 1; q < stops.length; q++) if (t <= stops[q][0]) {
					const [a0, b0] = stops[q - 1];
					const [a1, b1] = stops[q];
					return b0 + (b1 - b0) * (t - a0) / (a1 - a0);
				}
				return 0.95;
			};
			// per row: distance to open air = min over columns of (sideways offset + depth below that column's
			// surface), a 1D distance transform done with one sweep each way
			const NT = sc.length;
			const dd = new Float32Array(NT);
			for (let iy = 0; iy < ny; iy++) {
				const y = iy * CS;
				let run = 1e9;
				for (let k = 0; k < NT; k++) {
					const f = Math.max(0, y - sc[k]);
					run = Math.min(f, run + CS);
					dd[k] = run;
				}
				run = 1e9;
				for (let k = NT - 1; k >= 0; k--) {
					run = Math.min(dd[k], run + CS);
					dd[k] = run;
				}
				for (let ix = 0; ix < nx; ix++) {
					const k = ix + pad;
					if (y - sc[k] <= 0) continue;
					const a = curve(dd[k] / SOIL_SHOW);
					const p4 = (iy * nx + ix) * 4;
					D[p4] = 10;
					D[p4 + 1] = 6;
					D[p4 + 2] = 4;
					D[p4 + 3] = Math.round(a * 255);
				}
			}
			dg.putImageData(id, 0, 0);
			g.save();
			g.imageSmoothingEnabled = true;
			g.imageSmoothingQuality = 'low';
			g.drawImage(dc, 0, 0, nx, ny, -CS / 2, -CS / 2, nx * CS, ny * CS);
			g.restore();
		}
		// roots and turf just under the grass
		for (let x = 0; x < cw; x += STEP) {
			const c = Math.floor((x0 + x) / STEP);
			const m = W.mat[c];
			const top = sAt(x);
			if (m === M.meadow || m === M.town || m === M.dry || m === M.cold || m === M.frost) {
				const tg = g.createLinearGradient(0, top, 0, top + 46);
				tg.addColorStop(0, 'rgba(30,22,10,0.55)');
				tg.addColorStop(1, 'rgba(30,22,10,0)');
				g.fillStyle = tg;
				g.fillRect(x, top, STEP, 46);
			}
		}
		g.restore();
		// 2) voids: hollow interiors
		for (const v of W.voids) {
			if (v.x > x0 + cw || v.x + v.w < x0) continue;
			const vx = v.x - x0;
			const vy = v.y - y0;
			g.save();
			g.beginPath();
			if (v.arch) {
				g.moveTo(vx, vy + v.h);
				g.lineTo(vx, vy + v.arch);
				g.quadraticCurveTo(vx, vy, vx + v.arch, vy);
				g.lineTo(vx + v.w - v.arch, vy);
				g.quadraticCurveTo(vx + v.w, vy, vx + v.w, vy + v.arch);
				g.lineTo(vx + v.w, vy + v.h);
			} else g.rect(vx, vy, v.w, v.h);
			g.closePath();
			g.clip();
			g.fillStyle = A.pattern(g, v.wall === 'stone' ? 'stone' : 'deeprock', -x0 % 512, -y0 % 512);
			g.fillRect(vx, vy, v.w, v.h);
			g.fillStyle = v.wall === 'stone' ? 'rgba(12,10,8,0.55)' : 'rgba(8,6,6,0.35)';
			g.fillRect(vx, vy, v.w, v.h);
			// inner shadow along the ceiling and walls
			const sg = g.createLinearGradient(0, vy, 0, vy + 90);
			sg.addColorStop(0, 'rgba(0,0,0,0.6)');
			sg.addColorStop(1, 'rgba(0,0,0,0)');
			g.fillStyle = sg;
			g.fillRect(vx, vy, v.w, 90);
			for (const side of [0, 1]) {
				if (side === 0 && v.openL) continue;
				if (side === 1 && v.openR) continue;
				const ex = side ? vx + v.w - 70 : vx;
				const hg = g.createLinearGradient(side ? vx + v.w : vx, 0, side ? vx + v.w - 70 : vx + 70, 0);
				hg.addColorStop(0, 'rgba(0,0,0,0.55)');
				hg.addColorStop(1, 'rgba(0,0,0,0)');
				g.fillStyle = hg;
				g.fillRect(ex, vy, 70, v.h);
			}
			g.restore();
		}
		// 3) surface strips
		for (let x = -STEP; x < cw + STEP; x += STEP) {
			const wx = x0 + x;
			const c = Math.floor(wx / STEP);
			const m = W.mat[Math.max(0, c)];
			const top = sAt(x);
			const slope = Math.abs(surf(wx + STEP) - surf(wx - STEP)) / (2 * STEP);
			if (slope > 1.3) continue;
			if (inVoid(wx + STEP / 2, surf(wx) + 4) && !inVoid(wx + STEP / 2, surf(wx) - 4)) continue;
			const strip = stripImg(m);
			if (strip && A.ok(strip)) {
				const sw = strip.naturalWidth;
				const sh = strip.naturalHeight;
				const sx = ((wx % sw) + sw) % sw;
				const base = sh * 0.62;
				const w = Math.min(STEP, sw - sx);
				g.drawImage(strip, sx, 0, w, sh, x, top - base, w, sh);
				if (w < STEP) g.drawImage(strip, 0, 0, STEP - w, sh, x + w, top - base, STEP - w, sh);
				if (m === M.snow) {
					// packed snow under the drift: a pale band that thins into the soil
					const sg = g.createLinearGradient(0, top + 8, 0, top + 46);
					sg.addColorStop(0, 'rgba(214,226,238,0.85)');
					sg.addColorStop(1, 'rgba(214,226,238,0)');
					g.fillStyle = sg;
					g.fillRect(x, top + 8, STEP, 38);
				}
			} else if (m === M.cobble || m === M.flag) {
				g.save();
				g.beginPath();
				g.rect(x, top - 6, STEP, 34);
				g.clip();
				g.fillStyle = A.pattern(g, 'cobble', -x0 % 400, top - 6, 1, 0.42);
				g.fillRect(x, top - 6, STEP, 34);
				const cg = g.createLinearGradient(0, top - 6, 0, top + 28);
				cg.addColorStop(0, 'rgba(255,240,215,0.18)');
				cg.addColorStop(0.3, 'rgba(0,0,0,0)');
				cg.addColorStop(1, 'rgba(10,8,6,0.55)');
				g.fillStyle = cg;
				g.fillRect(x, top - 6, STEP, 34);
				g.restore();
			} else if (m === M.dirt || m === M.sand) {
				g.fillStyle = m === M.sand ? '#8a7656' : '#6b5034';
				g.fillRect(x, top - 3, STEP, 12);
				g.fillStyle = m === M.sand ? 'rgba(220,200,160,0.25)' : 'rgba(210,170,120,0.22)';
				g.fillRect(x, top - 3, STEP, 3);
				if (hash(c * 3) < 0.25) {
					g.fillStyle = 'rgba(120,108,92,0.9)';
					g.fillRect(x + 2, top + 1, 4, 3);
				}
			} else if (m === M.rock) {
				g.fillStyle = 'rgba(255,245,220,0.18)';
				g.fillRect(x, top - 1, STEP, 3);
				if (hash(c * 5) < 0.3) {
					g.fillStyle = 'rgba(70,100,40,0.8)';
					g.beginPath();
					g.ellipse(x + 4, top, 6, 3, 0, 0, Math.PI * 2);
					g.fill();
				}
			} else if (m === M.ice) {
				// a glassy skin of ice: pale blue, a bright rim and a few cracks
				const ig = g.createLinearGradient(0, top - 4, 0, top + 20);
				ig.addColorStop(0, '#f2f9ff');
				ig.addColorStop(0.25, '#b9dcf0');
				ig.addColorStop(1, 'rgba(110,160,200,0.6)');
				g.fillStyle = ig;
				g.fillRect(x, top - 4, STEP, 24);
				if (hash(c * 7) < 0.12) {
					g.strokeStyle = 'rgba(255,255,255,0.7)';
					g.lineWidth = 1;
					g.beginPath();
					g.moveTo(x, top + 2);
					g.lineTo(x + STEP, top + 9);
					g.stroke();
				}
			} else if (m === M.plank) {
				g.fillStyle = '#5a3c24';
				g.fillRect(x, top - 4, STEP, 14);
			}
		}
		// 3-) a stone-lined channel: a band of masonry under its bed and up its walls
		for (const wv of W.water) {
			if (!wv.lined || wv.x1 + 60 < x0 || wv.x0 - 60 > x0 + cw) continue;
			const L0 = wv.x0 - 50 - x0;
			const L1 = wv.x1 + 50 - x0;
			g.save();
			g.beginPath();
			g.moveTo(L0, sAt(L0) + 4);
			for (let x = L0; x <= L1; x += 4) g.lineTo(x, sAt(x) - 2);
			for (let x = L1; x >= L0; x -= 4) {
				// thicker under the floor than behind the walls
				const sl = Math.abs(sAt(x + 4) - sAt(x - 4)) / 8;
				g.lineTo(x + (sl > 1 ? (sAt(x + 4) > sAt(x - 4) ? -34 : 34) : 0), sAt(x) + 40);
			}
			g.closePath();
			g.clip();
			g.fillStyle = A.pattern(g, 'stone', -x0 % 400, -y0 % 400, 1, 1);
			g.fillRect(L0 - 60, 0, L1 - L0 + 120, chh);
			g.fillStyle = 'rgba(20,24,26,0.35)';
			g.fillRect(L0 - 60, 0, L1 - L0 + 120, chh);
			g.restore();
		}
		// 3a) a road carried over the crag sits on a dressed stone kerb, not straight on the rock
		for (let x = -STEP; x < cw + STEP; x += STEP) {
			const wx = x0 + x;
			const c = Math.floor(wx / STEP);
			if (W.body[Math.max(0, c)] !== 1) continue;
			const m = W.mat[Math.max(0, c)];
			if (m !== M.cobble && m !== M.flag) continue;
			const slope = Math.abs(surf(wx + STEP) - surf(wx - STEP)) / (2 * STEP);
			if (slope > 1.3) continue;
			if (inVoid(wx + STEP / 2, surf(wx) + 30)) continue;
			const top = sAt(x) + 26;
			const hh = 46 + vnoise(wx / 180, 77) * 26;
			g.save();
			g.beginPath();
			g.rect(x, top, STEP, hh);
			g.clip();
			g.fillStyle = A.pattern(g, 'stone', -x0 % 400, top, 1, 0.42);
			g.fillRect(x, top, STEP, hh);
			const kg = g.createLinearGradient(0, top, 0, top + hh);
			kg.addColorStop(0, 'rgba(0,0,0,0.35)');
			kg.addColorStop(0.12, 'rgba(0,0,0,0.05)');
			kg.addColorStop(0.75, 'rgba(0,0,0,0.15)');
			kg.addColorStop(1, 'rgba(0,0,0,0.55)');
			g.fillStyle = kg;
			g.fillRect(x, top, STEP, hh);
			g.restore();
		}
		// 3b) rock that isn't paved: tufts of turf in the hollows, ferns and shrubs on ledges, moss and ivy over the lips
		const vr = A.rnd(i * 4111 + 7);
		const coldHere = coldAt(x0 + CHUNK / 2);
		const north = coldHere > 0.45;
		const capImg = coldHere > 0.85 ? A.sprite('grassSnow') : north ? A.sprite('grassCold') : A.sprite('grassMeadow');
		for (let x = -STEP; x < cw + STEP; x += STEP) {
			const wx = x0 + x;
			const c = Math.floor(wx / STEP);
			if (W.mat[Math.max(0, c)] !== M.rock) continue;
			const slope = Math.abs(surf(wx + STEP) - surf(wx - STEP)) / (2 * STEP);
			if (slope > 1.0) continue;
			if (inVoid(wx + STEP / 2, surf(wx) + 4) && !inVoid(wx + STEP / 2, surf(wx) - 4)) continue;
			// patchy: long runs of turf broken by bare rock
			const n = vnoise(wx / 260, 913) * 0.7 + vnoise(wx / 70, 917) * 0.3;
			if (n < 0.42 + slope * 0.25) continue;
			if (!capImg || !A.ok(capImg)) continue;
			const top = sAt(x);
			const sw = capImg.naturalWidth;
			const sh = capImg.naturalHeight;
			const sx = ((wx % sw) + sw) % sw;
			const k = Math.min(1, (n - 0.42 - slope * 0.25) * 6);
			const w = Math.min(STEP, sw - sx);
			g.save();
			g.globalAlpha = k;
			g.drawImage(capImg, sx, 0, w, sh, x, top - sh * 0.62, w, sh);
			g.restore();
		}
		const ledgeFlora = coldHere > 0.85 ? ['rock-snow0', 'bush-snow0', 'rock-cold0', 'stump-snow0'] : north ? ['fern0', 'rock-cold0', 'fern1', 'bush2', 'heather0'] : ['fern0', 'fern1', 'bush0', 'bush1', 'rock1', 'rock3', 'bush-flower0'];
		for (let x = 30; x < cw - 30; x += 70 + vr() * 160) {
			const wx = x0 + x;
			const c = Math.floor(wx / STEP);
			if (W.mat[c] !== M.rock) continue;
			const slope = Math.abs(surf(wx + 20) - surf(wx - 20)) / 40;
			if (slope > 0.55 || vr() < 0.35) continue;
			if (inVoid(wx, surf(wx) + 6)) continue;
			const name = ledgeFlora[(vr() * ledgeFlora.length) | 0];
			const im = A.floraImg(name);
			const inf = A.floraInfo(name);
			if (!A.ok(im) || !inf) continue;
			const h = Math.min(100, (name.startsWith('rock') ? 34 : 46) + vr() * 40);
			const k2 = h / inf.h;
			const w = inf.w * k2;
			g.drawImage(im, x - w * inf.ax, sAt(x) - inf.base * k2 + 6, w, h);
		}
		// over steep drops: a moss fringe along the lip and the odd curtain of ivy
		const mossImg = A.sprite('moss');
		for (let x = 0; x < cw; x += STEP) {
			const wx = x0 + x;
			const c = Math.floor(wx / STEP);
			if (W.mat[c] !== M.rock && W.body[c] !== 1) continue;
			const sl = (surf(wx + STEP) - surf(wx - STEP)) / (2 * STEP);
			// only the top lip of a face: a drop to the right starts after flat ground, a rise ends in flat ground
			if (sl > 1.3) { if (Math.abs(surf(wx - STEP) - surf(wx - 3 * STEP)) / (2 * STEP) > 1.0) continue; }
			else if (sl < -1.3) { if (Math.abs(surf(wx + 3 * STEP) - surf(wx + STEP)) / (2 * STEP) > 1.0) continue; }
			else continue;
			const top = sAt(x);
			if (mossImg && A.ok(mossImg) && !north) {
				g.save();
				g.globalAlpha = 0.85;
				g.drawImage(mossImg, ((wx * 1.7) % 400 + 400) % 400, 0, 90, 64, x - 40, top - 8, 90, 64);
				g.restore();
			}
			if (vr() < 0.55) {
				const icy = coldHere > 0.8;
				const im = A.floraImg(icy ? 'icicles0' : vr() < 0.5 ? 'vine0' : 'vine1');
				const inf = A.floraInfo(icy ? 'icicles0' : 'vine0');
				if (A.ok(im) && inf) {
					const h = icy ? 50 + vr() * 70 : 120 + vr() * 160;
					const w = h * im.naturalWidth / im.naturalHeight;
					g.save();
					g.globalAlpha = icy ? 0.9 : north ? 0.6 : 0.95;
					g.drawImage(im, x - w * 0.5, top - 10, w, h);
					g.restore();
				}
			}
		}
		// 4) cliff lips: a little overhanging edge on steep drops
		for (let x = 0; x < cw; x += STEP) {
			const wx = x0 + x;
			const slope = (surf(wx + STEP) - surf(wx - STEP)) / (2 * STEP);
			if (Math.abs(slope) < 1.3) continue;
			const top = sAt(x);
			g.fillStyle = 'rgba(0,0,0,0.18)';
			g.fillRect(x, top, STEP, 30);
		}
		return { cv, x0: R.x0, y0: R.y0, y1: R.y1 };
	}
	let paintedThisFrame = 0;
	function chunk(i) {
		let c = chunks.get(i);
		if (c) {
			c.t = performance.now();
			return c;
		}
		paintedThisFrame++;
		if (!A.texReady() || !A.ok(A.floraImg('rock0')) || !A.ok(A.sprite('grassMeadow'))) return null;
		c = paintChunk(i);
		c.t = performance.now();
		chunks.set(i, c);
		if (chunks.size > 14) {
			const old = [...chunks.entries()].sort((a, b) => a[1].t - b[1].t);
			for (let k = 0; k < old.length - 12; k++) chunks.delete(old[k][0]);
		}
		return c;
	}
	function drawTerrain(ctx, cam, vw, vh) {
		const i0 = Math.floor(cam.x / CHUNK);
		const i1 = Math.floor((cam.x + vw) / CHUNK);
		paintedThisFrame = 0;
		for (let i = i0; i <= i1; i++) {
			if (i < 0 || i * CHUNK > WORLD_W) continue;
			const c = chunk(i);
			if (!c) {
				// fallback until textures load
				ctx.fillStyle = '#4a3a28';
				ctx.beginPath();
				ctx.moveTo(i * CHUNK - cam.x, vh);
				for (let x = i * CHUNK; x <= (i + 1) * CHUNK; x += 32) ctx.lineTo(x - cam.x, surf(x) - cam.y);
				ctx.lineTo((i + 1) * CHUNK - cam.x, vh);
				ctx.fill();
				continue;
			}
			ctx.drawImage(c.cv, Math.round(c.x0 - cam.x), Math.round(c.y0 - cam.y));
			// deep rock under the painted band
			const below = c.y1 - cam.y;
			if (below < vh) {
				ctx.fillStyle = A.pattern(ctx, 'deeprock', -cam.x % 512, -cam.y % 512);
				ctx.fillRect(Math.round(c.x0 - cam.x), Math.round(below) - 1, CHUNK, vh - below + 2);
				ctx.fillStyle = 'rgba(8,6,4,0.88)';
				ctx.fillRect(Math.round(c.x0 - cam.x), Math.round(below) - 1, CHUNK, vh - below + 2);
			}
		}
		// paint the next chunk either side ahead of time (one per frame at most), so walking never waits on a paint
		if (!paintedThisFrame) {
			for (const k of [i1 + 1, i0 - 1, i1 + 2, i0 - 2]) {
				if (k < 0 || k * CHUNK > WORLD_W || chunks.has(k)) continue;
				const c = chunk(k);
				if (c) c.t -= 1;
				break;
			}
		}
	}

	/* ------------------------------------------------------------------ sprites: flora, road props, dress */
	function spriteOf(p) {
		if (p.kind === 'flora') return A.floraImg(p.name);
		if (p.kind === 'road') return A.road(p.name);
		return null;
	}
	function drawSprite(ctx, cam, p, alphaMul) {
		if (p.show && !p.show()) return;
		if (p.kind === 'dress') {
			if (!global.EmberfallProps) return;
			const s = global.EmberfallProps.size(p.name, p.h);
			const x = p.x - s.w / 2;
			const y = p.y - s.h + (p.sink || 0);
			if (x - cam.x > ctx.canvas.width + 50 || x + s.w - cam.x < -50) return;
			global.EmberfallProps.drawOne(ctx, p.name, x, y, cam, s.w, s.h, p.flip);
			return;
		}
		const im = spriteOf(p);
		if (!A.ok(im)) return;
		let ax = 0.5;
		let base = im.naturalHeight;
		if (p.kind === 'flora') {
			const info = A.floraInfo(p.name);
			if (info) {
				ax = info.ax;
				base = info.base;
			}
		}
		const k = p.h / base;
		const w = im.naturalWidth * k;
		const h = im.naturalHeight * k;
		const x = p.x - w * ax;
		const y = p.y - base * k + (p.sink || 0);
		const sx = x - cam.x;
		if (sx > ctx.canvas.width + 60 || sx + w < -60) return;
		const sy = y - cam.y;
		if (sy > ctx.canvas.height + 60 || sy + h < -60) return;
		ctx.save();
		if (alphaMul != null) ctx.globalAlpha *= alphaMul;
		if (p.rot) {
			ctx.translate(sx + w * ax, sy + h);
			ctx.rotate(p.rot);
			ctx.translate(-(sx + w * ax), -(sy + h));
		}
		if (p.alpha != null) ctx.globalAlpha *= p.alpha;
		if (p.sway) {
			const t = performance.now() / 1000;
			const a = Math.sin(t * 0.9 + p.x * 0.013) * p.sway;
			ctx.translate(sx + w * ax, sy + h);
			ctx.transform(1, 0, a, 1, 0, 0);
			ctx.translate(-(sx + w * ax), -(sy + h));
		}
		if (p.flip) {
			ctx.translate(sx + w, sy);
			ctx.scale(-1, 1);
			ctx.drawImage(im, 0, 0, w, h);
		} else ctx.drawImage(im, sx, sy, w, h);
		if (p.tint) {
			ctx.globalCompositeOperation = 'source-atop';
			ctx.fillStyle = p.tint;
			ctx.fillRect(p.flip ? 0 : sx, p.flip ? 0 : sy, w, h);
		}
		ctx.restore();
	}

	/* ------------------------------------------------------------------ buildings */
	function bldPaint(b) {
		return A.get(b.key, () => {
			let r = A[b.type](b.spec);
			if (b.haze) r = A.hazed(r, b.haze[0], b.haze[1]);
			return r;
		});
	}
	function drawBuilding(ctx, cam, b) {
		const sx = b.x - cam.x;
		if (sx > ctx.canvas.width + 900 || sx + b.w < -900) return;
		const r = bldPaint(b);
		if (!r) return;
		const k = b.scale || 1;
		const dx = b.x - r.ox * k - cam.x;
		const dy = b.y - r.oy * k - cam.y;
		if (dy > ctx.canvas.height + 50 || dy + r.cv.height * k < -50) return;
		if (dx > ctx.canvas.width + 50 || dx + r.cv.width * k < -50) return;
		if (k !== 1) ctx.drawImage(r.cv, Math.round(dx), Math.round(dy), r.cv.width * k, r.cv.height * k);
		else ctx.drawImage(r.cv, Math.round(dx), Math.round(dy));
	}

	/* ------------------------------------------------------------------ sky + backdrop */
	const BG = {};
	function bgImg(name) {
		if (!BG[name]) BG[name] = A.img('images/props/' + name + '.png?v=2');
		return BG[name];
	}
	const STRIP = new Map();
	function blitStrip(ctx, img, scroll, y, dw, dh, vw) {
		/* tile a painted band across the view; the band is scaled once and cached, so each frame is a plain copy */
		dw = Math.round(dw);
		dh = Math.round(dh);
		const key = (img.src || img.id || '') + '|' + dw + '|' + dh;
		let cv = STRIP.get(key);
		if (!cv) {
			cv = A.canvas(dw + 1, dh);
			const g = cv.getContext('2d');
			g.imageSmoothingQuality = 'high';
			g.drawImage(img, 0, 0, dw + 1, dh);
			STRIP.set(key, cv);
			if (STRIP.size > 40) STRIP.delete(STRIP.keys().next().value);
		}
		let x = -((scroll % dw) + dw) % dw;
		while (x < vw + 1) {
			ctx.drawImage(cv, Math.round(x), Math.round(y));
			x += dw;
		}
	}
	/* the five clouds in bg-clouds.png: [x, y, w, h] */
	const CLOUDS = [[67, 0, 430, 161], [813, 25, 409, 171], [392, 135, 508, 220], [50, 310, 406, 182], [660, 358, 559, 208]];
	let skylineCv = null;
	function skyline() {
		/* Hazy rooftops and towers of the far side of the city, painted once. */
		if (skylineCv || !A.texReady()) return skylineCv;
		const wv = 2400;
		const hv = 420;
		const c = A.canvas(wv, hv);
		const g = c.getContext('2d');
		// painted three times, one strip-width apart, so roofs that cross the ends wrap round and the band tiles with no cut
		for (const dx of [-wv, 0, wv]) {
		const r = A.rnd(77);
		g.fillStyle = '#7f93a8';
		for (let x = dx; x < wv + dx;) {
			const w = 60 + r() * 120;
			const h = 70 + r() * 120;
			const top = hv - h;
			g.fillRect(x, top, w, h);
			g.beginPath();
			g.moveTo(x - 8, top);
			g.lineTo(x + w / 2, top - 30 - r() * 40);
			g.lineTo(x + w + 8, top);
			g.fill();
			if (r() < 0.18) {
				const tw = 30 + r() * 30;
				g.fillRect(x + w / 2 - tw / 2, top - 120 - r() * 80, tw, 200);
				g.beginPath();
				g.moveTo(x + w / 2 - tw / 2 - 6, top - 120);
				g.lineTo(x + w / 2, top - 200 - r() * 40);
				g.lineTo(x + w / 2 + tw / 2 + 6, top - 120);
				g.fill();
			}
			x += w - 6;
		}
		g.fillStyle = 'rgba(255,214,140,0.5)';
		for (let i = 0; i < 90; i++) g.fillRect(r() * wv + dx, hv - 30 - r() * 120, 3, 4);
		}
		skylineCv = c;
		return c;
	}
	function lerpHex(a, b, t) {
		const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
		const ch = (sh) => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t);
		return 'rgb(' + ch(16) + ',' + ch(8) + ',' + ch(0) + ')';
	}
	let skyCache = null;
	let hazeCache = null;
	function drawBands(ctx, cam, vw, vh, setName, alpha, rest, lift, city) {
		const set = BANDS[setName] || BANDS.farm;
		const bands = [
			{ key: 'far', p: 0.06, h: vh * 0.42 * (set.farScale || 1), lift: vh * (0.06 + (set.farLift || 0)), a: 0.9, ly: 0.12 },
			{ key: 'mid', p: 0.14, h: vh * 0.34, lift: vh * 0.01, a: 0.95, ly: 0.2 },
			{ key: 'near', p: 0.26, h: vh * 0.24, lift: -vh * 0.04, a: 1, ly: 0.32 }
		];
		for (let i = 0; i < bands.length; i++) {
			const b = bands[i];
			const name = set[b.key];
			if (!name) continue;
			const im = bgImg(name);
			if (!A.ok(im)) continue;
			const dh = b.h;
			const dw = Math.max(dh, dh * im.naturalWidth / im.naturalHeight);
			ctx.save();
			ctx.globalAlpha = b.a * alpha;
			blitStrip(ctx, im, cam.x * b.p, rest - dh - b.lift + lift * b.ly, dw, dh, vw);
			ctx.restore();
			if (i === 1 && city) {
				const sk = skyline();
				if (sk) {
					ctx.save();
					ctx.globalAlpha = 0.75 * alpha;
					const kh = vh * 0.3;
					blitStrip(ctx, sk, cam.x * 0.2, rest - kh + vh * 0.05 + lift * 0.26, sk.width * kh / sk.height, kh, vw);
					ctx.restore();
				}
			}
		}
	}
	function drawSky(ctx, cam, vw, vh) {
		const cx = cam.x + vw / 2;
		const cl = climate(cx);
		const cold = Math.round(cl.cold * 10) / 10;
		// height above the lower town: climbing lowers the horizon
		const lift = Math.max(-200, Math.min(900, BASE - (cam.y + vh / 2)));
		// the gradient, sun and halo only change with the coldness and the height you're at: paint them once per step
		const sx = vw * 0.18;
		const sy = vh * 0.16 + lift * 0.02;
		const skey = cold + '|' + vw + '|' + vh + '|' + Math.round(lift / 16);
		if (!skyCache || skyCache.key !== skey) {
			const cv = skyCache && skyCache.cv.width === vw && skyCache.cv.height === vh ? skyCache.cv : A.canvas(vw, vh);
			const g = cv.getContext('2d');
			const sky = g.createLinearGradient(0, 0, 0, vh);
			sky.addColorStop(0, lerpHex('#5d97cc', '#6f93b8', cold));
			sky.addColorStop(0.45, lerpHex('#a9cbe6', '#b8c9da', cold));
			sky.addColorStop(0.8, lerpHex('#e9dcc0', '#d0dbe2', cold));
			sky.addColorStop(1, lerpHex('#f2ddb4', '#d9e0e2', cold));
			g.fillStyle = sky;
			g.fillRect(0, 0, vw, vh);
			const hg = g.createRadialGradient(sx, sy, 10, sx, sy, vh * 0.7);
			hg.addColorStop(0, 'rgba(255,246,214,' + (0.9 - cold * 0.2) + ')');
			hg.addColorStop(0.06, 'rgba(255,236,190,' + (0.55 - cold * 0.2) + ')');
			hg.addColorStop(0.3, 'rgba(255,224,170,0.12)');
			hg.addColorStop(1, 'rgba(255,224,170,0)');
			g.fillStyle = hg;
			g.fillRect(0, 0, vw, vh);
			g.fillStyle = '#fff6da';
			g.beginPath();
			g.arc(sx, sy, 30, 0, Math.PI * 2);
			g.fill();
			skyCache = { key: skey, cv };
		}
		ctx.drawImage(skyCache.cv, 0, 0);
		// clouds drift with time and parallax
		const clouds = bgImg('bg-clouds');
		if (A.ok(clouds)) {
			const t = performance.now() / 1000;
			const dh = vh * 0.24;
			const dw = dh * clouds.naturalWidth / clouds.naturalHeight;
			// a sparse sky: single clouds cut from the painting, one slot every ~430 px of drift and only some slots filled
			ctx.save();
			const sc = dh / clouds.naturalHeight;
			const slot = 430, scroll = cam.x * 0.03 + t * 6;
			const first = Math.floor((scroll - 400) / slot), last = Math.floor((scroll + vw) / slot);
			for (let k = first; k <= last; k++) {
				const h1 = hash(k * 7 + 3), h2 = hash(k * 13 + 5), h3 = hash(k * 29 + 11);
				if (h1 < 0.35) continue;
				const c = CLOUDS[Math.floor(h2 * CLOUDS.length)];
				const z = sc * (0.9 + h3 * 0.6);
				const x = k * slot + h3 * 240 - scroll;
				const y = vh * (0.02 + h2 * 0.14) + lift * (0.05 + h3 * 0.03);
				ctx.globalAlpha = 0.6 + 0.3 * h3;
				ctx.drawImage(clouds, c[0], c[1], c[2], c[3], Math.round(x), Math.round(y), Math.round(c[2] * z), Math.round(c[3] * z));
			}
			ctx.restore();
		}
		// mountains and hills (painted bands), lowered as you climb; two sets cross-fade at a zone edge
		const rest = vh * 0.62 + lift * 0.22;
		const city = cx > 21500 && cx < 54500;
		drawBands(ctx, cam, vw, vh, cl.a, 1 - cl.t, rest, lift, city);
		if (cl.b && cl.t > 0.01) drawBands(ctx, cam, vw, vh, cl.b, cl.t, rest, lift, false);
		// aerial haze toward the ground (a cached band)
		const hkey = cold + '|' + vw + 'x' + vh;
		if (!hazeCache || hazeCache.key !== hkey) {
			const hh = Math.ceil(vh * 0.35);
			const cv = A.canvas(vw, hh);
			const g = cv.getContext('2d');
			const hz = g.createLinearGradient(0, 0, 0, hh);
			hz.addColorStop(0, 'rgba(230,220,200,0)');
			hz.addColorStop(1, cold > 0.5 ? 'rgba(210,222,230,' + (0.3 + cold * 0.12) + ')' : 'rgba(236,222,196,0.35)');
			g.fillStyle = hz;
			g.fillRect(0, 0, vw, hh);
			hazeCache = { key: hkey, cv };
		}
		ctx.drawImage(hazeCache.cv, 0, Math.round(rest - vh * 0.25));
		const low = rest + vh * 0.1;
		if (low < vh) drawMeadow(ctx, cam.x * 0.32, low - 26, vw, vh, cold > 0.5);
	}
	/* The low countryside under the painted bands: fields, hedgerows, copses and grass, painted once into a strip that
	   wraps seamlessly (every feature is drawn at x and x ± the strip width). Shown wherever the view reaches below the
	   bands, and used as the bank texture of far rivers. */
	const MEADOW = {};
	const MW = 1024, MH = 320;
	function meadow(cold) {
		const key = cold ? 'c' : 'w';
		if (MEADOW[key]) return MEADOW[key];
		const cv = A.canvas(MW, MH);
		const g = cv.getContext('2d');
		const r = A.rnd(cold ? 913 : 517);
		const pal = cold
			? { top: '#c9d3d6', bot: '#8c9ca0', patch: ['rgba(235,240,244,0.35)', 'rgba(150,170,175,0.3)', 'rgba(205,215,220,0.35)'], hedge: '#5c6e6c', tree: ['#4f6460', '#64786f', '#40544f'], grass: 'rgba(240,246,250,0.5)' }
			: { top: '#a9b27a', bot: '#5f7a3a', patch: ['rgba(196,178,96,0.32)', 'rgba(92,128,52,0.32)', 'rgba(150,160,80,0.3)'], hedge: '#45622c', tree: ['#3d5a26', '#557a32', '#2f4a1e'], grass: 'rgba(210,225,140,0.45)' };
		const wrap = (fn) => { fn(0); fn(-MW); fn(MW); };
		const bg = g.createLinearGradient(0, 0, 0, MH);
		bg.addColorStop(0, pal.top); bg.addColorStop(1, pal.bot);
		g.fillStyle = bg; g.fillRect(0, 0, MW, MH);
		// soft field patches, flatter toward the horizon
		for (let i = 0; i < 70; i++) {
			const x = r() * MW, y = 20 + r() * (MH - 20), k = 0.35 + y / MH;
			const w = (60 + r() * 160) * k, h = (8 + r() * 22) * k;
			g.fillStyle = pal.patch[i % 3];
			wrap((dx) => { g.beginPath(); g.ellipse(x + dx, y, w, h, 0, 0, Math.PI * 2); g.fill(); });
		}
		// hedgerows: wavy lines of shrubs that run across the fields, closer ones lower and bigger
		for (let row = 0; row < 5; row++) {
			const y0 = 34 + row * row * 11 + row * 18, sz = 2.5 + row * 1.6;
			const a = r() * 6, f = 1 + Math.floor(r() * 3);
			for (let x = 0; x < MW; x += sz * 1.4) {
				const y = y0 + Math.sin(x / MW * Math.PI * 2 * f + a) * (6 + row * 3);
				g.fillStyle = r() < 0.5 ? pal.hedge : pal.tree[row % 3];
				wrap((dx) => { g.beginPath(); g.arc(x + dx, y, sz * (0.7 + r() * 0.6), 0, Math.PI * 2); g.fill(); });
			}
		}
		// copses: little clusters of round trees
		for (let i = 0; i < 26; i++) {
			const x = r() * MW, y = 24 + r() * (MH - 70), sc = 0.5 + y / MH * 1.6;
			const n = 3 + Math.floor(r() * 5);
			for (let j = 0; j < n; j++) {
				const tx = x + (r() - 0.5) * 30 * sc, ty = y + (r() - 0.5) * 6 * sc, tr = (4 + r() * 5) * sc;
				wrap((dx) => {
					g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.ellipse(tx + dx + tr * 0.3, ty + tr * 0.9, tr, tr * 0.3, 0, 0, Math.PI * 2); g.fill();
					g.fillStyle = pal.tree[j % 3]; g.beginPath(); g.arc(tx + dx, ty, tr, 0, Math.PI * 2); g.fill();
					g.fillStyle = cold ? 'rgba(255,255,255,0.35)' : 'rgba(190,210,120,0.25)'; g.beginPath(); g.arc(tx + dx - tr * 0.3, ty - tr * 0.35, tr * 0.5, 0, Math.PI * 2); g.fill();
				});
			}
		}
		// grass ticks in the near part
		g.strokeStyle = pal.grass; g.lineWidth = 1;
		for (let i = 0; i < 900; i++) {
			const x = r() * MW, y = MH * 0.45 + r() * MH * 0.55, h = 2 + (y / MH) * 6;
			wrap((dx) => { g.beginPath(); g.moveTo(x + dx, y); g.lineTo(x + dx + (r() - 0.5) * 2, y - h); g.stroke(); });
		}
		// fade the top edge in, so it melts into the bottom of the painted bands
		g.globalCompositeOperation = 'destination-in';
		const fe = g.createLinearGradient(0, 0, 0, 30);
		fe.addColorStop(0, 'rgba(0,0,0,0)'); fe.addColorStop(1, 'rgba(0,0,0,1)');
		g.fillStyle = fe; g.fillRect(0, 0, MW, MH);
		g.globalCompositeOperation = 'source-over';
		MEADOW[key] = { cv, bot: pal.bot };
		return MEADOW[key];
	}
	function drawMeadow(ctx, scroll, y, vw, vh, cold) {
		const m = meadow(cold);
		y = Math.round(y);
		let x = -((scroll % MW) + MW) % MW;
		for (; x < vw + 1; x += MW) ctx.drawImage(m.cv, Math.round(x), y);
		if (y + MH < vh) { ctx.fillStyle = m.bot; ctx.fillRect(0, y + MH - 1, vw, vh - y - MH + 1); }
	}

	/* ------------------------------------------------------------------ water */
	function drawWater(ctx, cam, vw, vh, front) {
		const t = performance.now() / 1000;
		for (const w of W.water) {
			const x0 = w.x0 - cam.x;
			const x1 = w.x1 - cam.x;
			if (x1 < -20 || x0 > vw + 20) continue;
			const top = w.y - cam.y;
			const bot = w.bed - cam.y;
			if (!front) {
				// the bed behind the water: darker
				continue;
			}
			if (w.frozen) { drawIce(ctx, cam, w, vw, t); continue; }
			if (w.rapids) { drawRapids(ctx, cam, w, vw, vh, t); continue; }
			ctx.save();
			const gr = ctx.createLinearGradient(0, top, 0, bot);
			gr.addColorStop(0, w.cold ? 'rgba(120,160,190,0.55)' : 'rgba(70,130,150,0.55)');
			gr.addColorStop(1, w.cold ? 'rgba(30,60,90,0.85)' : 'rgba(18,48,58,0.88)');
			ctx.fillStyle = gr;
			ctx.beginPath();
			ctx.moveTo(Math.max(x0, -10), top);
			for (let x = Math.max(x0, -10); x <= Math.min(x1, vw + 10); x += 12) {
				const wx = x + cam.x;
				ctx.lineTo(x, top + Math.sin(wx * 0.03 + t * 2.2) * 2 + Math.sin(wx * 0.011 - t * 1.3) * 2);
			}
			// the bottom follows the bed and the banks, so the water never covers the slope above its own surface
			for (let x = Math.min(x1, vw + 10); x >= Math.max(x0, -10); x -= 12) {
				const g = surf(x + cam.x) - cam.y;
				ctx.lineTo(x, Math.max(top - 6, Math.min(bot + 4, g + 4)));
			}
			ctx.closePath();
			ctx.fill();
			// surface highlights drifting with the current
			ctx.strokeStyle = 'rgba(235,248,255,0.55)';
			ctx.lineWidth = 2;
			for (let x = Math.max(x0, -10); x <= Math.min(x1, vw); x += 26) {
				const wx = x + cam.x;
				if (surf(wx) - cam.y < top + 3) continue;
				const ph = (wx * 0.07 + t * (w.flow || 1.4)) % 6;
				if (ph > 2.2) continue;
				ctx.beginPath();
				ctx.moveTo(x + ph * 6, top + 3);
				ctx.lineTo(x + ph * 6 + 12, top + 3);
				ctx.stroke();
			}
			ctx.restore();
		}
	}
	function drawRapids(ctx, cam, w, vw, vh, t) {
		/* A raging river seen side-on as it rushes toward you: a choppy, foaming surface; streaks of current sliding down the
		   face of the water and spreading as they come closer; white water churning at the banks, the rocks and the bridge
		   piers; and a front of froth where the water pours toward the viewer. */
		const x0 = Math.max(w.x0 - cam.x, -10), x1 = Math.min(w.x1 - cam.x, vw + 10);
		if (x1 <= x0) return;
		const top = w.y - cam.y, bot = w.bed - cam.y;
		const cxW = (w.x0 + w.x1) / 2, half = (w.x1 - w.x0) / 2;
		const surfY = (wx) => top + Math.sin(wx * 0.045 + t * 5.2) * 4 + Math.sin(wx * 0.13 - t * 7.3) * 2.4 + Math.sin(wx * 0.017 + t * 1.7) * 3;
		ctx.save();
		// the body, following the bed and the banks below the surface
		ctx.beginPath();
		ctx.moveTo(x0, surfY(x0 + cam.x));
		for (let x = x0; x <= x1; x += 8) ctx.lineTo(x, surfY(x + cam.x));
		ctx.lineTo(x1, surfY(x1 + cam.x));
		for (let x = x1; x >= x0; x -= 12) ctx.lineTo(x, Math.max(top - 8, Math.min(bot + 4, surf(x + cam.x) - cam.y + 4)));
		ctx.closePath();
		const gr = ctx.createLinearGradient(0, top - 6, 0, bot);
		gr.addColorStop(0, 'rgba(120,175,185,0.72)');
		gr.addColorStop(0.25, 'rgba(52,108,124,0.82)');
		gr.addColorStop(1, 'rgba(14,40,52,0.93)');
		ctx.fillStyle = gr;
		ctx.fill();
		ctx.clip();
		// current: streaks sliding down the face toward the viewer, spreading out from the middle of the river as they come
		ctx.lineCap = 'round';
		const depth = Math.max(30, bot - top);
		for (let lane = 0; lane < (w.x1 - w.x0) / 22; lane++) {
			const wx = w.x0 + 11 + lane * 22;
			if (wx - cam.x < x0 - 30 || wx - cam.x > x1 + 30) continue;
			for (let k = 0; k < 2; k++) {
				const sp = 0.55 + hash(lane * 7 + k * 13) * 0.6;
				const ph = (t * sp + hash(lane * 3 + k * 29)) % 1;
				const p0 = ph * ph, p1 = Math.min(1, ph + 0.18) * Math.min(1, ph + 0.18);
				const spread = (wx - cxW) / half * 26;
				const xa = wx - cam.x + spread * p0, xb = wx - cam.x + spread * p1;
				const ya = top + 6 + p0 * depth * 0.95, yb = top + 6 + p1 * depth * 0.95;
				ctx.strokeStyle = 'rgba(225,245,250,' + (0.12 + 0.38 * ph) * (1 - ph * 0.5) + ')';
				ctx.lineWidth = 1 + ph * 2.2;
				ctx.beginPath(); ctx.moveTo(xa, ya); ctx.lineTo(xb, yb); ctx.stroke();
			}
		}
		// churning white water: a froth band under the surface, and boils around the rocks, the piers and the banks
		const foamAt = (fx, r, a) => {
			const sx = fx - cam.x; if (sx < -r * 2 || sx > vw + r * 2) return;
			for (let k = 0; k < 7; k++) {
				const ang = t * (2.4 + k * 0.37) + k * 1.9 + fx * 0.01;
				const px = sx + Math.cos(ang) * r * (0.35 + 0.5 * hash(k + fx)), py = surfY(fx) + 6 + Math.abs(Math.sin(ang * 1.3)) * r * 0.55;
				const rr = r * (0.28 + 0.22 * Math.abs(Math.sin(ang * 0.7 + k)));
				ctx.fillStyle = 'rgba(245,252,255,' + a * (0.45 + 0.35 * Math.abs(Math.sin(ang))) + ')';
				ctx.beginPath(); ctx.ellipse(px, py, rr * 1.4, rr, 0, 0, Math.PI * 2); ctx.fill();
			}
		};
		for (const fx of (w.boils || [])) foamAt(fx, 46, 0.75);
		foamAt(w.x0 + 40, 40, 0.6); foamAt(w.x1 - 40, 40, 0.6);
		ctx.restore();
		// the crest of the surface: broken white highlights racing along it, and froth riding the chop
		ctx.save();
		ctx.strokeStyle = 'rgba(240,252,255,0.8)';
		ctx.lineWidth = 2.5;
		ctx.beginPath();
		let pen = false;
		for (let x = x0; x <= x1; x += 6) {
			const wx = x + cam.x;
			const on = Math.sin(wx * 0.06 - t * 6) + Math.sin(wx * 0.021 + t * 2.3) > 0.2;
			const y = surfY(wx) + 1;
			if (on) { if (!pen) ctx.moveTo(x, y); else ctx.lineTo(x, y); pen = true; } else pen = false;
		}
		ctx.stroke();
		for (let x = x0; x <= x1; x += 14) {
			const wx = x + cam.x;
			const f = Math.sin(wx * 0.09 + t * 8) * 0.5 + Math.sin(wx * 0.033 - t * 3.1) * 0.5;
			if (f < 0.35) continue;
			ctx.fillStyle = 'rgba(250,255,255,' + (0.35 + f * 0.45) + ')';
			ctx.beginPath(); ctx.ellipse(x, surfY(wx) - 1, 6 + f * 6, 3 + f * 2, 0, 0, Math.PI * 2); ctx.fill();
		}
		ctx.restore();
	}
	function drawIce(ctx, cam, w, vw, t) {
		/* A frozen pool or stream: a sheet of pale blue ice over dark water, snow drifted on its edges, cracks and a
		   slow glint sliding across it. */
		const x0 = Math.max(w.x0 - cam.x, -20);
		const x1 = Math.min(w.x1 - cam.x, vw + 20);
		const top = w.y - cam.y;
		const bot = w.bed - cam.y;
		ctx.save();
		ctx.beginPath();
		ctx.moveTo(x0, top);
		ctx.lineTo(x1, top);
		for (let x = x1; x >= x0; x -= 12) ctx.lineTo(x, Math.max(top + 4, Math.min(bot + 4, surf(x + cam.x) - cam.y + 4)));
		ctx.closePath();
		const g = ctx.createLinearGradient(0, top, 0, bot);
		g.addColorStop(0, 'rgba(225,242,252,0.95)');
		g.addColorStop(0.12, 'rgba(160,205,230,0.9)');
		g.addColorStop(1, 'rgba(40,70,100,0.92)');
		ctx.fillStyle = g;
		ctx.fill();
		ctx.clip();
		ctx.strokeStyle = 'rgba(255,255,255,0.55)';
		ctx.lineWidth = 1.2;
		for (let k = 0; k < (w.x1 - w.x0) / 140; k++) {
			const cx = w.x0 + 60 + k * 140 + hash(k + w.x0) * 60 - cam.x;
			if (cx < -100 || cx > vw + 100) continue;
			ctx.beginPath();
			ctx.moveTo(cx, top + 2);
			ctx.lineTo(cx + 18 + hash(k * 3) * 20, top + 14 + hash(k * 5) * 18);
			ctx.lineTo(cx + 6, top + 30 + hash(k * 7) * 30);
			ctx.stroke();
		}
		const gl = ((t * 40) % (w.x1 - w.x0 + 400)) - 200 + w.x0 - cam.x;
		const sg = ctx.createLinearGradient(gl - 80, 0, gl + 80, 0);
		sg.addColorStop(0, 'rgba(255,255,255,0)');
		sg.addColorStop(0.5, 'rgba(255,255,255,0.35)');
		sg.addColorStop(1, 'rgba(255,255,255,0)');
		ctx.fillStyle = sg;
		ctx.fillRect(gl - 80, top, 160, 10);
		ctx.restore();
		// rim of snow along the top
		ctx.fillStyle = 'rgba(244,248,252,0.95)';
		ctx.fillRect(x0, top - 3, x1 - x0, 4);
	}
	function waterAt(x) {
		for (const w of W.water) if (x >= w.x0 && x <= w.x1) return w;
		return null;
	}

	global.EmberfallWorld = {
		meadow,
		W, ground, rough, material, rockBody, flatten, surf, inVoid, solidAt, collide, footY, setInside,
		stairSurface, drawTerrain, drawSprite, drawBuilding, drawSky, drawWater, waterAt, hash, vnoise, chunks,
		zone, zoneAt, coldAt, climate, propsNear, BANDS
	};
})(typeof window !== 'undefined' ? window : globalThis);
