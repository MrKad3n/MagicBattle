import { PARRY } from './config.js';

export function parryActive(player) {
	if (player.state !== 'parry' || player.parrySuccess) return false;
	const t = player.parryT;
	return t >= PARRY.startup && t < PARRY.startup + PARRY.active;
}

export function canParry(player) {
	if (player.actionLock > 0) return false;
	if (player.state === 'death' || player.state === 'hit' || player.state === 'knockback' || player.state === 'stunned') return false;
	if (player.state === 'dash') return false;
	if (player.state === 'attack' || player.state === 'airAttack') return false;
	return true;
}

export function startParry(player, sim) {
	if (!canParry(player)) return false;
	player.state = 'parry';
	player.parryT = 0;
	player.parrySuccess = false;
	player.parryBuffer = 0;
	player.vx *= 0.35;
	sim.events.emit('parryAttempt', { player });
	return true;
}

export function updateParry(player, sim, dt) {
	player.parryT += dt;
	player.vx *= Math.exp(-10 * dt);
	if (player.parrySuccess) {
		if (player.parryT >= PARRY.successLock) {
			player.state = player.onGround ? 'idle' : 'fall';
		}
		return;
	}
	const total = PARRY.startup + PARRY.active + PARRY.recovery;
	if (player.parryT >= PARRY.startup + PARRY.active && !player.parryWhiffed) {
		player.parryWhiffed = true;
		sim.events.emit('parryFail', { player });
	}
	if (player.parryT >= total) {
		player.state = player.onGround ? 'idle' : 'fall';
		player.parryWhiffed = false;
	}
}

export function succeedParry(player, sim, enemy) {
	player.parrySuccess = true;
	player.parryT = 0;
	player.iframes = Math.max(player.iframes, PARRY.successIframes);
	player.parryWhiffed = false;
	sim.events.emit('parry', { player, enemy });
	sim.events.emit('cameraImpulse', { mag: 4.5, time: 0.1 });
	sim.hitstop = Math.max(sim.hitstop, 0.055);
}
