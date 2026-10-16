/* =============================================================
   Infernal Depths — authored volcanic machinery mini-games.
   Attached to existing rooms only. Combat stays live.
   ============================================================= */
(function(global){
	'use strict';

	const N = 1, E = 2, S = 4, W = 8;
	const DIR4 = [{b:N,x:0,y:-1},{b:E,x:1,y:0},{b:S,x:0,y:1},{b:W,x:-1,y:0}];
	const OPP = {}; OPP[N]=S; OPP[E]=W; OPP[S]=N; OPP[W]=E;
	const SHAPE = { I: N|S, L: N|E, T: N|E|S, X: N|E|S|W, C: N, P: E|W };
	const LOCK_GLYPH = ['flame','hammer','mountain','sun','eye'];
	const LOCK_MARK = { flame:'▲', hammer:'T', mountain:'Λ', sun:'✶', eye:'◉' };

	const P = { down:false, lastHp:0, pulse:0 };

	function dung(){ return (typeof dungeon !== 'undefined' && dungeon) || global.dungeon; }
	function env(){ return global.DungeonEnv; }
	function rooms(){ return (dung() && dung().rooms) || []; }
	function interacts(){ return (dung() && dung().interactables) || []; }
	function hzList(){
		if(typeof global.hazards !== 'undefined' && global.hazards && global.hazards.length != null) return global.hazards;
		return (dung() && dung().hazards) || [];
	}
	function plats(){ return (typeof platforms !== 'undefined' && platforms) || (dung() && dung().platforms) || []; }
	function current(){ return env() && env().currentRoom; }
	function cam(){ return global.camera || {x:0,y:0}; }
	function fireTheme(){ const d = dung(); return !!(d && d._theme === 'fire'); }
	function banner(t){ if(env() && env().showBanner) env().showBanner(t); }
	function shake(a,b){ if(typeof shakeScreen === 'function') shakeScreen(a,b); }
	function parts(x,y,c,n){ if(typeof particlesAt === 'function') particlesAt(x,y,c,n||10); }
	function walkY(r){ return r.y + r.h - (r.raisedFloor || 0); }
	function st(r){
		if(!r) return null;
		if(!r._fp) r._fp = { ready:false };
		return r._fp;
	}
	function rotMask(m, k){
		k = ((k % 4) + 4) % 4;
		let o = m & 15;
		for(let i = 0; i < k; i++) o = ((o << 1) | (o >> 3)) & 15;
		return o;
	}
	function clickEdge(){
		const down = !!(typeof mouseDown !== 'undefined' && mouseDown);
		const edge = down && !P.down;
		P.down = down;
		return edge;
	}
	function worldMouse(){
		const mx = (typeof mouseScreenX === 'number') ? mouseScreenX : 0;
		const my = (typeof mouseScreenY === 'number') ? mouseScreenY : 0;
		const c = cam();
		return { x: mx + c.x, y: my + c.y };
	}
	function hitIt(it, wx, wy){
		return wx >= it.x && wx <= it.x + (it.w||48) && wy >= it.y && wy <= it.y + (it.h||48);
	}
	function near(it, reach){
		if(typeof player === 'undefined' || !it) return false;
		const px = player.x + player.w/2, py = player.y + player.h/2;
		return Math.abs(px - (it.x + (it.w||48)/2)) < (reach||100) &&
			Math.abs(py - (it.y + (it.h||48)/2)) < (reach||110);
	}
	function addIt(room, spec){
		const h = spec.h || 48;
		const rec = Object.assign({
			roomId: room.id,
			x: room.x + (spec.x || 0),
			y: spec.y != null ? spec.y : (walkY(room) - (spec.yFromFloor || 80) - h),
			w: spec.w || 48, h: h,
			reusable: true, used: false, _fp: true
		}, spec);
		interacts().push(rec);
		return rec;
	}
	function ofKind(room, kind){
		return interacts().filter(function(it){ return it && it.roomId === room.id && it.kind === kind; });
	}
	function armVents(room, extra){
		const list = hzList();
		for(let i = 0; i < list.length; i++){
			const h = list[i];
			if(!h || h.roomId !== room.id || h.type !== 'vent') continue;
			h.period = Math.max(60, (h.period || 160) - 28 * (extra || 1));
			h._armedHot = true;
			h.warnOn = true;
		}
	}
	function bumpRise(room, amt){
		const list = hzList();
		for(let i = 0; i < list.length; i++){
			const h = list[i];
			if(!h || h.roomId !== room.id) continue;
			if(h.type === 'rise'){
				h.armed = true; h.active = true;
				h.riseTo = Math.min(0.72, (h.riseTo || 0.3) + (amt || 0.04));
			}
		}
	}
	function pauseRise(room, frames){
		const list = hzList();
		for(let i = 0; i < list.length; i++){
			const h = list[i];
			if(h && h.roomId === room.id && h.type === 'rise'){
				h._fpHold = frames;
				h.active = false;
			}
		}
	}
	function knock(dx){
		if(typeof player === 'undefined') return;
		player.vx = (player.vx || 0) + (dx || -4);
		if(typeof player._kbTimer !== 'undefined') player._kbTimer = 10;
	}
	function giveLoot(better, label){
		if(!env() || !env().themeLoot) return;
		const table = env().themeLoot(!!better);
		if(env().grantLoot) env().grantLoot(table, label);
		else if(typeof notify === 'function' && label) notify(label);
	}
	function damaged(){
		const hp = (typeof health === 'number') ? health : P.lastHp;
		const hit = P.lastHp && hp < P.lastHp;
		P.lastHp = hp;
		return hit;
	}

	/* ---------- 1. Magma Flow Routing (Volcanic Stabilization) ---------- */
	const FLOW_BOARDS = [
		{
			ox:0, oy:0, tw:56, th:48,
			cells:[
				{x:0,y:1,sh:'I',rot:1},{x:1,y:1,sh:'L',rot:2},{x:2,y:1,sh:'I',rot:1},
				{x:2,y:0,sh:'L',rot:1},{x:3,y:0,sh:'I',rot:1},{x:4,y:0,sh:'L',rot:2},
				{x:4,y:1,sh:'I',rot:0},{x:3,y:1,sh:'P',rot:1},{x:1,y:0,sh:'C',rot:2}
			],
			src:{x:0,y:1,dir:W}, dst:{x:4,y:1,dir:S}
		},
		{
			ox:0, oy:0, tw:52, th:46,
			cells:[
				{x:0,y:0,sh:'L',rot:3},{x:1,y:0,sh:'T',rot:1},{x:2,y:0,sh:'L',rot:2},
				{x:0,y:1,sh:'I',rot:0},{x:1,y:1,sh:'X',rot:0},{x:2,y:1,sh:'L',rot:0},
				{x:0,y:2,sh:'L',rot:0},{x:1,y:2,sh:'T',rot:3},{x:2,y:2,sh:'P',rot:1},
				{x:3,y:1,sh:'I',rot:1},{x:3,y:2,sh:'L',rot:1}
			],
			src:{x:0,y:0,dir:N}, dst:{x:3,y:1,dir:E}
		},
		{
			ox:0, oy:0, tw:50, th:44,
			cells:[
				{x:0,y:1,sh:'T',rot:2},{x:1,y:1,sh:'I',rot:1},{x:2,y:1,sh:'T',rot:0},
				{x:0,y:0,sh:'L',rot:3},{x:1,y:0,sh:'P',rot:1},{x:2,y:0,sh:'L',rot:2},
				{x:0,y:2,sh:'L',rot:0},{x:1,y:2,sh:'T',rot:1},{x:2,y:2,sh:'L',rot:1},
				{x:3,y:0,sh:'C',rot:3},{x:3,y:1,sh:'I',rot:0},{x:3,y:2,sh:'L',rot:0}
			],
			src:{x:0,y:1,dir:W}, dst:{x:3,y:2,dir:S}
		}
	];

	function setupFlow(room){
		const s = st(room);
		if(s.flowReady) return;
		s.flowReady = true;
		s.flow = { boards:[], active:-1, press:0, flowing:false };
		const valves = ofKind(room, 'valve');
		const hard = (room.section || 2) >= 3;
		for(let i = 0; i < valves.length; i++){
			const v = valves[i];
			v._flowIdx = i;
			v.reusable = true;
			const layout = FLOW_BOARDS[Math.min(i + (hard ? 1 : 0), FLOW_BOARDS.length - 1)];
			const board = { valve:v, cells:[], src:layout.src, dst:layout.dst, tw:layout.tw, th:layout.th, solved:false };
			let maxX = 0, maxY = 0;
			for(let c = 0; c < layout.cells.length; c++){
				maxX = Math.max(maxX, layout.cells[c].x);
				maxY = Math.max(maxY, layout.cells[c].y);
			}
			const gridW = (maxX + 1) * layout.tw;
			let originX = v.x + (v.w || 50) + 12;
			if(originX + gridW > room.x + room.w - 20) originX = v.x - gridW - 12;
			const originY = v.y + (v.h || 70) - (maxY + 1) * layout.th;
			for(let c = 0; c < layout.cells.length; c++){
				const cell = layout.cells[c];
				const rec = addIt(room, {
					kind:'flowPipe', name:'Pipe joint',
					x: originX + cell.x * layout.tw - room.x,
					y: originY + cell.y * layout.th,
					w: layout.tw - 6, h: layout.th - 6,
					_gx:cell.x, _gy:cell.y, _sh:cell.sh, _rot:cell.rot, _home:cell.rot, _board:i
				});
				if(cell.x === layout.src.x && cell.y === layout.src.y) rec._src = true;
				if(cell.x === layout.dst.x && cell.y === layout.dst.y) rec._dst = true;
				board.cells.push(rec);
			}
			s.flow.boards.push(board);
		}
	}
	function pipeOpen(cell){ return rotMask(SHAPE[cell._sh] || 0, cell._rot || 0); }
	function flowConnected(board){
		const map = {};
		for(let i = 0; i < board.cells.length; i++){
			const c = board.cells[i];
			map[c._gx + ',' + c._gy] = c;
		}
		const seen = {};
		const q = [{x:board.src.x, y:board.src.y, from:OPP[board.src.dir]}];
		let hit = false, relief = false;
		while(q.length){
			const n = q.shift();
			const key = n.x + ',' + n.y;
			if(seen[key]) continue;
			const cell = map[key];
			if(!cell) continue;
			const open = pipeOpen(cell);
			if(n.from && !(open & n.from)) continue;
			seen[key] = true;
			cell._hot = true;
			if(cell._sh === 'P') relief = true;
			if(n.x === board.dst.x && n.y === board.dst.y && (open & board.dst.dir)) hit = true;
			for(let d = 0; d < 4; d++){
				const dir = DIR4[d];
				if(!(open & dir.b)) continue;
				q.push({x:n.x + dir.x, y:n.y + dir.y, from:OPP[dir.b]});
			}
		}
		for(let i = 0; i < board.cells.length; i++){
			if(!seen[board.cells[i]._gx + ',' + board.cells[i]._gy]) board.cells[i]._hot = false;
		}
		return { hit:hit, relief:relief };
	}
	function resetBoard(board){
		for(let i = 0; i < board.cells.length; i++){
			board.cells[i]._rot = board.cells[i]._home;
			board.cells[i]._hot = false;
		}
	}
	function tickFlow(room){
		const s = st(room);
		if(!s.flow || s.flow.active < 0) return;
		const board = s.flow.boards[s.flow.active];
		if(!board || board.solved) return;
		const res = flowConnected(board);
		if(res.hit){
			board.solved = true;
			board.valve.used = true;
			s.flow.active = -1;
			s.flow.press = 0;
			banner('The chamber drinks the magma. Valve locks.');
			shake(8, 12);
			parts(board.valve.x + 20, board.valve.y, '#ff7722', 18);
			return;
		}
		s.flow.press = Math.max(0, s.flow.press + (res.relief ? -0.55 : 0.38));
		if(s.flow.press >= 100){
			s.flow.press = 0;
			resetBoard(board);
			armVents(room, 1);
			shake(10, 14);
			banner('Pressure vents. The pipes go dark.');
		}
	}

	/* ---------- 2. Forge Strike (Ashen Foundry) ---------- */
	const FORGE_SEQ = [
		[0,1,2],
		[0,1,2,1],
		[0,2,1,2,0]
	];
	function setupForge(room){
		const s = st(room);
		if(s.forgeReady) return;
		s.forgeReady = true;
		s.forge = { phase:0, step:0, show:0, window:0, beat:0, misses:0, perfect:true, live:false };
		const slots = [
			{ x:200, yFromFloor:80, name:'Left Anvil' },
			{ x:room.w * 0.5 - 50, yFromFloor:80, name:'Center Anvil' },
			{ x:room.w - 280, yFromFloor:80, name:'Right Anvil' }
		];
		if(room.variant === 'sunken-hearth'){
			slots[0].x = 80; slots[0].yFromFloor = 260;
			slots[1].x = 900; slots[1].yFromFloor = 380;
			slots[2].x = 1700; slots[2].yFromFloor = 260;
		}
		for(let i = 0; i < 3; i++){
			addIt(room, {
				kind:'forgeAnvil', name:slots[i].name, idx:i,
				x:slots[i].x, yFromFloor:slots[i].yFromFloor, w:100, h:80
			});
		}
	}
	function startForge(room){
		const s = st(room);
		if(!s.forge) setupForge(room);
		s.forge.live = true;
		s.forge.phase = 0;
		s.forge.step = 0;
		s.forge.show = 90;
		s.forge.heat = 20;
		banner('The hammers wake. Watch the runes.');
	}
	function strikeAnvil(room, it){
		const s = st(room);
		const f = s.forge;
		if(!f || !f.live || f.show > 0) return;
		const seq = FORGE_SEQ[f.phase];
		const want = seq[f.step];
		const goodWin = f.window > 0 && f.window < 34;
		if(it.idx === want && goodWin){
			f.step++;
			f.heat = Math.min(100, f.heat + (f.window > 8 && f.window < 26 ? 10 : 6));
			parts(it.x + 40, it.y, '#ffcc66', 14);
			if(f.step >= seq.length){
				f.phase++;
				if(f.phase >= FORGE_SEQ.length){
					f.live = false;
					f.done = true;
					const sr = room._sr || (room._sr = { phase:0, t:0, heat:0 });
					sr.phase = 2; sr.t = 0; sr.heat = f.heat || 200;
					if(f.perfect){
						room._forgePerfect = true;
						if(env()) env().lootMult = (env().lootMult || 1) + 0.18;
						banner('Perfect Forge — the metal sings.');
					} else banner('The forging holds.');
					shake(12, 16);
				} else {
					f.step = 0;
					f.show = 80 - f.phase * 8;
					banner('Phase ' + (f.phase + 1) + ' — the hammers hurry.');
				}
			}
		} else {
			f.misses++;
			f.perfect = false;
			f.step = 0;
			f.heat = Math.max(8, f.heat - 12);
			f.show = 50;
			armVents(room, 1);
			parts(it.x + 40, it.y, '#ff4422', 16);
			banner('The strike rings false.');
		}
	}
	function tickForge(room){
		const f = st(room).forge;
		if(!f || !f.live) return;
		if(f.show > 0){ f.show--; return; }
		f.beat = (f.beat + 1) % 36;
		if(f.beat === 0) f.window = 1;
		if(f.window > 0) f.window++;
		if(f.window > 36) f.window = 0;
	}

	/* ---------- 3. Pressure Balance (Heartworks) ---------- */
	function isHeartworks(r){ return r && (r.variant === 'rising' || r.label === 'Heartworks'); }
	function setupBalance(room){
		const s = st(room);
		if(s.balReady) return;
		s.balReady = true;
		const late = (room.section || 2) >= 3;
		s.bal = late
			? { g:[2,7,3,5], green:[4,6], crit:10, done:false }
			: { g:[3,5,2], green:[4,6], crit:10, done:false };
		const xs = late ? [120, 620, 1120, 1620] : [140, 860, 1600];
		const names = ['A','B','C','D'];
		for(let i = 0; i < s.bal.g.length; i++){
			addIt(room, {
				kind:'pressureWheel', name:'Pressure ' + names[i], idx:i,
				x:xs[i], yFromFloor: i === 1 ? 460 : 340, w:90, h:90
			});
		}
	}
	function turnBalance(room, idx){
		const b = st(room).bal;
		if(!b || b.done) return;
		const g = b.g;
		if(g.length === 3){
			if(idx === 0){ g[0]+=2; g[1]-=1; }
			if(idx === 1){ g[1]+=2; g[2]-=1; }
			if(idx === 2){ g[2]+=2; g[0]-=1; }
		} else {
			if(idx === 0){ g[0]+=2; g[1]-=1; }
			if(idx === 1){ g[1]+=2; g[2]-=1; }
			if(idx === 2){ g[2]+=2; g[3]-=1; }
			if(idx === 3){ g[3]+=2; g[0]-=1; g[2]-=1; }
		}
		for(let i = 0; i < g.length; i++) g[i] = Math.max(0, Math.min(10, g[i]));
		let crit = false, ok = true;
		for(let i = 0; i < g.length; i++){
			if(g[i] >= b.crit) crit = true;
			if(g[i] < b.green[0] || g[i] > b.green[1]) ok = false;
		}
		if(ok){
			b.done = true;
			pauseRise(room, 720);
			plats().push({
				x: room.x + room.w * 0.5 - 90, y: room.y + 180, w:180, h:18,
				kind:'static', roomId:room.id, _fpLift:true
			});
			banner('The Heartworks settle. A gantry locks in.');
			shake(8, 14);
			return;
		}
		if(crit){
			for(let i = 0; i < g.length; i++) g[i] = Math.round((g[i] + 4) / 2);
			knock(player && player.x > room.x + room.w/2 ? -6 : 6);
			armVents(room, 1);
			banner('A gauge spikes — the room exhales.');
		}
	}

	/* ---------- 4. Heat Control (Furnace Room) ---------- */
	function setupHeat(room){
		const s = st(room);
		if(s.heatReady) return;
		s.heatReady = true;
		s.heat = { temp:38, press:22, hold:0, live:false, done:false };
		addIt(room, { kind:'furnaceCtrl', name:'Magma Input', ctrl:'magma', x:760, yFromFloor:200, w:90, h:80 });
		addIt(room, { kind:'furnaceCtrl', name:'Airflow', ctrl:'air', x:960, yFromFloor:200, w:90, h:80 });
		addIt(room, { kind:'furnaceCtrl', name:'Pressure Release', ctrl:'vent', x:1160, yFromFloor:200, w:90, h:80 });
		const furnace = ofKind(room, 'choice')[0];
		if(furnace) furnace._heatHost = true;
	}
	function useHeatCtrl(room, it){
		const h = st(room).heat;
		if(!h || h.done) return;
		h.live = true;
		if(it.ctrl === 'magma'){ h.temp += 9; h.press += 4; parts(it.x+40, it.y, '#ff6622', 10); }
		if(it.ctrl === 'air'){ h.temp -= 7; parts(it.x+40, it.y, '#ddeeff', 8); }
		if(it.ctrl === 'vent'){ h.press -= 12; h.temp -= 2; parts(it.x+40, it.y, '#ccc', 8); }
		h.temp = Math.max(8, Math.min(110, h.temp));
		h.press = Math.max(0, Math.min(110, h.press));
	}
	function finishFurnace(room, pick){
		const it = ofKind(room, 'choice')[0];
		if(!it || it.used) return;
		it.used = true;
		st(room).heat.done = true;
		st(room).heat.live = false;
		if(env() && env().applyFurnacePick){
			env().choiceTarget = it;
			env().applyFurnacePick(pick);
			return;
		}
		if(pick === 'overload' && env()){
			env().modifiers = env().modifiers || {};
			env().modifiers.furnaceOverload = true;
			if(env().addHeat) env().addHeat(16, '+HEAT');
			giveLoot(true, 'The chamber answers greed.');
		} else if(pick === 'stabilize'){
			if(env() && env().addHeat) env().addHeat(-6, null);
			giveLoot(false, 'The chamber steadies.');
		} else {
			if(env() && env().addHeat) env().addHeat(10, '+HEAT');
			giveLoot(false, 'Scorched salvage.');
			shake(14, 24);
		}
		if(env() && env().clearRoom) env().clearRoom(room, 'The furnace answers.');
	}
	function tickHeat(room){
		const h = st(room).heat;
		if(!h || !h.live || h.done) return;
		h.temp += h.temp > 62 ? 0.12 : 0.04;
		h.press += h.temp > 70 ? 0.16 : 0.05;
		if(h.temp >= 40 && h.temp <= 60 && h.press < 80){
			h.hold++;
			if(h.hold >= 160) finishFurnace(room, 'stabilize');
		} else h.hold = 0;
		if(h.temp >= 78 && h.press < 98){
			h.over = (h.over || 0) + 1;
			if(h.over >= 90) finishFurnace(room, 'overload');
		} else h.over = 0;
		if(h.temp >= 86 && h.press >= 86){
			h.kill = (h.kill || 0) + 1;
			if(h.kill >= 55) finishFurnace(room, 'destroy');
		} else h.kill = 0;
		if(h.press >= 108){
			h.press = 40; h.temp = Math.max(30, h.temp - 12);
			armVents(room, 1); knock(-3);
			banner('The furnace coughs steam.');
		}
	}

	/* ---------- 5. Pressure Match (Magma Siphon) ---------- */
	const SIPHON_TARGETS = [
		{ in:3, fl:2, rel:1 },
		{ in:2, fl:3, rel:3 },
		{ in:1, fl:2, rel:2 },
		{ in:2, fl:1, rel:3 },
		{ in:3, fl:3, rel:1 }
	];
	function setupSiphon(room){
		const s = st(room);
		if(s.sipReady) return;
		s.sipReady = true;
		const list = ofKind(room, 'magmaSiphon').concat(ofKind(room, 'hiddenSiphon'));
		for(let i = 0; i < list.length; i++){
			const it = list[i];
			const tgt = SIPHON_TARGETS[it._secret ? 4 : (i % 4)];
			it._tune = { in:0, fl:0, rel:0, focus:0, want:tgt };
			it.reusable = true;
			const knobs = ['in','fl','rel'];
			const names = ['Intake','Flow','Release'];
			for(let k = 0; k < 3; k++){
				addIt(room, {
					kind:'siphonKnob', name:names[k], _knob:knobs[k], _sip:it,
					x: it.x - room.x + 10 + k * 22,
					y: it.y + (it.h || 88) - 28,
					w: 20, h: 22
				});
			}
		}
	}
	function bumpKnob(it, sip){
		if(!sip || sip._off) return;
		const t = sip._tune;
		t[it._knob] = ((t[it._knob] || 0) + 1) % 4;
		const w = t.want;
			if(t.in === w.in && t.fl === w.fl && t.rel === w.rel){
			const room = rooms()[sip.roomId];
			if(sip._secret){
				sip._off = true; sip.used = true;
				if(global.SpecialRooms && SpecialRooms.unlockCaches) SpecialRooms.unlockCaches(room, 'secret');
				banner('The hidden siphon locks. A cache wakes.');
			} else if(global.SpecialRooms && SpecialRooms.finishSiphon){
				global.SpecialRooms.finishSiphon(sip);
			} else {
				sip._off = true; sip.used = true;
				banner('Siphon stable.');
			}
			shake(6, 12);
		}
	}

	/* ---------- 6. Heat Sequence (Molten Vault) ---------- */
	const VAULT_SEQ = [
		[1,3,0,2],
		[1,3,0,2,1],
		[4,1,3,0,2,4]
	];
	function setupVault(room){
		const s = st(room);
		if(s.vaultReady) return;
		s.vaultReady = true;
		const late = (room.section || 2) >= 3;
		s.vault = { seq: VAULT_SEQ[late ? 2 : 1], step:0, show:0, miss:0, live:false, done:false };
		const vault = ofKind(room, 'vault')[0];
		const cx = vault ? vault.x - room.x : 680;
		for(let i = 0; i < 5; i++){
			addIt(room, {
				kind:'vaultLock', name:'Lock — ' + LOCK_GLYPH[i], idx:i,
				x: cx - 140 + i * 72, yFromFloor: 200, w:60, h:70
			});
		}
	}
	function beginVault(room){
		const v = st(room).vault;
		if(!v || v.done) return;
		v.live = true;
		v.step = 0;
		v.show = 100;
		banner('The vault recites its locks.');
	}
	function pressLock(room, it){
		const v = st(room).vault;
		if(!v || !v.live || v.show > 0) return;
		if(it.idx === v.seq[v.step]){
			v.step++;
			bumpRise(room, 0.03);
			parts(it.x+30, it.y, '#ffaa44', 10);
			if(v.step >= v.seq.length){
				v.done = true; v.live = false;
				const vault = ofKind(room, 'vault')[0];
				pauseRise(room, 220);
				if(v.miss === 0 && env()) env().lootMult = (env().lootMult || 1) + 0.15;
				if(env() && env().openVault) env().openVault(vault);
				else if(vault) vault.used = true;
				banner(v.miss === 0 ? 'The vault opens clean — richer yield.' : 'The vault opens.');
			}
		} else {
			v.miss++;
			v.step = 0;
			v.show = 70;
			bumpRise(room, 0.05);
			armVents(room, 1);
			banner('Wrong lock. The sequence resets.');
		}
	}

	/* ---------- 7. Hold the Heat (Risk Chamber) ---------- */
	function setupRisk(room){
		const s = st(room);
		if(s.riskReady) return;
		s.riskReady = true;
		s.risk = { heat:0, live:false, cd:0, done:false };
	}
	function riskZone(h){
		if(h < 26) return 'safe';
		if(h < 56) return 'hot';
		if(h < 81) return 'extreme';
		return 'overload';
	}
	function startRisk(room){
		const r = st(room).risk;
		if(!r || r.done) return;
		if(!r.live){ r.live = true; r.heat = 0; banner('The altar drinks heat. Stop it when you dare.'); return; }
		if(r.cd > 0) return;
		stopRisk(room, false);
	}
	function ventRisk(room){
		const r = st(room).risk;
		if(!r || !r.live || r.cd > 0) return;
		r.heat = Math.max(0, r.heat - 20);
		r.cd = 36;
		parts(room.x + room.w/2, walkY(room) - 80, '#ffcc88', 12);
	}
	function stopRisk(room, failed){
		const r = st(room).risk;
		const altar = ofKind(room, 'risk')[0];
		if(!r || r.done) return;
		r.done = true; r.live = false;
		if(altar) altar.used = true;
		const z = failed ? 'overload' : riskZone(r.heat);
		if(z === 'overload'){
			if(env() && env().addHeat) env().addHeat(10, '+HEAT');
			giveLoot(false, 'The altar erupts. Common salvage.');
			banner('OVERLOAD — the chamber answers with teeth.');
			if(env() && env().spawnWave) env().spawnWave(room, 3);
			else armVents(room, 2);
		} else {
			const better = z !== 'safe';
			if(z === 'extreme' && env()) env().lootMult = (env().lootMult || 1) + 0.22;
			if(z === 'hot' && env()) env().lootMult = (env().lootMult || 1) + 0.08;
			if(env() && env().addHeat) env().addHeat(z === 'extreme' ? 18 : (z === 'hot' ? 12 : 6), '+HEAT');
			giveLoot(better, z === 'extreme' ? 'Extreme heat — rich yield.' : (z === 'hot' ? 'The altar pays.' : 'A cautious offering.'));
			banner(z === 'extreme' ? 'EXTREME — the altar holds.' : (z === 'hot' ? 'Hot enough.' : 'Safe pull.'));
		}
		if(env() && env().clearRoom) env().clearRoom(room, 'The risk is taken.');
	}
	function tickRisk(room){
		const r = st(room).risk;
		if(!r || !r.live || r.done) return;
		r.heat += 0.52;
		if(r.cd > 0) r.cd--;
		if(r.heat >= 100) stopRisk(room, true);
	}

	/* ---------- 8. Valve Logic (Three-Valve Furnace) ---------- */
	const LOGIC_SETS = [
		{
			sol:{A:2,B:1,C:1},
			clues:[
				'A burns hotter than B.',
				'B and C share the same heat.',
				'A is not at maximum.',
				'C is not the lowest setting.'
			]
		},
		{
			sol:{A:3,B:1,C:2},
			clues:[
				'A is hotter than C.',
				'C is hotter than B.',
				'B is not the lowest.',
				'A is at extreme.'
			]
		}
	];
	const HEAT_NAME = ['LOW','MEDIUM','HIGH','EXTREME'];
	function setupLogic(room){
		const s = st(room);
		if(s.logReady) return;
		s.logReady = true;
		const set = LOGIC_SETS[(room.section || 2) >= 3 ? 1 : 0];
		s.log = { sol:set.sol, dirty:false, done:false };
		const plates = ofKind(room, 'cluePlate');
		for(let i = 0; i < plates.length && i < set.clues.length; i++){
			if(!plates[i]._perfect) plates[i]._clue = set.clues[i];
		}
		const valves = ofKind(room, 'furnaceValve');
		for(let i = 0; i < valves.length; i++){
			valves[i]._state = 0;
			valves[i].reusable = true;
		}
	}
	function cycleLogicValve(it, room){
		const s = st(room);
		if(s.log && s.log.done) return;
		it._state = ((it._state || 0) + 1) % 4;
		if(s.log && s.log.sol && it._valveId != null && it._state !== s.log.sol[it._valveId]) s.log.dirty = true;
		banner((it.name || 'Valve') + ' — ' + HEAT_NAME[it._state]);
		shake(3, 6);
	}
	function testLogic(room){
		const s = st(room);
		if(!s.log || s.log.done) return;
		const want = s.log.sol;
		const got = { A:0, B:0, C:0 };
		const valves = ofKind(room, 'furnaceValve');
		for(let i = 0; i < valves.length; i++){
			if(valves[i]._valveId) got[valves[i]._valveId] = valves[i]._state || 0;
		}
		if(got.A === want.A && got.B === want.B && got.C === want.C){
			s.log.done = true;
			const lever = ofKind(room, 'furnaceLever')[0];
			if(lever) lever.used = true;
			if(!s.log.dirty && global.SpecialRooms && SpecialRooms.unlockCaches) SpecialRooms.unlockCaches(room, 'secret');
			if(global.FireSetpiece){
				/* unlock main via existing path */
			}
			for(let i = 0; i < interacts().length; i++){
				const it = interacts()[i];
				if(it.roomId === room.id && it._mainCache) it._locked = false;
				if(it.roomId === room.id && it._lockTag === 'secret' && !s.log.dirty) it._locked = false;
			}
			if(env() && env().clearRoom) env().clearRoom(room, 'Three streams become one. The door yields.');
			banner(!s.log.dirty ? 'A perfect reading. The side vault unseals.' : 'The seal accepts the heat.');
			shake(14, 20);
		} else {
			armVents(room, 1);
			banner('The seal rejects the reading.');
			shake(10, 12);
		}
	}

	/* ---------- wiring ---------- */
	function onRoomEnter(room){
		if(!room || !fireTheme()) return;
		if(room.kind === 'stabilize') setupFlow(room);
		if(room.kind === 'ashenFoundry') setupForge(room);
		if(isHeartworks(room)) setupBalance(room);
		if(room.kind === 'furnace') setupHeat(room);
		if(room.kind === 'magmaSiphon') setupSiphon(room);
		if(room.kind === 'vault') setupVault(room);
		if(room.kind === 'risk') setupRisk(room);
		if(room.kind === 'threeValveFurnace') setupLogic(room);
		st(room).ready = true;
	}

	function tryInteract(it){
		if(!it || !fireTheme()) return false;
		const room = rooms()[it.roomId];
		if(!room) return false;
		onRoomEnter(room);
		if(damaged() && (it.kind === 'flowPipe' || it.kind === 'siphonKnob' || it.kind === 'furnaceCtrl')){
			banner('The hit knocks you off the machine.');
			return true;
		}
		if(it.kind === 'valve' && room.kind === 'stabilize'){
			const s = st(room);
			if(it.used) return true;
			s.flow.active = it._flowIdx;
			s.flow.press = Math.max(s.flow.press, 8);
			banner('Magma pushes into the pipes. Route it.');
			return true;
		}
		if(it.kind === 'flowPipe'){
			it._rot = ((it._rot || 0) + 1) % 4;
			return true;
		}
		if(it.kind === 'magmaCoreSlot' && room.kind === 'ashenFoundry'){
			if((room._cores || 0) < 3){ banner('The forge wants three cores.'); return true; }
			if(st(room).forge && st(room).forge.done) return false;
			it.used = true;
			startForge(room);
			return true;
		}
		if(it.kind === 'forgeAnvil'){ strikeAnvil(room, it); return true; }
		if(it.kind === 'pressureWheel'){ turnBalance(room, it.idx); return true; }
		if(it.kind === 'choice' && room.kind === 'furnace'){
			st(room).heat.live = true;
			banner('Work the input, airflow, and release. Earn the outcome.');
			return true;
		}
		if(it.kind === 'furnaceCtrl'){ useHeatCtrl(room, it); return true; }
		if((it.kind === 'magmaSiphon' || it.kind === 'hiddenSiphon') && room.kind === 'magmaSiphon'){
			if(it._off) return true;
			if(it._locked) return false;
			banner('Tune intake, flow, and release.');
			return true;
		}
		if(it.kind === 'siphonKnob'){ bumpKnob(it, it._sip); return true; }
		if(it.kind === 'vault' && room.kind === 'vault'){
			if(st(room).vault && !st(room).vault.done){ beginVault(room); return true; }
			return false;
		}
		if(it.kind === 'vaultLock'){ pressLock(room, it); return true; }
		if(it.kind === 'risk' && room.kind === 'risk'){ startRisk(room); return true; }
		if(it.kind === 'furnaceValve' && room.kind === 'threeValveFurnace'){ cycleLogicValve(it, room); return true; }
		if(it.kind === 'furnaceLever' && room.kind === 'threeValveFurnace'){ testLogic(room); return true; }
		if(it.kind === 'cluePlate'){ banner(it._clue || it.lore || 'The plate is worn.'); return true; }
		return false;
	}

	function tryNearby(){
		if(!fireTheme()) return false;
		let best = null, bestScore = 1e9;
		const px = (typeof player !== 'undefined') ? player.x + player.w / 2 : 0;
		const py = (typeof player !== 'undefined') ? player.y + player.h / 2 : 0;
		for(let i = 0; i < interacts().length; i++){
			const it = interacts()[i];
			if(!it || it._locked) continue;
			const reach = it.kind === 'flowPipe' ? 70 : (it.kind === 'furnaceLever' ? 56 : 104);
			if(!near(it, reach)) continue;
			let score = Math.abs(px - (it.x + (it.w || 48) / 2)) + Math.abs(py - (it.y + (it.h || 48) / 2));
			if(it.kind === 'cache' || it.kind === 'specialCache') score -= 48;
			if(score < bestScore){ bestScore = score; best = it; }
		}
		return !!(best && tryInteract(best));
	}

	function prompt(){
		if(!fireTheme()) return null;
		for(let i = 0; i < interacts().length; i++){
			const it = interacts()[i];
			if(!it || it._locked) continue;
			if(!near(it, it.kind === 'furnaceLever' ? 56 : 110)) continue;
			if(it.kind === 'flowPipe') return 'E / click — Rotate pipe';
			if(it.kind === 'valve' && rooms()[it.roomId] && rooms()[it.roomId].kind === 'stabilize')
				return it.used ? 'Valve locked' : 'E — Feed magma into this network';
			if(it.kind === 'forgeAnvil') return 'E — Strike ' + (it.name || 'the anvil');
			if(it.kind === 'pressureWheel') return 'E — Turn ' + (it.name || 'the wheel');
			if(it.kind === 'furnaceCtrl') return 'E — Work the ' + (it.name || 'control');
			if(it.kind === 'choice' && rooms()[it.roomId] && rooms()[it.roomId].kind === 'furnace')
				return 'E — Study the furnace meters';
			if(it.kind === 'siphonKnob') return 'E — Set ' + it.name + ' (' + ['shut','low','mid','open'][(it._sip && it._sip._tune ? it._sip._tune[it._knob] : 0)] + ')';
			if(it.kind === 'magmaSiphon' || it.kind === 'hiddenSiphon')
				return it._off ? 'Siphon stable' : 'Tune the three knobs — then leave if you must';
			if(it.kind === 'vaultLock') return 'E — Press the ' + (LOCK_GLYPH[it.idx] || 'lock');
			if(it.kind === 'vault') return 'E — Wake the vault locks';
			if(it.kind === 'risk'){
				const r = st(rooms()[it.roomId]).risk;
				if(r && r.live) return 'E — Stop the altar   (hold longer for more)';
				return 'E — Heat the Risk Altar';
			}
			if(it.kind === 'furnaceValve') return 'E — Set ' + (it.name || 'valve') + ' (' + HEAT_NAME[it._state || 0] + ')';
			if(it.kind === 'furnaceLever') return 'E — Test the furnace seal';
		}
		return null;
	}

	function update(){
		if(!fireTheme()) return;
		P.pulse++;
		const room = current();
		if(room) onRoomEnter(room);
		if(damaged() && room){
			const s = st(room);
			if(s.flow) s.flow.active = -1;
			if(s.risk && s.risk.live){ /* stay live — interruptible, not cancelled */ }
		}
		if(clickEdge() && room){
			const m = worldMouse();
			for(let i = 0; i < interacts().length; i++){
				const it = interacts()[i];
				if(!it || it.roomId !== room.id) continue;
				if((it.kind === 'flowPipe' || it.kind === 'siphonKnob' || it.kind === 'vaultLock' || it.kind === 'forgeAnvil') && hitIt(it, m.x, m.y)){
					if(near(it, 140)) tryInteract(it);
					break;
				}
			}
		}
		const held = (typeof global.keys !== 'undefined' && global.keys) || (typeof window !== 'undefined' ? window.keys : null);
		if(held && (held['q'] || held['f']) && room && room.kind === 'risk'){
			ventRisk(room);
		}
		if(!room) return;
		if(room.kind === 'stabilize') tickFlow(room);
		if(room.kind === 'ashenFoundry') tickForge(room);
		if(room.kind === 'furnace') tickHeat(room);
		if(room.kind === 'vault'){
			const v = st(room).vault;
			if(v && v.show > 0) v.show--;
		}
		if(room.kind === 'risk') tickRisk(room);
		const list = hzList();
		for(let i = 0; i < list.length; i++){
			const h = list[i];
			if(h && h._fpHold > 0){
				h._fpHold--;
				h.active = false;
				if(h._fpHold <= 0 && !h._fpStayOff) h.active = true;
			}
		}
	}

	function drawGauge(ctx, x, y, w, h, val, lo, hi, crit){
		ctx.fillStyle = '#1a100c';
		ctx.fillRect(x, y, w, h);
		const t = Math.max(0, Math.min(1, val / (crit || 10)));
		ctx.fillStyle = (val >= lo && val <= hi) ? '#6ecf6a' : (val >= (crit||10) * 0.85 ? '#ff4422' : '#e0a030');
		ctx.fillRect(x + 2, y + 2 + (1 - t) * (h - 4), w - 4, t * (h - 4));
		ctx.strokeStyle = '#e8c070';
		ctx.strokeRect(x, y, w, h);
	}

	function drawHalo(ctx, sx, sy, w, h, a){
		ctx.save();
		ctx.strokeStyle = 'rgba(255,190,70,' + a + ')';
		ctx.lineWidth = 3;
		ctx.strokeRect(sx - 4, sy - 4, (w || 48) + 8, (h || 48) + 8);
		ctx.fillStyle = 'rgba(255,140,30,' + (a * 0.18) + ')';
		ctx.fillRect(sx - 2, sy - 2, (w || 48) + 4, (h || 48) + 4);
		ctx.restore();
	}

	function draw(ctx){
		if(!ctx || !fireTheme() || typeof camera === 'undefined') return;
		const camx = camera.x, camy = camera.y;
		const room = current();
		const pulse = 0.35 + 0.35 * Math.sin((P.pulse || 0) * 0.12);
		if(room){
			for(let i = 0; i < interacts().length; i++){
				const it = interacts()[i];
				if(!it || it.roomId !== room.id) continue;
				const sx = it.x - camx, sy = it.y - camy;
				if(it.kind === 'valve' && room.kind === 'stabilize' && !it.used)
					drawHalo(ctx, sx, sy, it.w, it.h, pulse);
				if((it.kind === 'magmaSiphon' || it.kind === 'hiddenSiphon') && !it._off && !it._locked)
					drawHalo(ctx, sx, sy, it.w, it.h, pulse * 0.9);
				if(it.kind === 'choice' && room.kind === 'furnace' && !it.used)
					drawHalo(ctx, sx, sy, it.w, it.h, pulse);
				if(it.kind === 'vault' && room.kind === 'vault' && !(st(room).vault && st(room).vault.done))
					drawHalo(ctx, sx, sy, it.w, it.h, pulse);
				if(it.kind === 'risk' && room.kind === 'risk' && !(st(room).risk && st(room).risk.done))
					drawHalo(ctx, sx, sy, it.w, it.h, pulse);
				if(it.kind === 'cluePlate')
					drawHalo(ctx, sx, sy, it.w, it.h, pulse * 0.7);
				if(it.kind === 'furnaceLever' && !it.used)
					drawHalo(ctx, sx, sy, it.w, it.h, pulse);
				if(it.kind === 'magmaCoreSlot' && !it.used)
					drawHalo(ctx, sx, sy, it.w, it.h, pulse);
			}
		}
		for(let i = 0; i < interacts().length; i++){
			const it = interacts()[i];
			if(!it || !it._fp) continue;
			const sx = it.x - camx, sy = it.y - camy;
			if(sx < -80 || sx > (ctx.canvas ? ctx.canvas.width : 1800) + 80) continue;
			if(it.kind === 'flowPipe'){
				const hot = !!it._hot;
				ctx.fillStyle = it._src ? '#ffaa44' : (it._dst ? '#44c8ff' : (hot ? '#ff6a18' : '#2a221c'));
				ctx.strokeStyle = hot || it._src || it._dst ? '#ffee88' : '#6a5340';
				ctx.lineWidth = (it._src || it._dst) ? 4 : 3;
				ctx.fillRect(sx, sy, it.w, it.h);
				ctx.strokeRect(sx, sy, it.w, it.h);
				if(it._src || it._dst) drawHalo(ctx, sx, sy, it.w, it.h, pulse);
				const open = pipeOpen(it);
				const cx = sx + it.w/2, cy = sy + it.h/2;
				ctx.strokeStyle = hot ? '#ffee88' : '#88725c';
				ctx.lineWidth = 4;
				ctx.beginPath();
				ctx.moveTo(cx, cy);
				if(open & N) ctx.lineTo(cx, sy + 3);
				if(open & S){ ctx.moveTo(cx, cy); ctx.lineTo(cx, sy + it.h - 3); }
				if(open & E){ ctx.moveTo(cx, cy); ctx.lineTo(sx + it.w - 3, cy); }
				if(open & W){ ctx.moveTo(cx, cy); ctx.lineTo(sx + 3, cy); }
				ctx.stroke();
				if(it._sh === 'P'){
					ctx.fillStyle = '#88aacc';
					ctx.fillRect(cx - 4, cy - 4, 8, 8);
				}
			}
			if(it.kind === 'forgeAnvil'){
				const f = room && st(room).forge;
				const seq = f && FORGE_SEQ[f.phase];
				const show = f && f.show > 0 && seq && seq[Math.floor((90 - f.show) / 18) % seq.length] === it.idx;
				const next = f && f.live && f.show <= 0 && seq && seq[f.step] === it.idx;
				ctx.fillStyle = (show || next) ? '#ffaa44' : '#3a2a20';
				ctx.fillRect(sx, sy + 30, it.w, it.h - 30);
				ctx.fillStyle = (show || next) ? '#ffe080' : '#6a4a30';
				ctx.fillRect(sx + 20, sy, 20, 40);
				if(next) drawHalo(ctx, sx, sy, it.w, it.h, pulse);
				if(f && f.window > 0 && f.window < 34 && f.live && f.show <= 0)
					ctx.strokeStyle = 'rgba(255,220,80,0.8)';
				else ctx.strokeStyle = '#a07040';
				ctx.strokeRect(sx, sy, it.w, it.h);
			}
			if(it.kind === 'pressureWheel'){
				const b = room && st(room).bal;
				const g = b && b.g[it.idx];
				const off = b && !b.done && (g < b.green[0] || g > b.green[1]);
				ctx.fillStyle = '#2a1a10';
				ctx.beginPath(); ctx.arc(sx+45, sy+45, 32, 0, Math.PI*2); ctx.fill();
				ctx.strokeStyle = off ? 'rgba(255,190,70,' + (0.5 + pulse) + ')' : '#e8a040';
				ctx.beginPath(); ctx.arc(sx+45, sy+45, 32, 0, Math.PI*2); ctx.stroke();
				if(off) drawHalo(ctx, sx, sy, it.w, it.h, pulse);
				if(b){
					drawGauge(ctx, sx + 78, sy + 8, 14, 70, b.g[it.idx], b.green[0], b.green[1], b.crit);
				}
			}
			if(it.kind === 'furnaceCtrl'){
				const h = room && st(room).heat;
				let shine = false;
				if(h && h.live && !h.done){
					if(it.ctrl === 'magma' && h.temp < 42) shine = true;
					if(it.ctrl === 'air' && h.temp > 62) shine = true;
					if(it.ctrl === 'vent' && h.press > 70) shine = true;
				}
				ctx.fillStyle = it.ctrl === 'magma' ? '#8a2208' : (it.ctrl === 'air' ? '#3a4a5a' : '#5a4a20');
				ctx.fillRect(sx, sy, it.w, it.h);
				if(shine) drawHalo(ctx, sx, sy, it.w, it.h, pulse);
				ctx.fillStyle = '#f0d090';
				ctx.font = '10px sans-serif';
				ctx.textAlign = 'center';
				ctx.fillText(it.name, sx + it.w/2, sy + 44);
			}
			if(it.kind === 'siphonKnob'){
				const v = it._sip && it._sip._tune ? it._sip._tune[it._knob] : 0;
				const want = it._sip && it._sip._tune && it._sip._tune.want ? it._sip._tune.want[it._knob] : -1;
				ctx.fillStyle = ['#2a2018','#8a4a18','#d07020','#ff7722'][v] || '#2a2018';
				ctx.beginPath(); ctx.arc(sx+14, sy+14, 12, 0, Math.PI*2); ctx.fill();
				if(it._sip && !it._sip._off && v !== want) drawHalo(ctx, sx, sy, it.w, it.h, pulse);
				ctx.fillStyle = '#ffe8c0';
				ctx.font = '9px sans-serif';
				ctx.textAlign = 'center';
				ctx.fillText(it._knob === 'in' ? 'IN' : (it._knob === 'fl' ? 'FL' : 'OUT'), sx + 10, sy - 3);
			}
			if(it.kind === 'vaultLock'){
				const v = room && st(room).vault;
				const flash = v && v.show > 0 && v.seq[Math.floor((100 - v.show) / 16) % v.seq.length] === it.idx;
				const next = v && v.live && v.show <= 0 && v.seq[v.step] === it.idx;
				ctx.fillStyle = (flash || next) ? '#ffbb55' : '#3a2414';
				ctx.fillRect(sx, sy, it.w, it.h);
				if(next || flash) drawHalo(ctx, sx, sy, it.w, it.h, pulse);
				ctx.fillStyle = '#ffe8a0';
				ctx.font = '18px sans-serif';
				ctx.textAlign = 'center';
				ctx.fillText(LOCK_MARK[LOCK_GLYPH[it.idx]] || '•', sx + it.w/2, sy + 42);
			}
		}
		if(!room) return;
		if(room.kind === 'magmaSiphon'){
			const pumps = ofKind(room, 'magmaSiphon');
			const n = pumps.filter(function(v){ return v._off && !v._secret; }).length;
			const pitX = room.x + room.w * 0.5;
			const pitY = walkY(room) - 18;
			const sx = pitX - camx, sy = pitY - camy;
			ctx.fillStyle = 'rgba(20,8,4,0.92)';
			ctx.beginPath(); ctx.ellipse(sx, sy, 110, 36, 0, 0, Math.PI * 2); ctx.fill();
			ctx.strokeStyle = 'rgba(255,120,30,0.55)';
			ctx.lineWidth = 3;
			ctx.stroke();
			if(n > 0){
				ctx.fillStyle = 'rgba(255,90,20,' + (0.35 + n * 0.2) + ')';
				ctx.beginPath(); ctx.ellipse(sx, sy, 30 + n * 22, 10 + n * 6, 0, 0, Math.PI * 2); ctx.fill();
			}
			for(let p = 0; p < pumps.length; p++){
				const it = pumps[p];
				if(it._secret) continue;
				ctx.strokeStyle = it._off ? 'rgba(255,140,40,0.85)' : 'rgba(80,40,20,0.55)';
				ctx.lineWidth = it._off ? 4 : 2;
				ctx.beginPath();
				ctx.moveTo(it.x + it.w * 0.5 - camx, it.y + it.h - camy);
				ctx.quadraticCurveTo(sx, (it.y + pitY) * 0.5 - camy, sx, sy);
				ctx.stroke();
			}
		}
		if(room.kind === 'stabilize' && st(room).flow){
			const f = st(room).flow;
			if(f.active >= 0){
				ctx.fillStyle = '#1a100c';
				ctx.fillRect(18, 86, 160, 16);
				ctx.fillStyle = '#ff5522';
				ctx.fillRect(18, 86, 160 * (f.press/100), 16);
				ctx.strokeStyle = '#e8c070';
				ctx.strokeRect(18, 86, 160, 16);
				ctx.fillStyle = '#e8c070';
				ctx.font = '11px sans-serif';
				ctx.textAlign = 'left';
				ctx.fillText('PIPE PRESSURE', 18, 82);
			}
		}
		if(room.kind === 'furnace' && st(room).heat && st(room).heat.live){
			const h = st(room).heat;
			ctx.fillStyle = '#e8c070';
			ctx.font = '12px sans-serif';
			ctx.textAlign = 'left';
			ctx.fillText('TEMP', 18, 80);
			drawGauge(ctx, 60, 64, 140, 16, h.temp, 40, 60, 110);
			ctx.fillText('PRESS', 18, 108);
			drawGauge(ctx, 60, 92, 140, 16, h.press, 0, 78, 110);
		}
		if(room.kind === 'risk' && st(room).risk && st(room).risk.live){
			const r = st(room).risk;
			const altar = ofKind(room, 'risk')[0];
			if(altar){
				const ax = altar.x + altar.w/2 - camx, ay = altar.y + altar.h/2 - camy;
				ctx.save();
				ctx.translate(ax, ay);
				ctx.strokeStyle = 'rgba(40,20,10,0.7)';
				ctx.lineWidth = 14;
				ctx.beginPath(); ctx.arc(0, 0, 70, 0, Math.PI*2); ctx.stroke();
				const z = riskZone(r.heat);
				ctx.strokeStyle = z === 'safe' ? '#6ecf6a' : (z === 'hot' ? '#e0a030' : (z === 'extreme' ? '#ff6622' : '#ff2200'));
				ctx.lineWidth = 10;
				ctx.beginPath(); ctx.arc(0, 0, 70, -Math.PI/2, -Math.PI/2 + (r.heat/100)*Math.PI*2); ctx.stroke();
				ctx.restore();
				ctx.fillStyle = '#e8c070';
				ctx.font = '12px sans-serif';
				ctx.textAlign = 'center';
				ctx.fillText(z.toUpperCase() + '  Q vents', ax, ay - 86);
			}
		}
		if(room.kind === 'ashenFoundry' && st(room).forge && st(room).forge.live){
			const f = st(room).forge;
			ctx.fillStyle = '#e8c070';
			ctx.font = '12px sans-serif';
			ctx.textAlign = 'left';
			ctx.fillText('FORGE  phase ' + (f.phase+1) + '/3' + (f.show>0 ? '  — watch' : ''), 18, 80);
			drawGauge(ctx, 18, 88, 160, 12, f.heat || 20, 40, 90, 100);
		}
	}

	function objective(room){
		if(!room || !fireTheme()) return null;
		if(room.kind === 'stabilize'){
			const n = ofKind(room, 'valve').filter(function(v){ return v.used; }).length;
			return 'ROUTE THE MAGMA — ' + n + ' / 3 valves';
		}
		if(room.kind === 'ashenFoundry' && st(room).forge && st(room).forge.live)
			return 'STRIKE THE ANVILS — phase ' + (st(room).forge.phase+1) + '/3';
		if(isHeartworks(room) && st(room).bal && !st(room).bal.done)
			return 'BALANCE THE GAUGES — then clear the room';
		if(room.kind === 'furnace' && st(room).heat && st(room).heat.live)
			return 'DRIVE TEMP AND PRESSURE TO AN OUTCOME';
		if(room.kind === 'magmaSiphon'){
			const n = ofKind(room, 'magmaSiphon').filter(function(v){ return v._off && !v._secret; }).length;
			return 'TUNE THREE SIPHONS — ' + n + ' / 3';
		}
		if(room.kind === 'vault' && st(room).vault && st(room).vault.live)
			return 'REPEAT THE VAULT LOCKS';
		if(room.kind === 'risk' && st(room).risk && st(room).risk.live)
			return 'HOLD THE HEAT — stop before overload';
		if(room.kind === 'threeValveFurnace')
			return 'SET A / B / C FROM THE PLATES, THEN TEST THE SEAL';
		return null;
	}

	global.FirePuzzles = {
		onRoomEnter:onRoomEnter,
		tryInteract:tryInteract,
		tryNearby:tryNearby,
		prompt:prompt,
		update:update,
		draw:draw,
		objective:objective,
		blocking:function(){ return false; },
		startForge:startForge
	};
})(typeof window !== 'undefined' ? window : globalThis);
