/**
 * Extension points for systems that do not exist yet (spells, reinforcement,
 * runes, techniques). Melee never imports those systems.
 *
 * A future modifier receives an attack definition or a damage event and
 * returns a replacement object. Register during boot, not from combat code.
 */

const attackModifiers = [];
const damageModifiers = [];

export function registerAttackModifier(fn) {
	attackModifiers.push(fn);
	return () => {
		const i = attackModifiers.indexOf(fn);
		if (i >= 0) attackModifiers.splice(i, 1);
	};
}

export function registerDamageModifier(fn) {
	damageModifiers.push(fn);
	return () => {
		const i = damageModifiers.indexOf(fn);
		if (i >= 0) damageModifiers.splice(i, 1);
	};
}

export function modifyAttack(def, ctx) {
	let out = def;
	for (const fn of attackModifiers) {
		const next = fn(out, ctx);
		if (next) out = next;
	}
	return out;
}

export function modifyDamage(event) {
	let out = event;
	for (const fn of damageModifiers) {
		const next = fn(out);
		if (next) out = next;
	}
	return out;
}

export function clearModifiers() {
	attackModifiers.length = 0;
	damageModifiers.length = 0;
}
