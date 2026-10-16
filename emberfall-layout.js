/* EmberFall layout — the whole EmberFall map: the Western Approach farms (I6–J6), EmberFall City on its castle crag
   (J6–K6) and the King's North Road (J6–J5). Hilly heightfield terrain, painted buildings, interiors you can
   walk into, and a living town. Public API kept as EmberfallCity (+ the EmberfallRoads hooks dungeon.html uses).
   Built on emberfall-art.js (painter), emberfall-world.js (terrain/collision/render), emberfall-interiors.js
   (rooms) and emberfall-life.js (walkers, birds, smoke, weather). */
(function (global) {
	'use strict';
	const A = global.EmberfallArt;
	const E = global.EmberfallWorld;
	const W = E.W;
	const TS = W.TS;
	const B = W.BASE;
	const M = W.M;

	const ITEMS = {
		ember_torch: { name: 'Travel Torch', type: 'consumable', icon: '🔦', rarity: 'common', stats: {}, price: 12, desc: 'A waxed torch for dark roads and dungeon mouths.' },
		ember_rations: { name: 'Travel Rations', type: 'consumable', icon: '🍞', rarity: 'common', stats: {}, price: 8, desc: 'Dense bread and dried fruit. Restores a little stamina later.' },
		ember_bandage: { name: 'Linen Bandage', type: 'consumable', icon: '🩹', rarity: 'common', stats: { magicDefence: 1 }, price: 18, desc: 'Field dressing used by the city watch.' },
		ember_herb: { name: 'River Mint', type: 'material', icon: '🌿', rarity: 'common', stats: {}, price: 10, desc: 'A common herb from the western gardens.' },
		ember_wood: { name: 'Seasoned Timber', type: 'material', icon: '🪵', rarity: 'common', stats: {}, price: 14, desc: 'Dry oak for repairs and simple crafts.' },
		ember_stone: { name: 'Cut Granite', type: 'material', icon: '🪨', rarity: 'common', stats: {}, price: 16, desc: 'Quarried blocks leftover from wall repairs.' },
		ember_hide: { name: 'Cured Hide', type: 'material', icon: '🦬', rarity: 'uncommon', stats: {}, price: 28, desc: 'Tanned hide from the outer farms.' },
		ember_crystal: { name: 'Aether Chip', type: 'gem', icon: '💎', rarity: 'uncommon', stats: { manaRegen: 2 }, price: 45, desc: 'A small charged crystal used in beginner foci.' },
		ember_ruby: { name: 'Cinder Ruby', type: 'gem', icon: '♦️', rarity: 'uncommon', stats: { magicPower: 2 }, price: 55, desc: 'Warm red gem popular with apprentice enchanters.' },
		ember_sapphire: { name: 'Frost Glass', type: 'gem', icon: '💠', rarity: 'uncommon', stats: { magicControl: 2 }, price: 55, desc: 'Pale blue glass that steadies spell aim.' },
		ember_potion_hp: { name: 'Amber Tonic', type: 'consumable', icon: '🧪', rarity: 'common', stats: {}, price: 22, desc: 'A healing draught from Korrin’s stills.' },
		ember_potion_mp: { name: 'Blue Vapor', type: 'consumable', icon: '🧴', rarity: 'common', stats: { manaRegen: 3 }, price: 24, desc: 'Restores a thread of mana over time.' },
		ember_token: { name: 'Dungeon Token', type: 'token', icon: '🎫', rarity: 'uncommon', stats: {}, price: 40, desc: 'A stamped token for authorized dungeon expeditions.' },
		ember_token_pack: { name: 'Token Bundle', type: 'token', icon: '🎟️', rarity: 'rare', stats: {}, price: 140, desc: 'Three dungeon tokens bound with wax.' }
	};
	const SHOPS = {
		general: { title: 'Mara’s Supplies', stock: ['ember_torch', 'ember_rations', 'ember_bandage', 'ember_herb'] },
		scrolls: { title: 'Orren’s Scrolls', stock: 'scrolls' },
		smith: { title: 'Ironhand Forge', stock: ['cinderwood_wand', 'scorched_apprentice_robes', 'coalheart_charm', 'ember_stone'] },
		gems: { title: 'Gemweaver Cases', stock: ['ember_crystal', 'ember_ruby', 'ember_sapphire'] },
		tokens: { title: 'Expedition Desk', stock: ['ember_token', 'ember_token_pack', 'ember_torch'] },
		advanced_scrolls: { title: 'Arclight Diagrams', stock: 'scrolls' },
		materials: { title: 'Mill’s Yard', stock: ['ember_wood', 'ember_stone', 'ember_hide', 'ember_herb'] },
		magegear: { title: 'Venn’s Accoutrements', stock: ['embercoil_staff', 'magmaweave_mantle', 'emberheart_ring', 'coalheart_charm'] },
		waystation: { title: 'Waystation Stores', stock: ['ember_rations', 'ember_herb', 'ember_stone'] },
		alchemy: { title: 'Ash Stillroom', stock: ['ember_potion_hp', 'ember_potion_mp', 'ember_herb'] },
		herbs: { title: 'Fen’s Baskets', stock: ['ember_herb', 'ember_potion_hp', 'ember_rations'] },
		rare: { title: 'Vesper’s Cabinet', stock: ['emberheart_ring', 'ember_sapphire', 'scroll_seeker'] },
		identify: { title: 'Fennick’s Appraisal', stock: ['ember_crystal'] }
	};

	/* ================================================================== builders */
	let bid = 0;
	function bld(type, x, spec, o) {
		o = o || {};
		const w = spec.w || 300;
		// whole pixels: a floor at a fractional height lets you slip through it when you walk in
		const y = Math.round(o.y != null ? o.y : E.surf(x + w / 2));
		// level the ground under it (also under placed buildings you can walk into, so the doorstep meets the floor)
		if (o.flat !== false && (o.y == null || o.room)) E.flatten(x - 30, x + w + 30, y);
		const b = {
			type, spec, x, y, w, key: o.key || (type + ':' + (bid++)), id: o.id || null, label: o.label || null,
			room: o.room || null, layer: o.layer || 'mid', scale: o.scale || 1, haze: o.haze || null, kind: o.kind || null,
			solid: o.solid || null, lockFlag: o.lockFlag || null, lockText: o.lockText || null
		};
		if (b.room) {
			let dx = w / 2 - 34;
			let dw = 68;
			if (type === 'house') {
				dw = spec.doorW || 58;
				dx = spec.door != null ? spec.door * w - dw / 2 : w / 2 - dw / 2;
			} else if (o.door) {
				dx = o.door.x;
				dw = o.door.w;
			}
			b.door = { x: x + dx, w: dw, y: o.doorY != null ? o.doorY : y };
		}
		W.bldgs.push(b);
		return b;
	}
	function house(x, spec, o) { return bld('house', x, spec, o); }
	function backHouse(x, spec, k, gyOff) {
		/* Rooftops behind the street: smaller and hazed so the city has depth. */
		const s = Object.assign({ lit: 0.5 }, spec);
		const w = (s.w || 260) * k;
		const y = E.surf(x + w / 2) + 34 - (gyOff || 0);
		W.back.push({ type: 'house', spec: s, x, y, w, key: 'back:' + (bid++), scale: k, haze: ['#a9bccd', 0.5] });
	}
	function prop(kind, name, x, h, o) {
		o = o || {};
		const p = { kind, name, x, y: o.y != null ? o.y : E.surf(x), h, flip: !!o.flip, layer: o.layer || 'mid', sink: o.sink || 0, sway: o.sway || 0, tint: o.tint || null, rot: o.rot || 0, alpha: o.alpha != null ? o.alpha : null };
		W.props.push(p);
		return p;
	}
	function tree(name, x, h, o) { return prop('flora', name, x, h, Object.assign({ sink: 10, sway: 0.012 }, o)); }
	function bush(name, x, h, o) { return prop('flora', name, x, h, Object.assign({ sink: 6 }, o)); }
	function road(name, x, h, o) { return prop('road', name, x, h, Object.assign({ sink: 6 }, o)); }
	function dress(name, x, h, o) { return prop('dress', name, x, h, o); }
	function plat(x, y, w, h, o) {
		const p = Object.assign({ x, y, w, h }, o || {});
		W.plats.push(p);
		return p;
	}
	function stairsArt(x0, x1, kind) { W.structs.push({ kind: 'steps', x0, x1, mat: kind || 'stone' }); }
	function retaining(x, top, bottom, w) { W.structs.push({ kind: 'retain', x, top, bottom, w: w || 60 }); }
	function water(x0, x1, y, bed, o) { W.water.push(Object.assign({ x0, x1, y, bed }, o || {})); }
	function lamp(x, o) { W.lamps.push(Object.assign({ x, y: E.surf(x) }, o || {})); }
	function fence(x0, x1, o) {
		for (let x = x0; x < x1 - 80; x += 205) road('fence', x + 100, 120, Object.assign({ sink: 4, layer: 'mid' }, o));
	}
	function district(x, name) { W.districts.push({ x, name }); }
	function bunting(x0, y0, x1, y1, sag, cols) { W.bunting.push({ x0, y0, x1, y1, sag: sag || 60, cols: cols || ['#c0392b', '#f1c40f', '#2e86c1', '#efe4cf', '#27ae60'] }); }
	function smoke(x, y, o) { W.smoke.push(Object.assign({ x, y, rate: 1 }, o || {})); }
	function rand(seed) { return A.rnd(seed); }

	function grove(x0, x1, every, names, hmin, hmax, seed, o) {
		const r = rand(seed);
		for (let x = x0; x < x1; x += every * (0.7 + r() * 0.6)) {
			const n = names[Math.floor(r() * names.length)];
			tree(n, x, hmin + r() * (hmax - hmin), Object.assign({ flip: r() < 0.5 }, o));
		}
	}
	function scatter(x0, x1, every, names, hmin, hmax, seed, o) {
		const r = rand(seed);
		for (let x = x0; x < x1; x += every * (0.6 + r() * 0.8)) {
			const n = names[Math.floor(r() * names.length)];
			bush(n, x, hmin + r() * (hmax - hmin), Object.assign({ flip: r() < 0.5 }, o));
		}
	}

	/* ================================================================== WEST APPROACH (I6–J6): 0 – 22000 */
	function layoutWest() {
		E.ground([
			[0, B - 120], [700, B - 120], [1500, B - 330], [1750, B - 420], [2400, B - 420], [3150, B - 200], [3400, B - 160],
			[6100, B - 160], [6950, B + 30], [7060, B + 40, 'l'], [7420, B + 420, 'l'], [7480, B + 430],
			[8480, B + 430, 'l'], [8540, B + 420, 'l'], [8860, B + 40], [9300, B + 40], [9330, B + 40, 'l'],
			[9360, B + 200, 'l'], [9440, B + 200, 'l'], [9470, B + 40], [10100, B + 40], [10700, B - 40], [11950, B - 40, 'l'],
			[12090, B - 160], [12550, B - 160, 'l'], [12690, B - 280], [13150, B - 280, 'l'], [13290, B - 400], [13700, B - 420],
			[14150, B - 560], [14500, B - 560], [15000, B - 360], [15700, B - 140], [16200, B - 80], [18400, B - 80],
			[18700, B - 40], [19900, B - 40], [20600, B - 20], [21000, B], [22000, B]
		]);
		E.rough(0, 3300, 26, 11);
		E.rough(10200, 11950, 18, 12);
		E.rough(13300, 16100, 34, 13);
		E.material(0, 22000, M.meadow);
		E.material(3500, 6000, M.dirt);
		E.material(6800, 7100, M.dirt);
		E.material(7100, 8840, M.sand);
		E.material(8840, 10100, M.dirt);
		E.material(14100, 14600, M.rock);
		E.material(16300, 18300, M.dirt);
		E.material(19900, 22000, M.cobble);
		E.rockBody(13900, 14700);
		district(0, 'Valedorn Fields');

		// ---- Valedorn Fields: wildflower meadow, hedgerow at the world's edge, the windmill hill
		grove(-80, 520, 120, ['oak0', 'oak1', 'birch0', 'oak2'], 360, 470, 21);
		scatter(60, 1500, 110, ['bush0', 'bush1', 'bush-flower0', 'bush-flower1'], 70, 110, 22);
		for (let x = 300; x < 1500; x += 140) bush(['flowers-white', 'flowers-gold', 'flowers-pink', 'flowers-blue'][(x / 140 | 0) % 4], x, 48, { layer: 'front', sink: 4 });
		bld('windmillBody', 1880, { w: 240, h: 470 }, { key: 'windmill', y: B - 420 });
		W.mills = [{ x: 1880 + 120, y: B - 420 - 470 + 40, r: 300 }];
		grove(2500, 3200, 230, ['oak1', 'apple0'], 330, 400, 23);
		road('sign', 820, 210, { sink: 6 });
		road('hay', 1250, 120);
		district(2600, 'Westmere Farm');

		// ---- Westmere Farm: farmhouse, barn, orchard and haystacks on a broad terrace
		house(3700, { w: 520, floors: 2, roof: 'thatch', wall: 'plaster', chimney: [0.25], shutters: '#4a6a3a', flowers: ['#d9708f', '#f2f0e6', '#f7d64a'], seed: 31 },
			{ id: 'approach-farm', label: 'Westmere Farmhouse', room: 'approach-farm', kind: 'farm' });
		smoke(3700 + 130, B - 160 - 30 - 300 - 160, { rate: 0.8 });
		house(4400, { w: 560, floors: 1, fh: 230, roof: 'thatch', wall: 'wood', frame: false, door: 0.5, doorW: 150, doorH: 180, archDoor: false, win: [2], gable: true, seed: 32 },
			{ id: 'approach-barn', label: 'Westmere Barn', room: 'approach-barn', kind: 'barn' });
		road('hay', 5080, 130);
		road('hay', 5180, 110, { flip: true });
		road('cart', 3460, 150);
		road('crates', 4330, 110);
		fence(5200, 6100);
		grove(5250, 6050, 200, ['apple0', 'apple1'], 300, 360, 24, { layer: 'back' });
		road('sacks', 3600, 100);
		for (let x = 3450; x < 6000; x += 300) bush('flowers-gold', x, 46, { layer: 'front' });
		district(6300, 'River Mill');

		// ---- the River Mill: stone bridge over the Valedorn, mill race and wheel on the east bank
		bld('bridge', 7080, { w: 1700, d: 330, arches: 3, moss: true }, { key: 'westbridge', y: B + 40, flat: false });
		plat(7040, B + 40, 1860, 40, { thin: true, oneway: true });
		water(7150, 8780, B + 330, B + 430, { flow: 1.6 });
		bush('reeds0', 7230, 120, { layer: 'front' });
		bush('reeds1', 8460, 110, { layer: 'front', flip: true });
		bush('reeds0', 7600, 90);
		bush('rock2', 7900, 90);
		bush('rock0', 8200, 70);
		bush('boulder1', 7260, 160, { layer: 'mid', sink: 20 });
		bush('rock3', 7360, 110, { sink: 14 });
		bush('boulder0', 8640, 170, { layer: 'mid', sink: 20, flip: true });
		bush('rock4', 8560, 90, { sink: 10 });
		grove(6400, 6950, 260, ['willow0', 'oak0'], 380, 440, 25, { layer: 'back' });
		water(9330, 9470, B + 100, B + 200, { flow: 2.6 });
		plat(9300, B + 40, 200, 30, { thin: true, art: 'planks' });
		W.wheels = [{ x: 9400, y: B + 60, r: 150 }];
		house(9520, { w: 480, floors: 2, roof: 'slate', wall: 'stone', frame: false, chimney: [0.8], archWin: true, seed: 33, sign: { side: 1, icon: 'wheat' } },
			{ id: 'river-mill', label: 'River Mill', room: 'river-mill', kind: 'mill' });
		road('sacks', 10150, 110);
		road('crates', 10260, 100);
		district(10300, 'Mill Field');

		// ---- Mill Field farmstead and the vineyard terraces
		house(10750, { w: 440, floors: 2, roof: 'red', wall: 'plaster', chimney: true, flowers: ['#f2f0e6', '#d9708f'], seed: 34 },
			{ id: 'mill-field', label: 'Mill Field Farmhouse', room: 'mill-field', kind: 'farm' });
		house(11300, { w: 420, floors: 1, fh: 200, roof: 'red', wall: 'wood', frame: false, door: 0.5, doorW: 130, doorH: 160, archDoor: false, win: [0], gable: true, seed: 35 },
			{ id: 'mill-field-barn', label: 'Mill Field Barn', room: 'mill-field-barn', kind: 'barn' });
		road('hay', 11800, 120);
		stairsArt(11950, 12090);
		retaining(11950, B - 160, B - 40, 140);
		stairsArt(12550, 12690);
		retaining(12550, B - 280, B - 160, 140);
		stairsArt(13150, 13290);
		retaining(13150, B - 400, B - 280, 140);
		for (const [a, b] of [[12100, 12530], [12700, 13130], [13300, 13650]]) {
			for (let x = a + 20; x < b; x += 70) bush('bush-berry0', x, 80, { layer: 'mid' });
		}
		district(13400, 'Thornwood Rise');

		// ---- Thornwood Rise: wooded ridge, rocky outcrop with a ruined watchtower
		grove(13350, 16100, 150, ['oak0', 'oak1', 'oak2', 'oak3', 'birch0', 'birch1', 'oak-big'], 380, 560, 26, { layer: 'back' });
		grove(13500, 16000, 380, ['oak3', 'birch2', 'oak1'], 420, 520, 27, { layer: 'mid' });
		scatter(13300, 16200, 120, ['bush0', 'bush2', 'fern0', 'fern1', 'bush3'], 60, 110, 28);
		bush('boulder0', 14080, 240, { layer: 'back' });
		bush('boulder1', 14620, 210, { layer: 'mid' });
		bld('tower', 14250, { w: 200, h: 380, roof: 'crenel', seed: 41, windows: false }, { key: 'ruin', y: B - 560 });
		W.ladders.push({ x: 14460, y0: B - 560 - 380, y1: B - 560 });
		plat(14240, B - 560 - 380 - 6, 220, 30, { thin: true });
		W.loots.push({ id: 'tower-cache', x: 14280, w: 120, y: B - 560 - 380, text: 'Under a loose capstone of the old tower: a bundle wrapped in oilcloth.', item: 'ember_crystal' });
		district(16100, 'Roadside Waystation');

		// ---- Roadside Waystation in the dip
		house(16500, { w: 620, floors: 2, roof: 'red', wall: 'plaster', jetty: true, chimney: [0.2, 0.8], lit: 0.6, shutters: '#6a3a2a', flowers: ['#f7d64a', '#d9708f'], seed: 36, sign: { side: 1, icon: 'key' }, lanterns: true, balcony: 1 },
			{ id: 'waystation', label: 'Roadside Waystation', room: 'waystation', kind: 'inn' });
		house(17300, { w: 460, floors: 1, fh: 200, roof: 'thatch', wall: 'wood', frame: false, door: 0.5, doorW: 140, doorH: 160, archDoor: false, gable: true, win: [0], seed: 37 },
			{ id: 'waystation-stable', label: 'Waystation Stable', room: 'waystation-stable', kind: 'barn' });
		road('tent', 18050, 200);
		road('wagon', 15950, 190);
		road('crates', 17220, 110);
		road('hay', 17860, 110);
		lamp(16380);
		lamp(17220);
		smoke(16500 + 124, B - 80 - 360 - 140, { rate: 1 });
		district(18450, 'Gate Field');

		// ---- Gate Field and the crossroads
		house(18750, { w: 420, floors: 2, roof: 'thatch', wall: 'plaster', chimney: [0.7], shutters: '#3a5a7a', seed: 38 },
			{ id: 'gate-field', label: 'Gate Field Farmhouse', room: 'gate-field', kind: 'farm' });
		house(19280, { w: 380, floors: 1, fh: 190, roof: 'red', wall: 'wood', frame: false, door: 0.5, doorW: 120, doorH: 150, archDoor: false, gable: true, win: [0], seed: 39 },
			{ id: 'gate-field-barn', label: 'Gate Field Barn', room: 'gate-field-barn', kind: 'barn' });
		fence(18450, 18720);
		road('cart', 19760, 150);
		district(19950, 'Ember Road Crossroads');
		road('sign', 20300, 250, { sink: 6 });
		road('banner', 20180, 300);
		road('banner', 20440, 300);
		W.joints.push({ x: 20220, w: 220, to: 57000, label: 'King’s North Road' });
		house(20620, { w: 300, floors: 1, fh: 200, roof: 'slate', wall: 'stone', frame: false, archWin: true, seed: 40 },
			{ id: 'checkpoint', label: 'Gate Checkpoint', room: 'checkpoint', kind: 'fort' });
		lamp(20560);
		lamp(20980);
		const talk = W.talk;
		const npc = W.npc;
		const P = (def) => W.npcs.push(npc(def));
		P({ id: 'gate_captain', name: 'Gate Captain', x: 20760, minX: 20560, maxX: 21100, icon: '🛡️', sprite: 'captain-guard',
			dialogue: {
				FIRST_MEETING: talk('Gate Captain', '🛡️', [
					'Emberfall takes in more travelers than any city for three valleys. Keep your weapons sheathed inside the walls.',
					'West is Valedorn and the farms. North — take the crossroads sign (press L there) — is the King’s North Road toward Frostmere. The city itself climbs the crag beyond this gate.'
				]),
				BASIC_DIALOGUE: talk('Gate Captain', '🛡️', ['The gate is open. The rules are not.'])
			} });
		P({ id: 'stablemaster', name: 'Stablemaster Brom', x: 17500, minX: 17320, maxX: 17760, icon: '🐴', sprite: 'inn-keeper',
			dialogue: {
				FIRST_MEETING: talk('Stablemaster Brom', '🐴', ['Horses rest here. Riders usually do too. I have no mount to sell you yet — just feed, a stall, and the news from the road.']),
				BASIC_DIALOGUE: talk('Stablemaster Brom', '🐴', ['If you hear hooves after dark, it is the patrol, not a story.'])
			} });
		P({ id: 'road_merchant', name: 'Traveling Merchant', x: 18120, minX: 17980, maxX: 18300, icon: '🛒', sprite: 'merchant', hubShop: 'waystation',
			dialogue: {
				FIRST_MEETING: talk('Traveling Merchant', '🛒', ['I change the crates every morning. Today’s stock is whatever the last wagon did not eat.']),
				BASIC_DIALOGUE: talk('Traveling Merchant', '🛒', ['Look again tomorrow. The unusual things never stay long.'])
			} });
		P({ id: 'millwright', name: 'Millwright Osric', x: 9700, minX: 9520, maxX: 10060, icon: '⚙️', sprite: 'black-smith',
			dialogue: {
				FIRST_MEETING: talk('Millwright Osric', '⚙️', ['This wheel turns the stones that feed the fields you just walked through. The river does the work. I only keep it honest.']),
				BASIC_DIALOGUE: talk('Millwright Osric', '⚙️', ['When the wheel stops, the bread stops. That is the whole lesson.'])
			} });
		P({ id: 'farmer_nell', name: 'Farmer Nell', x: 4260, minX: 3600, maxX: 4380, icon: '🌾', sprite: 'forest-ranger',
			dialogue: {
				FIRST_MEETING: talk('Farmer Nell', '🌾', ['The city starts where the paving starts. Everything west of that is still ours.', 'If you climb the windmill hill you can see the castle crag on a clear day.']),
				BASIC_DIALOGUE: talk('Farmer Nell', '🌾', ['If you are hungry, the waystation stew is honest. Mine is better.'])
			} });
		const tf = (x, minX, maxX, sprite, name, speed) => W.walkers.push({ x, minX, maxX, speed: speed || 0.45, sprite, name });
		tf(1200, 700, 2400, 'forest-ranger', 'Shepherd', 0.3);
		tf(5400, 4700, 6000, 'merchant', 'Farmhand', 0.4);
		tf(10400, 10200, 11800, 'inn-keeper', 'Miller’s Wife', 0.35);
		tf(16800, 16300, 18300, 'merchant', 'Traveler', 0.5);
		tf(19400, 18800, 20500, 'generic-guard', 'Road Warden', 0.45);
		for (const x of [900, 2700, 5600, 6600, 11400, 12900, 15200, 16000, 19000]) W.slimes.push({ x, w: 60, h: 46 });
		W.loots.push({ id: 'wagon-note', x: 15900, w: 160, text: 'A torn note under the axle: "They came out of the trees west of the mill. Do not camp on the open road."', item: 'ember_rations' });
		W.loots.push({ id: 'river-cache', x: 7520, w: 120, text: 'A crate wedged under the bridge arch. Someone meant to come back for it.', item: 'ember_herb' });
		W.loots.push({ id: 'farm-chest', x: 4500, w: 140, text: 'Under the loose board in the barn: a wrapped bundle the farmer pretends not to see.', item: 'ember_bandage' });
	}

	/* ================================================================== public bits filled in by the layout */
	function layout() {
		layoutWest();
		if (global.EmberfallLayoutCity) global.EmberfallLayoutCity({ E, W, A, B, M, bld, house, backHouse, prop, tree, bush, road, dress, plat, stairsArt, retaining, water, lamp, fence, district, bunting, smoke, grove, scatter, rand });
		if (global.EmberfallLayoutNorth) global.EmberfallLayoutNorth({ E, W, A, B, M, bld, house, backHouse, prop, tree, bush, road, dress, plat, stairsArt, retaining, water, lamp, fence, district, bunting, smoke, grove, scatter, rand });
		if (global.EmberfallFrontier) global.EmberfallFrontier({ E, W, A, B, M, bld, house, backHouse, prop, tree, bush, road, dress, plat, stairsArt, retaining, water, lamp, fence, district, bunting, smoke, grove, scatter, rand, ITEMS, SHOPS });
		W.districts.sort((a, b) => a.x - b.x);
	}

	global.EmberfallLayout = { ITEMS, SHOPS, layout, bld, house, prop, plat, tree, bush, road, dress };
})(typeof window !== 'undefined' ? window : globalThis);
