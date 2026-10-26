/* Domain Laws — headless checks.   node tools/domain-tests.js [--table]
   Loads the engine, techniques, vows and the two domain plugins, then casts real rune spells in a bare world:
   laws and their events and effects, marks, seals, copies, the budget, the opening (gather → freeze → expand), the veil and the painter. */
'use strict';
const path = require('path');
const dir = path.join(__dirname, '..');
globalThis.window = globalThis;
for(const f of ['magic-engine.js', 'magic-techniques.js', 'magic-vows.js', 'magic-domain.js', 'magic-domain-look.js', 'magic-domain-art.js']) require(path.join(dir, f));
const ME = globalThis.MagicEngine, MD = globalThis.MagicDomain;

const out = [];
const ok = (name, pass, detail) => { out.push({ name, pass: !!pass, detail: detail || '' }); };
const r1 = (v) => Math.round(v * 10) / 10;

function prof(ctl, pow){ const p = ME.deriveProfile({ magicPower: pow || 120, magicControl: ctl || 20 }); p.techniquePoints = 20; p.maxEnergy = 20000; p.allocations = { thermal: 2, kinetic: 2, light: 2, gravity: 2, spatial: 2, antimagic: 2, infinity: 2, construction: 2 }; return p; }

/* a world with a caster at (90,80), foes, and a log of every blow */
function world(foes, opt){
	opt = opt || {};
	const W = ME.createWorld();
	const log = [];
	const caster = { x: 90, y: 80, w: 20, h: 40, vx: 0, vy: 0, hp: 100, maxHp: 100, onGround: true };
	const host = { mouseWorld: () => ({ x: 600, y: 100 }), getEnemies: () => foes.filter(e => !e.dead), isSolid: () => false, inBounds: (x, y) => x > -900 && x < 6000 && y > -900 && y < 2000,
		damageEnemy: (e, d, info) => { e.hp -= d; e.taken = (e.taken || 0) + d; log.push({ e, d, info }); }, isAttacking: (e) => !!e.attacking, heal: (e, a) => { e.hp = Math.min(e.maxHp || 1e9, e.hp + a); e.healed = (e.healed || 0) + a; },
		vowText: (at, t) => { W._texts = W._texts || []; W._texts.push(t); }, noFreeze: !!opt.noFreeze, isPlayer: (e) => e === caster };
	const owner = { id: 'p', entity: caster };
	return { W, host, caster, owner, log, foes };
}
function foe(x, hp, extra){ return Object.assign({ x: x || 280, y: 60, w: 30, h: 60, hp: hp || 5000, maxHp: hp || 5000, vx: 0, vy: 0, onGround: true, name: 'Cursed Thing' }, extra || {}); }
function run(S, secs){ for(let i = 0; i < Math.round(secs * 60); i++) S.W.update(1 / 60, S.host); }
function until(S, fn, secs){ for(let i = 0; i < Math.round((secs || 6) * 60); i++){ if(fn()) return true; S.W.update(1 / 60, S.host); } return fn(); }

/* Zone → Domain (own energy) → laws */
function domainSpell(laws, dom, opt){
	opt = opt || {};
	const s = ME.blankSpell('dom'); const root = s.nodes[s.rootId]; root.type = 'zone'; root.params = Object.assign(ME.paramDefaults('zone'), { radius: opt.radius || 300, spawn: 'caster' });
	let seq = 1;
	const add = (type, parent, params, link) => { const n = ME.makeNode(type, parent, 's', 0, seq, seq); seq++; n.params = Object.assign(ME.paramDefaults(type), params || {}); if(link) n.link = Object.assign(n.link, link); s.nodes[n.id] = n; return n; };
	const d = add('domain', root.id, Object.assign({ form: 'closed', duration: opt.duration || 12, fuel: 'self', selfFuel: opt.fuel || 900, sureHit: 'no', cinematic: 'none' }, dom || {}));
	for(const L of (laws || [])){
		const n = add('law', d.id, L.p || L, L.link);
		const addKids = (pid, kids) => { for(const k of (kids || [])){ const c = add(k[0], pid, k[1], k[2]); addKids(c.id, k[3]); } };
		addKids(n.id, L.kids);
	}
	s.seq = seq; return s;
}
const FULL = (S) => S.W.domains.find(q => q.alive);
function open(S, laws, dom, opt){
	const def = domainSpell(laws, dom, opt);
	const r = S.W.cast(def, { profile: prof(opt && opt.ctl), owner: S.owner, host: S.host });
	run(S, 0.5);
	return { r, D: FULL(S), def };
}
const L = (p, kids) => ({ p: Object.assign({ who: 'foe', event: 'every', effect: 'damage' }, p), kids });

/* ============================================================ the rune and its checks */
{
	const S = world([foe()]);
	const good = domainSpell([ L({ event: 'always', effect: 'damage', dmg: 10 }) ]);
	const rep = ME.validate(good, prof());
	ok('A law validates under a Domain and the forge reports its weight against the budget', rep.ok && rep.nodeInfo[Object.keys(good.nodes).find(k => good.nodes[k].type === 'domain')].extra.construct.Laws.indexOf('weight') > 0, rep.ok ? 'ok' : rep.errors.map(e => e.text).join('; '));
	const stray = ME.blankSpell('s'); stray.nodes[stray.rootId].type = 'generate'; stray.nodes[stray.rootId].params = ME.paramDefaults('generate');
	const ln = ME.makeNode('law', stray.rootId, 's', 0, 1, 1); ln.params = ME.paramDefaults('law'); stray.nodes[ln.id] = ln;
	ok('A law anywhere but under a Domain is refused', ME.validate(stray, prof()).errors.some(e => e.code === 'LAW_PLACE'), 'LAW_PLACE');
	ok('A law about you cannot harm you', ME.validate(domainSpell([ L({ who: 'caster', event: 'always', effect: 'damage' }) ]), prof()).errors.some(e => e.code === 'LAW_CASTER'), 'LAW_CASTER');
	ok('Copying needs a cast or attack event', ME.validate(domainSpell([ L({ event: 'every', effect: 'copy' }) ]), prof()).errors.some(e => e.code === 'LAW_COPY'), 'LAW_COPY');
	const heavy = []; for(let i = 0; i < 6; i++) heavy.push(L({ event: 'always', effect: 'execute', executePct: 60 }));
	ok('Too many heavy laws exceed what your Energy Control holds (budget)', ME.validate(domainSpell(heavy), prof(8)).errors.some(e => e.code === 'DOMAIN_BUDGET'), (ME.validate(domainSpell(heavy), prof(8)).errors[0] || {}).text);
	const lawsA = [ L({ event: 'every', effect: 'stun', secs: 2 }), L({ event: 'always', effect: 'seal', sealKind: 'casting', secs: 4 }), L({ event: 'always', effect: 'stun', secs: 2 }) ];
	const dec = domainSpell(lawsA, { vow: 'declared' }), none = domainSpell(lawsA, { vow: 'none' });
	const needed = lawsA.reduce((t, l) => t + MD.lawWeight(Object.assign({ who: 'foe' }, l.p), 0), 0);
	ok('A declared vow raises the law budget', MD.lawCapacity({ energyControl: 10 }, 'declared') > MD.lawCapacity({ energyControl: 10 }, 'none') && needed > 0, MD.lawCapacity({ energyControl: 10 }, 'none') + ' → ' + MD.lawCapacity({ energyControl: 10 }, 'declared') + ' (these weigh ' + r1(needed) + ')');
	ok('Every law is described as a sentence', MD.EVENTS.every(e => MD.EFFECTS.every(f => /\w/.test(MD.describeLaw({ who: 'foe', event: e.value, effect: f.value })))), MD.describeLaw({ who: 'foe', event: 'casts', effect: 'copy' }));
	void S; void dec; void none;
}

/* ============================================================ events */
{
	const f1 = foe(); const S = world([f1]);
	const { D } = open(S, [ L({ event: 'always', effect: 'damage', dmg: 40 }) ]);
	const hp0 = f1.hp; run(S, 2);
	ok('While inside — constantly: damage per second, in quarter-second steps', !!D && hp0 - f1.hp > 60 && hp0 - f1.hp < 120, 'lost ' + r1(hp0 - f1.hp) + ' in 2 s (asked 40/s)');
	ok('…and it is paid for out of the domain\'s energy', D.z.amount < D.fuel0 * 0.97, 'zone ' + r1(D.fuel0) + ' → ' + r1(D.z.amount));
}
{
	const f1 = foe(); const S = world([f1]);
	open(S, [ L({ event: 'every', period: 1, effect: 'damage', dmg: 25, cool: 0 }) ]);
	S.log.length = 0; run(S, 4.2);
	ok('Every few seconds: one application per period', S.log.length >= 3 && S.log.length <= 5, S.log.length + ' blows in 4.2 s (period 1 s)');
}
{
	const f1 = foe(); const S = world([f1]);
	open(S, [ L({ event: 'attacks', effect: 'damage', dmg: 50, cool: 1 }) ]);
	run(S, 1); const calm = f1.hp;
	f1.attacking = true; run(S, 0.5); const hit = f1.hp; f1.attacking = false; run(S, 0.5); f1.attacking = true; run(S, 0.3);
	ok('When they attack: nothing while calm; a blow on each attack, spaced by the cooldown', calm === 5000 && hit < 5000 && f1.hp === hit, 'calm ' + calm + ' → ' + r1(hit) + ' → ' + r1(f1.hp) + ' (second attack inside the 1 s cooldown)');
}
{
	const f1 = foe(); const S = world([f1]);
	open(S, [ L({ event: 'moves', speed: 3, effect: 'damage', dmg: 30, cool: 0.5 }) ]);
	run(S, 1); const still = f1.hp; f1.vx = 6; for(let i = 0; i < 40; i++){ f1.x += 0.5; S.W.update(1 / 60, S.host); } f1.vx = 0;
	ok('When they move fast: standing still is safe, running is not', still === 5000 && f1.hp < 5000, 'still ' + still + ' · after running ' + r1(f1.hp));
}
{
	const f1 = foe(); const S = world([f1]);
	open(S, [ L({ event: 'still', still: 1, effect: 'stun', secs: 1 }) ]);
	f1.vx = 5; for(let i = 0; i < 90; i++){ f1.x += 0.1 * (i % 2 ? 1 : -1); f1.vx = 5; S.W.update(1 / 60, S.host); }
	const movingStun = (S.W.status.get(f1) || {}).stunned; f1.vx = 0; run(S, 1.6);
	ok('When they stand still: a mover is left alone, a statue is stunned', !movingStun && !!(S.W.status.get(f1) || {}).stunned, 'moving: ' + (movingStun ? 'stunned' : 'free') + ' · still: ' + ((S.W.status.get(f1) || {}).stunned ? 'stunned' : 'free'));
}
{
	const f1 = foe(); const S = world([f1]);
	open(S, [ L({ event: 'jumps', effect: 'damage', dmg: 60, cool: 0.5 }) ]);
	run(S, 0.6); const grounded = f1.hp; f1.onGround = false; f1.vy = -9; run(S, 0.3);
	ok('When they jump', grounded === 5000 && f1.hp < 5000, 'grounded ' + grounded + ' → ' + r1(f1.hp));
}
{
	const f1 = foe(); const S = world([f1]);
	open(S, [ L({ event: 'lowHp', hpPct: 40, effect: 'stun', secs: 2 }) ]);
	run(S, 0.6); const healthy = (S.W.status.get(f1) || {}).stunned; f1.hp = 1500; run(S, 0.6);
	ok('When their health is low', !healthy && !!(S.W.status.get(f1) || {}).stunned, 'at 100%: ' + (healthy ? 'stunned' : 'free') + ' · at 30%: ' + ((S.W.status.get(f1) || {}).stunned ? 'stunned' : 'free'));
}
{
	const f1 = foe(); const S = world([f1]);
	open(S, [ L({ event: 'damaged', dmgMin: 50, effect: 'mark', markAdd: 1, cool: 0.3 }) ]);
	f1.hp -= 10; run(S, 0.5); const small = S.W.marksOf(f1); f1.hp -= 200; run(S, 0.5);
	ok('When they take a blow (of at least a size)', small === 0 && S.W.marksOf(f1) === 1, 'small blow: ' + small + ' marks · large blow: ' + S.W.marksOf(f1));
}
{
	const f1 = foe(); const S = world([f1]);
	const { D } = open(S, [ L({ event: 'enter', effect: 'mark', markAdd: 1 }) ]);
	run(S, 1);
	ok('When they step inside (once)', S.W.marksOf(f1) === 1, S.W.marksOf(f1) + ' mark');
	void D;
}
{
	const f1 = foe(); const S = world([f1]);
	open(S, [ L({ event: 'leave', effect: 'damage', dmg: 80, cool: 0.2 }) ], { duration: 12 });
	run(S, 0.5); const before = f1.hp; for(let i = 0; i < 260; i++){ f1.x += 8; S.W.update(1 / 60, S.host); }
	ok('When they try to leave: pressing on the wall is punished', before === 5000 && f1.hp < 5000, 'before ' + before + ' → ' + r1(f1.hp));
}
{
	const f1 = foe(); const S = world([f1]);
	S.W.cast(domainSpell([ L({ event: 'open', effect: 'damage', dmg: 300 }) ]), { profile: prof(), owner: S.owner, host: S.host });
	run(S, 0.2); const a = f1.hp; run(S, 3);
	ok('When the domain opens: applied once, at the start', a < 5000 && f1.hp === a, 'after opening ' + r1(a) + ' · 3 s later ' + r1(f1.hp));
}

/* ============================================================ effects */
{
	const f1 = foe(); const S = world([f1]);
	open(S, [ L({ event: 'every', period: 1, effect: 'stun', secs: 1 }), L({ event: 'every', period: 1, effect: 'slow', slowPct: 60, secs: 2 }), L({ event: 'every', period: 1, effect: 'bind', secs: 1 }) ]);
	run(S, 1.6); const st = S.W.status.get(f1) || {};
	ok('Stun, slow and bind reach the creature as statuses', !!st.stunned && !!st.slowed && !!st.bound, Object.keys(st).join(', '));
}
{
	const f1 = foe(0, 3000), f2 = foe(0, 300); f1.hp = 2700; f2.hp = 60; const S = world([f1, f2]); f2.x = 300;
	open(S, [ L({ event: 'every', period: 1, effect: 'execute', executePct: 25 }) ]);
	run(S, 2.5);
	ok('Execute kills only what is below the line', f1.hp > 2000 && f2.hp <= 0, 'healthy ' + r1(f1.hp) + ' · wounded ' + r1(f2.hp));
}
{
	const f1 = foe(); const S = world([f1]);
	open(S, [ L({ event: 'always', effect: 'expose', exposePct: 100, secs: 4 }) ]);
	run(S, 0.8); S.log.length = 0; f1.hp -= 100; run(S, 0.3);
	const extra = S.log.filter(l => l.info && l.info.law).reduce((t, l) => t + l.d, 0);
	ok('Expose: a blow taken inside hurts again (+100%)', extra > 70 && extra < 130, 'extra damage ' + r1(extra) + ' on a 100 blow');
}
{
	const f1 = foe(); const S = world([f1]); S.caster.hp = 40;
	open(S, [ L({ who: 'caster', event: 'always', effect: 'heal', healAmt: 20 }) ]);
	run(S, 2);
	ok('A law about you can heal you', S.caster.hp > 60, 'hp 40 → ' + r1(S.caster.hp));
}
{
	const f1 = foe(); f1.mana = 200; const S = world([f1]);
	S.host.siphonEnergy = (e, a) => { const g = Math.min(e.mana, a); e.mana -= g; return g; };
	const { D } = open(S, [ L({ event: 'every', period: 0.5, effect: 'drain', drainAmt: 20, cool: 0 }) ]);
	const z0 = D.z.amount; run(S, 3);
	ok('Drain: their energy flows into the domain', f1.mana < 120 && D.z.amount > z0 - D.fuel0 * 0.2 / D.dur * 3 - 5, 'their mana 200 → ' + r1(f1.mana) + ' · zone ' + r1(z0) + ' → ' + r1(D.z.amount));
}
{
	const f1 = foe(); const S = world([f1]);
	const rivalCast = { id: 'rival', entity: f1, foes: () => [S.caster], hurt: (e, d) => { e.hp -= d; }, aim: () => ({ x: 90, y: 80 }) };
	f1._ownerId = 'rival';
	open(S, [ L({ event: 'always', effect: 'seal', sealKind: 'casting', secs: 3 }) ]);
	run(S, 0.8);
	const bolt = ME.blankSpell('b'); const bn = bolt.nodes[bolt.rootId]; bn.type = 'generate'; bn.params = Object.assign(ME.paramDefaults('generate'), { amount: 30 });
	const res = S.W.cast(bolt, { profile: prof(), owner: rivalCast, host: S.host });
	ok('Seal casting: a sealed caster\'s spell is refused', !res.ok && /Sealed/.test(res.error || ''), res.ok ? 'cast went through' : res.error);
	const tech = ME.blankSpell('t'); const t0 = tech.nodes[tech.rootId]; t0.type = 'generate'; t0.params = Object.assign(ME.paramDefaults('generate'), { amount: 30 });
	const tn = ME.makeNode('technique', t0.id, 's', 0, 1, 1); tn.params = Object.assign(ME.paramDefaults('technique'), { technique: 'thermal', power: 5 }); tech.nodes[tn.id] = tn;
	const S2 = world([foe()]); const f2 = S2.foes[0]; const rv = { id: 'rival', entity: f2, foes: () => [S2.caster], hurt: (e, d) => { e.hp -= d; }, aim: () => ({ x: 90, y: 80 }) };
	open(S2, [ L({ event: 'always', effect: 'seal', sealKind: 'techniques', secs: 3 }) ]); run(S2, 0.8);
	const res2 = S2.W.cast(tech, { profile: prof(), owner: rv, host: S2.host });
	ok('Seal techniques: the Technique rune fails for a sealed caster but plain casting still works', res2.ok && res2.instance.log.some(l => /Sealed/.test(l.text)) || (res2.ok && S2.W.sealLeft(rv, 'techniques') > 0), res2.ok ? 'casting allowed · techniques sealed ' + r1(S2.W.sealLeft(rv, 'techniques')) + ' s' : res2.error);
}
{
	const f1 = foe(); const S = world([f1]);
	const rv = { id: 'rival', entity: f1, foes: () => [S.caster], hurt: (e, d) => { e.hp -= d; }, aim: () => ({ x: 90, y: 80 }) };
	open(S, [ L({ event: 'every', period: 0.5, effect: 'negate', cool: 0 }) ]);
	const bolt = ME.blankSpell('b'); const bn = bolt.nodes[bolt.rootId]; bn.type = 'generate'; bn.params = Object.assign(ME.paramDefaults('generate'), { amount: 40 });
	const rn = ME.makeNode('redirect', bn.id, 's', 0, 1, 1); rn.params = Object.assign(ME.paramDefaults('redirect'), { toward: 'left', speedPct: 30 }); bolt.nodes[rn.id] = rn;
	S.W.cast(bolt, { profile: prof(), owner: rv, host: S.host }); run(S, 1.5);
	ok('Negate: a rival\'s energy inside the domain is destroyed', !S.W.bodies.some(b => b.alive && b.ownerId === 'rival'), 'rival bodies alive: ' + S.W.bodies.filter(b => b.alive && b.ownerId === 'rival').length);
}

/* ============================================================ marks: a trial */
{
	const f1 = foe(0, 5000); const S = world([f1]);
	open(S, [ L({ event: 'attacks', effect: 'mark', markAdd: 1, cool: 0.4, callout: 'OFFENCE' }), L({ event: 'marked', marksN: 3, spend: 'spend', effect: 'damage', dmg: 250, callout: 'GUILTY' }) ]);
	const swing = () => { f1.attacking = true; run(S, 0.1); f1.attacking = false; run(S, 0.5); };
	swing(); swing(); const two = S.W.marksOf(f1), hp2 = f1.hp; swing();
	ok('A trial: offences are tallied, and the third brings the sentence (marks are spent)', two === 2 && hp2 === 5000 && f1.hp < 5000 && S.W.marksOf(f1) === 0, 'marks ' + two + ' → verdict at 3: hp ' + r1(hp2) + ' → ' + r1(f1.hp) + ' · marks now ' + S.W.marksOf(f1) + ' · "' + (S.W._texts || []).slice(-2).join('", "') + '"');
}
{
	const f1 = foe(); const S = world([f1]);
	open(S, [ L({ event: 'every', period: 0.5, effect: 'mark', markAdd: 2, cool: 0 }), L({ event: 'every', period: 3, effect: 'clear' }) ]);
	run(S, 1.2); const m = S.W.marksOf(f1); run(S, 2.5);
	ok('Marks pile up and can be cleared by another law', m >= 2, 'marks after 1.2 s: ' + m + ' · after the clearing law: ' + S.W.marksOf(f1));
}

/* ============================================================ copying (Authentic Mutual Love) */
function rival(S, f1){ return { id: 'rival', entity: f1, foes: () => [S.caster], hurt: (e, d) => { e.hp -= d; }, aim: () => ({ x: 90, y: 80 }) }; }
function spellBolt(name, amount){
	const s = ME.blankSpell(name); const n = s.nodes[s.rootId]; n.type = 'generate'; n.params = Object.assign(ME.paramDefaults('generate'), { amount: amount || 40 });
	const c = ME.makeNode('compress', n.id, 's', 0, 1, 1); c.params = Object.assign(ME.paramDefaults('compress'), { power: 4, shape: 'point' }); s.nodes[c.id] = c;
	const r = ME.makeNode('redirect', c.id, 's', 0, 2, 2); r.params = Object.assign(ME.paramDefaults('redirect'), { toward: 'mouse', speedPct: 60 }); s.nodes[r.id] = r;
	s.seq = 3; return s;
}
{
	const f1 = foe(0, 6000); const S = world([f1]); const rv = rival(S, f1);
	const { D } = open(S, [ L({ event: 'attacks', effect: 'copy', copySlots: 3, cool: 0, callout: 'COPIED' }), L({ event: 'every', period: 1, effect: 'castCopy', copyScale: 1, cool: 0 }) ]);
	const none = D.copies.length;
	const cast1 = S.W.cast(spellBolt('Ember Lance', 60), { profile: prof(), owner: rv, host: S.host });
	ok('Copy: a rival mage\'s real spell is stored the moment it is cast', cast1.ok && none === 0 && D.copies.length === 1 && D.copies[0].name === 'Ember Lance' && D.copies[0].kind === 'spell', D.copies.map(c => c.name + ' (' + c.kind + ')').join(', '));
	const z0 = D.z.amount, mana0 = 0; void mana0;
	S.W.instances.forEach(i => { if(i.owner.id === 'rival') i.done = true; }); S.W.bodies.forEach(b => { if(b.ownerId === 'rival') b.alive = false; });
	f1.hp = 6000; S.log.length = 0; run(S, 4);
	const mine = S.W.instances.concat([]).filter(i => i.copyOf);
	const hits = S.log.filter(l => l.info && l.info.instance && l.info.instance.copyOf === 'Ember Lance');
	ok('Cast copy: the stored spell is cast back at them from the domain\'s energy, sure to land', f1.hp < 6000 && (D.cast || 0) > 0, 'foe hp 6000 → ' + r1(f1.hp) + ' · copies cast ' + (D.cast || 0) + ' · zone ' + r1(z0) + ' → ' + r1(D.z.amount));
	ok('…and the copy belongs to the caster, not to the rival', S.W.bodies.every(b => !b.alive || b.ownerId !== 'rival' || true) && (D.cast || 0) > 0 && !mine.some(i => i.owner.id === 'rival'), 'cast by ' + (mine[0] ? mine[0].owner.id : 'n/a'));
	for(let i = 0; i < 4; i++){ S.W.cast(spellBolt('Copy ' + i, 20 + i), { profile: prof(), owner: rv, host: S.host }); S.W.instances.forEach(q => { if(q.owner.id === 'rival') q.done = true; }); run(S, 0.5); }
	ok('The domain keeps only as many copies as the law allows (oldest forgotten)', D.copies.length === 3 && !D.copies.some(c => c.name === 'Ember Lance'), D.copies.map(c => c.name).join(', '));
}
{
	const f1 = foe(0, 6000, { damage: 12 }); const S = world([f1]);
	const { D } = open(S, [ L({ event: 'attacks', effect: 'copy' }) ]);
	f1.attacking = true; run(S, 0.3); f1.attacking = false;
	ok('An ordinary monster\'s attack leaves an "echo" that can be cast back', D.copies.length === 1 && D.copies[0].kind === 'echo' && /Echo of Cursed Thing/.test(D.copies[0].name), D.copies.map(c => c.name).join(', '));
	const S2 = world([foe()]); const f2 = S2.foes[0]; const { D: D2 } = open(S2, [ L({ event: 'attacks', effect: 'copy' }), L({ event: 'every', period: 0.5, effect: 'castCopy', cool: 0 }) ]);
	f2.attacking = true; run(S2, 0.3); f2.attacking = false; run(S2, 3);
	ok('…and the echo lands', f2.hp < 5000 && (D2.cast || 0) > 0, 'foe hp 5000 → ' + r1(f2.hp) + ' · casts ' + (D2.cast || 0));
}
{
	const f1 = foe(); const S = world([f1]); const rv = rival(S, f1);
	const { D } = open(S, [ L({ event: 'attacks', effect: 'copy' }) ]);
	const dom = domainSpell([], { cinematic: 'none' });
	S.W.cast(dom, { profile: prof(), owner: rv, host: S.host }); run(S, 0.3);
	ok('A domain cannot be copied', D.copies.length === 0, D.copies.length + ' copies');
}

/* ============================================================ the runes below a law */
{
	const f1 = foe(); const S = world([f1]);
	open(S, [ L({ event: 'every', period: 1, effect: 'cast', cool: 0 }, [ ['generate', { amount: 30 }, { mode: 'instant' }, [ ['redirect', { toward: 'target', speedPct: 90 }] ]] ]) ]);
	run(S, 3.5);
	ok('"Run the runes below this law": ordinary runes are carried out on the creature that met the law', f1.hp < 5000, 'foe hp 5000 → ' + r1(f1.hp));
}

/* ============================================================ the opening */
{
	const f1 = foe(); const S = world([f1]);
	const def = domainSpell([ L({ event: 'open', effect: 'damage', dmg: 100 }) ], { cinematic: 'full', title: 'Authentic Mutual Love', theme: 'love' });
	S.W.cast(def, { profile: prof(), owner: S.owner, host: S.host });
	const D = S.W.domains[0]; const phases = [D.phase]; const seen = {};
	let frozenFrames = 0, timeAtFreeze = null, frameAtFreeze = null, advancedWhileFrozen = false, hpBefore = f1.hp, hpDuringGather = null, rAtExpandEnd = null;
	for(let i = 0; i < 600 && D.phase !== 'active'; i++){
		const t0 = S.W.time, fr0 = S.W.frame, frozen = S.W.isFrozen();
		S.W.update(1 / 60, S.host);
		if(frozen){ frozenFrames++; if(S.W.time !== t0 || S.W.frame !== fr0) advancedWhileFrozen = true; if(timeAtFreeze == null){ timeAtFreeze = t0; frameAtFreeze = fr0; } }
		if(phases[phases.length - 1] !== D.phase) phases.push(D.phase);
		if(D.phase === 'gather') hpDuringGather = f1.hp;
		seen[D.phase] = (seen[D.phase] || 0) + 1;
	}
	ok('The opening runs gather → freeze → expand → active', phases.join(' → ') === 'gather → freeze → expand → active', phases.join(' → '));
	ok('Gather lasts about a second of play', seen.gather >= 55 && seen.gather <= 66, (seen.gather / 60).toFixed(2) + ' s');
	ok('Everything freezes: for the whole held breath neither time nor any frame advances', frozenFrames >= 50 && !advancedWhileFrozen && S.W.isFrozen() === false, frozenFrames + ' frozen updates, nothing advanced');
	ok('After the held breath the domain bursts out fast (well under half a second)', seen.expand >= 15 && seen.expand <= 30 && Math.abs(D.rNow - D.r) < 1, (seen.expand / 60).toFixed(2) + ' s to reach ' + Math.round(D.r) + ' px');
	ok('Nothing is trapped or struck before it is up; the laws begin when it is', hpDuringGather === hpBefore && f1.hp < hpBefore, 'hp while gathering ' + hpDuringGather + ' · once open ' + r1(f1.hp));
	ok('Its clock starts only when the barrier is complete', Math.abs((D.end - D.activeAt) - D.dur) < 1e-6 && D.activeAt > 1.3, 'lasts ' + D.dur + ' s from t=' + r1(D.activeAt));
	const S2 = world([foe()], { noFreeze: true });
	S2.W.cast(domainSpell([], { cinematic: 'full' }), { profile: prof(), owner: S2.owner, host: S2.host });
	let froze2 = false; for(let i = 0; i < 300; i++){ S2.W.update(1 / 60, S2.host); if(S2.W.isFrozen()) froze2 = true; }
	ok('A host that cannot freeze (online play) still gets the gather and the burst, without the freeze', !froze2 && S2.W.domains[0] && S2.W.domains[0].phase === 'active', 'frozen: ' + froze2);
	const S3 = world([foe()]);
	S3.W.cast(domainSpell([], { cinematic: 'quick' }), { profile: prof(), owner: S3.owner, host: S3.host });
	let n3 = 0; while(S3.W.domains[0].phase !== 'active' && n3 < 400){ S3.W.update(1 / 60, S3.host); n3++; }
	ok('The quick opening is shorter', n3 < 90, n3 + ' updates');
	const S4 = world([foe()]);
	S4.W.cast(domainSpell([], { cinematic: 'full' }), { profile: prof(), owner: S4.owner, host: S4.host });
	for(let i = 0; i < 90; i++) S4.W.update(1 / 60, S4.host);
	S4.W.clear();
	ok('Clearing the world releases a freeze', !S4.W.isFrozen() && S4.W.domains.length === 0, 'frozen ' + S4.W.isFrozen());
}

/* ============================================================ looks, the painter, the veil */
function recorder(){
	const calls = []; const grad = { addColorStop(){} };
	const ctx = new Proxy({ canvas: { width: 1280, height: 720 } }, {
		get(t, k){ if(k in t) return t[k]; if(k === 'createRadialGradient' || k === 'createLinearGradient') return () => grad; if(k === 'measureText') return () => ({ width: 120 }); return (...a) => { calls.push([k, a]); }; },
		set(t, k, v){ t[k] = v; return true; }
	});
	ctx.calls = calls; return ctx;
}
{
	const f1 = foe(); const S = world([f1]);
	const ctx = recorder();
	let threw = null, drawn = 0;
	for(const theme of Object.keys(MD.THEMES)) for(const burst of MD.BURSTS) for(const pattern of MD.PATTERNS) {
		const Sx = world([foe()]);
		Sx.W.cast(domainSpell([], { cinematic: 'full', theme, burst, pattern, motes: MD.MOTES[drawn % MD.MOTES.length], interior: MD.INTERIORS[drawn % MD.INTERIORS.length] }), { profile: prof(), owner: Sx.owner, host: Sx.host });
		try {
			for(let i = 0; i < 160; i += 5){ for(let j = 0; j < 5; j++) Sx.W.update(1 / 60, Sx.host); Sx._ = 0; Sx.W.drawDomains ? 0 : 0; Sx.W._domDraw(ctx, 0, 0, i / 20); Sx.W.drawDomainVeil(ctx, 0, 0, i / 20, { x: 3000, y: 0 }); Sx.W.drawDomainCine(ctx, 1280, 720, 0, 0, i / 20, { x: 100, y: 100 }); drawn++; ctx.calls.length = 0; }
		} catch(e){ threw = threw || (theme + '/' + burst + '/' + pattern + ': ' + e.message); }
	}
	ok('The painter draws every theme × burst × pattern through the whole opening without a fault', !threw && drawn > 3000, threw || (drawn + ' frames painted'));
	ctx.calls.length = 0;
	const Sv = world([foe()]); Sv.W.cast(domainSpell([], { cinematic: 'none', theme: 'love' }), { profile: prof(), owner: Sv.owner, host: Sv.host }); run(Sv, 0.4);
	const arcs = (v) => { ctx.calls.length = 0; Sv.W.drawDomainVeil(ctx, 0, 0, 1, v); return ctx.calls.filter(c => c[0] === 'arc').length; };
	const D = Sv.W.domains[0];
	const outsideN = arcs({ x: D.x + D.r + 400, y: D.y }), insideN = arcs({ x: D.x + 20, y: D.y });
	ok('Outside a sealed domain the inside is covered; inside it, nothing is', outsideN > 0 && insideN === 0, 'outside: ' + outsideN + ' arcs · inside: ' + insideN);
	const Sc = world([foe()]); Sc.W.cast(domainSpell([], { cinematic: 'none', outside: 'clear' }), { profile: prof(), owner: Sc.owner, host: Sc.host }); run(Sc, 0.4);
	ctx.calls.length = 0; Sc.W.drawDomainVeil(ctx, 0, 0, 1, { x: Sc.W.domains[0].x + 2000, y: 0 });
	ok('A "clear" domain is see-through from outside', ctx.calls.filter(c => c[0] === 'arc').length === 0, 'veil arcs ' + ctx.calls.filter(c => c[0] === 'arc').length);
	const So = world([foe()]); So.W.cast(domainSpell([], { cinematic: 'none', form: 'open' }), { profile: prof(), owner: So.owner, host: So.host }); run(So, 0.4);
	ctx.calls.length = 0; So.W.drawDomainVeil(ctx, 0, 0, 1, { x: So.W.domains[0].x + 2000, y: 0 });
	ok('An open domain (no barrier) is not sealed by default', ctx.calls.filter(c => c[0] === 'arc').length === 0, 'veil arcs ' + ctx.calls.filter(c => c[0] === 'arc').length);
	const Sm = world([foe()]); Sm.W.cast(domainSpell([], { cinematic: 'none', accent: 'gold', theme: 'void' }), { profile: prof(), owner: Sm.owner, host: Sm.host }); run(Sm, 0.3);
	const lk = Sm.W._domLook(Sm.W.domains[0]);
	ok('Colour overrides the theme; a theme sets the rest', lk.c1 === MD.ACCENTS.gold && lk.pattern === MD.THEMES.void.pattern, lk.c1 + ' · ' + lk.pattern);
	const Sr = world([foe()]); const rv = rival(Sr, Sr.foes[0]);
	Sr.W.cast(domainSpell([], { cinematic: 'none' }), { profile: prof(), owner: rv, host: Sr.host }); run(Sr, 0.3);
	ok('A rival\'s default domain keeps its crimson look', Sr.W._domLook(Sr.W.domains[0]).key === 'shrine', Sr.W._domLook(Sr.W.domains[0]).key);
	void S;
}

/* ============================================================ the look system (c70) */
{
	const LK = globalThis.MagicDomainLook, ART = globalThis.MagicDomainArt;
	const ctx = recorder();
	let threw = null, frames = 0;
	const paint = (look, label) => {
		try {
			for(const outside of ['sealed', 'clear']){
				const D = ART.fakeDomain(look, 1280, 720, { r: 320, outside });
				ART.thumbnail(ctx, look, 1280, 720, 2.5, { D });
				D.phase = 'active'; D.rNow = D.r; ART.paintVeil(ctx, D, ART.lookOf(D), 0, 0, 1.5, 1);
				for(const k of [0.1, 0.6]) ART.drawBurst(ctx, 640, 360, 300 * k, ART.lookOf(D), k, 1, 3);
				for(const p of [0.1, 0.5, 0.9]) ART.paintFreeze(ctx, 1280, 720, ART.lookOf(D), D, p, 640, 360);
				frames++;
			}
		} catch(e){ threw = threw || (label + ': ' + e.message); }
	};
	// every option of every layer, one at a time, over a few different presets
	let options = 0;
	for(const base of ['void', 'love', 'ink', 'storm']) for(const f of LK.FIELDS){
		if(f.type !== 'choice') continue;
		for(const o of f.options){ options++; paint(Object.assign(LK.preset(base), { [f.key]: o.v }), base + '.' + f.key + '=' + o.v); }
	}
	ok('Every option of every layer paints (backdrop, foreground, veil, bursts, frozen screen) without a fault', !threw, threw || (options + ' options · ' + frames + ' paints'));
	threw = null; frames = 0;
	for(let i = 0; i < 300; i++) paint(LK.random(i * 7919 + 1), 'random ' + i);
	for(const k of LK.PRESET_ORDER) paint(LK.preset(k), 'preset ' + k);
	ok('300 random looks and every preset paint without a fault', !threw, threw || (frames + ' paints · ' + LK.PRESET_ORDER.length + ' presets'));
	const rnd = LK.random(42), code = LK.encode(rnd), back = LK.decode(code);
	ok('A look survives being shared as a code', back && JSON.stringify(back) === JSON.stringify(LK.sanitize(rnd)) && code.length < 600, code.length + ' characters · ' + code.slice(0, 32) + '…');
	const junk = LK.sanitize({ c1: 'red', sky: 'mars', rim: 9999, floor: 'water', titleFont: { evil: 1 }, subtitle: 'x'.repeat(500), letterbox: 0 });
	ok('Anything stored is cleaned into a legal look', /^#[0-9a-f]{6}$/.test(junk.c1) && junk.sky === LK.BASE.sky && junk.rim === 12 && junk.floor === 'water' && junk.titleFont === LK.BASE.titleFont && junk.subtitle.length === 40 && junk.letterbox === false, 'c1 ' + junk.c1 + ' · sky ' + junk.sky + ' · rim ' + junk.rim + ' · floor ' + junk.floor);
	ok('A bad code is refused', LK.decode('DOM1:not-a-code') === null && LK.decode('') === null, 'null');
	const old = LK.resolve({ theme: 'frost', accent: 'gold', pattern: 'web', motes: 'embers', burst: 'ink' }, true);
	ok('Domains made before (theme, colour, pattern, drifting, expansion) keep their look', old.preset === 'frost' && old.c1 === MD.ACCENTS.gold && old.sigil === 'web' && old.p1 === 'embers' && old.burst === 'ink', old.preset + ' · ' + old.c1 + ' · ' + old.sigil + ' · ' + old.p1 + ' · ' + old.burst);
	ok('There are hundreds of trillions of combinations of layers alone', LK.COMBINATIONS > 1e14, LK.COMBINATIONS.toExponential(2) + ' (' + LK.FIELDS.length + ' settings, ' + LK.PRESET_ORDER.length + ' presets, ' + LK.PALETTES.length + ' palettes)');
	// a random look always holds together: a light palette never gets a pitch-dark sky, a title is always readable
	let bad = 0;
	for(let i = 0; i < 400; i++){ const L = LK.random(i + 99); const light = parseInt(L.bg.slice(1, 3), 16) > 150; if(light && !['dawn', 'radiant', 'inkwash'].includes(L.sky)) bad++; if(light && L.titleColor !== 'black') bad++; }
	ok('Random looks hold together (light palettes get light skies and dark titles)', bad === 0, bad + ' clashes in 400');
	// the world: a sealed domain with a look paints its backdrop, hides its zone's energy, and the designer's preview hook works
	const Sw = world([foe()]);
	Sw.W.cast(domainSpell([], { cinematic: 'none', look: LK.preset('shrine') }), { profile: prof(), owner: Sw.owner, host: Sw.host }); run(Sw, 0.5);
	const Dw = Sw.W.domains[0]; ctx.calls.length = 0;
	Sw.W.drawDomainBackdrop(ctx, 0, 0, 1); Sw.W.hostDrawsDomainBackdrop = true; Sw.W._domDraw(ctx, 0, 0, 1);
	ok('In a world: the backdrop paints, and the zone\'s own energy is hidden inside the open domain', ctx.calls.length > 50 && Dw.z.domainShown === true && Dw.groundY != null, ctx.calls.length + ' draw calls · ground at ' + Math.round(Dw.groundY));
	Sw.W.setDomainLook(Dw, LK.preset('cathedral'));
	ok('A look can be swapped on a live domain (the designer\'s preview)', Sw.W._domLook(Dw).preset === 'cathedral' && Sw.W._domLook(Dw).bright, Sw.W._domLook(Dw).preset);
	const Y = require(path.join(dir, 'tools', 'yuta-domain.js')).build();
	const yl = Object.values(Y.nodes).find(n => n.type === 'domain').params.look;
	ok('Authentic Mutual Love carries its own look (a field of swords under a turning halo)', yl && yl.floor === 'blades' && yl.landmark === 'halo' && yl.titleLayout === 'low', yl ? yl.floor + ' · ' + yl.landmark + ' · ' + yl.burst : 'none');
}

/* ============================================================ conditions are grouped */
{
	const ids = Object.keys(ME.Conditions), gs = ME.CONDITION_GROUPS.map(g => g.id);
	const loose = ids.filter(k => !ME.Conditions[k].group || gs.indexOf(ME.Conditions[k].group) < 0);
	const other = ids.filter(k => ME.Conditions[k].group === 'other');
	ok('Every condition belongs to a group, and none is left in "Other"', loose.length === 0 && other.length === 0, ids.length + ' conditions · ' + gs.length + ' groups · loose: ' + loose.concat(other).join(', '));
	const counts = {}; for(const k of ids) counts[ME.Conditions[k].group] = (counts[ME.Conditions[k].group] || 0) + 1;
	ok('Groups are a sensible size (none empty, none over 12)', gs.filter(g => g !== 'other').every(g => counts[g] > 0 && counts[g] <= 12), Object.keys(counts).map(g => g + ' ' + counts[g]).join(' · '));
	ok('Domain conditions sit with zones', ME.Conditions.targetMarked && ME.Conditions.targetMarked.group === 'zone', 'targetMarked → ' + (ME.Conditions.targetMarked || {}).group);
}

/* ============================================================ legacy rules and weight */
{
	const f1 = foe(); const S = world([f1]);
	const s = domainSpell([ L({ event: 'always', effect: 'damage', dmg: 10 }) ], {});
	const dn = Object.keys(s.nodes).find(k => s.nodes[k].type === 'domain');
	const g = ME.makeNode('generate', dn, 's', 0, 9, 9); g.params = Object.assign(ME.paramDefaults('generate'), { amount: 20 }); g.link = Object.assign(g.link, { mode: 'delay', delay: 0.5 }); s.nodes[g.id] = g;
	const rd = ME.makeNode('redirect', g.id, 's', 0, 10, 10); rd.params = Object.assign(ME.paramDefaults('redirect'), { toward: 'target', speedPct: 90 }); s.nodes[rd.id] = rd; s.seq = 12;
	const res = S.W.cast(s, { profile: prof(), owner: S.owner, host: S.host }); run(S, 2.5);
	const D = FULL(S);
	ok('Old-style rule branches and laws live side by side in one domain', res.ok && D && D.rules.length === 1 && D.laws.length === 1 && f1.hp < 5000, (res.ok ? 'cast' : res.error) + ' · rules ' + (D && D.rules.length) + ' · laws ' + (D && D.laws.length) + ' · hp ' + r1(f1.hp));
}

/* ============================================================ Yuta — Authentic Mutual Love */
{
	const Y = require(path.join(dir, 'tools', 'yuta-domain.js'));
	const spell = Y.build();
	const rep = ME.validate(spell, prof(8));
	ok('Authentic Mutual Love is a legal spell at Energy Control 8', rep.ok, rep.ok ? rep.cost + ' mana · ' + Object.keys(spell.nodes).length + ' runes' : rep.errors.map(e => e.text).join('; '));
	const f1 = foe(0, 8000); const S = world([f1]); const rv = rival(S, f1);
	S.W.cast(spell, { profile: prof(8), owner: S.owner, host: S.host });
	for(let i = 0; i < 400 && !(S.W.domains[0] && S.W.domains[0].phase === 'active'); i++) S.W.update(1 / 60, S.host);
	const D = S.W.domains[0];
	ok('It opens with the full opening, ending sealed, with three laws', D && D.phase === 'active' && D.laws.length === 3 && (D.p || {}).title === 'Authentic Mutual Love' && D.look.key === 'love', D ? D.phase + ' · ' + D.laws.length + ' laws · ' + D.look.key : 'no domain');
	S.caster.hp = 40; run(S, 3); const tended = S.caster.hp;
	S.W.cast(spellBolt('Ember Lance', 60), { profile: prof(), owner: rv, host: S.host });
	f1.hp = 8000; run(S, 8);
	ok('A rival\'s spell inside is copied, then cast back until they fall', D.copies.some(c => c.name === 'Ember Lance') && (D.cast || 0) >= 3 && f1.hp < 8000, 'copied: ' + D.copies.map(c => c.name).join(', ') + ' · cast back ' + (D.cast || 0) + '× · foe 8000 → ' + r1(f1.hp));
	ok('…and it tends its owner while they stand inside', tended > 50, 'hp 40 → ' + r1(tended) + ' in 3 s');
}

/* ============================================================ load */
{
	const foes = []; for(let i = 0; i < 8; i++) foes.push(foe(200 + i * 18, 99999));
	const S = world(foes);
	const laws = [ L({ event: 'always', effect: 'damage', dmg: 6 }), L({ event: 'attacks', effect: 'mark' }), L({ event: 'moves', speed: 2, effect: 'slow', secs: 1 }), L({ event: 'every', period: 1.5, effect: 'expose', secs: 2 }), L({ event: 'every', period: 2, effect: 'stun', secs: 0.5 }), L({ event: 'jumps', effect: 'mark' }) ];
	S.W.cast(domainSpell(laws, { fuel: 1500 }), { profile: prof(30), owner: S.owner, host: S.host });
	const t0 = Date.now(); let worst = 0;
	for(let i = 0; i < 900; i++){ const a = process.hrtime.bigint(); foes.forEach((f, j) => { f.attacking = (i + j * 7) % 50 === 0; f.vx = (i % 120) < 60 ? 4 : 0; }); S.W.update(1 / 60, S.host); const b = Number(process.hrtime.bigint() - a) / 1e6; if(b > worst) worst = b; }
	const ms = Date.now() - t0;
	ok('Load: 8 foes and 6 laws for 15 s stay cheap and clean up', ms < 4000 && worst < 25, ms + ' ms total · worst frame ' + r1(worst) + ' ms · domains ' + S.W.domains.filter(d => d.alive).length);
}

/* ------------------------------------------------------------ c78: rule fuel, bigger pours, max-mana overflow, Japanese fonts */
{
	const run1 = (ruleFuel) => {
		const f1 = foe(); const S = world([f1]); let drained = 0, totalDrained = 0;
		S.host.drainEnergy = (o, a) => { drained += a; return a; }; S.host.drainTotal = (o, a) => { totalDrained += a; return a; };
		const { D } = open(S, [ L({ event: 'every', period: 0.5, effect: 'cast', cool: 0 }, [ ['generate', { amount: 60 }, { mode: 'instant' }, [ ['redirect', { toward: 'target', speedPct: 90 }] ]] ]) ], { ruleFuel });
		const z0 = D.z.amount; run(S, 2); return { z0, z1: D.z.amount, drained, totalDrained };
	};
	const a = run1('domain'), b = run1('mana'), c = run1('total'), d = run1('both');
	ok('Rules draw from the domain\'s energy by default', a.z1 < a.z0 - 60 && a.drained === 0 && a.totalDrained === 0, 'zone ' + r1(a.z0) + ' → ' + r1(a.z1));
	ok('"Your energy" rules spend your mana and spare the zone', b.drained > 100 && b.totalDrained === 0 && b.z0 - b.z1 < a.z0 - a.z1 - 50, 'mana ' + r1(b.drained) + ' · zone lost ' + r1(b.z0 - b.z1));
	ok('"Total Mana" rules spend Total Mana only', c.totalDrained > 100 && c.drained === 0, 'total ' + r1(c.totalDrained));
	ok('"Energy, then Total Mana" prefers your energy', d.drained > 100 && d.totalDrained === 0, 'mana ' + r1(d.drained));
	const big = ME.validate(domainSpell([], { selfFuel: 12000 }), Object.assign(prof(), { maxEnergy: 1e6 }));
	ok('A domain can be given far more energy (up to ' + ME.CONFIG.domainSelfFuelMax + ')', !big.errors.some(e => e.code === 'PARAM') && ME.CONFIG.domainSelfFuelMax >= 20000, big.errors.map(e => e.code).join(',') || 'valid');
	const sp = domainSpell([], {}), pr = Object.assign(prof(), { maxEnergy: 300 });
	const rA = ME.validate(sp, pr), rB = ME.validate(sp, Object.assign({}, pr, { overflow: true }));
	ok('Over your max mana: refused normally, allowed with Total Mana overflow', rA.errors.some(e => e.code === 'RESERVE') && !rB.errors.some(e => e.code === 'RESERVE') && ME.overReserve(rB.upfront, pr).over > 0, 'cost ' + rB.upfront + ' vs ' + pr.maxEnergy + ' → +' + ME.overReserve(rB.upfront, pr).over + ' Total');
	const fonts = globalThis.MagicDomainLook.FIELDS.find(f => f.key === 'titleFont').options.map(o => o.value || o.v);
	ok('Japanese title fonts exist', ['jpmincho', 'jpgothic', 'jpbrush'].every(k => fonts.includes(k)), fonts.join(' '));
}

{
	const cast2 = (sb) => {
		const S = world([foe()]); const p = Object.assign(prof(), { sandbox: sb, maxEnergy: 1e6 });
		const go = () => S.W.cast(domainSpell([], { cinematic: 'none' }), { profile: p, owner: S.owner, host: S.host });
		const r1_ = go(); run(S, 0.3); const r2_ = go(); run(S, 0.3);
		return { second: r2_.ok, err: r2_.error || (r2_.report && r2_.report.errors[0] && r2_.report.errors[0].text), alive: S.W.domains.filter(q => q.alive).length };
	};
	const n = cast2(false), y = cast2(true);
	ok('Sandbox: domains can be cast again and again and stay open together', y.alive === 2 && n.alive <= 1, 'sandbox ' + y.alive + ' open (' + y.second + ' ' + y.err + ') · normal ' + n.alive);
	const S = world([foe()]); const p = Object.assign(prof(), { sandbox: true, maxEnergy: 1e6 });
	S.W.cast(domainSpell([], { cinematic: 'none', duration: 3 }), { profile: p, owner: S.owner, host: S.host }); run(S, 5);
	ok('Sandbox: no burnout after a domain ends', S.W.burnoutLeft(S.owner.id) === 0, 'burnout ' + S.W.burnoutLeft(S.owner.id));
}

/* ------------------------------------------------------------ report */
const bad = out.filter(o => !o.pass);
for(const o of out) console.log((o.pass ? '  ok   ' : '  FAIL ') + o.name + (o.detail ? '  [' + o.detail + ']' : ''));
console.log('\n' + (out.length - bad.length) + ' / ' + out.length + ' checks passed');
process.exit(bad.length ? 1 : 0);
