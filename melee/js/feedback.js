/** Visual and camera responses to combat events. No final sound assets. */

export function attachFeedback(sim) {
	const on = (name, fn) => sim.events.on(name, fn);

	on('attackSwing', ({ player }) => {
		const r = player._rig;
		if (!r) return;
		spawn(sim, r.blade.x2, r.blade.y2, '#d7e2ee', 4, 70);
	});
	on('attackHit', ({ target, attack }) => {
		const heavy = attack.attackType === 'heavy' || attack.attackType === 'launcher' || attack.attackType === 'downward';
		spawn(sim, target.x + target.w / 2, target.y + target.h * 0.4, heavy ? '#ffe29a' : '#fff4d2', heavy ? 14 : 8, heavy ? 180 : 120);
	});
	on('enemyLaunch', ({ enemy }) => {
		spawn(sim, enemy.x + enemy.w / 2, enemy.y + enemy.h, '#c7ddff', 8, 90);
	});
	on('parry', ({ player }) => {
		sim.rings.push({ x: player.x + player.w / 2, y: player.y + player.h * 0.45, r: 8, life: 0.22, max: 0.22, color: '#9ad7ff' });
		spawn(sim, player.x + player.w / 2, player.y + 20, '#bfe7ff', 12, 160);
	});
	on('dash', ({ player }) => {
		spawn(sim, player.x + player.w / 2, player.y + player.h * 0.6, '#c5d4ea', 6, 40);
	});
	on('land', ({ player }) => {
		spawn(sim, player.x + player.w / 2, player.y + player.h, '#8a8178', 6, 50);
	});
	on('playerHit', ({ player }) => {
		spawn(sim, player.x + player.w / 2, player.y + 24, '#ff9a9a', 10, 140);
	});
	on('cameraImpulse', ({ mag, time }) => {
		sim.camera.mag = Math.max(sim.camera.mag, mag || 2);
		sim.camera.shake = Math.max(sim.camera.shake, time || 0.08);
	});
}

export function spawn(sim, x, y, color, n, speed) {
	for (let i = 0; i < n; i++) {
		const a = Math.random() * Math.PI * 2;
		const s = speed * (0.35 + Math.random() * 0.75);
		sim.particles.push({
			x, y,
			vx: Math.cos(a) * s,
			vy: Math.sin(a) * s - 20,
			life: 0.18 + Math.random() * 0.22,
			max: 0.4,
			color,
			size: 1.5 + Math.random() * 1.8,
		});
	}
	if (sim.particles.length > 350) sim.particles.splice(0, sim.particles.length - 350);
}

export function updateEffects(sim, dt) {
	for (let i = sim.particles.length - 1; i >= 0; i--) {
		const p = sim.particles[i];
		p.life -= dt;
		p.x += p.vx * dt;
		p.y += p.vy * dt;
		p.vy += 420 * dt;
		if (p.life <= 0) sim.particles.splice(i, 1);
	}
	for (let i = sim.floaters.length - 1; i >= 0; i--) {
		const f = sim.floaters[i];
		f.life -= dt;
		f.y -= 28 * dt;
		if (f.life <= 0) sim.floaters.splice(i, 1);
	}
	for (let i = sim.rings.length - 1; i >= 0; i--) {
		sim.rings[i].life -= dt;
		if (sim.rings[i].life <= 0) sim.rings.splice(i, 1);
	}
	if (sim.camera.shake > 0) {
		sim.camera.shake -= dt;
		if (sim.camera.shake <= 0) sim.camera.mag = 0;
	}
}
