/*
 * Slot chooser — every one of the ten slots holds either a rune spell or a weapon.
 * Shows the wizard (player-rig.js) holding whatever you hover.
 */
(function(root){
	'use strict';
	let S = null;

	function el(tag, cls, html){ const e = document.createElement(tag); if(cls) e.className = cls; if(html != null) e.innerHTML = html; return e; }
	function esc(t){ return String(t == null ? '' : t).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

	function weaponList(){
		const W = root.MELEE_WEAPONS;
		if(!W) return [];
		return W.order.map(id => W.weapons[id]).filter(Boolean);
	}
	function speedOf(w){
		const g = w.moves && w.moves.g1; if(!g) return '—';
		const t = g.startup + g.active;
		return t <= 6 ? 'Very fast' : t <= 9 ? 'Fast' : t <= 13 ? 'Medium' : 'Slow';
	}
	function reachOf(w){
		const g = w.moves && w.moves.g1; if(!g || !g.hitbox) return '—';
		const r = g.hitbox.ox + g.hitbox.w / 2;
		return r >= 90 ? 'Very long' : r >= 60 ? 'Long' : r >= 40 ? 'Medium' : 'Close';
	}
	function comboOf(w){
		const m = w.moves || {}; const out = []; let k = 'g1', guard = 0;
		while(k && m[k] && guard++ < 5){ out.push(m[k].name); k = m[k].next; }
		return out.join(' → ');
	}

	/* a weapon's special (R) can carry an engraved rune spell, cast when the special strikes */
	function engraveHtml(cur){
		const W = root.MELEE_WEAPONS, w = W && W.weapons[cur.weaponId];
		const sp = w && w.moves && w.moves.special;
		const eng = cur.engraved;
		return `<div class="sc-engrave${eng ? ' on' : ''}">
			<span class="sc-glyph">ᚱ</span>
			<span class="sc-eng-txt"><b>${eng ? 'Engraved: ' + esc(eng.name || 'Spell') : 'Engrave a spell'}</b><small>${sp ? 'Into the special — ' + esc(sp.name) + ' (R). ' : ''}${eng ? 'It casts every time the special strikes.' : 'Build a rune spell that casts every time the special strikes (it costs energy like any spell).'}</small></span>
			<span class="sc-eng-btns"><button class="sc-btn sc-eng-edit">${eng ? '✎ Edit engraving' : '✎ Engrave'}</button>${eng ? '<button class="sc-btn danger sc-eng-del">Remove</button>' : ''}</span>
		</div>`;
	}
	function open(opts){
		close();
		const cur = opts.current;
		const curW = cur && cur.kind === 'weapon' ? cur.weaponId : null;
		const isSpell = !!(cur && cur.kind === 'magic');
		const bg = el('div', 'sc-bg');
		const box = el('div', 'sc-box');
		box.innerHTML = `
			<header class="sc-head">
				<div><b>Slot ${opts.slot === 9 ? '0' : opts.slot + 1}</b><span>What should this slot hold?</span></div>
				<button class="sc-x" title="Close (Esc)">✕</button>
			</header>
			<div class="sc-main">
				<div class="sc-stage"><canvas width="360" height="440"></canvas><div class="sc-cap"></div></div>
				<div class="sc-right">
					<button class="sc-spell ${isSpell ? 'on' : ''}">
						<span class="sc-glyph">✦</span>
						<span><b>${isSpell ? 'Edit rune spell' : 'Rune spell'}</b><small>${isSpell ? esc(cur.name) + ' — open it in the Rune Forge' : 'Build a spell in the Rune Forge. Click to cast it.'}</small></span>
					</button>
					${curW && curW !== 'magic' ? engraveHtml(cur) : ''}
					<div class="sc-label">Weapons <small>click to attack · R special · W/S + click for up / down attacks</small></div>
					<div class="sc-grid"></div>
				</div>
			</div>
			<footer class="sc-foot">
				${cur ? '<button class="sc-btn danger sc-clear">Empty this slot</button>' : '<span></span>'}
				<button class="sc-btn sc-cancel">Cancel</button>
			</footer>`;
		bg.appendChild(box);
		document.body.appendChild(bg);
		requestAnimationFrame(() => bg.classList.add('open'));
		const grid = box.querySelector('.sc-grid'), cap = box.querySelector('.sc-cap'), canvas = box.querySelector('.sc-stage canvas');
		S = { bg, opts, show: curW || (isSpell ? null : 'sword'), frame: 0, raf: 0 };
		for(const w of weaponList()){
			const card = el('button', 'sc-card' + (w.id === curW ? ' on' : ''));
			card.innerHTML = `<canvas width="72" height="72"></canvas><div><b>${esc(w.name)}</b><small>${esc(speedOf(w))} · ${esc(reachOf(w))} reach</small></div>${w.id === curW ? '<i>equipped</i>' : ''}`;
			card.title = 'Combo: ' + comboOf(w) + (w.moves && w.moves.special ? '\nSpecial (R): ' + w.moves.special.name : '');
			if(root.PlayerRig) root.PlayerRig.weaponIcon(card.querySelector('canvas'), w.style || w.id);
			card.addEventListener('pointerenter', () => { S.show = w.style || w.id; showCap(w); });
			card.addEventListener('focus', () => { S.show = w.style || w.id; showCap(w); });
			card.addEventListener('click', () => { const cb = opts.onWeapon; close(); if(cb) cb(w.id, w.name); });
			grid.appendChild(card);
		}
		const engEdit = box.querySelector('.sc-eng-edit'), engDel = box.querySelector('.sc-eng-del');
		if(engEdit) engEdit.addEventListener('click', () => { const cb = opts.onEngrave; close(); if(cb) cb(); });
		if(engDel) engDel.addEventListener('click', () => { const cb = opts.onUnengrave; close(); if(cb) cb(); });
		// the magical item: a slot that holds compressed energy you send into your inventory
		{
			const it = cur && cur.kind === 'weapon' && cur.weaponId === 'magic' ? cur.item : null;
			const card = el('button', 'sc-card sc-magic' + (curW === 'magic' ? ' on' : ''));
			card.innerHTML = `<canvas width="72" height="72"></canvas><div><b>Magical item</b><small>${it ? esc(it.shape) + ' · ' + Math.round(it.amount) + ' energy' : 'Made from your own compressed energy'}</small></div>${curW === 'magic' ? '<i>equipped</i>' : ''}`;
			card.title = 'A slot for a weapon made of magic. It does nothing until you Redirect "Into your inventory" energy compressed 20+ in a fist, sword, spear or hammer shape. Its range follows the size of the compressed weapon; it hits hard, has no special yet, carries the effects of its technique, and draws a little energy while equipped to keep from decaying. Send more energy of the same shape to feed it.';
			const cv = card.querySelector('canvas');
			if(it && root.MagicEngine && root.MagicEngine.drawItemIcon) root.MagicEngine.drawItemIcon(cv, it);
			else { const c2 = cv.getContext('2d'); c2.fillStyle = 'rgba(201,168,255,.5)'; c2.font = '34px serif'; c2.textAlign = 'center'; c2.textBaseline = 'middle'; c2.fillText('✧', 36, 38); }
			card.addEventListener('pointerenter', () => { S.show = it ? ({ fist:'gauntlets', sword:'sword', spear:'spear', hammer:'hammer' })[it.shape] : null; cap.innerHTML = '<b>Magical item</b><span>' + (it ? 'A magical ' + esc(it.shape) + ' — ' + Math.round(it.amount) + ' energy, compression ' + Math.round(10 + (it.over || 0)) : 'Empty until you Redirect compressed (20+) fist / sword / spear / hammer energy into your inventory') + '</span>'; });
			card.addEventListener('click', () => { const cb = opts.onWeapon; close(); if(cb) cb('magic', 'Magical item'); });
			grid.appendChild(card);
		}
		const spellBtn = box.querySelector('.sc-spell');
		spellBtn.addEventListener('pointerenter', () => { S.show = null; cap.innerHTML = '<b>Rune spell</b><span>The wizard keeps his staff in the off hand and casts from the other.</span>'; });
		spellBtn.addEventListener('click', () => { const cb = opts.onSpell; close(); if(cb) cb(); });
		box.querySelector('.sc-x').addEventListener('click', close);
		box.querySelector('.sc-cancel').addEventListener('click', close);
		const clr = box.querySelector('.sc-clear');
		if(clr) clr.addEventListener('click', () => { const cb = opts.onClear; close(); if(cb) cb(); });
		bg.addEventListener('pointerdown', e => { if(e.target === bg) close(); });
		S.key = e => { if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); close(); } };
		document.addEventListener('keydown', S.key, true);
		const firstW = weaponList().find(w => (w.style || w.id) === S.show);
		if(firstW) showCap(firstW); else cap.innerHTML = '<b>Rune spell</b><span>Currently in this slot.</span>';
		function showCap(w){
			cap.innerHTML = `<b>${esc(w.name)}</b><span>${esc(comboOf(w))}</span>${w.moves && w.moves.special ? '<span>R · ' + esc(w.moves.special.name) + '</span>' : ''}`;
		}
		const tick = () => {
			if(!S) return;
			S.frame++;
			if(root.PlayerRig) root.PlayerRig.preview(canvas, { weapon: S.show, frame: S.frame });
			S.raf = requestAnimationFrame(tick);
		};
		tick();
	}
	function close(){
		if(!S) return;
		cancelAnimationFrame(S.raf);
		document.removeEventListener('keydown', S.key, true);
		const bg = S.bg; S = null;
		bg.classList.remove('open');
		setTimeout(() => bg.remove(), 200);
	}
	root.SlotChooser = { open, close, isOpen: () => !!S };
})(window);
