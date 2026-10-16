/* I6–I5 — The Upper Millstream (80000 – 102000; walking right = north).
   Riverside countryside north of the Western Approach: the farmland of Valedorn behind you at the start, the road
   following the Valedorn upriver past Splitwater Bridge, a backwater pool with ledges and a cave at the waterline,
   the Old Lockworks sluice, a tributary under a stone bridge, a wooded valley (bandits raiding an abandoned cart),
   Rook's Den behind its curtain of vines, Tovin's overlook, and the rocky pine gate at I5. */
(function (global) {
	'use strict';
	(global.EmberfallFrontierSegs = global.EmberfallFrontierSegs || []).push(function (k) {
		const { E, W, A, B, M, bld, house, tree, bush, road, dress, plat, water, lamp, district, grove, scatter, F, talk } = k;
		const X = 80000;
		const x = (u) => X + u;
		k.region('millstream', X, 'The Upper Millstream', 'I6 — I5');

		/* ------------------------------------------------------------ the land */
		const G = (pts) => E.ground(pts.map(([u, y, m]) => m ? [x(u), B + y, m] : [x(u), B + y]));
		k.ends(X, B - 120, B - 520);
		G([
			[620, -120], [1400, -134], [2200, -112], [2900, -146], [3600, -150], [4300, -124], [4950, -120],
			// Splitwater: the south bank ramps down under the bridge, the river, the north bank climbs back
			[5250, 110], [5420, 236], [6180, 236], [6380, 110], [6760, -120],
			[7300, -142], [7900, -160],
			// the backwater: a low cliff drops to the pool; the far bank is a gentle slope
			[7990, -160, 'l'], [8040, 96, 'l'], [8060, 170], [8860, 170], [8920, 96], [9300, -200],
			[9900, -200], [10480, -200, 'l'],
			// the lock channel
			[10500, 200, 'l'], [10700, 200, 'l'], [10720, -200], [11600, -200], [12300, -184],
			// the tributary under the stone bridge
			[12460, -184], [12600, 96], [12860, 96], [13000, -184],
			[13600, -210], [14400, -240], [15200, -260], [16000, -300], [16500, -320],
			// the hill over Rook's Den and the pinewood
			[17100, -470], [17700, -480], [18300, -470], [18800, -520],
			// Tovin's overlook: a rocky knoll
			[19050, -600], [19250, -690], [19550, -690], [19800, -600], [20200, -540], [20700, -520], [21380, -520]
		]);
		E.rough(x(620), x(4900), 14, 301);
		E.rough(x(13100), x(16500), 22, 302);
		E.rough(x(17100), x(18800), 18, 303);
		E.material(x(600), x(21400), M.meadow);
		E.material(x(2300), x(4950), M.dirt);
		E.material(x(4950), x(5420), M.sand);
		E.material(x(5420), x(6700), M.sand);
		E.material(x(7980), x(8060), M.rock);
		E.material(x(8060), x(8920), M.sand);
		E.material(x(10480), x(10720), M.rock);
		E.material(x(12460), x(12600), M.sand);
		E.material(x(12860), x(13000), M.sand);
		E.material(x(18900), x(19900), M.rock);
		E.material(x(19900), x(21400), M.cold);
		E.rockBody(x(7960), x(8060));
		E.rockBody(x(10470), x(10730));
		E.rockBody(x(18950), x(19850));
		// climate: countryside, then the first pines toward I5
		E.zone(x(0), x(14500), 'farm', 0, 0.08);
		E.zone(x(14500), x(22100), 'pine', 0.18, 0.36);

		/* ------------------------------------------------------------ I6: Millstream Fields */
		district(x(600), 'Millstream Fields');
		k.junction(x(640), [{ label: 'The Western Approach', way: 'South', to: 'I6_west', point: -1 }]);
		// Valedorn's farms behind you: hazed farmhouses, haystacks and an orchard on the far side of the river
		for (const [u, w, f, roof, seed] of [[900, 280, 2, 'thatch', 501], [1500, 240, 1, 'red', 502], [2300, 300, 2, 'thatch', 503]]) {
			W.back.push({ type: 'house', spec: { w, floors: f, roof, wall: 'plaster', chimney: [0.3], lit: 0.4, seed }, x: x(u), y: E.surf(x(u) + w / 2) + 70, w, key: 'back:mill' + seed, scale: 0.55, haze: ['#b8c8d6', 0.45] });
		}
		grove(x(700), x(2400), 260, ['apple0', 'apple1'], 230, 290, 511, { layer: 'back' });
		for (const u of [1100, 1260, 2050]) road('hay', x(u), 90, { layer: 'back' });
		// a low old field wall along the road, half buried in grass
		bld('ruin', x(1380), { w: 520, h: 60, seed: 512, profile: (t) => 0.7 + 0.3 * Math.sin(t * 9) }, { key: 'millwall1', layer: 'mid' });
		bld('ruin', x(2650), { w: 380, h: 52, seed: 513, profile: (t) => 0.6 + 0.4 * Math.cos(t * 7) }, { key: 'millwall2', layer: 'mid' });
		k.lore(x(1600), 'the old boundary stone', 'Boundary stone', ['A field stone set into the wall, cut with a wheatsheaf and a river: the old mark of Valedorn’s northern fields.', 'Beyond this wall the farms ran out and the river became nobody’s in particular.']);
		k.loot('fields-wall', x(2980), 'Tucked into a gap in the old wall: a farmer’s forgotten lunch and a whetstone.', 'ember_rations');
		grove(x(620), x(1000), 140, ['oak0', 'oak1', 'birch0'], 380, 470, 514);
		scatter(x(700), x(4800), 150, ['bush0', 'bush1', 'bush-flower0', 'bush-flower1', 'bush2'], 60, 110, 515);
		for (let u = 800; u < 4700; u += 170) bush(['flowers-white', 'flowers-gold', 'flowers-blue', 'flowers-pink'][(u / 170 | 0) % 4], x(u), 44, { layer: 'front', sink: 4 });
		grove(x(3100), x(4700), 380, ['oak2', 'birch1', 'willow0', 'oak3'], 380, 480, 516);
		road('cart', x(3350), 140);
		road('sign', x(3800), 200);
		bush('rock2', x(3300), 90);
		bush('boulder1', x(3420), 150, { sink: 18 });
		district(x(2600), 'The Riverside Road');

		/* ------------------------------------------------------------ Splitwater Bridge */
		district(x(4800), 'Splitwater Bridge');
		water(x(5280), x(6320), B + 150, B + 236, { flow: 1.8 });
		bld('tbridge', x(4900), { w: 1860, d: 360, piers: 2, gap: [0.62, 0.74], seed: 520 }, { key: 'splitwater', y: B - 120, flat: false });
		plat(x(4900), B - 120, 1860, 30, { thin: true, oneway: true });
		bush('reeds0', x(5330), 120, { layer: 'front' });
		bush('reeds1', x(6260), 110, { layer: 'front', flip: true });
		bush('rock3', x(5600), 80, { sink: 30 });
		bush('rock0', x(6050), 70, { sink: 30 });
		bush('boulder0', x(5180), 150, { sink: 26 });
		grove(x(6800), x(7500), 260, ['willow0', 'oak0'], 380, 440, 521);
		// the traveler's dropped supplies, scattered down the bank
		k.loot('trav1', x(5310), 'A canvas bundle snagged on the reeds: dry socks, a tinderbox, a name stitched inside — Wenna Holt.', 'ember_torch', { y: B + 150, where: 'the bundle' });
		k.loot('trav2', x(5820), 'A leather satchel wedged against the pier footing, still mostly dry.', 'ember_bandage', { y: B + 236, where: 'the satchel' });
		k.loot('trav3', x(6300), 'A rolled map case half buried in the gravel of the north bank.', 'ember_herb', { y: B + 150, where: 'the map case' });
		k.taskNpc({ id: 'mill_traveler', name: 'Wenna Holt', x: x(4560), minX: x(4420), maxX: x(4760), icon: '🎒', sprite: 'merchant', tall: 100 }, {
			id: 'wenna',
			intro: ['The rail gave way under my pack — everything I own went over the side. I can’t swim and I won’t wade that.',
				'If you go down by the broken rail (hold S on the deck to drop), my things are on the banks under the bridge. A bundle, a satchel and a map case.'],
			waiting: ['A bundle, a satchel, and the map case. Mind the current by the piers.'],
			need: () => F.taken('ef_trav1') && F.taken('ef_trav2') && F.taken('ef_trav3'),
			done: ['All three! You have no idea. Here — take this for your trouble.', 'When I’ve dried out I’m heading for the Glassfall Grotto past the Highland Traverse. They say the ice there never melts. Maybe I’ll see you on the road.'],
			after: ['North for me, once my socks are dry. The Glassfall Grotto, if the passes are kind.'],
			reward: ['river_pearl']
		});

		/* ------------------------------------------------------------ the backwater pool */
		district(x(7500), 'The Willow Reach');
		water(x(8050), x(8900), B + 100, B + 170, { flow: 0.6 });
		grove(x(7600), x(7950), 200, ['willow0', 'birch0'], 360, 430, 530, { layer: 'back' });
		grove(x(8900), x(9500), 220, ['willow0', 'oak1'], 380, 430, 531);
		for (const u of [8090, 8300, 8620, 8850]) bush(u % 2 ? 'reeds0' : 'reeds1', x(u), 100 + (u % 3) * 10, { layer: 'front' });
		// ledges up the low cliff on the south side of the pool (for the way back)
		k.ledge(x(8050), B - 10, 110, 'corbel');
		k.ledge(x(7980), B - 130, 90, 'corbel');
		// a shallow cave at the waterline, cut into the foot of the cliff
		W.voids.push({ x: x(7820), y: B - 70, w: 220, h: 168, openR: true, arch: 50 });
		plat(x(7780), B + 98, 280, 60);
		plat(x(7780), B - 130, 280, 60);
		plat(x(7780), B - 130, 44, 290, { wall: true });
		dress('stores', x(7900), 90, { y: B + 98, layer: 'cave' });
		k.loot('pool-cave', x(7920), 'In the dark at the back of the waterline cave: an oilskin pouch somebody hid above the floodmark.', 'river_pearl', { y: B + 98, where: 'the cave' });
		k.motes(x(7700), x(9200), '#d8ff8a');

		/* ------------------------------------------------------------ the Old Lockworks */
		district(x(9600), 'The Old Lockworks');
		house(x(9760), { w: 320, floors: 1, fh: 190, roof: 'slate', wall: 'stone', frame: false, archWin: true, chimney: [0.75], seed: 540, win: [1] },
			{ id: 'lockhouse', label: 'the Lockkeeper’s House', room: 'lockhouse', kind: 'maps' });
		bld('lockworks', x(10380), { w: 440, d: 400, gap: 200, seed: 541 }, { key: 'lockworks', y: B - 200, flat: false });
		plat(x(10370), B - 200, 460, 24, { thin: true, oneway: true });
		// rungs up the channel walls
		k.ledge(x(10500), B + 60, 60, 'stone');
		k.ledge(x(10640), B - 70, 60, 'stone');
		// the channel: high and black while the sluice is shut; opening it drops the water and bares the alcove
		const lockWater = { x0: x(10500), x1: x(10700), y: B - 50, bed: B + 200, flow: 2.6 };
		W.water.push(lockWater);
		W.voids.push({ x: x(10690), y: B + 70, w: 170, h: 130, openL: true, arch: 40, wall: 'stone' });
		plat(x(10660), B + 200, 230, 60);
		plat(x(10700), B + 10, 190, 60);
		plat(x(10846), B + 10, 44, 250, { wall: true });
		const sluiceOpen = () => F.flag('sluice_open');
		k.loot('lock-alcove', x(10790), 'In the alcove bared by the falling water: an iron-bound strongbox the lockkeepers used for their wages.', 'ember_ruby',
			{ y: B + 200, hidden: true, reveal: sluiceOpen, extra: ['ember_crystal'], where: 'the strongbox', icon: '🗝️' });
		W.structs.push({ x0: x(10300), x1: x(10900), draw(ctx, cam, t) {
			// the water level follows the sluice; the gate and the winch wheel move with it
			const want = sluiceOpen() ? B + 130 : B - 50;
			lockWater.y += (want - lockWater.y) * 0.02;
			const open = (lockWater.y - (B - 50)) / 180;
			const gx = x(10600) - cam.x, gy = B - 180 - cam.y - open * 190;
			ctx.fillStyle = A.pattern(ctx, 'wood', -cam.x % 300, 0, 1, 1, 90);
			ctx.fillRect(gx - 104, gy, 208, 210);
			ctx.fillStyle = 'rgba(20,12,6,0.45)';
			ctx.fillRect(gx - 104, gy, 208, 210);
			ctx.fillStyle = '#2a2420';
			for (let k2 = 0; k2 < 3; k2++) ctx.fillRect(gx - 104, gy + 20 + k2 * 70, 208, 8);
			const wx = x(10745) - cam.x, wy = B - 290 - cam.y;
			ctx.save();
			ctx.translate(wx, wy);
			ctx.rotate(open * 6);
			ctx.strokeStyle = '#3a2616';
			ctx.lineWidth = 7;
			ctx.beginPath(); ctx.arc(0, 0, 38, 0, Math.PI * 2); ctx.stroke();
			for (let s2 = 0; s2 < 6; s2++) { ctx.rotate(Math.PI / 3); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 46); ctx.stroke(); }
			ctx.restore();
		} });
		k.use(x(10745), 'the sluice wheel', (p, api) => {
			const now = !F.flag('sluice_open');
			api.setFlag('sluice_open', now ? true : false);
			api.say([{ name: 'The sluice wheel', icon: '⚙️', text: now ? 'You lean on the spokes. Somewhere below a chain shudders, the gate lifts, and the channel drops with a long gurgle — baring an alcove in the north wall.' : 'You let the wheel run back. The gate drops and the channel fills again, black and deep.' }]);
		}, { y: B - 200, verb: 'turn' });
		k.lore(x(10420), 'the lock plaque', 'Lock No. III', ['LOCK III — BUILT IN THE NINTH YEAR OF KING ALDRIC. THE RIVER IS LENT TO US. RETURN IT AS YOU FOUND IT.', 'Below, scratched later: "and tell the King the gate sticks."'], { y: B - 200 });
		k.taskNpc({ id: 'mara', name: 'Mara, the Lockkeeper', x: x(10200), minX: x(10120), maxX: x(10300), icon: '⚙️', sprite: 'black-smith', tall: 100 }, {
			id: 'sluice',
			intro: ['This lock fed the mill-races all the way to Emberfall once. Three gates, nine mills. Now it is one gate and me.',
				'I’ve greased the chain but my shoulder won’t take the wheel. Get up on the walkway and give it a turn, would you? I want to see if the gate still lifts.'],
			waiting: ['The wheel’s on the walkway over the channel. Put your weight into it.'],
			need: () => F.flag('sluice_open'),
			done: ['Listen to that — she still breathes! Twenty years I’ve waited to hear that gate lift.', 'There was a strongbox down in the north wall the old keepers used. If it’s still there, it’s yours. And take this.'],
			after: ['The river runs where we tell it here. Further north it stops listening.', 'Tovin the surveyor is up on the overlook past the old den. He’ll tell you where it goes after that.'],
			reward: ['ember_potion_mp']
		});
		lamp(x(10330));
		bush('reeds0', x(10480), 110, { layer: 'front' });
		grove(x(11000), x(12200), 280, ['oak0', 'birch0', 'oak2'], 380, 470, 542);

		/* ------------------------------------------------------------ the tributary bridge */
		district(x(12300), 'Tributary Bridge');
		water(x(12540), x(12920), B + 30, B + 96, { flow: 2.2 });
		bld('bridge', x(12440), { w: 580, d: 280, arches: 1, moss: true }, { key: 'tribridge', y: B - 184, flat: false });
		plat(x(12440), B - 184, 580, 30, { thin: true, oneway: true });
		bush('reeds1', x(12560), 100, { layer: 'front' });
		bush('fern1', x(12900), 80);
		for (const u of [13300, 13520]) W.slimes.push({ x: x(u), w: 60, h: 46 });
		bush('rock1', x(13400), 90);
		bush('rock4', x(13560), 80);

		/* ------------------------------------------------------------ the wooded valley */
		district(x(13100), 'The Wooded Valley');
		grove(x(13100), x(16600), 140, ['oak0', 'oak1', 'oak2', 'oak3', 'birch0', 'birch1', 'oak-big'], 400, 560, 550, { layer: 'back' });
		grove(x(13300), x(16400), 360, ['oak3', 'birch2', 'oak1'], 420, 520, 551);
		scatter(x(13100), x(16600), 130, ['bush0', 'bush2', 'fern0', 'fern1', 'bush3'], 60, 110, 552);
		bush('log0', x(15400), 120, { sink: 14 });
		bush('stump0', x(15900), 70, { sink: 6 });
		// the abandoned supplies the bandits are picking through
		road('wagon', x(14500), 170, { rot: -0.08 });
		road('crates', x(14700), 100, { rot: 0.18 });
		road('sacks', x(14340), 90);
		road('crates', x(14820), 80, { rot: -0.4 });
		k.loot('valley-cart', x(14600), 'Under the tilted cart, a strongbox the bandits hadn’t pried open yet.', 'ember_sapphire', { where: 'under the cart' });
		k.foe('bandit', x(14250), { range: 180 });
		k.foe('banditSlinger', x(14900), { range: 140 });
		k.foe('bandit', x(15100), { range: 160 });
		k.motes(x(15600), x(16800), '#e8ffb0');

		/* ------------------------------------------------------------ Rook's Den */
		district(x(16700), 'Rook’s Den');
		const den = k.cave({ mouth: x(16880), x: x(16500), w: 900, h: 240, name: 'Rook’s Den', vines: true, lamps: [x(16620), x(17000), x(17320)], exitAt: 'L' });
		dress('guestbed', x(17150), 100, { y: den.floor, layer: 'cave' });
		dress('stores', x(17300), 120, { y: den.floor, layer: 'cave' });
		dress('stores', x(16700), 110, { y: den.floor, layer: 'cave' });
		k.loot('rooks-den', x(17260), 'Under the makeshift bed, a cache wrapped in a cloak: somebody lived here, and left in a hurry.', 'ember_crystal', { y: den.floor, extra: ['river_pearl'], where: 'under the bed' });
		k.lore(x(16620), 'a note pinned to a crate', 'A note on a crate', ['"Rook — the barge men saw the smoke. We go north through the pines tonight. Burn this." It wasn’t burned.'], { y: den.floor, icon: '📜' });
		k.foe('caveSpider', x(17050), { y: den.floor, cave: true, range: 140 });
		k.foe('caveSpider', x(17330), { y: den.floor, cave: true, range: 120 });

		/* ------------------------------------------------------------ the pinewood and Tovin's overlook */
		district(x(17900), 'The Pine Margin');
		grove(x(17000), x(19000), 170, ['pine0', 'birch1', 'pine1', 'spruce0', 'birch0'], 420, 600, 560, { layer: 'back' });
		grove(x(17300), x(18900), 420, ['pine1', 'pine2', 'birch2'], 460, 560, 561);
		scatter(x(17000), x(19000), 160, ['fern0', 'fern1', 'bush2', 'rock1'], 50, 100, 562);
		k.foe('thornWolf', x(17700), { range: 260 });
		k.foe('thornWolf', x(18400), { range: 220 });
		district(x(18900), 'Tovin’s Overlook');
		k.stairs(x(18800), x(19250));
		bush('boulder1', x(19300), 210, { layer: 'back' });
		bush('rock3', x(19480), 90);
		road('tent', x(19620), 170);
		k.npc({ id: 'tovin', name: 'Tovin, the River Surveyor', x: x(19420), minX: x(19300), maxX: x(19540), icon: '🗺️', sprite: 'eldery-sage', tall: 102,
			dialogue: {
				FIRST_MEETING: talk('Tovin, the River Surveyor', '🗺️', [
					'Careful of the edge — I’ve lost two hats and a theodolite off this knoll.',
					'The Millstream splits three ways above the lock: the main river, the old mill-race, and a branch that goes underground somewhere past the den. I’ve been chasing that one for a year.',
					'North of here the road splits at the old fingerposts. Pineward runs up into the trees — an old trade road, very quiet. East is the Frostline Causeway to the King’s Road. Watch the weather on the Frostline.'
				]),
				BASIC_DIALOGUE: talk('Tovin, the River Surveyor', '🗺️', ['There’s a ledge up on the cliff behind me nobody can reach. I’ve seen a glint up there through the lens. Someday someone will fly up and tell me what it is.'])
			} });
		k.loot('overlook-high', x(19900), 'On a ledge nobody should be able to reach: a brass case with a surveyor’s lens, left by whoever climbed here first.', 'survey_lens', { y: Math.round(E.surf(x(19910)) + 30) - 560, where: 'the brass case' });
		// a lone stack of rock behind the knoll, its flat top out of reach (for now)
		const cragY = Math.round(E.surf(x(19910)) + 30);
		bld('crag', x(19780), { w: 260, h: 560, seed: 575, flat: 0.62 }, { key: 'tovincrag', y: cragY, layer: 'back', flat: false });
		plat(x(19840), cragY - 560, 140, 22, { thin: true, oneway: true });

		/* ------------------------------------------------------------ I5: the pine gate */
		district(x(20000), 'The Pine Gate');
		grove(x(19900), x(21300), 200, ['pine0', 'pine1', 'spruce0', 'pine2'], 460, 620, 570, { layer: 'back' });
		grove(x(20100), x(21300), 480, ['spruce1', 'pine1'], 480, 600, 571);
		scatter(x(19900), x(21300), 220, ['rock-cold0', 'fern0', 'rock1', 'heather0'], 50, 110, 572);
		bush('boulder0', x(21240), 190, { layer: 'back' });
		k.junction(x(20100), [
			{ label: 'The Pineward Rise', way: 'North', to: 'I5_pine', point: 1 },
			{ label: 'The Frostline Causeway', way: 'East', to: 'I5_cause', point: 1 }
		]);
		road('shrine', x(21150), 200, { sink: 8 });
		k.lore(x(21150), 'the wayside shrine', 'Wayside shrine', ['A worn stone shrine with three niches: a sheaf for the farms, a pine for the woods, a star for the north. Someone has left a fresh pinecone in the middle one.']);

		/* ------------------------------------------------------------ ambient life */
		W.walkers.push({ x: x(2000), minX: x(1200), maxX: x(3200), speed: 0.32, sprite: 'forest-ranger', name: 'Shepherd' });
		W.walkers.push({ x: x(11200), minX: x(10900), maxX: x(11900), speed: 0.35, sprite: 'inn-keeper', name: 'Barge-hand' });
		for (const u of [1800, 3300, 8400, 9100]) W.slimes.push({ x: x(u), w: 60, h: 46 });
	});
})(typeof window !== 'undefined' ? window : globalThis);
