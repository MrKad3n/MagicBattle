/* =============================================================
   Treasure chests — gear drops + open animation
   ============================================================= */
(function (global) {
	'use strict';

	const TREASURE = { cache: 1, jungleCache: 1, jungleVault: 1, vault: 1, specialCache: 1 };
	const flights = [];
	const sparks = [];

	const PALETTES = {
		fire: { wood: '#6b3514', dark: '#2c1408', lite: '#a85a24', band: '#d4b056', lock: '#f0d070', trim: '#ff6b35' },
		ice: { wood: '#5c7388', dark: '#243240', lite: '#c5dceb', band: '#e8f4ff', lock: '#8fe0ff', trim: '#cfeaf8' },
		earth: { wood: '#4a5a24', dark: '#1e2810', lite: '#7d9640', band: '#c9a227', lock: '#efe08a', trim: '#a6d67c' },
		jungle: { wood: '#4a5a24', dark: '#1e2810', lite: '#7d9640', band: '#c9a227', lock: '#efe08a', trim: '#a6d67c' }
	};

	function themeKey() {
		if (typeof DUNGEON_TYPE !== 'undefined' && DUNGEON_TYPE) return DUNGEON_TYPE;
		const d = (typeof dungeon !== 'undefined' && dungeon) || global.dungeon;
		if (d && d._jungle) return 'jungle';
		if (d && d._theme) return d._theme;
		return 'fire';
	}

	function palette() { return PALETTES[themeKey()] || PALETTES.fire; }

	function interacts() {
		const d = (typeof dungeon !== 'undefined' && dungeon) || global.dungeon;
		return (d && d.interactables) || [];
	}

	function rarityColor(rarity) {
		const colors = (global.GEAR_DATA && global.GEAR_DATA.RARITY_COLORS) || {};
		if (rarity === 'nightmare') return '#e070ff';
		return colors[rarity] || '#ffcc66';
	}

	function parseHex(hex) {
		const h = String(hex || '#ffcc66').replace('#', '');
		const n = parseInt(h.length === 3 ? h.split('').map(function (c) { return c + c; }).join('') : h, 16);
		return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
	}

	function rgba(hex, a) {
		const c = parseHex(hex);
		return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')';
	}

	function isChest(it) {
		return !!(it && (TREASURE[it.kind] || it._chest));
	}

	function rollTreasure(better) {
		if (typeof GearSystem === 'undefined' || !GearSystem.rollGearDrop) return null;
		const dung = (typeof DUNGEON_TYPE !== 'undefined') ? DUNGEON_TYPE : null;
		const difficulty = (typeof DIFFICULTY !== 'undefined' && DIFFICULTY) ? DIFFICULTY : 'normal';
		return GearSystem.rollGearDrop({ dungeon: dung, difficulty: difficulty, better: !!better });
	}

	function addSparks(x, y, color, n, power) {
		const pwr = power || 1;
		for (let i = 0; i < n; i++) {
			const a = Math.random() * Math.PI * 2;
			const s = (1.4 + Math.random() * 3.8) * pwr;
			sparks.push({
				x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1.2 * pwr,
				life: 16 + Math.floor(Math.random() * 18), max: 28, color: color, r: 1.4 + Math.random() * 2.2
			});
		}
	}

	function collect(inst, kind) {
		if (!inst) return;
		if (kind === 'gem' && typeof playerData !== 'undefined' && playerData) {
			if (!playerData.inventory) playerData.inventory = [];
			const existing = playerData.inventory.find(function (e) { return e.itemId === inst.itemId && !e.uid; });
			if (existing) existing.qty += inst.qty || 1;
			else playerData.inventory.push({ itemId: inst.itemId, qty: inst.qty || 1 });
			if (global.GearSystem && GearSystem.discoverGem) GearSystem.discoverGem(playerData, inst.itemId);
			try { localStorage.setItem('magicBattle_playerData', JSON.stringify(playerData)); } catch (e) {}
			return;
		}
		if (typeof addDroppedGear === 'function') addDroppedGear(inst, { silentFloat: true });
		else if (typeof playerData !== 'undefined' && playerData) {
			if (!playerData.inventory) playerData.inventory = [];
			playerData.inventory.push(inst);
			try { localStorage.setItem('magicBattle_playerData', JSON.stringify(playerData)); } catch (e) {}
		}
	}

	function spawnWorldDrop(x, y, spec) {
		if (!spec) return false;
		const color = spec.color || rarityColor(spec.rarity || 'rare');
		flights.push({
			x: x, y: y,
			vx: (Math.random() - 0.5) * 6.2,
			vy: -11.5 - Math.random() * 3.2,
			t: 0,
			inst: spec.inst,
			kind: spec.kind || 'gear',
			color: color,
			icon: spec.icon || '◆',
			name: spec.name || 'Rare find'
		});
		addSparks(x, y, color, 36, 2.15);
		if (typeof shakeScreen === 'function') shakeScreen(10, 18);
		if (typeof announceLoot === 'function' && spec.name) {
			announceLoot((spec.kind === 'gem' ? 'GEM ACQUIRED — ' : 'RARE FIND — ') + spec.name, color);
		} else if (typeof notify === 'function' && spec.name) {
			notify((spec.kind === 'gem' ? 'A gem erupts from the corpse — ' : 'Rare gear tears free — ') + spec.name);
		}
		return true;
	}

	function spawnFlight(it, chest) {
		if (!chest.inst) return;
		const x = it.x + (it.w || 70) / 2;
		const y = it.y + (it.h || 60) * 0.18;
		const def = GearSystem.itemDef ? GearSystem.itemDef(chest.inst.itemId) : null;
		spawnWorldDrop(x, y, {
			inst: chest.inst,
			kind: 'gear',
			color: chest.color,
			icon: (def && def.icon) || '◆',
			name: GearSystem.displayName ? GearSystem.displayName(chest.inst) : 'Item',
			rarity: chest.rarity
		});
	}

	function beginOpen(it, opts) {
		opts = opts || {};
		if (!it) return false;
		if (it._chest && it._chest.phase && it._chest.phase !== 'idle') return false;
		it.used = true;
		const better = !!(it.rare || opts.better || (global.DungeonEnv && DungeonEnv.blessings && DungeonEnv.blessings.fortune));
		const inst = opts.inst || rollTreasure(better);
		let rarity = 'common';
		if (inst && GearSystem.displayRarity) rarity = GearSystem.displayRarity(inst) || 'common';
		if (inst && inst.nightmare) rarity = 'nightmare';
		it._chest = {
			phase: 'shake',
			t: 0,
			inst: inst,
			rarity: rarity,
			color: rarityColor(rarity),
			lid: 0
		};
		if (typeof playerData !== 'undefined' && playerData && opts.gold) {
			playerData.gold = (playerData.gold || 0) + opts.gold;
			try { localStorage.setItem('magicBattle_playerData', JSON.stringify(playerData)); } catch (e) {}
		}
		if (opts.label && typeof notify === 'function') notify(opts.label);
		if (typeof shakeScreen === 'function') shakeScreen(4, 10);
		return true;
	}

	function updateFlights() {
		if (typeof player === 'undefined') return;
		const px = player.x + player.w / 2;
		const py = player.y + player.h / 2;
		for (let i = flights.length - 1; i >= 0; i--) {
			const f = flights[i];
			f.t++;
			if (f.t < 26) {
				f.x += f.vx;
				f.y += f.vy;
				f.vy += 0.52;
				if (f.t % 2 === 0) addSparks(f.x, f.y, f.color, 1, 0.45);
			} else {
				const k = Math.min(1, (f.t - 26) / 36);
				const ease = k * k;
				f.x += (px - f.x) * (0.14 + ease * 0.28);
				f.y += (py - f.y) * (0.14 + ease * 0.28);
				if (k >= 1 || Math.hypot(px - f.x, py - f.y) < 18) {
					collect(f.inst, f.kind);
					addSparks(px, py, f.color, 18, 1.35);
					if (typeof shakeScreen === 'function') shakeScreen(5, 10);
					flights.splice(i, 1);
				}
			}
		}
	}

	function updateSparks() {
		for (let i = sparks.length - 1; i >= 0; i--) {
			const s = sparks[i];
			s.life--;
			s.x += s.vx;
			s.y += s.vy;
			s.vy += 0.12;
			s.vx *= 0.97;
			if (s.life <= 0) sparks.splice(i, 1);
		}
	}

	function update() {
		const list = interacts();
		for (let i = 0; i < list.length; i++) {
			const it = list[i];
			const c = it && it._chest;
			if (!c || c.phase === 'open' || c.phase === 'idle') continue;
			c.t++;
			if (c.phase === 'shake') {
				if (c.t % 6 === 0) addSparks(it.x + (it.w || 70) / 2, it.y + (it.h || 60) * 0.35, c.color, 2, 0.35);
				if (c.t >= 42) { c.phase = 'glow'; c.t = 0; }
			} else if (c.phase === 'glow') {
				c.lid = Math.min(0.24, c.t / 48);
				if (c.t % 4 === 0) addSparks(it.x + (it.w || 70) / 2, it.y + (it.h || 60) * 0.22, c.color, 2, 0.55);
				if (c.t >= 54) { c.phase = 'burst'; c.t = 0; }
			} else if (c.phase === 'burst') {
				c.lid = Math.min(1, 0.24 + c.t / 10);
				if (c.t === 3) spawnFlight(it, c);
				if (c.t >= 20) { c.phase = 'open'; c.lid = 1; }
			}
		}
		updateFlights();
		updateSparks();
	}

	function roundRect(ctx, x, y, w, h, r) {
		const rr = Math.min(r, w / 2, h / 2);
		ctx.beginPath();
		ctx.moveTo(x + rr, y);
		ctx.lineTo(x + w - rr, y);
		ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
		ctx.lineTo(x + w, y + h - rr);
		ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
		ctx.lineTo(x + rr, y + h);
		ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
		ctx.lineTo(x, y + rr);
		ctx.quadraticCurveTo(x, y, x + rr, y);
		ctx.closePath();
	}

	function drawChest(ctx, it, sx, sy) {
		const pal = palette();
		const W = it.w || 70, H = it.h || 60;
		const c = it._chest;
		const used = !!it.used && !(c && c.phase && c.phase !== 'open' && c.phase !== 'idle');
		const lid = c ? (c.lid || 0) : 0;
		const color = (c && c.color) || pal.trim;
		let shakeX = 0, shakeR = 0;
		if (c && c.phase === 'shake') {
			shakeX = Math.sin(c.t * 1.7) * 3.4;
			shakeR = Math.sin(c.t * 2.1) * 0.06;
		} else if (c && c.phase === 'glow') {
			shakeX = Math.sin(c.t * 0.9) * 1.1;
		}

		const bw = W * 0.9;
		const bh = H * 0.5;
		const lidH = H * 0.3;
		const closed = !c && it.used && it.kind === 'vault';

		ctx.save();
		ctx.translate(sx + W / 2 + shakeX, sy + H);
		ctx.rotate(shakeR);

		ctx.fillStyle = 'rgba(0,0,0,0.28)';
		ctx.beginPath();
		ctx.ellipse(0, 2, bw * 0.48, 5, 0, 0, Math.PI * 2);
		ctx.fill();

		const idlePulse = 0.62 + Math.sin((typeof performance !== 'undefined' ? performance.now() : Date.now()) * 0.003 + (it.x || 0) * 0.01) * 0.2;
		const idle = ctx.createRadialGradient(0, -bh - 4, 2, 0, -bh - 4, W * 1.15);
		idle.addColorStop(0, rgba(color, used ? 0.06 : 0.22 * idlePulse));
		idle.addColorStop(1, rgba(color, 0));
		ctx.fillStyle = idle;
		ctx.beginPath();
		ctx.arc(0, -bh - 4, W * 1.15, 0, Math.PI * 2);
		ctx.fill();

		if (c && (c.phase === 'glow' || c.phase === 'burst' || c.phase === 'open')) {
			const g = ctx.createRadialGradient(0, -bh - 8, 4, 0, -bh - 8, W * (c.phase === 'burst' ? 1.4 : 0.85));
			g.addColorStop(0, rgba(color, c.phase === 'burst' ? 0.7 : 0.32));
			g.addColorStop(1, rgba(color, 0));
			ctx.fillStyle = g;
			ctx.beginPath();
			ctx.arc(0, -bh - 6, W * (c.phase === 'burst' ? 1.35 : 0.8), 0, Math.PI * 2);
			ctx.fill();
		}

		ctx.fillStyle = used && !c ? pal.dark : pal.wood;
		roundRect(ctx, -bw / 2, -bh, bw, bh, 5);
		ctx.fill();
		ctx.fillStyle = used && !c ? '#1a120c' : pal.dark;
		roundRect(ctx, -bw / 2 + 4, -bh + 6, bw - 8, bh - 10, 3);
		ctx.fill();
		ctx.fillStyle = used && !c ? '#3a3020' : pal.lite;
		ctx.fillRect(-bw / 2 + 3, -bh + 2, bw - 6, 4);

		ctx.fillStyle = pal.band;
		ctx.fillRect(-bw / 2 - 1, -bh * 0.52, bw + 2, 5);
		ctx.fillRect(-3, -bh + 4, 6, bh - 6);
		ctx.fillStyle = '#2a1c0c';
		ctx.fillRect(-1.4, -bh + 8, 2.8, bh - 14);

		const lockY = -bh * 0.18;
		ctx.fillStyle = pal.lock;
		roundRect(ctx, -7, lockY - 6, 14, 16, 3);
		ctx.fill();
		ctx.fillStyle = '#2a1c0c';
		ctx.beginPath();
		ctx.arc(0, lockY - 1, 2.4, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillRect(-1.1, lockY - 1, 2.2, 7);

		ctx.save();
		ctx.translate(0, -bh);
		ctx.rotate(-lid * 1.22);
		ctx.fillStyle = used && !c ? pal.dark : pal.lite;
		roundRect(ctx, -bw / 2 - 1, -lidH, bw + 2, lidH + 6, 7);
		ctx.fill();
		ctx.fillStyle = pal.wood;
		roundRect(ctx, -bw / 2 + 3, -lidH + 5, bw - 6, lidH - 4, 5);
		ctx.fill();
		ctx.fillStyle = pal.band;
		ctx.fillRect(-bw / 2 - 1, -4, bw + 2, 5);
		ctx.fillRect(-3, -lidH + 4, 6, lidH);
		ctx.restore();

		if (c && lid > 0.02) {
			const gap = 6 + lid * 16;
			ctx.save();
			ctx.globalCompositeOperation = 'lighter';
			ctx.fillStyle = rgba(color, 0.22 + lid * 0.45);
			ctx.beginPath();
			ctx.moveTo(-bw * 0.28, -bh);
			ctx.lineTo(bw * 0.28, -bh);
			ctx.lineTo(bw * 0.12, -bh - gap - lid * 22);
			ctx.lineTo(-bw * 0.12, -bh - gap - lid * 22);
			ctx.closePath();
			ctx.fill();
			if (c.phase === 'glow' || c.phase === 'burst') {
				for (let i = 0; i < 5; i++) {
					const ang = -Math.PI / 2 + (i - 2) * 0.22;
					const len = (c.phase === 'burst' ? 70 : 38) + i * 6;
					ctx.strokeStyle = rgba(color, c.phase === 'burst' ? 0.55 : 0.28);
					ctx.lineWidth = c.phase === 'burst' ? 3 : 1.6;
					ctx.beginPath();
					ctx.moveTo(0, -bh - 2);
					ctx.lineTo(Math.cos(ang) * len, -bh + Math.sin(ang) * len);
					ctx.stroke();
				}
			}
			ctx.restore();
		}

		if (closed) {
			ctx.fillStyle = 'rgba(0,0,0,0.25)';
			roundRect(ctx, -bw / 2, -bh - lidH + 4, bw, bh + lidH - 4, 6);
			ctx.fill();
		}

		ctx.restore();
	}

	function drawInteractable(ctx, it, sx, sy) {
		if (!isChest(it)) return false;
		drawChest(ctx, it, sx, sy);
		return true;
	}

	function drawFx(ctx, camx, camy) {
		for (let i = 0; i < sparks.length; i++) {
			const s = sparks[i];
			const a = Math.max(0, s.life / (s.max || 24));
			ctx.fillStyle = rgba(s.color, 0.15 + a * 0.85);
			ctx.beginPath();
			ctx.arc(s.x - camx, s.y - camy, s.r * (0.6 + a), 0, Math.PI * 2);
			ctx.fill();
		}
		for (let i = 0; i < flights.length; i++) {
			const f = flights[i];
			const x = f.x - camx, y = f.y - camy;
			const pulse = 0.75 + Math.sin(f.t * 0.4) * 0.25;
			const g = ctx.createRadialGradient(x, y, 2, x, y, 34 * pulse);
			g.addColorStop(0, rgba(f.color, 0.85));
			g.addColorStop(1, rgba(f.color, 0));
			ctx.fillStyle = g;
			ctx.beginPath();
			ctx.arc(x, y, 36 * pulse, 0, Math.PI * 2);
			ctx.fill();
			ctx.fillStyle = '#fff';
			ctx.beginPath();
			ctx.arc(x, y, 10, 0, Math.PI * 2);
			ctx.fill();
			ctx.font = 'bold 22px Arial';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText(f.icon, x, y + 1);
		}
	}

	global.ChestLoot = {
		beginOpen: beginOpen,
		spawnWorldDrop: spawnWorldDrop,
		update: update,
		drawInteractable: drawInteractable,
		drawFx: drawFx,
		isTreasure: function (kind) { return !!TREASURE[kind]; },
		isChest: isChest
	};
})(typeof window !== 'undefined' ? window : globalThis);
