/* =============================================================
   The Living Wilds — procedural assembly of authored Jungle rooms.

   The generator chooses a route recipe, authored room variants,
   secrets, one mini-boss, and a rare event. It never randomizes
   critical room geometry, puzzle answers, or mandatory platforms.
   ============================================================= */
(function(global){
	'use strict';
	const TILE = 40;
	const GRID_X = 2840;
	const GRID_Y = 2140;
	const MARGIN = 520;
	const HALL_H = 240;
	const SHAFT_W = 420;
	const THROAT = 260;

	function rngFromSeed(seed){
		let s = (seed & 0x7fffffff) || 1;
		function rnd(){ s = (s * 1664525 + 1013904223) & 0x7fffffff; return s / 0x7fffffff; }
		return {
			rnd:rnd,
			ri:function(lo, hi){ return lo + Math.floor(rnd() * (hi - lo + 1)); },
			chance:function(p){ return rnd() < p; },
			choice:function(a){ return a[Math.floor(rnd() * a.length)]; },
			shuffle:function(a){
				const out = a.slice();
				for(let i = out.length - 1; i > 0; i--){
					const j = Math.floor(rnd() * (i + 1));
					const t = out[i]; out[i] = out[j]; out[j] = t;
				}
				return out;
			},
		};
	}
	function snap(n){ return Math.round(n / TILE) * TILE; }
	function clone(v){ return v == null ? v : JSON.parse(JSON.stringify(v)); }
	function overlap(a, b, pad){
		pad = pad || 0;
		return a.x - pad < b.x + b.w && a.x + a.w + pad > b.x &&
			a.y - pad < b.y + b.h && a.y + a.h + pad > b.y;
	}

	const RECIPES = [
		{
			id:'worldroot_spiral',
			miniBoss:null,
			nodes:[
				{ id:'start', section:1, gx:0, gy:2, pool:['jg_overgrown_gate'] },
				{ id:'court', section:1, gx:1, gy:2, pool:['jg_overgrown_courtyard','jg_broken_statue_court'] },
				{ id:'fork', section:1, gx:2, gy:2, pool:['jg_giant_root_chamber'], noGate:true },
				{ id:'water', section:1, gx:2, gy:1, pool:['jg_jungle_stream'] },
				{ id:'memory',section:1, gx:3, gy:1, pool:['jg_ancient_memory'] },
				{ id:'pred', section:2, gx:2, gy:3, pool:['jg_predators_grove'], noGate:true },
				{ id:'garden',section:2, gx:3, gy:3, pool:['jg_carnivorous_garden','jg_spider_hatchery'] },
				{ id:'merge',section:1, gx:4, gy:2, pool:['jg_root_maze'] },
				{ id:'falls',section:2, gx:5, gy:2, pool:['jg_waterfall_crossing'] },
				{ id:'fungal',section:2,gx:6, gy:2, pool:['jg_fungal_cavern'] },
				{ id:'bloom',section:2, gx:7, gy:2, pool:['jg_blooming_chamber'] },
				{ id:'vault',section:2, gx:7, gy:3, pool:['jg_ancient_vault'], optional:true, chance:0.72 },
				{ id:'wildSpec',section:2, gx:5, gy:3, pool:['jg_overgrown_canopy_a','jg_spore_garden_a','jg_rootbound_ruins_a','jg_overgrown_canopy_b','jg_spore_garden_b','jg_rootbound_ruins_b'], optional:true, chance:0.55 },
				{ id:'offer',section:2, gx:6, gy:3, pool:['jg_false_offerings'], optional:true, chance:0.78 },
				{ id:'field',section:2, gx:8, gy:2, pool:['jg_giant_flower_field'] },
				{ id:'tree', section:3, gx:9, gy:2, pool:['jg_ancient_tree_interior'] },
				{ id:'vista',section:3,gx:10,gy:2, pool:['jg_giant_tree_ascent'] },
				{ id:'canopy',section:3,gx:10,gy:1, pool:['jg_canopy_crossing'] },
				{ id:'ruins',section:3,gx:11,gy:1, pool:['jg_canopy_ruins'] },
				{ id:'bridge',section:3,gx:12,gy:1, pool:['jg_collapsing_root_bridge'] },
				{ id:'mini',section:3,gx:13,gy:1, pool:['jg_elder_treant_arena','jg_storm_raptor_roost'] },
				{ id:'chasm',section:4,gx:14,gy:1, pool:['jg_root_chasm'] },
				{ id:'grove',section:4,gx:14,gy:2, pool:['jg_ancient_grove_mechanism'] },
				{ id:'sacred',section:4,gx:15,gy:1, pool:['jg_sacred_grove'], optional:true, chance:0.66 },
				{ id:'heart',section:4,gx:15,gy:2, pool:['jg_root_heart'] },
				{ id:'pre',section:4,gx:16,gy:2, pool:['jg_worldroot_approach'] },
				{ id:'boss',section:4,gx:17,gy:2, pool:['jg_heart_of_jungle'] },
				{ id:'huntA1', section:2, gx:6, gy:1, pool:['jg_predators_gauntlet'], optional:true, chance:1 },
				{ id:'huntA2', section:2, gx:7, gy:1, pool:['jg_living_fortress'], optional:true, chance:1 },
				{ id:'huntA3', section:3, gx:8, gy:1, pool:['jg_sporefall'], optional:true, chance:1 },
				{ id:'huntA4', section:3, gx:9, gy:1, pool:['jg_thorn_cathedral'], optional:true, chance:1 },
				{ id:'huntA5', section:3, gx:5, gy:1, pool:['jg_canopy_hideout'], optional:true, chance:1 },
				{ id:'huntB1', section:2, gx:3, gy:4, pool:['jg_flooded_rootway'], optional:true, chance:1 },
				{ id:'huntB2', section:3, gx:4, gy:4, pool:['jg_ancient_hunting_grounds'], optional:true, chance:1 },
				{ id:'huntB3', section:3, gx:5, gy:4, pool:['jg_blooming_colosseum'], optional:true, chance:1 },
				{ id:'huntB4', section:3, gx:6, gy:4, pool:['jg_root_collapse'], optional:true, chance:1 },
				{ id:'huntB5', section:3, gx:7, gy:4, pool:['jg_secret_elite_arena'], optional:true, chance:1 },
			],
			edges:[
				['start','right','court','left'],
				['court','right','fork','left'],
				['fork','top','water','left'],
				['water','right','memory','left'],
				['memory','right','merge','left'],
				['fork','bottom','pred','top'],
				['pred','right','garden','left'],
				['garden','right','merge','bottom'],
				['merge','right','falls','left'],
				['falls','right','fungal','left'],
				['falls','bottom','wildSpec','top',{optional:true}],
				['fungal','right','bloom','left'],
				['fungal','bottom','offer','top',{optional:true}],
				['bloom','bottom','vault','top',{optional:true}],
				['bloom','right','field','left'],
				['field','right','tree','left'],
				['tree','right','vista','left'],
				['vista','top','canopy','bottom'],
				['canopy','right','ruins','left'],
				['ruins','right','bridge','left'],
				['bridge','right','mini','left'],
				['mini','right','chasm','left'],
				['chasm','bottom','grove','top'],
				['grove','right','heart','left'],
				['chasm','right','sacred','left',{optional:true}],
				['sacred','bottom','heart','top',{optional:true}],
				['heart','right','pre','left'],
				['pre','right','boss','left'],
				['fungal','top','huntA1','bottom',{optional:true}],
				['huntA1','right','huntA2','left',{optional:true}],
				['huntA2','right','huntA3','left',{optional:true}],
				['huntA3','right','huntA4','left',{optional:true}],
				['huntA1','left','huntA5','right',{optional:true}],
				['garden','bottom','huntB1','top',{optional:true}],
				['huntB1','right','huntB2','left',{optional:true}],
				['huntB2','right','huntB3','left',{optional:true}],
				['huntB3','right','huntB4','left',{optional:true}],
				['huntB4','right','huntB5','left',{optional:true}],
			],
			shortcut:null,
		},
		{
			id:'drowned_civilization',
			miniBoss:null,
			nodes:[
				{ id:'start',section:1,gx:0,gy:2,pool:['jg_overgrown_gate'] },
				{ id:'court',section:1,gx:1,gy:2,pool:['jg_broken_statue_court'] },
				{ id:'fork',section:1,gx:2,gy:2,pool:['jg_flooded_ruins'],noGate:true },
				{ id:'upper',section:1,gx:2,gy:1,pool:['jg_water_mechanism'] },
				{ id:'temple',section:1,gx:3,gy:1,pool:['jg_ancient_memory'] },
				{ id:'lower',section:2,gx:2,gy:3,pool:['jg_spider_hatchery'] },
				{ id:'pred',section:2,gx:3,gy:3,pool:['jg_predators_grove'],noGate:true },
				{ id:'merge',section:2,gx:4,gy:2,pool:['jg_jungle_flood'] },
				{ id:'fungal',section:2,gx:5,gy:2,pool:['jg_fungal_cavern'] },
				{ id:'garden',section:2,gx:6,gy:2,pool:['jg_poisoned_garden'] },
				{ id:'bloom',section:2,gx:7,gy:2,pool:['jg_blooming_chamber'] },
				{ id:'nest',section:2,gx:7,gy:3,pool:['jg_predator_nest'],optional:true,chance:0.64 },
				{ id:'offer',section:2,gx:8,gy:3,pool:['jg_false_offerings'],optional:true,chance:0.76 },
				{ id:'wildSpec',section:2,gx:9,gy:3,pool:['jg_overgrown_canopy_a','jg_spore_garden_a','jg_rootbound_ruins_a','jg_overgrown_canopy_b','jg_spore_garden_b','jg_rootbound_ruins_b'],optional:true,chance:0.52 },
				{ id:'falls',section:2,gx:8,gy:2,pool:['jg_waterfall_crossing'] },
				{ id:'tree',section:3,gx:9,gy:2,pool:['jg_ancient_tree_interior'] },
				{ id:'vista',section:3,gx:10,gy:2,pool:['jg_giant_tree_ascent'] },
				{ id:'canopy',section:3,gx:10,gy:1,pool:['jg_vine_bridge'] },
				{ id:'falling',section:3,gx:11,gy:1,pool:['jg_falling_canopy'] },
				{ id:'ruins',section:3,gx:12,gy:1,pool:['jg_canopy_ruins'] },
				{ id:'mini',section:3,gx:13,gy:1,pool:['jg_elder_treant_arena','jg_storm_raptor_roost'] },
				{ id:'chasm',section:4,gx:14,gy:1,pool:['jg_root_chasm'] },
				{ id:'heart',section:4,gx:14,gy:2,pool:['jg_root_heart'] },
				{ id:'grove',section:4,gx:15,gy:2,pool:['jg_ancient_grove_mechanism'] },
				{ id:'shrine',section:4,gx:15,gy:3,pool:['jg_sacred_grove'],optional:true,chance:0.7 },
				{ id:'pre',section:4,gx:16,gy:2,pool:['jg_worldroot_approach'] },
				{ id:'boss',section:4,gx:17,gy:2,pool:['jg_heart_of_jungle'] },
				{ id:'huntA1', section:2, gx:5, gy:1, pool:['jg_predators_gauntlet'], optional:true, chance:1 },
				{ id:'huntA2', section:2, gx:6, gy:1, pool:['jg_living_fortress'], optional:true, chance:1 },
				{ id:'huntA3', section:3, gx:7, gy:1, pool:['jg_sporefall'], optional:true, chance:1 },
				{ id:'huntA4', section:3, gx:8, gy:1, pool:['jg_thorn_cathedral'], optional:true, chance:1 },
				{ id:'huntA5', section:3, gx:4, gy:1, pool:['jg_canopy_hideout'], optional:true, chance:1 },
				{ id:'huntB1', section:2, gx:2, gy:4, pool:['jg_flooded_rootway'], optional:true, chance:1 },
				{ id:'huntB2', section:3, gx:3, gy:4, pool:['jg_ancient_hunting_grounds'], optional:true, chance:1 },
				{ id:'huntB3', section:3, gx:4, gy:4, pool:['jg_blooming_colosseum'], optional:true, chance:1 },
				{ id:'huntB4', section:3, gx:5, gy:4, pool:['jg_root_collapse'], optional:true, chance:1 },
				{ id:'huntB5', section:3, gx:6, gy:4, pool:['jg_secret_elite_arena'], optional:true, chance:1 },
			],
			edges:[
				['start','right','court','left'],
				['court','right','fork','left'],
				['fork','top','upper','left'],
				['upper','right','temple','left'],
				['temple','right','merge','top'],
				['fork','bottom','lower','left'],
				['lower','right','pred','left'],
				['pred','right','merge','left'],
				['merge','right','fungal','left'],
				['fungal','right','garden','left'],
				['garden','right','bloom','left'],
				['bloom','bottom','nest','left',{optional:true}],
				['falls','bottom','offer','top',{optional:true}],
				['falls','bottom','wildSpec','top',{optional:true}],
				['bloom','right','falls','left'],
				['falls','right','tree','left'],
				['tree','right','vista','left'],
				['vista','top','canopy','bottom'],
				['canopy','right','falling','left'],
				['falling','right','ruins','left'],
				['ruins','right','mini','left'],
				['mini','right','chasm','left'],
				['chasm','bottom','heart','top'],
				['heart','right','grove','left'],
				['grove','bottom','shrine','top',{optional:true}],
				['grove','right','pre','left'],
				['pre','right','boss','left'],
				['fungal','top','huntA1','bottom',{optional:true}],
				['huntA1','right','huntA2','left',{optional:true}],
				['huntA2','right','huntA3','left',{optional:true}],
				['huntA3','right','huntA4','left',{optional:true}],
				['huntA1','left','huntA5','right',{optional:true}],
				['lower','bottom','huntB1','top',{optional:true}],
				['huntB1','right','huntB2','left',{optional:true}],
				['huntB2','right','huntB3','left',{optional:true}],
				['huntB3','right','huntB4','left',{optional:true}],
				['huntB4','right','huntB5','left',{optional:true}],
			],
			shortcut:null,
		},
		{
			id:'path_of_first_seed',
			miniBoss:null,
			nodes:[
				{ id:'start',section:1,gx:0,gy:2,pool:['jg_overgrown_gate'] },
				{ id:'court',section:1,gx:1,gy:2,pool:['jg_overgrown_courtyard'] },
				{ id:'fork',section:1,gx:2,gy:2,pool:['jg_giant_root_chamber'],noGate:true },
				{ id:'upper',section:1,gx:2,gy:1,pool:['jg_root_maze'] },
				{ id:'memory',section:1,gx:3,gy:1,pool:['jg_ancient_memory'] },
				{ id:'lower',section:1,gx:2,gy:3,pool:['jg_jungle_stream'] },
				{ id:'flooded',section:1,gx:3,gy:3,pool:['jg_flooded_ruins'] },
				{ id:'merge',section:2,gx:4,gy:2,pool:['jg_waterfall_crossing'] },
				{ id:'swamp',section:2,gx:5,gy:2,pool:['jg_poisoned_garden'] },
				{ id:'garden',section:2,gx:6,gy:2,pool:['jg_carnivorous_garden','jg_spider_hatchery'] },
				{ id:'vault',section:2,gx:6,gy:3,pool:['jg_ancient_vault'],optional:true,chance:0.76 },
				{ id:'wildSpec',section:2,gx:5,gy:3,pool:['jg_overgrown_canopy_a','jg_spore_garden_a','jg_rootbound_ruins_a','jg_overgrown_canopy_b','jg_spore_garden_b','jg_rootbound_ruins_b'],optional:true,chance:0.5 },
				{ id:'field',section:2,gx:7,gy:2,pool:['jg_giant_flower_field'] },
				{ id:'offer',section:2,gx:8,gy:3,pool:['jg_false_offerings'],optional:true,chance:0.74 },
				{ id:'fungal',section:2,gx:8,gy:2,pool:['jg_fungal_cavern'] },
				{ id:'vista',section:3,gx:9,gy:2,pool:['jg_giant_tree_ascent'] },
				{ id:'tree',section:3,gx:9,gy:1,pool:['jg_ancient_tree_interior'] },
				{ id:'bridge',section:3,gx:10,gy:1,pool:['jg_vine_bridge'] },
				{ id:'thorn',section:3,gx:11,gy:1,pool:['jg_thorn_corridor'] },
				{ id:'falling',section:3,gx:12,gy:1,pool:['jg_falling_canopy'] },
				{ id:'mini',section:3,gx:13,gy:1,pool:['jg_elder_treant_arena','jg_storm_raptor_roost'] },
				{ id:'chasm',section:4,gx:14,gy:1,pool:['jg_root_chasm'] },
				{ id:'sacred',section:4,gx:14,gy:2,pool:['jg_sacred_grove'] },
				{ id:'heart',section:4,gx:15,gy:2,pool:['jg_root_heart'] },
				{ id:'grove',section:4,gx:16,gy:2,pool:['jg_ancient_grove_mechanism'] },
				{ id:'pre',section:4,gx:17,gy:2,pool:['jg_worldroot_approach'] },
				{ id:'boss',section:4,gx:18,gy:2,pool:['jg_heart_of_jungle'] },
				{ id:'huntA1', section:2, gx:8, gy:0, pool:['jg_predators_gauntlet'], optional:true, chance:1 },
				{ id:'huntA2', section:2, gx:7, gy:0, pool:['jg_living_fortress'], optional:true, chance:1 },
				{ id:'huntA3', section:3, gx:6, gy:0, pool:['jg_sporefall'], optional:true, chance:1 },
				{ id:'huntA4', section:3, gx:5, gy:0, pool:['jg_thorn_cathedral'], optional:true, chance:1 },
				{ id:'huntA5', section:3, gx:4, gy:0, pool:['jg_canopy_hideout'], optional:true, chance:1 },
				{ id:'huntB1', section:2, gx:3, gy:4, pool:['jg_flooded_rootway'], optional:true, chance:1 },
				{ id:'huntB2', section:3, gx:4, gy:4, pool:['jg_ancient_hunting_grounds'], optional:true, chance:1 },
				{ id:'huntB3', section:3, gx:5, gy:4, pool:['jg_blooming_colosseum'], optional:true, chance:1 },
				{ id:'huntB4', section:3, gx:6, gy:4, pool:['jg_root_collapse'], optional:true, chance:1 },
				{ id:'huntB5', section:3, gx:7, gy:4, pool:['jg_secret_elite_arena'], optional:true, chance:1 },
			],
			edges:[
				['start','right','court','left'],
				['court','right','fork','left'],
				['fork','top','upper','left'],
				['upper','right','memory','left'],
				['memory','right','merge','top'],
				['fork','bottom','lower','top'],
				['lower','right','flooded','left'],
				['flooded','right','merge','left'],
				['merge','right','swamp','left'],
				['swamp','right','garden','left'],
				['swamp','bottom','wildSpec','top',{optional:true}],
				['garden','bottom','vault','top',{optional:true}],
				['garden','right','field','left'],
				['field','right','fungal','left'],
				['fungal','bottom','offer','top',{optional:true}],
				['fungal','right','vista','left'],
				['vista','top','tree','bottom'],
				['tree','right','bridge','left'],
				['bridge','right','thorn','left'],
				['thorn','right','falling','left'],
				['falling','right','mini','left'],
				['mini','right','chasm','left'],
				['chasm','bottom','sacred','top'],
				['sacred','right','heart','left'],
				['heart','right','grove','left'],
				['grove','right','pre','left'],
				['pre','right','boss','left'],
				['fungal','top','huntA1','bottom',{optional:true}],
				['huntA1','left','huntA2','right',{optional:true}],
				['huntA2','left','huntA3','right',{optional:true}],
				['huntA3','left','huntA4','right',{optional:true}],
				['huntA4','left','huntA5','right',{optional:true}],
				['flooded','bottom','huntB1','top',{optional:true}],
				['huntB1','right','huntB2','left',{optional:true}],
				['huntB2','right','huntB3','left',{optional:true}],
				['huntB3','right','huntB4','left',{optional:true}],
				['huntB4','right','huntB5','left',{optional:true}],
			],
			shortcut:null,
		},
	];

	const REGION_ENEMIES = {
		1:['vineCrawler','caveSpider','thornWolf','glowBeetle','willowWisp','barkbackBeetle','pollenMoth'],
		2:['rockGolem','vineCrawler','caveSpider','mossWraith','sporeFungus','thornWolf','rootParasite','barkbackBeetle'],
		3:['crystalMage','mudElemental','skyVine','stalactiteBat','windSylph','mossWraith','pollenMoth','jungleChameleon','rootParasite'],
		4:['mudElemental','rockGolem','crystalMage','mossWraith','skyVine','thornWolf','jungleChameleon','barkbackBeetle'],
	};
	const SECRET_IDS = [
		'jg_buried_temple','jg_hidden_root_cave','jg_predator_nest',
		'jg_canopy_hideout','jg_secret_elite_arena','jg_forgotten_shrine','jg_secret_ancient_grove',
	];
	const RARE_EVENTS = ['jungleStampede','giantBloom','jungleCollapse','ancientAwakening','rootMigration'];

	function build(seed){
		const R = rngFromSeed(seed);
		const templates = global.JUNGLE_TEMPLATES_BY_ID || {};
		if(!global.JUNGLE_ROOM_TEMPLATES || global.JUNGLE_ROOM_TEMPLATES.length < 30) return null;
		const recipe = RECIPES[Math.abs(seed) % RECIPES.length];
		const rooms = [];
		const corridors = [];
		const platforms = [];
		const hazards = [];
		const decorations = [];
		const interactables = [];
		const enemies = [];
		const gates = [];
		const placed = Object.create(null);
		const occupied = [];
		const usedTemplates = Object.create(null);
		const included = Object.create(null);
		const nodeById = Object.create(null);
		const connections = [];

		for(let i = 0; i < recipe.nodes.length; i++) nodeById[recipe.nodes[i].id] = recipe.nodes[i];

		function carve(x, y, w, h, type){
			const c = {
				x:snap(x), y:snap(y),
				w:Math.max(TILE * 2, snap(w)), h:Math.max(TILE * 2, snap(h)),
				_jungleConnector:type || null,
			};
			corridors.push(c);
			return c;
		}

		function candidateFor(node){
			let ids = (node.pool || []).filter(function(id){ return !!templates[id]; });
			if(!ids.length) return null;
			const fresh = ids.filter(function(id){ return !usedTemplates[id]; });
			if(fresh.length) ids = fresh;
			return templates[R.choice(ids)];
		}

		function instantiate(node, tpl, x, y){
			const room = {
				id:rooms.length,
				nodeId:node.id,
				templateId:tpl.id,
				kind:tpl.kind,
				category:tpl.category,
				label:tpl.label,
				objective:tpl.objective || '',
				clearMode:tpl.clearMode || 'none',
				x:snap(x), y:snap(y), w:tpl.w, h:tpl.h,
				depth:node.section,
				section:node.section,
				optional:!!(node.optional || tpl.optional),
				secret:!!tpl.secret,
				elite:!!tpl.elite,
				noCombat:!!tpl.noCombat,
				authoredCombat:!!tpl.authoredCombat,
				noGate:!!node.noGate,
				spectacle:!!tpl.spectacle,
				bossArena:!!tpl.bossArena,
				miniBossType:tpl.miniBossType || null,
				cells:[], solids:[], exits:{}, usedExits:{}, extraOpenings:[],
				cleared:false, locked:false,
			};
			const cells = tpl.cells && tpl.cells.length ? tpl.cells : [{x:0,y:0,w:tpl.w,h:tpl.h}];
			for(let i = 0; i < cells.length; i++){
				const c = cells[i];
				const abs = {x:room.x+c.x,y:room.y+c.y,w:c.w,h:c.h};
				room.cells.push(abs);
				corridors.push({x:abs.x,y:abs.y,w:abs.w,h:abs.h,_jungleCell:true,roomId:room.id});
			}
			for(let i = 0; i < (tpl.solids || []).length; i++){
				const s = tpl.solids[i];
				room.solids.push({x:room.x+s.x,y:room.y+s.y,w:s.w,h:s.h});
			}
			for(const dir of ['left','right','top','bottom']){
				if(tpl.ports && tpl.ports[dir]) room.exits[dir] = clone(tpl.ports[dir]);
			}
			for(let i = 0; i < (tpl.platforms || []).length; i++){
				const p = tpl.platforms[i];
				if(global.dungeonShouldKeepPlatform && !global.dungeonShouldKeepPlatform(tpl, p)) continue;
				const o = Object.assign({}, p, {
					x:snap(room.x + p.x), y:snap(room.y + p.y),
					w:snap(p.w), h:p.h || TILE, roomId:room.id,
				});
				if(p.homeX != null) o.homeX = room.x + p.homeX;
				if(p.homeY != null) o.homeY = room.y + p.homeY;
				if(p.hidden) o._jungleHidden = true;
				platforms.push(o);
			}
			for(let i = 0; i < (tpl.hazards || []).length; i++){
				const h = tpl.hazards[i];
				const o = Object.assign({}, h, {roomId:room.id});
				if(h.x != null) o.x = room.x + h.x;
				if(h.y != null) o.y = room.y + h.y;
				if(h.y0 != null) o.y0 = room.y + h.y0;
				if(h.y1 != null) o.y1 = room.y + h.y1;
				if(h.impactY != null) o.impactY = room.y + h.impactY;
				if(h.gapY != null) o.gapY = room.y + h.gapY;
				if(h.pullX != null) o.pullX = room.x + h.pullX;
				hazards.push(o);
			}
			for(let i = 0; i < (tpl.props || []).length; i++){
				const d = tpl.props[i];
				decorations.push(Object.assign({}, d, {x:room.x+d.x,y:room.y+d.y,roomId:room.id,_jungle:true}));
			}
			for(let i = 0; i < (tpl.interactables || []).length; i++){
				const it = tpl.interactables[i];
				const o = Object.assign({}, it, {x:room.x+it.x,y:room.y+it.y,roomId:room.id});
				if(it.punch) o.punch = {x:room.x+it.punch.x,y:room.y+it.punch.y,w:it.punch.w,h:it.punch.h};
				interactables.push(o);
			}
			const pool = REGION_ENEMIES[node.section] || REGION_ENEMIES[1];
			for(let i = 0; i < (tpl.spawns || []).length; i++){
				const sp = tpl.spawns[i];
				const type = sp.type || R.choice(pool);
				const ex = room.x + sp.x, ey = room.y + sp.y;
				enemies.push(Object.assign({}, sp, {
					type:type, x:ex, y:ey,
					patrol:[Math.max(room.x+60,ex-240),Math.min(room.x+room.w-60,ex+240)],
					puzzleSeg:node.section, roomId:room.id,
					isMiniBoss:!!sp.isMiniBoss,
					jungleElite:!!sp.elite,
				}));
			}
			if(!tpl.noCombat && !tpl.authoredCombat && (tpl.category === 'combat' || tpl.category === 'trap') && tpl.clearMode !== 'boss'){
				let living = 0;
				for(let ei = 0; ei < enemies.length; ei++) if(enemies[ei].roomId === room.id && !enemies[ei].isMiniBoss) living++;
				const want = (tpl.category === 'combat' ? 5 : 3) + (node.section > 2 ? 1 : 0);
				const spots = (tpl.platforms || []).length ? tpl.platforms : [{x:room.w*0.25,y:room.h-200},{x:room.w*0.5,y:room.h-220},{x:room.w*0.75,y:room.h-200}];
				while(living < want){
					const p = spots[living % spots.length];
					const type = pool[living % pool.length];
					const ex = room.x + (p.x || room.w * 0.4) + (living * 37) % 80;
					const ey = room.y + (p.y || room.h - 180) - 50;
					enemies.push({
						type:type, x:ex, y:ey,
						patrol:[Math.max(room.x+60,ex-220),Math.min(room.x+room.w-60,ex+220)],
						puzzleSeg:node.section, roomId:room.id,
					});
					living++;
				}
			}
			if(tpl.puzzle) room.puzzle = clone(tpl.puzzle);
			if(tpl.clearZone) room.clearZone = {x:room.x+tpl.clearZone.x,y:room.y+tpl.clearZone.y,w:tpl.clearZone.w,h:tpl.clearZone.h};
			if(tpl.kind === 'sporeGarden') room._flowerSeq = tpl.id === 'jg_spore_garden_b' ? [0, 1, 2] : [1, 0, 2];
			rooms.push(room);
			placed[node.id] = room;
			included[node.id] = true;
			usedTemplates[tpl.id] = true;
			occupied.push({x:room.x-40,y:room.y-40,w:room.w+80,h:room.h+80,roomId:room.id});
			return room;
		}

		function mouth(room, dir){
			const ex = room && room.exits[dir];
			if(!ex) return null;
			if(dir === 'left') return {x:room.x,y:room.y+ex.y,w:8,h:ex.h,dir:dir};
			if(dir === 'right') return {x:room.x+room.w,y:room.y+ex.y,w:8,h:ex.h,dir:dir};
			if(dir === 'top') return {x:room.x+ex.x,y:room.y,w:ex.w,h:8,dir:dir};
			return {x:room.x+ex.x,y:room.y+room.h,w:ex.w,h:8,dir:dir};
		}
		function fluidRects(room){
			const out = [];
			for(let i = 0; i < hazards.length; i++){
				const h = hazards[i];
				if(!h || h.roomId !== room.id) continue;
				if(h.type !== 'water' && h.type !== 'sinkingMud' && h.type !== 'flood') continue;
				if(h.x == null || h.w == null) continue;
				out.push({x:h.x,y:h.y,w:h.w,h:h.h || 80});
			}
			for(let i = 0; i < decorations.length; i++){
				const d = decorations[i];
				if(!d || d.roomId !== room.id || !d.type) continue;
				if(!/Stream|Swamp|Pool|WaterChannel/.test(d.type)) continue;
				out.push({x:d.x,y:d.y,w:d.w||200,h:d.h||80});
			}
			return out;
		}
		function rectsHit(a, b){
			return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
		}
		function boxHitsFluid(box, fluids){
			for(let i = 0; i < fluids.length; i++) if(rectsHit(box, fluids[i])) return true;
			return false;
		}
		function waterTop(room){
			const fluids = fluidRects(room);
			if(!fluids.length) return null;
			let top = 1e9;
			for(let i = 0; i < fluids.length; i++) top = Math.min(top, fluids[i].y);
			return top;
		}
		function preferDryMouth(room, dir){
			const ex = room && room.exits[dir];
			if(!ex) return;
			const fluids = fluidRects(room);
			if(dir === 'left' || dir === 'right'){
				const doorH = ex.h || 220;
				const x = dir === 'left' ? room.x : room.x + room.w - 48;
				const top = waterTop(room);
				const wet = fluids.length > 0;
				const maxFoot = wet
					? Math.min(top != null ? top - 88 : room.y + room.h, room.y + room.h - 260)
					: room.y + room.h - 8;
				function hits(yy){ return fluids.length && boxHitsFluid({x:x,y:yy,w:48,h:doorH}, fluids); }
				function usable(yy){
					if(yy < room.y + 40 || yy + doorH > room.y + room.h - 8) return false;
					if(hits(yy)) return false;
					if(yy + doorH > maxFoot) return false;
					return true;
				}
				let y = room.y + ex.y;
				if(usable(y)) return;
				const plats = [];
				for(let i = 0; i < platforms.length; i++){
					const p = platforms[i];
					if(p.roomId !== room.id || p._jungleHidden) continue;
					const near = dir === 'left' ? (p.x <= room.x + 420) : (p.x + p.w >= room.x + room.w - 420);
					if(near) plats.push(p.y);
				}
				for(let i = 0; i < room.solids.length; i++){
					const s = room.solids[i];
					const near = dir === 'left' ? (s.x <= room.x + 240) : (s.x + s.w >= room.x + room.w - 240);
					if(near) plats.push(s.y);
				}
				plats.sort(function(a,b){ return a - b; });
				for(let i = 0; i < plats.length; i++){
					const ny = plats[i] - doorH + 8;
					if(usable(ny)){ ex.y = ny - room.y; return; }
				}
				for(let yy = room.y + 48; yy <= maxFoot - doorH; yy += 20){
					if(usable(yy)){ ex.y = yy - room.y; return; }
				}
				const foot = Math.max(room.y + doorH + 40, maxFoot);
				ex.y = foot - doorH - room.y;
			} else if(dir === 'bottom'){
				const w = ex.w || 240;
				const margin = room.w * 0.28;
				function hitsX(xx){ return boxHitsFluid({x:xx,y:room.y+room.h-48,w:w,h:64}, fluids); }
				function corner(xx){ return xx < room.x + margin || xx + w > room.x + room.w - margin; }
				let x = room.x + (ex.x || 0);
				if(!hitsX(x) && !(fluids.length && corner(x))) return;
				let best = null, bestD = 1e9;
				for(let xx = room.x + 16; xx <= room.x + room.w - w - 16; xx += 40){
					if(hitsX(xx) || (fluids.length && corner(xx))) continue;
					const d = Math.abs(xx - (room.x + room.w * 0.5 - w * 0.5));
					if(d < bestD){ bestD = d; best = xx; }
				}
				if(best != null) ex.x = best - room.x;
			}
		}
		function avoidFluidDir(room, dir){
			preferDryMouth(room, dir);
			if(dir !== 'bottom') return dir;
			const ex = room.exits && room.exits.bottom;
			if(!ex) return dir;
			const fluids = fluidRects(room);
			if(!fluids.length) return 'bottom';
			const w = ex.w || 240;
			const x = room.x + (ex.x || 0);
			const wet = boxHitsFluid({x:x,y:room.y+room.h-48,w:w,h:64}, fluids);
			const corner = x < room.x + room.w * 0.28 || x + w > room.x + room.w * 0.72;
			if(!wet && !corner) return 'bottom';
			if(wet){
				if(room.exits.top){ preferDryMouth(room, 'top'); return 'top'; }
				if(room.exits.right){ preferDryMouth(room, 'right'); return 'right'; }
				if(room.exits.left){ preferDryMouth(room, 'left'); return 'left'; }
				return 'bottom';
			}
			if(room.exits.top){ preferDryMouth(room, 'top'); return 'top'; }
			if(room.exits.right){ preferDryMouth(room, 'right'); return 'right'; }
			if(room.exits.left){ preferDryMouth(room, 'left'); return 'left'; }
			return 'bottom';
		}

		/* Side doors must cover the decks people actually walk on.
		   Authored port Y is often a tile or two below the last platform,
		   which left a sealed-looking wall at foot height. */
		function expandSideMouth(room, dir, m){
			if(!m || (dir !== 'left' && dir !== 'right')) return m;
			let y0 = m.y, y1 = m.y + m.h;
			for(let i = 0; i < platforms.length; i++){
				const p = platforms[i];
				if(p.roomId !== room.id || p.vineRung || p._jungleHidden) continue;
				const near = dir === 'left' ? (p.x <= room.x + 460) : (p.x + p.w >= room.x + room.w - 460);
				if(!near) continue;
				y0 = Math.min(y0, p.y - 120);
				y1 = Math.max(y1, p.y + 200);
			}
			for(let i = 0; i < room.solids.length; i++){
				const s = room.solids[i];
				const near = dir === 'left' ? (s.x <= room.x + 240) : (s.x + s.w >= room.x + room.w - 240);
				if(!near) continue;
				y0 = Math.min(y0, s.y - 120);
				y1 = Math.max(y1, s.y + 100);
			}
			y0 = Math.max(room.y + 40, y0);
			y1 = Math.min(room.y + room.h - 8, y1);
			const fluids = fluidRects(room);
			const wallX = dir === 'left' ? room.x : room.x + room.w - 48;
			let wetCap = room.y + room.h - 8;
			if(fluids.length) wetCap = Math.min(wetCap, room.y + room.h - 240);
			for(let i = 0; i < fluids.length; i++){
				const f = fluids[i];
				if(f.x + f.w < wallX - 80 || f.x > wallX + 128) continue;
				wetCap = Math.min(wetCap, f.y - 8);
			}
			y1 = Math.min(y1, wetCap);
			if(y1 - y0 < 220) y0 = Math.max(room.y + 40, y1 - 240);
			if(y1 - y0 < 180) y1 = Math.min(wetCap, y0 + 220);
			if(y1 - y0 > 440){
				const mid = Math.min(m.y + m.h / 2, wetCap - 110);
				y0 = Math.max(room.y + 40, mid - 220);
				y1 = Math.min(wetCap, y0 + 440);
			}
			return {x:m.x, y:snap(y0), w:m.w, h:Math.max(180, snap(Math.max(40, y1 - y0))), dir:dir};
		}

		function addThroat(room, dir){
			let m = mouth(room, dir);
			if(!m) return null;
			m = expandSideMouth(room, dir, m);
			room.usedExits[dir] = true;
			let o;
			if(dir === 'left') o = {x:room.x-160,y:m.y,w:THROAT+160,h:m.h};
			else if(dir === 'right') o = {x:room.x+room.w-THROAT,y:m.y,w:THROAT+160,h:m.h};
			else if(dir === 'top') o = {x:m.x,y:room.y-160,w:m.w,h:THROAT+160};
			else {
				const wet = boxHitsFluid({x:m.x,y:room.y+room.h-48,w:m.w,h:64}, fluidRects(room));
				o = wet
					? {x:m.x,y:room.y+room.h,w:m.w,h:THROAT+160}
					: {x:m.x,y:room.y+room.h-THROAT,w:m.w,h:THROAT+160};
			}
			room.extraOpenings.push(o);
			carve(o.x,o.y,o.w,o.h,'throat');
			return m;
		}

		function anchor(m){
			if(m.dir === 'left') return {x:m.x-80,y:m.y+m.h/2};
			if(m.dir === 'right') return {x:m.x+80,y:m.y+m.h/2};
			if(m.dir === 'top') return {x:m.x+m.w/2,y:m.y-80};
			return {x:m.x+m.w/2,y:m.y+80};
		}
		function horiz(x0, x1, cy){
			const lo = Math.min(x0,x1), hi = Math.max(x0,x1);
			return carve(lo,cy-HALL_H/2,Math.max(HALL_H,hi-lo),HALL_H,'rootTunnel');
		}
		function vert(cx, y0, y1, roomId){
			const lo = Math.min(y0,y1), hi = Math.max(y0,y1);
			const sh = carve(cx-SHAFT_W/2,lo,SHAFT_W,Math.max(SHAFT_W,hi-lo),'vineShaft');
			const usableTop = sh.y + 280;
			const usableBot = sh.y + sh.h - 280;
			const rungW = 88;
			let rung = 0;
			function rungHitsRoom(x, sy){
				const box = {x:x, y:sy, w:rungW, h:TILE};
				for(let ri = 0; ri < rooms.length; ri++){
					const r = rooms[ri];
					if(r.kind === 'treeInterior' || r.kind === 'boss' || r.kind === 'spectacle'){
						if(box.x < r.x + r.w && box.x + box.w > r.x && box.y < r.y + r.h && box.y + box.h > r.y) return true;
					}
					const cells = r.cells && r.cells.length ? r.cells : [r];
					for(let ci = 0; ci < cells.length; ci++){
						const c = cells[ci];
						if(box.x < c.x + c.w - 8 && box.x + box.w > c.x + 8 &&
							box.y < c.y + c.h - 8 && box.y + box.h > c.y + 8) return true;
					}
				}
				return false;
			}
			for(let y = usableTop; y < usableBot; y += 160){
				const sy = snap(y);
				const left = (rung % 2) === 0;
				const x = snap(left ? sh.x + 16 : sh.x + sh.w - rungW - 16);
				if(rungHitsRoom(x, sy)) continue;
				let blocked = false;
				for(let i = 0; i < platforms.length; i++){
					const p = platforms[i];
					if(Math.abs(p.y - sy) < 110 && p.x < x + rungW && p.x + p.w > x){
						blocked = true;
						break;
					}
				}
				if(blocked) continue;
				rung++;
				platforms.push({kind:'static',x:x,y:sy,w:rungW,h:TILE,roomId:roomId,vineRung:true});
			}
			decorations.push({type:'jgVineShaft',x:sh.x,y:sh.y,w:sh.w,h:sh.h,roomId:roomId,_jungle:true});
			return sh;
		}

		function connect(a, aDir, b, bDir, meta){
			if(!a || !b) return false;
			aDir = avoidFluidDir(a, aDir);
			bDir = avoidFluidDir(b, bDir);
			const am = addThroat(a,aDir), bm = addThroat(b,bDir);
			if(!am || !bm) return false;
			const aa = anchor(am), ba = anchor(bm);
			const aVert = aDir === 'top' || aDir === 'bottom';
			const bVert = bDir === 'top' || bDir === 'bottom';
			if(!aVert && !bVert && Math.abs(aa.y-ba.y) < 80){
				horiz(aa.x,ba.x,(aa.y+ba.y)/2);
			} else if(aVert && bVert && Math.abs(aa.x-ba.x) < 100){
				vert((aa.x+ba.x)/2,aa.y,ba.y,a.id);
			} else if(!aVert && !bVert){
				const bendX = snap((aa.x+ba.x)/2);
				horiz(aa.x,bendX,aa.y);
				vert(bendX,aa.y,ba.y,a.id);
				horiz(bendX,ba.x,ba.y);
			} else if(aVert && bVert){
				const bendY = snap((aa.y+ba.y)/2);
				vert(aa.x,aa.y,bendY,a.id);
				horiz(aa.x,ba.x,bendY);
				vert(ba.x,bendY,ba.y,b.id);
			} else if(aVert){
				vert(aa.x,aa.y,ba.y,a.id);
				horiz(aa.x,ba.x,ba.y);
			} else {
				horiz(aa.x,ba.x,aa.y);
				vert(ba.x,aa.y,ba.y,b.id);
			}
			connections.push({a:a.id,aDir:aDir,b:b.id,bDir:bDir,meta:meta||null});
			return true;
		}

		function gateAt(room, dir){
			let m = mouth(room,dir);
			if(!m) return null;
			m = expandSideMouth(room, dir, m);
			let g;
			if(dir === 'left') g = {x:room.x-40,y:m.y,w:80,h:m.h,roomId:room.id,dir:dir};
			else if(dir === 'right') g = {x:room.x+room.w-40,y:m.y,w:80,h:m.h,roomId:room.id,dir:dir};
			else if(dir === 'top') g = {x:m.x,y:room.y-40,w:m.w,h:80,roomId:room.id,dir:dir};
			else g = {x:m.x,y:room.y+room.h-40,w:m.w,h:80,roomId:room.id,dir:dir};
			g.x = snap(g.x); g.y = snap(g.y);
			g.w = Math.max(80, snap(g.w)); g.h = Math.max(80, snap(g.h));
			for(let i = 0; i < (room.extraOpenings || []).length; i++){
				const op = room.extraOpenings[i];
				if(op.x > g.x + g.w + 28 || op.x + op.w < g.x - 28) continue;
				if(op.y > g.y + g.h + 28 || op.y + op.h < g.y - 28) continue;
				const x1 = Math.max(g.x + g.w, op.x + op.w);
				const y1 = Math.max(g.y + g.h, op.y + op.h);
				g.x = Math.min(g.x, op.x);
				g.y = Math.min(g.y, op.y);
				g.w = x1 - g.x;
				g.h = y1 - g.y;
			}
			return g;
		}

		/* Decide optional content before instantiation so connections are coherent. */
		const deferredBoss = [];
		for(let i = 0; i < recipe.nodes.length; i++){
			const n = recipe.nodes[i];
			if(n.optional && !R.chance(n.chance == null ? 0.65 : n.chance)) continue;
			const tpl = candidateFor(n);
			if(!tpl) return null;
			if(tpl.bossArena){
				deferredBoss.push({ n:n, tpl:tpl });
				continue;
			}
			const x = MARGIN + n.gx * GRID_X;
			const y = MARGIN + n.gy * GRID_Y;
			const rect = {x:x,y:y,w:tpl.w,h:tpl.h};
			let bad = false;
			for(let k = 0; k < occupied.length; k++) if(overlap(rect,occupied[k],40)){ bad = true; break; }
			if(bad) return null;
			instantiate(n,tpl,x,y);
		}
		for(let i = 0; i < deferredBoss.length; i++){
			const n = deferredBoss[i].n, tpl = deferredBoss[i].tpl;
			let maxR = MARGIN;
			for(let k = 0; k < occupied.length; k++) maxR = Math.max(maxR, occupied[k].x + occupied[k].w);
			const x = snap(maxR + 280);
			const y = snap(MARGIN + n.gy * GRID_Y);
			const rect = {x:x,y:y,w:tpl.w,h:tpl.h};
			let bad = false;
			for(let k = 0; k < occupied.length; k++) if(overlap(rect,occupied[k],40)){ bad = true; break; }
			if(bad) return null;
			instantiate(n,tpl,x,y);
		}

		/* Build every authored graph edge, including branch reconnections. */
		for(let i = 0; i < recipe.edges.length; i++){
			const e = recipe.edges[i];
			const a = placed[e[0]], b = placed[e[2]];
			if(!a || !b) continue;
			if(!a.exits[e[1]] || !b.exits[e[3]]) return null;
			if(!connect(a,e[1],b,e[3],e[4])) return null;
		}

		/* Gates only close the outbound mouth of objective rooms. Incoming
		   paths always remain available, so alternate branches reconnect. */
		const incoming = Object.create(null);
		for(let i = 0; i < connections.length; i++){
			const c = connections[i];
			(incoming[c.b] || (incoming[c.b] = Object.create(null)))[c.bDir] = true;
		}
		/* Mini-boss entrances stay open during exploration, then grow shut
		   behind the player when the guardian wakes. They are runtime seals,
		   so they are intentionally excluded from _gates (which init closes). */
		for(let i = 0; i < rooms.length; i++){
			const room = rooms[i];
			if(room.kind !== 'miniBoss' || !incoming[room.id]) continue;
			const arenaGates = [];
			for(const dir of Object.keys(incoming[room.id])){
				const g = gateAt(room,dir);
				if(!g) continue;
				g.type = 'growthGate';
				g.arenaSeal = true;
				g.closed = false;
				arenaGates.push(g);
				hazards.push(g);
			}
			room.arenaGates = arenaGates;
		}
		for(let i = 0; i < rooms.length; i++){
			const room = rooms[i];
			if(room.noGate || room.optional || room.secret || room.clearMode === 'none' || room.clearMode === 'boss') continue;
			const outs = [];
			for(let k = 0; k < connections.length; k++){
				const c = connections[k];
				if(c.a !== room.id) continue;
				if(incoming[room.id] && incoming[room.id][c.aDir]) continue;
				const g = gateAt(room,c.aDir);
				if(g && !outs.some(function(o){ return o.dir === g.dir; })) outs.push(g);
			}
			if(outs.length){
				for(let oi = 0; oi < outs.length; oi++){
					outs[oi].type = 'growthGate';
					gates.push(outs[oi]);
					hazards.push(outs[oi]);
				}
				room.outGates = outs;
				room.locked = true;
			}
		}

		/* Add 2–3 clue-driven secrets, distributed across depth regions.
		   The connector is real, but a visible root seal closes its mouth. */
		const desiredSecrets = 2 + (R.chance(0.58) ? 1 : 0);
		const secretSections = R.shuffle([1,2,3,4]);
		let secretCount = 0;
		for(let ss = 0; ss < secretSections.length && secretCount < desiredSecrets; ss++){
			const section = secretSections[ss];
			const hosts = R.shuffle(rooms.filter(function(r){
				return r.section === section && !r.secret && !r.optional && r.kind !== 'start' &&
					r.kind !== 'boss' && r.kind !== 'preboss' && r.kind !== 'miniBoss';
			}));
			let made = false;
			for(let hi = 0; hi < hosts.length && !made; hi++){
				const host = hosts[hi];
				let dirs = ['top','bottom','right'].filter(function(dir){ return host.exits[dir] && !host.usedExits[dir]; });
				if(fluidRects(host).length){
					dirs = dirs.filter(function(dir){ return dir !== 'bottom'; });
				}
				if(!dirs.length) continue;
				dirs = R.shuffle(dirs);
				const ids = R.shuffle(SECRET_IDS.filter(function(id){
					const t = templates[id];
					return t && (!t.section || t.section.indexOf(section) >= 0);
				}));
				if(!ids.length) continue;
				const tpl = templates[ids[0]];
				const hostNode = nodeById[host.nodeId] || {gx:0,gy:0};
				const slotTries = dirs[0] === 'top'
					? [[hostNode.gx,hostNode.gy-1],[hostNode.gx+1,hostNode.gy-1]]
					: dirs[0] === 'bottom'
						? [[hostNode.gx,hostNode.gy+1],[hostNode.gx+1,hostNode.gy+1]]
						: [[hostNode.gx+1,hostNode.gy-1],[hostNode.gx+1,hostNode.gy+1]];
				let pos = null;
				for(let pi = 0; pi < slotTries.length; pi++){
					const tx = MARGIN + slotTries[pi][0] * GRID_X;
					const ty = MARGIN + Math.max(0,slotTries[pi][1]) * GRID_Y;
					const test = {x:tx,y:ty,w:tpl.w,h:tpl.h};
					let blocked = false;
					for(let oi = 0; oi < occupied.length; oi++) if(overlap(test,occupied[oi],80)){ blocked=true; break; }
					if(!blocked){ pos={x:tx,y:ty}; break; }
				}
				if(!pos) continue;
				const node = {id:'secret_'+secretCount,section:section,optional:true,gx:0,gy:0};
				const secret = instantiate(node,tpl,pos.x,pos.y);
				secret.secret = true;
				secret.optional = true;
				const hostDir = dirs[0];
				if(!connect(host,hostDir,secret,'left',{secret:true})) continue;
				const seal = gateAt(host,hostDir);
				if(!seal) continue;
				seal.secret = true;
				seal.type = 'growthGate';
				gates.push(seal);
				hazards.push(seal);
				const m = mouth(host,hostDir);
				const mouthBox = m ? {x:m.x-30,y:m.y-30,w:(m.w||80)+60,h:(m.h||80)+60} : null;
				function vineBlocked(box){
					for(let vi = 0; vi < decorations.length; vi++){
						const d = decorations[vi];
						if(!d || d.roomId !== host.id) continue;
						if(!/Hanging|VineCurtain|WebCanopy|jgVine/.test(d.type || '')) continue;
						if(overlap(box, d, 48)) return true;
					}
					return false;
				}
				function considerSeal(list, x, y, score){
					const box = {x:x,y:y,w:110,h:120};
					if(x < host.x + 50 || x + 110 > host.x + host.w - 50) return;
					if(y < host.y + 90 || y + 120 > host.y + host.h - 16) return;
					if(mouthBox && overlap(box, mouthBox, 120)) return;
					if(vineBlocked(box)) return;
					list.push({x:x,y:y,score:score});
				}
				const sealSpots = [];
				for(let pi = 0; pi < platforms.length; pi++){
					const p = platforms[pi];
					if(p.roomId !== host.id || p._jungleHidden || p.vineRung || p.kind === 'collapse') continue;
					considerSeal(sealSpots, Math.round(p.x + p.w * 0.5 - 55), p.y - 118, 240 + p.w * 0.08);
				}
				for(let ci = 0; ci < (host.cells || []).length; ci++){
					const c = host.cells[ci];
					const xs = [c.x + c.w * 0.3, c.x + c.w * 0.5, c.x + c.w * 0.7];
					for(let k = 0; k < xs.length; k++){
						considerSeal(sealSpots, Math.round(xs[k] - 55), c.y + c.h - 128, 90 + k * 8);
					}
				}
				sealSpots.sort(function(a,b){ return b.score - a.score; });
				const spot = sealSpots[0] || {
					x: hostDir === 'right' ? host.x + 160 : host.x + host.w * 0.45,
					y: host.y + host.h - 230,
				};
				const clues = section === 1 ? 'damaged statue and roots' : section === 2 ? 'water flowing into the roots' : section === 3 ? 'glowing mushrooms above the path' : 'a pulse beneath the bark';
				interactables.push({
					kind:'rootSeal',x:spot.x,y:spot.y,w:110,h:120,roomId:host.id,
					gateIndex:gates.length-1,secretRoomId:secret.id,name:'Unusual Root Seal',
					clue:clues,used:false,
				});
				decorations.push({
					type:section === 2 ? 'jgFlowClue' : section === 3 ? 'jgGlowMushrooms' : 'jgSuspiciousRoot',
					x:spot.x-40,y:spot.y-40,w:180,h:160,roomId:host.id,_jungle:true,secretHint:true,
				});
				secretCount++;
				made = true;
			}
		}

		/* Worldroot vine elevators are retired. Rooms stay linked by the
		   authored graph only. */

		/* One rare authored event may modify a suitable room. Its trigger
		   and consequences are deterministic once this run is built. */
		const eventHosts = rooms.filter(function(r){
			return !r.optional && !r.secret && r.section >= 2 && r.section <= 3 &&
				r.kind !== 'miniBoss' && r.kind !== 'spectacle' && r.kind !== 'treeInterior';
		});
		let rareEvent = null;
		if(eventHosts.length && R.chance(0.32)){
			const host = R.choice(eventHosts);
			rareEvent = R.choice(RARE_EVENTS);
			host.eventType = rareEvent;
			if(rareEvent === 'jungleStampede'){
				hazards.push({type:'stampede',x:host.x+80,y:host.y+host.h-300,w:host.w-160,h:220,roomId:host.id,armed:false,dir:R.chance(0.5)?1:-1});
				decorations.push({type:'jgTracks',x:host.x+120,y:host.y+host.h-150,w:host.w-240,h:80,roomId:host.id,_jungle:true});
			} else if(rareEvent === 'giantBloom'){
				decorations.push({type:'jgDormantBloom',x:host.x+host.w/2-210,y:host.y+host.h-430,w:420,h:360,roomId:host.id,_jungle:true});
			} else if(rareEvent === 'rootMigration'){
				hazards.push({type:'rootMigration',x:host.x+160,y:host.y+host.h-360,w:host.w-320,h:300,roomId:host.id,armed:false});
			} else if(rareEvent === 'jungleCollapse'){
				hazards.push({type:'jungleCollapse',x:host.x+180,y:host.y+120,w:host.w-360,h:host.h-240,roomId:host.id,armed:false});
			} else if(rareEvent === 'ancientAwakening'){
				decorations.push({type:'jgGuardianStatue',x:host.x+host.w/2-110,y:host.y+host.h-340,w:220,h:280,roomId:host.id,_jungle:true,dormant:true});
			}
		}

		/* Decorative root masses/veins/arches fill the camera with bark
		   strokes. Keep them only in rooms whose identity is the roots. */
		const KEEP_ROOT_ROOM = { rootChamber:1, rootMaze:1, rootHeart:1, rootChasm:1, boss:1 };
		const STRIP_ROOT_DECOR = { jgRootMass:1, jgRootVeins:1, jgRootArch:1, jgConnectorRoots:1 };
		for(let i = decorations.length - 1; i >= 0; i--){
			const d = decorations[i];
			if(!d || !STRIP_ROOT_DECOR[d.type]) continue;
			const room = d.roomId != null ? rooms[d.roomId] : null;
			if(room && KEEP_ROOT_ROOM[room.kind]) continue;
			decorations.splice(i, 1);
		}

		/* Snap authored props onto floors, ceilings, and walls, keep them
		   off used mouths, and enlarge details that read as floating toys. */
		function propKind(type){
			type = type || '';
			if(/LightShaft|SunBeam|Butterflies|Fireflies|BirdFlock|Mist|Fog|MemoryEchoes|DistantRuin|DistantWaterfall|DistantVista|Spectacle|Vista|StormCloud|SapGlow|CleanAir|Lightning|WaterDrips|BiolumeField/.test(type)) return 'atmosphere';
			if(type === 'jgConnectorRoots') return 'connector';
			if(type === 'jgVineShaft' || type === 'jgVineElevator') return 'shaft';
			if(/Hanging|VineCurtain|CrackingCanopy|Wilted|RootArch|WebCanopy|HangLantern|GlowOrchid|HangGlow|CanopyLamp|SporeLantern/.test(type)) return 'ceiling';
			if(/Waterfall/.test(type)) return 'waterfall';
			if(/Stream|Pool|WaterChannel|Swamp|Lily/.test(type)) return 'water';
			if(/RuinWall|RootMass|RootVeins|WorldrootColumns/.test(type)) return 'wall';
			if(/MossCarpet/.test(type)) return 'carpet';
			if(/CanopyVista|TreeInterior|BranchNetwork|BiolumeField|CarnivoreBed|FlowerField|ThornTunnel|SecretGrove|HuntingTotems|RootChasm|StormRoost|BossHeart|AncientGrove|CanopyTemple|FloodedTemple|BuriedFacade/.test(type)) return 'volume';
			return 'floor';
		}
		function mouthRects(room){
			const out = [];
			const used = room.usedExits || {};
			for(const dir of ['left','right','top','bottom']){
				if(!used[dir] || !room.exits[dir]) continue;
				const m = mouth(room,dir);
				if(!m) continue;
				if(dir === 'left') out.push({x:room.x-10,y:m.y-10,w:120,h:m.h+20,dir:dir});
				else if(dir === 'right') out.push({x:room.x+room.w-110,y:m.y-10,w:120,h:m.h+20,dir:dir});
				else if(dir === 'top') out.push({x:m.x-10,y:room.y-10,w:m.w+20,h:120,dir:dir});
				else out.push({x:m.x-10,y:room.y+room.h-110,w:m.w+20,h:120,dir:dir});
			}
			return out;
		}
		function bestSurface(list, x, w, targetY, maxDist){
			let best = null, bestDist = 1e9, bestOverlap = 0;
			for(let i = 0; i < list.length; i++){
				const s = list[i];
				const overlapW = Math.min(x + w, s.x + s.w) - Math.max(x, s.x);
				if(overlapW < 8) continue;
				const d = Math.abs(s.y - targetY);
				if(d < bestDist - 4 || (Math.abs(d - bestDist) <= 4 && overlapW > bestOverlap)){
					bestDist = d; best = s; bestOverlap = overlapW;
				}
			}
			return best && bestDist <= (maxDist || 280) ? best : null;
		}
		function lowestSurface(list, x, w){
			let best = null;
			for(let i = 0; i < list.length; i++){
				const s = list[i];
				const overlapW = Math.min(x + w, s.x + s.w) - Math.max(x, s.x);
				if(overlapW < 8) continue;
				if(!best || s.y > best.y) best = s;
			}
			return best;
		}
		function highestSurface(list, x, w){
			let best = null;
			for(let i = 0; i < list.length; i++){
				const s = list[i];
				const overlapW = Math.min(x + w, s.x + s.w) - Math.max(x, s.x);
				if(overlapW < 8) continue;
				if(!best || s.y < best.y) best = s;
			}
			return best;
		}
		function shrinkFromMouths(p, mouths){
			for(let i = 0; i < mouths.length; i++){
				const m = mouths[i];
				if(!overlap(p, m, 8)) continue;
				if(m.dir === 'right' && p.x + p.w > m.x) p.w = Math.max(48, m.x - p.x - 12);
				if(m.dir === 'left' && p.x < m.x + m.w){
					const nx = m.x + m.w + 12;
					p.w = Math.max(48, p.x + p.w - nx);
					p.x = nx;
				}
				if(m.dir === 'top' && p.y < m.y + m.h){
					const ny = m.y + m.h + 12;
					p.h = Math.max(48, p.y + p.h - ny);
					p.y = ny;
				}
				if(m.dir === 'bottom' && p.y + p.h > m.y) p.h = Math.max(48, m.y - p.y - 12);
			}
		}
		for(let ri = 0; ri < rooms.length; ri++){
			const room = rooms[ri];
			const floors = [];
			const ceils = [];
			for(let ci = 0; ci < room.cells.length; ci++){
				const c = room.cells[ci];
				floors.push({x:c.x,y:c.y+c.h,w:c.w});
				ceils.push({x:c.x,y:c.y,w:c.w});
			}
			for(let si = 0; si < room.solids.length; si++){
				const s = room.solids[si];
				floors.push({x:s.x,y:s.y,w:s.w});
			}
			for(let pi = 0; pi < platforms.length; pi++){
				const p = platforms[pi];
				if(p.roomId !== room.id || p._jungleHidden || p.vineRung) continue;
				if(p.kind === 'move' || p.kind === 'raft' || p.kind === 'orbit' || p.vineLift) continue;
				floors.push({x:p.x,y:p.y,w:p.w});
			}
			const mouths = mouthRects(room);
			for(let di = 0; di < decorations.length; di++){
				const d = decorations[di];
				if(d.roomId !== room.id) continue;
				const kind = propKind(d.type);
				if(!d.w) d.w = kind === 'floor' ? 160 : 220;
				if(!d.h) d.h = kind === 'floor' ? 140 : 220;
				if(kind === 'atmosphere' || kind === 'connector' || kind === 'shaft'){
					continue;
				}
				if(kind === 'volume'){
					const floor = bestSurface(floors, d.x, d.w, d.y + d.h, 520);
					if(floor){
						d.y = floor.y - d.h + 2;
						if(d.y < room.y - 80){
							d.h = Math.max(160, floor.y - room.y);
							d.y = room.y;
						}
					}
					continue;
				}
				if(/Statue/.test(d.type)){ d.w = Math.max(d.w, 150); d.h = Math.max(d.h, 230); }
				else if(/Flower/.test(d.type) && d.type.indexOf('Field') < 0){ d.w = Math.max(d.w, 180); d.h = Math.max(d.h, 220); }
				else if(/GlowMushroom/.test(d.type)){ d.w = Math.max(d.w, 160); d.h = Math.max(d.h, 110); }
				else if(/Mushroom/.test(d.type) && d.type.indexOf('Forest') < 0){ d.w = Math.max(d.w, 180); d.h = Math.max(d.h, 120); }
				else if(/WaterWheel|SunMirror|Mechanism/.test(d.type)){ d.w = Math.max(d.w, 150); d.h = Math.max(d.h, 190); }
				else if(/Nest/.test(d.type)){ d.w = Math.max(d.w, 280); d.h = Math.max(d.h, 140); }
				else if(/MossCarpet/.test(d.type)){ d.h = Math.max(28, Math.min(d.h, 42)); }

				if(kind === 'ceiling' || kind === 'waterfall'){
					const ceil = highestSurface(ceils, d.x, d.w) || bestSurface(ceils, d.x, d.w, d.y, 420);
					if(ceil){
						d.y = ceil.y + 2;
						const floor = lowestSurface(floors, d.x, d.w);
						const maxH = floor ? floor.y - d.y - 10 : room.y + room.h - d.y - 10;
						if(kind === 'waterfall') d.h = Math.max(220, maxH);
						else d.h = Math.max(d.h || 280, Math.min(Math.max(d.h, 520), maxH));
					}
					if(/Hanging|VineCurtain|WebCanopy/.test(d.type || '')) shrinkFromMouths(d, mouths);
				}else if((/Tree/.test(d.type||'') || /MushroomForest/.test(d.type||'')) && kind === 'floor'){
					const floor = lowestSurface(floors, d.x, d.w);
					if(floor) d.y = floor.y - d.h + 2;
				}else if(kind === 'water'){
					const floor = lowestSurface(floors, d.x, d.w);
					if(floor) d.y = floor.y - d.h + 4;
				}else if(kind === 'carpet' || kind === 'floor' || kind === 'wall'){
					const target = d.y + d.h;
					const floor = bestSurface(floors, d.x, d.w, target, kind === 'wall' ? 420 : 300);
					if(floor){
						if(kind === 'wall'){
							d.h = Math.max(d.h, Math.min(room.h * 0.55, floor.y - (room.y + 80)));
							d.y = floor.y - d.h;
							if(d.from === 'left' || d.x < room.x + room.w * 0.28) d.x = room.x;
							else if(d.from === 'right' || d.x + d.w > room.x + room.w * 0.72) d.x = room.x + room.w - d.w;
						}else{
							d.y = floor.y - d.h + 2;
						}
					}
				}
				if((kind === 'wall' && !/RootMass|RootVeins|WorldrootColumns/.test(d.type||'')) ||
					(kind === 'floor' && !/Field|Carpet|Moss|Clue|FlowerField/.test(d.type||''))) shrinkFromMouths(d, mouths);
			}
			for(let di = decorations.length - 1; di >= 0; di--){
				const d = decorations[di];
				if(d.roomId !== room.id) continue;
				const kind = propKind(d.type);
				if(kind === 'ceiling' || kind === 'shaft'){
					const solids = room.solids || [];
					for(let si = 0; si < solids.length; si++){
						const s = solids[si];
						if(d.y + (d.h || 80) < s.y - 16 || d.y > s.y + s.h + 16) continue;
						if(s.x + s.w > d.x && s.x + s.w < d.x + d.w && s.x <= d.x + 90){
							const nx = s.x + s.w + 12;
							d.w = d.x + d.w - nx;
							d.x = nx;
						}
						if(s.x < d.x + d.w && s.x > d.x && s.x + s.w >= d.x + d.w - 90){
							d.w = s.x - d.x - 12;
						}
					}
					if((d.w || 0) < 48) decorations.splice(di, 1);
				} else if((kind === 'floor' || kind === 'carpet') && !/Clue|Eyes|Tracks|Marks|Letters|Mechanism/.test(d.type || '')){
					const floor = bestSurface(floors, d.x, d.w, d.y + d.h, 380) || lowestSurface(floors, d.x, d.w);
					if(!floor) decorations.splice(di, 1);
					else if(Math.abs((d.y + d.h) - floor.y) > 10) d.y = floor.y - d.h + 2;
				}
			}
			const FLOOR_HZ = { bounceMushroom:1, poisonFlower:1, carnivorousPlant:1, rootSnare:1, sporePocket:1, sinkingMud:1 };
			for(let hi = 0; hi < hazards.length; hi++){
				const hz = hazards[hi];
				if(hz.roomId !== room.id || !FLOOR_HZ[hz.type]) continue;
				const floor = bestSurface(floors, hz.x, hz.w, hz.y + hz.h, 380) || lowestSurface(floors, hz.x, hz.w);
				if(floor) hz.y = floor.y - hz.h + 2;
			}
			for(let hi = 0; hi < hazards.length; hi++){
				const h = hazards[hi];
				if(h.roomId !== room.id || h.type !== 'fallingBranch') continue;
				const ceil = highestSurface(ceils, h.x, h.w) || bestSurface(ceils, h.x, h.w, h.y, 420);
				if(ceil) h.y = ceil.y + 6;
			}
			function insetFromBanks(item){
				if(!item || item.w == null) return;
				let x0 = item.x, x1 = item.x + item.w;
				const banks = room.solids || [];
				const edge = Math.max(280, room.w * 0.16);
				for(let bi = 0; bi < banks.length; bi++){
					const s = banks[bi];
					if(item.y + item.h < s.y - 16 || item.y > s.y + s.h + 16) continue;
					const leftBank = s.x <= room.x + edge;
					const rightBank = s.x + s.w >= room.x + room.w - edge;
					if(!leftBank && !rightBank) continue;
					if(leftBank) x0 = Math.max(x0, s.x + s.w);
					if(rightBank) x1 = Math.min(x1, s.x);
					if(s.y > item.y + 4){
						s.h += s.y - item.y;
						s.y = item.y;
					}
				}
				if(x1 - x0 >= 80){ item.x = x0; item.w = x1 - x0; }
			}
			for(let hi = 0; hi < hazards.length; hi++){
				const h = hazards[hi];
				if(h.roomId !== room.id || h.type !== 'water') continue;
				insetFromBanks(h);
			}
			for(let di = 0; di < decorations.length; di++){
				const d = decorations[di];
				if(d.roomId !== room.id || !d.type) continue;
				if(!/Stream|Swamp|Pool|WaterChannel/.test(d.type)) continue;
				insetFromBanks(d);
			}
		}

		/* Secret seals were placed before hanging vines stretch. Re-seat them
		   on walkable ground away from vine curtains and used mouths. */
		for(let ii = 0; ii < interactables.length; ii++){
			const it = interactables[ii];
			if(!it || it.kind !== 'rootSeal') continue;
			const host = rooms[it.roomId];
			if(!host) continue;
			const used = host.usedExits || {};
			const hostDir = used.top && !used.right ? 'top' : used.bottom && !used.right ? 'bottom' : used.right ? 'right' : 'top';
			const m = mouth(host, hostDir);
			const mouthBox = m ? {x:m.x-30,y:m.y-30,w:(m.w||80)+60,h:(m.h||80)+60} : null;
			function vineBlocked(box){
				for(let vi = 0; vi < decorations.length; vi++){
					const d = decorations[vi];
					if(!d || d.roomId !== host.id) continue;
					if(!/Hanging|VineCurtain|WebCanopy|jgVine/.test(d.type || '')) continue;
					if(overlap(box, d, 48)) return true;
				}
				return false;
			}
			function considerSeal(list, x, y, score){
				const box = {x:x,y:y,w:110,h:120};
				if(x < host.x + 50 || x + 110 > host.x + host.w - 50) return;
				if(y < host.y + 90 || y + 120 > host.y + host.h - 16) return;
				if(mouthBox && overlap(box, mouthBox, 120)) return;
				if(vineBlocked(box)) return;
				list.push({x:x,y:y,score:score});
			}
			const sealSpots = [];
			for(let pi = 0; pi < platforms.length; pi++){
				const p = platforms[pi];
				if(p.roomId !== host.id || p._jungleHidden || p.vineRung || p.kind === 'collapse') continue;
				considerSeal(sealSpots, Math.round(p.x + p.w * 0.5 - 55), p.y - 118, 240 + p.w * 0.08);
			}
			for(let ci = 0; ci < (host.cells || []).length; ci++){
				const c = host.cells[ci];
				const xs = [c.x + c.w * 0.28, c.x + c.w * 0.5, c.x + c.w * 0.72];
				for(let k = 0; k < xs.length; k++){
					considerSeal(sealSpots, Math.round(xs[k] - 55), c.y + c.h - 128, 80 + k * 6);
				}
			}
			sealSpots.sort(function(a,b){ return b.score - a.score; });
			const spot = sealSpots[0];
			if(!spot) continue;
			it.x = spot.x; it.y = spot.y;
			for(let di = 0; di < decorations.length; di++){
				const d = decorations[di];
				if(!d || d.roomId !== host.id || !d.secretHint) continue;
				d.x = spot.x - 40; d.y = spot.y - 40;
			}
		}

		const LIGHT_FLOOR = ['jgSapCrystal','jgBiolumeLamp','jgMossTorch','jgHeartwoodLamp','jgFireflyNest','jgLimeGeode','jgRootLamp','jgGlowLily','jgTallBiolume','jgGlowBowl'];
		const LIGHT_HANG = ['jgHangLantern','jgGlowOrchid','jgSporeLantern','jgHangGlowVines','jgCanopyLamp'];
		const HAS_LIGHT = /Lantern|GlowMushroom|Biolume|SapGlow|Fireflies|SapCrystal|MossTorch|GlowOrchid|SporeLantern|HeartwoodLamp|FireflyNest|LimeGeode|RootLamp|GlowBowl|CanopyLamp|HangGlow|TallBiolume|GiantFlower/;
		function lightBlocked(room, x, y, w, h){
			const box = { x:x, y:y, w:w, h:h };
			for(let i = 0; i < decorations.length; i++){
				const d = decorations[i];
				if(d.roomId !== room.id) continue;
				if(overlap(box, d, 24)) return true;
			}
			for(let i = 0; i < interactables.length; i++){
				const it = interactables[i];
				if(it.roomId !== room.id) continue;
				if(overlap(box, { x:it.x, y:it.y, w:it.w || 60, h:it.h || 70 }, 20)) return true;
			}
			return false;
		}
		for(let ri = 0; ri < rooms.length; ri++){
			const room = rooms[ri];
			if(room.kind === 'boss' || room.kind === 'miniBoss') continue;
			let have = 0;
			for(let di = 0; di < decorations.length; di++){
				const d = decorations[di];
				if(d.roomId === room.id && HAS_LIGHT.test(d.type || '')) have++;
			}
			const want = (room.secret || room.kind === 'shrine' || room.kind === 'memory') ? 3 : 2;
			if(have >= want) continue;
			const floors = [];
			const ceils = [];
			for(let ci = 0; ci < room.cells.length; ci++){
				const c = room.cells[ci];
				floors.push({ x:c.x, y:c.y + c.h, w:c.w });
				ceils.push({ x:c.x, y:c.y, w:c.w });
			}
			for(let pi = 0; pi < platforms.length; pi++){
				const p = platforms[pi];
				if(p.roomId !== room.id || p._jungleHidden || p.vineRung) continue;
				if(p.kind === 'move' || p.kind === 'raft' || p.kind === 'orbit' || p.vineLift) continue;
				floors.push({ x:p.x, y:p.y, w:p.w });
			}
			const mouths = mouthRects(room);
			let planted = 0;
			const tries = 14;
			for(let t = 0; t < tries && have + planted < want; t++){
				const hang = (t % 3 === 0);
				const type = hang ? R.choice(LIGHT_HANG) : R.choice(LIGHT_FLOOR);
				const w = hang ? 90 : 100;
				const h = hang ? 140 : 130;
				const pad = 80;
				const x = snap(room.x + pad + R.rnd() * Math.max(40, room.w - pad * 2 - w));
				let y, d;
				if(hang){
					const ceil = highestSurface(ceils, x, w) || { x:room.x, y:room.y, w:room.w };
					y = ceil.y + 8;
					d = { type:type, x:x, y:y, w:w, h:h, roomId:room.id, _jungle:true, hang:true };
				} else {
					const floor = bestSurface(floors, x, w, room.y + room.h, 420) || lowestSurface(floors, x, w);
					if(!floor) continue;
					y = floor.y - h + 2;
					d = { type:type, x:x, y:y, w:w, h:h, roomId:room.id, _jungle:true };
				}
				let blocked = lightBlocked(room, d.x, d.y, d.w, d.h);
				for(let mi = 0; !blocked && mi < mouths.length; mi++){
					if(overlap(d, mouths[mi], 10)) blocked = true;
				}
				if(blocked) continue;
				decorations.push(d);
				planted++;
			}
		}

		/* Distinct region bounds feed palette and atmosphere progression. */
		const regionBounds = {};
		for(let section = 1; section <= 4; section++){
			const list = rooms.filter(function(r){ return r.section === section && !r.secret; });
			if(!list.length) continue;
			regionBounds[section] = {
				x0:Math.min.apply(null,list.map(function(r){ return r.x; })),
				y0:Math.min.apply(null,list.map(function(r){ return r.y; })),
				x1:Math.max.apply(null,list.map(function(r){ return r.x+r.w; })),
				y1:Math.max.apply(null,list.map(function(r){ return r.y+r.h; })),
			};
		}

		let maxX = 0, maxY = 0;
		for(const list of [rooms,corridors]){
			for(let i = 0; i < list.length; i++){
				maxX = Math.max(maxX,list[i].x+list[i].w);
				maxY = Math.max(maxY,list[i].y+list[i].h);
			}
		}
		const worldW = snap(maxX + 600);
		const worldH = snap(maxY + 600);
		const startRoom = placed.start;
		const bossRoom = placed.boss;
		const bossSpawn = enemies.find(function(e){ return e.type === 'earthColossus'; });
		const bossMouth = bossRoom && bossRoom.exits.left ? mouth(bossRoom,'left') : null;
		const mini = rooms.find(function(r){ return r.kind === 'miniBoss'; });
		const miniSpawn = enemies.find(function(e){ return e.isMiniBoss; });

		/* Required graph validation catches malformed recipes immediately. */
		const reachable = Object.create(null);
		const queue = startRoom ? [startRoom.id] : [];
		reachable[startRoom ? startRoom.id : -1] = true;
		while(queue.length){
			const id = queue.shift();
			for(let i = 0; i < connections.length; i++){
				const c = connections[i];
				const other = c.a === id ? c.b : c.b === id ? c.a : -1;
				if(other >= 0 && !reachable[other]){ reachable[other]=true; queue.push(other); }
			}
		}
		for(let i = 0; i < recipe.nodes.length; i++){
			const n = recipe.nodes[i];
			if(n.optional || !included[n.id]) continue;
			if(!placed[n.id] || !reachable[placed[n.id].id]) return null;
		}

		global.DUNGEON_THEME_INFO = global.DUNGEON_THEME_INFO || {};
		const jungleRoster = [
			{type:'thornWolf'},{type:'sporeFungus'},{type:'mossWraith'},{type:'willowWisp'},
			{type:'glowBeetle'},{type:'stalactiteBat'},{type:'skyVine'},{type:'windSylph'},
			{type:'caveSpider'},{type:'vineCrawler'},
			{type:'barkbackBeetle'},{type:'pollenMoth'},{type:'rootParasite'},{type:'jungleChameleon'},
		];
		global.DUNGEON_THEME_INFO.earth = { name:'The Living Wilds', enemies:jungleRoster };
		global.DUNGEON_THEME_INFO.jungle = { name:'The Living Wilds', enemies:jungleRoster };

		const result = {
			name:'The Living Wilds',
			worldW:worldW, worldH:worldH,
			bgColor:'#07140d',
			wallColor:'#26351f', wallColor2:'#35492a', wallEdge:'#64844d',
			floorHighlight:'#8cad68', ceilShadow:'#0a160d', airColor:'#0b1b12',
			playerStart:{x:startRoom.x+180,y:startRoom.y+startRoom.h-280},
			corridors:corridors,
			rooms:rooms,
			platforms:platforms,
			hazards:hazards,
			interactables:interactables,
			decorations:decorations,
			enemies:enemies,
			puzzles:[],
			_theme:'earth',
			_meter:'disturbance',
			_meterLabel:'Jungle Awareness',
			_startRoom:{x:startRoom.x,y:startRoom.y,w:startRoom.w,h:startRoom.h},
			_bossRoomRect:{x:bossRoom.x,y:bossRoom.y,w:bossRoom.w,h:bossRoom.h},
			_bossLockWall:bossMouth ? {x:bossRoom.x-40,y:bossMouth.y,w:80,h:bossMouth.h} : null,
			_bossRoomTriggerX:bossRoom.x+120,
			_bossRoomTriggerY:bossRoom.y+180,
			_prebossLockWall:null,
			_bossPlatforms:platforms.filter(function(p){ return p.roomId === bossRoom.id; }),
			_gates:gates,
			_jungle:true,
			_recipe:recipe.id,
			_seed:seed,
			_jungleRegions:regionBounds,
			_jungleEvent:rareEvent,
			_miniBoss:mini ? {roomId:mini.id,type:miniSpawn ? miniSpawn.type : mini.miniBossType} : null,
			_librarySize:global.JUNGLE_ROOM_TEMPLATES.length,
			_secretCount:secretCount,
			_generationReport:{
				valid:true,
				requiredReachable:true,
				recipe:recipe.id,
				rooms:rooms.length,
				templatesAvailable:global.JUNGLE_ROOM_TEMPLATES.length,
				secrets:secretCount,
				miniBoss:miniSpawn ? miniSpawn.type : null,
				rareEvent:rareEvent,
			},
		};
		if(bossSpawn){
			const core = platforms.find(function(p){ return p.roomId === bossRoom.id && p.central; });
			const sizeMult = typeof DIFF_SIZE_MULT === 'number' ? DIFF_SIZE_MULT : 1.4;
			const bossW = 540 * sizeMult;
			const bossH = 720 * sizeMult;
			bossSpawn.x = bossRoom.x + bossRoom.w / 2 - bossW / 2;
			bossSpawn.y = (core ? core.y + 40 : bossRoom.y + bossRoom.h - 80) - bossH + 70;
			bossSpawn.patrol = [bossRoom.x+220,bossRoom.x+bossRoom.w-220];
			bossSpawn.roomId = bossRoom.id;
		}
		return result;
	}

	function seedFromPage(){
		let urlSeed = null;
		try{ urlSeed = new URLSearchParams(global.location && global.location.search || '').get('seed'); }catch(e){}
		const parsed = urlSeed == null ? NaN : parseInt(urlSeed,10);
		if(Number.isFinite(parsed)) return Math.abs(parsed) || 1;
		if(global.DUNGEON_SEED_OVERRIDE != null) return global.DUNGEON_SEED_OVERRIDE;      // shared in co-op
		return ((Date.now() ^ (Math.random()*0xffffff|0)) & 0x7fffffff) || 1;
	}

	function generateJungleLivingWilds(){
		let seed = seedFromPage();
		for(let attempt = 0; attempt < 12; attempt++){
			const out = build(seed + attempt * 7919);
			if(out) return out;
		}
		throw new Error('Unable to assemble a valid Living Wilds run.');
	}

	global.generateJungleLivingWilds = generateJungleLivingWilds;
	global.JUNGLE_DUNGEON_RECIPES = RECIPES;
	global.validateJungleDungeonBuild = function(seed){
		const out = build(seed || 1);
		return out ? out._generationReport : {valid:false};
	};
})(typeof window !== 'undefined' ? window : globalThis);
