import { DASH } from './config.js';

export function wantsDash(player) {
	return player.dashBuffer > 0 && player.dashCooldown <= 0 && player.actionLock <= 0 && canDash(player);
}

export function canDash(player) {
	if (player.state === 'death' || player.state === 'hit' || player.state === 'knockback' || player.state === 'stunned') return false;
	if (player.state === 'parry') return false;
	if (player.state === 'attack' || player.state === 'airAttack') {
		return !!(player.combat.info?.cancellable && player.combat.attack?.canDashCancel);
	}
	return player.state === 'idle' || player.state === 'run' || player.state === 'jump' || player.state === 'fall' || player.state === 'dash';
}

export function startDash(player, sim, input) {
	if (!canDash(player) || player.dashCooldown > 0 || player.actionLock > 0) return false;
	const axis = input.axisX();
	const dir = axis !== 0 ? Math.sign(axis) : player.facing;
	player.facing = dir >= 0 ? 1 : -1;
	player.state = 'dash';
	player.dashT = 0;
	player.dashDir = player.facing;
	player.dashVy = 0;
	if (input.axisY() < -0.4) player.dashVy = -DASH.verticalSpeed;
	else if (input.axisY() > 0.4 && !player.onGround) player.dashVy = DASH.verticalSpeed;
	player.vx = player.dashDir * DASH.speed;
	player.vy = player.dashVy;
	player.dashCooldown = DASH.cooldown;
	player.dashBuffer = 0;
	player.iframes = Math.max(player.iframes, DASH.iframeTime);
	player.combat.attack = null;
	player.combat.info = null;
	player.combat.queuedId = null;
	player.combat.boost = 0;
	if (player.dashVy !== 0) player.onGround = false;
	sim.events.emit('dash', { player, direction: player.dashDir });
	sim.events.emit('cameraImpulse', { mag: 1.5, time: 0.08 });
	return true;
}

export function updateDash(player, sim, input, dt) {
	player.dashT += dt;
	player.vx = player.dashDir * DASH.speed;
	if (player.dashVy !== 0) player.vy = player.dashVy;
	else player.vy = 0;
	player.iframes = Math.max(player.iframes, Math.max(0, DASH.iframeTime - player.dashT));

	if (player.dashT >= DASH.attackCancelTime && player.attackBuffer > 0) {
		player._wantsAttackFromDash = true;
		return;
	}
	if (player.dashT >= DASH.duration) endDash(player);
}

export function endDash(player) {
	const keep = DASH.speed * DASH.endSpeedRetain;
	player.vx = player.dashDir * Math.min(keep, Math.abs(player.vx));
	player.dashVy = 0;
	if (player.vy < 0) player.vy *= 0.45;
	player.state = player.onGround ? 'idle' : 'fall';
}
