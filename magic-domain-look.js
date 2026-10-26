/*
 * DOMAIN LOOK — what a domain's world looks like (c70). Loaded after magic-domain.js, before magic-domain-art.js.
 *
 * A look is a flat object of layers, each with many choices. Combine them freely:
 *
 *   Colours   primary, highlight, second colour, deep colour (or a ready palette)
 *   World     sky · a landmark on the horizon · where the horizon sits
 *   Floor     the ground of the domain · a sigil (on the floor or around you) and its size
 *   Air       two particle layers (kind, amount) and their speed
 *   Barrier   how the edge is drawn · its width and glow · a band of runes
 *   Light     darkness or brightness · light rays · vignette · pulse · how fully the real world is replaced · animation speed
 *   Opening   the burst · how the frozen world is tinted · letterbox · title font, layout, colour and a subtitle
 *   Outside   what a sealed domain looks like to someone outside it
 *
 * MagicDomainLook.resolve(params, mine)  → a complete look (from params.look, or from the older theme / accent / pattern params)
 * MagicDomainLook.random(seed, lockedLook) → a coherent random look
 * MagicDomainLook.encode(look) / decode(code)  → a short shareable code
 */
(function(root){
	'use strict';
	const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
	const num = (v, d) => { v = Number(v); return isFinite(v) ? v : d; };
	const isHex = (c) => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c);

	/* ---------------------------------------------------------------- the choices */
	const o = (v, label, hint) => ({ v, label, hint: hint || '' });
	const SKIES = [
		o('void', 'Void', 'Near black, a faint glow at the heart'), o('night', 'Night', 'A deep night with still stars'), o('nebula', 'Nebula', 'Clouds of coloured gas and stars'),
		o('dusk', 'Dusk', 'A glowing horizon under a dark sky'), o('dawn', 'Dawn', 'Pale and soft, lit from the horizon'), o('radiant', 'Radiant', 'Bright, white-hot light'),
		o('bloodmoon', 'Blood sky', 'Dark red with low, heavy clouds'), o('aurora', 'Aurora', 'Curtains of light in a night sky'), o('storm', 'Storm', 'Grey cloud masses and lightning'),
		o('abyss', 'Abyss', 'Black, lit from far below'), o('inkwash', 'Ink wash', 'Pale paper and brushed ink'), o('ember', 'Ember', 'Smoke and a burning horizon'),
		o('frost', 'Frost', 'Cold, pale blue light'), o('deep', 'Underwater', 'Blue depths with light falling from above'), o('sunset', 'Sunset', 'Warm orange into violet')
	];
	const LANDMARKS = [
		o('none', 'Nothing'), o('moon', 'Moon'), o('sun', 'Sun'), o('eclipse', 'Eclipse'), o('planet', 'Ringed planet'), o('eye', 'Great eye', 'It watches the nearest foe'),
		o('halo', 'Halo', 'Turning rings of light'), o('rift', 'Rift', 'A tear in the world'), o('clock', 'Clock', 'Its hands turn'), o('gate', 'Gate'), o('temple', 'Temple'),
		o('spires', 'Spires'), o('throne', 'Throne'), o('tree', 'Great tree'), o('mountains', 'Mountains'), o('hands', 'Rising hands'), o('scales', 'Scales'), o('lotus', 'Lotus'),
		o('pillars', 'Colonnade'), o('blades', 'Sword ring', 'A ring of blades hanging in the sky')
	];
	const FLOORS = [
		o('none', 'None (real ground)'), o('water', 'Still water', 'Reflects the sky'), o('mirror', 'Mirror', 'A polished, endless floor'), o('tiles', 'Tiles'), o('stone', 'Flagstones'),
		o('grid', 'Neon grid'), o('field', 'Flower field'), o('blades', 'Field of swords'), o('sand', 'Dunes'), o('ice', 'Ice'), o('lava', 'Lava'), o('ash', 'Ash'),
		o('clouds', 'Sea of clouds'), o('void', 'Starry void'), o('petals', 'Petal carpet'), o('bones', 'Bone field')
	];
	const SIGILS = [
		o('none', 'None'), o('rings', 'Rings'), o('glyphs', 'Glyph circle'), o('mandala', 'Mandala'), o('hexagram', 'Hexagram'), o('clock', 'Clock face'), o('spiral', 'Spiral'),
		o('web', 'Web'), o('lattice', 'Lattice'), o('compass', 'Compass'), o('lotus', 'Lotus'), o('petals', 'Petals'), o('spikes', 'Spikes'), o('pillars', 'Pillars and scales'),
		o('waves', 'Waves'), o('stars', 'Constellation'), o('cracks', 'Cracks'), o('grid', 'Grid')
	];
	const SIGIL_AT = [ o('floor', 'On the floor'), o('center', 'Around you'), o('both', 'Both'), o('sky', 'In the sky') ];
	const PARTICLES = [
		o('none', 'None'), o('embers', 'Embers'), o('sparks', 'Sparks'), o('ash', 'Ash'), o('smoke', 'Smoke'), o('snow', 'Snow'), o('rain', 'Rain'), o('petals', 'Petals'),
		o('leaves', 'Leaves'), o('feathers', 'Feathers'), o('butterflies', 'Butterflies'), o('fireflies', 'Fireflies'), o('bubbles', 'Bubbles'), o('stars', 'Twinkling stars'),
		o('glyphs', 'Glyphs'), o('shards', 'Shards'), o('ink', 'Ink'), o('lightning', 'Lightning')
	];
	const BARRIERS = [
		o('orb', 'Glass orb'), o('dome', 'Dome', 'Rests on the ground'), o('ring', 'Thin ring'), o('runes', 'Rune band'), o('thorns', 'Thorns'), o('cage', 'Cage'),
		o('flames', 'Flames'), o('ribbons', 'Ribbons'), o('mirror', 'Facets'), o('lattice', 'Hex shell'), o('none', 'Soft edge')
	];
	const AMBIENT = [ o('dark', 'Dark'), o('dim', 'Dim'), o('normal', 'Natural'), o('bright', 'Bright') ];
	const BURSTS = [
		o('shockwave', 'Shockwave'), o('bloom', 'Bloom'), o('shards', 'Shattering'), o('ink', 'Ink flood'), o('petalstorm', 'Petal storm'), o('collapse', 'Collapse', 'Pulled in, then thrown out'),
		o('lightning', 'Lightning'), o('ripple', 'Ripples'), o('feathers', 'Feathers'), o('eclipse', 'Eclipse'), o('flames', 'Firestorm'), o('glass', 'Shattered glass')
	];
	const FREEZE = [ o('grey', 'Grey'), o('sepia', 'Old photograph'), o('invert', 'Negative'), o('tint', 'Tinted'), o('dark', 'Darkness'), o('none', 'Untouched') ];
	const FONTS = [ o('serif', 'Classic serif'), o('elegant', 'Elegant'), o('bold', 'Heavy'), o('brush', 'Brush'), o('gothic', 'Blackletter'), o('mono', 'Typewriter'), o('wide', 'Wide') ];
	const LAYOUTS = [ o('center', 'Centred'), o('low', 'Low, cinematic'), o('vertical', 'Vertical, at the side'), o('split', 'Split across the screen') ];
	const TITLE_COLOR = [ o('auto', 'Domain colour'), o('white', 'White'), o('black', 'Black on light'), o('primary', 'Primary'), o('gold', 'Gold') ];
	const VEILS = [ o('shell', 'Glowing shell'), o('black', 'Black sphere'), o('mirror', 'Mirror sphere'), o('cocoon', 'Woven cocoon'), o('lattice', 'Hex shell'), o('storm', 'Storm globe') ];

	const FIELDS = [
		{ key:'c1', tab:'colours', label:'Primary', type:'color' },
		{ key:'c2', tab:'colours', label:'Highlight', type:'color' },
		{ key:'c3', tab:'colours', label:'Second colour', type:'color' },
		{ key:'bg', tab:'colours', label:'Deep colour', type:'color' },
		{ key:'sky', tab:'world', label:'Sky', type:'choice', options: SKIES },
		{ key:'landmark', tab:'world', label:'Landmark', type:'choice', options: LANDMARKS },
		{ key:'landmarkSize', tab:'world', label:'Landmark size', type:'range', min:0.5, max:1.6, step:0.05 },
		{ key:'horizon', tab:'world', label:'Horizon height', type:'range', min:0.1, max:0.7, step:0.02 },
		{ key:'floor', tab:'floor', label:'Floor', type:'choice', options: FLOORS },
		{ key:'sigil', tab:'floor', label:'Sigil', type:'choice', options: SIGILS },
		{ key:'sigilAt', tab:'floor', label:'Sigil placed', type:'choice', options: SIGIL_AT },
		{ key:'sigilSize', tab:'floor', label:'Sigil size', type:'range', min:0.3, max:1, step:0.05 },
		{ key:'p1', tab:'air', label:'Particles', type:'choice', options: PARTICLES },
		{ key:'p1n', tab:'air', label:'Amount', type:'range', min:0.2, max:2.5, step:0.1 },
		{ key:'p2', tab:'air', label:'Second particles', type:'choice', options: PARTICLES },
		{ key:'p2n', tab:'air', label:'Amount', type:'range', min:0.2, max:2.5, step:0.1 },
		{ key:'pSpeed', tab:'air', label:'Drift speed', type:'range', min:0.2, max:3, step:0.1 },
		{ key:'barrier', tab:'barrier', label:'Edge', type:'choice', options: BARRIERS },
		{ key:'rim', tab:'barrier', label:'Edge width', type:'range', min:1, max:12, step:0.5 },
		{ key:'glow', tab:'barrier', label:'Edge glow', type:'range', min:0, max:2, step:0.1 },
		{ key:'rimRunes', tab:'barrier', label:'Rune band on the edge', type:'toggle' },
		{ key:'ambient', tab:'light', label:'Light', type:'choice', options: AMBIENT },
		{ key:'rays', tab:'light', label:'Light rays', type:'range', min:0, max:1, step:0.05 },
		{ key:'vignette', tab:'light', label:'Vignette', type:'range', min:0, max:1, step:0.05 },
		{ key:'pulse', tab:'light', label:'Pulse', type:'range', min:0, max:1, step:0.05 },
		{ key:'immersion', tab:'light', label:'Replaces the world', type:'range', min:0.3, max:1, step:0.05 },
		{ key:'spin', tab:'light', label:'Animation speed', type:'range', min:0, max:3, step:0.1 },
		{ key:'burst', tab:'opening', label:'Burst', type:'choice', options: BURSTS },
		{ key:'freeze', tab:'opening', label:'Frozen world', type:'choice', options: FREEZE },
		{ key:'letterbox', tab:'opening', label:'Cinema bars', type:'toggle' },
		{ key:'titleFont', tab:'opening', label:'Title font', type:'choice', options: FONTS },
		{ key:'titleLayout', tab:'opening', label:'Title layout', type:'choice', options: LAYOUTS },
		{ key:'titleColor', tab:'opening', label:'Title colour', type:'choice', options: TITLE_COLOR },
		{ key:'subtitle', tab:'opening', label:'Subtitle', type:'text', max:40 },
		{ key:'veil', tab:'outside', label:'Seen from outside', type:'choice', options: VEILS }
	];
	const TABS = [
		{ id:'colours', label:'Colours', icon:'🎨' }, { id:'world', label:'World', icon:'🌌' }, { id:'floor', label:'Floor', icon:'⬭' }, { id:'air', label:'Air', icon:'✧' },
		{ id:'barrier', label:'Edge', icon:'◯' }, { id:'light', label:'Light', icon:'☀' }, { id:'opening', label:'Opening', icon:'✦' }, { id:'outside', label:'Outside', icon:'◐' }
	];

	/* ---------------------------------------------------------------- ready palettes */
	const PALETTES = [
		{ name:'Violet void',   c1:'#b896ff', c2:'#f3e9ff', c3:'#5a7dff', bg:'#0a061c' },
		{ name:'Crimson',       c1:'#ff3b4f', c2:'#ffd9b0', c3:'#8a0f22', bg:'#1a0408' },
		{ name:'Gold court',    c1:'#ffd36b', c2:'#fff6dc', c3:'#b0703a', bg:'#14100a' },
		{ name:'Rose',          c1:'#ff8ac8', c2:'#fff0f8', c3:'#c9a8ff', bg:'#2a0f22' },
		{ name:'Abyssal blue',  c1:'#4fd8ff', c2:'#e0fbff', c3:'#2a6bff', bg:'#031a2a' },
		{ name:'Jade',          c1:'#7dffb0', c2:'#eaffee', c3:'#ffd36b', bg:'#04140a' },
		{ name:'Ice',           c1:'#a8e8ff', c2:'#ffffff', c3:'#7a9cff', bg:'#06121e' },
		{ name:'Ember',         c1:'#ff8a3d', c2:'#ffe2b0', c3:'#ff3b2f', bg:'#1c0a02' },
		{ name:'Starlight',     c1:'#9fa8ff', c2:'#ffffff', c3:'#ff9fe0', bg:'#04041a' },
		{ name:'Toxic',         c1:'#b6ff3b', c2:'#f4ffd6', c3:'#3bffb0', bg:'#0a1404' },
		{ name:'Monochrome',    c1:'#d8d8e0', c2:'#ffffff', c3:'#7a7a88', bg:'#0c0c10' },
		{ name:'Ink and paper', c1:'#2a2a33', c2:'#f6f1e4', c3:'#c23a2a', bg:'#e9e2d0' },
		{ name:'Sunset',        c1:'#ff9a4f', c2:'#fff0d6', c3:'#c34fff', bg:'#1a0a1e' },
		{ name:'Royal',         c1:'#6a7dff', c2:'#e8ecff', c3:'#ffd36b', bg:'#070a24' },
		{ name:'Blood moon',    c1:'#ff5a3b', c2:'#ffd0b8', c3:'#5a0010', bg:'#100204' },
		{ name:'Spirit',        c1:'#5affe0', c2:'#e8fffb', c3:'#b896ff', bg:'#03141a' },
		{ name:'Heaven',        c1:'#ffe9a8', c2:'#ffffff', c3:'#a8d8ff', bg:'#f2efe6' },
		{ name:'Plague',        c1:'#9aff6b', c2:'#e8ffd0', c3:'#6b3bff', bg:'#081006' }
	];

	/* ---------------------------------------------------------------- the base and the presets */
	const BASE = {
		preset:'void', c1:'#b896ff', c2:'#f3e9ff', c3:'#5a7dff', bg:'#0a061c',
		sky:'void', landmark:'halo', landmarkSize:1, horizon:0.36,
		floor:'void', sigil:'rings', sigilAt:'floor', sigilSize:0.85,
		p1:'glyphs', p1n:1, p2:'stars', p2n:0.7, pSpeed:1,
		barrier:'orb', rim:3, glow:1, rimRunes:false,
		ambient:'dim', rays:0.25, vignette:0.55, pulse:0.3, immersion:0.92, spin:1,
		burst:'shockwave', freeze:'grey', letterbox:true, titleFont:'serif', titleLayout:'center', titleColor:'auto', subtitle:'',
		veil:'shell', seed:0
	};
	const P = (name, c, look) => Object.assign({}, PALETTES.find(p => p.name === c) || {}, look, { name });
	const PRESETS = {
		void:      P('Boundless Void', 'Violet void', { sky:'nebula', landmark:'halo', floor:'void', sigil:'rings', p1:'glyphs', p2:'stars', barrier:'orb', burst:'shockwave', veil:'black', ambient:'dim' }),
		shrine:    P('Crimson Shrine', 'Crimson', { sky:'bloodmoon', landmark:'temple', floor:'bones', sigil:'spikes', p1:'embers', p2:'ash', barrier:'thorns', burst:'shards', freeze:'tint', ambient:'dark', titleFont:'brush', rays:0.15 }),
		court:     P('The Courtroom', 'Gold court', { sky:'dusk', landmark:'scales', floor:'tiles', sigil:'pillars', p1:'glyphs', p2:'fireflies', p2n:0.5, barrier:'ring', rimRunes:true, burst:'bloom', titleFont:'elegant', titleLayout:'low', rays:0.5 }),
		love:      P('Mutual Love', 'Rose', { sky:'dawn', landmark:'halo', floor:'blades', sigil:'petals', p1:'petals', p2:'fireflies', p2n:0.5, barrier:'orb', burst:'petalstorm', ambient:'bright', rays:0.6, titleFont:'elegant', veil:'cocoon', bg:'#fff1f8' }),
		sea:       P('The Deep', 'Abyssal blue', { sky:'deep', landmark:'none', floor:'sand', sigil:'waves', p1:'bubbles', p2:'snow', p2n:0.5, pSpeed:0.6, barrier:'ribbons', burst:'ripple', rays:0.7, veil:'storm' }),
		eclipse:   P('Eclipse', 'Ember', { sky:'night', landmark:'eclipse', floor:'mirror', sigil:'rings', p1:'embers', p2:'stars', barrier:'orb', burst:'eclipse', bg:'#050303', veil:'black' }),
		garden:    P('Jade Garden', 'Jade', { sky:'dawn', landmark:'tree', floor:'field', sigil:'lotus', p1:'petals', p2:'leaves', barrier:'dome', burst:'bloom', ambient:'normal', rays:0.5 }),
		frost:     P('Frozen Hall', 'Ice', { sky:'frost', landmark:'spires', floor:'ice', sigil:'cracks', p1:'snow', p2:'shards', p2n:0.4, barrier:'mirror', burst:'glass', ambient:'normal' }),
		ember:     P('Ember Plain', 'Ember', { sky:'ember', landmark:'mountains', floor:'lava', sigil:'cracks', p1:'embers', p2:'ash', barrier:'flames', burst:'flames', ambient:'dim' }),
		galaxy:    P('Starfield', 'Starlight', { sky:'nebula', landmark:'planet', floor:'void', sigil:'stars', p1:'stars', p2:'fireflies', barrier:'cage', burst:'bloom' }),
		clockwork: P('Clockwork Tower', 'Gold court', { sky:'sunset', landmark:'clock', floor:'stone', sigil:'clock', p1:'sparks', p2:'glyphs', p2n:0.5, barrier:'runes', burst:'ripple', titleFont:'mono', c3:'#9a6b3a' }),
		cathedral: P('Cathedral of Light', 'Heaven', { sky:'radiant', landmark:'spires', floor:'mirror', sigil:'mandala', p1:'feathers', p2:'fireflies', barrier:'orb', burst:'feathers', ambient:'bright', rays:1, titleFont:'elegant', titleColor:'gold', veil:'mirror' }),
		storm:     P('Eye of the Storm', 'Royal', { sky:'storm', landmark:'eye', floor:'water', sigil:'spiral', p1:'rain', p2:'lightning', p2n:0.6, barrier:'ribbons', burst:'lightning', ambient:'dark', veil:'storm', titleFont:'bold' }),
		ink:       P('Ink Mountains', 'Ink and paper', { sky:'inkwash', landmark:'mountains', floor:'clouds', sigil:'spiral', p1:'ink', p2:'leaves', p2n:0.5, barrier:'none', burst:'ink', freeze:'sepia', titleFont:'brush', titleLayout:'vertical', titleColor:'black', ambient:'normal', vignette:0.3 }),
		mirror:    P('Hall of Mirrors', 'Monochrome', { sky:'void', landmark:'rift', floor:'mirror', sigil:'lattice', p1:'shards', p2:'sparks', barrier:'mirror', burst:'glass', freeze:'invert', veil:'mirror' }),
		bloodmoon: P('Blood Moon', 'Blood moon', { sky:'bloodmoon', landmark:'moon', floor:'ash', sigil:'hexagram', p1:'ash', p2:'embers', barrier:'thorns', burst:'collapse', veil:'black', ambient:'dark', titleFont:'gothic', landmarkSize:1.2 }),
		heaven:    P('Feather Heaven', 'Heaven', { sky:'radiant', landmark:'halo', floor:'clouds', sigil:'compass', p1:'feathers', p2:'sparks', p2n:0.4, barrier:'dome', burst:'feathers', ambient:'bright', rays:0.9, titleColor:'gold' }),
		abyss:     P('The Abyss', 'Spirit', { sky:'abyss', landmark:'hands', floor:'void', sigil:'web', p1:'smoke', p2:'ink', barrier:'lattice', burst:'collapse', veil:'black', ambient:'dark', freeze:'dark', titleFont:'gothic', bg:'#020608' }),
		desert:    P('Sunken Sands', 'Sunset', { sky:'sunset', landmark:'sun', floor:'sand', sigil:'compass', p1:'ash', p2:'sparks', p2n:0.4, barrier:'dome', burst:'ripple', ambient:'normal', titleLayout:'low', titleFont:'wide' }),
		moonlit:   P('Moonlit Garden', 'Spirit', { sky:'night', landmark:'moon', floor:'field', sigil:'lotus', p1:'butterflies', p2:'fireflies', barrier:'orb', burst:'bloom', landmarkSize:0.9 }),
		gates:     P('Thousand Gates', 'Crimson', { sky:'dusk', landmark:'gate', floor:'stone', sigil:'glyphs', p1:'leaves', p2:'fireflies', barrier:'runes', burst:'shockwave', titleFont:'brush', c3:'#ffb347' }),
		aurora:    P('Northern Lights', 'Spirit', { sky:'aurora', landmark:'mountains', floor:'ice', sigil:'mandala', p1:'snow', p2:'stars', barrier:'cage', burst:'bloom', ambient:'normal' }),
		judgement: P('Hall of Judgement', 'Royal', { sky:'void', landmark:'throne', floor:'tiles', sigil:'hexagram', p1:'glyphs', p2:'sparks', barrier:'runes', rimRunes:true, burst:'shockwave', titleFont:'gothic', titleLayout:'split', rays:0.6 }),
		blades:    P('Sword Heaven', 'Monochrome', { sky:'dusk', landmark:'blades', floor:'blades', sigil:'compass', p1:'sparks', p2:'ash', barrier:'ring', burst:'shards', titleFont:'bold', c1:'#e8eef8', c3:'#ff5a3b' }),
		toxic:     P('Plague Marsh', 'Plague', { sky:'storm', landmark:'tree', floor:'water', sigil:'web', p1:'bubbles', p2:'smoke', barrier:'thorns', burst:'ink', ambient:'dim', freeze:'tint' })
	};
	const PRESET_ORDER = Object.keys(PRESETS);

	/* ---------------------------------------------------------------- the older params (c69) → a look */
	const OLD_INTERIOR = { bright:{ ambient:'bright' }, crimson:{ ambient:'dark' }, starry:{ p2:'stars' }, dark:{} };
	function fromLegacy(p, mine){
		const T = root.MagicDomain && root.MagicDomain.THEMES;
		let key = p && PRESETS[p.theme] ? p.theme : 'void';
		if(!mine && (!p || !p.theme || p.theme === 'void') && (!p || !p.accent || p.accent === 'theme')) key = 'shrine';      // a rival's domain keeps its crimson look
		const L = Object.assign({}, BASE, PRESETS[key], { preset: key });
		if(!p) return L;
		const acc = root.MagicDomain && root.MagicDomain.ACCENTS && root.MagicDomain.ACCENTS[p.accent];
		if(acc){ L.c1 = acc; L.c2 = mixHex(acc, '#ffffff', 0.72); L.c3 = mixHex(acc, L.bg, 0.4); }
		const pick = (v) => v && v !== 'theme';
		if(pick(p.pattern)) L.sigil = p.pattern;
		if(pick(p.motes)) L.p1 = p.motes;
		if(pick(p.burst)) L.burst = p.burst;
		if(pick(p.interior)) Object.assign(L, OLD_INTERIOR[p.interior] || {});
		void T;
		return L;
	}
	function mixHex(a, b, k){
		const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
		const m = (s) => Math.round(((pa >> s) & 255) + (((pb >> s) & 255) - ((pa >> s) & 255)) * k);
		return '#' + ((1 << 24) | (m(16) << 16) | (m(8) << 8) | m(0)).toString(16).slice(1);
	}

	/* ---------------------------------------------------------------- sanitising: anything stored becomes a legal look */
	function sanitize(raw){
		const base = raw && PRESETS[raw.preset] ? Object.assign({}, BASE, PRESETS[raw.preset]) : Object.assign({}, BASE);
		const L = Object.assign({}, base);
		if(raw && typeof raw === 'object'){
			for(const f of FIELDS){
				const v = raw[f.key];
				if(v === undefined || v === null) continue;
				if(f.type === 'color'){ if(isHex(v)) L[f.key] = v.toLowerCase(); }
				else if(f.type === 'choice'){ if(f.options.some(q => q.v === v)) L[f.key] = v; }
				else if(f.type === 'range'){ L[f.key] = clamp(num(v, L[f.key]), f.min, f.max); }
				else if(f.type === 'toggle'){ L[f.key] = !!v; }
				else if(f.type === 'text'){ L[f.key] = String(v).slice(0, f.max || 40); }
			}
			if(raw.preset && PRESETS[raw.preset]) L.preset = raw.preset;
			L.seed = Math.floor(clamp(num(raw.seed, 0), 0, 99999));
		}
		delete L.name;
		return L;
	}
	function resolve(p, mine){
		if(p && p.look && typeof p.look === 'object') return sanitize(p.look);
		return fromLegacy(p || {}, mine !== false);
	}
	function preset(key){ return sanitize({ preset: PRESETS[key] ? key : 'void' }); }

	/* ---------------------------------------------------------------- a coherent random look */
	function rng(seed){ let s = (Math.floor(seed) % 2147483647 + 2147483647) % 2147483647 || 1; return () => (s = s * 16807 % 2147483647) / 2147483647; }
	function random(seed, locked){
		const r = rng(seed == null ? Math.random() * 1e9 : seed);
		const pick = (list) => list[Math.floor(r() * list.length)].v;
		const L = Object.assign({}, BASE);
		const pal = PALETTES[Math.floor(r() * PALETTES.length)];
		Object.assign(L, { c1: pal.c1, c2: pal.c2, c3: pal.c3, bg: pal.bg });
		if(r() < 0.35){ const h = r() * 360; L.c1 = hsl(h, 0.85, 0.66); L.c2 = hsl(h, 0.9, 0.93); L.c3 = hsl((h + 140 + r() * 80) % 360, 0.75, 0.6); L.bg = hsl(h, 0.6, 0.06); }
		const light = pal.bg && parseInt(pal.bg.slice(1, 3), 16) > 150;
		L.sky = light ? pick(SKIES.filter(s => ['dawn', 'radiant', 'inkwash'].includes(s.v))) : pick(SKIES);
		L.landmark = r() < 0.12 ? 'none' : pick(LANDMARKS);
		L.landmarkSize = Math.round((0.75 + r() * 0.6) * 20) / 20;
		L.horizon = Math.round((0.22 + r() * 0.3) * 50) / 50;
		L.floor = r() < 0.06 ? 'none' : pick(FLOORS.filter(f => f.v !== 'none'));
		L.sigil = r() < 0.08 ? 'none' : pick(SIGILS.filter(s => s.v !== 'none'));
		L.sigilAt = pick(SIGIL_AT);
		L.sigilSize = Math.round((0.55 + r() * 0.4) * 20) / 20;
		L.p1 = pick(PARTICLES.filter(q => q.v !== 'none' && q.v !== 'lightning'));
		L.p2 = r() < 0.25 ? 'none' : pick(PARTICLES.filter(q => q.v !== 'none'));
		L.p1n = Math.round((0.6 + r() * 1.1) * 10) / 10; L.p2n = Math.round((0.3 + r() * 0.8) * 10) / 10;
		L.pSpeed = Math.round((0.6 + r() * 1.2) * 10) / 10;
		L.barrier = pick(BARRIERS); L.rim = Math.round((2 + r() * 5) * 2) / 2; L.glow = Math.round((0.5 + r()) * 10) / 10; L.rimRunes = r() < 0.3;
		L.ambient = light ? 'bright' : pick(AMBIENT.filter(a => a.v !== 'bright'));
		L.rays = Math.round(r() * 0.8 * 20) / 20; L.vignette = Math.round((0.3 + r() * 0.5) * 20) / 20; L.pulse = Math.round(r() * 0.6 * 20) / 20;
		L.burst = pick(BURSTS); L.freeze = pick(FREEZE.filter(f => f.v !== 'none')); L.titleFont = pick(FONTS); L.titleLayout = pick(LAYOUTS);
		L.titleColor = light ? 'black' : pick(TITLE_COLOR.filter(t => t.v !== 'black'));
		L.veil = pick(VEILS); L.seed = Math.floor(r() * 99999); L.preset = 'custom';
		if(locked) for(const k in locked) if(locked[k] !== undefined) L[k] = locked[k];
		return sanitize(L);
	}
	function hsl(h, s, l){
		const a = s * Math.min(l, 1 - l), f = (n) => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
		return '#' + [f(0), f(8), f(4)].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
	}

	/* ---------------------------------------------------------------- a shareable code: only what differs from its preset */
	function encode(L){
		const s = sanitize(L), base = sanitize({ preset: s.preset }), d = { preset: s.preset };
		for(const f of FIELDS) if(s[f.key] !== base[f.key]) d[f.key] = s[f.key];
		if(s.seed) d.seed = s.seed;
		try { return 'DOM1:' + (typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(JSON.stringify(d)))) : Buffer.from(JSON.stringify(d)).toString('base64')); } catch(e){ return ''; }
	}
	function decode(code){
		try {
			const s = String(code || '').trim().replace(/^DOM1:/, '');
			const json = typeof atob === 'function' ? decodeURIComponent(escape(atob(s))) : Buffer.from(s, 'base64').toString();
			const d = JSON.parse(json);
			return d && typeof d === 'object' ? sanitize(d) : null;
		} catch(e){ return null; }
	}

	/* how many different looks there are (just the choices, not the colours or sliders) */
	const COMBINATIONS = FIELDS.filter(f => f.type === 'choice').reduce((t, f) => t * f.options.length, 1);

	root.MagicDomainLook = { FIELDS, TABS, PALETTES, PRESETS, PRESET_ORDER, BASE, SKIES, LANDMARKS, FLOORS, SIGILS, SIGIL_AT, PARTICLES, BARRIERS, AMBIENT, BURSTS, FREEZE, FONTS, LAYOUTS, VEILS,
		resolve, sanitize, preset, random, encode, decode, mixHex, hsl, COMBINATIONS };
})(typeof window !== 'undefined' ? window : globalThis);
