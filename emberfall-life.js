/* EmberFall life and set dressing: steps, retaining walls, ledges, lamps, bunting, the windmill and water
   wheel, chimney smoke, birds, butterflies, falling leaves, the townsfolk and NPC sprites, light and haze. */
(function (global) {
	'use strict';
	const A = global.EmberfallArt;
	const E = global.EmberfallWorld;
	const W = E.W;

	/* ------------------------------------------------------------------ NPC sprites */
	const NPC_BOX = {
		'apprentice-mage': [118, 26, 390, 482], archmage: [84, 23, 389, 472], 'artifact-dealer': [110, 49, 390, 453],
		'black-smith': [40, 43, 414, 466], 'captain-guard': [2, 16, 462, 482], 'clock-keeper': [153, 16, 357, 484],
		'eldery-sage': [143, 15, 379, 486], 'forest-ranger': [149, 37, 393, 480], 'generic-guard': [157, 17, 331, 474],
		'inn-keeper': [91, 30, 393, 464], 'mage-student': [142, 20, 358, 474], merchant: [95, 20, 333, 482],
		'scroll-vendor': [121, 14, 403, 489], 'spellcasting-child': [58, 45, 437, 454]
	};
	function npcImg(name) { return A.img('images/NPCS/' + name + '.png'); }
	function drawFigure(ctx, cam, name, cx, feet, height, facing, t, alpha) {
		const im = npcImg(name);
		if (!A.ok(im)) return false;
		const bx = NPC_BOX[name] || [0, 0, 500, 500];
		const bh = bx[3] - bx[1];
		const k = height / bh;
		const w = 500 * k;
		const h = 500 * k;
		const bob = Math.abs(Math.sin(t)) * 2.2;
		const x = cx - (bx[0] + bx[2]) / 2 * k - cam.x;
		const y = feet - bx[3] * k - cam.y - bob;
		ctx.save();
		if (alpha != null) ctx.globalAlpha *= alpha;
		if (facing < 0) {
			ctx.translate(x + w, y);
			ctx.scale(-1, 1);
			ctx.drawImage(im, 0, 0, w, h);
		} else ctx.drawImage(im, x, y, w, h);
		ctx.restore();
		return true;
	}
	function drawNpc(ctx, cam, n) {
		const name = n.sprite;
		if (!name) return false;
		const nx = n.x - cam.x;
		if (nx + n.w < -80 || nx > ctx.canvas.width + 80) return true;
		const feet = n.y + n.h;
		const moving = !n.pause && (n.speed || 0) > 0 && n.minX != null;
		const t = moving ? n.x * 0.12 : 0;
		ctx.fillStyle = 'rgba(0,0,0,0.28)';
		ctx.beginPath();
		ctx.ellipse(n.x + n.w / 2 - cam.x, feet - cam.y, 26, 6, 0, 0, Math.PI * 2);
		ctx.fill();
		const ok = drawFigure(ctx, cam, name, n.x + n.w / 2, feet + 4, n.tall || 104, n.dir || 1, t);
		if (!ok) return false;
		ctx.fillStyle = 'rgba(0,0,0,0.45)';
		ctx.font = 'bold 11px Georgia';
		ctx.textAlign = 'center';
		const ly = feet - (n.tall || 104) - 12 - cam.y;
		ctx.fillText(n.name, n.x + n.w / 2 - cam.x + 1, ly + 1);
		ctx.fillStyle = '#f1c40f';
		ctx.fillText(n.name, n.x + n.w / 2 - cam.x, ly);
		if (n.hubShop) {
			ctx.fillStyle = '#ffe9a0';
			ctx.font = '13px Arial';
			ctx.fillText('🪙', n.x + n.w / 2 - cam.x, ly - 14);
		}
		return true;
	}
	function drawWalkers(ctx, cam, list) {
		for (const w of list) {
			if (w.x - cam.x < -100 || w.x - cam.x > ctx.canvas.width + 100) continue;
			const feet = (w.y != null ? w.y + (w.h || 52) : E.surf(w.x + 16));
			ctx.fillStyle = 'rgba(0,0,0,0.22)';
			ctx.beginPath();
			ctx.ellipse(w.x + 16 - cam.x, feet - cam.y, 20, 5, 0, 0, Math.PI * 2);
			ctx.fill();
			const moving = !w.pause;
			drawFigure(ctx, cam, w.sprite || 'merchant', w.x + 16, feet + 3, w.tall || 92, w.dir || 1, moving ? w.x * 0.14 : 0, w.alpha);
		}
	}

	/* ------------------------------------------------------------------ structures drawn over the terrain */
	function drawSteps(ctx, cam, s) {
		const x0 = Math.max(s.x0, cam.x - 40);
		const x1 = Math.min(s.x1, cam.x + ctx.canvas.width + 40);
		if (x1 <= x0) return;
		const sw = 26;
		const start = s.x0 + Math.floor((x0 - s.x0) / sw) * sw;
		const yf = s.line || E.surf;
		for (let x = start; x < x1; x += sw) {
			const yL = yf(x);
			const yR = yf(x + sw);
			const top = Math.min(yL, yR);
			const bot = Math.max(yL, yR);
			const sx = x - cam.x;
			const sy = top - cam.y;
			ctx.fillStyle = s.mat === 'wood' ? '#5a3c24' : '#7a7266';
			ctx.fillRect(sx, sy, sw + 1, bot - top + 16);
			ctx.fillStyle = 'rgba(255,240,210,0.28)';
			ctx.fillRect(sx, sy, sw + 1, 3);
			ctx.fillStyle = 'rgba(0,0,0,0.28)';
			ctx.fillRect(sx + (yL > yR ? 0 : sw - 3), sy, 3, bot - top + 16);
			ctx.fillStyle = 'rgba(0,0,0,0.18)';
			ctx.fillRect(sx, sy + bot - top + 10, sw + 1, 6);
		}
	}
	function drawRetain(ctx, cam, r) {
		const sx = r.x - cam.x;
		if (sx > ctx.canvas.width || sx + r.w < 0) return;
		ctx.save();
		ctx.beginPath();
		// wall face under the upper step, clipped to below the ramp
		ctx.moveTo(sx, r.bottom - cam.y + 20);
		for (let x = r.x; x <= r.x + r.w; x += 8) ctx.lineTo(x - cam.x, E.surf(x) - cam.y + 8);
		ctx.lineTo(sx + r.w + 30, r.top - cam.y + 8);
		ctx.lineTo(sx + r.w + 30, r.bottom - cam.y + 60);
		ctx.lineTo(sx, r.bottom - cam.y + 60);
		ctx.closePath();
		ctx.fillStyle = A.pattern(ctx, 'stone', -cam.x % 300, -cam.y % 300);
		ctx.fill();
		ctx.fillStyle = 'rgba(30,24,18,0.35)';
		ctx.fill();
		ctx.restore();
	}
	function drawLedge(ctx, cam, p) {
		const sx = p.x - cam.x;
		const sy = p.y - cam.y;
		if (sx > ctx.canvas.width || sx + p.w < 0) return;
		if (p.art === 'planks') {
			ctx.fillStyle = A.pattern(ctx, 'wood', -cam.x % 300, sy);
			ctx.fillRect(sx, sy, p.w, 18);
			ctx.fillStyle = 'rgba(30,18,10,0.35)';
			ctx.fillRect(sx, sy, p.w, 18);
			ctx.fillStyle = 'rgba(255,220,170,0.3)';
			ctx.fillRect(sx, sy, p.w, 2);
			ctx.fillStyle = '#3a2616';
			for (let x = 10; x < p.w; x += 60) ctx.fillRect(sx + x, sy + 18, 8, 40);
		} else if (p.art === 'corbel') {
			ctx.fillStyle = A.pattern(ctx, 'stone', -cam.x % 300, -cam.y % 300);
			ctx.fillRect(sx, sy, p.w, 22);
			ctx.fillStyle = 'rgba(255,240,210,0.25)';
			ctx.fillRect(sx, sy, p.w, 3);
			ctx.fillStyle = 'rgba(0,0,0,0.4)';
			ctx.beginPath();
			ctx.moveTo(sx, sy + 22);
			ctx.lineTo(sx + p.w, sy + 22);
			ctx.lineTo(sx + p.w * 0.6, sy + 42);
			ctx.fill();
		} else if (p.art === 'stone') {
			ctx.fillStyle = A.pattern(ctx, 'stone', -cam.x % 300, -cam.y % 300);
			ctx.fillRect(sx, sy, p.w, p.h);
			ctx.fillStyle = 'rgba(0,0,0,0.25)';
			ctx.fillRect(sx, sy, p.w, p.h);
			ctx.fillStyle = 'rgba(255,240,210,0.28)';
			ctx.fillRect(sx, sy, p.w, 3);
		}
	}
	function drawFlyStair(ctx, cam, s) {
		/* A stone stair carried on arches, hugging the cliff. */
		const x0 = s.x0 - cam.x;
		const x1 = s.x1 - cam.x;
		if (x1 < -100 || x0 > ctx.canvas.width + 100) return;
		const yAt = x => s.y0 + (s.y1 - s.y0) * (x - s.x0) / (s.x1 - s.x0);
		ctx.save();
		// supporting wall + arches down to the terrace
		ctx.beginPath();
		ctx.moveTo(x0, yAt(s.x0) - cam.y + 10);
		ctx.lineTo(x1, yAt(s.x1) - cam.y + 10);
		ctx.lineTo(x1, s.y1 - cam.y + 40);
		ctx.lineTo(x0, s.y1 - cam.y + 40);
		ctx.closePath();
		ctx.fillStyle = A.pattern(ctx, 'stone', -cam.x % 300, -cam.y % 300);
		ctx.fill();
		ctx.fillStyle = 'rgba(30,24,18,0.3)';
		ctx.fill();
		const n = 3;
		for (let i = 0; i < n; i++) {
			const ax = s.x0 + 80 + i * (s.x1 - s.x0 - 160) / n;
			const aw = (s.x1 - s.x0 - 160) / n - 50;
			const top = yAt(ax + aw) + 60;
			const bot = s.y1 + 40;
			if (bot - top < 60) continue;
			ctx.fillStyle = 'rgba(12,10,9,0.75)';
			ctx.beginPath();
			ctx.moveTo(ax - cam.x, bot - cam.y);
			ctx.lineTo(ax - cam.x, top + aw / 2 - cam.y);
			ctx.arc(ax + aw / 2 - cam.x, top + aw / 2 - cam.y, aw / 2, Math.PI, 0);
			ctx.lineTo(ax + aw - cam.x, bot - cam.y);
			ctx.fill();
		}
		ctx.restore();
		drawSteps(ctx, cam, { x0: s.x0, x1: s.x1, mat: 'stone', line: yAt });
		// parapet rail
		ctx.strokeStyle = '#5d564e';
		ctx.lineWidth = 8;
		ctx.beginPath();
		ctx.moveTo(x0, yAt(s.x0) - 46 - cam.y);
		ctx.lineTo(x1, yAt(s.x1) - 46 - cam.y);
		ctx.stroke();
		ctx.fillStyle = '#5d564e';
		for (let x = s.x0; x <= s.x1; x += 90) ctx.fillRect(x - 5 - cam.x, yAt(x) - 50 - cam.y, 10, 50);
	}
	function drawTrestle(ctx, cam, s) {
		/* Old timber trestle under a bridge deck: splayed bents on stone footings, tied by girts, braced in alternate
		   bays, weathered and darker towards the gorge floor. A broken end shows splintered stubs. */
		const x0 = s.x0 - cam.x;
		const x1 = s.x1 - cam.x;
		if (x1 < -200 || x0 > ctx.canvas.width + 200) return;
		const top = s.deck - cam.y + 26;
		const bot = s.bottom - cam.y;
		const SP = 230;
		const bents = [];
		for (let x = s.x0 + 70; x < s.x1 - 30; x += SP) {
			const foot = Math.min(bot, E.surf(x) - cam.y);
			if (foot - top < 30) continue;
			bents.push({ x, sx: x - cam.x, foot });
		}
		const wood = (y0, y1) => {
			const g = ctx.createLinearGradient(0, y0, 0, y1);
			g.addColorStop(0, '#6b4a2c');
			g.addColorStop(0.5, '#4e3520');
			g.addColorStop(1, '#2c2016');
			return g;
		};
		const beam = (ax, ay, bx, by, w, col) => {
			ctx.strokeStyle = col;
			ctx.lineWidth = w;
			ctx.beginPath();
			ctx.moveTo(ax, ay);
			ctx.lineTo(bx, by);
			ctx.stroke();
		};
		ctx.save();
		ctx.lineCap = 'butt';
		const woodG = wood(top, bot);
		// girts and braces between neighbouring bents (behind the legs)
		for (let i = 0; i + 1 < bents.length; i++) {
			const a = bents[i];
			const b = bents[i + 1];
			const low = Math.min(a.foot, b.foot) - 40;
			for (let y = top + 150; y < low; y += 170) beam(a.sx, y, b.sx, y, 7, woodG);
			if (i % 2 === 0) {
				for (let y = top; y + 170 < low; y += 170) {
					beam(a.sx, y, b.sx, y + 170, 5, 'rgba(58,40,24,0.95)');
					beam(b.sx, y, a.sx, y + 170, 5, 'rgba(46,32,20,0.95)');
				}
			}
		}
		// the bents: two splayed legs, an inner X in each storey, a stone footing
		for (const b of bents) {
			const hgt = b.foot - top;
			const spread = 14 + hgt * 0.035;
			const lx0 = b.sx - 12;
			const rx0 = b.sx + 12;
			const lx1 = b.sx - spread;
			const rx1 = b.sx + spread;
			for (let y = top + 90; y < b.foot - 60; y += 170) {
				const k0 = (y - top) / hgt;
				const k1 = Math.min(1, (y + 170 - top) / hgt);
				beam(lx0 + (lx1 - lx0) * k0, y, rx0 + (rx1 - rx0) * k1, y + 170, 3.5, 'rgba(40,28,18,0.9)');
				beam(rx0 + (rx1 - rx0) * k0, y, lx0 + (lx1 - lx0) * k1, y + 170, 3.5, 'rgba(40,28,18,0.9)');
			}
			for (const [ax, bx] of [[lx0, lx1], [rx0, rx1]]) {
				beam(ax, top, bx, b.foot - 18, 11, woodG);
				beam(ax - 3, top, bx - 3, b.foot - 18, 3, 'rgba(255,215,160,0.18)');
			}
			// footing
			ctx.fillStyle = A.pattern(ctx, 'stone', -cam.x % 400, -cam.y % 400, 1, 1);
			ctx.fillRect(b.sx - spread - 20, b.foot - 26, spread * 2 + 40, 30);
			ctx.fillStyle = 'rgba(0,0,0,0.3)';
			ctx.fillRect(b.sx - spread - 20, b.foot - 6, spread * 2 + 40, 10);
		}
		// the stringer under the deck
		const sx0 = Math.max(x0, -50);
		const sx1 = Math.min(x1, ctx.canvas.width + 50);
		ctx.fillStyle = '#3e2a19';
		ctx.fillRect(sx0, top - 6, sx1 - sx0, 20);
		ctx.fillStyle = 'rgba(255,215,160,0.16)';
		ctx.fillRect(sx0, top - 6, sx1 - sx0, 3);
		// depth haze: the lower timbers fade into the gorge's shadow
		const hz = ctx.createLinearGradient(0, top, 0, bot);
		hz.addColorStop(0, 'rgba(70,86,100,0)');
		hz.addColorStop(1, 'rgba(70,86,100,0.35)');
		ctx.globalCompositeOperation = 'source-atop';
		ctx.restore();
		// a broken end: splintered stubs hanging off the stringer
		for (const end of s.broken || []) {
			const ex = end - cam.x;
			ctx.fillStyle = '#3e2a19';
			ctx.beginPath();
			ctx.moveTo(ex, top - 6);
			ctx.lineTo(ex + (end > (s.x0 + s.x1) / 2 ? 18 : -18), top + 2);
			ctx.lineTo(ex, top + 14);
			ctx.fill();
		}
	}
	function drawLamp(ctx, cam, l, t) {
		const sx = l.x - cam.x;
		if (sx < -80 || sx > ctx.canvas.width + 80) return;
		const gy = l.y - cam.y;
		const hgt = l.h || 150;
		ctx.fillStyle = '#1f1c1a';
		ctx.fillRect(sx - 3, gy - hgt, 6, hgt);
		ctx.fillRect(sx - 9, gy - 8, 18, 8);
		ctx.fillRect(sx - 3, gy - hgt, 26, 4);
		const lx = sx + 20;
		const ly = gy - hgt + 18;
		const fl = 0.85 + Math.sin(t * 9 + l.x) * 0.06 + Math.sin(t * 23 + l.x * 2) * 0.04;
		const col = l.crystal ? '140,190,255' : '255,196,110';
		const gl = ctx.createRadialGradient(lx, ly, 2, lx, ly, 70);
		gl.addColorStop(0, 'rgba(' + col + ',' + (0.5 * fl) + ')');
		gl.addColorStop(1, 'rgba(' + col + ',0)');
		ctx.fillStyle = gl;
		ctx.fillRect(lx - 70, ly - 70, 140, 140);
		ctx.fillStyle = '#26221e';
		ctx.fillRect(lx - 8, ly - 12, 16, 22);
		ctx.fillStyle = l.crystal ? '#bfe0ff' : '#ffd27a';
		ctx.fillRect(lx - 5, ly - 8, 10, 14);
		ctx.fillStyle = '#26221e';
		ctx.beginPath();
		ctx.moveTo(lx - 11, ly - 12);
		ctx.lineTo(lx, ly - 22);
		ctx.lineTo(lx + 11, ly - 12);
		ctx.fill();
	}
	function drawBunting(ctx, cam, b, t) {
		const sx0 = b.x0 - cam.x;
		const sx1 = b.x1 - cam.x;
		if (sx1 < -50 || sx0 > ctx.canvas.width + 50) return;
		const pt = u => {
			const x = b.x0 + (b.x1 - b.x0) * u;
			const y = b.y0 + (b.y1 - b.y0) * u + Math.sin(u * Math.PI) * b.sag;
			return [x - cam.x, y - cam.y];
		};
		ctx.strokeStyle = '#3a2a1a';
		ctx.lineWidth = 2;
		ctx.beginPath();
		for (let u = 0; u <= 1.001; u += 0.05) {
			const [x, y] = pt(u);
			if (u === 0) ctx.moveTo(x, y);
			else ctx.lineTo(x, y);
		}
		ctx.stroke();
		const n = Math.max(4, Math.round((b.x1 - b.x0) / 46));
		for (let i = 0; i < n; i++) {
			const u = (i + 0.5) / n;
			const [x, y] = pt(u);
			const flap = Math.sin(t * 3 + i * 1.3 + b.x0 * 0.01) * 4;
			ctx.fillStyle = b.cols[i % b.cols.length];
			ctx.beginPath();
			ctx.moveTo(x - 11, y);
			ctx.lineTo(x + 11, y);
			ctx.lineTo(x + flap, y + 24);
			ctx.closePath();
			ctx.fill();
			ctx.fillStyle = 'rgba(0,0,0,0.18)';
			ctx.beginPath();
			ctx.moveTo(x, y);
			ctx.lineTo(x + 11, y);
			ctx.lineTo(x + flap, y + 24);
			ctx.fill();
		}
	}
	function drawSails(ctx, cam, m, t) {
		const cx = m.x - cam.x;
		const cy = m.y - cam.y;
		if (cx < -400 || cx > ctx.canvas.width + 400) return;
		const a0 = t * 0.6;
		for (let i = 0; i < 4; i++) {
			const a = a0 + i * Math.PI / 2;
			ctx.save();
			ctx.translate(cx, cy);
			ctx.rotate(a);
			ctx.fillStyle = '#4a3422';
			ctx.fillRect(-5, 0, 10, m.r);
			ctx.fillStyle = 'rgba(236,226,204,0.92)';
			ctx.fillRect(8, m.r * 0.18, 46, m.r * 0.8);
			ctx.strokeStyle = '#4a3422';
			ctx.lineWidth = 2;
			for (let k = 0; k < 5; k++) {
				ctx.beginPath();
				ctx.moveTo(8, m.r * (0.18 + k * 0.2));
				ctx.lineTo(54, m.r * (0.18 + k * 0.2));
				ctx.stroke();
			}
			ctx.strokeRect(8, m.r * 0.18, 46, m.r * 0.8);
			ctx.restore();
		}
		ctx.fillStyle = '#2a1e14';
		ctx.beginPath();
		ctx.arc(cx, cy, 16, 0, Math.PI * 2);
		ctx.fill();
	}
	function drawWheel(ctx, cam, w, t) {
		const im = A.road('wheel');
		if (!A.ok(im)) return;
		const cx = w.x - cam.x;
		const cy = w.y - cam.y;
		if (cx < -300 || cx > ctx.canvas.width + 300) return;
		const d = w.r * 2;
		ctx.save();
		ctx.translate(cx, cy);
		ctx.rotate(-t * 0.5);
		ctx.drawImage(im, -d / 2, -d / 2, d, d * im.naturalHeight / im.naturalWidth);
		ctx.restore();
	}

	/* ------------------------------------------------------------------ wind: W.winds = [{ x0, x1, k }] — gusting, 0..1 */
	function windAt(x, t) {
		for (const w of W.winds || []) {
			if (x < w.x0 || x > w.x1) continue;
			const edge = Math.min(1, (x - w.x0) / 600, (w.x1 - x) / 600);
			const gust = Math.max(0, Math.sin(t * 0.45 + w.x0) * 0.6 + Math.sin(t * 1.3 + w.x0 * 2) * 0.4);
			return w.k * edge * (0.35 + 0.65 * gust);
		}
		return 0;
	}

	/* ------------------------------------------------------------------ particles */
	const parts = [];
	const birds = [];
	let lastT = 0;
	let livePlayer = null;
	const NEAR = [];
	function update(player, inside) {
		livePlayer = player;
		const t = performance.now() / 1000;
		const dt = Math.min(0.05, lastT ? t - lastT : 0.016);
		lastT = t;
		if (inside || !player) return;
		const cx = player.x;
		// chimney smoke near the player
		for (const s of W.smoke) {
			if (Math.abs(s.x - cx) > 1600) continue;
			if (Math.random() < 0.18 * s.rate) parts.push({ k: 'smoke', x: s.x + (Math.random() - 0.5) * 10, y: s.y, vx: 0.25 + Math.random() * 0.3, vy: -0.6 - Math.random() * 0.4, life: 0, max: 5 + Math.random() * 3, r: 8 });
		}
		// leaves drifting from trees near the player
		if (Math.random() < 0.08) {
			const trees = E.propsNear('back', cx - 900, cx + 900, NEAR).concat(E.propsNear('mid', cx - 900, cx + 900)).filter(p => p.kind === 'flora' && /oak|birch|apple|willow/.test(p.name) && Math.abs(p.x - cx) < 900);
			if (trees.length) {
				const tr = trees[(Math.random() * trees.length) | 0];
				parts.push({ k: 'leaf', x: tr.x + (Math.random() - 0.5) * tr.h * 0.5, y: tr.y - tr.h * (0.5 + Math.random() * 0.4), vx: 0.4 + Math.random() * 0.6, vy: 0.5 + Math.random() * 0.4, life: 0, max: 7, rot: Math.random() * 6, col: /autumn/.test(tr.name) ? '#d9a23b' : '#6e942f' });
			}
		}
		// butterflies over flowers
		if (Math.random() < 0.02 && parts.filter(p => p.k === 'fly').length < 6) {
			const fl = E.propsNear('front', cx - 700, cx + 700, NEAR).concat(E.propsNear('mid', cx - 700, cx + 700)).filter(p => /flowers|bush-flower|heather/.test(p.name) && Math.abs(p.x - cx) < 700);
			if (fl.length) {
				const f = fl[(Math.random() * fl.length) | 0];
				parts.push({ k: 'fly', x: f.x, y: f.y - 40, hx: f.x, hy: f.y - 40, life: 0, max: 14, col: ['#f2f0e6', '#f7d64a', '#e58bb0', '#8ab4f0'][(Math.random() * 4) | 0], ph: Math.random() * 6 });
			}
		}
		// snow wherever it is cold enough (the high North Road, the frontier), heavier the colder it gets; in a wind
		// zone the flakes are driven sideways in gusts
		const cold = E.coldAt(cx);
		const wind = windAt(cx, t);
		if (cold > 0.55) {
			const rate = Math.min(4, (cold - 0.5) * 4 + wind * 4);
			for (let i = 0; i < rate; i++) if (Math.random() < 0.9) parts.push({ k: 'snow', x: cx + (Math.random() - 0.5) * 1800 - wind * 500, y: player.y - 520 - Math.random() * 260, vx: -0.4 - Math.random() * 0.6 - wind * 6, vy: 0.8 + Math.random() * 0.8, life: 0, max: 12, r: 1.4 + Math.random() * 1.4 });
		} else if (cold > 0.4 && Math.random() < (cold - 0.4) * 2) {
			// the first flurries on the wind
			parts.push({ k: 'snow', x: cx + (Math.random() - 0.5) * 1800, y: player.y - 520 - Math.random() * 260, vx: -0.6 - Math.random() * 0.6, vy: 0.7 + Math.random() * 0.6, life: 0, max: 12, r: 1.2 + Math.random() });
		}
		if (wind > 0.3 && Math.random() < wind * 0.5) parts.push({ k: 'drift', x: cx + 900 + Math.random() * 300, y: E.surf(cx) - 20 - Math.random() * 160, vx: -9 - wind * 8, vy: (Math.random() - 0.5) * 0.6, life: 0, max: 3, len: 40 + Math.random() * 80 });
		// spray off raging water near the player
		for (const w of W.water) {
			if (!w.rapids || cx < w.x0 - 1400 || cx > w.x1 + 1400) continue;
			for (let k = 0; k < 3; k++) {
				const x = w.x0 + Math.random() * (w.x1 - w.x0);
				parts.push({ k: 'spray', x, y: w.y - 2, vx: (Math.random() - 0.5) * 1.6, vy: -1.2 - Math.random() * 2.6, life: 0, max: 0.5 + Math.random() * 0.6, r: 1.5 + Math.random() * 3 });
			}
			for (const fx of w.boils || []) if (Math.random() < 0.5) parts.push({ k: 'spray', x: fx + (Math.random() - 0.5) * 60, y: w.y - 4, vx: (Math.random() - 0.5) * 2.4, vy: -2.4 - Math.random() * 3, life: 0, max: 0.6 + Math.random() * 0.5, r: 2 + Math.random() * 3 });
		}
		// fireflies at dusk-dark spots (river banks, the forest floor): W.motes = [{x0, x1, kind}]
		for (const m of W.motes || []) {
			if (cx < m.x0 - 900 || cx > m.x1 + 900 || Math.random() > 0.05) continue;
			if (parts.filter(p => p.k === 'mote').length > 26) break;
			const x = m.x0 + Math.random() * (m.x1 - m.x0);
			parts.push({ k: 'mote', x, y: E.surf(x) - 20 - Math.random() * 140, hx: x, hy: 0, life: 0, max: 6 + Math.random() * 5, ph: Math.random() * 6, col: m.col || '#d8ff8a' });
		}
		for (let i = parts.length - 1; i >= 0; i--) {
			const p = parts[i];
			p.life += dt;
			if (p.k === 'smoke') {
				p.x += p.vx;
				p.y += p.vy;
				p.r += 0.22;
				p.vx += 0.004;
			} else if (p.k === 'leaf') {
				p.x += p.vx + Math.sin(p.life * 3 + p.rot) * 0.7;
				p.y += p.vy;
				p.rot += 0.05;
				if (p.y > E.surf(p.x)) p.life = p.max;
			} else if (p.k === 'fly') {
				p.ph += 0.3;
				p.x = p.hx + Math.sin(p.life * 0.9) * 60 + Math.sin(p.life * 2.3) * 14;
				p.y = p.hy + Math.cos(p.life * 1.3) * 26 - 10;
			} else if (p.k === 'snow') {
				p.x += p.vx + Math.sin(p.life * 2 + p.y * 0.01) * 0.4;
				p.y += p.vy;
				if (p.y > E.surf(p.x)) p.life = p.max;
			} else if (p.k === 'spray') {
				p.x += p.vx;
				p.y += p.vy;
				p.vy += 0.16;
			} else if (p.k === 'drift') {
				p.x += p.vx;
				p.y += p.vy;
			} else if (p.k === 'mote') {
				p.ph += dt;
				p.x += Math.sin(p.ph * 0.7 + p.hx) * 0.4;
				p.y += Math.cos(p.ph * 0.9) * 0.3 - 0.05;
			}
			if (p.life >= p.max) parts.splice(i, 1);
		}
		if (parts.length > 600) parts.splice(0, parts.length - 600);
		// birds: occasional flocks crossing the sky
		if (Math.random() < 0.003 && birds.length < 3) {
			const dir = Math.random() < 0.5 ? 1 : -1;
			const n = 4 + ((Math.random() * 6) | 0);
			const fl = { dir, x: dir > 0 ? -60 : 1.1, y: 0.1 + Math.random() * 0.25, members: [], t: 0 };
			for (let i = 0; i < n; i++) fl.members.push({ ox: -i * 26 * dir + (Math.random() - 0.5) * 14, oy: Math.abs(i - n / 2) * 9 + Math.random() * 8, ph: Math.random() * 6 });
			birds.push(fl);
		}
		for (let i = birds.length - 1; i >= 0; i--) {
			const f = birds[i];
			f.t += dt;
			f.x += f.dir * dt * 0.06;
			if (f.x > 1.3 || f.x < -0.3) birds.splice(i, 1);
		}
	}
	function drawSkyLife(ctx, cam, vw, vh) {
		const t = performance.now() / 1000;
		ctx.strokeStyle = 'rgba(40,40,50,0.7)';
		ctx.lineWidth = 2;
		for (const f of birds) {
			for (const m of f.members) {
				const x = f.x * vw + m.ox;
				const y = f.y * vh + m.oy;
				const flap = Math.sin(t * 9 + m.ph) * 4;
				ctx.beginPath();
				ctx.moveTo(x - 7, y - flap);
				ctx.quadraticCurveTo(x - 3, y - 3, x, y);
				ctx.quadraticCurveTo(x + 3, y - 3, x + 7, y - flap);
				ctx.stroke();
			}
		}
	}
	function drawBehind(ctx, cam, vw, vh) {
		const t = performance.now() / 1000;
		for (const f of W.falls) {
			if (f.front) continue;
			drawFall(ctx, cam, f, t, vw);
		}
		for (const s of W.backStructs || []) if (s.x1 > cam.x - 300 && s.x0 < cam.x + vw + 300) { if (s.kind === 'riverFar') drawRiverFar(ctx, cam, s, t); else s.draw(ctx, cam, t, vw, vh); }
	}
	function hash(n) { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); }
	function drawRiverFar(ctx, cam, s, t) {
		/* The river coming toward you from far upstream, seen through (and over) the bridge: a band of water that is narrow and
		   hazy at the far end and widens to the full channel at your end, with green banks along it. Streaks of current slide
		   down it and spread as they come closer (they speed up with perspective), and white water breaks over two rapids. */
		const cx = s.cx - cam.x, yF = s.yFar - cam.y, yN = s.yNear - cam.y;
		const hF = s.wFar / 2, hN = s.wNear / 2;
		const xAt = (y, u) => { const p = (y - yF) / (yN - yF); return cx + u * (hF + (hN - hF) * p * p); };
		ctx.save();
		// banks: a wider wedge of grass and rock under the water
		ctx.beginPath();
		ctx.moveTo(xAt(yF, -1) - 40, yF - 6); ctx.lineTo(xAt(yF, 1) + 40, yF - 6);
		ctx.lineTo(cx + hN + 220, yN + 4); ctx.lineTo(cx - hN - 220, yN + 4); ctx.closePath();
		const EW = global.EmberfallWorld;
		const md = EW && EW.meadow ? EW.meadow(false) : null;
		if (md) {
			// the same painted fields as the low countryside behind, so the banks read as land rather than a flat block
			if (!md.pat) md.pat = ctx.createPattern(md.cv, 'repeat-x');
			md.pat.setTransform(new DOMMatrix().translate(Math.round(-cam.x * 0.6), Math.round(yF - 40)));
			ctx.fillStyle = md.pat; ctx.fill();
			const sh = ctx.createLinearGradient(0, yF, 0, yN);
			sh.addColorStop(0, 'rgba(190,210,200,0.35)'); sh.addColorStop(1, 'rgba(20,40,20,0.25)');
			ctx.fillStyle = sh; ctx.fill();
		} else {
			const bg = ctx.createLinearGradient(0, yF, 0, yN);
			bg.addColorStop(0, 'rgba(120,150,120,0.9)'); bg.addColorStop(1, 'rgba(58,84,48,1)');
			ctx.fillStyle = bg; ctx.fill();
		}
		// the water
		ctx.beginPath();
		const N = 24;
		for (let i = 0; i <= N; i++) { const y = yF + (yN - yF) * i / N; const x = xAt(y, -1) + Math.sin(i * 1.7 + t * 2) * 3 * i / N; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
		for (let i = N; i >= 0; i--) { const y = yF + (yN - yF) * i / N; ctx.lineTo(xAt(y, 1) + Math.sin(i * 1.3 - t * 2) * 3 * i / N, y); }
		ctx.closePath();
		const wg = ctx.createLinearGradient(0, yF, 0, yN);
		wg.addColorStop(0, 'rgba(170,200,205,1)'); wg.addColorStop(0.5, 'rgba(88,138,150,1)'); wg.addColorStop(1, 'rgba(46,96,110,1)');
		ctx.fillStyle = wg; ctx.fill();
		ctx.clip();
		// streaks of current
		ctx.lineCap = 'round';
		for (let k = 0; k < 70; k++) {
			const u = (hash(k * 3.7) * 2 - 1) * 0.92;
			const ph = (t * (0.32 + hash(k * 1.3) * 0.18) + hash(k * 5.1)) % 1;
			const pa = ph, pb = Math.min(1, ph + 0.06 + 0.1 * ph);
			const ya = yF + (yN - yF) * pa * pa, yb = yF + (yN - yF) * pb * pb;
			ctx.strokeStyle = 'rgba(235,250,255,' + (0.15 + 0.55 * ph) + ')';
			ctx.lineWidth = 0.6 + ph * 2.6;
			ctx.beginPath(); ctx.moveTo(xAt(ya, u), ya); ctx.lineTo(xAt(yb, u), yb); ctx.stroke();
		}
		// two rapids across the river: rows of breaking white water
		for (const rp of [0.42, 0.74]) {
			const y = yF + (yN - yF) * rp * rp;
			const wHalf = hF + (hN - hF) * rp * rp;
			for (let k = 0; k < 18; k++) {
				const u = -1 + (k + 0.5) / 9;
				const b = Math.abs(Math.sin(t * 3.1 + k * 1.7));
				ctx.fillStyle = 'rgba(248,253,255,' + (0.35 + 0.5 * b) + ')';
				ctx.beginPath(); ctx.ellipse(cx + u * wHalf, y - b * 3 * rp, (6 + 10 * rp) * (0.6 + b * 0.6), (2 + 4 * rp) * (0.6 + b * 0.5), 0, 0, Math.PI * 2); ctx.fill();
			}
		}
		// haze over the far end
		const hz = ctx.createLinearGradient(0, yF, 0, yF + (yN - yF) * 0.35);
		hz.addColorStop(0, 'rgba(200,215,225,0.55)'); hz.addColorStop(1, 'rgba(200,215,225,0)');
		ctx.fillStyle = hz; ctx.fillRect(cx - hN - 300, yF - 10, hN * 2 + 600, (yN - yF) * 0.4);
		ctx.restore();
	}
	function drawFall(ctx, cam, f, t, vw) {
		if (f.frozen) { drawFrozenFall(ctx, cam, f, t, vw); return; }
		{
			const x = f.x - cam.x;
			if (x < -200 || x > vw + 200) return;
			const top = f.top - cam.y;
			const bot = f.bottom - cam.y;
			const g = ctx.createLinearGradient(x - f.w / 2, 0, x + f.w / 2, 0);
			g.addColorStop(0, 'rgba(150,200,225,0.55)');
			g.addColorStop(0.5, 'rgba(220,240,250,0.85)');
			g.addColorStop(1, 'rgba(120,170,200,0.55)');
			ctx.fillStyle = g;
			ctx.fillRect(x - f.w / 2, top, f.w, bot - top);
			// streaks falling
			ctx.strokeStyle = 'rgba(255,255,255,0.6)';
			ctx.lineWidth = 2;
			for (let k = 0; k < f.w / 8; k++) {
				const sx = x - f.w / 2 + 4 + k * 8;
				const off = ((t * 380 + k * 97) % (bot - top + 120)) - 60;
				ctx.beginPath();
				ctx.moveTo(sx, top + off);
				ctx.lineTo(sx, top + off + 50);
				ctx.stroke();
			}
			// spray at the foot
			for (let k = 0; k < 8; k++) {
				const a = (t * 1.7 + k) % 1;
				const rr = 20 + a * 50;
				ctx.fillStyle = 'rgba(240,250,255,' + (0.35 * (1 - a)) + ')';
				ctx.beginPath();
				ctx.arc(x + Math.sin(k * 2.3) * f.w * 0.6, bot - a * 40, rr * 0.5, 0, Math.PI * 2);
				ctx.fill();
			}
		}
	}
	function drawFrozenFall(ctx, cam, f, t, vw) {
		/* A waterfall frozen solid against the cliff: fluted columns of ice, bright where they bulge, blue in the
		   folds, icicles fringing the lip and a dome of ice and snow at the foot. Painted once and cached. */
		const x = f.x - cam.x;
		if (x < -400 || x > vw + 400) return;
		const key = 'frozenfall:' + f.x + ':' + f.w + ':' + (f.bottom - f.top);
		const r = A.get(key, () => {
			const W2 = f.w + 120, H2 = f.bottom - f.top + 60;
			const cv = A.canvas(W2, H2);
			const g = cv.getContext('2d');
			const rr = A.rnd(f.x | 0);
			const n = Math.max(5, Math.round(f.w / 26));
			for (let i = 0; i < n; i++) {
				const cx = 60 + (i + 0.5) * f.w / n + (rr() - 0.5) * 10;
				const wcol = f.w / n * (0.9 + rr() * 0.6);
				const len = (H2 - 60) * (0.82 + rr() * 0.18);
				const gr = g.createLinearGradient(cx - wcol / 2, 0, cx + wcol / 2, 0);
				gr.addColorStop(0, 'rgba(120,170,205,0.95)');
				gr.addColorStop(0.35, 'rgba(232,246,255,0.98)');
				gr.addColorStop(0.7, 'rgba(170,210,235,0.95)');
				gr.addColorStop(1, 'rgba(90,140,180,0.95)');
				g.fillStyle = gr;
				g.beginPath();
				g.moveTo(cx - wcol / 2, 0);
				g.lineTo(cx + wcol / 2, 0);
				g.quadraticCurveTo(cx + wcol * 0.62, len * 0.6, cx + wcol * 0.3, len);
				g.lineTo(cx - wcol * 0.3, len);
				g.quadraticCurveTo(cx - wcol * 0.62, len * 0.6, cx - wcol / 2, 0);
				g.fill();
				g.strokeStyle = 'rgba(255,255,255,0.55)';
				g.lineWidth = 2;
				g.beginPath();
				g.moveTo(cx - wcol * 0.12, 6);
				g.lineTo(cx - wcol * 0.08, len * 0.85);
				g.stroke();
			}
			// the foot: a mound of ice and snow
			const fy = H2 - 40;
			const mg = g.createLinearGradient(0, fy - 60, 0, H2);
			mg.addColorStop(0, '#f4f9fd');
			mg.addColorStop(1, '#a9c9de');
			g.fillStyle = mg;
			g.beginPath();
			g.ellipse(W2 / 2, fy + 10, f.w * 0.75, 70, 0, Math.PI, 0);
			g.fill();
			// icicle fringe at the lip
			for (let i = 0; i < f.w / 9; i++) {
				const ix = 60 + i * 9 + rr() * 4;
				const il = 14 + rr() * 40;
				g.fillStyle = 'rgba(235,248,255,0.95)';
				g.beginPath();
				g.moveTo(ix - 4, 0);
				g.lineTo(ix + 4, 0);
				g.lineTo(ix, il);
				g.fill();
			}
			return { cv, ox: 0, oy: 0 };
		});
		if (!r) return;
		ctx.drawImage(r.cv, Math.round(x - f.w / 2 - 60), Math.round(f.top - cam.y));
		// a slow glint running down one column
		const gy = ((t * 60) % (f.bottom - f.top + 200)) - 100;
		const gx = x + Math.sin(f.x) * f.w * 0.25;
		const g2 = ctx.createRadialGradient(gx, f.top - cam.y + gy, 1, gx, f.top - cam.y + gy, 26);
		g2.addColorStop(0, 'rgba(255,255,255,0.7)');
		g2.addColorStop(1, 'rgba(255,255,255,0)');
		ctx.fillStyle = g2;
		ctx.fillRect(gx - 26, f.top - cam.y + gy - 26, 52, 52);
	}
	const takenCache = {};
	let takenT = 0;
	function lootTaken(id) {
		const now = performance.now();
		if (now - takenT > 1000) { for (const k in takenCache) delete takenCache[k]; takenT = now; }
		if (takenCache[id] == null) {
			let v = false;
			try { v = !!(global.localStorage && localStorage.getItem('magicBattle_road_' + id)); } catch (e) { v = false; }
			takenCache[id] = v;
		}
		return takenCache[id];
	}
	function drawGlints(ctx, cam, t, vw) {
		/* a faint twinkle over anything you can still search, so careful explorers can spot caches */
		for (const l of W.loots) {
			const x = l.x + l.w / 2 - cam.x;
			if (x < -50 || x > vw + 50) continue;
			if (l.hidden && !(l.reveal && l.reveal())) continue;
			if (lootTaken(l.id)) continue;
			const y = (l.y != null ? l.y : E.surf(l.x + l.w / 2)) - cam.y - 26;
			const p = 0.5 + 0.5 * Math.sin(t * 2.4 + l.x);
			ctx.save();
			ctx.globalCompositeOperation = 'lighter';
			const g = ctx.createRadialGradient(x, y, 1, x, y, 18 + p * 6);
			g.addColorStop(0, 'rgba(255,240,180,' + (0.35 + 0.35 * p) + ')');
			g.addColorStop(1, 'rgba(255,240,180,0)');
			ctx.fillStyle = g;
			ctx.fillRect(x - 26, y - 26, 52, 52);
			ctx.strokeStyle = 'rgba(255,250,220,' + (0.4 + 0.5 * p) + ')';
			ctx.lineWidth = 1.5;
			ctx.beginPath();
			ctx.moveTo(x - 6 - p * 3, y);
			ctx.lineTo(x + 6 + p * 3, y);
			ctx.moveTo(x, y - 6 - p * 3);
			ctx.lineTo(x, y + 6 + p * 3);
			ctx.stroke();
			ctx.restore();
		}
	}
	function drawWorld(ctx, cam, vw, vh) {
		const t = performance.now() / 1000;
		for (const s of W.structs) {
			if (s.kind === 'retain') drawRetain(ctx, cam, s);
		}
		for (const f of W.falls) if (f.front) drawFall(ctx, cam, f, t, vw);
		for (const s of W.structs) {
			if (s.kind === 'steps') drawSteps(ctx, cam, s);
			else if (s.kind === 'trestle') drawTrestle(ctx, cam, s);
			else if (s.kind === 'flystair') drawFlyStair(ctx, cam, s);
			else if (s.draw) { if (s.x1 == null || (s.x1 > cam.x - 300 && s.x0 < cam.x + vw + 300)) s.draw(ctx, cam, t, vw, vh); }
			else if (s.kind === 'passageDoor') {
				const x = s.x - cam.x;
				if (x > -200 && x < vw + 200) {
					if (s.small) {
						// a low door set in a slab of masonry on the slope
						ctx.fillStyle = A.pattern(ctx, 'stone', -cam.x % 300, -cam.y % 300);
						ctx.fillRect(x - 30, s.y - 170 - cam.y, 170, 200);
						ctx.fillStyle = 'rgba(20,16,12,0.35)';
						ctx.fillRect(x - 30, s.y - 170 - cam.y, 170, 200);
					}
					A.door(ctx, x, s.y - 140 - cam.y, 110, 138, { arch: true, color: '#3a2414' });
				}
			}
		}
		for (const p of W.plats) if (p.art) drawLedge(ctx, cam, p);
		for (const w of W.wheels || []) drawWheel(ctx, cam, w, t);
		for (const m of W.mills || []) drawSails(ctx, cam, m, t);
		for (const l of W.lamps) drawLamp(ctx, cam, l, t);
		for (const b of W.bunting) drawBunting(ctx, cam, b, t);
		drawJoints(ctx, cam, t);
		drawGlints(ctx, cam, t, vw);
		for (const p of parts) {
			const x = p.x - cam.x;
			const y = p.y - cam.y;
			if (x < -100 || x > vw + 100 || y < -100 || y > vh + 100) continue;
			const k = p.life / p.max;
			if (p.k === 'smoke') {
				const a = 0.22 * (1 - k) * Math.min(1, p.life * 2);
				const g = ctx.createRadialGradient(x, y, 1, x, y, p.r);
				g.addColorStop(0, 'rgba(200,196,190,' + a + ')');
				g.addColorStop(1, 'rgba(200,196,190,0)');
				ctx.fillStyle = g;
				ctx.fillRect(x - p.r, y - p.r, p.r * 2, p.r * 2);
			} else if (p.k === 'leaf') {
				ctx.save();
				ctx.translate(x, y);
				ctx.rotate(p.rot);
				ctx.fillStyle = p.col;
				ctx.beginPath();
				ctx.ellipse(0, 0, 5, 2.5, 0, 0, Math.PI * 2);
				ctx.fill();
				ctx.restore();
			} else if (p.k === 'mote') {
				const a = Math.min(1, p.life, p.max - p.life) * (0.5 + 0.5 * Math.sin(p.ph * 4));
				ctx.save();
				ctx.globalCompositeOperation = 'lighter';
				const g = ctx.createRadialGradient(x, y, 0, x, y, 9);
				g.addColorStop(0, p.col);
				g.addColorStop(1, 'rgba(0,0,0,0)');
				ctx.globalAlpha = a;
				ctx.fillStyle = g;
				ctx.fillRect(x - 9, y - 9, 18, 18);
				ctx.restore();
			} else if (p.k === 'spray') {
				ctx.fillStyle = 'rgba(240,250,255,' + (0.75 * (1 - k)) + ')';
				ctx.beginPath(); ctx.arc(x, y, p.r * (0.6 + k * 0.8), 0, Math.PI * 2); ctx.fill();
			} else if (p.k === 'fly') {
				const flap = Math.abs(Math.sin(p.ph));
				ctx.fillStyle = p.col;
				ctx.beginPath();
				ctx.ellipse(x - 3, y, 4 * flap + 1, 3, -0.4, 0, Math.PI * 2);
				ctx.ellipse(x + 3, y, 4 * flap + 1, 3, 0.4, 0, Math.PI * 2);
				ctx.fill();
			}
		}
	}
	function frontGrass(ctx, cam, vw) {
		/* The tips of the turf drawn again in front of everyone, so feet sink into the grass. */
		const x0 = Math.floor(cam.x / 8) * 8;
		for (let x = x0; x < cam.x + vw + 8; x += 8) {
			const c = Math.floor(x / 8);
			const m = W.mat[c];
			let im = null;
			if (m === W.M.meadow) im = A.sprite('grassMeadow');
			else if (m === W.M.dry) im = A.sprite('grassDry');
			else if (m === W.M.cold || m === W.M.snow) im = A.sprite('grassCold');
			if (!im || !A.ok(im)) continue;
			const s = E.surf(x);
			const slope = Math.abs(E.surf(x + 8) - E.surf(x - 8)) / 16;
			if (slope > 1.2) continue;
			if (E.inVoid(x + 4, s + 4)) continue;
			const sw = im.naturalWidth;
			const sh = im.naturalHeight;
			const sx = (((x * 1.37) % sw) + sw) % sw;
			const tipH = sh * 0.32;
			const w = Math.min(8, sw - sx);
			ctx.drawImage(im, sx, sh * 0.3, w, tipH, x - cam.x, s - cam.y - tipH + 4, w, tipH);
		}
	}
	function drawJoints(ctx, cam, t) {
		/* Every junction has a fingerpost: a weathered board naming the road and the way it runs. Standing at it shows
		   the hint to press L and turn onto that road. */
		for (const j of W.joints) {
			const cxw = j.x + j.w / 2;
			const x = cxw - cam.x;
			if (x < -260 || x > ctx.canvas.width + 260) continue;
			const gy = E.surf(cxw) - cam.y;
			const near = livePlayer && livePlayer.x + livePlayer.w > j.x - 40 && livePlayer.x < j.x + j.w + 40 && Math.abs(livePlayer.y + livePlayer.h - E.surf(cxw)) < 160;
			const pulse = 0.55 + Math.sin(t * 3) * 0.2;
			const g = ctx.createRadialGradient(x, gy, 6, x, gy, 90);
			g.addColorStop(0, 'rgba(255,214,64,' + ((near ? 0.55 : 0.28) * pulse) + ')');
			g.addColorStop(1, 'rgba(255,214,64,0)');
			ctx.fillStyle = g;
			ctx.fillRect(x - 100, gy - 90, 200, 110);
			// the post and its board (an arrow-ended plank pointing the way the road runs)
			const dir = j.point || 1;
			const text = (j.way ? j.way + ' — ' : '') + j.label;
			ctx.font = 'bold 13px Georgia';
			const tw = ctx.measureText(text).width;
			const bw = tw + 34, bh = 26, by = gy - 150;
			const bx = x - bw / 2;
			ctx.fillStyle = '#3a2818';
			ctx.fillRect(x - 5, by, 10, gy - by);
			ctx.fillStyle = 'rgba(0,0,0,0.25)';
			ctx.fillRect(x + 2, by, 3, gy - by);
			ctx.beginPath();
			if (dir > 0) { ctx.moveTo(bx, by); ctx.lineTo(bx + bw - 12, by); ctx.lineTo(bx + bw, by + bh / 2); ctx.lineTo(bx + bw - 12, by + bh); ctx.lineTo(bx, by + bh); }
			else { ctx.moveTo(bx + bw, by); ctx.lineTo(bx + 12, by); ctx.lineTo(bx, by + bh / 2); ctx.lineTo(bx + 12, by + bh); ctx.lineTo(bx + bw, by + bh); }
			ctx.closePath();
			const wg = ctx.createLinearGradient(0, by, 0, by + bh);
			wg.addColorStop(0, '#8a6440');
			wg.addColorStop(1, '#5c3f26');
			ctx.fillStyle = wg;
			ctx.fill();
			ctx.strokeStyle = '#2e1e12';
			ctx.lineWidth = 2;
			ctx.stroke();
			if (j.snowy) { ctx.fillStyle = 'rgba(245,249,252,0.95)'; ctx.fillRect(bx + 2, by - 4, bw - 14, 5); }
			ctx.fillStyle = '#f6e7c4';
			ctx.textAlign = 'center';
			ctx.fillText(text, x + (dir > 0 ? -5 : 5), by + 18);
			if (near) {
				const hint = 'Press L — turn onto ' + j.label;
				ctx.font = 'bold 13px Georgia';
				const hw = ctx.measureText(hint).width;
				ctx.fillStyle = 'rgba(20,14,8,0.65)';
				ctx.fillRect(x - hw / 2 - 8, by - 36, hw + 16, 22);
				ctx.fillStyle = '#ffe9a0';
				ctx.fillText(hint, x, by - 20);
			}
		}
	}
	let frontCache = null;
	let darkCv = null;
	function drawCaveDark(ctx, cam, vw, vh, t) {
		/* inside a dark hollow: everything beyond your own light and the lamps sinks into shadow */
		if (!livePlayer) return;
		const v = E.inVoid(livePlayer.x + livePlayer.w / 2, livePlayer.y + livePlayer.h - 10);
		if (!v || !v.dark) return;
		if (!darkCv || darkCv.width !== vw || darkCv.height !== vh) darkCv = A.canvas(vw, vh);
		const g = darkCv.getContext('2d');
		g.globalCompositeOperation = 'source-over';
		g.clearRect(0, 0, vw, vh);
		g.fillStyle = 'rgba(4,3,6,0.72)';
		g.fillRect(0, 0, vw, vh);
		g.globalCompositeOperation = 'destination-out';
		const hole = (x, y, r, a) => {
			const gr = g.createRadialGradient(x, y, r * 0.1, x, y, r);
			gr.addColorStop(0, 'rgba(0,0,0,' + a + ')');
			gr.addColorStop(1, 'rgba(0,0,0,0)');
			g.fillStyle = gr;
			g.fillRect(x - r, y - r, r * 2, r * 2);
		};
		hole(livePlayer.x + livePlayer.w / 2 - cam.x, livePlayer.y + livePlayer.h / 2 - cam.y, 380, 1);
		for (const l of W.lamps) {
			if (l.x < v.x - 50 || l.x > v.x + v.w + 50 || Math.abs(l.y - (v.y + v.h)) > 60) continue;
			hole(l.x + 20 - cam.x, l.y - (l.h || 150) + 18 - cam.y, 240 + Math.sin(t * 7 + l.x) * 8, 0.95);
		}
		for (const p of W.glows || []) if (p.x > v.x - 50 && p.x < v.x + v.w + 50) hole(p.x - cam.x, p.y - cam.y, p.r || 200, p.a || 0.9);
		ctx.drawImage(darkCv, 0, 0);
	}
	function drawFront(ctx, cam, vw, vh) {
		frontGrass(ctx, cam, vw);
		drawCaveDark(ctx, cam, vw, vh, performance.now() / 1000);
		for (const p of parts) {
			if (p.k !== 'snow' && p.k !== 'drift') continue;
			const x = p.x - cam.x;
			const y = p.y - cam.y;
			if (x < -120 || x > vw + 120 || y < -10 || y > vh + 10) continue;
			if (p.k === 'drift') {
				// blown snow streaming along the ground
				const a = Math.min(1, p.life * 3, (p.max - p.life) * 2) * 0.45;
				const g = ctx.createLinearGradient(x, 0, x + p.len, 0);
				g.addColorStop(0, 'rgba(255,255,255,' + a + ')');
				g.addColorStop(1, 'rgba(255,255,255,0)');
				ctx.strokeStyle = g;
				ctx.lineWidth = 2;
				ctx.beginPath();
				ctx.moveTo(x, y);
				ctx.lineTo(x + p.len, y + 2);
				ctx.stroke();
				continue;
			}
			ctx.fillStyle = 'rgba(255,255,255,0.85)';
			ctx.beginPath();
			ctx.arc(x, y, p.r || 2, 0, Math.PI * 2);
			ctx.fill();
		}
		// a strong gust whitens the air a little (never enough to hide an attack)
		const wnd = livePlayer ? windAt(livePlayer.x, performance.now() / 1000) : 0;
		if (wnd > 0.05) {
			ctx.fillStyle = 'rgba(236,242,248,' + Math.min(0.16, wnd * 0.18) + ')';
			ctx.fillRect(0, 0, vw, vh);
		}
		// soft sun rays from the upper left and a gentle vignette (painted once per screen size, then copied)
		const t = performance.now() / 1000;
		if (!frontCache || frontCache.w !== vw || frontCache.h !== vh) {
			const rays = A.canvas(vw + 80, vh);
			const rg = rays.getContext('2d');
			for (let i = 0; i < 3; i++) {
				const x = 40 + vw * (0.08 + i * 0.16);
				const g = rg.createLinearGradient(x, 0, x + vh * 0.5, vh);
				g.addColorStop(0, 'rgba(255,236,190,0.045)');
				g.addColorStop(1, 'rgba(255,236,190,0)');
				rg.fillStyle = g;
				rg.beginPath();
				rg.moveTo(x, -10);
				rg.lineTo(x + 70 + i * 20, -10);
				rg.lineTo(x + vh * 0.6 + 120, vh);
				rg.lineTo(x + vh * 0.6, vh);
				rg.fill();
			}
			const vig = A.canvas(vw, vh);
			const vgc = vig.getContext('2d');
			const vg = vgc.createRadialGradient(vw / 2, vh * 0.55, vh * 0.45, vw / 2, vh * 0.55, vw * 0.75);
			vg.addColorStop(0, 'rgba(0,0,0,0)');
			vg.addColorStop(1, 'rgba(10,8,20,0.32)');
			vgc.fillStyle = vg;
			vgc.fillRect(0, 0, vw, vh);
			frontCache = { w: vw, h: vh, rays, vig };
		}
		ctx.save();
		ctx.globalCompositeOperation = 'lighter';
		ctx.drawImage(frontCache.rays, Math.round(-40 + Math.sin(t * 0.2) * 20 - (cam.x * 0.02) % 40), 0);
		ctx.restore();
		ctx.drawImage(frontCache.vig, 0, 0);
	}

	global.EmberfallLife = { update, drawSkyLife, drawBehind, drawWorld, drawFront, drawWalkers, drawNpc, drawFigure, NPC_BOX, windAt };
})(typeof window !== 'undefined' ? window : globalThis);
