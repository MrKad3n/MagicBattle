/* =============================================================
   Glacial Reach — authored ice puzzles on existing rooms.
   No new templates. Physical ice objects only.
   ============================================================= */
(function(global){
	'use strict';

	const P = { pulse:0 };

	function dung(){ return (typeof dungeon !== 'undefined' && dungeon) || global.dungeon; }
	function env(){ return global.DungeonEnv; }
	function rooms(){ return (dung() && dung().rooms) || []; }
	function interacts(){ return (dung() && dung().interactables) || []; }
	function plats(){ return (typeof platforms !== 'undefined' && platforms) || (dung() && dung().platforms) || []; }
	function current(){ return env() && env().currentRoom; }
	function iceTheme(){ const d = dung(); return !!(d && d._theme === 'ice'); }
	function banner(t){ if(env() && env().showBanner) env().showBanner(t); }
	function shake(a,b){ if(typeof shakeScreen === 'function') shakeScreen(a, b); }
	function cam(){ return global.camera || {x:0,y:0}; }
	function st(r){
		if(!r) return null;
		if(!r._ip) r._ip = { ready:false };
		return r._ip;
	}
	function near(it, reach){
		if(typeof player === 'undefined' || !it) return false;
		const px = player.x + player.w/2, py = player.y + player.h/2;
		const r = reach || 92;
		return Math.abs(px - (it.x + (it.w||48)/2)) < r && Math.abs(py - (it.y + (it.h||48)/2)) < r + 18;
	}
	function addIt(room, spec){
		const rec = Object.assign({
			roomId: room.id,
			x: room.x + (spec.lx || 0),
			y: room.y + (spec.ly || 0),
			w: spec.w || 48, h: spec.h || 56,
			reusable: true, used: false, _ip: true
		}, spec);
		delete rec.lx; delete rec.ly;
		interacts().push(rec);
		return rec;
	}
	function ofKind(room, kind){
		return interacts().filter(function(it){ return it && it.roomId === room.id && it.kind === kind; });
	}
	function finish(room, msg){
		const s = st(room);
		if(s.done) return;
		s.done = true;
		if(env() && env().clearRoom) env().clearRoom(room, msg || 'The ice yields.');
		else banner(msg || 'The ice yields.');
		shake(10, 14);
	}
	function unlockCaches(room, tag){
		for(let i = 0; i < interacts().length; i++){
			const it = interacts()[i];
			if(!it || it.roomId !== room.id) continue;
			if(it._lockTag === tag || (tag === 'main' && it._mainCache)){
				it._locked = false; it.locked = false;
			}
		}
	}

	/* ---------- 1. Ice Momentum — Glide Hollow ---------- */
	function setupGlide(room){
		const s = st(room);
		if(s.glide) return;
		s.glide = { stage:0, check:{ x:room.x + 40, y:room.y + 500 }, grooves:[] };
		const pads = [
			{ lx:40, ly:520, w:160, h:36, stage:0, name:'Launch' },
			{ lx:260, ly:500, w:140, h:36, stage:1, name:'First Hold' },
			{ lx:640, ly:460, w:160, h:36, stage:2, name:'Turn Shelf' },
			{ lx:1060, ly:500, w:160, h:36, stage:3, name:'Long Slide' },
			{ lx:1380, ly:500, w:140, h:40, stage:4, name:'Seal' },
		];
		for(let i = 0; i < pads.length; i++){
			addIt(room, Object.assign({ kind:'icePad', icon:'◇' }, pads[i]));
		}
		addIt(room, { kind:'iceArrow', lx:200, ly:490, w:70, h:16, dir:1 });
		addIt(room, { kind:'iceArrow', lx:500, ly:440, w:80, h:16, dir:1 });
		addIt(room, { kind:'iceArrow', lx:920, ly:480, w:90, h:16, dir:1 });
		addIt(room, { kind:'iceWallMark', lx:480, ly:360, w:36, h:120 });
		addIt(room, { kind:'iceWallMark', lx:900, ly:340, w:36, h:140 });
		s.glide.clue = [
			{ x:room.x + 180, y:room.y + 536, vx:8 },
			{ x:room.x + 520, y:room.y + 496, vx:6 },
			{ x:room.x + 980, y:room.y + 536, vx:9 }
		];
		s.glide.pitY = room.y + room.h - 48;
	}
	function tickGlide(room){
		const s = st(room);
		if(!s.glide || s.done) return;
		const g = s.glide;
		if(player.onGround && Math.abs(player.vx) > 3){
			g.grooves.push({ x:player.x + player.w/2, y:player.y + player.h, t:90, vx:player.vx });
			if(g.grooves.length > 40) g.grooves.shift();
		}
		for(let i = g.grooves.length - 1; i >= 0; i--){
			g.grooves[i].t--;
			if(g.grooves[i].t <= 0) g.grooves.splice(i, 1);
		}
		if(player.y + player.h > g.pitY && player.y > room.y + 520){
			player.x = g.check.x; player.y = g.check.y;
			player.vx = 0; player.vy = 0; player._iceVx = 0;
			banner('The meltwater returns you.');
			shake(4, 8);
		}
		const pads = ofKind(room, 'icePad');
		for(let i = 0; i < pads.length; i++){
			const it = pads[i];
			if(it.stage !== g.stage + 1 && !(g.stage === 0 && it.stage === 0)) continue;
			if(player.onGround && player.x + player.w > it.x && player.x < it.x + it.w &&
				player.y + player.h >= it.y - 12 && player.y + player.h <= it.y + it.h + 16){
				if(it.stage === g.stage) {
					g.check = { x:it.x, y:it.y - player.h };
				}
				if(it.stage === g.stage + 1 || (g.stage === 0 && it.stage === 1 && Math.abs(player.vx) > 2)){
					g.stage = Math.max(g.stage, it.stage);
					g.check = { x:it.x, y:it.y - player.h };
					it._lit = true;
					if(g.stage >= 4) finish(room, 'The far ice locks. The route opens.');
					else banner(it.name + '.');
				}
			}
		}
	}

	/* ---------- 2. Mirror Beam — Mirror Gallery ---------- */
	const MDIR = [{x:1,y:0},{x:0,y:1},{x:-1,y:0},{x:0,y:-1}];
	function clearIpKind(room, kind){
		const list = interacts();
		for(let i = list.length - 1; i >= 0; i--){
			const it = list[i];
			if(it && it._ip && it.roomId === room.id && it.kind === kind) list.splice(i, 1);
		}
	}
	function setupMirror(room){
		const s = st(room);
		if(s.beam && s.beam.ver === 2 && ofKind(room, 'iceMirror').length) return;
		if(s.beam){
			clearIpKind(room, 'iceMirror');
			clearIpKind(room, 'iceReceiver');
		}
		/* Zigzag: first / sends UP into a second mirror, then across. */
		s.beam = { src:{ x:room.x + 90, y:room.y + 805 }, segs:[], secret:false, ver:2 };
		const specs = [
			{ lx:400, ly:730, ang:2 },
			{ lx:400, ly:450, ang:1 },
			{ lx:980, ly:450, ang:1 },
			{ lx:980, ly:730, ang:0 },
			{ lx:1680, ly:730, ang:2 },
		];
		for(let i = 0; i < specs.length; i++){
			addIt(room, Object.assign({ kind:'iceMirror', w:40, h:140, name:'Ice Mirror', faces:4, reusable:true }, specs[i]));
		}
		addIt(room, { kind:'iceReceiver', lx:2040, ly:760, w:56, h:100, name:'True Crystal', real:true });
		addIt(room, { kind:'iceReceiver', lx:1240, ly:450, w:46, h:80, name:'False Crystal', real:false });
		addIt(room, { kind:'iceReceiver', lx:1680, ly:300, w:46, h:80, name:'Hidden Crystal', real:false, secret:true });
	}
	function bounceDir(incoming, face){
		const map = [
			{0:3, 1:0, 2:1, 3:2},
			{0:1, 1:2, 2:3, 3:0},
			{0:0, 1:1, 2:2, 3:3},
			{0:2, 1:3, 2:0, 3:1}
		];
		const m = map[face & 3];
		return m[incoming] != null ? m[incoming] : (incoming ^ 2);
	}
	function tickBeam(room){
		const s = st(room);
		if(!s.beam || s.done) return;
		const mirrors = ofKind(room, 'iceMirror');
		const recs = ofKind(room, 'iceReceiver');
		const segs = [];
		let x = s.beam.src.x, y = s.beam.src.y, dir = 0, hops = 0;
		let hitReal = false, hitSecret = false, last = null;
		while(hops < 14){
			const d = MDIR[dir];
			const nx = x + d.x * 2600, ny = y + d.y * 2600;
			let best = null, bestT = 1;
			for(let i = 0; i < mirrors.length; i++){
				const m = mirrors[i];
				if(m === last) continue;
				const cx = m.x + m.w/2, cy = m.y + m.h/2;
				let t = 1;
				if(d.x !== 0){
					t = (cx - x) / (nx - x);
					if(t <= 0.02 || t >= bestT) continue;
					const yy = y + (ny - y) * t;
					if(yy < m.y - 18 || yy > m.y + m.h + 18) continue;
				} else {
					t = (cy - y) / (ny - y);
					if(t <= 0.02 || t >= bestT) continue;
					const xx = x + (nx - x) * t;
					if(xx < m.x - 18 || xx > m.x + m.w + 18) continue;
				}
				best = m; bestT = t;
			}
			for(let i = 0; i < recs.length; i++){
				const m = recs[i];
				const cx = m.x + m.w/2, cy = m.y + m.h/2;
				let t = 1;
				if(d.x !== 0){
					t = (cx - x) / (nx - x);
					if(t <= 0.02 || t >= bestT) continue;
					const yy = y + (ny - y) * t;
					if(yy < m.y - 10 || yy > m.y + m.h + 10) continue;
				} else {
					t = (cy - y) / (ny - y);
					if(t <= 0.02 || t >= bestT) continue;
					const xx = x + (nx - x) * t;
					if(xx < m.x - 10 || xx > m.x + m.w + 10) continue;
				}
				best = m; bestT = t;
			}
			const ex = x + (nx - x) * (best ? bestT : 0.35);
			const ey = y + (ny - y) * (best ? bestT : 0.35);
			segs.push({ x1:x, y1:y, x2:ex, y2:ey, false:false });
			if(!best) break;
			if(best.kind === 'iceReceiver'){
				best._lit = true;
				if(best.real) hitReal = true;
				if(best.secret) hitSecret = true;
				break;
			}
			dir = bounceDir(dir, best.ang || 0);
			best._glow = 18;
			last = best;
			x = ex; y = ey;
			hops++;
		}
		for(let i = 0; i < recs.length; i++) if(!recs[i]._lit) recs[i]._lit = false;
		s.beam.segs = segs;
		if(hitSecret && !s.beam.secret){
			s.beam.secret = true;
			unlockCaches(room, 'secret');
			banner('A second crystal drinks the light.');
		}
		if(hitReal && !s.done){
			finish(room, 'The true crystal sings. The gallery opens.');
		}
	}

	/* ---------- 3. Ice Weight — Still Lake / Frozen Lake ---------- */
	function setupWeight(room){
		const s = st(room);
		if(s.weight) return;
		s.weight = { true:true };
		const list = plats();
		for(let i = 0; i < list.length; i++){
			const p = list[i];
			if(!p || p.roomId != null && p.roomId !== room.id) continue;
			if(p.x < room.x - 20 || p.x > room.x + room.w + 20) continue;
			if(p.kind === 'thinIce'){
				p._iceFragile = true;
				if(!p._iceState){
					if((p.life || 140) <= 120) p._iceState = 'veryThin';
					else p._iceState = 'thin';
				}
			} else if(p._iceState){
				if(p._iceState === 'veryThin' || p._iceState === 'cracked' || p._iceState === 'thin'){
					p._iceFragile = true;
					p.kind = p.kind || 'thinIce';
					p.life = p._iceState === 'cracked' ? 28 : (p._iceState === 'veryThin' ? 70 : 140);
				}
			}
		}
		if(room.kind === 'lake'){
			const mid = list.filter(function(p){ return p.kind === 'thinIce' && p.x > room.x + 1000 && p.x < room.x + 1400; })[0];
			if(mid){ mid._iceState = 'veryThin'; mid.life = 90; mid._secretHint = true; }
			for(let i = 0; i < list.length; i++){
				const p = list[i];
				if(!p || p.roomId != null && p.roomId !== room.id) continue;
				if(p.kind === 'static' && p.y > room.y + 900 && p.w >= 180) p._iceState = p._iceState || 'thick';
			}
		}
		if(room.kind === 'frozenLake'){
			for(let i = 0; i < list.length; i++){
				const p = list[i];
				if(!p || (p.roomId != null && p.roomId !== room.id)) continue;
				if(p._iceState === 'veryThin'){ p._secretHint = true; p._iceFragile = true; }
			}
		}
	}
	function tickWeight(room){
		const s = st(room);
		if(!s.weight) return;
		const list = plats();
		for(let i = 0; i < list.length; i++){
			const p = list[i];
			if(!p || p._gone || !p._iceFragile) continue;
			if(player.onGround && player.x + player.w > p.x && player.x < p.x + p.w && Math.abs(player.y + player.h - p.y) < 18){
				p._peek = 80;
				if(p._secretHint){
					unlockCaches(room, 'main');
					unlockCaches(room, 'secret');
					for(let k = 0; k < interacts().length; k++){
						const it = interacts()[k];
						if(it && it.roomId === room.id && /Sunken Cache/i.test(it.name || '')){
							it._locked = false; it.locked = false;
						}
					}
				}
			}
			if(p._peek > 0) p._peek--;
		}
	}

	/* ---------- 4. Freeze Frame — Hanging Fall ---------- */
	function setupFreeze(room){
		const s = st(room);
		if(s.frame) return;
		s.frame = { t:0 };
		const list = plats();
		let n = 0;
		for(let i = 0; i < list.length; i++){
			const p = list[i];
			if(!p || (p.roomId != null && p.roomId !== room.id)) continue;
			const onRoute = p.kind === 'shelf' || (p.kind === 'static' && p.y < room.y + 1600 && p.y > room.y + 400 && p.w <= 240);
			if(!onRoute) continue;
			p._cycle = true;
			p._phase = n * 55;
			p._period = 260;
			n++;
		}
	}
	function tickFreeze(room){
		const s = st(room);
		if(!s.frame || s.done) return;
		s.frame.t++;
		const list = plats();
		let topY = room.y + room.h;
		for(let i = 0; i < list.length; i++){
			const p = list[i];
			if(!p || !p._cycle) continue;
			if(p.y < topY) topY = p.y;
			const t = ((s.frame.t + (p._phase || 0)) % (p._period || 280));
			p._glow = t < 70 ? 'blue' : t < 140 ? 'white' : t < 200 ? 'crack' : 'gone';
			if(p._glow === 'gone'){
				if(!p._gone){
					p._gone = true;
					if(global.IceWorld && typeof tileMap !== 'undefined'){
						/* leave air while collapsed */
					}
				}
			} else if(p._gone){
				p._gone = false;
			}
		}
		if(player.y + player.h < topY + 80 && player.x > room.x + room.w * 0.4){
			finish(room, 'The hanging ice stills. The climb holds.');
		}
	}

	/* ---------- 5. Shatter Pattern — Shatter Maze ---------- */
	function setupShatter(room){
		const s = st(room);
		if(s.shatter) return;
		s.shatter = { broken:{} };
		const walls = ofKind(room, 'iceBreak');
		for(let i = 0; i < walls.length; i++){
			const it = walls[i];
			if(/Hidden Reflection|reflection/i.test(it.name || '') || /hall that is not there/i.test(it.lore || '')) it._wallType = 'reflectHide';
			else if(/False|nothing|empty/i.test(it.lore || '') || /False/i.test(it.name || '')) it._wallType = 'false';
			else if(/support|fails/i.test(it.lore || '')) it._wallType = 'support';
			else if(i === 1 && walls.length >= 3) it._wallType = 'support';
			else if(i === walls.length - 1 && walls.length === 2) it._wallType = 'false';
			else it._wallType = 'crystal';
		}
	}
	function punchIceWall(it, room){
		if(!it || it._wallType === 'reflective') return;
		const e = env();
		if(!e || !e.stampTiles) return;
		let punched = false;
		const solids = (room && room.solids) || [];
		for(let i = 0; i < solids.length; i++){
			const s = solids[i];
			if(Math.abs(s.x - it.x) < 48 && it.y + it.h > s.y && it.y < s.y + s.h){
				if(it._wallType === 'false') e.stampTiles(it.x, it.y, it.w, Math.min(it.h + 20, 100), true);
				else e.stampTiles(s.x, s.y, s.w, s.h, true);
				punched = true;
			}
		}
		if(!punched) e.stampTiles(it.x - 8, it.y - 40, it.w + 16, it.h + 80, true);
		if(typeof computeTileEdges === 'function') computeTileEdges();
		if(global.IceArt && IceArt.invalidateTiles) IceArt.invalidateTiles();
	}
	function breakWall(it, room){
		if(it.used) return;
		it.used = true;
		shake(8, 12);
		const s = st(room);
		s.shatter.broken[it._wallType || 'crystal'] = true;
		punchIceWall(it, room);
		if(it._wallType === 'support'){
			const list = plats();
			for(let i = 0; i < list.length; i++){
				const p = list[i];
				if(p.roomId === room.id && p.y < room.y + 640 && p.w < 280){
					p._gone = true;
				}
			}
			banner('The support fails. A shelf drops away.');
		} else if(it._wallType === 'reflectHide'){
			unlockCaches(room, 'secret');
			banner('The reflection splits. A cache waits behind it.');
		} else if(it._wallType === 'false'){
			banner('Empty ice. Nothing beyond.');
		} else {
			banner('The crystal wall shatters. A path opens.');
			unlockCaches(room, 'main');
			finish(room, 'The maze remembers the cuts.');
		}
	}

	/* ---------- 6. Frozen Memory ---------- */
	const MEM_SEQ = [
		{ id:'gate', name:'Opened Gate' },
		{ id:'knight', name:'Raised Sword' },
		{ id:'crystal', name:'Broken Crystal' },
		{ id:'shield', name:'Fallen Shield' },
	];
	function setupMemory(room){
		const s = st(room);
		if(s.mem) return;
		const len = (room.section || 1) <= 2 ? 3 : 4;
		s.mem = { step:0, play:90, fog:0, len:len };
		const nodes = [
			{ lx:220, ly:580, id:'gate' },
			{ lx:500, ly:580, id:'knight' },
			{ lx:620, ly:540, id:'crystal' },
			{ lx:740, ly:580, id:'shield' },
		];
		for(let i = 0; i < len; i++){
			addIt(room, { kind:'memoryNode', lx:nodes[i].lx, ly:nodes[i].ly, w:56, h:70, memId:nodes[i].id, name:MEM_SEQ[i].name });
		}
	}
	function tickMemory(room){
		const s = st(room);
		if(!s.mem || s.done) return;
		if(s.mem.play > 0) s.mem.play--;
		if(s.mem.fog > 0) s.mem.fog--;
	}
	function useMemoryNode(it, room){
		const s = st(room);
		if(!s.mem || s.done) return true;
		const want = MEM_SEQ[s.mem.step];
		if(!want) return true;
		if(it.memId !== want.id){
			s.mem.step = 0;
			s.mem.fog = 50;
			s.mem.play = 70;
			banner('The memory unravels and begins again.');
			return true;
		}
		s.mem.step++;
		it._lit = true;
		banner(it.name + '.');
		if(s.mem.step >= (s.mem.len || MEM_SEQ.length)){
			const mem = ofKind(room, 'memory')[0];
			if(mem && env() && env().openMemory) env().openMemory(mem);
			else if(mem){ mem.used = true; }
			finish(room, 'The preserved moment holds.');
		}
		return true;
	}

	/* ---------- 7. Ring Alignment ---------- */
	const RING_SYM = {
		outer:['wolf','stag','bear','owl'],
		middle:['moon','sun','star','moon','void','comet'],
		inner:['mountain','sea','tree','heart']
	};
	function setupRings(room){
		const s = st(room);
		if(s.ring) return;
		s.ring = { dirty:false };
		const rings = ofKind(room, 'ring').sort(function(a,b){ return (a.order||0) - (b.order||0); });
		const kinds = ['outer','middle','inner'];
		for(let i = 0; i < rings.length; i++){
			const k = kinds[i] || 'inner';
			rings[i]._ring = k;
			rings[i]._pos = k === 'outer' ? 2 : k === 'middle' ? 4 : 1;
			rings[i]._want = k === 'outer' ? 0 : k === 'middle' ? 0 : 0;
			rings[i].reusable = true;
			rings[i].used = false;
			rings[i].name = (k === 'outer' ? 'Outer Ring' : k === 'middle' ? 'Middle Ring' : 'Inner Ring');
		}
		addIt(room, { kind:'iceInscription', lx:200, ly:900, w:90, h:50, text:'The wolf watches the moon.' });
		addIt(room, { kind:'iceInscription', lx:900, ly:820, w:90, h:50, text:'The moon rests above the mountain.' });
		addIt(room, { kind:'iceInscription', lx:1500, ly:900, w:90, h:50, text:'The mountain guards the heart.' });
	}
	function rotRing(it, room){
		const s = st(room);
		if(!s.ring || s.done) return true;
		const bag = RING_SYM[it._ring] || RING_SYM.inner;
		it._pos = ((it._pos || 0) + 1) % bag.length;
		const want = it._ring === 'outer' ? 0 : it._ring === 'middle' ? 0 : 0;
		const prev = (it._pos - 1 + bag.length) % bag.length;
		if(prev === want) s.ring.dirty = true;
		banner((it.name || 'Ring') + ' — ' + bag[it._pos]);
		shake(3, 6);
		const rings = ofKind(room, 'ring');
		const ok = rings.every(function(rg){
			if(rg._ring === 'outer') return (rg._pos || 0) === 0;
			if(rg._ring === 'middle') return (RING_SYM.middle[rg._pos || 0] === 'moon');
			if(rg._ring === 'inner') return (RING_SYM.inner[rg._pos || 0] === 'mountain');
			return rg.used;
		});
		if(ok && rings.length){
			if(!s.ring.dirty) unlockCaches(room, 'secret');
			finish(room, s.ring.dirty ? 'The heart accepts the pattern.' : 'A perfect alignment. The ice remembers.');
		}
		return true;
	}

	/* ---------- 8. Squall Shelter ---------- */
	function setupSquall(room){
		const s = st(room);
		if(s.squall) return;
		s.squall = { wind:0, windT:0 };
		addIt(room, { kind:'iceBarrier', lx:480, ly:680, w:70, h:120, face:0, name:'Ice Screen' });
		addIt(room, { kind:'iceBarrier', lx:1060, ly:680, w:70, h:120, face:1, name:'Ice Screen' });
		addIt(room, { kind:'iceBarrier', lx:1520, ly:680, w:70, h:120, face:0, name:'Ice Screen' });
		addIt(room, { kind:'iceShelter', lx:80, ly:760, w:180, h:40, start:true });
		addIt(room, { kind:'iceShelter', lx:1820, ly:760, w:180, h:40, exit:true });
	}
	function tickSquall(room){
		const s = st(room);
		if(!s.squall || s.done) return;
		s.squall.windT++;
		if(s.squall.windT % 320 === 0) s.squall.wind = (s.squall.wind + 1) & 1;
		const Ice = global.IceWorld && IceWorld.state;
		const storm = Ice && Ice.squall > 0.45;
		if(!storm) return;
		const bars = ofKind(room, 'iceBarrier');
		const wind = s.squall.wind;
		function covered(){
			const px = player.x + player.w/2;
			for(let i = 0; i < bars.length; i++){
				const b = bars[i];
				const lee = (b.face || 0) === wind;
				if(!lee) continue;
				if(Math.abs(px - (b.x + b.w/2)) < 90 && player.y + player.h > b.y - 10) return true;
			}
			const sh = ofKind(room, 'iceShelter');
			for(let i = 0; i < sh.length; i++){
				const z = sh[i];
				if(player.x + player.w > z.x && player.x < z.x + z.w && player.y + player.h > z.y - 20) return true;
			}
			return false;
		}
		if(!covered() && player.iFrames <= 0){
			player.vx += (wind === 0 ? 2.2 : -2.2);
			player._iceVx = (player._iceVx || 0) + (wind === 0 ? 1.4 : -1.4);
			if(typeof damagePlayer === 'function') damagePlayer(4, [{ type:'freeze', dmg:1, interval:30, ticks:2, color:'#9ad4ec' }]);
		}
		const exit = ofKind(room, 'iceShelter').filter(function(z){ return z.exit; })[0];
		if(exit && player.x + player.w > exit.x && player.x < exit.x + exit.w){
			const aligned = bars.filter(function(b){ return (b.face || 0) === 0; }).length >= 2;
			if(aligned) finish(room, 'The screens hold. The squall cannot reach you.');
		}
	}

	/* ---------- wiring ---------- */
	function onRoomEnter(room){
		if(!room || !iceTheme()) return;
		if(room.kind === 'traversal' && /Glide Hollow/i.test(room.label || '')) setupGlide(room);
		if(room.kind === 'mirror') setupMirror(room);
		if(room.kind === 'lake' || room.kind === 'frozenLake') setupWeight(room);
		if(room.kind === 'ascent' && /Hanging Fall/i.test(room.label || '')) setupFreeze(room);
		if(room.kind === 'shatterMaze') setupShatter(room);
		if(room.kind === 'secretMemory') setupMemory(room);
		if(room.kind === 'mechanism') setupRings(room);
		if(room.kind === 'blizzard') setupSquall(room);
		st(room).ready = true;
	}

	function tryInteract(it){
		if(!it || !iceTheme()) return false;
		const room = rooms()[it.roomId];
		if(!room) return false;
		onRoomEnter(room);
		if(it.kind === 'iceMirror'){
			it.ang = ((it.ang || 0) + 1) % 4;
			banner('The mirror turns.');
			shake(2, 4);
			return true;
		}
		if(it.kind === 'iceBarrier'){
			it.face = ((it.face || 0) + 1) % 2;
			banner(it.face === 0 ? 'The screen faces the west wind.' : 'The screen faces the east wind.');
			return true;
		}
		if(it.kind === 'iceInscription'){
			banner(it.text || 'Frosted letters.');
			return true;
		}
		if(it.kind === 'ring' && room.kind === 'mechanism') return rotRing(it, room);
		if(it.kind === 'iceBreak'){
			if(room.kind === 'shatterMaze'){ breakWall(it, room); return true; }
			it.used = true;
			banner(it.lore || 'The ice gives way.');
			shake(6, 10);
			return true;
		}
		if(it.kind === 'memoryNode') return useMemoryNode(it, room);
		if(it.kind === 'memory' && room.kind === 'secretMemory'){
			const s = st(room);
			if(s.mem && !s.done){ banner('Walk the frozen scene in the order it happened.'); return true; }
			return false;
		}
		return false;
	}
	function tryNearby(){
		if(!iceTheme()) return false;
		let best = null, bestD = 1e9;
		const px = player.x + player.w/2, py = player.y + player.h/2;
		for(let i = 0; i < interacts().length; i++){
			const it = interacts()[i];
			if(!it || it.used && !it.reusable) continue;
			if(!near(it, it.kind === 'iceBarrier' ? 110 : 96)) continue;
			if(!/iceMirror|iceBarrier|iceInscription|ring|iceBreak|memoryNode/.test(it.kind || '')) continue;
			const d = Math.abs(px - (it.x + it.w/2)) + Math.abs(py - (it.y + it.h/2));
			if(d < bestD){ bestD = d; best = it; }
		}
		return !!(best && tryInteract(best));
	}
	function prompt(){
		if(!iceTheme()) return null;
		for(let i = 0; i < interacts().length; i++){
			const it = interacts()[i];
			if(!it || (it.used && !it.reusable)) continue;
			if(!near(it, 100)) continue;
			if(it.kind === 'iceMirror') return 'E — Turn the ice mirror';
			if(it.kind === 'iceBarrier') return 'E — Turn the ice screen';
			if(it.kind === 'iceInscription') return 'E — Read the frost';
			if(it.kind === 'icePad' && it.stage === 0) return 'Slide from here — do not stop';
			if(it.kind === 'memoryNode') return 'E — Touch ' + (it.name || 'the memory');
			if(it.kind === 'ring') return 'E — Rotate the ' + (it.name || 'ring');
			if(it.kind === 'iceBreak') return 'E — Shatter the ice';
		}
		return null;
	}
	function objective(room){
		if(!room || !iceTheme()) return null;
		const s = st(room);
		if(!s.ready) return null;
		if(s.done) return null;
		if(s.glide) return 'SLIDE THE MARKED ICE — ' + s.glide.stage + ' / 4';
		if(s.beam) return 'TURN THE MIRRORS — FEED THE TRUE CRYSTAL';
		if(s.frame) return 'CLIMB WITH THE ICE — WAIT THE GLOW';
		if(s.shatter) return 'BREAK THE RIGHT WALLS';
		if(s.mem) return s.mem.play > 0 ? 'WATCH THE MEMORY' : 'TOUCH THE SCENE IN ORDER — ' + s.mem.step + ' / ' + (s.mem.len || 4);
		if(s.ring) return 'ALIGN WOLF, MOON, MOUNTAIN';
		if(s.squall) return 'TURN THE SCREENS — WALK THE LEE';
		if(s.weight) return 'READ THE ICE — THICK HOLDS, THIN LIES';
		return null;
	}
	function holdsClear(room){
		if(!room || !iceTheme()) return false;
		const s = st(room);
		if(!s || s.done) return false;
		if(room.kind === 'mirror') return true;
		return !!(s.glide || s.beam || s.frame || s.mem || s.ring || s.squall || s.shatter);
	}
	function update(){
		if(!iceTheme()) return;
		P.pulse++;
		const room = current();
		if(room) onRoomEnter(room);
		if(!room) return;
		if(room.kind === 'traversal') tickGlide(room);
		if(room.kind === 'mirror') tickBeam(room);
		if(room.kind === 'ascent') tickFreeze(room);
		if(room.kind === 'secretMemory') tickMemory(room);
		if(room.kind === 'blizzard') tickSquall(room);
		if(room.kind === 'lake' || room.kind === 'frozenLake') tickWeight(room);
	}
	function draw(ctx){
		if(!ctx || !iceTheme() || typeof camera === 'undefined') return;
		const c = cam();
		const room = current();
		if(!room) return;
		const s = st(room);
		if(s.weight){
			const list = plats();
			for(let i = 0; i < list.length; i++){
				const p = list[i];
				if(!p || p._gone || !p._iceState) continue;
				const col = p._iceState === 'thick' ? 'rgba(210,240,255,0.12)'
					: p._iceState === 'thin' ? 'rgba(120,190,230,0.18)'
					: p._iceState === 'veryThin' ? 'rgba(40,90,140,0.28)'
					: 'rgba(20,40,70,0.4)';
				ctx.fillStyle = col;
				ctx.fillRect(p.x - c.x, p.y - c.y, p.w, p.h || 16);
				if(p._secretHint){
					ctx.fillStyle = 'rgba(80,140,180,0.25)';
					ctx.fillRect(p.x - c.x + 8, p.y - c.y + 4, p.w - 16, 4);
				}
				if(p._peek > 0){
					ctx.globalAlpha = Math.min(0.55, p._peek / 80);
					ctx.fillStyle = 'rgba(40,90,140,0.7)';
					ctx.fillRect(p.x - c.x + 12, p.y - c.y + (p.h || 16) + 4, p.w - 24, 10);
					ctx.fillStyle = '#c8e8ff';
					ctx.fillRect(p.x - c.x + p.w * 0.4, p.y - c.y + (p.h || 16) + 6, 10, 6);
					ctx.globalAlpha = 1;
				}
			}
		}
		if(s.glide){
			const clues = s.glide.clue || [];
			ctx.strokeStyle = 'rgba(160,210,240,0.28)';
			ctx.lineWidth = 2;
			for(let i = 0; i < clues.length; i++){
				const g = clues[i];
				ctx.beginPath();
				ctx.moveTo(g.x - c.x, g.y - c.y);
				ctx.lineTo(g.x - c.x + g.vx * 10, g.y - c.y);
				ctx.stroke();
			}
			for(let i = 0; i < s.glide.grooves.length; i++){
				const g = s.glide.grooves[i];
				ctx.globalAlpha = Math.max(0.08, g.t / 140);
				ctx.strokeStyle = 'rgba(180,230,255,0.7)';
				ctx.beginPath();
				ctx.moveTo(g.x - c.x, g.y - c.y);
				ctx.lineTo(g.x - c.x - Math.sign(g.vx) * 22, g.y - c.y);
				ctx.stroke();
			}
			ctx.globalAlpha = 1;
			const pads = ofKind(room, 'icePad');
			for(let i = 0; i < pads.length; i++){
				const it = pads[i];
				ctx.fillStyle = it._lit ? 'rgba(180,255,255,0.35)' : 'rgba(80,160,210,0.22)';
				ctx.fillRect(it.x - c.x, it.y - c.y, it.w, it.h);
				ctx.strokeStyle = 'rgba(220,245,255,0.7)';
				ctx.strokeRect(it.x - c.x, it.y - c.y, it.w, it.h);
			}
			const arrows = ofKind(room, 'iceArrow');
			ctx.fillStyle = 'rgba(200,240,255,0.55)';
			for(let i = 0; i < arrows.length; i++){
				const a = arrows[i];
				const x = a.x - c.x, y = a.y - c.y;
				ctx.beginPath();
				ctx.moveTo(x, y);
				ctx.lineTo(x + a.w, y + a.h/2);
				ctx.lineTo(x, y + a.h);
				ctx.closePath();
				ctx.fill();
			}
			const marks = ofKind(room, 'iceWallMark');
			ctx.fillStyle = 'rgba(70,120,160,0.45)';
			for(let i = 0; i < marks.length; i++){
				const m = marks[i];
				ctx.fillRect(m.x - c.x, m.y - c.y, m.w, m.h);
				ctx.strokeStyle = 'rgba(180,230,255,0.5)';
				ctx.strokeRect(m.x - c.x, m.y - c.y, m.w, m.h);
			}
		}
		if(s.frame){
			const list = plats();
			for(let i = 0; i < list.length; i++){
				const p = list[i];
				if(!p || !p._cycle || p._gone) continue;
				const col = p._glow === 'blue' ? 'rgba(80,160,230,0.35)'
					: p._glow === 'white' ? 'rgba(230,245,255,0.4)'
					: p._glow === 'crack' ? 'rgba(40,80,120,0.45)' : 'rgba(0,0,0,0)';
				ctx.fillStyle = col;
				ctx.fillRect(p.x - c.x, p.y - c.y - 4, p.w, 8);
			}
		}
		if(s.beam && s.beam.segs){
			ctx.save();
			ctx.strokeStyle = 'rgba(160,230,255,0.85)';
			ctx.lineWidth = 3;
			ctx.shadowColor = '#9ad4ec';
			ctx.shadowBlur = 12;
			for(let i = 0; i < s.beam.segs.length; i++){
				const g = s.beam.segs[i];
				ctx.beginPath();
				ctx.moveTo(g.x1 - c.x, g.y1 - c.y);
				ctx.lineTo(g.x2 - c.x, g.y2 - c.y);
				ctx.stroke();
			}
			ctx.restore();
			const recs = ofKind(room, 'iceReceiver');
			for(let i = 0; i < recs.length; i++){
				const it = recs[i];
				ctx.fillStyle = it._lit ? (it.real ? 'rgba(200,255,255,0.9)' : 'rgba(120,160,200,0.45)') : 'rgba(40,80,120,0.7)';
				ctx.fillRect(it.x - c.x, it.y - c.y, it.w, it.h);
				if(it.real){
					ctx.strokeStyle = '#e8fbff';
					ctx.strokeRect(it.x - c.x, it.y - c.y, it.w, it.h);
				}
			}
			const ms = ofKind(room, 'iceMirror');
			for(let i = 0; i < ms.length; i++){
				const it = ms[i];
				const mx = it.x - c.x + it.w/2, my = it.y - c.y + it.h/2;
				const a = it.ang || 0;
				ctx.save();
				ctx.strokeStyle = it._glow ? 'rgba(230,255,255,0.98)' : 'rgba(190,230,250,0.9)';
				ctx.lineWidth = 5;
				ctx.beginPath();
				if(a === 0){ ctx.moveTo(mx - 18, my + 28); ctx.lineTo(mx + 18, my - 28); }
				else if(a === 1){ ctx.moveTo(mx - 18, my - 28); ctx.lineTo(mx + 18, my + 28); }
				else if(a === 2){ ctx.moveTo(mx, my - 32); ctx.lineTo(mx, my + 32); }
				else { ctx.moveTo(mx - 22, my); ctx.lineTo(mx + 22, my); }
				ctx.stroke();
				ctx.restore();
			}
		}
		if(s.mem && s.mem.fog > 0){
			ctx.fillStyle = 'rgba(200,230,255,' + (s.mem.fog / 90) + ')';
			ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
		}
		if(s.mem && s.mem.play > 0){
			const t = 90 - s.mem.play;
			const names = MEM_SEQ.slice(0, s.mem.len || MEM_SEQ.length);
			const i = Math.min(names.length - 1, (t / 18) | 0);
			ctx.fillStyle = '#e8fbff';
			ctx.font = '14px monospace';
			ctx.textAlign = 'center';
			ctx.fillText(names[i].name, ctx.canvas.width / 2, 80);
		}
		if(s.squall){
			const wind = s.squall.wind;
			ctx.fillStyle = 'rgba(200,230,255,0.35)';
			for(let i = 0; i < 18; i++){
				const x = ((P.pulse * (wind ? -3 : 3) + i * 90) % (ctx.canvas.width + 40));
				ctx.fillRect(wind ? ctx.canvas.width - x : x, (i * 37 + P.pulse) % ctx.canvas.height, 18, 2);
			}
			const bars = ofKind(room, 'iceBarrier');
			for(let i = 0; i < bars.length; i++){
				const it = bars[i];
				ctx.fillStyle = 'rgba(160,210,235,0.8)';
				ctx.fillRect(it.x - c.x, it.y - c.y, it.w, it.h);
				ctx.fillStyle = '#e8fbff';
				ctx.fillRect(it.face ? it.x - c.x + it.w - 8 : it.x - c.x, it.y - c.y + 10, 8, it.h - 20);
			}
		}
		const rings = ofKind(room, 'ring');
		if(s.ring){
			const aligned = [];
			for(let i = 0; i < rings.length; i++){
				const it = rings[i];
				const bag = RING_SYM[it._ring] || [];
				const ok = it._ring === 'outer' ? (it._pos || 0) === 0
					: it._ring === 'middle' ? RING_SYM.middle[it._pos || 0] === 'moon'
					: RING_SYM.inner[it._pos || 0] === 'mountain';
				ctx.fillStyle = ok ? '#9ad4ec' : '#e8fbff';
				ctx.font = '11px monospace';
				ctx.textAlign = 'center';
				ctx.fillText(bag[it._pos || 0] || '', it.x - c.x + it.w/2, it.y - c.y - 8);
				if(ok) aligned.push(it);
			}
			if(aligned.length >= 2){
				ctx.save();
				ctx.strokeStyle = 'rgba(160,230,255,0.7)';
				ctx.lineWidth = 2;
				ctx.shadowColor = '#9ad4ec';
				ctx.shadowBlur = 10;
				ctx.beginPath();
				ctx.moveTo(aligned[0].x - c.x + aligned[0].w/2, aligned[0].y - c.y + aligned[0].h/2);
				for(let i = 1; i < aligned.length; i++){
					ctx.lineTo(aligned[i].x - c.x + aligned[i].w/2, aligned[i].y - c.y + aligned[i].h/2);
				}
				ctx.stroke();
				ctx.restore();
			}
		}
	}

	global.IcePuzzles = {
		onRoomEnter:onRoomEnter,
		tryInteract:tryInteract,
		tryNearby:tryNearby,
		prompt:prompt,
		objective:objective,
		holdsClear:holdsClear,
		update:update,
		draw:draw,
	};
})(typeof window !== 'undefined' ? window : globalThis);
