export function overlap(a, b) {
	return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function expandRect(rect, pad) {
	return {
		x: rect.x - pad,
		y: rect.y - pad,
		w: rect.w + pad * 2,
		h: rect.h + pad * 2,
	};
}

export function pointInRect(x, y, rect) {
	return x >= rect.x && y >= rect.y && x <= rect.x + rect.w && y <= rect.y + rect.h;
}

/** True when the blade segment passes through the rectangle. */
export function segmentHitsRect(x1, y1, x2, y2, rect) {
	const steps = 7;
	for (let i = 0; i <= steps; i++) {
		const t = i / steps;
		const x = x1 + (x2 - x1) * t;
		const y = y1 + (y2 - y1) * t;
		if (pointInRect(x, y, rect)) return true;
	}
	return false;
}

export function playerHurtbox(player) {
	return {
		x: player.x + 3,
		y: player.y + 4,
		w: player.w - 6,
		h: player.h - 6,
	};
}

export function enemyHurtbox(enemy) {
	const p = enemy.hurtInset ?? 3;
	return {
		x: enemy.x + p,
		y: enemy.y + 2,
		w: Math.max(4, enemy.w - p * 2),
		h: Math.max(4, enemy.h - 4),
	};
}

export function enemyAttackBox(enemy) {
	const atk = enemy.attack;
	const w = atk.w;
	const h = atk.h;
	const x = enemy.facing >= 0 ? enemy.x + enemy.w - 6 : enemy.x - w + 6;
	return { x, y: enemy.y + atk.dy, w, h };
}

/**
 * Gameplay hit volume around the posed blade.
 * Active only while the caller decides the attack is in its active window.
 */
export function attackRect(player, attack) {
	const f = player.facing >= 0 ? 1 : -1;
	const cx = player.x + player.w / 2;
	const cy = player.y + player.h * 0.42;
	const w = attack.hitboxW ?? 54;
	const h = attack.hitboxH ?? 36;
	const ox = (attack.hitboxX ?? 22) * f;
	const oy = attack.hitboxY ?? 6;
	return {
		x: cx + ox - w / 2,
		y: cy + oy - h / 2,
		w,
		h,
	};
}
