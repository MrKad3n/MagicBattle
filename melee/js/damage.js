import { modifyDamage } from './hooks.js';

/**
 * Generic damage payload. Enemies and the player both consume this.
 * Spells can emit the same shape later.
 *
 * knockbackX is a speed (px/s) along `direction` (+1 right, -1 left).
 * knockbackY is a signed vertical speed. Negative is up.
 */
export function makeDamageEvent(partial) {
	const event = {
		source: null,
		target: null,
		amount: 0,
		direction: 1,
		knockbackX: 0,
		knockbackY: 0,
		knockbackDuration: 0.18,
		hitstun: 0.14,
		attackType: 'light',
		attackId: 0,
		attackName: '',
		poiseDamage: 0,
		hitstop: 0.03,
		sourceKind: 'melee',
		tags: ['physical'],
		...partial,
	};
	return modifyDamage(event);
}
