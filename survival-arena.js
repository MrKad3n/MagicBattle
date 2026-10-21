/* =====================================================================
   SURVIVAL ARENA — "The Starfall Sanctum"
   ---------------------------------------------------------------------
   A ruined temple floor on a drifting shard of the old world, open to a
   night sky of aurora and falling stars. Slightly smaller than the Grand
   Colosseum (5200 wide against 6000, 4600 of it standable).

   • Geometry is plain platforms (solid floor + walls + a sealed ceiling, three
     tiers of one-way ledges) so every enemy, boss kit and player system that
     already understands open-sky maps works unchanged.
   • Everything is painted procedurally, once, into cached canvases.
   • Nothing here is dynamic gameplay: the arena never changes. Boss fights that
     used to rewrite their arena (shatter it, throw platforms, swap rooms) are
     adapted by survival-mode.js so they play inside this one fixed room.
   ===================================================================== */
(function(root){
	'use strict';

	const W = 5200, H = 2400, GROUND = 2000;
	const WALL_L = { x: 140, w: 160 }, WALL_R = { x: 4900, w: 160 };
	const LEFT = WALL_L.x + WALL_L.w, RIGHT = WALL_R.x;           // 300 … 4900 standable
	const CEIL = 640;                                              // sealed sky: flyers cannot leave the picture
	const MID = (LEFT + RIGHT) / 2;                                // 2600

	/* ---------- geometry ---------- */
	const SOLIDS = [
		{ x: WALL_L.x, y: 0, w: WALL_L.w, h: H, mat: 'wall', wall: true },
		{ x: WALL_R.x, y: 0, w: WALL_R.w, h: H, mat: 'wall', wall: true },
		{ x: LEFT, y: GROUND, w: RIGHT - LEFT, h: 400, mat: 'floor', ground: true },
		{ x: LEFT, y: CEIL, w: RIGHT - LEFT, h: 40, mat: 'sky', invisible: true, ceiling: true },
	];
	// three tiers of ledges, mirrored around the middle, plus a high centre span
	const LEDGES = [
		{ x: 560,  y: 1760, w: 300, mat: 'slab' }, { x: 4340, y: 1760, w: 300, mat: 'slab' },
		{ x: 1280, y: 1720, w: 260, mat: 'slab' }, { x: 3660, y: 1720, w: 260, mat: 'slab' },
		{ x: 880,  y: 1510, w: 280, mat: 'slab' }, { x: 4040, y: 1510, w: 280, mat: 'slab' },
		{ x: 2260, y: 1300, w: 680, mat: 'slab', grand: true },
	];
	function platforms(){
		const out = [];
		for(const s of SOLIDS) out.push(Object.assign({ _surv: true }, s));
		for(const l of LEDGES) out.push(Object.assign({ _surv: true, oneway: true, h: 22 }, l));
		return out;
	}

	const CONFIG = {
		name: 'Survival', worldW: W, worldH: H, groundY: GROUND, groundThick: 60,
		bgColor: '#120c24', bgColor2: '#2a1850',
		playerStart: { x: MID - 19, y: GROUND - 62 },
		infiniteMana: false, platforms: [],
	};
	const BOUNDS = { left: LEFT, right: RIGHT, floor: GROUND, ceil: CEIL + 40, mid: MID, w: W, h: H };

	/* ---------- utils ---------- */
	const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
	function rng(seed){ let s = (seed >>> 0) || 1; return function(){ s = Math.imul(s ^ (s >>> 15), 2246822507); s = Math.imul(s ^ (s >>> 13), 3266489909); s ^= s >>> 16; return (s >>> 0) / 4294967296; }; }
	function mkCanvas(w, h){ const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
	const now = () => performance.now();

	const S = { pieces: null, layers: null, layerKey: '', parts: [], flash: 0, camInit: false, last: now(), tint: null };

	/* ---------- painted pieces ---------- */
	function shade(g, x, y, w, h, a, b){ const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(x, y, w, h); }

	function paintFloor(p){
		const r = rng(p.x * 3 + 17), pad = 30, top = 40, bodyH = 420;
		const cv = mkCanvas(p.w + pad * 2, top + bodyH + 20), g = cv.getContext('2d'), X = pad, Y = top;
		shade(g, X, Y, p.w, bodyH, '#2c2546', '#0b0816');
		// brick courses, staggered
		for(let row = 0, y = Y + 6; y < Y + bodyH; row++, y += 52){
			g.fillStyle = 'rgba(0,0,0,0.38)'; g.fillRect(X, y + 46, p.w, 3);
			g.fillStyle = 'rgba(180,160,255,0.06)'; g.fillRect(X, y, p.w, 2);
			for(let x = X + (row % 2 ? 60 : 0); x < X + p.w; x += 120){ g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x, y, 3, 46); }
		}
		// speckle + chips
		for(let k = 0; k < p.w / 6; k++){ g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.12)'; g.fillRect(X + r() * p.w, Y + 14 + r() * (bodyH - 20), 2 + r() * 4, 1 + r() * 3); }
		// lit lip
		shade(g, X, Y, p.w, 16, '#7a6cb4', '#3d3470');
		g.fillStyle = 'rgba(225,215,255,0.65)'; g.fillRect(X, Y, p.w, 2);
		// inlaid luminous trim just under the lip
		g.fillStyle = 'rgba(120,230,255,0.55)'; g.fillRect(X, Y + 22, p.w, 2);
		g.fillStyle = 'rgba(180,120,255,0.35)'; g.fillRect(X, Y + 26, p.w, 1);
		// carved glyph medallions every ~460px
		for(let cx = X + 230; cx < X + p.w - 120; cx += 460){
			g.save(); g.translate(cx, Y + 74); g.strokeStyle = 'rgba(140,235,255,0.55)'; g.lineWidth = 2;
			g.beginPath(); g.moveTo(0, -26); g.lineTo(26, 0); g.lineTo(0, 26); g.lineTo(-26, 0); g.closePath(); g.stroke();
			g.beginPath(); g.arc(0, 0, 9, 0, 7); g.stroke();
			g.strokeStyle = 'rgba(200,150,255,0.5)'; g.beginPath(); g.moveTo(-40, 0); g.lineTo(-26, 0); g.moveTo(26, 0); g.lineTo(40, 0); g.moveTo(0, -38); g.lineTo(0, -26); g.moveTo(0, 26); g.lineTo(0, 38); g.stroke();
			g.restore();
		}
		// hairline cracks
		g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1.4;
		for(let k = 0; k < p.w / 380; k++){ let x = X + r() * p.w, y = Y + 28; g.beginPath(); g.moveTo(x, y); for(let j = 0; j < 5; j++){ x += (r() - 0.5) * 26; y += 14 + r() * 22; g.lineTo(x, y); } g.stroke(); }
		// shadow fall-off toward the bottom
		shade(g, X, Y + bodyH - 140, p.w, 140, 'rgba(0,0,0,0)', 'rgba(0,0,0,0.7)');
		return { p, cv, ox: pad, oy: top };
	}
	function paintWall(p){
		const y0 = 560, hh = H - y0, r = rng(p.x + 91), pad = 30;
		const cv = mkCanvas(p.w + pad * 2, hh + 20), g = cv.getContext('2d'), X = pad, Y = 0;
		const inner = p.x < MID;
		shade(g, X, Y, p.w, hh, '#2a2342', '#0d0919');
		for(let y = 0; y < hh; y += 70){
			g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(X, y + 66, p.w, 4);
			g.fillStyle = 'rgba(190,170,255,0.06)'; g.fillRect(X, y, p.w, 2);
			const off = (y / 70) % 2 ? 40 : 0;
			g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(X + off + 40, y, 3, 66); g.fillRect(X + off + 110 > p.w ? X + 20 : X + off + 110, y, 3, 66);
		}
		// shade toward the arena side
		const sg = g.createLinearGradient(X, 0, X + p.w, 0);
		sg.addColorStop(inner ? 1 : 0, 'rgba(0,0,0,0.0)'); sg.addColorStop(inner ? 0 : 1, 'rgba(0,0,0,0.55)');
		g.fillStyle = sg; g.fillRect(X, Y, p.w, hh);
		// glowing glyph strip running down the inner face
		const gx = inner ? X + p.w - 26 : X + 20;
		g.fillStyle = 'rgba(100,225,255,0.18)'; g.fillRect(gx - 3, Y + 60, 12, hh - 120);
		for(let y = 100; y < hh - 100; y += 90){
			g.strokeStyle = 'rgba(150,240,255,0.75)'; g.lineWidth = 2; g.beginPath(); g.moveTo(gx + 3, y); g.lineTo(gx + 3, y + 40);
			g.moveTo(gx - 3, y + 8); g.lineTo(gx + 9, y + 8); g.moveTo(gx - 3, y + 32); g.lineTo(gx + 9, y + 32); g.stroke();
		}
		// inner-edge bevel light
		g.fillStyle = 'rgba(210,200,255,0.25)'; g.fillRect(inner ? X + p.w - 3 : X, Y, 3, hh);
		// ragged crown where the wall breaks off at the top of the picture
		shade(g, X, Y, p.w, 90, 'rgba(0,0,0,0.65)', 'rgba(0,0,0,0)');
		return { p, cv, ox: pad, oy: -y0 };
	}
	function paintSlab(p){
		const r = rng(p.x * 5 + p.y), pad = 24, hang = p.grand ? 110 : 80;
		const cv = mkCanvas(p.w + pad * 2, 30 + 26 + hang), g = cv.getContext('2d'), X = pad, Y = 30, th = p.grand ? 28 : 22;
		// underside rock, tapering to a point cluster
		g.fillStyle = '#17112b'; g.beginPath(); g.moveTo(X + 4, Y + th - 2);
		const n = Math.max(4, Math.round(p.w / 40));
		for(let k = 0; k <= n; k++){ const t = k / n, x = X + 4 + t * (p.w - 8); const depth = 18 + Math.sin(t * Math.PI) * hang * (0.55 + r() * 0.45); g.lineTo(x, Y + th + depth * (k % 2 ? 0.55 : 1)); }
		g.lineTo(X + p.w - 4, Y + th - 2); g.closePath(); g.fill();
		shade(g, X, Y + th, p.w, hang, 'rgba(120,100,200,0.18)', 'rgba(0,0,0,0.45)');
		// slab
		shade(g, X, Y, p.w, th, '#8a7cc8', '#3b3170');
		g.fillStyle = 'rgba(235,228,255,0.8)'; g.fillRect(X, Y, p.w, 2);
		g.fillStyle = 'rgba(110,230,255,0.7)'; g.fillRect(X + 4, Y + th - 5, p.w - 8, 2);
		for(let x = X + 18; x < X + p.w - 10; x += 34){ g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x, Y + 3, 2, th - 8); }
		// hanging crystals under the slab
		for(let k = 0; k < Math.max(2, p.w / 90); k++){
			const cx = X + 24 + r() * (p.w - 48), len = 14 + r() * 26, hue = r() < 0.5 ? '120,230,255' : '190,130,255';
			const gr = g.createLinearGradient(0, Y + th, 0, Y + th + len); gr.addColorStop(0, 'rgba(' + hue + ',0.95)'); gr.addColorStop(1, 'rgba(' + hue + ',0.05)');
			g.fillStyle = gr; g.beginPath(); g.moveTo(cx - 5, Y + th); g.lineTo(cx + 5, Y + th); g.lineTo(cx, Y + th + len); g.closePath(); g.fill();
		}
		if(p.grand){ g.fillStyle = 'rgba(255,220,140,0.9)'; for(const f of [0.1, 0.9]) g.fillRect(X + p.w * f - 3, Y - 16, 6, 16); }
		return { p, cv, ox: pad, oy: 30 };
	}
	function ensurePieces(){
		if(S.pieces) return S.pieces;
		S.pieces = [];
		for(const p of platforms()){
			if(p.invisible) continue;
			S.pieces.push(p.wall ? paintWall(p) : p.ground ? paintFloor(p) : paintSlab(p));
		}
		return S.pieces;
	}

	/* ---------- backdrop layers (cached per viewport) ---------- */
	function ridge(g, y0, amp, seed, fill, w, step){
		const r = rng(seed); g.fillStyle = fill; g.beginPath(); g.moveTo(0, y0 + 600); let y = y0;
		for(let x = 0; x <= w; x += step){ y = y0 + Math.sin(x * 0.0032 + seed) * amp + Math.sin(x * 0.011 + seed * 3) * amp * 0.35 + (r() - 0.5) * amp * 0.25; g.lineTo(x, y); }
		g.lineTo(w, y0 + 600); g.closePath(); g.fill();
	}
	function paintLayers(vw, vh){
		const L = {}, r = rng(4242);
		// sky
		L.sky = mkCanvas(vw, vh); let g = L.sky.getContext('2d');
		const sk = g.createLinearGradient(0, 0, 0, vh);
		sk.addColorStop(0, '#05030f'); sk.addColorStop(0.45, '#140a30'); sk.addColorStop(0.78, '#2c1a5c'); sk.addColorStop(1, '#4a2a74');
		g.fillStyle = sk; g.fillRect(0, 0, vw, vh);
		for(let k = 0; k < 230; k++){
			const a = 0.25 + r() * 0.75, s = r() < 0.08 ? 2.2 : r() < 0.3 ? 1.4 : 0.9;
			g.fillStyle = 'rgba(' + (r() < 0.3 ? '190,210,255' : '255,245,225') + ',' + a + ')'; g.fillRect(r() * vw, r() * vh * 0.8, s, s);
		}
		// the great ringed moon
		const mx = vw * 0.74, my = vh * 0.2, mr = Math.min(vw, vh) * 0.09;
		let hg = g.createRadialGradient(mx, my, mr * 0.8, mx, my, mr * 5.5); hg.addColorStop(0, 'rgba(190,170,255,0.30)'); hg.addColorStop(1, 'rgba(190,170,255,0)');
		g.fillStyle = hg; g.fillRect(mx - mr * 6, my - mr * 6, mr * 12, mr * 12);
		const mg = g.createRadialGradient(mx - mr * 0.35, my - mr * 0.35, mr * 0.1, mx, my, mr);
		mg.addColorStop(0, '#f6f0ff'); mg.addColorStop(0.6, '#c9bff0'); mg.addColorStop(1, '#8071b8');
		g.fillStyle = mg; g.beginPath(); g.arc(mx, my, mr, 0, 7); g.fill();
		g.fillStyle = 'rgba(90,70,150,0.35)'; for(let k = 0; k < 7; k++){ g.beginPath(); g.arc(mx + (r() - 0.5) * mr * 1.3, my + (r() - 0.5) * mr * 1.3, mr * (0.06 + r() * 0.12), 0, 7); g.fill(); }
		g.save(); g.translate(mx, my); g.rotate(-0.35); g.strokeStyle = 'rgba(230,215,255,0.55)'; g.lineWidth = mr * 0.12;
		g.beginPath(); g.ellipse(0, 0, mr * 1.9, mr * 0.42, 0, Math.PI * 1.02, Math.PI * 1.98); g.stroke();
		g.strokeStyle = 'rgba(190,170,255,0.35)'; g.lineWidth = mr * 0.07; g.beginPath(); g.ellipse(0, 0, mr * 2.25, mr * 0.5, 0, Math.PI * 1.03, Math.PI * 1.97); g.stroke(); g.restore();
		// far: jagged mountains with a cold rim of light
		const PERIOD = Math.max(vw * 2, 3200);
		L.far = mkCanvas(PERIOD, vh); g = L.far.getContext('2d');
		ridge(g, vh * 0.62, vh * 0.07, 7, '#1b1040', PERIOD, 14);
		ridge(g, vh * 0.70, vh * 0.06, 19, '#150c33', PERIOD, 12);
		// mid: ruined colonnades and floating spires, seamless over the period
		L.mid = mkCanvas(PERIOD, vh); g = L.mid.getContext('2d');
		ridge(g, vh * 0.80, vh * 0.025, 31, '#0f0824', PERIOD, 10);
		for(let k = 0; k < 9; k++){
			const x = (k + 0.5) / 9 * PERIOD + (r() - 0.5) * 120, base = vh * 0.9, hgt = vh * (0.22 + r() * 0.2), w = 34 + r() * 22;
			g.fillStyle = '#0c0620'; g.fillRect(x - w / 2, base - hgt, w, hgt);
			g.fillRect(x - w / 2 - 8, base - hgt - 12, w + 16, 14);                      // capital
			if(r() < 0.55){ g.fillStyle = '#0c0620'; g.beginPath(); g.moveTo(x - w / 2, base - hgt); g.lineTo(x - w / 2 + 70, base - hgt - 26); g.lineTo(x + w / 2 + 70, base - hgt - 14); g.lineTo(x + w / 2, base - hgt); g.fill(); }  // fallen lintel
			g.fillStyle = 'rgba(130,100,230,0.35)'; g.fillRect(x + w / 2 - 3, base - hgt, 3, hgt);                        // moonlit edge
			g.fillStyle = 'rgba(110,230,255,0.5)'; g.fillRect(x - 2, base - hgt * 0.6, 4, 6);                             // lamp
		}
		for(let k = 0; k < 6; k++){                                                                                 // drifting shards
			const x = (k + r()) / 6 * PERIOD, y = vh * (0.3 + r() * 0.2), sz = 40 + r() * 70;
			g.fillStyle = '#120a2c'; g.beginPath(); g.moveTo(x - sz, y); g.lineTo(x + sz, y); g.lineTo(x + sz * 0.3, y + sz * 0.9); g.lineTo(x - sz * 0.2, y + sz * 1.3); g.closePath(); g.fill();
			g.fillStyle = 'rgba(150,120,255,0.30)'; g.fillRect(x - sz, y, sz * 2, 3);
		}
		return L;
	}
	function blit(ctx, cv, scroll, y){
		const w = cv.width; let x = -(((scroll % w) + w) % w);
		for(; x < ctx.canvas.width; x += w) ctx.drawImage(cv, Math.round(x), Math.round(y));
	}

	/* ---------- animated set dressing ---------- */
	function aurora(ctx, vw, vh, t){
		ctx.save(); ctx.globalCompositeOperation = 'lighter';
		for(let k = 0; k < 3; k++){
			const y0 = vh * (0.14 + k * 0.08);
			const gr = ctx.createLinearGradient(0, y0 - 50, 0, y0 + 110);
			const col = k === 0 ? '60,255,190' : k === 1 ? '170,110,255' : '90,190,255';
			gr.addColorStop(0, 'rgba(' + col + ',0)'); gr.addColorStop(0.5, 'rgba(' + col + ',0.13)'); gr.addColorStop(1, 'rgba(' + col + ',0)');
			ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(0, y0 + 110);
			for(let x = 0; x <= vw; x += 40) ctx.lineTo(x, y0 + Math.sin(x * 0.0035 + t * 0.22 + k * 2.1) * 46 + Math.sin(x * 0.012 - t * 0.35 + k) * 14);
			ctx.lineTo(vw, y0 + 110); ctx.closePath(); ctx.fill();
		}
		ctx.restore();
	}
	function flame(ctx, x, y, s, t, seed){
		ctx.save(); ctx.globalCompositeOperation = 'lighter';
		for(let k = 0; k < 3; k++){
			const f = 0.75 + Math.sin(t * 9 + seed * 2 + k * 1.9) * 0.2, h = s * (1.6 - k * 0.4) * f, w = s * (0.7 - k * 0.15);
			const gr = ctx.createRadialGradient(x, y - h * 0.4, 1, x, y - h * 0.4, h);
			gr.addColorStop(0, k === 0 ? 'rgba(160,255,255,0.9)' : 'rgba(150,120,255,0.8)'); gr.addColorStop(1, 'rgba(90,60,200,0)');
			ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(x - w, y); ctx.quadraticCurveTo(x - w * 0.8, y - h * 0.6, x + Math.sin(t * 7 + seed) * 3, y - h); ctx.quadraticCurveTo(x + w * 0.8, y - h * 0.6, x + w, y); ctx.fill();
		}
		const gl = ctx.createRadialGradient(x, y - s * 0.6, 2, x, y - s * 0.6, s * 7); gl.addColorStop(0, 'rgba(130,200,255,0.25)'); gl.addColorStop(1, 'rgba(130,200,255,0)');
		ctx.fillStyle = gl; ctx.fillRect(x - s * 7, y - s * 8, s * 14, s * 14);
		ctx.restore();
	}
	function brazier(ctx, cam, x, t, seed){
		const sx = x - cam.x, gy = GROUND - cam.y;
		if(sx < -80 || sx > ctx.canvas.width + 80) return;
		ctx.fillStyle = '#17112b'; ctx.beginPath(); ctx.moveTo(sx - 22, gy - 70); ctx.lineTo(sx + 22, gy - 70); ctx.lineTo(sx + 12, gy - 54); ctx.lineTo(sx + 6, gy); ctx.lineTo(sx - 6, gy); ctx.lineTo(sx - 12, gy - 54); ctx.closePath(); ctx.fill();
		ctx.fillStyle = '#6f62b0'; ctx.fillRect(sx - 24, gy - 74, 48, 5);
		ctx.fillStyle = 'rgba(120,230,255,0.7)'; ctx.fillRect(sx - 3, gy - 46, 6, 12);
		flame(ctx, sx, gy - 74, 16, t, seed);
	}
	function pillars(ctx, cam, vw, vh){
		// fixed ruined columns standing behind the action (slight parallax)
		const par = 0.88;
		for(const [x, h, broken] of [[560, 520, 0], [1500, 640, 1], [2600, 700, 0], [3700, 640, 1], [4640, 520, 0]]){
			const sx = x - cam.x * par - (1 - par) * 0, base = GROUND - cam.y; const px = sx + cam.x * (1 - par) * 0 ;
			const xx = x - cam.x * par + (cam.x * 0.0) ;
			if(xx < -120 || xx > vw + 120) continue;
			const top = base - h;
			const gr = ctx.createLinearGradient(xx - 36, 0, xx + 36, 0); gr.addColorStop(0, '#0a0618'); gr.addColorStop(0.7, '#1c1438'); gr.addColorStop(1, '#2a2050');
			ctx.fillStyle = gr; ctx.beginPath();
			if(broken){ ctx.moveTo(xx - 34, base); ctx.lineTo(xx - 34, top + 40); ctx.lineTo(xx - 12, top); ctx.lineTo(xx + 4, top + 26); ctx.lineTo(xx + 34, top + 10); ctx.lineTo(xx + 34, base); }
			else { ctx.moveTo(xx - 34, base); ctx.lineTo(xx - 34, top); ctx.lineTo(xx + 34, top); ctx.lineTo(xx + 34, base); }
			ctx.closePath(); ctx.fill();
			if(!broken){ ctx.fillStyle = '#2c2352'; ctx.fillRect(xx - 44, top - 14, 88, 16); ctx.fillStyle = '#161033'; ctx.fillRect(xx - 44, top + 2, 88, 6); }
			ctx.fillStyle = 'rgba(0,0,0,0.25)'; for(let k = -2; k <= 2; k++) ctx.fillRect(xx + k * 12 - 1, top + 30, 2, h - 30);
			ctx.fillStyle = 'rgba(120,230,255,0.4)'; ctx.fillRect(xx + 30, top + 40, 3, h - 60);
		}
	}
	function floorRune(ctx, cam, t){
		// the sanctum's great ward, inlaid in the floor and pulsing
		const cx = MID - cam.x, gy = GROUND - cam.y + 1;
		if(cx < -900 || cx > ctx.canvas.width + 900) return;
		ctx.save(); ctx.globalCompositeOperation = 'lighter';
		const pulse = 0.55 + Math.sin(t * 1.4) * 0.2;
		for(let k = 0; k < 3; k++){
			const rx = 330 + k * 160, ry = 12 + k * 6;
			ctx.strokeStyle = 'rgba(' + (k === 1 ? '190,130,255' : '110,230,255') + ',' + (pulse * (0.5 - k * 0.1)) + ')'; ctx.lineWidth = 2.5 - k * 0.5;
			ctx.beginPath(); ctx.ellipse(cx, gy, rx, ry, 0, Math.PI, 0, true); ctx.stroke();
		}
		for(let k = 0; k < 16; k++){ const a = (k / 16) * Math.PI * 2 + t * 0.12; const x = cx + Math.cos(a) * 430, y = gy - Math.abs(Math.sin(a)) * 0 ; if(Math.sin(a) >= 0) continue; const hgt = 5 + Math.abs(Math.sin(a * 3 + t)) * 5; ctx.fillStyle = 'rgba(160,240,255,' + (0.4 * pulse) + ')'; ctx.fillRect(x - 1.5, gy - hgt, 3, hgt); }
		const gl = ctx.createRadialGradient(cx, gy, 10, cx, gy, 520); gl.addColorStop(0, 'rgba(130,190,255,' + (0.18 * pulse) + ')'); gl.addColorStop(1, 'rgba(130,190,255,0)');
		ctx.fillStyle = gl; ctx.fillRect(cx - 520, gy - 160, 1040, 170);
		ctx.restore();
	}
	function banners(ctx, cam, t){
		for(const [x, dir] of [[300, 1], [4900, -1]]){
			const sx = x - cam.x; if(sx < -80 || sx > ctx.canvas.width + 80) continue;
			for(let k = 0; k < 2; k++){
				const by = 1160 + k * 280 - cam.y, sw = Math.sin(t * 1.3 + k * 1.7) * 6 * dir;
				ctx.fillStyle = '#3a1f6e'; ctx.beginPath(); ctx.moveTo(sx - 26 * dir, by); ctx.lineTo(sx - 26 * dir - 46 * dir, by); ctx.lineTo(sx - 26 * dir - 46 * dir + sw, by + 190); ctx.lineTo(sx - 26 * dir - 23 * dir + sw, by + 160); ctx.lineTo(sx - 26 * dir + sw * 0.4, by + 190); ctx.closePath(); ctx.fill();
				ctx.strokeStyle = 'rgba(120,230,255,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx - 26 * dir - 23 * dir + sw * 0.5, by + 60, 12, 0, 7); ctx.moveTo(sx - 26 * dir - 23 * dir + sw * 0.5, by + 44); ctx.lineTo(sx - 26 * dir - 23 * dir + sw * 0.5, by + 76); ctx.stroke();
			}
		}
	}

	function drawBack(ctx){
		const vw = ctx.canvas.width, vh = ctx.canvas.height, cam = camera, t = now() / 1000;
		const key = vw + 'x' + vh;
		if(S.layerKey !== key){ S.layers = paintLayers(vw, vh); S.layerKey = key; }
		const L = S.layers;
		ctx.drawImage(L.sky, 0, 0);
		aurora(ctx, vw, vh, t);
		const lift = clamp((2000 - (cam.y + vh)) * 0.08, -60, 80);
		blit(ctx, L.far, cam.x * 0.10, lift * 0.5);
		blit(ctx, L.mid, cam.x * 0.28, lift);
		pillars(ctx, cam, vw, vh);
		brazier(ctx, cam, 470, t, 1); brazier(ctx, cam, 4730, t, 2); brazier(ctx, cam, 1620, t, 3); brazier(ctx, cam, 3580, t, 4);
		banners(ctx, cam, t);
		for(const pc of ensurePieces()){
			const p = pc.p, x = p.x - pc.ox - cam.x, y = p.y - pc.oy - cam.y;
			if(x > vw || x + pc.cv.width < 0 || y > vh || y + pc.cv.height < 0) continue;
			ctx.drawImage(pc.cv, Math.round(x), Math.round(y));
		}
		floorRune(ctx, cam, t);
		return true;
	}

	/* soft foreground: drifting light motes, a cold vignette, optional flashes from boss events */
	function drawFront(ctx){
		const vw = ctx.canvas.width, vh = ctx.canvas.height, t = now() / 1000;
		const dt = Math.min(0.05, (now() - S.last) / 1000); S.last = now();
		ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
		const P = S.parts;
		while(P.length < 70) P.push({ x: Math.random() * vw, y: Math.random() * vh, v: 8 + Math.random() * 26, s: 0.8 + Math.random() * 2, h: Math.random() < 0.5 ? 190 : 270, ph: Math.random() * 7 });
		ctx.globalCompositeOperation = 'lighter';
		for(const q of P){
			q.y -= q.v * dt; q.x += Math.sin(t * 0.7 + q.ph) * 6 * dt - (camera.x - (S._cx || camera.x)) * 0.0;
			if(q.y < -10){ q.y = vh + 10; q.x = Math.random() * vw; }
			ctx.fillStyle = 'hsla(' + q.h + ',90%,75%,' + (0.25 + 0.2 * Math.sin(t * 2 + q.ph)) + ')'; ctx.fillRect(q.x, q.y, q.s, q.s);
		}
		ctx.globalCompositeOperation = 'source-over';
		if(!S.vg || S.vg.width !== vw || S.vg.height !== vh){
			S.vg = mkCanvas(vw, vh); const g = S.vg.getContext('2d');
			const v = g.createRadialGradient(vw / 2, vh * 0.55, vh * 0.45, vw / 2, vh * 0.55, vw * 0.78); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(6,2,20,0.42)');
			g.fillStyle = v; g.fillRect(0, 0, vw, vh);
			const f = g.createLinearGradient(0, vh * 0.7, 0, vh); f.addColorStop(0, 'rgba(90,60,200,0)'); f.addColorStop(1, 'rgba(90,60,200,0.10)'); g.fillStyle = f; g.fillRect(0, vh * 0.7, vw, vh * 0.3);
		}
		ctx.drawImage(S.vg, 0, 0);
		if(S.flash > 0.01){ ctx.fillStyle = 'rgba(230,225,255,' + S.flash + ')'; ctx.fillRect(0, 0, vw, vh); S.flash *= 0.86; }
		ctx.restore();
	}

	/* keeps you in frame on both axes, inside the room */
	function cameraFollow(){
		const vw = canvas.width, vh = canvas.height, c = { x0: 140, x1: 5060, y0: 700, y1: 2400 };
		const fx = player.x + player.w / 2, fy = player.y + player.h / 2;
		const tx = fx - vw / 2, ty = fy - vh * 0.58;
		const cx = (c.x1 - c.x0) <= vw ? (c.x0 + c.x1 - vw) / 2 : clamp(tx, c.x0, c.x1 - vw);
		const cy = (c.y1 - c.y0) <= vh ? c.y1 - vh : clamp(ty, c.y0, c.y1 - vh);
		if(!S.camInit || Math.abs(camera.x - cx) > 900 || Math.abs(camera.y - cy) > 900){ camera.x = cx; camera.y = cy; S.camInit = true; }
		else { camera.x += (cx - camera.x) * 0.2; camera.y += (cy - camera.y) * 0.14; }
		return true;
	}

	/* the same slot offsets every client derives on its own */
	function spawnFor(slot){ slot = slot | 0; const off = (slot - 1.5) * 96; return { x: MID + off - 19, y: GROUND - 62 }; }

	root.SurvivalArena = {
		CONFIG, BOUNDS, platforms, camera: cameraFollow, drawBack, drawFront, spawnFor,
		flash(a){ S.flash = Math.max(S.flash, a || 0.3); },
		LEDGES, SOLIDS,
	};
})(window);
