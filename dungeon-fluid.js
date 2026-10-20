/* =============================================================
   DungeonFluid — one simulation for lava and water.

   Internal: hydrostatic columns per (x, floor). Stacked rooms keep
   separate basins so volume cannot drain through the whole dungeon.
   Visible: smoothed surface polyline + packed pixel-art fill.
   ============================================================= */
(function(global){
	const COL = 12;
	const MAX_H = 1400;
	const KINDS = {
		lava:  { visc:0.78, maxFlow:8.5, lerp:0.42, fall:6.4 },
		water: { visc:0.96, maxFlow:12.0, lerp:0.52, fall:8.6 },
	};

	const Fluid = {
		ready:false,
		bins:null,
		keys:null,
		streams:null,
		_t:0,
		_volume:{ lava:0, water:0 },
	};

	function tile(){ return (typeof TILE === 'number') ? TILE : 40; }
	let _sTick = -1, _sCache = Object.create(null);
	function solidAt(x, y){
		if(typeof isSolid !== 'function') return true;
		const t = tile();
		const c = Math.floor(x / t), r = Math.floor(y / t);
		if(_sTick !== Fluid._t){ _sCache = Object.create(null); _sTick = Fluid._t; }
		const k = c * 100000 + r;
		const hit = _sCache[k];
		if(hit !== undefined) return hit;
		return (_sCache[k] = isSolid(c, r));
	}
	function viewBox(){
		const cam = (typeof camera !== 'undefined' && camera) ? camera : { x:0, y:0 };
		const vw = (typeof canvas !== 'undefined' && canvas) ? canvas.width : 1600;
		const vh = (typeof canvas !== 'undefined' && canvas) ? canvas.height : 900;
		return { x:cam.x, y:cam.y, w:vw, h:vh };
	}
	function inPlayFocus(c){
		if(!c) return false;
		const v = viewBox();
		return c.x + COL > v.x - 720 && c.x < v.x + v.w + 720 &&
			c.floor > v.y - 520 && c.floor - Math.max(c.lava, c.water, 48) < v.y + v.h + 520;
	}
	function idx(x){ return Math.floor(x / COL); }
	function colX(i){ return i * COL; }
	function amt(c, kind){ return kind === 'lava' ? c.lava : c.water; }
	function visAmt(c, kind){ return kind === 'lava' ? c.visLava : c.visWater; }
	function setAmt(c, kind, v){
		const cap = Math.max(6, c.floor - c.ceil - 2);
		v = Math.max(0, Math.min(MAX_H, Math.min(cap, v)));
		if(kind === 'lava') c.lava = v; else c.water = v;
	}
	function surf(c, kind, visual){
		const a = visual ? visAmt(c, kind) : amt(c, kind);
		return a > 1.2 ? c.floor - a : null;
	}
	function colId(c){ return c.i + ':' + Math.round(c.floor); }
	function binsAt(i){
		if(!Fluid.bins) Fluid.bins = Object.create(null);
		return Fluid.bins[i] || (Fluid.bins[i] = []);
	}

	const PBIN = 256;
	let _platHash = null, _platHashT = -1;
	function platListAt(x){
		if(_platHashT !== Fluid._t || !_platHash){
			const hash = Object.create(null);
			const plats = global.dungeon && global.dungeon.platforms;
			if(plats){
				for(let i = 0; i < plats.length; i++){
					const p = plats[i];
					if(!p || p._gone) continue;
					const a = Math.floor((p.x - 2) / PBIN);
					const b = Math.floor((p.x + p.w + 2) / PBIN);
					for(let k = a; k <= b; k++) (hash[k] || (hash[k] = [])).push(p);
				}
			}
			_platHash = hash;
			_platHashT = Fluid._t;
		}
		return _platHash[Math.floor(x / PBIN)];
	}
	function platformCoverAt(x, y){
		const list = platListAt(x);
		if(!list) return false;
		for(let i = 0; i < list.length; i++){
			const p = list[i];
			const ph = p.h || 16;
			if(x >= p.x - 2 && x <= p.x + p.w + 2 && y >= p.y - 2 && y <= p.y + ph + 10) return true;
		}
		return false;
	}
	function basinSolid(x, y){
		const d = global.dungeon;
		if(d && d._theme === 'fire' && platformCoverAt(x, y)) return false;
		return solidAt(x, y);
	}
	function floorInRange(x, y0, y1){
		const mid = x + COL * 0.5;
		let y = Math.min(y1, y0 + 2800);
		const top = Math.max(0, y0 - 20);
		for(; y > top; y -= 6){
			if(!basinSolid(mid, y) && basinSolid(mid, y + 6)) return y + 6;
		}
		if(basinSolid(mid, y1 - 2)) return y1;
		return 0;
	}
	function ceilInRange(x, floor, y0){
		const mid = x + COL * 0.5;
		for(let y = floor - 6; y > y0; y -= 8){
			if(basinSolid(mid, y)) return y + 8;
		}
		return y0;
	}
	function blockedAt(a, b, y){
		const x = (a.x < b.x) ? a.x + COL - 1 : b.x + COL - 1;
		return basinSolid(x, y);
	}

	function findNear(i, floor, slop){
		const list = Fluid.bins && Fluid.bins[i];
		if(!list) return null;
		let best = null, bestD = 1e9;
		for(let n = 0; n < list.length; n++){
			const d = Math.abs(list[n].floor - floor);
			if(d < bestD){ bestD = d; best = list[n]; }
		}
		return (best && bestD <= slop) ? best : null;
	}

	function ensure(i, y0, y1){
		const x = colX(i);
		const floor = floorInRange(x, y0, y1);
		if(!floor) return null;
		if(dryAt(x + COL * 0.5, floor - 4)) return null;
		const exist = findNear(i, floor, 48);
		if(exist) return exist;
		const c = {
			i:i, x:x,
			floor:floor,
			ceil:ceilInRange(x, floor, y0),
			lava:0, water:0,
			visLava:0, visWater:0,
		};
		binsAt(i).push(c);
		keysDirty = true;
		return c;
	}
	function probe(from, ni, create){
		const near = findNear(ni, from.floor, 72);
		if(near) return near;
		if(!create) return null;
		return ensure(ni, Math.min(from.ceil, from.floor - 200), from.floor + 90);
	}
	function probeDrop(from, ni, create){
		const near = findNear(ni, from.floor, 72);
		if(near) return near;
		const down = findNear(ni, from.floor + 200, 280);
		if(down && down.floor > from.floor + 12) return down;
		if(!create) return null;
		return ensure(ni, from.ceil - 40, from.floor + 360);
	}

	function addRect(kind, x, y, w, h){
		calm = 0;
		if(w < 6 || h < 4) return;
		fillToSurface(kind, x, w, y, y - 80, y + h + 240);
	}

	let _roomHint = null;
	function roomAround(d, x, y){
		if(!d || !d.rooms) return null;
		const hint = _roomHint;
		if(hint && x >= hint.x - 16 && x <= hint.x + hint.w + 16 && y >= hint.y - 48 && y <= hint.y + hint.h + 80) return hint;
		const rooms = d.rooms;
		for(let i = 0; i < rooms.length; i++){
			const r = rooms[i];
			if(!r) continue;
			if(x >= r.x - 16 && x <= r.x + r.w + 16 && y >= r.y - 48 && y <= r.y + r.h + 80){
				_roomHint = r;
				return r;
			}
		}
		return null;
	}
	function isDryBasin(room){
		return !!(room && (room._dryBasin || room.kind === 'ascent' || room.kind === 'descent'));
	}
	function inDryHall(x, y){
		const halls = global.dungeon && global.dungeon._dryHalls;
		if(!halls) return false;
		for(let i = 0; i < halls.length; i++){
			const h = halls[i];
			if(!h) continue;
			if(x >= h.x - 8 && x <= h.x + h.w + 8 && y >= h.y - 8 && y <= h.y + h.h + 8) return true;
		}
		return false;
	}
	function dryAt(x, y){
		return isDryBasin(roomAround(global.dungeon, x, y)) || inDryHall(x, y);
	}
	function paintColumn(c, kind, surfaceY){
		calm = 0;
		if(!c) return;
		const room = roomAround(global.dungeon, c.x + COL * 0.5, c.floor - 8);
		const walk = room ? room.y + room.h - (room.raisedFloor || 0) : c.floor;
		const fillH = room && room.kind === 'warden' ? Math.round(room.h * 0.72) : (room && room.lavaLake ? 280 : 160);
		const maxTop = Math.max(surfaceY, walk - fillH);
		const surf = Math.max(surfaceY, maxTop);
		const want = Math.min(c.floor - surf + (kind === 'lava' ? 4 : 38), c.floor - (room ? room.y + 80 : surf));
		if(want > 4) setAmt(c, kind, Math.max(amt(c, kind), want));
		if(kind === 'lava') c.visLava = c.lava;
		else c.visWater = c.water;
	}
	function fillToSurface(kind, x, w, surfaceY, searchTop, searchBot){
		if(w < 6) return;
		const i0 = idx(x), i1 = idx(x + w - 1);
		const y0 = searchTop != null ? searchTop : surfaceY - 80;
		const y1 = searchBot != null ? searchBot : surfaceY + 400;
		for(let i = i0; i <= i1; i++){
			const c = ensure(i, y0, y1);
			if(!c) continue;
			const overlap = Math.min(x + w, c.x + COL) - Math.max(x, c.x);
			if(overlap < 4) continue;
			paintColumn(c, kind, surfaceY);
		}
	}
	function fillStanding(kind, x, w, surfaceY, searchTop, searchBot, d){
		let fx = x, fw = w;
		const room = d ? roomAround(d, x + w * 0.5, surfaceY) : null;
		if(isDryBasin(room)) return;
		fillToSurface(kind, fx, fw, surfaceY, searchTop, searchBot);
	}

	function xOverlap(ax, aw, bx, bw){
		return Math.min(ax + aw, bx + bw) - Math.max(ax, bx);
	}
	function isVfxWater(t){
		return /Waterfall|WaterDrips|WaterWheel|WaterMarks|DistantWaterfall|Lily/.test(t);
	}
	function isStandingWaterDec(dec){
		const t = dec && dec.type;
		if(!t || isVfxWater(t)) return false;
		if(t === 'water' || t === 'iceWater' || t === 'iceWell' || t === 'icePool' || t === 'frozenPool') return true;
		return /Stream|Swamp|WaterChannel|StillPool/.test(t);
	}

	function consumeSources(d){
		if(!d) return;
		const lavaBands = [];
		const decs = d.decorations || [];
		for(let i = 0; i < decs.length; i++){
			const dec = decs[i];
			if(!dec) continue;
			if(dec.type === 'lava'){
				if(isDryBasin(roomAround(d, dec.x + (dec.w || 0) * 0.5, (dec.groundY != null ? dec.groundY - 8 : dec.y)))){
					dec._fluidConsumed = true;
					continue;
				}
				fillStanding('lava', dec.x, dec.w, dec.y, dec.y - 40, dec.y + (dec.h || 28) + 520, d);
				dec._fluidConsumed = true;
				lavaBands.push(dec);
			}
		}
		for(let i = 0; i < decs.length; i++){
			const dec = decs[i];
			if(!dec) continue;
			if(dec.type === 'lavaWell'){
				let covered = false;
				for(let b = 0; b < lavaBands.length; b++){
					if(xOverlap(dec.x, dec.w, lavaBands[b].x, lavaBands[b].w) > dec.w * 0.45){ covered = true; break; }
				}
				if(!covered) fillStanding('lava', dec.x, dec.w, dec.y, dec.y - 40, dec.y + (dec.h || 48) + 80, d);
				dec._fluidConsumed = true;
			}
			if(isStandingWaterDec(dec)){
				const bot = dec.y + (dec.h || 40) + 420;
				fillStanding('water', dec.x, dec.w || 80, dec.y, dec.y - 40, bot, d);
				dec._fluidConsumed = true;
			}
		}
		const hzs = d.hazards || [];
		for(let i = 0; i < hzs.length; i++){
			const h = hzs[i];
			if(!h) continue;
			if(h.type === 'channel'){
				const surface = h.y;
				const bot = (h.groundY || (h.y + (h.h || 40))) + 240;
				if(h.left) fillStanding('lava', h.left.x, h.left.w, surface, surface - 40, bot, d);
				if(h.right) fillStanding('lava', h.right.x, h.right.w, surface, surface - 40, bot, d);
				h._fluidConsumed = true;
			} else if(h.type === 'water'){
				fillStanding('water', h.x, h.w, h.y, h.y - 40, h.y + h.h + 220, d);
				h._fluidConsumed = true;
			} else if(h.type === 'rise'){
				const room = d.rooms && d.rooms[h.roomId];
				const floor = room ? room.y + room.h : (h.y0 || h.y || 0) + 80;
				const hy = h.level != null ? h.level : (h.y != null ? h.y : h.y0);
				if(hy != null && floor - hy > 8){
					fillStanding(d._theme === 'ice' || h.element === 'ice' ? 'water' : 'lava', h.x, h.w, hy, hy - 80, floor + 40, d);
				}
				h._fluidConsumed = true;
			} else if(h.type === 'flood' && h.level != null){
				const room = d.rooms && d.rooms[h.roomId];
				const floor = room ? room.y + room.h : h.y0 + 300;
				fillStanding('water', h.x, h.w || 100, h.level, h.level - 40, floor + 40, d);
				h._fluidConsumed = true;
			}
		}
	}

	let keysDirty = true;
	let moved = 0, calm = 0;          // settling: how much flowed this tick, and for how many ticks almost nothing has
	function transfer(a, b, kind, flow){
		if(flow < 0.08) return 0;
		const have = amt(a, kind);
		if(flow > have) flow = have;
		const cap = Math.max(0, (b.floor - b.ceil - 2) - amt(b, kind));
		if(flow > cap) flow = cap;
		if(flow < 0.08) return 0;
		setAmt(a, kind, have - flow);
		setAmt(b, kind, amt(b, kind) + flow);
		moved += flow;
		return flow;
	}

	function tryFlow(c, dir, kind, spec, streams, create){
		if(c && c._riseLock) return;
		const o = probeDrop(c, c.i + dir, create);
		if(!o) return;
		if(o.floor < c.floor - 72) return;
		const have = amt(c, kind);
		if(have < 1.4) return;
		const sC = c.floor - have;
		const sO = o.floor - amt(o, kind);
		const body = (sC + Math.min(c.floor, o.floor)) * 0.5;
		if(blockedAt(c, o, sC + 8) && blockedAt(c, o, body) && blockedAt(c, o, Math.min(c.floor, o.floor) - 8)) return;

		const drop = o.floor - c.floor;
		if(drop > 14){
			const spill = Math.min(spec.fall * spec.visc, have * 0.28, have - 1);
			if(spill < 0.15) return;
			const moved = transfer(c, o, kind, spill);
			if(moved > 0.2){
				streams.push({
					x: dir > 0 ? c.x + COL - 3 : c.x + 3,
					y0: c.floor - 2,
					y1: Math.max(o.floor - amt(o, kind), o.ceil + 8),
					w: 5 + Math.min(7, moved * 0.45),
					kind:kind,
				});
			}
			return;
		}

		if(sC >= sO - 0.4) return;
		if(blockedAt(c, o, sC + 6) && blockedAt(c, o, body)) return;
		const flow = Math.min(spec.maxFlow * spec.visc, (sO - sC) * 0.55);
		transfer(c, o, kind, flow);
	}

	function eachFocusCol(fn){
		if(!Fluid.bins) return;
		const v = viewBox();
		const i0 = idx(v.x - 720), i1 = idx(v.x + v.w + 720);
		const yT = v.y - 520, yB = v.y + v.h + 520;      // inPlayFocus, with the view worked out once instead of per column
		for(let i = i0; i <= i1; i++){
			const list = Fluid.bins[i];
			if(!list) continue;
			for(let n = 0; n < list.length; n++){
				const c = list[n];
				if(c && c.floor > yT && c.floor - Math.max(c.lava, c.water, 48) < yB) fn(c);
			}
		}
	}
	function pass(kind, create, focusOnly){
		const spec = KINDS[kind];
		if(!Fluid.keys) return;
		const streams = Fluid.streams[kind];
		streams.length = 0;
		function step(c){
			if(!c || amt(c, kind) < 1.2) return;
			tryFlow(c, 1, kind, spec, streams, create !== false);
			tryFlow(c, -1, kind, spec, streams, create !== false);
		}
		if(focusOnly){
			eachFocusCol(step);
			return;
		}
		const ids = Fluid.keys;
		for(let n = 0; n < ids.length; n++) step(ids[n]);
	}

	function linked(a, b, kind){
		if(!a || !b) return false;
		if(Math.abs(a.floor - b.floor) > 72) return false;
		const lip = Math.min(a.floor, b.floor) - 6;
		if(!blockedAt(a, b, lip)) return true;
		const s = Math.min(a.floor - amt(a, kind), b.floor - amt(b, kind));
		return !blockedAt(a, b, s + 10);
	}
	function expandFrontier(kind){
		if(!Fluid.keys) return;
		const ids = Fluid.keys.slice();
		for(let n = 0; n < ids.length; n++){
			const c = ids[n];
			if(!c || amt(c, kind) < 0.5) continue;
			let cur = c;
			for(let step = 0; step < 90; step++){
				const nxt = probe(cur, cur.i - 1, true);
				if(!nxt || !linked(cur, nxt, kind)) break;
				cur = nxt;
			}
			cur = c;
			for(let step = 0; step < 90; step++){
				const nxt = probe(cur, cur.i + 1, true);
				if(!nxt || !linked(cur, nxt, kind)) break;
				cur = nxt;
			}
		}
		refreshKeys();
	}
	function equalize(kind, fillOut, focusOnly){
		if(!Fluid.bins || !Fluid.keys) return;
		if(fillOut) expandFrontier(kind);
		const seen = new Set();
		function begin(start){
			if(!start || start._riseLock || seen.has(start) || amt(start, kind) < 0.8) return;
			if(focusOnly && !inPlayFocus(start)) return;
			const comp = [];
			const q = [start];
			while(q.length){
				const c = q.pop();
				if(seen.has(c)) continue;
				seen.add(c);
				comp.push(c);
				const L = fillOut ? probe(c, c.i - 1, true) : findNear(c.i - 1, c.floor, 72);
				const R = fillOut ? probe(c, c.i + 1, true) : findNear(c.i + 1, c.floor, 72);
				if(L && !seen.has(L) && linked(c, L, kind)) q.push(L);
				if(R && !seen.has(R) && linked(c, R, kind)) q.push(R);
			}
			if(comp.length < 2) return;
			let target = 1e9, wet = 0, vol = 0;
			let lo = 1e9, hi = -1e9;
			for(let k = 0; k < comp.length; k++){
				const c = comp[k];
				const a = amt(c, kind);
				vol += a;
				lo = Math.min(lo, c.ceil + 4);
				hi = Math.max(hi, c.floor);
				if(a > 8){
					target = Math.min(target, c.floor - a);
					wet++;
				}
			}
			if(vol < 2) return;
			if(fillOut && wet){
				for(let k = 0; k < comp.length; k++){
					const c = comp[k];
					const cap = Math.max(0, c.floor - c.ceil - 2);
					setAmt(c, kind, Math.max(amt(c, kind), Math.min(cap, Math.max(0, c.floor - target))));
				}
				return;
			}
			for(let iter = 0; iter < 20; iter++){
				const mid = (lo + hi) * 0.5;
				let used = 0;
				for(let k = 0; k < comp.length; k++){
					const c = comp[k];
					const cap = Math.max(0, c.floor - c.ceil - 2);
					used += Math.max(0, Math.min(cap, c.floor - mid));
				}
				if(used > vol) lo = mid;
				else hi = mid;
			}
			const surface = hi;
			for(let k = 0; k < comp.length; k++){
				const c = comp[k];
				const cap = Math.max(0, c.floor - c.ceil - 2);
				setAmt(c, kind, Math.max(0, Math.min(cap, c.floor - surface)));
			}
		}
		if(keysDirty || fillOut) refreshKeys();
		if(focusOnly) eachFocusCol(begin);
		else for(let n = 0; n < Fluid.keys.length; n++) begin(Fluid.keys[n]);
	}

	function lerpVis(){
		eachFocusCol(function(c){
			c.visLava += (c.lava - c.visLava) * KINDS.lava.lerp;
			c.visWater += (c.water - c.visWater) * KINDS.water.lerp;
			if(c.visLava < 0.4 && c.lava < 0.4) c.visLava = 0;
			if(c.visWater < 0.4 && c.water < 0.4) c.visWater = 0;
		});
	}

	function refreshKeys(){
		keysDirty = false;
		Fluid.keys = [];
		if(!Fluid.bins) return;
		for(const k in Fluid.bins){
			const list = Fluid.bins[k];
			for(let n = 0; n < list.length; n++) Fluid.keys.push(list[n]);
		}
		Fluid.keys.sort(function(a, b){
			const ba = Math.round(a.floor / 160);
			const bb = Math.round(b.floor / 160);
			if(ba !== bb) return ba - bb;
			return a.i - b.i;
		});
	}

	function tally(){
		Fluid._volume.lava = 0;
		Fluid._volume.water = 0;
		if(!Fluid.keys) return;
		for(let n = 0; n < Fluid.keys.length; n++){
			const c = Fluid.keys[n];
			if(!c) continue;
			Fluid._volume.lava += c.lava;
			Fluid._volume.water += c.water;
		}
	}

	function rebuild(){
		calm = 0; keysDirty = true;
		const d = global.dungeon;
		Fluid.bins = Object.create(null);
		Fluid.keys = [];
		Fluid.streams = { lava:[], water:[] };
		Fluid.ready = false;
		if(!d || !d.worldW) return;
		if(typeof IS_DUNGEON !== 'undefined' && !IS_DUNGEON) return;
		consumeSources(d);
		refreshKeys();
		for(let i = 0; i < 3; i++){
			equalize('lava', true);
			equalize('water', true);
			pass('lava', true, false);
			pass('water', true, false);
		}
		equalize('lava', false);
		equalize('water', false);
		pruneEmpty();
		if(Fluid.keys){
			for(let n = 0; n < Fluid.keys.length; n++){
				const c = Fluid.keys[n];
				if(!c) continue;
				c.visLava = c.lava;
				c.visWater = c.water;
			}
		}
		tally();
		Fluid.ready = Fluid.keys.length > 0;
		tiles.clear();
	}

	function setBandHeight(kind, x, w, floor, height){
		calm = 0;
		const i0 = idx(x), i1 = idx(x + w - 1);
		const y0 = floor - height - 80, y1 = floor + 40;
		for(let i = i0; i <= i1; i++){
			const c = ensure(i, y0, y1);
			if(!c) continue;
			setAmt(c, kind, height);
		}
		refreshKeys();
	}

	function invalidate(x, w){
		calm = 0;
		if(!Fluid.bins) return;
		const i0 = idx(x) - 2, i1 = idx(x + w) + 2;
		for(let i = i0; i <= i1; i++){
			const list = Fluid.bins[i];
			if(!list) continue;
			for(let n = 0; n < list.length; n++){
				const c = list[n];
				const floor = floorInRange(c.x, c.ceil - 40, c.floor + 80);
				if(floor){
					c.floor = floor;
					c.ceil = ceilInRange(c.x, floor, c.ceil - 80);
				}
			}
		}
	}

	function pruneEmpty(){
		if(!Fluid.bins) return;
		const keep = Object.create(null);
		function add(c){
			if(!c) return;
			const list = keep[c.i] || (keep[c.i] = []);
			for(let n = 0; n < list.length; n++) if(list[n] === c) return;
			list.push(c);
		}
		for(const k in Fluid.bins){
			const list = Fluid.bins[k];
			for(let n = 0; n < list.length; n++){
				const c = list[n];
				if(!c || (c.lava <= 0.7 && c.water <= 0.7)) continue;
				add(c);
				add(findNear(c.i - 1, c.floor, 80));
				add(findNear(c.i + 1, c.floor, 80));
			}
		}
		Fluid.bins = keep;
		keysDirty = true;
		refreshKeys();
	}

	function syncEvents(d){
		if(!d || !d.hazards) return;
		const rooms = d.rooms || [];
		for(let i = 0; i < d.hazards.length; i++){
			const h = d.hazards[i];
			if(!h) continue;
			if(h.type === 'rise'){
				const ice = d._theme === 'ice' || h.element === 'ice';
				const room = rooms[h.roomId];
				const floor = room ? room.y + room.h : (h.y0 || 0) + 80;
				if(ice){
					if((h.active || h._upDone) && h.level != null){
						setBandHeight('water', h.x, h.w, floor, Math.max(0, floor - h.level));
					}
				} else if(h.active && h.y != null){
					setBandHeight('lava', h.x, h.w, floor, Math.max(0, floor - h.y));
				}
			}
			if(h.type === 'flood' && h._started && !h.drained && h.level != null){
				const room = rooms[h.roomId];
				const floor = room ? room.y + room.h : h.y0 + 300;
				setBandHeight('water', h.x, h.w || 100, floor, Math.max(0, floor - h.level));
			}
			if(h.type === 'channel'){
				const sample = h.left ? h.left.x + 24 : (h.x || 0);
				const s = Fluid.surfaceAt(sample, 'lava', h.y);
				if(s != null) h.y = s;
			}
		}
	}

	function flattenRise(d){
		if(!d || !d.hazards) return;
		const rooms = d.rooms || [];
		let dirty = false;
		for(let i = 0; i < d.hazards.length; i++){
			const h = d.hazards[i];
			if(!h || h.type !== 'rise') continue;
			const ice = d._theme === 'ice' || h.element === 'ice';
			const surface = ice ? h.level : h.y;
			if(surface == null) continue;
			if(ice && !(h.active || h._upDone)) continue;
			if(!ice && !h.active) continue;
			const room = rooms[h.roomId];
			const floor = room ? room.y + room.h : (h.y0 || surface) + 80;
			const kind = ice ? 'water' : 'lava';
			h._fluidConsumed = true;
			const i0 = idx(h.x), i1 = idx(h.x + h.w - 1);
			for(let ci = i0; ci <= i1; ci++){
				let c = findNear(ci, floor, 36);
				if(!c){
					c = ensure(ci, surface - 80, floor + 40);
				}
				const list = Fluid.bins[ci] || (c ? [c] : []);
				for(let n = 0; n < list.length; n++){
					const o = list[n];
					if(!o) continue;
					if(o.floor <= surface + 4) continue;
					if(Math.abs(o.floor - floor) > 96) continue;
					o._riseLock = true;
					const high = !!(h._wardenRise || (room && room.kind === 'warden' && room._wardenArmed));
					const cap = room ? Math.min(o.floor - surface, room.h * (high ? 0.72 : 0.40)) : (o.floor - surface);
					setAmt(o, kind, Math.max(0, cap));
					if(kind === 'lava') o.visLava = o.lava;
					else o.visWater = o.water;
					dirty = true;
				}
			}
		}
		if(dirty) refreshKeys();
	}

	function tick(){
		if(!Fluid.ready) return;
		Fluid._t++;
		syncEvents(global.dungeon);
		/* Settled liquid barely moves, so once almost nothing has flowed for a second the simulation only runs every
		   fourth tick (anything that disturbs it — a new source, a tile change, a rising flood — wakes it again). */
		const sleepy = calm > 60;
		if(!sleepy || (Fluid._t % 4) === 0){
			moved = 0;
			pass('lava', false, true);
			pass('water', false, true);
			if((Fluid._t % (sleepy ? 16 : 8)) === 0){
				equalize('lava', false, true);
				equalize('water', false, true);
			}
			const flowing = (Fluid.streams.lava && Fluid.streams.lava.length) || (Fluid.streams.water && Fluid.streams.water.length);
			calm = (moved < 0.6 && !flowing) ? calm + (sleepy ? 4 : 1) : 0;
		}
		flattenRise(global.dungeon);
		lerpVis();
		// dropping empty columns rebuilds the whole index, so do it rarely (and not at all while everything is settled)
		if((Fluid._t % 180) === 0 && (!sleepy || keysDirty)) pruneEmpty();
	}

	Fluid.surfaceAt = function(x, kind, yHint){
		const list = Fluid.bins && Fluid.bins[idx(x)];
		if(!list || !list.length) return null;
		kind = kind || 'lava';
		let best = null, bestD = 1e9;
		for(let n = 0; n < list.length; n++){
			const s = surf(list[n], kind, true);
			if(s == null) continue;
			if(yHint == null) return s;
			const d = Math.abs(list[n].floor - yHint);
			if(d < bestD){ bestD = d; best = s; }
		}
		return best;
	};
	Fluid.kindAt = function(x, y){
		const list = Fluid.bins && Fluid.bins[idx(x)];
		if(!list) return null;
		for(let n = 0; n < list.length; n++){
			const c = list[n];
			if(c.visLava > 3 && y >= c.floor - c.visLava && y < c.floor + 3) return 'lava';
			if(c.visWater > 3 && y >= c.floor - c.visWater && y < c.floor + 3) return 'water';
		}
		return null;
	};
	Fluid.hits = function(x, y, w, h, kind){
		if(!Fluid.ready || !Fluid.bins) return null;
		const i0 = idx(x), i1 = idx(x + Math.max(1, w) - 1);
		for(let i = i0; i <= i1; i++){
			const list = Fluid.bins[i];
			if(!list) continue;
			for(let n = 0; n < list.length; n++){
				const c = list[n];
				const a = visAmt(c, kind);
				if(a < 3) continue;
				const top = c.floor - a;
				if(x + w > c.x && x < c.x + COL && y + h > top + 1 && y < c.floor){
					return { x:c.x, y:top, w:COL, h:a, floor:c.floor, kind:kind };
				}
			}
		}
		return null;
	};
	Fluid.hitsAny = function(x, y, w, h){
		return Fluid.hits(x, y, w, h, 'lava') || Fluid.hits(x, y, w, h, 'water');
	};

	const tex = {
		lavaSurf:(function(){ const i = new Image(); i.src = 'images/dungeon/lava-surface-px.png'; return i; })(),
		lavaBody:(function(){ const i = new Image(); i.src = 'images/dungeon/lava-body-px.png'; return i; })(),
		waterSurf:(function(){ const i = new Image(); i.src = 'images/dungeon/water-surface-px.png'; return i; })(),
		waterBody:(function(){ const i = new Image(); i.src = 'images/dungeon/water-body-px.png'; return i; })(),
	};

	function packedSrc(img, pack){
		if(!img || !img.complete || img.naturalWidth < 4) return null;
		pack = pack || 1;
		const key = '_pack' + Math.round(pack * 100);
		if(img[key]) return img[key];
		if(pack === 1) return (img[key] = img);
		const el = (typeof document !== 'undefined') ? document.createElement('canvas') : null;
		if(!el) return img;
		el.width = img.naturalWidth;
		el.height = Math.max(6, Math.round(img.naturalHeight * pack));
		const g = el.getContext('2d');
		g.imageSmoothingEnabled = false;
		g.drawImage(img, 0, 0, el.width, el.height);
		g.drawImage(img, 0, Math.round(el.height * 0.28), el.width, el.height);
		return (img[key] = el);
	}
	function patternFor(ctx, img){
		if(!img) return null;
		const w = img.naturalWidth || img.width;
		if(w < 4) return null;
		if(!img._pat){
			try{ img._pat = ctx.createPattern(img, 'repeat'); }catch(e){ img._pat = null; }
		}
		return img._pat;
	}
	function fillPattern(ctx, img, sx, sy, w, h, worldX, worldY, pack){
		if(w < 2 || h < 2) return false;
		const src = packedSrc(img, pack);
		const pat = patternFor(ctx, src);
		if(!pat) return false;
		const iw = src.naturalWidth || src.width;
		const ih = src.naturalHeight || src.height;
		const offX = ((worldX % iw) + iw) % iw;
		const offY = ((worldY % ih) + ih) % ih;
		ctx.save();
		ctx.imageSmoothingEnabled = false;
		ctx.translate(sx - offX, sy - offY);
		ctx.fillStyle = pat;
		ctx.fillRect(offX - 1, offY - 1, w + 2, h + 2);
		ctx.restore();
		return true;
	}

	const LAVA_PACK = 0.1;
	function drawKind(ctx, kind, cam, t, viewW, viewH, noStreams){
		if(!Fluid.keys) return;
		const surfImg = kind === 'lava' ? tex.lavaSurf : tex.waterSurf;
		const bodyImg = kind === 'lava' ? tex.lavaBody : tex.waterBody;
		const pad = 64;
		const viewL = cam.x - pad, viewR = cam.x + viewW + pad;
		const viewT = cam.y - pad, viewB = cam.y + viewH + pad;
		let run = [];
		function segsOf(list){
			const segs = [];
			for(let i = 0; i < list.length; i++){
				const c = list[i];
				const top = c.floor - visAmt(c, kind);
				const last = segs[segs.length - 1];
				if(last && Math.abs(last.top - top) < 6 && Math.abs(last.floor - c.floor) < 8){
					last.x1 = c.x + COL;
					last.top = (last.top * last.n + top) / (last.n + 1);
					last.n++;
				} else {
					segs.push({ x0:c.x, x1:c.x + COL, top:top, floor:c.floor, n:1 });
				}
			}
			return segs;
		}
		function flush(){
			if(run.length < 1) return;
			const first = run[0], last = run[run.length - 1];
			let minY = 1e9, maxF = 0;
			for(let i = 0; i < run.length; i++){
				const c = run[i];
				const top = c.floor - visAmt(c, kind);
				if(top < minY) minY = top;
				if(c.floor > maxF) maxF = c.floor;
			}
			const sx0 = first.x - cam.x - 3;
			const sw = last.x + COL - first.x + 6;
			if(sx0 + sw < -8 || sx0 > viewW + 8 || minY - cam.y > viewH + 8 || maxF - cam.y < -8){
				run = [];
				return;
			}
			const segs = segsOf(run);
			ctx.save();
			ctx.imageSmoothingEnabled = false;
			ctx.beginPath();
			for(let i = 0; i < segs.length; i++){
				const s = segs[i];
				const px = s.x0 - cam.x - 3;
				const py = s.top - cam.y;
				if(i === 0) ctx.moveTo(px, py);
				else ctx.lineTo(px, py);
				ctx.lineTo(s.x1 - cam.x + 3, py);
			}
			ctx.lineTo(last.x + COL + 4 - cam.x, maxF - cam.y + 2);
			ctx.lineTo(first.x - 3 - cam.x, maxF - cam.y + 2);
			ctx.closePath();
			ctx.clip();
			const bodyY = minY - cam.y - 2;
			const bodyH = maxF - minY + 6;
			const skipImg = isIceTheme() && kind === 'water';
			ctx.fillStyle = kind === 'lava' ? '#c43008' : 'rgba(28,92,108,0.92)';
			ctx.fillRect(sx0, bodyY, sw, bodyH);
			const pack = kind === 'lava' ? LAVA_PACK : 1;
			if(!skipImg && fillPattern(ctx, bodyImg, sx0, bodyY, sw, bodyH, first.x, minY, pack)){
				/* pixel-art body */
			} else {
				ctx.fillStyle = kind === 'lava' ? '#b42800' : 'rgba(40,110,130,0.78)';
				ctx.fillRect(sx0, bodyY, sw, bodyH);
			}
			ctx.restore();

			ctx.save();
			ctx.imageSmoothingEnabled = false;
			ctx.beginPath();
			for(let i = 0; i < segs.length; i++){
				const s = segs[i];
				const px = s.x0 - cam.x - 3;
				const py = s.top - cam.y;
				if(i === 0) ctx.moveTo(px, py);
				else ctx.lineTo(px, py);
				if(i === segs.length - 1) ctx.lineTo(s.x1 - cam.x + 3, py);
			}
			ctx.strokeStyle = kind === 'lava' ? '#ffb34a' : 'rgba(190,235,240,0.85)';
			ctx.lineWidth = 4;
			ctx.lineJoin = 'round';
			ctx.stroke();
			const s0 = segs[0], s1 = segs[segs.length - 1];
			if(s0){
				const px = s0.x0 - cam.x - 3;
				const py = s0.top - cam.y;
				const tw = s1.x1 - s0.x0 + 6;
				if(!skipImg && fillPattern(ctx, surfImg, px, py - 3, tw, 14, s0.x0, 0, 1)){
					/* pixel-art surface */
				} else {
					ctx.fillStyle = kind === 'lava' ? '#ffb030' : 'rgba(190,235,240,0.7)';
					ctx.fillRect(px, py, tw, 4);
				}
			}
			ctx.restore();
			run = [];
		}
		const keys = [];
		if(Fluid.bins){
			const i0 = idx(viewL), i1 = idx(viewR);
			for(let i = i0; i <= i1; i++){
				const list = Fluid.bins[i];
				if(!list) continue;
				for(let n = 0; n < list.length; n++) keys.push(list[n]);
			}
			keys.sort(function(a, b){
				const ba = Math.round(a.floor / 160);
				const bb = Math.round(b.floor / 160);
				if(ba !== bb) return ba - bb;
				return a.i - b.i;
			});
		}
		for(let n = 0; n < keys.length; n++){
			const c = keys[n];
			const a = c ? visAmt(c, kind) : 0;
			if(!c || a < 3){ flush(); continue; }
			if(c.x + COL < viewL || c.x > viewR || c.floor < viewT || c.floor - a > viewB){ flush(); continue; }
			const prev = run[run.length - 1];
			if(prev && (c.i !== prev.i + 1 || Math.abs(c.floor - prev.floor) > 90)) flush();
			run.push(c);
		}
		flush();

		if(!noStreams) drawStreams(ctx, kind, cam, viewW, viewH);
	}
	function drawStreams(ctx, kind, cam, viewW, viewH){
		const streams = Fluid.streams && Fluid.streams[kind];
		if(streams){
			for(let i = 0; i < streams.length; i++){
				const s = streams[i];
				const sx = s.x - cam.x, sy0 = s.y0 - cam.y, sy1 = s.y1 - cam.y;
				if(sx < -24 || sx > viewW + 24 || sy1 < -20 || sy0 > viewH + 20) continue;
				const h = Math.max(4, sy1 - sy0);
				const x0 = Math.round(sx);
				ctx.fillStyle = kind === 'lava' ? '#ff7a18' : 'rgba(150,220,230,0.7)';
				ctx.fillRect(x0, Math.round(sy0), Math.max(3, (s.w | 0) - 1), h);
				ctx.fillStyle = kind === 'lava' ? '#ffe080' : 'rgba(230,255,255,0.45)';
				ctx.fillRect(x0 + 1, Math.round(sy0), 2, h);
			}
		}
	}

	function isIceTheme(){
		return (typeof DUNGEON_TYPE !== 'undefined' && DUNGEON_TYPE === 'ice') ||
			(typeof dungeon !== 'undefined' && dungeon && dungeon._theme === 'ice');
	}
	/* Drawing. Liquid is painted into 512 px world tiles that are kept until the liquid inside them changes (a settled
	   pool is painted once). Before, the whole screen was repainted into an offscreen canvas every few frames and again
	   whenever the camera moved 8 px — so walking past water or lava repainted it every frame. Falling streams change
	   every frame and are drawn directly. */
	const TCH = 512, MAX_TILES = 40;
	const tiles = new Map();
	let tileFrame = 0;
	function tileSig(tx, ty){
		// a cheap fingerprint of the liquid that can show in this tile: rounded visible depths of the columns around it
		const x0 = tx * TCH - 72, x1 = tx * TCH + TCH + 72, y0 = ty * TCH - 72, y1 = ty * TCH + TCH + 72;
		let h = 0, any = false;
		if(!Fluid.bins) return 'e';
		for(let i = idx(x0), ie = idx(x1); i <= ie; i++){
			const list = Fluid.bins[i];
			if(!list) continue;
			for(let n = 0; n < list.length; n++){
				const c = list[n];
				const a = Math.max(c.visLava, c.visWater);
				if(a < 3 || c.floor < y0 || c.floor - a > y1) continue;
				any = true;
				h = (Math.imul(h, 31) + i * 7 + Math.round(c.floor) + Math.round(c.visLava / 2) * 131 + Math.round(c.visWater / 2) * 977) | 0;
			}
		}
		return any ? String(h) + (isIceTheme() ? 'i' : '') : 'e';
	}
	function paintTile(t, tx, ty){
		const g = t.g;
		g.setTransform(1, 0, 0, 1, 0, 0);
		g.clearRect(0, 0, TCH, TCH);
		const cam = { x: tx * TCH, y: ty * TCH };
		drawKind(g, 'lava', cam, 0, TCH, TCH, true);
		drawKind(g, 'water', cam, 0, TCH, TCH, true);
	}
	Fluid.draw = function(ctx){
		if(!Fluid.ready || !ctx) return;
		const cam = (typeof camera !== 'undefined' && camera) ? camera : { x:0, y:0 };
		const viewW = (typeof canvas !== 'undefined' && canvas) ? canvas.width : 1600;
		const viewH = (typeof canvas !== 'undefined' && canvas) ? canvas.height : 900;
		ctx.imageSmoothingEnabled = false;
		if(typeof document === 'undefined'){
			drawKind(ctx, 'lava', cam, 0, viewW, viewH);
			drawKind(ctx, 'water', cam, 0, viewW, viewH);
			return;
		}
		tileFrame++;
		let repaints = 0;
		const tx0 = Math.floor(cam.x / TCH), tx1 = Math.floor((cam.x + viewW) / TCH);
		const ty0 = Math.floor(cam.y / TCH), ty1 = Math.floor((cam.y + viewH) / TCH);
		for(let ty = ty0; ty <= ty1; ty++) for(let tx = tx0; tx <= tx1; tx++){
			const key = tx + ',' + ty;
			let t = tiles.get(key);
			const sig = tileSig(tx, ty);
			if(sig === 'e'){ if(t) t.sig = 'e'; continue; }
			if(!t){
				const el = document.createElement('canvas'); el.width = el.height = TCH;
				t = { el, g: el.getContext('2d'), sig: '', used: 0 };
				t.g.imageSmoothingEnabled = false;
				tiles.set(key, t);
				if(tiles.size > MAX_TILES){ let ok = null, ou = Infinity; for(const [k, v] of tiles) if(v.used < ou){ ou = v.used; ok = k; } if(ok) tiles.delete(ok); }
			}
			t.used = tileFrame;
			// repaint changed tiles, a few a frame (a tile that has never been painted always is)
			if(t.sig !== sig && (repaints < 3 || !t.sig)){ paintTile(t, tx, ty); t.sig = sig; repaints++; }
			ctx.drawImage(t.el, Math.round(tx * TCH - cam.x), Math.round(ty * TCH - cam.y));
		}
		drawStreams(ctx, 'lava', cam, viewW, viewH);
		drawStreams(ctx, 'water', cam, viewW, viewH);
	};
	Fluid.clearDrawCache = function(){ tiles.clear(); };

	Fluid.rebuild = rebuild;
	Fluid.tick = tick;
	Fluid.syncEvents = syncEvents;
	Fluid.setBandHeight = setBandHeight;
	Fluid.invalidate = invalidate;
	Fluid.addRect = addRect;
	Fluid.isStandingWaterDec = isStandingWaterDec;
	Fluid.isVfxWater = isVfxWater;

	global.DungeonFluid = Fluid;
})(typeof window !== 'undefined' ? window : globalThis);
