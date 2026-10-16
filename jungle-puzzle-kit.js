/* =============================================================
   Living Wilds — reusable jungle mini-game archetypes.
   Boards never print the solution. Start, fail, and clear are obvious.
   ============================================================= */
(function(global){
	'use strict';

	const N = 1, E = 2, S = 4, W = 8;
	const DIRS = [{b:N,x:0,y:-1},{b:E,x:1,y:0},{b:S,x:0,y:1},{b:W,x:-1,y:0}];
	const CAPS = [
		{name:'Amber Cap', color:'#e8c45a', rgb:{r:232,g:196,b:90}, spore:'gold'},
		{name:'Verdant Cap', color:'#86e67b', rgb:{r:134,g:230,b:123}, spore:'lime'},
		{name:'Azure Cap', color:'#7bdbe6', rgb:{r:123,g:219,b:230}, spore:'cyan'},
		{name:'Violet Cap', color:'#c084ed', rgb:{r:192,g:132,b:237}, spore:'violet'},
		{name:'Ember Cap', color:'#ef7b73', rgb:{r:239,g:123,b:115}, spore:'ember'},
		{name:'Ivory Cap', color:'#f4f0c8', rgb:{r:244,g:240,b:200}, spore:'white'}
	];
	const FLOWER_HUES = ['#ef7b73','#e8d75a','#71d6ef','#c084ed','#86e67b','#f0a868'];

	const P = {
		overlay:null,
		down:false,
		escLatch:false,
		fx:[],
		pulse:0
	};

	function dung(){ return (typeof dungeon !== 'undefined' && dungeon) || global.dungeon; }
	function env(){ return global.DungeonEnv; }
	function rooms(){ return (dung() && dung().rooms) || []; }
	function interacts(){ return (dung() && dung().interactables) || []; }
	function hazards(){ return (dung() && dung().hazards) || []; }
	function plats(){ return (dung() && dung().platforms) || []; }
	function current(){ return env() && env().currentRoom; }
	function cam(){ return global.camera || {x:0,y:0}; }
	function cvs(){ return global.canvas || {width:1920,height:1080}; }
	function banner(t){ if(env() && env().showBanner) env().showBanner(t); }
	function shake(a,b){ if(typeof shakeScreen === 'function') shakeScreen(a, b); }
	function parts(x,y,c,n){ if(typeof particlesAt === 'function') particlesAt(x,y,c,n||10); }
	function keysOf(){ return (typeof keys !== 'undefined' && keys) || {}; }

	function rng(seed){
		let s = (seed & 0x7fffffff) || 1;
		return function(){ s = (s * 1664525 + 1013904223) & 0x7fffffff; return s / 0x7fffffff; };
	}
	function rotMask(m, k){
		k = ((k % 4) + 4) % 4;
		let o = m & 15;
		for(let i = 0; i < k; i++) o = ((o << 1) | (o >> 3)) & 15;
		return o;
	}
	function miniOf(r){ return r && r.puzzle && r.puzzle.mini; }
	function st(r){
		if(!r) return null;
		if(!r._pz) r._pz = { ready:false, stage:'idle', t:0, overlay:false };
		return r._pz;
	}
	function nodes(r, group, kinds){
		const kindsMap = {};
		(kinds || []).forEach(function(k){ kindsMap[k] = 1; });
		return interacts().filter(function(it){
			if(!it || it.roomId !== r.id) return false;
			if(group && it.group && it.group !== group) return false;
			if(kinds && kinds.length && !kindsMap[it.kind]) return false;
			return !group || !it.group || it.group === group || kindsMap[it.kind];
		}).sort(function(a,b){ return (a.idx||0) - (b.idx||0); });
	}
	function pointer(){
		const mx = (typeof mouseScreenX === 'number') ? mouseScreenX : 0;
		const my = (typeof mouseScreenY === 'number') ? mouseScreenY : 0;
		const c = cam();
		return { sx:mx, sy:my, wx:mx + c.x, wy:my + c.y };
	}
	function clickEdge(){
		const down = !!(typeof mouseDown !== 'undefined' && mouseDown);
		const edge = down && !P.down;
		P.down = down;
		return edge;
	}
	function triggerFailHaz(r){
		const g = r.puzzle && r.puzzle.failHazard;
		if(!g) return;
		hazards().forEach(function(h){
			if(h.group === g){ h._manual = Math.max(h._manual || 0, 110); h.armed = true; }
		});
	}
	function failSpawn(r, n){
		n = n == null ? 2 : n;
		if(env() && env().spawnWave) env().spawnWave(r, n);
		else if(global.DungeonEnv && DungeonEnv.spawnWave) DungeonEnv.spawnWave(r, n);
	}
	function unlockCaches(r, tag){
		interacts().forEach(function(it){
			if(it.roomId !== r.id) return;
			if(tag && it._lockTag === tag){ it._locked = false; it.locked = false; }
			if(!tag && (it._mainCache || it.kind === 'jungleCache' || it.kind === 'jungleVault' || it.kind === 'cache')){
				if(it.lockedByCombat) return;
				it._locked = false; it.locked = false;
			}
		});
	}
	function complete(r, msg, opts){
		opts = opts || {};
		if(!r || r._jungleSolved) return;
		r._jungleSolved = true;
		r._pzComplete = true;
		if(r.puzzle && r.puzzle.growthId && global.JungleWorld && JungleWorld.activateGrowth){
			JungleWorld.activateGrowth(r.puzzle.growthId, r.id);
		}
		unlockCaches(r, opts.tag);
		if(r.puzzle && r.puzzle.mastery && opts.mastery){
			unlockCaches(r, 'sunlit');
			interacts().forEach(function(it){
				if(it.roomId === r.id && it._sunlit){ it._locked = false; it.locked = false; }
			});
			banner('SUNLIT CACHE — the beam took the shortest path.');
		}
		shake(8, 16);
		parts((r.x + r.w / 2), (r.y + r.h * 0.62), {r:150,g:240,b:140}, 28);
		banner(msg || 'The living mechanism yields — a new path opens.');
		if(r.clearMode === 'puzzle' && global.JungleWorld && JungleWorld.roomClear) JungleWorld.roomClear(r);
		closeOverlay(false);
	}
	function addFx(x, y, life, kind, extra){
		P.fx.push(Object.assign({x:x,y:y,life:life,max:life,kind:kind||'burst'}, extra || {}));
	}

	function closeOverlay(announce){
		if(P.overlay && announce) banner('You step back from the mechanism.');
		P.overlay = null;
		const r = current();
		if(r && r._pz) r._pz.overlay = false;
	}
	function openOverlay(type, r, title, hint){
		P.overlay = { type:type, roomId:r.id, title:title, hint:hint };
		r._pz.overlay = true;
		banner(title + ' — ' + hint);
	}

	function cameraFocus(){
		const r = current();
		if(!r || !miniOf(r) || r.cleared) return null;
		const s = st(r);
		if(!s || s.stage === 'idle') return null;
		if(miniOf(r) === 'rootRhythm'){
			if(s.stage === 'demo' && s.flash >= 0){
				const it = rhythmNodes(r)[s.flash];
				if(it) return {x:it.x + (it.w||80)/2, y:it.y + (it.h||80)/2};
			}
			return null;
		}
		if(s.focusX != null) return {x:s.focusX, y:s.focusY};
		return {x:r.x + r.w / 2, y:r.y + r.h * 0.55};
	}

	/* ---------- ROOT RHYTHM ---------- */
	function rhythmNodes(r){
		const group = (r.puzzle && r.puzzle.group) || null;
		let list = nodes(r, group, ['mushroomNode','growthNode','sporeFlower']);
		if(!list.length) list = interacts().filter(function(it){ return it.roomId === r.id && /mushroom|growth|spore/i.test(it.kind||''); });
		return list;
	}
	function rhythmEnsure(r){
		const s = st(r);
		if(s.seq) return;
		const n = rhythmNodes(r);
		const rnd = rng((r.id + 17) * 911);
		s.caps = n.length;
		s.round = 0;
		s.seq = [];
		s.input = [];
		s.stage = 'idle';
		s.listen = false;
		s.demoI = 0;
		s.demoT = 0;
		s.flash = -1;
		s.darkT = 0;
		s.wrongT = 0;
		s.rounds = (r.puzzle && r.puzzle.rounds) || [3,4,5];
		s.pool = n.map(function(_, i){ return i; });
		if(!s.pool.length) s.pool = [0,1,2];
		s.seedPick = rnd;
	}
	function rhythmStart(r){
		const s = st(r);
		rhythmEnsure(r);
		if(s.stage === 'play' || s.stage === 'demo') return;
		s.stage = 'demo';
		s.round = 0;
		s.seq = [];
		rhythmNextRound(r);
		const n = rhythmNodes(r);
		if(n.length){
			s.focusX = n.reduce(function(a,it){ return a + it.x + (it.w||80)/2; },0) / n.length;
			s.focusY = n.reduce(function(a,it){ return a + it.y + (it.h||80)/2; },0) / n.length;
		}
		banner('The caps begin to sing. Watch, then answer.');
	}
	function rhythmNextRound(r){
		const s = st(r);
		const n = rhythmNodes(r);
		const len = Math.min(s.rounds[s.round] || (s.round + 3), 7);
		const poolN = Math.max(3, n.length);
		while(s.seq.length < len){
			s.seq.push(Math.floor(s.seedPick() * poolN) % poolN);
		}
		s.input = [];
		s.stage = 'demo';
		s.demoI = 0;
		s.demoT = 36;
		s.listen = false;
		s.flash = -1;
	}
	function pulseCap(r, idx, strong){
		const n = rhythmNodes(r);
		const it = n[idx];
		if(!it) return;
		const cap = CAPS[idx % CAPS.length];
		it._pulse = strong ? 48 : 22;
		it._capColor = cap.color;
		parts(it.x + (it.w||80)/2, it.y + (it.h||70)/2, cap.rgb, strong ? 16 : 10);
		addFx(it.x + (it.w||80)/2, it.y + 10, 22, 'spore', {color:cap.color, r:strong?70:46});
		const s = st(r);
		s.flash = idx;
		s.flashT = 28;
	}
	function rhythmWrong(r){
		const s = st(r);
		s.wrongT = 40;
		s.darkT = 36;
		s.listen = false;
		s.stage = 'fail';
		s.input = [];
		triggerFailHaz(r);
		failSpawn(r, 2);
		shake(7, 12);
		banner('The chorus breaks. Poison bursts — the rhythm starts over.');
		rhythmNodes(r).forEach(function(it){ it._pulse = 0; it.used = false; });
	}
	function rhythmTick(r){
		const s = st(r);
		if(!s.seq) return;
		if(s.flashT > 0){ s.flashT--; if(s.flashT <= 0) s.flash = -1; }
		if(s.darkT > 0) s.darkT--;
		if(s.wrongT > 0) s.wrongT--;
		rhythmNodes(r).forEach(function(it){ if(it._pulse > 0) it._pulse--; });
		if(s.stage === 'fail'){
			if(s.wrongT <= 0){ s.round = 0; s.seq = []; rhythmNextRound(r); }
			return;
		}
		if(s.stage === 'demo'){
			s.demoT--;
			if(s.demoT <= 0){
				if(s.demoI >= s.seq.length){
					s.stage = 'play';
					s.listen = true;
					s.touchIdx = -1;
					banner('Your turn — stand on the caps in the same living order.');
				} else {
					pulseCap(r, s.seq[s.demoI], true);
					s.demoI++;
					s.demoT = 42;
				}
			}
			return;
		}
		if(s.stage === 'play' && s.listen && typeof player !== 'undefined' && player){
			const n = rhythmNodes(r);
			const px = player.x + player.w / 2, py = player.y + player.h / 2;
			let on = -1;
			for(let i = 0; i < n.length; i++){
				const it = n[i];
				const cx = it.x + (it.w || 80) / 2, cy = it.y + (it.h || 80) / 2;
				if(Math.abs(px - cx) < 78 && Math.abs(py - cy) < 96){ on = i; break; }
			}
			if(on < 0) s.touchIdx = -1;
			else if(s.touchIdx !== on){
				s.touchIdx = on;
				rhythmHit(r, n[on]);
			}
		}
	}
	function rhythmHit(r, it){
		const s = st(r);
		rhythmEnsure(r);
		if(s.stage === 'idle'){ rhythmStart(r); return true; }
		if(s.stage !== 'play' || !s.listen) return true;
		const n = rhythmNodes(r);
		const idx = n.indexOf(it);
		if(idx < 0) return true;
		pulseCap(r, idx, false);
		const need = s.seq[s.input.length];
		if(idx !== need){ rhythmWrong(r); return true; }
		s.input.push(idx);
		if(s.input.length >= s.seq.length){
			s.round++;
			if(s.round >= s.rounds.length){
				n.forEach(function(node){ node.used = true; node._bloom = true; });
				complete(r, 'Every cap blooms at once — the roots open a way forward.');
			} else {
				banner('The grove answers. The song grows longer.');
				rhythmNextRound(r);
			}
		}
		return true;
	}

	/* ---------- SLUICE FLOW ---------- */
	function diffRank(){
		const d = (typeof DIFFICULTY === 'string') ? DIFFICULTY : 'normal';
		if(d === 'easy') return 0;
		if(d === 'hard') return 2;
		if(d === 'nightmare') return 3;
		return 1;
	}
	function makeSluice(seed){
		const rank = diffRank();
		const sizes = [
			{cols:5, rows:3, extras:2, block:0.10, junk:0.22, oneway:0.04, detour:0.62, spins:6, branches:0},
			{cols:6, rows:4, extras:4, block:0.20, junk:0.16, oneway:0.12, detour:0.50, spins:8, branches:1},
			{cols:7, rows:5, extras:7, block:0.26, junk:0.12, oneway:0.22, detour:0.36, spins:11, branches:3},
			{cols:8, rows:6, extras:11, block:0.30, junk:0.08, oneway:0.32, detour:0.24, spins:14, branches:5}
		];
		const cfg = sizes[rank] || sizes[1];
		const cols = cfg.cols, rows = cfg.rows;
		const rnd = rng(seed * 7919 + 13 + rank * 97);
		const cells = [];
		for(let y = 0; y < rows; y++){
			for(let x = 0; x < cols; x++){
				cells.push({x:x,y:y,base:0,rot:0,kind:'empty',locked:false,oneway:false,flow:0});
			}
		}
		function at(x,y){ if(x<0||y<0||x>=cols||y>=rows) return null; return cells[y*cols+x]; }
		const sy = Math.max(0, Math.min(rows - 1, 1 + Math.floor(rnd() * Math.max(1, rows - 2))));
		let ty = Math.max(0, Math.min(rows - 1, Math.floor(rnd() * rows)));
		if(rows > 2 && ty === sy) ty = (sy + 1 + Math.floor(rnd() * (rows - 1))) % rows;
		const tx = cols - 1;
		const src = at(0, sy); src.kind = 'source'; src.base = E; src.locked = true;
		const basin = at(tx, ty); basin.kind = 'basin'; basin.base = W; basin.locked = true;
		const path = [{x:0,y:sy}];
		let x = 0, y = sy, guard = 0;
		while((x !== tx || y !== ty) && guard++ < cols * rows * 4){
			const opts = [];
			if(x < tx) opts.push([1,0]);
			if(y < ty) opts.push([0,1]);
			if(y > ty) opts.push([0,-1]);
			if(x < cols - 2 && rnd() > cfg.detour) opts.push([1,0]);
			if(y > 0 && rnd() > 0.70) opts.push([0,-1]);
			if(y < rows - 1 && rnd() > 0.70) opts.push([0,1]);
			if(rank >= 2 && x > 0 && rnd() > 0.80) opts.push([-1,0]);
			const step = opts[Math.floor(rnd() * opts.length)] || [1,0];
			const nx = Math.max(0, Math.min(cols-1, x + step[0]));
			const ny = Math.max(0, Math.min(rows-1, y + step[1]));
			if(nx === x && ny === y) continue;
			x = nx; y = ny;
			path.push({x:x,y:y});
		}
		while(x < tx){ x++; path.push({x:x,y:y}); }
		while(y < ty){ y++; path.push({x:x,y:y}); }
		while(y > ty){ y--; path.push({x:x,y:y}); }
		function join(a,b){
			if(!a || !b) return;
			if(b.x === a.x + 1){ a.base |= E; b.base |= W; }
			if(b.x === a.x - 1){ a.base |= W; b.base |= E; }
			if(b.y === a.y + 1){ a.base |= S; b.base |= N; }
			if(b.y === a.y - 1){ a.base |= N; b.base |= S; }
		}
		for(let i = 0; i < path.length - 1; i++) join(at(path[i].x,path[i].y), at(path[i+1].x,path[i+1].y));
		let branches = cfg.branches;
		while(branches--){
			if(path.length < 3) break;
			const p = path[1 + Math.floor(rnd() * (path.length - 2))];
			const c = at(p.x, p.y);
			if(!c || c.kind !== 'empty') continue;
			const dir = DIRS[Math.floor(rnd() * 4)];
			const n = at(c.x + dir.x, c.y + dir.y);
			if(!n || n.kind === 'source' || n.kind === 'basin') continue;
			c.base |= dir.b;
			n.base |= rotMask(dir.b, 2);
		}
		let extras = cfg.extras + Math.floor(rnd() * (1 + rank));
		while(extras--){
			const cx = 1 + Math.floor(rnd() * (cols-2));
			const cy = Math.floor(rnd() * rows);
			const c = at(cx, cy);
			if(!c || c.kind !== 'empty') continue;
			const dir = DIRS[Math.floor(rnd()*4)];
			const n = at(cx+dir.x, cy+dir.y);
			if(!n || n.kind === 'source' || n.kind === 'basin') continue;
			c.base |= dir.b;
			n.base |= rotMask(dir.b, 2);
		}
		const junkKinds = rank >= 2
			? [N|S, E|W, N|E, E|S, S|W, W|N, N|E|S, E|S|W, N|W|S, N|E|S|W]
			: [N|S, E|W, N|E, E|S, S|W, W|N, N|E|S, E|S|W];
		for(let i = 0; i < cells.length; i++){
			const c = cells[i];
			if(c.kind === 'source' || c.kind === 'basin') continue;
			if(!c.base){
				if(rnd() < cfg.block){ c.kind = 'blocked'; c.locked = true; }
				else if(rnd() < cfg.junk){ c.kind = 'empty'; }
				else {
					c.base = junkKinds[Math.floor(rnd()*junkKinds.length)];
					c.kind = 'pipe';
					if(rnd() < cfg.oneway) c.oneway = true;
				}
			} else {
				c.kind = 'pipe';
				if((c.base === (N|S) || c.base === (E|W)) && rnd() < cfg.oneway + 0.04) c.oneway = true;
			}
			if(!c.locked) c.rot = Math.floor(rnd() * 4);
		}
		src.rot = 0; basin.rot = 0;
		let spins = 0;
		while(sluiceSolved(cells, cols, rows) && spins < cfg.spins){
			cells.forEach(function(c){ if(!c.locked && c.kind === 'pipe') c.rot = (c.rot + 1 + Math.floor(rnd()*3)) % 4; });
			spins++;
		}
		return {cols:cols, rows:rows, cells:cells, bloom:0, rank:rank};
	}
	function cellMask(c){ return rotMask(c.base || 0, c.rot || 0); }
	function sluiceFlow(board){
		const cols = board.cols, rows = board.rows, cells = board.cells;
		cells.forEach(function(c){ c.flow = 0; });
		function at(x,y){ if(x<0||y<0||x>=cols||y>=rows) return null; return cells[y*cols+x]; }
		const src = cells.filter(function(c){ return c.kind === 'source'; })[0];
		if(!src) return false;
		const q = [src];
		src.flow = 1;
		let reached = false;
		while(q.length){
			const c = q.shift();
			const m = cellMask(c);
			for(let i = 0; i < 4; i++){
				const d = DIRS[i];
				if(!(m & d.b)) continue;
				if(c.oneway && d.b !== (m & (N|E) ? (m & N ? N : E) : (m & S ? S : W))){
					if(!((d.b === N && (m & S) && !(m & E) && !(m & W)) ||
						(d.b === E && (m & W) && !(m & N) && !(m & S)) ||
						(d.b === S && (m & N) && !(m & E) && !(m & W)) ||
						(d.b === W && (m & E) && !(m & N) && !(m & S)))) {
						/* allow T/corner one-way along the first open bit */
					}
				}
				const n = at(c.x + d.x, c.y + d.y);
				if(!n || n.kind === 'blocked' || n.kind === 'empty') continue;
				const nm = cellMask(n);
				const need = rotMask(d.b, 2);
				if(!(nm & need)) continue;
				if(c.oneway && !(m & d.b)) continue;
				if(n.oneway && !(nm & need)) continue;
				if(!n.flow){ n.flow = 1; q.push(n); }
				if(n.kind === 'basin') reached = true;
			}
		}
		board.reached = reached;
		return reached;
	}
	function sluiceSolved(cells, cols, rows){
		return sluiceFlow({cols:cols, rows:rows, cells:cells});
	}
	function sluiceWheels(r){
		return nodes(r, r.puzzle && r.puzzle.group, ['waterWheel']);
	}
	function sluiceNeedsSides(r){
		if(!r || !r.puzzle) return false;
		if(r.puzzle.sides) return true;
		return sluiceWheels(r).length >= 2 && r.kind === 'streamPuzzle';
	}
	function sluiceKey(r, it){
		if(sluiceNeedsSides(r) && it && it.idx != null) return 's' + it.idx;
		return 'main';
	}
	function sluiceOpen(r, it){
		const s = st(r);
		if(!s.boards) s.boards = {};
		const key = sluiceKey(r, it);
		if(!s.boards[key]) s.boards[key] = makeSluice((r.id + 3) * 17 + ((it && it.idx) || 0) * 91);
		s.activeKey = key;
		s.activeIt = it || null;
		s.board = s.boards[key];
		s.stage = 'play';
		if(it){ s.focusX = it.x + (it.w||80)/2; s.focusY = it.y + (it.h||80)/2; }
		else { s.focusX = r.x + r.w / 2; s.focusY = r.y + r.h * 0.5; }
		const both = sluiceNeedsSides(r);
		const title = (it && it.name) || 'Sluice Flow';
		const hint = both
			? 'Rotate this table until water reaches the basin. Both sluices must flow.'
			: 'Rotate channels until water runs from source to basin.';
		openOverlay('sluiceFlow', r, title, hint);
	}
	function sluiceMarkDone(r, board){
		if(!board || board._done) return false;
		board._done = true;
		board.bloom = 1;
		const s = st(r);
		const it = s.activeIt;
		if(it){
			it.solved = true;
			if(it.states) it.state = it.states - 1;
		}
		if(sluiceNeedsSides(r)){
			const wheels = sluiceWheels(r);
			const left = wheels.filter(function(w){ return !w.solved; });
			if(left.length){
				const who = (it && it.name) || 'This sluice';
				banner(who + ' holds. The other sluice still waits.');
				closeOverlay(false);
				return true;
			}
		}
		if(r.puzzle && r.puzzle.nextMini){
			banner('Water finds the basin. The root grid stirs.');
			closeOverlay(false);
			st(r).stage = 'next';
			r.puzzle.mini = r.puzzle.nextMini;
			gridEnsure(r);
			gridOpen(r);
			return true;
		}
		complete(r, sluiceNeedsSides(r)
			? 'Both channels reach their basins — the stream knits a path across.'
			: 'Water reaches the basin — roots swell and a path grows.');
		return true;
	}
	function sluiceClick(r, mx, my, box){
		const board = st(r).board;
		if(!board || board._done) return;
		const cw = box.w / board.cols, ch = box.h / board.rows;
		const cx = Math.floor((mx - box.x) / cw);
		const cy = Math.floor((my - box.y) / ch);
		if(cx < 0 || cy < 0 || cx >= board.cols || cy >= board.rows) return;
		const c = board.cells[cy * board.cols + cx];
		if(!c || c.locked || c.kind === 'empty' || c.kind === 'blocked' || c.kind === 'source' || c.kind === 'basin') return;
		c.rot = ((c.rot || 0) + 1) % 4;
		sluiceFlow(board);
		if(board.reached) sluiceMarkDone(r, board);
	}

	/* ---------- ROOT PRESSURE GRID ---------- */
	function gridEnsure(r){
		const s = st(r);
		if(s.grid) return;
		const rnd = rng(r.id * 131 + 9);
		const n = 3;
		const on = [];
		for(let i = 0; i < n*n; i++) on.push(0);
		function tog(i){
			const x = i % n, y = (i / n) | 0;
			[[0,0],[1,0],[-1,0],[0,1],[0,-1]].forEach(function(d){
				const xx = x + d[0], yy = y + d[1];
				if(xx>=0&&yy>=0&&xx<n&&yy<n) on[yy*n+xx] ^= 1;
			});
		}
		const clicks = 5 + Math.floor(rnd() * 3);
		for(let k = 0; k < clicks; k++) tog(Math.floor(rnd() * n * n));
		if(on.every(function(v){ return v; })) tog(4);
		s.grid = { n:n, on:on, moves:0, attack:false };
	}
	function gridOpen(r){
		gridEnsure(r);
		st(r).stage = 'play';
		st(r).focusX = r.x + r.w / 2; st(r).focusY = r.y + r.h * 0.52;
		openOverlay('rootGrid', r, 'Root Pressure', 'Press a node to stir it and its neighbors. Wake the whole network.');
	}
	function gridClick(r, mx, my, box){
		const g = st(r).grid;
		if(!g) return;
		const n = g.n, cw = box.w / n, ch = box.h / n;
		const cx = Math.floor((mx - box.x) / cw);
		const cy = Math.floor((my - box.y) / ch);
		if(cx<0||cy<0||cx>=n||cy>=n) return;
		const i = cy * n + cx;
		[[0,0],[1,0],[-1,0],[0,1],[0,-1]].forEach(function(d){
			const xx = cx + d[0], yy = cy + d[1];
			if(xx>=0&&yy>=0&&xx<n&&yy<n) g.on[yy*n+xx] ^= 1;
		});
		g.moves++;
		if(g.moves === 3 && !g.attack && r.puzzle && r.puzzle.combat){
			g.attack = true;
			failSpawn(r, 2);
			banner('The roots notice you — keep working while they strike.');
		}
		if(g.on.every(function(v){ return v; })){
			complete(r, 'Every root node wakes — sap floods the lattice and the way opens.');
		}
	}

	/* ---------- SUN MIRROR ---------- */
	function sunRotFor(inB, outB){
		if((inB === E && outB === N) || (inB === N && outB === E) || (inB === W && outB === S) || (inB === S && outB === W)) return 0;
		if((inB === E && outB === S) || (inB === S && outB === E) || (inB === W && outB === N) || (inB === N && outB === W)) return 1;
		return 0;
	}
	function sunBit(dx, dy){
		if(dx === 1) return E;
		if(dx === -1) return W;
		if(dy === 1) return S;
		return N;
	}
	function makeSun(seed){
		const rank = diffRank();
		const cols = 7, rows = 4;
		const rnd = rng(seed * 4243 + 5 + rank * 17);
		const cells = [];
		for(let y = 0; y < rows; y++) for(let x = 0; x < cols; x++) cells.push({x:x,y:y,kind:'empty',rot:0,locked:false,hit:0});
		function at(x,y){ if(x<0||y<0||x>=cols||y>=rows) return null; return cells[y*cols+x]; }
		const sy = 1, ty = 2, tx = cols - 1;
		at(0, sy).kind = 'sun'; at(0, sy).locked = true;
		at(tx, ty).kind = 'crystal'; at(tx, ty).locked = true;
		const routes = [
			[{x:2,y:sy},{x:2,y:ty},{x:tx,y:ty}],
			[{x:1,y:sy},{x:1,y:3},{x:4,y:3},{x:4,y:ty},{x:tx,y:ty}],
			[{x:1,y:sy},{x:1,y:0},{x:3,y:0},{x:3,y:ty},{x:5,y:ty},{x:tx,y:ty}],
			[{x:1,y:sy},{x:1,y:0},{x:4,y:0},{x:4,y:3},{x:5,y:3},{x:5,y:ty},{x:tx,y:ty}]
		];
		const wps = routes[Math.min(rank, routes.length - 1)];
		const path = [{x:0,y:sy}];
		let px = 0, py = sy;
		wps.forEach(function(p){
			while(px !== p.x){ px += p.x > px ? 1 : -1; path.push({x:px,y:py}); }
			while(py !== p.y){ py += p.y > py ? 1 : -1; path.push({x:px,y:py}); }
		});
		const onPath = {};
		path.forEach(function(p){ onPath[p.x + ',' + p.y] = 1; });
		let turns = 0;
		for(let i = 1; i < path.length - 1; i++){
			const a = path[i - 1], c = path[i], b = path[i + 1];
			const inB = sunBit(c.x - a.x, c.y - a.y);
			const outB = sunBit(b.x - c.x, b.y - c.y);
			if(inB === outB) continue;
			const cell = at(c.x, c.y);
			if(!cell || cell.kind !== 'empty') continue;
			cell.kind = 'mirror';
			cell.rot = sunRotFor(inB, outB);
			cell._need = cell.rot;
			turns++;
		}
		let extras = 1 + rank;
		let guard = 40;
		while(extras > 0 && guard-- > 0){
			const x = 1 + Math.floor(rnd() * (cols - 2));
			const y = Math.floor(rnd() * rows);
			const cell = at(x, y);
			if(!cell || cell.kind !== 'empty' || onPath[x + ',' + y]) continue;
			cell.kind = 'mirror';
			cell.rot = Math.floor(rnd() * 2);
			cell.optional = true;
			extras--;
		}
		let walls = 1 + (rank >= 2 ? 1 : 0);
		guard = 30;
		while(walls > 0 && guard-- > 0){
			const x = 1 + Math.floor(rnd() * (cols - 2));
			const y = Math.floor(rnd() * rows);
			const cell = at(x, y);
			if(!cell || cell.kind !== 'empty' || onPath[x + ',' + y]) continue;
			cell.kind = 'wall';
			cell.locked = true;
			walls--;
		}
		guard = 20;
		while(guard-- > 0){
			const x = 1 + Math.floor(rnd() * (cols - 2));
			const y = Math.floor(rnd() * rows);
			const cell = at(x, y);
			if(!cell || cell.kind !== 'empty' || onPath[x + ',' + y]) continue;
			cell.kind = 'decoy';
			cell.locked = true;
			break;
		}
		const playable = cells.filter(function(c){ return c.kind === 'mirror' && !c.locked; });
		let spins = 0;
		function scramble(){
			playable.forEach(function(c){ c.rot = Math.floor(rnd() * 2); });
		}
		scramble();
		while(sunSim({cols:cols, rows:rows, cells:cells}) && spins < 10){
			scramble();
			spins++;
		}
		if(spins >= 10){
			playable.forEach(function(c){ if(c._need != null) c.rot = (c._need + 1) % 2; else c.rot = 1; });
		}
		return {cols:cols, rows:rows, cells:cells, beam:[], reflect:0, minReflect:Math.max(2, turns)};
	}
	function sunSim(board){
		const cols = board.cols, rows = board.rows;
		function at(x,y){ if(x<0||y<0||x>=cols||y>=rows) return null; return board.cells[y*cols+x]; }
		board.cells.forEach(function(c){ c.hit = 0; });
		const sun = board.cells.filter(function(c){ return c.kind === 'sun'; })[0];
		const beam = [];
		let x = sun.x, y = sun.y, dir = E, steps = 0, reflect = 0, hitCrystal = false, hitDecoy = false;
		while(steps++ < 36){
			beam.push({x:x,y:y,dir:dir});
			const cell = at(x,y);
			if(!cell) break;
			cell.hit = 1;
			if(cell.kind === 'crystal'){ hitCrystal = true; break; }
			if(cell.kind === 'decoy'){ hitDecoy = true; break; }
			if(cell.kind === 'wall') break;
			if(cell.kind === 'mirror'){
				reflect++;
				const slash = (cell.rot % 2) === 0;
				if(slash){
					if(dir === E) dir = N; else if(dir === W) dir = S; else if(dir === N) dir = E; else dir = W;
				} else {
					if(dir === E) dir = S; else if(dir === W) dir = N; else if(dir === N) dir = W; else dir = E;
				}
			}
			const d = DIRS.filter(function(v){ return v.b === dir; })[0];
			x += d.x; y += d.y;
		}
		board.beam = beam;
		board.reflect = reflect;
		board.hitCrystal = hitCrystal;
		board.hitDecoy = hitDecoy;
		return hitCrystal;
	}
	function sunOpen(r){
		const s = st(r);
		if(!s.sun) s.sun = makeSun((r.id+11)*23);
		s.stage = 'play';
		s.focusX = r.x + r.w/2; s.focusY = r.y + r.h*0.48;
		openOverlay('sunMirror', r, 'Sun Mirror', 'Turn the mirrors. Send sunlight into the waiting crystal.');
	}
	function sunClick(r, mx, my, box){
		const b = st(r).sun;
		if(!b) return;
		const cw = box.w / b.cols, ch = box.h / b.rows;
		const cx = Math.floor((mx - box.x) / cw);
		const cy = Math.floor((my - box.y) / ch);
		if(cx<0||cy<0||cx>=b.cols||cy>=b.rows) return;
		const c = b.cells[cy*b.cols+cx];
		if(!c || c.kind !== 'mirror' || c.locked) return;
		c.rot = (c.rot + 1) % 2;
		if(sunSim(b)){
			complete(r, 'The crystal drinks the sun — hanging roots thicken into a path.', {
				mastery: b.reflect <= (b.minReflect || 4)
			});
		}
	}

	/* ---------- CURRENT READING ---------- */
	function makeCurrent(seed){
		const cols = 7, rows = 4;
		const rnd = rng(seed * 3331 + 2);
		const cells = [];
		for(let y = 0; y < rows; y++) for(let x = 0; x < cols; x++){
			cells.push({x:x,y:y,dead:false,goal:false,start:false});
		}
		function at(x,y){ return cells[y*cols+x]; }
		at(0,1).start = true;
		at(cols-1,2).goal = true;
		at(3,0).dead = true; at(2,3).dead = true; at(5,1).dead = true;
		const gates = [
			{x:2, pos:1, opts:3},
			{x:4, pos:0, opts:3},
			{x:5, pos:1, opts:2}
		];
		gates.forEach(function(g){ g.pos = Math.floor(rnd() * g.opts); });
		return {cols:cols, rows:rows, cells:cells, gates:gates, seed:{x:0.4,y:1.4}, start:{x:0.4,y:1.4}, trail:[], resetT:0};
	}
	function currentVec(board, x, y){
		let vx = 0.034, vy = 0;
		board.gates.forEach(function(g){
			const dist = Math.abs(x - g.x);
			if(dist < 1.15){
				const t = g.pos / Math.max(1, g.opts - 1);
				vy += (t - 0.5) * 0.07;
				vx += 0.01;
			}
		});
		if(y < 0.6) vy += 0.02;
		if(y > board.rows - 1.4) vy -= 0.02;
		return {vx:vx, vy:vy};
	}
	function currentOpen(r){
		const s = st(r);
		if(!s.cur) s.cur = makeCurrent((r.id+8)*19);
		s.stage = 'play';
		s.focusX = r.x + r.w/2; s.focusY = r.y + r.h*0.55;
		openOverlay('currentRead', r, 'Current Reading', 'Watch the debris. Turn the root gates and carry the seed to the far basin.');
	}
	function currentClick(r, mx, my, box){
		const b = st(r).cur;
		if(!b) return;
		const gw = box.w / b.cols;
		b.gates.forEach(function(g){
			const gx = box.x + (g.x + 0.5) * gw;
			if(Math.abs(mx - gx) < gw * 0.55 && my > box.y && my < box.y + box.h){
				g.pos = (g.pos + 1) % g.opts;
			}
		});
	}
	function currentTick(r){
		const b = st(r).cur;
		if(!b || P.overlay && P.overlay.type !== 'currentRead') return;
		if(b.resetT > 0){ b.resetT--; return; }
		const v = currentVec(b, b.seed.x, b.seed.y);
		b.seed.x += v.vx;
		b.seed.y += v.vy;
		b.trail.push({x:b.seed.x, y:b.seed.y});
		if(b.trail.length > 40) b.trail.shift();
		const cx = Math.round(b.seed.x), cy = Math.round(b.seed.y);
		const cell = (cx>=0&&cy>=0&&cx<b.cols&&cy<b.rows) ? b.cells[cy*b.cols+cx] : null;
		if(!cell || b.seed.x < -0.2 || b.seed.y < -0.2 || b.seed.x > b.cols - 0.2 || b.seed.y > b.rows - 0.2 || (cell && cell.dead)){
			b.seed.x = b.start.x; b.seed.y = b.start.y; b.trail = []; b.resetT = 22;
			banner('The seed drifts into a still pool. The current resets.');
			return;
		}
		if(cell.goal){
			complete(r, 'The seed reaches living water — the flood remembers a new course.');
		}
	}

	/* ---------- FLOWER TIMING ---------- */
	function flowerNodes(r){
		const group = r.puzzle && r.puzzle.group;
		let list = nodes(r, group, ['flowerNode','sporeFlower']);
		if(!list.length) list = interacts().filter(function(it){ return it.roomId === r.id && /flower/i.test(it.kind||''); });
		return list;
	}
	function flowerEnsure(r){
		const s = st(r);
		if(s.flowers) return;
		const list = flowerNodes(r);
		s.flowers = list.map(function(it, i){
			return {
				it:it, period:140 + i * 18, phase:i * 37, open:46 - Math.min(16, i * 2),
				armed:false, done:false, shrink:0
			};
		});
		s.need = Math.min(list.length, Math.max(4, list.length));
		s.got = 0;
		s.stage = 'play';
		s.focusX = r.x + r.w/2; s.focusY = r.y + r.h*0.55;
		banner('The giant flowers open on their own time. Touch them while they bloom.');
	}
	function flowerOpenAmt(f, pulse){
		const c = ((pulse + f.phase) % f.period);
		const win = Math.max(18, f.open - f.shrink);
		return c < win;
	}
	function flowerTick(r){
		const s = st(r);
		if(!s.flowers) return;
		s.flowers.forEach(function(f){
			f.shrink = Math.min(22, (s.got || 0) * 3);
			f.it._flowerOpen = flowerOpenAmt(f, P.pulse);
			f.it._done = f.done;
		});
	}
	function flowerHit(r, it){
		const s = st(r);
		flowerEnsure(r);
		const f = s.flowers.filter(function(v){ return v.it === it; })[0];
		if(!f || f.done) return true;
		if(!flowerOpenAmt(f, P.pulse)){
			banner('The bloom is shut. Wait for the next opening.');
			it._shake = 16;
			return true;
		}
		f.done = true;
		it.used = true;
		s.got++;
		parts(it.x+it.w/2, it.y+it.h/2, {r:240,g:180,b:90}, 14);
		if(s.got >= s.need){
			complete(r, 'The garden blooms as one — a living mechanism unfolds.');
		} else {
			banner('The flower answers. ' + s.got + ' of ' + s.need + ' still listen.');
		}
		return true;
	}

	/* ---------- PREDATOR TRACKING ---------- */
	function trackEnsure(r){
		const s = st(r);
		if(s.trail) return;
		let clues = interacts().filter(function(it){ return it.roomId === r.id && it.kind === 'trackClue'; });
		if(!clues.length){
			clues = interacts().filter(function(it){
				return it.roomId === r.id && (it.kind === 'jungleMemory' || it.kind === 'predatorNest' || it.kind === 'jungleTrap');
			});
		}
		clues.sort(function(a,b){ return (a.idx||0) - (b.idx||0); });
		if(!clues.length){
			const platsR = plats().filter(function(p){ return p.roomId === r.id && p.w > 140 && !p._jungleHidden; });
			clues = platsR.slice(0, 5).map(function(p, i){
				const it = {kind:'trackClue', x:p.x+p.w*0.4, y:p.y-70, w:70, h:60, roomId:r.id, idx:i, name:['Footprint','Broken branch','Bent grass','Claw mark','Fur'][i]||'Sign'};
				interacts().push(it);
				return it;
			});
		}
		s.trail = clues;
		s.at = 0;
		s.hardT = 0;
		s.stage = 'play';
		s.fail = false;
		banner('A trail crosses the floor. Touch the next true sign — nothing else.');
	}
	function trackHit(r, it){
		const s = st(r);
		trackEnsure(r);
		const idx = s.trail.indexOf(it);
		if(idx < 0) return false;
		if(s.hardT > 0 && idx !== s.at){ it._shake = 18; return true; }
		if(idx === s.at){
			it._glow = 24;
			s.at++;
			parts(it.x+it.w/2, it.y+it.h/2, {r:220,g:210,b:90}, 10);
			if(s.at >= s.trail.length){
				r._trackAmbush = true;
				complete(r, 'You have the predator’s path — the hunt is yours to start.');
				if(r.clearMode !== 'puzzle'){
					r._jungleSolved = true;
					banner('The trail ends in a clear ambush. Strike first.');
					interacts().forEach(function(n){
						if(n.roomId === r.id && n.kind === 'predatorNest') n._ambushReady = true;
					});
				}
			}
		} else {
			it._shake = 18;
			s.hardT = 90;
			banner('The sign is false. The trail blurs.');
			if(s.fail){
				r._trackFail = true;
				failSpawn(r, 3);
				banner('The predator heard you. It attacks first.');
			}
			s.fail = true;
		}
		return true;
	}

	/* ---------- SPORE IDENTIFICATION ---------- */
	function sporeEnsure(r){
		const s = st(r);
		if(s.spores) return;
		const flowers = flowerNodes(r);
		const rnd = rng(r.id * 77 + 4);
		const seqLen = Math.min(3, Math.max(3, flowers.length));
		const seq = [];
		for(let i = 0; i < seqLen; i++) seq.push(i % Math.max(1, flowers.length));
		if(flowers.length >= 3){ seq[0] = 0; seq[1] = Math.min(2, flowers.length-1); seq[2] = 0; }
		if(rnd() > 0.5 && flowers.length > 2) seq[1] = 1;
		s.spores = { flowers:flowers, seq:seq, shown:0, showT:90, input:[], mist:0, drifting:[] };
		s.stage = 'watch';
		banner('A safe-air mark flashes, then the spores begin to travel. Follow what you saw.');
	}
	function sporeTick(r){
		const s = st(r);
		if(!s.spores) return;
		const sp = s.spores;
		if(s.stage === 'watch'){
			sp.showT--;
			if(sp.showT <= 0){
				s.stage = 'play';
				sp.drifting = sp.seq.map(function(idx, i){
					const it = sp.flowers[idx];
					return {idx:idx, x:it?it.x:r.x+200, y:it?it.y:r.y+200, t:i*18};
				});
			}
		}
		if(sp.mist > 0){ sp.mist--; if(typeof player !== 'undefined' && player) player.blindTimer = Math.max(player.blindTimer||0, 8); }
		sp.drifting.forEach(function(d){
			d.t++;
			d.x += Math.sin(d.t * 0.05 + d.idx) * 1.4;
			d.y += Math.cos(d.t * 0.04) * 0.8;
		});
	}
	function sporeHit(r, it){
		const s = st(r);
		sporeEnsure(r);
		if(s.stage === 'watch'){ banner('Wait — the safe mark is still showing.'); return true; }
		const sp = s.spores;
		const idx = sp.flowers.indexOf(it);
		if(idx < 0) return false;
		const need = sp.seq[sp.input.length];
		if(idx !== need){
			sp.mist = 80;
			triggerFailHaz(r);
			failSpawn(r, 2);
			sp.input = [];
			banner('Wrong bloom — poison fog rolls in. Watch the traveling spores again.');
			s.stage = 'watch'; sp.showT = 70;
			return true;
		}
		sp.input.push(idx);
		it._pulse = 20;
		if(sp.input.length >= sp.seq.length){
			complete(r, 'Safe spores flood the chamber. The poison thins and the way opens.');
		}
		return true;
	}

	/* ---------- ROOT CUTTING ---------- */
	function cutEnsure(r){
		const s = st(r);
		if(s.roots) return;
		let roots = interacts().filter(function(it){ return it.roomId === r.id && it.kind === 'rootStrand'; });
		if(!roots.length){
			roots = interacts().filter(function(it){ return it.roomId === r.id && (it.kind === 'rootSeal' || it.kind === 'rootSwitch' || it.kind === 'growthNode'); });
		}
		roots.sort(function(a,b){ return (a.tier||a.idx||0) - (b.tier||b.idx||0); });
		if(!roots.length){
			const base = r.x + r.w * 0.35;
			['main','sec','sec','thin'].forEach(function(tier, i){
				const it = {kind:'rootStrand', x:base + i*90, y:r.y + r.h - 280, w:70, h:160, roomId:r.id, tier:tier, idx:i, name:tier==='main'?'Heart Root':(tier==='sec'?'Branch Root':'Tendril')};
				interacts().push(it);
				roots.push(it);
			});
		}
		roots.forEach(function(it, i){
			if(!it.tier) it.tier = i === 0 ? 'main' : (i < 3 ? 'sec' : 'thin');
			it._thick = it.tier === 'main' ? 1 : (it.tier === 'sec' ? 0.6 : 0.35);
		});
		s.roots = roots;
		s.need = ['main','sec','thin'];
		s.at = 0;
		s.stage = 'play';
		banner('The thickest root pulses with sap. Cut the heart first, or the tangle grows back.');
	}
	function cutHit(r, it){
		const s = st(r);
		cutEnsure(r);
		if(s.roots.indexOf(it) < 0) return false;
		if(it.used) return true;
		const need = s.need[s.at];
		const tier = it.tier || 'thin';
		if(tier !== need && !(need === 'sec' && tier === 'sec')){
			s.roots.forEach(function(n){ if(n.used && n.tier !== 'main'){ n.used = false; } });
			if(s.at > 0) s.at = Math.max(0, s.at - 1);
			failSpawn(r, 2);
			banner('The cut was wrong — a branch knits shut and something crawls out.');
			return true;
		}
		it.used = true;
		parts(it.x+it.w/2, it.y+it.h/2, {r:160,g:90,b:50}, 12);
		const remain = s.roots.filter(function(n){ return !n.used && n.tier === need; });
		if(!remain.length) s.at++;
		if(s.at >= s.need.length){
			complete(r, 'The root-mass collapses. A hidden room breathes open.');
		}
		return true;
	}

	/* ---------- STATUE GAZE ---------- */
	function statueEnsure(r){
		const s = st(r);
		if(s.statues) return;
		const list = nodes(r, r.puzzle && r.puzzle.group, ['statueNode']);
		s.statues = list;
		s.needHits = (r.puzzle && r.puzzle.needHits) || 3;
		s.targets = (r.puzzle && r.puzzle.gaze) || [
			{x:r.x + r.w * 0.5, y:r.y + 220, name:'Root Symbol'},
			{x:r.x + r.w * 0.22, y:r.y + 280, name:'Bloom Symbol'},
			{x:r.x + r.w * 0.78, y:r.y + 280, name:'Fang Symbol'}
		];
		s.stage = 'play';
		s.focusX = r.x + r.w/2; s.focusY = r.y + r.h*0.45;
		if(!s.statues.length) banner('The guardians wait.');
		else banner('Turn each guardian. Their gaze must meet the living symbols.');
	}
	function statueDir(it){
		const n = it.states || 5;
		const a = ((it.state || 0) / n) * Math.PI * 1.4 - Math.PI * 0.7;
		return {x:Math.sin(a), y:-Math.cos(a)};
	}
	function statueTick(r){
		const s = st(r);
		if(!s.statues || r._jungleSolved) return;
		const hits = [];
		s.statues.forEach(function(it){
			const d = statueDir(it);
			const ox = it.x + it.w/2, oy = it.y + 20;
			s.targets.forEach(function(t, ti){
				const vx = t.x - ox, vy = t.y - oy;
				const len = Math.hypot(vx, vy) || 1;
				const dot = (vx/len)*d.x + (vy/len)*d.y;
				if(dot > 0.92 && len < 720) hits[ti] = true;
			});
			s.statues.forEach(function(other){
				if(other === it) return;
				const vx = other.x - ox, vy = other.y - oy;
				const len = Math.hypot(vx,vy)||1;
				const dot = (vx/len)*d.x + (vy/len)*d.y;
				if(dot > 0.93) other._reflect = 12;
			});
		});
		s.hitN = hits.filter(Boolean).length;
		if(s.hitN >= s.needHits && !s.gazeDone){
			s.gazeDone = true;
			if(r.puzzle && r.puzzle.nextMini){
				banner('The gazes lock. A root lattice wakes in the floor.');
				r.puzzle.mini = r.puzzle.nextMini;
				r.puzzle.nextMini = null;
				gridEnsure(r);
				gridOpen(r);
			} else {
				complete(r, 'The gazes lock. Stone roots bloom and the vault answers.');
			}
		}
	}
	function statueHit(r, it){
		statueEnsure(r);
		it.state = ((it.state || 0) + 1) % (it.states || 5);
		it.used = false;
		parts(it.x+it.w/2, it.y+20, {r:200,g:220,b:90}, 8);
		banner((it.name || 'Guardian') + ' turns. Watch where the beam falls.');
		return true;
	}

	/* ---------- FALLING BRANCH MEMORY ---------- */
	function branchEnsure(r){
		const s = st(r);
		if(s.branch) return;
		const list = plats().filter(function(p){ return p.roomId === r.id && !p.vineRung && p.w > 160 && !p._jungleHidden; }).slice(0, 5);
		const rnd = rng(r.id * 45 + 6);
		const seq = [];
		const n = Math.min(4, list.length);
		for(let i = 0; i < n; i++) seq.push(i);
		for(let i = seq.length - 1; i > 0; i--){ const j = Math.floor(rnd()*(i+1)); const t = seq[i]; seq[i]=seq[j]; seq[j]=t; }
		list.forEach(function(p, i){ p._safeMark = seq.indexOf(i) >= 0; p._branchIdx = i; });
		s.branch = { plats:list, seq:seq, demoI:0, demoT:30, at:0, stage:'demo' };
		s.stage = 'demo';
		banner('Marked boughs flash. Remember the living ones — bark, glow, and swarm.');
	}
	function branchTick(r){
		const s = st(r);
		if(!s.branch) return;
		const b = s.branch;
		b.plats.forEach(function(p){ if(p._flashT > 0) p._flashT--; });
		if(b.stage === 'demo'){
			b.demoT--;
			if(b.demoT <= 0){
				if(b.demoI >= b.seq.length){
					b.stage = 'run';
					s.stage = 'play';
					banner('The canopy starts to fall. Stand on the living boughs.');
				} else {
					const p = b.plats[b.seq[b.demoI]];
					if(p) p._flashT = 28;
					b.demoI++;
					b.demoT = 26;
				}
			}
			return;
		}
		if(typeof player === 'undefined' || !player) return;
		const falling = hazards().filter(function(h){ return h.roomId === r.id && h.type === 'fallingBranch' && h.hot; });
		if(!falling.length) return;
		const p = b.plats[b.seq[b.at]];
		if(!p) return;
		const on = player.x + player.w > p.x && player.x < p.x + p.w && Math.abs((player.y+player.h) - p.y) < 28;
		if(on){
			p._flashT = 16;
			b.at++;
			if(b.at >= b.seq.length){
				complete(r, 'You rode the living boughs. The falling canopy spares the far ledge.');
			}
		}
	}

	/* ---------- VINE SWING ---------- */
	function vineTickHazard(h){
		const r = rooms()[h.roomId];
		if(!r || miniOf(r) !== 'vineSwing') return false;
		const s = st(r);
		s.stage = s.stage || 'play';
		const px = (typeof player !== 'undefined' && player) ? player.x + player.w/2 : 0;
		const py = (typeof player !== 'undefined' && player) ? player.y + player.h/2 : 0;
		const grab = s.grab === h;
		if(grab){
			player.x = h.bobX - player.w/2;
			player.y = h.bobY - player.h * 0.2;
			player.vx = 0; player.vy = 0;
			player.onGround = false;
			const k = keysOf();
			if(k['e'] && !s.eLatch){
				s.eLatch = true;
				const a = (P.pulse / (h.period || 250)) * Math.PI * 2;
				player.vx = Math.cos(a) * 13;
				player.vy = -Math.abs(Math.sin(a)) * 11 - 4;
				s.grab = null;
				s.air = 50;
			}
			if(!k['e']) s.eLatch = false;
			return true;
		}
		if(Math.hypot(px - h.bobX, py - h.bobY) < 48){
			const k = keysOf();
			if(k['e'] && !s.eLatch && !s.grab){
				s.grab = h;
				s.eLatch = true;
				banner('Grabbed. Release at the top of the arc.');
				return true;
			}
		}
		return false;
	}
	function vineTick(r){
		const s = st(r);
		if(!s) return;
		const k = keysOf();
		if(!k['e']) s.eLatch = false;
		if(s.air > 0){
			s.air--;
			if(typeof player !== 'undefined' && player && player.onGround){
				s.air = 0;
				if(r.clearZone && player.x > r.clearZone.x) complete(r, 'You land on the far root. The swing is done.');
			} else if(s.air === 1 && typeof player !== 'undefined' && player && player.y > r.y + r.h - 80){
				if(typeof damagePlayer === 'function') damagePlayer(6, []);
				banner('A hard landing on a lower root. Climb and try the next vine.');
			}
		}
	}

	/* ---------- DRAW HELPERS ---------- */
	function overlayBox(){
		const c = cvs();
		let w = Math.min(760, c.width * 0.72);
		let h = Math.min(520, c.height * 0.7);
		const r = P.overlay && (rooms()[P.overlay.roomId] || current());
		const board = r && r._pz && r._pz.board;
		if(P.overlay && P.overlay.type === 'sluiceFlow' && board){
			w = Math.min(c.width * 0.86, Math.max(760, board.cols * 92));
			h = Math.min(c.height * 0.80, Math.max(520, board.rows * 92));
		}
		return {x:(c.width-w)/2, y:(c.height-h)/2 + 10, w:w, h:h};
	}
	function drawPipe(ctx, x, y, w, h, mask, flow, kind, oneway){
		ctx.save();
		ctx.translate(x+w/2, y+h/2);
		ctx.fillStyle = kind === 'blocked' ? '#2a2418' : (kind === 'source' ? '#1d4d46' : (kind === 'basin' ? '#3a2a12' : '#3d3424'));
		ctx.fillRect(-w*0.42, -h*0.42, w*0.84, h*0.84);
		ctx.strokeStyle = flow ? '#7fe7c9' : '#8a7a55';
		ctx.lineWidth = Math.max(6, w*0.16);
		ctx.lineCap = 'round';
		function arm(bit, ox, oy){
			if(!(mask & bit)) return;
			ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(ox, oy); ctx.stroke();
		}
		arm(N, 0, -h*0.42); arm(E, w*0.42, 0); arm(S, 0, h*0.42); arm(W, -w*0.42, 0);
		if(kind === 'source'){ ctx.fillStyle = '#7fe7c9'; ctx.beginPath(); ctx.arc(0,0,w*0.14,0,Math.PI*2); ctx.fill(); }
		if(kind === 'basin'){ ctx.fillStyle = '#e7c56a'; ctx.beginPath(); ctx.arc(0,0,w*0.14,0,Math.PI*2); ctx.fill(); }
		if(oneway){ ctx.fillStyle = '#f0d27a'; ctx.fillRect(-4, -h*0.08, 8, h*0.16); }
		if(kind === 'blocked'){ ctx.strokeStyle = '#6a3030'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-w*0.2,-h*0.2); ctx.lineTo(w*0.2,h*0.2); ctx.stroke(); }
		ctx.restore();
	}
	function drawOverlay(){
		if(!P.overlay) return;
		const r = rooms()[P.overlay.roomId] || current();
		if(!r) return;
		const ctx = global.ctx;
		if(!ctx) return;
		const c = cvs();
		const box = overlayBox();
		ctx.save();
		ctx.fillStyle = 'rgba(4,10,6,.55)';
		ctx.fillRect(0,0,c.width,c.height);
		ctx.fillStyle = 'rgba(18,28,16,.94)';
		ctx.strokeStyle = 'rgba(170,220,110,.55)';
		ctx.lineWidth = 2;
		ctx.fillRect(box.x-18, box.y-64, box.w+36, box.h+98);
		ctx.strokeRect(box.x-18, box.y-64, box.w+36, box.h+98);
		ctx.fillStyle = '#e8f6b4';
		ctx.font = 'bold 20px serif';
		ctx.textAlign = 'center';
		ctx.fillText(P.overlay.title, c.width/2, box.y-32);
		ctx.font = '13px sans-serif';
		ctx.fillStyle = '#b7c99a';
		ctx.fillText(P.overlay.hint, c.width/2, box.y-12);
		ctx.fillStyle = '#7d8c6a';
		ctx.font = '11px sans-serif';
		ctx.fillText('Click a piece to turn it   ·   Esc to step back', c.width/2, box.y+box.h+22);
		const s = st(r);
		if(P.overlay.type === 'sluiceFlow' && s.board){
			sluiceFlow(s.board);
			const cw = box.w/s.board.cols, ch = box.h/s.board.rows;
			s.board.cells.forEach(function(cell){
				drawPipe(ctx, box.x+cell.x*cw+4, box.y+cell.y*ch+4, cw-8, ch-8, cellMask(cell), cell.flow, cell.kind, cell.oneway);
			});
			if(s.board.reached){
				ctx.fillStyle = 'rgba(140,230,160,.18)';
				ctx.fillRect(box.x, box.y, box.w, box.h);
			}
		} else if(P.overlay.type === 'rootGrid' && s.grid){
			const n = s.grid.n, cw = box.w/n, ch = box.h/n;
			for(let i = 0; i < n*n; i++){
				const x = i%n, y = (i/n)|0;
				const on = s.grid.on[i];
				ctx.fillStyle = on ? '#7dce6a' : '#2a241c';
				ctx.fillRect(box.x+x*cw+10, box.y+y*ch+10, cw-20, ch-20);
				ctx.strokeStyle = on ? '#e7ffb0' : '#6a5c40';
				ctx.strokeRect(box.x+x*cw+10, box.y+y*ch+10, cw-20, ch-20);
				if(on){
					ctx.fillStyle = 'rgba(180,255,120,.35)';
					ctx.beginPath(); ctx.arc(box.x+x*cw+cw/2, box.y+y*ch+ch/2, 16, 0, Math.PI*2); ctx.fill();
				}
			}
		} else if(P.overlay.type === 'sunMirror' && s.sun){
			sunSim(s.sun);
			const b = s.sun, cw = box.w/b.cols, ch = box.h/b.rows;
			b.cells.forEach(function(cell){
				const x = box.x+cell.x*cw, y = box.y+cell.y*ch;
				ctx.fillStyle = cell.kind==='wall' ? '#1c1812' : (cell.hit ? 'rgba(80,70,30,.55)' : '#24301c');
				ctx.fillRect(x+4,y+4,cw-8,ch-8);
				if(cell.kind==='sun'){ ctx.fillStyle='#ffe27a'; ctx.beginPath(); ctx.arc(x+cw/2,y+ch/2,14,0,Math.PI*2); ctx.fill(); }
				if(cell.kind==='crystal'){ ctx.fillStyle='#aef7ff'; ctx.beginPath(); ctx.moveTo(x+cw/2,y+10); ctx.lineTo(x+cw-12,y+ch/2); ctx.lineTo(x+cw/2,y+ch-10); ctx.lineTo(x+12,y+ch/2); ctx.closePath(); ctx.fill(); }
				if(cell.kind==='decoy'){ ctx.fillStyle='#5a6a70'; ctx.beginPath(); ctx.arc(x+cw/2,y+ch/2,10,0,Math.PI*2); ctx.fill(); }
				if(cell.kind==='mirror'){
					ctx.save(); ctx.translate(x+cw/2,y+ch/2); ctx.rotate(cell.rot?0.6:-0.6);
					ctx.strokeStyle = cell.locked ? '#c0c0c0' : '#e8f4ff'; ctx.lineWidth = 5;
					ctx.beginPath(); ctx.moveTo(-16,16); ctx.lineTo(16,-16); ctx.stroke();
					ctx.restore();
					if(cell.optional){ ctx.fillStyle='rgba(255,255,255,.25)'; ctx.fillRect(x+8,y+8,8,8); }
				}
			});
			ctx.strokeStyle = 'rgba(255,230,120,.85)'; ctx.lineWidth = 3;
			ctx.beginPath();
			b.beam.forEach(function(p,i){
				const x = box.x+(p.x+0.5)*cw, y = box.y+(p.y+0.5)*ch;
				if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
			});
			ctx.stroke();
		} else if(P.overlay.type === 'currentRead' && s.cur){
			const b = s.cur, cw = box.w/b.cols, ch = box.h/b.rows;
			b.cells.forEach(function(cell){
				const x = box.x+cell.x*cw, y = box.y+cell.y*ch;
				ctx.fillStyle = cell.dead ? '#1a2418' : (cell.goal ? '#3a5a28' : (cell.start ? '#2a4a40' : '#1e3a44'));
				ctx.fillRect(x+3,y+3,cw-6,ch-6);
			});
			b.gates.forEach(function(g){
				const x = box.x + g.x*cw + 8;
				ctx.fillStyle = '#8a6a3a';
				ctx.fillRect(x, box.y+8, cw-16, box.h-16);
				ctx.fillStyle = '#e8d9a0';
				ctx.fillRect(x+4, box.y + 12 + g.pos * ((box.h-40)/Math.max(1,g.opts)), cw-24, 18);
			});
			ctx.strokeStyle = 'rgba(180,255,210,.4)'; ctx.lineWidth = 2;
			ctx.beginPath();
			b.trail.forEach(function(p,i){
				const x = box.x+(p.x+0.5)*cw, y = box.y+(p.y+0.5)*ch;
				if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
			});
			ctx.stroke();
			ctx.fillStyle = '#d6ff9a';
			ctx.beginPath(); ctx.arc(box.x+(b.seed.x+0.5)*cw, box.y+(b.seed.y+0.5)*ch, 8, 0, Math.PI*2); ctx.fill();
		}
		ctx.restore();
	}

	function drawWorld(ctx){
		const r = current();
		if(!r) return;
		const s = st(r);
		const c = cam();
		P.fx.forEach(function(f){
			const a = f.life / f.max;
			ctx.save();
			ctx.globalAlpha = a * 0.55;
			ctx.fillStyle = f.color || '#b6f080';
			ctx.beginPath(); ctx.arc(f.x-c.x, f.y-c.y, (f.r||30)*(1.4-a), 0, Math.PI*2); ctx.fill();
			ctx.restore();
		});
		if(miniOf(r) === 'rootRhythm' && s){
			rhythmNodes(r).forEach(function(it, i){
				const cap = CAPS[i % CAPS.length];
				const x = it.x-c.x, y = it.y-c.y;
				if(s.darkT > 0){ ctx.fillStyle = 'rgba(10,16,8,.45)'; ctx.fillRect(x-8,y-8,(it.w||80)+16,(it.h||80)+16); }
				if(it._pulse > 0 || s.flash === i){
					ctx.save();
					ctx.globalAlpha = 0.45 + (it._pulse||0)/50;
					ctx.fillStyle = cap.color;
					ctx.beginPath(); ctx.arc(x+(it.w||80)/2, y+(it.h||70)/2, 62, 0, Math.PI*2); ctx.fill();
					ctx.restore();
				}
				ctx.save();
				ctx.strokeStyle = cap.color;
				ctx.lineWidth = 4;
				ctx.globalAlpha = 0.9;
				ctx.beginPath(); ctx.arc(x+(it.w||80)/2, y+(it.h||70)/2, 40, 0, Math.PI*2); ctx.stroke();
				ctx.fillStyle = 'rgba(8,16,8,0.72)';
				ctx.fillRect(x + (it.w||80)/2 - 14, y - 28, 28, 24);
				ctx.fillStyle = cap.color;
				ctx.font = 'bold 18px sans-serif';
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.fillText(String(i + 1), x + (it.w||80)/2, y - 16);
				ctx.restore();
				if(it._bloom){
					ctx.fillStyle = 'rgba(180,255,120,.25)';
					ctx.beginPath(); ctx.arc(x+(it.w||80)/2, y, 40+Math.sin(P.pulse*0.2)*6, 0, Math.PI*2); ctx.fill();
				}
			});
		}
		if(miniOf(r) === 'flowerTiming' && s && s.flowers){
			s.flowers.forEach(function(f, i){
				const it = f.it;
				const x = it.x-c.x, y = it.y-c.y;
				if(it._flowerOpen && !f.done){
					ctx.fillStyle = FLOWER_HUES[i%FLOWER_HUES.length];
					ctx.globalAlpha = 0.35;
					ctx.beginPath(); ctx.arc(x+it.w/2, y+it.h/2, 36, 0, Math.PI*2); ctx.fill();
					ctx.globalAlpha = 1;
				}
			});
		}
		if(miniOf(r) === 'statueGaze' && s && s.statues){
			s.statues.forEach(function(it){
				const d = statueDir(it);
				const ox = it.x+it.w/2-c.x, oy = it.y+16-c.y;
				ctx.strokeStyle = 'rgba(230,240,120,.55)'; ctx.lineWidth = 3;
				ctx.beginPath(); ctx.moveTo(ox,oy); ctx.lineTo(ox+d.x*420, oy+d.y*420); ctx.stroke();
			});
			(s.targets||[]).forEach(function(t){
				ctx.fillStyle = 'rgba(180,255,90,.35)';
				ctx.beginPath(); ctx.arc(t.x-c.x, t.y-c.y, 16, 0, Math.PI*2); ctx.fill();
			});
		}
		if(miniOf(r) === 'vineSwing'){
			hazards().forEach(function(h){
				if(h.roomId !== r.id || h.type !== 'swingingVine' || h.bobX == null) return;
				ctx.strokeStyle = 'rgba(180,220,90,.35)'; ctx.setLineDash([6,8]);
				ctx.beginPath();
				ctx.arc(h.x-c.x, h.y-c.y, (h.length||h.h||420)*0.62, 0.15, Math.PI-0.15);
				ctx.stroke(); ctx.setLineDash([]);
			});
		}
		if(miniOf(r) === 'branchMemory'){
			plats().forEach(function(p){
				if(p.roomId !== r.id) return;
				if(p._safeMark){
					ctx.fillStyle = 'rgba(160,230,90,.18)';
					ctx.fillRect(p.x-c.x, p.y-c.y-12, p.w, 12);
				}
				if(p._flashT > 0){
					ctx.fillStyle = 'rgba(240,255,140,'.concat(p._flashT/40,')');
					ctx.fillRect(p.x-c.x, p.y-c.y-18, p.w, p.h+18);
				}
			});
		}
		if(miniOf(r) === 'rootCut' && s && s.roots){
			s.roots.forEach(function(it){
				if(it.used) return;
				const x = it.x-c.x, y = it.y-c.y;
				if(it.tier === 'main'){
					ctx.strokeStyle = 'rgba(255,210,80,.55)'; ctx.lineWidth = 4;
					ctx.strokeRect(x-4,y-4,(it.w||60)+8,(it.h||80)+8);
					ctx.fillStyle = 'rgba(255,200,80,'.concat(0.25+Math.sin(P.pulse*0.2)*0.1,')');
					ctx.fillRect(x, y, it.w||60, it.h||80);
				}
			});
		}
		if(miniOf(r) === 'sporeId' && s && s.spores){
			if(s.stage === 'watch'){
				const seq = s.spores.seq;
				const flowers = s.spores.flowers || [];
				const bx = cvs().width/2, by = 86;
				ctx.fillStyle = 'rgba(0,0,0,.28)';
				ctx.fillRect(bx - 70, 62, 140, 48);
				seq.forEach(function(idx, i){
					const raw = flowers[idx] && (flowers[idx]._color || flowers[idx].color);
					const col = raw && raw.charAt(0) === '#' ? raw : ({blue:'#7ec8ef',purple:'#c084ed',green:'#86e67b',amber:'#e8c45a'}[raw] || CAPS[idx%CAPS.length].color);
					ctx.fillStyle = col;
					ctx.beginPath();
					ctx.arc(bx - 40 + i * 40, by, 11, 0, Math.PI*2);
					ctx.fill();
				});
			}
			s.spores.drifting.forEach(function(d){
				ctx.fillStyle = CAPS[d.idx%CAPS.length].color;
				ctx.globalAlpha = 0.45;
				ctx.beginPath(); ctx.arc(d.x-c.x, d.y-c.y, 10, 0, Math.PI*2); ctx.fill();
				ctx.globalAlpha = 1;
			});
		}
		if(miniOf(r) === 'predatorTrack' && s && s.trail){
			s.trail.forEach(function(it, i){
				if(it._glow > 0){ it._glow--; ctx.fillStyle='rgba(240,220,90,.35)'; ctx.beginPath(); ctx.arc(it.x-c.x+it.w/2,it.y-c.y+it.h/2,24,0,Math.PI*2); ctx.fill(); }
				if(it._shake > 0) it._shake--;
			});
		}
	}

	function overlayClick(){
		if(!P.overlay) return false;
		const r = rooms()[P.overlay.roomId] || current();
		if(!r) return false;
		const p = pointer();
		const box = overlayBox();
		if(p.sx < box.x-18 || p.sy < box.y-64 || p.sx > box.x+box.w+18 || p.sy > box.y+box.h+34){
			closeOverlay(true);
			return true;
		}
		if(P.overlay.type === 'sluiceFlow') sluiceClick(r, p.sx, p.sy, box);
		else if(P.overlay.type === 'rootGrid') gridClick(r, p.sx, p.sy, box);
		else if(P.overlay.type === 'sunMirror') sunClick(r, p.sx, p.sy, box);
		else if(P.overlay.type === 'currentRead') currentClick(r, p.sx, p.sy, box);
		return true;
	}

	function onRoomEnter(r){
		if(!r || !miniOf(r) || r._pzGreeted) return;
		r._pzGreeted = true;
		const m = miniOf(r);
		const greet = {
			rootRhythm:'Caps along the cavern start to breathe. Approach one to wake the rhythm.',
			sluiceFlow:'An ancient water-table waits. Touch a sluice to read the channels.',
			rootGrid:'A root lattice sleeps under the floor. Touch the heart to press it.',
			sunMirror:'Sunlight hangs in the ruins. Touch a mirror to begin.',
			flowerTiming:'Giant flowers open and shut on their own. Touch them while they are open.',
			predatorTrack:'Something heavy crossed this ground. The trail is still warm.',
			sporeId:'Colored spores lift from the blooms. Watch the air before you touch anything.',
			rootCut:'A door of living roots. The thickest vein pulses — start there.',
			statueGaze:'Four guardians keep the vault. Turn them until their gazes agree.',
			branchMemory:'The canopy will fall. Watch which boughs still live.',
			vineSwing:'Vines arc across the gap. Grab, swing, and let go.',
			currentRead:'Leaves spin on the flood. Read the current, then turn the root gates.'
		};
		if(m === 'sunMirror' && r.kind === 'memory') banner('The mural still holds a shaft of daylight. Study it until the light finds the waiting crystal.');
		else if(m === 'sluiceFlow' && sluiceNeedsSides(r)) banner('Two sluices split the stream. Both tables must reach their basins.');
		else if(greet[m]) banner(greet[m]);
		if(m === 'branchMemory') branchEnsure(r);
		if(m === 'flowerTiming') flowerEnsure(r);
		if(m === 'predatorTrack') trackEnsure(r);
		if(m === 'rootCut') cutEnsure(r);
		if(m === 'statueGaze') statueEnsure(r);
		if(m === 'rootRhythm' && !r._jungleSolved && !r.cleared) rhythmStart(r);
	}

	function tryInteract(){
		const r = current();
		if(!r || !miniOf(r) || r._jungleSolved) return false;
		if(P.overlay){ closeOverlay(true); return true; }
		const it = nearest();
		if(!it) return false;
		const m = miniOf(r);
		if(it.kind === 'puzzleBoard' || it.kind === 'waterWheel' || it.kind === 'sunMirror' || it.kind === 'jungleMemory'){
			if(m === 'sluiceFlow'){ sluiceOpen(r, it); return true; }
			if(m === 'sunMirror'){ sunOpen(r); return true; }
			if(m === 'rootGrid'){ gridOpen(r); return true; }
			if(m === 'currentRead'){ currentOpen(r); return true; }
		}
		if(m === 'rootRhythm' && (it.kind === 'mushroomNode' || it.kind === 'growthNode' || it.kind === 'sporeFlower')) return rhythmHit(r, it);
		if(m === 'flowerTiming' && (it.kind === 'flowerNode' || it.kind === 'sporeFlower')) return flowerHit(r, it);
		if(m === 'predatorTrack') return trackHit(r, it);
		if(m === 'sporeId' && (it.kind === 'flowerNode' || it.kind === 'sporeFlower' || it.kind === 'mushroomNode')) return sporeHit(r, it);
		if(m === 'rootCut') return cutHit(r, it);
		if(m === 'statueGaze' && it.kind === 'statueNode') return statueHit(r, it);
		if(m === 'vineSwing') return true;
		return false;
	}

	function nearest(){
		if(typeof player === 'undefined' || !player) return null;
		const px = player.x + player.w/2, py = player.y + player.h/2;
		let best = null, bd = 220;
		interacts().forEach(function(it){
			if(!it || it.used && it.kind !== 'waterWheel' && it.kind !== 'sunMirror' && it.kind !== 'statueNode' && it.kind !== 'puzzleBoard' && it.kind !== 'jungleMemory') return;
			const d = Math.hypot(px - (it.x+(it.w||60)/2), py - (it.y+(it.h||60)/2));
			if(d < bd){ best = it; bd = d; }
		});
		return best;
	}

	function prompt(){
		if(P.overlay) return 'Esc — Step back from the mechanism';
		const r = current();
		if(!r || !miniOf(r)) return null;
		const it = nearest();
		const m = miniOf(r);
		if(!it){
			if(m === 'vineSwing') return 'E — Grab a swinging vine';
			return null;
		}
		if(it.kind === 'jungleMemory' && m === 'sunMirror') return 'E — Study the preserved light';
		if(m === 'sluiceFlow' && it.solved) return 'E — This sluice already holds';
		const map = {
			rootRhythm:'E — Answer the living rhythm',
			sluiceFlow:'E — Study the water table',
			rootGrid:'E — Press the root lattice',
			sunMirror:'E — Turn the sun mirrors',
			flowerTiming: it._flowerOpen ? 'E — Touch the open bloom' : 'E — Wait for the bloom to open',
			predatorTrack:'E — Follow this sign',
			sporeId:'E — Choose this bloom',
			rootCut:'E — Cut this root',
			statueGaze:'E — Turn the guardian',
			currentRead:'E — Read the current',
			vineSwing:'E — Grab / release the vine',
			branchMemory:null
		};
		return map[m] || null;
	}

	function objective(r){
		if(!r || !miniOf(r) || r.cleared || r._jungleSolved) return '';
		const m = miniOf(r);
		const s = st(r);
		const lines = {
			rootRhythm:'WATCH THE CAPS, THEN REPEAT THE RHYTHM',
			sluiceFlow:'ROUTE WATER FROM SOURCE TO BASIN',
			rootGrid:'WAKE EVERY ROOT NODE',
			sunMirror:'BEND SUNLIGHT INTO THE CRYSTAL',
			flowerTiming:'TOUCH EACH FLOWER WHILE IT IS OPEN',
			predatorTrack:'FOLLOW THE PREDATOR’S TRAIL',
			sporeId:'MATCH THE SAFE SPORES YOU SAW',
			rootCut:'CUT THE HEART ROOT, THEN THE LESSER VEINS',
			statueGaze:'MAKE THE GUARDIAN BEAMS MEET THE SYMBOLS',
			branchMemory:'STAND ON THE LIVING BOUGHS WHEN THE CANOPY FALLS',
			vineSwing:'GRAB, SWING, RELEASE — LAND ON THE FAR ROOT',
			currentRead:'GUIDE THE SEED WITH THE ROOT GATES'
		};
		if(m === 'rootRhythm' && s && s.seq && s.stage === 'play') return 'REPEAT THE RHYTHM — ROUND ' + ((s.round||0)+1);
		if(m === 'flowerTiming' && s && s.need) return 'OPEN BLOOMS  ' + (s.got||0) + ' / ' + s.need;
		if(m === 'statueGaze' && s && s.needHits) return 'ALIGN THE GAZES';
		if(m === 'sluiceFlow' && sluiceNeedsSides(r)){
			const wheels = sluiceWheels(r);
			const done = wheels.filter(function(w){ return w.solved; }).length;
			return 'ROUTE BOTH SLUICES — ' + done + ' / ' + Math.max(2, wheels.length);
		}
		if(m === 'sunMirror' && r.kind === 'memory') return 'STUDY THE MURAL — BEND ITS LIGHT INTO THE CRYSTAL';
		return lines[m] || r.objective || '';
	}

	function update(){
		P.pulse++;
		for(let i = P.fx.length - 1; i >= 0; i--){ P.fx[i].life--; if(P.fx[i].life <= 0) P.fx.splice(i,1); }
		const k = keysOf();
		if(k['escape'] && !P.escLatch){ P.escLatch = true; if(P.overlay) closeOverlay(true); }
		if(!k['escape']) P.escLatch = false;
		if(clickEdge()) overlayClick();
		const r = current();
		if(!r || !miniOf(r) || r._jungleSolved) return;
		const m = miniOf(r);
		if(m === 'rootRhythm') rhythmTick(r);
		if(m === 'flowerTiming') flowerTick(r);
		if(m === 'sporeId') sporeTick(r);
		if(m === 'statueGaze') statueTick(r);
		if(m === 'branchMemory') branchTick(r);
		if(m === 'vineSwing') vineTick(r);
		if(m === 'currentRead') currentTick(r);
		if(m === 'predatorTrack'){ const s = st(r); if(s.hardT > 0) s.hardT--; }
	}

	function blocking(){ return !!P.overlay; }

	global.JunglePuzzles = {
		update:update,
		draw:drawWorld,
		drawOverlay:drawOverlay,
		tryInteract:tryInteract,
		prompt:prompt,
		objective:objective,
		onRoomEnter:onRoomEnter,
		cameraFocus:cameraFocus,
		blocking:blocking,
		tickVine:vineTickHazard,
		complete:complete
	};
})(typeof window !== 'undefined' ? window : globalThis);
