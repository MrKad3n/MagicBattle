/* =============================================================
   WhereMap (c56) — press N to see roughly where you are on the world map.

   Uses the same coordinate grid as the main menu's world map: columns A–S, rows 1–13. The grid points
   sit evenly across images/worldmaps/coordinate-map.jpg.
   - Open world (EmberFall): the road you are on is highlighted, with a marker placed along it by how far
     you have walked. The label gives the road, the two grid points it runs between, and the district.
   - Dungeons and the other world locations: a marker on the place the dungeon lies under, plus how deep
     you are.
   N or Esc closes it. While it is open the game is paused if the page supports pausing.
   ============================================================= */
(function (global) {
	'use strict';

	const COLS = 19, ROWS = 13;
	const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
	const IMG = 'images/worldmaps/coordinate-map.jpg';

	// the EmberFall roads, in walking order (left → right in the game)
	const ROADS = [
		{ id: 'west', x0: 0, x1: 22000, a: 'I6', b: 'J6', name: 'The Western Approach' },
		{ id: 'city', x0: 22000, x1: 54000, a: 'J6', b: 'K6', name: 'EmberFall City', edge: 0 },
		{ id: 'north', x0: 56000, x1: 78000, a: 'J6', b: 'J5', name: 'The King’s North Road', edge: 2 },
		{ id: 'northpass', x0: 78000, x1: 100000, a: 'J5', b: 'J4', name: 'The Northwatch Pass', edge: 1 },
		{ id: 'millstream', x0: 102000, x1: 124000, a: 'I6', b: 'I5', name: 'The Upper Millstream', edge: 2 },
		{ id: 'pineward', x0: 124000, x1: 146000, a: 'I5', b: 'I4', name: 'The Pineward Rise', edge: 1 },
		{ id: 'causeway', x0: 148000, x1: 170000, a: 'I5', b: 'J5', name: 'The Frostline Causeway' },
		{ id: 'traverse', x0: 172000, x1: 194000, a: 'I4', b: 'J4', name: 'The Highland Traverse' }
	];
	// where the dungeons and the other locations lie (percent of the map, as on the main menu)
	const SITES = {
		fire: { x: 50, y: 52, name: 'The Infernal Depths', under: 'beneath Cinderwatch' },
		ice: { x: 49, y: 15, name: 'The Glacial Reach', under: 'beneath Aurorafall' },
		earth: { x: 33, y: 68, name: 'The Living Wilds', under: 'beneath the Sylvaris Wildes' },
		iron: { x: 80, y: 65, name: 'The Iron Forge', under: 'beneath Ironforge' },
		stormislands: { x: 7, y: 50, name: 'The Storm Islands' },
		dragongraveyard: { x: 38, y: 25, name: 'The Dragon Graveyard' },
		observatory: { x: 40, y: 55, name: 'The Volcano Observatory' },
		sylvaris: { x: 33, y: 68, name: 'The Sylvaris Wildes' },
		blacksands: { x: 54.5, y: 76, name: 'The Black Sands' },
		arcaneruins: { x: 83.5, y: 24.5, name: 'The Arcane Ruins' }
	};

	function gridPt(name) {
		const col = LETTERS.indexOf(name[0]);
		const row = parseInt(name.slice(1), 10) - 1;
		return { x: col / (COLS - 1) * 100, y: row / (ROWS - 1) * 100 };
	}
	function nearestGrid(px, py) {
		const col = Math.max(0, Math.min(COLS - 1, Math.round(px / 100 * (COLS - 1))));
		const row = Math.max(0, Math.min(ROWS - 1, Math.round(py / 100 * (ROWS - 1))));
		return LETTERS[col] + (row + 1);
	}
	const has = (n) => typeof global[n] !== 'undefined';
	function g(n) { try { return Function('return typeof ' + n + ' !== "undefined" ? ' + n + ' : undefined')(); } catch (e) { return undefined; } }

	/* ---------------------------------------------------------------- where are we? */
	function locate() {
		const player = g('player');
		const mode = (new URLSearchParams(location.search).get('mode') || '').toLowerCase();
		if (g('IS_CITY') && player) {
			const x = player.x + (player.w || 40) / 2;
			const road = ROADS.find(r => x >= r.x0 && x < r.x1) || ROADS.find(r => x >= r.x0 && x < r.x1 + 2000) || ROADS[1];
			const span = road.edge === 0 ? [road.x0, road.x1] : road.edge === 1 ? [road.x0, road.x1 - 620] : road.edge === 2 ? [road.x0 + 620, road.x1] : [road.x0 + 620, road.x1 - 620];
			const f = Math.max(0, Math.min(1, (x - span[0]) / (span[1] - span[0])));
			const A = gridPt(road.a), B = gridPt(road.b);
			const pt = { x: A.x + (B.x - A.x) * f, y: A.y + (B.y - A.y) * f };
			let district = '';
			try { district = global.EmberfallCity && EmberfallCity.districtName ? (EmberfallCity.districtName(x) || '') : ''; } catch (e) {}
			let room = '';
			try { const r = EmberfallCity.currentRoom && EmberfallCity.currentRoom(); if (r) room = r.label || ''; } catch (e) {}
			return {
				pt, road, f,
				title: road.name,
				sub: road.a + ' — ' + road.b + ' · nearest ' + nearestGrid(pt.x, pt.y),
				detail: room ? 'Inside ' + room : district
			};
		}
		const dtype = g('DUNGEON_TYPE');
		const site = (g('IS_DUNGEON') && dtype && SITES[dtype]) || SITES[mode.replace(/[^a-z]/g, '')];
		if (site) {
			let detail = site.under || '';
			const W = g('dungeon') && g('dungeon').worldH;
			if (g('IS_DUNGEON') && player && W) {
				const depth = Math.max(0, Math.min(1, player.y / W));
				const across = g('dungeon').worldW ? Math.max(0, Math.min(1, player.x / g('dungeon').worldW)) : 0;
				detail += (detail ? ' · ' : '') + Math.round(depth * 100) + '% deep, ' + Math.round(across * 100) + '% across';
			}
			return { pt: { x: site.x, y: site.y }, title: site.name, sub: 'near ' + nearestGrid(site.x, site.y), detail };
		}
		return { pt: { x: 30, y: 39 }, title: 'Somewhere in the realm', sub: 'near ' + nearestGrid(30, 39), detail: '' };
	}

	/* ---------------------------------------------------------------- the overlay */
	let el = null, open = false, pausedByUs = false;
	const CSS = `
#whereMap{position:fixed;inset:0;z-index:9000;display:none;align-items:center;justify-content:center;background:rgba(4,6,12,0.72);backdrop-filter:blur(2px);font-family:Georgia,'Times New Roman',serif}
#whereMap.open{display:flex}
#whereMap .wm-panel{position:relative;width:min(1100px,94vw,calc(76vh * 1024 / 571));max-height:92vh;display:flex;flex-direction:column;gap:10px}
#whereMap .wm-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;color:#f3e6c4;text-shadow:0 2px 6px #000}
#whereMap .wm-title{font-size:22px;font-weight:700;letter-spacing:.5px}
#whereMap .wm-sub{font-size:13px;color:#ffd37a}
#whereMap .wm-detail{font-size:13px;color:#c9d2e8;margin-top:2px}
#whereMap .wm-hint{font:12px Arial,sans-serif;color:#9aa6c4;white-space:nowrap}
#whereMap .wm-map{position:relative;width:100%;aspect-ratio:1024/571;border:3px solid rgba(255,226,150,0.35);border-radius:12px;overflow:hidden;background:#0b1220 url('${IMG}') center/100% 100% no-repeat;box-shadow:0 10px 40px rgba(0,0,0,.6)}
#whereMap svg{position:absolute;inset:0;width:100%;height:100%}
#whereMap .wm-lbl{position:absolute;transform:translate(5px,-4px);font:700 9px/1 Arial,sans-serif;color:rgba(255,255,255,.75);text-shadow:0 0 3px #000,0 1px 2px #000;pointer-events:none;white-space:nowrap}
#whereMap .wm-lbl.hot{color:#ffe27a;font-size:11px}
#whereMap .wm-you{position:absolute;width:0;height:0;pointer-events:none}
#whereMap .wm-you i{position:absolute;left:-9px;top:-9px;width:18px;height:18px;border-radius:50%;background:#ff5a3c;border:3px solid #fff;box-shadow:0 0 0 2px rgba(0,0,0,.5),0 0 18px #ff8a50}
#whereMap .wm-you b{position:absolute;left:-26px;top:-26px;width:52px;height:52px;border-radius:50%;border:2px solid rgba(255,200,120,.9);animation:wmPulse 1.6s ease-out infinite}
#whereMap .wm-you span{position:absolute;left:14px;top:-30px;padding:3px 8px;border-radius:6px;background:rgba(12,16,28,.92);border:1px solid rgba(255,226,122,.6);color:#ffe27a;font:700 12px Arial,sans-serif;white-space:nowrap}
@keyframes wmPulse{0%{transform:scale(.3);opacity:1}100%{transform:scale(1.4);opacity:0}}
#whereMap .wm-key{display:flex;gap:16px;font:12px Arial,sans-serif;color:#c9d2e8}
#whereMap .wm-key em{display:inline-block;width:18px;height:3px;vertical-align:middle;margin-right:6px;border-radius:2px}
`;
	function build() {
		if (el) return;
		const st = document.createElement('style');
		st.textContent = CSS;
		document.head.appendChild(st);
		el = document.createElement('div');
		el.id = 'whereMap';
		el.innerHTML = '<div class="wm-panel"><div class="wm-head"><div><div class="wm-title"></div><div class="wm-sub"></div><div class="wm-detail"></div></div><div class="wm-hint">N or Esc to close</div></div>' +
			'<div class="wm-map"><svg viewBox="0 0 100 100" preserveAspectRatio="none"></svg><div class="wm-lbls"></div><div class="wm-you"><b></b><i></i><span>You are here</span></div></div>' +
			'<div class="wm-key"><span><em style="background:rgba(120,180,255,.6)"></em>Coordinate lines</span><span><em style="background:#ffb046"></em>Roads you can travel</span><span><em style="background:#ffe27a;height:5px"></em>The road you are on</span></div></div>';
		el.addEventListener('mousedown', (e) => { if (e.target === el) toggle(false); });
		document.body.appendChild(el);
		const svg = el.querySelector('svg');
		const ns = 'http://www.w3.org/2000/svg';
		const line = (a, b, stroke, w, cls) => {
			const l = document.createElementNS(ns, 'line');
			l.setAttribute('x1', a.x); l.setAttribute('y1', a.y); l.setAttribute('x2', b.x); l.setAttribute('y2', b.y);
			l.setAttribute('stroke', stroke); l.setAttribute('stroke-width', w);
			l.setAttribute('vector-effect', 'non-scaling-stroke');
			l.setAttribute('stroke-linecap', 'round');
			if (cls) l.setAttribute('class', cls);
			svg.appendChild(l);
			return l;
		};
		for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
			const p = { x: c / (COLS - 1) * 100, y: r / (ROWS - 1) * 100 };
			if (c < COLS - 1) line(p, { x: (c + 1) / (COLS - 1) * 100, y: p.y }, 'rgba(120,180,255,0.32)', 1);
			if (r < ROWS - 1) line(p, { x: p.x, y: (r + 1) / (ROWS - 1) * 100 }, 'rgba(120,180,255,0.32)', 1);
		}
		for (const rd of ROADS) rd.line = line(gridPt(rd.a), gridPt(rd.b), 'rgba(255,176,70,0.95)', 3);
		const lbls = el.querySelector('.wm-lbls');
		for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
			const d = document.createElement('div');
			d.className = 'wm-lbl';
			d.textContent = LETTERS[c] + (r + 1);
			d.dataset.k = d.textContent;
			d.style.left = (c / (COLS - 1) * 100) + '%';
			d.style.top = (r / (ROWS - 1) * 100) + '%';
			lbls.appendChild(d);
		}
	}
	function refresh() {
		const L = locate();
		el.querySelector('.wm-title').textContent = L.title;
		el.querySelector('.wm-sub').textContent = L.sub;
		el.querySelector('.wm-detail').textContent = L.detail || '';
		const you = el.querySelector('.wm-you');
		you.style.left = L.pt.x + '%';
		you.style.top = L.pt.y + '%';
		// a label near the right edge flips to the left of the marker
		const sp = you.querySelector('span');
		sp.style.left = L.pt.x > 80 ? '' : '14px';
		sp.style.right = L.pt.x > 80 ? '14px' : '';
		for (const rd of ROADS) {
			const on = L.road === rd;
			rd.line.setAttribute('stroke', on ? '#ffe27a' : 'rgba(255,176,70,0.95)');
			rd.line.setAttribute('stroke-width', on ? 5 : 3);
		}
		const hot = L.road ? [L.road.a, L.road.b] : [L.sub.replace(/^near /, '')];
		el.querySelectorAll('.wm-lbl').forEach(d => d.classList.toggle('hot', hot.includes(d.dataset.k)));
	}
	function setPause(on) {
		// use the game's own pause if it has one
		try {
			if (on) {
				if (has('togglePause') && g('gamePaused') === false) { global.togglePause(); pausedByUs = true; }
			} else if (pausedByUs) {
				if (has('togglePause') && g('gamePaused') === true) global.togglePause();
				pausedByUs = false;
			}
		} catch (e) {}
	}
	function toggle(force) {
		build();
		open = force == null ? !open : !!force;
		if (open) refresh();
		el.classList.toggle('open', open);
		setPause(open);
		global.__whereMapOpen = open;
	}
	function busy() {
		const t = document.activeElement;
		if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return true;
		if (g('dialogueActive') || g('inventoryOpen') || g('aiChatActive')) return true;
		return false;
	}
	function playable() {
		return !!(g('IS_CITY') || g('IS_DUNGEON') || SITES[(new URLSearchParams(location.search).get('mode') || '').toLowerCase()]);
	}
	global.addEventListener('keydown', (e) => {
		const k = e.key && e.key.toLowerCase();
		if (k === 'escape' && open) { toggle(false); e.stopPropagation(); return; }
		if (k !== 'n' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
		if (!open && (busy() || !playable())) return;
		toggle();
	}, true);
	global.WhereMap = { toggle, locate };
})(typeof window !== 'undefined' ? window : globalThis);
