/* =============================================================
   DungeonVision — line-of-sight + light sources (dungeons only).

   You see from the mage's position. Solid tiles block sight, so a
   wall or floor hides the room behind it. Lights then raise the
   brightness of tiles you can actually see. Ambient stay-playable.
   ============================================================= */
(function(global){
	'use strict';

	const RAYS = 220;
	const MAX_VIEW = 800;
	const WALL_SEE = 72;
	const SMOOTH = 0.58;
	const AMBIENT = { fire: 0.50, ice: 0.46, earth: 0.42, jungle: 0.42, default: 0.46 };
	const FOG = { fire: [10, 3, 1], ice: [3, 10, 18], earth: [4, 10, 4], jungle: [4, 10, 4], default: [6, 6, 10] };

	const DECOR_LIGHT = {
		torch: { r: 200, i: 0.88, c: [255, 140, 50] },
		fireBrazier: { r: 240, i: 0.95, c: [255, 150, 40] },
		hangBrazier: { r: 220, i: 0.90, c: [255, 140, 40] },
		fireFurnace: { r: 300, i: 1.05, c: [255, 110, 30] },
		fireAltar: { r: 210, i: 0.78, c: [255, 190, 80] },
		fireAnvil: { r: 90, i: 0.28, c: [255, 120, 40] },
		fireVent: { r: 130, i: 0.55, c: [255, 90, 20] },
		fireGate: { r: 160, i: 0.45, c: [255, 100, 30] },
		fireContainment: { r: 170, i: 0.50, c: [255, 80, 20] },
		fireReservoir: { r: 140, i: 0.48, c: [255, 90, 20] },
		fireTrench: { r: 110, i: 0.40, c: [255, 80, 16] },
		fireCrackFloor: { r: 80, i: 0.28, c: [255, 90, 20] },
		lava: { r: 170, i: 0.72, c: [255, 100, 20], along: true },
		lavaWell: { r: 150, i: 0.62, c: [255, 90, 16], along: true },
		embers: { r: 130, i: 0.32, c: [255, 120, 40] },
		glow: { r: 170, i: 0.70, c: [255, 170, 70] },
		glow2: { r: 170, i: 0.70, c: [255, 170, 70] },
		glowCrack: { r: 140, i: 0.58, c: [255, 140, 40] },
		crystal: { r: 180, i: 0.74, c: [160, 230, 255] },
		crystalCluster: { r: 200, i: 0.80, c: [150, 220, 255] },
		iceGlyphs: { r: 150, i: 0.55, c: [140, 220, 255] },
		iceLight: { r: 220, i: 0.86, c: [160, 230, 255] },
		lightShaft: { r: 260, i: 0.48, c: [200, 230, 255] },
		frozenCamp: { r: 180, i: 0.72, c: [255, 160, 60] },
		iceColumn: { r: 90, i: 0.22, c: [140, 210, 255] },
		crack: { r: 70, i: 0.18, c: [255, 100, 30] },
		jgDormantBloom: { r: 160, i: 0.42, c: [180, 255, 90] },
		jgGuardianStatue: { r: 120, i: 0.30, c: [140, 220, 90] },
		jgGlowMushrooms: { r: 190, i: 0.72, c: [160, 255, 110] },
		jgFlowClue: { r: 100, i: 0.28, c: [120, 220, 80] },
		jgHangLantern: { r: 210, i: 0.82, c: [180, 255, 90] },
		jgCanopyLamp: { r: 200, i: 0.78, c: [190, 255, 100] },
		jgGlowOrchid: { r: 170, i: 0.62, c: [220, 255, 120] },
		jgHangGlowVines: { r: 180, i: 0.68, c: [150, 255, 110] },
		jgSporeLantern: { r: 190, i: 0.76, c: [160, 255, 90] },
		jgSapCrystal: { r: 180, i: 0.74, c: [140, 255, 120] },
		jgMossTorch: { r: 170, i: 0.70, c: [255, 210, 80] },
		jgHeartwoodLamp: { r: 200, i: 0.80, c: [120, 255, 140] },
		jgFireflyNest: { r: 160, i: 0.58, c: [230, 255, 90] },
		jgGlowLily: { r: 150, i: 0.55, c: [170, 255, 140] },
		jgRootLamp: { r: 170, i: 0.64, c: [130, 255, 120] },
		jgLimeGeode: { r: 180, i: 0.72, c: [110, 255, 160] },
		jgGlowBowl: { r: 160, i: 0.60, c: [200, 255, 90] },
		jgTallBiolume: { r: 210, i: 0.82, c: [110, 255, 150] },
		jgBiolumeLamp: { r: 200, i: 0.80, c: [140, 255, 160] },
		jgGiantFlower: { r: 150, i: 0.48, c: [200, 255, 90] },
		jgLantern: { r: 200, i: 0.78, c: [180, 255, 90] },
		jgLightShaft: { r: 320, i: 0.62, c: [220, 255, 160] },
		jgBiolumeField: { r: 300, i: 0.78, c: [150, 255, 140], along: true, alongStep: 280 },
		jgAncientGroveArena: { r: 360, i: 0.55, c: [180, 255, 130], along: true, alongStep: 420 }
	};

	const INT_LIGHT = {
		waterWheel: { r: 150, i: 0.48, c: [160, 255, 110] },
		sunMirror: { r: 180, i: 0.62, c: [255, 230, 120] },
		statueNode: { r: 140, i: 0.40, c: [150, 220, 90] },
		growthNode: { r: 140, i: 0.42, c: [140, 255, 110] },
		mushroomNode: { r: 170, i: 0.62, c: [160, 255, 110] },
		flowerNode: { r: 160, i: 0.55, c: [200, 255, 90] },
		sporeFlower: { r: 160, i: 0.55, c: [180, 255, 100] },
		ecosystemNode: { r: 150, i: 0.48, c: [150, 255, 110] },
		drainLever: { r: 130, i: 0.40, c: [180, 255, 90] },
		jungleShrine: { r: 200, i: 0.72, c: [170, 255, 110] },
		predatorNest: { r: 120, i: 0.32, c: [200, 220, 80] },
		spiderNest: { r: 120, i: 0.32, c: [180, 220, 90] },
		jungleTrap: { r: 130, i: 0.36, c: [200, 255, 90] },
		jungleChoice: { r: 220, i: 0.78, c: [120, 255, 150] },
		sacredOffering: { r: 150, i: 0.50, c: [220, 255, 100] },
		vineElevator: { r: 140, i: 0.42, c: [140, 255, 110] },
		shortcutVine: { r: 140, i: 0.42, c: [140, 255, 110] },
		jungleMemory: { r: 150, i: 0.48, c: [180, 255, 120] },
		rootSeal: { r: 130, i: 0.38, c: [150, 255, 110] },
		rootSwitch: { r: 130, i: 0.38, c: [150, 255, 110] },
		raptorEgg: { r: 180, i: 0.70, c: [255, 230, 90] },
		miniBossStart: { r: 190, i: 0.70, c: [140, 255, 130] },
		crackedRock: { r: 110, i: 0.32, c: [255, 160, 60] },
		channelLever: { r: 140, i: 0.50, c: [255, 150, 40] },
		choice: { r: 200, i: 0.72, c: [255, 140, 40] },
		valve: { r: 140, i: 0.48, c: [255, 130, 40] },
		shrine: { r: 190, i: 0.68, c: [255, 190, 80] },
		risk: { r: 170, i: 0.58, c: [255, 140, 40] },
		trial: { r: 170, i: 0.55, c: [255, 170, 70] },
		cool: { r: 140, i: 0.42, c: [140, 210, 255] },
		magmaSiphon: { r: 150, i: 0.50, c: [255, 120, 30] },
		hiddenSiphon: { r: 150, i: 0.50, c: [255, 120, 30] },
		forgeChoice: { r: 160, i: 0.52, c: [255, 110, 30] },
		wardenStart: { r: 180, i: 0.62, c: [255, 160, 40] },
		memory: { r: 150, i: 0.48, c: [255, 200, 90] },
		core: { r: 200, i: 0.72, c: [255, 130, 30] },
		magmaCoreSlot: { r: 200, i: 0.72, c: [255, 130, 30] },
		hearth: { r: 210, i: 0.80, c: [255, 170, 70] },
		ring: { r: 160, i: 0.55, c: [150, 220, 255] },
		relic: { r: 200, i: 0.74, c: [160, 230, 255] },
		prison: { r: 140, i: 0.42, c: [150, 220, 255] },
		crackedIce: { r: 120, i: 0.36, c: [180, 230, 255] },
		vault: { r: 160, i: 0.52, c: [255, 210, 90] },
		cache: { r: 150, i: 0.48, c: [255, 200, 90] },
		jungleCache: { r: 150, i: 0.48, c: [200, 255, 110] },
		jungleVault: { r: 170, i: 0.55, c: [210, 255, 120] }
	};

	const ENEMY_LIGHT = {
		fireSprite: { r: 150, i: 0.70, c: [255, 120, 30] },
		emberMage: { r: 130, i: 0.48, c: [255, 110, 40] },
		flameSerpent: { r: 140, i: 0.52, c: [255, 100, 25] },
		magmaGolem: { r: 170, i: 0.58, c: [255, 90, 20] },
		magmaWarden: { r: 220, i: 0.72, c: [255, 80, 16] },
		magmaHarvester: { r: 150, i: 0.50, c: [255, 95, 20] },
		magmaImp: { r: 120, i: 0.45, c: [255, 100, 25] },
		flameSalamander: { r: 130, i: 0.48, c: [255, 110, 30] },
		cinderBeetle: { r: 90, i: 0.30, c: [255, 120, 40] },
		furnaceLeech: { r: 100, i: 0.32, c: [255, 90, 20] },
		ashRevenant: { r: 80, i: 0.22, c: [200, 80, 30] },
		willowWisp: { r: 180, i: 0.80, c: [160, 255, 120] },
		glowBeetle: { r: 150, i: 0.68, c: [180, 255, 90] },
		sporeFungus: { r: 120, i: 0.40, c: [140, 255, 80] },
		pollenMoth: { r: 110, i: 0.36, c: [220, 255, 120] },
		crystalMage: { r: 150, i: 0.58, c: [140, 220, 255] },
		crystalScarab: { r: 110, i: 0.40, c: [120, 210, 255] },
		frostWraith: { r: 120, i: 0.38, c: [150, 220, 255] },
		cryoMage: { r: 110, i: 0.34, c: [160, 220, 255] },
		glacierSentinel: { r: 100, i: 0.28, c: [140, 200, 255] },
		earthColossus: { r: 780, i: 1.32, c: [180, 255, 110] },
		frostColossus: { r: 980, i: 1.45, c: [180, 230, 255] }
	};

	const NAME_LIGHT = [
		[/torch|brazier|lantern|lamp/i, { r: 200, i: 0.82, c: [255, 150, 50] }],
		[/furnace|forge|magma|lava/i, { r: 240, i: 0.80, c: [255, 100, 25] }],
		[/crystal|glyph|rune|iceglow/i, { r: 170, i: 0.68, c: [150, 220, 255] }],
		[/glow|wisp|spore|bloom|ember|biolume|orchid/i, { r: 150, i: 0.55, c: [220, 180, 70] }],
		[/altar|shrine|idol|hearth|relic/i, { r: 180, i: 0.58, c: [255, 200, 90] }]
	];

	let _buf = null, _bufW = 0, _bufH = 0;
	let _dist = null, _lpx = 0, _lpy = 0, _ldn = 0;
	const _extra = [];
	let _cityBlocks = null;

	function inCityBuilding(){
		return typeof IS_CITY !== 'undefined' && IS_CITY &&
			typeof EmberfallCity !== 'undefined' && EmberfallCity.isInside && EmberfallCity.isInside();
	}
	/* Tall platforms are walls. One-tile floors stay open, same as dungeon decks. */
	function cityBlockSet(){
		const plats = (typeof sandboxPlatforms !== 'undefined') ? sandboxPlatforms : null;
		const n = plats ? plats.length : 0;
		if(_cityBlocks && _cityBlocks._n === n) return _cityBlocks;
		const set = new Set();
		set._n = n;
		const T = tile();
		if(plats){
			for(let i = 0; i < plats.length; i++){
				const p = plats[i];
				if(!p || p.h <= T + 2) continue;
				const c0 = Math.floor(p.x / T);
				const c1 = Math.floor((p.x + p.w - 1) / T);
				const r0 = Math.floor(p.y / T);
				const r1 = Math.floor((p.y + p.h - 1) / T);
				if(r1 <= r0) continue;
				for(let r = r0; r <= r1; r++){
					for(let c = c0; c <= c1; c++) set.add((c * 100000) + r);
				}
			}
		}
		_cityBlocks = set;
		return set;
	}

	function themeKey(){
		const t = (typeof DUNGEON_TYPE !== 'undefined' && DUNGEON_TYPE) ||
			(typeof dungeon !== 'undefined' && dungeon && dungeon._theme) || 'default';
		if(t === 'earth') return 'earth';
		return AMBIENT[t] != null ? t : 'default';
	}
	function tile(){ return (typeof TILE === 'number') ? TILE : 40; }
	function solid(c, r){
		if(typeof isSolid !== 'function') return false;
		return isSolid(c, r);
	}
	/* Thick walls only. One-tile walkways / platforms have air above
	   and must not close off the room on the other side. */
	function blocksVision(c, r){
		if(inCityBuilding()){
			if(cityBlockSet().has((c * 100000) + r)) return true;
			return !!(EmberfallCity.visionTile && EmberfallCity.visionTile(c, r));
		}
		if(!solid(c, r)) return false;
		if(typeof isProjectileBlockingTile === 'function') return isProjectileBlockingTile(c, r);
		return r > 0 && solid(c, r - 1);
	}
	function inHeartwood(){
		if(typeof dungeon === 'undefined' || !dungeon || !dungeon._jungle) return false;
		const br = dungeon._bossRoomRect;
		if(!br || typeof player === 'undefined' || !player) return false;
		return player.x + player.w > br.x && player.x < br.x + br.w &&
			player.y + player.h > br.y && player.y < br.y + br.h;
	}
	function inIceBoss(){
		if(typeof dungeon === 'undefined' || !dungeon || dungeon._theme !== 'ice') return false;
		const br = dungeon._bossRoomRect;
		if(!br || typeof player === 'undefined' || !player) return false;
		return player.x + player.w > br.x && player.x < br.x + br.w &&
			player.y + player.h > br.y && player.y < br.y + br.h;
	}
	function inView(x, y, r, cam, vw, vh, pad){
		pad = pad == null ? 80 : pad;
		return x + r > cam.x - pad && x - r < cam.x + vw + pad &&
			y + r > cam.y - pad && y - r < cam.y + vh + pad;
	}
	function pushLight(out, x, y, spec, scale){
		if(!spec) return;
		scale = scale == null ? 1 : scale;
		out.push({
			x: x, y: y,
			r: spec.r * scale,
			i: spec.i * scale,
			c: spec.c
		});
	}
	function specForName(name){
		if(!name) return null;
		if(DECOR_LIGHT[name]) return DECOR_LIGHT[name];
		for(let i = 0; i < NAME_LIGHT.length; i++){
			if(NAME_LIGHT[i][0].test(name)) return NAME_LIGHT[i][1];
		}
		return null;
	}

	/* Many lights close together (a lava lake, a row of glowing props) cost a fill each but look like one: lights of the same
	   colour within ~110 px are merged into one a little larger and brighter, so a crowded scene stays cheap. */
	function mergeLights(lights){
		if(lights.length <= 24) return lights;
		const cell = 110, grid = new Map(), out = [];
		for(let i = 0; i < lights.length; i++){
			const L = lights[i];
			if(i === 0){ out.push(L); continue; }       // the player's own light stays as it is
			const k = Math.round(L.x / cell) + ',' + Math.round(L.y / cell) + ',' + (L.c ? L.c.join('.') : '');
			const m = grid.get(k);
			if(!m){ const c = { x: L.x, y: L.y, r: L.r, i: L.i, c: L.c, n: 1 }; grid.set(k, c); out.push(c); continue; }
			m.x = (m.x * m.n + L.x) / (m.n + 1); m.y = (m.y * m.n + L.y) / (m.n + 1); m.n++;
			m.r = Math.max(m.r, L.r) * 1.04; m.i = Math.min(1.2, Math.max(m.i, L.i) + 0.04);
		}
		if(out.length > 64){ out.sort((p, q) => q.i * q.r - p.i * p.r); out.length = 64; }
		return out;
	}
	function collectLights(cam, vw, vh){
		const lights = [];
		const d = (typeof dungeon !== 'undefined') ? dungeon : null;

		if(inCityBuilding() && EmberfallCity.visionLights){
			const roomLights = EmberfallCity.visionLights();
			for(let i = 0; i < roomLights.length; i++){
				const L = roomLights[i];
				if(inView(L.x, L.y, L.r, cam, vw, vh, L.r)) lights.push(L);
			}
		}

		if(typeof player !== 'undefined' && player){
			const iceBoss = inIceBoss();
			const ice = themeKey() === 'ice' && !iceBoss;
			pushLight(lights, player.x + player.w / 2, player.y + player.h * 0.45, {
				r: iceBoss ? 900 : (ice ? 150 : 250),
				i: iceBoss ? 1.2 : (ice ? 0.34 : 0.42),
				c: ice || iceBoss ? [180, 220, 255] : [255, 220, 170]
			});
		}

		// light made by spells (Light technique energy, illuminating reinforcement …)
		if(typeof MAGIC_WORLD !== 'undefined' && MAGIC_WORLD && MAGIC_WORLD.lights){
			for(let i = 0; i < MAGIC_WORLD.lights.length; i++){
				const L = MAGIC_WORLD.lights[i];
				if(inView(L.x, L.y, L.r, cam, vw, vh, L.r)) lights.push({ x: L.x, y: L.y, r: L.r, i: L.i, c: L.c });
			}
		}

		const heartwood = inHeartwood();
		const iceBoss = inIceBoss();
		const decs = (d && d.decorations) || [];
		for(let i = 0; i < decs.length; i++){
			const dec = decs[i];
			if(!dec || dec._fluidConsumed) continue;
			const spec = specForName(dec.type);
			if(!spec) continue;
			const w = dec.w || 40, h = dec.h || 40;
			const flower = /GiantFlower|DormantBloom|GlowLily|GlowOrchid/.test(dec.type || '') || !!dec.glow;
			let use = spec;
			if(heartwood){
				use = {
					r: spec.r * (flower ? 2.6 : 1.55),
					i: spec.i * (flower ? 2.2 : 1.45),
					c: flower ? [255, 240, 130] : spec.c,
					along: spec.along,
					alongStep: spec.alongStep
				};
			} else if(flower && dec.glow){
				use = { r: spec.r * 1.6, i: spec.i * 1.45, c: [230, 255, 110], along: spec.along, alongStep: spec.alongStep };
			}
			if(use.along && w > 90){
				const step = use.alongStep || 90;
				const n = Math.max(1, Math.ceil(w / step));
				for(let k = 0; k < n; k++){
					const x = dec.x + (k + 0.5) * (w / n);
					const y = dec.y + Math.min(h * 0.45, 80);
					if(inView(x, y, use.r, cam, vw, vh, use.r)) pushLight(lights, x, y, use);
				}
			} else {
				const x = dec.x + w * 0.5;
				const hangY = dec.hang || dec.type === 'lightShaft' || dec.type === 'pipe' || dec.type === 'fireLavaPipe' || dec.type === 'fireChain' ||
					/HangLantern|CanopyLamp|GlowOrchid|HangGlow|SporeLantern|LightShaft/.test(dec.type || '');
				const y = dec.y + (hangY ? Math.min(h * 0.35, 48) : (flower ? h * 0.4 : 10));
				const ice = (dec.type === 'iceLight' && dec.r) ? { r: dec.r * 1.6, i: use.i, c: use.c } : use;
				if(inView(x, y, ice.r, cam, vw, vh, ice.r)) pushLight(lights, x, y, ice);
			}
		}

		const hazards = (d && d.hazards) || [];
		for(let i = 0; i < hazards.length; i++){
			const hz = hazards[i];
			if(!hz) continue;
			if(hz.type === 'vent'){
				const hot = !!hz.hot;
				const x = hz.x + (hz.w || 50) * 0.5;
				const y = (hz.y || 0) - (hot ? (hz.height || 40) * 0.35 : 0);
				const spec = { r: hot ? 220 : 110, i: hot ? 0.95 : 0.35, c: [255, 90, 20] };
				if(inView(x, y, spec.r, cam, vw, vh, spec.r)) pushLight(lights, x, y, spec);
			} else if(hz.type === 'channel' && hz.geysers){
				for(let g = 0; g < hz.geysers.length; g++){
					const gy = hz.geysers[g];
					const hot = !!gy.hot;
					const x = gy.x + (gy.w || 40) * 0.5;
					const y = (hz.y || 0) - (hot ? (gy.height || 30) * 0.4 : 0);
					const spec = { r: hot ? 240 : 90, i: hot ? 0.92 : 0.28, c: [255, 85, 18] };
					if(inView(x, y, spec.r, cam, vw, vh, spec.r)) pushLight(lights, x, y, spec);
				}
				if(hz.left) pushLight(lights, hz.left.x + hz.left.w * 0.5, hz.y + 8, { r: 130, i: 0.36, c: [255, 80, 16] });
				if(hz.right) pushLight(lights, hz.right.x + hz.right.w * 0.5, hz.y + 8, { r: 130, i: 0.36, c: [255, 80, 16] });
			} else if(hz.type === 'rise' && hz.active){
				const x = hz.x + (hz.w || 100) * 0.5;
				const y = hz.y || 0;
				const n = Math.max(1, Math.ceil((hz.w || 100) / 120));
				for(let k = 0; k < n; k++){
					pushLight(lights, hz.x + (k + 0.5) * ((hz.w || 100) / n), y, { r: 190, i: 0.70, c: [255, 90, 18] });
				}
			} else if(hz.type === 'fall' && (hz.hot || hz.warnOn)){
				pushLight(lights, hz.x + (hz.w || 40) * 0.5, hz.y + (hz.h || 80) * 0.4, {
					r: hz.hot ? 200 : 90, i: hz.hot ? 0.75 : 0.25, c: [255, 100, 30]
				});
			} else if((hz.type === 'bounceMushroom' || hz.flower) && inHeartwood()){
				pushLight(lights, hz.x + (hz.w || 80) * 0.5, hz.y + (hz.h || 40) * 0.2, {
					r: 340, i: 1.05, c: [255, 230, 90]
				});
			}
		}

		if(typeof DungeonFluid !== 'undefined' && DungeonFluid.ready && DungeonFluid.bins){
			/* Lava glows along its surface. One light used to be added every 48 px of lava — a wide lake meant dozens of
			   full gradient fills a frame. Now a light every ~200 px of each lava floor, a little larger to cover the gaps. */
			const t = 12, STEP = 17;
			const i0 = Math.floor((cam.x - 80) / t), i1 = Math.ceil((cam.x + vw + 80) / t);
			const lastAt = {};
			for(let bi = i0; bi <= i1; bi++){
				const list = DungeonFluid.bins[bi];
				if(!list) continue;
				for(let k = 0; k < list.length; k++){
					const col = list[k];
					if(!col || !(col.visLava > 10 || col.lava > 10)) continue;
					const fk = Math.round(col.floor / 80);
					if(lastAt[fk] != null && bi - lastAt[fk] < STEP) continue;
					lastAt[fk] = bi;
					const h = col.visLava || col.lava;
					const x = col.x + t * 0.5 + STEP * t * 0.5;
					const y = col.floor - Math.min(h, 80) * 0.45;
					if(inView(x, y, 190, cam, vw, vh, 40)) pushLight(lights, x, y, { r: 190, i: 0.6, c: [255, 95, 18] });
				}
			}
		}

		if(typeof enemies !== 'undefined'){
			for(let i = 0; i < enemies.length; i++){
				const en = enemies[i];
				if(!en || en.dead) continue;
				const spec = ENEMY_LIGHT[en.type];
				if(!spec) continue;
				const x = en.x + (en.w || 40) * 0.5, y = en.y + (en.h || 40) * 0.4;
				if(inView(x, y, spec.r, cam, vw, vh, spec.r)) pushLight(lights, x, y, spec);
			}
		}

		function addProj(list, scale){
			if(!list) return;
			for(let i = 0; i < list.length; i++){
				const p = list[i];
				if(!p) continue;
				const x = p.x, y = p.y;
				if(!inView(x, y, 140, cam, vw, vh, 40)) continue;
				const trail = p.trail || '';
				const col = String(p.color || '');
				let spec = { r: 90, i: 0.38, c: [255, 210, 140] };
				if(trail === 'flame' || /ff[0-9a-f]{2}0|ff6|ff4|ff8/i.test(col)) spec = { r: 130, i: 0.62, c: [255, 130, 40] };
				else if(trail === 'ice' || /88|aae|ccf|aaf/i.test(col)) spec = { r: 110, i: 0.48, c: [150, 220, 255] };
				else if(trail === 'lightning' || /fff|ccf|aad/i.test(col)) spec = { r: 140, i: 0.70, c: [220, 230, 255] };
				else if(trail === 'sparkle') spec = { r: 100, i: 0.44, c: [220, 230, 255] };
				pushLight(lights, x, y, spec, scale);
			}
		}
		if(typeof projectiles !== 'undefined') addProj(projectiles, 1);
		if(typeof enemyProjectiles !== 'undefined') addProj(enemyProjectiles, 0.85);

		if(typeof trZones !== 'undefined'){
			for(let i = 0; i < trZones.length; i++){
				const z = trZones[i];
				if(!z) continue;
				const spec = z.type === 'burn' ? { r: (z.r || 40) + 80, i: 0.55, c: [255, 100, 20] }
					: z.type === 'heal' ? { r: (z.r || 40) + 70, i: 0.40, c: [80, 255, 140] }
					: { r: (z.r || 40) + 60, i: 0.32, c: [160, 220, 255] };
				pushLight(lights, z.x, z.y, spec);
			}
		}
		if(typeof gravityWells !== 'undefined'){
			for(let i = 0; i < gravityWells.length; i++){
				const gw = gravityWells[i];
				if(gw) pushLight(lights, gw.x, gw.y, { r: (gw.radius || 80) * 0.9, i: 0.35, c: [180, 140, 255] });
			}
		}
		if(typeof lightAnchors !== 'undefined'){
			for(let i = 0; i < lightAnchors.length; i++){
				const a = lightAnchors[i];
				if(a) pushLight(lights, a.x, a.y, { r: 130, i: 0.70, c: [255, 220, 80] });
			}
		}

		const ints = (d && d.interactables) || [];
		const theme = themeKey();
		const fallbackInt = theme === 'ice' ? { r: 150, i: 0.48, c: [150, 220, 255] }
			: (theme === 'jungle' || theme === 'earth') ? { r: 150, i: 0.48, c: [160, 255, 110] }
			: { r: 150, i: 0.48, c: [255, 170, 60] };
		for(let i = 0; i < ints.length; i++){
			const it = ints[i];
			if(!it || it.kind === 'banner' || it.kind === 'miniBossBanner' || it.kind === 'doorSign') continue;
			const spec = INT_LIGHT[it.kind] || specForName(it.kind || it.name) || fallbackInt;
			if(spec){
				const t = (typeof performance !== 'undefined' ? performance.now() : Date.now()) * 0.001;
				const seed = (it.x || 0) * 0.02 + (it.y || 0) * 0.014 + (it.kind || '').length;
				const pulse = 0.82 + Math.sin(t * 2.4 + seed) * 0.2;
				pushLight(lights, it.x + (it.w || 40) * 0.5, it.y + (it.h || 40) * 0.3, {
					r: spec.r * 1.38,
					i: spec.i * 1.32,
					c: spec.c
				}, (it.used ? 0.42 : 1.12) * pulse);
			}
		}

		if(iceBoss && d && d._bossRoomRect){
			const br = d._bossRoomRect;
			const fill = { r: 1100, i: 1.15, c: [190, 230, 255] };
			pushLight(lights, br.x + br.w * 0.5, br.y + br.h * 0.45, fill);
			pushLight(lights, br.x + br.w * 0.22, br.y + br.h * 0.4, fill);
			pushLight(lights, br.x + br.w * 0.78, br.y + br.h * 0.4, fill);
			pushLight(lights, br.x + br.w * 0.5, br.y + br.h * 0.72, { r: 900, i: 1.05, c: [170, 220, 255] });
		}

		for(let i = 0; i < _extra.length; i++) lights.push(_extra[i]);
		_extra.length = 0;
		return mergeLights(lights);
	}

	function castDistances(px, py, maxR, n){
		const T = tile();
		const step = Math.max(8, T * 0.28);
		if(!_dist || _dist.length !== n) _dist = new Float32Array(n);
		const jumped = Math.hypot(px - _lpx, py - _lpy) > 90 || _ldn !== n;
		_lpx = px; _lpy = py; _ldn = n;
		for(let i = 0; i < n; i++){
			const ang = (i / n) * Math.PI * 2;
			const dx = Math.cos(ang), dy = Math.sin(ang);
			let x = px, y = py, hit = maxR, into = 0;
			for(let d = 0; d < maxR + WALL_SEE; d += step){
				x += dx * step; y += dy * step;
				if(!blocksVision(Math.floor(x / T), Math.floor(y / T))){
					if(into) { hit = Math.min(maxR + WALL_SEE, d); break; }
					continue;
				}
				if(!into){
					into = 1;
					hit = Math.min(maxR + WALL_SEE, d + WALL_SEE);
				}
				if(d >= hit) break;
			}
			if(jumped || !_dist[i]) _dist[i] = hit;
			else _dist[i] += (hit - _dist[i]) * SMOOTH;
		}
		return _dist;
	}

	function fovPath(g, sx, sy, dist, n, extra){
		g.beginPath();
		g.moveTo(sx, sy);
		for(let i = 0; i <= n; i++){
			const k = i === n ? 0 : i;
			const ang = (k / n) * Math.PI * 2;
			const d = dist[k] + extra;
			g.lineTo(sx + Math.cos(ang) * d, sy + Math.sin(ang) * d);
		}
		g.closePath();
	}

	function draw(ctx){
		const city = inCityBuilding();
		if((typeof IS_DUNGEON === 'undefined' || !IS_DUNGEON) && !city) return;
		if(!city) _cityBlocks = null;
		if(!ctx || typeof camera === 'undefined' || typeof player === 'undefined') return;
		const cam = camera;
		const vw = ctx.canvas.width, vh = ctx.canvas.height;
		const px = player.x + player.w / 2, py = player.y + player.h * 0.42;
		const vow = (typeof vowVisibilityPenalty === 'number') ? Math.min(60, vowVisibilityPenalty) / 100 : 0;
		const heartwood = inHeartwood();
		const iceBoss = inIceBoss();
		const brightArena = heartwood || iceBoss;
		const iceVis = iceBoss ? 1.45 : (themeKey() === 'ice' ? 0.6 : 1);
		const maxR = MAX_VIEW * iceVis * (heartwood ? 1.55 : 1) * (1 - vow * 0.55);
		const n = (typeof _onlineLite !== 'undefined' && _onlineLite) ? 140 : RAYS;
		const dist = castDistances(px, py, maxR, n);
		const lights = collectLights(cam, vw, vh);
		const theme = themeKey();
		const fog = FOG[theme];
		const sx = px - cam.x, sy = py - cam.y;

		const bw = Math.max(2, vw >> 1), bh = Math.max(2, vh >> 1);
		if(!_buf || _bufW !== bw || _bufH !== bh){
			_buf = (typeof document !== 'undefined') ? document.createElement('canvas') : null;
			if(!_buf) return;
			_buf.width = bw; _buf.height = bh;
			_bufW = bw; _bufH = bh;
		}
		const g = _buf.getContext('2d');
		g.setTransform(bw / vw, 0, 0, bh / vh, 0, 0);
		g.globalCompositeOperation = 'source-over';
		g.globalAlpha = 1;
		g.fillStyle = 'rgba(' + fog[0] + ',' + fog[1] + ',' + fog[2] + ',' + (brightArena ? '0.18' : '0.94') + ')';
		g.fillRect(0, 0, vw, vh);

		g.globalCompositeOperation = 'destination-out';
		g.filter = 'blur(26px)';
		const sight = g.createRadialGradient(sx, sy, maxR * 0.08, sx, sy, maxR);
		sight.addColorStop(0, 'rgba(255,255,255,0.96)');
		sight.addColorStop(0.28, 'rgba(255,255,255,0.78)');
		sight.addColorStop(0.52, 'rgba(255,255,255,0.46)');
		sight.addColorStop(0.74, 'rgba(255,255,255,0.18)');
		sight.addColorStop(0.9, 'rgba(255,255,255,0.05)');
		sight.addColorStop(1, 'rgba(255,255,255,0)');
		g.fillStyle = sight;
		g.globalAlpha = 1;
		fovPath(g, sx, sy, dist, n, iceVis * 36);
		g.fill();
		g.filter = 'none';

		/* Dim veil, then punch lights so seen rooms stay readable. */
		g.globalCompositeOperation = 'source-over';
		g.globalAlpha = brightArena ? 0.03 : 0.20;
		g.fillStyle = 'rgba(' + fog[0] + ',' + fog[1] + ',' + fog[2] + ',1)';
		g.fillRect(0, 0, vw, vh);
		g.globalCompositeOperation = 'destination-out';
		g.globalAlpha = 1;
		const punchSpr = lightSprite('punch');
		for(let i = 0; i < lights.length; i++){
			const L = lights[i];
			const lx = L.x - cam.x, ly = L.y - cam.y;
			if(lx < -L.r || ly < -L.r || lx > vw + L.r || ly > vh + L.r) continue;
			g.globalAlpha = Math.min(0.95, L.i * (brightArena ? 0.98 : 0.85));
			g.drawImage(punchSpr, lx - L.r, ly - L.r, L.r * 2, L.r * 2);
		}
		g.globalAlpha = 1;

		ctx.save();
		ctx.imageSmoothingEnabled = true;
		ctx.drawImage(_buf, 0, 0, vw, vh);
		ctx.restore();

		ctx.save();
		ctx.globalCompositeOperation = 'lighter';
		for(let i = 0; i < lights.length; i++){
			const L = lights[i];
			if(L.i < (brightArena ? 0.12 : 0.1)) continue;
			const lx = L.x - cam.x, ly = L.y - cam.y;
			if(lx < -L.r || ly < -L.r || lx > vw + L.r || ly > vh + L.r) continue;
			if(blocksVision(Math.floor(L.x / tile()), Math.floor(L.y / tile()))) continue;
			// a tinted glow sprite (one per colour, cached) scaled to the light: no gradient built per light per frame
			const gr = L.r * (0.25 + 0.55 * Math.min(1, L.i));
			ctx.globalAlpha = (brightArena ? 0.34 : 0.2) * Math.min(1, L.i);
			ctx.drawImage(lightSprite(L.c), lx - gr, ly - gr, gr * 2, gr * 2);
		}
		ctx.restore();
	}

	/* light sprites: a soft white disc for punching the fog, and a glow per colour (cached, at most 32 colours) */
	const _spr = new Map();
	function lightSprite(c){
		const key = c === 'punch' ? 'punch' : (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0);
		let cv = _spr.get(key);
		if(cv) return cv;
		const S = 128;
		cv = document.createElement('canvas'); cv.width = cv.height = S;
		const g = cv.getContext('2d');
		const grd = g.createRadialGradient(S / 2, S / 2, 1, S / 2, S / 2, S / 2);
		if(key === 'punch'){
			for(const [o, a] of [[0, 1], [0.22, 0.62], [0.48, 0.32], [0.72, 0.12], [0.88, 0.04], [1, 0]]) grd.addColorStop(o, 'rgba(255,255,255,' + a + ')');
		} else {
			// the old glow: full colour at its centre fading to nothing at 0.55 of the light's radius, drawn over a disc of
			// that size — here the whole sprite is that disc
			grd.addColorStop(0, 'rgba(' + key + ',1)');
			grd.addColorStop(1, 'rgba(' + key + ',0)');
		}
		g.fillStyle = grd;
		g.fillRect(0, 0, S, S);
		if(_spr.size > 34) _spr.delete(_spr.keys().next().value);
		_spr.set(key, cv);
		return cv;
	}

	function addLight(x, y, r, intensity, color){
		_extra.push({
			x: x, y: y,
			r: r || 120,
			i: intensity == null ? 0.5 : intensity,
			c: color || [255, 200, 120]
		});
	}

	global.DungeonVision = { draw: draw, addLight: addLight };
})(typeof window !== 'undefined' ? window : globalThis);
