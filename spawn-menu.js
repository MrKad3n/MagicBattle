/* =====================================================================
   SPAWN MENU — Sandbox / Mage Arena
   A side drawer that lists every enemy, mini-boss, boss and rune mage in the game and spawns them where you stand.
   You can pick a boss version (★ Alpha / ★★ Elder / ★★★ Tyrant), stack Nightmare mutations on top, set a count,
   make them passive or unkillable (for testing a spell), and clear them again.

   dungeon.html calls SpawnMenu.init(ctx) once, from the sandbox block. ctx supplies the game's own objects through
   accessors, so this file never touches the game's globals directly:
     ctx.types()          → ENEMY_TYPES
     ctx.enemies()        → the live enemies array
     ctx.make(type,x,y,face,opts) → a new enemy standing on y (the game's makeWorldEnemy)
     ctx.player()         → the player
     ctx.groundY / ctx.centerX / ctx.say(x,y,text,color)
     ctx.mages            → RuneMages (optional)
   ===================================================================== */
(function(root){
	'use strict';
	let C = null, drawer = null, btn = null, built = false, mine = new Set();
	const S = { tab: 'enemies', q: '', tier: 0, count: 1, passive: false, hp: 1, where: 'me', muts: new Set() };
	const TIERS = [['Normal', 0, '#cfd6e6'], ['★ Alpha', 1, '#ffd166'], ['★★ Elder', 2, '#ff9f5a'], ['★★★ Tyrant', 3, '#ff5d7a']];
	const COUNTS = [1, 3, 5, 10];
	const NOT_HERE = { zenith: 'raid-only boss (its fight lives in the Zenith raid)' };
	const HPS = [['Normal', 1], ['×10', 10], ['∞ Training', 1e9]];

	function el(tag, css, html){ const e = document.createElement(tag); if(css) e.style.cssText = css; if(html != null) e.innerHTML = html; return e; }
	function isolate(e){
		['mousedown','mouseup','pointerdown','pointerup','click','dblclick','wheel','contextmenu'].forEach(ev => e.addEventListener(ev, x => x.stopPropagation()));
		['keydown','keyup','keypress'].forEach(ev => e.addEventListener(ev, x => { if(x.key === 'Escape') return; x.stopPropagation(); }));   // typing in the search box never walks or casts
	}
	const nice = (k) => k.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase());

	function entries(){
		const T = C.types(), out = { enemies: [], minis: [], bosses: [] };
		for(const k in T){
			const t = T[k]; if(!t || NOT_HERE[k]) continue;
			const row = { id: k, name: t.name || nice(k), hp: t.hp, w: t.w, h: t.h, color: t.color || '#999', flies: !!t.flies, boss: !!t.isBoss, mini: !!t.isMiniBoss || !!(root.MiniBossKit && MiniBossKit.TYPES[k]) };
			(row.boss ? out.bosses : row.mini ? out.minis : out.enemies).push(row);
		}
		for(const g in out) out[g].sort((a, b) => a.name.localeCompare(b.name));
		return out;
	}

	/* ------------------------------------------------------------------ spawning */
	function spawnOne(type, x){
		const T = C.types()[type]; if(!T) return null;
		if((T.isBoss || T.isMiniBoss) && C.bossRoom) C.bossRoom();      // the boss kits want a boss room + floor
		const en = C.make(type, x, C.groundY, Math.random() < 0.5 ? 1 : -1, { flyH: 130 });
		if(!en) return null;
		en.state = 'alert'; en.alertTimer = 99999; en.stunTimer = T.isBoss ? 60 : 0;
		en.bossGlobalCD = 0; en._safeX = en.x; en._safeY = en.y; en._sbSpawn = true;
		if(S.tier && root.EliteVariants) root.EliteVariants.apply(en, S.tier);
		if(S.muts.size && root.NightmareSystem) root.NightmareSystem.applyMutations(en, [...S.muts]);
		if(S.hp > 1){ en.hp = en.maxHp = Math.min(1e9, Math.round(en.maxHp * S.hp)); }
		if(S.passive){ en.spellCooldowns = en.spellCooldowns.map(() => 1e9); en.state = 'idle'; en.alertTimer = 0; en._passive = true; }
		C.enemies().push(en); mine.add(en); armSweep();
		if(T.isBoss && !S.passive && C.bossStart) C.bossStart(en);      // Seraphel and the Infernal Kitten run a fight state machine of their own
		return en;
	}
	function spawn(type){
		const p = C.player(), T = C.types()[type]; if(!T) return;
		const n = S.count, base = S.where === 'center' ? C.centerX : p.x + (p.facing === -1 ? -1 : 1) * (T.isBoss ? 520 : 380);
		let first = null;
		for(let i = 0; i < n; i++){
			const spread = n > 1 ? (i - (n - 1) / 2) * Math.max(90, T.w + 30) : 0;
			const go = () => { const en = spawnOne(type, base + spread + (Math.random() - 0.5) * 30); refreshCounter(); return en; };
			if(i === 0) first = go(); else setTimeout(go, i * 70);      // a group arrives over a moment instead of in one frame
		}
		if(first){
			const tier = TIERS[S.tier][0];
			C.say(first.x + first.w / 2, first.y - 30, (S.tier ? tier + ' ' : '') + (T.name || nice(type)) + (n > 1 ? ' ×' + n : '') + ' spawned', TIERS[S.tier][2]);
			refreshCounter();
		}
	}
	function clearMine(){ if(C.bossReset) C.bossReset(); const arr = C.enemies(); for(let i = arr.length - 1; i >= 0; i--) if(arr[i]._sbSpawn) arr.splice(i, 1); mine.clear(); refreshCounter(); }
	function clearAll(){ if(C.bossReset) C.bossReset(); const arr = C.enemies(); arr.length = 0; mine.clear(); if(root.EFX && root.EFX.clear) root.EFX.clear(); if(C.mages) C.mages.clear(); refreshCounter(); }
	function alive(){ let n = 0; for(const e of mine) if(!e.dead) n++; return n; }
	let counterEl = null;
	let lastCount = -1;
	function refreshCounter(){ if(!counterEl) return; const n = alive(); if(n === lastCount) return; lastCount = n; counterEl.textContent = n + ' spawned enemies alive'; }

	/* dead ones fade, then leave the list so a long session does not pile up corpses; the timer only runs while something is spawned */
	let sweeper = 0;
	function sweep(){
		sweeper = 0; if(!C || !mine.size) return;
		const arr = C.enemies();
		for(const e of [...mine]){ if(e.dead && e.deathTimer > 240){ const i = arr.indexOf(e); if(i >= 0) arr.splice(i, 1); mine.delete(e); } }
		refreshCounter();
		if(mine.size) sweeper = setTimeout(sweep, 1500);
	}
	const armSweep = () => { if(!sweeper && mine.size) sweeper = setTimeout(sweep, 1500); };

	/* ------------------------------------------------------------------ UI */
	/* The whole menu is built ONCE. Switching tabs, picking a version or typing in the search box only toggles
	   display / colours on elements that already exist: no element is created or destroyed after start-up. */
	const paints = [];      // functions that recolour a chip from the current state
	function chip(parent, label, color, isOn, setOn, after){
		const b = el('button', 'padding:4px 9px;margin:2px 3px 2px 0;border-radius:12px;cursor:pointer;font:bold 11px Arial,sans-serif;border:1px solid #4a4560;background:#1b1628;color:#a99fc4;', label);
		let last = null;
		const paint = () => { const a = !!isOn(); if(a === last) return; last = a; b.style.borderColor = a ? color : '#4a4560'; b.style.background = a ? color + '33' : '#1b1628'; b.style.color = a ? color : '#a99fc4'; };
		b.onclick = () => { setOn(); b.blur(); paints.forEach(p => p()); if(after) after(); };
		paints.push(paint); paint(); parent.appendChild(b);
		return b;
	}
	function section(parent, title){ parent.appendChild(el('div', 'font-size:10px;letter-spacing:1px;color:#8d83ad;margin:9px 0 3px;', title)); }

	let listWrap = null, optsEl = null, panes = {}, rowsByTab = {};
	function build(){
		built = true;
		drawer = el('div', 'position:fixed;z-index:35;top:90px;right:14px;width:380px;max-height:calc(100vh - 110px);display:none;flex-direction:column;background:#100b1c;border:1px solid #7a58b8;border-radius:10px;color:#e8dcff;font:12px Arial,sans-serif;contain:layout paint;');   // opaque and shadow-free: nothing for the browser to re-blend over the game canvas
		drawer.id = 'spawnMenu';
		const head = el('div', 'display:flex;align-items:center;padding:9px 12px;border-bottom:1px solid #3a2d5a;');
		head.appendChild(el('div', 'flex:1;font-weight:bold;letter-spacing:1px;color:#c9a8ff;', 'SPAWN MENU'));
		perfEl = el('div', 'font-size:10px;color:#6f6690;margin-right:10px;', '');
		head.appendChild(perfEl);
		const x = el('button', 'background:none;border:none;color:#b9a8e0;font-size:16px;cursor:pointer;', '✕'); x.onclick = toggle; head.appendChild(x);
		drawer.appendChild(head);

		const body = el('div', 'padding:8px 12px;overflow:auto;');
		const search = el('input', 'width:100%;box-sizing:border-box;padding:6px 9px;border-radius:6px;border:1px solid #4a3a72;background:#1a1330;color:#fff;font:12px Arial,sans-serif;');
		search.placeholder = 'Search…'; search.oninput = () => { S.q = search.value.toLowerCase(); applyFilter(); };
		body.appendChild(search);
		const tabs = el('div', 'margin-top:6px;'); tabs.id = 'spawnTabs'; body.appendChild(tabs);
		const E = entries();
		const TT = [['enemies', 'Enemies (' + E.enemies.length + ')', '#7be0a8'], ['minis', 'Mini-bosses (' + E.minis.length + ')', '#ffb454'], ['bosses', 'Bosses (' + E.bosses.length + ')', '#ff6b7a']];
		if(C.mages) TT.push(['mages', 'Rune mages', '#c9a8ff']);
		for(const t of TT) chip(tabs, t[1], t[2], () => S.tab === t[0], () => { S.tab = t[0]; }, showTab);

		listWrap = el('div', 'margin-top:4px;height:300px;overflow:auto;border:1px solid #2e2347;border-radius:6px;background:#0d0817;');
		for(const t of TT){
			const pane = el('div', 'display:none;'); panes[t[0]] = pane; rowsByTab[t[0]] = [];
			if(t[0] === 'mages') buildMages(pane); else buildRows(pane, t[0], E[t[0]]);
			listWrap.appendChild(pane);
		}
		body.appendChild(listWrap);

		optsEl = el('div'); body.appendChild(optsEl);
		section(optsEl, 'VERSION'); const r1 = el('div'); for(const t of TIERS) chip(r1, t[0], t[2], () => S.tier === t[1], () => { S.tier = t[1]; }); optsEl.appendChild(r1);
		section(optsEl, 'COUNT'); const r2 = el('div'); for(const n of COUNTS) chip(r2, '×' + n, '#7bc8ff', () => S.count === n, () => { S.count = n; }); optsEl.appendChild(r2);
		section(optsEl, 'HEALTH'); const r3 = el('div'); for(const h of HPS) chip(r3, h[0], '#9be37b', () => S.hp === h[1], () => { S.hp = h[1]; }); optsEl.appendChild(r3);
		section(optsEl, 'BEHAVIOUR · PLACE'); const r4 = el('div');
		chip(r4, 'Hostile', '#ff8a8a', () => !S.passive, () => { S.passive = false; });
		chip(r4, 'Passive (dummy)', '#b8c4ff', () => S.passive, () => { S.passive = true; });
		chip(r4, 'Next to me', '#ffd166', () => S.where === 'me', () => { S.where = 'me'; });
		chip(r4, 'Arena centre', '#ffd166', () => S.where === 'center', () => { S.where = 'center'; });
		optsEl.appendChild(r4);
		if(root.NightmareSystem){
			section(optsEl, 'NIGHTMARE MUTATIONS (elite traits)');
			const r5 = el('div'), seen = new Set();
			const all = root.NightmareSystem.GENERIC.concat(...Object.values(root.NightmareSystem.DUNGEON_MUT));
			for(const m of all){ if(seen.has(m.id)) continue; seen.add(m.id); const c = chip(r5, m.name, '#e58bff', () => S.muts.has(m.id), () => { S.muts.has(m.id) ? S.muts.delete(m.id) : S.muts.add(m.id); }); c.title = m.desc; }
			optsEl.appendChild(r5);
		}

		const foot = el('div', 'display:flex;gap:6px;margin-top:10px;align-items:center;');
		const c1 = el('button', 'padding:6px 10px;border-radius:6px;cursor:pointer;background:#2a2238;color:#ddd;border:1px solid #665;font:12px Arial,sans-serif;', 'Clear spawned'); c1.onclick = () => { clearMine(); c1.blur(); };
		const c2 = el('button', 'padding:6px 10px;border-radius:6px;cursor:pointer;background:#3a1e28;color:#ffb3c0;border:1px solid #8a4455;font:12px Arial,sans-serif;', 'Clear everything'); c2.onclick = () => { clearAll(); c2.blur(); };
		counterEl = el('div', 'flex:1;text-align:right;color:#8d83ad;font-size:11px;', '0 spawned enemies alive');
		foot.appendChild(c1); foot.appendChild(c2); foot.appendChild(counterEl);
		body.appendChild(foot);
		const nh = Object.keys(NOT_HERE).map(k => (C.types()[k] ? C.types()[k].name || k : k)).join(', ');
		body.appendChild(el('div', 'font-size:10.5px;color:#7d7396;margin-top:7px;line-height:1.35;', 'Click an entry to spawn it. Version, mutations and count apply to everything you spawn. Esc closes.' + (nh ? ' Not listed (they only work in their own raid / dungeon room): ' + nh + '.' : '')));
		drawer.appendChild(body);
		isolate(drawer);
		document.body.appendChild(drawer);
		window.addEventListener('keydown', (e) => { if(e.key === 'Escape' && drawer.style.display !== 'none'){ toggle(); e.stopPropagation(); } }, true);
		showTab();
	}

	function hover(row){ row.onmouseenter = () => { row.style.background = '#1d1530'; if(row._pre) row._pre(); }; row.onmouseleave = () => { row.style.background = ''; }; }
	function buildRows(pane, tab, list){
		const frag = document.createDocumentFragment();
		for(const r of list){
			const row = el('div', 'display:flex;align-items:center;padding:5px 9px;border-bottom:1px solid #20182f;cursor:pointer;',
				'<span style="width:11px;height:11px;border-radius:3px;background:' + r.color + ';margin-right:8px;flex:none"></span>' +
				'<span style="flex:1"><b>' + r.name + '</b>' + (r.flies ? ' <span style="color:#7bc8ff;font-size:10px">flying</span>' : '') + '</span>' +
				'<span style="color:#8d83ad;font-size:10.5px">' + (r.hp >= 1000 ? (r.hp / 1000).toFixed(r.hp >= 10000 ? 0 : 1) + 'k' : r.hp) + ' hp</span>');
			row.title = r.id + ' — ' + r.w + '×' + r.h;
			row.onclick = () => spawn(r.id);
			row._pre = () => { row._pre = null; if(C.prefetch) C.prefetch(r.id); if(root.MiniBossKit) MiniBossKit.prefetch(r.id, S.tier); };      // load + decode its art while the pointer is over it, so spawning it does not stall on the image
			hover(row); row._q = (r.name + ' ' + r.id).toLowerCase();
			frag.appendChild(row); rowsByTab[tab].push(row);
		}
		pane.appendChild(frag);
	}
	function buildMages(pane){
		const K = C.mages.KINDS;
		for(const id in K){
			const k = K[id];
			const row = el('div', 'padding:6px 9px;border-bottom:1px solid #20182f;cursor:pointer;border-left:3px solid ' + k.color + ';', '<b style="color:' + k.color + '">' + k.name + '</b> <span style="color:#a99fc4">' + k.title + '</span>' + (k.boss ? ' <span style="float:right;color:#ff6b7a;font-size:10px">BOSS</span>' : '') + '<br><span style="color:#7d7396;font-size:10.5px">' + k.techniques.join(' + ') + '</span>');
			row.title = k.blurb || '';
			row.onclick = (ev) => {
				if(!ev.shiftKey) C.mages.clear();
				const cx = C.centerX;
				C.mages.spawn(id, cx + (ev.shiftKey ? (Math.random() - 0.5) * 400 : 0), C.groundY - 4);
				C.say(cx, C.groundY - 120, k.name + ' enters the arena', k.color);
			};
			hover(row); row._q = (k.name + ' ' + k.title).toLowerCase();
			pane.appendChild(row); rowsByTab.mages.push(row);
		}
		if(C.trial){
			const t = el('a', 'display:block;margin:6px;padding:7px 8px;border-radius:6px;text-align:center;text-decoration:none;color:#ffe7b0;background:linear-gradient(90deg,#2a2113,#1a1530);border:1px solid #e9c46a;font:bold 12px Arial,sans-serif;', C.trial.active ? 'Leave the trial (infinite energy again)' : '⚜ The Grand Arcanist — Trial (your real energy)');
			t.href = C.trial.href; t.title = 'An endgame boss who uses no techniques. In the trial your energy reserve and regeneration are real, as in a dungeon.'; pane.appendChild(t);
		}
		const cm = el('button', 'margin:2px 6px 6px;padding:5px 10px;border-radius:6px;background:#2a2238;color:#ccc;border:1px solid #554;cursor:pointer;font:12px Arial,sans-serif;', 'Clear mages'); cm.onclick = () => { C.mages.clear(); cm.blur(); }; pane.appendChild(cm);
		pane.appendChild(el('div', 'padding:0 9px 8px;color:#7d7396;font-size:10.5px;line-height:1.35;', 'Shift-click adds another instead of replacing. They cast real rune spells with their own energy; your Anti-Magic, gravity and portals work on their magic too.'));
	}
	function applyFilter(){
		const rows = rowsByTab[S.tab] || [];
		for(const r of rows){ const show = !S.q || r._q.includes(S.q); const d = show ? '' : 'none'; if(r.style.display !== d) r.style.display = d; }
	}
	function showTab(){
		for(const k in panes){ const d = k === S.tab ? '' : 'none'; if(panes[k].style.display !== d) panes[k].style.display = d; }
		optsEl.style.display = S.tab === 'mages' ? 'none' : '';
		applyFilter();
	}

	/* a tiny frame-time readout in the header while the menu is open: the worst frame of the last two seconds.
	   If the menu ever stutters on your machine, this number says whether the game itself is what slowed. */
	let perfEl = null, perfRAF = 0, perfLast = 0, perfWorst = 0, perfT = 0;
	function perfLoop(t){
		if(!drawer || drawer.style.display === 'none'){ perfRAF = 0; return; }
		if(perfLast){ const d = t - perfLast; if(d > perfWorst) perfWorst = d; }
		perfLast = t;
		if(t - perfT > 2000){ perfT = t; if(perfEl) perfEl.textContent = 'worst frame ' + Math.round(perfWorst) + ' ms'; perfWorst = 0; }
		perfRAF = requestAnimationFrame(perfLoop);
	}

	function toggle(){
		if(!built) build();
		const open = drawer.style.display === 'none';
		drawer.style.display = open ? 'flex' : 'none';
		if(btn) btn.style.background = open ? 'linear-gradient(#6a3d9a,#3b2166)' : 'linear-gradient(#2f5b3f,#1a3a28)';
		if(open && !perfRAF){ perfLast = 0; perfRAF = requestAnimationFrame(perfLoop); }
	}

	function init(ctx){
		C = ctx;
		btn = el('button', 'position:fixed;z-index:30;top:52px;right:170px;padding:8px 14px;color:#e9ffe9;background:linear-gradient(#2f5b3f,#1a3a28);border:1px solid #6fd59a;border-radius:8px;cursor:pointer;font:bold 13px Arial,sans-serif;box-shadow:0 2px 10px #0008;', '☰ Spawn Menu');
		btn.id = 'spawnMenuBtn'; btn.title = 'Spawn any enemy, mini-boss or boss, including Alpha / Elder / Tyrant versions';
		btn.onclick = () => { toggle(); btn.blur(); };
		if(ctx.openMages){ S.tab = 'mages'; setTimeout(() => { if(drawer == null || drawer.style.display === 'none') toggle(); }, 600); }   // the Mage Arena opens on the mage list, as the old side panel was always visible
		isolate(btn);
		document.body.appendChild(btn);
		build();      // built hidden up front, so opening it later is just a display switch
	}

	root.SpawnMenu = { init, toggle, spawn, clearMine, clearAll, state: S, _mine: mine };
})(window);
