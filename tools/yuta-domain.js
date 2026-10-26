/* Yuta's domain — Authentic Mutual Love (the spell builder; single source of truth).
 *   node tools/yuta-domain.js            → validate + print the tree
 *   node tools/yuta-domain.js --write    → write yuta-spell.js (the serialized spell the Scroll of Authentic Mutual Love carries)
 * An ordinary rune tree: Create Zone → Domain, with three Laws. Nothing here runs at cast time.
 *
 *   The domain is a closed, sealed barrier with no sure-hit blow of its own. Its rules are:
 *     1. Every foe that attacks or casts inside has the technique COPIED (up to four are kept; the oldest is forgotten).
 *     2. Every ~1.2 s a copied technique is cast back at each foe from the domain's own, near-limitless, energy — and it cannot miss.
 *     3. Rika's care: you are slowly healed while you stand inside.
 *   Sworn as a declared domain (the spell is announced aloud), which raises what it can hold and how hard its rules hit. */
'use strict';
const path = require('path');
const dir = path.join(__dirname, '..');
if(!globalThis.MagicEngine){
	globalThis.window = globalThis;
	for(const f of ['magic-engine.js', 'magic-techniques.js', 'magic-vows.js', 'magic-domain.js', 'magic-domain-look.js', 'magic-domain-art.js']) require(path.join(dir, f));
}
const ME = globalThis.MagicEngine;

/* ------------------------------------------------------------------ tuning */
const T = {
	radius: 340,          // px — the domain's reach
	duration: 20,         // s of open domain (after the opening)
	selfFuel: 1000,       // E — Rika's near-limitless reserve: spells cast back are paid for from this
	copySlots: 4,         // techniques held at once
	castEvery: 1.2,       // s between copies being cast at each foe
	careHeal: 5           // hp per second to you while inside
};

const N = (type, params, link, ...kids) => ({ type, params: params || {}, link: link || null, kids });

/* the look: a pale, rose-lit world over a field of swords, a halo turning overhead, petals in the air */
function yutaLook(){
	const LK = globalThis.MagicDomainLook;
	return LK.sanitize(Object.assign(LK.preset('love'), {
		c1: '#ff7fbf', c2: '#fff0f8', c3: '#b9a4ff', bg: '#fff1f8',
		sky: 'dawn', landmark: 'halo', landmarkSize: 1.1, horizon: 0.34,
		floor: 'blades', sigil: 'lotus', sigilAt: 'floor', sigilSize: 0.8,
		p1: 'petals', p1n: 1.2, p2: 'fireflies', p2n: 0.6, pSpeed: 0.9,
		barrier: 'orb', rim: 3, glow: 1.2, rimRunes: false,
		ambient: 'bright', rays: 0.6, vignette: 0.35, pulse: 0.35, immersion: 0.92, spin: 0.8,
		burst: 'petalstorm', freeze: 'tint', letterbox: true, titleFont: 'elegant', titleLayout: 'low', titleColor: 'white', subtitle: 'Domain Expansion',
		veil: 'cocoon', seed: 1717
	}));
}

function build(over){
	const t = Object.assign({}, T, over || {});
	const tree =
		N('zone', { radius: t.radius, spawn: 'caster' }, null,
			N('domain', { form: 'closed', duration: t.duration, sureHit: 'no', vow: 'declared', fuel: 'self', selfFuel: t.selfFuel,
					cinematic: 'full', title: 'Authentic Mutual Love', theme: 'love', outside: 'sealed', look: yutaLook() }, null,
				N('law', { who: 'foe', event: 'attacks', effect: 'copy', copySlots: t.copySlots, cool: 0.25, callout: 'COPIED' }),
				N('law', { who: 'foe', event: 'every', period: t.castEvery, effect: 'castCopy', copyPick: 'cycle', copyScale: 1, cool: 0, callout: '' }),
				N('law', { who: 'caster', event: 'always', effect: 'heal', healAmt: t.careHeal, callout: '' })));
	return realise(tree);
}

/* ------------------------------------------------------------------ DSL → engine definition (tidy tree layout) */
function realise(tree){
	const s = ME.blankSpell('Authentic Mutual Love');
	let seq = 0, leaf = 0;
	const idOf = () => 'yu' + String(++seq).padStart(3, '0');
	delete s.nodes[s.rootId];
	function place(n, parentId, depth, order){
		const id = idOf();
		const node = ME.makeNode(n.type, parentId, 's', 0, depth, order);
		node.id = id;
		Object.assign(node.params, n.params);
		if(n.link) node.link = Object.assign(node.link, n.link);
		s.nodes[id] = node;
		const kids = n.kids.map((k, i) => place(k, id, depth + 1, i));
		if(!kids.length) node.gx = leaf++;
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
	const prof = ME.deriveProfile({ magicPower: 40, magicControl: 12, maxMana: 4000 }); prof.techniquePoints = 20; prof.allocations = {};
	const rep = ME.validate(spell, prof);
	console.log('runes:', Object.keys(spell.nodes).length, '| ok:', rep.ok, '| cost:', rep.cost, '| upfront:', rep.upfront, '| peak:', rep.peakOutput);
	for(const e of (rep.errors || [])) console.log('ERR', e.code, e.text);
	for(const w of (rep.warnings || [])) console.log('WARN', w.code || '', w.text);
	for(const k of Object.keys(spell.nodes)){ const nd = spell.nodes[k]; if(nd.type === 'domain'){ const x = (rep.nodeInfo[k] || {}).extra; console.log(JSON.stringify(x && x.construct)); } }
	if(process.argv.includes('--write')){
		const out = path.join(dir, 'yuta-spell.js');
		fs.writeFileSync(out, '/* Authentic Mutual Love — the serialized rune tree carried by the Scroll of Authentic Mutual Love. Generated by tools/yuta-domain.js — edit the builder, not this file. */\nwindow.YUTA_SPELL = ' + JSON.stringify(spell) + ';\n');
		console.log('wrote', out);
	}
}
