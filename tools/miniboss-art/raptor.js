/* Storm Raptor — a great thunderbird with lightning running through its wings.
   Drawn around its body centre (a flier). Tiers: base (indigo, gold beak) · alpha (gold-tipped crest and primaries)
   · elder (storm-grey, bright veins, crackling crest) · tyrant "Tempest Sovereign" (silver-white plumage, violet
   lightning, a second pair of wings, a storm halo and trailing crown feathers). */
(function(G){
	'use strict';
	const A = G.MBArt, { paint, taper, glow, ellipse, at, sample, lerp, clamp, rgba, mix, shade, tint, TAU } = A;
	const TIERS = {
		base:   { body:'#2b3170', light:'#5f6ab8', dark:'#0d1030', belly:'#8d93c8', shadow:'#171a45', beak:'#e2b23c', beakDark:'#7a5410', vein:'#7fe0ff', veinA:0.55, tip:'#3a4290', crest:'#3a4290', eye:'#fff36a', extraWings:0, halo:0, streamers:0 },
		alpha:  { body:'#2d3374', light:'#6670c0', dark:'#0d1030', belly:'#9aa0d2', shadow:'#181b48', beak:'#f0c24a', beakDark:'#7a5410', vein:'#9fe8ff', veinA:0.7, tip:'#e6be52', crest:'#e6be52', eye:'#fff58a', extraWings:0, halo:0, streamers:0 },
		elder:  { body:'#3a4256', light:'#7c8aa8', dark:'#10141e', belly:'#a9b4c8', shadow:'#1c2230', beak:'#d8dce6', beakDark:'#585c66', vein:'#b4f4ff', veinA:1, tip:'#b4f4ff', crest:'#b4f4ff', eye:'#ffffff', extraWings:0, halo:0.5, streamers:0.5 },
		tyrant: { body:'#c9d0e2', light:'#ffffff', dark:'#4c5274', belly:'#eef1fa', shadow:'#7e86a8', beak:'#2a2340', beakDark:'#0c0816', vein:'#c48cff', veinA:1.3, tip:'#9a5cff', crest:'#c48cff', eye:'#f4e6ff', extraWings:1, halo:1, streamers:1 },
	};
	const LINE = 'rgba(6,6,18,0.95)';
	const IDLE = { bob:0, pitch:0, wn:0.5, wf:0.5, fold:0, legs:0, talon:0, head:0, beak:0, tail:0.3, glow:0.6, crackle:0, rootX:0, roll:0, ruffle:0, fade:0 };

	function lightning(c, T, x0, y0, x1, y1, seed, w, a){
		const r = A.rng(seed), n = 7;
		c.save(); c.globalCompositeOperation = 'lighter'; c.lineJoin = 'round'; c.lineCap = 'round';
		c.beginPath(); c.moveTo(x0, y0);
		for(let i = 1; i < n; i++){ const u = i / n; c.lineTo(lerp(x0, x1, u) + (r() - 0.5) * 16, lerp(y0, y1, u) + (r() - 0.5) * 16); }
		c.lineTo(x1, y1);
		c.shadowColor = T.vein; c.shadowBlur = 12;
		c.strokeStyle = rgba(T.vein, a == null ? 0.9 : a); c.lineWidth = w || 3; c.stroke();
		c.shadowBlur = 0; c.strokeStyle = rgba('#ffffff', (a == null ? 0.9 : a) * 0.8); c.lineWidth = Math.max(1, (w || 3) * 0.35); c.stroke();
		c.restore();
	}
	// a wing in its own frame: shoulder at (0,0), the wing spreads toward −x (backward) and its angle is set by the caller.
	// flap 0 = raised, 1 = fully down; fold 0 = open, 1 = tucked against the body
	function wing(c, T, P, near, scale, seedBase){
		const dk = near ? 0 : 0.35, s = scale || 1, fold = P.fold;
		const span = (150 - fold * 80) * s, chord = (52 - fold * 18) * s;
		const body = mix(T.body, '#000', dk), light = mix(T.light, '#000', dk);
		// arm (leading edge)
		const pts = [[0, -6 * s], [-span * 0.45, -14 * s], [-span, -4 * s], [-span * 0.95, chord * 0.2], [-span * 0.4, chord * 0.75], [0, chord * 0.5]];
		// primaries + secondaries as separate feathers, drawn back to front
		const nF = 9;
		for(let i = nF - 1; i >= 0; i--){
			const u = i / (nF - 1);
			const bx = lerp(-span * 0.32, -span * 0.98, u), by = lerp(chord * 0.3, -2 * s, u);
			const len = lerp(54, 74, u) * s * (1 - fold * 0.35) * (1 + P.ruffle * 0.1 * Math.sin(i * 3));
			const ang = lerp(0.95, 0.15, u) + fold * 0.5 + P.ruffle * 0.15 * Math.sin(i * 7);
			at(c, bx, by, ang, () => {
				const fpts = [[-5 * s, 0], [5 * s, 0], [6 * s, len * 0.7], [0, len], [-6 * s, len * 0.7]];
				paint(c, fpts, { fill: mix(i > 5 ? T.tip : T.body, '#000', dk + 0.08), light: mix(T.light, '#000', dk + 0.1), dark: mix(T.dark, '#000', dk), lw: 2, line: LINE, smooth: 0.4, lx: 0, lx2: 1 });
				c.save(); c.strokeStyle = rgba('#000', 0.35); c.lineWidth = 1; c.beginPath(); c.moveTo(0, 2); c.lineTo(0, len * 0.9); c.stroke(); c.restore();
			});
		}
		paint(c, pts, { fill: body, light, dark: mix(T.dark, '#000', dk), cel: [3, -4, mix(T.shadow, '#000', dk)], lw: 3, line: LINE, smooth: 0.45 });
		// covert feather scallops
		c.save(); c.strokeStyle = rgba(mix(T.dark, '#000', dk), 0.7); c.lineWidth = 1.6;
		for(let r = 0; r < 2; r++) for(let i = 0; i < 6; i++){ const x = -12 * s - i * span * 0.13, y = (4 + r * 12) * s; c.beginPath(); c.arc(x, y, 7 * s, 0.2, Math.PI - 0.2); c.stroke(); }
		c.restore();
		// lightning veins
		if(T.veinA > 0 && near !== null){
			lightning(c, T, -10 * s, 2 * s, -span * 0.8, 8 * s, seedBase + 1, 2.4 * s, T.veinA * (near ? 0.75 : 0.4) * (0.6 + 0.4 * P.glow));
			lightning(c, T, -span * 0.4, 6 * s, -span * 0.75, chord * 0.9, seedBase + 2, 1.8 * s, T.veinA * (near ? 0.6 : 0.3) * (0.6 + 0.4 * P.glow));
		}
	}
	// wing angle from flap value: raised (−1.1 rad) to lowered (+0.55 rad)
	const wingAng = (f) => lerp(1.25, -0.85, f);      // raised (up and back) → lowered (down and back)

	function draw(c, P, tierName, t){
		const T = TIERS[tierName] || TIERS.base;
		const ph = (t || 0) * TAU;
		c.save();
		c.translate(P.rootX, P.bob);
		c.rotate(P.pitch + P.roll);
		if(P.fade) c.globalAlpha = 1 - P.fade * 0.7;
		const bx = 0, by = 0;
		// storm halo behind everything
		if(T.halo){
			c.save(); c.globalCompositeOperation = 'lighter';
			c.strokeStyle = rgba(T.vein, 0.35 * T.halo); c.lineWidth = 3;
			c.beginPath(); c.ellipse(46, -26, 42, 42, 0, 0, TAU); c.stroke();
			for(let i = 0; i < 6; i++){ const a = i / 6 * TAU + ph; lightning(c, T, 46 + Math.cos(a) * 34, -26 + Math.sin(a) * 34, 46 + Math.cos(a + 0.6) * 48, -26 + Math.sin(a + 0.6) * 48, 40 + i, 1.6, 0.45 * T.halo); }
			c.restore();
		}
		// far wing(s)
		if(T.extraWings) at(c, bx + 6, by - 8, wingAng(P.wf) - 0.35, () => wing(c, T, P, false, 0.62, 20));
		at(c, bx + 10, by - 12, wingAng(P.wf) - 0.05, () => wing(c, T, P, false, 1, 10));
		// tail fan
		at(c, bx - 54, by + 4, 0.1 + P.pitch * 0.2, () => {
			const n = 7, spread = 0.25 + P.tail * 0.55;
			for(let i = 0; i < n; i++){
				const a = Math.PI / 2 + lerp(-spread, spread, i / (n - 1)) * 0.6, len = 66 + (i % 2) * 8;
				at(c, 0, 0, a, () => paint(c, [[-7, 0], [7, 0], [8, len * 0.75], [0, len], [-8, len * 0.75]], { fill: mix(i % 2 ? T.body : T.tip, '#000', 0.12), light: T.light, dark: T.dark, lw: 2, line: LINE, smooth: 0.35, lx: 0, lx2: 1 }));
			}
			if(T.streamers){
				for(let k = 0; k < 2; k++){
					const pts = []; for(let i = 0; i < 8; i++){ const u = i / 7; pts.push([-u * 120 * T.streamers, (k - 0.5) * 18 + Math.sin(u * 5 + ph + k) * 10 * u]); }
					taper(c, pts, 7, 1, rgba(T.crest, 0.9), LINE);
				}
			}
		});
		// legs + talons (behind the belly when tucked)
		const legOut = P.legs;
		for(const s of [0, 1]){
			const dk = s ? 0 : 0.3;
			at(c, bx + 8 - s * 10, by + 26, lerp(0.9, -0.5, legOut) - s * 0.15, () => {
				taper(c, [[0, 0], [0, 26 + legOut * 10]], 10, 7, mix(T.beakDark, '#000', dk), LINE);
				at(c, 0, 30 + legOut * 10, -0.3 + P.talon * 0.5, () => {
					for(let k = 0; k < 3; k++){
						const a = lerp(-0.9, 0.7, k / 2) * (0.6 + P.talon * 0.8);
						at(c, 0, 0, a, () => taper(c, [[0, 0], [0, 12], [4, 20]], 6, 1.5, mix(T.beak, '#000', dk + 0.1), LINE));
					}
				});
			});
		}
		// body
		const bodyPts = [[78, -26], [50, -36], [6, -34], [-36, -22], [-62, 0], [-40, 18], [0, 30], [44, 22], [72, 4]];
		paint(c, bodyPts, { fill: T.body, light: T.light, dark: T.dark, cel: [3, -5, T.shadow], lw: 3.5, line: LINE, smooth: 0.5, rim: rgba(T.light, 0.5), rimW: 5 });
		// belly feathers
		paint(c, [[58, 6], [30, 24], [-6, 26], [-26, 16], [6, 6], [40, 0]], { fill: T.belly, light: tint(T.belly, 0.3), dark: mix(T.belly, T.shadow, 0.6), lw: 2, line: rgba('#000', 0.5), smooth: 0.5 });
		c.save(); c.strokeStyle = rgba(T.shadow, 0.5); c.lineWidth = 1.4;
		for(let i = 0; i < 9; i++){ const x = 46 - i * 8, y = 10 + Math.sin(i) * 3; c.beginPath(); c.arc(x, y, 5, 0.3, Math.PI - 0.3); c.stroke(); }
		c.restore();
		lightning(c, T, -30, -14, 40, -24, 5, 2.2, 0.5 * T.veinA * (0.5 + 0.5 * P.glow));
		// neck + head
		at(c, bx + 66, by - 30, P.head, () => {
			// crest feathers
			const cl = 1 + T.halo * 0.6;
			for(let i = 0; i < 5 + T.extraWings * 2; i++){
				const a = -2.7 - i * 0.16, len = (26 + i * 4) * cl;
				at(c, -6, -10, a, () => paint(c, [[-4, 0], [4, 0], [2, len], [0, len + 6]], { fill: mix(T.crest, '#000', i * 0.04), light: tint(T.crest, 0.3), dark: shade(T.crest, 0.5), lw: 2, line: LINE, smooth: 0.3 }));
			}
			if(T.halo > 0.3) lightning(c, T, -10, -16, -40 * cl, -30 * cl, 9, 1.8, 0.7);
			paint(c, [[-14, 6], [-8, -14], [10, -22], [30, -16], [38, -4], [28, 8], [4, 14]], { fill: T.body, light: T.light, dark: T.dark, cel: [3, -3, T.shadow], lw: 3, line: LINE, smooth: 0.5, rim: rgba(T.light, 0.5) });
			// beak: upper and lower mandibles
			const open = P.beak;
			paint(c, [[30, -12], [52, -9], [64, 2], [56, 6], [48, -1], [32, 0]], { fill: T.beak, light: tint(T.beak, 0.4), dark: T.beakDark, lw: 2.5, line: LINE, smooth: 0.3, lx: 0, lx2: 1 });
			at(c, 32, 0, open * 0.5, () => paint(c, [[0, 0], [18, 0], [26, 4], [14, 8], [0, 6]], { fill: shade(T.beak, 0.15), light: T.beak, dark: T.beakDark, lw: 2, line: LINE, smooth: 0.3 }));
			if(open > 0.3) glow(c, 52, 6, 22 * open, T.vein, 0.6 * open);
			// eye
			ellipse(c, 20, -10, 5.5, 4.5, '#0a0a10');
			glow(c, 21, -10, 12 + 6 * P.glow, T.eye, 0.85);
			ellipse(c, 21, -10, 2.4, 2.4, T.eye);
			taper(c, [[10, -15], [28, -14]], 4, 2, rgba(T.dark, 0.9));
		});
		// near wing(s) on top
		at(c, bx + 18, by - 16, wingAng(P.wn), () => wing(c, T, P, true, 1, 30));
		if(T.extraWings) at(c, bx + 10, by - 6, wingAng(P.wn) - 0.45, () => wing(c, T, P, true, 0.62, 50));
		// static crackle aura
		if(P.crackle > 0.05){
			for(let i = 0; i < 5; i++){ const a = i / 5 * TAU + ph * 2; lightning(c, T, Math.cos(a) * 30, Math.sin(a) * 24, Math.cos(a) * 90, Math.sin(a) * 70, 70 + i + Math.floor(ph * 3), 2.4, 0.8 * P.crackle); }
			glow(c, 0, 0, 120, T.vein, 0.25 * P.crackle);
		}
		c.restore();
	}

	const S = (keys) => (t) => Object.assign({}, IDLE, sample(keys, t));
	const ANIMS = {
		idle: (t) => {
			const p = t * TAU, f = 0.5 + 0.5 * Math.sin(p);
			return Object.assign({}, IDLE, { wn: f, wf: f * 0.9 + 0.05, bob: -Math.cos(p) * 8, pitch: -0.04 + Math.sin(p) * 0.03, tail: 0.35, glow: 0.5 + 0.4 * f, head: Math.sin(p) * 0.05 });
		},
		move: (t) => {
			const p = t * TAU, f = 0.5 + 0.5 * Math.sin(p * 2);
			return Object.assign({}, IDLE, { wn: 0.35 + f * 0.3, wf: 0.3 + f * 0.3, fold: 0.35, pitch: 0.12, bob: Math.sin(p) * 4, tail: 0.1, head: -0.08, glow: 0.7 });
		},
		attackA: S([
			[0, { wn: 0.5, wf: 0.5 }],
			[0.3, { wn: 0.0, wf: 0.05, pitch: -0.45, legs: 0.6, talon: 0.2, head: 0.25, tail: 0.8, glow: 0.8, beak: 0.6 }],
			[0.5, { wn: 1, wf: 0.95, pitch: -0.3, legs: 1, talon: 1, head: 0.1, rootX: 26, tail: 0.6, glow: 1, crackle: 0.6, beak: 0.3 }],
			[0.7, { wn: 0.7, wf: 0.7, pitch: -0.1, legs: 0.6, talon: 0.6, rootX: 20, glow: 0.8, crackle: 0.2 }],
			[1, { wn: 0.5, wf: 0.5 }],
		]),
		attackB: S([
			[0, { wn: 0.5, wf: 0.5 }],
			[0.25, { wn: 0.05, wf: 0.05, pitch: -0.25, fold: 0.2, head: -0.15, glow: 0.8, beak: 0.8, crackle: 0.3 }],
			[0.5, { wn: 0.6, wf: 0.6, fold: 1, pitch: 1.05, head: -0.3, tail: 0, glow: 1, crackle: 1, rootX: 16, bob: 20 }],
			[0.75, { wn: 0.6, wf: 0.6, fold: 0.9, pitch: 0.9, head: -0.2, glow: 1, crackle: 0.8, rootX: 20, bob: 26, legs: 0.8, talon: 1 }],
			[1, { wn: 0.5, wf: 0.5 }],
		]),
		cast: S([
			[0, { wn: 0.5, wf: 0.5 }],
			[0.35, { wn: 0.0, wf: 0.0, pitch: -0.3, head: -0.5, beak: 1, tail: 1, glow: 1, crackle: 0.6 }],
			[0.65, { wn: 0.0, wf: 0.0, pitch: -0.32, head: -0.55, beak: 1, tail: 1, glow: 1.4, crackle: 1 }],
			[1, { wn: 0.5, wf: 0.5 }],
		]),
		special: (t) => {
			const p = t * TAU, f = 0.5 + 0.5 * Math.sin(p * 2);
			return Object.assign({}, IDLE, { wn: f, wf: f, pitch: -0.2 + 0.1 * Math.sin(p * 2), tail: 0.9, head: -0.1, glow: 1, crackle: 0.5 + 0.5 * f, bob: -Math.cos(p * 2) * 10, beak: 0.4 });
		},
		hurt: S([
			[0, { wn: 0.5, wf: 0.5 }],
			[0.25, { wn: 0.9, wf: 0.1, pitch: -0.4, roll: -0.2, head: 0.4, ruffle: 1, glow: 1.2, rootX: -12, beak: 0.7 }],
			[0.6, { wn: 0.6, wf: 0.3, pitch: -0.15, roll: -0.1, ruffle: 0.5, rootX: -6 }],
			[1, { wn: 0.5, wf: 0.5 }],
		]),
		death: S([
			[0, { wn: 0.5, wf: 0.5 }],
			[0.3, { wn: 0.95, wf: 0.1, pitch: 0.5, roll: 0.3, head: 0.6, ruffle: 1, beak: 0.8, glow: 0.6, bob: 10 }],
			[0.7, { wn: 0.8, wf: 0.6, fold: 0.5, pitch: 1.6, roll: 0.4, head: 0.9, ruffle: 1, beak: 0.6, glow: 0.2, bob: 50 }],
			[1, { wn: 0.7, wf: 0.7, fold: 0.7, pitch: 2.2, roll: 0.4, head: 1.0, ruffle: 1, beak: 0.5, glow: 0, bob: 80, fade: 0.5 }],
		]),
	};
	A.bosses.raptor = { name: 'Storm Raptor', TIERS, draw, ANIMS, scale: 0.84, flier: true, bodyH: 120, offsetX: 22 };
})(typeof window !== 'undefined' ? window : globalThis);
