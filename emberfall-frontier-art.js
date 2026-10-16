/* EmberFall frontier architecture (c55): the painters for the northern open world's landmarks, added onto
   EmberfallArt so placed buildings (bld(type, x, spec)) can use them like the town's houses and towers.
     ruin        broken masonry: walls with jagged tops, empty windows, an optional arch, moss or snow
     ruinGate    the Frostline Gatehouse: two shattered towers, a gate arch with a bent portcullis
     lockworks   the Old Lockworks: two sluice piers, a timber walkway with rails, a winch house and wheel
     aqueduct    the King's Aqueduct: a long arcade, a dry channel on top, fallen spans, a support tower
     mineMouth   a timbered adit: posts, lintel, braces, a lamp and rails running into the dark
     tbridge     a stone-and-timber bridge on piers with a rail that can be broken
     platform    a timber watch platform on four legs
     marker      standing stones: a milepost, boundary stones, a fallen one (with carved signs)
     shelter     a roofless stone hut with fallen rafters
   Painter result: { cv, ox, oy, w, h } — (ox, oy) is the bottom-left of the body at ground level in the canvas. */
(function (global) {
	'use strict';
	const A = global.EmberfallArt;
	const { canvas, pattern, rnd, texRect, sideLight, groundAO, beam, diagBeam, windowAt, door, lantern, crenels } = A;

	function snowCap(g, pts, thick, seed) {
		/* a lumpy cap of snow along a polyline of top points [[x,y],...] */
		const r = rnd(seed || 7);
		g.save();
		g.beginPath();
		g.moveTo(pts[0][0] - 2, pts[0][1] + 2);
		for (const [x, y] of pts) g.lineTo(x, y - thick * (0.6 + r() * 0.5));
		for (let i = pts.length - 1; i >= 0; i--) g.lineTo(pts[i][0], pts[i][1] + thick * 0.35);
		g.closePath();
		const gr = g.createLinearGradient(0, Math.min(...pts.map(p => p[1])) - thick, 0, Math.max(...pts.map(p => p[1])) + thick);
		gr.addColorStop(0, '#ffffff');
		gr.addColorStop(1, '#c9d8e6');
		g.fillStyle = gr;
		g.fill();
		g.restore();
	}
	function mossTop(g, x, y, w) {
		const m = A.img('images/emberfall/moss.png?v=1');
		if (A.ok(m)) for (let k = x; k < x + w; k += 200) g.drawImage(m, (k * 1.3) % 300, 0, Math.min(200, x + w - k), 64, k, y - 6, Math.min(200, x + w - k), 64);
	}

	/* ---------------------------------------------------------------- ruin */
	function ruin(s) {
		const W = s.w || 400, H = s.h || 260;
		const CW = W + 80, CH = H + 120;
		const cv = canvas(CW, CH);
		const g = cv.getContext('2d');
		const bx = 40, gy = CH - 10;
		const r = rnd(s.seed || W + H);
		// the jagged top line: high at the ends, broken down in the middle
		const top = [];
		for (let x = 0; x <= W; x += 18) {
			const t = x / W;
			const profile = s.profile ? s.profile(t) : (0.55 + 0.45 * Math.abs(t - 0.5) * 2);
			const h = H * profile * (0.85 + r() * 0.15) - (r() < 0.25 ? 18 : 0);
			top.push([bx + x, gy - Math.max(20, h)]);
		}
		g.save();
		g.beginPath();
		g.moveTo(bx, gy);
		for (const [x, y] of top) g.lineTo(x, Math.round(y / 18) * 18);
		g.lineTo(bx + W, gy);
		g.closePath();
		g.clip();
		texRect(g, s.tex || 'stone', bx, gy - H - 20, W, H + 20, s.tint || 'rgba(40,36,30,0.12)', s.seed || 0, 0);
		// empty windows / doorways
		for (const wdw of s.windows || []) {
			const wx = bx + wdw[0] * W, wy = gy - wdw[1] * H, ww = wdw[2] || 50, wh = wdw[3] || 70;
			g.fillStyle = 'rgba(12,10,9,0.82)';
			g.beginPath();
			g.moveTo(wx, wy + wh);
			g.lineTo(wx, wy + ww / 2);
			g.arc(wx + ww / 2, wy + ww / 2, ww / 2, Math.PI, 0);
			g.lineTo(wx + ww, wy + wh);
			g.fill();
		}
		if (s.arch) {
			const ax = bx + s.arch[0] * W, aw = s.arch[1] || 120, ah = s.arch[2] || 170;
			g.fillStyle = 'rgba(10,9,8,0.88)';
			g.beginPath();
			g.moveTo(ax, gy);
			g.lineTo(ax, gy - ah + aw / 2);
			g.arc(ax + aw / 2, gy - ah + aw / 2, aw / 2, Math.PI, 0);
			g.lineTo(ax + aw, gy);
			g.fill();
			g.strokeStyle = 'rgba(150,140,126,0.9)';
			g.lineWidth = 12;
			g.beginPath();
			g.arc(ax + aw / 2, gy - ah + aw / 2, aw / 2 + 6, Math.PI, 0);
			g.stroke();
		}
		sideLight(g, bx, gy - H, W, H, 0.3);
		groundAO(g, bx, gy - H, W, H);
		// cracks
		g.strokeStyle = 'rgba(20,16,12,0.5)';
		g.lineWidth = 2;
		for (let k = 0; k < W / 120; k++) {
			let x = bx + r() * W, y = gy - r() * H * 0.6 - 30;
			g.beginPath();
			g.moveTo(x, y);
			for (let q = 0; q < 4; q++) { x += (r() - 0.5) * 30; y += 14 + r() * 20; g.lineTo(x, y); }
			g.stroke();
		}
		g.restore();
		// rubble at the foot
		for (let k = 0; k < W / 40; k++) {
			const x = bx + r() * W, w = 14 + r() * 26;
			texRect(g, 'stone', x, gy - 8 - r() * 10, w, 12 + r() * 8, 'rgba(0,0,0,0.25)', x, 0);
		}
		if (s.snow) snowCap(g, top.map(([x, y]) => [x, Math.round(y / 18) * 18 + 2]), 10, s.seed);
		else if (s.moss !== false) {
			const m = A.img('images/emberfall/moss.png?v=1');
			if (A.ok(m)) for (const [x, y] of top) if (r() < 0.35) g.drawImage(m, (x * 2) % 400, 0, 30, 50, x - 8, Math.round(y / 18) * 18 - 4, 30, 50);
		}
		return { cv, ox: bx, oy: gy, w: W, h: H };
	}

	/* ---------------------------------------------------------------- ruinGate: the Frostline Gatehouse */
	function ruinGate(s) {
		const W = s.w || 820, H = s.h || 520, tw = s.tw || 210;
		const archW = s.archW || 200, archH = s.archH || 270;
		const CW = W + 120, CH = H + 160;
		const cv = canvas(CW, CH);
		const g = cv.getContext('2d');
		const bx = 60, gy = CH - 10;
		const r = rnd(s.seed || 401);
		// the curtain between the towers, broken down over the arch
		const mid0 = bx + tw - 10, mid1 = bx + W - tw + 10;
		g.save();
		g.beginPath();
		g.moveTo(mid0, gy);
		g.lineTo(mid0, gy - H * 0.62);
		for (let x = mid0; x <= mid1; x += 20) g.lineTo(x, gy - H * (0.42 + 0.2 * Math.abs((x - mid0) / (mid1 - mid0) - 0.5) * 2) - r() * 24);
		g.lineTo(mid1, gy);
		g.closePath();
		g.clip();
		texRect(g, 'stoneBig', mid0, gy - H, mid1 - mid0, H, 'rgba(30,30,36,0.12)');
		sideLight(g, mid0, gy - H, mid1 - mid0, H, 0.25);
		g.restore();
		// the gate arch and its bent portcullis
		const ax = bx + W / 2 - archW / 2;
		g.fillStyle = 'rgba(10,10,12,0.9)';
		g.beginPath();
		g.moveTo(ax, gy);
		g.lineTo(ax, gy - archH + archW / 2);
		g.arc(ax + archW / 2, gy - archH + archW / 2, archW / 2, Math.PI, 0);
		g.lineTo(ax + archW, gy);
		g.fill();
		g.strokeStyle = 'rgba(160,156,150,0.95)';
		g.lineWidth = 16;
		g.beginPath();
		g.arc(ax + archW / 2, gy - archH + archW / 2, archW / 2 + 8, Math.PI, 0);
		g.stroke();
		g.strokeStyle = '#2a2622';
		g.lineWidth = 6;
		for (let k = 1; k < 6; k++) {
			const x = ax + k * archW / 6;
			g.beginPath();
			g.moveTo(x, gy - archH + 30);
			g.quadraticCurveTo(x + (k - 3) * 6, gy - archH + 110, x + (k % 2 ? 14 : -10), gy - archH + 150 + (k % 3) * 14);
			g.stroke();
		}
		g.lineWidth = 5;
		for (let k = 0; k < 3; k++) {
			g.beginPath();
			g.moveTo(ax + 6, gy - archH + 50 + k * 40);
			g.lineTo(ax + archW - 6, gy - archH + 60 + k * 36);
			g.stroke();
		}
		// two towers, the right one shattered
		for (const side of [0, 1]) {
			const tx = side ? bx + W - tw : bx;
			const th = side ? H * 0.8 : H;
			g.save();
			g.beginPath();
			g.moveTo(tx, gy);
			g.lineTo(tx, gy - th);
			for (let x = tx; x <= tx + tw; x += 16) g.lineTo(x, gy - th - (side ? (r() * 60 - 40) * ((x - tx) / tw) : (Math.floor((x - tx) / 32) % 2 ? 0 : 36)));
			g.lineTo(tx + tw, gy);
			g.closePath();
			g.clip();
			texRect(g, 'stone', tx, gy - th - 50, tw, th + 50, 'rgba(30,30,40,0.1)', tx, 0);
			for (let y = gy - th + 120; y < gy - 70; y += 150) {
				g.fillStyle = 'rgba(30,26,22,0.4)';
				g.fillRect(tx - 4, y, tw + 8, 9);
			}
			for (let i = 0; i < 2; i++) windowAt(g, tx + tw / 2 - 18, gy - th + 90 + i * 170, 36, 60, { arch: true, lit: false, frame: '#2a2420', sill: '#6a6258' });
			const cg = g.createLinearGradient(tx, 0, tx + tw, 0);
			cg.addColorStop(0, 'rgba(255,240,210,0.2)');
			cg.addColorStop(0.5, 'rgba(0,0,0,0)');
			cg.addColorStop(1, 'rgba(10,8,18,0.5)');
			g.fillStyle = cg;
			g.fillRect(tx, gy - th - 50, tw, th + 50);
			groundAO(g, tx, gy - th, tw, th);
			g.restore();
			if (s.snow) {
				const pts = [];
				for (let x = tx; x <= tx + tw; x += 16) pts.push([x, gy - th - (side ? 0 : (Math.floor((x - tx) / 32) % 2 ? 0 : 36))]);
				snowCap(g, pts, 9, s.seed + side);
			}
		}
		// guardroom doors in the towers
		door(g, bx + tw / 2 - 34, gy - 112, 68, 108, { arch: true, color: '#3a2a1c' });
		if (s.doorR !== false) door(g, bx + W - tw / 2 - 30, gy - 100, 60, 96, { arch: true, color: '#2e2216' });
		// fallen blocks
		for (let k = 0; k < 14; k++) {
			const x = bx + tw + r() * (W - tw * 2), w = 20 + r() * 34;
			texRect(g, 'stone', x, gy - 12 - r() * 12, w, 16 + r() * 10, 'rgba(0,0,0,0.3)', x, 0);
		}
		return { cv, ox: bx, oy: gy, w: W, h: H, door: { x: tw / 2 - 34, w: 68, h: 108 } };
	}

	/* ---------------------------------------------------------------- lockworks: the Old Lockworks sluice */
	function lockworks(s) {
		/* Ground line (oy) = the top of the piers = the walkway level. The channel between the piers drops `d` below. */
		const W = s.w || 620, D = s.d || 330, gap = s.gap || 200;
		const CW = W + 120, CH = D + 380;
		const cv = canvas(CW, CH);
		const g = cv.getContext('2d');
		const bx = 60, gy = 300;                    // walkway level in the canvas
		const pw = (W - gap) / 2;
		const r = rnd(s.seed || 77);
		for (const side of [0, 1]) {
			const px = side ? bx + pw + gap : bx;
			texRect(g, 'stoneBig', px, gy, pw, D + 40, 'rgba(30,34,40,0.18)', px, 0);
			// water stains and weed at the waterline
			const wl = gy + D - 70;
			const st = g.createLinearGradient(0, wl - 90, 0, wl + 20);
			st.addColorStop(0, 'rgba(30,40,30,0)');
			st.addColorStop(1, 'rgba(30,50,36,0.55)');
			g.fillStyle = st;
			g.fillRect(px, wl - 90, pw, 110);
			sideLight(g, px, gy, pw, D + 40, 0.35);
			// cutwater face toward the gap
			g.fillStyle = 'rgba(0,0,0,0.3)';
			g.fillRect(side ? px : px + pw - 12, gy, 12, D + 40);
			// coping
			texRect(g, 'stone', px - 8, gy - 10, pw + 16, 22, 'rgba(255,240,210,0.08)', px, 0);
		}
		// grooves for the gate in the cutwaters
		g.fillStyle = 'rgba(10,10,10,0.6)';
		g.fillRect(bx + pw - 6, gy + 20, 6, D);
		g.fillRect(bx + pw + gap, gy + 20, 6, D);
		// the timber walkway over the gap with rails
		g.fillStyle = A.pattern(g, 'wood', 0, gy - 16);
		g.fillRect(bx - 10, gy - 16, W + 20, 16);
		g.fillStyle = 'rgba(30,18,10,0.35)';
		g.fillRect(bx - 10, gy - 16, W + 20, 16);
		g.fillStyle = 'rgba(255,220,170,0.3)';
		g.fillRect(bx - 10, gy - 16, W + 20, 2);
		g.fillStyle = '#3a2616';
		for (let x = bx - 6; x <= bx + W + 4; x += 52) g.fillRect(x, gy - 76, 7, 62);
		g.fillRect(bx - 10, gy - 80, W + 20, 7);
		g.fillRect(bx - 10, gy - 50, W + 20, 5);
		// the winch house on the right pier: a timber frame with a slate roof (the wheel is drawn live)
		const hx = bx + pw + gap + pw * 0.2, hw = pw * 0.6, hh = 120;
		texRect(g, 'timber', hx, gy - 16 - hh, hw, hh, 'rgba(20,12,6,0.2)', hx, 0);
		beam(g, hx, gy - 16 - hh, 12, hh, '#2b1d12');
		beam(g, hx + hw - 12, gy - 16 - hh, 12, hh, '#2b1d12');
		diagBeam(g, hx + 12, gy - 16, hx + hw - 12, gy - 16 - hh + 14, 8, '#2b1d12');
		A.roofPlane(g, hx - 20, hx + hw + 20, gy - 16 - hh + 6, gy - 16 - hh - 60, 30, 'slate', 5);
		// a sign: "Lock No. 3"
		g.fillStyle = '#5a3c24';
		g.fillRect(bx + 20, gy - 110, 90, 30);
		g.fillStyle = '#e8d8b0';
		g.font = 'bold 13px Georgia';
		g.fillText('LOCK III', bx + 30, gy - 90);
		return { cv, ox: bx, oy: gy, w: W, h: D, wheel: { x: hx + hw / 2 - bx, y: -16 - hh / 2 } };
	}

	/* ---------------------------------------------------------------- aqueduct */
	function aqueduct(s) {
		const W = s.w || 2400, H = s.h || 520, n = s.arches || Math.round(W / 300);
		const CW = W + 60, CH = H + 120;
		const cv = canvas(CW, CH);
		const g = cv.getContext('2d');
		const bx = 30, gy = CH - 10, top = gy - H;
		const aw = W / n;
		const broken = s.broken || [];               // [[fromFrac, toFrac], ...] — spans with the top missing
		const isBroken = (x) => broken.some(([a, b]) => x >= bx + a * W && x <= bx + b * W);
		// the arcade
		g.save();
		g.beginPath();
		g.rect(bx, top + 70, W, H - 70);
		for (let i = 0; i < n; i++) {
			const ax = bx + i * aw + aw * 0.16, awi = aw * 0.68, ah = (H - 70) * 0.78;
			g.moveTo(ax, gy);
			g.lineTo(ax, gy - ah + awi / 2);
			g.arc(ax + awi / 2, gy - ah + awi / 2, awi / 2, Math.PI, 0);
			g.lineTo(ax + awi, gy);
			g.closePath();
		}
		g.clip('evenodd');
		texRect(g, 'stoneBig', bx, top, W, H, s.tint || 'rgba(20,20,30,0.12)');
		const vg = g.createLinearGradient(0, top, 0, gy);
		vg.addColorStop(0, 'rgba(255,240,210,0.12)');
		vg.addColorStop(1, 'rgba(0,0,0,0.4)');
		g.fillStyle = vg;
		g.fillRect(bx, top, W, H);
		g.restore();
		// the channel on top, with broken spans cut away
		for (let x = bx; x < bx + W; x += 8) {
			if (isBroken(x)) continue;
			texRect(g, 'stone', x, top, 8, 72, 'rgba(0,0,0,0.12)', x, 0);
		}
		g.fillStyle = 'rgba(255,240,210,0.25)';
		for (let x = bx; x < bx + W; x += 8) if (!isBroken(x)) g.fillRect(x, top, 8, 3);
		// jagged ends at the breaks, and fallen blocks under them
		const r = rnd(s.seed || 13);
		for (const [a, b] of broken) {
			for (const e of [bx + a * W, bx + b * W]) {
				g.fillStyle = 'rgba(0,0,0,0.35)';
				g.beginPath();
				g.moveTo(e, top);
				for (let k = 0; k < 5; k++) g.lineTo(e + (r() - 0.5) * 18, top + k * 18);
				g.lineTo(e, top + 80);
				g.fill();
			}
			for (let k = 0; k < 8; k++) {
				const x = bx + (a + (b - a) * r()) * W, w = 26 + r() * 40;
				texRect(g, 'stone', x, gy - 14 - r() * 18, w, 20 + r() * 12, 'rgba(0,0,0,0.3)', x, 0);
			}
		}
		// string course and moss / snow on the channel lip
		g.fillStyle = 'rgba(30,26,22,0.45)';
		g.fillRect(bx, top + 70, W, 10);
		if (s.snow) {
			for (let x = bx; x < bx + W; x += 60) if (!isBroken(x + 30)) snowCap(g, [[x, top], [x + 30, top], [x + 60, top]], 8, x);
		} else mossTop(g, bx, top, W);
		// the support tower with its maintenance door
		if (s.tower != null) {
			const tx = bx + s.tower * W - 90, tw2 = 180;
			texRect(g, 'stone', tx, top - 120, tw2, H + 120, 'rgba(20,18,16,0.1)', tx, 0);
			sideLight(g, tx, top - 120, tw2, H + 120, 0.4);
			crenels(g, tx - 6, top - 120, tw2 + 12, 26, 18, 32);
			door(g, tx + tw2 / 2 - 32, gy - 110, 64, 106, { arch: true, color: '#3a2818' });
			if (s.snow) snowCap(g, [[tx - 6, top - 156], [tx + tw2 / 2, top - 158], [tx + tw2 + 6, top - 156]], 9, 3);
		}
		groundAO(g, bx, top, W, H);
		return { cv, ox: bx, oy: gy, w: W, h: H };
	}

	/* ---------------------------------------------------------------- mineMouth */
	function mineMouth(s) {
		const W = s.w || 240, H = s.h || 230;
		const CW = W + 120, CH = H + 80;
		const cv = canvas(CW, CH);
		const g = cv.getContext('2d');
		const bx = 60, gy = CH - 10;
		// the dark inside
		const dg = g.createRadialGradient(bx + W / 2, gy - H * 0.4, 10, bx + W / 2, gy - H * 0.4, W * 0.7);
		dg.addColorStop(0, 'rgba(6,5,5,0.98)');
		dg.addColorStop(1, 'rgba(20,16,12,0.9)');
		g.fillStyle = dg;
		g.fillRect(bx + 18, gy - H + 22, W - 36, H - 22);
		// rails into the dark
		g.strokeStyle = '#4a4440';
		g.lineWidth = 4;
		g.beginPath();
		g.moveTo(bx + W * 0.25, gy - 4);
		g.lineTo(bx + W * 0.42, gy - H * 0.35);
		g.moveTo(bx + W * 0.75, gy - 4);
		g.lineTo(bx + W * 0.58, gy - H * 0.35);
		g.stroke();
		g.fillStyle = '#3a2a1c';
		for (let k = 0; k < 5; k++) {
			const t = k / 5;
			const y = gy - 6 - t * H * 0.33;
			const half = W * (0.27 - t * 0.14);
			g.fillRect(bx + W / 2 - half, y, half * 2, 5);
		}
		// timber frame
		const post = (x) => { g.fillStyle = A.pattern(g, 'wood', x, 0, 1, 1, 90); g.fillRect(x, gy - H, 26, H); g.fillStyle = 'rgba(20,12,6,0.35)'; g.fillRect(x, gy - H, 26, H); g.fillStyle = 'rgba(255,220,170,0.22)'; g.fillRect(x, gy - H, 3, H); };
		post(bx);
		post(bx + W - 26);
		g.fillStyle = A.pattern(g, 'wood', 0, gy - H);
		g.fillRect(bx - 18, gy - H - 26, W + 36, 30);
		g.fillStyle = 'rgba(20,12,6,0.4)';
		g.fillRect(bx - 18, gy - H - 26, W + 36, 30);
		g.fillStyle = 'rgba(255,220,170,0.25)';
		g.fillRect(bx - 18, gy - H - 26, W + 36, 3);
		diagBeam(g, bx + 26, gy - H + 40, bx + 70, gy - H + 4, 9, '#3a2616');
		diagBeam(g, bx + W - 26, gy - H + 40, bx + W - 70, gy - H + 4, 9, '#3a2616');
		lantern(g, bx + W / 2, gy - H + 20);
		if (s.sign) {
			g.fillStyle = '#5a3c24';
			g.fillRect(bx + W / 2 - 70, gy - H - 64, 140, 30);
			g.fillStyle = '#ead9b2';
			g.font = 'bold 13px Georgia';
			g.textAlign = 'center';
			g.fillText(s.sign, bx + W / 2, gy - H - 44);
		}
		if (s.boards) {
			// boarded-up: planks across most of the mouth
			for (let k = 0; k < 4; k++) {
				g.save();
				g.translate(bx + W / 2, gy - H * (0.25 + k * 0.17));
				g.rotate((k % 2 ? 0.08 : -0.06));
				g.fillStyle = A.pattern(g, 'wood', 0, 0);
				g.fillRect(-W / 2 + 10, -10, W - 20, 20);
				g.fillStyle = 'rgba(20,12,6,0.35)';
				g.fillRect(-W / 2 + 10, -10, W - 20, 20);
				g.restore();
			}
		}
		if (s.snow) snowCap(g, [[bx - 18, gy - H - 26], [bx + W / 2, gy - H - 26], [bx + W + 18, gy - H - 26]], 10, 9);
		return { cv, ox: bx, oy: gy, w: W, h: H };
	}

	/* ---------------------------------------------------------------- tbridge: stone piers, timber deck */
	function tbridge(s) {
		/* oy = deck level. Piers drop `d` below it. s.gap = [from, to] fractions where the rail has fallen away. */
		const W = s.w || 1000, D = s.d || 300, piers = s.piers || 2;
		const CW = W + 80, CH = D + 200;
		const cv = canvas(CW, CH);
		const g = cv.getContext('2d');
		const bx = 40, gy = 140;
		for (let i = 0; i < piers; i++) {
			const px = bx + W * (i + 0.5) / piers - 60;
			texRect(g, 'stoneBig', px, gy + 18, 120, D, 'rgba(20,24,30,0.15)', px, 0);
			sideLight(g, px, gy + 18, 120, D, 0.45);
			// cutwater point at the bottom
			g.fillStyle = 'rgba(30,40,36,0.45)';
			g.fillRect(px, gy + D - 70, 120, 88);
		}
		// beams under the deck
		g.fillStyle = '#3e2a19';
		g.fillRect(bx, gy + 14, W, 16);
		for (let i = 0; i <= piers; i++) {
			const x = bx + W * i / piers;
			diagBeam(g, x - (i ? 70 : -10), gy + 30, x + (i < piers ? 70 : -10), gy + 30, 8, '#3a2616');
		}
		for (let i = 0; i < piers; i++) {
			const px = bx + W * (i + 0.5) / piers;
			diagBeam(g, px - 56, gy + 70, px - 160, gy + 26, 10, '#3a2616');
			diagBeam(g, px + 56, gy + 70, px + 160, gy + 26, 10, '#3a2616');
		}
		// the deck
		g.fillStyle = A.pattern(g, 'wood', 0, gy);
		g.fillRect(bx - 6, gy, W + 12, 18);
		g.fillStyle = 'rgba(30,18,10,0.3)';
		g.fillRect(bx - 6, gy, W + 12, 18);
		g.fillStyle = 'rgba(255,220,170,0.3)';
		g.fillRect(bx - 6, gy, W + 12, 2);
		// rail (with a fallen section)
		const gap = s.gap || null;
		const railed = (x) => !gap || x < bx + gap[0] * W || x > bx + gap[1] * W;
		g.fillStyle = '#3a2616';
		for (let x = bx; x <= bx + W; x += 60) if (railed(x)) g.fillRect(x - 3, gy - 66, 7, 66);
		for (let x = bx; x < bx + W; x += 6) if (railed(x)) { g.fillRect(x, gy - 70, 6, 7); g.fillRect(x, gy - 38, 6, 5); }
		if (gap) {
			// a splintered post leaning out over the water
			g.save();
			g.translate(bx + gap[0] * W + 10, gy);
			g.rotate(0.9);
			g.fillRect(-3, -60, 7, 60);
			g.restore();
		}
		if (s.snow) snowCap(g, [[bx - 6, gy], [bx + W / 2, gy], [bx + W + 6, gy]], 6, 21);
		return { cv, ox: bx, oy: gy, w: W, h: D };
	}

	/* ---------------------------------------------------------------- platform: a timber watch platform */
	function platform(s) {
		const W = s.w || 200, H = s.h || 260;
		const CW = W + 80, CH = H + 140;
		const cv = canvas(CW, CH);
		const g = cv.getContext('2d');
		const bx = 40, gy = CH - 10;
		const top = gy - H;
		const leg = (x0, x1) => diagBeam(g, x0, gy, x1, top + 10, 12, '#3a2616');
		leg(bx + 6, bx + 24);
		leg(bx + W - 6, bx + W - 24);
		for (let y = top + 60; y < gy - 30; y += 90) {
			diagBeam(g, bx + 20, y, bx + W - 20, y + 80, 6, '#2e1e12');
			diagBeam(g, bx + W - 20, y, bx + 20, y + 80, 6, '#2e1e12');
		}
		g.fillStyle = A.pattern(g, 'wood', 0, top);
		g.fillRect(bx - 10, top, W + 20, 18);
		g.fillStyle = 'rgba(30,18,10,0.3)';
		g.fillRect(bx - 10, top, W + 20, 18);
		g.fillStyle = '#3a2616';
		for (let x = bx - 8; x <= bx + W + 8; x += 34) g.fillRect(x, top - 50, 6, 50);
		g.fillRect(bx - 10, top - 54, W + 20, 6);
		if (s.roof) {
			g.fillRect(bx, top - 150, 8, 100);
			g.fillRect(bx + W - 8, top - 150, 8, 100);
			A.roofPlane(g, bx - 30, bx + W + 30, top - 140, top - 200, 40, 'thatch', 3);
		}
		if (s.snow) snowCap(g, [[bx - 10, top], [bx + W / 2, top], [bx + W + 10, top]], 7, 31);
		return { cv, ox: bx, oy: gy, w: W, h: H, deck: H };
	}

	/* ---------------------------------------------------------------- marker stones */
	const GLYPHS = ['ᚠ', 'ᚢ', 'ᚦ', 'ᚨ', 'ᚱ', 'ᚲ', 'ᚷ', 'ᚹ', 'ᚺ', 'ᛁ', 'ᛃ', 'ᛇ', 'ᛉ', 'ᛊ', 'ᛏ', 'ᛒ', 'ᛖ', 'ᛗ', 'ᛚ', 'ᛞ', 'ᛟ'];
	function marker(s) {
		/* s.stones = [{ x, w, h, lean, glyph, fallen }] (x relative), s.post = { x, h, w } (a tall milepost) */
		const W = s.w || 300, H = s.h || 260;
		const CW = W + 120, CH = H + 80;
		const cv = canvas(CW, CH);
		const g = cv.getContext('2d');
		const bx = 60, gy = CH - 10;
		const r = rnd(s.seed || 5);
		const stone = (x, w, h, lean, glyph, fallen) => {
			g.save();
			g.translate(bx + x, gy);
			if (fallen) g.rotate(Math.PI / 2 - 0.08);
			else g.rotate(lean || 0);
			g.beginPath();
			g.moveTo(-w / 2, 0);
			g.lineTo(-w / 2 + 4, -h + w * 0.3);
			g.quadraticCurveTo(0, -h - w * 0.12, w / 2 - 4, -h + w * 0.25);
			g.lineTo(w / 2, 0);
			g.closePath();
			g.fillStyle = A.pattern(g, 'cliff', x, 0);
			g.fill();
			g.save();
			g.clip();
			const lg = g.createLinearGradient(-w / 2, 0, w / 2, 0);
			lg.addColorStop(0, 'rgba(255,240,215,0.25)');
			lg.addColorStop(0.5, 'rgba(0,0,0,0)');
			lg.addColorStop(1, 'rgba(10,10,20,0.45)');
			g.fillStyle = lg;
			g.fillRect(-w / 2, -h - 20, w, h + 20);
			g.fillStyle = 'rgba(60,80,40,0.35)';
			g.fillRect(-w / 2, -16, w, 16);
			g.restore();
			if (glyph) {
				g.font = 'bold ' + Math.round(w * 0.5) + 'px serif';
				g.textAlign = 'center';
				g.fillStyle = 'rgba(20,18,14,0.6)';
				g.fillText(glyph, 1, -h * 0.55 + 1);
				g.fillStyle = 'rgba(210,200,170,0.35)';
				g.fillText(glyph, 0, -h * 0.55);
			}
			if (s.snow && !fallen) {
				g.fillStyle = '#f4f8fb';
				g.beginPath();
				g.ellipse(0, -h + w * 0.12, w * 0.45, 7, 0, Math.PI, 0);
				g.fill();
			}
			g.restore();
		};
		if (s.post) {
			const p = s.post;
			stone(p.x, p.w || 54, p.h || 220, p.lean || 0.04, null, false);
			// weathered lettering on the post
			g.save();
			g.translate(bx + p.x, gy - (p.h || 220) * 0.6);
			g.fillStyle = 'rgba(30,26,20,0.55)';
			for (let k = 0; k < 5; k++) g.fillRect(-14 + r() * 6, -30 + k * 14, 18 + r() * 10, 3);
			g.restore();
		}
		for (const st of s.stones || []) stone(st.x, st.w || 40, st.h || 90, st.lean || 0, st.glyph || GLYPHS[(r() * GLYPHS.length) | 0], st.fallen);
		return { cv, ox: bx, oy: gy, w: W, h: H };
	}

	/* ---------------------------------------------------------------- shelter: roofless stone hut */
	function shelter(s) {
		const W = s.w || 300, H = s.h || 170;
		const res = ruin({ w: W, h: H, seed: s.seed || 9, snow: s.snow, windows: [[0.3, 0.75, 40, 46]], arch: [0.62, 70, 130], profile: (t) => 0.75 + 0.25 * Math.sin(t * Math.PI) * (t < 0.5 ? 1 : 0.6) });
		const g = res.cv.getContext('2d');
		// fallen rafters leaning against the wall
		g.save();
		g.strokeStyle = '#3a2616';
		g.lineWidth = 10;
		for (let k = 0; k < 4; k++) {
			g.beginPath();
			g.moveTo(res.ox + W * (0.15 + k * 0.2), res.oy - H * (0.9 - k * 0.1));
			g.lineTo(res.ox + W * (0.3 + k * 0.2), res.oy - 8);
			g.stroke();
		}
		g.restore();
		return res;
	}

	/* ---------------------------------------------------------------- crag: a free-standing rock spire */
	function crag(s) {
		const W = s.w || 260, H = s.h || 700;
		const CW = W + 160, CH = H + 80;
		const cv = canvas(CW, CH);
		const g = cv.getContext('2d');
		const bx = 80, gy = CH - 10;
		const r = rnd(s.seed || 41);
		const L = [], R = [];
		for (let k = 0; k <= 12; k++) {
			const t = k / 12, y = gy - t * H;
			const half = W * 0.5 * (1 - t * 0.55) * (0.8 + r() * 0.35);
			L.push([bx + W / 2 - half - r() * 14, y]);
			R.push([bx + W / 2 + half + r() * 14, y]);
		}
		const topW = (s.flat || 0.4) * W;
		g.save();
		g.beginPath();
		g.moveTo(L[0][0], L[0][1]);
		for (const p of L) g.lineTo(p[0], p[1]);
		g.lineTo(bx + W / 2 - topW / 2, gy - H);
		g.lineTo(bx + W / 2 + topW / 2, gy - H);
		for (let i = R.length - 1; i >= 0; i--) g.lineTo(R[i][0], R[i][1]);
		g.closePath();
		g.fillStyle = A.pattern(g, s.cold ? 'rockfaceCold' : 'rockface', 0, 0);
		g.fill();
		g.clip();
		const lg = g.createLinearGradient(bx, 0, bx + W, 0);
		lg.addColorStop(0, 'rgba(255,240,215,0.22)');
		lg.addColorStop(0.45, 'rgba(0,0,0,0)');
		lg.addColorStop(1, 'rgba(10,10,24,0.55)');
		g.fillStyle = lg;
		g.fillRect(bx - 40, gy - H - 20, W + 80, H + 20);
		const hz = g.createLinearGradient(0, gy - H, 0, gy);
		hz.addColorStop(0, 'rgba(0,0,0,0)');
		hz.addColorStop(1, 'rgba(10,8,6,0.35)');
		g.fillStyle = hz;
		g.fillRect(bx - 40, gy - H, W + 80, H);
		g.restore();
		if (s.snow) snowCap(g, [[bx + W / 2 - topW / 2 - 6, gy - H], [bx + W / 2, gy - H - 2], [bx + W / 2 + topW / 2 + 6, gy - H]], 12, s.seed);
		else mossTop(g, bx + W / 2 - topW / 2, gy - H, topW);
		return { cv, ox: bx, oy: gy, w: W, h: H };
	}

	Object.assign(A, { crag, ruin, ruinGate, lockworks, aqueduct, mineMouth, tbridge, platform, marker, shelter, snowCap });

	/* logs for walls and a snowy roof: extend the house painter */
	const baseHouse = A.house;
	A.house = function (s) {
		const r = baseHouse(s.wall === 'logs' ? Object.assign({ frame: false }, s) : s);
		const g = r.cv.getContext('2d');
		if (s.wall === 'logs') {
			// notched log ends at the corners
			const floors = s.floors || 2, fh = s.fh || 150, plinth = s.plinth == null ? 30 : s.plinth;
			const x0 = r.ox, x1 = r.ox + r.w, yb = r.oy - plinth, yt = yb - floors * fh;
			for (let y = yt; y < yb; y += 22) {
				for (const ex of [x0 - 3, x1 + 3]) {
					g.fillStyle = '#5e3f24';
					g.beginPath(); g.ellipse(ex, y + 11, 9, 10, 0, 0, Math.PI * 2); g.fill();
					g.fillStyle = '#b8935c';
					g.beginPath(); g.ellipse(ex - 1, y + 10, 5, 6, 0, 0, Math.PI * 2); g.fill();
					g.strokeStyle = 'rgba(90,60,30,0.7)';
					g.lineWidth = 1;
					g.beginPath(); g.arc(ex - 1, y + 10, 3, 0, Math.PI * 2); g.stroke();
				}
			}
		}
		if (s.snowRoof) {
			// snow lying on the roof: a pale sheet with darker patches, a thick ridge and a drift along the eave
			const yTop = r.oy - r.roofTop, yEave = r.oy - r.wallTop;
			g.save();
			g.globalCompositeOperation = 'source-atop';
			const sg = g.createLinearGradient(0, yTop, 0, yEave + 10);
			sg.addColorStop(0, 'rgba(250,252,255,0.95)');
			sg.addColorStop(0.7, 'rgba(226,236,245,0.85)');
			sg.addColorStop(1, 'rgba(200,214,228,0.7)');
			g.fillStyle = sg;
			g.fillRect(0, yTop - 20, r.cv.width, yEave - yTop + 14);
			g.restore();
			const rr = rnd(s.seed || 3);
			g.fillStyle = 'rgba(244,248,252,0.98)';
			const pad = 26;
			g.beginPath();
			g.moveTo(r.ox - pad, yEave + 4);
			for (let x = r.ox - pad; x <= r.ox + r.w + pad; x += 20) g.lineTo(x, yEave - 4 - rr() * 6);
			g.lineTo(r.ox + r.w + pad, yEave + 6);
			g.closePath();
			g.fill();
			// icicles off the eave
			for (let x = r.ox - pad + 6; x < r.ox + r.w + pad; x += 11 + rr() * 9) {
				const L = 8 + rr() * 26;
				g.fillStyle = 'rgba(225,242,252,0.95)';
				g.beginPath(); g.moveTo(x - 3, yEave + 3); g.lineTo(x + 3, yEave + 3); g.lineTo(x, yEave + 3 + L); g.fill();
			}
		}
		return r;
	};
})(typeof window !== 'undefined' ? window : globalThis);
