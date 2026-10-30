/* Magma Warden — a hulking obsidian juggernaut with a furnace in its chest and fists like anvils.
   Tiers: base (obsidian, orange seams) · alpha (bronze-trimmed plates) · elder (cracked plating, shoulder vents, chains)
   · tyrant "Molten Tyrant" (white-hot core, plates floating apart on lava, burning obsidian crown and horns). */
(function(G){
	'use strict';
	const A = G.MBArt, { paint, taper, glow, ellipse, at, sample, lerp, clamp, rgba, mix, shade, tint, TAU } = A;

	const TIERS = {
		base:   { rock:'#2e2725', light:'#5c4c44', dark:'#0c0908', shadow:'#181210', trim:'#4a3c34', seam:'#ff6a1a', core:'#ffb347', hot:'#fff0b0', eye:'#ffb347', horn:'#2a2320', hornTip:'#6a564a', cracks:0.3, vents:0, chains:0, crown:0, float:0 },
		alpha:  { rock:'#302826', light:'#64524a', dark:'#0c0908', shadow:'#1a1311', trim:'#c08a3e', seam:'#ff7a22', core:'#ffc25a', hot:'#fff4c0', eye:'#ffc25a', horn:'#2c2420', hornTip:'#e0a64a', cracks:0.5, vents:0, chains:0, crown:0, float:0 },
		elder:  { rock:'#241d1b', light:'#544640', dark:'#0b0807', shadow:'#1a1412', trim:'#8a5a34', seam:'#ff5410', core:'#ffa030', hot:'#fff2b8', eye:'#ffd070', horn:'#1e1714', hornTip:'#ff8a3a', cracks:1, vents:1, chains:1, crown:0, float:0 },
		tyrant: { rock:'#18110f', light:'#5a4038', dark:'#050303', shadow:'#0e0907', trim:'#ffb04a', seam:'#ff4a08', core:'#fff6d0', hot:'#ffffff', eye:'#ffffff', horn:'#120c0a', hornTip:'#ffd27a', cracks:1.6, vents:1.4, chains:0, crown:1, float:1 },
	};
	const LINE = 'rgba(6,3,2,0.96)';
	const HIP = 74, THIGH = 36, SHIN = 38, UPPER = 44, FORE = 46, SH_Y = 84;
	const IDLE = { bob:0, lean:0.08, head:0, nT:-0.22, nS:0.2, fT:0.26, fS:0.12, nU:-0.08, nF:-0.3, fU:0.18, fF:-0.15, fistN:0, fistF:0, glow:0.6, rootX:0, lift:0, grounded:1, fall:0, crouch:0, kneel:0, roar:0, smear:0, smearA:0, crumble:0 };

	function legEnd(hx, hy, t, s){ const kx = hx - Math.sin(t) * THIGH, ky = hy + Math.cos(t) * THIGH; const a = t + s; return [kx, ky, kx - Math.sin(a) * SHIN, ky + Math.cos(a) * SHIN]; }
	function stone(c, T, pts, dk, o){
		o = o || {};
		paint(c, pts, Object.assign({ fill: mix(T.rock, '#000', dk), light: mix(T.light, '#000', dk), dark: T.dark, cel: [5, -4, mix(T.shadow, '#000', dk)], spec: dk < 0.2 ? 'rgba(255,150,90,0.1)' : null, lw: 3.5, line: LINE, lx: 0.15, lx2: 0.85, smooth: 0.32 }, o));
	}
	// glowing seam polyline
	function seam(c, T, pts, w, a){
		c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; c.lineJoin = 'round';
		c.shadowColor = T.seam; c.shadowBlur = 10;
		c.strokeStyle = rgba(T.seam, a == null ? 0.95 : a); c.lineWidth = w || 3;
		c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for(let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.stroke();
		c.shadowBlur = 0; c.strokeStyle = rgba(T.hot, (a == null ? 0.95 : a) * 0.7); c.lineWidth = Math.max(1, (w || 3) * 0.35); c.stroke();
		c.restore();
	}
	function flame(c, T, x, y, h, w, seed, t){
		const r = A.rng(seed);
		c.save(); c.globalCompositeOperation = 'lighter';
		for(let k = 0; k < 3; k++){
			const ph = t * TAU + r() * 6, hh = h * (0.6 + 0.4 * Math.sin(ph) * 0.5 + r() * 0.3) * (1 - k * 0.22), ww = w * (1 - k * 0.3);
			const g = c.createLinearGradient(x, y, x, y - hh);
			g.addColorStop(0, rgba(k ? T.core : T.seam, 0.85)); g.addColorStop(0.6, rgba(k === 2 ? T.hot : T.seam, 0.5)); g.addColorStop(1, rgba(T.seam, 0));
			c.fillStyle = g; c.beginPath();
			c.moveTo(x - ww, y); c.quadraticCurveTo(x - ww * 0.8, y - hh * 0.5, x + Math.sin(ph) * ww * 0.4, y - hh); c.quadraticCurveTo(x + ww * 0.8, y - hh * 0.5, x + ww, y); c.closePath(); c.fill();
		}
		c.restore();
	}

	function drawLeg(c, T, P, hx, hy, t, s, near){
		const [kx, ky, fx, fy] = legEnd(hx, hy, t, s);
		const dk = near ? 0 : 0.3;
		at(c, hx, hy, t, () => stone(c, T, [[-17, -6], [16, -6], [15, THIGH + 2], [-15, THIGH + 2]], dk));
		at(c, kx, ky, t + s, () => {
			stone(c, T, [[-15, -2], [15, -2], [19, SHIN * 0.6], [17, SHIN + 2], [-17, SHIN + 2], [-18, SHIN * 0.5]], dk);
			if(T.cracks > 0.4) seam(c, T, [[-6, 6], [2, 18], [-4, 30]], 2.5, near ? 0.9 : 0.5);
		});
		at(c, kx + 2, ky, 0, () => { stone(c, T, [[-15, -11], [13, -12], [17, 0], [12, 11], [-14, 10]], dk + 0.05, { fill: mix(T.trim, '#000', dk + 0.1) }); glow(c, 2, 0, 12, T.seam, near ? 0.55 : 0.25); });
		at(c, fx, fy, 0, () => stone(c, T, [[-19, -14], [10, -15], [30, -6], [32, 2], [-21, 2]], dk + 0.06, { smooth: 0.2 }));
	}
	function drawTorso(c, T, P){
		const g = P.glow;
		// lava glow behind floating plates (tyrant)
		if(T.float) glow(c, 0, -60, 90, T.seam, 0.5 + 0.2 * g);
		const fo = T.float * 4;
		// belly / hips
		stone(c, T, [[-36, 4], [36, 4], [40, -18], [34, -34], [-34, -34], [-40, -18]], 0.12, { smooth: 0.25 });
		// chest barrel
		const chest = [[-52 - fo, -30], [52 + fo, -30], [60 + fo, -64], [54 + fo, -96], [28, -114 - fo], [-26, -114 - fo], [-54 - fo, -98], [-60 - fo, -64]];
		stone(c, T, chest, 0, { lw: 4, rim: 'rgba(255,170,110,0.35)', rimW: 6 });
		// furnace grille
		c.save();
		const gx = -2, gy = -70;
		paint(c, [[gx - 26, gy - 26], [gx + 30, gy - 26], [gx + 26, gy + 26], [gx - 22, gy + 26]], { fill: '#120604', line: LINE, lw: 3, smooth: 0.3 });
		const gg = c.createRadialGradient(gx + 2, gy, 2, gx + 2, gy, 34);
		gg.addColorStop(0, rgba(T.hot, 0.95)); gg.addColorStop(0.35, rgba(T.core, 0.9 * (0.6 + 0.4 * g))); gg.addColorStop(1, rgba(T.seam, 0.15));
		c.fillStyle = gg; c.beginPath(); c.moveTo(gx - 22, gy - 22); c.lineTo(gx + 26, gy - 22); c.lineTo(gx + 22, gy + 22); c.lineTo(gx - 18, gy + 22); c.closePath(); c.fill();
		c.restore();
		for(let i = 0; i < 5; i++){
			const x = gx - 18 + i * 10;
			paint(c, [[x - 2.5, gy - 24], [x + 2.5, gy - 24], [x + 2, gy + 24], [x - 2, gy + 24]], { fill: mix(T.rock, '#000', 0.2), light: T.light, dark: T.dark, line: LINE, lw: 1.5, smooth: false });
		}
		glow(c, gx + 2, gy, 46 + 30 * g, T.core, 0.35 + 0.35 * g);
		// plate seams
		seam(c, T, [[-50, -34], [-40, -50], [-48, -66]], 3, 0.8);
		seam(c, T, [[50, -34], [44, -52], [52, -70]], 3, 0.8);
		seam(c, T, [[-30, -110], [-14, -100], [16, -102], [30, -110]], 2.5, 0.7);
		if(T.cracks > 0.4){ seam(c, T, [[-38, -86], [-30, -78], [-36, -66], [-28, -56]], 2.5, 0.85); seam(c, T, [[36, -88], [30, -80], [38, -70]], 2.5, 0.85); }
		if(T.cracks > 1.2){ seam(c, T, [[-20, -10], [-6, -22], [8, -12], [22, -24]], 3.5, 0.95); }
		// trim band
		taper(c, [[-36, -32], [36, -32]], 6, 6, mix(T.trim, '#000', 0.1), LINE);
		// chains (elder)
		if(T.chains){
			c.save(); c.strokeStyle = '#4a4440'; c.lineWidth = 4;
			for(let i = 0; i < 9; i++){ const u = i / 8, x = lerp(-50, 46, u), y = lerp(-104, -40, u) + Math.sin(u * 3) * 6; ellipse(c, x, y, 6, 4, null, '#222', 3.5, u * 1.2); ellipse(c, x, y, 6, 4, null, '#77706a', 1.5, u * 1.2); }
			c.restore();
		}
	}
	function drawHead(c, T, P){
		at(c, 4, -SH_Y - 26, P.head, () => {
			// horns (behind)
			const hl = 1 + T.crown * 0.55;
			for(const s of [-1, 1]){
				const bx = s * 16 - 2, dk = s < 0 ? 0.35 : 0;
				const pts = [[bx, -12], [bx + s * 24 * hl, -16 * hl], [bx + s * 40 * hl, -30 * hl], [bx + s * 44 * hl, -50 * hl], [bx + s * 36 * hl, -66 * hl]];
				taper(c, pts, 22 * hl, 3, mix(T.horn, '#000', dk), LINE);
				taper(c, pts.slice(2), 12 * hl, 2, mix(T.hornTip, '#000', dk + 0.1));
				c.save(); c.strokeStyle = rgba('#000', 0.5); c.lineWidth = 1.5; for(let k = 1; k < 4; k++){ const p = pts[k]; c.beginPath(); c.moveTo(p[0] - 7, p[1] + 3); c.lineTo(p[0] + 7, p[1] - 3); c.stroke(); } c.restore();
				if(T.crown) flame(c, T, bx + s * 36 * hl, -66 * hl, 34, 10, 11 + s, P.t || 0);
			}
			// helm
			stone(c, T, [[-24, 8], [26, 8], [30, -10], [24, -30], [4, -36], [-18, -32], [-28, -14]], 0, { rim: 'rgba(255,170,110,0.35)' });
			// face slit / grille
			paint(c, [[-6, -18], [26, -19], [26, -8], [-6, -7]], { fill: '#100503', line: LINE, lw: 2, smooth: 0.15 });
			glow(c, 14, -13, 18 + 14 * P.glow, T.eye, 0.7);
			c.save(); c.fillStyle = rgba(T.hot, 0.9); c.fillRect(4, -15, 18, 3.5); c.restore();
			if(P.roar > 0.1){ glow(c, 22, -8, 30 * P.roar, T.core, 0.6 * P.roar); }
			taper(c, [[-24, -2], [28, -2]], 5, 5, mix(T.trim, '#000', 0.15), LINE);
			if(T.crown){
				for(let i = 0; i < 5; i++){
					const x = -14 + i * 8, h = 14 + (i === 2 ? 14 : (i % 2 ? 4 : 9));
					paint(c, [[x - 4, -32], [x + 4, -32], [x, -32 - h]], { fill: '#1a1010', light: '#5a3a30', dark: '#000', line: LINE, lw: 2, smooth: false });
					flame(c, T, x, -32 - h + 4, 16, 5, 30 + i, P.t || 0);
				}
			}
		});
	}
	function drawShoulder(c, T, P, near){
		const dk = near ? 0 : 0.32;
		at(c, near ? 40 : -40, -SH_Y - 6, 0, () => {
			stone(c, T, [[-36, 14], [-38, -16], [-16, -36], [20, -34], [40, -12], [38, 18], [2, 28]], dk, { rim: near ? 'rgba(255,150,90,0.35)' : null });
			stone(c, T, [[-30, 18], [30, 20], [28, 32], [-28, 30]], dk + 0.12, { smooth: 0.3 });
			// spikes
			for(let i = 0; i < 3; i++){
				const x = -16 + i * 14, h = 16 + i * 4 + T.crown * 8;
				paint(c, [[x - 6, -22 + i * 2], [x + 6, -24 + i * 2], [x + 2, -24 - h]], { fill: mix(T.horn, '#000', dk), light: mix(T.hornTip, '#000', dk), dark: T.dark, line: LINE, lw: 2, smooth: false });
			}
			seam(c, T, [[-24, 4], [-8, 10], [12, 6], [24, 12]], 2.5, near ? 0.85 : 0.45);
			if(T.vents){
				ellipse(c, 4, -18, 9, 5, '#0d0504', LINE, 2);
				flame(c, T, 4, -18, 28 + T.vents * 14, 8, near ? 5 : 6, P.t || 0);
			}
		});
	}
	function drawArm(c, T, P, sx, sy, up, fore, fist, near){
		const dk = near ? 0 : 0.32;
		const ex = sx - Math.sin(up) * UPPER, ey = sy + Math.cos(up) * UPPER;
		at(c, sx, sy, up, () => stone(c, T, [[-15, -4], [15, -4], [13, UPPER], [-13, UPPER]], dk));
		at(c, ex, ey, fore, () => {
			stone(c, T, [[-15, -4], [15, -4], [22, FORE * 0.7], [20, FORE + 4], [-20, FORE + 4], [-22, FORE * 0.65]], dk);
			seam(c, T, [[-8, 8], [0, 20], [-6, 32]], 2.5, near ? 0.8 : 0.4);
			// the fist
			at(c, 0, FORE + 12, 0, () => {
				stone(c, T, [[-21, -12], [21, -12], [25, 6], [18, 20], [-18, 20], [-25, 6]], dk + 0.03, { smooth: 0.45 });
				for(let i = 0; i < 4; i++) ellipse(c, -13 + i * 8.7, 15, 4.5, 4, mix(T.trim, '#000', dk + 0.1), LINE, 1.5);
				if(fist > 0.05){ glow(c, 0, 10, 40 * fist, T.core, 0.75 * fist); seam(c, T, [[-14, 2], [0, 8], [14, 2]], 3, fist); }
			});
		});
		ellipse(c, ex, ey, 13, 12, mix(T.trim, '#000', dk + 0.15), LINE, 2.5);
		glow(c, ex, ey, 10, T.seam, near ? 0.45 : 0.2);
	}
	function drawSmear(c, T, x, y, r0, r1, a0, a1, alpha){
		if(alpha <= 0.02) return;
		c.save(); c.globalCompositeOperation = 'lighter';
		for(let i = 0; i < 14; i++){
			const u1 = (i + 1) / 14, ang0 = lerp(a0, a1, i / 14), ang1 = lerp(a0, a1, u1), aa = Math.pow(u1, 1.5) * alpha;
			c.beginPath(); c.arc(x, y, (r0 + r1) / 2, Math.min(ang0, ang1), Math.max(ang0, ang1));
			c.strokeStyle = rgba(T.seam, aa * 0.55); c.lineWidth = (r1 - r0) * u1; c.stroke();
		}
		c.restore();
	}

	function draw(c, P, tierName, t){
		const T = TIERS[tierName] || TIERS.base;
		P.t = t || 0;
		const hy = -HIP + P.crouch * 16 + P.kneel * 26;
		const nL = legEnd(10, hy, P.nT, P.nS), fL = legEnd(-10, hy, P.fT, P.fS);
		const footY = Math.max(nL[3], fL[3]) + 2;
		const rootY = P.grounded ? -footY : -P.lift;
		c.save();
		c.translate(P.rootX, rootY + P.bob);
		if(P.grounded || P.lift < 30) at(c, 0, footY, 0, () => A.shadow(c, 92, 0.5));
		if(P.fall){ c.translate(0, footY); c.rotate(P.fall); c.translate(0, -footY); }
		if(P.crumble > 0){ c.globalAlpha = 1 - P.crumble * 0.85; }
		const upper = (fn) => at(c, 0, hy, P.lean, fn);
		const nSh = [40, -SH_Y + 6], fSh = [-40, -SH_Y + 8];
		upper(() => { drawShoulder(c, T, P, false); drawArm(c, T, P, fSh[0], fSh[1], P.fU, P.fF, P.fistF, false); });
		drawLeg(c, T, P, -10, hy, P.fT, P.fS, false);
		upper(() => drawTorso(c, T, P));
		drawLeg(c, T, P, 10, hy, P.nT, P.nS, true);
		upper(() => {
			drawHead(c, T, P);
			drawSmear(c, T, nSh[0], nSh[1], 70, 120, P.smearA - 1.4, P.smearA, P.smear);
			drawShoulder(c, T, P, true);
			drawArm(c, T, P, nSh[0], nSh[1], P.nU, P.nF, P.fistN, true);
		});
		// drips (tyrant) and embers
		if(T.float){
			const r = A.rng(17);
			for(let i = 0; i < 6; i++){ const x = -50 + r() * 100, y = hy - 30 - r() * 70 + ((P.t * 60 + i * 13) % 40); glow(c, x, y, 6, T.core, 0.7); }
		}
		c.restore();
	}

	const S = (keys) => (t) => Object.assign({}, IDLE, sample(keys, t));
	const G0 = { nU: -0.08, nF: -0.3, fU: 0.18, fF: -0.15, lean: 0.08 };
	const ANIMS = {
		idle: (t) => {
			const b = Math.sin(t * TAU);
			return Object.assign({}, IDLE, { bob: b * 2.4, lean: 0.08 + b * 0.02, head: b * 0.03, nU: -0.08 + b * 0.05, nF: -0.3, fU: 0.18 - b * 0.05, fF: -0.15, glow: 0.5 + 0.45 * (0.5 + 0.5 * b) });
		},
		move: (t) => {
			const p = t * TAU, s = Math.sin(p);
			return Object.assign({}, IDLE, {
				nT: -s * 0.36, nS: 0.12 + Math.max(0, Math.cos(p)) * 0.5, fT: s * 0.36, fS: 0.12 + Math.max(0, -Math.cos(p)) * 0.5,
				bob: -Math.abs(Math.cos(p)) * 6, lean: 0.16 + Math.abs(s) * 0.03, nU: -0.08 + s * 0.3, nF: -0.3, fU: 0.18 - s * 0.3, fF: -0.15, head: 0.04 * s, glow: 0.6,
			});
		},
		// haymaker
		attackA: S([
			[0, G0],
			[0.32, { nU: 1.3, nF: 0.9, fU: -0.3, fF: -0.9, lean: -0.12, crouch: 0.35, nT: 0.05, fT: 0.4, fistN: 0.8, glow: 0.9, head: -0.06 }],
			[0.5, { nU: -1.55, nF: -1.6, fU: 0.6, fF: 0.2, lean: 0.4, crouch: 0.35, nT: -0.55, nS: 0.4, fT: 0.5, fS: 0.3, rootX: 22, fistN: 1, smear: 1, smearA: -0.15, glow: 1 }],
			[0.66, { nU: -1.6, nF: -1.62, fU: 0.6, fF: 0.2, lean: 0.42, crouch: 0.3, nT: -0.55, nS: 0.4, fT: 0.5, fS: 0.3, rootX: 24, fistN: 0.6, smear: 0.3, smearA: 0.1 }],
			[1, G0],
		]),
		// double-fist ground pound
		attackB: S([
			[0, G0],
			[0.38, { nU: 3.0, nF: 3.0, fU: 2.9, fF: 2.9, lean: -0.2, head: -0.2, crouch: 0, nT: -0.1, fT: 0.2, fistN: 0.9, fistF: 0.9, glow: 1 }],
			[0.56, { nU: -0.7, nF: -0.2, fU: -0.5, fF: -0.1, lean: 0.55, head: 0.15, crouch: 1, nT: -0.55, nS: 1.0, fT: 0.6, fS: 1.0, fistN: 1, fistF: 1, smear: 0.9, smearA: 1.2, glow: 1 }],
			[0.8, { nU: -0.72, nF: -0.2, fU: -0.52, fF: -0.1, lean: 0.55, crouch: 1, nT: -0.55, nS: 1.0, fT: 0.6, fS: 1.0, fistN: 0.4, fistF: 0.4 }],
			[1, G0],
		]),
		// furnace roar / eruption
		cast: S([
			[0, G0],
			[0.3, { nU: 0.6, nF: 0.4, fU: 0.8, fF: 0.6, lean: 0.15, crouch: 0.4, head: 0.15, glow: 0.8 }],
			[0.55, { nU: 2.2, nF: 1.6, fU: 2.0, fF: 1.4, lean: -0.3, head: -0.35, crouch: 0.05, roar: 1, glow: 1.6, fistN: 0.6, fistF: 0.6 }],
			[0.85, { nU: 2.1, nF: 1.5, fU: 1.9, fF: 1.3, lean: -0.28, head: -0.32, crouch: 0.05, roar: 0.9, glow: 1.5 }],
			[1, G0],
		]),
		// shoulder charge
		special: S([
			[0, G0],
			[0.25, { lean: 0.6, crouch: 0.6, nU: -0.9, nF: -1.4, fU: 0.4, fF: 0.6, nT: -0.4, nS: 0.8, fT: 0.7, fS: 0.6, glow: 0.9, head: 0.2 }],
			[0.5, { lean: 0.75, crouch: 0.5, nU: -1.2, nF: -1.5, fU: 0.9, fF: 1.2, nT: -0.8, nS: 0.4, fT: 0.7, fS: 1.0, rootX: 30, smear: 0.7, smearA: 0.2, glow: 1, fistN: 0.7 }],
			[0.75, { lean: 0.75, crouch: 0.5, nU: -1.2, nF: -1.5, fU: 0.9, fF: 1.2, nT: 0.3, nS: 1.0, fT: -0.5, fS: 0.4, rootX: 36, glow: 1 }],
			[1, G0],
		]),
		hurt: S([
			[0, G0],
			[0.25, { lean: -0.28, head: -0.3, nU: 0.5, nF: 0.2, fU: 0.6, fF: 0.3, rootX: -10, glow: 1.4 }],
			[0.6, { lean: -0.12, head: -0.1, rootX: -6, glow: 1 }],
			[1, G0],
		]),
		death: (t) => Object.assign({}, IDLE, sample([
			[0, Object.assign({ glow: 0.8 }, G0)],
			[0.3, { kneel: 0.9, lean: 0.3, nT: -1.1, nS: 1.7, fT: 0.4, fS: 1.6, nU: 0.2, nF: 0.4, fU: 0.4, fF: 0.6, head: 0.3, glow: 1.2, crouch: 0.4 }],
			[0.6, { kneel: 1, lean: 0.5, nT: -1.2, nS: 1.9, fT: 0.6, fS: 1.8, nU: -0.3, nF: 0.1, fU: 0.1, fF: 0.2, head: 0.5, glow: 0.4, crouch: 0.6 }],
			[1, { kneel: 1, lean: 0.95, nT: -1.2, nS: 1.9, fT: 0.6, fS: 1.8, nU: -0.9, nF: -0.4, fU: -0.6, fF: -0.2, head: 0.6, glow: 0, crouch: 0.8, crumble: 0.45, fall: 0.08 }],
		], t)),
	};
	A.bosses.warden = { name: 'Magma Warden', TIERS, draw, ANIMS, scale: 0.8, footY: 278, bodyH: 180, flier: false };
})(typeof window !== 'undefined' ? window : globalThis);
