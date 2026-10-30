/* =============================================================
   Mini-boss sprite art — shared drawing kit.
   Every mini-boss is drawn from code: a small skeleton (nested transforms), painted parts
   (gradient fill + dark outline + rim light) and per-row animation curves. build.js renders
   every frame into a PNG sheet: 8 columns × 8 rows, one row per animation.

   Coordinates: origin at the feet (or the body centre for fliers), +x = facing direction,
   −y = up. Sizes are in sheet pixels; a frame is FRAME × FRAME.
   ============================================================= */
(function(G){
	'use strict';
	const FRAME = 288, COLS = 8, ROWS = 8;
	const ROW = { idle: 0, move: 1, attackA: 2, attackB: 3, cast: 4, special: 5, hurt: 6, death: 7 };
	const TAU = Math.PI * 2;

	const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
	const lerp = (a, b, t) => a + (b - a) * t;
	const ease = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
	const easeOut = (t) => 1 - Math.pow(1 - t, 3);
	const easeIn = (t) => t * t * t;

	/* colour helpers ------------------------------------------------------------- */
	function hex(c){ c = c.replace('#', ''); if(c.length === 3) c = c.split('').map(x => x + x).join(''); const n = parseInt(c, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
	function rgb(a){ return 'rgb(' + (a[0] | 0) + ',' + (a[1] | 0) + ',' + (a[2] | 0) + ')'; }
	function rgba(c, al){ const a = Array.isArray(c) ? c : hex(c); return 'rgba(' + (a[0] | 0) + ',' + (a[1] | 0) + ',' + (a[2] | 0) + ',' + al + ')'; }
	function mix(c1, c2, t){ const a = Array.isArray(c1) ? c1 : hex(c1), b = Array.isArray(c2) ? c2 : hex(c2); return rgb([lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]); }
	const shade = (c, t) => mix(c, '#000000', t);
	const tint = (c, t) => mix(c, '#ffffff', t);

	/* keyframe sampling: keys = [[t, {param: value}], ...] with t in 0..1 --------- */
	function sample(keys, t, easing){
		easing = easing || ease;
		if(t <= keys[0][0]) return Object.assign({}, keys[0][1]);
		for(let i = 0; i < keys.length - 1; i++){
			const a = keys[i], b = keys[i + 1];
			if(t >= a[0] && t <= b[0]){
				const u = easing((t - a[0]) / Math.max(1e-6, b[0] - a[0]));
				const out = {};
				const ks = new Set(Object.keys(a[1]).concat(Object.keys(b[1])));
				for(const k of ks){ const va = a[1][k] != null ? a[1][k] : b[1][k], vb = b[1][k] != null ? b[1][k] : a[1][k]; out[k] = lerp(va, vb, u); }
				return out;
			}
		}
		return Object.assign({}, keys[keys.length - 1][1]);
	}
	// merge a partial pose over a base pose
	const pose = (base, over) => Object.assign({}, base, over || {});

	/* painting ------------------------------------------------------------------- */
	// smooth closed path through points (Catmull-Rom → bezier); tension 0..1
	function smoothPath(c, pts, closed, ten){
		ten = ten == null ? 0.5 : ten;
		const n = pts.length; if(n < 2) return;
		c.moveTo(pts[0][0], pts[0][1]);
		const P = (i) => closed ? pts[(i + n) % n] : pts[clamp(i, 0, n - 1)];
		const last = closed ? n : n - 1;
		for(let i = 0; i < last; i++){
			const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
			const k = ten / 3;
			c.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k, p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k, p2[0], p2[1]);
		}
		if(closed) c.closePath();
	}
	function polyPath(c, pts){ c.moveTo(pts[0][0], pts[0][1]); for(let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); }
	// bounding box of points (for gradients)
	function bbox(pts){ let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for(const p of pts){ if(p[0] < x0) x0 = p[0]; if(p[1] < y0) y0 = p[1]; if(p[0] > x1) x1 = p[0]; if(p[1] > y1) y1 = p[1]; } return { x0, y0, x1, y1 }; }
	/* a painted shape: vertical light gradient + outline + optional rim highlight.
	   o: { fill, light (top colour), dark (bottom colour), line, lw, smooth, rim, rimSide (-1 left / 1 right), glow } */
	function paint(c, pts, o){
		o = o || {};
		const b = bbox(pts);
		c.beginPath();
		if(o.smooth === false) polyPath(c, pts); else smoothPath(c, pts, true, o.smooth == null ? 0.45 : o.smooth);
		if(o.glow){ c.save(); c.shadowColor = o.glow; c.shadowBlur = o.glowR || 14; }
		if(o.fill){
			if(o.light || o.dark){
				const g = c.createLinearGradient(b.x0 + (b.x1 - b.x0) * (o.lx || 0.3), b.y0, b.x0 + (b.x1 - b.x0) * (o.lx2 || 0.7), b.y1);
				g.addColorStop(0, o.light || o.fill); g.addColorStop(o.mid == null ? 0.55 : o.mid, o.fill); g.addColorStop(1, o.dark || o.fill);
				c.fillStyle = g;
			} else c.fillStyle = o.fill;
			c.fill();
		}
		if(o.glow) c.restore();
		if(o.cel){
			// cel shadow: fill the shape with the shadow colour, then re-fill it shifted toward the light
			c.save(); c.clip();
			c.fillStyle = o.cel[2]; c.fillRect(b.x0 - 10, b.y0 - 10, b.x1 - b.x0 + 20, b.y1 - b.y0 + 20);
			c.translate(o.cel[0], o.cel[1]);
			c.beginPath(); if(o.smooth === false) polyPath(c, pts); else smoothPath(c, pts, true, o.smooth == null ? 0.45 : o.smooth);
			if(o.light || o.dark){
				const g2 = c.createLinearGradient(b.x0 + (b.x1 - b.x0) * (o.lx || 0.3), b.y0, b.x0 + (b.x1 - b.x0) * (o.lx2 || 0.7), b.y1);
				g2.addColorStop(0, o.light || o.fill); g2.addColorStop(o.mid == null ? 0.55 : o.mid, o.fill); g2.addColorStop(1, o.dark || o.fill);
				c.fillStyle = g2;
			} else c.fillStyle = o.fill;
			c.fill(); c.restore();
			c.beginPath(); if(o.smooth === false) polyPath(c, pts); else smoothPath(c, pts, true, o.smooth == null ? 0.45 : o.smooth);
		}
		if(o.spec){
			// specular sweep: a soft light band near the lit edge
			c.save(); c.clip(); c.globalCompositeOperation = 'lighter';
			const g3 = c.createLinearGradient(b.x0, b.y0, b.x1, b.y1);
			g3.addColorStop(0, 'rgba(255,255,255,0)'); g3.addColorStop(0.28, o.spec); g3.addColorStop(0.4, 'rgba(255,255,255,0)'); g3.addColorStop(1, 'rgba(255,255,255,0)');
			c.fillStyle = g3; c.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); c.restore();
			c.beginPath(); if(o.smooth === false) polyPath(c, pts); else smoothPath(c, pts, true, o.smooth == null ? 0.45 : o.smooth);
		}
		if(o.line !== false){ c.lineWidth = o.lw || 3; c.lineJoin = 'round'; c.strokeStyle = o.line || 'rgba(8,10,20,0.92)'; c.stroke(); }
		if(o.rim){
			// a thin highlight along the lit edge: re-stroke the path clipped to one side
			c.save(); c.clip();
			c.lineWidth = o.rimW || 4; c.strokeStyle = o.rim;
			c.translate(o.rimDx == null ? -2 : o.rimDx, o.rimDy == null ? 2 : o.rimDy);
			c.beginPath(); if(o.smooth === false) polyPath(c, pts); else smoothPath(c, pts, true, o.smooth == null ? 0.45 : o.smooth);
			c.stroke(); c.restore();
		}
	}
	// a stroked line of varying width (for blades, tendrils, cracks)
	function taper(c, pts, w0, w1, color, line){
		const n = pts.length; if(n < 2) return;
		const L = [], R = [];
		for(let i = 0; i < n; i++){
			const p = pts[i], q = pts[Math.min(n - 1, i + 1)], r = pts[Math.max(0, i - 1)];
			const dx = q[0] - r[0], dy = q[1] - r[1], d = Math.hypot(dx, dy) || 1;
			const w = lerp(w0, w1, i / (n - 1)) / 2;
			L.push([p[0] - dy / d * w, p[1] + dx / d * w]); R.push([p[0] + dy / d * w, p[1] - dx / d * w]);
		}
		c.beginPath(); c.moveTo(L[0][0], L[0][1]);
		for(let i = 1; i < n; i++) c.lineTo(L[i][0], L[i][1]);
		for(let i = n - 1; i >= 0; i--) c.lineTo(R[i][0], R[i][1]);
		c.closePath();
		c.fillStyle = color; c.fill();
		if(line){ c.lineWidth = 2; c.strokeStyle = line; c.stroke(); }
	}
	// additive soft glow
	function glow(c, x, y, r, color, a){
		c.save(); c.globalCompositeOperation = 'lighter';
		const g = c.createRadialGradient(x, y, 0, x, y, r);
		g.addColorStop(0, rgba(color, a == null ? 0.8 : a)); g.addColorStop(0.4, rgba(color, (a == null ? 0.8 : a) * 0.35)); g.addColorStop(1, rgba(color, 0));
		c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.restore();
	}
	function ellipse(c, x, y, rx, ry, fill, line, lw, rot){
		c.beginPath(); c.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot || 0, 0, TAU);
		if(fill){ c.fillStyle = fill; c.fill(); }
		if(line){ c.lineWidth = lw || 3; c.strokeStyle = line; c.stroke(); }
	}
	// run fn inside a translated + rotated frame (a "bone")
	function at(c, x, y, ang, fn, sx, sy){ c.save(); c.translate(x, y); if(ang) c.rotate(ang); if(sx != null) c.scale(sx, sy == null ? sx : sy); fn(); c.restore(); }
	// seeded noise so every frame of a sheet draws the same details
	function rng(seed){ let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; }
	// ground shadow
	function shadow(c, w, a){ c.save(); const g = c.createRadialGradient(0, 0, 0, 0, 0, w); g.addColorStop(0, 'rgba(0,0,0,' + (a || 0.38) + ')'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.scale(1, 0.22); c.beginPath(); c.arc(0, 0, w, 0, TAU); c.fill(); c.restore(); }

	G.MBArt = {
		FRAME, COLS, ROWS, ROW, TAU, clamp, lerp, ease, easeOut, easeIn,
		hex, rgb, rgba, mix, shade, tint, sample, pose,
		smoothPath, polyPath, paint, taper, glow, ellipse, at, rng, shadow,
		bosses: {},
	};
})(typeof window !== 'undefined' ? window : globalThis);
