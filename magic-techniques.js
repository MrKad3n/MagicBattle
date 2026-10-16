/*
 * MAGIC TECHNIQUES — the first six magical laws, plus the dev test set.
 * -------------------------------------------------------------------------
 * A technique is a PROPERTY of energy, not an attack. Each one below only
 * registers data + behaviour hooks with MagicEngine.Techniques; the engine
 * runs them generically (see the TECHNIQUE FRAMEWORK comment in
 * magic-engine.js for the interface). Adding a technique = add one entry.
 *
 * Signed intensity s: positive = the technique, negative = its reverse.
 * P = power of the energy carrying it (amount × density). Effects always scale
 * with the energy actually present, so Split / Divide divide them too.
 */
(function(root){
	'use strict';
	const ME = root.MagicEngine;
	if(!ME || !ME.Techniques) return;
	const TQ = ME.Techniques;
	const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
	const hexA = ME.hexA;
	const TC = (h) => ME.tintHex ? ME.tintHex(h) : h;      // a technique's fixed colours, mapped onto a Colour-rune tint while it is drawn
	const TAU = Math.PI * 2;

	/* ------------------------------------------------------------------
	   BALANCE — every number a designer might tune lives here.
	   ------------------------------------------------------------------ */
	const BAL = {
		thermal: { strength: 1, hitBonus: 0.25, burnPerPower: 0.06, burnTime: 2.5, chillPerS: 0.45, freezeAt: 1.6, chillTime: 2.2,
			fieldBurn: 0.035, fieldChill: 0.35, transfer: 0.18, radiateRange: 90 },
		spatial: { strength: 1, rangeBase: 150, rangePerPower: 45, rangePerPoint: 0.35,
			portalRadiusBase: 16, portalRadiusPerRootE: 3.2, durBase: 1.5, durPerEnergy: 0.09, durMax: 15,
			creatureCost: 50, energyCostMul: 0.5, projectileCostMul: 1, minEnergy: 4, rearm: 0.6,
			surfaceLenBase: 40, surfaceLenPerRootE: 9, surfaceThick: 7, restitution: 0.85,
			storeToForm: 500 },      // stored Spatial energy (drawn from a Spatial Infinity source or a Spatial zone) opens its portal at this much
		// pulls: first tuning 0.55 / 0.22 / 0.16 / 0.6 / 0.18, then +15%, ×1.5, ×2 (now 3.45× the first)
		gravity: { strength: 1, rangeBase: 70, rangePerS: 60, pullEnemy: 1.898, enemyPullMul: 0.4, enemyPullMax: 0.9, infEnemyMul: 3, infEnemyMax: 4, infRange: 1.35, crushEvery: 0.25, pullEnergy: 0.759, pullProjectile: 0.552, focusSteer: 0.05, linkPull: 2.07, fieldMul: 1.4, foreignWeight: 0.621,
			bendGuided: 0.6,            // how much of the pull also bends energy that is flying a set course (Redirect)
			repelFar: 0.2, repelNear: 1.7, repelCaster: 0.55,   // reverse: a slight push at the edge that grows steeply as you get closer
			mergeReach: 0.75 },         // gravity energy touching gravity energy of the same sign becomes one
		kinetic: { strength: 1, accel: 0.22, maxSpeedMul: 1.55, brake: 0.06, impactPerS: 0.35, knockPerS: 5, shockRadius: 70, fieldPush: 0.35, fieldDamp: 0.03, foreignMul: 0.3 },
		antimagic: { strength: 1, rate: 160, ratePerS: 80, zonePush: 0.55, zoneCost: 2, hitMagical: 1.15, hitPlain: 0.55, fieldRate: 10, fieldRatePerS: 8, auraRate: 20, auraRatePerS: 15 },
		light:   { strength: 1, maxBounces: 3, speedMul: 0.6, dmgPerS: 0.15, pierceAt: 0.5, pierceCost: 0.18, reflectAt: 0.4, dazzleTime: 1.3, absorb: 0.01, lightRadius: 70 },
	};

	/* ------------------------------------------------------------------ helpers */
	function speedOf(b){ return Math.hypot(b.vx, b.vy); }
	function towards(ax, ay, bx, by){ const dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy) || 0.0001; return { x: dx / d, y: dy / d, d }; }
	function powerK(P){ return clamp(P / 20, 0.3, 3); }
	/* gravity falloff over u = 1 − distance / range: attraction is linear; repulsion is slight far away and steep up close */
	function gravFall(u, G){ return G > 0 ? u : BAL.gravity.repelFar * u + BAL.gravity.repelNear * u * u * u; }
	function gravityEnergy(b){ const d = ME.dominantTech(b); return d && d.id === 'gravity' ? d.s : 0; }
	/* screen-space lens: copies what is already drawn under (x,y) and redraws it scaled —
	   k < 1 magnifies / stretches space, k > 1 pinches it. Limited per frame for cost. */
	const LENS = { t: -1, n: 0 };
	function lens(ctx, x, y, r, k, ox, oy, alpha){
		if(LENS.n++ > 6 || r < 4 || typeof ctx.getTransform !== 'function') return;
		const m = ctx.getTransform();
		const sc = Math.hypot(m.a, m.b) || 1;
		const X = m.a * x + m.c * y + m.e, Y = m.b * x + m.d * y + m.f;
		const sr = r * sc * k;
		ctx.save();
		ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
		ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = alpha == null ? 0.85 : alpha;
		try { ctx.drawImage(ctx.canvas, X - sr + (ox || 0) * sc, Y - sr + (oy || 0) * sc, sr * 2, sr * 2, x - r, y - r, r * 2, r * 2); } catch(e){}
		ctx.restore();
	}
	function lensFrame(t){ if(t !== LENS.t){ LENS.t = t; LENS.n = 0; } }
	function softDisc(ctx, x, y, r, inner, outer, comp){
		const g = ctx.createRadialGradient(x, y, 0, x, y, r);
		g.addColorStop(0, inner); g.addColorStop(1, outer);
		ctx.globalCompositeOperation = comp || 'lighter';
		ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
	}
	function strand(ctx, x0, y0, x1, y1, sag, wob, t){
		const mx = (x0 + x1) / 2, my = (y0 + y1) / 2 + sag;
		const nx = -(y1 - y0), ny = x1 - x0, nl = Math.hypot(nx, ny) || 1;
		const w = Math.sin(t * 7) * wob;
		ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(mx + nx / nl * w, my + ny / nl * w, x1, y1); ctx.stroke();
	}
	function enemiesNear(T, x, y, r){
		const out = [];
		for(const e of T.enemies){ if(!e || e.dead) continue; const c = T.center(e); const dx = c.x - x, dy = c.y - y; if(dx * dx + dy * dy <= r * r) out.push(e); }
		return out;
	}
	/* constructs (Construction): creatures touching one, and its boxes on screen for overlays */
	function touchingConstruct(T, c, pad){
		const out = [];
		for(const e of T.enemies){ if(!e || e.dead) continue; const r = T.rect(e); if(r && T.constructRect(c, r.x - pad, r.y - pad, r.w + pad * 2, r.h + pad * 2)) out.push(e); }
		return out;
	}
	function partPath(ctx, P, grow){
		ctx.beginPath();
		for(const o of P){
			const hw = o.hw + (grow || 0), hh = o.hh + (grow || 0), ux = o.ux, uy = o.uy;
			ctx.moveTo(o.x + ux * hw - uy * hh, o.y + uy * hw + ux * hh); ctx.lineTo(o.x - ux * hw - uy * hh, o.y - uy * hw + ux * hh);
			ctx.lineTo(o.x - ux * hw + uy * hh, o.y - uy * hw - ux * hh); ctx.lineTo(o.x + ux * hw + uy * hh, o.y + uy * hw - ux * hh); ctx.closePath();
		}
	}
	function topEdgePts(P, n){
		const out = [];
		for(const o of P){ const ex = Math.abs(o.ux) * o.hw + Math.abs(o.uy) * o.hh, ey = Math.abs(o.uy) * o.hw + Math.abs(o.ux) * o.hh; for(let i = 0; i < n; i++) out.push([o.x - ex + (i + 0.5) / n * ex * 2, o.y - ey]); }
		return out;
	}

	/* gravity on constructs: pull (G > 0) or push (G < 0) every construct in range; heavier ones move less, and an anchored one
	   is torn loose when the pull beats its hold (see the engine's pryConstruct) */
	function gravityOnConstructs(T, x, y, range, a, P, G, inst){
		if(!T.constructsNear) return;
		const B = BAL.gravity;
		for(const c of T.constructsNear(x, y, range)){
			const v = towards(c.x, c.y, x, y); if(v.d > range || v.d < 4) continue;
			const fall = gravFall(1 - v.d / range, G);
			const F = B.pullEnergy * a * P * fall * 1.6;                     // the strength of the pull at the construct
			if(!T.constructMovable(c) && !T.pryConstruct(c, F, T.dt)) continue;
			const k = F * T.f * G * 0.45 / Math.sqrt(Math.max(1, c.mass) / 40);
			T.pushConstruct(c, v.x * k, v.y * k);
			if(G > 0){ const dmp = Math.pow(1 - 0.06 * fall, T.f); c.vx *= dmp; c.vy *= dmp; }      // drawn in, it settles at the well instead of flying through
		}
	}
	/* thermal energy's own body: a living flame, or (reversed) a snowflake */
	function flamePath(ctx, w, h, ph, wob){
		const tipX = Math.sin(ph * 1.3) * w * 0.35 * wob;
		ctx.beginPath();
		ctx.moveTo(0, w * 0.75);
		ctx.bezierCurveTo(w * 1.05, w * 0.7, w * (0.95 + 0.12 * Math.sin(ph * 2.1)), -h * 0.25, tipX * 0.5 + w * 0.2, -h * 0.62);
		ctx.quadraticCurveTo(tipX + w * 0.1, -h * 0.85, tipX, -h);
		ctx.quadraticCurveTo(tipX - w * 0.25, -h * 0.75, -w * 0.25 + tipX * 0.4, -h * 0.55);
		ctx.bezierCurveTo(-w * (0.95 + 0.12 * Math.sin(ph * 1.7 + 1)), -h * 0.2, -w * 1.05, w * 0.7, 0, w * 0.75);
		ctx.closePath();
	}
	function drawFlame(ctx, b, x, y, R, s, t, alpha){
		const k = Math.min(1.6, Math.abs(s)), sp = Math.hypot(b.vx, b.vy);
		// flames rise; moving fast they stream back behind the energy
		const up = -Math.PI / 2, back = Math.atan2(-b.vy, -b.vx), m = clamp(sp / 8, 0, 0.85);
		let ang = up;
		if(sp > 0.3){ let d = back - up; while(d > Math.PI) d -= TAU; while(d < -Math.PI) d += TAU; ang = up + d * m; }
		const ph = t * 9 + b.seed;
		const w = R * 0.95, h = R * (2.3 + 0.35 * k + 0.12 * Math.sin(ph * 1.9));
		softDisc(ctx, x, y, R * 2.4, hexA('#ff6a1a', 0.32 * alpha), hexA('#ff2a00', 0));
		ctx.save();
		ctx.translate(x, y); ctx.rotate(ang + Math.PI / 2);
		ctx.globalCompositeOperation = 'lighter';
		ctx.globalAlpha = 0.8 * alpha; ctx.fillStyle = TC('#d8340f'); flamePath(ctx, w * 1.15, h * 1.08, ph, 1); ctx.fill();
		ctx.globalAlpha = 0.85 * alpha; ctx.fillStyle = TC('#ff7a1c'); flamePath(ctx, w * 0.9, h * 0.86, ph + 0.8, 1.2); ctx.fill();
		ctx.globalAlpha = 0.9 * alpha; ctx.fillStyle = TC('#ffc23d'); flamePath(ctx, w * 0.6, h * 0.6, ph + 1.7, 1.4); ctx.fill();
		ctx.globalAlpha = 0.95 * alpha; ctx.fillStyle = TC('#fff3c4');
		ctx.beginPath(); ctx.ellipse(0, w * 0.15, w * 0.32, w * 0.42, 0, 0, TAU); ctx.fill();
		// side tongues that flick up and vanish
		for(let i = 0; i < 2; i++){
			const q = (t * 2.2 + i * 0.5 + b.seed) % 1, sx = (i ? 1 : -1) * w * 0.7;
			ctx.globalAlpha = 0.7 * alpha * (1 - q);
			ctx.fillStyle = i ? TC('#ffb347') : TC('#ff8a3d');
			ctx.save(); ctx.translate(sx * (1 - q * 0.3), -h * 0.15 - q * h * 0.5); flamePath(ctx, w * 0.25 * (1 - q * 0.5), h * 0.3, ph + i * 3, 1); ctx.fill(); ctx.restore();
		}
		ctx.restore();
	}
	function drawSnowflake(ctx, b, x, y, R, s, t, alpha){
		const k = Math.min(1.6, Math.abs(s)), L = R * (1.35 + 0.15 * k), rot = t * 0.4 + b.seed;
		softDisc(ctx, x, y, R * 2.3, hexA('#bfefff', 0.3 * alpha), hexA('#3d7fd6', 0));
		ctx.save();
		ctx.translate(x, y); ctx.rotate(rot);
		ctx.globalCompositeOperation = 'lighter';
		ctx.lineCap = 'round';
		for(let pass = 0; pass < 2; pass++){
			ctx.globalAlpha = (pass ? 0.95 : 0.35) * alpha;
			ctx.strokeStyle = pass ? TC('#f4fdff') : TC('#8fd8ff');
			ctx.lineWidth = Math.max(1, R * (pass ? 0.11 : 0.28));
			ctx.beginPath();
			for(let i = 0; i < 6; i++){
				const a = i / 6 * TAU, ca = Math.cos(a), sa = Math.sin(a);
				ctx.moveTo(0, 0); ctx.lineTo(ca * L, sa * L);
				for(const f of [0.42, 0.7]){                          // branches
					const bx = ca * L * f, by = sa * L * f, bl = L * (f < 0.5 ? 0.32 : 0.22);
					for(const sd of [-1, 1]){ const b2 = a + sd * 0.75; ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(b2) * bl, by + Math.sin(b2) * bl); }
				}
			}
			ctx.stroke();
		}
		ctx.globalAlpha = 0.9 * alpha; ctx.fillStyle = TC('#e8fbff');
		ctx.beginPath();
		for(let i = 0; i < 6; i++){ const a = i / 6 * TAU; const px = Math.cos(a) * R * 0.26, py = Math.sin(a) * R * 0.26; if(i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
		ctx.closePath(); ctx.fill();
		// a glint running around the tips
		const g = (t * 1.5 + b.seed) % 6 | 0, ga = g / 6 * TAU;
		ctx.globalAlpha = 0.8 * alpha * (0.5 + 0.5 * Math.sin(t * 8));
		ctx.fillStyle = TC('#ffffff'); ctx.beginPath(); ctx.arc(Math.cos(ga) * L, Math.sin(ga) * L, Math.max(1.2, R * 0.12), 0, TAU); ctx.fill();
		ctx.restore();
	}

	/* thermal energy pressed into a shape: the shape stays, made of fire or of ice */
	function shapeLayer(ctx, pts, N, cx, cy, k){
		ctx.beginPath();
		for(let i = 0; i < N; i++){ const px = cx + (pts[i * 2] - cx) * k, py = cy + (pts[i * 2 + 1] - cy) * k; if(i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
		ctx.closePath();
	}
	function flameDir(b){
		const sp = Math.hypot(b.vx, b.vy), up = -Math.PI / 2;
		if(sp <= 0.3) return up;
		const back = Math.atan2(-b.vy, -b.vx), m = clamp(sp / 8, 0, 0.85);
		let d = back - up; while(d > Math.PI) d -= TAU; while(d < -Math.PI) d += TAU;
		return up + d * m;
	}
	function drawFlameShape(ctx, b, x, y, R, s, t, alpha){
		const pts = ME.outline(b, x, y, R, t), N = ME.N_PTS;
		const ph = t * 9 + b.seed, ang = flameDir(b), ux = Math.cos(ang), uy = Math.sin(ang);
		softDisc(ctx, x, y, R * 2.6, hexA('#ff6a1a', 0.3 * alpha), hexA('#ff2a00', 0));
		ctx.save();
		ctx.globalCompositeOperation = 'lighter';
		const fl = 0.04 * Math.sin(ph * 1.7);
		ctx.globalAlpha = 0.75 * alpha; ctx.fillStyle = TC('#d8340f'); shapeLayer(ctx, pts, N, x, y, 1.08 + fl); ctx.fill();
		ctx.globalAlpha = 0.85 * alpha; ctx.fillStyle = TC('#ff7a1c'); shapeLayer(ctx, pts, N, x, y, 0.86 - fl); ctx.fill();
		ctx.globalAlpha = 0.9 * alpha; ctx.fillStyle = TC('#ffc23d'); shapeLayer(ctx, pts, N, x, y, 0.6 + fl); ctx.fill();
		ctx.globalAlpha = 0.95 * alpha; ctx.fillStyle = TC('#fff3c4'); shapeLayer(ctx, pts, N, x, y, 0.3); ctx.fill();
		// tongues of fire licking off the side the flames stream toward
		for(let i = 0; i < N; i += 3){
			const px = pts[i * 2], py = pts[i * 2 + 1];
			let nx = px - x, ny = py - y; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
			const d = nx * ux + ny * uy;
			if(d < 0.15) continue;
			const q = 0.6 + 0.4 * Math.sin(ph * 1.3 + i * 1.7);
			ctx.globalAlpha = alpha * d * q * 0.85;
			ctx.fillStyle = i % 2 ? TC('#ffb347') : TC('#ff7a1c');
			ctx.save(); ctx.translate(px, py); ctx.rotate(ang + Math.PI / 2);
			flamePath(ctx, R * 0.16, R * (0.5 + 0.5 * q) * (0.6 + 0.4 * d), ph + i, 1.3); ctx.fill();
			ctx.restore();
		}
		ctx.restore();
	}
	function drawFrostShape(ctx, b, x, y, R, s, t, alpha){
		const pts = ME.outline(b, x, y, R, t), N = ME.N_PTS;
		softDisc(ctx, x, y, R * 2.4, hexA('#bfefff', 0.28 * alpha), hexA('#3d7fd6', 0));
		ctx.save();
		ctx.globalCompositeOperation = 'lighter';
		ctx.globalAlpha = 0.45 * alpha; ctx.fillStyle = TC('#5aa9e6'); shapeLayer(ctx, pts, N, x, y, 1); ctx.fill();
		ctx.globalAlpha = 0.5 * alpha; ctx.fillStyle = TC('#bfefff'); shapeLayer(ctx, pts, N, x, y, 0.82); ctx.fill();
		// ice facets from the heart to the edge
		ctx.globalAlpha = 0.35 * alpha; ctx.strokeStyle = TC('#ffffff'); ctx.lineWidth = 1;
		ctx.beginPath();
		for(let i = 0; i < N; i += 8){ ctx.moveTo(x, y); ctx.lineTo(pts[i * 2], pts[i * 2 + 1]); }
		ctx.stroke();
		ctx.globalAlpha = 0.95 * alpha; ctx.strokeStyle = TC('#f4fdff'); ctx.lineWidth = 1.5;
		shapeLayer(ctx, pts, N, x, y, 1); ctx.stroke();
		// frost crystals growing on the edge
		ctx.lineWidth = 1; ctx.strokeStyle = TC('#e8fbff');
		for(let i = 0; i < N; i += 5){
			const px = pts[i * 2], py = pts[i * 2 + 1], L = R * (0.1 + 0.05 * Math.sin(t * 3 + i)), rot = i + t * 0.3;
			ctx.globalAlpha = 0.85 * alpha;
			ctx.beginPath();
			for(let j = 0; j < 3; j++){ const a = rot + j / 3 * Math.PI; ctx.moveTo(px - Math.cos(a) * L, py - Math.sin(a) * L); ctx.lineTo(px + Math.cos(a) * L, py + Math.sin(a) * L); }
			ctx.stroke();
		}
		ctx.restore();
		drawSnowflake(ctx, b, x, y, R * 0.6, s, t, alpha * 0.95);
	}

	/* ==================================================================
	   THERMAL — heat and its removal
	   ================================================================== */
	TQ.register({
		id: 'thermal', combines: true, name: 'Thermal', reversedName: 'Reverse Thermal (cooling)', antiResist: 1,
		description: 'Manipulates heat. Raises or removes the thermal energy of whatever the energy touches or surrounds.',
		color: '#ff8a3d', reversedColor: '#8fe3ff',
		palette: { core: '#fff4e0', mid: '#ff8a3d', outer: '#c2361b' },
		reversePalette: { core: '#ffffff', mid: '#8fe3ff', outer: '#3d7fd6' },
		balance: BAL.thermal,
		/* Construction: Thermal energy scorches a construct (reverse: makes it brittle); a construct made of Thermal energy burns
		   (reverse: chills) whatever touches it */
		onConstruct(T, b, s, c, info){ if(s > 0) info.dmg *= 1 + 0.25 * Math.min(2, s); else { c.brittle = T.time + 2 + Math.abs(s); info.dmg *= 0.8; } },
		constructTick(T, c, s, dt){
			if(!T.every(c, 'thermalTouch', 0.5)) return;
			for(const e of touchingConstruct(T, c, 4)) this.constructTouch(T, c, s, e);
			if(s > 0) T.light(c.x, c.y, c.geo.R * 1.6, [255, 150, 70], 0.35);
		},
		constructTouch(T, c, s, e){
			const B = BAL.thermal;
			if(s > 0) T.status(e, 'burn', Math.max(1, c.material * 0.02 * Math.min(2, s)), B.burnTime);
			else T.status(e, 'chill', Math.min(1.2, B.chillPerS * Math.abs(s)), B.chillTime);
		},
		drawConstruct(ctx, c, s, x, y, t, P, outline){
			ctx.globalCompositeOperation = 'lighter';
			if(s > 0){
				for(const q of topEdgePts(P, 4)){
					const ph = t * 8 + q[0] * 0.07, h = 6 + 5 * Math.abs(Math.sin(ph));
					ctx.globalAlpha = 0.55; ctx.fillStyle = TC('#ff7a1c');
					ctx.save(); ctx.translate(q[0], q[1]); flamePath(ctx, 4, h, ph, 1); ctx.fill(); ctx.restore();
				}
				ctx.globalAlpha = 0.25 + 0.1 * Math.sin(t * 6); ctx.strokeStyle = TC('#ffb347'); ctx.lineWidth = 3; (outline ? outline(ctx, 1) : partPath(ctx, P, 1)); ctx.stroke();
			} else {
				ctx.globalAlpha = 0.5; ctx.strokeStyle = TC('#e8fbff'); ctx.lineWidth = 2; (outline ? outline(ctx, 1) : partPath(ctx, P, 1)); ctx.stroke();
				ctx.globalAlpha = 0.18; ctx.fillStyle = TC('#bfefff'); (outline ? outline(ctx, 0) : partPath(ctx, P, 0)); ctx.fill('evenodd');
			}
		},
		targets: { energy: true, zone: true, spell: true, environment: true, surface: true, enemy: true, self: false, ally: false },
		/* a Thermal zone: enemies inside take a steady trickle of heat damage and Thermal attacks hit harder there.
		   Reversed: enemies inside are slowed, and enough reverse Thermal hits inside freeze them in place. */
		zoneInfo: (rev) => rev ? 'enemies inside are slowed; reverse Thermal hits inside build frost until they freeze' : 'enemies inside take steady heat damage; Thermal attacks inside hit harder',
		zone(T, Z, s, dt){
			const k = Z.k;
			for(const e of T.zoneCreatures(Z)){
				if(!T.isEnemy(e)) continue;
				const c = T.center(e);
				if(s > 0){ if(T.every(e, 'thermZone', 0.25)) T.damage(e, 0.6 + 2.2 * k, { x: c.x, y: c.y - 10, color: '#ff8a3d' }, Z.z); }
				else if(T.every(e, 'frostZone', 0.3)) T.status(e, 'chill', Math.min(0.9, 0.35 + 0.4 * k), 0.45);
			}
			if(Math.random() < Z.r * 0.0006 * k * T.f * 6){
				const a = Math.random() * TAU, rr = Math.sqrt(Math.random()) * Z.r;
				if(s > 0) T.spark(Z.x + Math.cos(a) * rr, Z.y + Math.sin(a) * rr, (Math.random() - 0.5) * 0.4, -0.6 - Math.random() * 0.6, Math.random() < 0.5 ? TC('#ffb347') : TC('#ff6a2a'), 30);
				else T.spark(Z.x + Math.cos(a) * rr, Z.y + Math.sin(a) * rr, (Math.random() - 0.5) * 0.3, 0.2 + Math.random() * 0.3, TC('#dff7ff'), 36, 1.2);
			}
		},
		targetNotes: { self: 'use Reinforcement to apply thermal energy to yourself', ally: 'use Reinforcement to apply thermal energy to an ally' },
		spriteDir: true,      // crowd stamps: a flame trails behind its motion (8 directions)
		/* thermal energy looks like what it is: loose it is a flame / snowflake; compressed it keeps its shape, made of fire / ice */
		drawBody(ctx, b, x, y, R, s, t, alpha){
			const shaped = ME.curForm(b) > 0.12;
			if(shaped){ if(s > 0) drawFlameShape(ctx, b, x, y, R, s, t, alpha); else drawFrostShape(ctx, b, x, y, R, s, t, alpha); }
			else if(s > 0) drawFlame(ctx, b, x, y, R, s, t, alpha); else drawSnowflake(ctx, b, x, y, R, s, t, alpha);
			b._thermalBodyT = t;
			return true;
		},
		tick(T, b, s){
			const B = BAL.thermal, R = T.radius(b);
			// heat throws embers up; cold sheds frost that sinks
			if(Math.random() < 0.25 * Math.min(2, Math.abs(s)) * T.f){
				const a = Math.random() * TAU;
				if(s > 0) T.spark(b.x + Math.cos(a) * R * 0.7, b.y + Math.sin(a) * R * 0.7, (Math.random() - 0.5) * 0.6, -0.8 - Math.random(), Math.random() < 0.5 ? TC('#ffb347') : TC('#ff6a2a'), 26);
				else T.spark(b.x + Math.cos(a) * R * 0.8, b.y + Math.sin(a) * R * 0.8, (Math.random() - 0.5) * 0.4, 0.3 + Math.random() * 0.4, TC('#dff7ff'), 30, 1.2);
			}
			// focused on a creature: radiant heat / cold reaches it at close range
			const e = b.focus && b.focus.kind === 'enemy' ? T.focusEnt(b) : null;
			if(e){
				const c = T.center(e);
				if(Math.hypot(c.x - b.x, c.y - b.y) < B.radiateRange + R && T.every(b, 'rad', 0.6)){
					if(s > 0) T.status(e, 'burn', T.power(b) * B.burnPerPower * s * 0.4, 1.2);
					else T.status(e, 'chill', Math.min(1.2, B.chillPerS * -s * 0.6), 1.2);
				}
			}
		},
		onHit(T, b, s, e, info){
			const B = BAL.thermal, P = T.power(b), c = T.center(e), law = T.zoneLaw ? T.zoneLaw(c.x, c.y, 'thermal') : 0;
			if(s > 0){
				info.mult *= 1 + B.hitBonus * Math.min(2, s);
				if(law > 0) info.mult *= 1 + 0.6 * law;       // inside a Thermal zone heat hits harder
				T.status(e, 'burn', P * B.burnPerPower * s, B.burnTime + s);
			} else {
				const m = Math.min(1.5, B.chillPerS * -s * powerK(P));
				T.status(e, 'chill', -s >= B.freezeAt ? Math.max(1, m) : m, B.chillTime + -s * 0.6);
				if(law < 0){
					// inside a reverse Thermal zone the cold builds up: enough of it and the creature freezes solid
					const now = T.time;
					e._frost = (e._frostUntil > now ? (e._frost || 0) : 0) + Math.min(2, -s) * (0.6 + 0.4 * powerK(P));
					e._frostUntil = now + 3;
					if(e._frost >= 2.4 / (0.6 + 0.6 * -law)){
						e._frost = 0;
						T.status(e, 'chill', 1.2, 1.4 + 1.2 * -law);
						T.ring(c.x, c.y, 6, 46, 22, TC('#dff7ff'));
						for(let i = 0; i < 12; i++){ const a = i / 12 * TAU; T.spark(c.x + Math.cos(a) * 10, c.y + Math.sin(a) * 10, Math.cos(a) * 1.4, Math.sin(a) * 1.4, TC('#e8fbff'), 26, 1.6); }
					}
				}
			}
		},
		field(T, src, s){
			const B = BAL.thermal;
			for(const e of enemiesNear(T, src.x, src.y, src.r)){
				if(!T.every(e, 'thermField' + src.body.id, 0.5)) continue;
				if(s > 0) T.status(e, 'burn', src.P * B.fieldBurn * s, 1.2);
				else T.status(e, 'chill', Math.min(1.2, B.fieldChill * -s), 1.1);
			}
			// heat transfer: energy inside the field drifts toward the field's temperature
			for(const o of T.nearBodies(src.x, src.y, src.r, src.body)){
				if(o.zoneBlob) continue;
				const od = ME.dominantTech(o); if(od && od.id !== 'thermal') continue;      // techniques don't stack: other technique energy is left alone
				const cur = ME.techOf(o, 'thermal');
				if(Math.abs(cur) < Math.abs(s) || Math.sign(cur) !== Math.sign(s)) ME.addTech(o, 'thermal', Math.sign(s) * B.transfer * T.dt);
			}
		},
		onForeign(T, ref, s){
			// a projectile can be heated or cooled; it is changed, never removed
			if(s > 0){ if(ref.dmg != null) ref.dmg *= 1 + 0.1 * s; ref._magicHeat = s; }
			else { if(ref.dmg != null) ref.dmg *= Math.max(0.4, 1 - 0.25 * -s); ref.vx = (ref.vx || 0) * 0.8; ref.vy = (ref.vy || 0) * 0.8; ref._magicCold = -s; }
		},
		onCancel(T, a, c){
			const x = (a.x + c.x) / 2, y = (a.y + c.y) / 2;
			for(let i = 0; i < 10; i++) T.spark(x + (Math.random() - 0.5) * 16, y, (Math.random() - 0.5) * 0.8, -0.6 - Math.random() * 1.2, TC('#e8eef2'), 34, 2.2);
			T.ring(x, y, 6, 30, 18, TC('#dfe9ee'));
		},
		draw(ctx, b, x, y, R, s, t, lod){
			if(b._thermalBodyT === t) return;          // already drawn as a flame / snowflake
			const k = Math.min(1.5, Math.abs(s));
			ctx.globalCompositeOperation = 'lighter';
			if(s > 0){
				softDisc(ctx, x, y, R * (1.9 + 0.3 * k), hexA('#ff7a2a', 0.22 * k), hexA('#ff3a10', 0));
				if(lod) return;
				ctx.strokeStyle = hexA('#ffb070', 0.35); ctx.lineWidth = 1.2;
				for(let i = 0; i < 3; i++){   // heat shimmer rising off it
					const ox = (i - 1) * R * 0.45, ph = t * 3 + i * 1.3 + b.seed;
					ctx.beginPath();
					for(let j = 0; j <= 8; j++){ const u = j / 8; const yy = y - R * 0.6 - u * R * (1.4 + 0.4 * k); const xx = x + ox + Math.sin(ph + u * 6) * 3 * (1 - u * 0.4); if(j) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy); }
					ctx.stroke();
				}
			} else {
				softDisc(ctx, x, y, R * (2 + 0.3 * k), hexA('#aeeaff', 0.2 * k), hexA('#3d7fd6', 0));
				if(lod) return;
				ctx.strokeStyle = hexA('#f2fdff', 0.75); ctx.lineWidth = 1.1;
				const n = 6;
				for(let i = 0; i < n; i++){   // ice crystals around the rim
					const a = i / n * TAU + b.seed + t * 0.2, r0 = R * 0.95, L = R * (0.35 + 0.15 * k);
					const cx = x + Math.cos(a) * r0, cy = y + Math.sin(a) * r0;
					ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * L, cy + Math.sin(a) * L);
					ctx.moveTo(cx + Math.cos(a) * L * 0.55, cy + Math.sin(a) * L * 0.55); ctx.lineTo(cx + Math.cos(a + 0.6) * L * 0.85, cy + Math.sin(a + 0.6) * L * 0.85);
					ctx.moveTo(cx + Math.cos(a) * L * 0.55, cy + Math.sin(a) * L * 0.55); ctx.lineTo(cx + Math.cos(a - 0.6) * L * 0.85, cy + Math.sin(a - 0.6) * L * 0.85);
					ctx.stroke();
				}
			}
		},
		drawField(ctx, src, x, y, s, t){
			const r = src.r, k = Math.min(1, Math.abs(s));
			if(s > 0){
				softDisc(ctx, x, y, r, hexA('#ff7a2a', 0.13 * k), hexA('#ff3a10', 0));
				ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = hexA('#ffb070', 0.18); ctx.lineWidth = 1.2;
				for(let i = 0; i < 7; i++){
					const ox = ((i / 7) * 2 - 1) * r * 0.8, ph = t * 2 + i;
					const base = y + Math.sqrt(Math.max(0, r * r - ox * ox)) * 0.6;
					ctx.beginPath();
					for(let j = 0; j <= 10; j++){ const u = j / 10; const yy = base - u * r * 1.1; const xx = x + ox + Math.sin(ph + u * 7) * 4; if(j) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy); }
					ctx.stroke();
				}
			} else {
				softDisc(ctx, x, y, r, hexA('#bfefff', 0.14 * k), hexA('#3d7fd6', 0));
				ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = hexA('#f2fdff', 0.6);
				for(let i = 0; i < 18; i++){
					const a = i * 2.39996 + src.body.seed, rr = r * Math.sqrt(((i * 0.618) % 1));
					const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr + ((t * 14 + i * 9) % 20) - 10;
					ctx.fillRect(px - 1, py - 1, 2, 2);
				}
			}
		},
		reinforce: {
			self:   { normal: { elementResist: 0.4, meleeDamage: 0.08 }, reverse: { elementResist: 0.5, stability: 0.08 } },
			ally:   { normal: { elementResist: 0.4 }, reverse: { elementResist: 0.5 } },
			weapon: { normal: { burnOnHit: 0.8 }, reverse: { chillOnHit: 0.8 } },
			spell:  { normal: { spellImpact: 0.25 }, reverse: { spellStability: 0.2 } }
		},
		onReinforcedHit(T, st, s, e){
			const k = st.strength * Math.abs(s);
			if(s > 0) T.status(e, 'burn', 2 + 7 * k, 2.4);
			else T.status(e, 'chill', Math.min(1, 0.2 + 0.6 * k), 2);
		},
		drawReinforce(ctx, st, s, g, t){
			ctx.globalCompositeOperation = 'lighter';
			const col = s > 0 ? TC('#ffb070') : TC('#e8fbff'), k = st.strength;
			if(g.kind === 'weapon'){
				const n = 5;
				for(let i = 0; i < n; i++){
					const u = ((t * 0.9 + i / n) % 1), px = g.x0 + (g.x1 - g.x0) * u, py = g.y0 + (g.y1 - g.y0) * u;
					ctx.globalAlpha = 0.6 * k; ctx.fillStyle = col;
					const yy = py - (s > 0 ? 1 : -1) * ((t * 20 + i * 7) % 10);
					ctx.fillRect(px - 1, yy - 1, 2, 2);
				}
			} else if(g.w){
				ctx.globalAlpha = 0.35 * k; ctx.strokeStyle = col; ctx.lineWidth = 1;
				for(let i = 0; i < 3; i++){
					const xx = g.x + g.w * (0.25 + 0.25 * i), ph = t * 3 + i;
					ctx.beginPath();
					for(let j = 0; j <= 6; j++){ const u = j / 6; const yy = g.y - u * 18 * (s > 0 ? 1 : -1) + (s > 0 ? 0 : g.h); const x2 = xx + Math.sin(ph + u * 6) * 2; if(j) ctx.lineTo(x2, yy); else ctx.moveTo(x2, yy); }
					ctx.stroke();
				}
			}
		}
	});

	/* ==================================================================
	   SPATIAL — space itself. Spatial energy stops being a projectile:
	   positive power opens a PORTAL (entrance where the energy is, exit
	   where you choose); negative power makes a SURFACE things bounce off.
	   Either way it can no longer be moved and no longer strikes anything.
	   More energy → a bigger form that lasts longer (portals cap at 15 s).
	   ================================================================== */
	const SPATIAL_DEST = [
		{ value: 'mouse', label: 'Cursor' }, { value: 'target', label: 'Current target' }, { value: 'caster', label: 'You' },
		{ value: 'forward', label: 'Ahead (its direction)' }, { value: 'up', label: 'Up' }, { value: 'down', label: 'Down' },
		{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }
	];
	const SPATIAL_PLACE = [
		{ value: 'here', label: 'Where the energy is' }, { value: 'mouse', label: 'Cursor' }, { value: 'caster', label: 'You' },
		{ value: 'up', label: 'Up' }, { value: 'down', label: 'Down' }, { value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }
	];
	const SPATIAL_ANGLE = [ { value: 'flat', label: 'Flat (floor)' }, { value: 'wall', label: 'Upright (wall)' }, { value: 'cursor', label: 'Facing the cursor' } ];
	const SPATIAL_OFFSET = { forward: 1, up: 1, down: 1, left: 1, right: 1 };
	const isRev = (p) => Number(p && p.power) < 0;
	function spatialRange(points, power){ const B = BAL.spatial; return B.rangeBase + B.rangePerPower * clamp(power, 1, 10) * (1 + B.rangePerPoint * Math.max(0, points)); }
	function portalRadius(E){ const B = BAL.spatial; return B.portalRadiusBase + B.portalRadiusPerRootE * Math.sqrt(Math.max(0, E)); }
	function formDuration(E){ const B = BAL.spatial; return Math.min(B.durMax, B.durBase + B.durPerEnergy * Math.max(0, E)); }
	function surfaceHalf(E){ const B = BAL.spatial; return (B.surfaceLenBase + B.surfaceLenPerRootE * Math.sqrt(Math.max(0, E))) / 2; }
	/* the last free point on the straight line from a → b (never inside a wall) */
	function freeLanding(T, ax, ay, bx, by){
		if(!T.solid(bx, by)) return { x: bx, y: by };
		const d = Math.hypot(bx - ax, by - ay), n = Math.max(2, Math.ceil(d / 8));
		for(let i = n - 1; i >= 0; i--){ const u = i / n, x = ax + (bx - ax) * u, y = ay + (by - ay) * u; if(!T.solid(x, y)) return { x, y }; }
		return { x: ax, y: ay };
	}
	function spatialPoint(T, ctx, from, b, which){
		const p = ctx.params, api = ctx.api;
		const dest = which === 'place' ? TQ.param(p, 'spatial', 'place', 'here') : TQ.param(p, 'spatial', 'dest', 'mouse');
		const D = TQ.param(p, 'spatial', 'dist', 200);
		switch(dest){
			case 'here': return { x: from.x, y: from.y };
			case 'mouse': return T.host().mouseWorld();
			case 'target': return api.targetPos(ctx.br);
			case 'caster': return api.casterPos();
			case 'up': return { x: from.x, y: from.y - D };
			case 'down': return { x: from.x, y: from.y + D };
			case 'left': return { x: from.x - D, y: from.y };
			case 'right': return { x: from.x + D, y: from.y };
			default: {
				const vx = b ? b.vx : 0, vy = b ? b.vy : 0, sp = Math.hypot(vx, vy);
				const f = api.owner.facing ? api.owner.facing() : 1;
				return sp > 0.2 ? { x: from.x + vx / sp * D, y: from.y + vy / sp * D } : { x: from.x + f * D, y: from.y };
			}
		}
	}
	function spatialClamp(from, to, range){
		const dx = to.x - from.x, dy = to.y - from.y, d = Math.hypot(dx, dy);
		if(d <= range) return { x: to.x, y: to.y, d };
		return { x: from.x + dx / d * range, y: from.y + dy / d * range, d: range };
	}
	function warpFx(T, x0, y0, x1, y1, col){
		col = col || TC('#c9a8ff');
		T.ring(x0, y0, 18, 2, 14, col);
		T.ring(x1, y1, 2, 30, 16, TC('#efe4ff'));
		for(let i = 0; i < 8; i++){
			const a = Math.random() * TAU, r = 10 + Math.random() * 12;
			T.spark(x0 + Math.cos(a) * r, y0 + Math.sin(a) * r, -Math.cos(a) * 0.9, -Math.sin(a) * 0.9, col, 14, 1.6);
			T.spark(x1, y1, Math.cos(a) * 1.6, Math.sin(a) * 1.6, TC('#efe4ff'), 16, 1.6);
		}
	}
	/* the surface's placement for a rune (shared by the enemy check and the actual placing) */
	function surfacePlacement(T, b, ctx){
		const from = { x: b.x, y: b.y };
		const want = spatialPoint(T, ctx, from, b, 'place') || from;
		const to = spatialClamp(from, want, spatialRange(ctx.points, ctx.power));
		const land = freeLanding(T, from.x, from.y, to.x, to.y);
		const mode = TQ.param(ctx.params, 'spatial', 'angle', 'flat');
		let ang = 0;
		if(mode === 'wall') ang = Math.PI / 2;
		else if(mode === 'cursor'){ const m = T.host().mouseWorld(); ang = Math.atan2(m.y - land.y, m.x - land.x) + Math.PI / 2; }
		return { x: land.x, y: land.y, ang };
	}
	function overlapsEnemy(T, x, y, half, ang){
		const ux = Math.cos(ang), uy = Math.sin(ang);
		for(const e of T.enemies){
			if(!e || e.dead) continue;
			const r = T.rect(e); if(!r) continue;
			for(let i = -4; i <= 4; i++){ const px = x + ux * half * i / 4, py = y + uy * half * i / 4; if(px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return true; }
		}
		return false;
	}
	/* closest point on a segment — for surface contact */
	function segHit(sp, cx, cy, px, py, rad){
		const ux = Math.cos(sp.ang), uy = Math.sin(sp.ang);
		const dx = px - cx, dy = py - cy;
		const along = clamp(dx * ux + dy * uy, -sp.half, sp.half);
		const qx = cx + ux * along, qy = cy + uy * along;
		let nx = px - qx, ny = py - qy; const d = Math.hypot(nx, ny);
		const reach = BAL.spatial.surfaceThick + rad;
		if(d >= reach) return null;
		if(d < 0.001){ nx = -uy; ny = ux; } else { nx /= d; ny /= d; }
		return { nx, ny, pen: reach - d };
	}
	function creaturesOf(T, b){
		const out = [];
		const me = T.caster(b); if(me) out.push(me);
		for(const e of T.enemies) if(e && !e.dead) out.push(e);
		for(const e of T.allies) if(e && !e.dead && out.indexOf(e) < 0) out.push(e);
		return out;
	}
	/* stored Spatial energy opens a one-way portal home: to the Spatial Infinity source(s) it came from, or to its zone */
	function formHomePortal(T, b){
		const ids = (b.infFromList || (b.infFrom ? [ b.infFrom ] : [])).filter(id => { const m = T.bodies().find(q => q.id === id && q.alive && q.infSource); return m && ME.techOf(m, 'spatial') > 0; });
		const B = BAL.spatial, dur = formDuration(b.amount);
		let x1 = b.x, y1 = b.y;
		if(ids.length){ const m = T.bodies().find(q => q.id === ids[0]); x1 = m.x; y1 = m.y; }
		else if(b.zoneHome){ const z = T.bodies().find(q => q.id === b.zoneHome.id && q.alive); x1 = z ? z.x : b.zoneHome.x; y1 = z ? z.y : b.zoneHome.y; }
		else return;
		b.vx = 0; b.vy = 0; b.anchored = true; b.immovable = false; b.noContact = true; b.keepEnergy = true; b.hideBody = true;
		b.spatial = { kind: 'portal', x1, y1, end: T.time + dur, born: T.time, cool: new Map(), flash: 1, r: portalRadius(b.amount), masters: ids.length ? ids : null, home: ids.length ? null : b.zoneHome };
		b.formRadius = b.spatial.r;
		T.remember(b, 'spatialHome');
		warpFx(T, b.x, b.y, x1, y1);
	}
	function homeExit(T, b, sp){
		if(sp.masters){ const m = T.bodies().find(q => sp.masters.indexOf(q.id) >= 0 && q.alive && q.infSource); if(m){ sp.x1 = m.x; sp.y1 = m.y; } else T.kill(b, 'leak'); }
		else if(sp.home){ const z = T.bodies().find(q => q.id === sp.home.id && q.alive); if(z){ sp.x1 = z.x; sp.y1 = z.y; } }
	}
	/* a Spatial Infinity source is the master portal: whatever enters it comes out of one of its portals, chosen at random */
	function masterTick(T, S){
		const kids = T.bodies().filter(o => o.alive && o.spatial && o.spatial.masters && o.spatial.masters.indexOf(S.id) >= 0 && !o.spatial.blocked);
		if(!kids.length) return;
		const R = T.radius(S) + 6, cool = S._mcool || (S._mcool = new Map());
		const go = (obj, pos, move) => {
			const c = cool.get(obj);
			const inside = (pos.x - S.x) * (pos.x - S.x) + (pos.y - S.y) * (pos.y - S.y) < R * R;
			if(c != null){ if(T.time < c || inside) return; cool.delete(obj); }
			if(!inside) return;
			if(T.portalGuard && !T.portalGuard(obj)) return;
			const k = kids[Math.floor(Math.random() * kids.length)];
			if(move(k.x, k.y) === false) return;
			k.spatial.cool.set(obj, { until: T.time + BAL.spatial.rearm, side: 0 });      // it leaves the portal before that portal can take it again
			cool.set(obj, T.time + BAL.spatial.rearm);
			k.spatial.flash = 1;
			warpFx(T, pos.x, pos.y, k.x, k.y);
		};
		for(const e of creaturesOf(T, S)) go(e, T.center(e), (x, y) => T.teleport(e, x, y));
		for(const o of T.bodies()){ if(!o.alive || o === S || o.spatial || o.isZone || o.zoneBlob || o.attach || o.infSource || ME.techOf(o, 'antimagic') > 0) continue; go(o, { x: o.x, y: o.y }, (x, y) => { o.x = x; o.y = y; }); }
		for(const p of T.foreign()){ if(!p) continue; go(p, { x: p.x, y: p.y }, (x, y) => { p.x = x; p.y = y; T.turnForeign(p); }); }
	}
	function portalTick(T, b, sp){
		const B = BAL.spatial;
		const r = portalRadius(b.amount); sp.r = r; b.formRadius = r;
		const ends = [ { x: b.x, y: b.y }, { x: sp.x1, y: sp.y1 } ];
		// a reverse Spatial zone at either end: the portal does not work while it is there
		if(T.zoneLaw && (T.zoneLaw(ends[0].x, ends[0].y, 'spatial') < 0 || T.zoneLaw(ends[1].x, ends[1].y, 'spatial') < 0)){ sp.blocked = true; sp.ready = true; return; }
		sp.blocked = false;
		const inside = (pos, e) => { const dx = pos.x - ends[e].x, dy = pos.y - ends[e].y; return dx * dx / (r * 0.62 * r * 0.62) + dy * dy / (r * r) < 0.7; };
		const pass = (obj, pos, cost, move) => {
			// the moment a portal opens, whatever stands in an end goes straight through (if the portal can carry it)
			sp.ready = true;
			const c = sp.cool.get(obj);
			if(c){
				if(T.time < c.until || inside(pos, c.side)) return;
				sp.cool.delete(obj);
			}
			for(let e = 0; e < 2; e++){
				if(!inside(pos, e)) continue;
				if(e === 1 && (sp.masters || sp.home)) return;      // a portal home is one-way: the master portal sends things back (randomly)
				// carrying something through costs the portal nothing — no energy, no time
				let o = ends[1 - e];
				if(e === 0 && sp.masters){
					const ms = sp.masters.map(id => T.bodies().find(q => q.id === id && q.alive && q.infSource)).filter(Boolean);
					if(!ms.length) return;
					const m = ms[Math.floor(Math.random() * ms.length)];      // several sources: which one you arrive at is random
					o = { x: m.x, y: m.y };
					(m._mcool || (m._mcool = new Map())).set(obj, T.time + BAL.spatial.rearm);      // and the master does not throw you straight back
				}
				const nx = o.x + (sp.masters ? 0 : pos.x - ends[e].x), ny = o.y + (sp.masters ? 0 : pos.y - ends[e].y);
				if(T.portalGuard && !T.portalGuard(obj)) return;      // portal / spatial / infinity recursion is stopped safely
				if(move(nx, ny) === false) return;
				sp.cool.set(obj, { until: T.time + B.rearm, side: 1 - e });
				sp.flash = 1;
				warpFx(T, pos.x, pos.y, nx, ny);
				return;
			}
		};
		// creatures (you, enemies, allies): passing costs at least the base, more for bigger bodies
		for(const e of creaturesOf(T, b)){
			const area = (e.w || 38) * (e.h || 74) / (38 * 74);
			const cost = B.creatureCost * clamp(area, 1, 4);
			pass(e, T.center(e), cost, (x, y) => T.teleport(e, x, y));
		}
		// other energy: costs part of the energy that goes through
		for(const o of T.bodies()){
			if(!o.alive || o === b || o.spatial || o.isZone || o.zoneBlob || o.attach || o.foreign || ME.techOf(o, 'antimagic') > 0) continue;      // Anti-Magic is not carried by magic: it eats at the portal instead
			pass(o, { x: o.x, y: o.y }, Math.max(1, o.amount * B.energyCostMul), (x, y) => { o.x = x; o.y = y; if(o.ownerId !== b.ownerId) o.hostile = true; });      // another caster's portal took hold of it: it can strike its own caster now
		}
		// free constructs small enough to fit through
		if(T.constructsNear) for(const c of T.constructsNear(b.x, b.y, r * 2).concat(T.constructsNear(sp.x1, sp.y1, r * 2))){
			if(!T.constructMovable(c) || c.geo.R > r * 1.6 || ME.techOf(c, 'antimagic') > 0) continue;
			pass(c, { x: c.x, y: c.y }, 0, (x, y) => T.moveConstructTo(c, x, y));
		}
		// projectiles
		for(const p of T.foreign()){
			if(!p) continue;
			const cost = Math.max(3, Number(p.dmg != null ? p.dmg : (p.damage != null ? p.damage : 10)) * B.projectileCostMul);
			pass(p, { x: p.x, y: p.y }, cost, (x, y) => { p.x = x; p.y = y; T.turnForeign(p); });
		}
		sp.ready = true;
		if(sp.flash > 0) sp.flash = Math.max(0, sp.flash - T.dt * 3);
	}
	function surfaceTick(T, b, sp){
		const B = BAL.spatial;
		sp.half = surfaceHalf(b.amount); b.formRadius = sp.half;
		const host = T.host();
		for(const e of creaturesOf(T, b)){
			const r = T.rect(e) || { x: e.x, y: e.y, w: e.w || 30, h: e.h || 40 };
			const c = { x: r.x + r.w / 2, y: r.y + r.h / 2 };
			const hit = segHit(sp, b.x, b.y, c.x, c.y, Math.min(r.w, r.h) * 0.5);
			if(!hit) continue;
			if(host.nudge) host.nudge(e, hit.nx * hit.pen, hit.ny * hit.pen);
			T.bounce(e, hit.nx, hit.ny, B.restitution);
			sp.flash = 1;
		}
		for(const o of T.bodies()){
			if(!o.alive || o === b || o.immovable || o.isZone || o.zoneBlob || o.attach) continue;
			const hit = segHit(sp, b.x, b.y, o.x, o.y, T.radius(o) * 0.6);
			if(!hit) continue;
			o.x += hit.nx * hit.pen; o.y += hit.ny * hit.pen;
			const vn = o.vx * hit.nx + o.vy * hit.ny;
			if(vn < 0){ o.vx -= (1 + B.restitution) * vn * hit.nx; o.vy -= (1 + B.restitution) * vn * hit.ny; o.angleSet = false; sp.flash = 1; }
		}
		for(const p of T.foreign()){
			if(!p) continue;
			const hit = segHit(sp, b.x, b.y, p.x, p.y, 6);
			if(!hit) continue;
			p.x += hit.nx * hit.pen; p.y += hit.ny * hit.pen;
			const vn = (p.vx || 0) * hit.nx + (p.vy || 0) * hit.ny;
			if(vn < 0){ p.vx -= (1 + B.restitution) * vn * hit.nx; p.vy -= (1 + B.restitution) * vn * hit.ny; p._magicRedirected = true; sp.flash = 1; }
		}
		if(sp.flash > 0) sp.flash = Math.max(0, sp.flash - T.dt * 4);
	}
	/* draw what is on the other side of a portal inside its oval (real screen copy) */
	function portalView(ctx, x, y, rx, ry, ox, oy){
		if(typeof ctx.getTransform !== 'function') return;
		const m = ctx.getTransform(), sc = Math.hypot(m.a, m.b) || 1;
		const X = m.a * (x + ox) + m.c * (y + oy) + m.e, Y = m.b * (x + ox) + m.d * (y + oy) + m.f;
		ctx.save();
		ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.clip();
		ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
		ctx.fillStyle = TC('#0a0618'); ctx.fillRect(x - rx, y - ry, rx * 2, ry * 2);
		try { ctx.globalAlpha = 0.9; ctx.drawImage(ctx.canvas, X - rx * sc, Y - ry * sc, rx * 2 * sc, ry * 2 * sc, x - rx, y - ry, rx * 2, ry * 2); } catch(e){}
		ctx.restore();
	}
	function drawPortalEnd(ctx, x, y, r, t, k, flash, seed){
		const rx = r * 0.62, ry = r;
		ctx.globalCompositeOperation = 'lighter';
		softDisc(ctx, x, y, r * 1.5, hexA('#9d6bff', 0.25 * k), hexA('#3a1a8a', 0));
		ctx.lineWidth = 2.2; ctx.strokeStyle = hexA('#d9c6ff', 0.85 * k);
		ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.stroke();
		ctx.lineWidth = 1.2;
		for(let i = 0; i < 3; i++){
			const a0 = t * (2.2 + i * 0.7) * (i % 2 ? -1 : 1) + seed + i * 2;
			ctx.strokeStyle = hexA(i === 1 ? TC('#ffffff') : TC('#b48cff'), 0.6 * k);
			ctx.beginPath(); ctx.ellipse(x, y, rx * (0.78 - i * 0.14), ry * (0.82 - i * 0.12), 0, a0, a0 + 2.4); ctx.stroke();
		}
		if(flash > 0){ ctx.strokeStyle = hexA('#ffffff', flash * 0.9); ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, y, rx * (1 + 0.3 * (1 - flash)), ry * (1 + 0.3 * (1 - flash)), 0, 0, TAU); ctx.stroke(); }
	}
	TQ.register({
		id: 'spatial', name: 'Spatial', reversedName: 'Reverse Spatial (surface)', antiResist: 2.2,      // an active spatial structure is hard to cancel
		description: 'Turns the energy into space itself — it stops being a projectile. Positive power opens a portal: the entrance is where the energy is, the exit where you choose. You, creatures, energy and projectiles that enter come out the other side; each crossing uses portal energy (a creature at least 50, energy about half of what goes through). Negative power makes a surface that everything bounces off. More energy = bigger and longer-lasting (portals at most 15 s). Spatial energy cannot be moved and does not strike.',
		color: '#b48cff', reversedColor: '#7f8cff',
		palette: { core: '#f3e8ff', mid: '#b48cff', outer: '#5b3fd6' },
		reversePalette: { core: '#e8ecff', mid: '#7f8cff', outer: '#2f3aa8' },
		balance: BAL.spatial,
		/* Construction: Spatial energy moves a free construct a short way through space (an anchored one it slips past);
		   portals carry free constructs that fit through them (see portalTick) */
		onConstruct(T, b, s, c, info){
			if(b.spatial) { info.pass = true; return; }
			info.dmg = 0;
			if(!T.constructMovable(c)){ info.pass = true; return; }
			const sp = Math.hypot(b.vx, b.vy) || 1, d = 30 + 25 * Math.min(2, Math.abs(s));
			const dir = s > 0 ? 1 : -1;      // reverse Spatial pulls it back toward where the energy came from
			if(T.moveConstructTo(c, c.x + b.vx / sp * d * dir, c.y + b.vy / sp * d * dir)) warpFx(T, b.x, b.y, c.x, c.y);
		},
		targets: { energy: true, zone: true, spell: false, environment: true, enemy: true, surface: true, self: false, ally: false },
		/* a Spatial zone: portals (and surfaces) with an end inside it last much longer. Reversed: portals inside do not work. */
		zoneInfo: (rev) => rev ? 'portals with an end inside it stop working' : 'portals and surfaces with an end inside it last much longer',
		zone(T, Z, s, dt){
			if(s < 0) return;      // reverse: portalTick asks the zone law at both ends and stays shut
			const slow = 1 - 1 / (1 + 3 * Z.k);
			for(const o of T.bodies()){
				const sp = o.alive && o.spatial; if(!sp || sp._zExt === T.time) continue;
				const inA = (o.x - Z.x) * (o.x - Z.x) + (o.y - Z.y) * (o.y - Z.y) <= Z.r * Z.r;
				const inB = sp.x1 != null && (sp.x1 - Z.x) * (sp.x1 - Z.x) + (sp.y1 - Z.y) * (sp.y1 - Z.y) <= Z.r * Z.r;
				if(!inA && !inB) continue;
				sp.end += T.dt * slow; sp._zExt = T.time;      // time runs slower for it
			}
		},
		targetNotes: { self: 'Spatial does not move you by itself — open a portal and walk through it', ally: 'Spatial does not relocate allies',  spell: 'another caster\'s projectile cannot become a portal' },
		params: [
			{ key: 'dest', label: 'Portal exit', type: 'select', options: SPATIAL_DEST, default: 'mouse', show: (p) => !isRev(p) },
			{ key: 'place', label: 'Place the surface', type: 'select', options: SPATIAL_PLACE, default: 'here', show: (p) => isRev(p) },
			{ key: 'angle', label: 'Surface direction', type: 'select', options: SPATIAL_ANGLE, default: 'flat', show: (p) => isRev(p) },
			{ key: 'dist', label: 'Distance', type: 'int', min: 20, max: 1200, step: 10, default: 200, unit: 'px',
				show: (p) => isRev(p) ? !!SPATIAL_OFFSET[p.spatial_place || 'here'] : !!SPATIAL_OFFSET[p.spatial_dest || 'mouse'] }
		],
		analyze(p, a, node){
			const rev = isRev(p), dest = p.spatial_dest || 'mouse';
			const b = a.ctx.body;
			if(rev && a.ctx.target === 'enemy') a.error(node, 'SPATIAL_ENEMY', 'Reverse Spatial cannot be placed onto an enemy — target something else (or nothing) before it');
			if(!rev && dest === 'target' && !a.ctx.target) a.error(node, 'SPATIAL_TARGET', 'No valid target — a portal exit at "Current target" needs a Target earlier in this branch');
			const pts = TQ.points(a.profile, 'spatial'), E = b && !b.foreign ? b.amount : 0;
			const info = rev
				? { form: 'Surface ' + Math.round(surfaceHalf(E) * 2) + ' px wide', lasts: formDuration(E).toFixed(1) + ' s' }
				: { form: 'Portal ' + Math.round(portalRadius(E) * 2) + ' px tall', lasts: formDuration(E).toFixed(1) + ' s', range: 'exit up to ' + Math.round(spatialRange(pts, Math.abs(Number(p.power) || 5))) + ' px',
					travel: E >= BAL.spatial.creatureCost ? 'you can pass ' + Math.floor(E / BAL.spatial.creatureCost) + '×' : 'too little energy for you to pass (needs ' + BAL.spatial.creatureCost + ')' };
			a.extra({ tech: Object.assign((a.nodeExtra && a.nodeExtra.tech) || {}, info) });
		},
		canApply(T, b, s, ctx){
			if(s >= 0) return null;
			const t = ctx.br.ctx.target;
			if(t && t.kind === 'enemy') return 'Reverse Spatial cannot be placed onto an enemy';
			const pl = surfacePlacement(T, b, ctx);
			if(overlapsEnemy(T, pl.x, pl.y, surfaceHalf(b.amount), pl.ang)) return 'Reverse Spatial cannot be placed onto an enemy';
			ctx._place = pl;
			return null;
		},
		onApply(T, b, s, ctx){
			// from now on this energy is space: fixed in place, no longer a projectile. The portal / surface itself forms on the
			// next frame — so "Spatial → Infinity" straight after (an instant link) makes a Spatial Infinity source, not a portal
			b.vx = 0; b.vy = 0; b.anchored = true; b.attach = null; b.arrive = null; b.guided = false; b.slide = null;
			const P = { s };
			if(s > 0){
				let from = { x: b.x, y: b.y };
				const g = ctx.br.ctx.group;     // divided pieces keep their spacing at the exit
				if(g && g.length > 1){ let sx = 0, sy = 0, n = 0; for(const m of g){ if(m.body && m.body.alive && !m.body.foreign){ sx += m.body.x; sy += m.body.y; n++; } } if(n) from = { x: sx / n, y: sy / n }; }
				const want = spatialPoint(T, ctx, from, b, 'dest') || { x: from.x + 120, y: from.y };
				const to = spatialClamp(from, want, spatialRange(ctx.points, ctx.power));
				P.land = freeLanding(T, b.x, b.y, b.x + (to.x - from.x), b.y + (to.y - from.y));
			} else P.place = ctx._place || surfacePlacement(T, b, ctx);
			b._spPend = P;
		},
		/* the portal / surface forms (see onApply) */
		form(T, b, P){
			const B = BAL.spatial, s = P.s;
			b.vx = 0; b.vy = 0; b.anchored = true;
			b.immovable = false; b.noContact = true; b.keepEnergy = true; b.hideBody = true;      // it can be moved (Redirect, Attach, Guide …) — a portal's exit travels with it
			const dur = formDuration(b.amount);
			if(s > 0){
				const land = P.land;
				b.spatial = { kind: 'portal', x1: land.x, y1: land.y, ox: land.x - b.x, oy: land.y - b.y, end: T.time + dur, born: T.time, cool: new Map(), flash: 1, r: portalRadius(b.amount) };
				b.formRadius = b.spatial.r;
				warpFx(T, b.x, b.y, land.x, land.y);
			} else {
				const pl = P.place;
				b.x = pl.x; b.y = pl.y;
				b.spatial = { kind: 'surface', ang: pl.ang, end: T.time + dur, born: T.time, half: surfaceHalf(b.amount), flash: 1 };
				b.formRadius = b.spatial.half;
				T.ring(pl.x, pl.y, 4, b.spatial.half, 16, TC('#9fb0ff'));
			}
		},
		/* Spatial energy that is not (yet) a portal passes through creatures harmlessly */
		onHit(T, b, s, e, info){ if(!b.spatial){ info.noDamage = true; info.keep = true; info.cost = 0; } },
		tick(T, b, s){
			if(b._spPend){ const P = b._spPend; b._spPend = null; if(!b.infSource) this.form(T, b, P); }
			if(b.infSource){ if(s > 0) masterTick(T, b); return; }      // a Spatial Infinity source is a master portal
			if(!b.spatial){
				// stored Spatial energy (from a Spatial Infinity source or a Spatial zone) opens a portal home once it holds enough
				if(s > 0 && (b.infDerived || b.zoneHome) && b.amount >= BAL.spatial.storeToForm) formHomePortal(T, b);
				return;
			}
			const sp = b.spatial;
			if(T.time >= sp.end || b.amount < BAL.spatial.minEnergy){ T.kill(b, 'leak'); return; }
			if(sp.masters || sp.home){ homeExit(T, b, sp); }
			if(sp.kind === 'portal'){ if(sp.ox != null && !sp.masters && !sp.home){ sp.x1 = b.x + sp.ox; sp.y1 = b.y + sp.oy; } portalTick(T, b, sp); } else surfaceTick(T, b, sp);
		},
		draw(ctx, b, x, y, R, s, t, lod){
			const sp = b.spatial; if(!sp) return;
			const k = clamp((sp.end - t) / 1.2, 0, 1) * clamp((t - sp.born) / 0.25, 0, 1) * (sp.blocked ? 0.3 + 0.1 * Math.sin(t * 20) : 1);      // opens, then closes at the end; a shut portal flickers
			if(sp.kind === 'portal'){
				const r = sp.r * (0.4 + 0.6 * k);
				const ex = x + (sp.x1 - b.x), ey = y + (sp.y1 - b.y);
				portalView(ctx, x, y, r * 0.62, r, sp.x1 - b.x, sp.y1 - b.y);
				const oneWay = !!(sp.masters || sp.home);
				if(!oneWay) portalView(ctx, ex, ey, r * 0.62, r, b.x - sp.x1, b.y - sp.y1);
				drawPortalEnd(ctx, x, y, r, t, Math.max(0.25, k), sp.flash, b.seed);
				if(!oneWay) drawPortalEnd(ctx, ex, ey, r, t, Math.max(0.25, k), sp.flash, b.seed + 3);
				if(!lod){
					ctx.globalCompositeOperation = 'lighter'; ctx.setLineDash([2, 10]); ctx.lineDashOffset = -t * 30;
					ctx.strokeStyle = hexA('#b48cff', 0.12 * k); ctx.lineWidth = 1;
					ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke(); ctx.setLineDash([]);
				}
			} else {
				const half = sp.half * (0.3 + 0.7 * k), th = BAL.spatial.surfaceThick;
				ctx.save();
				ctx.translate(x, y); ctx.rotate(sp.ang);
				ctx.globalCompositeOperation = 'lighter';
				const g = ctx.createLinearGradient(0, -th * 2, 0, th * 2);
				g.addColorStop(0, hexA('#7f8cff', 0)); g.addColorStop(0.5, hexA('#9fb0ff', 0.45 * k + 0.35 * sp.flash)); g.addColorStop(1, hexA('#7f8cff', 0));
				ctx.fillStyle = g; ctx.fillRect(-half - th, -th * 2, (half + th) * 2, th * 4);
				ctx.strokeStyle = hexA('#e8ecff', 0.85 * k); ctx.lineWidth = 1.6;
				ctx.beginPath(); ctx.moveTo(-half, -th * 0.6); ctx.lineTo(half, -th * 0.6); ctx.moveTo(-half, th * 0.6); ctx.lineTo(half, th * 0.6); ctx.stroke();
				if(!lod){
					ctx.strokeStyle = hexA('#b9c4ff', 0.35 * k); ctx.lineWidth = 1;
					const step = 12, off = (t * 10) % step;
					ctx.beginPath();
					for(let u = -half + off; u < half; u += step){ ctx.moveTo(u, -th * 0.6); ctx.lineTo(u + step * 0.5, th * 0.6); }
					ctx.stroke();
				}
				ctx.restore();
			}
		},
		reinforce: {
			// a Spatial weapon strikes through a portal at your cursor (the game reads portalStrike)
			weapon: { normal: { portalStrike: 1 }, reverse: { impact: 0.3 } },
			spell:  { normal: { spellStability: 0.2 }, reverse: { spellImpact: 0.2 } }
			// self / ally: nothing — Spatial does not grant free movement
		},
		drawReinforce(ctx, st, s, g, t){
			if(g.kind !== 'weapon' || s <= 0 || !g.host || !g.host.portalStrike) return;
			const ps = g.host.portalStrike();
			if(!ps) return;
			const k = ps.active ? 1 : 0.35;
			const r = 22 + 18 * k;
			const ex = ps.x - g.camX, ey = ps.y - g.camY;
			// the exit at the cursor; while swinging, the entrance sits where the weapon goes in
			// (the game draws the weapon itself split between them: half in hand, half out of the exit)
			drawPortalEnd(ctx, ex, ey, r, t, k, ps.active ? 0.6 : 0, st.seed);
			if(ps.active){
				const ix = ps.entry ? ps.entry.x - g.camX : g.x1, iy = ps.entry ? ps.entry.y - g.camY : g.y1;
				drawPortalEnd(ctx, ix, iy, r * 0.75, t, 0.9, 0.3, st.seed + 2);
			}
		}
	});

	/* ==================================================================
	   ANTI-MAGIC — a substance that opposes magic itself (not an element)
	   ------------------------------------------------------------------
	   Anti-Magic energy barely harms flesh. What it does is consume magic:
	   raw energy, techniques, zones, projectiles, reinforcement, portals and
	   Infinity, with the energy conserved by magnitude (30 Anti-Magic into
	   50 raw leaves 20 raw; 60 into 50 leaves 10 Anti-Magic). How much it
	   achieves depends on its power, its energy, how long it touches, and
	   how resistant the magic is (each technique states its own antiResist).
	   Reversed it is restoration: it gives existing magic back what it lost
	   and steadies it — it never creates energy or revives what is gone.
	   ================================================================== */
	const AM_STATUSES = [ 'burn', 'chill', 'slowed', 'dazzle', 'obscured', 'frozen' ];
	function amBudget(b, s, dt){ const B = BAL.antimagic, a = Math.min(2.5, Math.abs(s)); return (B.rate + B.ratePerS * a) * (1 + Math.sqrt(Math.max(0, b.amount)) / 4) * dt; }
	function amTouch(T, b, o){ return Math.hypot(o.x - b.x, o.y - b.y) <= (T.radius(b) + T.radius(o)) * 0.9; }
	function amRect(T, x, y, r, e){ const R = T.rect(e) || { x: e.x, y: e.y, w: e.w || 30, h: e.h || 40 }; const cx = clamp(x, R.x, R.x + R.w), cy = clamp(y, R.y, R.y + R.h); return Math.hypot(cx - x, cy - y) <= r; }
	TQ.register({
		id: 'antimagic', combines: true, name: 'Anti-Magic', reversedName: 'Reverse Anti-Magic (restoration)', antiResist: 1,
		spriteBlend: (s) => s > 0 ? 'source-over' : 'lighter',      // crowd stamps: a dark mass laid over the scene
		description: 'Not an element: a substance that opposes magic itself. Anti-Magic energy consumes the magic it touches — raw energy, other techniques, zones, projectiles, reinforcement, portals and Infinity — the weaker side is used up and the stronger keeps the rest. It hardly harms creatures that have no magic. It works on your own spells too. Reversed, it restores and stabilises magic that already exists (weakened energy, suppressed techniques and zones, unstable compression, portals, Infinity) — it never creates energy.',
		color: '#a0a0a0', reversedColor: '#9ff0c8',
		palette: { core: '#6a6a6a', mid: '#1c1c1c', outer: '#000000' },
		reversePalette: { core: '#ffffff', mid: '#9ff0c8', outer: '#3fae8a' },
		balance: BAL.antimagic,
		/* Construction: a construct is magic made solid — Anti-Magic eats away at its integrity and breaks it (reverse: restores it).
		   An Anti-Magic construct resists Anti-Magic and erases the magic that strikes it */
		onConstruct(T, b, s, c, info){
			if(s > 0){ info.dmg = T.power(b) * 2.2 * ME.CONFIG.damagePerPower + b.amount * 0.6; info.impulse = 0.3; }
			else { T.repairConstruct(c, b.amount * 1.2); info.dmg = 0; info.impulse = 0; }
		},
		constructResist(T, c, s, source){ return s > 0 && source === 'antimagic' ? 0.25 : 1; },
		constructHit(T, c, s, b, info){ if(s > 0 && ME.techOf(b, 'antimagic') <= 0){ info.dmg *= 0.4; info.consume = true; info.reflect = false; T.remember(b, 'antiMagicConsumed'); } },
		drawConstruct(ctx, c, s, x, y, t, P, outline){
			if(s <= 0) return;
			ctx.globalCompositeOperation = 'source-over';
			ctx.globalAlpha = 0.55; ctx.fillStyle = TC('#050505'); (outline ? outline(ctx, 0) : partPath(ctx, P, 0)); ctx.fill('evenodd');
			ctx.globalAlpha = 0.6; ctx.strokeStyle = TC('#5a5a5a'); ctx.lineWidth = 1; (outline ? outline(ctx, 0) : partPath(ctx, P, 0)); ctx.stroke();
		},
		targets: { energy: true, zone: true, spell: true, environment: true, surface: false, enemy: true, self: false, ally: false },
		/* an Anti-Magic zone: ALL magic inside withers much faster and weak magic simply disappears; Anti-Magic cannot break
		   the zone down. Reversed: your own magic inside does not shrink over time. */
		zoneInfo: (rev) => rev ? 'your magic inside does not shrink over time' : 'all magic inside withers fast, weak magic disappears; Anti-Magic cannot break it down',
		zone(T, Z, s, dt){
			const k = Z.k;
			if(s > 0){
				for(const o of T.zoneBodies(Z)){
					if(o.zoneBlob || o.isZone || o.infSource || ME.techOf(o, 'antimagic') > 0) continue;      // torn space withers here too (only Anti-Magic can undo it)
					T.zoneFlag(o, 'leak', 1 + 8 * k);
					o.amount -= (o.amount * 0.06 * k + 0.8 * k) * dt;
					if(o.amount < 3 + 8 * k){ T.remember(o, 'antiMagicConsumed'); T.kill(o, 'antimagic'); }
				}
				// constructs are magic made solid: they wear away inside (an Anti-Magic construct resists)
				for(const c of T.zoneConstructs(Z)) T.damageConstruct(c, (1.5 + 0.02 * c.maxIntegrity) * k * dt, 'antimagic', null);
				for(const p of T.zoneForeign(Z)){
					if(p.dmg == null) continue;
					if(p._origDmg == null) p._origDmg = p.dmg;
					p.dmg = Math.max(0, p.dmg * (1 - 0.35 * k * dt) - 0.5 * k * dt);
					if(p.dmg < 2 + 4 * k) T.removeForeign(p);
				}
				if(Math.random() < Z.r * 0.003 * k * T.f){ const a = Math.random() * TAU, rr = Math.sqrt(Math.random()) * Z.r; T.spark(Z.x + Math.cos(a) * rr, Z.y + Math.sin(a) * rr, 0, 0.3, TC('#3a3a3a'), 40, 2); }
			} else {
				for(const o of T.zoneBodies(Z)) if(o.ownerId === Z.owner) T.zoneFlag(o, 'noLeak', true);
			}
		},
		targetNotes: { self: 'put Anti-Magic into a body with Reinforcement', ally: 'put Anti-Magic into a body with Reinforcement', surface: 'a bare surface has no magic to oppose' },
		reinforce: {
			self: { normal: { damageResist: 0.12 }, reverse: { stability: 0.3 } },
			weapon: { normal: { impact: 0.08 }, reverse: { stability: 0.3 } }
		},
		tick(T, b, s){
			const B = BAL.antimagic, a = Math.min(2.5, Math.abs(s)), R = T.radius(b);
			const budget = amBudget(b, s, T.dt);
			const others = T.nearBodies(b.x, b.y, R + 80, b);
			if(s > 0){
				// magic it touches is consumed (Anti-Magic meeting Anti-Magic adds / cancels through the engine's normal rule)
				for(const o of others){
					if(ME.techOf(o, 'antimagic') !== 0 || o.rupture) continue;
					if(o.attach && o.attach.target && o.attach.target.ref === b) continue;
					if(o.inst === b.inst && !o.hostile && !b.hostile) continue;      // the rest of its own spell (the energy it is being formed from) is left alone
					if(!amTouch(T, b, o)) continue;
					T.antiMagic(b, o, budget);
					if(b.amount < 0.5) break;
				}
				// a zone it sits in is gradually suppressed — a dead area inside the zone
				for(const z of T.bodies()){
					if(!z.alive || !z.isZone || Math.hypot(z.x - b.x, z.y - b.y) > z.zoneRadius) continue;
					if(z.ownerId === b.ownerId && !b.hostile) continue;      // your own zone is where you gather: your Anti-Magic does not suppress it
					T.antiZone(z, B.zonePush * a * Math.sqrt(Math.max(1, b.amount) / 40) * T.dt);
					b.amount -= B.zoneCost * a * T.dt;
				}
				// constructs it rests against are magic made solid: it wears them away (it is used up doing so)
				for(const c of T.constructsNear(b.x, b.y, R + 6)){
					if(!T.constructTouches(c, b.x, b.y, R + 2)) continue;
					const spend = Math.min(b.amount, budget * 0.6);
					T.damageConstruct(c, spend * 2.5, 'antimagic', b); b.amount -= spend;
					if(T.every(c, 'amSpark', 0.1)){ const a = Math.random() * TAU; T.spark(b.x + Math.cos(a) * R, b.y + Math.sin(a) * R, Math.cos(a), Math.sin(a), TC('#3a3a3a'), 18, 2); }
					if(b.amount < 1) break;
				}
				// projectiles: weakened, stripped of their nature, or destroyed — a strong one overpowers weak Anti-Magic
				for(const p of T.foreign()){
					if(!p || p._magicGone) continue;
					if(Math.hypot(p.x - b.x, p.y - b.y) > R + Math.max(p.width || 8, p.height || 8) * 0.5 + 6) continue;      // it eats a little past its own edge
					T.antiForeign(b, p, budget);
				}
				// creatures it touches: magical reinforcement is suppressed and consumed (your own only when it has turned on you)
				const ents = T.enemies.concat(T.allies);
				const me = T.caster(b); if(b.hostile && me) ents.push(me);
				for(const e of ents){
					if(!e || e.dead || !amRect(T, b.x, b.y, R, e)) continue;
					for(const st of T.reinf()) if(st.ref === e || (e === me && st.ownerId === b.ownerId && st.kind === 'weapon')){ const sp = T.antiReinf(st, Math.min(budget, b.amount)); b.amount -= sp; }      // also the weapon / magical item in that hand
				}
				if(b.amount < 1) T.kill(b, 'antimagic');
			} else {
				// restoration: what it touches gets back what it lost (paid for by this energy)
				for(const o of others){
					if(ME.techOf(o, 'antimagic') !== 0 || o.rupture || !amTouch(T, b, o)) continue;
					T.restore(b, o, budget);
				}
				for(const z of T.bodies()) if(z.alive && z.isZone && z.amSupp > 0 && Math.hypot(z.x - b.x, z.y - b.y) < z.zoneRadius) T.restore(b, z, budget);
				if(b.amount < 1) T.kill(b, 'leak');
			}
		},
		onHit(T, b, s, e, info){
			const B = BAL.antimagic;
			if(s > 0){
				info.mult *= T.magicalEnemy(e) ? B.hitMagical : B.hitPlain;       // its strength is against magic, not flesh
				for(const k of AM_STATUSES) T.clearStatus(e, k);
				T.status(e, 'suppressed', 1, 1.5);
				for(const st of T.reinf()) if(st.ref === e) T.antiReinf(st, b.amount * 0.5);
			} else { info.noDamage = true; info.keep = true; info.cost = 0; }
		},
		/* a zone / field of Anti-Magic: a dead area where magic withers */
		field(T, src, s){
			const B = BAL.antimagic, a = Math.min(2.5, Math.abs(s));
			const budget = (B.fieldRate + B.fieldRatePerS * a) * T.dt;
			for(const o of T.nearBodies(src.x, src.y, src.r, src.body)){
				if(ME.techOf(o, 'antimagic') !== 0 || o.zoneBlob) continue;
				if(s > 0) T.antiMagic(null, o, budget); else T.restore(null, o, budget * 0.5);
			}
			if(s > 0){
				for(const p of T.foreign()){ if(!p || p._magicGone || Math.hypot(p.x - src.x, p.y - src.y) > src.r) continue; T.antiForeign(null, p, budget); }
				for(const st of T.reinf()){ if(!st.ref || st.ref.w == null) continue; const c = T.center(st.ref); if(Math.hypot(c.x - src.x, c.y - src.y) < src.r && !T.isCaster(src.body, st.ref)) T.antiReinf(st, budget); }
			}
		},
		onForeign(T, ref, s, ctx){ if(s > 0) T.antiForeign(null, ref, 6 * (ctx.power || 5) * Math.abs(s) + 10); },
		/* Anti-Magic poured into another spell (Reinforce → that spell): it suppresses it; reversed, it restores it */
		onReinforceEnergy(T, src, ref, E, s){
			const pseudo = { amount: E };
			if(s > 0){ const spent = T.antiMagic(pseudo, ref, E); return 'Anti-Magic poured in: ' + Math.round(spent) + ' of its magic consumed' + (ref.alive ? '' : ' — it is gone'); }
			const used = T.restore(pseudo, ref, E);
			return used > 0 ? 'Restored / stabilised it (' + Math.round(used) + ')' : 'Nothing to restore';
		},
		onReinforcedHit(T, st, s, e, ev){
			if(s <= 0) return;
			for(const k of AM_STATUSES) T.clearStatus(e, k);
			T.status(e, 'suppressed', 1, 1.2);
			for(const o of T.reinf()) if(o.ref === e) T.antiReinf(o, st.energy * 0.2);
		},
		/* Anti-Magic held as reinforcement on a body: an aura that eats magic coming at it, paid for by the reinforcement */
		reinforceTick(T, st, s, dt){
			if(s <= 0 || !st.ref || st.ref.w == null || (st.kind !== 'self' && st.kind !== 'ally' && st.kind !== 'legs' && st.kind !== 'arms')) return;
			const B = BAL.antimagic, c = T.center(st.ref), r = Math.max(st.ref.w || 30, st.ref.h || 40) * 0.6 + 14;
			const pseudo = { amount: st.energy }, budget = (B.auraRate + B.auraRatePerS * Math.min(2.5, s)) * dt;
			for(const p of T.foreign()){ if(!p || p._magicGone || Math.hypot(p.x - c.x, p.y - c.y) > r + 8) continue; T.antiForeign(pseudo, p, budget); }
			for(const o of T.nearBodies(c.x, c.y, r + 40, null)){
				if((o.ownerId === st.ownerId && !o.hostile) || ME.techOf(o, 'antimagic') !== 0) continue;
				if(Math.hypot(o.x - c.x, o.y - c.y) > r + T.radius(o)) continue;
				T.antiMagic(pseudo, o, budget);
			}
			st.energy = pseudo.amount;
		},
		/* a dark, light-swallowing mass: drawn over the scene, not added to it */
		drawBody(ctx, b, x, y, R, s, t, alpha){
			if(s < 0) return false;
			const pts = ME.outline(b, x, y, R, t), f = ME.curForm(b), sh = ME.SHAPES[b.shape] || ME.SHAPES.raw, sharp = f > 0.72 && !sh.smooth && !!sh.poly;
			ctx.save();
			ctx.globalCompositeOperation = 'source-over';
			ctx.globalAlpha = alpha * 0.55;
			const g = ctx.createRadialGradient(x, y, R * 0.4, x, y, R * 2.2);
			g.addColorStop(0, 'rgba(0,0,0,0.85)'); g.addColorStop(1, 'rgba(0,0,0,0)');
			ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R * 2.2, 0, TAU); ctx.fill();
			ctx.globalAlpha = alpha * 0.95;
			const g2 = ctx.createRadialGradient(x, y, 0, x, y, R * 1.3);
			g2.addColorStop(0, TC('#000000')); g2.addColorStop(0.7, TC('#0d0d0d')); g2.addColorStop(1, TC('#262626'));
			ctx.fillStyle = g2; ctx.beginPath(); ME.tracePath(ctx, pts, sharp); ctx.fill();
			// crackling grey veins and a hard dark rim
			ctx.save(); ctx.beginPath(); ME.tracePath(ctx, pts, sharp); ctx.clip();
			ctx.strokeStyle = 'rgba(120,120,120,0.55)'; ctx.lineWidth = Math.max(0.7, R * 0.06);
			for(let i = 0; i < 4; i++){
				const a0 = b.seed + i * 1.6 + Math.sin(t * 3 + i) * 0.4;
				ctx.beginPath(); ctx.moveTo(x, y);
				let px = x, py = y;
				for(let k = 1; k <= 4; k++){ const a = a0 + Math.sin(t * 7 + k * 2.3 + i) * 0.5; px += Math.cos(a) * R * 0.3; py += Math.sin(a) * R * 0.3; ctx.lineTo(px, py); }
				ctx.stroke();
			}
			ctx.restore();
			ctx.globalAlpha = alpha * 0.9; ctx.strokeStyle = TC('#4d4d4d'); ctx.lineWidth = 1.3;
			ctx.beginPath(); ME.tracePath(ctx, pts, sharp); ctx.stroke();
			// flakes of black drifting off it
			ctx.fillStyle = 'rgba(0,0,0,0.7)';
			for(let i = 0; i < 5; i++){ const a = b.seed * 3 + i * 1.3 + t * 0.7, rr = R * (1.1 + ((t * 0.6 + i * 0.37) % 1) * 0.9); ctx.fillRect(x + Math.cos(a) * rr - 1.2, y + Math.sin(a) * rr - 1.2, 2.4, 2.4); }
			ctx.restore();
			return true;
		},
		drawReinforce(ctx, st, s, g, t){
			ctx.globalCompositeOperation = 'source-over';
			ctx.fillStyle = s > 0 ? 'rgba(0,0,0,0.45)' : 'rgba(160,255,210,0.25)';
			if(g.w){
				for(let i = 0; i < 6; i++){ const a = t * 1.3 + i; const px = g.x + g.w / 2 + Math.cos(a) * g.w * 0.6, py = g.y + g.h * (0.2 + 0.6 * ((t * 0.4 + i / 6) % 1)); ctx.beginPath(); ctx.arc(px, py, 2 + st.strength * 2, 0, TAU); ctx.fill(); }
			} else if(g.kind === 'weapon'){
				ctx.strokeStyle = s > 0 ? 'rgba(0,0,0,0.6)' : 'rgba(160,255,210,0.4)'; ctx.lineWidth = 3;
				ctx.beginPath(); ctx.moveTo(g.x0, g.y0); ctx.lineTo(g.x1, g.y1); ctx.stroke();
			}
		}
	});

	/* ==================================================================
	   INFINITY — not an ordinary technique: it turns sufficiently powerful,
	   compressed energy into an Infinity source — a reservoir of that same
	   kind of energy. The engine handles it as a "layer" (def.layer): it
	   does not convert the energy or sit in body.tech; it marks the body
	   as a source (requirements, extraction, stress and backlash live in
	   the engine). Draw Out pulls the source's own kind of energy out.
	   ================================================================== */
	TQ.register({
		id: 'infinity', layer: true, name: 'Infinity', reversedName: 'Reverse Infinity (dissolve the source)',
		description: 'Not an ordinary technique. Turns energy of 450+ E at Compression 20+ into an Infinity source — a reservoir that keeps its own kind of energy (raw, Thermal, Spatial, Gravity, Kinetic, Light …) and never runs dry. Draw Out (with no new target, or targeting the source) pulls that same kind of energy out of it. Compression is its stability: 20–29 extremely unstable, 30–39 very unstable, 40–49 relatively stable, 50 the most stable. Drawing faster than you can control stresses it — too far and it backlashes in a violent explosion. Anti-Magic disrupts its flow and can make it explode; very powerful spells (≈2000+ power) disrupt it too. Spatial energy drawn from Infinity and reinforced into you holds space apart around you. Negative power dissolves a source.',
		color: '#e8fbff', reversedColor: '#9aa8b8',
		balance: { strength: 1 },
		targets: { energy: true, spell: true, zone: false },
		targetNotes: { zone: 'use energy, not a zone' }
	});

	/* ==================================================================
	   GRAVITY — attraction and repulsion
	   ================================================================== */
	TQ.register({
		id: 'gravity', name: 'Gravity', reversedName: 'Reverse Gravity (repulsion)', antiResist: 1.25,
		/* a Gravity zone: heavier gravity for whoever stands in it (you fall faster, jump lower). Reversed: low gravity. */
		zoneInfo: (rev) => rev ? 'low gravity inside: you float, fall slowly and jump higher' : 'high gravity inside: you are heavier, fall faster and jump lower',
		zone(T, Z, s, dt){
			const k = Z.k;
			for(const e of T.zoneCreatures(Z)) T.zoneMod(e, 'gravity', s > 0 ? 1 + 1.2 * k : Math.max(0.3, 1 - 0.65 * k));
		},
		description: 'Manipulates attraction. Gravity energy does no damage and is not used up by touching things: it pulls creatures — you included, unless you switch that off on the rune — toward it and bends the path of other spells and projectiles (reversed: a slight push that grows strong up close). Gravity energy that touches gravity energy combines. It cannot be compressed.',
		color: '#7a5cff', reversedColor: '#c9b8ff',
		palette: { core: '#efe6ff', mid: '#7a5cff', outer: '#24135e' },
		reversePalette: { core: '#ffffff', mid: '#c9b8ff', outer: '#6d5fd0' },
		balance: BAL.gravity,
		/* Construction: Gravity energy weighs a construct down so it drops (reverse: lightens it so it floats); it is not used up.
		   A Gravity construct is heavy (reverse: it floats — a platform that hangs in the air) */
		onConstruct(T, b, s, c, info){
			// Gravity energy striking a construct: it is weighed down so it drops (reverse: lightened so it floats). Strong enough
			// for the construct's mass, it tears an anchored construct loose. It is not used up.
			const F = powerK(T.power(b)) * Math.min(2, Math.abs(s)) * 1.4;
			T.pryConstruct(c, F, 0.35);
			T.weighConstruct(c, s > 0 ? 1 + 1.5 * Math.min(2, s) : Math.max(0, 1 - 0.9 * Math.min(1.2, -s)), 4);
			if(s > 0 && T.constructMovable(c)) T.pushConstruct(c, 0, 2 * Math.min(2, s));
			info.dmg = 0; info.pass = true;
		},
		constructTick(T, c, s, dt){ if(c.core) return; c.gMul *= s > 0 ? 1 + 0.8 * Math.min(2, s) : Math.max(0, 1 - 0.9 * Math.min(1.1, -s)); },      // a Gravity core (Reinforcement) sets it instead
		targets: { energy: true, zone: true, spell: true, environment: true, surface: true, enemy: true, ally: true, self: true },
		params: [ { key: 'you', label: 'Affects you too', type: 'select', options: [ { value: 'yes', label: 'Yes — pulls / pushes you' }, { value: 'no', label: 'No — never you' } ], default: 'yes' } ],
		onApply(T, b, s, ctx){
			// gravity energy cannot be compressed: compressed energy turned to gravity springs back to its normal size
			if(!b.isZone && (b.scale < 1 || b.over) && !b.infSource){ b.scale = 1; b.over = 0; }      // …unless it is an Infinity source (its compression level is kept either way)
			b.gravNoYou = TQ.param(ctx && ctx.params, 'gravity', 'you', 'yes') === 'no';
		},
		tick(T, b, s){
			if(b.coreOf) return;      // a construct's Gravity core: its gravity acts on the construct only (see the engine's constructPass)
			const B = BAL.gravity, R = T.radius(b), P = powerK(T.power(b)), a = Math.min(2.5, Math.abs(s)), G = Math.sign(s);
			// Gravity drawn out of an Infinity source is far stronger: it drags creatures hard (and, attracting, crushes what reaches its core)
			// (Reverse Gravity from Infinity keeps the ordinary push in flight — its violence is in the burst, see Discharge)
			const inf = !!(b.infDerived && !b.infSource && G > 0);
			const range = (B.rangeBase + B.rangePerS * a + R) * (inf ? B.infRange : 1);
			const nudge = T.host().nudge;
			for(const e of T.enemies){
				if(!e || e.dead) continue;
				const c = T.center(e), v = towards(c.x, c.y, b.x, b.y);
				if(v.d > range) continue;
				if(inf && G > 0 && v.d < R + 28 && T.every(e, 'crush' + b.id, B.crushEvery)) T.damage(e, 3 + Math.sqrt(Math.max(0, b.amount)) * 0.9 * Math.min(1.5, a), { x: c.x, y: c.y }, b);
				if(v.d < 4) continue;
				// creatures are pulled more gently than energy, and never faster than a slow walk: a well slows them, it does not lock them
				const cap = B.enemyPullMax * (inf ? B.infEnemyMax : 1) * T.f;
				const k = clamp(B.pullEnemy * B.enemyPullMul * (inf ? B.infEnemyMul : 1) * a * P * gravFall(1 - v.d / range, G) * T.f * G, -cap, cap);
				if(nudge) nudge(e, v.x * k, v.y * k * (inf ? 0.9 : 0.6));
			}
			// it pulls you in too (reversed: pushes you away — barely at the edge, hard up close), unless the rune says not to
			if(nudge && !b.gravNoYou){
				const me = T.caster(b);
				if(me && !(b.focus && b.focus.kind === 'self')){
					const c = T.center(me), v = towards(c.x, c.y, b.x, b.y);
					if(v.d < range && v.d > 4){ const k = B.pullEnemy * B.repelCaster * a * P * gravFall(1 - v.d / range, G) * T.f * G; nudge(me, v.x * k, v.y * k * 0.6); }
				}
			}
			const myG = gravityEnergy(b);
			for(const o of T.nearBodies(b.x, b.y, range, b)){
				if(o.anchored || o.attach || o.zoneBlob || o.immovable || o.coreOf) continue;
				const v = towards(o.x, o.y, b.x, b.y); if(v.d < 2) continue;
				// gravity energy meeting gravity energy of the same kind combines into one
				const og = gravityEnergy(o);
				if(myG && og && Math.sign(og) === Math.sign(myG) && o.ownerId === b.ownerId && v.d < (R + T.radius(o)) * B.mergeReach && !o.infSource && !b.infSource){      // an Infinity source never merges
					if(b.amount >= o.amount) T.merge(b, o); else { T.merge(o, b); return; }
					continue;
				}
				const k = B.pullEnergy * a * gravFall(1 - v.d / range, G) * T.f * G * (T.gravResist ? T.gravResist(o) : 1);      // dense, highly compressed energy is moved less
				o.vx += v.x * k; o.vy += v.y * k; T.capSpeed(o, 26);
				// a spell on a set course (Redirect) re-aims every frame, so gravity bends its path directly
				if(o.guided || o.arrive){ o.x += v.x * k * B.bendGuided; o.y += v.y * k * B.bendGuided; }
			}
			// constructs are pulled too (reverse: pushed): the heavier, the less. An anchored one holds until the pull is strong
			// enough for long enough — then it is torn loose and moves
			gravityOnConstructs(T, b.x, b.y, range, a, P, G, b.inst);
			for(const p of T.foreign()){
				if(!p) continue;
				const v = towards(p.x, p.y, b.x, b.y);
				if(v.d > range || v.d < 2) continue;
				const k = B.pullProjectile * a * gravFall(1 - v.d / range, G) * T.f * G;
				p.vx = (p.vx || 0) + v.x * k; p.vy = (p.vy || 0) + v.y * k;
				T.turnForeign(p, k);      // bent enough by your gravity, it can hit enemies
			}
			// with a target: the energy and its target are drawn together (or pushed apart)
			const fe = T.focusEnt(b);
			if(fe){
				const c = T.center(fe), v = towards(b.x, b.y, c.x, c.y);
				if(!b.anchored && !b.attach){ b.vx += v.x * B.focusSteer * a * T.f * G; b.vy += v.y * B.focusSteer * a * T.f * G; T.capSpeed(b, 26); }
				const self = T.isCaster(b, fe);
				if(nudge && v.d > R + 10) nudge(fe, -v.x * B.linkPull * a * P * T.f * G * (self ? 0.5 : 1), -v.y * B.linkPull * a * P * T.f * G * (self ? 0.25 : 0.6));
			}
		},
		onHit(T, b, s, e, info){
			// gravity energy is not a projectile: it does no damage and passes on, still pulling (or pushing)
			if(gravityEnergy(b)){ info.noDamage = true; info.keep = true; info.cost = 0; return; }
			info.mult *= 1 + 0.1 * Math.min(2, Math.abs(s));
		},
		onSurface(T, b, s){
			// …and touching a wall doesn't end it: it settles there
			return gravityEnergy(b) ? 'rest' : null;
		},
		field(T, src, s){
			const B = BAL.gravity, a = Math.min(2.5, Math.abs(s)) * B.fieldMul, G = Math.sign(s), nudge = T.host().nudge, P = powerK(src.P);
			gravityOnConstructs(T, src.x, src.y, src.r, a * 0.6, P, G, src.body && src.body.inst);
			for(const e of enemiesNear(T, src.x, src.y, src.r)){
				const c = T.center(e), v = towards(c.x, c.y, src.x, src.y), u = 1 - v.d / src.r;
				const k = clamp(B.pullEnemy * B.enemyPullMul * 0.5 * a * P * (G > 0 ? 0.3 + 0.7 * u : gravFall(u, G)) * T.f * G, -B.enemyPullMax * T.f, B.enemyPullMax * T.f);
				if(nudge) nudge(e, v.x * k, v.y * k * 0.5);
			}
			for(const p of T.foreign()){
				if(!p) continue;
				const v = towards(p.x, p.y, src.x, src.y); if(v.d > src.r) continue;
				const k = B.pullProjectile * a * (G > 0 ? 0.6 : gravFall(1 - v.d / src.r, G)) * T.f * G; p.vx = (p.vx || 0) + v.x * k; p.vy = (p.vy || 0) + v.y * k; T.turnForeign(p, k);
			}
		},
		onForeign(T, ref, s){
			// heavier (falls / curves down) or lighter (floats)
			T.modForeign(ref, 'gravity', BAL.gravity.foreignWeight * s, 2 + Math.abs(s));
			T.turnForeign(ref);
		},
		/* its own body: a singularity with an accretion disk (reverse: a white hole); pressed into a shape, a hollow of darkness rimmed by bent light */
		drawBody(ctx, b, x, y, R, s, t, alpha){
			const k = Math.min(1.5, Math.abs(s)), f = ME.curForm(b), sh = ME.SHAPES[b.shape] || ME.SHAPES.raw;
			ctx.save();
			if(f > 0.5 && sh.poly && b.shape !== 'sphere' && b.shape !== 'point') drawGravityShape(ctx, b, x, y, R, s, t, alpha);
			else if(s > 0) drawSingularity(ctx, b, x, y, R, k, t, alpha);
			else drawRepulsor(ctx, b, x, y, R, k, t, alpha);
			ctx.restore();
			return true;
		},
		drawField(ctx, src, x, y, s, t){
			const r = src.r;
			if(s > 0) softDisc(ctx, x, y, r * 0.35, 'rgba(10,4,30,0.35)', 'rgba(10,4,30,0)', 'source-over');
			ctx.globalCompositeOperation = 'lighter';
			ctx.strokeStyle = hexA(s > 0 ? TC('#7a5cff') : TC('#c9b8ff'), 0.2); ctx.lineWidth = 1.2;
			for(let i = 0; i < 4; i++){
				const ph = ((t * 0.35 * (s > 0 ? -1 : 1) + i / 4) % 1 + 1) % 1;
				ctx.globalAlpha = Math.sin(ph * Math.PI);
				ctx.beginPath(); ctx.arc(x, y, r * ph, 0, TAU); ctx.stroke();
			}
		},
		reinforce: {
			// on yourself: high gravity (heavy, sure-footed) — reversed, low gravity (you float)
			self:   { normal: { heavyGravity: 0.8, stability: 0.4, knockbackResist: 0.4 }, reverse: { lowGravity: 0.9 } },
			ally:   { normal: { heavyGravity: 0.6, knockbackResist: 0.5, stability: 0.3 }, reverse: { lowGravity: 0.8 } },
			// a heavy weapon swings slower but hits harder; reversed, a light weapon swings faster but hits softer
			weapon: { normal: { heavyWeapon: 0.8, pullOnHit: 0.6 }, reverse: { lightWeapon: 0.8 } },
			spell:  { normal: { spellStability: 0.3 } }
		},
		onReinforcedHit(T, st, s, e, ev){
			if(s > 0 && ev && ev.knockback){
				// a heavy weapon draws the struck creature in instead of launching it away
				const k = Math.min(1.5, 0.9 * st.strength * Math.abs(s));
				ev.knockback.x *= 1 - k;
			}
		},
		drawReinforce(ctx, st, s, g, t){
			ctx.globalCompositeOperation = 'lighter';
			ctx.strokeStyle = hexA(s > 0 ? TC('#9d85ff') : TC('#d9ccff'), 0.45 * st.strength); ctx.lineWidth = 1.2;
			if(g.w){
				const cx = g.x + g.w / 2, fy = g.y + g.h;
				for(let i = 0; i < 2; i++){ const ph = ((t * 0.6 * (s > 0 ? -1 : 1) + i / 2) % 1 + 1) % 1; ctx.beginPath(); ctx.ellipse(cx, fy, g.w * (0.3 + 0.7 * ph), 4 + 6 * ph, 0, 0, TAU); ctx.stroke(); }
			} else if(g.kind === 'weapon'){
				ctx.beginPath(); ctx.arc(g.x1, g.y1, 5 + 3 * Math.sin(t * 5), 0, TAU); ctx.stroke();
			}
		}
	});

	/* ---- Gravity's look: a small singularity (reverse: a white hole that pushes space outward) ---- */
	const GRAV_DISK = [ '#fbf8ff', '#e6dcff', '#cbb8ff', '#ad93ff', '#8f6cff', '#7350f0', '#5a37d6', '#3f22a8' ];
	function gravDiskBand(ctx, R, inner, outer, a0, a1, t, spin, sd, alpha){
		// the accretion disk, drawn in the disk's own plane (the caller has squashed / tilted the context)
		const bands = GRAV_DISK.length;
		ctx.lineCap = 'butt';
		// a soft underglow so the bands read as one glowing disk
		ctx.globalAlpha = alpha * 0.2; ctx.strokeStyle = TC('#7a5cff'); ctx.lineWidth = R * (outer - inner);
		ctx.beginPath(); ctx.arc(0, 0, R * (inner + outer) / 2, a0, a1); ctx.stroke();
		for(let i = 0; i < bands; i++){
			const u = i / (bands - 1), r = R * (inner + (outer - inner) * u), hot = 1 - u;
			const w = R * (outer - inner) / bands * 1.1;
			// one seamless band, brighter on the side turning toward you (left), dimmer on the side moving away
			const lg = ctx.createLinearGradient(-r, 0, r, 0), c = TC(GRAV_DISK[i]), A = alpha * (0.08 + 0.75 * hot * hot);
			lg.addColorStop(0, hexA(c, Math.min(1, A * 1.5))); lg.addColorStop(0.5, hexA(c, A * 0.8)); lg.addColorStop(1, hexA(c, A * 0.35));
			ctx.globalAlpha = 1; ctx.strokeStyle = lg; ctx.lineWidth = Math.max(0.6, w);
			ctx.beginPath(); ctx.arc(0, 0, r, a0, a1); ctx.stroke();
			// hot clumps orbiting (inner ones faster)
			const sp = (2.4 - 1.6 * u) * spin;
			for(let q = 0; q < 2; q++){
				let m = ((sd * 5 + i * 1.9 + q * Math.PI - t * sp) % TAU + TAU) % TAU;
				if(a1 <= Math.PI){ if(m > Math.PI) continue; } else if(m < Math.PI) continue;
				ctx.globalAlpha = alpha * (0.15 + 0.5 * hot); ctx.strokeStyle = TC('#ffffff'); ctx.lineWidth = Math.max(0.5, w * 0.6);
				ctx.beginPath(); ctx.arc(0, 0, r, m - 0.35, m); ctx.stroke();
			}
		}
	}
	function drawSingularity(ctx, b, x, y, R, k, t, alpha){
		const sd = b.seed || 0, spin = 1, tilt = -0.2 + 0.12 * Math.sin(sd) + 0.04 * Math.sin(t * 0.6 + sd), flat = 0.3;
		const H = R * (0.6 + 0.08 * Math.min(1, k));             // the event horizon
		// space darkens around it
		ctx.globalCompositeOperation = 'source-over';
		let g = ctx.createRadialGradient(x, y, H * 0.6, x, y, R * 2.8);
		g.addColorStop(0, 'rgba(4,1,14,' + (0.7 * alpha) + ')'); g.addColorStop(0.4, 'rgba(10,4,32,' + (0.3 * alpha) + ')'); g.addColorStop(1, 'rgba(10,4,32,0)');
		ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R * 2.8, 0, TAU); ctx.fill();
		ctx.globalCompositeOperation = 'lighter';
		g = ctx.createRadialGradient(x, y, H, x, y, R * 2.3);
		g.addColorStop(0, hexA('#8a6bff', 0.4 * alpha)); g.addColorStop(0.45, hexA('#4a2bb8', 0.14 * alpha)); g.addColorStop(1, hexA('#24135e', 0));
		ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R * 2.3, 0, TAU); ctx.fill();
		// the far half of the disk (behind the horizon)
		ctx.save(); ctx.translate(x, y); ctx.rotate(tilt); ctx.scale(1, flat);
		gravDiskBand(ctx, R, 0.95, 2.15, Math.PI, TAU, t, spin, sd, alpha);
		ctx.restore();
		// light from the far side of the disk, bent up over the top of the horizon (and, fainter, under it)
		ctx.save(); ctx.translate(x, y); ctx.rotate(tilt);
		for(const side of [-1, 1]){
			for(const pass of [0, 1]){
				ctx.globalAlpha = alpha * (side < 0 ? 1 : 0.45) * (pass ? 0.95 : 0.3);
				const lg = ctx.createLinearGradient(-H * 1.4, 0, H * 1.4, 0);
				lg.addColorStop(0, hexA('#7a5cff', 0)); lg.addColorStop(0.3, TC('#b9a3ff')); lg.addColorStop(0.5, TC('#ffffff')); lg.addColorStop(0.7, TC('#b9a3ff')); lg.addColorStop(1, hexA('#7a5cff', 0));
				ctx.strokeStyle = lg; ctx.lineWidth = Math.max(0.8, R * (pass ? 0.07 : 0.26) * (side < 0 ? 1 : 0.6));
				const ry = H * (side < 0 ? 1.28 : 1.12);
				ctx.beginPath(); ctx.ellipse(0, 0, H * 1.2, ry, 0, side < 0 ? Math.PI * 1.02 : Math.PI * 0.12, side < 0 ? Math.PI * 1.98 : Math.PI * 0.88); ctx.stroke();
			}
		}
		ctx.restore();
		// the horizon: perfectly black
		ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = alpha;
		ctx.fillStyle = TC('#000000'); ctx.beginPath(); ctx.arc(x, y, H, 0, TAU); ctx.fill();
		// the photon ring: a thin, flickering line of trapped light with a soft glow
		ctx.globalCompositeOperation = 'lighter';
		g = ctx.createRadialGradient(x, y, H * 0.92, x, y, H * 1.35);
		g.addColorStop(0, hexA('#c9b8ff', 0)); g.addColorStop(0.18, hexA('#e9e1ff', 0.55 * alpha)); g.addColorStop(0.45, hexA('#8a6bff', 0.22 * alpha)); g.addColorStop(1, hexA('#5a37d6', 0));
		ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, H * 1.35, 0, TAU); ctx.arc(x, y, H * 0.98, 0, TAU, true); ctx.fill();
		ctx.globalAlpha = alpha * (0.8 + 0.2 * Math.sin(t * 5 + sd));
		ctx.strokeStyle = TC('#fbf8ff'); ctx.lineWidth = Math.max(0.6, R * 0.035);
		ctx.beginPath(); ctx.arc(x, y, H * 1.03, 0, TAU); ctx.stroke();
		// the near half of the disk, crossing in front of the horizon
		ctx.save(); ctx.translate(x, y); ctx.rotate(tilt); ctx.scale(1, flat);
		gravDiskBand(ctx, R, 0.95, 2.15, 0, Math.PI, t, spin, sd, alpha);
		// motes of matter spiralling in, each with a short tail
		ctx.lineCap = 'round';
		for(let i = 0; i < 10; i++){
			const u = ((t * 0.4 + i / 10 + sd * 0.13) % 1 + 1) % 1, r = R * (2.6 - 1.5 * u), a = sd * 3 + i * 2.39 + u * 5 * spin;
			const r2 = R * (2.6 - 1.5 * Math.max(0, u - 0.06)), a2 = sd * 3 + i * 2.39 + Math.max(0, u - 0.06) * 5 * spin;
			ctx.globalAlpha = alpha * Math.sin(u * Math.PI) * 0.85;
			ctx.strokeStyle = u > 0.6 ? TC('#ffffff') : TC('#cbb8ff'); ctx.lineWidth = Math.max(0.8, R * 0.06);
			ctx.beginPath(); ctx.moveTo(Math.cos(a2) * r2, Math.sin(a2) * r2); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); ctx.stroke();
		}
		ctx.restore();
		ctx.globalAlpha = 1;
	}
	function drawRepulsor(ctx, b, x, y, R, k, t, alpha){
		const sd = b.seed || 0;
		ctx.globalCompositeOperation = 'lighter';
		// a soft bright halo
		let g = ctx.createRadialGradient(x, y, 0, x, y, R * 2.5);
		g.addColorStop(0, hexA('#ffffff', 0.5 * alpha)); g.addColorStop(0.22, hexA('#e3d9ff', 0.3 * alpha)); g.addColorStop(0.55, hexA('#9d8bff', 0.1 * alpha)); g.addColorStop(1, hexA('#6d5fd0', 0));
		ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R * 2.5, 0, TAU); ctx.fill();
		// soft shockwaves of pushed space running outward
		for(let i = 0; i < 3; i++){
			const ph = ((t * 0.6 + i / 3 + sd * 0.1) % 1 + 1) % 1, rr = R * (0.7 + 1.9 * ph), w = R * (0.18 + 0.25 * ph);
			const a = alpha * Math.pow(1 - ph, 1.5) * 0.75;
			g = ctx.createRadialGradient(x, y, Math.max(0, rr - w), x, y, rr + w);
			g.addColorStop(0, hexA('#c9b8ff', 0)); g.addColorStop(0.5, hexA('#f1ecff', a)); g.addColorStop(1, hexA('#8f7bff', 0));
			ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rr + w, 0, TAU); ctx.arc(x, y, Math.max(0.1, rr - w), 0, TAU, true); ctx.fill();
		}
		// motes thrown outward, trailing light
		ctx.lineCap = 'round';
		for(let i = 0; i < 12; i++){
			const u = ((t * 0.55 + i / 12 + sd * 0.17) % 1 + 1) % 1, a = sd * 2 + i * 2.39 + u * 0.6;
			const r0 = R * (0.55 + 2 * u), r1 = Math.max(R * 0.5, r0 - R * (0.25 + 0.35 * u));
			const la = alpha * Math.sin(u * Math.PI) * 0.8;
			const lg = ctx.createLinearGradient(x + Math.cos(a) * r1, y + Math.sin(a) * r1, x + Math.cos(a) * r0, y + Math.sin(a) * r0);
			lg.addColorStop(0, hexA('#c9b8ff', 0)); lg.addColorStop(1, hexA('#ffffff', la));
			ctx.strokeStyle = lg; ctx.lineWidth = Math.max(0.8, R * 0.07 * (1 - u * 0.5));
			ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); ctx.lineTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); ctx.stroke();
		}
		// a brilliant core that breathes, with soft slowly-turning rays
		const pr = R * (0.6 + 0.07 * Math.sin(t * 4 + sd));
		ctx.save(); ctx.translate(x, y); ctx.rotate(t * 0.4 + sd);
		for(let i = 0; i < 6; i++){
			ctx.rotate(TAU / 6);
			const L = R * (1.3 + 0.25 * Math.sin(t * 2.3 + i * 1.7 + sd));
			const rg = ctx.createLinearGradient(0, 0, L, 0);
			rg.addColorStop(0, hexA('#ffffff', 0.55 * alpha)); rg.addColorStop(1, hexA('#c9b8ff', 0));
			ctx.fillStyle = rg; ctx.beginPath(); ctx.moveTo(0, -R * 0.09); ctx.lineTo(L, 0); ctx.lineTo(0, R * 0.09); ctx.closePath(); ctx.fill();
		}
		ctx.restore();
		ctx.globalAlpha = alpha;
		g = ctx.createRadialGradient(x, y, 0, x, y, pr);
		g.addColorStop(0, TC('#ffffff')); g.addColorStop(0.5, TC('#f1ecff')); g.addColorStop(1, hexA('#b6a4ff', 0));
		ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, pr, 0, TAU); ctx.fill();
		ctx.globalAlpha = 1;
	}
	/* gravity pressed into a shape: the shape is a hollow of darkness rimmed by bent light (reverse: a shape of bright, pushing space) */
	function drawGravityShape(ctx, b, x, y, R, s, t, alpha){
		const pts = ME.outline(b, x, y, R, t), f = ME.curForm(b), sh = ME.SHAPES[b.shape] || ME.SHAPES.raw, sharp = f > 0.72 && !sh.smooth && !!sh.poly;
		ctx.save();
		if(s > 0){
			ctx.globalCompositeOperation = 'source-over';
			let g = ctx.createRadialGradient(x, y, 0, x, y, R * 2.2);
			g.addColorStop(0, 'rgba(6,2,20,' + (0.5 * alpha) + ')'); g.addColorStop(1, 'rgba(6,2,20,0)');
			ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R * 2.2, 0, TAU); ctx.fill();
			ctx.globalAlpha = alpha;
			g = ctx.createRadialGradient(x, y, 0, x, y, R * 1.4);
			g.addColorStop(0, TC('#000000')); g.addColorStop(0.7, TC('#07021a')); g.addColorStop(1, TC('#1b0b4a'));
			ctx.fillStyle = g; ctx.beginPath(); ME.tracePath(ctx, pts, sharp); ctx.fill();
			// light bending around its edge, flowing inward
			ctx.globalCompositeOperation = 'lighter';
			ctx.globalAlpha = alpha * 0.35; ctx.strokeStyle = TC('#7a5cff'); ctx.lineWidth = Math.max(2, R * 0.28);
			ctx.beginPath(); ME.tracePath(ctx, pts, sharp); ctx.stroke();
			ctx.globalAlpha = alpha * 0.9; ctx.strokeStyle = TC('#efe6ff'); ctx.lineWidth = Math.max(0.8, R * 0.06);
			ctx.beginPath(); ME.tracePath(ctx, pts, sharp); ctx.stroke();
			// motes drawn into it from the edge
			const N = ME.N_PTS; ctx.fillStyle = TC('#d9ccff');
			for(let i = 0; i < 8; i++){
				const u = ((t * 0.6 + i / 8 + (b.seed || 0) * 0.1) % 1 + 1) % 1, j = ((i * 7 + Math.floor((b.seed || 0) * 10)) % N);
				const px = pts[j * 2], py = pts[j * 2 + 1], ex = px + (px - x) * 0.5 * (1 - u), ey = py + (py - y) * 0.5 * (1 - u);
				const qx = ex + (x - ex) * u * 0.6, qy = ey + (y - ey) * u * 0.6;
				ctx.globalAlpha = alpha * Math.sin(u * Math.PI) * 0.8; ctx.fillRect(qx - 1, qy - 1, 2, 2);
			}
		} else {
			ctx.globalCompositeOperation = 'lighter';
			let g = ctx.createRadialGradient(x, y, 0, x, y, R * 2);
			g.addColorStop(0, hexA('#ffffff', 0.4 * alpha)); g.addColorStop(0.5, hexA('#c9b8ff', 0.15 * alpha)); g.addColorStop(1, hexA('#6d5fd0', 0));
			ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R * 2, 0, TAU); ctx.fill();
			ctx.globalAlpha = alpha * 0.85;
			g = ctx.createRadialGradient(x, y, 0, x, y, R * 1.4);
			g.addColorStop(0, TC('#ffffff')); g.addColorStop(0.5, TC('#e2d8ff')); g.addColorStop(1, TC('#9d8bff'));
			ctx.fillStyle = g; ctx.beginPath(); ME.tracePath(ctx, pts, sharp); ctx.fill();
			const ph = ((t * 0.9 + (b.seed || 0)) % 1 + 1) % 1;
			ctx.globalAlpha = alpha * (1 - ph) * 0.7; ctx.strokeStyle = TC('#f4f0ff'); ctx.lineWidth = 1.5;
			ctx.save(); ctx.translate(x, y); ctx.scale(1 + ph * 0.5, 1 + ph * 0.5); ctx.translate(-x, -y);
			ctx.beginPath(); ME.tracePath(ctx, pts, sharp); ctx.stroke(); ctx.restore();
		}
		ctx.restore();
	}

	/* ==================================================================
	   KINETIC — motion, momentum and the transfer of force
	   ================================================================== */
	TQ.register({
		id: 'kinetic', combines: true, name: 'Kinetic', reversedName: 'Reverse Kinetic (deceleration)', antiResist: 1,
		/* a Kinetic zone: everything inside — you, creatures, projectiles and energy — speeds up the longer it stays
		   (the engine ramps each one's speed). Reversed: everything inside slows down over time. */
		zoneInfo: (rev) => rev ? 'everything inside slows down the longer it stays' : 'everything inside (you, creatures, projectiles, energy) speeds up the longer it stays',
		zone(T, Z, s, dt){
			if(Math.random() < Z.r * 0.0015 * Z.k * T.f){
				const a = Math.random() * TAU, rr = Math.sqrt(Math.random()) * Z.r, v = s > 0 ? 3 : 0.6, d = Math.random() * TAU;
				T.spark(Z.x + Math.cos(a) * rr, Z.y + Math.sin(a) * rr, Math.cos(d) * v, Math.sin(d) * v, s > 0 ? TC('#ffd84d') : TC('#c8d6e6'), 18);
			}
		},
		spriteRotate: true,      // crowd stamps: its streaks are drawn along its motion
		description: 'Manipulates motion and force. Normal energy keeps accelerating and hits harder, transferring force into what it strikes; reversed energy loses momentum and drains it from what it touches.',
		color: '#ffd84d', reversedColor: '#9fb3c8',
		palette: { core: '#fffbe6', mid: '#ffd84d', outer: '#e08a1a' },
		reversePalette: { core: '#f0f6ff', mid: '#9fb3c8', outer: '#4a5a70' },
		balance: BAL.kinetic,
		/* Construction: Kinetic energy shoves a construct hard (reverse: stops it); a Kinetic construct keeps speeding up
		   while it moves and flings creatures that touch it (reverse: slows them) */
		onConstruct(T, b, s, c, info){
			if(s > 0) info.impulse *= 1 + 2.5 * Math.min(2, s);
			else { info.impulse = 0; if(T.constructMovable(c)){ c.vx *= 0.3; c.vy *= 0.3; } info.dmg *= 0.6; }
		},
		constructTick(T, c, s, dt){
			if(s > 0 && T.constructMovable(c)){ const sp = Math.hypot(c.vx, c.vy); if(sp > 0.8){ const k = 1 + 0.6 * Math.min(2, s) * dt; c.vx *= k; c.vy *= k; } }
			if(!T.every(c, 'kineticTouch', 0.4)) return;
			for(const e of touchingConstruct(T, c, 3)) this.constructTouch(T, c, s, e);
		},
		constructTouch(T, c, s, e){
			if(s > 0){ const p = T.center(e), dx = p.x - c.x, dy = p.y - c.y, d = Math.hypot(dx, dy) || 1, k = 4 + 4 * Math.min(2, s); T.knock(e, dx / d * k, Math.min(-2, dy / d * k), 12); }
			else T.status(e, 'slowed', 1, 1.2);
		},
		targets: { energy: true, zone: true, spell: true, environment: true, surface: true, enemy: true, ally: true, self: true },
		params: [ { key: 'bounces', label: 'Max bounces', type: 'int', min: 0, max: 10, step: 1, default: 3, show: (p) => Number(p.power) > 0 } ],
		onApply(T, b, s, ctx){
			const sp = speedOf(b);
			if(sp > 0.3){ const k = s > 0 ? 1 + 0.25 * Math.min(2, s) : Math.max(0.1, 1 - 0.3 * Math.min(3, -s)); b.vx *= k; b.vy *= k; }
			b.kinBounces = clamp(Math.round(Number(TQ.param(ctx && ctx.params, 'kinetic', 'bounces', 3))), 0, 10); b._kBounce = 0;
		},
		tick(T, b, s){
			const B = BAL.kinetic, sp = speedOf(b);
			if(s > 0){
				if(sp > 0.3 && !(b.arrive)){
					const cap = Math.min(40, 26 * (1 + (B.maxSpeedMul - 1) * Math.min(2, s) / 2));
					const ns = Math.min(cap, sp + B.accel * Math.min(2, s) * T.f);
					b.vx *= ns / sp; b.vy *= ns / sp;
				}
			} else if(sp > 0.05){
				const k = Math.max(0, 1 - B.brake * Math.min(3, -s) * T.f);
				b.vx *= k; b.vy *= k;
			}
		},
		onHit(T, b, s, e, info){
			const B = BAL.kinetic, sp = speedOf(b), a = Math.min(2, Math.abs(s));
			if(s > 0){
				const mom = clamp(sp / 9, 0.5, 2.2);
				info.mult *= 1 + B.impactPerS * a * mom;
				const ux = sp > 0.1 ? b.vx / sp : 1, uy = sp > 0.1 ? b.vy / sp : 0;
				T.knock(e, ux * B.knockPerS * a * mom, uy * B.knockPerS * a * mom - 2, 16);
			} else {
				info.mult *= Math.max(0.5, 1 - 0.15 * a);
				T.status(e, 'slowed', Math.min(1, 0.4 * a), 1.5 + a);
			}
		},
		onSurface(T, b, s){
			const B = BAL.kinetic;
			if(s > 0){
				// it bounces off surfaces (up to its bounce limit), knocking a small shock into the wall each time
				const max = b.kinBounces != null ? b.kinBounces : 3;
				if((b._kBounce || 0) < max && speedOf(b) > 1){
					b._kBounce = (b._kBounce || 0) + 1;
					T.ring(b.x, b.y, 3, 22, 12, TC('#ffd84d'));
					return 'reflect';
				}
				// out of bounces: the energy's force goes into the surface as a shockwave
				const P = powerK(T.power(b)), r = B.shockRadius * (0.8 + 0.4 * Math.min(2, s));
				for(const e of enemiesNear(T, b.x, b.y, r)){ const c = T.center(e), v = towards(b.x, b.y, c.x, c.y); T.knock(e, v.x * 6 * P * s, -3 - 2 * s, 14); }
				T.ring(b.x, b.y, 6, r, 18, TC('#ffd84d'));
				return null;
			}
			return 'rest';     // momentum gone: it settles against the surface
		},
		field(T, src, s){
			const B = BAL.kinetic, a = Math.min(2, Math.abs(s));
			for(const p of T.foreign()){
				if(!p) continue;
				if(Math.hypot(p.x - src.x, p.y - src.y) > src.r) continue;
				const sp = Math.hypot(p.vx || 0, p.vy || 0); if(sp < 0.05) continue;
				if(s > 0){ if(!p._kinBase) p._kinBase = sp; if(sp < p._kinBase * 1.6){ p.vx *= 1 + 0.01 * a; p.vy *= 1 + 0.01 * a; } }
				else { if(!p._kinBase) p._kinBase = sp; if(sp > p._kinBase * 0.2){ p.vx *= 1 - B.fieldDamp * a; p.vy *= 1 - B.fieldDamp * a; } }
			}
			for(const e of enemiesNear(T, src.x, src.y, src.r)){
				if(s < 0){ if(T.every(e, 'kinF' + src.body.id, 0.5)) T.status(e, 'slowed', Math.min(1, 0.3 * a), 1); }
				else if(T.host().nudge){
					const b = src.body, sp = speedOf(b);
					const ux = sp > 0.2 ? b.vx / sp : (T.center(e).x > src.x ? 1 : -1), uy = sp > 0.2 ? b.vy / sp : 0;
					T.host().nudge(e, ux * B.fieldPush * a * T.f, uy * B.fieldPush * a * T.f * 0.5);
				}
			}
		},
		onForeign(T, ref, s){
			const B = BAL.kinetic, k = s > 0 ? 1 + B.foreignMul * Math.min(2, s) : Math.max(0.15, 1 - (B.foreignMul + 0.05) * Math.min(3, -s));
			ref.vx = (ref.vx || 0) * k; ref.vy = (ref.vy || 0) * k;
		},
		draw(ctx, b, x, y, R, s, t, lod){
			const sp = speedOf(b);
			ctx.globalCompositeOperation = 'lighter';
			if(s > 0){
				if(sp < 0.4){ ctx.strokeStyle = hexA('#ffe27a', 0.4); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, y, R * (1.3 + 0.15 * Math.sin(t * 10)), 0, TAU); ctx.stroke(); return; }
				const ux = b.vx / sp, uy = b.vy / sp, L = R * (1.2 + Math.min(4, sp / 6));
				ctx.strokeStyle = hexA('#fff1a8', 0.55); ctx.lineWidth = 1.4; ctx.lineCap = 'round';
				for(let i = -2; i <= 2; i++){
					if(lod && i % 2) continue;
					const o = i * R * 0.35, len = L * (1 - Math.abs(i) * 0.18) * (0.8 + 0.2 * Math.sin(t * 20 + i));
					const sx = x - uy * o - ux * R * 0.6, sy = y + ux * o - uy * R * 0.6;
					ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - ux * len, sy - uy * len); ctx.stroke();
				}
				// pressure front ahead of it
				ctx.strokeStyle = hexA('#ffd84d', 0.45); ctx.lineWidth = 1.6;
				ctx.beginPath(); ctx.arc(x + ux * R * 0.3, y + uy * R * 0.3, R * 1.25, Math.atan2(uy, ux) - 0.9, Math.atan2(uy, ux) + 0.9); ctx.stroke();
			} else {
				ctx.strokeStyle = hexA('#c8d6e6', 0.45); ctx.lineWidth = 1.3;
				const ux = sp > 0.3 ? b.vx / sp : 1, uy = sp > 0.3 ? b.vy / sp : 0, a = Math.atan2(uy, ux);
				for(let i = 0; i < (lod ? 1 : 3); i++){
					const r = R * (1.2 + i * 0.25 + 0.05 * Math.sin(t * 4 + i));
					ctx.beginPath(); ctx.arc(x, y, r, a - 0.6, a + 0.6); ctx.stroke();
				}
			}
		},
		drawField(ctx, src, x, y, s, t){
			const r = src.r, b = src.body, sp = speedOf(b);
			ctx.globalCompositeOperation = 'lighter';
			ctx.strokeStyle = hexA(s > 0 ? TC('#ffd84d') : TC('#9fb3c8'), 0.18); ctx.lineWidth = 1;
			const ux = sp > 0.2 ? b.vx / sp : 1, uy = sp > 0.2 ? b.vy / sp : 0;
			for(let i = 0; i < 9; i++){
				const o = ((i / 9) * 2 - 1) * r * 0.85, half = Math.sqrt(Math.max(0, r * r - o * o));
				const ph = s > 0 ? ((t * 0.8 + i * 0.13) % 1) : 0.5;
				const cx = x - uy * o + ux * half * (ph * 2 - 1), cy = y + ux * o + uy * half * (ph * 2 - 1);
				const L = s > 0 ? 18 : 4;
				ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx - ux * L, cy - uy * L); ctx.stroke();
			}
		},
		reinforce: {
			self:   { normal: { moveForce: 0.6, jumpForce: 0.6, meleeDamage: 0.3 }, reverse: { knockbackResist: 0.6, stability: 0.4 } },
			ally:   { normal: { moveForce: 0.5, meleeDamage: 0.2 }, reverse: { knockbackResist: 0.5 } },
			weapon: { normal: { impact: 0.5, forceTransfer: 0.8 }, reverse: { stability: 0.5 } },
			spell:  { normal: { spellImpact: 0.4 }, reverse: { spellStability: 0.3 } }
		},
		drawReinforce(ctx, st, s, g, t){
			ctx.globalCompositeOperation = 'lighter';
			if(g.kind === 'weapon' && s > 0){
				ctx.strokeStyle = hexA('#fff1a8', 0.5 * st.strength); ctx.lineWidth = 1.2;
				const dx = g.x1 - g.x0, dy = g.y1 - g.y0, L = Math.hypot(dx, dy) || 1;
				for(let i = 0; i < 3; i++){ const u = 0.4 + i * 0.25, px = g.x0 + dx * u, py = g.y0 + dy * u; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + dy / L * 8, py - dx / L * 8); ctx.stroke(); }
			} else if(g.w && s > 0){
				const ref = st.ref, vx = ref && ref.vx || 0;
				if(Math.abs(vx) > 1){
					ctx.strokeStyle = hexA('#fff1a8', 0.45 * st.strength); ctx.lineWidth = 1.3;
					const dir = vx > 0 ? -1 : 1;
					for(let i = 0; i < 4; i++){ const yy = g.y + g.h * (0.3 + i * 0.17), x0 = g.x + g.w / 2 + dir * g.w * 0.45; ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x0 + dir * (10 + Math.abs(vx) * 2), yy); ctx.stroke(); }
				}
			}
		}
	});

	/* ==================================================================
	   LIGHT — illumination, concentration, reflection
	   ================================================================== */
	TQ.register({
		id: 'light', name: 'Light', reversedName: 'Reverse Light (absorption)', antiResist: 0.9,
		/* a Light zone: everything inside is brightly lit and Light energy travels faster. Reversed: the area goes dark —
		   dark enough that reverse Light energy inside blends in and is hard to see. */
		zoneInfo: (rev) => rev ? 'the area goes dark; reverse Light energy inside is nearly invisible' : 'the area is brightly lit; Light energy inside travels faster',
		zone(T, Z, s, dt){
			const k = Z.k;
			if(s > 0){
				T.light(Z.x, Z.y, Z.r * 1.15, [255, 242, 205], 0.55 + 0.35 * k);
				T.bright(Z.x, Z.y, Z.r, k);
				for(const o of T.zoneBodies(Z)) if(ME.techOf(o, 'light') > 0) T.zoneFlag(o, 'light', k);
			} else {
				T.dark(Z.x, Z.y, Z.r, k);
				for(const o of T.zoneBodies(Z)) if(ME.techOf(o, 'light') < 0) T.zoneFlag(o, 'dark', k);
			}
		},
		spriteRotate: true, spriteBlend: (s) => s < 0 ? 'source-over' : 'lighter',      // crowd stamps: drawn along its motion; darkness is laid over the scene
		description: 'Manipulates light. Light energy illuminates, always travels at 18 and passes straight through enemies and surfaces (infinite pierce). Reversed, it absorbs light and dims the energy of projectiles that cross it.',
		color: '#fff3b0', reversedColor: '#5a4a7a',
		palette: { core: '#ffffff', mid: '#fff3b0', outer: '#ffcf5a' },
		reversePalette: { core: '#d9c8ff', mid: '#4a3a6e', outer: '#160c2c' },
		balance: BAL.light,
		/* Construction: solid matter blocks light — Light energy (which passes through surfaces) is stopped by a construct.
		   A Light construct glows and dazzles what touches it; a reverse Light construct darkens the area around it */
		onConstruct(T, b, s, c, info){ info.pass = false; info.reflect = false; info.dmg *= 0.5; },
		constructTick(T, c, s, dt){
			if(s > 0) T.light(c.x, c.y, c.geo.R * 2 + 40, [255, 246, 214], 0.5 + 0.2 * Math.min(2, s));
			else if(T.dark) T.dark(c.x, c.y, c.geo.R * 1.6 + 30, 0.5);
			if(s > 0 && T.every(c, 'lightTouch', 0.6)) for(const e of touchingConstruct(T, c, 4)) this.constructTouch(T, c, s, e);
		},
		constructTouch(T, c, s, e){ if(s > 0) T.status(e, 'dazzle', 1, BAL.light.dazzleTime); },
		drawConstruct(ctx, c, s, x, y, t, P, outline){
			if(s <= 0) return;
			ctx.globalCompositeOperation = 'lighter';
			ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t * 3); ctx.strokeStyle = TC('#fff6d0'); ctx.lineWidth = 4; (outline ? outline(ctx, 2) : partPath(ctx, P, 2)); ctx.stroke();
		},
		targets: { energy: true, zone: true, spell: true, environment: true, surface: true, enemy: true, self: false, ally: false },
		targetNotes: { self: 'light cannot be put into a body — use Reinforcement', ally: 'light cannot be put into a body — use Reinforcement' },
		onApply(T, b, s, ctx){
			const sp = speedOf(b);
			if(s > 0 && sp > 0.3){ const k = Math.min(34 / sp, 1 + BAL.light.speedMul * Math.min(2, s)); b.vx *= k; b.vy *= k; }
		},
		tick(T, b, s){
			const B = BAL.light, R = T.radius(b);
			if(s > 0){
				T.light(b.x, b.y, B.lightRadius + R * 2 + 50 * Math.min(2, s), [255, 240, 190], 0.5 + 0.3 * Math.min(2, s));
			} else {
				// absorbs: projectiles crossing it lose energy (never deleted)
				for(const p of T.foreign()){
					if(!p || p.dmg == null) continue;
					if(Math.hypot(p.x - b.x, p.y - b.y) > R * 2.2) continue;
					if(p._origDmg == null) p._origDmg = p.dmg;
					p.dmg = Math.max(p._origDmg * 0.4, p.dmg * (1 - B.absorb * Math.min(3, -s) * T.f));
				}
			}
		},
		onHit(T, b, s, e, info){
			const B = BAL.light, a = Math.min(2.5, Math.abs(s));
			if(s > 0){
				info.mult *= 1 + B.dmgPerS * a * Math.max(1, 1 / Math.max(0.2, b.scale));      // concentrated light burns hotter
				T.status(e, 'dazzle', Math.min(1, 0.5 * a), B.dazzleTime + 0.4 * a);
				info.keep = true; info.cost = 0;      // light passes straight through — infinite pierce
			} else {
				info.mult *= 0.85;
				T.status(e, 'obscured', Math.min(1, 0.5 * a), 1.5 + a);
			}
		},
		onSurface(T, b, s){
			// light shines straight through walls and floors
			return s > 0 ? 'pass' : null;
		},
		field(T, src, s){
			const a = Math.min(2, Math.abs(s));
			if(s > 0){
				T.light(src.x, src.y, src.r * 1.2, [255, 240, 190], 0.6 + 0.3 * a);
				for(const e of enemiesNear(T, src.x, src.y, src.r)) if(T.every(e, 'lightF' + src.body.id, 0.7)) T.status(e, 'dazzle', Math.min(0.8, 0.3 * a), 0.9);
			} else {
				for(const e of enemiesNear(T, src.x, src.y, src.r)) if(T.every(e, 'darkF' + src.body.id, 0.7)) T.status(e, 'obscured', Math.min(0.8, 0.3 * a), 0.9);
				for(const p of T.foreign()){
					if(!p || p.dmg == null || Math.hypot(p.x - src.x, p.y - src.y) > src.r) continue;
					if(p._origDmg == null) p._origDmg = p.dmg;
					p.dmg = Math.max(p._origDmg * 0.5, p.dmg * (1 - 0.006 * a * T.f));
				}
			}
		},
		onForeign(T, ref, s){
			if(s > 0) ref._magicLit = Math.max(ref._magicLit || 0, s);     // lit up — easier to see, nothing more
			else if(ref.dmg != null){ if(ref._origDmg == null) ref._origDmg = ref.dmg; ref.dmg = Math.max(ref._origDmg * 0.4, ref.dmg * (1 - 0.2 * Math.min(3, -s))); }
		},
		draw(ctx, b, x, y, R, s, t, lod){
			const k = Math.min(1.5, Math.abs(s));
			if(s > 0){
				ctx.globalCompositeOperation = 'lighter';
				softDisc(ctx, x, y, R * (2.6 + k), hexA('#fff6d0', 0.28 * k), hexA('#ffd36b', 0));
				const sp = speedOf(b);
				if(sp > 6){   // a beam leaves a straight bright track
					const ux = b.vx / sp, uy = b.vy / sp, L = R * 2 + sp * 4;
					ctx.strokeStyle = hexA('#ffffff', 0.55); ctx.lineWidth = Math.max(1, R * 0.35); ctx.lineCap = 'round';
					ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - ux * L, y - uy * L); ctx.stroke();
				}
				if(lod) return;
				ctx.strokeStyle = hexA('#fffbe8', 0.65); ctx.lineWidth = 1;
				const n = 8;
				for(let i = 0; i < n; i++){   // sharp rays
					const a = i / n * TAU + t * 0.4 + b.seed, L = R * (1.5 + 1.2 * ((i % 2) ? 0.5 : 1) * (0.8 + 0.2 * Math.sin(t * 6 + i)));
					ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * R * 0.8, y + Math.sin(a) * R * 0.8); ctx.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); ctx.stroke();
				}
			} else {
				softDisc(ctx, x, y, R * (2.2 + 0.4 * k), 'rgba(6,2,16,' + (0.55 * Math.min(1, k)).toFixed(2) + ')', 'rgba(6,2,16,0)', 'source-over');
				ctx.globalCompositeOperation = 'lighter';
				ctx.strokeStyle = hexA('#8a6ad8', 0.35); ctx.lineWidth = 1;
				ctx.beginPath(); ctx.arc(x, y, R * (1.8 + 0.1 * Math.sin(t * 2)), 0, TAU); ctx.stroke();
			}
		},
		drawField(ctx, src, x, y, s, t){
			const r = src.r, k = Math.min(1, Math.abs(s));
			if(s > 0) softDisc(ctx, x, y, r, hexA('#fff6d0', 0.16 * k), hexA('#ffd36b', 0));
			else softDisc(ctx, x, y, r, 'rgba(6,2,16,' + (0.45 * k).toFixed(2) + ')', 'rgba(6,2,16,0)', 'source-over');
		},
		reinforce: {
			self:   { normal: { illumination: 1 } },
			weapon: { normal: { dazzleOnHit: 0.7, impact: 0.12 } },
			spell:  { normal: { spellImpact: 0.25 }, reverse: { spellStability: 0.15 } }
		},
		onReinforcedHit(T, st, s, e){ if(s > 0) T.status(e, 'dazzle', Math.min(1, 0.3 + 0.5 * st.strength * s), 1.2); },
		drawReinforce(ctx, st, s, g, t){
			if(s <= 0) return;
			ctx.globalCompositeOperation = 'lighter';
			if(g.kind === 'weapon'){
				ctx.strokeStyle = hexA('#ffffff', 0.6 * st.strength); ctx.lineWidth = 1.5;
				ctx.beginPath(); ctx.moveTo(g.x0, g.y0); ctx.lineTo(g.x1, g.y1); ctx.stroke();
				const u = (t * 1.3) % 1, px = g.x0 + (g.x1 - g.x0) * u, py = g.y0 + (g.y1 - g.y0) * u, L = 5;
				ctx.beginPath(); ctx.moveTo(px - L, py); ctx.lineTo(px + L, py); ctx.moveTo(px, py - L); ctx.lineTo(px, py + L); ctx.stroke();
			} else if(g.w){
				softDisc(ctx, g.x + g.w / 2, g.y + g.h * 0.2, g.w * 0.9, hexA('#fff6d0', 0.35 * st.strength), hexA('#ffd36b', 0));
			}
		}
	});

	/* ==================================================================
	   CONSTRUCTION — energy made into matter. The energy is used up and a
	   solid construct takes its place: a world object with real collision
	   (you can stand on it, walls block, projectiles break against it),
	   integrity that damage wears down, and a limited life. Its form is the
	   energy's Shape; its size and toughness come from how much energy there
	   was and how dense (compressed) it was. Reversed, it dismantles one of
	   your constructs back into raw energy for the rest of the spell.
	   The engine owns the construct world objects (CONSTRUCTS in
	   magic-engine.js); this definition only decides when and how.
	   ================================================================== */
	const FACING_OPTS = [
		{ value: 'facing', label: 'The way you face' },
		{ value: 'up', label: 'Pointing up' },
		{ value: 'down', label: 'Pointing down' },
		{ value: 'right', label: 'Pointing right' },
		{ value: 'left', label: 'Pointing left' },
		{ value: 'energy', label: 'The way the energy travels' }
	];
	TQ.register({
		id: 'construction', name: 'Construction', reversedName: 'Reverse Construction (dismantle)',
		keepsTech: true,           // the technique its energy already had stays with the construct as its material (Thermal → a burning wall)
		bodyless: (rev) => rev,    // reversed it works on a targeted construct and needs no energy of its own
		ignoresFocus: true,        // a creature / surface the branch targets (e.g. for a guided state) is not what it acts on
		description: 'Turns magical energy into solid matter: a construct — a wall, platform, block, spike or any Shape — that exists in the world with real collision. You can stand on it, it blocks creatures and projectiles, and energy breaks against it. The energy is used up (it becomes the material). Its form is the energy\'s Shape (unshaped energy becomes a block); more energy makes it bigger, compression makes it denser and tougher. It keeps the state its energy was in: anchored stays in place, free energy falls, attached rides what it was attached to, guided follows, bound is tethered. A technique already on the energy becomes its material (Thermal burns what touches it, reverse Gravity floats …). Damage wears down its integrity until it breaks; it is temporary. Reversed (Target → Construct first), it dismantles one of your constructs back into raw energy — once, within your Max Output, and never all of it.',
		color: '#e2c27a', reversedColor: '#8fa6c4',
		palette: { core: '#fff1c9', mid: '#c9a45a', outer: '#5e4320' },
		reversePalette: { core: '#eef4ff', mid: '#8fa6c4', outer: '#34435c' },
		balance: { strength: 1 },
		targets: { energy: true, construct: true, zone: false, spell: false, environment: false, surface: false, enemy: false, self: false, ally: false },
		targetNotes: { zone: 'a zone is a region, not material — Draw Out its energy and build with that', spell: 'another caster\'s projectile is not yours to build with',
			environment: 'Draw Out environment energy first, then build with it', surface: 'it builds from energy — put the energy where you want it first', enemy: 'it builds things, not creatures (no summoning)',
			self: 'pour energy into yourself with Reinforcement', ally: 'pour energy into an ally with Reinforcement' },
		params: [
			{ key: 'facing', label: 'Construct faces', type: 'select', options: FACING_OPTS, default: 'facing', hint: 'Which way its Shape points (a Line is a platform pointing right/left, a pillar pointing up)' },
			{ key: 'aspect', label: 'Proportions', type: 'float', min: 0.4, max: 3, step: 0.1, default: 1, unit: '×', hint: 'Stretch it along its length (longer platform / taller wall) — the same material, so it gets thinner' }
		],
		canApply(T, b, s, ctx){ return T.constructCheck(b, s, ctx); },
		onApply(T, b, s, ctx){ if(s > 0 && b.alive) T.construct(b, s, ctx); },
		/* reversed, aimed at a construct: dismantle it (positive Construction with a construct targeted just builds with the energy) */
		onTarget(T, t, s, ctx){
			if(t.kind !== 'construct' || s >= 0) return null;
			return T.dismantle(t.ref, s, ctx);
		},
		analyze(p, a, node, rev){
			const CC = ME.CONFIG.construct, b = a.ctx.body;
			const pts = TQ.points(a.profile, 'construction');
			if(rev){
				if(a.ctx.target !== 'construct'){ a.error(node, 'CONSTRUCT_REVERSE', 'Reverse Construction dismantles a construct — add Target → Construct before it'); return; }
				const eff = TQ.efficiency(pts);
				a.extra({ construct: { Action: 'Dismantle the targeted construct (yours only)', Recovers: 'up to ' + Math.round((CC.recoverBase + CC.recoverPerEff * eff) * 100) + '% of its material as raw energy (less if damaged)', Limit: 'Max Output — anything over it disperses', Once: 'a construct gives its energy back only once' } });
				const nb = a.newBody(20, 'recovered'); nb.drawnOut = true;
				a.ctx.body = nb; a.ctx.target = 'energy'; a.ctx.groupN = 1; a.ctx.constructed = false;
				return;
			}
			if(!b || b.foreign || b.zone) return;
			if(b.infSource){ a.error(node, 'CONSTRUCT_INF', 'An Infinity source cannot become a construct — Draw Out its energy and build with that'); return; }
			if(b.amount < CC.minEnergy) a.warn(node, 'CONSTRUCT_ENERGY', 'Construction needs at least ' + CC.minEnergy + ' E to hold a solid form — this energy is about ' + Math.round(b.amount) + ' E, so it will fail');
			const shape = b.shape && b.shape !== 'raw' && ME.SHAPES[b.shape] && ME.SHAPES[b.shape].poly ? b.shape : 'cube';
			if(shape === 'cube' && (!b.shape || b.shape === 'raw')) a.warn(node, 'CONSTRUCT_SHAPE', 'The energy has no Shape — it becomes a block (Compress / Shape first to choose its form)');
			const s = TQ.intensity('construction', Math.max(1, pts), Math.abs(Number(p.power) || 5));
			const st = ME.constructStats(b, pts, s), geo = ME.constructGeometry(shape, st.area, TQ.param(p, 'construction', 'aspect', 1));
			a.extra({ construct: {
				Shape: (ME.SHAPES[shape] && ME.SHAPES[shape].label) || shape, Size: Math.round(geo.w) + ' × ' + Math.round(geo.h) + ' px', 'Collision boxes': geo.parts.length,
				Material: Math.round(st.material) + ' of ' + Math.round(b.amount) + ' E (' + Math.round(st.conv * 100) + '%)', Density: st.density.toFixed(2) + '×',
				Integrity: Math.round(st.integrity), Lasts: Math.round(st.life) + ' s', 'Can give back': 'up to ' + Math.round(st.recoverable) + ' E (reverse Construction)',
				State: 'the state its energy is in (Anchor / State)' } });
			// the energy is the construct now: what follows works on the construct
			a.ctx.body = null; a.ctx.target = 'construct'; a.ctx.constructed = true; a.ctx.groupN = 1;
		},
		drawField(){}
	});

	/* (the Binding technique was removed — binding is now the Bound state of the Anchor / State rune) */

	/* ==================================================================
	   DEVELOPMENT TEST SET — spells that exercise every technique, and
	   headless checks for cancellation, splitting, access and stacking.
	   ================================================================== */
	function chain(name, steps){
		const s = ME.blankSpell(name);
		let parent = s.rootId, gy = 0, first = true;
		for(const st of steps){
			let n;
			if(first){ n = s.nodes[s.rootId]; n.type = st[0]; n.params = ME.paramDefaults(st[0]); first = false; }
			else { gy++; n = ME.makeNode(st[0], parent, 's', 0, gy, gy); s.nodes[n.id] = n; }
			Object.assign(n.params, st[1] || {});
			if(st[2]) n.link = Object.assign(n.link, st[2]);
			parent = n.id;
		}
		s.seq = gy + 1;
		return s;
	}
	const TEST_SPELLS = [
		['1 · Thermal projectile', [ ['generate', { amount: 30 }], ['technique', { technique: 'thermal', power: 6 }], ['compress', { power: 5, shape: 'sphere' }], ['target', { kind: 'enemy', select: 'nearCaster' }], ['redirect', { toward: 'target' }] ]],
		['2 · Cooling field', [ ['generate', { amount: 30 }], ['technique', { technique: 'thermal', power: -6 }], ['target', { kind: 'environment' }] ]],
		['3 · Gravity pull', [ ['generate', { amount: 30 }], ['technique', { technique: 'gravity', power: 6 }], ['target', { kind: 'enemy', select: 'nearCaster' }] ]],
		['4 · Kinetic projectile', [ ['generate', { amount: 30 }], ['technique', { technique: 'kinetic', power: 6 }], ['compress', { power: 5, shape: 'spike' }], ['target', { kind: 'enemy', select: 'nearCaster' }], ['redirect', { toward: 'target' }] ]],
		['5 · Spatial portal (exit at the cursor)', [ ['generate', { amount: 120 }], ['technique', { technique: 'spatial', power: 6, spatial_dest: 'mouse' }] ]],
		['6 · Light beam', [ ['generate', { amount: 30 }], ['technique', { technique: 'light', power: 7 }], ['compress', { power: 7, shape: 'lance' }], ['target', { kind: 'enemy', select: 'nearCaster' }], ['redirect', { toward: 'target' }] ]],
		['7 · Anchored restraint', [ ['target', { kind: 'enemy', select: 'nearCaster' }], ['generate', { amount: 40 }], ['redirect', { toward: 'target' }], ['anchor', { state: 'bound', len: 50 }, { mode: 'condition', cond: { type: 'spellHit', params: {}, timeout: 6 } }], ['anchor', { state: 'anchored' }] ]],
		['8 · Reinforced player', [ ['generate', { amount: 40 }], ['reinforce', { portion: 100 }], ['target', { kind: 'self' }] ]],
		['9 · Reinforced weapon', [ ['generate', { amount: 40 }], ['technique', { technique: 'kinetic', power: 6 }], ['reinforce', { portion: 100 }], ['target', { kind: 'weapon' }] ]],
		['10 · Latest technique converts', [ ['generate', { amount: 40 }], ['technique', { technique: 'thermal', power: 5 }], ['technique', { technique: 'gravity', power: 4 }], ['technique', { technique: 'kinetic', power: 5 }], ['compress', { power: 5, shape: 'sphere' }], ['target', { kind: 'enemy', select: 'nearCaster' }], ['redirect', { toward: 'target' }] ]],
		['11 · Cancel: Thermal 80 vs Reverse 30', [ ['generate', { amount: 30 }], ['technique', { technique: 'thermal', power: 8 }], ['technique', { technique: 'thermal', power: -3 }], ['redirect', { toward: 'mouse' }] ]],
		['12 · Cancel: Thermal 50 vs Reverse 50 (neutral)', [ ['generate', { amount: 30 }], ['technique', { technique: 'thermal', power: 5 }], ['technique', { technique: 'thermal', power: -5 }], ['redirect', { toward: 'mouse' }] ]],
		['13 · Reinforced ally', [ ['target', { kind: 'ally', select: 'nearCaster' }], ['generate', { amount: 40 }], ['reinforce', { portion: 100 }] ]],
		['14 · Kinetic → Reinforcement → Self', [ ['generate', { amount: 40 }], ['technique', { technique: 'kinetic', power: 6 }], ['reinforce', { portion: 100 }], ['target', { kind: 'self' }] ]],
		['15 · Zone → Heavy gravity', [ ['zone', { radius: 220 }], ['technique', { technique: 'gravity', power: 6 }], ['target', { kind: 'environment' }] ]],
		['16 · Reverse Spatial: bounce surface', [ ['generate', { amount: 60 }], ['technique', { technique: 'spatial', power: -6, spatial_place: 'right', spatial_dist: 120, spatial_angle: 'wall' }] ]],
		['17 · Portal for your own shots', [ ['generate', { amount: 80 }], ['technique', { technique: 'spatial', power: 6, spatial_dest: 'up', spatial_dist: 220 }], ['generate', { amount: 20 }, { mode: 'delay', delay: 0.3 }], ['redirect', { toward: 'right' }] ]]
	];
	function testSpells(){ return TEST_SPELLS.map(t => ({ name: t[0], def: chain(t[0].replace(/^\d+ · /, ''), t[1]) })); }
	/* the access the test set needs (dev only — the real allocation is the player's) */
	function testProfile(base){
		const p = ME.deriveProfile(base || {});
		p.techniquePoints = Math.max(p.techniquePoints, 20);
		p.allocations = { thermal: 2, spatial: 2, gravity: 2, kinetic: 2, light: 2, antimagic: 2, infinity: 2, construction: 2 };
		return p;
	}
	function runChecks(){
		const out = [], ok = (name, pass, detail) => out.push({ name, pass: !!pass, detail: detail || '' });
		const prof = testProfile({ magicPower: 20, magicControl: 10 });
		// access
		const locked = ME.deriveProfile({});
		const r0 = ME.validate(testSpells()[0].def, locked);
		ok('Zero points → no access', !r0.ok && r0.errors.some(e => /Insufficient Technique Access: Thermal requires at least 1 Technique Point/.test(e.text)), r0.errors.map(e => e.text)[0]);
		// sequential cancellation on one body
		const b = { amount: 20, scale: 1 };
		ME.addTech(b, 'thermal', 0.8); ME.addTech(b, 'thermal', -0.3);
		ok('Thermal 0.8 + Reverse 0.3 = Thermal 0.5', Math.abs(b.tech.thermal - 0.5) < 1e-6, 'thermal ' + b.tech.thermal.toFixed(3));
		const n = { amount: 20, scale: 1 };
		ME.addTech(n, 'thermal', 0.5); ME.addTech(n, 'thermal', -0.5);
		ok('Equal and opposite → neutral (energy remains)', n.tech.thermal === 0 && n.amount === 20, 'thermal ' + n.tech.thermal + ', energy ' + n.amount);
		for(const id of ['gravity', 'kinetic', 'spatial', 'light']){
			const q = { amount: 10 }; ME.addTech(q, id, 0.9); ME.addTech(q, id, -0.4);
			const z = { amount: 10 }; ME.addTech(z, id, 0.6); ME.addTech(z, id, -0.6);
			ok(id + ' / reverse: partial and full cancel', Math.abs(q.tech[id] - 0.5) < 1e-6 && z.tech[id] === 0, q.tech[id].toFixed(2) + ' / ' + z.tech[id]);
		}
		// combined states are preserved side by side
		const W = ME.createWorld();
		const dummy = { x: 600, y: 80, w: 30, h: 50, hp: 500, maxHp: 500, vx: 0, vy: 0 };
		const host = { mouseWorld: () => ({ x: 400, y: 100 }), getEnemies: () => [dummy], isSolid: () => false, inBounds: () => true };
		const caster = { x: 100, y: 100, w: 20, h: 40, vx: 0, vy: 0 };
		const combo = testSpells()[9].def;
		const cr = W.cast(combo, { profile: prof, owner: { id: 'p', entity: caster }, host });
		W.update(1 / 60, host);
		const cb = W.bodies.find(x => x.alive && x.tech);
		ok('Latest technique converts: thermal → gravity → kinetic leaves kinetic only', cr.ok && cb && cb.tech.kinetic > 0 && !cb.tech.thermal && !cb.tech.gravity, cb ? ME.techList(cb) : (cr.error || 'no body'));
		// opposite bodies meeting cancel by magnitude × energy
		const W2 = ME.createWorld();
		const hot = chain('hot', [ ['generate', { amount: 40 }], ['technique', { technique: 'thermal', power: 8 }] ]);
		const cold = chain('cold', [ ['generate', { amount: 20 }], ['technique', { technique: 'thermal', power: -8 }] ]);
		W2.cast(hot, { profile: prof, owner: { id: 'p', entity: caster }, host });
		W2.cast(cold, { profile: prof, owner: { id: 'p', entity: caster }, host });
		const [h, c] = W2.bodies.filter(x => x.alive);
		const eh = h.tech.thermal * h.amount, ec = c.tech.thermal * c.amount;
		W2.update(1 / 60, host);
		const eh2 = h.tech.thermal * h.amount;
		ok('Bodies meeting: hot (more energy) beats cold, cold neutral', Math.abs(eh2 - (eh + ec)) < 0.5 && c.tech.thermal === 0, 'heat ' + eh.toFixed(1) + ' + cold ' + ec.toFixed(1) + ' → ' + eh2.toFixed(1));
		// split divides technique energy, never duplicates it
		const W3 = ME.createWorld();
		const sp = ME.blankSpell('split'); const r = sp.nodes[sp.rootId]; r.type = 'generate'; r.params = ME.paramDefaults('generate'); r.params.amount = 40;
		const t1 = ME.makeNode('technique', r.id, 's', 0, 1, 1); t1.params.technique = 'thermal'; sp.nodes[t1.id] = t1;
		const s1 = ME.makeNode('split', t1.id, 's', 0, 2, 2); sp.nodes[s1.id] = s1;
		const k1 = ME.makeNode('lock', s1.id, 's', 0, 3, 3), k2 = ME.makeNode('lock', s1.id, 'e', 1, 3, 4); sp.nodes[k1.id] = k1; sp.nodes[k2.id] = k2;
		W3.cast(sp, { profile: prof, owner: { id: 'p', entity: caster }, host });
		const parts = W3.bodies.filter(x => x.alive);
		const sum = parts.reduce((a, x) => a + x.amount, 0);
		ok('Split: two pieces, energy divided, thermal kept on each', parts.length === 2 && sum < 40 && parts.every(x => x.tech && x.tech.thermal > 0), parts.map(x => x.amount.toFixed(1) + ' E ' + ME.techList(x)).join(' | '));
		// reinforcement stacking
		const W4 = ME.createWorld();
		const me = { x: 100, y: 100, w: 20, h: 40, vx: 0, vy: 0 };
		const rs = chain('r', [ ['generate', { amount: 40 }], ['reinforce', {}], ['target', { kind: 'self' }] ]);
		W4.cast(rs, { profile: prof, owner: { id: 'p', entity: me }, host });
		const one = W4.reinforcedValue(me, 'damageResist');
		W4.cast(rs, { profile: prof, owner: { id: 'p', entity: me }, host });
		W4.cast(rs, { profile: prof, owner: { id: 'p', entity: me }, host });
		W4.update(1 / 60, host);
		const three = W4.reinforcedValue(me, 'damageResist');
		const cap = ME.CONFIG.reinforce.caps.damageResist;
		ok('Reinforcement: one source gives a bonus', one > 0.05, '+' + Math.round(one * 100) + '% damage resist');
		ok('Three sources: more, but less than 3× and under the cap', three > one && three < one * 3 && three <= cap, '+' + Math.round(three * 100) + '% (cap ' + Math.round(cap * 100) + '%)');
		// output: reinforcement keeps counting toward Max Output
		const inst = W4.instances[0];
		ok('Reinforcement energy counts toward Max Output', inst && inst.outputUsed > 0, inst ? 'output used ' + inst.outputUsed.toFixed(1) : 'no instance');
		// O-key clear
		const cleared = W4.clearOwner('p');
		ok('Clear ends every spell and reinforcement', cleared >= 1 && W4.reinf.length === 0 && W4.instances.length === 0, cleared + ' cleared');
		// legs / arms; yourself has a lower maximum for movement
		const W5 = ME.createWorld(), me5 = { x: 100, y: 100, w: 20, h: 40, vx: 0, vy: 0 };
		const legs = chain('l', [ ['generate', { amount: 60 }], ['reinforce', {}], ['target', { kind: 'legs' }] ]);
		const self5 = chain('s', [ ['generate', { amount: 60 }], ['reinforce', {}], ['target', { kind: 'self' }] ]);
		W5.cast(self5, { profile: prof, owner: { id: 'p', entity: me5 }, host }); W5.cast(self5, { profile: prof, owner: { id: 'p', entity: me5 }, host }); W5.cast(self5, { profile: prof, owner: { id: 'p', entity: me5 }, host });
		W5.update(1 / 60, host);
		const selfMove = W5.reinforcedValue(me5, 'moveForce');
		W5.cast(legs, { profile: prof, owner: { id: 'p', entity: me5 }, host }); W5.update(1 / 60, host);
		const legMove = W5.reinforcedValue(me5, 'moveForce') - selfMove;
		ok('Legs: run faster than yourself can give (self capped lower)', selfMove <= 0.15 && legMove > selfMove, 'self ×3 +' + Math.round(selfMove * 100) + '% · legs adds +' + Math.round(legMove * 100) + '%');
		// reinforcing energy with energy: same adds, opposite cancels
		const W6 = ME.createWorld();
		const big = chain('b', [ ['generate', { amount: 50 }], ['technique', { technique: 'thermal', power: 6 }] ]);
		W6.cast(big, { profile: prof, owner: { id: 'p', entity: caster }, host });
		const tgt = W6.bodies.find(x => x.alive); tgt.x = 300; const a0 = tgt.amount;
		const addHot = chain('h', [ ['generate', { amount: 20 }], ['technique', { technique: 'thermal', power: 6 }], ['reinforce', {}], ['target', { kind: 'energy', select: 'strongest' }] ]);
		W6.cast(addHot, { profile: prof, owner: { id: 'p', entity: caster }, host });
		const a1 = tgt.amount;
		const addCold = chain('c', [ ['generate', { amount: 90 }], ['technique', { technique: 'thermal', power: -6 }], ['reinforce', {}], ['target', { kind: 'energy', select: 'strongest' }] ]);
		W6.cast(addCold, { profile: prof, owner: { id: 'p', entity: caster }, host });
		const a2 = tgt.alive ? tgt.amount : 0;
		ok('Same energy adds; its reverse cancels (more reverse flips it)', a1 > a0 + 10 && tgt.alive && tgt.tech.thermal < 0 && a2 < a1, a0.toFixed(0) + ' +hot → ' + a1.toFixed(0) + ' +cold → ' + a2.toFixed(0) + ' ' + ME.techList(tgt) + ' memory ' + ME.memCount(tgt, 'reinforced'));
		// anchor-state targeting, energy-to-energy bonds, finished zones dissipate
		const WA = ME.createWorld(), oA = { profile: prof, owner: { id: 'p', entity: caster }, host };
		WA.cast(chain('a', [ ['generate', { amount: 30 }], ['anchor', { state: 'anchored' }] ]), oA);
		const anc = WA.bodies.find(x => x.alive); anc.x += 200;
		const fr = WA.cast(chain('f', [ ['target', { kind: 'anchorState', astate: 'anchored', select: 'nearCaster' }], ['anchor', { state: 'free' }] ]), oA);
		ok('Target → energy in an anchor state picks it up', fr.ok && !anc.anchored, fr.ok ? ME.stateOf(anc).join('+') : fr.error);
		WA.cast(chain('e', [ ['generate', { amount: 30 }], ['anchor', { state: 'bound', bindTo: 'energy', len: 40 }] ]), oA);
		const d0 = Math.hypot(anc.x - caster.x - 10, anc.y - caster.y - 20);
		for(let i = 0; i < 120; i++) WA.update(1 / 60, host);
		const pair = WA.bodies.filter(x => x.alive), d1 = pair.length === 2 ? Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y) : -1;
		ok('Bound to other energy: the two are drawn together', d1 > 0 && d1 < 60 && d0 > 150, Math.round(d0) + ' px → ' + Math.round(d1) + ' px');
		const WB = ME.createWorld();
		WB.cast(chain('z', [ ['zone', { radius: 180 }] ]), { profile: prof, owner: { id: 'p', entity: caster }, host });
		const zB = WB.bodies.find(x => x.alive && x.isZone);
		for(let i = 0; i < 60; i++) WB.update(1 / 60, host);
		ok('A zone dissipates once its spell is finished', zB && !zB.alive, zB ? (zB.alive ? 'still there' : 'gone after 1 s') : 'no zone');
		// energy grown out of light energy keeps its technique through Divide; Technique → Remove strips it; "inside this spell" targeting
		const WD = ME.createWorld(), oD = { profile: prof, owner: { id: 'p', entity: caster }, host };
		const grow = chain('g', [ ['generate', { amount: 20 }], ['technique', { technique: 'light', power: 6 }], ['generate', { amount: 60, spawn: 'energy' }], ['divide', { count: 3, motion: 'still' }] ]);
		WD.cast(grow, oD);
		const pieces = WD.bodies.filter(x => x.alive && ME.memCount(x, 'split') > 0);
		ok('Generate at energy takes on its technique, and Divide keeps it', pieces.length === 3 && pieces.every(x => (x.tech && x.tech.light) > 0), pieces.map(x => ME.techList(x) || 'raw').join(' | '));
		const WR = ME.createWorld();
		WR.cast(chain('r', [ ['generate', { amount: 30 }], ['technique', { technique: 'thermal', power: 6 }], ['technique', { action: 'remove' }] ]), { profile: prof, owner: { id: 'p', entity: caster }, host });
		const rb = WR.bodies.find(x => x.alive);
		ok('Technique → Remove turns it back into raw energy', rb && !ME.techList(rb), rb ? (ME.techList(rb) || 'raw') : 'none');
		const WS = ME.createWorld(), oS = { profile: prof, owner: { id: 'p', entity: caster }, host };
		WS.cast(chain('o', [ ['generate', { amount: 30 }] ]), oS);
		const other = WS.bodies.find(x => x.alive); other.x += 50;
		WS.cast(chain('m', [ ['generate', { amount: 30 }], ['divide', { count: 2, motion: 'still' }], ['target', { kind: 'energy', select: 'thisSpell' }], ['anchor', { state: 'anchored' }] ]), oS);
		ok('Target → All energy inside this spell skips your other spells', !other.anchored && WS.bodies.filter(x => x.alive && x.anchored).length === 2, WS.bodies.filter(x => x.alive).map(x => ME.stateOf(x).join('+')).join(' | '));
		const lt = ME.Techniques.get('light'), info = { mult: 1, keep: false, cost: 0.25 };
		lt.onHit(WS.T, { scale: 1, tech: { light: 1 } }, 1, { x: 0, y: 0, w: 10, h: 10 }, info);
		ok('Light pierces everything: enemies and surfaces', info.keep && info.cost === 0 && lt.onSurface(WS.T, {}, 1) === 'pass', 'enemy keep ' + info.keep + ' cost ' + info.cost + ' · surface ' + lt.onSurface(WS.T, {}, 1));
		// each compression level needs a minimum of energy
		const WC = ME.createWorld();
		const thin = chain('t', [ ['generate', { amount: 30 }], ['compress', { power: 50 }] ]);
		const tr = WC.cast(thin, { profile: prof, owner: { id: 'p', entity: caster }, host });
		const thinRep = ME.validate(thin, prof);
		ok('Too little energy for the compression level: it collapses', tr.ok && !WC.bodies.some(x => x.alive) && thinRep.warnings.some(w => w.code === 'COMPRESS_MIN'), 'needs ' + Math.ceil(ME.compMin(50)) + ' E at 50 · ' + Math.ceil(ME.compMin(20)) + ' E at 20');
		const dense = { comp: 50 }, loose = { comp: 0 };
		ok('Highly compressed energy resists gravity; redirect explosion odds fall with control', ME.gravResist(dense) < 0.3 && ME.gravResist(loose) === 1 && ME.unstableChance(50, 5) > ME.unstableChance(50, 20) && ME.unstableChance(50, 10) > ME.unstableChance(20, 10) && ME.unstableChance(10, 5) === 0, 'gravity ×' + ME.gravResist(dense).toFixed(2) + ' · c50 ' + Math.round(ME.unstableChance(50, 5) * 100) + '% (control 5) / ' + Math.round(ME.unstableChance(50, 20) * 100) + '% (control 20) · c20 ' + Math.round(ME.unstableChance(20, 10) * 100) + '%');
		// over-compression and gravity
		const W7 = ME.createWorld();
		const oc = chain('o', [ ['generate', { amount: 170 }], ['compress', { power: 10 }] ]), oc50 = chain('o5', [ ['generate', { amount: 170 }], ['compress', { power: 50 }] ]);
		const W7b = ME.createWorld();
		const profBig = testProfile({ magicPower: 120, magicControl: 10 });      // enough Max Output that compression is not clamped
		W7.cast(oc, { profile: profBig, owner: { id: 'p', entity: caster }, host }); W7b.cast(oc50, { profile: profBig, owner: { id: 'p', entity: caster }, host });
		const c10 = W7.bodies.find(x => x.alive), c50 = W7b.bodies.find(x => x.alive);
		ok('Compression 50: smaller, stronger, over-compressed, remembered', c50 && c10 && c50.scale < c10.scale && Math.abs(ME.bodyPower(c50)) > Math.abs(ME.bodyPower(c10)) && c50.over === 40 && ME.memCount(c50, 'compressed') === 1, c10 && c50 ? 'scale ' + c10.scale.toFixed(3) + ' → ' + c50.scale.toFixed(3) + ', power ' + Math.abs(ME.bodyPower(c10)).toFixed(0) + ' → ' + Math.abs(ME.bodyPower(c50)).toFixed(0) : 'missing');
		const gv = ME.validate(chain('g', [ ['generate', { amount: 30 }], ['technique', { technique: 'gravity', power: 5 }], ['compress', { power: 5 }] ]), prof);
		ok('Gravity energy cannot be compressed', !gv.ok && gv.errors.some(e => /Gravity energy cannot be compressed/.test(e.text)), gv.errors.map(e => e.text)[0]);
		// generate no longer spawns at the cursor
		ok('Generate has no "At cursor" option', !ME.Runes.generate.params.find(p => p.key === 'spawn').options.some(o => o.value === 'mouse'));
		advancedChecks(ok);
		constructionChecks(ok);
		return out;
	}
	/* ================= CONSTRUCTION checks (A registration · B conversion · C shapes · D physics · E integrity ·
	   F interactions · G reverse · H lifecycle · I memory · J regressions) ================= */
	function constructionChecks(ok){
		const CC = ME.CONFIG.construct;
		const prof = testProfile({ magicPower: 120, magicControl: 20 });
		const FLOOR = 400;
		const csim = (opts) => {
			opts = opts || {};
			const W = ME.createWorld(), c = { x: 100, y: 100, w: 20, h: 40, vx: 0, vy: 0 };
			const enemies = opts.enemies || [], projs = opts.projs || [];
			const host = { mouseWorld: () => (opts.mouse || { x: 400, y: 120 }), getEnemies: () => enemies,
				isSolid: opts.solid || ((x, y) => y >= FLOOR), inBounds: () => true,
				getForeignProjectiles: () => projs, foreignAlive: (p) => projs.indexOf(p) >= 0, removeForeign: (p) => { const i = projs.indexOf(p); if(i >= 0) projs.splice(i, 1); },
				knockback: (e, vx) => { e.kb = (e.kb || 0) + Math.abs(vx); }, hurtCaster: (e, d) => { c.hurt = (c.hurt || 0) + d; } };
			const owner = { id: opts.ownerId || 'p', entity: c, facing: () => (opts.facing || 1) };
			const o = { profile: opts.profile || prof, owner, host };
			return { W, c, host, enemies, projs, owner,
				cast: (steps, as) => W.cast(chain('c', steps), as ? Object.assign({}, o, as) : o),
				live: () => W.bodies.filter(x => x.alive),
				cons: () => W.constructs.filter(x => x.alive),
				step: (n) => { for(let i = 0; i < n; i++) W.update(1 / 60, host); } };
		};
		const tech = (id, p, extra) => ['technique', Object.assign({ technique: id, power: p == null ? 5 : p }, extra || {})];
		const gen = (amt) => ['generate', { amount: amt }];
		const until = (S, fn, max) => { for(let i = 0; i < (max || 240); i++){ if(fn()) return i; S.step(1); } return -1; };
		const shape = (sh, pw) => ['compress', { power: pw == null ? 3 : pw, shape: sh }];
		const anch = ['anchor', { state: 'anchored' }];
		const build = (S, amt, sh, extra, at, more) => {
			const before = S.cons().length;
			const res = S.cast([ gen(amt) ].concat(sh ? [ shape(sh) ] : []).concat(more || []).concat([ tech('construction', 6, extra) ]));
			const k = S.cons().filter(q => W0(q, res)).pop();
			function W0(q){ return res.ok && q.inst === res.instance.id; }
			if(k && at){ k.x = at.x; k.y = at.y; k.vx = 0; k.vy = 0; k.ghost.clear(); S.W.T.constructsNear(k.x, k.y, 1); }
			return { res, k, made: S.cons().length - before };
		};
		const r1 = (v) => Math.round(v);
		const rect = (x, y, w, h) => ({ x, y, w, h, vx: 0, vy: 0 });

		// ---------- A · registration
		{
			const d = ME.Techniques.get('construction');
			const keys = ME.Runes.technique.params.map(p => p.key);
			ok('A1 Construction is a registered technique (energy + construct targets, no zones) with its own rune parameters',
				!!d && ME.Techniques.list().indexOf(d) >= 0 && d.targets.energy && d.targets.construct && !d.targets.zone && !d.targets.enemy && keys.indexOf('construction_facing') >= 0 && keys.indexOf('construction_aspect') >= 0,
				d ? d.name + ' · params ' + keys.filter(k => /^construction_/.test(k)).join(', ') : 'missing');
			const locked = ME.deriveProfile({});
			const rv = ME.validate(chain('l', [ gen(60), tech('construction') ]), locked);
			ok('A2 Zero Construction points → no access', !rv.ok && rv.errors.some(e => /Insufficient Technique Access: Construction/.test(e.text)), rv.errors.map(e => e.text)[0]);
			const tk = ME.Runes.target.params.find(p => p.key === 'kind').options.some(o => o.value === 'construct');
			const mem = ['constructCreated', 'constructDamaged', 'constructDestroyed', 'constructDismantled', 'constructEnergyRecovered', 'constructImpact'].every(k => ME.MEM_EVENTS.some(e => e.value === k));
			ok('A3 Target → Construct, the construct memory events and a Reinforcement construct target exist', tk && mem && !!ME.Reinforcement.targets.construct, 'target ' + tk + ' · memory ' + mem);
		}
		// ---------- B · conversion
		{
			const S = csim();
			const res = S.cast([ gen(200), shape('wall'), anch ]);
			const b = S.live()[0], e0 = b.amount;
			const res2 = S.cast([ ['target', { kind: 'energy', select: 'nearCaster' }], tech('construction', 6) ]);
			const k = S.cons()[0];
			ok('B1 The energy becomes the construct: it is used up (no energy body left, none duplicated) and the construct remembers its origin',
				res.ok && res2.ok && !b.alive && S.live().length === 0 && S.cons().length === 1 && k && k.energy <= e0 && k.energy > e0 * 0.9 && k.material < k.energy && k.origin === 'raw' && ME.memCount(k, 'constructCreated') === 1,
				k ? 'energy ' + r1(e0) + ' → material ' + r1(k.material) + ' · ' + k.shape + ' ' + k.state : (res2.error || 'no construct'));
			ok('B2 No free material: material < energy, and what it can give back < material', k && k.material < k.energy && k.recoverable < k.material && k.recoverable > 0, k ? 'E ' + r1(k.energy) + ' · material ' + r1(k.material) + ' · recoverable ' + r1(k.recoverable) : '');
			const S2 = csim(), S3 = csim();
			const loose = build(S2, 200, 'cube', null, null, [ anch ]).k, dense = (function(){ const r = S3.cast([ gen(200), ['compress', { power: 8, shape: 'cube' }], anch, tech('construction', 6) ]); return S3.cons()[0]; })();
			ok('B3 Compression makes it denser: smaller and tougher from the same energy', loose && dense && dense.geo.area < loose.geo.area && dense.integrity > loose.integrity && dense.density > loose.density,
				loose && dense ? 'area ' + r1(loose.geo.area) + ' → ' + r1(dense.geo.area) + ' · integrity ' + r1(loose.integrity) + ' → ' + r1(dense.integrity) : 'missing');
			const lo = ME.constructStats({ amount: 200, scale: 1 }, 1, 0.5), hi = ME.constructStats({ amount: 200, scale: 1 }, 8, 2);
			ok('B4 Technique points add efficiency and integrity, never material beyond the energy', hi.integrity > lo.integrity && hi.material > lo.material && hi.material < 200 && hi.recoverable < hi.material, 'material ' + r1(lo.material) + ' → ' + r1(hi.material) + ' of 200 · integrity ' + r1(lo.integrity) + ' → ' + r1(hi.integrity));
			const S4 = csim();
			const rep = ME.validate(chain('s', [ gen(8), tech('construction') ]), prof);
			const r4 = S4.cast([ gen(8), anch, tech('construction') ]);
			ok('B5 Too little energy: the forge warns, the rune fails cleanly (the energy stays, no construct)', rep.warnings.some(w => w.code === 'CONSTRUCT_ENERGY') && r4.ok && S4.cons().length === 0 && S4.live().length === 1 && /at least 15 E/.test(r4.instance.log.map(l => l.text).join(' ')),
				r4.instance ? r4.instance.log.map(l => l.text).slice(-1)[0] : '');
			const S5 = csim();
			S5.cast([ gen(600), ['compress', { power: 25 }], anch, tech('infinity') ]);
			const r5 = S5.cast([ ['target', { kind: 'energy', select: 'nearCaster', techFilter: 'infinity' }], tech('construction') ]);
			const src = S5.live().find(q => q.infSource);
			const rep5 = ME.validate(chain('i', [ gen(600), ['compress', { power: 25 }], tech('infinity'), tech('construction') ]), prof);
			ok('B6 An Infinity source cannot become a construct (error in the forge; the source is untouched)', !!src && src.alive && S5.cons().length === 0 && rep5.errors.some(e => e.code === 'CONSTRUCT_INF') && r5.instance.log.some(l => /Infinity source cannot become a construct/.test(l.text)), src ? 'source intact, ' + r1(src.amount) + ' E' : 'no source');
			const rep6 = ME.validate(chain('z', [ ['zone', { radius: 200 }], tech('construction') ]), prof);
			ok('B7 A zone cannot be built with', !rep6.ok && rep6.errors.some(e => /Construction cannot manipulate a zone/.test(e.text)), rep6.errors.map(e => e.text)[0]);
			const big = ME.constructStats({ amount: 1000, scale: 6 }, 2, 1), g = ME.constructGeometry('line', big.area, 3);
			ok('B8 Size is bounded: huge expanded energy stays within the engine limits', g.w <= CC.maxDim + 0.01 && g.h <= CC.maxDim + 0.01 && g.parts.length <= CC.maxParts && big.integrity <= CC.integrityMax && big.area <= CC.maxArea, Math.round(g.w) + ' × ' + Math.round(g.h) + ' px, ' + g.parts.length + ' boxes');
		}
		// ---------- C · shapes
		{
			const bad = [];
			for(const k in ME.SHAPES){
				if(k === 'raw') continue;
				const g = ME.constructGeometry(k, 6000, 1);
				const fine = g.parts.length >= 1 && g.parts.length <= CC.maxParts && g.w <= CC.maxDim && g.h <= CC.maxDim && g.parts.every(q => isFinite(q.cx + q.cy + q.hw + q.hh) && q.hw * 2 >= CC.minThick - 0.01 && q.hh * 2 >= CC.minThick - 0.01);
				if(!fine) bad.push(k);
			}
			ok('C1 Every Shape converts into a bounded set of collision boxes', bad.length === 0, bad.length ? 'bad: ' + bad.join(', ') : Object.keys(ME.SHAPES).length - 1 + ' shapes');
			const rep = ME.validate(chain('r', [ gen(60), tech('construction') ]), prof);
			const S = csim(); const k = build(S, 60, null, null, null, [ anch ]).k;
			ok('C2 Unshaped energy becomes a block (and the forge says so)', k && k.shape === 'cube' && rep.warnings.some(w => w.code === 'CONSTRUCT_SHAPE'), k ? k.shape : 'none');
			const S2 = csim(); const ring = build(S2, 400, 'ring', null, { x: 500, y: 200 }, [ anch ]).k;
			const edge = ring ? S2.W.constructAt(ring.x + ring.geo.w / 2 - 4, ring.y) : null, mid = ring ? S2.W.constructAt(ring.x, ring.y) : 1;
			ok('C3 A ring keeps its hole: the middle is open, the rim is solid', ring && edge === ring && mid === null, ring ? ring.geo.parts.length + ' boxes' : 'none');
			const S3 = csim(); const up = build(S3, 150, 'line', { construction_facing: 'up' }, null, [ anch ]).k;
			const S4 = csim(); const flat = build(S4, 150, 'line', { construction_facing: 'right' }, null, [ anch ]).k;
			const bb = (q) => { S3.W.T.constructsNear(q.x, q.y, 1); return { w: q.bx1 - q.bx0, h: q.by1 - q.by0 }; };
			ok('C4 Facing turns it: a Line pointing up is a pillar, pointing right a platform', up && flat && bb(up).h > bb(up).w * 4 && bb(flat).w > bb(flat).h * 4, up && flat ? 'pillar ' + r1(bb(up).w) + '×' + r1(bb(up).h) + ' · platform ' + r1(bb(flat).w) + '×' + r1(bb(flat).h) : '');
			// what is drawn is the true outline, and the collision boxes hug it (every outline point is inside a box; the boxes add little)
			const S5 = csim(); const sw = build(S5, 200, 'sword', null, null, [ anch ]).k;
			let pts = 0, filling = 0;
			const g2 = { addColorStop(){} };
			const ctx = new Proxy({ canvas: { width: 2000, height: 2000 } }, { get(t, p){ if(p in t) return t[p]; if(p === 'moveTo' || p === 'lineTo') return () => { if(filling === 0) pts++; }; if(p === 'fill') return () => { filling++; }; if(p === 'createLinearGradient' || p === 'createRadialGradient') return () => g2; return () => {}; }, set(t, p, v){ t[p] = v; return true; } });
			S5.W.drawConstructs(ctx, 0, 0, 2000, 2000);
			const hug = (shp) => {
				const g = ME.constructGeometry(shp, 6000, 1);
				const inBox = (x, y) => g.parts.some(q => Math.abs(x - q.cx) <= q.hw + 0.6 && Math.abs(y - q.cy) <= q.hh + 0.6);
				const P = g.poly; let all = true;
				for(let i = 0; i < P.length; i++){ const a = P[i], b = P[(i + 1) % P.length]; for(const t of [0, 0.5]){ if(!inBox(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)) all = false; } }
				let A = 0; for(let i = 0; i < P.length; i++){ const a = P[i], b = P[(i + 1) % P.length]; A += a[0] * b[1] - b[0] * a[1]; } A = Math.abs(A) / 2;
				if(g.hole){ let H = 0; const Q = g.hole; for(let i = 0; i < Q.length; i++){ const a = Q[i], b = Q[(i + 1) % Q.length]; H += a[0] * b[1] - b[0] * a[1]; } A -= Math.abs(H) / 2; }
				return { all, over: g.area / A };
			};
			const shapes = [ 'sphere', 'sword', 'spike', 'ring', 'star', 'cone', 'arc' ], hs = shapes.map(hug);
			ok('C5 The drawn construct is its exact Shape, and its collision boxes hug that outline (a sphere stays round)', sw && pts === sw.geo.poly.length && hs.every(h => h.all && h.over < 1.35),
				shapes.map((k, i) => k + ' +' + Math.round((hs[i].over - 1) * 100) + '%').join(' · '));
		}
		// ---------- D · physics
		{
			const S = csim(); const k = build(S, 150, 'cube', null, { x: 400, y: 200 }, [ anch ]).k; S.step(60);
			ok('D1 An anchored construct stays where it is', k && k.alive && k.x === 400 && k.y === 200, k ? r1(k.x) + ',' + r1(k.y) : '');
			const S2 = csim(); const f = build(S2, 150, 'cube', null, { x: 400, y: 150 }).k;
			const st0 = f ? f.state : ''; S2.step(150);
			const bottom = f ? f.by1 : 0;
			ok('D2 A free construct falls and comes to rest on the ground', f && st0 === 'free' && Math.abs(bottom - FLOOR) < 12 && Math.abs(f.vy) < 0.5 && f.onGround, f ? 'bottom ' + r1(bottom) + ' (ground ' + FLOOR + ') vy ' + f.vy.toFixed(2) : '');
			// a creature's own movement, then the construct pushes it out
			const S3 = csim(); const plat = build(S3, 200, 'line', { construction_facing: 'right' }, { x: 600, y: 300 }, [ anch ]).k;
			const me = rect(560, 200, 20, 40);
			for(let i = 0; i < 80; i++){ const px = me.x, py = me.y; me.vy = Math.min(14, me.vy + 0.6); me.onGround = false; me.x += me.vx; me.y += me.vy; S3.W.collideEntity(me, px, py, {}); S3.step(1); }
			ok('D3 You can stand on a construct platform (the movement system treats it as ground)', plat && me.onGround && Math.abs(me.y + me.h - plat.by0) < 1.5, plat ? 'feet ' + r1(me.y + me.h) + ' · platform top ' + r1(plat.by0) : '');
			const S4 = csim(); const wall = build(S4, 200, 'wall', { construction_facing: 'right' }, { x: 600, y: 300 }, [ anch ]).k;
			const w2 = rect(500, 290, 20, 40); w2.vx = 6;
			for(let i = 0; i < 40; i++){ const px = w2.x, py = w2.y; w2.vx = 6; w2.x += w2.vx; S4.W.collideEntity(w2, px, py, {}); }
			ok('D4 A construct wall blocks movement', wall && w2.x + w2.w <= wall.bx0 + 1 && w2.x + w2.w > wall.bx0 - 8, wall ? 'stopped at ' + r1(w2.x + w2.w) + ' · wall face ' + r1(wall.bx0) : '');
			// forming right on top of you: it is placed clear of you, or lets you through — never traps you
			const S5 = csim(); const k5 = (function(){ S5.cast([ gen(200), shape('cube'), anch, tech('construction', 6) ]); return S5.cons()[0]; })();
			const cr = { x: S5.c.x, y: S5.c.y, w: S5.c.w, h: S5.c.h };
			const overl = k5 && S5.W.T.constructRect(k5, cr.x, cr.y, cr.w, cr.h);
			ok('D5 Built at you: it forms clear of you (or you pass through it until clear) — never trapped', k5 && (!overl || k5.ghost.has(S5.c)), k5 ? 'moved to ' + r1(k5.x - 110) + ',' + r1(k5.y - 120) + ' from you · overlapping ' + !!overl : 'none');
			const S5b = csim(); const k5b = build(S5b, 200, 'cube', null, null, [ anch ]).k;
			if(k5b){ k5b.x = S5b.c.x + 10; k5b.y = S5b.c.y + 20; k5b.ghost.add(S5b.c); }
			const g0 = { x: S5b.c.x, y: S5b.c.y }; S5b.W.collideEntity(S5b.c, g0.x, g0.y, {});
			const stayed = S5b.c.x === g0.x && S5b.c.y === g0.y;
			S5b.c.x = 900; S5b.step(2);
			ok('…someone inside it is not pushed or trapped, and collides normally once clear', k5b && stayed && !k5b.ghost.has(S5b.c), 'stayed ' + stayed + ' · ghost cleared ' + (k5b && !k5b.ghost.has(S5b.c)));
			const S6 = csim({ solid: () => true });
			const r6 = S6.cast([ gen(100), anch, tech('construction', 6) ]);
			ok('D6 No room (inside terrain): it fails cleanly and the energy stays', r6.ok && S6.cons().length === 0 && S6.live().length === 1 && /No room to build/.test(r6.instance.log.map(l => l.text).join(' ')), r6.instance.log.map(l => l.text).slice(-1)[0]);
			// a moving (guided) construct carries what stands on it
			const dummy = { x: 1400, y: 180, w: 30, h: 50, hp: 999, maxHp: 999 };
			const S7 = csim({ enemies: [dummy] });
			S7.cast([ ['target', { kind: 'enemy', select: 'nearCaster', range: 1600 }], gen(200), shape('line'), ['anchor', { state: 'guided' }], tech('construction', 6, { construction_facing: 'right' }) ]);
			const gk = S7.cons()[0];
			if(gk){ gk.x = 500; gk.y = 300; gk.ghost.clear(); }
			const rider = rect(490, 300 - 4 - 40 - 1, 20, 40);
			S7.step(1);
			const x0 = rider.x;
			for(let i = 0; i < 40; i++){ const px = rider.x, py = rider.y; rider.vy = Math.min(14, rider.vy + 0.6); rider.x += rider.vx; rider.y += rider.vy; S7.step(1); S7.W.collideEntity(rider, px, py, {}); }
			ok('D7 A moving construct carries you (guided toward its target)', gk && gk.state === 'guided' && gk.x > 510 && rider.x > x0 + 8 && rider.onGround, gk ? 'construct moved ' + r1(gk.x - 500) + ' px · you moved ' + r1(rider.x - x0) + ' px' : 'none');
			const S8 = csim(); const base = build(S8, 300, 'line', { construction_facing: 'right' }, { x: 500, y: 300 }, [ anch ]).k; const drop = build(S8, 80, 'cube', null, { x: 500, y: 150 }).k;
			S8.step(150);
			ok('D8 Constructs collide with each other (a falling block lands on a platform)', base && drop && drop.alive && Math.abs(drop.by1 - base.by0) < 12 && Math.abs(drop.vy) < 0.6, drop ? 'block bottom ' + r1(drop.by1) + ' · platform top ' + r1(base.by0) : '');
			const p1 = { x: 300, y: 300, vx: 6, vy: 0, dmg: 25, width: 10, height: 10 };
			const S9 = csim({ projs: [p1] }); const w9 = build(S9, 200, 'wall', { construction_facing: 'right' }, { x: 380, y: 300 }, [ anch ]).k; const i0 = w9 ? w9.integrity : 0;
			for(let i = 0; i < 30; i++){ p1.x += p1.vx; S9.step(1); }
			ok('D9 Enemy projectiles break against a construct (and wear it down)', w9 && S9.projs.length === 0 && w9.integrity < i0, w9 ? 'integrity ' + r1(i0) + ' → ' + r1(w9.integrity) : '');
			const S10 = csim(); const w10 = build(S10, 200, 'wall', { construction_facing: 'right' }, { x: 500, y: 200 }, [ anch ]).k; const i10 = w10 ? w10.integrity : 0;
			S10.cast([ gen(40), ['redirect', { toward: 'right', speed: 8 }] ]);
			const shot = S10.live()[0]; if(shot){ shot.x = 420; shot.y = 200; }
			S10.step(40);
			ok('D10 Energy flying into a construct strikes it like a surface (stopped, remembered, damage dealt)', w10 && shot && !shot.alive && w10.integrity < i10 && ME.memCount(shot, 'hitSurface') >= 1, w10 ? 'integrity ' + r1(i10) + ' → ' + r1(w10.integrity) : '');
			const en = { x: 700, y: 170, w: 30, h: 60, hp: 500, maxHp: 500 };
			const S11 = csim({ enemies: [en] }); const rock = build(S11, 200, 'cube', null, { x: 560, y: 200 }).k;
			if(rock){ rock.vx = 12; rock.vy = -1; }
			S11.step(30);
			ok('D11 A moving construct strikes creatures in its way', rock && en.hp < 500 && ME.memCount(rock, 'constructImpact') >= 1, 'enemy hp 500 → ' + r1(en.hp));
			// crushing: a falling construct pins a creature against the floor. The host's crush hook decides: crushed (it rests on it) or held (it braces)
			{
				const crushRun = (answer) => {
					const S = csim(); const k = build(S, 400, 'cube', null, { x: 520, y: 180 }).k;
					const ent = rect(500, FLOOR - 40, 30, 40); let calls = 0, maxPop = 0;
					const free = (x, y, w, h) => y + h <= FLOOR + 0.01;
					for(let i = 0; i < 120; i++){
						const px = ent.x, py = ent.y; ent.vy = Math.min(14, ent.vy + 0.6); ent.y += ent.vy; if(ent.y + ent.h > FLOOR){ ent.y = FLOOR - ent.h; ent.vy = 0; }
						S.step(1);
						S.W.collideEntity(ent, px, py, { free, crush: (e, P) => { calls++; return P > 0 ? answer : 'ghost'; } });
						maxPop = Math.max(maxPop, Math.abs(ent.x - px));
					}
					return { k, ent, calls, maxPop };
				};
				const c1 = crushRun('crushed'), c2 = crushRun('held');
				ok('D11b A falling construct crushes a pinned creature (and rests on it)', c1.k && c1.calls >= 1 && c1.k.y < FLOOR - 40 && ME.memCount(c1.k, 'constructCrush') >= 1 && c1.maxPop <= 13, 'crush calls ' + c1.calls + ' · construct y ' + (c1.k ? r1(c1.k.y) : '—') + ' · biggest sideways pop ' + r1(c1.maxPop));
				ok('D11c A creature strong enough braces: the construct is held on top of it', c2.k && c2.calls >= 1 && c2.k.y + 10 < c2.ent.y && c2.maxPop <= 13, 'construct y ' + (c2.k ? r1(c2.k.y) : '—') + ' · creature y ' + r1(c2.ent.y));
			}
			const S12 = csim(); const w12 = build(S12, 200, 'cube', null, { x: 500, y: 200 }, [ anch ]).k; const i12 = w12 ? w12.integrity : 0;
			const box = { x: 470, y: 180, w: 50, h: 40 };
			S12.W.strikeConstructs(box, 30, { attackId: 7 }); S12.W.strikeConstructs(box, 30, { attackId: 7 }); const once = w12 ? i12 - w12.integrity : 0;
			S12.W.strikeConstructs(box, 30, { attackId: 8 });
			ok('D12 Melee hits a construct once per attack', w12 && Math.abs(once - 30) < 0.01 && Math.abs(i12 - w12.integrity - 60) < 0.01, 'first attack −' + r1(once) + ' · after two attacks −' + r1(i12 - (w12 ? w12.integrity : 0)));
			const S13 = csim(); const w13 = build(S13, 120, 'cube', null, { x: 300, y: 370 }, [ anch ]).k;
			ok('D13 Constructs are physical objects for the environment (pressure plates)', w13 && S13.W.constructsIn(280, 390, 40, 12).length === 1 && S13.W.constructsIn(900, 390, 40, 12).length === 0, '');
		}
		// ---------- E · integrity
		{
			const S = csim(); const k = build(S, 150, 'cube', null, { x: 500, y: 200 }, [ anch ]).k;
			const amb0 = S.W.ambient.size;
			S.W.damageConstruct(k, k.integrity + 10, 'test');
			const me = rect(490, 160, 20, 40), y0 = me.y; me.y += 30; S.W.collideEntity(me, me.x, y0, {});
			const t = S.cast([ ['target', { kind: 'construct', select: 'nearCaster', range: 1600 }] ]);
			ok('E1 At zero integrity it breaks at once: no collision, not targetable, effects, memory', k && !k.alive && k.dead && S.W.constructAt(500, 200) === null && me.y === y0 + 30 && t.instance.log.some(l => /No construct in range/.test(l.text)) && ME.memCount(k, 'constructDestroyed') === 1 && S.W.debris.length > 0,
				'alive ' + k.alive + ' · debris ' + S.W.debris.length);
			ok('E2 Breaking returns only part of it, once (to the environment) — never a full refund', k.recovered && k.released > 0 && k.released < k.recoverable && k.released < k.energy * 0.3 && S.W.ambient.size >= amb0, 'released ' + r1(k.released) + ' of ' + r1(k.energy) + ' E');
			const st = ME.constructStats({ amount: 1e6, scale: 0.01, comp: 50 }, 20, 3);
			ok('E3 Integrity is bounded', st.integrity <= CC.integrityMax && st.integrity >= CC.integrityMin, r1(st.integrity));
		}
		// ---------- F · interactions
		{
			const en = { x: 470, y: 170, w: 30, h: 60, hp: 500, maxHp: 500 };
			const S = csim({ enemies: [en] }); const hot = build(S, 200, 'wall', { construction_facing: 'right' }, { x: 510, y: 200 }, [ tech('thermal', 6), anch ]).k;
			S.step(40);
			const st = S.W.status.get(en);
			ok('F1 A construct made of Thermal energy burns what touches it', hot && hot.tech && hot.tech.thermal > 0 && st && st.burn, hot ? 'material ' + hot.origin + ' · burn ' + !!(st && st.burn) : '');
			const S2 = csim(); const w2 = build(S2, 300, 'wall', { construction_facing: 'right' }, { x: 500, y: 200 }, [ anch ]).k;
			S2.cast([ gen(30), tech('thermal', -6), ['redirect', { toward: 'right', speed: 8 }] ]); const ice = S2.live()[0]; if(ice){ ice.x = 440; ice.y = 200; }
			S2.step(30);
			const brittle = w2 && w2.brittle > S2.W.time; const i2 = w2.integrity; S2.W.damageConstruct(w2, 10, 'test');
			ok('F2 Reverse Thermal makes a construct brittle (it takes more damage for a while)', brittle && Math.abs((i2 - w2.integrity) - 15) < 0.01, 'took ' + (i2 - w2.integrity).toFixed(1) + ' from 10');
			const push = (techs) => { const S3 = csim(); const k = build(S3, 120, 'cube', null, { x: 500, y: 200 }).k; S3.cast([ gen(40) ].concat(techs).concat([ ['redirect', { toward: 'right', speed: 8 }] ])); const b = S3.live()[0]; if(b){ b.x = 440; b.y = 200; } k.vy = 0; for(let i = 0; i < 12; i++){ S3.step(1); } return k.x - 500; };
			const dRaw = push([]), dKin = push([ tech('kinetic', 6) ]);
			ok('F3 Kinetic energy shoves a free construct much harder than raw energy', dKin > dRaw * 1.5 && dRaw >= 0, 'raw ' + dRaw.toFixed(1) + ' px · kinetic ' + dKin.toFixed(1) + ' px');
			const S4 = csim(); const k4 = build(S4, 120, 'cube', null, { x: 500, y: 200 }, [ anch ]).k;
			S4.cast([ gen(40), tech('gravity', 6), ['redirect', { toward: 'right', speed: 6 }] ]); const gb = S4.live()[0]; if(gb){ gb.x = 450; gb.y = 200; }
			S4.step(20);
			const fall = (techs) => { const S5 = csim(); const k = build(S5, 120, 'cube', null, { x: 500, y: 100 }, techs).k; S5.step(40); return k.y - 100; };
			const fRaw = fall([]), fFloat = fall([ tech('gravity', -6) ]);
			ok('F4 Gravity energy weighs a construct (not used up by it); a reverse-Gravity construct floats', gb && gb.alive && k4.gHit && k4.gHit.k > 1 && fFloat < fRaw * 0.5, 'gravity energy alive ' + !!(gb && gb.alive) + ' · fell raw ' + r1(fRaw) + ' px / reverse-gravity ' + r1(fFloat) + ' px');
			// a portal carries a free construct that fits
			const S6 = csim({ solid: () => false });
			S6.cast([ gen(120), tech('spatial', 6, { spatial_dest: 'up', spatial_dist: 300 }) ]); S6.step(2);
			const P = S6.live().find(q => q.spatial && q.spatial.kind !== 'surface');
			const small = build(S6, 30, 'cube', null, P ? { x: P.x, y: P.y } : null).k;
			let moved = false; for(let i = 0; i < 6 && small && !moved; i++){ S6.step(1); if(P && Math.abs(small.y - P.spatial.y1) < 60) moved = true; }
			ok('F5 A portal carries a free construct that fits through it', !!P && small && moved, P && small ? 'construct at ' + r1(small.x) + ',' + r1(small.y) + ' · exit ' + r1(P.spatial.x1) + ',' + r1(P.spatial.y1) : (P ? 'no construct' : 'no portal'));
			const S7 = csim(); const w7 = build(S7, 200, 'wall', { construction_facing: 'right' }, { x: 500, y: 200 }, [ anch ]).k;
			S7.cast([ gen(40), tech('light', 6), ['redirect', { toward: 'right' }] ]); const lb = S7.live()[0]; if(lb){ lb.x = 430; lb.y = 200; }
			S7.step(30);
			ok('F6 Light passes through surfaces, but a construct blocks it', ME.Techniques.get('light').onSurface(S7.W.T, {}, 1) === 'pass' && lb && !lb.alive && lb.x < 520, lb ? 'light stopped at x ' + r1(lb.x) : '');
			const hit = (techs) => { const S8 = csim(); const w = build(S8, 400, 'wall', { construction_facing: 'right' }, { x: 500, y: 200 }, [ anch ]).k; const i0 = w.integrity; S8.cast([ gen(40) ].concat(techs).concat([ ['redirect', { toward: 'right', speed: 8 }] ])); const b = S8.live()[0]; if(b){ b.x = 440; b.y = 200; } S8.step(30); return i0 - w.integrity; };
			const hRaw = hit([]), hAnti = hit([ tech('antimagic', 6) ]);
			const S9 = csim(); S9.cast([ ['zone', { radius: 300 }], tech('antimagic', 8) ]); const z = S9.W.bodies.find(q => q.isZone);
			const w9 = build(S9, 150, 'cube', null, { x: z.x + 40, y: z.y }, [ anch ]).k; const i9 = w9.integrity; S9.step(120);
			ok('F7 Anti-Magic breaks constructs far faster than raw energy, and an Anti-Magic zone wears them away', hAnti > hRaw * 2 && w9.integrity < i9, 'raw −' + r1(hRaw) + ' · anti-magic −' + r1(hAnti) + ' · in the zone ' + r1(i9) + ' → ' + r1(w9.integrity));
			const S10 = csim(); const wr = build(S10, 200, 'cube', null, { x: 500, y: 200 }, [ anch ]).k; S10.W.damageConstruct(wr, 80, 'test'); const ir = wr.integrity, rec0 = wr.recoverable;
			S10.cast([ ['target', { kind: 'construct', select: 'nearCaster', range: 1600 }], gen(100), ['reinforce', { portion: 100 }] ]);
			ok('F8 Reinforcement → a construct restores integrity (bounded), never what it can give back', wr.integrity > ir && wr.maxIntegrity <= wr.baseIntegrity * CC.reinforceCap + 0.01 && wr.recoverable === rec0 && ME.memCount(wr, 'reinforced') === 1, 'integrity ' + r1(ir) + ' → ' + r1(wr.integrity) + ' / ' + r1(wr.maxIntegrity));
			const states = {};
			for(const st of [ 'anchored', 'free', 'guided', 'bound', 'attached' ]){
				const dummy = { x: 900, y: 150, w: 30, h: 50, hp: 999, maxHp: 999 };
				const S11 = csim({ enemies: [dummy] });
				const pre = st === 'free' ? [] : (st === 'attached' ? [ ['anchor', { state: 'attached', where: 'self' }] ] : (st === 'guided' || st === 'bound' ? [ ['anchor', { state: st }] ] : [ anch ]));
				S11.cast([ ['target', { kind: 'enemy', select: 'nearCaster', range: 1600 }], gen(80), shape('cube') ].concat(pre).concat([ tech('construction', 6) ]));
				const k = S11.cons()[0]; states[st] = k ? k.state : 'none';
			}
			ok('F9 The Anchor / State the energy was in carries over to the construct', Object.keys(states).every(k => states[k] === k), JSON.stringify(states));
			// energy drawn from an Infinity source builds like any energy; the source is untouched and dismantling gives plain energy back (nothing duplicated)
			const S12 = csim(); S12.cast([ gen(600), ['compress', { power: 25 }], anch, tech('infinity') ]); const src12 = S12.live().find(q => q.infSource);
			S12.cast([ gen(120), shape('cube'), anch ]); const drawn = S12.live().find(q => !q.infSource); if(drawn && src12){ drawn.infDerived = true; drawn.infFrom = src12.id; drawn.x = 600; drawn.y = 200; }
			const a12 = src12 ? src12.amount : 0, n12 = S12.live().length;
			S12.cast([ ['target', { kind: 'energy', select: 'nearMouse', range: 1600 }], tech('construction', 6) ], { host: Object.assign(S12.host, { mouseWorld: () => ({ x: 600, y: 200 }) }) });
			const k12 = S12.cons()[0];
			S12.cast([ ['target', { kind: 'construct', select: 'nearCaster', range: 1600 }], tech('construction', -6) ]);
			const back = S12.live().find(q => !q.infSource);
			ok('F10 Infinity is compatible: drawn energy builds normally, the source is untouched, nothing is duplicated', src12 && k12 && src12.alive && src12.infSource && Math.abs(src12.amount - a12) < 1 && back && !back.infDerived && !back.infSource && S12.live().length === n12, k12 ? 'built ' + k12.shape + ' from drawn energy · source ' + r1(src12.amount) + ' E' : 'none');
		}
		// ---------- G · reverse Construction (dismantle)
		{
			const S = csim(); const k = build(S, 200, 'cube', null, { x: 500, y: 200 }, [ anch ]).k;
			const res = S.cast([ ['target', { kind: 'construct', select: 'nearCaster', range: 1600 }], tech('construction', -6), ['redirect', { toward: 'right', speed: 6 }] ]);
			const b = S.live()[0];
			S.step(10);
			ok('G1 Reverse Construction dismantles your construct into raw energy the rest of the spell uses', res.ok && !k.alive && k.deathWhy === 'dismantled' && b && b.amount <= k.recoverable + 0.01 && b.amount < k.material && b.x > 505 && ME.memCount(b, 'constructDismantled') === 1 && ME.memCount(b, 'constructEnergyRecovered') === 1,
				b ? 'recovered ' + r1(b.amount) + ' of ' + r1(k.energy) + ' E (recoverable ' + r1(k.recoverable) + ')' : (res.error || 'nothing'));
			const res2 = S.cast([ ['target', { kind: 'construct', select: 'nearCaster', range: 1600 }], tech('construction', -6) ]);
			ok('G2 Its energy can be recovered only once', k.recovered && S.live().length === 1 && !res2.instance.log.some(l => /Dismantled/.test(l.text)), res2.instance.log.map(l => l.text).slice(-1)[0]);
			const small = ME.deriveProfile({ magicControl: 20, magicPower: 0, magicProfile: { techniquePoints: 20, allocations: { construction: 2 } } });
			const S3 = csim(); const k3 = build(S3, 400, 'cube', null, { x: 500, y: 200 }, [ anch ]).k;
			const res3 = S3.cast([ ['target', { kind: 'construct', select: 'nearCaster', range: 1600 }], tech('construction', -6) ], { profile: small });
			const b3 = S3.live()[0];
			ok('G3 Dismantling respects Max Output (the rest disperses)', k3 && !k3.alive && (!b3 || b3.amount <= small.maxOutput + 0.5) && k3.recoverable > small.maxOutput, 'max output ' + small.maxOutput + ' · recovered ' + (b3 ? r1(b3.amount) : 0) + ' of up to ' + r1(k3.recoverable));
			const S4 = csim(); const other = (function(){ S4.cast([ gen(150), shape('cube'), anch, tech('construction', 6) ], { owner: { id: 'rival', entity: { x: 900, y: 100, w: 20, h: 40 } } }); return S4.cons()[0]; })();
			const res4 = S4.cast([ ['target', { kind: 'construct', select: 'nearCaster', range: 1600 }], tech('construction', -6) ]);
			ok('G4 Only your own constructs can be dismantled', other && other.alive && res4.instance.log.some(l => /Only your own constructs/.test(l.text)), res4.instance.log.map(l => l.text).slice(-1)[0]);
			const give = (dmg) => { const S5 = csim(); const q = build(S5, 200, 'cube', null, { x: 500, y: 200 }, [ anch ]).k; S5.W.damageConstruct(q, q.integrity * dmg, 'test'); S5.cast([ ['target', { kind: 'construct', select: 'nearCaster', range: 1600 }], tech('construction', -6) ]); const r = S5.live()[0]; return r ? r.amount : 0; };
			const whole = give(0), worn = give(0.7);
			ok('G5 A damaged construct gives back less', worn < whole * 0.75 && worn > 0, 'whole ' + r1(whole) + ' E · 70% damaged ' + r1(worn) + ' E');
			const v1 = ME.validate(chain('v', [ gen(30), tech('construction', -5) ]), prof), v2 = ME.validate(chain('v', [ ['target', { kind: 'construct', select: 'nearCaster' }], tech('construction', -5), ['redirect', { toward: 'mouse' }] ]), prof);
			ok('G6 The forge: reverse needs Target → Construct first; with it, no energy is needed and the recovered energy carries on', !v1.ok && v1.errors.some(e => e.code === 'CONSTRUCT_REVERSE') && v2.ok, (v1.errors[0] || {}).text + ' · targeted: ' + (v2.ok ? 'valid' : v2.errors.map(e => e.text).join('; ')));
		}
		// ---------- H · lifecycle
		{
			const S = csim(); const b = build(S, 150, 'cube', null, { x: 500, y: 200 }, [ anch ]); S.step(30);
			ok('H1 It persists after its spell has ended', b.k && b.k.alive && !S.W.instances.some(i => i.id === b.res.instance.id), 'spells running ' + S.W.instances.length + ' · construct alive ' + (b.k && b.k.alive));
			S.W.T.time = S.W.time; b.k.dieAt = S.W.time + 0.05; const amb = Array.from(S.W.ambient.values()).reduce((a, c) => a + c.e, 0); S.step(6);
			ok('H2 It is temporary: it expires (and leaves part of its energy in the environment)', !b.k.alive && b.k.deathWhy === 'expired' && b.k.released > 0, 'expired after ' + r1(b.k.life) + ' s life');
			const S2 = csim(); const k2 = build(S2, 150, 'cube', null, { x: 500, y: 200 }, [ anch ]).k;
			const n = S2.W.clearOwner('p');
			ok('H3 O (clear your spells) dissolves your constructs too — nothing recovered', !k2.alive && k2.deathWhy === 'cleared' && !(k2.released > 0) && n >= 1, 'cleared ' + n);
			const S3 = csim(); for(let i = 0; i < CC.maxPerOwner + 2; i++){ const q = build(S3, 40, 'cube', null, { x: 200 + i * 60, y: 200 }, [ anch ]).k; }
			ok('H4 Bounded: past your limit the oldest construct crumbles', S3.cons().length === CC.maxPerOwner && S3.W.constructs.filter(q => q.deathWhy === 'replaced').length === 2, S3.cons().length + ' alive (limit ' + CC.maxPerOwner + ')');
			const S4 = csim(); const k4 = build(S4, 150, 'cube', null, { x: 500, y: 200 }, [ anch ]).k; S4.W.clearConstructs('p', 'death');
			S4.W.clear();
			ok('H5 Death crumbles your constructs (nothing recovered); a reset world has none (nothing is saved)', !k4.alive && k4.deathWhy === 'death' && !(k4.released > 0) && S4.W.constructs.length === 0, '');
			const S5 = csim(); for(let i = 0; i < 20; i++) S5.cast([ gen(40), anch, tech('construction', 6) ]);
			ok('…and many casts never build past the cap', S5.cons().length <= CC.maxPerOwner, S5.cons().length + ' alive');
		}
		// ---------- I · Spell Memory
		{
			const S = csim();
			const r = S.cast([ gen(150), shape('cube'), anch, tech('construction', 6), ['memory', { event: 'constructCreated', test: 'atLeast', count: 1 }], gen(10) ]);
			const k = S.cons()[0];
			ok('I1 Spell Memory reads the construct the branch built', r.ok && k && S.live().length === 1 && ME.validate(chain('m', [ gen(150), tech('construction'), ['memory', { event: 'constructCreated' }], gen(10) ]), prof).ok, 'continued: ' + (S.live().length === 1));
			k.x = 500; k.y = 200;
			S.W.damageConstruct(k, 5, 'a'); S.W.damageConstruct(k, 5, 'b');
			const one = ME.memCount(k, 'constructDamaged');
			const S2 = csim(); const w2 = build(S2, 600, 'cube', null, { x: 500, y: 200 }, [ anch ]).k;
			S2.cast([ gen(200), tech('antimagic', 3), anch ]); const am = S2.live()[0]; am.x = w2.bx0 - 6; am.y = 200;
			S2.step(60);
			ok('I2 No duplicate events: one memory per blow, not per frame of contact', one === 1 && ME.memCount(w2, 'constructDamaged') <= 5 && ME.memCount(w2, 'constructDamaged') >= 1, 'same-frame blows → ' + one + ' · 1 s of Anti-Magic contact → ' + ME.memCount(w2, 'constructDamaged'));
			const S3 = csim(); const k3 = build(S3, 150, 'cube', null, { x: 500, y: 200 }, [ anch ]).k;
			S3.W.damageConstruct(k3, 1e5, 'x'); S3.W.damageConstruct(k3, 1e5, 'x');
			ok('I3 Destroyed is remembered once', ME.memCount(k3, 'constructDestroyed') === 1 && ME.memCount(k3, 'constructCreated') === 1, '');
		}
		// ---------- J · regressions / safety
		{
			const S = csim(); S.cast([ gen(120), ['divide', { count: 3, motion: 'still' }], anch, tech('construction', 6) ]);
			ok('J1 Divided energy builds one construct per piece (neighbours never destroy each other)', S.cons().length === 3, S.cons().length + ' constructs');
			const S2 = csim(); const k2 = build(S2, 150, 'cube', null, { x: 500, y: 200 }, [ anch ]).k;
			S2.cast([ gen(30), anch ]); const still = S2.live()[0]; still.x = 500; still.y = 200; S2.step(20);
			ok('J2 Still energy inside a construct is left alone (only energy flying into it strikes it)', still.alive && k2.integrity === k2.maxIntegrity, 'energy alive ' + still.alive);
			const S3 = csim(); const k3 = build(S3, 150, 'cube', null, { x: 500, y: 200 }, [ tech('thermal', 6), anch ]).k;
			const th = ME.Techniques.get('thermal'), orig = th.constructTick; th.constructTick = () => { throw new Error('boom'); };
			let threw = false; try { S3.step(3); } catch(e){ threw = true; } th.constructTick = orig;
			ok('J3 A failing construct hook never breaks the game (the crash guard reports it)', !threw && S3.W.errors.some(e => /boom/.test(e.msg)) && k3.alive, (S3.W.errors[0] || {}).msg || '');
			const S4 = csim(); S4.cast([ gen(40), ['redirect', { toward: 'right', speed: 8 }] ]); const b4 = S4.live()[0]; S4.step(20);
			ok('J4 Without constructs energy flies exactly as before', b4 && b4.alive && b4.x > 150 && S4.W.constructs.length === 0, b4 ? 'x ' + r1(b4.x) : '');
		}
		// ---------- DM · Domain Expansion
		{
			/* tree: Zone → [Target env → Draw Out] and [after a delay] → Domain → rules */
			const domainSpell = (opt) => {
				opt = opt || {};
				const s = ME.blankSpell('dom'); const root = s.nodes[s.rootId]; root.type = 'zone'; root.params = Object.assign(ME.paramDefaults('zone'), { radius: opt.radius || 300 });
				let seq = 1;
				const add = (type, parent, params, link) => { const n = ME.makeNode(type, parent, 's', 0, seq, seq); seq++; n.params = Object.assign(ME.paramDefaults(type), params || {}); if(link) n.link = Object.assign(n.link, link); s.nodes[n.id] = n; return n; };
				const t = add('target', root.id, { kind: 'environment' });
				add('drawOut', t.id, { duration: 1.6, infAmount: opt.fuel || 500, flow: 'one' });
				const d = add('domain', root.id, Object.assign({ form: 'closed', duration: 4 }, opt.domain || {}), { mode: 'delay', delay: 1.8 });
				if(opt.rules !== false){
					const g = add('generate', d.id, { amount: 20 }, opt.ruleLink || { mode: 'delay', delay: 0.5 });
					const tq = add('technique', g.id, { technique: 'thermal', power: 5 });
					add('redirect', tq.id, { toward: 'target' });
				}
				s.seq = seq; return s;
			};
			const foe = () => ({ x: 280, y: 100, w: 30, h: 50, hp: 3000, maxHp: 3000, vx: 0, vy: 0 });
			const e1 = foe();
			const S = csim({ enemies: [e1] });
			const prof2 = testProfile({ magicPower: 120, magicControl: 20 });
			const rep0 = ME.validate(domainSpell(), prof2);
			const r = S.W.cast(domainSpell(), { profile: prof2, owner: S.owner, host: S.host });
			S.step(125);
			const D = S.W.domains.find(q => q.alive);
			const fuel0 = D ? D.z.amount : 0;
			S.step(120);
			ok('DM1 A filled zone expands into a domain whose rules strike every foe inside, fuelled by the zone', rep0.ok && r.ok && !!D && e1.hp < 3000 && D.z.amount < fuel0, D ? 'foe hp 3000 → ' + r1(e1.hp) + ' · zone fuel ' + r1(fuel0) + ' → ' + r1(D.z.amount) : (rep0.errors.map(e => e.text).join('; ') || 'no domain'));
			// trapped: a foe inside cannot walk out of a closed domain
			e1.x = D.x + D.r - 30; const bx = e1.x; for(let i = 0; i < 20; i++){ e1.x += 6; S.step(1); }
			ok('DM2 A closed domain traps foes inside', Math.hypot(e1.x + 15 - D.x, e1.y + 25 - D.y) < D.r + 4, 'tried to walk 120 px out · ended ' + r1(Math.hypot(e1.x + 15 - D.x, e1.y + 25 - D.y) - D.r) + ' px from the wall');
			// sure-hit: energy fired the wrong way inside curves onto the foe
			const e1b = foe(); const Sb = csim({ enemies: [e1b] }); Sb.W.cast(domainSpell({ rules: false }), { profile: prof2, owner: Sb.owner, host: Sb.host }); Sb.step(125);
			const Db = Sb.W.domains.find(q => q.alive);
			e1b.x = Db.x + 120; e1b.y = Db.y - 25;
			const rs = Sb.cast([ gen(30), ['redirect', { toward: 'left', speed: 6 }] ]); const shot = Sb.live().find(q => q.inst === rs.instance.id); if(shot){ shot.x = Db.x; shot.y = Db.y; shot.age = 1; }
			let struck = false; for(let i = 0; i < 90 && shot && shot.alive; i++){ Sb.step(1); } struck = shot && !shot.alive && shot.deathWhy === 'impact';
			ok('DM3 Sure-hit: your energy inside homes onto a foe (fired the other way, it still hits)', struck, shot ? 'fired left from the centre · ended by ' + (shot.deathWhy || 'nothing') + ' at x ' + r1(shot.x - Db.x) : 'no shot');
			// outside energy cannot get in
			const S2 = csim({ enemies: [foe()] }); S2.W.cast(domainSpell({ rules: false }), { profile: prof2, owner: S2.owner, host: S2.host }); S2.step(125);
			const D2 = S2.W.domains.find(q => q.alive);
			S2.W.cast(chain('rv', [ gen(15), ['redirect', { toward: 'right', speed: 6 }] ]), { profile: prof2, owner: { id: 'rival', entity: { x: 0, y: 0, w: 10, h: 10 } }, host: S2.host });
			const intruder = S2.live().find(q => q.ownerId === 'rival'); if(intruder){ intruder.x = D2.x - D2.r - 30; intruder.y = D2.y; intruder.age = 1; }
			S2.step(30);
			ok('DM4 A closed barrier stops weaker outside energy at its edge', D2 && intruder && !intruder.alive && intruder.deathWhy === 'barrier', intruder ? intruder.deathWhy || 'still alive' : 'none');
			// burnout afterwards
			until(S, () => !S.W.domains.some(q => q.alive), 400);
			const ended = !S.W.domains.some(q => q.alive);
			const rb = S.cast([ gen(30), tech('thermal', 5) ]);
			ok('DM5 When it ends you suffer burnout: techniques fail for a while', ended && rb.instance.log.some(l => /Burnout/.test(l.text)) && S.W.burnoutLeft('p') > 0, 'burnout ' + S.W.burnoutLeft('p').toFixed(1) + ' s left');
			// condition rules: "Target attacks or casts"
			const e3 = foe(); const S3 = csim({ enemies: [e3] });
			S3.host.isAttacking = (e) => !!e.attacking;
			S3.W.cast(domainSpell({ ruleLink: { mode: 'condition', cond: { type: 'targetAttacks', params: {}, timeout: 30 } } }), { profile: prof2, owner: S3.owner, host: S3.host });
			S3.step(140); const calm = e3.hp;
			e3.attacking = true; S3.step(60);
			ok('DM6 Condition rules fire for the foe that meets them ("whoever attacks is struck")', calm === 3000 && e3.hp < 3000, 'hp while calm ' + r1(calm) + ' · after attacking ' + r1(e3.hp));
			// clash: the more refined domain wins and the other is suspended
			const S4 = csim({ enemies: [foe()] });
			S4.W.cast(domainSpell({ rules: false, fuel: 600 }), { profile: prof2, owner: S4.owner, host: S4.host });
			S4.W.cast(domainSpell({ rules: false, fuel: 200 }), { profile: prof2, owner: { id: 'rival', entity: { x: 260, y: 100, w: 20, h: 40 }, foes: () => [S4.c], facing: () => -1 }, host: S4.host });
			S4.step(130);
			const mine = S4.W.domains.find(q => q.ownerId === 'p' && q.alive), theirs = S4.W.domains.find(q => q.ownerId === 'rival' && q.alive);
			ok('DM7 Overlapping domains clash: the more refined one wins, the other is suspended', mine && theirs && !mine.suspended && theirs.suspended, mine && theirs ? 'refinement ' + r1(mine.refine) + ' vs ' + r1(theirs.refine) : 'missing');
			const lowCtl = testProfile({ magicPower: 120, magicControl: 2 });
			const v1 = ME.validate(domainSpell(), lowCtl);
			const v2 = ME.validate(chain('nz', [ gen(50), ['domain', {}] ]), prof2);
			ok('DM8 The forge checks Energy Control, that there is a zone, and how many rule runes you can hold', v1.errors.some(e => e.code === 'DOMAIN_CONTROL') && v2.errors.some(e => e.code === 'DOMAIN_ZONE'), (v1.errors[0] || {}).text + ' · ' + (v2.errors[0] || {}).text);
			// ---------- another caster's portal / kinetic cord turns your energy against you
			{
				const S = csim(); const rival = { id: 'rival', entity: { x: 330, y: 120, w: 20, h: 40 }, facing: () => -1 };
				// the rival's portal: entrance at x 300, exit just behind you (x 40), so your shot comes out moving into your back
				S.W.cast(chain('rp', [ gen(110), tech('spatial', 6, { spatial_dest: 'mouse' }) ]), { profile: prof2, owner: rival, host: Object.assign({}, S.host, { mouseWorld: () => ({ x: 200, y: 120 }) }) });
				S.step(3);
				const portal = S.live().find(q => q.spatial && q.ownerId === 'rival');
				if(portal){ portal.x = 300; portal.y = 120; portal.spatial.x1 = 40; portal.spatial.y1 = 120; portal.spatial.ox = -260; portal.spatial.oy = 0; }
				S.cast([ gen(30), ['redirect', { toward: 'right', speed: 6 }] ]);
				const shot = S.live().find(q => q.ownerId === 'p' && !q.spatial); if(shot){ shot.x = 160; shot.y = 120; shot.age = 1; }
				const hp0 = S.c.hurt || 0; until(S, () => (S.c.hurt || 0) > hp0, 120);
				ok('MG1 Your energy sent through another caster\'s portal can strike you', !!portal && (S.c.hurt || 0) > hp0, 'hurt ' + r1((S.c.hurt || 0) - hp0) + (shot ? ' · shot ' + (shot.hostile ? 'turned' : 'not turned') : ''));
				const S2 = csim();
				const node = (y) => { const r = S2.cast([ gen(40), tech('kinetic', 6) ]); const q = S2.live().find(o => o.inst === r.instance.id); q.x = 300; q.y = y; q.vx = 0; q.vy = 0; return q; };
				const n1 = node(40), n2 = node(200);
				for(const n of [ n1, n2 ]){ n.anchored = true; n.ownerId = 'rival'; }
				n1.bond = { t: { kind: 'energy', ref: n2 }, len: 300, str: 8, mode: 'follow' }; n2.bond = { t: { kind: 'energy', ref: n1 }, len: 300, str: 8, mode: 'follow' };      // the same cord twice
				S2.cast([ gen(30), ['redirect', { toward: 'right', speed: 6 }] ]);
				const sh2 = S2.live().find(q => q.ownerId === 'p' && !q.anchored); if(sh2){ sh2.x = 270; sh2.y = 120; sh2.age = 1; }
				S2.step(12);
				ok('MG2 A kinetic cord flings energy back once (two cords on one line do not cancel), and turns it on its caster', !!sh2 && sh2.vx < 0 && sh2.hostile, sh2 ? 'vx ' + sh2.vx.toFixed(1) + ' · ' + (sh2.hostile ? 'turned' : 'not turned') : 'no shot');
				// a kinetic cord is a line you stand / walk on; only a real impact bounces you (a trampoline)
				const S3 = csim(); const walker = rect(260, 0, 20, 40);
				S3.enemies.push(walker);
				S3.host.bounce = (e, nx, ny, rest) => { if(rest > 0) e.bounced = (e.bounced || 0) + 1; else if(ny < -0.6){ e.vy = 0; e.onGround = true; } };
				const node3 = (x) => { const r = S3.cast([ gen(40), tech('kinetic', 6) ]); const q = S3.live().find(o => o.inst === r.instance.id); q.x = x; q.y = 200; q.vx = 0; q.vy = 0; q.anchored = true; return q; };
				const a3 = node3(150), b3 = node3(400);
				a3.bond = { t: { kind: 'energy', ref: b3 }, len: 300, str: 7, mode: 'follow' };
				const land = (vy) => { walker.x = 260; walker.y = 200 - 20 - 18 + vy; walker.vy = vy; walker.vx = 0; walker.onGround = false; walker.bounced = 0; S3.step(1); return { kb: (walker.bounced || 0) + (walker.vy < -4 ? 1 : 0), vy: walker.vy, stood: !!walker.onGround && Math.abs(walker.vy) < 0.01 }; };
				const soft = land(2), hard = land(14);
				ok('MG3 A kinetic cord holds you up when you land softly, and bounces you like a trampoline on a hard landing', soft.stood && soft.kb === 0 && hard.kb > 0, 'soft landing: ' + (soft.stood ? 'standing' : 'not standing') + (soft.kb ? ' (bounced)' : '') + ' · hard landing: ' + (hard.kb ? 'bounced up at ' + r1(-hard.vy) + ' px/frame' : 'no bounce'));
			}
		}
		// ---------- GR · gravity really moves constructs; falling ones point down, then stick in or settle flat
		{
			const core = (S, gp, amt) => S.cast([ ['target', { kind: 'construct', select: 'nearCaster', range: 1600 }], gen(amt || 120), tech('gravity', gp), ['reinforce', { portion: 100 }] ]);
			const S = csim(); const sw = build(S, 200, 'sword', { construction_facing: 'right' }, { x: 500, y: 60 }).k; core(S, 6);
			S.step(150);
			ok('GR1 A heavy sword falling with gravity turns tip-down and sticks in the ground', sw.stuck && Math.abs(sw.angle - Math.PI / 2) < 0.2 && sw.by1 > FLOOR + 6 && sw.state === 'anchored', 'angle ' + Math.round(sw.angle * 180 / Math.PI) + '° · tip ' + r1(sw.by1 - FLOOR) + ' px into the ground · stuck ' + !!sw.stuck);
			const S2 = csim(); const cb = build(S2, 200, 'cube', null, { x: 500, y: 60 }).k; core(S2, 5); cb.angle = 0.5; S2.W.T.constructsNear(cb.x, cb.y, 1);
			S2.step(200);
			const m = ((cb.angle % (Math.PI / 2)) + Math.PI / 2) % (Math.PI / 2);
			ok('GR2 A block that lands settles flat on a face (it does not stick in)', !cb.stuck && (m < 0.03 || m > Math.PI / 2 - 0.03) && cb.onGround && Math.abs(cb.by1 - FLOOR) < 6, 'angle ' + Math.round(cb.angle * 180 / Math.PI) + '° · bottom ' + r1(cb.by1));
			const pull = (gAmt, cAmt) => { const S3 = csim(); const k = build(S3, cAmt, 'cube', null, { x: 500, y: 200 }, [ anch ]).k; S3.cast([ gen(gAmt), tech('gravity', 6, { gravity_you: 'no' }), anch ]); const g = S3.live().find(q => ME.techOf(q, 'gravity') > 0); g.x = 575; g.y = 200; S3.step(90); return { dx: k.x - 500, st: k.state }; };
			const strong = pull(150, 120), weak = pull(12, 600);
			ok('GR3 Gravity energy tears an anchored construct loose and pulls it in; a weak pull cannot move a heavy one', strong.st === 'free' && strong.dx > 15 && weak.st === 'anchored' && Math.abs(weak.dx) < 0.5, 'strong pull: moved ' + r1(strong.dx) + ' px (' + strong.st + ') · weak pull on a heavy block: ' + weak.st);
			const S4 = csim(); const k4 = build(S4, 150, 'cube', null, { x: 500, y: 200 }, [ anch ]).k;
			S4.cast([ gen(120), tech('gravity', 7), ['redirect', { toward: 'right', speed: 8 }] ]); const gb = S4.live()[0]; gb.x = 420; gb.y = 200;
			S4.step(60);
			ok('GR4 Gravity energy striking an anchored construct knocks it loose and it drops', k4.state === 'free' && k4.y > 230, 'state ' + k4.state + ' · fell ' + r1(k4.y - 200) + ' px');
		}
		// ---------- DR · Draw Out by amount, zone capacity, strain
		{
			const drawn = (S) => S.W.bodies.filter(q => q.drawnOut && !q.zoneBlob).reduce((a, q) => a + (q.drawnTotal || 0), 0);      // what reached the drawn energy (before it leaks)
			const S = csim(); S.cast([ ['target', { kind: 'environment' }], ['drawOut', { duration: 2, flow: 'one', infAmount: 120 }] ]); S.step(150);
			const got = drawn(S);
			ok('DR1 Draw Out pulls the amount you ask for (spread over the duration)', got > 110 && got <= 120.5, r1(got) + ' of 120 E');
			const zone = (r, amt) => { const S2 = csim(); S2.cast([ ['zone', { radius: r }], ['target', { kind: 'environment' }], ['drawOut', { duration: 8, infAmount: amt }] ]); let mx = 0; for(let i = 0; i < 520; i++){ S2.step(1); const z = S2.W.bodies.find(q => q.isZone && q.alive); if(z) mx = Math.max(mx, z.amount); } return mx; };
			const small = zone(180, 5000), big = zone(520, 5000);
			const cap = (r) => Math.round(ME.CONFIG.zoneCapBase * Math.pow(r / 180, 1.5));
			const rep = ME.validate(chain('zc', [ ['zone', { radius: 180 }], ['target', { kind: 'environment' }], ['drawOut', { duration: 8, infAmount: 5000 }] ]), prof);
			ok('DR2 A zone holds at most what its size allows (bigger zone, more), and the forge says so', small > cap(180) * 0.85 && small <= cap(180) + 1 && big > small * 3 && big <= cap(520) + 1 && rep.warnings.some(w => w.code === 'ZONE_CAP'),
				'r180 holds ' + r1(small) + ' / ' + cap(180) + ' · r520 holds ' + r1(big) + ' / ' + cap(520));
			const keepAt = (dur) => { const S3 = csim(); const rnd = Math.random; Math.random = () => 0.999; S3.cast([ ['target', { kind: 'self' }], ['drawOut', { duration: dur, flow: 'one', infAmount: 600 }] ]); S3.step(Math.ceil(dur * 60) + 30); Math.random = rnd; return drawn(S3); };
			const calm = keepAt(4), rushed = keepAt(0.5);
			const rep2 = ME.validate(chain('st', [ ['target', { kind: 'self' }], ['drawOut', { duration: 0.5, infAmount: 600 }] ]), prof);
			ok('DR3 Drawing more at once is harder: a rushed draw loses more of what it pulls (and the forge warns)', calm > 590 && rushed < calm * 0.6 && rep2.warnings.some(w => w.code === 'DRAW_STRAIN'), 'over 4 s kept ' + r1(calm) + ' · over 0.5 s kept ' + r1(rushed) + ' of 600');
			const S4 = csim(); const rnd = Math.random; Math.random = () => 0;
			S4.cast([ ['target', { kind: 'self' }], ['drawOut', { duration: 0.5, flow: 'one', infAmount: 2000 }] ]); S4.step(5); Math.random = rnd; S4.step(40);
			const kept = drawn(S4);
			ok('DR4 …and pushed far enough it backlashes: a burst that catches you, and the draw ends early', (S4.c.hurt || 0) > 0 && kept < 600, 'you took ' + r1(S4.c.hurt || 0) + ' · kept ' + r1(kept) + ' of 2000');
		}
		// ---------- K · moving across, Gravity cores, Rotate
		{
			const S = csim(); const plat = build(S, 600, 'line', { construction_facing: 'right', construction_aspect: 3 }, { x: 500, y: 300 }, [ anch ]).k;
			const e = rect(plat.bx0 + 4, plat.by0 - 41, 20, 40); let x0 = 0, n = 0;
			for(let i = 0; i < 60; i++){ const px = e.x, py = e.y; e.vx = 8; e.vy = Math.min(14, e.vy + 0.6); e.onGround = false; e.x += e.vx; e.y += e.vy; S.W.collideEntity(e, px, py, {}); if(i === 3) x0 = e.x; if(i > 3) n++; if(e.x + e.w > plat.bx1 - 12) break; }
			const S2 = csim(); const ball = build(S2, 400, 'sphere', null, { x: 500, y: 250 }, [ anch ]).k;
			const e2 = rect(ball.bx0 - 30, ball.by0 - 60, 20, 40); let ok2 = true;
			for(let i = 0; i < 50; i++){ const px = e2.x, py = e2.y; e2.vx = 5; e2.vy = Math.min(14, e2.vy + 0.6); e2.x += e2.vx; e2.y += e2.vy; S2.W.collideEntity(e2, px, py, {}); }
			ok('K1 Walking or running on a construct is full speed (and you step over its small edges)', Math.abs((e.x - x0) / n - 8) < 0.05 && e.onGround, 'speed ' + ((e.x - x0) / n).toFixed(2) + ' of 8 · over the sphere: x ' + r1(e2.x - (ball.bx0 - 30)));
			const drop = (gp) => {
				const S3 = csim(); const k = build(S3, 200, 'cube', null, { x: 500, y: 100 }).k;
				if(gp) S3.cast([ ['target', { kind: 'construct', select: 'nearCaster', range: 1600 }], gen(120), tech('gravity', gp), ['reinforce', { portion: 100 }] ]);
				const caster0 = { x: S3.c.x, y: S3.c.y };
				S3.step(30); return { fell: k.y - 100, k, S3, moved: Math.hypot(S3.c.x - caster0.x, S3.c.y - caster0.y) };
			};
			const plain = drop(0), heavy = drop(6), light = drop(-8);
			ok('K2 Reinforcing a construct with Gravity makes it fall faster; reverse Gravity makes it fall slower or float', heavy.k.core && heavy.k.core.alive && heavy.fell > plain.fell * 1.3 && light.fell < plain.fell * 0.4 && light.fell > -5 && light.k.tech && light.k.tech.gravity < 0 && heavy.moved < 0.01,
				'fell in 0.5 s: plain ' + r1(plain.fell) + ' · heavy ' + r1(heavy.fell) + ' · reverse ' + r1(light.fell) + ' px (core ' + (heavy.k.core ? r1(heavy.k.core.amount) + ' E' : 'none') + ', it does not pull you)');
			const S4 = csim(); const k4 = build(S4, 200, 'cube', null, { x: 500, y: 200 }, [ anch ]).k;
			S4.cast([ ['target', { kind: 'construct', select: 'nearCaster', range: 1600 }], gen(80), tech('gravity', -6), ['reinforce', { portion: 100 }] ]);
			S4.step(10); const still = Math.abs(k4.y - 200) < 0.5;
			S4.cast([ ['target', { kind: 'energy', select: 'nearCaster', techFilter: 'gravity', range: 1600 }], ['redirect', { toward: 'right', speed: 6 }] ]);
			S4.step(30); const movedX = k4.x - 500;
			S4.cast([ ['target', { kind: 'energy', select: 'nearCaster', techFilter: 'gravity', range: 1600 }], anch ]); const hx = k4.x, hy = k4.y; S4.step(30);
			ok('K3 Its Gravity energy can be targeted: moving that energy moves the construct, anchoring it holds the construct', still && movedX > 60 && Math.abs(k4.x - hx) < 1 && Math.abs(k4.y - hy) < 1 && k4.state === 'anchored', 'held at first ' + still + ' · redirected ' + r1(movedX) + ' px · then anchored ' + (Math.abs(k4.y - hy) < 1));
			const S5 = csim(); S5.cast([ gen(150), shape('line'), anch, tech('construction', 6, { construction_facing: 'right' }), ['rotate', { mode: 'set', degrees: 90, time: 0 }] ]);
			const k5 = S5.cons()[0]; const a5 = k5 ? k5.angle : 0;
			S5.cast([ ['target', { kind: 'construct', select: 'nearCaster', range: 1600 }], ['rotate', { mode: 'set', degrees: 90, time: 0.5, dir: 'ccw' }] ]); S5.step(40);
			const bw = k5.bx1 - k5.bx0, bh = k5.by1 - k5.by0;
			const S6 = csim(); const k6 = build(S6, 150, 'line', { construction_facing: 'right' }, { x: 500, y: 200 }, [ anch ]).k;
			S6.cast([ ['target', { kind: 'construct', select: 'nearCaster', range: 1600 }], gen(60), tech('gravity', -5), ['reinforce', { portion: 100 }] ]);
			S6.cast([ ['target', { kind: 'energy', select: 'nearCaster', techFilter: 'gravity', range: 1600 }], ['rotate', { mode: 'set', degrees: 45, time: 0 }] ]); S6.step(2);
			ok('K4 The Rotate rune turns a construct — after Construction, on Target → Construct, or by turning its Gravity energy', k5 && Math.abs(a5 - Math.PI / 2) < 1e-6 && Math.abs(k5.angle) < 1e-3 && bw > bh * 4 && Math.abs(k6.angle - Math.PI / 4) < 1e-3,
				'turned to ' + Math.round(a5 * 180 / Math.PI) + '°, back to ' + Math.round(k5.angle * 180 / Math.PI) + '° over 0.5 s · via its energy ' + Math.round(k6.angle * 180 / Math.PI) + '°');
			const S7 = csim(); const k7 = build(S7, 150, 'cube', null, { x: 500, y: 200 }, [ anch ]).k;
			S7.cast([ ['target', { kind: 'construct', select: 'nearCaster', range: 1600 }], gen(60), tech('gravity', 5), ['reinforce', { portion: 100 }] ]);
			const core = k7.core; S7.W.damageConstruct(k7, 1e5, 'x');
			ok('K5 Its Gravity core goes with it when it breaks (nothing left floating)', core && !core.alive && !k7.alive, '');
			// sent somewhere through its core, it turns to point where it goes — unless a Rotate rune set its facing
			const S8 = csim(); const k8 = build(S8, 150, 'line', { construction_facing: 'right' }, { x: 500, y: 300 }, [ anch ]).k;
			S8.cast([ ['target', { kind: 'construct', select: 'nearCaster', range: 1600 }], gen(60), tech('gravity', -6), ['reinforce', { portion: 100 }] ]);
			S8.cast([ ['target', { kind: 'energy', select: 'nearCaster', techFilter: 'gravity', range: 1600 }], ['redirect', { toward: 'up', speed: 5 }] ]); S8.step(30);
			const up8 = k8.angle;
			const S9 = csim(); const k9 = build(S9, 150, 'line', { construction_facing: 'right' }, { x: 500, y: 300 }, [ anch ]).k;
			S9.cast([ ['target', { kind: 'construct', select: 'nearCaster', range: 1600 }], ['rotate', { mode: 'set', degrees: 30, time: 0 }] ]);
			S9.cast([ ['target', { kind: 'construct', select: 'nearCaster', range: 1600 }], gen(60), tech('gravity', -6), ['reinforce', { portion: 100 }] ]);
			S9.cast([ ['target', { kind: 'energy', select: 'nearCaster', techFilter: 'gravity', range: 1600 }], ['redirect', { toward: 'up', speed: 5 }] ]); S9.step(30);
			ok('K6 Redirected, a construct points where it is sent; after a Rotate it keeps the facing you gave it', Math.abs(up8 + Math.PI / 2) < 0.05 && k8.y < 260 && Math.abs(k9.angle - Math.PI / 6) < 1e-3 && k9.y < 260,
				'sent up → ' + Math.round(up8 * 180 / Math.PI) + '° · rotated 30° then sent up → ' + Math.round(k9.angle * 180 / Math.PI) + '°');
			// the core is not drawn as Gravity energy; the construct keeps its colour and gets an aura
			ok('K7 A Gravity core shows only as an aura (no Gravity energy drawn, the construct keeps its colour)', !!k8.core && k8._coreG && !!k8.tech.gravity, '');
		}
	}
	/* ================= ANTI-MAGIC & INFINITY checks ================= */
	function advancedChecks(ok){
		const profInf = testProfile({ magicPower: 120, magicControl: 20 });       // enough control for every Infinity level
		const dummy = () => ({ x: 900, y: 80, w: 30, h: 50, hp: 5000, maxHp: 5000, vx: 0, vy: 0 });
		const sim = (opts) => {
			opts = opts || {};
			const W = ME.createWorld(), c = { x: 100, y: 100, w: 20, h: 40, vx: 0, vy: 0 };
			const enemies = opts.enemies || [], projs = opts.projs || [];
			const host = { mouseWorld: () => (opts.mouse || { x: 400, y: 120 }), getEnemies: () => enemies, isSolid: () => false, inBounds: () => true,
				getForeignProjectiles: () => projs, foreignAlive: (p) => projs.indexOf(p) >= 0, removeForeign: (p) => { const i = projs.indexOf(p); if(i >= 0) projs.splice(i, 1); },
				hurtCaster: (e, d) => { c.hurt = (c.hurt || 0) + d; }, knockback: (e, vx) => { e.kb = (e.kb || 0) + Math.abs(vx); } };
			const o = { profile: opts.profile || profInf, owner: { id: 'p', entity: c }, host };
			return { W, c, host, enemies, projs,
				cast: (steps, name) => W.cast(chain(name || 't', steps), o),
				live: () => W.bodies.filter(x => x.alive),
				step: (n) => { for(let i = 0; i < n; i++) W.update(1 / 60, host); } };
		};
		const tech = (id, p) => ['technique', { technique: id, power: p == null ? 5 : p }];
		const anchored = ['anchor', { state: 'anchored' }];
		const r1 = (v) => Math.round(v);
		/* a body of `amt` energy (optionally with a technique / infinity) placed at (x, y) */
		const put = (S, amt, extra, x, y) => {
			const steps = [ ['generate', { amount: amt }] ].concat(extra || []).concat([ anchored ]);
			const res = S.cast(steps); if(!res.ok) return null;
			const b = S.live().filter(q => q.inst === res.instance.id).sort((a, c) => c.amount - a.amount)[0];
			if(b){ b.x = x; b.y = y; b.vx = 0; b.vy = 0; }
			return b;
		};
		const until = (S, fn, max) => { for(let i = 0; i < (max || 240); i++){ if(fn()) return i; S.step(1); } return -1; };

		// ---- 1-3 Anti-Magic vs raw energy: conserved by magnitude
		{
			const S = sim(); const a = put(S, 34, [ tech('antimagic') ], 300, 300); const r = put(S, 50, [], 2000, 300);
			const a0 = a.amount, r0 = r.amount; r.x = 300; r.peakAmt = 0;
			until(S, () => !a.alive, 200);
			ok('Anti-Magic vs raw energy: it consumes part of it', !a.alive && r.alive && r.amount < r0 - a0 * 0.8 && r.amount > r0 - a0 * 1.15, 'Anti ' + r1(a0) + ' + raw ' + r1(r0) + ' → raw ' + r1(r.amount));
		}
		{
			const S = sim(); const a = put(S, 66, [ tech('antimagic') ], 300, 300); const r = put(S, 50, [], 2000, 300);
			const a0 = a.amount, r0 = r.amount; r.x = 300;
			until(S, () => !r.alive, 200);
			ok('Stronger Anti-Magic consumes the weaker energy and keeps the rest', !r.alive && a.alive && Math.abs(a.amount - (a0 - r0)) < 6, 'Anti ' + r1(a0) + ' + raw ' + r1(r0) + ' → Anti ' + r1(a.amount));
		}
		{
			const S = sim(); const a = put(S, 22, [ tech('antimagic') ], 300, 300); const r = put(S, 80, [], 2000, 300);
			const a0 = a.amount, r0 = r.amount; r.x = 300;
			until(S, () => !a.alive, 200);
			ok('Weaker Anti-Magic is used up by stronger energy', !a.alive && r.alive && Math.abs(r.amount - (r0 - a0)) < 6, 'Anti ' + r1(a0) + ' + raw ' + r1(r0) + ' → raw ' + r1(r.amount));
		}
		// ---- 4-8 techniques
		const vsTech = (id, p, amt, anti) => {
			const S = sim(); const a = put(S, anti || 30, [ tech('antimagic') ], 300, 300); const t = put(S, amt || 60, [ tech(id, p) ], 2000, 300);
			const t0 = t.amount, s0 = ME.techOf(t, id), a0 = a.amount; t.x = 300;
			until(S, () => !a.alive || !t.alive, 200);
			return { S, a, t, t0, s0, a0, lost: t0 - (t.alive ? t.amount : 0), s1: t.alive ? ME.techOf(t, id) : 0 };
		};
		{
			const R = vsTech('thermal');
			ok('Anti-Magic vs Thermal: the flame is suppressed faster than its energy', R.t.alive && Math.abs(R.s1) < Math.abs(R.s0) * (1 - (R.lost / R.t0)) && ME.memCount(R.t, 'antiMagicConsumed') > 0, 'thermal ' + R.s0.toFixed(2) + ' → ' + R.s1.toFixed(2) + ' · energy ' + r1(R.t0) + ' → ' + r1(R.t.amount));
		}
		{
			const R = vsTech('gravity');
			ok('Anti-Magic vs Gravity: the field weakens, and gravity resists a little', R.t.alive && Math.abs(R.s1) < Math.abs(R.s0) && R.lost < R.a0 * 0.95, 'gravity ' + R.s0.toFixed(2) + ' → ' + R.s1.toFixed(2) + ' · lost ' + r1(R.lost) + ' of ' + r1(R.a0) + ' Anti');
		}
		{
			const S = sim(); const a = put(S, 40, [ tech('antimagic') ], 300, 300); const k = put(S, 60, [ tech('kinetic') ], 260, 300);
			k.anchored = false; k.vx = 9; k.vy = 0; const s0 = ME.techOf(k, 'kinetic'), v0 = 9;
			S.step(10);
			const v1 = Math.hypot(k.vx, k.vy);
			ok('Anti-Magic vs Kinetic: force and acceleration drain away', k.alive && ME.techOf(k, 'kinetic') < s0 && v1 < v0, 'kinetic ' + s0.toFixed(2) + ' → ' + ME.techOf(k, 'kinetic').toFixed(2) + ' · speed 9 → ' + v1.toFixed(1));
		}
		{
			const R = vsTech('light');
			ok('Anti-Magic vs Light: light is absorbed (it resists least)', R.lost >= R.a0 * 0.98 && Math.abs(R.s1) < Math.abs(R.s0), 'light ' + R.s0.toFixed(2) + ' → ' + R.s1.toFixed(2) + ' · lost ' + r1(R.lost) + ' to ' + r1(R.a0) + ' Anti');
		}
		{
			// a portal resists strongly — but enough Anti-Magic destabilises it
			const S = sim(); const pt = put(S, 80, [], 300, 300); pt.anchored = true;
			S.cast([ ['target', { kind: 'energy', select: 'nearCaster', range: 1600 }], tech('spatial') ]); S.step(1);      // the portal forms on the next frame
			const P = S.live().find(q => q.spatial); const e0 = P ? P.spatial.end : 0, am0 = P ? P.amount : 0;
			const a = put(S, 30, [ tech('antimagic') ], P ? P.x : 0, P ? P.y : 0);
			until(S, () => !a.alive, 120);
			const weak = P && P.alive && P.spatial && P.spatial.end < e0 && (am0 - P.amount) < 30 * 0.6;
			const a2 = put(S, 400, [ tech('antimagic') ], P ? P.x : 0, P ? P.y : 0);
			until(S, () => !P || !P.alive, 240);
			ok('Anti-Magic vs Spatial: a portal resists, but strong Anti-Magic destabilises it', !!P && weak && !P.alive && ME.memCount(P, 'antiMagicDisrupted') > 0, P ? 'portal lost ' + r1(am0 - (P.alive ? P.amount : 0)) + ' to 30 Anti, time cut · then gone: ' + !P.alive : 'no portal');
		}
		// ---- 9 reinforcement: suppressed while touched, consumed, the rest resumes
		{
			const S = sim();
			S.cast([ ['generate', { amount: 80 }], ['reinforce', {}], ['target', { kind: 'self' }] ]);
			const st = S.W.reinf[0]; S.step(1);
			const e0 = st ? st.energy : 0, p0 = st ? st.props.damageResist : 0;
			const a = put(S, 40, [ tech('antimagic') ], S.c.x + 10, S.c.y + 20); a.hostile = true;
			S.step(6);
			const during = st.props.damageResist, eMid = st.energy;
			until(S, () => !a.alive, 120); S.step(45);
			ok('Anti-Magic vs reinforcement: suppressed while touched, part consumed, the rest resumes', st && eMid < e0 && during < p0 * 0.5 && S.W.reinf.indexOf(st) >= 0 && st.props.damageResist > during * 1.5, 'energy ' + r1(e0) + ' → ' + r1(st.energy) + ' · resist ' + p0.toFixed(2) + ' → ' + during.toFixed(2) + ' (touched) → ' + st.props.damageResist.toFixed(2));
		}
		// ---- 10 zone suppression → collapse
		{
			const S = sim();
			const zoneSpell = chain('z', [ ['zone', { radius: 180 }], ['generate', { amount: 5 }, { mode: 'condition', cond: { type: 'trigger', params: {}, timeout: 10 } }] ]);
			S.W.cast(zoneSpell, { profile: profInf, owner: { id: 'rival', entity: { x: 100, y: 100, w: 20, h: 40 } }, host: S.host });      // someone else's zone
			const z = S.W.bodies.find(q => q.isZone);
			const a = put(S, 120, [ tech('antimagic', 8) ], z.x + 20, z.y);
			S.step(30); const mid = z.amSupp || 0;
			until(S, () => !z.alive, 600);
			ok('Anti-Magic vs zone: gradual suppression, then the zone collapses', mid > 0 && mid < 1 && !z.alive && z.deathWhy === 'suppressed', 'suppression after 0.5 s ' + mid.toFixed(2) + ' · zone ' + (z.alive ? 'still up' : 'collapsed'));
			// your own zone is where you gather — your own Anti-Magic (even formed inside it) leaves it alone
			const S2 = sim();
			S2.cast([ ['zone', { radius: 180 }], ['generate', { amount: 5 }, { mode: 'condition', cond: { type: 'trigger', params: {}, timeout: 10 } }] ]);
			const z2 = S2.W.bodies.find(q => q.isZone);
			const a2 = put(S2, 120, [ tech('antimagic', 8) ], z2.x + 20, z2.y);
			S2.step(120);
			ok('Your own Anti-Magic does not suppress your own zone', z2.alive && !(z2.amSupp > 0) && a2.alive, 'zone ' + (z2.alive ? 'intact (suppression ' + (z2.amSupp || 0).toFixed(2) + ')' : 'destroyed (' + z2.deathWhy + ')'));
		}
		// ---- 11 projectiles: weak ones destroyed, strong ones overpower weak Anti-Magic
		{
			const p1 = { x: 300, y: 300, vx: 0, vy: 0, power: 20, width: 10, height: 10, effects: ['burn'] };
			const p2 = { x: 600, y: 300, vx: 0, vy: 0, power: 300, width: 10, height: 10 };
			const S = sim({ projs: [p1, p2] });
			const a = put(S, 60, [ tech('antimagic') ], 300, 300), a2 = put(S, 20, [ tech('antimagic') ], 600, 300);
			S.step(60);
			ok('Anti-Magic vs projectiles: a weak one is destroyed; a strong one overpowers weak Anti-Magic', S.projs.indexOf(p1) < 0 && S.projs.indexOf(p2) >= 0 && !a2.alive && p2.power < 300, 'weak: ' + (S.projs.indexOf(p1) < 0 ? 'destroyed' : 'alive') + ' · strong: power 300 → ' + r1(p2.power) + ', Anti gone ' + !a2.alive);
		}
		// ---- 12 reverse: restores existing energy, never creates any
		{
			const S = sim(); const r = put(S, 60, [], 300, 300); r.peakAmt = r.amount; r.amount *= 0.5;
			const rv = put(S, 40, [ tech('antimagic', -5) ], 2000, 300);
			const before = r.amount + rv.amount, r0 = r.amount; rv.x = 300;
			S.step(40);
			const after = r.amount + (rv.alive ? rv.amount : 0);
			ok('Reverse Anti-Magic restores weakened energy (no free energy)', r.amount > r0 + 5 && after <= before + 0.5 && ME.memCount(r, 'magicRestored') > 0, 'energy ' + r1(r0) + ' → ' + r1(r.amount) + ' · total ' + r1(before) + ' → ' + r1(after));
		}
		// ---- 13 memory
		{
			const R = vsTech('thermal', 2, 40, 60);
			ok('Anti-Magic Spell Memory: contact, consumed, disrupted', ME.memCount(R.t, 'antiMagicContact') > 0 && ME.memCount(R.t, 'antiMagicConsumed') > 0 && ME.memCount(R.t, 'antiMagicDisrupted') > 0, ME.MEM_EVENTS.filter(m => /antiMagic/.test(m.value)).map(m => m.value + ':' + ME.memCount(R.t, m.value)).join(' '));
		}
		// ---- 14 magical item: erases spells under 10% of its energy, weakens bigger ones, suppresses magic it strikes
		{
			const S = sim(); const sw = put(S, 300, [ tech('antimagic'), ['compress', { power: 25, shape: 'sword' }] ], 50, 50);
			const item = ME.itemFromBody(sw); item.amount = 600;
			const small = put(S, 40, [], 400, 400), big = put(S, 120, [], 460, 400); const b0 = big.amount;
			small.ownerId = 'enemy'; big.ownerId = 'enemy';
			const erased = S.W.antiSweep(430, 400, 60, item.amount, 'p');
			const en = dummy(); S.enemies.push(en); S.W.update(1 / 60, S.host);
			const st = S.W.addItemReinforcement('p', { id: 'magic' }, item, profInf, S.host);
			S.W.T.status(en, 'burn', 5, 3);
			S.W.onMeleeHit('p', 'magic', en, {});
			ok('Anti-Magic magical item: erases spells under 10% of its energy, suppresses magic it strikes', item.tech && item.tech.antimagic > 0 && erased >= 1 && !small.alive && big.alive && big.amount < b0 && !S.W.T.hasStatus(en, 'burn') && S.W.T.hasStatus(en, 'suppressed'), 'erased ' + erased + ' · big ' + r1(b0) + ' → ' + r1(big.amount) + ' · burn cleared ' + !S.W.T.hasStatus(en, 'burn'));
		}
		// ================= INFINITY (reworked: a technique that turns 450+ E at compression 20+ into a reservoir) =================
		const tgtMine = ['target', { kind: 'energy', select: 'nearCaster', range: 1600 }];
		const tgtSrc = ['target', { kind: 'anchorState', astate: 'infinity', select: 'nearCaster', range: 1600 }];
		/* the caster steps next to a body so "nearest to you" picks it */
		const near = (S, b) => { S.c.x = b.x - 30; S.c.y = b.y - 20; };
		/* a body of exactly `amt` energy at compression `comp` (+ techniques), at (x, y); then try to make it Infinity */
		const mkSrc = (S, amt, comp, techs, x, y, profile) => {
			const pre = (techs || []).filter(t => t[1].technique === 'gravity' ? false : true);
			const post = (techs || []).filter(t => t[1].technique === 'gravity');      // gravity goes on after compressing
			const b = put(S, 500, pre.concat([ ['compress', { power: comp }] ]).concat(post), x == null ? 300 : x, y == null ? 300 : y);
			if(!b) return { b: null, res: { ok: false, error: 'no body' } };
			b.amount = amt; b.peakAmt = amt;
			near(S, b);
			const res = S.cast([ tgtMine, tech('infinity') ]);
			return { b, res };
		};
		const drawFrom = (S, src, amount, dur, more) => {
			near(S, src);
			const before = new Set(S.W.bodies);
			S.cast([ tgtSrc, ['drawOut', { duration: dur, infAmount: amount, flow: 'one' }] ].concat(more || []));
			const v = S.W.bodies.find(q => q.infFrom === src.id && !before.has(q)) || null;      // the vessel forms at once
			for(let i = 0; i < Math.ceil(dur * 60) + 6; i++) S.step(1);
			return v;
		};
		// ---- creation: 450 energy and compression 20, both required; nothing is used up when it fails
		{
			const S1 = sim(); const a = mkSrc(S1, 449, 25);
			const S2 = sim(); const b = mkSrc(S2, 450, 25);
			ok('Infinity fails below 450 energy (nothing used up) and succeeds at exactly 450', a.b && !a.b.infSource && a.b.amount === 449 && b.b && !!b.b.infSource, '449 → ' + (a.b && a.b.infSource ? 'formed' : 'refused, still ' + (a.b ? a.b.amount : '?')) + ' · 450 → ' + (b.b && b.b.infSource ? 'Infinity source' : 'refused'));
			const S3 = sim(); const c = mkSrc(S3, 600, 19);
			const S4 = sim(); const d = mkSrc(S4, 600, 20);
			const S5 = sim(); const f = mkSrc(S5, 600, 50);
			ok('Infinity fails below compression 20; succeeds at 20 and at 50', c.b && !c.b.infSource && d.b && d.b.infSource && f.b && f.b.infSource, 'c19 ' + !!(c.b && c.b.infSource) + ' · c20 ' + !!(d.b && d.b.infSource) + ' · c50 ' + !!(f.b && f.b.infSource));
			const rep = ME.validate(chain('lo', [ ['generate', { amount: 200 }], ['compress', { power: 20 }], tech('infinity') ]), profInf);
			ok('Infinity is a technique, but not a normal one: it keeps the energy\'s own kind', !!ME.Techniques.get('infinity') && ME.Techniques.get('infinity').layer && d.b && !ME.techOf(d.b, 'infinity') && rep.warnings.some(w => w.code === 'INF_ENERGY') && ME.stateOf(d.b).indexOf('infinity source') >= 0, ME.stateOf(d.b).join('+') + ' · analyzer: ' + rep.warnings.map(w => w.code).join(','));
		}
		// ---- energy preservation: what is drawn out is the source's own kind
		for(const [nm, techs, id] of [ ['Raw', [], null], ['Thermal', [ tech('thermal') ], 'thermal'], ['Spatial', [ tech('spatial') ], 'spatial'], ['Gravity', [ tech('gravity') ], 'gravity'], ['Kinetic', [ tech('kinetic') ], 'kinetic'], ['Light', [ tech('light') ], 'light'] ]){
			const S = sim(); const r = mkSrc(S, 600, 40, techs);
			const v = r.b && r.b.infSource ? drawFrom(S, r.b, 80, 1) : null;
			const kind = v ? (ME.dominantTech(v) ? ME.dominantTech(v).id : null) : 'none';
			ok(nm + ' → Infinity → Draw Out returns ' + nm + ' energy', !!(r.b && r.b.infSource) && v && kind === id && v.amount > 60, (r.b && r.b.infSource ? 'source ' + (ME.techList(r.b) || 'raw') : 'no source: ' + (r.res.error || '')) + ' → drawn ' + (v ? r1(v.amount) + ' E ' + (ME.techList(v) || 'raw') : 'nothing'));
		}
		// ---- stability (compression) and extraction
		{
			const caps = [20, 30, 40, 50].map(c => ME.INF.cap(c, profInf));
			ok('Higher compression makes extraction more stable (safe draw rate)', caps[0] < caps[1] && caps[1] < caps[2] && caps[2] < caps[3] && caps[3] > caps[0] * 5, caps.map((c, i) => 'c' + (20 + i * 10) + ' ' + r1(c) + ' E/s').join(' · '));
			const S1 = sim(); const lo = mkSrc(S1, 600, 20).b; const v1 = drawFrom(S1, lo, 400, 1.5);
			const S2 = sim(); const hi = mkSrc(S2, 600, 50).b; const v2 = drawFrom(S2, hi, 400, 1.5);
			ok('Compression 20 is highly unstable; compression 50 holds the same pull easily', (!lo.alive || lo.infStress > 0.6) && hi.alive && hi.infSource && (hi.infStress || 0) < 0.2, 'c20: ' + (lo.alive ? 'stress ' + (lo.infStress || 0).toFixed(2) : 'backlashed') + ' · c50: stress ' + (hi.infStress || 0).toFixed(2));
			const S3 = sim(); const sf = mkSrc(S3, 600, 40).b; const a0 = sf.amount;
			const va = drawFrom(S3, sf, 300, 1.2); const vb = drawFrom(S3, sf, 300, 1.2); const vc = drawFrom(S3, sf, 300, 1.2);
			const got = [va, vb, vc].reduce((s, q) => s + (q ? q.amount : 0), 0);
			ok('Safe, repeated extraction: the source stays, never runs dry, and is not destroyed', sf.alive && sf.infSource && Math.abs(sf.amount - a0) < 1 && got > a0 && (sf.infStress || 0) < 0.3, 'drew ' + r1(got) + ' E in 3 pulls · source still ' + r1(sf.amount) + ' E · stress ' + (sf.infStress || 0).toFixed(2));
			const S4 = sim(); const big = mkSrc(S4, 600, 30).b;
			const en = dummy(); en.x = 330; en.y = 280; S4.enemies.push(en);
			const vx = drawFrom(S4, big, 5000, 0.5);
			ok('Extracting far beyond your control triggers a backlash (an explosion that destroys the source)', !big.alive && big.deathWhy === 'backlash' && en.hp < en.maxHp && vx && ME.memCount(vx, 'infinityExploded') > 0, 'source ' + (big.alive ? 'survived' : big.deathWhy) + ' · enemy −' + r1(en.maxHp - en.hp) + ' hp');
			const S5 = sim(); const src = mkSrc(S5, 600, 40).b;
			near(S5, src); S5.cast([ tgtSrc, ['drawOut', { duration: 1, infAmount: 100, flow: 'one' }], ['redirect', { toward: 'right' }] ]);
			let v0 = null; S5.step(2); v0 = S5.W.bodies.find(q => q.infFrom === src.id);
			const d0 = v0 ? Math.hypot(v0.x - src.x, v0.y - src.y) : 0;
			S5.step(70); const x1 = v0 ? v0.x : 0; S5.step(20);
			ok('Draw Out pulls the energy physically out of the source, and it carries on through the next runes', v0 && d0 < ME.bodyRadius(src) + 20 && v0.x > x1 && ME.memCount(v0, 'infinityExtracted') > 0 && ME.memCount(src, 'infinityExtracted') > 0, 'formed ' + r1(d0) + ' px from the source centre · then moving ' + (v0 ? (v0.x - x1 > 0 ? 'right' : 'not') : '-'));
		}
		// ---- Draw Out from Infinity is a constant flow over the duration; each piece goes on through the rest of the branch
		{
			const S = sim(); const src = mkSrc(S, 600, 40, [ tech('thermal', 4) ]).b;
			near(S, src); S.cast([ tgtSrc, ['drawOut', { duration: 1, infAmount: 280 }], ['redirect', { toward: 'right' }] ]);
			const out = () => S.W.bodies.filter(q => q.alive && q.infFrom === src.id);
			S.step(30); const half = out().length;
			S.step(40); const all = S.W.bodies.filter(q => q.infFrom === src.id), tot = all.reduce((s, q) => s + q.amount, 0);
			const moving = out().filter(q => q.vx > 2).length, kinds = all.every(q => ME.techOf(q, 'thermal') > 0);
			ok('Draw Out from Infinity flows: small pieces leave over the whole duration and each is redirected as it comes out', half >= 4 && half < all.length && all.length >= 10 && moving >= all.length - 2 && kinds && Math.abs(tot - 280) < 30 && src.alive,
				half + ' pieces after 0.5 s · ' + all.length + ' after 1 s (' + r1(tot) + ' E of 280, all Thermal) · ' + moving + ' flying right · source ' + (src.alive ? 'intact' : 'gone'));
		}
		// ---- Target → all Infinity sources → Draw Out: every source is drawn from at once, sharing the amount
		{
			const S = sim();
			const srcs = [ mkSrc(S, 700, 40, [ tech('thermal', 4) ], 300, 200).b, mkSrc(S, 700, 40, [ tech('light', 4) ], 500, 200).b, mkSrc(S, 700, 40, [ tech('gravity', 4) ], 700, 200).b ].filter(Boolean);
			S.cast([ ['target', { kind: 'energy', select: 'all', techFilter: 'infinity' }], ['drawOut', { from: 'held', duration: 2, infAmount: 3000, flow: 'flow' }], ['redirect', { toward: 'mouse' }] ]);
			S.step(150);
			const got = srcs.map(s => S.W.bodies.filter(q => q.infFrom === s.id).reduce((a, q) => a + (q.peakAmt || q.amount), 0));
			ok('Target all Infinity sources → Draw Out draws from every one at once, each giving an equal share', srcs.length === 3 && srcs.every(s => s.alive && s.infSource) && got.every(g => g > 800 && g < 1250),
				srcs.length + ' sources · drawn ' + got.map(g => Math.round(g)).join(' / ') + ' E (3000 shared) · sources ' + srcs.map(s => s.alive ? 'intact' : s.deathWhy).join(', '));
		}
		// ---- Spatial + Infinity: no portal when Infinity follows at once; drawn Spatial energy is harmless until 500 E,
		//      then opens a one-way portal home to the master (the source); the master sends you out of a random portal home
		{
			const S = sim();
			const r0 = S.cast([ ['generate', { amount: 800 }], ['compress', { power: 30 }], tech('spatial', 5), tech('infinity', 5), anchored ]);
			S.step(3);
			const src = S.live().find(q => q.infSource);
			const noPortal = r0.ok && src && !src.spatial && !S.live().some(q => q.spatial);
			if(src){ src.x = 300; src.y = 300; }
			const en = { x: 520, y: 280, w: 30, h: 40, hp: 5000, maxHp: 5000 }; S.enemies.push(en);
			// two portals home, drawn out and sent off to two spots
			const kids = [];
			for(const [kx, ky] of [ [ 900, 300 ], [ 900, 700 ] ]){
				near(S, src);
				const before = new Set(S.W.bodies);
				S.cast([ tgtSrc, ['drawOut', { duration: 0.6, infAmount: 620, flow: 'one' }], ['redirect', { toward: 'right', speedPct: 60 }] ]);
				S.step(45);
				const v = S.W.bodies.find(q => q.alive && !before.has(q) && q.infFrom === src.id);
				if(v){ kids.push(v); v.x = kx; v.y = ky; v.vx = 0; v.vy = 0; }
			}
			S.step(3);
			const harmless = en.hp === 5000;
			const portals = kids.filter(k => k.spatial && k.spatial.masters && k.spatial.masters[0] === src.id);
			// walk into a portal home → arrive at the master
			const me = S.c; me.x = kids[0].x - 10; me.y = kids[0].y - 20; S.step(2);
			const home = Math.hypot(me.x + 10 - src.x, me.y + 20 - src.y) < 60;
			// walk into the master → leave through a random portal home
			const hits = new Set();
			for(let i = 0; i < 14 && hits.size < 2; i++){ me.x = src.x - 10; me.y = src.y - 20; src._mcool = null; me._portalHist = null; S.step(1); for(const k of kids) if(Math.hypot(me.x + 10 - k.x, me.y + 20 - k.y) < 60) hits.add(k.id); me.x = 100; me.y = 100; S.step(25); for(const k of kids) if(k.spatial) k.spatial.cool.clear(); }
			ok('Spatial → Infinity (instant) makes a source, not a portal; drawn Spatial energy is harmless until 500 E, then opens a portal home to the master; the master sends you out of a random one',
				noPortal && harmless && portals.length === 2 && home && hits.size === 2,
				(noPortal ? 'no portal' : 'PORTAL formed') + ' · drawn energy ' + (harmless ? 'did no damage' : 'hurt the enemy') + ' · ' + portals.length + ' portals home (' + kids.map(k => Math.round(k.amount)).join(' / ') + ' E) · portal → master ' + (home ? 'yes' : 'no') + ' · master → ' + hits.size + ' different portals');
			// only Anti-Magic can harm it
			const s0 = src.infStress || 0;
			const big = put(S, 2000, [ ['compress', { power: 8 }] ], src.x, src.y); S.step(30);
			const afterBig = src.infStress || 0, aliveAfterBig = src.alive && !!src.infSource;
			const am = put(S, 300, [ tech('antimagic', 8) ], src.x, src.y); S.step(30);
			ok('A Spatial Infinity source can only be harmed by Anti-Magic', aliveAfterBig && afterBig <= s0 + 0.001 && ((src.infStress || 0) > afterBig || !src.alive || src._amSpent > 0),
				'stress ' + s0.toFixed(2) + ' → ' + afterBig.toFixed(2) + ' after a huge spell → ' + (src.infStress || 0).toFixed(2) + ' after Anti-Magic');
		}
		// ---- tethers never take an Infinity source; one zone at a time; a technique zone gives its energy's kind
		{
			const S = sim(); const src = mkSrc(S, 600, 40, [ tech('thermal', 4) ], 300, 300).b;
			const e = put(S, 40, [], 340, 300);
			near(S, e);
			S.cast([ tgtMine, ['anchor', { state: 'bound', bindTo: 'energy' }] ]); S.step(2);
			const tied = (e.bond && e.bond.t && e.bond.t.ref === src) || (src.bond && src.bond.t);
			const S2 = sim();
			S2.cast([ ['zone', { radius: 200 }], tech('thermal', 5) ]); S2.step(2);
			const z1 = S2.W.bodies.find(q => q.isZone);
			S2.cast([ ['zone', { radius: 200 }], ['target', { kind: 'environment' }], ['drawOut', { duration: 1 }] ]); S2.step(80);
			const zones = S2.W.bodies.filter(q => q.alive && q.isZone);
			const S3 = sim();
			S3.cast([ ['zone', { radius: 300 }], ['target', { kind: 'environment' }], ['drawOut', { duration: 1 }] ]); S3.step(70);
			S3.cast([ ['target', { kind: 'zone', select: 'nearCaster' }], tech('thermal', 5) ]); S3.step(2);
			S3.cast([ ['target', { kind: 'zone', select: 'nearCaster' }], ['drawOut', { duration: 1, flow: 'one' }], ['redirect', { toward: 'right' }] ]); S3.step(70);
			const got = S3.W.bodies.find(q => q.alive && q.drawnOut && !q.zoneBlob && q.vx > 1);
			ok('Tethers cannot take an Infinity source; opening a second zone closes the first; energy drawn from a Thermal zone is Thermal energy',
				!tied && z1 && !z1.alive && zones.length === 1 && got && ME.techOf(got, 'thermal') > 0,
				'source tethered: ' + (tied ? 'YES' : 'no') + ' · zones open: ' + zones.length + ' (first ' + (z1 && z1.alive ? 'still open' : 'closed') + ') · drawn from the zone: ' + (got ? (ME.techList(got) || 'raw') : 'nothing'));
		}
		// ---- massive compression and magical items hit much less hard than before
		{
			const st = ME.itemStats({ shape: 'sword', amount: 400, over: 30, scale: 0.07, tech: {} });
			const en1 = { x: 500, y: 280, w: 30, h: 40, hp: 99999, maxHp: 99999 }, en2 = { x: 500, y: 480, w: 30, h: 40, hp: 99999, maxHp: 99999 };
			const S = sim({ enemies: [ en1, en2 ] });
			const a = put(S, 200, [], 440, 300), b = put(S, 200, [ ['compress', { power: 50 }] ], 440, 500);
			a.anchored = b.anchored = false; a.vx = b.vx = 6; S.step(40);
			const d1 = 99999 - en1.hp, d2 = 99999 - en2.hp;
			ok('Massive compression and magical items deal far less damage (compression 50 ≤ 1.6× uncompressed; a 400 E item ≈ 5×, was ≈ 18×)', d2 > 0 && d2 <= d1 * 1.6 && st.damage < 6,
				'200 E hit: ' + Math.round(d1) + ' · compressed 50: ' + Math.round(d2) + ' · 400 E item damage ×' + st.damage.toFixed(1));
		}
		// ---- energy drawn into a zone, then Redirect "Toward target": it heads back to the zone's centre (what it was drawn from)
		{
			const S = sim();
			S.cast([ ['zone', { radius: 400 }], ['target', { kind: 'environment', select: 'inZone' }], ['drawOut', { duration: 3 }], ['redirect', { toward: 'target', arrive: 'stop' }] ]);
			const z = S.W.bodies.find(q => q.isZone);
			S.step(60);
			const moving = S.live().filter(q => !q.isZone && Math.hypot(q.vx, q.vy) > 0.5).length;
			S.step(260);
			const pieces = S.live().filter(q => !q.isZone && !q.zoneBlob);
			const near = pieces.filter(q => Math.hypot(q.x - z.x, q.y - z.y) < 40).length;
			ok('Energy drawn out of a zone goes on through the rest of the spell: Redirect "Toward target" sends it to the zone\'s centre', moving > 0 && pieces.length > 0 && near === pieces.length,
				moving + ' pieces moving after 1 s · ' + near + ' / ' + pieces.length + ' gathered at the centre after 5.3 s');
		}
		// ---- one Draw Out at a time: starting a second one interrupts the first, and the second does not start
		{
			const S = sim();
			const c1 = S.cast([ ['target', { kind: 'environment' }], ['drawOut', { duration: 6, flow: 'one' }] ]);
			S.step(30);
			const br1 = c1.instance.branches.find(b => b.state === 'hold');
			const r2 = S.cast([ ['target', { kind: 'environment' }], ['drawOut', { duration: 6, flow: 'one' }] ]);
			S.step(3);
			const second = r2.instance ? r2.instance.branches.some(b => b.state === 'hold') : false;
			const first = c1.instance.branches.some(b => b.state === 'hold');
			const kept = S.live().filter(q => q.drawnOut && q.inst === c1.instance.id).reduce((s, q) => s + q.amount, 0);
			ok('Only one Draw Out at a time: starting another interrupts the running one (it keeps what it drew) and the new one does not start', br1 && !first && !second && kept > 0,
				'first ' + (first ? 'still drawing' : 'stopped, kept ' + r1(kept) + ' E') + ' · second ' + (second ? 'DRAWING' : 'refused (' + ((r2.instance && r2.instance.branches.map(b => b.note).filter(Boolean)[0]) || r2.error || '') + ')'));
		}
		// ---- Target → Zone, "center of the zone": energy is sent to the zone's center (the zone is not moved)
		{
			const S = sim();
			S.cast([ ['zone', { radius: 200 }], ['generate', { amount: 5 }, { mode: 'condition', cond: { type: 'trigger', params: {}, timeout: 10 } }] ]);
			const z = S.W.bodies.find(q => q.isZone); const zx = z.x, zy = z.y;
			S.c.x = zx + 400; S.c.y = zy + 150;
			S.cast([ ['generate', { amount: 60 }], ['target', { kind: 'zone', select: 'nearCaster', range: 1600, zoneUse: 'center' }], ['redirect', { toward: 'target', arrive: 'stop' }] ]);
			S.step(150);
			const e = S.live().find(q => !q.isZone && !q.zoneBlob && q.amount > 20);
			const d = e ? Math.hypot(e.x - zx, e.y - zy) : 1e9;
			ok('Target → Zone "center of the zone" + Redirect toward target sends the energy to the zone\'s center', e && d < 20 && z.x === zx && z.y === zy,
				e ? 'energy ' + r1(d) + ' px from the center · zone ' + (z.x === zx && z.y === zy ? 'unmoved' : 'MOVED') : 'no energy');
		}
		// ---- a flow's pieces combine again once they slow to a stop ("wait until combined" then carries the one energy on)
		{
			const S = sim({ mouse: { x: 600, y: 200 } }); const src = mkSrc(S, 600, 40, [ tech('thermal', 4) ]).b;
			near(S, src);
			const sp = chain('flow', [ tgtSrc, ['drawOut', { duration: 1, infAmount: 280 }], ['redirect', { toward: 'mouse', arrive: 'stop' }], ['redirect', { toward: 'up' }] ]);
			const ids = Object.keys(sp.nodes), last = sp.nodes[ids[ids.length - 1]];
			last.link = { mode: 'condition', delay: 1, cond: { type: 'combined', params: {}, timeout: 10 } };
			S.W.cast(sp, { profile: profInf, owner: { id: 'p', entity: S.c }, host: S.host });
			S.step(30); const mid = S.W.bodies.filter(q => q.alive && q.infFrom === src.id).length;
			S.step(170); const end = S.W.bodies.filter(q => q.alive && q.infFrom === src.id);
			ok('Pieces of a Draw Out flow stream apart, then combine into one once they stop — and "wait until combined" carries it on', mid >= 4 && end.length === 1 && end[0].amount > 200 && end[0].vy < -1,
				mid + ' pieces while streaming · ' + end.length + ' after stopping' + (end[0] ? ' (' + r1(end[0].amount) + ' E, ' + (end[0].vy < -1 ? 'sent up' : 'not sent on') + ')' : ''));
		}
		// ---- a runtime error never freezes the world: the energy involved fizzles, the rest carries on, the error is reported
		{
			const W = ME.createWorld(), seen = [];
			const host = { getEnemies: () => [], isSolid: () => false, inBounds: () => true, onMagicError: (r) => seen.push(r) };
			const bad = W.emitEnergy({ key: 'e', owner: { id: 'p', entity: null }, host, x: 100, y: 100, vx: 1, vy: 0, amount: 50, tech: { thermal: 2 } });
			const good = W.emitEnergy({ key: 'e', owner: { id: 'p', entity: null }, host, x: 400, y: 100, vx: 1, vy: 0, amount: 50 });
			const d = ME.Techniques.get('thermal'), tick0 = d.tick;
			d.tick = function(T, b, s){ if(b === bad) throw new Error('test failure'); return tick0.apply(this, arguments); };
			let threw = false;
			try { for(let i = 0; i < 20; i++) W.update(1 / 60, host); } catch(e){ threw = true; }
			d.tick = tick0;
			ok('A runtime error in the magic never stops the game: that energy fizzles, the rest carries on, the error is reported', !threw && !bad.alive && bad.deathWhy === 'error' && good.alive && good.x > 410 && seen.length >= 1 && /test failure/.test(seen[0].msg),
				(threw ? 'update THREW · ' : 'update kept running · ') + 'broken energy ' + (bad.alive ? 'still alive' : bad.deathWhy) + ' · other energy ' + (good.alive ? 'moving' : 'gone') + ' · reported: ' + (seen[0] ? seen[0].msg : 'nothing'));
		}
		// ---- ZONE LAWS: a zone with a technique changes the rules inside it
		{
			const mkW = (enemies, projs) => {
				const W = ME.createWorld(), me = { x: 280, y: 280, w: 20, h: 40 }, frozen = new Map();
				projs = projs || [];
				const host = { mouseWorld: () => ({ x: 600, y: 300 }), getEnemies: () => enemies, isSolid: () => false, inBounds: () => true,
					getForeignProjectiles: () => projs, foreignAlive: (p) => projs.indexOf(p) >= 0, removeForeign: (p) => { const i = projs.indexOf(p); if(i >= 0) projs.splice(i, 1); },
					applyStatus: (e, type, mag) => { if(type === 'chill') frozen.set(e, Math.max(frozen.get(e) || 0, mag)); return false; },
					teleport: (e, x, y) => { e.x = x - (e.w || 0) / 2; e.y = y - (e.h || 0) / 2; e.tp = (e.tp || 0) + 1; return true; } };
				const o = { profile: profInf, owner: { id: 'p', entity: me }, host };
				return { W, me, host, frozen, projs, cast: (steps) => W.cast(chain('z', steps), o), live: () => W.bodies.filter(x => x.alive), step: (n) => { for(let i = 0; i < n; i++) W.update(1 / 60, host); } };
			};
			const zoneSteps = (id, pw, r) => [ ['zone', { radius: r || 260 }], ['technique', { technique: id, power: pw }] ];
			const foe = (x, y) => ({ x, y, w: 30, h: 40, hp: 5000, maxHp: 5000, vx: 0, vy: 0 });
			// Thermal: steady damage inside, none outside; heat hits harder inside
			{
				const ein = foe(300, 280), eout = foe(900, 280), S = mkW([ ein, eout ]);
				S.cast(zoneSteps('thermal', 6)); S.step(120);
				const zone = S.W.bodies.find(q => q.isZone);
				ok('Thermal zone: enemies inside take a steady trickle of damage (none outside), and the zone outlasts its finished spell', ein.hp < 5000 && eout.hp === 5000 && zone && zone.alive,
					'inside −' + Math.round(5000 - ein.hp) + ' hp in 2 s · outside −' + Math.round(5000 - eout.hp) + ' · zone ' + (zone && zone.alive ? 'still up' : 'gone'));
				const d = ME.Techniques.get('thermal'), Tw = S.W.T, info = { mult: 1 }, info2 = { mult: 1 };
				d.onHit(Tw, { amount: 30, scale: 1, tech: { thermal: 1 } }, 1, ein, info); d.onHit(Tw, { amount: 30, scale: 1, tech: { thermal: 1 } }, 1, eout, info2);
				ok('…and Thermal hits on enemies inside it are stronger', info.mult > info2.mult * 1.2, '×' + info.mult.toFixed(2) + ' inside vs ×' + info2.mult.toFixed(2) + ' outside');
			}
			// Reverse Thermal: slows inside; enough reverse Thermal hits inside freeze
			{
				const ein = foe(300, 280), S = mkW([ ein ]);
				S.cast(zoneSteps('thermal', -6)); S.step(30);
				const slowed = S.frozen.get(ein) || 0;
				const d = ME.Techniques.get('thermal'), Tw = S.W.T; let hits = 0;
				while((S.frozen.get(ein) || 0) < 1 && hits < 12){ d.onHit(Tw, { amount: 20, scale: 1, tech: { thermal: -1 } }, -0.6, ein, { mult: 1 }); hits++; }
				ok('Reverse Thermal zone: enemies inside are slowed, and repeated reverse Thermal hits inside freeze them', slowed > 0 && slowed < 1 && (S.frozen.get(ein) || 0) >= 1 && hits <= 6,
					'slow ' + slowed.toFixed(2) + ' · frozen after ' + hits + ' weak hits');
			}
			// Light: faster light energy and a big light; reverse: darkness that hides reverse light energy
			{
				const S = mkW([]); S.cast(zoneSteps('light', 6, 400));
				S.cast([ ['generate', { amount: 40 }], tech('light', 4), ['redirect', { toward: 'right' }] ]);
				S.step(10); const L = S.W.bodies.find(q => q.alive && ME.techOf(q, 'light') > 0 && !q.isZone);
				const sp = L ? Math.hypot(L.vx, L.vy) : 0, lit = S.W.lights.some(l => l.r > 300);
				const S2 = mkW([]); S2.cast(zoneSteps('light', -6, 400));
				S2.cast([ ['generate', { amount: 40 }], tech('light', -4) ]); S2.step(10);
				const D = S2.W.bodies.find(q => q.alive && ME.techOf(q, 'light') < 0 && !q.isZone);
				ok('Light zone: bright light over the area and Light energy inside travels faster; reverse: darkness in which reverse Light blends in', sp > 20 && lit && S2.W.darks.length === 1 && D && D._zf && D._zf.dark > 0.3,
					'light speed ' + sp.toFixed(1) + ' (normally 18) · big light ' + (lit ? 'yes' : 'no') + ' · darkness ' + S2.W.darks.length + ' · reverse light hidden ' + (D && D._zf ? (D._zf.dark * 100).toFixed(0) + '%' : 'no'));
			}
			// Gravity: heavier / lighter for you inside
			{
				const S = mkW([]); S.cast(zoneSteps('gravity', 6)); S.step(2);
				const S2 = mkW([]); S2.cast(zoneSteps('gravity', -6)); S2.step(2);
				const g1 = S.W.zoneMod(S.me, 'gravity'), g2 = S2.W.zoneMod(S2.me, 'gravity');
				ok('Gravity zone: you have higher gravity inside; reverse: low gravity', g1 > 1.3 && g2 < 0.8, 'gravity ×' + g1.toFixed(2) + ' · reverse ×' + g2.toFixed(2));
			}
			// Kinetic: everything inside speeds up over time; reverse slows
			{
				const ein = foe(320, 280), p = { x: 300, y: 250, vx: 2, vy: 0, dmg: 10 }, S = mkW([ ein ], [ p ]);
				S.cast(zoneSteps('kinetic', 6)); S.step(30); const early = S.W.zoneMod(S.me, 'speed'); S.step(150);
				const late = S.W.zoneMod(S.me, 'speed'), es = S.W.zoneMod(ein, 'speed');
				const S2 = mkW([]); S2.cast(zoneSteps('kinetic', -6)); S2.step(180);
				const slow = S2.W.zoneMod(S2.me, 'speed');
				ok('Kinetic zone: you, creatures and projectiles inside speed up the longer they stay; reverse slows them', late > early && late > 1.4 && es > 1.4 && p._zSpeed > 1.4 && slow < 0.75,
					'you ×' + early.toFixed(2) + ' → ×' + late.toFixed(2) + ' · enemy ×' + es.toFixed(2) + ' · projectile ×' + (p._zSpeed || 1).toFixed(2) + ' · reverse ×' + slow.toFixed(2));
			}
			// Anti-Magic: everything magic inside withers, weak magic vanishes, Anti-Magic cannot break the zone; reverse: no shrinking
			{
				const p = { x: 300, y: 250, vx: 0, vy: 0, dmg: 30 }, S = mkW([], [ p ]);
				S.cast(zoneSteps('antimagic', 6));
				const big = put(S, 200, [], 320, 300), small = put(S, 9, [], 340, 300), out = put(S, 200, [], 900, 300);
				const a0 = big.amount;
				const rival = put(S, 120, [ tech('antimagic', 8) ], 300, 290); if(rival) rival.ownerId = 'rival';
				S.step(120);
				const z = S.W.bodies.find(q => q.isZone);
				const S2 = mkW([]); S2.cast(zoneSteps('antimagic', -6)); const keep = put(S2, 60, [], 320, 300); const k0 = keep.amount; S2.step(180);
				ok('Anti-Magic zone: all magic inside withers fast and weak magic disappears; Anti-Magic cannot break the zone; reverse: your magic inside does not shrink',
					!small.alive && big.amount < out.amount * 0.6 && out.amount > a0 * 0.85 && (p.dmg < 30 || S.projs.indexOf(p) < 0) && z && z.alive && !(z.amSupp > 0) && Math.abs(keep.amount - k0) < 0.01,
					'200 E → ' + Math.round(big.alive ? big.amount : 0) + ' in 2 s (outside ' + Math.round(out.amount) + ') · 9 E ' + (small.alive ? 'survived' : 'vanished') + ' · projectile ' + (S.projs.indexOf(p) < 0 ? 'erased' : Math.round(p.dmg)) + ' · zone ' + (z && z.alive ? 'intact' : 'gone') + ' · reverse: ' + k0.toFixed(1) + ' → ' + keep.amount.toFixed(1) + ' E');
			}
			// Spatial: portals last longer inside; reverse: portals inside do not work
			{
				const S = mkW([]); S.cast(zoneSteps('spatial', 6, 400)); S.step(1);
				S.cast([ ['generate', { amount: 120 }], tech('spatial', 6) ]); S.step(2);
				const P = S.W.bodies.find(q => q.alive && q.spatial); const e0 = P ? P.spatial.end : 0; S.step(60);
				const ext = P ? (P.spatial.end - e0) : 0;
				const ein = foe(0, 0), S2 = mkW([ ein ]); S2.cast(zoneSteps('spatial', -6, 400)); S2.step(1);
				S2.cast([ ['generate', { amount: 120 }], tech('spatial', 6) ]); S2.step(2);
				const P2 = S2.W.bodies.find(q => q.alive && q.spatial);
				if(P2){ ein.x = P2.x - 15; ein.y = P2.y - 20; } S2.step(20);
				ok('Spatial zone: portals inside last much longer; reverse Spatial zone: portals inside do not work', ext > 0.5 && P2 && P2.spatial.blocked && !ein.tp,
					'portal gained ' + ext.toFixed(2) + ' s in 1 s · reverse: portal ' + (P2 && P2.spatial.blocked ? 'shut' : 'working') + ', creature ' + (ein.tp ? 'teleported' : 'stayed'));
			}
			// Infinity zones are not possible
			{
				const rep = ME.validate(chain('z', zoneSteps('infinity', 5)), profInf);
				ok('Infinity zones are not possible (clear error)', !rep.ok && rep.errors.some(e => e.code === 'TECH_ZONE' || /zone/i.test(e.text)), rep.errors.map(e => e.text).join(' · ').slice(0, 120));
			}
			// Target → Zone, then Technique / Draw Out on it
			{
				const S = mkW([]);
				S.cast([ ['zone', { radius: 300 }], ['target', { kind: 'environment' }], ['drawOut', { duration: 1 }] ]); S.step(80);
				const z = S.W.bodies.find(q => q.isZone), stored = S.W.bodies.filter(q => q.alive && q.zoneBlob).reduce((s, q) => s + q.amount, 0);
				const r = S.cast([ ['target', { kind: 'zone', select: 'nearCaster' }], ['technique', { technique: 'thermal', power: 5 }] ]); S.step(2);
				const r2 = S.cast([ ['target', { kind: 'zone', select: 'nearCaster' }], ['drawOut', { duration: 1, flow: 'one' }], ['redirect', { toward: 'right' }] ]); S.step(70);
				const left = S.W.bodies.filter(q => q.alive && q.zoneBlob).reduce((s, q) => s + q.amount, 0);
				const drawn = S.W.bodies.find(q => q.alive && q.drawnOut && !q.zoneBlob && q.vx > 1);
				ok('Target → Zone: a Technique gives an existing zone its law, and Draw Out pulls out what it holds', r.ok && r2.ok && z && ME.techOf(z, 'thermal') > 0 && left < stored - 3 && drawn,
					'zone ' + (z ? ME.techList(z) : 'none') + ' · stored ' + Math.round(stored) + ' → ' + Math.round(left) + ' E · drawn ' + (drawn ? Math.round(drawn.amount) + ' E flying' : 'none'));
			}
			// Target → active spell / raw energy "with technique"
			{
				const S = mkW([]);
				const rawB = put(S, 40, [], 300, 300), thB = put(S, 40, [ tech('thermal', 4) ], 600, 300), coldB = put(S, 40, [ tech('thermal', -4) ], 1000, 300);
				const pick = (p) => { let got = null; const r = S.cast([ ['target', Object.assign({ kind: 'energy', select: 'nearCaster', range: 1600 }, p)], ['redirect', { toward: 'up' }] ]); S.step(3); got = [ rawB, thB, coldB ].filter(q => q.vy < -1); [ rawB, thB, coldB ].forEach(q => { q.vx = 0; q.vy = 0; }); return got; };
				const a = pick({ techFilter: 'thermal', techSign: 'normal' }), b = pick({ techFilter: 'raw' }), c = pick({ techFilter: 'thermal', techSign: 'reverse' });
				ok('Target can pick only energy with a certain technique (normal / reverse) or raw energy only', a.length === 1 && a[0] === thB && b.length === 1 && b[0] === rawB && c.length === 1 && c[0] === coldB,
					'Thermal → ' + a.map(q => ME.techList(q) || 'raw').join(',') + ' · raw → ' + b.map(q => ME.techList(q) || 'raw').join(',') + ' · reverse Thermal → ' + c.map(q => ME.techList(q) || 'raw').join(','));
			}
		}
		// ---- a host-emitted slash: a shaped energy that passes through creatures and only stops when its centre meets a wall
		{
			const W = ME.createWorld(), a = { x: 200, y: 280, w: 30, h: 40 }, b2 = { x: 320, y: 280, w: 30, h: 40 }, hits = [];
			const host = { getEnemies: () => [ a, b2 ], isSolid: (x, y) => y > 330 || x > 700, inBounds: () => true, hitRect: (e) => e, damageEnemy: (e, d) => hits.push(e) };
			const s = W.emitEnergy({ key: 'slash', owner: { id: 'p', entity: null }, host, x: 100, y: 300, vx: 15, vy: 0, amount: 200, tech: { antimagic: 2 }, shape: 'blade', form: 1, radius: 45, life: 2, hitDamage: 10, pierce: true, speedBonus: 15, surfaceProbe: 0 });
			for(let i = 0; i < 60 && s.alive; i++) W.update(1 / 60, host);
			ok('A slash (shaped emitted energy) cuts through every creature in its path and grazes the floor without stopping', hits.indexOf(a) >= 0 && hits.indexOf(b2) >= 0 && s.deathWhy === 'surface' && s.x > 650,
				'hit ' + hits.length + ' creatures · ended by ' + (s.alive ? 'nothing' : s.deathWhy) + ' at x ' + r1(s.x));
		}
		// ---- Draw Out from the held energy: part of it is separated off; the main energy carries on
		{
			const S = sim();
			S.cast([ ['generate', { amount: 300 }], tech('thermal', 4), ['redirect', { toward: 'right', speedPct: 30 }], ['drawOut', { from: 'held', duration: 1, flow: 'one', infAmount: 80 }], ['redirect', { toward: 'up' }] ]);
			S.step(90);
			const L = S.live(), main = L.find(q => !q.drawnFrom), part = L.find(q => q.drawnFrom);
			ok('Draw Out from the held energy separates part of it (same kind); the main energy keeps going', main && part && part.drawnFrom === main.id && main.vx > 1 && part.vy < -1 && ME.techOf(part, 'thermal') > 0 && part.amount > 5 && main.amount > part.amount,
				(main ? 'main ' + r1(main.amount) + ' E moving right · ' : 'no main · ') + (part ? 'drawn ' + r1(part.amount) + ' E ' + ME.techList(part) + ' moving up' : 'nothing drawn'));
			// …also from a moving Infinity source this spell made: the source keeps travelling, the flow leaves it
			const S2 = sim();
			const r = S2.cast([ ['generate', { amount: 800 }], ['compress', { power: 30 }], tech('kinetic', 4), tech('infinity', 5), ['redirect', { toward: 'right', speedPct: 40 }], ['drawOut', { from: 'held', duration: 1, infAmount: 200 }], ['redirect', { toward: 'down' }] ]);
			S2.step(80);
			const s2 = S2.live().find(q => q.infSource), fl = S2.W.bodies.filter(q => s2 && q.infFrom === s2.id);
			ok('…and from a moving Infinity source of the same spell: it keeps moving while the flow separates from it', r.ok && s2 && s2.vx > 1 && fl.length >= 8 && fl.filter(q => q.alive && q.vy > 1).length >= fl.filter(q => q.alive).length - 2,
				(s2 ? 'source moving ' + s2.vx.toFixed(1) + ' px/f · ' : 'no source · ') + fl.length + ' pieces, ' + fl.filter(q => q.alive && q.vy > 1).length + ' flying down');
		}
		// ---- Anti-Magic disrupts the flow — violently, and not silently
		{
			const S1 = sim(); const s20 = mkSrc(S1, 600, 20).b; const a1 = put(S1, 30, [ tech('antimagic') ], 300, 300); until(S1, () => !a1.alive, 60);
			const S2 = sim(); const s50 = mkSrc(S2, 600, 50).b; const a2 = put(S2, 30, [ tech('antimagic') ], 300, 300); until(S2, () => !a2.alive, 60);
			ok('Anti-Magic disrupts Infinity (a stronger source is harder to destabilise)', s20.infSource && (s20.infStress || 0) > (s50.infStress || 0) && (s50.infStress || 0) > 0 && ME.memCount(s50, 'infinityDisrupted') > 0, 'same Anti-Magic: c20 stress ' + (s20.infStress || 0).toFixed(2) + ' vs c50 ' + (s50.infStress || 0).toFixed(2));
			const en = dummy(); en.x = 390; en.y = 280;
			const S3 = sim({ enemies: [en] }); const sx = mkSrc(S3, 600, 30).b; put(S3, 300, [ tech('antimagic', 8) ], 300, 300);
			until(S3, () => !sx.alive, 300);
			ok('Strong Anti-Magic makes Infinity explode — it is never silently deleted', !sx.alive && sx.deathWhy === 'backlash' && en.hp < en.maxHp && ME.memCount(sx, 'infinityExploded') > 0, 'source ' + (sx.alive ? 'still there' : 'exploded') + ' · enemy −' + r1(en.maxHp - en.hp));
		}
		// ---- powerful spells: disruption scales with power against compression
		{
			const S = sim(); const s20 = mkSrc(S, 600, 20).b;
			const weak = put(S, 40, [], 300, 300); S.step(10);
			const afterWeak = s20.infStress || 0;
			const S2 = sim(); const s50 = mkSrc(S2, 600, 50).b;
			const S3 = sim(); const s20b = mkSrc(S3, 600, 20).b;
			const hit = (SS, s) => { const o = put(SS, 450, [], 300, 300); o.scale = 0.06; SS.step(2); return Math.abs(ME.bodyPower(o)); };
			const P1 = hit(S2, s50), P2 = hit(S3, s20b);
			ok('Weak spells barely touch Infinity; ~2000+ power disrupts it; compression resists', afterWeak < 0.02 && ME.INF.disruption(2000, 20) > 0.3 && ME.INF.disruption(2000, 50) < ME.INF.disruption(2000, 20) && (s20b.infStress > (s50.infStress || 0) || !s20b.alive), 'weak spell: ' + afterWeak.toFixed(3) + ' · a ' + r1(P1) + '-power spell: c50 stress ' + (s50.infStress || 0).toFixed(2) + ', c20 ' + (s20b.alive ? (s20b.infStress || 0).toFixed(2) : 'backlashed'));
		}
		// ---- Spatial Infinity reinforcement: the distance effect comes only from Spatial energy drawn from Infinity
		{
			const runDef = (techs) => {
				const en = dummy(); en.x = 300; en.y = 100;
				const S = sim({ enemies: [en] });
				const src = mkSrc(S, 700, 40, techs, 600, 400).b;
				near(S, src); S.cast([ tgtSrc, ['drawOut', { duration: 1, infAmount: 260, flow: 'one' }], ['reinforce', {}], ['target', { kind: 'self' }] ]);
				S.c.x = 100; S.c.y = 100;
				S.step(70);
				for(let i = 0; i < 90; i++){ en.x -= 3; S.step(1); }
				return { gap: en.x - S.c.x, st: S.W.reinf.find(q => q.kind === 'self'), fields: S.W.infinityFields().length, src };
			};
			const plain = runDef([]), spat = runDef([ tech('spatial') ]);
			ok('Infinity energy alone gives no distance effect — Spatial Infinity drawn out and reinforced into you does', plain.st && !(plain.st.inf > 0) && plain.fields === 0 && spat.st && spat.st.inf > 0 && spat.gap > plain.gap + 30, 'raw Infinity layer: ' + (plain.st ? plain.st.inf || 0 : '-') + ' (enemy gap ' + r1(plain.gap) + ') · spatial: layer ' + (spat.st ? (spat.st.inf || 0).toFixed(1) : '-') + ' (enemy gap ' + r1(spat.gap) + ')');
		}
		// ---- memory
		{
			const S = sim(); const s = mkSrc(S, 600, 25).b; const v = drawFrom(S, s, 900, 0.6);
			const evs = ['infinityCreated', 'infinityExtracted', 'infinityDestabilized', 'infinityExploded', 'infinityCollapsed'];
			ok('Spell Memory records Infinity: created, extracted, destabilised, exploded, collapsed', evs.every(k => ME.memCount(s, k) > 0) && v && ME.memCount(v, 'infinityExtracted') > 0, evs.map(k => k.replace('infinity', '') + ':' + ME.memCount(s, k)).join(' '));
		}
		// ---- the emergent rupture: Infinity Gravity (or Spatial) against its own reverse
		{
			const pair = (aTech, bTech, infinity) => {
				const en = dummy(); en.x = 590; en.y = 280;
				const S = sim({ enemies: [en] });
				let A, B;
				if(infinity){ A = mkSrc(S, 600, 30, [ aTech ], 520, 300).b; B = mkSrc(S, 600, 30, [ bTech ], 680, 300).b; }
				else { A = put(S, 300, [ aTech ], 520, 300); B = put(S, 300, [ bTech ], 680, 300); }
				if(!A || !B) return { none: true };
				A.anchored = false; B.anchored = false; A.vx = 6; B.vx = -6; A.guided = B.guided = true;
				let rup = null; for(let i = 0; i < 120 && !rup; i++){ S.step(1); rup = S.W.bodies.find(q => q.alive && q.rupture); }
				S.step(30);
				return { rup, hp: en.maxHp - en.hp };
			};
			const g = pair(tech('gravity', 6), tech('gravity', -6), true), sp = pair(tech('spatial', 6), tech('spatial', -6), true), plain = pair(tech('gravity', 6), tech('gravity', -6), false);
			ok('Infinity Gravity / Spatial meeting its own reverse tears space (plain opposing energy does not)', g.rup && sp.rup && !plain.rup && g.hp > 50, 'gravity ±: ' + (g.rup ? 'rupture ' + r1(g.rup.amount) + ' E' : 'none') + ' · spatial ±: ' + (sp.rup ? 'rupture' : 'none') + ' · without Infinity: ' + (plain.rup ? 'rupture' : 'none'));
			// drawn-out Infinity energy works too (two sources, energy pulled from each, smashed together)
			const S = sim(); const sa = mkSrc(S, 600, 40, [ tech('gravity', 6) ], 200, 300).b, sb = mkSrc(S, 600, 40, [ tech('gravity', -6) ], 800, 300).b;
			const va = drawFrom(S, sa, 200, 0.8), vb = drawFrom(S, sb, 200, 0.8);
			if(va && vb){ va.x = 480; vb.x = 520; va.y = vb.y = 300; va.anchored = vb.anchored = false; }
			let rup2 = null; for(let i = 0; i < 30 && !rup2; i++){ S.step(1); rup2 = S.W.bodies.find(q => q.alive && q.rupture); }
			ok('Energy drawn from opposing Infinity Gravity sources also tears space when it meets', !!rup2, rup2 ? 'rupture ' + r1(rup2.amount) + ' E' : 'none (' + (va ? ME.techList(va) : '-') + ' / ' + (vb ? ME.techList(vb) : '-') + ')');
		}
		// ---------- IG · Infinity Gravity drawn out, discharged gravity, the Colour rune, a domain's Overwhelm
		{
			// IG1 the Colour rune tints energy, and what is divided from it or drawn out of a coloured Infinity source keeps the colour
			const S = sim(); S.cast([ ['generate', { amount: 60 }], ['color', { color: 'crimson' }], ['divide', { count: 3, formation: 'arc', spacing: 20, motion: 'keep' }] ]);
			const parts = S.live(); const pal = ME.COLOR_PRESETS.find(c => c.value === 'crimson').pal;
			const S2 = sim(); const src = mkSrc(S2, 600, 40, [ tech('gravity', 6) ], 300, 300).b; if(src) src.tint = Object.assign({}, pal);
			const v = src ? drawFrom(S2, src, 120, 0.6) : null;
			ok('IG1 The Colour rune tints energy; divided pieces and energy drawn from a coloured Infinity source keep it', parts.length === 3 && parts.every(q => q.tint && q.tint.mid === pal.mid) && ME.bodyColors(parts[0]).mid === pal.mid && v && v.tint && v.tint.mid === pal.mid,
				parts.length + ' pieces, ' + parts.filter(q => q.tint).length + ' tinted · drawn ' + (v ? (v.tint ? 'tinted' : 'plain') : 'nothing'));
		}
		{
			// IG2 Gravity drawn from Infinity drags a creature far harder than ordinary gravity, and crushes it at its core
			const drag = (fromInf) => {
				const en = dummy(); en.x = 430; en.y = 275;
				const S = sim({ enemies: [ en ] }); S.host.nudge = (e, dx, dy) => { e.x += dx; e.y += dy; };
				let g;
				if(fromInf){ const s0 = mkSrc(S, 600, 40, [ tech('gravity', 6) ], 1400, 300).b; g = s0 ? drawFrom(S, s0, 200, 0.6) : null; }
				else g = put(S, 200, [ tech('gravity', 6) ], 300, 300);
				if(!g) return { moved: 0, hp: 0 };
				g.x = 300; g.y = 300; g.anchored = true; g.vx = g.vy = 0; en.x = 430; en.y = 275;
				S.step(90);
				return { moved: 430 - en.x, hp: en.maxHp - en.hp };
			};
			const plain = drag(false), inf = drag(true);
			ok('IG2 Gravity drawn from Infinity drags a creature far harder (and crushes it at its core); ordinary gravity only slows it', inf.moved > plain.moved * 2 && inf.hp > 0 && plain.hp === 0, 'ordinary: dragged ' + r1(plain.moved) + ' px · Infinity: dragged ' + r1(inf.moved) + ' px, crushed for ' + r1(inf.hp));
		}
		{
			// IG3 discharged Reverse Gravity throws what is in the burst away — drawn from Infinity, as a hard throw
			const blast = (fromInf) => {
				const en = dummy(); en.x = 330; en.y = 275;
				const S = sim({ enemies: [ en ] }); S.host.knockback = (e, vx, vy, fr) => { e.kbv = Math.max(e.kbv || 0, Math.abs(vx)); e.kbf = fr; };
				let g;
				if(fromInf){ const s0 = mkSrc(S, 600, 40, [ tech('gravity', -6) ], 1400, 300).b; g = s0 ? drawFrom(S, s0, 200, 0.6) : null; }
				else g = put(S, 200, [ tech('gravity', -6) ], 300, 300);
				if(!g) return {};
				g.x = 300; g.y = 300; g.anchored = false;
				S.cast([ ['target', { kind: 'energy', select: 'nearMouse', range: 1600 }], ['discharge', { radius: 1.6 }] ]);
				S.step(2);
				return { v: en.kbv || 0, f: en.kbf || 0 };
			};
			const plain = blast(false), inf = blast(true);
			ok('IG3 Discharged Reverse Gravity throws creatures away; drawn from Infinity it is a hard throw', plain.v > 2 && inf.v > plain.v * 1.6 && inf.f >= 22, 'ordinary: ' + r1(plain.v || 0) + ' px/frame · Infinity: ' + r1(inf.v || 0) + ' px/frame (' + (inf.f || 0) + ' frames)');
		}
		{
			// IG4 a domain that opens with Overwhelm: a foe inside cannot act for a moment
			const en = dummy(); en.x = 160; en.y = 90;
			const S = sim({ enemies: [ en ] });
			const steps = [ ['zone', { radius: 300, spawn: 'caster' }], ['target', { kind: 'environment' }], ['drawOut', { duration: 0.6, from: 'target', infAmount: 300 }] ];
			const res = S.cast(steps);
			S.step(50);
			const z = S.W.bodies.find(q => q.alive && q.isZone);
			const res2 = z ? S.cast([ ['target', { kind: 'zone', select: 'nearCaster', range: 1600 }], ['domain', { form: 'closed', duration: 4, sureHit: 'yes', opening: 'overwhelm' }] ]) : null;
			S.step(2);
			const st = S.W.status.get(en);
			ok('IG4 A domain that opens with Overwhelm stuns a foe inside for a moment', !!(st && st.stunned) && en.stunTimer > 30, (res2 && res2.ok ? 'domain open' : 'domain failed: ' + (res2 ? res2.error : 'no zone')) + ' · stunned ' + (st && st.stunned ? st.stunned.t.toFixed(1) + ' s' : 'no') + ' · stunTimer ' + (en.stunTimer || 0));
		}
		{
			// IG5 a spatial rupture (Hollow Purple) is fast once sent, nothing bends it, and it swallows other magic (growing)
			const mk = () => {
				const S = sim({ mouse: { x: 1600, y: 300 } });
				const A = mkSrc(S, 600, 30, [ tech('gravity', 6) ], 520, 300).b, B = mkSrc(S, 600, 30, [ tech('gravity', -6) ], 680, 300).b;
				if(!A || !B) return { S };
				A.anchored = B.anchored = false; A.vx = 6; B.vx = -6;
				let rup = null; for(let i = 0; i < 120 && !rup; i++){ S.step(1); rup = S.W.bodies.find(q => q.alive && q.rupture); }
				return { S, rup };
			};
			const R1 = mk();
			let sp = 0, bent = 1, grew = false, ward = null;
			if(R1.rup){
				const S = R1.S, rp = R1.rup;
				const rr = S.cast([ ['target', { kind: 'spell', select: 'nearMouse', range: 1600 }], ['redirect', { toward: 'mouse' }] ]);
				S.step(2); sp = Math.hypot(rp.vx, rp.vy);
				// a strong gravity well beside its path and a block of raw energy in its way
				const well = put(S, 400, [ tech('gravity', 8) ], rp.x + 200, rp.y - 120);
				ward = put(S, 200, [], rp.x + 260, rp.y);
				const a0 = rp.amount, vy0 = rp.vy;
				S.step(25);
				bent = Math.abs(rp.vy - vy0); grew = !ward.alive && rp.alive && rp.amount > a0 - 40;
			}
			ok('IG5 Hollow Purple (a spatial rupture) is fast once sent, cannot be bent off course, and swallows other magic', sp >= 18 && bent < 0.01 && grew,
				'speed ' + r1(sp) + ' px/frame · bent by a gravity well ' + bent.toFixed(3) + ' · raw energy in its way ' + (ward ? (ward.alive ? 'survived' : 'swallowed') : '-'));
			// IG6 only Anti-Magic can undo it: enough Anti-Magic in its path consumes it
			const R2 = mk();
			let undone = false, left = 0;
			if(R2.rup){
				const S = R2.S, rp = R2.rup;
				S.cast([ ['target', { kind: 'spell', select: 'nearMouse', range: 1600 }], ['redirect', { toward: 'mouse' }] ]);
				S.step(1);
				for(let k = 0; k < 4; k++) put(S, 400, [ tech('antimagic', 8) ], rp.x + 120 + k * 60, rp.y);
				for(let i = 0; i < 60 && rp.alive; i++) S.step(1);
				undone = !rp.alive && rp.deathWhy === 'antimagic'; left = rp.alive ? rp.amount : 0;
			}
			ok('IG6 Only Anti-Magic can undo Hollow Purple — enough of it in its path consumes it', undone, R2.rup ? (undone ? 'consumed by Anti-Magic' : 'still ' + r1(left) + ' E') : 'no rupture');
		}
		{
			// IG7 a domain fuelled with your own energy needs no Draw Out
			const en = dummy(); en.x = 160; en.y = 90;
			const S = sim({ enemies: [ en ] });
			const res = S.cast([ ['zone', { radius: 300, spawn: 'caster' }], ['domain', { form: 'closed', duration: 4, sureHit: 'yes', fuel: 'self', selfFuel: 400, opening: 'overwhelm' }] ]);
			S.step(2);
			const D = S.W.domains.find(d => d.alive);
			ok('IG7 A domain fuelled with your own energy opens at once (no Draw Out)', res.ok && !!D && D.fuel0 >= 300 && !!(S.W.status.get(en) || {}).stunned, (res.ok ? 'cast' : 'failed: ' + res.error) + ' · domain ' + (D ? 'open with ' + r1(D.fuel0) + ' E' : 'not open'));
		}
		{
			// SH1 a shape you drew: the Compress rune takes it, the energy holds it, and it validates like a built-in shape
			const poly = [ [ 2.0, 0 ], [ 0.4, 0.9 ], [ -1.2, 0.5 ], [ -1.6, 0 ], [ -1.2, -0.5 ], [ 0.4, -0.9 ] ];
			const S = sim();
			const res = S.cast([ ['generate', { amount: 60 }], ['compress', { power: 8, shape: 'custom', poly }] ]);
			S.step(20);
			const b = S.live()[0], key = ME.customShapeKey(poly);
			const bad = ME.validate((() => { const d = ME.blankSpell('x'); const n = ME.makeNode('compress', d.rootId, 's', 0, 1, 1); d.nodes[n.id] = n; d.nodes[d.rootId].type = 'generate'; d.nodes[d.rootId].params = ME.paramDefaults('generate'); n.params = Object.assign(ME.paramDefaults('compress'), { shape: 'custom', poly: null }); d.seq = 2; return d; })(), testProfile({ magicPower: 60, magicControl: 10 }));
			ok('SH1 A shape you draw becomes a real shape: Compress takes it (an undrawn one is flagged)', res.ok && b && b.shape === key && !!ME.SHAPES[key] && ME.SHAPES[key].pts.length === 128 && !bad.ok,
				(res.ok ? 'cast' : 'failed: ' + res.error) + ' · energy shape ' + (b ? b.shape : '-') + ' · undrawn: ' + (bad.ok ? 'not flagged' : bad.errors[0].text));
		}
		// ---- spatial energy can be moved now (a portal's exit travels with it)
		{
			const S = sim({ mouse: { x: 600, y: 120 } }); const p = put(S, 120, [ tech('spatial', 6) ], 300, 300);
			S.step(1); const P = S.live().find(q => q.spatial); S.step(1);
			const x0 = P ? P.x : 0, ex0 = P && P.spatial ? P.spatial.x1 - P.x : 0;
			S.cast([ ['target', { kind: 'spell', select: 'thisSpell' }] ], 'noop');
			if(P){ P.anchored = false; P.vx = 4; P.vy = 0; }
			S.step(30);
			ok('Spatial energy can be moved — a portal\'s exit moves with it', P && P.immovable !== true && P.x > x0 + 50 && Math.abs((P.spatial.x1 - P.x) - ex0) < 1, P ? 'moved ' + r1(P.x - x0) + ' px, exit offset kept' : 'no portal');
		}
		// ---- kinetic energy bounces off surfaces
		{
			const W = ME.createWorld(), c = { x: 100, y: 100, w: 20, h: 40 };
			const host = { mouseWorld: () => ({ x: 400, y: 120 }), getEnemies: () => [], isSolid: (x, y) => x > 500, inBounds: () => true };
			W.cast(chain('k', [ ['generate', { amount: 60 }], tech('kinetic', 6) ]), { profile: profInf, owner: { id: 'p', entity: c }, host });
			const k = W.bodies.find(q => q.alive); k.x = 450; k.y = 120; k.vx = 10; k.vy = 0;
			for(let i = 0; i < 30; i++) W.update(1 / 60, host);
			ok('Kinetic energy bounces off surfaces', k.alive && k.vx < 0 && k.x < 500, k.alive ? 'vx 10 → ' + k.vx.toFixed(1) : 'gone (' + k.deathWhy + ')');
		}
		// ---- a crowd of energy: the spatial grid finds exactly what the full search finds, and opposite states still cancel
		{
			const run = (gridAt) => {
				const keep = ME.CONFIG.perf.gridAt; ME.CONFIG.perf.gridAt = gridAt;
				const W = ME.createWorld(), host = { getEnemies: () => [], isSolid: () => false, inBounds: () => true };
				let sd = 7; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
				for(let i = 0; i < 160; i++) W.emitEnergy({ key: 'crowd', owner: { id: 'p', entity: null }, host, x: 200 + rnd() * 900, y: 200 + rnd() * 500, vx: (rnd() - 0.5) * 2, vy: (rnd() - 0.5) * 2, amount: 20, tech: { thermal: i % 2 ? 2 : -2 } });
				W.update(1 / 60, host);
				const near = W.T.nearBodies(600, 400, 220, null).map(b => b.id).join(',');
				for(let i = 0; i < 20; i++) W.update(1 / 60, host);
				const sum = W.bodies.filter(b => b.alive).reduce((s, b) => s + Math.abs(ME.techOf(b, 'thermal')), 0);
				ME.CONFIG.perf.gridAt = keep;
				return { near, sum, n: W.bodies.filter(b => b.alive).length };
			};
			const a = run(40), b = run(1e9);
			ok('A crowd of energy (160 bodies) uses a spatial grid with the same results as checking every pair', a.near === b.near && a.near.length > 0 && Math.abs(a.sum - b.sum) < 1e-6 && a.n === b.n && a.sum < 160 * 2,
				'nearby search ' + (a.near === b.near ? 'identical' : 'DIFFERENT') + ' (' + a.near.split(',').length + ' found) · thermal left ' + a.sum.toFixed(1) + ' vs ' + b.sum.toFixed(1) + ' of 320');
		}
		// ---- energy emitted by the host (a weapon's beam): real energy with a set life and a set damage per hit
		{
			const W = ME.createWorld(), en = { x: 380, y: 280, w: 30, h: 40, hp: 500 }, hits = [];
			const host = { getEnemies: () => [ en ], isSolid: (x) => x > 900, inBounds: () => true, hitRect: (e) => e, damageEnemy: (e, d) => { hits.push(d); e.hp -= d; } };
			const blobs = [];
			for(let i = 0; i < 6; i++){ blobs.push(W.emitEnergy({ key: 'beam', owner: { id: 'p', entity: null }, host, x: 100 - i * 18, y: 300, vx: 18, vy: 0, amount: 6, tech: { light: 2 }, life: 0.9, hitDamage: 3 })); W.update(1 / 60, host); }
			const dk = W.emitEnergy({ key: 'beamD', owner: { id: 'p', entity: null }, host, x: 300, y: 300, vx: 12, vy: 0, amount: 6, tech: { light: -2 }, life: 2, hitDamage: 4 });
			for(let i = 0; i < 70; i++) W.update(1 / 60, host);
			const lightHits = hits.filter(h => h === 3).length, darkHits = hits.filter(h => h === 4).length;
			const gone = blobs.every(q => q && !q.alive && (q.deathWhy === 'fade' || q.x > 900));
			ok('Energy the host emits (a weapon\'s beam) is real energy: light blobs pierce and fade after their range, darkness is absorbed by what it hits', lightHits === 6 && darkHits === 1 && gone && !dk.alive,
				'light hits ' + lightHits + ' × 3 · dark hits ' + darkHits + ' × 4 · light blobs ' + blobs.map(q => q && (q.alive ? 'alive' : q.deathWhy)).join('/') + ' · dark ' + (dk.alive ? 'alive' : dk.deathWhy));
		}
		// ---- Bound: choose how many tethers
		{
			const en = dummy(); en.x = 500; en.y = 280;
			const S = sim({ enemies: [en] });
			put(S, 30, [], 200, 200); put(S, 30, [], 260, 200); put(S, 30, [], 320, 200);
			S.cast([ ['target', { kind: 'enemy', select: 'nearCaster', range: 1600 }], ['generate', { amount: 60 }], ['anchor', { state: 'bound', count: 3 }] ]);
			const b = S.live().find(q => q.bond); S.step(5);
			const n = b ? 1 + (b.bondsX ? b.bondsX.length : 0) : 0;
			const S2 = sim();
			S2.cast([ ['generate', { amount: 200 }], ['divide', { count: 6, formation: 'circle', spacing: 90, motion: 'still' }], ['anchor', { state: 'anchored' }, { mode: 'delay', delay: 0.2 }], ['target', { kind: 'energy', select: 'thisSpell' }], ['anchor', { state: 'bound', count: 2, len: 200 }] ]);
			S2.step(30);
			const per = S2.live().filter(q => q.bond).map(q => 1 + (q.bondsX ? q.bondsX.length : 0));
			ok('Bound makes as many tethers as you set (1–8)', n === 3 && b.bond.t.kind === 'enemy' && per.length >= 5 && per.every(k => k === 2), 'single energy: ' + n + ' tethers · ring of ' + per.length + ' pieces with ' + per.join(','));
		}
		// ---- 34 recursion protection
		{
			const S = sim(); const b = put(S, 40, [], 300, 300);
			let allowed = 0; for(let i = 0; i < 10; i++) if(S.W.T.portalGuard(b)) allowed++;
			const cr = { x: 0, y: 0 }; let crOk = 0; for(let i = 0; i < 10; i++) if(S.W.T.portalGuard(cr)) crOk++;
			ok('Spatial recursion protection: a portal loop is stopped safely', allowed <= 6 && !b.alive && b.deathWhy === 'recursion' && crOk <= 6 && !S.W.T.portalGuard(cr), 'energy passed ' + allowed + '× then ended · creature blocked after ' + crOk);
		}
		// ---- tethers touch things; kinetic tethers are solid to everything
		{
			const anchorE = dummy(); anchorE.x = 600; anchorE.y = 270; const walker = dummy(); walker.x = 450; walker.y = 220;
			const S = sim({ enemies: [anchorE, walker] });
			const cord = put(S, 120, [], 300, 300);
			S.cast([ ['target', { kind: 'enemy', select: 'nearCaster', range: 1600 }], ['anchor', { state: 'bound', bindTo: 'target', len: 600 }] ]);
			// bind the cord body to the far dummy directly (the cast above binds whatever energy it targets)
			cord.bond = { t: { kind: 'enemy', ref: anchorE }, len: 600, str: 5, mode: 'follow' };
			const hp0 = walker.hp;
			for(let i = 0; i < 40; i++){ walker.y += 2; S.step(1); }
			const struck = hp0 - walker.hp;
			const S2 = sim({ enemies: [] });
			const kc = put(S2, 120, [ tech('kinetic', 6) ], 300, 300);
			const post = put(S2, 40, [], 700, 300);
			kc.bond = { t: { kind: 'energy', ref: post }, len: 600, str: 5, mode: 'follow' };
			const shot = put(S2, 30, [], 500, 200); shot.anchored = false; shot.vx = 0; shot.vy = 6;
			S2.step(30);
			const S3c = S2.c; S3c.x = 490; S3c.y = 230;      // you walk into your own kinetic cord
			const y0 = S3c.y; for(let i = 0; i < 20; i++){ S3c.y += 3; S2.step(1); }
			ok('Tethers touch things: a cord strikes enemies; a kinetic cord bounces energy and creatures (you too)', struck > 0 && shot.vy < 0 && S3c.y + S3c.h / 2 < 300, 'enemy hit by cord −' + r1(struck) + ' hp · energy vy 6 → ' + shot.vy.toFixed(1) + ' · you stopped ' + r1(300 - (S3c.y + S3c.h / 2)) + ' px above the cord');
		}
	}

	ME.devTests = { spells: testSpells, profile: testProfile, run: runChecks };
})(typeof window !== 'undefined' ? window : globalThis);
