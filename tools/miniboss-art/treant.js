/* Elder Treant — an ancient walking tree: root legs, a bark trunk with a face, branch arms ending in twig claws,
   a canopy crown. Tiers: base (green canopy) · alpha (blossoming canopy, moss) · elder (mossy, mushrooms, glowing rune
   cracks, fireflies) · tyrant "Blighted Elder" (charred bark, a burning crimson canopy, a crown of black antler-branches,
   molten amber sap). */
(function(G){
	'use strict';
	const A = G.MBArt, { paint, taper, glow, ellipse, at, sample, lerp, clamp, rgba, mix, shade, tint, TAU } = A;
	const TIERS = {
		base:   { bark:'#5a3d26', light:'#9a7048', dark:'#20140a', shadow:'#36230f', leaf:'#3c7a34', leafLight:'#86b850', leafDark:'#183a18', eye:'#9dff6a', sap:'#9dff6a', moss:0.2, blossom:0, shrooms:0, runes:0, thorns:0, embers:0, antlers:0 },
		alpha:  { bark:'#5e4028', light:'#a2784e', dark:'#20140a', shadow:'#38250f', leaf:'#45863a', leafLight:'#98c860', leafDark:'#1a421c', eye:'#c4ff7a', sap:'#c4ff7a', moss:0.6, blossom:1, shrooms:0, runes:0, thorns:0, embers:0, antlers:0 },
		elder:  { bark:'#4a3524', light:'#86684a', dark:'#160e06', shadow:'#2c1d0e', leaf:'#2a6a40', leafLight:'#6ab888', leafDark:'#0e2e1a', eye:'#7affd2', sap:'#7affd2', moss:1, blossom:0, shrooms:1, runes:1, thorns:0, embers:0, antlers:0 },
		tyrant: { bark:'#2a1a14', light:'#5e3a28', dark:'#0a0504', shadow:'#160c08', leaf:'#a3241a', leafLight:'#ff8a3a', leafDark:'#3a0806', eye:'#ffb020', sap:'#ffb020', moss:0, blossom:0, shrooms:0, runes:1.4, thorns:1, embers:1, antlers:1 },
	};
	const LINE = 'rgba(10,6,2,0.96)';
	const HIP = 70, THIGH = 36, SHIN = 38, SH_Y = 96, UPPER = 50, FORE = 52;
	const IDLE = { bob:0, lean:0.04, head:0, nT:-0.2, nS:0.18, fT:0.24, fS:0.1, nU:0.1, nF:-0.25, fU:0.3, fF:-0.1, claw:0, canopy:0, glow:0.6, rootX:0, crouch:0, kneel:0, fall:0, crumble:0, mouth:0, rootsOut:0 };

	function legEnd(hx, hy, t, s){ const kx = hx - Math.sin(t) * THIGH, ky = hy + Math.cos(t) * THIGH; const a = t + s; return [kx, ky, kx - Math.sin(a) * SHIN, ky + Math.cos(a) * SHIN]; }
	function bark(c, T, pts, dk, o){
		paint(c, pts, Object.assign({ fill: mix(T.bark, '#000', dk), light: mix(T.light, '#000', dk), dark: mix(T.dark, '#000', dk * 0.5), cel: [5, -3, mix(T.shadow, '#000', dk)], lw: 3.5, line: LINE, lx: 0.1, lx2: 0.9, smooth: 0.38 }, o || {}));
	}
	function grooves(c, T, x0, y0, x1, y1, n, seed, a){
		const r = A.rng(seed);
		c.save(); c.strokeStyle = rgba(T.dark, a || 0.6); c.lineWidth = 2; c.lineCap = 'round';
		for(let i = 0; i < n; i++){
			const x = lerp(x0, x1, (i + 0.5) / n) + (r() - 0.5) * 4;
			c.beginPath(); c.moveTo(x, y0 + r() * 8);
			c.bezierCurveTo(x + (r() - 0.5) * 8, lerp(y0, y1, 0.33), x + (r() - 0.5) * 8, lerp(y0, y1, 0.66), x + (r() - 0.5) * 6, y1 - r() * 8);
			c.stroke();
		}
		c.restore();
	}
	function runeCrack(c, T, pts, w, a){
		c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; c.lineJoin = 'round';
		c.shadowColor = T.sap; c.shadowBlur = 10; c.strokeStyle = rgba(T.sap, a); c.lineWidth = w;
		c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for(let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.stroke();
		c.restore();
	}
	// a cloud of leaves: many soft overlapping lumps, darker at the bottom, with lighter leaf flecks on top
	function leafCluster(c, T, x, y, r, seed, sway){
		const rr = A.rng(seed);
		const lumps = [];
		for(let k = 0; k < 9; k++){ const a = rr() * TAU, d = Math.sqrt(rr()) * r * 0.62; lumps.push([x + Math.cos(a) * d + sway * 5, y + Math.sin(a) * d * 0.72, r * (0.34 + rr() * 0.2)]); }
		lumps.sort((p, q) => p[1] - q[1]);
		// dark underlayer gives the cluster volume
		for(const [cx, cy, rad] of lumps){ c.beginPath(); c.arc(cx + 2, cy + 5, rad, 0, TAU); c.fillStyle = T.leafDark; c.fill(); c.lineWidth = 2.2; c.strokeStyle = LINE; c.stroke(); }
		for(const [cx, cy, rad] of lumps){
			const g = c.createRadialGradient(cx - rad * 0.35, cy - rad * 0.45, rad * 0.1, cx, cy, rad);
			g.addColorStop(0, T.leafLight); g.addColorStop(0.6, T.leaf); g.addColorStop(1, mix(T.leaf, T.leafDark, 0.6));
			c.beginPath();
			for(let i = 0; i <= 18; i++){ const aa = i / 18 * TAU, rv = rad * (0.9 + 0.1 * Math.sin(aa * 7 + cx)); const px = cx + Math.cos(aa) * rv, py = cy + Math.sin(aa) * rv; if(i) c.lineTo(px, py); else c.moveTo(px, py); }
			c.closePath(); c.fillStyle = g; c.fill();
		}
		c.save(); c.fillStyle = rgba(T.leafLight, 0.55);
		for(let i = 0; i < 14; i++){ const a = rr() * TAU, d = rr() * r * 0.7; c.beginPath(); c.ellipse(x + Math.cos(a) * d + sway * 5, y + Math.sin(a) * d * 0.6 - r * 0.15, 3, 1.8, a, 0, TAU); c.fill(); }
		c.restore();
	}
	function drawCanopy(c, T, P){
		const sw = P.canopy;
		if(T.antlers){
			// black antler-branches instead of a full crown of leaves
			for(const s of [-1, 1]){
				const pts = [[s * 16, -SH_Y - 10], [s * 30, -SH_Y - 48], [s * 52, -SH_Y - 70], [s * 62, -SH_Y - 104], [s * 56, -SH_Y - 128]];
				taper(c, pts.map(p => [p[0] + sw * 6, p[1]]), 16, 2, '#160c08', LINE);
				taper(c, [[s * 30 + sw * 5, -SH_Y - 48], [s * 14 + sw * 6, -SH_Y - 80], [s * 8 + sw * 6, -SH_Y - 104]], 9, 1.5, '#1a0e09', LINE);
				taper(c, [[s * 52 + sw * 6, -SH_Y - 70], [s * 78 + sw * 6, -SH_Y - 84], [s * 90 + sw * 6, -SH_Y - 104]], 8, 1.5, '#1a0e09', LINE);
			}
		}
		const clusters = T.antlers ? [[-52, -SH_Y - 34, 40], [54, -SH_Y - 30, 40], [-14, -SH_Y - 58, 44], [26, -SH_Y - 62, 42]] : [[-70, -SH_Y - 6, 38], [72, -SH_Y - 2, 38], [-44, -SH_Y - 46, 50], [46, -SH_Y - 44, 50], [0, -SH_Y - 70, 56], [-10, -SH_Y - 20, 44], [20, -SH_Y - 24, 40]];
		clusters.forEach((cl, i) => leafCluster(c, T, cl[0] + sw * (6 + i), cl[1], cl[2], 31 + i * 7, sw));
		if(T.blossom){
			const r = A.rng(5);
			for(let i = 0; i < 16; i++){ const x = -80 + r() * 160 + sw * 8, y = -SH_Y + 10 - r() * 100; for(let k = 0; k < 5; k++){ const a = k / 5 * TAU; ellipse(c, x + Math.cos(a) * 3.5, y + Math.sin(a) * 3.5, 3, 3, '#ffc4e0'); } ellipse(c, x, y, 2, 2, '#ffe680'); }
		}
		if(T.embers){
			const r = A.rng(9);
			for(let i = 0; i < 14; i++){ const x = -80 + r() * 160 + sw * 10, y = -SH_Y + 10 - r() * 110 - ((P.t || 0) * 40 + i * 9) % 30; glow(c, x, y, 8, '#ff7a1a', 0.8); }
		}
		if(T.runes > 0.5 && !T.antlers){
			const r = A.rng(13);
			for(let i = 0; i < 9; i++){ const x = -90 + r() * 180, y = -SH_Y + 10 - r() * 110 + Math.sin((P.t || 0) * TAU + i) * 6; glow(c, x, y, 7, '#e6ff8a', 0.9); }
		}
	}
	function drawLeg(c, T, P, hx, hy, t, s, near){
		const [kx, ky, fx, fy] = legEnd(hx, hy, t, s);
		const dk = near ? 0 : 0.32;
		at(c, hx, hy, t, () => { bark(c, T, [[-18, -6], [17, -6], [15, THIGH + 2], [-15, THIGH + 2]], dk); grooves(c, T, -12, 0, 12, THIGH, 3, 4 + (near ? 1 : 0), 0.45); });
		at(c, kx, ky, t + s, () => { bark(c, T, [[-15, -4], [15, -4], [18, SHIN * 0.6], [22, SHIN + 2], [-22, SHIN + 2], [-18, SHIN * 0.5]], dk); grooves(c, T, -12, 0, 12, SHIN, 3, 9, 0.45); });
		ellipse(c, kx, ky, 14, 11, mix(T.bark, '#000', dk + 0.15), LINE, 2.5);
		// root feet splaying into the ground
		at(c, fx, fy, 0, () => {
			const spread = 1 + P.rootsOut;
			for(let k = 0; k < 4; k++){
				const a = lerp(-0.25, 0.25, k / 3), len = (24 + k * 5) * spread;
				taper(c, [[(k - 1.5) * 8, -6], [(k - 1.5) * 8 + Math.sin(a) * len * 0.5 + len * 0.3, -2], [(k - 1.5) * 10 + len * 0.6 * (k < 2 ? -1 : 1), 4]], 11, 2, mix(T.bark, '#000', dk + 0.1), LINE);
			}
		});
	}
	function drawTrunk(c, T, P){
		// trunk body
		const pts = [[-40, 6], [40, 6], [44, -30], [48, -66], [42, -96], [26, -112], [-24, -112], [-42, -98], [-48, -64], [-44, -28]];
		bark(c, T, pts, 0, { lw: 4, rim: rgba(T.light, 0.35), rimW: 6 });
		grooves(c, T, -36, -104, 36, 0, 7, 21, 0.55);
		// bark plates / knots
		ellipse(c, -24, -40, 9, 12, mix(T.bark, '#000', 0.3), LINE, 2.5);
		ellipse(c, -24, -40, 4, 6, mix(T.dark, '#000', 0.2));
		// face
		at(c, 6, -76, P.head, () => {
			// brow ridge
			bark(c, T, [[-24, -16], [26, -18], [30, -8], [-26, -6]], 0.1, { smooth: 0.3 });
			for(const s of [-1, 1]){
				const ex = s * 12 + 4;
				paint(c, [[ex - 9, -4], [ex + 9, -6], [ex + 7, 4], [ex - 8, 5]], { fill: '#0a0603', line: LINE, lw: 2, smooth: 0.4 });
				glow(c, ex, 0, 14 + 8 * P.glow, T.eye, 0.75 + 0.2 * P.glow);
				ellipse(c, ex, 0, 3.5, 3, tint(T.eye, 0.5));
			}
			// mouth hollow
			const m = 6 + P.mouth * 12;
			paint(c, [[-12, 14], [16, 13], [14, 14 + m], [0, 18 + m], [-12, 14 + m]], { fill: '#080402', line: LINE, lw: 2.5, smooth: 0.4 });
			if(P.mouth > 0.2) glow(c, 2, 18 + m * 0.6, 22 * P.mouth, T.eye, 0.6 * P.mouth);
			// bark-beard
			for(let i = 0; i < 5; i++) taper(c, [[-10 + i * 6, 22 + m], [-12 + i * 6, 40 + m + (i % 2) * 6]], 5, 1, mix(T.bark, '#000', 0.2), LINE);
		});
		if(T.moss > 0){
			c.save(); c.globalAlpha = 0.85;
			const r = A.rng(77);
			for(let i = 0; i < 6 + T.moss * 10; i++){ const sd = r() > 0.5 ? 1 : -1, x = sd * (26 + r() * 16), y = -100 + r() * 90; ellipse(c, x, y, 6 + r() * 8, 4 + r() * 4, r() > 0.5 ? '#4f8a2c' : '#6aa63a', LINE, 1.5); }
			c.restore();
		}
		if(T.shrooms){
			for(const [x, y, s] of [[-36, -20, 1], [-30, -14, 0.7], [36, -60, 0.9]]){
				taper(c, [[x, y], [x, y - 10 * s]], 4 * s, 3 * s, '#e8dcc0', LINE);
				paint(c, [[x - 10 * s, y - 9 * s], [x, y - 18 * s], [x + 10 * s, y - 9 * s]], { fill: '#4ad0c0', light: '#bafff4', dark: '#18605a', lw: 2, line: LINE, smooth: 0.5 });
				glow(c, x, y - 12 * s, 14 * s, '#7affd2', 0.6);
			}
		}
		if(T.runes > 0){
			runeCrack(c, T, [[-30, -20], [-18, -34], [-26, -50], [-12, -62]], 2.6, 0.8 * (0.6 + 0.4 * P.glow));
			runeCrack(c, T, [[28, -24], [18, -40], [30, -52]], 2.6, 0.8 * (0.6 + 0.4 * P.glow));
			if(T.runes > 1) runeCrack(c, T, [[-8, -6], [4, -18], [-4, -30], [10, -42]], 3, 0.95);
		}
		if(T.thorns){
			const r = A.rng(55);
			for(let i = 0; i < 10; i++){ const y = -100 + r() * 96, s = r() > 0.5 ? 1 : -1, x = s * (40 + r() * 6); paint(c, [[x, y - 5], [x, y + 5], [x + s * (14 + r() * 8), y - 4]], { fill: '#180c08', line: LINE, lw: 1.5, smooth: false }); }
		}
	}
	function drawArm(c, T, P, sx, sy, up, fore, near){
		const dk = near ? 0 : 0.34;
		const ex = sx - Math.sin(up) * UPPER, ey = sy + Math.cos(up) * UPPER;
		at(c, sx, sy, up, () => { bark(c, T, [[-13, -6], [13, -6], [10, UPPER + 2], [-10, UPPER + 2]], dk); grooves(c, T, -8, 0, 8, UPPER, 2, 30, 0.4); });
		at(c, ex, ey, fore, () => {
			bark(c, T, [[-10, -3], [10, -3], [9, FORE], [-9, FORE]], dk);
			// twig side-branches
			taper(c, [[6, FORE * 0.35], [20, FORE * 0.2], [28, FORE * 0.05]], 6, 1, mix(T.bark, '#000', dk), LINE);
			leafCluster(c, T, 24, FORE * 0.05, 12, near ? 3 : 4, 0);
			// claw fingers
			at(c, 0, FORE, 0, () => {
				const spread = 0.35 + P.claw * 0.7;
				for(let k = 0; k < 4; k++){
					const a = lerp(-spread, spread, k / 3);
					at(c, 0, 0, a, () => taper(c, [[0, 0], [2, 16], [-3, 30], [-8, 38]], 9, 1.5, mix(T.bark, '#000', dk + 0.08), LINE));
				}
				if(T.thorns || T.runes) glow(c, 0, 20, 22 * P.claw, T.sap, 0.45 * P.claw);
			});
		});
		ellipse(c, ex, ey, 12, 11, mix(T.bark, '#000', dk + 0.15), LINE, 2.5);
	}
	function drawSmear(c, T, x, y, r0, r1, a0, a1, alpha){
		if(alpha <= 0.02) return;
		c.save(); c.globalCompositeOperation = 'lighter';
		for(let i = 0; i < 14; i++){
			const u1 = (i + 1) / 14, ang0 = lerp(a0, a1, i / 14), ang1 = lerp(a0, a1, u1), aa = Math.pow(u1, 1.5) * alpha;
			c.beginPath(); c.arc(x, y, (r0 + r1) / 2, Math.min(ang0, ang1), Math.max(ang0, ang1));
			c.strokeStyle = rgba(T.leafLight, aa * 0.5); c.lineWidth = (r1 - r0) * u1; c.stroke();
		}
		c.restore();
	}
	function draw(c, P, tierName, t){
		const T = TIERS[tierName] || TIERS.base;
		P.t = t || 0;
		const hy = -HIP + P.crouch * 16 + P.kneel * 28;
		const nL = legEnd(12, hy, P.nT, P.nS), fL = legEnd(-12, hy, P.fT, P.fS);
		const footY = Math.max(nL[3], fL[3]) + 2;
		c.save();
		c.translate(P.rootX, -footY + P.bob);
		at(c, 0, footY, 0, () => A.shadow(c, 96, 0.5));
		if(P.fall){ c.translate(0, footY); c.rotate(P.fall); c.translate(0, -footY); }
		if(P.crumble > 0) c.globalAlpha = 1 - P.crumble * 0.85;
		const upper = (fn) => at(c, 0, hy, P.lean, fn);
		const nSh = [36, -SH_Y + 18], fSh = [-34, -SH_Y + 20];
		upper(() => { drawCanopy(c, T, P); drawArm(c, T, P, fSh[0], fSh[1], P.fU, P.fF, false); });
		drawLeg(c, T, P, -12, hy, P.fT, P.fS, false);
		upper(() => drawTrunk(c, T, P));
		drawLeg(c, T, P, 12, hy, P.nT, P.nS, true);
		upper(() => {
			drawSmear(c, T, nSh[0], nSh[1], 80, 140, P.smearA - 1.5, P.smearA, P.smear || 0);
			drawArm(c, T, P, nSh[0], nSh[1], P.nU, P.nF, true);
		});
		c.restore();
	}
	const S = (keys) => (t) => Object.assign({}, IDLE, sample(keys, t));
	const G0 = { nU: 0.1, nF: -0.25, fU: 0.3, fF: -0.1, lean: 0.04 };
	const ANIMS = {
		idle: (t) => { const b = Math.sin(t * TAU); return Object.assign({}, IDLE, { bob: b * 1.6, canopy: Math.sin(t * TAU + 0.6), nU: 0.1 + b * 0.05, fU: 0.3 - b * 0.05, claw: 0.2 + 0.1 * b, glow: 0.55 + 0.35 * (0.5 + 0.5 * b), head: b * 0.02 }); },
		move: (t) => {
			const p = t * TAU, s = Math.sin(p);
			return Object.assign({}, IDLE, { nT: -s * 0.34, nS: 0.12 + Math.max(0, Math.cos(p)) * 0.5, fT: s * 0.34, fS: 0.12 + Math.max(0, -Math.cos(p)) * 0.5, bob: -Math.abs(Math.cos(p)) * 5, lean: 0.1, nU: 0.1 + s * 0.25, fU: 0.3 - s * 0.25, canopy: Math.sin(p * 2) * 0.8 + 0.5, glow: 0.6 });
		},
		attackA: S([
			[0, G0],
			[0.35, { nU: 2.9, nF: 2.7, fU: 0.6, lean: -0.15, crouch: 0.15, claw: 1, canopy: -0.8, glow: 0.9, head: -0.1 }],
			[0.55, { nU: -1.0, nF: -0.7, fU: 0.4, lean: 0.4, crouch: 0.6, nT: -0.5, nS: 0.6, fT: 0.5, claw: 1, canopy: 1.2, smear: 1, smearA: 1.0, glow: 1 }],
			[0.75, { nU: -1.05, nF: -0.6, lean: 0.42, crouch: 0.6, nT: -0.5, nS: 0.6, fT: 0.5, claw: 0.7, canopy: 0.8, smear: 0.25, smearA: 1.3 }],
			[1, G0],
		]),
		attackB: S([
			[0, G0],
			[0.35, { nU: 2.6, nF: 2.2, fU: 2.5, fF: 2.1, lean: -0.2, head: -0.2, claw: 1, canopy: -1, glow: 1, mouth: 0.6 }],
			[0.58, { nU: -0.35, nF: -0.1, fU: -0.2, fF: 0.0, lean: 0.55, crouch: 1, nT: -0.55, nS: 1.0, fT: 0.6, fS: 1.0, claw: 1, canopy: 1.2, rootsOut: 1, glow: 1.2, smear: 0.8, smearA: 1.5 }],
			[0.85, { nU: -0.37, nF: -0.1, fU: -0.22, lean: 0.55, crouch: 1, nT: -0.55, nS: 1.0, fT: 0.6, fS: 1.0, claw: 0.5, rootsOut: 1, glow: 1 }],
			[1, G0],
		]),
		cast: S([
			[0, G0],
			[0.4, { nU: 2.4, nF: 2.0, fU: 2.3, fF: 1.9, lean: -0.22, head: -0.25, claw: 1, mouth: 1, canopy: 1.2, glow: 1.5, rootsOut: 0.6 }],
			[0.75, { nU: 2.5, nF: 2.1, fU: 2.4, fF: 2.0, lean: -0.24, head: -0.28, claw: 1, mouth: 1, canopy: -1.2, glow: 1.6, rootsOut: 0.8 }],
			[1, G0],
		]),
		special: (t) => {
			const p = t * TAU, s = Math.sin(p);
			return Object.assign({}, IDLE, { lean: 0.5, crouch: 0.4, nT: -s * 0.55 - 0.1, nS: 0.2 + Math.max(0, Math.cos(p)) * 0.8, fT: s * 0.55 + 0.1, fS: 0.2 + Math.max(0, -Math.cos(p)) * 0.8, bob: -Math.abs(Math.cos(p)) * 8, nU: -0.9, nF: -1.2, fU: -0.6, fF: -0.9, claw: 1, canopy: 1.5, glow: 1, mouth: 0.8, head: 0.2 });
		},
		hurt: S([
			[0, G0],
			[0.25, { lean: -0.3, head: -0.3, nU: 0.7, fU: 0.8, canopy: -1.5, glow: 1.4, rootX: -8, mouth: 0.8 }],
			[0.6, { lean: -0.12, head: -0.1, canopy: -0.6, rootX: -4 }],
			[1, G0],
		]),
		death: (t) => Object.assign({}, IDLE, sample([
			[0, Object.assign({ glow: 0.8 }, G0)],
			[0.35, { kneel: 0.8, lean: 0.25, nT: -1.0, nS: 1.6, fT: 0.4, fS: 1.5, nU: 0.4, fU: 0.5, head: 0.3, glow: 0.6, mouth: 1, canopy: -1 }],
			[0.7, { kneel: 1, lean: 0.55, nT: -1.1, nS: 1.8, fT: 0.6, fS: 1.7, nU: -0.4, fU: -0.2, head: 0.5, glow: 0.2, mouth: 0.6, canopy: -1.5, crouch: 0.6 }],
			[1, { kneel: 1, lean: 0.9, nT: -1.1, nS: 1.8, fT: 0.6, fS: 1.7, nU: -1.0, fU: -0.8, head: 0.6, glow: 0, mouth: 0.3, canopy: -1.8, crouch: 0.8, crumble: 0.5, fall: 0.1 }],
		], t)),
	};
	A.bosses.treant = { name: 'Elder Treant', TIERS, draw, ANIMS, scale: 0.78, footY: 280, bodyH: 210, flier: false };
})(typeof window !== 'undefined' ? window : globalThis);
