/* =============================================================
   Infernal Depths — graph assembler + template stamper.
   Picks a hand-written run recipe, stamps authored rooms, short connectors.
   ============================================================= */
(function(global){
	const TILE = 40;

	function rngFromSeed(seed){
		let s = seed & 0x7FFFFFFF;
		function rnd(){ s = (s * 1664525 + 1013904223) & 0x7FFFFFFF; return s / 0x7FFFFFFF; }
		return {
			rnd,
			ri(lo, hi){ return lo + Math.floor(rnd() * (hi - lo + 1)); },
			rf(lo, hi){ return lo + rnd() * (hi - lo); },
			chance(p){ return rnd() < p; },
			choice(arr){ return arr[Math.floor(rnd() * arr.length)]; },
		};
	}

	function snap(n){ return Math.round(n / TILE) * TILE; }

	function dungeonShouldKeepPlatform(tpl, p){
		if(!p) return false;
		if(p.landing || p.central || p.arenaSection || p.perch || p.pillar) return true;
		const kind = p.kind || 'static';
		if(kind !== 'static') return true;
		if(!tpl) return true;
		if(tpl.climbExits || tpl.lavaLake) return true;
		if(tpl.ports && tpl.ports.top) return true;
		if(tpl.pits && tpl.pits.length) return true;
		if(tpl.lavaRects && tpl.lavaRects.length) return true;
		const keepKinds = {
			crossing:1, ascent:1, descent:1, collapseEvent:1, flood:1, eruption:1,
			lake:1, river:1, bridge:1, slide:1, traversal:1, mechanism:1,
			preboss:1, boss:1, knight:1, heart:1, stabilize:1, furnace:1,
			shatter:1, blizzard:1, mirror:1, prison:1, vault:1, ashFork:1,
			magmaSiphon:1, ashenFoundry:1, collapsingDescent:1,
			magmaArena:1, furnaceConveyor:1, eruptionChamber:1,
			moltenBridgeworks:1, infernoNest:1, threeValveFurnace:1
		};
		if(keepKinds[tpl.kind]) return true;
		if(tpl.variant === 'channels-left' || tpl.variant === 'channels-right' || tpl.variant === 'rising') return true;
		const hazards = tpl.hazards || [];
		for(let i = 0; i < hazards.length; i++){
			const h = hazards[i];
			if(h && (h.type === 'rise' || h.type === 'flood' || h.type === 'channel')) return true;
		}
		const ints = tpl.interactables || [];
		for(let i = 0; i < ints.length; i++){
			const it = ints[i];
			if(!it) continue;
			if((it.yFromFloor || 0) > 100) return true;
			if(it.x != null && p.x != null && it.x + (it.w || 40) > p.x && it.x < p.x + (p.w || 0) && Math.abs((it.yFromFloor || 0) - (p.yFromFloor || 0)) < 90) return true;
		}
		return false;
	}
	global.dungeonShouldKeepPlatform = dungeonShouldKeepPlatform;

	const RECIPES = [
		{
			id:'ash_descent',
			nodes:[
				{ id:'start', kind:'start', section:1 },
				{ id:'c1', kind:'combat', section:1 },
				{ id:'c1b', kind:'combat', section:1 },
				{ id:'cross', kind:'crossing', section:1 },
				{ id:'c2', kind:'combat', section:2 },
				{ id:'span', kind:'crossing', section:2 },
				{ id:'fork', kind:'ashFork', section:2 },
				{ id:'safe', kind:'combat', section:2 },
				{ id:'ashen', kind:'combat', section:2, hot:true },
				{ id:'merge', kind:'stabilize', section:2 },
				{ id:'c3', kind:'combat', section:3 },
				{ id:'furnace', kind:'furnace', section:3 },
				{ id:'c4', kind:'combat', section:3 },
				{ id:'rest', kind:'cooling', section:3 },
				{ id:'warden', kind:'warden', section:3 },
				{ id:'event', kind:'eruption', section:3 },
				{ id:'core', kind:'flood', section:4 },
				{ id:'down', kind:'descent', section:4 },
				{ id:'pre', kind:'preboss', section:4 },
				{ id:'boss', kind:'boss', section:4 },
				{ id:'wingA1', kind:'combat', section:1, optional:true },
				{ id:'arena', kind:'magmaArena', section:2, optional:true },
				{ id:'wingA3', kind:'shrine', section:2, optional:true },
				{ id:'belt', kind:'furnaceConveyor', section:2, optional:true },
				{ id:'wingB2', kind:'combat', section:2, optional:true },
				{ id:'valves', kind:'threeValveFurnace', section:3, optional:true },
				{ id:'bridge', kind:'moltenBridgeworks', section:2, optional:true },
				{ id:'nest', kind:'infernoNest', section:3, optional:true },
				{ id:'erup', kind:'eruptionChamber', section:3, optional:true },
				{ id:'sideD1', kind:'combat', section:1, optional:true },
				{ id:'sideD2', kind:'magmaSiphon', section:2, optional:true },
				{ id:'sideD3', kind:'ashenFoundry', section:2, optional:true },
				{ id:'sideD4', kind:'cooling', section:2, optional:true },
				{ id:'sideE1', kind:'elite', section:3, optional:true },
				{ id:'sideE2', kind:'collapsingDescent', section:3, optional:true },
				{ id:'sideE3', kind:'vault', section:3, optional:true },
				{ id:'sideF1', kind:'combat', section:2, optional:true },
				{ id:'sideF2', kind:'risk', section:2, optional:true },
				{ id:'sideF3', kind:'shrine', section:3, optional:true },
			],
			edges:[
				['start','right','c1','left'],
				['c1','right','c1b','left'],
				['c1b','right','cross','left'],
				['cross','right','c2','left'],
				['c2','right','span','left'],
				['span','right','fork','left'],
				['fork','left','safe','right'],
				['fork','right','ashen','left'],
				['safe','bottom','merge','left'],
				['ashen','bottom','merge','right'],
				['merge','bottom','c3','left'],
				['c3','right','furnace','left'],
				['furnace','right','c4','left'],
				['c4','right','rest','left'],
				['rest','right','warden','left'],
				['warden','right','event','left'],
				['event','bottom','core','left'],
				['core','right','down','top'],
				['down','bottom','pre','left'],
				['pre','right','boss','left'],
				['c1','bottom','wingA1','left', { optional:true }],
				['wingA1','right','arena','left', { optional:true }],
				['arena','right','wingA3','left', { optional:true }],
				['c2','bottom','belt','left', { optional:true }],
				['belt','right','wingB2','left', { optional:true }],
				['wingB2','right','valves','left', { optional:true }],
				['safe','right','bridge','left', { optional:true }],
				['bridge','right','nest','left', { optional:true }],
				['nest','right','erup','left', { optional:true }],
				['c1b','top','sideD1','bottom', { optional:true }],
				['sideD1','right','sideD2','left', { optional:true }],
				['sideD2','right','sideD3','left', { optional:true }],
				['sideD3','right','sideD4','left', { optional:true }],
				['c4','bottom','sideE1','top', { optional:true }],
				['sideE1','right','sideE2','left', { optional:true }],
				['sideE2','right','sideE3','left', { optional:true }],
				['rest','top','sideF1','bottom', { optional:true }],
				['sideF1','right','sideF2','left', { optional:true }],
				['sideF2','right','sideF3','left', { optional:true }],
			],
		},
		{
			id:'forge_line',
			nodes:[
				{ id:'start', kind:'start', section:1 },
				{ id:'c1', kind:'combat', section:1 },
				{ id:'c1b', kind:'combat', section:1 },
				{ id:'cross', kind:'crossing', section:1 },
				{ id:'c2', kind:'combat', section:2 },
				{ id:'span', kind:'crossing', section:2 },
				{ id:'river', kind:'river', section:2 },
				{ id:'hard', kind:'elite', section:3 },
				{ id:'mid', kind:'crossing', section:3 },
				{ id:'trav', kind:'crossing', section:3 },
				{ id:'c3', kind:'combat', section:3 },
				{ id:'furnace', kind:'furnace', section:3 },
				{ id:'c4', kind:'combat', section:3 },
				{ id:'warden', kind:'warden', section:3 },
				{ id:'event', kind:'collapseEvent', section:4 },
				{ id:'down', kind:'descent', section:4 },
				{ id:'pre', kind:'preboss', section:4 },
				{ id:'boss', kind:'boss', section:4 },
				{ id:'wingA1', kind:'combat', section:1, optional:true },
				{ id:'arena', kind:'magmaArena', section:2, optional:true },
				{ id:'wingA3', kind:'shrine', section:2, optional:true },
				{ id:'belt', kind:'furnaceConveyor', section:2, optional:true },
				{ id:'wingB2', kind:'combat', section:2, optional:true },
				{ id:'valves', kind:'threeValveFurnace', section:3, optional:true },
				{ id:'bridge', kind:'moltenBridgeworks', section:2, optional:true },
				{ id:'nest', kind:'infernoNest', section:3, optional:true },
				{ id:'erup', kind:'eruptionChamber', section:3, optional:true },
				{ id:'sideD1', kind:'combat', section:1, optional:true },
				{ id:'sideD2', kind:'magmaSiphon', section:2, optional:true },
				{ id:'sideD3', kind:'ashenFoundry', section:2, optional:true },
				{ id:'sideD4', kind:'cooling', section:2, optional:true },
				{ id:'sideE1', kind:'elite', section:3, optional:true },
				{ id:'sideE2', kind:'collapsingDescent', section:3, optional:true },
				{ id:'sideE3', kind:'vault', section:3, optional:true },
				{ id:'sideF1', kind:'combat', section:2, optional:true },
				{ id:'sideF2', kind:'risk', section:2, optional:true },
				{ id:'sideF3', kind:'shrine', section:3, optional:true },
			],
			edges:[
				['start','right','c1','left'],
				['c1','right','c1b','left'],
				['c1b','right','cross','left'],
				['cross','right','c2','left'],
				['c2','right','span','left'],
				['span','right','river','left'],
				['river','right','hard','left'],
				['hard','right','mid','left'],
				['mid','right','trav','left'],
				['trav','right','c3','left'],
				['c3','right','furnace','left'],
				['furnace','bottom','c4','left'],
				['c4','right','warden','left'],
				['warden','right','event','left'],
				['event','bottom','down','top'],
				['down','bottom','pre','left'],
				['pre','right','boss','left'],
				['c1','bottom','wingA1','left', { optional:true }],
				['wingA1','right','arena','left', { optional:true }],
				['arena','right','wingA3','left', { optional:true }],
				['c2','bottom','belt','left', { optional:true }],
				['belt','right','wingB2','left', { optional:true }],
				['wingB2','right','valves','left', { optional:true }],
				['river','bottom','bridge','left', { optional:true }],
				['bridge','right','nest','left', { optional:true }],
				['nest','right','erup','left', { optional:true }],
				['c1b','top','sideD1','bottom', { optional:true }],
				['sideD1','right','sideD2','left', { optional:true }],
				['sideD2','right','sideD3','left', { optional:true }],
				['sideD3','right','sideD4','left', { optional:true }],
				['c4','bottom','sideE1','top', { optional:true }],
				['sideE1','right','sideE2','left', { optional:true }],
				['sideE2','right','sideE3','left', { optional:true }],
				['trav','top','sideF1','bottom', { optional:true }],
				['sideF1','right','sideF2','left', { optional:true }],
				['sideF2','right','sideF3','left', { optional:true }],
			],
		},
		{
			id:'core_surge',
			nodes:[
				{ id:'start', kind:'start', section:1 },
				{ id:'c1', kind:'combat', section:1 },
				{ id:'c1b', kind:'combat', section:1 },
				{ id:'up', kind:'ascent', section:2 },
				{ id:'c2', kind:'combat', section:2 },
				{ id:'span', kind:'crossing', section:2 },
				{ id:'fork', kind:'ashFork', section:2 },
				{ id:'safe', kind:'combat', section:2 },
				{ id:'ashen', kind:'combat', section:3, hot:true },
				{ id:'merge', kind:'stabilize', section:3 },
				{ id:'c3', kind:'combat', section:3 },
				{ id:'c4', kind:'combat', section:3 },
				{ id:'rest', kind:'cooling', section:3 },
				{ id:'warden', kind:'warden', section:3 },
				{ id:'event', kind:'eruption', section:4 },
				{ id:'down', kind:'descent', section:4 },
				{ id:'pre', kind:'preboss', section:4 },
				{ id:'boss', kind:'boss', section:4 },
				{ id:'wingA1', kind:'combat', section:1, optional:true },
				{ id:'arena', kind:'magmaArena', section:2, optional:true },
				{ id:'wingA3', kind:'shrine', section:2, optional:true },
				{ id:'belt', kind:'furnaceConveyor', section:2, optional:true },
				{ id:'wingB2', kind:'combat', section:2, optional:true },
				{ id:'valves', kind:'threeValveFurnace', section:3, optional:true },
				{ id:'bridge', kind:'moltenBridgeworks', section:2, optional:true },
				{ id:'nest', kind:'infernoNest', section:3, optional:true },
				{ id:'erup', kind:'eruptionChamber', section:3, optional:true },
				{ id:'sideD1', kind:'combat', section:1, optional:true },
				{ id:'sideD2', kind:'magmaSiphon', section:2, optional:true },
				{ id:'sideD3', kind:'ashenFoundry', section:2, optional:true },
				{ id:'sideD4', kind:'cooling', section:2, optional:true },
				{ id:'sideE1', kind:'elite', section:3, optional:true },
				{ id:'sideE2', kind:'collapsingDescent', section:3, optional:true },
				{ id:'sideE3', kind:'vault', section:3, optional:true },
				{ id:'sideF1', kind:'combat', section:2, optional:true },
				{ id:'sideF2', kind:'risk', section:2, optional:true },
				{ id:'sideF3', kind:'shrine', section:3, optional:true },
			],
			edges:[
				['start','right','c1','left'],
				['c1','right','c1b','left'],
				['c1b','right','up','left'],
				['up','top','c2','bottom'],
				['c2','right','span','left'],
				['span','right','fork','left'],
				['fork','left','safe','right'],
				['fork','right','ashen','left'],
				['safe','bottom','merge','left'],
				['ashen','bottom','merge','right'],
				['merge','bottom','c3','left'],
				['c3','right','c4','left'],
				['c4','right','rest','left'],
				['rest','right','warden','left'],
				['warden','right','event','left'],
				['event','bottom','down','top'],
				['down','bottom','pre','left'],
				['pre','right','boss','left'],
				['c1','bottom','wingA1','left', { optional:true }],
				['wingA1','right','arena','left', { optional:true }],
				['arena','right','wingA3','left', { optional:true }],
				['up','right','belt','left', { optional:true }],
				['belt','right','wingB2','left', { optional:true }],
				['wingB2','right','valves','left', { optional:true }],
				['safe','right','bridge','left', { optional:true }],
				['bridge','right','nest','left', { optional:true }],
				['nest','right','erup','left', { optional:true }],
				['c1b','top','sideD1','bottom', { optional:true }],
				['sideD1','right','sideD2','left', { optional:true }],
				['sideD2','right','sideD3','left', { optional:true }],
				['sideD3','right','sideD4','left', { optional:true }],
				['c4','bottom','sideE1','top', { optional:true }],
				['sideE1','right','sideE2','left', { optional:true }],
				['sideE2','right','sideE3','left', { optional:true }],
				['rest','top','sideF1','bottom', { optional:true }],
				['sideF1','right','sideF2','left', { optional:true }],
				['sideF2','right','sideF3','left', { optional:true }],
			],
		},
	];

	const OPTIONAL_POOL = ['vault', 'shrine', 'trial', 'elite', 'eliteChamber', 'cooling', 'risk',
		'magmaSiphon', 'ashenFoundry', 'collapsingDescent',
		'magmaArena', 'furnaceConveyor', 'eruptionChamber', 'moltenBridgeworks', 'infernoNest', 'threeValveFurnace'];
	const FIRE_SPECIAL = ['magmaSiphon', 'ashenFoundry', 'collapsingDescent',
		'magmaArena', 'furnaceConveyor', 'eruptionChamber', 'moltenBridgeworks', 'infernoNest', 'threeValveFurnace'];

	function pickTemplate(R, kind, section, heat){
		if(kind === 'fireSpecial'){
			kind = R.choice(FIRE_SPECIAL);
		}
		if(kind === 'optionalPool'){
			const pool = OPTIONAL_POOL.slice();
			if(heat >= 40) pool.push('vault', 'trial', 'elite');
			if(R.chance(0.42)) kind = R.choice(FIRE_SPECIAL);
			else kind = R.choice(pool);
		}
		const lib = (typeof global.fireTemplatesFor === 'function')
			? global.fireTemplatesFor(kind, section)
			: (global.FIRE_ROOM_TEMPLATES || []).filter(t => t.kind === kind);
		const list = lib.length ? lib : (global.FIRE_ROOM_TEMPLATES || []).filter(t => t.kind === kind);
		if(!list.length){
			const any = (global.FIRE_ROOM_TEMPLATES || []).filter(t => t.kind === 'combat');
			return any.length ? Object.assign({}, R.choice(any)) : null;
		}
		return Object.assign({}, R.choice(list));
	}

	function pickEnemy(R, section, hot){
		const pool = [
			{ type:'imp', min:1, max:2, w:3 },
			{ type:'fireSprite', min:1, max:2, w:3 },
			{ type:'cinderBeetle', min:1, max:3, w:2 },
			{ type:'furnaceLeech', min:1, max:3, w:2 },
			{ type:'flameSerpent', min:1, max:4, w:2 },
			{ type:'emberMage', min:2, max:4, w:2 },
			{ type:'ashRevenant', min:2, max:4, w:2 },
			{ type:'magmaGolem', min:2, max:4, w: hot ? 2 : 1 },
			{ type:'magmaHarvester', min:3, max:4, w:2 },
		].filter(e => section >= e.min && section <= e.max);
		const list = pool.length ? pool : [{ type:'imp', w:1 }];
		let roll = R.rnd() * list.reduce((s, v) => s + v.w, 0);
		for(const v of list){ roll -= v.w; if(roll <= 0) return v.type; }
		return list[list.length - 1].type;
	}

	function generateFireInfernalDepths(){
		const R = rngFromSeed(global.DUNGEON_SEED_OVERRIDE != null ? global.DUNGEON_SEED_OVERRIDE : ((Date.now() ^ (Math.random() * 0xFFFFFF | 0)) & 0x7FFFFFFF));      // shared in co-op (dungeon.html DUNGEON_SEED)
		const recipe = RECIPES[R.ri(0, RECIPES.length - 1)];
		const hotRun = R.chance(0.26);
		const heatBias = hotRun ? 36 : 0;

		const corridors = [];
		const enemies = [];
		const decorations = [];
		const platforms = [];
		const hazards = [];
		const interactables = [];
		const rooms = [];
		const puzzles = [];
		const gates = [];
		const links = [];

		const WORLD_W = 32000;
		const KH = 1680;
		const ROOM_PAD = 280;
		const VERT_GAP = 640;
		const HORIZ_GAP = 280;
		const APRON_H = 480;
		const DOOR_H = 240;
		const HALL_H = 240;
		/* Pierce the sealed wall only. Deep throats used to carve pits
		   through raised floors and eat decorations beside every door. */
		const HALL_INSET = 80;
		const SHAFT_W = 200;
		const LAVA_ABOVE = 196;
		const LAVA_THICK = 76;
		const CHAN_ABOVE = 140;
		function throatDepth(){ return HALL_INSET; }
		function walkY(room){ return room.y + room.h - (room.raisedFloor || 0); }
		function walkH(h, raised){ return h - (raised || 0); }
		function shellH(tpl){ return Math.max(tpl.h || 400, 560); }

		function mergeCuts(cuts){
			if(!cuts.length) return [];
			cuts.sort(function(a, b){ return a.x - b.x; });
			const out = [{ x:cuts[0].x, w:cuts[0].w }];
			for(let i = 1; i < cuts.length; i++){
				const last = out[out.length - 1];
				if(cuts[i].x <= last.x + last.w + 8){
					last.w = Math.max(last.x + last.w, cuts[i].x + cuts[i].w) - last.x;
				} else out.push({ x:cuts[i].x, w:cuts[i].w });
			}
			return out;
		}
		function overlapsRange(x, w, ranges){
			for(let i = 0; i < ranges.length; i++){
				if(x + w > ranges[i].x + 16 && x < ranges[i].x + ranges[i].w - 16) return true;
			}
			return false;
		}
		function fluidRanges(room){
			const walk = walkY(room);
			const ranges = [];
			for(let i = 0; i < decorations.length; i++){
				const d = decorations[i];
				if(!d || (d.type !== 'lava' && d.type !== 'lavaWell')) continue;
				if(d.x + d.w < room.x - 4 || d.x > room.x + room.w + 4) continue;
				if(d.y + d.h < walk - 90 || d.y > walk + 24) continue;
				ranges.push({ x:d.x, w:d.w });
			}
			for(let i = 0; i < hazards.length; i++){
				const h = hazards[i];
				if(!h || h.roomId !== room.id || h.type !== 'channel') continue;
				if(h.left) ranges.push({ x:h.left.x, w:h.left.w });
				if(h.right) ranges.push({ x:h.right.x, w:h.right.w });
				if(h.x != null && h.w) ranges.push({ x:h.x, w:h.w });
			}
			return mergeCuts(ranges);
		}
		function dryHatchX(room, wantX, w){
			const ranges = fluidRanges(room);
			const minX = room.x + 16;
			const maxX = room.x + room.w - w - 16;
			const start = Math.max(minX, Math.min(maxX, wantX));
			if(!overlapsRange(start, w, ranges)) return start;
			let best = null, bestD = 1e9;
			for(let x = minX; x <= maxX; x += 40){
				if(overlapsRange(x, w, ranges)) continue;
				const d = Math.abs(x - wantX);
				if(d < bestD){ bestD = d; best = x; }
			}
			return best != null ? best : start;
		}
		function hatchIsWet(room, x, w){
			return overlapsRange(x, w, fluidRanges(room));
		}
		function lavaSurfaceY(room){
			const walk = walkY(room);
			if(!fluidRanges(room).length) return null;
			return walk - LAVA_ABOVE - LAVA_THICK;
		}
		function sideDoorRect(room, dir){
			const ex = (room.exits && room.exits[dir]) || {};
			const doorH = Math.max(ex.h || DOOR_H, 200);
			const walk = walkY(room);
			const lavaTop = lavaSurfaceY(room);
			const ledge = walk - Math.max(280, Math.min(420, Math.round(room.h * 0.36)));
			let maxFoot = lavaTop != null ? Math.min(lavaTop - 96, ledge) : ledge;
			maxFoot = Math.min(maxFoot, walk - 220);
			maxFoot = Math.max(room.y + doorH + 40, maxFoot);
			const y = snap(Math.max(room.y + 40, maxFoot - doorH));
			return {
				x: dir === 'left' ? room.x : room.x + room.w,
				y: y,
				w: 8,
				h: doorH,
				foot: maxFoot,
			};
		}
		function ensureDoorPad(room, dir, footY){
			const walk = walkY(room);
			if(room.noDoorPads && footY >= walk - 80) return;
			const padW = 200;
			const inward = dir === 'left' ? 1 : -1;
			function addPad(px, py){
				for(let i = 0; i < platforms.length; i++){
					const p = platforms[i];
					if(p.roomId !== room.id || p._gone) continue;
					if(p.x + p.w > px + 20 && p.x < px + padW - 20 && Math.abs(p.y - py) < 28) return;
				}
				platforms.push({
					x: snap(px), y: snap(py), w: snap(padW), h: TILE,
					kind:'static', roomId: room.id, landing:true,
				});
			}
			const baseX = dir === 'left' ? room.x + 8 : room.x + room.w - padW - 8;
			addPad(baseX, footY - 8);
			if(room._wetFloor || room.lavaLake) return;
			const gap = walk - footY;
			if(gap > 170){
				const steps = gap > 320 ? 2 : 1;
				for(let s = 1; s <= steps; s++){
					addPad(baseX + inward * s * 70, footY - 8 + gap * (s / (steps + 1)));
				}
			}
		}
		function placeSideDoor(room, dir){
			const ex = room.exits && room.exits[dir];
			if(!ex || (dir !== 'left' && dir !== 'right')) return;
			const A = sideDoorRect(room, dir);
			ex.y = A.y - room.y;
			ex.h = A.h;
			ex.seat = 'mid';
			ensureDoorPad(room, dir, A.foot);
			for(let i = 0; i < decorations.length; i++){
				const d = decorations[i];
				if(d && d.type === 'doorway' && d.roomId === room.id && d.dir === dir){
					d.y = A.y - 12;
					d.h = A.h + 24;
				}
			}
		}
		function placeAllSideDoors(){
			for(let r = 0; r < rooms.length; r++){
				placeSideDoor(rooms[r], 'left');
				placeSideDoor(rooms[r], 'right');
			}
		}
		function avoidFluidDir(room, dir){
			if(dir === 'left' || dir === 'right'){
				placeSideDoor(room, dir);
				return dir;
			}
			if(dir === 'bottom' && room.exits && room.exits.bottom){
				const ex = room.exits.bottom;
				const bw = ex.w || 240;
				const want = room.x + (ex.x != null ? ex.x : room.w / 2 - 120);
				const x = dryHatchX(room, want, bw);
				if(!hatchIsWet(room, x, bw)) room.exits.bottom.x = x - room.x;
			}
			return dir;
		}

		function carve(x, y, w, h){
			x = Math.max(40, snap(x));
			y = Math.max(0, snap(y));
			w = Math.max(TILE * 3, snap(Math.min(w, WORLD_W - x - 40)));
			h = Math.max(TILE * 3, snap(h));
			const c = { x:x, y:y, w:w, h:h };
			corridors.push(c);
			return c;
		}

		const placed = Object.create(null);
		const occ = [];
		const dryHalls = [];

		function aabbHit(a, b, pad){
			pad = pad == null ? ROOM_PAD : pad;
			return a.x < b.x + b.w + pad && a.x + a.w + pad > b.x && a.y < b.y + b.h + pad && a.y + a.h + pad > b.y;
		}
		function blocked(x, y, w, h, pad){
			if(x < 40 || x + w > WORLD_W - 40 || y < KH) return true;
			const box = { x:x, y:y, w:w, h:h };
			for(const r of occ){
				const p = r.apron ? 16 : (pad == null ? ROOM_PAD : pad);
				if(aabbHit(box, r, p)) return true;
			}
			return false;
		}
		function markOcc(x, y, w, h, apron){
			occ.push({ x:x, y:y, w:w, h:h, apron: !!apron });
		}
		function markFloorApron(room, exits){
			const ay = snap(room.y + room.h);
			const ah = APRON_H;
			const ax = snap(room.x - 40);
			const aw = snap(room.w + 80);
			if(exits && exits.bottom){
				const hx = snap(room.x + (exits.bottom.x != null ? exits.bottom.x : room.w / 2 - 100));
				const hw = snap(Math.max(exits.bottom.w || 200, 200));
				const leftW = Math.max(40, hx - 48 - ax);
				const rightX = snap(hx + hw + 48);
				markOcc(ax, ay, leftW, ah, true);
				if(rightX < ax + aw) markOcc(rightX, ay, ax + aw - rightX, ah, true);
			} else {
				markOcc(ax, ay, aw, ah, true);
			}
			if(exits && exits.top){
				const hx = snap(room.x + (exits.top.x != null ? exits.top.x : room.w / 2 - 100));
				const hw = snap(Math.max(exits.top.w || 200, 200));
				const cy = snap(room.y - APRON_H);
				if(cy >= KH){
					const leftW = Math.max(40, hx - 48 - ax);
					markOcc(ax, cy, leftW, APRON_H, true);
					const rightX = snap(hx + hw + 48);
					if(rightX < ax + aw) markOcc(rightX, cy, ax + aw - rightX, APRON_H, true);
				}
			} else {
				const cy = snap(room.y - APRON_H);
				if(cy >= KH) markOcc(ax, cy, aw, APRON_H, true);
			}
		}
		function findFree(prefX, prefY, w, h, axis, pad){
			const step = 200;
			pad = pad == null ? ROOM_PAD : pad;
			prefX = snap(prefX); prefY = snap(Math.max(KH, prefY));
			for(let i = 0; i < 50; i++){
				let x = prefX, y = prefY;
				if(axis === 'right') x += i * step;
				else if(axis === 'left') x -= i * step;
				else if(axis === 'down') y += i * step;
				else if(axis === 'up') y -= i * step;
				x = snap(x); y = snap(Math.max(KH, y));
				if(axis === 'right' && x < prefX) continue;
				if(axis === 'left' && x > prefX) continue;
				if(axis === 'down' && y < prefY) continue;
				if(axis === 'up' && y > prefY) continue;
				if(!blocked(x, y, w, h, pad)) return { x:x, y:y };
			}
			const jogs = [0, 200, -200, 320, -320, 480, -480, 640, -640, 960, -960];
			for(let i = 0; i < 40; i++){
				let x = prefX, y = prefY;
				if(axis === 'right') x += i * step;
				else if(axis === 'left') x -= i * step;
				else if(axis === 'down') y += i * step;
				else if(axis === 'up') y -= i * step;
				for(const jog of jogs){
					const x2 = snap(x + ((axis === 'down' || axis === 'up') ? jog : 0));
					const y2 = snap(y + ((axis === 'left' || axis === 'right') ? jog : 0));
					if(y2 < KH) continue;
					if(axis === 'right' && x2 < prefX) continue;
					if(axis === 'left' && x2 > prefX) continue;
					if(axis === 'down' && y2 < prefY) continue;
					if(axis === 'up' && y2 > prefY) continue;
					if(!blocked(x2, y2, w, h, pad)) return { x:x2, y:y2 };
				}
			}
			const rings = [0, 240, 480, 720, 960, 1200, 1600];
			const dirs = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
			for(let r = 0; r < rings.length; r++){
				for(let d = 0; d < dirs.length; d++){
					const x2 = snap(prefX + dirs[d][0] * rings[r]);
					const y2 = snap(Math.max(KH, prefY + dirs[d][1] * rings[r]));
					if(x2 < 40 || x2 + w > WORLD_W - 40) continue;
					if(!blocked(x2, y2, w, h, pad)) return { x:x2, y:y2 };
				}
			}
			return null;
		}

		function normalizeExits(tpl){
			const src = tpl.exits || {};
			const exits = {};
			const climb = !!tpl.climbExits;
			for(const dir of ['left', 'right']){
				if(!src[dir]) continue;
				const e = Object.assign({}, src[dir]);
				e.h = Math.max(e.h || 160, 200);
				if(climb) e.seat = 'mid';
				exits[dir] = e;
			}
			if(src.top) exits.top = Object.assign({}, src.top, { w: Math.max(src.top.w || 160, 240) });
			if(src.bottom) exits.bottom = Object.assign({}, src.bottom, { w: Math.max(src.bottom.w || 160, 240) });
			return exits;
		}

		function sectionDress(room, section){
			const floor = walkY(room);
			const combat = room.kind === 'combat' || room.kind === 'elite' || room.kind === 'eliteChamber' || room.kind === 'risk' || room.kind === 'trial';
			const torchY = Math.max(room.y + 48, floor - 200);
			decorations.push({ type:'torch', x:room.x + 2, y:torchY, side:'left', _on:'wall', _fireArt:true });
			decorations.push({ type:'torch', x:room.x + room.w - 28, y:torchY, side:'right', _on:'wall', _fireArt:true });
			if(!combat){
				decorations.push({ type:'stalactite', x:room.x + room.w * 0.35, y:room.y + 4, h:80, hang:true, _on:'ceil', _fireArt:true });
			}
			if(!combat && !room._wetFloor && !room.lavaLake){
				decorations.push({ type:'rubble', x:room.x + 90, y:floor + (room.kind === 'start' ? 14 : 0), w:80, h:80, _on:'floor', _fireArt:true });
			}
			if(section >= 3 && !combat){
				decorations.push({ type:'pipe', x:room.x + room.w * 0.82, y:room.y + 8, h:200, hang:true, _on:'ceil', _fireArt:true });
			}
			if(section >= 4 && !combat){
				decorations.push({ type:'vein', x:room.x + 8, y:room.y + 40, h:Math.max(80, floor - room.y - 80), side:'left', _on:'wall', _fireArt:true });
			}
		}

		function holeAt(room, x, w){
			const holes = room.floorHoles || [];
			for(let i = 0; i < holes.length; i++){
				if(x + w > holes[i].x - 6 && x < holes[i].x + holes[i].w + 6) return true;
			}
			return false;
		}
		function putFire(room, type, x, opts){
			opts = opts || {};
			const w = opts.w || 80, h = opts.h || 80;
			if(!opts.hang && holeAt(room, x, w)) return;
			decorations.push({
				type: type,
				x: snap(x),
				y: opts.hang ? room.y + (opts.yOff || 8) : walkY(room) + (room.kind === 'start' ? 14 : 0),
				w: w, h: h,
				hang: !!opts.hang,
				_fireArt: true,
			});
		}
		function kindDress(room){
			const k = room.kind;
			const L = room.x + 80;
			const R = room.x + room.w - 160;
			const mid = room.x + room.w * 0.5;
			if(k === 'furnace' || k === 'warden'){
				putFire(room, 'fireFurnace', R - 40, { w:160, h:160 });
				putFire(room, 'fireAnvil', L + 20, { w:160, h:160 });
				putFire(room, 'fireLavaPipe', room.x + 16, { w:160, h:160, hang:true, yOff:16 });
				putFire(room, 'fireLavaPipe', room.x + room.w - 56, { w:160, h:160, hang:true, yOff:16 });
				putFire(room, 'fireBrazier', mid - 80, { w:160, h:160 });
			}
			if(k === 'stabilize' || k === 'magmaSiphon'){
				putFire(room, 'fireLavaPipe', room.x + 16, { w:160, h:160, hang:true, yOff:16 });
				putFire(room, 'fireLavaPipe', room.x + room.w - 56, { w:160, h:160, hang:true, yOff:16 });
			}
			if(k === 'shrine' || k === 'secretShrine' || k === 'secretCave' || k === 'cache' || k === 'vault'){
				putFire(room, 'fireAltar', mid - 80, { w:160, h:160 });
				putFire(room, 'fireChain', L + 40, { w:160, h:160, hang:true });
				putFire(room, 'fireChain', R, { w:160, h:160, hang:true });
			}
			if(k === 'crossing' || k === 'river' || k === 'ascent' || k === 'descent'){
				if(!room._wetFloor && !room.lavaLake){
					putFire(room, 'fireBasalt', L, { w:240, h:240 });
				}
			}
			if(k === 'flood' || k === 'eruption' || k === 'collapseEvent'){
				putFire(room, 'fireContainment', mid + 80, { w:240, h:240 });
			}
			if(k === 'combat' || k === 'elite' || k === 'eliteChamber' || k === 'risk' || k === 'trial'){
				let raisedPlat = false;
				for(let i = 0; i < platforms.length; i++){
					const p = platforms[i];
					if(p.roomId === room.id && p.y < walkY(room) - 120){ raisedPlat = true; break; }
				}
				if(!room._wetFloor && !room.lavaLake && !raisedPlat){
					putFire(room, 'fireDebris', R, { w:240, h:240 });
					putFire(room, 'fireDebris', L, { w:240, h:240 });
				}
			}
			if(k === 'start' || k === 'cooling' || k === 'preboss'){
				putFire(room, 'fireBrazier', L + 40, { w:240, h:240 });
			}
			if(k === 'boss'){
				putFire(room, 'fireFurnace', room.x + 80, { w:160, h:160 });
				putFire(room, 'fireBasalt', room.x + room.w - 200, { w:160, h:160 });
			}
			if(k === 'ashFork' || k === 'forgeFork'){
				putFire(room, 'fireAnvil', mid - 80, { w:160, h:160 });
				putFire(room, 'fireLavaPipe', L, { w:160, h:160, hang:true, yOff:16 });
			}
		}

		function stampDoorway(room, dir, ex){
			if(dir === 'left' || dir === 'right'){
				const x = dir === 'left' ? room.x - 8 : room.x + room.w - 16;
				decorations.push({
					type:'doorway', dir:dir, x:x, y:room.y + ex.y - 12, w:24, h:ex.h + 24, roomId:room.id,
				});
			} else {
				const x = room.x + (ex.x != null ? ex.x : room.w / 2 - 120);
				const y = dir === 'top' ? room.y - 8 : room.y + room.h - 16;
				decorations.push({ type:'doorway', dir:dir, x:x, y:y, w:ex.w || 240, h:20, roomId:room.id });
			}
		}

		function stampTemplate(tpl, wx, wy, node){
			const exits = normalizeExits(tpl);
			const c = carve(wx, wy, tpl.w, shellH(tpl));
			const room = {
				id: rooms.length,
				kind: tpl.kind,
				label: tpl.label || tpl.kind,
				objective: tpl.objective || '',
				x: c.x, y: c.y, w: c.w, h: c.h,
				depth: node.section || 1,
				section: node.section || 1,
				optional: !!(node.optional || tpl.optional),
				secret: !!tpl.secret,
				noCombat: !!tpl.noCombat,
				elite: !!tpl.elite,
				hot: !!node.hot,
				coolRoom: !!tpl.coolRoom,
				category: tpl.category || 'required',
				exits: exits,
				doorLabels: tpl.doorLabels || {},
				doorLabel: tpl.doorLabel || '',
				cleared: false,
				locked: true,
				variant: tpl.variant || '',
				surviveFrames: tpl.surviveFrames || 0,
				surviveLeft: tpl.surviveFrames || 0,
				trial: tpl.trial || null,
				templateId: tpl.id,
				nodeId: node.id,
				climbExits: !!tpl.climbExits,
				usedExits: {},
				extraOpenings: [],
				floorHoles: [],
				noDoorPads: !!tpl.noDoorPads,
				raisedFloor: tpl.raisedFloor || 0,
				lavaLake: !!tpl.lavaLake,
				_dryBasin: !!(tpl.climbExits || tpl.kind === 'ascent' || tpl.kind === 'descent' || tpl.kind === 'ashFork'),
				_wetFloor: !!(tpl.lavaLake || (tpl.lavaRects && tpl.lavaRects.length)),
			};
			markOcc(c.x, c.y, c.w, c.h);
			markFloorApron(room, exits);
			if(tpl.kind === 'start' || tpl.kind === 'preboss' || tpl.kind === 'boss' || tpl.kind === 'ashFork' || tpl.kind === 'forgeFork' || tpl.kind === 'cache' || tpl.kind === 'cooling' || tpl.kind === 'shrine' || tpl.kind === 'secretCave' || tpl.kind === 'secretShrine'){
				room.cleared = true;
				room.locked = false;
			}
			if(room.optional && tpl.kind !== 'warden' && tpl.kind !== 'elite' && tpl.kind !== 'eliteChamber' && tpl.kind !== 'vault' && tpl.kind !== 'trial' && tpl.kind !== 'secretElite'){
				room.locked = false;
			}
			rooms.push(room);
			placed[node.id] = room;
			sectionDress(room, room.section);
			if(tpl.decors){
				for(const d of tpl.decors){
					const nx = room.x + (d.x || 0);
					const ny = d.yFromFloor != null ? (walkY(room) - (d.yFromFloor || 0)) : room.y + (d.y || 0);
					decorations.push(Object.assign({}, d, { x: nx, y: ny }));
				}
			}
			/* Doorway sprites stay off used connectors and unused exits. */

			const floor = room.y + room.h;
			const walk = walkY(room);
			if(tpl.pits){
				for(const pit of tpl.pits){
					const px = snap(room.x + pit.x);
					const pw = snap(pit.w);
					const pd = snap(Math.max(80, pit.depth));
					const py = snap(room.y + room.h);
					const pitBox = { x:px, y:py, w:pw, h:pd };
					let pitBlocked = py < 0 || px < 40 || px + pw > WORLD_W - 40;
					if(!pitBlocked){
						for(const r of occ){
							if(r.x === room.x && r.y === room.y && r.w === room.w) continue;
							if(aabbHit(pitBox, r, 40)){ pitBlocked = true; break; }
						}
					}
					if(pitBlocked) continue;
					const p = carve(px, py, pw, pd);
					markOcc(p.x, p.y, p.w, p.h);
					room.floorHoles.push({ x:p.x, w:p.w });
					room.pitFloors = room.pitFloors || [];
					room.pitFloors.push({ x:p.x, y:p.y + p.h - 40, w:p.w, h:48 });
					if(tpl.lavaLake){
						const ly = walk - LAVA_ABOVE - LAVA_THICK;
						const lx = p.x + 4;
						const lw = p.w - 8;
						if(lw > 40){
							decorations.push({ type:'lava', x:lx, y:ly, w:lw, h:LAVA_ABOVE + LAVA_THICK, _env:true, bed:true, surface:true, groundY:walk });
							decorations.push({ type:'lavaWell', x:lx, y:walk, w:lw, h:Math.max(48, p.h - 40), roomId: room.id });
						}
					} else {
						decorations.push({ type:'lava', x:p.x + 4, y:p.y + p.h - LAVA_ABOVE - LAVA_THICK, w:p.w - 8, h:LAVA_ABOVE + LAVA_THICK, _env:true, bed:true, groundY:p.y + p.h });
					}
				}
			}
			if(tpl.lavaLake && !(tpl.pits && tpl.pits.length) && !(tpl.lavaRects && tpl.lavaRects.length)){
				const lx = room.x + 8;
				const lw = room.w - 16;
				decorations.push({ type:'lava', x:lx, y:walk - LAVA_ABOVE - LAVA_THICK, w:lw, h:LAVA_ABOVE + LAVA_THICK, _env:true, bed:true, surface:true, groundY:walk });
			}
			if(tpl.ledge) room._ledge = tpl.ledge;
			if(tpl.pillars){
				room.pillars = tpl.pillars.map(p => ({
					x: room.x + p.x,
					y: walk - (p.yFromFloor || 0) - (p.h || 200),
					w: p.w, h: p.h || 200,
				}));
				for(const p of room.pillars){
					platforms.push({ x:snap(p.x), y:snap(p.y), w:snap(p.w), h:p.h, kind:'static', roomId:room.id, pillar:true });
				}
			}
			if(tpl.cracks){
				room.cracks = tpl.cracks.map(c => ({ x: room.x + c.x, y: walk - 8, w: c.w, h: 16 }));
			}
			if(tpl.vents){
				room.vents = tpl.vents.map(v => ({ x: room.x + v.x, y: walk - 8, w: v.w || 70, h: 18 }));
			}
			room.authoredArena = !!tpl.authoredArena;

			for(const p of (tpl.platforms || [])){
				if(!dungeonShouldKeepPlatform(tpl, p)) continue;
				const plat = {
					x: snap(room.x + p.x),
					y: snap(walk - (p.yFromFloor || 0)),
					w: snap(p.w), h: p.h || TILE,
					kind: p.kind || 'static',
					roomId: room.id,
					life: p.life,
					axis: p.axis, dist: p.dist, spd: p.spd,
					radius: p.radius, ang: p.ang,
					raftDir: p.raftDir,
					_conveyor: p._conveyor,
					_bridge: p._bridge,
					perch: !!p.perch,
					central: !!p.central,
					arenaSection: p.arenaSection || null,
				};
				if(plat.kind === 'move' || plat.kind === 'raft' || plat.kind === 'orbit'){
					plat.homeX = plat.x; plat.homeY = plat.y;
				}
				platforms.push(plat);
				if(plat.kind === 'static' && (p.yFromFloor || 0) >= 120 && (tpl.kind === 'ashFork' || tpl.kind === 'forgeFork')){
					const rise = p.yFromFloor || 200;
					decorations.push({
						type:'column',
						x: snap(plat.x + plat.w * 0.5 - 20),
						y: walk,
						h: Math.round(rise / 80) * 80 || 240,
						_fireArt: true,
						_on:'floor',
						_pillarUp: true,
					});
				}
			}

			for(const hz of (tpl.hazards || [])){
				const h = Object.assign({ roomId: room.id, element:'fire' }, hz);
				if(h.type === 'vent'){
					h.x = room.x + hz.x + 20;
					h.y = walk - (hz.yFromFloor || 8);
					h.columnH = Math.max(hz.columnH || 200, 280);
					h.mode = 'geyser';
				} else if(h.type === 'fall'){
					h.x = room.x + hz.x;
					h.y = room.y + (hz.y || 16);
					h.h = hz.hFromCeil != null ? hz.hFromCeil : (room.h - 70);
				} else if(h.type === 'gate'){
					h.x = snap(room.x + hz.x);
					h.y = snap(walk - (hz.yFromFloor || 0) - hz.h);
				} else if(h.type === 'channel'){
					const wallPad = 8;
					h.surfaceH = LAVA_THICK;
					h.h = LAVA_ABOVE + LAVA_THICK;
					h.y = walk - LAVA_ABOVE - LAVA_THICK;
					h.groundY = walk;
					if(hz.mode === 'geysers'){
						const mid = room.x + room.w * 0.5;
						h.left = { x: room.x + wallPad, w: Math.max(80, mid - (room.x + wallPad)) };
						h.right = { x: mid, w: Math.max(80, (room.x + room.w - wallPad) - mid) };
						h.mode = 'geysers';
						h.geyserH = hz.geyserH || 210;
						const n = hz.geyserCount || 4;
						h.geysers = [];
						const sprinkle = (side, name) => {
							for(let i = 0; i < n; i++){
								const u = n <= 1 ? 0.5 : i / (n - 1);
								const gx = side.x + 30 + u * Math.max(40, side.w - 60);
								h.geysers.push({ x: gx - 24, w: 48, columnH: h.geyserH, side: name });
							}
						};
						sprinkle(h.left, 'left');
						sprinkle(h.right, 'right');
						h.geysers = h.geysers.filter(g => {
							for(const p of platforms){
								if(p.roomId !== room.id) continue;
								if(g.x + g.w > p.x - 28 && g.x < p.x + p.w + 28) return false;
							}
							return true;
						});
					} else {
						h.left = { x: room.x + hz.left.x, w: hz.left.w };
						h.right = { x: room.x + hz.right.x, w: hz.right.w };
					}
				} else if(h.type === 'lavaBubbles'){
					const hole = room.floorHoles[0];
					h.x = hole ? hole.x + 8 : room.x + 80;
					h.w = hole ? Math.max(80, hole.w - 16) : room.w - 160;
					h.y = walk - LAVA_ABOVE - LAVA_THICK + 6;
					h.bubbles = [];
				} else if(h.type === 'rise'){
					h.x = room.x + (hz.x || 16);
					h.w = hz.w || (room.w - 32);
					h.y0 = walk - (hz.yFromFloor || 20);
					h.y1 = room.y + room.h * (hz.riseTo || 0.42);
					h.y = h.y0;
					h.active = false;
					h.armed = hz.armed !== false;
					h.vault = !!hz.vault;
				}
				hazards.push(h);
			}

			for(const lv of (tpl.lavaRects || [])){
				let x = room.x + lv.x;
				let w = lv.w;
				const minX = room.x + 8;
				const maxX = room.x + room.w - 8;
				if(x < minX){ w -= (minX - x); x = minX; }
				if(x + w > maxX) w = maxX - x;
				if(w < 40) continue;
				const shallow = (lv.yFromFloor != null && lv.yFromFloor < 80) || ((lv.h || 0) > 0 && lv.h < 60);
				if(shallow){
					const surface = lv.yFromFloor != null ? lv.yFromFloor : Math.max(16, lv.h || 16);
					decorations.push({
						type:'lava',
						x: x,
						y: walk - surface,
						w: w, h: surface,
						_env: true,
						surface: true,
						groundY: walk,
						_shallow: true,
					});
				} else {
					const h = Math.max(LAVA_THICK, lv.h || 20);
					decorations.push({
						type:'lava',
						x: x,
						y: walk - LAVA_ABOVE - h,
						w: w, h: LAVA_ABOVE + h,
						_env: true,
						surface: true,
						groundY: walk,
					});
				}
			}

			for(const it of (tpl.interactables || [])){
				const rec = {
					kind: it.kind,
					roomId: room.id,
					id: it.id || null,
					x: room.x + it.x,
					y: it.y != null ? room.y + it.y : walk - (it.yFromFloor || 80) - (it.h || 60),
					w: it.w, h: it.h,
					name: it.name, icon: it.icon, text: it.text,
					used: false,
					reusable: !!it.reusable,
					rare: !!it.rare,
					_locked: !!it._locked,
					_mainCache: !!it._mainCache,
					_lootTier: it._lootTier || null,
					_lockTag: it._lockTag || null,
					_secret: !!it._secret,
					_revealWith: it._revealWith || null,
					_mode: it._mode || null,
					_idx: it._idx,
					_color: it._color,
					want: it.want,
					faces: it.faces,
					ang: it.ang,
					lore: it.lore,
					_valveId: it._valveId,
					_state: it._state != null ? it._state : 0,
					_clue: it._clue || null,
					_nest: !!it._nest,
					_perfect: !!it._perfect,
					punch: it.punch || null,
				};
				if(it.kind === 'channelLever'){
					rec.hazardRef = hazards.find(h => h.roomId === room.id && h.type === 'channel') || null;
				}
				interactables.push(rec);
			}

			if(tpl.clearZone){
				room.clearZone = {
					x: room.x + tpl.clearZone.x,
					y: tpl.clearZone.y != null ? room.y + tpl.clearZone.y : walk - (tpl.clearZone.yFromFloor || 0) - (tpl.clearZone.h || 160),
					w: tpl.clearZone.w, h: tpl.clearZone.h,
				};
			}

			for(const sp of (tpl.spawnAnchors || [])){
				const type = sp.type || (tpl.kind === 'warden' ? 'magmaWarden' : pickEnemy(R, room.section, room.hot || hotRun));
				const x = room.x + sp.x;
				const hoverY = walk - (sp.yFromFloor || 12);
				const fromLava = type === 'fireSprite' && !!tpl.lavaLake;
				enemies.push({
					type: type,
					x: x, y: fromLava ? floor + 30 : hoverY,
					patrol: [Math.max(room.x + 40, x - 180), Math.min(room.x + room.w - 40, x + 180)],
					puzzleSeg: room.section,
					roomId: room.id,
					isMiniBoss: type === 'magmaWarden',
					_wardenDormant: type === 'magmaWarden',
					_cliff: type !== 'magmaWarden' && type !== 'flameSerpent' && type !== 'imp' && sp.yFromFloor > 40,
					_riseFrom: fromLava,
					_hoverY: hoverY,
					_dropsCore: tpl.kind === 'ashenFoundry' && (type === 'magmaGolem' || type === 'emberMage' || type === 'fireSprite'),
				});
			}

			if(tpl.kind === 'ashen' || node.hot){
				addHeatDecor(room);
			}
			kindDress(room);
			return room;
		}

		function addHeatDecor(room){
			decorations.push({ type:'crack', x:room.x + room.w * 0.2, y:walkY(room), size:36, _on:'floor', _fireArt:true });
			decorations.push({ type:'embers', x:room.x + room.w * 0.7, y:room.y + room.h * 0.35, area:360 });
		}

		function exitAnchor(room, dir){
			const ex = (room.exits && room.exits[dir]) || {};
			if(dir === 'left' || dir === 'right') return sideDoorRect(room, dir);
			if(dir === 'top') return { x: room.x + (ex.x != null ? ex.x : room.w / 2 - 120), y: room.y, w: ex.w || 240, h: 8 };
			const bw = ex.w || 240;
			const bx = dryHatchX(room, room.x + (ex.x != null ? ex.x : room.w / 2 - 120), bw);
			return { x: bx, y: room.y + room.h, w: bw, h: 8 };
		}

		/* While a connector is being carved, these two rooms are the ones it joins. */
		let linkRooms = null;
		let currentLink = null;
		/* A connector that must cross one of its own rooms' shells records that
		   penetration, so the shell reseal cannot close the route back up.
		   This adds depth through the wall it already carved — it never widens a door,
		   and third-party rooms still get sealed (no skip paths). */
		function keepOpen(room, x, y, w, h){
			if(!room) return;
			const x0 = Math.max(x, room.x - 48), x1 = Math.min(x + w, room.x + room.w + 48);
			const y0 = Math.max(y, room.y - 48), y1 = Math.min(y + h, room.y + room.h + 48);
			if(x1 <= x0 || y1 <= y0) return;
			room.extraOpenings = room.extraOpenings || [];
			room.extraOpenings.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, _keep:true });
		}
		function subtractRect(src, cut){
			const x0 = Math.max(src.x, cut.x), x1 = Math.min(src.x + src.w, cut.x + cut.w);
			const y0 = Math.max(src.y, cut.y), y1 = Math.min(src.y + src.h, cut.y + cut.h);
			if(x1 <= x0 || y1 <= y0) return [src];
			const out = [];
			if(src.x < cut.x) out.push({ x:src.x, y:src.y, w:cut.x - src.x, h:src.h });
			const rx = cut.x + cut.w;
			if(src.x + src.w > rx) out.push({ x:rx, y:src.y, w:src.x + src.w - rx, h:src.h });
			const mx = Math.max(src.x, cut.x);
			const mw = Math.min(src.x + src.w, cut.x + cut.w) - mx;
			if(mw > 0 && src.y < cut.y) out.push({ x:mx, y:src.y, w:mw, h:cut.y - src.y });
			const by = cut.y + cut.h;
			if(mw > 0 && src.y + src.h > by) out.push({ x:mx, y:by, w:mw, h:src.y + src.h - by });
			const kept = [];
			for(let i = 0; i < out.length; i++){
				if(out[i].w >= 32 && out[i].h >= 32) kept.push(out[i]);
			}
			return kept;
		}
		function clipHallToGaps(x, y, w, h){
			let rects = [{ x:x, y:y, w:w, h:h }];
			for(let i = 0; i < rooms.length; i++){
				const room = rooms[i];
				if(!room) continue;
				const inner = { x: room.x + 10, y: room.y + 10, w: room.w - 20, h: room.h - 20 };
				const next = [];
				for(let n = 0; n < rects.length; n++){
					const bits = subtractRect(rects[n], inner);
					for(let b = 0; b < bits.length; b++) next.push(bits[b]);
				}
				rects = next;
				if(!rects.length) break;
			}
			return rects;
		}
		function carveHall(x, y, w, h){
			const pieces = clipHallToGaps(x, y, w, h);
			let last = null;
			for(let i = 0; i < pieces.length; i++){
				const p = pieces[i];
				if(p.w < 32 || p.h < 32) continue;
				const c = carve(p.x, p.y, p.w, p.h);
				c._hall = true;
				if(currentLink) currentLink.halls.push(c);
				dryHalls.push({ x:c.x, y:c.y, w:c.w, h:c.h });
				last = c;
			}
			return last;
		}
		function horiz(x0, x1, y, h){
			const left = snap(Math.min(x0, x1));
			const right = snap(Math.max(x0, x1));
			return carveHall(left, snap(y), Math.max(80, right - left), h || HALL_H);
		}
		function vert(x, y0, y1, w){
			const top = snap(Math.min(y0, y1));
			const bot = snap(Math.max(y0, y1));
			return carveHall(snap(x), top, w || 200, Math.max(80, bot - top));
		}
		function openExit(room, dir){
			if(!room || !dir) return;
			room.usedExits = room.usedExits || {};
			room.usedExits[dir] = true;
			const A = exitAnchor(room, dir);
			room.extraOpenings = room.extraOpenings || [];
			const doorH = A.h || DOOR_H;
			const doorW = A.w || 240;
			const depth = throatDepth();
			const openY = snap(A.y);
			/* Wall-only punch. Do not carve a pit through the room floor. */
			if(dir === 'left'){
				room.extraOpenings.push({ x: room.x - 48, y: openY, w: 48 + depth, h: doorH, _door:true, _dir:dir });
			}
			if(dir === 'right'){
				room.extraOpenings.push({ x: room.x + room.w - depth, y: openY, w: depth + 48, h: doorH, _door:true, _dir:dir });
			}
			if(dir === 'top'){
				room.extraOpenings.push({ x: snap(A.x), y: room.y - 48, w: doorW, h: 48 + depth, _door:true, _dir:dir });
			}
			if(dir === 'bottom'){
				if(hatchIsWet(room, A.x, doorW)){
					/* Keep the flooded walk intact. The shaft starts under the shell. */
					room.extraOpenings.push({ x: snap(A.x), y: room.y + room.h, w: doorW, h: depth + 48, _door:true, _dir:dir });
				} else {
					room.extraOpenings.push({ x: snap(A.x), y: room.y + room.h - depth, w: doorW, h: depth + 48, _door:true, _dir:dir });
				}
			}
		}
		function lastDoor(room){
			const ops = room && room.extraOpenings;
			if(!ops) return null;
			for(let i = ops.length - 1; i >= 0; i--){
				if(ops[i] && ops[i]._door) return ops[i];
			}
			return ops.length ? ops[ops.length - 1] : null;
		}
		function addLock(a, b, x, y, w, h, opt){
			if(!opt || !opt.lock || a.optional) return;
			const gate = {
				x:x, y:y, w:w, h:h, fromRoom: a.id, toRoom: b.id, roomId: a.id,
				fromOpen: currentLink ? currentLink.fromOpen : lastDoor(a),
				toOpen: currentLink ? currentLink.toOpen : lastDoor(b),
				optional: !!(opt && opt.optional),
			};
			gates.push(gate);
			a.outGates = a.outGates || [];
			a.outGates.push(gate);
			if(currentLink) currentLink.gate = gate;
		}

		function gapCol(a, fromDir, b, toDir){
			if(fromDir === 'right' && toDir === 'left' && b.x > a.x + a.w + 16){
				return snap((a.x + a.w + b.x) / 2 - 80);
			}
			if(fromDir === 'left' && toDir === 'right' && a.x > b.x + b.w + 16){
				return snap((b.x + b.w + a.x) / 2 - 80);
			}
			if(fromDir === 'right') return snap(a.x + a.w + 8);
			return snap(a.x - 168);
		}
		function connectSide(a, fromDir, b, toDir, opt){
			const A = exitAnchor(a, fromDir);
			const B = exitAnchor(b, toDir);
			const hA = A.h || HALL_H, hB = B.h || HALL_H;
			let yA = snap(A.y), yB = snap(B.y);
			if(Math.abs(yA - yB) <= 40){
				yA = yB = snap(Math.min(yA, yB));
			}
			const aOut = fromDir === 'right' ? a.x + a.w : a.x;
			const bIn = toDir === 'left' ? b.x : b.x + b.w;
			const lockH = Math.max(hA, hB);

			if(fromDir === 'right' && toDir === 'left' && b.x >= a.x + a.w - 8){
				if(yA === yB){
					horiz(a.x + a.w, b.x, yA, hA);
				} else {
					const col = Math.max(a.x + a.w + 8, Math.min(gapCol(a, fromDir, b, toDir), b.x - 168));
					horiz(a.x + a.w, col + 160, yA, hA);
					vert(col, yA, yB + hB, 160);
					horiz(col, b.x, yB, hB);
				}
				addLock(a, b, a.x + a.w - 8, Math.min(yA, yB), 48, lockH, opt);
				return true;
			}
			if(fromDir === 'left' && toDir === 'right' && a.x >= b.x + b.w - 8){
				if(yA === yB){
					horiz(b.x + b.w, a.x, yA, hA);
				} else {
					const col = Math.max(b.x + b.w + 8, Math.min(gapCol(a, fromDir, b, toDir), a.x - 168));
					horiz(b.x + b.w, col + 160, yB, hB);
					vert(col, yA, yB + hB, 160);
					horiz(col, a.x, yA, hA);
				}
				addLock(a, b, a.x - 8, Math.min(yA, yB), 48, lockH, opt);
				return true;
			}

			const col = gapCol(a, fromDir, b, toDir);
			horiz(aOut, col + 160, yA, hA);
			vert(col, yA, yB + hB, 160);
			horiz(bIn, col + 160, yB, hB);
			addLock(a, b, fromDir === 'right' ? a.x + a.w - 8 : a.x - 8, Math.min(yA, yB), 48, lockH, opt);
			return true;
		}

		function connectMixed(a, fromDir, b, toDir, opt){
			const A = exitAnchor(a, fromDir);
			const B = exitAnchor(b, toDir);
			const h = HALL_H;
			const aBelow = a.y >= b.y + b.h - 8;
			const bBelow = b.y >= a.y + a.h - 8;

			if((fromDir === 'left' || fromDir === 'right') && (toDir === 'left' || toDir === 'right') &&
				!(b.x >= a.x + a.w - 8 || a.x >= b.x + b.w - 8)){
				const hA = A.h || HALL_H, hB = B.h || HALL_H;
				const aMouth = fromDir === 'right' ? a.x + a.w : a.x;
				const bMouth = toDir === 'left' ? b.x : b.x + b.w;
				const outCol = fromDir === 'right' ? snap(a.x + a.w + 8) : snap(a.x - 168);
				const destCol = toDir === 'left' ? snap(b.x - 168) : snap(b.x + b.w + 8);
				horiz(aMouth, outCol + 160, A.y, hA);
				if(b.y >= a.y + a.h + 40){
					const midY = snap(Math.max(a.y + a.h + 24, Math.min((a.y + a.h + b.y) / 2, b.y - hB - 24)));
					vert(outCol, A.y, midY + hA, 160);
					horiz(Math.min(outCol, destCol), Math.max(outCol, destCol) + 160, midY, Math.max(hA, hB));
					vert(destCol, midY, B.y + hB, 160);
					horiz(destCol, bMouth, B.y, hB);
				} else if(a.y >= b.y + b.h - 8){
					const midY = snap(Math.max(b.y + b.h + 24, Math.min((b.y + b.h + a.y) / 2, a.y - hA - 24)));
					vert(outCol, midY, A.y + hA, 160);
					horiz(Math.min(outCol, destCol), Math.max(outCol, destCol) + 160, midY, Math.max(hA, hB));
					vert(destCol, B.y, midY + hB, 160);
					horiz(destCol, bMouth, B.y, hB);
				} else {
					vert(outCol, A.y, B.y + hB, 160);
					horiz(outCol, bMouth, B.y, hB);
				}
				addLock(a, b, fromDir === 'right' ? a.x + a.w - 8 : a.x - 8, Math.min(A.y, B.y), 48, Math.max(hA, hB), opt);
				return true;
			}

			if((fromDir === 'bottom' || fromDir === 'top') && (toDir === 'bottom' || toDir === 'top') && (aBelow || bBelow)){
				const topRoom = aBelow ? b : a;
				const botRoom = topRoom === a ? b : a;
				const topEx = exitAnchor(topRoom, topRoom === a ? fromDir : toDir);
				const botEx = exitAnchor(botRoom, botRoom === a ? fromDir : toDir);
				const ax = snap(topEx.x);
				const bx = snap(botEx.x);
				const top = topRoom.y + topRoom.h;
				const bot = botRoom.y;
				if(Math.abs(ax - bx) < 80){
					vert(ax, top, bot, 200);
				} else {
					const midY = snap(top + Math.max(80, Math.min(200, (bot - top) * 0.4)));
					vert(ax, top, midY + h, 200);
					horiz(ax, bx + 200, midY, h);
					vert(bx, midY, bot, 200);
				}
				addLock(a, b, ax, top - 8, 240, 88, opt);
				return true;
			}

			function dropIntoSideDoor(from, hatchX, dest, side, destDoorY, colW){
				const destY = snap(destDoorY);
				const gapTop = from.y + from.h;
				const gapBot = dest.y;
				const overRoom = hatchX > dest.x - 120 && hatchX < dest.x + dest.w + 120;
				const mouth = side === 'left' ? dest.x : dest.x + dest.w;
				if(!overRoom){
					vert(hatchX, gapTop, destY + h, colW);
					horiz(hatchX, mouth, destY, h);
					return;
				}
				const colX = side === 'left' ? snap(dest.x - 200) : snap(dest.x + dest.w);
				const midY = snap(Math.max(gapTop + 40, Math.min(gapBot - h - 40, (gapTop + gapBot) / 2 - h / 2)));
				vert(hatchX, gapTop, midY + h, colW);
				horiz(Math.min(hatchX, colX), Math.max(hatchX, colX) + colW, midY, h);
				vert(colX, midY, destY + h, colW);
				horiz(colX, mouth, destY, h);
			}

			if(fromDir === 'bottom' && (a.kind === 'elite' || a.kind === 'combat' || a.kind === 'eliteChamber') && b.y >= a.y + a.h - 8){
				const dropX = snap(A.x);
				const destY = snap(B.y);
				if(toDir === 'top'){
					vert(dropX, a.y + a.h, destY + h, 220);
					vert(dropX, destY, b.y, 220);
				} else {
					dropIntoSideDoor(a, dropX, b, toDir, destY, 220);
				}
				addLock(a, b, dropX, a.y + a.h - 40, 240, 88, opt);
				return true;
			}

			if(fromDir === 'bottom' && (toDir === 'left' || toDir === 'right') && b.y >= a.y + a.h - 8){
				const dropX = snap(A.x);
				dropIntoSideDoor(a, dropX, b, toDir, B.y, 200);
				addLock(a, b, dropX, a.y + a.h - 40, 240, 88, opt);
				return true;
			}
			if(toDir === 'bottom' && (fromDir === 'left' || fromDir === 'right') && a.y >= b.y + b.h - 8){
				const dropX = snap(B.x);
				dropIntoSideDoor(b, dropX, a, fromDir, A.y, 200);
				addLock(a, b, fromDir === 'right' ? a.x + a.w - 8 : a.x - 8, A.y, 48, h, opt);
				return true;
			}

			if(fromDir === 'top' && (toDir === 'left' || toDir === 'right') && a.y >= b.y + b.h - 8){
				const upX = snap(A.x);
				const midY = snap(a.y - h - 40);
				const sideX = toDir === 'left' ? b.x - 160 : b.x + b.w;
				vert(upX, midY, a.y, 200);
				horiz(upX, sideX + 160, midY, h);
				vert(sideX, B.y, midY + h, 160);
				horiz(sideX, toDir === 'left' ? b.x : b.x + b.w, B.y, h);
				addLock(a, b, upX, a.y - 8, 200, 48, opt);
				return true;
			}
			if(toDir === 'top' && (fromDir === 'left' || fromDir === 'right') && b.y >= a.y + a.h - 8){
				const upX = snap(B.x);
				const midY = snap(a.y + a.h + 40);
				const sideX = fromDir === 'right' ? a.x + a.w : a.x - 160;
				const aMouth = fromDir === 'left' ? a.x : a.x + a.w;
				horiz(aMouth, sideX + 160, A.y, h);
				vert(sideX, A.y, midY + h, 160);
				horiz(sideX, upX + 200, midY, h);
				vert(upX, midY, b.y, 200);
				addLock(a, b, fromDir === 'right' ? a.x + a.w - 8 : a.x - 8, A.y, 48, h, opt);
				return true;
			}

			if(b.x >= a.x + a.w - 8){
				if(Math.abs(A.y - B.y) <= 40){
					horiz(a.x + a.w, b.x, snap(Math.min(A.y, B.y)), Math.max(A.h || HALL_H, B.h || HALL_H));
				} else {
					horiz(a.x + a.w, b.x, A.y, A.h || HALL_H);
					vert(b.x - 8, A.y, B.y + (B.h || HALL_H), 160);
					horiz(b.x - 8, b.x, B.y, B.h || HALL_H);
				}
			} else if(a.x >= b.x + b.w - 8){
				if(Math.abs(A.y - B.y) <= 40){
					horiz(b.x + b.w, a.x, snap(Math.min(A.y, B.y)), Math.max(A.h || HALL_H, B.h || HALL_H));
				} else {
					horiz(b.x + b.w, a.x, B.y, B.h || HALL_H);
					vert(a.x - 8, A.y, B.y + (B.h || HALL_H), 160);
					horiz(a.x - 8, a.x, A.y, A.h || HALL_H);
				}
			} else {
				const hA = A.h || HALL_H, hB = B.h || HALL_H;
				const aMouth = fromDir === 'left' ? a.x : (fromDir === 'right' ? a.x + a.w : A.x);
				const bMouth = toDir === 'left' ? b.x : (toDir === 'right' ? b.x + b.w : B.x);
				const col = snap(fromDir === 'left' || toDir === 'right'
					? Math.min(a.x, b.x) - 168
					: Math.max(a.x + a.w, b.x + b.w) + 8);
				horiz(aMouth, col + 160, A.y, hA);
				vert(col, A.y, B.y + hB, 160);
				horiz(col, bMouth, B.y, hB);
			}
			return true;
		}

		function claimExit(room, prefer){
			if(!room) return prefer;
			room._claimed = room._claimed || {};
			if(prefer && !room._claimed[prefer]){
				room._claimed[prefer] = true;
				return prefer;
			}
			const order = ['right', 'left', 'bottom', 'top'];
			for(let i = 0; i < order.length; i++){
				const d = order[i];
				if(room._claimed[d]) continue;
				room._claimed[d] = true;
				if(!room.exits) room.exits = {};
				if(!room.exits[d]){
					if(d === 'left' || d === 'right') room.exits[d] = { y: Math.round((room.h - 200) * 0.62), h: 200 };
					else room.exits[d] = { x: Math.round(room.w / 2 - 110), w: 220 };
				}
				return d;
			}
			if(prefer) room._claimed[prefer] = true;
			return prefer;
		}
		function connectRooms(a, fromDir, b, toDir, opt){
			linkRooms = [a, b];
			try {
				fromDir = claimExit(a, fromDir);
				toDir = claimExit(b, toDir);
				avoidFluidDir(a, fromDir);
				avoidFluidDir(b, toDir);
				openExit(a, fromDir);
				openExit(b, toDir);
				currentLink = {
					fromId: a.id, toId: b.id, fromDir: fromDir, toDir: toDir,
					fromOpen: lastDoor(a), toOpen: lastDoor(b),
					halls: [], optional: !!(opt && opt.optional),
				};
				links.push(currentLink);
				const alignedSide = (fromDir === 'left' || fromDir === 'right') && (toDir === 'left' || toDir === 'right') &&
					(b.x >= a.x + a.w - 8 || a.x >= b.x + b.w - 8);
				if(alignedSide) return connectSide(a, fromDir, b, toDir, opt);
				return connectMixed(a, fromDir, b, toDir, opt);
			} finally {
				linkRooms = null;
				currentLink = null;
			}
		}

		/* Place rooms: start near top, then pack by aligned exits with collision checks. */
		const startTpl = pickTemplate(R, 'start', 1, heatBias);
		const startX = 200;
		const startY = KH + 200;
		stampTemplate(startTpl, startX, startY, recipe.nodes[0]);

		const pending = recipe.nodes.slice(1);
		const nodeById = Object.create(null);
		for(const n of recipe.nodes) nodeById[n.id] = n;

		function preferredSlot(from, fromDir, tpl, toDir, gap){
			const fromEx = (from.exits && from.exits[fromDir]) || {};
			const toEx = normalizeExits(tpl)[toDir] || {};
			let x = from.x, y = from.y;
			if(fromDir === 'right' || fromDir === 'left'){
				const fromWalk = walkH(from.h, from.raisedFloor);
				const toWalk = walkH(shellH(tpl), tpl.raisedFloor);
				y = from.y + fromWalk - toWalk;
				x = fromDir === 'right' ? from.x + from.w + gap : from.x - tpl.w - gap;
			} else if(fromDir === 'bottom'){
				x = from.x + ((fromEx.x != null ? fromEx.x : from.w / 2) - (toEx.x != null ? toEx.x : tpl.w / 2));
				y = from.y + from.h + gap;
			} else if(fromDir === 'top'){
				x = from.x + ((fromEx.x != null ? fromEx.x : from.w / 2) - (toEx.x != null ? toEx.x : tpl.w / 2));
				y = from.y - shellH(tpl) - gap;
			}
			return { x: snap(x), y: snap(Math.max(KH, y)), axis: fromDir === 'left' ? 'left' : fromDir === 'right' ? 'right' : fromDir === 'top' ? 'up' : 'down' };
		}

		function attachTries(fromDir, toDir){
			const tries = [{ fromDir:fromDir, toDir:toDir }];
			if(fromDir === 'top' || fromDir === 'bottom'){
				tries.push({ fromDir:'right', toDir:'left' });
				tries.push({ fromDir:'left', toDir:'right' });
				tries.push({ fromDir: fromDir === 'top' ? 'bottom' : 'top', toDir: fromDir === 'top' ? 'top' : 'bottom' });
			} else {
				tries.push({ fromDir:'bottom', toDir:'top' });
				tries.push({ fromDir:'top', toDir:'bottom' });
				tries.push({ fromDir: fromDir === 'right' ? 'left' : 'right', toDir: fromDir === 'right' ? 'right' : 'left' });
			}
			return tries;
		}
		function stampBeside(tpl, node, slot, fromDir, toDir){
			node._edgeFrom = fromDir;
			node._edgeTo = toDir;
			const room = stampTemplate(tpl, slot.x, slot.y, node);
			if(room){
				room._edgeFrom = fromDir;
				room._edgeTo = toDir;
			}
			return room;
		}
		function placeNext(node){
			if(placed[node.id]) return placed[node.id];
			if(node.optional && node.rare != null && !R.chance(node.rare + (heatBias >= 36 ? 0.12 : 0))){
				placed[node.id] = null;
				return null;
			}
			const inEdge = recipe.edges.find(e => e[2] === node.id && placed[e[0]]);
			const tpl = pickTemplate(R, node.kind, node.section, heatBias);
			if(!tpl){
				placed[node.id] = null;
				return null;
			}
			const host = inEdge ? placed[inEdge[0]] : null;
			const wantFrom = inEdge ? inEdge[1] : 'bottom';
			const wantTo = inEdge ? inEdge[3] : 'top';
			if(!host){
				let fallback = null;
				for(let i = recipe.nodes.length - 1; i >= 0; i--){
					if(placed[recipe.nodes[i].id]){ fallback = placed[recipe.nodes[i].id]; break; }
				}
				if(!fallback){
					placed[node.id] = null;
					return null;
				}
				const pref = preferredSlot(fallback, 'bottom', tpl, 'top', VERT_GAP);
				const slot = findFree(pref.x, pref.y, tpl.w, shellH(tpl), 'down') || findFree(pref.x, pref.y, tpl.w, shellH(tpl), 'down', 80);
				if(!slot){
					placed[node.id] = null;
					return null;
				}
				return stampBeside(tpl, node, slot, 'bottom', 'top');
			}
			const tries = attachTries(wantFrom, wantTo);
			for(let t = 0; t < tries.length; t++){
				const fromDir = tries[t].fromDir, toDir = tries[t].toDir;
				const vert = fromDir === 'bottom' || fromDir === 'top' || toDir === 'bottom' || toDir === 'top';
				const pref = preferredSlot(host, fromDir, tpl, toDir, vert ? VERT_GAP : HORIZ_GAP);
				if(node.kind === 'ascent') pref.y = snap(Math.max(pref.y, KH + 1120));
				let slot = findFree(pref.x, pref.y, tpl.w, shellH(tpl), pref.axis);
				if(!slot) slot = findFree(pref.x, pref.y, tpl.w, shellH(tpl), pref.axis, 80);
				if(!slot && !node.optional) slot = findFree(pref.x, pref.y, tpl.w, shellH(tpl), pref.axis, 24);
				if(slot) return stampBeside(tpl, node, slot, fromDir, toDir);
			}
			placed[node.id] = null;
			return null;
		}

		/* First required room sits immediately right of start. Do not jog or fallback. */
		const firstNode = recipe.nodes.find(n => n.id === 'c1');
		if(firstNode && placed.start){
			const firstTpl = pickTemplate(R, firstNode.kind, firstNode.section, heatBias);
			if(firstTpl){
				const pref = preferredSlot(placed.start, 'right', firstTpl, 'left', HORIZ_GAP);
				stampTemplate(firstTpl, pref.x, pref.y, firstNode);
			}
		}

		/* Multi-pass so hosts exist before dependents. */
		for(let pass = 0; pass < 8; pass++){
			for(const n of pending){
				if(placed[n.id] !== undefined) continue;
				const needs = recipe.edges.filter(e => e[2] === n.id);
				const ready = needs.length === 0 || needs.some(e => placed[e[0]]);
				if(ready) placeNext(n);
				if(n.id === 'up' && placed.up && nodeById.c2 && placed.c2 === undefined) placeNext(nodeById.c2);
			}
		}

		function mergeLavaPools(){
			function addLava(x, y, w, h, groundY){
				if(w < 24) return;
				decorations.push({ type:'lava', x:x, y:y, w:w, h:h, _env:true, bed:true, surface:true, groundY:groundY });
			}
			for(let r = 0; r < rooms.length; r++){
				const room = rooms[r];
				const walk = walkY(room);
				const holes = room.floorHoles || [];
				const chans = [];
				for(let i = 0; i < hazards.length; i++){
					if(hazards[i].roomId === room.id && hazards[i].type === 'channel') chans.push(hazards[i]);
				}
				const lowLake = chans.length > 0 && !room.lavaLake;
				const above = lowLake ? CHAN_ABOVE : LAVA_ABOVE;
				const bandY = walk - above - (lowLake ? 0 : LAVA_THICK);
				const bandH = above + LAVA_THICK;
				for(let i = 0; i < chans.length; i++){
					const ch = chans[i];
					ch.y = bandY; ch.h = bandH; ch.groundY = walk;
					if(room.kind === 'warden' || room.kind === 'boss' || room.authoredArena) continue;
					const mid = room.x + room.w * 0.5;
					ch.left = { x: room.x + 8, w: Math.max(80, mid - room.x - 8) };
					ch.right = { x: mid, w: Math.max(80, room.x + room.w - 8 - mid) };
				}
				const pools = [];
				for(let i = 0; i < decorations.length; i++){
					const d = decorations[i];
					if(d.type === 'lava' && d.groundY === walk && d.x + d.w > room.x && d.x < room.x + room.w) pools.push(d);
				}
				let poolW = 0;
				for(let i = 0; i < pools.length; i++) poolW += pools[i].w;
				const combatFloor = room.kind === 'combat' || room.kind === 'elite' || room.kind === 'eliteChamber';
				const wantsLava = !!(room.kind !== 'start' && !room._dryBasin && room.kind !== 'ascent' && room.kind !== 'descent' &&
					room.kind !== 'ashFork' && !combatFloor &&
					(room.lavaLake ||
					room.kind === 'crossing' || room.kind === 'river' || room.kind === 'flood' ||
					room.kind === 'eruption' || room.kind === 'collapseEvent'));
				if(holes.length){
					if(room.lavaLake){
						for(let i = 0; i < holes.length; i++){
							const hole = holes[i];
							let covered = 0;
							for(let p = 0; p < pools.length; p++){
								const x0 = Math.max(hole.x, pools[p].x), x1 = Math.min(hole.x + hole.w, pools[p].x + pools[p].w);
								if(x1 > x0) covered += x1 - x0;
							}
							if(covered < hole.w * 0.85) addLava(hole.x + 2, bandY, hole.w - 4, bandH, walk);
						}
					}
					continue;
				}
				if(room.kind === 'warden' || room.kind === 'boss' || room.authoredArena){
					for(let i = 0; i < pools.length; i++){
						if(pools[i]._shallow){
							pools[i].groundY = walk;
							continue;
						}
						pools[i].y = bandY;
						pools[i].h = Math.max(pools[i].h || 0, bandH);
						pools[i].groundY = walk;
					}
					if(wantsLava && poolW < room.w * 0.28){
						addLava(room.x + 8, bandY, room.w - 16, bandH, walk);
					}
					continue;
				}
				const onlyShallow = pools.length > 0 && pools.every(function(p){ return p._shallow; });
				if((wantsLava || poolW >= room.w * 0.35) && !onlyShallow){
					for(let i = decorations.length - 1; i >= 0; i--){
						const d = decorations[i];
						if(d.type === 'lava' && d.groundY === walk && d.x + d.w > room.x + 4 && d.x < room.x + room.w - 4) decorations.splice(i, 1);
					}
					addLava(room.x + 8, bandY, room.w - 16, bandH, walk);
				}
			}
		}
		mergeLavaPools();
		for(let i = decorations.length - 1; i >= 0; i--){
			const d = decorations[i];
			if(!d || (d.type !== 'lava' && d.type !== 'lavaWell')) continue;
			const cx = d.x + (d.w || 0) * 0.5;
			const cy = d.groundY != null ? d.groundY - 12 : (d.y + (d.h || 0) * 0.5);
			for(let r = 0; r < rooms.length; r++){
				const room = rooms[r];
				if(!room || (!room._dryBasin && room.kind !== 'ascent' && room.kind !== 'descent')) continue;
				if(cx >= room.x - 8 && cx <= room.x + room.w + 8 && cy >= room.y - 8 && cy <= room.y + room.h + 48){
					decorations.splice(i, 1);
					break;
				}
			}
		}
		placeAllSideDoors();

		for(const e of recipe.edges){
			const a = placed[e[0]], b = placed[e[2]];
			if(!a || !b) continue;
			const meta = e[4] || {};
			const lockKind = a.kind === 'combat' || a.kind === 'elite' || a.kind === 'eliteChamber' ||
				a.kind === 'secretElite' || a.kind === 'trial' || a.kind === 'risk' ||
				a.kind === 'shatter' || a.kind === 'warden' ||
				a.kind === 'magmaArena' || a.kind === 'furnaceConveyor' || a.kind === 'eruptionChamber' ||
				a.kind === 'infernoNest' || a.kind === 'moltenBridgeworks';
			const lock = !meta.optional && !a.optional && !a.cleared && lockKind;
			connectRooms(a, b._edgeFrom || e[1], b, b._edgeTo || e[3], { lock: lock, optional: !!meta.optional });
		}
		for(let r = 0; r < rooms.length; r++){
			const ops = rooms[r] && rooms[r].extraOpenings;
			if(!ops) continue;
			for(let o = 0; o < ops.length; o++){
				const op = ops[o];
				if(op && (op._door || op._keep)) dryHalls.push({ x:op.x, y:op.y, w:op.w, h:op.h });
			}
		}
		for(let i = decorations.length - 1; i >= 0; i--){
			if(decorations[i] && decorations[i].type === 'doorway') decorations.splice(i, 1);
		}
		for(let i = platforms.length - 1; i >= 0; i--){
			const p = platforms[i];
			if(!p || p._gone || p.landing) continue;
			const room = rooms[p.roomId];
			if(!room || !(room._wetFloor || room.lavaLake)) continue;
			if(room.kind === 'magmaArena' || room.kind === 'furnaceConveyor' || room.kind === 'eruptionChamber' ||
				room.kind === 'moltenBridgeworks' || room.kind === 'infernoNest' || room.kind === 'threeValveFurnace') continue;
			const walk = walkY(room);
			if(p.y < walk - 200) continue;
			const nearBank = p.x <= room.x + 280 || p.x + p.w >= room.x + room.w - 280;
			if(nearBank || p.y >= walk - 72) platforms.splice(i, 1);
		}

		for(const e of recipe.edges){
			const a = placed[e[0]], b = placed[e[2]];
			if(!a || !b) continue;
			const meta = e[4] || {};
			const signText = (meta.optional && b.doorLabel) || (a.doorLabels && a.doorLabels[e[1]]);
			if(signText){
				const anc = exitAnchor(a, e[1]);
				interactables.push({
					kind:'doorSign',
					roomId: a.id,
					x: anc.x - 40,
					y: anc.y - 36,
					w: 80, h: 28,
					name: signText,
					text: signText,
				});
			}
		}

		/* Secret chance off a mid-run combat host. */
		if(R.chance(0.22 + (hotRun ? 0.08 : 0))){
			const hosts = rooms.filter(r => r.kind === 'combat' && r.section >= 2 && r.section <= 3);
			const host = hosts.length ? R.choice(hosts) : null;
			if(host){
				const sk = R.choice(['secretCave', 'secretShrine', 'secretElite']);
				const st = pickTemplate(R, sk, host.section, heatBias);
				const sx0 = host.x + host.w + 200;
				const sy0 = host.y + Math.max(0, host.h - st.h);
				if(st && !blocked(sx0, sy0, st.w, st.h)){
					const secret = stampTemplate(st, sx0, sy0, { id:'secret', kind:sk, section:host.section, optional:true });
					const wall = { x: host.x + host.w - 20, y: host.y + host.h - 180, w: 40, h: 160, fromRoom: host.id, secret:true };
					host.secretWall = wall;
					host.extraOpenings = host.extraOpenings || [];
					host.extraOpenings.push({ x: wall.x - 8, y: wall.y, w: 64, h: wall.h, _secret:true });
					interactables.push({
						kind:'secretWall',
						roomId: host.id,
						x: wall.x, y: wall.y, w: wall.w, h: wall.h,
						name:'Cracked Wall',
						icon:'🪨',
						secretTo: secret.id,
					});
					/* connector exists but blocked until wall breaks — carve air behind wall after break */
					secret._secretHall = { x: host.x + host.w - 8, y: wall.y, w: 180, h: 160 };
				}
			}
		}

		const startRoom = placed.start;
		const bossRoom = placed.boss;
		const preRoom = placed.pre;
		let maxY = 0;
		for(const r of rooms) maxY = Math.max(maxY, r.y + r.h);
		const WORLD_H = Math.max(maxY + 240, (bossRoom ? bossRoom.y + bossRoom.h : 8000) + 240);

		const preLock = preRoom ? { x: preRoom.x, y: preRoom.y - 40, w: preRoom.w, h: 40 } : { x:400, y:200, w:2000, h:40 };
		const bossLock = bossRoom ? { x: bossRoom.x, y: bossRoom.y + 200, w: 40, h: 240 } : { x:400, y:400, w:40, h:240 };

		const kitten = startRoom ? {
			shaft: { x: startRoom.x, y: 0, w: 120, h: startRoom.y },
			corridor: { x: startRoom.x, y: 0, w: 2400, h: 200 },
			arena: { x: startRoom.x + 2320, y: 0, w: 1800, h: 1680 },
			chainDoor: { x: startRoom.x, y: startRoom.y - 12, w: 120, h: 16 },
			lockWall: { x: startRoom.x + 2320, y: 0, w: 40, h: 200 },
		} : null;

		if(kitten && startRoom){
			startRoom.extraOpenings = startRoom.extraOpenings || [];
			startRoom.extraOpenings.push({
				x: kitten.chainDoor.x, y: startRoom.y - 24, w: kitten.chainDoor.w, h: 48,
			});
		}

		(function settleFireWorld(){
			const SKIP = { lava:1, lavaWell:1, embers:1, doorway:1 };
			const CEIL = { stalactite:1, fireChain:1, fireLavaPipe:1, pipe:1 };
			const WALL = { torch:1, vein:1 };
			const FLOOR = { rubble:1, column:1, crystal:1, stalagmite:1, firePillar:1, fireFurnace:1, fireAltar:1, fireAnvil:1, fireDebris:1, fireBasalt:1, fireReservoir:1, fireTrench:1, fireVent:1, fireBridge:1, fireGate:1, fireContainment:1, fireCrackFloor:1, fireBrazier:1, crack:1 };
			function roomOf(d){
				for(let r = 0; r < rooms.length; r++){
					const rm = rooms[r];
					if(d.x >= rm.x - 24 && d.x <= rm.x + rm.w + 24 && d.y >= rm.y - 40 && d.y <= rm.y + rm.h + 80) return rm;
				}
				return null;
			}
			function onHole(room, x, w){
				const holes = room.floorHoles || [];
				for(let h = 0; h < holes.length; h++){
					if(x + (w || 40) > holes[h].x - 6 && x < holes[h].x + holes[h].w + 6) return true;
				}
				return false;
			}
			function platUnder(room, x, w){
				let best = null;
				const walk = walkY(room);
				for(let i = 0; i < platforms.length; i++){
					const p = platforms[i];
					if(!p || p.kind === 'fall') continue;
					if(p.roomId != null && p.roomId !== room.id){
						if(p.x + p.w < room.x || p.x > room.x + room.w) continue;
						if(p.y < room.y || p.y > room.y + room.h) continue;
					}
					if(p.y >= walk - 8) continue;
					if(x + (w || 40) * 0.4 > p.x && x < p.x + p.w - 8){
						if(!best || p.y > best.y) best = p;
					}
				}
				return best;
			}
			function seatY(room, x, w){
				const walk = walkY(room);
				if(onHole(room, x, w)){
					const p = platUnder(room, x, w);
					if(p) return p.y;
					return null;
				}
				return walk + (room.kind === 'start' ? 12 : 0);
			}
			function slideOffHole(room, d){
				const w = d.w || 40;
				if(!onHole(room, d.x, w)) return;
				const tryX = [room.x + 88, room.x + room.w - 120, room.x + room.w * 0.35, room.x + room.w * 0.65];
				for(let i = 0; i < tryX.length; i++){
					if(!onHole(room, tryX[i], w)){ d.x = snap(tryX[i]); return; }
				}
			}

			for(let i = 0; i < decorations.length; i++){
				const d = decorations[i];
				if(!d || d._env || SKIP[d.type]) continue;
				const room = roomOf(d);
				if(!room) continue;
				const walk = walkY(room);
				const mount = d._on || (d.hang || CEIL[d.type] ? 'ceil' : (WALL[d.type] ? 'wall' : (FLOOR[d.type] ? 'floor' : null)));
				if(mount === 'ceil' || d.hang){
					d.hang = true;
					d.y = room.y + (d.type === 'stalactite' ? 4 : 8);
					d.x = Math.max(room.x + 24, Math.min(room.x + room.w - 40, d.x));
					continue;
				}
				if(mount === 'wall'){
					const left = (d.side === 'left') || (d.x < room.x + room.w * 0.5);
					d.x = left ? room.x + 0 : room.x + room.w - 32;
					d.side = left ? 'left' : 'right';
					if(d.type === 'vein'){
						d.y = room.y + 40;
						d.h = Math.max(80, walk - d.y - 16);
					} else {
						d.y = Math.max(room.y + 48, Math.min(walk - 120, d.y || walk - 180));
					}
					continue;
				}
				if(mount === 'floor' || FLOOR[d.type]){
					slideOffHole(room, d);
					let y = seatY(room, d.x, d.w);
					if(y == null){
						slideOffHole(room, d);
						y = walkY(room);
					}
					/* wet rooms: keep bulky props off lava. Never seat them on a
					   raised platform — that reads as a floating decoration. */
					const bulky = d.type === 'fireDebris' || d.type === 'rubble' || d.type === 'fireBasalt' || d.type === 'fireContainment' || d.type === 'fireFurnace' || d.type === 'fireAnvil';
					if(d._pillarUp){
						d.y = walk;
						d._on = 'floor';
						continue;
					}
					if(bulky && room.kind !== 'stabilize'){
						const p = platUnder(room, d.x, d.w);
						if(p && p.y < walk - 48){ d._skipProp = true; continue; }
						if((room._wetFloor || room.lavaLake) && !p){ d._skipProp = true; continue; }
						if(p && p.y >= walk - 48) y = p.y;
					}
					if(room.kind === 'stabilize') y = walk;
					d.y = y;
					d._on = 'floor';
				}
			}
			for(let i = 0; i < decorations.length; i++){
				const d = decorations[i];
				if(!d || d.hang || !FLOOR[d.type]) continue;
				const room = roomOf(d);
				if(!room) continue;
				const walk = walkY(room);
				for(let h = 0; h < hazards.length; h++){
					const hz = hazards[h];
					if(hz.roomId !== room.id || hz.type !== 'vent') continue;
					if(d.x + (d.w || 80) > hz.x - 56 && d.x < hz.x + (hz.w || 52) + 56){
						d.y = walk + 44;
						d._sink = 48;
						d._on = 'floor';
						d._skipProp = false;
						break;
					}
				}
			}
			for(let i = decorations.length - 1; i >= 0; i--){
				if(decorations[i] && decorations[i]._skipProp) decorations.splice(i, 1);
			}
			for(let r = 0; r < rooms.length; r++){
				const room = rooms[r];
				const walk = walkY(room);
				for(let i = 0; i < hazards.length; i++){
					const hz = hazards[i];
					if(hz.roomId !== room.id) continue;
					if(room._wetFloor || room.lavaLake || room._dryBasin) continue;
					if(hz.type === 'channel'){
						if(hz.left) decorations.push({ type:'fireTrench', x:snap(hz.left.x + 8), y:walk, w:80, h:40, _fireArt:true });
						if(hz.right) decorations.push({ type:'fireTrench', x:snap(hz.right.x + hz.right.w - 88), y:walk, w:80, h:40, _fireArt:true });
						decorations.push({ type:'fireGate', x:snap(room.x + room.w * 0.5 - 80), y:walk, w:160, h:160, _fireArt:true });
					}
					if(hz.type === 'vent'){
						decorations.push({
							type:'fireVent',
							x: snap(hz.x + (hz.w || 52) * 0.5 - 40),
							y: walk + 20,
							w: 80, h: 40,
							_fireArt: true,
							_geyserBase: true,
							_sink: 44,
						});
					}
					if(hz.type === 'gate'){
						decorations.push({ type:'fireGate', x:snap(hz.x - 8), y:walk, w:160, h:160, _fireArt:true });
					}
				}
				if((room.lavaLake || room.kind === 'flood' || room.kind === 'river') && !room._wetFloor){
					decorations.push({ type:'fireReservoir', x:room.x + 16, y:walk, w:88, h:36, _fireArt:true });
					decorations.push({ type:'fireReservoir', x:room.x + room.w - 104, y:walk, w:88, h:36, _fireArt:true });
				}
			}
			const GROUND_CAP = { rubble:1, fireDebris:1, fireBasalt:1, fireContainment:1, fireTrench:1, fireReservoir:1, fireAnvil:1, fireBrazier:1, fireAltar:1, fireFurnace:1, fireGate:1, fireVent:1, fireCrackFloor:1, fireBridge:1, crystal:1 };
			for(let r = 0; r < rooms.length; r++){
				const room = rooms[r];
				const walk = walkY(room);
				const combat = room.kind === 'combat' || room.kind === 'elite' || room.kind === 'eliteChamber' || room.kind === 'risk' || room.kind === 'trial';
				const wet = !!(room._wetFloor || room.lavaLake);
				const cap = wet ? (combat ? 2 : 0) : 2;
				const kept = [];
				for(let i = decorations.length - 1; i >= 0; i--){
					const d = decorations[i];
					if(!d || d.hang || d._env || !GROUND_CAP[d.type]) continue;
					if(d.x < room.x - 8 || d.x > room.x + room.w + 8) continue;
					if(Math.abs((d.y || 0) - walk) > 48) continue;
					if(kept.length >= cap) decorations.splice(i, 1);
					else kept.push(d);
				}
			}
		})();

		function holeAtWorld(room, x, w){
			const holes = room.floorHoles || [];
			for(let i = 0; i < holes.length; i++){
				if(x + w > holes[i].x && x < holes[i].x + holes[i].w) return true;
			}
			return false;
		}
		function supportTop(room, x, w, preferY){
			const walk = walkY(room);
			let best = null, bestD = 1e9;
			for(let i = 0; i < platforms.length; i++){
				const p = platforms[i];
				if(!p || p.roomId !== room.id || p._gone) continue;
				if(p.kind && p.kind !== 'static' && p.kind !== 'pillar') continue;
				if(x + w <= p.x + 8 || x >= p.x + p.w - 8) continue;
				const d = Math.abs(p.y - (preferY != null ? preferY : p.y));
				if(d < bestD){ bestD = d; best = p.y; }
			}
			if(best != null) return best;
			if(holeAtWorld(room, x, w)){
				for(let i = 0; i < platforms.length; i++){
					const p = platforms[i];
					if(!p || p.roomId !== room.id || p._gone) continue;
					if(p.kind && p.kind !== 'static') continue;
					if((p.w || 0) < 80) continue;
					const px = Math.max(p.x + 8, Math.min(x, p.x + p.w - w - 8));
					return { y:p.y, x:px };
				}
			}
			return walk;
		}
		for(let i = 0; i < interactables.length; i++){
			const it = interactables[i];
			if(!it) continue;
			if(it.kind !== 'cache' && it.kind !== 'specialCache') continue;
			const room = rooms[it.roomId];
			if(!room) continue;
			const h = it.h || 60, w = it.w || 70;
			const feet = it.y + h;
			const sup = supportTop(room, it.x, w, feet);
			if(sup && typeof sup === 'object'){
				it.x = sup.x;
				it.y = sup.y - h;
			} else {
				it.y = (typeof sup === 'number' ? sup : walkY(room)) - h;
			}
		}

		const playerStart = startRoom
			? { x: startRoom.x + 80, y: startRoom.y + startRoom.h - 80 }
			: { x: 180, y: startY + 300 };

		return {
			name: 'The Infernal Depths',
			worldW: WORLD_W,
			worldH: WORLD_H,
			bgColor:'#190704', wallColor:'#4a1a0a', wallColor2:'#6a2a12', wallEdge:'#8a3e1a',
			floorHighlight:'#9a5630', ceilShadow:'#240b04', airColor:'#2f1108',
			playerStart: playerStart,
			corridors: corridors,
			enemies: enemies,
			decorations: decorations,
			puzzles: puzzles,
			rooms: rooms,
			platforms: platforms,
			hazards: hazards,
			interactables: interactables,
			_gates: gates,
			_links: links,
			_dryHalls: dryHalls,
			_theme: 'fire',
			_meter: 'heat',
			_meterLabel: 'Heat',
			_hotRun: hotRun,
			_recipe: recipe.id,
			_bossRoomRect: bossRoom ? { x:bossRoom.x, y:bossRoom.y, w:bossRoom.w, h:bossRoom.h } : { x:520, y:8000, w:4400, h:1680 },
			_prebossLockWall: preLock,
			_bossLockWall: bossLock,
			_bossRoomTriggerY: bossRoom ? bossRoom.y + 40 : 8000,
			_bossPlatforms: (bossRoom && platforms.filter(p => p.roomId === bossRoom.id && p.kind === 'static' && !p.pillar).map(p => ({ x:p.x, y:p.y, w:p.w }))) || [],
			_tablet: bossRoom ? { x: bossRoom.x + 160, y: bossRoom.y + 600 - 120 } : null,
			_kitten: kitten,
		};
	}

	global.generateFireInfernalDepths = generateFireInfernalDepths;
})(typeof window !== 'undefined' ? window : globalThis);
