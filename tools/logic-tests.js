/* Logic runes and domain rules — headless checks.   node tools/logic-tests.js
   Eight branches per rune, the Conditional rune, the Loop rune (counts, pause, mana, conditions, checks), and the
   domain changes: mana by duration, a forced 1400 px size, and energy put into a domain being sealed away. */
'use strict';
const path = require('path');
const dir = path.join(__dirname, '..');
globalThis.window = globalThis;
for(const f of ['magic-engine.js', 'magic-techniques.js', 'magic-vows.js', 'magic-domain.js']) require(path.join(dir, f));
const ME = globalThis.MagicEngine;

const out = [];
const ok = (name, pass, detail) => { out.push({ name, pass: !!pass, detail: detail || '' }); };
const r1 = (v) => Math.round(v * 10) / 10;
function prof(ctl, pow){ const p = ME.deriveProfile({ magicPower: pow || 120, magicControl: ctl || 20 }); p.techniquePoints = 20; p.maxEnergy = 5000; p.runeCapacity = 100; return p; }

function world(opt){
	opt = opt || {};
	const W = ME.createWorld();
	const caster = { x: 90, y: 80, w: 20, h: 40, vx: 0, vy: 0, hp: 100, maxHp: 100, onGround: true };
	const foes = opt.foes || [];
	const state = { mana: opt.mana == null ? 1e9 : opt.mana, drained: 0 };
	const host = { mouseWorld: () => ({ x: 600, y: 100 }), getEnemies: () => foes.filter(e => !e.dead), isSolid: () => false, inBounds: (x, y) => x > -900 && x < 6000 && y > -900 && y < 2000,
		damageEnemy: (e, d) => { e.hp -= d; }, isAttacking: () => false, noFreeze: true, isPlayer: (e) => e === caster,
		drainEnergy: (owner, amount) => { const g = Math.max(0, Math.min(amount, state.mana)); state.mana -= g; state.drained += g; return g; } };
	return { W, host, caster, owner: { id: 'p', entity: caster }, foes, state };
}
function run(S, secs){ for(let i = 0; i < Math.round(secs * 60); i++) S.W.update(1 / 60, S.host); }
function cast(S, def, p){ return S.W.cast(def, { profile: p || prof(), owner: S.owner, host: S.host }); }

/* a spell builder: add(type, parentKey, params, link, dir) */
function builder(name){
	const s = ME.blankSpell(name || 't'); const root = s.nodes[s.rootId]; let seq = 1; const keys = { root: root.id };
	const api = {
		s, root,
		root_(type, params){ root.type = type; root.params = Object.assign(ME.paramDefaults(type), params || {}); return api; },
		add(key, type, parent, params, link, extra){
			const par = s.nodes[keys[parent] || parent];
			const n = ME.makeNode(type, par.id, 's', par.gx, par.gy + seq, seq); seq++;
			n.params = Object.assign(ME.paramDefaults(type), params || {});
			if(link) n.link = Object.assign(n.link, link);
			if(type === 'loop') n.loop = ME.defaultLoop();
			if(extra) Object.assign(n, extra);
			s.nodes[n.id] = n; keys[key] = n.id; s.seq = seq; return api;
		},
		id(key){ return keys[key]; },
		node(key){ return s.nodes[keys[key]]; }
	};
	return api;
}
const COND = (type, params, timeout) => ({ mode: 'condition', cond: { type, params: Object.assign(ME.condDefaults(type), params || {}), timeout: timeout || 30 } });

/* count how often each rune actually ran */
const ran = {};
for(const t of ['color', 'generate']){
	const R = ME.Runes[t], orig = R.exec;
	R.exec = function(api, br, p, node, kids){ ran[node.id] = (ran[node.id] || 0) + 1; return orig.call(this, api, br, p, node, kids); };
}
const count = (b, key) => ran[b.id(key)] || 0;

/* ============================================================ eight branches */
{
	ok('The Forge has eight directions to branch in', Object.keys(ME.DIRS).length === 8 && ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'].every(d => ME.DIRS[d] && ME.OPPOSITE[ME.OPPOSITE[d]] === d), Object.keys(ME.DIRS).join(' '));
	const b8 = builder('eight').root_('generate', { amount: 30 });
	for(let i = 0; i < 8; i++) b8.add('k' + i, 'color', 'root', {});
	const rep8 = ME.validate(b8.s, prof());
	ok('Eight runes can branch off one rune', rep8.ok && !rep8.errors.some(e => e.code === 'KIDS'), rep8.ok ? 'valid' : rep8.errors.map(e => e.text).join('; '));
	b8.add('k8', 'color', 'root', {});
	const rep9 = ME.validate(b8.s, prof());
	ok('A ninth is refused', rep9.errors.some(e => e.code === 'KIDS'), (rep9.errors.find(e => e.code === 'KIDS') || {}).text);
	const S = world(); const b8b = builder('eight run').root_('generate', { amount: 30 });
	for(let i = 0; i < 8; i++) b8b.add('k' + i, 'color', 'root', {});
	cast(S, b8b.s); run(S, 0.2);
	ok('All eight branches run', [0, 1, 2, 3, 4, 5, 6, 7].every(i => count(b8b, 'k' + i) === 1), [0, 1, 2, 3, 4, 5, 6, 7].map(i => count(b8b, 'k' + i)).join(''));
}

/* ============================================================ conditional */
function condSpell(mode, params){
	const b = builder('cond').root_('generate', { amount: 30 });
	b.add('c', 'conditional', 'root', Object.assign({ mode }, params || {}));
	b.add('a', 'color', 'c', {}, COND('spellAge', { time: 1 }));
	b.add('b', 'color', 'c', {}, COND('spellAge', { time: 2 }));
	b.add('g', 'color', 'c', {}, COND('casterGrounded', {}));
	return b;
}
{
	const b = condSpell('each');
	const rep = ME.validate(b.s, prof());
	ok('A Conditional with conditional branches is a legal spell', rep.ok && !rep.warnings.some(w => w.code === 'COND_PLAIN'), rep.ok ? 'ok' : rep.errors.map(e => e.text).join('; '));
	const plain = builder('p').root_('generate', { amount: 30 }); plain.add('c', 'conditional', 'root', {}); plain.add('a', 'color', 'c', {});
	ok('A branch with no condition is flagged', ME.validate(plain.s, prof()).warnings.some(w => w.code === 'COND_PLAIN'), 'COND_PLAIN');
	const S = world(); S.caster.onGround = false;
	cast(S, b.s);
	run(S, 0.5);
	const early = [count(b, 'a'), count(b, 'b'), count(b, 'g')];
	run(S, 0.8); const mid = [count(b, 'a'), count(b, 'b'), count(b, 'g')];
	run(S, 1.2); const late = [count(b, 'a'), count(b, 'b'), count(b, 'g')];
	S.caster.onGround = true; run(S, 0.6);
	ok('Each branch waits for ITS OWN condition', early.join() === '0,0,0' && mid.join() === '1,0,0' && late.join() === '1,1,0' && count(b, 'g') === 1, 'at 0.5 s ' + early.join('') + ' · 1.3 s ' + mid.join('') + ' · 2.5 s ' + late.join('') + ' · landed ' + [count(b, 'a'), count(b, 'b'), count(b, 'g')].join(''));
}
{
	const b = condSpell('first'); const S = world(); S.caster.onGround = false;
	cast(S, b.s); run(S, 3.2);
	ok('"Only the first" lets one condition fire and cancels the rest', count(b, 'a') === 1 && count(b, 'b') === 0 && count(b, 'g') === 0, 'a ' + count(b, 'a') + ' · b ' + count(b, 'b') + ' · g ' + count(b, 'g'));
	S.caster.onGround = true; run(S, 0.6);
	ok('…and the cancelled branches stay cancelled', count(b, 'g') === 0, 'g ' + count(b, 'g'));
}
{
	const b = condSpell('first'); const S = world(); S.caster.onGround = true;
	cast(S, b.s); run(S, 3);
	ok('A condition already true on arrival wins at once, in branch order', count(b, 'g') === 1 && count(b, 'a') === 0 && count(b, 'b') === 0, 'a ' + count(b, 'a') + ' · b ' + count(b, 'b') + ' · g ' + count(b, 'g'));
}
{
	const b = builder('rep').root_('generate', { amount: 30 });
	b.add('c', 'conditional', 'root', { mode: 'repeat', times: 3, rest: 1 });
	b.add('g', 'color', 'c', {}, COND('casterGrounded', {}));
	const S = world(); cast(S, b.s); run(S, 6);
	ok('"Every time it occurs" fires again after a rest, up to the limit', count(b, 'g') === 3, 'fired ' + count(b, 'g') + ' (limit 3, rest 1 s, 6 s)');
	const b2 = builder('rep2').root_('generate', { amount: 30 });
	b2.add('c', 'conditional', 'root', { mode: 'each' });
	b2.add('g', 'color', 'c', {}, COND('casterGrounded', {}));
	const S2 = world(); cast(S2, b2.s); run(S2, 6);
	ok('…while "each" fires only once', count(b2, 'g') === 1, 'fired ' + count(b2, 'g'));
	const b3 = builder('rep3').root_('generate', { amount: 30 });
	b3.add('c', 'conditional', 'root', { mode: 'repeat', times: 5, rest: 1 });
	b3.add('g', 'color', 'c', {}, COND('casterGrounded', {}));
	const S3 = world(); S3.caster.onGround = false; cast(S3, b3.s); run(S3, 1); const dry = count(b3, 'g');
	S3.caster.onGround = true; run(S3, 0.5); S3.caster.onGround = false; run(S3, 2); S3.caster.onGround = true; run(S3, 0.5);
	ok('A repeating branch only fires while its condition holds', dry === 0 && count(b3, 'g') === 2, 'before ' + dry + ' → ' + count(b3, 'g') + ' (two landings)');
}

/* ============================================================ loop */
function loopSpell(times, gap, mode, extra){
	const b = builder('loop').root_('generate', { amount: 30 });
	b.add('l', 'loop', 'root', { times, gap });
	b.node('l').loop.to = b.id('root');
	if(mode) Object.assign(b.node('l').loop, mode);
	if(extra) extra(b);
	return b;
}
{
	const b = loopSpell(3, 0);
	const rep = ME.validate(b.s, prof());
	ok('A Loop returning to an earlier rune is a legal spell', rep.ok, rep.ok ? 'ok' : rep.errors.map(e => e.text).join('; '));
	const S = world(); const r = cast(S, b.s); run(S, 0.5);
	ok('It repeats the runes before it: 3 repeats = 4 passes', count(b, 'root') === 4 && r.instance.loopPasses === 3, 'generate ran ' + count(b, 'root') + '×, passes ' + r.instance.loopPasses);
	const base = ME.validate(builder('b').root_('generate', { amount: 30 }).s, prof());
	const per = (rep.nodeCost[b.id('root')] + rep.nodeCost[b.id('l')]) * ME.CONFIG.loopFee;
	ok('Every repeat costs the repeated runes × 1.5 in mana', Math.abs(S.state.drained - per * 3) < 0.5, 'drained ' + r1(S.state.drained) + ' · expected 3 × ' + r1(per) + ' = ' + r1(per * 3));
	ok('The spell\'s cost shows the whole loop, but only the first pass is paid at the cast', rep.cost - rep.upfront >= per * 3 - 1 && rep.upfront < rep.cost && rep.loop > 0, 'cost ' + rep.cost + ' · paid at the cast ' + rep.upfront + ' · loop ' + r1(rep.loop) + ' (base spell ' + base.cost + ')');
	void base;
}
{
	const b = loopSpell(10, 0); const S = world(); const r = cast(S, b.s); run(S, 0.5);
	ok('A Loop repeats up to 10 times', count(b, 'root') === 11 && r.instance.loopPasses === 10, count(b, 'root') + ' passes');
	const b2 = loopSpell(10, 0); b2.node('l').params.times = 25;
	ok('…and no more than that', ME.validate(b2.s, prof()).errors.some(e => e.code === 'PARAM'), 'PARAM');
}
{
	const b = loopSpell(4, 0.5); const S = world(); cast(S, b.s);
	run(S, 0.3); const a = count(b, 'root'); run(S, 0.6); const c = count(b, 'root'); run(S, 2); const d = count(b, 'root');
	ok('The pause between passes is kept', a === 1 && c === 2 && d === 5, 'after 0.3 s ' + a + ' · 0.9 s ' + c + ' · 2.9 s ' + d);
}
{
	const b = loopSpell(5, 0); const S = world(); const per0 = (ME.validate(b.s, prof()).nodeCost[b.id('root')] + 0.5) * ME.CONFIG.loopFee;
	S.state.mana = per0 * 2.5; const r = cast(S, b.s); run(S, 0.5);
	ok('A repeat needs its mana at the moment it starts: the loop ends when it runs dry', count(b, 'root') === 3 && r.instance.loopPasses === 2, 'passes ' + r.instance.loopPasses + ' with mana for 2.5');
}
{
	const b = builder('after').root_('generate', { amount: 30 });
	b.add('l', 'loop', 'root', { times: 2, gap: 0 }); b.node('l').loop.to = b.id('root');
	b.add('then', 'color', 'l', {});
	const S = world(); cast(S, b.s); run(S, 0.5);
	ok('Runes after a Loop run once, when the repeats are done', count(b, 'then') === 1 && count(b, 'root') === 3, 'after-loop rune ran ' + count(b, 'then') + '×, loop body ' + count(b, 'root') + '×');
}
{   // return to a middle rune
	const b = builder('mid').root_('generate', { amount: 30 });
	b.add('m', 'color', 'root', {}); b.add('n', 'color', 'm', {}); b.add('l', 'loop', 'n', { times: 2, gap: 0 }); b.node('l').loop.to = b.id('m');
	const S = world(); cast(S, b.s); run(S, 0.5);
	ok('A Loop can return to a rune in the middle — what is before it is not repeated', count(b, 'root') === 1 && count(b, 'm') === 3 && count(b, 'n') === 3, 'first ' + count(b, 'root') + ' · m ' + count(b, 'm') + ' · n ' + count(b, 'n'));
	const rep = ME.validate(b.s, prof()), per = (rep.nodeCost[b.id('m')] + rep.nodeCost[b.id('n')] + rep.nodeCost[b.id('l')]) * ME.CONFIG.loopFee;
	ok('…and only the repeated runes are paid for', Math.abs(S.state.drained - per * 2) < 0.5, 'drained ' + r1(S.state.drained) + ' · expected ' + r1(per * 2));
}
{   // conditions on the return branch
	const wait = loopSpell(1, 0, { mode: 'condition', check: 'wait', cond: { type: 'spellAge', params: { time: 2 }, timeout: 30 } });
	const S = world(); cast(S, wait.s); run(S, 1.2); const early = count(wait, 'root'); run(S, 1.5);
	ok('A return condition makes the loop wait for it to happen', early === 1 && count(wait, 'root') === 2, 'before the event ' + early + ' · after ' + count(wait, 'root'));
	const gu = loopSpell(1, 0, { mode: 'condition', check: 'wait', cond: { type: 'spellAge', params: { time: 50 }, timeout: 1.5 } });
	const S2 = world(); cast(S2, gu.s); run(S2, 3);
	ok('…and gives up if it never does', count(gu, 'root') === 1, 'ran ' + count(gu, 'root'));
	const gone = loopSpell(1, 0, { mode: 'condition', check: 'wait', cond: { type: 'spellAge', params: { time: 50 }, timeout: 1.5 } }, (b) => b.add('then', 'color', 'l', {}));
	const S3 = world(); cast(S3, gone.s); run(S3, 3);
	ok('…then carries on past the Loop', count(gone, 'then') === 1, 'after-loop ran ' + count(gone, 'then'));
}
{   // "still there" — a check at the moment of looping
	const yes = loopSpell(3, 0, { mode: 'condition', check: 'now', cond: { type: 'casterGrounded', params: {}, timeout: 5 } });
	const S = world(); S.caster.onGround = true; cast(S, yes.s); run(S, 0.5);
	ok('"While it is still true": loops as long as the condition holds', count(yes, 'root') === 4, 'passes ' + count(yes, 'root'));
	const no = loopSpell(3, 0, { mode: 'condition', check: 'now', cond: { type: 'casterGrounded', params: {}, timeout: 5 } });
	const S2 = world(); S2.caster.onGround = false; cast(S2, no.s); run(S2, 0.5);
	ok('…and stops the moment it does not', count(no, 'root') === 1, 'passes ' + count(no, 'root'));
	const mid = loopSpell(5, 0.4, { mode: 'condition', check: 'now', cond: { type: 'casterGrounded', params: {}, timeout: 5 } });
	const S3 = world(); S3.caster.onGround = true; cast(S3, mid.s); run(S3, 0.5); S3.caster.onGround = false; run(S3, 3);
	ok('…even partway through', count(mid, 'root') >= 2 && count(mid, 'root') < 6, 'passes ' + count(mid, 'root') + ' (left the ground after about one)');
}
{   // checks
	const open = builder('open').root_('generate', { amount: 30 }); open.add('l', 'loop', 'root', { times: 3 });
	const ro = ME.validate(open.s, prof());
	ok('A Loop with no return branch is a warning, not an error', ro.ok && ro.warnings.some(w => w.code === 'LOOP_OPEN'), 'LOOP_OPEN');
	const bad = builder('bad').root_('generate', { amount: 30 }); bad.add('a', 'color', 'root', {}); bad.add('b', 'color', 'root', {});
	bad.add('l', 'loop', 'a', { times: 2 }); bad.node('l').loop.to = bad.id('b');
	ok('A Loop cannot return to a rune that is not before it on its branch', ME.validate(bad.s, prof()).errors.some(e => e.code === 'LOOP_TARGET'), 'LOOP_TARGET');
	const self = builder('self').root_('generate', { amount: 30 }); self.add('l', 'loop', 'root', { times: 2 }); self.node('l').loop.to = self.id('l');
	ok('…nor to itself', ME.validate(self.s, prof()).errors.some(e => e.code === 'LOOP_TARGET'), 'LOOP_TARGET');
	const nc = loopSpell(2, 0, { mode: 'condition', check: 'wait', cond: { type: 'targetNear', params: { range: 100 }, timeout: 10 } });
	ok('A return condition that needs a target is checked like any connector', ME.validate(nc.s, prof()).errors.some(e => e.link === 'loop:' + nc.id('l')), 'COND_TARGET on the return branch');
	const norm = JSON.parse(JSON.stringify(loopSpell(2, 0).s)); delete norm.nodes[Object.keys(norm.nodes).find(k => norm.nodes[k].type === 'loop')].loop;
	ME.normalize(norm);
	ok('A saved Loop with no return data is repaired on load', Object.keys(norm.nodes).every(k => norm.nodes[k].type !== 'loop' || (norm.nodes[k].loop && 'to' in norm.nodes[k].loop)), 'loop block restored');
	const dangling = loopSpell(2, 0); dangling.node('l').loop.to = 'nope'; ME.normalize(dangling.s);
	ok('…and a return to a rune that no longer exists is cleared', dangling.node('l').loop.to === null, 'to → ' + dangling.node('l').loop.to);
}
{   // a loop inside a split branch only repeats its own branch; the per-spell cap stops runaways
	const b = builder('split').root_('generate', { amount: 60 });
	b.add('sp', 'split', 'root', { share: 0, spread: 10 });
	b.add('a', 'color', 'sp', {}); b.add('la', 'loop', 'a', { times: 3, gap: 0 }); b.node('la').loop.to = b.id('a');
	b.add('b', 'color', 'sp', {});
	const S = world(); cast(S, b.s); run(S, 0.5);
	ok('In a split, a loop repeats only its own branch', count(b, 'a') === 4 && count(b, 'b') === 1, 'a ' + count(b, 'a') + ' · b ' + count(b, 'b'));
	const w = builder('wild').root_('generate', { amount: 30 });
	w.add('l1', 'loop', 'root', { times: 10, gap: 0 }); w.node('l1').loop.to = w.id('root');
	w.add('l2', 'loop', 'l1', { times: 10, gap: 0 }); w.node('l2').loop.to = w.id('root');
	const S2 = world(); const r2 = cast(S2, w.s); run(S2, 1);
	ok('Nested loops are counted per loop and stay within the spell\'s repeat cap', r2.instance.loopPasses <= ME.CONFIG.loopPassCap && count(w, 'root') <= 1 + ME.CONFIG.loopPassCap, 'repeats ' + r2.instance.loopPasses + ' (cap ' + ME.CONFIG.loopPassCap + ')');
}

/* ============================================================ domains */
function zoneDomain(dom, opt){
	opt = opt || {};
	const b = builder('dom').root_('zone', { radius: opt.radius || 200, spawn: 'caster' });
	b.add('d', 'domain', 'root', Object.assign({ form: 'closed', duration: 8, fuel: 'self', selfFuel: 600, sureHit: 'no', cinematic: 'none' }, dom || {}));
	return b;
}
{
	const costOf = (dom) => { const b = zoneDomain(dom); return ME.validate(b.s, prof()).nodeCost[b.id('d')]; };
	const c5 = costOf({ duration: 5 }), c10 = costOf({ duration: 10 }), c20 = costOf({ duration: 20 });
	ok('A longer domain costs more mana: 14 per second it lasts, ×5', Math.abs((c20 - c5) - 15 * ME.CONFIG.domainManaPerSec * ME.CONFIG.domainCostMult) < 0.01 && c5 < c10 && c10 < c20, '5 s ' + c5 + ' · 10 s ' + c10 + ' · 20 s ' + c20);
	const open = costOf({ duration: 10, form: 'open' }), brief = costOf({ duration: 10, vow: 'brief' });
	ok('…by how long it REALLY lasts (open domains are shorter, the Brief vow halves it)', open < c10 && brief < open, 'closed ' + c10 + ' · open ' + open + ' · brief ' + brief);
	const rep = ME.validate(zoneDomain({ duration: 12 }).s, prof());
	ok('The forge reports the size and the duration cost', /2800/.test(JSON.stringify(rep.nodeInfo)) && /mana/.test(JSON.stringify(rep.nodeInfo)), 'Size and Duration cost listed');
}
{
	const S = world({ foes: [{ x: 280, y: 60, w: 30, h: 60, hp: 5000, maxHp: 5000, vx: 0, vy: 0 }] });
	const b = zoneDomain({}, { radius: 200 }); cast(S, b.s); run(S, 0.5);
	const D = S.W.domains.find(d => d.alive);
	ok('Every domain is forced to 1400 px, whatever zone it came from', D && D.r === 1400 && D.z.zoneRadius === 1400, 'zone 200 → domain radius ' + (D && D.r));
	const S2 = world(); cast(S2, zoneDomain({ form: 'open' }, { radius: 100 }).s); run(S2, 0.5);
	ok('…open or closed', S2.W.domains[0] && S2.W.domains[0].r === 1400, 'open: ' + (S2.W.domains[0] && S2.W.domains[0].r));
	const S3 = world(); cast(S3, zoneDomain({ vow: 'narrow' }).s); run(S3, 0.5);
	ok('…the Narrow vow still squeezes it (the one thing that can)', S3.W.domains[0] && S3.W.domains[0].r === 840, 'narrow: ' + (S3.W.domains[0] && S3.W.domains[0].r));
}
{
	const S = world(); cast(S, zoneDomain({ duration: 10 }).s); run(S, 0.5);
	const D = S.W.domains.find(d => d.alive);
	const blobs = S.W.bodies.filter(b => b.alive && b.zoneBlob && b.zoneOf === D.z);
	ok('Energy put into a domain is sealed away', blobs.length > 0 && blobs.every(b => b.sealed), blobs.length + ' pieces, all sealed');
	// try to grab it: Target → Raw energy around, then Redirect
	const g = builder('grab').root_('target', { kind: 'energy', select: 'around', radius: 900 });
	g.add('r', 'redirect', 'root', { toward: 'mouse' });
	const rep = ME.validate(g.s, prof());
	cast(S, g.s); run(S, 0.5);
	ok('…it cannot be targeted or claimed', blobs.every(b => b.zoneBlob && !b.claimed) && S.W.bodies.filter(b => b.claimed && b.zoneOf === D.z).length === 0, 'validated: ' + rep.ok);
	// a second Draw Out cannot take it
	const t0 = D.z.amount;
	const api = S.W.instances[0]._api || null;
	let taken = 0; for(const i of S.W.instances){ const a = i._api; if(a){ taken = a.takeFromZone(D.z, 500); break; } }
	ok('…nor drawn back out', taken === 0 && D.z.amount >= t0 * 0.99, 'took ' + taken + ' · zone ' + r1(t0) + ' → ' + r1(D.z.amount));
	void api;
	// the domain itself still burns it
	const f0 = D.z.amount; run(S, 4);
	ok('The domain itself still spends it: longer domains burn more', D.z.amount < f0, 'zone ' + r1(f0) + ' → ' + r1(D.z.amount) + ' in 4 s');
	// a zone that became a domain is no longer a target
	const zt = builder('zt').root_('target', { kind: 'zone', select: 'nearCaster', range: 3000 }); zt.add('r', 'redirect', 'root', { toward: 'mouse' });
	const rz = cast(S, zt.s); run(S, 0.2);
	const branch = rz.instance && rz.instance.branches[0];
	ok('A zone that became a domain cannot be targeted', !branch || !(branch.ctx.zone && branch.ctx.zone === D.z), branch ? (branch.note || 'branch has no zone') : 'ended');
}
{   // two zones of different age: the zone's own energy is still tallied
	const S = world(); cast(S, zoneDomain({ duration: 6 }).s); run(S, 0.5);
	const D = S.W.domains[0]; const sum = S.W.bodies.filter(b => b.alive && b.zoneBlob && b.zoneOf === D.z).reduce((t, b) => t + b.amount, 0);
	ok('The zone still counts what it holds (rules and upkeep draw on it)', Math.abs(D.z.amount - sum) < 1 && D.z.amount > 100, 'zone ' + r1(D.z.amount) + ' · pieces ' + r1(sum));
	run(S, 8);
	ok('When the domain ends the sealed energy goes with it', !S.W.domains.some(d => d.alive) && S.W.bodies.filter(b => b.alive && b.zoneBlob && b.sealed).length === 0, 'domains ' + S.W.domains.filter(d => d.alive).length);
}

/* ============================================================ report */
const fails = out.filter(o => !o.pass);
for(const o of out) console.log((o.pass ? '  ok   ' : '  FAIL ') + o.name + (o.detail ? '  [' + o.detail + ']' : ''));
console.log('\n' + (out.length - fails.length) + ' / ' + out.length + ' checks passed');
process.exit(fails.length ? 1 : 0);
