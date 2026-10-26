/*
 * DOMAIN ART — the painter (c70; first version c69). Loaded after magic-domain.js and magic-domain-look.js.
 *
 * A domain is painted as a WORLD seen through a window:
 *   backdrop (behind creatures)   sky · landmark on the horizon · floor that meets the real ground · sigil · light rays · ambience · vignette
 *   foreground (over creatures)   colour grade · two particle layers · the edge (barrier) · rune band · the burst · time left · marks
 *   veil (over everything)        a sealed domain seen from outside: an opaque sphere in one of several styles
 *   cine (screen space)           gather vignette · the held breath (frozen world, rays, letterbox, the name) · the flash · the declared laws
 *
 * The static part of the backdrop (sky, landmark, floor) is painted once into an offscreen canvas per domain and reused; everything
 * that moves is painted live. Without a canvas (headless tests) everything is painted live.
 *
 *   W.drawDomainBackdrop(ctx, camX, camY, t)   host calls this BEHIND creatures and sets W.hostDrawsDomainBackdrop = true
 *   W._domDraw(ctx, camX, camY, t)              (engine) the foreground; paints a lighter backdrop itself when the host does not
 *   W.drawDomainVeil(ctx, camX, camY, t, view)  after creatures
 *   W.drawDomainCine(ctx, w, h, camX, camY, t, view)
 *   W.clipToDomains(ctx, camX, camY)            clip to the open domains (for a host that redraws its platforms inside)
 *   MagicDomainArt.thumbnail(ctx, look, w, h, t, opts)   a domain painted without a world (the designer's previews)
 */
(function(root){
	'use strict';
	const ME = root.MagicEngine, MD = root.MagicDomain, LK = root.MagicDomainLook;
	if(!ME || !ME.registerWorldHook || !MD || !LK) return;
	const TAU = Math.PI * 2, PI = Math.PI;
	const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
	const easeOut = (k) => 1 - Math.pow(1 - clamp(k, 0, 1), 3);
	const easeOut4 = (k) => 1 - Math.pow(1 - clamp(k, 0, 1), 4);
	const fract = (x) => x - Math.floor(x);
	const hash = (i, seed) => fract(Math.sin(i * 12.9898 + (seed || 0) * 78.233) * 43758.5453);
	const _rgb = Object.create(null);
	function rgbOf(c){ let v = _rgb[c]; if(!v){ const n = parseInt(String(c).slice(1, 7), 16) || 0; v = _rgb[c] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; } return v; }
	function A(c, a){ const v = rgbOf(c); return 'rgba(' + v[0] + ',' + v[1] + ',' + v[2] + ',' + (a <= 0 ? 0 : a >= 1 ? 1 : Math.round(a * 1000) / 1000) + ')'; }
	const mix = LK.mixHex;
	const sh = (c, k) => k >= 0 ? mix(c, '#ffffff', k) : mix(c, '#000000', -k);
	const lum = (c) => { const v = rgbOf(c); return (v[0] * 0.299 + v[1] * 0.587 + v[2] * 0.114) / 255; };

	/* ============================================================ the look of one domain */
	function lookOf(D){
		if(D._look) return D._look;
		const p = D.p || {}, mine = D.ownerId === 'player';
		const L = LK.resolve(p, mine);
		L.key = L.preset; L.pattern = L.sigil; L.motes = L.p1; L.interior = L.ambient;
		L.bright = L.ambient === 'bright' || lum(L.bg) > 0.6;
		L.name = (LK.PRESETS[L.preset] || {}).name || 'Domain';
		L.outside = (p.outside && p.outside !== 'auto') ? p.outside : (D.form === 'closed' ? 'sealed' : 'clear');
		L.title = (p.title && String(p.title).trim()) || 'Domain Expansion';
		L.sil = L.bright ? sh(mix(L.c3, L.c1, 0.3), -0.32) : mix(L.bg, '#000000', 0.5);       // silhouettes on the horizon
		L.ink = L.sky === 'inkwash';
		L._key = JSON.stringify([L.c1, L.c2, L.c3, L.bg, L.sky, L.landmark, L.landmarkSize, L.horizon, L.floor, L.seed, L.barrier]);
		D._look = L; return L;
	}

	/* where the floor and horizon are, on screen */
	function geo(D, L, camX, camY, R){
		const x = D.x - camX, y = D.y - camY;
		const gW = D.groundY != null ? D.groundY : D.y + D.r * 0.3;
		const gy = clamp(gW - camY, y - R * 0.2, y + R * 0.9);
		const hy = Math.max(gy - R * L.horizon, y - R * 0.9);
		return { x, y, gy, hy };
	}
	function edgePath(c, g, R, L){
		c.beginPath();
		if(L.barrier === 'dome' && g.gy + R * 0.05 < g.y + R * 0.97){
			const yb = g.gy + R * 0.05, a = Math.asin(clamp((yb - g.y) / R, -1, 1));
			c.arc(g.x, g.y, R, a, PI - a, true); c.closePath();
		} else c.arc(g.x, g.y, R, 0, TAU);
	}
	function glow(c, x, y, r, col, a){ const gr = c.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, A(col, a)); gr.addColorStop(1, A(col, 0)); c.fillStyle = gr; c.fillRect(x - r, y - r, r * 2, r * 2); }
	function vGrad(c, x0, y0, w, y1, stops){ const gr = c.createLinearGradient(0, y0, 0, y1); for(const s of stops) gr.addColorStop(clamp(s[0], 0, 1), s[1]); c.fillStyle = gr; c.fillRect(x0, y0, w, Math.max(1, y1 - y0)); }
	function stars(c, g, R, seed, n, col, a, below){
		c.fillStyle = A(col, a);
		for(let i = 0; i < n; i++){
			const ang = hash(i, seed + 3) * TAU, rr = Math.sqrt(hash(i + 70, seed + 3)) * R * 0.97, px = g.x + Math.cos(ang) * rr, py = g.y + Math.sin(ang) * rr;
			if(!below && py > g.hy) continue;
			const s = 0.5 + hash(i + 140, seed) * (hash(i + 9, seed) > 0.93 ? 2.2 : 1.1);
			c.fillRect(px - s / 2, py - s / 2, s, s);
		}
	}

	/* ============================================================ SKY (static) */
	function paintSky(c, g, R, L, seed){
		const { x, y, hy } = g, top = y - R, X0 = x - R, W2 = R * 2;
		const sky = (stops) => vGrad(c, X0, top, W2, hy + 1, stops);
		c.fillStyle = L.bg; c.fillRect(X0, top, W2, W2);
		switch(L.sky){
			case 'void':
				sky([[0, sh(L.bg, -0.6)], [1, mix(L.bg, L.c1, 0.14)]]);
				c.globalCompositeOperation = 'lighter'; glow(c, x, hy, R * 0.9, L.c1, 0.16); c.globalCompositeOperation = 'source-over';
				stars(c, g, R, seed, 50, L.c2, 0.45); break;
			case 'night':
				sky([[0, sh(L.bg, -0.5)], [0.7, L.bg], [1, mix(L.bg, L.c3, 0.3)]]);
				stars(c, g, R, seed, 120, L.c2, 0.75); break;
			case 'nebula': {
				sky([[0, sh(L.bg, -0.4)], [1, mix(L.bg, L.c3, 0.22)]]);
				c.globalCompositeOperation = 'lighter';
				for(let i = 0; i < 9; i++){
					const px = x + (hash(i, seed + 1) * 2 - 1) * R * 0.85, py = top + R * 0.15 + hash(i + 5, seed + 1) * (hy - top) * 0.95, r = R * (0.22 + hash(i + 9, seed) * 0.35);
					glow(c, px, py, r, i % 3 === 0 ? L.c3 : (i % 3 === 1 ? L.c1 : L.c2), 0.11 + 0.1 * hash(i + 2, seed));
				}
				c.globalCompositeOperation = 'source-over';
				stars(c, g, R, seed, 140, L.c2, 0.8); break;
			}
			case 'dusk':
				sky([[0, sh(L.bg, -0.3)], [0.55, mix(L.bg, L.c3, 0.4)], [0.86, mix(L.c1, L.bg, 0.35)], [1, mix(L.c1, '#ffffff', 0.35)]]);
				c.globalCompositeOperation = 'lighter'; glow(c, x, hy, R * 0.8, L.c1, 0.3); c.globalCompositeOperation = 'source-over';
				stars(c, { x, y, hy: top + (hy - top) * 0.4 }, R, seed, 40, L.c2, 0.5);
				clouds(c, g, R, L, seed, mix(L.bg, L.c3, 0.5), 0.35, 5); break;
			case 'dawn':
				sky([[0, mix(L.c2, L.c3, 0.35)], [0.6, mix(L.c2, L.c1, 0.3)], [1, mix(L.c2, '#ffffff', 0.7)]]);
				glow(c, x, hy, R * 0.7, '#ffffff', 0.55);
				clouds(c, g, R, L, seed, '#ffffff', 0.4, 6); break;
			case 'radiant':
				sky([[0, mix(L.c1, '#ffffff', 0.45)], [1, '#ffffff']]);
				glow(c, x, hy - R * 0.25, R * 1.1, '#ffffff', 0.9);
				c.fillStyle = A(L.c1, 0.1);
				for(let i = 0; i < 16; i++){ const an = i / 16 * TAU, w = 0.05; c.beginPath(); c.moveTo(x, hy - R * 0.25); c.lineTo(x + Math.cos(an - w) * R * 1.5, hy - R * 0.25 + Math.sin(an - w) * R * 1.5); c.lineTo(x + Math.cos(an + w) * R * 1.5, hy - R * 0.25 + Math.sin(an + w) * R * 1.5); c.fill(); }
				break;
			case 'bloodmoon':
				sky([[0, '#030001'], [0.5, mix(L.bg, '#4a000c', 0.6)], [1, mix(L.c1, '#1a0003', 0.5)]]);
				clouds(c, g, R, L, seed, mix('#000000', L.c1, 0.18), 0.75, 7); break;
			case 'aurora': {
				sky([[0, sh(L.bg, -0.5)], [0.8, L.bg], [1, mix(L.bg, L.c1, 0.2)]]);
				stars(c, g, R, seed, 90, L.c2, 0.6);
				c.globalCompositeOperation = 'lighter';
				for(let b = 0; b < 3; b++){
					const col = b === 1 ? L.c3 : L.c1, base = top + (hy - top) * (0.25 + b * 0.16);
					for(let i = 0; i < 70; i++){
						const u = i / 69, px = x - R + u * W2, py = base + Math.sin(u * 5.5 + b * 2 + seed) * R * 0.08;
						const gr = c.createLinearGradient(0, py - R * 0.25, 0, py); gr.addColorStop(0, A(col, 0)); gr.addColorStop(1, A(col, 0.16 * (0.5 + 0.5 * Math.sin(u * 13 + b))));
						c.fillStyle = gr; c.fillRect(px, py - R * 0.25, W2 / 70 + 1, R * 0.25);
					}
				}
				c.globalCompositeOperation = 'source-over'; break;
			}
			case 'storm':
				sky([[0, '#07080c'], [1, mix('#3a4152', L.c1, 0.18)]]);
				clouds(c, g, R, L, seed, '#14161e', 0.9, 9);
				clouds(c, { x, y, hy: top + (hy - top) * 0.6 }, R, L, seed + 3, '#232634', 0.8, 7); break;
			case 'abyss':
				c.fillStyle = sh(L.bg, -0.7); c.fillRect(X0, top, W2, W2);
				c.globalCompositeOperation = 'lighter'; glow(c, x, y + R * 0.9, R * 1.2, L.c1, 0.22); glow(c, x, y + R, R * 0.5, L.c2, 0.15); c.globalCompositeOperation = 'source-over';
				stars(c, g, R, seed, 25, L.c1, 0.35); break;
			case 'inkwash': {
				const paper = lum(L.bg) > 0.6 ? L.bg : '#ece5d3';
				sky([[0, sh(paper, -0.08)], [1, sh(paper, 0.05)]]);
				c.fillStyle = A(L.c3, 0.85); c.beginPath(); c.arc(x + R * 0.38, top + (hy - top) * 0.45, R * 0.11, 0, TAU); c.fill();
				for(let i = 0; i < 4; i++){ c.fillStyle = A(L.c1, 0.05); c.fillRect(X0, top + (hy - top) * (0.3 + i * 0.17), W2, R * 0.04); }
				break;
			}
			case 'ember':
				sky([[0, '#060201'], [0.6, mix(L.bg, '#3a1004', 0.5)], [1, mix(L.c1, '#ff3b00', 0.3)]]);
				c.globalCompositeOperation = 'lighter'; glow(c, x, hy, R, L.c1, 0.25); c.globalCompositeOperation = 'source-over';
				clouds(c, g, R, L, seed, '#120604', 0.7, 6); break;
			case 'frost':
				sky([[0, mix(L.bg, L.c1, 0.3)], [1, mix(L.c1, '#ffffff', 0.6)]]);
				stars(c, g, R, seed, 40, '#ffffff', 0.5); break;
			case 'deep': {
				sky([[0, mix(L.bg, L.c1, 0.55)], [0.55, mix(L.bg, L.c1, 0.22)], [1, mix(L.bg, L.c3, 0.15)]]);
				c.globalCompositeOperation = 'lighter';
				for(let i = 0; i < 8; i++){ const px = x + (hash(i, seed) * 2 - 1) * R * 0.8, w = R * (0.04 + 0.06 * hash(i + 3, seed)); const gr = c.createLinearGradient(0, top, 0, hy + R * 0.3); gr.addColorStop(0, A(L.c2, 0.14)); gr.addColorStop(1, A(L.c2, 0)); c.fillStyle = gr; c.beginPath(); c.moveTo(px - w, top); c.lineTo(px + w, top); c.lineTo(px + w * 3 + R * 0.1, hy + R * 0.3); c.lineTo(px - w + R * 0.1, hy + R * 0.3); c.fill(); }
				c.globalCompositeOperation = 'source-over'; break;
			}
			case 'sunset':
				sky([[0, mix(L.bg, L.c3, 0.45)], [0.5, mix(L.c3, L.c1, 0.5)], [0.88, L.c1], [1, mix(L.c1, '#fff0c0', 0.6)]]);
				clouds(c, g, R, L, seed, mix(L.c3, '#200a20', 0.5), 0.5, 5); break;
		}
	}
	function clouds(c, g, R, L, seed, col, a, n){
		const top = g.y - R;
		c.fillStyle = A(col, a);
		for(let i = 0; i < n; i++){
			const cx = g.x + (hash(i, seed + 11) * 2 - 1) * R * 0.9, cy = top + R * 0.1 + hash(i + 4, seed + 11) * (g.hy - top) * 0.85, w = R * (0.25 + hash(i + 8, seed) * 0.35);
			c.beginPath();
			for(let k = 0; k < 6; k++){ const ox = (k / 5 - 0.5) * w * 1.6, r = w * (0.22 + 0.16 * hash(i * 7 + k, seed)); c.moveTo(cx + ox + r, cy); c.arc(cx + ox, cy - r * 0.3 * hash(k, i), r, 0, TAU); }
			c.fill();
		}
	}

	/* ============================================================ LANDMARK (static part) */
	const LM_H = { moon:1.95, sun:1.05, eclipse:1.75, planet:1.75, eye:1.85, halo:2.2, rift:2.25, clock:1.95, gate:1.85, temple:1.95, spires:2.45, throne:2.5, tree:2.6, mountains:1.6, hands:1.7, scales:2.0, lotus:1.3, pillars:1.9, blades:2.3 };
	function lmSize(g, R, L){ const S = R * 0.42 * L.landmarkSize, room = g.hy - (g.y - R * 0.95); return Math.max(R * 0.08, Math.min(S, room / (LM_H[L.landmark] || 2))); }
	const SILHOUETTES = { gate:1, temple:1, spires:1, throne:1, tree:1, mountains:1, hands:1, scales:1, pillars:1, clock:1 };
	function paintLandmark(c, g, R, L, seed, a){
		const S = lmSize(g, R, L), x = g.x, hy = g.hy, sil = L.sil, rim = A(L.c1, 0.55 * a);
		c.save(); c.globalAlpha *= a;
		if(SILHOUETTES[L.landmark]){
			// a backlight so a dark shape still reads against a dark sky
			c.globalCompositeOperation = L.bright ? 'source-over' : 'lighter';
			const gr = c.createRadialGradient(x, hy - S * 0.9, 0, x, hy - S * 0.9, S * 2.1); gr.addColorStop(0, A(L.bright ? L.c3 : L.c1, L.bright ? 0.35 : 0.3)); gr.addColorStop(1, A(L.c1, 0));
			c.fillStyle = gr; c.fillRect(x - S * 2.1, hy - S * 3, S * 4.2, S * 3); c.globalCompositeOperation = 'source-over';
		}
		switch(L.landmark){
			case 'moon': {
				const my = hy - S * 1.3, mr = S * 0.6;
				c.globalCompositeOperation = L.bright ? 'source-over' : 'lighter'; glow(c, x, my, mr * 3, L.c2, 0.25); c.globalCompositeOperation = 'source-over';
				const gr = c.createRadialGradient(x - mr * 0.3, my - mr * 0.3, mr * 0.1, x, my, mr); gr.addColorStop(0, sh(L.c2, 0.3)); gr.addColorStop(1, mix(L.c2, L.c1, 0.45));
				c.fillStyle = gr; c.beginPath(); c.arc(x, my, mr, 0, TAU); c.fill();
				c.fillStyle = A(mix(L.c1, L.bg, 0.4), 0.22);
				for(let i = 0; i < 9; i++){ const an = hash(i, seed) * TAU, rr = Math.sqrt(hash(i + 3, seed)) * mr * 0.75; c.beginPath(); c.arc(x + Math.cos(an) * rr, my + Math.sin(an) * rr, mr * (0.06 + 0.12 * hash(i + 6, seed)), 0, TAU); c.fill(); }
				break;
			}
			case 'sun': {
				const sy = hy - S * 0.35, sr = S * 0.62;
				c.globalCompositeOperation = 'lighter'; glow(c, x, sy, sr * 3.2, L.c1, 0.4); c.globalCompositeOperation = 'source-over';
				const gr = c.createRadialGradient(x, sy, 0, x, sy, sr); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.6, sh(L.c1, 0.5)); gr.addColorStop(1, L.c1);
				c.fillStyle = gr; c.beginPath(); c.arc(x, sy, sr, PI, TAU); c.lineTo(x + sr, hy); c.lineTo(x - sr, hy); c.fill();
				c.fillStyle = A(L.bg, 0.25); for(let i = 0; i < 4; i++) c.fillRect(x - sr, sy + sr * (0.05 + i * 0.12), sr * 2, sr * 0.04 * (1 + i * 0.5));
				break;
			}
			case 'eclipse': {
				const ey = hy - S * 1.15, er = S * 0.55;
				c.globalCompositeOperation = 'lighter'; glow(c, x, ey, er * 2.8, L.c1, 0.5);
				c.strokeStyle = A(L.c2, 0.8); c.lineWidth = er * 0.06;
				for(let i = 0; i < 36; i++){ const an = i / 36 * TAU, l = er * (1.1 + 0.6 * hash(i, seed)); c.beginPath(); c.moveTo(x + Math.cos(an) * er, ey + Math.sin(an) * er); c.lineTo(x + Math.cos(an) * l, ey + Math.sin(an) * l); c.globalAlpha = 0.25 * a; c.stroke(); }
				c.globalAlpha = a; c.globalCompositeOperation = 'source-over';
				c.fillStyle = '#000000'; c.beginPath(); c.arc(x, ey, er, 0, TAU); c.fill();
				c.strokeStyle = A(L.c2, 0.95); c.lineWidth = 2; c.beginPath(); c.arc(x, ey, er, 0, TAU); c.stroke();
				break;
			}
			case 'planet': {
				const px = x + S * 0.55, py = hy - S * 1.25, pr = S * 0.5;
				const ring = (front) => { c.strokeStyle = A(L.c2, 0.7); c.lineWidth = pr * 0.1; c.beginPath(); c.ellipse(px, py, pr * 1.8, pr * 0.42, -0.35, front ? 0 : PI, front ? PI : TAU); c.stroke(); c.strokeStyle = A(L.c1, 0.5); c.lineWidth = pr * 0.05; c.beginPath(); c.ellipse(px, py, pr * 1.55, pr * 0.34, -0.35, front ? 0 : PI, front ? PI : TAU); c.stroke(); };
				ring(false);
				const gr = c.createRadialGradient(px - pr * 0.4, py - pr * 0.4, pr * 0.1, px, py, pr); gr.addColorStop(0, sh(L.c3, 0.45)); gr.addColorStop(0.7, L.c3); gr.addColorStop(1, sh(L.c3, -0.6));
				c.fillStyle = gr; c.beginPath(); c.arc(px, py, pr, 0, TAU); c.fill();
				c.fillStyle = A(L.c1, 0.15); for(let i = 0; i < 3; i++){ c.beginPath(); c.ellipse(px, py - pr * 0.4 + i * pr * 0.35, pr * 0.95, pr * 0.08, 0, 0, TAU); c.fill(); }
				ring(true);
				c.fillStyle = A(L.c2, 0.8); c.beginPath(); c.arc(x - S * 0.9, hy - S * 1.7, pr * 0.16, 0, TAU); c.fill();
				break;
			}
			case 'eye': {
				const ey = hy - S * 1.1, ew = S * 1.1, eh = S * 0.42;
				c.globalCompositeOperation = L.bright ? 'source-over' : 'lighter'; glow(c, x, ey, ew * 1.6, L.c1, 0.22); c.globalCompositeOperation = 'source-over';
				c.fillStyle = A(sil, 0.9); c.beginPath(); c.ellipse(x, ey, ew * 1.25, eh * 1.7, 0, 0, TAU); c.fill();
				c.strokeStyle = A(L.c1, 0.4); c.lineWidth = 2;
				for(let i = -4; i <= 4; i++){ const ax = x + i * ew * 0.22; c.beginPath(); c.moveTo(ax, ey - eh * 0.95 + Math.abs(i) * eh * 0.08); c.lineTo(ax + i * ew * 0.06, ey - eh * 1.55 + Math.abs(i) * eh * 0.15); c.stroke(); }
				break;
			}
			case 'rift': {
				const top = hy - S * 2.2, bot = hy - S * 0.1;
				c.globalCompositeOperation = 'lighter'; glow(c, x, (top + bot) / 2, S * 1.1, L.c1, 0.35);
				const tear = (w, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(x, top); for(let i = 1; i <= 12; i++){ const u = i / 12, yy = top + (bot - top) * u, ww = Math.sin(u * PI) * w * (0.6 + 0.6 * hash(i, seed)); c.lineTo(x + ww + (hash(i + 4, seed) - 0.5) * w * 0.6, yy); } for(let i = 11; i >= 1; i--){ const u = i / 12, yy = top + (bot - top) * u, ww = Math.sin(u * PI) * w * (0.6 + 0.6 * hash(i + 20, seed)); c.lineTo(x - ww + (hash(i + 4, seed) - 0.5) * w * 0.6, yy); } c.closePath(); c.fill(); };
				tear(S * 0.32, A(L.c1, 0.6)); tear(S * 0.16, A(L.c2, 0.9)); c.globalCompositeOperation = 'source-over';
				break;
			}
			case 'clock': {
				const cy = hy - S * 1.15, cr = S * 0.75;
				c.fillStyle = A(mix(L.bg, L.c1, 0.14), 0.95); c.beginPath(); c.arc(x, cy, cr, 0, TAU); c.fill();
				c.strokeStyle = A(L.c1, 0.85); c.lineWidth = cr * 0.06; c.beginPath(); c.arc(x, cy, cr, 0, TAU); c.stroke();
				c.lineWidth = cr * 0.015; c.beginPath(); c.arc(x, cy, cr * 0.86, 0, TAU); c.stroke();
				for(let i = 0; i < 60; i++){ const an = i / 60 * TAU, l = i % 5 ? 0.05 : 0.13; c.lineWidth = i % 5 ? 1 : cr * 0.025; c.beginPath(); c.moveTo(x + Math.cos(an) * cr * 0.84, cy + Math.sin(an) * cr * 0.84); c.lineTo(x + Math.cos(an) * cr * (0.84 - l), cy + Math.sin(an) * cr * (0.84 - l)); c.stroke(); }
				c.fillStyle = A(sil, 0.95); c.fillRect(x - cr * 0.18, cy + cr, cr * 0.36, hy - cy - cr);
				break;
			}
			case 'gate': {
				const col = mix(L.c3, sil, 0.25), h = S * 1.7, half = S * 0.7, pw = S * 0.13;
				c.fillStyle = col;
				c.fillRect(x - half - pw / 2, hy - h, pw, h); c.fillRect(x + half - pw / 2, hy - h, pw, h);
				c.beginPath(); c.moveTo(x - half * 1.55, hy - h - S * 0.05); c.quadraticCurveTo(x, hy - h + S * 0.12, x + half * 1.55, hy - h - S * 0.05); c.lineTo(x + half * 1.45, hy - h + S * 0.12); c.quadraticCurveTo(x, hy - h + S * 0.26, x - half * 1.45, hy - h + S * 0.12); c.fill();
				c.fillRect(x - half * 1.2, hy - h + S * 0.34, half * 2.4, S * 0.1); c.fillRect(x - pw * 0.4, hy - h + S * 0.12, pw * 0.8, S * 0.25);
				c.strokeStyle = rim; c.lineWidth = 1.5; c.strokeRect(x - half - pw / 2, hy - h, pw, h); c.strokeRect(x + half - pw / 2, hy - h, pw, h);
				break;
			}
			case 'temple': {
				c.fillStyle = sil;
				c.fillRect(x - S * 1.1, hy - S * 0.18, S * 2.2, S * 0.18); c.fillRect(x - S * 0.9, hy - S * 0.3, S * 1.8, S * 0.14);
				let yy = hy - S * 0.3;
				for(let k = 0; k < 4; k++){
					const w = S * (0.95 - k * 0.19), body = S * 0.24;
					c.fillStyle = sil; c.fillRect(x - w * 0.62, yy - body, w * 1.24, body);
					c.fillStyle = A(L.c1, 0.75); for(let j = -1; j <= 1; j++) c.fillRect(x + j * w * 0.35 - S * 0.03, yy - body * 0.75, S * 0.06, body * 0.5);
					yy -= body;
					c.fillStyle = sil; c.beginPath(); c.moveTo(x - w * 1.05, yy + S * 0.02); c.quadraticCurveTo(x - w * 0.6, yy - S * 0.03, x - w * 0.5, yy - S * 0.12); c.lineTo(x + w * 0.5, yy - S * 0.12); c.quadraticCurveTo(x + w * 0.6, yy - S * 0.03, x + w * 1.05, yy + S * 0.02); c.closePath(); c.fill();
					c.strokeStyle = rim; c.lineWidth = 1.2; c.stroke();
					yy -= S * 0.12;
				}
				c.fillStyle = sil; c.fillRect(x - S * 0.02, yy - S * 0.3, S * 0.04, S * 0.3);
				break;
			}
			case 'spires': {
				c.fillStyle = sil;
				const spire = (sx, w, h) => { c.fillRect(sx - w / 2, hy - h * 0.62, w, h * 0.62); c.beginPath(); c.moveTo(sx - w * 0.6, hy - h * 0.62); c.lineTo(sx, hy - h); c.lineTo(sx + w * 0.6, hy - h * 0.62); c.fill(); };
				for(const [dx, w, h] of [[-1.15, 0.22, 1.3], [1.15, 0.22, 1.3], [-0.7, 0.3, 1.8], [0.7, 0.3, 1.8], [0, 0.55, 2.4]]) spire(x + dx * S, w * S, h * S);
				c.fillRect(x - S * 1.3, hy - S * 0.5, S * 2.6, S * 0.5);
				const ry = hy - S * 1.05; c.globalCompositeOperation = 'lighter'; glow(c, x, ry, S * 0.5, L.c1, 0.6); c.globalCompositeOperation = 'source-over';
				c.strokeStyle = A(L.c2, 0.85); c.lineWidth = 1.5; c.beginPath(); c.arc(x, ry, S * 0.18, 0, TAU); c.stroke();
				for(let i = 0; i < 8; i++){ const an = i / 8 * TAU; c.beginPath(); c.moveTo(x, ry); c.lineTo(x + Math.cos(an) * S * 0.18, ry + Math.sin(an) * S * 0.18); c.stroke(); }
				c.fillStyle = A(L.c1, 0.6); for(const dx of [-0.7, 0.7]) c.fillRect(x + dx * S - S * 0.04, hy - S * 0.95, S * 0.08, S * 0.28);
				break;
			}
			case 'throne': {
				c.fillStyle = sil;
				for(let k = 0; k < 3; k++) c.fillRect(x - S * (0.9 - k * 0.18), hy - S * (0.1 + k * 0.1), S * (1.8 - k * 0.36), S * 0.1);
				const base = hy - S * 0.4;
				c.fillRect(x - S * 0.42, base - S * 0.32, S * 0.84, S * 0.32);
				c.beginPath(); c.moveTo(x - S * 0.36, base - S * 0.32); c.lineTo(x - S * 0.36, base - S * 1.5); c.lineTo(x - S * 0.18, base - S * 1.75); c.lineTo(x, base - S * 2.05); c.lineTo(x + S * 0.18, base - S * 1.75); c.lineTo(x + S * 0.36, base - S * 1.5); c.lineTo(x + S * 0.36, base - S * 0.32); c.fill();
				c.fillRect(x - S * 0.56, base - S * 0.58, S * 0.16, S * 0.26); c.fillRect(x + S * 0.4, base - S * 0.58, S * 0.16, S * 0.26);
				c.strokeStyle = rim; c.lineWidth = 1.5; c.stroke();
				c.globalCompositeOperation = 'lighter'; glow(c, x, base - S * 1.45, S * 0.25, L.c1, 0.7); c.globalCompositeOperation = 'source-over';
				break;
			}
			case 'tree': {
				c.strokeStyle = sil; c.lineCap = 'round';
				const branch = (bx, by, ang, len, w, d) => {
					const ex = bx + Math.cos(ang) * len, ey = by + Math.sin(ang) * len;
					c.lineWidth = w; c.beginPath(); c.moveTo(bx, by); c.lineTo(ex, ey); c.stroke();
					if(d <= 0){ c.fillStyle = A(mix(L.c1, sil, 0.35), 0.55); c.beginPath(); c.arc(ex, ey, S * 0.16, 0, TAU); c.fill(); return; }
					const sp = 0.42 + 0.2 * hash(d * 9 + bx, seed);
					branch(ex, ey, ang - sp, len * 0.74, w * 0.68, d - 1); branch(ex, ey, ang + sp * 0.9, len * 0.7, w * 0.66, d - 1);
				};
				branch(x, hy + 2, -PI / 2, S * 0.75, S * 0.2, 6);
				c.lineCap = 'butt';
				break;
			}
			case 'mountains': {
				for(let layer = 0; layer < 3; layer++){
					const f = layer / 2, col = L.ink ? A(L.c1, 0.22 + layer * 0.22) : mix(mix(L.bg, L.c3, 0.35 - layer * 0.12), '#000000', layer * 0.25);
					c.fillStyle = col; c.beginPath(); c.moveTo(x - R, hy + 1);
					const n = 9 + layer * 3;
					for(let i = 0; i <= n; i++){ const u = i / n, px = x - R + u * R * 2, peak = (i % 2 ? 0.25 : 1) * (0.5 + 0.7 * hash(i + layer * 30, seed)) * S * (1.5 - f * 0.55) * (1 - Math.abs(u - 0.5) * 0.6); c.lineTo(px, hy - peak); }
					c.lineTo(x + R, hy + 1); c.closePath(); c.fill();
					if(L.ink){ c.fillStyle = A(L.c1, 0.06); c.fillRect(x - R, hy - S * 0.2, R * 2, S * 0.2); }
				}
				break;
			}
			case 'hands': {
				const hand = (side) => {
					c.save(); c.translate(x + side * S * 0.75, hy + S * 0.05); c.rotate(side * 0.18); c.scale(side, 1);
					c.fillStyle = sil; c.strokeStyle = rim; c.lineWidth = 1.5;
					c.beginPath(); c.moveTo(-S * 0.25, 0); c.lineTo(-S * 0.22, -S * 0.9); c.lineTo(S * 0.28, -S * 0.95); c.lineTo(S * 0.3, 0); c.closePath(); c.fill(); c.stroke();
					c.lineCap = 'round';
					for(let f = 0; f < 4; f++){ const fx = -S * 0.17 + f * S * 0.15, len = S * (0.55 + (f === 1 || f === 2 ? 0.12 : 0)); c.lineWidth = S * 0.12; c.strokeStyle = sil; c.beginPath(); c.moveTo(fx, -S * 0.9); c.quadraticCurveTo(fx - S * 0.05, -S * 0.9 - len * 0.6, fx + S * 0.06, -S * 0.9 - len); c.stroke(); }
					c.lineWidth = S * 0.13; c.beginPath(); c.moveTo(S * 0.28, -S * 0.45); c.quadraticCurveTo(S * 0.55, -S * 0.6, S * 0.62, -S * 0.85); c.stroke();
					c.lineCap = 'butt'; c.restore();
				};
				hand(-1); hand(1); break;
			}
			case 'scales': {
				c.strokeStyle = sil; c.fillStyle = sil; c.lineWidth = S * 0.07;
				c.fillRect(x - S * 0.35, hy - S * 0.12, S * 0.7, S * 0.12);
				c.beginPath(); c.moveTo(x, hy - S * 0.1); c.lineTo(x, hy - S * 1.9); c.stroke();
				c.beginPath(); c.moveTo(x - S * 1.1, hy - S * 1.65); c.lineTo(x + S * 1.1, hy - S * 1.75); c.stroke();
				c.lineWidth = 1.2;
				for(const [px, py] of [[x - S * 1.1, hy - S * 1.65], [x + S * 1.1, hy - S * 1.75]]){
					c.beginPath(); c.moveTo(px, py); c.lineTo(px - S * 0.3, py + S * 0.75); c.moveTo(px, py); c.lineTo(px + S * 0.3, py + S * 0.75); c.stroke();
					c.beginPath(); c.ellipse(px, py + S * 0.78, S * 0.36, S * 0.09, 0, 0, PI); c.fill();
				}
				c.globalCompositeOperation = 'lighter'; glow(c, x, hy - S * 1.9, S * 0.3, L.c1, 0.6); c.globalCompositeOperation = 'source-over';
				break;
			}
			case 'lotus': {
				const cy = hy - S * 0.15;
				c.globalCompositeOperation = L.bright ? 'source-over' : 'lighter'; glow(c, x, cy - S * 0.4, S * 1.4, L.c1, 0.35); c.globalCompositeOperation = 'source-over';
				for(let layer = 0; layer < 3; layer++){
					const n = 7 - layer, len = S * (1.05 - layer * 0.22), wd = S * (0.24 - layer * 0.03);
					for(let i = 0; i < n; i++){
						const an = -PI / 2 + (i - (n - 1) / 2) * (0.38 - layer * 0.03);
						c.save(); c.translate(x, cy); c.rotate(an + PI / 2);
						const gr = c.createLinearGradient(0, 0, 0, -len); gr.addColorStop(0, mix(L.c1, L.bg, 0.35)); gr.addColorStop(1, mix(L.c2, L.c1, 0.2 + layer * 0.15));
						c.fillStyle = gr; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-wd, -len * 0.55, 0, -len); c.quadraticCurveTo(wd, -len * 0.55, 0, 0); c.fill();
						c.strokeStyle = A(L.c2, 0.4); c.lineWidth = 1; c.stroke(); c.restore();
					}
				}
				break;
			}
			case 'pillars': {
				const n = 7;
				for(let i = 0; i < n; i++){
					const u = (i / (n - 1)) * 2 - 1, px = x + u * R * 0.82, h = S * (1.2 + 0.5 * (1 - Math.abs(u))), w = S * 0.16 * (1.1 - Math.abs(u) * 0.3);
					c.fillStyle = sil; c.fillRect(px - w / 2, hy - h, w, h); c.fillRect(px - w * 0.8, hy - h - S * 0.06, w * 1.6, S * 0.06); c.fillRect(px - w * 0.8, hy - S * 0.05, w * 1.6, S * 0.05);
					c.fillStyle = A(L.c1, 0.35); c.fillRect(px - w / 2, hy - h, w * 0.18, h);
				}
				c.fillStyle = sil; c.fillRect(x - R, hy - S * 1.78, R * 2, S * 0.08);
				break;
			}
		}
		c.restore();
	}
	/* the landmark's moving parts */
	function landmarkLive(c, g, R, L, t, seed, a, lookAt){
		const S = lmSize(g, R, L), x = g.x, hy = g.hy, sp = L.spin;
		c.save(); c.globalAlpha *= a;
		switch(L.landmark){
			case 'eye': {
				const ey = hy - S * 1.1, ew = S * 1.1, eh = S * 0.42;
				const blink = (() => { const ph = fract(t * 0.23 + seed * 0.01); return ph > 0.96 ? Math.sin((ph - 0.96) / 0.04 * PI) : 0; })();
				const open = 1 - blink;
				c.save(); c.beginPath(); c.moveTo(x - ew, ey); c.quadraticCurveTo(x, ey - eh * 2 * open, x + ew, ey); c.quadraticCurveTo(x, ey + eh * 2 * open, x - ew, ey); c.closePath();
				const gr = c.createRadialGradient(x, ey, 0, x, ey, ew); gr.addColorStop(0, L.bright ? '#ffffff' : sh(L.c2, 0.1)); gr.addColorStop(1, mix(L.c2, L.c1, 0.5));
				c.fillStyle = gr; c.fill(); c.clip();
				let dx = 0, dy = 0;
				if(lookAt){ const vx = lookAt.x - x, vy = lookAt.y - ey, d = Math.hypot(vx, vy) || 1; dx = vx / d * ew * 0.38 * Math.min(1, d / (R * 0.6)); dy = vy / d * eh * 0.45 * Math.min(1, d / (R * 0.6)); }
				else { dx = Math.sin(t * 0.4) * ew * 0.3; dy = Math.sin(t * 0.7) * eh * 0.2; }
				const ir = eh * 0.95;
				const ig = c.createRadialGradient(x + dx, ey + dy, ir * 0.1, x + dx, ey + dy, ir); ig.addColorStop(0, sh(L.c1, 0.4)); ig.addColorStop(0.7, L.c1); ig.addColorStop(1, sh(L.c1, -0.5));
				c.fillStyle = ig; c.beginPath(); c.arc(x + dx, ey + dy, ir, 0, TAU); c.fill();
				c.fillStyle = '#05010a'; c.beginPath(); c.ellipse(x + dx, ey + dy, ir * 0.22, ir * 0.7, 0, 0, TAU); c.fill();
				c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.arc(x + dx - ir * 0.35, ey + dy - ir * 0.35, ir * 0.12, 0, TAU); c.fill();
				c.restore();
				c.strokeStyle = A(L.c1, 0.9); c.lineWidth = 2.5; c.beginPath(); c.moveTo(x - ew, ey); c.quadraticCurveTo(x, ey - eh * 2 * open, x + ew, ey); c.quadraticCurveTo(x, ey + eh * 2 * open, x - ew, ey); c.stroke();
				break;
			}
			case 'clock': {
				const cy = hy - S * 1.15, cr = S * 0.75, tt = t * sp;
				c.strokeStyle = A(L.c2, 0.95); c.lineCap = 'round';
				for(const [len, w, rate] of [[0.48, 0.05, 0.08], [0.7, 0.03, 0.9], [0.78, 0.012, 6]]){ const an = tt * rate - PI / 2; c.lineWidth = cr * w; c.beginPath(); c.moveTo(x - Math.cos(an) * cr * 0.08, cy - Math.sin(an) * cr * 0.08); c.lineTo(x + Math.cos(an) * cr * len, cy + Math.sin(an) * cr * len); c.stroke(); }
				c.lineCap = 'butt'; c.fillStyle = A(L.c1, 1); c.beginPath(); c.arc(x, cy, cr * 0.05, 0, TAU); c.fill();
				break;
			}
			case 'halo': {
				const cy = hy - S * 1.15, tt = t * sp;
				c.globalCompositeOperation = L.bright ? 'source-over' : 'lighter';
				glow(c, x, cy, S * 1.3, L.c1, 0.2 + 0.05 * Math.sin(t * 2));
				for(let i = 0; i < 3; i++){
					const rx = S * (0.95 - i * 0.2), tilt = 0.3 + i * 0.5 + tt * (0.25 + i * 0.12) * (i % 2 ? -1 : 1);
					c.strokeStyle = A(L.bright ? sh(i === 1 ? L.c3 : L.c1, -0.3) : (i === 1 ? L.c3 : L.c2), 0.8 - i * 0.15); c.lineWidth = 3.5 - i * 0.7;
					c.beginPath(); c.ellipse(x, cy, rx, rx * Math.abs(Math.cos(tilt)) * 0.9 + rx * 0.08, 0.2 * i, 0, TAU); c.stroke();
				}
				c.fillStyle = A(L.bright ? sh(L.c1, -0.3) : L.c2, 0.9); c.beginPath(); c.arc(x, cy, S * 0.08, 0, TAU); c.fill();
				break;
			}
			case 'rift': {
				const top = hy - S * 2.2, bot = hy - S * 0.1;
				c.globalCompositeOperation = 'lighter'; c.strokeStyle = A('#ffffff', 0.5 + 0.4 * Math.sin(t * 9)); c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, top);
				for(let i = 1; i <= 16; i++) c.lineTo(x + (hash(i + Math.floor(t * 12), seed) - 0.5) * S * 0.08, top + (bot - top) * i / 16);
				c.stroke(); break;
			}
			case 'blades': {
				const cy = hy - S * 1.2, rr = S * 1.0, n = 12, tt = t * sp * 0.15;
				for(let i = 0; i < n; i++){
					const an = i / n * TAU + tt, bx = x + Math.cos(an) * rr, by = cy + Math.sin(an) * rr * 0.55;
					sword(c, bx, by, an + PI, S * 0.62, L, 0.95);
				}
				c.globalCompositeOperation = 'lighter'; glow(c, x, cy, S * 0.5, L.c1, 0.35);
				break;
			}
			case 'sun': case 'moon': case 'eclipse': {
				const yy = hy - S * (L.landmark === 'sun' ? 0.35 : 1.2);
				c.globalCompositeOperation = 'lighter'; glow(c, x, yy, S * 1.6, L.c1, 0.06 + 0.05 * Math.sin(t * 1.4));
				break;
			}
		}
		c.restore();
	}
	function sword(c, bx, by, ang, len, L, a){
		c.save(); c.translate(bx, by); c.rotate(ang); c.globalAlpha *= a;
		const steel = mix('#cfd6e2', L.c1, 0.25);
		c.fillStyle = steel; c.beginPath(); c.moveTo(0, -len * 0.04); c.lineTo(len * 0.78, -len * 0.025); c.lineTo(len, 0); c.lineTo(len * 0.78, len * 0.025); c.lineTo(0, len * 0.04); c.closePath(); c.fill();
		c.fillStyle = A('#ffffff', 0.55); c.fillRect(0, -len * 0.012, len * 0.8, len * 0.01);
		c.fillStyle = mix(L.c3, '#222222', 0.4); c.fillRect(-len * 0.02, -len * 0.11, len * 0.04, len * 0.22); c.fillRect(-len * 0.22, -len * 0.025, len * 0.2, len * 0.05);
		c.restore();
	}

	/* ============================================================ FLOOR (static) */
	function rowsY(g, bottom, n){ const out = []; const H = Math.max(4, g.gy - g.hy); for(let k = 1; k < 200; k++){ const yy = g.hy + H * (k * k) / (n * n); if(yy > bottom) break; out.push(yy); } out.push(bottom); return out; }
	function colX(g, i, w, yy){ const H = Math.max(4, g.gy - g.hy); return g.x + i * w * (yy - g.hy) / H; }
	function paintFloor(c, g, R, L, seed){
		if(L.floor === 'none') return;
		const { x, gy, hy } = g, bottom = g.y + R, X0 = x - R, W2 = R * 2, H = Math.max(4, gy - hy);
		const band = (stops) => vGrad(c, X0, hy, W2, bottom, stops);
		const persp = (yy) => clamp((yy - hy) / H, 0.02, 1.15);
		const objBottom = Math.min(bottom, gy + R * 0.04);      // scattered things stand on the floor, not in the ground under your feet
		switch(L.floor){
			case 'water': case 'mirror': {
				const mirror = L.floor === 'mirror';
				band([[0, mix(L.bg, L.c1, mirror ? 0.35 : 0.22)], [0.5, mix(L.bg, L.c3, 0.18)], [1, sh(L.bg, -0.4)]]);
				// the reflection: the sky and the landmark, upside down
				c.save(); c.beginPath(); c.rect(X0, hy, W2, bottom - hy); c.clip();
				c.globalAlpha *= mirror ? 0.5 : 0.28;
				c.translate(0, hy * 2); c.scale(1, -1);
				paintLandmark(c, g, R, L, seed, 1);
				c.restore();
				c.fillStyle = A(L.c2, mirror ? 0.1 : 0.07);
				for(const yy of rowsY(g, bottom, mirror ? 7 : 11)){ const p = persp(yy); c.fillRect(X0, yy, W2, Math.max(0.6, p * (mirror ? 1 : 1.6))); }
				if(mirror){ c.strokeStyle = A(L.c1, 0.12); c.lineWidth = 1; c.beginPath(); for(let i = -8; i <= 8; i++){ c.moveTo(x, hy); c.lineTo(colX(g, i, R * 0.35, bottom), bottom); } c.stroke(); }
				break;
			}
			case 'tiles': case 'stone': {
				const stone = L.floor === 'stone';
				const base = stone ? mix(L.bg, '#5a5650', 0.45) : mix(L.bg, L.c1, 0.14);
				band([[0, sh(base, -0.35)], [1, sh(base, 0.12)]]);
				const ys = rowsY(g, bottom, stone ? 6 : 7), w = R * (stone ? 0.3 : 0.24);
				let prev = hy;
				for(let r = 0; r < ys.length; r++){
					const y0 = prev, y1 = ys[r]; prev = y1;
					const off = stone && r % 2 ? 0.5 : 0;
					for(let i = -12; i < 12; i++){
						const shade = stone ? hash(i * 31 + r, seed) * 0.12 : ((i + r) % 2 ? 0.1 : 0);
						if(shade <= 0.001) continue;
						c.fillStyle = stone ? A(hash(i + r * 7, seed) > 0.5 ? '#000000' : '#ffffff', shade * 0.6) : A(L.c1, shade);
						c.beginPath(); c.moveTo(colX(g, i + off, w, y0), y0); c.lineTo(colX(g, i + 1 + off, w, y0), y0); c.lineTo(colX(g, i + 1 + off, w, y1), y1); c.lineTo(colX(g, i + off, w, y1), y1); c.fill();
					}
				}
				c.strokeStyle = stone ? 'rgba(0,0,0,.35)' : A(L.c1, 0.28); c.lineWidth = 1; c.beginPath();
				for(const yy of ys){ c.moveTo(X0, yy); c.lineTo(X0 + W2, yy); }
				if(!stone) for(let i = -12; i <= 12; i++){ c.moveTo(x, hy); c.lineTo(colX(g, i, w, bottom), bottom); }
				else { prev = hy; for(let r = 0; r < ys.length; r++){ const y0 = prev, y1 = ys[r]; prev = y1; const off = r % 2 ? 0.5 : 0; for(let i = -12; i <= 12; i++){ c.moveTo(colX(g, i + off, w, y0), y0); c.lineTo(colX(g, i + off, w, y1), y1); } } }
				c.stroke();
				break;
			}
			case 'grid': {
				band([[0, mix(L.bg, L.c3, 0.3)], [1, sh(L.bg, -0.6)]]);
				c.globalCompositeOperation = 'lighter'; c.strokeStyle = A(L.c1, 0.55); c.lineWidth = 1.4; c.beginPath();
				for(const yy of rowsY(g, bottom, 9)){ c.moveTo(X0, yy); c.lineTo(X0 + W2, yy); }
				for(let i = -14; i <= 14; i++){ c.moveTo(x, hy); c.lineTo(colX(g, i, R * 0.2, bottom), bottom); }
				c.stroke(); glow(c, x, hy, R * 0.9, L.c1, 0.25);
				c.fillStyle = A(L.c2, 0.7); c.fillRect(X0, hy - 1, W2, 2);
				c.globalCompositeOperation = 'source-over'; break;
			}
			case 'field': case 'petals': {
				const petals = L.floor === 'petals';
				const base = petals ? mix(L.c1, L.bg, 0.45) : (L.bright ? mix(L.c3, '#9ad08a', 0.5) : mix(L.c3, '#0c2412', 0.65));
				band([[0, sh(base, L.bright ? 0.25 : -0.2)], [1, sh(base, L.bright ? -0.1 : -0.45)]]);
				const n = Math.round(R * 0.7);
				for(let i = 0; i < n; i++){
					const u = hash(i, seed + 2), yy = hy + (objBottom - hy) * u * u, px = x + (hash(i + 5, seed) * 2 - 1) * R, p = persp(yy), s = 1 + p * 3.5;
					c.fillStyle = A(hash(i + 9, seed) > 0.5 ? L.c1 : L.c2, 0.55 + 0.4 * hash(i + 3, seed));
					if(petals){ c.save(); c.translate(px, yy); c.rotate(hash(i, 3) * TAU); c.beginPath(); c.ellipse(0, 0, s * 1.5, s * 0.6, 0, 0, TAU); c.fill(); c.restore(); }
					else { c.beginPath(); c.arc(px, yy, s * 0.7, 0, TAU); c.fill(); if(p > 0.6){ c.strokeStyle = A(mix(base, '#000000', 0.2), 0.5); c.lineWidth = 1; c.beginPath(); c.moveTo(px, yy + s); c.lineTo(px + (hash(i, 7) - 0.5) * 4, yy + s * 4); c.stroke(); } }
				}
				break;
			}
			case 'blades': {
				const base = L.bright ? mix(L.c2, L.c3, 0.3) : mix(L.bg, '#2a2420', 0.4);
				band([[0, sh(base, 0.1)], [1, sh(base, -0.35)]]);
				const list = [];
				for(let i = 0; i < Math.round(clamp(R * 0.2, 28, 90)); i++){ const u = hash(i, seed + 6); list.push([hy + (objBottom - hy) * u * u * 0.98 + 2, x + (hash(i + 2, seed) * 2 - 1) * R * 0.95, hash(i + 4, seed)]); }
				list.sort((a, b) => a[0] - b[0]);
				for(const [yy, px, r] of list){ const p = persp(yy), len = R * 0.15 * (0.35 + p * 1.0); sword(c, px, yy, -PI / 2 + (r - 0.5) * 0.5, len, L, 0.6 + 0.4 * Math.min(1, p)); c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(px, yy, len * 0.12, len * 0.03, 0, 0, TAU); c.fill(); }
				break;
			}
			case 'sand': {
				const base = mix(L.c1, '#d9b878', 0.55);
				band([[0, sh(base, -0.15)], [1, sh(base, -0.5)]]);
				for(let k = 0; k < 7; k++){
					const yy = hy + (bottom - hy) * (k / 7) * (k / 7) + 4;
					c.fillStyle = A(k % 2 ? '#000000' : '#ffffff', 0.07 + k * 0.01); c.beginPath(); c.moveTo(X0, yy + 30);
					for(let i = 0; i <= 24; i++){ const px = X0 + i / 24 * W2; c.lineTo(px, yy + Math.sin(i * 0.7 + k * 2 + seed) * (6 + k * 3)); }
					c.lineTo(X0 + W2, yy + 30 + k * 10); c.closePath(); c.fill();
				}
				break;
			}
			case 'ice': {
				band([[0, mix(L.c1, '#ffffff', 0.45)], [1, mix(L.c1, L.bg, 0.45)]]);
				c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 1; c.beginPath();
				for(let k = 0; k < 18; k++){ let px = x + (hash(k, seed) * 2 - 1) * R, yy = hy + (bottom - hy) * hash(k + 3, seed); c.moveTo(px, yy); for(let s = 0; s < 5; s++){ px += (hash(k * 5 + s, seed) - 0.5) * R * 0.25; yy += (hash(k * 3 + s, seed + 1) - 0.3) * R * 0.08; c.lineTo(px, yy); } }
				c.stroke();
				c.fillStyle = 'rgba(255,255,255,.12)'; for(let i = 0; i < 5; i++){ const yy = hy + (bottom - hy) * (0.15 + i * 0.18); c.beginPath(); c.moveTo(x - R * 0.2 + i * 30, yy); c.lineTo(x + R * 0.1 + i * 30, yy); c.lineTo(x - i * 20, yy + 6 + i * 3); c.fill(); }
				break;
			}
			case 'lava': {
				band([[0, '#2a0c04'], [1, '#0a0302']]);
				c.globalCompositeOperation = 'lighter';
				for(let k = 0; k < 22; k++){
					let px = x + (hash(k, seed) * 2 - 1) * R, yy = hy + (bottom - hy) * Math.pow(hash(k + 3, seed), 1.4), p = persp(yy);
					c.strokeStyle = A(k % 3 ? L.c1 : sh(L.c1, 0.4), 0.7); c.lineWidth = 1 + p * 2.5; c.beginPath(); c.moveTo(px, yy);
					for(let s = 0; s < 5; s++){ px += (hash(k * 5 + s, seed) - 0.5) * R * 0.3; yy += (hash(k * 3 + s, seed + 1) - 0.4) * R * 0.05 * p; c.lineTo(px, yy); }
					c.stroke();
				}
				glow(c, x, hy, R * 0.9, L.c1, 0.3);
				c.globalCompositeOperation = 'source-over'; break;
			}
			case 'ash': {
				const base = mix(L.bg, '#4a4644', 0.5);
				band([[0, sh(base, 0.1)], [1, sh(base, -0.5)]]);
				for(let i = 0; i < 9; i++){ const yy = hy + (objBottom - hy) * hash(i, seed + 4), px = x + (hash(i + 1, seed) * 2 - 1) * R, w = R * 0.25 * persp(yy); c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.ellipse(px, yy, w, w * 0.18, 0, 0, TAU); c.fill(); }
				c.globalCompositeOperation = 'lighter'; c.fillStyle = A(L.c1, 0.7);
				for(let i = 0; i < 50; i++){ const yy = hy + (objBottom - hy) * hash(i + 20, seed), px = x + (hash(i + 30, seed) * 2 - 1) * R, s = 0.6 + persp(yy) * 1.2; c.fillRect(px, yy, s, s); }
				c.globalCompositeOperation = 'source-over'; break;
			}
			case 'clouds': {
				const top = L.bright || L.ink ? '#ffffff' : mix(L.c2, L.bg, 0.55);
				band([[0, mix(top, L.c1, 0.15)], [1, mix(top, L.bg, 0.3)]]);
				for(let row = 0; row < 6; row++){
					const yy = hy + (bottom - hy) * (row / 6) * (row / 6) + 3, p = persp(yy), r = R * 0.06 * (0.6 + p * 1.4);
					c.fillStyle = A(row % 2 ? mix(top, '#000000', 0.08) : top, L.ink ? 0.85 : 0.75);
					c.beginPath(); for(let i = 0; i < 16; i++){ const px = X0 + (i + hash(row * 16 + i, seed) * 0.6) / 15 * W2, rr = r * (0.7 + 0.6 * hash(i + row, seed)); c.moveTo(px + rr, yy); c.arc(px, yy, rr, 0, TAU); } c.fill();
				}
				break;
			}
			case 'void': {
				band([[0, mix(L.bg, L.c1, 0.12)], [1, sh(L.bg, -0.7)]]);
				stars(c, g, R, seed + 9, 80, L.c2, 0.55, true);
				c.strokeStyle = A(L.c1, 0.12); c.lineWidth = 1; c.beginPath();
				for(const yy of rowsY(g, bottom, 8)){ c.moveTo(X0, yy); c.lineTo(X0 + W2, yy); }
				for(let i = -10; i <= 10; i++){ c.moveTo(x, hy); c.lineTo(colX(g, i, R * 0.25, bottom), bottom); }
				c.stroke(); break;
			}
			case 'bones': {
				const base = L.bright ? mix(L.c2, '#b0a090', 0.4) : mix(L.bg, '#201410', 0.3);
				band([[0, sh(base, 0.06)], [1, sh(base, -0.45)]]);
				const bone = mix('#e8dcc8', L.c1, 0.12);
				for(let i = 0; i < Math.round(R * 0.22); i++){
					const u = hash(i, seed + 8), yy = hy + (objBottom - hy) * u * u + 2, px = x + (hash(i + 3, seed) * 2 - 1) * R, p = persp(yy), len = R * 0.035 * (0.5 + p * 1.6), an = hash(i + 6, seed) * PI;
					c.save(); c.translate(px, yy); c.rotate(an); c.strokeStyle = A(bone, 0.4 + 0.5 * Math.min(1, p)); c.lineWidth = Math.max(1, len * 0.22); c.lineCap = 'round';
					c.beginPath(); c.moveTo(-len, 0); c.lineTo(len, 0); c.stroke();
					c.fillStyle = c.strokeStyle; for(const s of [-1, 1]){ c.beginPath(); c.arc(s * len, -len * 0.12, len * 0.18, 0, TAU); c.arc(s * len, len * 0.12, len * 0.18, 0, TAU); c.fill(); }
					c.restore();
				}
				break;
			}
		}
		// horizon haze: sky and floor melt together
		{ const hh = R * 0.09, gr = c.createLinearGradient(0, hy - hh, 0, hy + hh * 1.4), hz = L.bright ? '#ffffff' : mix(L.c1, L.c2, 0.4);
		  gr.addColorStop(0, A(hz, 0)); gr.addColorStop(0.42, A(hz, L.bright ? 0.5 : 0.22)); gr.addColorStop(1, A(hz, 0));
		  c.save(); c.globalCompositeOperation = L.bright ? 'source-over' : 'lighter'; c.fillStyle = gr; c.fillRect(X0, hy - hh, W2, hh * 2.4); c.restore(); }
		// under your feet: the ground itself, seen in section — darker, so the floor reads as the surface you stand on
		if(bottom > gy + 2){
			const slab = c.createLinearGradient(0, gy, 0, bottom);
			slab.addColorStop(0, A(L.bright ? mix(L.c1, L.bg, 0.5) : sh(L.bg, -0.4), L.bright ? 0.25 : 0.45)); slab.addColorStop(1, A(L.bright ? mix(L.c3, '#444444', 0.4) : sh(L.bg, -0.8), L.bright ? 0.55 : 0.85));
			c.fillStyle = slab; c.fillRect(X0, gy, W2, bottom - gy);
		}
		// where you stand: a lit edge along the real ground
		c.fillStyle = A(L.bright ? sh(L.c1, -0.2) : L.c1, 0.4); c.fillRect(X0, gy - 1, W2, 2);
	}

	/* ============================================================ SIGILS (live) */
	function drawPattern(ctx, x, y, R, L, t, seed, k){
		const rot = t * 0.25 * L.spin + seed, ink = L.bright ? A(mix(L.c1, '#000000', 0.15), 0.55 * k) : A(L.c1, 0.45 * k), ink2 = L.bright ? A(mix(L.c1, '#5a1a3a', 0.45), 0.5 * k) : A(L.c2, 0.55 * k);
		ctx.lineWidth = 1.4; ctx.strokeStyle = ink;
		const ring = (r, a0, a1) => { ctx.beginPath(); ctx.arc(x, y, r, a0 || 0, a1 == null ? TAU : a1); ctx.stroke(); };
		switch(L.sigil){
			case 'rings': {
				for(const f of [0.3, 0.55, 0.8]) ring(R * f, rot * (f > 0.5 ? -1 : 1), rot * (f > 0.5 ? -1 : 1) + PI * 1.55);
				ctx.strokeStyle = ink2; ctx.beginPath();
				const n = Math.max(14, Math.round(R / 20));
				for(let i = 0; i < n; i++){ const a = rot + i / n * TAU, cx = x + Math.cos(a) * (R - 7), cy = y + Math.sin(a) * (R - 7), s = 4; ctx.moveTo(cx + Math.cos(a + 0.8) * s, cy + Math.sin(a + 0.8) * s); ctx.lineTo(cx - Math.cos(a + 0.8) * s, cy - Math.sin(a + 0.8) * s); }
				ctx.stroke(); break;
			}
			case 'glyphs': {
				ctx.strokeStyle = ink2; ctx.beginPath();
				for(const [f, n, dir] of [[0.82, 26, 1], [0.52, 16, -1]]) for(let i = 0; i < n; i++) glyph(ctx, x + Math.cos(rot * dir + i / n * TAU) * R * f, y + Math.sin(rot * dir + i / n * TAU) * R * f, rot * dir + i / n * TAU, 5, i % 4);
				ctx.stroke(); ctx.strokeStyle = ink; ring(R * 0.68); ring(R * 0.92); break;
			}
			case 'mandala': {
				ring(R * 0.95); ring(R * 0.18);
				for(const [f, n, len] of [[0.35, 8, 0.2], [0.62, 16, 0.18], [0.85, 24, 0.1]]){
					ctx.beginPath();
					for(let i = 0; i < n; i++){ const a = i / n * TAU + rot * (f > 0.5 ? -0.4 : 0.4); ctx.save(); ctx.translate(x + Math.cos(a) * R * f, y + Math.sin(a) * R * f); ctx.rotate(a); ctx.moveTo(-R * len, 0); ctx.quadraticCurveTo(0, -R * len * 0.5, R * len, 0); ctx.quadraticCurveTo(0, R * len * 0.5, -R * len, 0); ctx.restore(); }
					ctx.stroke();
				}
				break;
			}
			case 'hexagram': {
				ring(R * 0.95); ring(R * 0.86);
				ctx.strokeStyle = ink2; ctx.beginPath();
				for(let s = 0; s < 2; s++) for(let i = 0; i <= 3; i++){ const a = rot * 0.3 + s * PI / 3 + i / 3 * TAU - PI / 2, px = x + Math.cos(a) * R * 0.86, py = y + Math.sin(a) * R * 0.86; if(i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
				ctx.stroke(); ctx.strokeStyle = ink; ring(R * 0.43);
				ctx.beginPath(); for(let i = 0; i < 6; i++) glyph(ctx, x + Math.cos(rot * 0.3 + i / 6 * TAU) * R * 0.91, y + Math.sin(rot * 0.3 + i / 6 * TAU) * R * 0.91, i / 6 * TAU, 4, i % 4); ctx.stroke();
				break;
			}
			case 'clock': {
				ring(R * 0.95); ring(R * 0.8);
				ctx.beginPath(); for(let i = 0; i < 12; i++){ const a = i / 12 * TAU; ctx.moveTo(x + Math.cos(a) * R * 0.8, y + Math.sin(a) * R * 0.8); ctx.lineTo(x + Math.cos(a) * R * 0.95, y + Math.sin(a) * R * 0.95); } ctx.stroke();
				ctx.strokeStyle = ink2; ctx.lineWidth = 2.5; ctx.beginPath(); const h = t * 0.2 * L.spin, m = t * 1.4 * L.spin; ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(h) * R * 0.45, y + Math.sin(h) * R * 0.45); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(m) * R * 0.7, y + Math.sin(m) * R * 0.7); ctx.stroke();
				break;
			}
			case 'spiral': {
				for(let arm = 0; arm < 3; arm++){ ctx.beginPath(); for(let i = 0; i <= 60; i++){ const u = i / 60, a = rot + arm * TAU / 3 + u * 4.2, r = R * 0.95 * u; if(i) ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); else ctx.moveTo(x, y); } ctx.stroke(); }
				ctx.strokeStyle = ink2; ring(R * 0.95); break;
			}
			case 'web': {
				ctx.beginPath(); const n = 12;
				for(let i = 0; i < n; i++){ const a = i / n * TAU + rot * 0.1; ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * R * 0.95, y + Math.sin(a) * R * 0.95); }
				for(let r = 1; r <= 6; r++){ for(let i = 0; i <= n; i++){ const a = i / n * TAU + rot * 0.1, rr = R * 0.95 * r / 6 * (0.92 + 0.08 * Math.cos(i * 2)); if(i) ctx.quadraticCurveTo(x + Math.cos(a - PI / n) * rr * 0.9, y + Math.sin(a - PI / n) * rr * 0.9, x + Math.cos(a) * rr, y + Math.sin(a) * rr); else ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } }
				ctx.stroke(); break;
			}
			case 'lattice': {
				ctx.save(); ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.clip(); ctx.beginPath();
				const s = R / 5;
				for(let gx = -6; gx <= 6; gx++) for(let gy = -6; gy <= 6; gy++){ const cx = x + gx * s * 1.5, cy = y + gy * s * 1.732 + (gx % 2 ? s * 0.866 : 0); for(let i = 0; i <= 6; i++){ const a = i / 6 * TAU + rot * 0.05, px = cx + Math.cos(a) * s * 0.92, py = cy + Math.sin(a) * s * 0.92; if(i) ctx.lineTo(px, py); else ctx.moveTo(px, py); } }
				ctx.stroke(); ctx.restore(); ring(R * 0.97); break;
			}
			case 'compass': {
				ring(R * 0.95); ring(R * 0.7);
				ctx.fillStyle = ink2;
				for(let i = 0; i < 8; i++){ const a = i / 8 * TAU + rot * 0.1, l = i % 2 ? 0.55 : 0.95, w = 0.12; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * R * l, y + Math.sin(a) * R * l); ctx.lineTo(x + Math.cos(a + w * 3) * R * 0.14, y + Math.sin(a + w * 3) * R * 0.14); ctx.lineTo(x, y); ctx.closePath(); ctx.fill(); }
				ctx.beginPath(); for(let i = 0; i < 32; i++){ const a = i / 32 * TAU; ctx.moveTo(x + Math.cos(a) * R * 0.88, y + Math.sin(a) * R * 0.88); ctx.lineTo(x + Math.cos(a) * R * 0.95, y + Math.sin(a) * R * 0.95); } ctx.stroke();
				break;
			}
			case 'lotus': case 'petals': {
				const lotus = L.sigil === 'lotus';
				for(const [f, n, dir, len] of (lotus ? [[0.2, 8, 1, 0.22], [0.45, 12, -1, 0.26], [0.72, 16, 1, 0.22]] : [[0.34, 10, 1, 0.2], [0.64, 16, -1, 0.17]])){
					for(let i = 0; i < n; i++){
						const a = rot * 0.5 * dir + i / n * TAU, r0 = R * f;
						ctx.save(); ctx.translate(x + Math.cos(a) * r0, y + Math.sin(a) * r0); ctx.rotate(a);
						ctx.fillStyle = A(L.c1, (L.bright ? 0.2 : 0.14) * k); ctx.strokeStyle = ink;
						ctx.beginPath(); if(lotus){ ctx.moveTo(-R * len, 0); ctx.quadraticCurveTo(0, -R * len * 0.45, R * len, 0); ctx.quadraticCurveTo(0, R * len * 0.45, -R * len, 0); } else ctx.ellipse(0, 0, R * len, R * len * 0.36, 0, 0, TAU);
						ctx.fill(); ctx.stroke(); ctx.restore();
					}
				}
				if(lotus){ ctx.strokeStyle = ink2; ring(R * 0.95); }
				break;
			}
			case 'spikes': {
				const n = Math.max(18, Math.round(R / 14));
				ctx.fillStyle = A(L.c1, 0.28 * k); ctx.beginPath();
				for(let i = 0; i < n; i++){ const a = i / n * TAU + seed, w = TAU / n * 0.34, l = R * (0.12 + 0.08 * hash(i, seed)); ctx.moveTo(x + Math.cos(a - w) * R, y + Math.sin(a - w) * R); ctx.lineTo(x + Math.cos(a) * (R - l), y + Math.sin(a) * (R - l)); ctx.lineTo(x + Math.cos(a + w) * R, y + Math.sin(a + w) * R); }
				ctx.fill(); ctx.beginPath();
				for(let i = 0; i < 12; i++){ const a = rot * 0.4 + i / 12 * TAU; ctx.moveTo(x + Math.cos(a) * R * 0.2, y + Math.sin(a) * R * 0.2); ctx.lineTo(x + Math.cos(a) * R * 0.72, y + Math.sin(a) * R * 0.72); }
				ctx.stroke(); ring(R * 0.2); break;
			}
			case 'pillars': {
				for(let i = 0; i < 16; i++){ const a = i / 16 * TAU + seed * 0.1; ctx.save(); ctx.translate(x + Math.cos(a) * R * 0.93, y + Math.sin(a) * R * 0.93); ctx.rotate(a); ctx.fillStyle = A(L.c1, 0.2 * k); ctx.fillRect(-R * 0.07, -5, R * 0.14, 10); ctx.fillStyle = A(L.c2, 0.5 * k); ctx.fillRect(-R * 0.07, -5, 3, 10); ctx.restore(); }
				ring(R * 0.8);
				ctx.strokeStyle = ink2; ctx.beginPath(); ctx.moveTo(x - R * 0.22, y - R * 0.04); ctx.lineTo(x + R * 0.22, y - R * 0.04); ctx.moveTo(x, y - R * 0.04); ctx.lineTo(x, y + R * 0.14);
				ctx.moveTo(x - R * 0.22, y - R * 0.04); ctx.arc(x - R * 0.22, y + R * 0.02, R * 0.06, -PI / 2, PI / 2); ctx.moveTo(x + R * 0.22, y - R * 0.04); ctx.arc(x + R * 0.22, y + R * 0.02, R * 0.06, -PI / 2, PI / 2); ctx.stroke(); break;
			}
			case 'waves': {
				for(const f of [0.3, 0.5, 0.7, 0.9]){ ctx.beginPath(); for(let i = 0; i <= 64; i++){ const a = i / 64 * TAU, r = R * f + Math.sin(a * 7 + t * 1.4 * L.spin * (f > 0.6 ? -1 : 1) + f * 9) * R * 0.018; if(i) ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); else ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } ctx.stroke(); }
				break;
			}
			case 'stars': {
				ctx.fillStyle = ink2; const pts = [];
				for(let i = 0; i < 34; i++){ const a = hash(i, seed) * TAU, r = Math.sqrt(hash(i + 50, seed)) * R * 0.92; pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); const tw = 0.5 + 0.5 * Math.sin(t * 2 + i * 1.7); ctx.beginPath(); ctx.arc(pts[i][0], pts[i][1], 1 + hash(i + 9, seed) * 1.6 * (0.6 + 0.4 * tw), 0, TAU); ctx.fill(); }
				ctx.strokeStyle = A(L.c1, 0.16 * k); ctx.beginPath(); for(let i = 0; i < 33; i += 2){ ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[i + 1][0], pts[i + 1][1]); } ctx.stroke(); break;
			}
			case 'cracks': {
				ctx.beginPath();
				for(let c2 = 0; c2 < 14; c2++){ let a = hash(c2, seed) * TAU, r = R * 0.98; ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); for(let s = 0; s < 6; s++){ a += (hash(c2 * 7 + s, seed) - 0.5) * 0.5; r -= R * (0.06 + 0.09 * hash(c2 * 3 + s, seed + 1)); ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } }
				ctx.stroke(); break;
			}
			case 'grid': {
				ctx.save(); ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.clip(); ctx.translate(x, y); ctx.rotate(rot * 0.2); ctx.strokeStyle = A(L.c1, 0.22 * k); ctx.beginPath();
				const sp = Math.max(18, R / 9); for(let gg = -R; gg <= R; gg += sp){ ctx.moveTo(gg, -R); ctx.lineTo(gg, R); ctx.moveTo(-R, gg); ctx.lineTo(R, gg); }
				ctx.stroke(); ctx.restore(); break;
			}
		}
	}
	function glyph(ctx, cx, cy, a, s, u){
		const ca = Math.cos(a), sa = Math.sin(a);
		if(u === 0){ ctx.moveTo(cx - ca * s, cy - sa * s); ctx.lineTo(cx + ca * s, cy + sa * s); ctx.moveTo(cx - sa * s, cy + ca * s); ctx.lineTo(cx + sa * s, cy - ca * s); }
		else if(u === 1){ ctx.moveTo(cx + ca * s, cy + sa * s); ctx.lineTo(cx - ca * s - sa * s, cy - sa * s + ca * s); ctx.lineTo(cx - ca * s + sa * s, cy - sa * s - ca * s); ctx.closePath(); }
		else if(u === 2){ ctx.moveTo(cx - sa * s, cy + ca * s); ctx.lineTo(cx + sa * s, cy - ca * s); ctx.moveTo(cx - sa * s + ca * s * 0.6, cy + ca * s + sa * s * 0.6); ctx.lineTo(cx - sa * s - ca * s * 0.6, cy + ca * s - sa * s * 0.6); }
		else { ctx.moveTo(cx + ca * s, cy + sa * s); ctx.arc(cx, cy, s, a, a + PI * 1.5); }
	}
	function drawSigil(c, g, R, L, t, seed, k){
		if(L.sigil === 'none') return;
		c.save(); c.globalCompositeOperation = L.bright ? 'source-over' : 'lighter';
		const at = L.sigilAt;
		if(at === 'floor' || at === 'both'){
			const sq = clamp((g.gy - g.hy) / R * 0.75, 0.16, 0.42);
			c.save(); c.translate(g.x, g.gy); c.scale(1, sq); drawPattern(c, 0, 0, R * L.sigilSize, L, t, seed, k); c.restore();
		}
		if(at === 'center' || at === 'both') drawPattern(c, g.x, g.y, R * L.sigilSize * (at === 'both' ? 0.75 : 1), L, t, seed, k * 0.85);
		if(at === 'sky') drawPattern(c, g.x, g.hy - R * 0.42, R * 0.42 * L.sigilSize, L, t, seed, k);
		c.restore();
	}

	/* ============================================================ floor and sky, moving parts */
	function floorLive(c, g, R, L, t, k){
		const bottom = g.y + R, X0 = g.x - R, W2 = R * 2;
		switch(L.floor){
			case 'water': case 'mirror': {
				c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = A(L.c2, 0.16 * k);
				for(let i = 0; i < 14; i++){ const u = fract(hash(i, 5) + t * 0.03 * L.pSpeed), yy = g.hy + (bottom - g.hy) * u * u, w = R * (0.06 + 0.2 * u) * (0.5 + hash(i, 9)), px = g.x + (hash(i + 3, 2) * 2 - 1) * R * 0.8 + Math.sin(t + i) * 10; c.fillRect(px - w / 2, yy, w, 1 + u * 1.5); }
				c.restore(); break;
			}
			case 'lava': { c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = A(L.c1, (0.05 + 0.05 * Math.sin(t * 2.3)) * k); c.fillRect(X0, g.hy, W2, bottom - g.hy); c.restore(); break; }
			case 'grid': { c.save(); c.globalCompositeOperation = 'lighter'; const u = fract(t * 0.4 * L.spin); const yy = g.hy + (g.gy - g.hy) * u * u * 1.4; c.fillStyle = A(L.c2, 0.3 * (1 - u) * k); c.fillRect(X0, yy, W2, 1.5); c.restore(); break; }
		}
		if(L.sky === 'storm' || L.p1 === 'lightning' || L.p2 === 'lightning'){
			const ph = fract(t * 0.21 + 0.3); if(ph < 0.025){ c.fillStyle = A('#ffffff', 0.18 * (1 - ph / 0.025) * k); c.fillRect(X0, g.y - R, W2, g.hy - g.y + R); }
		}
		if(L.sky === 'aurora'){ c.save(); c.globalCompositeOperation = 'lighter'; for(let b = 0; b < 2; b++){ c.strokeStyle = A(b ? L.c3 : L.c1, 0.1 * k); c.lineWidth = R * 0.05; c.beginPath(); for(let i = 0; i <= 30; i++){ const u = i / 30, px = X0 + u * W2, py = g.y - R + (g.hy - g.y + R) * (0.35 + b * 0.15) + Math.sin(u * 6 + t * 0.6 * L.spin + b * 3) * R * 0.05; if(i) c.lineTo(px, py); else c.moveTo(px, py); } c.stroke(); } c.restore(); }
	}

	/* ============================================================ PARTICLES (live; a function of time) */
	function drawParticles(c, g, R, L, kind, amount, t, seed, k){
		if(!kind || kind === 'none' || amount <= 0) return;
		const n = Math.round(clamp(22 * amount * Math.sqrt(R / 300), 3, 110)), sp = L.pSpeed, x = g.x, y = g.y;
		const col = (i) => i % 3 === 0 ? L.c2 : (i % 3 === 1 ? L.c1 : L.c3);
		c.save();
		if(kind === 'lightning'){
			const P = 2.6 / clamp(amount, 0.2, 2.5);
			for(let j = 0; j < 2; j++){
				const tt = t / P + j * 0.5, cyc = Math.floor(tt), ph = fract(tt);
				if(ph > 0.07) continue;
				const a = (1 - ph / 0.07) * k, sx = x + (hash(cyc, seed + j) * 2 - 1) * R * 0.7, ex = sx + (hash(cyc + 3, seed) - 0.5) * R * 0.4, sy = y - R, ey = g.gy;
				c.globalCompositeOperation = 'lighter'; c.strokeStyle = A(L.c2, 0.9 * a); c.lineWidth = 2.2; c.shadowColor = L.c1; c.shadowBlur = 12;
				c.beginPath(); c.moveTo(sx, sy); for(let s = 1; s <= 10; s++){ const u = s / 10; c.lineTo(sx + (ex - sx) * u + (hash(cyc * 13 + s, seed) - 0.5) * R * 0.12, sy + (ey - sy) * u); } c.stroke();
				c.shadowBlur = 0;
			}
			c.restore(); return;
		}
		const lighter = !L.bright && ['embers', 'sparks', 'fireflies', 'stars', 'glyphs', 'shards', 'bubbles'].includes(kind);
		if(lighter) c.globalCompositeOperation = 'lighter';
		for(let i = 0; i < n; i++){
			const h1 = hash(i, seed), h2 = hash(i + 3, seed), h3 = hash(i + 11, seed), h4 = hash(i + 17, seed);
			const ph = fract(t * sp * (0.05 + 0.09 * h1) + h2), hx = (h3 * 2 - 1) * R * 0.92, life = Math.sin(ph * PI);
			let px, py, a = k * life;
			switch(kind){
				case 'embers': px = x + hx + Math.sin(t * 1.2 + i) * 9; py = y + R * 0.8 - ph * R * 1.7; c.fillStyle = A(i % 3 ? L.c1 : L.c2, 0.9 * a); c.beginPath(); c.arc(px, py, 1.3 + h4 * 1.7, 0, TAU); c.fill(); break;
				case 'sparks': px = x + hx + Math.sin(t * 3 + i) * 4; py = y + R * 0.7 - ph * R * 1.4; c.strokeStyle = A(L.c2, a); c.lineWidth = 1.2; c.beginPath(); c.moveTo(px, py); c.lineTo(px + Math.sin(i) * 3, py + 6 + h4 * 6); c.stroke(); break;
				case 'ash': px = x + hx + Math.sin(t * 0.5 + i) * 20 + ph * 30; py = y - R * 0.9 + ph * R * 1.8; c.fillStyle = A(mix('#8a8682', L.c1, 0.15), 0.7 * a); c.fillRect(px, py, 2 + h4 * 2, 1.5 + h4); break;
				case 'smoke': { px = x + hx * 0.9 + Math.sin(t * 0.3 + i) * 30; py = y + R * 0.6 - ph * R * 1.2; const r = R * (0.08 + 0.12 * h4) * (0.6 + ph); const gr = c.createRadialGradient(px, py, 0, px, py, r); gr.addColorStop(0, A(L.bright ? '#ffffff' : mix(L.bg, L.c1, 0.25), 0.28 * a)); gr.addColorStop(1, A(L.bg, 0)); c.fillStyle = gr; c.fillRect(px - r, py - r, r * 2, r * 2); break; }
				case 'snow': px = x + hx + Math.sin(t * 0.9 + i * 2) * 14; py = y - R * 0.9 + ph * R * 1.8; c.fillStyle = A(L.bright ? '#ffffff' : L.c2, 0.85 * a); c.beginPath(); c.arc(px, py, 1.2 + h4 * 1.6, 0, TAU); c.fill(); break;
				case 'rain': px = x + hx + ph * 40; py = y - R + fract(ph * 3 + h1) * R * 2; c.strokeStyle = A(mix(L.c2, '#aab4c8', 0.4), 0.45 * k); c.lineWidth = 1; c.beginPath(); c.moveTo(px, py); c.lineTo(px + 4, py + 16); c.stroke(); break;
				case 'petals': case 'leaves': case 'feathers': {
					px = x + hx * 0.8 + Math.sin(t * 0.7 * sp + i * 1.3) * 40 + ph * 60; py = y - R * 0.9 + ph * R * 1.8;
					c.save(); c.translate(px, py); c.rotate(t * 1.3 + i + Math.sin(t + i) * 0.6);
					if(kind === 'petals'){ c.fillStyle = A(L.bright ? mix(L.c1, '#ffffff', 0.15) : L.c1, 0.85 * a); c.beginPath(); c.ellipse(0, 0, 6, 2.8, 0, 0, TAU); c.fill(); }
					else if(kind === 'leaves'){ c.fillStyle = A(i % 2 ? L.c3 : mix(L.c1, '#3a6a2a', 0.4), 0.85 * a); c.beginPath(); c.moveTo(-7, 0); c.quadraticCurveTo(0, -4, 7, 0); c.quadraticCurveTo(0, 4, -7, 0); c.fill(); }
					else { c.strokeStyle = A(L.bright ? '#ffffff' : L.c2, 0.85 * a); c.fillStyle = A(L.bright ? '#ffffff' : L.c2, 0.4 * a); c.lineWidth = 1; c.beginPath(); c.moveTo(-9, 0); c.quadraticCurveTo(0, -5, 9, 0); c.quadraticCurveTo(0, 2, -9, 0); c.fill(); c.beginPath(); c.moveTo(-10, 0); c.lineTo(9, 0); c.stroke(); }
					c.restore(); break;
				}
				case 'butterflies': { px = x + hx + Math.sin(t * 0.6 * sp + i) * 50; py = y + Math.cos(t * 0.5 * sp + i * 1.7) * R * 0.55; const f = Math.abs(Math.sin(t * 9 + i)); c.fillStyle = A(col(i), 0.85 * k); c.beginPath(); c.ellipse(px - 3 * f, py, 4 * f + 0.5, 3, -0.3, 0, TAU); c.ellipse(px + 3 * f, py, 4 * f + 0.5, 3, 0.3, 0, TAU); c.fill(); break; }
				case 'fireflies': { px = x + hx + Math.sin(t * 0.4 * sp + i * 3) * 30; py = y + Math.cos(t * 0.35 * sp + i * 2) * R * 0.6; const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i)); c.fillStyle = A(L.c2, 0.25 * k * tw); c.beginPath(); c.arc(px, py, 6, 0, TAU); c.fill(); c.fillStyle = A(L.c2, 0.95 * k * tw); c.beginPath(); c.arc(px, py, 1.6, 0, TAU); c.fill(); break; }
				case 'bubbles': px = x + hx + Math.sin(t * 1.5 + i) * 8; py = y + R * 0.8 - ph * R * 1.7; c.strokeStyle = A(L.c2, 0.7 * a); c.lineWidth = 1; c.beginPath(); c.arc(px, py, 2 + h4 * 5, 0, TAU); c.stroke(); break;
				case 'stars': { const aa = h1 * TAU, rr = Math.sqrt(h2) * R * 0.92; px = x + Math.cos(aa) * rr; py = y + Math.sin(aa) * rr; const tw = 0.3 + 0.7 * Math.abs(Math.sin(t * 1.5 + i)); c.fillStyle = A(L.c2, 0.9 * k * tw); c.beginPath(); c.arc(px, py, 0.8 + h4 * 1.4, 0, TAU); c.fill(); if(h4 > 0.8){ c.fillRect(px - 4 * tw, py - 0.5, 8 * tw, 1); c.fillRect(px - 0.5, py - 4 * tw, 1, 8 * tw); } break; }
				case 'glyphs': px = x + hx; py = y + R * 0.8 - ph * R * 1.5; c.strokeStyle = A(L.c2, 0.75 * a); c.lineWidth = 1.2; c.beginPath(); glyph(c, px, py, t * 0.5 + i, 4, i % 4); c.stroke(); break;
				case 'shards': { px = x + hx + Math.sin(t + i) * 10; py = y - R * 0.9 + ph * R * 1.8; c.save(); c.translate(px, py); c.rotate(t * 2 + i); c.fillStyle = A(L.c2, 0.6 * a); c.strokeStyle = A(L.c1, 0.8 * a); c.beginPath(); c.moveTo(0, -5 - h4 * 4); c.lineTo(3, 2); c.lineTo(-2, 4); c.closePath(); c.fill(); c.stroke(); c.restore(); break; }
				case 'ink': { px = x + hx * 0.9 + Math.sin(t * 0.5 + i) * 30; py = y + Math.cos(t * 0.4 + i * 1.7) * R * 0.6; c.fillStyle = A(L.bright || L.ink ? L.c1 : L.bg, (L.ink ? 0.12 : 0.4) * k); c.beginPath(); c.arc(px, py, 6 + h4 * 18, 0, TAU); c.fill(); break; }
			}
		}
		c.restore();
	}

	/* ============================================================ THE EDGE (live) */
	function drawEdge(c, g, R, L, t, a, closed, flare){
		const x = g.x, y = g.y, glowK = L.glow, rw = L.rim * (closed ? 1 : 0.6), add = L.bright ? 'source-over' : 'lighter', tt = t * L.spin;
		if(R < 30){ c.save(); c.globalCompositeOperation = add; c.strokeStyle = A(L.c1, 0.85 * a); c.lineWidth = Math.max(1, rw); c.beginPath(); c.arc(x, y, Math.max(1, R), 0, TAU); c.stroke(); c.restore(); return; }      // just born: a thin ring
		c.save(); c.globalCompositeOperation = add;
		const soft = () => { c.strokeStyle = A(L.c1, (0.16 + 0.2 * flare) * a * glowK); c.lineWidth = 8 + 14 * glowK + 20 * flare; edgePath(c, g, Math.max(1, R - 4), L); c.stroke(); };
		switch(L.barrier){
			case 'orb': case 'dome': {
				soft();
				c.strokeStyle = A(L.c1, (closed ? 0.85 : 0.45) * a); c.lineWidth = rw; if(!closed) c.setLineDash([10, 12]); edgePath(c, g, R, L); c.stroke(); c.setLineDash([]);
				c.strokeStyle = A(L.c2, 0.45 * a); c.lineWidth = rw * 1.4; c.beginPath(); c.arc(x, y, R * 0.94, -2.55, -1.75); c.stroke();
				c.strokeStyle = A(L.c2, 0.25 * a); c.lineWidth = rw * 0.8; c.beginPath(); c.arc(x, y, R * 0.94, -1.6, -1.35); c.stroke();
				if(L.barrier === 'dome' && g.gy + R * 0.05 < y + R * 0.97){ const yb = g.gy + R * 0.05, hw = Math.sqrt(Math.max(0, R * R - (yb - y) * (yb - y))); const gr = c.createLinearGradient(x - hw, 0, x + hw, 0); gr.addColorStop(0, A(L.c1, 0)); gr.addColorStop(0.5, A(L.c2, 0.6 * a)); gr.addColorStop(1, A(L.c1, 0)); c.fillStyle = gr; c.fillRect(x - hw, yb - 2, hw * 2, 4); }
				break;
			}
			case 'ring': {
				c.strokeStyle = A(L.c1, 0.9 * a); c.lineWidth = Math.max(1, rw * 0.6); c.beginPath(); c.arc(x, y, R, 0, TAU); c.stroke(); c.beginPath(); c.arc(x, y, R - 7, 0, TAU); c.stroke();
				c.beginPath(); for(let i = 0; i < 72; i++){ const an = i / 72 * TAU + tt * 0.1, l = i % 6 ? 3 : 7; c.moveTo(x + Math.cos(an) * (R - 7), y + Math.sin(an) * (R - 7)); c.lineTo(x + Math.cos(an) * (R - 7 - l), y + Math.sin(an) * (R - 7 - l)); } c.stroke();
				soft(); break;
			}
			case 'runes': {
				soft();
				c.strokeStyle = A(L.c1, 0.9 * a); c.lineWidth = rw * 0.6; c.beginPath(); c.arc(x, y, R, 0, TAU); c.stroke(); c.beginPath(); c.arc(x, y, R - 18, 0, TAU); c.stroke();
				runeBand(c, x, y, R - 9, L, tt, a); break;
			}
			case 'thorns': {
				const vine = mix(L.c1, L.bg, 0.35);
				c.globalCompositeOperation = 'source-over'; c.strokeStyle = A(vine, 0.95 * a); c.lineWidth = rw;
				for(let s = 0; s < 2; s++){ c.beginPath(); for(let i = 0; i <= 120; i++){ const an = i / 120 * TAU, r = R - 4 + Math.sin(an * 14 + s * PI + tt * 0.3) * 4; if(i) c.lineTo(x + Math.cos(an) * r, y + Math.sin(an) * r); else c.moveTo(x + Math.cos(an) * r, y + Math.sin(an) * r); } c.stroke(); }
				c.fillStyle = A(vine, a); c.beginPath();
				const n = Math.round(R / 7);
				for(let i = 0; i < n; i++){ const an = i / n * TAU + hash(i, 4) * 0.05, out = i % 2 ? 1 : -1, l = 6 + hash(i, 8) * 9, w = 0.012; const bx = x + Math.cos(an) * (R - 4), by = y + Math.sin(an) * (R - 4); c.moveTo(x + Math.cos(an - w) * (R - 4), y + Math.sin(an - w) * (R - 4)); c.lineTo(bx + Math.cos(an + out * 0.5) * l * out, by + Math.sin(an + out * 0.5) * l * out); c.lineTo(x + Math.cos(an + w) * (R - 4), y + Math.sin(an + w) * (R - 4)); }
				c.fill(); c.globalCompositeOperation = add; soft(); break;
			}
			case 'cage': {
				soft();
				for(let i = 0; i < 6; i++){ const ph = (i / 6) * PI + tt * 0.25, cw = Math.cos(ph); c.strokeStyle = A(L.c1, (0.25 + 0.5 * Math.abs(Math.sin(ph))) * a); c.lineWidth = 1.3; c.beginPath(); c.ellipse(x, y, Math.abs(cw) * R + 0.5, R, 0, 0, TAU); c.stroke(); }
				for(const f of [-0.6, -0.25, 0.25, 0.6]){ const yy = y + f * R, hw = Math.sqrt(1 - f * f) * R; c.strokeStyle = A(L.c2, 0.4 * a); c.beginPath(); c.ellipse(x, yy, hw, hw * 0.12, 0, 0, TAU); c.stroke(); }
				c.strokeStyle = A(L.c1, 0.9 * a); c.lineWidth = rw * 0.7; c.beginPath(); c.arc(x, y, R, 0, TAU); c.stroke(); break;
			}
			case 'flames': {
				const n = Math.round(R / 9);
				c.strokeStyle = A(L.c1, 0.8 * a); c.lineWidth = rw; c.beginPath(); c.arc(x, y, R, 0, TAU); c.stroke();
				for(let i = 0; i < n; i++){
					const an = i / n * TAU, fl = 0.5 + 0.5 * Math.sin(t * 7 + i * 2.3) * Math.sin(t * 3.1 + i), h = (10 + 18 * fl) * (0.6 + 0.4 * glowK), w = TAU / n * 0.7;
					const bx = x + Math.cos(an) * R, by = y + Math.sin(an) * R, tx = x + Math.cos(an + Math.sin(t * 4 + i) * 0.02) * (R + h), ty = y + Math.sin(an) * (R + h) - h * 0.4;
					const gr = c.createLinearGradient(bx, by, tx, ty); gr.addColorStop(0, A(L.c1, 0.75 * a)); gr.addColorStop(1, A(L.c2, 0));
					c.fillStyle = gr; c.beginPath(); c.moveTo(x + Math.cos(an - w) * R, y + Math.sin(an - w) * R); c.quadraticCurveTo(bx + (tx - bx) * 0.5 + Math.cos(an + PI / 2) * 4, by + (ty - by) * 0.5, tx, ty); c.quadraticCurveTo(bx + (tx - bx) * 0.5 - Math.cos(an + PI / 2) * 4, by + (ty - by) * 0.5, x + Math.cos(an + w) * R, y + Math.sin(an + w) * R); c.fill();
				}
				soft(); break;
			}
			case 'ribbons': {
				soft();
				for(let b = 0; b < 3; b++){ c.strokeStyle = A(b === 0 ? L.c1 : b === 1 ? L.c3 : L.c2, 0.5 * a); c.lineWidth = rw * (1.4 - b * 0.3); c.beginPath(); for(let i = 0; i <= 100; i++){ const an = i / 100 * TAU, r = R - 3 + Math.sin(an * (3 + b) + tt * (0.8 + b * 0.4) * (b % 2 ? -1 : 1)) * (5 + b * 2); if(i) c.lineTo(x + Math.cos(an) * r, y + Math.sin(an) * r); else c.moveTo(x + Math.cos(an) * r, y + Math.sin(an) * r); } c.stroke(); }
				break;
			}
			case 'mirror': {
				const n = 28;
				for(let i = 0; i < n; i++){
					const a0 = i / n * TAU, a1 = (i + 1) / n * TAU, sweep = Math.max(0, Math.cos(a0 - tt * 0.6));
					c.fillStyle = A(i % 2 ? L.c2 : L.c1, (0.12 + 0.35 * Math.pow(sweep, 6)) * a);
					c.beginPath(); c.moveTo(x + Math.cos(a0) * R, y + Math.sin(a0) * R); c.lineTo(x + Math.cos(a1) * R, y + Math.sin(a1) * R); c.lineTo(x + Math.cos((a0 + a1) / 2) * (R - 16), y + Math.sin((a0 + a1) / 2) * (R - 16)); c.closePath(); c.fill();
				}
				c.strokeStyle = A(L.c2, 0.9 * a); c.lineWidth = rw * 0.6; c.beginPath(); for(let i = 0; i <= n; i++){ const an = i / n * TAU; if(i) c.lineTo(x + Math.cos(an) * R, y + Math.sin(an) * R); else c.moveTo(x + Math.cos(an) * R, y + Math.sin(an) * R); } c.stroke();
				soft(); break;
			}
			case 'lattice': {
				c.save(); edgePath(c, g, R, L); c.clip();
				const s = Math.max(14, R / 8); c.beginPath();
				for(let gx = -10; gx <= 10; gx++) for(let gy2 = -10; gy2 <= 10; gy2++){ const cx = x + gx * s * 1.5, cy = y + gy2 * s * 1.732 + (gx % 2 ? s * 0.866 : 0); const d = Math.hypot(cx - x, cy - y); if(d < R * 0.62 || d > R + s) continue; for(let i = 0; i <= 6; i++){ const an = i / 6 * TAU, px = cx + Math.cos(an) * s * 0.9, py = cy + Math.sin(an) * s * 0.9; if(i) c.lineTo(px, py); else c.moveTo(px, py); } }
				c.strokeStyle = A(L.c1, 0.35 * a * (0.7 + 0.3 * Math.sin(t * 2))); c.lineWidth = 1.2; c.stroke(); c.restore();
				c.strokeStyle = A(L.c1, 0.9 * a); c.lineWidth = rw * 0.7; c.beginPath(); c.arc(x, y, R, 0, TAU); c.stroke(); soft(); break;
			}
			case 'none': default: {
				const gr = c.createRadialGradient(x, y, R * 0.8, x, y, R); gr.addColorStop(0, A(L.c1, 0)); gr.addColorStop(1, A(L.c1, 0.25 * a * glowK)); c.fillStyle = gr; c.beginPath(); c.arc(x, y, R, 0, TAU); c.fill();
				break;
			}
		}
		if(L.rimRunes && L.barrier !== 'runes') runeBand(c, x, y, R + 12, L, tt, a * 0.8);
		c.restore();
	}
	function runeBand(c, x, y, r, L, tt, a){
		const n = Math.max(24, Math.round(r / 9));
		c.strokeStyle = A(L.c2, 0.8 * a); c.lineWidth = 1.2; c.beginPath();
		for(let i = 0; i < n; i++){ const an = i / n * TAU + tt * 0.12; glyph(c, x + Math.cos(an) * r, y + Math.sin(an) * r, an + PI / 2, 4, i % 4); }
		c.stroke();
	}

	/* ============================================================ BURSTS (the expansion) */
	function drawBurst(c, x, y, R, L, k, t, seed){
		const a = 1 - k;
		c.save(); c.globalCompositeOperation = 'lighter';
		switch(L.burst){
			case 'shockwave': {
				for(let i = 0; i < 3; i++){ const kk = clamp(k * 1.25 - i * 0.12, 0, 1); if(kk <= 0) continue; const rr = R * (0.55 + 0.45 * easeOut4(kk)) * (i ? 0.92 : 1); c.strokeStyle = A(i ? L.c1 : L.c2, 0.7 * (1 - kk) + 0.1); c.lineWidth = 14 - i * 4; c.beginPath(); c.arc(x, y, rr, 0, TAU); c.stroke(); }
				c.strokeStyle = A(L.c2, 0.4 * a); c.lineWidth = 1.5; c.beginPath();
				for(let i = 0; i < 36; i++){ const an = i / 36 * TAU + seed, r0 = R * (0.7 + 0.2 * hash(i, seed)); c.moveTo(x + Math.cos(an) * r0, y + Math.sin(an) * r0); c.lineTo(x + Math.cos(an) * R * 1.05, y + Math.sin(an) * R * 1.05); }
				c.stroke(); break;
			}
			case 'bloom': {
				glow(c, x, y, R * 1.05, L.c2, 0.75 * a);
				c.fillStyle = A(L.c2, 0.5 * a);
				for(let i = 0; i < 12; i++){ const an = i / 12 * TAU + k * 1.2; c.save(); c.translate(x + Math.cos(an) * R * 0.5 * easeOut4(k), y + Math.sin(an) * R * 0.5 * easeOut4(k)); c.rotate(an); c.beginPath(); c.ellipse(0, 0, R * 0.2 * easeOut(k) + 1, R * 0.06 * easeOut(k) + 1, 0, 0, TAU); c.fill(); c.restore(); }
				break;
			}
			case 'shards': case 'glass': {
				const glass = L.burst === 'glass';
				c.fillStyle = A(glass ? '#ffffff' : L.c2, 0.6 * a); c.strokeStyle = A(L.c1, 0.75 * a); c.lineWidth = 1.3;
				for(let i = 0; i < 28; i++){ const an = i / 28 * TAU + hash(i, seed) * 0.2, len = R * (0.2 + 0.35 * hash(i + 4, seed)), r1 = R * (0.85 + (glass ? 0.4 : 0.15) * easeOut4(k)), r0 = r1 - len * (0.5 + 0.5 * k), w = 0.05 + 0.04 * hash(i, 2);
					c.beginPath(); c.moveTo(x + Math.cos(an - w) * r0, y + Math.sin(an - w) * r0); c.lineTo(x + Math.cos(an) * r1, y + Math.sin(an) * r1); c.lineTo(x + Math.cos(an + w) * r0, y + Math.sin(an + w) * r0); c.closePath(); c.fill(); c.stroke(); }
				if(glass){ c.strokeStyle = A('#ffffff', 0.6 * a); c.beginPath(); for(let i = 0; i < 10; i++){ let an = hash(i, seed + 2) * TAU, r = 0; c.moveTo(x, y); for(let s = 0; s < 5; s++){ an += (hash(i * 5 + s, seed) - 0.5) * 0.4; r += R * 0.2; c.lineTo(x + Math.cos(an) * r, y + Math.sin(an) * r); } } c.stroke(); }
				break;
			}
			case 'ink': {
				c.globalCompositeOperation = 'source-over';
				c.fillStyle = A(L.ink ? L.c1 : L.bg, 0.55 * (0.4 + 0.6 * a)); c.beginPath();
				for(let i = 0; i <= 72; i++){ const an = i / 72 * TAU, wob = 1 + (0.07 * Math.sin(an * 7 + t * 5) + 0.05 * Math.sin(an * 13 - t * 7)) * (1 - k); const r = R * wob; if(i) c.lineTo(x + Math.cos(an) * r, y + Math.sin(an) * r); else c.moveTo(x + Math.cos(an) * r, y + Math.sin(an) * r); }
				c.fill();
				for(let i = 0; i < 14; i++){ const an = hash(i, seed) * TAU, r = R * (1 + 0.2 * hash(i + 3, seed) * easeOut(k)); c.beginPath(); c.arc(x + Math.cos(an) * r, y + Math.sin(an) * r, 3 + 8 * hash(i, 5) * a, 0, TAU); c.fill(); }
				break;
			}
			case 'petalstorm': case 'feathers': {
				const fe = L.burst === 'feathers';
				glow(c, x, y, R, L.c2, 0.4 * a);
				for(let i = 0; i < 46; i++){
					const an = hash(i, seed) * TAU, r = R * (0.2 + 1.0 * easeOut(k) * (0.5 + 0.6 * hash(i + 2, seed)));
					c.save(); c.translate(x + Math.cos(an) * r, y + Math.sin(an) * r); c.rotate(an + k * 6 * (hash(i, 9) - 0.5));
					c.fillStyle = A(fe ? '#ffffff' : (i % 2 ? L.c1 : L.c2), 0.85 * a);
					c.beginPath(); if(fe){ c.moveTo(-12, 0); c.quadraticCurveTo(0, -6, 12, 0); c.quadraticCurveTo(0, 2, -12, 0); } else c.ellipse(0, 0, 8, 3.5, 0, 0, TAU);
					c.fill(); c.restore();
				}
				break;
			}
			case 'collapse': {
				c.globalCompositeOperation = 'source-over';
				c.strokeStyle = A('#000000', 0.8 * a); c.lineWidth = 20 * a + 2; c.beginPath(); c.arc(x, y, R, 0, TAU); c.stroke();
				c.globalCompositeOperation = 'lighter'; c.strokeStyle = A(L.c1, 0.8 * a); c.lineWidth = 3; c.beginPath(); c.arc(x, y, R + 10 * a, 0, TAU); c.stroke();
				c.strokeStyle = A(L.c2, 0.5 * a); c.lineWidth = 1.5; c.beginPath();
				for(let i = 0; i < 40; i++){ const an = i / 40 * TAU + seed, r0 = R * (1.1 + 0.4 * hash(i, seed)), r1 = r0 - R * 0.35 * a; c.moveTo(x + Math.cos(an) * r0, y + Math.sin(an) * r0); c.lineTo(x + Math.cos(an) * r1, y + Math.sin(an) * r1); }
				c.stroke(); break;
			}
			case 'lightning': {
				c.strokeStyle = A(L.c2, 0.95 * a); c.lineWidth = 2.5; c.shadowColor = L.c1; c.shadowBlur = 14;
				for(let b = 0; b < 8; b++){ let an = b / 8 * TAU + hash(b, seed), px = x, py = y; c.beginPath(); c.moveTo(px, py); for(let s = 1; s <= 8; s++){ an += (hash(b * 9 + s + Math.floor(k * 6), seed) - 0.5) * 0.7; const r = R * s / 8; px = x + Math.cos(an) * r; py = y + Math.sin(an) * r; c.lineTo(px, py); } c.stroke(); }
				c.shadowBlur = 0; glow(c, x, y, R * 0.5, '#ffffff', 0.6 * a); break;
			}
			case 'ripple': {
				for(let i = 0; i < 8; i++){ const kk = clamp(k * 1.4 - i * 0.06, 0, 1); if(kk <= 0) continue; c.strokeStyle = A(i % 2 ? L.c1 : L.c2, 0.6 * (1 - kk)); c.lineWidth = 2; c.beginPath(); c.arc(x, y, R * easeOut(kk) * (1 - i * 0.05), 0, TAU); c.stroke(); }
				break;
			}
			case 'eclipse': {
				c.globalCompositeOperation = 'source-over'; c.fillStyle = A('#000000', 0.7 * a); c.beginPath(); c.arc(x, y, R * 0.9, 0, TAU); c.fill();
				c.globalCompositeOperation = 'lighter'; c.strokeStyle = A(L.c1, 0.9 * a); c.lineWidth = 6; c.beginPath(); c.arc(x, y, R * 0.9, 0, TAU); c.stroke();
				glow(c, x, y, R * 1.2, L.c1, 0.35 * a); break;
			}
			case 'flames': {
				glow(c, x, y, R, L.c1, 0.6 * a);
				for(let i = 0; i < 40; i++){ const an = i / 40 * TAU, l = R * (0.15 + 0.25 * hash(i + Math.floor(t * 20), seed)) * a, bx = x + Math.cos(an) * R * 0.95, by = y + Math.sin(an) * R * 0.95; const gr = c.createLinearGradient(bx, by, bx + Math.cos(an) * l, by + Math.sin(an) * l - l * 0.3); gr.addColorStop(0, A(L.c1, 0.8 * a)); gr.addColorStop(1, A(L.c2, 0)); c.strokeStyle = gr; c.lineWidth = 7; c.beginPath(); c.moveTo(bx, by); c.lineTo(bx + Math.cos(an) * l, by + Math.sin(an) * l - l * 0.3); c.stroke(); }
				break;
			}
		}
		c.restore();
	}

	/* ============================================================ the gathering sigil (before it opens) */
	function drawGather(c, x, y, D, L, t, k, held, cineP){
		const Rg = D.r * (0.12 + 0.4 * easeOut(k)) * (held ? 1.04 + 0.02 * Math.sin(t * 40) : 1);
		c.save(); c.globalCompositeOperation = L.bright ? 'source-over' : 'lighter';
		glow(c, x, y, Rg * 1.3, L.c2, 0.5 * k + (held ? 0.3 : 0));
		c.globalAlpha = clamp(k * 1.4, 0, 1);
		c.strokeStyle = A(L.c1, 0.9); c.lineWidth = 2.2; c.beginPath(); c.arc(x, y, Rg, 0, TAU); c.stroke();
		const L2 = L.sigil === 'none' ? Object.assign({}, L, { sigil: 'rings' }) : L;
		drawPattern(c, x, y, Rg, L2, t * (held ? 0.1 : 1), D.seed, 1);
		for(let i = 0; i < 18; i++){
			const ph = fract(k * 2.2 + hash(i, D.seed)), an = hash(i + 1, D.seed) * TAU + ph * 2.2, rr = Rg * (2.4 - 2.2 * ph);
			c.fillStyle = A(i % 2 ? L.c2 : L.c1, (1 - ph) * 0.9 * clamp(k * 2, 0, 1)); c.beginPath(); c.arc(x + Math.cos(an) * rr, y + Math.sin(an) * rr, 1.5 + (1 - ph) * 2, 0, TAU); c.fill();
		}
		if(held){
			const p = cineP || 0;
			c.strokeStyle = A(L.c2, 0.55); c.lineWidth = 1.6; c.beginPath();
			for(let i = 0; i < 16; i++){ const an = i / 16 * TAU + D.seed, r0 = Rg * 1.05, r1 = Rg * (1.1 + 1.4 * p * (0.6 + 0.4 * hash(i, D.seed))); c.moveTo(x + Math.cos(an) * r0, y + Math.sin(an) * r0); c.lineTo(x + Math.cos(an + 0.02 * i) * r1, y + Math.sin(an + 0.02 * i) * r1); }
			c.stroke();
		}
		c.restore();
	}

	/* ============================================================ composite painters (no world needed) */
	function makeCanvas(w, h){
		try {
			if(typeof document !== 'undefined' && document.createElement){ const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv; }
			if(typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
		} catch(e){}
		return null;
	}
	function paintStatic(c, g, R, L, seed){
		if(L.floor === 'none'){
			// no floor of its own: the sky and landmark stop at the real ground
			c.save(); c.beginPath(); c.rect(g.x - R, g.y - R, R * 2, Math.max(1, g.gy - (g.y - R))); c.clip();
			paintSky(c, g, R, L, seed); paintLandmark(c, g, R, L, seed, 1); c.restore(); return;
		}
		paintSky(c, g, R, L, seed);
		paintLandmark(c, g, R, L, seed, 1);
		paintFloor(c, g, R, L, seed);
	}
	function staticLayer(D, L, R, rel){
		const key = L._key + '|' + Math.round(R) + '|' + Math.round(rel);
		if(D._art && D._art.key === key) return D._art;
		if(D._art && D._art.none) return null;
		const s = Math.min(1, 1200 / (2 * R)), size = Math.ceil(2 * R * s) + 2;
		const cv = makeCanvas(size, size);
		if(!cv){ D._art = { key, none: true }; return null; }
		const c = cv.getContext('2d'); c.scale(s, s);
		const g = { x: R, y: R, gy: R + rel, hy: Math.max(R + rel - R * L.horizon, R * 0.1) };
		c.save(); edgePath(c, g, R, L); c.clip(); paintStatic(c, g, R, L, D.seed || 0); c.restore();
		D._art = { key, cv, s };
		return D._art;
	}
	/* the world behind creatures; R0 full radius, Rn the radius reached so far */
	function paintBackdrop(c, D, L, camX, camY, t, alpha, lookAt){
		const R0 = D.r, Rn = Math.max(2, D.rNow != null ? D.rNow : D.r);
		const g = geo(D, L, camX, camY, R0);
		const seed = D.seed || 0;
		c.save(); c.globalAlpha *= alpha * L.immersion;
		edgePath(c, g, Rn, L); c.clip();
		const art = staticLayer(D, L, R0, g.gy - g.y);
		if(art && art.cv){ c.drawImage(art.cv, g.x - R0, g.y - R0, art.cv.width / art.s, art.cv.height / art.s); }
		else paintStatic(c, g, R0, L, seed);
		landmarkLive(c, g, R0, L, t, seed, 1, lookAt);
		floorLive(c, g, R0, L, t, 1);
		drawSigil(c, g, R0, L, t, seed, 1);
		// light rays from the landmark or from above
		if(L.rays > 0){
			c.save(); c.globalCompositeOperation = L.bright ? 'source-over' : 'lighter';
			const ox = g.x, oy = L.landmark === 'none' ? g.y - R0 * 1.05 : g.hy - lmSize(g, R0, L) * 1.2;
			for(let i = 0; i < 9; i++){
				const an = PI / 2 + (i - 4) * 0.22 + Math.sin(t * 0.3 + i) * 0.03, wd = 0.04 + 0.03 * hash(i, seed), len = R0 * 2;
				const gr = c.createLinearGradient(ox, oy, ox + Math.cos(an) * len, oy + Math.sin(an) * len); gr.addColorStop(0, A(L.bright ? '#ffffff' : L.c2, 0.16 * L.rays)); gr.addColorStop(1, A(L.c2, 0));
				c.fillStyle = gr; c.beginPath(); c.moveTo(ox, oy); c.lineTo(ox + Math.cos(an - wd) * len, oy + Math.sin(an - wd) * len); c.lineTo(ox + Math.cos(an + wd) * len, oy + Math.sin(an + wd) * len); c.fill();
			}
			c.restore();
		}
		// ambience and vignette
		const pulse = 1 + L.pulse * 0.25 * Math.sin(t * 2.2);
		if(L.ambient === 'dark'){ c.fillStyle = 'rgba(0,0,0,' + (0.3 / pulse) + ')'; c.fillRect(g.x - Rn, g.y - Rn, Rn * 2, Rn * 2); }
		else if(L.ambient === 'dim'){ c.fillStyle = 'rgba(0,0,0,' + (0.14 / pulse) + ')'; c.fillRect(g.x - Rn, g.y - Rn, Rn * 2, Rn * 2); }
		else if(L.ambient === 'bright'){ c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(255,255,255,' + (0.06 * pulse) + ')'; c.fillRect(g.x - Rn, g.y - Rn, Rn * 2, Rn * 2); c.restore(); }
		if(L.vignette > 0){ const vg = c.createRadialGradient(g.x, g.y, Rn * 0.45, g.x, g.y, Rn); vg.addColorStop(0, A(L.bg, 0)); vg.addColorStop(1, A(L.bright ? mix(L.bg, L.c1, 0.3) : sh(L.bg, -0.5), 0.75 * L.vignette)); c.fillStyle = vg; c.fillRect(g.x - Rn, g.y - Rn, Rn * 2, Rn * 2); }
		c.restore();
		return g;
	}
	/* over creatures: grade, particles, the edge, the burst */
	function paintForeground(c, D, L, camX, camY, t, opts){
		opts = opts || {};
		const R0 = D.r, R = Math.max(2, D.rNow != null ? D.rNow : D.r), g = geo(D, L, camX, camY, R0), gR = Object.assign({}, g);
		const open = opts.open != null ? opts.open : 1, closed = D.form !== 'open', seed = D.seed || 0;
		c.save();
		if(!opts.skipAmbient) paintAmbient(c, D, L, camX, camY, t, opts);
		drawEdge(c, gR, R, L, t, 1, closed, opts.flare || 0);
		if(opts.burstK != null) drawBurst(c, g.x, g.y, R, L, opts.burstK, t, seed);
		c.restore();
		return g;
	}
	/* the colour grade and drifting particles inside the domain — the host paints these BEHIND creatures so foes stand over the domain */
	function paintAmbient(c, D, L, camX, camY, t, opts){
		opts = opts || {};
		const R0 = D.r, R = Math.max(2, D.rNow != null ? D.rNow : D.r), g = geo(D, L, camX, camY, R0), gR = Object.assign({}, g);
		const open = opts.open != null ? opts.open : 1, seed = D.seed || 0;
		c.save();
		c.save(); edgePath(c, gR, R, L); c.clip();
		if(L.ambient === 'dark' || L.ambient === 'dim'){ c.fillStyle = A(L.bg, (L.ambient === 'dark' ? 0.16 : 0.08) * L.immersion * open); c.fillRect(g.x - R, g.y - R, R * 2, R * 2); }
		c.globalCompositeOperation = 'soft-light'; c.fillStyle = A(L.c1, 0.22 * L.immersion * open); c.fillRect(g.x - R, g.y - R, R * 2, R * 2);
		c.globalCompositeOperation = 'source-over';
		drawParticles(c, gR, R, L, L.p1, L.p1n, t, seed, open);
		drawParticles(c, gR, R, L, L.p2, L.p2n, t, seed + 50, open * 0.9);
		c.restore();
		c.restore();
	}
	/* the veil: a sealed domain from outside */
	function paintVeil(c, D, L, camX, camY, t, life){
		const R = D.rNow, x = D.x - camX, y = D.y - camY, a = (L.outside === 'misty' ? 0.8 : 1) * life, tt = t * L.spin;
		c.save(); c.globalAlpha = a;
		const sphere = (stops, ox, oy) => { const gr = c.createRadialGradient(x - R * (ox || 0.25), y - R * (oy || 0.3), R * 0.05, x, y, R); for(const s of stops) gr.addColorStop(s[0], s[1]); c.fillStyle = gr; c.beginPath(); c.arc(x, y, R, 0, TAU); c.fill(); };
		switch(L.veil){
			case 'black': sphere([[0, '#0b0b10'], [0.85, '#000000'], [1, '#000000']]); break;
			case 'mirror': sphere([[0, '#ffffff'], [0.3, mix('#c8ccd8', L.c2, 0.3)], [0.7, mix('#4a4e5a', L.c1, 0.2)], [1, '#14161c']], 0.3, 0.35); break;
			case 'storm': sphere([[0, mix('#3a4152', L.c1, 0.25)], [1, '#06070a']]); break;
			case 'cocoon': sphere([[0, mix(L.c2, L.c1, 0.3)], [1, mix(L.bg, L.c1, 0.35)]]); break;
			case 'lattice': sphere([[0, mix(L.bg, L.c1, 0.3)], [1, sh(L.bg, -0.6)]]); break;
			default: if(L.bright) sphere([[0, '#ffffff'], [0.7, mix(L.bg, L.c1, 0.2)], [1, mix(L.bg, L.c1, 0.55)]]); else sphere([[0, mix(L.bg, L.c1, 0.28)], [0.6, mix(L.bg, '#000000', 0.25)], [1, mix(L.bg, '#000000', 0.7)]]);
		}
		c.save(); c.beginPath(); c.arc(x, y, R, 0, TAU); c.clip();
		c.globalCompositeOperation = L.bright && L.veil === 'shell' ? 'source-over' : 'lighter';
		switch(L.veil){
			case 'black': { for(let i = 0; i < 3; i++){ const r = R * fract(t * 0.15 + i / 3); c.strokeStyle = A(L.c1, 0.12 * (1 - r / R)); c.lineWidth = 2; c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke(); } break; }
			case 'mirror': { c.globalCompositeOperation = 'source-over'; const sx = fract(tt * 0.1); const gr = c.createLinearGradient(x - R, y - R, x + R, y + R); gr.addColorStop(clamp(sx - 0.1, 0, 1), 'rgba(255,255,255,0)'); gr.addColorStop(sx, 'rgba(255,255,255,.55)'); gr.addColorStop(clamp(sx + 0.1, 0, 1), 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(x - R, y - R, R * 2, R * 2); c.strokeStyle = A(L.c1, 0.25); c.beginPath(); c.ellipse(x, y + R * 0.2, R * 0.95, R * 0.25, 0, 0, TAU); c.stroke(); break; }
			case 'storm': { for(let b = 0; b < 8; b++){ c.strokeStyle = A(b % 2 ? L.c1 : '#8a92a8', 0.16); c.lineWidth = R * 0.035; c.beginPath(); c.ellipse(x, y, R * (0.95 - b * 0.09), R * (0.32 - b * 0.025), Math.sin(tt * 0.3 + b) * 0.3 + tt * 0.2 * (b % 2 ? 1 : -1), 0, TAU); c.stroke(); } if(fract(t * 0.4) < 0.05){ c.strokeStyle = A(L.c2, 0.9); c.lineWidth = 2; c.beginPath(); let px = x - R * 0.3, py = y - R * 0.6; c.moveTo(px, py); for(let s = 0; s < 6; s++){ px += (hash(s + Math.floor(t), 3) - 0.3) * R * 0.2; py += R * 0.2; c.lineTo(px, py); } c.stroke(); } break; }
			case 'cocoon': { c.globalCompositeOperation = 'source-over'; c.lineWidth = 1.2; for(let i = 0; i < 26; i++){ const an = i / 26 * PI + tt * 0.05; c.strokeStyle = A(i % 2 ? L.c2 : mix(L.c1, '#ffffff', 0.3), 0.45); c.beginPath(); c.ellipse(x, y, R, R * Math.abs(Math.cos(an)) + 1, an, 0, TAU); c.stroke(); } break; }
			case 'lattice': { const s = Math.max(12, R / 7); c.beginPath(); for(let gx = -10; gx <= 10; gx++) for(let gy = -10; gy <= 10; gy++){ const cx = x + gx * s * 1.5, cy = y + gy * s * 1.732 + (gx % 2 ? s * 0.866 : 0); if(Math.hypot(cx - x, cy - y) > R + s) continue; for(let i = 0; i <= 6; i++){ const an = i / 6 * TAU, px = cx + Math.cos(an) * s * 0.9, py = cy + Math.sin(an) * s * 0.9; if(i) c.lineTo(px, py); else c.moveTo(px, py); } } c.strokeStyle = A(L.c1, 0.35 + 0.15 * Math.sin(t * 2)); c.lineWidth = 1.3; c.stroke(); break; }
			default: {
				const L2 = L.sigil === 'none' ? Object.assign({}, L, { sigil: 'rings' }) : L;
				drawPattern(c, x, y, R, L2, t, D.seed, 1.2);
				drawParticles(c, { x, y, gy: y + R, hy: y }, R, L, L.p1, L.p1n * 0.7, t, D.seed, 0.8);
				const sx = fract(t * 0.12), sg = c.createLinearGradient(x - R, y - R, x + R, y + R);
				sg.addColorStop(clamp(sx - 0.12, 0, 1), A(L.c2, 0)); sg.addColorStop(sx, A(L.c2, L.bright ? 0.35 : 0.16)); sg.addColorStop(clamp(sx + 0.12, 0, 1), A(L.c2, 0));
				c.fillStyle = sg; c.fillRect(x - R, y - R, R * 2, R * 2);
			}
		}
		c.restore();
		c.globalCompositeOperation = L.bright ? 'source-over' : 'lighter';
		c.strokeStyle = A(L.veil === 'mirror' ? '#ffffff' : L.c1, 0.85); c.lineWidth = Math.max(2, L.rim * 0.8); c.beginPath(); c.arc(x, y, R, 0, TAU); c.stroke();
		c.strokeStyle = A(L.c1, 0.22 * L.glow); c.lineWidth = 10 + 10 * L.glow; c.beginPath(); c.arc(x, y, R + 3, 0, TAU); c.stroke();
		if(D.phase === 'active'){
			c.globalCompositeOperation = 'source-over'; c.textAlign = 'center'; c.font = titleFont(L, Math.round(clamp(R * 0.09, 12, 22)));
			c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.6)'; c.fillStyle = A(L.c2, 0.92);
			const tt2 = titleCase(L, /^jp/.test(L.titleFont || '') && L.title.trim().toLowerCase() === 'domain expansion' ? '領域展開' : L.title); c.strokeText(tt2, x, y - R - 12); c.fillText(tt2, x, y - R - 12);
		}
		c.restore();
	}

	/* ============================================================ type */
	const FONT_STACK = {
		serif:   (s) => '800 ' + s + 'px Georgia, "Times New Roman", serif',
		elegant: (s) => 'italic 600 ' + s + 'px "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif',
		bold:    (s) => '900 ' + s + 'px Impact, "Arial Black", "Helvetica Neue", sans-serif',
		brush:   (s) => '700 ' + s + 'px "Brush Script MT", "Segoe Script", "Lucida Handwriting", cursive',
		gothic:  (s) => '700 ' + s + 'px "Old English Text MT", "UnifrakturMaguntia", "Engravers MT", Georgia, serif',
		mono:    (s) => '700 ' + s + 'px "Courier New", Consolas, monospace',
		jpmincho:(s) => '800 ' + s + 'px "Yu Mincho", "YuMincho", "Hiragino Mincho ProN", "Noto Serif CJK JP", "Noto Serif JP", "MS Mincho", "Songti SC", serif',
		jpgothic:(s) => '900 ' + s + 'px "Yu Gothic", "YuGothic", "Hiragino Kaku Gothic ProN", "Noto Sans CJK JP", "Noto Sans JP", "Meiryo", "MS Gothic", sans-serif',
		jpbrush: (s) => '700 ' + s + 'px "HGSeikaishotaiPRO", "HG行書体", "Yuji Syuku", "Yu Mincho", "Hiragino Mincho ProN", "Noto Serif CJK JP", "MS Mincho", serif',
		wide:    (s) => '300 ' + s + 'px "Trebuchet MS", "Segoe UI", Verdana, sans-serif'
	};
	const titleFont = (L, s) => (FONT_STACK[L.titleFont] || FONT_STACK.serif)(s);
	const isJP = (L) => /^jp/.test(L.titleFont || '');
	const titleCase = (L, s) => (isJP(L) || ['brush', 'gothic', 'elegant'].includes(L.titleFont)) ? s : s.toUpperCase();
	function titleColors(L){
		switch(L.titleColor){
			case 'white': return { fill: '#ffffff', stroke: 'rgba(0,0,0,.75)', glow: L.c1 };
			case 'black': return { fill: '#111014', stroke: 'rgba(255,255,255,.75)', glow: 'rgba(255,255,255,.6)' };
			case 'primary': return { fill: L.c1, stroke: 'rgba(0,0,0,.8)', glow: L.c1 };
			case 'gold': return { fill: '#ffd36b', stroke: 'rgba(40,20,0,.8)', glow: '#ffb347' };
			default: return { fill: L.bright ? '#ffffff' : L.c2, stroke: 'rgba(0,0,0,.75)', glow: L.c1 };
		}
	}
	function spacing(c, px){ if('letterSpacing' in c) c.letterSpacing = px + 'px'; }
	function drawTitle(c, w, h, L, p){
		const ta = clamp((p - 0.06) / 0.22, 0, 1); if(ta <= 0) return;
		const sc = 1.18 - 0.18 * easeOut(clamp((p - 0.04) / 0.3, 0, 1));
		const isDefaultTitle = L.title.trim().toLowerCase() === 'domain expansion';
		const col = titleColors(L), title = titleCase(L, isJP(L) && isDefaultTitle ? '領域展開' : L.title);      // the default name reads 領域展開 in a Japanese font
		const sub = (L.subtitle && L.subtitle.trim()) || (isDefaultTitle && !isJP(L) ? '' : 'Domain Expansion');
		const wide = L.titleFont === 'wide';
		let fs = Math.round(clamp(Math.min(w * 0.075, h * 0.1), 26, 84));
		c.save(); c.globalAlpha = ta; c.textBaseline = 'middle';
		const fit = (txt, max) => { c.font = titleFont(L, fs); spacing(c, Math.round(fs * (wide ? 0.4 : 0.12))); let tw = c.measureText(txt).width; while(tw > max && fs > 18){ fs -= 2; c.font = titleFont(L, fs); spacing(c, Math.round(fs * (wide ? 0.4 : 0.12))); tw = c.measureText(txt).width; } return tw; };
		const stroke = (txt, x, y) => { c.shadowColor = col.glow; c.shadowBlur = 28; c.lineWidth = Math.max(3, fs * 0.07); c.strokeStyle = col.stroke; c.strokeText(txt, x, y); c.fillStyle = col.fill; c.fillText(txt, x, y); c.shadowBlur = 0; };
		const subLine = (x, y, align) => { if(!sub) return; spacing(c, 4); c.font = '600 ' + Math.round(fs * 0.28) + 'px Georgia, serif'; c.textAlign = align; c.fillStyle = A(L.titleColor === 'black' ? '#111014' : L.c2, 0.85); c.fillText(titleCase({ titleFont: 'serif' }, sub), x, y); };
		switch(L.titleLayout){
			case 'low': {
				const tw = fit(title, w * 0.8), y = h * 0.78;
				c.translate(w * 0.08, y); c.scale(sc, sc); c.textAlign = 'left'; stroke(title, 0, 0);
				const lw = Math.min(w * 0.84, tw + 60) * easeOut(clamp((p - 0.12) / 0.3, 0, 1)); c.strokeStyle = A(L.c1, 0.9); c.lineWidth = 2; c.beginPath(); c.moveTo(0, fs * 0.66); c.lineTo(lw, fs * 0.66); c.stroke();
				subLine(0, -fs * 0.8, 'left'); break;
			}
			case 'vertical': {
				const chars = Array.from(title.replace(/\s+/g, ' ')), maxH = h * 0.78; fs = Math.round(clamp(maxH / Math.max(4, chars.length) * 0.92, 18, 70));
				c.font = titleFont(L, fs); spacing(c, 0); c.textAlign = 'center';
				const x = w * 0.86, y0 = h / 2 - (chars.length - 1) * fs * 0.5;
				chars.forEach((ch, i) => { const k = clamp((p - 0.05 - i * 0.012) / 0.2, 0, 1); if(k <= 0 || ch === ' ') return; c.globalAlpha = ta * k; stroke(ch, x, y0 + i * fs + (1 - k) * 12); });
				c.globalAlpha = ta; c.strokeStyle = A(L.c1, 0.8); c.lineWidth = 2; c.beginPath(); c.moveTo(x - fs * 0.75, y0 - fs * 0.6); c.lineTo(x - fs * 0.75, y0 - fs * 0.6 + (chars.length * fs) * easeOut(clamp((p - 0.1) / 0.35, 0, 1))); c.stroke();
				if(sub){ c.save(); c.translate(x - fs * 1.15, h / 2); c.rotate(-PI / 2); subLine(0, 0, 'center'); c.restore(); }
				break;
			}
			case 'split': {
				const words = title.split(/\s+/), half = Math.ceil(words.length / 2), a = words.slice(0, half).join(' '), b = words.slice(half).join(' ') || '';
				fit(a.length > b.length ? a : b, w * 0.6);
				const slide = (1 - easeOut(clamp((p - 0.04) / 0.28, 0, 1))) * w * 0.15;
				c.textAlign = 'left'; stroke(a, w * 0.07 - slide, h * 0.36);
				c.textAlign = 'right'; stroke(b, w * 0.93 + slide, h * 0.6);
				c.strokeStyle = A(L.c1, 0.85); c.lineWidth = 2; c.beginPath(); c.moveTo(w * 0.07, h * 0.48); c.lineTo(w * 0.93, h * 0.48); c.stroke();
				subLine(w / 2, h * 0.48 - fs * 0.32, 'center'); break;
			}
			default: {
				const tw = fit(title, w * 0.86);
				c.translate(w / 2, h / 2); c.scale(sc, sc); c.textAlign = 'center'; stroke(title, 0, 0);
				const lw = Math.min(w * 0.8, tw + 40) * easeOut(clamp((p - 0.12) / 0.3, 0, 1));
				c.strokeStyle = A(L.c1, 0.9); c.lineWidth = 2; c.beginPath(); c.moveTo(-lw / 2, fs * 0.72); c.lineTo(lw / 2, fs * 0.72); c.stroke();
				subLine(0, fs * 1.02, 'center');
			}
		}
		spacing(c, 0);
		c.restore();
	}
	/* the held breath, painted on screen. p 0..1 through the freeze; sx, sy where the domain is on screen */
	function paintFreeze(c, w, h, L, D, p, sx, sy){
		const fadeIn = clamp(p * 7, 0, 1);
		switch(L.freeze){
			case 'grey': c.save(); c.globalCompositeOperation = 'saturation'; c.fillStyle = 'rgba(128,128,128,' + (0.92 * fadeIn) + ')'; c.fillRect(0, 0, w, h); c.restore(); break;
			case 'sepia': c.save(); c.globalCompositeOperation = 'saturation'; c.fillStyle = 'rgba(128,128,128,' + (0.95 * fadeIn) + ')'; c.fillRect(0, 0, w, h); c.globalCompositeOperation = 'color'; c.fillStyle = 'rgba(160,110,60,' + (0.55 * fadeIn) + ')'; c.fillRect(0, 0, w, h); c.restore(); break;
			case 'invert': c.save(); c.globalCompositeOperation = 'difference'; c.fillStyle = 'rgba(255,255,255,' + fadeIn + ')'; c.fillRect(0, 0, w, h); c.restore(); break;
			case 'tint': c.save(); c.globalCompositeOperation = 'color'; c.fillStyle = A(L.c1, 0.8 * fadeIn); c.fillRect(0, 0, w, h); c.restore(); break;
			case 'dark': c.fillStyle = 'rgba(0,0,0,' + (0.6 * fadeIn) + ')'; c.fillRect(0, 0, w, h); break;
		}
		const g = c.createRadialGradient(sx, sy, Math.min(w, h) * 0.08, sx, sy, Math.max(w, h) * 0.8);
		g.addColorStop(0, A(L.bright ? '#ffffff' : L.c1, 0)); g.addColorStop(0.35, 'rgba(0,0,0,' + (0.25 * clamp(p * 5, 0, 1)) + ')'); g.addColorStop(1, 'rgba(0,0,0,' + (0.78 * clamp(p * 5, 0, 1)) + ')');
		c.fillStyle = g; c.fillRect(0, 0, w, h);
		c.save(); c.globalCompositeOperation = 'lighter';
		const nr = 12 + Math.round(L.rays * 14);
		for(let i = 0; i < nr; i++){
			const an = i / nr * TAU + p * 0.5 + (D.seed || 0), wd = 0.02 + 0.015 * hash(i, D.seed), len = Math.max(w, h) * (0.35 + 0.5 * hash(i + 2, D.seed)) * clamp(p * 3, 0, 1);
			c.fillStyle = A(i % 2 ? L.c1 : L.c2, 0.11 * clamp(p * 4, 0, 1));
			c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + Math.cos(an - wd) * len, sy + Math.sin(an - wd) * len); c.lineTo(sx + Math.cos(an + wd) * len, sy + Math.sin(an + wd) * len); c.closePath(); c.fill();
		}
		c.restore();
		if(L.letterbox){
			const bar = Math.round(h * 0.115 * easeOut(clamp(p * 5, 0, 1)));
			c.fillStyle = '#000'; c.fillRect(0, 0, w, bar); c.fillRect(0, h - bar, w, bar);
			c.fillStyle = A(L.c1, 0.8 * clamp(p * 6, 0, 1)); c.fillRect(0, bar - 1, w * easeOut(clamp(p * 3, 0, 1)), 1.5); c.fillRect(w - w * easeOut(clamp(p * 3, 0, 1)), h - bar, w, 1.5);
		}
		drawTitle(c, w, h, L, p);
		if(p > 0.8){ const fa = (p - 0.8) / 0.2; c.fillStyle = (L.bright ? 'rgba(255,236,248,' : 'rgba(255,255,255,') + (0.55 * fa * fa) + ')'; c.fillRect(0, 0, w, h); }
	}

	/* ============================================================ hooks into a world */
	function init(W, I){
		W._domLook = lookOf;
		const instOf = I.instById;
		function ensureGround(D){
			if(D.groundY != null) return;
			let gy = D.y + D.r * 0.3;
			const inst = instOf ? instOf(D.inst) : null, e = inst && inst.owner && inst.owner.entity;
			if(e && e.h != null && e.y != null) gy = e.y + e.h;
			const H = W.host;
			if(H && typeof H.isSolid === 'function'){
				try { for(let yy = gy - 6; yy < D.y + D.r; yy += 6){ if(H.isSolid(D.x, yy)){ gy = yy; break; } } } catch(err){}
			}
			D.groundY = gy;
		}
		function nearestFoe(D, camX, camY){
			let best = null, bd = Infinity;
			const foes = D.trk ? Array.from(D.trk.keys()) : [];
			for(const e of foes){ if(e.dead) continue; const cx = (e.x || 0) + (e.w || 0) / 2, cy = (e.y || 0) + (e.h || 0) / 2, d = Math.hypot(cx - D.x, cy - D.y); if(d < bd && d < D.r){ bd = d; best = { x: cx - camX, y: cy - camY }; } }
			return best;
		}
		const lifeOf = (D, fade) => D.alive ? 1 : clamp(1 - (W.time - D.endedAt) / fade, 0, 1);
		const shown = (D) => D.phase === 'expand' || D.phase === 'active' || D.phase == null;

		W.drawDomainBackdrop = function(ctx, camX, camY, t){
			if(!W.domains.length) return;
			for(const D of W.domains){
				if(!shown(D)) continue;
				const life = lifeOf(D, 0.8); if(life <= 0) continue;
				ensureGround(D);
				const L = lookOf(D); D.look = L;
				const flick = D.suspended ? 0.55 + 0.35 * Math.sin(t * 30) : 1;
				paintBackdrop(ctx, D, L, camX, camY, t, life * flick, nearestFoe(D, camX, camY));
				// the grade and particles belong to the world too: foes and the player stand over them, not under
				ctx.save(); ctx.globalAlpha = life * flick; paintAmbient(ctx, D, L, camX, camY, t, { open: D.phase === 'expand' ? clamp(D.rNow / D.r, 0, 1) : 1 }); ctx.restore();
			}
		};
		W.clipToDomains = function(ctx, camX, camY){
			let any = false; ctx.beginPath();
			for(const D of W.domains){ if(!D.alive || !shown(D)) continue; any = true; ctx.moveTo(D.x - camX + D.rNow, D.y - camY); ctx.arc(D.x - camX, D.y - camY, Math.max(1, D.rNow), 0, TAU); }
			if(any) ctx.clip();
			return any;
		};
		W.setDomainLook = function(D, look){ D.p = Object.assign({}, D.p || {}, { look }); delete D._look; delete D._art; };

		W._domDraw = function(ctx, camX, camY, t){
			if(!W.domains.length) return;
			for(const D of W.domains){
				const life = lifeOf(D, 0.8); if(life <= 0) continue;
				ensureGround(D);
				const L = lookOf(D); D.look = L;
				const x = D.x - camX, y = D.y - camY;
				if(D.phase === 'gather' || D.phase === 'freeze'){
					const k = D.phase === 'gather' ? clamp(D.ph / Math.max(0.01, D.CT.gather), 0, 1) : 1;
					drawGather(ctx, x, y, D, L, t, k, D.phase === 'freeze', W.cine ? clamp(W.cine.t / W.cine.dur, 0, 1) : 0);
					continue;
				}
				const open = D.phase === 'expand' ? clamp(D.rNow / D.r, 0, 1) : 1;
				if(D.z) D.z.domainShown = !!(D.alive && (D.phase === 'active' || (D.phase === 'expand' && open > 0.6)));
				const flick = D.suspended ? 0.45 + 0.35 * Math.sin(t * 30) : 1;
				ctx.save(); ctx.globalAlpha = life * flick;
				if(!W.hostDrawsDomainBackdrop) paintBackdrop(ctx, D, L, camX, camY, t, 0.55, nearestFoe(D, camX, camY));
				paintForeground(ctx, D, L, camX, camY, t, { skipAmbient: !!W.hostDrawsDomainBackdrop, open, flare: D.phase === 'expand' ? 1 - open : 0, burstK: D.phase === 'expand' ? clamp(D.ph / Math.max(0.01, D.CT.expand), 0, 1) : null });
				const R = Math.max(2, D.rNow);
				if(D.alive && D.phase === 'active'){
					ctx.globalCompositeOperation = 'lighter';
					const left = clamp((D.end - W.time) / D.dur, 0, 1); ctx.strokeStyle = A(L.c2, 0.6); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, R + 6, -PI / 2, -PI / 2 + left * TAU); ctx.stroke();
					if(D.trk){
						ctx.globalCompositeOperation = 'source-over';
						for(const e of D.trk.keys()){
							const m = W.marksOf ? Math.floor(W.marksOf(e)) : 0; if(m <= 0 || e.dead) continue;
							const cx = (e.x || 0) + (e.w || 0) / 2 - camX, cy = (e.y || 0) - 14 - camY, nm = Math.min(m, 12);
							for(let i = 0; i < nm; i++){ const px = cx + (i - (nm - 1) / 2) * 9; ctx.fillStyle = A(L.c1, 0.95); ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px, cy - 4); ctx.lineTo(px + 3.5, cy); ctx.lineTo(px, cy + 4); ctx.lineTo(px - 3.5, cy); ctx.closePath(); ctx.fill(); ctx.stroke(); }
						}
					}
				}
				ctx.restore();
			}
		};

		W.drawDomainVeil = function(ctx, camX, camY, t, view){
			if(!view || !W.domains.length) return;
			for(const D of W.domains){
				if(D.phase !== 'expand' && D.phase !== 'active') continue;
				const life = lifeOf(D, 0.6); if(life <= 0) continue;
				const L = lookOf(D);
				if(L.outside === 'clear') continue;
				if(Math.hypot(view.x - D.x, view.y - D.y) <= D.rNow - 2) continue;      // inside: you see everything
				paintVeil(ctx, D, L, camX, camY, t, life);
			}
		};

		W.drawDomainCine = function(ctx, w, h, camX, camY, t, view){
			if(!W.domains.length) return;
			for(const D of W.domains){
				if(!D.alive) continue;
				const L = lookOf(D);
				if(D.phase === 'gather' && D.ownerId === 'player'){
					const k = clamp(D.ph / Math.max(0.01, D.CT.gather), 0, 1);
					const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
					g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,' + (0.5 * k * k) + ')');
					ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
				}
				if(D.phase === 'expand'){
					const k = clamp(D.ph / Math.max(0.01, D.CT.expand), 0, 1), fl = Math.pow(1 - k, 2) * (L.bright ? 0.85 : 0.6);
					if(fl > 0.01){ ctx.fillStyle = (L.bright ? 'rgba(255,240,250,' : 'rgba(255,255,255,') + fl + ')'; ctx.fillRect(0, 0, w, h); }
					const sx = D.x - camX, sy = D.y - camY;
					ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = A(L.c2, 0.5 * (1 - k)); ctx.lineWidth = 2; ctx.beginPath();
					for(let i = 0; i < 28; i++){ const an = i / 28 * TAU + D.seed, r0 = 40 + k * 260 * (0.5 + hash(i, D.seed)), r1 = r0 + 90 + 160 * hash(i + 5, D.seed); ctx.moveTo(sx + Math.cos(an) * r0, sy + Math.sin(an) * r0); ctx.lineTo(sx + Math.cos(an) * r1, sy + Math.sin(an) * r1); }
					ctx.stroke(); ctx.restore();
				}
			}
			const C = W.cine;
			if(C && C.D){ const D = C.D; paintFreeze(ctx, w, h, lookOf(D), D, clamp(C.t / C.dur, 0, 1), D.x - camX, D.y - camY); }
			if(view){
				for(const D of W.domains){
					if(!D.alive || D.phase !== 'active' || !D.laws) continue;
					if(Math.hypot(view.x - D.x, view.y - D.y) > D.r) continue;
					const L = lookOf(D), lines = [];
					if(D.vow === 'declared' && D.rulesText) lines.push(...D.rulesText);
					if(D.ownerId === 'player' && D.copies && D.copies.length) lines.push('Copied: ' + D.copies.map(c => c.name).join(' · '));
					if(!lines.length) continue;
					ctx.save(); ctx.font = '600 12px Georgia, serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
					const wmax = Math.min(w * 0.42, Math.max(...lines.map(s => ctx.measureText(s).width)) + 20), x1 = w - 14; let y = Math.round(h * 0.14);
					ctx.fillStyle = 'rgba(8,6,16,.6)'; ctx.fillRect(x1 - wmax, y - 8, wmax, lines.length * 18 + 22);
					ctx.fillStyle = A(L.c1, 0.9); ctx.fillRect(x1 - wmax, y - 8, 3, lines.length * 18 + 22);
					ctx.fillStyle = A(L.c2, 0.95); ctx.fillText((D.vow === 'declared' ? 'THE LAWS OF ' : 'INSIDE ') + L.title.toUpperCase(), x1 - 10, y - 2); y += 18;
					ctx.font = '12px Georgia, serif';
					for(const s of lines){ ctx.fillStyle = 'rgba(255,255,255,.88)'; ctx.fillText(s.length > 64 ? s.slice(0, 62) + '…' : s, x1 - 10, y); y += 18; }
					ctx.restore();
					break;
				}
			}
		};
	}
	ME.registerWorldHook({ init });

	/* ============================================================ painting without a world (thumbnails, the designer) */
	function fakeDomain(look, w, h, opts){
		opts = opts || {};
		const r = opts.r || Math.min(w, h) * 0.46;
		const D = { x: opts.cx != null ? opts.cx : w / 2, y: opts.cy != null ? opts.cy : h * 0.5, r, rNow: opts.rNow != null ? opts.rNow : r, p: { look, title: opts.title || 'Domain Expansion', outside: opts.outside },
			form: opts.form || 'closed', ownerId: 'player', seed: (look && look.seed) || 7, phase: 'active', alive: true, groundY: opts.groundY != null ? opts.groundY : (opts.cy != null ? opts.cy : h * 0.5) + r * 0.42 };
		return D;
	}
	function thumbnail(ctx, look, w, h, t, opts){
		opts = opts || {};
		const D = opts.D || fakeDomain(look, w, h, opts);
		if(!opts.D){ delete D._look; }
		const L = lookOf(D);
		if(!opts.keepBg){ ctx.fillStyle = opts.bg || '#101018'; ctx.fillRect(0, 0, w, h); }
		paintBackdrop(ctx, D, L, 0, 0, t || 0, 1, opts.lookAt || null);
		if(opts.figures !== false) figures(ctx, D, L);
		paintForeground(ctx, D, L, 0, 0, t || 0, {});
		return D;
	}
	/* two small figures standing on the floor so the scale reads */
	function figures(c, D, L){
		const gy = clamp(D.groundY, D.y - D.r * 0.2, D.y + D.r * 0.9), s = D.r / 160;
		const fig = (fx, col) => { c.fillStyle = col; c.beginPath(); c.arc(fx, gy - 33 * s, 6 * s, 0, TAU); c.fill(); c.fillRect(fx - 5 * s, gy - 27 * s, 10 * s, 18 * s); c.fillRect(fx - 4 * s, gy - 9 * s, 3 * s, 9 * s); c.fillRect(fx + 1 * s, gy - 9 * s, 3 * s, 9 * s); };
		fig(D.x - D.r * 0.25, L.bright ? '#2a2a3a' : '#e8ecff'); fig(D.x + D.r * 0.4, '#ff5a6e');
	}
	root.MagicDomainArt = { lookOf, thumbnail, fakeDomain, paintBackdrop, paintForeground, paintVeil, paintFreeze, drawTitle, drawBurst, drawGather, figures, geo };
})(typeof window !== 'undefined' ? window : globalThis);
