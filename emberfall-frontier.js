/* EmberFall's northern frontier (c55): five new stretches of road north of Emberfall, laid out in the same world
   as the Western Approach and the King's North Road, each ~22000 px long, joined at the grid's crossings by
   fingerpost junctions (press L to turn onto the other road, exactly like the J6 crossroads).

     J5–J4  The Northwatch Pass     78000 – 100000   x = north     (emberfall-layout-northpass.js)
     I6–I5  The Upper Millstream   102000 – 124000   x = north     (emberfall-layout-millstream.js)
     I5–I4  The Pineward Rise      124000 – 146000   x = north     (emberfall-layout-pineward.js)
     I5–J5  The Frostline Causeway 148000 – 170000   x = east      (emberfall-layout-causeway.js)
     I4–J4  The Highland Traverse  172000 – 194000   x = east      (emberfall-layout-traverse.js)

   Roads that carry straight on along the same grid line are one continuous stretch of ground with no
   transition (c57), just like the Western Approach running into the city at J6:
     J6 → J5 → J4   the King's North Road runs straight into the Northwatch Pass (seam at 78000)
     I6 → I5 → I4   the Upper Millstream runs straight into the Pineward Rise (seam at 124000)
   Only turns onto a road in another direction use a fingerpost (press L).

   Junction heights and climates match on both sides, so turning at a crossing never drops you somewhere else:
     I6  B−120   meadow          (Western Approach start ↔ Millstream start)
     I5  B−520   pines, cool     (Millstream end ↔ Pineward start ↔ Causeway start)
     J5  B−1100  snow            (North Road end ↔ Causeway end ↔ Northwatch Pass start)
     I4  B−1300  rock and frost  (Pineward end ↔ Traverse start)
     J4  B−2000  high snow       (Northwatch Pass end ↔ Traverse end)

   This file holds the shared kit (regions, junctions, caves, NPC tasks, foes, interactables) and the junction
   wiring; each segment file registers a builder in EmberfallFrontierSegs. */
(function (global) {
	'use strict';
	const SEG = global.EmberfallFrontierSegs = global.EmberfallFrontierSegs || [];

	/* the junction points (x where you arrive, facing) */
	const J = {
		I6_west: { x: 360, face: 1 },             // Western Approach start (Valedorn Fields)
		I6_mill: { x: 102760, face: 1 },          // Millstream start
		I5_mill: { x: 122300, face: -1 },         // the I5 crossroads on the Millstream/Pineward road, heading south
		I5_pine: { x: 122300, face: 1 },          // … heading north
		I5_cause: { x: 148760, face: 1 },         // Causeway start (west end)
		I4_pine: { x: 145060, face: -1 },         // Pineward end
		I4_trav: { x: 172760, face: 1 },          // Traverse start (west end)
		J5_north: { x: 76560, face: -1 },         // the J5 shrine on the North Road/Northwatch road, heading south
		J5_pass: { x: 76560, face: 1 },           // … heading north
		J5_cause: { x: 169060, face: -1 },        // Causeway end (east end)
		J4_pass: { x: 99060, face: -1 },          // Northwatch Pass end
		J4_trav: { x: 193060, face: -1 }          // Traverse end (east end)
	};

	function drawMouth(ctx, cam, x, y, v, t) {
		/* a dark arched opening in the slope, ringed with rough stone (or a timber frame for a mine) */
		const A = global.EmberfallArt;
		const sx = x - cam.x, sy = y - cam.y;
		if (sx < -200 || sx > ctx.canvas.width + 200) return;
		const w = v.mouthW || 120, hh = v.mouthH || 150;
		ctx.save();
		ctx.beginPath();
		ctx.moveTo(sx - w / 2, sy + 6);
		ctx.lineTo(sx - w / 2, sy - hh + w / 2);
		ctx.arc(sx, sy - hh + w / 2, w / 2, Math.PI, 0);
		ctx.lineTo(sx + w / 2, sy + 6);
		ctx.closePath();
		const g = ctx.createLinearGradient(0, sy - hh, 0, sy);
		g.addColorStop(0, '#050404');
		g.addColorStop(1, '#16110d');
		ctx.fillStyle = g;
		ctx.fill();
		ctx.lineWidth = v.timber ? 0 : 16;
		if (!v.timber) {
			ctx.strokeStyle = A.pattern(ctx, v.cold ? 'rockfaceCold' : 'rockface', -cam.x % 300, -cam.y % 300);
			ctx.stroke();
			ctx.strokeStyle = 'rgba(0,0,0,0.35)';
			ctx.lineWidth = 4;
			ctx.stroke();
		}
		ctx.restore();
		if (v.timber) {
			// posts, a lintel and a lamp, like an old adit
			ctx.fillStyle = '#4a321e';
			ctx.fillRect(sx - w / 2 - 6, sy - hh, 16, hh + 6);
			ctx.fillRect(sx + w / 2 - 10, sy - hh, 16, hh + 6);
			ctx.fillRect(sx - w / 2 - 20, sy - hh - 16, w + 40, 20);
			ctx.fillStyle = 'rgba(255,220,170,0.25)';
			ctx.fillRect(sx - w / 2 - 20, sy - hh - 16, w + 40, 3);
			const fl = 0.8 + Math.sin(t * 9) * 0.1;
			const lg = ctx.createRadialGradient(sx, sy - hh + 22, 2, sx, sy - hh + 22, 60);
			lg.addColorStop(0, 'rgba(255,196,110,' + 0.5 * fl + ')');
			lg.addColorStop(1, 'rgba(255,196,110,0)');
			ctx.fillStyle = lg;
			ctx.fillRect(sx - 60, sy - hh - 38, 120, 120);
			ctx.fillStyle = '#ffd27a';
			ctx.fillRect(sx - 4, sy - hh + 14, 8, 12);
		}
		if (v.snowy) {
			ctx.fillStyle = 'rgba(245,249,252,0.95)';
			ctx.beginPath();
			ctx.ellipse(sx, sy - hh - 6, w * 0.62, 10, 0, Math.PI, 0);
			ctx.fill();
		}
	}
	function drawDaylight(ctx, cam, x, floor, h) {
		/* inside the cave, a soft shaft of light where the way out is */
		const sx = x - cam.x, sy = floor - cam.y;
		if (sx < -200 || sx > ctx.canvas.width + 200) return;
		ctx.save();
		ctx.globalCompositeOperation = 'lighter';
		const g = ctx.createRadialGradient(sx, sy - h * 0.45, 4, sx, sy - h * 0.45, h * 0.9);
		g.addColorStop(0, 'rgba(255,240,200,0.28)');
		g.addColorStop(1, 'rgba(255,240,200,0)');
		ctx.fillStyle = g;
		ctx.fillRect(sx - h, sy - h * 1.4, h * 2, h * 1.4);
		ctx.restore();
		// an arched opening shape in the cave wall
		ctx.strokeStyle = 'rgba(255,236,190,0.35)';
		ctx.lineWidth = 3;
		ctx.beginPath();
		ctx.moveTo(sx - 50, sy);
		ctx.lineTo(sx - 50, sy - 110);
		ctx.arc(sx, sy - 110, 50, Math.PI, 0);
		ctx.lineTo(sx + 50, sy);
		ctx.stroke();
	}

	global.EmberfallFrontier = function (K) {
		const { E, W, A, B, M, bld, house, tree, bush, road, dress, plat, water, lamp, district, grove, scatter, ITEMS, SHOPS } = K;
		W.regions = W.regions || [];
		W.foes = W.foes || [];
		W.motes = W.motes || [];
		W.winds = W.winds || [];
		W.backStructs = W.backStructs || [];

		/* ---------------------------------------------------------------- items and shops for the frontier */
		Object.assign(ITEMS, {
			frost_draught: { name: 'Warming Draught', type: 'consumable', icon: '🍵', rarity: 'common', stats: {}, price: 20, desc: 'Spiced and bitter. Keeps the cold out of your hands for an hour.' },
			pine_resin: { name: 'Pine Resin', type: 'material', icon: '🟠', rarity: 'common', stats: {}, price: 9, desc: 'Sticky amber from the Pineward. Seals torches, boots and bad cuts.' },
			frostcap: { name: 'Frostcap Moss', type: 'material', icon: '🍃', rarity: 'common', stats: {}, price: 12, desc: 'A pale moss that only grows where the frost touches every night.' },
			river_pearl: { name: 'River Pearl', type: 'gem', icon: '⚪', rarity: 'uncommon', stats: { manaRegen: 1 }, price: 40, desc: 'A grey pearl from the Millstream mussel beds.' },
			old_compass: { name: 'Old Compass', type: 'material', icon: '🧭', rarity: 'uncommon', stats: {}, price: 35, desc: 'Its needle still swings north, a little east of true.' },
			climbing_rope: { name: 'Climbing Rope', type: 'material', icon: '🪢', rarity: 'common', stats: {}, price: 18, desc: 'Forty feet of tarred hemp.' },
			fur_mittens: { name: 'Fur Mittens', type: 'consumable', icon: '🧤', rarity: 'common', stats: { magicDefence: 1 }, price: 26, desc: 'Lined with rabbit. Clumsy, and worth it.' },
			lodge_key: { name: 'Pinewatch Key', type: 'key', icon: '🗝️', rarity: 'uncommon', stats: {}, price: 0, desc: 'An iron key on a leather loop. It opens the lodge’s storeroom.' },
			glass_ice: { name: 'Glassfall Shard', type: 'gem', icon: '🔹', rarity: 'rare', stats: { magicControl: 2 }, price: 80, desc: 'Ice from behind the frozen waterfall that does not melt in your hand.' },
			survey_lens: { name: 'Surveyor’s Lens', type: 'material', icon: '🔭', rarity: 'uncommon', stats: {}, price: 45, desc: 'A brass lens from an old theodolite.' },
			iron_ore: { name: 'Coldstone Ore', type: 'material', icon: '⛏️', rarity: 'common', stats: {}, price: 15, desc: 'Iron-grey ore with a blue sheen.' }
		});
		Object.assign(SHOPS, {
			bram: { title: 'Bram’s Satchel', stock: ['ember_herb', 'frostcap', 'ember_potion_hp', 'pine_resin'] },
			peddler: { title: 'Northern Peddler', stock: ['frost_draught', 'fur_mittens', 'climbing_rope', 'ember_torch', 'ember_rations'] },
			hadrik: { title: 'Gatehouse Stores', stock: ['frost_draught', 'ember_bandage', 'ember_rations'] }
		});

		/* ---------------------------------------------------------------- the kit */
		const talk = W.talk;
		const F = {
			flag(k) { try { return !!localStorage.getItem('magicBattle_ef_' + k); } catch (e) { return false; } },
			setFlag(k) { try { localStorage.setItem('magicBattle_ef_' + k, '1'); } catch (e) {} },
			taken(id) { try { return !!localStorage.getItem('magicBattle_road_' + id); } catch (e) { return false; } },
			give(id) { if (typeof global.addRoadFind === 'function') global.addRoadFind(id); }
		};
		const kit = Object.assign({}, K, {
			F, J, talk,
			region(id, x0, name, grid, o) {
				o = o || {};
				const r = { id, x0, x1: x0 + 22000, name, grid, start: x0 + 900 };
				W.regions.push(r);
				if (!o.openStart) W.walls.push(x0 + 260);
				if (!o.openEnd) W.walls.push(x0 + 21740);
				return r;
			},
			/* mountain shoulders closing both ends of a segment (a wall you cannot climb) */
			ends(x0, yStart, yEnd, o) {
				// an open end runs on, level, into the next road on the same line (no wall, no transition)
				o = o || {};
				if (o.openStart) E.ground([[x0, yStart], [x0 + 620, yStart]]);
				else {
					E.ground([[x0, B - 2700], [x0 + 300, B - 2700], [x0 + 560, yStart, 'l'], [x0 + 620, yStart]]);
					E.rockBody(x0, x0 + 600);
				}
				if (o.openEnd) E.ground([[x0 + 21380, yEnd], [x0 + 22000, yEnd]]);
				else {
					E.ground([[x0 + 21380, yEnd], [x0 + 21440, yEnd], [x0 + 21700, B - 2700, 'l'], [x0 + 22000, B - 2700]]);
					E.rockBody(x0 + 21400, x0 + 22000);
				}
			},
			/* a fingerpost junction: one sign per road leaving it. each = { label, way, to: J.key, point } */
			junction(x, list, o) {
				o = o || {};
				list.forEach((j, i) => {
					const t = J[j.to];
					W.joints.push({ x: x + i * 520, w: 220, to: t.x, face: t.face, label: j.label, way: j.way, point: j.point || 1, snowy: !!o.snowy });
				});
			},
			npc(def) { const n = W.npc(def); W.npcs.push(n); return n; },
			/* an NPC with a small errand: talk → task given; when `need()` is true, talk again → reward, then `after` */
			taskNpc(def, task) {
				const n = W.npc(def);
				const key = 'task_' + task.id;
				n.getDialogue = function () {
					const name = this.name, icon = this.icon;
					const L = (arr) => talk(name, icon, arr);
					if (F.flag(key + '_done')) return L(task.after);
					if (!F.flag(key)) { F.setFlag(key); return L(task.intro); }
					if (task.need()) {
						F.setFlag(key + '_done');
						if (task.reward) for (const id of [].concat(task.reward)) F.give(id);
						if (task.onDone) task.onDone();
						return L(task.done.concat(task.reward ? ['(' + [].concat(task.reward).map(id => (ITEMS[id] ? ITEMS[id].icon + ' ' + ITEMS[id].name : id)).join(', ') + ' added to your pack.)'] : []));
					}
					return L(task.waiting);
				};
				W.npcs.push(n);
				return n;
			},
			foe(type, x, o) { W.foes.push(Object.assign({ type, x }, o || {})); },
			loot(id, x, text, item, o) { const l = Object.assign({ id: 'ef_' + id, x: x - 60, w: 120, text, item }, o || {}); W.loots.push(l); return l; },
			lore(x, label, title, lines, o) {
				W.interacts.push(Object.assign({ x: x - 70, w: 140, label, title, text: lines[0], more: lines.slice(1), icon: '🪨', verb: 'read' }, o || {}));
			},
			use(x, label, fn, o) { W.interacts.push(Object.assign({ x: x - 70, w: 140, label, use: fn, verb: 'use' }, o || {})); },
			/* a cave: a mouth in the hillside at `mouth` (press E) leading to a hollow dug well under the ground — the
			   interior is a real void in the terrain with its own floor, so the creatures in it fight you there.
			   v = { mouth, x, w, h, name, dark, depth, vines, timber, wall, lamps: [x...], exitAt: 'L'|'R' } */
			cave(v) {
				const h = v.h || 230;
				let lo = -1e9;
				for (let x = v.x - 60; x <= v.x + v.w + 60; x += 16) lo = Math.max(lo, E.surf(x));
				const floor = Math.round(lo + (v.depth || 200) + h);
				const top = floor - h;
				const vo = { x: v.x, y: top, w: v.w, h, arch: v.arch == null ? 70 : v.arch, wall: v.wall === 'stone' ? 'stone' : null, dark: v.dark !== false, name: v.name };
				W.voids.push(vo);
				plat(v.x - 40, floor, v.w + 80, 80);
				plat(v.x - 40, top - 80, v.w + 80, 80);
				plat(v.x - 40, top - 80, 44, h + 160, { wall: true });
				plat(v.x + v.w - 4, top - 80, 44, h + 160, { wall: true });
				const inX = v.exitAt === 'R' ? v.x + v.w - 170 : v.x + 50;
				const my = E.surf(v.mouth);
				W.portals = W.portals || [];
				W.portals.push({ x: v.mouth - 60, w: 120, y: my, toX: inX + 40, toY: floor, label: v.name });
				W.portals.push({ x: inX, w: 120, y: floor, toX: v.mouth - 18, toY: my, label: 'into the daylight', verb: 'climb out' });
				// the mouth outside and the shaft of daylight inside
				W.structs.push({ x0: v.mouth - 200, x1: v.mouth + 200, draw: (ctx, cam, t) => drawMouth(ctx, cam, v.mouth, my, v, t) });
				W.structs.push({ x0: inX - 100, x1: inX + 220, draw: (ctx, cam, t) => drawDaylight(ctx, cam, inX + 60, floor, h) });
				if (v.vines) kit.curtain(v.mouth - 70, my - 230, 140);
				for (const lx of v.lamps || []) W.lamps.push({ x: lx, y: floor, h: 100 });
				vo.floor = floor;
				return vo;
			},
			stairs(x0, x1, mat) { W.structs.push({ kind: 'steps', x0, x1, mat: mat || 'stone' }); },
			ledge(x, y, w, art) { return plat(x, y, w, 22, { thin: true, oneway: true, art: art || 'corbel' }); },
			fall(x, top, bottom, w, o) { W.falls.push(Object.assign({ x, top, bottom, w }, o || {})); },
			motes(x0, x1, col) { W.motes.push({ x0, x1, col }); },
			wind(x0, x1, k) { W.winds.push({ x0, x1, k }); },
			zone: E.zone,
			curtain(x, top, w) {
				// hanging vines in front of a cave mouth
				for (let k = 0; k < w; k += 46) bush(k % 92 ? 'vine1' : 'vine0', x + k, 200 + (k * 37 % 90), { y: top + 210, layer: 'front', alpha: 0.95 });
			},
			snowy(x0, x1) { E.material(x0, x1, M.snow); }
		});

		/* ---------------------------------------------------------------- climate of the old roads */
		// the King's North Road: farmland with a cool sky, the pines, then snow toward the shrine at J5
		E.zone(56000, 61000, 'north', 0.02, 0.3);
		E.zone(61000, 68600, 'north', 0.3, 0.5);
		E.zone(68600, 74800, 'north', 0.5, 0.85);
		E.zone(74800, 78000, 'north', 0.95, 1);

		/* ---------------------------------------------------------------- junctions on the old roads */
		// I6: the Western Approach starts in Valedorn Fields at the hedgerow — the Millstream runs north from here
		kit.junction(140, [{ label: 'The Upper Millstream', way: 'North', to: 'I6_mill', point: -1 }]);
		// J5: the shrine at the end of the King's North Road — west along the Frostline, north up the pass
		// (the Northwatch Pass carries straight on north from here: no sign needed for it)
		kit.junction(75900, [{ label: 'The Frostline Causeway', way: 'West', to: 'J5_cause', point: -1 }], { snowy: true });
		// the shrine's old remark about three roads now comes true
		E.material(76300, 77700, M.snow);

		for (const build of SEG) build(kit);
		W.districts.sort((a, b) => a.x - b.x);
	};
})(typeof window !== 'undefined' ? window : globalThis);
