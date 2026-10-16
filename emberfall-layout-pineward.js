/* I5–I4 — The Pineward Rise (104000 – 126000; walking right = north).
   The quiet western road toward the Frostmere foothills: an old trade road into the pines with weathered markers,
   Pinewatch Lodge in its clearing (and its locked storeroom), the Broken Milepost and its three stones, the
   forgotten settlement of Hollowmere, the windfall where the wolves hunt, the Barkhide's hollow, the Coldstone Cut
   excavation, and the high rocky shelf at I4 where the first frost lies in the shadows. */
(function (global) {
	'use strict';
	(global.EmberfallFrontierSegs = global.EmberfallFrontierSegs || []).push(function (k) {
		const { E, W, A, B, M, bld, house, tree, bush, road, dress, plat, water, lamp, district, grove, scatter, fence, F, talk } = k;
		const X = 104000;
		const x = (u) => X + u;
		k.region('pineward', X, 'The Pineward Rise', 'I5 — I4');

		/* ------------------------------------------------------------ the land */
		const G = (pts) => E.ground(pts.map(([u, y, m]) => m ? [x(u), B + y, m] : [x(u), B + y]));
		k.ends(X, B - 520, B - 1300);
		G([
			[620, -520], [1400, -540], [2300, -560],
			// Pinewatch clearing
			[2500, -580], [4500, -590], [5000, -620],
			// the milepost rise
			[5600, -660], [6400, -700], [7400, -720],
			// Hollowmere: a hollow among the trees
			[7900, -690], [8800, -660], [10000, -680], [10900, -720],
			// the windfall: broken ground, rock steps
			[11400, -800], [11700, -800], [11900, -890], [12300, -900], [12500, -960], [13000, -980], [13900, -1000],
			// the Coldstone Cut: spoil heaps before a cut hillside
			[14500, -1010], [15100, -1040], [15350, -1020], [15600, -1040], [16200, -1060], [16700, -1110], [17300, -1140],
			// up onto the high shelf
			[17800, -1180], [18400, -1240], [19000, -1290], [19800, -1300], [21380, -1300]
		]);
		E.rough(x(620), x(2400), 16, 401);
		E.rough(x(5000), x(7400), 18, 402);
		E.rough(x(10900), x(13900), 30, 403);
		E.rough(x(17300), x(19800), 20, 404);
		E.material(x(600), x(21400), M.meadow);
		E.material(x(700), x(7400), M.dirt);
		E.material(x(11300), x(13000), M.rock);
		E.material(x(14400), x(16900), M.dry);
		E.material(x(17200), x(21400), M.rock);
		for (const [a, b] of [[17900, 18300], [18700, 19100], [19600, 20100], [20500, 20800], [21000, 21380]]) E.material(x(a), x(b), M.frost);
		E.rockBody(x(11300), x(12600));
		E.rockBody(x(17400), x(21400));
		E.zone(x(0), x(14000), 'pine', 0.36, 0.48);
		E.zone(x(14000), x(22100), 'frostpine', 0.48, 0.68);

		/* ------------------------------------------------------------ I5: the trade road */
		district(x(600), 'The Old Trade Road');
		k.junction(x(640), [
			{ label: 'The Upper Millstream', way: 'South', to: 'I5_mill', point: -1 },
			{ label: 'The Frostline Causeway', way: 'East', to: 'I5_cause', point: 1 }
		]);
		grove(x(620), x(7600), 190, ['pine0', 'pine1', 'pine2', 'spruce0', 'spruce1'], 460, 660, 601, { layer: 'back' });
		grove(x(1200), x(2300), 340, ['pine1', 'spruce0', 'birch1'], 480, 620, 602);
		scatter(x(620), x(7600), 150, ['fern0', 'fern1', 'bush2', 'rock1', 'heather0'], 50, 100, 603);
		// old stone markers along the road
		for (const [u, g] of [[1500, 'ᚱ'], [4900, 'ᛉ']]) {
			bld('marker', x(u), { w: 80, h: 140, seed: u, stones: [{ x: 40, w: 46, h: 120, lean: 0.03, glyph: g }] }, { key: 'pwmark' + u });
		}
		k.lore(x(1540), 'the road marker', 'Trade road marker', ['A waist-high stone, cut with a wheel and a pine: this was a King’s road once, kept and taxed. Pineward — and north of it, Frostmere — paid in timber and furs.']);
		bush('log1', x(2000), 110, { sink: 14, rot: 0.03 });

		/* ------------------------------------------------------------ Pinewatch Lodge */
		district(x(2400), 'Pinewatch Lodge');
		const lodge = house(x(3000), { w: 560, floors: 2, fh: 170, roof: 'slate', wall: 'logs', chimney: [0.2], shutters: '#3a2a1a', lit: 0, seed: 610, plinth: 34, win: [2, 3] },
			{ id: 'pinewatch', label: 'Pinewatch Lodge', room: 'pinewatch', kind: 'lodge' });
		const store = house(x(3680), { w: 260, floors: 1, fh: 170, roof: 'thatch', wall: 'logs', door: 0.5, doorW: 70, seed: 611, plinth: 20, win: [0] },
			{ id: 'pinewatch-store', label: 'the Lodge Storeroom', room: 'pinewatch-store', kind: 'storeroom' });
		store.lockFlag = 'pinewatch_key';
		store.lockText = 'The storeroom is locked. An iron padlock — someone must have kept the key nearby.';
		road('crates', x(3990), 90);
		bush('stump0', x(4120), 70);
		bush('log0', x(4240), 90, { sink: 12 });
		// the key, hidden under the woodpile
		k.loot('pinewatch-key', x(4180), 'Under the split logs of the woodpile: an iron key on a leather loop. Pinewatch Key.', 'lodge_key', { where: 'the woodpile', onTake: (api) => api.setFlag('pinewatch_key') });
		// letters and journals inside the lodge
		const gy = lodge.y;
		k.lore(x(3460), 'the journal on the desk', 'Garrow’s journal', [
			'"Third winter at Pinewatch. The Hollowmere folk come up for traps and salt. Good people. Poor."',
			'"The cold came down the Cut early this year. The miners say the ice in the lower galleries is moving."',
			'"Hollowmere is leaving. I said I would stay until the last cart was gone. The storeroom key is where I keep the axe."'
		], { room: 'pinewatch', y: gy, icon: '📓' });
		k.lore(x(3120), 'a letter by the hearth', 'A letter, never sent', [
			'"Maren — the miners broke into something at the bottom of the Cut. Not a cavern. A hall. Cold enough to burn."',
			'"We sealed the main gallery. I am taking the last of Hollowmere’s children down to the Millstream. If you come looking, look south. — Garrow"'
		], { room: 'pinewatch', y: gy, icon: '✉️' });
		k.loot('pinewatch-store', x(3800), 'Garrow’s stores: furs, a good knife and a sealed jar of honey. On the lid: "for whoever needs it".', 'fur_mittens',
			{ room: 'pinewatch-store', y: store.y, extra: ['frost_draught', 'ember_rations'], where: 'the shelves' });
		// Edda's camp by the lodge
		road('tent', x(2620), 180);
		k.npc({ id: 'edda', name: 'Edda, the Pathfinder', x: x(2760), minX: x(2700), maxX: x(2860), icon: '🧭', sprite: 'forest-ranger', tall: 104,
			getDialogue() {
				const L = (a) => talk('Edda, the Pathfinder', '🧭', a);
				if (!F.flag('edda_marks')) {
					F.setFlag('edda_marks');
					return L(['Sit, if you like. The fire’s free; the advice costs a story.',
						'Pinewatch was Garrow’s. He kept it open for Hollowmere until the end. Look around the lodge — he wrote everything down.',
						'Give me your map. There — and there. I’ve marked the caches the trappers left along this road. You’ll see them glint now that you know where to look.']);
				}
				return L(['The milepost up the road tells you where the old villages were — if you read all three little stones.', 'Past the Cut the trees thin out and the shelf runs east under the mountains. That’s the Highland Traverse. Lovely in summer. It is never summer.']);
			} });
		// caches the trappers left — Edda marks them on your map
		const marked = () => F.flag('edda_marks');
		k.loot('trapper1', x(1900), 'A trapper’s cache in a hollow log: snares, wire, and a twist of jerky.', 'ember_rations', { hidden: true, reveal: marked, where: 'the hollow log' });
		k.loot('trapper2', x(9800), 'A cache under a flat stone by the ruined well: a tin of resin and a whetstone.', 'pine_resin', { hidden: true, reveal: marked, where: 'the flat stone' });
		k.loot('trapper3', x(13600), 'Wedged in the roots of a fallen pine: a sealed tin of tonic.', 'ember_potion_hp', { hidden: true, reveal: marked, where: 'the roots' });
		// tracks to the den: the wolves that hunt around the clearing
		district(x(4300), 'The Den Trail');
		k.foe('thornWolf', x(4500), { range: 240 });
		k.foe('thornWolf', x(4800), { range: 200 });
		bush('boulder0', x(4650), 170, { sink: 20 });
		// the ridge above the lodge (a flight shortcut someday)
		const ridgeY = Math.round(E.surf(x(2200)) + 20);
		bld('crag', x(2050), { w: 300, h: 640, seed: 612, flat: 0.55 }, { key: 'pwcrag', y: ridgeY, layer: 'back', flat: false });
		plat(x(2130), ridgeY - 640, 150, 22, { thin: true, oneway: true });
		k.loot('lodge-ridge', x(2205), 'On the bare top of the ridge above Pinewatch: a cairn, and in it a fine pair of mittens and a note — "Frostmere is two days that way. Fly, if you can."', 'fur_mittens', { y: ridgeY - 640, where: 'the cairn' });

		/* ------------------------------------------------------------ the Broken Milepost */
		district(x(5200), 'The Broken Milepost');
		bld('marker', x(5480), { w: 240, h: 300, seed: 620, post: { x: 120, h: 260, w: 66, lean: 0.06 } }, { key: 'milepost' });
		bld('marker', x(5150), { w: 90, h: 120, seed: 621, stones: [{ x: 45, w: 38, h: 92, lean: -0.12, glyph: 'ᚺ' }] }, { key: 'mstone1' });
		bld('marker', x(5980), { w: 90, h: 120, seed: 622, stones: [{ x: 45, w: 36, h: 86, lean: 0.1, glyph: 'ᛗ' }] }, { key: 'mstone2' });
		bld('marker', x(6420), { w: 90, h: 120, seed: 623, stones: [{ x: 45, w: 34, h: 80, lean: 0.2, glyph: 'ᛞ' }] }, { key: 'mstone3' });
		k.lore(x(5600), 'the broken milepost', 'The Broken Milepost', [
			'A tall stone, split by frost. You can still read: "EMBERFALL · XL LEAGUES" on one face, and on the other only "...MERE" and "...NE".',
			'Three small stones lean around it, each turned toward a different part of the forest.'
		]);
		const readStone = (n, text) => (p, api) => {
			api.setFlag('stone_' + n);
			const all = F.flag('stone_1') && F.flag('stone_2') && F.flag('stone_3');
			api.say([{ name: 'A pointing stone', icon: '🪨', text }].concat(all && !F.flag('stones_done') ? [{ name: 'The three stones', icon: '🪨', text: 'Read together, the three marks make a line: Hollowmere, the Cut, and — between them, off the road — a cache "under the twin pines". The trappers used these stones as a map.' }] : []));
			if (all) api.setFlag('stones_done');
		};
		k.use(x(5195), 'the leaning stone', readStone(1, 'Carved with ᚺ and a little house: HOLLOWMERE, it points north-west, into the trees. Two days’ walk, once.'), { verb: 'read' });
		k.use(x(6025), 'the grey stone', readStone(2, 'Carved with ᛗ and a pick: THE CUT. It points north, up the road.'), { verb: 'read' });
		k.use(x(6465), 'the tipped stone', readStone(3, 'Carved with ᛞ — and a pair of trees, scratched in later by a different hand.'), { verb: 'read' });
		tree('pine2', x(7150), 640);
		tree('pine2', x(7280), 600, { flip: true });
		k.loot('twin-pines', x(7215), 'Between the twin pines, under a cairn of mossy stones: the trappers’ hidden cache.', 'ember_crystal',
			{ hidden: true, reveal: () => F.flag('stones_done'), extra: ['old_compass'], where: 'the cairn' });

		/* ------------------------------------------------------------ Hollowmere, the forgotten settlement */
		district(x(7600), 'Hollowmere (abandoned)');
		grove(x(7600), x(11000), 170, ['pine0', 'spruce1', 'pine1', 'dead0', 'birch2'], 440, 640, 630, { layer: 'back' });
		bld('ruin', x(7950), { w: 460, h: 220, seed: 631, windows: [[0.25, 0.7, 44, 60]], arch: [0.6, 90, 160] }, { key: 'hm1' });
		bld('ruin', x(8800), { w: 380, h: 170, seed: 632, windows: [[0.5, 0.75, 40, 50]] }, { key: 'hm2' });
		bld('ruin', x(9900), { w: 520, h: 250, seed: 633, windows: [[0.2, 0.7, 44, 60], [0.7, 0.7, 44, 60]], arch: [0.42, 90, 160] }, { key: 'hm3' });
		fence(x(8400), x(8800));
		fence(x(9300), x(9800));
		road('wheel', x(8600), 80, { sink: 26, rot: 0.3 });
		road('shrine', x(9650), 200, { sink: 10 });
		bush('dead1', x(9200), 520);
		k.lore(x(9650), 'the village shrine', 'Hollowmere shrine', ['Names carved in rows: thirty-one families, and the year they came. At the bottom, fresher: "Gone south with Garrow. Come find us at the Millstream."']);
		k.foe('mossWraith', x(8300), { range: 260 });
		k.foe('mossWraith', x(10200), { range: 240 });
		// Bram and his frostcap patches in the shade of the ruins
		const picked = (n) => F.flag('frostcap_' + n);
		for (const [n, u] of [[1, 8150], [2, 9450], [3, 10500]]) {
			bush('fern1', x(u), 70, { tint: 'rgba(220,240,240,0.35)' });
			k.use(x(u), 'the frostcap moss', (p, api) => {
				if (picked(n)) { api.say([{ name: 'Frostcap moss', icon: '🍃', text: 'You already took what was worth taking here.' }]); return; }
				api.setFlag('frostcap_' + n);
				api.give('frostcap');
				api.say([{ name: 'Frostcap moss', icon: '🍃', text: 'Pale moss, stiff with frost even at noon. You peel a handful off the stone.' }]);
			}, { verb: 'gather' });
		}
		k.taskNpc({ id: 'bram', name: 'Bram, the Herb Gatherer', x: x(9060), minX: x(8950), maxX: x(9200), icon: '🌿', sprite: 'inn-keeper', tall: 98, hubShop: 'bram' }, {
			id: 'frostcap',
			intro: ['Frostcap! It only grows where the frost touches every night — in the shade of these old walls.', 'My knees won’t take the kneeling. Bring me three handfuls from around the ruins and I’ll make it worth your while. And I sell a few things, if you need them.'],
			waiting: ['Three patches of frostcap. Look in the shade of the walls — pale, stiff, a bit sad-looking.'],
			need: () => picked(1) && picked(2) && picked(3),
			done: ['Beautiful. That’s a winter’s worth of chest-salve. Here — and anything else you need, ask.'],
			after: ['The old Hollowmere folk used frostcap for burns. Odd, for something so cold.'],
			reward: ['ember_potion_hp', 'frost_draught']
		});

		/* ------------------------------------------------------------ the windfall */
		district(x(11000), 'The Windfall');
		grove(x(11000), x(14400), 200, ['pine1', 'spruce0', 'pine2', 'dead1', 'spruce1'], 440, 640, 640, { layer: 'back' });
		for (const [u, h, r] of [[11250, 120, 0.04], [12050, 100, -0.05], [12700, 130, 0.02], [13350, 110, 0.06]]) bush(u % 2 ? 'log1' : 'log0', x(u), h, { sink: 16, rot: r });
		for (const u of [11550, 12200, 12900]) bush('stump0', x(u), 60);
		k.stairs(x(11700), x(11900));
		k.stairs(x(12300), x(12500));
		scatter(x(11000), x(14400), 180, ['rock1', 'rock3', 'fern0', 'bush2'], 50, 110, 641);
		k.foe('thornWolf', x(12100), { range: 220 });
		k.foe('thornWolf', x(12450), { range: 180 });
		// the Barkhide's hollow: a clearing with a cache, guarded
		district(x(13100), 'Barkhide Hollow');
		k.foe('elderTreant', x(13500), { hp: 1600, name: 'Old Barkhide', range: 160, detect: 420 });
		k.loot('barkhide', x(13900), 'Behind the Barkhide’s roots: a moss-grown chest that has been here longer than the road.', 'ember_sapphire', { extra: ['pine_resin'], where: 'the old chest', icon: '🌳' });

		/* ------------------------------------------------------------ the Coldstone Cut */
		district(x(14500), 'The Coldstone Cut');
		grove(x(14400), x(17400), 260, ['pine-frost0', 'spruce0', 'dead0', 'pine1'], 420, 600, 650, { layer: 'back' });
		// spoil heaps, carts and the collapsed main gallery
		bush('rock-cold0', x(14800), 120, { sink: 10 });
		bush('boulder1', x(15050), 200, { sink: 24 });
		road('wagon', x(15600), 150, { rot: 0.1 });
		road('crates', x(15760), 90);
		bld('mineMouth', x(16050), { w: 220, h: 220, sign: 'COLDSTONE · MAIN', boards: true }, { key: 'cutmain' });
		bld('ruin', x(15880), { w: 120, h: 80, seed: 651, profile: () => 0.9 }, { key: 'cutrubble' });
		k.lore(x(16160), 'the boarded gallery', 'The main gallery', ['Rubble and fallen timbers choke the main gallery. Painted on the boards: "SEALED BY ORDER — DO NOT DIG".', 'Cold breathes out between the planks, colder than the morning.']);
		k.foe('bandit', x(15350), { range: 160 });
		k.foe('banditSlinger', x(15900), { range: 120 });
		k.foe('bandit', x(16500), { range: 160 });
		// the side passage — still open
		const cut = k.cave({ mouth: x(16820), x: x(16300), w: 1300, h: 300, name: 'the Coldstone side passage', timber: true, lamps: [x(16400), x(17000), x(17500)], exitAt: 'L', mouthW: 110, mouthH: 140 });
		dress('stores', x(16700), 110, { y: cut.floor, layer: 'cave' });
		dress('armory', x(17250), 120, { y: cut.floor, layer: 'cave' });
		bush('rock-cold0', x(16950), 90, { y: cut.floor, layer: 'cave' });
		bush('ice0', x(17420), 110, { y: cut.floor, layer: 'cave' });
		W.glows = W.glows || [];
		for (const u of [16880, 17350]) W.glows.push({ x: x(u), y: cut.floor - 60, r: 160, a: 0.7 });
		k.loot('cut-ore', x(16880), 'Ore veins with a blue sheen in the passage wall. You chip out what you can carry.', 'iron_ore', { y: cut.floor, where: 'the ore vein', icon: '⛏️' });
		// a narrow upper ledge inside the passage, a jump and a scramble up
		plat(x(17080), cut.floor - 150, 120, 22, { thin: true, oneway: true, art: 'planks' });
		plat(x(17240), cut.floor - 260, 140, 22, { thin: true, oneway: true, art: 'planks' });
		k.loot('cut-ledge', x(17310), 'On the miners’ high ledge: a lunch tin, a candle stub and a little bag of cut stones.', 'ember_ruby', { y: cut.floor - 260, where: 'the lunch tin' });
		k.foe('caveSpider', x(17150), { y: cut.floor, cave: true, range: 160 });
		k.foe('caveSpider', x(17550), { y: cut.floor, cave: true, range: 120 });

		/* ------------------------------------------------------------ I4: the high shelf */
		district(x(17600), 'The High Shelf');
		grove(x(17400), x(21300), 360, ['pine-frost0', 'pine-frost1', 'dead-snow0', 'spruce-snow0'], 380, 560, 660, { layer: 'back' });
		grove(x(18200), x(21000), 900, ['pine-frost1', 'dead0'], 420, 520, 661);
		scatter(x(17400), x(21300), 210, ['rock-cold0', 'rock-snow0', 'heather0', 'bush-snow0', 'rock3'], 50, 120, 662);
		bush('boulder-snow0', x(19400), 220, { sink: 26, layer: 'back' });
		bld('marker', x(20500), { w: 90, h: 140, seed: 663, snow: true, stones: [{ x: 45, w: 46, h: 120, lean: 0.02, glyph: 'ᛟ' }] }, { key: 'pwmarkN' });
		k.junction(x(20100), [{ label: 'The Highland Traverse', way: 'East', to: 'I4_trav', point: 1 }]);
		k.lore(x(20545), 'the last marker', 'The last trade marker', ['The road’s last stone faces east along the shelf, toward the mountains: "TO THE AQUEDUCT · AND THE KING’S PASS".']);

		W.walkers.push({ x: x(1800), minX: x(1100), maxX: x(2300), speed: 0.3, sprite: 'forest-ranger', name: 'Trapper' });
		for (const u of [2200, 6800, 11600]) W.slimes.push({ x: x(u), w: 60, h: 46 });
	});
})(typeof window !== 'undefined' ? window : globalThis);
