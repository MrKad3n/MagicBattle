/* EmberKeep — the castle on the crag, rebuilt inside as a real keep:
   two tower stairwells (west reaches from the ancient foundations to the observation deck), a grand stair in
   the great tower, wings either side, and three levels cut into the rock below (stores and treasury, the
   dungeon and the sewer, the ancient foundations with the hidden passage out to the cliff path).

   Levels (floor heights, G = ward ground):  L3 G-780 · L2 G-520 · L1 G-260 · L0 G · B1 G+260 · B2 G+490 · B3 G+720
   Columns: A west tower (stairwell) · B west wing · C great tower · D east wing · E east tower (stairwell) */
(function (global) {
	'use strict';
	const A = global.EmberfallArt;

	function build(W) {
		const kb = W.bldgs.find(b => b.room === 'castle');
		if (!kb) return;
		const X0 = kb.x;
		const KW = kb.w;
		const G = kb.y;
		const LV = { L3: G - 780, L2: G - 520, L1: G - 260, L0: G, B1: G + 260, B2: G + 490, B3: G + 720 };
		const TOPS = { A: G - 980, B: G - 560, C: G - 1160, D: G - 600, E: G - 940 };
		const COL = {
			A: [X0 + 30, X0 + 480], B: [X0 + 480, X0 + 1340], C: [X0 + 1340, X0 + 1880],
			D: [X0 + 1880, X0 + 2680], E: [X0 + 2680, X0 + KW - 30]
		};
		const room = {
			id: 'castle', label: 'EmberKeep', kind: 'keep', building: kb,
			view: { x: X0 - 20, y: G - 1200, w: KW + 40, h: 1200 + 760 + 40 },
			bounds: { x: X0 + 34, w: KW - 68 },
			plats: [], stairs: [], props: [], lights: [], exits: [], rooms: [], dummies: []
		};
		room.floorY = f => LV[f];
		const P = (x, y, w, h, o) => room.plats.push(Object.assign({ x, y, w, h }, o || {}));
		const ST = (x0, y0, x1, y1) => {
			room.stairs.push({ x: Math.min(x0, x1), w: Math.abs(x1 - x0), y0: x0 < x1 ? y0 : y1, y1: x0 < x1 ? y1 : y0 });
		};

		/* ---------------- rooms (name, column span, floor, ceiling, style) */
		const R = (name, x0, x1, floor, ceil, style, props, lights) => {
			const r = { name, x0, x1, floor, ceil, style: style || 'stone', props: props || [], lights: lights || [] };
			room.rooms.push(r);
			return r;
		};
		const a = COL.A, b = COL.B, c = COL.C, d = COL.D, e = COL.E;
		const bm = (b[0] + b[1]) / 2;
		const dm = d[0] + 500;
		// above ground
		R('West Observation Deck', a[0], a[1], LV.L3, TOPS.A, 'deck');
		R('War Room', a[0], a[1], LV.L2, LV.L3, 'stone');
		R('West Tower', a[0], a[1], LV.L1, LV.L2, 'stone');
		R('West Tower', a[0], a[1], LV.L0, LV.L1, 'stone');
		R('Council Chamber', b[0], bm, LV.L1, TOPS.B, 'panel');
		R('Royal Archives', bm, b[1], LV.L1, TOPS.B, 'panel');
		R('Kitchens', b[0], bm, LV.L0, LV.L1, 'plaster');
		R('Servants’ Quarters', bm, b[1], LV.L0, LV.L1, 'plaster');
		R('Royal Chambers', c[0], c[1], G - 1000, TOPS.C, 'royal');
		R('Throne Room', c[0], c[1], LV.L2, G - 1000, 'royal');
		R('Royal Mage Chamber', c[0], c[1], LV.L1, LV.L2, 'arcane');
		R('Grand Entrance Hall', c[0], c[1], LV.L0, LV.L1, 'hall');
		R('Great Dining Hall', d[0], dm, LV.L1, TOPS.D, 'hall');
		R('Administrative Offices', dm, d[1], LV.L1, TOPS.D, 'panel');
		R('Barracks', d[0], d[0] + 380, LV.L0, LV.L1, 'stone');
		R('Armory & Drill Hall', d[0] + 380, d[1], LV.L0, LV.L1, 'stone');
		R('East Observation Deck', e[0], e[1], LV.L3, TOPS.E, 'deck');
		R('Guest Wing', e[0], e[1], LV.L2, LV.L3, 'plaster');
		R('Library', e[0], e[1], LV.L1, LV.L2, 'panel');
		R('Infirmary', e[0], e[1], LV.L0, LV.L1, 'plaster');
		// below ground
		R('Cellar Stair', a[0], a[1], LV.B1, LV.L0, 'rock');
		R('Storage & Supply', b[0], b[1], LV.B1, LV.L0, 'rock');
		R('Royal Treasury', c[0], c[1], LV.B1, LV.L0, 'vault');
		R('Wine Cellar', d[0], e[1], LV.B1, LV.L0, 'rock');
		R('Dungeon Stair', a[0], a[1], LV.B2, LV.B1, 'rock');
		R('Dungeon', b[0], b[1], LV.B2, LV.B1, 'dungeon');
		R('Sewer Tunnels', c[0], d[1], LV.B2, LV.B1, 'sewer');
		R('Ancient Foundations', a[0], c[1], LV.B3, LV.B2, 'ancient');
		room.areaName = (p) => {
			const cx = p.x + p.w / 2;
			const fy = p.y + p.h - 4;
			for (const r of room.rooms) if (cx >= r.x0 && cx <= r.x1 && fy <= r.floor && fy >= r.ceil) return r.name;
			return null;
		};

		/* ---------------- structure: outer walls, floors with stair openings, column walls with doorways */
		const T = 26;   // floor thickness
		const DOOR_H = 170;
		// outer walls, full height
		P(X0 - 30, G - 1220, 60, 2000, { wall: true });
		P(X0 + KW - 30, G - 1220, 60, 2000, { wall: true });
		// bottom of the foundations and the rock under the wings
		P(X0 - 30, LV.B3, KW + 60, 80);
		P(c[1], LV.B2, KW - (c[1] - X0) + 30, 260);
		// stairwell runs (zigzag) in A and E, grand stair in C
		const runA = (lvLow, lvHigh, leftToRight) => {
			const x0 = leftToRight ? a[0] + 30 : a[1] - 30;
			const x1 = leftToRight ? x0 + 320 : x0 - 320;
			ST(x0, lvLow, x1, lvHigh);
			return [Math.min(x0, x1), Math.max(x0, x1)];
		};
		const runE = (lvLow, lvHigh, leftToRight) => {
			const x0 = leftToRight ? e[0] + 30 : e[1] - 30;
			const x1 = leftToRight ? x0 + 320 : x0 - 320;
			ST(x0, lvLow, x1, lvHigh);
			return [Math.min(x0, x1), Math.max(x0, x1)];
		};
		const runC = (lvLow, lvHigh, leftToRight) => {
			const x0 = leftToRight ? c[0] + 40 : c[1] - 40;
			const x1 = leftToRight ? x0 + 330 : x0 - 330;
			ST(x0, lvLow, x1, lvHigh);
			return [Math.min(x0, x1), Math.max(x0, x1)];
		};
		const gapsA = {};
		gapsA.B2 = runA(LV.B3, LV.B2, true);
		gapsA.B1 = runA(LV.B2, LV.B1, false);
		gapsA.L0 = runA(LV.B1, LV.L0, true);
		gapsA.L1 = runA(LV.L0, LV.L1, false);
		gapsA.L2 = runA(LV.L1, LV.L2, true);
		gapsA.L3 = runA(LV.L2, LV.L3, false);
		const gapsE = {};
		gapsE.L0 = runE(LV.B1, LV.L0, false);
		gapsE.L1 = runE(LV.L0, LV.L1, true);
		gapsE.L2 = runE(LV.L1, LV.L2, false);
		gapsE.L3 = runE(LV.L2, LV.L3, true);
		const gapsC = {};
		gapsC.L1 = runC(LV.L0, LV.L1, true);
		gapsC.L2 = runC(LV.L1, LV.L2, false);
		gapsC.L3 = runC(LV.L2, G - 1000, true);
		// floors per column (skip the stair openings: floor above a run is cut where the run rises into it)
		const floorSpan = (x0, x1, y, gap) => {
			if (!gap) { P(x0, y, x1 - x0, T, { thin: true }); return; }
			const g0 = gap[0] - 10;
			const g1 = gap[1] + 46;
			if (g0 > x0) P(x0, y, g0 - x0, T, { thin: true });
			if (g1 < x1) P(g1, y, x1 - g1, T, { thin: true });
		};
		// A: west tower
		floorSpan(a[0], a[1], LV.B2, gapsA.B2);
		floorSpan(a[0], a[1], LV.B1, gapsA.B1);
		floorSpan(a[0], a[1], LV.L0, gapsA.L0);
		floorSpan(a[0], a[1], LV.L1, gapsA.L1);
		floorSpan(a[0], a[1], LV.L2, gapsA.L2);
		floorSpan(a[0], a[1], LV.L3, gapsA.L3);
		P(a[0], TOPS.A - 30, a[1] - a[0], 30);
		// B: west wing
		floorSpan(b[0], b[1], LV.B2);
		floorSpan(b[0], b[1], LV.B1);
		floorSpan(b[0], b[1], LV.L0);
		floorSpan(b[0], b[1], LV.L1);
		P(b[0], TOPS.B - 30, b[1] - b[0], 30);
		// C: great tower
		floorSpan(c[0], c[1], LV.B2);
		floorSpan(c[0], c[1], LV.B1);
		floorSpan(c[0], c[1], LV.L0);
		floorSpan(c[0], c[1], LV.L1, gapsC.L1);
		floorSpan(c[0], c[1], LV.L2, gapsC.L2);
		floorSpan(c[0], c[1], G - 1000, gapsC.L3);
		P(c[0], TOPS.C - 30, c[1] - c[0], 30);
		// D: east wing
		floorSpan(d[0], d[1], LV.B1);
		floorSpan(d[0], d[1], LV.L0);
		floorSpan(d[0], d[1], LV.L1);
		P(d[0], TOPS.D - 30, d[1] - d[0], 30);
		// E: east tower
		floorSpan(e[0], e[1], LV.B1);
		floorSpan(e[0], e[1], LV.L0, gapsE.L0);
		floorSpan(e[0], e[1], LV.L1, gapsE.L1);
		floorSpan(e[0], e[1], LV.L2, gapsE.L2);
		floorSpan(e[0], e[1], LV.L3, gapsE.L3);
		P(e[0], TOPS.E - 30, e[1] - e[0], 30);
		// column walls: solid except a doorway at the floors where rooms connect
		const wallX = [a[1], b[1], c[1], d[1]];
		const tops = [Math.max(TOPS.A, TOPS.B), Math.max(TOPS.B, TOPS.C), Math.max(TOPS.C, TOPS.D), Math.max(TOPS.D, TOPS.E)];
		const doorsAt = [
			['B3', 'B1', 'L0', 'L1'],          // A|B
			['B3', 'B2', 'B1', 'L0', 'L1'],    // B|C
			['B2', 'B1', 'L0', 'L1'],          // C|D
			['B1', 'L0', 'L1']                 // D|E
		];
		const inner = [b[0] + (bm - b[0]), dm, d[0] + 380];
		for (let i = 0; i < wallX.length; i++) {
			const x = wallX[i] - 15;
			const top = i === 1 || i === 2 ? G - 1160 : tops[i] - 30;
			const bottom = LV.B3;
			const openings = doorsAt[i].map(k => LV[k]).sort((p, q) => p - q);
			let y = top;
			for (const f of openings) {
				const dTop = f - DOOR_H;
				if (dTop > y) P(x, y, 30, dTop - y, { wall: true });
				y = f;
			}
			if (bottom > y) P(x, y, 30, bottom - y, { wall: true });
		}
		// partition walls inside wings (with doorways)
		for (const [x, top, floor] of [[bm, TOPS.B, LV.L1], [bm, LV.L1, LV.L0], [dm, TOPS.D, LV.L1], [d[0] + 380, LV.L1, LV.L0]]) {
			P(x - 10, top, 20, floor - DOOR_H - top, { wall: true });
		}

		/* ---------------- doors out */
		const door = kb.door;
		room.exits.push({ x: door.x, w: door.w, y: G, outX: door.x + door.w / 2 - 19, outY: G });
		room.exits.push({ x: X0 + 30, w: 90, y: LV.B3, outX: X0 - 140, outY: LV.B3, label: 'the Hidden Passage' });
		room.door = { x: door.x, w: door.w };
		W.roomDoors = W.roomDoors || [];
		W.roomDoors.push({ x: X0 - 200, w: 150, y: LV.B3, room: 'castle', label: 'EmberKeep (Hidden Passage)' });

		/* ---------------- furnishing (dress props + lights) */
		const D = (name, x, floor, h, o) => room.props.push(Object.assign({ name, x, y: floor, h }, o || {}));
		const Lt = (x, y, r, i, col) => room.lights.push({ x, y, r, i, c: col });
		const torch = (x, floor) => { D('torch', x, floor - 120, 56, { hang: true }); Lt(x, floor - 150, 190, 0.62, [255, 150, 60]); };
		const chand = (x, ceil) => { D('chandelier', x, ceil + 96, 96, { hang: true }); Lt(x, ceil + 70, 330, 0.95, [255, 196, 90]); };
		// entrance hall
		D('column', c[0] + 90, LV.L0, 230);
		D('column', c[1] - 90, LV.L0, 230);
		D('knight', c[0] + 190, LV.L0, 150);
		D('knight', c[1] - 190, LV.L0, 150, { flip: true });
		chand((c[0] + c[1]) / 2, LV.L1);
		// throne room
		D('grandthrone', (c[0] + c[1]) / 2 + 80, LV.L2, 250);
		D('dais', (c[0] + c[1]) / 2 + 80, LV.L2, 60);
		D('drape', c[0] + 70, LV.L2 - 100, 260, { hang: false });
		D('drape', c[1] - 60, LV.L2 - 100, 260);
		D('column', c[0] + 160, LV.L2, 300);
		D('column', c[1] - 140, LV.L2, 300);
		chand((c[0] + c[1]) / 2 - 60, G - 1000);
		// royal chambers
		D('canopy', c[0] + 330, G - 1000, 150);
		D('curtain', c[0] + 120, G - 1000 - 60, 100);
		D('planter', c[1] - 70, G - 1000, 60);
		torch(c[1] - 60, G - 1000);
		// mage chamber
		D('magewell', (c[0] + c[1]) / 2 + 60, LV.L1, 160);
		D('runepillar', c[1] - 70, LV.L1, 210);
		D('shelfwall', c[0] + 380, LV.L1, 210);
		Lt((c[0] + c[1]) / 2 + 60, LV.L1 - 70, 260, 0.8, [130, 170, 255]);
		// west wing
		D('council', b[0] + 220, LV.L1, 130);
		D('curtain', b[0] + 220, LV.L1 - 170, 90);
		chand(b[0] + 220, TOPS.B);
		D('shelfwall', bm + 110, LV.L1, 220);
		D('shelfwall', bm + 330, LV.L1, 220);
		D('desk', b[1] - 90, LV.L1, 110);
		torch(bm + 220, LV.L1);
		D('hearth', b[0] + 120, LV.L0, 190);
		Lt(b[0] + 120, LV.L0 - 80, 300, 0.95, [255, 120, 40]);
		D('feast', b[0] + 300, LV.L0, 100);
		D('stores', bm - 70, LV.L0, 130);
		D('guestbed', bm + 120, LV.L0, 100);
		D('guestbed', bm + 330, LV.L0, 100);
		torch(bm + 230, LV.L0);
		// west tower rooms
		D('warmap', a[0] + 240, LV.L2, 130);
		torch(a[0] + 60, LV.L2);
		D('telescope', a[0] + 300, LV.L3, 150);
		D('drape', a[0] + 60, LV.L3 - 90, 220);
		torch(a[0] + 400, LV.L1);
		torch(a[0] + 60, LV.L0);
		// east wing
		D('feast', d[0] + 150, LV.L1, 110);
		D('feast', d[0] + 380, LV.L1, 110);
		D('hearth', dm - 60, LV.L1, 200);
		Lt(dm - 60, LV.L1 - 80, 300, 0.9, [255, 120, 40]);
		chand(d[0] + 260, TOPS.D);
		D('drape', d[0] + 30, LV.L1 - 120, 240);
		D('desk', dm + 120, LV.L1, 110);
		D('shelfwall', d[1] - 70, LV.L1, 220);
		torch(dm + 160, LV.L1);
		D('guestbed', d[0] + 90, LV.L0, 96);
		D('guestbed', d[0] + 280, LV.L0, 96);
		D('armory', d[1] - 110, LV.L0, 160);
		torch(d[0] + 190, LV.L0);
		torch(d[0] + 560, LV.L0);
		room.dummies.push({ x: d[0] + 470, y: LV.L0 - 48, building: 'castle' }, { x: d[0] + 600, y: LV.L0 - 48, building: 'castle' });
		// east tower
		D('infirm', e[0] + 200, LV.L0, 110);
		torch(e[1] - 60, LV.L0);
		D('shelfwall', e[0] + 120, LV.L1, 210);
		D('shelfwall', e[0] + 330, LV.L1, 210);
		torch(e[0] + 230, LV.L1);
		D('guestbed', e[0] + 230, LV.L2, 100);
		D('planter', e[1] - 60, LV.L2, 60);
		torch(e[0] + 60, LV.L2);
		D('telescope', e[0] + 150, LV.L3, 150);
		D('drape', e[1] - 70, LV.L3 - 90, 220);
		// below ground
		D('stores', b[0] + 140, LV.B1, 140);
		D('stores', b[0] + 420, LV.B1, 140);
		D('stores', b[1] - 160, LV.B1, 140);
		torch(b[0] + 290, LV.B1);
		torch(b[1] - 300, LV.B1);
		D('hoard', (c[0] + c[1]) / 2, LV.B1, 110);
		D('knight', c[0] + 70, LV.B1, 150);
		D('knight', c[1] - 70, LV.B1, 150, { flip: true });
		Lt((c[0] + c[1]) / 2, LV.B1 - 60, 220, 0.6, [255, 200, 90]);
		torch((c[0] + c[1]) / 2, LV.B1);
		D('stores', d[0] + 200, LV.B1, 130);
		D('stores', d[0] + 600, LV.B1, 130);
		torch(d[0] + 400, LV.B1);
		torch(e[0] + 200, LV.B1);
		D('prison', b[0] + 150, LV.B2, 150);
		D('prison', b[0] + 380, LV.B2, 150);
		D('prison', b[0] + 610, LV.B2, 150);
		torch(b[0] + 265, LV.B2);
		torch(b[1] - 80, LV.B2);
		D('sewerarch', c[0] + 200, LV.B2, 200);
		D('sewerarch', d[0] + 300, LV.B2, 200);
		Lt(c[0] + 200, LV.B2 - 60, 180, 0.4, [120, 255, 120]);
		torch(c[1] + 60, LV.B2);
		torch(a[0] + 380, LV.B2);
		D('runepillar', a[1] + 200, LV.B3, 180);
		D('runepillar', c[0] + 200, LV.B3, 180);
		D('column', b[0] + 500, LV.B3, 200);
		Lt(a[1] + 200, LV.B3 - 80, 220, 0.6, [70, 170, 255]);
		Lt(c[0] + 200, LV.B3 - 80, 220, 0.6, [70, 170, 255]);
		torch(a[0] + 140, LV.B3);

		room.LV = LV;
		room.COL = COL;
		room.TOPS = TOPS;
		room.drawCustom = (ctx, cam, vw, vh) => drawKeep(ctx, cam, room);
		W.rooms.castle = room;
		for (const dm2 of room.dummies) W.dummies.push(dm2);

		/* ---------------- castle residents */
		const talk = W.talk;
		const npc = W.npc;
		const N = (id, name, icon, sprite, x, minX, maxX, floor, lines, basic) => W.npcs.push(npc({
			id, name, icon, sprite, x, minX, maxX, room: 'castle', y: floor - 90, speed: 0.2,
			dialogue: { FIRST_MEETING: talk(name, icon, lines), BASIC_DIALOGUE: talk(name, icon, basic) }
		}));
		N('hall_guard_l', 'Gate Guard', '🛡️', 'generic-guard', c[0] + 110, c[0] + 60, c[0] + 230, LV.L0,
			['Welcome to EmberKeep. The grand stair is behind me. The throne is two floors up.', 'Name and business, then you may pass.'], ['Stairs on the left of the hall. Do not climb the banners.']);
		N('hall_guard_r', 'Hall Guard', '🛡️', 'generic-guard', c[1] - 110, c[1] - 230, c[1] - 60, LV.L0,
			['East door: barracks and the drill hall. West door: the kitchens.', 'Both towers have stairs. The west one goes all the way down to the foundations.'], ['Keep to the carpet if you are announced.']);
		N('steward', 'Steward Calden', '📜', 'scroll-vendor', (c[0] + c[1]) / 2, c[0] + 150, c[1] - 150, LV.L0,
			['The crown sits above us. The work sits everywhere else.', 'Throne room: great stair, two floors up. Royal chambers above that. Treasury: down the east tower and back west.'], ['If you are lost, the name of the room you are in is written on the board in the corner.']);
		N('cook', 'Cook Helda', '🍲', 'inn-keeper', b[0] + 300, b[0] + 200, bm - 60, LV.L0,
			['Kitchens. Servants next door. Stores are the floor under your feet, down the west tower.', 'The dining hall is in the east wing, upstairs, and it is always hungry.'], ['If you are not carrying a tray, you are in the way.']);
		N('servant', 'Maid Pella', '🧺', 'merchant', bm + 220, bm + 60, b[1] - 60, LV.L0,
			['Servants’ quarters. We sleep between the kitchens and the great hall.', 'Guest linens go up the east tower, two floors.'], ['Boots off the rug, if you remember. Most of you do not.']);
		N('quartermaster', 'Quartermaster Hob', '📦', 'black-smith', b[0] + 300, b[0] + 150, b[1] - 120, LV.B1,
			['Storage and supply. Everything that is not gold and not a secret.', 'The dungeon is the next floor down. Try not to take that stair by mistake.'], ['Crates are counted. So are visitors.']);
		N('treasurer', 'Treasurer Holm', '💰', 'artifact-dealer', (c[0] + c[1]) / 2 - 120, c[0] + 120, c[1] - 120, LV.B1,
			['Royal treasury. The door is open because the guards are not decorative.', 'Sewers run under us. The ancient stone is under the dungeon, at the bottom of the west tower.'], ['Count with your eyes. Hands stay at your sides.']);
		N('warden', 'Warden Brask', '⛓️', 'captain-guard', b[0] + 400, b[0] + 120, b[1] - 100, LV.B2,
			['Dungeon. The west tower stair is the way back to daylight.', 'At the very bottom there is a passage the old builders cut through the crag. It comes out on the cliff path below the barbican.'], ['Cells on the left. The ancient stone is one floor further down.']);
		N('historian', 'Historian Pell', '📚', 'clock-keeper', bm + 200, bm + 60, b[1] - 80, LV.L1,
			['Royal archives. The council chamber is through the west door.', 'The mage chamber is in the great tower, same floor, east of here. Knock. Then knock again.'], ['The index crystal remembers what the court would rather forget.']);
		N('councilor', 'Councilor Voss', '⚖️', 'eldery-sage', b[0] + 300, b[0] + 120, bm - 60, LV.L1,
			['Council chamber. We argue here so the throne room can pretend it is calm.', 'Archives are through the east door.'], ['A decision is just a quarrel that found a chair.']);
		N('court_mage', 'Court Mage Irel', '🔮', 'archmage', (c[0] + c[1]) / 2 - 90, c[0] + 380, c[1] - 120, LV.L1,
			['Mage chamber. The circles are awake.', 'Throne room above, archives west, dining hall east.'], ['Bring me a weave that misbehaves. Not a shopping list.']);
		N('war_scribe', 'Scribe Quill', '🗺️', 'scroll-vendor', a[0] + 260, a[0] + 120, a[1] - 60, LV.L2,
			['War room, top of the west tower. The table is the kingdom, badly scaled.', 'The observation deck is one more flight up.'], ['We only mark ground someone has walked.']);
		N('chamberlain', 'Chamberlain Osric', '👑', 'archmage', (c[0] + c[1]) / 2 + 60, c[0] + 380, c[1] - 80, G - 1000,
			['Royal chambers. The throne room is the tall hall under this floor.', 'The crown is not a person you summon by standing on the rug.'], ['Observation decks crown both towers, if you want weather instead of protocol.']);
		N('court_captain', 'Captain Venn', '⚔️', 'captain-guard', d[0] + 180, d[0] + 60, d[0] + 340, LV.L0,
			['Barracks. The drill hall is through the next door. The infirmary is at the foot of the east tower.', 'If you want to hit something, the dummies do not file complaints.'], ['The city watch is Rhea’s. This yard is mine.']);
		N('armorer', 'Keep Armorer', '🗡️', 'black-smith', d[1] - 180, d[0] + 640, d[1] - 60, LV.L0,
			['Racks for the garrison, not the market.', 'Drillmaster Kael is the one shouting at the dummies.'], ['If it leaves this room, the captain signed for it.']);
		N('drillmaster', 'Drillmaster Kael', '🎯', 'generic-guard', d[0] + 430, d[0] + 400, d[0] + 680, LV.L0,
			['Hit the dummy. Read what it tells you. Then hit it cleaner.'], ['The chapel is out in the ward if you need quiet. This is not quiet.']);
		N('healer', 'Sister Anwen', '🩹', 'eldery-sage', e[0] + 300, e[0] + 120, e[1] - 60, LV.L0,
			['Infirmary. The chapel will pray. I will stitch.', 'The library is up the stair, if you can read while bleeding.'], ['Sit if you are dizzy. The keep has enough stairs.']);
		N('librarian', 'Archivist Noll', '🔖', 'clock-keeper', e[0] + 230, e[0] + 80, e[1] - 80, LV.L1,
			['This is the royal library, first floor of the east tower.', 'The older shelves are the archives, west wing, same floor.'], ['Guest wing is one floor up. Do not reshelve on the way.']);
		N('diplomat', 'Envoy Maris', '🎩', 'artifact-dealer', e[0] + 320, e[0] + 120, e[1] - 60, LV.L2,
			['Guest wing. The observation deck is the roof of this tower.', 'I can see the whole ward from the stair, which is the point of a guest who is also a spy. I am not a spy.'], ['The dining hall is down and west. The food is better than the politics.']);
		N('advisor', 'Advisor Sera', '🕊️', 'mage-student', dm + 180, dm + 60, d[1] - 60, LV.L1,
			['Administrative offices. The throne is two floors up in the great tower, if you came for a speech.', 'I came for the letters.'], ['The war room is at the top of the west tower.']);
		// the chapel is its own building in the ward
		const ch = W.bldgs.find(q => q.room === 'chapel');
		const cx0 = ch ? ch.x : 0;
		W.npcs.push(npc({ id: 'priest', name: 'Chaplain Rue', icon: '🕯️', sprite: 'eldery-sage', x: cx0 + 330, minX: cx0 + 200, maxX: cx0 + 470, speed: 0.14, room: 'chapel', floor: 0,
			dialogue: { FIRST_MEETING: talk('Chaplain Rue', '🕯️', ['This chapel keeps the hours the court forgets.', 'The bell tower beside us rings for the ward. Climb it if you want to see the terrace below.']), BASIC_DIALOGUE: talk('Chaplain Rue', '🕯️', ['The glass is older than the sermons.']) } }));
	}

	/* ------------------------------------------------------------------ painting */
	const STYLE = {
		stone: { tex: 'stone', tint: 'rgba(24,20,16,0.5)', floor: 'stoneBig' },
		hall: { tex: 'stoneBig', tint: 'rgba(30,22,14,0.42)', floor: 'stoneBig', carpet: '#7a1c1c' },
		royal: { tex: 'stoneBig', tint: 'rgba(40,16,16,0.45)', floor: 'stoneBig', carpet: '#8a1a1a', drape: '#7a1414' },
		arcane: { tex: 'stone', tint: 'rgba(20,20,48,0.5)', floor: 'stoneBig', carpet: '#2a2a6a' },
		panel: { tex: 'wood', tint: 'rgba(40,22,10,0.45)', floor: 'wood', rot: 90 },
		plaster: { tex: 'plaster', tint: 'rgba(60,40,22,0.45)', floor: 'wood' },
		deck: { tex: 'stone', tint: 'rgba(30,24,18,0.25)', floor: 'stone', sky: true },
		rock: { tex: 'cliff', tint: 'rgba(16,12,10,0.55)', floor: 'stoneBig' },
		vault: { tex: 'stoneBig', tint: 'rgba(40,30,10,0.45)', floor: 'stoneBig', carpet: '#5a4a1a' },
		dungeon: { tex: 'stone', tint: 'rgba(10,10,12,0.62)', floor: 'stone' },
		sewer: { tex: 'stone', tint: 'rgba(8,20,10,0.6)', floor: 'stone', water: true },
		ancient: { tex: 'cliff', tint: 'rgba(10,16,30,0.55)', floor: 'stoneBig', glyphs: true }
	};
	function paintKeep(room) {
		const v = room.view;
		const cv = A.canvas(v.w, v.h);
		const g = cv.getContext('2d');
		const ox = v.x;
		const oy = v.y;
		// solid masonry everywhere first
		g.fillStyle = A.pattern(g, 'stoneBig', -ox % 400, -oy % 400);
		g.fillRect(0, 0, v.w, v.h);
		g.fillStyle = 'rgba(10,8,6,0.72)';
		g.fillRect(0, 0, v.w, v.h);
		for (const r of room.rooms) {
			const st = STYLE[r.style] || STYLE.stone;
			const x = r.x0 - ox;
			const y = r.ceil - oy;
			const w = r.x1 - r.x0;
			const h = r.floor - r.ceil;
			g.save();
			g.beginPath();
			g.rect(x, y, w, h);
			g.clip();
			if (st.sky) {
				const sg = g.createLinearGradient(0, y, 0, y + h);
				sg.addColorStop(0, '#6fa3d0');
				sg.addColorStop(1, '#d9e4ea');
				g.fillStyle = sg;
				g.fillRect(x, y, w, h);
				// battlements around the deck
				g.fillStyle = A.pattern(g, 'stone', 0, 0);
				g.fillRect(x, y + h - 70, w, 70);
				for (let k = x; k < x + w; k += 52) g.fillRect(k, y + h - 110, 30, 40);
			} else {
				g.fillStyle = A.pattern(g, st.tex, -ox % 400, -oy % 400, 1, 1, st.rot || 0);
				g.fillRect(x, y, w, h);
				g.fillStyle = st.tint;
				g.fillRect(x, y, w, h);
				if (st.drape) {
					for (let k = x + 40; k < x + w - 40; k += 120) {
						const dg = g.createLinearGradient(k, 0, k + 60, 0);
						dg.addColorStop(0, A.shade(st.drape, 1.2));
						dg.addColorStop(1, A.shade(st.drape, 0.6));
						g.fillStyle = dg;
						g.fillRect(k, y + 20, 60, h * 0.7);
						g.fillStyle = '#d7b450';
						g.fillRect(k, y + 20, 60, 6);
					}
				}
				if (st.glyphs) {
					g.strokeStyle = 'rgba(90,170,255,0.35)';
					g.lineWidth = 2;
					for (let k = x + 80; k < x + w; k += 210) {
						g.beginPath();
						g.arc(k, y + h * 0.45, 40, 0, Math.PI * 2);
						g.moveTo(k - 30, y + h * 0.45);
						g.lineTo(k + 30, y + h * 0.45);
						g.moveTo(k, y + h * 0.45 - 30);
						g.lineTo(k, y + h * 0.45 + 30);
						g.stroke();
					}
				}
				// tall windows on outside walls above ground
				if (r.floor <= room.LV.L0 && r.style !== 'rock') {
					const nw = Math.max(1, Math.floor(w / 260));
					for (let i = 0; i < nw; i++) {
						const wx = x + w * (i + 0.5) / nw - 26;
						const wh = Math.min(140, h - 110);
						if (wh < 50) continue;
						A.windowAt(g, wx, y + 40, 52, wh, { arch: true, sky: '#bcd6ea', frame: '#2a2420', sill: '#5a5248' });
						const sh = g.createLinearGradient(wx, y + 40, wx + 140, r.floor - oy);
						sh.addColorStop(0, 'rgba(255,240,200,0.16)');
						sh.addColorStop(1, 'rgba(255,240,200,0)');
						g.fillStyle = sh;
						g.beginPath();
						g.moveTo(wx, y + 40);
						g.lineTo(wx + 52, y + 40);
						g.lineTo(wx + 52 + 120, r.floor - oy);
						g.lineTo(wx + 20, r.floor - oy);
						g.fill();
					}
				}
				// ceiling shadow and floor contact shadow
				const cs = g.createLinearGradient(0, y, 0, y + 70);
				cs.addColorStop(0, 'rgba(0,0,0,0.55)');
				cs.addColorStop(1, 'rgba(0,0,0,0)');
				g.fillStyle = cs;
				g.fillRect(x, y, w, 70);
				if (st.carpet) {
					g.fillStyle = st.carpet;
					g.fillRect(x + 30, r.floor - oy - 8, w - 60, 8);
					g.fillStyle = '#d7b450';
					g.fillRect(x + 30, r.floor - oy - 8, w - 60, 2);
				}
				if (st.water) {
					g.fillStyle = 'rgba(60,120,50,0.6)';
					g.fillRect(x, r.floor - oy - 22, w, 22);
					g.fillStyle = 'rgba(200,255,180,0.25)';
					g.fillRect(x, r.floor - oy - 22, w, 2);
				}
			}
			// room-name board
			g.fillStyle = 'rgba(20,14,10,0.7)';
			g.font = 'bold 15px Georgia';
			const tw = g.measureText(r.name).width;
			g.fillRect(x + 14, y + 14, tw + 20, 26);
			g.fillStyle = '#e8d8a8';
			g.fillText(r.name, x + 24, y + 33);
			g.restore();
		}
		// floors (slabs with a lip) and stairs
		for (const p of room.plats) {
			if (p.wall) continue;
			g.fillStyle = A.pattern(g, 'stoneBig', -ox % 400, -oy % 400);
			g.fillRect(p.x - ox, p.y - oy, p.w, p.h);
			g.fillStyle = 'rgba(20,14,10,0.35)';
			g.fillRect(p.x - ox, p.y - oy, p.w, p.h);
			g.fillStyle = 'rgba(255,235,200,0.25)';
			g.fillRect(p.x - ox, p.y - oy, p.w, 3);
		}
		for (const p of room.plats) {
			if (!p.wall) continue;
			g.fillStyle = A.pattern(g, 'stone', -ox % 400, -oy % 400);
			g.fillRect(p.x - ox, p.y - oy, p.w, p.h);
			g.fillStyle = 'rgba(14,10,8,0.55)';
			g.fillRect(p.x - ox, p.y - oy, p.w, p.h);
			g.fillStyle = 'rgba(255,235,200,0.12)';
			g.fillRect(p.x - ox, p.y - oy, 3, p.h);
		}
		for (const s of room.stairs) global.EmberfallInteriors.drawStairs(g, s.x - ox, s.y0 - oy, s.w, s.y1 - s.y0, 'stone');
		// doors: the great door and the hidden passage
		A.door(g, room.door.x - ox, room.LV.L0 - 196 - oy, room.door.w, 194, { arch: true, open: true });
		A.door(g, room.COL.A[0] - 4 - ox, room.LV.B3 - 120 - oy, 80, 118, { arch: true, open: true });
		return { cv };
	}
	function drawKeep(ctx, cam, room) {
		const r = A.get('room:castle', () => paintKeep(room));
		if (r) ctx.drawImage(r.cv, Math.round(room.view.x - cam.x), Math.round(room.view.y - cam.y));
		global.EmberfallInteriors.drawProps(ctx, cam, room.props);
		// flickering torch glow
		const t = performance.now() / 1000;
		ctx.save();
		ctx.globalCompositeOperation = 'lighter';
		for (const L of room.lights) {
			const x = L.x - cam.x;
			const y = L.y - cam.y;
			if (x < -L.r || x > ctx.canvas.width + L.r || y < -L.r || y > ctx.canvas.height + L.r) continue;
			const f = 0.8 + Math.sin(t * 7 + L.x) * 0.08 + Math.sin(t * 17 + L.y) * 0.05;
			const gr = ctx.createRadialGradient(x, y, 4, x, y, L.r * 0.55);
			gr.addColorStop(0, 'rgba(' + L.c.join(',') + ',' + (0.16 * L.i * f) + ')');
			gr.addColorStop(1, 'rgba(' + L.c.join(',') + ',0)');
			ctx.fillStyle = gr;
			ctx.fillRect(x - L.r, y - L.r, L.r * 2, L.r * 2);
		}
		ctx.restore();
	}

	global.EmberfallKeep = { build };
})(typeof window !== 'undefined' ? window : globalThis);
