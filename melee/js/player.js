import { MOVEMENT, PLAYER } from './config.js';
import { getWeapon } from './weapons.js';
import { makeDamageEvent } from './damage.js';
import {
	applyGravity, applyHorizontal, integrate, jumpCut, refreshCoyote, tryJump,
} from './physics.js';
import {
	noteAttackPress, selectAttackId, startAttack,
	updateAttack,
} from './combat.js';
import { endDash, startDash, updateDash, wantsDash } from './dash.js';
import { canParry, startParry, updateParry } from './parry.js';

export function createPlayer(x, y) {
	return {
		x, y,
		w: PLAYER.width,
		h: PLAYER.height,
		vx: 0,
		vy: 0,
		facing: 1,
		onGround: true,
		coyote: MOVEMENT.coyoteTime,
		jumpBuffer: 0,
		attackBuffer: 0,
		dashBuffer: 0,
		parryBuffer: 0,
		jumpHeld: false,
		_jumped: false,
		state: 'idle',
		hp: PLAYER.maxHp,
		maxHp: PLAYER.maxHp,
		iframes: 0,
		hitstun: 0,
		actionLock: 0,
		dashCooldown: 0,
		dashT: 0,
		dashDir: 1,
		dashVy: 0,
		dropTimer: 0,
		squash: 0,
		runPhase: 0,
		hurtFlash: 0,
		trail: [],
		weapon: getWeapon('sword'),
		combat: emptyCombat(),
		parryT: 0,
		parrySuccess: false,
		parryWhiffed: false,
		deathT: 0,
		_wantsDash: false,
		_wantsJumpCancel: false,
		_wantsAttackFromDash: false,
	};
}

function emptyCombat() {
	return {
		attack: null,
		timer: 0,
		phase: null,
		info: null,
		combo: 0,
		comboTimer: 0,
		hitConfirmed: false,
		instanceId: 0,
		hitTargets: new Set(),
		queuedId: null,
		pendingNext: null,
		pendingAir: false,
		swung: false,
		bounced: false,
		boost: 0,
	};
}

export function captureBuffers(player, input, dt, frozen) {
	if (input.pressed('jump')) player.jumpBuffer = MOVEMENT.jumpBufferTime;
	else if (!frozen) player.jumpBuffer = Math.max(0, player.jumpBuffer - dt);

	if (input.pressed('attack')) {
		player.attackBuffer = MOVEMENT.attackBufferTime;
		noteAttackPress(player, input);
	} else if (!frozen) player.attackBuffer = Math.max(0, player.attackBuffer - dt);

	if (input.pressed('dash')) player.dashBuffer = 0.1;
	else if (!frozen) player.dashBuffer = Math.max(0, player.dashBuffer - dt);

	if (input.pressed('parry')) player.parryBuffer = 0.1;
	else if (!frozen) player.parryBuffer = Math.max(0, player.parryBuffer - dt);
}

export function updatePlayer(player, sim, input, dt) {
	sim.input = input;
	player.iframes = Math.max(0, player.iframes - dt);
	player.dashCooldown = Math.max(0, player.dashCooldown - dt);
	player.actionLock = Math.max(0, player.actionLock - dt);
	player.dropTimer = Math.max(0, player.dropTimer - dt);
	player.hurtFlash = Math.max(0, player.hurtFlash - dt);
	player.squash = Math.max(0, player.squash - dt * 5);
	player._wantsDash = false;
	player._wantsJumpCancel = false;
	player._wantsAttackFromDash = false;

	if (player.state !== 'attack' && player.state !== 'airAttack') {
		if (player.combat.comboTimer > 0) {
			player.combat.comboTimer -= dt;
			if (player.combat.comboTimer <= 0) {
				player.combat.pendingNext = null;
				player.combat.pendingAir = false;
				player.combat.combo = 0;
			}
		}
	}

	if (player.state === 'death') {
		player.deathT += dt;
		player.vy += MOVEMENT.gravity * dt;
		integrate(player, sim.solids, dt);
		return;
	}

	const wasGround = player.onGround;
	const impactVy = player.vy;

	switch (player.state) {
		case 'dash':
			updateDash(player, sim, input, dt);
			break;
		case 'parry':
			updateParry(player, sim, dt);
			break;
		case 'hit':
		case 'stunned':
		case 'knockback':
			player.hitstun -= dt;
			player.vx *= Math.exp((player.state === 'knockback' ? -2.2 : -4) * dt);
			if (player.hitstun <= 0) player.state = player.onGround ? 'idle' : 'fall';
			break;
		case 'attack':
		case 'airAttack':
			updateAttack(player, sim, input, dt);
			break;
		default:
			updateFree(player, sim, input, dt);
			break;
	}

	resolveActionFlags(player, sim, input);
	if (player.state === 'attack' || player.state === 'airAttack') applyAttackGravity(player, input, dt);
	else if (player.state !== 'dash') applyGravity(player, input, dt, 1);
	if (player.state !== 'dash') jumpCut(player, input);

	integrate(player, sim.solids, dt);
	refreshCoyote(player, wasGround, dt);

	if (!wasGround && player.onGround) {
		if (impactVy > 140) {
			player.squash = Math.min(1, impactVy / 900);
			sim.events.emit('land', { player, impact: impactVy });
		}
	}

	if (player.jumpBuffer > 0 && player.onGround && canUseFreeJump(player)) {
		if (tryJump(player, input)) {
			player.state = 'jump';
			sim.events.emit('jump', { player });
		}
	}

	faceFree(player, input);
	if (player.onGround && Math.abs(player.vx) > 40 && isLocomotion(player.state)) {
		const prev = player.runPhase;
		player.runPhase += Math.abs(player.vx) * dt * 0.045;
		if (Math.floor(prev / Math.PI) !== Math.floor(player.runPhase / Math.PI)) {
			sim.events.emit('footstep', { player });
		}
	}
	if (isLocomotion(player.state)) {
		if (!player.onGround && player.vy < 0) player.state = 'jump';
		else if (!player.onGround) player.state = 'fall';
		else if (Math.abs(player.vx) > 28) player.state = 'run';
		else player.state = 'idle';
	}

	if (player.state === 'dash') {
		player.trail.push({ x: player.x, y: player.y, facing: player.facing, life: 0.12 });
	}
	for (let i = player.trail.length - 1; i >= 0; i--) {
		player.trail[i].life -= dt;
		if (player.trail[i].life <= 0) player.trail.splice(i, 1);
	}

	if (player.hp <= 0 && player.state !== 'death') {
		player.hp = 0;
		player.state = 'death';
		player.deathT = 0;
		player.combat.attack = null;
		sim.events.emit('death', { player });
	}
}

function applyAttackGravity(player, input, dt) {
	const id = player.combat.attack?.id;
	const phase = player.combat.phase;
	if (id === 'down' && (phase === 'startup' || phase === 'active')) {
		if (phase === 'startup') applyGravity(player, input, dt, 0.35);
		return;
	}
	if (!player.onGround && (phase === 'startup' || phase === 'active')) {
		applyGravity(player, input, dt, 0.48);
		return;
	}
	applyGravity(player, input, dt, 1);
}

function updateFree(player, sim, input, dt) {
	if (input.pressed('jump') && input.held('down') && player.onGround) {
		player.dropTimer = 0.18;
		player.jumpBuffer = 0;
	} else if (tryJump(player, input)) {
		player.state = 'jump';
		sim.events.emit('jump', { player });
	}
	if (player.parryBuffer > 0 && canParry(player)) {
		player.parryBuffer = 0;
		startParry(player, sim);
		return;
	}
	if (wantsDash(player)) {
		player.dashBuffer = 0;
		if (startDash(player, sim, input)) return;
	}
	if (player.attackBuffer > 0 && player.actionLock <= 0) {
		const id = selectAttackId(player, input);
		if (id && startAttack(player, sim, id, input)) {
			player.attackBuffer = 0;
			return;
		}
	}
	applyHorizontal(player, input, dt, 1, !player.onGround);
}

function resolveActionFlags(player, sim, input) {
	if (player._wantsDash) {
		player._wantsDash = false;
		startDash(player, sim, input);
		return;
	}
	if (player._wantsJumpCancel) {
		player._wantsJumpCancel = false;
		if (tryJump(player, input)) {
			clearAttack(player);
			player.state = 'jump';
			sim.events.emit('jump', { player });
		}
		return;
	}
	if (player._wantsAttackFromDash) {
		player._wantsAttackFromDash = false;
		const keep = player.vx * 0.5;
		endDash(player);
		const id = selectAttackId(player, input);
		if (id && startAttack(player, sim, id, input)) {
			player.combat.boost = keep;
			player.attackBuffer = 0;
		}
	}
}

function canUseFreeJump(player) {
	return player.state === 'idle' || player.state === 'run' || player.state === 'jump' || player.state === 'fall';
}

function isLocomotion(state) {
	return state === 'idle' || state === 'run' || state === 'jump' || state === 'fall';
}

function faceFree(player, input) {
	if (!isLocomotion(player.state)) return;
	if (input.held('left') && !input.held('right')) player.facing = -1;
	if (input.held('right') && !input.held('left')) player.facing = 1;
}

function clearAttack(player) {
	player.combat.attack = null;
	player.combat.info = null;
	player.combat.phase = null;
	player.combat.queuedId = null;
	player.combat.boost = 0;
}

export function hurtPlayer(player, event, sim) {
	if (player.state === 'death') return false;
	if (player.iframes > 0) return false;
	player.hp -= event.amount;
	player.hurtFlash = 0.14;
	player.iframes = PLAYER.hurtIframes;
	player.hitstun = event.hitstun ?? 0.16;
	player.vx = event.direction * Math.max(90, event.knockbackX * 0.55);
	player.vy = event.knockbackY ?? -120;
	player.onGround = false;
	clearAttack(player);
	player.state = player.hitstun >= 0.22 || event.knockbackX > 300 ? 'knockback' : 'hit';
	sim.events.emit('playerHit', { player, event });
	sim.events.emit('cameraImpulse', { mag: 6, time: 0.14 });
	sim.hitstop = Math.max(sim.hitstop, Math.min(0.05, event.hitstop || 0.03));
	sim.floaters.push({
		x: player.x + player.w / 2,
		y: player.y,
		text: String(Math.round(event.amount)),
		life: 0.6,
		color: '#ff8d8d',
	});
	if (player.hp <= 0) {
		player.hp = 0;
		player.state = 'death';
		player.deathT = 0;
		sim.events.emit('death', { player });
	}
	return true;
}

export function playerDamageFromAttack(player, attack, target) {
	return makeDamageEvent({
		source: player,
		target,
		amount: attack.damage,
		direction: player.facing,
		knockbackX: attack.knockbackX,
		knockbackY: attack.knockbackY,
		knockbackDuration: attack.knockbackDuration,
		hitstun: attack.hitstun,
		attackType: attack.attackType,
		attackId: player.combat.instanceId,
		attackName: attack.name,
		poiseDamage: attack.poiseDamage,
		hitstop: attack.hitstop,
		sourceKind: 'melee',
		tags: attack.tags || ['physical', 'melee'],
	});
}
