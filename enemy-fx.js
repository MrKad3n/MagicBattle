/* =============================================================
   enemy-fx.js — shared visual effects for basic enemy attacks
   -------------------------------------------------------------
   One small, fast VFX layer every enemy kit draws through:
   cached glow sprites (one drawImage per glow), element palettes,
   projectile bodies with trails, particles, bursts, slashes, beams,
   lightning, telegraphs and ground decals.

   Hooks (dungeon.html):
     EFX.update()      once per game tick (after the kit world updates)
     EFX.drawBack()    behind enemies (decals, ground glows)
     EFX.drawFront()   after enemy projectiles (particles, bursts)
   Everything is in world coordinates; drawing subtracts camera.x/y.
   ============================================================= */
(function(){
	'use strict';
	const TAU = Math.PI * 2;
	const rnd = Math.random;
	const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);

	/* ---------------------------------------------------------- palettes */
	// core: hottest/brightest, mid: body colour, outer: rim/glow, dark: smoke/crust, style: body renderer
	const EL = {
		fire:     { core:'#fff4c8', mid:'#ffa526', outer:'#ff4a0a', dark:'#3a1206', style:'flame', mote:'ember' },
		magma:    { core:'#fff0a0', mid:'#ff7a12', outer:'#d92a00', dark:'#2a0c04', style:'magma', mote:'ember' },
		ice:      { core:'#ffffff', mid:'#bdeeff', outer:'#4aa6ff', dark:'#1a3a66', style:'crystal', mote:'frost' },
		frost:    { core:'#ffffff', mid:'#d8f6ff', outer:'#7cc8ff', dark:'#2a4a70', style:'crystal', mote:'frost' },
		earth:    { core:'#f2dcb0', mid:'#a8794a', outer:'#6e4a2a', dark:'#2e2014', style:'rock', mote:'dust' },
		crystal:  { core:'#ffffff', mid:'#e6b8ff', outer:'#9a5cff', dark:'#2a1450', style:'crystal', mote:'glint' },
		nature:   { core:'#f4ffd0', mid:'#8edc48', outer:'#3f8a22', dark:'#1a3410', style:'thorn', mote:'leaf' },
		poison:   { core:'#f6ffb8', mid:'#a8e030', outer:'#4e8a12', dark:'#1c300a', style:'glob', mote:'bubble' },
		spore:    { core:'#fbffe0', mid:'#d8ee66', outer:'#7aa020', dark:'#2a3a0a', style:'spore', mote:'spore' },
		mud:      { core:'#e8d0a0', mid:'#8a6236', outer:'#56381c', dark:'#24160a', style:'glob', mote:'drop' },
		shadow:   { core:'#f2dcff', mid:'#a050ff', outer:'#5a1aa8', dark:'#10001e', style:'void', mote:'wisp' },
		void:     { core:'#ffffff', mid:'#c070ff', outer:'#40108a', dark:'#06000e', style:'void', mote:'wisp' },
		necro:    { core:'#eaffe0', mid:'#7cf08a', outer:'#1e8a46', dark:'#06180c', style:'void', mote:'wisp' },
		lightning:{ core:'#ffffff', mid:'#c8ecff', outer:'#5a8cff', dark:'#101a40', style:'spark', mote:'spark' },
		metal:    { core:'#fffbe8', mid:'#ffd468', outer:'#ff7a20', dark:'#2a2420', style:'spark', mote:'spark' },
		water:    { core:'#f0fdff', mid:'#58d4ff', outer:'#1470c0', dark:'#062440', style:'glob', mote:'drop' },
		sand:     { core:'#fff3cc', mid:'#e6b864', outer:'#a87430', dark:'#3a2810', style:'rock', mote:'dust' },
		light:    { core:'#ffffff', mid:'#fff3b0', outer:'#ffc040', dark:'#40300a', style:'orb', mote:'glint' },
		wisp:     { core:'#ffffff', mid:'#c8ffd8', outer:'#48d8a0', dark:'#0a3024', style:'orb', mote:'glint' },
		wind:     { core:'#ffffff', mid:'#dafff4', outer:'#8adcc8', dark:'#2a4a44', style:'wind', mote:'streak' },
		blood:    { core:'#ffd0d0', mid:'#ff3a4a', outer:'#9a0018', dark:'#2a0006', style:'glob', mote:'drop' },
		sonic:    { core:'#ffffff', mid:'#e0d0ff', outer:'#9a80ff', dark:'#20183a', style:'wind', mote:'streak' },
		curse:    { core:'#fffbd8', mid:'#d8c060', outer:'#7a6020', dark:'#1a1404', style:'void', mote:'wisp' },
		silk:     { core:'#ffffff', mid:'#f4ecd8', outer:'#cfc2a0', dark:'#5a5040', style:'orb', mote:'glint' },
		coral:    { core:'#fff0e8', mid:'#ff7aa0', outer:'#c03a6a', dark:'#3a0a1c', style:'crystal', mote:'bubble' },
		glow:     { core:'#ffffff', mid:'#a8fff0', outer:'#1cc0cc', dark:'#04282c', style:'orb', mote:'glint' },
		rot:      { core:'#f0d0ff', mid:'#b048e0', outer:'#4a1060', dark:'#12041a', style:'void', mote:'wisp' }
	};
	function pal(el){ return EL[el] || EL[(el || '').toLowerCase()] || EL.fire; }

	/* ---------------------------------------------------------- colour helpers */
	const _rgbCache = new Map();
	function rgb(hex){
		let v = _rgbCache.get(hex);
		if(v) return v;
		let h = (hex || '#ffffff').replace('#', '');
		if(h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
		const n = parseInt(h.slice(0, 6), 16) || 0;
		v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
		_rgbCache.set(hex, v);
		return v;
	}
	function rgba(hex, a){ const c = rgb(hex); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (a == null ? 1 : a) + ')'; }

	/* ---------------------------------------------------------- sprite cache */
	function mkCanvas(w, h){
		if(typeof document !== 'undefined'){ const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
		if(typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
		return null;
	}
	const _spr = new Map();
	// soft radial glow: colour at centre fading to nothing
	function glowSprite(hex, hard){
		const key = 'g' + hex + (hard ? 'h' : '');
		let s = _spr.get(key);
		if(s) return s;
		const S = 64; s = mkCanvas(S, S);
		const c = s.getContext('2d'), g = c.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
		if(hard){
			g.addColorStop(0, rgba('#ffffff', 1)); g.addColorStop(0.25, rgba(hex, 1)); g.addColorStop(0.55, rgba(hex, 0.45)); g.addColorStop(1, rgba(hex, 0));
		} else {
			g.addColorStop(0, rgba(hex, 1)); g.addColorStop(0.35, rgba(hex, 0.5)); g.addColorStop(0.7, rgba(hex, 0.14)); g.addColorStop(1, rgba(hex, 0));
		}
		c.fillStyle = g; c.fillRect(0, 0, S, S);
		_spr.set(key, s);
		return s;
	}
	// soft smoke puff (drawn with normal blending)
	function smokeSprite(hex){
		const key = 's' + hex;
		let s = _spr.get(key);
		if(s) return s;
		const S = 64; s = mkCanvas(S, S);
		const c = s.getContext('2d');
		for(let i = 0; i < 5; i++){
			const x = S / 2 + (i - 2) * 5 + (i % 2 ? 3 : -3), y = S / 2 + ((i * 7) % 5 - 2) * 3, r = S * (0.26 + (i % 3) * 0.05);
			const g = c.createRadialGradient(x, y, 0, x, y, r);
			g.addColorStop(0, rgba(hex, 0.42)); g.addColorStop(1, rgba(hex, 0));
			c.fillStyle = g; c.fillRect(0, 0, S, S);
		}
		_spr.set(key, s);
		return s;
	}
	// irregular rock chunk with lit edge, several variants per palette
	function rockSprite(el, v){
		const P = pal(el), key = 'r' + el + (v & 7);
		let s = _spr.get(key);
		if(s) return s;
		const S = 64; s = mkCanvas(S, S);
		const c = s.getContext('2d');
		const n = 7 + (v % 3), pts = [];
		let seed = (v + 1) * 9301;
		const R = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
		for(let i = 0; i < n; i++){ const a = i / n * TAU + R() * 0.4, r = S * (0.3 + R() * 0.16); pts.push([S / 2 + Math.cos(a) * r, S / 2 + Math.sin(a) * r]); }
		c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath();
		const molten = el === 'magma' || el === 'fire';
		const g = c.createLinearGradient(S * 0.2, S * 0.15, S * 0.8, S * 0.9);
		if(molten){ g.addColorStop(0, '#6a3a26'); g.addColorStop(0.45, '#3a1c10'); g.addColorStop(1, '#160804'); }
		else { g.addColorStop(0, P.core); g.addColorStop(0.35, P.mid); g.addColorStop(1, P.dark); }
		c.fillStyle = g; c.fill();
		c.lineWidth = 2; c.strokeStyle = rgba(molten ? '#100402' : P.dark, 0.9); c.stroke();
		if(molten){
			// glowing seams through the crust
			c.save(); c.clip();
			c.lineCap = 'round';
			for(let pass = 0; pass < 2; pass++){
				c.strokeStyle = pass ? '#ffd060' : 'rgba(255,90,10,0.85)'; c.lineWidth = pass ? 1.4 : 4;
				c.beginPath(); c.moveTo(pts[1][0], pts[1][1]); c.lineTo(S / 2 + 2, S / 2 + 1); c.lineTo(pts[4][0], pts[4][1]);
				c.moveTo(S / 2 + 2, S / 2 + 1); c.lineTo(pts[(n - 2)][0], pts[(n - 2)][1]); c.stroke();
			}
			c.restore();
			_spr.set(key, s);
			return s;
		}
		// facets
		c.strokeStyle = rgba(P.dark, 0.55); c.lineWidth = 1.2;
		c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); c.lineTo(S / 2 + 3, S / 2 - 2); c.lineTo(pts[3][0], pts[3][1]); c.moveTo(S / 2 + 3, S / 2 - 2); c.lineTo(pts[5 % n][0], pts[5 % n][1]); c.stroke();
		c.strokeStyle = rgba(P.core, 0.6); c.lineWidth = 1.5;
		c.beginPath(); c.moveTo(pts[n - 1][0], pts[n - 1][1]); c.lineTo(pts[0][0], pts[0][1]); c.lineTo(pts[1][0], pts[1][1]); c.stroke();
		_spr.set(key, s);
		return s;
	}

	/* ---------------------------------------------------------- drawing state */
	let cx = null, camX = 0, camY = 0, VW = 1280, VH = 720, frame = 0;
	function bind(){
		try { cx = (typeof ctx !== 'undefined' && ctx) ? ctx : cx; } catch(e){}
		if(typeof camera !== 'undefined'){ camX = camera.x; camY = camera.y; }
		if(cx && cx.canvas){ VW = cx.canvas.width; VH = cx.canvas.height; }
	}
	function onScreen(x, y, m){ m = m || 80; const sx = x - camX, sy = y - camY; return sx > -m && sx < VW + m && sy > -m && sy < VH + m; }

	// world-space glow (additive)
	function glow(x, y, r, hex, a, hard){
		if(r < 0.5 || a <= 0.01) return;
		const c = cx;
		const pa = c.globalAlpha;
		c.globalAlpha = pa * Math.min(1, a);
		c.drawImage(glowSprite(hex, hard), x - camX - r, y - camY - r, r * 2, r * 2);
		c.globalAlpha = pa;
	}
	function glowS(sx, sy, r, hex, a, hard){ // screen-space
		if(r < 0.5 || a <= 0.01) return;
		const c = cx, pa = c.globalAlpha;
		c.globalAlpha = pa * Math.min(1, a);
		c.drawImage(glowSprite(hex, hard), sx - r, sy - r, r * 2, r * 2);
		c.globalAlpha = pa;
	}
	function additive(fn){
		const c = cx, op = c.globalCompositeOperation;
		c.globalCompositeOperation = 'lighter';
		try { fn(); } finally { c.globalCompositeOperation = op; }
	}

	/* ---------------------------------------------------------- particles */
	const parts = [];
	function cap(){
		const lite = (typeof _onlineLite !== 'undefined' && _onlineLite);
		return Math.round((lite ? 220 : 520) * Q.q);
	}
	/* Adaptive quality. Headless tests can't see GPU fill cost, so the layer watches the real frame time:
	   if frames stay slow it steps down (smaller pool, shorter trails, plainer bolts when many are in flight),
	   and steps back up once the game runs smoothly again. */
	const Q = { q: 1, ema: 16.7, last: 0, slow: 0, fast: 0, bolts: 0 };
	function tickQuality(){
		const now = (typeof performance !== 'undefined') ? performance.now() : 0;
		const dt = now - Q.last; Q.last = now;
		Q.bolts = 0;
		if(dt < 4 || dt > 250) return;          // extra sub-steps, or a tab that was hidden
		Q.ema = Q.ema * 0.94 + dt * 0.06;
		if(Q.ema > 23){ Q.fast = 0; if(++Q.slow > 40 && Q.q > 0.35){ Q.q = Q.q > 0.75 ? 0.6 : 0.35; Q.slow = 0; } }
		else if(Q.ema < 18.5){ Q.slow = 0; if(++Q.fast > 300 && Q.q < 1){ Q.q = Q.q < 0.5 ? 0.6 : 1; Q.fast = 0; } }
		else { Q.slow = 0; Q.fast = 0; }
	}
	// kinds that carry gameplay meaning are never shed
	const KEEP = { gwave:1, decal:1, slash:1, alert:1 };
	const SINK = {};   // shed particles are written here and dropped
	function add(o){
		const C = cap(), n = parts.length;
		// past half the pool, cosmetic motes are shed more and more often,
		// so a crowded fight degrades gracefully instead of rasterising 600 sprites
		if(n > C * 0.5 && !KEEP[o.k] && Math.random() < (n - C * 0.5) / (C * 0.5)) return SINK;
		if(n >= C){
			// recycle the oldest particle instead of growing
			parts.shift();
		}
		o.age = 0;
		if(o.max == null) o.max = 30;
		parts.push(o);
		return o;
	}
	// emitters -----------------------------------------------------------
	function mote(el, x, y, vx, vy, scale){
		const P = pal(el), s = scale || 1;
		switch(P.mote){
			case 'ember': return add({ k:'ember', x, y, vx:vx * 0.2 + (rnd() - 0.5) * 1.2, vy:vy * 0.2 - 0.6 - rnd() * 1.2, g:-0.02, drag:0.96, size:(1.4 + rnd() * 2) * s, c:rnd() < 0.5 ? P.mid : P.core, max:18 + rnd() * 18 | 0 });
			case 'frost': return add({ k:'glint', x, y, vx:(rnd() - 0.5) * 1.2, vy:(rnd() - 0.5) * 1.2 + 0.3, g:0.02, drag:0.95, size:(1.2 + rnd() * 1.6) * s, c:P.core, c2:P.outer, max:22 + rnd() * 16 | 0 });
			case 'glint': return add({ k:'glint', x, y, vx:(rnd() - 0.5) * 1.4, vy:(rnd() - 0.5) * 1.4, drag:0.94, size:(1.2 + rnd() * 1.8) * s, c:P.core, c2:P.mid, max:16 + rnd() * 14 | 0 });
			case 'dust': return add({ k:'smoke', x, y, vx:vx * 0.1 + (rnd() - 0.5) * 0.8, vy:-0.2 - rnd() * 0.5, drag:0.96, size:(6 + rnd() * 6) * s, grow:1.025, c:P.mid, a:0.35, max:26 + rnd() * 16 | 0 });
			case 'leaf': return add({ k:'leaf', x, y, vx:(rnd() - 0.5) * 2, vy:-rnd() * 1.5, g:0.05, drag:0.97, size:(3 + rnd() * 2.5) * s, rot:rnd() * TAU, vr:(rnd() - 0.5) * 0.3, c:rnd() < 0.5 ? P.mid : P.outer, max:30 + rnd() * 20 | 0 });
			case 'bubble': return add({ k:'bubble', x, y, vx:(rnd() - 0.5) * 0.8, vy:-0.4 - rnd() * 0.8, drag:0.97, size:(1.6 + rnd() * 2.6) * s, c:P.mid, c2:P.core, max:20 + rnd() * 18 | 0 });
			case 'spore': return add({ k:'glint', x, y, vx:(rnd() - 0.5) * 1.4, vy:-0.3 - rnd() * 0.6, drag:0.97, size:(1.6 + rnd() * 2) * s, c:P.mid, c2:P.outer, max:30 + rnd() * 24 | 0 });
			case 'drop': return add({ k:'drop', x, y, vx:vx * 0.2 + (rnd() - 0.5) * 1.6, vy:vy * 0.2 - rnd() * 1.2, g:0.22, drag:0.99, size:(1.6 + rnd() * 1.8) * s, c:P.mid, c2:P.core, max:24 + rnd() * 10 | 0 });
			case 'wisp': return add({ k:'wisp', x, y, vx:(rnd() - 0.5) * 0.8, vy:-0.3 - rnd() * 0.7, drag:0.96, size:(4 + rnd() * 4) * s, c:P.mid, c2:P.dark, max:24 + rnd() * 16 | 0 });
			case 'spark': return add({ k:'spark', x, y, vx:vx * 0.15 + (rnd() - 0.5) * 4, vy:vy * 0.15 + (rnd() - 0.5) * 4, g:0.12, drag:0.93, size:(1 + rnd()) * s, len:2.2, c:P.core, c2:P.mid, max:10 + rnd() * 10 | 0 });
			case 'streak': return add({ k:'spark', x, y, vx:vx * 0.4 + (rnd() - 0.5), vy:vy * 0.4 + (rnd() - 0.5), drag:0.94, size:(1.2 + rnd()) * s, len:4, c:P.core, c2:P.mid, max:12 + rnd() * 8 | 0 });
		}
		return null;
	}
	function emit(el, x, y, n, opts){
		opts = opts || {};
		const sp = opts.speed != null ? opts.speed : 3, s = opts.scale || 1;
		for(let i = 0; i < n; i++){
			const a = opts.ang != null ? opts.ang + (rnd() - 0.5) * (opts.spread != null ? opts.spread : TAU) : rnd() * TAU;
			const v = sp * (0.35 + rnd() * 0.9);
			const o = mote(el, x + (rnd() - 0.5) * (opts.jx || 6), y + (rnd() - 0.5) * (opts.jy || 6), Math.cos(a) * v * 5, Math.sin(a) * v * 5, s);
			if(o && opts.kick !== false){ o.vx += Math.cos(a) * v; o.vy += Math.sin(a) * v; }
		}
	}
	function sparks(el, x, y, n, opts){
		opts = opts || {};
		const P = pal(el), sp = opts.speed || 6;
		for(let i = 0; i < n; i++){
			const a = opts.ang != null ? opts.ang + (rnd() - 0.5) * (opts.spread != null ? opts.spread : TAU) : rnd() * TAU;
			const v = sp * (0.4 + rnd() * 0.8);
			add({ k:'spark', x, y, vx:Math.cos(a) * v, vy:Math.sin(a) * v - (opts.up || 0), g:opts.g != null ? opts.g : 0.18, drag:0.92, size:(1 + rnd() * 1.2) * (opts.scale || 1), len:opts.len || 2.6, c:P.core, c2:P.mid, max:(opts.life || 14) + rnd() * 8 | 0 });
		}
	}
	function debris(el, x, y, n, opts){
		opts = opts || {};
		const P = pal(el), sp = opts.speed || 5;
		let floor = opts.floor;
		if(floor === undefined && typeof fireKitFloorY === 'function'){ try { floor = fireKitFloorY(x, y - 24); } catch(e){ floor = null; } }
		const kind = opts.kind || (P.style === 'crystal' ? 'shard' : (P.style === 'thorn' ? 'leaf' : 'chunk'));
		for(let i = 0; i < n; i++){
			const a = opts.ang != null ? opts.ang + (rnd() - 0.5) * (opts.spread != null ? opts.spread : 1.6) : -Math.PI / 2 + (rnd() - 0.5) * 2.4;
			const v = sp * (0.5 + rnd() * 0.8);
			add({ k:kind, x:x + (rnd() - 0.5) * (opts.jx || 10), y:y + (rnd() - 0.5) * (opts.jy || 6), vx:Math.cos(a) * v, vy:Math.sin(a) * v, g:0.32, drag:0.99, size:(2.4 + rnd() * 3.4) * (opts.scale || 1), rot:rnd() * TAU, vr:(rnd() - 0.5) * 0.5, c:rnd() < 0.45 ? P.mid : P.outer, c2:P.core, el, v:(rnd() * 8) | 0, floor, max:(opts.life || 40) + rnd() * 20 | 0 });
		}
	}
	function smoke(x, y, n, opts){
		opts = opts || {};
		for(let i = 0; i < n; i++){
			add({ k:'smoke', x:x + (rnd() - 0.5) * (opts.jx || 14), y:y + (rnd() - 0.5) * (opts.jy || 8), vx:(rnd() - 0.5) * (opts.spread || 1.4) + (opts.vx || 0), vy:-0.3 - rnd() * (opts.rise || 0.9), drag:0.96, size:(opts.size || 10) * (0.7 + rnd() * 0.6), grow:opts.grow || 1.03, c:opts.c || '#2a2420', a:opts.a || 0.5, max:(opts.life || 34) + rnd() * 20 | 0 });
		}
	}
	function flash(x, y, r, el, life){
		const P = pal(el);
		add({ k:'flash', x, y, size:r, c:P.mid, c2:P.core, max:life || 9 });
	}
	function ring(x, y, r0, r1, el, life, opts){
		opts = opts || {};
		const P = pal(el);
		return add({ k:'ring', x, y, r0, r1, flat:opts.flat || 1, w:opts.width || 4, c:opts.color || P.mid, c2:P.core, max:life || 18, back:!!opts.back });
	}
	function groundWave(x, y, r, el, life){
		const P = pal(el);
		add({ k:'gwave', x, y, r0:6, r1:r, c:P.mid, c2:P.core, max:life || 22, back:true });
	}
	function decal(x, y, r, el, life, opts){
		const P = pal(el);
		opts = opts || {};
		add({ k:'decal', x, y, size:r, flat:opts.flat || 0.32, c:opts.color || P.dark, c2:P.outer, glowA:opts.glow != null ? opts.glow : 0.5, max:life || 160, back:true });
	}
	// melee crescent. dir: 1 clockwise sweep, -1 counter
	function slash(x, y, ang, r, arc, el, opts){
		opts = opts || {};
		const P = pal(el);
		return add({ k:'slash', x, y, ang, r, arc:arc || 2.2, dir:opts.dir || 1, w:opts.width || r * 0.28, c:opts.color || P.mid, c2:P.core, c3:P.outer, max:opts.life || 14, follow:opts.follow || null, fx:opts.fx || 0, fy:opts.fy || 0 });
	}
	// inward gathering energy (wind-up)
	function charge(x, y, el, r, n, life){
		const P = pal(el);
		for(let i = 0; i < (n || 10); i++){
			const a = rnd() * TAU, d = (r || 60) * (0.7 + rnd() * 0.5), m = (life || 22) * (0.7 + rnd() * 0.4) | 0;
			add({ k:'gather', x:x + Math.cos(a) * d, y:y + Math.sin(a) * d, tx:x, ty:y, sx:x + Math.cos(a) * d, sy:y + Math.sin(a) * d, size:1.6 + rnd() * 1.8, c:P.core, c2:P.mid, max:m });
		}
	}
	// generic impact: flash + ring + sparks + element debris (+ optional shake)
	function burst(x, y, el, size, opts){
		opts = opts || {};
		const s = size || 1, P = pal(el);
		flash(x, y, 34 * s, el, 8 + 2 * s | 0);
		ring(x, y, 6 * s, 46 * s, el, 14 + 3 * s | 0, { width:3 + s * 2 });
		if(P.style === 'spark') sparks(el, x, y, 8 + 5 * s | 0, { speed:5 + 2 * s });
		else sparks(el, x, y, 4 + 3 * s | 0, { speed:4 + 2 * s, len:2 });
		emit(el, x, y, 5 + 4 * s | 0, { speed:1.4 * s });
		if(opts.debris !== false && (P.style === 'rock' || P.style === 'crystal' || P.style === 'magma' || P.style === 'thorn')) debris(el, x, y, 3 + 3 * s | 0, { speed:3 + 2 * s, floor:opts.floor, scale:0.8 + s * 0.2 });
		if(P.style === 'flame' || P.style === 'magma') smoke(x, y - 4, 2 + s | 0, { size:9 * s, c:P.dark, a:0.45 });
		if(opts.shake && typeof shakeScreen === 'function') shakeScreen(opts.shake, 8 + opts.shake);
	}
	// player-hit feedback, a bit punchier than an ordinary impact
	let lastHit = { f: -99, x: 0, y: 0 };
	function hit(x, y, el, power){
		// a damage-over-time tick re-hitting the same spot every few frames gets one burst, not a pile
		if(frame - lastHit.f < 6 && Math.abs(x - lastHit.x) < 40 && Math.abs(y - lastHit.y) < 40) return;
		lastHit.f = frame; lastHit.x = x; lastHit.y = y;
		const s = clamp((power || 20) / 25, 0.6, 2);
		burst(x, y, el, s, { debris:false });
		sparks(el, x, y, 6, { speed:7, len:3 });
	}

	function update(){
		frame++;
		tickQuality();
		for(let i = parts.length - 1; i >= 0; i--){
			const p = parts[i];
			p.age++;
			if(p.age >= p.max){ parts[i] = parts[parts.length - 1]; parts.pop(); continue; }
			if(p.k === 'gather'){
				const u = p.age / p.max, e = u * u;
				p.x = p.sx + (p.tx - p.sx) * e; p.y = p.sy + (p.ty - p.sy) * e;
				continue;
			}
			if(p.follow && !p.follow.dead){ p.x = p.follow.x + p.follow.w / 2 + p.fx; p.y = p.follow.y + p.follow.h / 2 + p.fy; }
			if(p.vx != null){
				if(p.drag){ p.vx *= p.drag; p.vy *= p.drag; }
				if(p.g) p.vy += p.g;
				p.x += p.vx; p.y += p.vy;
				if(p.vr) p.rot += p.vr;
				if(p.floor != null && p.y > p.floor){ p.y = p.floor; p.vy *= -0.35; p.vx *= 0.6; p.vr *= 0.5; }
			}
			if(p.grow) p.size *= p.grow;
		}
	}

	function drawPart(p){
		const u = p.age / p.max, sx = p.x - camX, sy = p.y - camY, c = cx;
		switch(p.k){
			case 'ember': {
				const a = (1 - u) * (0.7 + 0.3 * Math.sin(p.age * 0.9 + p.x));
				glowS(sx, sy, p.size * 3.2, p.c, a * 0.8);
				glowS(sx, sy, p.size * 1.1, '#ffffff', a * 0.8, true);
				break;
			}
			case 'glint': {
				const a = Math.sin(u * Math.PI);
				glowS(sx, sy, p.size * 3, p.c2 || p.c, a * 0.6);
				c.globalAlpha = a; c.fillStyle = p.c;
				const s = p.size * 1.6;
				c.beginPath(); c.moveTo(sx, sy - s); c.lineTo(sx + s * 0.28, sy); c.lineTo(sx, sy + s); c.lineTo(sx - s * 0.28, sy); c.closePath(); c.fill();
				c.beginPath(); c.moveTo(sx - s, sy); c.lineTo(sx, sy + s * 0.28); c.lineTo(sx + s, sy); c.lineTo(sx, sy - s * 0.28); c.closePath(); c.fill();
				c.globalAlpha = 1;
				break;
			}
			case 'spark': {
				const a = 1 - u, L = p.len || 2.5;
				c.globalAlpha = a; c.strokeStyle = p.c2; c.lineWidth = p.size * 2.2; c.lineCap = 'round';
				c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx - p.vx * L, sy - p.vy * L); c.stroke();
				c.strokeStyle = p.c; c.lineWidth = p.size;
				c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx - p.vx * L * 0.6, sy - p.vy * L * 0.6); c.stroke();
				c.globalAlpha = 1;
				break;
			}
			case 'flash': {
				const a = 1 - u;
				glowS(sx, sy, p.size * (0.7 + u * 0.6), p.c, a * 0.9);
				glowS(sx, sy, p.size * 0.5 * (1 - u * 0.5), '#ffffff', a, true);
				break;
			}
			case 'gather': {
				const a = Math.min(1, u * 3) * (1 - u * 0.3);
				glowS(sx, sy, p.size * 3, p.c2, a * 0.7);
				glowS(sx, sy, p.size, p.c, a, true);
				break;
			}
			case 'wisp': {
				const a = Math.sin(u * Math.PI) * 0.75;
				glowS(sx, sy, p.size * (1 + u), p.c, a * 0.6);
				glowS(sx, sy, p.size * 0.4, '#ffffff', a * 0.5, true);
				break;
			}
			case 'bubble': {
				const a = Math.sin(u * Math.PI);
				c.globalAlpha = a * 0.85; c.strokeStyle = p.c; c.lineWidth = 1.2;
				c.beginPath(); c.arc(sx, sy, p.size, 0, TAU); c.stroke();
				c.fillStyle = p.c2; c.globalAlpha = a * 0.7;
				c.fillRect(sx - p.size * 0.45, sy - p.size * 0.5, p.size * 0.35, p.size * 0.35);
				c.globalAlpha = 1;
				break;
			}
			case 'drop': {
				const a = 1 - u, ang = Math.atan2(p.vy, p.vx);
				c.save(); c.translate(sx, sy); c.rotate(ang);
				c.globalAlpha = a; c.fillStyle = p.c;
				c.beginPath(); c.ellipse(0, 0, p.size * 1.8, p.size, 0, 0, TAU); c.fill();
				c.fillStyle = p.c2; c.globalAlpha = a * 0.8; c.beginPath(); c.arc(p.size * 0.6, -p.size * 0.3, p.size * 0.35, 0, TAU); c.fill();
				c.restore();
				break;
			}
			case 'smoke': {
				const a = (p.a || 0.5) * Math.sin(u * Math.PI) * 1.2;
				c.globalAlpha = Math.min(1, a);
				const s = p.size * 2;
				c.drawImage(smokeSprite(p.c), sx - s, sy - s, s * 2, s * 2);
				c.globalAlpha = 1;
				break;
			}
			case 'leaf': {
				const a = 1 - u * u;
				c.save(); c.translate(sx, sy); c.rotate(p.rot);
				c.globalAlpha = a; c.fillStyle = p.c;
				const s = p.size;
				c.beginPath(); c.moveTo(-s * 1.6, 0); c.quadraticCurveTo(0, -s, s * 1.6, 0); c.quadraticCurveTo(0, s, -s * 1.6, 0); c.fill();
				c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(-s * 1.4, 0); c.lineTo(s * 1.4, 0); c.stroke();
				c.restore();
				break;
			}
			case 'chunk': {
				const a = u > 0.75 ? (1 - u) / 0.25 : 1, s = p.size * 2.4;
				c.save(); c.translate(sx, sy); c.rotate(p.rot); c.globalAlpha = a;
				c.drawImage(rockSprite(p.el || 'earth', p.v), -s, -s, s * 2, s * 2);
				c.restore();
				if(pal(p.el).style === 'magma' && u < 0.6){ additive(() => glowS(sx, sy, p.size * 3, pal(p.el).outer, (0.6 - u))); }
				break;
			}
			case 'shard': {
				const a = u > 0.7 ? (1 - u) / 0.3 : 1, s = p.size;
				c.save(); c.translate(sx, sy); c.rotate(p.rot); c.globalAlpha = a;
				c.fillStyle = p.c; c.beginPath(); c.moveTo(0, -s * 2.2); c.lineTo(s * 0.8, 0); c.lineTo(0, s * 1.2); c.lineTo(-s * 0.8, 0); c.closePath(); c.fill();
				c.fillStyle = p.c2; c.globalAlpha = a * 0.8; c.beginPath(); c.moveTo(0, -s * 2.2); c.lineTo(s * 0.8, 0); c.lineTo(0, -s * 0.2); c.closePath(); c.fill();
				c.restore();
				break;
			}
			case 'ring': {
				const e = 1 - (1 - u) * (1 - u), r = p.r0 + (p.r1 - p.r0) * e, a = 1 - u;
				c.globalAlpha = a * 0.9; c.strokeStyle = p.c; c.lineWidth = Math.max(0.5, p.w * (1 - u * 0.7));
				c.beginPath(); c.ellipse(sx, sy, r, r * p.flat, 0, 0, TAU); c.stroke();
				c.globalAlpha = a * 0.6; c.strokeStyle = p.c2; c.lineWidth = Math.max(0.5, p.w * 0.35);
				c.beginPath(); c.ellipse(sx, sy, r * 0.97, r * 0.97 * p.flat, 0, 0, TAU); c.stroke();
				c.globalAlpha = 1;
				break;
			}
			case 'gwave': {
				const e = 1 - (1 - u) * (1 - u), r = p.r0 + (p.r1 - p.r0) * e, a = 1 - u;
				c.globalAlpha = a * 0.55; c.fillStyle = p.c;
				c.beginPath(); c.ellipse(sx, sy, r, r * 0.16, 0, 0, TAU); c.ellipse(sx, sy, r * 0.82, r * 0.12, 0, 0, TAU); c.fill('evenodd');
				c.globalAlpha = a * 0.8; c.strokeStyle = p.c2; c.lineWidth = 2;
				c.beginPath(); c.ellipse(sx, sy, r, r * 0.16, 0, Math.PI, TAU); c.stroke();
				c.globalAlpha = 1;
				break;
			}
			case 'decal': {
				const a = u < 0.08 ? u / 0.08 : (u > 0.6 ? (1 - u) / 0.4 : 1), r = p.size;
				c.globalAlpha = a * 0.55; c.fillStyle = p.c;
				c.beginPath(); c.ellipse(sx, sy, r, r * p.flat, 0, 0, TAU); c.fill();
				if(p.glowA > 0){
					c.globalAlpha = a * p.glowA * Math.max(0, 1 - u * 1.6);
					c.save(); c.globalCompositeOperation = 'lighter'; c.translate(sx, sy); c.scale(1, p.flat * 1.6);
					c.drawImage(glowSprite(p.c2), -r * 0.8, -r * 0.8, r * 1.6, r * 1.6);
					c.restore();
				}
				c.globalAlpha = 1;
				break;
			}
			case 'alert': {
				const k = Math.min(1, p.age / 4), a = u > 0.7 ? (1 - u) / 0.3 : 1, sc = (0.6 + 0.4 * k) * (1 + 0.15 * Math.sin(p.age * 0.8));
				c.save(); c.globalAlpha = a;
				c.globalCompositeOperation = 'lighter'; glowS(sx, sy, 18 * sc, p.c2, 0.6);
				c.globalCompositeOperation = 'source-over';
				c.font = 'bold ' + (18 * sc | 0) + 'px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle';
				c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,0.7)'; c.strokeText('!', sx, sy); c.fillStyle = p.c; c.fillText('!', sx, sy);
				c.restore();
				break;
			}
			case 'slash': {
				let ox = sx, oy = sy;
				const reveal = Math.min(1, u / 0.35), fade = u < 0.35 ? 1 : 1 - (u - 0.35) / 0.65;
				const a0 = p.ang - p.arc / 2 * p.dir, sweep = p.arc * reveal * p.dir;
				const a1 = a0 + sweep, w = p.w * (0.6 + 0.4 * fade);
				const steps = 14;
				c.save(); c.globalCompositeOperation = 'lighter';
				// outer glow crescent
				for(let layer = 0; layer < 2; layer++){
					const ww = layer ? w * 0.42 : w, rr = p.r + (layer ? w * 0.18 : 0);
					c.beginPath();
					for(let i = 0; i <= steps; i++){
						const t = i / steps, a = a0 + sweep * t, taper = Math.sin(t * Math.PI) * 0.85 + 0.15 * t;
						const x = ox + Math.cos(a) * (rr + ww * 0.5 * taper), y = oy + Math.sin(a) * (rr + ww * 0.5 * taper);
						i ? c.lineTo(x, y) : c.moveTo(x, y);
					}
					for(let i = steps; i >= 0; i--){
						const t = i / steps, a = a0 + sweep * t, taper = Math.sin(t * Math.PI) * 0.85 + 0.15 * t;
						c.lineTo(ox + Math.cos(a) * (rr - ww * 0.5 * taper), oy + Math.sin(a) * (rr - ww * 0.5 * taper));
					}
					c.closePath();
					c.globalAlpha = fade * (layer ? 0.95 : 0.55);
					c.fillStyle = layer ? p.c2 : p.c;
					c.fill();
				}
				c.restore();
				// leading edge glint
				if(reveal < 1) { additive(() => glowS(ox + Math.cos(a1) * p.r, oy + Math.sin(a1) * p.r, w * 1.4, p.c2, 0.9, true)); }
				break;
			}
		}
	}
	const ADD_KINDS = { ember:1, glint:1, flash:1, gather:1, wisp:1, spark:1 };
	function drawLayer(back){
		bind();
		if(!cx || !parts.length) return;
		const c = cx;
		c.save();
		// normal-blend kinds first, then additive kinds in one pass
		for(let i = 0; i < parts.length; i++){
			const p = parts[i];
			if(!!p.back !== back || ADD_KINDS[p.k]) continue;
			if(!onScreen(p.x, p.y, (p.r1 || p.size || 10) * 3 + 40)) continue;
			drawPart(p);
		}
		c.globalCompositeOperation = 'lighter';
		for(let i = 0; i < parts.length; i++){
			const p = parts[i];
			if(!!p.back !== back || !ADD_KINDS[p.k]) continue;
			if(!onScreen(p.x, p.y, (p.size || 10) * 3 + 30)) continue;
			drawPart(p);
		}
		c.restore();
	}

	/* ---------------------------------------------------------- projectile bodies */
	// keeps a short position history on the object for trails
	function track(o, n){
		n = n || 10;
		let h = o._efxH;
		if(!h){ h = o._efxH = []; o._efxF = -1; }
		if(o._efxF === frame) return h;
		o._efxF = frame;
		h.unshift(o.x, o.y);
		if(h.length > n * 2) h.length = n * 2;
		return h;
	}
	function trail(h, r, el, opts){
		opts = opts || {};
		const P = pal(el), n = h.length / 2;
		if(n < 2) return;
		const len = opts.len || 1;
		const step = Q.q < 0.7 ? 2 : 1;
		if(opts.glows !== false) additive(() => {
			for(let i = n - 1; i >= 1; i -= step){
				const t = i / (n - 1);
				if(t > len) continue;
				const rr = r * (1 - t * 0.75) * (opts.width || 1);
				glow(h[i * 2], h[i * 2 + 1], rr * 2.1, t < 0.35 ? P.mid : P.outer, (1 - t) * (opts.alpha || 0.55));
			}
		});
		if(opts.ribbon !== false){
			const c = cx;
			c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; c.lineJoin = 'round';
			for(let pass = 0; pass < 2; pass++){
				c.beginPath();
				for(let i = 0; i < n; i++){ const x = h[i * 2] - camX, y = h[i * 2 + 1] - camY; i ? c.lineTo(x, y) : c.moveTo(x, y); }
				c.strokeStyle = pass ? rgba(P.core, 0.55) : rgba(P.mid, 0.35);
				c.lineWidth = pass ? r * 0.45 : r * 1.3;
				c.stroke();
			}
			c.restore();
		}
	}
	/* draws a projectile body of element el, radius r, at world x,y.
	   o: the projectile (for history/age), opts: {ang, trail:false, scale, spin} */
	function bolt(o, x, y, r, el, opts){
		opts = opts || {};
		bind();
		if(!cx || !onScreen(x, y, r * 4 + 60)) return;
		const P = pal(el), t = (o && o.age != null ? o.age : frame);
		const ang = opts.ang != null ? opts.ang : (o && (o.vx || o.vy) ? Math.atan2(o.vy, o.vx) : 0);
		const sx = x - camX, sy = y - camY, c = cx;
		// many bolts in flight at once: later ones get lighter trails, then a plain two-glow body
		const nb = ++Q.bolts, lite1 = nb > 20 + 20 * Q.q, lite2 = nb > 40 + 40 * Q.q;
		if(lite2 && P.style !== 'rock'){
			c.save(); c.globalCompositeOperation = 'lighter';
			glowS(sx, sy, r * 2.4, P.outer, 0.5);
			glowS(sx, sy, r * 1.1, P.mid, 0.95, true);
			glowS(sx, sy, r * 0.6, P.core, 1, true);
			c.restore();
			return;
		}
		if(o && opts.trail !== false){
			const h = track(o, Math.max(3, Math.round((opts.trailLen || 9) * (lite1 ? 0.5 : 1) * (Q.q < 0.7 ? 0.7 : 1))));
			trail(h, r, el, { ribbon: P.style !== 'rock' && P.style !== 'glob', alpha: opts.trailAlpha, glows: !lite1 });
		}
		// ambient particles from the body
		if(o && opts.motes !== false && !lite1 && (frame + ((o._efxSeed = o._efxSeed || (rnd() * 7 | 0)))) % (opts.moteEvery || 3) === 0) mote(el, x + (rnd() - 0.5) * r, y + (rnd() - 0.5) * r, -(o.vx || 0), -(o.vy || 0), Math.max(0.6, r / 12));
		c.save();
		switch(P.style){
			case 'flame': case 'magma': {
				c.globalCompositeOperation = 'lighter';
				glowS(sx, sy, r * 3.2, P.outer, 0.55);
				// flickering tongues swept back along the flight direction
				for(let i = 0; i < 5; i++){
					const k = i / 4, fl = Math.sin(t * 0.7 + i * 1.7) * 0.25;
					const bx = sx - Math.cos(ang) * r * (0.3 + k * 1.1) + Math.cos(ang + Math.PI / 2) * r * fl * k;
					const by = sy - Math.sin(ang) * r * (0.3 + k * 1.1) + Math.sin(ang + Math.PI / 2) * r * fl * k;
					glowS(bx, by, r * (1.5 - k * 0.6), k < 0.5 ? P.mid : P.outer, 0.75 - k * 0.3);
				}
				glowS(sx, sy, r * 1.25, P.mid, 0.95, true);
				glowS(sx, sy, r * 0.75, P.core, 1, true);
				if(P.style === 'magma'){
					c.globalCompositeOperation = 'source-over';
					c.globalAlpha = 0.55; c.fillStyle = P.dark;
					for(let i = 0; i < 3; i++){ const a = t * 0.05 + i * 2.1; c.beginPath(); c.arc(sx + Math.cos(a) * r * 0.55, sy + Math.sin(a) * r * 0.55, r * 0.28, 0, TAU); c.fill(); }
				}
				break;
			}
			case 'crystal': {
				c.globalCompositeOperation = 'lighter';
				glowS(sx, sy, r * 2.8, P.outer, 0.45);
				c.globalCompositeOperation = 'source-over';
				c.translate(sx, sy); c.rotate(ang + (opts.spin ? t * opts.spin : 0));
				const L = r * 1.7, W = r * 0.75;
				const g = c.createLinearGradient(-L, -W, L, W);
				g.addColorStop(0, rgba(P.outer, 0.9)); g.addColorStop(0.5, rgba(P.mid, 0.95)); g.addColorStop(1, rgba(P.core, 1));
				c.fillStyle = g;
				c.beginPath(); c.moveTo(L, 0); c.lineTo(L * 0.1, -W); c.lineTo(-L * 0.75, -W * 0.45); c.lineTo(-L * 0.9, 0); c.lineTo(-L * 0.75, W * 0.45); c.lineTo(L * 0.1, W); c.closePath(); c.fill();
				c.fillStyle = rgba(P.core, 0.85);
				c.beginPath(); c.moveTo(L, 0); c.lineTo(L * 0.1, -W); c.lineTo(-L * 0.2, -W * 0.1); c.closePath(); c.fill();
				c.strokeStyle = rgba(P.core, 0.9); c.lineWidth = 1;
				c.beginPath(); c.moveTo(L, 0); c.lineTo(-L * 0.9, 0); c.stroke();
				c.globalCompositeOperation = 'lighter';
				glowS(L * 0.75, 0, r * 0.7, '#ffffff', 0.6 + 0.4 * Math.sin(t * 0.4), true);
				break;
			}
			case 'rock': {
				const s = r * 1.45;
				c.translate(sx, sy); c.rotate(t * (opts.spin || 0.12));
				c.drawImage(rockSprite(el, (o && o._efxSeed) || 0), -s, -s, s * 2, s * 2);
				break;
			}
			case 'glob': {
				c.globalCompositeOperation = 'lighter';
				glowS(sx, sy, r * 2.4, P.outer, 0.35);
				c.globalCompositeOperation = 'source-over';
				c.translate(sx, sy); c.rotate(ang);
				const wob = Math.sin(t * 0.5) * 0.12, sp = Math.min(0.35, Math.hypot((o && o.vx) || 0, (o && o.vy) || 0) * 0.04);
				const g = c.createRadialGradient(-r * 0.2, -r * 0.35, r * 0.1, 0, 0, r * 1.2);
				g.addColorStop(0, P.core); g.addColorStop(0.35, P.mid); g.addColorStop(1, P.outer);
				c.fillStyle = g;
				c.beginPath(); c.ellipse(-r * sp * 0.6, 0, r * (1 + sp + wob), r * (1 - sp * 0.6 - wob), 0, 0, TAU); c.fill();
				c.fillStyle = rgba('#ffffff', 0.55);
				c.beginPath(); c.ellipse(r * 0.25, -r * 0.4, r * 0.28, r * 0.16, -0.4, 0, TAU); c.fill();
				break;
			}
			case 'thorn': {
				c.globalCompositeOperation = 'lighter';
				glowS(sx, sy, r * 2.3, P.outer, 0.35);
				c.globalCompositeOperation = 'source-over';
				c.translate(sx, sy); c.rotate(ang);
				const L = r * 2, W = r * 0.6;
				const g = c.createLinearGradient(0, -W, 0, W);
				g.addColorStop(0, P.mid); g.addColorStop(1, P.dark);
				c.fillStyle = g;
				c.beginPath(); c.moveTo(L, 0); c.quadraticCurveTo(0, -W, -L * 0.7, -W * 0.5); c.lineTo(-L * 0.5, 0); c.lineTo(-L * 0.7, W * 0.5); c.quadraticCurveTo(0, W, L, 0); c.fill();
				c.strokeStyle = rgba(P.core, 0.7); c.lineWidth = 1;
				c.beginPath(); c.moveTo(L * 0.95, 0); c.lineTo(-L * 0.4, 0); c.stroke();
				// barbs
				c.fillStyle = P.dark;
				for(let i = 0; i < 2; i++){ const bx = -L * 0.1 + i * L * 0.35; c.beginPath(); c.moveTo(bx, -W * 0.55); c.lineTo(bx - W * 0.7, -W * 1.2); c.lineTo(bx - W * 0.2, -W * 0.4); c.fill(); c.beginPath(); c.moveTo(bx, W * 0.55); c.lineTo(bx - W * 0.7, W * 1.2); c.lineTo(bx - W * 0.2, W * 0.4); c.fill(); }
				break;
			}
			case 'spore': {
				c.globalCompositeOperation = 'lighter';
				glowS(sx, sy, r * 2.6, P.outer, 0.4);
				c.globalCompositeOperation = 'source-over';
				c.translate(sx, sy); c.rotate(t * 0.05);
				for(let i = 0; i < 6; i++){
					const a = i / 6 * TAU;
					c.fillStyle = rgba(i % 2 ? P.mid : P.outer, 0.8);
					c.beginPath(); c.arc(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.5, 0, TAU); c.fill();
				}
				c.fillStyle = P.core; c.beginPath(); c.arc(0, 0, r * 0.45, 0, TAU); c.fill();
				break;
			}
			case 'void': {
				c.globalCompositeOperation = 'lighter';
				glowS(sx, sy, r * 3, P.outer, 0.6);
				c.globalCompositeOperation = 'source-over';
				const g = c.createRadialGradient(sx, sy, 0, sx, sy, r * 1.1);
				g.addColorStop(0, P.dark); g.addColorStop(0.65, P.dark); g.addColorStop(0.85, P.mid); g.addColorStop(1, rgba(P.mid, 0));
				c.fillStyle = g; c.beginPath(); c.arc(sx, sy, r * 1.1, 0, TAU); c.fill();
				c.globalCompositeOperation = 'lighter';
				c.strokeStyle = rgba(P.core, 0.75); c.lineWidth = Math.max(1, r * 0.12);
				for(let i = 0; i < 2; i++){ const a = t * 0.18 + i * Math.PI; c.beginPath(); c.arc(sx, sy, r * 0.82, a, a + 1.4); c.stroke(); }
				break;
			}
			case 'spark': {
				c.globalCompositeOperation = 'lighter';
				glowS(sx, sy, r * 3, P.outer, 0.6);
				glowS(sx, sy, r * 1.3, P.mid, 0.9, true);
				glowS(sx, sy, r * 0.7, P.core, 1, true);
				c.strokeStyle = rgba(P.core, 0.9); c.lineWidth = 1.4; c.lineCap = 'round';
				for(let i = 0; i < 3; i++){
					const a = rnd() * TAU, l = r * (1.3 + rnd() * 1.2);
					c.beginPath(); c.moveTo(sx, sy);
					c.lineTo(sx + Math.cos(a + 0.4) * l * 0.5, sy + Math.sin(a + 0.4) * l * 0.5);
					c.lineTo(sx + Math.cos(a) * l, sy + Math.sin(a) * l);
					c.stroke();
				}
				break;
			}
			case 'wind': {
				c.globalCompositeOperation = 'lighter';
				c.translate(sx, sy); c.rotate(ang);
				c.lineCap = 'round';
				for(let i = 0; i < 3; i++){
					const rr = r * (0.7 + i * 0.35), a0 = t * 0.35 + i * 2.1;
					c.strokeStyle = rgba(i ? P.mid : P.core, 0.75 - i * 0.18); c.lineWidth = Math.max(1, r * (0.28 - i * 0.06));
					c.beginPath(); c.ellipse(0, 0, rr * 1.35, rr * 0.75, 0, a0, a0 + 3.6); c.stroke();
				}
				glowS(0, 0, r * 1.6, P.outer, 0.35);
				break;
			}
			default: { // orb
				c.globalCompositeOperation = 'lighter';
				glowS(sx, sy, r * 3.1, P.outer, 0.55 + 0.1 * Math.sin(t * 0.3));
				glowS(sx, sy, r * 1.4, P.mid, 0.95, true);
				glowS(sx, sy, r * 0.7, P.core, 1, true);
			}
		}
		c.restore();
	}

	/* ---------------------------------------------------------- beams, lightning, strips */
	function beam(x0, y0, x1, y1, w, el, opts){
		opts = opts || {};
		bind();
		if(!cx) return;
		const P = pal(el), c = cx, a = opts.alpha == null ? 1 : opts.alpha, t = frame;
		const sx0 = x0 - camX, sy0 = y0 - camY, sx1 = x1 - camX, sy1 = y1 - camY;
		const len = Math.hypot(sx1 - sx0, sy1 - sy0), ang = Math.atan2(sy1 - sy0, sx1 - sx0);
		if(len < 1) return;
		c.save(); c.translate(sx0, sy0); c.rotate(ang);
		c.globalCompositeOperation = 'lighter';
		const jw = w * (1 + 0.12 * Math.sin(t * 0.9));
		const g = c.createLinearGradient(0, -jw * 1.3, 0, jw * 1.3);
		g.addColorStop(0, rgba(P.outer, 0)); g.addColorStop(0.3, rgba(P.outer, 0.45 * a)); g.addColorStop(0.5, rgba(P.mid, 0.8 * a)); g.addColorStop(0.7, rgba(P.outer, 0.45 * a)); g.addColorStop(1, rgba(P.outer, 0));
		c.fillStyle = g; c.fillRect(0, -jw * 1.3, len, jw * 2.6);
		c.fillStyle = rgba(P.core, 0.9 * a); c.fillRect(0, -jw * 0.18, len, jw * 0.36);
		// travelling energy knots
		for(let i = 0; i < Math.min(10, len / 60); i++){
			const k = ((t * (opts.speed || 6) + i * 61) % len);
			glowS(k, Math.sin(t * 0.3 + i) * jw * 0.3, jw * 0.9, P.mid, 0.5 * a);
		}
		glowS(0, 0, jw * 2.4, P.mid, 0.9 * a, true);
		glowS(len, 0, jw * 2.1, P.mid, 0.8 * a, true);
		c.restore();
	}
	function zapPath(x0, y0, x1, y1, seg, jag, seed){
		const pts = [x0, y0], dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
		let s = seed || 1;
		const R = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
		for(let i = 1; i < seg; i++){ const k = i / seg, o = (R() - 0.5) * jag * Math.sin(k * Math.PI) * 2; pts.push(x0 + dx * k + nx * o, y0 + dy * k + ny * o); }
		pts.push(x1, y1);
		return pts;
	}
	function lightning(x0, y0, x1, y1, el, opts){
		opts = opts || {};
		bind();
		if(!cx) return;
		const P = pal(el), c = cx, w = opts.width || 3, a = opts.alpha == null ? 1 : opts.alpha;
		const L = Math.hypot(x1 - x0, y1 - y0), seg = Math.max(4, Math.min(18, L / 22 | 0));
		const pts = zapPath(x0 - camX, y0 - camY, x1 - camX, y1 - camY, seg, opts.jag || Math.min(40, L * 0.12), opts.seed || ((frame / 3 | 0) * 7 + 3));
		c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; c.lineJoin = 'round';
		const stroke = (lw, col) => { c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); for(let i = 0; i < pts.length; i += 2) i ? c.lineTo(pts[i], pts[i + 1]) : c.moveTo(pts[i], pts[i + 1]); c.stroke(); };
		stroke(w * 4, rgba(P.outer, 0.25 * a)); stroke(w * 1.8, rgba(P.mid, 0.7 * a)); stroke(w * 0.7, rgba(P.core, a));
		if(opts.branches !== false){
			for(let b = 0; b < 2; b++){
				const i = 2 + ((opts.seed || frame) * (b + 3) % Math.max(1, (pts.length / 2 - 3))) * 2 | 0;
				if(i + 1 >= pts.length) continue;
				const bx = pts[i], by = pts[i + 1], ba = Math.atan2(y1 - y0, x1 - x0) + (b ? 0.8 : -0.8), bl = L * 0.18;
				const bp = zapPath(bx, by, bx + Math.cos(ba) * bl, by + Math.sin(ba) * bl, 4, bl * 0.3, i * 13 + frame);
				c.strokeStyle = rgba(P.mid, 0.55 * a); c.lineWidth = w * 0.8;
				c.beginPath(); for(let k = 0; k < bp.length; k += 2) k ? c.lineTo(bp[k], bp[k + 1]) : c.moveTo(bp[k], bp[k + 1]); c.stroke();
			}
		}
		c.restore();
	}
	// row of flame / energy tongues along the ground between x0..x1 at floor y
	function flameStrip(x0, x1, y, el, a, opts){
		opts = opts || {};
		bind();
		if(!cx || a <= 0.01) return;
		if(x1 < x0){ const s = x0; x0 = x1; x1 = s; }
		const P = pal(el), c = cx, H = opts.height || 26, step = opts.step || 13;
		if(x1 - camX < -40 || x0 - camX > VW + 40) return;
		c.save(); c.globalCompositeOperation = 'lighter';
		const sy = y - camY;
		// base heat line
		const g = c.createLinearGradient(0, sy - 8, 0, sy + 4);
		g.addColorStop(0, rgba(P.outer, 0)); g.addColorStop(0.6, rgba(P.outer, 0.55 * a)); g.addColorStop(1, rgba(P.mid, 0.7 * a));
		c.fillStyle = g; c.fillRect(x0 - camX, sy - 8, x1 - x0, 12);
		for(let x = x0 + step * 0.5; x < x1; x += step){
			const ph = x * 0.13 + frame * 0.21, h = H * (0.55 + 0.45 * Math.sin(ph) * Math.sin(ph * 0.37 + 1.3)) * (opts.grow || 1);
			const sx = x - camX;
			if(sx < -30 || sx > VW + 30) continue;
			c.globalAlpha = a;
			c.drawImage(glowSprite(P.outer), sx - step * 0.9, sy - h * 1.15, step * 1.8, h * 1.3);
			c.drawImage(glowSprite(P.mid, true), sx - step * 0.5, sy - h * 0.75, step, h * 0.85);
			if(((x / step) | 0) % 2 === 0) c.drawImage(glowSprite(P.core, true), sx - step * 0.28, sy - h * 0.4, step * 0.56, h * 0.42);
		}
		c.restore();
		if(opts.emit !== false && rnd() < 0.35 * a * (x1 - x0) / 200) mote(el, x0 + rnd() * (x1 - x0), y - 6, 0, -1, 1);
	}
	// glowing crack polyline (pts world-space [x,y,x,y,...] or [{x,y}]), progress 0..1 of length shown
	function crack(pts, el, opts){
		opts = opts || {};
		bind();
		if(!cx || !pts || pts.length < 2) return;
		const P = pal(el), c = cx;
		const flat = typeof pts[0] === 'number';
		const n = flat ? pts.length / 2 : pts.length, show = Math.max(2, Math.ceil(n * (opts.progress == null ? 1 : opts.progress)));
		const X = i => (flat ? pts[i * 2] : pts[i].x) - camX, Y = i => (flat ? pts[i * 2 + 1] : pts[i].y) - camY;
		const heat = opts.heat == null ? 1 : opts.heat;
		c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
		c.strokeStyle = rgba(P.dark, 0.85); c.lineWidth = (opts.width || 4) + 2;
		c.beginPath(); for(let i = 0; i < show; i++) i ? c.lineTo(X(i), Y(i)) : c.moveTo(X(i), Y(i)); c.stroke();
		if(heat > 0){
			c.globalCompositeOperation = 'lighter';
			c.strokeStyle = rgba(P.outer, 0.5 * heat); c.lineWidth = (opts.width || 4) * 2.6; c.stroke();
			c.strokeStyle = rgba(P.mid, 0.9 * heat); c.lineWidth = (opts.width || 4) * 0.9; c.stroke();
			c.strokeStyle = rgba(P.core, 0.8 * heat); c.lineWidth = Math.max(1, (opts.width || 4) * 0.35); c.stroke();
		}
		c.restore();
	}

	/* ---------------------------------------------------------- telegraphs */
	// prog 0..1 = how close the hit is. Circles on the ground can be flattened (flat < 1).
	function warnCircle(x, y, r, prog, el, opts){
		opts = opts || {};
		bind();
		if(!cx) return;
		const P = pal(el), c = cx, sx = x - camX, sy = y - camY, flat = opts.flat || 1, a = (opts.alpha == null ? 1 : opts.alpha) * Math.min(1, 170 / Math.max(1, r));
		if(!onScreen(x, y, r + 40) && r < 400) return;
		const p = clamp(prog, 0, 1), pulse = 0.5 + 0.5 * Math.sin(frame * (0.25 + p * 0.5));
		c.save();
		c.translate(sx, sy); c.scale(1, flat);
		const g = c.createRadialGradient(0, 0, 0, 0, 0, r);
		g.addColorStop(0, rgba(P.outer, 0.04 * a)); g.addColorStop(0.75, rgba(P.outer, (0.1 + 0.12 * p) * a)); g.addColorStop(1, rgba(P.mid, (0.22 + 0.2 * p) * a));
		c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
		// filling core shows the timing
		c.fillStyle = rgba(P.mid, (0.16 + 0.14 * p) * a);
		c.beginPath(); c.arc(0, 0, r * p, 0, TAU); c.fill();
		c.lineWidth = 2 / Math.max(0.3, flat) * 0.6 + 1.5;
		c.strokeStyle = rgba(P.core, (0.45 + 0.45 * pulse * p) * a);
		c.setLineDash([10, 7]); c.lineDashOffset = -frame * 0.8;
		c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke();
		c.setLineDash([]);
		c.strokeStyle = rgba(P.mid, 0.7 * a); c.lineWidth = 1.5;
		c.beginPath(); c.arc(0, 0, r * p, 0, TAU); c.stroke();
		c.restore();
	}
	// line / lane telegraph from (x0,y0) to (x1,y1), width w
	function warnLine(x0, y0, x1, y1, w, prog, el, opts){
		opts = opts || {};
		bind();
		if(!cx) return;
		const P = pal(el), c = cx, p = clamp(prog, 0, 1), a = opts.alpha == null ? 1 : opts.alpha;
		const sx = x0 - camX, sy = y0 - camY, L = Math.hypot(x1 - x0, y1 - y0), ang = Math.atan2(y1 - y0, x1 - x0);
		c.save(); c.translate(sx, sy); c.rotate(ang);
		c.fillStyle = rgba(P.outer, (0.1 + 0.08 * p) * a); c.fillRect(0, -w / 2, L, w);
		const g = c.createLinearGradient(0, 0, L * p, 0);
		g.addColorStop(0, rgba(P.mid, 0.05 * a)); g.addColorStop(1, rgba(P.mid, 0.32 * a));
		c.fillStyle = g; c.fillRect(0, -w / 2, L * p, w);
		c.strokeStyle = rgba(P.core, (0.35 + 0.4 * p) * a); c.lineWidth = 1.5; c.setLineDash([12, 8]); c.lineDashOffset = -frame;
		c.beginPath(); c.moveTo(0, -w / 2); c.lineTo(L, -w / 2); c.moveTo(0, w / 2); c.lineTo(L, w / 2); c.stroke();
		c.setLineDash([]);
		// chevrons travelling toward the end
		c.strokeStyle = rgba(P.core, 0.5 * a); c.lineWidth = 2;
		for(let i = 0; i < Math.min(8, L / 70); i++){
			const k = (i * 70 + frame * 2.5) % L, s = Math.min(w * 0.3, 10);
			c.beginPath(); c.moveTo(k - s, -s); c.lineTo(k, 0); c.lineTo(k - s, s); c.stroke();
		}
		c.restore();
	}
	function warnRect(x, y, w, h, prog, el, opts){
		opts = opts || {};
		bind();
		if(!cx) return;
		const P = pal(el), c = cx, p = clamp(prog, 0, 1), a = opts.alpha == null ? 1 : opts.alpha, sx = x - camX, sy = y - camY;
		c.save();
		c.fillStyle = rgba(P.outer, (0.1 + 0.1 * p) * a); c.fillRect(sx, sy, w, h);
		// fill rises from the floor
		const fh = h * p;
		const g = c.createLinearGradient(0, sy + h, 0, sy + h - fh);
		g.addColorStop(0, rgba(P.mid, 0.4 * a)); g.addColorStop(1, rgba(P.mid, 0.08 * a));
		c.fillStyle = g; c.fillRect(sx, sy + h - fh, w, fh);
		c.strokeStyle = rgba(P.core, (0.4 + 0.45 * p) * a); c.lineWidth = 1.5; c.setLineDash([10, 6]); c.lineDashOffset = -frame;
		c.strokeRect(sx, sy, w, h);
		c.restore();
	}
	// a "!" that hangs over a spot for a few frames (safe to call from update code)
	function alertFX(x, y, el, life){ const P = pal(el); return add({ k: 'alert', x, y, c: P.core, c2: P.outer, max: life || 24, follow: null }); }
	// little "!" danger glyph over an enemy during a wind-up
	function alert(x, y, prog, el){
		bind();
		if(!cx) return;
		const P = pal(el), c = cx, sx = x - camX, sy = y - camY, s = 1 + 0.25 * Math.sin(frame * 0.6);
		c.save();
		c.globalCompositeOperation = 'lighter';
		glowS(sx, sy, 16 * s, P.outer, 0.6);
		c.globalCompositeOperation = 'source-over';
		c.fillStyle = P.core; c.strokeStyle = P.dark; c.lineWidth = 3;
		c.font = 'bold ' + (16 * s | 0) + 'px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle';
		c.strokeText('!', sx, sy); c.fillText('!', sx, sy);
		c.restore();
	}



	/* ---------------------------------------------------------- shapes */
	// a spike / pillar standing on the ground at (x, y=floor), h tall, w wide at the base
	function spike(x, y, h, w, el, opts){
		opts = opts || {};
		bind();
		if(!cx || h < 1) return;
		const P = pal(el), c = cx, sx = x - camX, sy = y - camY, a = opts.alpha == null ? 1 : opts.alpha;
		if(sx < -w - 40 || sx > VW + w + 40) return;
		const lean = (opts.lean || 0) * h, crystal = P.style === 'crystal' || P.style === 'void';
		c.save(); c.globalAlpha = a;
		if(opts.down){ c.translate(0, sy * 2); c.scale(1, -1); }
		if(crystal){ c.globalCompositeOperation = 'lighter'; glowS(sx + lean * 0.5, sy - h * 0.45, Math.max(w, h * 0.45), P.outer, 0.25); c.globalCompositeOperation = 'source-over'; }
		const g = c.createLinearGradient(sx - w / 2, 0, sx + w / 2, 0);
		if(crystal){ g.addColorStop(0, rgba(P.outer, 0.85)); g.addColorStop(0.45, rgba(P.mid, 0.92)); g.addColorStop(0.55, rgba(P.core, 0.95)); g.addColorStop(1, rgba(P.outer, 0.8)); }
		else { g.addColorStop(0, P.dark); g.addColorStop(0.4, P.mid); g.addColorStop(0.6, P.outer); g.addColorStop(1, P.dark); }
		c.fillStyle = g;
		c.beginPath(); c.moveTo(sx - w / 2, sy); c.lineTo(sx + lean - w * 0.08, sy - h * 0.86); c.lineTo(sx + lean, sy - h); c.lineTo(sx + lean + w * 0.08, sy - h * 0.86); c.lineTo(sx + w / 2, sy); c.closePath(); c.fill();
		c.strokeStyle = rgba(crystal ? P.core : P.dark, crystal ? 0.9 : 0.8); c.lineWidth = 1.2;
		c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + lean, sy - h); c.stroke();
		if(crystal){ c.strokeStyle = rgba('#ffffff', 0.7); c.beginPath(); c.moveTo(sx - w * 0.25, sy - h * 0.15); c.lineTo(sx + lean - w * 0.04, sy - h * 0.8); c.stroke(); }
		c.restore();
	}
	// a translucent spectral figure (clones, after-images, decoys)
	function ghost(x, y, w, h, el, a, t){
		bind();
		if(!cx || a <= 0.02) return;
		const P = pal(el), sx = x - camX, sy = y - camY, c = cx;
		t = t || frame;
		c.save(); c.globalCompositeOperation = 'lighter';
		glowS(sx, sy, Math.max(w, h) * 0.9, P.outer, 0.35 * a);
		for(let i = 0; i < 5; i++){
			const k = i / 4, wob = Math.sin(t * 0.15 + i * 1.3) * w * 0.12;
			glowS(sx + wob, sy - h * 0.35 + k * h * 0.75, w * (0.55 - k * 0.18), k < 0.3 ? P.core : P.mid, (0.6 - k * 0.3) * a);
		}
		glowS(sx, sy - h * 0.36, w * 0.32, '#ffffff', 0.55 * a, true);
		c.restore();
	}

	/* ---------------------------------------------------------- colour → element guess */
	function elFromColor(css){
		if(!css) return 'fire';
		let r, g, b;
		const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(css);
		if(m){ r = +m[1]; g = +m[2]; b = +m[3]; }
		else if(css[0] === '#'){ const c = rgb(css); r = c[0]; g = c[1]; b = c[2]; }
		else return 'fire';
		const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
		if(d < 28) return mx > 170 ? 'light' : 'earth';
		let h;
		if(mx === r) h = ((g - b) / d) % 6; else if(mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
		h *= 60; if(h < 0) h += 360;
		const sat = d / mx;
		if(h >= 15 && h < 52 && mx < 215 && sat < 0.78) return 'earth';
		if(h < 18 || h >= 340) return sat > 0.5 ? 'fire' : 'blood';
		if(h < 40) return sat < 0.55 && mx < 190 ? 'earth' : 'fire';
		if(h < 62) return sat < 0.6 ? 'sand' : 'light';
		if(h < 100) return 'poison';
		if(h < 160) return 'nature';
		if(h < 200) return 'ice';
		if(h < 245) return (mn > 110 ? 'ice' : 'water');
		if(h < 300) return (mn > 100 && mx > 200 ? 'crystal' : 'shadow');
		return 'crystal';
	}
	// draws a bossTelegraphs entry that a basic enemy tagged with .efx
	function drawTelegraph(tel){
		const el = tel.efx === true ? (tel._efxEl || (tel._efxEl = elFromColor(tel.color))) : tel.efx;
		const prog = clamp(tel.timer / Math.max(1, tel.duration), 0, 1);
		if(tel.type === 'circle'){
			warnCircle(tel.x + tel.w / 2, tel.y + tel.h / 2, Math.max(8, tel.radius), prog, el);
		} else if(tel.type === 'line'){
			warnLine(tel.x, tel.y, tel.x + tel.w, tel.y, tel.h || 8, prog, el);
		} else {
			warnRect(tel.x, tel.y, tel.w, tel.h, prog, el);
			// tall pillars get a glowing floor mark too
			if(tel.h > tel.w * 1.3){ bind(); additive(() => glow(tel.x + tel.w / 2, tel.y + tel.h, tel.w * (0.8 + prog * 0.6), pal(el).mid, 0.25 + prog * 0.4)); }
		}
		if(tel.label){
			bind();
			const c = cx; c.save(); c.globalAlpha = 0.5 + prog * 0.5; c.font = 'bold 12px Arial'; c.textAlign = 'center';
			c.fillStyle = pal(el).core; c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 3;
			c.strokeText(tel.label, tel.x + tel.w / 2 - camX, tel.y - 8 - camY); c.fillText(tel.label, tel.x + tel.w / 2 - camX, tel.y - 8 - camY);
			c.restore();
		}
	}

	// legacy kit "spark" calls pass an {r,g,b}; route them through EFX with a guessed element
	function sparkRGB(x, y, n, col, fallback){
		const el = col ? elFromColor('rgb(' + col.r + ',' + col.g + ',' + col.b + ')') : (fallback || 'earth');
		const k = Math.min(n || 10, 20), P = pal(el);
		if(col && col.r + col.g + col.b < 250){ smoke(x, y, Math.max(1, k / 4 | 0), { size: 10, c: '#2a241e', a: 0.5 }); return; }
		emit(el, x, y, Math.ceil(k * 0.5), { speed: 1.6 });
		if(P.style === 'rock' || P.style === 'glob') debris(el, x, y, Math.ceil(k / 4), { speed: 4, scale: 0.7 });
		else sparks(el, x, y, Math.ceil(k * 0.4), { speed: 4.5 });
	}
	/* ---------------------------------------------------------- fair play
	   Three small rules that keep a hazard from hurting you before you could possibly see it. All three still punish you
	   if you stand there, and none of them change an attack's damage.
	   1. ARMING (armed): a zone or burst a ranged enemy drops on you cannot hurt for ARM frames after the attack started.
	      It is already drawn on the ground, plus a warning ring, so you can step out. Enemies in melee reach are exempt.
	   2. SPAWN-ON-PLAYER projectiles (spawnEnemyProj): same idea for a projectile that is born on top of you.
	   3. WIND-UP (cast): the rushes, leaps and strikes in WINDUP get a short, visible charge-up before they start. */
	const ARM = 36, MELEE = 210;
	let _warnSeen = Object.create(null), _warnTick = -1;
	function warnAt(x, y, r, frames, key){
		if(typeof window.efxTelegraph !== 'function' || typeof _simTick === 'undefined') return;
		if(_simTick - _warnTick > 90) _warnSeen = Object.create(null);
		_warnTick = _simTick;
		if(_warnSeen[key]) return; _warnSeen[key] = 1;
		const rr = Math.max(30, Math.min(300, r || 60)), T = window.efxTelegraph(x - rr, y - rr, rr * 2, rr * 2, frames, 'rgba(255,170,80,0.35)', 'circle', '', null);
		if(T){ T.radius = rr; T.w = rr * 2; T.h = rr * 2; T.x = x - rr; T.y = y - rr; }
	}
	function armed(en, x, y, r){
		if(!en || en._castTick == null || typeof _simTick === 'undefined' || typeof player === 'undefined') return false;
		const age = _simTick - en._castTick;
		if(age < 0 || age >= ARM) return false;
		const px = player.x + player.w / 2, py = player.y + player.h / 2;
		if(Math.hypot(en.x + en.w / 2 - px, en.y + en.h / 2 - py) < MELEE) return false;      // melee reach: a real strike, no grace
		warnAt(x, y, r, ARM - age, (x / 60 | 0) + ',' + (y / 60 | 0) + ',' + en._castTick);
		return true;
	}
	// a projectile that is created right on top of the player (not fired from an enemy standing next to them)
	function armProjectile(p){
		if(!p || typeof player === 'undefined' || typeof enemies === 'undefined' || typeof _simTick === 'undefined') return;
		const px = player.x + player.w / 2, py = player.y + player.h / 2;
		if(Math.hypot(p.x - px, p.y - py) > 190) return;
		let near = null, nd = 1e9;
		for(let i = 0; i < enemies.length; i++){
			const e = enemies[i]; if(!e || e.dead) continue;
			const d = Math.hypot(e.x + e.w / 2 - p.x, e.y + e.h / 2 - p.y);
			if(d < nd){ nd = d; near = e; }
		}
		if(near && (near.typeDef && near.typeDef.isBoss || (Math.hypot(near.x + near.w / 2 - px, near.y + near.h / 2 - py) < MELEE))) return;      // a boss's own attack, or a close-quarters shot
		p._armUntil = _simTick + 28;
		warnAt(p.x, p.y, Math.max(34, (p.width || 20) * 0.9), 28, 'p' + (p.x / 60 | 0) + ',' + (p.y / 60 | 0) + ',' + _simTick);
	}
	// attacks that rush, leap or strike from range with no tell: frames of charge-up before they start
	const WINDUP = {
		castBeetleEmberRoll: 24, castBarkBarkRoll: 24, castBarkRootCharge: 24, castDroneDive: 22, castDarkWolfShadowDash: 20, castDarkWolfBite: 16,
		castMagmaRoll: 24, castScarabCrystalCharge: 24, castEelSnapTurn: 20, castEelBreakingCharge: 26, castEelFrostLoop: 22, castImpLeap: 22,
		castWolfThornPounce: 22, castBabyFrozenDive: 26, castRevenantAshenStrike: 20, castRevenantLastEmber: 22, castRevenantAshStep: 20,
		castSwarmBite: 18, castMimicAvalancheFeint: 20, castMimicFrozenEcho: 20, castVenomousFang: 20, castSentinelAssemblyStrike: 24,
		castWrappingBinds: 22, castVineThornWheel: 20, castVineTunnel: 24, castWispWispFlare: 22, castSylphCycloneSpin: 20, castMothPollenCloud: 20,
		castMothFlutterBurst: 16, castMothMigration: 16, castFireSpit: 16, castDroneSparkMine: 18, castLeechSiphonBurst: 18, castLeechMoltenSplit: 18,
		castSpiderWebMaze: 20, castCoralGarden: 20, castGolemGravityGrip: 22, castCrystalShardRain: 18, castDarkVoidWhip: 18, castSylphAirSlash: 16,
		castParaParasiteGrowth: 20, castParaRootPulse: 20, castHuntingCircle: 20, castWolfHuntingCircle: 20, castVenomSpit: 14
	};
	// call the attack now, or after its wind-up; returns true when it started now
	function cast(en, fn, name){
		const W = WINDUP[name];
		if(!W || en._windup || typeof player === 'undefined'){ en._castTick = _simTick; fn(en); return true; }
		const px = player.x + player.w / 2, py = player.y + player.h / 2, ex = en.x + en.w / 2, ey = en.y + en.h / 2;
		if(Math.hypot(ex - px, ey - py) < 120){ en._castTick = _simTick; fn(en); return true; }      // already in your face: no wind-up
		en._windup = { fn, t: W, max: W };
		const el = elFromColor(en.typeDef && en.typeDef.color2 || en.typeDef && en.typeDef.color || '#ffaa55');
		charge(ex, ey, el, 60 + (en.w || 40) * 0.4, 12, W);
		alertFX(ex, en.y - 14, el, W);
		return false;
	}
	function windupTick(en){
		const w = en._windup; if(!w) return;
		if(en.dead || en.stunTimer > 0){ en._windup = null; return; }
		if(--w.t <= 0){ en._windup = null; en._castTick = _simTick; try { w.fn(en); } catch(e){} }
		else if(w.t % 6 === 0){
			const el = elFromColor(en.typeDef && en.typeDef.color2 || en.typeDef && en.typeDef.color || '#ffaa55');
			charge(en.x + en.w / 2, en.y + en.h / 2, el, 46 + w.t, 3, 14);
		}
	}
	const api = {
		armed, armProjectile, cast, windupTick, warnAt, WINDUP, EL, pal, rgba, rgb, glow, glowS, additive, bind,
		add, mote, emit, sparks, debris, smoke, flash, ring, groundWave, decal, slash, charge, burst, hit,
		bolt, trail, track, beam, lightning, flameStrip, crack, spike, ghost,
		warnCircle, warnLine, warnRect, alert, alertFX, elFromColor, drawTelegraph, sparkRGB,
		update, drawBack(){ drawLayer(true); }, drawFront(){ drawLayer(false); },
		clear(){ parts.length = 0; },
		get count(){ return parts.length; },
		get quality(){ return Q.q; }, set quality(v){ Q.q = Math.max(0.35, Math.min(1, +v || 1)); },
		get _parts(){ return parts; },
		get frame(){ return frame; },
		glowSprite, smokeSprite, rockSprite
	};
	if(typeof window !== 'undefined'){
		window.EFX = api;
		// basic-enemy kits call this instead of spawnTelegraph so the warning is drawn by EFX
		window.efxTelegraph = function(x, y, w, h, dur, color, type, label, el){
			if(typeof spawnTelegraph !== 'function') return null;
			spawnTelegraph(x, y, w, h, dur, color, type, label);
			const T = (typeof bossTelegraphs !== 'undefined') ? bossTelegraphs[bossTelegraphs.length - 1] : null;
			if(T) T.efx = el || true;
			return T;
		};
	}
	if(typeof module !== 'undefined') module.exports = api;
})();
