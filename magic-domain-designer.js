/*
 * DOMAIN DESIGNER — a window for designing what a domain looks like (c70). Loaded after magic-domain-art.js (and the Forge).
 *
 *   DomainDesigner.open({ look, title, form, onSave(look, title), onCancel })
 *
 * Left: presets, random ideas, and eight tabs of layers (colours, world, floor, air, edge, light, opening, outside).
 *       Every field can be locked (🔒 keeps it when you roll the dice) or rolled on its own (🎲).
 * Right: a live preview in a private magic world — the real painter and the real opening (gather → freeze → burst),
 *        seen from inside or from outside. Undo / redo, and a short code to share a look.
 */
(function(root){
	'use strict';
	const ME = root.MagicEngine, LK = root.MagicDomainLook, ART = root.MagicDomainArt;
	if(!ME || !LK || !ART || typeof document === 'undefined') return;
	const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
	const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
	const el = (tag, cls, html) => { const e = document.createElement(tag); if(cls) e.className = cls; if(html != null) e.innerHTML = html; return e; };
	let S = null;

	/* ------------------------------------------------------------ styles */
	const CSS = `
.dd-root{ position:fixed; inset:0; z-index:9600; display:flex; flex-direction:column; background:#06070f; color:#dfe7ff;
	font:13px/1.35 "Segoe UI", system-ui, -apple-system, Roboto, sans-serif; opacity:0; transition:opacity .2s ease; user-select:none; }
.dd-root.open{ opacity:1; }
.dd-root *{ box-sizing:border-box; }
.dd-root button{ font:inherit; color:inherit; cursor:pointer; }
.dd-top{ display:flex; align-items:center; gap:8px; padding:10px 14px; border-bottom:1px solid rgba(140,170,255,.18); background:rgba(14,18,34,.9); flex-wrap:wrap; }
.dd-brand{ font-weight:700; letter-spacing:.18em; font-size:12px; color:#b9a4ff; text-transform:uppercase; margin-right:6px; }
.dd-title{ width:260px; max-width:40vw; background:rgba(255,255,255,.06); border:1px solid rgba(140,170,255,.25); border-radius:8px; color:inherit; padding:7px 10px; font:600 14px Georgia, serif; }
.dd-title:focus{ outline:none; border-color:#9fe6ff; }
.dd-base{ color:#8b97bd; font-size:12px; }
.dd-sp{ flex:1; }
.dd-btn{ background:rgba(255,255,255,.05); border:1px solid rgba(140,170,255,.22); border-radius:8px; padding:7px 11px; transition:background .12s, border-color .12s, transform .08s; white-space:nowrap; }
.dd-btn:hover{ background:rgba(159,230,255,.1); border-color:rgba(140,170,255,.45); }
.dd-btn:active{ transform:scale(.96); }
.dd-btn:disabled{ opacity:.35; pointer-events:none; }
.dd-btn.pri{ background:linear-gradient(135deg,#7fd8ff,#a58bff); color:#0b0f1e; border:none; font-weight:700; }
.dd-btn.dice{ font-size:15px; padding:5px 10px; }
.dd-body{ flex:1; display:flex; min-height:0; }
.dd-side{ width:400px; max-width:46vw; display:flex; flex-direction:column; border-right:1px solid rgba(140,170,255,.18); background:rgba(10,13,26,.92); min-height:0; }
.dd-tabs{ display:flex; flex-wrap:wrap; gap:4px; padding:10px; border-bottom:1px solid rgba(140,170,255,.14); }
.dd-tab{ background:transparent; border:1px solid transparent; border-radius:7px; padding:5px 8px; color:#8b97bd; font-size:12px; }
.dd-tab:hover{ color:#dfe7ff; background:rgba(255,255,255,.04); }
.dd-tab.on{ color:#0b0f1e; background:#9fe6ff; font-weight:700; }
.dd-panel{ flex:1; overflow:auto; padding:12px 12px 30px; }
.dd-panel::-webkit-scrollbar{ width:8px; } .dd-panel::-webkit-scrollbar-thumb{ background:rgba(140,170,255,.25); border-radius:4px; }
.dd-h{ font-size:10px; letter-spacing:.16em; text-transform:uppercase; color:#8b97bd; margin:14px 0 8px; display:flex; align-items:center; gap:8px; }
.dd-h:first-child{ margin-top:2px; }
.dd-h::after{ content:''; flex:1; height:1px; background:rgba(140,170,255,.16); }
.dd-note{ color:#8b97bd; font-size:12px; margin:4px 0 10px; }
.dd-field{ margin:0 0 14px; }
.dd-flabel{ display:flex; align-items:center; gap:6px; margin-bottom:6px; font-weight:600; }
.dd-flabel .dd-val{ margin-left:auto; color:#9fe6ff; font:12px Consolas, monospace; }
.dd-mini{ background:transparent; border:1px solid rgba(140,170,255,.18); border-radius:6px; padding:1px 5px; font-size:11px; color:#8b97bd; line-height:16px; }
.dd-mini:hover{ color:#dfe7ff; border-color:rgba(140,170,255,.45); }
.dd-mini.on{ color:#ffd36b; border-color:#ffd36b; }
.dd-chips{ display:flex; flex-wrap:wrap; gap:5px; }
.dd-chip{ background:rgba(255,255,255,.04); border:1px solid rgba(140,170,255,.18); border-radius:999px; padding:4px 10px; font-size:12px; color:#c9d3f2; }
.dd-chip:hover{ border-color:rgba(159,230,255,.6); color:#fff; }
.dd-chip.on{ background:rgba(159,230,255,.18); border-color:#9fe6ff; color:#fff; box-shadow:0 0 0 1px rgba(159,230,255,.25) inset; }
.dd-range{ width:100%; accent-color:#9fe6ff; }
.dd-switch{ position:relative; width:40px; height:22px; border-radius:11px; background:rgba(255,255,255,.12); border:1px solid rgba(140,170,255,.25); }
.dd-switch::after{ content:''; position:absolute; top:2px; left:2px; width:16px; height:16px; border-radius:50%; background:#8b97bd; transition:left .15s, background .15s; }
.dd-switch.on{ background:rgba(159,230,255,.3); } .dd-switch.on::after{ left:20px; background:#9fe6ff; }
.dd-text{ width:100%; background:rgba(255,255,255,.06); border:1px solid rgba(140,170,255,.22); border-radius:8px; color:inherit; padding:7px 9px; font:inherit; }
.dd-colors{ display:grid; grid-template-columns:1fr 1fr; gap:8px; }
.dd-color{ display:flex; align-items:center; gap:8px; background:rgba(255,255,255,.04); border:1px solid rgba(140,170,255,.16); border-radius:9px; padding:6px 8px; }
.dd-color input[type=color]{ width:34px; height:26px; border:none; padding:0; background:none; cursor:pointer; }
.dd-color b{ font-weight:600; font-size:12px; display:block; } .dd-color span{ font:11px Consolas, monospace; color:#8b97bd; }
.dd-pals{ display:grid; grid-template-columns:repeat(2, 1fr); gap:6px; }
.dd-pal{ display:flex; align-items:center; gap:7px; background:rgba(255,255,255,.03); border:1px solid rgba(140,170,255,.14); border-radius:8px; padding:5px 8px; font-size:12px; text-align:left; }
.dd-pal:hover{ border-color:rgba(159,230,255,.55); }
.dd-dots{ display:flex; } .dd-dots i{ width:13px; height:13px; border-radius:50%; margin-right:-4px; border:1px solid rgba(0,0,0,.4); }
.dd-tools{ display:flex; flex-wrap:wrap; gap:6px; }
.dd-grid{ display:grid; grid-template-columns:repeat(2, 1fr); gap:8px; }
.dd-card{ position:relative; border-radius:10px; overflow:hidden; border:1px solid rgba(140,170,255,.16); background:#0b0e1c; padding:0; text-align:left; }
.dd-card:hover{ border-color:#9fe6ff; transform:translateY(-1px); }
.dd-card.on{ border-color:#ffd36b; box-shadow:0 0 0 1px #ffd36b inset; }
.dd-card canvas{ display:block; width:100%; height:auto; }
.dd-card span{ display:block; padding:5px 8px 6px; font-size:12px; font-weight:600; }
.dd-stage{ flex:1; position:relative; display:flex; flex-direction:column; min-width:0; background:#000; }
.dd-canvaswrap{ flex:1; position:relative; min-height:0; display:flex; align-items:center; justify-content:center; }
.dd-canvas{ max-width:100%; max-height:100%; aspect-ratio:16/9; width:100%; height:auto; display:block; }
.dd-stagebar{ display:flex; align-items:center; gap:8px; padding:10px 14px; border-top:1px solid rgba(140,170,255,.18); background:rgba(14,18,34,.9); flex-wrap:wrap; }
.dd-seg{ display:inline-flex; border:1px solid rgba(140,170,255,.22); border-radius:8px; overflow:hidden; }
.dd-seg button{ background:transparent; border:none; padding:6px 10px; color:#8b97bd; }
.dd-seg button.on{ background:rgba(159,230,255,.18); color:#fff; }
.dd-hint{ color:#8b97bd; font-size:12px; }
.dd-pop{ position:absolute; right:14px; top:54px; z-index:5; width:min(460px, 90vw); background:#11152a; border:1px solid rgba(140,170,255,.35); border-radius:12px; padding:12px; box-shadow:0 20px 50px rgba(0,0,0,.6); }
.dd-pop textarea{ width:100%; height:86px; background:rgba(255,255,255,.05); border:1px solid rgba(140,170,255,.25); border-radius:8px; color:inherit; font:12px Consolas, monospace; padding:8px; resize:vertical; user-select:text; }
.dd-pop .dd-row{ display:flex; gap:8px; justify-content:flex-end; margin-top:8px; }
.dd-toast{ position:absolute; left:50%; bottom:70px; transform:translateX(-50%); background:rgba(14,18,34,.95); border:1px solid rgba(159,230,255,.5); border-radius:8px; padding:7px 14px; pointer-events:none; opacity:0; transition:opacity .2s; }
.dd-toast.on{ opacity:1; }
@media (max-width: 760px){ .dd-body{ flex-direction:column-reverse; } .dd-side{ width:auto; max-width:none; height:48vh; border-right:none; border-top:1px solid rgba(140,170,255,.18); } }
`;
	function injectCss(){ if(document.getElementById('dd-css')) return; const s = document.createElement('style'); s.id = 'dd-css'; s.textContent = CSS; document.head.appendChild(s); }

	/* ------------------------------------------------------------ open / close */
	function open(opts){
		if(S) close(false);
		injectCss();
		opts = opts || {};
		const look = LK.sanitize(opts.look || LK.preset('void'));
		S = { opts, look, start: JSON.stringify(look), title: String(opts.title || 'Domain Expansion').slice(0, 28), startTitle: String(opts.title || 'Domain Expansion'),
			undo: [], redo: [], tab: 'presets', locks: new Set(), view: 'inside', ideas: [], ideaSeed: Math.floor(Math.random() * 1e6), raf: 0, sliding: false };
		buildShell();
		makeWorld();
		castDomain('none');
		renderPanel();
		requestAnimationFrame(() => S && S.els.root.classList.add('open'));
		document.addEventListener('keydown', onKey, true);
		S.raf = requestAnimationFrame(tick);
	}
	function close(saved){
		if(!S) return;
		cancelAnimationFrame(S.raf);
		document.removeEventListener('keydown', onKey, true);
		const s = S; S = null;
		s.els.root.remove();
		if(s.W) s.W.clear();
		root.DomainDesigner.closedAt = performance.now();
		if(saved && s.opts.onSave) s.opts.onSave(LK.sanitize(s.look), s.title);
		else if(!saved && s.opts.onCancel) s.opts.onCancel();
	}
	function onKey(e){
		if(!S) return;
		const tag = (e.target && e.target.tagName) || '', typing = (tag === 'INPUT' && e.target.type !== 'range' && e.target.type !== 'color') || tag === 'TEXTAREA';
		const ctrl = e.ctrlKey || e.metaKey;
		if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); if(S.els.pop){ closePop(); return; } close(false); return; }
		if(ctrl && e.key.toLowerCase() === 's'){ e.preventDefault(); e.stopPropagation(); close(true); return; }
		if(!typing && ctrl && e.key.toLowerCase() === 'z'){ e.preventDefault(); e.stopPropagation(); e.shiftKey ? redo() : undo(); return; }
		if(!typing && ctrl && e.key.toLowerCase() === 'y'){ e.preventDefault(); e.stopPropagation(); redo(); return; }
		if(!typing && (e.key === 'r' || e.key === 'R') && !ctrl){ e.preventDefault(); e.stopPropagation(); rollAll(); return; }
		if(!typing && e.key === ' '){ e.preventDefault(); e.stopPropagation(); castDomain('full'); return; }
		e.stopPropagation();      // nothing typed here reaches the Forge behind
	}

	/* ------------------------------------------------------------ the window */
	function buildShell(){
		const r = el('div', 'dd-root');
		r.innerHTML = `
			<div class="dd-top">
				<div class="dd-brand">Domain Designer</div>
				<input class="dd-title" maxlength="28" spellcheck="false" title="The domain's name, shown across the screen as it opens">
				<span class="dd-base"></span>
				<span class="dd-sp"></span>
				<button class="dd-btn" data-a="undo" title="Undo (Ctrl+Z)">↶</button>
				<button class="dd-btn" data-a="redo" title="Redo (Ctrl+Y)">↷</button>
				<button class="dd-btn dice" data-a="roll" title="Roll every unlocked layer (R)">🎲</button>
				<button class="dd-btn" data-a="code" title="Copy or paste a look code">⇄ Code</button>
				<button class="dd-btn" data-a="cancel">Cancel</button>
				<button class="dd-btn pri" data-a="save" title="Ctrl+S">Use this look</button>
			</div>
			<div class="dd-body">
				<div class="dd-side"><div class="dd-tabs"></div><div class="dd-panel"></div></div>
				<div class="dd-stage">
					<div class="dd-canvaswrap"><canvas class="dd-canvas" width="1280" height="720"></canvas></div>
					<div class="dd-stagebar">
						<button class="dd-btn pri" data-a="play" title="Space">▶ Play the opening</button>
						<button class="dd-btn" data-a="quick">Quick</button>
						<button class="dd-btn" data-a="burst">Burst again</button>
						<span class="dd-seg" data-seg="view"><button data-v="inside" class="on">Inside</button><button data-v="outside">Outside</button></span>
						<span class="dd-seg" data-seg="form"><button data-v="closed">Closed</button><button data-v="open">Open</button></span>
						<span class="dd-sp"></span>
						<span class="dd-hint"></span>
					</div>
					<div class="dd-toast"></div>
				</div>
			</div>`;
		document.body.appendChild(r);
		const q = (s) => r.querySelector(s);
		S.els = { root: r, title: q('.dd-title'), base: q('.dd-base'), tabs: q('.dd-tabs'), panel: q('.dd-panel'), canvas: q('.dd-canvas'), hint: q('.dd-hint'), toast: q('.dd-toast'), undo: q('[data-a=undo]'), redo: q('[data-a=redo]'), stage: q('.dd-stage') };
		S.ctx = S.els.canvas.getContext('2d');
		S.form = S.opts.form === 'open' ? 'open' : 'closed';
		S.els.title.value = S.title;
		S.els.title.addEventListener('input', () => { S.title = S.els.title.value.slice(0, 28) || 'Domain Expansion'; applyPreview(); });
		r.addEventListener('click', (e) => {
			const b = e.target.closest('[data-a]'); if(!b || !S) return;
			({ undo, redo, roll: rollAll, code: openCode, cancel: () => close(false), save: () => close(true), play: () => castDomain('full'), quick: () => castDomain('quick'), burst: () => castDomain('burst') }[b.dataset.a] || (() => {}))();
		});
		for(const seg of r.querySelectorAll('[data-seg]')){
			seg.addEventListener('click', (e) => {
				const b = e.target.closest('button'); if(!b || !S) return;
				if(seg.dataset.seg === 'view') S.view = b.dataset.v;
				else { S.form = b.dataset.v; castDomain('none'); }
				syncSegs();
			});
		}
		syncSegs();
		const tabs = [{ id:'presets', label:'Presets', icon:'★' }, { id:'ideas', label:'Ideas', icon:'✺' }].concat(LK.TABS);
		for(const t of tabs){
			const b = el('button', 'dd-tab', t.icon + ' ' + esc(t.label)); b.dataset.t = t.id;
			b.addEventListener('click', () => { S.tab = t.id; renderPanel(); });
			S.els.tabs.appendChild(b);
		}
		S.els.hint.textContent = '≈ ' + fmtBig(LK.COMBINATIONS) + ' combinations, before colours and sliders';
	}
	function syncSegs(){
		for(const seg of S.els.root.querySelectorAll('[data-seg]')){ const v = seg.dataset.seg === 'view' ? S.view : S.form; for(const b of seg.querySelectorAll('button')) b.classList.toggle('on', b.dataset.v === v); }
	}
	function fmtBig(n){ const u = [[1e15, ' quadrillion'], [1e12, ' trillion'], [1e9, ' billion'], [1e6, ' million']]; for(const [v, s] of u) if(n >= v) return (n / v).toFixed(n / v < 10 ? 1 : 0) + s; return String(Math.round(n)); }
	function toast(msg){ const t = S.els.toast; t.textContent = msg; t.classList.add('on'); clearTimeout(S._toast); S._toast = setTimeout(() => t.classList.remove('on'), 1400); }

	/* ------------------------------------------------------------ changing the look */
	function snapshot(){ return JSON.stringify(S.look); }
	function pushUndo(){ S.undo.push(snapshot()); if(S.undo.length > 120) S.undo.shift(); S.redo.length = 0; }
	function undo(){ if(!S.undo.length) return; S.redo.push(snapshot()); S.look = JSON.parse(S.undo.pop()); afterChange(true); }
	function redo(){ if(!S.redo.length) return; S.undo.push(snapshot()); S.look = JSON.parse(S.redo.pop()); afterChange(true); }
	function setField(key, value, live){
		if(!live) pushUndo();
		S.look[key] = value;
		afterChange(!live);
	}
	function setLook(next, keepLocks){
		pushUndo();
		const L = LK.sanitize(next);
		if(keepLocks) for(const k of S.locks) L[k] = S.look[k];
		S.look = L; afterChange(true);
	}
	function afterChange(redraw){
		S.look = LK.sanitize(S.look);
		applyPreview();
		if(redraw) renderPanel(); else syncPanelValues();
		S.els.undo.disabled = !S.undo.length; S.els.redo.disabled = !S.redo.length;
	}
	function rollAll(){
		S.ideaSeed = (S.ideaSeed * 16807 + 11) % 2147483647;
		const locked = {}; for(const k of S.locks) locked[k] = S.look[k];
		setLook(LK.random(S.ideaSeed, locked), true);
		toast(S.locks.size ? '🎲 Rolled — ' + S.locks.size + ' locked layer' + (S.locks.size > 1 ? 's' : '') + ' kept' : '🎲 A new look');
	}
	function rollField(f){
		const L = LK.random(Math.floor(Math.random() * 1e9));
		if(f.type === 'color'){ setField(f.key, L[f.key]); return; }
		if(f.type === 'choice'){ let v = S.look[f.key], n = 0; while(v === S.look[f.key] && n++ < 10) v = f.options[Math.floor(Math.random() * f.options.length)].v; setField(f.key, v); return; }
		if(f.type === 'range'){ setField(f.key, Math.round((f.min + Math.random() * (f.max - f.min)) / f.step) * f.step); return; }
		if(f.type === 'toggle'){ setField(f.key, !S.look[f.key]); return; }
	}

	/* ------------------------------------------------------------ the side panel */
	function renderPanel(){
		const P = S.els.panel, top = P.scrollTop, sameTab = P.dataset.tab === S.tab;
		P.innerHTML = ''; P.dataset.tab = S.tab;
		for(const b of S.els.tabs.children) b.classList.toggle('on', b.dataset.t === S.tab);
		const base = LK.PRESETS[S.look.preset];
		S.els.base.textContent = S.look.preset === 'custom' ? 'custom look' : (base ? 'from ' + base.name : '');
		if(S.tab === 'presets') renderPresets(P);
		else if(S.tab === 'ideas') renderIdeas(P);
		else {
			if(S.tab === 'colours') renderColours(P);
			const fields = LK.FIELDS.filter(f => f.tab === S.tab && f.type !== 'color');
			if(S.tab === 'outside') P.appendChild(el('div', 'dd-note', 'What someone outside a sealed (closed) domain sees. Switch the preview to <b>Outside</b> below. The Domain rune\'s "Seen from outside" setting decides whether it is sealed.'));
			if(S.tab === 'light') P.appendChild(el('div', 'dd-note', '"Replaces the world" is how opaque the domain\'s world is over the real level. Lower it to keep more of the level visible.'));
			if(S.tab === 'opening') P.appendChild(el('div', 'dd-note', 'Press <b>▶ Play the opening</b> (or Space) to see the gather, the frozen world, the title and the burst.'));
			for(const f of fields) P.appendChild(fieldRow(f));
		}
		if(sameTab) P.scrollTop = top;
	}
	function fieldRow(f){
		const wrap = el('div', 'dd-field'); wrap.dataset.key = f.key;
		const lab = el('div', 'dd-flabel', esc(f.label));
		const lock = el('button', 'dd-mini' + (S.locks.has(f.key) ? ' on' : ''), S.locks.has(f.key) ? '🔒' : '🔓'); lock.title = 'Lock: keep this when rolling the dice';
		lock.addEventListener('click', () => { S.locks.has(f.key) ? S.locks.delete(f.key) : S.locks.add(f.key); renderPanel(); });
		const dice = el('button', 'dd-mini', '🎲'); dice.title = 'Roll just this';
		dice.addEventListener('click', () => rollField(f));
		lab.appendChild(lock); lab.appendChild(dice);
		const v = S.look[f.key];
		if(f.type === 'range'){ const val = el('span', 'dd-val', fmt(v, f)); lab.appendChild(val); }
		wrap.appendChild(lab);
		if(f.type === 'choice'){
			const chips = el('div', 'dd-chips');
			for(const o of f.options){
				const b = el('button', 'dd-chip' + (o.v === v ? ' on' : ''), esc(o.label)); b.title = o.hint || o.label; b.dataset.v = o.v;
				b.addEventListener('click', () => setField(f.key, o.v));
				b.addEventListener('mouseenter', () => { if(S.look[f.key] !== o.v){ S.hover = { key: f.key, v: o.v }; applyPreview(); } });
				b.addEventListener('mouseleave', () => { if(S.hover){ S.hover = null; applyPreview(); } });
				chips.appendChild(b);
			}
			wrap.appendChild(chips);
		} else if(f.type === 'range'){
			const r = el('input', 'dd-range'); r.type = 'range'; r.min = f.min; r.max = f.max; r.step = f.step; r.value = v;
			r.addEventListener('pointerdown', () => { pushUndo(); S.sliding = true; });
			r.addEventListener('keydown', () => { if(!S.sliding){ pushUndo(); S.sliding = true; } });
			r.addEventListener('input', () => { S.look[f.key] = Number(r.value); wrap.querySelector('.dd-val').textContent = fmt(Number(r.value), f); afterChange(false); });
			r.addEventListener('change', () => { S.sliding = false; });
			wrap.appendChild(r);
		} else if(f.type === 'toggle'){
			const sw = el('button', 'dd-switch' + (v ? ' on' : '')); sw.addEventListener('click', () => setField(f.key, !S.look[f.key]));
			wrap.appendChild(sw);
		} else if(f.type === 'text'){
			const t = el('input', 'dd-text'); t.type = 'text'; t.maxLength = f.max || 40; t.value = v || ''; t.placeholder = f.key === 'subtitle' ? 'Domain Expansion' : '';
			t.addEventListener('focus', () => pushUndo());
			t.addEventListener('input', () => { S.look[f.key] = t.value; afterChange(false); });
			wrap.appendChild(t);
		}
		return wrap;
	}
	const fmt = (v, f) => (f.step < 1 ? Number(v).toFixed(2).replace(/0$/, '') : String(v)) + (f.key === 'immersion' || f.key === 'rays' || f.key === 'vignette' || f.key === 'pulse' ? '' : '');
	function syncPanelValues(){
		for(const w of S.els.panel.querySelectorAll('.dd-field')){
			const k = w.dataset.key, f = LK.FIELDS.find(q => q.key === k); if(!f) continue;
			if(f.type === 'choice') for(const b of w.querySelectorAll('.dd-chip')) b.classList.toggle('on', b.dataset.v === S.look[k]);
		}
		const base = LK.PRESETS[S.look.preset];
		S.els.base.textContent = S.look.preset === 'custom' ? 'custom look' : (base ? 'from ' + base.name : '');
	}

	function renderColours(P){
		P.appendChild(el('div', 'dd-h', 'Your colours'));
		const grid = el('div', 'dd-colors');
		for(const f of LK.FIELDS.filter(q => q.type === 'color')){
			const c = el('label', 'dd-color');
			const inp = el('input'); inp.type = 'color'; inp.value = S.look[f.key];
			const txt = el('div', null, '<b>' + esc(f.label) + '</b><span>' + esc(S.look[f.key]) + '</span>');
			inp.addEventListener('pointerdown', () => pushUndo());
			inp.addEventListener('focus', () => { if(!S._colorUndo){ pushUndo(); S._colorUndo = true; } });
			inp.addEventListener('input', () => { S.look[f.key] = inp.value; txt.querySelector('span').textContent = inp.value; afterChange(false); });
			inp.addEventListener('change', () => { S._colorUndo = false; });
			c.appendChild(inp); c.appendChild(txt); grid.appendChild(c);
		}
		P.appendChild(grid);
		P.appendChild(el('div', 'dd-h', 'Adjust all four'));
		const tools = el('div', 'dd-tools');
		const tool = (label, fn, title) => { const b = el('button', 'dd-btn', label); if(title) b.title = title; b.addEventListener('click', fn); tools.appendChild(b); };
		const each = (fn) => { const n = Object.assign({}, S.look); for(const k of ['c1', 'c2', 'c3', 'bg']) n[k] = fn(n[k], k); setLook(n, false); };
		tool('Hue −30°', () => each((c) => hueShift(c, -30)));
		tool('Hue +30°', () => each((c) => hueShift(c, 30)));
		tool('Lighter', () => each((c, k) => LK.mixHex(c, '#ffffff', k === 'bg' ? 0.08 : 0.15)));
		tool('Darker', () => each((c) => LK.mixHex(c, '#000000', 0.15)));
		tool('Swap primary ⇄ second', () => { const n = Object.assign({}, S.look); [n.c1, n.c3] = [n.c3, n.c1]; setLook(n, false); });
		tool('Invert light', () => { const n = Object.assign({}, S.look); n.bg = LK.mixHex(n.c2, '#ffffff', 0.4); n.ambient = 'bright'; n.titleColor = 'black'; setLook(n, false); }, 'A pale world instead of a dark one');
		P.appendChild(tools);
		P.appendChild(el('div', 'dd-h', 'Palettes'));
		const pals = el('div', 'dd-pals');
		for(const p of LK.PALETTES){
			const b = el('button', 'dd-pal', '<span class="dd-dots"><i style="background:' + p.c1 + '"></i><i style="background:' + p.c2 + '"></i><i style="background:' + p.c3 + '"></i><i style="background:' + p.bg + '"></i></span>' + esc(p.name));
			b.addEventListener('click', () => setLook(Object.assign({}, S.look, { c1: p.c1, c2: p.c2, c3: p.c3, bg: p.bg }), false));
			pals.appendChild(b);
		}
		P.appendChild(pals);
	}
	function hueShift(hex, deg){
		const n = parseInt(hex.slice(1), 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
		const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
		let h = 0, s = 0;
		if(d){ s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
		return LK.hsl(((h + deg) % 360 + 360) % 360, s, l);
	}

	function thumbCard(label, look, onPick, on){
		const b = el('button', 'dd-card' + (on ? ' on' : ''));
		const cv = el('canvas'); cv.width = 336; cv.height = 210; b.appendChild(cv); b.appendChild(el('span', null, esc(label)));
		b.addEventListener('click', onPick);
		requestAnimationFrame(() => { try { ART.thumbnail(cv.getContext('2d'), look, 336, 210, 2.6, { title: S ? S.title : '' }); } catch(e){} });
		return b;
	}
	function renderPresets(P){
		P.appendChild(el('div', 'dd-note', 'Start from a finished domain, then change any layer. Locked layers (🔒 in the other tabs) are kept when you pick a preset.'));
		const grid = el('div', 'dd-grid');
		for(const k of LK.PRESET_ORDER) grid.appendChild(thumbCard(LK.PRESETS[k].name, LK.preset(k), () => setLook(Object.assign(LK.preset(k), { seed: S.look.seed }), true), S.look.preset === k));
		P.appendChild(grid);
	}
	function renderIdeas(P){
		const top = el('div', 'dd-tools');
		const more = el('button', 'dd-btn pri', '🎲 New ideas'); more.addEventListener('click', () => { S.ideaSeed = (S.ideaSeed * 48271 + 7) % 2147483647; S.ideas = []; renderPanel(); });
		const near = el('button', 'dd-btn', '✺ Variations of this look'); near.title = 'Ideas that keep your colours and world, and change the rest';
		near.addEventListener('click', () => { S.ideaMode = 'near'; S.ideas = []; S.ideaSeed = (S.ideaSeed * 48271 + 3) % 2147483647; renderPanel(); });
		top.appendChild(more); top.appendChild(near); P.appendChild(top);
		P.appendChild(el('div', 'dd-note', S.ideaMode === 'near' ? 'Variations: your colours, sky and landmark stay; the floor, air, edge and opening change.' : 'Random domains that still hold together. Pick one to make it yours, then refine it.'));
		if(!S.ideas.length){
			for(let i = 0; i < 10; i++){
				const seed = S.ideaSeed + i * 7919;
				if(S.ideaMode === 'near'){ const keep = { c1: S.look.c1, c2: S.look.c2, c3: S.look.c3, bg: S.look.bg, sky: S.look.sky, landmark: S.look.landmark }; S.ideas.push(LK.random(seed, keep)); }
				else S.ideas.push(LK.random(seed));
			}
		}
		const grid = el('div', 'dd-grid');
		S.ideas.forEach((L, i) => grid.appendChild(thumbCard('Idea ' + (i + 1) + ' · ' + optLabel('sky', L.sky) + ', ' + optLabel('landmark', L.landmark).toLowerCase(), L, () => setLook(L, true))));
		P.appendChild(grid);
		S.ideaMode = S.ideaMode === 'near' ? 'near' : null;
	}
	const optLabel = (key, v) => { const f = LK.FIELDS.find(q => q.key === key); const o = f && f.options.find(q => q.v === v); return o ? o.label : v; };

	/* ------------------------------------------------------------ the preview: a private world, the real painter and opening */
	const GY = 560;
	function makeWorld(){
		const W = ME.createWorld(); W.hostDrawsDomainBackdrop = true;
		const player = { x: 630, y: GY - 40, w: 20, h: 40, hp: 100, maxHp: 100, vx: 0, vy: 0, onGround: true, facing: 1 };
		const foe = { x: 860, y: GY - 62, w: 34, h: 62, hp: 1e9, maxHp: 1e9, vx: 0, vy: 0, onGround: true, name: 'Training dummy' };
		const host = { mouseWorld: () => ({ x: 900, y: GY - 40 }), getEnemies: () => [foe], isSolid: (x, y) => y >= GY, inBounds: () => true,
			damageEnemy(){}, isAttacking: () => false, heal(){}, vowText(){}, say(){}, shake(){} };
		S.W = W; S.player = player; S.foe = foe; S.host = host;
		S.profile = ME.deriveProfile({ magicControl: 24, magicPower: 90, maxMana: 99999 }); S.profile.techniquePoints = 20; S.profile.allocations = {};
	}
	function spellFor(cine){
		const s = ME.blankSpell('Domain preview'); const z = s.nodes[s.rootId];
		z.type = 'zone'; z.params = Object.assign(ME.paramDefaults('zone'), { radius: 320, spawn: 'caster' });
		const d = ME.makeNode('domain', z.id, 's', 0, 1, 1);
		d.params = Object.assign(ME.paramDefaults('domain'), { form: S.form, duration: 20, sureHit: 'no', vow: 'none', fuel: 'self', selfFuel: 900, cinematic: cine, look: previewLook(), title: S.title, outside: 'sealed' });
		s.nodes[d.id] = d; s.seq = 3;
		return s;
	}
	function previewLook(){ const L = Object.assign({}, S.look); if(S.hover) L[S.hover.key] = S.hover.v; return L; }
	function castDomain(mode){
		const W = S.W; W.clear();
		const cine = mode === 'burst' ? 'quick' : mode;
		const r = W.cast(spellFor(cine === 'burst' ? 'quick' : cine), { profile: S.profile, owner: { id: 'player', entity: S.player }, host: S.host });
		if(!r.ok){ toast(r.error || 'The preview could not open'); return; }
		if(mode === 'burst'){ for(let i = 0; i < 200 && W.domains[0] && W.domains[0].phase !== 'expand'; i++) W.update(1 / 60, S.host); }
		S.castAt = performance.now();
	}
	function applyPreview(){
		const D = S.W && S.W.domains[0]; if(!D) return;
		S.W.setDomainLook(D, previewLook());
		D.p.title = S.title;
	}
	function background(c){
		const g = c.createLinearGradient(0, 0, 0, 720); g.addColorStop(0, '#2c3a52'); g.addColorStop(0.75, '#6d7f96'); g.addColorStop(1, '#8796a8');
		c.fillStyle = g; c.fillRect(0, 0, 1280, 720);
		c.fillStyle = '#3b4658'; c.beginPath(); c.moveTo(0, GY); for(let i = 0; i <= 16; i++) c.lineTo(i * 80, GY - 60 - Math.sin(i * 1.3) * 40 - (i % 3) * 18); c.lineTo(1280, GY); c.fill();
		c.fillStyle = '#2a2d38'; c.fillRect(0, GY, 1280, 720 - GY); c.fillStyle = '#4a4e5c'; c.fillRect(0, GY, 1280, 4);
		c.fillStyle = '#3d4152'; c.fillRect(150, 420, 180, 16); c.fillRect(980, 380, 200, 16);
	}
	function figure(c, e, col, face){
		const x = e.x + e.w / 2, y = e.y + e.h;
		c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(x, y, e.w * 0.6, 4, 0, 0, Math.PI * 2); c.fill();
		c.fillStyle = col; const s = e.h / 40;
		c.beginPath(); c.arc(x, y - 33 * s, 6 * s, 0, Math.PI * 2); c.fill();
		c.fillRect(x - 5 * s, y - 27 * s, 10 * s, 18 * s); c.fillRect(x - 4 * s, y - 9 * s, 3 * s, 9 * s); c.fillRect(x + 1 * s, y - 9 * s, 3 * s, 9 * s);
		c.fillRect(x + face * 5 * s, y - 25 * s, 8 * s * face, 3 * s);
	}
	function tick(){
		if(!S) return;
		S.raf = requestAnimationFrame(tick);
		const W = S.W, c = S.ctx, now = performance.now() / 1000;
		if(!W.isFrozen()){ S.foe.x = 860 + Math.sin(now * 0.7) * 70; S.foe.vx = Math.cos(now * 0.7) * 0.8; }
		W.update(1 / 60, S.host);
		if(!W.domains.some(d => d.alive)) castDomain('none');
		background(c);
		W.drawDomainBackdrop(c, 0, 0, now);
		figure(c, S.player, '#e8ecff', 1); figure(c, S.foe, '#ff5a6e', -1);
		W.draw(c, 0, 0, 1280, 720);
		const view = S.view === 'inside' ? { x: S.player.x + 10, y: S.player.y + 20 } : { x: 40, y: GY - 20 };
		W.drawDomainVeil(c, 0, 0, now, view);
		W.drawDomainCine(c, 1280, 720, 0, 0, now, null);
		if(S.view === 'outside'){ c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(16, 16, 250, 28); c.fillStyle = '#dfe7ff'; c.font = '600 13px "Segoe UI", sans-serif'; c.textAlign = 'left'; c.fillText(S.form === 'open' ? 'Open domains have no seal: seen as inside' : 'Seen from outside the barrier', 26, 35); }
	}

	/* ------------------------------------------------------------ codes */
	function openCode(){
		if(S.els.pop){ closePop(); return; }
		const pop = el('div', 'dd-pop');
		const code = LK.encode(S.look);
		pop.innerHTML = '<div class="dd-h">Share this look</div><div class="dd-note">Copy this code to keep or share the look. Paste a code here to load one.</div>';
		const ta = el('textarea'); ta.value = code; ta.spellcheck = false; pop.appendChild(ta);
		const row = el('div', 'dd-row');
		const copy = el('button', 'dd-btn', 'Copy'); copy.addEventListener('click', () => { ta.select(); try { (navigator.clipboard && navigator.clipboard.writeText(ta.value)) || document.execCommand('copy'); toast('Code copied'); } catch(e){ toast('Select the code and copy it'); } });
		const load = el('button', 'dd-btn pri', 'Load code'); load.addEventListener('click', () => { const L = LK.decode(ta.value); if(!L){ toast('That code is not a domain look'); return; } setLook(L, false); toast('Look loaded'); closePop(); });
		const cancel = el('button', 'dd-btn', 'Close'); cancel.addEventListener('click', closePop);
		row.appendChild(cancel); row.appendChild(copy); row.appendChild(load); pop.appendChild(row);
		S.els.root.appendChild(pop); S.els.pop = pop; ta.focus(); ta.select();
	}
	function closePop(){ if(S && S.els.pop){ S.els.pop.remove(); S.els.pop = null; } }

	root.DomainDesigner = { open, close: () => close(false), isOpen: () => !!S, closedAt: 0, _state: () => S };
})(typeof window !== 'undefined' ? window : globalThis);
