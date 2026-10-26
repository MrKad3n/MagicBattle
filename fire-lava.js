/* =============================================================
   MoltenLava — the fire dungeon's lava renderer.

   The liquid simulation (DungeonFluid) still decides where lava is and how deep it is; this draws it.
   Everything is vector + two small procedural flow textures built once at load — no image assets, no
   per-column rectangles, no offscreen tile repaints. A visible pool costs one clipped path, a handful of
   gradient/pattern fills and a few dozen bubble/spark particles, so a whole screen of lava stays cheap, and
   the surface animates quickly (rolling waves, drifting crust plates, popping bubbles, rising sparks).
   ============================================================= */
(function(global){
	const F = global.DungeonFluid;
	if(!F) return;
	const COL = 12;
	const TAU = Math.PI * 2;

	function active(){
		return typeof IS_DUNGEON !== 'undefined' && IS_DUNGEON && typeof DUNGEON_TYPE !== 'undefined' && DUNGEON_TYPE === 'fire';
	}

	/* ---------- procedural flow textures: dark crust cells split by glowing cracks (tileable) ---------- */
	function rng(seed){ let s = seed >>> 0; return function(){ s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
	function makeFlow(size, cells, seed, crackW){
		const el = document.createElement('canvas'); el.width = el.height = size;
		const g = el.getContext('2d');
		const img = g.createImageData(size, size), d = img.data;
		const r = rng(seed), pts = [];
		for(let i = 0; i < cells; i++) pts.push([r() * size, r() * size]);
		for(let y = 0; y < size; y++){
			for(let x = 0; x < size; x++){
				let d1 = 1e9, d2 = 1e9;
				for(let i = 0; i < cells; i++){
					let dx = Math.abs(x - pts[i][0]), dy = Math.abs(y - pts[i][1]);
					if(dx > size / 2) dx = size - dx; if(dy > size / 2) dy = size - dy;
					const dd = dx * dx + dy * dy;
					if(dd < d1){ d2 = d1; d1 = dd; } else if(dd < d2) d2 = dd;
				}
				const edge = Math.sqrt(d2) - Math.sqrt(d1);         // ~0 on a crack, grows toward a cell centre
				const o = (y * size + x) * 4;
				const crack = Math.max(0, 1 - edge / crackW);        // 1 on the crack
				const cell = Math.min(1, edge / (crackW * 5));       // 0 near the crack, 1 in the cell
				// crust: dark red-black plates, hotter near the cracks; cracks: yellow-orange
				const hot = Math.pow(crack, 0.8);
				d[o]     = Math.round(lerp(34 + cell * 22, 255, hot));
				d[o + 1] = Math.round(lerp(6 + cell * 6, 190 - (1 - hot) * 40, hot));
				d[o + 2] = Math.round(lerp(2, 60, hot));
				d[o + 3] = Math.round(lerp(150 * cell + 40, 255, hot));
			}
		}
		g.putImageData(img, 0, 0);
		return el;
	}
	function lerp(a, b, t){ return a + (b - a) * t; }
	let texA = null, texB = null, patA = null, patB = null;
	function ensureTex(ctx){
		if(patA) return true;
		try{
			texA = makeFlow(256, 14, 1337, 3.2);
			texB = makeFlow(256, 30, 7, 2.2);
			patA = ctx.createPattern(texA, 'repeat');
			patB = ctx.createPattern(texB, 'repeat');
		}catch(e){ patA = patB = null; }
		return !!patA;
	}

	/* ---------- particles: bubbles that swell and pop, sparks that drift up ---------- */
	const bubbles = [], sparks = [];
	function now(){ return (typeof performance !== 'undefined' ? performance.now() : Date.now()) * 0.001; }
	let lastT = 0;
	function spawnFx(x0, x1, topAt, vw){
		const w = x1 - x0;
		if(bubbles.length < 26 && Math.random() < Math.min(0.3, w / 1800)){
			const x = x0 + Math.random() * w;
			bubbles.push({ x, y: topAt(x) + 5, r: 2, max: 5 + Math.random() * 9, age: 0, life: 40 + Math.random() * 30 });
		}
		if(sparks.length < 70 && Math.random() < Math.min(0.5, w / 1200)){
			const x = x0 + Math.random() * w;
			sparks.push({ x, y: topAt(x) - 2, vx: (Math.random() - 0.5) * 0.8, vy: -(0.7 + Math.random() * 1.8), life: 50 + Math.random() * 50, max: 100, s: 1.5 + Math.random() * 2 });
		}
	}
	function stepFx(){
		for(let i = bubbles.length - 1; i >= 0; i--){
			const b = bubbles[i]; b.age++; b.r = lerp(2, b.max, b.age / b.life);
			if(b.age >= b.life){
				for(let k = 0; k < 4 && sparks.length < 90; k++) sparks.push({ x: b.x, y: b.y - 2, vx: (Math.random() - 0.5) * 3, vy: -(1 + Math.random() * 2.6), life: 24 + Math.random() * 18, max: 40, s: 1.6 + Math.random() * 1.6 });
				bubbles.splice(i, 1);
			}
		}
		for(let i = sparks.length - 1; i >= 0; i--){
			const s = sparks[i]; s.life--; s.x += s.vx; s.y += s.vy; s.vy += 0.012; s.vx *= 0.99;
			if(s.life <= 0) sparks.splice(i, 1);
		}
	}
	function drawFx(ctx, camx, camy, vw, vh){
		ctx.save();
		for(let i = 0; i < bubbles.length; i++){
			const b = bubbles[i], sx = b.x - camx, sy = b.y - camy;
			if(sx < -20 || sx > vw + 20 || sy < -20 || sy > vh + 20) continue;
			const k = b.age / b.life;
			ctx.strokeStyle = 'rgba(255,' + Math.round(190 - k * 60) + ',70,' + (0.8 - k * 0.3) + ')'; ctx.lineWidth = 1.6;
			ctx.beginPath(); ctx.ellipse(sx, sy - b.r * 0.35, b.r, b.r * 0.62, 0, 0, TAU); ctx.stroke();
			ctx.fillStyle = 'rgba(255,230,140,' + (0.25 + 0.2 * (1 - k)) + ')'; ctx.fill();
		}
		ctx.globalCompositeOperation = 'lighter';
		for(let i = 0; i < sparks.length; i++){
			const s = sparks[i], sx = s.x - camx, sy = s.y - camy;
			if(sx < -10 || sx > vw + 10 || sy < -10 || sy > vh + 10) continue;
			const a = Math.min(1, s.life / 24);
			ctx.fillStyle = 'rgba(255,' + Math.round(150 + 90 * a) + ',60,' + a * 0.9 + ')';
			ctx.fillRect(sx - s.s * 0.5, sy - s.s * 0.5, s.s, s.s);
		}
		ctx.restore();
	}

	/* ---------- one pool of lava: tops[] is the surface height for each COL-wide column ---------- */
	function drawBody(ctx, x0, tops, bottom, camx, camy, t, seed, vw, vh, minWorld){
		const N = tops.length;
		if(!N) return;
		// only the columns on screen are traced (everything else about the pool is world-anchored so nothing shifts while the camera moves)
		const a = Math.max(0, Math.floor((camx - x0) / COL) - 2), z = Math.min(N - 1, Math.ceil((camx + vw - x0) / COL) + 2);
		if(z < a) return;
		const n = z - a + 1, ox = x0 + a * COL, sx0 = ox - camx;
		const ys = new Array(n);
		let minTop = (minWorld === undefined ? 1e9 : minWorld - camy - 3);
		for(let k = 0; k < n; k++){
			const i = a + k;
			const pa = tops[Math.max(0, i - 1)], pb = tops[i], pc = tops[Math.min(N - 1, i + 1)];
			const wx = ox + k * COL;
			const wave = Math.sin(wx * 0.052 + t * 3.1 + seed) * 2.6 + Math.sin(wx * 0.118 - t * 5.2) * 1.3 + Math.sin(wx * 0.021 + t * 1.4) * 2.2;
			ys[k] = (pa + pb * 2 + pc) / 4 - camy + wave;
			if(minWorld === undefined && ys[k] < minTop) minTop = ys[k];
		}
		const botY = bottom - camy + 2;
		const x1 = sx0 + n * COL;
		if(x1 < -40 || sx0 > vw + 40 || botY < -40 || minTop > vh + 40) return;
		// glow cast upward off the surface
		ctx.save();
		ctx.globalCompositeOperation = 'lighter';
		const gl = ctx.createLinearGradient(0, minTop - 110, 0, minTop + 6);
		gl.addColorStop(0, 'rgba(255,90,10,0)'); gl.addColorStop(0.65, 'rgba(255,100,20,0.10)'); gl.addColorStop(1, 'rgba(255,140,40,0.30)');
		ctx.fillStyle = gl; ctx.fillRect(sx0 - 30, minTop - 110, n * COL + 60, 116);
		ctx.restore();

		ctx.save();
		ctx.beginPath();
		ctx.moveTo(sx0, ys[0]);
		for(let i = 1; i < n; i++) ctx.lineTo(sx0 + i * COL, ys[i]);
		ctx.lineTo(x1, ys[n - 1]); ctx.lineTo(x1, botY); ctx.lineTo(sx0, botY); ctx.closePath();
		ctx.clip();

		const depth = Math.max(60, Math.min(420, botY - minTop));
		const bg = ctx.createLinearGradient(0, minTop, 0, minTop + depth);
		bg.addColorStop(0, '#ffb347'); bg.addColorStop(0.05, '#ff7a1a'); bg.addColorStop(0.22, '#e03a05'); bg.addColorStop(0.55, '#8d1500'); bg.addColorStop(1, '#3a0600');
		ctx.fillStyle = bg; ctx.fillRect(sx0 - 2, minTop - 8, n * COL + 4, botY - minTop + 12);

		if(ensureTex(ctx)){
			const h = botY - minTop + 12, wd = n * COL + 4;
			// big slow plates drifting right, finer cracks drifting left (pattern is anchored to the world so it doesn't swim with the camera)
			ctx.globalAlpha = 0.9;
			patA.setTransform(new DOMMatrix().translate(-camx + t * 16, -camy));
			ctx.fillStyle = patA; ctx.fillRect(sx0 - 2, minTop - 8, wd, h);
			ctx.globalAlpha = 0.5; ctx.globalCompositeOperation = 'lighter';
			patB.setTransform(new DOMMatrix().translate(-camx - t * 11, -camy).scale(0.75));
			ctx.fillStyle = patB; ctx.fillRect(sx0 - 2, minTop - 8, wd, h);
			ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
		}
		// darker and calmer with depth
		const dg = ctx.createLinearGradient(0, minTop + 20, 0, minTop + Math.min(depth, 300));
		dg.addColorStop(0, 'rgba(30,4,0,0)'); dg.addColorStop(1, 'rgba(30,3,0,0.82)');
		ctx.fillStyle = dg; ctx.fillRect(sx0 - 2, minTop + 20, n * COL + 4, botY - minTop);
		// hot band right under the surface
		ctx.globalCompositeOperation = 'lighter';
		const hb = ctx.createLinearGradient(0, minTop - 2, 0, minTop + 30);
		hb.addColorStop(0, 'rgba(255,225,130,0.55)'); hb.addColorStop(1, 'rgba(255,120,30,0)');
		ctx.fillStyle = hb; ctx.fillRect(sx0 - 2, minTop - 4, n * COL + 4, 36);
		ctx.globalCompositeOperation = 'source-over';

		// drifting crust plates riding the surface (positions are in world space)
		const width = N * COL, plates = Math.floor(width / 190);
		for(let k = 0; k < plates; k++){
			const px = ((k * 211 + (seed % 97) * 13 + t * (7 + (k % 3) * 2.5)) % width + width) % width;
			const wxp = x0 + px, scx = wxp - camx;
			if(scx < -40 || scx > vw + 40) continue;
			const col = Math.min(n - 1, Math.max(0, Math.floor((wxp - ox) / COL)));
			const py = ys[col], pw = 22 + ((k * 37) % 26);
			ctx.fillStyle = 'rgba(26,5,2,0.92)';
			ctx.beginPath(); if(ctx.roundRect) ctx.roundRect(scx - pw / 2, py + 1, pw, 7, 3); else ctx.rect(scx - pw / 2, py + 1, pw, 7); ctx.fill();
			ctx.fillStyle = 'rgba(255,150,40,0.55)'; ctx.fillRect(scx - pw / 2 + 2, py + 1, pw - 4, 1.5);
		}
		ctx.restore();

		// bright surface line (outside the clip so it can glow)
		ctx.save();
		ctx.lineJoin = 'round'; ctx.lineCap = 'round';
		const trace = () => { ctx.beginPath(); ctx.moveTo(sx0, ys[0]); for(let i = 1; i < n; i++) ctx.lineTo(sx0 + i * COL, ys[i]); ctx.lineTo(x1, ys[n - 1]); };
		ctx.globalCompositeOperation = 'lighter';
		trace(); ctx.strokeStyle = 'rgba(255,80,10,0.5)'; ctx.lineWidth = 11; ctx.stroke();
		ctx.globalCompositeOperation = 'source-over';
		trace(); ctx.strokeStyle = '#ff8a22'; ctx.lineWidth = 5; ctx.stroke();
		trace(); ctx.strokeStyle = '#ffd98a'; ctx.lineWidth = 2.4; ctx.stroke();
		ctx.restore();
	}

	/* ---------- draw every visible lava run ---------- */
	function visLava(c){ return c.visLava; }
	let runCache = null, runSig = '';
	let runAge = 0;
	function buildRuns(){
		// the depths only creep: re-reading 3000+ columns every frame was the lava's biggest cost — every 5th frame is plenty
		if(runCache && ++runAge < 5) return runCache;
		runAge = 0;
		let sig = 0, cnt = 0;
		const cols = [];
		for(const k in F.bins){
			const list = F.bins[k];
			for(let n = 0; n < list.length; n++){
				const c = list[n];
				if(c.visLava < 3) continue;
				cols.push(c); cnt++;
				sig = (Math.imul(sig, 31) + c.i * 7 + Math.round(c.floor) + Math.round(c.visLava)) | 0;
			}
		}
		const key = cnt + ':' + sig;
		if(runCache && key === runSig) return runCache;
		cols.sort((a, b) => { const ba = Math.round(a.floor / 160), bb = Math.round(b.floor / 160); return ba !== bb ? ba - bb : a.i - b.i; });
		const runs = []; let run = [];
		for(let n = 0; n < cols.length; n++){
			const c = cols[n], prev = run[run.length - 1];
			if(prev && (c.i !== prev.i + 1 || Math.abs(c.floor - prev.floor) > 90)){ runs.push(run); run = []; }
			run.push(c);
		}
		if(run.length) runs.push(run);
		runSig = key;
		runCache = runs.filter(r => r.length >= 1).map(rn => {
			const tops = rn.map(c => c.floor - c.visLava);
			let bottom = 0, minW = 1e9;
			for(let i = 0; i < rn.length; i++){ if(rn[i].floor > bottom) bottom = rn[i].floor; if(tops[i] < minW) minW = tops[i]; }
			return { x0: rn[0].x, x1: rn[rn.length - 1].x + COL, tops, bottom, minW, rn };
		});
		return runCache;
	}
	function drawAll(ctx){
		const cam = (typeof camera !== 'undefined' && camera) ? camera : { x:0, y:0 };
		const vw = (typeof canvas !== 'undefined' && canvas) ? canvas.width : 1600;
		const vh = (typeof canvas !== 'undefined' && canvas) ? canvas.height : 900;
		const t = now();
		if(!F.bins) return;
		const runs = buildRuns();
		ctx.save();
		for(let r = 0; r < runs.length; r++){
			const R = runs[r];
			if(R.x1 < cam.x - 60 || R.x0 > cam.x + vw + 60 || R.bottom < cam.y - 60 || R.minW > cam.y + vh + 60) continue;
			drawBody(ctx, R.x0, R.tops, R.bottom, cam.x, cam.y, t, R.x0, vw, vh, R.minW);
			const x0 = Math.max(R.x0, cam.x), x1 = Math.min(R.x1, cam.x + vw);
			if(x1 > x0) spawnFx(x0, x1, (x) => { const c = R.rn[Math.max(0, Math.min(R.rn.length - 1, Math.floor((x - R.x0) / COL)))]; return c.floor - c.visLava; }, vw);
		}
		ctx.restore();
		stepFx(); lastT = t;
		drawFx(ctx, cam.x, cam.y, vw, vh);
		drawStreams(ctx, cam, vw, vh, t);
	}

	function drawStreams(ctx, cam, vw, vh, t){
		const streams = F.streams && F.streams.lava;
		if(!streams) return;
		for(let i = 0; i < streams.length; i++){
			const s = streams[i];
			const sx = s.x - cam.x, sy0 = s.y0 - cam.y, sy1 = s.y1 - cam.y;
			if(sx < -30 || sx > vw + 30 || sy1 < -20 || sy0 > vh + 20) continue;
			const h = Math.max(4, sy1 - sy0), w = Math.max(4, (s.w | 0));
			const g = ctx.createLinearGradient(0, sy0, 0, sy0 + h);
			g.addColorStop(0, '#ffb347'); g.addColorStop(1, '#e03a05');
			ctx.fillStyle = g;
			ctx.beginPath();
			ctx.moveTo(sx - w / 2, sy0);
			for(let k = 0; k <= 6; k++){ const u = k / 6; ctx.lineTo(sx - w / 2 - Math.sin(t * 9 + u * 6 + s.x) * 1.2, sy0 + h * u); }
			for(let k = 6; k >= 0; k--){ const u = k / 6; ctx.lineTo(sx + w / 2 + Math.sin(t * 9 + u * 6 + s.x + 1) * 1.2, sy0 + h * u); }
			ctx.closePath(); ctx.fill();
			ctx.fillStyle = 'rgba(255,235,150,0.85)'; ctx.fillRect(sx - 1, sy0, 2, h);
			ctx.save(); ctx.globalCompositeOperation = 'lighter';
			const hg = ctx.createRadialGradient(sx, sy1, 2, sx, sy1, 34);
			hg.addColorStop(0, 'rgba(255,160,50,0.5)'); hg.addColorStop(1, 'rgba(255,60,0,0)');
			ctx.fillStyle = hg; ctx.fillRect(sx - 36, sy1 - 36, 72, 72); ctx.restore();
		}
	}

	/* flat pool (decorations, hazards, boss pools) */
	function pool(ctx, x, y, w, h, seed){
		if(w < 8 || h < 4) return;
		const cam = (typeof camera !== 'undefined' && camera) ? camera : { x:0, y:0 };
		const vw = (typeof canvas !== 'undefined' && canvas) ? canvas.width : 1600;
		const vh = (typeof canvas !== 'undefined' && canvas) ? canvas.height : 900;
		const n = Math.max(1, Math.round(w / COL));
		const tops = new Array(n).fill(y);
		drawBody(ctx, x, tops, y + h, cam.x, cam.y, now(), seed || x, vw, vh, y);
	}

	/* ---------- take over drawing from the old renderer (fire dungeon only) ---------- */
	const origDraw = F.draw;
	F.noLava = false;
	F.draw = function(ctx){
		if(!active() || !F.ready || !ctx){ F.noLava = false; return origDraw.apply(this, arguments); }
		F.noLava = true;
		// water (none in the fire dungeon, but keep the old path for anything that holds it)
		if(F._volume && F._volume.water > 1) origDraw.apply(this, arguments);
		drawAll(ctx);
	};
	global.MoltenLava = { pool, draw: drawAll, active };
})(typeof window !== 'undefined' ? window : globalThis);
