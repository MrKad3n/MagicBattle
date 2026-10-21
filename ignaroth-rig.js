/* =============================================================
   Ignaroth — procedural dragon rig.
   A real skeleton drawn on the canvas (no sprite sheets): body, a 9-point neck, a hinged jaw,
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
	const NECK_BASE = [88, -36];
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
		// wing-beat gust: a heavy flap kicks the body up a little
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

	/* ---------------- drawing ---------------- */
	function smoothPoly(g, pts, close){
		const n = pts.length;
		g.beginPath();
		const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
		if(close){
			const m0 = mid(pts[n - 1], pts[0]);
			g.moveTo(m0[0], m0[1]);
			for(let i = 0; i < n; i++){ const m = mid(pts[i], pts[(i + 1) % n]); g.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]); }
			g.closePath();
		} else {
			g.moveTo(pts[0][0], pts[0][1]);
			for(let i = 1; i < n - 1; i++){ const m = mid(pts[i], pts[i + 1]); g.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]); }
			g.lineTo(pts[n - 1][0], pts[n - 1][1]);
		}
	}
	function taper(g, pts, w0, w1, fill, stroke, lw, pow){
		// a tapered limb along a polyline
		const n = pts.length, L = [], Rr = [];
		for(let i = 0; i < n; i++){
			const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
			let dx = b.x - a.x, dy = b.y - a.y; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
			const w = lerp(w0, w1, Math.pow(i / (n - 1), pow || 1)) / 2;
			L.push([pts[i].x - dy * w, pts[i].y + dx * w]); Rr.push([pts[i].x + dy * w, pts[i].y - dx * w]);
		}
		g.beginPath(); g.moveTo(L[0][0], L[0][1]);
		for(let i = 1; i < n; i++) g.lineTo(L[i][0], L[i][1]);
		for(let i = n - 1; i >= 0; i--) g.lineTo(Rr[i][0], Rr[i][1]);
		g.closePath();
		g.fillStyle = fill; g.fill();
		if(stroke){ g.lineWidth = lw || 3; g.strokeStyle = stroke; g.lineJoin = 'round'; g.stroke(); }
		return { L, R: Rr };
	}
	function scaleCol(depth, glow){
		// depth 0 = lit top .. 1 = shaded
		return depth;
	}

	function drawWing(g, R, which, glow, t){
		const w = R.wings[which], far = which === 1;
		const dark = far ? 0.62 : 1;
		const { S, E, W, F, A } = w;
		// membrane
		g.save();
		g.beginPath();
		g.moveTo(S.x, S.y); g.lineTo(E.x, E.y); g.lineTo(W.x, W.y); g.lineTo(F[0].x, F[0].y);
		for(let i = 0; i < 3; i++){
			const m = { x: (F[i].x + F[i + 1].x) / 2, y: (F[i].y + F[i + 1].y) / 2 };
			const cx = lerp(m.x, W.x, 0.34), cy = lerp(m.y, W.y, 0.34);
			g.quadraticCurveTo(cx, cy, F[i + 1].x, F[i + 1].y);
		}
		const mm = { x: (F[3].x + A.x) / 2, y: (F[3].y + A.y) / 2 };
		g.quadraticCurveTo(lerp(mm.x, W.x, 0.3), lerp(mm.y, W.y, 0.3), A.x, A.y);
		g.closePath();
		const gr = g.createRadialGradient(W.x, W.y, 6, W.x, W.y, 190);
		gr.addColorStop(0, 'rgba(' + Math.round(120 * dark) + ',' + Math.round(26 * dark) + ',' + Math.round(12 * dark) + ',0.97)');
		gr.addColorStop(0.55, 'rgba(' + Math.round(170 * dark) + ',' + Math.round(54 * dark) + ',' + Math.round(18 * dark) + ',0.94)');
		gr.addColorStop(1, 'rgba(' + Math.round(222 * dark) + ',' + Math.round(110 * dark) + ',' + Math.round(34 * dark) + ',0.9)');
		g.fillStyle = gr; g.fill();
		g.lineWidth = 3; g.strokeStyle = 'rgba(20,4,2,0.9)'; g.lineJoin = 'round'; g.stroke();
		g.clip();
		// membrane veins and lava glow
		g.globalCompositeOperation = 'lighter';
		g.lineCap = 'round';
		for(let i = 0; i < 4; i++){
			g.strokeStyle = 'rgba(255,' + (110 + i * 20) + ',40,' + (0.18 + glow * 0.4) * dark + ')'; g.lineWidth = 2;
			g.beginPath(); g.moveTo(W.x, W.y);
			const tx = i < 3 ? (F[i].x + F[i + 1].x) / 2 : (F[3].x + A.x) / 2, ty = i < 3 ? (F[i].y + F[i + 1].y) / 2 : (F[3].y + A.y) / 2;
			g.quadraticCurveTo(lerp(W.x, tx, 0.5) + Math.sin(t * 0.05 + i) * 4, lerp(W.y, ty, 0.5), lerp(W.x, tx, 0.92), lerp(W.y, ty, 0.92)); g.stroke();
		}
		const eg = g.createRadialGradient(W.x, W.y, 4, W.x, W.y, 120);
		eg.addColorStop(0, 'rgba(255,150,50,' + 0.1 * glow * dark + ')'); eg.addColorStop(1, 'rgba(255,60,0,0)');
		g.fillStyle = eg; g.fillRect(W.x - 130, W.y - 130, 260, 260);
		g.restore();
		// bones
		g.save();
		g.lineCap = 'round'; g.lineJoin = 'round';
		const bone = far ? '#2c0c08' : '#3d130b', hi = far ? '#5a2012' : '#7a3118';
		taper(g, [S, E, W], 17, 8, bone, 'rgba(14,3,2,0.95)', 2.5, 0.8);
		g.strokeStyle = hi; g.lineWidth = 2; g.beginPath(); g.moveTo(S.x, S.y - 3); g.lineTo(E.x, E.y - 3); g.lineTo(W.x, W.y - 2); g.stroke();
		for(let i = 0; i < 4; i++){
			g.strokeStyle = 'rgba(14,3,2,0.95)'; g.lineWidth = 6 - i * 0.6; g.beginPath(); g.moveTo(W.x, W.y); g.lineTo(F[i].x, F[i].y); g.stroke();
			g.strokeStyle = bone; g.lineWidth = 3.6 - i * 0.5; g.beginPath(); g.moveTo(W.x, W.y); g.lineTo(F[i].x, F[i].y); g.stroke();
			// finger claw
			const dx = F[i].x - W.x, dy = F[i].y - W.y, d = Math.hypot(dx, dy) || 1;
			g.fillStyle = '#e4d4ad'; g.beginPath(); g.moveTo(F[i].x - dy / d * 3, F[i].y + dx / d * 3); g.lineTo(F[i].x + dx / d * 16, F[i].y + dy / d * 16); g.lineTo(F[i].x + dy / d * 3, F[i].y - dx / d * 3); g.closePath(); g.fill();
		}
		// wrist claw + knuckle
		g.fillStyle = bone; g.beginPath(); g.arc(W.x, W.y, 8, 0, PI * 2); g.fill(); g.strokeStyle = 'rgba(14,3,2,0.95)'; g.lineWidth = 2; g.stroke();
		const wx = Math.cos(Math.atan2(W.y - E.y, W.x - E.x) - 0.5), wy = Math.sin(Math.atan2(W.y - E.y, W.x - E.x) - 0.5);
		g.fillStyle = '#e4d4ad'; g.beginPath(); g.moveTo(W.x, W.y - 4); g.lineTo(W.x + wx * 26, W.y + wy * 26 - 4); g.lineTo(W.x + 4, W.y + 4); g.closePath(); g.fill();
		g.restore();
	}

	function drawBody(g, R, glow, t){
		const p = R.p;
		// silhouette
		const pts = BODY.map(b => [b[0] * (b[0] > 0 ? p.chest : 1), b[1] * (b[0] > 0 ? p.chest : 1) + (b[1] > 20 ? Math.sin(t * 0.07) * p.breathe * 1.5 : 0)]);
		smoothPoly(g, pts, true);
		const gr = g.createLinearGradient(0, -76, 0, 52);
		gr.addColorStop(0, '#2a0b09'); gr.addColorStop(0.45, '#4e160c'); gr.addColorStop(1, '#85301a');
		g.fillStyle = gr; g.fill();
		g.save(); g.clip();
		// scales
		g.lineWidth = 1.6;
		for(let r = 0; r < 11; r++){
			const y = -70 + r * 12.2;
			g.strokeStyle = 'rgba(0,0,0,0.3)'; g.beginPath();
			for(let x = -120 + (r % 2) * 9; x < 110; x += 18){ g.moveTo(x, y); g.arc(x, y, 9, 0.15, PI - 0.15); }
			g.stroke();
			g.strokeStyle = 'rgba(255,150,80,0.07)'; g.beginPath();
			for(let x = -120 + (r % 2) * 9; x < 110; x += 18){ g.moveTo(x + 8, y - 2); g.arc(x, y - 2, 8, -0.2, -PI + 0.2, true); }
			g.stroke();
		}
		// belly plates
		g.beginPath(); g.moveTo(98, 14); g.quadraticCurveTo(60, 50, 0, 52); g.quadraticCurveTo(-60, 52, -104, 18); g.lineTo(-100, 4); g.quadraticCurveTo(-50, 36, 0, 34); g.quadraticCurveTo(54, 34, 96, 4); g.closePath();
		const bg = g.createLinearGradient(0, 8, 0, 54);
		bg.addColorStop(0, '#a85428'); bg.addColorStop(1, '#6a2a10');
		g.fillStyle = bg; g.fill();
		g.strokeStyle = 'rgba(40,10,2,0.7)'; g.lineWidth = 1.5;
		for(let x = -96; x < 92; x += 13){ g.beginPath(); g.moveTo(x, 6); g.quadraticCurveTo(x + 5, 30, x - 2, 54); g.stroke(); }
		// shade and rim light
		const sh = g.createLinearGradient(0, -76, 0, 52);
		sh.addColorStop(0, 'rgba(255,170,90,0.2)'); sh.addColorStop(0.18, 'rgba(255,170,90,0)'); sh.addColorStop(0.7, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(255,90,20,' + (0.12 + glow * 0.22) + ')');
		g.fillStyle = sh; g.fillRect(-130, -80, 260, 140);
		// lava veins
		g.globalCompositeOperation = 'lighter'; g.lineCap = 'round'; g.lineJoin = 'round';
		const pulse = 0.65 + 0.35 * Math.sin(t * 0.09);
		for(let i = 0; i < CRACKS.length; i++){
			const cr = CRACKS[i];
			g.beginPath(); g.moveTo(cr[0][0], cr[0][1]); for(let j = 1; j < cr.length; j++) g.lineTo(cr[j][0], cr[j][1]);
			g.strokeStyle = 'rgba(255,90,20,' + (0.25 + glow * 0.5) * pulse + ')'; g.lineWidth = 6; g.stroke();
			g.strokeStyle = 'rgba(255,220,130,' + (0.2 + glow * 0.6) * pulse + ')'; g.lineWidth = 2; g.stroke();
		}
		// belly furnace
		const fg = g.createRadialGradient(10, 40, 4, 10, 40, 80);
		fg.addColorStop(0, 'rgba(255,170,60,' + (0.1 + glow * 0.5) + ')'); fg.addColorStop(1, 'rgba(255,60,0,0)');
		g.fillStyle = fg; g.fillRect(-90, -10, 200, 100);
		g.restore();
		smoothPoly(g, pts, true);
		g.lineWidth = 3.5; g.strokeStyle = 'rgba(16,3,2,0.95)'; g.lineJoin = 'round'; g.stroke();
		// dorsal spikes
		for(let i = 0; i < 9; i++){
			const u = i / 8, x = lerp(66, -100, u), y = lerp(-66, -34, u * u) - Math.sin(u * PI) * 8 + (i === 0 ? 4 : 0);
			const h = lerp(24, 34, Math.sin(u * PI)) * (1 - u * 0.25), w2 = 10 + Math.sin(u * PI) * 5;
			const sg = g.createLinearGradient(x, y, x - h * 0.4, y - h);
			sg.addColorStop(0, '#7a2f16'); sg.addColorStop(0.6, '#d9c392'); sg.addColorStop(1, '#f4e7c4');
			g.fillStyle = sg; g.beginPath(); g.moveTo(x - w2, y + 4); g.quadraticCurveTo(x - w2 * 0.2, y - h * 0.6, x - h * 0.45, y - h); g.quadraticCurveTo(x + w2 * 0.2, y - h * 0.4, x + w2, y + 4); g.closePath(); g.fill();
			g.strokeStyle = 'rgba(16,3,2,0.9)'; g.lineWidth = 2; g.stroke();
			g.save(); g.globalCompositeOperation = 'lighter';
			const bgl = g.createRadialGradient(x, y + 2, 1, x, y + 2, 16); bgl.addColorStop(0, 'rgba(255,110,30,' + (0.2 + glow * 0.5) + ')'); bgl.addColorStop(1, 'rgba(255,60,0,0)');
			g.fillStyle = bgl; g.fillRect(x - 18, y - 14, 36, 36); g.restore();
		}
	}

	function drawTail(g, R, glow, t){
		const pts = R.tailPts;
		const W0 = 38, W1 = 5;
		const L = [], Rr = [];
		const n = pts.length;
		for(let i = 0; i < n; i++){
			const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
			let dx = b.x - a.x, dy = b.y - a.y; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
			const w = lerp(W0, W1, Math.pow(i / (n - 1), 0.85)) / 2;
			L.push([pts[i].x - dy * w, pts[i].y + dx * w]); Rr.push([pts[i].x + dy * w, pts[i].y - dx * w]);
		}
		// spikes first (behind)
		for(let i = 1; i < n - 1; i++){
			const side = Rr[i]; // top side relative to travel direction (left-pointing tail → R is the upper side)
			const a = pts[i - 1], b = pts[i + 1]; let dx = b.x - a.x, dy = b.y - a.y; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
			const h = lerp(26, 6, i / n), nx = dy, ny = -dx;
			g.fillStyle = '#d9c392'; g.beginPath(); g.moveTo(side[0] - dx * 7, side[1] - dy * 7); g.lineTo(side[0] + nx * h + dx * 3, side[1] + ny * h + dy * 3); g.lineTo(side[0] + dx * 7, side[1] + dy * 7); g.closePath(); g.fill();
			g.strokeStyle = 'rgba(16,3,2,0.9)'; g.lineWidth = 1.6; g.stroke();
		}
		g.beginPath(); g.moveTo(L[0][0], L[0][1]);
		for(let i = 1; i < n; i++) g.lineTo(L[i][0], L[i][1]);
		for(let i = n - 1; i >= 0; i--) g.lineTo(Rr[i][0], Rr[i][1]);
		g.closePath();
		const gr = g.createLinearGradient(pts[0].x, pts[0].y, pts[n - 1].x, pts[n - 1].y);
		gr.addColorStop(0, '#4a160c'); gr.addColorStop(1, '#2a0b09');
		g.fillStyle = gr; g.fill(); g.lineWidth = 3.4; g.strokeStyle = 'rgba(16,3,2,0.95)'; g.lineJoin = 'round'; g.stroke();
		// belly stripe
		g.beginPath(); for(let i = 0; i < n; i++){ const q = L[i]; const c = pts[i]; const x = lerp(c.x, q[0], 0.55), y = lerp(c.y, q[1], 0.55); if(i) g.lineTo(x, y); else g.moveTo(x, y); }
		g.strokeStyle = 'rgba(176,86,40,0.7)'; g.lineWidth = 4; g.lineCap = 'round'; g.stroke();
		// segment bands + embers inside
		g.save(); g.globalCompositeOperation = 'lighter';
		for(let i = 1; i < n - 2; i += 2){
			const c = pts[i];
			g.fillStyle = 'rgba(255,110,30,' + (0.08 + glow * 0.22) + ')'; g.beginPath(); g.arc(c.x, c.y, lerp(12, 3, i / n), 0, PI * 2); g.fill();
		}
		g.restore();
		// blade tip
		const e = pts[n - 1], pv = pts[n - 3]; let dx = e.x - pv.x, dy = e.y - pv.y; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
		g.fillStyle = '#e8d8b4'; g.beginPath(); g.moveTo(e.x - dy * 9, e.y + dx * 9); g.quadraticCurveTo(e.x + dx * 22 - dy * 13, e.y + dy * 22 + dx * 13, e.x + dx * 48, e.y + dy * 48); g.quadraticCurveTo(e.x + dx * 22 + dy * 13, e.y + dy * 22 - dx * 13, e.x + dy * 9, e.y - dx * 9); g.closePath(); g.fill();
		g.strokeStyle = 'rgba(16,3,2,0.9)'; g.lineWidth = 2; g.stroke();
		g.save(); g.globalCompositeOperation = 'lighter';
		const tg = g.createRadialGradient(e.x + dx * 14, e.y + dy * 14, 2, e.x + dx * 14, e.y + dy * 14, 34);
		tg.addColorStop(0, 'rgba(255,200,90,' + (0.2 + glow * 0.5) + ')'); tg.addColorStop(1, 'rgba(255,70,0,0)');
		g.fillStyle = tg; g.fillRect(e.x - 30, e.y - 30, 90, 90); g.restore();
	}

	function drawNeckAndHead(g, R, glow, t, flash){
		const p = R.p;
		const N0 = { x: NECK_BASE[0], y: NECK_BASE[1] }, HJ = { x: p.hx, y: p.hy };
		const a0 = -0.9 + p.pitch * 0.2;
		const P1 = { x: N0.x + Math.cos(a0) * 48, y: N0.y + Math.sin(a0) * 48 };
		const P2 = { x: HJ.x - Math.cos(p.hang) * 50, y: HJ.y - Math.sin(p.hang) * 50 };
		const pts = [];
		for(let i = 0; i <= 9; i++){
			const u = i / 9, v = 1 - u;
			pts.push({ x: v * v * v * N0.x + 3 * v * v * u * P1.x + 3 * v * u * u * P2.x + u * u * u * HJ.x, y: v * v * v * N0.y + 3 * v * v * u * P1.y + 3 * v * u * u * P2.y + u * u * u * HJ.y });
		}
		// top spikes
		const sp = [];
		for(let i = 1; i < 9; i++){
			const a = pts[i - 1], b = pts[i + 1]; let dx = b.x - a.x, dy = b.y - a.y; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
			const w = lerp(42, 24, i / 9) / 2;
			const x = pts[i].x + dy * w, y = pts[i].y - dx * w, h = lerp(22, 14, i / 9);
			g.fillStyle = '#d9c392'; g.beginPath(); g.moveTo(x - dx * 7, y - dy * 7); g.lineTo(x + dy * h - dx * 6, y - dx * h - dy * 6); g.lineTo(x + dx * 6, y + dy * 6); g.closePath(); g.fill();
			g.strokeStyle = 'rgba(16,3,2,0.9)'; g.lineWidth = 1.8; g.stroke();
		}
		const limb = taper(g, pts, 44, 25, '#431309', 'rgba(16,3,2,0.95)', 3.4, 0.9);
		// throat plates (underside)
		g.beginPath();
		const under = [];
		for(let i = 0; i <= 9; i++){ const a = pts[Math.max(0, i - 1)], b = pts[Math.min(9, i + 1)]; let dx = b.x - a.x, dy = b.y - a.y; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d; const w = lerp(44, 25, i / 9) / 2 * 0.55; under.push([pts[i].x - dy * w, pts[i].y + dx * w]); }
		g.moveTo(pts[0].x, pts[0].y);
		for(let i = 0; i <= 9; i++) g.lineTo(under[i][0], under[i][1]);
		for(let i = 9; i >= 0; i--) g.lineTo(pts[i].x, pts[i].y);
		g.closePath(); g.fillStyle = 'rgba(176,86,40,0.75)'; g.fill();
		g.strokeStyle = 'rgba(40,10,2,0.6)'; g.lineWidth = 1.4;
		for(let i = 1; i < 9; i++){ g.beginPath(); g.moveTo(pts[i].x, pts[i].y); g.lineTo(under[i][0], under[i][1]); g.stroke(); }
		// neck glow when charging
		g.save(); g.globalCompositeOperation = 'lighter';
		for(let i = 1; i < 9; i += 2){ const gl = g.createRadialGradient(pts[i].x, pts[i].y, 2, pts[i].x, pts[i].y, 22); gl.addColorStop(0, 'rgba(255,140,40,' + clamp((p.glow - 0.5) * 0.9, 0, 0.5) * (0.5 + 0.5 * Math.sin(t * 0.2 - i)) + ')'); gl.addColorStop(1, 'rgba(255,60,0,0)'); g.fillStyle = gl; g.fillRect(pts[i].x - 24, pts[i].y - 24, 48, 48); }
		g.restore();

		// ---- head ----
		g.save();
		g.translate(HJ.x, HJ.y); g.rotate(p.hang);
		const jaw = clamp(p.jaw, 0, 1) * 0.78;
		const HINGE = [-12, 10];
		const rot = (x, y) => { const c = Math.cos(jaw), s = Math.sin(jaw); const dx = x - HINGE[0], dy = y - HINGE[1]; return [HINGE[0] + dx * c - dy * s, HINGE[1] + dx * s + dy * c]; };
		// horns (behind)
		for(let h = 0; h < 2; h++){
			const off = h * 12, sc = h ? 0.72 : 1;
			const hg = g.createLinearGradient(-20, -20, -96, -34 + off);
			hg.addColorStop(0, '#b89c70'); hg.addColorStop(1, '#efe0bc');
			g.fillStyle = hg; g.beginPath();
			g.moveTo(-18, -18 + off * 0.6); g.bezierCurveTo(-50, -44 + off, -84 * sc - 12, -38 + off * 1.2, -104 * sc - 8, -14 + off * 2.4); g.bezierCurveTo(-76 * sc - 12, -26 + off * 1.4, -48, -14 + off, -28, -2 + off * 0.5); g.closePath(); g.fill();
			g.strokeStyle = 'rgba(16,3,2,0.9)'; g.lineWidth = 2.2; g.stroke();
		}
		// mouth interior
		const jt = rot(76, 12), jt2 = rot(20, 14);
		if(jaw > 0.04){
			const mg = g.createLinearGradient(0, 8, 40, 40);
			mg.addColorStop(0, '#ffb03a'); mg.addColorStop(1, '#6a0e00');
			g.fillStyle = mg; g.beginPath(); g.moveTo(-8, 10); g.lineTo(76, 8); g.lineTo(jt[0], jt[1]); g.lineTo(jt2[0], jt2[1]); g.closePath(); g.fill();
			g.save(); g.globalCompositeOperation = 'lighter';
			const gg = g.createRadialGradient(40, 18, 2, 40, 18, 52); gg.addColorStop(0, 'rgba(255,220,120,' + (0.35 + 0.6 * clamp(p.glow, 0, 1)) * Math.min(1, jaw * 2) + ')'); gg.addColorStop(1, 'rgba(255,60,0,0)');
			g.fillStyle = gg; g.fillRect(-20, -20, 120, 90); g.restore();
		}
		// lower jaw
		const jawPts = [[-18,10],[10,24],[46,26],[72,16],[78,8],[54,12],[14,15]].map(q => rot(q[0], q[1]));
		smoothPoly(g, jawPts, true);
		const jg = g.createLinearGradient(0, 8, 0, 30); jg.addColorStop(0, '#6a2312'); jg.addColorStop(1, '#3a1209');
		g.fillStyle = jg; g.fill(); g.lineWidth = 3; g.strokeStyle = 'rgba(16,3,2,0.95)'; g.lineJoin = 'round'; g.stroke();
		// lower teeth
		g.fillStyle = '#f2e8cc';
		for(let i = 0; i < 6; i++){ const x = 18 + i * 10, q = rot(x, 14), q2 = rot(x + 5, 14), q3 = rot(x + 2.5, 4); g.beginPath(); g.moveTo(q[0], q[1]); g.lineTo(q3[0], q3[1]); g.lineTo(q2[0], q2[1]); g.closePath(); g.fill(); }
		// skull
		const sk = [[-32,-4],[-26,-22],[-4,-30],[24,-23],[50,-12],[76,-6],[80,6],[60,11],[30,12],[-6,12],[-26,10]];
		smoothPoly(g, sk, true);
		const sg = g.createLinearGradient(0, -30, 0, 14);
		sg.addColorStop(0, '#5a1c0e'); sg.addColorStop(0.5, '#43130a'); sg.addColorStop(1, '#2a0b09');
		g.fillStyle = sg; g.fill(); g.lineWidth = 3.2; g.strokeStyle = 'rgba(16,3,2,0.95)'; g.stroke();
		// snout scales, brow ridge, cheek spike
		g.strokeStyle = 'rgba(255,150,80,0.25)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-18, -22); g.quadraticCurveTo(10, -30, 32, -20); g.stroke();
		g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1.5; for(let i = 0; i < 5; i++){ g.beginPath(); g.arc(18 + i * 11, -4 + (i % 2) * 3, 5, 0.2, PI - 0.2); g.stroke(); }
		g.fillStyle = '#d9c392'; g.beginPath(); g.moveTo(-18, 2); g.lineTo(-44, 12); g.lineTo(-20, 14); g.closePath(); g.fill(); g.strokeStyle = 'rgba(16,3,2,0.9)'; g.lineWidth = 2; g.stroke();
		g.beginPath(); g.moveTo(34, -18); g.lineTo(12, -38); g.lineTo(16, -20); g.closePath(); g.fill(); g.stroke();
		// upper teeth
		g.fillStyle = '#f2e8cc';
		for(let i = 0; i < 7; i++){ const x = 12 + i * 9.5; g.beginPath(); g.moveTo(x, 11); g.lineTo(x + 3.6, 20 - (i % 2) * 3); g.lineTo(x + 7.5, 11); g.closePath(); g.fill(); }
		g.beginPath(); g.moveTo(66, 10); g.lineTo(69, 24); g.lineTo(73, 9); g.closePath(); g.fill();
		// nostril
		g.save(); g.globalCompositeOperation = 'lighter';
		const ng = g.createRadialGradient(68, -3, 1, 68, -3, 12); ng.addColorStop(0, 'rgba(255,160,50,' + (0.4 + 0.4 * p.glow) + ')'); ng.addColorStop(1, 'rgba(255,60,0,0)');
		g.fillStyle = ng; g.fillRect(54, -18, 28, 28); g.restore();
		g.fillStyle = '#120403'; g.beginPath(); g.ellipse(68, -3, 3.4, 2, -0.3, 0, PI * 2); g.fill();
		// eye
		const eo = clamp(p.eye, 0.15, 1);
		g.save();
		g.fillStyle = '#1a0503'; g.beginPath(); g.ellipse(16, -11, 11, 7 * eo + 1.5, -0.25, 0, PI * 2); g.fill();
		g.globalCompositeOperation = 'lighter';
		const eg = g.createRadialGradient(16, -11, 1, 16, -11, 22); eg.addColorStop(0, 'rgba(255,240,150,' + (0.55 + 0.45 * p.glow) + ')'); eg.addColorStop(0.4, 'rgba(255,140,30,0.45)'); eg.addColorStop(1, 'rgba(255,60,0,0)');
		g.fillStyle = eg; g.fillRect(-8, -34, 48, 48);
		g.restore();
		g.fillStyle = '#fff2a8'; g.beginPath(); g.ellipse(16, -11, 6.5, 3.6 * eo + 0.6, -0.25, 0, PI * 2); g.fill();
		g.fillStyle = '#1a0503'; g.beginPath(); g.ellipse(17, -11, 1.8, 3.4 * eo, -0.25, 0, PI * 2); g.fill();
		g.strokeStyle = 'rgba(16,3,2,0.95)'; g.lineWidth = 3.4; g.beginPath(); g.moveTo(1, -21 + (1 - eo) * 4); g.lineTo(29, -12 + (1 - eo) * 3); g.stroke();
		g.restore();
	}

	function drawLeg(g, R, i, near, glow){
		const L = R.legs[i]; if(!L) return;
		const front = L.front, l1 = front ? 56 : 68, l2 = front ? 60 : 64;
		const k = ik(L.hx, L.hy, L.fx, L.fy, l1, l2, front ? 1 : -1);
		const dark = near ? 1 : 0.6;
		const col = (a) => 'rgb(' + Math.round(a[0] * dark) + ',' + Math.round(a[1] * dark) + ',' + Math.round(a[2] * dark) + ')';
		const hip = { x: L.hx, y: L.hy }, knee = { x: k.kx, y: k.ky }, foot = { x: k.fx, y: k.fy };
		g.save();
		g.lineJoin = 'round'; g.lineCap = 'round';
		// thigh muscle + shin
		taper(g, [hip, knee], front ? 34 : 42, front ? 22 : 24, col([74, 22, 12]), 'rgba(16,3,2,0.95)', 3.2);
		taper(g, [knee, foot], front ? 22 : 24, 13, col([54, 16, 9]), 'rgba(16,3,2,0.95)', 3.2);
		g.fillStyle = col([84, 28, 14]); g.beginPath(); g.arc(knee.x, knee.y, front ? 12 : 14, 0, PI * 2); g.fill(); g.strokeStyle = 'rgba(16,3,2,0.95)'; g.lineWidth = 2.6; g.stroke();
		// knee spike
		const dx = knee.x - hip.x, dy = knee.y - hip.y, d = Math.hypot(dx, dy) || 1;
		g.fillStyle = col([217, 195, 146]); g.beginPath(); g.moveTo(knee.x - dy / d * 6 * (front ? -1 : 1), knee.y + dx / d * 6 * (front ? -1 : 1)); g.lineTo(knee.x + (front ? -1 : 1) * 16 * Math.abs(dy / d) * -1 + dx / d * 6, knee.y + 12); g.lineTo(knee.x + dy / d * 6 * (front ? -1 : 1), knee.y - dx / d * 6 * (front ? -1 : 1)); g.closePath(); g.fill();
		// foot + claws
		const fa = Math.atan2(foot.y - knee.y, foot.x - knee.x);
		g.fillStyle = col([44, 12, 7]);
		g.beginPath(); g.ellipse(foot.x + 8, foot.y - 2, 17, 8, 0.1, 0, PI * 2); g.fill(); g.strokeStyle = 'rgba(16,3,2,0.95)'; g.lineWidth = 2.6; g.stroke();
		g.fillStyle = col([228, 212, 173]);
		for(let c = 0; c < 3; c++){ const cx = foot.x + 14 + c * 6, cy = foot.y - 4 + c * 2; g.beginPath(); g.moveTo(cx - 3, cy - 3); g.lineTo(cx + 10, cy + 2 + Math.max(0, Math.sin(fa)) * 3); g.lineTo(cx - 3, cy + 4); g.closePath(); g.fill(); }
		// hot glow
		g.save(); g.globalCompositeOperation = 'lighter';
		const hg = g.createRadialGradient(foot.x, foot.y, 2, foot.x, foot.y, 26); hg.addColorStop(0, 'rgba(255,120,30,' + (0.06 + glow * 0.18) * dark + ')'); hg.addColorStop(1, 'rgba(255,60,0,0)');
		g.fillStyle = hg; g.fillRect(foot.x - 28, foot.y - 28, 56, 56); g.restore();
		g.restore();
	}

	function draw(en){
		if(!en) return false;
		const R = en._rig || (en._rig = newRig());
		if(R.stepped) R.stepped = false; else step(en);
		const p = R.p, g = ctx;
		const camx = (typeof camera !== 'undefined') ? camera.x : 0, camy = (typeof camera !== 'undefined') ? camera.y : 0;
		const k = R.k, dir = R.dir, t = R.t;
		const glow = clamp(p.glow, 0, 1);
		g.save();
		if(en.flash > 0) g.filter = 'brightness(2.4) saturate(0.35)';
		// contact shadow
		if(R.onGround){
			g.fillStyle = 'rgba(0,0,0,0.38)'; g.beginPath(); g.ellipse(en.x + en.w / 2 - camx, en.y + en.h - camy + 2, en.w * 0.46, en.h * 0.05, 0, 0, PI * 2); g.fill();
		}
		g.translate(R.bx - camx, R.by - camy);
		g.scale(k * dir, k);
		// heat behind the whole body
		g.save(); g.globalCompositeOperation = 'lighter';
		const hz = g.createRadialGradient(0, -10, 40, 0, -10, 230); hz.addColorStop(0, 'rgba(255,90,20,' + (0.05 + glow * 0.16) + ')'); hz.addColorStop(1, 'rgba(255,60,0,0)');
		g.fillStyle = hz; g.fillRect(-250, -250, 500, 500); g.restore();

		const withPitch = (fn) => { g.save(); g.rotate(p.pitch); fn(); g.restore(); };
		// far wing, far legs, tail
		withPitch(() => drawWing(g, R, 1, glow, t));
		drawLeg(g, R, 1, false, glow); drawLeg(g, R, 3, false, glow);
		withPitch(() => { drawTail(g, R, glow, t); });
		// body, neck, head
		withPitch(() => { drawBody(g, R, glow, t); });
		withPitch(() => { drawNeckAndHead(g, R, glow, t, en.flash > 0); });
		// near legs, near wing
		drawLeg(g, R, 2, true, glow); drawLeg(g, R, 0, true, glow);
		withPitch(() => drawWing(g, R, 0, glow, t));
		g.restore();
		return true;
	}

	function reset(en){ if(en) en._rig = null; }
	global.IgnarothRig = { step: function(en){ step(en); if(en._rig) en._rig.stepped = true; }, draw, reset, newRig };
})(typeof window !== 'undefined' ? window : globalThis);
