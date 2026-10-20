/* =====================================================================
   PvP ARENA — three duelling grounds, the full combat system online.
   ---------------------------------------------------------------------
   • Maps: Emberforge Caldera (fire), Frostveil Sanctum (ice), Tempest Spires (storm).
     Each has its own layout, painted look, weather and hazards. The host picks the map;
     both clients build it from the same id + seed, and every hazard runs on the shared
     match clock, so nothing about the arena itself needs to be sent.
   • Combat: rune spells (MagicEngine) and melee (MeleeMode) are both fully networked.
       – Rune casts are replayed on the other client as real spells owned by the remote
         caster (victim-authoritative: your own client decides what hits you).
       – Melee is attacker-authoritative: your client checks your blow against the
         opponent and sends the hit; their parry is checked on their side and answered.
       – The old phase spells still go through emitNetCast / spawnRemoteCast.
   • Net: compact 20 Hz state (+ an extra packet on any sharp change), events sent at
     once, clock sync by ping, the opponent predicted to "now" and eased onto each
     snapshot, defs cached by hash so a spell is sent in full only once.
   • Without a match id the arena runs as Practice (pick any map, spar with a rune mage).
     `&local=1` connects two tabs of the same browser (BroadcastChannel) for testing.
   ===================================================================== */
(function(root){
	'use strict';

	const WORLD_W = 6000, WORLD_H = 2400;      // the Grand Colosseum is the widest map; the others use the left 4400
	const BAL = { spell: 0.45, melee: 1.0 };      // PvP damage scaling (rune spells hit hard against creatures)
	const ROUNDS_TO_WIN = 2;

	/* ------------------------------------------------------------------ small utils */
	const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
	const lerp = (a, b, t) => a + (b - a) * t;
	function rng(seed){ let s = (seed >>> 0) || 1; return function(){ s = Math.imul(s ^ (s >>> 15), 2246822507); s = Math.imul(s ^ (s >>> 13), 3266489909); s ^= s >>> 16; return (s >>> 0) / 4294967296; }; }
	function hash32(str){ let h = 2166136261; for(let i = 0; i < str.length; i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
	function mkCanvas(w, h){ const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
	const IMG = {};
	function img(src){ if(!IMG[src]){ const i = new Image(); i.src = src; IMG[src] = i; } return IMG[src]; }
	const ok = (i) => !!(i && i.complete && i.naturalWidth > 0);
	const TEX = {
		basalt: 'images/pvp/basalt.png?v=1', ice: 'images/pvp/ice.png?v=1', cloud: 'images/pvp/cloudstone.png?v=1',
		rock: 'images/emberfall/rockface.png?v=1', rockCold: 'images/emberfall/rockface-cold.png?v=1', deep: 'images/emberfall/deeprock.png?v=1',
		brick: 'images/emberfall/tex/stone-brick.jpg?v=1', grass: 'images/emberfall/grass-meadow.png?v=1', grassCold: 'images/emberfall/grass-cold.png?v=1',
		moss: 'images/emberfall/moss.png?v=1',
		sandstone: 'images/pvp/sandstone.png?v=1', sand: 'images/pvp/arenasand.png?v=1', cavestone: 'images/pvp/cavestone.png?v=1'
	};
	const FLORA = (n) => 'images/emberfall/flora/' + n + '.png?v=1';
	function texReady(){ for(const k in TEX) if(!ok(img(TEX[k]))) return false; return true; }
	for(const k in TEX) img(TEX[k]);
	['pine-snow0', 'pine-snow1', 'pine-snow2', 'vine0', 'vine1', 'fern0', 'bush1', 'rock-cold0', 'boulder0', 'pine1', 'rock2'].forEach(n => img(FLORA(n)));
	const PAT = new Map();
	function pattern(g, key, scale){
		const id = key + '|' + (scale || 1);
		let src = PAT.get(id);
		if(!src){
			const i = img(TEX[key]); if(!ok(i)) return '#555';
			const sc = scale || 1;
			src = mkCanvas(i.naturalWidth * sc, i.naturalHeight * sc);
			const c = src.getContext('2d'); c.imageSmoothingQuality = 'high'; c.drawImage(i, 0, 0, src.width, src.height);
			PAT.set(id, src);
		}
		return g.createPattern(src, 'repeat');
	}

	/* ==================================================================
	   MAPS — geometry, hazards, look
	   solids collide on every side; ledges are one-way (jump up through, S to drop)
	   ================================================================== */
	const MAPS = [
		{
			id: 'ember', name: 'Emberforge Caldera', element: 'Fire', accent: '#ff7a2a', glow: '#ffb15a',
			blurb: 'A basalt duelling floor inside a living volcano. A lava moat splits the arena; magma vents throw fighters skyward.',
			cam: { x0: 140, x1: 4260, y0: 700, y1: 2400 },
			spawns: { left: { x: 1000, y: 2000 }, right: { x: 3400, y: 2000 } },
			solids: [
				{ x: 140, y: 0, w: 160, h: 2400, mat: 'basalt', wall: true },
				{ x: 4100, y: 0, w: 160, h: 2400, mat: 'basalt', wall: true },
				{ x: 300, y: 2000, w: 1580, h: 400, mat: 'basalt', ground: true },
				{ x: 2520, y: 2000, w: 1580, h: 400, mat: 'basalt', ground: true },
				{ x: 300, y: 1800, w: 440, h: 200, mat: 'basalt', step: true },
				{ x: 3660, y: 1800, w: 440, h: 200, mat: 'basalt', step: true },
				{ x: 2130, y: 1990, w: 140, h: 410, mat: 'basalt', column: true }
			],
			ledges: [
				{ x: 860, y: 1640, w: 280, mat: 'iron' }, { x: 3260, y: 1640, w: 280, mat: 'iron' },
				{ x: 1440, y: 1540, w: 240, mat: 'iron' }, { x: 2720, y: 1540, w: 240, mat: 'iron' },
				{ x: 2030, y: 1400, w: 340, mat: 'iron', chains: true },
				{ x: 1960, y: 1790, w: 160, mat: 'iron', chains: true }, { x: 2280, y: 1790, w: 160, mat: 'iron', chains: true }
			],
			lava: [ { x0: 1880, x1: 2520, y: 2080 } ],
			vents: [ { x: 1250 }, { x: 3150 } ],
			hazards: { vent: { period: 6.2, warn: 1.2, burst: 0.9, launch: -19, dmg: 4 }, lava: { dmg: 7, every: 0.45, bounce: -15 } },
			weather: 'embers'
		},
		{
			id: 'frost', name: 'Frostveil Sanctum', element: 'Ice', accent: '#7fd0ff', glow: '#c9f0ff',
			blurb: 'A temple sealed under a glacier. Polished ice sends you sliding, and icicles shake loose from the broken vault.',
			cam: { x0: 140, x1: 4260, y0: 820, y1: 2400 },
			spawns: { left: { x: 900, y: 2000 }, right: { x: 3500, y: 2000 } },
			solids: [
				{ x: 140, y: 0, w: 160, h: 2400, mat: 'frostbrick', wall: true },
				{ x: 4100, y: 0, w: 160, h: 2400, mat: 'frostbrick', wall: true },
				{ x: 300, y: 2000, w: 3800, h: 400, mat: 'frostbrick', ground: true },
				{ x: 1800, y: 1930, w: 800, h: 70, mat: 'ice', ice: true, dais: true },
				{ x: 1700, y: 1965, w: 100, h: 35, mat: 'frostbrick', step: true },
				{ x: 2600, y: 1965, w: 100, h: 35, mat: 'frostbrick', step: true },
				{ x: 1250, y: 1720, w: 130, h: 280, mat: 'frostbrick', pillar: true },
				{ x: 3020, y: 1720, w: 130, h: 280, mat: 'frostbrick', pillar: true }
			],
			ledges: [
				{ x: 560, y: 1690, w: 330, mat: 'ice', ice: true }, { x: 3510, y: 1690, w: 330, mat: 'ice', ice: true },
				{ x: 820, y: 1500, w: 240, mat: 'ice', ice: true }, { x: 3340, y: 1500, w: 240, mat: 'ice', ice: true },
				{ x: 1880, y: 1500, w: 640, mat: 'ice', ice: true, beam: true }
			],
			iceZones: [ { x0: 640, x1: 1120 }, { x0: 3280, x1: 3760 } ],      // polished patches of the floor
			icicles: { y: 1080, xs: [520, 760, 1000, 1240, 1480, 1720, 1960, 2200, 2440, 2680, 2920, 3160, 3400, 3640, 3880] },
			hazards: { icicle: { period: 3.6, warn: 1.1, count: 3, dmg: 14, slow: 70 } },
			weather: 'snow'
		},
		{
			id: 'storm', name: 'Tempest Spires', element: 'Storm', accent: '#b49cff', glow: '#e4dcff',
			blurb: 'Stone isles adrift above the clouds. Gusts sweep the gaps, lightning hunts the high ground — and the fall is long.',
			cam: { x0: 60, x1: 4340, y0: 760, y1: 2330 },
			spawns: { left: { x: 760, y: 1880 }, right: { x: 3640, y: 1880 } },
			solids: [
				{ x: -60, y: 0, w: 60, h: 2400, invisible: true },
				{ x: 4400, y: 0, w: 60, h: 2400, invisible: true },
				{ x: 1700, y: 1950, w: 1000, h: 120, mat: 'isle', isle: true, depth: 330 },
				{ x: 420, y: 1880, w: 820, h: 110, mat: 'isle', isle: true, depth: 280 },
				{ x: 3160, y: 1880, w: 820, h: 110, mat: 'isle', isle: true, depth: 280 }
			],
			ledges: [
				{ x: 1320, y: 1730, w: 210, mat: 'isle', float: true }, { x: 2870, y: 1730, w: 210, mat: 'isle', float: true },
				{ x: 2050, y: 1520, w: 300, mat: 'isle', float: true, spire: true },
				{ x: 760, y: 1580, w: 230, mat: 'isle', float: true }, { x: 3410, y: 1580, w: 230, mat: 'isle', float: true }
			],
			voidY: 2260,
			hazards: { gust: { period: 8, on: 2.6, push: 2.4 }, bolt: { period: 4.6, warn: 1.3, dmg: 16, stun: 12, halfW: 46 } },
			weather: 'storm'
		},
		{
			id: 'colosseum', name: 'The Grand Colosseum', element: 'Open Arena', accent: '#e8b860', glow: '#ffe2a0', width: 6000,
			blurb: 'The great amphitheatre: a wide sand floor under a roaring crowd. No hazards, no tricks — only you and your opponent.',
			cam: { x0: 140, x1: 5860, y0: 700, y1: 2400 },
			spawns: { left: { x: 2000, y: 2000 }, right: { x: 4000, y: 2000 } },
			solids: [
				{ x: 140, y: 0, w: 160, h: 2400, mat: 'sandstone', wall: true },
				{ x: 5700, y: 0, w: 160, h: 2400, mat: 'sandstone', wall: true },
				{ x: 300, y: 2000, w: 5400, h: 400, mat: 'arena', ground: true }
			],
			ledges: [],      // one big open floor: nothing to stand on but the sand
			hazards: {},
			weather: 'dust'
		},
		{
			id: 'cavern', name: 'Glowroot Cavern', element: 'Earth', accent: '#5fe0b0', glow: '#a8ffe0',
			blurb: 'A dark hollow under the mountains, lit by glowing fungus and crystal veins. Mushroom caps make a high road; loose rock falls from the roof.',
			cam: { x0: 140, x1: 4260, y0: 1000, y1: 2200 }, camBias: 0.72,
			spawns: { left: { x: 900, y: 2000 }, right: { x: 3500, y: 2000 } },
			solids: [
				{ x: 140, y: 0, w: 160, h: 2400, mat: 'cave', wall: true },
				{ x: 4100, y: 0, w: 160, h: 2400, mat: 'cave', wall: true },
				{ x: 300, y: 860, w: 960, h: 600, mat: 'cave', ceiling: true },
				{ x: 1260, y: 860, w: 840, h: 560, mat: 'cave', ceiling: true },
				{ x: 2100, y: 860, w: 200, h: 800, mat: 'cave', ceiling: true, column: true },
				{ x: 2300, y: 860, w: 840, h: 560, mat: 'cave', ceiling: true },
				{ x: 3140, y: 860, w: 960, h: 600, mat: 'cave', ceiling: true },
				{ x: 300, y: 2000, w: 1500, h: 400, mat: 'cave', ground: true },
				{ x: 2600, y: 2000, w: 1500, h: 400, mat: 'cave', ground: true },
				{ x: 1800, y: 2110, w: 800, h: 290, mat: 'cave', ground: true, basin: true },
				{ x: 1150, y: 1870, w: 80, h: 130, mat: 'cave', stalagmite: true },
				{ x: 3170, y: 1870, w: 80, h: 130, mat: 'cave', stalagmite: true }
			],
			ledges: [
				{ x: 540, y: 1770, w: 300, mat: 'shelf' }, { x: 3560, y: 1770, w: 300, mat: 'shelf' },
				{ x: 1360, y: 1650, w: 260, mat: 'shelf' }, { x: 2780, y: 1650, w: 260, mat: 'shelf' },
				{ x: 1880, y: 1800, w: 190, mat: 'mushroom', hue: 168 }, { x: 2330, y: 1800, w: 190, mat: 'mushroom', hue: 280 },
				{ x: 300, y: 1630, w: 190, mat: 'bracket', hue: 190 }, { x: 3910, y: 1630, w: 190, mat: 'bracket', hue: 300 }
			],
			pools: [ { x0: 1800, x1: 2600, y: 2060 } ],
			rocks: { xs: [520, 760, 1000, 1400, 1650, 1900, 2500, 2750, 3000, 3400, 3650, 3880] },
			hazards: { rock: { period: 7.5, warn: 1.4, count: 2, dmg: 12, stun: 10 } },
			dark: true,
			weather: 'spores'
		}
	];
	const MAP_BY_ID = {}; MAPS.forEach((m, i) => { m.index = i; MAP_BY_ID[m.id] = m; });

	/* ==================================================================
	   PAINTING — every static piece is painted once into its own canvas
	   ================================================================== */
	const P = { map: null, plats: [], pieces: [], layers: null, layerKey: '', parts: [], flash: 0, seed: 1, bolts: [] };

	function shadeRect(g, x, y, w, h, top, bottom){
		const gr = g.createLinearGradient(0, y, 0, y + h);
		gr.addColorStop(0, top); gr.addColorStop(1, bottom);
		g.fillStyle = gr; g.fillRect(x, y, w, h);
	}
	/* a solid block or a ledge, painted with its material; returns { cv, ox, oy } (draw at x - ox, y - oy) */
	function paintPiece(p, map){
		const isLedge = !!p.oneway;
		const r = rng((p.x * 7 + p.y * 13 + map.index * 101) | 0);
		const padX = 30, padTop = 40;
		const hang = p.isle ? (p.depth || 260) : p.ceiling ? 130 : p.mat === 'mushroom' ? 2000 - p.y + 20 : (isLedge ? (p.mat === 'isle' ? 120 : 60) : 30);
		const H = Math.min(p.h, p.ground ? 420 : p.h);      // (a cave roof is painted whole: the camera can't see above y 1000)
		const cv = mkCanvas(p.w + padX * 2, padTop + H + hang);
		const g = cv.getContext('2d');
		const X = padX, Y = padTop;
		g.save();
		if(p.mat === 'basalt'){
			g.fillStyle = pattern(g, 'basalt', 0.6); g.fillRect(X, Y, p.w, H);
			shadeRect(g, X, Y, p.w, H, 'rgba(255,120,40,0.10)', 'rgba(0,0,0,0.55)');
			if(p.wall){ const sg = g.createLinearGradient(X, 0, X + p.w, 0); const inner = p.x < (map.width || 4400) / 2; sg.addColorStop(inner ? 0 : 1, 'rgba(0,0,0,0.6)'); sg.addColorStop(inner ? 1 : 0, 'rgba(255,90,20,0.08)'); g.fillStyle = sg; g.fillRect(X, Y, p.w, H); }
			else {
				// rim: a glassy lit lip with molten seams
				g.fillStyle = '#4a3a36'; g.fillRect(X, Y, p.w, 6);
				g.fillStyle = 'rgba(255,220,180,0.25)'; g.fillRect(X, Y, p.w, 2);
				for(let k = 0; k < p.w / 70; k++){
					const cx = X + r() * p.w, len = 10 + r() * 40;
					g.strokeStyle = 'rgba(255,' + (90 + (r() * 80 | 0)) + ',20,' + (0.5 + r() * 0.4) + ')'; g.lineWidth = 1.5 + r();
					g.beginPath(); g.moveTo(cx, Y + 3); g.lineTo(cx + (r() - 0.5) * 16, Y + 3 + len * 0.5); g.lineTo(cx + (r() - 0.5) * 22, Y + 3 + len); g.stroke();
				}
			}
		} else if(p.mat === 'iron'){
			// a forged iron walkway: dark plate, rivets, hot-edged rim
			shadeRect(g, X, Y, p.w, 22, '#3b3433', '#151213');
			g.fillStyle = 'rgba(255,170,90,0.35)'; g.fillRect(X, Y, p.w, 2);
			g.fillStyle = '#0c0a0a'; g.fillRect(X, Y + 20, p.w, 3);
			for(let x = X + 10; x < X + p.w - 6; x += 26){ g.fillStyle = '#6a5a52'; g.beginPath(); g.arc(x, Y + 11, 2.4, 0, 7); g.fill(); g.fillStyle = '#ffb27a33'; g.fillRect(x - 1, Y + 9, 1, 1); }
			for(let k = 0; k < 3; k++){ const bx = X + p.w * (0.15 + k * 0.35); g.fillStyle = '#231d1c'; g.beginPath(); g.moveTo(bx - 10, Y + 22); g.lineTo(bx + 10, Y + 22); g.lineTo(bx, Y + 44); g.fill(); }
		} else if(p.mat === 'frostbrick'){
			g.fillStyle = pattern(g, 'brick', 0.42); g.fillRect(X, Y, p.w, H);
			g.globalCompositeOperation = 'multiply'; g.fillStyle = '#9fb8d8'; g.fillRect(X, Y, p.w, H); g.globalCompositeOperation = 'source-over';
			shadeRect(g, X, Y, p.w, H, 'rgba(200,230,255,0.22)', 'rgba(8,14,30,0.55)');
			if(p.pillar){
				// fluted column, broken top
				for(let k = 1; k < 5; k++){ g.fillStyle = 'rgba(10,20,40,0.25)'; g.fillRect(X + p.w * k / 5 - 2, Y + 14, 4, H - 14); g.fillStyle = 'rgba(220,240,255,0.15)'; g.fillRect(X + p.w * k / 5 + 2, Y + 14, 2, H - 14); }
				g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.moveTo(X - 2, Y - 2); for(let x = 0; x <= p.w; x += 10) g.lineTo(X + x, Y + 2 + r() * 12); g.lineTo(X + p.w + 2, Y - 2); g.fill(); g.globalCompositeOperation = 'source-over';
			}
			if(!p.wall){
				// snow cap
				g.fillStyle = '#eef6ff'; g.beginPath(); g.moveTo(X - 4, Y + 6);
				for(let x = 0; x <= p.w + 8; x += 8) g.lineTo(X - 4 + x, Y - 2 - Math.abs(Math.sin(x * 0.07 + r() * 0.3)) * 6 - r() * 2);
				g.lineTo(X + p.w + 4, Y + 8); g.closePath(); g.fill();
				g.fillStyle = 'rgba(150,190,230,0.5)'; g.fillRect(X - 2, Y + 5, p.w + 4, 3);
			}
		} else if(p.mat === 'ice'){
			const h = isLedge ? 26 : H;
			g.save(); g.globalAlpha = 0.95; g.fillStyle = pattern(g, 'ice', 0.6); g.fillRect(X, Y, p.w, h); g.restore();
			shadeRect(g, X, Y, p.w, h, 'rgba(255,255,255,0.35)', 'rgba(10,40,80,0.35)');
			g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillRect(X, Y, p.w, 2);
			g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(X + 6, Y + 5, p.w * 0.6, 2);
			// icicles under the slab
			for(let x = X + 6; x < X + p.w - 4; x += 9 + r() * 14){
				const len = 6 + r() * (isLedge ? 26 : 16);
				const gr = g.createLinearGradient(0, Y + h, 0, Y + h + len); gr.addColorStop(0, 'rgba(210,240,255,0.9)'); gr.addColorStop(1, 'rgba(210,240,255,0)');
				g.fillStyle = gr; g.beginPath(); g.moveTo(x - 3, Y + h); g.lineTo(x + 3, Y + h); g.lineTo(x + 0.5, Y + h + len); g.fill();
			}
		} else if(p.mat === 'sandstone'){
			// the coliseum's outer wall: big coursed blocks, shaded toward the arena
			g.fillStyle = pattern(g, 'sandstone', 0.5); g.fillRect(X, Y, p.w, H);
			const inner = p.x < (map.width || 4400) / 2;
			const sg = g.createLinearGradient(X, 0, X + p.w, 0); sg.addColorStop(inner ? 0 : 1, 'rgba(40,24,10,0.55)'); sg.addColorStop(inner ? 1 : 0, 'rgba(255,230,180,0.06)');
			g.fillStyle = sg; g.fillRect(X, Y, p.w, H);
			for(let y = 300; y < H; y += 300){ g.fillStyle = 'rgba(235,215,170,0.5)'; g.fillRect(X, Y + y, p.w, 10); g.fillStyle = 'rgba(40,24,10,0.4)'; g.fillRect(X, Y + y + 10, p.w, 6); }
		} else if(p.mat === 'arena'){
			// raked sand over the masonry of the arena floor (the hypogeum below)
			g.fillStyle = pattern(g, 'sandstone', 0.5); g.fillRect(X, Y, p.w, H);
			shadeRect(g, X, Y, p.w, H, 'rgba(60,36,16,0.25)', 'rgba(20,10,4,0.8)');
			g.fillStyle = pattern(g, 'sand', 0.6); g.fillRect(X, Y, p.w, 46);
			const sd = g.createLinearGradient(0, Y, 0, Y + 52); sd.addColorStop(0, 'rgba(255,240,200,0.25)'); sd.addColorStop(0.6, 'rgba(0,0,0,0)'); sd.addColorStop(1, 'rgba(40,24,10,0.55)');
			g.fillStyle = sd; g.fillRect(X, Y, p.w, 52);
			// a ragged sand edge spilling over the stone
			g.fillStyle = pattern(g, 'sand', 0.6);
			g.beginPath(); g.moveTo(X, Y + 44); for(let x = 0; x <= p.w; x += 12) g.lineTo(X + x, Y + 44 + Math.abs(Math.sin(x * 0.05 + r() * 2)) * 8); g.lineTo(X + p.w, Y + 40); g.closePath(); g.fill();
			// raked lines
			g.strokeStyle = 'rgba(120,86,48,0.18)'; g.lineWidth = 1;
			for(let k = 0; k < 4; k++){ g.beginPath(); g.moveTo(X, Y + 8 + k * 9); for(let x = 0; x <= p.w; x += 40) g.lineTo(X + x, Y + 8 + k * 9 + Math.sin(x * 0.01 + k) * 2); g.stroke(); }
		} else if(p.mat === 'marble'){
			// a marble balcony with a gilded edge, carried on two brackets
			const th = p.grand ? 34 : 26;
			shadeRect(g, X, Y, p.w, th, '#f1ece1', '#b9ad98');
			for(let k = 0; k < 6; k++){ g.strokeStyle = 'rgba(140,130,120,' + (0.15 + r() * 0.2) + ')'; g.lineWidth = 1; g.beginPath(); let vx = X + r() * p.w, vy = Y + 2; g.moveTo(vx, vy); for(let j = 0; j < 5; j++){ vx += (r() - 0.3) * 30; vy += r() * th * 0.3; g.lineTo(vx, Math.min(Y + th - 2, vy)); } g.stroke(); }
			g.fillStyle = '#c99a3a'; g.fillRect(X, Y + th - 5, p.w, 5); g.fillStyle = 'rgba(255,230,150,0.8)'; g.fillRect(X, Y + th - 5, p.w, 1.5);
			g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(X, Y, p.w, 2);
			for(const fx of [0.18, 0.82].concat(p.grand ? [0.5] : [])){ const bx = X + p.w * fx; g.fillStyle = '#a99c86'; g.beginPath(); g.moveTo(bx - 14, Y + th); g.lineTo(bx + 14, Y + th); g.lineTo(bx + 4, Y + th + 46); g.lineTo(bx - 4, Y + th + 46); g.closePath(); g.fill(); g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(bx - 12, Y + th, 4, 30); }
		} else if(p.mat === 'cave'){
			// cavern rock: the roof hangs ragged with stalactites; floors are uneven; spires rise from the floor
			g.save();
			g.beginPath();
			if(p.ceiling){
				g.moveTo(X - 4, Y);
				g.lineTo(X + p.w + 4, Y);
				for(let x = p.w + 4; x >= -4; x -= 16){
					let yy = Y + H + Math.sin(x * 0.03 + r() * 0.8) * 12 + (r() < 0.2 ? r() * 30 : 0);
					if(p.column) yy = Y + H - Math.pow(Math.abs(x - p.w / 2) / (p.w / 2), 2) * 120;
					g.lineTo(X + x, yy);
				}
			} else if(p.stalagmite){
				g.moveTo(X - 10, Y + H); g.lineTo(X + p.w * 0.3, Y + 30); g.lineTo(X + p.w * 0.5, Y - 6); g.lineTo(X + p.w * 0.72, Y + 40); g.lineTo(X + p.w + 10, Y + H);
			} else {
				g.moveTo(X - 4, Y + H);
				for(let x = -4; x <= p.w + 4; x += 18) g.lineTo(X + x, Y - 2 - (p.wall ? 0 : Math.abs(Math.sin(x * 0.021 + r())) * 7));
				g.lineTo(X + p.w + 4, Y + H);
			}
			g.closePath(); g.clip();
			g.fillStyle = pattern(g, 'cavestone', 0.8); g.fillRect(X - 20, Y - 20, p.w + 40, H + 200);
			if(p.ceiling) shadeRect(g, X - 20, Y, p.w + 40, H + 130, 'rgba(0,0,0,0.6)', 'rgba(40,60,70,0.15)');
			else shadeRect(g, X - 20, Y - 10, p.w + 40, H + 10, 'rgba(120,200,190,0.10)', 'rgba(0,0,0,0.75)');
			g.restore();
			if(p.ceiling){
				// stalactites
				for(let x = X + 10; x < X + p.w - 10; x += 22 + r() * 40){
					const base = Y + H + 4, len = 18 + r() * 60;
					g.fillStyle = '#151820'; g.beginPath(); g.moveTo(x - 8 - r() * 6, base - 6); g.lineTo(x + 8 + r() * 6, base - 6); g.lineTo(x + 1, base + len); g.closePath(); g.fill();
					g.fillStyle = 'rgba(120,220,200,0.12)'; g.fillRect(x - 3, base - 4, 2, len * 0.6);
				}
			} else if(!p.wall && !p.stalagmite){
				// a lip of moss and pale roots on the floor's edge
				g.fillStyle = 'rgba(60,110,80,0.75)'; for(let x = 0; x < p.w; x += 6){ const hh = 2 + Math.abs(Math.sin(x * 0.09 + r())) * 4; g.fillRect(X + x, Y - hh, 6, hh + 2); }
				g.fillStyle = 'rgba(160,255,220,0.25)'; g.fillRect(X, Y, p.w, 2);
			}
		} else if(p.mat === 'shelf'){
			// a rock shelf jutting from the dark, its underside tapering away
			g.save(); g.beginPath(); g.moveTo(X - 6, Y); g.lineTo(X + p.w + 6, Y);
			for(let x = p.w + 6; x >= -6; x -= 14){ const u = (x + 6) / (p.w + 12); g.lineTo(X + x, Y + 22 + Math.sin(u * Math.PI) * 46 + r() * 8); }
			g.closePath(); g.clip();
			g.fillStyle = pattern(g, 'cavestone', 0.8); g.fillRect(X - 10, Y - 4, p.w + 20, 90);
			shadeRect(g, X - 10, Y, p.w + 20, 90, 'rgba(140,220,200,0.12)', 'rgba(0,0,0,0.8)');
			g.restore();
			g.fillStyle = 'rgba(70,130,95,0.85)'; for(let x = 0; x < p.w; x += 5){ const hh = 1 + Math.abs(Math.sin(x * 0.13 + r())) * 4; g.fillRect(X + x, Y - hh, 5, hh + 1); }
		} else if(p.mat === 'mushroom'){
			// a giant glowing mushroom: the cap is the ledge, the stem runs down to the cave floor
			const hue = p.hue || 170, cx = X + p.w / 2, stemBot = Y + (2000 - p.y) + 6;
			const sg = g.createLinearGradient(cx - 22, 0, cx + 22, 0); sg.addColorStop(0, 'hsl(' + hue + ',25%,22%)'); sg.addColorStop(0.45, 'hsl(' + hue + ',30%,62%)'); sg.addColorStop(1, 'hsl(' + hue + ',25%,18%)');
			g.fillStyle = sg; g.beginPath(); g.moveTo(cx - 16, Y + 18); g.quadraticCurveTo(cx - 26, (Y + stemBot) / 2, cx - 30, stemBot); g.lineTo(cx + 30, stemBot); g.quadraticCurveTo(cx + 26, (Y + stemBot) / 2, cx + 16, Y + 18); g.fill();
			// gills under the cap
			g.fillStyle = 'hsla(' + hue + ',60%,75%,0.55)'; g.beginPath(); g.ellipse(cx, Y + 18, p.w * 0.5, 10, 0, 0, Math.PI); g.fill();
			const cg = g.createLinearGradient(0, Y - 30, 0, Y + 18); cg.addColorStop(0, 'hsl(' + hue + ',75%,70%)'); cg.addColorStop(1, 'hsl(' + hue + ',60%,38%)');
			g.fillStyle = cg; g.beginPath(); g.moveTo(X - 8, Y + 16); g.quadraticCurveTo(X + p.w * 0.08, Y - 34, cx, Y - 38); g.quadraticCurveTo(X + p.w * 0.92, Y - 34, X + p.w + 8, Y + 16); g.closePath(); g.fill();
			for(let k = 0; k < 7; k++){ g.fillStyle = 'hsla(' + hue + ',90%,92%,0.85)'; g.beginPath(); g.arc(X + 16 + r() * (p.w - 32), Y - 4 - r() * 24, 3 + r() * 5, 0, 7); g.fill(); }
			g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(X + p.w * 0.32, Y - 22, p.w * 0.16, 5, -0.2, 0, 7); g.fill();
		} else if(p.mat === 'bracket'){
			// a shelf fungus growing out of the cave wall: layered half-discs, glowing rims
			const hue = p.hue || 190, wallLeft = p.x < 2000;
			for(let k = 2; k >= 0; k--){
				const ww = p.w * (1 - k * 0.22), x0 = wallLeft ? X : X + p.w - ww, yy = Y + k * 16;
				const cg = g.createLinearGradient(0, yy - 14, 0, yy + 18); cg.addColorStop(0, 'hsl(' + hue + ',55%,' + (60 - k * 10) + '%)'); cg.addColorStop(1, 'hsl(' + hue + ',45%,' + (25 - k * 4) + '%)');
				g.fillStyle = cg; g.beginPath();
				if(wallLeft){ g.moveTo(x0, yy - 10); g.quadraticCurveTo(x0 + ww * 0.9, yy - 18, x0 + ww, yy + 6); g.quadraticCurveTo(x0 + ww * 0.6, yy + 20, x0, yy + 16); }
				else { g.moveTo(x0 + ww, yy - 10); g.quadraticCurveTo(x0 + ww * 0.1, yy - 18, x0, yy + 6); g.quadraticCurveTo(x0 + ww * 0.4, yy + 20, x0 + ww, yy + 16); }
				g.closePath(); g.fill();
				g.strokeStyle = 'hsla(' + hue + ',95%,80%,0.8)'; g.lineWidth = 2; g.stroke();
			}
			for(let k = 0; k < 6; k++){ g.fillStyle = 'hsla(' + hue + ',90%,90%,0.8)'; g.beginPath(); g.arc(X + 12 + r() * (p.w - 24), Y - 4 + r() * 8, 2 + r() * 3, 0, 7); g.fill(); }
		} else if(p.mat === 'isle'){
			// a floating island: grassy cap, layered rock tapering to a point, roots and vines hanging
			const depth = p.isle ? (p.depth || 260) : 90 + p.w * 0.25;
			const top = Y + 8;
			g.beginPath();
			g.moveTo(X - 4, top);
			const n = 14;
			for(let i = 0; i <= n; i++){
				const u = i / n;
				const bulge = Math.sin(u * Math.PI);
				const yy = top + depth * Math.pow(bulge, 0.85) * (0.75 + 0.25 * Math.sin(u * 9 + r() * 2));
				g.lineTo(X - 4 + (p.w + 8) * u, yy);
			}
			g.lineTo(X + p.w + 4, top); g.closePath();
			g.save(); g.clip();
			g.fillStyle = pattern(g, 'rockCold', 1.0); g.fillRect(X - 10, top, p.w + 20, depth + 10);
			const sg = g.createLinearGradient(0, top, 0, top + depth);
			sg.addColorStop(0, 'rgba(120,110,160,0.05)'); sg.addColorStop(0.5, 'rgba(40,30,70,0.35)'); sg.addColorStop(1, 'rgba(20,14,40,0.8)');
			g.fillStyle = sg; g.fillRect(X - 10, top, p.w + 20, depth + 10);
			const hg = g.createLinearGradient(X, 0, X + p.w, 0);
			hg.addColorStop(0, 'rgba(255,255,255,0.08)'); hg.addColorStop(0.5, 'rgba(0,0,0,0)'); hg.addColorStop(1, 'rgba(10,0,30,0.3)');
			g.fillStyle = hg; g.fillRect(X - 10, top, p.w + 20, depth + 10);
			g.restore();
			// soil band and turf
			g.fillStyle = '#3a2c22'; g.fillRect(X - 2, top - 2, p.w + 4, 12);
			const gi = img(TEX.grass);
			if(ok(gi)){
				// only the blades above the ground line: the strip's root fringe would hang like fur under a floating isle
				g.save(); g.beginPath(); g.rect(X - 10, 0, p.w + 20, top + 7); g.clip();
				const sh = gi.naturalHeight, base = sh * 0.62; for(let x = 0; x < p.w + 8; x += 256){ const ww = Math.min(256, p.w + 8 - x); g.drawImage(gi, (x * 1.7 | 0) % 700, 0, ww, sh, X - 4 + x, top + 4 - base, ww, sh); }
				g.restore();
			}
			// roots and vines
			for(let k = 0; k < p.w / 60; k++){
				const vx = X + 10 + r() * (p.w - 20), vu = (vx - X) / p.w, vy = top + depth * Math.pow(Math.sin(vu * Math.PI), 0.85) * 0.7;
				g.strokeStyle = 'rgba(52,40,30,0.85)'; g.lineWidth = 1.2 + r() * 1.6;
				g.beginPath(); g.moveTo(vx, vy); let cx = vx, cy = vy; for(let s = 0; s < 5; s++){ cx += (r() - 0.5) * 10; cy += 8 + r() * 10; g.lineTo(cx, cy); } g.stroke();
			}
			const vi = img(FLORA(r() < 0.5 ? 'vine0' : 'vine1'));
			if(ok(vi)) for(let k = 0; k < Math.max(1, p.w / 260); k++){ const hh = 70 + r() * 90, ww = hh * vi.naturalWidth / vi.naturalHeight, vx = X + 20 + r() * (p.w - 40); g.drawImage(vi, vx - ww / 2, top + 4, ww, hh); }
		}
		g.restore();
		return { cv, ox: padX, oy: padTop, p };
	}

	/* ---------- the backdrop: screen-anchored sky + parallax layers (painted once per screen height) ---------- */
	const PERIOD = 2400;      // parallax strips repeat every 2400 px
	function ridge(g, y0, amp, cycles, seed, fill, w){
		const r = rng(seed);
		const ph = [r() * 6.28, r() * 6.28, r() * 6.28];
		g.beginPath(); g.moveTo(0, g.canvas.height);
		for(let x = 0; x <= w; x += 6){
			const u = x / w * Math.PI * 2;
			const y = y0 - amp * (0.55 * Math.sin(u * cycles[0] + ph[0]) + 0.3 * Math.sin(u * cycles[1] + ph[1]) + 0.15 * Math.sin(u * cycles[2] + ph[2]));
			g.lineTo(x, y);
		}
		g.lineTo(w, g.canvas.height); g.closePath(); g.fillStyle = fill; g.fill();
	}
	function paintLayers(map, vw, vh){
		const L = { sky: mkCanvas(vw, vh), far: mkCanvas(PERIOD, vh), mid: mkCanvas(PERIOD, vh) };
		const s = L.sky.getContext('2d'), f = L.far.getContext('2d'), m = L.mid.getContext('2d');
		const r = rng(map.index * 977 + 3);
		if(map.id === 'ember'){
			shadeRect(s, 0, 0, vw, vh, '#12070a', '#3a120a');
			const gl = s.createRadialGradient(vw * 0.5, vh * 1.05, 20, vw * 0.5, vh * 1.05, vh * 0.95);
			gl.addColorStop(0, 'rgba(255,110,30,0.55)'); gl.addColorStop(1, 'rgba(255,60,10,0)');
			s.fillStyle = gl; s.fillRect(0, 0, vw, vh);
			// far: a cavern of cones and distant lava rivers
			ridge(f, vh * 0.62, vh * 0.16, [3, 7, 13], 11, '#1d0d0c', PERIOD);
			for(let k = 0; k < 7; k++){
				const x = (k + 0.5) / 7 * PERIOD + (r() - 0.5) * 120, top = vh * (0.45 + r() * 0.1);
				f.strokeStyle = 'rgba(255,90,20,0.55)'; f.lineWidth = 2 + r() * 2; f.shadowColor = '#ff6a1a'; f.shadowBlur = 12;
				f.beginPath(); f.moveTo(x, top); let cx = x, cy = top; while(cy < vh){ cx += (r() - 0.5) * 18; cy += 14 + r() * 10; f.lineTo(cx, cy); } f.stroke(); f.shadowBlur = 0;
			}
			// stalactites hanging from the cave roof
			f.fillStyle = '#0d0607';
			f.beginPath(); f.moveTo(0, 0);
			for(let x = 0; x <= PERIOD; x += 20){ const u = x / PERIOD * Math.PI * 2; const len = 30 + 26 * Math.sin(u * 5 + 1) + 18 * Math.sin(u * 17) + ((x / 20) % 3 === 0 ? 40 + r() * 70 : 0); f.lineTo(x, len); }
			f.lineTo(PERIOD, 0); f.fill();
			// mid: basalt bluffs
			ridge(m, vh * 0.8, vh * 0.12, [4, 9, 19], 12, '#140808', PERIOD);
			for(let k = 0; k < 40; k++){ const x = r() * PERIOD, w = 6 + r() * 14, top = vh * 0.66 + r() * vh * 0.1; m.fillStyle = 'rgba(40,20,18,0.8)'; m.fillRect(x, top, w, vh - top); }
		} else if(map.id === 'frost'){
			shadeRect(s, 0, 0, vw, vh, '#050b1e', '#1a3a5c');
			for(let k = 0; k < 160; k++){ s.fillStyle = 'rgba(255,255,255,' + (0.3 + r() * 0.7) + ')'; s.fillRect(r() * vw, r() * vh * 0.6, r() < 0.1 ? 2 : 1, r() < 0.1 ? 2 : 1); }
			ridge(f, vh * 0.66, vh * 0.2, [2, 5, 11], 21, '#a9c6e0', PERIOD);
			ridge(f, vh * 0.7, vh * 0.12, [3, 8, 15], 22, '#7c9cbc', PERIOD);
			// snow on the peaks: lighten the upper ridge
			f.globalCompositeOperation = 'source-atop'; shadeRect(f, 0, vh * 0.4, PERIOD, vh * 0.3, 'rgba(255,255,255,0.45)', 'rgba(255,255,255,0)'); f.globalCompositeOperation = 'source-over';
			// mid: ruined temple arches in the glacier
			ridge(m, vh * 0.86, vh * 0.05, [5, 11, 23], 23, '#2c4664', PERIOD);
			for(let k = 0; k < 9; k++){
				const x = (k + 0.3) / 9 * PERIOD, w = 150 + r() * 80, h = vh * (0.28 + r() * 0.14), base = vh * 0.88;
				m.fillStyle = '#34506f';
				m.fillRect(x, base - h, 26, h); m.fillRect(x + w - 26, base - h, 26, h);
				m.beginPath(); m.moveTo(x, base - h + 6); m.quadraticCurveTo(x + w / 2, base - h - w * 0.45, x + w, base - h + 6); m.lineTo(x + w, base - h + 30); m.quadraticCurveTo(x + w / 2, base - h - w * 0.3, x, base - h + 30); m.fill();
				m.fillStyle = 'rgba(220,240,255,0.25)'; m.fillRect(x, base - h, 6, h);
			}
		} else if(map.id === 'colosseum'){
			// a bright afternoon over the great bowl: sky, the far side of the stands, the velarium awnings
			shadeRect(s, 0, 0, vw, vh, '#3f86c9', '#f3dcae');
			const sun = s.createRadialGradient(vw * 0.78, vh * 0.12, 6, vw * 0.78, vh * 0.12, vh * 0.8); sun.addColorStop(0, 'rgba(255,248,220,0.95)'); sun.addColorStop(0.08, 'rgba(255,236,190,0.55)'); sun.addColorStop(1, 'rgba(255,220,160,0)');
			s.fillStyle = sun; s.fillRect(0, 0, vw, vh);
			for(let k = 0; k < 7; k++){ const cx = r() * vw, cy = vh * (0.05 + r() * 0.2); for(let j = 0; j < 5; j++){ const gr = s.createRadialGradient(cx + j * 26, cy + (j % 2) * 8, 2, cx + j * 26, cy + (j % 2) * 8, 40 + r() * 20); gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); s.fillStyle = gr; s.fillRect(cx + j * 26 - 70, cy - 70, 140, 140); } }
			// far: the opposite tiers — three storeys of arcades, the crowd in the openings, masts and awnings on top
			const tierTop = vh * 0.2, tierBot = vh * 0.62;
			shadeRect(f, 0, tierTop, PERIOD, tierBot - tierTop + 4, '#c9a878', '#9c7a52');
			const storeys = 3, sh = (tierBot - tierTop) / storeys;
			for(let st = 0; st < storeys; st++){
				const y0 = tierTop + st * sh, aw = 46 - st * 4, gap = 14;
				for(let x = 6; x < PERIOD; x += aw + gap){
					f.fillStyle = 'rgba(40,24,12,0.7)';
					f.beginPath(); f.moveTo(x, y0 + sh - 4); f.lineTo(x, y0 + sh * 0.42); f.quadraticCurveTo(x + aw / 2, y0 + sh * 0.08, x + aw, y0 + sh * 0.42); f.lineTo(x + aw, y0 + sh - 4); f.fill();
					// spectators in the arch
					for(let k = 0; k < 4; k++){ const px = x + 6 + r() * (aw - 12), py = y0 + sh * (0.55 + r() * 0.3); f.fillStyle = ['#7a2a22', '#2a4a7a', '#c9b48a', '#3a6a3a', '#8a6a2a', '#e8e0d0'][(r() * 6) | 0]; f.fillRect(px - 3, py, 6, 9); f.fillStyle = '#d9a77a'; f.beginPath(); f.arc(px, py - 2, 3, 0, 7); f.fill(); }
				}
				f.fillStyle = 'rgba(255,240,210,0.45)'; f.fillRect(0, y0 + sh - 4, PERIOD, 3);
				f.fillStyle = 'rgba(60,36,18,0.35)'; f.fillRect(0, y0 + sh - 1, PERIOD, 3);
			}
			// the attic and its masts with the striped velarium
			f.fillStyle = '#b8966a'; f.fillRect(0, tierTop - vh * 0.05, PERIOD, vh * 0.05);
			for(let x = 40; x < PERIOD; x += 160){ f.fillStyle = '#5a4430'; f.fillRect(x, tierTop - vh * 0.14, 4, vh * 0.1); }
			for(let x = 40; x < PERIOD; x += 160){
				f.fillStyle = ((x / 160) | 0) % 2 ? 'rgba(190,60,40,0.85)' : 'rgba(240,226,196,0.85)';
				f.beginPath(); f.moveTo(x + 2, tierTop - vh * 0.135); f.lineTo(x + 162, tierTop - vh * 0.135); f.lineTo(x + 182, tierTop - vh * 0.06); f.quadraticCurveTo(x + 90, tierTop - vh * 0.03, x + 20, tierTop - vh * 0.06); f.closePath(); f.fill();
			}
			// mid: the podium wall around the sand, with gates and banners
			const pTop = vh * 0.66;
			m.fillStyle = '#a88658'; m.fillRect(0, pTop, PERIOD, vh - pTop);
			shadeRect(m, 0, pTop, PERIOD, vh - pTop, 'rgba(255,235,200,0.15)', 'rgba(60,36,16,0.5)');
			m.fillStyle = '#efe6d2'; m.fillRect(0, pTop - 6, PERIOD, 8);
			for(let x = 0; x < PERIOD; x += 70){ m.fillStyle = 'rgba(60,36,18,0.25)'; m.fillRect(x, pTop + 2, 2, vh - pTop); }
			for(let x = 200; x < PERIOD; x += 600){
				m.fillStyle = '#2a1a10'; m.beginPath(); m.moveTo(x, vh); m.lineTo(x, pTop + 70); m.quadraticCurveTo(x + 50, pTop + 30, x + 100, pTop + 70); m.lineTo(x + 100, vh); m.fill();
				m.strokeStyle = 'rgba(30,20,14,0.9)'; m.lineWidth = 3; for(let k = 10; k < 100; k += 14){ m.beginPath(); m.moveTo(x + k, pTop + 60); m.lineTo(x + k, vh); m.stroke(); }
				for(const bx of [x - 120, x + 220]){ m.fillStyle = ['#9a2a22', '#24508a', '#c9962a'][((x / 600) | 0) % 3]; m.beginPath(); m.moveTo(bx, pTop + 8); m.lineTo(bx + 40, pTop + 8); m.lineTo(bx + 40, pTop + 90); m.lineTo(bx + 20, pTop + 76); m.lineTo(bx, pTop + 90); m.closePath(); m.fill(); m.fillStyle = 'rgba(255,220,140,0.8)'; m.beginPath(); m.arc(bx + 20, pTop + 36, 8, 0, 7); m.fill(); }
			}
		} else if(map.id === 'cavern'){
			// deep dark: a few glowing veins and distant fungus lights in the far rock
			shadeRect(s, 0, 0, vw, vh, '#05070b', '#0c1418');
			ridge(f, vh * 0.5, vh * 0.25, [3, 7, 15], 41, '#0b1014', PERIOD);
			for(let k = 0; k < 60; k++){ const x = r() * PERIOD, y = vh * (0.4 + r() * 0.5), rr = 3 + r() * 9; const hue = r() < 0.5 ? 168 : 280; const gr = f.createRadialGradient(x, y, 0, x, y, rr * 5); gr.addColorStop(0, 'hsla(' + hue + ',90%,70%,0.55)'); gr.addColorStop(1, 'hsla(' + hue + ',90%,60%,0)'); f.fillStyle = gr; f.fillRect(x - rr * 5, y - rr * 5, rr * 10, rr * 10); f.fillStyle = 'hsla(' + hue + ',90%,85%,0.9)'; f.beginPath(); f.arc(x, y, rr * 0.4, 0, 7); f.fill(); }
			for(let k = 0; k < 14; k++){ const x = r() * PERIOD; f.strokeStyle = r() < 0.5 ? 'rgba(80,240,200,0.25)' : 'rgba(180,130,255,0.25)'; f.lineWidth = 1.5; f.beginPath(); let cx = x, cy = vh * 0.3; f.moveTo(cx, cy); while(cy < vh){ cx += (r() - 0.5) * 30; cy += 20 + r() * 20; f.lineTo(cx, cy); } f.stroke(); }
			// roof teeth across the top of the far layer
			f.fillStyle = '#06080b'; f.beginPath(); f.moveTo(0, 0); for(let x = 0; x <= PERIOD; x += 24){ f.lineTo(x, vh * 0.12 + Math.sin(x * 0.01) * 20 + ((x / 24) % 4 === 0 ? 40 + r() * 60 : r() * 14)); } f.lineTo(PERIOD, 0); f.fill();
			ridge(m, vh * 0.78, vh * 0.12, [4, 9, 19], 42, '#080b0f', PERIOD);
			for(let k = 0; k < 30; k++){ const x = r() * PERIOD, h = 30 + r() * 110, base = vh * 0.82; m.fillStyle = '#0a0d12'; m.beginPath(); m.moveTo(x - 12 - h * 0.1, base); m.lineTo(x, base - h); m.lineTo(x + 12 + h * 0.1, base); m.fill(); }
		} else {
			shadeRect(s, 0, 0, vw, vh, '#1b1438', '#8e86b8');
			const hz = s.createLinearGradient(0, vh * 0.55, 0, vh); hz.addColorStop(0, 'rgba(240,220,255,0)'); hz.addColorStop(1, 'rgba(240,226,255,0.55)');
			s.fillStyle = hz; s.fillRect(0, vh * 0.55, vw, vh * 0.45);
			// far: thin stone spires standing out of the cloud sea
			for(let k = 0; k < 11; k++){
				const x = (k + r()) / 11 * PERIOD, w = 18 + r() * 30, h = vh * (0.25 + r() * 0.3), base = vh * 0.78;
				f.fillStyle = 'rgba(70,60,110,0.75)';
				f.beginPath(); f.moveTo(x - w, base); f.lineTo(x - w * 0.4, base - h * 0.7); f.lineTo(x, base - h); f.lineTo(x + w * 0.5, base - h * 0.6); f.lineTo(x + w, base); f.fill();
				f.fillStyle = 'rgba(70,60,110,0.6)'; f.beginPath(); f.ellipse(x, base - h * 0.62, w * 1.6, 10, 0, 0, 7); f.fill();
			}
			// cloud banks
			for(let layer = 0; layer < 2; layer++){
				const c = layer ? m : f, y0 = vh * (layer ? 0.86 : 0.76);
				for(let k = 0; k < 26; k++){
					const x = r() * PERIOD, rr = 60 + r() * 120;
					const gr = c.createRadialGradient(x, y0, 4, x, y0, rr);
					gr.addColorStop(0, layer ? 'rgba(235,228,255,0.9)' : 'rgba(170,160,210,0.7)'); gr.addColorStop(1, 'rgba(200,190,240,0)');
					c.fillStyle = gr; c.beginPath(); c.ellipse(x, y0 + (r() - 0.5) * 30, rr * 1.6, rr * 0.55, 0, 0, 7); c.fill();
				}
			}
		}
		return L;
	}
	function blit(ctx, cv, scroll, y){
		const w = cv.width;
		let x = -(((scroll % w) + w) % w);
		while(x < ctx.canvas.width){ ctx.drawImage(cv, Math.round(x), Math.round(y)); x += w; }
	}

	/* ---------- world decor behind the platforms (drawn live; cheap shapes) ---------- */
	function drawDecor(ctx, cam, vw, vh, t, map){
		const X = (x) => x - cam.x, Y = (y) => y - cam.y;
		if(map.id === 'ember'){
			// the back wall of the caldera: huge basalt organ pipes
			ctx.fillStyle = '#1a0f0e';
			for(let x = 300; x < 4100; x += 110){
				if(x > 1000 && x < 3400) continue;      // the middle opens onto the burning caldera
				const sx = X(x); if(sx < -120 || sx > vw + 20) continue;
				const top = 900 + ((x * 37) % 230);
				ctx.fillStyle = (x / 110) % 2 ? '#1c1110' : '#221413'; ctx.fillRect(sx, Y(top), 104, 2000 - top);
				ctx.fillStyle = 'rgba(255,120,40,0.06)'; ctx.fillRect(sx, Y(top), 6, 2000 - top);
			}
			// the caldera roof: great stalactites
			for(let x = 320; x < 4080; x += 70){
				const sx = X(x); if(sx < -60 || sx > vw + 60) continue;
				const len = 60 + ((x * 53) % 170) + (x % 280 === 0 ? 160 : 0);
				ctx.fillStyle = '#120909';
				ctx.beginPath(); ctx.moveTo(sx - 34, Y(760)); ctx.lineTo(sx + 34, Y(760)); ctx.lineTo(sx + 6, Y(760 + len)); ctx.lineTo(sx - 2, Y(760 + len + 14)); ctx.closePath(); ctx.fill();
				ctx.fillStyle = 'rgba(255,110,40,0.10)'; ctx.beginPath(); ctx.moveTo(sx - 34, Y(760)); ctx.lineTo(sx - 26, Y(760)); ctx.lineTo(sx - 1, Y(760 + len + 10)); ctx.closePath(); ctx.fill();
			}
			ctx.fillStyle = '#120909'; ctx.fillRect(X(140), Y(0), 4120, 762);
			// lava falls pouring from the wall
			for(const fx of [700, 1650, 2750, 3700]){
				const sx = X(fx); if(sx < -80 || sx > vw + 80) continue;
				const top = Y(1050), bot = Y(2000);
				const gr = ctx.createLinearGradient(sx - 30, 0, sx + 30, 0);
				gr.addColorStop(0, 'rgba(255,80,10,0)'); gr.addColorStop(0.5, 'rgba(255,140,40,0.9)'); gr.addColorStop(1, 'rgba(255,80,10,0)');
				ctx.fillStyle = gr; ctx.fillRect(sx - 30, top, 60, bot - top);
				ctx.fillStyle = 'rgba(255,230,150,0.6)';
				for(let k = 0; k < 6; k++){ const yy = top + ((t * 260 + k * 160) % (bot - top)); ctx.fillRect(sx - 4 + Math.sin(k * 3 + t * 4) * 6, yy, 3, 22); }
				const pool = ctx.createRadialGradient(sx, bot, 4, sx, bot, 90); pool.addColorStop(0, 'rgba(255,140,40,0.5)'); pool.addColorStop(1, 'rgba(255,80,10,0)');
				ctx.fillStyle = pool; ctx.fillRect(sx - 90, bot - 90, 180, 120);
			}
			// braziers
			for(const bx of [520, 1500, 2900, 3880]){
				const sx = X(bx), gy = Y(bx < 750 || bx > 3650 ? 1800 : 2000);
				if(sx < -60 || sx > vw + 60) continue;
				ctx.fillStyle = '#2a201d'; ctx.fillRect(sx - 5, gy - 70, 10, 70); ctx.fillRect(sx - 18, gy - 78, 36, 10);
				drawFlame(ctx, sx, gy - 78, 18, t + bx);
			}
		} else if(map.id === 'frost'){
			// the vault: broken arches across the top, crystal clusters, snowy pines at the sides
			ctx.fillStyle = '#27405e';
			for(let x = 300; x < 4100; x += 600){
				const sx = X(x); if(sx > vw + 40 || sx + 600 < -40) continue;
				ctx.beginPath(); ctx.moveTo(sx, Y(1150)); ctx.quadraticCurveTo(sx + 300, Y(820), sx + 600, Y(1150)); ctx.lineTo(sx + 600, Y(1110)); ctx.quadraticCurveTo(sx + 300, Y(780), sx, Y(1110)); ctx.fill();
			}
			ctx.fillStyle = '#2f4b6c'; ctx.fillRect(X(300), Y(1060), 3800, 40);
			ctx.fillStyle = 'rgba(230,245,255,0.5)'; ctx.fillRect(X(300), Y(1060), 3800, 4);
			for(let x = 320; x < 4080; x += 23){ const sx = X(x); if(sx < -10 || sx > vw + 10) continue; const len = 8 + ((x * 31) % 26); ctx.fillStyle = 'rgba(200,235,255,0.7)'; ctx.beginPath(); ctx.moveTo(sx - 3, Y(1100)); ctx.lineTo(sx + 3, Y(1100)); ctx.lineTo(sx, Y(1100 + len)); ctx.fill(); }
			// columns of the nave
			for(let x = 450; x < 4000; x += 520){
				const sx = X(x); if(sx < -60 || sx > vw + 60) continue;
				ctx.fillStyle = '#2a4362'; ctx.fillRect(sx, Y(1100), 56, 900);
				ctx.fillStyle = 'rgba(210,235,255,0.12)'; ctx.fillRect(sx + 4, Y(1100), 8, 900);
			}
			// crystals glowing at the foot of the walls
			for(const [cx, sz] of [[420, 1.2], [1560, 0.8], [2840, 0.8], [3980, 1.2], [2200, 0.6]]){
				const sx = X(cx), gy = Y(cx === 2200 ? 1930 : 2000); if(sx < -120 || sx > vw + 120) continue;
				drawCrystals(ctx, sx, gy, sz, t + cx);
			}
			const pine = img(FLORA('pine-snow1'));
			if(ok(pine)) for(const px of [360, 4040]){ const sx = X(px); if(sx < -200 || sx > vw + 200) continue; const h = 360, w = h * pine.naturalWidth / pine.naturalHeight; ctx.drawImage(pine, sx - w / 2, Y(2000) - h + 8, w, h); }
		} else if(map.id === 'colosseum'){
			// the podium wall that rings the sand (the stands rise behind it), with the gates of the hypogeum
			{
				const x0 = Math.max(300, cam.x - 10), x1 = Math.min(5700, cam.x + vw + 10), top = Y(1760), bot = Y(2000);
				if(x1 > x0){
					const wg = ctx.createLinearGradient(0, top, 0, bot); wg.addColorStop(0, '#c4a275'); wg.addColorStop(1, '#8a6a44');
					ctx.fillStyle = wg; ctx.fillRect(X(x0), top, x1 - x0, bot - top);
					ctx.fillStyle = 'rgba(70,46,24,0.35)';
					for(let x = Math.ceil(x0 / 90) * 90; x < x1; x += 90) ctx.fillRect(X(x), top + 14, 2, bot - top - 14);
					for(let y = 1800; y < 2000; y += 40) ctx.fillRect(X(x0), Y(y), x1 - x0, 1.5);
					ctx.fillStyle = '#efe6d2'; ctx.fillRect(X(x0), top - 6, x1 - x0, 14); ctx.fillStyle = 'rgba(120,96,64,0.6)'; ctx.fillRect(X(x0), top + 8, x1 - x0, 3);
					for(const gx of [1050, 3000, 4950]){
						const sx = X(gx); if(sx < -120 || sx > vw + 120) continue;
						ctx.fillStyle = '#d8c8a4'; ctx.beginPath(); ctx.moveTo(sx - 74, bot); ctx.lineTo(sx - 74, top + 64); ctx.quadraticCurveTo(sx, top - 4, sx + 74, top + 64); ctx.lineTo(sx + 74, bot); ctx.fill();
						ctx.fillStyle = '#1e140c'; ctx.beginPath(); ctx.moveTo(sx - 58, bot); ctx.lineTo(sx - 58, top + 70); ctx.quadraticCurveTo(sx, top + 14, sx + 58, top + 70); ctx.lineTo(sx + 58, bot); ctx.fill();
						ctx.strokeStyle = '#3a2a1c'; ctx.lineWidth = 4; for(let k = -48; k <= 48; k += 16){ ctx.beginPath(); ctx.moveTo(sx + k, top + 58); ctx.lineTo(sx + k, bot); ctx.stroke(); }
						ctx.lineWidth = 3; for(let y = top + 80; y < bot; y += 34){ ctx.beginPath(); ctx.moveTo(sx - 56, y); ctx.lineTo(sx + 56, y); ctx.stroke(); }
					}
				}
			}
			// statues of champions on pedestals at both ends, braziers, and pennants on the podium
			for(const [sx0, flip] of [[620, 1], [5380, -1]]){
				const sx = X(sx0), gy = Y(2000); if(sx < -200 || sx > vw + 200) continue;
				drawStatue(ctx, sx, gy, flip);
			}
			for(const bx of [1000, 2400, 3600, 5000]){
				const sx = X(bx), gy = Y(2000); if(sx < -60 || sx > vw + 60) continue;
				ctx.fillStyle = '#5a4632'; ctx.fillRect(sx - 6, gy - 120, 12, 120); ctx.fillStyle = '#7a6040'; ctx.fillRect(sx - 22, gy - 128, 44, 12); ctx.fillStyle = '#3a2c20'; ctx.fillRect(sx - 18, gy - 8, 36, 8);
				drawFlame(ctx, sx, gy - 128, 14, t + bx);
			}
			for(let x = 500; x < 5600; x += 300){
				const sx = X(x), top = Y(1754); if(sx < -60 || sx > vw + 60) continue;
				ctx.fillStyle = '#4a3a2a'; ctx.fillRect(sx - 2, top - 80, 4, 90);
				const col = ['#a8281e', '#e9d9b0', '#1f4f8f', '#c9962a'][(x / 300) % 4 | 0];
				ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(sx + 2, top - 80);
				for(let k = 0; k <= 6; k++) ctx.lineTo(sx + 2 + k * 9, top - 80 + Math.sin(t * 4 + k * 0.7 + x) * (k * 0.9) + (k === 6 ? 7 : 0));
				for(let k = 6; k >= 0; k--) ctx.lineTo(sx + 2 + k * 9, top - 62 + Math.sin(t * 4 + k * 0.7 + x) * (k * 0.9));
				ctx.closePath(); ctx.fill();
			}
		} else if(map.id === 'cavern'){
			// hanging roots and glow-worm threads from the roof, crystal clusters, still pools
			for(let x = 330; x < 4080; x += 46){
				const sx = X(x); if(sx < -20 || sx > vw + 20) continue;
				if(((x * 7) % 5) > 1) continue;
				if(x > 2090 && x < 2310) continue;
				const top = Y(ceilingAt(x)), len = 30 + ((x * 31) % 110);
				ctx.strokeStyle = 'rgba(120,255,220,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(sx, top); ctx.lineTo(sx + Math.sin(t + x) * 2, top + len); ctx.stroke();
				for(let k = 0; k < 4; k++){ ctx.fillStyle = 'rgba(160,255,230,' + (0.5 + 0.4 * Math.sin(t * 2 + k + x)) + ')'; ctx.fillRect(sx + Math.sin(t + x) * 2 * (k / 4) - 1, top + len * (0.25 + k * 0.25) - 1, 2, 2); }
			}
			for(const [cx, sz, hue] of [[420, 1.1, 168], [1500, 0.7, 280], [2960, 0.7, 168], [3990, 1.1, 280], [1300, 0.5, 200]]){
				const sx = X(cx); if(sx < -140 || sx > vw + 140) continue;
				drawCaveCrystals(ctx, sx, Y(2000), sz, t + cx, hue);
			}
		} else {
			// storm: distant lightning silhouettes are in the sky layer; here hang chains of old rope bridges
			ctx.strokeStyle = 'rgba(60,45,40,0.7)'; ctx.lineWidth = 3;
			for(const [a, b] of [[1240, 1700], [2700, 3160]]){
				const ax = X(a), bx = X(b), ay = Y(1900), by = Y(1960);
				ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo((ax + bx) / 2, Math.max(ay, by) + 120, bx, by); ctx.stroke();
				for(let k = 1; k < 9; k++){ const u = k / 9; const x = lerp(ax, bx, u); const y = (1 - u) * (1 - u) * ay + 2 * (1 - u) * u * (Math.max(ay, by) + 120) + u * u * by; ctx.fillStyle = 'rgba(80,60,50,0.6)'; ctx.fillRect(x - 6, y, 12, 4); }
			}
		}
	}
	function drawStatue(ctx, x, gy, flip){
		// a champion in marble on a stepped plinth, spear raised
		ctx.save(); ctx.translate(x, gy); ctx.scale(flip, 1);
		ctx.fillStyle = '#b8a888'; ctx.fillRect(-80, -40, 160, 40); ctx.fillStyle = '#cfc2a4'; ctx.fillRect(-64, -92, 128, 52); ctx.fillStyle = '#a89878'; ctx.fillRect(-80, -44, 160, 6);
		const g = ctx.createLinearGradient(-40, 0, 40, 0); g.addColorStop(0, '#9d9686'); g.addColorStop(0.45, '#f0ebe0'); g.addColorStop(1, '#8c8576');
		ctx.fillStyle = g;
		const by = -92;
		ctx.beginPath(); ctx.moveTo(-26, by); ctx.lineTo(-18, by - 120); ctx.lineTo(18, by - 120); ctx.lineTo(28, by); ctx.closePath(); ctx.fill();      // legs and tunic
		ctx.beginPath(); ctx.moveTo(-30, by - 110); ctx.lineTo(-24, by - 190); ctx.lineTo(24, by - 190); ctx.lineTo(32, by - 110); ctx.closePath(); ctx.fill();      // torso
		ctx.beginPath(); ctx.arc(0, by - 210, 20, 0, 7); ctx.fill();      // head
		ctx.beginPath(); ctx.moveTo(-14, by - 228); ctx.quadraticCurveTo(0, by - 262, 14, by - 228); ctx.fill();      // crest
		ctx.save(); ctx.translate(26, by - 180); ctx.rotate(-0.5); ctx.fillRect(-6, -70, 12, 80); ctx.restore();      // raised arm
		ctx.fillStyle = '#8a8070'; ctx.fillRect(40, by - 330, 6, 230); ctx.beginPath(); ctx.moveTo(36, by - 330); ctx.lineTo(43, by - 360); ctx.lineTo(50, by - 330); ctx.fill();      // spear
		ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(-36, by - 140, 26, 40, 0.1, 0, 7); ctx.fill();      // shield
		ctx.strokeStyle = 'rgba(120,110,90,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(-36, by - 140, 18, 30, 0.1, 0, 7); ctx.stroke();
		ctx.restore();
	}
	function drawCaveCrystals(ctx, x, y, sz, t, hue){
		const pulse = 0.75 + 0.25 * Math.sin(t * 1.3);
		const gl = ctx.createRadialGradient(x, y - 40 * sz, 4, x, y - 40 * sz, 150 * sz);
		gl.addColorStop(0, 'hsla(' + hue + ',90%,65%,' + (0.35 * pulse) + ')'); gl.addColorStop(1, 'hsla(' + hue + ',90%,60%,0)');
		ctx.fillStyle = gl; ctx.fillRect(x - 150 * sz, y - 190 * sz, 300 * sz, 220 * sz);
		for(const [dx, h, a] of [[-30, 70, -0.35], [-8, 120, -0.08], [14, 95, 0.18], [34, 60, 0.42], [-48, 40, -0.6]]){
			ctx.save(); ctx.translate(x + dx * sz, y); ctx.rotate(a);
			const gr = ctx.createLinearGradient(-8 * sz, 0, 8 * sz, 0);
			gr.addColorStop(0, 'hsl(' + hue + ',60%,35%)'); gr.addColorStop(0.5, 'hsl(' + hue + ',90%,85%)'); gr.addColorStop(1, 'hsl(' + hue + ',60%,30%)');
			ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(-9 * sz, 0); ctx.lineTo(-6 * sz, -h * sz * 0.8); ctx.lineTo(0, -h * sz); ctx.lineTo(6 * sz, -h * sz * 0.8); ctx.lineTo(9 * sz, 0); ctx.fill();
			ctx.restore();
		}
	}
	/* ---------- the cavern: still pools, falling rock, and the dark ---------- */
	function drawPools(ctx, cam, vw, vh, t, map){
		for(const L of map.pools || []){
			const x0 = L.x0 - cam.x, x1 = L.x1 - cam.x; if(x1 < 0 || x0 > vw) continue;
			const y = L.y - cam.y;
			ctx.save();
			ctx.beginPath(); ctx.moveTo(x0, vh + 10);
			for(let x = x0; x <= x1; x += 12){ const wx = x + cam.x; ctx.lineTo(x, y + Math.sin(wx * 0.02 + t * 1.2) * 1.5); }
			ctx.lineTo(x1, vh + 10); ctx.closePath();
			const lg = ctx.createLinearGradient(0, y, 0, y + 200); lg.addColorStop(0, 'rgba(90,240,210,0.55)'); lg.addColorStop(0.15, 'rgba(20,110,110,0.75)'); lg.addColorStop(1, 'rgba(4,20,26,0.95)');
			ctx.fillStyle = lg; ctx.fill();
			ctx.strokeStyle = 'rgba(200,255,240,0.6)'; ctx.lineWidth = 1.5;
			for(let k = 0; k < 6; k++){ const px = x0 + ((k * 137 + t * 18) % (x1 - x0)); ctx.beginPath(); ctx.moveTo(px, y + 3); ctx.lineTo(px + 26, y + 3); ctx.stroke(); }
			ctx.restore();
		}
	}
	function ceilingAt(x){
		let best = 0;
		for(const p of P.plats){ if(!p.ceiling || x < p.x || x > p.x + p.w) continue; best = Math.max(best, p.y + p.h); }
		return best || 1150;
	}
	function rockWave(map, k){
		const H = map.hazards.rock, r = rng(P.seed * 41 + k * 733 + 11), xs = map.rocks.xs.slice(), out = [];
		for(let i = 0; i < H.count; i++){ const j = Math.floor(r() * xs.length); out.push(xs.splice(j, 1)[0] + (r() - 0.5) * 80); }
		return out;
	}
	function rockState(map, clock){
		const H = map.hazards.rock, k = Math.floor(clock / H.period), ph = clock - k * H.period;
		return { k, ph, xs: k >= 1 ? rockWave(map, k) : [], warn: ph < H.warn ? ph / H.warn : 1, fallT: ph - H.warn };
	}
	function rockY(x, fallT){ return ceilingAt(x) + 30 + 0.5 * 2400 * fallT * fallT; }
	function drawRocks(ctx, cam, vw, vh, t, map, clock){
		const st = rockState(map, clock); if(!st.xs.length) return;
		for(const x of st.xs){
			const sx = x - cam.x; if(sx < -80 || sx > vw + 80) continue;
			const top = ceilingAt(x) - cam.y, fl = floorAt(x) - cam.y;
			ctx.save();
			if(st.fallT < 0){
				// dust trickling from a crack, a shadow on the floor
				ctx.fillStyle = 'rgba(170,160,140,' + (0.25 + 0.45 * st.warn) + ')';
				for(let k = 0; k < 8; k++){ const yy = top + ((t * 260 + k * 37) % Math.max(40, fl - top)); ctx.fillRect(sx - 6 + (k % 4) * 4, yy, 2, 2); }
				drawBoulder(ctx, sx + Math.sin(t * 50) * 1.5 * st.warn, top + 20, 0);
				ctx.fillStyle = 'rgba(0,0,0,' + (0.2 + 0.35 * st.warn) + ')'; ctx.beginPath(); ctx.ellipse(sx, fl, 30 + 14 * st.warn, 6, 0, 0, 7); ctx.fill();
			} else {
				const y = rockY(x, st.fallT);
				if(y < floorAt(x)) drawBoulder(ctx, sx, y - cam.y, st.fallT * 9);
				else if(st.fallT < 1.0){ ctx.globalAlpha = 1 - st.fallT; ctx.fillStyle = '#5a5448'; for(let k = 0; k < 8; k++){ const a = k / 8 * Math.PI; ctx.fillRect(sx + Math.cos(a) * 34 * st.fallT * 3, fl - Math.sin(a) * 26 * st.fallT * 3, 5, 5); } ctx.fillStyle = 'rgba(160,150,130,0.35)'; ctx.beginPath(); ctx.ellipse(sx, fl - 10, 80 * st.fallT + 20, 24, 0, 0, 7); ctx.fill(); }
			}
			ctx.restore();
		}
	}
	function drawBoulder(ctx, x, y, rot){
		ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
		const g = ctx.createRadialGradient(-6, -8, 2, 0, 0, 26); g.addColorStop(0, '#6a6458'); g.addColorStop(1, '#25231f');
		ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-22, -4); ctx.lineTo(-12, -20); ctx.lineTo(10, -22); ctx.lineTo(24, -6); ctx.lineTo(18, 16); ctx.lineTo(-6, 22); ctx.lineTo(-22, 12); ctx.closePath(); ctx.fill();
		ctx.restore();
	}
	let darkCv = null;
	function drawDark(ctx, cam, vw, vh, t){
		/* the cavern is dark: everything outside the light of the fighters, the fungus, the crystals and your
		   magic sinks into shadow (the same for both players) */
		if(!darkCv || darkCv.width !== vw || darkCv.height !== vh) darkCv = mkCanvas(vw, vh);
		const g = darkCv.getContext('2d');
		g.globalCompositeOperation = 'source-over';
		g.clearRect(0, 0, vw, vh);
		g.fillStyle = 'rgba(2,4,9,0.74)'; g.fillRect(0, 0, vw, vh);
		g.globalCompositeOperation = 'destination-out';
		const hole = (x, y, rad, a) => { if(x < -rad || x > vw + rad || y < -rad || y > vh + rad) return; const gr = g.createRadialGradient(x, y, rad * 0.15, x, y, rad); gr.addColorStop(0, 'rgba(0,0,0,' + a + ')'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); };
		if(P.snap){ for(const sd of [ 'left', 'right' ]){ const sp = P.map.spawns[sd]; hole(sp.x - cam.x, sp.y - 40 - cam.y, 320, 1); } }      // a preview: the fighters at their spawns
		else {
			hole(player.x + player.w / 2 - cam.x, player.y + player.h / 2 - cam.y, 330, 1);
			for(const R of remotes()) if(R.active && !R.ko && !R.left) hole(R.x + R.w / 2 - cam.x, R.y + R.h / 2 - cam.y, 300, 0.95);
		}
		for(const l of P.map.ledges){ if(l.mat === 'mushroom' || l.mat === 'bracket') hole(l.x + l.w / 2 - cam.x, l.y - 10 - cam.y, 230, 0.85); }
		for(const [cx] of [[420], [1500], [2960], [3990], [1300]]) hole(cx - cam.x, 1960 - cam.y, 220, 0.8);
		for(const L of P.map.pools || []) for(let x = L.x0 + 100; x < L.x1; x += 200) hole(x - cam.x, L.y - cam.y, 160, 0.45);
		const W = root.MAGIC_WORLD_REF;
		if(W && W.bodies) for(const b of W.bodies){ if(!b.alive) continue; hole(b.x - cam.x, b.y - cam.y, Math.min(260, 70 + Math.sqrt(Math.max(0, b.amount || 0)) * 14), 0.9); }
		if(typeof projectiles !== 'undefined') for(const q of projectiles) hole(q.x - cam.x, q.y - cam.y, 120, 0.8);
		ctx.drawImage(darkCv, 0, 0);
	}

	function drawFlame(ctx, x, y, s, t){
		for(let k = 0; k < 3; k++){
			const h = s * (1.6 - k * 0.4) * (0.85 + 0.15 * Math.sin(t * 9 + k * 2));
			const gr = ctx.createRadialGradient(x, y - h * 0.4, 1, x, y - h * 0.3, h);
			gr.addColorStop(0, k === 2 ? 'rgba(255,250,220,0.95)' : 'rgba(255,190,80,0.9)'); gr.addColorStop(1, 'rgba(255,60,10,0)');
			ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(x + Math.sin(t * 7 + k) * 2, y - h * 0.45, h * 0.45, h * 0.8, 0, 0, 7); ctx.fill();
		}
		const gl = ctx.createRadialGradient(x, y - s, 2, x, y - s, s * 5); gl.addColorStop(0, 'rgba(255,140,40,0.25)'); gl.addColorStop(1, 'rgba(255,100,20,0)');
		ctx.fillStyle = gl; ctx.fillRect(x - s * 5, y - s * 6, s * 10, s * 10);
	}
	function drawCrystals(ctx, x, y, sz, t){
		const pulse = 0.75 + 0.25 * Math.sin(t * 1.7);
		const gl = ctx.createRadialGradient(x, y - 40 * sz, 4, x, y - 40 * sz, 130 * sz);
		gl.addColorStop(0, 'rgba(140,220,255,' + (0.35 * pulse) + ')'); gl.addColorStop(1, 'rgba(120,200,255,0)');
		ctx.fillStyle = gl; ctx.fillRect(x - 130 * sz, y - 170 * sz, 260 * sz, 200 * sz);
		const shards = [[-30, 70, -0.35], [-8, 120, -0.08], [14, 95, 0.18], [34, 60, 0.42], [-48, 40, -0.6]];
		for(const [dx, h, a] of shards){
			ctx.save(); ctx.translate(x + dx * sz, y); ctx.rotate(a);
			const gr = ctx.createLinearGradient(-8 * sz, 0, 8 * sz, 0);
			gr.addColorStop(0, '#5fb6e6'); gr.addColorStop(0.5, '#d8f4ff'); gr.addColorStop(1, '#3a86c0');
			ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(-9 * sz, 0); ctx.lineTo(-6 * sz, -h * sz * 0.8); ctx.lineTo(0, -h * sz); ctx.lineTo(6 * sz, -h * sz * 0.8); ctx.lineTo(9 * sz, 0); ctx.fill();
			ctx.restore();
		}
	}

	/* ---------- lava, vents, icicles, bolts: the hazard visuals ---------- */
	function drawLava(ctx, cam, vw, vh, t, map){
		for(const L of map.lava || []){
			const x0 = L.x0 - cam.x, x1 = L.x1 - cam.x; if(x1 < 0 || x0 > vw) continue;
			const y = L.y - cam.y;
			ctx.save();
			const gl = ctx.createLinearGradient(0, y - 180, 0, y); gl.addColorStop(0, 'rgba(255,90,20,0)'); gl.addColorStop(1, 'rgba(255,110,30,0.45)');
			ctx.fillStyle = gl; ctx.fillRect(x0, y - 180, x1 - x0, 180);
			ctx.beginPath(); ctx.moveTo(x0, vh + 10);
			for(let x = x0; x <= x1; x += 10){ const wx = x + cam.x; ctx.lineTo(x, y + Math.sin(wx * 0.03 + t * 2.1) * 3 + Math.sin(wx * 0.011 - t * 1.4) * 3); }
			ctx.lineTo(x1, vh + 10); ctx.closePath();
			const lg = ctx.createLinearGradient(0, y, 0, y + 260); lg.addColorStop(0, '#ffd36a'); lg.addColorStop(0.08, '#ff8a1e'); lg.addColorStop(0.4, '#c02a08'); lg.addColorStop(1, '#3a0703');
			ctx.fillStyle = lg; ctx.fill();
			// crust plates drifting on the surface
			ctx.fillStyle = 'rgba(60,14,6,0.55)';
			for(let k = 0; k < 9; k++){ const px = x0 + (((k * 97 + t * 22) % (x1 - x0)) + (x1 - x0)) % (x1 - x0); ctx.beginPath(); ctx.ellipse(px, y + 10 + (k % 3) * 9, 26 + (k % 4) * 9, 5, 0, 0, 7); ctx.fill(); }
			ctx.restore();
		}
	}
	function ventState(map, clock, v, vi){
		const H = map.hazards.vent, per = H.period, off = vi * per * 0.5;
		const ph = ((clock - off) % per + per) % per;
		if(clock < off) return { warn: 0, burst: 0 };
		const warnStart = per - H.warn - H.burst;
		return { warn: ph >= warnStart && ph < per - H.burst ? (ph - warnStart) / H.warn : 0, burst: ph >= per - H.burst ? (ph - (per - H.burst)) / H.burst : 0 };
	}
	function drawVents(ctx, cam, vw, vh, t, map, clock){
		(map.vents || []).forEach((v, vi) => {
			const sx = v.x - cam.x, gy = 2000 - cam.y; if(sx < -120 || sx > vw + 120) return;
			const st = ventState(map, clock, v, vi);
			ctx.save();
			ctx.fillStyle = '#0b0606'; ctx.beginPath(); ctx.ellipse(sx, gy + 2, 42, 7, 0, 0, 7); ctx.fill();
			const glow = 0.35 + st.warn * 0.65 + (st.burst ? 1 : 0);
			const gl = ctx.createRadialGradient(sx, gy, 2, sx, gy, 70 + 60 * glow); gl.addColorStop(0, 'rgba(255,150,40,' + (0.5 * glow) + ')'); gl.addColorStop(1, 'rgba(255,80,10,0)');
			ctx.fillStyle = gl; ctx.fillRect(sx - 140, gy - 140, 280, 160);
			if(st.warn > 0){ ctx.fillStyle = 'rgba(70,60,60,' + (0.3 + st.warn * 0.4) + ')'; for(let k = 0; k < 5; k++){ const yy = gy - ((t * 90 + k * 30) % 120); ctx.beginPath(); ctx.arc(sx + Math.sin(t * 3 + k) * 10, yy, 8 + k * 2, 0, 7); ctx.fill(); } }
			if(st.burst > 0){
				const h = 520 * Math.sin(Math.min(1, st.burst * 1.25) * Math.PI * 0.5) * (1 - Math.max(0, st.burst - 0.8) * 3);
				const gr = ctx.createLinearGradient(0, gy - h, 0, gy);
				gr.addColorStop(0, 'rgba(255,200,90,0)'); gr.addColorStop(0.2, 'rgba(255,170,60,0.85)'); gr.addColorStop(1, 'rgba(255,240,170,0.95)');
				ctx.fillStyle = gr;
				ctx.beginPath(); ctx.moveTo(sx - 22, gy);
				for(let yy = 0; yy <= h; yy += 16) ctx.lineTo(sx - 22 - yy * 0.06 + Math.sin(yy * 0.08 + t * 20) * 6, gy - yy);
				for(let yy = h; yy >= 0; yy -= 16) ctx.lineTo(sx + 22 + yy * 0.06 + Math.sin(yy * 0.07 - t * 18) * 6, gy - yy);
				ctx.fill();
			}
			ctx.restore();
		});
	}
	function icicleWave(map, k){
		const H = map.hazards.icicle, r = rng(P.seed * 31 + k * 977 + 5), xs = map.icicles.xs.slice(), out = [];
		for(let i = 0; i < H.count; i++){ const j = Math.floor(r() * xs.length); out.push(xs.splice(j, 1)[0] + (r() - 0.5) * 60); }
		return out;
	}
	function icicleState(map, clock){
		const H = map.hazards.icicle, k = Math.floor(clock / H.period), ph = clock - k * H.period;
		return { k, ph, xs: k >= 1 ? icicleWave(map, k) : [], warn: ph < H.warn ? ph / H.warn : 1, fallT: ph - H.warn };
	}
	function icicleY(map, fallT){ return map.icicles.y + 40 + 0.5 * 2600 * fallT * fallT; }
	function drawIcicles(ctx, cam, vw, vh, t, map, clock){
		const st = icicleState(map, clock); if(!st.xs.length) return;
		for(const x of st.xs){
			const sx = x - cam.x; if(sx < -60 || sx > vw + 60) continue;
			ctx.save();
			if(st.fallT < 0){
				// shaking at the vault, a shadow on the floor
				const shake = Math.sin(t * 60) * 2 * st.warn;
				drawIcicle(ctx, sx + shake, map.icicles.y + 40 - cam.y);
				ctx.fillStyle = 'rgba(160,220,255,' + (0.18 + 0.3 * st.warn) + ')'; ctx.beginPath(); ctx.ellipse(sx, floorAt(x) - cam.y, 26 + 14 * st.warn, 5, 0, 0, 7); ctx.fill();
			} else {
				const y = icicleY(map, st.fallT);
				if(y < floorAt(x)) drawIcicle(ctx, sx, y - cam.y);
				else if(st.fallT < 0.9){ ctx.globalAlpha = 1 - st.fallT; ctx.fillStyle = '#dff4ff'; for(let k = 0; k < 7; k++){ const a = k / 7 * Math.PI; ctx.fillRect(sx + Math.cos(a) * 30 * st.fallT * 3, floorAt(x) - cam.y - Math.sin(a) * 22 * st.fallT * 3, 4, 4); } }
			}
			ctx.restore();
		}
	}
	function drawIcicle(ctx, x, y){
		const gr = ctx.createLinearGradient(x - 10, 0, x + 10, 0); gr.addColorStop(0, '#7cc4ea'); gr.addColorStop(0.5, '#effaff'); gr.addColorStop(1, '#4f9dcf');
		ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(x - 11, y - 46); ctx.lineTo(x + 11, y - 46); ctx.lineTo(x, y + 28); ctx.closePath(); ctx.fill();
	}
	function floorAt(x){
		// the highest solid top under x (for shadows and impacts)
		let best = WORLD_H;
		for(const p of P.plats){ if(p.invisible || x < p.x || x > p.x + p.w) continue; if(p.y < best && p.y > 1300) best = p.y; }
		return best;
	}
	function boltState(map, clock){
		const H = map.hazards.bolt, k = Math.floor(clock / H.period), ph = clock - k * H.period;
		if(k < 1) return null;
		const r = rng(P.seed * 53 + k * 613 + 9);
		const spots = [ [1750, 2650], [470, 1200], [3200, 3930], [1330, 1530], [2870, 3070], [2060, 2340] ];
		const s = spots[Math.floor(r() * spots.length)];
		const x = lerp(s[0], s[1], r());
		return { k, x, ph, warn: ph < H.warn ? ph / H.warn : 1, strike: ph >= H.warn ? ph - H.warn : -1 };
	}
	function drawBolt(ctx, cam, vw, vh, t, map, clock){
		const st = boltState(map, clock); if(!st) return;
		const sx = st.x - cam.x, gy = floorAt(st.x) - cam.y;
		if(sx < -200 || sx > vw + 200) return;
		ctx.save();
		if(st.strike < 0){
			// gathering: a crackling ring on the ground, a column of static
			const a = 0.25 + 0.55 * st.warn;
			ctx.strokeStyle = 'rgba(220,210,255,' + a + ')'; ctx.lineWidth = 2;
			ctx.beginPath(); ctx.ellipse(sx, gy, map.hazards.bolt.halfW * (1.2 - 0.3 * st.warn), 8, 0, 0, 7); ctx.stroke();
			const col = ctx.createLinearGradient(0, gy - 600, 0, gy); col.addColorStop(0, 'rgba(200,190,255,0)'); col.addColorStop(1, 'rgba(200,190,255,' + (0.18 * st.warn) + ')');
			ctx.fillStyle = col; ctx.fillRect(sx - map.hazards.bolt.halfW, gy - 600, map.hazards.bolt.halfW * 2, 600);
			if(Math.random() < 0.3 * st.warn){ ctx.strokeStyle = '#efeaff'; ctx.lineWidth = 1; ctx.beginPath(); let x = sx + (Math.random() - 0.5) * 60, y = gy; ctx.moveTo(x, y); for(let k = 0; k < 4; k++){ x += (Math.random() - 0.5) * 16; y -= 10 + Math.random() * 10; ctx.lineTo(x, y); } ctx.stroke(); }
		} else if(st.strike < 0.35){
			const a = 1 - st.strike / 0.35;
			ctx.strokeStyle = 'rgba(255,255,255,' + a + ')'; ctx.lineWidth = 5; ctx.shadowColor = '#c9b8ff'; ctx.shadowBlur = 24;
			const r = rng(st.k * 7 + 1);
			ctx.beginPath(); let x = sx + (r() - 0.5) * 120, y = -20; ctx.moveTo(x, y);
			while(y < gy){ x += (r() - 0.5) * 50; y += 30 + r() * 40; ctx.lineTo(lerp(x, sx, y / gy), Math.min(gy, y)); }
			ctx.stroke(); ctx.lineWidth = 2; ctx.stroke();
			ctx.shadowBlur = 0;
			const gl = ctx.createRadialGradient(sx, gy, 2, sx, gy, 140); gl.addColorStop(0, 'rgba(240,235,255,' + a + ')'); gl.addColorStop(1, 'rgba(200,190,255,0)');
			ctx.fillStyle = gl; ctx.fillRect(sx - 140, gy - 140, 280, 180);
			P.flash = Math.max(P.flash, a * 0.5);
		}
		ctx.restore();
	}
	function gustState(map, clock){
		const H = map.hazards.gust, k = Math.floor(clock / H.period), ph = clock - k * H.period;
		if(k < 1 || ph > H.on) return { on: 0, dir: 0 };
		const dir = rng(P.seed * 17 + k * 331)() < 0.5 ? -1 : 1;
		const env = Math.min(1, ph / 0.4, (H.on - ph) / 0.4);
		return { on: env, dir };
	}

	/* ---------- weather particles (front) ---------- */
	function updateParticles(ctx, cam, vw, vh, t, dt, map, clock){
		const parts = P.parts;
		const want = map.weather === 'embers' ? 70 : map.weather === 'snow' ? 140 : map.weather === 'dust' ? 60 : map.weather === 'spores' ? 90 : 160;
		while(parts.length < want){
			if(map.weather === 'embers') parts.push({ x: cam.x + Math.random() * vw, y: cam.y + vh + Math.random() * 60, vx: (Math.random() - 0.5) * 0.6, vy: -0.6 - Math.random() * 1.6, s: 1 + Math.random() * 2.2, life: 3 + Math.random() * 4 });
			else if(map.weather === 'snow') parts.push({ x: cam.x + Math.random() * vw, y: cam.y - 20 - Math.random() * vh, vx: -0.3 + Math.random() * 0.6, vy: 0.6 + Math.random() * 1.2, s: 1 + Math.random() * 2.5, life: 99 });
			else if(map.weather === 'dust') parts.push({ x: cam.x + Math.random() * vw, y: cam.y + Math.random() * vh, vx: 0.15 + Math.random() * 0.3, vy: -0.05 - Math.random() * 0.15, s: 1 + Math.random() * 2, life: 4 + Math.random() * 6, ph: Math.random() * 6 });
			else if(map.weather === 'spores') parts.push({ x: cam.x + Math.random() * vw, y: cam.y + Math.random() * vh, vx: (Math.random() - 0.5) * 0.3, vy: -0.1 - Math.random() * 0.3, s: 1 + Math.random() * 2.4, life: 5 + Math.random() * 7, ph: Math.random() * 6, hue: Math.random() < 0.5 ? 168 : 285 });
			else parts.push({ x: cam.x + Math.random() * (vw + 400), y: cam.y - 40 - Math.random() * vh, vx: -3.5, vy: 13 + Math.random() * 5, s: 1, life: 99 });
		}
		const gust = map.id === 'storm' ? gustState(map, clock) : null;
		ctx.save();
		for(let i = parts.length - 1; i >= 0; i--){
			const p = parts[i];
			p.x += p.vx + (gust ? gust.dir * gust.on * 6 : 0) + (map.weather === 'snow' ? Math.sin(t + p.y * 0.01) * 0.3 : 0);
			p.y += p.vy; p.life -= dt;
			const sx = p.x - cam.x, sy = p.y - cam.y;
			if(p.life <= 0 || sy > vh + 40 || sy < -200 || sx < -120 || sx > vw + 420){ parts.splice(i, 1); continue; }
			if(map.weather === 'embers'){ ctx.fillStyle = 'rgba(255,' + (140 + (p.s * 40 | 0)) + ',60,' + Math.min(1, p.life / 2) + ')'; ctx.fillRect(sx, sy, p.s, p.s); }
			else if(map.weather === 'snow'){ ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(sx, sy, p.s, 0, 7); ctx.fill(); }
			else if(map.weather === 'dust'){ const a = Math.min(1, p.life / 2) * (0.35 + 0.35 * Math.sin(t * 2 + p.ph)); ctx.fillStyle = 'rgba(255,240,200,' + a + ')'; ctx.fillRect(sx, sy, p.s, p.s); p.x += Math.sin(t + p.ph) * 0.2; }
			else if(map.weather === 'spores'){ const a = Math.min(1, p.life / 2) * (0.5 + 0.4 * Math.sin(t * 3 + p.ph)); ctx.fillStyle = 'hsla(' + p.hue + ',90%,75%,' + a + ')'; ctx.beginPath(); ctx.arc(sx, sy, p.s, 0, 7); ctx.fill(); p.x += Math.sin(t * 0.7 + p.ph) * 0.3; }
			else { ctx.strokeStyle = 'rgba(200,200,240,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + p.vx * 1.6, sy + p.vy * 1.6); ctx.stroke(); }
		}
		// gust streaks
		if(gust && gust.on > 0){
			ctx.strokeStyle = 'rgba(235,230,255,' + (0.35 * gust.on) + ')'; ctx.lineWidth = 2;
			for(let k = 0; k < 18; k++){
				const yy = ((k * 131) % vh), xx = ((k * 211 + t * 900 * gust.dir) % (vw + 300) + vw + 300) % (vw + 300) - 150;
				ctx.beginPath(); ctx.moveTo(xx, yy); ctx.quadraticCurveTo(xx + gust.dir * 60, yy - 8, xx + gust.dir * 140, yy); ctx.stroke();
			}
		}
		ctx.restore();
	}

	/* ==================================================================
	   NET — clock sync, compact state, events (up to 4 fighters)
	   Every client is one slot (0..n-1); slot 0 is the host and referee. Modes: 'duel' (1v1), 'ffa' (everyone
	   for themselves) and 'teams' (2v2: slots 0 and 2 against 1 and 3).
	   ================================================================== */
	const NET = {
		link: null, ready: false, slot: 0, n: 2, mode: 'duel', side: 'left', host: true, offset: 0, rtt: 120, rttMin: 1e9,
		seq: 0, lastSend: 0, lastBeat: 0, last: null, pingT: 0, defSent: new Set(), defCache: Object.create(null), castSeq: 0,
		bytes: 0, msgs: 0, rate0: 0, kbps: 0, mps: 0, transport: 'relay', lobbyT: 0
	};
	const now = () => performance.now();
	const hostNow = () => NET.host ? now() : now() + NET.offset;
	function send(k, d, to){
		if(!NET.link) return;
		try { NET.link.send(k, d, to); } catch(e){}
		NET.msgs++;
	}
	/* colours by slot: blue, red, green, yellow (slots 0 and 1 keep the old duel colours); teams are Azure (0, 2) and Crimson (1, 3) */
	const COLOR_OF_SLOT = [ 0, 2, 1, 3 ];
	const FALLBACK_HEX = [ '#4488ff', '#44dd66', '#ff4455', '#ffcc33' ];
	const TEAM = [ { name: 'Team Azure', col: '#5b9cff' }, { name: 'Team Crimson', col: '#ff5b6a' } ];
	const hexOfIdx = (i) => (typeof PLAYER_COLOR_HEX !== 'undefined' ? PLAYER_COLOR_HEX : FALLBACK_HEX)[i % 4];
	const slotHex = (s) => hexOfIdx(COLOR_OF_SLOT[s % 4]);
	const teamOf = (s) => NET.mode === 'teams' ? s % 2 : s;
	const hostile = (a, b) => a !== b && teamOf(a) !== teamOf(b);
	const multi = () => NET.n > 2;
	const scoreKey = (s) => NET.mode === 'teams' ? 't' + (s % 2) : 's' + s;

	/* ==================================================================
	   THE OTHER FIGHTERS — each a networked body, a caster in your rune world, a figure on your rig
	   ================================================================== */
	const REM = new Map();      // slot -> remote fighter
	function remote(slot){
		let R = REM.get(slot);
		if(R) return R;
		R = {
			slot, active: false, left: false, name: 'Mage ' + (slot + 1), hello: false, tint: null, colorIdx: COLOR_OF_SLOT[slot % 4],
			x: 0, y: 0, w: 38, h: 56, vx: 0, vy: 0, facing: -1, ground: true, hp: 1, maxHp: 1,
			aimX: 0, aimY: 0, triggers: 0, castT: 0, weapon: null, armed: false, dash: false, stun: false, parry: false, ko: false,
			atk: null, walk: 0, t: 0, flash: 0, trail: [], profile: null, rtt: 120,
			ghost: null, err: { x: 0, y: 0 }, lastRecv: 0, seq: -1, inst: Object.create(null)
		};
		R.tint = R.colorIdx === 0 ? null : hexOfIdx(R.colorIdx);
		const ENT = {
			x: 0, y: 0, w: 38, h: 56, hp: 1, maxHp: 1, dead: false, flash: 0, dots: [], stunTimer: 0, slowTimer: 0, facing: -1, vx: 0, vy: 0,
			_pvpProxy: true, _pvpSlot: slot, name: R.name,
			weaponSegment: () => R._seg || null
		};
		R.ent = ENT;
		R.owner = {
			id: 'pvp-remote-' + slot, entity: ENT,
			alive: () => R.active && !R.ko,
			facing: () => R.facing < 0 ? -1 : 1,
			// their magic only ever hurts YOU here (each client decides what hits itself), and never a teammate
			foes: () => (A.state === 'fight' && !A.down && hostile(slot, NET.slot) && typeof player !== 'undefined') ? [ player ] : [],
			allies: () => [],
			hurt: (e, dmg, info) => { if(typeof player !== 'undefined' && e === player && hostile(slot, NET.slot)) hurtMe(dmg * BAL.spell * casterPm(info), info); },
			hurtSelf: () => {},
			aim: () => ({ x: R.aimX, y: R.aimY }),
			triggers: 0,
			drain: (a) => a,      // their reserve is spent on their side
			hostOverrides: {
				getWeapon: () => R.weapon ? { id: R.weapon, name: R.weapon } : null,
				heal: (ent, amt) => {},      // their healing happens on their client (their hp arrives with their state)
				isAttacking: (e) => e === ENT ? (R.castT > 0 || !!R.atk) : (typeof MAGIC_HOST !== 'undefined' ? MAGIC_HOST.isAttacking(e) : false),
				portalStrike: () => null,
				storeMagicItem: () => 'Not yours to keep',
				casterHealth: () => R.hp / Math.max(1, R.maxHp)
			}
		};
		REM.set(slot, R);
		return R;
	}
	const remotes = () => Array.from(REM.values());
	const remoteOfEnt = (en) => en && en._pvpProxy ? REM.get(en._pvpSlot) || null : null;
	/* the fighters your spells and blows may strike right now */
	const foesOfMine = () => remotes().filter(R => R.active && !R.ko && !R.left && hostile(R.slot, NET.slot));
	/* the name to show for a slot */
	const nameOf = (s) => s === NET.slot ? 'You' : (REM.get(s) ? REM.get(s).name : 'Mage ' + (s + 1));

	/* their Magic Power, slot boosts, vows and gear: sent with each cast as one multiplier */
	function casterPm(info){
		let inst = info && info.instance;
		if(inst != null && typeof inst !== 'object'){
			const L = root.MAGIC_WORLD_REF ? root.MAGIC_WORLD_REF.instances : [];
			inst = null; for(let i = 0; i < L.length; i++) if(L[i].id === info.instance){ inst = L[i]; break; }
		}
		return (inst && inst._pm > 0) ? inst._pm : 1;
	}
	function localPm(def, res){
		let m = 1;
		try {
			const slot = root.__runeCastSlot;
			if(typeof runeCasterMult === 'function') m *= runeCasterMult(def, slot);
			if(typeof GearRuntime !== 'undefined') m *= GearRuntime.getDamageMult({ spell: def, hpPct: health / Math.max(1, maxHealth), manaPct: mana / Math.max(1, maxMana),
				cost: 0, isProjectile: true, frame: typeof gearFrame === 'number' ? gearFrame : 0, castKey: res.instance.id });
		} catch(e){ m = 1; }
		return Math.max(0.4, Math.min(3, m));
	}
	function hurtMe(dmg, info){
		if(!(dmg > 0) || A.state !== 'fight' || A.down) return;
		const f = player.iFrames; player.iFrames = 0;
		damagePlayer(dmg * (typeof runeWardMult === 'function' ? runeWardMult() : 1), (info && info.effects) || []);
		player.iFrames = Math.max(f, dmg >= 15 ? 10 : 0);
		if(info && info.x != null && typeof spawnImpact === 'function') spawnImpact(info.x, info.y, info.color || '#ffffff');
	}

	/* ---------- melee: their attacks, rebuilt from the weapon data you all have ---------- */
	function weaponDef(id){
		const MM = root.MeleeMode;
		return (MM && MM.weapons && MM.weapons[id]) || (root.MELEE_WEAPONS && root.MELEE_WEAPONS.weapons[id]) || (root.MELEE_WEAPONS && root.MELEE_WEAPONS.weapons.sword) || null;
	}
	function meleePhaseOf(A2){
		const d = A2.def, t = A2.t;
		if(t < d.startup) return 'startup';
		if(t < d.startup + d.active) return 'active';
		if(t < d.startup + d.active + (d.cancel || 0)) return 'cancel';
		if(t < d.startup + d.active + (d.cancel || 0) + (d.recovery || 0) + (A2.missExtra || 0)) return 'recovery';
		return 'done';
	}
	function remoteAttack(R, m){
		const w = weaponDef(m.w); if(!w || !w.moves || !w.moves[m.k]) return;
		const base = w.moves[m.k];
		const def = Object.assign({}, base, { hitbox: Object.assign({}, base.hitbox || {}), knockback: Object.assign({}, base.knockback || {}) });
		const late = Math.max(0, Math.min(10, Math.round((R.rtt / 2) / 16.7)));      // it started half a round trip ago
		R.atk = { key: m.k, def, t: late, aim: { x: m.ax, y: m.ay }, missExtra: 0, pulse: 0, phase: 'startup', weapon: m.w };
		R.atk.phase = meleePhaseOf(R.atk);
		R.weapon = m.w; R.armed = true;
		if(Math.abs(m.ax) > 0.16) R.facing = m.ax > 0 ? 1 : -1;
	}

	/* ---------- rune spells: a cast from another client becomes a real spell owned by that fighter ---------- */
	function remoteCast(R, c){
		if(!root.MAGIC_WORLD_REF) return;
		if(c.d) NET.defCache[c.k] = c.d;
		const def = NET.defCache[c.k];
		if(!def) return;
		const W = root.MAGIC_WORLD_REF, ENT = R.ent;
		// the spell leaves from where they stood when they cast it
		ENT.x = c.x - ENT.w / 2; ENT.y = c.y - ENT.h / 2;
		R.aimX = c.ax; R.aimY = c.ay;
		R.castT = 12;
		const prof = R.profile || (root.MagicEngine ? root.MagicEngine.deriveProfile({}) : null);
		let res = null;
		try { res = W.cast(def, { profile: prof, owner: R.owner, host: root.MAGIC_HOST_REF, spawnAt: c.sa ? { x: c.sa[0], y: c.sa[1] } : null, passive: !!c.ps }); } catch(e){ res = null; }
		if(res && res.ok){ R.inst[c.i] = res.instance; if(c.pm > 0) res.instance._pm = Math.max(0.4, Math.min(3, c.pm)); }
		A.stats.remoteCasts++;
	}
	function remoteEnd(R, i){
		const inst = R.inst[i]; if(!inst) return;
		try { root.MAGIC_WORLD_REF.endInstance(inst); } catch(e){}
		delete R.inst[i];
	}

	/* ---------- your own casts and blows going out ---------- */
	const outInst = new Map();      // your passive instances → net id (so switching one off ends their copies)
	function onLocalCast(def, opts, res){
		if(!NET.link || A.state !== 'fight' && A.state !== 'countdown') return;
		const json = JSON.stringify(def);
		const k = hash32(json) + json.length.toString(36);
		const id = ++NET.castSeq;
		const msg = { i: id, k, x: Math.round(player.x + player.w / 2), y: Math.round(player.y + player.h / 2), f: player.facing < 0 ? -1 : 1,
			ax: Math.round(mouseScreenX + camera.x), ay: Math.round(mouseScreenY + camera.y) };
		if(!NET.defSent.has(k)){ msg.d = def; NET.defSent.add(k); }
		if(opts.spawnAt) msg.sa = [ Math.round(opts.spawnAt.x), Math.round(opts.spawnAt.y) ];
		if(opts.passive){ msg.ps = 1; outInst.set(res.instance, id); }
		const pm = localPm(def, res); if(Math.abs(pm - 1) > 0.005) msg.pm = +pm.toFixed(3);
		send('rc', msg);
		A.stats.localCasts++;
	}
	function onLocalAttack(){
		const MM = root.MeleeMode; if(!MM || !MM.atk || !NET.link) return;
		const atk = MM.atk;
		if(atk.id === A.lastAtkId) return;
		A.lastAtkId = atk.id;
		const w = MM.weapon(), moves = (w && w.moves) || {};
		let key = null;
		for(const k in moves) if(moves[k] && moves[k].name === atk.def.name){ key = k; break; }
		if(!key) return;
		send('ma', { k: key, w: w.id || MM.weaponId, ax: +(atk.aim ? atk.aim.x : player.facing).toFixed(2), ay: +(atk.aim ? atk.aim.y : 0).toFixed(2), c: atk.def._charge ? +atk.def._charge.toFixed(2) : 0 });
	}
	function onLocalMeleeHit(ev){
		const R = remoteOfEnt(ev.target);
		if(!R || A.state !== 'fight' || !hostile(R.slot, NET.slot)) return;
		const kb = ev.knockback || {};
		send('mh', { d: Math.round(ev.amount * BAL.melee), kx: +((kb.x || 0) * (ev.direction || 1)).toFixed(2), ky: +(kb.y || 0).toFixed(2), du: kb.duration || 10,
			st: ev.hitstun || 8, ty: ev.attackType || 'light', id: ev.attackId, n: ev.name || '' }, R.slot);
		R.ent.flash = 8; R.flash = 8;
		A.stats.blowsLanded++;
	}
	function onMeleeHitMe(h, from){
		if(A.state !== 'fight' || A.down || !hostile(from, NET.slot)) return;
		const h0 = health, f = player.iFrames; player.iFrames = 0;
		damagePlayer(h.d, []);
		const MM = root.MeleeMode;
		if(health === h0 && MM && MM.parry && MM.parry.success){ player.iFrames = f; send('mp', { id: h.id }, from); A.banner('PARRY!', '#9fe6ff', 50); return; }
		player.iFrames = Math.max(f, 8);
		const kx = clamp((h.kx || 0) * 0.85, -16, 16), ky = clamp(h.ky || 0, -14, 8);
		if(kx || ky){ player._knockbackVx = kx; player._knockbackVy = ky; player._knockbackTimer = clamp(h.du || 12, 10, 30); player.launchVx = 0; if(ky < 0) player.onGround = false; }
		if(h.st > 0) player.stunTimer = Math.max(player.stunTimer || 0, Math.min(h.st, 18));
		if(typeof spawnImpact === 'function') spawnImpact(player.x + player.w / 2, player.y + player.h * 0.4, '#ffffff');
		if(typeof shakeScreen === 'function') shakeScreen(h.ty === 'heavy' || h.ty === 'downward' ? 6 : 3, 8);
	}
	function onParried(R){
		// your blow was parried on their side: you stagger
		const MM = root.MeleeMode;
		if(MM){ if(MM.atk && MM.endAttack) MM.endAttack(); MM.hitstun = Math.max(MM.hitstun || 0, 30); }
		player.stunTimer = Math.max(player.stunTimer || 0, 32);
		player._knockbackVx = (R && R.x + R.w / 2 > player.x + player.w / 2 ? -1 : 1) * 6; player._knockbackVy = -2; player._knockbackTimer = 12;
		A.banner('PARRIED', '#ff9a9a', 50);
	}

	/* ---------- receiving state: dead reckoning onto a ghost body, errors eased out ---------- */
	function onState(R, s){
		// [seq, x, y, vx, vy, flags, hp, mhp, ax, ay, tr, castT, w, h]
		if(!Array.isArray(s)) return;
		const seq = s[0];
		if(seq <= R.seq && R.seq - seq < 1000) return;      // late duplicate: older than what we have
		R.seq = seq;
		const fl = s[5] | 0;
		R.facing = (fl & 1) ? 1 : -1; R.ground = !!(fl & 2); R.dash = !!(fl & 4); R.stun = !!(fl & 8); R.parry = !!(fl & 16); R.armed = !!(fl & 32);
		const ko = !!(fl & 64);
		R.hp = s[6]; R.maxHp = Math.max(1, s[7]);
		R.aimX = s[8]; R.aimY = s[9]; R.triggers = s[10]; R.owner.triggers = s[10];
		if(s[11] > R.castT) R.castT = s[11];
		if(s[12]) R.weapon = s[12];
		if(s[13]) R.h = s[13];
		R.ko = ko || (multi() && A.koSlots && A.koSlots.has(R.slot));
		const wasActive = R.active;
		R.active = true; R.left = false; R.lastRecv = now();
		R.vx = s[3]; R.vy = s[4];
		// a fresh ghost from this snapshot, run forward by half a round trip
		const g = R.ghost || (R.ghost = { x: 0, y: 0, w: 38, h: 56, vx: 0, vy: 0, onGround: false, _pvpGhost: true });
		const prevX = R.x, prevY = R.y;
		g.x = s[1]; g.y = s[2]; g.vx = s[3]; g.vy = s[4]; g.h = R.h; g.w = 38; g.onGround = R.ground;
		const steps = clamp(Math.round((R.rtt / 2) / 16.7), 0, 9);
		for(let i = 0; i < steps; i++) stepGhost(g);
		if(!wasActive || Math.hypot(g.x - prevX, g.y - prevY) > 260){ R.x = g.x; R.y = g.y; R.err.x = 0; R.err.y = 0; }
		else { R.err.x = prevX - g.x; R.err.y = prevY - g.y; R.x = g.x; R.y = g.y; }
		R.snapAge = 0;
	}
	function stepGhost(g){
		if(!g.onGround) g.vy = Math.min(18, g.vy + GRAVITY);
		const pvx = g.vx;
		try { moveEntityTile(g); } catch(e){ g.x += g.vx; g.y += g.vy; }
		g.vx = pvx;
	}
	function tickRemote(R){
		if(!R.active) return;
		R.t += 1 / 60;
		R.snapAge = (R.snapAge || 0) + 1;
		const g = R.ghost;
		if(g){
			// keep running on the last known velocity for a little while, then let it settle
			if(R.snapAge > 9) g.vx *= 0.8;
			stepGhost(g);
			R.err.x *= 0.82; R.err.y *= 0.82;
			R.x = g.x + R.err.x; R.y = g.y + R.err.y;
		}
		if(Math.abs(R.vx) > 0.5 && R.ground) R.walk += Math.abs(R.vx) * 0.12;
		if(R.castT > 0) R.castT--;
		if(R.flash > 0) R.flash--;
		if(R.atk){ R.atk.t++; R.atk.phase = meleePhaseOf(R.atk); if(R.atk.phase === 'done') R.atk = null; }
		// the proxy the engine and your weapon see
		const ENT = R.ent;
		ENT.x = R.x; ENT.y = R.y; ENT.w = R.w; ENT.h = R.h; ENT.hp = Math.max(1, R.hp); ENT.maxHp = R.maxHp; ENT.facing = R.facing;
		ENT.vx = R.vx; ENT.vy = R.vy; ENT.dead = R.ko || A.state !== 'fight' || !hostile(R.slot, NET.slot); ENT.name = R.name;
		ENT._swing = R.atk && (R.atk.phase === 'startup' || R.atk.phase === 'active') ? 2 : 0;
		ENT.stunTimer = 0; ENT._kbTimer = 0; ENT.dots.length = 0;
		if(ENT.flash > 0) ENT.flash--;
		if(now() - R.lastRecv > 6000 && NET.link){ R.active = false; A.status = 'Connection to ' + R.name + ' lost…'; }
	}

	/* ---------- drawing them with your own rig ---------- */
	const POSE_KEYS = [ 'lean', 'head', 'hat', 'armF', 'armB', 'legF', 'legB', 'sword', 'shift', 'crouch' ];
	const lerpPose = (a, b, t) => { const o = {}; for(const k of POSE_KEYS){ const av = (a && a[k]) || 0, bv = (b && b[k]) || 0; o[k] = av + (bv - av) * t; } return o; };
	function basePose(R){
		if(R.ko && multi()) return { lean: -0.9, head: 0.4, hat: 0.4, armF: 1.2, armB: -1.2, legF: 0.5, legB: -0.5, sword: 0.6, shift: -6, crouch: 12 };
		if(R.stun) return { lean: -0.5, head: 0.28, hat: 0.2, armF: 0.95, armB: -1.3, legF: 0.2, legB: -0.35, sword: 0.4, shift: -4, crouch: 2 };
		if(R.dash) return { lean: 0.72, head: 0.1, hat: 0.12, armF: -0.35, armB: 0.9, legF: 1.05, legB: -0.7, sword: 0.2, shift: 3, crouch: 2 };
		if(!R.ground) return R.vy < 0 ? { lean: -0.18, head: -0.08, hat: -0.08, armF: -0.9, armB: -0.7, legF: -0.45, legB: 0.55, sword: -0.2, shift: 0, crouch: -2 }
			: { lean: 0.16, head: 0.06, hat: 0.06, armF: -0.25, armB: -0.45, legF: 0.35, legB: -0.2, sword: 0.15, shift: 0, crouch: 0 };
		if(Math.abs(R.vx) > 0.6){ const w = Math.sin(R.walk), bob = Math.abs(Math.sin(R.walk * 2)); return { lean: 0.12, head: 0.02, hat: 0.04, armF: -w * 0.55, armB: w * 0.55, legF: w * 0.95, legB: -w * 0.95, sword: 0.1, shift: 0, crouch: bob * 2 }; }
		const b = Math.sin(R.t * 4.8);
		return { lean: 0.02, head: -0.02, hat: 0, armF: 0.42 + b * 0.04, armB: 0.28, legF: 0.04, legB: -0.04, sword: 0, shift: 0, crouch: (1 - b) * 0.6 };
	}
	function remotePose(R){
		const base = basePose(R), A2 = R.atk;
		if(!A2 || !A2.def.poses) return base;
		const d = A2.def, t = A2.t, ps = d.poses;
		const eIn = (x) => x * x, eOut = (x) => 1 - (1 - x) * (1 - x);
		if(A2.phase === 'startup') return lerpPose(base, ps.windup, eOut(d.startup <= 1 ? 1 : t / d.startup));
		if(A2.phase === 'active') return lerpPose(ps.windup, ps.strike, eIn(d.active <= 1 ? 1 : (t - d.startup) / d.active));
		const span = (d.cancel || 0) + (d.recovery || 0);
		return lerpPose(ps.strike, ps.follow, eOut(clamp(span <= 1 ? 1 : (t - d.startup - d.active) / span, 0, 1)));
	}
	function remoteSwing(R, w){
		const MM = root.MeleeMode; if(!MM || !w) return null;
		const A2 = R.atk, f = R.facing || 1;
		const aim = A2 ? A2.aim : { x: f, y: 0 };
		const proxy = Object.create(MM);
		Object.assign(proxy, { atk: A2 ? { def: A2.def, t: A2.t, aim: A2.aim, missExtra: 0, pulse: 0 } : null, phase: A2 ? A2.phase : '', charge: 0 });
		proxy.weapon = () => w; proxy.sampleAim = () => aim; proxy.toArm = (vec) => -Math.atan2((vec && vec.x || 0) * f, vec && vec.y || 0);
		try { return { swing: MM.weaponSwing.call(proxy), aim }; } catch(e){ return { swing: null, aim }; }
	}
	function reachOf(w){
		if(!w || !w.moves) return 0;
		let best = 0; for(const k of [ 'g1', 'g2', 'g3' ]){ const d = w.moves[k]; if(!d || !d.hitbox) continue; best = Math.max(best, Math.hypot(d.hitbox.ox || 0, d.hitbox.oy || 0) + Math.max(18, d.hitbox.w || 36) * 0.5); }
		return best;
	}
	function drawRemote(ctx, R, camX, camY){
		if(!R.active || R.koHidden || R.left) return;
		const Rig = root.PlayerRig;
		const sx = R.x - camX, sy = R.y - camY;
		const cw = ctx.canvas.width, chh = ctx.canvas.height;
		const ally = !hostile(R.slot, NET.slot);
		const tag = R.tint || hexOfIdx(R.colorIdx);
		if(sx < -160 || sx > cw + 160 || sy < -220 || sy > chh + 160){ if(!(R.ko && multi())) drawOffscreenArrow(ctx, R, sx, sy); return; }
		const who = R._who || (R._who = { x: 0, y: 0, w: 38, h: 56, facing: 1, baseH: 56, flash: 0 });
		who.x = R.x; who.y = R.y; who.h = R.h; who.w = 38; who.facing = R.facing; who.flash = R.flash;
		const w = R.armed && R.weapon ? weaponDef(R.weapon) : null;
		const style = w ? (w.style || R.weapon) : null;
		const sw = style ? (remoteSwing(R, w) || { swing: null, aim: { x: R.facing, y: 0 } }) : { swing: null, aim: { x: R.aimX - (R.x + 19) > 0 ? 1 : -1, y: 0 } };
		ctx.save();
		if(R.ko && multi()) ctx.globalAlpha = 0.4;      // down for this round
		ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(sx + 19, sy + R.h, 20, 5, 0, 0, 7); ctx.fill();
		// a teammate stands on a soft ring of your team's colour
		if(ally){ ctx.strokeStyle = TEAM[teamOf(NET.slot) % 2].col; ctx.lineWidth = 2; ctx.globalAlpha *= 0.7; ctx.beginPath(); ctx.ellipse(sx + 19, sy + R.h, 26, 7, 0, 0, 7); ctx.stroke(); ctx.globalAlpha = R.ko && multi() ? 0.4 : 1; }
		let res = null;
		if(Rig && Rig.isReady && Rig.isReady()){
			const o = {
				state: R.ground ? (Math.abs(R.vx) > 0.6 ? 'run' : 'idle') : 'fall', grounded: R.ground, vx: R.vx, vy: R.vy,
				walkPhase: R.walk, frame: Math.floor(R.t * 60), weapon: style, swing: sw.swing, rest: !!style && !R.atk, spellHand: !style,
				castT: R.castT, castColor: '#9fe6ff', aim: { x: sw.aim.x * (R.facing || 1), y: sw.aim.y }, reachPx: style ? reachOf(w) : 0,
				squash: 0, angleLegs: !!R.atk, angleArms: !!R.atk, tint: R.tint
			};
			try { res = Rig.draw(ctx, sx, sy, who, remotePose(R), o); } catch(e){ res = null; }
		}
		if(!res && typeof drawMageSprite === 'function'){
			drawMageSprite(ctx, sx, sy, 38, R.h, { colorIdx: R.colorIdx, facing: R.facing, animState: R.ground ? (Math.abs(R.vx) > 0.6 ? 'run' : 'idle') : (R.vy < 0 ? 'jumping' : 'falling'), animFrame: Math.floor(R.t * 10) % 4, flash: R.flash });
		}
		// weapon trail and the segment the engine uses for their weapon
		if(res && res.tip && R.atk && (R.atk.phase === 'active' || R.atk.phase === 'startup')){ R.trail.push({ x: res.tip.x + camX, y: res.tip.y + camY, t: R.t }); }
		while(R.trail.length && (R.t - R.trail[0].t > 0.12 || R.trail.length > 14)) R.trail.shift();
		if(R.trail.length > 1){
			ctx.lineCap = 'round';
			for(let i = 1; i < R.trail.length; i++){ const q = i / R.trail.length; ctx.globalAlpha = q * 0.75; ctx.strokeStyle = R.tint || '#bcd4ff'; ctx.lineWidth = 2 + 6 * q; ctx.beginPath(); ctx.moveTo(R.trail[i - 1].x - camX, R.trail[i - 1].y - camY); ctx.lineTo(R.trail[i].x - camX, R.trail[i].y - camY); ctx.stroke(); }
			ctx.globalAlpha = 1;
		}
		R._seg = res && res.hand && res.tip ? { x0: res.hand.x + camX, y0: res.hand.y + camY, x1: res.tip.x + camX, y1: res.tip.y + camY } : null;
		if(R.parry){ ctx.strokeStyle = 'rgba(160,230,255,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx + 19, sy + R.h / 2, 34, 0, 7); ctx.stroke(); }
		if(R.stun){ ctx.fillStyle = '#fff8'; for(let k = 0; k < 3; k++){ const an = R.t * 5 + k * 2.1; ctx.beginPath(); ctx.arc(sx + 19 + Math.cos(an) * 12, sy - 6 + Math.sin(an) * 4, 2, 0, 7); ctx.fill(); } }
		// name and health over the head (a teammate's bar is green-edged)
		const bw = 72, bx = sx + 19 - bw / 2, by = sy - 18;
		ctx.fillStyle = ally ? '#1d4a2a' : '#000a'; ctx.fillRect(bx - 1, by - 1, bw + 2, 7);
		const pct = R.ko && multi() ? 0 : clamp(R.hp / R.maxHp, 0, 1);
		ctx.fillStyle = pct > 0.5 ? '#5be37d' : pct > 0.25 ? '#ffb14a' : '#ff4a4a'; ctx.fillRect(bx, by, bw * pct, 5);
		const label = R.name + (ally ? '  (ally)' : '') + (R.ko && multi() ? '  ✖' : '');
		ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center'; ctx.fillStyle = '#000'; ctx.fillText(label, sx + 20, by - 5); ctx.fillStyle = tag; ctx.fillText(label, sx + 19, by - 6);
		ctx.restore();
	}
	function drawOffscreenArrow(ctx, R, sx, sy){
		const cw = ctx.canvas.width, chh = ctx.canvas.height;
		const ax = clamp(sx, 40, cw - 40), ay = clamp(sy, 80, chh - 80);
		ctx.save(); ctx.fillStyle = R.tint || hexOfIdx(R.colorIdx); ctx.translate(ax, ay); ctx.rotate(Math.atan2(sy - ay, sx - ax));
		ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-10, -12); ctx.lineTo(-10, 12); ctx.fill(); ctx.restore();
	}

	/* ==================================================================
	   MATCH FLOW — lobby → host picks the map → countdown → fight → round result → …
	   A round ends when one fighter (free-for-all, 1v1) or one team (2v2) is left standing. The host referees:
	   every client reports its own knock-out, the host keeps who is still standing and calls the round.
	   ================================================================== */
	const A = {
		state: 'boot', practice: true, round: 0, score: {}, t0: 0, mapId: 'ember', seed: 1,
		status: '', banners: [], lastAtkId: 0, stats: { localCasts: 0, remoteCasts: 0, blowsLanded: 0 },
		hz: { vent: -1, icicle: {}, bolt: -1, lavaT: 0, iceVx: 0 }, rematch: { me: false, them: false }, ui: null, previewClock0: now(),
		alive: new Set(), koSlots: new Set(), down: false, lastWinner: null
	};
	A.banner = function(text, color, frames, big){ A.banners.push({ text, color: color || '#fff', t: 0, life: frames || 70, big: !!big }); };
	const mySide = () => NET.slot === 0 ? 'left' : 'right';      // legacy (old callers): slot 0 is "left"
	function clock(){ return A.state === 'fight' || A.state === 'roundEnd' ? Math.max(0, (hostNow() - A.t0) / 1000) : (now() - A.previewClock0) / 1000; }
	const hazardsLive = () => A.state === 'fight';
	/* the slots taking part: you and everyone who said hello and has not left */
	const present = () => [ NET.slot ].concat(remotes().filter(R => R.hello && !R.left).map(R => R.slot)).sort((a, b) => a - b);
	const winnerName = (key) => !key ? 'Nobody' : key[0] === 't' ? TEAM[+key.slice(1)].name : nameOf(+key.slice(1));
	const winnerColor = (key) => !key ? '#ddd' : key[0] === 't' ? TEAM[+key.slice(1)].col : slotHex(+key.slice(1));

	/* ---------- building a map into the game ---------- */
	function applyMap(id, seed){
		const map = MAP_BY_ID[id] || MAPS[0];
		A.mapId = map.id; A.seed = seed >>> 0 || 1; P.seed = A.seed; P.map = map;
		const plats = [];
		for(const s of map.solids) plats.push(Object.assign({ _pvp: true }, s));
		for(const l of map.ledges) plats.push(Object.assign({ _pvp: true, oneway: true, h: 22 }, l));
		P.plats = plats;
		// swap the arena's collision in place (other code keeps a reference to this array)
		if(typeof sandboxPlatforms !== 'undefined'){
			sandboxPlatforms.length = 0;
			for(const p of plats) sandboxPlatforms.push(p);
		}
		P.pieces = []; P.layers = null; P.layerKey = ''; P.parts.length = 0;
		A.hz = { vent: {}, icicle: {}, rock: {}, bolt: -1, lavaT: 0, iceVx: 0 };
		return map;
	}
	function ensurePieces(){
		if(P.pieces.length || !P.map || !texReady()) return P.pieces.length > 0;
		for(const p of P.plats){ if(p.invisible) continue; P.pieces.push(paintPiece(p, P.map)); }
		return true;
	}
	/* where a slot starts. Even slots start on the left, odd on the right (so 2v2 teams start together); slots 2 and 3
	   stand a little further in, on solid ground (the sky isles have gaps). Accepts the old 'left' / 'right' too. */
	function spawnSpot(map, slot){
		if(slot === 'left') slot = 0; else if(slot === 'right') slot = 1;
		slot = slot | 0;
		const base = map.spawns[slot % 2 === 0 ? 'left' : 'right'];
		if(slot < 2) return { x: base.x, y: base.y };
		const dir = slot % 2 === 0 ? 1 : -1;
		for(const off of [ 240, 180, 120, 70, -90 ]){
			const x = base.x + dir * off;
			let top = null;
			for(const p of map.solids.concat(map.ledges)){ if(x < p.x + 20 || x > p.x + p.w - 20) continue; if(p.y >= base.y - 220 && p.y <= base.y + 140 && (top == null || Math.abs(p.y - base.y) < Math.abs(top - base.y))) top = p.y; }
			if(top != null) return { x, y: top };
		}
		return { x: base.x + dir * 60, y: base.y };
	}
	function spawnPoint(slot){ const s = spawnSpot(P.map, slot); return { x: s.x - player.w / 2, y: s.y - player.h - 2 }; }
	function placeAtSpawn(){
		const s = spawnPoint(NET.slot);
		player.x = s.x; player.y = s.y; player.vx = 0; player.vy = 0; player.launchVx = 0;
		player._knockbackTimer = 0; player.stunTimer = 0; player.slowTimer = 0; player.dots = []; player.iFrames = 30;
		player.facing = NET.slot % 2 === 0 ? 1 : -1;
	}
	function resetFighters(){
		health = maxHealth; mana = maxMana;
		if(typeof updateHealthHUD === 'function') updateHealthHUD();
		if(typeof updateManaHUD === 'function') updateManaHUD();
		A.down = false; A.koSlots = new Set();
		placeAtSpawn();
		try { MAGIC_WORLD.clearOwner('player'); for(const R of remotes()) MAGIC_WORLD.clearOwner(R.owner.id); } catch(e){}
		if(typeof projectiles !== 'undefined') projectiles.length = 0;
		if(typeof enemyProjectiles !== 'undefined') enemyProjectiles.length = 0;
		for(const R of remotes()){ for(const k in R.inst) delete R.inst[k]; R.atk = null; R.ko = false; R.koHidden = false; }
		if(typeof spellCooldowns !== 'undefined') for(let i = 0; i < spellCooldowns.length; i++) spellCooldowns[i] = 0;
	}

	/* ---------- host decisions (the host referees: map, round starts, knock-outs, round results) ---------- */
	function hostSelect(id){
		const seed = (Math.random() * 1e9) | 0;
		applyMap(id, seed);
		A.score = {}; A.round = 0; A.rematch = { me: false, them: false };
		send('sel', { m: id, s: seed });
		hostStartRound(1);
		closeUI();
	}
	function hostStartRound(n){
		const t0 = hostNow() + 3200;
		const al = present();
		send('rnd', { r: n, t0, m: A.mapId, s: A.seed, sc: A.score, al, mo: NET.mode });
		startRound(n, t0, al);
	}
	function startRound(n, t0, al){
		A.round = n; A.t0 = t0; A.state = 'countdown';
		A.alive = new Set(al || present());
		resetFighters();
		// someone who joined in the middle of a round watches until the next one
		if(al && al.indexOf(NET.slot) < 0){ A.down = true; A.banner('Watching — you join next round', '#d6c8ff', 120); }
		A.banner('Round ' + n, '#ffe6a8', 90, true);
	}
	/* a fighter is down (theirs reported by them, yours by you); the host decides whether the round is over */
	function hostKO(slot){
		if(A.state !== 'fight' || !A.alive.has(slot)) return;
		A.alive.delete(slot);
		A.koSlots.add(slot);
		send('dn', { s: slot, r: A.round });
		if(slot !== NET.slot && REM.get(slot)) REM.get(slot).ko = true;
		if(multi() && slot !== NET.slot) A.banner(nameOf(slot) + ' is down', slotHex(slot), 80);
		// is one side left standing?
		const standing = new Set(Array.from(A.alive).map(s => NET.mode === 'teams' ? 't' + (s % 2) : 's' + s));
		if(standing.size <= 1) hostResult(standing.size ? Array.from(standing)[0] : null);
	}
	function hostResult(winKey){
		if(A.state !== 'fight') return;
		if(winKey) A.score[winKey] = (A.score[winKey] || 0) + 1;
		const over = !!winKey && A.score[winKey] >= ROUNDS_TO_WIN;
		send('res', { r: A.round, w: winKey, sc: A.score, over: over ? 1 : 0 });
		showResult(winKey, over);
		if(!over) setTimeout(() => { if(A.state === 'roundEnd') hostStartRound(A.round + 1); }, 2600);
	}
	function showResult(winKey, over){
		A.state = over ? 'over' : 'roundEnd';
		A.lastWinner = winKey;
		const iWon = !!winKey && winKey === scoreKey(NET.slot);
		let text;
		if(!winKey) text = over ? 'DRAW' : 'Draw — no one standing';
		else if(iWon) text = over ? 'VICTORY' : 'Round won';
		else if(!multi()) text = over ? 'DEFEAT' : 'Round lost';
		else text = over ? winnerName(winKey) + ' wins the match' : winnerName(winKey) + ' takes the round';
		A.banner(text, iWon ? '#8dffb0' : (winKey ? (multi() ? winnerColor(winKey) : '#ff8a8a') : '#dddddd'), over ? 99999 : 140, true);
		for(const R of remotes()) if(!R.ko) R.koHidden = false;
		if(over) setTimeout(() => openResults(iWon), 1200);
	}
	function onLocalKO(){
		if(A.practice){
			A.banner('Down! Back to your spawn', '#ffb0b0', 80);
			setTimeout(() => { health = maxHealth; mana = maxMana; placeAtSpawn(); if(typeof updateHealthHUD === 'function') updateHealthHUD(); }, 900);
			return;
		}
		if(A.state !== 'fight' || A.down) return;
		A.down = true;
		if(multi()) A.banner('You are down — watching the rest of the round', '#ffb0b0', 140);
		if(NET.host) hostKO(NET.slot);
		else send('ko', { r: A.round }, 0);
		player.iFrames = 9999;
	}
	function onPeerLeft(slot){
		const R = REM.get(slot);
		if(!R || R.left) return;
		R.left = true; R.active = false;
		A.status = '';
		A.banner(R.name + ' left the arena', '#ffd0a0', 140);
		if(slot === 0 && !NET.host){ A.status = 'The host left the arena'; return; }
		if(NET.host){
			if(A.state === 'fight') hostKO(slot);
			if(present().length < 2 && (A.state === 'fight' || A.state === 'countdown' || A.state === 'roundEnd')){ A.status = 'Everyone else left the arena'; }
		}
	}

	/* ---------- messages ---------- */
	function hello(to){
		const prof = (typeof magicProfileForGame === 'function') ? magicProfileForGame() : null;
		send('h', { n: (root.CloudSave && root.CloudSave.displayName) || 'Mage', p: prof, c: slotHex(NET.slot), v: 3, sl: NET.slot }, to);
	}
	function lobbyCheck(){
		// the host opens the map picker once everyone in the match has said hello (or after a wait, with whoever came)
		if(!NET.host || A.state !== 'lobby') return;
		const got = remotes().filter(R => R.hello && !R.left).length;
		const waited = NET.lobbyT && now() - NET.lobbyT > 20000;
		if(got >= NET.n - 1 || (waited && got >= 1)){ A.state = 'select'; A.status = ''; openPicker(); }
		else A.status = 'Waiting for players… ' + (got + 1) + ' / ' + NET.n;
	}
	function onEvent(k, d, from){
		if(typeof from !== 'number') from = NET.slot === 0 ? 1 : 0;      // a legacy sender without a slot
		if(from === NET.slot) return;
		const R = remote(from);
		switch(k){
			case 's': onState(R, d); break;
			case 'h': {
				const first = !R.hello;
				R.seq = -1;      // a new session of theirs starts its packet count again
				R.hello = true; R.left = false; R.name = (d && d.n) || ('Mage ' + (from + 1)); R.ent.name = R.name; R.profile = d && d.p || null;
				if(first) hello(from);      // answer once, to them only
				if(NET.host){
					if(A.state === 'lobby') lobbyCheck();
					else if(A.state === 'fight' || A.state === 'countdown' || A.state === 'roundEnd'){
						send('sel', { m: A.mapId, s: A.seed }, from);
						send('rnd', { r: A.round, t0: A.t0, m: A.mapId, s: A.seed, sc: A.score, al: Array.from(A.alive), mo: NET.mode }, from);
					} else if(A.state === 'select' && A.ui) openPicker();      // refresh the "who is here" line
				} else if(from === 0 && A.state === 'lobby'){ A.state = 'select'; openWaiting(); }
				if(!NET.host || A.state !== 'lobby') A.status = '';
				break;
			}
			case 'pi': send('po', { t: d.t, h: now() }, from); break;
			case 'po': {
				const rtt = now() - d.t;
				if(rtt > 0 && rtt < 3000){
					R.rtt = R.rtt * 0.7 + rtt * 0.3;
					if(from === 0 || NET.host) NET.rtt = NET.host ? (remotes().reduce((s, q) => s + q.rtt, 0) / Math.max(1, REM.size)) : R.rtt;
					// the best (lowest-latency) samples from the host give the truest clock offset
					if(from === 0 && !NET.host && (rtt <= NET.rttMin * 1.25 || NET.rttMin === 1e9)){
						NET.rttMin = Math.min(NET.rttMin, rtt);
						const off = d.h - (d.t + rtt / 2); NET.offset = NET.offsetSet ? NET.offset * 0.6 + off * 0.4 : off; NET.offsetSet = true;
					}
				}
				break;
			}
			case 'sel': if(!NET.host && from === 0){ applyMap(d.m, d.s); closeUI(); } break;
			case 'rnd':
				if(!NET.host && from === 0){
					if(d.mo) NET.mode = d.mo;
					if(A.mapId !== d.m || A.seed !== (d.s >>> 0)) applyMap(d.m, d.s);
					A.score = Array.isArray(d.sc) ? { s0: d.sc[0], s1: d.sc[1] } : (d.sc || {});
					closeUI(); startRound(d.r, d.t0, d.al);
				}
				break;
			case 'res': if(!NET.host && from === 0){ A.score = Array.isArray(d.sc) ? { s0: d.sc[0], s1: d.sc[1] } : (d.sc || {}); showResult(typeof d.w === 'string' && d.w[0] !== 'l' && d.w[0] !== 'r' ? d.w : (d.w === 'left' ? 's0' : d.w === 'right' ? 's1' : d.w), !!d.over); } break;
			case 'dn': if(!NET.host && from === 0 && d.r === A.round){ A.koSlots.add(d.s); if(d.s === NET.slot) A.down = true; else if(REM.get(d.s)){ REM.get(d.s).ko = true; if(multi()) A.banner(nameOf(d.s) + ' is down', slotHex(d.s), 80); } } break;
			case 'ko': if(NET.host && d.r === A.round) hostKO(from); break;
			case 'rc': remoteCast(R, d); break;
			case 'rx': remoteEnd(R, d.i); break;
			case 'ma': remoteAttack(R, d); break;
			case 'mh': onMeleeHitMe(d, from); break;
			case 'mp': onParried(R); break;
			case 'rq':
				A.rematch.them = true;
				if(NET.host){ A.banner(R.name + ' wants a rematch', '#ffe6a8', 120); if(A.rematch.me){ A.state = 'select'; openPicker(); } }
				break;
			case 'cast': if(d && A.state === 'fight' && hostile(from, NET.slot)) spawnRemoteCast(d, '_pvpRemote'); break;      // the old phase spells
			case 'hit': if(A.state === 'fight' && !A.down && hostile(from, NET.slot)) damagePlayer((d && d.dmg) || 10, (d && d.effects) || null); break;
			case 'bye': onPeerLeft(from); break;
		}
	}
	function sendState(force){
		const t = now();
		const MM = root.MeleeMode;
		const fl = (player.facing > 0 ? 1 : 0) | (player.onGround ? 2 : 0) | (MM && MM.dash && MM.dash.t > 0 ? 4 : 0) | (player.stunTimer > 0 ? 8 : 0)
			| (MM && MM.parry && MM.parry.t > 0 ? 16 : 0) | (MM && MM.armed ? 32 : 0) | (health <= 0 || A.down ? 64 : 0);
		const s = [ ++NET.seq, Math.round(player.x), Math.round(player.y), +player.vx.toFixed(2), +player.vy.toFixed(2), fl,
			Math.max(0, Math.round(A.down ? 0 : health)), Math.round(maxHealth), Math.round(mouseScreenX + camera.x), Math.round(mouseScreenY + camera.y),
			root.__magicTriggers || 0, player.castTimer || 0, MM && MM.armed ? MM.weaponId : 0, player.h ];
		// skip a packet that says nothing new (still sent now and then as a heartbeat)
		const key = s.slice(1).join(',');
		if(!force && key === NET.lastKey && t - NET.lastSend < 300) return;
		NET.lastKey = key; NET.lastSend = t;
		send('s', s);
	}
	let lastSharp = { vx: 0, vy: 0, f: 1, g: true };
	function netTick(){
		if(!NET.link) return;
		const t = now();
		if(NET.link.transport) NET.transport = NET.link.transport();
		// a sharp change (jump, landing, turning, stopping) goes out at once; otherwise 20–30 per second (a little less with more players)
		const sharp = Math.sign(player.vx) !== Math.sign(lastSharp.vx) || (player.vy < -4 && lastSharp.vy >= 0) || player.onGround !== lastSharp.g || player.facing !== lastSharp.f;
		lastSharp = { vx: player.vx, vy: player.vy, f: player.facing, g: player.onGround };
		const every = (NET.transport === 'p2p' ? 33 : 50) + (NET.n > 2 ? (NET.n - 2) * 6 : 0);
		if(sharp && t - NET.lastSend > 25) sendState(true);
		else if(t - NET.lastSend >= every) sendState(false);
		if(t - NET.pingT > (NET.fastPings > 0 ? 120 : (NET.offsetSet || NET.host ? 1000 : 250))){ NET.pingT = t; if(NET.fastPings > 0) NET.fastPings--; send('pi', { t }); }
		if(t - NET.rate0 > 1000){ NET.mps = NET.msgs; NET.msgs = 0; NET.rate0 = t; }
		onLocalAttack();
		lobbyCheck();
		// passive spells you switched off end on their side too
		for(const [inst, id] of outInst){ if(inst.done){ send('rx', { i: id }); outInst.delete(inst); } }
	}

	/* ---------- hazards on YOUR fighter (each client runs them for itself, on the shared clock) ---------- */
	function onIce(){
		if(!player.onGround) return false;
		const fx = player.x + player.w / 2, fy = player.y + player.h;
		for(const p of P.plats){ if(p.ice && fx >= p.x && fx <= p.x + p.w && Math.abs(fy - p.y) < 6) return true; }
		if(P.map.iceZones && Math.abs(fy - 2000) < 6) for(const z of P.map.iceZones) if(fx >= z.x0 && fx <= z.x1) return true;
		return false;
	}
	function hazardsTick(){
		const map = P.map; if(!map || !hazardsLive()) return;
		const c = clock(), px = player.x + player.w / 2, feet = player.y + player.h;
		const prect = { x: player.x, y: player.y, w: player.w, h: player.h };
		if(map.lava){
			for(const L of map.lava){
				if(px > L.x0 && px < L.x1 && feet > L.y - 6){
					A.hz.lavaT -= 1 / 60;
					if(A.hz.lavaT <= 0){ A.hz.lavaT = map.hazards.lava.every; damagePlayer(map.hazards.lava.dmg, []); if(typeof spawnImpact === 'function') spawnImpact(px, L.y, '#ff8a1e'); }
					player.vy = map.hazards.lava.bounce; player.onGround = false; player._knockbackTimer = 0;
				}
			}
		}
		(map.vents || []).forEach((v, vi) => {
			const st = ventState(map, c, v, vi);
			const k = Math.floor((c - vi * map.hazards.vent.period * 0.5) / map.hazards.vent.period);
			if(st.burst > 0 && st.burst < 0.45 && Math.abs(px - v.x) < 52 && feet > 1450 && feet < 2010 && A.hz.vent[vi] !== k){
				A.hz.vent[vi] = k;
				player._knockbackVx = 0; player._knockbackVy = map.hazards.vent.launch; player._knockbackTimer = 16; player.onGround = false;
				damagePlayer(map.hazards.vent.dmg, []);
			}
		});
		if(map.icicles){
			const st = icicleState(map, c);
			if(st.fallT >= 0) st.xs.forEach((x, i) => {
				const y = icicleY(map, st.fallT), key = st.k + ':' + i;
				if(A.hz.icicle[key] || y > floorAt(x) + 10) return;
				if(x + 9 > prect.x && x - 9 < prect.x + prect.w && y + 28 > prect.y && y - 46 < prect.y + prect.h){
					A.hz.icicle[key] = 1;
					damagePlayer(map.hazards.icicle.dmg, []);
					player.slowTimer = Math.max(player.slowTimer || 0, map.hazards.icicle.slow);
					if(typeof spawnImpact === 'function') spawnImpact(x, y, '#dff4ff');
				}
			});
		}
		if(map.hazards.rock){
			const st = rockState(map, c);
			if(st.fallT >= 0) st.xs.forEach((x, i) => {
				const y = rockY(x, st.fallT), key = st.k + ':' + i;
				if(A.hz.rock[key] || y > floorAt(x) + 10) return;
				if(x + 22 > prect.x && x - 22 < prect.x + prect.w && y + 22 > prect.y && y - 22 < prect.y + prect.h){
					A.hz.rock[key] = 1;
					damagePlayer(map.hazards.rock.dmg, []);
					player.stunTimer = Math.max(player.stunTimer || 0, map.hazards.rock.stun);
					if(typeof shakeScreen === 'function') shakeScreen(5, 8);
					if(typeof spawnImpact === 'function') spawnImpact(x, y, '#b8ad96');
				}
			});
		}
		if(map.hazards.bolt){
			const st = boltState(map, c);
			if(st && st.strike >= 0 && st.strike < 0.12 && A.hz.bolt !== st.k && Math.abs(px - st.x) < map.hazards.bolt.halfW + player.w / 2 && feet <= floorAt(st.x) + 8){
				A.hz.bolt = st.k;
				damagePlayer(map.hazards.bolt.dmg, []);
				player.stunTimer = Math.max(player.stunTimer || 0, map.hazards.bolt.stun);
				if(typeof shakeScreen === 'function') shakeScreen(6, 10);
			}
		}
		if(map.voidY && player.y > map.voidY){
			const s = spawnPoint(NET.slot);
			player.x = s.x; player.y = s.y; player.vx = 0; player.vy = 0; player._knockbackTimer = 0; player.launchVx = 0;
			player.iFrames = 45;
			A.banner('The fall costs you', '#d6c8ff', 60);
			const f = player.iFrames; player.iFrames = 0; damagePlayer(Math.round(maxHealth * 0.12), []); player.iFrames = Math.max(f, 45);
		}
	}
	function afterMove(){
		if(!P.map || typeof player === 'undefined') return;
		// polished ice: you keep your speed and turn slowly
		if(P.map.id === 'frost' && player._knockbackTimer <= 0){
			if(onIce()){ player.vx = A.hz.iceVx + (player.vx - A.hz.iceVx) * 0.07; }
			A.hz.iceVx = player.vx;
		}
		// storm gusts push you
		if(P.map.id === 'storm' && hazardsLive()){
			const g = gustState(P.map, clock());
			// a steady shove, not a cannon: it builds your drift up to a cap (lower in the air, where nothing slows it),
			// and only slows you down when you move against it
			if(g.on > 0){
				const add = g.dir * P.map.hazards.gust.push * g.on * (player.onGround ? 0.45 : 0.22);
				const cap = player.onGround ? 4.5 : 2.6;
				const along = player.vx * g.dir;
				if(along < cap) player.vx = g.dir * Math.min(cap, along + Math.abs(add));
			}
		}
	}

	/* ---------- the legacy phase spells (old projectiles) hitting the opponent ---------- */
	function legacyHits(){
		if(A.state !== 'fight' || A.down || typeof projectiles === 'undefined' || typeof projectileHitsRect !== 'function') return;
		const foes = foesOfMine(); if(!foes.length) return;
		for(let i = 0; i < projectiles.length; i++){
			const p = projectiles[i];
			if(!p || p.hasHit || p._pvpRemote || p.isSolidPlatform || (p.phase && p.phase.noHit) || p.shape === 'allyOrb' || p.behavior === 'selfCast') continue;
			for(const R of foes){
				if(!projectileHitsRect(p, { x: R.x, y: R.y, w: R.w, h: R.h })) continue;
				const dmg = Math.max(4, Math.round((p.power || 10) * 8));
				if(!p._fromDomain) send('hit', { dmg, effects: (p.effects && p.effects.length) ? p.effects : null }, R.slot);
				if(typeof spawnImpact === 'function') spawnImpact(p.x, p.y, p.color);
				dmgNumbers.push({ x: R.x + R.w / 2, y: R.y - 10, text: Math.round(dmg) + '', age: 0, color: p.color });
				R.flash = 12;
				p.hasHit = true;
				break;
			}
		}
	}

	/* ==================================================================
	   UI — map picker (host), waiting card (guest), results; the HUD on the canvas
	   ================================================================== */
	function css(){
		if(document.getElementById('pvp-arena-css')) return;
		const st = document.createElement('style'); st.id = 'pvp-arena-css';
		st.textContent = `
.pa-back{position:fixed;inset:0;z-index:60;background:radial-gradient(ellipse at 50% 30%,rgba(30,18,50,.82),rgba(4,4,10,.92));display:flex;flex-direction:column;align-items:center;justify-content:center;font:14px Georgia,'Times New Roman',serif;color:#efe6d2}
.pa-title{font-size:30px;letter-spacing:3px;color:#ffe6a8;text-shadow:0 2px 12px #000;margin-bottom:4px}
.pa-sub{color:#b9ad96;margin-bottom:22px;font-style:italic}
.pa-cards{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;max-width:96vw}
.pa-card{width:228px;border-radius:14px;overflow:hidden;background:#15121d;border:1px solid #3a3150;box-shadow:0 10px 30px #000a;cursor:pointer;transition:transform .15s,border-color .15s,box-shadow .15s}
.pa-card:hover{transform:translateY(-4px)}
.pa-card canvas{display:block;width:228px;height:130px}
.pa-card .pa-body{padding:12px 14px 14px}
.pa-card b{font-size:16px;display:block;margin-bottom:2px}
.pa-card .pa-el{font:bold 11px Arial;letter-spacing:2px;text-transform:uppercase}
.pa-card p{margin:6px 0 0;font-size:12px;line-height:1.4;color:#c9bfae}
.pa-card.dim{cursor:default;opacity:.55}
.pa-card.pick{opacity:1;transform:translateY(-4px)}
.pa-btns{display:flex;gap:12px;margin-top:22px}
.pa-btn{font:bold 14px Arial;padding:10px 22px;border-radius:9px;border:1px solid #6a5a8a;background:#241d36;color:#efe6ff;cursor:pointer}
.pa-btn.main{background:linear-gradient(#7a52d6,#4b2f9a);border-color:#b39cff}
.pa-spar{display:flex;gap:8px;margin-top:16px;flex-wrap:wrap;justify-content:center}
.pa-spar .pa-btn{font-size:12px;padding:7px 12px}`;
		document.head.appendChild(st);
	}
	function stopAll(el){ ['mousedown', 'mouseup', 'pointerdown', 'pointerup', 'click', 'wheel', 'keydown', 'keyup', 'contextmenu'].forEach(ev => el.addEventListener(ev, e => e.stopPropagation())); }
	function closeUI(){ if(A.ui){ A.ui.remove(); A.ui = null; } }
	/* ---------- map previews: the arena drawn by the real renderer, from where the fight starts ----------
	   The whole arena state (map, pieces, layers, particles, camera) is swapped out for one frame on an
	   offscreen canvas, then put back, so a preview is exactly what you will see in the fight. */
	const SNAP_W = 2000, SNAP_H = 1140, snapCache = {};
	function snapCamera(map, vw, vh){
		const c = map.cam, L = map.spawns.left, Rr = map.spawns.right;
		const mx = (L.x + Rr.x) / 2, my = Math.max(L.y, Rr.y) - 40;
		const cx = (c.x1 - c.x0) <= vw ? (c.x0 + c.x1 - vw) / 2 : clamp(mx - vw / 2, c.x0, c.x1 - vw);
		const cy = (c.y1 - c.y0) <= vh ? c.y1 - vh : clamp(my - vh * Math.max(0.74, map.camBias || 0), c.y0, c.y1 - vh);
		return { x: cx, y: cy };
	}
	function snapFloorAt(map, x, yRef){
		let best = null;
		for(const q of map.solids.concat(map.ledges)){
			if(q.wall || q.invisible || q.ceiling || x < q.x + 20 || x > q.x + q.w - 20) continue;
			if(q.y < yRef - 420 || q.y > yRef + 260) continue;
			if(map.lava && map.lava.some(l => x > l.x0 && x < l.x1 && q.y >= l.y - 4)) continue;
			if(best == null || Math.abs(q.y - yRef) < Math.abs(best - yRef)) best = q.y;
		}
		return best;
	}
	function drawSnapFighter(g, x, y, col){
		// a robed caster silhouette with a rim of team colour
		g.save(); g.translate(x, y);
		const glow = g.createRadialGradient(0, -34, 4, 0, -34, 70); glow.addColorStop(0, col + '55'); glow.addColorStop(1, col + '00');
		g.fillStyle = glow; g.fillRect(-70, -104, 140, 140);
		g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(0, 1, 22, 5, 0, 0, 7); g.fill();
		g.fillStyle = '#1b1626'; g.strokeStyle = col; g.lineWidth = 2.5;
		g.beginPath(); g.moveTo(-17, 0); g.lineTo(-11, -40); g.lineTo(11, -40); g.lineTo(17, 0); g.closePath(); g.fill(); g.stroke();
		g.beginPath(); g.arc(0, -47, 9, 0, 7); g.fill(); g.stroke();
		g.beginPath(); g.moveTo(-16, -53); g.lineTo(16, -53); g.lineTo(2, -84); g.closePath(); g.fill(); g.stroke();
		g.restore();
	}
	function renderSnap(map){
		if(!texReady()) return null;
		const cv = mkCanvas(SNAP_W, SNAP_H), g = cv.getContext('2d');
		const keep = { map: P.map, plats: P.plats, pieces: P.pieces, layers: P.layers, layerKey: P.layerKey, parts: P.parts, sunCv: P.sunCv, flash: P.flash };
		const cam0 = { x: camera.x, y: camera.y };
		try {
			P.snap = true; P.map = map; P.flash = 0; P.parts = []; P.sunCv = null; P.layers = null; P.layerKey = '';
			P.plats = map.solids.map(s2 => Object.assign({ _pvp: true }, s2)).concat(map.ledges.map(l => Object.assign({ _pvp: true, oneway: true, h: 22 }, l)));
			P.pieces = (keep.map === map && keep.pieces.length) ? keep.pieces : [];
			const c = snapCamera(map, SNAP_W, SNAP_H); camera.x = c.x; camera.y = c.y;
			drawBack(g);
			for(const sd of [ 'left', 'right' ]){
				// each fighter at their spawn, or pulled into the picture onto the nearest floor
				const sp = map.spawns[sd], fx = clamp(sp.x, c.x + 170, c.x + SNAP_W - 170), fy = fx === sp.x ? sp.y : snapFloorAt(map, fx, sp.y);
				if(fy != null) drawSnapFighter(g, fx - c.x, fy - c.y, sd === 'left' ? '#5aa0ff' : '#ff5a6a');
			}
			drawFront(g);
		} catch(e){ console.warn('arena preview', e); }
		finally {
			P.snap = false; camera.x = cam0.x; camera.y = cam0.y;
			Object.assign(P, keep);
		}
		return cv;
	}
	function preview(map, w, h){
		const S = 2;      // drawn at twice the card size, so it stays sharp
		const cv = mkCanvas(w * S, h * S); cv.style.width = w + 'px'; cv.style.height = h + 'px';
		const put = (src) => {
			const g = cv.getContext('2d');
			// step down in halves for a clean downscale
			let cur = src;
			while(cur.width / 2 >= cv.width * 1.1){ const nx = mkCanvas(cur.width / 2, cur.height / 2); const ng = nx.getContext('2d'); ng.imageSmoothingQuality = 'high'; ng.drawImage(cur, 0, 0, nx.width, nx.height); cur = nx; }
			g.imageSmoothingQuality = 'high'; g.drawImage(cur, 0, 0, cv.width, cv.height);
		};
		const tryDraw = (n) => {
			if(!cv.isConnected && n > 3) return;      // the picker closed
			const snap = snapCache[map.id] || (snapCache[map.id] = renderSnap(map));
			if(snap){ put(snap); return; }
			// textures still loading: a quick colour sketch now, the real picture when they arrive
			if(n === 0){ const g = cv.getContext('2d'); const L = paintLayers(map, cv.width, cv.height); g.drawImage(L.sky, 0, 0); g.drawImage(L.far, 0, 0); g.drawImage(L.mid, 0, 0); }
			setTimeout(() => tryDraw(n + 1), 250);
		};
		tryDraw(0);
		return cv;
	}
	function cards(host, onPick){
		const wrap = document.createElement('div'); wrap.className = 'pa-cards';
		for(const m of MAPS){
			const c = document.createElement('div'); c.className = 'pa-card' + (host ? '' : ' dim'); c.dataset.map = m.id;
			c.style.borderColor = m.accent + '66';
			c.appendChild(preview(m, 228, 130));
			const b = document.createElement('div'); b.className = 'pa-body';
			b.innerHTML = '<span class="pa-el" style="color:' + m.accent + '">' + m.element + '</span><b>' + m.name + '</b><p>' + m.blurb + '</p>';
			c.appendChild(b);
			if(host) c.addEventListener('click', () => onPick(m.id));
			c.addEventListener('mouseenter', () => { c.style.boxShadow = '0 10px 34px ' + m.accent + '55'; c.style.borderColor = m.accent; });
			c.addEventListener('mouseleave', () => { c.style.boxShadow = ''; c.style.borderColor = m.accent + '66'; });
			wrap.appendChild(c);
		}
		return wrap;
	}
	function openPicker(){
		css(); closeUI();
		const back = document.createElement('div'); back.className = 'pa-back'; stopAll(back);
		back.innerHTML = '<div class="pa-title">CHOOSE THE ARENA</div><div class="pa-sub">' + (A.practice ? 'Practice — pick a map to train on' : 'You are the host. ' + (multi() ? MODE_NAME[NET.mode] + ' — ' + present().map(nameOf).join(', ') : nameOf(1) + ' fights where you choose.')) + '</div>';
		back.appendChild(cards(true, (id) => A.practice ? practiceStart(id) : hostSelect(id)));
		if(A.practice && root.RuneMages){
			const sp = document.createElement('div'); sp.className = 'pa-spar';
			sp.innerHTML = '<span style="align-self:center;color:#b9ad96;font-style:italic">Sparring partner after you pick: </span>';
			for(const k of [ 'none', 'kael', 'sythe', 'brannoc', 'vesk', 'sola' ]){
				const K = root.RuneMages.KINDS[k];
				const b = document.createElement('button'); b.className = 'pa-btn' + (A.spar === k || (!A.spar && k === 'none') ? ' main' : '');
				b.textContent = K ? K.name : 'None';
				b.onclick = () => { A.spar = k; sp.querySelectorAll('.pa-btn').forEach(x => x.classList.remove('main')); b.classList.add('main'); };
				sp.appendChild(b);
			}
			back.appendChild(sp);
		}
		const btns = document.createElement('div'); btns.className = 'pa-btns';
		const leave = document.createElement('button'); leave.className = 'pa-btn'; leave.textContent = 'Leave arena'; leave.onclick = () => { location.href = 'index.html'; };
		btns.appendChild(leave); back.appendChild(btns);
		document.body.appendChild(back); A.ui = back;
	}
	function openWaiting(){
		css(); closeUI();
		const back = document.createElement('div'); back.className = 'pa-back'; stopAll(back);
		back.innerHTML = '<div class="pa-title">THE HOST IS CHOOSING</div><div class="pa-sub">' + nameOf(0) + ' picks the arena' + (multi() ? ' · ' + MODE_NAME[NET.mode] + ', ' + NET.n + ' fighters' : '') + ' — get ready.</div>';
		back.appendChild(cards(false));
		document.body.appendChild(back); A.ui = back;
	}
	function openResults(iWon){
		css(); closeUI();
		const back = document.createElement('div'); back.className = 'pa-back'; stopAll(back);
		const wk = A.lastWinner;
		back.innerHTML = '<div class="pa-title" style="color:' + (iWon ? '#8dffb0' : '#ff9a9a') + '">' + (iWon ? 'VICTORY' : multi() && wk ? winnerName(wk).toUpperCase() + ' WINS' : 'DEFEAT') + '</div>' +
			'<div class="pa-sub">' + MAP_BY_ID[A.mapId].name + ' · ' + standingsText() + '</div>';
		const btns = document.createElement('div'); btns.className = 'pa-btns';
		const again = document.createElement('button'); again.className = 'pa-btn main'; again.textContent = NET.host ? 'Rematch (choose map)' : 'Ask for a rematch';
		again.onclick = () => {
			A.rematch.me = true; send('rq', {});
			if(NET.host){ A.state = 'select'; openPicker(); }
			else { again.textContent = 'Waiting for the host…'; again.disabled = true; }
		};
		const leave = document.createElement('button'); leave.className = 'pa-btn'; leave.textContent = 'Leave'; leave.onclick = () => { send('bye', {}); location.href = 'index.html'; };
		btns.appendChild(again); btns.appendChild(leave); back.appendChild(btns);
		document.body.appendChild(back); A.ui = back;
	}

	/* ---------- practice ---------- */
	function practiceStart(id){
		applyMap(id, (Math.random() * 1e9) | 0);
		closeUI();
		A.round = 1; A.t0 = hostNow() + 2200; A.state = 'countdown';
		resetFighters();
		A.banner('Practice — ' + MAP_BY_ID[id].name, '#ffe6a8', 110, true);
		if(root.RuneMages && root.RuneMages.list){
			root.RuneMages.clear();
			if(A.spar && A.spar !== 'none' && root.RuneMages.KINDS[A.spar]){
				// on the sky isles a ground fighter can't cross the gaps: the partner waits on the middle isle
				const s = P.map.voidY ? { x: 2450, y: 1950 } : P.map.spawns.right;
				setTimeout(() => { try { root.RuneMages.spawn(A.spar, s.x, s.y - 4); } catch(e){} }, 2300);
			}
		}
		if(!A.changeBtn){
			const b = document.createElement('button'); b.className = 'pa-btn'; css();
			b.textContent = '⚔ Change arena'; b.style.cssText = 'position:fixed;top:52px;right:14px;z-index:30;font:bold 13px Arial;padding:8px 14px;border-radius:8px;border:1px solid #b48cff;background:#2b1846;color:#f3e8ff;cursor:pointer';
			stopAll(b); b.onclick = () => { if(root.RuneMages) root.RuneMages.clear(); A.state = 'select'; openPicker(); };
			document.body.appendChild(b); A.changeBtn = b;
		}
	}

	/* ---------- the standings (3–4 fighters): a row per fighter, grouped by team in 2v2 ---------- */
	const MODE_NAME = { duel: '1v1', ffa: 'Free-for-all', teams: '2v2 Teams' };
	function standingsText(){
		if(!multi()){ const o = remotes().find(R => !R.left); return (A.score[scoreKey(NET.slot)] || 0) + ' – ' + (o ? A.score[scoreKey(o.slot)] || 0 : 0); }
		if(NET.mode === 'teams') return TEAM[0].name + ' ' + (A.score.t0 || 0) + ' – ' + (A.score.t1 || 0) + ' ' + TEAM[1].name;
		return present().map(s => nameOf(s) + ' ' + (A.score['s' + s] || 0)).join(' · ');
	}
	function drawStandings(ctx, vw, map){
		const slots = present().concat(remotes().filter(R => R.left && R.hello).map(R => R.slot)).filter((v, i, a) => a.indexOf(v) === i);
		const order = NET.mode === 'teams' ? slots.slice().sort((a, b) => (a % 2) - (b % 2) || a - b) : slots.slice().sort((a, b) => a - b);
		const colW = Math.min(160, (Math.min(680, vw - 40)) / Math.max(2, order.length)), W = colW * order.length, x0 = (vw - W) / 2, y0 = 52, H = NET.mode === 'teams' ? 64 : 50;
		ctx.fillStyle = 'rgba(8,6,14,0.74)'; ctx.fillRect(x0 - 8, y0, W + 16, H);
		ctx.strokeStyle = (map ? map.accent : '#888') + '99'; ctx.strokeRect(x0 - 7.5, y0 + 0.5, W + 15, H - 1);
		ctx.font = 'bold 11px Arial'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffe6a8';
		ctx.fillText(MODE_NAME[NET.mode].toUpperCase() + ' · ROUND ' + Math.max(1, A.round) + ' · FIRST TO ' + ROUNDS_TO_WIN, vw / 2, y0 + 12);
		order.forEach((s, i) => {
			const bx = x0 + i * colW + 6, bw = colW - 12, me = s === NET.slot, R = REM.get(s);
			const hp = me ? (A.down ? 0 : health / maxHealth) : R ? (R.ko ? 0 : R.hp / R.maxHp) : 0;
			const down = me ? A.down : !R || R.ko || R.left;
			const col = slotHex(s);
			ctx.globalAlpha = down ? 0.5 : 1;
			ctx.fillStyle = col; ctx.beginPath(); ctx.arc(bx + 5, y0 + 23, 4, 0, 7); ctx.fill();
			ctx.textAlign = 'left'; ctx.font = (me ? 'bold ' : '') + '12px Arial'; ctx.fillStyle = '#efe6d2';
			let nm = (me ? 'You' : (R ? R.name : 'Mage')) + (R && R.left ? ' (left)' : down ? ' ✖' : '');
			while(ctx.measureText(nm).width > bw - 40 && nm.length > 4) nm = nm.slice(0, -2);
			ctx.fillText(nm, bx + 13, y0 + 27);
			ctx.fillStyle = '#000'; ctx.fillRect(bx, y0 + 32, bw, 7);
			ctx.fillStyle = col; ctx.fillRect(bx, y0 + 32, bw * clamp(hp, 0, 1), 7);
			if(NET.mode !== 'teams') for(let k = 0; k < ROUNDS_TO_WIN; k++){ ctx.fillStyle = k < (A.score['s' + s] || 0) ? '#ffd56a' : 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.arc(bx + bw - 6 - k * 11, y0 + 23, 4, 0, 7); ctx.fill(); }
			ctx.globalAlpha = 1;
		});
		if(NET.mode === 'teams') for(let tm = 0; tm < 2; tm++){
			const idx = order.map((s, i) => s % 2 === tm ? i : -1).filter(i => i >= 0); if(!idx.length) continue;
			const cx = x0 + (idx[0] + idx[idx.length - 1] + 1) / 2 * colW;
			ctx.font = 'bold 11px Arial'; ctx.textAlign = 'center'; ctx.fillStyle = TEAM[tm].col;
			ctx.fillText(TEAM[tm].name + (tm === teamOf(NET.slot) ? ' (yours)' : ''), cx - 30, y0 + 55);
			for(let k = 0; k < ROUNDS_TO_WIN; k++){ ctx.fillStyle = k < (A.score['t' + tm] || 0) ? '#ffd56a' : 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.arc(cx + 40 + k * 12, y0 + 51, 4, 0, 7); ctx.fill(); }
		}
	}

	/* ---------- canvas HUD ---------- */
	function drawHud(ctx, vw, vh){
		ctx.save();
		const map = P.map;
		// versus bar (1v1) or the standings panel (3–4 fighters)
		if(!A.practice && (A.state === 'fight' || A.state === 'countdown' || A.state === 'roundEnd' || A.state === 'over')){
			if(multi()) drawStandings(ctx, vw, map);
			else {
				const W = Math.min(760, vw - 40), x0 = (vw - W) / 2, y0 = 14, bw = W / 2 - 46;
				ctx.fillStyle = 'rgba(8,6,14,0.72)'; ctx.fillRect(x0, y0, W, 46);
				ctx.strokeStyle = (map ? map.accent : '#888') + '99'; ctx.strokeRect(x0 + 0.5, y0 + 0.5, W - 1, 45);
				const other = remotes().find(R => !R.left) || remote(NET.slot === 0 ? 1 : 0);
				const meLeft = NET.slot === 0;
				const mine = { name: 'You', hp: health / maxHealth, score: A.score[scoreKey(NET.slot)] || 0 }, theirs = { name: other.name, hp: other.hp / other.maxHp, score: A.score[scoreKey(other.slot)] || 0 };
				const sides = [ Object.assign({ col: '#5b9cff' }, meLeft ? mine : theirs), Object.assign({ col: '#ff5b6a' }, meLeft ? theirs : mine) ];
				sides.forEach((s, i) => {
					const bx = i ? x0 + W - 10 - bw : x0 + 10, pct = clamp(s.hp, 0, 1);
					ctx.fillStyle = '#000'; ctx.fillRect(bx, y0 + 24, bw, 12);
					ctx.fillStyle = s.col; if(i) ctx.fillRect(bx + bw * (1 - pct), y0 + 24, bw * pct, 12); else ctx.fillRect(bx, y0 + 24, bw * pct, 12);
					ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(bx, y0 + 24, bw, 2);
					ctx.font = 'bold 13px Arial'; ctx.textAlign = i ? 'right' : 'left'; ctx.fillStyle = '#efe6d2'; ctx.fillText(s.name, i ? bx + bw : bx, y0 + 18);
					for(let k = 0; k < ROUNDS_TO_WIN; k++){ ctx.fillStyle = k < s.score ? '#ffd56a' : 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.arc(vw / 2 + (i ? 14 + k * 14 : -14 - k * 14), y0 + 30, 5, 0, 7); ctx.fill(); }
				});
				ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffe6a8'; ctx.fillText('ROUND ' + Math.max(1, A.round), vw / 2, y0 + 16);
			}
		}
		if(A.down && !A.practice && multi() && (A.state === 'fight' || A.state === 'countdown')){
			ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(vw / 2 - 170, vh - 92, 340, 26);
			ctx.fillStyle = '#d6c8ff'; ctx.fillText('Down — watching ' + (A.watch != null ? nameOf(A.watch) : 'the fight'), vw / 2, vh - 74);
		}
		// connection
		if(NET.link){
			const ping = Math.round(NET.rtt);
			ctx.font = '11px Arial'; ctx.textAlign = 'right';
			ctx.fillStyle = ping < 90 ? '#7dff9a' : ping < 160 ? '#ffd56a' : '#ff8a8a';
			ctx.fillText((NET.transport === 'p2p' ? 'direct · ' : NET.transport === 'mixed' ? 'mixed · ' : 'relay · ') + 'ping ' + ping + ' ms · ' + NET.mps + ' msg/s' + (multi() ? ' · ' + NET.n + ' fighters' : ''), vw - 14, vh - 12);
		}
		if(A.status){
			ctx.font = 'bold 16px Arial'; ctx.textAlign = 'center';
			const tw = ctx.measureText(A.status).width;
			ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(vw / 2 - tw / 2 - 14, 70, tw + 28, 30);
			ctx.fillStyle = '#ffe08a'; ctx.fillText(A.status, vw / 2, 91);
		}
		// countdown
		if(A.state === 'countdown'){
			const left = (A.t0 - hostNow()) / 1000;
			if(left > 0 && left < 3.2){
				const n = Math.ceil(left), f = left - Math.floor(left);
				ctx.font = 'bold ' + Math.round(90 + 40 * f) + 'px Georgia'; ctx.textAlign = 'center';
				ctx.globalAlpha = 0.4 + 0.6 * f; ctx.fillStyle = '#000'; ctx.fillText(String(n), vw / 2 + 3, vh * 0.42 + 3); ctx.fillStyle = '#ffe6a8'; ctx.fillText(String(n), vw / 2, vh * 0.42);
				ctx.globalAlpha = 1;
			}
		}
		// banners
		for(let i = A.banners.length - 1; i >= 0; i--){
			const b = A.banners[i]; b.t++;
			if(b.t > b.life){ A.banners.splice(i, 1); continue; }
			const a = Math.min(1, b.t / 10, (b.life - b.t) / 20);
			const y = b.big ? vh * 0.3 : vh * 0.22 + i * 26;
			ctx.globalAlpha = a; ctx.textAlign = 'center';
			ctx.font = b.big ? 'bold 56px Georgia' : 'bold 22px Georgia';
			ctx.fillStyle = '#000'; ctx.fillText(b.text, vw / 2 + 3, y + 3); ctx.fillStyle = b.color; ctx.fillText(b.text, vw / 2, y);
		}
		ctx.globalAlpha = 1;
		ctx.restore();
	}

	/* ==================================================================
	   HOOKS called by the game
	   ================================================================== */
	function camera_(){
		if(!P.map) return false;
		const vw = canvas.width, vh = canvas.height, c = P.map.cam;
		// down in a 3–4 fighter round: the camera follows someone still standing
		const watch = A.down && A.watch != null && REM.get(A.watch) && REM.get(A.watch).active ? REM.get(A.watch) : null;
		const fx = watch ? watch.x + 19 : player.x + player.w / 2, fy = watch ? watch.y + 28 : player.y + player.h / 2;
		const tx = fx - vw / 2, ty = fy - vh * (P.map.camBias || 0.58);
		let cx = (c.x1 - c.x0) <= vw ? (c.x0 + c.x1 - vw) / 2 : clamp(tx, c.x0, c.x1 - vw);
		let cy = (c.y1 - c.y0) <= vh ? c.y1 - vh : clamp(ty, c.y0, c.y1 - vh);
		if(!A.camInit || Math.abs(camera.x - cx) > 900 || Math.abs(camera.y - cy) > 900){ camera.x = cx; camera.y = cy; A.camInit = true; }
		else { camera.x += (cx - camera.x) * 0.2; camera.y += (cy - camera.y) * 0.14; }
		return true;
	}
	let lastFrameT = now();
	function drawBack(ctx){
		const map = P.map; if(!map) return false;
		const vw = ctx.canvas.width, vh = ctx.canvas.height, cam = camera, t = now() / 1000;
		const key = map.id + '|' + vw + '|' + vh;
		if(P.layerKey !== key){ P.layers = paintLayers(map, vw, vh); P.layerKey = key; }
		const L = P.layers;
		ctx.drawImage(L.sky, 0, 0);
		const lift = clamp((2000 - (cam.y + vh)) * 0.08, -60, 80);
		blit(ctx, L.far, cam.x * 0.12 + (map.id === 'storm' ? t * 4 : 0), lift * 0.5);
		blit(ctx, L.mid, cam.x * 0.32 + (map.id === 'storm' ? t * 9 : 0), lift);
		if(map.id === 'frost') drawAurora(ctx, vw, vh, t);
		drawDecor(ctx, cam, vw, vh, t, map);
		if(map.id === 'ember') drawLava(ctx, cam, vw, vh, t, map);
		if(map.pools) drawPools(ctx, cam, vw, vh, t, map);
		// chains for the hanging walkways
		for(const p of P.plats){ if(!p.chains) continue; const a = p.x + 16 - cam.x, b = p.x + p.w - 16 - cam.x, y = p.y - cam.y; if(b < -10 || a > vw + 10) continue; ctx.strokeStyle = '#2a2120'; ctx.lineWidth = 3; ctx.setLineDash([ 7, 4 ]); ctx.beginPath(); ctx.moveTo(a, y); ctx.lineTo(a, -10); ctx.moveTo(b, y); ctx.lineTo(b, -10); ctx.stroke(); ctx.setLineDash([]); }
		if(ensurePieces()){
			for(const pc of P.pieces){
				const p = pc.p, x = p.x - pc.ox - cam.x;
				let y = p.y - pc.oy - cam.y;
				if(p.float) y += Math.sin(t * 1.3 + p.x) * 0;      // (kept still: a moving floor would desync the two players)
				if(x > vw || x + pc.cv.width < 0 || y > vh || y + pc.cv.height < 0) continue;
				ctx.drawImage(pc.cv, Math.round(x), Math.round(y));
			}
		} else {
			for(const p of P.plats){ if(p.invisible) continue; ctx.fillStyle = '#444'; ctx.fillRect(p.x - cam.x, p.y - cam.y, p.w, p.oneway ? 20 : p.h); }
		}
		if(map.id === 'ember') drawVents(ctx, cam, vw, vh, t, map, clock());
		if(map.id === 'frost') drawIcicles(ctx, cam, vw, vh, t, map, clock());
		if(map.id === 'cavern' && hazardsLive()) drawRocks(ctx, cam, vw, vh, t, map, clock());
		if(map.id === 'storm'){ drawCloudSea(ctx, cam, vw, vh, t); if(hazardsLive()) drawBolt(ctx, cam, vw, vh, t, map, clock()); }
		return true;
	}
	function drawAurora(ctx, vw, vh, t){
		ctx.save(); ctx.globalCompositeOperation = 'lighter';
		for(let k = 0; k < 3; k++){
			const y0 = vh * (0.12 + k * 0.07);
			const gr = ctx.createLinearGradient(0, y0 - 40, 0, y0 + 90);
			gr.addColorStop(0, 'rgba(80,255,180,0)'); gr.addColorStop(0.5, k === 1 ? 'rgba(140,120,255,0.13)' : 'rgba(80,255,190,0.12)'); gr.addColorStop(1, 'rgba(80,255,180,0)');
			ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(0, y0 + 90);
			for(let x = 0; x <= vw; x += 40) ctx.lineTo(x, y0 + Math.sin(x * 0.004 + t * 0.25 + k * 2) * 40 + Math.sin(x * 0.011 - t * 0.4) * 14);
			ctx.lineTo(vw, y0 + 90); ctx.closePath(); ctx.fill();
		}
		ctx.restore();
	}
	function drawCloudSea(ctx, cam, vw, vh, t){
		const y = 2210 - cam.y; if(y > vh) return;
		const gr = ctx.createLinearGradient(0, y - 60, 0, y + 200); gr.addColorStop(0, 'rgba(235,228,255,0)'); gr.addColorStop(0.35, 'rgba(225,216,250,0.85)'); gr.addColorStop(1, 'rgba(190,180,230,1)');
		ctx.fillStyle = gr; ctx.fillRect(0, y - 60, vw, vh - y + 60);
		ctx.fillStyle = 'rgba(250,246,255,0.75)';
		for(let k = 0; k < 14; k++){ const x = ((k * 377 - cam.x * 0.9 + t * 14) % (vw + 400) + vw + 400) % (vw + 400) - 200; ctx.beginPath(); ctx.ellipse(x, y + 10 + (k % 3) * 18, 140 + (k % 4) * 30, 34, 0, 0, 7); ctx.fill(); }
	}
	function drawFront(ctx){
		const map = P.map; if(!map) return;
		const vw = ctx.canvas.width, vh = ctx.canvas.height, t = now() / 1000;
		const dt = Math.min(0.05, (now() - lastFrameT) / 1000); lastFrameT = now();
		ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
		if(map.dark) drawDark(ctx, camera, vw, vh, t);
		updateParticles(ctx, camera, vw, vh, t, dt, map, clock());
		if(map.pools) for(const L of map.pools){ const x0 = L.x0 - camera.x, y = L.y - camera.y; if(x0 > vw || L.x1 - camera.x < 0) continue; const g = ctx.createLinearGradient(0, y, 0, y + 60); g.addColorStop(0, 'rgba(60,200,180,0.35)'); g.addColorStop(1, 'rgba(10,60,70,0.6)'); ctx.fillStyle = g; ctx.fillRect(x0, y + 2, L.x1 - L.x0, 60); ctx.fillStyle = 'rgba(200,255,240,0.5)'; ctx.fillRect(x0, y, L.x1 - L.x0, 1.5); }
		if(map.id === 'colosseum'){
			// warm afternoon light slanting across the sand
			if(!P.sunCv || P.sunCv.width !== vw + 200 || P.sunCv.height !== vh){
				P.sunCv = mkCanvas(vw + 200, vh); const g = P.sunCv.getContext('2d');
				for(let k = 0; k < 4; k++){ const x = 100 + vw * (0.42 + k * 0.15); const gr = g.createLinearGradient(x, 0, x - vh * 0.4, vh); gr.addColorStop(0, 'rgba(255,236,190,0.07)'); gr.addColorStop(1, 'rgba(255,236,190,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 90 + k * 20, 0); g.lineTo(x - vh * 0.5 + 140, vh); g.lineTo(x - vh * 0.5, vh); g.fill(); }
				const vg = g.createRadialGradient(vw / 2 + 100, vh * 0.5, vh * 0.5, vw / 2 + 100, vh * 0.5, vw * 0.8); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(60,30,10,0.22)'); g.fillStyle = vg; g.fillRect(0, 0, vw + 200, vh);
			}
			ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(P.sunCv, Math.round(-100 - (camera.x * 0.03) % 60), 0); ctx.restore();
		}
		if(map.id === 'ember'){ const g = ctx.createLinearGradient(0, vh * 0.6, 0, vh); g.addColorStop(0, 'rgba(255,90,20,0)'); g.addColorStop(1, 'rgba(255,90,20,0.12)'); ctx.fillStyle = g; ctx.fillRect(0, vh * 0.6, vw, vh * 0.4); }
		if(map.id === 'frost'){ const g = ctx.createLinearGradient(0, 2000 - camera.y - 80, 0, 2000 - camera.y + 30); g.addColorStop(0, 'rgba(220,240,255,0)'); g.addColorStop(1, 'rgba(220,240,255,0.22)'); ctx.fillStyle = g; ctx.fillRect(0, 2000 - camera.y - 80, vw, 110); }
		if(map.id === 'storm'){
			// sheet lightning far away now and then
			if(Math.random() < 0.004) P.flash = Math.max(P.flash, 0.25);
			const g = ctx.createRadialGradient(vw / 2, vh / 2, vh * 0.4, vw / 2, vh / 2, vw * 0.8); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(20,10,40,0.35)'); ctx.fillStyle = g; ctx.fillRect(0, 0, vw, vh);
		}
		if(P.flash > 0.01){ ctx.fillStyle = 'rgba(235,230,255,' + P.flash + ')'; ctx.fillRect(0, 0, vw, vh); P.flash *= 0.86; }
		if(!P.snap) drawHud(ctx, vw, vh);
		ctx.restore();
	}
	function tick(){
		if(!P.map) return;
		netTick();
		for(const R of remotes()) tickRemote(R);
		legacyHits();
		if(A.state === 'countdown'){
			placeAtSpawn();
			if(hostNow() >= A.t0){ A.state = 'fight'; A.banner('FIGHT!', '#ffd56a', 60, true); }
		}
		// down for the rest of the round: no moving, no casting, no blows; watch whoever is still standing
		if(A.down && !A.practice){
			player.vx = 0; player.stunTimer = Math.max(player.stunTimer || 0, 2); player.iFrames = Math.max(player.iFrames || 0, 30);
			const standing = remotes().filter(R => R.active && !R.ko && !R.left);
			if(!standing.some(R => R.slot === A.watch)) A.watch = standing.length ? (standing.find(R => !hostile(R.slot, NET.slot)) || standing[0]).slot : null;
		} else A.watch = null;
		// the old single-opponent helpers in the game read window.__pvpOpp: the nearest fighter you can hit
		let near = null, nd = 1e9;
		for(const R of foesOfMine()){ const d = Math.abs(R.x - player.x) + Math.abs(R.y - player.y); if(d < nd){ nd = d; near = R; } }
		root.__pvpOpp = near || NO_OPP;
		root.__pvpOpps = foesOfMine();
		hazardsTick();
		if(A.practice && root.RuneMages && P.map.voidY) for(const m of root.RuneMages.list) if(m.y > P.map.voidY){ const s = P.map.spawns.right; m.x = s.x - 16; m.y = s.y - 80; m.vx = 0; m.vy = 0; }
		if(!NET.link && !A.practice) return;
	}
	const NO_OPP = { active: false, x: 0, y: 0, w: 38, h: 56, facing: 1 };

	/* ==================================================================
	   BOOT — wire the game's systems to the arena
	   ================================================================== */
	function boot(){
		if(A.booted) return; A.booted = true;
		root.MAGIC_WORLD_REF = MAGIC_WORLD; root.MAGIC_HOST_REF = MAGIC_HOST;
		const qs = new URLSearchParams(location.search);
		const match = qs.get('match');
		A.practice = !match;
		// the match: ?slot=&n=&pm= (from PvPNet.matchUrl); older links only say side=left|right (a duel)
		const sl = qs.get('slot');
		NET.slot = sl != null && /^[0-3]$/.test(sl) ? +sl : (qs.get('side') === 'right' ? 1 : 0);
		NET.n = clamp(parseInt(qs.get('n'), 10) || 2, 2, 4);
		if(NET.slot >= NET.n) NET.n = NET.slot + 1;
		const pm = qs.get('pm');
		NET.mode = pm === 'teams' && NET.n === 4 ? 'teams' : pm === 'ffa' || NET.n > 2 ? 'ffa' : 'duel';
		if(NET.mode === 'ffa' && NET.n === 2 && pm !== 'ffa') NET.mode = 'duel';
		NET.side = NET.slot === 0 ? 'left' : 'right';
		NET.host = NET.slot === 0;
		for(let s = 0; s < NET.n; s++) if(s !== NET.slot) remote(s);
		applyMap(qs.get('map') && MAP_BY_ID[qs.get('map')] ? qs.get('map') : 'ember', 1);
		placeAtSpawn();

		// your rune casts go out to the other fighters
		if(MAGIC_WORLD && !MAGIC_WORLD._pvpWrapped){
			const orig = MAGIC_WORLD.cast;
			MAGIC_WORLD.cast = function(def, opts){
				const res = orig.call(this, def, opts);
				if(res && res.ok && opts && opts.owner === MAGIC_OWNER) try { onLocalCast(def, opts, res); } catch(e){}
				return res;
			};
			MAGIC_WORLD._pvpWrapped = true;
		}
		// your spells and blows can reach your opponents (only cosmetically here: each side decides what hits it)
		const fighting = () => A.state === 'fight' && !A.down;
		const gE = MAGIC_HOST.getEnemies, dE = MAGIC_HOST.damageEnemy, hR = MAGIC_HOST.hitRect, kb = MAGIC_HOST.knockback, aS = MAGIC_HOST.applyStatus, tp = MAGIC_HOST.teleport, nd = MAGIC_HOST.nudge;
		MAGIC_HOST.getEnemies = () => { const l = gE(); return fighting() ? l.concat(foesOfMine().map(R => R.ent)) : l; };
		MAGIC_HOST.damageEnemy = (en, dmg, info) => {
			const R = remoteOfEnt(en);
			if(!R) return dE(en, dmg, info);
			if(!hostile(R.slot, NET.slot)) return;
			R.ent.flash = 8; R.flash = 8;
			dmgNumbers.push({ x: (info && info.x != null ? info.x : R.x + R.w / 2), y: (info && info.y != null ? info.y : R.y) - 10, text: Math.round(dmg * BAL.spell) + '', age: 0, color: (info && info.color) || '#9fe6ff' });
			if(typeof spawnImpact === 'function' && info) spawnImpact(info.x, info.y, info.color || '#9fe6ff');
		};
		MAGIC_HOST.hitRect = (en) => { const R = remoteOfEnt(en); return R ? { x: R.x, y: R.y, w: R.w, h: R.h } : hR(en); };
		MAGIC_HOST.knockback = (en, ...a) => remoteOfEnt(en) ? undefined : kb(en, ...a);
		MAGIC_HOST.applyStatus = (en, ...a) => remoteOfEnt(en) ? true : aS(en, ...a);
		MAGIC_HOST.teleport = (en, ...a) => remoteOfEnt(en) ? false : tp(en, ...a);
		MAGIC_HOST.nudge = (en, ...a) => remoteOfEnt(en) ? undefined : nd(en, ...a);
		const MM = root.MeleeMode;
		if(MM){
			const tg = MM.targets;
			MM.targets = function(){ const l = tg.call(this); if(fighting()) for(const R of foesOfMine()) l.push(R.ent); return l; };
			MM.damageListeners.push(onLocalMeleeHit);
			// a fighter who is down cannot swing
			const ba = MM.beginAttack;
			if(typeof ba === 'function') MM.beginAttack = function(){ if(A.down && !A.practice) return; return ba.apply(this, arguments); };
		}
		// …or cast
		const cms = root.castMagicSpell;
		if(typeof cms === 'function') root.castMagicSpell = function(){ if(A.down && !A.practice) return; return cms.apply(this, arguments); };
		// a knock-out is a round result, not a respawn
		const rs = root.respawnPlayer;
		root.respawnPlayer = function(){ if(A.state === 'fight' || A.state === 'countdown' || A.practice) return onLocalKO(); return rs.apply(this, arguments); };

		// legacy hooks other code still calls
		root.__pvpOpp = NO_OPP; root.__pvpOpps = [];
		root.__pvpApplyGravityPull = function(){};
		root.__pvpRememberOutgoing = function(){};
		root.__pvpNet = { sendCast: (c) => send('cast', c), sendHit: (h) => { const f = foesOfMine()[0]; if(f) send('hit', h, f.slot); } };

		if(A.practice){ A.state = 'select'; openPicker(); return; }
		A.state = 'lobby'; A.status = 'Connecting to the arena…';
		const connect = () => {
			if(NET.link) return;
			if(!root.PvPNet){ A.status = 'Online PvP is not available'; return; }
			const local = qs.get('local') === '1';
			if(!local && !(root.CloudSave && root.CloudSave.client && root.CloudSave.client())){ setTimeout(connect, 400); return; }
			NET.link = root.PvPNet.connectMatch(match, { slot: NET.slot, n: NET.n }, {
				local,
				onConnected: () => { NET.lobbyT = now(); A.status = NET.n > 2 ? 'Waiting for players… 1 / ' + NET.n : 'Waiting for your opponent…'; hello(); },
				onPeer: (slot) => { const R = remote(slot); R.left = false; hello(slot); },
				onEvent: onEvent,
				onLeft: (slot) => onPeerLeft(typeof slot === 'number' ? slot : (NET.slot === 0 ? 1 : 0)),
				// a direct peer-to-peer link opened (or fell back to the relay): re-measure the delay and the clock
				onTransport: (t, slot) => { NET.rttMin = 1e9; NET.pingT = 0; NET.fastPings = 8; if(t === 'p2p') A.banner('Direct connection' + (multi() && typeof slot === 'number' ? ' to ' + nameOf(slot) : ''), '#9fe6a8', 70); }
			});
		};
		setTimeout(connect, 300);
		root.addEventListener('beforeunload', () => send('bye', {}));
	}

	root.PvpArena = {
		MAPS, MAP_BY_ID, boot, tick, camera: camera_, drawBack, drawFront,
		drawOpponent: (ctx) => { for(const R of remotes()) drawRemote(ctx, R, camera.x, camera.y); }, afterMove,
		applyMap, state: () => A.state, A, NET, REM, remotes, P, BAL, platforms: () => P.plats,
		// where a slot (0–3, or the old 'left' / 'right') starts on the current map
		spawnFor: (slot) => { const m = P.map || MAPS[0]; const s = spawnSpot(m, slot); return { x: s.x - 19, y: s.y - 60 }; },
		_test: { hostSelect, practiceStart, onEvent, icicleState, boltState, gustState, ventState, clock, renderSnap, snapFloorAt, floorAt, snapCamera, snapCache, spawnSpot, hostKO, present, teamOf, hostile }
	};
})(typeof window !== 'undefined' ? window : globalThis);
