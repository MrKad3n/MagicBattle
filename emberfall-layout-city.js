/* EmberFall City (J6–K6): 22000 – 54000.
   West Gate → West Town on its rise → the Arches viaduct over the Ember Run ravine → the Market in the bowl →
   the Craft Quarter and canal → the Castle Approach climbing the crag → EmberKeep's ward on the summit →
   the Arcanum Terrace on the east shoulder (waterfall) → the long stair down → East Town → the closed East Gate. */
(function (global) {
	'use strict';
	global.EmberfallLayoutCity = function (K) {
		const { E, W, B, M, bld, house, backHouse, tree, bush, road, dress, plat, stairsArt, retaining, water, lamp, fence, district, bunting, smoke, grove, scatter } = K;
		const talk = W.talk;
		const npc = W.npc;

		E.ground([
			[21000, B], [23300, B], [23500, B - 40], [24550, B - 40], [24900, B - 160], [25960, B - 160, 'l'],
			[26360, B + 300, 'l'], [26440, B + 340], [27080, B + 340], [27150, B + 300, 'l'], [27330, B - 160], [27560, B - 160],
			[28150, B + 20], [31700, B + 20], [31790, B + 20, 'l'], [31840, B + 190, 'l'], [32160, B + 190, 'l'], [32210, B + 20],
			[33650, B + 20, 'l'], [34800, B - 380], [35260, B - 380, 'l'], [36400, B - 960], [36950, B - 960, 'l'], [37320, B - 1200],
			[44000, B - 1200, 'l'], [44040, B - 760], [46600, B - 760, 'l'], [47500, B], [47560, B], [47680, B + 90],
			[47820, B + 90], [47960, B], [53500, B], [53700, B - 80], [54000, B - 2600, 'l'], [56000, B - 2600]
		]);
		E.material(21000, 56000, M.cobble);
		E.material(25960, 26380, M.dirt);
		E.material(26380, 27150, M.meadow);
		E.material(27150, 27330, M.rock);
		E.material(31790, 32210, M.sand);
		E.material(35260, 36400, M.flag);
		E.material(47560, 47960, M.sand);
		E.material(53600, 56000, M.rock);
		E.rockBody(27100, 27360);
		E.rockBody(33900, 47400);
		E.rockBody(53650, 56000);

		/* ---------------------------------------------------------- West Gate */
		district(21000, 'Ember Road Gate');
		bld('gatehouse', 21300, { w: 760, h: 600, banner: '#9a2222', pennant: '#c0392b' }, { key: 'westgate', y: B });
		bld('wall', 20960, { w: 340, h: 420, slits: 120 }, { key: 'westwall-l', y: B, layer: 'mid' });
		district(22000, 'Western Gate');
		house(22180, { w: 380, floors: 2, roof: 'slate', wall: 'stone', frame: false, archWin: true, seed: 51, sign: { side: 1, icon: 'sword', color: '#3a3a5a' } },
			{ id: 'westfort', label: 'Western Fort', room: 'westfort', kind: 'fort' });
		road('crates', 22680, 110);
		road('sign', 22900, 200);
		lamp(22100);
		lamp(23100);
		backHouse(22600, { w: 300, floors: 3, roof: 'red', seed: 101 }, 0.72, 0);
		backHouse(22950, { w: 260, floors: 2, roof: 'slate', seed: 102 }, 0.72, 0);

		/* ---------------------------------------------------------- West Town on the rise */
		district(23300, 'West Town');
		house(23520, { w: 860, floors: 3, roof: 'red', wall: 'plaster', jetty: true, chimney: [0.15, 0.85], lit: 0.7, shutters: '#6a3a2a', flowers: ['#f7d64a', '#d9708f', '#f2f0e6'], seed: 52, sign: { side: 1, icon: 'mug', color: '#5a2a1a' }, lanterns: true, balcony: 2, dormer: true },
			{ id: 'inn', label: 'The Hearth-and-Key', room: 'inn', kind: 'inn' });
		smoke(23520 + 129, B - 40 - 30 - 450 - 260);
		smoke(23520 + 731, B - 40 - 30 - 450 - 260);
		house(24470, { w: 420, floors: 1, fh: 200, roof: 'thatch', wall: 'wood', frame: false, door: 0.5, doorW: 130, doorH: 160, archDoor: false, gable: true, win: [0], seed: 53 }, { key: 'stable-west' });
		road('hay', 24420, 100);
		road('cart', 24950, 140, { flip: true });
		house(25080, { w: 400, floors: 2, roof: 'red', wall: 'plaster', chimney: [0.7], shutters: '#3a5a7a', flowers: ['#d9708f'], seed: 54, gable: true },
			{ id: 'cottage', label: 'West Cottage', room: 'cottage', kind: 'cottage' });
		house(25520, { w: 360, floors: 3, roof: 'slate', wall: 'plaster', jetty: true, seed: 55, lit: 0.5 }, { key: 'tall-west' });
		for (const [x, k, sp] of [[23300, 0.7, { w: 320, floors: 3, roof: 'slate', seed: 103 }], [24300, 0.68, { w: 300, floors: 2, roof: 'red', seed: 104 }],
			[24750, 0.7, { w: 360, floors: 3, roof: 'red', jetty: true, seed: 105 }], [25300, 0.66, { w: 280, floors: 2, roof: 'slate', seed: 106 }]]) backHouse(x, sp, k, 0);
		lamp(24400);
		lamp(25000);
		bunting(23520 + 860, B - 40 - 360, 24470, B - 40 - 220, 40);
		bush('flowers-red', 23480, 46, { layer: 'front' });
		bush('flowers-gold', 24420 - 60, 46, { layer: 'front' });

		/* ---------------------------------------------------------- the Arches over the Ember Run */
		district(25900, 'The Arches');
		bld('bridge', 25930, { w: 1630, d: 560, arches: 3, moss: true }, { key: 'arches', y: B - 160, flat: false });
		plat(25920, B - 160, 1650, 40, { thin: true, oneway: true });
		stairsArt(25960, 26360, 'stone');
		water(26380, 27150, B + 296, B + 340, { flow: 1.2 });
		grove(26450, 27000, 220, ['willow0', 'oak0'], 330, 400, 61, { layer: 'back' });
		road('shrine', 26760, 230, { sink: 8 });
		for (const [x, n] of [[26480, 'flowers-white'], [26600, 'flowers-blue'], [26920, 'flowers-pink'], [27040, 'flowers-gold']]) bush(n, x, 50, { layer: 'front' });
		bush('reeds0', 26420, 100, { layer: 'front' });
		bush('fern1', 27060, 90);
		// ledges up the east wall of the ravine
		plat(27150, B + 160, 110, 22, { thin: true, art: 'corbel' });
		plat(27200, B - 20, 110, 22, { thin: true, art: 'corbel' });
		// the Undercroft: a cellar cut into the ravine's east wall
		W.voids.push({ x: 27150, y: B + 120, w: 640, h: 220, openL: true, arch: 60, wall: 'stone' });
		W.lamps.push({ x: 27500, y: B + 340, h: 110 });
		plat(27100, B + 340, 720, 60);
		plat(27100, B + 60, 720, 60);
		plat(27790, B + 60, 60, 340, { wall: true });
		dress('stores', 27650, 120, { y: B + 340 });
		dress('sewerarch', 27420, 200, { y: B + 340 });
		W.loots.push({ id: 'undercroft-cache', x: 27620, w: 120, y: B + 340, text: 'Behind the old barrels in the Undercroft: a sealed jar of coins and a note in an old city hand.', item: 'ember_ruby' });
		lamp(26450, { h: 120 });

		/* ---------------------------------------------------------- the Market in the bowl */
		district(27600, 'Market Square');
		for (let x = 27700, i = 0; x < 31800; x += 300 + (i % 3) * 40, i++) {
			backHouse(x, { w: 300 + (i % 4) * 30, floors: 2 + (i % 2), roof: ['red', 'slate', 'red', 'thatch'][i % 4], jetty: i % 2 === 0, seed: 110 + i }, 0.7, 0);
		}
		house(28220, { w: 480, floors: 2, roof: 'red', wall: 'plaster', chimney: [0.8], awning: ['#b8322a', '#efe4cf'], shutters: '#2a4a3a', flowers: ['#f7d64a', '#f2f0e6'], seed: 56, sign: { side: 1, icon: 'basket', color: '#3a2a1a' } },
			{ id: 'shop', label: 'Mara’s Supplies', room: 'shop', kind: 'shop' });
		bld('stall', 28900, { w: 220, cols: ['#2a7a4a', '#efe4cf'], seed: 3 }, { key: 'stall1' });
		bld('stall', 29180, { w: 200, cols: ['#c0392b', '#f4e1b0'], goods: ['#d9542a', '#f2c53a', '#a83a2a'], seed: 4 }, { key: 'stall2' });
		dress('fountain', 29560, 150);
		bld('stall', 29840, { w: 220, cols: ['#2e5a9a', '#efe4cf'], goods: ['#7fb03a', '#c9e06a', '#5a8a2a'], seed: 5 }, { key: 'stall3' });
		bld('stall', 30120, { w: 200, cols: ['#8a3a8a', '#f2e6f2'], goods: ['#e58bb0', '#f7d64a', '#ffffff'], seed: 6 }, { key: 'stall4' });
		house(30420, { w: 420, floors: 3, roof: 'slate', wall: 'plaster', jetty: true, lit: 0.5, seed: 57, flowers: ['#d9708f'] }, { key: 'market-tall' });
		road('crates', 30950, 120);
		road('sacks', 31080, 110);
		road('cart', 31280, 150);
		bunting(28220 + 480, B + 20 - 330, 29560, B + 20 - 220, 50);
		bunting(29560, B + 20 - 220, 30420, B + 20 - 380, 50, ['#2e86c1', '#f1c40f', '#efe4cf', '#c0392b']);
		lamp(28820);
		lamp(30380);
		lamp(31560);
		bush('flowers-red', 29420, 44, { layer: 'front' });
		bush('flowers-pink', 29700, 44, { layer: 'front' });

		/* ---------------------------------------------------------- Craft Quarter and the canal */
		district(31650, 'Craft Quarter');
		water(31790, 32210, B + 70, B + 190, { flow: 2, lined: true });
		bld('bridge', 31760, { w: 480, d: 170, arches: 1 }, { key: 'canalbridge', y: B + 20, flat: false });
		plat(31760, B + 20, 480, 30, { thin: true });
		house(32320, { w: 600, floors: 2, roof: 'slate', wall: 'stone', frame: false, chimney: [0.25], openDoor: true, doorW: 110, doorH: 130, archDoor: false, archWin: true, lit: 0.9, seed: 58, sign: { side: 1, icon: 'anvil', color: '#2a2a2a' } },
			{ id: 'forge', label: 'Ironhand Forge', room: 'forge', kind: 'forge' });
		smoke(32320 + 150, B + 20 - 30 - 300 - 210, { rate: 2.4, dark: true });
		house(33020, { w: 440, floors: 2, roof: 'red', wall: 'plaster', chimney: [0.7], lit: 0.8, shutters: '#2a5a3a', seed: 59, sign: { side: 1, icon: 'potion', color: '#2a3a2a' } },
			{ id: 'alchemy', label: 'Ash Stillroom', room: 'alchemy', kind: 'alchemy' });
		smoke(33020 + 308, B + 20 - 30 - 300 - 210, { rate: 0.9 });
		road('crates', 33500, 100);
		lamp(32260);

		/* ---------------------------------------------------------- the Castle Approach */
		district(33650, 'Castle Approach');
		for (let x = 33700; x < 34800; x += 260) lamp(x + 120, { h: 140 });
		bld('wall', 33720, { w: 1080, h: 120, crenel: true, moss: true }, { key: 'approach-wall', y: B + 20 - 0, layer: 'back' });
		bld('gatehouse', 34820, { w: 420, h: 420, tw: 140, archW: 150, archH: 230, banner: '#9a2222' }, { key: 'barbican', y: B - 380 });
		stairsArt(35260, 36400, 'stone');
		grove(35400, 36300, 300, ['pine0', 'pine1'], 300, 420, 71, { layer: 'back' });
		dress('knight', 36600, 150);
		dress('telescope', 36780, 110);
		lamp(36500);
		lamp(36900);
		stairsArt(36950, 37320, 'stone');
		bush('rock3', 35180, 90);
		// the crag is alive: shrubs and ferns in the cracks either side of the road, wind-bent pines on its shoulders
		scatter(33760, 37250, 150, ['bush0', 'bush1', 'bush2', 'fern0', 'fern1', 'rock1', 'bush-flower1'], 40, 84, 301, { layer: 'back' });
		scatter(33900, 37200, 420, ['fern0', 'flowers-white', 'fern1', 'flowers-gold'], 36, 56, 302, { layer: 'front' });
		grove(33950, 34700, 340, ['pine0', 'birch0', 'pine2'], 260, 360, 303, { layer: 'back' });
		bush('boulder1', 34500, 200, { layer: 'back' });

		// the old builders' passage: from the cliff path under the stair, through the crag, to the keep's foundations
		// (kept well below the stair surface so nothing pokes out of the slope)
		W.voids.push({ x: 36140, y: B - 700, w: 2500, h: 220, wall: 'stone', arch: 50 });
		plat(36100, B - 480, 2580, 60);
		plat(36100, B - 760, 2580, 60);
		plat(36100, B - 760, 40, 340, { wall: true });
		plat(38640, B - 760, 60, 340, { wall: true });
		W.lamps.push({ x: 36600, y: B - 480, h: 110 }, { x: 37500, y: B - 480, h: 110 }, { x: 38380, y: B - 480, h: 110 });
		W.structs.push({ kind: 'passageDoor', x: 38440, y: B - 480 });
		W.structs.push({ kind: 'passageDoor', x: 36160, y: B - 480 });
		// the old door in the retaining wall beside the stair, and the matching door inside the passage
		W.portals = W.portals || [];
		const sy = B - 380 - (35700 - 35260) * 580 / 1140;
		W.portals.push({ x: 35650, w: 110, y: sy, toX: 36200, toY: B - 480, label: 'the Old Passage' });
		W.portals.push({ x: 36160, w: 110, y: B - 480, toX: 35690, toY: sy, label: 'the cliff stair' });
		W.structs.push({ kind: 'passageDoor', x: 35650, y: sy, small: true });

		/* ---------------------------------------------------------- EmberKeep's ward on the summit */
		district(37300, 'EmberKeep — Gate');
		bld('gatehouse', 37330, { w: 760, h: 660, banner: '#9a2222', pennant: '#c0392b' }, { key: 'castlegate', y: B - 1200 });
		district(38100, 'Castle Ward');
		W.keepX = 38640;
		W.keepW = 3160;
		const keepB = bld('keep', W.keepX, { w: W.keepW, h: 760, banner: '#9a2222', pennant: '#c0392b' },
			{ key: 'keep', y: B - 1200, id: 'castle', label: 'EmberKeep', room: 'castle', door: { x: (0.42 + 0.09) * W.keepW - 70, w: 140 } });
		keepB.big = true;
		road('cart', 38250, 150);
		road('crates', 38450, 100);
		dress('fountain', 42050, 140);
		tree('blossom0', 41950, 330, { layer: 'back' });
		tree('blossom0', 42250, 300, { layer: 'back', flip: true });
		dress('planter', 41880, 70);
		dress('planter', 42200, 70);
		district(41820, 'Royal Gardens');
		house(42420, { w: 560, floors: 2, fh: 200, roof: 'slate', wall: 'stone', frame: false, gable: true, archWin: true, lit: 0.7, winW: 60, winH: 110, seed: 60 },
			{ id: 'chapel', label: 'Chapel of the Ember', room: 'chapel', kind: 'chapel' });
		bld('tower', 43140, { w: 180, h: 520, roof: 'cone', banner: '#9a2222', seed: 62 }, { key: 'chapel-bell' });
		bld('tower', 43520, { w: 200, h: 560, roof: 'cone', seed: 63, door: 'open' }, { key: 'postern' });
		lamp(38200);
		lamp(41900);
		lamp(43380);

		/* ---------------------------------------------------------- the Postern Stair and the Arcanum Terrace */
		district(43850, 'Postern Stair');
		// a flying stair down the east cliff, with the garden spring falling beside it
		W.stairs.push({ x: 44000, w: 820, y0: B - 1200, y1: B - 760 });
		W.structs.push({ kind: 'flystair', x0: 44000, x1: 44820, y0: B - 1200, y1: B - 760 });
		W.falls.push({ x: 44110, top: B - 1180, bottom: B - 740, w: 64, front: true });
		water(44060, 44380, B - 790, B - 760, { flow: 0.6 });
		bush('reeds0', 44360, 90, { layer: 'front' });
		bush('fern0', 44420, 80);
		district(44850, 'Arcanum Terrace');
		house(45000, { w: 560, floors: 2, roof: 'slate', wall: 'stone', frame: false, archWin: true, lit: 0.8, awning: ['#2a3a7a', '#d8d0f0'], seed: 64, sign: { side: 1, icon: 'scroll', color: '#2a2a4a' } },
			{ id: 'scrolls', label: 'Orren’s Scrolls', room: 'scrolls', kind: 'scrolls' });
		house(45760, { w: 520, floors: 2, roof: 'slate', wall: 'stone', frame: false, archWin: true, lit: 0.9, seed: 65, sign: { side: 1, icon: 'gem', color: '#3a2a4a' }, dormer: true },
			{ id: 'gems', label: 'Gemweaver', room: 'gems', kind: 'gems' });
		dress('runepillar', 46340, 170);
		dress('magewell', 46520, 120);
		for (const x of [44950, 45650, 46420]) lamp(x, { crystal: true });
		bush('flowers-blue', 46560, 50, { layer: 'front' });
		bush('flowers-white', 46460, 50, { layer: 'front' });

		/* ---------------------------------------------------------- the stair down and East Town */
		district(46600, 'Hundred Steps');
		stairsArt(46600, 47500, 'stone');
		grove(46700, 47400, 260, ['birch1', 'pine1'], 320, 400, 74, { layer: 'back' });
		scatter(46640, 47480, 140, ['bush1', 'fern1', 'bush-berry0', 'rock2', 'fern0'], 40, 80, 304, { layer: 'back' });
		scatter(46700, 47400, 380, ['flowers-pink', 'fern0'], 36, 52, 305, { layer: 'front' });
		scatter(43920, 44700, 160, ['fern0', 'bush0', 'fern1'], 40, 70, 306, { layer: 'back' });
		water(47560, 47960, B + 22, B + 90, { flow: 0.8 });
		bush('reeds1', 47600, 90, { layer: 'front' });
		bush('rock2', 47940, 70);
		district(48380, 'East Town');
		for (let x = 48500, i = 0; x < 52400; x += 320 + (i % 3) * 40, i++) {
			backHouse(x, { w: 300 + (i % 4) * 20, floors: 2 + (i % 2), roof: ['slate', 'red', 'thatch', 'red'][i % 4], jetty: i % 3 === 0, seed: 140 + i }, 0.7, 0);
		}
		district(48600, 'Training Yard');
		fence(48560, 48660);
		dress('armory', 49820, 130);
		dress('rack', 48620, 110);
		W.dummies.push({ x: 49000, y: B - 48 }, { x: 49220, y: B - 48 }, { x: 49440, y: B - 48 });
		district(49950, 'East Bailey');
		house(50000, { w: 500, floors: 2, roof: 'red', wall: 'plaster', chimney: [0.3], shutters: '#5a3a2a', seed: 66, sign: { side: 1, icon: 'map', color: '#3a2a1a' } },
			{ id: 'cartographer', label: 'Oric’s Map Room', room: 'cartographer', kind: 'maps' });
		house(50620, { w: 460, floors: 2, roof: 'slate', wall: 'stone', frame: false, archWin: true, seed: 67, sign: { side: 1, icon: 'key', color: '#2a2a3a' } },
			{ id: 'expedition', label: 'Expedition Desk', room: 'expedition', kind: 'desk' });
		house(51300, { w: 440, floors: 2, roof: 'thatch', wall: 'plaster', chimney: [0.75], flowers: ['#d9708f', '#f7d64a'], shutters: '#3a5a3a', seed: 68 },
			{ id: 'eastcottage', label: 'East Cottage', room: 'eastcottage', kind: 'cottage' });
		grove(51800, 52100, 200, ['oak1', 'apple1'], 320, 380, 73, { layer: 'back' });
		lamp(49900);
		lamp(51200);
		lamp(52000);
		bunting(50000 + 500, B - 330, 50620, B - 300, 30);
		district(52300, 'Eastern Gate');
		house(52040, { w: 360, floors: 2, roof: 'slate', wall: 'stone', frame: false, archWin: true, seed: 69, sign: { side: -1, icon: 'sword', color: '#3a3a5a' } },
			{ id: 'eastfort', label: 'Eastern Fort', room: 'eastfort', kind: 'fort' });
		bld('gatehouse', 52480, { w: 760, h: 600, banner: '#9a2222', closed: true }, { key: 'eastgate', y: B });
		bld('wall', 53240, { w: 420, h: 440, slits: 120 }, { key: 'eastwall', y: B });

		/* ---------------------------------------------------------- people */
		const P = (def) => W.npcs.push(npc(def));
		P({ id: 'rhea', name: 'Captain Rhea', x: 22500, minX: 22100, maxX: 23200, speed: 0.42, icon: '🛡️', sprite: 'captain-guard', district: 'Western Gate',
			dialogue: { FIRST_MEETING: talk('Captain Rhea', '🛡️', ['Hold. State your business in EmberFall.', 'The western gate is the kingdom’s first wall. Keep your staff lowered in the streets.']), BASIC_DIALOGUE: talk('Captain Rhea', '🛡️', ['The walls have stood longer than any of us. Do not test them.']) } });
		P({ id: 'tomas', name: 'Tomas Reed', x: 24700, minX: 24420, maxX: 25000, speed: 0.34, icon: '🐴', sprite: 'merchant',
			dialogue: { FIRST_MEETING: talk('Tomas Reed', '🐴', ['Horses, carts, and gossip — I keep all three fed.']), BASIC_DIALOGUE: talk('Tomas Reed', '🐴', ['If you hear thunder from the east, it is the forges, not a storm.']) } });
		P({ id: 'nella', name: 'Nella', x: 23960, minX: 23700, maxX: 24300, speed: 0.3, icon: '🍺', sprite: 'inn-keeper', inn: true,
			dialogue: { FIRST_MEETING: talk('Nella', '🍺', ['The Hearth-and-Key has beds, stew, and better rumors than the plaza criers.', 'Three floors and a balcony. The view of the castle is free; the stew is not.']), BASIC_DIALOGUE: talk('Nella', '🍺', ['If you need a name in this city, ask me after the evening rush.']) } });
		P({ id: 'elara', name: 'Sister Elara', x: 26700, minX: 26520, maxX: 26980, speed: 0.22, icon: '🕊️', sprite: 'eldery-sage',
			dialogue: { FIRST_MEETING: talk('Sister Elara', '🕊️', ['Peace on your steps. Few come down to the Ember Run shrine anymore.', 'The city was built over this stream. The Undercroft in the east wall is older than the Arches above us.']), BASIC_DIALOGUE: talk('Sister Elara', '🕊️', ['The banners look proud, but it is the wells and the kitchens that keep a city alive.']) } });
		P({ id: 'mara', name: 'Mara Vell', x: 28520, minX: 28300, maxX: 28800, speed: 0.4, icon: '🧺', sprite: 'artifact-dealer', hubShop: 'general',
			dialogue: { FIRST_MEETING: talk('Mara Vell', '🧺', ['Mara’s the name — if it fits in a pack, I have sold it twice.']), BASIC_DIALOGUE: talk('Mara Vell', '🧺', ['Need supplies? I restock whenever the wagons clear the gate.']) } });
		P({ id: 'harten', name: 'Harten Mill', x: 31050, minX: 30900, maxX: 31400, speed: 0.33, icon: '📦', sprite: 'merchant', hubShop: 'materials',
			dialogue: { FIRST_MEETING: talk('Harten Mill', '📦', ['Wood, stone, hide. No poetry — just stock.']), BASIC_DIALOGUE: talk('Harten Mill', '📦', ['If it can be stacked, I can sell it.']) } });
		P({ id: 'mira_fen', name: 'Mira Fen', x: 30000, minX: 29850, maxX: 30350, speed: 0.38, icon: '🌼', sprite: 'forest-ranger', hubShop: 'herbs',
			dialogue: { FIRST_MEETING: talk('Mira Fen', '🌼', ['Mint, tonic, and a warning: do not chew the blue ones.']), BASIC_DIALOGUE: talk('Mira Fen', '🌼', ['Need a draught? I keep the mild ones on the front table.']) } });
		P({ id: 'storyteller', name: 'The Old Storyteller', x: 29420, minX: 29250, maxX: 29780, speed: 0.2, icon: '📖', sprite: 'clock-keeper',
			dialogue: { FIRST_MEETING: talk('The Old Storyteller', '📖', ['EmberFall was a camp around a keep, once. The keep grew a kingdom, and the kingdom climbed the rock.']), BASIC_DIALOGUE: talk('The Old Storyteller', '📖', ['The castle is not the oldest thing here. Ask the stones under it, someday.']) } });
		P({ id: 'brannic', name: 'Brannic Ironhand', x: 32560, minX: 32360, maxX: 32880, speed: 0.32, icon: '🔨', sprite: 'black-smith', hubShop: 'smith',
			dialogue: { FIRST_MEETING: talk('Brannic Ironhand', '🔨', ['Forge is hot. If you want steel or a staff ferrule, say so.']), BASIC_DIALOGUE: talk('Brannic Ironhand', '🔨', ['Need metal? The anvil is not decorative.']) } });
		P({ id: 'korrin', name: 'Korrin Ash', x: 33280, minX: 33060, maxX: 33480, speed: 0.35, icon: '⚗️', sprite: 'apprentice-mage', hubShop: 'alchemy',
			dialogue: { FIRST_MEETING: talk('Korrin Ash', '⚗️', ['Do not touch the green flask. Or the orange one.']), BASIC_DIALOGUE: talk('Korrin Ash', '⚗️', ['If it bubbles, it is working. If it screams, run.']) } });
		P({ id: 'orren', name: 'Orren Vale', x: 45240, minX: 45020, maxX: 45560, speed: 0.29, icon: '📜', sprite: 'scroll-vendor', hubShop: 'scrolls',
			dialogue: { FIRST_MEETING: talk('Orren Vale', '📜', ['Ink, vellum, and the first shapes every mage should know.']), BASIC_DIALOGUE: talk('Orren Vale', '📜', ['Beginner scrolls on the left. Do not crease them.']) } });
		P({ id: 'selene', name: 'Selene Arclight', x: 45660, minX: 45560, maxX: 45760, speed: 0.31, icon: '✨', sprite: 'mage-student', hubShop: 'advanced_scrolls',
			dialogue: { FIRST_MEETING: talk('Selene Arclight', '✨', ['Most shops sell sparks. I sell questions that happen to explode.']), BASIC_DIALOGUE: talk('Selene Arclight', '✨', ['When you can hold a three-phase weave, come back.']) } });
		P({ id: 'eliora', name: 'Eliora Venn', x: 46300, minX: 46250, maxX: 46520, speed: 0.27, icon: '💍', sprite: 'artifact-dealer', hubShop: 'magegear',
			dialogue: { FIRST_MEETING: talk('Eliora Venn', '💍', ['I sell to numbers, not to fashion.']), BASIC_DIALOGUE: talk('Eliora Venn', '💍', ['If a piece does not list a stat, it is jewelry.']) } });
		P({ id: 'lyra', name: 'Lyra Gemweaver', x: 46020, minX: 45800, maxX: 46260, speed: 0.33, icon: '💎', sprite: 'apprentice-mage', hubShop: 'gems',
			dialogue: { FIRST_MEETING: talk('Lyra Gemweaver', '💎', ['Gems are not jewelry. They are bottled weather.']), BASIC_DIALOGUE: talk('Lyra Gemweaver', '💎', ['I can part with a few starter stones.']) } });
		P({ id: 'fennick', name: 'Fennick', x: 46380, minX: 46300, maxX: 46560, speed: 0.26, icon: '🔍', sprite: 'clock-keeper', hubShop: 'identify',
			dialogue: { FIRST_MEETING: talk('Fennick', '🔍', ['Bring me a stone you do not understand.']), BASIC_DIALOGUE: talk('Fennick', '🔍', ['A gem that is quiet is not always empty.']) } });
		P({ id: 'vesper', name: 'Vesper', x: 44600, minX: 44480, maxX: 44860, speed: 0.22, icon: '🕯️', sprite: 'eldery-sage', hubShop: 'rare',
			dialogue: { FIRST_MEETING: talk('Vesper', '🕯️', ['The cabinet opens for the curious.']), BASIC_DIALOGUE: talk('Vesper', '🕯️', ['Unusual things dislike being stared at too long.']) } });
		P({ id: 'garrick', name: 'Garrick', x: 48800, minX: 48660, maxX: 49700, speed: 0.4, icon: '⚔️', sprite: 'generic-guard',
			dialogue: { FIRST_MEETING: talk('Garrick', '⚔️', ['If you want a real yard, the castle barracks are stricter than mine.', 'Here: three dummies, no complaints. Hit them.']), BASIC_DIALOGUE: talk('Garrick', '⚔️', ['Cast, move, do not stand in your own fire.']) } });
		P({ id: 'darius', name: 'Darius Kell', x: 49640, minX: 49500, maxX: 49880, speed: 0.36, icon: '🗺️', sprite: 'forest-ranger', hubShop: 'tokens',
			dialogue: { FIRST_MEETING: talk('Darius Kell', '🗺️', ['Dungeons are not stories. They are holes that want you.']), BASIC_DIALOGUE: talk('Darius Kell', '🗺️', ['Come back when you want a harder hole in the ground.']) } });
		P({ id: 'oric', name: 'Oric the Cartographer', x: 50300, minX: 50050, maxX: 50500, speed: 0.3, icon: '🧭', sprite: 'scroll-vendor',
			dialogue: { FIRST_MEETING: talk('Oric the Cartographer', '🧭', ['J6 to K6 — that is us. The rest of the grid is waiting.', 'The city climbs the crag in three steps: the bowl, the ward, the terrace. Learn them and you will never be lost here.']), BASIC_DIALOGUE: talk('Oric the Cartographer', '🧭', ['The war room table is prettier. Mine has the roads that exist.']) } });
		P({ id: 'tavin', name: 'Tavin Dorr', x: 50860, minX: 50660, maxX: 51060, speed: 0.34, icon: '🎫', sprite: 'merchant', hubShop: 'tokens',
			dialogue: { FIRST_MEETING: talk('Tavin Dorr', '🎫', ['Expeditions leave with a token and come back with less arrogance.']), BASIC_DIALOGUE: talk('Tavin Dorr', '🎫', ['Need another token? The desk is open until the evening bell.']) } });
		P({ id: 'gardener', name: 'Gardener Ivo', x: 42080, minX: 41860, maxX: 42360, speed: 0.16, icon: '🌿', sprite: 'forest-ranger',
			dialogue: { FIRST_MEETING: talk('Gardener Ivo', '🌿', ['Royal gardens. The blossoms drink from the same spring that falls off the east cliff.', 'Do not carve the trees. The last one who did is still apologising.']), BASIC_DIALOGUE: talk('Gardener Ivo', '🌿', ['The chapel is east. The keep is west. The weeds are everywhere.']) } });
		P({ id: 'ward_guard', name: 'Ward Sergeant', x: 38300, minX: 38120, maxX: 38560, speed: 0.3, icon: '🛡️', sprite: 'generic-guard',
			dialogue: { FIRST_MEETING: talk('Ward Sergeant', '🛡️', ['The keep door is the big one under the banner. The chapel is past the gardens.', 'There is an old passage under the keep that comes out on the cliff path below. The warden keeps the key turned the other way.']), BASIC_DIALOGUE: talk('Ward Sergeant', '🛡️', ['Mind the stairs on the way down. Everybody does, eventually.']) } });
		P({ id: 'lookout', name: 'Lookout Pell', x: 36650, minX: 36450, maxX: 36900, speed: 0.2, icon: '🔭', sprite: 'generic-guard',
			dialogue: { FIRST_MEETING: talk('Lookout Pell', '🔭', ['From here you can see the whole bowl of the city, the Arches and the river road west.', 'On a clear day the North Road climbs out of sight beyond the fields.']), BASIC_DIALOGUE: talk('Lookout Pell', '🔭', ['Halfway up. The gate is just above.']) } });

		/* townsfolk */
		const tf = (x, minX, maxX, sprite, name, speed) => W.walkers.push({ x, minX, maxX, speed: speed || 0.45, sprite, name });
		tf(22400, 22100, 23300, 'generic-guard', 'Gate Guard', 0.5);
		tf(23000, 22300, 24400, 'merchant', 'Traveler');
		tf(24000, 23500, 25600, 'mage-student', 'Student');
		tf(25300, 24600, 25800, 'inn-keeper', 'Resident', 0.36);
		tf(28400, 28200, 31400, 'merchant', 'Shopper');
		tf(29000, 28300, 30800, 'spellcasting-child', 'Child', 0.7);
		tf(29700, 28800, 31300, 'eldery-sage', 'Old Man', 0.25);
		tf(30200, 29200, 31600, 'artifact-dealer', 'Peddler', 0.4);
		tf(30700, 28400, 31500, 'forest-ranger', 'Hunter', 0.5);
		tf(32600, 31900, 33500, 'black-smith', 'Apprentice Smith', 0.45);
		tf(33900, 33700, 34700, 'generic-guard', 'Patrol', 0.5);
		tf(38200, 38100, 38580, 'generic-guard', 'Castle Guard', 0.4);
		tf(42900, 42400, 43300, 'apprentice-mage', 'Acolyte', 0.35);
		tf(45400, 44950, 46500, 'mage-student', 'Scholar', 0.4);
		tf(46200, 45100, 46500, 'apprentice-mage', 'Acolyte', 0.38);
		tf(48600, 48400, 49900, 'generic-guard', 'Recruit', 0.55);
		tf(50500, 49900, 52300, 'merchant', 'Clerk', 0.4);
		tf(51500, 50300, 52300, 'inn-keeper', 'Resident', 0.36);
	};
})(typeof window !== 'undefined' ? window : globalThis);
