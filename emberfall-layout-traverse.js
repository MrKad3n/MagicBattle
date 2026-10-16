/* I4–J4 — The Highland Traverse (172000 – 194000; walking right = east).
   The long shelf under the Frostmere Range, linking the top of the Pineward Rise (I4) to the top of the Northwatch
   Pass (J4). It starts in frost-touched pines and climbs, mile by mile, into rock and snow with the mountains
   always looming to the north: the Highland Gate, the King's Aqueduct striding across the shelf (and its
   maintenance tower), the stranded supply team and their rockfall, the bandits picking over a lost cart, the
   Glassfall Grotto behind its frozen waterfall with Brother Caldus's hut beside it, Eagle's Rest Overlook, the
   rimed slopes and the high snowfield at J4. Quieter than the pass: fewer foes, more to find. */
(function (global) {
	'use strict';
	(global.EmberfallFrontierSegs = global.EmberfallFrontierSegs || []).push(function (k) {
		const { E, W, A, B, M, bld, house, tree, bush, road, dress, plat, water, lamp, district, grove, scatter, F, talk } = k;
		const X = 172000;
		const x = (u) => X + u;
		k.region('traverse', X, 'The Highland Traverse', 'I4 — J4');

		/* a small campfire: logs, embers and flickering flames, with a glow that lights a cave */
		function campfire(cx, cy, glow) {
			W.structs.push({ x0: cx - 80, x1: cx + 80, draw(ctx, cam, t) {
				const sx = cx - cam.x, sy = cy - cam.y;
				ctx.save();
				ctx.fillStyle = 'rgba(0,0,0,0.3)';
				ctx.beginPath(); ctx.ellipse(sx, sy - 2, 44, 7, 0, 0, Math.PI * 2); ctx.fill();
				for (const [a, l] of [[-0.35, 58], [0.32, 54], [0.05, 48]]) {
					ctx.save();
					ctx.translate(sx, sy - 8);
					ctx.rotate(a);
					ctx.fillStyle = '#4a3020';
					ctx.fillRect(-l / 2, -5, l, 10);
					ctx.fillStyle = '#6a4a30';
					ctx.fillRect(-l / 2, -5, l, 3);
					ctx.restore();
				}
				if (glow !== 'cold') {
					for (let i = 0; i < 5; i++) {
						const ph = t * (5 + i) + i * 1.7;
						const h = 24 + Math.sin(ph) * 7 + (i === 2 ? 14 : 0);
						const fx = sx + (i - 2) * 7 + Math.sin(ph * 0.7) * 2;
						const gr = ctx.createLinearGradient(0, sy - 10 - h, 0, sy - 8);
						gr.addColorStop(0, 'rgba(255,230,120,0)');
						gr.addColorStop(0.4, 'rgba(255,170,50,0.9)');
						gr.addColorStop(1, 'rgba(230,80,20,0.95)');
						ctx.fillStyle = gr;
						ctx.beginPath();
						ctx.moveTo(fx - 7, sy - 8);
						ctx.quadraticCurveTo(fx - 4, sy - 8 - h * 0.6, fx, sy - 10 - h);
						ctx.quadraticCurveTo(fx + 4, sy - 8 - h * 0.6, fx + 7, sy - 8);
						ctx.fill();
					}
					const g2 = ctx.createRadialGradient(sx, sy - 16, 4, sx, sy - 16, 90);
					g2.addColorStop(0, 'rgba(255,170,70,0.28)');
					g2.addColorStop(1, 'rgba(255,170,70,0)');
					ctx.fillStyle = g2;
					ctx.fillRect(sx - 90, sy - 106, 180, 180);
				} else {
					// a dead fire: grey ash and a thread of smoke
					ctx.fillStyle = '#8a8a88';
					ctx.beginPath(); ctx.ellipse(sx, sy - 6, 24, 5, 0, 0, Math.PI * 2); ctx.fill();
					ctx.strokeStyle = 'rgba(200,200,205,0.25)';
					ctx.lineWidth = 3;
					ctx.beginPath();
					ctx.moveTo(sx, sy - 10);
					for (let k2 = 1; k2 < 8; k2++) ctx.lineTo(sx + Math.sin(t * 1.3 + k2) * 6 + k2 * 2, sy - 10 - k2 * 12);
					ctx.stroke();
				}
				ctx.restore();
			} });
			if (glow && glow !== 'cold') { W.glows = W.glows || []; W.glows.push({ x: cx, y: cy - 30, r: 260, a: 0.9 }); }
		}

		/* ------------------------------------------------------------ the land */
		const G = (pts) => E.ground(pts.map(([u, y, m]) => m ? [x(u), B + y, m] : [x(u), B + y]));
		k.ends(X, B - 1300, B - 2000);
		G([
			[620, -1300], [1500, -1320], [2300, -1370],
			// the King's Aqueduct strides across a level shelf
			[2700, -1410], [6700, -1420],
			// the climb to the rockfall
			[7100, -1460], [7500, -1500], [9300, -1510],
			// the looted cart
			[9800, -1540], [10300, -1560],
			// the Glassfall basin, under the cliff
			[10600, -1580], [12300, -1580],
			// pitches up out of the basin
			[12500, -1600], [12700, -1690], [13000, -1700], [13300, -1780], [13700, -1790],
			// the shoulder up to Eagle's Rest
			[14300, -1850], [14800, -1880], [15200, -1940], [16300, -1950],
			// over the top and down onto the rimed slopes
			[16900, -1900], [17600, -1880], [18300, -1920], [19000, -1970],
			// the high snowfield at J4
			[19600, -2000], [21380, -2000]
		]);
		E.rough(x(620), x(2600), 16, 901);
		E.rough(x(7000), x(10400), 20, 902);
		E.rough(x(13700), x(15100), 22, 903);
		E.rough(x(16400), x(19500), 24, 904);
		E.material(x(600), x(21400), M.meadow);
		for (const [a, b] of [[900, 1200], [1700, 2100], [5800, 6300], [7300, 7800]]) E.material(x(a), x(b), M.frost);
		E.material(x(2700), x(6700), M.dirt);
		E.material(x(8200), x(10500), M.frost);
		E.material(x(10500), x(21400), M.snow);
		E.material(x(12450), x(13350), M.rock);
		E.rockBody(x(12400), x(13400));
		E.rockBody(x(14200), x(16600));
		E.zone(x(0), x(8000), 'frostpine', 0.6, 0.72);
		E.zone(x(8000), x(13000), 'frostpine', 0.72, 0.9);
		E.zone(x(13000), x(22100), 'alpine', 0.95, 1);
		k.wind(x(14200), x(16800), 0.5);
		k.wind(x(18800), x(21200), 0.4);

		/* ------------------------------------------------------------ I4: the Highland Gate */
		district(x(600), 'The Highland Gate');
		k.junction(x(640), [{ label: 'The Pineward Rise', way: 'West', to: 'I4_pine', point: -1 }]);
		grove(x(620), x(7400), 180, ['pine-frost0', 'pine-frost1', 'spruce0', 'spruce-snow0', 'pine1'], 480, 680, 911, { layer: 'back' });
		grove(x(1100), x(2500), 320, ['pine-frost0', 'spruce1', 'spruce-snow0', 'dead0'], 460, 620, 912);
		scatter(x(620), x(7400), 160, ['heather0', 'rock-snow0', 'bush-snow0', 'fern1', 'stump-snow0'], 50, 110, 913);
		bush('log-snow0', x(1300), 100, { sink: 12, rot: -0.02 });
		bld('marker', x(1050), { w: 80, h: 140, seed: 914, snow: true, stones: [{ x: 40, w: 44, h: 116, lean: -0.04, glyph: 'ᛏ' }] }, { key: 'trmark1' });
		k.lore(x(1090), 'the boundary stone', 'Highland boundary stone', ['A frost-split stone, carved with a crown over a river: "THE KING’S WATER. FROM HERE TO EMBERFALL BY THE AQUEDUCT." Someone has scratched underneath: "not any more."']);

		// Tamsin's survey camp
		district(x(1700), 'Tamsin’s Camp');
		road('tent', x(1850), 175);
		campfire(x(2080), E.surf(x(2080)));
		dress('telescope', x(2240), 110);
		k.taskNpc({ id: 'tamsin', name: 'Tamsin, the Cartographer', x: x(1980), minX: x(1900), maxX: x(2200), icon: '🗺️', sprite: 'scroll-vendor', tall: 100 }, {
			id: 'survey',
			intro: [
				'Oh! A traveller — good, you can hold the other end of the chain. No? Fine.',
				'I’m charting the Traverse for the Crown. Every old map stops at the Aqueduct, as if the world just ended there.',
				'There’s an old surveyors’ station at Eagle’s Rest, up on the shoulder past the Glassfall. The theodolite should still be bolted down. Take a sighting on Frostmere for me? The mountains won’t sit still for my eyes, but they might for its lens.'
			],
			waiting: ['Eagle’s Rest — the high shoulder past the frozen falls. Use the old theodolite by the hut. And mind the archers; they like high places too.'],
			need: () => F.flag('eagle_sighted'),
			done: [
				'You did it! A clear bearing on Frostmere… so the Glass Stair really does exist. Eleven leagues. Eleven!',
				'I owe you. Take these — and the last of my good chalk. If you find any more of the old Crown stations, I want to hear about them.'
			],
			after: ['North of the high snowfield the road vanishes under the ice. I’ll get there. Next year. Maybe the year after.'],
			reward: ['ember_crystal', 'frost_draught']
		});

		/* ------------------------------------------------------------ the King's Aqueduct */
		district(x(2700), 'The King’s Aqueduct');
		const AQ0 = 2900, AQW = 3600, AQH = 470;
		const aqY = Math.round(E.surf(x(AQ0 + AQW / 2)));
		const aq = bld('aqueduct', x(AQ0), { w: AQW, h: AQH, arches: 12, seed: 921, snow: true, broken: [[0.34, 0.44], [0.78, 0.83]], tower: 0.6 },
			{ key: 'tr-aqueduct', id: 'tr-aqtower', label: 'the Aqueduct support tower', room: 'tr-works', kind: 'works', door: { x: AQW * 0.6 - 32, w: 64 } });
		aq.roomBuilder = (W2, b) => {
			const fake = Object.assign({}, b, { x: b.x + AQW * 0.6 - 90, w: 180, type: 'house', spec: { w: 180, floors: 2, fh: 200, plinth: 0, door: 0.5, doorW: 64, doorH: 106, archDoor: true } });
			const r = global.EmberfallInteriors.buildHouseRoom(W2, fake);
			r.building = fake;
			return r;
		};
		// the dry channel on top is walkable (the upper route), broken where the spans fell
		const chY = aqY - AQH;
		for (const [a, b] of [[0, 0.34], [0.44, 0.78], [0.83, 1]]) plat(x(AQ0 + a * AQW), chY, (b - a) * AQW, 22, { thin: true, oneway: true });
		// a way up: the rubble ramp of the first fallen span (a stack of blocks, then corbels)
		for (const [u, h] of [[AQ0 + 0.34 * AQW + 40, 120], [AQ0 + 0.34 * AQW + 150, 230], [AQ0 + 0.34 * AQW + 260, 340]]) k.ledge(x(u), aqY - h, 90, 'stone');
		k.ledge(x(AQ0 + 0.44 * AQW - 70), chY + 10, 70, 'stone');
		k.lore(x(AQ0 + 220), 'the aqueduct pier', 'The King’s Aqueduct', [
			'Twelve arches of grey stone across the shelf. A bronze plate, green with age: "BUILT IN THE NINTH YEAR — THAT EMBERFALL SHALL DRINK THE MOUNTAIN."',
			'The channel on top is dry and choked with snow. Somewhere up in the range, the water it carried has frozen at the source.'
		]);
		// the support tower's maintenance chambers: stores below, a cache on the upper floor
		const aqRoomY = aq.y;
		k.lore(x(AQ0 + AQW * 0.6 - 30), 'the sluice register', 'Maintenance register', [
			'A ledger in a tin box: flow readings, every day for thirty years, in four different hands. The last page: "Flow nil. Ice at the head-works. Sent for orders."',
			'No orders came. The last keeper has drawn a little ice-house in the margin, "under the third arch, sealed".'
		], { room: 'tr-works', y: aqRoomY, icon: '📒' });
		k.loot('aq-stores', x(AQ0 + AQW * 0.6 + 40), 'The keepers’ stores: rope, tallow, and a crate of iron fittings for the sluices.', 'climbing_rope',
			{ room: 'tr-works', y: aqRoomY, extra: ['iron_ore'], where: 'the stores' });
		k.loot('aq-tower', x(AQ0 + AQW * 0.6 - 20), 'In the tower’s upper chamber, behind a loose block, the keepers’ strongbox: wages that were never collected.', 'ember_ruby',
			{ room: 'tr-works', y: aqRoomY - 200, extra: ['frost_draught'], where: 'the loose block', icon: '📦' });
		// up on the channel, past the second break: something left by the last keeper
		k.loot('aq-channel', x(AQ0 + 0.9 * AQW), 'Frozen into the snow on the dry channel: a keeper’s satchel with a sealed tonic and a brass gauge.', 'ember_potion_hp',
			{ y: chY, where: 'the satchel' });
		// the snow beast that dens under the arches
		k.foe('snowBeast', x(AQ0 + 1200), { range: 280, detect: 520 });
		bush('boulder-snow0', x(AQ0 + 0.39 * AQW), 120, { sink: 18 });
		for (const u of [AQ0 + 500, AQ0 + 1900, AQ0 + 3000]) bush('icicles0', x(u), 70, { y: chY + 80, layer: 'front' });
		scatter(x(AQ0), x(AQ0 + AQW), 260, ['rock-snow1', 'stump-snow0', 'bush-snow0'], 50, 100, 922);

		/* ------------------------------------------------------------ the rockfall and the supply team */
		district(x(7200), 'The Rockfall');
		road('cart', x(7900), 130, { rot: 0.12 });
		road('sacks', x(8060), 70);
		road('crates', x(7760), 80, { rot: -0.08 });
		campfire(x(7620), E.surf(x(7620)));
		const ROCKS = [[8360, 'boulder-snow0', 170], [8520, 'boulder0', 140], [8700, 'rock-snow1', 120]];
		const cleared = (i) => F.flag('rockfall_' + i);
		const allClear = () => ROCKS.every((_, i) => cleared(i));
		ROCKS.forEach(([u, sp, h], i) => {
			const r = bush(sp, x(u), h, { sink: 10 });
			r.show = () => !cleared(i);
			k.use(x(u), 'the fallen rock', (p, api) => {
				api.setFlag('rockfall_' + i);
				const left = ROCKS.filter((_, j) => !cleared(j)).length;
				api.say([{ name: 'The rockfall', icon: '🪨', text: left ? 'You set your shoulder to it, rock it, and send it bouncing down the slope. (' + left + ' more on the road.)' : 'The last rock goes tumbling off the shelf. The road is clear — a cart could get through now.' }]);
			}, { verb: 'push', when: () => !cleared(i) });
			bush('rock-snow0', x(u + 90 + i * 30), 60, { layer: 'back' });
		});
		k.taskNpc({ id: 'brannoc', name: 'Brannoc, the Teamster', x: x(8160), minX: x(8100), maxX: x(8240), icon: '🧔', sprite: 'black-smith', tall: 104 }, {
			id: 'clearpath',
			intro: [
				'Supplies for the Northwatch garrison — what’s left of it. Captain Hadrik hasn’t had a cart in two months.',
				'And then the hillside came down in front of us. Three rocks. I can shift one, my back says not three.',
				'Lend a shoulder? Walk up to each rock and give it a good push.'
			],
			waiting: ['Three rocks on the road ahead. Push them off the edge — they’ll roll.'],
			need: allClear,
			done: ['Ha! Look at that — a road again. Wenna, hitch the mule!', 'Here, from the cargo. Hadrik won’t miss a few, and he’d say the same.'],
			after: ['We’ll be at the Gatehouse by dark. If you see Hadrik before us, tell him the beans are coming.'],
			reward: ['ember_rations', 'fur_mittens']
		});
		k.npc({ id: 'wenna', name: 'Wenna, the Carter', x: x(7700), minX: x(7640), maxX: x(7820), icon: '🧣', sprite: 'merchant', tall: 98,
			getDialogue() {
				const L = (a) => talk('Wenna, the Carter', '🧣', a);
				if (F.flag('task_clearpath_done')) return L(['You moved the hill! Brannoc will be telling that story wrong for a year — it’ll be thirty rocks by spring.', 'Watch the cart further on. The bandits hit another team there; we only got past because they were busy with it.']);
				if (allClear()) return L(['Is that the road? Go tell Brannoc, he’s sulking by the cart.']);
				return L(['Don’t mind the fire. If we don’t keep it lit the mule thinks it’s time to die.', 'Bandits up the road, rocks down the road. Lovely trip.']);
			} });
		W.walkers.push({ x: x(7980), minX: x(7960), maxX: x(8000), speed: 0.05, sprite: 'generic-guard', name: 'Mule-minder' });

		/* ------------------------------------------------------------ the looted cart */
		district(x(9300), 'The Looted Cart');
		road('wagon', x(9750), 160, { rot: -0.1 });
		for (const [u, r] of [[9560, 0.2], [9930, -0.3], [10060, 0.1]]) road('crates', x(u), 70, { rot: r });
		road('sacks', x(9640), 60, { rot: 0.4 });
		k.foe('bandit', x(9600), { range: 160 });
		k.foe('bandit', x(9900), { range: 180 });
		k.foe('banditSlinger', x(10150), { range: 120 });
		k.lore(x(9780), 'the broken wagon', 'A looted wagon', ['Another supply team was less lucky. The crates are split open, the mules gone; the driver’s seat has a crossbow bolt in it.', 'A strongbox under the axle has been missed — the bandits were in too much of a hurry.']);
		k.loot('cart-strongbox', x(9840), 'Under the axle, wedged in the snow: the wagon’s strongbox. Pay for the garrison, and a letter of credit nobody will ever cash.', 'ember_ruby', { where: 'the strongbox' });

		/* ------------------------------------------------------------ the Glassfall Grotto */
		district(x(10500), 'The Glassfall Grotto');
		const gy = Math.round(E.surf(x(11300)));
		// the cliff the falls come down: a great crag behind the basin
		bld('crag', x(10850), { w: 900, h: 820, seed: 931, snow: true, flat: 0.5 }, { key: 'tr-cliff', y: gy + 30, layer: 'back', flat: false });
		const FALL = 11240, FALLW = 190;
		k.fall(x(FALL), gy - 700, gy + 10, FALLW, { frozen: true, front: true });
		// the cave behind the ice
		const grotto = k.cave({ mouth: x(FALL + 30), x: x(10900), w: 1500, h: 320, name: 'behind the frozen falls', snowy: true, cold: true, lamps: [], exitAt: 'L', mouthW: 110, mouthH: 150 });
		const gf = grotto.floor;
		// inside: ice formations, the blue light through the frozen falls, an abandoned camp, a seam of glassy ice
		for (const [u, sp, h] of [[11150, 'ice1', 220], [11330, 'ice0', 140], [11900, 'ice1', 260], [12020, 'ice0', 160], [12260, 'ice1', 190]]) bush(sp, x(u), h, { y: gf, layer: 'cave' });
		for (const u of [11050, 11420, 11700, 12120]) bush('icicles0', x(u), 90, { y: gf - 230, layer: 'cave' });
		W.glows = W.glows || [];
		W.glows.push({ x: x(11150), y: gf - 120, r: 300, a: 0.7 });
		W.glows.push({ x: x(11950), y: gf - 130, r: 260, a: 0.6 });
		road('tent', x(11560), 150, { y: gf, layer: 'cave' });
		dress('stores', x(11790), 90, { y: gf, layer: 'cave' });
		k.lore(x(11620), 'the abandoned camp', 'A cold camp', [
			'Someone wintered here: a tent stiff with frost, tins stacked neatly — and a fire that, somehow, is still burning. A journal with one line on every page — "Still waiting for V."',
			'The last entry: "The ice sings at night. I am going up the Glass Stair to find them. Brother C. says he will keep the fire."'
		], { y: gf, icon: '⛺' });
		k.loot('grotto-camp', x(11800), 'The camp’s stores, untouched: a sealed draught, a flint and good wool.', 'frost_draught', { y: gf, extra: ['ember_torch'], where: 'the stores' });
		k.loot('grotto-seam', x(12150), 'A seam of clear blue ice in the cave wall, hard as glass. You chip a shard free; it doesn’t melt.', 'glass_ice', { y: gf, where: 'the ice seam', icon: '🔹' });
		k.foe('frostWraith', x(12000), { y: gf, cave: true, range: 180 });
		k.foe('crystalScarab', x(11300), { y: gf, cave: true, range: 140 });
		// a hidden upper ledge high on the cliff beside the falls (Brother Caldus knows about it)
		const caldusTold = () => F.flag('caldus_ledge');
		for (const [u, h] of [[10890, 150], [10970, 300], [11040, 440], [11100, 580]]) k.ledge(x(u), gy - h, 90, 'stone');
		k.loot('glassfall-ledge', x(11145), 'On a ledge hidden by the curve of the ice, a hermit’s offering: a carved bone charm and a tin of something that smells like summer.', 'ember_crystal',
			{ y: gy - 580, hidden: true, reveal: caldusTold, extra: ['pine_resin'], where: 'the offering' });
		k.foe('frostWraith', x(10700), { range: 200 });
		// Brother Caldus's hut, sheltered by the cliff
		const hut = house(x(12000), { w: 400, floors: 1, fh: 170, roof: 'slate', wall: 'logs', chimney: [0.75], lit: 1, seed: 932, plinth: 24, win: [0], door: 0.35, snowRoof: true },
			{ id: 'caldus-hut', label: 'Brother Caldus’s hut', room: 'caldus-hut', kind: 'hermit' });
		k.npc({ id: 'caldus', name: 'Brother Caldus', x: x(12200), room: 'caldus-hut', floor: 0, minX: x(12150), maxX: x(12330), icon: '🕯️', sprite: 'eldery-sage', tall: 100,
			getDialogue() {
				const L = (a) => talk('Brother Caldus', '🕯️', a);
				if (!F.flag('caldus_ledge')) {
					F.setFlag('caldus_ledge');
					return L([
						'Come in, come in — shut the door, the cold is a guest who never leaves. Sit by the fire.',
						'I came up here to listen to the falls. Then one winter they stopped. Froze in a night, every drop of them. Now I listen to the ice instead.',
						'There’s a cave behind them, if you’re curious. And high on the cliff beside the ice, a ledge where I leave a little offering for the mountain — climb the stones by the falls. Take it; the mountain doesn’t eat much.'
					]);
				}
				return L(['The ice sings at night, you know. Like someone humming through a closed door.', 'Somebody camped in the grotto last winter, waiting for a friend. I took him soup. He went up the mountain. I pray for him.']);
			} });
		k.lore(x(12290), 'a book of hours', 'Caldus’s prayer book', ['A worn book, the margins full of tiny drawings of icicles. On the flyleaf: "For the ones who go up and for the ones who wait."'], { room: 'caldus-hut', y: hut.y, icon: '📖' });
		k.loot('caldus-gift', x(12080), 'A jar of honeyed tea on the shelf with a tag in neat writing: "for the cold road".', 'ember_potion_hp', { room: 'caldus-hut', y: hut.y, where: 'the shelf' });
		lamp(x(11920));
		grove(x(10500), x(12400), 260, ['spruce-snow0', 'pine-frost1', 'dead-snow0'], 380, 520, 933, { layer: 'back' });
		scatter(x(10400), x(12400), 200, ['rock-snow0', 'bush-snow0', 'ice0'], 50, 120, 934);
		k.motes(x(11000), x(11800), '#cfefff');

		/* ------------------------------------------------------------ up out of the basin */
		k.stairs(x(12500), x(12700));
		k.stairs(x(13000), x(13300));
		k.foe('iceArcher', x(13500), { range: 120, detect: 680 });

		/* ------------------------------------------------------------ Eagle's Rest Overlook */
		district(x(14200), 'Eagle’s Rest Overlook');
		k.stairs(x(14800), x(15200));
		const shelter = bld('shelter', x(15400), { w: 320, h: 170, seed: 941, snow: true }, { key: 'tr-shelter' });
		const oy = shelter.y;
		// the old surveyors' station: a theodolite on its plinth, a smashed equipment chest
		bld('marker', x(15820), { w: 80, h: 70, seed: 942, snow: true, stones: [{ x: 40, w: 60, h: 46, lean: 0 }] }, { key: 'tr-plinth' });
		W.structs.push({ x0: x(15760), x1: x(15920), draw(ctx, cam) {
			// the theodolite: brass, on a tripod bolted to the plinth
			const sx = x(15860) - cam.x, sy = oy - 46 - cam.y;
			ctx.save();
			ctx.strokeStyle = '#3a3026'; ctx.lineWidth = 4;
			for (const d of [-16, 0, 16]) { ctx.beginPath(); ctx.moveTo(sx, sy - 40); ctx.lineTo(sx + d, sy); ctx.stroke(); }
			ctx.fillStyle = '#a07a30';
			ctx.fillRect(sx - 8, sy - 54, 16, 16);
			ctx.save();
			ctx.translate(sx, sy - 58);
			ctx.rotate(-0.12);
			const g2 = ctx.createLinearGradient(0, -8, 0, 8);
			g2.addColorStop(0, '#e2c070'); g2.addColorStop(1, '#7a5420');
			ctx.fillStyle = g2;
			ctx.fillRect(-26, -7, 52, 14);
			ctx.fillStyle = '#2a3a4a';
			ctx.fillRect(24, -6, 5, 12);
			ctx.restore();
			ctx.fillStyle = 'rgba(255,255,255,0.85)';
			ctx.fillRect(sx - 26, sy - 68, 30, 3);
			ctx.restore();
		} });
		k.use(x(15860), 'the old theodolite', (p, api) => {
			const first = !api.flag('eagle_sighted');
			api.setFlag('eagle_sighted');
			api.say([
				{ name: 'The theodolite', icon: '🔭', text: 'You wipe the frost off the lens and sight north. Across a sea of white, Frostmere: a black spire of rock, a road cut into its flank like a stair of glass, and at the top something square and man-made, glinting.' },
				{ name: 'The theodolite', icon: '🔭', text: first ? 'You note the bearing on the plate for Tamsin. Swinging the lens down, you notice a cairn tucked under the shelter’s back wall — invisible from the path.' : 'Frostmere. Eleven leagues, and every one of them uphill.' }
			]);
		}, { verb: 'sight through', y: oy });
		k.loot('eagle-gear', x(15620), 'A surveyors’ chest, smashed open by the wind: chains, a cracked level — and one good brass lens, still in its case.', 'survey_lens', { y: oy, where: 'the chest', icon: '🔭' });
		k.loot('eagle-cairn', x(15350), 'Under the shelter’s back wall, a cairn you’d never see from the path. Inside, wrapped in oilcloth: the old station’s emergency supplies.', 'ember_potion_hp',
			{ y: oy, hidden: true, reveal: () => F.flag('eagle_sighted'), extra: ['frost_draught', 'ember_crystal'], where: 'the hidden cairn' });
		k.lore(x(15500), 'the ruined shelter', 'Eagle’s Rest', [
			'A surveyors’ hut, roofless now, its rafters down. Scratched into the doorframe: the heights of every peak you can see, and a little eagle.',
			'Beyond the edge, the whole Traverse is laid out below — the Aqueduct like a stitch across the shelf, the Glassfall a blue thread — and to the north, the mountains of Frostmere.'
		], { y: oy });
		// the eagle crag: a spire beyond the overlook (a flight route someday — the nest has something shiny in it)
		const spireY = Math.round(E.surf(x(16250)) + 30);
		bld('crag', x(16120), { w: 260, h: 680, seed: 943, snow: true, flat: 0.55 }, { key: 'tr-spire', y: spireY, layer: 'back', flat: false });
		plat(x(16180), spireY - 680, 140, 22, { thin: true, oneway: true });
		k.loot('eagle-nest', x(16250), 'In the old eagles’ nest on top of the spire: sticks, bones, and a ring a traveller lost long ago.', 'ember_ruby', { y: spireY - 680, where: 'the nest' });
		k.foe('iceArcher', x(15050), { range: 80, detect: 700 });
		k.foe('frostWraith', x(16600), { range: 220 });
		scatter(x(13700), x(17000), 220, ['rock-snow0', 'rock-snow1', 'bush-snow0', 'dead-snow0'], 50, 130, 944);
		bush('boulder-snow0', x(14500), 230, { layer: 'back' });

		/* ------------------------------------------------------------ the rimed slopes */
		district(x(17000), 'The Rimed Slopes');
		for (const [u, h] of [[17300, 180], [18400, 200]]) { bush('ice1', x(u), h, { layer: 'back' }); bush('ice0', x(u + 140), 110); }
		bld('ruin', x(17800), { w: 380, h: 140, seed: 951, snow: true }, { key: 'tr-ruin' });
		const rockY = Math.round(E.surf(x(18700)) + 20);
		bld('crag', x(18620), { w: 180, h: 190, seed: 952, snow: true, flat: 0.65 }, { key: 'tr-rock', y: rockY, flat: false });
		plat(x(18660), rockY - 190, 100, 22, { thin: true, oneway: true });
		k.foe('iceArcher', x(18710), { y: rockY - 190, range: 30, detect: 720 });
		k.loot('rimed-ruin', x(17990), 'In the lee of the broken wall, a frozen pack: dried fruit, and a scarf knitted in Emberfall colours.', 'ember_rations', { where: 'the pack' });
		scatter(x(17000), x(21300), 260, ['rock-snow0', 'rock-snow1', 'ice0', 'bush-snow0'], 50, 140, 953);

		/* ------------------------------------------------------------ J4: the high snowfield */
		district(x(19400), 'The High Snowfield');
		bush('boulder-snow0', x(19700), 220, { layer: 'back' });
		k.junction(x(20100), [{ label: 'The Northwatch Pass', way: 'South', to: 'J4_pass', point: 1 }], { snowy: true });
		bld('marker', x(20500), { w: 120, h: 200, seed: 961, snow: true, post: { x: 60, h: 170, w: 54 } }, { key: 'tr-cairn' });
		k.lore(x(20560), 'the waymark', 'The Traverse waymark', ['A tall stone with two arms: one, "WEST — THE KING’S AQUEDUCT — PINEWARD", the other "SOUTH — NORTHWATCH — THE KING’S ROAD". Nothing points north. North, there is only Frostmere.']);
		for (const u of [20800, 21150]) bush('ice1', x(u), 160, { layer: 'back' });
	});
})(typeof window !== 'undefined' ? window : globalThis);
