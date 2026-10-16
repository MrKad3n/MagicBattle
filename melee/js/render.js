import { GROUND_Y, WORLD_W, ZONES } from './arena.js';
import { solveRig } from './rig.js';
import { locomotionPose } from './anim.js';
import { debugLines, drawDebugWorld } from './debug.js';

const LOOK = {
	skin: '#e7b89a',
	hair: '#241c18',
	tunic: '#8d3030',
	tunicDark: '#5c1c22',
	leather: '#3f2e24',
	metal: '#d7dee8',
	metalEdge: '#f4f7fb',
	cape: '#6a2030',
	boot: '#241c18',
	eye: '#1a1412',
};

export function render(sim, canvas) {
	const dpr = Math.min(2, window.devicePixelRatio || 1);
	const w = canvas.clientWidth || window.innerWidth;
	const h = canvas.clientHeight || window.innerHeight;
	const pw = Math.floor(w * dpr);
	const ph = Math.floor(h * dpr);
	if (canvas.width !== pw || canvas.height !== ph) {
		canvas.width = pw;
		canvas.height = ph;
	}
	const zoom = Math.max(1.55, Math.min(2.2, h / 400));
	const viewW = w / zoom;
	const viewH = h / zoom;
	updateCamera(sim, viewW, viewH);
	const ctx = canvas.getContext('2d');
	const shake = sim.camera.shake > 0 ? sim.camera.mag : 0;
	const sx = shake ? Math.sin(sim.time * 80) * shake : 0;
	const sy = shake ? Math.cos(sim.time * 63) * shake * 0.55 : 0;

	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	drawSky(ctx, w, h, sim.camera.x);
	ctx.setTransform(
		dpr * zoom, 0, 0, dpr * zoom,
		(-sim.camera.x + sx) * dpr * zoom,
		(-sim.camera.y + sy) * dpr * zoom,
	);
	drawBackdrop(ctx, sim.camera, viewW, viewH);
	drawSolids(ctx, sim, viewW, viewH);
	drawZones(ctx, sim);
	for (const e of sim.enemies) drawEnemy(ctx, e, sim.time);
	drawEffects(ctx, sim);
	drawPlayer(ctx, sim);
	if (sim.debug) drawDebugWorld(ctx, sim);
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	if (sim.debug) drawDebugPanel(ctx, sim, w, h);
}

function updateCamera(sim, viewW, viewH) {
	const p = sim.player;
	const tx = p.x + p.w / 2 + p.facing * 78 + p.vx * 0.06 - viewW / 2;
	const ty = p.y + p.h * 0.35 - viewH * 0.62;
	sim.camera.x += (tx - sim.camera.x) * 0.14;
	sim.camera.y += (ty - sim.camera.y) * 0.1;
	sim.camera.x = clamp(sim.camera.x, 0, Math.max(0, WORLD_W - viewW));
	sim.camera.y = clamp(sim.camera.y, -20, Math.max(-20, 920 - viewH));
}

function drawSky(ctx, w, h, camX) {
	const g = ctx.createLinearGradient(0, 0, 0, h);
	g.addColorStop(0, '#16141f');
	g.addColorStop(0.55, '#2a242c');
	g.addColorStop(1, '#3a2c28');
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, w, h);
	ctx.fillStyle = 'rgba(255, 186, 120, 0.05)';
	ctx.beginPath();
	ctx.arc(w * 0.78, h * 0.18, 70, 0, Math.PI * 2);
	ctx.fill();
	void camX;
}

function drawBackdrop(ctx, cam, viewW, viewH) {
	const y = 250;
	ctx.fillStyle = '#1d2430';
	hill(ctx, cam.x * 0.25, y + 80, viewW, 46, 180);
	ctx.fillStyle = '#243042';
	hill(ctx, cam.x * 0.4, y + 120, viewW, 36, 140);
	ctx.fillStyle = 'rgba(90, 70, 60, 0.35)';
	hill(ctx, cam.x * 0.55, GROUND_Y - 70, viewW, 28, 110);
}

function hill(ctx, scroll, y, viewW, amp, step) {
	const start = Math.floor(scroll / step) * step - step;
	ctx.beginPath();
	ctx.moveTo(start - scroll, y + 200);
	for (let x = start; x < scroll + viewW + step * 2; x += step) {
		ctx.quadraticCurveTo(x + step * 0.5 - scroll, y - amp, x + step - scroll, y);
	}
	ctx.lineTo(scroll + viewW + 200, y + 220);
	ctx.fill();
}

function drawSolids(ctx, sim, viewW, viewH) {
	const cam = sim.camera;
	for (const s of sim.solids) {
		if (s.x > cam.x + viewW + 40 || s.x + s.w < cam.x - 40) continue;
		if (s.y > cam.y + viewH + 40 || s.y + s.h < cam.y - 80) continue;
		if (s.oneWay) {
			ctx.fillStyle = '#6d5340';
			ctx.fillRect(s.x, s.y, s.w, s.h);
			ctx.fillStyle = '#c4a27a';
			ctx.fillRect(s.x, s.y, s.w, 3);
			ctx.fillStyle = '#3b2c22';
			for (let x = s.x + 8; x < s.x + s.w - 4; x += 16) ctx.fillRect(x, s.y + 5, 2, s.h - 6);
		} else if (s.h < 200) {
			ctx.fillStyle = '#4e463f';
			ctx.fillRect(s.x, s.y, s.w, s.h);
			ctx.fillStyle = '#6e655c';
			ctx.fillRect(s.x, s.y, s.w, 8);
		} else {
			const top = Math.max(s.y, cam.y - 20);
			ctx.fillStyle = '#3a342e';
			ctx.fillRect(s.x, top, s.w, s.y + 70 - top);
			ctx.fillStyle = '#4a433b';
			ctx.fillRect(s.x, s.y, s.w, 18);
			ctx.fillStyle = '#2a2622';
			const x0 = Math.max(s.x, cam.x - 20);
			const x1 = Math.min(s.x + s.w, cam.x + viewW + 20);
			for (let x = x0 - (x0 % 28); x < x1; x += 28) {
				ctx.fillRect(x, s.y + 18, 2, 28);
			}
		}
	}
}

function drawZones(ctx, sim) {
	ctx.save();
	ctx.font = 'bold 13px Georgia, serif';
	ctx.textAlign = 'left';
	for (const z of ZONES) {
		ctx.fillStyle = 'rgba(255, 220, 170, 0.8)';
		ctx.fillText(z.name, z.x, GROUND_Y - 92);
		ctx.font = '11px Georgia, serif';
		ctx.fillStyle = 'rgba(220, 210, 190, 0.55)';
		ctx.fillText(z.hint, z.x, GROUND_Y - 76);
		ctx.font = 'bold 13px Georgia, serif';
	}
	ctx.restore();
}

function drawPlayer(ctx, sim) {
	const p = sim.player;
	for (const ghost of p.trail) {
		ctx.save();
		ctx.globalAlpha = Math.max(0, ghost.life * 3);
		const fake = { ...p, x: ghost.x, y: ghost.y, facing: ghost.facing };
		const pose = p._pose || locomotionPose(p, sim.time);
		drawRig(ctx, solveRig(fake, pose, p.weapon.reach), LOOK, 0.6);
		ctx.restore();
	}
	ctx.save();
	if (p.iframes > 0 && Math.sin(sim.time * 46) > 0) ctx.globalAlpha = 0.55;
	const rig = p._rig || solveRig(p, p._pose || locomotionPose(p, sim.time), p.weapon.reach);
	if (p.combat.phase === 'active' || p.combat.phase === 'cancel' || p.combat.phase === 'recovery') {
		if (p._prevBlade) drawSwoosh(ctx, p._prevBlade, rig.blade);
	}
	p._prevBlade = { x1: rig.blade.x1, y1: rig.blade.y1, x2: rig.blade.x2, y2: rig.blade.y2 };
	drawRig(ctx, rig, LOOK, 1);
	if (p.hurtFlash > 0) {
		ctx.globalAlpha = Math.min(0.65, p.hurtFlash * 4);
		ctx.fillStyle = '#fff';
		ctx.beginPath();
		ctx.arc(rig.shoulder.x, rig.shoulder.y + 6, 10, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.restore();
}

function drawSwoosh(ctx, a, b) {
	ctx.save();
	ctx.globalAlpha = 0.35;
	ctx.fillStyle = '#f2f6ff';
	ctx.beginPath();
	ctx.moveTo(a.x1, a.y1);
	ctx.lineTo(a.x2, a.y2);
	ctx.lineTo(b.x2, b.y2);
	ctx.lineTo(b.x1, b.y1);
	ctx.closePath();
	ctx.fill();
	ctx.restore();
}

function drawRig(ctx, rig, look, alpha) {
	ctx.save();
	ctx.globalAlpha *= alpha;
	ctx.fillStyle = 'rgba(0,0,0,0.28)';
	ctx.beginPath();
	ctx.ellipse(rig.originX, rig.feetY + 1, 14, 4, 0, 0, Math.PI * 2);
	ctx.fill();

	ctx.strokeStyle = look.cape;
	ctx.lineWidth = 7;
	ctx.lineCap = 'round';
	ctx.beginPath();
	ctx.moveTo(rig.shoulder.x, rig.shoulder.y);
	ctx.lineTo(rig.hipX - rig.facing * 4, rig.hipY + 4);
	ctx.stroke();

	limb(ctx, rig.hipX - 2 * rig.facing, rig.hipY, rig.kneeB.x, rig.kneeB.y, 5.2, look.tunicDark);
	limb(ctx, rig.kneeB.x, rig.kneeB.y, rig.footB.x, rig.footB.y, 4.2, look.leather);
	boot(ctx, rig.footB, rig.facing, look.boot);

	limb(ctx, rig.shB.x, rig.shB.y, rig.elbowB.x, rig.elbowB.y, 4.2, look.tunicDark);
	limb(ctx, rig.elbowB.x, rig.elbowB.y, rig.handB.x, rig.handB.y, 3.4, look.skin);

	torso(ctx, rig, look.tunic);
	head(ctx, rig, look);
	limb(ctx, rig.hipX + 2 * rig.facing, rig.hipY, rig.kneeF.x, rig.kneeF.y, 5.4, look.tunic);
	limb(ctx, rig.kneeF.x, rig.kneeF.y, rig.footF.x, rig.footF.y, 4.4, look.leather);
	boot(ctx, rig.footF, rig.facing, look.boot);

	limb(ctx, rig.shF.x, rig.shF.y, rig.elbowF.x, rig.elbowF.y, 4.6, look.tunic);
	limb(ctx, rig.elbowF.x, rig.elbowF.y, rig.handF.x, rig.handF.y, 3.6, look.skin);
	sword(ctx, rig, look);
	ctx.fillStyle = look.skin;
	ctx.beginPath();
	ctx.arc(rig.handF.x, rig.handF.y, 3.1, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();
}

function limb(ctx, x1, y1, x2, y2, width, color) {
	ctx.strokeStyle = '#1a1210';
	ctx.lineWidth = width + 2;
	ctx.lineCap = 'round';
	ctx.beginPath();
	ctx.moveTo(x1, y1);
	ctx.lineTo(x2, y2);
	ctx.stroke();
	ctx.strokeStyle = color;
	ctx.lineWidth = width;
	ctx.stroke();
}

function torso(ctx, rig, color) {
	const dx = rig.shoulder.x - rig.hipX;
	const dy = rig.shoulder.y - rig.hipY;
	const len = Math.hypot(dx, dy) || 1;
	const px = -dy / len;
	const py = dx / len;
	ctx.fillStyle = '#1a1210';
	poly(ctx, rig.hipX, rig.hipY, rig.shoulder.x, rig.shoulder.y, px, py, 9.2, 8.4);
	ctx.fill();
	ctx.fillStyle = color;
	poly(ctx, rig.hipX, rig.hipY, rig.shoulder.x, rig.shoulder.y, px, py, 7.4, 6.6);
	ctx.fill();
	ctx.fillStyle = '#d7c3a4';
	ctx.fillRect(rig.shoulder.x - 3, rig.shoulder.y + 2, 6, 3);
}

function poly(ctx, x1, y1, x2, y2, px, py, hw1, hw2) {
	ctx.beginPath();
	ctx.moveTo(x1 + px * hw1, y1 + py * hw1);
	ctx.lineTo(x2 + px * hw2, y2 + py * hw2);
	ctx.lineTo(x2 - px * hw2, y2 - py * hw2);
	ctx.lineTo(x1 - px * hw1, y1 - py * hw1);
	ctx.closePath();
}

function head(ctx, rig, look) {
	ctx.fillStyle = '#1a1210';
	ctx.beginPath();
	ctx.arc(rig.head.x, rig.head.y, 8, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = look.skin;
	ctx.beginPath();
	ctx.arc(rig.head.x, rig.head.y, 6.6, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = look.hair;
	ctx.beginPath();
	ctx.arc(rig.head.x - rig.facing * 0.4, rig.head.y - 1.2, 6.4, Math.PI * 1.05, Math.PI * 1.95);
	ctx.fill();
	ctx.fillStyle = look.eye;
	ctx.beginPath();
	ctx.arc(rig.head.x + rig.facing * 2.4, rig.head.y - 0.4, 1.05, 0, Math.PI * 2);
	ctx.fill();
}

function boot(ctx, foot, facing, color) {
	ctx.fillStyle = color;
	ctx.beginPath();
	ctx.ellipse(foot.x + facing * 2, foot.y, 5.5, 2.6, 0, 0, Math.PI * 2);
	ctx.fill();
}

function sword(ctx, rig, look) {
	const { x1, y1, x2, y2 } = rig.blade;
	const dx = x2 - x1;
	const dy = y2 - y1;
	const len = Math.hypot(dx, dy) || 1;
	const px = -dy / len;
	const py = dx / len;
	ctx.strokeStyle = '#1a1210';
	ctx.lineWidth = 4.2;
	ctx.lineCap = 'round';
	ctx.beginPath();
	ctx.moveTo(x1, y1);
	ctx.lineTo(x2, y2);
	ctx.stroke();
	ctx.strokeStyle = look.metal;
	ctx.lineWidth = 2.4;
	ctx.beginPath();
	ctx.moveTo(x1, y1);
	ctx.lineTo(x2, y2);
	ctx.stroke();
	ctx.strokeStyle = look.metalEdge;
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(x1 + px, y1 + py);
	ctx.lineTo(x2 + px * 0.4, y2 + py * 0.4);
	ctx.stroke();
	ctx.strokeStyle = '#8a6a32';
	ctx.lineWidth = 3;
	ctx.beginPath();
	ctx.moveTo(x1 - px * 6, y1 - py * 6);
	ctx.lineTo(x1 + px * 6, y1 + py * 6);
	ctx.stroke();
	ctx.strokeStyle = '#5a3a28';
	ctx.lineWidth = 3.2;
	ctx.beginPath();
	ctx.moveTo(x1, y1);
	ctx.lineTo(x1 - dx / len * 8, y1 - dy / len * 8);
	ctx.stroke();
}

const ENEMY_LOOK = {
	small: { body: '#3f7a4a', dark: '#24462c', skin: '#c4d29a', metal: '#d5dbe3' },
	medium: { body: '#4d6284', dark: '#2c384c', skin: '#d7b59a', metal: '#dde3ea' },
	large: { body: '#3c3e48', dark: '#23242c', skin: '#b7a090', metal: '#c5ccd4' },
	boss: { body: '#4a3048', dark: '#2a1828', skin: '#d7b59a', metal: '#e6d39a' },
	flyer: { body: '#6d4d86', dark: '#3c2850', skin: '#d2c0ea', metal: '#efe6ff' },
};

function drawEnemy(ctx, e, time) {
	if (e.dead) return;
	const look = ENEMY_LOOK[e.tier] || ENEMY_LOOK.small;
	const lean = e.state === 'stagger' || e.state === 'hit' ? -0.35 * e.facing : 0;
	const spin = e.state === 'launch' ? Math.atan2(e.vy, e.vx || 1) * 0.15 : 0;
	ctx.save();
	ctx.translate(e.x + e.w / 2, e.y + e.h);
	ctx.rotate(lean + spin);
	ctx.translate(-(e.x + e.w / 2), -(e.y + e.h));
	if (e.flash > 0) ctx.globalAlpha = 0.55 + Math.sin(time * 50) * 0.2;

	ctx.fillStyle = 'rgba(0,0,0,0.25)';
	ctx.beginPath();
	ctx.ellipse(e.x + e.w / 2, e.y + e.h, e.w * 0.36, 3.2, 0, 0, Math.PI * 2);
	ctx.fill();

	if (e.tier === 'flyer') {
		ctx.strokeStyle = look.dark;
		ctx.lineWidth = 3;
		ctx.beginPath();
		const flap = Math.sin(time * 14 + e.anim) * 8;
		ctx.moveTo(e.x + e.w / 2, e.y + 12);
		ctx.lineTo(e.x - 10, e.y + flap);
		ctx.moveTo(e.x + e.w / 2, e.y + 12);
		ctx.lineTo(e.x + e.w + 10, e.y + flap);
		ctx.stroke();
	}

	ctx.fillStyle = look.dark;
	ctx.fillRect(e.x + 2, e.y + e.h * 0.42, e.w - 4, e.h * 0.5);
	ctx.fillStyle = look.body;
	roundRect(ctx, e.x + 4, e.y + e.h * 0.38, e.w - 8, e.h * 0.48, 4);
	ctx.fillStyle = look.skin;
	ctx.beginPath();
	ctx.arc(e.x + e.w / 2 + e.facing * 2, e.y + e.h * 0.28, e.tier === 'large' ? 11 : 7, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = '#1b1b1b';
	ctx.fillRect(e.x + e.w / 2 + e.facing * 3, e.y + e.h * 0.26, 2, 2);

	const arm = e.state === 'telegraph' ? -0.8 : (e.state === 'attack' || e.state === 'dive' ? 0.9 : 0.2);
	const hx = e.x + e.w / 2 + e.facing * (10 + arm * 16);
	const hy = e.y + e.h * 0.5 + (e.state === 'telegraph' ? -10 : 4);
	ctx.strokeStyle = look.metal;
	ctx.lineWidth = 2.4;
	ctx.beginPath();
	ctx.moveTo(e.x + e.w / 2, e.y + e.h * 0.48);
	ctx.lineTo(hx, hy);
	ctx.stroke();

	const pct = Math.max(0, e.hp / e.maxHp);
	ctx.fillStyle = 'rgba(0,0,0,0.55)';
	ctx.fillRect(e.x, e.y - 10, e.w, 4);
	ctx.fillStyle = pct > 0.4 ? '#d4544a' : '#ffb4a8';
	ctx.fillRect(e.x, e.y - 10, e.w * pct, 4);
	if (e.state === 'telegraph') {
		ctx.strokeStyle = 'rgba(255, 80, 60, 0.8)';
		ctx.strokeRect(e.x - 4, e.y - 4, e.w + 8, e.h + 8);
	}
	ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.arcTo(x + w, y, x + w, y + h, r);
	ctx.arcTo(x + w, y + h, x, y + h, r);
	ctx.arcTo(x, y + h, x, y, r);
	ctx.arcTo(x, y, x + w, y, r);
	ctx.closePath();
	ctx.fill();
}

function drawEffects(ctx, sim) {
	for (const r of sim.rings) {
		const u = 1 - r.life / r.max;
		ctx.strokeStyle = r.color;
		ctx.globalAlpha = 1 - u;
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.arc(r.x, r.y, 10 + u * 46, 0, Math.PI * 2);
		ctx.stroke();
		ctx.globalAlpha = 1;
	}
	for (const p of sim.particles) {
		ctx.globalAlpha = Math.max(0, p.life / p.max);
		ctx.fillStyle = p.color;
		ctx.fillRect(p.x, p.y, p.size, p.size);
	}
	ctx.globalAlpha = 1;
	ctx.font = 'bold 12px Georgia, serif';
	ctx.textAlign = 'center';
	for (const f of sim.floaters) {
		ctx.globalAlpha = Math.max(0, f.life * 2);
		ctx.fillStyle = f.color;
		ctx.fillText(f.text, f.x, f.y);
	}
	ctx.globalAlpha = 1;
}

function drawDebugPanel(ctx, sim, w, h) {
	const lines = debugLines(sim);
	ctx.fillStyle = 'rgba(8, 8, 12, 0.78)';
	ctx.fillRect(12, 12, 460, 18 + lines.length * 16);
	ctx.fillStyle = '#d7ffe4';
	ctx.font = '12px ui-monospace, Consolas, monospace';
	ctx.textAlign = 'left';
	lines.forEach((line, i) => ctx.fillText(line, 22, 32 + i * 16));
	void w;
	void h;
}

function clamp(v, a, b) {
	return Math.max(a, Math.min(b, v));
}
