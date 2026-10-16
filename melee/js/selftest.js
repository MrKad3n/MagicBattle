import { MOVEMENT } from './config.js';
import { createVirtualInput } from './input.js';
import { createPlayer } from './player.js';
import { createEnemy, hurtEnemy } from './enemy.js';
import { makeDamageEvent } from './damage.js';
import { createSim, step } from './game.js';
import { registerAttackModifier, clearModifiers } from './hooks.js';
import { startAttack } from './combat.js';

const DT = 1 / 60;

function harness(extra = {}) {
	const solids = extra.solids || [{ x: 0, y: 400, w: 2400, h: 80 }];
	const input = createVirtualInput();
	const player = createPlayer(extra.x ?? 120, extra.y ?? 400 - 56);
	player.onGround = extra.onGround ?? true;
	const sim = createSim({
		solids,
		enemies: extra.enemies || [],
		player,
	});
	return {
		sim, input, player: sim.player,
		frames(n, hold) {
			for (let i = 0; i < n; i++) {
				if (hold) hold(input, i);
				step(sim, input, DT);
				input.clearEdges();
			}
		},
	};
}

function assert(results, name, cond, detail = '') {
	results.push({ name, pass: !!cond, detail: cond ? '' : detail });
}

export function runSelfTests() {
	clearModifiers();
	const results = [];

	{
		const h = harness();
		h.input.set('right', true);
		h.frames(40);
		assert(results, 'run reaches speed', h.player.vx > MOVEMENT.maxGroundSpeed * 0.85, `vx ${h.player.vx}`);
		assert(results, 'run moves right', h.player.x > 200, `x ${h.player.x}`);
		h.input.set('right', false);
		h.frames(18);
		assert(results, 'stop is quick', Math.abs(h.player.vx) < 20, `vx ${h.player.vx}`);
	}

	{
		const h = harness();
		h.input.set('right', true);
		h.frames(24);
		h.input.set('right', false);
		h.input.set('left', true);
		h.frames(14);
		assert(results, 'reverse direction', h.player.vx < -40, `vx ${h.player.vx}`);
		h.frames(20);
		assert(results, 'faces travel direction', h.player.facing === -1, `facing ${h.player.facing}`);
	}

	{
		const h = harness();
		h.input.tap('jump');
		h.frames(1);
		assert(results, 'ground jump', h.player.vy < -200, `vy ${h.player.vy}`);
		h.input.set('jump', false);
		h.frames(8);
		const short = h.player.vy;
		const h2 = harness();
		h2.input.tap('jump');
		h2.input.set('jump', true);
		h2.frames(10);
		assert(results, 'held jump is higher', h2.player.y < h.player.y, `short y ${h.player.y} held y ${h2.player.y} short vy ${short}`);
	}

	{
		const solids = [{ x: 0, y: 400, w: 180, h: 40 }, { x: 0, y: 520, w: 800, h: 40 }];
		const h = harness({ solids, x: 140, y: 400 - 56 });
		h.input.set('right', true);
		let left = false;
		for (let i = 0; i < 50 && !left; i++) {
			h.frames(1);
			if (!h.player.onGround) left = true;
		}
		assert(results, 'walks off ledge', left, `ground ${h.player.onGround} x ${h.player.x}`);
		h.input.set('right', false);
		h.frames(4);
		assert(results, 'still airborne for coyote', h.player.onGround === false, `ground ${h.player.onGround} y ${h.player.y}`);
		h.input.tap('jump');
		h.frames(1);
		assert(results, 'coyote jump', h.player.vy < -200, `vy ${h.player.vy} coyote ${h.player.coyote}`);
	}

	{
		const h = harness({ y: 400 - 56 - 28, onGround: false });
		h.player.vy = 220;
		h.player.coyote = 0;
		h.input.tap('jump');
		h.frames(1);
		h.input.set('jump', false);
		h.frames(20);
		assert(results, 'jump buffer', h.player.y < 400 - 56 - 10 || h.player.vy < -100, `y ${h.player.y} vy ${h.player.vy}`);
	}

	{
		const solids = [{ x: 0, y: 400, w: 800, h: 40 }, { x: 260, y: 200, w: 40, h: 200 }];
		const h = harness({ solids, x: 180 });
		h.input.tap('dash');
		h.input.set('right', true);
		h.frames(12);
		assert(results, 'dash stops at wall', h.player.x + h.player.w <= 260.5, `x ${h.player.x}`);
		assert(results, 'dash travels', h.player.x > 200, `x ${h.player.x}`);
	}

	{
		const enemy = createEnemy({ tier: 'small', name: 'Dummy', x: 156, y: 400 - 40 });
		enemy.aggro = 0;
		enemy.speed = 0;
		enemy.patrol = 0;
		enemy.attackCd = 99;
		const h = harness({ enemies: [enemy] });
		const before = enemy.hp;
		h.input.tap('attack');
		h.frames(40);
		const dealt = before - enemy.hp;
		assert(results, 'sword hits once', dealt === 10, `dealt ${dealt} hp ${enemy.hp} state ${h.player.state}`);
	}

	{
		const a = createEnemy({ tier: 'small', name: 'A', x: 150, y: 400 - 40 });
		const b = createEnemy({ tier: 'small', name: 'B', x: 184, y: 400 - 40 });
		for (const e of [a, b]) {
			e.aggro = 0; e.speed = 0; e.patrol = 0; e.attackCd = 99;
		}
		const h = harness({ enemies: [a, b] });
		h.input.tap('attack');
		h.frames(30);
		assert(results, 'two enemies each hit once', a.hp === a.maxHp - 10 && b.hp === b.maxHp - 10, `a ${a.hp} b ${b.hp}`);
	}

	{
		const enemy = createEnemy({ tier: 'small', name: 'Dummy', x: 156, y: 400 - 40 });
		enemy.aggro = 0; enemy.speed = 0; enemy.patrol = 0; enemy.attackCd = 99;
		const h = harness({ enemies: [enemy] });
		h.input.tap('attack');
		h.frames(6);
		h.input.tap('attack');
		h.frames(50);
		assert(results, 'combo chains to second hit', enemy.hp <= enemy.maxHp - 24, `hp ${enemy.hp}`);
		assert(results, 'combo does not melt hp', enemy.hp > enemy.maxHp - 40, `hp ${enemy.hp}`);
	}

	{
		const h = harness();
		startAttack(h.player, h.sim, 'g3', h.input);
		h.frames(3);
		h.input.set('left', true);
		h.frames(12);
		assert(results, 'finisher keeps facing', h.player.facing === 1, `facing ${h.player.facing} phase ${h.player.combat.phase}`);
	}

	{
		const sim = createSim({ solids: [{ x: 0, y: 400, w: 400, h: 40 }], enemies: [], player: createPlayer(40, 344) });
		const small = createEnemy({ tier: 'small', x: 0, y: 0 });
		const large = createEnemy({ tier: 'large', x: 0, y: 0 });
		const boss = createEnemy({ tier: 'boss', x: 0, y: 0 });
		hurtEnemy(small, makeDamageEvent({
			amount: 13, direction: 1, knockbackX: 70, knockbackY: -620, attackType: 'launcher', poiseDamage: 14, hitstun: 0.2,
		}), sim);
		assert(results, 'small enemy launches', small.state === 'launch' && small.vy < -400, `state ${small.state} vy ${small.vy}`);
		hurtEnemy(large, makeDamageEvent({
			amount: 13, direction: 1, knockbackX: 70, knockbackY: -620, attackType: 'launcher', poiseDamage: 14, hitstun: 0.2,
		}), sim);
		assert(results, 'large enemy resists launch', large.state !== 'launch', `state ${large.state} vy ${large.vy}`);
		const before = boss.hp;
		hurtEnemy(boss, makeDamageEvent({
			amount: 24, direction: 1, knockbackX: 540, knockbackY: -90, attackType: 'heavy', poiseDamage: 80, hitstun: 0.2,
		}), sim);
		assert(results, 'boss takes damage without launch', boss.hp === before - 24 && boss.state !== 'launch', `hp ${boss.hp} state ${boss.state}`);
		assert(results, 'boss knockback is reduced', Math.abs(boss.vx) < 200, `vx ${boss.vx}`);
	}

	{
		const enemy = createEnemy({ tier: 'medium', x: 70, y: 344 });
		enemy.state = 'attack';
		enemy.stateT = 1;
		enemy.facing = 1;
		enemy.didHit = false;
		enemy.attackCd = 99;
		const h = harness({ enemies: [enemy], x: 100 });
		h.player.state = 'parry';
		h.player.parryT = 0.08;
		h.player.parrySuccess = false;
		const hp = h.player.hp;
		h.frames(1);
		assert(results, 'parry negates hit', h.player.hp === hp, `hp ${h.player.hp}`);
		assert(results, 'parry staggers enemy', enemy.state === 'stagger', `state ${enemy.state}`);
	}

	{
		const enemy = createEnemy({ tier: 'medium', x: 70, y: 344 });
		enemy.state = 'attack';
		enemy.stateT = 1;
		enemy.facing = 1;
		enemy.didHit = false;
		const h = harness({ enemies: [enemy], x: 100 });
		h.player.state = 'parry';
		h.player.parryT = 0.01;
		h.player.parrySuccess = false;
		const hp = h.player.hp;
		h.frames(1);
		assert(results, 'early parry fails', h.player.hp < hp, `hp ${h.player.hp}`);
	}

	{
		const enemy = createEnemy({ tier: 'small', x: 70, y: 360 });
		enemy.state = 'attack';
		enemy.stateT = 1;
		enemy.facing = 1;
		enemy.didHit = false;
		const h = harness({ enemies: [enemy], x: 100 });
		h.player.iframes = 0.4;
		const hp = h.player.hp;
		h.frames(1);
		assert(results, 'iframes ignore damage', h.player.hp === hp, `hp ${h.player.hp}`);
	}

	{
		clearModifiers();
		const enemy = createEnemy({ tier: 'small', x: 156, y: 360 });
		enemy.aggro = 0; enemy.speed = 0; enemy.patrol = 0; enemy.attackCd = 99;
		registerAttackModifier((def) => ({ ...def, damage: def.damage + 5 }));
		const h = harness({ enemies: [enemy] });
		h.input.tap('attack');
		h.frames(30);
		assert(results, 'attack modifier hook', enemy.hp === enemy.maxHp - 15, `hp ${enemy.hp}`);
		clearModifiers();
	}

	{
		const h = harness();
		h.input.set('right', true);
		h.input.tap('attack');
		h.frames(4);
		assert(results, 'attack from a run', h.player.state === 'attack', `state ${h.player.state}`);
		h.input.tap('dash');
		let dashed = false;
		for (let i = 0; i < 40; i++) {
			h.frames(1);
			if (h.player.state === 'dash') dashed = true;
		}
		assert(results, 'attack can cancel into dash', dashed, `state ${h.player.state}`);
	}

	return results;
}
