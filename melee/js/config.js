/**
 * Tunable movement, dash, and parry numbers.
 * Combat designers can change feel here without touching controllers.
 * Times are in seconds. Distances are in pixels. Speeds are pixels per second.
 */

export const MOVEMENT = {
	groundAccel: 2400,
	groundDecel: 3400,
	maxGroundSpeed: 310,
	airAccel: 1750,
	airDecel: 520,
	maxAirSpeed: 290,
	turnAccel: 4600,
	gravity: 1680,
	fastFallGravity: 2900,
	maxFallSpeed: 880,
	jumpVelocity: -680,
	jumpCutMultiplier: 0.46,
	coyoteTime: 0.1,
	jumpBufferTime: 0.12,
	attackBufferTime: 0.14,
	/** How long a queued combo press stays valid after the attack ends. */
	comboResetHit: 0.42,
	comboResetMiss: 0.26,
};

export const DASH = {
	speed: 880,
	duration: 0.15,
	cooldown: 0.46,
	iframeTime: 0.11,
	/** Earliest time a dash can be canceled into an attack. */
	attackCancelTime: 0.045,
	verticalSpeed: 460,
	/** Horizontal speed kept when the dash ends. */
	endSpeedRetain: 0.42,
};

export const PARRY = {
	startup: 0.03,
	active: 0.12,
	recovery: 0.18,
	/** Control returns this soon after a successful parry. */
	successLock: 0.05,
	enemyStagger: 0.62,
	successIframes: 0.22,
};

export const HITSTOP_CAP = 0.09;

export const PLAYER = {
	width: 22,
	height: 56,
	maxHp: 100,
	hurtIframes: 0.48,
};
