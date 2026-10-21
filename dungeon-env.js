/* =============================================================
   Dungeon environment runtime — meters, hazards, choices, wardens
   ============================================================= */
(function(global){
	const TILE = 40;
	const Env = {
		ready: false,
		heat: 0,
		maxHeat: 100,
		visited: Object.create(null),
		currentRoom: null,
		banner: { text:'', t:0 },
		choiceOpen: false,
		choiceTarget: null,
		modifiers: { wardenSlain:false, knightSlain:false, furnaceOverload:false, shortcut:false },
		blizzardVis: 0,
		lootMult: 1,
		objective: '',
		blessings: { cinder:false, sink:false, step:false, fortune:false },
		corePick: null,
		trial: null,
	};

	global.DUNGEON_THEME_INFO = global.DUNGEON_THEME_INFO || {};
	global.DUNGEON_THEME_INFO.fire = global.DUNGEON_THEME_INFO.fire || { enemies: [{ type:'imp' }, { type:'fireSprite' }, { type:'flameSerpent' }, { type:'emberMage' }, { type:'magmaGolem' }, { type:'cinderBeetle' }, { type:'furnaceLeech' }, { type:'ashRevenant' }, { type:'magmaHarvester' }] };
	global.DUNGEON_THEME_INFO.ice = global.DUNGEON_THEME_INFO.ice || { enemies: [{ type:'frostWraith' }, { type:'iceArcher' }, { type:'snowBeast' }, { type:'cryoMage' }, { type:'glacierSentinel' }, { type:'frostMantis' }, { type:'glacierEel' }, { type:'crystalScarab' }, { type:'snowboundMimic' }] };
	global.DUNGEON_THEME_INFO.jungle = global.DUNGEON_THEME_INFO.jungle || { enemies: [{ type:'vineCrawler' }, { type:'caveSpider' }, { type:'rockGolem' }, { type:'crystalMage' }, { type:'mudElemental' }, { type:'thornWolf' }, { type:'sporeFungus' }, { type:'mossWraith' }, { type:'willowWisp' }, { type:'glowBeetle' }, { type:'stalactiteBat' }, { type:'skyVine' }, { type:'windSylph' }, { type:'barkbackBeetle' }, { type:'pollenMoth' }, { type:'rootParasite' }, { type:'jungleChameleon' }] };

	function getDungeon(){
		const d = (typeof dungeon !== 'undefined' && dungeon) || global.dungeon;
		if(d && d.worldW) return d;
		return null;
	}
	function theme(){
		const d = getDungeon();
		return d && d._jungle ? 'jungle' : (d && d._theme);
	}
	/* The Glacial Reach owns its own runtime. When it is loaded this
	   file becomes a dispatch layer for ice: tile plumbing and the
	   shared HUD stay here, everything else goes to IceWorld so no
	   fire behaviour can bleed into the ice dungeon. */
	function ice(){
		const d = getDungeon();
		return (d && d._theme === 'ice' && global.IceWorld) ? global.IceWorld : null;
	}
	/* The Living Wilds is also isolated behind a dedicated runtime.
	   Shared tile, gate, loot, and HUD plumbing stays here. */
	function jungle(){
		const d = getDungeon();
		return (d && d._jungle && global.JungleWorld) ? global.JungleWorld : null;
	}
	function rooms(){ return (getDungeon() && getDungeon().rooms) || []; }
	function hazards(){ return (getDungeon() && getDungeon().hazards) || []; }
	function platforms(){ return (getDungeon() && getDungeon().platforms) || []; }
	function interacts(){ return (getDungeon() && getDungeon().interactables) || []; }

	function roomAt(x, y){
		const list = rooms();
		for(let i = list.length - 1; i >= 0; i--){
			const r = list[i];
			if(x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h) return r;
		}
		return null;
	}

	function stampTiles(x, y, w, h, air, opts){
		const sc = Math.floor(x / TILE), ec = Math.ceil((x + w) / TILE);
		const sr = Math.floor(y / TILE), er = Math.ceil((y + h) / TILE);
		for(let r = sr; r < er && r < MAP_ROWS; r++){
			for(let c = sc; c < ec && c < MAP_COLS; c++){
				if(r >= 0 && c >= 0) tileMap[r][c] = air ? 1 : 0;
			}
		}
		if(typeof computeTileEdgesRect === 'function'){
			computeTileEdgesRect(sc - 1, sr - 1, ec, er);
		}
		if(!(opts && opts.skipFluid) && global.DungeonFluid && global.DungeonFluid.invalidate){
			global.DungeonFluid.invalidate(x, w);
		}
	}

	function openingRects(r){
		/* Ice and fire already author extraOpenings at connect time.
		   Rebuilding a second, deeper throat punched holes through
		   decks, lava, and decorations beside every door. */
		if((theme() === 'ice' || theme() === 'fire' || theme() === 'jungle') && r.extraOpenings && r.extraOpenings.length){
			const authored = r.extraOpenings.filter(function(op){ return op && !op._secret; });
			if(r.floorHoles){
				for(const hole of r.floorHoles){
					authored.push({ x: hole.x, y: r.y + r.h - 8, w: hole.w, h: 16 });
				}
			}
			return authored;
		}
		const used = r.usedExits || {};
		const ex = r.exits || {};
		const out = [];
		const HALL_H = 240;
		const sn = (n) => Math.round(n / TILE) * TILE;
		const depth = theme() === 'fire' ? 80 : Math.max(240, ((r.raisedFloor || 0) + 200));
		function sideY(side){
			const doorH = (side && side.h) || HALL_H;
			let y = r.y + (side && side.y != null ? side.y : Math.round((r.h - doorH) * 0.42));
			const walk = r.y + r.h - (r.raisedFloor || 0);
			if(side && side.seat === 'floor'){
				y = walk - doorH;
			} else if(r.raisedFloor && y + doorH > walk + 8){
				y = walk - doorH + 16;
			}
			return sn(Math.max(r.y + 40, y));
		}
		if(used.left && ex.left){
			const doorH = ex.left.h || HALL_H;
			out.push({ x: r.x - 48, y: sideY(ex.left), w: 48 + depth, h: doorH });
		}
		if(used.right && ex.right){
			const doorH = ex.right.h || HALL_H;
			out.push({ x: r.x + r.w - depth, y: sideY(ex.right), w: depth + 48, h: doorH });
		}
		if(used.top && ex.top){
			out.push({ x: sn(r.x + (ex.top.x != null ? ex.top.x : r.w / 2 - 100)), y: r.y - 48, w: ex.top.w || 200, h: 48 + depth });
		}
		if(used.bottom && ex.bottom){
			out.push({ x: sn(r.x + (ex.bottom.x != null ? ex.bottom.x : r.w / 2 - 100)), y: r.y + r.h - depth, w: ex.bottom.w || 200, h: depth + 48 });
		}
		if(r.extraOpenings){
			for(const op of r.extraOpenings) out.push(op);
		}
		if(r.floorHoles){
			for(const hole of r.floorHoles){
				out.push({ x: hole.x, y: r.y + r.h - 8, w: hole.w, h: 16 });
			}
		}
		return out;
	}

	function punchAllOpenings(){
		for(const r of rooms()){
			for(const op of openingRects(r)){
				stampTiles(op.x, op.y, op.w, op.h, true);
			}
		}
	}

	function sealRoomShells(){
		const d = getDungeon();
		if(!d || (d._theme !== 'fire' && d._theme !== 'ice')) return;
		for(const r of rooms()){
			stampTiles(r.x, r.y + r.h - 8, r.w, 64, false);
			stampTiles(r.x, r.y - 40, r.w, 56, false);
			stampTiles(r.x - 40, r.y, 56, r.h, false);
			stampTiles(r.x + r.w - 16, r.y, 56, r.h, false);
		}
		punchAllOpenings();
	}

	function stampPitFloors(){
		for(const r of rooms()){
			if(!r.pitFloors) continue;
			for(const f of r.pitFloors) stampTiles(f.x, f.y, f.w, f.h, false);
		}
	}

	/* Ice rooms are not rectangles: their air volume is the union of the
	   template's cells, so clearing the bounding box would erase the
	   authored terraces and galleries. Clear per cell instead. */
	function clearRoomInteriors(){
		for(const r of rooms()){
			if(r.cells && r.cells.length){
				for(const cell of r.cells) stampTiles(cell.x + 16, cell.y + 16, cell.w - 32, cell.h - 32, true);
			} else {
				stampTiles(r.x + 20, r.y + 20, r.w - 40, r.h - 40, true);
			}
		}
	}

	/* Authored solid masses carved back into the air volume. */
	function stampRoomSolids(){
		for(const r of rooms()){
			if(!r.solids) continue;
			for(const s of r.solids) stampTiles(s.x, s.y, s.w, s.h, false);
		}
	}

	function stampRaisedFloors(){
		for(const r of rooms()){
			if(!r.raisedFloor) continue;
			stampTiles(r.x, r.y + r.h - r.raisedFloor, r.w, r.raisedFloor, false);
		}
		if(typeof computeTileEdges === 'function') computeTileEdges();
	}

	function stampPlatforms(){
		if(!IS_DUNGEON || !getDungeon()) return;
		for(const p of platforms()){
			if(p.kind === 'move' || p.kind === 'raft' || p.kind === 'orbit') continue;
			if(theme() === 'fire' && platformBlocksPassage(p)) continue;
			stampTiles(p.x, p.y, p.w, p.h, false);
			p._stamped = true;
		}
		const bossPlats = getDungeon()._bossPlatforms;
		if(bossPlats){
			for(const plat of bossPlats){
				stampTiles(plat.x, plat.y, plat.w, TILE, false);
			}
		}
		if(typeof computeTileEdges === 'function') computeTileEdges();
	}

	function addHeat(n, why){
		const before = Env.heat;
		Env.heat = Math.max(0, Math.min(Env.maxHeat, Env.heat + n));
		if(Env.heat !== before && why){
			if(typeof dmgNumbers !== 'undefined'){
				dmgNumbers.push({ x:player.x + player.w / 2, y:player.y - 36, text:why, age:0, color: meterColor() });
			}
		}
		Env.lootMult = 1 + Env.heat * 0.012 + (Env.blessings.fortune ? 0.18 : 0);
		updateMeterHUD();
	}

	function meterColor(){
		const t = theme();
		if(t === 'ice') return '#88ddff';
		if(t === 'jungle') return '#91df78';
		if(t === 'earth') return '#a8d868';
		if(t === 'iron') return '#e0a060';
		return '#ff8844';
	}

	function updateMeterHUD(){
		const el = document.getElementById('dungeonMeter');
		if(!el || !getDungeon()) return;
		const label = getDungeon()._meterLabel || 'Heat';
		const pct = Math.round(Env.heat);
		el.style.display = IS_DUNGEON ? 'block' : 'none';
		const t = theme();
		let hint = pct + ' — deeper heat, worse rooms, better loot';
		if(t === 'ice'){
			hint = ice() ? ice().meterHint()
				: pct + ' — ' + (pct >= 70 ? 'High Frost' : (pct >= 35 ? 'Moderate Frost' : 'Low Frost')) + '. Warm yourself when you can.';
		} else if(t === 'jungle'){
			hint = jungle() ? jungle().meterHint() : pct + ' — the ecosystem is becoming aware of you';
		}
		el.innerHTML = '<div style="font:11px Arial;color:#ccc;margin-bottom:3px">' + label + '</div>' +
			'<div style="width:160px;height:10px;background:#111;border:1px solid #444;border-radius:4px;overflow:hidden">' +
			'<div style="width:' + pct + '%;height:100%;background:' + meterColor() + ';box-shadow:0 0 8px ' + meterColor() + '"></div></div>' +
			'<div style="font:10px Arial;color:#aaa;margin-top:2px">' + hint + '</div>';
	}

	function showBanner(text){
		if(/boss|warped|defeat|awaken|guardian|warden|ignaroth|frostbound|knight falls|colossus|survive the|the way opens/i.test(String(text))) return;
		Env.banner = { text: text, t: 160 };
		if(typeof notify === 'function') notify(text);
	}

	function hazardDmg(){
		const base = 7 + Math.floor(Env.heat / 20);
		return Math.round(base * (typeof DIFF_DMG_MULT === 'number' ? DIFF_DMG_MULT : 1));
	}

	function playerInRect(x, y, w, h){
		return player.x + player.w > x && player.x < x + w && player.y + player.h > y && player.y < y + h;
	}

	function channelRects(ch){
		const hot = ch.safe === 'left' ? ch.right : ch.left;
		return { hot, safe: ch.safe === 'left' ? ch.left : ch.right };
	}

	function drawDungeonPlatform(ctx, p){
		const d = getDungeon() || {};
		const x = p.x - camera.x, y = p.y - camera.y;
		const warn = (p.kind === 'collapse' || p.kind === 'pillar') && (p._tick || 0) > 10;
		ctx.fillStyle = d.wallColor2 || '#6a2a12';
		ctx.fillRect(x, y, p.w, p.h);
		ctx.fillStyle = d.wallColor || '#4a1a0a';
		ctx.fillRect(x, y + Math.max(6, p.h - 8), p.w, Math.min(8, p.h));
		ctx.fillStyle = d.floorHighlight || '#9a5630';
		ctx.fillRect(x, y, p.w, 5);
		ctx.fillStyle = d.wallEdge || '#8a3e1a';
		ctx.fillRect(x, y, p.w, 2);
		ctx.fillStyle = 'rgba(0,0,0,0.22)';
		for(let i = 40; i < p.w; i += 40) ctx.fillRect(x + i, y, 1, p.h);
		if(theme() === 'ice'){
			ctx.fillStyle = 'rgba(160,220,255,0.18)';
			ctx.fillRect(x + 6, y + 6, Math.max(8, p.w - 12), 3);
		} else {
			ctx.fillStyle = 'rgba(255,140,40,0.16)';
			ctx.fillRect(x + 6, y + 6, Math.max(8, p.w - 12), 3);
		}
		if(warn){
			const pulse = 0.35 + 0.35 * Math.sin((typeof performance !== 'undefined' ? performance.now() : Date.now()) * 0.02);
			ctx.strokeStyle = 'rgba(255,180,60,' + pulse + ')';
			ctx.lineWidth = 2;
			ctx.strokeRect(x - 1, y - 1, p.w + 2, p.h + 2);
		}
	}

	function drawLavaPool(ctx, x, y, w, h, seed){
		if(w < 8 || h < 4) return;
		if(typeof MoltenLava !== 'undefined' && MoltenLava.active()){ MoltenLava.pool(ctx, x, y, w, h, seed); return; }
		const camx = camera.x, camy = camera.y;
		const sx = x - camx, sy = y - camy;
		if(sx + w < -50 || sx > canvas.width + 50 || sy + h < -40 || sy > canvas.height + 40) return;
		const t = (typeof performance !== 'undefined' ? performance.now() : Date.now()) * 0.001;
		seed = seed || x;

		const glow = ctx.createLinearGradient(sx, sy - 22, sx, sy + h);
		glow.addColorStop(0, 'rgba(255,90,10,0)');
		glow.addColorStop(0.45, 'rgba(255,70,0,0.2)');
		glow.addColorStop(1, 'rgba(160,25,0,0.12)');
		ctx.fillStyle = glow;
		ctx.fillRect(sx - 6, sy - 20, w + 12, h);

		const surfaceH = Math.min(h, 30);
		const bodyH = Math.max(0, h - surfaceH);

		if(bodyH > 0){
			const body = ctx.createLinearGradient(sx, sy, sx, sy + h);
			body.addColorStop(0, '#ff9a28');
			body.addColorStop(0.18, '#ff5c08');
			body.addColorStop(0.45, '#c41c00');
			body.addColorStop(0.75, '#7a1000');
			body.addColorStop(1, '#4a0800');
			ctx.fillStyle = body;
			ctx.fillRect(sx, sy + surfaceH - 2, w, bodyH + 2);
			const stepsB = Math.max(8, Math.floor(w / 26));
			for(let i = 0; i < stepsB; i++){
				const bw = w / stepsB + 3;
				const bx = sx + i * (w / stepsB) - 1;
				const pulse = 0.28 + 0.22 * Math.sin(t * 2.5 + i * 0.75 + seed * 0.02);
				const hue = 14 + (Math.sin(seed * 0.06 + i * 1.4) * 0.5 + 0.5) * 20;
				ctx.fillStyle = 'hsla(' + hue + ',100%,' + (34 + pulse * 18) + '%,' + (0.18 + pulse * 0.2) + ')';
				ctx.fillRect(bx, sy + surfaceH - 2, bw, bodyH + 2);
			}
			ctx.fillStyle = 'rgba(255,214,90,' + (0.08 + 0.08 * Math.sin(t * 3.1 + seed)) + ')';
			ctx.fillRect(sx, sy + surfaceH, w, 8);
			const bubbles = Math.floor(w / 28);
			for(let i = 0; i < bubbles; i++){
				const bx = sx + ((i * 47 + seed * 0.17) % Math.max(8, w - 6));
				const bob = (t * 14 + i * 11 + seed) % Math.max(8, bodyH);
				ctx.fillStyle = i % 2 ? 'rgba(255,232,130,0.45)' : 'rgba(255,130,36,0.35)';
				ctx.beginPath();
				ctx.arc(bx + 4, sy + h - 6 - bob * 0.35, 1.4 + (i % 3), 0, Math.PI * 2);
				ctx.fill();
			}
		}

		ctx.save();
		ctx.beginPath();
		ctx.moveTo(sx, sy + surfaceH + 2);
		ctx.lineTo(sx, sy + 5);
		const steps = Math.max(8, Math.floor(w / 26));
		for(let i = 0; i <= steps; i++){
			const px = sx + (w * i) / steps;
			const wave = Math.sin(t * 2.2 + seed * 0.012 + i * 0.85) * 3.4 + Math.sin(t * 3.6 + i * 1.6) * 1.5;
			ctx.lineTo(px, sy + 3 + wave);
		}
		ctx.lineTo(sx + w, sy + surfaceH + 2);
		ctx.closePath();
		ctx.clip();

		const base = ctx.createLinearGradient(sx, sy, sx, sy + surfaceH);
		base.addColorStop(0, '#ff9a28');
		base.addColorStop(0.2, '#ff5c08');
		base.addColorStop(0.55, '#c41c00');
		base.addColorStop(1, '#6a0c00');
		ctx.fillStyle = base;
		ctx.fillRect(sx, sy, w, surfaceH + 4);

		for(let i = 0; i < steps; i++){
			const bw = w / steps + 3;
			const bx = sx + i * (w / steps) - 1;
			const pulse = 0.3 + 0.25 * Math.sin(t * 2.5 + i * 0.75 + seed * 0.02);
			const hue = 14 + (Math.sin(seed * 0.06 + i * 1.4) * 0.5 + 0.5) * 20;
			ctx.fillStyle = 'hsla(' + hue + ',100%,' + (38 + pulse * 20) + '%,' + (0.2 + pulse * 0.22) + ')';
			ctx.fillRect(bx, sy, bw, surfaceH + 2);
		}

		ctx.fillStyle = 'rgba(255,214,90,' + (0.2 + 0.14 * Math.sin(t * 3.1 + seed)) + ')';
		ctx.fillRect(sx, sy + 2, w, Math.max(3, surfaceH * 0.35));

		const bubbles = Math.floor(w / 32);
		for(let i = 0; i < bubbles; i++){
			const bx = sx + ((i * 47 + seed * 0.17) % Math.max(8, w - 6));
			const bob = (t * 16 + i * 13 + seed) % (surfaceH + 6);
			ctx.fillStyle = i % 2 ? 'rgba(255,232,130,0.72)' : 'rgba(255,130,36,0.5)';
			ctx.beginPath();
			ctx.arc(bx + 4, sy + surfaceH - 2 - bob, 1.5 + (i % 3), 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.restore();
	}

	function drawLavaBlob(ctx, x, y, r, seed){
		const camx = camera.x, camy = camera.y;
		const bx = x - camx, by = y - camy;
		if(bx < -40 || bx > canvas.width + 40 || by < -40 || by > canvas.height + 40) return;
		const t = (typeof performance !== 'undefined' ? performance.now() : Date.now()) * 0.001;
		const wob = 1 + Math.sin(t * 10 + (seed || x)) * 0.12;
		const g = ctx.createRadialGradient(bx - r * 0.25, by - r * 0.3, 1, bx, by, r * 1.35 * wob);
		g.addColorStop(0, 'rgba(255,232,140,0.95)');
		g.addColorStop(0.28, 'rgba(255,150,36,0.92)');
		g.addColorStop(0.62, 'rgba(220,50,0,0.88)');
		g.addColorStop(1, 'rgba(90,10,0,0)');
		ctx.fillStyle = g;
		ctx.beginPath();
		ctx.arc(bx, by, r * 1.35 * wob, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = 'rgba(255,210,80,0.7)';
		ctx.beginPath();
		ctx.ellipse(bx - r * 0.22, by - r * 0.28, r * 0.38, r * 0.22, -0.4, 0, Math.PI * 2);
		ctx.fill();
	}

	function drawGeyserJet(ctx, g, surfaceY){
		const h = g.height || 0;
		if(h < 8) return;
		const camx = camera.x, camy = camera.y;
		const t = (typeof performance !== 'undefined' ? performance.now() : Date.now()) * 0.001;
		const cx = g.x + g.w / 2 - camx;
		const by = surfaceY - camy;
		const top = by - h;
		const seed = g.x;
		ctx.save();
		ctx.beginPath();
		const steps = 14;
		for(let i = 0; i <= steps; i++){
			const u = i / steps;
			const yy = by - h * u;
			const swell = (1 - u * 0.55) * (g.w * 0.55 + Math.sin(t * 16 + seed + u * 9) * 7);
			ctx.lineTo(cx - swell, yy);
		}
		for(let i = steps; i >= 0; i--){
			const u = i / steps;
			const yy = by - h * u;
			const swell = (1 - u * 0.55) * (g.w * 0.55 + Math.sin(t * 16 + seed + 2 + u * 9) * 7);
			ctx.lineTo(cx + swell, yy);
		}
		ctx.closePath();
		const grad = ctx.createLinearGradient(cx, by, cx, top);
		grad.addColorStop(0, 'rgba(255,90,8,0.96)');
		grad.addColorStop(0.22, 'rgba(255,140,24,0.9)');
		grad.addColorStop(0.55, 'rgba(210,40,0,0.72)');
		grad.addColorStop(1, 'rgba(255,210,80,0.08)');
		ctx.fillStyle = grad;
		ctx.fill();
		ctx.fillStyle = 'rgba(255,230,130,0.55)';
		ctx.beginPath();
		ctx.moveTo(cx - 5, by);
		for(let i = 0; i <= steps; i++){
			const u = i / steps;
			ctx.lineTo(cx + Math.sin(t * 18 + u * 8) * 3, by - h * u);
		}
		ctx.lineTo(cx + 5, by);
		ctx.closePath();
		ctx.fill();
		ctx.restore();
		for(let i = 0; i < 5; i++){
			const u = (t * 1.6 + i * 0.18 + seed * 0.01) % 1;
			drawLavaBlob(ctx, g.x + g.w / 2 + Math.sin(t * 9 + i) * 10, surfaceY - h * u, 4 + (i % 3), seed + i);
		}
	}

	function drawHazardGlyph(ctx, wx, wy){
		const sx = wx - camera.x, sy = wy - camera.y;
		const pulse = 0.62 + 0.38 * Math.sin((typeof performance !== 'undefined' ? performance.now() : Date.now()) * 0.014);
		ctx.save();
		ctx.font = 'bold 30px sans-serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'bottom';
		ctx.fillStyle = 'rgba(0,0,0,' + (0.5 * pulse) + ')';
		ctx.fillText('\u26A0', sx + 2, sy + 2);
		ctx.fillStyle = 'rgba(255,210,40,' + pulse + ')';
		ctx.fillText('\u26A0', sx, sy);
		ctx.restore();
	}

	function burnPlayer(){
		if(player.iFrames > 0) return;
		const t = theme();
		if(t === 'ice'){
			const resist = Env.blessings.cinder ? 0.62 : 1;
			damagePlayer(Math.max(3, Math.round(hazardDmg() * resist)), [{ type:'freeze', dmg: Env.blessings.cinder ? 1 : 2, interval:40, ticks:3, color:'#88ddff' }]);
			player._iceDrag = Math.max(player._iceDrag || 0, 0.28);
		} else if(t === 'earth'){
			damagePlayer(hazardDmg() - 1, [{ type:'poison', dmg:2, interval:40, ticks:3, color:'#88cc44' }]);
		} else {
			const step = Env.blessings.step ? 0.55 : 1;
			damagePlayer(Math.max(3, Math.round(hazardDmg() * step)), [{ type:'burn', dmg: Env.blessings.step ? 1 : 3, interval:30, ticks: Env.blessings.step ? 2 : 3, color:'#ff4400' }]);
		}
	}

	function geyserBurn(){
		if(player.iFrames > 0) return;
		const step = Env.blessings.step ? 0.5 : 1;
		const dmg = Math.max(22, Math.round((hazardDmg() * 3.4 + 16) * step));
		damagePlayer(dmg, [{ type:'burn', dmg: Env.blessings.step ? 3 : 7, interval:22, ticks: Env.blessings.step ? 3 : 5, color:'#ff3300' }]);
	}

	function tickGeyser(g, surfaceY, on, heatBoost){
		g.blobs = g.blobs || [];
		g._t = (g._t || (g.x * 0.07)) + heatBoost;
		const period = 118;
		const burst = 72;
		const warn = 26;
		const cyc = g._t % period;
		g.warnOn = on && cyc > period - warn - burst && cyc <= period - burst;
		g.hot = on && cyc > period - burst;
		g.height = 0;
		if(g.hot){
			const u = (cyc - (period - burst)) / burst;
			let k = 0;
			if(u < 0.16) k = u / 0.16;
			else if(u < 0.7) k = 0.86 + Math.sin(g._t * 0.35) * 0.14;
			else k = Math.max(0, 1 - (u - 0.7) / 0.3);
			g.height = (g.columnH || 280) * k;
			const jet = g._wardenJet ? 1.55 : 1;
			if((g._t | 0) % 3 === 0 && k > 0.2){
				g.blobs.push({
					x: g.x + g.w / 2 + (Math.random() - 0.5) * 18,
					y: surfaceY + 4,
					vx: (Math.random() - 0.5) * 2.4,
					vy: (-7.5 - Math.random() * 5.5) * jet,
					r: 5 + Math.random() * 6,
					life: 36 + Math.random() * 18,
				});
			}
			if(g.height > 12 && playerInRect(g.x - 10, surfaceY - g.height, g.w + 20, g.height + 14)) geyserBurn();
		} else if(g.warnOn && (g._t | 0) % 6 === 0){
			g.blobs.push({
				x: g.x + g.w / 2 + (Math.random() - 0.5) * 12,
				y: surfaceY + 2,
				vx: (Math.random() - 0.5) * 1.4,
				vy: -3.2 - Math.random() * 1.6,
				r: 3 + Math.random() * 3,
				life: 18,
			});
		}
		for(let i = g.blobs.length - 1; i >= 0; i--){
			const b = g.blobs[i];
			b.life--;
			b.x += b.vx;
			b.y += b.vy;
			b.vy += 0.28;
			if(Math.hypot((player.x + player.w / 2) - b.x, (player.y + player.h / 2) - b.y) < b.r + 14){
				geyserBurn();
				g.blobs.splice(i, 1);
				continue;
			}
			if(b.life <= 0 || b.y > surfaceY + 40) g.blobs.splice(i, 1);
		}
	}

	function lavaVolumes(){
		if(global.DungeonFluid && global.DungeonFluid.ready) return [];
		const out = [];
		for(const hz of hazards()){
			if(hz._fluidConsumed) continue;
			if(hz.type === 'channel'){
				if(hz.left) out.push({ x:hz.left.x, y:hz.y, w:hz.left.w, h:hz.h });
				if(hz.right) out.push({ x:hz.right.x, y:hz.y, w:hz.right.w, h:hz.h });
			}
		}
		const d = getDungeon();
		if(d && d.decorations){
			for(const dec of d.decorations){
				if(dec._fluidConsumed) continue;
				if(dec.type === 'lava') out.push({ x:dec.x, y:dec.y, w:dec.w, h:dec.h });
			}
		}
		return out;
	}

	function applyJungleSwim(){
		const cityWater = typeof IS_CITY !== 'undefined' && IS_CITY;
		if(!player) return;
		if(!cityWater && (!IS_DUNGEON || theme() !== 'jungle')){
			player.inWater = false;
			return;
		}
		let water = null;
		if(global.DungeonFluid && global.DungeonFluid.ready){
			const hit = global.DungeonFluid.hits(player.x, player.y, player.w, player.h, 'water');
			if(hit) water = { x:hit.x, y:hit.y, w:hit.w, h:hit.h, type:'water', current:0 };
		}
		for(const h of hazards()){
			if(!h) continue;
			if(h.type === 'water'){
				if(playerInRect(h.x, h.y, h.w, h.h)){ if(!water) water = h; else if(h.current) water.current = h.current; if(h.current) break; }
			}else if(h.type === 'waterfall'){
				if(playerInRect(h.x, h.y, h.w, h.h)){ water = h; break; }
			}else if(h.type === 'flood' && !h.drained && h.level != null){
				const r = rooms()[h.roomId];
				const bottom = r ? r.y + r.h : h.y0 + 300;
				if(playerInRect(h.x, h.level, h.w, bottom - h.level)){ if(!water) water = h; }
			}
		}
		const wasIn = !!player.inWater;
		player.inWater = !!water;
		if(!water) return;
		if(player.onGround) player.y -= 3;
		player.onGround = false;
		const g = (typeof GRAVITY === 'number' ? GRAVITY : 0.55);
		player.vy -= g * 0.88;
		const submerged = (player.y + player.h * 0.45) - water.y;
		if(submerged > 18) player.vy -= 0.22;
		if(water.type === 'waterfall') player.vy += (water.force || 1) * 0.28;
		else player.vx += (water.current || 0) * 0.16;
		if(player.vy > 2.0) player.vy = 2.0;
		if(player.vy < -5.6) player.vy = -5.6;
		player.vx *= 0.88;
		if(typeof keys !== 'undefined'){
			if(keys['w'] || keys['arrowup'] || keys[' ']) player.vy = -3.8;
			if(keys['s'] || keys['arrowdown']) player.vy = 4.1;
		}
		if(!wasIn && typeof particles !== 'undefined'){
			for(let i = 0; i < 10; i++){
				const ang = Math.random() * Math.PI * 2;
				particles.push({
					x:player.x + player.w / 2, y:water.y + 6,
					vx:Math.cos(ang) * 2.4, vy:-1.2 - Math.random() * 2.2,
					life:18 + Math.random() * 16, maxLife:34, r:2 + Math.random() * 3,
					color:{r:160,g:230,b:210}
				});
			}
		}
	}

	function onChannelSafeSide(){
		for(const hz of hazards()){
			if(!hz || hz.type !== 'channel') continue;
			const { safe } = channelRects(hz);
			if(!safe) continue;
			const y = hz.y != null ? hz.y : 0;
			if(playerInRect(safe.x, y - 90, safe.w, (hz.h || 40) + 180)) return true;
		}
		return false;
	}

	function applyLavaSwim(){
		if(!IS_DUNGEON || theme() !== 'fire') { if(player) player.inLava = false; return; }
		let inLava = false;
		if(global.DungeonFluid && global.DungeonFluid.ready){
			inLava = !!global.DungeonFluid.hits(player.x, player.y, player.w, player.h, 'lava');
		} else {
			for(const v of lavaVolumes()){
				if(playerInRect(v.x, v.y, v.w, v.h)){ inLava = true; break; }
			}
		}
		player.inLava = inLava;
		if(!inLava) return;
		player.onGround = false;
		const g = (typeof GRAVITY === 'number' ? GRAVITY : 0.55);
		player.vy -= g * 0.7;
		if(player.vy > 2) player.vy = 2;
		if(player.vy < -6) player.vy = -6;
		if(keys['w'] || keys['arrowup'] || keys[' ']) player.vy = -3.5;
		if(keys['s'] || keys['arrowdown']) player.vy = 5;
	}

	function objectiveFor(r){
		if(!r) return '';
		if(r.cleared && r.kind !== 'boss') return 'ROOM CLEARED — MOVE ON';
		if(jungle() && jungle().liveObjective){
			const live = jungle().liveObjective(r);
			if(live) return live;
		}
		if(global.FirePuzzles && FirePuzzles.objective){
			const live = FirePuzzles.objective(r);
			if(live) return live;
		}
		if(global.IcePuzzles && IcePuzzles.objective){
			const live = IcePuzzles.objective(r);
			if(live) return live;
		}
		return r.objective || '';
	}

	function updateObjectiveHUD(){
		Env.objective = objectiveFor(Env.currentRoom);
		const el = document.getElementById('dungeonObjective');
		if(!el) return;
		if(true || !IS_DUNGEON || !Env.currentRoom || !Env.objective){
			if(el.style.display !== 'none') el.style.display = 'none';
			Env._objHud = '';
			return;
		}
		const opt = Env.currentRoom.optional ? '<div class="dobj-opt">OPTIONAL</div>' : '';
		const html = opt + '<div class="dobj-text">' + Env.objective + '</div>';
		if(Env._objHud === html) return;
		Env._objHud = html;
		el.style.display = 'block';
		el.innerHTML = html;
	}

	function openingOverlapsGate(op, g){
		return op && g && op.x < g.x + g.w + 28 && op.x + op.w > g.x - 28 &&
			op.y < g.y + g.h + 28 && op.y + op.h > g.y - 28;
	}
	function rectsOverlap(a, b, pad){
		if(!a || !b) return false;
		pad = pad || 0;
		return a.x < b.x + b.w + pad && a.x + a.w > b.x - pad &&
			a.y < b.y + b.h + pad && a.y + a.h > b.y - pad;
	}
	function roomLocksExits(r){
		if(!r || r.cleared) return false;
		if(r.kind === 'magmaArena' || r.kind === 'furnaceConveyor' || r.kind === 'eruptionChamber' ||
			r.kind === 'infernoNest' || r.kind === 'moltenBridgeworks') return true;
		if(r.optional && (r.kind === 'combat' || r.kind === 'elite' || r.kind === 'eliteChamber')) return true;
		if(r.optional) return false;
		return r.kind === 'combat' || r.kind === 'elite' || r.kind === 'eliteChamber' ||
			r.kind === 'secretElite' || r.kind === 'trial' || r.kind === 'risk' ||
			r.kind === 'shatter' || r.kind === 'warden';
	}
	function platformBlocksPassage(p){
		if(!p || p._gone) return false;
		if(p.landing) return true;
		const d = getDungeon();
		if(!d) return false;
		const rooms = d.rooms || [];
		for(let r = 0; r < rooms.length; r++){
			const ops = rooms[r] && rooms[r].extraOpenings;
			if(!ops) continue;
			for(let i = 0; i < ops.length; i++){
				if(!ops[i] || ops[i]._secret) continue;
				if(rectsOverlap(p, ops[i], 8)) return true;
			}
		}
		const halls = d.corridors || [];
		for(let i = 0; i < halls.length; i++){
			const h = halls[i];
			if(!h || !h._hall) continue;
			if(rectsOverlap(p, h, 4)) return true;
		}
		return false;
	}
	function punchRect(op, opts){
		if(!op) return;
		stampTiles(op.x, op.y, op.w, op.h, true, opts);
	}
	function sealRect(op, opts){
		if(!op) return;
		stampTiles(op.x, op.y, op.w, op.h, false, opts);
	}
	function gateShouldBeClosed(g){
		if(!g) return false;
		if(g._arenaSeal) return true;
		if(g.optional) return false;
		const rs = rooms();
		const from = rs[g.fromRoom];
		const to = rs[g.toRoom];
		if(to && ((to.kind === 'warden' && to._wardenArmed) || (to.locked && to.kind === 'vault'))) return true;
		if(from && ((from.kind === 'warden' && from._wardenArmed) || (from.locked && from.kind === 'vault'))) return true;
		return roomLocksExits(from);
	}
	function resealHallIntrusions(opts){
		const d = getDungeon();
		if(!d) return;
		const rs = d.rooms || [];
		const halls = d.corridors || [];
		for(let i = 0; i < rs.length; i++){
			const room = rs[i];
			if(!room) continue;
			const ix0 = room.x + 16, iy0 = room.y + 16, ix1 = room.x + room.w - 16, iy1 = room.y + room.h - 16;
			if(ix1 <= ix0 || iy1 <= iy0) continue;
			for(let h = 0; h < halls.length; h++){
				const hall = halls[h];
				if(!hall || !hall._hall) continue;
				const x0 = Math.max(hall.x, ix0), x1 = Math.min(hall.x + hall.w, ix1);
				const y0 = Math.max(hall.y, iy0), y1 = Math.min(hall.y + hall.h, iy1);
				if(x1 > x0 + 4 && y1 > y0 + 4) sealRect({ x:x0, y:y0, w:x1 - x0, h:y1 - y0 }, opts);
			}
		}
	}
	function refreshFirePassages(){
		if(theme() !== 'fire') return;
		const d = getDungeon();
		if(!d) return;
		const skip = { skipFluid:true };
		const halls = d.corridors || [];
		for(let i = 0; i < halls.length; i++){
			if(halls[i] && halls[i]._hall) punchRect(halls[i], skip);
		}
		resealHallIntrusions(skip);
		const links = d._links || [];
		for(let i = 0; i < links.length; i++){
			const L = links[i];
			if(!L) continue;
			if(L.halls){
				for(let h = 0; h < L.halls.length; h++) punchRect(L.halls[h], skip);
			}
			punchRect(L.fromOpen, skip);
			punchRect(L.toOpen, skip);
		}
		const rs = rooms();
		for(let i = 0; i < rs.length; i++){
			const r = rs[i];
			if(!r || !r.extraOpenings) continue;
			for(let o = 0; o < r.extraOpenings.length; o++){
				const op = r.extraOpenings[o];
				if(!op || op._secret) continue;
				if(op._door || op._keep) punchRect(op, skip);
			}
		}
		const gs = d._gates || [];
		for(let i = 0; i < gs.length; i++){
			const g = gs[i];
			if(!g) continue;
			g.closed = gateShouldBeClosed(g);
			if(!g.closed) continue;
			if(g._arenaSeal){
				sealRect(g.fromOpen, skip);
				sealRect(g.toOpen, skip);
				sealRect(g, skip);
				continue;
			}
			/* Lock only the source mouth. Destinations and halls stay walkable
			   from every other approach. */
			if(g.fromOpen) sealRect(g.fromOpen, skip);
			else sealRect(g, skip);
		}
		if(global.FireArt && FireArt.invalidateTiles) FireArt.invalidateTiles();
	}
	function restampRoomPlatforms(room, skip){
		if(!room) return;
		for(const p of platforms()){
			if(p.roomId !== room.id || p._gone) continue;
			if(p.kind === 'move' || p.kind === 'raft' || p.kind === 'orbit') continue;
			if(theme() === 'fire' && platformBlocksPassage(p)) continue;
			if(skip && p.x < skip.x + skip.w && p.x + p.w > skip.x &&
				p.y < skip.y + skip.h && p.y + p.h > skip.y) continue;
			stampTiles(p.x, p.y, p.w, p.h, false);
			p._stamped = true;
		}
	}
	function punchGateAir(g){
		if(!g) return;
		punchRect(g.fromOpen);
		punchRect(g.toOpen);
		const rs = rooms();
		const ids = [g.roomId, g.fromRoom, g.toRoom];
		for(let i = 0; i < ids.length; i++){
			const r = rs[ids[i]];
			if(!r || !r.extraOpenings) continue;
			for(const op of r.extraOpenings){
				if(op && !op._secret && (openingOverlapsGate(op, g) || op === g.fromOpen || op === g.toOpen)){
					punchRect(op);
				}
			}
		}
		stampTiles(g.x - 20, g.y - 20, g.w + 40, g.h + 40, true);
	}
	function sealGate(g, closed){
		if(!g) return;
		g.closed = !!closed;
		if(theme() === 'fire'){
			refreshFirePassages();
			return;
		}
		const pad = closed ? 0 : 20;
		const rs = rooms();
		const seen = Object.create(null);
		const ids = [g.roomId, g.fromRoom, g.toRoom];
		for(let i = 0; i < ids.length; i++){
			const id = ids[i];
			if(id == null || seen[id]) continue;
			seen[id] = 1;
			const r = rs[id];
			if(!r || !r.extraOpenings) continue;
			for(const op of r.extraOpenings){
				if(openingOverlapsGate(op, g) || op === g.fromOpen || op === g.toOpen){
					stampTiles(op.x, op.y, op.w, op.h, !closed);
				}
			}
			if(closed) restampRoomPlatforms(r, g);
			else restampRoomPlatforms(r, null);
		}
		if(g.fromOpen) stampTiles(g.fromOpen.x, g.fromOpen.y, g.fromOpen.w, g.fromOpen.h, !closed);
		if(g.toOpen) stampTiles(g.toOpen.x, g.toOpen.y, g.toOpen.w, g.toOpen.h, !closed);
		stampTiles(g.x - pad, g.y - pad, g.w + pad * 2, g.h + pad * 2, !closed);
		if(!closed) punchGateAir(g);
		if(typeof computeTileEdges === 'function') computeTileEdges();
	}

	function sealRoomArena(room, closed){
		if(!room) return;
		const gs = (getDungeon() && getDungeon()._gates) || [];
		for(let i = 0; i < gs.length; i++){
			const g = gs[i];
			if(!g) continue;
			if(g.fromRoom === room.id || g.toRoom === room.id){
				g._arenaSeal = !!closed;
				g.closed = !!closed;
			}
		}
		room.locked = !!closed;
		if(theme() === 'fire') refreshFirePassages();
		else {
			for(let i = 0; i < gs.length; i++){
				const g = gs[i];
				if(g && (g.fromRoom === room.id || g.toRoom === room.id)) sealGate(g, closed);
			}
		}
	}

	function isTreasure(it){
		if(!it) return false;
		if(it.kind === 'cache' || it.kind === 'specialCache' || it.kind === 'jungleCache' || it.kind === 'jungleVault' || it.kind === 'vault') return true;
		return !!(global.ChestLoot && ChestLoot.isChest && ChestLoot.isChest(it));
	}
	function unlockRoomChests(r){
		if(!r) return;
		const list = interacts();
		for(let i = 0; i < list.length; i++){
			const it = list[i];
			if(!it || it.roomId !== r.id || !isTreasure(it)) continue;
			if(it._lockTag && it._lockTag !== 'main') continue;
			if(it._clearLock || it._mainCache) it._locked = false;
		}
	}
	function seatTreasure(it){
		if(!isTreasure(it) || it.used) return;
		const room = it.roomId != null ? rooms()[it.roomId] : roomAt(it.x + (it.w || 40) / 2, it.y + (it.h || 40) / 2);
		const h = it.h || 60;
		const cx = it.x + (it.w || 70) * 0.5;
		const bottom = it.y + h;
		const walk = room ? (room.y + room.h - (room.raisedFloor || 0)) : bottom;
		const cands = [walk];
		const plats = platforms();
		for(let i = 0; i < plats.length; i++){
			const p = plats[i];
			if(!p || p._gone) continue;
			if(room && p.roomId != null && p.roomId !== room.id) continue;
			if(cx < p.x + 6 || cx > p.x + p.w - 6) continue;
			if(room && (p.y < room.y + 8 || p.y > walk + 12)) continue;
			cands.push(p.y);
		}
		let best = walk, bestScore = 1e9;
		for(let i = 0; i < cands.length; i++){
			const s = cands[i];
			const drop = s - bottom;
			if(drop < -18 || drop > 170) continue;
			const score = (s < walk - 20 && drop >= -8 && drop <= 140) ? drop - 24 : Math.abs(drop);
			if(score < bestScore){ bestScore = score; best = s; }
		}
		it.y = best - h;
	}
	function seatAllTreasure(){
		const list = interacts();
		for(let i = 0; i < list.length; i++) seatTreasure(list[i]);
	}

	function clearRoom(r, why){
		if(!r || r.cleared) return;
		r.cleared = true;
		r.locked = false;
		unlockRoomChests(r);
		const allGates = (getDungeon() && getDungeon()._gates) || [];
		for(let i = 0; i < allGates.length; i++){
			const g = allGates[i];
			if(!g) continue;
			if(g.fromRoom === r.id || g.toRoom === r.id){
				g.closed = false;
				if(!(r.kind === 'warden' && r._wardenArmed)) g._arenaSeal = false;
			}
		}
		if(r.kind === 'warden' || r._wardenArmed){
			r._wardenArmed = false;
			sealRoomArena(r, false);
		} else if(theme() === 'fire'){
			refreshFirePassages();
		} else if(r.outGates){
			for(const g of r.outGates) sealGate(g, false);
		}
		if(typeof notify === 'function') notify(why || 'The way opens.');
		showBanner(why || 'The way opens.');
		if(typeof shakeScreen === 'function') shakeScreen(5, 10);
		updateObjectiveHUD();
	}

	function enemyCenterRoom(e){
		if(!e) return null;
		const cx = e.x + (e.w || 40) * 0.5, cy = e.y + (e.h || 40) * 0.5;
		const geo = roomAt(cx, cy);
		if(geo) return geo;
		return (e.roomId != null) ? rooms()[e.roomId] : null;
	}
	function roomEnemies(r){
		if(typeof enemies === 'undefined' || !r) return [];
		return enemies.filter(e => {
			if(!e || e.dead || e.hp <= 0) return false;
			if(e.typeDef && e.typeDef.isBoss) return false;
			if(e._wardenDormant || e.isDormant) return false;
			const home = enemyCenterRoom(e);
			return !!(home && home.id === r.id);
		});
	}
	function combatChestLocked(it){
		if(!it || it.used) return false;
		if(it._lockTag && it._lockTag !== 'main') return !!it._locked;
		const r = it.roomId != null ? rooms()[it.roomId] : null;
		if(!r) return !!(it._locked || it.lockedByCombat);
		if(r.noCombat) return !!it._locked;
		const alive = roomEnemies(r);
		if(it.lockedByCombat || it._clearLock){
			if(!alive.length){ it._locked = false; it.lockedByCombat = false; return false; }
			return true;
		}
		if(it._mainCache && it._locked){
			if((r.cleared || (killClearKinds(r) && Env.visited[r.id])) && !alive.length){
				it._locked = false;
				return false;
			}
			return true;
		}
		return !!it._locked;
	}

	function playerInZone(z){
		if(!z) return false;
		return playerInRect(z.x, z.y, z.w, z.h);
	}

	function killClearKinds(r){
		return !!r && (r.kind === 'combat' || r.kind === 'elite' || r.kind === 'eliteChamber' ||
			r.kind === 'secretElite' || r.kind === 'warden' || r.kind === 'knight' || r.kind === 'shatter');
	}
	function tryClearByKills(r){
		if(!r || r.cleared || !killClearKinds(r)) return false;
		if(r.kind === 'warden' && !r._wardenArmed) return false;
		if(!Env.visited[r.id]) return false;
		if(roomEnemies(r).length) return false;
		const msg = r.kind === 'warden' ? 'The guardian falls.' : (r.kind === 'knight' ? 'THE ICE REMEMBERS — the knight falls.' : 'DEFEAT ALL ENEMIES — the gate opens.');
		clearRoom(r, msg);
		return true;
	}
	function updateRoomClear(){
		if(jungle()){
			if(jungle().updateClears) jungle().updateClears();
			else if(jungle().roomClear) jungle().roomClear(Env.currentRoom);
			return;
		}
		if(theme() === 'fire'){
			Env._clearScan = (Env._clearScan || 0) + 1;
			if((Env._clearScan % 12) === 0){
				const rs = rooms();
				for(let i = 0; i < rs.length; i++){
					const room = rs[i];
					if(room && !room.cleared && Env.visited[room.id] && killClearKinds(room)) tryClearByKills(room);
				}
			}
		}
		const r = Env.currentRoom;
		if(!r || r.cleared) return;
		if(ice() && ice().roomClear(r)) return;
		if(killClearKinds(r)){
			tryClearByKills(r);
			if(playerInZone(r.clearZone)) clearRoom(r, r.kind === 'flood' ? 'REACH HIGHER GROUND' : (r.kind === 'collapseEvent' ? 'ESCAPE THE COLLAPSING CAVERN' : 'REACH THE OTHER SIDE'));
		} else if(r.kind === 'blizzard'){
			if(r.surviveLeft > 0){
				r.surviveLeft--;
				r.objective = 'SURVIVE THE BLIZZARD — ' + Math.ceil(r.surviveLeft / 60) + 's';
				if(r.surviveLeft <= 0) clearRoom(r, 'The blizzard breaks.');
			} else if(r.surviveFrames && Env.visited[r.id] && roomEnemies(r).length === 0){
				clearRoom(r, 'The blizzard breaks.');
			}
		} else if(r.kind === 'mechanism'){
			const valves = interacts().filter(i => i.kind === 'valve' && i.roomId === r.id);
			const done = valves.filter(i => i.used).length;
			r.objective = 'ACTIVATE THE THREE FROZEN MECHANISMS — ' + done + ' / ' + valves.length;
			if(valves.length && done >= valves.length){
				addHeat(-6, null);
				clearRoom(r, 'The frozen mechanisms unlock.');
			}
		} else if(r.kind === 'prison'){
			const it = interacts().find(i => i.kind === 'prison' && i.roomId === r.id);
			if(it && it.used && roomEnemies(r).length === 0) clearRoom(r, 'The prisoner falls.');
		} else if(r.kind === 'secretMemory'){
			const it = interacts().find(i => i.kind === 'memory' && i.roomId === r.id);
			if(it && it.used) clearRoom(r, 'A frozen memory fades.');
		} else if(r.kind === 'eruption'){
			if(r.surviveLeft > 0){
				r.surviveLeft--;
				r.objective = 'SURVIVE THE ERUPTION — ' + Math.ceil(r.surviveLeft / 60) + 's';
				if(r.surviveLeft <= 0) clearRoom(r, 'The eruption settles.');
			}
		} else if(r.kind === 'stabilize'){
			const valves = interacts().filter(i => i.kind === 'valve' && i.roomId === r.id);
			const done = valves.filter(i => i.used).length;
			r.objective = 'ACTIVATE THE VALVES — ' + done + ' / ' + valves.length;
			if((valves.length && done >= valves.length) || (!valves.length && Env.visited[r.id])){
				if(valves.length) addHeat(-8, null);
				clearRoom(r, 'The magma valves lock.');
			}
		} else if(r.kind === 'furnace' || r.kind === 'choice'){
			const it = interacts().find(i => i.kind === 'choice' && i.roomId === r.id);
			if(it && it.used) clearRoom(r, 'The furnace answers.');
			else if(!it && Env.visited[r.id]) clearRoom(r, 'The furnace answers.');
		} else if(r.kind === 'vault'){
			const it = interacts().find(i => i.kind === 'vault' && i.roomId === r.id);
			if(it && it.used && !it._pendingLoot) clearRoom(r, 'The vault stills.');
		} else if(r.kind === 'trial'){
			if(r._trialDone) clearRoom(r, 'The trial is complete.');
		} else if(r.kind === 'risk'){
			const it = interacts().find(i => i.kind === 'risk' && i.roomId === r.id);
			if(it && it.used) clearRoom(r, 'The risk is taken.');
		}
	}

	function updateRooms(){
		const r = roomAt(player.x + player.w / 2, player.y + player.h / 2);
		if(r && (!Env.currentRoom || Env.currentRoom.id !== r.id)){
			Env.currentRoom = r;
			if(!Env.visited[r.id]){
				Env.visited[r.id] = true;
				const jungleRT = jungle();
				if(jungleRT){
					jungleRT.roomEnter(r);
				} else {
				if(global.FirePuzzles) FirePuzzles.onRoomEnter(r);
				if(global.IcePuzzles) IcePuzzles.onRoomEnter(r);
				const sink = Env.blessings.sink ? 0.55 : 1;
				const greed = Env.blessings.fortune ? 1.25 : 1;
				const iceRT = ice();
				const isIce = theme() === 'ice';
				if(iceRT){
					iceRT.roomEnter(r);
				} else if(isIce){
					let frostIn = 0;
					if(r.section >= 4) frostIn += 2;
					if(r.hot) frostIn += 4;
					if(r.kind === 'blizzard' || r.kind === 'lake' || r.kind === 'prison' || r.kind === 'knight') frostIn += 3;
					if(frostIn) addHeat(Math.round(frostIn * sink * greed), '+FROST');
				} else {
					addHeat(Math.round((3 + r.depth * 2) * sink * greed), null);
				}
				if(iceRT){ /* IceWorld already announced the room */ }
				else if(global.SpecialRooms && SpecialRooms.roomBanner(r)){ /* special room announced */ }
				else if(r.kind === 'crossing' || r.kind === 'ascent' || r.kind === 'descent' || r.kind === 'slide' || r.kind === 'heart') showBanner((r.label || 'Traversal') + ' — reach the other side.');
				else if(r.kind === 'river') showBanner((r.label || (isIce ? 'Frozen River' : 'Magma River')) + ' — ' + (isIce ? 'cross the ice.' : 'ride the flow.'));
				else if(r.kind === 'furnace' || r.kind === 'choice') showBanner((r.label || 'Furnace') + ' — choose how to treat the furnace.');
				else if(r.kind === 'vault') showBanner((r.label || 'Vault') + ' — optional treasure.');
				else if(r.kind === 'shrine' || r.kind === 'secretShrine') showBanner((r.label || 'Shrine') + ' — choose one blessing.');
				else if(r.kind === 'cooling' || r.kind === 'warming') showBanner((isIce ? 'Warming Chamber' : 'Cooling Chamber') + ' — a rare breath.');
				else if(r.kind === 'ashFork' || r.kind === 'forgeFork' || r.kind === 'iceFork' || r.kind === 'deepFork') showBanner((r.label || 'Branch') + ' — choose a path.');
				else if(r.kind === 'eruption') showBanner('SURVIVE THE ERUPTION');
				else if(r.kind === 'blizzard') showBanner('SURVIVE THE BLIZZARD');
				else if(r.kind === 'mechanism') showBanner((r.label || 'Frozen Mechanism') + ' — activate the stations.');
				else if(r.kind === 'lake') showBanner((r.label || 'Frozen Lake') + ' — optional crossing.');
				else if(r.kind === 'mirror') showBanner((r.label || 'Ice Mirror') + ' — trust the real path.');
				else if(r.kind === 'prison') showBanner((r.label || 'Frozen Prison') + ' — free it, or leave it.');
				else if(r.kind === 'trial') showBanner((r.label || 'Trial') + ' — optional challenge.');
				else if(r.kind === 'flood') showBanner('REACH HIGHER GROUND');
				else if(r.kind === 'collapseEvent') showBanner('ESCAPE THE COLLAPSING CAVERN');
				else if(r.kind === 'shatter') showBanner('DEFEAT ALL ENEMIES BEFORE THE ICE BREAKS');
				else if(r.kind === 'secretMemory') showBanner((r.label || 'Frozen Memory') + ' — a quiet discovery.');
				else if(r.kind === 'knight'){
					const it = interacts().find(i => i.kind === 'banner' && i.roomId === r.id);
					showBanner((it && it.text) || 'THE ICE REMEMBERS ITS WARRIORS');
				} else if(r.kind === 'warden'){
					showBanner('THE FURNACE HAS A GUARDIAN — ring the sigil.');
				} else if(r.kind === 'stabilize') showBanner((r.label || 'Volcanic Stabilization') + ' — magma waits in the gold joints. The blue tanks are empty.');
				else if(r.kind === 'combat' || r.kind === 'elite' || r.kind === 'eliteChamber' || r.kind === 'secretElite') showBanner((r.label || 'Combat') + ' — defeat all enemies.');
				if(Env.heat >= 36){
					for(const en of enemies){
						if(en.dead || en.roomId !== r.id || en._heatAmp) continue;
						en._heatAmp = true;
						en.hp = Math.round(en.hp * 1.12);
						en.maxHp = Math.round(en.maxHp * 1.12);
					}
				}
				if(!isIce && Env.heat >= 50 && (r.kind === 'combat' || r.kind === 'elite') && !r._heatSurge){
					r._heatSurge = true;
					showBanner('The volcano surges.');
					if(typeof shakeScreen === 'function') shakeScreen(7, 16);
					for(const hz of hazards()){
						if(hz.roomId === r.id && hz.type === 'vent'){
							hz.period = Math.max(90, (hz.period || 160) * 0.78);
							hz.columnH = (hz.columnH || 200) + 40;
						}
					}
				}
				}
			}
			for(const hz of hazards()){
				if(hz.type === 'rise' && hz.armed && hz.roomId === r.id && !hz.vault) hz.active = true;
			}
			updateObjectiveHUD();
		}
		if(theme() === 'fire' && r && Env.currentRoom && Env._lastPassRoom !== Env.currentRoom.id){
			Env._lastPassRoom = Env.currentRoom.id;
			refreshFirePassages();
		}
		if(theme() === 'fire') maybeHealFireDoor();
		updateRoomClear();
		updateObjectiveHUD();
	}

	function maybeHealFireDoor(){
		if(typeof player === 'undefined' || !player) return;
		Env._healCd = (Env._healCd || 0) - 1;
		if(Env._healCd > 0) return;
		const dir = Math.sign(player.vx || 0);
		const fall = (player.vy || 0) > 0.35;
		if(!dir && !fall) return;
		const t = (typeof TILE === 'number') ? TILE : 40;
		if(typeof isSolid !== 'function') return;
		const probeX = dir < 0 ? player.x - 10 : (dir > 0 ? player.x + player.w + 10 : player.x + player.w * 0.5);
		const probeY = fall ? player.y + player.h + 8 : player.y + player.h * 0.45;
		const hit = isSolid(Math.floor(probeX / t), Math.floor(probeY / t)) ||
			isSolid(Math.floor(probeX / t), Math.floor((player.y + player.h - 6) / t));
		if(!hit) return;
		const d = getDungeon();
		const links = (d && d._links) || [];
		const box = { x: player.x - 56, y: player.y - 40, w: player.w + 112, h: player.h + 80 };
		for(let i = 0; i < links.length; i++){
			const L = links[i];
			if(!L) continue;
			const srcLocked = !!(L.gate && gateShouldBeClosed(L.gate) && !L.gate._arenaSeal);
			if(rectsOverlap(box, L.toOpen, 16) ||
				(!srcLocked && rectsOverlap(box, L.fromOpen, 16))){
				Env._healCd = 18;
				refreshFirePassages();
				return;
			}
		}
	}

	function breakPlatform(p){
		if(!p || p._gone) return;
		if(p._stamped) stampTiles(p.x, p.y, p.w, p.h, true);
		p._gone = true;
		if(typeof computeTileEdges === 'function') computeTileEdges();
	}

	function updatePlatforms(){
		for(const p of platforms()){
			if((p.kind === 'collapse' || p.kind === 'pillar') && p._stamped && !p._gone){
				const on = player.onGround && playerInRect(p.x, p.y - 8, p.w, p.h + 12);
				if(on){
					p._tick = (p._tick || 0) + 1;
					if(p._tick === 8 && typeof shakeScreen === 'function') shakeScreen(3, 8);
					if(p._tick >= (p.life || 80)){
						breakPlatform(p);
						if(typeof shakeScreen === 'function') shakeScreen(6, 12);
					}
				}
			}
			if(p.kind === 'move'){
				p._t = (p._t || 0) + (p.spd || 1);
				const wave = Math.sin(p._t * 0.025);
				if(p.axis === 'y') p.y = p.homeY + wave * (p.dist || 120);
				else p.x = p.homeX + wave * (p.dist || 140);
			}
			if(p.kind === 'raft'){
				const room = rooms()[p.roomId];
				p.x += (p.spd || 1.3) * (p.raftDir || 1);
				if(room){
					if(p.x > room.x + room.w - p.w - 40){ p.x = room.x + (room._ledge || 280); p._wrapped = true; }
					if(p.x < room.x + 20){ p.x = room.x + room.w - p.w - (room._ledge || 280); p._wrapped = true; }
				}
			}
			if(p.kind === 'orbit'){
				p._ang = (p._ang != null ? p._ang : (p.ang || 0)) + (p.spd || 0.02);
				p.x = p.homeX + Math.cos(p._ang) * (p.radius || 90);
				p.y = p.homeY + Math.sin(p._ang) * (p.radius || 90);
			}
		}
		if(typeof projectiles !== 'undefined'){
			for(const p of platforms()){
				if(p.kind !== 'pillar' || p._gone) continue;
				for(const proj of projectiles){
					if(!proj || proj.hasHit) continue;
					if(proj.x > p.x && proj.x < p.x + p.w && proj.y > p.y - 20 && proj.y < p.y + p.h + 20){
						p._tick = (p._tick || 0) + 40;
						if(p._tick >= (p.life || 90)) breakPlatform(p);
					}
				}
			}
		}
	}

	function collideMovers(ent){
		if(!IS_DUNGEON) return;
		for(const p of platforms()){
			if((p.kind !== 'move' && p.kind !== 'raft' && p.kind !== 'orbit') || p._gone) continue;
			if(ent.vy < -0.2) continue;
			if(ent.x + ent.w > p.x && ent.x < p.x + p.w &&
				ent.y + ent.h >= p.y && ent.y + ent.h <= p.y + 16){
				ent.y = p.y - ent.h;
				ent.vy = 0;
				ent.onGround = true;
				const prev = p._lastX != null ? p.x - p._lastX : 0;
				if(!p._wrapped && Math.abs(prev) < 80) ent.x += prev;
			}
		}
		for(const p of platforms()){
			if(p.kind === 'move' || p.kind === 'raft' || p.kind === 'orbit'){
				p._lastX = p.x;
				p._wrapped = false;
			}
		}
		if(ent === player) applyLavaSwim();
	}

	function playerOnIcePatch(){
		let slip = 0;
		for(const hz of hazards()){
			if(hz.type !== 'icePatch') continue;
			if(player.onGround && playerInRect(hz.x, hz.y - 10, hz.w, hz.h + 16)){
				slip = Math.max(slip, hz.slip == null ? 0.38 : hz.slip);
			}
		}
		return slip;
	}

	function applyIceMove(mx, currentSpeed){
		if(!IS_DUNGEON || theme() !== 'ice' || !player) return;
		if(ice()){ ice().applyMove(mx, currentSpeed); return; }
		let slip = playerOnIcePatch();
		let slideForce = 0;
		for(const hz of hazards()){
			if(hz.type === 'slide' && playerInRect(hz.x, hz.y, hz.w, hz.h)){
				slip = Math.max(slip, 0.48);
				slideForce += (hz.dir || 1) * (hz.force || 3.8);
			}
		}
		if(Env.heat >= 70) slip += 0.12;
		else if(Env.heat >= 35) slip += 0.06;
		if(Env.blessings.step) slip *= 0.48;
		slip = Math.min(0.62, slip);
		if(slip <= 0.02 && !slideForce && !player._iceVx) return;
		player._iceVx = player._iceVx || 0;
		const target = mx * currentSpeed;
		const follow = 0.22 + (1 - slip) * 0.42;
		player._iceVx += (target - player._iceVx) * follow;
		if(mx === 0) player._iceVx *= (0.94 - slip * 0.08);
		player._iceVx += slideForce * 0.18;
		if(Math.abs(player._iceVx) > currentSpeed * 1.35) player._iceVx = Math.sign(player._iceVx) * currentSpeed * 1.35;
		player.vx = player._iceVx;
		if(Math.abs(player._iceVx) < 0.12 && mx === 0 && !slideForce) player._iceVx = 0;
	}

	function updateHazards(){
		if(jungle()){ jungle().updateHazards(); return; }
		if(ice()){ ice().updateHazards(); return; }
		const heatBoost = 1 + Env.heat / 140;
		let storming = false;
		for(const hz of hazards()){
			if(hz.type === 'blizzard' && Env.currentRoom && Env.currentRoom.id === hz.roomId && !Env.currentRoom.cleared) storming = true;
		}
		if(!storming) Env.blizzardVis = Math.max(0, (Env.blizzardVis || 0) - 0.012);
		for(const hz of hazards()){
			if(hz.type === 'vent'){
				tickGeyser(hz, hz.y, true, heatBoost);
			}
			if(hz.type === 'channel'){
				hz.timer = (hz.timer || 0) + 1;
				if(hz.timer >= (hz.flipEvery / heatBoost)){
					hz.timer = 0;
					hz.safe = hz.safe === 'left' ? 'right' : 'left';
					if(Env.currentRoom && Env.currentRoom.id === hz.roomId && typeof shakeScreen === 'function'){
						shakeScreen(4, 8);
					}
				}
				const hotSide = hz.safe === 'left' ? 'right' : 'left';
				if(hz.mode === 'geysers' && hz.geysers){
					for(const g of hz.geysers){
						const surf = (global.DungeonFluid && global.DungeonFluid.surfaceAt)
							? (global.DungeonFluid.surfaceAt(g.x + g.w / 2, 'lava', hz.y || hz.groundY) || hz.y)
							: hz.y;
						tickGeyser(g, surf, g.side === hotSide, heatBoost);
					}
				} else {
					const { hot } = channelRects(hz);
					const inHot = playerInRect(hot.x, hz.y - 80, hot.w, (hz.h || 40) + 120);
					const inFluid = global.DungeonFluid && global.DungeonFluid.ready
						? !!global.DungeonFluid.hits(player.x, player.y, player.w, player.h, 'lava')
						: playerInRect(hot.x, hz.y, hot.w, hz.h);
					if(inHot && inFluid) burnPlayer();
				}
			}
			if(hz.type === 'fall'){
				hz._t = (hz._t || hz.phase || 0) + heatBoost;
				const cyc = hz._t % hz.period;
				hz.warnOn = cyc > hz.period - hz.warn - hz.burst && cyc <= hz.period - hz.burst;
				hz.hot = cyc > hz.period - hz.burst;
				if(hz.hot && playerInRect(hz.x, hz.y, hz.w, hz.h)) burnPlayer();
			}
			if(hz.type === 'gate'){
				hz._t = (hz._t || hz.phase || 0) + 1;
				const open = (hz._t % hz.period) < (hz.openFor || 90);
				if(open !== !hz.solid){
					hz.solid = !open;
					stampTiles(hz.x, hz.y, hz.w, hz.h, open);
					if(typeof computeTileEdges === 'function') computeTileEdges();
				}
			}
			if(hz.type === 'rise' && hz.active){
				hz.y = hz.y == null ? hz.y0 : hz.y;
				if(!hz._upDone){
					hz.y -= hz.speed * heatBoost;
					if(hz.y <= hz.y1){ hz.y = hz.y1; hz._upDone = true; hz._hold = hz.hold || 200; }
				} else if(hz._hold > 0){
					hz._hold--;
				} else {
					hz.y += hz.speed * 1.4;
					if(hz.y >= hz.y0){ hz.y = hz.y0; hz.active = false; hz._upDone = false; }
				}
				if(!(global.DungeonFluid && global.DungeonFluid.ready)){
					const riseRoom = rooms()[hz.roomId];
					const riseFloor = riseRoom ? riseRoom.y + riseRoom.h : (hz.y0 || hz.y + 80);
					const riseH = Math.max(8, riseFloor - hz.y);
					if(playerInRect(hz.x, hz.y, hz.w, riseH) && player.y + player.h > hz.y && player.y < riseFloor) burnPlayer();
				}
			}
			if(hz.type === 'icePatch'){
				if(player.onGround && playerInRect(hz.x, hz.y - 10, hz.w, hz.h + 16)){
					hz._frostTick = (hz._frostTick || 0) + 1;
					if(hz._frostTick >= 90){
						hz._frostTick = 0;
						const sink = Env.blessings.sink ? 0.45 : 1;
						const greed = Env.blessings.fortune ? 1.2 : 1;
						addHeat(Math.round(1 * sink * greed), null);
					}
				}
			}
			if(hz.type === 'icicle' || (hz.type === 'fall' && hz.element === 'ice')){
				hz._t = (hz._t || hz.phase || 0) + heatBoost;
				const period = hz.period || 180;
				const warn = hz.warn || 28;
				const burst = hz.burst || 22;
				const cyc = hz._t % period;
				hz.warnOn = cyc > period - warn - burst && cyc <= period - burst;
				hz.hot = cyc > period - burst;
				if(hz.hot && playerInRect(hz.x, hz.y, hz.w, hz.h)) burnPlayer();
			}
			if(hz.type === 'blizzard'){
				const inStorm = Env.currentRoom && Env.currentRoom.id === hz.roomId && !Env.currentRoom.cleared;
				if(inStorm){
					Env.blizzardVis = Math.min(0.42, (Env.blizzardVis || 0) + 0.008);
					hz._frostTick = (hz._frostTick || 0) + 1;
					if(hz._frostTick >= 80){
						hz._frostTick = 0;
						const sink = Env.blessings.sink ? 0.5 : 1;
						const greed = Env.blessings.fortune ? 1.25 : 1;
						addHeat(Math.round(2 * sink * greed), '+FROST');
					}
				}
			}
			if(hz.type === 'lavaBubbles'){
				hz._t = (hz._t || 0) + heatBoost;
				hz.bubbles = hz.bubbles || [];
				hz.pops = hz.pops || [];
				if(hz._t >= (hz.period || 42)){
					hz._t = 0;
					if(hz.bubbles.length < (hz.max || 5) && Math.random() < (hz.chance || 0.55)){
						const bx = hz.x + 20 + Math.random() * Math.max(20, hz.w - 40);
						hz.bubbles.push({
							x: bx, y: hz.y + 6,
							r: 7 + Math.random() * 6,
							vy: -(hz.rise || 2.2) - Math.random() * 0.8,
							vx: (Math.random() - 0.5) * 0.9,
							age: 0,
							life: 140 + Math.random() * 70,
							seed: bx,
						});
					}
				}
				for(let i = hz.bubbles.length - 1; i >= 0; i--){
					const b = hz.bubbles[i];
					b.age++;
					b.x += b.vx + Math.sin(b.age * 0.12 + b.seed) * 0.35;
					b.y += b.vy;
					b.r += 0.035;
					const hit = Math.hypot((player.x + player.w / 2) - b.x, (player.y + player.h / 2) - b.y) < b.r + 16;
					if(hit || b.age > b.life || b.y < (rooms()[hz.roomId] ? rooms()[hz.roomId].y + 40 : 0)){
						hz.pops.push({ x: b.x, y: b.y, r: 8, max: hz.popR || 48, age: 0 });
						if(hit) burnPlayer();
						hz.bubbles.splice(i, 1);
					}
				}
				for(let i = hz.pops.length - 1; i >= 0; i--){
					const p = hz.pops[i];
					p.age++;
					p.r += 3.2;
					if(p.age > 16) hz.pops.splice(i, 1);
				}
			}
		}
	}

	function grantLoot(table, label){
		if(!table || !playerData) return;
		const mult = Env.lootMult * ((Env.modifiers.wardenSlain || Env.modifiers.knightSlain) ? 1.25 : 1) * (Env.modifiers.furnaceOverload ? 1.2 : 1);
		for(const entry of table){
			if(Math.random() > entry.chance) continue;
			let qty = entry.min + Math.floor(Math.random() * (entry.max - entry.min + 1));
			qty = Math.max(1, Math.round(qty * mult));
			const existing = playerData.inventory.find(e => e.itemId === entry.id);
			if(existing) existing.qty += qty;
			else playerData.inventory.push({ itemId: entry.id, qty });
			const info = REWARD_ITEM_INFO[entry.id];
			if(info){
				dmgNumbers.push({ x:player.x + player.w / 2, y:player.y - 28, text:info.icon + ' +' + qty + ' ' + info.name, age:0, color:'#ffcc44' });
			}
		}
		try{ localStorage.setItem('magicBattle_playerData', JSON.stringify(playerData)); }catch(e){}
		if(label && typeof notify === 'function') notify(label);
	}

	function themeLoot(better){
		const t = theme();
		if(t === 'ice') return better
			? [{ id:'permafrost', chance:1, min:2, max:3 }, { id:'ice_crystal', chance:1, min:3, max:5 }, { id:'crystal_fragment', chance:0.8, min:1, max:2 }]
			: [{ id:'ice_crystal', chance:1, min:1, max:3 }, { id:'arcane_dust', chance:0.6, min:1, max:2 }];
		if(t === 'earth') return better
			? [{ id:'titan_shard', chance:1, min:1, max:2 }, { id:'ancient_amber', chance:1, min:1, max:2 }, { id:'stone_chip', chance:1, min:3, max:5 }]
			: [{ id:'stone_chip', chance:1, min:2, max:4 }, { id:'crystal_fragment', chance:0.5, min:1, max:2 }];
		if(t === 'iron') return better
			? [{ id:'iron_plate', chance:1, min:3, max:5 }, { id:'molten_core', chance:0.7, min:1, max:1 }, { id:'forge_coal', chance:1, min:2, max:4 }]
			: [{ id:'iron_plate', chance:1, min:1, max:3 }, { id:'forge_coal', chance:0.8, min:1, max:2 }];
		return better
			? [{ id:'molten_core', chance:0.85, min:1, max:1 }, { id:'lava_essence', chance:1, min:2, max:4 }, { id:'ember_shard', chance:1, min:4, max:6 }]
			: [{ id:'ember_shard', chance:1, min:2, max:4 }, { id:'lava_essence', chance:0.55, min:1, max:2 }];
	}

	function spawnWave(room, n){
		if(!room || typeof ENEMY_TYPES === 'undefined') return;
		const pool = (global.DUNGEON_THEME_INFO[theme()] || {}).enemies || [];
		const jungleWave = theme() === 'jungle';
		const authoredSurfaces = jungleWave ? platforms().filter(function(p){
			return p.roomId === room.id && !p._gone && !p.vineRung && p.w >= 140 &&
				p.x >= room.x && p.x + p.w <= room.x + room.w &&
				p.y >= room.y && p.y <= room.y + room.h &&
				(p.kind === 'static' || p.kind === 'growth' || p.kind === 'move' || p.kind === 'collapse');
		}) : [];
		for(let i = 0; i < n; i++){
			const pick = pool.length ? pool[Math.min(pool.length - 1, i % pool.length)] : { type:'imp' };
			const t = ENEMY_TYPES[pick.type];
			if(!t) continue;
			const ew = Math.round(t.w * DIFF_SIZE_MULT);
			const eh = Math.round(t.h * DIFF_SIZE_MULT);
			const surface = authoredSurfaces.length ? authoredSurfaces[i % authoredSurfaces.length] : null;
			const x = surface
				? Math.max(room.x + 40, Math.min(room.x + room.w - ew - 40, surface.x + surface.w/2 - ew/2))
				: room.x + 80 + Math.random() * Math.max(1, room.w - ew - 160);
			const y = t.flies
				? room.y + 170 + (i % 3) * 120
				: surface ? surface.y - eh - 4 : room.y + room.h - eh - 8;
			const elite = jungleWave && (!!room._nestReward || !!room.elite);
			const hp = Math.round(t.hp * DIFF_HP_MULT * (1 + Env.heat * 0.008) * (elite ? 1.35 : 1));
			enemies.push({
				type: pick.type, typeDef: t, x, y,
				w: ew, h: eh,
				vx:0, vy:0, hp:hp, maxHp:hp,
				facing:1, patrol:[room.x + 60, room.x + room.w - 60], patrolDir:1, state:'alert',
				alertTimer:180, spellCooldowns:t.spells.map(() => 20), currentSpell:0, flash:0, dots:[],
				stunTimer:0, slowTimer:0, animTimer:0, attackAnimTimer:0, dead:false, deathTimer:0,
				baseY:y, flyOffset:0, charging:false, chargeVx:0, chargeVy:0, chargeTimer:0,
				chargeCastDone:false, bossPhase:1, _safeX:x, _safeY:y, puzzleSeg:room.depth,
				roomId: room.id, jungleElite:elite,
			});
		}
	}

	function closeChoice(){
		Env.choiceOpen = false;
		Env.choiceTarget = null;
		const el = document.getElementById('dungeonChoice');
		if(el) el.style.display = 'none';
	}

	function openChoice(it){
		Env.choiceOpen = true;
		Env.choiceTarget = it;
		const el = document.getElementById('dungeonChoice');
		if(!el) return;
		const t = theme();
		const titles = {
			fire: ['Overload furnace', 'Stabilize furnace', 'Destroy furnace'],
			ice: ['Invoke blizzard', 'Bind the altar', 'Shatter the ice'],
			earth: ['Wake the roots', 'Calm the shrine', 'Collapse a tunnel'],
			iron: ['Overstoke the forge', 'Lock the console', 'Blow the vents'],
		};
		const bodies = {
			fire: [
				'More enemies spawn. Heat rises. Loot from this room is much better.',
				'The chamber settles. Normal reward. Safer path.',
				'A violent shortcut opens — then an explosion fight.',
			],
			ice: [
				'Chill spikes. Stronger frost variants. Better cache.',
				'The ice holds. Standard relic.',
				'A frozen shaft cracks open. Surviving the blast is the price.',
			],
			earth: [
				'Tremor climbs. More crawlers. Richer crystals.',
				'The warren steadies. Modest amber.',
				'A root-shaft tears open as a shortcut. Cave-in combat first.',
			],
			iron: [
				'Pressure climbs. Extra drones. Better plates.',
				'The line holds. Standard slag.',
				'A service tunnel blows open. Then the room detonates.',
			],
		};
		const A = titles[t] || titles.fire;
		const B = bodies[t] || bodies.fire;
		el.style.display = 'flex';
		el.innerHTML = '<div class="dch-panel"><h3>' + (it.name || 'Choice') + '</h3>' +
			'<button data-pick="overload">' + A[0] + '<small>' + B[0] + '</small></button>' +
			'<button data-pick="stabilize">' + A[1] + '<small>' + B[1] + '</small></button>' +
			'<button data-pick="destroy">' + A[2] + '<small>' + B[2] + '</small></button>' +
			'<button data-pick="cancel" class="dch-cancel">Leave it</button></div>';
		el.querySelectorAll('button').forEach(btn => {
			btn.onclick = () => pickChoice(btn.getAttribute('data-pick'));
		});
	}

	function pickChoice(pick){
		const it = Env.choiceTarget;
		closeChoice();
		if(!it || pick === 'cancel') return;
		it.used = true;
		const room = rooms()[it.roomId];
		if(pick === 'overload'){
			Env.modifiers.furnaceOverload = true;
			addHeat(16, '+HEAT');
			if(room) spawnWave(room, 4);
			grantLoot(themeLoot(true), 'The chamber answers greed.');
			showBanner('Overload — the dungeon grows hungrier.');
		} else if(pick === 'stabilize'){
			addHeat(-6, null);
			grantLoot(themeLoot(false), 'The chamber steadies.');
		} else if(pick === 'destroy'){
			it.used = true;
			if(room) spawnWave(room, 3);
			addHeat(10, '+HEAT');
			if(it.shortcut){
				stampTiles(it.shortcut.x, it.shortcut.y, it.shortcut.w, it.shortcut.h, true);
				if(typeof computeTileEdges === 'function') computeTileEdges();
				Env.modifiers.shortcut = true;
			}
			if(typeof shakeScreen === 'function') shakeScreen(14, 28);
			showBanner('A shortcut tears open — survive the blast.');
			grantLoot(themeLoot(false), 'Scorched salvage.');
		}
		if(room) clearRoom(room, 'The furnace answers.');
	}

	function openShrine(it){
		Env.choiceOpen = true;
		Env.choiceTarget = it;
		const el = document.getElementById('dungeonChoice');
		if(!el) return;
		el.style.display = 'flex';
		const ice = theme() === 'ice';
		const title = it.name || (ice ? 'Frost Shrine' : 'Forgotten Shrine');
		const rare = !!it.rare;
		el.innerHTML = ice
			? ('<div class="dch-panel"><h3>' + title + (rare ? ' — Ancient' : '') + '</h3>' +
				'<button data-pick="sink">Glacial Heart<small>Frost gathers far more slowly.</small></button>' +
				'<button data-pick="step">Winter Step<small>Far better footing on ice.</small></button>' +
				'<button data-pick="cinder">Cold Blood<small>The cold, the squall and falling ice all bite less.</small></button>' +
				'<button data-pick="fortune">Frozen Fortune<small>Better rewards, but Frost rises faster.</small></button>' +
				'<button data-pick="cancel" class="dch-cancel">Leave it</button></div>')
			: ('<div class="dch-panel"><h3>' + title + '</h3>' +
				'<button data-pick="cinder">Cinder Heart<small>Increased damage for the rest of this run.</small></button>' +
				'<button data-pick="sink">Heat Sink<small>Reduced Heat accumulation.</small></button>' +
				'<button data-pick="step">Molten Step<small>Lava burns you less.</small></button>' +
				'<button data-pick="fortune">Infernal Fortune<small>Better rewards, but Heat rises faster.</small></button>' +
				'<button data-pick="cancel" class="dch-cancel">Leave it</button></div>');
		el.querySelectorAll('button').forEach(btn => {
			btn.onclick = () => pickShrine(btn.getAttribute('data-pick'));
		});
	}

	function pickShrine(pick){
		const it = Env.choiceTarget;
		closeChoice();
		if(!it || pick === 'cancel') return;
		it.used = true;
		Env.blessings.cinder = pick === 'cinder';
		Env.blessings.sink = pick === 'sink';
		Env.blessings.step = pick === 'step';
		Env.blessings.fortune = pick === 'fortune';
		if(pick === 'fortune') addHeat(14, theme() === 'ice' ? '+FROST' : '+HEAT');
		if(theme() === 'ice'){
			if(pick === 'sink') showBanner('Glacial Heart — frost gathers more slowly.');
			if(pick === 'cinder') showBanner('Cold Blood — the cold loses its bite.');
			if(pick === 'step') showBanner("Winter Step — the ice answers your feet.");
			if(pick === 'fortune') showBanner('Frozen Fortune — greed accepted.');
		} else {
			if(pick === 'cinder') showBanner('Cinder Heart — your spells bite harder.');
			if(pick === 'sink') showBanner('Heat Sink — the volcano notices you less.');
			if(pick === 'step') showBanner('Molten Step — lava loses its teeth.');
			if(pick === 'fortune') showBanner('Infernal Fortune — greed accepted.');
		}
	}

	function acceptRisk(it){
		it.used = true;
		addHeat(18, '+HEAT');
		const room = rooms()[it.roomId];
		if(room) spawnWave(room, 3);
		grantLoot(themeLoot(true), 'The chamber answers the risk.');
		showBanner('Heat climbs. The reward improves.');
	}

	function startTrial(it){
		const room = rooms()[it.roomId];
		if(!room) return;
		it.used = true;
		room._trialActive = true;
		room._trialLeft = 360;
		room._trialTouchedLava = false;
		spawnWave(room, 4);
		showBanner(theme() === 'ice' ? 'FROST TRIAL — clear the court without going into the water.' : 'FIRE TRIAL — defeat them without touching lava.');
	}

	function updateTrial(){
		const r = Env.currentRoom;
		if(!r || !r._trialActive) return;
		r._trialLeft--;
		if(ice()){
			/* Meltwater is the ice trial's fail state, not lava. */
			for(const hz of hazards()){
				if(hz.roomId !== r.id) continue;
				if(hz.type === 'water' && playerInRect(hz.x, hz.y, hz.w, hz.h)) r._trialTouchedLava = true;
				if(hz.type === 'rise' && hz.level != null && playerInRect(hz.x, hz.level, hz.w, (r.y + r.h) - hz.level)) r._trialTouchedLava = true;
			}
		} else {
			for(const dec of ((getDungeon() && getDungeon().decorations) || [])){
				if((dec.type === 'lava' || dec.type === 'iceWater') && playerInRect(dec.x, dec.y, dec.w, dec.h)) r._trialTouchedLava = true;
			}
		}
		if(r._trialTouchedLava){
			r._trialActive = false;
			showBanner(theme() === 'ice' ? 'The trial fails — the water took you.' : 'The trial fails. The lava marked you.');
			return;
		}
		if(roomEnemies(r).length === 0){
			r._trialActive = false;
			r._trialDone = true;
			grantLoot(themeLoot(true), 'The trial yields.');
			if(typeof playerData !== 'undefined' && playerData){
				playerData.gold = (playerData.gold || 0) + 90;
			}
		} else if(r._trialLeft <= 0){
			r._trialActive = false;
			showBanner('The trial overheats.');
		}
	}

	function openCore(it){
		const ice = theme() === 'ice';
		const wardenRoom = rooms().some(r => r.kind === 'warden');
		const knightRoom = rooms().some(r => r.kind === 'knight');
		if(ice && knightRoom && !Env.modifiers.knightSlain){
			showBanner('The core is dark. A knight still holds the ice.');
			return;
		}
		if(!ice && wardenRoom && !Env.modifiers.wardenSlain){
			showBanner('The core is dark. A guardian still holds its fire.');
			return;
		}
		Env.choiceOpen = true;
		Env.choiceTarget = it;
		const el = document.getElementById('dungeonChoice');
		if(!el) return;
		el.style.display = 'flex';
		el.innerHTML = ice
			? ('<div class="dch-panel"><h3>Frostborn Core</h3>' +
				'<button data-pick="overheat">Absolute Zero<small>Ice abilities grow stronger. Frost accumulates faster.</small></button>' +
				'<button data-pick="stable">Permafrost<small>Frost accumulation is significantly reduced.</small></button>' +
				'<button data-pick="volcanic">Winter\'s Step<small>Improved movement and control on ice.</small></button>' +
				'<button data-pick="cancel" class="dch-cancel">Leave it</button></div>')
			: ('<div class="dch-panel"><h3>Furnace Core</h3>' +
				'<button data-pick="overheat">Overheated<small>Higher remaining difficulty. +25% rewards.</small></button>' +
				'<button data-pick="stable">Stable Core<small>Lower Heat accumulation.</small></button>' +
				'<button data-pick="volcanic">Volcanic Core<small>Your fire abilities deal increased damage.</small></button>' +
				'<button data-pick="cancel" class="dch-cancel">Leave it</button></div>');
		el.querySelectorAll('button').forEach(btn => {
			btn.onclick = () => pickCore(btn.getAttribute('data-pick'));
		});
	}

	function pickCore(pick){
		const it = Env.choiceTarget;
		closeChoice();
		if(!it || pick === 'cancel') return;
		it.used = true;
		Env.corePick = pick;
		if(pick === 'overheat'){
			Env.lootMult *= 1.25;
			if(theme() === 'ice'){
				Env.blessings.fortune = true;
				Env.modifiers.volcanicCore = true;
			}
			addHeat(12, theme() === 'ice' ? '+FROST' : '+HEAT');
			showBanner(theme() === 'ice' ? 'Absolute Zero — ice answers you. Frost gathers faster.' : 'Overheated — the core burns the rest of the run.');
		} else if(pick === 'stable'){
			Env.blessings.sink = true;
			addHeat(-16, null);
			showBanner(theme() === 'ice' ? 'Permafrost — the glacier eases.' : 'Stable Core — the volcano eases.');
		} else if(pick === 'volcanic'){
			if(theme() === 'ice'){
				Env.blessings.step = true;
				showBanner("Winter's Step — the ice answers your feet.");
			} else {
				Env.modifiers.volcanicCore = true;
				showBanner('Volcanic Core — fire answers you.');
			}
		}
	}

	function openPrison(it){
		it.used = true;
		showBanner('THE PRISON BREAKS');
		addHeat(8, '+FROST');
		const room = rooms()[it.roomId];
		if(room) spawnWave(room, 1);
		if(typeof ENEMY_TYPES !== 'undefined' && ENEMY_TYPES.glacierSentinel && room){
			const t = ENEMY_TYPES.glacierSentinel;
			enemies.push({
				type: 'glacierSentinel', typeDef: t,
				x: room.x + room.w / 2 - t.w / 2, y: room.y + room.h - t.h - 8,
				w: Math.round(t.w * DIFF_SIZE_MULT), h: Math.round(t.h * DIFF_SIZE_MULT),
				vx:0, vy:0, hp:Math.round(t.hp * DIFF_HP_MULT * 1.45), maxHp:Math.round(t.hp * DIFF_HP_MULT * 1.45),
				facing:1, patrol:[room.x + 60, room.x + room.w - 60], patrolDir:1, state:'alert',
				alertTimer:180, spellCooldowns:t.spells.map(() => 20), currentSpell:0, flash:0, dots:[],
				stunTimer:0, slowTimer:0, animTimer:0, attackAnimTimer:0, dead:false, deathTimer:0,
				baseY: room.y + room.h - t.h - 8, flyOffset:0, charging:false, chargeVx:0, chargeVy:0, chargeTimer:0,
				chargeCastDone:false, bossPhase:1, _safeX:room.x + room.w / 2, _safeY:room.y + room.h - t.h - 8,
				puzzleSeg:room.depth, roomId: room.id,
			});
		}
	}

	function openMemory(it){
		it.used = true;
		grantLoot(themeLoot(!!it.rare), 'A frozen memory yields.');
		showBanner('The ice remembers what this place once was.');
	}

	function openCache(it){
		if(it && combatChestLocked(it)){
			showBanner('Defeat every enemy in this room first.');
			return;
		}
		if(global.ChestLoot && ChestLoot.beginOpen(it, {
			better: !!it.rare,
			gold: it.rare ? 80 : 35,
			label: it.rare ? 'A hidden chest.' : (theme() === 'ice' ? 'A frozen chest.' : 'An ember chest.')
		})) return;
		it.used = true;
		grantLoot(themeLoot(!!it.rare), it.rare ? 'A hidden cache.' : (theme() === 'ice' ? 'Frozen cache.' : 'Ember cache.'));
		if(typeof playerData !== 'undefined' && playerData){
			playerData.gold = (playerData.gold || 0) + (it.rare ? 80 : 35);
			try{ localStorage.setItem('magicBattle_playerData', JSON.stringify(playerData)); }catch(e){}
		}
	}

	function openVault(it){
		it.used = true;
		showBanner('THE VAULT HAS AWAKENED');
		addHeat(12, theme() === 'ice' ? '+FROST' : '+HEAT');
		const room = rooms()[it.roomId];
		if(room){
			if(room.outGates){
				for(const g of room.outGates) sealGate(g, true);
			}
			room.locked = true;
			room.cleared = false;
			spawnWave(room, 5);
		}
		for(const hz of hazards()){
			if(hz.vault && hz.roomId === it.roomId){ hz.active = true; hz.armed = true; }
		}
		it._pendingLoot = true;
		it._survive = 360;
	}

	function tryInteract(){
		if(!IS_DUNGEON || Env.choiceOpen) return false;
		if(global.FirePuzzles && FirePuzzles.tryNearby()) return true;
		if(global.IcePuzzles && IcePuzzles.tryNearby()) return true;
		if(global.SpecialRooms && SpecialRooms.tryInteract()) return true;
		if(jungle() && jungle().tryInteract()) return true;
		/* Ice-only fixtures (hearths, rings, cracked ice, relics) first. */
		if(ice() && ice().tryInteract()) return true;
		const px = player.x + player.w / 2, py = player.y + player.h / 2;
		for(const it of interacts()){
			if(it.used || it.kind === 'banner' || it.kind === 'doorSign') continue;
			const hw = (it.w || 60) / 2, hh = (it.h || 60) / 2;
			const reach = it.kind === 'channelLever' ? 110 : 96;
			if(Math.abs(px - (it.x + hw)) > reach || Math.abs(py - (it.y + hh)) > reach + 12) continue;
			if(it.kind === 'channelLever'){
				if(!it.reusable) it.used = true;
				if(it.hazardRef){
					it.hazardRef.safe = it.hazardRef.safe === 'left' ? 'right' : 'left';
					it.hazardRef.timer = 0;
					if(typeof shakeScreen === 'function') shakeScreen(6, 12);
				}
				return true;
			}
			if(it.kind === 'choice'){ openChoice(it); return true; }
			if(it.kind === 'shrine'){ openShrine(it); return true; }
			if(it.kind === 'risk'){ acceptRisk(it); return true; }
			if(it.kind === 'cool'){
				it.used = true;
				addHeat(-22, null);
				showBanner(theme() === 'ice' ? 'Warmth returns. Frost recedes.' : 'Heat sinks into the stone.');
				return true;
			}
			if(it.kind === 'valve'){
				it.used = true;
				showBanner(theme() === 'ice' ? 'A frozen mechanism turns.' : 'A magma valve turns.');
				if(typeof shakeScreen === 'function') shakeScreen(4, 8);
				return true;
			}
			if(it.kind === 'prison'){ openPrison(it); return true; }
			if(it.kind === 'memory'){ openMemory(it); return true; }
			if(it.kind === 'cache'){ openCache(it); return true; }
			if(it.kind === 'trial'){ startTrial(it); return true; }
			if(it.kind === 'core'){ openCore(it); return true; }
			if(it.kind === 'secretWall'){
				it.used = true;
				const room = rooms()[it.roomId];
				const dest = rooms()[it.secretTo];
				if(dest && dest._secretHall){
					stampTiles(dest._secretHall.x, dest._secretHall.y, dest._secretHall.w, dest._secretHall.h, true);
					if(typeof computeTileEdges === 'function') computeTileEdges();
				}
				showBanner(theme() === 'ice' ? 'The ice wall shatters.' : 'The wall crumbles.');
				addHeat(4, null);
				return true;
			}
			if(it.kind === 'vault'){ openVault(it); return true; }
			if(it.kind === 'wardenStart'){ startWardenFight(it); return true; }
		}
		return false;
	}

	function startWardenFight(it){
		if(!it || it.used) return;
		it.used = true;
		const room = rooms()[it.roomId];
		if(!room) return;
		room._wardenArmed = true;
		room.cleared = false;
		sealRoomArena(room, true);
		if(typeof enemies !== 'undefined'){
			for(let i = 0; i < enemies.length; i++){
				const en = enemies[i];
				if(!en || en.dead || en.type !== 'magmaWarden') continue;
				if(en.roomId != null && en.roomId !== room.id) continue;
				en._wardenDormant = false;
				en.isDormant = false;
				en._mwPlanted = false;
				plantWarden(en, room);
			}
		}
		showBanner('THE MAGMA WARDEN AWAKENS');
		boostWardenVents(room, false);
		if(typeof shakeScreen === 'function') shakeScreen(16, 24);
		if(typeof notify === 'function') notify('The doors seal.');
		updateObjectiveHUD();
	}

	function updateVaults(){
		for(const it of interacts()){
			if(it.kind !== 'vault' || !it._pendingLoot) continue;
			it._survive--;
			const rise = hazards().find(h => h.vault && h.roomId === it.roomId);
			const riseDone = rise && rise._upDone && rise._hold <= 0 && !rise.active;
			if(it._survive <= 0 || riseDone){
				it._pendingLoot = false;
				if(typeof health === 'undefined' || health > 0){
					if(global.ChestLoot && ChestLoot.beginOpen(it, { better:true, gold:90, label:'The vault yields.' })){ /* chest anim */ }
					else grantLoot(themeLoot(true), 'The vault yields.');
				}
			}
		}
	}

	function nearbyPrompt(){
		if(!IS_DUNGEON) return null;
		if(global.FirePuzzles){
			const fp = FirePuzzles.prompt();
			if(fp) return fp;
		}
		if(global.IcePuzzles){
			const ip = IcePuzzles.prompt();
			if(ip) return ip;
		}
		if(global.SpecialRooms){
			const sp = SpecialRooms.prompt();
			if(sp) return sp;
		}
		if(jungle()){
			const p = jungle().prompt();
			if(p) return p;
		}
		if(ice()){
			const p = ice().prompt();
			if(p) return p;
		}
		const px = player.x + player.w / 2, py = player.y + player.h / 2;
		for(const it of interacts()){
			if(it.used || it.kind === 'banner' || it.kind === 'doorSign') continue;
			if(Math.abs(px - (it.x + (it.w || 60) / 2)) < (it.kind === 'channelLever' ? 120 : 96) && Math.abs(py - (it.y + (it.h || 60) / 2)) < (it.kind === 'channelLever' ? 120 : 110)){
				if(it.kind === 'vault') return 'E — Open the vault';
				if(it.kind === 'channelLever') return 'Press E — Switch the geysers';
				if(it.kind === 'shrine') return 'E — Choose a blessing';
				if(it.kind === 'risk') return 'E — Accept greater heat';
				if(it.kind === 'cool') return theme() === 'ice' ? 'E — Warm yourself' : 'E — Cool down';
				if(it.kind === 'valve') return theme() === 'ice' ? 'E — Activate the mechanism' : 'E — Turn the valve';
				if(it.kind === 'cache') return combatChestLocked(it) ? 'Defeat all enemies to open the chest' : 'E — Open the chest';
				if(it.kind === 'trial') return 'E — Begin the trial';
				if(it.kind === 'core') return theme() === 'ice' ? 'E — Use the Frostborn Core' : 'E — Use the Furnace Core';
				if(it.kind === 'secretWall') return theme() === 'ice' ? 'E — Break the cracked ice' : 'E — Break the cracked wall';
				if(it.kind === 'choice') return 'E — Interact with the furnace';
				if(it.kind === 'wardenStart') return 'E — Challenge the Magma Warden';
				if(it.kind === 'prison') return 'E — Free the prisoner';
				if(it.kind === 'memory') return 'E — Study the frozen memory';
				return 'E — Interact';
			}
		}
		return null;
	}

	/* ---------- Magma Warden + elemental cousins ---------- */
	function wardenRoom(en){
		return rooms()[en.roomId] || roomAt(en.x + en.w / 2, en.y);
	}

	function isMagmaWarden(en){ return en && en.type === 'magmaWarden'; }

	function wardenWalkSurface(room){
		return room.y + room.h - (room.raisedFloor || 0);
	}

	function wardenGroundY(en, room){
		const walk = wardenWalkSurface(room);
		let best = walk - en.h;
		const cx = en.x + en.w * 0.5;
		const feet = en.y + en.h;
		const plats = platforms();
		let platY = null;
		for(let i = 0; i < plats.length; i++){
			const p = plats[i];
			if(!p || p._gone) continue;
			if(p.roomId != null && room && p.roomId !== room.id) continue;
			if(cx < p.x + 4 || cx > p.x + p.w - 4) continue;
			const top = p.y;
			if(p.arenaSection === 'core' || p.central){
				if(feet >= top - 90 && feet <= top + 80) return top - en.h;
			}
			if(feet >= top - 36 && feet <= top + 52){
				if(platY == null || top < platY + en.h) platY = top - en.h;
			}
		}
		if(typeof projectiles !== 'undefined' && typeof getSolidBox === 'function'){
			for(let i = 0; i < projectiles.length; i++){
				const p = projectiles[i];
				if(!p || !p.isSolidPlatform || p.hasHit) continue;
				const b = getSolidBox(p);
				if(!b || cx < b.x + 2 || cx > b.x + b.w - 2) continue;
				if(feet >= b.y - 36 && feet <= b.y + 52){
					if(platY == null || b.y < platY + en.h) platY = b.y - en.h;
				}
			}
		}
		return platY != null ? platY : best;
	}

	function wardenPads(room){
		const walk = wardenWalkSurface(room);
		const pads = [{ x: room.x + 40, y: walk, w: room.w - 80, h: 16, floor: true }];
		const plats = platforms();
		for(let i = 0; i < plats.length; i++){
			const p = plats[i];
			if(!p || p._gone) continue;
			if(p.roomId != null && p.roomId !== room.id) continue;
			pads.push({ x: p.x, y: p.y, w: p.w, h: p.h || 16 });
		}
		if(typeof projectiles !== 'undefined' && typeof getSolidBox === 'function'){
			for(let i = 0; i < projectiles.length; i++){
				const p = projectiles[i];
				if(!p || !p.isSolidPlatform || p.hasHit) continue;
				const b = getSolidBox(p);
				if(!b || b.w < 24) continue;
				if(b.x + b.w < room.x || b.x > room.x + room.w) continue;
				if(b.y < room.y || b.y > room.y + room.h) continue;
				pads.push({ x: b.x, y: b.y, w: b.w, h: b.h, solidify: p });
			}
		}
		return pads;
	}

	function padUnder(pads, x, y, w, h){
		const feet = y + h;
		const cx = x + w * 0.5;
		let best = null, bestDist = 80;
		for(let i = 0; i < pads.length; i++){
			const p = pads[i];
			if(cx < p.x - 24 || cx > p.x + p.w + 24) continue;
			const d = Math.abs(feet - p.y);
			if(d < bestDist){ best = p; bestDist = d; }
		}
		return best;
	}

	function padsAdjacent(a, b){
		if(!a || !b || a === b) return false;
		const xGap = Math.max(0, a.x - (b.x + b.w), b.x - (a.x + a.w));
		const yGap = Math.abs(a.y - b.y);
		return xGap < 300 && yGap < 240;
	}

	function pickLeapPad(en, room){
		const pads = wardenPads(room);
		if(!pads.length) return null;
		const playerPad = padUnder(pads, player.x, player.y, player.w, player.h);
		const wardenPad = padUnder(pads, en.x, en.y, en.w, en.h);
		if(playerPad && playerPad !== wardenPad) return playerPad;
		if(playerPad){
			const adj = [];
			for(let i = 0; i < pads.length; i++){
				if(padsAdjacent(playerPad, pads[i])) adj.push(pads[i]);
			}
			if(adj.length) return adj[Math.floor(Math.random() * adj.length)];
			return playerPad;
		}
		let best = pads[0], bestD = 1e12;
		const pcx = player.x + player.w * 0.5, pcy = player.y + player.h;
		for(let i = 0; i < pads.length; i++){
			const p = pads[i];
			const dx = (p.x + p.w * 0.5) - pcx;
			const dy = p.y - pcy;
			const d = dx * dx + dy * dy;
			if(d < bestD){ best = p; bestD = d; }
		}
		return best;
	}

	function igniteSolidify(sp){
		if(!sp || !sp.isSolidPlatform || sp.hasHit) return;
		if(sp._wardenBurn != null) return;
		const fps = (typeof FPS === 'number' && FPS > 0) ? FPS : 60;
		sp._wardenBurn = Math.max(1, Math.round(fps * 0.5));
	}

	function wardenBurnSolidsAt(x, y, w, h){
		if(typeof projectiles === 'undefined') return;
		for(let i = 0; i < projectiles.length; i++){
			const p = projectiles[i];
			if(!p || !p.isSolidPlatform || p.hasHit) continue;
			let hit = false;
			if(typeof rectOverlapSolid === 'function') hit = rectOverlapSolid(x, y, w, h, p);
			else if(typeof getSolidBox === 'function'){
				const b = getSolidBox(p);
				hit = b && x < b.x + b.w && x + w > b.x && y < b.y + b.h && y + h > b.y;
			}
			if(hit) igniteSolidify(p);
		}
	}

	function tickWardenBurns(){
		if(typeof projectiles === 'undefined') return;
		for(let i = 0; i < projectiles.length; i++){
			const p = projectiles[i];
			if(!p || !p.isSolidPlatform || p._wardenBurn == null) continue;
			p._wardenBurn--;
			if(typeof particles !== 'undefined' && (p._wardenBurn % 3 === 0)){
				const b = (typeof getSolidBox === 'function') ? getSolidBox(p) : { x: p.x, y: p.y, w: 40, h: 16 };
				particles.push({
					x: b.x + Math.random() * b.w, y: b.y + Math.random() * Math.max(6, b.h * 0.4),
					vx: (Math.random() - 0.5) * 2.4, vy: -1.6 - Math.random() * 2.2,
					life: 12 + Math.random() * 12,
					color: ['#ff3300', '#ff7700', '#ffcc44', '#ffaa22'][(Math.random() * 4) | 0],
				});
			}
			if(p._wardenBurn <= 0){
				p.hasHit = true;
				p._wardenBurn = null;
			}
		}
	}

	function plantWarden(en, room){
		if(!en || !room || en._mwPlanted) return;
		en._mwPlanted = true;
		const plats = platforms();
		let core = null;
		for(let i = 0; i < plats.length; i++){
			const p = plats[i];
			if(!p || p._gone || p.roomId !== room.id) continue;
			if(p.arenaSection === 'core' || p.central){ core = p; break; }
		}
		if(core){
			en.x = core.x + core.w * 0.5 - en.w / 2;
			en.y = core.y - en.h;
		} else {
			en.y = wardenGroundY(en, room);
		}
		en.vy = 0;
		en._safeY = en.y;
	}

	function wardenTel(x, y, w, h, frames, label){
		if(typeof spawnTelegraph === 'function'){
			spawnTelegraph(x, y, w, h, frames, 'rgba(255,90,12,0.42)', 'rect', label || '');
		}
	}

	function wardenShock(en, x, y, w, h, life, dmg, extra){
		en._zones = en._zones || [];
		en._zones.push(Object.assign({ x, y, w, h, life, dmg: dmg || 16, hot: isMagmaWarden(en) }, extra || {}));
		if(isMagmaWarden(en) && dmg > 0) wardenBurnSolidsAt(x, y, w, h);
		if(isMagmaWarden(en) && dmg > 0 && typeof particles !== 'undefined'){
			const n = Math.min(14, 6 + (w * h) / 4000);
			for(let i = 0; i < n; i++){
				particles.push({
					x: x + Math.random() * w, y: y + Math.random() * h,
					vx: (Math.random() - 0.5) * 5, vy: -1.2 - Math.random() * 3.4,
					life: 16 + Math.random() * 18,
					color: ['#ff3300', '#ff7700', '#ffcc44', '#ffaa22'][i % 4],
				});
			}
		}
	}

	function updateWarden(en){
		if(!en || en.dead) return false;
		if(!en.typeDef || !en.typeDef.isMiniBoss) return false;
		if(en.type === 'frostboundKnight') return false;
		if(en._wardenDormant || en.isDormant) return true;
		const room = wardenRoom(en);
		if(!room) return false;
		const magma = isMagmaWarden(en);
		plantWarden(en, room);
		const px = player.x + player.w / 2, py = player.y + player.h / 2;
		const cx = en.x + en.w / 2, cy = en.y + en.h / 2;
		en.facing = px > cx ? 1 : -1;
		if(en._cd == null) en._cd = magma ? 18 : 90;
		en._cd--;
		en._atk = en._atk || null;
		en._zones = en._zones || [];
		const burn = magma
			? [{ type:'burn', dmg:4, interval:22, ticks:4, color:'#ff5500' }]
			: [{ type:'burn', dmg:2, interval:30, ticks:2, color:'#ff5500' }];
		for(let i = en._zones.length - 1; i >= 0; i--){
			const z = en._zones[i];
			if(z.vx) z.x += z.vx;
			if(z.grow){ z.w += z.grow; z.x -= z.grow * 0.5; }
			z.life--;
			if(z.dmg > 0 && playerInRect(z.x, z.y, z.w, z.h) && player.iFrames <= 0){
				damagePlayer(Math.round((z.dmg || 14) * DIFF_DMG_MULT), burn);
			}
			if(magma && z.dmg > 0) wardenBurnSolidsAt(z.x, z.y, z.w, z.h);
			if(z.life <= 0) en._zones.splice(i, 1);
		}
		if(magma && en._atk && (en._atk.name === 'rush' || en._atk.name === 'leap' || en._atk.name === 'fist' || en._atk.name === 'uppercut' || en._atk.name === 'hammer')){
			wardenBurnSolidsAt(en.x, en.y, en.w, en.h);
		}

		en.vy = (en.vy || 0) + 0.55;
		en.y += en.vy;
		const leaping = !!(en._atk && ((en._atk.name === 'leap' && !en._atk.landed) || en._atk.name === 'uppercut'));
		const fl = wardenGroundY(en, room);
		if(!leaping && en.y > fl){ en.y = fl; en.vy = 0; }
		if(en.x < room.x + 40) en.x = room.x + 40;
		if(en.x + en.w > room.x + room.w - 40) en.x = room.x + room.w - 40 - en.w;

		if(en._atk){
			en._atk.t++;
			runWardenAttack(en, room);
			return true;
		}

		const hpR = en.maxHp ? (en.hp / en.maxHp) : 1;
		if(!en._wardenPhase) en._wardenPhase = 1;
		if(hpR <= 0.70 && en._wardenPhase < 2){
			en._wardenPhase = 2;
			showBanner(magma ? 'The furnace ignites.' : 'The warden hardens.');
			if(typeof shakeScreen === 'function') shakeScreen(magma ? 14 : 10, magma ? 22 : 18);
			for(const hz of hazards()){
				if(hz.roomId === room.id && hz.type === 'channel') hz.flipEvery = Math.max(180, (hz.flipEvery || 400) * 0.7);
			}
		}
		if(hpR <= 0.35 && en._wardenPhase < 3){
			en._wardenPhase = 3;
			showBanner(magma ? 'Lava is rising. Finish this.' : 'The warden enrages.');
			en._atk = { name: magma ? 'lavaRise' : 'core', t:0 };
			en.attackAnimTimer = magma ? 70 : 40;
			return true;
		}

		if(en._cd > 0){
			const walkSpd = magma ? (en._wardenPhase >= 3 ? 3.6 : 2.8) : (en._wardenPhase >= 3 ? 1.15 : 0.6);
			en.x += Math.sign(px - cx) * walkSpd;
			if(en.x < room.x + 40) en.x = room.x + 40;
			if(en.x + en.w > room.x + room.w - 40) en.x = room.x + room.w - 40 - en.w;
			return true;
		}
		let pool = ['fist', 'uppercut', 'hammer'];
		if(magma && (en._leapCd || 0) <= 0) pool = pool.concat(['leap']);
		if(en._wardenPhase >= 2) pool = pool.concat(['core', 'rush', 'collapse']);
		if(en._wardenPhase >= 3) pool = pool.concat(['lavaRise', 'rush', 'core']);
		if(!magma){
			pool = pool.filter(n => n !== 'collapse' && n !== 'lavaRise' && n !== 'leap');
			if(en.hp < en.maxHp * 0.4) pool.push('core');
		}
		const dist = Math.abs(px - cx);
		let pick = pool[Math.floor(Math.random() * pool.length)];
		if(magma){
			const pads = wardenPads(room);
			const pp = padUnder(pads, player.x, player.y, player.w, player.h);
			const wp = padUnder(pads, en.x, en.y, en.w, en.h);
			const heightGap = Math.abs((player.y + player.h) - (en.y + en.h));
			en._leapCd = (en._leapCd || 0) - 1;
			if((en._leapCd || 0) <= 0 && heightGap > 140 && pp && wp && pp !== wp && Math.random() < 0.28) pick = 'leap';
			else if(dist > 420 && pool.indexOf('rush') >= 0 && Math.random() < 0.6) pick = 'rush';
			else if(dist < 170 && Math.random() < 0.55) pick = Math.random() < 0.5 ? 'fist' : 'uppercut';
		}
		en._atk = { name: pick, t: 0 };
		en.attackAnimTimer = magma ? 64 : 40;
		return true;
	}

	function boostWardenVents(room, erupt){
		if(!room) return;
		for(const hz of hazards()){
			if(!hz || hz.roomId !== room.id || hz.type !== 'vent') continue;
			if(hz._baseColH == null) hz._baseColH = hz.columnH || 220;
			hz.columnH = Math.max(hz._baseColH * 2.8, 620);
			hz._wardenJet = true;
			if(erupt) hz._t = 52;
		}
	}
	function eruptWardenGeysers(en, room){
		boostWardenVents(room, true);
		const ground = wardenWalkSurface(room);
		const n = 6;
		const span = room.w - 220;
		for(let i = 0; i < n; i++){
			const sx = room.x + 80 + (i + 0.15 + Math.random() * 0.7) * (span / n);
			const h = 560 + Math.random() * 160;
			wardenTel(sx - 10, ground - h, 78, h, 18, '');
			wardenShock(en, sx, ground - h, 70, h, 78, 34);
		}
		if(typeof shakeScreen === 'function') shakeScreen(10, 16);
	}

	function runWardenAttack(en, room){
		const a = en._atk;
		const magma = isMagmaWarden(en);
		const ground = wardenWalkSurface(room);
		const floorY = wardenGroundY(en, room);
		const cx = en.x + en.w / 2;
		if(a.name === 'fist'){
			const hitAt = magma ? 26 : 42;
			en._wind = a.t < hitAt;
			if(magma && a.t === 1) wardenTel(cx + en.facing * 20, ground - 78, 600, 78, 24, 'FIST');
			if(a.t === hitAt){
				const dir = en.facing;
				if(typeof spawnEnemyProj === 'function'){
					const fist = spawnEnemyProj(cx + dir * (magma ? 90 : 50), ground - (magma ? 48 : 22), dir * (magma ? 12.5 : 8.5), 0, {
						color:'#ff5500', color2:'#ffaa33', power: magma ? 40 : 24,
						width: magma ? 72 : 32, height: magma ? 48 : 20,
						shape:'rect', maxAge: magma ? 48 : 36, effects:['horizontalLaunch'],
					});
					if(fist && magma) fist._wardenHit = true;
				}
				wardenShock(en, cx + dir * 10, ground - (magma ? 72 : 30), magma ? 600 : 260, magma ? 72 : 30, magma ? 160 : 200, magma ? 38 : 18);
				if(magma){
					wardenShock(en, cx + dir * 220, ground - 130, 130, 130, 70, 28);
					if(typeof shakeScreen === 'function') shakeScreen(10, 14);
				}
			}
			if(a.t > (magma ? 50 : 70)){ en._atk = null; en._cd = magma ? 36 : 75; }
		} else if(a.name === 'uppercut'){
			if(a.t < (magma ? 16 : 22)) en.y = Math.min(en.y + 0.8, floorY);
			if(magma && a.t === 1) wardenTel(en.x - 56, room.y + 30, en.w + 112, ground - room.y - 30, 18, '');
			if(a.t === (magma ? 18 : 24)){
				en.vy = magma ? -18 : -16;
				wardenShock(en, en.x - (magma ? 56 : 16), room.y + 40, en.w + (magma ? 112 : 32), ground - room.y - 40, magma ? 80 : 90, magma ? 44 : 22);
				if(magma && typeof shakeScreen === 'function') shakeScreen(12, 16);
			}
			if(a.t === (magma ? 34 : 40)){
				wardenShock(en, en.x - (magma ? 36 : 8), room.y + 50, en.w + (magma ? 72 : 16), magma ? 560 : 320, magma ? 64 : 70, magma ? 30 : 16);
			}
			if(a.t > (magma ? 68 : 85)){ en._atk = null; en._cd = magma ? 40 : 85; }
		} else if(a.name === 'hammer'){
			const waveH = magma ? 96 : 24;
			if(magma && a.t === 1) wardenTel(room.x + 20, ground - waveH, room.w - 40, waveH, 20, 'HAMMER');
			if(a.t === (magma ? 22 : 30)){
				wardenShock(en, cx, ground - waveH, magma ? 230 : 90, waveH, magma ? 70 : 50, magma ? 36 : 16, { vx: magma ? 10.4 : 7.2 });
				wardenShock(en, cx - (magma ? 230 : 90), ground - waveH, magma ? 230 : 90, waveH, magma ? 70 : 50, magma ? 36 : 16, { vx: magma ? -10.4 : -7.2 });
				if(typeof shakeScreen === 'function') shakeScreen(magma ? 12 : 8, magma ? 14 : 10);
			}
			if(a.t === (magma ? 44 : 58)){
				wardenShock(en, cx, ground - waveH, magma ? 270 : 110, waveH, magma ? 80 : 64, magma ? 38 : 16, { vx: magma ? 7.2 : 4.4 });
				wardenShock(en, cx - (magma ? 270 : 110), ground - waveH, magma ? 270 : 110, waveH, magma ? 80 : 64, magma ? 38 : 16, { vx: magma ? -7.2 : -4.4 });
			}
			if(a.t === (magma ? 68 : 96)){
				wardenShock(en, cx, ground - (magma ? 108 : 28), magma ? 310 : 130, magma ? 108 : 28, magma ? 96 : 80, magma ? 42 : 18, { vx: magma ? 4.6 : 2.6 });
				wardenShock(en, cx - (magma ? 310 : 130), ground - (magma ? 108 : 28), magma ? 310 : 130, magma ? 108 : 28, magma ? 96 : 80, magma ? 42 : 18, { vx: magma ? -4.6 : -2.6 });
				if(typeof shakeScreen === 'function') shakeScreen(magma ? 14 : 10, magma ? 18 : 14);
			}
			if(a.t === (magma ? 78 : 108) && Math.abs(player.x - en.x) < (magma ? 160 : 100)){
				if(player.iFrames <= 0) damagePlayer(Math.round((magma ? 40 : 26) * DIFF_DMG_MULT), ['horizontalLaunch']);
			}
			if(a.t > (magma ? 88 : 124)){ en._atk = null; en._cd = magma ? 46 : 95; }
		} else if(a.name === 'core'){
			en._vulnerable = a.t > 12 && a.t < (magma ? 68 : 100);
			if(magma && a.t === 1) wardenTel(cx - 300, en.y - 36, 600, en.h + 110, 64, 'CORE');
			if(a.t === (magma ? 68 : 100)){
				en._vulnerable = false;
				if(typeof spawnEnemyProj === 'function'){
					const core = spawnEnemyProj(cx, en.y + en.h * 0.4, 0, 0, {
						color:'#ff3300', color2:'#ffee66', power: magma ? 44 : 30,
						width: magma ? 52 : 22, height: magma ? 52 : 22,
						shape:'ring', maxAge: magma ? 52 : 44, aoe:true, aoeRadius: magma ? 560 : 280, aoeMax: magma ? 78 : 44,
					});
					if(core && magma) core._wardenHit = true;
				}
				const pads = magma ? 8 : 6;
				for(let i = 0; i < pads; i++){
					wardenShock(en, room.x + 80 + i * ((room.w - 160) / pads), ground - (magma ? 110 : 40), magma ? 110 : 56, magma ? 110 : 40, magma ? 180 : 220, magma ? 28 : 13);
				}
				if(magma && typeof shakeScreen === 'function') shakeScreen(16, 20);
			}
			if(a.t > (magma ? 100 : 140)){ en._atk = null; en._cd = magma ? 52 : 110; }
		} else if(a.name === 'rush'){
			if(a.t === 1){
				en._rushDir = en.facing;
				if(magma) wardenTel(en.x + (en.facing > 0 ? en.w : -680), en.y - 16, 680, en.h + 32, 12, 'RUSH');
			}
			en.x += en._rushDir * (magma ? 11.2 : 6.2);
			if(a.t % (magma ? 8 : 12) === 0){
				wardenShock(en, en.x + 8, ground - (magma ? 110 : 46), magma ? 130 : 56, magma ? 110 : 46, magma ? 90 : 110, magma ? 30 : 15);
			}
			if(typeof rectRect === 'function' && rectRect(en, player) && player.iFrames <= 0){
				damagePlayer(Math.round((magma ? 42 : 28) * DIFF_DMG_MULT), ['horizontalLaunch']);
			}
			if(en.x < room.x + 24 || en.x + en.w > room.x + room.w - 24 || a.t > (magma ? 52 : 78)){
				en._atk = null; en._cd = magma ? 38 : 90;
			}
		} else if(a.name === 'leap'){
			if(a.t === 1){
				const dest = pickLeapPad(en, room);
				const destX = dest
					? Math.max(dest.x + 8, Math.min(dest.x + dest.w - en.w - 8, dest.x + dest.w * 0.5 - en.w * 0.5))
					: Math.max(room.x + 40, Math.min(player.x, room.x + room.w - en.w - 40));
				const destY = dest ? dest.y - en.h : wardenGroundY(en, room);
				a.destX = destX;
				a.destY = destY;
				a.landed = false;
				en.vy = -18;
				en._leapCd = 220;
				wardenTel(destX - 12, (dest ? dest.y : destY + en.h) - 10, en.w + 24, 18, 22, 'LEAP');
			}
			if(!a.landed){
				en.x += (a.destX - en.x) * 0.07;
				if(en.x < room.x + 40) en.x = room.x + 40;
				if(en.x + en.w > room.x + room.w - 40) en.x = room.x + room.w - 40 - en.w;
				if(en.vy >= 0 && en.y >= a.destY){
					en.y = a.destY;
					en.vy = 0;
					a.landed = true;
					a.landT = a.t;
					wardenShock(en, en.x - 72, en.y + en.h - 36, en.w + 144, 48, 40, 34);
					if(typeof shakeScreen === 'function') shakeScreen(10, 14);
					if(typeof rectRect === 'function' && rectRect(en, player) && player.iFrames <= 0){
						damagePlayer(Math.round(36 * DIFF_DMG_MULT), ['horizontalLaunch']);
					}
				}
			}
			if(a.landed && a.t > (a.landT || 0) + 16){ en._atk = null; en._cd = 48; }
			if(!a.landed && a.t > 120){ en._atk = null; en._cd = 40; }
		} else if(a.name === 'collapse'){
			if(a.t === 1){
				if(typeof shakeScreen === 'function') shakeScreen(magma ? 16 : 12, magma ? 40 : 50);
				showBanner('Furnace Collapse');
			}
			const warnAt = magma ? 24 : 40;
			const popAt = magma ? 50 : 78;
			const warn2 = magma ? 78 : 110;
			const pop2 = magma ? 102 : 142;
			if(a.t === warnAt){
				const spots = [];
				const n = magma ? 7 : 5;
				for(let i = 0; i < n; i++) spots.push(room.x + 100 + Math.random() * (room.w - 200));
				en._crackSpots = spots;
				for(const sx of spots){
					wardenShock(en, sx, ground - 22, magma ? 110 : 80, magma ? 18 : 10, magma ? 50 : 70, 0);
					if(magma) wardenTel(sx - 8, ground - 180, 150, 180, 24, '');
				}
			}
			if(a.t === popAt && en._crackSpots){
				for(const sx of en._crackSpots) wardenShock(en, sx - 16, ground - (magma ? 200 : 70), magma ? 180 : 90, magma ? 200 : 70, magma ? 80 : 90, magma ? 40 : 20);
				for(const p of platforms()){
					if(p.roomId === room.id && (p.kind === 'collapse' || p.kind === 'pillar') && Math.random() < (magma ? 0.55 : 0.45)){
						breakPlatform(p);
					}
				}
			}
			if(a.t === warn2){
				const spots = [];
				const n = magma ? 7 : 5;
				for(let i = 0; i < n; i++) spots.push(room.x + 140 + Math.random() * (room.w - 280));
				en._crackSpots2 = spots;
				for(const sx of spots){
					wardenShock(en, sx, ground - 22, magma ? 110 : 80, magma ? 18 : 10, magma ? 40 : 50, 0);
					if(magma) wardenTel(sx - 8, ground - 180, 150, 180, 22, '');
				}
			}
			if(a.t === pop2 && en._crackSpots2){
				for(const sx of en._crackSpots2) wardenShock(en, sx - 16, ground - (magma ? 200 : 70), magma ? 180 : 90, magma ? 200 : 70, magma ? 70 : 80, magma ? 40 : 20);
			}
			if(a.t > (magma ? 128 : 170)){ en._atk = null; en._cd = magma ? 58 : 120; }
		} else if(a.name === 'lavaRise'){
			if(a.t === 1){
				showBanner('Lava is rising.');
				if(typeof shakeScreen === 'function') shakeScreen(magma ? 12 : 8, 24);
				hazards().push({
					type: 'rise', element: 'fire', roomId: room.id,
					x: room.x + 10, w: room.w - 20, y0: ground - 12, y1: room.y + room.h * 0.30,
					speed: magma ? 1.05 : 0.6, active: true, armed: true, hold: magma ? 170 : 150, y: ground - 12,
					_fluidConsumed: true, _wardenRise: true,
				});
				if(global.DungeonFluid && global.DungeonFluid.syncEvents) global.DungeonFluid.syncEvents(getDungeon());
				for(const p of platforms()){
					if(p.roomId === room.id && p.kind === 'collapse') p._tick = (p._tick || 0) + 30;
				}
				if(magma) eruptWardenGeysers(en, room);
			}
			if(magma && (a.t === 48 || a.t === 96)) eruptWardenGeysers(en, room);
			en.x += Math.sign((player.x + player.w / 2) - cx) * (magma ? 2.8 : 1.4);
			if(a.t === (magma ? 130 : 170)){
				wardenShock(en, room.x + 20, ground - (magma ? 170 : 80), room.w - 40, magma ? 170 : 80, 40, magma ? 38 : 22);
			}
			if(a.t > (magma ? 180 : 210)){ en._atk = null; en._cd = magma ? 64 : 140; }
		}
	}

	function onEnemyDeath(en){
		if(global.SpecialRooms && SpecialRooms.onEnemyDeath(en)) return;
		if(jungle() && jungle().onEnemyDeath(en)) return;
		if(ice()) ice().onEnemyDeath(en);
		if(theme() === 'fire' && en && en.roomId != null){
			const host = rooms()[en.roomId];
			if(host){
				if(!Env.visited[host.id]) Env.visited[host.id] = true;
				tryClearByKills(host);
			}
		}
		if(!en || !en.typeDef || !en.typeDef.isMiniBoss) return;
		const iceKnight = theme() === 'ice' || en.type === 'frostboundKnight';
		if(iceKnight){
			Env.modifiers.knightSlain = true;
			addHeat(10, '+FROST');
			grantLoot(themeLoot(true), 'The knight falls.');
			if(typeof playerData !== 'undefined' && playerData){
				playerData.gold = (playerData.gold || 0) + 180;
				playerData.inventory = playerData.inventory || [];
				const core = playerData.inventory.find(e => e.itemId === 'frost_core');
				if(core) core.qty += 1;
				else playerData.inventory.push({ itemId:'frost_core', qty:1 });
				const born = playerData.inventory.find(e => e.itemId === 'frostborn_core');
				if(born) born.qty += 1;
				else playerData.inventory.push({ itemId:'frostborn_core', qty:1 });
				try{ localStorage.setItem('magicBattle_playerData', JSON.stringify(playerData)); }catch(e){}
			}
			showBanner('Frostborn Core claimed — use it on the approach.');
			const room = rooms()[en.roomId];
			if(room) clearRoom(room, 'THE ICE REMEMBERS ITS WARRIORS — defeated.');
			return;
		}
		Env.modifiers.wardenSlain = true;
		addHeat(18, '+HEAT');
		grantLoot(themeLoot(true), 'The warden falls.');
		if(typeof playerData !== 'undefined' && playerData){
			playerData.gold = (playerData.gold || 0) + 180;
			playerData.inventory = playerData.inventory || [];
			const core = playerData.inventory.find(e => e.itemId === 'furnace_core');
			if(core) core.qty += 1;
			else playerData.inventory.push({ itemId:'furnace_core', qty:1 });
			try{ localStorage.setItem('magicBattle_playerData', JSON.stringify(playerData)); }catch(e){}
		}
		showBanner('Furnace Core claimed — use it on the approach.');
		const room = rooms()[en.roomId];
		if(room) clearRoom(room, 'THE FURNACE HAS A GUARDIAN — defeated.');
	}

	function redrawSolidTiles(ctx){
		if(typeof tileMap === 'undefined' || typeof TILE === 'undefined') return;
		const d = getDungeon() || {};
		const wc = d.wallColor || '#26351f';
		const wc2 = d.wallColor2 || '#35492a';
		const we = d.wallEdge || '#64844d';
		const fh = d.floorHighlight || '#7a9a58';
		const cols = typeof MAP_COLS === 'number' ? MAP_COLS : tileMap[0] && tileMap[0].length || 0;
		const rows = typeof MAP_ROWS === 'number' ? MAP_ROWS : tileMap.length || 0;
		const c0 = Math.max(0, Math.floor(camera.x / TILE));
		const r0 = Math.max(0, Math.floor(camera.y / TILE));
		const c1 = Math.min(cols, Math.ceil((camera.x + canvas.width) / TILE) + 1);
		const r1 = Math.min(rows, Math.ceil((camera.y + canvas.height) / TILE) + 1);
		for(let r = r0; r < r1; r++){
			const row = tileMap[r];
			if(!row) continue;
			for(let c = c0; c < c1; c++){
				if(row[c] !== 0) continue;
				const sx = c * TILE - camera.x, sy = r * TILE - camera.y;
				ctx.fillStyle = ((r + c) & 1) ? wc2 : wc;
				ctx.fillRect(sx, sy, TILE, TILE);
				const edges = (typeof tileEdges !== 'undefined' && tileEdges[r]) ? tileEdges[r][c] : null;
				if(!edges) continue;
				ctx.fillStyle = we;
				if(edges.airTop) ctx.fillRect(sx, sy, TILE, 3);
				if(edges.airBot) ctx.fillRect(sx, sy + TILE - 3, TILE, 3);
				if(edges.airLeft) ctx.fillRect(sx, sy, 3, TILE);
				if(edges.airRight) ctx.fillRect(sx + TILE - 3, sy, 3, TILE);
				if(edges.airTop){
					ctx.fillStyle = fh;
					ctx.globalAlpha = 0.28;
					ctx.fillRect(sx, sy, TILE, 5);
					ctx.globalAlpha = 1;
				}
			}
		}
	}

	function draw(ctx){
		if(!IS_DUNGEON || !getDungeon()) return;
		if(global.FirePuzzles) FirePuzzles.draw(ctx);
		if(global.SpecialRooms) SpecialRooms.draw(ctx);
		const camx = camera.x, camy = camera.y;
		const iceRT = ice();
		const jungleRT = jungle();
		if(jungleRT){
			try{ jungleRT.drawWorld(ctx); }
			catch(err){}
		}
		const decs = getDungeon().decorations || [];
		for(const dec of decs){
			if(iceRT || jungleRT) break;
			if(dec._fluidConsumed) continue;
			if(dec.type === 'lavaWell'){
				const sx = dec.x - camx, sy = dec.y - camy;
				if(sx + dec.w < -40 || sx > canvas.width + 40) continue;
				const well = ctx.createLinearGradient(sx, sy, sx, sy + dec.h);
				well.addColorStop(0, 'rgba(255,90,10,0.55)');
				well.addColorStop(0.25, 'rgba(180,30,0,0.7)');
				well.addColorStop(1, 'rgba(40,6,0,0.92)');
				ctx.fillStyle = well;
				ctx.fillRect(sx, sy, dec.w, dec.h);
			}
			if(dec.type === 'iceWell' || dec.type === 'iceWater'){
				const sx = dec.x - camx, sy = dec.y - camy;
				if(sx + (dec.w || 40) < -40 || sx > canvas.width + 40) continue;
				const well = ctx.createLinearGradient(sx, sy, sx, sy + (dec.h || 24));
				well.addColorStop(0, 'rgba(180,230,255,0.55)');
				well.addColorStop(0.35, 'rgba(80,150,210,0.62)');
				well.addColorStop(1, 'rgba(20,50,90,0.88)');
				ctx.fillStyle = well;
				ctx.fillRect(sx, sy, dec.w, dec.h || 24);
				if(dec.surface){
					ctx.fillStyle = 'rgba(230,248,255,0.45)';
					ctx.fillRect(sx + 4, sy + 2, dec.w - 8, 5);
				}
			}
		}
		for(const hz of hazards()){
			if(iceRT || jungleRT) break;
			if(hz.type === 'vent'){
				const t = (typeof performance !== 'undefined' ? performance.now() : Date.now()) * 0.001;
				const cx = hz.x + hz.w / 2;
				drawLavaBlob(ctx, cx, hz.y + 4, hz.hot ? 15 : (hz.warnOn ? 11 : 8), hz.x);
				if(hz.warnOn && !hz.hot){
					ctx.fillStyle = 'rgba(255,180,50,' + (0.18 + 0.14 * Math.sin(t * 12 + hz.x)) + ')';
					ctx.beginPath();
					ctx.arc(cx - camx, hz.y - camy, 20, 0, Math.PI * 2);
					ctx.fill();
					drawHazardGlyph(ctx, cx, hz.y - 28);
				}
				if(hz.hot) drawGeyserJet(ctx, hz, hz.y);
				for(const b of (hz.blobs || [])) drawLavaBlob(ctx, b.x, b.y, b.r, b.x);
			}
			if(hz.type === 'fall'){
				const sx = hz.x - camx, sy = hz.y - camy;
				if(hz.warnOn){
					ctx.fillStyle = hz.element === 'ice' ? 'rgba(160,220,255,0.2)' : 'rgba(255,180,40,0.18)';
					ctx.fillRect(sx, sy, hz.w, hz.h);
				}
				if(hz.hot){
					const fg = ctx.createLinearGradient(sx, sy, sx, sy + hz.h);
					if(hz.element === 'ice'){
						fg.addColorStop(0, 'rgba(220,245,255,0.2)');
						fg.addColorStop(0.2, 'rgba(140,210,255,0.75)');
						fg.addColorStop(1, 'rgba(40,80,140,0.5)');
					} else {
						fg.addColorStop(0, 'rgba(255,220,80,0.15)');
						fg.addColorStop(0.2, 'rgba(255,90,0,0.75)');
						fg.addColorStop(1, 'rgba(120,20,0,0.55)');
					}
					ctx.fillStyle = fg;
					ctx.fillRect(sx - 6, sy, hz.w + 12, hz.h);
				}
			}
			if(hz.type === 'icePatch'){
				const sx = hz.x - camx, sy = hz.y - camy;
				ctx.fillStyle = 'rgba(170,220,255,' + (0.18 + (hz.slip || 0.3) * 0.35) + ')';
				ctx.fillRect(sx, sy, hz.w, hz.h);
				ctx.fillStyle = 'rgba(230,248,255,0.35)';
				ctx.fillRect(sx + 6, sy + 2, Math.max(8, hz.w - 12), 3);
			}
			if(hz.type === 'icicle'){
				const sx = hz.x - camx, sy = hz.y - camy;
				if(hz.warnOn){
					ctx.fillStyle = 'rgba(20,30,50,0.28)';
					ctx.fillRect(sx - 4, sy + hz.h - 8, hz.w + 8, 10);
					drawHazardGlyph(ctx, hz.x + hz.w / 2, hz.y + 20);
				}
				if(hz.hot){
					ctx.fillStyle = 'rgba(180,230,255,0.85)';
					ctx.beginPath();
					ctx.moveTo(sx, sy);
					ctx.lineTo(sx + hz.w / 2, sy + hz.h);
					ctx.lineTo(sx + hz.w, sy);
					ctx.closePath();
					ctx.fill();
				} else {
					ctx.fillStyle = 'rgba(150,210,255,0.45)';
					ctx.beginPath();
					ctx.moveTo(sx + 4, sy);
					ctx.lineTo(sx + hz.w / 2, sy + 18);
					ctx.lineTo(sx + hz.w - 4, sy);
					ctx.closePath();
					ctx.fill();
				}
			}
			if(hz.type === 'blizzard' && Env.currentRoom && Env.currentRoom.id === hz.roomId){
				ctx.fillStyle = 'rgba(180,220,255,' + (0.08 + (Env.blizzardVis || 0) * 0.25) + ')';
				ctx.fillRect(hz.x - camx, hz.y - camy, hz.w, hz.h);
			}
			if(hz.type === 'gate'){
				if(hz.solid){
					ctx.fillStyle = '#5a2210';
					ctx.fillRect(hz.x - camx, hz.y - camy, hz.w, hz.h);
					ctx.fillStyle = 'rgba(255,120,30,0.45)';
					ctx.fillRect(hz.x - camx + 4, hz.y - camy, hz.w - 8, hz.h);
				} else {
					ctx.fillStyle = 'rgba(255,160,40,0.15)';
					ctx.fillRect(hz.x - camx, hz.y - camy, hz.w, 6);
				}
			}
			if(hz.type === 'channel'){
				const { hot, safe } = channelRects(hz);
				if(hz.left && hz.right){
					if(theme() === 'ice'){
						if(!hz._fluidConsumed){
							ctx.fillStyle = 'rgba(120,200,255,0.55)';
							ctx.fillRect(hot.x - camx, hz.y - camy, hot.w, hz.h);
							ctx.fillStyle = 'rgba(40,40,40,0.35)';
							ctx.fillRect(safe.x - camx, hz.y - camy, safe.w, hz.h);
						}
					} else if(!hz._fluidConsumed || hz.mode === 'geysers'){
						drawLavaPool(ctx, hz.left.x, hz.y, hz.left.w, hz.h, hz.left.x);
						drawLavaPool(ctx, hz.right.x, hz.y, hz.right.w, hz.h, hz.right.x + 90);
					}
				}
				if(hz.mode === 'geysers' && hz.geysers){
					const t = (typeof performance !== 'undefined' ? performance.now() : Date.now()) * 0.001;
					for(const g of hz.geysers){
						const cx = g.x + g.w / 2;
						const swell = g.hot ? 16 : (g.warnOn ? 12 : 8);
						drawLavaBlob(ctx, cx, hz.y + 6, swell + Math.sin(t * 7 + g.x) * 2, g.x);
						if(g.warnOn && !g.hot){
							ctx.fillStyle = 'rgba(255,180,50,' + (0.18 + 0.14 * Math.sin(t * 12 + g.x)) + ')';
							ctx.beginPath();
							ctx.arc(cx - camx, hz.y - camy, 22, 0, Math.PI * 2);
							ctx.fill();
							drawHazardGlyph(ctx, cx, hz.y - 32);
						}
						if(g.hot) drawGeyserJet(ctx, g, hz.y);
						for(const b of (g.blobs || [])) drawLavaBlob(ctx, b.x, b.y, b.r, b.x);
					}
				}
			}
			if(hz.type === 'lavaBubbles'){
				for(const b of (hz.bubbles || [])){
					const bx = b.x - camx, by = b.y - camy;
					const g = ctx.createRadialGradient(bx, by, 1, bx, by, b.r + 10);
					g.addColorStop(0, 'rgba(255,230,140,0.95)');
					g.addColorStop(0.4, 'rgba(255,120,20,0.85)');
					g.addColorStop(1, 'rgba(180,30,0,0)');
					ctx.fillStyle = g;
					ctx.beginPath();
					ctx.arc(bx, by, b.r + 10, 0, Math.PI * 2);
					ctx.fill();
					ctx.fillStyle = 'rgba(255,200,70,0.9)';
					ctx.beginPath();
					ctx.arc(bx - b.r * 0.2, by - b.r * 0.25, b.r * 0.55, 0, Math.PI * 2);
					ctx.fill();
				}
				for(const p of (hz.pops || [])){
					ctx.strokeStyle = 'rgba(255,160,40,' + (1 - p.age / 16) + ')';
					ctx.lineWidth = 3;
					ctx.beginPath();
					ctx.arc(p.x - camx, p.y - camy, p.r, 0, Math.PI * 2);
					ctx.stroke();
					ctx.fillStyle = 'rgba(255,90,10,' + (0.28 - p.age * 0.015) + ')';
					ctx.beginPath();
					ctx.arc(p.x - camx, p.y - camy, p.r * 0.7, 0, Math.PI * 2);
					ctx.fill();
				}
			}
			if(hz.type === 'rise' && !hz._fluidConsumed && (hz.active || hz.y != null)){
				const y = hz.y == null ? hz.y0 : hz.y;
				const g = ctx.createLinearGradient(0, y - camy, 0, y - camy + 80);
				if(theme() === 'ice'){ g.addColorStop(0, 'rgba(160,220,255,0.7)'); g.addColorStop(1, 'rgba(40,80,140,0.35)'); }
				else if(theme() === 'earth'){ g.addColorStop(0, 'rgba(80,120,40,0.55)'); g.addColorStop(1, 'rgba(40,50,20,0.3)'); }
				else { g.addColorStop(0, 'rgba(255,90,0,0.75)'); g.addColorStop(1, 'rgba(120,20,0,0.4)'); }
				ctx.fillStyle = g;
				const riseRoom = rooms()[hz.roomId];
				const riseFloor = riseRoom ? riseRoom.y + riseRoom.h : y + 80;
				ctx.fillRect(hz.x - camx, y - camy, hz.w, Math.max(8, riseFloor - y));
			}
		}
		if(iceRT) iceRT.drawWorld(ctx);
		if(global.IcePuzzles) IcePuzzles.draw(ctx);
		for(const p of platforms()){
			if(iceRT || jungleRT) break;
			if(p._gone) continue;
			if(theme() === 'fire') continue;
			if(p.kind === 'move' || p.kind === 'raft' || p.kind === 'orbit' || p.kind === 'collapse' || p.kind === 'pillar'){
				drawDungeonPlatform(ctx, p);
			}
		}
		for(const it of interacts()){
			if(it.kind === 'banner') continue;
			const sx = it.x - camx, sy = it.y - camy;
			if(global.ChestLoot && ChestLoot.drawInteractable(ctx, it, sx, sy)) continue;
			if(global.DungeonInteractArt && DungeonInteractArt.draw(ctx, it, sx, sy)) continue;
			if(jungleRT && jungleRT.drawInteractable(ctx, it, sx, sy)) continue;
			if(iceRT && iceRT.drawInteractable(ctx, it, sx, sy)) continue;
			if(it.kind === 'choice'){
				ctx.fillStyle = it.used ? '#2a1810' : '#4a1808';
				ctx.fillRect(sx, sy + 20, it.w, it.h - 20);
				ctx.fillStyle = it.used ? '#553' : '#ff6622';
				ctx.fillRect(sx + 12, sy, it.w - 24, 28);
				ctx.fillStyle = '#ffcc66';
				ctx.font = '32px Arial';
				ctx.textAlign = 'center';
				ctx.fillText(it.icon || '🔥', sx + it.w / 2, sy + 70);
			}
			if(it.kind === 'channelLever'){
				ctx.fillStyle = it.used ? '#333' : '#6a3a12';
				ctx.fillRect(sx, sy, it.w, it.h);
				ctx.fillStyle = '#ffcc66';
				ctx.font = '22px Arial';
				ctx.textAlign = 'center';
				ctx.fillText(it.icon || '🔧', sx + it.w / 2, sy + 40);
				ctx.font = 'bold 13px Arial';
				ctx.fillStyle = '#ffe0a0';
				ctx.strokeStyle = 'rgba(0,0,0,0.75)';
				ctx.lineWidth = 4;
				ctx.strokeText('[E] Switch Geysers', sx + it.w / 2, sy - 16);
				ctx.fillText('[E] Switch Geysers', sx + it.w / 2, sy - 16);
			}
			if(it.kind === 'vault'){
				ctx.fillStyle = it.used ? '#2a2a20' : '#c9a227';
				ctx.fillRect(sx, sy, it.w, it.h);
				ctx.fillStyle = '#fff3a0';
				ctx.font = '22px Arial';
				ctx.textAlign = 'center';
				ctx.fillText(it.icon || '💎', sx + it.w / 2, sy + 36);
			}
			if(it.kind === 'wardenStart'){
				ctx.fillStyle = it.used ? '#2a1810' : '#5a220c';
				ctx.fillRect(sx, sy, it.w, it.h);
				ctx.strokeStyle = it.used ? '#553' : '#ffaa33';
				ctx.lineWidth = 3;
				ctx.strokeRect(sx + 4, sy + 4, it.w - 8, it.h - 8);
				ctx.fillStyle = it.used ? '#665' : '#ffcc66';
				ctx.font = '32px Arial';
				ctx.textAlign = 'center';
				ctx.fillText(it.icon || '🔔', sx + it.w / 2, sy + it.h * 0.62);
				if(!it.used){
					ctx.font = 'bold 12px Arial';
					ctx.fillStyle = '#ffe0a0';
					ctx.strokeStyle = 'rgba(0,0,0,0.75)';
					ctx.lineWidth = 4;
					ctx.strokeText('[E] Challenge', sx + it.w / 2, sy - 12);
					ctx.fillText('[E] Challenge', sx + it.w / 2, sy - 12);
				}
			}
			if(it.kind === 'shrine' || it.kind === 'core' || it.kind === 'risk' || it.kind === 'trial' || it.kind === 'cool' || it.kind === 'valve' || it.kind === 'choice' || it.kind === 'channelLever' || it.kind === 'prison' || it.kind === 'memory'){
				ctx.fillStyle = it.used ? '#2a2218' : '#4a2810';
				ctx.fillRect(sx, sy, it.w, it.h);
				ctx.fillStyle = it.used ? '#665' : '#ffcc66';
				ctx.font = '28px Arial';
				ctx.textAlign = 'center';
				ctx.fillText(it.icon || '◆', sx + it.w / 2, sy + it.h * 0.65);
			}
			if(it.kind === 'secretWall' && !it.used){
				ctx.fillStyle = '#5a2a14';
				ctx.fillRect(sx, sy, it.w, it.h);
				ctx.fillStyle = 'rgba(255,140,40,0.35)';
				ctx.fillRect(sx + 8, sy + 20, 8, it.h - 40);
			}
			if(it.kind === 'doorSign'){
				ctx.fillStyle = 'rgba(0,0,0,0.55)';
				ctx.fillRect(sx - 40, sy - 8, 160, 28);
				ctx.fillStyle = '#ffcc66';
				ctx.font = 'bold 11px Arial';
				ctx.textAlign = 'center';
				ctx.fillText(it.text || it.name || '', sx + 40, sy + 12);
			}
		}
		if(global.ChestLoot) ChestLoot.drawFx(ctx, camx, camy);
		if(!iceRT && Env.blizzardVis > 0.02){
			ctx.save();
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.fillStyle = 'rgba(170,210,240,' + (Env.blizzardVis * 0.55) + ')';
			ctx.fillRect(0, 0, canvas.width, canvas.height);
			ctx.restore();
		}
		if(Env.banner.t > 0){
			Env.banner.t--;
			ctx.save();
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.globalAlpha = Math.min(1, Env.banner.t / 30);
			ctx.font = 'bold 28px Arial';
			ctx.textAlign = 'center';
			ctx.fillStyle = meterColor();
			ctx.shadowColor = '#000';
			ctx.shadowBlur = 8;
			ctx.fillText(Env.banner.text, canvas.width / 2, 92);
			ctx.restore();
		}
		const prompt = nearbyPrompt();
		const promptEl = document.getElementById('interactPrompt');
		if(promptEl && prompt){
			promptEl.style.display = 'block';
			promptEl.innerHTML = prompt.replace('Press E — ', 'Press <b>E</b> to ').replace('E — ', 'Press <b>E</b> to ');
		}
		if(prompt){
			ctx.save();
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.font = 'bold 16px Arial';
			ctx.textAlign = 'center';
			ctx.fillStyle = '#ffe0a0';
			ctx.strokeStyle = 'rgba(0,0,0,0.7)';
			ctx.lineWidth = 4;
			ctx.strokeText(prompt, canvas.width / 2, canvas.height - 70);
			ctx.fillText(prompt, canvas.width / 2, canvas.height - 70);
			ctx.restore();
		}
		for(const en of enemies){
			if(!en.typeDef || !en.typeDef.isMiniBoss || en.dead) continue;
			for(const z of (en._zones || [])){
				const zx = z.x - camx, zy = z.y - camy;
				if(en.type === 'magmaWarden'){
					const hot = z.dmg > 0;
					const pulse = 0.72 + 0.28 * Math.sin((typeof performance !== 'undefined' ? performance.now() : Date.now()) * 0.012 + z.x);
					ctx.fillStyle = hot ? ('rgba(255,70,8,' + (0.38 * pulse) + ')') : 'rgba(255,190,50,0.26)';
					ctx.fillRect(zx, zy, z.w, z.h);
					ctx.strokeStyle = hot ? 'rgba(255,220,90,0.9)' : 'rgba(255,170,40,0.7)';
					ctx.lineWidth = 2;
					ctx.strokeRect(zx + 1, zy + 1, z.w - 2, z.h - 2);
					if(hot){
						ctx.fillStyle = 'rgba(255,240,160,0.35)';
						ctx.fillRect(zx + 4, zy + 3, Math.max(6, z.w - 8), 4);
					}
				} else {
					ctx.fillStyle = iceRT ? 'rgba(140,210,255,0.32)' : 'rgba(255,80,20,0.35)';
					ctx.fillRect(zx, zy, z.w, z.h);
				}
			}
			if(en._vulnerable){
				ctx.strokeStyle = '#ffe680';
				ctx.lineWidth = 3;
				ctx.strokeRect(en.x - camx - 4, en.y - camy - 4, en.w + 8, en.h + 8);
			}
		}
	}

	function drawWardenSprite(en){
		if(!en || en.type !== 'magmaWarden') return false;
		const img = (typeof ENEMY_SPRITE_SHEETS !== 'undefined') ? ENEMY_SPRITE_SHEETS.magmaWarden : null;
		if(!img || !img.complete || !img.naturalWidth) return false;
		const cols = 10, rows = 6, fps = 5;
		const fW = img.naturalWidth / cols;
		const fH = img.naturalHeight / rows;
		let row = 0;
		let once = false;
		const a = en._atk && en._atk.name;
		if(en.dead){
			row = 5;
			once = true;
		} else if(a === 'fist'){
			row = 2;
		} else if(a === 'uppercut' || a === 'hammer' || a === 'rush' || a === 'leap'){
			row = 3;
		} else if(a === 'core' || a === 'collapse' || a === 'lavaRise'){
			row = 4;
		} else if(Math.abs(en.x - (en._mwLastX || en.x)) > 0.4 || (en._cd > 0 && !en._atk)){
			row = 1;
		} else {
			row = 0;
		}
		en._mwLastX = en.x;
		const key = 'mw:' + row + (en.dead ? ':d' : '');
		if(en._mwSprLast !== key){
			en._mwSprLast = key;
			en._mwSprFrame = 0;
			en._mwSprTimer = 0;
		}
		en._mwSprTimer = (en._mwSprTimer || 0) + 1;
		if(en._mwSprTimer >= fps){
			en._mwSprTimer = 0;
			if(once){
				if((en._mwSprFrame || 0) < cols - 1) en._mwSprFrame = (en._mwSprFrame || 0) + 1;
			} else {
				en._mwSprFrame = ((en._mwSprFrame || 0) + 1) % cols;
			}
		}
		// Row 5 frames 6-9 sink into the floor — never play those while alive.
		const maxFrame = (!en.dead && row === 5) ? 4 : (cols - 1);
		const frame = Math.min(en._mwSprFrame || 0, maxFrame);
		const bleed = 1;
		const sx = frame * fW + bleed, sy = row * fH + bleed;
		const sw = fW - bleed * 2, sh = fH - bleed * 2;
		const dest = (typeof enemySpriteDestSize === 'function')
			? enemySpriteDestSize(en, sw, sh)
			: { rW: en.w * 2, rH: en.h * 2 };
		const rW = dest.rW, rH = dest.rH;
		const camx = (typeof camera !== 'undefined') ? camera.x : 0;
		const camy = (typeof camera !== 'undefined') ? camera.y : 0;
		const ex = en.x - camx, ey = en.y - camy;
		const cx = ex + en.w / 2;
		if(typeof ctx === 'undefined') return false;
		ctx.save();
		if(en.flash > 0) ctx.filter = 'brightness(2.5) saturate(0.3)';
		if(en.facing === -1){
			ctx.translate(cx, ey + en.h - rH / 2);
			ctx.scale(-1, 1);
			ctx.drawImage(img, sx, sy, sw, sh, -rW / 2, -rH / 2, rW, rH);
		} else {
			ctx.drawImage(img, sx, sy, sw, sh, cx - rW / 2, ey + en.h - rH, rW, rH);
		}
		ctx.restore();
		return true;
	}

	function drawWardenFallback(en){
		const ex = en.x - camera.x, ey = en.y - camera.y;
		const flash = en.flash > 0;
		const t = theme();
		ctx.fillStyle = flash ? '#ffcc88' : (t === 'ice' ? '#2a4a77' : t === 'earth' ? '#4a3a20' : '#221810');
		ctx.fillRect(ex + 8, ey + 16, en.w - 16, en.h - 16);
		ctx.fillStyle = flash ? '#fff' : (t === 'ice' ? '#88ddff' : t === 'earth' ? '#88cc44' : '#ff6622');
		ctx.fillRect(ex + 18, ey + 28, 8, 22);
		ctx.fillRect(ex + en.w - 26, ey + 28, 8, 22);
		ctx.fillRect(ex + en.w / 2 - 8, ey + 40, 16, 26);
		ctx.fillStyle = '#111';
		ctx.fillRect(ex + 20, ey + 10, 10, 8);
		ctx.fillRect(ex + en.w - 30, ey + 10, 10, 8);
		if(en._atk && en._atk.name === 'core'){
			ctx.fillStyle = '#ffe680';
			ctx.beginPath();
			ctx.arc(ex + en.w / 2, ey + 48, 12 + Math.sin(en.animTimer * 0.3) * 3, 0, Math.PI * 2);
			ctx.fill();
		}
	}

	function init(){
		if(!IS_DUNGEON || !getDungeon() || !getDungeon().rooms) return;
		sealRoomShells();
		clearRoomInteriors();
		stampRoomSolids();
		stampPitFloors();
		stampRaisedFloors();
		punchAllOpenings();
		stampPlatforms();
		for(const hz of hazards()){
			if(hz.type === 'gate' && hz.solid) stampTiles(hz.x, hz.y, hz.w, hz.h, false);
		}
		if(typeof computeTileEdges === 'function') computeTileEdges();
		seatAllTreasure();
		Env.ready = true;
		Env.heat = getDungeon()._hotRun ? 10 : 0;
		Env.visited = Object.create(null);
		if(typeof player !== 'undefined'){
			const start = roomAt(player.x + player.w / 2, player.y + player.h / 2)
				|| rooms().find(function(r){ return r && r.kind === 'start'; })
				|| rooms()[0];
			if(start){
				Env.visited[start.id] = true;
				Env.currentRoom = start;
			}
		}
		if(theme() === 'fire'){
			refreshFirePassages();
		} else {
			const gs = getDungeon()._gates || [];
			for(const g of gs) sealGate(g, true);
			for(const r of rooms()){
				if(r.outGates){
					for(const g of r.outGates) if(!r.cleared) sealGate(g, true);
				}
			}
		}
		updateMeterHUD();
		updateObjectiveHUD();
		if(ice()) ice().init();
		if(jungle()) jungle().init();
		seatAllTreasure();
		if(global.DungeonFluid && global.DungeonFluid.rebuild) global.DungeonFluid.rebuild();
		for(const en of enemies){
			if(en.typeDef && en.typeDef.isMiniBoss){
				en.hp = Math.round(en.hp * (1 + Env.heat * 0.01));
				en.maxHp = en.hp;
			} else if(en.roomId != null){
				const r = rooms()[en.roomId];
				if(r && r.depth >= 4){
					en.hp = Math.round(en.hp * 1.15);
					en.maxHp = en.hp;
				}
			}
		}
	}

	function update(){
		if(!IS_DUNGEON || !Env.ready) return;
		updateRooms();
		if(jungle()) jungle().update();
		updatePlatforms();
		updateHazards();
		if(global.DungeonFluid && global.DungeonFluid.tick) global.DungeonFluid.tick();
		if(typeof global.updateJungleBossFX === 'function') global.updateJungleBossFX();
		updateVaults();
		if(global.FirePuzzles) FirePuzzles.update();
		if(global.IcePuzzles) IcePuzzles.update();
		if(global.SpecialRooms) SpecialRooms.update();
		if(global.ChestLoot) ChestLoot.update();
		tickWardenBurns();
		updateTrial();
		if(typeof enemies !== 'undefined'){
			for(const en of enemies){
				if(!en || en.dead) continue;
				if(en._riseFrom && en._hoverY != null){
					if(en.y > en._hoverY){
						en.y -= 1.7;
						en.vy = 0;
						if(en.typeDef && en.typeDef.flies) en.baseY = en.y;
					} else {
						en.y = en._hoverY;
						if(en.typeDef && en.typeDef.flies) en.baseY = en.y;
						en._riseFrom = false;
					}
				}
				if(en._cliff && en._safeY != null && !en.typeDef.isMiniBoss && en.type !== 'magmaWarden' &&
					!en._fireHidden && !en._fireNoHit && !(en.fireKit && en.fireKit.busy)){
					en.y = en._safeY; en.vy = 0;
				}
			}
		}
		if(player._iceDrag) player._iceDrag = Math.max(0, player._iceDrag - 0.004);
	}

	Env.breakPlatform = breakPlatform;
	Env.stampPlatforms = stampPlatforms;
	Env.applyLavaSwim = applyLavaSwim;
	Env.applyJungleSwim = applyJungleSwim;
	Env.redrawSolidTiles = redrawSolidTiles;
	Env.applyIceMove = applyIceMove;
	Env.showBanner = showBanner;
	Env.nearbyPrompt = nearbyPrompt;
	Env.drawLavaPool = drawLavaPool;
	Env.init = init;
	Env.update = update;
	Env.draw = draw;
	Env.tryInteract = tryInteract;
	Env.openShrine = openShrine;
	Env.startTrial = startTrial;
	Env.openVault = openVault;
	Env.openPrison = openPrison;
	Env.openCache = openCache;
	Env.openMemory = openMemory;
	Env.collideMovers = collideMovers;
	Env.updateWarden = updateWarden;
	Env.igniteSolidify = igniteSolidify;
	Env.onEnemyDeath = onEnemyDeath;
	Env.drawWardenFallback = drawWardenFallback;
	Env.drawWardenSprite = drawWardenSprite;
	Env.closeChoice = closeChoice;
	Env.addHeat = addHeat;
	Env.grantLoot = grantLoot;
	Env.applyFurnacePick = pickChoice;
	Env.spawnWave = spawnWave;
	/* Shared plumbing the theme runtimes build on. */
	Env.clearRoom = clearRoom;
	Env.sealGate = sealGate;
	Env.refreshFirePassages = refreshFirePassages;
	Env.roomEnemies = roomEnemies;
	Env.combatChestLocked = combatChestLocked;
	Env.grantLoot = grantLoot;
	Env.themeLoot = themeLoot;
	Env.spawnWave = spawnWave;
	Env.stampTiles = stampTiles;
	Env.getHeat = () => Env.heat;
	Env.lootMultOf = () => Env.lootMult;
	Env.playerDmgMult = function(){
		let m = 1;
		if(Env.blessings.cinder) m *= 1.18;
		if(Env.modifiers.volcanicCore) m *= 1.2;
		if(jungle() && jungle().playerDmgMult) m *= jungle().playerDmgMult();
		return m;
	};

	global.DungeonEnv = Env;

	if(typeof IS_DUNGEON !== 'undefined' && IS_DUNGEON && getDungeon() && getDungeon().rooms){
		init();
	}
})(typeof window !== 'undefined' ? window : globalThis);
