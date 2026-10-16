/* I5–J5 — The Frostline Causeway (148000 – 170000; walking right = east).
   The climate changes as you walk: a pine brook at I5, a broad rocky shelf where the stream starts to freeze,
   Rimewater Crossing (its west approach broken away), the Frostline boundary stones, Sella's weather post on the
   windy long shelf, the stranded caravan on the icy bend, the icy hollows, and the snowbound eastern approach that
   joins the King's North Road at J5. */
(function (global) {
	'use strict';
	(global.EmberfallFrontierSegs = global.EmberfallFrontierSegs || []).push(function (k) {
		const { E, W, A, B, M, bld, house, tree, bush, road, dress, plat, water, lamp, district, grove, scatter, fence, F, talk } = k;
		const X = 148000;
		const x = (u) => X + u;
		k.region('causeway', X, 'The Frostline Causeway', 'I5 — J5');

		/* ------------------------------------------------------------ the land */
		const G = (pts) => E.ground(pts.map(([u, y, m]) => m ? [x(u), B + y, m] : [x(u), B + y]));
		k.ends(X, B - 520, B - 1100);
		G([
			[620, -520], [1300, -530],
			// the brook: a shallow rocky channel beside the road
			[1700, -520], [1820, -430], [2160, -430], [2300, -520], [2700, -540],
			// up onto the stone shelf
			[3400, -600], [4300, -660], [5200, -700], [6150, -700],
			// Rimewater: the gorge under the bridge
			[6200, -700, 'l'], [6260, -520, 'l'], [6420, -380], [6500, -300], [7060, -300], [7160, -400], [7340, -560], [7420, -700, 'l'], [7460, -700],
			[8200, -720], [10400, -730],
			// the long shelf
			[11200, -760], [12400, -780], [13500, -800],
			// down the icy bend to the caravan, then a rocky rise with ledges
			[13800, -800], [14600, -700], [15000, -690], [15200, -700], [15250, -1000, 'l'], [15500, -1000], [15560, -760, 'l'], [16400, -800],
			// the icy hollows
			[16900, -860], [17200, -780], [17500, -860], [17900, -940], [18200, -880], [18600, -960], [19400, -1040],
			[20200, -1090], [21380, -1100]
		]);
		E.rough(x(620), x(1700), 12, 501);
		E.rough(x(2300), x(6150), 22, 502);
		E.rough(x(7460), x(13500), 20, 503);
		E.rough(x(16400), x(21380), 22, 504);
		E.material(x(600), x(2700), M.meadow);
		E.material(x(1700), x(2300), M.rock);
		E.material(x(2700), x(6200), M.cold);
		for (const [a, b] of [[3600, 4000], [4700, 5100], [5600, 6150]]) E.material(x(a), x(b), M.frost);
		E.material(x(6200), x(7460), M.rock);
		E.material(x(7460), x(10400), M.frost);
		for (const [a, b] of [[8600, 9100], [9700, 10400]]) E.material(x(a), x(b), M.snow);
		E.material(x(10400), x(13800), M.snow);
		E.material(x(13800), x(14700), M.ice);
		E.material(x(14700), x(21400), M.snow);
		E.material(x(15200), x(15560), M.rock);
		E.rockBody(x(6150), x(7480));
		E.rockBody(x(15150), x(15600));
		E.zone(x(0), x(8000), 'pine', 0.38, 0.56);
		E.zone(x(8000), x(15500), 'frostpine', 0.56, 0.82);
		E.zone(x(15500), x(22100), 'north', 0.84, 1.0);
		k.wind(x(10500), x(13600), 0.4);
		k.wind(x(17200), x(21000), 0.25);

		/* ------------------------------------------------------------ I5: the pine brook */
		district(x(600), 'Pine Brook');
		k.junction(x(640), [
			{ label: 'The Upper Millstream', way: 'South', to: 'I5_mill', point: -1 },
			{ label: 'The Pineward Rise', way: 'North', to: 'I5_pine', point: -1 }
		]);
		grove(x(620), x(4200), 190, ['pine0', 'pine1', 'pine2', 'spruce0'], 460, 640, 701, { layer: 'back' });
		grove(x(900), x(3800), 420, ['pine1', 'spruce1', 'pine-frost0'], 480, 600, 702);
		water(x(1800), x(2180), B - 470, B - 430, { flow: 2.4, cold: true });
		for (const u of [1760, 2210]) bush('rock-cold0', x(u), 80, { sink: 10 });
		bush('reeds1', x(1850), 90, { layer: 'front' });
		scatter(x(620), x(5200), 170, ['fern0', 'rock1', 'heather0', 'rock-cold0', 'fern1'], 50, 100, 703);
		k.foe('thornWolf', x(3100), { range: 220 });
		k.foe('bandit', x(4400), { range: 180 });
		k.foe('banditSlinger', x(4750), { range: 120 });
		road('tent', x(4600), 170);
		road('crates', x(4450), 80);

		/* ------------------------------------------------------------ the stone shelf */
		district(x(2900), 'The Stone Shelf');
		for (const [u, g] of [[3300, 'ᛁ'], [5500, 'ᛃ']]) bld('marker', x(u), { w: 80, h: 130, seed: u, stones: [{ x: 40, w: 40, h: 104, lean: 0.03, glyph: g }] }, { key: 'cwmark' + u });
		bush('boulder1', x(5000), 180, { layer: 'back' });

		/* ------------------------------------------------------------ Rimewater Crossing */
		district(x(5800), 'Rimewater Crossing');
		// the stream is freezing from the edges in: ice shelves you can stand on, open water in the middle
		const riceL = { x0: x(6500), x1: x(6650), y: B - 330, bed: B - 300, frozen: true };
		const riceR = { x0: x(6900), x1: x(7060), y: B - 330, bed: B - 300, frozen: true };
		W.water.push(riceL, riceR);
		water(x(6650), x(6900), B - 330, B - 300, { flow: 1.4, cold: true });
		plat(x(6500), B - 330, 150, 20, { thin: true });
		plat(x(6900), B - 330, 160, 20, { thin: true });
		// the bridge: the middle stands, the west approach has fallen in
		bld('bridge', x(6560), { w: 900, d: 360, arches: 2, moss: false }, { key: 'rimewater', y: B - 700, flat: false });
		plat(x(6560), B - 700, 900, 30, { thin: true, oneway: true });
		// the remaining path: broken blocks of the old approach, a careful hop each
		for (const [u, y] of [[6250, -650], [6390, -680]]) plat(x(u), B + y, 90, 24, { thin: true, oneway: true, art: 'stone' });
		bush('rock-cold0', x(6300), 70, { y: B - 650 });
		// the lower rocky route down the gorge and back up
		k.stairs(x(7160), x(7340));
		bush('icicles0', x(6600), 90, { y: B - 668, layer: 'front' });
		bush('icicles0', x(7300), 80, { y: B - 668, layer: 'front', flip: true });
		k.loot('rimewater', x(6780), 'Under the middle arch, on a dry shelf above the ice: a cache of lost travel supplies — wrapped tight against the damp.', 'frost_draught',
			{ y: B - 330, extra: ['ember_rations', 'climbing_rope'], where: 'under the arch' });
		k.lore(x(6620), 'the bridge keystone', 'Rimewater keystone', ['A carved keystone fallen from the broken approach: "RIMEWATER — HERE THE KING’S ROAD TURNS NORTH". The stream below it has already started to freeze at the edges.'], { y: B - 700 });
		grove(x(7460), x(8400), 300, ['pine-frost0', 'pine-frost1', 'spruce-snow0'], 440, 560, 711, { layer: 'back' });

		/* ------------------------------------------------------------ the Frostline markers */
		district(x(8200), 'The Frostline Markers');
		const glyphs = ['ᚠ', 'ᚢ', 'ᚦ', 'ᛇ', 'ᛉ', 'ᛟ'];
		glyphs.forEach((g, i) => {
			const u = 8500 + i * 330;
			const fallen = i === 3;
			bld('marker', x(u), { w: 100, h: 160, seed: 720 + i, snow: true, stones: [{ x: 50, w: 44, h: fallen ? 120 : 110 + (i % 2) * 24, lean: (i % 3 - 1) * 0.06, glyph: g, fallen }] }, { key: 'frostline' + i });
			if (!fallen && i % 2) bush('rock-snow0', x(u + 40), 50, { layer: 'front', sink: 4 });   // half-buried in drifted snow
		});
		k.lore(x(8550), 'the first boundary stone', 'The Frostline', ['A row of six ancient stones, each with a different weathered sign. They marked where the King’s writ ended and the northern holds began. Some are half buried in snow.', 'Sella the weather warden says the snow line used to start three stones further east.']);
		k.loot('frostline-hollow', x(9530), 'The fallen stone has exposed a hollow in its base. Inside: an old brass compass, and a note — "If you read this, you are north of the King. Mind the cold, and the archers on the ledges."', 'old_compass',
			{ where: 'the hollow under the fallen stone', icon: '🧭' });
		k.foe('frostWraith', x(9900), { range: 240 });
		grove(x(8400), x(10400), 520, ['pine-frost1', 'dead-snow0', 'pine-snow1'], 400, 540, 721, { layer: 'back' });

		/* ------------------------------------------------------------ the long shelf: Sella's weather post */
		district(x(10500), 'The Long Shelf');
		scatter(x(10400), x(13600), 230, ['rock-snow0', 'rock-cold0', 'bush-snow0', 'stump-snow0'], 50, 120, 731);
		grove(x(10400), x(13600), 700, ['pine-snow0', 'dead-snow0', 'pine-frost1'], 380, 520, 732, { layer: 'back' });
		W.structs.push({ x0: x(11500), x1: x(11800), draw(ctx, cam, t) {
			// a weather post: mast, wind vane, a cup anemometer spinning in the gusts and a thermometer box
			const bx = x(11640) - cam.x, gy = E.surf(x(11640)) - cam.y;
			const wind = global.EmberfallLife && global.EmberfallLife.windAt ? global.EmberfallLife.windAt(x(11640), t) : 0;
			ctx.fillStyle = '#4a3a2a';
			ctx.fillRect(bx - 4, gy - 230, 8, 230);
			ctx.save();
			ctx.translate(bx, gy - 236);
			ctx.rotate(t * (2 + wind * 18));
			ctx.strokeStyle = '#2a2a2a';
			ctx.lineWidth = 3;
			for (let i = 0; i < 3; i++) { ctx.rotate(Math.PI * 2 / 3); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(26, 0); ctx.stroke(); ctx.fillStyle = '#8a3a2a'; ctx.beginPath(); ctx.arc(26, 0, 6, 0, Math.PI * 2); ctx.fill(); }
			ctx.restore();
			ctx.save();
			ctx.translate(bx, gy - 200);
			ctx.scale(Math.cos(t * 0.3 + wind) > 0 ? 1 : -1, 1);
			ctx.fillStyle = '#2e2e2e';
			ctx.beginPath(); ctx.moveTo(-34, 0); ctx.lineTo(30, -4); ctx.lineTo(30, 4); ctx.closePath(); ctx.fill();
			ctx.beginPath(); ctx.moveTo(-34, -10); ctx.lineTo(-22, 0); ctx.lineTo(-34, 10); ctx.closePath(); ctx.fill();
			ctx.restore();
			ctx.fillStyle = '#ece6d8';
			ctx.fillRect(bx + 18, gy - 120, 40, 52);
			ctx.fillStyle = '#7a6a54';
			ctx.fillRect(bx + 14, gy - 124, 48, 8);
			ctx.fillRect(bx + 34, gy - 68, 6, 68);
			ctx.fillStyle = 'rgba(245,249,252,0.95)';
			ctx.fillRect(bx + 14, gy - 130, 48, 6);
		} });
		road('tent', x(11380), 170);
		k.npc({ id: 'sella', name: 'Sella, the Weather Warden', x: x(11820), minX: x(11720), maxX: x(11960), icon: '🌡️', sprite: 'apprentice-mage', tall: 100,
			dialogue: {
				FIRST_MEETING: talk('Sella, the Weather Warden', '🌡️', [
					'Mind the gusts — they come down off the passes all at once. I’ve lost my hat to them twice this week.',
					'I measure the cold. Every morning: the frost line, the wind, how far the stream has frozen at Rimewater. Every year it reaches further south.',
					'Past J5 it stops being weather and starts being a climate. Frostmere doesn’t thaw. If you go up the Northwatch Pass, take something warm and don’t stand still too long on the open shelves.'
				]),
				BASIC_DIALOGUE: talk('Sella, the Weather Warden', '🌡️', ['Eleven degrees colder than last spring at this post. I’ve written to Emberfall. They wrote back to ask if I was sure.'])
			} });

		/* ------------------------------------------------------------ the stranded caravan */
		district(x(13500), 'The Stranded Caravan');
		road('wagon', x(14250), 180, { rot: 0.14 });
		for (const [u, r, n] of [[14050, -0.3, 'crates'], [14420, 0.5, 'crates'], [14580, 0.2, 'sacks'], [14760, -0.6, 'crates'], [13900, 0.12, 'sacks']]) road(n, x(u), 80 + (u % 3) * 10, { rot: r });
		k.lore(x(14250), 'the caravan wagon', 'The trapped wagon', ['The wagon slid where the dirt road turns to ice and jammed its wheel against a rock. Its crates spilled all the way down the slope.', 'Fresh tracks lead from the spilled supplies up toward the rocky ledge — something has been dragging cargo away.']);
		k.taskNpc({ id: 'orin', name: 'Orin, the Caravan Guard', x: x(14650), minX: x(14540), maxX: x(14800), icon: '🛡️', sprite: 'generic-guard', tall: 104 }, {
			id: 'cargo',
			intro: ['Don’t step on the ice in boots like that. The wagon tried and look at it.', 'The beasts dragged off our strongbox in the night — up onto that rocky ledge past the bend. I can’t leave the wagon. Get it back and you’ll be paid.'],
			waiting: ['Up on the rocky ledge past the bend. Something big has been nosing around up there — be careful.'],
			need: () => F.taken('ef_caravan-box'),
			done: ['That’s the one — seals unbroken! The merchant will want to thank you herself, but she’s a day back down the road, so here’s her thanks from me.'],
			after: ['We’ll wait for the thaw. Ha. No — we’ll wait for oxen.'],
			reward: ['ember_sapphire', 'frost_draught']
		});
		// the rocky ledge with the dragged-off strongbox, and the beasts that took it
		k.ledge(x(15080), B - 860, 110, 'stone');
		k.loot('caravan-box', x(15380), 'The caravan’s strongbox, clawed and bitten, still sealed. Orin will want it back.', 'ember_rations', { where: 'the strongbox', icon: '📦' });
		W.structs.push({ x0: x(14700), x1: x(16300), draw(ctx, cam) {
			// tracks in the snow from the spilled crates up toward the ledge and on to the beasts' den
			ctx.fillStyle = 'rgba(70,80,96,0.35)';
			for (let u = 14720; u < 16300; u += 46) {
				if (u > 15180 && u < 15600) continue;
				const sx = x(u) - cam.x, sy = E.surf(x(u)) - cam.y + 2;
				ctx.beginPath(); ctx.ellipse(sx, sy, 7, 2.5, 0, 0, Math.PI * 2); ctx.fill();
				ctx.beginPath(); ctx.ellipse(sx + 18, sy + 1, 6, 2.2, 0, 0, Math.PI * 2); ctx.fill();
			}
		} });
		road('crates', x(16050), 80, { rot: -0.4 });
		road('sacks', x(16180), 70);
		k.foe('snowBeast', x(16100), { range: 200 });
		k.foe('thornWolf', x(15850), { range: 180 });
		k.foe('iceArcher', x(15380), { y: B - 1000, range: 80, detect: 620 });

		/* ------------------------------------------------------------ the icy hollows */
		district(x(16500), 'The Icy Hollows');
		grove(x(16400), x(21300), 260, ['pine-snow0', 'pine-snow1', 'spruce-snow0', 'pine-snow2', 'dead-snow0'], 380, 560, 741, { layer: 'back' });
		grove(x(16800), x(20800), 800, ['pine-snow1', 'spruce-snow0'], 440, 560, 742);
		scatter(x(16400), x(21300), 200, ['rock-snow0', 'rock-snow1', 'bush-snow0', 'ice0'], 50, 130, 743);
		for (const u of [17500, 18600]) { bush('ice1', x(u), 120, { sink: 6 }); bush('ice0', x(u + 80), 90); }
		k.foe('frostWraith', x(17520), { range: 200 });
		k.foe('frostWraith', x(18580), { range: 220 });
		// an archer on a rock in the hollows
		const archerY = Math.round(E.surf(x(18200)) - 130);
		bld('crag', x(18120), { w: 160, h: 150, seed: 744, snow: true, flat: 0.7 }, { key: 'cwcrag', y: Math.round(E.surf(x(18200)) + 20), flat: false });
		plat(x(18160), archerY, 90, 22, { thin: true, oneway: true });
		k.foe('iceArcher', x(18205), { y: archerY, range: 30, detect: 680 });

		/* ------------------------------------------------------------ J5: the eastern approach */
		district(x(19300), 'The Eastern Approach');
		bush('boulder-snow0', x(19700), 220, { layer: 'back' });
		road('wagon', x(20500), 160);
		road('crates', x(20330), 80);
		k.npc({ id: 'peddler', name: 'Northern Peddler', x: x(20420), minX: x(20300), maxX: x(20650), icon: '🧣', sprite: 'merchant', tall: 100, hubShop: 'peddler',
			dialogue: {
				FIRST_MEETING: talk('Northern Peddler', '🧣', ['Draughts, mittens, rope! Everything you wish you had brought. I follow the cold — it’s good for business.']),
				BASIC_DIALOGUE: talk('Northern Peddler', '🧣', ['North to the pass or south to the King’s Road. Either way, buy mittens.'])
			} });
		k.junction(x(20000), [
			{ label: 'The King’s North Road', way: 'South', to: 'J5_north', point: 1 },
			{ label: 'The Northwatch Pass', way: 'North', to: 'J5_pass', point: 1 }
		], { snowy: true });
		road('shrine', x(21150), 200, { sink: 10 });

		W.walkers.push({ x: x(1200), minX: x(800), maxX: x(1600), speed: 0.3, sprite: 'forest-ranger', name: 'Woodcutter' });
		for (const u of [1500, 5300, 7700]) W.slimes.push({ x: x(u), w: 60, h: 46 });
	});
})(typeof window !== 'undefined' ? window : globalThis);
