/* J5–J4 — The Northwatch Pass (152000 – 174000; walking right = north).
   The direct, exposed route into the Frostmere Range: rocky foothills with snow in the cracks, the climb around the
   ridge (a watch platform, broken walls, abandoned crates), the ruined Frostline Gatehouse at the narrows, the
   Shivercut Mine, the Broken Supply Span across the ravine, the wind-scoured upper shelves, and the high snowfield
   at J4. The wind gusts all the way up. */
(function (global) {
	'use strict';
	(global.EmberfallFrontierSegs = global.EmberfallFrontierSegs || []).push(function (k) {
		const { E, W, A, B, M, bld, house, tree, bush, road, dress, plat, water, lamp, district, grove, scatter, F, talk } = k;
		const X = 152000;
		const x = (u) => X + u;
		k.region('northpass', X, 'The Northwatch Pass', 'J5 — J4');

		/* ------------------------------------------------------------ the land */
		const G = (pts) => E.ground(pts.map(([u, y, m]) => m ? [x(u), B + y, m] : [x(u), B + y]));
		k.ends(X, B - 1100, B - 2000);
		G([
			[620, -1100], [1500, -1130], [2400, -1180],
			// around the ridge: the climb, in short pitches
			[2800, -1240], [3100, -1250], [3400, -1330], [3700, -1340], [4100, -1420], [4600, -1440], [5200, -1460],
			// the narrows and the gatehouse
			[5700, -1480], [7800, -1490], [8400, -1520],
			// Shivercut
			[9000, -1540], [10600, -1560], [11400, -1580], [12500, -1600],
			// the ravine and the broken span (the floor is the lower ledge route)
			[12600, -1600, 'l'], [12660, -1250, 'l'], [14140, -1250, 'l'], [14200, -1600, 'l'], [14300, -1600],
			// the upper shelves
			[15000, -1640], [15800, -1700], [16300, -1720], [16900, -1790], [17600, -1820], [18300, -1880],
			[19000, -1950], [19800, -1990], [21380, -2000]
		]);
		E.rough(x(620), x(2400), 22, 601);
		E.rough(x(8400), x(12500), 22, 602);
		E.rough(x(14300), x(21380), 26, 603);
		E.material(x(600), x(21400), M.snow);
		for (const [a, b] of [[700, 1300], [1900, 2500], [3000, 3200], [3600, 3800]]) E.material(x(a), x(b), M.frost);
		E.material(x(12600), x(14200), M.rock);
		E.rockBody(x(600), x(21400));
		E.zone(x(0), x(6000), 'north', 0.95, 1);
		E.zone(x(6000), x(22100), 'alpine', 1, 1);
		k.wind(x(1200), x(5400), 0.5);
		k.wind(x(8600), x(12400), 0.45);
		k.wind(x(14400), x(21000), 0.6);

		/* ------------------------------------------------------------ J5: the foothill gate */
		district(x(600), 'The Foothill Gate');
		k.junction(x(640), [
			{ label: 'The King’s North Road', way: 'South', to: 'J5_north', point: -1 },
			{ label: 'The Frostline Causeway', way: 'West', to: 'J5_cause', point: -1 }
		], { snowy: true });
		grove(x(620), x(3000), 420, ['pine-snow0', 'pine-snow1', 'dead-snow0'], 360, 520, 801, { layer: 'back' });
		scatter(x(620), x(5600), 170, ['rock-snow0', 'rock-cold0', 'rock-snow1', 'bush-snow0'], 50, 140, 802);
		bush('boulder-snow0', x(1700), 230, { layer: 'back' });

		/* ------------------------------------------------------------ the ridge climb */
		district(x(2600), 'The Ridge Climb');
		k.stairs(x(3100), x(3400));
		k.stairs(x(3700), x(4100));
		bld('ruin', x(2500), { w: 420, h: 150, seed: 811, snow: true, tex: 'stone' }, { key: 'np-wall1' });
		bld('ruin', x(5100), { w: 360, h: 130, seed: 812, snow: true }, { key: 'np-wall2' });
		const watch = bld('platform', x(4300), { w: 200, h: 220, snow: true, roof: true }, { key: 'np-watch' });
		plat(x(4290), watch.y - 220, 220, 22, { thin: true, oneway: true });
		k.ledge(x(4520), watch.y - 110, 80, 'planks');
		k.foe('iceArcher', x(4400), { y: watch.y - 220, range: 60, detect: 700 });
		for (const [u, r] of [[4800, 0.1], [4920, -0.2], [5020, 0.3]]) road('crates', x(u), 80, { rot: r });
		k.loot('np-crates', x(4900), 'Abandoned supply crates from a relief column: most were looted, but the bottom one still holds dried meat and a flask.', 'frost_draught', { extra: ['ember_rations'], where: 'the crates' });

		/* ------------------------------------------------------------ the Frostline Gatehouse */
		district(x(5600), 'The Frostline Gatehouse');
		const gate = bld('ruinGate', x(6300), { w: 820, h: 520, tw: 210, seed: 821, snow: true }, { key: 'np-gate', id: 'np-gate', label: 'the Gatehouse guardroom', room: 'np-guardroom', kind: 'guard', door: { x: 105 - 34, w: 68 } });
		gate.roomBuilder = (W2, b) => {
			const fake = Object.assign({}, b, { type: 'house', spec: { w: 210, floors: 2, fh: 210, plinth: 0, door: 0.5, doorW: 68, doorH: 108, archDoor: true } });
			const r = global.EmberfallInteriors.buildHouseRoom(W2, fake);
			r.building = fake;
			return r;
		};
		k.lore(x(6430), 'the road map on the wall', 'The mountain road map', [
			'A painted map of the passes, flaking but clear: the Northwatch Pass up to the high shelf, the Highland Traverse west along the mountains to the King’s Aqueduct, and beyond them a road marked only "FROSTMERE — BY THE GLASS STAIR".',
			'Someone has pinned a scrap to it: "Expedition of the Seventh Month. Twelve set out. Supplies cached at the span. — V."'
		], { room: 'np-guardroom', y: gate.y, icon: '🗺️' });
		k.loot('np-guard-stores', x(6340), 'The guardroom’s provisions: a sack of oats, a lamp and a blanket stiff with frost — and the expedition’s tally board, with eleven marks crossed out.', 'ember_torch',
			{ room: 'np-guardroom', y: gate.y, extra: ['ember_bandage'], where: 'the provisions' });
		k.npc({ id: 'scholar', name: 'Quiet Scholar', x: x(6390), room: 'np-guardroom', floor: 1, minX: x(6330), maxX: x(6470), icon: '📜', sprite: 'clock-keeper', tall: 98,
			dialogue: {
				FIRST_MEETING: talk('Quiet Scholar', '📜', [
					'Mm? Oh. Sorry. The map. Look — the old road doesn’t stop at the high shelf. It goes on to facilities the Crown built and then forgot.',
					'A weather station on the Glass Stair. An ice-house under the Aqueduct. Something called "the Cold Hall". The expedition was going to find them.',
					'If you go north, write down what you see. Somebody should.'
				]),
				BASIC_DIALOGUE: talk('Quiet Scholar', '📜', ['The Cold Hall… I think the miners at Coldstone found the bottom of it. I think that is why they sealed it.'])
			} });
		k.npc({ id: 'hadrik', name: 'Captain Hadrik, the Border Warden', x: x(5900), minX: x(5760), maxX: x(6080), icon: '🛡️', sprite: 'captain-guard', tall: 106, hubShop: 'hadrik',
			dialogue: {
				FIRST_MEETING: talk('Captain Hadrik, the Border Warden', '🛡️', [
					'Halt — ah, you’re not a wraith. Good. You’d be surprised how often I have to check.',
					'This was the Frostline Gate. Forty men, once. Now it’s me, and the wind. I still keep the road.',
					'Up the pass: the old Shivercut Mine, then the span over the ravine — it’s broken, take the low ledge across. Past that the shelves, and the high snowfield where the Traverse runs west. Don’t stand still on the open shelves; the wind takes the heat right out of you.'
				]),
				BASIC_DIALOGUE: talk('Captain Hadrik, the Border Warden', '🛡️', ['I’ve some stores if you need them. The Crown stopped paying me. It didn’t stop me selling.'])
			} });
		k.foe('frostWraith', x(7400), { range: 240 });
		k.foe('frostWraith', x(8000), { range: 220 });
		bush('ice1', x(7650), 110);
		lamp(x(5800));

		/* ------------------------------------------------------------ the Shivercut Mine */
		district(x(8600), 'The Shivercut Mine');
		bush('boulder-snow0', x(9100), 200, { layer: 'back' });
		road('wagon', x(9350), 140, { rot: 0.06 });
		const mine = k.cave({ mouth: x(9700), x: x(9300), w: 1500, h: 300, name: 'the Shivercut Mine', timber: true, snowy: true, cold: true, lamps: [x(9400), x(9900), x(10400)], exitAt: 'L', mouthW: 110, mouthH: 140 });
		// the reachable chambers: supplies, a side ledge up to a cache, and the gallery choked with stone and ice
		dress('stores', x(9620), 120, { y: mine.floor, layer: 'cave' });
		dress('stores', x(10150), 100, { y: mine.floor, layer: 'cave' });
		bush('ice1', x(10650), 200, { y: mine.floor, layer: 'cave' });
		bush('ice0', x(10560), 140, { y: mine.floor, layer: 'cave' });
		bush('boulder-snow0', x(10720), 240, { y: mine.floor, layer: 'cave' });
		W.glows = W.glows || [];
		W.glows.push({ x: x(10620), y: mine.floor - 100, r: 220, a: 0.8 });
		plat(x(10600), mine.floor - 300, 40, 300, { wall: true });      // the ice wall: no further for now
		k.lore(x(10520), 'the ice-choked gallery', 'The lower gallery', ['Fallen stone, and behind it ice — clear, thick, and full of shapes you’d rather not look at too closely. The gallery goes on beyond it, down. Not today.'], { y: mine.floor, icon: '🧊' });
		k.ledge(x(9950), mine.floor - 140, 90, 'planks');
		k.ledge(x(10120), mine.floor - 250, 110, 'planks');
		k.loot('mine-ledge', x(10175), 'On the side ledge, in a miner’s cubby: a pouch of cut gems and a stub of chalk.', 'ember_crystal', { y: mine.floor - 250, extra: ['iron_ore'], where: 'the cubby' });
		k.loot('mira-pack', x(9880), 'A mountaineer’s pack with M. ROSK burned into the strap: rope, pitons, a folded map with a route inked in red.', 'climbing_rope', { y: mine.floor, where: 'the pack', icon: '🎒' });
		k.foe('caveSpider', x(9800), { y: mine.floor, cave: true, range: 140 });
		k.foe('snowboundMimic', x(10300), { y: mine.floor, cave: true, range: 60, name: 'A suspicious chest' });
		k.foe('caveSpider', x(10420), { y: mine.floor, cave: true, range: 120 });
		k.taskNpc({ id: 'mira', name: 'Mira, the Lost Mountaineer', x: x(9180), minX: x(9080), maxX: x(9300), icon: '🧗', sprite: 'forest-ranger', tall: 102 }, {
			id: 'mirapack',
			intro: ['I sheltered in the mine from the storm and something chased me out. My pack’s still in there — rope, pitons, my map. Without it I’m not going anywhere.', 'It’s just past the first lamp. Please.'],
			waiting: ['Just past the first lamp in the mine. Something with too many legs lives in there, so be quick.'],
			need: () => F.taken('ef_mira-pack'),
			done: ['My pack! Everything’s here. Thank you.', 'Here — look at my map. There’s a goat path from the mine up past the span to the shelves; the rope’s still fixed on it. I’ve tied a marker at the bottom for you. Saves you the ravine.'],
			after: ['The goat path is by the mine. Follow the red rag.'],
			reward: ['fur_mittens']
		});
		// Mira's goat path: a fixed rope up past the ravine (opens once you return her pack)
		W.portals = W.portals || [];
		const goatTo = x(14700);
		W.portals.push({ x: x(10900), w: 120, y: E.surf(x(10960)), toX: goatTo, toY: E.surf(goatTo), label: 'Mira’s goat path', verb: 'climb', need: 'task_mirapack_done' });
		W.portals.push({ x: x(14640), w: 120, y: E.surf(x(14700)), toX: x(10960), toY: E.surf(x(10960)), label: 'Mira’s goat path (down)', verb: 'climb', need: 'task_mirapack_done' });
		W.structs.push({ x0: x(10800), x1: x(11100), draw(ctx, cam, t) {
			if (!F.flag('task_mirapack_done')) return;
			const sx = x(10960) - cam.x, sy = E.surf(x(10960)) - cam.y;
			ctx.strokeStyle = '#8a6a3a';
			ctx.lineWidth = 3;
			ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx + 20 + Math.sin(t) * 4, sy - 200, sx + 4, sy - 420); ctx.stroke();
			ctx.fillStyle = '#c0392b';
			ctx.beginPath(); ctx.moveTo(sx, sy - 60); ctx.lineTo(sx + 26 + Math.sin(t * 3) * 4, sy - 54); ctx.lineTo(sx, sy - 46); ctx.fill();
		} });

		/* ------------------------------------------------------------ the Broken Supply Span */
		district(x(12300), 'The Broken Supply Span');
		// two halves of the old span, with the middle fallen into the ravine
		plat(x(12600), B - 1600, 600, 26, { thin: true, oneway: true, art: 'planks' });
		plat(x(13600), B - 1600, 600, 26, { thin: true, oneway: true, art: 'planks' });
		W.structs.push({ kind: 'trestle', x0: x(12600), x1: x(13200), deck: B - 1600, bottom: B - 1250, broken: [x(13200)] });
		W.structs.push({ kind: 'trestle', x0: x(13600), x1: x(14200), deck: B - 1600, bottom: B - 1250, broken: [x(13600)] });
		// the lower ledge across the ravine floor, with handholds back up both walls
		for (const [u, y] of [[12680, -1380], [12560, -1500], [14070, -1380], [14160, -1500]]) k.ledge(x(u), B + y, 90, 'stone');
		// the stranded cache on a pillar in the middle (a hard jump from the broken ends — or a flight)
		const pillarY = B - 1700;
		bld('crag', x(13300), { w: 160, h: 450, seed: 831, snow: true, flat: 0.7 }, { key: 'np-pillar', y: B - 1250, flat: false });
		plat(x(13325), pillarY, 110, 22, { thin: true, oneway: true });
		k.loot('span-cache', x(13380), 'On the pillar in the middle of the ravine, roped down tight: the expedition’s supply cache. "V." scratched on the lid.', 'glass_ice',
			{ y: pillarY, extra: ['frost_draught', 'ember_potion_hp'], where: 'the expedition cache', icon: '📦' });
		k.lore(x(12700), 'the broken span', 'The Broken Supply Span', ['The middle of the span has fallen into the ravine. You could cross on the lower ledge — or try the pillar in the middle, if you trust your feet.'], { y: B - 1600 });
		k.foe('glacierSentinel', x(14500), { hp: 1400, name: 'The Span Warden', range: 160, detect: 460 });
		bush('ice1', x(13950), 130, { y: B - 1250 });
		bush('ice0', x(12900), 100, { y: B - 1250 });

		/* ------------------------------------------------------------ the upper shelves */
		district(x(15200), 'The Upper Shelves');
		bld('ruin', x(15600), { w: 560, h: 180, seed: 841, snow: true, windows: [[0.3, 0.6, 30, 50], [0.7, 0.6, 30, 50]] }, { key: 'np-wall3' });
		bld('ruin', x(17300), { w: 420, h: 160, seed: 842, snow: true }, { key: 'np-wall4' });
		k.foe('snowBeast', x(16200), { range: 260 });
		k.foe('snowBeast', x(17800), { range: 260 });
		const rockY = Math.round(E.surf(x(18800)) + 20);
		bld('crag', x(18700), { w: 200, h: 200, seed: 843, snow: true, flat: 0.6 }, { key: 'np-rock', y: rockY, flat: false });
		plat(x(18750), rockY - 200, 100, 22, { thin: true, oneway: true });
		k.foe('iceArcher', x(18800), { y: rockY - 200, range: 30, detect: 720 });
		scatter(x(14300), x(21300), 240, ['rock-snow0', 'rock-snow1', 'ice0', 'bush-snow0'], 50, 140, 844);

		/* ------------------------------------------------------------ J4: the high snowfield */
		district(x(19200), 'The High Snowfield');
		for (const u of [19500, 20800]) { bush('ice1', x(u), 180, { layer: 'back' }); bush('ice0', x(u + 120), 120); }
		bush('boulder-snow0', x(20300), 240, { layer: 'back' });
		k.junction(x(20100), [{ label: 'The Highland Traverse', way: 'West', to: 'J4_trav', point: -1 }], { snowy: true });
		bld('marker', x(20900), { w: 120, h: 220, seed: 851, snow: true, post: { x: 60, h: 190, w: 58 } }, { key: 'np-cairn' });
		k.lore(x(20960), 'the summit cairn', 'The high cairn', ['Stones stacked by travellers, each with a name scratched in. The newest: "V. — Seventh Month. Going on."', 'North, past the snowfield, the road vanishes under the ice of the Frostmere Range.']);
	});
})(typeof window !== 'undefined' ? window : globalThis);
