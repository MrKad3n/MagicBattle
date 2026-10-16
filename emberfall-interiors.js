/* EmberFall interiors: every enterable building gets a cutaway room set in the same place as its exterior —
   painted back walls, plank floors, beams, windows full of daylight, stairs between floors and furniture
   (the castle-dress props). The castle keep has its own multi-level layout (emberfall-keep.js). */
(function (global) {
	'use strict';
	const A = global.EmberfallArt;
	const E = global.EmberfallWorld;

	const FURNISH = {
		inn: [['hearth', 0.12, 150], ['feast', 0.45, 96], ['stores', 0.82, 130]],
		inn1: [['guestbed', 0.25, 110], ['guestbed', 0.72, 110]],
		inn2: [['bower', 0.5, 90]],
		farm: [['hearth', 0.16, 140], ['feast', 0.55, 90]],
		farm1: [['guestbed', 0.3, 100], ['stores', 0.78, 110]],
		barn: [['stores', 0.2, 140]],
		mill: [['stores', 0.2, 130]],
		mill1: [['stores', 0.7, 120]],
		shop: [['shelfwall', 0.2, 190], ['desk', 0.6, 100], ['stores', 0.86, 120]],
		shop1: [['stores', 0.3, 120], ['guestbed', 0.75, 100]],
		forge: [['hearth', 0.18, 170], ['armory', 0.62, 150], ['stores', 0.88, 120]],
		forge1: [['stores', 0.5, 120]],
		alchemy: [['shelfwall', 0.16, 190], ['magewell', 0.5, 140], ['desk', 0.84, 100]],
		alchemy1: [['shelfwall', 0.7, 180]],
		scrolls: [['shelfwall', 0.14, 200], ['desk', 0.5, 100], ['shelfwall', 0.86, 200]],
		scrolls1: [['runepillar', 0.3, 170], ['telescope', 0.7, 140]],
		gems: [['magewell', 0.25, 150], ['hoard', 0.6, 90], ['desk', 0.85, 100]],
		gems1: [['shelfwall', 0.5, 180]],
		fort: [['warmap', 0.3, 110], ['armory', 0.72, 150]],
		fort1: [['stores', 0.3, 120], ['guestbed', 0.75, 100]],
		cottage: [['hearth', 0.15, 140], ['feast', 0.6, 90]],
		cottage1: [['guestbed', 0.35, 100], ['planter', 0.75, 70]],
		chapel: [['pews', 0.3, 90], ['pews', 0.62, 90], ['dais', 0.88, 70]],
		maps: [['warmap', 0.3, 110], ['shelfwall', 0.75, 190]],
		maps1: [['telescope', 0.4, 150], ['desk', 0.75, 100]],
		desk: [['desk', 0.35, 100], ['stores', 0.78, 120]],
		desk1: [['shelfwall', 0.5, 180]],
		watch: [['armory', 0.3, 140], ['stores', 0.75, 110]],
		watch1: [['telescope', 0.5, 150]],
		lodge: [['hearth', 0.14, 150], ['armory', 0.5, 140], ['desk', 0.84, 100]],
		lodge1: [['guestbed', 0.3, 100], ['shelfwall', 0.78, 170]],
		storeroom: [['stores', 0.25, 130], ['hoard', 0.6, 70], ['stores', 0.85, 120]],
		hermit: [['hearth', 0.2, 130], ['desk', 0.62, 90], ['planter', 0.86, 70]],
		guard: [['armory', 0.22, 140], ['warmap', 0.6, 100], ['stores', 0.86, 110]],
		guard1: [['guestbed', 0.3, 100], ['stores', 0.75, 110]],
		works: [['stores', 0.18, 120], ['desk', 0.5, 90], ['armory', 0.82, 130]],
		works1: [['hoard', 0.35, 70], ['shelfwall', 0.75, 170]]
	};
	const LIGHT = {
		hearth: { r: 280, i: 0.95, c: [255, 120, 40], y: 0.55 },
		magewell: { r: 220, i: 0.7, c: [130, 170, 255], y: 0.4 },
		runepillar: { r: 160, i: 0.45, c: [70, 170, 255], y: 0.4 },
		feast: { r: 120, i: 0.3, c: [255, 180, 80], y: 0.3 },
		dais: { r: 150, i: 0.4, c: [255, 210, 130], y: 0.2 }
	};

	function houseGeom(b) {
		const s = b.spec;
		const floors = s.floors || 2;
		const fh = s.fh || 150;
		const plinth = s.plinth == null ? 30 : s.plinth;
		return { floors, fh, plinth, W: s.w, x: b.x, gy: b.y };
	}

	function buildHouseRoom(W, b) {
		const g = houseGeom(b);
		const kind = b.kind || 'cottage';
		const top = g.gy - g.plinth - g.floors * g.fh;
		const room = {
			id: b.room, label: b.label, kind, building: b,
			view: { x: g.x - 14, y: top - 26, w: g.W + 28, h: g.gy - top + 60 },
			bounds: { x: g.x + 14, w: g.W - 28 },
			plats: [], stairs: [], props: [], lights: [], exits: [], windows: []
		};
		const floorY = f => g.gy - f * g.fh - (f > 0 ? g.plinth : 0);
		room.floorY = floorY;
		// floors
		room.plats.push({ x: g.x - 20, y: g.gy, w: g.W + 40, h: 60 });
		for (let f = 1; f < g.floors; f++) {
			const y = floorY(f);
			const st = stairFor(g, f - 1, floorY);
			const gapL = Math.min(st.x0, st.x1) - 6;
			const gapR = Math.max(st.x0, st.x1) + 50;
			if (gapL > g.x) room.plats.push({ x: g.x, y, w: gapL - g.x, h: 24, thin: true });
			if (gapR < g.x + g.W) room.plats.push({ x: gapR, y, w: g.x + g.W - gapR, h: 24, thin: true });
			room.stairs.push({ x: Math.min(st.x0, st.x1), w: Math.abs(st.x1 - st.x0), y0: st.x0 < st.x1 ? floorY(f - 1) : y, y1: st.x0 < st.x1 ? y : floorY(f - 1), art: true });
		}
		// walls and ceiling
		room.plats.push({ x: g.x - 30, y: top - 40, w: 44, h: g.gy - top + 40, wall: true });
		room.plats.push({ x: g.x + g.W - 14, y: top - 40, w: 44, h: g.gy - top + 40, wall: true });
		room.plats.push({ x: g.x - 30, y: top - 60, w: g.W + 60, h: 40 });
		// exit door
		const s = b.spec;
		const dw = s.doorW || 58;
		const dx = s.door != null ? g.x + s.door * g.W - dw / 2 : g.x + g.W / 2 - dw / 2;
		room.exits.push({ x: dx, w: dw, y: g.gy, outX: dx + dw / 2 - 18, outY: g.gy });
		room.door = { x: dx, w: dw };
		// furniture
		for (let f = 0; f < g.floors; f++) {
			const list = FURNISH[kind + (f ? f : '')] || FURNISH[kind + (f ? '1' : '')] || [];
			for (const [name, fx, h] of list) {
				let x = g.x + g.W * fx;
				if (f === 0 && Math.abs(x - (dx + dw / 2)) < 90) x += x < dx ? -70 : 70;
				const fy = floorY(f);
				room.props.push({ name, x, y: fy, h });
				const L = LIGHT[name];
				if (L) room.lights.push({ x, y: fy - h * L.y, r: L.r, i: L.i, c: L.c });
			}
			// a hanging lamp in every room
			room.props.push({ name: 'lantern', x: g.x + g.W * (f % 2 ? 0.62 : 0.4), y: floorY(f) - g.fh + 26 + 70, h: 70, hang: true });
			room.lights.push({ x: g.x + g.W * (f % 2 ? 0.62 : 0.4), y: floorY(f) - g.fh + 80, r: 190, i: 0.6, c: [255, 196, 110] });
		}
		return room;
	}
	function stairFor(g, f, floorY) {
		const run = Math.min(g.W * 0.42, g.fh * 1.3);
		const left = f % 2 === 0;
		const x0 = left ? g.x + 40 : g.x + g.W - 40;
		const x1 = left ? x0 + run : x0 - run;
		return { x0, x1, y0: floorY(f), y1: floorY(f + 1) };
	}

	/* ------------------------------------------------------------------ painting */
	function wallTex(kind) {
		if (kind === 'barn' || kind === 'mill' || kind === 'forge' || kind === 'lodge' || kind === 'storeroom') return 'wood';
		if (kind === 'fort' || kind === 'chapel' || kind === 'watch' || kind === 'scrolls' || kind === 'gems' || kind === 'guard' || kind === 'hermit' || kind === 'works') return 'stone';
		return 'plaster';
	}
	function paintRoom(room) {
		const v = room.view;
		const cv = A.canvas(v.w, v.h);
		const g = cv.getContext('2d');
		const ox = v.x;
		const oy = v.y;
		const b = room.building;
		const geo = room.geo || houseGeom(b);
		const tex = wallTex(room.kind);
		// back wall
		g.fillStyle = A.pattern(g, tex, -ox % 300, -oy % 300, 1, 1, tex === 'wood' ? 90 : 0);
		g.fillRect(0, 0, v.w, v.h);
		g.fillStyle = tex === 'plaster' ? 'rgba(60,40,24,0.38)' : 'rgba(20,14,10,0.5)';
		g.fillRect(0, 0, v.w, v.h);
		// wainscot / lower panelling
		for (let f = 0; f < geo.floors; f++) {
			const fy = room.floorY(f) - oy;
			if (tex === 'plaster') {
				g.fillStyle = A.pattern(g, 'wood', 0, 0, 1, 1, 90);
				g.fillRect(0, fy - 56, v.w, 56);
				g.fillStyle = 'rgba(40,24,12,0.45)';
				g.fillRect(0, fy - 56, v.w, 56);
				g.fillStyle = 'rgba(255,220,170,0.18)';
				g.fillRect(0, fy - 58, v.w, 3);
			}
			// windows, matching the outside rows
			const n = Math.max(1, Math.floor(geo.W / 160));
			for (let i = 0; i < n; i++) {
				const wx = geo.x + geo.W * (i + 0.5) / n - 26 - ox;
				const wy = fy - geo.fh * 0.72;
				if (f === 0 && Math.abs(wx + ox + 26 - (room.door.x + room.door.w / 2)) < 80) continue;
				A.windowAt(g, wx, wy, 52, Math.min(70, geo.fh - 70), { sky: '#cfe3f0', frame: '#2e2116', sill: '#4a3626' });
				// daylight shaft
				const sg = g.createLinearGradient(wx, wy, wx + 120, fy);
				sg.addColorStop(0, 'rgba(255,240,200,0.18)');
				sg.addColorStop(1, 'rgba(255,240,200,0)');
				g.fillStyle = sg;
				g.beginPath();
				g.moveTo(wx, wy);
				g.lineTo(wx + 52, wy);
				g.lineTo(wx + 52 + 110, fy);
				g.lineTo(wx + 40, fy);
				g.fill();
			}
		}
		// floor slabs and ceiling beams
		for (let f = 0; f <= geo.floors; f++) {
			const fy = (f === geo.floors ? room.floorY(f - 1) - geo.fh : room.floorY(f)) - oy;
			g.fillStyle = A.pattern(g, 'wood', 0, fy);
			g.fillRect(0, fy, v.w, f === 0 ? 60 : 24);
			g.fillStyle = 'rgba(30,18,10,0.35)';
			g.fillRect(0, fy, v.w, f === 0 ? 60 : 24);
			g.fillStyle = 'rgba(255,220,170,0.25)';
			g.fillRect(0, fy, v.w, 3);
			if (f > 0) for (let x = 30; x < v.w; x += 140) A.beam(g, x, fy + 22, 18, 20, '#2b1d12');
		}
		// side walls (cutaway edges)
		for (const x of [0, v.w - 28]) {
			g.fillStyle = A.pattern(g, 'stone', 0, 0);
			g.fillRect(x, 0, 28, v.h);
			g.fillStyle = 'rgba(0,0,0,0.45)';
			g.fillRect(x, 0, 28, v.h);
		}
		// stairs
		for (const s of room.stairs) drawStairs(g, s.x - ox, s.y0 - oy, s.w, s.y1 - s.y0, 'wood');
		// the door from inside
		const dh = b.type === 'tower' ? 112 : (b.spec.doorH || 104);
		A.door(g, room.door.x - ox, geo.gy - dh - 2 - oy, room.door.w, dh, { arch: b.spec.archDoor !== false, open: true });
		// soft vignette
		const vg = g.createRadialGradient(v.w / 2, v.h * 0.6, v.h * 0.2, v.w / 2, v.h * 0.6, Math.max(v.w, v.h) * 0.75);
		vg.addColorStop(0, 'rgba(0,0,0,0)');
		vg.addColorStop(1, 'rgba(0,0,0,0.45)');
		g.fillStyle = vg;
		g.fillRect(0, 0, v.w, v.h);
		return { cv };
	}
	function drawStairs(g, x, y0, w, dy, mat) {
		/* A run of steps from (x, y0) to (x+w, y0+dy) with a stringer. */
		const n = Math.max(4, Math.round(Math.abs(dy) / 22));
		const sw = w / n;
		const sh = dy / n;
		for (let i = 0; i < n; i++) {
			const sx = x + i * sw;
			const sy = y0 + (i + 1) * sh;
			const top = Math.min(sy, y0 + i * sh);
			g.fillStyle = mat === 'stone' ? '#6d665c' : '#5a3c24';
			g.fillRect(sx, top, sw + 1, Math.abs(sh) + 8);
			g.fillStyle = 'rgba(255,225,180,0.22)';
			g.fillRect(sx, top, sw + 1, 3);
			g.fillStyle = 'rgba(0,0,0,0.3)';
			g.fillRect(sx + sw - 2, top, 2, Math.abs(sh) + 8);
		}
		// stringer under the steps
		g.strokeStyle = mat === 'stone' ? '#4d473f' : '#3a2616';
		g.lineWidth = 12;
		g.beginPath();
		g.moveTo(x, y0 + 14);
		g.lineTo(x + w, y0 + dy + 14);
		g.stroke();
	}

	function draw(ctx, cam, room, vw, vh) {
		if (room.drawCustom) {
			room.drawCustom(ctx, cam, vw, vh);
			return;
		}
		const r = A.get('room:' + room.id, () => paintRoom(room));
		const v = room.view;
		if (r) ctx.drawImage(r.cv, Math.round(v.x - cam.x), Math.round(v.y - cam.y));
		drawProps(ctx, cam, room.props);
	}
	function drawProps(ctx, cam, props) {
		if (!global.EmberfallProps) return;
		for (const p of props) {
			const s = global.EmberfallProps.size(p.name, p.h);
			const x = p.x - s.w / 2;
			const y = p.hang ? p.y - s.h : p.y - s.h + 4;
			global.EmberfallProps.drawOne(ctx, p.name, x, y, cam, s.w, s.h, p.flip);
		}
	}
	function drawFront() {}

	function buildTowerRoom(W, b) {
		/* A tall tower: ground room and a lookout floor reached by a stair. */
		const Wd = b.spec.w || 220;
		const H = b.spec.h || 600;
		const gy = b.y;
		const x = b.x;
		const fh = Math.min(260, H / 2.4);
		const room = {
			id: b.room, label: b.label, kind: b.kind || 'watch', building: b,
			view: { x: x - 14, y: gy - fh * 2 - 60, w: Wd + 28, h: fh * 2 + 120 },
			bounds: { x: x + 12, w: Wd - 24 },
			plats: [], stairs: [], props: [], lights: [], exits: [], windows: []
		};
		room.floorY = f => gy - f * fh;
		room.plats.push({ x: x - 20, y: gy, w: Wd + 40, h: 60 });
		const run = Wd - 80;
		room.stairs.push({ x: x + 30, w: run, y0: gy, y1: gy - fh, art: true });
		room.plats.push({ x: x + 30 + run + 14, y: gy - fh, w: Wd - run - 44, h: 24, thin: true });
		room.plats.push({ x: x - 30, y: gy - fh * 2 - 60, w: 44, h: fh * 2 + 60, wall: true });
		room.plats.push({ x: x + Wd - 14, y: gy - fh * 2 - 60, w: 44, h: fh * 2 + 60, wall: true });
		room.plats.push({ x: x - 30, y: gy - fh * 2 - 80, w: Wd + 60, h: 40 });
		const dx = x + Wd / 2 - 34;
		room.exits.push({ x: dx, w: 68, y: gy, outX: dx + 16, outY: gy });
		room.door = { x: dx, w: 68 };
		room.geo = { floors: 2, fh, plinth: 0, W: Wd, x, gy };
		const list = FURNISH[room.kind] || [];
		for (const [name, fx, h] of list) room.props.push({ name, x: x + Wd * fx, y: gy, h: Math.min(h, fh - 20) });
		for (const [name, fx, h] of FURNISH[room.kind + '1'] || []) room.props.push({ name, x: x + Wd * fx, y: gy - fh, h: Math.min(h, fh - 20) });
		room.props.push({ name: 'torch', x: x + Wd - 40, y: gy - 80, h: 60, hang: true });
		room.lights.push({ x: x + Wd - 40, y: gy - 110, r: 200, i: 0.7, c: [255, 150, 60] });
		room.lights.push({ x: x + Wd / 2, y: gy - fh - 80, r: 200, i: 0.5, c: [255, 196, 110] });
		return room;
	}

	function buildAll(W) {
		for (const b of W.bldgs) {
			if (!b.room || W.rooms[b.room]) continue;
			if (b.type === 'house') {
				W.rooms[b.room] = buildHouseRoom(W, b);
			} else if (b.type === 'tower') {
				W.rooms[b.room] = buildTowerRoom(W, b);
			} else if (b.roomBuilder) {
				W.rooms[b.room] = b.roomBuilder(W, b);
			}
		}
		if (global.EmberfallKeep) global.EmberfallKeep.build(W);
	}

	global.EmberfallInteriors = { buildAll, draw, drawFront, drawStairs, drawProps, buildHouseRoom };
})(typeof window !== 'undefined' ? window : globalThis);
