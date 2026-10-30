/* Frostbound Knight — a towering frost duelist with a two-handed greatsword.
   Tiers: base (steel and ice) · alpha (frost-gilded, crystal pauldrons) · elder (rune-lit navy, crystal growths,
   glowing crystal blade) · tyrant "Winter Tyrant" (black ice, glacier crown and horns, shattered cape, jagged glacier blade). */
(function(G){
	'use strict';
	const A = G.MBArt, { paint, taper, glow, ellipse, at, sample, lerp, clamp, rgba, mix, shade, tint, TAU } = A;

	const TIERS = {
		base:   { armor:'#4d6382', light:'#b4c8e0', dark:'#141d31', shadow:'#25334d', trim:'#a7bed8', cloth:'#2d5b86', clothDark:'#122840', cape:'#9cc8e6', capeDark:'#2c5679', eye:'#7fe6ff', blade:'#dbf2ff', bladeEdge:'#ffffff', runes:0, spikes:0, crown:0, horns:0, torn:0, bladeScale:1, crystal:0, plume:'#bfe9ff' },
		alpha:  { armor:'#526b8c', light:'#c6d7ea', dark:'#141d31', shadow:'#283752', trim:'#e8c86e', cloth:'#1f5a8e', clothDark:'#0e2742', cape:'#b3dbf3', capeDark:'#2e5d84', eye:'#a6f2ff', blade:'#e8f8ff', bladeEdge:'#ffffff', runes:0, spikes:2, crown:0, horns:0, torn:0, bladeScale:1.06, crystal:0.35, plume:'#ffe8a6' },
		elder:  { armor:'#2e4466', light:'#9ec0e6', dark:'#0a1222', shadow:'#16243e', trim:'#86ecff', cloth:'#163a63', clothDark:'#06142a', cape:'#5aa6d6', capeDark:'#15324f', eye:'#c4fcff', blade:'#9fe9ff', bladeEdge:'#f2feff', runes:1, spikes:4, crown:0, horns:0, torn:0.4, bladeScale:1.14, crystal:1, plume:'#86ecff' },
		tyrant: { armor:'#161e2f', light:'#5c74a0', dark:'#030509', shadow:'#0a0f1c', trim:'#c6f8ff', cloth:'#0d1a33', clothDark:'#02060f', cape:'#22406a', capeDark:'#050b18', eye:'#eaffff', blade:'#86dcff', bladeEdge:'#ffffff', runes:1.6, spikes:6, crown:1, horns:1, torn:1, bladeScale:1.3, crystal:1.6, plume:'#eaffff' },
	};
	const LINE = 'rgba(6,9,18,0.95)';

	/* ---------------------------------------------------------------- skeleton */
	const HIP = 96, THIGH = 48, SHIN = 50, UPPER = 40, FORE = 38, SH_Y = 70;
	const IDLE = { bob:0, lean:0.06, head:0, nT:-0.26, nS:0.22, fT:0.32, fS:0.12, nU:-0.3, nF:-1.05, sw:-0.78, cape:0, glow:0.6, rootX:0, lift:0, grounded:1, fall:0, smear:0, smearA:0, crouch:0, kneel:0, tabard:0 };

	function legEnd(hx, hy, t, s){ const kx = hx - Math.sin(t) * THIGH, ky = hy + Math.cos(t) * THIGH; const a = t + s; return [kx, ky, kx - Math.sin(a) * SHIN, ky + Math.cos(a) * SHIN]; }
	function ik(sx, sy, tx, ty, a, b, bend){
		const dx = tx - sx, dy = ty - sy, d = clamp(Math.hypot(dx, dy), 1, a + b - 0.5);
		const base = Math.atan2(-dx, dy);
		const off = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1)) * (bend || 1);
		const up = base + off;
		const ex = sx - Math.sin(up) * a, ey = sy + Math.cos(up) * a;
		return [up, Math.atan2(-(tx - ex), ty - ey)];
	}
	// armour plate: fill + cel shadow + specular + outline
	function plate(c, T, pts, dk, o){
		o = o || {};
		paint(c, pts, Object.assign({ fill: mix(T.armor, '#000', dk), light: mix(T.light, '#000', dk), dark: mix(T.dark, '#000', dk * 0.5), cel: [4, -3, mix(T.shadow, '#000', dk)], spec: dk < 0.2 ? 'rgba(255,255,255,0.28)' : null, lw: 3, line: LINE, lx: 0.1, lx2: 0.9 }, o));
	}
	function crystal(c, T, x, y, s, ang){
		at(c, x, y, ang || 0, () => {
			paint(c, [[0, 0], [8 * s, -5 * s], [3 * s, -30 * s], [-4 * s, -9 * s]], { fill: rgba(T.blade, 0.92), light: '#ffffff', dark: mix(T.trim, '#003', 0.3), lw: 2, line: 'rgba(8,24,52,0.95)', smooth: false, lx: 0, lx2: 1 });
			c.save(); c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, -2); c.lineTo(3 * s, -28 * s); c.stroke(); c.restore();
			glow(c, 2 * s, -14 * s, 16 * s, T.eye, 0.3);
		});
	}

	/* ---------------------------------------------------------------- parts */
	function drawLeg(c, T, hx, hy, t, s, near){
		const [kx, ky, fx, fy] = legEnd(hx, hy, t, s);
		const dk = near ? 0 : 0.28;
		at(c, hx, hy, t, () => {
			// mail under the plate
			paint(c, [[-12, -6], [12, -6], [11, THIGH], [-11, THIGH]], { fill: mix('#2a3346', '#000', dk), line: LINE, lw: 2.5, smooth: 0.2 });
			plate(c, T, [[-13, -2], [12, -2], [11, THIGH * 0.62], [7, THIGH + 1], [-8, THIGH + 1], [-13, THIGH * 0.5]], dk);
		});
		at(c, kx, ky, t + s, () => {
			plate(c, T, [[-11, -2], [11, -2], [12, SHIN * 0.45], [9, SHIN + 1], [-9, SHIN + 1], [-12, SHIN * 0.55]], dk);
			taper(c, [[5, 6], [6, SHIN * 0.55], [4, SHIN - 4]], 3, 1, rgba(T.light, near ? 0.55 : 0.25));
		});
		// knee cop with a flared wing
		at(c, kx + 2, ky, t * 0.5, () => {
			plate(c, T, [[-12, -9], [10, -10], [14, 0], [9, 10], [-11, 9]], dk + 0.05, { fill: mix(T.trim, '#000', dk + 0.25) });
			ellipse(c, 2, -1, 4, 4, rgba(T.light, near ? 0.8 : 0.4));
		});
		at(c, fx, fy, 0, () => plate(c, T, [[-14, -12], [6, -12], [25, -4], [27, 2], [-15, 2]], dk + 0.08, { smooth: 0.25 }));
		if(T.crystal > 0.5 && near) crystal(c, T, kx + 6, ky - 6, 0.9 + T.crown * 0.4, -0.7);
	}
	function drawCape(c, T, sway, flap){
		const sw = sway || 0, fl = flap || 0;
		const L = 118 + T.torn * 8;
		const pts = [[-30, -SH_Y + 2], [-8, -SH_Y - 6], [10, -SH_Y + 4], [8 - sw * 8, -SH_Y + 52], [-4 - sw * 24 - fl * 10, -SH_Y + L * 0.82], [-20 - sw * 34 - fl * 20, -SH_Y + L], [-52 - sw * 38 - fl * 26, -SH_Y + L - 4], [-60 - sw * 30 - fl * 16, -SH_Y + L * 0.55], [-46, -SH_Y + 20]];
		paint(c, pts, { fill: T.cape, light: tint(T.cape, 0.2), dark: T.capeDark, cel: [6, -2, T.capeDark], lw: 3, line: LINE, smooth: 0.42, lx: 0, lx2: 1 });
		c.save(); c.globalAlpha = 0.45; c.strokeStyle = T.capeDark; c.lineWidth = 3.5; c.lineCap = 'round';
		for(let i = 0; i < 4; i++){ c.beginPath(); c.moveTo(-12 - i * 10, -SH_Y + 12); c.quadraticCurveTo(-18 - i * 11 - sw * 14, -SH_Y + 64, -10 - i * 12 - sw * 30 - fl * 16, -SH_Y + L - 10); c.stroke(); }
		c.restore();
		if(T.torn > 0){
			const r = A.rng(7), n = 4 + Math.round(T.torn * 5);
			for(let i = 0; i < n; i++){
				const u = i / (n - 1);
				const x = lerp(-52 - sw * 38 - fl * 26, -4 - sw * 24 - fl * 10, u), y = -SH_Y + L - 6 + Math.sin(u * 7) * 5;
				const len = 10 + r() * 22 * T.torn;
				paint(c, [[x - 5, y - 5], [x + 5, y - 5], [x + (r() - 0.5) * 8, y + len]], { fill: T.torn > 0.6 ? rgba(T.blade, 0.95) : T.cape, light: '#ffffff', dark: T.capeDark, lw: 2, line: 'rgba(8,24,52,0.95)', smooth: false });
			}
		}
	}
	function drawTabard(c, T, sway){
		const sw = sway || 0;
		const pts = [[-15, -16], [15, -16], [16 + sw * 4, 26], [10 + sw * 8, 40], [0 + sw * 9, 34], [-10 + sw * 8, 40], [-16 + sw * 4, 26]];
		paint(c, pts, { fill: T.cloth, light: tint(T.cloth, 0.18), dark: T.clothDark, cel: [3, -2, T.clothDark], lw: 2.5, line: LINE, smooth: 0.2 });
		// snowflake emblem
		c.save(); c.translate(sw * 5, 10); c.strokeStyle = T.runes ? rgba(T.eye, 0.95) : rgba(T.trim, 0.95); c.lineWidth = 2; c.lineCap = 'round';
		if(T.runes){ c.shadowColor = T.eye; c.shadowBlur = 8; }
		for(let k = 0; k < 3; k++){ const a = k * Math.PI / 3; c.beginPath(); c.moveTo(Math.cos(a) * -8, Math.sin(a) * -8); c.lineTo(Math.cos(a) * 8, Math.sin(a) * 8); c.stroke(); }
		c.restore();
		taper(c, [[-13, -13], [13, -13]], 3, 3, rgba(T.trim, 0.9));
	}
	function drawTorso(c, T, P){
		// fauld
		for(let i = 2; i >= 0; i--){
			const y = -14 + i * 10;
			plate(c, T, [[-27 + i * 1.5, y - 9], [27 - i * 1.5, y - 9], [29 - i, y + 8], [-29 + i, y + 8]], 0.12 + i * 0.07, { smooth: 0.15 });
		}
		// breastplate
		plate(c, T, [[-30, -24], [30, -24], [37, -50], [33, -70], [9, -79], [-15, -77], [-35, -68], [-37, -46]], 0, { lw: 3.5, rim: rgba(T.light, 0.55), rimW: 5 });
		// plackart + ridge
		plate(c, T, [[-24, -24], [26, -24], [24, -40], [2, -46], [-22, -40]], 0.06, { smooth: 0.3 });
		taper(c, [[7, -75], [8, -52], [6, -28]], 4.5, 2, rgba(T.light, 0.6));
		// belt + buckle
		paint(c, [[-28, -26], [28, -26], [27, -15], [-27, -15]], { fill: shade(T.trim, 0.45), light: T.trim, dark: shade(T.trim, 0.75), lw: 2.5, line: LINE, smooth: 0.1 });
		plate(c, T, [[-3, -27], [11, -27], [12, -14], [-4, -14]], 0, { fill: T.trim, light: tint(T.trim, 0.5), dark: shade(T.trim, 0.4), smooth: 0.2 });
		if(T.runes > 0){
			c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = rgba(T.eye, 0.6 + 0.3 * P.glow); c.lineWidth = 2.4; c.lineCap = 'round';
			c.shadowColor = T.eye; c.shadowBlur = 12;
			c.beginPath(); c.moveTo(-20, -32); c.lineTo(-11, -48); c.lineTo(-20, -64); c.moveTo(25, -32); c.lineTo(16, -48); c.lineTo(25, -64);
			if(T.runes > 1){ c.moveTo(-6, -66); c.lineTo(6, -59); c.lineTo(-3, -52); c.lineTo(9, -44); }
			c.stroke(); c.restore();
			glow(c, 6, -50, 20 + T.runes * 10, T.eye, 0.25 + 0.3 * P.glow);
		}
	}
	function drawHead(c, T, P){
		at(c, 5, -SH_Y - 6, P.head, () => {
			plate(c, T, [[-17, 5], [19, 5], [17, -9], [-15, -9]], 0.18, { smooth: 0.2 });
			// plume (behind the helm)
			if(!T.crown){
				const sw = P.cape * 0.5;
				paint(c, [[-6, -46], [4, -52], [-14 - sw * 10, -60], [-34 - sw * 16, -50], [-46 - sw * 20, -34], [-34 - sw * 14, -38], [-20, -44]], { fill: T.plume, light: '#ffffff', dark: mix(T.plume, '#123', 0.5), cel: [3, -3, mix(T.plume, '#123', 0.45)], lw: 2.5, line: LINE, smooth: 0.5 });
			}
			plate(c, T, [[-18, -6], [21, -6], [24, -23], [22, -42], [9, -50], [-9, -49], [-19, -40], [-21, -21]], 0, { lw: 3.5, rim: rgba(T.light, 0.6), rimW: 4 });
			// cross visor
			paint(c, [[3, -33], [23, -34], [23, -27], [3, -26]], { fill: '#04060c', line: '#02030a', lw: 1.5, smooth: false });
			paint(c, [[11, -40], [16, -40], [16, -14], [11, -14]], { fill: '#04060c', line: '#02030a', lw: 1.5, smooth: false });
			glow(c, 16, -30, 14 + 12 * P.glow, T.eye, 0.6 + 0.35 * P.glow);
			c.save(); c.fillStyle = tint(T.eye, 0.5); c.fillRect(8, -31.5, 13, 2.5); c.restore();
			taper(c, [[-17, -42], [0, -51], [17, -46]], 5, 3, rgba(T.light, 0.6));
			for(let i = 0; i < 3; i++) ellipse(c, 19, -18 + i * 3.4, 1.3, 1.3, 'rgba(4,5,10,0.9)');
			if(T.spikes >= 2 && !T.crown){ crystal(c, T, -12, -44, 0.85, -0.45); crystal(c, T, 0, -49, 0.7, 0.05); }
			if(T.horns){
				for(const s of [-1, 1]){
					const bx = s < 0 ? -15 : 13;
					taper(c, [[bx, -34], [bx + s * 10 - 6, -56], [bx + s * 6 - 18, -78], [bx + s * 2 - 26, -90]], 11, 1, mix(T.blade, '#000', s < 0 ? 0.4 : 0.08), 'rgba(6,14,30,0.95)');
				}
			}
			if(T.crown){
				const r = A.rng(3);
				for(let i = 0; i < 7; i++){
					const x = -17 + i * 6, h = 14 + (i === 3 ? 22 : i % 2 ? 6 : 13) + r() * 6;
					paint(c, [[x - 4.5, -46], [x + 4.5, -46], [x + 1, -46 - h]], { fill: rgba(T.blade, 0.96), light: '#ffffff', dark: mix(T.trim, '#036', 0.4), lw: 2, line: 'rgba(6,14,30,0.95)', smooth: false, lx: 0, lx2: 1 });
				}
				glow(c, 3, -64, 38, T.eye, 0.5);
			}
		});
	}
	function drawPauldron(c, T, near){
		const dk = near ? 0 : 0.32;
		at(c, near ? 13 : -15, -SH_Y + 2, 0, () => {
			for(let i = 2; i >= 0; i--){
				const y = 4 + i * 7, w = 22 - i * 2;
				plate(c, T, [[-w, y - 6], [w, y - 8], [w + 3, y + 4], [-w + 2, y + 6]], dk + 0.1 + i * 0.05, { smooth: 0.4 });
			}
			plate(c, T, [[-23, 2], [-20, -12], [-5, -20], [15, -16], [24, -2], [20, 8], [0, 10]], dk, { rim: near ? rgba(T.light, 0.65) : null });
			taper(c, [[-16, 2], [0, -11], [18, -2]], 4, 3, mix(T.trim, '#000', dk + 0.1));
			if(T.spikes >= 2 && near){
				const n = Math.min(3, T.spikes / 2 | 0);
				for(let i = 0; i < n; i++) crystal(c, T, -9 + i * 10, -12 - i * 2, 0.7 + i * 0.12 + T.crown * 0.4, -0.55 + i * 0.4);
			}
		});
	}
	function drawArm(c, T, sx, sy, up, fore, near){
		const dk = near ? 0 : 0.32;
		const ex = sx - Math.sin(up) * UPPER, ey = sy + Math.cos(up) * UPPER;
		at(c, sx, sy, up, () => plate(c, T, [[-10, -3], [10, -3], [9, UPPER], [-9, UPPER]], dk, { smooth: 0.3 }));
		at(c, ex, ey, fore, () => plate(c, T, [[-9, -2], [9, -2], [12, FORE - 6], [10, FORE + 2], [-10, FORE + 2], [-12, FORE - 6]], dk, { smooth: 0.3 }));
		// couter (elbow)
		at(c, ex, ey, up, () => { plate(c, T, [[-11, -8], [8, -10], [12, 2], [4, 10], [-10, 8]], dk + 0.05, { fill: mix(T.trim, '#000', dk + 0.3) }); ellipse(c, 1, 0, 3.5, 3.5, rgba(T.light, near ? 0.8 : 0.4)); });
		const hx = ex - Math.sin(fore) * FORE, hy = ey + Math.cos(fore) * FORE;
		return [hx, hy];
	}
	function drawGauntlet(c, T, x, y, ang, dk){
		at(c, x, y, ang, () => {
			plate(c, T, [[-10, -5], [10, -5], [11, 9], [7, 15], [-8, 15], [-11, 8]], dk + 0.05, { smooth: 0.4 });
			taper(c, [[-7, 1], [8, 1]], 3, 3, mix(T.trim, '#000', dk + 0.1));
		});
	}
	function drawSword(c, T, P, x, y, ang){
		const S = T.bladeScale;
		at(c, x, y, ang, () => {
			paint(c, [[-3.5, 4], [3.5, 4], [3.5, 30], [-3.5, 30]], { fill: '#2b2232', line: LINE, lw: 2, smooth: false });
			c.save(); c.strokeStyle = 'rgba(160,140,170,0.5)'; c.lineWidth = 1.2; for(let i = 0; i < 5; i++){ c.beginPath(); c.moveTo(-3, 8 + i * 4.5); c.lineTo(3, 10 + i * 4.5); c.stroke(); } c.restore();
			ellipse(c, 0, 34, 6.5, 6.5, T.trim, LINE, 2);
			plate(c, T, [[-24, 2], [24, 2], [28, -5], [19, -9], [-19, -9], [-28, -5]], 0, { fill: T.trim, light: tint(T.trim, 0.55), dark: shade(T.trim, 0.55), smooth: 0.3 });
			ellipse(c, 0, -3, 4.5, 4.5, T.eye, LINE, 1.5);
			const L = 140 * S, W = 11.5 * S;
			const blade = T.crown
				? [[-W, -8], [W, -8], [W + 5, -L * 0.3], [W - 2, -L * 0.42], [W + 7, -L * 0.62], [W - 3, -L * 0.74], [W + 3, -L * 0.9], [0, -L - 16], [-W + 1, -L * 0.86], [-W - 6, -L * 0.66], [-W + 1, -L * 0.52], [-W - 5, -L * 0.3]]
				: [[-W, -8], [W, -8], [W - 1, -L * 0.86], [0, -L - 12], [-W + 1, -L * 0.86]];
			if(T.crystal > 0.8){ c.save(); c.shadowColor = T.eye; c.shadowBlur = 18 + 12 * P.glow; }
			paint(c, blade, { fill: T.blade, light: T.bladeEdge, dark: mix(T.blade, '#14304e', 0.55), cel: [-3, 0, mix(T.blade, '#1a3456', 0.45)], lw: 2.5, line: 'rgba(8,16,30,0.95)', smooth: false, lx: 0, lx2: 1 });
			if(T.crystal > 0.8) c.restore();
			taper(c, [[0, -12], [0, -L * 0.74]], 4 * S, 1, rgba(mix(T.blade, '#123', 0.5), 0.85));
			c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = 'rgba(255,255,255,0.65)'; c.lineWidth = 1.6;
			c.beginPath(); c.moveTo(W - 2, -12); c.lineTo(W - 3, -L * 0.82); c.stroke(); c.restore();
			if(T.crystal > 0) glow(c, 0, -L * 0.55, 32 + 28 * T.crystal * P.glow, T.eye, 0.16 + 0.2 * T.crystal * P.glow);
		});
	}
	// motion smear: a crescent of frosted light along the blade tip's path, fading toward where the swing began
	function drawSmear(c, T, x, y, r0, r1, a0, a1, alpha){
		if(alpha <= 0.02) return;
		c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
		const n = 16;
		for(let i = 0; i < n; i++){
			const u0 = i / n, u1 = (i + 1) / n, aa = Math.pow(u1, 1.6) * alpha;
			const ang0 = lerp(a0, a1, u0), ang1 = lerp(a0, a1, u1);
			const w = lerp(4, r1 - r0, Math.pow(u1, 1.3));
			const rm = r1 - w / 2;
			c.beginPath(); c.arc(x, y, rm, Math.min(ang0, ang1), Math.max(ang0, ang1));
			c.strokeStyle = rgba(T.eye, aa * 0.45); c.lineWidth = w; c.stroke();
			c.beginPath(); c.arc(x, y, r1 - 3, Math.min(ang0, ang1), Math.max(ang0, ang1));
			c.strokeStyle = rgba('#ffffff', aa * 0.9); c.lineWidth = 3; c.stroke();
		}
		c.restore();
	}

	function draw(c, P, tierName){
		const T = TIERS[tierName] || TIERS.base;
		const hy = -HIP + P.crouch * 18 + P.kneel * 30;
		const nL = legEnd(7, hy, P.nT, P.nS), fL = legEnd(-7, hy, P.fT, P.fS);
		const footY = Math.max(nL[3], fL[3]) + 2;
		const rootY = P.grounded ? -footY : -P.lift;
		c.save();
		c.translate(P.rootX, rootY + P.bob);
		if(P.grounded || P.lift < 30) at(c, 0, footY, 0, () => A.shadow(c, 74 + T.crown * 14, 0.45));
		if(P.fall){ c.translate(0, footY); c.rotate(P.fall); c.translate(0, -footY); }
		const upper = (fn) => at(c, 0, hy, P.lean, fn);
		// where the hands are: near hand by FK, far hand by IK onto the grip
		const nSh = [13, -SH_Y + 6];
		const nE = [nSh[0] - Math.sin(P.nU) * UPPER, nSh[1] + Math.cos(P.nU) * UPPER];
		const nH = [nE[0] - Math.sin(P.nF) * FORE, nE[1] + Math.cos(P.nF) * FORE];
		const grip2 = [nH[0] + Math.sin(P.sw) * 13, nH[1] - Math.cos(P.sw) * 13];
		const fSh = [-13, -SH_Y + 8];
		const [fU, fF] = ik(fSh[0], fSh[1], grip2[0], grip2[1], UPPER, FORE, -1);

		upper(() => { drawCape(c, T, P.cape, Math.abs(P.lean) * 0.5 + P.lift * 0.005); drawPauldron(c, T, false); const h = drawArm(c, T, fSh[0], fSh[1], fU, fF, false); drawGauntlet(c, T, h[0], h[1], fF, 0.32); });
		drawLeg(c, T, -7, hy, P.fT, P.fS, false);
		upper(() => { drawTorso(c, T, P); });
		drawLeg(c, T, 7, hy, P.nT, P.nS, true);
		at(c, 0, hy + 10, 0, () => drawTabard(c, T, P.cape * 0.6 + P.tabard));
		upper(() => {
			drawHead(c, T, P);
			drawSmear(c, T, nSh[0], nSh[1], 120 * T.bladeScale, 70 + 148 * T.bladeScale, P.smearA - 1.6, P.smearA, P.smear);
			drawSword(c, T, P, nH[0], nH[1], P.sw + Math.PI);
			drawPauldron(c, T, true);
			drawArm(c, T, nSh[0], nSh[1], P.nU, P.nF, true);
			drawGauntlet(c, T, nH[0], nH[1], P.nF, 0);
		});
		c.restore();
	}

	/* ---------------------------------------------------------------- animation rows */
	const S = (keys) => (t) => Object.assign({}, IDLE, sample(keys, t));
	const G0 = { nU: -0.3, nF: -1.05, sw: -0.78, lean: 0.06 };
	const ANIMS = {
		idle: (t) => {
			const b = Math.sin(t * TAU);
			return Object.assign({}, IDLE, { bob: b * 1.8, lean: 0.06 + b * 0.015, head: b * 0.035, nU: -0.3 + b * 0.04, nF: -1.05 - b * 0.03, sw: -0.78 + b * 0.04, cape: Math.sin(t * TAU + 1) * 0.2, glow: 0.55 + 0.35 * (0.5 + 0.5 * Math.sin(t * TAU)) });
		},
		move: (t) => {
			const p = t * TAU, s = Math.sin(p);
			return Object.assign({}, IDLE, {
				nT: -s * 0.45, nS: 0.15 + Math.max(0, Math.cos(p)) * 0.6, fT: s * 0.45, fS: 0.15 + Math.max(0, -Math.cos(p)) * 0.6,
				bob: -Math.abs(Math.cos(p)) * 4, lean: 0.14, nU: -0.36 - s * 0.06, nF: -1.1, sw: -0.85 + s * 0.05, cape: 0.5 + Math.sin(p * 2) * 0.14, head: 0.03, tabard: -0.4 + s * 0.2,
			});
		},
		attackA: S([
			[0, G0],
			[0.3, { nU: 2.75, nF: 2.45, sw: 2.55, lean: -0.18, nT: -0.05, fT: 0.36, crouch: 0.2, head: -0.1, cape: -0.25, glow: 0.9 }],
			[0.42, { nU: 2.9, nF: 2.65, sw: 2.8, lean: -0.22, crouch: 0.25, glow: 1, nT: -0.05, fT: 0.36 }],
			[0.56, { nU: -0.65, nF: -1.2, sw: -1.45, lean: 0.38, nT: -0.55, nS: 0.5, fT: 0.48, fS: 0.2, crouch: 0.5, smear: 1, smearA: 0.35, cape: 0.7, glow: 1, tabard: 0.6 }],
			[0.7, { nU: -0.7, nF: -1.05, sw: -1.62, lean: 0.4, nT: -0.55, nS: 0.55, fT: 0.5, fS: 0.2, crouch: 0.5, smear: 0.3, smearA: 0.55, cape: 0.45 }],
			[1, G0],
		]),
		attackB: S([
			[0, G0],
			[0.3, { nU: 0.9, nF: 0.0, sw: 1.57, lean: -0.15, nT: 0.12, nS: 0.6, fT: 0.42, crouch: 0.55, rootX: -12, cape: -0.15, glow: 0.8 }],
			[0.48, { nU: -1.4, nF: -1.57, sw: -1.57, lean: 0.4, nT: -0.75, nS: 0.25, fT: 0.6, fS: 0.5, crouch: 0.35, rootX: 30, cape: 0.95, smear: 0.7, smearA: -0.05, glow: 1, tabard: 0.8 }],
			[0.7, { nU: -1.45, nF: -1.57, sw: -1.57, lean: 0.42, nT: -0.78, fT: 0.62, fS: 0.5, crouch: 0.35, rootX: 34, cape: 0.7 }],
			[1, Object.assign({ rootX: 0 }, G0)],
		]),
		cast: S([
			[0, G0],
			[0.35, { nU: 3.0, nF: 3.05, sw: 3.14, lean: -0.08, head: -0.18, crouch: 0.1, glow: 0.95, cape: -0.15 }],
			[0.55, { nU: -0.2, nF: 0.0, sw: 0.0, lean: 0.25, crouch: 0.85, nT: -0.4, nS: 0.95, fT: 0.62, fS: 0.95, glow: 1, cape: 0.55, head: 0.12 }],
			[0.86, { nU: -0.2, nF: 0.0, sw: 0.0, lean: 0.25, crouch: 0.85, nT: -0.4, nS: 0.95, fT: 0.62, fS: 0.95, glow: 1, head: 0.2, cape: 0.3 }],
			[1, G0],
		]),
		special: (t) => {
			const k = sample([
				[0, Object.assign({ crouch: 0, lift: 0 }, G0)],
				[0.18, { crouch: 0.95, nT: -0.32, nS: 1.05, fT: 0.52, fS: 1.05, lean: 0.32, nU: 0.4, nF: -0.3, sw: 0.3, lift: 0 }],
				[0.45, { crouch: 0, nT: -0.95, nS: 1.5, fT: 0.25, fS: 1.6, lean: -0.15, nU: 2.85, nF: 2.65, sw: 2.85, lift: 80, cape: 1.1, glow: 1 }],
				[0.62, { nT: -0.5, nS: 0.6, fT: 0.4, fS: 0.6, lean: 0.25, nU: 1.0, nF: 0.4, sw: 0.6, lift: 34, cape: -0.6, smear: 0.9, smearA: 1.0 }],
				[0.74, { crouch: 1, nT: -0.48, nS: 1.15, fT: 0.68, fS: 1.15, lean: 0.42, nU: -0.25, nF: -0.1, sw: -0.05, lift: 0, cape: 0.8, smear: 0.3, smearA: 1.4, glow: 1 }],
				[1, Object.assign({ crouch: 0, lift: 0 }, G0)],
			], t);
			return Object.assign({}, IDLE, k, { grounded: k.lift > 2 ? 0 : 1 });
		},
		hurt: S([
			[0, G0],
			[0.25, { lean: -0.34, head: -0.32, nU: 0.4, nF: -0.6, sw: -0.3, rootX: -10, crouch: 0.15, glow: 1.3, cape: 0.55 }],
			[0.6, { lean: -0.18, head: -0.12, nU: 0.1, nF: -0.8, rootX: -6, crouch: 0.1 }],
			[1, G0],
		]),
		death: (t) => Object.assign({}, IDLE, sample([
			[0, Object.assign({ kneel: 0, fall: 0, glow: 0.6 }, G0)],
			[0.3, { kneel: 0.9, lean: 0.25, nT: -1.25, nS: 1.85, fT: 0.42, fS: 1.6, nU: -0.1, nF: 0.2, sw: 0.1, head: 0.35, glow: 0.4, crouch: 0.4 }],
			[0.6, { kneel: 1, lean: 0.55, nT: -1.3, nS: 2.0, fT: 0.6, fS: 1.8, nU: -0.5, nF: 0.4, sw: 0.6, head: 0.5, glow: 0.2, crouch: 0.6 }],
			[1, { kneel: 1, lean: 1.2, nT: -1.3, nS: 2.0, fT: 0.6, fS: 1.8, nU: -1.1, nF: -0.4, sw: 1.45, head: 0.6, glow: 0, fall: 0.12, crouch: 0.8 }],
		], t)),
	};

	A.bosses.knight = { name: 'Frostbound Knight', TIERS, draw, ANIMS, scale: 0.78, footY: 278, bodyH: 176, flier: false };
})(typeof window !== 'undefined' ? window : globalThis);
