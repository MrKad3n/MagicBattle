/* =============================================================
   TutorialCoach (c58) — guided, hands-on lessons.

   A lesson doesn't just tell you how something works: it has you do it. A card says what to do next, a glowing ring
   and a bouncing arrow point at the exact button, rune or field, and the step ticks itself off the moment you've done
   it. Spell lessons are built in the real Rune Forge (in the inventory) and then tried out in the Sandbox; world
   lessons run in EmberFall. A lesson that crosses pages carries on where it left off.

   Used on inventory.html (forge steps) and dungeon.html (practice steps). The run in progress is kept in localStorage
   `magicBattle_tutorialRun` = { id, step, slot }; finished lessons in `magicBattle_lessonsDone`.

   TutorialCoach.start(id) · .stop() · .lessons() · .done(id) · .running()
   ============================================================= */
(function (global) {
	'use strict';

	const RUN_KEY = 'magicBattle_tutorialRun', DONE_KEY = 'magicBattle_lessonsDone';
	const PAGE = /dungeon\.html/.test(location.pathname) ? 'game' : (/inventory\.html/.test(location.pathname) ? 'inv' : 'other');
	const qs = (() => { try { return new URLSearchParams(location.search); } catch (e) { return new URLSearchParams(''); } })();
	const MODE = PAGE === 'game' ? (qs.get('mode') || (qs.get('type') ? 'dungeon' : 'dungeon')) : '';
	const g = (n) => { try { return Function('return typeof ' + n + ' !== "undefined" ? ' + n + ' : undefined')(); } catch (e) { return undefined; } };
	const K = (k) => '<kbd>' + k + '</kbd>';
	const slotKey = (s) => s === 9 ? '0' : String(s + 1);

	/* ---------------------------------------------------------------- the forge, seen from outside */
	const F = () => (global.MagicForge && MagicForge.isOpen && MagicForge.isOpen()) ? MagicForge._state() : null;
	const nodesOf = () => { const f = F(); return f ? Object.values(f.def.nodes) : []; };
	const nodeOf = (type, pred) => nodesOf().find(n => n.type === type && (!pred || pred(n)));
	const parentOf = (n) => { const f = F(); return n && n.parent && f ? f.def.nodes[n.parent] : null; };
	// a rune of `type` somewhere after a rune of `after` (its ancestor)
	const after = (type, aType, pred) => nodesOf().find(n => {
		if (n.type !== type || (pred && !pred(n))) return false;
		if (!aType) return true;
		for (let p = parentOf(n); p; p = parentOf(p)) if (p.type === aType) return true;
		return false;
	});
	const elOfNode = (n) => { const f = F(); return n && f && f.nodeEls[n.id] ? f.nodeEls[n.id].querySelector('.mf-card') || f.nodeEls[n.id] : null; };
	const selected = () => { const f = F(); return f && f.sel && f.sel.type === 'node' ? f.def.nodes[f.sel.id] : null; };
	const selectedLink = () => { const f = F(); return f && f.sel && f.sel.type === 'link' ? f.def.nodes[f.sel.id] : null; };
	const picker = () => { const f = F(); return f && f.picker ? f.picker : null; };
	const pickerItem = (type) => { const p = picker(); const it = p && p.items.find(i => i.id === type); return it ? it.el : null; };
	const field = (key, sub) => { const f = F(); if (!f) return null; const el = f.els.insBody.querySelector('[data-key="' + key + '"]'); return el && sub ? el.querySelector(sub) || el : el; };
	const forgeBtn = (a) => { const f = F(); return f ? f.els.root.querySelector('[data-a="' + a + '"]') : null; };
	const plusOf = (n) => { const f = F(); const el = n && f && f.nodeEls[n.id]; return el ? (el.querySelector('.mf-plus.e') || el.querySelector('.mf-plus.s') || el.querySelector('.mf-plus')) : null; };
	const untyped = () => nodesOf().find(n => !n.type);
	const runeName = (t) => { const R = global.MagicEngine && MagicEngine.Runes[t]; return R ? R.glyph + ' ' + R.name : t; };

	/* step makers for the forge */
	function stepAdd(type, aType, text, more) {
		return Object.assign({
			page: 'inv', text,
			check: () => !!after(type, aType),
			target: () => {
				if (!F()) return null;
				const it = pickerItem(type); if (it) return it;
				if (picker()) return F().picker.el.querySelector('input');
				const blank = untyped(); if (blank) return elOfNode(blank);
				if (!aType) return elOfNode(nodesOf()[0]);
				const host = after(aType) || nodeOf(aType);
				// the + on the last rune of the chain after aType
				let last = host; for (;;) { const kid = nodesOf().find(n => n.parent === (last && last.id)); if (!kid) break; last = kid; }
				return plusOf(last);
			},
			sub: () => picker() ? 'Choose <b>' + runeName(type) + '</b> in the list (you can type to search).' : (aType ? 'Click the <b>+</b> on the right of the last rune.' : '')
		}, more || {});
	}
	function stepParam(type, key, ok, text, sub, valueSel) {
		return {
			page: 'inv', text,
			check: () => !!nodeOf(type, n => ok(n.params[key], n)),
			target: () => {
				const s = selected();
				if (s && s.type === type) return valueSel ? (field(key, valueSel) || field(key)) : (field(key, 'input.mf-num') || field(key, 'select') || field(key));
				return elOfNode(nodeOf(type));
			},
			sub: () => { const s = selected(); return s && s.type === type ? (sub || '') : 'Click the <b>' + runeName(type) + '</b> rune to open its settings on the right.'; }
		};
	}
	function stepLink(type, mode, cond, text) {
		return {
			page: 'inv', text,
			check: () => !!nodeOf(type, n => n.link && n.link.mode === mode && (!cond || (n.link.cond && n.link.cond.type === cond))),
			target: () => {
				const n = nodeOf(type); if (!n) return null;
				const L = selectedLink();
				if (L && L.id === n.id) {
					if (n.link.mode !== mode) return F().els.insBody.querySelector('.mf-seg.modes .' + mode);
					if (cond) return field('cond', 'select');
				}
				const le = F().linkEls[n.id]; return le ? le.badge : null;
			},
			sub: () => { const n = nodeOf(type), L = selectedLink(); if (n && L && L.id === n.id) return n.link.mode !== mode ? 'Click <b>' + (mode === 'condition' ? '❓ Wait until' : mode) + '</b>.' : 'Pick it in the <b>Wait until</b> list.'; return 'Click the little badge on the line just before ' + runeName(type) + '.'; }
		};
	}
	function stepTech(id, name) {
		return {
			page: 'inv', text: 'Your spells can only use techniques you have put <b>Technique Points</b> into. Open <b>✧ Techniques</b> and give <b>' + name + '</b> a point.',
			check: () => { const f = F(); return !!(f && f.profile.allocations && f.profile.allocations[id] > 0); },
			target: () => { const row = document.querySelector('.mf-tech-row[data-tech="' + id + '"] .tp-plus'); return row || forgeBtn('tech'); },
			sub: () => document.querySelector('.mf-tech-row') ? 'Press <b>+</b> on the ' + name + ' row. No free points? Take one away from another technique with <b>−</b> first. Then press <b>Done</b>.' : ''
		};
	}
	const stepSave = (pred, text) => ({
		page: 'inv', text: text || 'That\'s the whole spell. Look at the panel on the right: <b>✓ No problems</b> means it can be cast. Now press <b>Save</b> (or ' + K('Ctrl+S') + ').',
		check: (run) => { const st = g('STATE'); const sp = st && st.spells && st.spells[run.slot]; return !!(sp && sp.kind === 'magic' && (!pred || pred(sp))); },
		target: () => forgeBtn('save')
	});
	const savedHas = (types) => (sp) => types.every(t => Object.values(sp.nodes).some(n => n.type === t));
	const stepToGame = (text) => ({ page: 'any', text: text || 'Saved! Time to try it for real.', go: { label: '▶ Go to the Sandbox', mode: 'sandbox' }, check: () => PAGE === 'game' && MODE === 'sandbox' });

	/* ---------------------------------------------------------------- the game, seen from outside */
	const P = () => g('player');
	const counters = { casts: 0, dummyDmg: 0, meleeDmg: 0 };
	let hooked = false;
	function hookGame() {
		if (hooked || PAGE !== 'game') return;
		const MW = g('MAGIC_WORLD'), MH = g('MAGIC_HOST'), MO = g('MAGIC_OWNER');
		if (MW && MW.cast && !MW.cast._coach) {
			const f = MW.cast; MW.cast = function (def, o) { if (o && o.owner === MO) counters.casts++; return f.apply(this, arguments); }; MW.cast._coach = true;
		}
		if (MH && MH.damageEnemy && !MH.damageEnemy._coach) {
			const f = MH.damageEnemy; MH.damageEnemy = function (e, d) { if (e && (e.isDummy || e.isSandboxDummy || e.runeMage) && d > 0) counters.dummyDmg += d; return f.apply(this, arguments); }; MH.damageEnemy._coach = true;
		}
		const MM = g('MeleeMode');
		if (MM && MM.damageListeners && !MM._coach) { MM.damageListeners.push(ev => { if (ev && ev.source === P() && ev.amount > 0) counters.meleeDmg += ev.amount; }); MM._coach = true; }
		hooked = !!(MW && MH);
	}
	const keysDown = () => g('keys') || {};
	const gStep = (mode, text, check, more) => Object.assign({ page: 'game', mode, text, check }, more || {});
	/* a point in the game world the coach can ring: an invisible box kept over it on screen */
	let pinEl = null;
	function worldPin(x, y, w, h) {
		const cv = document.getElementById('game'), cam = g('camera');
		if (!cv || !cam) return null;
		if (!pinEl) { pinEl = document.createElement('div'); pinEl.id = 'tuPin'; pinEl.style.cssText = 'position:fixed;pointer-events:none;z-index:1'; document.body.appendChild(pinEl); }
		const r = cv.getBoundingClientRect(), k = r.width / (cv.width || 1);
		Object.assign(pinEl.style, { left: (r.left + (x - cam.x) * k) + 'px', top: (r.top + (y - cam.y) * k) + 'px', width: Math.max(8, w * k) + 'px', height: Math.max(8, h * k) + 'px' });
		return pinEl;
	}
	const hotbarSlot = (i) => document.querySelectorAll('#hotbar .hb-slot')[i] || null;
	function nearestDummy() {
		const ds = g('dummies'), p = P(); if (!ds || !p) return null;
		let best = null, bd = 1e9;
		for (const d of ds) { if (!d || d.dead) continue; const dd = Math.abs(d.x - p.x); if (dd < bd) { bd = dd; best = d; } }
		return best;
	}
	const dummyPin = () => { const d = nearestDummy(); return d ? worldPin(d.x - 22, d.y - 30, d.w + 44, d.h + 44) : null; };
	const selectSlot = (what) => gStep('sandbox', 'Press ' + '<b class="tu-key">{SLOT}</b> to pick ' + (what || 'your new spell') + '. Its slot lights up in the bar at the bottom.', (run) => g('activeSlot') === run.slot,
		{ target: (run) => hotbarSlot(run.slot) });
	const castAtDummy = (text) => gStep('sandbox', text || 'Walk right to the training dummies, aim at one with your mouse and <b>click</b> to cast.', (run, st) => counters.dummyDmg - st.dmg0 > 0,
		{ enter: (st) => { st.dmg0 = counters.dummyDmg; }, target: dummyPin });

	/* ---------------------------------------------------------------- the lessons */
	const L = [
		{ id: 'basics', icon: '🏃', cat: 'Getting started', title: 'Moving and fighting',
			summary: 'Walk, jump, dash and parry, then hit a training dummy with a spell.', where: 'Sandbox',
			steps: [
				gStep('sandbox', 'Welcome to the Sandbox! Walk with ' + K('A') + ' and ' + K('D') + ' (or the arrow keys). Take a little stroll.', (r, st) => Math.abs((P() || {}).x - st.x0) > 260, { enter: (st) => { st.x0 = (P() || {}).x; } }),
				gStep('sandbox', 'Jump with ' + K('Space') + ' or ' + K('W') + '. Hold it for a higher jump.', (r, st) => { const p = P(); if (p && !p.onGround) st.air = (st.air || 0) + 1; return st.air > 12; }),
				gStep('sandbox', 'Dash with ' + K('Shift') + ' — a quick burst. You can\'t be hurt for a moment while you dash.', () => { const M = g('MeleeMode'); return !!(M && M.dash && M.dash.t > 0); }),
				gStep('sandbox', 'Parry with ' + K('Q') + ' (or right-click). Time it just as an attack lands to block it and hit back.', () => { const M = g('MeleeMode'); return !!(M && M.parry && M.parry.t > 0); }),
				gStep('sandbox', 'Your spells sit in slots 1–0 (the bar at the bottom). Press ' + K('1') + ' to pick slot 1.', () => g('activeSlot') === 0, { target: () => hotbarSlot(0) }),
				gStep('sandbox', 'Now walk right to the training dummies, aim at one with the mouse and <b>click</b> to cast.', (r, st) => counters.dummyDmg - st.dmg0 > 0, { enter: (st) => { st.dmg0 = counters.dummyDmg; }, target: dummyPin })
			] },

		{ id: 'firstspell', icon: '✦', cat: 'Rune magic', title: 'Your first spell: an arrow', needsSlot: true,
			summary: 'Build a spell from three runes — Generate, Compress and Redirect — then fire it at a dummy.', where: 'Rune Forge → Sandbox',
			steps: [
				stepAdd('generate', null, 'This is the <b>Rune Forge</b>. A spell is a chain of runes: energy is made at the start and flows along it. Every spell begins by making energy — choose <b>✦ Generate Energy</b>.'),
				stepParam('generate', 'amount', v => v >= 30, 'More energy means more damage (and a higher cost). Set <b>Energy</b> to at least <b>30</b>.', 'Drag the slider or type a number in the box.'),
				stepAdd('compress', 'generate', 'Raw energy is a soft blob. Add <b>◈ Compress / Shape</b> after Generate to make it dense and give it a shape.'),
				stepParam('compress', 'shape', v => v === 'arrow', 'Choose the <b>Arrow</b> shape.', 'Click the Arrow picture.', '[data-v="arrow"]'),
				stepParam('compress', 'power', v => v >= 3, 'Set its <b>power</b> to 3 or more: denser energy is smaller and hits harder.'),
				stepAdd('redirect', 'compress', 'Without a direction the arrow just sits there. Add <b>➹ Redirect</b> after Compress.'),
				stepParam('redirect', 'toward', v => v === 'mouse', 'Make it fly <b>toward the cursor</b> (Toward → Mouse).', '', 'select'),
				stepSave(savedHas(['generate', 'compress', 'redirect'])),
				stepToGame('Saved in slot {SLOT}! Now let\'s fire it.'),
				selectSlot('your arrow'),
				castAtDummy('Walk right to the training dummies, aim at one with your mouse and <b>click</b> to shoot your arrow.')
			] },

		{ id: 'mine', icon: '⏱️', cat: 'Rune magic', title: 'Timing: a proximity mine', needsSlot: true,
			summary: 'Use a Condition connector so a spell waits for an enemy before it bursts.', where: 'Rune Forge → Sandbox',
			steps: [
				stepAdd('generate', null, 'Let\'s build a mine that waits for an enemy. Start with <b>✦ Generate Energy</b>.'),
				stepParam('generate', 'amount', v => v >= 30, 'Give it at least <b>30</b> energy.'),
				stepAdd('anchor', 'generate', 'Add <b>⚓ Anchor / State</b> so the energy stays where you put it.'),
				stepParam('anchor', 'state', v => v === 'anchored', 'Set its state to <b>Anchored</b>.', '', 'select'),
				stepAdd('discharge', 'anchor', 'Add <b>✸ Discharge</b> — it releases the energy as a burst.'),
				stepLink('discharge', 'condition', 'enemyNear', 'Right now it would burst straight away. Click the <b>connector badge</b> before Discharge and set it to <b>❓ Wait until → Enemy is nearby</b>.'),
				stepSave(savedHas(['generate', 'anchor', 'discharge'])),
				stepToGame('Saved in slot {SLOT}! Let\'s set a trap.'),
				selectSlot('your mine'),
				castAtDummy('Walk up close to a training dummy and <b>click</b> to drop the mine right next to it. It bursts as soon as the dummy is within reach.')
			] },

		{ id: 'firebolt', icon: '🔥', cat: 'Rune magic', title: 'Techniques: a fire bolt', needsSlot: true,
			summary: 'Put a point into Thermal, then give your energy heat with the Technique rune.', where: 'Rune Forge → Sandbox',
			steps: [
				stepAdd('generate', null, 'Techniques give energy a magical law. First, make some energy: choose <b>✦ Generate Energy</b>.'),
				stepTech('thermal', 'Thermal'),
				stepAdd('technique', 'generate', 'Add the <b>✧ Technique</b> rune after Generate.'),
				stepParam('technique', 'technique', v => v === 'thermal', 'Choose <b>Thermal</b> as its technique.', '', 'select'),
				stepParam('technique', 'power', v => v > 0, 'Keep its power <b>above 0</b> — positive is heat, negative is cold.'),
				stepAdd('compress', 'technique', 'Shape it: add <b>◈ Compress / Shape</b>.'),
				stepAdd('redirect', 'compress', 'And send it flying: add <b>➹ Redirect</b> (toward the cursor).'),
				stepSave(savedHas(['generate', 'technique', 'compress', 'redirect'])),
				stepToGame('Saved in slot {SLOT}! Let\'s set something on fire.'),
				selectSlot('your fire bolt'),
				castAtDummy('Shoot a dummy — watch it burn after the hit.')
			] },

		{ id: 'spear', icon: '🗡️', cat: 'Rune magic', title: 'Over-compression: a piercing spear', needsSlot: true,
			summary: 'Push compression past 10 to make tiny, very strong energy that pierces through enemies.', where: 'Rune Forge → Sandbox',
			steps: [
				stepAdd('generate', null, 'Choose <b>✦ Generate Energy</b>.'),
				stepParam('generate', 'amount', v => v >= 40, 'Over-compressed energy needs enough material to hold together: set Energy to at least <b>40</b>.'),
				stepAdd('compress', 'generate', 'Add <b>◈ Compress / Shape</b>.'),
				stepParam('compress', 'shape', v => v === 'lance', 'Pick the <b>Spear</b> shape.', '', '[data-v="lance"]'),
				stepParam('compress', 'power', v => v >= 12, 'Now push the power past 10 — to <b>12 or more</b>. Past 10 the energy over-compresses: much smaller, much stronger, and it pierces.'),
				stepAdd('redirect', 'compress', 'Add <b>➹ Redirect</b> toward the cursor.'),
				stepSave(savedHas(['generate', 'compress', 'redirect'])),
				stepToGame('Saved in slot {SLOT}! Line up the dummies.'),
				selectSlot('your spear'),
				castAtDummy('Stand at one end of the dummies and fire along the line — the spear goes straight through.')
			] },

		{ id: 'zone', icon: '◎', cat: 'Rune magic', title: 'Zones: drawing energy from the world', needsSlot: true,
			summary: 'Open a zone, fill it with energy drawn from the world, then pull a shot out of it — two branches working together.', where: 'Rune Forge → Sandbox',
			steps: [
				stepAdd('zone', null, 'Instead of spending your own energy, you can gather it. Start with <b>◎ Create Zone</b> — an empty space that stores energy.'),
				stepAdd('target', 'zone', 'Add <b>⌖ Target</b> after it — Target chooses what the next runes work on.'),
				stepParam('target', 'kind', v => v === 'environment', 'Target the <b>Environment</b> — the magic all around you.', '', 'select'),
				stepAdd('drawOut', 'target', 'Add <b>⇩ Draw Out</b>: it pulls energy out of the environment into your zone.'),
				stepParam('drawOut', 'infAmount', v => v >= 60 && v <= 100, 'Set <b>Amount to draw</b> to about <b>80</b> — that fills the zone. Pulling more at once than you can control strains the draw: some spills, and too much backlashes.'),
				{ page: 'inv', text: 'The zone now fills up. To <i>use</i> what is in it, start a <b>second branch</b> from the zone: click the <b>+ under Create Zone</b> and choose <b>⌖ Target</b>.',
					check: () => { const z = nodeOf('zone'); return !!(z && nodesOf().filter(n => n.parent === z.id && n.type).length >= 2); },
					target: () => { if (!F()) return null; const it = pickerItem('target'); if (it) return it; const blank = untyped(); if (blank) return elOfNode(blank); const z = nodeOf('zone'); const el = z && F().nodeEls[z.id]; return el ? (el.querySelector('.mf-plus.s') || el.querySelector('.mf-plus.n') || el.querySelector('.mf-plus')) : null; },
					sub: () => picker() ? 'Choose <b>⌖ Target</b>.' : '' },
				stepParam('target', 'kind', v => v === 'zone', 'This Target should pick the <b>Zone</b> you made.', '', 'select'),
				{ page: 'inv', text: 'Give the zone time to fill before this branch starts: click the <b>connector badge</b> just before this Target and set a <b>⏱ Delay</b> of about <b>2 seconds</b>.',
					check: () => !!nodesOf().find(n => n.type === 'target' && n.params.kind === 'zone' && n.link && n.link.mode === 'delay' && n.link.delay >= 1.5),
					target: () => { const n = nodesOf().find(x => x.type === 'target' && x.params.kind === 'zone'); if (!n) return null; const L2 = selectedLink(); if (L2 && L2.id === n.id) return n.link.mode !== 'delay' ? F().els.insBody.querySelector('.mf-seg.modes .delay') : (F().els.insBody.querySelector('input.mf-num') || F().els.insBody); const le = F().linkEls[n.id]; return le ? le.badge : null; },
					sub: () => { const n = nodesOf().find(x => x.type === 'target' && x.params.kind === 'zone'), L2 = selectedLink(); return n && L2 && L2.id === n.id ? (n.link.mode !== 'delay' ? 'Click <b>⏱ Delay</b>.' : 'Set the delay to <b>2</b> seconds.') : 'Click the small badge on the line between Create Zone and this Target.'; } },
				{ page: 'inv', text: 'Now pull a shot out of the zone: add <b>⇩ Draw Out</b> after the zone Target.',
					check: () => !!nodesOf().find(n => n.type === 'drawOut' && parentOf(n) && parentOf(n).type === 'target' && parentOf(n).params.kind === 'zone'),
					target: () => { if (!F()) return null; const it = pickerItem('drawOut'); if (it) return it; const blank = untyped(); if (blank) return elOfNode(blank); return plusOf(nodesOf().find(x => x.type === 'target' && x.params.kind === 'zone')); },
					sub: () => picker() ? 'Choose <b>⇩ Draw Out</b>.' : 'Click the <b>+</b> on the right of the zone Target.' },
				{ page: 'inv', text: 'Set this Draw Out to <b>Gather it into one energy</b>, with an <b>Amount to draw</b> of about <b>50</b>.',
					check: () => !!nodesOf().find(n => n.type === 'drawOut' && parentOf(n) && parentOf(n).params.kind === 'zone' && n.params.flow === 'one' && n.params.infAmount >= 20 && n.params.infAmount <= 70),
					target: () => { const n = nodesOf().find(x => x.type === 'drawOut' && parentOf(x) && parentOf(x).params.kind === 'zone'); const sl = selected(); if (!n) return null; if (!sl || sl.id !== n.id) return elOfNode(n); return n.params.flow !== 'one' ? field('flow', 'select') : field('infAmount', 'input.mf-num'); },
					sub: () => { const n = nodesOf().find(x => x.type === 'drawOut' && parentOf(x) && parentOf(x).params.kind === 'zone'); const sl = selected(); return n && sl && sl.id === n.id ? '' : 'Click this Draw Out rune to open its settings.'; } },
				{ page: 'inv', text: 'Shape what you pulled out: add <b>◈ Compress / Shape</b> after it.',
					check: () => !!nodesOf().find(n => n.type === 'compress' && parentOf(n) && parentOf(n).type === 'drawOut'),
					target: () => { if (!F()) return null; const it = pickerItem('compress'); if (it) return it; const blank = untyped(); if (blank) return elOfNode(blank); return plusOf(nodesOf().find(x => x.type === 'drawOut' && parentOf(x) && parentOf(x).params.kind === 'zone')); },
					sub: () => picker() ? 'Choose <b>◈ Compress / Shape</b>.' : '' },
				stepAdd('redirect', 'compress', 'And fire it: add <b>➹ Redirect</b> toward the cursor.'),
				stepSave(savedHas(['zone', 'target', 'drawOut', 'compress', 'redirect'])),
				stepToGame('Saved in slot {SLOT}!'),
				selectSlot('your zone spell'),
				castAtDummy('Aim at a dummy and cast it <b>once</b>, then wait: the zone fills for two seconds, then the gathered shot flies at your cursor. (Casting again opens a new zone and closes the old one.)')
			] },

		{ id: 'armour', icon: '⛨', cat: 'Rune magic', title: 'Reinforcement: a passive armour', needsSlot: true,
			summary: 'Pour energy into yourself, and make it a passive spell that stays on.', where: 'Rune Forge → Sandbox',
			steps: [
				stepAdd('generate', null, 'Reinforcement strengthens something that already exists — here, you. Choose <b>✦ Generate Energy</b>.'),
				stepParam('generate', 'amount', v => v >= 40, 'Set at least <b>40</b> energy.'),
				stepAdd('reinforce', 'generate', 'Add <b>⛨ Reinforcement</b>.'),
				stepAdd('target', 'reinforce', 'Add <b>⌖ Target</b> after it — this tells Reinforcement what to strengthen.'),
				stepParam('target', 'kind', v => v === 'self', 'Choose <b>Yourself</b>.', '', 'select'),
				{ page: 'inv', text: 'Armour should stay on. Press <b>∞ Passive</b> in the top bar: casting it switches it on, casting again switches it off.', check: () => { const f = F(); return !!(f && f.def.passive); }, target: () => forgeBtn('passive') },
				stepSave(sp => !!sp.passive && savedHas(['reinforce', 'target'])(sp)),
				stepToGame('Saved in slot {SLOT}! Let\'s put it on.'),
				selectSlot('your armour'),
				gStep('sandbox', '<b>Click</b> to cast it. A glow wraps around you: you now take less damage and hit a little harder. Cast again any time to switch it off.', () => { const MW = g('MAGIC_WORLD'), p = P(); return !!(MW && MW.reinf && MW.reinf.some(s => s.ref === p)); })
			] },

		{ id: 'construct', icon: '🧱', cat: 'Rune magic', title: 'Construction: build a platform', needsSlot: true,
			summary: 'Turn energy into solid matter with the Construction technique, then stand on it.', where: 'Rune Forge → Sandbox',
			steps: [
				stepAdd('generate', null, 'Construction turns energy into solid matter. Choose <b>✦ Generate Energy</b>.'),
				stepParam('generate', 'amount', v => v >= 80, 'A platform needs material: set at least <b>80</b> energy.'),
				stepTech('construction', 'Construction'),
				stepAdd('compress', 'generate', 'Add <b>◈ Compress / Shape</b>.'),
				stepParam('compress', 'shape', v => v === 'line', 'Pick the <b>Line</b> shape — a long, flat plank.', '', '[data-v="line"]'),
				stepAdd('anchor', 'compress', 'Add <b>⚓ Anchor / State</b> so it hangs in the air where you make it.'),
				stepParam('anchor', 'state', v => v === 'anchored', 'Set it to <b>Anchored</b>.', '', 'select'),
				stepAdd('technique', 'anchor', 'Finally add <b>✧ Technique</b>.'),
				stepParam('technique', 'technique', v => v === 'construction', 'Choose <b>Construction</b>.', '', 'select'),
				stepParam('technique', 'construction_facing', v => v === 'right' || v === 'left', 'Make it lie flat: set <b>Facing</b> to <b>Right</b>.', '', 'select'),
				stepSave(savedHas(['generate', 'compress', 'anchor', 'technique'])),
				stepToGame('Saved in slot {SLOT}! Let\'s build.'),
				selectSlot('your platform'),
				gStep('sandbox', '<b>Click</b> to build it, then <b>jump onto it</b>. It\'s solid: you can stand on it, and it blocks shots. (Careful — a heavy construct falling on you can crush you!)', () => { const MW = g('MAGIC_WORLD'), p = P(); return !!(MW && p && p.onGround && MW.constructsIn && MW.constructsIn(p.x + 2, p.y + p.h - 1, p.w - 4, 6).length); })
			] },

		{ id: 'weapons', icon: '🗡️', cat: 'Combat', title: 'Weapons and melee', needsSlot: true,
			summary: 'Put a weapon in a slot, then combo, launch and parry on the dummies.', where: 'Inventory → Sandbox',
			steps: [
				{ page: 'inv', text: 'Weapons go in the same slots as spells. In the <b>Spell Loadout</b> panel, click slot <b>{SLOT}</b>.', check: () => !!document.querySelector('.sc-bg') || false, target: () => { const els = document.querySelectorAll('#spellSlots .spell-slot, .spell-slot'); const run = state(); return run ? els[run.slot] : null; }, done: (run) => { const st = g('STATE'); const sp = st && st.spells[run.slot]; return !!(sp && sp.kind === 'weapon'); } },
				{ page: 'inv', text: 'Pick a weapon — the <b>Apprentice Blade</b> is a good start. Hover one to see it swing.', check: (run) => { const st = g('STATE'); const sp = st && st.spells[run.slot]; return !!(sp && sp.kind === 'weapon'); }, target: () => document.querySelector('.sc-grid .sc-card') },
				stepToGame('Weapon ready in slot {SLOT}!'),
				selectSlot('your weapon'),
				gStep('sandbox', 'Walk to a dummy and <b>click</b> (or ' + K('J') + ') to attack. Click again as it hits to chain a combo.', (r, st) => counters.meleeDmg - st.m0 > 0, { enter: (st) => { st.m0 = counters.meleeDmg; }, target: dummyPin }),
				gStep('sandbox', 'Hold ' + K('W') + ' and attack for a <b>launcher</b> that knocks the dummy up.', () => { const M = g('MeleeMode'); return !!(M && M.atk && M.atk.def && /launcher|up/.test(M.atk.def.id)); }),
				gStep('sandbox', 'Press ' + K('R') + ' for your weapon\'s <b>special</b>.', () => { const M = g('MeleeMode'); return !!(M && M.atk && M.atk.def && M.atk.def.id === 'special'); })
			] },

		{ id: 'world', icon: '🏞️', cat: 'The world', title: 'Exploring EmberFall',
			summary: 'Talk to someone, read the N map and step inside a building.', where: 'EmberFall City',
			steps: [
				gStep('city', 'Welcome to EmberFall. Walk up to anyone in the street and press ' + K('E') + ' to talk.', () => !!g('dialogueActive')),
				gStep('city', 'Press ' + K('N') + ' to open the map. It shows where you are on the world grid.', () => !!global.__whereMapOpen),
				gStep('city', 'Close the map (' + K('N') + ' again) and find a door. Press ' + K('E') + ' at it to step inside.', () => { const C = g('EmberfallCity'); return !!(C && C.currentRoom && C.currentRoom()); }),
				gStep('city', 'Inside! Press ' + K('E') + ' at the door to go back out. Out on the roads, a fingerpost lets you press ' + K('L') + ' to turn onto another road.', () => { const C = g('EmberfallCity'); return !!(C && C.currentRoom && !C.currentRoom()); })
			] }
	];

	/* ---------------------------------------------------------------- run state */
	function state() { try { return JSON.parse(localStorage.getItem(RUN_KEY) || 'null'); } catch (e) { return null; } }
	function setState(s) { try { if (s) localStorage.setItem(RUN_KEY, JSON.stringify(s)); else localStorage.removeItem(RUN_KEY); } catch (e) {} }
	function doneSet() { try { return new Set(JSON.parse(localStorage.getItem(DONE_KEY) || '[]')); } catch (e) { return new Set(); } }
	function markDone(id) { const s = doneSet(); s.add(id); try { localStorage.setItem(DONE_KEY, JSON.stringify([...s])); } catch (e) {} }
	const lesson = (id) => L.find(x => x.id === id);

	/* ---------------------------------------------------------------- UI */
	const CSS = `
#tuCoach{position:fixed;z-index:9600;left:50%;bottom:22px;transform:translateX(-50%);width:min(560px,92vw);background:linear-gradient(180deg,rgba(28,20,52,.97),rgba(16,12,32,.97));border:2px solid #c9a8ff;border-radius:14px;box-shadow:0 10px 40px rgba(0,0,0,.6),0 0 24px rgba(155,89,182,.35);color:#f1ebff;font:14px/1.5 "Segoe UI",system-ui,sans-serif;padding:14px 16px 12px;transition:top .25s,bottom .25s;pointer-events:auto}
#tuCoach.top{bottom:auto;top:80px}
#tuCoach.game{bottom:auto;top:64px}
#tuCoach.game.top{top:64px;bottom:auto}
#tuCoach.game.low{top:auto;bottom:110px}
#tuHl.world{border-style:dashed;border-radius:50%}
#tuCoach .tc-head{display:flex;align-items:center;gap:8px;font-size:12px;color:#c9a8ff;letter-spacing:.04em;margin-bottom:6px}
#tuCoach .tc-head b{color:#ffe27a;font-weight:600}
#tuCoach .tc-dots{display:flex;gap:4px;margin-left:auto}
#tuCoach .tc-dots i{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.15)}
#tuCoach .tc-dots i.on{background:#2ecc71}#tuCoach .tc-dots i.cur{background:#ffe27a;box-shadow:0 0 6px #ffe27a}
#tuCoach .tc-text{font-size:15px}
#tuCoach .tc-sub{margin-top:6px;font-size:12.5px;color:#bfb3e0}
#tuCoach .tc-sub:empty{display:none}
#tuCoach .tc-btns{display:flex;gap:8px;margin-top:10px;align-items:center}
#tuCoach button{padding:6px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.06);color:#eee;cursor:pointer;font-size:12.5px}
#tuCoach button.pri{background:#8e44ad;border-color:#c9a8ff;color:#fff;font-weight:600;font-size:14px;padding:8px 16px}
#tuCoach button:hover{filter:brightness(1.2)}
#tuCoach .tc-sp{flex:1}
#tuCoach kbd,#tuCoach .tu-key{display:inline-block;padding:0 6px;border-radius:4px;border:1px solid #888;border-bottom-width:2px;background:#2a2a3a;font:12px monospace;color:#fff}
#tuCoach.ok{border-color:#2ecc71;box-shadow:0 0 30px rgba(46,204,113,.5)}
#tuCoach .tc-ok{display:none;color:#2ecc71;font-weight:bold}
#tuCoach.ok .tc-ok{display:inline}
#tuHl{position:fixed;z-index:9590;pointer-events:none;border:3px solid #ffe27a;border-radius:10px;box-shadow:0 0 0 4px rgba(255,226,122,.25),0 0 22px rgba(255,226,122,.75);animation:tuPulse 1.1s ease-in-out infinite;transition:left .12s,top .12s,width .12s,height .12s;display:none}
#tuArrow{position:fixed;z-index:9591;pointer-events:none;font-size:30px;color:#ffe27a;text-shadow:0 2px 6px #000,0 0 10px #ffb300;display:none;animation:tuBob .8s ease-in-out infinite}
@keyframes tuPulse{0%,100%{box-shadow:0 0 0 3px rgba(255,226,122,.25),0 0 14px rgba(255,226,122,.6)}50%{box-shadow:0 0 0 8px rgba(255,226,122,.12),0 0 30px rgba(255,226,122,.95)}}
@keyframes tuBob{0%,100%{transform:translate(-50%,-6px)}50%{transform:translate(-50%,4px)}}
`;
	let ui = null;
	function buildUI() {
		if (ui) return ui;
		const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
		const card = document.createElement('div'); card.id = 'tuCoach';
		card.innerHTML = '<div class="tc-head"><span>🎓</span><b class="tc-title"></b><span class="tc-count"></span><span class="tc-ok">✓ Done!</span><span class="tc-dots"></span></div><div class="tc-text"></div><div class="tc-sub"></div><div class="tc-btns"><button class="tc-exit">Exit lesson</button><span class="tc-sp"></span><button class="tc-skip" title="Mark this step done and move on">Skip step</button><button class="pri tc-go" style="display:none"></button></div>';
		const hl = document.createElement('div'); hl.id = 'tuHl';
		const ar = document.createElement('div'); ar.id = 'tuArrow'; ar.textContent = '▼';
		if (PAGE === 'game') card.classList.add('game');
		document.body.appendChild(card); document.body.appendChild(hl); document.body.appendChild(ar);
		card.querySelector('.tc-exit').addEventListener('click', () => stop());
		card.querySelector('.tc-skip').addEventListener('click', () => advance(true));
		card.querySelector('.tc-go').addEventListener('click', () => { const r = state(); const s = r && lesson(r.id) && lesson(r.id).steps[r.step]; if (s && s.go) go(s.go, r); else if (s && s.finish) finish(); });
		ui = { card, hl, ar };
		return ui;
	}
	function removeUI() { if (!ui) return; ui.card.remove(); ui.hl.remove(); ui.ar.remove(); ui = null; }
	const fill = (t, run) => String(t || '').replace(/\{SLOT\}/g, slotKey(run.slot));

	/* ---------------------------------------------------------------- flow */
	let raf = 0, stepState = {}, okUntil = 0, lastScrolled = null;
	function start(id) {
		const Ls = lesson(id); if (!Ls) return false;
		let slot = 0;
		if (Ls.needsSlot && PAGE === 'inv') {
			const st = g('STATE');
			const spells = (st && st.spells) || [];
			slot = spells.findIndex(s => !s);
			if (slot < 0) {
				if (!confirm('This lesson builds into a spell slot, and all ten are full.\n\nUse slot 0 (it will be replaced)?')) return false;
				slot = 9;
				if (typeof global.storeSlotSpell === 'function') global.storeSlotSpell(9, null);
			}
		}
		setState({ id, step: 0, slot, t: Date.now() });
		stepState = {};
		if (PAGE === 'inv' && Ls.needsSlot && Ls.id !== 'weapons' && typeof global.openSpellBuilder === 'function') global.openSpellBuilder(slot);
		begin();
		return true;
	}
	function stop() { setState(null); cancelAnimationFrame(raf); raf = 0; removeUI(); if (PAGE === 'inv' && global.Tutorials && Tutorials.refresh) Tutorials.refresh(); }
	function finish() {
		const r = state(); if (r) markDone(r.id);
		stop();
		if (PAGE === 'game') location.href = 'inventory.html?tab=tutorials';
		else if (global.Tutorials && Tutorials.refresh) Tutorials.refresh();
	}
	function go(dest, run) {
		const mode = dest.mode || 'sandbox';
		if (mode === 'inv') { location.href = 'inventory.html?tab=tutorials'; return; }
		if (PAGE === 'inv' && F()) { try { MagicForge.close(true); } catch (e) {} }
		location.href = 'dungeon.html?mode=' + mode + '&lesson=' + encodeURIComponent(run.id);
	}
	function advance(skip) {
		const r = state(); if (!r) return;
		const Ls = lesson(r.id);
		r.step++;
		stepState = {};
		if (r.step >= Ls.steps.length) { setState(r); showComplete(Ls, r); return; }
		setState(r);
	}
	function showComplete(Ls, r) {
		markDone(Ls.id);
		const u = buildUI();
		u.card.classList.remove('top'); u.card.classList.add('ok');
		u.card.querySelector('.tc-text').innerHTML = '<b>Lesson complete!</b> ' + (Ls.needsSlot && Ls.id !== 'weapons' ? 'Your spell stays in slot ' + slotKey(r.step >= 0 ? r.slot : 0) + ' — open it in the Rune Forge any time to change it.' : 'Nicely done.');
		u.card.querySelector('.tc-sub').innerHTML = 'Pick your next lesson in <b>🎓 Tutorials</b>.';
		const b = u.card.querySelector('.tc-go'); b.style.display = ''; b.textContent = PAGE === 'game' ? '🎓 Back to Tutorials' : '✓ Finish';
		u.card.querySelector('.tc-skip').style.display = 'none';
		u.hl.style.display = 'none'; u.ar.style.display = 'none';
		const fin = () => finish();
		b.onclick = fin;
		cancelAnimationFrame(raf); raf = 0;
	}
	function begin() {
		const r = state(); if (!r) return;
		const Ls = lesson(r.id); if (!Ls) { setState(null); return; }
		buildUI();
		cancelAnimationFrame(raf);
		const loop = () => { raf = requestAnimationFrame(loop); try { tick(); } catch (e) { /* the coach never breaks the page */ } };
		raf = requestAnimationFrame(loop);
	}
	function tick() {
		const r = state(); if (!r) { stop(); return; }
		const Ls = lesson(r.id); const s = Ls && Ls.steps[r.step];
		if (!s) { showComplete(Ls, r); return; }
		const u = buildUI();
		if (PAGE === 'game') hookGame();
		// on the wrong page for this step: offer the way there
		const here = s.page === 'any' || (s.page === PAGE && (s.page !== 'game' || !s.mode || s.mode === MODE));
		const goBtn = u.card.querySelector('.tc-go');
		u.card.querySelector('.tc-title').textContent = Ls.icon + ' ' + Ls.title;
		u.card.querySelector('.tc-count').textContent = 'Step ' + (r.step + 1) + ' of ' + Ls.steps.length;
		const dots = u.card.querySelector('.tc-dots');
		if (dots.childElementCount !== Ls.steps.length) dots.innerHTML = Ls.steps.map(() => '<i></i>').join('');
		[...dots.children].forEach((d, i) => { d.className = i < r.step ? 'on' : (i === r.step ? 'cur' : ''); });
		if (!stepState._entered) { stepState._entered = true; if (s.enter && here) s.enter(stepState, r); }
		let text = fill(s.text, r), sub = '';
		goBtn.style.display = 'none'; goBtn.onclick = null;
		u.card.querySelector('.tc-skip').style.display = '';
		if (!here) {
			const dest = s.page === 'inv' ? { mode: 'inv', label: '🎒 Open the inventory' } : { mode: s.mode || 'sandbox', label: s.mode === 'city' ? '▶ Go to EmberFall' : '▶ Go to the Sandbox' };
			if (s.go) { text = fill(s.text, r); }
			else sub = 'This step happens ' + (s.page === 'inv' ? 'in the inventory (Rune Forge)' : (s.mode === 'city' ? 'in EmberFall' : 'in the Sandbox')) + '.';
			goBtn.style.display = ''; goBtn.textContent = (s.go || dest).label; goBtn.onclick = () => go(s.go || dest, r);
			u.hl.style.display = 'none'; u.ar.style.display = 'none';
		} else {
			// the forge must be open for forge steps
			if (PAGE === 'inv' && s.page === 'inv' && Ls.needsSlot && Ls.id !== 'weapons' && !F() && !s.go) {
				const st = g('STATE'); const sp = st && st.spells && st.spells[r.slot];
				const savedOk = s.check && s.check(r, stepState);
				if (!savedOk) { sub = ''; text = 'Open the Rune Forge on slot ' + slotKey(r.slot) + ' to carry on.'; goBtn.style.display = ''; goBtn.textContent = '✦ Open the Rune Forge'; goBtn.onclick = () => { if (typeof global.openSpellBuilder === 'function') global.openSpellBuilder(r.slot); }; }
			}
			if (s.sub) sub = fill(typeof s.sub === 'function' ? s.sub(r) : s.sub, r);
			if (s.go) { goBtn.style.display = ''; goBtn.textContent = s.go.label; goBtn.onclick = () => go(s.go, r); }
			const done = (s.done && s.done(r, stepState)) || (s.check && s.check(r, stepState));
			if (done && performance.now() > okUntil) {
				okUntil = performance.now() + 750;
				u.card.classList.add('ok');
				setTimeout(() => { u.card.classList.remove('ok'); advance(); }, 650);
			}
			let tgt = s.target ? s.target(r) : null;
			// a forge window (Techniques …) left open over what the step points at: close it first
			const mb = PAGE === 'inv' ? document.querySelector('.mf-modal-bg') : null;
			if (mb && !(tgt && mb.contains(tgt))) { tgt = mb.querySelector('.row .mf-btn.primary') || mb.querySelector('.row .mf-btn'); sub = 'Press <b>' + (tgt ? tgt.textContent : 'Done') + '</b> to close this window and carry on.'; }
			place(tgt);
		}
		u.card.querySelector('.tc-text').innerHTML = text.replace(/\{SLOT\}/g, slotKey(r.slot));
		u.card.querySelector('.tc-sub').innerHTML = sub;
	}
	function place(el) {
		const u = ui; if (!u) return;
		if (!el || !el.getBoundingClientRect || !document.body.contains(el)) { u.hl.style.display = 'none'; u.ar.style.display = 'none'; u.card.classList.remove('top'); return; }
		// a target inside a scrolled list (the rune picker, the inspector): bring it into view, once
		if (el !== lastScrolled) {
			lastScrolled = el;
			let sp = el.parentElement;
			while (sp && sp !== document.body) { const cs = getComputedStyle(sp); if (/(auto|scroll)/.test(cs.overflowY) && sp.scrollHeight > sp.clientHeight + 2) break; sp = sp.parentElement; }
			if (sp && sp !== document.body) {
				const pr = sp.getBoundingClientRect(), er = el.getBoundingClientRect();
				if (er.top < pr.top || er.bottom > pr.bottom) sp.scrollTop += (er.top - pr.top) - (pr.height - er.height) / 2;
			}
		}
		let r = el.getBoundingClientRect();
		// a rune (or its + button) panned out of the forge's view: centre the forge on it
		const vp = el.closest && el.closest('.mf-viewport');
		if (vp && global.MagicForge && MagicForge.reveal && MagicForge._state) {
			const vr = vp.getBoundingClientRect();
			if (r.right < vr.left + 20 || r.left > vr.right - 20 || r.bottom < vr.top + 20 || r.top > vr.bottom - 20) {
				const S = MagicForge._state();
				if (S && S.nodeEls) for (const id in S.nodeEls) { const ne = S.nodeEls[id]; if (ne === el || (ne && ne.contains && ne.contains(el))) { if (place._rv !== id || Date.now() - (place._rvT || 0) > 1500) { place._rv = id; place._rvT = Date.now(); MagicForge.reveal(id); } break; } }
			}
		}
		if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) { u.hl.style.display = 'none'; u.ar.style.display = 'none'; return; }
		const pad = 6;
		Object.assign(u.hl.style, { display: 'block', left: (r.left - pad) + 'px', top: (r.top - pad) + 'px', width: (r.width + pad * 2) + 'px', height: (r.height + pad * 2) + 'px' });
		const above = r.top > 60;
		Object.assign(u.ar.style, { display: 'block', left: (r.left + r.width / 2) + 'px', top: (above ? r.top - 40 : r.bottom + 6) + 'px' });
		u.ar.textContent = above ? '▼' : '▲';
		// keep the card off the thing it points at
		u.card.classList.toggle('top', r.top + r.height / 2 > innerHeight * 0.55);
		u.card.classList.toggle('low', PAGE === 'game' && r.top + r.height / 2 < innerHeight * 0.4);
		u.hl.classList.toggle('world', el.id === 'tuPin');
	}

	/* resume a lesson that carries on across pages */
	function boot() {
		const r = state();
		if (!r) return;
		if (!lesson(r.id)) { setState(null); return; }
		if (Date.now() - (r.t || 0) > 6 * 3600 * 1000) { setState(null); return; }      // stale
		r.t = Date.now(); setState(r);
		begin();
	}
	if (document.readyState === 'complete') setTimeout(boot, 600); else global.addEventListener('load', () => setTimeout(boot, 600));

	global.TutorialCoach = {
		start, stop, running: () => !!state(), current: state,
		lessons: () => L.map(x => ({ id: x.id, title: x.title, icon: x.icon, cat: x.cat, summary: x.summary, where: x.where, steps: x.steps.length, done: doneSet().has(x.id) })),
		done: (id) => doneSet().has(id),
		_counters: counters
	};
})(typeof window !== 'undefined' ? window : globalThis);
