import { MOVEMENT } from './config.js';
import { modifyAttack } from './hooks.js';
import { applyHorizontal } from './physics.js';

/** Shared timing so gameplay phases and animation stay aligned. */
export function phaseInfo(def, timer, hitConfirmed) {
	const speed = def._speed || 1;
	const startup = def.startupTime / speed;
	const active = def.activeTime / speed;
	const cancel = (def.cancelWindow / speed) * (hitConfirmed ? 1 : (def.missCancelScale ?? 0.55));
	const recovery = (def.recoveryTime / speed) * (hitConfirmed ? (def.hitRecoveryScale ?? 0.8) : (def.missRecoveryScale ?? 1.26));
	const activeEnd = startup + active;
	const cancelStart = hitConfirmed ? startup + active * 0.72 : activeEnd;
	const cancelEnd = cancelStart + cancel;
	const end = Math.max(cancelEnd, activeEnd + recovery);
	const inActive = timer >= startup && timer < activeEnd;
	const inCancel = timer >= cancelStart && timer < cancelEnd && timer < end;
	let phase = 'recovery';
	if (timer >= end) phase = 'done';
	else if (timer < startup) phase = 'startup';
	else if (inActive) phase = 'active';
	else if (inCancel) phase = 'cancel';
	return {
		phase,
		cancellable: inCancel && phase !== 'done',
		startup,
		active,
		activeEnd,
		cancelStart,
		cancelEnd,
		end,
	};
}

export function selectAttackId(player, input) {
	const up = input.held('up') || input.axisY() < -0.4;
	const down = input.held('down') || input.axisY() > 0.4;
	const cur = player.combat.attack;
	const inAttack = player.state === 'attack' || player.state === 'airAttack';
	if (!player.onGround) {
		if (down) return 'down';
		if (up) return 'upAir';
		if (inAttack && cur?.aerial && cur.nextAttack) return cur.nextAttack;
		if (player.combat.pendingAir && player.combat.comboTimer > 0 && player.combat.pendingNext) {
			return player.combat.pendingNext;
		}
		return 'air1';
	}
	if (inAttack && cur) {
		if (up) return 'launcher';
		if (cur.nextAttack && !cur.aerial) return cur.nextAttack;
		return null;
	}
	if (up) return 'launcher';
	if (!player.combat.pendingAir && player.combat.comboTimer > 0 && player.combat.pendingNext) {
		return player.combat.pendingNext;
	}
	return 'g1';
}

export function resolveAttack(player, attackId) {
	const weapon = player.weapon;
	const base = weapon.attacks[attackId];
	if (!base) return null;
	const copy = structuredClone(base);
	copy._speed = weapon.attackSpeed || 1;
	return modifyAttack(copy, { player, weapon, attackId });
}

export function startAttack(player, sim, attackId, input = sim.input) {
	const def = resolveAttack(player, attackId);
	if (!def) return false;
	if (def.aerial && player.onGround) return false;
	player.combat.instanceId += 1;
	player.combat.hitTargets = new Set();
	player.combat.attack = def;
	player.combat.timer = 0;
	player.combat.hitConfirmed = false;
	player.combat.swung = false;
	player.combat.bounced = false;
	player.combat.queuedId = null;
	player.combat.info = phaseInfo(def, 0, false);
	player.combat.phase = 'startup';
	player.state = def.aerial ? 'airAttack' : 'attack';
	if (!player.combat.boost && Math.abs(player.vx) > 180) player.vx = Math.sign(player.vx) * 180;
	if (def.canTurn) faceInput(player, input);
	player.attackBuffer = 0;
	sim.events.emit('attackStart', { player, attack: def, sourceKind: 'melee' });
	return true;
}

function faceInput(player, input) {
	if (!input) return;
	if (input.held('left') && !input.held('right')) player.facing = -1;
	if (input.held('right') && !input.held('left')) player.facing = 1;
}

export function updateAttack(player, sim, input, dt) {
	const def = player.combat.attack;
	if (!def) {
		player.state = player.onGround ? 'idle' : 'fall';
		return;
	}
	player.combat.timer += dt;
	const info = phaseInfo(def, player.combat.timer, player.combat.hitConfirmed);
	player.combat.info = info;
	player.combat.phase = info.phase;

	if (!player.combat.swung && player.combat.timer >= info.startup) {
		player.combat.swung = true;
		sim.events.emit('attackSwing', { player, attack: def });
	}

	if (info.phase === 'startup' && def.canTurn) faceInput(player, input);

	if (def.id === 'down' && info.phase === 'active') {
		player.vy = def.diveSpeed || 560;
		player.vx = input.axisX() * 90;
	} else if (info.phase === 'active' && def.id !== 'down' && def.movementDistance > 0) {
		const speed = def.movementDistance / Math.max(0.04, def.activeTime);
		const boost = player.combat.boost || 0;
		player.vx = player.facing * speed + input.axisX() * 24 + boost * 0.35;
		if (player.combat.boost) player.combat.boost *= Math.exp(-12 * dt);
	} else if (info.phase === 'startup' && def.id !== 'down') {
		player.vx *= Math.exp(-8 * dt);
	} else if (info.cancellable) {
		const air = !player.onGround;
		applyHorizontal(player, input, dt, air ? 0.7 : 0.9, air);
	} else {
		const air = !player.onGround;
		applyHorizontal(player, input, dt, air ? 0.45 : 0.35, air);
		const max = air ? 290 : 310;
		if (Math.abs(player.vx) > max) {
			const extra = Math.abs(player.vx) - max;
			player.vx -= Math.sign(player.vx) * Math.min(extra, 2200 * dt);
		}
	}

	if (info.cancellable) tryAttackCancels(player, sim, input);

	if (player._wantsDash || player._wantsJumpCancel) return;
	if (player.combat.attack !== def) return;

	if (info.phase === 'done') finishAttack(player, sim, input);
}

function tryAttackCancels(player, sim, input) {
	const def = player.combat.attack;
	if (!def) return;
	if (def.canDashCancel && player.dashBuffer > 0 && player.dashCooldown <= 0 && player.actionLock <= 0) {
		player.dashBuffer = 0;
		player._wantsDash = true;
		return;
	}
	if (def.canJumpCancel && player.jumpBuffer > 0) {
		const allowed = player.combat.hitConfirmed || def.jumpCancelOnMiss;
		if (allowed && (player.onGround || player.coyote > 0)) {
			player._wantsJumpCancel = true;
			return;
		}
	}
	if (def.canAttackCancel && player.combat.queuedId) {
		const next = player.combat.queuedId;
		player.combat.queuedId = null;
		startAttack(player, sim, next);
	}
}

function finishAttack(player, sim, input) {
	const def = player.combat.attack;
	const hit = player.combat.hitConfirmed;
	if (def?.airFollowup && hit) {
		player.combat.pendingNext = def.airFollowup;
		player.combat.pendingAir = true;
		player.combat.comboTimer = MOVEMENT.comboResetHit;
		player.combat.combo = 0;
	} else if (def?.nextAttack) {
		player.combat.pendingNext = def.nextAttack;
		player.combat.pendingAir = !!def.aerial;
		player.combat.comboTimer = hit ? MOVEMENT.comboResetHit : MOVEMENT.comboResetMiss;
		player.combat.combo = (def.comboIndex ?? 0) + 1;
	} else {
		player.combat.pendingNext = null;
		player.combat.pendingAir = false;
		player.combat.combo = 0;
		player.combat.comboTimer = 0;
	}
	const queued = player.combat.queuedId;
	player.combat.attack = null;
	player.combat.info = null;
	player.combat.phase = null;
	player.combat.queuedId = null;
	player.combat.boost = 0;
	player.state = player.onGround ? 'idle' : 'fall';
	if (queued) startAttack(player, sim, queued, input);
}

export function noteAttackPress(player, input) {
	if (!(player.state === 'attack' || player.state === 'airAttack')) return;
	const id = selectAttackId(player, input);
	if (id) player.combat.queuedId = id;
}

export function onAttackHit(player, sim, attack, target) {
	if (!player.combat.hitConfirmed) {
		player.combat.hitConfirmed = true;
		player.combat.info = phaseInfo(attack, player.combat.timer, true);
	}
	if (attack.airFollowup) {
		player.combat.pendingNext = attack.airFollowup;
		player.combat.pendingAir = true;
		player.combat.comboTimer = Math.max(player.combat.comboTimer, MOVEMENT.comboResetHit);
	}
	sim.events.emit('attackHit', {
		player, attack, target, sourceKind: 'melee', amount: attack.damage,
	});
	if (attack.attackType === 'heavy' || attack.attackType === 'launcher' || attack.attackType === 'downward') {
		sim.events.emit('heavyHit', { player, attack, target });
		sim.events.emit('cameraImpulse', { mag: attack.attackType === 'heavy' ? 5 : 3.5, time: 0.12 });
	}
}

export function combatDebug(player) {
	const c = player.combat;
	return {
		attack: c.attack?.name || '—',
		id: c.attack?.id || '—',
		phase: c.phase || '—',
		timer: c.timer || 0,
		combo: c.combo || 0,
		cancel: !!c.info?.cancellable,
		hit: !!c.hitConfirmed,
		instance: c.instanceId,
	};
}
