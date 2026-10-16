import { SWORD_ATTACKS } from './attacks.js';

/**
 * Weapons own their attack set. The player controller only asks the
 * equipped weapon which attack to run.
 *
 * Future weapons (dagger, spear, great weapon, staff, fists) add a
 * record here. They should not require movement changes.
 */
export const WEAPONS = {
	sword: {
		id: 'sword',
		name: 'Arming Sword',
		type: 'sword',
		reach: 58,
		attackSpeed: 1,
		attacks: SWORD_ATTACKS,
	},
};

export function getWeapon(id) {
	return WEAPONS[id] || WEAPONS.sword;
}
