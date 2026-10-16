/*
 * PLAYER RIG — the wizard, as a real skeleton.
 * ---------------------------------------------------------------------------
 * Pelvis → spine → neck → head (+ hat on a spring)
 *        → shoulders → upper arm → forearm → hand   (two-bone IK)
 *        → hips      → thigh     → shin    → boot   (two-bone IK, feet plant)
 * The robe skirt follows the legs; back limbs are shaded for depth.
 *
 * Art comes from images/melee/body.png + weapons.png. The slicing data is
 * inlined below so the rig works from file:// as well as a web server.
 *
 * Angle convention (shared with the melee pose data): 0 points straight down,
 * a limb direction for angle a is (-sin a, cos a) in the facing frame, so
 * negative angles swing forward and -PI points straight up.
 */
(function(root){
	'use strict';

	const META = {
		body: {
			head:   { sx:0,    sy:0, sw:210, sh:208, ax:105, ay:191, dw:22, dh:22 },
			hat:    { sx:214,  sy:0, sw:261, sh:185, ax:125, ay:144, dw:28, dh:20 },
			torso:  { sx:479,  sy:0, sw:108, sh:190, ax:43,  ay:22,  dw:14, dh:24 },
			skirt:  { sx:598,  sy:0, sw:197, sh:189, ax:98,  ay:15,  dw:21, dh:20 },
			sleeve: { sx:799,  sy:0, sw:101, sh:218, ax:50,  ay:17,  dw:6,  dh:14 },
			hand:   { sx:904,  sy:0, sw:150, sh:190, ax:75,  ay:22,  dw:6,  dh:8  },
			leg:    { sx:1058, sy:0, sw:81,  sh:212, ax:40,  ay:12,  dw:6,  dh:15 },
			boot:   { sx:1143, sy:0, sw:147, sh:186, ax:70,  ay:14,  dw:9,  dh:11 }
		},
		weapons: {
			sword:      { sx:0,   sy:0, sw:71,  sh:215, ax:35, ay:17, dw:12, dh:36 },
			dagger:     { sx:75,  sy:0, sw:49,  sh:165, ax:24, ay:16, dw:5,  dh:18 },
			spear:      { sx:128, sy:0, sw:30,  sh:224, ax:15, ay:8,  dw:9,  dh:64 },
			greatsword: { sx:162, sy:0, sw:81,  sh:232, ax:40, ay:18, dw:17, dh:48 },
			hammer:     { sx:247, sy:0, sw:94,  sh:167, ax:47, ay:10, dw:23, dh:40 },
			scythe:     { sx:345, sy:0, sw:103, sh:190, ax:43, ay:11, dw:27, dh:50 },
			glaive:     { sx:452, sy:0, sw:59,  sh:223, ax:32, ay:13, dw:12, dh:46 },
			whip:       { sx:515, sy:0, sw:29,  sh:194, ax:14, ay:15, dw:4,  dh:14 },
			chain:      { sx:548, sy:0, sw:108, sh:169, ax:59, ay:20, dw:12, dh:18 },
			staff:      { sx:660, sy:0, sw:65,  sh:208, ax:32, ay:12, dw:13, dh:42 },
			gauntlet:   { sx:729, sy:0, sw:80,  sh:152, ax:40, ay:15, dw:7,  dh:14 },
			link:       { sx:813, sy:0, sw:48,  sh:103, ax:24, ay:51, dw:4,  dh:6  }
		}
	};

	/* how big each weapon looks in the hand (same proportions the attack ranges were tuned for) */
	const WEAPON_LEN = { sword:33, dagger:15, spear:72, greatsword:48, hammer:44, scythe:50, glaive:50, whip:13, chain:16, staff:50, gauntlet:9, link:5 };
	const WEAPON_THIN = { spear:0.8, staff:0.95, glaive:0.95 };
	/* where the hand holds, as a fraction of the weapon's length from its butt end */
	/* How each weapon stretches to its reach: only the [s0, s1] band of the image (shaft or blade)
	   stretches; pommels, heads and blades outside it keep their drawn size.
	   main / back: where the hands hold — 'abs' values are units from the butt end (hilted weapons),
	   otherwise fractions of the final length (shafted weapons). */
	const GRIP = {
		sword:      { s0:0.26, s1:0.94, main:4.4, abs:true },
		dagger:     { s0:0.3,  s1:0.94, main:2.6, abs:true },
		greatsword: { s0:0.24, s1:0.94, main:6.5, back:2.4, abs:true },
		hammer:     { s0:0.06, s1:0.58, main:0.3, back:0.07 },
		spear:      { s0:0.04, s1:0.86, main:0.34, back:0.1 },
		staff:      { s0:0.06, s1:0.74, main:0.42, back:0.16 },
		scythe:     { s0:0.05, s1:0.6,  main:0.38, back:0.1 },
		glaive:     { s0:0.05, s1:0.55, main:0.38, back:0.1 },
		whip:       { s0:0.3, s1:0.9, main:0.25 }, chain:{ s0:0.3, s1:0.9, main:0.3 }
	};
	const SIZE = 1.5;      // overall character scale on screen
	const WEAPON_SCALE = {};
	for(const k in WEAPON_LEN){ /* filled after META below */ }
	/* resting holds (no attack in progress): front arm angle, weapon angle, back arm angle, reach */
	const REST = {
		sword:      { arm:-0.42, w:-2.35, back:0.15, reach:0.8 },
		greatsword: { arm:-0.55, w:-2.55, back:0, reach:0.78 },
		hammer:     { arm:-0.62, w:-2.45, back:0, reach:0.74 },
		spear:      { arm:-0.7,  w:-2.05, back:0, reach:0.72 },
		staff:      { arm:-0.55, w:-2.5,  back:0, reach:0.76 },
		glaive:     { arm:-0.62, w:-2.35, back:0, reach:0.74 },
		scythe:     { arm:-0.6,  w:-2.5,  back:0, reach:0.74 },
		daggers:    { arm:-0.55, w:-0.55, back:-0.35, reach:0.78, backW:-0.5 },
		gauntlets:  { arm:-1.25, w:0,     back:-0.95, reach:0.62, backReach:0.62 },
		whip:       { arm:0.05,  w:0.25,  back:0.1, reach:0.86 },
		chain:      { arm:0.05,  w:0.3,   back:0.1, reach:0.86 }
	};


	for(const k in WEAPON_LEN){
		const spec = META.weapons[k]; if(!spec) continue;
		const sy = WEAPON_LEN[k] / spec.dh;
		WEAPON_SCALE[k] = [sy * (WEAPON_THIN[k] || 1), sy];
	}
	WEAPON_SCALE.daggers = WEAPON_SCALE.dagger;

	/* skeleton (rig units, feet at y = 0, facing +x) */
	const SK = {
		ankleY: -7.5, thigh: 10.2, shin: 10.2, hipW: 3.2,
		spine: 19, neck: 2.2, shoulderW: 6.2, shoulderDrop: 3.2,
		upperArm: 9.4, foreArm: 8.7,
		bootScale: 0.82
	};
	const LEG = SK.thigh + SK.shin;
	const ARM = SK.upperArm + SK.foreArm;

	/* ------------------------------------------------------------ image loading */
	const Art = { body:null, weapons:null, ready:false, cache:{} };
	function load(){
		if(typeof Image === 'undefined') return;
		const b = new Image(), w = new Image();
		b.onload = () => { Art.body = b; Art.ready = !!(Art.body && Art.weapons); };
		w.onload = () => { Art.weapons = w; Art.ready = !!(Art.body && Art.weapons); };
		b.src = 'images/melee/body.png?v=7';
		w.src = 'images/melee/weapons.png?v=3';
	}

	/* recolour (cloth hue) and shade (back limbs) once, then reuse */
	function rgbToHsl(r, g, b){
		r /= 255; g /= 255; b /= 255;
		const max = Math.max(r,g,b), min = Math.min(r,g,b), l = (max+min)/2, d = max-min;
		let h = 0, s = 0;
		if(d){ s = l>0.5 ? d/(2-max-min) : d/(max+min); if(max===r) h = ((g-b)/d)%6; else if(max===g) h = (b-r)/d+2; else h = (r-g)/d+4; h *= 60; if(h<0) h += 360; }
		return [h, s, l];
	}
	function hslToRgb(h, s, l){
		const c = (1-Math.abs(2*l-1))*s, hp = h/60, x = c*(1-Math.abs(hp%2-1));
		let r=0,g=0,b=0;
		if(hp<1){ r=c; g=x; } else if(hp<2){ r=x; g=c; } else if(hp<3){ g=c; b=x; } else if(hp<4){ g=x; b=c; } else if(hp<5){ r=x; b=c; } else { r=c; b=x; }
		const m = l-c/2;
		return [Math.round((r+m)*255), Math.round((g+m)*255), Math.round((b+m)*255)];
	}
	function variant(group, name, tint, dark){
		const key = group + name + '|' + (tint||'') + '|' + (dark?1:0);
		if(Art.cache[key]) return Art.cache[key];
		const spec = META[group][name];
		const sheet = group === 'body' ? Art.body : Art.weapons;
		const c = document.createElement('canvas');
		c.width = spec.sw; c.height = spec.sh;
		const g = c.getContext('2d');
		g.drawImage(sheet, spec.sx, spec.sy, spec.sw, spec.sh, 0, 0, spec.sw, spec.sh);
		if(tint){
			const n = parseInt(String(tint).replace('#',''), 16);
			const target = rgbToHsl((n>>16)&255, (n>>8)&255, n&255);
			let data = null;
			try { data = g.getImageData(0, 0, spec.sw, spec.sh); } catch(e){ data = null; }   // file:// can block pixel access
			if(data){
			const p = data.data;
			for(let i=0;i<p.length;i+=4){
				if(p[i+3]<8) continue;
				const hsl = rgbToHsl(p[i], p[i+1], p[i+2]);
				if(hsl[1]<0.22 || hsl[0]<185 || hsl[0]>255) continue;     // only the blue cloth
				const rgb = hslToRgb(target[0], Math.min(1, hsl[1]*0.75+target[1]*0.25), hsl[2]);
				p[i] = rgb[0]; p[i+1] = rgb[1]; p[i+2] = rgb[2];
			}
			g.putImageData(data, 0, 0);
			} else {
				// fallback tint: wash the cloth colour over the part
				g.globalCompositeOperation = 'source-atop'; g.globalAlpha = 0.35; g.fillStyle = tint; g.fillRect(0, 0, spec.sw, spec.sh);
				g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
			}
		}
		if(dark){
			g.globalCompositeOperation = 'source-atop';
			g.fillStyle = 'rgba(14,16,40,0.36)';
			g.fillRect(0, 0, spec.sw, spec.sh);
		}
		Art.cache[key] = c;
		return c;
	}

	/* average cloth colour of a part, for round joint caps (elbows, knees, shoulders) */
	function capColor(name, tint, dark){
		const key = 'cap' + name + '|' + (tint||'') + '|' + (dark?1:0);
		if(Art.cache[key] !== undefined) return Art.cache[key];
		const img = variant('body', name, tint, dark);
		let col = null;
		try {
			const c = document.createElement('canvas'); c.width = 1; c.height = 1;
			const g = c.getContext('2d');
			const spec = META.body[name];
			g.drawImage(img, spec.sw * 0.3, spec.sh * 0.25, spec.sw * 0.4, spec.sh * 0.3, 0, 0, 1, 1);
			const d = g.getImageData(0, 0, 1, 1).data;
			col = 'rgb(' + d[0] + ',' + d[1] + ',' + d[2] + ')';
		} catch(e){
			col = dark ? '#1a2c5c' : '#24418a';     // file:// fallback: robe blue
		}
		Art.cache[key] = col;
		return col;
	}

	/* whole part, anchored at its pivot */
	function part(ctx, group, name, tint, dark, sx, sy){
		const spec = META[group][name];
		const img = variant(group, name, tint, dark);
		const w = spec.dw * (sx||1), h = spec.dh * (sy||1);
		ctx.drawImage(img, -spec.ax / spec.sw * w, -spec.ay / spec.sh * h, w, h);
	}
	/* a vertical slice of a part stretched between two joints (limb segment) */
	function segment(ctx, name, f0, f1, ax, ay, bx, by, width, tint, dark, over){
		const spec = META.body[name];
		const img = variant('body', name, tint, dark);
		const dx = bx - ax, dy = by - ay, len = Math.sqrt(dx*dx + dy*dy) || 0.001;
		const o0 = over == null ? 0.9 : over;
		ctx.save();
		ctx.translate(ax, ay);
		ctx.rotate(Math.atan2(dy, dx) - Math.PI/2);
		const sy0 = Math.max(0, Math.floor(spec.sh * f0)), sy1 = Math.min(spec.sh, Math.ceil(spec.sh * f1));
		const cx = spec.ax / spec.sw * width;
		ctx.drawImage(img, 0, sy0, spec.sw, Math.max(1, sy1 - sy0), -cx, -o0, width, len + o0 * 2);
		ctx.restore();
	}

	/* ------------------------------------------------------------ math */
	function dirOf(a){ return { x: -Math.sin(a), y: Math.cos(a) }; }
	function angOf(dx, dy){ return Math.atan2(-dx, dy); }      // inverse of dirOf
	function lerp(a, b, t){ return a + (b - a) * t; }
	function clamp(v, a, b){ return v < a ? a : (v > b ? b : v); }
	/* two-bone IK. side = +1 bends the joint to the left of root→target (elbows: under a forward arm,
	   forward on a raised arm, back on a hanging arm), -1 to the right (knees: forward). The bend side
	   never flips, so limbs can't snap inside out mid-swing. */
	function ik(rx, ry, tx, ty, a, b, side){
		let dx = tx - rx, dy = ty - ry;
		let d = Math.sqrt(dx*dx + dy*dy);
		if(d < 0.0001){ dx = 0; dy = 1; d = 0.0001; }
		const maxD = a + b - 0.02, minD = Math.abs(a - b) + 0.5;
		const dc = clamp(d, minD, maxD);
		const ux = dx / d, uy = dy / d;
		const cosA = clamp((a*a + dc*dc - b*b) / (2*a*dc), -1, 1);
		const sinA = Math.sqrt(1 - cosA*cosA);
		// rotate u by ±A toward the chosen side
		const nx = -uy * side, ny = ux * side;
		const jx = rx + (ux * cosA + nx * sinA) * a, jy = ry + (uy * cosA + ny * sinA) * a;
		return { jx, jy, ex: rx + ux * dc, ey: ry + uy * dc, reach: d / (a + b) };
	}
	const KNEE = -1, ELBOW = 1;

	/* ------------------------------------------------------------ per-character springs */
	function springState(who){
		if(!who._rig) who._rig = { hat:0, hatV:0, skirt:0, skirtV:0, look:0, t:0, lastX:who.x, lastY:who.y, planted:null };
		return who._rig;
	}
	function spring(s, key, target, k, damp){
		const v = key + 'V';
		s[v] = (s[v] + (target - s[key]) * k) * damp;
		s[key] += s[v];
	}

	/* ------------------------------------------------------------ pose solving
	   input pose: { lean, head, hat, armF, armB, legF, legB, shift, crouch }  (melee convention)
	   o: { state, grounded, vx, vy, walkPhase, weapon, swing, castT, aim, spellHand, squash, frame } */
	function solve(pose, o, s){
		const P = {};
		const grounded = !!o.grounded;
		const t = o.frame || 0;
		const speed = Math.abs(o.vx || 0);
		const crouch = (pose.crouch || 0) + (o.squash || 0) * 3.5;
		const shift = pose.shift || 0;
		const st = o.state || 'idle';
		const angleLegs = !!o.angleLegs;     // attacks, hit, parry, death use authored leg angles

		// pelvis
		let hipY = SK.ankleY - LEG * 0.965 + crouch;
		let hipX = shift;
		let lean = pose.lean || 0;
		const breathe = Math.sin(t * 0.07);
		if(st === 'idle' && !angleLegs){ hipY += 0.35 + breathe * 0.25; }
		const gait = o.walkPhase || 0;
		if(st === 'run' && !angleLegs){
			hipY += 0.4 + Math.abs(Math.cos(gait)) * -1.1 + 0.9;
			lean = Math.max(lean, 0.1 + Math.min(0.12, speed * 0.012));
		}
		lean = clamp(lean, -0.6, 0.62);
		P.hip = { x: hipX, y: hipY };
		P.lean = lean;

		// legs → foot targets
		const hipF = { x: hipX + SK.hipW * 0.5, y: hipY }, hipB = { x: hipX - SK.hipW * 0.5, y: hipY };
		let fF, fB;
		if(angleLegs){
			const dF = dirOf(pose.legF || 0), dB = dirOf(pose.legB || 0);
			fF = { x: hipF.x + dF.x * LEG * 0.99, y: hipF.y + dF.y * LEG * 0.99 };
			fB = { x: hipB.x + dB.x * LEG * 0.99, y: hipB.y + dB.y * LEG * 0.99 };
			if(grounded){ if(fF.y > SK.ankleY) fF.y = SK.ankleY; if(fB.y > SK.ankleY) fB.y = SK.ankleY; }
		} else if(st === 'run' && grounded){
			const stride = clamp(4.2 + speed * 0.75, 5, 10.5);
			const lift = clamp(2.6 + speed * 0.35, 3, 6.5);
			const step = (ph) => {
				const sx = Math.sin(ph) * stride;
				const swing = Math.cos(ph) < 0;                 // foot travelling forward in the air
				const up = swing ? Math.sin(Math.min(1, -Math.cos(ph)) * Math.PI / 2) * lift : 0;
				return { x: hipX + sx + 1.2, y: SK.ankleY - up };
			};
			fF = step(gait); fB = step(gait + Math.PI);
		} else if(st === 'jump'){
			fF = { x: hipF.x + 4.5, y: hipY + LEG * 0.62 };
			fB = { x: hipB.x - 3.5, y: hipY + LEG * 0.8 };
		} else if(st === 'fall'){
			const flut = Math.sin(t * 0.25) * 0.8;
			fF = { x: hipF.x + 2.5 + flut, y: hipY + LEG * 0.9 };
			fB = { x: hipB.x - 2.8 - flut, y: hipY + LEG * 0.86 };
		} else if(st === 'dash'){
			fF = { x: hipF.x + 6, y: hipY + LEG * 0.78 };
			fB = { x: hipB.x - 9, y: hipY + LEG * 0.7 };
		} else {
			fF = { x: hipX + 3.9, y: SK.ankleY };
			fB = { x: hipX - 3.6, y: SK.ankleY };
			if(!grounded){ fF.y = hipY + LEG * 0.92; fB.y = hipY + LEG * 0.9; }
		}
		const legF = ik(hipF.x, hipF.y, fF.x, fF.y, SK.thigh, SK.shin, KNEE);
		const legB = ik(hipB.x, hipB.y, fB.x, fB.y, SK.thigh, SK.shin, KNEE);
		P.legF = { hx: hipF.x, hy: hipF.y, kx: legF.jx, ky: legF.jy, ax: legF.ex, ay: legF.ey };
		P.legB = { hx: hipB.x, hy: hipB.y, kx: legB.jx, ky: legB.jy, ax: legB.ex, ay: legB.ey };
		// boots: flat when planted, pointing with the shin in the air
		const footAng = (L, planted) => planted ? 0 : clamp(Math.atan2(L.ay - L.ky, L.ax - L.kx) - Math.PI / 2, -0.9, 0.9) * 0.6;
		P.legF.foot = footAng(P.legF, grounded && P.legF.ay >= SK.ankleY - 0.6);
		P.legB.foot = footAng(P.legB, grounded && P.legB.ay >= SK.ankleY - 0.6);

		// spine
		const up = { x: Math.sin(lean), y: -Math.cos(lean) };
		P.neck = { x: hipX + up.x * SK.spine, y: hipY + up.y * SK.spine };
		const side = { x: Math.cos(lean), y: Math.sin(lean) };
		const shoulderAt = (k) => ({
			x: P.neck.x - up.x * SK.shoulderDrop + side.x * SK.shoulderW * k * 0.5,
			y: P.neck.y - up.y * SK.shoulderDrop + side.y * SK.shoulderW * k * 0.5
		});
		P.shF = shoulderAt(1); P.shB = shoulderAt(-1);
		P.head = { x: P.neck.x + up.x * SK.neck, y: P.neck.y + up.y * SK.neck, a: clamp(lean * 0.35 + (pose.head || 0) * 0.6 + (o.look || 0), -0.45, 0.45) };

		// arms
		const aimArm = (aim) => angOf(aim.x, aim.y);
		let armFa, armBa, reachF = 0.94, reachB = 0.9;
		let sw = o.swing;
		const rest = o.rest && o.weapon ? REST[o.weapon] : null;
		if(rest){
			const bob = st === 'run' ? Math.sin(gait * 2) * 0.08 : breathe * 0.03;
			sw = { arm: rest.arm + bob, armB: rest.back - (st === 'run' ? Math.sin(gait) * 0.5 : 0), roll: rest.w - rest.arm, ext: 0, restReach: rest.reach, backReach: rest.backReach };
		}
		if(sw){ armFa = sw.arm; armBa = sw.armB; reachF = sw.restReach || (0.96 + (sw.ext || 0) * 0.012); if(sw.backReach) reachB = sw.backReach; }
		else {
			armFa = pose.armF || 0; armBa = pose.armB || 0;
			if(!o.angleArms){
				if(st === 'run'){ armFa = -Math.sin(gait) * 0.7; armBa = Math.sin(gait) * 0.7; reachF = reachB = 0.86; }
				else if(st === 'jump'){ armFa = -1.15; armBa = 0.95; }
				else if(st === 'fall'){ armFa = -1.5; armBa = 1.4; }
				else if(st === 'dash'){ armFa = 0.6; armBa = 1.1; }
				else { armFa = 0.12 + breathe * 0.03; armBa = -0.08 - breathe * 0.03; reachF = reachB = 0.9; }
			}
		}
		if(o.spellHand && o.castT > 0 && o.aim){ armFa = aimArm(o.aim); reachF = 0.99; }
		else if(o.spellHand && o.channel && o.aim){ armFa = lerp(armFa, aimArm(o.aim), 0.75); reachF = 0.97; }
		// smooth the hand targets a little so swings flow instead of popping between frames
		const dF = dirOf(armFa);
		let tFx = P.shF.x + dF.x * ARM * reachF, tFy = P.shF.y + dF.y * ARM * reachF;
		if(s.hF && o.frame !== s.lastFrame){ tFx = lerp(s.hF.x, tFx, 0.6); tFy = lerp(s.hF.y, tFy, 0.6); }
		s.hF = { x: tFx, y: tFy };
		const hF = ik(P.shF.x, P.shF.y, tFx, tFy, SK.upperArm, SK.foreArm, ELBOW);
		P.armF = { sx: P.shF.x, sy: P.shF.y, ex: hF.jx, ey: hF.jy, hx: hF.ex, hy: hF.ey, a: armFa };

		// weapon in the main hand (its angle is smoothed with the shortest turn)
		const wpn = o.weapon;
		if(wpn){
			let wa = sw ? (sw.arm + (sw.roll || 0)) : armFa;
			if(s.wa != null && o.frame !== s.lastFrame){
				let dA = wa - s.wa; while(dA > Math.PI) dA -= Math.PI * 2; while(dA < -Math.PI) dA += Math.PI * 2;
				wa = s.wa + dA * 0.62;
			}
			s.wa = wa;
			P.weapon = { x: P.armF.hx, y: P.armF.hy, a: wa, ext: sw ? (sw.ext || 0) : 0, geo: weaponGeo(wpn, o.weaponLen) };
		} else s.wa = null;
		s.lastFrame = o.frame;

		// back hand: two-handed weapons are held lower on the handle (toward the butt end)
		const geo = P.weapon && P.weapon.geo;
		if(geo && geo.back != null){
			const wd = dirOf(P.weapon.a);
			const ext = (P.weapon.ext || 0) * 0.55;
			const at = (f) => ({ x: P.weapon.x + wd.x * ((f - geo.main) * geo.len + ext), y: P.weapon.y + wd.y * ((f - geo.main) * geo.len + ext) });
			// if the shaft is out of the back arm's reach, slide the grip toward the front hand
			let f = geo.back, g = at(f);
			for(let i = 0; i < 8; i++){
				const dd = Math.hypot(g.x - P.shB.x, g.y - P.shB.y);
				if(dd <= ARM * 0.98) break;
				f = lerp(f, geo.main - 0.02, 0.35); g = at(f);
			}
			const hB = ik(P.shB.x, P.shB.y, g.x, g.y, SK.upperArm, SK.foreArm, ELBOW);
			P.armB = { sx: P.shB.x, sy: P.shB.y, ex: hB.jx, ey: hB.jy, hx: hB.ex, hy: hB.ey, a: P.weapon.a, grip: true };
		} else {
			const dB = dirOf(armBa);
			const hB = ik(P.shB.x, P.shB.y, P.shB.x + dB.x * ARM * reachB, P.shB.y + dB.y * ARM * reachB, SK.upperArm, SK.foreArm, ELBOW);
			P.armB = { sx: P.shB.x, sy: P.shB.y, ex: hB.jx, ey: hB.jy, hx: hB.ex, hy: hB.ey, a: armBa };
		}
		return P;
	}

	/* weapon size: lengths can be driven by the attack's real reach (o.weaponLen, rig units) */
	function weaponGeo(style, lenOverride){
		const name = style === 'daggers' ? 'dagger' : style;
		const spec = META.weapons[name];
		if(!spec) return null;
		const g = GRIP[name] || { s0:0.2, s1:0.9, main:0.1 };
		const base = WEAPON_LEN[name] || spec.dh;
		const len = lenOverride ? clamp(lenOverride, base * 0.7, 320) : base;
		const grow = clamp(Math.sqrt(len / base), 0.92, 1.18);          // a little sturdier when long
		const sxBase = (base / spec.dh) * (WEAPON_THIN[name] || 1);
		const toFrac = (v) => g.abs ? clamp(v * Math.min(1.25, grow) / len, 0.01, 0.9) : v;
		return { name, spec, len, base, s0: g.s0, s1: g.s1, sx: sxBase * grow, main: toFrac(g.main), back: g.back != null ? toFrac(g.back) : null };
	}
	/* draw a weapon from its butt end (y = 0) to its tip (y = len), stretching only the shaft/blade band */
	function sliced(ctx, geo, dark){
		const spec = geo.spec, img = variant('weapons', geo.name, null, dark);
		const w = spec.dw * geo.sx;
		const cx = spec.ax / spec.sw * w;
		const k = geo.base / spec.sh;                  // units per source pixel at base size
		let h0 = spec.sh * geo.s0 * k, h2 = spec.sh * (1 - geo.s1) * k;
		let h1 = geo.len - h0 - h2;
		if(h1 < spec.sh * (geo.s1 - geo.s0) * k * 0.5){ // shorter than designed: scale everything uniformly
			const u = geo.len / geo.base; h0 *= u; h2 *= u; h1 = geo.len - h0 - h2;
		}
		const r0 = spec.sh * geo.s0, r1 = spec.sh * geo.s1;
		ctx.drawImage(img, 0, 0, spec.sw, r0, -cx, 0, w, h0 + 0.4);
		ctx.drawImage(img, 0, r0, spec.sw, r1 - r0, -cx, h0, w, h1 + 0.4);
		ctx.drawImage(img, 0, r1, spec.sw, spec.sh - r1, -cx, h0 + h1, w, h2);
	}

	/* ------------------------------------------------------------ drawing */
	function jointCap(ctx, name, x, y, r, tint, dark){
		const c = capColor(name, tint, dark);
		if(!c) return;
		ctx.fillStyle = c;
		ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
	}
	function drawLeg(ctx, L, tint, dark){
		segment(ctx, 'leg', 0, 0.52, L.hx, L.hy, L.kx, L.ky, 6.6, tint, dark, 1.1);
		jointCap(ctx, 'leg', L.kx, L.ky, 3.0, tint, dark);
		segment(ctx, 'leg', 0.48, 1, L.kx, L.ky, L.ax, L.ay, 6.2, tint, dark, 1.1);
		ctx.save();
		ctx.translate(L.ax, L.ay - 0.6);
		ctx.rotate(L.foot || 0);
		part(ctx, 'body', 'boot', null, dark, SK.bootScale, SK.bootScale);
		ctx.restore();
	}
	function drawArm(ctx, A, tint, dark, handPart, grip){
		// shoulder cap, upper arm, elbow cap, forearm (the sleeve's bell narrowed so it reads as an arm)
		jointCap(ctx, 'sleeve', A.sx, A.sy, 3.1, tint, dark);
		segment(ctx, 'sleeve', 0.02, 0.5, A.sx, A.sy, A.ex, A.ey, 5.6, tint, dark, 1.2);
		jointCap(ctx, 'sleeve', A.ex, A.ey, 2.75, tint, dark);
		segment(ctx, 'sleeve', 0.42, 1, A.ex, A.ey, A.hx, A.hy, 6.0, tint, dark, 0.8);
		ctx.save();
		ctx.translate(A.hx, A.hy);
		ctx.rotate(Math.atan2(A.hy - A.ey, A.hx - A.ex) - Math.PI / 2);
		if(handPart === 'gauntlet') part(ctx, 'weapons', 'gauntlet', null, dark, 1.1, 1.1);
		else if(grip){
			// closed fist: palm only, fingers wrapped out of sight around the grip
			const spec = META.body.hand, img = variant('body', 'hand', null, dark);
			const w = spec.dw * 1.12, h = spec.dh * 1.12;
			ctx.drawImage(img, 0, 0, spec.sw, spec.sh * 0.58, -spec.ax / spec.sw * w, -spec.ay / spec.sh * h, w, h * 0.58);
		}
		else part(ctx, 'body', 'hand', null, dark, 1.08, 1.08);
		ctx.restore();
	}
	function drawWeapon(ctx, style, W, dark, extra){
		if(!style || style === 'gauntlets') return null;
		const geo = W.geo || weaponGeo(style);
		if(!geo) return null;
		ctx.save();
		const shift = -geo.main * geo.len + (W.ext || 0) * 0.55;    // hand sits at the grip point
		if(extra && extra.hide){
			// a magical item: the magic draws the weapon (as compressed energy); only its reach is measured here
			ctx.restore();
			const d = dirOf(W.a), len = geo.len + shift;
			return { x: W.x + d.x * len, y: W.y + d.y * len };
		}
		if(extra && extra.portal && !extra.draw){
			// Spatial portal strike: the near half stays in your hand, the far half comes out of the exit portal
			ctx.restore();
			const d = dirOf(W.a), nx = -d.y, ny = d.x;
			const m = Math.max(shift + geo.len * 0.5, (geo.len + shift) * 0.3);
			const mx = W.x + d.x * m, my = W.y + d.y * m, B = 600;
			const ox = extra.portal.x - mx, oy = extra.portal.y - my;
			const half = (sg) => {
				ctx.beginPath();
				ctx.moveTo(mx + nx * B, my + ny * B); ctx.lineTo(mx - nx * B, my - ny * B);
				ctx.lineTo(mx - nx * B + sg * d.x * B, my - ny * B + sg * d.y * B); ctx.lineTo(mx + nx * B + sg * d.x * B, my + ny * B + sg * d.y * B);
				ctx.closePath(); ctx.clip();
			};
			const blade = () => { ctx.translate(W.x, W.y); ctx.rotate(W.a); ctx.translate(0, shift); sliced(ctx, geo, dark); };
			ctx.save(); half(-1); blade(); ctx.restore();
			ctx.save(); ctx.translate(ox, oy); half(1); blade(); ctx.restore();
			const len = geo.len + shift;
			return { x: W.x + d.x * len, y: W.y + d.y * len, portalIn: { x: mx, y: my }, portalTip: { x: W.x + d.x * len + ox, y: W.y + d.y * len + oy } };
		}
		ctx.translate(W.x, W.y);
		ctx.rotate(W.a);
		if(extra && extra.draw){ extra.draw(ctx); ctx.restore(); return null; }
		ctx.translate(0, shift);
		sliced(ctx, geo, dark);
		ctx.restore();
		const len = geo.len + shift;
		const d = dirOf(W.a);
		return { x: W.x + d.x * len, y: W.y + d.y * len };
	}
	function drawSkirt(ctx, P, s, tint){
		const spread = (P.legF.kx - P.legB.kx);
		const avg = ((P.legF.kx + P.legB.kx) / 2 - P.hip.x);
		ctx.save();
		ctx.translate(P.hip.x, P.hip.y - 3.2);
		ctx.rotate(P.lean * 0.35);
		const shear = clamp(avg * 0.05 + s.skirt, -0.55, 0.55);
		ctx.transform(1, 0, shear, 1, 0, 0);
		const sx = 1.12 + clamp(Math.abs(spread) * 0.035, 0, 0.32);
		part(ctx, 'body', 'skirt', tint, false, sx, 1.0);
		ctx.restore();
	}
	function drawTorso(ctx, P, tint){
		ctx.save();
		ctx.translate(P.neck.x, P.neck.y);
		ctx.rotate(P.lean);
		ctx.translate(0, -1.2);
		part(ctx, 'body', 'torso', tint, false, 1.12, 1.0);
		ctx.restore();
	}
	function drawHead(ctx, P, s, tint){
		ctx.save();
		ctx.translate(P.head.x, P.head.y + 0.8);
		ctx.rotate(P.head.a);
		part(ctx, 'body', 'head', null, false, 1.0, 1.0);
		ctx.rotate(s.hat);
		ctx.translate(0, -13.6);
		part(ctx, 'body', 'hat', tint, false, 1.02, 1.02);
		ctx.restore();
	}
	function drawStaffInHand(ctx, A, dark, castT){
		// the mage's own staff, orb up, held a third of the way along the shaft
		const spec = META.weapons.staff, sc = WEAPON_SCALE.staff;
		const len = spec.dh * sc[1];
		ctx.save();
		ctx.translate(A.hx, A.hy);
		ctx.rotate(Math.PI + (A.staffTilt || 0));
		ctx.translate(0, -len * 0.32);
		part(ctx, 'weapons', 'staff', null, dark, sc[0], sc[1]);
		ctx.restore();
		return null;
	}

	/* public: draw the rig.
	   px, py = top-left of the character box on the canvas; who = entity with w, h, facing, flash.
	   o = see solve(). returns { tip:{x,y} | null } in canvas space. */
	function draw(ctx, px, py, who, pose, o){
		if(!Art.ready) return null;
		o = o || {};
		const s = springState(who);
		const f = who.facing || 1;
		const vis = scaleFor(who);
		const squash = 1 + (o.squash || 0) * 0.12, stretch = 1 - (o.squash || 0) * 0.08;
		const feetX = px + who.w / 2, feetY = py + who.h;
		// secondary motion
		const vx = (o.vx || 0) * f, vy = o.vy || 0;
		spring(s, 'hat', clamp(-vx * 0.03 + vy * 0.02, -0.22, 0.22), 0.12, 0.8);
		s.hat = clamp(s.hat, -0.3, 0.3);
		spring(s, 'skirt', clamp(-vx * 0.035 + (o.grounded ? 0 : vy * 0.01), -0.4, 0.4), 0.1, 0.82);
		s.look += ((o.aim ? clamp(o.aim.y * 0.28, -0.3, 0.3) : 0) - s.look) * 0.12;
		o.look = s.look;
		if(o.reachPx && o.weapon && o.weapon !== 'whip' && o.weapon !== 'chain' && o.weapon !== 'gauntlets'){
			// size the weapon so its tip reaches where the attack actually hits
			const name = o.weapon === 'daggers' ? 'dagger' : o.weapon;
			const g = GRIP[name] || { main:0.1 };
			const need = Math.max(6, o.reachPx * 0.94 / vis - ARM * 0.92);
			o.weaponLen = g.abs ? need + g.main : need / Math.max(0.3, 1 - g.main);
		}
		const P = solve(pose, o, s);
		const tint = o.tint || null;
		const style = o.weapon || null;
		ctx.save();
		ctx.translate(feetX, feetY);
		// ground shadow
		if(o.grounded){
			ctx.save();
			ctx.globalAlpha = 0.28;
			ctx.fillStyle = '#000';
			ctx.beginPath(); ctx.ellipse(0, 0, 12 * vis, 2.6 * vis, 0, 0, Math.PI * 2); ctx.fill();
			ctx.restore();
		}
		ctx.scale(f * squash * vis, stretch * vis);
		if(who.flash > 0) ctx.globalAlpha = 0.75 + 0.25 * Math.sin((o.frame || 0) * 1.3);
		// back layer
		const backHandPart = style === 'gauntlets' && !o.hideWeapon ? 'gauntlet' : 'hand';
		if(o.spellHand && !style){ P.armB.staffTilt = 0.18 + (P.armB.a || 0) * 0.2; }
		const backHolds = (o.spellHand && !style) || style === 'daggers';
		if(o.spellHand && !style) drawStaffInHand(ctx, P.armB, true, o.castT);
		else if(style === 'daggers') drawWeapon(ctx, 'daggers', { x: P.armB.hx, y: P.armB.hy, a: P.armB.a + Math.PI / 2 }, true);
		drawArm(ctx, P.armB, tint, true, backHandPart, backHolds);
		drawLeg(ctx, P.legB, tint, true);
		drawLeg(ctx, P.legF, tint, false);
		drawSkirt(ctx, P, s, tint);
		drawTorso(ctx, P, tint);
		drawHead(ctx, P, s, tint);
		// weapon then front arm over it (fist wraps the grip)
		let tip = null;
		const portalLocal = o.portal ? { x: (o.portal.x - feetX) / (f * squash * vis), y: (o.portal.y - feetY) / (stretch * vis) } : null;
		if(P.weapon) tip = drawWeapon(ctx, style, P.weapon, false, o.hideWeapon ? { hide: true } : (o.weaponDraw ? { draw: o.weaponDraw } : (portalLocal ? { portal: portalLocal } : null)));
		if(P.armB.grip) drawArm(ctx, P.armB, tint, false, backHandPart, true);
		drawArm(ctx, P.armF, tint, false, style === 'gauntlets' && !o.hideWeapon ? 'gauntlet' : 'hand', !!(style && style !== 'gauntlets'));
		// spell glow in the casting hand
		if(o.spellHand && (o.castT > 0 || o.channel)){
			const k = o.castT > 0 ? o.castT / 12 : 0.4;
			ctx.save();
			ctx.globalCompositeOperation = 'lighter';
			const g = ctx.createRadialGradient(P.armF.hx, P.armF.hy, 0, P.armF.hx, P.armF.hy, 9);
			g.addColorStop(0, 'rgba(255,255,255,' + (0.9 * k) + ')');
			g.addColorStop(0.35, (o.castColor || 'rgba(159,230,255,1)').replace(/^#(\w\w)(\w\w)(\w\w)$/, (m, r, gg, b) => 'rgba(' + parseInt(r,16) + ',' + parseInt(gg,16) + ',' + parseInt(b,16) + ',' + (0.7 * k) + ')'));
			g.addColorStop(1, 'rgba(120,160,255,0)');
			ctx.fillStyle = g; ctx.beginPath(); ctx.arc(P.armF.hx, P.armF.hy, 9, 0, Math.PI * 2); ctx.fill();
			ctx.restore();
		}
		ctx.restore();
		const toCanvas = (q) => q ? { x: feetX + q.x * f * squash * vis, y: feetY + q.y * stretch * vis } : null;
		return { tip: toCanvas(tip), portalIn: tip && tip.portalIn ? toCanvas(tip.portalIn) : null, portalTip: tip && tip.portalTip ? toCanvas(tip.portalTip) : null, hand: toCanvas({ x: P.armF.hx, y: P.armF.hy }), handLocal: { x: P.armF.hx, y: P.armF.hy }, pose: P, vis };
	}

	function scaleFor(who){
		const zoom = (typeof CAMERA_ZOOM === 'number') ? CAMERA_ZOOM : 1;
		const w = who.w || 38;
		const fit = Math.min(w / 111.5, (who.baseH || 56) / 93.25) * 2 * zoom;
		return Math.max(0.6, 93.25 * fit * 0.93 / 78) * SIZE;
	}

	/* small helpers for menus: a weapon icon, and a posed preview */
	function weaponIcon(canvas, style){
		const ctx = canvas.getContext('2d');
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		if(!Art.ready){ setTimeout(() => weaponIcon(canvas, style), 120); return; }
		const name = style === 'daggers' ? 'dagger' : (style === 'gauntlets' ? 'gauntlet' : style);
		const spec = META.weapons[name]; if(!spec) return;
		const img = variant('weapons', name, null, false);
		const long = spec.sh > spec.sw * 1.5;
		const k = long ? Math.min(canvas.width * 1.25 / spec.sh, canvas.width * 0.6 / spec.sw) : Math.min(canvas.width * 0.8 / spec.sw, canvas.height * 0.8 / spec.sh);
		ctx.save();
		ctx.translate(canvas.width / 2, canvas.height / 2);
		if(long) ctx.rotate(Math.PI / 4);
		const w = spec.sw * k, h = spec.sh * k;
		if(style === 'daggers'){ ctx.drawImage(img, -w * 0.95, -h / 2, w, h); ctx.drawImage(img, -w * 0.05, -h / 2, w, h); }
		else ctx.drawImage(img, -w / 2, -h / 2, w, h);
		ctx.restore();
	}
	function preview(canvas, opts){
		opts = opts || {};
		const ctx = canvas.getContext('2d');
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		if(!Art.ready){ setTimeout(() => preview(canvas, opts), 120); return; }
		const who = { x: 0, y: 0, w: 38, h: 74, baseH: 56, facing: 1, flash: 0 };
		const style = opts.weapon || null;
		const grip = (style === 'sword' || style === 'greatsword' || style === 'hammer' || style === 'scythe' || style === 'glaive') ? -Math.PI : (style === 'spear' || style === 'staff' ? -0.25 : -0.5);
		const roll = (style === 'spear' || style === 'staff' || style === 'glaive' || style === 'whip' || style === 'chain' || style === 'gauntlets') ? 0 : (style === 'daggers' ? Math.PI / 2 : -Math.PI / 2);
		const swing = style ? { arm: grip - roll, armB: 0.3, ext: 0, roll } : null;
		const vp = scaleFor(who);
		const k = canvas.height * 0.6 / (80 * vp);
		ctx.save();
		ctx.translate(canvas.width / 2 - 19 * k, canvas.height * 0.86 - 74 * k);
		ctx.scale(k, k);
		draw(ctx, 0, 0, who, { lean:0.02, head:0, hat:0, armF:0.4, armB:0.3, legF:0, legB:0, shift:0, crouch:0 },
			{ state:'idle', grounded:true, frame: opts.frame || 0, weapon: style, swing: null, rest: !!style, spellHand: !style, tint: opts.tint || null });
		ctx.restore();
	}

	load();
	root.PlayerRig = { META, draw, solve, weaponIcon, preview, isReady: () => Art.ready, scaleFor, dirOf, angOf };
})(typeof window !== 'undefined' ? window : globalThis);
