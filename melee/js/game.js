import { createEvents } from './events.js';
import { HITSTOP_CAP } from './config.js';
import { GROUND_Y, SPAWN_X, WORLD_W, buildEnemies, buildSolids } from './arena.js';
import { poseForPlayer } from './anim.js';
import { solveRig } from './rig.js';
import {
	enemyAttackBox, enemyHurtbox, expandRect, overlap, playerHurtbox, segmentHitsRect, attackRect,
} from './hitbox.js';
import { createEnemy, enemyDamageEvent, hurtEnemy, staggerFromParry, updateEnemy } from './enemy.js';
import { onAttackHit } from './combat.js';
import { parryActive, succeedParry } from './parry.js';
import { captureBuffers, createPlayer, hurtPlayer, playerDamageFromAttack, updatePlayer } from './player.js';
import { attachFeedback, updateEffects } from './feedback.js';

export function createSim(overrides = {}) {
	const sim = {
		solids: overrides.solids || buildSolids(),
		enemies: overrides.enemies || buildEnemies(createEnemy),
		player: overrides.player || createPlayer(SPAWN_X, GROUND_Y - 56),
		events: createEvents(),
		hitstop: 0,
		time: 0,
		camera: { x: 0, y: 80, shake: 0, mag: 0 },
		particles: [],
		floaters: [],
		rings: [],
		debug: false,
		worldW: WORLD_W,
	};
	sim.player.onGround = true;
	attachFeedback(sim);
	return sim;
}

export function resetSim(sim) {
	const px = sim.player.weapon;
	const spawn = createPlayer(SPAWN_X, GROUND_Y - 56);
	spawn.weapon = px;
	sim.player = spawn;
	sim.enemies = buildEnemies(createEnemy);
	sim.hitstop = 0;
	sim.particles.length = 0;
	sim.floaters.length = 0;
	sim.rings.length = 0;
	sim.camera.shake = 0;
}

export function step(sim, input, dt) {
	if (input.pressed('debug')) sim.debug = !sim.debug;
	if (input.pressed('reset')) {
		resetSim(sim);
		return;
	}
	const player = sim.player;
	const frozen = sim.hitstop > 0;
	captureBuffers(player, input, dt, frozen);
	if (frozen) {
		sim.hitstop = Math.max(0, sim.hitstop - dt);
		if (sim.camera.shake > 0) sim.camera.shake -= dt;
		return;
	}

	updatePlayer(player, sim, input, dt);
	for (const enemy of sim.enemies) updateEnemy(enemy, sim, dt);

	player._pose = poseForPlayer(player, sim.time);
	player._rig = solveRig(player, player._pose, player.weapon.reach);
	resolveHits(sim);
	settlePlunge(sim);

	if (player.x < 0) { player.x = 0; player.vx = Math.max(0, player.vx); }
	if (player.x + player.w > WORLD_W) { player.x = WORLD_W - player.w; player.vx = Math.min(0, player.vx); }
	if (player.y > 1100) respawn(sim);
	if (player.state === 'death' && player.deathT > 0.95) respawn(sim);

	updateEffects(sim, dt);
	sim.time += dt;
}

function resolveHits(sim) {
	const player = sim.player;
	const atk = player.combat.attack;
	const blade = player._rig?.blade;
	if (atk && player.combat.phase === 'active' && blade) {
		const pad = atk.hitboxPad ?? 8;
		for (const enemy of sim.enemies) {
			if (enemy.dead || player.combat.hitTargets.has(enemy.id)) continue;
			const hb = enemyHurtbox(enemy);
			const reach = attackRect(player, atk);
			const bladeHit = segmentHitsRect(blade.x1, blade.y1, blade.x2, blade.y2, expandRect(hb, pad * 0.4));
			if (!bladeHit && !overlap(reach, hb)) continue;
			player.combat.hitTargets.add(enemy.id);
			const event = playerDamageFromAttack(player, atk, enemy);
			hurtEnemy(enemy, event, sim);
			onAttackHit(player, sim, atk, enemy);
			sim.hitstop = Math.min(HITSTOP_CAP, Math.max(sim.hitstop, atk.hitstop || 0));
		}
		if (atk.id === 'down' && player.combat.hitConfirmed && !player.combat.bounced) {
			bounce(player, atk, sim);
		}
	}

	if (player.state === 'death') return;
	const ph = playerHurtbox(player);
	for (const enemy of sim.enemies) {
		if (enemy.dead || enemy.didHit) continue;
		if (enemy.state !== 'attack' && enemy.state !== 'dive') continue;
		const box = enemyAttackBox(enemy);
		if (!overlap(box, ph)) continue;
		enemy.didHit = true;
		if (parryActive(player)) {
			succeedParry(player, sim, enemy);
			staggerFromParry(enemy, player, sim);
		} else {
			hurtPlayer(player, enemyDamageEvent(enemy, player), sim);
		}
	}
}

function bounce(player, atk, sim) {
	player.combat.bounced = true;
	player.vy = atk.bounceVelocity ?? -520;
	player.y -= 3;
	player.onGround = false;
	player.jumpHeld = false;
	player.state = 'jump';
	player.combat.attack = null;
	player.combat.info = null;
	player.combat.phase = null;
	player.combat.queuedId = null;
	player.squash = 0.55;
	sim.events.emit('land', { player, bounce: true });
	sim.events.emit('cameraImpulse', { mag: 3, time: 0.08 });
}

function settlePlunge(sim) {
	const player = sim.player;
	const atk = player.combat.attack;
	if (!atk || atk.id !== 'down' || player.combat.bounced) return;
	if (!player.onGround) return;
	if (player.combat.phase !== 'active' && player.combat.phase !== 'cancel' && player.combat.phase !== 'recovery') return;
	if (player.combat.hitConfirmed) {
		bounce(player, atk, sim);
		return;
	}
	player.actionLock = 0.1;
	player.squash = 1;
	player.vy = 0;
	player.combat.attack = null;
	player.combat.info = null;
	player.combat.phase = null;
	player.state = 'idle';
	sim.events.emit('land', { player, impact: 360 });
}

function respawn(sim) {
	const weapon = sim.player.weapon;
	const debug = sim.debug;
	sim.player = createPlayer(SPAWN_X, GROUND_Y - 56);
	sim.player.weapon = weapon;
	sim.player.iframes = 0.8;
	sim.debug = debug;
}
