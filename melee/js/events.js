/** Tiny event bus. Combat emits; audio, VFX, and camera subscribe. */

export function createEvents() {
	const map = new Map();
	return {
		on(name, fn) {
			if (!map.has(name)) map.set(name, new Set());
			map.get(name).add(fn);
			return () => map.get(name)?.delete(fn);
		},
		emit(name, payload) {
			const set = map.get(name);
			if (!set) return;
			for (const fn of set) fn(payload);
		},
	};
}

/**
 * Event names the melee layer emits. Future magic, audio, and camera
 * code can listen without the combat controller knowing about them.
 *
 * attackStart, attackSwing, attackHit, heavyHit,
 * enemyStagger, enemyLaunch, enemyKnockdown,
 * playerHit, dash, land, jump, parry, parryFail, death, cameraImpulse
 */
export const COMBAT_EVENTS = [
	'attackStart',
	'attackSwing',
	'attackHit',
	'heavyHit',
	'enemyStagger',
	'enemyLaunch',
	'enemyKnockdown',
	'playerHit',
	'dash',
	'land',
	'jump',
	'parry',
	'parryFail',
	'death',
	'cameraImpulse',
];
