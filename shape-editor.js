/* =====================================================================
   SHAPE EDITOR — draw your own shape for the Compress / Shape rune.
   ShapeEditor.open({ poly, doc, start, onSave(poly, doc), onCancel })
   · Brush and eraser paint the shape; a mirror makes it symmetric top-to-bottom.
   · Built-in shapes (and circle / box / triangle) can be dragged in, then moved, stretched and turned with handles.
   · Everything is merged into one outline (the largest connected piece) — that outline is what the energy takes.
   · Your library: shapes you save (★ Save to library) are kept in this browser and can be dragged into any drawing,
     opened again to edit, renamed or deleted. ShapeEditor.Library is shared with the forge's shape picker.
   Shape space: forward (the way the energy flies) is +x; the canvas covers x −2.4…2.4, y −1.6…1.6.
   ===================================================================== */
(function(root){
	'use strict';
	const ME = root.MagicEngine;
	const GW = 96, GH = 64, X0 = -2.4, Y0 = -1.6, CELL = 0.05;      // the raster the outline is traced from
	const SC = 7;                                                     // screen px per cell
	const CW = GW * SC, CH = GH * SC;
	const BASIC = {
		circle: { label: 'Circle', poly: (() => { const o = []; for(let i = 0; i < 40; i++){ const a = i / 40 * Math.PI * 2; o.push([ Math.cos(a), Math.sin(a) ]); } return o; })() },
		box:    { label: 'Box', poly: [ [ 0.9, 0.9 ], [ -0.9, 0.9 ], [ -0.9, -0.9 ], [ 0.9, -0.9 ] ] },
		tri:    { label: 'Triangle', poly: [ [ 1.1, 0 ], [ -0.8, 0.95 ], [ -0.8, -0.95 ] ] },
		bar:    { label: 'Bar', poly: [ [ 1.6, 0.18 ], [ -1.6, 0.18 ], [ -1.6, -0.18 ], [ 1.6, -0.18 ] ] }
	};
	const polyOf = (kind, item) => item && item.pts ? item.pts : (BASIC[kind] ? BASIC[kind].poly : (ME && ME.SHAPES[kind] && ME.SHAPES[kind].poly) || BASIC.box.poly);
	const bbox = (P) => { let a = 1e9, b = 1e9, c = -1e9, d = -1e9; for(const q of P){ a = Math.min(a, q[0]); b = Math.min(b, q[1]); c = Math.max(c, q[0]); d = Math.max(d, q[1]); } return { x0: a, y0: b, x1: c, y1: d }; };
	/* ---- your shape library (kept in this browser; shared by every spell and the forge) ---- */
	const LIB_KEY = 'magicBattle_shapeLibrary', LIB_MAX = 80;
	const libListeners = new Set();
	const polyKey = (P) => { if(ME && ME.customShapeKey){ try { const k = ME.customShapeKey(P); if(k) return k; } catch(e){} } let h = 2166136261; for(const q of P || []){ for(const v of q){ h ^= Math.round(v * 1000); h = Math.imul(h, 16777619) >>> 0; } } return 'h' + h.toString(36); };
	const Library = {
		list(){
			try {
				const a = JSON.parse(localStorage.getItem(LIB_KEY) || '[]');
				return Array.isArray(a) ? a.filter(e => e && e.id && Array.isArray(e.poly) && e.poly.length > 2) : [];
			} catch(e){ return []; }
		},
		_write(a){ try { localStorage.setItem(LIB_KEY, JSON.stringify(a)); } catch(e){ return false; } for(const f of libListeners){ try { f(); } catch(e){} } return true; },
		get(id){ return Library.list().find(e => e.id === id) || null; },
		/* the entry holding this exact outline (or null) */
		find(poly){ if(!poly || poly.length < 3) return null; const k = polyKey(poly); return Library.list().find(e => polyKey(e.poly) === k) || null; },
		/* save a shape: an existing id (or the same outline) is updated in place, otherwise it is added. Returns the entry, or null when full / unsavable. */
		save(name, poly, doc, id){
			if(!poly || poly.length < 3) return null;
			const a = Library.list(), nm = String(name || '').trim().slice(0, 28) || ('Shape ' + (a.length + 1));
			let e = (id && a.find(q => q.id === id)) || a.find(q => polyKey(q.poly) === polyKey(poly));
			if(e){ e.name = nm; e.poly = poly.map(q => [ +q[0].toFixed(4), +q[1].toFixed(4) ]); e.doc = doc || e.doc || null; e.t = Date.now(); }
			else {
				if(a.length >= LIB_MAX) return null;
				e = { id: 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: nm, poly: poly.map(q => [ +q[0].toFixed(4), +q[1].toFixed(4) ]), doc: doc || null, t: Date.now() };
				a.unshift(e);
			}
			return Library._write(a) ? e : null;
		},
		rename(id, name){ const a = Library.list(), e = a.find(q => q.id === id); if(!e) return false; e.name = String(name || '').trim().slice(0, 28) || e.name; return Library._write(a); },
		remove(id){ const a = Library.list(), b = a.filter(q => q.id !== id); return b.length !== a.length && Library._write(b); },
		nextName(){ const used = new Set(Library.list().map(e => e.name)); let n = Library.list().length + 1; while(used.has('Shape ' + n)) n++; return 'Shape ' + n; },
		onChange(f){ libListeners.add(f); return () => libListeners.delete(f); },
		MAX: LIB_MAX
	};
	function inPoly(x, y, P){ let c = false; for(let i = 0, j = P.length - 1; i < P.length; j = i++){ const a = P[i], b = P[j]; if((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
	/* an item's polygon in shape space (scale → turn → move) */
	function worldPoly(it){
		const P = polyOf(it.kind, it), c = Math.cos(it.rot), s = Math.sin(it.rot);
		return P.map(q => { const x = q[0] * it.sx, y = q[1] * it.sy; return [ it.x + x * c - y * s, it.y + x * s + y * c ]; });
	}
	/* ---- run-length paint layer (0 none, 1 painted, 2 erased) ---- */
	function rle(a){ let out = [], cur = a[0], n = 0; for(let i = 0; i < a.length; i++){ if(a[i] === cur) n++; else { out.push(cur + ':' + n); cur = a[i]; n = 1; } } out.push(cur + ':' + n); return out.join(','); }
	function unrle(s){ const a = new Uint8Array(GW * GH); if(!s) return a; let i = 0; for(const part of String(s).split(',')){ const [ v, n ] = part.split(':').map(Number); for(let k = 0; k < n && i < a.length; k++) a[i++] = v; } return a; }
	/* ---- outline: marching squares over the merged mask, the largest loop, simplified ---- */
	function traceOutline(mask){
		const W = GW + 2, H = GH + 2, v = new Uint8Array(W * H);
		for(let j = 0; j < GH; j++) for(let i = 0; i < GW; i++) v[(j + 1) * W + i + 1] = mask[j * GW + i];
		const segs = new Map(), key = (x, y) => (x * 2) + ',' + (y * 2);
		const add = (a, b) => { const ka = key(a[0], a[1]); if(!segs.has(ka)) segs.set(ka, []); segs.get(ka).push(b); };
		for(let j = 0; j < H - 1; j++) for(let i = 0; i < W - 1; i++){
			const tl = v[j * W + i], tr = v[j * W + i + 1], br = v[(j + 1) * W + i + 1], bl = v[(j + 1) * W + i];
			const c = tl * 8 + tr * 4 + br * 2 + bl; if(c === 0 || c === 15) continue;
			const T = [ i + 0.5, j ], R = [ i + 1, j + 0.5 ], B = [ i + 0.5, j + 1 ], L = [ i, j + 0.5 ];
			const S = { 1: [ [ L, B ] ], 2: [ [ B, R ] ], 3: [ [ L, R ] ], 4: [ [ R, T ] ], 5: [ [ L, T ], [ R, B ] ], 6: [ [ B, T ] ], 7: [ [ L, T ] ], 8: [ [ T, L ] ], 9: [ [ T, B ] ], 10: [ [ T, R ], [ B, L ] ], 11: [ [ T, R ] ], 12: [ [ R, L ] ], 13: [ [ R, B ] ], 14: [ [ B, L ] ] }[c];
			for(const sg of S) add(sg[0], sg[1]);
		}
		const loops = [];
		while(segs.size){
			const startK = segs.keys().next().value, loop = [];
			let k = startK, guard = 0;
			while(guard++ < 20000){
				const nexts = segs.get(k); if(!nexts || !nexts.length){ segs.delete(k); break; }
				const n = nexts.shift(); if(!nexts.length) segs.delete(k);
				loop.push(n); k = key(n[0], n[1]);
				if(k === startK) break;
			}
			if(loop.length > 4) loops.push(loop);
		}
		let best = null, bestA = 0;
		for(const L of loops){ let a = 0; for(let i = 0; i < L.length; i++){ const p = L[i], q = L[(i + 1) % L.length]; a += p[0] * q[1] - q[0] * p[1]; } a = Math.abs(a) / 2; if(a > bestA){ bestA = a; best = L; } }
		if(!best) return { poly: null, pieces: 0 };
		// grid (padded) → shape space
		let P = best.map(q => [ X0 + (q[0] - 1 + 0.5) * CELL, Y0 + (q[1] - 1 + 0.5) * CELL ]);
		P = simplify(P, 0.03);
		let tries = 0; while(P.length > 120 && tries++ < 8) P = simplify(P, 0.03 * (1 + tries));
		return { poly: P.map(q => [ Math.round(q[0] * 100) / 100, Math.round(q[1] * 100) / 100 ]), pieces: loops.filter(L => L.length > 8).length };
	}
	function simplify(P, eps){
		if(P.length < 8) return P;
		const rdp = (pts) => {
			let dmax = 0, idx = 0; const a = pts[0], b = pts[pts.length - 1];
			for(let i = 1; i < pts.length - 1; i++){
				const p = pts[i], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1e-9;
				const d = Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / l;
				if(d > dmax){ dmax = d; idx = i; }
			}
			if(dmax > eps){ const l = rdp(pts.slice(0, idx + 1)), r = rdp(pts.slice(idx)); return l.slice(0, -1).concat(r); }
			return [ a, b ];
		};
		// split the closed loop at its farthest pair so both halves simplify well
		const n = P.length, half = Math.floor(n / 2);
		const A = rdp(P.slice(0, half + 1)), B = rdp(P.slice(half).concat([ P[0] ]));
		return A.slice(0, -1).concat(B.slice(0, -1));
	}

	/* ---------------------------------------------------------------- the editor */
	let S = null;
	function css(){
		if(document.getElementById('shape-editor-css')) return;
		const st = document.createElement('style'); st.id = 'shape-editor-css';
		st.textContent = `
.se-back{position:fixed;inset:0;z-index:9999;background:rgba(4,6,14,.78);display:flex;align-items:center;justify-content:center;font:13px system-ui,Segoe UI,Arial,sans-serif;color:#dfe7ff}
.se-win{background:#0e1428;border:1px solid #2e3a66;border-radius:14px;box-shadow:0 20px 60px #000c;display:grid;grid-template-columns:150px auto 220px;grid-template-rows:auto auto auto;gap:12px;padding:14px;max-width:98vw;max-height:96vh;overflow:auto}
.se-title{grid-column:1/4;display:flex;align-items:center;gap:10px}
.se-title b{font-size:15px;letter-spacing:.5px;color:#ffd2de}.se-title span{color:#8f9bc4;font-size:12px}
.se-tools{display:flex;flex-direction:column;gap:6px}
.se-btn{background:#17203d;border:1px solid #2e3a66;color:#dfe7ff;border-radius:8px;padding:7px 9px;cursor:pointer;text-align:left;font:inherit}
.se-btn:hover{border-color:#56649c}.se-btn.on{border-color:#ffb3c7;background:#2a1f3a;color:#ffd2de}
.se-btn.ok{background:linear-gradient(#6c4fd6,#4b34a8);border-color:#a58bff;text-align:center;font-weight:600}
.se-small{font-size:11px;color:#8f9bc4;line-height:1.35}
.se-canvas{border-radius:10px;border:1px solid #2e3a66;background:#0a0f1f;cursor:crosshair;touch-action:none;display:block}
.se-pal{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;align-content:start;max-height:${CH}px;overflow:auto;padding-right:4px}
.se-tile{display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 2px;border-radius:8px;border:1px solid #2e3a66;background:#121a33;cursor:grab;color:#c9d3ef;font-size:10.5px;user-select:none}
.se-tile:hover{border-color:#ffb3c7}.se-tile svg{width:100%;height:24px}
.se-foot{grid-column:1/4;display:flex;gap:10px;align-items:center;justify-content:flex-end}
.se-foot .se-msg{margin-right:auto;color:#8f9bc4;font-size:12px}
.se-range{width:100%}
.se-head{grid-column:1/-1;font-size:11px;letter-spacing:.6px;text-transform:uppercase;color:#ffb3c7;margin-top:4px}
.se-head.dim{color:#8f9bc4}
.se-empty{grid-column:1/-1;font-size:11px;color:#8f9bc4;line-height:1.35;padding:2px 2px 6px}
.se-lib{position:relative;cursor:grab}
.se-lib{min-width:0}.se-lib .se-acts{display:flex;gap:2px;margin-top:2px}
.se-lib .se-acts b{font-weight:400;font-size:10px;padding:0 4px;line-height:15px;border-radius:5px;border:1px solid #2e3a66;background:#17203d;color:#c9d3ef;cursor:pointer}
.se-lib .se-acts b:hover{border-color:#ffb3c7;color:#ffd2de}
.se-lib .se-acts b.warn{border-color:#ff7a7a;color:#ffb0b0;background:#3a1620}
.se-lib.cur{border-color:#ffb3c7;background:#2a1f3a}
.se-lib span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.se-name{background:#0a0f1f;border:1px solid #2e3a66;border-radius:8px;color:#dfe7ff;padding:7px 9px;font:inherit;width:150px}
.se-name:focus{outline:none;border-color:#ffb3c7}
.se-lib input{width:62px;font-size:10.5px;background:#0a0f1f;border:1px solid #ffb3c7;color:#dfe7ff;border-radius:5px;padding:1px 3px}`;
		document.head.appendChild(st);
	}
	function svgOf(P){
		const b = bbox(P), w = b.x1 - b.x0, hh = b.y1 - b.y0, k = Math.min(4.6 / (w || 1), 2.6 / (hh || 1));
		const d = P.map((q, i) => (i ? 'L' : 'M') + ((q[0] - (b.x0 + b.x1) / 2) * k).toFixed(2) + ' ' + ((q[1] - (b.y0 + b.y1) / 2) * k).toFixed(2)).join('') + 'Z';
		return '<svg viewBox="-2.6 -1.6 5.2 3.2"><path d="' + d + '" fill="currentColor" opacity=".8"/></svg>';
	}
	const toScr = (x, y) => [ (x - X0) / CELL * SC, (y - Y0) / CELL * SC ];
	const toShape = (px, py) => [ X0 + px / SC * CELL, Y0 + py / SC * CELL ];
	function snapshot(){ return JSON.stringify({ items: S.items, paint: rle(S.paint) }); }
	function pushUndo(){ S.undo.push(snapshot()); if(S.undo.length > 80) S.undo.shift(); }
	function restore(js){ const d = JSON.parse(js); S.items = d.items; S.paint = unrle(d.paint); S.sel = -1; changed(); }
	function maskNow(){
		const m = new Uint8Array(GW * GH), polys = S.items.map(worldPoly), boxes = polys.map(bbox);
		for(let j = 0; j < GH; j++) for(let i = 0; i < GW; i++){
			const k = j * GW + i, pv = S.paint[k];
			if(pv === 2){ m[k] = 0; continue; }
			if(pv === 1){ m[k] = 1; continue; }
			const x = X0 + (i + 0.5) * CELL, y = Y0 + (j + 0.5) * CELL;
			for(let n = 0; n < polys.length; n++){ const b = boxes[n]; if(x < b.x0 || x > b.x1 || y < b.y0 || y > b.y1) continue; if(inPoly(x, y, polys[n])){ m[k] = 1; break; } }
		}
		return m;
	}
	function changed(){ const r = traceOutline(maskNow()); S.outline = r.poly; S.pieces = r.pieces; draw(); }
	function itemAt(x, y){ for(let n = S.items.length - 1; n >= 0; n--) if(inPoly(x, y, worldPoly(S.items[n]))) return n; return -1; }
	/* handles of the selected item (screen space): 8 for stretching, 1 for turning */
	function handles(it){
		const P = polyOf(it.kind, it), b = bbox(P), c = Math.cos(it.rot), s = Math.sin(it.rot);
		const at = (lx, ly) => { const x = lx * it.sx, y = ly * it.sy; return toScr(it.x + x * c - y * s, it.y + x * s + y * c); };
		const mx = (b.x0 + b.x1) / 2, my = (b.y0 + b.y1) / 2, H = [];
		for(const [ hx, hy ] of [ [ b.x0, b.y0 ], [ mx, b.y0 ], [ b.x1, b.y0 ], [ b.x1, my ], [ b.x1, b.y1 ], [ mx, b.y1 ], [ b.x0, b.y1 ], [ b.x0, my ] ]) H.push({ kind: 'scale', lx: hx, ly: hy, p: at(hx, hy) });
		const topLen = (b.y0 - 0.45 / Math.max(0.2, Math.abs(it.sy)));
		H.push({ kind: 'rot', p: at(mx, topLen) });
		return { H, box: [ at(b.x0, b.y0), at(b.x1, b.y0), at(b.x1, b.y1), at(b.x0, b.y1) ], b };
	}
	function draw(){
		const g = S.ctx;
		g.clearRect(0, 0, CW, CH);
		g.fillStyle = '#0a0f1f'; g.fillRect(0, 0, CW, CH);
		// grid + axes
		g.strokeStyle = '#141d38'; g.lineWidth = 1;
		for(let i = 0; i <= GW; i += 4){ g.beginPath(); g.moveTo(i * SC + .5, 0); g.lineTo(i * SC + .5, CH); g.stroke(); }
		for(let j = 0; j <= GH; j += 4){ g.beginPath(); g.moveTo(0, j * SC + .5); g.lineTo(CW, j * SC + .5); g.stroke(); }
		const [ ox, oy ] = toScr(0, 0);
		g.strokeStyle = '#26335e'; g.beginPath(); g.moveTo(0, oy); g.lineTo(CW, oy); g.moveTo(ox, 0); g.lineTo(ox, CH); g.stroke();
		g.fillStyle = '#3d4d85'; g.font = '12px system-ui'; g.fillText('the energy flies this way  →', CW - 190, 18);
		if(S.mirror){ g.setLineDash([ 6, 6 ]); g.strokeStyle = '#7b5cff88'; g.beginPath(); g.moveTo(0, oy); g.lineTo(CW, oy); g.stroke(); g.setLineDash([]); }
		// items
		S.items.forEach((it, n) => {
			const P = worldPoly(it);
			g.beginPath(); P.forEach((q, i) => { const [ x, y ] = toScr(q[0], q[1]); if(i) g.lineTo(x, y); else g.moveTo(x, y); }); g.closePath();
			g.fillStyle = n === S.sel ? '#6c8cff44' : '#4a5a9a33'; g.fill();
			g.strokeStyle = n === S.sel ? '#9fb4ff' : '#4a5a9a'; g.lineWidth = 1; g.stroke();
		});
		// paint
		for(let j = 0; j < GH; j++) for(let i = 0; i < GW; i++){
			const v = S.paint[j * GW + i]; if(!v) continue;
			g.fillStyle = v === 1 ? '#ff9fc255' : '#00000099'; g.fillRect(i * SC, j * SC, SC, SC);
			if(v === 2){ g.strokeStyle = '#ff5d7a44'; g.strokeRect(i * SC + .5, j * SC + .5, SC - 1, SC - 1); }
		}
		// the outline the energy will take
		if(S.outline){
			g.beginPath(); S.outline.forEach((q, i) => { const [ x, y ] = toScr(q[0], q[1]); if(i) g.lineTo(x, y); else g.moveTo(x, y); }); g.closePath();
			g.fillStyle = '#ffb3c722'; g.fill(); g.strokeStyle = '#ffd2de'; g.lineWidth = 2.2; g.shadowColor = '#ffb3c7'; g.shadowBlur = 8; g.stroke(); g.shadowBlur = 0;
		}
		// selection handles
		if(S.sel >= 0 && S.items[S.sel]){
			const Hs = handles(S.items[S.sel]);
			g.strokeStyle = '#9fb4ff'; g.setLineDash([ 4, 4 ]); g.beginPath(); Hs.box.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.stroke(); g.setLineDash([]);
			for(const h of Hs.H){ g.fillStyle = h.kind === 'rot' ? '#ffd2de' : '#9fb4ff'; g.beginPath(); if(h.kind === 'rot') g.arc(h.p[0], h.p[1], 6, 0, 7); else g.rect(h.p[0] - 5, h.p[1] - 5, 10, 10); g.fill(); }
		}
		// brush preview
		if(S.hover && (S.tool === 'brush' || S.tool === 'erase')){ g.strokeStyle = S.tool === 'brush' ? '#ffd2de' : '#ff5d7a'; g.beginPath(); g.arc(S.hover[0], S.hover[1], S.size * SC, 0, 7); g.stroke(); }
		const msg = !S.outline ? 'Draw or drag in a shape — its outline is what the energy will take.' : (S.pieces > 1 ? 'Only the largest connected piece is used — join the pieces to keep them all.' : 'Outline: ' + S.outline.length + ' points.');
		if(!(S.msgHold > Date.now())) S.msg.textContent = msg;
		if(S.libBtn){ S.libBtn.disabled = !S.outline; S.libBtn.style.opacity = S.outline ? 1 : 0.5; }
		S.ok.disabled = !S.outline;
		S.ok.style.opacity = S.outline ? 1 : 0.5;
	}
	function paintAt(px, py, val){
		const ci = px / SC, cj = py / SC, r = S.size;
		const dab = (cy) => {
			for(let j = Math.floor(cy - r); j <= Math.ceil(cy + r); j++) for(let i = Math.floor(ci - r); i <= Math.ceil(ci + r); i++){
				if(i < 0 || j < 0 || i >= GW || j >= GH) continue;
				if(Math.hypot(i + 0.5 - ci, j + 0.5 - cy) <= r) S.paint[j * GW + i] = val;
			}
		};
		dab(cj);
		if(S.mirror) dab(GH - cj);
	}
	function strokeTo(px, py, val){
		const last = S.last || [ px, py ], d = Math.hypot(px - last[0], py - last[1]), n = Math.max(1, Math.ceil(d / (SC * 0.6)));
		for(let k = 1; k <= n; k++) paintAt(last[0] + (px - last[0]) * k / n, last[1] + (py - last[1]) * k / n, val);
		S.last = [ px, py ];
	}
	function local(ev){ const r = S.cv.getBoundingClientRect(); return [ (ev.clientX - r.left) * CW / r.width, (ev.clientY - r.top) * CH / r.height ]; }
	function down(ev){
		const [ px, py ] = local(ev); S.cv.setPointerCapture(ev.pointerId);
		const [ x, y ] = toShape(px, py);
		if(S.tool === 'brush' || S.tool === 'erase'){ pushUndo(); S.last = null; strokeTo(px, py, S.tool === 'brush' ? 1 : 2); S.drag = { kind: 'paint' }; changed(); return; }
		// select tool: a handle of the selected item, an item, or nothing
		if(S.sel >= 0 && S.items[S.sel]){
			const it = S.items[S.sel], Hs = handles(it);
			for(const h of Hs.H) if(Math.hypot(h.p[0] - px, h.p[1] - py) < 9){ pushUndo(); S.drag = { kind: h.kind, h, it, b: Hs.b, sx0: it.sx, sy0: it.sy }; return; }
		}
		const n = itemAt(x, y);
		S.sel = n;
		if(n >= 0){ pushUndo(); const it = S.items[n]; S.drag = { kind: 'move', it, dx: x - it.x, dy: y - it.y }; }
		draw();
	}
	function move(ev){
		const [ px, py ] = local(ev); S.hover = [ px, py ];
		const D = S.drag; if(!D){ if(S.tool !== 'select') draw(); return; }
		const [ x, y ] = toShape(px, py);
		if(D.kind === 'paint'){ strokeTo(px, py, S.tool === 'brush' ? 1 : 2); changed(); return; }
		const it = D.it;
		if(D.kind === 'move'){ it.x = x - D.dx; it.y = y - D.dy; if(ev.shiftKey){ it.x = Math.round(it.x * 10) / 10; it.y = Math.round(it.y * 10) / 10; } }
		else if(D.kind === 'rot'){ let a = Math.atan2(y - it.y, x - it.x) + Math.PI / 2; if(ev.shiftKey) a = Math.round(a / (Math.PI / 12)) * Math.PI / 12; it.rot = a; }
		else if(D.kind === 'scale'){
			// the pointer in the item's own (unturned, unscaled) frame
			const c = Math.cos(-it.rot), s = Math.sin(-it.rot), rx = (x - it.x) * c - (y - it.y) * s, ry = (x - it.x) * s + (y - it.y) * c;
			const h = D.h, useX = Math.abs(h.lx) > 1e-3 && (h.ly === D.b.y0 || h.ly === D.b.y1 ? Math.abs(h.lx - (D.b.x0 + D.b.x1) / 2) > 1e-3 : true), useY = Math.abs(h.ly) > 1e-3 && (h.lx === D.b.x0 || h.lx === D.b.x1 ? Math.abs(h.ly - (D.b.y0 + D.b.y1) / 2) > 1e-3 : true);
			let nsx = useX ? rx / h.lx : it.sx, nsy = useY ? ry / h.ly : it.sy;
			nsx = Math.sign(nsx || 1) * Math.max(0.08, Math.min(4, Math.abs(nsx))); nsy = Math.sign(nsy || 1) * Math.max(0.08, Math.min(4, Math.abs(nsy)));
			if(ev.shiftKey && useX && useY){ const k = Math.max(Math.abs(nsx / D.sx0), Math.abs(nsy / D.sy0)); nsx = D.sx0 * k; nsy = D.sy0 * k; }
			it.sx = nsx; it.sy = nsy;
		}
		changed();
	}
	function up(){ S.drag = null; S.last = null; }
	function addItem(kind, x, y, pts){
		pushUndo();
		const P = pts || polyOf(kind), b = bbox(P), w = b.x1 - b.x0, hh = b.y1 - b.y0, k = Math.min(1, 2.2 / Math.max(w, hh * 1.4));
		const it = { kind, x: x == null ? 0 : x, y: y == null ? 0 : y, sx: k, sy: k, rot: 0 };
		if(pts){ const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2; it.kind = 'poly'; it.pts = pts.map(q => [ q[0] - cx, q[1] - cy ]); }
		S.items.push(it);
		S.sel = S.items.length - 1; S.tool = 'select'; syncTools(); changed();
	}
	function syncTools(){ for(const b of S.toolBtns) b.classList.toggle('on', b.dataset.tool === S.tool); S.mirrorBtn.classList.toggle('on', !!S.mirror); S.cv.style.cursor = S.tool === 'select' ? 'default' : 'crosshair'; }
	function key(ev){
		if(!S) return;
		const tg = ev.target;
		// a key aimed at something behind the editor (a forge button that still had focus) must not activate it:
		// Enter / Space on a focused button would click it (another shape, another spell…)
		if(!(tg && S.back.contains(tg))){
			if(ev.key !== 'Shift' && ev.key !== 'Control' && ev.key !== 'Alt' && ev.key !== 'Meta' && !((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z')) ev.preventDefault();
			try { S.win.focus({ preventScroll: true }); } catch(e){}
		}
		if(tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA') && tg.type !== 'range'){ if(ev.key === 'Escape' || ev.key === 'Enter'){ ev.preventDefault(); if(ev.key === 'Escape') tg.dataset.cancel = '1'; tg.blur(); if(ev.key === 'Enter' && tg.classList.contains('se-name')) saveToLibrary(); } ev.stopPropagation(); return; }      // typing a name never reaches the tools (or the game)
		if(ev.key === 'Escape'){ ev.preventDefault(); close(false); }
		else if((ev.key === 'Delete' || ev.key === 'Backspace') && S.sel >= 0){ ev.preventDefault(); pushUndo(); S.items.splice(S.sel, 1); S.sel = -1; changed(); }
		else if((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z'){ ev.preventDefault(); const u = S.undo.pop(); if(u) restore(u); }
		else if(ev.key === 'b' || ev.key === 'B'){ S.tool = 'brush'; syncTools(); }
		else if(ev.key === 'e' || ev.key === 'E'){ S.tool = 'erase'; syncTools(); }
		else if(ev.key === 'v' || ev.key === 'V'){ S.tool = 'select'; syncTools(); }
		ev.stopPropagation();
	}
	function close(save){
		if(!S) return;
		const s = S; S = null;
		root.ShapeEditor.closedAt = performance.now();
		document.removeEventListener('keydown', key, true);
		if(s.trap) document.removeEventListener('focusin', s.trap, true);
		try { if(document.activeElement && s.back.contains(document.activeElement)) document.activeElement.blur(); } catch(e){}
		if(s.unsub) s.unsub();
		s.back.remove();
		if(save && s.outline && s.onSave) s.onSave(s.outline, { items: s.items, paint: rle(s.paint) });
		else if(!save && s.onCancel) s.onCancel();
	}
	/* drag (or click) a tile onto the canvas: kind is a shape key, or pts gives an outline (a library shape) */
	function dragTile(t, kind, pts){
		t.addEventListener('pointerdown', (ev) => {
			if(ev.target.closest('.se-acts') || ev.target.tagName === 'INPUT') return;
			ev.preventDefault();
			let moved = false;
			const P = pts || polyOf(kind);
			const ghost = document.createElement('div'); ghost.style.cssText = 'position:fixed;z-index:10000;pointer-events:none;width:60px;opacity:.85;color:#ffd2de'; ghost.innerHTML = svgOf(P);
			document.body.appendChild(ghost);
			const mv = (e) => { moved = true; ghost.style.left = (e.clientX - 30) + 'px'; ghost.style.top = (e.clientY - 18) + 'px'; };
			const upf = (e) => {
				host.removeEventListener('pointermove', mv, true); host.removeEventListener('pointerup', upf, true); ghost.remove();
				if(!S) return;
				const r = S.cv.getBoundingClientRect();
				if(e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom){ const [ px, py ] = local(e); const [ x, y ] = toShape(px, py); addItem(kind, x, y, pts); }
				else if(!moved) addItem(kind, 0, 0, pts);
			};
			// listen on the editor's own backdrop (it covers the screen and keeps its events to itself)
			const host = S.back;
			host.addEventListener('pointermove', mv, true); host.addEventListener('pointerup', upf, true);
		});
	}
	function buildPalette(){
		const pal = S.pal; pal.innerHTML = '';
		const head = (txt, dim) => { const d = document.createElement('div'); d.className = 'se-head' + (dim ? ' dim' : ''); d.textContent = txt; pal.appendChild(d); };
		const lib = Library.list();
		head('★ Your library' + (lib.length ? ' (' + lib.length + ')' : ''));
		if(!lib.length){ const e = document.createElement('div'); e.className = 'se-empty'; e.textContent = 'Shapes you save with “★ Save to library” appear here, ready to drag into any drawing.'; pal.appendChild(e); }
		for(const e of lib){
			const t = document.createElement('div'); t.className = 'se-tile se-lib' + (e.id === S.libId ? ' cur' : ''); t.dataset.id = e.id;
			t.title = 'Drag (or click) to add “' + e.name + '” to this drawing';
			t.innerHTML = svgOf(e.poly) + '<span>' + esc(e.name) + '</span><div class="se-acts"><b data-a="open" title="Open this drawing to edit it">⤢</b><b data-a="ren" title="Rename">✎</b><b data-a="del" title="Delete from your library">✕</b></div>';
			t.querySelector('[data-a=open]').addEventListener('click', (ev) => { ev.stopPropagation(); openFromLibrary(e.id); });
			t.querySelector('[data-a=ren]').addEventListener('click', (ev) => {
				ev.stopPropagation();
				const sp = t.querySelector('span'), inp = document.createElement('input'); inp.value = e.name; inp.maxLength = 28; sp.replaceWith(inp); inp.focus(); inp.select();
				let fin = false;
				const done = (ok) => { if(fin) return; fin = true; if(ok && inp.value.trim()){ Library.rename(e.id, inp.value); if(S && S.libId === e.id) S.name.value = inp.value.trim(); } else buildPalette(); };
				inp.addEventListener('blur', () => done(!inp.dataset.cancel));      // Enter / clicking away keeps the name, Esc cancels
			});
			const del = t.querySelector('[data-a=del]');
			del.addEventListener('click', (ev) => {
				ev.stopPropagation();
				if(!del.classList.contains('warn')){ del.classList.add('warn'); del.textContent = 'Delete?'; setTimeout(() => { if(del.isConnected){ del.classList.remove('warn'); del.textContent = '✕'; } }, 2500); return; }
				Library.remove(e.id); if(S && S.libId === e.id) S.libId = null; say('Deleted “' + e.name + '” from your library');
			});
			dragTile(t, 'poly', e.poly);
			pal.appendChild(t);
		}
		head('Shapes', true);
		for(const k of Object.keys(BASIC).concat(Object.keys(ME.SHAPES).filter(k => ME.SHAPES[k].poly && !ME.SHAPES[k].custom))){
			const t = document.createElement('div'); t.className = 'se-tile';
			t.innerHTML = svgOf(polyOf(k)) + '<span>' + (BASIC[k] ? BASIC[k].label : ME.SHAPES[k].label) + '</span>';
			dragTile(t, k, null);
			pal.appendChild(t);
		}
	}
	function esc(x){ return String(x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
	function say(txt){ if(!S || !S.msg) return; S.msg.textContent = txt; S.msgHold = Date.now() + 2500; }
	function saveToLibrary(){
		if(!S) return null;
		if(!S.outline){ say('Draw something first — there is no shape to save yet'); return null; }
		const prev = S.libId && Library.get(S.libId);
		// a new name while editing a saved shape keeps the old one and saves a new copy
		const keepId = prev && (!S.name.value.trim() || S.name.value.trim() === prev.name) ? prev.id : null;
		const e = Library.save(S.name.value || Library.nextName(), S.outline, { items: S.items, paint: rle(S.paint) }, keepId);
		if(!e){ say('Your library is full (' + LIB_MAX + ' shapes) — delete one first'); return null; }
		S.libId = e.id; S.name.value = e.name;
		say((keepId ? 'Updated “' : 'Saved “') + e.name + '” to your library');
		buildPalette();
		return e;
	}
	function openFromLibrary(id){
		const e = Library.get(id); if(!e || !S) return;
		pushUndo();
		if(e.doc && e.doc.items){ S.items = e.doc.items.map(it => Object.assign({}, it)); S.paint = unrle(e.doc.paint); }
		else { S.items = [ { kind: 'poly', pts: e.poly.map(q => [ q[0], q[1] ]), x: 0, y: 0, sx: 1, sy: 1, rot: 0 } ]; S.paint = new Uint8Array(GW * GH); }
		S.sel = -1; S.libId = e.id; S.name.value = e.name;
		changed(); buildPalette(); say('Opened “' + e.name + '” — save it again to update it');
	}
	function open(o){
		o = o || {};
		css();
		if(S) close(false);
		const back = document.createElement('div'); back.className = 'se-back';
		const win = document.createElement('div'); win.className = 'se-win'; back.appendChild(win);
		['mousedown', 'pointerdown', 'mouseup', 'pointerup', 'click', 'dblclick', 'contextmenu', 'wheel', 'keyup', 'keypress', 'input', 'change'].forEach(evn => back.addEventListener(evn, e => e.stopPropagation()));
		win.tabIndex = -1;
		win.style.outline = 'none';
		win.innerHTML = '<div class="se-title"><b>◈ Draw your own shape</b><span>The outline (pink) is the shape the energy is compressed into. Right is forward.</span></div>';
		const tools = document.createElement('div'); tools.className = 'se-tools'; win.appendChild(tools);
		const mid = document.createElement('div'); win.appendChild(mid);
		const pal = document.createElement('div'); win.appendChild(pal);
		const cv = document.createElement('canvas'); cv.width = CW; cv.height = CH; cv.className = 'se-canvas';
		const sc = Math.min(1, (window.innerWidth - 440) / CW, (window.innerHeight - 170) / CH); cv.style.width = Math.round(CW * sc) + 'px'; cv.style.height = Math.round(CH * sc) + 'px';
		mid.appendChild(cv);
		S = { back, win, cv, ctx: cv.getContext('2d'), items: [], paint: new Uint8Array(GW * GH), sel: -1, tool: 'select', size: 3, mirror: false, undo: [], onSave: o.onSave, onCancel: o.onCancel, outline: null, pieces: 0 };
		// start from what it was: an earlier drawing, the drawn outline, or the built-in shape it had
		S.libId = o.libId || null;
		if(!S.libId && (o.poly || null)){ const e = Library.find(o.poly); if(e) S.libId = e.id; }
		if(o.doc && o.doc.items){ S.items = o.doc.items.map(it => Object.assign({}, it)); S.paint = unrle(o.doc.paint); }
		else if(o.poly && o.poly.length > 2) S.items = [ { kind: 'poly', pts: o.poly.map(q => [ q[0], q[1] ]), x: 0, y: 0, sx: 1, sy: 1, rot: 0 } ];
		else if(o.start && ME.SHAPES[o.start] && ME.SHAPES[o.start].poly) S.items = [ { kind: o.start, x: 0, y: 0, sx: 1, sy: 1, rot: 0 } ];
		const btn = (label, tip, fn, cls) => { const b = document.createElement('button'); b.className = 'se-btn' + (cls ? ' ' + cls : ''); b.innerHTML = label; b.title = tip || ''; b.addEventListener('click', fn); return b; };
		S.toolBtns = [];
		for(const [ t, l, tip ] of [ [ 'select', '⬚ Move / resize', 'Drag shapes, stretch them by their square handles, turn them by the round one (V). Shift snaps.' ], [ 'brush', '✎ Brush', 'Paint the shape (B)' ], [ 'erase', '⌫ Eraser', 'Cut parts away (E)' ] ]){
			const b = btn(l, tip, () => { S.tool = t; syncTools(); }); b.dataset.tool = t; S.toolBtns.push(b); tools.appendChild(b);
		}
		const sz = document.createElement('div'); sz.className = 'se-small'; sz.innerHTML = 'Brush size'; const rg = document.createElement('input'); rg.type = 'range'; rg.min = 1; rg.max = 9; rg.value = S.size; rg.className = 'se-range';
		rg.addEventListener('input', () => { S.size = Number(rg.value); }); sz.appendChild(rg); tools.appendChild(sz);
		S.mirrorBtn = btn('⇅ Mirror', 'Paint both halves at once (top and bottom)', () => { S.mirror = !S.mirror; syncTools(); draw(); }); tools.appendChild(S.mirrorBtn);
		tools.appendChild(btn('⧉ Duplicate', 'Copy the selected shape', () => { if(S.sel < 0) return; pushUndo(); const c = JSON.parse(JSON.stringify(S.items[S.sel])); c.x += 0.2; c.y += 0.2; S.items.push(c); S.sel = S.items.length - 1; changed(); }));
		tools.appendChild(btn('⇋ Flip', 'Flip the selected shape front-to-back', () => { if(S.sel < 0) return; pushUndo(); S.items[S.sel].sx *= -1; changed(); }));
		tools.appendChild(btn('✕ Delete', 'Remove the selected shape (Del)', () => { if(S.sel < 0) return; pushUndo(); S.items.splice(S.sel, 1); S.sel = -1; changed(); }));
		tools.appendChild(btn('↶ Undo', 'Ctrl+Z', () => { const u = S.undo.pop(); if(u) restore(u); }));
		tools.appendChild(btn('⟲ Clear', 'Start again from nothing', () => { pushUndo(); S.items = []; S.paint = new Uint8Array(GW * GH); S.sel = -1; changed(); }));
		const tip = document.createElement('div'); tip.className = 'se-small'; tip.textContent = 'Drag shapes in from the right, or click one to add it in the middle.'; tools.appendChild(tip);
		// palette: your library on top, then the built-in shapes and a few basics — dragged (or clicked) onto the canvas
		pal.className = 'se-pal'; S.pal = pal;
		buildPalette();
		S.unsub = Library.onChange(() => { if(S) buildPalette(); });
		const foot = document.createElement('div'); foot.className = 'se-foot'; win.appendChild(foot);
		S.msg = document.createElement('div'); S.msg.className = 'se-msg'; foot.appendChild(S.msg);
		const cur = S.libId && Library.get(S.libId);
		S.name = document.createElement('input'); S.name.className = 'se-name'; S.name.maxLength = 28; S.name.placeholder = 'Name this shape'; S.name.value = cur ? cur.name : '';
		foot.appendChild(S.name);
		S.libBtn = btn('★ Save to library', 'Keep this shape in your library — drag it into any drawing or pick it straight from the forge', () => saveToLibrary());
		foot.appendChild(S.libBtn);
		foot.appendChild(btn('Cancel', 'Esc', () => close(false)));
		S.ok = btn('Use this shape', '', () => close(true), 'ok'); foot.appendChild(S.ok);
		cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
		cv.addEventListener('pointerleave', () => { S && (S.hover = null) && draw(); });
		document.addEventListener('keydown', key, true);
		// take the focus away from whatever opened the editor, so no key can press it again behind the window
		try { if(document.activeElement && document.activeElement.blur) document.activeElement.blur(); } catch(e){}
		document.body.appendChild(back);
		try { win.focus({ preventScroll: true }); } catch(e){}
		S.trap = (e) => { if(S && !back.contains(e.target)) { try { win.focus({ preventScroll: true }); } catch(x){} } };
		document.addEventListener('focusin', S.trap, true);
		syncTools(); changed();
		return S;
	}
	root.ShapeEditor = { open, close: () => close(false), traceOutline, svgOf, Library, saveToLibrary, _state: () => S, GW, GH };
})(typeof window !== 'undefined' ? window : globalThis);
