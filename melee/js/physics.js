import { MOVEMENT } from './config.js';

export function overlapBody(a, b) {
	return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/**
 * Move a body and resolve it against solid rectangles.
 * oneWay platforms land only when falling onto their top.
 * body.dropTimer > 0 ignores one-way platforms.
 */
export function integrate(body, solids, dt) {
	const dist = Math.hypot(body.vx, body.vy) * dt;
	const steps = Math.max(1, Math.ceil(dist / 10));
	const sub = dt / steps;
	for (let i = 0; i < steps; i++) moveOnce(body, solids, sub);
	stickToGround(body, solids);
}

function stickToGround(body, solids) {
	if (body.onGround || body.vy < 0 || body.dropTimer > 0) return;
	const feet = body.y + body.h;
	for (const s of solids) {
		if (body.x + 2 >= s.x + s.w || body.x + body.w - 2 <= s.x) continue;
		if (feet >= s.y - 0.2 && feet <= s.y + 2.5) {
			body.y = s.y - body.h;
			body.vy = 0;
			body.onGround = true;
			return;
		}
	}
}

function moveOnce(body, solids, dt) {
	const prevBottom = body.y + body.h;
	body.x += body.vx * dt;
	for (const s of solids) {
		if (s.oneWay) continue;
		if (!overlapBody(body, s)) continue;
		if (body.vx > 0) body.x = s.x - body.w;
		else if (body.vx < 0) body.x = s.x + s.w;
		else {
			const pushRight = (s.x + s.w) - body.x;
			const pushLeft = (body.x + body.w) - s.x;
			if (pushLeft < pushRight) body.x = s.x - body.w;
			else body.x = s.x + s.w;
		}
		body.vx = 0;
	}

	body.y += body.vy * dt;
	body.onGround = false;
	for (const s of solids) {
		if (!overlapBody(body, s)) continue;
		if (s.oneWay) {
			if (body.dropTimer > 0) continue;
			const feet = body.y + body.h;
			const landing = body.vy >= 0 && prevBottom <= s.y + 1.5 && feet >= s.y;
			if (!landing) continue;
			body.y = s.y - body.h;
			body.vy = 0;
			body.onGround = true;
			continue;
		}
		if (body.vy > 0) {
			body.y = s.y - body.h;
			body.vy = 0;
			body.onGround = true;
		} else if (body.vy < 0) {
			body.y = s.y + s.h;
			body.vy = 0;
		} else {
			body.y = prevBottom - body.h;
		}
	}
}

/**
 * Horizontal acceleration. controlScale is 0..1 so cancels and recovery
 * can give back a fraction of normal control.
 */
export function applyHorizontal(body, input, dt, controlScale, airborne) {
	const axis = input.axisX();
	const max = airborne ? MOVEMENT.maxAirSpeed : MOVEMENT.maxGroundSpeed;
	const accel = (airborne ? MOVEMENT.airAccel : MOVEMENT.groundAccel) * controlScale;
	const decel = (airborne ? MOVEMENT.airDecel : MOVEMENT.groundDecel) * Math.max(0.4, controlScale);
	if (axis !== 0) {
		const turning = Math.abs(body.vx) > 15 && Math.sign(body.vx) !== axis;
		const a = turning ? Math.max(accel, MOVEMENT.turnAccel * controlScale) : accel;
		body.vx += axis * a * dt;
		if (Math.abs(body.vx) > max && Math.sign(body.vx) === axis) {
			const extra = Math.abs(body.vx) - max;
			body.vx -= Math.sign(body.vx) * Math.min(extra, decel * dt);
		}
	} else {
		const step = decel * dt;
		if (Math.abs(body.vx) <= step) body.vx = 0;
		else body.vx -= Math.sign(body.vx) * step;
	}
}

export function applyGravity(body, input, dt, scale = 1) {
	let g = MOVEMENT.gravity * scale;
	const diving = body.state === 'airAttack' && body.combat?.attack?.id === 'down' && body.combat?.phase !== 'done';
	if (!diving && input && input.axisY() > 0.4 && body.vy > 40 && !body.onGround && body.state !== 'dash') {
		g = MOVEMENT.fastFallGravity;
	}
	body.vy += g * dt;
	if (body.vy > MOVEMENT.maxFallSpeed) body.vy = MOVEMENT.maxFallSpeed;
}

export function tryJump(player, input) {
	if (player.jumpBuffer <= 0) return false;
	if (!(player.onGround || player.coyote > 0)) return false;
	if (!canJumpNow(player)) return false;
	player.vy = MOVEMENT.jumpVelocity;
	player.onGround = false;
	player.coyote = 0;
	player.jumpBuffer = 0;
	player.jumpHeld = true;
	player._jumped = true;
	player.landed = false;
	return true;
}

export function canJumpNow(player) {
	if (player.state === 'death' || player.state === 'hit' || player.state === 'knockback' || player.state === 'stunned') return false;
	if (player.state === 'parry') return false;
	if (player.state === 'dash') return false;
	if (player.state === 'attack' || player.state === 'airAttack') {
		const atk = player.combat.attack;
		const info = player.combat.info;
		if (!atk || !info?.cancellable || !atk.canJumpCancel) return false;
		if (!player.combat.hitConfirmed && !atk.jumpCancelOnMiss) return false;
		return true;
	}
	return true;
}

export function jumpCut(player, input) {
	if (player.jumpHeld && !input.held('jump') && player.vy < 0 && player.state !== 'dash') {
		player.vy *= MOVEMENT.jumpCutMultiplier;
		player.jumpHeld = false;
	}
}

export function refreshCoyote(player, wasGround, dt) {
	if (player.onGround) {
		player.coyote = MOVEMENT.coyoteTime;
		player._jumped = false;
		return;
	}
	if (wasGround && !player._jumped) player.coyote = MOVEMENT.coyoteTime;
	else player.coyote = Math.max(0, player.coyote - dt);
}
