/* =============================================================
   Glacial Reach — ice-only environment art library.

   Everything here exists so an empty Ice Dungeon room still reads as
   an Ice Dungeon: layered glacier strata, translucent ice masses with
   real depth, water seen through ice, and ancient ruins swallowed by
   the glacier. Nothing in this file is shared with the fire dungeon.

   Screen-space renderer. Callers pass already-culled screen coords.
   ============================================================= */
(function(global){

	/* ---------------- palette ----------------
	   Cold hues only. Ancient stone is desaturated blue-grey so ruins
	   read as "buried in the glacier" rather than "generic dungeon". */
	const PAL = {
		voidDeep:   '#04101c',
		iceDeep:    '#0b2138',
		iceDark:    '#13405f',
		iceMid:     '#2c6f9c',
		iceLit:     '#54a3c9',
		iceBright:  '#9ad4ec',
		iceWhite:   '#e6f5ff',
		snow:       '#f2f9ff',
		snowShade:  '#c3d8e8',
		waterDeep:  '#061c30',
		waterMid:   '#0d3a5c',
		waterLit:   '#1f6f9e',
		stoneDark:  '#2b333c',
		stoneMid:   '#495663',
		stoneLit:   '#6d7d8c',
		stoneEdge:  '#8a9aa8',
		glyph:      '#8fe0ff',
		glyphCore:  '#e8fbff',
		rune:       '#5fc8f0',
	};

	/* Deterministic per-instance variation: props must not shimmer
	   between frames just because they were re-drawn. */
	function hash(n){
		let x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
		return x - Math.floor(x);
	}
	function hash2(a, b){ return hash(a * 1.37 + b * 7.91); }
	function pick(a, b, t){ return a + (b - a) * t; }
	function T(){ return Date.now() * 0.001; }

	/* Gradients are expensive to rebuild every frame, so they are built
	   in local space around the origin and cached by shape, then the
	   context is translated to the prop. */
	const bakeCache = new Map();
	function bake(key, w, h, paint){
		let el = bakeCache.get(key);
		if(el) return el;
		if(typeof document === 'undefined') return null;
		el = document.createElement('canvas');
		el.width = Math.max(1, Math.ceil(w));
		el.height = Math.max(1, Math.ceil(h));
		paint(el.getContext('2d'));
		bakeCache.set(key, el);
		return el;
	}
	const gradCache = new Map();
	function lin(ctx, key, x0, y0, x1, y1, stops){
		const k = 'l' + key;
		let g = gradCache.get(k);
		if(!g){
			g = ctx.createLinearGradient(x0, y0, x1, y1);
			for(const s of stops) g.addColorStop(s[0], s[1]);
			gradCache.set(k, g);
		}
		return g;
	}
	function rad(ctx, key, x, y, r, stops){
		const k = 'r' + key;
		let g = gradCache.get(k);
		if(!g){
			g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(1, r));
			for(const s of stops) g.addColorStop(s[0], s[1]);
			gradCache.set(k, g);
		}
		return g;
	}

	/* ---------------- shared ice-mass helpers ---------------- */

	/* Translucent ice body: depth gradient, internal facets, rim light.
	   This is the visual signature reused by shelves, columns, bridges
	   and platforms so the whole dungeon looks carved from one glacier. */
	function iceMass(ctx, w, h, opt){
		opt = opt || {};
		const seed = opt.seed || 0;
		const alpha = opt.alpha == null ? 0.9 : opt.alpha;
		const baked = bake('im' + Math.round(w) + '_' + Math.round(h) + '_' + seed.toFixed(3) + '_' + alpha.toFixed(2), w, h, function(g){
			paintIceMass(g, w, h, seed, 1);
		});
		if(baked){
			ctx.globalAlpha = alpha;
			ctx.drawImage(baked, 0, 0);
			ctx.globalAlpha = 1;
			return;
		}
		paintIceMass(ctx, w, h, seed, alpha);
	}
	function paintIceMass(ctx, w, h, seed, alpha){
		ctx.globalAlpha = alpha;
		ctx.fillStyle = lin(ctx, 'im' + Math.round(w) + '_' + Math.round(h), 0, 0, 0, h, [
			[0, PAL.iceBright],
			[0.18, PAL.iceLit],
			[0.55, PAL.iceMid],
			[0.86, PAL.iceDark],
			[1, PAL.iceDeep],
		]);
		ctx.fillRect(0, 0, w, h);

		/* Internal facets — long shallow planes catching light. */
		const facets = Math.max(2, Math.round(w / 46));
		for(let i = 0; i < facets; i++){
			const r = hash2(seed + i, 3.1);
			const fx = (i / facets) * w + r * 10;
			const fw = w / facets * pick(0.35, 0.9, hash2(seed + i, 8.2));
			ctx.globalAlpha = alpha * pick(0.06, 0.17, r);
			ctx.fillStyle = PAL.iceWhite;
			ctx.beginPath();
			ctx.moveTo(fx, h);
			ctx.lineTo(fx + fw * 0.45, 0);
			ctx.lineTo(fx + fw, 0);
			ctx.lineTo(fx + fw * 0.55, h);
			ctx.closePath();
			ctx.fill();
		}

		/* Rim light on the top edge, ambient occlusion underneath. */
		ctx.globalAlpha = alpha * 0.85;
		ctx.fillStyle = PAL.snow;
		ctx.fillRect(0, 0, w, Math.max(1.5, h * 0.05));
		ctx.globalAlpha = alpha * 0.4;
		ctx.fillStyle = PAL.iceWhite;
		ctx.fillRect(0, Math.max(1.5, h * 0.05), w, 1);
		ctx.globalAlpha = alpha * 0.5;
		ctx.fillStyle = PAL.voidDeep;
		ctx.fillRect(0, h - Math.max(1.5, h * 0.06), w, Math.max(1.5, h * 0.06));
		ctx.globalAlpha = 1;
	}

	/* Horizontal compression bands — the single strongest visual cue
	   that a wall is glacier ice and not tinted rock. */
	function strata(ctx, w, h, seed, density){
		const bands = Math.max(3, Math.round(h / (density || 26)));
		for(let i = 0; i < bands; i++){
			const t = i / bands;
			const r = hash2(seed + i, 17.3);
			const by = t * h + r * 4;
			const bh = pick(1, 3.4, r);
			ctx.globalAlpha = pick(0.05, 0.15, hash2(seed + i, 4.4));
			ctx.fillStyle = i % 3 === 0 ? PAL.iceWhite : PAL.iceBright;
			/* Bands sag slightly — glacier flow, not a ruled line. */
			ctx.beginPath();
			ctx.moveTo(0, by);
			ctx.quadraticCurveTo(w * 0.5, by + pick(-3, 6, r), w, by + pick(-2, 3, hash2(seed + i, 9.9)));
			ctx.lineTo(w, by + bh);
			ctx.quadraticCurveTo(w * 0.5, by + bh + pick(-3, 6, r), 0, by + bh);
			ctx.closePath();
			ctx.fill();
		}
		ctx.globalAlpha = 1;
	}

	/* Trapped air bubbles — reads as depth inside the ice. */
	function bubbles(ctx, w, h, n, seed){
		for(let i = 0; i < n; i++){
			const bx = hash2(seed + i, 1.7) * w;
			const by = hash2(seed + i, 5.3) * h;
			const br = pick(0.8, 2.6, hash2(seed + i, 11.1));
			ctx.globalAlpha = pick(0.12, 0.34, hash2(seed + i, 2.9));
			ctx.fillStyle = PAL.iceWhite;
			ctx.beginPath();
			ctx.arc(bx, by, br, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.globalAlpha = 1;
	}

	/* Branching crack web. Used for stress fractures and thin ice. */
	function crackWeb(ctx, cx, cy, r, n, seed, color, width){
		ctx.strokeStyle = color || 'rgba(230,245,255,0.55)';
		ctx.lineWidth = width || 1;
		for(let i = 0; i < n; i++){
			const a = (i / n) * Math.PI * 2 + hash2(seed + i, 3.7) * 0.9;
			let px = cx, py = cy;
			ctx.beginPath();
			ctx.moveTo(px, py);
			const segs = 3;
			for(let s = 0; s < segs; s++){
				const len = r / segs * pick(0.6, 1.25, hash2(seed + i * 5 + s, 6.1));
				const wob = (hash2(seed + i * 3 + s, 12.7) - 0.5) * 0.8;
				px += Math.cos(a + wob) * len;
				py += Math.sin(a + wob) * len;
				ctx.lineTo(px, py);
			}
			ctx.stroke();
		}
	}

	/* A single icicle with translucency and an inner light core. */
	function icicle(ctx, x, y, len, wid, seed){
		const g = lin(ctx, 'ic' + Math.round(len), 0, 0, 0, len, [
			[0, 'rgba(214,240,252,0.92)'],
			[0.45, 'rgba(126,196,228,0.78)'],
			[1, 'rgba(196,235,252,0.34)'],
		]);
		ctx.save();
		ctx.translate(x, y);
		ctx.fillStyle = g;
		ctx.beginPath();
		ctx.moveTo(-wid / 2, 0);
		ctx.quadraticCurveTo(-wid * 0.32, len * 0.62, 0, len);
		ctx.quadraticCurveTo(wid * 0.32, len * 0.62, wid / 2, 0);
		ctx.closePath();
		ctx.fill();
		/* Light guide down the core. */
		ctx.globalAlpha = 0.6;
		ctx.fillStyle = PAL.snow;
		ctx.beginPath();
		ctx.moveTo(-wid * 0.16, 0);
		ctx.quadraticCurveTo(-wid * 0.06, len * 0.55, 0, len * 0.86);
		ctx.quadraticCurveTo(wid * 0.1, len * 0.5, wid * 0.14, 0);
		ctx.closePath();
		ctx.fill();
		/* Root collar where it grips the ceiling. */
		ctx.globalAlpha = 0.75;
		ctx.fillStyle = PAL.iceBright;
		ctx.fillRect(-wid * 0.62, 0, wid * 1.24, Math.max(1.5, len * 0.05));
		ctx.globalAlpha = 1;
		/* Meltwater bead, slow and stable per-instance. */
		const drip = (T() * 0.42 + hash(seed) ) % 1;
		if(drip > 0.72){
			ctx.fillStyle = 'rgba(226,246,255,0.7)';
			ctx.beginPath();
			ctx.arc(0, len + (drip - 0.72) * 26, 1.7, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.restore();
	}

	/* Water seen through/behind ice: depth gradient plus slow drift. */
	function waterBody(ctx, w, h, seed, flow){
		ctx.fillStyle = lin(ctx, 'wb' + Math.round(w) + '_' + Math.round(h), 0, 0, 0, h, [
			[0, PAL.waterLit],
			[0.35, PAL.waterMid],
			[1, PAL.waterDeep],
		]);
		ctx.fillRect(0, 0, w, h);
		const lanes = Math.max(2, Math.round(h / 14));
		for(let i = 0; i < lanes; i++){
			const ly = (i + 0.5) * (h / lanes);
			const spd = (flow || 1) * pick(6, 20, hash2(seed + i, 2.2));
			const off = ((T() * spd) % (w + 90)) - 45;
			const lw = pick(24, 70, hash2(seed + i, 7.7));
			ctx.globalAlpha = pick(0.05, 0.16, hash2(seed + i, 5.5));
			ctx.fillStyle = PAL.iceBright;
			ctx.fillRect(off, ly, lw, 1.4);
		}
		ctx.globalAlpha = 1;
	}

	/* Weathered ancient stone with a frost line and ice creeping up it. */
	function ancientStone(ctx, w, h, seed){
		ctx.fillStyle = lin(ctx, 'as' + Math.round(w) + '_' + Math.round(h), 0, 0, w, h, [
			[0, PAL.stoneMid],
			[0.5, PAL.stoneDark],
			[1, PAL.stoneMid],
		]);
		ctx.fillRect(0, 0, w, h);
		/* Course lines — cut blocks, not noise. */
		const courses = Math.max(2, Math.round(h / 34));
		ctx.strokeStyle = 'rgba(10,18,26,0.5)';
		ctx.lineWidth = 1;
		for(let i = 1; i < courses; i++){
			const cy = (i / courses) * h;
			ctx.beginPath();
			ctx.moveTo(0, cy);
			ctx.lineTo(w, cy);
			ctx.stroke();
			const jx = hash2(seed + i, 3.3) * w * 0.7 + w * 0.15;
			ctx.beginPath();
			ctx.moveTo(jx, cy);
			ctx.lineTo(jx, cy + h / courses);
			ctx.stroke();
		}
		ctx.strokeStyle = 'rgba(150,170,188,0.28)';
		for(let i = 1; i < courses; i++){
			const cy = (i / courses) * h;
			ctx.beginPath();
			ctx.moveTo(0, cy + 1);
			ctx.lineTo(w, cy + 1);
			ctx.stroke();
		}
		/* Ice creeping up from the floor. */
		ctx.globalAlpha = 0.5;
		ctx.fillStyle = lin(ctx, 'asf' + Math.round(h), 0, h * 0.55, 0, h, [
			[0, 'rgba(154,212,236,0)'],
			[1, 'rgba(200,235,250,0.85)'],
		]);
		ctx.fillRect(0, h * 0.55, w, h * 0.45);
		ctx.globalAlpha = 1;
	}

	/* Carved glyph row. Ancient language of the glacier ruins. */
	function glyphRow(ctx, w, seed, scale, glow){
		const n = Math.max(2, Math.round(w / (14 * (scale || 1))));
		const pulse = 0.55 + Math.sin(T() * 1.1 + seed) * 0.2;
		for(let i = 0; i < n; i++){
			const gx = (i + 0.5) * (w / n);
			const form = Math.floor(hash2(seed + i, 4.9) * 5);
			const s = 5 * (scale || 1);
			ctx.save();
			ctx.translate(gx, 0);
			ctx.strokeStyle = glow ? `rgba(143,224,255,${pulse})` : 'rgba(120,160,185,0.55)';
			ctx.lineWidth = 1.4 * (scale || 1);
			ctx.beginPath();
			if(form === 0){ ctx.moveTo(-s, -s); ctx.lineTo(s, -s); ctx.lineTo(0, s); ctx.closePath(); }
			else if(form === 1){ ctx.moveTo(0, -s); ctx.lineTo(0, s); ctx.moveTo(-s, 0); ctx.lineTo(s, 0); }
			else if(form === 2){ ctx.arc(0, 0, s * 0.8, 0, Math.PI * 2); }
			else if(form === 3){ ctx.moveTo(-s, s); ctx.lineTo(0, -s); ctx.lineTo(s, s); }
			else { ctx.moveTo(-s, -s); ctx.lineTo(s, s); ctx.moveTo(s, -s); ctx.lineTo(-s, s); }
			ctx.stroke();
			if(glow){
				ctx.globalAlpha = pulse * 0.35;
				ctx.strokeStyle = PAL.glyphCore;
				ctx.lineWidth = 0.7 * (scale || 1);
				ctx.stroke();
				ctx.globalAlpha = 1;
			}
			ctx.restore();
		}
	}

	/* ---------------- prop renderers ----------------
	   Each takes (ctx, dec, sx, sy) in screen space. */

	const DRAW = {

		/* === NATURAL ICE === */

		/* Enormous layered wall face. The dungeon's backbone prop. */
		glacierWall(ctx, d, sx, sy){
			const w = d.w || 400, h = d.h || 600;
			const seed = d.x * 0.013 + d.y * 0.007;
			const alpha = d.alpha == null ? 0.82 : d.alpha;
			const baked = bake('gw' + Math.round(w) + '_' + Math.round(h) + '_' + seed.toFixed(3), w, h, function(g){
				g.fillStyle = lin(g, 'gw' + Math.round(w) + '_' + Math.round(h), 0, 0, w * 0.35, h, [
					[0, PAL.iceDark],
					[0.4, PAL.iceDeep],
					[1, PAL.voidDeep],
				]);
				g.fillRect(0, 0, w, h);
				strata(g, w, h, seed, 30);
				bubbles(g, w, h, Math.round(w * h / 5200), seed);
				const planes = Math.max(1, Math.round(w / 150));
				for(let i = 0; i < planes; i++){
					const px = pick(0.08, 0.92, hash2(seed + i, 6.6)) * w;
					g.globalAlpha = 0.1;
					g.fillStyle = PAL.iceWhite;
					g.beginPath();
					g.moveTo(px, 0);
					g.lineTo(px + 12, h);
					g.lineTo(px + 26, h);
					g.lineTo(px + 10, 0);
					g.closePath();
					g.fill();
				}
				g.globalAlpha = 1;
			});
			ctx.save();
			ctx.globalAlpha = alpha;
			if(baked) ctx.drawImage(baked, sx, sy);
			ctx.globalAlpha = 1;
			ctx.restore();
		},

		/* Shelf jutting from a wall, snow on top, icicles beneath. */
		iceShelf(ctx, d, sx, sy){
			const w = d.w || 180, h = Math.min(d.h || 14, 14);
			const seed = d.x * 0.021;
			ctx.save();
			ctx.translate(sx, sy);
			/* Thin cap only — a thick slab above the tiles looks walkable
			   and then the player falls through it. */
			iceMass(ctx, w, h, { seed: seed, alpha: 0.94 });
			ctx.fillStyle = PAL.snow;
			ctx.globalAlpha = 0.9;
			ctx.beginPath();
			ctx.moveTo(0, 0);
			for(let i = 0; i <= 8; i++){
				const t = i / 8;
				ctx.lineTo(t * w, -2 - Math.sin(t * Math.PI) * pick(2, 6, hash2(seed, 3.2)) - hash2(seed + i, 1.9) * 2);
			}
			ctx.lineTo(w, 0);
			ctx.closePath();
			ctx.fill();
			ctx.globalAlpha = 1;
			/* Underside icicles stay inside this shelf's width. */
			const n = Math.max(2, Math.round(w / 36));
			for(let i = 0; i < n; i++){
				const ix = (i + 0.5) * (w / n);
				icicle(ctx, ix, h, pick(8, 16, hash2(seed + i, 7.4)), pick(4, 6, hash2(seed + i, 2.4)), seed + i);
			}
			ctx.restore();
		},

		icicleCluster(ctx, d, sx, sy){
			const w = d.w || 90;
			const seed = d.x * 0.017;
			const n = d.n || Math.max(3, Math.round(w / 20));
			ctx.save();
			ctx.translate(sx, sy);
			/* Frozen mass they grow out of. */
			ctx.globalAlpha = 0.5;
			ctx.fillStyle = PAL.iceBright;
			ctx.beginPath();
			ctx.moveTo(0, 0);
			ctx.lineTo(w, 0);
			ctx.lineTo(w * 0.82, 7);
			ctx.lineTo(w * 0.2, 7);
			ctx.closePath();
			ctx.fill();
			ctx.globalAlpha = 1;
			for(let i = 0; i < n; i++){
				const ix = pick(0.06, 0.94, hash2(seed + i, 5.1)) * w;
				const len = pick(0.4, 1, hash2(seed + i, 9.3)) * (d.h || 40);
				icicle(ctx, ix, 2, len, pick(4, 9, hash2(seed + i, 3.8)), seed + i);
			}
			ctx.restore();
		},

		/* Floor-to-ceiling fluted column of clear ice. */
		iceColumn(ctx, d, sx, sy){
			const w = d.w || 44, h = d.h || 200;
			const seed = d.x * 0.019;
			ctx.save();
			ctx.translate(sx, sy);
			/* Waist taper reads as natural growth. */
			ctx.globalAlpha = 0.88;
			ctx.fillStyle = lin(ctx, 'colb' + Math.round(w) + '_' + Math.round(h), 0, 0, w, 0, [
				[0, PAL.iceDeep],
				[0.28, PAL.iceMid],
				[0.5, PAL.iceBright],
				[0.72, PAL.iceLit],
				[1, PAL.iceDark],
			]);
			ctx.beginPath();
			ctx.moveTo(0, 0);
			ctx.quadraticCurveTo(-w * 0.1, h * 0.5, 0, h);
			ctx.lineTo(w, h);
			ctx.quadraticCurveTo(w * 1.1, h * 0.5, w, 0);
			ctx.closePath();
			ctx.fill();
			/* Flutes. */
			for(let i = 0; i < 4; i++){
				const fx = (i + 0.6) * (w / 5);
				ctx.globalAlpha = i % 2 ? 0.13 : 0.24;
				ctx.fillStyle = PAL.snow;
				ctx.fillRect(fx, h * 0.03, Math.max(1.4, w * 0.06), h * 0.94);
			}
			/* Internal stress fracture. */
			ctx.globalAlpha = 0.4;
			crackWeb(ctx, w * 0.5, h * pick(0.3, 0.7, hash2(seed, 1.1)), Math.min(w, 26), 3, seed, 'rgba(230,245,255,0.5)', 1);
			ctx.globalAlpha = 1;
			/* Collars top and bottom where it fuses to floor/ceiling. */
			ctx.fillStyle = PAL.iceBright;
			ctx.globalAlpha = 0.75;
			ctx.beginPath();
			ctx.ellipse(w / 2, h, w * 0.85, w * 0.28, 0, 0, Math.PI * 2);
			ctx.fill();
			ctx.beginPath();
			ctx.ellipse(w / 2, 0, w * 0.78, w * 0.24, 0, 0, Math.PI * 2);
			ctx.fill();
			ctx.globalAlpha = 1;
			ctx.restore();
		},

		iceArch(ctx, d, sx, sy){
			const w = d.w || 220, h = d.h || 120;
			const seed = d.x * 0.015;
			ctx.save();
			ctx.translate(sx, sy);
			const th = Math.max(12, h * 0.2);
			ctx.globalAlpha = 0.86;
			ctx.fillStyle = lin(ctx, 'arc' + Math.round(w) + '_' + Math.round(h), 0, 0, 0, h, [
				[0, PAL.iceBright],
				[0.5, PAL.iceMid],
				[1, PAL.iceDeep],
			]);
			ctx.beginPath();
			ctx.moveTo(0, h);
			ctx.lineTo(0, h - th);
			ctx.quadraticCurveTo(w * 0.5, -h * 0.35, w, h - th);
			ctx.lineTo(w, h);
			ctx.lineTo(w - th, h);
			ctx.quadraticCurveTo(w * 0.5, h * 0.16, th, h);
			ctx.closePath();
			ctx.fill();
			ctx.globalAlpha = 0.55;
			ctx.strokeStyle = PAL.snow;
			ctx.lineWidth = 1.5;
			ctx.beginPath();
			ctx.moveTo(2, h - th);
			ctx.quadraticCurveTo(w * 0.5, -h * 0.3, w - 2, h - th);
			ctx.stroke();
			ctx.globalAlpha = 1;
			/* Icicles hanging from the inner curve. */
			for(let i = 1; i < 5; i++){
				const t = i / 5;
				const ix = t * w;
				const iy = h * 0.16 + Math.sin(t * Math.PI) * -h * 0.42 + h * 0.42;
				icicle(ctx, ix, iy, pick(10, 24, hash2(seed + i, 4.2)), 6, seed + i);
			}
			ctx.restore();
		},

		/* Big faceted crystal cluster. Blocks sight, catches light. */
		crystalCluster(ctx, d, sx, sy){
			const w = d.w || 90, h = d.h || 150;
			const seed = d.x * 0.023 + d.y * 0.011;
			const shards = d.n || 4;
			ctx.save();
			ctx.translate(sx, sy);
			/* Cold light bloom behind the cluster. */
			ctx.globalAlpha = 0.16 + Math.sin(T() * 0.8 + seed) * 0.05;
			ctx.fillStyle = rad(ctx, 'cg' + Math.round(w), w / 2, h * 0.55, w * 1.5, [
				[0, PAL.glyph],
				[0.45, 'rgba(95,200,240,0.35)'],
				[1, 'transparent'],
			]);
			ctx.beginPath();
			ctx.arc(w / 2, h * 0.55, w * 1.5, 0, Math.PI * 2);
			ctx.fill();
			ctx.globalAlpha = 1;
			for(let i = 0; i < shards; i++){
				const t = i / Math.max(1, shards - 1);
				const bx = pick(w * 0.12, w * 0.88, t) + (hash2(seed + i, 2.7) - 0.5) * w * 0.14;
				const sh = h * pick(0.45, 1, hash2(seed + i, 8.8));
				const sw = w * pick(0.16, 0.3, hash2(seed + i, 5.2));
				const lean = (hash2(seed + i, 3.4) - 0.5) * 0.5;
				ctx.save();
				ctx.translate(bx, h);
				ctx.rotate(lean);
				/* Lit face. */
				ctx.fillStyle = lin(ctx, 'cs' + Math.round(sw) + '_' + Math.round(sh), 0, -sh, sw, 0, [
					[0, PAL.iceWhite],
					[0.4, PAL.iceBright],
					[1, PAL.iceMid],
				]);
				ctx.globalAlpha = 0.92;
				ctx.beginPath();
				ctx.moveTo(-sw * 0.5, 0);
				ctx.lineTo(-sw * 0.28, -sh * 0.82);
				ctx.lineTo(0, -sh);
				ctx.lineTo(sw * 0.12, -sh * 0.55);
				ctx.lineTo(sw * 0.36, 0);
				ctx.closePath();
				ctx.fill();
				/* Shadow face for volume. */
				ctx.globalAlpha = 0.75;
				ctx.fillStyle = PAL.iceDark;
				ctx.beginPath();
				ctx.moveTo(sw * 0.12, -sh * 0.55);
				ctx.lineTo(0, -sh);
				ctx.lineTo(sw * 0.05, -sh * 0.3);
				ctx.lineTo(sw * 0.36, 0);
				ctx.closePath();
				ctx.fill();
				/* Inner refraction line. */
				ctx.globalAlpha = 0.5;
				ctx.strokeStyle = PAL.snow;
				ctx.lineWidth = 1.2;
				ctx.beginPath();
				ctx.moveTo(-sw * 0.16, -sh * 0.1);
				ctx.lineTo(-sw * 0.04, -sh * 0.78);
				ctx.stroke();
				ctx.globalAlpha = 1;
				ctx.restore();
			}
			/* Frost skirt at the base. */
			ctx.globalAlpha = 0.4;
			ctx.fillStyle = PAL.snowShade;
			ctx.beginPath();
			ctx.ellipse(w / 2, h, w * 0.62, 7, 0, 0, Math.PI * 2);
			ctx.fill();
			ctx.globalAlpha = 1;
			ctx.restore();
		},

		/* Waterfall caught mid-fall. Major landmark prop. */
		frozenWaterfall(ctx, d, sx, sy){
			const w = d.w || 160, h = d.h || 420;
			const seed = d.x * 0.011;
			ctx.save();
			ctx.translate(sx, sy);
			/* Back sheet. */
			ctx.globalAlpha = 0.8;
			ctx.fillStyle = lin(ctx, 'fwb' + Math.round(w) + '_' + Math.round(h), 0, 0, 0, h, [
				[0, PAL.iceLit],
				[0.35, PAL.iceMid],
				[0.8, PAL.iceDark],
				[1, PAL.iceDeep],
			]);
			ctx.fillRect(0, 0, w, h);
			/* Lobes — frozen flow tubes of differing thickness. */
			const lobes = Math.max(3, Math.round(w / 26));
			for(let i = 0; i < lobes; i++){
				const lx = (i + 0.5) * (w / lobes);
				const lw = (w / lobes) * pick(0.55, 1.15, hash2(seed + i, 4.1));
				const bulge = pick(0.1, 0.34, hash2(seed + i, 7.2));
				ctx.globalAlpha = pick(0.4, 0.85, hash2(seed + i, 2.3));
				ctx.fillStyle = lin(ctx, 'fwl' + Math.round(lw) + '_' + Math.round(h), -lw / 2, 0, lw / 2, 0, [
					[0, PAL.iceMid],
					[0.42, PAL.iceWhite],
					[0.62, PAL.iceBright],
					[1, PAL.iceDark],
				]);
				ctx.beginPath();
				ctx.moveTo(lx - lw / 2, 0);
				ctx.bezierCurveTo(
					lx - lw / 2 - lw * bulge, h * 0.4,
					lx - lw / 2 + lw * bulge, h * 0.75,
					lx - lw * 0.18, h
				);
				ctx.lineTo(lx + lw * 0.18, h);
				ctx.bezierCurveTo(
					lx + lw / 2 - lw * bulge, h * 0.75,
					lx + lw / 2 + lw * bulge, h * 0.4,
					lx + lw / 2, 0
				);
				ctx.closePath();
				ctx.fill();
				/* Highlight rib down the lobe. */
				ctx.globalAlpha = pick(0.18, 0.4, hash2(seed + i, 6.4));
				ctx.strokeStyle = PAL.snow;
				ctx.lineWidth = Math.max(1, lw * 0.12);
				ctx.beginPath();
				ctx.moveTo(lx - lw * 0.1, h * 0.04);
				ctx.quadraticCurveTo(lx + lw * 0.1, h * 0.5, lx - lw * 0.05, h * 0.96);
				ctx.stroke();
			}
			ctx.globalAlpha = 1;
			/* Crest lip where the water went over. */
			ctx.fillStyle = PAL.snow;
			ctx.globalAlpha = 0.85;
			ctx.beginPath();
			ctx.moveTo(-6, 0);
			for(let i = 0; i <= 10; i++){
				const t = i / 10;
				ctx.lineTo(t * w, -3 - hash2(seed + i, 8.1) * 7);
			}
			ctx.lineTo(w + 6, 0);
			ctx.closePath();
			ctx.fill();
			ctx.globalAlpha = 1;
			/* Frozen spray mound + lingering mist at the base. */
			ctx.globalAlpha = 0.55;
			ctx.fillStyle = PAL.iceBright;
			ctx.beginPath();
			ctx.ellipse(w / 2, h, w * 0.78, 18, 0, 0, Math.PI * 2);
			ctx.fill();
			ctx.globalAlpha = 0.1 + Math.sin(T() * 0.5 + seed) * 0.03;
			ctx.fillStyle = rad(ctx, 'fwm' + Math.round(w), w / 2, h, w * 1.1, [
				[0, PAL.snow],
				[1, 'transparent'],
			]);
			ctx.beginPath();
			ctx.arc(w / 2, h, w * 1.1, 0, Math.PI * 2);
			ctx.fill();
			ctx.globalAlpha = 1;
			ctx.restore();
		},

		snowDrift(ctx, d, sx, sy){
			const w = d.w || 120, h = d.h || 26;
			const seed = d.x * 0.027;
			ctx.save();
			ctx.translate(sx, sy);
			/* Contact shadow. */
			ctx.globalAlpha = 0.28;
			ctx.fillStyle = PAL.iceDeep;
			ctx.beginPath();
			ctx.ellipse(w / 2, h, w * 0.55, 4, 0, 0, Math.PI * 2);
			ctx.fill();
			/* Layered drift, back to front. */
			for(let L = 2; L >= 0; L--){
				const lh = h * (0.55 + L * 0.22);
				const inset = L * w * 0.06;
				ctx.globalAlpha = L === 0 ? 0.95 : 0.6 - L * 0.15;
				ctx.fillStyle = L === 0 ? PAL.snow : PAL.snowShade;
				ctx.beginPath();
				ctx.moveTo(inset, h);
				const crest = pick(0.35, 0.68, hash2(seed + L, 3.6));
				ctx.bezierCurveTo(
					inset + w * 0.12, h - lh * 0.9,
					inset + w * crest, h - lh,
					w * 0.72 - inset, h - lh * 0.55
				);
				ctx.quadraticCurveTo(w - inset, h - lh * 0.2, w - inset, h);
				ctx.closePath();
				ctx.fill();
			}
			/* Wind ripples. */
			ctx.globalAlpha = 0.3;
			ctx.strokeStyle = PAL.snowShade;
			ctx.lineWidth = 1;
			for(let i = 0; i < 3; i++){
				const ry = h - h * (0.2 + i * 0.18);
				ctx.beginPath();
				ctx.moveTo(w * 0.18, ry);
				ctx.quadraticCurveTo(w * 0.5, ry - 3, w * 0.84, ry);
				ctx.stroke();
			}
			ctx.globalAlpha = 1;
			ctx.restore();
		},

		/* Translucent ice lid with water visible below. */
		frozenPool(ctx, d, sx, sy){
			const w = d.w || 200, h = d.h || 40;
			const seed = d.x * 0.014;
			ctx.save();
			ctx.translate(sx, sy);
			iceMass(ctx, w, h, { seed: seed, alpha: 0.9 });
			/* Ice lid. */
			ctx.globalAlpha = 0.62;
			ctx.fillStyle = lin(ctx, 'fpl' + Math.round(w) + '_' + Math.round(h), 0, 0, 0, h, [
				[0, 'rgba(232,247,255,0.95)'],
				[0.3, 'rgba(154,212,236,0.55)'],
				[1, 'rgba(19,64,95,0.2)'],
			]);
			ctx.fillRect(0, 0, w, h);
			ctx.globalAlpha = 1;
			/* Surface sheen and pressure cracks. */
			ctx.fillStyle = 'rgba(242,249,255,0.75)';
			ctx.fillRect(0, 0, w, 2);
			ctx.globalAlpha = 0.45;
			crackWeb(ctx, w * pick(0.25, 0.75, hash2(seed, 2.1)), h * 0.4, Math.min(w * 0.3, 34), 4, seed, 'rgba(240,250,255,0.6)', 1);
			ctx.globalAlpha = 1;
			bubbles(ctx, w, h, Math.round(w / 26), seed + 4);
			ctx.restore();
		},

		iceRidge(ctx, d, sx, sy){
			const w = d.w || 140, h = d.h || 30;
			const seed = d.x * 0.031;
			ctx.save();
			ctx.translate(sx, sy);
			const teeth = Math.max(3, Math.round(w / 22));
			ctx.globalAlpha = 0.9;
			ctx.fillStyle = lin(ctx, 'rdg' + Math.round(w) + '_' + Math.round(h), 0, -h, 0, 0, [
				[0, PAL.iceWhite],
				[0.55, PAL.iceLit],
				[1, PAL.iceDark],
			]);
			ctx.beginPath();
			ctx.moveTo(0, 0);
			for(let i = 0; i < teeth; i++){
				const t0 = i / teeth, t1 = (i + 0.5) / teeth;
				ctx.lineTo(t0 * w, -h * pick(0.25, 0.55, hash2(seed + i, 4.7)));
				ctx.lineTo(t1 * w, -h * pick(0.6, 1, hash2(seed + i, 9.1)));
			}
			ctx.lineTo(w, 0);
			ctx.closePath();
			ctx.fill();
			ctx.globalAlpha = 0.5;
			ctx.strokeStyle = PAL.snow;
			ctx.lineWidth = 1.2;
			ctx.stroke();
			ctx.globalAlpha = 1;
			ctx.restore();
		},

		/* Depth-fade into a crevasse, with cold fog pooling below. */
		crevasseEdge(ctx, d, sx, sy){
			const w = d.w || 240, h = d.h || 300;
			const seed = d.x * 0.009;
			ctx.save();
			ctx.translate(sx, sy);
			ctx.fillStyle = lin(ctx, 'cvs' + Math.round(w) + '_' + Math.round(h), 0, 0, 0, h, [
				[0, 'rgba(44,111,156,0.5)'],
				[0.3, 'rgba(19,64,95,0.72)'],
				[0.7, 'rgba(11,33,56,0.88)'],
				[1, 'rgba(4,16,28,0.97)'],
			]);
			ctx.fillRect(0, 0, w, h);
			/* Walls converge with depth. */
			for(let i = 0; i < 6; i++){
				const t = i / 6;
				ctx.globalAlpha = 0.1 - t * 0.012;
				ctx.fillStyle = PAL.iceBright;
				ctx.fillRect(w * (0.04 + t * 0.06), h * t, Math.max(1, w * 0.02), h * 0.9);
				ctx.fillRect(w * (0.94 - t * 0.06), h * t, Math.max(1, w * 0.02), h * 0.9);
			}
			strata(ctx, w, h * 0.6, seed, 34);
			/* Fog at the bottom so the drop reads as bottomless-but-visible. */
			ctx.globalAlpha = 0.2 + Math.sin(T() * 0.3 + seed) * 0.05;
			ctx.fillStyle = lin(ctx, 'cvf' + Math.round(h), 0, h * 0.55, 0, h, [
				[0, 'transparent'],
				[1, 'rgba(180,214,232,0.6)'],
			]);
			ctx.fillRect(0, h * 0.55, w, h * 0.45);
			ctx.globalAlpha = 1;
			ctx.restore();
		},

		hoarFrost(ctx, d, sx, sy){
			const w = d.w || 80, h = d.h || 14;
			const seed = d.x * 0.037;
			ctx.save();
			ctx.translate(sx, sy);
			for(let i = 0; i < 16; i++){
				const fx = hash2(seed + i, 1.3) * w;
				const fh = pick(3, h, hash2(seed + i, 6.9));
				ctx.globalAlpha = pick(0.18, 0.5, hash2(seed + i, 3.1));
				ctx.strokeStyle = PAL.snow;
				ctx.lineWidth = 1;
				ctx.beginPath();
				ctx.moveTo(fx, h);
				ctx.lineTo(fx + (hash2(seed + i, 8.4) - 0.5) * 4, h - fh);
				ctx.stroke();
			}
			ctx.globalAlpha = 1;
			ctx.restore();
		},

		frozenBubbles(ctx, d, sx, sy){
			const w = d.w || 40, h = d.h || 90;
			const seed = d.x * 0.041;
			ctx.save();
			ctx.translate(sx, sy);
			/* Stacked methane discs, larger as they rise. */
			const n = Math.max(3, Math.round(h / 16));
			for(let i = 0; i < n; i++){
				const t = i / n;
				const by = h - t * h;
				const br = pick(2, 7, 1 - t) * pick(0.7, 1.3, hash2(seed + i, 4.3));
				ctx.globalAlpha = pick(0.16, 0.42, hash2(seed + i, 2.6));
				ctx.fillStyle = PAL.iceWhite;
				ctx.beginPath();
				ctx.ellipse(w / 2 + (hash2(seed + i, 7.8) - 0.5) * w * 0.5, by, br, br * 0.6, 0, 0, Math.PI * 2);
				ctx.fill();
			}
			ctx.globalAlpha = 1;
			ctx.restore();
		},

		/* === WATER === */

		subglacialWater(ctx, d, sx, sy){
			const w = d.w || 300, h = d.h || 60;
			const seed = d.x * 0.012;
			ctx.save();
			ctx.translate(sx, sy);
			iceMass(ctx, w, h, { seed: seed, alpha: 0.86 });
			/* Thin ice roof with light passing through. */
			ctx.globalAlpha = 0.45;
			ctx.fillStyle = lin(ctx, 'sgw' + Math.round(w), 0, 0, 0, Math.max(6, h * 0.3), [
				[0, 'rgba(232,247,255,0.8)'],
				[1, 'rgba(154,212,236,0)'],
			]);
			ctx.fillRect(0, 0, w, Math.max(6, h * 0.3));
			ctx.globalAlpha = 1;
			ctx.restore();
		},

		/* Flowing river band: visible current + shoreline shelf ice. */
		frozenRiverBand(ctx, d, sx, sy){
			const w = d.w || 400, h = d.h || 70;
			const seed = d.x * 0.008;
			const dir = d.dir || 1;
			ctx.save();
			ctx.translate(sx, sy);
			iceMass(ctx, w, h, { seed: seed, alpha: 0.88 });
			/* Standing waves over submerged ridges. */
			for(let i = 0; i < 5; i++){
				const wx = pick(0.1, 0.9, hash2(seed + i, 5.7)) * w;
				ctx.globalAlpha = 0.16;
				ctx.fillStyle = PAL.snow;
				ctx.beginPath();
				ctx.ellipse(wx, h * 0.35, pick(10, 26, hash2(seed + i, 2.8)), 3, 0, 0, Math.PI * 2);
				ctx.fill();
			}
			/* Shelf ice along both banks. */
			ctx.globalAlpha = 0.8;
			ctx.fillStyle = PAL.iceBright;
			ctx.beginPath();
			ctx.moveTo(0, 0);
			for(let i = 0; i <= 12; i++){
				const t = i / 12;
				ctx.lineTo(t * w, pick(3, 11, hash2(seed + i, 4.9)));
			}
			ctx.lineTo(w, 0);
			ctx.closePath();
			ctx.fill();
			ctx.beginPath();
			ctx.moveTo(0, h);
			for(let i = 0; i <= 12; i++){
				const t = i / 12;
				ctx.lineTo(t * w, h - pick(3, 10, hash2(seed + i, 8.3)));
			}
			ctx.lineTo(w, h);
			ctx.closePath();
			ctx.fill();
			ctx.globalAlpha = 1;
			/* Direction chevrons so the current is readable at a glance. */
			const flowT = (T() * 0.6) % 1;
			for(let i = 0; i < 6; i++){
				const t = ((i / 6) + flowT) % 1;
				const cx = dir > 0 ? t * w : (1 - t) * w;
				ctx.globalAlpha = 0.3 * Math.sin(t * Math.PI);
				ctx.strokeStyle = PAL.iceWhite;
				ctx.lineWidth = 2;
				ctx.beginPath();
				ctx.moveTo(cx - 8 * dir, h * 0.5 - 6);
				ctx.lineTo(cx + 6 * dir, h * 0.5);
				ctx.lineTo(cx - 8 * dir, h * 0.5 + 6);
				ctx.stroke();
			}
			ctx.globalAlpha = 1;
			ctx.restore();
		},

		dripCurtain(ctx, d, sx, sy){
			const w = d.w || 100, h = d.h || 60;
			const seed = d.x * 0.033;
			ctx.save();
			ctx.translate(sx, sy);
			const n = Math.max(3, Math.round(w / 14));
			for(let i = 0; i < n; i++){
				const ix = (i + 0.5) * (w / n);
				icicle(ctx, ix, 0, h * pick(0.35, 1, hash2(seed + i, 5.9)), pick(3, 6, hash2(seed + i, 2.2)), seed + i);
			}
			ctx.restore();
		},

		/* === ANCIENT STRUCTURES === */

		/* Armoured figure sealed inside an ice shell. */
		frozenStatue(ctx, d, sx, sy){
			const w = d.w || 46, h = d.h || 110;
			const seed = d.x * 0.025;
			ctx.save();
			ctx.translate(sx, sy);
			/* Plinth. */
			ancientStoneBlock(ctx, -w * 0.12, h - 12, w * 1.24, 12, seed);
			/* Figure silhouette. */
			ctx.fillStyle = PAL.stoneDark;
			ctx.beginPath();
			ctx.ellipse(w / 2, h * 0.14, w * 0.2, h * 0.11, 0, 0, Math.PI * 2);
			ctx.fill();
			ctx.fillStyle = PAL.stoneMid;
			ctx.beginPath();
			ctx.moveTo(w * 0.5 - w * 0.3, h * 0.28);
			ctx.lineTo(w * 0.5 + w * 0.3, h * 0.28);
			ctx.lineTo(w * 0.5 + w * 0.22, h - 12);
			ctx.lineTo(w * 0.5 - w * 0.22, h - 12);
			ctx.closePath();
			ctx.fill();
			/* Pauldrons and a lowered blade — reads as a sentinel. */
			ctx.fillStyle = PAL.stoneLit;
			ctx.beginPath();
			ctx.ellipse(w * 0.2, h * 0.3, w * 0.14, h * 0.05, 0, 0, Math.PI * 2);
			ctx.fill();
			ctx.beginPath();
			ctx.ellipse(w * 0.8, h * 0.3, w * 0.14, h * 0.05, 0, 0, Math.PI * 2);
			ctx.fill();
			ctx.fillStyle = PAL.stoneEdge;
			ctx.fillRect(w * 0.78, h * 0.34, 3, h * 0.5);
			/* Ice shell: refraction and a bright rim. */
			ctx.globalAlpha = 0.5;
			ctx.fillStyle = lin(ctx, 'fst' + Math.round(w) + '_' + Math.round(h), 0, 0, w, h, [
				[0, 'rgba(232,247,255,0.75)'],
				[0.45, 'rgba(84,163,201,0.35)'],
				[1, 'rgba(11,33,56,0.55)'],
			]);
			ctx.beginPath();
			ctx.moveTo(w * 0.5 - w * 0.46, h);
			ctx.quadraticCurveTo(-w * 0.1, h * 0.4, w * 0.42, -h * 0.04);
			ctx.quadraticCurveTo(w * 1.1, h * 0.35, w * 0.5 + w * 0.46, h);
			ctx.closePath();
			ctx.fill();
			ctx.globalAlpha = 0.7;
			ctx.strokeStyle = PAL.snow;
			ctx.lineWidth = 1.2;
			ctx.stroke();
			ctx.globalAlpha = 1;
			bubbles(ctx, w, h, 8, seed + 2);
			ctx.restore();
		},

		iceGlyphs(ctx, d, sx, sy){
			const w = d.w || 120;
			ctx.save();
			ctx.translate(sx, sy);
			/* Recessed panel the glyphs are cut into. */
			ctx.globalAlpha = 0.35;
			ctx.fillStyle = PAL.stoneDark;
			ctx.fillRect(0, -14, w, 28);
			ctx.globalAlpha = 1;
			glyphRow(ctx, w, d.x * 0.02, d.scale || 1, d.glow !== false);
			ctx.restore();
		},

		/* Enormous carved door, half swallowed by the glacier. */
		buriedDoor(ctx, d, sx, sy){
			const w = d.w || 160, h = d.h || 240;
			const seed = d.x * 0.017;
			ctx.save();
			ctx.translate(sx, sy);
			/* Frame. */
			ancientStoneBlock(ctx, -14, -10, w + 28, h + 10, seed);
			/* Leaves. */
			ctx.fillStyle = lin(ctx, 'bd' + Math.round(w) + '_' + Math.round(h), 0, 0, w, 0, [
				[0, PAL.stoneDark],
				[0.48, PAL.stoneMid],
				[0.52, PAL.stoneDark],
				[1, PAL.stoneMid],
			]);
			ctx.fillRect(0, 0, w, h);
			ctx.strokeStyle = 'rgba(8,14,20,0.7)';
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.moveTo(w / 2, 0);
			ctx.lineTo(w / 2, h);
			ctx.stroke();
			/* Concentric carved rings, the ruin motif for this dungeon. */
			ctx.strokeStyle = 'rgba(143,224,255,0.3)';
			ctx.lineWidth = 2;
			for(let i = 1; i <= 3; i++){
				ctx.beginPath();
				ctx.arc(w / 2, h * 0.42, w * 0.1 * i, 0, Math.PI * 2);
				ctx.stroke();
			}
			ctx.save();
			ctx.translate(w / 2, h * 0.75);
			glyphRow(ctx, w * 0.7, seed, 0.9, true);
			ctx.restore();
			/* Ice swallowing the lower third. */
			ctx.globalAlpha = 0.62;
			ctx.fillStyle = lin(ctx, 'bdi' + Math.round(h), 0, h * 0.5, 0, h, [
				[0, 'rgba(154,212,236,0)'],
				[0.5, 'rgba(154,212,236,0.6)'],
				[1, 'rgba(232,247,255,0.9)'],
			]);
			ctx.fillRect(-14, h * 0.5, w + 28, h * 0.5);
			ctx.globalAlpha = 1;
			ctx.restore();
		},

		/* Stone brazier holding only frost — deliberately never lit. */
		deadBrazier(ctx, d, sx, sy){
			const w = d.w || 34, h = d.h || 54;
			const seed = d.x * 0.029;
			ctx.save();
			ctx.translate(sx, sy);
			ctx.fillStyle = PAL.stoneMid;
			ctx.fillRect(w * 0.38, h * 0.35, w * 0.24, h * 0.55);
			ctx.fillStyle = PAL.stoneDark;
			ctx.fillRect(w * 0.2, h * 0.88, w * 0.6, h * 0.12);
			/* Bowl. */
			ctx.fillStyle = lin(ctx, 'db' + Math.round(w), 0, 0, w, 0, [
				[0, PAL.stoneDark],
				[0.5, PAL.stoneLit],
				[1, PAL.stoneDark],
			]);
			ctx.beginPath();
			ctx.moveTo(0, h * 0.12);
			ctx.lineTo(w, h * 0.12);
			ctx.lineTo(w * 0.72, h * 0.4);
			ctx.lineTo(w * 0.28, h * 0.4);
			ctx.closePath();
			ctx.fill();
			/* Frost heap where coals should be. */
			ctx.globalAlpha = 0.9;
			ctx.fillStyle = PAL.snow;
			ctx.beginPath();
			ctx.ellipse(w / 2, h * 0.14, w * 0.42, h * 0.08, 0, 0, Math.PI * 2);
			ctx.fill();
			ctx.globalAlpha = 1;
			for(let i = 0; i < 3; i++){
				icicle(ctx, w * (0.28 + i * 0.22), h * 0.38, pick(5, 12, hash2(seed + i, 3.9)), 4, seed + i);
			}
			ctx.restore();
		},

		/* Ring-and-gear mechanism frozen into the wall. */
		ancientMechanism(ctx, d, sx, sy){
			const w = d.w || 70, h = d.h || 70;
			const seed = d.x * 0.019;
			const active = !!d.active;
			const spin = active ? T() * 0.6 : hash(seed) * 6.28;
			ctx.save();
			ctx.translate(sx + w / 2, sy + h / 2);
			const R = Math.min(w, h) * 0.46;
			/* Housing. */
			ctx.fillStyle = PAL.stoneDark;
			ctx.beginPath();
			ctx.arc(0, 0, R * 1.12, 0, Math.PI * 2);
			ctx.fill();
			ctx.strokeStyle = PAL.stoneEdge;
			ctx.lineWidth = 2;
			ctx.stroke();
			/* Toothed ring. */
			ctx.save();
			ctx.rotate(spin);
			ctx.strokeStyle = PAL.stoneLit;
			ctx.lineWidth = 3;
			ctx.beginPath();
			ctx.arc(0, 0, R * 0.82, 0, Math.PI * 2);
			ctx.stroke();
			for(let i = 0; i < 10; i++){
				const a = (i / 10) * Math.PI * 2;
				ctx.beginPath();
				ctx.moveTo(Math.cos(a) * R * 0.82, Math.sin(a) * R * 0.82);
				ctx.lineTo(Math.cos(a) * R * 1.0, Math.sin(a) * R * 1.0);
				ctx.stroke();
			}
			ctx.restore();
			/* Counter-rotating inner ring. */
			ctx.save();
			ctx.rotate(-spin * 1.6);
			ctx.strokeStyle = active ? PAL.glyph : PAL.stoneMid;
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.arc(0, 0, R * 0.5, 0, Math.PI * 2);
			ctx.stroke();
			for(let i = 0; i < 3; i++){
				const a = (i / 3) * Math.PI * 2;
				ctx.beginPath();
				ctx.moveTo(0, 0);
				ctx.lineTo(Math.cos(a) * R * 0.5, Math.sin(a) * R * 0.5);
				ctx.stroke();
			}
			ctx.restore();
			/* Core: lit when the mechanism has been engaged. */
			const pulse = active ? 0.6 + Math.sin(T() * 3) * 0.3 : 0.16;
			ctx.globalAlpha = pulse;
			ctx.fillStyle = rad(ctx, 'amc' + Math.round(R), 0, 0, R * 0.9, [
				[0, PAL.glyphCore],
				[0.4, PAL.glyph],
				[1, 'transparent'],
			]);
			ctx.beginPath();
			ctx.arc(0, 0, R * 0.9, 0, Math.PI * 2);
			ctx.fill();
			ctx.globalAlpha = 1;
			ctx.fillStyle = active ? PAL.glyphCore : PAL.stoneDark;
			ctx.beginPath();
			ctx.arc(0, 0, R * 0.16, 0, Math.PI * 2);
			ctx.fill();
			/* Rime on the housing. */
			ctx.globalAlpha = 0.45;
			ctx.strokeStyle = PAL.snow;
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.arc(0, 0, R * 1.12, Math.PI * 0.15, Math.PI * 0.85);
			ctx.stroke();
			ctx.globalAlpha = 1;
			ctx.restore();
		},

		carvedPillar(ctx, d, sx, sy){
			const w = d.w || 40, h = d.h || 180;
			const seed = d.x * 0.021;
			ctx.save();
			ctx.translate(sx, sy);
			/* Capital and base. */
			ancientStoneBlock(ctx, -w * 0.2, 0, w * 1.4, h * 0.07, seed);
			ancientStoneBlock(ctx, -w * 0.24, h - h * 0.06, w * 1.48, h * 0.06, seed + 1);
			ancientStone(ctx, w, h, seed);
			/* Flutes. */
			for(let i = 0; i < 3; i++){
				ctx.globalAlpha = 0.2;
				ctx.fillStyle = PAL.stoneEdge;
				ctx.fillRect(w * (0.2 + i * 0.26), h * 0.08, Math.max(1.5, w * 0.05), h * 0.84);
				ctx.globalAlpha = 0.25;
				ctx.fillStyle = PAL.voidDeep;
				ctx.fillRect(w * (0.2 + i * 0.26) + Math.max(1.5, w * 0.05), h * 0.08, 1.5, h * 0.84);
			}
			ctx.globalAlpha = 1;
			ctx.restore();
		},

		frozenAltar(ctx, d, sx, sy){
			const w = d.w || 90, h = d.h || 60;
			const seed = d.x * 0.023;
			ctx.save();
			ctx.translate(sx, sy);
			ancientStoneBlock(ctx, 0, h * 0.35, w, h * 0.65, seed);
			ancientStoneBlock(ctx, -w * 0.08, h * 0.2, w * 1.16, h * 0.18, seed + 1);
			/* Basin of clear ice with a cold light inside. */
			ctx.globalAlpha = 0.8;
			ctx.fillStyle = lin(ctx, 'fa' + Math.round(w), 0, h * 0.2, 0, 0, [
				[0, PAL.iceMid],
				[1, PAL.iceWhite],
			]);
			ctx.beginPath();
			ctx.ellipse(w / 2, h * 0.2, w * 0.34, h * 0.1, 0, 0, Math.PI * 2);
			ctx.fill();
			ctx.globalAlpha = 0.3 + Math.sin(T() * 1.4 + seed) * 0.12;
			ctx.fillStyle = rad(ctx, 'fag' + Math.round(w), w / 2, h * 0.1, w * 0.8, [
				[0, PAL.glyphCore],
				[0.4, PAL.glyph],
				[1, 'transparent'],
			]);
			ctx.beginPath();
			ctx.arc(w / 2, h * 0.1, w * 0.8, 0, Math.PI * 2);
			ctx.fill();
			ctx.globalAlpha = 1;
			ctx.save();
			ctx.translate(w / 2, h * 0.62);
			glyphRow(ctx, w * 0.72, seed, 0.8, true);
			ctx.restore();
			ctx.restore();
		},

		ruinedStair(ctx, d, sx, sy){
			const w = d.w || 160, h = d.h || 100;
			const seed = d.x * 0.026;
			const steps = d.steps || 5;
			const up = d.dir !== 'down';
			ctx.save();
			ctx.translate(sx, sy);
			for(let i = 0; i < steps; i++){
				const t = i / steps;
				const stepW = w / steps;
				const stepH = h / steps;
				const bx = up ? t * w : w - (t + 1) * stepW;
				const by = h - (i + 1) * stepH;
				/* Later steps are broken away — ancient and collapsing. */
				const broken = hash2(seed + i, 5.4) < 0.22 && i > 1;
				const drawW = broken ? stepW * 0.6 : stepW;
				ancientStoneBlock(ctx, bx, by, drawW, stepH + 1, seed + i);
				ctx.globalAlpha = 0.5;
				ctx.fillStyle = PAL.snow;
				ctx.fillRect(bx, by, drawW, 2.5);
				ctx.globalAlpha = 1;
			}
			ctx.restore();
		},

		frozenBanner(ctx, d, sx, sy){
			const w = d.w || 26, h = d.h || 80;
			const seed = d.x * 0.035;
			ctx.save();
			ctx.translate(sx, sy);
			ctx.fillStyle = PAL.stoneLit;
			ctx.fillRect(-3, 0, w + 6, 4);
			/* Stiff, frozen cloth: no wind motion. */
			ctx.fillStyle = lin(ctx, 'fb' + Math.round(w) + '_' + Math.round(h), 0, 0, 0, h, [
				[0, '#2d4a66'],
				[0.6, '#1d3550'],
				[1, '#132538'],
			]);
			ctx.beginPath();
			ctx.moveTo(0, 4);
			ctx.lineTo(w, 4);
			ctx.lineTo(w, h * 0.82);
			ctx.lineTo(w * 0.5, h);
			ctx.lineTo(0, h * 0.76);
			ctx.closePath();
			ctx.fill();
			ctx.globalAlpha = 0.4;
			ctx.fillStyle = PAL.snow;
			ctx.fillRect(0, 4, w, 3);
			ctx.globalAlpha = 1;
			/* Tattered slits. */
			ctx.strokeStyle = 'rgba(4,16,28,0.6)';
			ctx.lineWidth = 1.5;
			for(let i = 0; i < 3; i++){
				const ly = h * (0.35 + i * 0.18);
				ctx.beginPath();
				ctx.moveTo(w * pick(0.2, 0.7, hash2(seed + i, 4.1)), ly);
				ctx.lineTo(w * pick(0.4, 0.95, hash2(seed + i, 7.3)), ly + 8);
				ctx.stroke();
			}
			ctx.restore();
		},

		/* Creature preserved in the glacier. Environmental storytelling. */
		preservedBeast(ctx, d, sx, sy){
			const w = d.w || 130, h = d.h || 90;
			const seed = d.x * 0.013;
			ctx.save();
			ctx.translate(sx, sy);
			/* Ice block. */
			ctx.globalAlpha = 0.75;
			iceMass(ctx, w, h, { seed: seed, alpha: 0.72 });
			/* Silhouette inside — deliberately vague, read as "something big". */
			ctx.globalAlpha = 0.5;
			ctx.fillStyle = '#0a1a26';
			ctx.beginPath();
			ctx.moveTo(w * 0.16, h * 0.78);
			ctx.quadraticCurveTo(w * 0.24, h * 0.34, w * 0.46, h * 0.36);
			ctx.quadraticCurveTo(w * 0.6, h * 0.16, w * 0.74, h * 0.3);
			ctx.quadraticCurveTo(w * 0.9, h * 0.42, w * 0.84, h * 0.78);
			ctx.closePath();
			ctx.fill();
			/* Pale eye glow still lit under the ice. */
			ctx.globalAlpha = 0.35 + Math.sin(T() * 0.7 + seed) * 0.12;
			ctx.fillStyle = PAL.glyph;
			ctx.beginPath();
			ctx.arc(w * 0.7, h * 0.36, 3, 0, Math.PI * 2);
			ctx.fill();
			ctx.globalAlpha = 1;
			bubbles(ctx, w, h, 14, seed + 3);
			/* Bright fracture across the face of the block. */
			ctx.globalAlpha = 0.35;
			crackWeb(ctx, w * 0.4, h * 0.5, w * 0.4, 5, seed, 'rgba(232,247,255,0.5)', 1.2);
			ctx.globalAlpha = 1;
			ctx.restore();
		},

		/* Abandoned camp: someone tried to survive down here. */
		frozenCamp(ctx, d, sx, sy){
			const w = d.w || 110, h = d.h || 50;
			const seed = d.x * 0.031;
			ctx.save();
			ctx.translate(sx, sy);
			/* Collapsed tent. */
			ctx.fillStyle = '#243b52';
			ctx.beginPath();
			ctx.moveTo(0, h);
			ctx.lineTo(w * 0.26, h * 0.3);
			ctx.lineTo(w * 0.52, h);
			ctx.closePath();
			ctx.fill();
			ctx.globalAlpha = 0.75;
			ctx.fillStyle = PAL.snow;
			ctx.beginPath();
			ctx.moveTo(w * 0.02, h);
			ctx.lineTo(w * 0.26, h * 0.34);
			ctx.lineTo(w * 0.34, h * 0.62);
			ctx.lineTo(w * 0.1, h);
			ctx.closePath();
			ctx.fill();
			ctx.globalAlpha = 1;
			/* Cold firepit — stones and ash, no flame. */
			ctx.fillStyle = PAL.stoneDark;
			for(let i = 0; i < 5; i++){
				const a = (i / 5) * Math.PI * 2;
				ctx.beginPath();
				ctx.arc(w * 0.74 + Math.cos(a) * 12, h - 6 + Math.sin(a) * 4, 4, 0, Math.PI * 2);
				ctx.fill();
			}
			ctx.fillStyle = 'rgba(120,140,155,0.5)';
			ctx.beginPath();
			ctx.ellipse(w * 0.74, h - 6, 8, 3, 0, 0, Math.PI * 2);
			ctx.fill();
			/* Snow burying it all. */
			ctx.globalAlpha = 0.6;
			ctx.fillStyle = PAL.snow;
			ctx.beginPath();
			ctx.moveTo(0, h);
			ctx.quadraticCurveTo(w * 0.5, h - pick(5, 12, hash2(seed, 2.2)), w, h);
			ctx.closePath();
			ctx.fill();
			ctx.globalAlpha = 1;
			ctx.restore();
		},

		/* === TRAVERSAL === */

		/* Deck skin for ice bridges. Drawn under the collision platform. */
		iceBridgeDeck(ctx, d, sx, sy){
			const w = d.w || 200, h = d.h || 22;
			const seed = d.x * 0.016;
			ctx.save();
			ctx.translate(sx, sy);
			iceMass(ctx, w, h, { seed: seed, alpha: 0.92 });
			/* Sagging underbelly so it reads as a span, not a slab. */
			ctx.globalAlpha = 0.8;
			ctx.fillStyle = lin(ctx, 'ibd' + Math.round(w), 0, 0, 0, h * 1.8, [
				[0, PAL.iceMid],
				[1, 'rgba(11,33,56,0.15)'],
			]);
			ctx.beginPath();
			ctx.moveTo(0, h - 2);
			ctx.quadraticCurveTo(w * 0.5, h + h * 0.9, w, h - 2);
			ctx.closePath();
			ctx.fill();
			ctx.globalAlpha = 1;
			/* Stress lines across the span. */
			ctx.strokeStyle = 'rgba(232,247,255,0.3)';
			ctx.lineWidth = 1;
			for(let i = 1; i < 6; i++){
				const lx = (i / 6) * w;
				ctx.beginPath();
				ctx.moveTo(lx, 1);
				ctx.lineTo(lx + 4, h - 1);
				ctx.stroke();
			}
			const n = Math.max(2, Math.round(w / 40));
			for(let i = 0; i < n; i++){
				icicle(ctx, (i + 0.5) * (w / n), h + h * 0.55 * Math.sin(((i + 0.5) / n) * Math.PI), pick(6, 18, hash2(seed + i, 6.2)), 5, seed + i);
			}
			ctx.restore();
		},

		ropeBridge(ctx, d, sx, sy){
			const w = d.w || 220, h = d.h || 18;
			const seed = d.x * 0.024;
			ctx.save();
			ctx.translate(sx, sy);
			/* Frozen cables: rigid, ice-sheathed. */
			ctx.strokeStyle = '#8fa5b5';
			ctx.lineWidth = 3;
			ctx.beginPath();
			ctx.moveTo(0, 0);
			ctx.quadraticCurveTo(w * 0.5, h * 0.9, w, 0);
			ctx.stroke();
			ctx.strokeStyle = 'rgba(232,247,255,0.6)';
			ctx.lineWidth = 1.4;
			ctx.stroke();
			/* Planks. */
			const n = Math.max(4, Math.round(w / 22));
			for(let i = 0; i < n; i++){
				const t = (i + 0.5) / n;
				const px = t * w;
				const py = h * 0.9 * 4 * t * (1 - t);
				ctx.fillStyle = i % 3 === 0 ? '#3c4c5c' : '#4a5b6b';
				ctx.fillRect(px - 8, py - 3, 16, 5);
				ctx.fillStyle = 'rgba(232,247,255,0.45)';
				ctx.fillRect(px - 8, py - 3, 16, 1.5);
			}
			ctx.restore();
		},

		/* === LIGHT & ATMOSPHERE === */

		/* Daylight bored down through the glacier. Vertical landmark. */
		lightShaft(ctx, d, sx, sy){
			const w = d.w || 90, h = d.h || 400;
			const seed = d.x * 0.007;
			ctx.save();
			ctx.translate(sx, sy);
			const sway = Math.sin(T() * 0.25 + seed) * 5;
			ctx.globalAlpha = (d.alpha == null ? 0.13 : d.alpha) + Math.sin(T() * 0.4 + seed) * 0.03;
			ctx.fillStyle = lin(ctx, 'ls' + Math.round(w) + '_' + Math.round(h), 0, 0, 0, h, [
				[0, 'rgba(226,246,255,0.85)'],
				[0.45, 'rgba(154,212,236,0.35)'],
				[1, 'transparent'],
			]);
			ctx.beginPath();
			ctx.moveTo(w * 0.34, 0);
			ctx.lineTo(w * 0.66, 0);
			ctx.lineTo(w + sway, h);
			ctx.lineTo(sway, h);
			ctx.closePath();
			ctx.fill();
			ctx.globalAlpha = 1;
			/* Motes drifting inside the beam. */
			for(let i = 0; i < 9; i++){
				const t = ((T() * 0.06 + hash2(seed + i, 3.3)) % 1);
				const mx = w * pick(0.4, 0.6, hash2(seed + i, 7.1)) + (t * (w * 0.4) - w * 0.2) + sway * t;
				const my = t * h;
				ctx.globalAlpha = 0.28 * (1 - t);
				ctx.fillStyle = PAL.snow;
				ctx.beginPath();
				ctx.arc(mx, my, 1.4, 0, Math.PI * 2);
				ctx.fill();
			}
			ctx.globalAlpha = 1;
			ctx.restore();
		},

		mistBank(ctx, d, sx, sy){
			const w = d.w || 260, h = d.h || 70;
			const seed = d.x * 0.006;
			ctx.save();
			ctx.translate(sx, sy);
			for(let i = 0; i < 3; i++){
				const drift = Math.sin(T() * (0.12 + i * 0.05) + seed + i) * 18;
				ctx.globalAlpha = 0.09 - i * 0.02;
				ctx.fillStyle = rad(ctx, 'mb' + Math.round(w) + '_' + i, w * 0.5, h * 0.6, w * 0.6, [
					[0, PAL.snow],
					[0.6, 'rgba(180,214,232,0.4)'],
					[1, 'transparent'],
				]);
				ctx.save();
				ctx.translate(drift, i * 6);
				ctx.beginPath();
				ctx.ellipse(w * 0.5, h * 0.6, w * 0.6, h * 0.55, 0, 0, Math.PI * 2);
				ctx.fill();
				ctx.restore();
			}
			ctx.globalAlpha = 1;
			ctx.restore();
		},

		/* Whole wall of buried masonry. The ruins' answer to glacierWall. */
		ancientWallFace(ctx, d, sx, sy){
			const w = d.w || 260, h = d.h || 600;
			const seed = d.x * 0.011 + d.y * 0.005;
			ctx.save();
			ctx.translate(sx, sy);
			ancientStone(ctx, w, h, seed);
			/* Recessed niches — depth in the wall itself. */
			const niches = Math.max(1, Math.round(h / 260));
			for(let i = 0; i < niches; i++){
				const ny = h * ((i + 0.5) / niches) - h * 0.12;
				const nw = w * 0.42, nh = h * 0.2;
				const nx = w * (0.3 + (hash2(seed + i, 3.1) - 0.5) * 0.2);
				ctx.globalAlpha = 0.65;
				ctx.fillStyle = PAL.voidDeep;
				ctx.fillRect(nx, ny, nw, nh);
				ctx.globalAlpha = 0.35;
				ctx.fillStyle = PAL.stoneEdge;
				ctx.fillRect(nx, ny, nw, 2);
				ctx.globalAlpha = 1;
				/* Rime forming inside the niche lip. */
				ctx.globalAlpha = 0.4;
				ctx.fillStyle = PAL.snow;
				ctx.fillRect(nx, ny + nh - 3, nw, 3);
				ctx.globalAlpha = 1;
			}
			/* Glacier ice welded onto the masonry face. */
			ctx.globalAlpha = 0.3;
			ctx.fillStyle = lin(ctx, 'awf' + Math.round(w) + '_' + Math.round(h), 0, 0, w, h, [
				[0, 'rgba(154,212,236,0.55)'],
				[0.5, 'rgba(84,163,201,0.12)'],
				[1, 'rgba(232,247,255,0.5)'],
			]);
			ctx.fillRect(0, 0, w, h);
			ctx.globalAlpha = 1;
			strata(ctx, w, h, seed + 9, 46);
			ctx.restore();
		},

		/* Polished plane that shows a mirrored, slightly-wrong world. */
		mirrorPlane(ctx, d, sx, sy){
			const w = d.w || 60, h = d.h || 500;
			const seed = d.x * 0.013;
			ctx.save();
			ctx.translate(sx, sy);
			ctx.fillStyle = lin(ctx, 'mp' + Math.round(w) + '_' + Math.round(h), 0, 0, w, 0, [
				[0, 'rgba(11,33,56,0.9)'],
				[0.3, 'rgba(84,163,201,0.75)'],
				[0.5, 'rgba(232,247,255,0.85)'],
				[0.7, 'rgba(84,163,201,0.75)'],
				[1, 'rgba(11,33,56,0.9)'],
			]);
			ctx.fillRect(0, 0, w, h);
			/* Sliding specular band — the tell that it is a mirror. */
			const band = ((T() * 0.12 + hash(seed)) % 1) * h;
			ctx.globalAlpha = 0.28;
			ctx.fillStyle = PAL.snow;
			ctx.fillRect(0, band, w, h * 0.1);
			ctx.globalAlpha = 1;
			/* Frame. */
			ctx.strokeStyle = PAL.stoneEdge;
			ctx.lineWidth = 2;
			ctx.strokeRect(0, 0, w, h);
			ctx.globalAlpha = 0.5;
			ctx.strokeStyle = PAL.snow;
			ctx.lineWidth = 1;
			ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
			ctx.globalAlpha = 1;
			ctx.restore();
		},

		/* Visual tell painted over a fragile deck before it is stepped on. */
		crackedPlateHint(ctx, d, sx, sy){
			const w = d.w || 200, h = d.h || 16;
			const seed = d.x * 0.019;
			ctx.save();
			ctx.translate(sx, sy);
			ctx.globalAlpha = 0.55;
			ctx.fillStyle = 'rgba(200,235,250,0.35)';
			ctx.fillRect(0, 0, w, h);
			ctx.globalAlpha = 0.75;
			crackWeb(ctx, w * 0.3, h * 0.5, Math.min(w * 0.35, 40), 5, seed, 'rgba(255,255,255,0.75)', 1.2);
			crackWeb(ctx, w * 0.72, h * 0.5, Math.min(w * 0.3, 34), 4, seed + 3, 'rgba(255,255,255,0.6)', 1);
			ctx.globalAlpha = 1;
			ctx.restore();
		},

		/* The ice block a sealed enemy is kept in. */
		prisonBlock(ctx, d, sx, sy){
			const w = d.w || 180, h = d.h || 200;
			const seed = d.x * 0.017;
			ctx.save();
			ctx.translate(sx, sy);
			iceMass(ctx, w, h, { seed: seed, alpha: 0.78 });
			bubbles(ctx, w, h, 20, seed + 1);
			/* Armoured shape inside, deliberately half-legible. */
			ctx.globalAlpha = 0.55;
			ctx.fillStyle = '#0d1c28';
			ctx.beginPath();
			ctx.ellipse(w / 2, h * 0.24, w * 0.15, h * 0.1, 0, 0, Math.PI * 2);
			ctx.fill();
			ctx.fillRect(w * 0.32, h * 0.34, w * 0.36, h * 0.5);
			ctx.fillRect(w * 0.18, h * 0.38, w * 0.14, h * 0.3);
			ctx.fillRect(w * 0.68, h * 0.38, w * 0.14, h * 0.3);
			ctx.globalAlpha = 1;
			/* Two cold eye-lights, still burning. */
			const pulse = 0.4 + Math.sin(T() * 1.7 + seed) * 0.22;
			ctx.globalAlpha = pulse;
			ctx.fillStyle = PAL.glyph;
			ctx.beginPath();
			ctx.arc(w * 0.45, h * 0.23, 2.6, 0, Math.PI * 2);
			ctx.arc(w * 0.55, h * 0.23, 2.6, 0, Math.PI * 2);
			ctx.fill();
			ctx.globalAlpha = 1;
			/* Restraint chains fused into the ice. */
			ctx.strokeStyle = 'rgba(140,160,175,0.7)';
			ctx.lineWidth = 3;
			for(let i = 0; i < 3; i++){
				const cy = h * (0.35 + i * 0.2);
				ctx.beginPath();
				ctx.moveTo(0, cy);
				ctx.quadraticCurveTo(w * 0.5, cy + 8, w, cy);
				ctx.stroke();
			}
			ctx.globalAlpha = 0.4;
			crackWeb(ctx, w * 0.5, h * 0.5, w * 0.45, 6, seed + 5, 'rgba(232,247,255,0.55)', 1.3);
			ctx.globalAlpha = 1;
			ctx.restore();
		},

		/* Route previews at branch forks — the choice must be readable. */
		warmHint(ctx, d, sx, sy){
			const w = d.w || 220, h = d.h || 140;
			ctx.save();
			ctx.translate(sx, sy);
			ctx.globalAlpha = 0.2 + Math.sin(T() * 0.7) * 0.05;
			ctx.fillStyle = rad(ctx, 'wh' + Math.round(w), w / 2, h, w * 0.9, [
				[0, 'rgba(255,206,140,0.8)'],
				[0.5, 'rgba(226,150,80,0.3)'],
				[1, 'transparent'],
			]);
			ctx.beginPath();
			ctx.arc(w / 2, h, w * 0.9, 0, Math.PI * 2);
			ctx.fill();
			ctx.globalAlpha = 1;
			/* Meltwater trickle running out of the warm route. */
			ctx.strokeStyle = 'rgba(200,235,250,0.5)';
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.moveTo(w * 0.4, h);
			ctx.quadraticCurveTo(w * 0.55, h - 20, w * 0.62, h);
			ctx.stroke();
			ctx.restore();
		},

		deepHint(ctx, d, sx, sy){
			const w = d.w || 220, h = d.h || 140;
			const seed = d.x * 0.021;
			ctx.save();
			ctx.translate(sx, sy);
			ctx.globalAlpha = 0.22 + Math.sin(T() * 0.5 + seed) * 0.05;
			ctx.fillStyle = rad(ctx, 'dh' + Math.round(w), w / 2, h, w * 0.9, [
				[0, 'rgba(143,224,255,0.7)'],
				[0.5, 'rgba(44,111,156,0.3)'],
				[1, 'transparent'],
			]);
			ctx.beginPath();
			ctx.arc(w / 2, h, w * 0.9, 0, Math.PI * 2);
			ctx.fill();
			ctx.globalAlpha = 1;
			for(let i = 0; i < 4; i++){
				icicle(ctx, w * (0.24 + i * 0.18), h * 0.1, pick(16, 34, hash2(seed + i, 4.4)), 7, seed + i);
			}
			ctx.restore();
		},

		/* Warming chamber centrepiece — the only warm light in the reach. */
		warmHearth(ctx, d, sx, sy){
			const w = d.w || 130, h = d.h || 100;
			const seed = d.x * 0.023;
			ctx.save();
			ctx.translate(sx, sy);
			ancientStoneBlock(ctx, 0, h * 0.55, w, h * 0.45, seed);
			/* Bowl. */
			ctx.fillStyle = lin(ctx, 'whb' + Math.round(w), 0, 0, w, 0, [
				[0, '#3a3128'],
				[0.5, '#6b5b46'],
				[1, '#3a3128'],
			]);
			ctx.beginPath();
			ctx.moveTo(w * 0.1, h * 0.3);
			ctx.lineTo(w * 0.9, h * 0.3);
			ctx.lineTo(w * 0.74, h * 0.6);
			ctx.lineTo(w * 0.26, h * 0.6);
			ctx.closePath();
			ctx.fill();
			/* Live coals — warm, slow, deliberately unlike a fire brazier. */
			const beat = 0.6 + Math.sin(T() * 1.6 + seed) * 0.25;
			ctx.globalAlpha = beat;
			ctx.fillStyle = rad(ctx, 'whc' + Math.round(w), w / 2, h * 0.32, w * 0.42, [
				[0, '#fff0c8'],
				[0.35, '#ffb257'],
				[0.7, 'rgba(214,110,40,0.5)'],
				[1, 'transparent'],
			]);
			ctx.beginPath();
			ctx.ellipse(w / 2, h * 0.32, w * 0.42, h * 0.16, 0, 0, Math.PI * 2);
			ctx.fill();
			ctx.globalAlpha = 1;
			/* Rising heat shimmer, not flames. */
			for(let i = 0; i < 5; i++){
				const t = ((T() * 0.35 + hash2(seed + i, 2.4)) % 1);
				ctx.globalAlpha = 0.22 * (1 - t);
				ctx.fillStyle = '#ffd9a0';
				ctx.beginPath();
				ctx.arc(w * (0.3 + hash2(seed + i, 6.1) * 0.4), h * 0.3 - t * h * 0.9, 2 + t * 3, 0, Math.PI * 2);
				ctx.fill();
			}
			ctx.globalAlpha = 1;
			ctx.restore();
		},

		warmGlow(ctx, d, sx, sy){
			const r = d.r || 220;
			ctx.save();
			ctx.translate(sx, sy);
			ctx.globalAlpha = 0.13 + Math.sin(T() * 0.6) * 0.03;
			ctx.fillStyle = rad(ctx, 'wg' + Math.round(r), 0, 0, r, [
				[0, '#ffe2b0'],
				[0.3, 'rgba(255,170,90,0.4)'],
				[1, 'transparent'],
			]);
			ctx.beginPath();
			ctx.arc(0, 0, r, 0, Math.PI * 2);
			ctx.fill();
			ctx.globalAlpha = 1;
			ctx.restore();
		},

		/* Thawed channel in the warming chamber floor — running water. */
		meltRunnel(ctx, d, sx, sy){
			const w = d.w || 600, h = d.h || 26;
			const seed = d.x * 0.009;
			ctx.save();
			ctx.translate(sx, sy);
			iceMass(ctx, w, h, { seed: seed, alpha: 0.84 });
			ctx.globalAlpha = 0.3;
			ctx.fillStyle = '#ffcf94';
			ctx.fillRect(0, 0, w, 2);
			ctx.globalAlpha = 0.5;
			ctx.fillStyle = PAL.stoneEdge;
			ctx.fillRect(0, -2, w, 2);
			ctx.fillRect(0, h, w, 2);
			ctx.globalAlpha = 1;
			ctx.restore();
		},

		/* Cold ambient light pool — replaces fire torches entirely. */
		iceLight(ctx, d, sx, sy){
			const r = d.r || 90;
			const seed = d.x * 0.028;
			ctx.save();
			ctx.translate(sx, sy);
			const pulse = 0.1 + Math.sin(T() * 0.9 + seed) * 0.03;
			ctx.globalAlpha = pulse;
			ctx.fillStyle = rad(ctx, 'il' + Math.round(r), 0, 0, r, [
				[0, PAL.glyphCore],
				[0.35, 'rgba(143,224,255,0.5)'],
				[1, 'transparent'],
			]);
			ctx.beginPath();
			ctx.arc(0, 0, r, 0, Math.PI * 2);
			ctx.fill();
			ctx.globalAlpha = 1;
			/* Source: a small self-lit crystal shard. */
			ctx.fillStyle = PAL.iceWhite;
			ctx.beginPath();
			ctx.moveTo(0, -9);
			ctx.lineTo(4, 0);
			ctx.lineTo(0, 9);
			ctx.lineTo(-4, 0);
			ctx.closePath();
			ctx.fill();
			ctx.restore();
		},
	};

	/* Small helper used by several ancient props. */
	function ancientStoneBlock(ctx, x, y, w, h, seed){
		ctx.save();
		ctx.translate(x, y);
		ctx.fillStyle = lin(ctx, 'asb' + Math.round(w) + '_' + Math.round(h), 0, 0, 0, h, [
			[0, PAL.stoneLit],
			[0.3, PAL.stoneMid],
			[1, PAL.stoneDark],
		]);
		ctx.fillRect(0, 0, w, h);
		ctx.globalAlpha = 0.5;
		ctx.fillStyle = PAL.stoneEdge;
		ctx.fillRect(0, 0, w, 1.5);
		ctx.globalAlpha = 0.35;
		ctx.fillStyle = PAL.snow;
		ctx.fillRect(0, 0, w, 2.5);
		ctx.globalAlpha = 1;
		ctx.restore();
	}

	/* Public entry: returns true when this prop belongs to the ice set. */
	function drawDecoration(ctx, dec, sx, sy){
		const fn = DRAW[dec.type];
		if(!fn) return false;
		const keep = dec.type === 'glacierWall' || dec.type === 'ancientWallFace' ||
			dec.type === 'frozenWaterfall' || dec.type === 'crevasseEdge' || dec.type === 'lightShaft';
		ctx.save();
		if(!keep){
			const h = dec.h || 40;
			ctx.translate(sx, sy + h);
			ctx.scale(0.8, 0.8);
			fn(ctx, dec, 0, -h);
		} else {
			fn(ctx, dec, sx, sy);
		}
		ctx.restore();
		return true;
	}

	global.IceProps = {
		PAL: PAL,
		draw: drawDecoration,
		has: (type) => !!DRAW[type],
		/* Exposed so the mechanics layer can reuse the same material look
		   for hazards and platforms instead of inventing a second style. */
		iceMass: iceMass,
		strata: strata,
		bubbles: bubbles,
		crackWeb: crackWeb,
		icicle: icicle,
		waterBody: waterBody,
		ancientStone: ancientStone,
		ancientStoneBlock: ancientStoneBlock,
		glyphRow: glyphRow,
		lin: lin,
		rad: rad,
		hash: hash,
		hash2: hash2,
	};
})(typeof window !== 'undefined' ? window : globalThis);
