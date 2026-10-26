/*
 * RUNE FORGE — visual editor for MagicEngine spell trees.
 * A giant pan/zoom canvas of rune slots. Every slot has eight "+" sockets (N NE E SE S SW W NW);
 * every parent→child edge carries a connector (Instant / Delay / Condition).
 * The editor only builds the definition; MagicEngine validates and runs it.
 */
(function(root){
	'use strict';
	const ME = root.MagicEngine;
	if(!ME){ console.warn('[MagicForge] MagicEngine missing'); return; }

	const GX = 280, GY = 190, HW = 88, HH = 44;
	const SIGNED_LABELS = { compress:['Expand','Compress'], force:['Pull','Push'] };
	const CAT_COLOR = {}; ME.CATEGORIES.forEach(c => { CAT_COLOR[c.id] = c.color; });
	const LINK_ICON = { instant:'⚡', delay:'⏱', condition:'◆' };

	let S = null;

	/* ------------------------------------------------------------------ utils */
	function h(tag, cls, html){ const e = document.createElement(tag); if(cls) e.className = cls; if(html != null) e.innerHTML = html; return e; }
	function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
	function clamp(v, a, b){ return v < a ? a : (v > b ? b : v); }
	function clone(o){ return JSON.parse(JSON.stringify(o)); }
	function runeColor(n){ const R = n && ME.Runes[n.type]; return R ? (CAT_COLOR[R.category] || '#9fe6ff') : '#7d88ad'; }
	function key(gx, gy){ return gx + ',' + gy; }
	function nodesArr(){ return Object.keys(S.def.nodes).map(k => S.def.nodes[k]); }
	function count(){ return Object.keys(S.def.nodes).length; }
	function kidsOf(id){ return S.idx.kids[id] || []; }
	function subtree(id){ const out = []; const st = [id]; while(st.length){ const c = st.pop(); out.push(c); for(const k of kidsOf(c)) st.push(k); } return out; }
	function ancestors(id){ const out = []; let n = S.def.nodes[id]; let g = 0; while(n && n.parent && g++ < 200){ out.push(n.id); n = S.def.nodes[n.parent]; } return out; }
	function isHidden(id){ let n = S.def.nodes[id]; let g = 0; while(n && n.parent && g++ < 200){ const p = S.def.nodes[n.parent]; if(p && p.ui && p.ui.collapsed) return true; n = p; } return false; }
	function fmt(v){ v = Number(v); return Math.abs(v - Math.round(v)) < 1e-6 ? String(Math.round(v)) : v.toFixed(2).replace(/0$/, ''); }

	/* ------------------------------------------------------------------ open / close */
	function open(opts){
		if(S) close(true);
		const def = ME.normalize(opts.spell && ME.isMagicSpell(opts.spell) ? clone(opts.spell) : ME.blankSpell('New Spell'));
		S = {
			opts, def, profile: opts.profile || ME.deriveProfile({}),
			sel: null, view: { x:0, y:0, z:1, tx:0, ty:0, tz:1 }, undo: [], redo: [], dirty: false,
			nodeEls: {}, linkEls: {}, loopEls: {}, occupied: {}, idx: ME.indexOf(def), report: null,
			debug: false, raf: 0, justCreated: null, newLink: null, hoverPath: null, search: { q:'', hits:[], i:0 },
			preview: null, editing: false
		};
		buildShell();
		refresh();
		requestAnimationFrame(() => { S.els.root.classList.add('open'); fit(true); });
		startPreview();
		S.raf = requestAnimationFrame(tick);
		document.addEventListener('keydown', onKey, true);
		window.addEventListener('resize', onResize);
		if(count() === 1 && !S.def.nodes[S.def.rootId].type) setTimeout(() => S && openPicker(S.def.rootId, 'new-root'), 380);
	}

	function close(force){
		if(!S) return;
		if(!force && S.dirty){ confirmDiscard(); return; }
		if(window.ShapeEditor && window.ShapeEditor._state && window.ShapeEditor._state()) window.ShapeEditor.close();
		cancelAnimationFrame(S.raf);
		document.removeEventListener('keydown', onKey, true);
		window.removeEventListener('resize', onResize);
		const rootEl = S.els.root; const cb = S.opts.onClose;
		rootEl.classList.remove('open');
		setTimeout(() => rootEl.remove(), 260);
		S = null;
		if(cb) cb();
	}

	function save(andClose){
		const rep = ME.validate(S.def, S.profile);
		const out = clone(S.def);
		out.name = (S.els.name.value || 'Spell').slice(0, 32);
		S.def.name = out.name;
		if(S.opts.onSave) S.opts.onSave(out, rep);
		S.dirty = false; S.els.root.classList.remove('is-dirty');
		toast(rep.ok ? 'Spell saved' : 'Saved with ' + rep.errors.length + ' problem' + (rep.errors.length > 1 ? 's' : '') + ' — fix before casting', rep.ok ? 'ok' : 'err');
		if(andClose) close(true);
	}

	/* ------------------------------------------------------------------ shell */
	function buildShell(){
		const r = h('div', 'mf-root insp-show');
		r.innerHTML = `
			<canvas class="mf-bg"></canvas>
			<div class="mf-viewport"><div class="mf-world"><svg class="mf-links" xmlns="http://www.w3.org/2000/svg"></svg></div></div>
			<div class="mf-hint-float"></div>
			<header class="mf-top">
				<button class="mf-btn" data-a="close" title="Back to spell slots (Esc)">←<span class="lbl">Slots</span></button>
				<div class="mf-brand"><b>RUNE FORGE</b><span class="mf-slot"></span></div>
				<input class="mf-name-in" maxlength="32" spellcheck="false" />
				<span class="mf-dirty" title="Unsaved changes"></span>
				<div class="mf-meters">
					<div class="mf-meter" data-m="runes"><div class="mf-meter-top"><span>Runes</span><b></b></div><div class="mf-bar"><i></i></div></div>
					<div class="mf-meter" data-m="cost"><div class="mf-meter-top"><span>Energy cost</span><b></b></div><div class="mf-bar"><i></i></div></div>
					<div class="mf-meter" data-m="output"><div class="mf-meter-top"><span>Peak output</span><b></b></div><div class="mf-bar"><i></i></div></div>
				</div>
				<div class="mf-btns">
					<button class="mf-btn" data-a="undo" title="Undo (Ctrl+Z)">↶</button>
					<button class="mf-btn" data-a="redo" title="Redo (Ctrl+Y)">↷</button>
					<span class="mf-sep"></span>
					<button class="mf-btn" data-a="search" title="Find runes (Ctrl+F)">⌕</button>
					<button class="mf-btn" data-a="tech" title="Technique Points">✧<span class="lbl">Techniques</span></button>
					<button class="mf-btn" data-a="tests" title="Development test spells and engine checks">🧪<span class="lbl">Tests</span></button>
					<button class="mf-btn" data-a="debug" title="Debug: highlight executing runes and show runtime data (D)">⚙<span class="lbl">Debug</span></button>
					<button class="mf-btn" data-a="passive" title="Passive spell: casting it switches it on; it keeps running (re-casting itself when it ends) with a constant drain on your energy, about 30% more than casting it yourself. Reinforcement from a passive spell holds steady instead of fading. Cast again to switch it off.">∞<span class="lbl">Passive</span></button>
					<button class="mf-btn" data-a="share" title="Export / import spell code">⇄</button>
					<button class="mf-btn" data-a="insp" title="Toggle inspector (I)">▤</button>
					<span class="mf-sep"></span>
					<button class="mf-btn primary" data-a="save" title="Save (Ctrl+S)">Save</button>
					<button class="mf-btn danger" data-a="reset" title="Reset spell — remove every rune and start from an empty slot (undo with Ctrl+Z)">⟲<span class="lbl">Reset</span></button>
				</div>
			</header>
			<div class="mf-search"><span>⌕</span><input placeholder="Find rune… (Enter = next)" /><span class="cnt"></span></div>
			<aside class="mf-insp"><div class="mf-insp-head"></div><div class="mf-insp-body"></div></aside>
			<div class="mf-mini" title="Minimap — click to jump"><canvas width="380" height="256"></canvas></div>
			<div class="mf-zoomctl">
				<button class="mf-btn" data-a="zoomout" title="Zoom out">−</button><span class="zv">100%</span>
				<button class="mf-btn" data-a="zoomin" title="Zoom in">+</button>
				<button class="mf-btn" data-a="fit" title="Fit tree (F)">⤢</button>
				<button class="mf-btn" data-a="center" title="Center on selected (C)">◎</button>
			</div>
			<section class="mf-prev">
				<div class="mf-prev-head"><span class="mf-live"></span><b>Live Preview</b><span class="sp"></span>
					<button class="mf-btn" data-a="shots" title="Spawn slow enemy shots you can target with 'Active spell / projectile'">☄ Shots</button>
					<button class="mf-btn" data-a="recast" title="Recast now (R)">⟲</button>
					<button class="mf-btn" data-a="pause" title="Pause / resume (P)">❚❚</button>
					<button class="mf-btn" data-a="big" title="Enlarge preview">⤡</button>
					<button class="mf-btn" data-a="prevtoggle" title="Hide preview">▾</button>
				</div>
				<div class="mf-prev-body"><canvas width="800" height="400"></canvas><div class="mf-prev-msg" style="display:none"></div></div>
				<div class="mf-debug"></div>
			</section>
			<div class="mf-toast"></div>`;
		document.body.appendChild(r);
		const q = s => r.querySelector(s);
		S.els = {
			root: r, bg: q('.mf-bg'), vp: q('.mf-viewport'), world: q('.mf-world'), svg: q('.mf-links'),
			name: q('.mf-name-in'), slot: q('.mf-slot'), insHead: q('.mf-insp-head'), insBody: q('.mf-insp-body'),
			mini: q('.mf-mini canvas'), zv: q('.zv'), prev: q('.mf-prev'), prevCanvas: q('.mf-prev canvas'), prevMsg: q('.mf-prev-msg'),
			dbg: q('.mf-debug'), toast: q('.mf-toast'), search: q('.mf-search'), searchIn: q('.mf-search input'), searchCnt: q('.mf-search .cnt'),
			hint: q('.mf-hint-float'), meters: {}
		};
		r.querySelectorAll('.mf-meter').forEach(m => { S.els.meters[m.dataset.m] = m; });
		S.els.name.value = S.def.name;
		{ const pb = r.querySelector('[data-a=passive]'); if(pb) pb.classList.toggle('on', !!S.def.passive); }
		S.els.slot.textContent = S.opts.slotLabel || ('Slot ' + ((S.opts.slot | 0) + 1));
		S.els.name.addEventListener('input', () => { S.def.name = S.els.name.value; markDirty(); });
		r.addEventListener('click', onChromeClick);
		r.addEventListener('contextmenu', e => e.preventDefault());
		bindViewport();
		S.els.mini.parentElement.addEventListener('pointerdown', onMiniClick);
		S.els.searchIn.addEventListener('input', () => runSearch(S.els.searchIn.value));
		S.els.searchIn.addEventListener('keydown', e => {
			if(e.key === 'Enter'){ e.preventDefault(); cycleSearch(); }
			if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); closeSearch(); }
		});
		sizeBg();
	}

	function onChromeClick(e){
		const b = e.target.closest('[data-a]'); if(!b) return;
		const a = b.dataset.a;
		switch(a){
			case 'close': close(); break;
			case 'save': save(false); break;
			case 'undo': undo(); break;
			case 'redo': redo(); break;
			case 'fit': fit(); break;
			case 'center': if(S.sel && S.sel.type === 'node') centerOn(S.sel.id); else fit(); break;
			case 'zoomin': zoomBy(1.2); break;
			case 'zoomout': zoomBy(1 / 1.2); break;
			case 'debug': S.debug = !S.debug; S.els.root.classList.toggle('debug', S.debug); b.classList.toggle('on', S.debug); if(S.preview) S.preview.world.debug = S.debug; toast(S.debug ? 'Debug on — executing runes highlight, runtime data below the preview' : 'Debug off'); break;
			case 'insp': S.els.root.classList.toggle('insp-hidden'); break;
			case 'search': openSearch(); break;
			case 'tech': openTechniques(); break;
			case 'tests': openTests(); break;
			case 'reset': confirmReset(); break;
			case 'passive': pushUndo(); S.def.passive = !S.def.passive; b.classList.toggle('on', !!S.def.passive); markDirty(); toast(S.def.passive ? '∞ Passive: casting switches it on — it keeps running with a constant energy drain' : 'Passive off: an ordinary spell again'); break;
			case 'share': openShare(); break;
			case 'recast': if(S.preview) recastPreview(true); break;
			case 'pause': if(S.preview){ S.preview.paused = !S.preview.paused; b.textContent = S.preview.paused ? '▶' : '❚❚'; } break;
			case 'big': S.els.prev.classList.toggle('big'); break;
			case 'shots': if(S.preview){ S.preview.shotsOn = !S.preview.shotsOn; b.classList.toggle('on', S.preview.shotsOn); } break;
			case 'prevtoggle': S.els.prev.classList.toggle('closed'); b.textContent = S.els.prev.classList.contains('closed') ? '▴' : '▾'; break;
		}
	}

	/* ------------------------------------------------------------------ refresh */
	function refresh(opt){
		opt = opt || {};
		S.idx = ME.indexOf(S.def);
		S.report = ME.validate(S.def, S.profile);
		renderTree();
		renderMeters();
		if(!opt.keepInspector) renderInspector(); else renderInspectorLive();
		const bU = S.els.root.querySelector('[data-a=undo]'), bR = S.els.root.querySelector('[data-a=redo]');
		bU.disabled = !S.undo.length; bR.disabled = !S.redo.length;
		if(S.preview) S.preview.dirtyAt = performance.now();
		if(S.search.q) runSearch(S.search.q, true);
	}
	function markDirty(){ S.dirty = true; S.els.root.classList.add('is-dirty'); }
	function snapshot(){ return JSON.stringify({ def: S.def, sel: S.sel }); }
	function pushUndo(){ S.undo.push(snapshot()); if(S.undo.length > 150) S.undo.shift(); S.redo.length = 0; }
	function restore(snap){ const o = JSON.parse(snap); S.def = o.def; S.sel = o.sel && (o.sel.type === 'node' ? S.def.nodes[o.sel.id] : S.def.nodes[o.sel.id]) ? o.sel : null; S.els.name.value = S.def.name; markDirty(); refresh(); }
	function restoreQuiet(snap){ const o = JSON.parse(snap); S.def = o.def; S.sel = o.sel; refresh(); }
	function undo(){ if(!S.undo.length) return; S.redo.push(snapshot()); restore(S.undo.pop()); toast('Undo'); }
	function redo(){ if(!S.redo.length) return; S.undo.push(snapshot()); restore(S.redo.pop()); toast('Redo'); }

	/* ------------------------------------------------------------------ geometry */
	function nodePos(n){ return { x: n.gx * GX, y: n.gy * GY }; }
	function linkGeom(p, c){
		const a = nodePos(p), b = nodePos(c);
		const dx = b.x - a.x, dy = b.y - a.y;
		let sx, sy, ex, ey, c1x, c1y, c2x, c2y;
		const gdx = c.gx - p.gx, gdy = c.gy - p.gy;
		if(gdx && gdy && Math.abs(gdx) === Math.abs(gdy)){      // a diagonal socket: corner to corner
			const qx = Math.sign(dx), qy = Math.sign(dy);
			sx = a.x + qx * HW; sy = a.y + qy * HH; ex = b.x - qx * HW; ey = b.y - qy * HH;
			const k = Math.max(40, Math.abs(ex - sx) * 0.45);
			c1x = sx + qx * k; c1y = sy; c2x = ex - qx * k; c2y = ey;
		} else if(Math.abs(dx) * GY >= Math.abs(dy) * GX){
			const s = Math.sign(dx) || 1;
			sx = a.x + s * HW; sy = a.y; ex = b.x - s * HW; ey = b.y;
			const k = Math.max(40, Math.abs(ex - sx) * 0.5);
			c1x = sx + s * k; c1y = sy; c2x = ex - s * k; c2y = ey;
		} else {
			const s = Math.sign(dy) || 1;
			sx = a.x; sy = a.y + s * HH; ex = b.x; ey = b.y - s * HH;
			const k = Math.max(40, Math.abs(ey - sy) * 0.5);
			c1x = sx; c1y = sy + s * k; c2x = ex; c2y = ey - s * k;
		}
		const mx = 0.125 * sx + 0.375 * c1x + 0.375 * c2x + 0.125 * ex;
		const my = 0.125 * sy + 0.375 * c1y + 0.375 * c2y + 0.125 * ey;
		const O = 6000;
		return { d: `M${sx + O},${sy + O} C${c1x + O},${c1y + O} ${c2x + O},${c2y + O} ${ex + O},${ey + O}`, mx, my };
	}
	function parentSide(n){
		if(!n.parent) return null;
		const p = S.def.nodes[n.parent]; if(!p) return null;
		const dx = p.gx - n.gx, dy = p.gy - n.gy;
		if(dx && dy && Math.abs(dx) === Math.abs(dy)) return (dy > 0 ? 's' : 'n') + (dx > 0 ? 'e' : 'w');      // a diagonal parent
		if(Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'e' : 'w';
		return dy > 0 ? 's' : 'n';
	}

	/* ------------------------------------------------------------------ tree render */
	function renderTree(){
		const world = S.els.world, svg = S.els.svg;
		for(const id in S.nodeEls) S.nodeEls[id].remove();
		for(const id in S.linkEls) if(S.linkEls[id].badge) S.linkEls[id].badge.remove();
		for(const id in (S.loopEls || {})) if(S.loopEls[id].badge) S.loopEls[id].badge.remove();
		svg.innerHTML = '';
		S.nodeEls = {}; S.linkEls = {}; S.loopEls = {}; S.occupied = {};
		for(const n of nodesArr()) if(n.loop && n.loop.to && !S.def.nodes[n.loop.to]) n.loop.to = null;      // the rune it returned to is gone
		const rep = S.report, cap = S.profile.runeCapacity, full = count() >= cap;
		for(const n of nodesArr()) S.occupied[key(n.gx, n.gy)] = n.id;

		// links first (under nodes)
		const frag = document.createDocumentFragment();
		for(const n of nodesArr()){
			if(!n.parent || isHidden(n.id)) continue;
			const p = S.def.nodes[n.parent]; if(!p) continue;
			const g = linkGeom(p, n);
			const mode = (n.link && n.link.mode) || 'instant';
			const linkErr = rep.byLink[n.id];
			const NS = 'http://www.w3.org/2000/svg';
			const glow = document.createElementNS(NS, 'path'); glow.setAttribute('d', g.d); glow.setAttribute('class', 'mf-link-glow ' + mode);
			const path = document.createElementNS(NS, 'path'); path.setAttribute('d', g.d); path.setAttribute('class', 'mf-link ' + mode + (linkErr ? ' err' : '') + (S.newLink === n.id ? ' new' : ''));
			const flow = document.createElementNS(NS, 'path'); flow.setAttribute('d', g.d); flow.setAttribute('class', 'mf-link-flow ' + mode);
			svg.appendChild(glow); svg.appendChild(path); svg.appendChild(flow);
			const badge = h('div', 'mf-badge ' + mode + (linkErr ? ' err' : '') + (S.sel && S.sel.type === 'link' && S.sel.id === n.id ? ' selected' : ''));
			badge.style.left = g.mx + 'px'; badge.style.top = g.my + 'px';
			badge.innerHTML = '<i>' + LINK_ICON[mode] + '</i><span>' + esc(linkLabel(n.link)) + '</span>';
			const ins = h('button', 'mf-insert', '+');
			ins.title = count() >= S.profile.runeCapacity ? 'Rune capacity reached' : 'Insert a rune between these two';
			ins.addEventListener('pointerdown', e => e.stopPropagation());
			ins.addEventListener('click', e => { e.stopPropagation(); insertBetween(n.id); });
			badge.appendChild(ins);
			badge.title = linkErr ? linkErr.map(e => '⚠ ' + e.text).join('\n') : linkTitle(n.link);
			badge.addEventListener('pointerdown', e => e.stopPropagation());
			badge.addEventListener('click', e => { e.stopPropagation(); select({ type:'link', id:n.id }); });
			badge.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); select({ type:'link', id:n.id }); linkMenu(n.id, e); });
			frag.appendChild(badge);
			S.linkEls[n.id] = { path, glow, flow, badge };
		}
		// loop return branches: a dashed arrow from a Loop rune back to the earlier rune it repeats from
		{
			const NS = 'http://www.w3.org/2000/svg';
			const defs = document.createElementNS(NS, 'defs');
			defs.innerHTML = '<marker id="mfLoopHead" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="' + LOOP_COL + '"/></marker>';
			svg.appendChild(defs);
			for(const n of nodesArr()){
				if(n.type !== 'loop' || !n.loop || !n.loop.to || isHidden(n.id) || isHidden(n.loop.to)) continue;
				const t = S.def.nodes[n.loop.to]; if(!t) continue;
				const g = loopGeom(n, t);
				const bad = rep.byLink['loop:' + n.id];
				const glow = document.createElementNS(NS, 'path'); glow.setAttribute('d', g.d); glow.setAttribute('class', 'mf-loop-glow');
				const path = document.createElementNS(NS, 'path'); path.setAttribute('d', g.d); path.setAttribute('class', 'mf-loop' + (bad ? ' err' : '')); path.setAttribute('marker-end', 'url(#mfLoopHead)');
				const flow = document.createElementNS(NS, 'path'); flow.setAttribute('d', g.d); flow.setAttribute('class', 'mf-loop-flow');
				svg.appendChild(glow); svg.appendChild(path); svg.appendChild(flow);
				const badge = h('div', 'mf-badge loop' + (bad ? ' err' : '') + (S.sel && S.sel.type === 'loop' && S.sel.id === n.id ? ' selected' : ''));
				badge.style.left = g.mx + 'px'; badge.style.top = g.my + 'px';
				badge.innerHTML = '<i>↻</i><span>' + esc(loopLabel(n)) + '</span>';
				badge.title = bad ? bad.map(e => '⚠ ' + e.text).join('\n') : loopTitle(n);
				badge.addEventListener('pointerdown', e => e.stopPropagation());
				badge.addEventListener('click', e => { e.stopPropagation(); select({ type:'loop', id:n.id }); });
				badge.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); select({ type:'loop', id:n.id }); loopMenu(n.id, e); });
				frag.appendChild(badge);
				S.loopEls[n.id] = { path, glow, flow, badge };
			}
		}
		// nodes
		for(const n of nodesArr()){
			if(isHidden(n.id)) continue;
			const el = buildNode(n, full, cap);
			frag.appendChild(el);
			S.nodeEls[n.id] = el;
		}
		world.appendChild(frag);
		S.justCreated = null; S.newLink = null;
		const empty = count() === 1 && !S.def.nodes[S.def.rootId].type;
		S.els.hint.style.opacity = empty ? 1 : 0;
		S.els.hint.textContent = empty ? 'Every spell begins with one rune slot. Choose its rune, then grow the tree with the + sockets.' : '';
		if(S.hoverPath) highlightPath(S.hoverPath);
	}

	/* ------------------------------------------------------------------ loop return branch */
	const LOOP_COL = '#ffe08a';
	function loopGeom(n, t){
		const a = nodePos(n), b = nodePos(t), O = 6000;
		let sx, sy, ex, ey, c1x, c1y, c2x, c2y;
		if(Math.abs(a.x - b.x) < GX * 0.5){      // straight above it: out of the right-hand side and back in
			sx = a.x + HW; sy = a.y; ex = b.x + HW; ey = b.y;
			const k = 110 + Math.min(120, Math.abs(ey - sy) * 0.1);
			c1x = sx + k; c1y = sy; c2x = ex + k; c2y = ey;
		} else {                                  // a different column: an arc under the runes, from this one's bottom to that one's bottom
			sx = a.x; sy = a.y + HH; ex = b.x; ey = b.y + HH;
			const k = 70 + Math.min(150, Math.abs(ex - sx) * 0.12);
			c1x = sx; c1y = sy + k; c2x = ex; c2y = ey + k;
		}
		const mx = 0.125 * sx + 0.375 * c1x + 0.375 * c2x + 0.125 * ex, my = 0.125 * sy + 0.375 * c1y + 0.375 * c2y + 0.125 * ey;
		return { d: `M${sx + O},${sy + O} C${c1x + O},${c1y + O} ${c2x + O},${c2y + O} ${ex + O},${ey + O}`, mx, my };
	}
	function loopLabel(n){
		const L = n.loop || {}, p = n.params || {};
		let s = '×' + (p.times | 0);
		if(L.mode === 'condition'){ const c = ME.Conditions[L.cond && L.cond.type]; s += (L.check === 'now' ? ' while ' : ' on ') + (c ? c.name.toLowerCase() : '?'); }
		return s;
	}
	function loopTitle(n){
		const L = n.loop || {}, p = n.params || {}, t = L.to && S.def.nodes[L.to];
		let s = 'Loop — runs from ' + runeName(t) + ' down to here again, ' + (p.times | 0) + ' time' + ((p.times | 0) === 1 ? '' : 's') + '. Each repeat costs the repeated runes\' mana × ' + ME.CONFIG.loopFee + '.';
		if(L.mode === 'condition'){ const c = ME.Conditions[L.cond && L.cond.type]; s += L.check === 'now' ? ' It repeats only while "' + (c ? c.name : '?') + '" is still true.' : ' Each repeat waits until "' + (c ? c.name : '?') + '" happens (gives up after ' + fmt(L.cond.timeout) + 's).'; }
		return s;
	}
	function loopMenu(id, e){
		const n = S.def.nodes[id];
		menu(e, [
			{ label:'⚙ Edit the return branch', fn: () => select({ type:'loop', id }) },
			{ label:'↻ Repeat at once', fn: () => { pushUndo(); n.loop.mode = 'instant'; markDirty(); refresh(); } },
			{ label:'◆ Only when something happens…', fn: () => { pushUndo(); n.loop.mode = 'condition'; markDirty(); refresh(); } },
			'-',
			{ label:'✕ Disconnect the return branch', cls:'danger', fn: () => disconnectLoop(id) }
		]);
	}
	function disconnectLoop(id){ const n = S.def.nodes[id]; if(!n || !n.loop || !n.loop.to) return; pushUndo(); n.loop.to = null; markDirty(); if(S.sel && S.sel.type === 'loop') S.sel = { type:'node', id }; refresh(); toast('Return branch disconnected'); }
	/* pull the ⟲ handle onto an earlier rune on this branch: the Loop will return there */
	function onLoopHandleDown(e, id){
		if(e.button === 2) return;
		e.stopPropagation(); e.preventDefault(); closeMenus();
		const n = S.def.nodes[id]; if(!n) return;
		const behind = ancestors(id).slice(1);
		const NS = 'http://www.w3.org/2000/svg';
		const guide = document.createElementNS(NS, 'path'); guide.setAttribute('class', 'mf-loop pulling'); guide.setAttribute('marker-end', 'url(#mfLoopHead)');
		S.els.svg.appendChild(guide);
		for(const k of behind){ const el = S.nodeEls[k]; if(el) el.classList.add('loop-ok'); }
		const vp = S.els.vp, a = nodePos(n);
		let over = null;
		const toWorld = (cx, cy) => { const r = vp.getBoundingClientRect(), v = S.view; return { x: (cx - r.left - v.x) / v.z, y: (cy - r.top - v.y) / v.z }; };
		const onMove = ev => {
			const w = toWorld(ev.clientX, ev.clientY), O = 6000, sx = a.x + HW, sy = a.y;
			const cx = sx + 60 + Math.max(0, (w.x - sx) * 0.4);
			guide.setAttribute('d', `M${sx + O},${sy + O} C${cx + O},${sy + O} ${w.x - 60 + O},${w.y + O} ${w.x + O},${w.y + O}`);
			const el = document.elementFromPoint(ev.clientX, ev.clientY), nd = el && el.closest && el.closest('.mf-node');
			const id2 = nd ? nd.dataset.id : null;
			if(over && S.nodeEls[over]) S.nodeEls[over].classList.remove('loop-hot');
			over = id2 && behind.indexOf(id2) >= 0 ? id2 : null;
			if(over && S.nodeEls[over]) S.nodeEls[over].classList.add('loop-hot');
			guide.classList.toggle('bad', !!id2 && !over && id2 !== id);
		};
		const onUp = ev => {
			window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp);
			guide.remove();
			for(const k in S.nodeEls) S.nodeEls[k].classList.remove('loop-ok', 'loop-hot');
			const el = document.elementFromPoint(ev.clientX, ev.clientY), nd = el && el.closest && el.closest('.mf-node');
			const id2 = nd ? nd.dataset.id : null;
			if(id2 && behind.indexOf(id2) >= 0){
				pushUndo(); n.loop = n.loop || ME.defaultLoop(); n.loop.to = id2; markDirty();
				select({ type:'loop', id }, true); refresh();
				toast('↻ Loop returns to ' + runeName(S.def.nodes[id2]) + ' — click the ↻ badge to give it a condition');
			} else if(id2 && id2 !== id) toast('⚠ A loop can only return to a rune BEFORE it on its own branch', 'err');
			else if(!id2) select({ type:'node', id });
		};
		window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);
	}

	function linkLabel(l){
		l = l || {};
		if(l.mode === 'delay') return fmt(l.delay) + 's';
		if(l.mode === 'condition'){ const c = ME.Conditions[l.cond && l.cond.type]; return c ? c.name : 'Condition?'; }
		return 'Instant';
	}
	function linkTitle(l){
		l = l || {};
		if(l.mode === 'delay') return 'Delay — the next rune waits ' + fmt(l.delay) + 's';
		if(l.mode === 'condition'){ const c = ME.Conditions[l.cond && l.cond.type]; return 'Wait until — ' + (c ? c.name.toLowerCase() : '?') + '. Checked only once execution reaches here; gives up after ' + fmt(l.cond.timeout) + 's.'; }
		return 'Instant — the next rune runs immediately';
	}

	function buildNode(n, full, cap){
		const R = ME.Runes[n.type];
		const col = runeColor(n);
		const rep = S.report;
		const errs = rep.byNode[n.id] || [];
		const hasErr = errs.some(e => e.level === 'error'), hasWarn = !hasErr && errs.length > 0;
		const el = h('div', 'mf-node' + (n.id === S.def.rootId ? ' root' : '') + (!n.type ? ' empty' : '') + (hasErr ? ' error' : '') + (hasWarn ? ' warn' : '')
			+ (S.sel && S.sel.type === 'node' && S.sel.id === n.id ? ' selected' : '') + (S.justCreated === n.id ? ' spawn' : ''));
		el.style.setProperty('--c', col);
		const p = nodePos(n);
		el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
		el.dataset.id = n.id;
		const info = rep.nodeInfo[n.id] || {};
		const tt = techTitle(info); if(tt) el.title = tt;
		const kids = kidsOf(n.id).length;
		let sub = R ? R.summary(n.params || {}, n, kids) : 'Click to choose a rune';
		let chips = '';
		if(R && info.energyOut) chips += '<span class="mf-chip e">E ' + info.energyOut + '</span><span class="mf-chip p">P ' + info.power + '</span>';
		if(R && info.pieces > 1) chips += '<span class="mf-chip d">×' + info.pieces + '</span>';
		if(R && info.target) chips += '<span class="mf-chip t">⌖ ' + esc(info.target) + '</span>';
		el.innerHTML = (n.id === S.def.rootId ? '<span class="mf-root-tag">START</span>' : '')
			+ '<div class="mf-card"><div class="mf-glyph">' + (R ? R.glyph : '?') + '</div>'
			+ '<div class="mf-name">' + (R ? esc(R.name) : 'Empty rune slot') + '</div>'
			+ '<div class="mf-sub">' + esc(sub) + '</div>'
			+ (chips ? '<div class="mf-chips">' + chips + '</div>' : '') + '</div>';
		if(errs.length){
			const b = h('div', 'mf-err-badge' + (hasErr ? '' : ' warn'), hasErr ? '!' : '?');
			const pop = h('div', 'mf-err-pop' + (hasErr ? '' : ' warn'));
			pop.innerHTML = errs.map(e => '<div>' + (e.level === 'error' ? '⚠ ' : '◇ ') + esc(e.text) + '</div>').join('');
			pop.style.display = 'none';
			b.addEventListener('pointerenter', () => { pop.style.display = 'block'; });
			b.addEventListener('pointerleave', () => { pop.style.display = 'none'; });
			el.appendChild(b); el.appendChild(pop);
		}
		if(n.ui && n.ui.collapsed && kids){
			const t = h('div', 'mf-collapsed-tag', '+' + (subtree(n.id).length - 1) + ' hidden');
			t.addEventListener('pointerdown', e => e.stopPropagation());
			t.addEventListener('click', e => { e.stopPropagation(); toggleCollapse(n.id); });
			el.appendChild(t);
		}
		// eight + sockets
		if(!(n.ui && n.ui.collapsed)){
			const ps = parentSide(n);
			for(const d of ['n','ne','e','se','s','sw','w','nw']){
				if(d === ps) continue;
				const v = ME.DIRS[d];
				if(S.occupied[key(n.gx + v.x, n.gy + v.y)]) continue;
				const b = h('button', 'mf-plus ' + d + (full ? ' full' : ''), '+');
				b.title = full ? 'Rune capacity reached (' + count() + '/' + cap + ') — raise Energy Control for more slots' : 'Add a rune here';
				b.addEventListener('pointerdown', e => e.stopPropagation());
				b.addEventListener('click', e => { e.stopPropagation(); addChild(n.id, d); });
				el.appendChild(b);
			}
		}
		if(n.type === 'loop'){
			const hd = h('button', 'mf-loophandle' + (n.loop && n.loop.to ? ' on' : ''), '⟲');
			hd.title = n.loop && n.loop.to ? 'Drag onto a different earlier rune to change where this loop returns' : 'Drag this onto an EARLIER rune on this branch: the loop will repeat from there';
			hd.addEventListener('pointerdown', e => onLoopHandleDown(e, n.id));
			el.appendChild(hd);
		}
		const card = el.querySelector('.mf-card');
		card.addEventListener('pointerdown', e => onNodeDown(e, n.id));
		card.addEventListener('dblclick', e => { e.stopPropagation(); openPicker(n.id, 'change'); });
		card.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); select({ type:'node', id:n.id }); nodeMenu(n.id, e); });
		el.addEventListener('pointerenter', () => { S.hoverPath = n.id; highlightPath(n.id); });
		el.addEventListener('pointerleave', () => { if(S.hoverPath === n.id){ S.hoverPath = null; highlightPath(null); } });
		return el;
	}

	function highlightPath(id){
		for(const k in S.linkEls){ S.linkEls[k].path.classList.remove('path-hl'); S.linkEls[k].glow.classList.remove('path-hl'); }
		if(!id) return;
		const chain = [id].concat(ancestors(id));
		for(const c of chain){ const L = S.linkEls[c]; if(L){ L.path.classList.add('path-hl'); L.glow.classList.add('path-hl'); } }
	}

	/* ------------------------------------------------------------------ editing ops */
	function addChild(pid, dir){
		const p = S.def.nodes[pid];
		const cap = S.profile.runeCapacity;
		if(count() >= cap){
			toast('⚠ Rune capacity reached (' + count() + '/' + cap + ') — raise Energy Control', 'err');
			const el = S.nodeEls[pid]; if(el){ el.classList.add('error', 'shake'); setTimeout(() => el && el.classList.remove('shake'), 400); }
			return;
		}
		const v = ME.DIRS[dir];
		const gx = p.gx + v.x, gy = p.gy + v.y;
		if(S.occupied[key(gx, gy)]) return;
		pushUndo();
		S.def.seq = (S.def.seq | 0) + 1;
		const n = ME.makeNode(null, pid, dir, gx, gy, S.def.seq);
		if(p.type === 'conditional') n.link.mode = 'condition';      // a branch of a Conditional is a rule: "when this happens"
		S.def.nodes[n.id] = n;
		S.justCreated = n.id; S.newLink = n.id;
		markDirty();
		select({ type:'node', id:n.id }, true);
		refresh();
		ensureVisible(n.id);
		openPicker(n.id, 'new');
	}

	/* put a new rune slot on an existing connector: parent → NEW → child */
	function insertBetween(childId){
		const c = S.def.nodes[childId]; if(!c || !c.parent) return;
		const p = S.def.nodes[c.parent]; if(!p) return;
		const cap = S.profile.runeCapacity;
		if(count() >= cap){ toast('⚠ Rune capacity reached (' + count() + '/' + cap + ') — raise Energy Control', 'err'); return; }
		// step direction from parent toward child
		const dx = c.gx - p.gx, dy = c.gy - p.gy;
		const sx = Math.abs(dx) >= Math.abs(dy) ? Math.sign(dx) || 1 : 0, sy = sx ? 0 : (Math.sign(dy) || 1);
		const moving = {}; subtree(childId).forEach(k => { moving[k] = true; });
		const occ = {}; for(const n of nodesArr()) if(!moving[n.id]) occ[key(n.gx, n.gy)] = true;
		// slide the child's branch away far enough that the new slot and the branch both fit
		let k = 0;
		for(let t = 1; t <= 30; t++){
			let ok = true;
			for(const id in moving){ const n = S.def.nodes[id]; if(occ[key(n.gx + sx * t, n.gy + sy * t)]){ ok = false; break; } }
			if(ok){ k = t; break; }
		}
		if(!k){ toast('⚠ No room to insert here — move the branch first', 'err'); return; }
		pushUndo();
		const gx = c.gx, gy = c.gy;
		for(const id in moving){ const n = S.def.nodes[id]; n.gx += sx * k; n.gy += sy * k; }
		S.def.seq = (S.def.seq | 0) + 1;
		const nn = ME.makeNode(null, p.id, c.dir, gx, gy, c.order);   // takes the child's place in sibling order
		nn.link = c.link;                 // the existing connector now leads into the new rune
		c.link = ME.defaultLink();        // and the new rune hands energy on instantly
		c.parent = nn.id; c.order = 0;
		S.def.nodes[nn.id] = nn;
		S.justCreated = nn.id; S.newLink = childId;
		markDirty();
		select({ type:'node', id: nn.id }, true);
		refresh();
		ensureVisible(nn.id);
		openPicker(nn.id, 'insert');
	}

	function setType(id, type){
		const n = S.def.nodes[id];
		pushUndo();
		n.type = type; n.params = ME.paramDefaults(type);
		if(type === 'loop') n.loop = ME.defaultLoop(); else if(n.loop) delete n.loop;
		if(type === 'conditional') for(const k of kidsOf(id)){ const c = S.def.nodes[k]; if(c.link && c.link.mode === 'instant') c.link.mode = 'condition'; }      // its branches wait for their own conditions
		if(type === 'technique'){
			const usable = ME.Techniques.list().filter(t => ME.Techniques.canUse(S.profile, t.id));
			if(usable[0]) n.params.technique = usable[0].id;
		}
		S.justCreated = id; markDirty();
		select({ type:'node', id }, true);
		refresh();
	}

	function deleteNode(id){
		const n = S.def.nodes[id]; if(!n) return;
		if(id === S.def.rootId){
			if(!n.type) return;
			pushUndo(); n.type = null; n.params = {}; markDirty(); refresh(); toast('First rune cleared'); return;
		}
		const ids = subtree(id);
		pushUndo();
		for(const k of ids) delete S.def.nodes[k];
		if(S.sel && ids.indexOf(S.sel.id) >= 0) S.sel = { type:'node', id: n.parent };
		markDirty(); refresh();
		toast('Removed ' + ids.length + ' rune' + (ids.length > 1 ? 's' : '') + ' — Ctrl+Z to undo');
	}

	/* remove just this rune: its children reconnect to the rune before it (same place in the sibling order) */
	function deleteRuneOnly(id){
		const n = S.def.nodes[id]; if(!n) return;
		const kids = kidsOf(id).slice();
		if(!kids.length){ deleteNode(id); return; }
		const isInst = l => !l || l.mode === 'instant';
		if(id === S.def.rootId){
			if(kids.length > 1){ toast('⚠ The first rune has ' + kids.length + ' branches — only one can become the new first rune. Clear it or delete a branch first.', 'err'); return; }
			pushUndo();
			const c = S.def.nodes[kids[0]];
			delete S.def.nodes[id];
			c.parent = null; c.dir = null; c.order = 0; c.link = ME.defaultLink();
			S.def.rootId = c.id;
			S.sel = { type:'node', id: c.id };
			markDirty(); refresh();
			toast('Removed the first rune — the next one now starts the spell (Ctrl+Z to undo)');
			return;
		}
		const p = S.def.nodes[n.parent]; if(!p) return;
		pushUndo();
		// keep the sibling order: the removed rune's children take its place
		const sibs = kidsOf(p.id).slice().sort((a, b) => (S.def.nodes[a].order | 0) - (S.def.nodes[b].order | 0));
		const ordered = [];
		for(const s of sibs){ if(s === id) ordered.push(...kids.slice().sort((a, b) => (S.def.nodes[a].order | 0) - (S.def.nodes[b].order | 0))); else ordered.push(s); }
		for(const k of kids){
			const c = S.def.nodes[k];
			c.parent = p.id;
			// a removed Delay / Wait until carries over onto children that handed energy on instantly
			if(isInst(c.link) && !isInst(n.link)) c.link = clone(n.link);
		}
		ordered.forEach((k, i) => { S.def.nodes[k].order = i; });
		// close the gap: slide a lone child's branch into the removed rune's spot when it fits
		if(kids.length === 1){
			const c = S.def.nodes[kids[0]];
			const dx = n.gx - c.gx, dy = n.gy - c.gy;
			const moving = {}; subtree(c.id).forEach(k => { moving[k] = true; });
			let ok = true;
			for(const o of nodesArr()){
				if(o.id === id || moving[o.id]) continue;
				for(const m in moving){ const mn = S.def.nodes[m]; if(mn.gx + dx === o.gx && mn.gy + dy === o.gy){ ok = false; break; } }
				if(!ok) break;
			}
			if(ok){ for(const m in moving){ S.def.nodes[m].gx += dx; S.def.nodes[m].gy += dy; } c.dir = n.dir; }
		}
		delete S.def.nodes[id];
		if(S.sel && S.sel.id === id) S.sel = { type:'node', id: kids[0] };
		markDirty(); refresh();
		toast('Removed 1 rune — the rest of the branch was kept (Ctrl+Z to undo)');
	}

	function toggleCollapse(id){
		const n = S.def.nodes[id]; if(!kidsOf(id).length) return;
		n.ui = n.ui || {}; n.ui.collapsed = !n.ui.collapsed;
		refresh();
	}

	function select(sel, silent){
		S.sel = sel;
		if(!silent){
			for(const id in S.nodeEls) S.nodeEls[id].classList.toggle('selected', !!(sel && sel.type === 'node' && sel.id === id));
			for(const id in S.linkEls) S.linkEls[id].badge.classList.toggle('selected', !!(sel && sel.type === 'link' && sel.id === id));
			for(const id in S.loopEls) S.loopEls[id].badge.classList.toggle('selected', !!(sel && sel.type === 'loop' && sel.id === id));
			renderInspector();
		}
	}

	/* ------------------------------------------------------------------ drag (move branch) */
	function onNodeDown(e, id){
		if(e.button === 2) return;
		e.stopPropagation();
		closeMenus();
		const start = { x: e.clientX, y: e.clientY };
		let dragging = false, dgx = 0, dgy = 0, ok = true, drop = null, lastMark = null;
		const ids = subtree(id).filter(k => S.nodeEls[k]);
		const moveSet = {}; subtree(id).forEach(k => { moveSet[k] = true; });
		const mark = (d) => {
			if(lastMark){ lastMark.classList.remove('drop-swap', 'drop-insert'); lastMark = null; }
			if(!d) return;
			const el = d.kind === 'swap' ? S.nodeEls[d.id] : (S.linkEls[d.id] && S.linkEls[d.id].badge);
			if(el){ el.classList.add(d.kind === 'swap' ? 'drop-swap' : 'drop-insert'); if(d.kind === 'insert') el.style.opacity = ''; lastMark = el; }
		};
		const onMove = ev => {
			const dx = ev.clientX - start.x, dy = ev.clientY - start.y;
			if(!dragging && Math.hypot(dx, dy) > 6){ dragging = true; ids.forEach(k => S.nodeEls[k].classList.add('dragging')); for(const k in S.linkEls) S.linkEls[k].badge.style.opacity = 0.25; }
			if(!dragging) return;
			// dropping onto another rune swaps the two; onto a connector puts this rune between the two it joins
			drop = dropTarget(ev.clientX, ev.clientY, id);
			mark(drop);
			const z = S.view.z;
			dgx = Math.round(dx / z / GX); dgy = Math.round(dy / z / GY);
			ok = true;
			for(const k of Object.keys(moveSet)){
				const n = S.def.nodes[k];
				const occ = S.occupied[key(n.gx + dgx, n.gy + dgy)];
				if(occ && !moveSet[occ]){ ok = false; break; }
			}
			ids.forEach(k => {
				const el = S.nodeEls[k];
				el.style.transform = 'translate(' + (dx / z) + 'px,' + (dy / z) + 'px)';
				el.classList.toggle('drop-bad', !ok && !drop && (dgx || dgy));
			});
		};
		const onUp = () => {
			window.removeEventListener('pointermove', onMove);
			window.removeEventListener('pointerup', onUp);
			if(!dragging){ select({ type:'node', id }); if(!S.def.nodes[id].type) openPicker(id, 'change'); return; }
			ids.forEach(k => { const el = S.nodeEls[k]; if(el){ el.style.transform = ''; el.classList.remove('dragging', 'drop-bad'); } });
			for(const k in S.linkEls) S.linkEls[k].badge.style.opacity = '';
			mark(null);
			if(drop && drop.kind === 'swap'){ swapRunes(id, drop.id); return; }
			if(drop && drop.kind === 'insert'){ moveBetween(id, drop.id); return; }
			if(ok && (dgx || dgy)){
				pushUndo();
				for(const k of Object.keys(moveSet)){ const n = S.def.nodes[k]; n.gx += dgx; n.gy += dgy; }
				markDirty(); select({ type:'node', id }, true); refresh();
				toast('Moved ' + Object.keys(moveSet).length + ' rune' + (Object.keys(moveSet).length > 1 ? 's' : ''));
			} else if(!ok){ toast('⚠ Branch would overlap other runes', 'err'); refresh(); }
		};
		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onUp);
	}

	/* what a dragged rune is over: another rune (swap) or the middle of a connector (insert between) */
	function dropTarget(cx, cy, dragId){
		const r = S.els.vp.getBoundingClientRect(), v = S.view;
		const wx = (cx - r.left - v.x) / v.z, wy = (cy - r.top - v.y) / v.z;
		const gx = Math.round(wx / GX), gy = Math.round(wy / GY);
		const occ = S.occupied[key(gx, gy)];
		if(occ && occ !== dragId && !isHidden(occ) && Math.abs(wx - gx * GX) < HW && Math.abs(wy - gy * GY) < HH) return { kind: 'swap', id: occ };
		let best = null, bd = 60;
		for(const n of nodesArr()){
			if(!n.parent || n.id === dragId || n.parent === dragId || isHidden(n.id)) continue;
			const p = S.def.nodes[n.parent]; if(!p) continue;
			const g = linkGeom(p, n), d = Math.hypot(wx - g.mx, wy - g.my);
			if(d < bd){ bd = d; best = n.id; }
		}
		return best ? { kind: 'insert', id: best } : null;
	}
	/* drag a rune onto another: the two runes trade places (their settings go with them; the connectors stay) */
	function swapRunes(a, b){
		const A = S.def.nodes[a], B = S.def.nodes[b]; if(!A || !B || a === b) return;
		pushUndo();
		const t = { type: A.type, params: A.params, ui: A.ui };
		A.type = B.type; A.params = B.params; A.ui = B.ui;
		B.type = t.type; B.params = t.params; B.ui = t.ui;
		markDirty(); select({ type:'node', id: b }, true); refresh();
		toast('Swapped ' + runeName(A) + ' and ' + runeName(B) + ' — Ctrl+Z to undo');
	}
	function runeName(n){ const R = n && n.type && ME.Runes[n.type]; return R ? R.name : 'empty slot'; }
	/* drag a rune onto a connector: it leaves its spot (its own children reconnect to the rune before it) and
	   goes between the two runes that connector joins */
	function moveBetween(xId, childId){
		const X = S.def.nodes[xId], C = S.def.nodes[childId];
		if(!X || !C || !C.parent || C.parent === xId || childId === xId) return;
		const kids = kidsOf(xId).slice();
		if(xId === S.def.rootId && kids.length !== 1){ toast('⚠ The first rune ' + (kids.length ? 'has ' + kids.length + ' branches' : 'is the whole spell') + ' — it cannot be moved between others', 'err'); return; }
		pushUndo();
		const isInst = l => !l || l.mode === 'instant';
		// 1) take X out: its children join X's parent (or the first child becomes the first rune)
		if(xId === S.def.rootId){
			const c0 = S.def.nodes[kids[0]];
			c0.parent = null; c0.dir = null; c0.order = 0; c0.link = ME.defaultLink();
			S.def.rootId = c0.id;
		} else {
			const P = S.def.nodes[X.parent];
			const sibs = kidsOf(P.id).slice().sort((a, b) => (S.def.nodes[a].order | 0) - (S.def.nodes[b].order | 0));
			const ordered = [];
			for(const s of sibs){ if(s === xId) ordered.push(...kids.slice().sort((a, b) => (S.def.nodes[a].order | 0) - (S.def.nodes[b].order | 0))); else ordered.push(s); }
			for(const k of kids){ const c = S.def.nodes[k]; c.parent = P.id; if(isInst(c.link) && !isInst(X.link)) c.link = clone(X.link); }
			ordered.forEach((k, i) => { S.def.nodes[k].order = i; });
		}
		// 2) put X between C's parent and C, in C's place; C's branch slides away to make room
		S.idx = ME.indexOf(S.def);
		const P2 = S.def.nodes[C.parent];
		const dx = C.gx - P2.gx, dy = C.gy - P2.gy;
		const sx = Math.abs(dx) >= Math.abs(dy) ? Math.sign(dx) || 1 : 0, sy = sx ? 0 : (Math.sign(dy) || 1);
		const moving = {}; subtree(childId).forEach(k => { moving[k] = true; });
		const occ = {}; for(const n of nodesArr()) if(!moving[n.id] && n.id !== xId) occ[key(n.gx, n.gy)] = true;
		let k = 0;
		for(let t = 1; t <= 30; t++){
			let fits = true;
			for(const m in moving){ const n = S.def.nodes[m]; if(occ[key(n.gx + sx * t, n.gy + sy * t)]){ fits = false; break; } }
			if(fits){ k = t; break; }
		}
		if(!k){ restoreQuiet(S.undo.pop()); toast('⚠ No room to move it there — make space first', 'err'); return; }
		const gx = C.gx, gy = C.gy;
		for(const m in moving){ const n = S.def.nodes[m]; n.gx += sx * k; n.gy += sy * k; }
		X.parent = P2.id; X.dir = C.dir; X.order = C.order; X.gx = gx; X.gy = gy;
		X.link = C.link; C.link = ME.defaultLink();
		C.parent = xId; C.order = 0;
		markDirty(); select({ type:'node', id: xId }, true); refresh(); ensureVisible(xId);
		toast('Moved ' + runeName(X) + ' between ' + runeName(P2) + ' and ' + runeName(C) + ' — Ctrl+Z to undo');
	}

	/* ------------------------------------------------------------------ viewport */
	function bindViewport(){
		const vp = S.els.vp;
		vp.addEventListener('wheel', e => {
			e.preventDefault();
			const r = vp.getBoundingClientRect();
			const k = Math.exp(-e.deltaY * (e.ctrlKey ? 0.006 : 0.0016));
			zoomAt(e.clientX - r.left, e.clientY - r.top, k);
		}, { passive:false });
		vp.addEventListener('pointerdown', e => {
			if(e.target.closest('.mf-node') || e.target.closest('.mf-badge')) return;
			closeMenus();
			const start = { x: e.clientX, y: e.clientY, tx: S.view.tx, ty: S.view.ty };
			let moved = false;
			vp.classList.add('panning');
			vp.setPointerCapture(e.pointerId);
			const onMove = ev => {
				const dx = ev.clientX - start.x, dy = ev.clientY - start.y;
				if(Math.abs(dx) + Math.abs(dy) > 3) moved = true;
				S.view.tx = start.tx + dx; S.view.ty = start.ty + dy;
				S.view.x = S.view.tx; S.view.y = S.view.ty; // panning is direct, no easing lag
			};
			const onUp = () => {
				vp.classList.remove('panning');
				vp.removeEventListener('pointermove', onMove);
				vp.removeEventListener('pointerup', onUp);
				if(!moved && S.sel){ select(null); }
			};
			vp.addEventListener('pointermove', onMove);
			vp.addEventListener('pointerup', onUp);
		});
	}
	function zoomAt(sx, sy, k){
		const v = S.view;
		const nz = clamp(v.tz * k, 0.25, 2.2);
		const kk = nz / v.tz;
		v.tx = sx - (sx - v.tx) * kk; v.ty = sy - (sy - v.ty) * kk; v.tz = nz;
	}
	function zoomBy(k){ const r = S.els.vp.getBoundingClientRect(); zoomAt(r.width / 2, r.height / 2, k); }
	function freeArea(){
		const r = S.els.vp.getBoundingClientRect();
		const right = S.els.root.classList.contains('insp-hidden') ? 12 : 342;
		const full = { x: 12, y: 64, w: Math.max(200, r.width - right - 24), h: Math.max(160, r.height - 64 - 24) };
		const pv = S.els.prev;
		if(pv.classList.contains('closed')) return full;
		const pr = pv.getBoundingClientRect();
		// two candidate regions: above the preview, or left of it — use the bigger one
		const above = { x: full.x, y: full.y, w: full.w, h: Math.max(120, pr.top - r.top - 64 - 12) };
		const left = { x: full.x, y: full.y, w: Math.max(160, pr.left - r.left - 24), h: full.h };
		return (above.w * above.h >= left.w * left.h) ? above : left;
	}
	function fit(instant){
		const ns = nodesArr().filter(n => !isHidden(n.id));
		if(!ns.length) return;
		let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
		for(const n of ns){ const p = nodePos(n); x0 = Math.min(x0, p.x - HW - 50); x1 = Math.max(x1, p.x + HW + 50); y0 = Math.min(y0, p.y - HH - 50); y1 = Math.max(y1, p.y + HH + 50); }
		const A = freeArea();
		const z = clamp(Math.min(A.w / (x1 - x0), A.h / (y1 - y0)), 0.3, 1.15);
		S.view.tz = z;
		S.view.tx = A.x + A.w / 2 - (x0 + x1) / 2 * z;
		S.view.ty = A.y + A.h / 2 - (y0 + y1) / 2 * z;
		if(instant){ S.view.x = S.view.tx; S.view.y = S.view.ty; S.view.z = S.view.tz; }
	}
	function centerOn(id){
		const n = S.def.nodes[id]; if(!n) return;
		const p = nodePos(n), A = freeArea(), z = Math.max(S.view.tz, 0.75);
		S.view.tz = z; S.view.tx = A.x + A.w / 2 - p.x * z; S.view.ty = A.y + A.h / 2 - p.y * z;
	}
	function ensureVisible(id){
		const n = S.def.nodes[id]; if(!n) return;
		const p = nodePos(n), A = freeArea(), v = S.view;
		const sx = p.x * v.tz + v.tx, sy = p.y * v.tz + v.ty;
		if(sx < A.x + 120 || sx > A.x + A.w - 120 || sy < A.y + 80 || sy > A.y + A.h - 80) centerOn(id);
	}
	function onResize(){ sizeBg(); }
	function sizeBg(){
		const c = S.els.bg, r = S.els.root.getBoundingClientRect();
		const dpr = Math.min(2, window.devicePixelRatio || 1);
		c.width = Math.max(1, r.width * dpr); c.height = Math.max(1, r.height * dpr); S.bgDpr = dpr;
	}

	/* ------------------------------------------------------------------ frame loop */
	function tick(now){
		if(!S) return;
		S.raf = requestAnimationFrame(tick);
		const v = S.view;
		const k = 0.22;
		if(S.els.root.scrollTop || S.els.root.scrollLeft){ S.els.root.scrollTop = 0; S.els.root.scrollLeft = 0; }
		v.x += (v.tx - v.x) * k; v.y += (v.ty - v.y) * k; v.z += (v.tz - v.z) * k;
		if(Math.abs(v.tz - v.z) < 0.0005) v.z = v.tz;
		S.els.world.style.transform = 'translate(' + v.x + 'px,' + v.y + 'px) scale(' + v.z + ')';
		S.els.zv.textContent = Math.round(v.z * 100) + '%';
		drawBg(now);
		drawMini();
		if(S.preview) previewFrame(now);
	}

	function drawBg(now){
		const c = S.els.bg, ctx = c.getContext('2d'), dpr = S.bgDpr || 1;
		const W = c.width, H = c.height, v = S.view, t = now / 1000;
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		const g = ctx.createRadialGradient(W * 0.45, H * 0.4, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.75);
		g.addColorStop(0, '#11162b'); g.addColorStop(0.6, '#090c18'); g.addColorStop(1, '#05060c');
		ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
		// parallax far motes
		ctx.fillStyle = 'rgba(160,190,255,0.35)';
		for(let i = 0; i < 70; i++){
			const sx = ((i * 7919) % 1000) / 1000, sy = ((i * 104729) % 1000) / 1000;
			const x = ((sx * W + v.x * 0.15 * dpr + t * 4 * (i % 3)) % W + W) % W;
			const y = ((sy * H + v.y * 0.15 * dpr - t * 3) % H + H) % H;
			ctx.globalAlpha = 0.2 + 0.25 * Math.sin(t * 1.3 + i);
			ctx.fillRect(x, y, 1.6 * dpr, 1.6 * dpr);
		}
		// dot grid in world space
		const step = 46 * v.z * dpr;
		if(step > 9){
			const ox = ((v.x * dpr) % step + step) % step, oy = ((v.y * dpr) % step + step) % step;
			ctx.globalAlpha = clamp(0.1 + v.z * 0.12, 0.08, 0.3);
			ctx.fillStyle = '#7f95d8';
			const s = Math.max(1, 1.4 * dpr * Math.min(1.3, v.z));
			for(let y = oy; y < H; y += step) for(let x = ox; x < W; x += step) ctx.fillRect(x, y, s, s);
		}
		// origin glyph ring
		const rp = S.def.nodes[S.def.rootId];
		if(rp){
			const cx = (rp.gx * GX * v.z + v.x) * dpr, cy = (rp.gy * GY * v.z + v.y) * dpr;
			ctx.globalAlpha = 0.12; ctx.strokeStyle = '#9fe6ff'; ctx.lineWidth = 1.5 * dpr;
			ctx.setLineDash([8 * dpr, 14 * dpr]); ctx.lineDashOffset = -t * 20;
			ctx.beginPath(); ctx.arc(cx, cy, 170 * v.z * dpr, 0, Math.PI * 2); ctx.stroke();
			ctx.lineDashOffset = t * 12; ctx.beginPath(); ctx.arc(cx, cy, 240 * v.z * dpr, 0, Math.PI * 2); ctx.stroke();
			ctx.setLineDash([]);
		}
		ctx.globalAlpha = 1;
	}

	function drawMini(){
		const c = S.els.mini, ctx = c.getContext('2d');
		const W = c.width, H = c.height;
		ctx.clearRect(0, 0, W, H);
		const ns = nodesArr().filter(n => !isHidden(n.id));
		let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
		for(const n of ns){ x0 = Math.min(x0, n.gx); x1 = Math.max(x1, n.gx); y0 = Math.min(y0, n.gy); y1 = Math.max(y1, n.gy); }
		const r = S.els.vp.getBoundingClientRect(), v = S.view;
		// include viewport in bounds
		const vx0 = (-v.x) / v.z / GX, vy0 = (-v.y) / v.z / GY, vx1 = (r.width - v.x) / v.z / GX, vy1 = (r.height - v.y) / v.z / GY;
		const bx0 = Math.min(x0 - 1, vx0), by0 = Math.min(y0 - 1, vy0), bx1 = Math.max(x1 + 1, vx1), by1 = Math.max(y1 + 1, vy1);
		const sc = Math.min(W / (bx1 - bx0), H / (by1 - by0));
		const ox = (W - (bx1 - bx0) * sc) / 2, oy = (H - (by1 - by0) * sc) / 2;
		const mp = (gx, gy) => ({ x: ox + (gx - bx0) * sc, y: oy + (gy - by0) * sc });
		S.miniMap = { bx0, by0, sc, ox, oy };
		ctx.strokeStyle = 'rgba(140,170,255,0.35)'; ctx.lineWidth = 2;
		for(const n of ns){ if(!n.parent) continue; const p = S.def.nodes[n.parent]; if(!p) continue; const a = mp(p.gx, p.gy), b = mp(n.gx, n.gy); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
		for(const n of ns){
			const p = mp(n.gx, n.gy);
			const errs = S.report.byNode[n.id];
			ctx.fillStyle = errs && errs.some(e => e.level === 'error') ? '#ff5d7a' : runeColor(n);
			const w = Math.max(6, sc * 0.6), hh = Math.max(4, sc * 0.32);
			ctx.globalAlpha = S.sel && S.sel.id === n.id ? 1 : 0.8;
			ctx.fillRect(p.x - w / 2, p.y - hh / 2, w, hh);
		}
		ctx.globalAlpha = 1;
		const a = mp(vx0, vy0), b = mp(vx1, vy1);
		ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2;
		ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
	}
	function onMiniClick(e){
		const m = S.miniMap; if(!m) return;
		const rect = S.els.mini.getBoundingClientRect();
		const px = (e.clientX - rect.left) / rect.width * S.els.mini.width, py = (e.clientY - rect.top) / rect.height * S.els.mini.height;
		const gx = (px - m.ox) / m.sc + m.bx0, gy = (py - m.oy) / m.sc + m.by0;
		const r = S.els.vp.getBoundingClientRect(), z = S.view.tz;
		S.view.tx = r.width / 2 - gx * GX * z; S.view.ty = r.height / 2 - gy * GY * z;
	}

	/* ------------------------------------------------------------------ meters */
	function renderMeters(){
		const rep = S.report, P = S.profile;
		const set = (k, val, max, label) => {
			const m = S.els.meters[k];
			m.querySelector('b').textContent = label;
			m.querySelector('i').style.width = clamp(val / Math.max(1, max) * 100, 0, 100) + '%';
			m.classList.toggle('over', val > max);
		};
		set('runes', rep.runeCount, P.runeCapacity, rep.runeCount + ' / ' + P.runeCapacity);
		const loopE = Math.round(rep.loop || 0);
		set('cost', rep.cost - loopE, P.maxEnergy, (rep.cost - loopE) + (loopE ? ' +' + loopE + '↻' : '') + ' / ' + P.maxEnergy);
		set('output', rep.peakOutput, P.maxOutput, rep.peakOutput + ' / ' + P.maxOutput);
		S.els.meters.runes.title = 'Rune slots used. Your Energy Control allows ' + P.runeCapacity + ' (hard cap ' + ME.CONFIG.maxRunes + ').';
		S.els.meters.cost.title = 'Energy drawn from your reserve when cast (max reserve ' + P.maxEnergy + ').' + (loopE ? ' Loops cost ' + loopE + ' more, a little at a time: every repeat is paid when it starts.' : '');
		S.els.meters.output.title = 'Estimated peak simultaneous output, sum of |power| across the whole tree. Max Output ' + P.maxOutput + '.';
	}

	/* ------------------------------------------------------------------ inspector */
	function renderInspector(){
		const head = S.els.insHead, body = S.els.insBody;
		head.innerHTML = ''; body.innerHTML = '';
		const sel = S.sel;
		if(sel && sel.type === 'node' && S.def.nodes[sel.id]) inspectNode(S.def.nodes[sel.id], head, body);
		else if(sel && sel.type === 'link' && S.def.nodes[sel.id]) inspectLink(S.def.nodes[sel.id], head, body);
		else if(sel && sel.type === 'loop' && S.def.nodes[sel.id] && S.def.nodes[sel.id].loop) inspectLoop(S.def.nodes[sel.id], head, body);
		else inspectSpell(head, body);
	}
	function renderInspectorLive(){
		if(S.liveBox && S.sel && S.sel.type === 'node' && S.def.nodes[S.sel.id]) fillNodeLive(S.def.nodes[S.sel.id], S.liveBox);
		else if(!S.sel) renderInspector();
	}

	function headHtml(glyph, title, cat, color){
		return '<div class="mf-glyph" style="--c:' + color + '">' + glyph + '</div><div><div class="mf-insp-cat">' + esc(cat) + '</div><div class="mf-insp-title">' + esc(title) + '</div></div>';
	}

	function inspectSpell(head, body){
		head.style.setProperty('--c', '#9fe6ff');
		head.innerHTML = headHtml('✦', S.def.name || 'Spell', 'Spell overview', '#9fe6ff');
		const rep = S.report, P = S.profile;
		const stat = (l, v, bad) => '<div class="mf-stat"><small>' + l + '</small><b style="' + (bad ? 'color:var(--mf-err)' : '') + '">' + v + '</b></div>';
		let html = '<div class="mf-stats">'
			+ stat('Runes', rep.runeCount + ' / ' + P.runeCapacity, rep.runeCount > P.runeCapacity)
			+ stat('Energy cost', rep.cost - Math.round(rep.loop || 0), rep.cost - Math.round(rep.loop || 0) > P.maxEnergy)
			+ (rep.loop ? stat('Loop repeats', '+' + Math.round(rep.loop)) : '')
			+ stat('Peak output', rep.peakOutput + ' / ' + P.maxOutput, rep.peakOutput > P.maxOutput)
			+ stat('Energy created', Math.round(rep.energyCreated))
			+ stat('Efficiency loss', rep.efficiencyLoss)
			+ stat('Techniques', Object.keys(rep.techniques).length || '—')
			+ '</div>';
		html += '<div class="mf-sec"><div class="mf-sec-t">Reads as</div><div class="mf-flow">' + readAs() + '</div></div>';
		html += '<div class="mf-sec"><div class="mf-sec-t">Problems</div><div class="mf-errlist">';
		const all = rep.errors.concat(rep.warnings);
		if(!all.length) html += '<div class="mf-okline">✓ No problems — this spell can be cast.</div>';
		else all.slice(0, 30).forEach((e, i) => { html += '<div class="mf-erritem' + (e.level === 'warn' ? ' warn' : '') + '" data-i="' + i + '"><i>' + (e.level === 'warn' ? '◇' : '⚠') + '</i><span>' + esc(e.text) + '</span></div>'; });
		html += '</div></div>';
		html += '<div class="mf-sec"><div class="mf-sec-t">How it works</div><div class="mf-tips">'
			+ 'Energy travels down the tree. Each rune changes the energy its branch is targeting, then hands it to the next rune.<br>'
			+ '<b>Target</b> chooses what later runes interact with — it never moves energy. <b>Redirect</b> turns energy once.<br>'
			+ 'Click a connector badge to make it Instant, Delay or Condition.</div></div>';
		html += '<div class="mf-sec"><div class="mf-sec-t">Controls</div><div class="mf-tips">'
			+ '<kbd>Drag</kbd> empty space to pan · <kbd>Wheel</kbd> zoom · drag a rune to move its branch, onto another rune to swap them, or onto a connector to put it between<br>'
			+ '<kbd>Dbl-click</kbd> change rune · <kbd>Right-click</kbd> menu · <kbd>Del</kbd> remove branch · <kbd>Shift+Del</kbd> remove rune only<br>'
			+ '<kbd>Arrows</kbd> walk the tree · <kbd>F</kbd> fit · <kbd>C</kbd> center · <kbd>Ctrl+F</kbd> find<br>'
			+ '<kbd>Ctrl+Z / Y</kbd> undo/redo · <kbd>Ctrl+S</kbd> save · <kbd>D</kbd> debug · <kbd>R</kbd> recast preview</div></div>';
		html += '<div class="mf-actions"><button class="mf-btn" data-x="reset">↺ Start over</button><button class="mf-btn danger" data-x="remove">✕ ' + esc(S.opts.clearLabel || 'Remove from slot') + '</button></div>';
		body.innerHTML = html;
		body.querySelectorAll('.mf-erritem').forEach(el => el.addEventListener('click', () => {
			const e = all[+el.dataset.i]; const id = e.node || e.link;
			if(!id || !S.def.nodes[id]) return;
			select({ type: e.link ? 'link' : 'node', id }); centerOn(id);
			const ne = S.nodeEls[id]; if(ne){ ne.classList.add('shake'); setTimeout(() => ne.classList.remove('shake'), 450); }
		}));
		body.querySelector('[data-x=reset]').addEventListener('click', () => { pushUndo(); const nm = S.def.name; S.def = ME.blankSpell(nm); S.sel = null; markDirty(); refresh(); fit(); toast('Started over — Ctrl+Z to undo'); setTimeout(() => S && openPicker(S.def.rootId, 'new-root'), 300); });
		body.querySelector('[data-x=remove]').addEventListener('click', () => {
			modal((S.opts.clearLabel || 'Remove spell') + '?', S.opts.clearText || 'This empties the spell slot. You can always build a new spell later.', [
				{ label:'Keep', cls:'' },
				{ label:'Remove', cls:'danger', fn: () => { if(S.opts.onClear) S.opts.onClear(); S.dirty = false; close(true); } }
			]);
		});
	}

	function readAs(){
		const parts = [];
		let id = S.def.rootId, guard = 0;
		while(id && guard++ < 14){
			const n = S.def.nodes[id]; if(!n) break;
			const R = ME.Runes[n.type];
			if(n.parent){ const l = n.link || {}; if(l.mode === 'delay') parts.push('<em>wait ' + fmt(l.delay) + 's</em>'); else if(l.mode === 'condition') parts.push('<em>when ' + esc((ME.Conditions[l.cond.type] || {}).name || '?').toLowerCase() + '</em>'); else parts.push('<em>→</em>'); }
			parts.push('<span>' + (R ? R.glyph + ' ' + esc(R.name) : '? empty') + (R && R.summary ? ' · ' + esc(R.summary(n.params, n, kidsOf(id).length)) : '') + '</span>');
			const k = kidsOf(id);
			if(k.length > 1){ parts.push('<em>⑂ ' + k.length + ' branches…</em>'); break; }
			id = k[0];
		}
		return parts.join('');
	}

	function inspectNode(n, head, body){
		const R = ME.Runes[n.type];
		const col = runeColor(n);
		head.style.setProperty('--c', col);
		if(!R){
			head.innerHTML = headHtml('?', 'Empty rune slot', 'Choose a rune', col);
			body.innerHTML = '<div class="mf-desc">This slot has no rune yet. Pick what it does to the energy flowing into it.</div><div class="mf-actions"><button class="mf-btn primary" data-x="pick">Choose rune…</button>' + (n.id !== S.def.rootId ? '<button class="mf-btn danger" data-x="del">Delete slot</button>' : '') + '</div>';
			body.querySelector('[data-x=pick]').addEventListener('click', () => openPicker(n.id, 'change'));
			const d = body.querySelector('[data-x=del]'); if(d) d.addEventListener('click', () => deleteNode(n.id));
			S.liveBox = null;
			return;
		}
		const cat = ME.CATEGORY_MAP[R.category];
		head.innerHTML = headHtml(R.glyph, R.name, (cat ? cat.label : R.category) + (n.id === S.def.rootId ? ' · first rune' : ''), col);
		body.innerHTML = '<div class="mf-desc">' + esc(R.description) + '</div>';
		const params = h('div', 'mf-sec'); params.innerHTML = '<div class="mf-sec-t">Parameters</div>';
		let any = false;
		for(const p of R.params){
			if(!ME.paramVisible(p, n.params) || p.type === 'hidden') continue;
			any = true;
			params.appendChild(paramControl(n, p));
		}
		if(!any) params.innerHTML += '<div class="mf-hint">This rune has no parameters.</div>';
		body.appendChild(params);
		const live = h('div'); body.appendChild(live); S.liveBox = live;
		fillNodeLive(n, live);
		if(n.parent){
			const ls = h('div', 'mf-sec');
			ls.innerHTML = '<div class="mf-sec-t">Incoming connector</div>';
			const b = h('button', 'mf-btn', LINK_ICON[n.link.mode] + ' ' + esc(linkLabel(n.link)) + ' — edit');
			b.style.width = '100%';
			b.addEventListener('click', () => { select({ type:'link', id:n.id }); });
			ls.appendChild(b); body.appendChild(ls);
		}
		if(n.type === 'loop' && n.loop){
			const lp = h('div', 'mf-sec'); lp.innerHTML = '<div class="mf-sec-t">Return branch</div>';
			const t = n.loop.to && S.def.nodes[n.loop.to];
			lp.appendChild(h('div', 'mf-hint', t ? 'Returns to <b>' + esc(runeName(t)) + '</b> — ' + esc(loopTitle(n)) : 'Not connected. <b>Pull the ⟲ handle</b> on this rune onto an earlier rune on its branch to choose what it repeats.'));
			if(t){ const b = h('button', 'mf-btn', '↻ ' + esc(loopLabel(n)) + ' — edit'); b.style.width = '100%'; b.addEventListener('click', () => select({ type:'loop', id:n.id })); lp.appendChild(b); }
			body.appendChild(lp);
		}
		const act = h('div', 'mf-actions');
		act.innerHTML = '<button class="mf-btn" data-x="change">⇆ Change rune</button><button class="mf-btn" data-x="center">◎ Center</button>'
			+ (kidsOf(n.id).length ? '<button class="mf-btn" data-x="collapse">' + (n.ui && n.ui.collapsed ? '▸ Expand' : '▾ Collapse') + '</button>' : '')
			+ (kidsOf(n.id).length && (n.id !== S.def.rootId || kidsOf(n.id).length === 1) ? '<button class="mf-btn danger" data-x="delone" title="Delete only this rune — the runes after it reconnect to the rune before it (Shift+Del)">✕ Delete rune only</button>' : '')
			+ '<button class="mf-btn danger" data-x="del">' + (n.id === S.def.rootId ? '✕ Clear' : '✕ Delete' + (kidsOf(n.id).length ? ' branch' : '')) + '</button>';
		body.appendChild(act);
		act.querySelector('[data-x=change]').addEventListener('click', () => openPicker(n.id, 'change'));
		act.querySelector('[data-x=center]').addEventListener('click', () => centerOn(n.id));
		const cl = act.querySelector('[data-x=collapse]'); if(cl) cl.addEventListener('click', () => toggleCollapse(n.id));
		act.querySelector('[data-x=del]').addEventListener('click', () => deleteNode(n.id));
		const d1 = act.querySelector('[data-x=delone]'); if(d1) d1.addEventListener('click', () => deleteRuneOnly(n.id));
	}

	function fillNodeLive(n, box){
		const info = S.report.nodeInfo[n.id] || {};
		const errs = S.report.byNode[n.id] || [];
		const stat = (l, v) => '<div class="mf-stat"><small>' + l + '</small><b>' + v + '</b></div>';
		const R0 = ME.Runes[n.type];
		let html = (R0 && R0.note) ? '<div class="mf-okline" style="margin-top:4px">' + esc(R0.note(n.params || {})) + '</div>' : '';
		html += '<div class="mf-sec"><div class="mf-sec-t">Energy here</div><div class="mf-stats">'
			+ stat('Energy in', info.energyIn || '—') + stat('Energy out', info.energyOut || '—')
			+ stat('Power', info.power || '—') + stat('Impact dmg', info.power ? Math.round(info.power * ME.CONFIG.damagePerPower) : '—')
			+ stat('Target', info.target ? esc(info.target) : '—') + stat(info.pieces > 1 ? 'Pieces' : 'Children', info.pieces > 1 ? '×' + info.pieces : kidsOf(n.id).length)
			+ '</div></div>';
		const X = info.extra || {};
		if(X.tech){
			const tq = X.tech;
			html += '<div class="mf-sec"><div class="mf-sec-t">Technique</div><div class="mf-kv">'
				+ kv('Technique', esc(tq.technique)) + kv('Technique Points', tq.points) + kv('Current power', esc(tq.power))
				+ kv('Energy cost', tq.cost) + kv('Efficiency', tq.efficiency) + kv('Valid target', tq.valid) + kv('Reverse', esc(tq.reverse))
				+ kv('Energy state after', esc(tq.state || '—')) + '</div></div>';
		}
		if(X.reinf){
			const r = X.reinf;
			html += '<div class="mf-sec"><div class="mf-sec-t">Reinforcement</div><div class="mf-kv">'
				+ kv('Energy poured in', r.energy) + kv('Efficiency', r.efficiency) + kv('Strength', r.strength) + kv('Target', esc(r.target)) + '</div></div>';
		}
		if(X.construct){
			// Construction: what the energy will become (size, toughness, lifetime …) or what dismantling gives back
			const C = X.construct;
			html += '<div class="mf-sec"><div class="mf-sec-t">Construct</div><div class="mf-kv">' + Object.keys(C).map(k => kv(esc(k), esc(String(C[k])))).join('') + '</div></div>';
		}
		if(X.vow){
			// Binding Vow: the whole contract, in words (condition, commitment, reward, what breaking it costs)
			const V = X.vow;
			html += '<div class="mf-sec"><div class="mf-sec-t">⛓ The contract</div><div class="mf-vow">' + Object.keys(V).map(k => '<div' + (k === 'Price' ? ' class="free"' : '') + '><small>' + esc(k) + '</small><span>' + esc(String(V[k])) + '</span></div>').join('') + '</div></div>';
		}
		if(info.tech && !X.tech) html += '<div class="mf-okline">Technique state: ' + esc(info.tech) + '</div>';
		if(errs.length){
			html += '<div class="mf-sec"><div class="mf-sec-t">Problems</div><div class="mf-errlist">' + errs.map(e => '<div class="mf-erritem' + (e.level === 'warn' ? ' warn' : '') + '"><i>' + (e.level === 'warn' ? '◇' : '⚠') + '</i><span>' + esc(e.text) + '</span></div>').join('') + '</div></div>';
		}
		box.innerHTML = html;
	}

	function kv(k, v){ return '<div><small>' + k + '</small><b>' + v + '</b></div>'; }
	function techTitle(info){
		const X = info && info.extra; if(!X || !X.tech) return '';
		const t = X.tech;
		return 'Technique: ' + t.technique + '\nTechnique Points: ' + t.points + '\nCurrent Power: ' + t.power + '\nEnergy Cost: ' + t.cost + '\nEfficiency: ' + t.efficiency + '\nValid Target: ' + t.valid + '\nReverse: ' + t.reverse;
	}
	function paramOptionsOf(p, params){ const o = p && p.options; return typeof o === 'function' ? o(params || {}) : (o || []); }
	function paramControl(n, p, setter){
		const setV = setter || (v => { n.params[p.key] = v; });
		const wrap = h('div', 'mf-field');
		wrap.dataset.key = p.key;      // the tutorial coach points at fields by key
		const val = n.params[p.key];
		const top = h('div', 'mf-field-top');
		top.innerHTML = '<label>' + esc(p.label) + '</label>';
		wrap.appendChild(top);
		const begin = () => { if(!S.editing){ pushUndo(); S.editing = true; } };
		const end = () => { S.editing = false; refresh(); };
		if(p.type === 'int' || p.type === 'float' || p.type === 'signed'){
			const capV = p.cap && S.profile ? S.profile[p.cap] : null;
			const lim = capV != null && isFinite(capV) ? Math.min(p['max'], capV) : p['max'];
			// typeable value box (synced with the slider)
			const box = h('div', 'mf-numbox');
			const num = h('input', 'mf-num');
			num.type = 'number'; num.min = p.min; num.max = lim; num.step = p.step || 1; num.spellcheck = false;
			num.title = 'Type a value (' + p.min + ' … ' + lim + '), Enter to apply';
			box.appendChild(num);
			if(p.unit) box.appendChild(h('span', 'mf-unit', esc(p.unit)));
			top.appendChild(box);
			const show = v => { if(document.activeElement !== num) num.value = fmt(v); box.classList.toggle('neg', p.type === 'signed' && v < 0); };
			const r = h('input', 'mf-range' + (p.type === 'signed' ? ' signed' : ''));
			r.type = 'range'; r.min = p.min; r.max = lim; r.step = p.step || 1; r.value = val;
			const paint = v => {
				if(p.type === 'signed'){
					const mid = (0 - p.min) / (lim - p.min) * 100, pos = (v - p.min) / (lim - p.min) * 100;      // zero sits where it is on the scale (−10…50 for Compress)
					const c = v < 0 ? '#ff8ad4' : '#9fe6ff';
					r.style.background = 'linear-gradient(90deg, rgba(255,255,255,.08) ' + Math.min(mid, pos) + '%, ' + c + ' ' + Math.min(mid, pos) + '%, ' + c + ' ' + Math.max(mid, pos) + '%, rgba(255,255,255,.08) ' + Math.max(mid, pos) + '%)';
				} else r.style.setProperty('--p', ((v - p.min) / (lim - p.min) * 100) + '%');
			};
			let last = Number(val);
			// normalise any value to a legal one for this parameter
			const legal = (v, prev) => {
				const st = Number(p.step) || 1;
				v = clamp(v, p.min, lim);
				v = Math.round(v / st) * st;
				if(st < 1) v = Number(v.toFixed(3));
				if(p.nonZero && v === 0){ v = prev > 0 ? -st : st; if(v < p.min || v > lim) v = -v; }
				if(p.type === 'signed' && v < 0 && S.profile.negativePower === false){ v = Math.abs(v) || st; toast('Negative power is not unlocked yet', 'err'); }
				return v;
			};
			const apply = (v, live) => {
				begin();
				last = v; r.value = v;
				setV(v); show(v); paint(v); markDirty();
				refresh({ keepInspector:true });
				if(!live) end();
			};
			r.addEventListener('pointerdown', begin);
			r.addEventListener('keydown', begin);
			r.addEventListener('input', () => {
				const v = legal(Number(r.value), last);
				begin();
				last = v; r.value = v;
				setV(v); show(v); paint(v); markDirty();
				refresh({ keepInspector:true });
			});
			let startVal = last;
			num.addEventListener('focus', () => { startVal = last; num.select(); });
			num.addEventListener('input', () => {
				const raw = num.value.trim();
				if(raw === '' || raw === '-' || raw === '.' || raw === '-.') return;
				const v = Number(raw);
				if(!isFinite(v) || v < p.min || v > lim) { box.classList.add('bad'); return; }
				box.classList.remove('bad');
				if(p.nonZero && v === 0) return;           // wait for a legal value
				const lv = legal(v, last);
				if(lv !== last) apply(lv, true);
			});
			const commit = () => {
				box.classList.remove('bad');
				const raw = Number(num.value);
				if(p.nonZero && num.value.trim() !== '' && raw === 0){
					toast('⚠ ' + p.label + ' cannot be 0', 'err');
					num.value = fmt(last); if(S.editing) end(); return;
				}
				const v = (num.value.trim() === '' || !isFinite(raw)) ? last : legal(raw, last);
				num.value = fmt(v);
				if(v !== last || S.editing) apply(v, false);
			};
			const revert = () => {
				box.classList.remove('bad');
				num.value = fmt(startVal);
				if(startVal !== last) apply(startVal, false); else if(S.editing) end();
				num.blur();
			};
			num._revert = revert;
			num.addEventListener('change', commit);
			num.addEventListener('blur', commit);
			num.addEventListener('keydown', e => {
				if(e.key === 'Enter'){ e.preventDefault(); commit(); num.blur(); }
				else if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); revert(); }
			});
			r.addEventListener('change', end);
			show(Number(val)); paint(Number(val));
			wrap.appendChild(r);
			if(p.type === 'signed'){
				let lbl = SIGNED_LABELS[n.type] || ['Reverse', 'Normal'];
				if(n.type === 'technique'){ const td = ME.Techniques.get(n.params.technique); if(td) lbl = [td.reversedName.replace(/^Reverse \w+ \((.*)\)$/, '$1') || 'Reverse', td.name]; }
				const t = h('div', 'mf-signed-ticks', '<span>◂ ' + lbl[0] + ' ' + p.min + '</span><span>0</span><span>' + lbl[1] + ' +' + lim + ' ▸</span>');
				wrap.appendChild(t);
			}
		} else if(p.type === 'select' && p.key === 'shape' && ME.SHAPES){
			const grid = h('div', 'mf-shapes');
			for(const o of paramOptionsOf(p, n.params)){
				const b = h('button', 'mf-shape' + (val === o.value ? ' on' : '') + (o.value === 'custom' ? ' mf-shape-own' : ''));
				b.dataset.v = o.value;
				b.title = o.value === 'custom' ? 'Draw your own shape (brush, eraser, and shapes you can drag in, stretch and turn)' : o.label;
				b.innerHTML = (o.value === 'custom' ? customIcon(n.params.poly) : shapeIcon(o.value)) + '<span>' + esc(o.label.replace('Keep current shape', 'Keep').replace('Crescent ', '').replace('Your own shape', 'Draw your own')) + '</span>';
				b.addEventListener('click', () => {
					const prev = n.params[p.key];
					pushUndo(); n.params[p.key] = o.value; markDirty(); refresh();
					if(o.value === 'custom' && !ME.customShapeKey(n.params.poly)) openShapeEditor(n, prev, prev);
				});
				grid.appendChild(b);
			}
			wrap.appendChild(grid);
			libraryGrid(n, wrap);
			wrap.appendChild(h('div', 'mf-hint', 'Low compression only begins to form the shape; high compression locks the energy into it exactly. Expanded energy holds shapes loosely.'));
		} else if(p.type === 'select' && p.key === 'formation' && ME.divideOffsets){
			const grid = h('div', 'mf-shapes');
			for(const o of paramOptionsOf(p, n.params)){
				const b = h('button', 'mf-shape' + (val === o.value ? ' on' : ''));
				b.title = o.label;
				const offs = ME.divideOffsets({ formation: o.value }, 5, 0, 1);
				let dots = '<path d="M-2.3 0 h0.9" stroke="currentColor" stroke-width=".12" opacity=".5" marker-end=""/><path d="M-1.55 -0.18 L-1.3 0 L-1.55 0.18" fill="none" stroke="currentColor" stroke-width=".12" opacity=".5"/>';
				offs.forEach((q, i) => { const jit = o.value === 'cluster' ? [[0,0],[0.18,0.1],[-0.15,0.14],[0.05,-0.18],[-0.12,-0.1]][i] : [0,0]; const k = (o.value === 'circle' || o.value === 'arc') ? 1.15 : 0.55, cj = o.value === 'cluster' ? 2.2 : 1; dots += '<circle cx="' + (q.x * k + 0.5 + jit[0] * cj).toFixed(2) + '" cy="' + (q.y * k + jit[1] * cj).toFixed(2) + '" r="0.26" fill="currentColor"/>'; });
				b.innerHTML = '<svg viewBox="-2.6 -1.6 5.2 3.2">' + dots + '</svg><span>' + esc(o.label.replace(' (same spot)', '').replace(' (fan)', '').replace('Line across its path', 'Across').replace('Line along its path', 'Along').replace(' line', '')) + '</span>';
				b.addEventListener('click', () => { pushUndo(); n.params[p.key] = o.value; markDirty(); refresh(); });
				grid.appendChild(b);
			}
			wrap.appendChild(grid);
		} else if(p.type === 'text'){
			const inp = h('input', 'mf-text');
			inp.type = 'text'; inp.maxLength = p.max || 40; inp.spellcheck = false; inp.value = val == null ? '' : String(val); inp.placeholder = p.placeholder || '';
			inp.addEventListener('focus', begin);
			inp.addEventListener('input', () => { begin(); n.params[p.key] = inp.value; markDirty(); });
			inp.addEventListener('change', end);
			inp.addEventListener('keydown', e => { e.stopPropagation(); if(e.key === 'Enter') inp.blur(); });
			wrap.appendChild(inp);
		} else if(p.type === 'domainLook'){
			// the domain's look: a live thumbnail, the designer, a dice roll
			const LKm = window.MagicDomainLook, ARTm = window.MagicDomainArt;
			const box = h('div', 'mf-lookcard');
			if(!LKm || !ARTm){ box.textContent = 'The domain painter did not load.'; wrap.appendChild(box); return wrap; }
			const look = val ? LKm.sanitize(val) : LKm.resolve(n.params, true);
			const cv = document.createElement('canvas'); cv.width = 528; cv.height = 300; cv.className = 'mf-lookprev';
			box.appendChild(cv);
			const base = LKm.PRESETS[look.preset];
			box.appendChild(h('div', 'mf-lookname', val ? (look.preset === 'custom' || !base ? 'Your own look' : 'Your look · from ' + esc(base.name)) : 'From the theme · ' + esc(base ? base.name : 'Void')));
			const row = h('div', 'mf-lookrow');
			const design = h('button', 'mf-btn mf-lookbtn', '🎨 Design the look');
			design.addEventListener('click', () => {
				if(!window.DomainDesigner){ toast('The Domain Designer did not load', 'err'); return; }
				window.DomainDesigner.open({ look, title: n.params.title, form: n.params.form,
					onSave: (L, title) => { pushUndo(); n.params.look = L; if(title) n.params.title = title; markDirty(); refresh(); } });
			});
			const dice = h('button', 'mf-btn', '🎲'); dice.title = 'A random look';
			dice.addEventListener('click', () => { pushUndo(); n.params.look = LKm.random(Math.floor(Math.random() * 1e9)); markDirty(); refresh(); });
			row.appendChild(design); row.appendChild(dice);
			if(val){ const clr = h('button', 'mf-btn', '↺'); clr.title = 'Forget this look and use the theme below'; clr.addEventListener('click', () => { pushUndo(); n.params.look = null; markDirty(); refresh(); }); row.appendChild(clr); }
			box.appendChild(row);
			wrap.appendChild(box);
			requestAnimationFrame(() => { try { ARTm.thumbnail(cv.getContext('2d'), look, 528, 300, 2.4, { title: n.params.title }); } catch(e){} });
		} else if(p.type === 'select' && p.swatches){
			// a row of looks, each painted in its own colours
			const grid = h('div', 'mf-swatches mf-looks');
			for(const c of p.swatches){
				const b = h('button', 'mf-swatch' + (String(val) === String(c.value) ? ' on' : ''));
				b.title = c.label; b.dataset.v = c.value;
				b.innerHTML = '<i style="background:radial-gradient(circle at 50% 50%,' + (c.c2 || '#fff') + ' 0,' + (c.c1 || '#888') + ' 55%,' + (c.bg || '#000') + ' 100%)"></i><span>' + esc(c.label) + '</span>';
				b.addEventListener('click', () => { pushUndo(); n.params[p.key] = c.value; markDirty(); refresh(); });
				grid.appendChild(b);
			}
			wrap.appendChild(grid);
		} else if(p.type === 'select' && n.type === 'color' && p.key === 'color' && ME.COLOR_PRESETS){
			// the Colour rune: a row of swatches (each shows the glow the energy will take)
			const grid = h('div', 'mf-swatches');
			for(const c of ME.COLOR_PRESETS){
				const b = h('button', 'mf-swatch' + (val === c.value ? ' on' : ''));
				b.title = c.label;
				const pal = c.pal;
				b.innerHTML = '<i style="background:' + (pal ? 'radial-gradient(circle at 50% 50%,' + pal.core + ' 0,' + pal.mid + ' 45%,' + pal.outer + ' 100%)' : 'conic-gradient(#ff8a3d,#ffd84d,#8ff0c0,#7a5cff,#ff6ec4,#ff8a3d)') + '"></i><span>' + esc(c.label) + '</span>';
				b.addEventListener('click', () => { pushUndo(); n.params[p.key] = c.value; markDirty(); refresh(); });
				grid.appendChild(b);
			}
			wrap.appendChild(grid);
		} else if(p.type === 'select'){
			const opts = paramOptionsOf(p, n.params);
			if(opts.length && !opts.some(o => String(o.value) === String(n.params[p.key]))){ n.params[p.key] = opts[0].value; setTimeout(() => refresh({ keepInspector:true }), 0); }      // its choices depend on another field (Binding Vow: the vows of the chosen kind)
			if(opts.length <= 4 && !opts.some(o => o.group)){
				const seg = h('div', 'mf-seg');
				for(const o of opts){
					const b = h('button', String(val) === String(o.value) ? 'on' : '', esc(o.label));
					b.dataset.v = o.value;
					b.addEventListener('click', () => { pushUndo(); n.params[p.key] = o.value; markDirty(); refresh(); });
					seg.appendChild(b);
				}
				wrap.appendChild(seg);
			} else {
				const s = h('select', 'mf-select');
				const groups = new Map();
				for(const o of opts){
					const op = h('option', null, esc(o.label)); op.value = o.value; if(String(o.value) === String(val)) op.selected = true;
					if(o.group){ let g = groups.get(o.group); if(!g){ g = document.createElement('optgroup'); g.label = o.group; groups.set(o.group, g); s.appendChild(g); } g.appendChild(op); }
					else s.appendChild(op);
				}
				s.addEventListener('change', () => { pushUndo(); const hit = opts.find(o => String(o.value) === s.value); n.params[p.key] = hit ? hit.value : s.value; markDirty(); refresh(); });      // keep the option's own type
				wrap.appendChild(s);
			}
		} else if(p.type === 'shapeDraw'){
			const box = h('div', 'mf-owncard');
			const ok = !!ME.customShapeKey(val);
			box.innerHTML = '<div class="mf-ownprev">' + (ok ? customIcon(val) : '<span>No shape drawn yet</span>') + '</div>';
			const b = h('button', 'mf-btn', ok ? '✎ Edit your shape' : '✎ Draw your shape');
			b.addEventListener('click', () => openShapeEditor(n, null));
			box.appendChild(b);
			const Lib = window.ShapeEditor && window.ShapeEditor.Library;
			if(ok && Lib){
				const have = Lib.find(val);
				if(have) box.appendChild(h('div', 'mf-hint', '★ In your library as <b>' + esc(have.name) + '</b>'));
				else {
					const sb = h('button', 'mf-btn', '★ Save to library');
					sb.title = 'Keep this shape in your library so you can pick it for any spell (rename it in the shape editor)';
					sb.addEventListener('click', () => { const e = Lib.save(Lib.nextName(), val, n.params.shapeDoc); toast(e ? 'Saved “' + e.name + '” to your shape library' : 'Your shape library is full — delete one in the shape editor', e ? 'ok' : 'err'); refresh(); });
					box.appendChild(sb);
				}
			}
			wrap.appendChild(box);
		} else if(p.type === 'technique'){
			const list = ME.Techniques.list();
			if(!list.length){
				const e = h('div', 'mf-empty-state', '<b>No techniques learned yet</b>Techniques will appear here once discovered. Invest Technique Points in one to use it in spells.');
				wrap.appendChild(e);
			} else {
				const s = h('select', 'mf-select');
				const none = h('option', null, '— choose —'); none.value = ''; s.appendChild(none);
				for(const t of list){
					const ok = ME.Techniques.canUse(S.profile, t.id);
					if(!ok && t.id !== val) continue;          // only techniques you have access to can be chosen
					const op = h('option', null, esc(t.name) + (ok ? ' · ' + ME.Techniques.points(S.profile, t.id) + ' pt' : ' (no access)')); op.value = t.id;
					if(!ok) op.disabled = true;
					if(t.id === val) op.selected = true; s.appendChild(op);
				}
				if(!list.some(t => ME.Techniques.canUse(S.profile, t.id))) wrap.appendChild(h('div', 'mf-hint', 'You have no Technique Points invested yet — open Technique Points to unlock a technique.'));
				s.addEventListener('change', () => { pushUndo(); n.params[p.key] = s.value; markDirty(); refresh(); });
				wrap.appendChild(s);
			}
			const b = h('button', 'mf-btn', '✧ Technique Points…'); b.style.marginTop = '8px'; b.addEventListener('click', openTechniques);
			wrap.appendChild(b);
		}
		if(p.hint) wrap.appendChild(h('div', 'mf-hint', esc(p.hint)));
		return wrap;
	}

	/* your own shape: its outline as an icon (a pencil when nothing is drawn yet) */
	function customIcon(poly){
		const P = ME.cleanPoly ? ME.cleanPoly(poly) : null;
		if(!P) return '<svg viewBox="-2.6 -1.6 5.2 3.2"><path d="M-1.4 1.1 L-1.1 0.2 L0.9 -1.2 L1.4 -0.6 L-0.6 0.8 Z" fill="currentColor" opacity=".8"/><path d="M-1.6 1.3 L1.6 1.3" stroke="currentColor" stroke-width=".12"/></svg>';
		let a = 1e9, b = 1e9, c = -1e9, d = -1e9; for(const q of P){ a = Math.min(a, q[0]); b = Math.min(b, q[1]); c = Math.max(c, q[0]); d = Math.max(d, q[1]); }
		const k = Math.min(4.6 / ((c - a) || 1), 2.6 / ((d - b) || 1)), mx = (a + c) / 2, my = (b + d) / 2;
		return '<svg viewBox="-2.6 -1.6 5.2 3.2"><path d="' + P.map((q, i) => (i ? 'L' : 'M') + ((q[0] - mx) * k).toFixed(2) + ' ' + ((q[1] - my) * k).toFixed(2)).join('') + 'Z" fill="currentColor" opacity=".85"/></svg>';
	}
	/* your saved shapes, one click to use (they live in ShapeEditor.Library, kept in this browser) */
	function libraryGrid(n, wrap){
		const Lib = window.ShapeEditor && window.ShapeEditor.Library; if(!Lib) return;
		const list = Lib.list();
		const head = h('div', 'mf-libhead', '★ Your shape library' + (list.length ? ' <span>' + list.length + '</span>' : ''));
		const mg = h('button', 'mf-libmanage', list.length ? 'Manage…' : '+ New');
		mg.title = list.length ? 'Open the shape editor to draw, rename or delete library shapes' : 'Draw a shape and save it to your library';
		mg.addEventListener('click', () => openShapeEditor(n, n.params.shape));
		head.appendChild(mg);
		wrap.appendChild(head);
		if(!list.length){ wrap.appendChild(h('div', 'mf-hint', 'Shapes you draw and save (★ Save to library) appear here, ready to use in any spell.')); return; }
		const cur = n.params.shape === 'custom' && ME.customShapeKey(n.params.poly) ? Lib.find(n.params.poly) : null;
		const grid = h('div', 'mf-shapes mf-libgrid');
		for(const e of list){
			const b = h('button', 'mf-shape' + (cur && cur.id === e.id ? ' on' : ''));
			b.title = 'Use “' + e.name + '”';
			b.innerHTML = customIcon(e.poly) + '<span>' + esc(e.name) + '</span>';
			b.addEventListener('click', () => {
				pushUndo(); n.params.shape = 'custom'; n.params.poly = e.poly.map(q => [ q[0], q[1] ]); n.params.shapeDoc = e.doc ? JSON.parse(JSON.stringify(e.doc)) : null; markDirty(); refresh();
			});
			grid.appendChild(b);
		}
		wrap.appendChild(grid);
	}
	function openShapeEditor(n, startShape, revertTo){
		if(!window.ShapeEditor){ toast('The shape editor did not load', 'err'); return; }
		// remember WHICH rune of WHICH forge session this drawing belongs to (by id, not by object: an undo or a
		// re-render replaces the node objects, and a write to a stale one would land nowhere — or in another spell)
		const sess = S, nodeId = n.id;
		const live = () => (S === sess && S && S.def.nodes[nodeId]) || null;
		window.ShapeEditor.open({ poly: n.params.poly, doc: n.params.shapeDoc, start: startShape && startShape !== 'keep' && startShape !== 'custom' ? startShape : 'sphere',
			onSave(poly, doc){
				const node = live(); if(!node) return;
				pushUndo(); node.params.shape = 'custom'; node.params.poly = poly; node.params.shapeDoc = doc;
				markDirty(); select({ type: 'node', id: nodeId }, true); refresh();
			},
			onCancel(){
				const node = live(); if(!node) return;
				// picked "Draw your own" but drew nothing: go back to the shape it had
				if(node.params.shape === 'custom' && !ME.customShapeKey(node.params.poly) && revertTo && revertTo !== 'custom') node.params.shape = revertTo;
				refresh();
			} });
	}
	function shapeIcon(key){
		const sh = ME.SHAPES[key];
		if(key === 'keep') return '<svg viewBox="-2.6 -1.6 5.2 3.2"><path d="M-1.6 0 A1.3 1.3 0 1 1 1.2 0.8" fill="none" stroke="currentColor" stroke-width="0.22" stroke-linecap="round"/><path d="M1.2 0.8 l0.1 -0.75 l0.55 0.45z" fill="currentColor"/></svg>';
		if(!sh || !sh.poly){
			let d = '';
			for(let i = 0; i <= 24; i++){ const a = i / 24 * Math.PI * 2, r = 1.1 + 0.18 * Math.sin(a * 3 + 1) + 0.1 * Math.sin(a * 5); d += (i ? 'L' : 'M') + (Math.cos(a) * r).toFixed(2) + ' ' + (Math.sin(a) * r).toFixed(2); }
			return '<svg viewBox="-2.6 -1.6 5.2 3.2"><path d="' + d + 'Z" fill="currentColor" opacity=".55" stroke="currentColor" stroke-width=".12"/></svg>';
		}
		const d = sh.poly.map((q, i) => (i ? 'L' : 'M') + q[0].toFixed(2) + ' ' + q[1].toFixed(2)).join('') + 'Z';
		const hole = sh.hole ? '<circle r="' + (1.2 * sh.hole).toFixed(2) + '" fill="#0b1022"/>' : '';
		return '<svg viewBox="-2.6 -1.6 5.2 3.2"><g transform="rotate(-18)"><path d="' + d + '" fill="currentColor" opacity=".8" stroke="currentColor" stroke-width=".1" stroke-linejoin="round"/>' + hole + '</g></svg>';
	}

	function inspectLink(n, head, body){
		const p = S.def.nodes[n.parent];
		const l = n.link;
		const colors = { instant:'#7fe3ff', delay:'#ffc96b', condition:'#c99bff' };
		head.style.setProperty('--c', colors[l.mode]);
		const pn = ME.Runes[p && p.type], cn = ME.Runes[n.type];
		head.innerHTML = headHtml(LINK_ICON[l.mode], 'Connector', (pn ? pn.name : '?') + '  →  ' + (cn ? cn.name : '?'), colors[l.mode]);
		body.innerHTML = '<div class="mf-desc">The connector decides <b>when</b> the next rune runs. It is not a rune and does not use a rune slot.</div>';
		const sec = h('div', 'mf-sec'); sec.innerHTML = '<div class="mf-sec-t">Execution</div>';
		const seg = h('div', 'mf-seg modes');
		for(const m of ['instant','delay','condition']){
			const b = h('button', m + (l.mode === m ? ' on' : ''), LINK_ICON[m] + ' ' + (m === 'condition' ? 'Wait until' : m[0].toUpperCase() + m.slice(1)));
			b.addEventListener('click', () => { pushUndo(); l.mode = m; markDirty(); refresh(); flashBadge(n.id); });
			seg.appendChild(b);
		}
		sec.appendChild(seg); body.appendChild(sec);
		const box = h('div', 'mf-sec');
		if(l.mode === 'instant'){
			box.innerHTML = '<div class="mf-hint">The child rune executes immediately after the parent finishes.</div>';
		} else if(l.mode === 'delay'){
			box.appendChild(rangeField('Delay', l.delay, 0.05, 30, 0.05, 's', v => { l.delay = v; }));
			box.appendChild(h('div', 'mf-hint', 'The wait happens between the two modifications. The spell\'s 2-minute lifetime still applies.'));
		} else {
			condBox(box, l, 'Only checked once execution reaches this connector. If it is never met, only this branch ends — sibling branches keep going.', true);
		}
		body.appendChild(box);
		const errs = S.report.byLink[n.id] || [];
		if(errs.length){ const e = h('div', 'mf-sec'); e.innerHTML = '<div class="mf-sec-t">Problems</div><div class="mf-errlist">' + errs.map(x => '<div class="mf-erritem"><i>⚠</i><span>' + esc(x.text) + '</span></div>').join('') + '</div>'; body.appendChild(e); }
		const act = h('div', 'mf-actions');
		act.innerHTML = '<button class="mf-btn primary" data-x="insert" style="flex-basis:100%">＋ Insert a rune here</button><button class="mf-btn" data-x="parent">↑ Parent rune</button><button class="mf-btn" data-x="child">↓ Child rune</button>';
		act.querySelector('[data-x=insert]').addEventListener('click', () => insertBetween(n.id));
		act.querySelector('[data-x=parent]').addEventListener('click', () => select({ type:'node', id:n.parent }));
		act.querySelector('[data-x=child]').addEventListener('click', () => select({ type:'node', id:n.id }));
		body.appendChild(act);
	}
	/* the condition picker (groups, search, settings, give-up time) — shared by connectors and a Loop's return branch */
	function condBox(box, l, hint, timeout, label){
		label = label || 'Wait until';
		/* conditions come in groups (Target, Enemies around, You, This energy, Contact, Spell & time, Zone & domain)
		   with a search box, so the one you want is a click or a few letters away */
		const f = h('div', 'mf-field'); f.dataset.key = 'cond'; f.innerHTML = '<div class="mf-field-top"><label>' + label + '</label></div>';
		const curDef = ME.Conditions[l.cond.type];
		const groups = (ME.CONDITION_GROUPS || []).filter(g => Object.keys(ME.Conditions).some(k => ME.Conditions[k].group === g.id));
		if(!S.condGroup || !groups.some(g => g.id === S.condGroup) || (curDef && curDef.group !== S.condGroup && !S.condPinned)) S.condGroup = curDef ? curDef.group : groups[0].id;
		const search = h('input', 'mf-condsearch'); search.placeholder = 'Search conditions…'; search.spellcheck = false; search.value = S.condQuery || '';
		const chips = h('div', 'mf-condgroups');
		const list = h('div', 'mf-condlist');
		const pickCond = (id) => { pushUndo(); l.cond.type = id; l.cond.params = ME.condDefaults(id); S.condQuery = ''; S.condPinned = false; markDirty(); refresh(); };
		const paintList = () => {
			list.innerHTML = '';
			const q = (search.value || '').trim().toLowerCase();
			const ids = Object.keys(ME.Conditions).filter(k => { const c = ME.Conditions[k]; return q ? ((c.name + ' ' + (c.description || '')).toLowerCase().indexOf(q) >= 0) : c.group === S.condGroup; });
			if(!ids.length){ list.appendChild(h('div', 'mf-hint', 'No condition matches “' + esc(q) + '”.')); return; }
			for(const k of ids){
				const c = ME.Conditions[k], g = groups.find(x => x.id === c.group);
				const b = h('button', 'mf-condbtn' + (k === l.cond.type ? ' on' : ''), esc(c.name) + (q && g ? '<small>' + esc(g.label) + '</small>' : ''));
				b.title = c.description || '';
				b.addEventListener('click', () => pickCond(k));
				list.appendChild(b);
			}
		};
		const paintChips = () => {
			chips.innerHTML = '';
			for(const g of groups){
				const n = Object.keys(ME.Conditions).filter(k => ME.Conditions[k].group === g.id).length;
				const b = h('button', 'mf-condchip' + (g.id === S.condGroup && !(search.value || '').trim() ? ' on' : ''), esc(g.label) + ' <span>' + n + '</span>');
				b.title = g.hint || '';
				b.addEventListener('click', () => { S.condGroup = g.id; S.condPinned = true; search.value = ''; S.condQuery = ''; paintChips(); paintList(); });
				chips.appendChild(b);
			}
		};
		search.addEventListener('input', () => { S.condQuery = search.value; paintChips(); paintList(); });
		paintChips(); paintList();
		f.appendChild(search); f.appendChild(chips); f.appendChild(list);
		f.appendChild(h('div', 'mf-condnow', (label === 'Wait until' ? 'Waiting until' : 'Checks') + ': <b>' + esc(curDef ? curDef.name : 'unknown') + '</b>'));
		box.appendChild(f);
		const cd = ME.Conditions[l.cond.type];
		if(cd){
			box.appendChild(h('div', 'mf-desc', esc(cd.description)));
			// (this used an undefined limit before, which broke the panel for every condition with settings)
			l.cond.params = l.cond.params || {};
			const holder = { type: 'cond', params: l.cond.params };
			for(const cp of cd.params){
				if(l.cond.params[cp.key] == null) l.cond.params[cp.key] = cp.default;
				box.appendChild(paramControl(holder, cp));
			}
		}
		if(timeout) box.appendChild(rangeField('Give up after', l.cond.timeout, 0.5, 120, 0.5, 's', v => { l.cond.timeout = v; }));
		if(hint) box.appendChild(h('div', 'mf-hint', hint));
	}
	/* the Loop's return branch: where it goes back to, and what has to be true for it to repeat */
	function inspectLoop(n, head, body){
		const L = n.loop, t = L.to && S.def.nodes[L.to];
		head.style.setProperty('--c', LOOP_COL);
		head.innerHTML = headHtml('↻', 'Return branch', 'Loop  →  ' + (t ? runeName(t) : 'not connected'), LOOP_COL);
		body.innerHTML = '<div class="mf-desc">The return branch decides <b>when</b> the Loop jumps back to ' + (t ? '<b>' + esc(runeName(t)) + '</b>' : 'the rune it is connected to') + ' and runs everything from there again. It is not a rune and does not use a rune slot. Every repeat costs the repeated runes\' mana × ' + ME.CONFIG.loopFee + '.</div>';
		const sec = h('div', 'mf-sec'); sec.innerHTML = '<div class="mf-sec-t">Repeat</div>';
		const seg = h('div', 'mf-seg modes');
		for(const m of [['instant', '↻ Every time'], ['condition', '◆ Only when…']]){
			const b = h('button', (L.mode === m[0] ? 'on' : ''), m[1]);
			b.addEventListener('click', () => { pushUndo(); L.mode = m[0]; markDirty(); refresh(); });
			seg.appendChild(b);
		}
		sec.appendChild(seg); body.appendChild(sec);
		const box = h('div', 'mf-sec');
		if(L.mode !== 'condition'){
			box.innerHTML = '<div class="mf-hint">The loop goes back as soon as it reaches this point (after the pause set on the Loop rune), until its repeats are used up.</div>';
		} else {
			const seg2 = h('div', 'mf-seg modes');
			for(const m of [['wait', '⏳ When it happens'], ['now', '✔ While still true']]){
				const b = h('button', ((L.check || 'wait') === m[0] ? 'on' : ''), m[1]);
				b.title = m[0] === 'wait' ? 'Each repeat waits until the condition occurs (and gives up after a while)' : 'Each repeat first checks the condition right now: if it no longer holds, the loop ends';
				b.addEventListener('click', () => { pushUndo(); L.check = m[0]; markDirty(); refresh(); });
				seg2.appendChild(b);
			}
			box.appendChild(seg2);
			box.appendChild(h('div', 'mf-hint', (L.check || 'wait') === 'now'
				? 'Checked at the moment the loop would go back: the target is still alive, the energy is still there, you are still in the air… When it is no longer true the loop ends and the runes after it run.'
				: 'Every repeat waits for the condition to occur. If it never does, the loop ends after the give-up time and the runes after it run.'));
			condBox(box, L, '', (L.check || 'wait') !== 'now', (L.check || 'wait') === 'now' ? 'Still true' : 'Wait until');
		}
		body.appendChild(box);
		const errs = S.report.byLink['loop:' + n.id] || [];
		if(errs.length){ const e = h('div', 'mf-sec'); e.innerHTML = '<div class="mf-sec-t">Problems</div><div class="mf-errlist">' + errs.map(x => '<div class="mf-erritem"><i>⚠</i><span>' + esc(x.text) + '</span></div>').join('') + '</div>'; body.appendChild(e); }
		const act = h('div', 'mf-actions');
		act.innerHTML = '<button class="mf-btn" data-x="loop">↻ Loop rune</button><button class="mf-btn" data-x="to">⌖ Returns to</button><button class="mf-btn danger" data-x="off">✕ Disconnect</button>';
		act.querySelector('[data-x=loop]').addEventListener('click', () => select({ type:'node', id:n.id }));
		const tb = act.querySelector('[data-x=to]'); if(t) tb.addEventListener('click', () => { select({ type:'node', id:t.id }); ensureVisible(t.id); }); else tb.disabled = true;
		act.querySelector('[data-x=off]').addEventListener('click', () => disconnectLoop(n.id));
		body.appendChild(act);
	}
	function rangeField(label, val, min, max, step, unit, set){
		const n = { params: { v: val } };
		return paramControl(n, { key:'v', label, type:'float', min, max, step, unit }, set);
	}
	function flashBadge(id){ const L = S.linkEls[id]; if(L){ L.badge.classList.remove('fired'); void L.badge.offsetWidth; L.badge.classList.add('fired'); } }

	/* ------------------------------------------------------------------ picker */
	function openPicker(id, mode){
		closeMenus();
		const n = S.def.nodes[id]; if(!n) return;
		const el = h('div', 'mf-picker');
		el.innerHTML = '<div class="mf-picker-head"><input placeholder="Search runes…" spellcheck="false" /></div><div class="mf-picker-list"></div><div class="mf-picker-foot"><span>↑↓ choose</span><span>Enter pick</span><span>Esc cancel</span></div>';
		S.els.root.appendChild(el);
		S.picker = { el, id, mode, items: [], kb: 0 };
		// context fitness: try each rune in this slot and see if it is valid here
		const fitness = {};
		const save = { type: n.type, params: n.params };
		for(const t in ME.Runes){
			if(ME.Runes[t].hidden) continue;
			n.type = t; n.params = ME.paramDefaults(t);
			if(t === 'technique'){ const u = ME.Techniques.list().find(x => ME.Techniques.canUse(S.profile, x.id)); if(u) n.params.technique = u.id; }
			const rep = ME.validate(S.def, S.profile);
			const e = (rep.byNode[id] || []).filter(x => x.level === 'error' && x.code !== 'CAPACITY');
			fitness[t] = e.length ? { text: e[0].text, code: e[0].code } : null;
		}
		n.type = save.type; n.params = save.params;
		const input = el.querySelector('input'), list = el.querySelector('.mf-picker-list');
		const render = () => {
			const q = input.value.trim().toLowerCase();
			list.innerHTML = ''; S.picker.items = [];
			const addItem = (R, c) => {
				const bad = fitness[R.id];
				const it = h('div', 'mf-pitem' + (bad ? ' bad' : ''));
				it.style.setProperty('--c', c.color);
				it.innerHTML = '<div class="mf-glyph">' + R.glyph + '</div><div><b>' + esc(R.name) + '</b><small>' + esc(R.description) + '</small></div>' + (bad ? '<span class="tag">' + esc(shortTag(bad)) + '</span>' : '');
				it.title = bad ? '⚠ ' + bad.text : R.description;
				const idx = S.picker.items.length;
				it.addEventListener('pointerenter', () => { S.picker.kb = idx; paintKb(); });
				it.addEventListener('click', () => pick(R.id));
				S.picker.items.push({ el: it, id: R.id });
				list.appendChild(it);
			};
			if(q){
				// ranked results: name matches first, then category, then description
				const scored = [];
				for(const k in ME.Runes){
					const R = ME.Runes[k], c = ME.CATEGORY_MAP[R.category] || { label:'', color:'#9fe6ff' };
					if(R.hidden) continue;
					const nm = R.name.toLowerCase();
					let sc = -1;
					if(nm.startsWith(q)) sc = 0; else if(nm.split(/[^a-z]+/).some(w => w.startsWith(q))) sc = 1; else if(nm.indexOf(q) >= 0) sc = 2;
					else if(c.label.toLowerCase().indexOf(q) >= 0) sc = 3; else if(R.description.toLowerCase().indexOf(q) >= 0) sc = 4;
					if(sc >= 0) scored.push({ R, c, sc });
				}
				scored.sort((a, b) => a.sc - b.sc || (fitness[a.R.id] ? 1 : 0) - (fitness[b.R.id] ? 1 : 0));
				if(scored.length) list.appendChild(h('div', 'mf-pcat', 'Results'));
				for(const x of scored) addItem(x.R, x.c);
			} else {
				for(const c of ME.CATEGORIES){
					const runes = Object.keys(ME.Runes).map(k => ME.Runes[k]).filter(R => R.category === c.id && !R.hidden);
					if(!runes.length) continue;
					list.appendChild(h('div', 'mf-pcat', esc(c.label)));
					for(const R of runes) addItem(R, c);
				}
			}
			if(!S.picker.items.length) list.appendChild(h('div', 'mf-pcat', 'No runes match'));
			S.picker.kb = Math.min(S.picker.kb, Math.max(0, S.picker.items.length - 1));
			paintKb();
		};
		const paintKb = () => { S.picker.items.forEach((x, i) => x.el.classList.toggle('kb', i === S.picker.kb)); const cur = S.picker.items[S.picker.kb]; if(cur){ const L = list, top = cur.el.offsetTop, bot = top + cur.el.offsetHeight; if(top < L.scrollTop) L.scrollTop = top - 24; else if(bot > L.scrollTop + L.clientHeight) L.scrollTop = bot - L.clientHeight + 6; } };
		const pick = (t) => { const was = S.picker; closePicker(true); setType(was.id, t); toast(ME.Runes[t].name + ' placed'); };
		input.addEventListener('input', () => { S.picker.kb = 0; render(); });
		input.addEventListener('keydown', e => {
			if(e.key === 'ArrowDown'){ e.preventDefault(); S.picker.kb = Math.min(S.picker.items.length - 1, S.picker.kb + 1); paintKb(); }
			else if(e.key === 'ArrowUp'){ e.preventDefault(); S.picker.kb = Math.max(0, S.picker.kb - 1); paintKb(); }
			else if(e.key === 'Enter'){ e.preventDefault(); const cur = S.picker.items[S.picker.kb]; if(cur) pick(cur.id); }
			else if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); closePicker(false); }
		});
		render();
		// place near the node
		const r = S.els.root.getBoundingClientRect(), v = S.view, p = nodePos(n);
		const sx = p.x * v.tz + v.tx, sy = p.y * v.tz + v.ty;
		let x = sx + (HW + 30) * v.tz, y = sy - 120;
		if(x + 380 > r.width - (S.els.root.classList.contains('insp-hidden') ? 12 : 340)) x = sx - (HW + 30) * v.tz - 370;
		x = clamp(x, 12, r.width - 382); y = clamp(y, 66, Math.max(66, r.height - 580));
		el.style.left = x + 'px'; el.style.top = y + 'px';
		input.focus({ preventScroll:true });
		setTimeout(() => { if(S && S.picker && S.picker.el === el && document.activeElement !== input) input.focus({ preventScroll:true }); }, 30);
		setTimeout(() => document.addEventListener('pointerdown', outsidePicker, true), 0);
	}
	/* a short, specific reason a rune does not fit this slot yet (never a bare "invalid") */
	function shortTag(b){
		const t = (b && b.text) || '', c = (b && b.code) || '';
		if(/requires energy|needs energy|energy is needed/i.test(t) || /ENERGY|REINF_ZONE/.test(c)) return 'needs energy';
		if(/zone/i.test(c) || /needs? a zone|from a zone|a zone earlier/i.test(t)) return 'needs a zone';
		if(/control/i.test(c) || /energy control/i.test(t)) return 'needs more Control';
		if(/no valid target|needs a target|target/i.test(t)) return 'needs target';
		if(/TECH_LOCKED/.test(c) || /technique points|not unlocked/i.test(t)) return 'locked';
		if(/technique|manipulate/i.test(t)) return 'wrong energy';
		if(/PARAM/.test(c)) return 'set options';
		if(/rule/i.test(t)) return 'too many rules';
		return 'needs set-up first';
	}
	function outsidePicker(e){ if(S && S.picker && !S.picker.el.contains(e.target)) closePicker(false); }
	function closePicker(picked){
		if(!S || !S.picker) return;
		document.removeEventListener('pointerdown', outsidePicker, true);
		const pk = S.picker; S.picker = null;
		pk.el.remove();
		if(!picked && pk.mode === 'insert'){
			const n = S.def.nodes[pk.id];
			if(n && !n.type && S.undo.length){ restoreQuiet(S.undo.pop()); }
		}
		if(!picked && pk.mode === 'new'){
			const n = S.def.nodes[pk.id];
			if(n && !n.type && !kidsOf(pk.id).length){
				// cancelled a brand-new slot: drop it (and its undo entry)
				delete S.def.nodes[pk.id];
				if(S.undo.length) S.undo.pop();
				S.sel = n.parent ? { type:'node', id:n.parent } : null;
				refresh();
			}
		}
	}

	/* ------------------------------------------------------------------ menus / dialogs */
	function closeMenus(){ if(S && S.ctx){ S.ctx.remove(); S.ctx = null; } }
	function menu(e, items){
		closeMenus();
		const m = h('div', 'mf-ctx');
		for(const it of items){
			if(it === '-'){ m.appendChild(h('hr')); continue; }
			const b = h('button', it.cls || '', it.label + (it.k ? '<span class="k">' + it.k + '</span>' : ''));
			b.addEventListener('click', () => { closeMenus(); it.fn(); });
			m.appendChild(b);
		}
		const r = S.els.root.getBoundingClientRect();
		m.style.left = clamp(e.clientX - r.left, 6, r.width - 200) + 'px';
		m.style.top = clamp(e.clientY - r.top, 6, r.height - 30 * items.length - 20) + 'px';
		S.els.root.appendChild(m); S.ctx = m;
		setTimeout(() => document.addEventListener('pointerdown', function off(ev){ if(S && S.ctx && !S.ctx.contains(ev.target)){ closeMenus(); } document.removeEventListener('pointerdown', off, true); }, true), 0);
	}
	function nodeMenu(id, e){
		const n = S.def.nodes[id];
		const items = [
			{ label:'⇆ Change rune…', k:'Dbl-click', fn: () => openPicker(id, 'change') },
			{ label:'◎ Center here', k:'C', fn: () => centerOn(id) }
		];
		if(kidsOf(id).length) items.push({ label: n.ui && n.ui.collapsed ? '▸ Expand branch' : '▾ Collapse branch', fn: () => toggleCollapse(id) });
		if(n.parent) items.push({ label:'◆ Edit incoming connector', fn: () => select({ type:'link', id }) });
		items.push('-');
		if(kidsOf(id).length && (id !== S.def.rootId || kidsOf(id).length === 1)) items.push({ label:'✕ Delete this rune only (keep what follows)', k:'Shift+Del', cls:'danger', fn: () => deleteRuneOnly(id) });
		items.push({ label: id === S.def.rootId ? '✕ Clear first rune' : '✕ Delete ' + (kidsOf(id).length ? 'branch (' + subtree(id).length + ')' : 'rune'), k:'Del', cls:'danger', fn: () => deleteNode(id) });
		menu(e, items);
	}
	function linkMenu(id, e){
		const l = S.def.nodes[id].link;
		const setM = m => () => { pushUndo(); l.mode = m; markDirty(); refresh(); flashBadge(id); };
		menu(e, [
			{ label:'＋ Insert rune here', fn: () => insertBetween(id) },
			'-',
			{ label:'⚡ Instant', fn: setM('instant') },
			{ label:'⏱ Delay', fn: setM('delay') },
			{ label:'◆ Wait until…', fn: setM('condition') }
		]);
	}
	function modal(title, text, buttons, extra){
		const bg = h('div', 'mf-modal-bg');
		const m = h('div', 'mf-modal');
		m.innerHTML = '<h3>' + esc(title) + '</h3>' + (text ? '<p>' + text + '</p>' : '');
		if(extra) m.appendChild(extra);
		const row = h('div', 'row');
		for(const b of buttons){
			const el = h('button', 'mf-btn ' + (b.cls || ''), esc(b.label));
			el.addEventListener('click', () => { if(b.keep !== true) bg.remove(); if(b.fn) b.fn(bg); });
			row.appendChild(el);
		}
		m.appendChild(row); bg.appendChild(m);
		bg.addEventListener('pointerdown', e => { if(e.target === bg) bg.remove(); });
		S.els.root.appendChild(bg);
		S.modal = bg;
		return bg;
	}
	function confirmDiscard(){
		modal('Unsaved changes', 'Save this spell before leaving the Rune Forge?', [
			{ label:'Keep editing' },
			{ label:'Discard', cls:'danger', fn: () => close(true) },
			{ label:'Save & close', cls:'primary', fn: () => save(true) }
		]);
	}
	function openShare(){
		const box = h('div');
		const ta = h('textarea'); ta.value = ME.encode(S.def); ta.readOnly = false;
		box.appendChild(ta);
		modal('Share spell', 'Copy this code to share the spell, or paste a code and press Import.', [
			{ label:'Copy', fn: () => { ta.select(); try { navigator.clipboard.writeText(ME.encode(S.def)); } catch(e){ document.execCommand('copy'); } toast('Spell code copied', 'ok'); } },
			{ label:'Import', cls:'primary', keep:true, fn: (bg) => {
				const d = ME.decode(ta.value);
				if(!d){ toast('⚠ That spell code could not be read', 'err'); return; }
				pushUndo(); S.def = d; S.els.name.value = d.name; S.sel = null; markDirty(); refresh(); fit(); bg.remove(); toast('Spell imported', 'ok');
			} },
			{ label:'Close' }
		], box);
	}
	function confirmReset(){
		modal('Reset spell?', 'Removes every rune from this spell and leaves one empty slot. You can undo it with Ctrl+Z until you leave the forge.', [
			{ label:'Cancel' },
			{ label:'Reset spell', cls:'danger', fn: () => {
				pushUndo();
				const name = S.def.name;
				S.def = ME.blankSpell(name);
				S.sel = null; markDirty(); refresh(); fit();
				select({ type:'node', id: S.def.rootId });
				toast('Spell reset', 'ok');
			} }
		]);
	}
	function openTests(){
		const box = h('div');
		const T = ME.devTests;
		if(!T){ toast('Tests are not loaded', 'err'); return; }
		const list = h('div', 'mf-tests');
		for(const t of T.spells()){
			const b = h('button', 'mf-btn', esc(t.name));
			b.addEventListener('click', () => {
				pushUndo(); S.def = ME.normalize(t.def); S.els.name.value = S.def.name; S.sel = null; markDirty(); refresh(); fit();
				if(S.modal) S.modal.remove();
				const need = Object.keys(ME.validate(S.def, ME.devTests.profile()).techniques || {});
				const missing = need.filter(id => !ME.Techniques.canUse(S.profile, id));
				toast(missing.length ? 'Loaded — needs Technique Points in: ' + missing.map(id => ME.Techniques.get(id).name).join(', ') : 'Test spell loaded', missing.length ? 'err' : 'ok');
			});
			list.appendChild(b);
		}
		box.appendChild(list);
		const out = h('pre', 'mf-test-out');
		const run = h('button', 'mf-btn primary', 'Run engine checks');
		run.addEventListener('click', () => {
			const res = T.run();
			out.textContent = res.map(r => (r.pass ? '✓ ' : '✗ ') + r.name + (r.detail ? '   — ' + r.detail : '')).join('\n') + '\n\n' + res.filter(r => r.pass).length + ' / ' + res.length + ' passed';
		});
		box.appendChild(run); box.appendChild(out);
		modal('Test spells', 'Load a development test spell into this slot (replaces the current tree — undo with Ctrl+Z), or run the headless checks for cancellation, splitting, access and reinforcement stacking.', [{ label:'Close' }], box);
	}
	function openTechniques(){
		const box = h('div');
		const list = ME.Techniques.list();
		const mp = S.profile;
		const spent = () => Object.keys(mp.allocations).reduce((s, k) => s + (mp.allocations[k] || 0), 0);
		const draw = () => {
			box.innerHTML = '<div class="mf-stats" style="margin-bottom:10px"><div class="mf-stat"><small>Technique Points</small><b>' + (mp.techniquePoints - spent()) + ' / ' + mp.techniquePoints + ' free</b></div><div class="mf-stat"><small>Techniques invested</small><b>' + Object.keys(mp.allocations).filter(k => mp.allocations[k] > 0).length + ' / 4</b></div></div>';
			if(!list.length){
				box.innerHTML += '<div class="mf-empty-state"><b>No techniques discovered yet</b>Your points are waiting. When you learn a technique it will appear here; invest points to unlock it in Technique and Reverse Technique runes. More points give more power and efficiency, with diminishing returns.</div>';
				return;
			}
			for(const t of list){
				const pts = mp.allocations[t.id] || 0;
				const row = h('div', 'mf-tech-row');
				row.dataset.tech = t.id;
				row.innerHTML = '<span class="nm" style="color:' + t.color + '">' + esc(t.name) + '</span><span class="mf-tech-pts">' + [0,1,2,3].map(i => '<i class="' + (i < pts ? 'on' : '') + '"></i>').join('') + '</span>'
					+ '<small style="color:var(--mf-dim);width:92px">pow ×' + ME.Techniques.power(pts).toFixed(2) + '<br>eff ' + Math.round(ME.Techniques.efficiency(pts) * 100) + '%</small>';
				const minus = h('button', 'mf-btn', '−'), plus = h('button', 'mf-btn', '+');
				minus.classList.add('tp-minus'); plus.classList.add('tp-plus');
				minus.addEventListener('click', () => { if(pts > 0){ mp.allocations[t.id] = pts - 1; changed(); } });
				plus.addEventListener('click', () => {
					const invested = Object.keys(mp.allocations).filter(k => mp.allocations[k] > 0);
					if(spent() >= mp.techniquePoints){ toast('No free Technique Points', 'err'); return; }
					if(!pts && invested.length >= 4){ toast('At most 4 techniques', 'err'); return; }
					mp.allocations[t.id] = pts + 1; changed();
				});
				row.appendChild(minus); row.appendChild(plus);
				box.appendChild(row);
			}
		};
		// testing: one point in every technique (more points are added if you don't have enough)
		const testBtn = h('button', 'mf-btn', '🧪 Test: 1 point in each technique');
		testBtn.style.width = '100%'; testBtn.style.marginTop = '10px';
		testBtn.addEventListener('click', () => {
			mp.allocations = {};
			for(const t of list) mp.allocations[t.id] = 1;
			mp.techniquePoints = Math.max(mp.techniquePoints || 0, list.length);
			toast('1 point in each technique', 'ok'); changed();
		});
		const changed = () => { if(S.opts.onProfileChange) S.opts.onProfileChange({ techniquePoints: mp.techniquePoints, allocations: Object.assign({}, mp.allocations), negativePower: mp.negativePower }); draw(); refresh(); };
		draw();
		const wrapT = h('div'); wrapT.appendChild(box); wrapT.appendChild(testBtn);
		modal('Techniques', 'Technique Points decide which techniques your spells may use.', [{ label:'Done', cls:'primary' }], wrapT);
	}

	/* ------------------------------------------------------------------ search */
	function openSearch(){ S.els.search.classList.add('open'); S.els.searchIn.focus({ preventScroll:true }); S.els.searchIn.select(); }
	function closeSearch(){ S.els.search.classList.remove('open'); S.search = { q:'', hits:[], i:0 }; for(const id in S.nodeEls) S.nodeEls[id].classList.remove('found', 'dim'); }
	function runSearch(q, keep){
		q = (q || '').trim().toLowerCase();
		S.search.q = q;
		const hits = [];
		for(const n of nodesArr()){
			const R = ME.Runes[n.type];
			const txt = ((R ? R.name + ' ' + R.category + ' ' + R.summary(n.params, n, kidsOf(n.id).length) : 'empty') + ' ' + linkLabel(n.link)).toLowerCase();
			if(q && txt.indexOf(q) >= 0) hits.push(n.id);
		}
		S.search.hits = hits; if(!keep) S.search.i = 0;
		for(const id in S.nodeEls){ S.nodeEls[id].classList.toggle('found', hits.indexOf(id) >= 0); S.nodeEls[id].classList.toggle('dim', !!q && hits.indexOf(id) < 0); }
		S.els.searchCnt.textContent = q ? (hits.length ? (S.search.i + 1) + '/' + hits.length : '0') : '';
	}
	function cycleSearch(){
		const s = S.search; if(!s.hits.length) return;
		const id = s.hits[s.i % s.hits.length];
		// reveal collapsed parents
		for(const a of ancestors(id)){ const p = S.def.nodes[S.def.nodes[a].parent]; if(p && p.ui && p.ui.collapsed) p.ui.collapsed = false; }
		select({ type:'node', id }, true); refresh(); centerOn(id);
		s.i = (s.i + 1) % s.hits.length;
		S.els.searchCnt.textContent = (s.i || s.hits.length) + '/' + s.hits.length;
	}

	/* ------------------------------------------------------------------ keyboard */
	function onKey(e){
		if(!S) return;
		// the shape editor is a window of its own on top of the forge: its keys (Delete, Esc, Enter, Ctrl+Z, letters)
		// must never reach the forge, or they delete / undo / swap runes behind it
		if(window.ShapeEditor && window.ShapeEditor._state && window.ShapeEditor._state()) return;
		if(window.DomainDesigner && window.DomainDesigner.isOpen && window.DomainDesigner.isOpen()) return;      // the Domain Designer handles its own keys
		if(window.DomainDesigner && window.DomainDesigner.closedAt && performance.now() - window.DomainDesigner.closedAt < 400 && (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape')){ e.preventDefault(); return; }
		// …nor the Enter / Space that closed it (or follows straight after): that would open the rune picker
		if(window.ShapeEditor && window.ShapeEditor.closedAt && performance.now() - window.ShapeEditor.closedAt < 600 && (e.key === 'Enter' || e.key === ' ')){ e.preventDefault(); return; }
		const tag = (e.target && e.target.tagName) || '';
		const typing = tag === 'INPUT' && e.target.type !== 'range' || tag === 'TEXTAREA' || tag === 'SELECT';
		const ctrl = e.ctrlKey || e.metaKey;
		if(e.key === 'Enter' && e.target && e.target.classList && e.target.classList.contains('mf-num')) return;
		if(ctrl && e.key.toLowerCase() === 's'){ e.preventDefault(); e.stopPropagation(); save(false); return; }
		if(e.key === 'Escape' && e.target && e.target.classList && e.target.classList.contains('mf-num')){
			e.preventDefault(); e.stopPropagation();
			if(e.target._revert) e.target._revert(); else e.target.blur();
			return;
		}
		if(e.key === 'Escape'){
			e.preventDefault(); e.stopPropagation();
			if(S.modal && S.modal.isConnected){ S.modal.remove(); S.modal = null; return; }
			if(S.picker){ closePicker(false); return; }
			if(S.ctx){ closeMenus(); return; }
			if(S.els.search.classList.contains('open')){ closeSearch(); return; }
			if(S.sel){ select(null); return; }
			close(); return;
		}
		if(typing) return;
		if(S.modal && S.modal.isConnected) return;
		e.stopPropagation();
		const k = e.key.toLowerCase();
		if(ctrl && k === 'z'){ e.preventDefault(); if(e.shiftKey) redo(); else undo(); return; }
		if(ctrl && k === 'y'){ e.preventDefault(); redo(); return; }
		if(ctrl && k === 'f'){ e.preventDefault(); openSearch(); return; }
		if(ctrl) return;
		if((k === 'delete' || k === 'backspace') && S.sel && S.sel.type === 'node'){ e.preventDefault(); if(e.shiftKey) deleteRuneOnly(S.sel.id); else deleteNode(S.sel.id); return; }
		if(k === 'f'){ fit(); return; }
		if(k === 'c'){ if(S.sel) centerOn(S.sel.id); return; }
		if(k === 'd'){ S.els.root.querySelector('[data-a=debug]').click(); return; }
		if(k === 'r'){ recastPreview(true); return; }
		if(k === 't'){ if(S.preview){ S.preview.triggers = (S.preview.triggers || 0) + 1; toast('Trigger (T)'); } return; }
		if(k === 'p'){ S.els.root.querySelector('[data-a=pause]').click(); return; }
		if(k === 'i'){ S.els.root.classList.toggle('insp-hidden'); return; }
		if(k === '+' || k === '='){ zoomBy(1.2); return; }
		if(k === '-'){ zoomBy(1 / 1.2); return; }
		if(k === 'enter' && S.sel && S.sel.type === 'node'){ e.preventDefault(); openPicker(S.sel.id, 'change'); return; }
		const dirMap = { arrowup:'n', arrowdown:'s', arrowleft:'w', arrowright:'e', pageup:'ne', pagedown:'se', end:'sw', home:'nw' };
		if(dirMap[k]){
			e.preventDefault();
			if(!S.sel){ select({ type:'node', id:S.def.rootId }); ensureVisible(S.def.rootId); return; }
			const cur = S.def.nodes[S.sel.id]; if(!cur) return;
			const v = ME.DIRS[dirMap[k]];
			const nb = S.occupied[key(cur.gx + v.x, cur.gy + v.y)];
			if(nb && !isHidden(nb)){ select({ type:'node', id:nb }); ensureVisible(nb); }
			else if(e.shiftKey && S.sel.type === 'node') addChild(cur.id, dirMap[k]);
		}
	}

	/* ------------------------------------------------------------------ toast */
	function toast(msg, kind){
		const t = S.els.toast;
		t.className = 'mf-toast show' + (kind ? ' ' + kind : '');
		t.textContent = msg;
		clearTimeout(S.toastT);
		S.toastT = setTimeout(() => { if(S) t.className = 'mf-toast'; }, 2200);
	}

	/* ==================================================================
	   LIVE PREVIEW — the real engine running in a tiny sandbox
	   ================================================================== */
	function startPreview(){
		const c = S.els.prevCanvas;
		const P = {
			world: ME.createWorld(), ctx: c.getContext('2d'), W: 800, H: 400, floor: 340,
			caster: { x: 110, y: 296, w: 22, h: 44, vx: 0, vy: 0, hp: 100, maxHp: 100 },
			dummies: [ mkDummy(520, 280), mkDummy(690, 200) ],
			allies: [ Object.assign(mkDummy(240, 296), { ally:true, w:22, h:44, hp:60, maxHp:100 }) ],
			nums: [], shots: [], shotT: 0, shotsOn: false, mouse: null, castAt: 0, inst: null, paused: false, dirtyAt: performance.now(), lastSig: '', lastT: performance.now()
		};
		P.dummies[1].float = true;
		S.preview = P;
		c.addEventListener('pointermove', e => { const r = c.getBoundingClientRect(); P.mouse = { x: (e.clientX - r.left) / r.width * P.W, y: (e.clientY - r.top) / r.height * P.H }; });
		c.addEventListener('pointerleave', () => { P.mouse = null; });
		c.addEventListener('pointerdown', e => { e.stopPropagation(); recastPreview(true); });
		P.host = {
			mouseWorld: () => P.mouse ? { x: P.mouse.x, y: P.mouse.y } : center(P.dummies[0]),
			getEnemies: () => P.dummies, getAllies: () => P.allies,
			hitRect: e => ({ x: e.x, y: e.y, w: e.w, h: e.h }),
			isSolid: (x, y) => y >= P.floor || x <= 2 || x >= P.W - 2,
			inBounds: (x, y) => x > -200 && x < P.W + 200 && y > -300 && y < P.H + 100,
			damageEnemy: (e, dmg, info) => { e.hp = Math.max(0, e.hp - dmg); e.flash = 1; e.vx += (info && info.vx ? Math.sign(info.vx) : 0) * 1.5; P.nums.push({ x: info ? info.x : e.x, y: (info ? info.y : e.y) - 6, text: Math.round(dmg), age: 0, color: '#ffe9a8' }); },
			heal: (e, amt) => { e.hp = Math.min(e.maxHp || 100, (e.hp || 0) + amt); P.nums.push({ x: e.x + (e.w || 0) / 2, y: e.y - 8, text: '+' + Math.round(amt), age: 0, color: '#7dffb5' }); },
			applyImpulse: (e, ix, iy) => { e.vx = (e.vx || 0) + ix; e.vy = (e.vy || 0) + iy; },
			getForeignProjectiles: () => P.shots, foreignAlive: s => !!s && s.alive,
			shake: () => {},
			getWeapon: () => ({ id: 'sword', name: 'Sword' }),
			weaponSegment: () => { const c = P.caster; return { x0: c.x + c.w - 2, y0: c.y + 22, x1: c.x + c.w + 30, y1: c.y - 6 }; },
			nudge: (e, dx, dy) => { e.x += dx; e.y += dy; },
			triggerCount: () => P.triggers || 0,
			casterHealth: () => P.caster.hp / P.caster.maxHp,
			knockback: (e, vx, vy) => { e.vx = (e.vx || 0) + vx * 0.6; e.vy = (e.vy || 0) + vy * 0.6; }
		};
		P.world.debug = S.debug; P.world.debugScale = 1.6;
	}
	function mkDummy(x, y){ return { x, y, w: 36, h: 60, hx: x, hy: y, hp: 200, maxHp: 200, vx: 0, vy: 0, flash: 0, dead: false }; }
	function center(e){ return { x: e.x + e.w / 2, y: e.y + e.h / 2 }; }

	function recastPreview(force){
		const P = S.preview; if(!P) return;
		const rep = S.report;
		if(!rep.ok){ return; }
		if(force) P.world.clear();
		P.caster.x = 110; P.caster.y = P.floor - P.caster.h; P.caster.vx = P.caster.vy = 0;
		const res = P.world.cast(S.def, { profile: S.profile, owner: { id:'preview', entity: P.caster, facing: () => 1, alive: () => true }, host: P.host });
		if(res.ok){ P.inst = res.instance; P.castAt = performance.now(); }
	}

	function previewFrame(now){
		const P = S.preview, ctx = P.ctx, rep = S.report;
		const msg = S.els.prevMsg;
		if(!rep.ok){
			msg.style.display = 'grid';
			const e = rep.errors[0];
			const html = '<div>⚠ Fix ' + rep.errors.length + ' problem' + (rep.errors.length > 1 ? 's' : '') + ' to preview<br><small style="color:#ffb3c2">' + esc(e ? e.text : '') + '</small></div>';
			if(msg._h !== html){ msg.innerHTML = html; msg._h = html; }
		} else if(msg.style.display !== 'none') msg.style.display = 'none';
		// recast when the definition changes (debounced) or the last cast has finished
		const sig = JSON.stringify(S.def.nodes);
		if(rep.ok && !P.paused){
			if(sig !== P.lastSig && now - P.dirtyAt > 320){ P.lastSig = sig; recastPreview(true); }
			else {
				const alive = P.inst && P.world.instances.indexOf(P.inst) >= 0;
				if((!alive && now - P.castAt > 1500) || now - P.castAt > 9000) recastPreview(false);
			}
		}
		if(!P.paused){
			const steps = Math.min(4, Math.max(1, Math.round((now - P.lastT) / 16.67)));
			for(let i = 0; i < steps; i++){ stepSandbox(P); P.world.update(1 / 60, P.host); }
		}
		P.lastT = now;
		drawSandbox(P, now);
		markExecution(P, now);
		if(S.debug) writeDebug(P);
	}

	function stepSandbox(P){
		const c = P.caster;
		c.vy += 0.6; c.x += c.vx; c.y += c.vy; c.vx *= 0.9;
		if(c.y + c.h > P.floor){ c.y = P.floor - c.h; c.vy = 0; }
		c.x = clamp(c.x, 4, P.W - c.w - 4); if(c.y < 0){ c.y = 0; c.vy = 0; }
		for(const d of P.dummies.concat(P.allies)){
			d.x += d.vx; d.y += d.vy; d.vx *= 0.88; d.vy *= 0.88;
			d.x += (d.hx - d.x) * 0.03; d.y += (d.hy - d.y) * 0.03;
			d.flash = Math.max(0, (d.flash || 0) - 0.08);
			if(d.hp < d.maxHp) d.hp = Math.min(d.maxHp, d.hp + (d.ally ? 0.02 : 0.25));
		}
		if(P.shotsOn){
			if(--P.shotT <= 0){ P.shotT = 100; const d = P.dummies[1]; P.shots.push({ x: d.x, y: d.y + 25, vx: -3, vy: 0.4, dmg: 12, alive: true, age: 0 }); }
		}
		for(const s of P.shots){ s.x += s.vx; s.y += s.vy; s.age++; if(s.x < -20 || s.x > P.W + 20 || s.y < -20 || s.y > P.floor || s.age > 600) s.alive = false; const cc = center(P.caster); if(Math.hypot(s.x - cc.x, s.y - cc.y) < 18){ s.alive = false; P.nums.push({ x: cc.x, y: cc.y - 30, text: 'hit!', age: 0, color: '#ff8899' }); } }
		P.shots = P.shots.filter(s => s.alive);
		for(const n of P.nums){ n.age++; n.y -= 0.6; }
		P.nums = P.nums.filter(n => n.age < 50);
	}

	function drawSandbox(P, now){
		const ctx = P.ctx, W = P.W, H = P.H, t = now / 1000;
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0b1024'); g.addColorStop(1, '#05070e');
		ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
		// ambient motes (environment energy)
		ctx.fillStyle = 'rgba(143,255,224,0.25)';
		for(let i = 0; i < 26; i++){ const x = (i * 131 + t * 8 * (1 + i % 3)) % W, y = (i * 71 + Math.sin(t + i) * 12) % (P.floor - 20); ctx.fillRect(x, y, 2, 2); }
		// floor
		ctx.fillStyle = '#121833'; ctx.fillRect(0, P.floor, W, H - P.floor);
		ctx.strokeStyle = 'rgba(159,230,255,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, P.floor); ctx.lineTo(W, P.floor); ctx.stroke();
		ctx.strokeStyle = 'rgba(159,230,255,0.08)'; ctx.lineWidth = 1;
		for(let x = (t * 10) % 40; x < W; x += 40){ ctx.beginPath(); ctx.moveTo(x, P.floor + 6); ctx.lineTo(x - 18, H); ctx.stroke(); }
		// dummies
		for(const d of P.dummies.concat(P.allies)) drawDummy(ctx, d, t);
		// caster
		drawMage(ctx, P.caster, t);
		// enemy shots
		for(const s of P.shots){ ctx.fillStyle = s._magicRedirected ? '#ffd27a' : '#ff5470'; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(s.x, s.y, 6, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; }
		// the magic
		P.world.draw(ctx, 0, 0, W, H);
		// numbers
		ctx.font = 'bold 20px system-ui, sans-serif'; ctx.textAlign = 'center';
		for(const n of P.nums){ ctx.globalAlpha = 1 - n.age / 50; ctx.fillStyle = n.color; ctx.fillText(n.text, n.x, n.y); }
		ctx.globalAlpha = 1; ctx.textAlign = 'left';
		// aim marker
		const m = P.host.mouseWorld();
		ctx.strokeStyle = P.mouse ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.5;
		ctx.beginPath(); ctx.arc(m.x, m.y, 9, 0, Math.PI * 2); ctx.moveTo(m.x - 14, m.y); ctx.lineTo(m.x - 5, m.y); ctx.moveTo(m.x + 5, m.y); ctx.lineTo(m.x + 14, m.y); ctx.moveTo(m.x, m.y - 14); ctx.lineTo(m.x, m.y - 5); ctx.moveTo(m.x, m.y + 5); ctx.lineTo(m.x, m.y + 14); ctx.stroke();
		ctx.fillStyle = 'rgba(200,215,255,0.55)'; ctx.font = '17px system-ui, sans-serif';
		ctx.fillText(P.mouse ? 'cursor = aim · click to recast' : 'hover to aim · click to recast', 12, 24);
		const st = P.world.stats();
		ctx.textAlign = 'right'; ctx.fillText(st.instances + ' spell' + (st.instances === 1 ? '' : 's') + ' · ' + st.bodies + ' energy', W - 12, 24); ctx.textAlign = 'left';
	}
	function drawDummy(ctx, d, t){
		const cx = d.x + d.w / 2;
		ctx.save();
		if(d.ally){
			ctx.fillStyle = '#1e3b33'; ctx.strokeStyle = '#7dffb5';
		} else { ctx.fillStyle = d.flash > 0 ? '#ffffff' : '#3a2a22'; ctx.strokeStyle = '#c99b6b'; }
		ctx.lineWidth = 2;
		if(d.ally){ ctx.beginPath(); ctx.moveTo(cx, d.y); ctx.lineTo(d.x + d.w, d.y + d.h); ctx.lineTo(d.x, d.y + d.h); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, d.y - 6, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
		else {
			if(!d.float){ ctx.fillStyle = '#2b1f19'; ctx.fillRect(cx - 3, d.y + d.h, 6, 400); ctx.fillStyle = d.flash > 0 ? '#ffffff' : '#3a2a22'; }
			ctx.beginPath(); ctx.roundRect ? ctx.roundRect(d.x, d.y, d.w, d.h, 8) : ctx.rect(d.x, d.y, d.w, d.h); ctx.fill(); ctx.stroke();
			ctx.strokeStyle = 'rgba(255,90,90,0.8)'; ctx.beginPath(); ctx.arc(cx, d.y + d.h / 2, 10, 0, Math.PI * 2); ctx.stroke();
			ctx.beginPath(); ctx.arc(cx, d.y + d.h / 2, 3, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,90,90,0.9)'; ctx.fill();
			if(d.float){ ctx.strokeStyle = 'rgba(201,155,255,0.5)'; ctx.beginPath(); ctx.ellipse(cx, d.y + d.h + 10 + Math.sin(t * 3) * 2, 20, 4, 0, 0, Math.PI * 2); ctx.stroke(); }
		}
		const pct = d.hp / d.maxHp;
		ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(d.x - 4, d.y - 20, d.w + 8, 5);
		ctx.fillStyle = d.ally ? '#7dffb5' : (pct > 0.5 ? '#ffcf6b' : '#ff6b6b'); ctx.fillRect(d.x - 4, d.y - 20, (d.w + 8) * pct, 5);
		ctx.restore();
	}
	function drawMage(ctx, c, t){
		const cx = c.x + c.w / 2, by = c.y + c.h;
		ctx.save();
		ctx.fillStyle = '#28326a'; ctx.strokeStyle = '#9fe6ff'; ctx.lineWidth = 1.5;
		ctx.beginPath(); ctx.moveTo(cx, c.y + 10); ctx.lineTo(cx + 13, by); ctx.lineTo(cx - 13, by); ctx.closePath(); ctx.fill(); ctx.stroke();
		ctx.fillStyle = '#e8d6c0'; ctx.beginPath(); ctx.arc(cx, c.y + 8, 7, 0, Math.PI * 2); ctx.fill();
		ctx.fillStyle = '#28326a'; ctx.beginPath(); ctx.moveTo(cx - 10, c.y + 4); ctx.lineTo(cx + 2, c.y - 16); ctx.lineTo(cx + 10, c.y + 4); ctx.closePath(); ctx.fill(); ctx.stroke();
		ctx.strokeStyle = '#c9a36b'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(cx + 11, c.y + 4); ctx.lineTo(cx + 15, by); ctx.stroke();
		ctx.fillStyle = '#9fe6ff'; ctx.shadowColor = '#9fe6ff'; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(cx + 11, c.y + 2, 3 + Math.sin(t * 5), 0, Math.PI * 2); ctx.fill();
		ctx.restore();
	}

	function markExecution(P, now){
		const inst = P.inst && P.world.instances.indexOf(P.inst) >= 0 ? P.inst : null;
		const frame = P.world.frame;
		const waiting = {};
		const holding = {};
		if(inst) for(const br of inst.branches){ if(br.state === 'delay' || br.state === 'cond') waiting[br.nodeId] = br; if(br.state === 'hold') holding[br.nodeId] = true; }
		for(const id in S.nodeEls){
			const el = S.nodeEls[id];
			const ex = inst && inst.exec[id];
			const recent = !!(ex && frame - ex.frame < 14) || !!holding[id];
			if(recent && !el.classList.contains('exec')){ el.classList.add('exec'); }
			else if(!recent && el.classList.contains('exec')) el.classList.remove('exec');
			el.classList.toggle('current', S.debug && !!(ex && frame - ex.frame < 30));
		}
		for(const id in S.linkEls){
			const L = S.linkEls[id], br = waiting[id], n = S.def.nodes[id];
			if(br){
				L.badge.classList.add('waiting');
				const sp = L.badge.querySelector('span');
				if(br.state === 'delay') sp.textContent = br.wait.toFixed(1) + 's';
				else sp.textContent = 'checking ' + br.condAge.toFixed(1) + 's';
			} else if(L.badge.classList.contains('waiting')){
				L.badge.classList.remove('waiting');
				L.badge.querySelector('span').textContent = linkLabel(n.link);
				flashBadge(id);
			}
		}
	}

	function writeDebug(P){
		const inst = P.inst && P.world.instances.indexOf(P.inst) >= 0 ? P.inst : null;
		if(!inst){ S.els.dbg.textContent = 'No spell instance running.\nInstances in sandbox: ' + P.world.instances.length; return; }
		const lines = [];
		lines.push('Spell Instance #' + inst.id + '  "' + inst.def.name + '"   lifetime left ' + (inst.lifetime - inst.age).toFixed(1) + 's');
		lines.push('Output used ' + Math.round(inst.outputUsed) + ' / Max Output ' + inst.maxOutput + '    budget left ' + Math.round(inst.budget) + ' / paid ' + Math.round(inst.paid) + '    efficiency loss ' + (inst.effLoss || 0).toFixed(1) + ' E');
		for(const st of P.world.reinf){ if(st.inst !== inst.id) continue; lines.push('Reinforcement → ' + st.kind + '  strength ' + Math.round(st.strength * 100) + '%  energy ' + st.energy.toFixed(1) + '  ' + Object.keys(st.props).filter(k => st.props[k] > 0.005).map(k => k + ' +' + Math.round(st.props[k] * 100) + '%').join(' ')); }
		for(const br of inst.branches){
			if(br.state === 'done') continue;
			const n = inst.def.nodes[br.nodeId]; const R = n && ME.Runes[n.type];
			const b = br.ctx.body;
			let st = br.state;
			if(br.state === 'delay') st = 'DELAY ' + br.wait.toFixed(2) + 's';
			if(br.state === 'cond') st = 'CONDITION "' + ((ME.Conditions[n.link.cond.type] || {}).name || '?') + '" ' + br.condAge.toFixed(1) + '/' + n.link.cond.timeout + 's';
			lines.push('Branch b' + br.id + '  rune: ' + (R ? R.name : '?') + '  [' + st + ']');
			const sp = b && !b.foreign ? Math.hypot(b.vx, b.vy) : 0;
			lines.push('   energy ' + (b && !b.foreign ? b.amount.toFixed(1) : (b ? 'foreign' : '—')) + '  power ' + (b ? ME.bodyPower(b).toFixed(1) : '—') + '  target ' + (br.ctx.target ? br.ctx.target.kind : '—')
				+ '  direction ' + (sp > 0.3 ? Math.round(Math.atan2(b.vy, b.vx) * 180 / Math.PI) + '° @' + sp.toFixed(1) : 'still'));
			if(b && !b.foreign && b.tech) lines.push('   techniques ' + (ME.techList(b) || '—') + (b.focus ? '  focus ' + b.focus.kind : ''));
		}
		const done = inst.branches.filter(b => b.state === 'done' && b.note && b.note !== 'complete' && b.note !== 'branched');
		for(const b of done.slice(-3)) lines.push('Branch b' + b.id + ' ended: ' + b.note);
		for(const l of inst.log.slice(-3)) lines.push('· ' + l.text);
		S.els.dbg.textContent = lines.join('\n');
	}

	root.MagicForge = { open, close: () => close(), isOpen: () => !!S, _state: () => S,
		/* bring a rune (by node id) into view — used by the tutorial coach when what it points at is off screen */
		reveal: (id) => { if(S && S.def.nodes[id]) centerOn(id); } };
})(window);
