/*
 * DOMAIN LAWS — a domain is a world with its own rules (c69).
 * -------------------------------------------------------------------------
 * A Domain Expansion used to launch ordinary spell branches at the foes inside it. This plugin lets a domain change what is TRUE inside it:
 *
 *   Law rune    one sentence under a Domain:   WHO  ·  WHEN  ·  THEN  — "every foe inside, when it casts, has its spell copied"
 *   Events      always · every N s · when it opens · steps in · tries to leave · casts · attacks · moves · stands still · jumps ·
 *               takes damage · is low on health · has N marks
 *   Effects     damage · burn · execute · drain · stun · slow · bind · pull · seal casting / techniques · negate · mark · clear marks ·
 *               expose · heal · copy their spell · cast a copy · run the runes below the law
 *   State       per-foe MARKS (a tally the laws can count: "three offences → sentence"), seals, exposure, a book of COPIED spells
 *   Budget      every law has a weight; the sum must fit what your Energy Control can hold. A binding vow raises the budget.
 *   Look        theme, accent, pattern, interior, motes, expansion style, a name for the call-out
 *   Opening     gather → the world freezes → the domain bursts out (see magic-domain-art.js for the painting)
 *   Veil        a closed domain cannot be seen into from outside (host draws W.drawDomainVeil)
 *
 * The engine knows nothing of laws: it calls W._domOpen / _domTick / _domEdge / _domCast / _domEnd / _castBlocked / sealLeft,
 * installed below through MagicEngine.registerWorldHook. Without this file domains work exactly as before.
 */
(function(root){
	'use strict';
	const ME = root.MagicEngine;
	if(!ME || !ME.registerWorldHook || !ME.defineRune || !ME.Runes || !ME.Runes.domain) return;
	const { defineRune, defineCondition, CATEGORIES, CATEGORY_MAP, Runes } = ME;
	const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
	const num = (v, d) => { v = Number(v); return isFinite(v) ? v : d; };
	const hypot = Math.hypot;

	if(!CATEGORY_MAP.law){ const c = { id:'law', label:'Domain Laws', color:'#ffd9a0' }; CATEGORIES.push(c); CATEGORY_MAP.law = c; }

	/* ================================================================ looks (shared with the painter) */
	const THEMES = {
		void:    { name:'The Void',        c1:'#b896ff', c2:'#f3e9ff', bg:'#0a061c', pattern:'rings',   motes:'glyphs',  interior:'dark',    burst:'shockwave' },
		shrine:  { name:'Malevolent Shrine',c1:'#ff3b4f', c2:'#ffd9b0', bg:'#1a0408', pattern:'spikes',  motes:'embers',  interior:'crimson', burst:'shards' },
		court:   { name:'The Courtroom',   c1:'#ffd36b', c2:'#fff6dc', bg:'#14100a', pattern:'pillars', motes:'glyphs',  interior:'dark',    burst:'bloom' },
		love:    { name:'Mutual Love',     c1:'#ff8ac8', c2:'#fff0f8', bg:'#fff1f8', pattern:'petals',  motes:'petals',  interior:'bright',  burst:'bloom' },
		sea:     { name:'The Deep',        c1:'#4fd8ff', c2:'#e0fbff', bg:'#031a2a', pattern:'waves',   motes:'snow',    interior:'dark',    burst:'ink' },
		eclipse: { name:'Eclipse',         c1:'#ffb347', c2:'#fff1d0', bg:'#050303', pattern:'rings',   motes:'embers',  interior:'starry',  burst:'shockwave' },
		garden:  { name:'Jade Garden',     c1:'#7dffb0', c2:'#eaffee', bg:'#04140a', pattern:'petals',  motes:'petals',  interior:'dark',    burst:'bloom' },
		frost:   { name:'Frozen Hall',     c1:'#a8e8ff', c2:'#ffffff', bg:'#06121e', pattern:'cracks',  motes:'snow',    interior:'dark',    burst:'shards' },
		ember:   { name:'Ember Plain',     c1:'#ff8a3d', c2:'#ffe2b0', bg:'#1c0a02', pattern:'cracks',  motes:'embers',  interior:'crimson', burst:'shockwave' },
		galaxy:  { name:'Starfield',       c1:'#9fa8ff', c2:'#ffffff', bg:'#04041a', pattern:'stars',   motes:'stars',   interior:'starry',  burst:'bloom' }
	};
	const ACCENTS = { violet:'#b896ff', crimson:'#ff3b4f', gold:'#ffd36b', rose:'#ff8ac8', azure:'#4fd8ff', jade:'#7dffb0', amber:'#ff8a3d', white:'#ffffff' };
	const PATTERNS = ['rings', 'glyphs', 'grid', 'spikes', 'waves', 'pillars', 'petals', 'stars', 'cracks', 'none'];
	const MOTES = ['none', 'embers', 'petals', 'snow', 'glyphs', 'stars', 'ink'];
	const INTERIORS = ['dark', 'bright', 'crimson', 'starry'];
	const BURSTS = ['shockwave', 'bloom', 'shards', 'ink'];
	const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
	const opt = (list, themeLabel) => (themeLabel ? [{ value:'theme', label: themeLabel }] : []).concat(list.map(v => ({ value: v, label: cap(v) })));

	/* ================================================================ the Domain rune: looks, opening, a new vow */
	const DR = Runes.domain;
	const vowParam = DR.params.find(q => q.key === 'vow');
	if(vowParam && !vowParam.options.some(o => o.value === 'declared')) vowParam.options.push({ value:'declared', label:'Declared — every foe is told the rules (×1.4 power, a bigger law budget)' });
	const addP = (q) => { if(!DR.params.some(x => x.key === q.key)) DR.params.push(q); };
	addP({ key:'cinematic', label:'Opening', type:'select', default:'full',
		options:[ { value:'full', label:'Full — gather, a held breath, then it bursts open' }, { value:'quick', label:'Quick — a short version' }, { value:'none', label:'None — it opens at once' } ],
		hint:'Full: the sigil gathers for about a second, EVERYTHING freezes for a moment, then the domain expands in a rush. Nothing in the world moves while it is frozen.' });
	addP({ key:'title', label:'Name', type:'text', max:28, default:'Domain Expansion', hint:'Shown across the screen in the held breath, and called out as you cast it.' });
	addP({ key:'look', label:'Domain look', type:'domainLook', default:null, hint:'Design the world inside: sky, landmark, floor, sigil, particles, edge, light, the opening and the title. Hundreds of millions of combinations, or start from a preset.' });
	const noLook = (p) => !p.look;
	addP({ key:'theme', label:'Look', type:'select', default:'void', show: noLook, swatches: Object.keys(THEMES).map(k => ({ value:k, label:THEMES[k].name, c1:THEMES[k].c1, c2:THEMES[k].c2, bg:THEMES[k].bg })),
		options: Object.keys(THEMES).map(k => ({ value:k, label:THEMES[k].name })), hint:'The world inside: its colours, floor pattern, air and the way it bursts open. The settings below override it.' });
	addP({ key:'accent', show: noLook, label:'Colour', type:'select', default:'theme', options: opt(Object.keys(ACCENTS), 'Theme colour') });
	addP({ key:'pattern', show: noLook, label:'Floor pattern', type:'select', default:'theme', options: opt(PATTERNS, 'Theme default') });
	addP({ key:'interior', show: noLook, label:'Inside, the air is', type:'select', default:'theme', options: [ { value:'theme', label:'Theme default' }, { value:'dark', label:'Dark and still' }, { value:'bright', label:'Bright and pale' }, { value:'crimson', label:'Blood-dark' }, { value:'starry', label:'Starry void' } ] });
	addP({ key:'motes', show: noLook, label:'Drifting', type:'select', default:'theme', options: opt(MOTES, 'Theme default') });
	addP({ key:'burst', show: noLook, label:'Expansion', type:'select', default:'theme', options: [ { value:'theme', label:'Theme default' }, { value:'shockwave', label:'Shockwave' }, { value:'bloom', label:'Bloom' }, { value:'shards', label:'Shattering' }, { value:'ink', label:'Ink flood' } ] });
	addP({ key:'outside', label:'Seen from outside', type:'select', default:'auto',
		options:[ { value:'auto', label:'Closed: sealed · Open: clear' }, { value:'sealed', label:'Sealed — nothing inside can be seen' }, { value:'misty', label:'Misty — shapes show through' }, { value:'clear', label:'Clear — see right in' } ],
		hint:'Nobody outside a sealed domain can see what is inside it. You always see out of one.' });

	/* ================================================================ laws: the catalogue */
	const WHO = [ { value:'foe', label:'Every foe inside' }, { value:'caster', label:'You (the caster)' }, { value:'all', label:'Everyone inside' } ];
	const EVENTS = [
		{ value:'always',  group:'Time',    label:'While they are inside — constantly' },
		{ value:'every',   group:'Time',    label:'Every few seconds' },
		{ value:'open',    group:'Time',    label:'When the domain opens' },
		{ value:'enter',   group:'Time',    label:'When they step inside' },
		{ value:'leave',   group:'Boundary',label:'When they try to leave' },
		{ value:'casts',   group:'Actions', label:'When they cast a spell' },
		{ value:'attacks', group:'Actions', label:'When they attack or cast' },
		{ value:'moves',   group:'Actions', label:'When they move fast' },
		{ value:'still',   group:'Actions', label:'When they stand still' },
		{ value:'jumps',   group:'Actions', label:'When they jump' },
		{ value:'damaged', group:'Health',  label:'When they take a blow' },
		{ value:'lowHp',   group:'Health',  label:'When their health is low' },
		{ value:'marked',  group:'Marks',   label:'When they carry enough marks' }
	];
	const EFFECTS = [
		{ value:'damage',  group:'Harm',      label:'Damage them' },
		{ value:'burn',    group:'Harm',      label:'Set them burning' },
		{ value:'execute', group:'Harm',      label:'Execute — kill if their health is low' },
		{ value:'drain',   group:'Harm',      label:'Drain their energy into the domain' },
		{ value:'stun',    group:'Control',   label:'Stun them' },
		{ value:'slow',    group:'Control',   label:'Slow them' },
		{ value:'bind',    group:'Control',   label:'Bind them where they stand' },
		{ value:'pull',    group:'Control',   label:'Pull them toward the centre' },
		{ value:'seal',    group:'Control',   label:'Seal their casting or techniques' },
		{ value:'negate',  group:'Control',   label:'Negate — destroy their energy' },
		{ value:'mark',    group:'Marks',     label:'Add marks' },
		{ value:'clear',   group:'Marks',     label:'Clear their marks' },
		{ value:'expose',  group:'Marks',     label:'Expose — they take extra damage' },
		{ value:'heal',    group:'Support',   label:'Heal you' },
		{ value:'copy',    group:'Techniques',label:'Copy the spell they cast' },
		{ value:'castCopy',group:'Techniques',label:'Cast a copied spell at them' },
		{ value:'cast',    group:'Custom',    label:'Run the runes below this law' }
	];
	const HARMFUL = { damage:1, burn:1, execute:1, drain:1, stun:1, slow:1, bind:1, pull:1, seal:1, negate:1, expose:1, copy:1, castCopy:1 };
	const CONTINUOUS = { damage:1, burn:1, drain:1, slow:1, pull:1, heal:1, expose:1, mark:1 };      // 'while inside' ticks these 4× a second; the rest are rate-limited
	const MIN_COOL = { stun: 1.6, bind: 1.2, seal: 0.8, execute: 2, negate: 1.5, castCopy: 0.5, copy: 0.4, cast: 0.3, clear: 0.2 };
	/* the hard-hitting effects get a cooldown floor that grows with how strong you set them, so they cannot be chained into a lock */
	function minCool(p){
		switch(p.effect){
			case 'execute': return 2 + Math.pow(num(p.executePct, 25) / 100, 2) * 14;      // 25% ≈ 2.9 s · 50% ≈ 5.5 s · 100% = 16 s
			case 'stun':    return Math.max(MIN_COOL.stun, num(p.secs, 1.5) * 1.6);          // never more than ~60% stunned
			case 'bind':    return Math.max(MIN_COOL.bind, num(p.secs, 1.5) * 1.5);
			case 'seal':    return Math.max(MIN_COOL.seal, num(p.secs, 4) * 1.3);
			default: return MIN_COOL[p.effect] || 0;
		}
	}
	const TICK = 0.25;

	const ev = (k) => EVENTS.find(e => e.value === k);
	const ef = (k) => EFFECTS.find(e => e.value === k);
	const showFx = (...ks) => (p) => ks.indexOf(p.effect) >= 0;
	const showEv = (...ks) => (p) => ks.indexOf(p.event) >= 0;

	/* the weight of a law against the budget your Energy Control can hold */
	function effectWeight(p){
		switch(p.effect){
			case 'damage':  return 1.5 + num(p.dmg, 20) / 40 + Math.pow(num(p.dmg, 20) / 100, 2) * 2;
			case 'burn':    return 1.5 + num(p.burnDps, 8) / 10;
			case 'execute': return 4 + Math.pow(num(p.executePct, 25) / 100, 2) * 40;   // 25% ≈ 6.5 · 50% = 14 · 75% ≈ 26.5 · 100% = 44 (more than any build can hold)
			case 'drain':   return 1.5 + num(p.drainAmt, 15) / 20;
			case 'stun':    return 2 + Math.pow(num(p.secs, 1.5), 1.5) * 1.5;
			case 'slow':    return 1 + Math.pow(num(p.slowPct, 50) / 100, 2) * 4 + num(p.slowPct, 50) / 120;
			case 'bind':    return 2 + Math.pow(num(p.secs, 1.5), 1.4) * 1.3;
			case 'pull':    return 1 + num(p.pullPx, 3) / 4;
			case 'seal':    return (p.sealKind === 'techniques' ? 3 : 5) + Math.pow(num(p.secs, 4), 1.3) / 3;
			case 'negate':  return 6;
			case 'mark':    return 0.5 * num(p.markAdd, 1);
			case 'clear':   return 0.5;
			case 'expose':  return 1.5 + num(p.exposePct, 40) / 80 + Math.pow(num(p.exposePct, 40) / 100, 2) * 2.5 + num(p.secs, 4) / 5;
			case 'heal':    return 1 + num(p.healAmt, 6) / 20 + Math.pow(num(p.healAmt, 6) / 40, 2);
			case 'copy':    return 2 + num(p.copySlots, 4) * 0.6;
			case 'castCopy':return (3 + num(p.copyScale, 1)) ;
			case 'cast':    return 1.5;
			default: return 1;
		}
	}
	const EVENT_MULT = { always: 1.8, open: 0.6, enter: 0.8, leave: 0.9, jumps: 0.8, marked: 0.9 };
	function lawWeight(p, kidRunes){
		let w = effectWeight(p);
		if(p.effect === 'cast') w += 1.2 * (kidRunes || 0);
		let m = EVENT_MULT[p.event] != null ? EVENT_MULT[p.event] : 1;
		if(p.event === 'every') m = 1 + Math.min(2, 1 / Math.max(0.25, num(p.period, 3))) * 0.25;
		if(p.who === 'all') m *= 1.5; else if(p.who === 'caster') m *= 0.7;
		if(num(p.limit, 0) > 0) m *= 0.8;
		return Math.round(w * m * 10) / 10;
	}
	function lawCapacity(profile, vow){
		const c = 10 + 1.8 * Math.max(0, num(profile && profile.energyControl, 5));
		return Math.round(c * (vow === 'declared' ? 1.35 : vow === 'shared' ? 1.25 : (vow === 'brief' || vow === 'narrow') ? 1.15 : 1) * 10) / 10;
	}

	/* a law as a sentence (the forge summary, the declared-rules banner, the docs) */
	function describeLaw(p){
		const who = p.who === 'caster' ? 'you' : p.who === 'all' ? 'anyone inside' : 'every foe inside';
		const when = {
			always: 'while ' + who + (p.who === 'caster' ? ' are' : ' is') + ' inside', every: 'every ' + num(p.period, 3) + ' s, to ' + who, open: 'as the domain opens, to ' + who, enter: 'when ' + who + ' steps in', leave: 'when ' + who + ' tries to leave',
			casts: 'when ' + who + ' casts', attacks: 'when ' + who + ' attacks or casts', moves: 'when ' + who + ' moves faster than ' + num(p.speed, 4), still: 'when ' + who + ' stands still for ' + num(p.still, 2) + ' s',
			jumps: 'when ' + who + ' jumps', damaged: 'when ' + who + ' takes ' + num(p.dmgMin, 1) + '+ damage', lowHp: 'when ' + who + ' is below ' + num(p.hpPct, 30) + '% health', marked: 'when ' + who + ' carries ' + num(p.marksN, 3) + '+ marks'
		}[p.event] || '…';
		const secs = num(p.secs, 1.5);
		const then = {
			damage: 'it takes ' + num(p.dmg, 20) + ' damage' + (p.event === 'always' ? ' a second' : ''), burn: 'it burns for ' + num(p.burnDps, 8) + '/s', execute: 'it is executed if below ' + num(p.executePct, 25) + '% health',
			drain: 'its energy is drained (' + num(p.drainAmt, 15) + ')', stun: 'it is stunned ' + secs + ' s', slow: 'it is slowed ' + num(p.slowPct, 50) + '% for ' + secs + ' s', bind: 'it is bound ' + secs + ' s', pull: 'it is pulled in',
			seal: 'its ' + (p.sealKind === 'techniques' ? 'techniques are' : 'casting is') + ' sealed ' + secs + ' s', negate: 'its energy is destroyed', mark: 'it gains ' + num(p.markAdd, 1) + ' mark(s)', clear: 'its marks are cleared',
			expose: 'it takes +' + num(p.exposePct, 40) + '% damage for ' + secs + ' s', heal: 'you heal ' + num(p.healAmt, 6), copy: 'the spell is copied', castCopy: 'a copied spell is cast at it', cast: 'the runes below this law run on it'
		}[p.effect] || '…';
		return (cap(when) + ', ' + then + '.');
	}

	/* ================================================================ the Law rune */
	defineRune({
		id:'law', name:'Domain Law', glyph:'§', category:'law',
		description:'One law of the world inside a Domain Expansion. Read it as a sentence: WHO it concerns, WHEN it applies, and THEN what happens. Laws are not attacks you throw — they are what is true inside the domain, and they apply to everyone who meets their condition: "every foe that casts has its spell copied", "whoever stands still is bound", "three offences and the sentence is carried out". Laws draw on the domain\'s energy and have a weight; the total must fit the budget your Energy Control can hold. Place it directly under a Domain rune.',
		params:[
			{ key:'who', label:'Who', type:'select', options: WHO, default:'foe' },
			{ key:'event', label:'When', type:'select', options: EVENTS, default:'every' },
			{ key:'period', label:'Every', type:'float', min:0.25, max:20, step:0.25, default:3, unit:'s', show: showEv('every') },
			{ key:'speed', label:'Faster than', type:'float', min:0.5, max:12, step:0.5, default:4, unit:'px/f', show: showEv('moves') },
			{ key:'still', label:'Still for', type:'float', min:0.5, max:10, step:0.5, default:2, unit:'s', show: showEv('still') },
			{ key:'dmgMin', label:'A blow of at least', type:'int', min:1, max:500, step:1, default:1, unit:'dmg', show: showEv('damaged') },
			{ key:'hpPct', label:'Health below', type:'int', min:5, max:95, step:5, default:30, unit:'%', show: showEv('lowHp') },
			{ key:'marksN', label:'Marks at least', type:'int', min:1, max:12, step:1, default:3, show: showEv('marked') },
			{ key:'spend', label:'Marks', type:'select', options:[ { value:'spend', label:'Spent when this law applies' }, { value:'keep', label:'Kept' } ], default:'spend', show: showEv('marked') },
			{ key:'effect', label:'Then', type:'select', options: EFFECTS, default:'damage' },
			{ key:'dmg', label:'Damage', type:'int', min:1, max:300, step:1, default:20, unit:'dmg', show: showFx('damage'), hint:'Per application; "while inside" applies it every quarter second as damage per second.' },
			{ key:'burnDps', label:'Burn', type:'int', min:1, max:40, step:1, default:8, unit:'/s', show: showFx('burn') },
			{ key:'executePct', label:'If their health is below', type:'int', min:5, max:100, step:5, default:25, unit:'%', show: showFx('execute') },
			{ key:'drainAmt', label:'Drain', type:'int', min:1, max:60, step:1, default:15, unit:'E', show: showFx('drain') },
			{ key:'slowPct', label:'Slow', type:'int', min:10, max:90, step:5, default:50, unit:'%', show: showFx('slow') },
			{ key:'pullPx', label:'Pull', type:'float', min:1, max:10, step:0.5, default:3, unit:'px/f', show: showFx('pull') },
			{ key:'sealKind', label:'Seal', type:'select', options:[ { value:'casting', label:'All casting' }, { value:'techniques', label:'Techniques only' } ], default:'casting', show: showFx('seal'), hint:'Works on rune casters (rival mages, online opponents, you when the domain is a foe\'s). Ordinary monsters do not cast.' },
			{ key:'markAdd', label:'Marks', type:'int', min:1, max:5, step:1, default:1, show: showFx('mark') },
			{ key:'exposePct', label:'Extra damage', type:'int', min:10, max:200, step:10, default:40, unit:'%', show: showFx('expose') },
			{ key:'healAmt', label:'Heal', type:'int', min:1, max:100, step:1, default:6, show: showFx('heal'), hint:'Per application (per second when "while inside").' },
			{ key:'secs', label:'For', type:'float', min:0.5, max:20, step:0.5, default:1.5, unit:'s', show: showFx('stun', 'slow', 'bind', 'seal', 'expose') },
			{ key:'copySlots', label:'Copies kept', type:'int', min:1, max:6, step:1, default:4, show: showFx('copy'), hint:'The domain keeps this many copied spells; the oldest is forgotten first. A rival mage\'s real spell is copied; an ordinary monster leaves an "echo" of its attack.' },
			{ key:'copyPick', label:'Cast which copy', type:'select', options:[ { value:'cycle', label:'Each in turn' }, { value:'newest', label:'The newest' }, { value:'strongest', label:'The strongest' } ], default:'cycle', show: showFx('castCopy') },
			{ key:'copyScale', label:'Copy strength', type:'float', min:0.3, max:1.5, step:0.1, default:1, unit:'×', show: showFx('castCopy'), hint:'Scales the energy of the copy. It is paid from the domain\'s energy, never from your mana.' },
			{ key:'cool', label:'Per-foe cooldown', type:'float', min:0, max:10, step:0.1, default:0.8, unit:'s', show: (p) => p.event !== 'always' && p.event !== 'open', hint:'The shortest time between two applications on the same creature.' },
			{ key:'limit', label:'Most applications per foe', type:'int', min:0, max:20, step:1, default:0, show: (p) => p.event !== 'always', hint:'0 = no limit. A limit makes the law lighter on the budget.' },
			{ key:'callout', label:'Call-out', type:'text', max:22, default:'', hint:'A word that appears over the creature when the law applies ("GUILTY", "COPIED").' }
		],
		input:{ energy:'none' },
		perBody:false,
		cost:(p, kids) => Math.round(4 + lawWeight(p, 0) * 1.5 + 2 * (kids || 0)),
		summary:(p) => (ev(p.event) ? ev(p.event).label.toLowerCase() : '') + ' → ' + (ef(p.effect) ? ef(p.effect).label.toLowerCase() : ''),
		note:(p) => describeLaw(p) + '  Weight ' + lawWeight(p, 0) + '.',
		analyze(p, a, node){
			const par = a.def && node.parent ? a.def.nodes[node.parent] : null;
			if(!par || par.type !== 'domain') a.error(node, 'LAW_PLACE', 'A law belongs directly under a Domain Expansion rune');
			if((p.effect === 'copy') && p.event !== 'casts' && p.event !== 'attacks') a.error(node, 'LAW_COPY', '"Copy the spell they cast" needs the event "when they cast a spell" or "when they attack or cast"');
			if(p.who === 'caster' && HARMFUL[p.effect]) a.error(node, 'LAW_CASTER', 'A law about you can only heal you, add or clear marks, or run runes — it cannot harm you');
			if(p.effect === 'cast' && !(a.kidsOf(node.id) || []).length) a.warn(node, 'LAW_EMPTY', 'This law runs the runes below it — there are none yet');
			if((p.event === 'casts' || p.event === 'attacks') && p.who === 'foe') { /* fine */ }
			let kids = 0; const st = (a.kidsOf(node.id) || []).slice();
			while(st.length && kids < 60){ const id = st.pop(); kids++; for(const k of (a.kidsOf(id) || [])) st.push(k); }
			a.extra({ construct: { Law: describeLaw(p), Weight: String(lawWeight(p, kids)) } });
		},
		exec(api){ return api.fail('A law is carried out by its domain, not run as a branch'); }
	});

	/* the domain rune reports the law budget and checks it */
	const baseAnalyze = DR.analyze;
	DR.analyze = function(p, a, node){
		baseAnalyze.call(this, p, a, node);
		const laws = (a.kidsOf(node.id) || []).map(id => a.def && a.def.nodes[id]).filter(n => n && n.type === 'law');
		if(!laws.length) return;
		let used = 0;
		for(const n of laws){ let kids = 0; const st = (a.kidsOf(n.id) || []).slice(); while(st.length && kids < 60){ const id = st.pop(); kids++; for(const k of (a.kidsOf(id) || [])) st.push(k); } used += lawWeight(n.params || {}, kids); }
		used = Math.round(used * 10) / 10;
		// several laws are a much heavier domain: every law after the first adds 60% of the cost of all the laws, again
		if(laws.length > 1 && a.report){
			let sum = 0; for(const n of laws) sum += 4 + 1.5 * lawWeight(n.params || {}, 0);
			const extra = Math.round(sum * 0.6 * (laws.length - 1) * (ME.CONFIG ? ME.CONFIG.domainCostMult || 3.35 : 3.35));
			a.report.cost += extra; a.report.upfront += extra;
			a.nodeExtra && a.nodeExtra.construct && (a.nodeExtra.construct['Laws surcharge'] = '+' + extra + ' mana for ' + laws.length + ' laws');
		}
		const capacity = lawCapacity(a.profile, p.vow);
		if(used > capacity) a.error(node, 'DOMAIN_BUDGET', 'These laws weigh ' + used + ' — your Energy Control holds ' + capacity + '. Remove a law, soften one, or swear a vow');
		const ex = a.nodeExtra && a.nodeExtra.construct;
		if(ex){ ex.Laws = laws.length + ' · weight ' + used + ' / ' + capacity; }
		// the same domain also has a runes-in-rules budget (the base rune counts law runes in it)
	};
	{ const baseSummary = DR.summary; DR.summary = (p) => baseSummary(p) + (p.theme && p.theme !== 'void' ? ' · ' + (THEMES[p.theme] ? THEMES[p.theme].name : p.theme) : ''); }

	/* a condition that reads the marks the laws leave */
	defineCondition({ id:'targetMarked', name:'Target carries marks', needs:'target', group:'zone',
		description:'Waits until the creature this rule is aimed at carries at least this many marks (laws of a Domain add them). Handy in Domain rules: "three offences, then punish".',
		params:[ { key:'count', label:'Marks at least', type:'int', min:1, max:12, step:1, default:3 } ],
		check(api, br, p){ const e = br.ctx.target && br.ctx.target.ref; if(!e) return 'fail'; const S = api.world._domS; return !!S && markOf(S, e) >= num(p.count, 3); } });

	/* ================================================================ runtime */
	function markOf(S, e){ return S.marks.get(e) || 0; }
	function hpFrac(e){ return e && e.hp != null ? e.hp / Math.max(1, e.maxHp || e.hp) : 1; }
	function ctr(e){ return { x: (e.x || 0) + (e.w || 0) / 2, y: (e.y || 0) + (e.h || 0) / 2 }; }
	function foeName(e){ return (e && (e.name || e.type || e.kind)) ? String(e.name || e.type || e.kind) : 'Foe'; }
	function countKids(inst, id){ let n = 0; const st = (inst.kids[id] || []).slice(); while(st.length && n < 80){ const k = st.pop(); n++; for(const c of (inst.kids[k] || [])) st.push(c); } return n; }

	function init(W, I){
		const S = W._domS = { marks: new Map(), seals: new Map(), exposed: new Map(), t: 0, texts: [] };
		const ME_ = ME;
		const instOf = I.instById;

		function entCenter(e){ return I.center ? I.center(e) : ctr(e); }
		function say(D, e, text, color){
			if(!text) return;
			const c = entCenter(e);
			if(W.host.vowText) W.host.vowText({ x: c.x, y: c.y - 30 }, text, color || (D.look && D.look.c1) || '#ffd9a0');
			W.rings.push({ x: c.x, y: c.y, r: 6, max: 46, age: 0, life: 16, color: color || '#ffd9a0' });
		}
		function fuelTake(D, inst, want){
			if(!(want > 0)) return 0;
			if(!D.z || !D.z.alive) return 0;
			return I.takeFromZoneOf(inst, D.z, want);
		}
		function trackerOf(D, e, dt, H){
			let tr = D.trk.get(e);
			const hp = e.hp != null ? e.hp : null;
			if(!tr){ tr = { hp, x: e.x || 0, y: e.y || 0, att: false, still: 0, air: false, loss: 0, speed: 0, attEdge: false, jumpEdge: false, seen: false }; D.trk.set(e, tr); }
			tr.loss = (tr.hp != null && hp != null) ? Math.max(0, tr.hp - hp) : 0;
			tr.hp = hp;
			const mv = hypot((e.x || 0) - tr.x, (e.y || 0) - tr.y) / Math.max(1e-3, dt * 60);
			tr.speed = e.vx != null ? Math.max(hypot(e.vx || 0, e.vy || 0), mv * 0.5) : mv;
			tr.x = e.x || 0; tr.y = e.y || 0;
			tr.still = tr.speed < 0.4 ? tr.still + dt : 0;
			const att = !!(H.isAttacking && H.isAttacking(e));
			tr.attEdge = att && !tr.att; tr.att = att;
			const air = e.onGround === false || (e.onGround == null && Math.abs(e.vy || 0) > 3);
			tr.jumpEdge = air && !tr.air && (e.vy || 0) < -1; tr.air = air;
			return tr;
		}

		/* ---------- opening: build the laws from the Domain's children ---------- */
		W._domGather = function(D, inst){ prepare(D, inst); };
		function prepare(D, inst){
			if(D.laws) return;
			D.S = { t: 0 }; D.trk = new Map(); D.copies = []; D.copyCycle = 0; D.laws = []; D.look = W._domLook ? W._domLook(D) : null;
			for(const cid of (inst.kids[D.node.id] || [])){
				const n = inst.def.nodes[cid];
				if(n && n.type === 'law') D.laws.push({ id: n.id, node: n, p: n.params || {}, firstKid: (inst.kids[n.id] || [])[0] || null, kidRunes: countKids(inst, n.id), subj: new Map(), acc: new Map() });
			}
			D.used = D.laws.reduce((t, L) => t + lawWeight(L.p, L.kidRunes), 0);
			D.rulesText = D.laws.map(L => describeLaw(L.p));
		}
		W._domOpen = function(D, inst){
			prepare(D, inst);
			// 'open' laws apply once to everyone inside the moment the barrier is up
			const H = I.hostFor(inst);
			const foes = I.domainFoes(D).filter(e => I.insideDomain(D, entCenter(e).x, entCenter(e).y));
			for(const L of D.laws){
				if(L.p.event !== 'open') continue;
				if(L.p.who !== 'caster') for(const e of foes.slice(0, 8)) fire(D, L, e, 'foe', { open: true }, inst, H);
				if(L.p.who !== 'foe' && inst.owner.entity) fire(D, L, inst.owner.entity, 'caster', { open: true }, inst, H);
			}
		};

		/* ---------- one application of a law ---------- */
		function coolOf(L){ return Math.max(num(L.p.cool, 0.8), minCool(L.p)); }
		function fuelOf(p){
			switch(p.effect){
				case 'damage': return num(p.dmg, 20) * 0.12; case 'burn': return 1.5; case 'execute': return 6 + num(p.executePct, 25) * 0.6; case 'drain': return 0; case 'stun': return 3 * (1 + num(p.secs, 1.5) / 3); case 'slow': return 0.6 * (1 + num(p.slowPct, 50) / 100); case 'bind': return 2.5 * (1 + num(p.secs, 1.5) / 3); case 'pull': return 0.4;
				case 'seal': return 4 * (1 + num(p.secs, 4) / 6); case 'negate': return 8; case 'mark': return 0.4; case 'clear': return 0; case 'expose': return 1.2 * (1 + num(p.exposePct, 40) / 80); case 'heal': return num(p.healAmt, 6) * 0.15; case 'copy': return 2; case 'castCopy': return 0; case 'cast': return 1;
				default: return 0;
			}
		}
		function fire(D, L, e, role, evd, inst, H, cont){
			if(!e || e.dead) return false;
			const p = L.p;
			let st = L.subj.get(e); if(!st){ st = { last: -99, count: 0, timer: 0, seen: false }; L.subj.set(e, st); }
			const now = D.S.t;
			if(num(p.limit, 0) > 0 && st.count >= p.limit) return false;
			if(!cont && p.event !== 'open' && now - st.last < coolOf(L)) return false;
			if(role === 'caster' && HARMFUL[p.effect]) return false;
			// the domain pays for it out of what the zone holds; a thin domain does less
			const want = fuelOf(p) * (cont ? TICK : 1) * (p.effect === 'damage' && cont ? 1 : 1);
			let scale = 1;
			if(want > 0){ const got = fuelTake(D, inst, want); scale = got / want; if(scale < 0.25) return false; }
			st.last = now; st.count++;
			const ok = applyEffect(D, L, e, role, evd || {}, inst, H, scale, !!cont);
			if(ok !== false && p.callout && !cont) say(D, e, p.callout);
			if(p.effect === 'cast' && L.firstKid){ /* the runes below run on this creature */ }
			return ok !== false;
		}

		function infoFor(D, inst, e, color){ const c = entCenter(e); return { instance: inst, color: color || (D.look && D.look.c1) || '#ffd9a0', domain: true, law: true, x: c.x, y: c.y }; }

		function applyEffect(D, L, e, role, evd, inst, H, scale, cont){
			const p = L.p, mult = D.mult || 1, k = cont ? TICK : 1;
			switch(p.effect){
				case 'damage': { const amt = num(p.dmg, 20) * mult * scale * k; if(role === 'caster') return false; H.damageEnemy(e, amt, infoFor(D, inst, e)); return true; }
				case 'burn':   applyStatusAs(inst, e, 'burn', num(p.burnDps, 8) * mult * scale, cont ? 1.2 : Math.max(1, num(p.secs, 3))); return true;
				case 'execute': {
					const tough = e.boss || e.isBoss || e.elite || e.miniboss;
					if(hpFrac(e) * 100 > (tough ? Math.min(15, num(p.executePct, 25)) : num(p.executePct, 25))) return false;   // bosses and elites only fall at ≤15%
					const info = infoFor(D, inst, e, '#ff5a6e'); info.lethal = true;
					H.damageEnemy(e, Math.max(1, (e.hp || 1)) + 1, info); return true;
				}
				case 'drain': {
					const got = W.host.siphonEnergy ? W.host.siphonEnergy(e, num(p.drainAmt, 15) * k * scale) : 0;
					if(got > 0 && D.z && D.z.alive) I.depositZone(D.z, got * 0.5);
					return got > 0;
				}
				case 'stun':  applyStatusAs(inst, e, 'stunned', 1, num(p.secs, 1.5)); return true;
				case 'slow':  applyStatusAs(inst, e, 'slowed', num(p.slowPct, 50) / 100, cont ? 0.8 : num(p.secs, 1.5)); return true;
				case 'bind':  applyStatusAs(inst, e, 'bound', 1, num(p.secs, 1.5)); return true;
				case 'pull': {
					const c = entCenter(e), dx = D.x - c.x, dy = D.y - c.y, d = hypot(dx, dy) || 1;
					const step = Math.min(d, num(p.pullPx, 3) * 60 * TICK * (cont ? 1 : 0.25)) * 0.4;
					if(W.host.nudge) W.host.nudge(e, dx / d * step, dy / d * step * 0.25);
					return true;
				}
				case 'seal': {
					const until = W.time + num(p.secs, 4);
					let s = S.seals.get(e); if(!s){ s = { casting: 0, techniques: 0 }; S.seals.set(e, s); }
					if(p.sealKind === 'techniques') s.techniques = Math.max(s.techniques, until); else s.casting = Math.max(s.casting, until), s.techniques = Math.max(s.techniques, until);
					return true;
				}
				case 'negate': {
					let n = 0;
					for(const b of W.bodies){ if(!b.alive || b.isZone || b.zoneBlob) continue; const bi = instOf(b.inst); if(bi && bi.owner && bi.owner.entity === e){ I.killBody(b, 'domain'); n++; } }
					return n > 0;
				}
				case 'mark': S.marks.set(e, Math.min(12, markOf(S, e) + Math.max(1, num(p.markAdd, 1) * (cont ? 0.25 : 1)))); return true;
				case 'clear': S.marks.delete(e); return true;
				case 'expose': S.exposed.set(e, { until: W.time + (cont ? 0.8 : num(p.secs, 4)), pct: num(p.exposePct, 40) / 100 * mult, D, inst }); return true;
				case 'heal': {
					const ent = role === 'caster' ? e : inst.owner.entity;
					if(ent && W.host.heal) W.host.heal(ent, num(p.healAmt, 6) * scale * k);
					return true;
				}
				case 'copy': return copyFrom(D, L, e, evd, inst);
				case 'castCopy': return castCopy(D, L, e, inst, H);
				case 'cast': {
					if(!L.firstKid) return false;
					const nb = I.spawnRule(D, { cid: L.firstKid }, e, true);
					return !!nb;
				}
			}
			return false;
		}
		function applyStatusAs(inst, e, type, mag, secs){
			// a status applied by this domain's owner: a burn hurts through that caster's view of the world
			I.applyStatus(e, type, mag, secs, { why: 'law', H: I.hostFor(inst) });
		}

		/* ---------- copying spells ---------- */
		function plainDef(def){ for(const id in def.nodes){ const t = def.nodes[id].type; if(t === 'domain' || t === 'law') return false; } return true; }
		function echoDef(e, name){
			const s = ME_.blankSpell('Echo of ' + name); const root = s.nodes[s.rootId];
			const dmg = num(e.damage || e.dmg || e.attackDamage || e.atk, 0);
			const amount = clamp(dmg > 0 ? dmg * 3 : (e.maxHp || e.hp || 400) * 0.04, 25, 130);
			root.type = 'generate'; root.params = Object.assign(ME_.paramDefaults('generate'), { amount: Math.round(amount), spawn: 'caster' });
			let seq = 1; const add = (type, parent, params) => { const n = ME_.makeNode(type, parent, 's', 0, seq, seq); seq++; n.params = Object.assign(ME_.paramDefaults(type), params || {}); s.nodes[n.id] = n; return n; };
			const c = add('compress', root.id, { power: 4, shape: 'point' });
			add('redirect', c.id, { toward: 'target', speedPct: 85 });
			s.seq = seq; return s;
		}
		function energyOf(def){ let t = 0; for(const id in def.nodes){ const n = def.nodes[id]; if(n.type === 'generate') t += num(n.params && n.params.amount, 0); } return t; }
		function copyFrom(D, L, e, evd, inst){
			let entry;
			if(evd.spell && evd.spell.def){
				const sd = evd.spell.def;
				if(!plainDef(sd)) { say(D, e, 'CANNOT COPY', '#ff9db0'); return false; }
				entry = { name: String(sd.name || 'Spell'), def: JSON.parse(JSON.stringify(sd)), kind: 'spell', from: foeName(e), energy: energyOf(sd) };
			} else {
				const nm = foeName(e);
				const def = echoDef(e, nm);
				entry = { name: 'Echo of ' + nm, def, kind: 'echo', from: nm, energy: energyOf(def) };
			}
			const i = D.copies.findIndex(c => c.name === entry.name);
			if(i >= 0) D.copies.splice(i, 1);
			D.copies.push(entry);
			while(D.copies.length > clamp(num(L.p.copySlots, 4), 1, 6)) D.copies.shift();
			D.copied = (D.copied || 0) + 1;
			const c = entCenter(e);
			W.rings.push({ x: c.x, y: c.y, r: 8, max: 70, age: 0, life: 22, color: (D.look && D.look.c2) || '#ffffff' });
			return true;
		}
		function copyProfile(base){
			const all = {}; for(const id of (ME_.Techniques.order || [])) all[id] = 6;
			return Object.assign({}, base, { allocations: all, techniquePoints: 99, energyControl: Math.max(num(base.energyControl, 10), 24), runeCapacity: 100, maxOutput: Math.max(num(base.maxOutput, 200), 800), maxEnergy: Math.max(num(base.maxEnergy, 500), 2500) });
		}
		function scaleDef(def, k){
			if(Math.abs(k - 1) < 0.01) return def;
			const d = JSON.parse(JSON.stringify(def));
			for(const id in d.nodes){ const n = d.nodes[id]; if(n.type === 'generate' && n.params) n.params.amount = Math.max(5, Math.round(num(n.params.amount, 20) * k)); }
			return d;
		}
		function castCopy(D, L, e, inst, H){
			if(!D.copies.length) return false;
			const live = W.instances.filter(i => i.fromDomain === D.id && !i.done).length;
			if(live >= 3) return false;
			let c;
			if(L.p.copyPick === 'newest') c = D.copies[D.copies.length - 1];
			else if(L.p.copyPick === 'strongest') c = D.copies.slice().sort((a, b) => b.energy - a.energy)[0];
			else c = D.copies[(D.copyCycle++) % D.copies.length];
			const budget = D.z && D.z.alive ? Math.max(0, D.z.amount) : 0;
			if(budget < 12) return false;
			const k = clamp(num(L.p.copyScale, 1), 0.3, 1.5) * Math.min(1, (budget * 0.6) / Math.max(10, c.energy));
			const def = scaleDef(c.def, k);
			const res = W.cast(def, { profile: copyProfile(inst.profile), owner: inst.owner, fromDomain: true,
				ctx: { target: { kind: 'enemy', ref: e }, zone: D.z, domain: D, domainRule: true } });
			if(!res.ok){ if(W.debugDomain) console.log('castCopy fail', res.error); return false; }
			res.instance.fromDomain = D.id; res.instance.copyOf = c.name;
			D.cast = (D.cast || 0) + 1;
			const cc = entCenter(e);
			W.rings.push({ x: cc.x, y: cc.y, r: 10, max: 54, age: 0, life: 14, color: (D.look && D.look.c1) || '#ffffff' });
			return true;
		}

		/* ---------- the tick: continuous laws, event laws, exposure ---------- */
		W._domTick = function(D, dt, f, inside, foes, inst){
			if(!D.laws) prepare(D, inst);
			D.S.t += dt; S.t = W.time;
			const H = I.hostFor(inst);
			const owner = inst.owner, ce = owner.entity;
			const cc = ce ? entCenter(ce) : null;
			const casterIn = !!(cc && I.insideDomain(D, cc.x, cc.y));
			const subjFoes = inside.slice(0, 8);
			const all = subjFoes.slice(); if(casterIn && ce) all.push(ce);
			for(const e of all) trackerOf(D, e, dt, H);
			// exposure: blows taken since the last tick hurt a little more
			for(const e of subjFoes){
				const x = S.exposed.get(e); if(!x || x.D !== D) continue;
				if(x.until < W.time){ S.exposed.delete(e); continue; }
				const tr = D.trk.get(e);
				if(tr && tr.loss > 0.5 && !D._expBusy){ D._expBusy = true; const extra = tr.loss * x.pct; H.damageEnemy(e, extra, infoFor(D, inst, e, '#ff9db0')); tr.hp = e.hp; D._expBusy = false; }
			}
			for(const L of D.laws){
				const p = L.p;
				const who = [];
				if(p.who !== 'caster') for(const e of subjFoes) who.push([e, 'foe']);
				if(p.who !== 'foe' && casterIn && ce) who.push([ce, 'caster']);
				for(const [e, role] of who){
					const tr = D.trk.get(e); if(!tr) continue;
					let st = L.subj.get(e); if(!st){ st = { last: -99, count: 0, timer: 0, seen: false }; L.subj.set(e, st); }
					switch(p.event){
						case 'always': {
							if(CONTINUOUS[p.effect]){ st.timer -= dt; if(st.timer <= 0){ st.timer = TICK; fire(D, L, e, role, {}, inst, H, true); } }
							else fire(D, L, e, role, {}, inst, H, false);
							break;
						}
						case 'every': {
							st.timer -= dt;
							if(st.timer <= 0){ const ok = fire(D, L, e, role, {}, inst, H, false); st.timer = ok ? Math.max(0.25, num(p.period, 3)) : Math.min(Math.max(0.25, num(p.period, 3)), 0.4); }
							break;
						}
						case 'enter': if(!st.seen){ st.seen = true; fire(D, L, e, role, {}, inst, H, false); } break;
						case 'attacks': if(tr.attEdge) fire(D, L, e, role, { attack: true }, inst, H, false); break;
						case 'moves': if(tr.speed > num(p.speed, 4)) fire(D, L, e, role, {}, inst, H, false); break;
						case 'still': if(tr.still >= num(p.still, 2)) fire(D, L, e, role, {}, inst, H, false); break;
						case 'jumps': if(tr.jumpEdge) fire(D, L, e, role, {}, inst, H, false); break;
						case 'damaged': if(tr.loss >= num(p.dmgMin, 1)) fire(D, L, e, role, { damage: tr.loss }, inst, H, false); break;
						case 'lowHp': if(hpFrac(e) * 100 <= num(p.hpPct, 30)) fire(D, L, e, role, {}, inst, H, false); break;
						case 'marked': if(markOf(S, e) >= num(p.marksN, 3)){ if(fire(D, L, e, role, {}, inst, H, false) && p.spend !== 'keep') S.marks.set(e, Math.max(0, markOf(S, e) - num(p.marksN, 3))); } break;
					}
				}
			}
			// drop trackers of creatures that are gone
			if(W.frame % 120 === 0) for(const e of Array.from(D.trk.keys())) if(e.dead) D.trk.delete(e);
		};
		W._domEdge = function(D, e){
			if(!D.laws) return;
			const inst = instOf(D.inst); if(!inst) return; const H = I.hostFor(inst);
			for(const L of D.laws) if(L.p.event === 'leave' && L.p.who !== 'caster') fire(D, L, e, 'foe', { edge: true }, inst, H, false);
		};
		/* a spell is cast somewhere: laws about casting see it */
		W._domCast = function(inst, castOpts){
			if(castOpts && castOpts.fromDomain) return;
			if(!W.domains.length) return;
			const ent = inst.owner && inst.owner.entity; if(!ent) return;
			for(const D of W.domains){
				if(!D.alive || D.phase !== 'active' || !D.laws || !D.laws.length) continue;
				const c = entCenter(ent); if(!I.insideDomain(D, c.x, c.y)) continue;
				const di = instOf(D.inst); if(!di) continue;
				const role = inst.owner.id === D.ownerId ? 'caster' : 'foe';
				const H = I.hostFor(di);
				if(role === 'foe' && !D.trk.has(ent)) trackerOf(D, ent, 1 / 60, H);
				for(const L of D.laws){
					const p = L.p;
					if(p.event !== 'casts' && p.event !== 'attacks') continue;
					if(role === 'foe' && p.who === 'caster') continue; if(role === 'caster' && p.who === 'foe') continue;
					fire(D, L, ent, role, { spell: inst, attack: true }, di, H, false);
				}
			}
		};
		W._domEnd = function(D, why){
			if(!D.laws) return;
			for(const [e, x] of Array.from(S.exposed.entries())) if(x.D === D) S.exposed.delete(e);
			if(D.trk) for(const e of D.trk.keys()) S.marks.delete(e);
		};
		W._domClear = function(){ S.marks.clear(); S.seals.clear(); S.exposed.clear(); };

		/* ---------- seals: a confiscated technique or a silenced caster ---------- */
		function sealOfOwner(owner){
			if(!owner || !owner.entity) return null;
			return S.seals.get(owner.entity) || null;
		}
		W.sealLeft = function(owner, kind){
			const s = sealOfOwner(owner); if(!s) return 0;
			const until = kind === 'techniques' ? s.techniques : s.casting;
			return until > W.time ? until - W.time : 0;
		};
		W._castBlocked = function(owner){
			const s = sealOfOwner(owner);
			if(s && s.casting > W.time) return 'Sealed — a domain has silenced your casting for ' + (s.casting - W.time).toFixed(1) + ' s';
			return null;
		};
		W.marksOf = (e) => markOf(S, e);
		W.sealsOf = (e) => S.seals.get(e) || null;
	}
	ME.registerWorldHook({ init });

	root.MagicDomain = { THEMES, ACCENTS, PATTERNS, MOTES, INTERIORS, BURSTS, EVENTS, EFFECTS, WHO, lawWeight, lawCapacity, describeLaw, effectWeight, HARMFUL };
})(typeof window !== 'undefined' ? window : globalThis);
