import { makeDamageEvent } from './damage.js';
import { PARRY } from './config.js';

let nextId = 1;

const TIERS = {
	small: {
		hp: 36, poise: 8, poiseRegen: 6, speed: 95,
		w: 26, h: 40, hurtInset: 2,
		resistKnockback: 0.05, resistLaunch: false, ignoreMinorHitstun: false,
		attack: { w: 34, h: 22, dy: 12, active: 0.1, telegraph: 0.28, recover: 0.38, damage: 8, knockbackX: 220, knockbackY: -80, lunge: 240 },
		aggro: 340, range: 48,
	},
	medium: {
		hp: 78, poise: 20, poiseRegen: 5, speed: 68,
		w: 34, h: 56, hurtInset: 3,
		resistKnockback: 0.35, resistLaunch: false, ignoreMinorHitstun: false,
		attack: { w: 42, h: 26, dy: 16, active: 0.11, telegraph: 0.36, recover: 0.46, damage: 12, knockbackX: 280, knockbackY: -60, lunge: 160 },
		aggro: 380, range: 58,
	},
	large: {
		hp: 170, poise: 40, poiseRegen: 4, speed: 42,
		w: 52, h: 76, hurtInset: 4,
		resistKnockback: 0.72, resistLaunch: true, ignoreMinorHitstun: true,
		attack: { w: 58, h: 34, dy: 22, active: 0.13, telegraph: 0.5, recover: 0.55, damage: 16, knockbackX: 340, knockbackY: -40, lunge: 90 },
		aggro: 400, range: 72,
	},
	boss: {
		hp: 280, poise: 70, poiseRegen: 8, speed: 36,
		w: 64, h: 86, hurtInset: 4,
		resistKnockback: 0.9, resistLaunch: true, ignoreMinorHitstun: true,
		launchOnBreak: false,
		attack: { w: 70, h: 36, dy: 26, active: 0.12, telegraph: 0.55, recover: 0.6, damage: 18, knockbackX: 360, knockbackY: -20, lunge: 70 },
		aggro: 460, range: 80,
	},
	flyer: {
		hp: 42, poise: 7, poiseRegen: 6, speed: 80,
		w: 30, h: 28, hurtInset: 2,
		resistKnockback: 0.1, resistLaunch: false, ignoreMinorHitstun: false,
		attack: { w: 28, h: 22, dy: 4, active: 0.18, telegraph: 0.32, recover: 0.4, damage: 9, knockbackX: 160, knockbackY: 40, lunge: 0 },
		aggro: 400, range: 70,
	},
};

export function createEnemy(opts) {
	const tier = opts.tier || 'small';
	const base = TIERS[tier] || TIERS.small;
	const enemy = {
		id: nextId++,
		name: opts.name || tier,
		tier,
		x: opts.x, y: opts.y,
		w: opts.w || base.w,
		h: opts.h || base.h,
		vx: 0, vy: 0, onGround: false,
		facing: opts.facing || -1,
		hp: opts.hp || base.hp,
		maxHp: opts.hp || base.hp,
		poise: base.poise,
		maxPoise: base.poise,
		poiseRegen: base.poiseRegen,
		speed: base.speed,
		resistKnockback: base.resistKnockback,
		resistLaunch: base.resistLaunch,
		ignoreMinorHitstun: base.ignoreMinorHitstun,
		launchOnBreak: base.launchOnBreak ?? false,
		hurtInset: base.hurtInset,
		attack: { ...base.attack },
		aggro: base.aggro,
		range: base.range,
		state: 'idle',
		stateT: 0,
		attackCd: 0.4 + Math.random() * 0.6,
		anim: Math.random() * 4,
		flash: 0,
		reaction: '',
		dead: false,
		respawn: 0,
		swingId: 0,
		didHit: false,
		homeX: opts.x,
		homeY: opts.y,
		patrol: opts.patrol ?? 70,
		patrolDir: opts.facing || 1,
		dropTimer: 0,
	};
	return enemy;
}

export function updateEnemy(enemy, sim, dt) {
	if (enemy.dead) {
		enemy.respawn -= dt;
		if (enemy.respawn <= 0) revive(enemy);
		return;
	}
	enemy.anim += dt;
	enemy.attackCd = Math.max(0, enemy.attackCd - dt);
	enemy.flash = Math.max(0, enemy.flash - dt);
	const locked = enemy.state === 'stagger' || enemy.state === 'hit' || enemy.state === 'knockdown' || enemy.state === 'launch';
	if (!locked && enemy.poise < enemy.maxPoise) {
		enemy.poise = Math.min(enemy.maxPoise, enemy.poise + enemy.poiseRegen * dt);
	}

	if (enemy.state === 'hit' || enemy.state === 'stagger' || enemy.state === 'knockdown') {
		enemy.stateT -= dt;
		enemy.vx *= Math.exp(-7 * dt);
		if (enemy.stateT <= 0) enemy.state = 'chase';
	} else if (enemy.state === 'launch') {
		if (enemy.onGround && enemy.vy >= 0 && enemy.stateT < 0) {
			enemy.state = 'knockdown';
			enemy.stateT = 0.42;
			enemy.vx *= 0.25;
		}
	} else {
		runAI(enemy, sim, dt);
	}

	const flying = enemy.tier === 'flyer' && enemy.state !== 'launch' && enemy.state !== 'knockdown' && enemy.state !== 'hit' && enemy.state !== 'stagger';
	if (!flying) {
		enemy.vy += 1700 * dt;
		if (enemy.vy > 900) enemy.vy = 900;
		integrateEnemy(enemy, sim.solids, dt);
	} else if (enemy.state === 'dive') {
		integrateEnemy(enemy, sim.solids, dt);
		if (enemy.onGround || enemy.stateT <= 0) {
			enemy.state = 'recover';
			enemy.stateT = enemy.attack.recover;
			enemy.vy = -40;
		}
	} else {
		const bob = Math.sin(enemy.anim * 2.2) * 8;
		const target = enemy.homeY + bob;
		enemy.y += (target - enemy.y) * Math.min(1, dt * 3);
		enemy.vy = 0;
		enemy.x += enemy.vx * dt;
		enemy.onGround = false;
	}
}

function runAI(enemy, sim, dt) {
	const player = sim.player;
	const dx = (player.x + player.w / 2) - (enemy.x + enemy.w / 2);
	const dist = Math.abs(dx);
	const see = dist < enemy.aggro && Math.abs((player.y + player.h / 2) - (enemy.y + enemy.h / 2)) < 220;

	if (enemy.state === 'telegraph') {
		enemy.vx = 0;
		enemy.facing = dx >= 0 ? 1 : -1;
		enemy.stateT -= dt;
		if (enemy.stateT <= 0) beginSwing(enemy);
		return;
	}
	if (enemy.state === 'attack' || enemy.state === 'dive') {
		enemy.stateT -= dt;
		if (enemy.tier === 'flyer') {
			enemy.vy = 340;
			enemy.vx = enemy.facing * 80;
		} else {
			enemy.vx = enemy.facing * enemy.attack.lunge;
		}
		if (enemy.stateT <= 0) {
			enemy.state = 'recover';
			enemy.stateT = enemy.attack.recover;
			enemy.didHit = false;
		}
		return;
	}
	if (enemy.state === 'recover') {
		enemy.stateT -= dt;
		enemy.vx *= Math.exp(-8 * dt);
		if (enemy.stateT <= 0) enemy.state = 'chase';
		return;
	}

	if (!see) {
		enemy.state = 'idle';
		enemy.patrolT = (enemy.patrolT || 0) + dt;
		if (enemy.patrolT > 1.4) {
			enemy.patrolT = 0;
			enemy.patrolDir *= -1;
		}
		const left = enemy.homeX - enemy.patrol;
		const right = enemy.homeX + enemy.patrol;
		if (enemy.x < left) enemy.patrolDir = 1;
		if (enemy.x > right) enemy.patrolDir = -1;
		if (enemy.tier === 'flyer') {
			enemy.vx = 0;
			enemy.facing = enemy.patrolDir;
		} else {
			enemy.vx = enemy.patrolDir * enemy.speed * 0.45;
			enemy.facing = enemy.patrolDir >= 0 ? 1 : -1;
		}
		return;
	}

	enemy.state = 'chase';
	enemy.facing = dx >= 0 ? 1 : -1;
	if (enemy.tier === 'flyer') {
		if (dist > enemy.range && enemy.attackCd <= 0) {
			enemy.state = 'telegraph';
			enemy.stateT = enemy.attack.telegraph;
			enemy.vx = 0;
		} else {
			enemy.vx = Math.sign(dx) * enemy.speed;
		}
		return;
	}
	if (dist > enemy.range) {
		enemy.vx = Math.sign(dx || 1) * enemy.speed;
	} else {
		enemy.vx = 0;
		if (enemy.attackCd <= 0) {
			enemy.state = 'telegraph';
			enemy.stateT = enemy.attack.telegraph;
		}
	}
}

function beginSwing(enemy) {
	enemy.swingId += 1;
	enemy.didHit = false;
	enemy.attackCd = (enemy.tier === 'large' || enemy.tier === 'boss' ? 1.35 : 0.95) + Math.random() * 0.25;
	if (enemy.tier === 'flyer') {
		enemy.state = 'dive';
		enemy.stateT = enemy.attack.active;
		return;
	}
	enemy.state = 'attack';
	enemy.stateT = enemy.attack.active;
}

function integrateEnemy(enemy, solids, dt) {
	enemy.x += enemy.vx * dt;
	for (const s of solids) {
		if (s.oneWay) continue;
		if (!hits(enemy, s)) continue;
		if (enemy.vx > 0) enemy.x = s.x - enemy.w;
		else if (enemy.vx < 0) enemy.x = s.x + s.w;
		enemy.vx = 0;
	}
	const prevBottom = enemy.y + enemy.h;
	enemy.y += enemy.vy * dt;
	enemy.onGround = false;
	for (const s of solids) {
		if (!hits(enemy, s)) continue;
		if (s.oneWay) {
			if (!(enemy.vy >= 0 && prevBottom <= s.y + 2)) continue;
			enemy.y = s.y - enemy.h;
			enemy.vy = 0;
			enemy.onGround = true;
			continue;
		}
		if (enemy.vy > 0) {
			enemy.y = s.y - enemy.h;
			enemy.vy = 0;
			enemy.onGround = true;
		} else if (enemy.vy < 0) {
			enemy.y = s.y + s.h;
			enemy.vy = 0;
		}
	}
	if (enemy.state === 'launch') enemy.stateT = -1;
}

function hits(a, b) {
	return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function hurtEnemy(enemy, event, sim) {
	if (enemy.dead) return false;
	enemy.hp -= event.amount;
	enemy.flash = 0.12;
	enemy.poise -= event.poiseDamage;
	const broken = enemy.poise <= 0;
	if (broken) enemy.poise = 0;

	const resist = enemy.resistKnockback || 0;
	let kx = event.knockbackX * (1 - resist);
	let ky = event.knockbackY;
	if (enemy.tier === 'boss') {
		kx *= 0.35;
		ky *= 0.15;
	}

	const launchOk = event.attackType === 'launcher' && (
		enemy.tier === 'boss' ? (!!enemy.launchOnBreak && broken) : (enemy.resistLaunch ? broken : true)
	);
	const downOk = event.attackType === 'downward' && enemy.tier !== 'boss' && (
		enemy.tier === 'small' || enemy.tier === 'medium' || enemy.tier === 'flyer' || broken
	);

	let reaction = 'light';
	if (launchOk) reaction = 'launch';
	else if (downOk) reaction = 'knockdown';
	else if (broken && (enemy.tier === 'small' || enemy.tier === 'medium' || enemy.tier === 'flyer')) reaction = 'stagger';
	else if (event.attackType === 'heavy' || event.attackType === 'launcher' || broken) reaction = 'heavy';
	else if (event.knockbackX > 320) reaction = 'knockback';

	if (reaction === 'light' && enemy.ignoreMinorHitstun && !broken) {
		reaction = 'armor';
		kx *= 0.2;
		ky = 0;
	}

	enemy.reaction = reaction;
	enemy.facing = event.direction < 0 ? 1 : -1;
	enemy.vx = event.direction * kx;
	if (reaction === 'launch') {
		enemy.vy = ky;
		enemy.state = 'launch';
		enemy.stateT = -1;
		enemy.onGround = false;
		sim.events.emit('enemyLaunch', { enemy, event });
		sim.events.emit('cameraImpulse', { mag: 3, time: 0.1 });
	} else if (reaction === 'knockdown') {
		enemy.vy = Math.min(-80, ky * 0.15);
		enemy.state = 'knockdown';
		enemy.stateT = 0.55;
		sim.events.emit('enemyKnockdown', { enemy, event });
	} else if (reaction === 'stagger') {
		enemy.vy = Math.min(enemy.vy, -40);
		enemy.state = 'stagger';
		enemy.stateT = 0.4;
		enemy.poise = enemy.maxPoise * 0.45;
		sim.events.emit('enemyStagger', { enemy, event });
	} else if (reaction === 'heavy' || reaction === 'knockback') {
		enemy.state = 'hit';
		enemy.stateT = reaction === 'heavy' ? 0.22 : 0.16;
		if (broken) enemy.poise = enemy.maxPoise * 0.35;
	} else if (reaction === 'armor') {
		enemy.state = enemy.state === 'telegraph' || enemy.state === 'attack' ? enemy.state : 'hit';
		if (enemy.state === 'hit') enemy.stateT = 0.06;
	} else {
		enemy.state = 'hit';
		enemy.stateT = event.hitstun;
	}

	if (enemy.hp <= 0) {
		enemy.hp = 0;
		enemy.dead = true;
		enemy.respawn = 3.2;
		enemy.state = 'dead';
		enemy.vx = event.direction * 80;
	}
	sim.floaters.push({
		x: enemy.x + enemy.w / 2,
		y: enemy.y,
		text: String(Math.round(event.amount)),
		life: 0.6,
		color: reaction === 'armor' ? '#c9d4e8' : '#ffe08a',
	});
	if (reaction !== 'light' && reaction !== 'armor') {
		sim.floaters.push({
			x: enemy.x + enemy.w / 2,
			y: enemy.y - 16,
			text: reaction,
			life: 0.5,
			color: '#f2f2f2',
		});
	}
	return true;
}

export function enemyDamageEvent(enemy, player) {
	return makeDamageEvent({
		source: enemy,
		target: player,
		amount: enemy.attack.damage,
		direction: enemy.facing,
		knockbackX: enemy.attack.knockbackX,
		knockbackY: enemy.attack.knockbackY,
		hitstun: enemy.tier === 'large' || enemy.tier === 'boss' ? 0.22 : 0.16,
		attackType: 'enemy',
		attackId: enemy.swingId,
		attackName: enemy.name,
		hitstop: 0.03,
		sourceKind: 'enemy',
		tags: ['physical', 'enemy'],
	});
}

export function staggerFromParry(enemy, player, sim) {
	enemy.state = 'stagger';
	enemy.stateT = PARRY.enemyStagger;
	enemy.didHit = true;
	enemy.vx = -enemy.facing * 140;
	enemy.vy = -30;
	enemy.reaction = 'stagger';
	enemy.poise = Math.max(0, enemy.poise - 18);
	sim.events.emit('enemyStagger', { enemy, event: { attackName: 'parry' } });
	sim.floaters.push({
		x: enemy.x + enemy.w / 2,
		y: enemy.y - 10,
		text: 'parried',
		life: 0.55,
		color: '#9ad7ff',
	});
}

function revive(enemy) {
	enemy.dead = false;
	enemy.hp = enemy.maxHp;
	enemy.poise = enemy.maxPoise;
	enemy.x = enemy.homeX;
	enemy.y = enemy.homeY;
	enemy.vx = 0;
	enemy.vy = 0;
	enemy.state = 'idle';
	enemy.reaction = '';
	enemy.flash = 0;
}
