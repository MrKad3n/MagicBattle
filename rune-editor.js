/*
 * Pan-and-zoom rune tree editor. Placement rules live in RuneMagic
 * so the board cannot create a second parent, a cycle, or a free-floating rune.
 */
(function(root){
	'use strict';
	if(!root.RuneMagic) return;
	const RM = root.RuneMagic;
	const GAP_X = 250;
	const GAP_Y = 176;
	const NODE_W = 158;
	const NODE_H = 86;

	const COLORS = {
		origin:'#f0d48a', target:'#8fd0ff', generation:'#b6f5c2', manipulation:'#d7b3ff',
		split:'#ffd0a1', compression:'#ffb3c7', expansion:'#ffe08a', power:'#ff9a6b',
		movement:'#9ee7ff', shape:'#c9b6ff', technique:'#d2c4ff', reversal:'#ff8ad4',
		environment:'#7dffe1', attachment:'#b7d0ff', control:'#f0c27a'
	};

	let shell = null;
	let state = null;
	let raf = 0;
	let toastTimer = 0;

	function el(tag, className, text){
		const node = document.createElement(tag);
		if(className) node.className = className;
		if(text != null) node.textContent = text;
		return node;
	}

	function ensureShell(){
		if(shell) return shell;
		const rootEl = el('div', 'rune-editor');
		rootEl.innerHTML = ''
			+ '<header class="rune-top">'
			+ '<div class="rune-brand"><b>RUNE TREE</b><span id="runeSlotLabel">Slot</span></div>'
			+ '<input class="rune-name" id="runeName" maxlength="28" />'
			+ '<div class="rune-meters" id="runeMeters"></div>'
			+ '<div class="rune-actions">'
			+ '<button type="button" data-act="fit">Fit</button>'
			+ '<button type="button" data-act="undo">Undo</button>'
			+ '<button type="button" data-act="redo">Redo</button>'
			+ '<button type="button" data-act="help">?</button>'
			+ '<button type="button" data-act="test">Test cast</button>'
			+ '<button type="button" data-act="clear" class="danger">Clear</button>'
			+ '<button type="button" data-act="save" class="primary">Save</button>'
			+ '<button type="button" data-act="close">Close</button>'
			+ '</div></header>'
			+ '<div class="rune-main"><div class="rune-board"><canvas id="runeBoard"></canvas></div>'
			+ '<aside class="rune-side" id="runeSide"></aside></div>'
			+ '<footer class="rune-pal"><div class="rune-pal-head"><span>MODIFICATIONS</span><span>Delays and conditions live on the wires</span></div>'
			+ '<div class="rune-chips" id="runeChips"></div></footer>'
			+ '<div class="rune-toast" id="runeToast"></div>';
		document.body.appendChild(rootEl);
		const picker = el('div', 'rune-picker');
		picker.style.display = 'none';
		document.body.appendChild(picker);
		const help = el('div', 'rune-help');
		help.style.display = 'none';
		help.innerHTML = '<b>Building a spell</b><br>Drag the open board to pan. Scroll to zoom. Plus buttons grow the tree in four directions.<br><br>Click a wire to make it immediate, delayed, or a one-time condition. A failed condition ends only that branch.<br><br>Split is the only rune that may branch, and it divides the energy instead of copying it.';
		rootEl.appendChild(help);
		shell = {
			root: rootEl,
			canvas: rootEl.querySelector('#runeBoard'),
			side: rootEl.querySelector('#runeSide'),
			chips: rootEl.querySelector('#runeChips'),
			meters: rootEl.querySelector('#runeMeters'),
			name: rootEl.querySelector('#runeName'),
			slot: rootEl.querySelector('#runeSlotLabel'),
			toast: rootEl.querySelector('#runeToast'),
			picker: picker,
			help: help
		};
		shell.ctx = shell.canvas.getContext('2d');
		shell.root.addEventListener('click', onAction);
		shell.name.addEventListener('input', function(){
			state.spell.name = shell.name.value.slice(0, 28);
			state.dirty = true;
		});
		shell.canvas.addEventListener('pointerdown', onPointerDown);
		shell.canvas.addEventListener('pointermove', onPointerMove);
		shell.canvas.addEventListener('pointerup', onPointerUp);
		shell.canvas.addEventListener('pointercancel', onPointerUp);
		shell.canvas.addEventListener('wheel', onWheel, { passive: false });
		shell.canvas.addEventListener('contextmenu', function(e){ e.preventDefault(); });
		window.addEventListener('keydown', onKey);
		window.addEventListener('resize', resize);
		buildChips();
		return shell;
	}

	function buildChips(){
		shell.chips.innerHTML = '';
		RM.runeList().forEach(function(rune){
			if(rune.rootOnly) return;
			const known = RM.techniques();
			const locked = rune.id === 'technique' && !known.length;
			const chip = el('button', 'rune-chip');
			chip.type = 'button';
			chip.dataset.type = rune.id;
			chip.innerHTML = '<b></b><span></span>';
			chip.querySelector('b').textContent = rune.name;
			chip.querySelector('span').textContent = (locked ? 'Unavailable · ' : '') + categoryLabel(rune.category);
			chip.style.borderColor = colorOf(rune.category);
			chip.addEventListener('click', function(){
				state.armed = state.armed === rune.id ? null : rune.id;
				if(locked) toast('No techniques are known yet. Placing this rune will show an error.');
				paintChips();
			});
			shell.chips.appendChild(chip);
		});
	}

	function paintChips(){
		const chips = shell.chips.querySelectorAll('.rune-chip');
		chips.forEach(function(chip){
			chip.classList.toggle('armed', chip.dataset.type === state.armed);
		});
	}

	function categoryLabel(id){
		const cat = RM.categories.find(function(c){ return c.id === id; });
		return cat ? cat.label : id;
	}

	function colorOf(category){ return COLORS[category] || '#c9d6ee'; }

	function open(opts){
		ensureShell();
		if(RM.ensureLayout) RM.ensureLayout(opts.spell);
		state = {
			spell: opts.spell,
			slot: opts.slot,
			onSave: opts.onSave,
			onClear: opts.onClear,
			replacing: !!opts.replacing,
			cam: { x: 0, y: 0, zoom: 1 },
			selected: opts.spell.rootId,
			selectedConn: null,
			hover: null,
			armed: null,
			undo: [],
			redo: [],
			dirty: false,
			drag: null,
			picker: null,
			sandbox: RM.createSandbox(),
			time: 0,
			last: performance.now(),
			report: RM.validate(opts.spell)
		};
		shell.name.value = state.spell.name || 'Magic Blast';
		shell.slot.textContent = opts.slot === 9 ? 'Ultimate slot' : ('Slot ' + (opts.slot + 1));
		shell.help.style.display = 'none';
		shell.picker.style.display = 'none';
		shell.root.style.display = 'flex';
		document.body.style.overflow = 'hidden';
		resize();
		fit();
		refresh();
		requestAnimationFrame(function(){ if(!state) return; resize(); fit(); });
		if(raf) cancelAnimationFrame(raf);
		raf = requestAnimationFrame(frame);
	}

	function close(force){
		if(!state) return;
		if(!force && state.dirty && !confirm('Close without saving this tree?')) return;
		shell.root.style.display = 'none';
		shell.picker.style.display = 'none';
		document.body.style.overflow = '';
		if(raf) cancelAnimationFrame(raf);
		raf = 0;
		state = null;
	}

	function resize(){
		if(!shell || !state) return;
		const rect = shell.canvas.getBoundingClientRect();
		const dpr = Math.min(2, window.devicePixelRatio || 1);
		shell.canvas.width = Math.max(1, Math.round(rect.width * dpr));
		shell.canvas.height = Math.max(1, Math.round(rect.height * dpr));
		state.dpr = dpr;
	}

	function frame(now){
		if(!state) return;
		const dt = Math.min(0.05, (now - state.last) / 1000);
		state.last = now;
		state.time += dt;
		if(state.sandbox) RM.tickSandbox(state.sandbox, dt);
		draw();
		raf = requestAnimationFrame(frame);
	}

	function centerOf(node){ return { x: node.gx * GAP_X, y: node.gy * GAP_Y }; }

	function w2s(x, y){
		return { x: x * state.cam.zoom + state.cam.x, y: y * state.cam.zoom + state.cam.y };
	}
	function s2w(x, y){
		return { x: (x - state.cam.x) / state.cam.zoom, y: (y - state.cam.y) / state.cam.zoom };
	}

	function pointer(e){
		const rect = shell.canvas.getBoundingClientRect();
		return {
			x: (e.clientX - rect.left) * (shell.canvas.width / rect.width),
			y: (e.clientY - rect.top) * (shell.canvas.height / rect.height)
		};
	}

	function nodeAt(sx, sy){
		const list = state.spell.nodes;
		const limX = NODE_W * state.cam.zoom * 0.5;
		const limY = NODE_H * state.cam.zoom * 0.5;
		for(let i = list.length - 1; i >= 0; i--){
			const c = w2s(centerOf(list[i]).x, centerOf(list[i]).y);
			if(Math.abs(sx - c.x) <= limX && Math.abs(sy - c.y) <= limY) return list[i];
		}
		return null;
	}

	function plusAt(sx, sy){
		const buttons = plusButtons();
		for(let i = 0; i < buttons.length; i++){
			const p = w2s(buttons[i].x, buttons[i].y);
			if(Math.hypot(sx - p.x, sy - p.y) <= 16 * Math.max(1, state.cam.zoom * 0.8)) return buttons[i];
		}
		return null;
	}

	function plusButtons(){
		const out = [];
		const spell = state.spell;
		spell.nodes.forEach(function(node){
			const rune = RM.rune(node.type);
			const limit = rune && rune.maxChildren ? rune.maxChildren : 1;
			const used = (node.childIds || []).length;
			if(used >= limit) return;
			Object.keys(RM.dirs).forEach(function(dir){
				const step = RM.dirs[dir];
				const gx = node.gx + step.x;
				const gy = node.gy + step.y;
				if(spell.nodes.some(function(n){ return n.gx === gx && n.gy === gy; })) return;
				const c = centerOf(node);
				out.push({
					parentId: node.id,
					dir: dir,
					x: c.x + step.x * (GAP_X * 0.46),
					y: c.y + step.y * (GAP_Y * 0.46)
				});
			});
		});
		return out;
	}

	function wireAt(sx, sy){
		const world = s2w(sx, sy);
		let best = null;
		let bestD = Math.max(18, 22) / state.cam.zoom;
		(state.spell.connections || []).forEach(function(conn){
			const parent = state.spell.nodes.find(function(n){ return n.id === conn.parentId; });
			const child = state.spell.nodes.find(function(n){ return n.id === conn.childId; });
			if(!parent || !child) return;
			const a = centerOf(parent), b = centerOf(child);
			for(let t = 0; t <= 1; t += 0.08){
				const p = sampleCurve(a, b, t);
				const d = Math.hypot(p.x - world.x, p.y - world.y);
				if(d < bestD){ bestD = d; best = conn; }
			}
		});
		return best;
	}

	function sampleCurve(a, b, t){
		const dx = b.x - a.x, dy = b.y - a.y;
		const c1 = { x: a.x + dx * 0.35, y: a.y + dy * 0.08 };
		const c2 = { x: a.x + dx * 0.65, y: b.y - dy * 0.08 };
		const u = 1 - t;
		return {
			x: u*u*u*a.x + 3*u*u*t*c1.x + 3*u*t*t*c2.x + t*t*t*b.x,
			y: u*u*u*a.y + 3*u*u*t*c1.y + 3*u*t*t*c2.y + t*t*t*b.y
		};
	}

	function onPointerDown(e){
		if(!state) return;
		shell.canvas.setPointerCapture(e.pointerId);
		const p = pointer(e);
		const plus = e.button === 0 ? plusAt(p.x, p.y) : null;
		const node = nodeAt(p.x, p.y);
		if(e.button === 2 && node && node.id !== state.spell.rootId){
			commit(function(){ return RM.removeSubtree(state.spell, node.id); });
			state.selected = state.spell.rootId;
			state.selectedConn = null;
			refresh();
			return;
		}
		if(plus){
			if(state.armed) place(plus.parentId, plus.dir, state.armed);
			else openPicker(e.clientX, e.clientY, plus);
			return;
		}
		if(node){
			state.selected = node.id;
			state.selectedConn = null;
			state.drag = { kind: 'node', id: node.id, px: p.x, py: p.y, moved: false, gx: node.gx, gy: node.gy };
			refresh();
			return;
		}
		const wire = wireAt(p.x, p.y);
		if(wire){
			state.selectedConn = wire.id;
			state.selected = null;
			refresh();
			return;
		}
		const map = minimapRect();
		if(p.x >= map.x && p.y >= map.y && p.x <= map.x + map.w && p.y <= map.y + map.h){
			focusMinimap(p, map);
			return;
		}
		state.drag = { kind: 'pan', px: p.x, py: p.y };
		shell.canvas.classList.add('grabbing');
	}

	function onPointerMove(e){
		if(!state) return;
		const p = pointer(e);
		state.hover = plusAt(p.x, p.y) || nodeAt(p.x, p.y);
		if(!state.drag) return;
		const dx = p.x - state.drag.px;
		const dy = p.y - state.drag.py;
		if(state.drag.kind === 'pan'){
			state.cam.x += dx;
			state.cam.y += dy;
			state.drag.px = p.x;
			state.drag.py = p.y;
		} else if(Math.hypot(dx, dy) > 5){
			state.drag.moved = true;
			state.drag.pxLive = p.x;
			state.drag.pyLive = p.y;
		}
	}

	function onPointerUp(e){
		if(!state || !state.drag) return;
		if(state.drag.kind === 'node' && state.drag.moved){
			const p = pointer(e);
			const world = s2w(p.x, p.y);
			const origin = centerOf({ gx: state.drag.gx, gy: state.drag.gy });
			const dgx = Math.round((world.x - origin.x) / GAP_X);
			const dgy = Math.round((world.y - origin.y) / GAP_Y);
			if(dgx || dgy){
				const moved = commit(function(){ return RM.moveSubtree(state.spell, state.drag.id, dgx, dgy); });
				if(moved && moved.ok === false) toast(moved.reason);
			}
		}
		state.drag = null;
		shell.canvas.classList.remove('grabbing');
		refresh();
	}

	function onWheel(e){
		if(!state) return;
		e.preventDefault();
		const p = pointer(e);
		const before = s2w(p.x, p.y);
		const next = Math.max(0.28, Math.min(2.3, state.cam.zoom * Math.exp(-e.deltaY * 0.0011)));
		state.cam.zoom = next;
		const after = w2s(before.x, before.y);
		state.cam.x += p.x - after.x;
		state.cam.y += p.y - after.y;
	}

	function openPicker(clientX, clientY, plus){
		state.picker = plus;
		const picker = shell.picker;
		picker.innerHTML = '';
		const groups = {};
		RM.runeList().forEach(function(rune){
			if(rune.rootOnly) return;
			(groups[rune.category] = groups[rune.category] || []).push(rune);
		});
		RM.categories.forEach(function(cat){
			const list = groups[cat.id];
			if(!list) return;
			picker.appendChild(el('h4', '', cat.label.toUpperCase()));
			list.forEach(function(rune){
				const btn = el('button', 'rune-pick');
				btn.type = 'button';
				btn.innerHTML = '<b></b><span></span>';
				btn.querySelector('b').textContent = rune.name;
				btn.querySelector('b').style.color = colorOf(rune.category);
				btn.querySelector('span').textContent = rune.blurb;
				btn.addEventListener('click', function(){
					picker.style.display = 'none';
					place(plus.parentId, plus.dir, rune.id);
				});
				picker.appendChild(btn);
			});
		});
		picker.style.display = 'block';
		const w = 280, h = Math.min(360, picker.scrollHeight || 300);
		picker.style.left = Math.min(window.innerWidth - w - 8, clientX + 8) + 'px';
		picker.style.top = Math.min(window.innerHeight - h - 8, clientY + 8) + 'px';
	}

	function place(parentId, dir, type){
		const result = commit(function(){ return RM.addChild(state.spell, parentId, dir, type); });
		if(result && result.ok && result.node){
			state.selected = result.node.id;
			state.selectedConn = null;
			if(type === 'technique' && !RM.techniques().length) toast('Technique unavailable. No techniques are known yet.');
		} else if(result && result.reason) toast(result.reason);
		shell.picker.style.display = 'none';
		refresh();
	}

	function commit(fn){
		const before = JSON.stringify(state.spell);
		const result = fn();
		const after = JSON.stringify(state.spell);
		if(before !== after){
			state.undo.push(before);
			if(state.undo.length > 60) state.undo.shift();
			state.redo = [];
			state.dirty = true;
		}
		return result;
	}

	function undo(){
		if(!state.undo.length) return;
		state.redo.push(JSON.stringify(state.spell));
		state.spell = JSON.parse(state.undo.pop());
		state.dirty = true;
		state.selected = state.spell.rootId;
		state.selectedConn = null;
		refresh();
	}
	function redo(){
		if(!state.redo.length) return;
		state.undo.push(JSON.stringify(state.spell));
		state.spell = JSON.parse(state.redo.pop());
		state.dirty = true;
		refresh();
	}

	function fit(){
		if(!state) return;
		let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
		state.spell.nodes.forEach(function(n){
			const c = centerOf(n);
			minX = Math.min(minX, c.x - 120);
			minY = Math.min(minY, c.y - 80);
			maxX = Math.max(maxX, c.x + 120);
			maxY = Math.max(maxY, c.y + 80);
		});
		const bw = Math.max(200, maxX - minX);
		const bh = Math.max(140, maxY - minY);
		const viewH = Math.max(160, shell.canvas.height - 170);
		const z = Math.max(0.32, Math.min(1.35, Math.min((shell.canvas.width - 80) / bw, viewH / bh)));
		state.cam.zoom = z;
		state.cam.x = shell.canvas.width / 2 - ((minX + maxX) / 2) * z;
		state.cam.y = viewH / 2 - ((minY + maxY) / 2) * z;
	}

	function refresh(){
		if(!state) return;
		state.report = RM.validate(state.spell);
		renderSide();
		renderMeters();
		paintChips();
	}

	function renderMeters(){
		const r = state.report;
		const p = RM.profile();
		const have = Math.floor(RM.energyNow());
		shell.meters.innerHTML = '';
		addPill(r.runeCount + ' / ' + r.capacity + ' runes', r.runeCount > r.capacity);
		addPill(r.energyCost + ' energy', r.energyCost > p.maxEnergy);
		addPill('output ' + r.outputUsed + ' / ' + p.maxOutput, r.outputUsed > p.maxOutput);
		addPill('reserve ' + have + ' / ' + p.maxEnergy, have < r.energyCost);
		if(!r.ok) addPill(r.errors.length + ' error' + (r.errors.length === 1 ? '' : 's'), true);
	}
	function addPill(text, warn){
		const pill = el('div', 'rune-pill' + (warn ? ' warn' : ''), text);
		shell.meters.appendChild(pill);
	}

	function renderSide(){
		const side = shell.side;
		side.innerHTML = '';
		if(state.replacing){
			side.appendChild(el('div', 'rune-banner', 'Saving replaces the old spell in this slot with this rune tree.'));
		}
		if(state.selectedConn){
			renderConnection(side);
			return;
		}
		const node = state.spell.nodes.find(function(n){ return n.id === state.selected; }) || state.spell.nodes[0];
		if(!node){
			side.appendChild(el('p', 'rune-empty', 'The tree is empty.'));
			return;
		}
		state.selected = node.id;
		const rune = RM.rune(node.type);
		side.appendChild(el('h3', '', rune ? rune.name : 'Rune'));
		side.appendChild(el('p', 'blurb', rune ? rune.blurb : ''));
		const errs = state.report.errors.filter(function(e){ return e.nodeId === node.id; });
		errs.forEach(function(e){ side.appendChild(el('div', 'rune-error', e.text)); });
		if(node.id !== state.spell.rootId){
			const label = el('label', '', 'Modification');
			const select = document.createElement('select');
			RM.runeList().forEach(function(item){
				if(item.rootOnly) return;
				const opt = el('option', '', item.name);
				opt.value = item.id;
				if(item.id === node.type) opt.selected = true;
				select.appendChild(opt);
			});
			select.addEventListener('change', function(){
				const changed = commit(function(){ return RM.setNodeType(state.spell, node.id, select.value); });
				if(changed && changed.ok === false) toast(changed.reason);
				refresh();
			});
			side.appendChild(label);
			side.appendChild(select);
		}
		(rune && rune.fields || []).forEach(function(field){ renderField(side, node, field); });
		if(node.id !== state.spell.rootId){
			const del = el('button', 'danger', 'Remove this branch');
			del.type = 'button';
			del.style.marginTop = '14px';
			del.addEventListener('click', function(){
				commit(function(){ return RM.removeSubtree(state.spell, node.id); });
				state.selected = state.spell.rootId;
				refresh();
			});
			side.appendChild(del);
		}
		const globalErrs = state.report.errors.filter(function(e){ return !e.nodeId; });
		globalErrs.forEach(function(e){
			const row = el('div', 'rune-error', e.text);
			side.appendChild(row);
		});
		if(state.report.warnings.length){
			state.report.warnings.forEach(function(w){
				if(w.nodeId && w.nodeId !== node.id) return;
				side.appendChild(el('p', 'rune-note', w.text));
			});
		}
	}

	function renderField(side, node, field){
		const label = el('label');
		label.textContent = field.label + ' ';
		const val = el('span', 'rune-val');
		label.appendChild(val);
		side.appendChild(label);
		if(field.type === 'select' || field.type === 'technique'){
			const select = document.createElement('select');
			let options = field.options || [];
			if(field.type === 'technique'){
				options = RM.techniques().filter(function(t){ return (RM.profile().allocations || {})[t.id] > 0; })
					.map(function(t){ return { id: t.id, label: t.name }; });
				if(!options.length){
					side.appendChild(el('p', 'rune-note', 'Technique unavailable. You have ' + RM.profile().techniquePoints + ' technique points and no techniques to spend them on.'));
					return;
				}
			}
			options.forEach(function(opt){
				const o = el('option', '', opt.label);
				o.value = opt.id;
				if((node.params || {})[field.key] === opt.id) o.selected = true;
				select.appendChild(o);
			});
			select.addEventListener('change', function(){
				commit(function(){ return RM.setParam(state.spell, node.id, field.key, select.value); });
				refresh();
			});
			side.appendChild(select);
			return;
		}
		let min = field.min, max = field.max;
		if(node.type === 'power' && field.key === 'value' && RM.profile().negativePowerUnlocked && node.params.mode === 'set') min = -40;
		const current = Number(node.params[field.key]);
		val.textContent = String(current);
		const range = document.createElement('input');
		range.type = 'range';
		range.min = String(min);
		range.max = String(max);
		range.step = String(field.step || 1);
		range.value = String(current);
		range.addEventListener('pointerdown', function(){ range._snap = JSON.stringify(state.spell); });
		range.addEventListener('input', function(){
			let next = Number(range.value);
			if(node.type === 'power' && field.key === 'value' && Math.abs(next) < 0.2) next = next < 0 ? -0.2 : 0.2;
			range.value = String(next);
			val.textContent = String(next);
			RM.setParam(state.spell, node.id, field.key, next);
			state.dirty = true;
			state.report = RM.validate(state.spell);
			renderMeters();
		});
		range.addEventListener('change', function(){
			if(range._snap && range._snap !== JSON.stringify(state.spell)){
				state.undo.push(range._snap);
				state.redo = [];
			}
			refresh();
		});
		side.appendChild(range);
	}

	function renderConnection(side){
		const conn = (state.spell.connections || []).find(function(c){ return c.id === state.selectedConn; });
		if(!conn){ state.selectedConn = null; renderSide(); return; }
		side.appendChild(el('h3', '', 'Connection'));
		side.appendChild(el('p', 'blurb', 'A connection is not a rune. It decides when the next modification runs. A condition is checked once, and a miss ends only this branch.'));
		const modes = el('div', 'rune-modes');
		['immediate', 'delay', 'condition'].forEach(function(mode){
			const btn = el('button', mode === conn.executionType ? 'on' : '', mode === 'immediate' ? 'Now' : mode === 'delay' ? 'Delay' : 'If');
			btn.type = 'button';
			btn.addEventListener('click', function(){
				commit(function(){
					return RM.setConnection(state.spell, conn.parentId, conn.childId, {
						executionType: mode,
						delay: mode === 'immediate' ? 0 : (conn.delay || (mode === 'delay' ? 0.6 : 0)),
						condition: mode === 'condition' ? (conn.condition || { type: 'enemyNearby', distance: 160 }) : null
					});
				});
				refresh();
			});
			modes.appendChild(btn);
		});
		side.appendChild(modes);
		if(conn.executionType === 'delay' || conn.executionType === 'condition'){
			const label = el('label', '', conn.executionType === 'delay' ? 'Wait ' : 'Check after ');
			const val = el('span', 'rune-val', (conn.delay || 0) + 's');
			label.appendChild(val);
			side.appendChild(label);
			const range = document.createElement('input');
			range.type = 'range';
			range.min = conn.executionType === 'delay' ? '0.1' : '0';
			range.max = '8';
			range.step = '0.1';
			range.value = String(conn.delay || 0);
			range.addEventListener('input', function(){
				const delay = Number(range.value);
				val.textContent = delay + 's';
				RM.setConnection(state.spell, conn.parentId, conn.childId, { executionType: conn.executionType, delay: delay, condition: conn.condition });
				state.dirty = true;
			});
			side.appendChild(range);
		}
		if(conn.executionType === 'condition'){
			const label = el('label', '', 'Condition');
			const select = document.createElement('select');
			Object.keys(RM.conditions).forEach(function(id){
				const opt = el('option', '', RM.conditions[id].label);
				opt.value = id;
				if(conn.condition && conn.condition.type === id) opt.selected = true;
				select.appendChild(opt);
			});
			select.addEventListener('change', function(){
				const def = RM.conditions[select.value];
				const condition = { type: select.value };
				(def.fields || []).forEach(function(f){ condition[f.key] = f.default; });
				commit(function(){
					return RM.setConnection(state.spell, conn.parentId, conn.childId, { executionType: 'condition', delay: conn.delay || 0, condition: condition });
				});
				refresh();
			});
			side.appendChild(label);
			side.appendChild(select);
			const def = RM.conditions[(conn.condition && conn.condition.type) || 'enemyNearby'];
			if(def) side.appendChild(el('p', 'rune-note', def.blurb));
			(def && def.fields || []).forEach(function(field){
				const lab = el('label', '', field.label + ' ');
				const shown = el('span', 'rune-val', String((conn.condition && conn.condition[field.key]) || field.default));
				lab.appendChild(shown);
				const range = document.createElement('input');
				range.type = 'range';
				range.min = String(field.min);
				range.max = String(field.max);
				range.step = String(field.step);
				range.value = String((conn.condition && conn.condition[field.key]) || field.default);
				range.addEventListener('input', function(){
					const condition = Object.assign({}, conn.condition || { type: def ? select.value : 'enemyNearby' });
					condition[field.key] = Number(range.value);
					shown.textContent = range.value;
					RM.setConnection(state.spell, conn.parentId, conn.childId, { executionType: 'condition', delay: conn.delay || 0, condition: condition });
					conn.condition = condition;
					state.dirty = true;
				});
				side.appendChild(lab);
				side.appendChild(range);
			});
		}
	}

	function draw(){
		const ctx = shell.ctx;
		const w = shell.canvas.width, h = shell.canvas.height;
		ctx.clearRect(0, 0, w, h);
		drawAmbient(ctx, w, h);
		drawGrid(ctx, w, h);
		drawWires(ctx);
		drawNodes(ctx);
		drawPlus(ctx);
		drawMinimap(ctx, w, h);
		drawStage(ctx, w, h);
	}

	function drawAmbient(ctx, w, h){
		ctx.save();
		ctx.globalCompositeOperation = 'lighter';
		for(let i = 0; i < 3; i++){
			ctx.beginPath();
			for(let x = 0; x <= w; x += 18){
				const y = h * (0.18 + i * 0.16) + Math.sin(x * 0.006 + state.time * 0.65 + i) * 26;
				if(x === 0) ctx.moveTo(x, y);
				else ctx.lineTo(x, y);
			}
			ctx.strokeStyle = 'rgba(130, 180, 255, 0.045)';
			ctx.lineWidth = 26;
			ctx.stroke();
			ctx.strokeStyle = 'rgba(255,255,255,0.04)';
			ctx.lineWidth = 1.5;
			ctx.stroke();
		}
		ctx.restore();
	}

	function drawGrid(ctx, w, h){
		const a = s2w(0, 0), b = s2w(w, h);
		ctx.save();
		ctx.strokeStyle = 'rgba(150, 180, 220, 0.09)';
		ctx.lineWidth = 1;
		const startX = Math.floor(a.x / GAP_X) - 1;
		const endX = Math.ceil(b.x / GAP_X) + 1;
		const startY = Math.floor(a.y / GAP_Y) - 1;
		const endY = Math.ceil(b.y / GAP_Y) + 1;
		for(let gx = startX; gx <= endX; gx++){
			const p = w2s(gx * GAP_X, 0);
			ctx.beginPath();
			ctx.moveTo(p.x, 0);
			ctx.lineTo(p.x, h);
			ctx.stroke();
		}
		for(let gy = startY; gy <= endY; gy++){
			const p = w2s(0, gy * GAP_Y);
			ctx.beginPath();
			ctx.moveTo(0, p.y);
			ctx.lineTo(w, p.y);
			ctx.stroke();
		}
		ctx.restore();
	}

	function dragPreview(){
		const drag = state.drag && state.drag.kind === 'node' && state.drag.moved ? state.drag : null;
		const moving = {};
		let dgx = 0, dgy = 0;
		if(drag){
			const world = s2w(drag.pxLive, drag.pyLive);
			const origin = centerOf({ gx: drag.gx, gy: drag.gy });
			dgx = Math.round((world.x - origin.x) / GAP_X);
			dgy = Math.round((world.y - origin.y) / GAP_Y);
			const stack = [drag.id];
			while(stack.length){
				const id = stack.pop();
				if(moving[id]) continue;
				moving[id] = true;
				const node = state.spell.nodes.find(function(n){ return n.id === id; });
				if(node) (node.childIds || []).forEach(function(cid){ stack.push(cid); });
			}
		}
		return { moving: moving, gx: dgx, gy: dgy };
	}

	function nodeScreen(node, preview){
		const on = preview && preview.moving[node.id];
		return w2s((node.gx + (on ? preview.gx : 0)) * GAP_X, (node.gy + (on ? preview.gy : 0)) * GAP_Y);
	}

	function drawWires(ctx){
		const preview = dragPreview();
		(state.spell.connections || []).forEach(function(conn){
			const parent = state.spell.nodes.find(function(n){ return n.id === conn.parentId; });
			const child = state.spell.nodes.find(function(n){ return n.id === conn.childId; });
			if(!parent || !child) return;
			const a = nodeScreen(parent, preview);
			const b = nodeScreen(child, preview);
			const selected = state.selectedConn === conn.id;
			ctx.save();
			ctx.strokeStyle = selected ? 'rgba(255,255,255,.95)' : conn.executionType === 'condition' ? 'rgba(255,190,140,.85)' : conn.executionType === 'delay' ? 'rgba(170,150,255,.9)' : 'rgba(140,196,255,.8)';
			ctx.lineWidth = selected ? 3.2 : 2;
			ctx.shadowColor = ctx.strokeStyle;
			ctx.shadowBlur = 8;
			ctx.beginPath();
			curve(ctx, a, b);
			ctx.stroke();
			ctx.shadowBlur = 0;
			ctx.setLineDash([7, 12]);
			ctx.lineDashOffset = -state.time * 42;
			ctx.strokeStyle = 'rgba(255,255,255,.75)';
			ctx.lineWidth = 1.2;
			ctx.beginPath();
			curve(ctx, a, b);
			ctx.stroke();
			ctx.setLineDash([]);
			const mid = sampleCurve(centerOf(parent), centerOf(child), 0.55);
			const sm = w2s(mid.x, mid.y);
			const label = conn.executionType === 'delay' ? (conn.delay || 0) + 's' : conn.executionType === 'condition' ? 'if' : '';
			if(label){
				ctx.font = '12px Segoe UI, sans-serif';
				const tw = ctx.measureText(label).width + 14;
				roundRect(ctx, sm.x - tw / 2, sm.y - 10, tw, 20, 8);
				ctx.fillStyle = 'rgba(8,10,18,.88)';
				ctx.fill();
				ctx.fillStyle = '#f4f7ff';
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.fillText(label, sm.x, sm.y + 1);
			}
			const ang = Math.atan2(b.y - a.y, b.x - a.x);
			ctx.fillStyle = 'rgba(220,236,255,.9)';
			arrow(ctx, b.x - Math.cos(ang) * 54 * state.cam.zoom, b.y - Math.sin(ang) * 28 * state.cam.zoom, ang);
			ctx.restore();
		});
	}

	function curve(ctx, a, b){
		const dx = b.x - a.x, dy = b.y - a.y;
		ctx.moveTo(a.x, a.y);
		ctx.bezierCurveTo(a.x + dx * 0.35, a.y + dy * 0.05, a.x + dx * 0.65, b.y - dy * 0.05, b.x, b.y);
	}

	function arrow(ctx, x, y, ang){
		ctx.save();
		ctx.translate(x, y);
		ctx.rotate(ang);
		ctx.beginPath();
		ctx.moveTo(8, 0);
		ctx.lineTo(-6, -5);
		ctx.lineTo(-6, 5);
		ctx.closePath();
		ctx.fill();
		ctx.restore();
	}

	function drawNodes(ctx){
		const preview = dragPreview();
		state.spell.nodes.forEach(function(node){
			const c = nodeScreen(node, preview);
			const rune = RM.rune(node.type);
			const accent = colorOf(rune && rune.category);
			const selected = state.selected === node.id;
			const bad = state.report.errors.some(function(e){ return e.nodeId === node.id; });
			const w = NODE_W * state.cam.zoom;
			const h = NODE_H * state.cam.zoom;
			ctx.save();
			ctx.shadowColor = selected ? accent : 'rgba(0,0,0,.35)';
			ctx.shadowBlur = selected ? 18 : 10;
			roundRect(ctx, c.x - w / 2, c.y - h / 2, w, h, 14 * state.cam.zoom);
			ctx.fillStyle = 'rgba(12,16,28,.92)';
			ctx.fill();
			ctx.shadowBlur = 0;
			ctx.lineWidth = selected ? 2.4 : 1.2;
			ctx.strokeStyle = bad ? '#ff8d8d' : accent;
			ctx.stroke();
			ctx.fillStyle = accent;
			ctx.fillRect(c.x - w / 2, c.y - h / 2, 5 * state.cam.zoom, h);
			ctx.fillStyle = '#f5f8ff';
			ctx.textAlign = 'left';
			ctx.textBaseline = 'middle';
			ctx.font = (13 * Math.max(0.85, state.cam.zoom)) + 'px Segoe UI, sans-serif';
			ctx.fillText(rune ? rune.name : node.type, c.x - w / 2 + 14 * state.cam.zoom, c.y - 12 * state.cam.zoom, w - 24);
			ctx.fillStyle = '#9aabc4';
			ctx.font = (11 * Math.max(0.8, state.cam.zoom)) + 'px Segoe UI, sans-serif';
			const summary = rune && rune.summary ? rune.summary(node) : '';
			ctx.fillText(summary, c.x - w / 2 + 14 * state.cam.zoom, c.y + 12 * state.cam.zoom, w - 24);
			if(bad){
				ctx.fillStyle = '#ff6d6d';
				ctx.beginPath();
				ctx.arc(c.x + w / 2 - 12, c.y - h / 2 + 12, 7, 0, Math.PI * 2);
				ctx.fill();
				ctx.fillStyle = '#2a0c0c';
				ctx.font = 'bold 11px Segoe UI, sans-serif';
				ctx.textAlign = 'center';
				ctx.fillText('!', c.x + w / 2 - 12, c.y - h / 2 + 13);
			}
			ctx.restore();
		});
	}

	function drawPlus(ctx){
		plusButtons().forEach(function(btn){
			const p = w2s(btn.x, btn.y);
			const hot = state.hover && state.hover.parentId === btn.parentId && state.hover.dir === btn.dir;
			const pulse = 1 + Math.sin(state.time * 3 + btn.x) * 0.06;
			const r = (hot ? 15 : 12) * pulse;
			ctx.save();
			ctx.beginPath();
			ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
			ctx.fillStyle = hot ? 'rgba(240,212,140,.95)' : 'rgba(20,28,44,.9)';
			ctx.fill();
			ctx.strokeStyle = hot ? '#fff4d2' : 'rgba(180,206,255,.7)';
			ctx.stroke();
			ctx.strokeStyle = hot ? '#2a210c' : '#e8f1ff';
			ctx.lineWidth = 1.6;
			ctx.beginPath();
			ctx.moveTo(p.x - 5, p.y);
			ctx.lineTo(p.x + 5, p.y);
			ctx.moveTo(p.x, p.y - 5);
			ctx.lineTo(p.x, p.y + 5);
			ctx.stroke();
			ctx.restore();
		});
	}

	function minimapRect(){
		return { x: 16, y: 16, w: 168, h: 110 };
	}

	function drawMinimap(ctx, w, h){
		const map = minimapRect();
		let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
		state.spell.nodes.forEach(function(n){
			const c = centerOf(n);
			minX = Math.min(minX, c.x); minY = Math.min(minY, c.y);
			maxX = Math.max(maxX, c.x); maxY = Math.max(maxY, c.y);
		});
		const bw = Math.max(GAP_X, maxX - minX);
		const bh = Math.max(GAP_Y, maxY - minY);
		ctx.save();
		roundRect(ctx, map.x, map.y, map.w, map.h, 10);
		ctx.fillStyle = 'rgba(6,8,14,.72)';
		ctx.fill();
		ctx.strokeStyle = 'rgba(170,198,255,.25)';
		ctx.stroke();
		state.spell.nodes.forEach(function(n){
			const c = centerOf(n);
			const x = map.x + 10 + ((c.x - minX) / bw) * (map.w - 20);
			const y = map.y + 10 + ((c.y - minY) / bh) * (map.h - 20);
			ctx.fillStyle = n.id === state.selected ? '#f0d48a' : '#9ec0ff';
			ctx.fillRect(x - 3, y - 2, 6, 4);
		});
		const a = s2w(0, 0), b = s2w(w, h - 160);
		ctx.strokeStyle = 'rgba(255,255,255,.45)';
		ctx.strokeRect(
			map.x + 10 + ((a.x - minX) / bw) * (map.w - 20),
			map.y + 10 + ((a.y - minY) / bh) * (map.h - 20),
			((b.x - a.x) / bw) * (map.w - 20),
			((b.y - a.y) / bh) * (map.h - 20)
		);
		ctx.restore();
	}

	function focusMinimap(p, map){
		let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
		state.spell.nodes.forEach(function(n){
			const c = centerOf(n);
			minX = Math.min(minX, c.x); minY = Math.min(minY, c.y);
			maxX = Math.max(maxX, c.x); maxY = Math.max(maxY, c.y);
		});
		const bw = Math.max(GAP_X, maxX - minX);
		const bh = Math.max(GAP_Y, maxY - minY);
		const wx = minX + ((p.x - map.x - 10) / (map.w - 20)) * bw;
		const wy = minY + ((p.y - map.y - 10) / (map.h - 20)) * bh;
		state.cam.x = shell.canvas.width / 2 - wx * state.cam.zoom;
		state.cam.y = shell.canvas.height / 2 - wy * state.cam.zoom;
	}

	function drawStage(ctx, w, h){
		const rect = { x: 16, y: h - 156, w: Math.max(220, w - 32), h: 140 };
		RM.paintSandbox(ctx, state.sandbox, rect, state.time);
		ctx.save();
		ctx.font = '12px Segoe UI, sans-serif';
		ctx.fillStyle = '#d5e6ff';
		ctx.textAlign = 'left';
		ctx.fillText('Test range', rect.x + 12, rect.y + 18);
		const foe = state.sandbox.hostile;
		ctx.textAlign = 'right';
		ctx.fillText(Math.max(0, Math.round(foe.hp)) + ' / ' + foe.maxHp, rect.x + rect.w - 12, rect.y + 18);
		ctx.textAlign = 'left';
		ctx.fillStyle = '#9eb0cc';
		(state.sandbox.log || []).slice(0, 2).forEach(function(line, i){
			ctx.fillText(line, rect.x + 12, rect.y + 38 + i * 16);
		});
		ctx.restore();
	}

	function roundRect(ctx, x, y, w, h, r){
		const radius = Math.max(0, Math.min(r, w / 2, h / 2));
		ctx.beginPath();
		ctx.moveTo(x + radius, y);
		ctx.arcTo(x + w, y, x + w, y + h, radius);
		ctx.arcTo(x + w, y + h, x, y + h, radius);
		ctx.arcTo(x, y + h, x, y, radius);
		ctx.arcTo(x, y, x + w, y, radius);
		ctx.closePath();
	}

	function toast(text){
		shell.toast.textContent = text;
		shell.toast.classList.add('show');
		clearTimeout(toastTimer);
		toastTimer = setTimeout(function(){ shell.toast.classList.remove('show'); }, 2200);
	}

	function save(){
		state.spell.name = shell.name.value.trim() || 'Magic Blast';
		if(state.slot === 9) state.spell.isUltimate = true;
		else delete state.spell.isUltimate;
		state.report = RM.validate(state.spell);
		RM.stamp(state.spell);
		if(state.onSave) state.onSave(JSON.parse(JSON.stringify(state.spell)));
		state.dirty = false;
		renderMeters();
		toast(state.report.ok ? 'Saved.' : 'Saved with errors. It cannot be cast until they are fixed.');
	}

	function onAction(e){
		const btn = e.target.closest('button');
		if(!btn || !state) return;
		const act = btn.dataset.act;
		if(act === 'fit') fit();
		if(act === 'undo') undo();
		if(act === 'redo') redo();
		if(act === 'help') shell.help.style.display = shell.help.style.display === 'none' ? 'block' : 'none';
		if(act === 'test'){
			state.sandbox.hostile.hp = state.sandbox.hostile.maxHp;
			state.sandbox.hostile.x = 460;
			RM.castSandbox(state.sandbox, state.spell);
		}
		if(act === 'clear'){
			if(!confirm('Clear this spell slot?')) return;
			if(state.onClear) state.onClear();
			close(true);
		}
		if(act === 'save') save();
		if(act === 'close') close(false);
	}

	function onKey(e){
		if(!state) return;
		const typing = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT');
		if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z'){ e.preventDefault(); if(e.shiftKey) redo(); else undo(); }
		else if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y'){ e.preventDefault(); redo(); }
		else if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's'){ e.preventDefault(); save(); }
		else if(e.key === 'Escape'){
			if(shell.picker.style.display === 'block') shell.picker.style.display = 'none';
			else if(state.selectedConn || (state.selected && state.selected !== state.spell.rootId)){
				state.selectedConn = null;
				state.selected = state.spell.rootId;
				refresh();
			}
		} else if(!typing && (e.key === 'Delete' || e.key === 'Backspace') && state.selected && state.selected !== state.spell.rootId){
			commit(function(){ return RM.removeSubtree(state.spell, state.selected); });
			state.selected = state.spell.rootId;
			refresh();
		} else if(!typing && (e.key === 'f' || e.key === 'F')) fit();
		else if(!typing && (e.key === '+' || e.key === '=')) state.cam.zoom = Math.min(2.3, state.cam.zoom * 1.08);
		else if(!typing && e.key === '-') state.cam.zoom = Math.max(0.28, state.cam.zoom / 1.08);
	}

	root.RuneEditor = {
		open: open,
		close: function(){ close(false); },
		isOpen: function(){ return !!state; },
		debugView: function(){
			if(!state) return null;
			return {
				zoom: state.cam.zoom,
				cam: { x: state.cam.x, y: state.cam.y },
				nodes: state.spell.nodes.map(function(n){
					const c = w2s(centerOf(n).x, centerOf(n).y);
					return { id: n.id, type: n.type, gx: n.gx, gy: n.gy, sx: Math.round(c.x), sy: Math.round(c.y) };
				}),
				wires: (state.spell.connections || []).map(function(conn){
					return { id: conn.id, parentId: conn.parentId, childId: conn.childId, executionType: conn.executionType, delay: conn.delay, condition: conn.condition };
				})
			};
		}
	};
})(typeof window !== 'undefined' ? window : globalThis);
