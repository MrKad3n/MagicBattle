/* =============================================================
   Ignaroth — dragon rig, built like the player rig (player-rig.js): a skeleton whose bones carry baked sprites.
   Body, a 6-vertebra neck, a hinged jaw,
   two-section wings with four fingered membranes, a 4-leg IK walk cycle and an 11-segment tail
   with whip-lag. Each attack and locomotion state sets pose targets; the rig eases toward them,
   so transitions (rearing back before the breath, folding the wings for the dive, coiling the
   tail before it lashes) read as one animal moving instead of frames swapping.
   ============================================================= */
(function(global){
	const PI = Math.PI;
	function lerp(a, b, t){ return a + (b - a) * t; }
	function clamp(v, a, b){ return v < a ? a : v > b ? b : v; }
	function fin(v, d){ return isFinite(v) ? v : d; }
	function angDiff(a, b){ let d = a - b; while(d > PI) d -= PI * 2; while(d < -PI) d += PI * 2; return d; }

	const TAIL_N = 11, TAIL_LEN = 25;
	const BODY = [[102,-6],[92,-40],[56,-66],[8,-74],[-44,-64],[-88,-42],[-116,-12],[-108,14],[-70,36],[-14,48],[44,44],[86,28]];
	const NECK_BASE = [92, -50];
	const SHOULDER = [34, -52];
	const WING_UP = 86, WING_FORE = 108, WING_FINGER = [150, 158, 138, 104];
	const TAIL_ROOT = [-106, 6];
	const HIPS = { fN:[62, 34], fF:[44, 36], hN:[-62, 30], hF:[-80, 32] };
	const CRACKS = [
		[[72,-30],[52,-20],[58,-4],[34,6],[40,24]],
		[[18,-52],[8,-34],[22,-20],[4,-6]],
		[[-30,-48],[-42,-30],[-28,-16],[-48,0],[-40,18]],
		[[-84,-26],[-70,-10],[-88,4],[-76,20]],
		[[96,2],[78,12],[84,26]],
	];

	function newRig(){
		const p = { pitch:0, crouch:0, hx:165, hy:-78, hang:0.12, jaw:0.05, wBase:-2.7, wAmp:0.03, wSpd:0.03, wSpread:1, wFold:0.85, wBend:0.9,
			tailBase:0, tailSwing:0, tailCurl:0, tuck:0, glow:0.3, breathe:1, eye:1, front:0, chest:1, lunge:0, legFwd:0 };
		const tail = [];
		for(let i = 0; i < TAIL_N; i++) tail.push(PI);
		return { p, tail, t:0, flapPh:0, walkPh:0, joints:{}, wings:[null, null], legs:[null, null, null, null], stepped:false, lastX:null, wingBeat:0, lastFlapSin:0 };
	}

	/* ---------------- pose targets from the AI state ---------------- */
	function targets(en, ig, R){
		const T = { pitch:0, crouch:0, hx:166, hy:-78, hang:0.12, jaw:0.05, wBase:-2.7, wAmp:0.03, wSpd:0.03, wSpread:1, wFold:0.85, wBend:0.9,
			tailBase:0, tailSwing:0, tailCurl:0, tuck:0, glow:0.3, breathe:1, eye:1, front:0, chest:1, lunge:0, legFwd:0 };
		const t = R.t;
		T.hy += Math.sin(t * 0.045) * 3; T.hx += Math.sin(t * 0.03) * 2;
		T.tailSwing = Math.sin(t * 0.03) * 0.1;
		const a = ig && ig.atk, n = a && a.name, at = a ? a.t : 0;
		const ph = ig ? ig.phase : 1;
		const flying = ig ? !ig.onGround : (en.y < (en._igGroundY != null ? en._igGroundY - 6 : 1e9));
		const loco = ig ? ig.loco : 'walk';
		T.glow = ph >= 3 ? 0.8 : ph >= 2 ? 0.55 : 0.32;

		// base locomotion
		if(flying){
			T.wBase = -2.0; T.wAmp = 0.55; T.wSpd = 0.17; T.wFold = 0; T.wBend = 0.9; T.tuck = 0.8;
			T.pitch = clamp((en.vy || 0) * 0.03 + (en.vx || 0) * (en.facing || 1) * 0.012, -0.25, 0.35);
			T.tailBase = -0.12 + clamp(-(en.vy || 0) * 0.03, -0.3, 0.3);
			T.hy = -82; T.hang = 0.05;
			if(loco === 'launch'){ T.wAmp = 0.9; T.wSpd = 0.3; T.crouch = 10; T.pitch = -0.1; }
			if(loco === 'land'){ T.wAmp = 0.85; T.wSpd = 0.2; T.wBase = -1.7; T.pitch = -0.12; T.tuck = 0.2; T.legFwd = 0.4; }
		} else {
			T.wBase = -2.6; T.wAmp = 0.03; T.wFold = 0.86; T.wSpd = 0.03;
			if(loco === 'sprint'){ T.pitch = 0.12; T.hx = 190; T.hy = -60; T.hang = 0.2; T.wFold = 0.6; T.wAmp = 0.1; T.wSpd = 0.12; T.tailBase = 0.22; T.crouch = 6; }
			else if(loco === 'launch'){ T.crouch = 20; T.wFold = 0.2; T.wBase = -2.2; T.pitch = -0.06; T.hy = -90; }
		}

		const vuln = ig && ig.vulnerable > 0;
		if(ig && ig.intro > 0){
			const it = 150 - ig.intro;
			if(it > 28 && it < 118){
				const k = Math.sin(clamp((it - 28) / 90, 0, 1) * PI);
				T.hx = lerp(166, 146, k); T.hy = lerp(-78, -134, k); T.hang = lerp(0.12, -0.9, k); T.jaw = lerp(0.05, 1, k);
				T.pitch = -0.2 * k; T.front = k; T.wFold = lerp(0.86, 0, k); T.wBase = lerp(-2.6, -1.75, k); T.wAmp = 0.12 * k; T.wSpd = 0.4;
				T.chest = 1 + 0.09 * k; T.glow = 0.5 + 0.5 * k; T.tailBase = 0.1 * k; T.tailCurl = 0.5 * k;
			}
		} else if(vuln){
			T.crouch = 28; T.pitch = 0.1; T.hx = 162; T.hy = -26; T.hang = 0.62; T.jaw = 0.14; T.wFold = 0.62; T.wBase = -2.85; T.wAmp = 0.03;
			T.glow = 0.12; T.eye = 0.4; T.breathe = 1.7; T.tailBase = -0.25; T.tuck = 0;
		} else if(n === 'breath'){
			if(at < 50){
				const k = at / 50, e = k * k * (3 - 2 * k);
				T.hx = lerp(166, 134, e); T.hy = lerp(-78, -142, e); T.hang = lerp(0.12, -0.62, e); T.jaw = 0.12 + 0.4 * e;
				T.crouch = 14 * e; T.pitch = -0.17 * e; T.chest = 1 + 0.12 * e; T.glow = 0.5 + 0.5 * e; T.breathe = 1 + e;
				if(!flying){ T.wFold = lerp(0.86, 0.15, e); T.wBase = lerp(-2.6, -2.15, e); T.wAmp = 0.05; }
				T.tailBase = 0.14 * e; T.tailCurl = 0.3 * e;
			} else {
				let la = ig ? ig.ang : 0;
				if((en.facing || 1) < 0) la = PI - la;
				la = angDiff(la, 0);
				T.hx = 196; T.hy = -70; T.hang = clamp(la, -0.95, 1.15); T.jaw = 0.95; T.crouch = 6; T.pitch = 0.1;
				T.lunge = 1; T.glow = 1; T.chest = 0.96;
				if(!flying){ T.wFold = 0.1; T.wBase = -2.3; T.wAmp = 0.08; T.wSpd = 0.35; }
				T.tailBase = -0.05; T.tailCurl = 0;
			}
		} else if(n === 'tail'){
			const k = clamp(at / 44, 0, 1);
			if(at < 44){
				const e = k * k * (3 - 2 * k);
				T.hx = lerp(166, 124, e); T.hy = lerp(-78, -96, e); T.hang = lerp(0.12, -0.12, e); T.jaw = 0.2 * e;
				T.crouch = 14 * e; T.pitch = -0.08 * e; T.tailSwing = lerp(0, 1.25, e); T.tailCurl = 0.7 * e; T.glow = 0.7;
				if(!flying){ T.wFold = 0.4 * (1 - e) + 0.5; }
			} else {
				const u = clamp((at - 44) / 10, 0, 1);
				T.hx = 188; T.hy = -62; T.hang = 0.14; T.jaw = 0.4 * (1 - u);
				T.tailSwing = lerp(1.25, -0.32, u) + (at > 54 ? 0.2 * clamp((at - 54) / 30, 0, 1) : 0); T.tailCurl = 0; T.crouch = 4; T.pitch = 0.1; T.glow = 1;
				T.wFold = 0.2; T.wBase = -2.2; T.wAmp = 0.06;
			}
		} else if(n === 'roar'){
			const k = clamp(at / 24, 0, 1), rel = at > 96 ? clamp((at - 96) / 30, 0, 1) : 0, e = k * (1 - rel);
			const pre = at < 10 ? Math.sin(at / 10 * PI * 0.5) : 0;
			T.hx = lerp(166, 150, e); T.hy = lerp(-78, -136, e) + pre * 30; T.hang = lerp(0.12, -0.95, e) + pre * 0.5; T.jaw = lerp(0.05, 1, e);
			T.pitch = -0.19 * e; T.front = e; T.crouch = pre * 12;
			T.wFold = lerp(0.86, 0, e); T.wBase = lerp(-2.6, -1.75, e); T.wAmp = 0.1 * e; T.wSpd = 0.45; T.chest = 1 + 0.1 * e; T.glow = 0.5 + 0.5 * e; T.tailCurl = 0.5 * e; T.tailBase = 0.12 * e;
		} else if(n === 'dive'){
			if(at < 50){ T.wAmp = 0.85; T.wSpd = 0.22; T.hx = 175; T.hy = -70; T.hang = 0.05; T.tuck = 0.5; T.pitch = -0.1; }
			else if(at < 92){
				T.wBase = -2.45; T.wAmp = 0.18; T.wSpd = 0.09; T.hx = 176; T.hy = -40; T.hang = 0.5; T.jaw = 0.22; T.pitch = 0.08; T.tailBase = -0.35; T.tuck = 0.9; T.glow = 0.7;
			} else if(at < 138){
				T.wFold = 1; T.wBase = -2.9; T.wAmp = 0; T.pitch = 0.8; T.hx = 190; T.hy = -18; T.hang = 0.95; T.jaw = 0.3; T.tailBase = 0.5; T.tailCurl = 0;
				T.tuck = 0; T.legFwd = 1; T.glow = 1;
			} else {
				T.crouch = 24; T.wFold = 0; T.wBase = -1.9; T.wAmp = 0.12; T.hx = 150; T.hy = -80; T.hang = -0.2; T.jaw = 0.55; T.glow = 1; T.pitch = -0.1; T.tuck = 0; T.tailBase = 0.2;
			}
		} else if(n === 'scorch'){
			T.wBase = -2.1; T.wAmp = 0.6; T.wSpd = 0.2; T.pitch = 0.14; T.hx = 182; T.hy = -52; T.hang = 0.22; T.jaw = 0.32; T.tuck = 0.3; T.legFwd = 0.2; T.glow = 1;
			T.tailBase = -0.18 + Math.sin(t * 0.12) * 0.12; T.tailSwing = Math.sin(t * 0.12) * 0.4;
		} else if(n === 'pursuit'){
			T.wBase = -2.55; T.wAmp = 0.42; T.wSpd = 0.28; T.pitch = 0.1; T.hx = 198; T.hy = -68; T.hang = 0.08; T.jaw = 0.5; T.tuck = 1; T.tailBase = 0.05; T.glow = 0.9;
		} else if(n === 'barrage'){
			T.wBase = -2.15; T.wAmp = 0.22; T.wSpd = 0.1; T.wSpread = 1.15; T.pitch = -0.12; T.hx = 158; T.hy = -112; T.hang = -0.5; T.jaw = 0.45; T.tailBase = -0.3; T.glow = 0.6 + 0.4 * Math.min(1, at / 120);
			T.tuck = 0.7;
		} else if(n === 'meteor'){
			const k = clamp(at / 90, 0, 1);
			T.wAmp = 0.5; T.wSpd = 0.12; T.wBase = -2.0; T.pitch = -0.14 * k; T.hx = lerp(166, 150, k); T.hy = lerp(-80, -118, k); T.hang = lerp(0.1, -0.62, k); T.jaw = 0.25 + 0.65 * k; T.glow = 0.5 + 0.5 * k;
			if(at >= 94){ const u = clamp((at - 94) / 10, 0, 1); T.hx = lerp(150, 206, u); T.hy = lerp(-118, -64, u); T.hang = lerp(-0.62, 0.3, u); T.jaw = 1; T.lunge = u; }
			T.tuck = 0.6;
		} else if(n === 'tempest'){
			T.wBase = -1.65; T.wAmp = 1.0; T.wSpd = 0.13; T.wSpread = 1.1; T.pitch = -0.2; T.hx = 154; T.hy = -108; T.hang = -0.45; T.jaw = 0.6; T.tuck = 0.3; T.glow = 0.7; T.tailBase = 0.1;
			if(!flying) T.crouch = 8;
		} else if(n === 'erupt'){
			T.wAmp = 0.5; T.wSpd = 0.2; T.wBase = -2.0; T.pitch = 0.15; T.hx = 178; T.hy = -36; T.hang = 0.78; T.tuck = 0.8; T.glow = 0.9;
			T.jaw = (at > 30 && at < 60) || (at > 85 && at < 115) || (at > 140 && at < 170) ? 0.95 : 0.25;
		} else if(n === 'cascade'){
			// ground stomp: rises on the hind legs and slams down each time a column breaks
			const beat = at % 7;
			T.crouch = 8; T.hx = 160; T.hy = -98 + (beat < 3 ? -14 : 0); T.hang = -0.2; T.jaw = 0.4; T.front = beat < 3 ? 1 : 0; T.pitch = -0.12 + (beat < 3 ? -0.05 : 0.03);
			T.wFold = 0.2; T.wBase = -2.1; T.wAmp = 0.15; T.wSpd = 0.25; T.glow = 0.9; T.tailBase = 0.1;
		}
		// the dragon of the sprite sheet stands tall: an upright S-neck with the head well above the shoulders
		if(!vuln && !(n === 'dive' && at >= 92 && at < 138)){ T.hy -= 44; T.hx -= 16; }
		return T;
	}

	const RATES = { pitch:0.1, crouch:0.2, hx:0.16, hy:0.16, hang:0.22, jaw:0.3, wBase:0.12, wAmp:0.1, wSpd:0.1, wSpread:0.1, wFold:0.12, wBend:0.1,
		tailBase:0.1, tailSwing:0.3, tailCurl:0.12, tuck:0.12, glow:0.08, breathe:0.1, eye:0.2, front:0.18, chest:0.2, lunge:0.3, legFwd:0.15 };

	/* ---------------- geometry ---------------- */
	function ik(hx, hy, fx, fy, l1, l2, sign){
		let dx = fx - hx, dy = fy - hy, d = Math.hypot(dx, dy) || 0.001;
		const max = l1 + l2 - 0.5, min = Math.abs(l1 - l2) + 1;
		if(d > max){ fx = hx + dx / d * max; fy = hy + dy / d * max; dx = fx - hx; dy = fy - hy; d = max; }
		if(d < min){ d = min; fx = hx + dx / (Math.hypot(dx, dy) || 1) * min; fy = hy + dy / (Math.hypot(dx, dy) || 1) * min; dx = fx - hx; dy = fy - hy; }
		const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
		const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
		const ux = dx / d, uy = dy / d;
		return { kx: hx + ux * a + (-uy) * h * sign, ky: hy + uy * a + ux * h * sign, fx: fx, fy: fy };
	}

	function wingGeom(R, which){
		const p = R.p, far = which === 1;
		const flap = Math.sin(R.flapPh + (far ? 0.5 : 0));
		const fold = p.wFold;
		const S = { x: SHOULDER[0] + (far ? -16 : 0), y: SHOULDER[1] + (far ? -6 : 0) };
		const a1 = lerp(p.wBase + p.wAmp * flap + (far ? 0.1 : 0), -2.45 - (far ? 0.1 : 0), fold);
		const bend = lerp(p.wBend * (0.85 + 0.25 * flap * p.wAmp), -1.0, fold);
		const a2 = a1 + bend;
		const lenK = 1 - fold * 0.22;
		const E = { x: S.x + Math.cos(a1) * WING_UP * lenK, y: S.y + Math.sin(a1) * WING_UP * lenK };
		const Wr = { x: E.x + Math.cos(a2) * WING_FORE * lenK, y: E.y + Math.sin(a2) * WING_FORE * lenK };
		const spread = p.wSpread * (1 - fold * 0.9);
		const a3 = a2 + lerp(0.12, 0.35, 1 - fold) + flap * p.wAmp * 0.15;
		const F = [];
		for(let i = 0; i < 4; i++){
			const ang = a3 + (0.2 + i * 0.5) * spread * (1 + flap * 0.12 * p.wAmp) + (fold > 0.5 ? i * 0.05 : 0);
			const len = WING_FINGER[i] * (1 - fold * 0.18);
			F.push({ x: Wr.x + Math.cos(ang) * len, y: Wr.y + Math.sin(ang) * len });
		}
		return { S, E, W: Wr, F, A: { x: -34, y: -18 }, flap };
	}

	/* ---------------- step: pose, tail chain, joints ---------------- */
	function step(en){
		if(!en) return;
		const R = en._rig || (en._rig = newRig());
		const ig = en._ig || null;
		R.t++;
		const T = targets(en, ig, R);
		const p = R.p;
		for(const k in RATES) p[k] = fin(p[k] + (T[k] - p[k]) * RATES[k], T[k]);
		R.flapPh += p.wSpd + (R.wingBeat > 0 ? 0.06 : 0);
		const fs = Math.sin(R.flapPh);
		R.wingBeat = fs > R.lastFlapSin ? 0 : 1; R.lastFlapSin = fs;
		const onGround = ig ? ig.onGround : false;
		R.onGround = onGround;
		const vx = (ig ? ig.vx : en.vx) || 0;
		if(onGround) R.walkPh += Math.abs(vx) * 0.046;
		R.speed = Math.abs(vx);

		// tail: each segment chases the one before it — that lag is what makes it whip
		const base = PI + p.tailBase + p.tailSwing * 0.95;
		for(let i = 0; i < TAIL_N; i++){
			const sway = Math.sin(R.t * 0.055 - i * 0.55) * 0.05 * (0.4 + i * 0.12);
			const want = base + (i * p.tailCurl * 0.1) + sway - (i * Math.abs(p.tailSwing) * 0.02);
			const rate = lerp(0.5, 0.14, i / (TAIL_N - 1));
			R.tail[i] = fin(R.tail[i] + angDiff(want, R.tail[i]) * rate, want);
		}
		R.wings[0] = wingGeom(R, 0);
		R.wings[1] = wingGeom(R, 1);

		// world transform + exposed joints (effects, hit origins and projectiles read these)
		const k = en.w / 320, dir = (en.facing || 1) >= 0 ? 1 : -1;
		const bx = en.x + en.w / 2, by = en.y + en.h * 0.45 + p.crouch * k;
		R.k = k; R.dir = dir; R.bx = bx; R.by = by;
		const c = Math.cos(p.pitch), s = Math.sin(p.pitch);
		const W = (x, y) => { const rx = x * c - y * s, ry = x * s + y * c; return { x: bx + rx * k * dir, y: by + ry * k }; };
		R.W = W;
		const hj = { x: p.hx, y: p.hy };
		const hc = Math.cos(p.hang), hs = Math.sin(p.hang);
		const H = (x, y) => W(hj.x + x * hc - y * hs, hj.y + x * hs + y * hc);
		const J = R.joints;
		J.mouth = H(76, 4);
		J.head = H(0, 0);
		J.eye = H(16, -12);
		let tx = TAIL_ROOT[0], ty = TAIL_ROOT[1];
		const tailPts = [{ x:tx, y:ty }];
		for(let i = 0; i < TAIL_N; i++){ tx += Math.cos(R.tail[i]) * TAIL_LEN; ty += Math.sin(R.tail[i]) * TAIL_LEN; tailPts.push({ x:tx, y:ty }); }
		R.tailPts = tailPts;
		J.tail = W(tx, ty);
		J.tailMid = W(tailPts[6].x, tailPts[6].y);
		J.belly = W(0, 52);
		J.chest = W(70, -8);
		J.wingNear = W(R.wings[0].F[1].x, R.wings[0].F[1].y);
		J.wingFar = W(R.wings[1].F[1].x, R.wings[1].F[1].y);
		J.wingNearRoot = W(R.wings[0].W.x, R.wings[0].W.y);
		J.wingFarRoot = W(R.wings[1].W.x, R.wings[1].W.y);

		// legs (IK in the un-pitched frame; ground is the bottom of the hit box)
		const gy = (en.y + en.h - by) / k;
		const hips = [HIPS.fN, HIPS.fF, HIPS.hN, HIPS.hF];
		const cyc = [0, 0.5, 0.5, 0];
		const stride = clamp(R.speed * 9, 0, 40);
		for(let i = 0; i < 4; i++){
			const hp = hips[i], front = i < 2;
			const hxw = hp[0] * c - hp[1] * s, hyw = hp[0] * s + hp[1] * c;
			let fx, fy;
			if(onGround){
				const ph2 = R.walkPh + cyc[i] * PI * 2;
				fx = hxw + (front ? 22 : -10) + Math.sin(ph2) * stride + (front ? p.legFwd * 40 : 0);
				fy = gy - Math.max(0, Math.cos(ph2)) * stride * 0.55;
				if(front && p.front > 0.05){ fx = hxw + 42 + p.front * 12; fy = lerp(fy, hyw + 26, p.front); }
				if(R.speed < 0.3 && !front) fx += i === 3 ? -14 : 0;
			} else {
				const tk = clamp(p.tuck, 0, 1);
				const dive = p.legFwd;
				const rot = (x, y) => [x * c - y * s, x * s + y * c];
				const tuckFoot = front ? [hp[0] + 30, hp[1] + 46] : [hp[0] - 38 + Math.sin(R.t * 0.08) * 4, hp[1] + 50];
				const hangFoot = front ? [hp[0] + 22, hp[1] + 82] : [hp[0] - 14, hp[1] + 84];
				const diveFoot = front ? [hp[0] + 96, hp[1] + 38] : [hp[0] - 10, hp[1] + 70];
				const a1 = [lerp(hangFoot[0], tuckFoot[0], tk), lerp(hangFoot[1], tuckFoot[1], tk)];
				const a2 = [lerp(a1[0], diveFoot[0], dive), lerp(a1[1], diveFoot[1], dive)];
				const r = rot(a2[0], a2[1]); fx = r[0]; fy = r[1];
			}
			R.legs[i] = { hx: hxw, hy: hyw, fx, fy, front };
		}
	}

	/* =================================================================================================
	   ART — like the player rig: every bone carries a baked sprite (painted once, at load, into an
	   offscreen sheet at 2× detail), and drawing is just placing those sprites along the skeleton.
	   Back-side limbs use darker baked copies; the lava glow is a separate additive sprite whose
	   alpha follows the pose, so nothing is re-painted per frame.
	   ================================================================================================= */
	const S = 2;      // bake detail (sprite pixels per rig unit)
	const ART = { ready:false, parts:{}, memb:null, membFar:null };
	function mk(w, h, ax, ay, paint){
		const el = document.createElement('canvas');
		el.width = Math.ceil(w * S); el.height = Math.ceil(h * S);
		const g = el.getContext('2d');
		g.translate(ax * S, ay * S); g.scale(S, S);
		g.lineJoin = 'round'; g.lineCap = 'round';
		paint(g);
		return { cv: el, ax, ay, w, h };
	}
	function darken(sp, k){
		const el = document.createElement('canvas'); el.width = sp.cv.width; el.height = sp.cv.height;
		const g = el.getContext('2d');
		g.drawImage(sp.cv, 0, 0);
		g.globalCompositeOperation = 'source-atop';
		g.fillStyle = 'rgba(10,2,1,' + k + ')'; g.fillRect(0, 0, el.width, el.height);
		return { cv: el, ax: sp.ax, ay: sp.ay, w: sp.w, h: sp.h };
	}
	function smoothPoly(g, pts, close){
		const n = pts.length;
		g.beginPath();
		const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
		if(close){
			const m0 = mid(pts[n - 1], pts[0]); g.moveTo(m0[0], m0[1]);
			for(let i = 0; i < n; i++){ const p = pts[i], m = mid(p, pts[(i + 1) % n]); g.quadraticCurveTo(p[0], p[1], m[0], m[1]); }
			g.closePath();
		} else {
			g.moveTo(pts[0][0], pts[0][1]);
			for(let i = 1; i < n - 1; i++){ const m = mid(pts[i], pts[i + 1]); g.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]); }
			g.lineTo(pts[n - 1][0], pts[n - 1][1]);
		}
	}
	const INK = 'rgba(16,3,2,0.95)';
	/* a limb segment along +x from the joint: rounded, tapered, shaded top-lit with scale rows */
	function paintLimb(g, len, w0, w1, c0, c1){
		g.beginPath();
		g.moveTo(0, -w0 / 2);
		g.quadraticCurveTo(len * 0.5, -(w0 + w1) / 4 - 3, len, -w1 / 2);
		g.arc(len, 0, w1 / 2, -PI / 2, PI / 2);
		g.quadraticCurveTo(len * 0.5, (w0 + w1) / 4 + 2, 0, w0 / 2);
		g.arc(0, 0, w0 / 2, PI / 2, PI * 1.5);
		g.closePath();
		const gr = g.createLinearGradient(0, -w0 / 2, 0, w0 / 2);
		gr.addColorStop(0, c1); gr.addColorStop(0.45, c0); gr.addColorStop(1, '#1e0705');
		g.fillStyle = gr; g.fill();
		g.save(); g.clip();
		g.strokeStyle = 'rgba(0,0,0,0.28)'; g.lineWidth = 1.2;
		for(let x = 4; x < len; x += 9){ g.beginPath(); g.arc(x, -w0 * 0.1, 6, 0.3, PI - 0.3); g.stroke(); }
		g.strokeStyle = 'rgba(255,160,90,0.18)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -w0 / 2 + 2); g.quadraticCurveTo(len * 0.5, -(w0 + w1) / 4 - 1, len, -w1 / 2 + 2); g.stroke();
		g.restore();
		g.lineWidth = 2.8; g.strokeStyle = INK; g.stroke();
	}
	function paintSpike(g, x, y, h, w, ang){
		g.save(); g.translate(x, y); g.rotate(ang);
		const sg = g.createLinearGradient(0, 0, 0, -h);
		sg.addColorStop(0, '#7a2f16'); sg.addColorStop(0.55, '#d9c392'); sg.addColorStop(1, '#f4e7c4');
		g.fillStyle = sg; g.beginPath(); g.moveTo(-w, 3); g.quadraticCurveTo(-w * 0.2, -h * 0.6, -h * 0.35, -h); g.quadraticCurveTo(w * 0.25, -h * 0.45, w, 3); g.closePath(); g.fill();
		g.strokeStyle = INK; g.lineWidth = 1.8; g.stroke();
		g.restore();
	}
	function radial(r, stops){
		return mk(r * 2, r * 2, r, r, (g) => {
			const gr = g.createRadialGradient(0, 0, 0, 0, 0, r);
			for(const s of stops) gr.addColorStop(s[0], s[1]);
			g.fillStyle = gr; g.fillRect(-r, -r, r * 2, r * 2);
		});
	}

	function bake(){
		if(ART.ready || typeof document === 'undefined') return ART.ready;
		const P = ART.parts;
		/* ---- torso: silhouette, scale rows, belly plates, dorsal spikes, dim veins ---- */
		P.torso = mk(260, 190, 130, 118, (g) => {
			for(let i = 8; i >= 0; i--){
				const u = i / 8, x = lerp(66, -100, u), y = lerp(-66, -34, u * u) - Math.sin(u * PI) * 8 + (i === 0 ? 4 : 0);
				paintSpike(g, x, y, lerp(24, 34, Math.sin(u * PI)) * (1 - u * 0.25), 10 + Math.sin(u * PI) * 5, -0.35);
			}
			const pts = BODY.map(b => [b[0], b[1]]);
			smoothPoly(g, pts, true);
			const gr = g.createLinearGradient(0, -76, 0, 52);
			gr.addColorStop(0, '#2a0b09'); gr.addColorStop(0.45, '#4e160c'); gr.addColorStop(1, '#85301a');
			g.fillStyle = gr; g.fill();
			g.save(); g.clip();
			g.lineWidth = 1.6;
			for(let r = 0; r < 11; r++){
				const y = -70 + r * 12.2;
				g.strokeStyle = 'rgba(0,0,0,0.3)'; g.beginPath();
				for(let x = -120 + (r % 2) * 9; x < 110; x += 18){ g.moveTo(x + 9 * Math.cos(0.15), y + 9 * Math.sin(0.15)); g.arc(x, y, 9, 0.15, PI - 0.15); }
				g.stroke();
				g.strokeStyle = 'rgba(255,150,80,0.08)'; g.beginPath();
				for(let x = -120 + (r % 2) * 9; x < 110; x += 18){ g.moveTo(x + 8, y - 2); g.arc(x, y - 2, 8, -0.2, -PI + 0.2, true); }
				g.stroke();
			}
			g.beginPath(); g.moveTo(98, 14); g.quadraticCurveTo(60, 50, 0, 52); g.quadraticCurveTo(-60, 52, -104, 18); g.lineTo(-100, 4); g.quadraticCurveTo(-50, 36, 0, 34); g.quadraticCurveTo(54, 34, 96, 4); g.closePath();
			const bg = g.createLinearGradient(0, 8, 0, 54); bg.addColorStop(0, '#a85428'); bg.addColorStop(1, '#6a2a10');
			g.fillStyle = bg; g.fill();
			g.strokeStyle = 'rgba(40,10,2,0.7)'; g.lineWidth = 1.5;
			for(let x = -96; x < 92; x += 13){ g.beginPath(); g.moveTo(x, 6); g.quadraticCurveTo(x + 5, 30, x - 2, 54); g.stroke(); }
			const sh = g.createLinearGradient(0, -76, 0, 52);
			sh.addColorStop(0, 'rgba(255,170,90,0.2)'); sh.addColorStop(0.18, 'rgba(255,170,90,0)'); sh.addColorStop(0.7, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(255,90,20,0.14)');
			g.fillStyle = sh; g.fillRect(-130, -80, 260, 140);
			for(const cr of CRACKS){ g.beginPath(); g.moveTo(cr[0][0], cr[0][1]); for(let j = 1; j < cr.length; j++) g.lineTo(cr[j][0], cr[j][1]); g.strokeStyle = 'rgba(120,30,8,0.9)'; g.lineWidth = 4; g.stroke(); }
			g.restore();
			smoothPoly(g, pts, true); g.lineWidth = 3.5; g.strokeStyle = INK; g.stroke();
		});
		/* ---- torso heat: lava veins and the belly furnace, drawn additively with the pose's glow ---- */
		P.torsoHot = mk(260, 190, 130, 118, (g) => {
			g.save(); smoothPoly(g, BODY.map(b => [b[0], b[1]]), true); g.clip();
			for(const cr of CRACKS){
				g.beginPath(); g.moveTo(cr[0][0], cr[0][1]); for(let j = 1; j < cr.length; j++) g.lineTo(cr[j][0], cr[j][1]);
				g.strokeStyle = 'rgba(255,90,20,0.75)'; g.lineWidth = 6; g.stroke();
				g.strokeStyle = 'rgba(255,220,130,0.9)'; g.lineWidth = 2; g.stroke();
			}
			const fg = g.createRadialGradient(10, 40, 4, 10, 40, 80); fg.addColorStop(0, 'rgba(255,170,60,0.6)'); fg.addColorStop(1, 'rgba(255,60,0,0)');
			g.fillStyle = fg; g.fillRect(-90, -10, 200, 100);
			g.restore();
		});
		/* ---- neck plate: one vertebra along +x (length 30), spike on top, throat plate under ---- */
		P.neck = mk(46, 70, 6, 40, (g) => {
			paintSpike(g, 14, -21, 20, 7, 0.35);
			paintLimb(g, 30, 44, 42, '#431309', '#6a2412');
			g.save(); g.beginPath(); g.ellipse(15, 12, 18, 9, 0, 0, PI); g.fillStyle = 'rgba(176,86,40,0.85)'; g.fill();
			g.strokeStyle = 'rgba(40,10,2,0.6)'; g.lineWidth = 1.4; for(let x = 2; x < 30; x += 7){ g.beginPath(); g.moveTo(x, 12); g.lineTo(x, 20); g.stroke(); } g.restore();
		});
		/* ---- head (skull, horns, brow, teeth) at the head joint; the jaw is its own bone ---- */
		P.head = mk(200, 90, 116, 56, (g) => {
			for(let h = 1; h >= 0; h--){
				const off = h * 12, sc = h ? 0.72 : 1;
				const hg = g.createLinearGradient(-20, -20, -96, -34 + off); hg.addColorStop(0, '#b89c70'); hg.addColorStop(1, '#efe0bc');
				g.fillStyle = hg; g.beginPath();
				g.moveTo(-18, -18 + off * 0.6); g.bezierCurveTo(-50, -44 + off, -84 * sc - 12, -38 + off * 1.2, -104 * sc - 8, -14 + off * 2.4); g.bezierCurveTo(-76 * sc - 12, -26 + off * 1.4, -48, -14 + off, -28, -2 + off * 0.5); g.closePath(); g.fill();
				g.strokeStyle = INK; g.lineWidth = 2.2; g.stroke();
			}
			g.fillStyle = '#f2e8cc';
			for(let i = 0; i < 7; i++){ const x = 12 + i * 9.5; g.beginPath(); g.moveTo(x, 10); g.lineTo(x + 3.6, 20 - (i % 2) * 3); g.lineTo(x + 7.5, 10); g.closePath(); g.fill(); }
			g.beginPath(); g.moveTo(66, 9); g.lineTo(69, 24); g.lineTo(73, 8); g.closePath(); g.fill();
			const sk = [[-32,-4],[-26,-22],[-4,-30],[24,-23],[50,-12],[76,-6],[80,6],[60,11],[30,12],[-6,12],[-26,10]];
			smoothPoly(g, sk, true);
			const sg = g.createLinearGradient(0, -30, 0, 14); sg.addColorStop(0, '#5f1e0f'); sg.addColorStop(0.5, '#43130a'); sg.addColorStop(1, '#2a0b09');
			g.fillStyle = sg; g.fill(); g.lineWidth = 3.2; g.strokeStyle = INK; g.stroke();
			g.strokeStyle = 'rgba(255,150,80,0.28)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-18, -22); g.quadraticCurveTo(10, -30, 32, -20); g.stroke();
			g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1.5; for(let i = 0; i < 5; i++){ g.beginPath(); g.arc(18 + i * 11, -4 + (i % 2) * 3, 5, 0.2, PI - 0.2); g.stroke(); }
			g.fillStyle = '#d9c392'; g.beginPath(); g.moveTo(-18, 2); g.lineTo(-44, 12); g.lineTo(-20, 14); g.closePath(); g.fill(); g.strokeStyle = INK; g.lineWidth = 2; g.stroke();
			g.beginPath(); g.moveTo(34, -18); g.lineTo(12, -38); g.lineTo(16, -20); g.closePath(); g.fill(); g.stroke();
			g.fillStyle = '#120403'; g.beginPath(); g.ellipse(68, -3, 3.4, 2, -0.3, 0, PI * 2); g.fill();
			g.fillStyle = '#1a0503'; g.beginPath(); g.ellipse(16, -11, 11, 8, -0.25, 0, PI * 2); g.fill();
			g.fillStyle = '#fff2a8'; g.beginPath(); g.ellipse(16, -11, 6.5, 4.2, -0.25, 0, PI * 2); g.fill();
			g.fillStyle = '#1a0503'; g.beginPath(); g.ellipse(17, -11, 1.8, 3.8, -0.25, 0, PI * 2); g.fill();
			g.strokeStyle = INK; g.lineWidth = 3.4; g.beginPath(); g.moveTo(1, -21); g.lineTo(29, -12); g.stroke();
		});
		/* ---- lower jaw, anchored on its hinge ---- */
		P.jaw = mk(104, 40, 22, 14, (g) => {
			g.translate(12, -10);      // drawn in head space, the sprite's origin is the hinge (-12, 10)
			const jawPts = [[-18,10],[10,24],[46,26],[72,16],[78,8],[54,12],[14,15]];
			g.fillStyle = '#f2e8cc';
			for(let i = 0; i < 6; i++){ const x = 18 + i * 10; g.beginPath(); g.moveTo(x, 15); g.lineTo(x + 2.5, 4); g.lineTo(x + 5, 15); g.closePath(); g.fill(); }
			smoothPoly(g, jawPts, true);
			const jg = g.createLinearGradient(0, 8, 0, 30); jg.addColorStop(0, '#6a2312'); jg.addColorStop(1, '#3a1209');
			g.fillStyle = jg; g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke();
		});
		P.mouth = radial(52, [[0, 'rgba(255,230,140,0.95)'], [0.35, 'rgba(255,140,40,0.6)'], [1, 'rgba(255,60,0,0)']]);
		P.eyeGlow = radial(22, [[0, 'rgba(255,240,150,0.9)'], [0.4, 'rgba(255,140,30,0.45)'], [1, 'rgba(255,60,0,0)']]);
		P.ember = radial(34, [[0, 'rgba(255,200,90,0.75)'], [1, 'rgba(255,70,0,0)']]);
		P.heat = radial(230, [[0, 'rgba(255,90,20,0.22)'], [1, 'rgba(255,60,0,0)']]);
		/* ---- tail vertebra along +x (length 31 → laid every 25), dorsal spike on +y (the tail points backwards, so it ends up on top) ---- */
		P.tail = mk(40, 70, 4, 36, (g) => {
			paintSpike(g, 14, 17, 24, 7, PI - 0.4);
			paintLimb(g, 31, 38, 34, '#4a160c', '#6a2412');
			g.strokeStyle = 'rgba(176,86,40,0.7)'; g.lineWidth = 4; g.beginPath(); g.moveTo(0, -10); g.lineTo(31, -9); g.stroke();
		});
		P.tailTip = mk(64, 40, 6, 20, (g) => {
			g.fillStyle = '#e8d8b4'; g.beginPath(); g.moveTo(0, -9); g.quadraticCurveTo(22, -13, 52, 0); g.quadraticCurveTo(22, 13, 0, 9); g.closePath(); g.fill();
			g.strokeStyle = INK; g.lineWidth = 2; g.stroke();
			g.strokeStyle = 'rgba(120,90,60,0.5)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(4, 0); g.lineTo(46, 0); g.stroke();
		});
		/* ---- legs ---- */
		P.thighF = mk(80, 44, 20, 22, (g) => paintLimb(g, 56, 34, 22, '#4a160c', '#7a2a14'));
		P.shinF = mk(82, 30, 12, 15, (g) => paintLimb(g, 60, 22, 13, '#36100a', '#5e1e10'));
		P.thighB = mk(94, 50, 22, 25, (g) => paintLimb(g, 68, 42, 24, '#4a160c', '#7a2a14'));
		P.shinB = mk(84, 30, 12, 15, (g) => paintLimb(g, 64, 24, 13, '#36100a', '#5e1e10'));
		P.knee = mk(40, 40, 20, 20, (g) => {
			g.fillStyle = '#54180c'; g.beginPath(); g.arc(0, 0, 13, 0, PI * 2); g.fill(); g.strokeStyle = INK; g.lineWidth = 2.6; g.stroke();
			paintSpike(g, 4, -8, 14, 5, 0.9);
		});
		P.foot = mk(64, 30, 24, 16, (g) => {
			g.fillStyle = '#e4d4ad';
			for(let c = 0; c < 3; c++){ const cx = 14 + c * 6, cy = -4 + c * 2; g.beginPath(); g.moveTo(cx - 3, cy - 3); g.lineTo(cx + 12, cy + 3); g.lineTo(cx - 3, cy + 4); g.closePath(); g.fill(); g.strokeStyle = 'rgba(16,3,2,0.6)'; g.lineWidth = 1; g.stroke(); }
			const fg = g.createLinearGradient(0, -10, 0, 8); fg.addColorStop(0, '#5a1c0e'); fg.addColorStop(1, '#22080a');
			g.fillStyle = fg; g.beginPath(); g.ellipse(8, -2, 18, 8.5, 0.08, 0, PI * 2); g.fill(); g.strokeStyle = INK; g.lineWidth = 2.6; g.stroke();
			g.fillStyle = '#e4d4ad'; g.beginPath(); g.moveTo(-8, -2); g.lineTo(-18, 2); g.lineTo(-8, 4); g.closePath(); g.fill();
		});
		/* ---- wing bones (unit length along +x, stretched to fit) and the membrane texture ---- */
		P.wingArm = mk(110, 30, 10, 15, (g) => paintLimb(g, 100, 17, 9, '#3d130b', '#7a3118'));
		P.finger = mk(110, 12, 4, 6, (g) => {
			g.fillStyle = '#3d130b'; g.beginPath(); g.moveTo(0, -3.4); g.lineTo(100, -1.2); g.lineTo(100, 1.2); g.lineTo(0, 3.4); g.closePath(); g.fill();
			g.strokeStyle = INK; g.lineWidth = 1.4; g.stroke();
		});
		P.claw = mk(30, 14, 4, 7, (g) => { g.fillStyle = '#e4d4ad'; g.beginPath(); g.moveTo(0, -3.2); g.lineTo(18, 0); g.lineTo(0, 3.2); g.closePath(); g.fill(); g.strokeStyle = 'rgba(16,3,2,0.7)'; g.lineWidth = 1; g.stroke(); });
		P.wrist = mk(60, 40, 14, 24, (g) => {
			g.fillStyle = '#e4d4ad'; g.beginPath(); g.moveTo(0, -4); g.lineTo(22, -18); g.lineTo(4, 4); g.closePath(); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.6; g.stroke();
			g.fillStyle = '#4a170c'; g.beginPath(); g.arc(0, 0, 8.5, 0, PI * 2); g.fill(); g.strokeStyle = INK; g.lineWidth = 2; g.stroke();
		});
		const membrane = (dark) => {
			const el = document.createElement('canvas'); el.width = el.height = 256;
			const g = el.getContext('2d');
			const gr = g.createLinearGradient(0, 0, 256, 256);
			gr.addColorStop(0, 'rgb(' + Math.round(150 * dark) + ',' + Math.round(40 * dark) + ',' + Math.round(14 * dark) + ')');
			gr.addColorStop(0.5, 'rgb(' + Math.round(190 * dark) + ',' + Math.round(70 * dark) + ',' + Math.round(22 * dark) + ')');
			gr.addColorStop(1, 'rgb(' + Math.round(150 * dark) + ',' + Math.round(40 * dark) + ',' + Math.round(14 * dark) + ')');
			g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
			let s = 17; const r = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
			for(let i = 0; i < 140; i++){ g.fillStyle = 'rgba(' + (r() < 0.5 ? '60,10,4' : '255,140,60') + ',' + (0.05 + r() * 0.07) + ')'; g.beginPath(); g.ellipse(r() * 256, r() * 256, 4 + r() * 18, 3 + r() * 10, r() * PI, 0, PI * 2); g.fill(); }
			g.strokeStyle = 'rgba(70,12,4,' + 0.35 + ')'; g.lineWidth = 1.2;
			for(let i = 0; i < 26; i++){ let x = r() * 256, y = r() * 256; g.beginPath(); g.moveTo(x, y); for(let k = 0; k < 5; k++){ x += (r() - 0.5) * 40; y += (r() - 0.5) * 40; g.lineTo(x, y); } g.stroke(); }
			return el;
		};
		ART.memb = membrane(1); ART.membFar = membrane(0.62);
		// back-side copies (shaded) for the far legs and wing
		for(const k of ['thighF', 'shinF', 'thighB', 'shinB', 'knee', 'foot', 'wingArm', 'finger', 'wrist', 'claw']) P[k + 'D'] = darken(P[k], 0.42);
		ART.ready = true;
		return true;
	}

	/* ---------------- the painted sheet (images/ignaroth/rig.png) ----------------
	   Each part is painted as a lit, scaled, outlined sprite in the style of the dragon's sprite sheet — crimson
	   scales, orange plated belly, ringed horns — by tools/ignaroth_art.py. Rig units; (x0,y0) is where the
	   sprite's top-left sits relative to the bone's joint. The baked parts above are the fallback until it loads. */
	const SHEET = {"torso":{"sx":0,"sy":0,"sw":750,"sh":510,"x0":-132,"y0":-104,"w":250,"h":170},"torsoHot":{"sx":752,"sy":0,"sw":750,"sh":510,"x0":-132,"y0":-104,"w":250,"h":170},"head":{"sx":0,"sy":512,"sw":612,"sh":324,"x0":-112,"y0":-78,"w":204,"h":108},"neck":{"sx":614,"sy":512,"sw":126,"sh":240,"x0":-6,"y0":-40,"w":42,"h":80},"tail":{"sx":742,"sy":512,"sw":126,"sh":204,"x0":-6,"y0":-34,"w":42,"h":68},"thighB":{"sx":870,"sy":512,"sw":330,"sh":192,"x0":-24.0,"y0":-32.0,"w":110.0,"h":64.0},"thighBD":{"sx":1202,"sy":512,"sw":330,"sh":192,"x0":-24.0,"y0":-32.0,"w":110.0,"h":64.0},"tailTip":{"sx":1534,"sy":512,"sw":198,"sh":156,"x0":-6,"y0":-26,"w":66,"h":52},"thighF":{"sx":1734,"sy":512,"sw":267,"sh":144,"x0":-18.0,"y0":-24.0,"w":89.0,"h":48.0},"thighFD":{"sx":0,"sy":838,"sw":267,"sh":144,"x0":-18.0,"y0":-24.0,"w":89.0,"h":48.0},"wrist":{"sx":269,"sy":838,"sw":120,"sh":120,"x0":-14,"y0":-26,"w":40,"h":40},"wristD":{"sx":391,"sy":838,"sw":120,"sh":120,"x0":-14,"y0":-26,"w":40,"h":40},"jaw":{"sx":513,"sy":838,"sw":330,"sh":108,"x0":-14,"y0":-6,"w":110,"h":36},"shinB":{"sx":845,"sy":838,"sw":259,"sh":106,"x0":-13.2,"y0":-17.6,"w":86.2,"h":35.2},"shinBD":{"sx":1106,"sy":838,"sw":259,"sh":106,"x0":-13.2,"y0":-17.6,"w":86.2,"h":35.2},"shinF":{"sx":1367,"sy":838,"sw":243,"sh":96,"x0":-12.0,"y0":-16.0,"w":81.0,"h":32.0},"shinFD":{"sx":1612,"sy":838,"sw":243,"sh":96,"x0":-12.0,"y0":-16.0,"w":81.0,"h":32.0},"foot":{"sx":0,"sy":984,"sw":204,"sh":90,"x0":-24,"y0":-16,"w":68,"h":30},"footD":{"sx":206,"sy":984,"sw":204,"sh":90,"x0":-24,"y0":-16,"w":68,"h":30},"knee":{"sx":412,"sy":984,"sw":72,"sh":72,"x0":-12,"y0":-12,"w":24,"h":24},"kneeD":{"sx":486,"sy":984,"sw":72,"sh":72,"x0":-12,"y0":-12,"w":24,"h":24},"wingArm":{"sx":560,"sy":984,"sw":366,"sh":72,"x0":-10,"y0":-12,"w":122,"h":24},"wingArmD":{"sx":928,"sy":984,"sw":366,"sh":72,"x0":-10,"y0":-12,"w":122,"h":24},"claw":{"sx":1296,"sy":984,"sw":69,"sh":36,"x0":-3,"y0":-6,"w":23,"h":12},"clawD":{"sx":1367,"sy":984,"sw":69,"sh":36,"x0":-3,"y0":-6,"w":23,"h":12},"finger":{"sx":1438,"sy":984,"sw":324,"sh":30,"x0":-4,"y0":-5,"w":108,"h":10},"fingerD":{"sx":0,"sy":1076,"sw":324,"sh":30,"x0":-4,"y0":-5,"w":108,"h":10},"membrane":{"sx":326,"sy":1108,"sw":256,"sh":256},"membraneD":{"sx":584,"sy":1108,"sw":256,"sh":256}};
	const SHEET_IMG = (typeof Image !== 'undefined') ? new Image() : null;
	if(SHEET_IMG) SHEET_IMG.src = 'images/ignaroth/rig.png?v=1';
	function sheetReady(){ return !!(SHEET_IMG && SHEET_IMG.complete && SHEET_IMG.naturalWidth > 64); }
	function applySheet(){
		if(ART.sheet || !sheetReady()) return false;
		const P = ART.parts;
		for(const k in SHEET){
			const m = SHEET[k];
			if(k === 'membrane' || k === 'membraneD'){
				const el = document.createElement('canvas'); el.width = m.sw; el.height = m.sh;
				el.getContext('2d').drawImage(SHEET_IMG, m.sx, m.sy, m.sw, m.sh, 0, 0, m.sw, m.sh);
				if(k === 'membrane') ART.memb = el; else ART.membFar = el;
				continue;
			}
			P[k] = { img: SHEET_IMG, sx: m.sx, sy: m.sy, sw: m.sw, sh: m.sh, x0: m.x0, y0: m.y0, w: m.w, h: m.h };
		}
		if(P.neck) P.neck.len = 30;
		if(P.tail) P.tail.len = 30;
		ART.sheet = true;
		return true;
	}

	/* place a sprite: (x,y) in the current frame, rotated, stretched along x by sx and across by sy */
	function put(g, sp, x, y, ang, sx, sy, alpha){
		if(!sp) return;
		const c = Math.cos(ang || 0), s = Math.sin(ang || 0);
		sx = sx == null ? 1 : sx; sy = sy == null ? 1 : sy;
		g.save();
		g.transform(c * sx, s * sx, -s * sy, c * sy, x, y);
		if(alpha != null) g.globalAlpha = alpha;
		if(sp.img) g.drawImage(sp.img, sp.sx, sp.sy, sp.sw, sp.sh, sp.x0, sp.y0, sp.w, sp.h);
		else g.drawImage(sp.cv, -sp.ax, -sp.ay, sp.cv.width / S, sp.cv.height / S);
		g.restore();
	}
	function bone(g, sp, a, b, len, thick){
		const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.001;
		put(g, sp, a.x, a.y, Math.atan2(dy, dx), d / len, thick || 1);
	}

	function drawWing(g, R, which, glow, t){
		const w = R.wings[which], far = which === 1, P = ART.parts, D = far ? 'D' : '';
		const { S: Sh, E, W, F, A } = w;
		// membrane: one textured fill (the texture is baked once)
		g.save();
		g.beginPath();
		g.moveTo(Sh.x, Sh.y); g.lineTo(E.x, E.y); g.lineTo(W.x, W.y); g.lineTo(F[0].x, F[0].y);
		for(let i = 0; i < 3; i++){
			const m = { x: (F[i].x + F[i + 1].x) / 2, y: (F[i].y + F[i + 1].y) / 2 };
			g.quadraticCurveTo(lerp(m.x, W.x, 0.34), lerp(m.y, W.y, 0.34), F[i + 1].x, F[i + 1].y);
		}
		const mm = { x: (F[3].x + A.x) / 2, y: (F[3].y + A.y) / 2 };
		g.quadraticCurveTo(lerp(mm.x, W.x, 0.3), lerp(mm.y, W.y, 0.3), A.x, A.y);
		g.closePath();
		if(!R._pat) R._pat = {};
		const key = (far ? 'f' : 'n') + (ART.sheet ? 's' : '');
		if(!R._pat[key]) R._pat[key] = g.createPattern(far ? ART.membFar : ART.memb, 'repeat');
		g.fillStyle = R._pat[key]; g.globalAlpha = 0.96; g.fill(); g.globalAlpha = 1;
		g.lineWidth = 3; g.strokeStyle = 'rgba(20,4,2,0.9)'; g.stroke();
		g.restore();
		// bones: arm, forearm, fingers, claws, wrist
		const k = 1 / 100;
		bone(g, P['finger' + D], W, F[3], 100); bone(g, P['finger' + D], W, F[2], 100); bone(g, P['finger' + D], W, F[1], 100); bone(g, P['finger' + D], W, F[0], 100);
		for(let i = 0; i < 4; i++){ const a = Math.atan2(F[i].y - W.y, F[i].x - W.x); put(g, P['claw' + D], F[i].x, F[i].y, a); }
		bone(g, P['wingArm' + D], Sh, E, 100); bone(g, P['wingArm' + D], E, W, 100, 0.8);
		put(g, P['wrist' + D], W.x, W.y, Math.atan2(W.y - E.y, W.x - E.x) - 0.5);
		if(glow > 0.2 && !far){ g.save(); g.globalCompositeOperation = 'lighter'; put(g, P.ember, W.x, W.y, 0, 1.6, 1.6, (glow - 0.2) * 0.5); g.restore(); }
	}

	function drawTail(g, R, glow){
		const pts = R.tailPts, n = pts.length, P = ART.parts;
		const tip = pts[n - 1], pv = pts[n - 3];
		put(g, P.tailTip, tip.x, tip.y, Math.atan2(tip.y - pv.y, tip.x - pv.x));
		for(let i = n - 2; i >= 0; i--){
			const a = pts[i], b = pts[i + 1];
			const wk = lerp(1, 0.16, Math.pow(i / (n - 1), 0.85));
			put(g, P.tail, a.x, a.y, Math.atan2(b.y - a.y, b.x - a.x), Math.hypot(b.x - a.x, b.y - a.y) / (P.tail.len || 25), wk);
		}
		if(glow > 0.15){ g.save(); g.globalCompositeOperation = 'lighter'; put(g, P.ember, tip.x, tip.y, 0, 0.9, 0.9, glow * 0.6); g.restore(); }
	}

	function neckPoints(R){
		const p = R.p;
		const N0 = { x: NECK_BASE[0], y: NECK_BASE[1] }, HJ = { x: p.hx, y: p.hy };
		const a0 = -0.9 + p.pitch * 0.2;
		const P1 = { x: N0.x + Math.cos(a0) * 48, y: N0.y + Math.sin(a0) * 48 };
		const P2 = { x: HJ.x - Math.cos(p.hang) * 50, y: HJ.y - Math.sin(p.hang) * 50 };
		const pts = [];
		for(let i = 0; i <= 6; i++){
			const u = i / 6, v = 1 - u;
			pts.push({ x: v * v * v * N0.x + 3 * v * v * u * P1.x + 3 * v * u * u * P2.x + u * u * u * HJ.x, y: v * v * v * N0.y + 3 * v * v * u * P1.y + 3 * v * u * u * P2.y + u * u * u * HJ.y });
		}
		return pts;
	}
	function drawNeckAndHead(g, R, glow){
		const p = R.p, P = ART.parts;
		const pts = neckPoints(R);
		for(let i = 0; i < pts.length - 1; i++){
			const a = pts[i], b = pts[i + 1];
			put(g, P.neck, a.x, a.y, Math.atan2(b.y - a.y, b.x - a.x), Math.hypot(b.x - a.x, b.y - a.y) / (P.neck.len || 24), lerp(1, 0.62, i / (pts.length - 1)));
		}
		if(p.glow > 0.5){
			g.save(); g.globalCompositeOperation = 'lighter';
			for(let i = 1; i < pts.length - 1; i += 2) put(g, P.ember, pts[i].x, pts[i].y, 0, 0.7, 0.7, clamp((p.glow - 0.5) * 0.9, 0, 0.5) * (0.5 + 0.5 * Math.sin(R.t * 0.2 - i)));
			g.restore();
		}
		// head: jaw (rotating on its hinge) behind the skull, the mouth's fire between them
		const HJ = { x: p.hx, y: p.hy };
		g.save();
		g.translate(HJ.x, HJ.y); g.rotate(p.hang);
		const jaw = clamp(p.jaw, 0, 1) * 0.78;
		if(jaw > 0.04){
			g.save(); g.globalCompositeOperation = 'lighter';
			put(g, P.mouth, 36, 16, 0, 1, 0.7, (0.4 + 0.6 * clamp(p.glow, 0, 1)) * Math.min(1, jaw * 2.2));
			g.restore();
		}
		put(g, P.jaw, -12, 10, jaw);
		put(g, P.head, 0, 0, 0);
		g.save(); g.globalCompositeOperation = 'lighter';
		put(g, P.eyeGlow, 16, -11, 0, 1, 1, 0.45 + 0.5 * clamp(p.glow, 0, 1));
		put(g, P.ember, 68, -3, 0, 0.35, 0.35, 0.4 + 0.4 * p.glow);
		g.restore();
		const eo = clamp(p.eye, 0.15, 1);
		if(eo < 0.95){ g.fillStyle = '#2a0b09'; g.beginPath(); g.ellipse(16, -11 - (1 - eo) * 2, 11.5, 8 * (1 - eo) + 0.5, -0.25, 0, PI * 2); g.fill(); }
		g.restore();
	}

	function drawLeg(g, R, i, near){
		const L = R.legs[i]; if(!L) return;
		const P = ART.parts, D = near ? '' : 'D';
		const front = L.front, l1 = front ? 56 : 68, l2 = front ? 60 : 64;
		const k = ik(L.hx, L.hy, L.fx, L.fy, l1, l2, front ? 1 : -1);
		const hip = { x: L.hx, y: L.hy }, knee = { x: k.kx, y: k.ky }, foot = { x: k.fx, y: k.fy };
		bone(g, P[(front ? 'shinF' : 'shinB') + D], knee, foot, front ? 60 : 64);
		bone(g, P[(front ? 'thighF' : 'thighB') + D], hip, knee, front ? 56 : 68);
		put(g, P['knee' + D], knee.x, knee.y, front ? 0 : PI * 0.15);
		put(g, P['foot' + D], foot.x, foot.y, 0);
	}

	function draw(en){
		if(!en) return false;
		if(!ART.ready && !bake()) return false;
		if(!ART.sheet) applySheet();
		const R = en._rig || (en._rig = newRig());
		if(R.stepped) R.stepped = false; else step(en);
		const p = R.p, g = ctx, P = ART.parts;
		const camx = (typeof camera !== 'undefined') ? camera.x : 0, camy = (typeof camera !== 'undefined') ? camera.y : 0;
		const k = R.k, dir = R.dir, t = R.t;
		const glow = clamp(p.glow, 0, 1);
		const vw = (typeof canvas !== 'undefined' && canvas) ? canvas.width : 4000, vh = (typeof canvas !== 'undefined' && canvas) ? canvas.height : 4000;
		const sx0 = R.bx - camx, sy0 = R.by - camy, rad = 420 * k;
		if(sx0 + rad < 0 || sx0 - rad > vw || sy0 + rad < 0 || sy0 - rad > vh) return true;      // off screen: nothing to draw
		g.save();
		if(R.onGround){
			g.fillStyle = 'rgba(0,0,0,0.38)'; g.beginPath(); g.ellipse(en.x + en.w / 2 - camx, en.y + en.h - camy + 2, en.w * 0.46, en.h * 0.05, 0, 0, PI * 2); g.fill();
		}
		g.translate(sx0, sy0);
		g.scale(k * dir, k);
		g.save(); g.globalCompositeOperation = 'lighter'; put(g, P.heat, 0, -10, 0, 1, 1, 0.3 + glow * 0.7); g.restore();
		const pitched = (fn) => { g.save(); g.rotate(p.pitch); fn(); g.restore(); };
		pitched(() => drawWing(g, R, 1, glow, t));
		drawLeg(g, R, 1, false); drawLeg(g, R, 3, false);
		pitched(() => drawTail(g, R, glow));
		pitched(() => {
			const br = 1 + Math.sin(t * 0.07) * 0.012 * p.breathe;
			put(g, P.torso, 0, 0, 0, p.chest, br);
			g.save(); g.globalCompositeOperation = 'lighter';
			const hot = clamp((glow - 0.3) * 1.4, 0, 1);      // the cracks only open up as he heats (phase 2+, charging fire)
			if(hot > 0.02) put(g, P.torsoHot, 0, 0, 0, p.chest, br, hot * (0.65 + 0.35 * Math.sin(t * 0.09)));
			g.restore();
		});
		pitched(() => drawNeckAndHead(g, R, glow));
		drawLeg(g, R, 2, true); drawLeg(g, R, 0, true);
		pitched(() => drawWing(g, R, 0, glow, t));
		// a hit: a quick white-hot flash over the same silhouette (no canvas filter — those are slow)
		if(en.flash > 0){
			g.globalCompositeOperation = 'lighter';
			pitched(() => { put(g, P.torsoHot, 0, 0, 0, p.chest, 1, Math.min(1, en.flash * 0.15)); put(g, P.heat, 0, -10, 0, 0.6, 0.5, Math.min(0.6, en.flash * 0.08)); });
		}
		g.restore();
		return true;
	}

	function reset(en){ if(en) en._rig = null; }
	global.IgnarothRig = { step: function(en){ step(en); if(en._rig) en._rig.stepped = true; }, draw, reset, newRig, bake, ART };
})(typeof window !== 'undefined' ? window : globalThis);
