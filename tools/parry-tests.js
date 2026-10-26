/* Spell parry & Anti-Magic weapon — headless checks.  node tools/parry-tests.js
   Engine side: spell strength, the parry zone (parried / too strong / reflected), reflected spells fighting for the player,
   Anti-Magic reinforcement eating magic on contact (and paying for it), the hit source, and the dark rendering. */
'use strict';
const path = require('path');
const dir = path.join(__dirname, '..');
require(path.join(dir, 'magic-engine.js'));
require(path.join(dir, 'magic-techniques.js'));
const ME = globalThis.MagicEngine;
const out = [];
const ok = (name, pass, detail) => out.push({ name, pass: !!pass, detail: detail || '' });
const r1 = (v) => Math.round(v * 10) / 10;

function prof(){ const p = ME.deriveProfile({ magicPower: 30, magicControl: 12 }); p.techniquePoints = 20; p.allocations = { thermal: 2, kinetic: 2, light: 2, gravity: 2, spatial: 2, antimagic: 2, infinity: 2, construction: 2 }; return p; }
function setup(){
	const W = ME.createWorld();
	const player = { x: 100, y: 100, w: 20, h: 40, hp: 1000, maxHp: 1000, vx: 0, vy: 0 };
	const mage = { x: 700, y: 80, w: 30, h: 60, hp: 1e6, maxHp: 1e6, vx: 0, vy: 0 };
	const log = { dmg: [], hurt: [], parried: [] };
	const fp = [];
	const seg = { x0: 112, y0: 120, x1: 160, y1: 120 };
	const host = {
		mouseWorld: () => ({ x: 900, y: 100 }), getEnemies: () => [mage].filter(e => e.hp > 0), isSolid: () => false, inBounds: (x, y) => x > -500 && x < 5000 && y > -500 && y < 1500,
		hitRect: (e) => e, damageEnemy: (e, d) => { log.dmg.push({ e, d, src: W.hitSrc }); },
		getForeignProjectiles: () => fp, removeForeign: (p) => { const i = fp.indexOf(p); if(i >= 0) fp.splice(i, 1); },
		parryForeign: (p, o) => { log.parried.push({ p, o }); const i = fp.indexOf(p); if(i >= 0) fp.splice(i, 1); },
		getWeapon: () => ({ id: 'sword', name: 'Sword' }), weaponSegment: () => seg
	};
	const mageOwner = { id: 'mage1', entity: mage, foes: () => [player], allies: () => [], hurt: (e, d) => { log.hurt.push({ e, d, src: W.hitSrc }); } };
	return { W, player, mage, log, fp, seg, host, mageOwner };
}
function bolt(S, x, y, vx, amount, dmg, tech){ return S.W.emitEnergy({ key: 'b' + Math.random(), owner: S.mageOwner, host: S.host, x, y, vx, vy: 0, amount, hitDamage: dmg, tech, life: 6 }); }
const zoneAround = (x0, x1, W) => ({ hits: (x, y, r) => x + r >= x0 && x - r <= x1 && y > 60 && y < 160, W });
const step = (S, n) => { for(let i = 0; i < n; i++) S.W.update(1 / 60, S.host); };

/* ---------- strength ---------- */
{
	const S = setup();
	const b = bolt(S, 400, 120, -8, 60, 30);
	const proj = { x: 0, y: 0, power: 40, width: 10, height: 10, effects: ['burn', 'poison'] };
	ok('Spell strength = hit damage + ¼ of its energy (a game projectile: its power, +10% per effect)', Math.abs(S.W.spellStrength(b) - (30 + b.amount * 0.25)) < 0.01 && Math.abs(S.W.spellStrength(proj) - 48) < 0.01, 'body ' + r1(S.W.spellStrength(b)) + ' · projectile ' + r1(S.W.spellStrength(proj)));
}
/* ---------- parry: can bear it / cannot ---------- */
{
	const S = setup();
	const weak = bolt(S, 150, 120, -8, 40, 20), strong = bolt(S, 140, 120, -8, 120, 90);
	const zone = zoneAround(110, 200);
	const res = S.W.parry(zone, { cap: 50, ownerId: 'player' });
	const kinds = res.map(r => r.kind).sort().join(',');
	ok('Parry: a spell within the weapon\'s capacity is broken up; a stronger one goes through the guard', kinds === 'parried,strong' && !weak.alive && strong.alive, kinds + ' · weak alive ' + weak.alive + ' · strong alive ' + strong.alive);
	const again = S.W.parry(zone, { cap: 50, ownerId: 'player' });
	ok('Parry: a spell that was too strong is reported once, not every frame', again.length === 0, 'second call ' + again.length);
	ok('Parry: your own spells are never parried', (() => { const T = setup(); const own = T.W.emitEnergy({ key: 'o', owner: { id: 'player', entity: T.player }, host: T.host, x: 150, y: 120, vx: 3, amount: 30, hitDamage: 5, life: 5 }); return T.W.parry(zoneAround(110, 200), { cap: 999, ownerId: 'player' }).length === 0 && own.alive; })());
}
/* ---------- reflect: it flies back and fights for the player ---------- */
{
	const S = setup();
	const b = bolt(S, 150, 120, -8, 50, 25);
	const res = S.W.parry(zoneAround(110, 200), { cap: 200, ownerId: 'player', reflect: true, keep: 0.8, strip: 0.3, dark: true });
	ok('Anti-Magic parry reflects: the spell now flies away from you and belongs to you', res.length === 1 && res[0].kind === 'reflected' && b.alive && b.vx > 5 && b.ownerId === 'player' && b.reflected && !b.hostile, 'vx ' + r1(b.vx) + ' · owner ' + b.ownerId);
	const amt0 = b.amount;
	step(S, 5);
	const hurtBefore = S.log.hurt.length;
	step(S, 240);
	const hitMage = S.log.dmg.some(d => d.e === S.mage);
	ok('A reflected spell strikes the one who cast it, and never you', hitMage && S.log.hurt.length === hurtBefore && S.log.hurt.length === 0, 'hits on the caster ' + S.log.dmg.filter(d => d.e === S.mage).length + ' · hits on you ' + S.log.hurt.length + ' · energy ' + r1(amt0));
}
/* ---------- a blow landing on the player carries its source (the host judges the parry from it) ---------- */
{
	const S = setup();
	const b = bolt(S, 200, 120, -10, 40, 22);
	step(S, 40);
	const h = S.log.hurt[0];
	ok('The body whose blow is landing is exposed to the host (W.hitSrc)', h && h.src === b, h ? 'src ' + (h.src === b) : 'no hit');
}
/* ---------- reflect while the blow is landing: the spell survives the blow ---------- */
{
	const S = setup();
	let reflectedOnce = false;
	S.mageOwner.hurt = (e, d) => { S.log.hurt.push({ e, d }); if(!reflectedOnce && S.W.hitSrc){ reflectedOnce = true; S.W.reflectBody(S.W.hitSrc, { keep: 0.8 }); } };
	const b = bolt(S, 200, 120, -10, 40, 22);
	step(S, 40);
	ok('A spell turned about by a parry at the moment it lands is not consumed by that blow', b.alive && b.reflected && b.vx > 0, 'alive ' + b.alive + ' vx ' + r1(b.vx));
}
/* ---------- projectiles from the game ---------- */
{
	const S = setup();
	S.W.host = S.W.host || null; S.W.emitEnergy({ key: 'warm', owner: { id: 'player', entity: S.player }, host: S.host, x: 0, y: 0, amount: 1, life: 0.1 });
	const light = { x: 150, y: 120, vx: -5, vy: 0, power: 25, width: 12, height: 12, effects: [] }, heavy = { x: 160, y: 120, vx: -5, vy: 0, power: 90, width: 20, height: 20, effects: [] }, wide = { x: 150, y: 110, vx: 0, vy: 0, power: 5, aoe: true, width: 40, height: 40, effects: [] };
	S.fp.push(light, heavy, wide);
	const res = S.W.parry(zoneAround(110, 200), { cap: 60, ownerId: 'player', reflect: true });
	ok('Parry on game projectiles: one the weapon can bear is turned (reflected with Anti-Magic), a too-strong one and an area attack are left alone',
		res.length === 2 && res.some(r => r.kind === 'reflected' && r.proj === light) && res.some(r => r.kind === 'strong' && r.proj === heavy) && S.log.parried.length === 1 && S.log.parried[0].o.reflect === true && S.fp.indexOf(heavy) >= 0 && S.fp.indexOf(wide) >= 0,
		res.map(r => r.kind).join(','));
}
/* ---------- Anti-Magic reinforcement on a weapon: contact ---------- */
function reinforcedWeapon(S, techName, power){
	const def = ME.blankSpell('r');
	let prev = null; let gy = 0;
	const add = (type, params) => { let n; if(prev == null){ n = def.nodes[def.rootId]; n.type = type; n.params = ME.paramDefaults(type); } else { gy++; n = ME.makeNode(type, prev, 's', 0, gy, gy); def.nodes[n.id] = n; } Object.assign(n.params, params || {}); prev = n.id; return n; };
	add('generate', { amount: 90 }); add('technique', { technique: techName, power }); add('reinforce', { portion: 100 }); add('target', { kind: 'weapon' });
	def.seq = gy + 1;
	const r = S.W.cast(def, { profile: prof(), owner: { id: 'player', entity: S.player }, host: S.host });
	step(S, 20);
	return { r, st: S.W.reinf.find(s => s.kind === 'weapon') };
}
{
	const S = setup();
	const { r, st } = reinforcedWeapon(S, 'antimagic', 3);
	ok('An Anti-Magic reinforcement lands on the weapon', r.ok && st && st.tech.antimagic > 0 && st.strength > 0.2, r.ok ? 'strength ' + (st ? r1(st.strength) : '-') + ' energy ' + (st ? r1(st.energy) : '-') : r.error);
	if(st){
		const key = S.W.weaponKey('player', 'sword');
		const small = bolt(S, 140, 120, 0, 10, 4), big = bolt(S, 190, 120, 0, 400, 30), far = bolt(S, 600, 120, 0, 10, 4);
		const e0 = st.energy, big0 = big.amount;
		let erased = 0;
		for(let i = 0; i < 20; i++){ erased += S.W.weaponContact(key, S.seg, 1 / 60); S.W.update(1 / 60, S.host); }
		ok('Anti-Magic weapon: a small spell it touches is erased, a big one is worn down, magic away from the blade is untouched', !small.alive && big.alive && big.amount < big0 - 3 && far.alive, 'small alive ' + small.alive + ' · big ' + r1(big0) + ' → ' + r1(big.amount) + ' · far alive ' + far.alive);
		ok('Anti-Magic weapon pays for what it eats from its own reinforcement', st.energy < e0 - 1, 'reinforcement ' + r1(e0) + ' → ' + r1(st.energy));
		// foreign projectiles
		const p1 = { x: 140, y: 122, vx: -4, vy: 0, power: 1, width: 8, height: 8, effects: [] }, p2 = { x: 150, y: 120, vx: -4, vy: 0, power: 200, width: 14, height: 14, effects: [] };
		S.fp.push(p1, p2);
		S.W.weaponContact(key, S.seg, 1 / 60);
		ok('Anti-Magic weapon: a weak game projectile is erased on contact, a powerful one is weakened', S.fp.indexOf(p1) < 0 && S.fp.indexOf(p2) >= 0 && p2.power < 200, 'p2 power ' + r1(p2.power));
	}
}
{
	const S = setup();
	const { st } = reinforcedWeapon(S, 'kinetic', 4);
	const key = S.W.weaponKey('player', 'sword');
	const b = bolt(S, 140, 120, 0, 10, 4);
	for(let i = 0; i < 20; i++) S.W.weaponContact(key, S.seg, 1 / 60);
	ok('A weapon without Anti-Magic does not erase magic it touches', st && st.tech.kinetic && b.alive && b.amount > 9, 'alive ' + b.alive);
}
{
	const S = setup();
	const { st } = reinforcedWeapon(S, 'antimagic', 3);
	const key = S.W.weaponKey('player', 'sword');
	st.suppressed = S.W.time + 5;
	const b = bolt(S, 140, 120, 0, 10, 4);
	for(let i = 0; i < 20; i++) S.W.weaponContact(key, S.seg, 1 / 60);
	ok('A suppressed Anti-Magic reinforcement does nothing until it recovers', b.alive, '');
}
/* ---------- dark rendering ---------- */
{
	const S = setup();
	const { st } = reinforcedWeapon(S, 'antimagic', 3);
	const ops = new Set();
	const grad = { addColorStop(){} };
	const ctx = new Proxy({}, { get(t, k){ if(k === 'createRadialGradient' || k === 'createLinearGradient') return () => grad; if(k in t) return t[k]; return () => {}; }, set(t, k, v){ if(k === 'globalCompositeOperation') ops.add(v); t[k] = v; return true; } });
	let err = null;
	try { S.W.drawReinforcements(ctx, 0, 0); } catch(e){ err = e; }
	ok('Anti-Magic reinforcement on a weapon is drawn as an opaque dark mass (never an additive glow)', !err && ops.has('source-over') && !ops.has('lighter'), err ? String(err.stack || err) : 'ops ' + [...ops].join(','));
	// a body reinforced with Anti-Magic
	const S2 = setup();
	const def = ME.blankSpell('b'); let prev = null, gy = 0;
	const add = (type, params) => { let n; if(prev == null){ n = def.nodes[def.rootId]; n.type = type; n.params = ME.paramDefaults(type); } else { gy++; n = ME.makeNode(type, prev, 's', 0, gy, gy); def.nodes[n.id] = n; } Object.assign(n.params, params || {}); prev = n.id; };
	add('generate', { amount: 90 }); add('technique', { technique: 'antimagic', power: 3 }); add('reinforce', { portion: 100 }); add('target', { kind: 'self' });
	def.seq = gy + 1;
	const rr = S2.W.cast(def, { profile: prof(), owner: { id: 'player', entity: S2.player }, host: S2.host }); step(S2, 20);
	const ops2 = new Set();
	const ctx2 = new Proxy({}, { get(t, k){ if(k === 'createRadialGradient' || k === 'createLinearGradient') return () => grad; if(k in t) return t[k]; return () => {}; }, set(t, k, v){ if(k === 'globalCompositeOperation') ops2.add(v); t[k] = v; return true; } });
	let err2 = null; try { S2.W.drawReinforcements(ctx2, 0, 0); } catch(e){ err2 = e; }
	ok('Anti-Magic reinforcement on a body is drawn dark too', rr.ok && !err2 && S2.W.reinf.length > 0 && ops2.has('source-over') && !ops2.has('lighter'), err2 ? String(err2.stack || err2) : 'reinf ' + S2.W.reinf.length + ' ops ' + [...ops2].join(','));
}

let bad = 0;
for(const o of out){ if(!o.pass) bad++; console.log((o.pass ? 'PASS ' : 'FAIL ') + o.name + (o.detail ? '  —  ' + o.detail : '')); }
console.log('\n' + (out.length - bad) + '/' + out.length + ' passed');
process.exit(bad ? 1 : 0);
