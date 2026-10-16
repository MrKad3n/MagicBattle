import { attackRect, enemyAttackBox, enemyHurtbox, playerHurtbox } from './hitbox.js';
import { combatDebug } from './combat.js';
import { zoneAt } from './arena.js';

export function drawDebugWorld(ctx, sim) {
	const p = sim.player;
	ctx.save();
	ctx.lineWidth = 1;
	rect(ctx, p, '#7dffb2');
	rect(ctx, playerHurtbox(p), '#ffe66b');
	if (p._rig && p.combat.attack && (p.combat.phase === 'active' || p.combat.phase === 'startup')) {
		const b = p._rig.blade;
		ctx.strokeStyle = '#ff4d4d';
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(b.x1, b.y1);
		ctx.lineTo(b.x2, b.y2);
		ctx.stroke();
		if (p.combat.phase === 'active') rect(ctx, attackRect(p, p.combat.attack), 'rgba(255,70,70,0.9)');
	}
	for (const e of sim.enemies) {
		if (e.dead) continue;
		rect(ctx, enemyHurtbox(e), '#ff9a3c');
		if (e.state === 'attack' || e.state === 'dive' || e.state === 'telegraph') {
			rect(ctx, enemyAttackBox(e), e.state === 'telegraph' ? 'rgba(255,80,80,0.35)' : '#ff4de1');
		}
	}
	ctx.restore();
}

function rect(ctx, r, color) {
	ctx.strokeStyle = color;
	ctx.strokeRect(r.x, r.y, r.w, r.h);
}

export function debugLines(sim) {
	const p = sim.player;
	const c = combatDebug(p);
	const zone = zoneAt(p.x);
	return [
		`state ${p.state}    facing ${p.facing > 0 ? 'right' : 'left'}`,
		`attack ${c.attack} (${c.id})  phase ${c.phase}`,
		`timer ${c.timer.toFixed(3)}  combo ${c.combo}  cancel ${c.cancel ? 'yes' : 'no'}  hit ${c.hit ? 'yes' : 'no'}`,
		`instance ${c.instance}  hitstop ${sim.hitstop.toFixed(3)}`,
		`dash ${p.state === 'dash' ? 'active' : 'ready'}  cd ${p.dashCooldown.toFixed(2)}  lock ${p.actionLock.toFixed(2)}`,
		`vel ${p.vx.toFixed(0)}, ${p.vy.toFixed(0)}  ground ${p.onGround ? 'yes' : 'no'}  coyote ${p.coyote.toFixed(2)}`,
		`hp ${Math.ceil(p.hp)}  weapon ${p.weapon.name}  zone ${zone.name}`,
	];
}
