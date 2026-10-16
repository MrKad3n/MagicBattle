/* The King's North Road (J6–J5): 56000 – 78000, reached from the crossroads by the city gate (press L).
   Rolling farmland → Northwatch hill and tower → the Old Bridge over the deep gorge (broken in the middle) →
   the abandoned farmstead on the high meadow → pine forest and the royal hunter's camp → the cold climb to the
   pass and its shrine, with snow. */
(function (global) {
	'use strict';
	global.EmberfallLayoutNorth = function (K) {
		const { E, W, B, M, bld, house, tree, bush, road, dress, plat, stairsArt, retaining, water, lamp, fence, district, smoke, grove, scatter } = K;
		const talk = W.talk;
		const npc = W.npc;

		E.ground([
			[56000, B - 2600], [56500, B - 2600], [56800, B - 100, 'l'], [57600, B - 100], [58200, B - 200], [59500, B - 200],
			[60500, B - 300], [61800, B - 640], [62500, B - 640], [63300, B - 480], [63900, B - 480, 'l'], [64100, B + 300, 'l'],
			[64180, B + 420], [65480, B + 420, 'l'], [65520, B + 230], [65640, B + 230, 'l'], [65680, B + 40], [65800, B + 40, 'l'],
			[65840, B - 150], [65960, B - 150, 'l'], [66000, B - 340], [66090, B - 340, 'l'], [66120, B - 480], [66600, B - 480], [67200, B - 560],
			[68600, B - 560], [69400, B - 440], [70200, B - 500], [71000, B - 500], [72400, B - 700], [73600, B - 820],
			[74800, B - 960], [76300, B - 1100], [77700, B - 1100], [78000, B - 2600, 'l']
		]);
		E.rough(57600, 63300, 28, 81);
		E.rough(66600, 76200, 30, 82);
		E.material(56000, 78000, M.meadow);
		E.material(63300, 63900, M.dry);
		E.material(63900, 66120, M.rock);
		E.material(64180, 65520, M.sand);
		E.material(65800, 68600, M.dry);
		E.material(68600, 72400, M.cold);
		E.material(72400, 74800, M.cold);
		E.material(74800, 78000, M.snow);
		E.rockBody(56000, 56800);
		E.rockBody(63860, 66140);
		E.rockBody(77600, 78000);

		district(56500, 'King’s North Road');
		road('banner', 56950, 300);
		road('banner', 57250, 300);
		road('sign', 57120, 230);
		W.joints.push({ x: 56900, w: 260, to: 20300, label: 'Ember Road Crossroads' });
		grove(56820, 57100, 120, ['pine0', 'pine1'], 380, 460, 91, { layer: 'back' });

		district(57700, 'North Field');
		house(58300, { w: 460, floors: 2, roof: 'thatch', wall: 'plaster', chimney: [0.3], shutters: '#5a4a2a', seed: 81 },
			{ id: 'north-field', label: 'North Field Farmhouse', room: 'north-field', kind: 'farm' });
		smoke(58300 + 138, B - 200 - 330 - 230);
		house(58880, { w: 400, floors: 1, fh: 200, roof: 'thatch', wall: 'wood', frame: false, door: 0.5, doorW: 130, doorH: 160, archDoor: false, gable: true, win: [0], seed: 82 },
			{ id: 'north-field-barn', label: 'North Field Barn', room: 'north-field-barn', kind: 'barn' });
		fence(57650, 58250);
		fence(59350, 60200);
		for (const x of [57800, 58000, 59500, 59750]) road('hay', x, 110 + (x % 3) * 10);
		grove(59400, 60600, 260, ['oak0', 'oak2', 'birch0'], 360, 440, 92, { layer: 'back' });
		scatter(57400, 60500, 160, ['bush0', 'bush1', 'flowers-white', 'flowers-gold'], 50, 100, 93);

		district(60600, 'Northwatch');
		bld('tower', 61950, { w: 240, h: 640, roof: 'crenel', banner: '#4a5870', seed: 83, door: true }, { key: 'northwatch', y: B - 640, id: 'northwatch', label: 'Northwatch Tower', room: 'northwatch', kind: 'watch', door: { x: 120 - 34, w: 68 } });
		road('crates', 62300, 110);
		road('tent', 62500, 180);
		lamp(61880);
		bush('boulder1', 61500, 190, { layer: 'back' });
		grove(62600, 63300, 220, ['pine1', 'pine2'], 360, 460, 94, { layer: 'back' });

		district(63400, 'The Old Bridge');
		// gorge and river far below; the old trestle bridge has lost its middle span
		water(64140, 65560, B + 330, B + 420, { flow: 2.4, cold: true });
		plat(63860, B - 480, 900, 30, { thin: true, art: 'planks', oneway: true });
		plat(64900, B - 480, 1230, 30, { thin: true, art: 'planks', oneway: true });
		W.structs.push({ kind: 'trestle', x0: 63860, x1: 64760, deck: B - 480, bottom: B + 420 });
		W.structs.push({ kind: 'trestle', x0: 64900, x1: 66120, deck: B - 480, bottom: B + 420 });
		// the east wall of the gorge breaks into rock steps you can jump up
		bush('rock-cold0', 64400, 110);
		bush('reeds1', 64300, 100, { layer: 'front' });
		W.loots.push({ id: 'bridge-cache', x: 63700, w: 140, text: 'Tucked in the dry stones of the abutment: a traveler’s stash.', item: 'ember_stone' });
		W.loots.push({ id: 'gorge-cache', x: 65100, w: 140, y: B + 420, text: 'Caught between two rocks in the river: a waterlogged satchel with something still dry inside.', item: 'ember_sapphire' });

		district(66500, 'Abandoned Farmstead');
		house(67300, { w: 460, floors: 2, roof: 'thatch', wall: 'plaster', chimney: [0.3], lit: 0, seed: 84, tint: 'rgba(40,30,20,0.25)' },
			{ id: 'abandoned-farm', label: 'Abandoned Farmstead', room: 'abandoned-farm', kind: 'farm' });
		house(67880, { w: 380, floors: 1, fh: 190, roof: 'thatch', wall: 'wood', frame: false, door: 0.5, doorW: 120, doorH: 150, archDoor: false, gable: true, win: [0], lit: 0, seed: 85, tint: 'rgba(30,20,10,0.3)' },
			{ id: 'abandoned-barn', label: 'Abandoned Barn', room: 'abandoned-barn', kind: 'barn' });
		road('hay', 68380, 100);
		road('wheel', 66900, 90, { sink: 30 });
		W.loots.push({ id: 'farmstead-note', x: 67170, w: 110, text: 'A letter pinned to the fence by the house: "The northern wind came early. We are not waiting for the third night."', item: 'ember_rations' });
		grove(66600, 67200, 260, ['oak-autumn', 'birch2'], 360, 440, 95, { layer: 'back' });

		district(68700, 'Pinewood');
		grove(68650, 72300, 120, ['pine0', 'pine1', 'pine2', 'pine-snow0'], 420, 620, 96, { layer: 'back' });
		grove(68800, 72200, 330, ['pine1', 'pine2'], 460, 600, 97, { layer: 'mid' });
		scatter(68700, 72300, 170, ['fern0', 'fern1', 'rock1', 'bush2'], 50, 100, 98);
		district(70100, 'Hunter’s Camp');
		road('tent', 70450, 210);
		road('wagon', 70800, 190);
		road('crates', 70250, 110);

		district(72400, 'The Cold Approach');
		grove(72400, 76200, 180, ['pine-snow0', 'pine-snow1', 'pine-snow2'], 380, 560, 99, { layer: 'back' });
		scatter(72400, 77600, 260, ['rock-cold0', 'rock1'], 60, 140, 100);
		road('shrine', 77050, 280, { sink: 10 });
		road('sign', 76600, 210);

		const P = (def) => W.npcs.push(npc(def));
		P({ id: 'north_commander', name: 'Northwatch Commander', x: 62200, minX: 62000, maxX: 62440, icon: '🛡️', sprite: 'captain-guard',
			dialogue: {
				FIRST_MEETING: talk('Northwatch Commander', '🛡️', [
					'This tower watches the King’s North Road. Frostmere is beyond the passes. The things that come down from there do not always use the road.',
					'If you scout, look for tracks that stop in the middle of a field. That is never the wind.'
				]),
				BASIC_DIALOGUE: talk('Northwatch Commander', '🛡️', ['Report what you see. Do not decorate it.'])
			} });
		P({ id: 'pilgrim', name: 'Pilgrim', x: 77150, minX: 76900, maxX: 77450, icon: '🕯️', sprite: 'eldery-sage',
			dialogue: {
				FIRST_MEETING: talk('Pilgrim', '🕯️', ['Three roads left this shrine once. Two grew shut. The one that remains still climbs toward the cold.']),
				BASIC_DIALOGUE: talk('Pilgrim', '🕯️', ['The north does not hurry. Neither should you.'])
			} });
		P({ id: 'royal_hunter', name: 'Royal Hunter', x: 70600, minX: 70300, maxX: 70950, icon: '🏹', sprite: 'forest-ranger',
			dialogue: {
				FIRST_MEETING: talk('Royal Hunter', '🏹', ['Wolves work the tree line. Slimes keep to the wet grass. I pay attention to both, and to anything that is neither.', 'Someone fell into the gorge last spring. If you ever do the same, the east wall breaks into rock steps you can climb.']),
				BASIC_DIALOGUE: talk('Royal Hunter', '🏹', ['Bring me news of a pack and I will remember your name.'])
			} });
		for (const x of [57900, 59900, 60900, 63100, 66800, 69000, 71200, 73400, 75400, 76900]) W.slimes.push({ x, w: 60, h: 46 });
		W.walkers.push({ x: 58600, minX: 57800, maxX: 59800, speed: 0.35, sprite: 'merchant', name: 'Farmhand' });
		W.walkers.push({ x: 62100, minX: 61700, maxX: 62500, speed: 0.4, sprite: 'generic-guard', name: 'Sentry' });
	};
})(typeof window !== 'undefined' ? window : globalThis);
