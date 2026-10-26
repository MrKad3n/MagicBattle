/* Mirror War — the spell builder (single source of truth).
 *   node tools/mirror-war.js            → validate + print the tree breakdown
 *   node tools/mirror-war.js --write    → write mirror-war-spell.js (the serialized spell the scroll carries)
 * The spell is an ordinary rune tree built with the engine's own node factory; nothing here runs at cast time. */
'use strict';
const path = require('path');
const dir = path.join(__dirname, '..');
if(!globalThis.MagicEngine){ require(path.join(dir, 'magic-engine.js')); require(path.join(dir, 'magic-techniques.js')); require(path.join(dir, 'magic-vows.js')); }
const ME = globalThis.MagicEngine;

/* ------------------------------------------------------------------ tuning */
const T = {
	energy: 400,                              // Generate amount (E)
	/* family timing: seconds after the cast that a family's first projectile launches (Delay connector on its launching Redirect) */
	at: { sweepers: 0.4, crossfire: 0.8, reserves: 1.2, executors: 1.6 },
	/* Split "first branch share" cascade: 30 / 21 / 19.6 / 17.6 / 11.8 % of E (each Split also loses 2%) */
	cascade: { executors: 30, sweepers: 30, crossfire: 40, vanguard: 60 }
};

/* ------------------------------------------------------------------ tiny DSL */
const L = (delay) => delay ? { mode: 'delay', delay: Math.round(delay * 100) / 100 } : null;
const N = (type, params, link, ...kids) => ({ type, params: params || {}, link: link || null, kids });
const compress = (shape, power) => N('compress', { shape, power });
function build(over){
	const t = Object.assign({}, T, over || {});
	const A = t.at;
	const aim = (pct, link) => N('redirect', { toward: 'mouse', speedPct: pct }, link);
	const turn = (deg, ccw) => N('rotate', { mode: 'set', turns: 'path', dir: ccw ? 'ccw' : 'cw', degrees: deg, time: 0 });
	const orient = (deg) => N('rotate', { mode: 'set', turns: 'shape', dir: 'cw', degrees: deg, time: 0 });      // turns the shape, not the path
	const vow = (key, extra, failure) => { const p = { family: 'energy', vow: key, failure: failure || 'lose' }; for(const k in (extra || {})) p[key + '_' + k] = extra[k]; return N('vow', p); };
	const chain = (...ns) => { for(let i = ns.length - 2; i >= 0; i--) ns[i].kids = [ns[i + 1]]; return ns[0]; };
	const colour = (c, ...kids) => N('color', { color: c }, null, ...kids);

	/* Everything that can be shaped is shaped at t = 0: the legion forms as small compressed shapes (they leak far less than raw energy
	   while they wait), and the Delay connector sits on the Redirect that LAUNCHES each projectile. */

	/* Vanguard — three small, fast harriers fanned ±4° around the cursor line. Unerring Path on two of them. */
	const vanguard = colour('azure', N('split', { share: 0, spread: 0 }, null,
		chain(compress('point', 4), aim(100), vow('unerring', { minDist: 250 })),
		chain(compress('point', 4), aim(100, L(0.12)), turn(4, false), vow('unerring', { minDist: 250 })),
		chain(compress('point', 4), aim(100, L(0.24)), turn(4, true))));

	/* Sweepers — a wave stood on end (shape turned 90°) and a cone, both flying down the cursor line. The wave waits, holding still, under a Vow of Patience. */
	const sweepers = colour('cyan', N('split', { share: 0, spread: 0 }, null,
		chain(compress('wave', 5), vow('patience', { time: 1.0, still: 'still' }), aim(80, L(A.sweepers + 0.2)), orient(90)),
		chain(compress('cone', 4), aim(80, L(A.sweepers)))));

	/* Crossfire — two arrows leave 70° off the cursor line and swing back onto it from opposite sides; one comes straight in late. */
	const crossfire = colour('gold', N('split', { share: 0, spread: 0 }, null,
		chain(compress('arrow', 6), aim(90, L(A.crossfire)), turn(70, true), aim(90, L(0.35)), vow('journey', { distance: 350 })),
		chain(compress('arrow', 6), aim(90, L(A.crossfire)), turn(70, false), aim(90, L(0.35))),
		chain(compress('arrow', 6), aim(90, L(A.crossfire + 0.35)), vow('journey', { distance: 500 }))));

	/* Reserves — a disc and a star, released after the opening volleys, angled ±4° off wherever the cursor is by then. */
	const reserves = colour('rose', N('split', { share: 0, spread: 0 }, null,
		chain(compress('disc', 5), aim(85, L(A.reserves)), turn(4, true)),
		chain(compress('star', 5), aim(85, L(A.reserves + 0.4)), turn(4, false))));

	/* Executors — three heavy spears. #1 Absolute Compression (sworn before it is compressed); #2 Solitude (after its last split,
	   before launch); #2 and #3 come in 55° off the line and swing onto the cursor from opposite sides. */
	const executors = colour('crimson', N('split', { share: 0, spread: 0 }, null,
		chain(vow('compression', { level: 10 }), compress('lance', 10), aim(75, L(A.executors))),
		chain(compress('lance', 8), vow('solitude', { strict: 'body' }), aim(75, L(A.executors + 0.35)), turn(55, true), aim(75, L(0.35))),
		chain(compress('lance', 8), aim(75, L(A.executors + 0.7)), turn(55, false), aim(75, L(0.35)))));

	/* Formation core — one Generate, then a cascade of two-way Splits. Each Split divides, never duplicates:
	   its first branch takes `share` %, the rest carries on. The families fire from the Delay connector on their first rune. */
	const C = t.cascade;
	const tree = N('generate', { amount: t.energy, spawn: 'caster', inherit: 'yes' }, null,
		N('split', { share: C.executors, spread: 0 }, null,
			executors,
			N('split', { share: C.sweepers, spread: 0 }, null,
				sweepers,
				N('split', { share: C.crossfire, spread: 0 }, null,
					crossfire,
					N('split', { share: C.vanguard, spread: 0 }, null,
						vanguard,
						reserves)))));
	return realise(tree);
}
function withLink(n, link){ n.link = link; return n; }

/* ------------------------------------------------------------------ DSL → engine definition (tidy tree layout) */
function realise(tree){
	const s = ME.blankSpell('Mirror War');
	let seq = 0, leaf = 0;
	const idOf = () => 'mw' + String(++seq).padStart(3, '0');
	const root = s.nodes[s.rootId];
	delete s.nodes[s.rootId];
	function place(n, parentId, depth, order){
		const id = idOf();
		const node = ME.makeNode(n.type, parentId, 's', 0, depth, order);
		node.id = id;
		Object.assign(node.params, n.params);
		if(n.link) node.link = Object.assign(node.link, n.link);
		s.nodes[id] = node;
		const kids = n.kids.map((k, i) => place(k, id, depth + 1, i));
		if(!kids.length){ node.gx = leaf++; }
		else node.gx = kids.length === 1 ? s.nodes[kids[0]].gx : Math.round((s.nodes[kids[0]].gx + s.nodes[kids[kids.length - 1]].gx) / 2);
		return id;
	}
	s.rootId = place(tree, null, 0, 0);
	s.seq = seq + 1;
	return s;
}

module.exports = { build, T };

/* ------------------------------------------------------------------ CLI */
if(require.main === module){
	const fs = require('fs');
	const spell = build();
	const prof = ME.deriveProfile({ magicPower: 30, magicControl: 20 }); prof.techniquePoints = 20; prof.allocations = {};
	const rep = ME.validate(spell, prof);
	const n = Object.keys(spell.nodes).length;
	console.log('runes:', n, '| ok:', rep.ok, '| cost:', rep.cost, '| upfront:', rep.upfront, '| peak:', rep.peakOutput);
	for(const e of (rep.errors || [])) console.log('ERR', e.code, e.text);
	for(const w of (rep.warnings || [])) console.log('WARN', w.code || '', w.text);
	if(process.argv.includes('--tree')){
		(function walk(id, d){ const nd = spell.nodes[id]; const l = nd.link.mode === 'delay' ? ' [+' + nd.link.delay + 's]' : ''; const p = Object.keys(nd.params).filter(k => /shape|power|toward|speedPct|degrees|dir|share|amount|color|vow|distance|time|still|level|strict/.test(k)).map(k => k + '=' + nd.params[k]).join(' '); console.log('  '.repeat(d) + nd.type + ' ' + p + l);
			Object.keys(spell.nodes).filter(k => spell.nodes[k].parent === id).sort((a, b) => spell.nodes[a].order - spell.nodes[b].order).forEach(k => walk(k, d + 1)); })(spell.rootId, 0);
	}
	if(process.argv.includes('--write')){
		const out = path.join(dir, 'mirror-war-spell.js');
		fs.writeFileSync(out, '/* Mirror War — the serialized rune tree carried by the Scroll of Mirror War. Generated by tools/mirror-war.js — edit the builder, not this file. */\nwindow.MIRROR_WAR_SPELL = ' + JSON.stringify(spell) + ';\n');
		console.log('wrote', out);
	}
}
