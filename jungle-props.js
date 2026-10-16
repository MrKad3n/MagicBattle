/* =============================================================
   The Living Wilds — jungle props from dedicated sheets.
   Structure / flora / trees / traps, fire-prop blit style, no background.
   Water, light shafts, clues, and motes stay procedural.
   ============================================================= */
(function(global){
	'use strict';

	const PROP = 80;
	const PROP_SCALE = 3;
	const VER = '11';
	const TILE = 40;

	const GRID = { props:4, flora:4, traps:4, light:4 };

	const PROP_CELLS = {
		treeRuin:[0,0,'props'], altar:[1,0,'props'], bloomRuin:[3,0,'props'],
		gate:[0,1,'props'], idol:[1,1,'props'], log:[2,1,'props'], pillar:[3,1,'props'],
		vine:[0,2,'props'], rootHang:[1,2,'props'], debris:[2,2,'props'], lantern:[3,2,'props'],
		bush:[0,3,'props'], mound:[1,3,'props'], fence:[2,3,'props'], stump:[3,3,'props'],

		mushroom:[0,0,'flora'], glowMushroom:[1,0,'flora'], giantFlower:[2,0,'flora'], lily:[3,0,'flora'],
		nest:[0,1,'flora'], flowers:[1,1,'flora'], flowersB:[2,1,'flora'], eggSac:[3,1,'flora'],
		tallMushroom:[0,2,'flora'], snag:[1,2,'flora'], fern:[2,2,'flora'], shroomLog:[3,2,'flora'],
		bounceCap:[0,3,'flora'], poisonBloom:[1,3,'flora'], sporePuff:[2,3,'flora'], orchid:[3,3,'flora'],
		carnivore:[0,1,'traps'],

		trapSnare:[0,0,'traps'], trapBranch:[1,0,'traps'], trapSpore:[2,0,'traps'], trapThorn:[3,0,'traps'],
		trapCarnivore:[0,1,'traps'], trapPoison:[1,1,'traps'], trapBounce:[2,1,'traps'], trapSwing:[3,1,'traps'],
		trapCrusher:[0,2,'traps'], trapMud:[1,2,'traps'], trapSpike:[2,2,'traps'], trapCloud:[3,2,'traps'],
		trapHang:[0,3,'traps'], trapHook:[1,3,'traps'], trapSkull:[2,3,'traps'], trapBramble:[3,3,'traps'],

		hangLantern:[0,0,'light'], sapCrystal:[1,0,'light'], biolumeLamp:[2,0,'light'], mossTorch:[3,0,'light'],
		glowOrchid:[0,1,'light'], sporeLantern:[1,1,'light'], heartwoodLamp:[2,1,'light'], fireflyNest:[3,1,'light'],
		glowLily:[1,2,'light'], rootLamp:[2,2,'light'], hangGlowVines:[3,2,'light'],
		limeGeode:[0,3,'light'], glowBowl:[1,3,'light'], canopyLamp:[2,3,'light'], tallBiolume:[3,3,'light'],
	};

	const TRAP_CELLS = {
		sporeBloom:'trapCloud',
		thornGrow:'trapThorn',
		colosseumFlower:'poisonBloom',
		fallingBranch:'trapBranch',
		sporePocket:'trapSpore',
		thornWall:'trapThorn',
		carnivorousPlant:'trapCarnivore',
		poisonFlower:'trapPoison',
		bounceMushroom:'trapBounce',
		swingingVine:'trapSwing',
		rootCrusher:'trapCrusher',
		sinkingMud:'trapMud',
	};

	function hash(n){
		n = Math.sin((Number(n) || 1) * 91.733) * 43758.5453;
		return n - Math.floor(n);
	}
	function now(){ return (typeof performance !== 'undefined' ? performance.now() : Date.now()) * 0.001; }
	function cam(){ return global.camera || { x:0, y:0 }; }
	function view(){ return global.canvas || { width:1920, height:1080 }; }
	function sx(p){ return p.x - cam().x; }
	function sy(p){ return p.y - cam().y; }
	function visible(p, pad){
		pad = pad || 160;
		const cvs = view();
		const x = sx(p), y = sy(p), w = p.w || p.r * 2 || 220, h = p.h || p.r * 2 || 220;
		return x + w > -pad && x < cvs.width + pad && y + h > -pad && y < cvs.height + pad;
	}

	function loadSheet(src){
		const el = new Image();
		el.src = src + '?v=' + VER;
		return el;
	}
	const sheets = {
		props: loadSheet('images/dungeon/jungle-props-sheet.png'),
		flora: loadSheet('images/dungeon/jungle-flora-sheet.png'),
		traps: loadSheet('images/dungeon/jungle-traps-sheet.png'),
		light: loadSheet('images/dungeon/jungle-light-sheet.png'),
	};
	const LIGHT_GLOW = {
		hangLantern:'rgba(180,255,90,.26)', sapCrystal:'rgba(150,255,110,.32)',
		biolumeLamp:'rgba(140,255,160,.30)', mossTorch:'rgba(255,210,80,.28)',
		glowOrchid:'rgba(220,255,120,.28)', sporeLantern:'rgba(160,255,90,.30)',
		heartwoodLamp:'rgba(120,255,140,.28)', fireflyNest:'rgba(230,255,90,.26)',
		glowLily:'rgba(170,255,140,.28)', rootLamp:'rgba(130,255,120,.26)',
		hangGlowVines:'rgba(150,255,110,.24)', limeGeode:'rgba(120,255,160,.32)',
		glowBowl:'rgba(200,255,90,.28)', canopyLamp:'rgba(180,255,100,.26)',
		tallBiolume:'rgba(110,255,150,.30)', lantern:'rgba(180,255,90,.26)',
		glowMushroom:'rgba(150,255,110,.28)', giantFlower:'rgba(255,240,110,.42)'
	};
	const TREE_IMGS = {
		giantTree: loadSheet('images/dungeon/jungle-tree-giant.png'),
		deadTree: loadSheet('images/dungeon/jungle-tree-dead.png'),
		heartwood: loadSheet('images/dungeon/jungle-tree-heartwood.png'),
		distantTree: loadSheet('images/dungeon/jungle-tree-distant.png'),
	};

	function readySheet(key){
		const im = sheets[key];
		return !!(im && im.complete && im.naturalWidth > 8);
	}
	function cellSize(key){
		const im = sheets[key];
		const g = GRID[key] || 4;
		return (im && im.naturalWidth > 8) ? (im.naturalWidth / g) : PROP;
	}
	function readyTree(name){
		const im = TREE_IMGS[name];
		return !!(im && im.complete && im.naturalWidth > 8);
	}

	function srcRect(name){
		if(TREE_IMGS[name]){
			if(!readyTree(name)) return null;
			const im = TREE_IMGS[name];
			return { im:im, sx:0, sy:0, sw:im.naturalWidth, sh:im.naturalHeight };
		}
		const cell = PROP_CELLS[name];
		if(!cell) return null;
		const key = cell[2] || 'props';
		if(!readySheet(key)) return null;
		const im = sheets[key];
		const src = cellSize(key);
		return { im:im, sx:cell[0]*src, sy:cell[1]*src, sw:src, sh:src };
	}

	const trimCache = Object.create(null);
	let trimCanvas = null;
	function trimRect(im, sx, sy, sw, sh){
		const key = (im.src || '') + '|' + sx + ',' + sy + ',' + sw + ',' + sh;
		if(trimCache[key]) return trimCache[key];
		const fallback = { sx:sx, sy:sy, sw:sw, sh:sh, padB:0 };
		if(!im.complete || sw < 2 || sh < 2) return fallback;
		try{
			if(!trimCanvas) trimCanvas = document.createElement('canvas');
			const c = trimCanvas;
			if(c.width !== sw) c.width = sw;
			if(c.height !== sh) c.height = sh;
			const g = c.getContext('2d', { willReadFrequently:true });
			g.clearRect(0, 0, sw, sh);
			g.drawImage(im, sx, sy, sw, sh, 0, 0, sw, sh);
			const data = g.getImageData(0, 0, sw, sh).data;
			let minx = sw, miny = sh, maxx = -1, maxy = -1;
			for(let y = 0; y < sh; y++){
				for(let x = 0; x < sw; x++){
					if(data[(y * sw + x) * 4 + 3] > 16){
						if(x < minx) minx = x;
						if(y < miny) miny = y;
						if(x > maxx) maxx = x;
						if(y > maxy) maxy = y;
					}
				}
			}
			trimCache[key] = maxx < 0 ? fallback : {
				sx: sx + minx, sy: sy + miny, sw: maxx - minx + 1, sh: maxy - miny + 1,
				padB: (sh - 1 - maxy) / sh,
			};
		}catch(e){
			trimCache[key] = fallback;
		}
		return trimCache[key];
	}

	function tileSolid(wx, wy){
		const fn = typeof isSolid === 'function' ? isSolid : global.isSolid;
		if(typeof fn !== 'function') return false;
		return !!fn(Math.floor(wx / TILE), Math.floor(wy / TILE));
	}
	function groundYAt(wx){
		let best = null;
		const d = (typeof dungeon !== 'undefined' && dungeon) || global.dungeon;
		if(!d) return null;
		const rooms = d.rooms || [];
		for(let i = 0; i < rooms.length; i++){
			const r = rooms[i];
			const cells = r.cells || [{ x:r.x, y:r.y, w:r.w, h:r.h }];
			for(let c = 0; c < cells.length; c++){
				const cell = cells[c];
				if(wx < cell.x + 4 || wx > cell.x + cell.w - 4) continue;
				const fy = cell.y + cell.h;
				if(best == null || fy > best) best = fy;
			}
			const solids = r.solids || [];
			for(let s = 0; s < solids.length; s++){
				const sl = solids[s];
				if(wx < sl.x + 4 || wx > sl.x + sl.w - 4) continue;
				if(best == null || sl.y > best) best = sl.y;
			}
		}
		return best;
	}
	function surfaceYNear(wx, aroundY){
		let best = null, bestD = 1e9;
		const d = (typeof dungeon !== 'undefined' && dungeon) || global.dungeon;
		if(d && d.platforms){
			for(let i = 0; i < d.platforms.length; i++){
				const p = d.platforms[i];
				if(!p || p._gone || p._jungleHidden || p.vineRung) continue;
				if(p.kind === 'move' || p.kind === 'raft' || p.kind === 'orbit' || p.vineLift) continue;
				if(wx < p.x + 4 || wx > p.x + p.w - 4) continue;
				const dist = Math.abs(p.y - aroundY);
				if(dist < 380 && dist < bestD){ bestD = dist; best = p.y; }
			}
		}
		if(best != null) return best;
		return groundYAt(wx);
	}
	function vineClipsWall(wx, wy, dw, dh){
		const ys = [wy + 10, wy + dh * 0.4, wy + dh * 0.75];
		for(let i = 0; i < ys.length; i++){
			const y = ys[i];
			const L = tileSolid(wx + 8, y);
			const R = tileSolid(wx + dw - 8, y);
			const C = tileSolid(wx + dw * 0.5, y);
			if((L || R) && !C) return true;
			if(L && R) return true;
		}
		return false;
	}

	function ellipse(ctx,x,y,rx,ry,color,alpha){
		ctx.save();
		if(alpha != null) ctx.globalAlpha = alpha;
		ctx.fillStyle = color;
		ctx.beginPath(); ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2); ctx.fill();
		ctx.restore();
	}
	function glow(ctx,x,y,r,color,a){
		const g = ctx.createRadialGradient(x,y,0,x,y,r);
		g.addColorStop(0, color || 'rgba(130,255,160,.35)');
		g.addColorStop(1, 'rgba(0,0,0,0)');
		ctx.fillStyle = g; ctx.globalAlpha = a == null ? 1 : a;
		ctx.fillRect(x-r, y-r, r*2, r*2); ctx.globalAlpha = 1;
	}
	function stoneBlock(ctx,x,y,w,h,broken,seed){
		const g = ctx.createLinearGradient(x,y,x,y+h);
		g.addColorStop(0,'#66705a'); g.addColorStop(.45,'#424d3a'); g.addColorStop(1,'#253126');
		ctx.fillStyle = g;
		if(broken){
			ctx.beginPath(); ctx.moveTo(x,y+h); ctx.lineTo(x+8,y+20); ctx.lineTo(x+w*.36,y);
			ctx.lineTo(x+w*.52,y+22); ctx.lineTo(x+w*.72,y+5); ctx.lineTo(x+w,y+30); ctx.lineTo(x+w,y+h); ctx.closePath(); ctx.fill();
		} else ctx.fillRect(x,y,w,h);
		ctx.strokeStyle = 'rgba(170,200,140,.22)'; ctx.lineWidth = 2;
		for(let yy = y+38; yy < y+h; yy += 42){ ctx.beginPath(); ctx.moveTo(x,yy); ctx.lineTo(x+w,yy); ctx.stroke(); }
		ctx.fillStyle = 'rgba(70,120,55,.65)';
		const s = seed != null ? seed : (w * 13 + h * 7);
		for(let i = 0; i < Math.max(2, w/90); i++) ctx.fillRect(x+hash(s+i)*w, y+hash(s+i+3)*h, 10+hash(i+8)*24, 4);
	}

	function blitProp(ctx, name, dx, dy, dw, dh, flip, align){
		const src = srcRect(name);
		if(!src) return false;
		const t = trimRect(src.im, src.sx, src.sy, src.sw, src.sh);
		dw = Math.max(8, dw || t.sw);
		dh = Math.max(8, dh || t.sh);
		let destY = dy;
		if(align !== 'hang' && align !== 'raw'){
			destY = dy + t.padB * dh + Math.max(4, dh * 0.06);
		}
		if(flip){
			ctx.save();
			ctx.translate(dx + dw, destY);
			ctx.scale(-1, 1);
			ctx.drawImage(src.im, t.sx, t.sy, t.sw, t.sh, 0, 0, dw, dh);
			ctx.restore();
		} else {
			ctx.drawImage(src.im, t.sx, t.sy, t.sw, t.sh, dx, destY, dw, dh);
		}
		return true;
	}

	function blitFit(ctx, name, x, y, w, h, flip){
		let dw = Math.max(24, w), dh = Math.max(24, h);
		const im = TREE_IMGS[name];
		if(im && im.naturalWidth > 8){
			const ar = im.naturalWidth / im.naturalHeight;
			dh = h;
			dw = Math.min(w, h * ar);
		} else if(dw / dh > 0.88){
			dw = Math.min(w, h * 0.7);
		}
		return blitProp(ctx, name, x + (w - dw) * 0.5, y + h - dh, dw, dh, flip, 'floor');
	}

	function specFor(p){
		if(p._jgSpec !== undefined) return p._jgSpec;
		const type = p.type || '';
		let spec;
		if(!type) spec = { name:'bush', tile:'x' };
		else if(/Waterfall|Stream|Pool|WaterChannel|Swamp|WaterDrips/.test(type)) spec = null;
		else if(/LightShaft|SunBeam|Mist|Fog|Fireflies|Butterflies|BirdFlock|TreasureGlow|CleanAir|MemoryEchoes/.test(type)) spec = null;
		else if(/Clue|Eyes|Tracks|Marks|Letters|FlowClue|BloomClue|FlowerClue|MechanismClue/.test(type)) spec = null;
		else if(/HangLantern/.test(type)) spec = { name:'hangLantern', hang:true };
		else if(/CanopyLamp/.test(type)) spec = { name:'canopyLamp', hang:true };
		else if(/GlowOrchid/.test(type)) spec = { name:'glowOrchid', hang:true };
		else if(/HangGlow/.test(type)) spec = { name:'hangGlowVines', hang:true };
		else if(/SporeLantern/.test(type)) spec = { name:'sporeLantern', hang:true };
		else if(/SapCrystal/.test(type)) spec = { name:'sapCrystal' };
		else if(/MossTorch/.test(type)) spec = { name:'mossTorch' };
		else if(/HeartwoodLamp/.test(type)) spec = { name:'heartwoodLamp' };
		else if(/FireflyNest/.test(type)) spec = { name:'fireflyNest' };
		else if(/GlowLily/.test(type)) spec = { name:'glowLily' };
		else if(/RootLamp/.test(type)) spec = { name:'rootLamp' };
		else if(/LimeGeode/.test(type)) spec = { name:'limeGeode' };
		else if(/GlowBowl/.test(type)) spec = { name:'glowBowl' };
		else if(/TallBiolume|BiolumeLamp/.test(type)) spec = { name:'tallBiolume' };
		else if(/Lily/.test(type)) spec = { name:'lily', tile:'x' };
		else if(/BiolumeField/.test(type)) spec = null;
		else if(/MushroomForest/.test(type)) spec = { name:'mushroom', tile:'forest' };
		else if(/GlowMushroom|Biolume/.test(type)) spec = { name:'glowMushroom', tile:'x' };
		else if(/Mushroom/.test(type)) spec = { name:'mushroom', tile:'x' };
		else if(/FlowerField/.test(type)) spec = { name: p.giant ? 'giantFlower' : 'flowers', tile: p.giant ? 'fieldGiant' : 'x' };
		else if(/GiantFlower|DormantBloom/.test(type)) spec = { name:'giantFlower', fit:true };
		else if(/Carnivore/.test(type)) spec = { name:'carnivore', tile:'x' };
		else if(/EggSac/.test(type)) spec = { name:'eggSac' };
		else if(/TreeInterior/.test(type)) spec = null;
		else if(/DeadTree/.test(type)) spec = { name:'deadTree', fit:true };
		else if(/DistantTree/.test(type)) spec = { name:'distantTree', fit:true };
		else if(/Heartwood|BossHeart/.test(type)) spec = { name:'heartwood', fit:true };
		else if(/GiantTree/.test(type)) spec = { name: p.ancient ? 'heartwood' : 'giantTree', fit:true };
		else if(/Tree/.test(type)) spec = { name:'giantTree', fit:true };
		else if(/CanopyVista|DistantVista/.test(type)) spec = { name:'distantTree', tile:'vista' };
		else if(/CanopyHut|CanopyTemple/.test(type)) spec = { name:'gate' };
		else if(/Arch|Gate|VaultDoor|WorldrootGate/.test(type)) spec = { name:'gate' };
		else if(/Statue|Guardian|StoneMarker/.test(type)) spec = { name:'idol' };
		else if(/Temple|Facade|RuinWall|Flooded|Buried|Shrine|Mural|DistantRuin/.test(type)) spec = { name:'pillar' };
		else if(/RootArch|Veins/.test(type)) spec = { name:'rootHang', hang:true, stack:true };
		else if(/FallenLog|RootMass|RootHeart|RootMaze|RootChasm|RootBridge|RootDoor|SuspiciousRoot|ConnectorRoots/.test(type)) spec = { name:'log' };
		else if(/Vine|Hanging|Wilted|Web/.test(type)) spec = { name:'vine', hang:true, stack:true };
		else if(/Canopy|Grove|Spectacle|StormRoost|BranchNetwork|Chasm/.test(type)) spec = { name:'bush', tile:'x' };
		else if(/Moss/.test(type)) spec = { name:'mound', tile:'x' };
		else if(/Nest/.test(type)) spec = { name:'nest', fit:true };
		else if(/Bones|Warning/.test(type)) spec = { name:'trapSkull' };
		else if(/OfferingAltar|Altar/.test(type)) spec = { name:'altar' };
		else if(/SunMirror|WaterWheel/.test(type)) spec = null;
		else if(/Mechanism|DrainGate/.test(type)) spec = { name:'fence' };
		else if(/Lantern/.test(type)) spec = { name:'lantern', hang:true };
		else spec = { name:'bush' };
		p._jgSpec = spec;
		return spec;
	}

	function describe(p){
		if(!p) return '';
		const spec = specFor(p);
		const type = p.type || '?';
		if(!spec) return type + ' (vfx)';
		const bits = [type, '→', spec.name];
		if(spec.fit) bits.push('(one prop)');
		if(spec.tile) bits.push('tiled:' + spec.tile);
		if(p.w && p.h) bits.push(Math.round(p.w) + 'x' + Math.round(p.h));
		return bits.join(' ');
	}

	function drawHangStack(ctx, p, name){
		const w = Math.max(24, p.w || 80), h = Math.max(40, p.h || 160);
		const sink = Math.min(128, 96 + Math.min(32, h * 0.12));
		const bury = Math.min(52, 24 + Math.min(20, h * 0.06));
		const worldTop = p.y - sink;
		const usable = Math.max(90, h + sink + bury);
		const dw = 84;
		let cols, rows, dh, stepX, stepY;
		if(w > h * 0.9){
			dh = Math.min(330, Math.max(190, usable));
			rows = usable > 430 ? 2 : 1;
			if(rows === 2) dh = 220;
			cols = Math.min(18, Math.max(1, Math.round(w / 72)));
			stepX = cols <= 1 ? 0 : Math.max(52, (w - dw) / (cols - 1));
			stepY = 70;
			while(cols * rows > 28){ if(rows > 1) rows--; else cols--; }
		} else {
			cols = w < 160 ? 1 : 2;
			stepX = cols <= 1 ? 0 : Math.min(72, Math.max(48, (w - dw) / (cols - 1)));
			dh = 200;
			stepY = 72;
			rows = Math.max(1, Math.floor((usable - dh) / stepY) + 1);
			if(rows > 7) rows = 7;
		}
		const spanX = (cols - 1) * stepX;
		const worldStartX = p.x + (w - spanX - dw) * 0.5;
		for(let r = 0; r < rows; r++){
			for(let c = 0; c < cols; c++){
				const jx = (hash(c * 11 + r + p.x) - 0.5) * 8;
				let wx = worldStartX + c * stepX + jx;
				let wy = worldTop + r * stepY;
				if(vineClipsWall(wx, wy, dw, dh)){
					const tries = [wy - 40, wy + 40, wy - 80, wy + 80, wy - 120, wy + 120];
					let ok = false;
					for(let t = 0; t < tries.length; t++){
						if(!vineClipsWall(wx, tries[t], dw, dh)){ wy = tries[t]; ok = true; break; }
					}
					if(!ok) continue;
				}
				blitProp(ctx, name, wx - cam().x, wy - cam().y, dw, dh, hash(c + r * 5 + p.x) > 0.5, 'hang');
			}
		}
	}

	function tileRow(ctx, p, pickName, opts){
		opts = opts || {};
		const x = sx(p), y = sy(p), w = p.w || 240, h = p.h || 160;
		const maxN = opts.maxN || 16;
		const dw = opts.dw || 160;
		const n = Math.min(maxN, Math.max(1, Math.round(w / Math.max(70, opts.step || (dw * 0.78)))));
		const step = n <= 1 ? 0 : (w - dw) / (n - 1);
		const start = x + (w - ((n - 1) * step + dw)) * 0.5;
		for(let i = 0; i < n; i++){
			const name = typeof pickName === 'function' ? pickName(i, p) : pickName;
			const dh = opts.dhFor ? opts.dhFor(i, p, h) : Math.min(h, opts.dh || h);
			let destY = y + h - dh;
			if(opts.snap){
				const wx = p.x + (start - x) + i * step + dw * 0.5;
				const surf = opts.snap === 'ground' ? groundYAt(wx) : surfaceYNear(wx, p.y + h);
				if(surf != null) destY = surf - cam().y - dh + 4;
			}
			blitProp(ctx, name, start + i * step, destY, dw, dh, hash(i + p.x) > 0.5);
		}
	}

	function drawFromSpec(ctx, p, spec){
		const x = sx(p), y = sy(p), w = p.w || 240, h = p.h || 240;
		const dest = PROP * PROP_SCALE;
		const type = p.type || '';
		if(spec.stack){
			drawHangStack(ctx, p, spec.name);
			return true;
		}
		if(spec.hang){
			const useW = Math.min(w, dest);
			const useH = Math.min(Math.max(h, dest), dest + 40);
			blitProp(ctx, spec.name, x + (w - useW) / 2, y - 78, useW, useH, hash(p.x) > 0.5, 'hang');
			if(LIGHT_GLOW[spec.name]) glow(ctx, x + w / 2, y + 36, Math.min(140, Math.max(w, h) * 0.45), LIGHT_GLOW[spec.name]);
			return true;
		}
		if(spec.fit){
			blitFit(ctx, spec.name, x, y, w, h, hash(p.x) > 0.5);
			if(spec.name === 'heartwood' || type.indexOf('Heart') >= 0){
				const pulse = .88 + Math.sin(now() * 2.2 + p.x) * .1;
				glow(ctx, x + w / 2, y + h * .48, Math.min(160, Math.max(w, h) * .18 * pulse), 'rgba(80,255,150,.16)');
			} else if(LIGHT_GLOW[spec.name]){
				const pulse = .86 + Math.sin(now() * 2.5 + p.x) * .14;
				const strong = spec.name === 'giantFlower' && (p.glow || p.boss);
				const rad = strong ? Math.max(220, Math.max(w, h) * 1.45 * pulse) : Math.min(140, Math.max(w, h) * 0.22);
				glow(ctx, x + w / 2, y + h * 0.42, rad, strong ? 'rgba(255,245,140,.55)' : LIGHT_GLOW[spec.name]);
				if(strong) glow(ctx, x + w / 2, y + h * 0.38, rad * 0.42, 'rgba(255,255,200,.62)');
			}
			return true;
		}
		if(spec.tile === 'forest'){
			const n = Math.min(16, Math.max(4, Math.round(w / 118)));
			const dw = 168;
			const step = n <= 1 ? 0 : (w - dw) / (n - 1);
			const startW = p.x + (w - ((n - 1) * step + dw)) * 0.5;
			for(let i = 0; i < n; i++){
				const roll = hash(i * 17 + p.x);
				const name = roll > 0.62 ? 'tallMushroom' : (roll > 0.28 ? 'mushroom' : 'shroomLog');
				const dh = name === 'tallMushroom' ? 260 + hash(i + 3) * 90 : (name === 'shroomLog' ? 58 + hash(i + 9) * 28 : 140 + hash(i + 9) * 50);
				const wx = startW + i * step + (hash(i + 4) - 0.5) * 18;
				const ground = groundYAt(wx + dw * 0.5);
				const sink = name === 'shroomLog' ? 46 : 4;
				const destY = (ground != null ? ground : (p.y + h)) - dh + sink;
				blitProp(ctx, name, wx - cam().x, destY - cam().y, dw, dh, hash(i + p.x) > 0.5);
			}
			return true;
		}
		if(spec.tile === 'vista'){
			const n = Math.min(4, Math.max(1, Math.round(w / 700)));
			const dw = Math.min(720, w / n);
			const step = n <= 1 ? 0 : (w - dw) / (n - 1);
			for(let i = 0; i < n; i++){
				blitFit(ctx, spec.name, x + i * step, y, dw, h, hash(i + p.x) > 0.5);
			}
			return true;
		}
		if(spec.tile === 'fieldGiant'){
			tileRow(ctx, p, function(i){
				return hash(i + p.x) > 0.45 ? 'giantFlower' : (hash(i) > 0.5 ? 'flowersB' : 'flowers');
			}, { dw:200, maxN:12, dhFor:function(i, pp, hh){ return Math.min(hh, 220 + hash(i) * 160); } });
			return true;
		}
		if(spec.tile === 'x'){
			const dw = spec.name === 'lily' ? 120 : spec.name === 'glowMushroom' ? 150 : spec.name === 'mound' ? 180 : 160;
			tileRow(ctx, p, function(i){
				if(spec.name === 'glowMushroom') return hash(i) > 0.7 ? 'tallMushroom' : 'glowMushroom';
				if(spec.name === 'flowers') return hash(i) > 0.55 ? 'flowersB' : (hash(i + 3) > 0.82 ? 'fern' : 'flowers');
				if(spec.name === 'mushroom') return hash(i) > 0.55 ? 'tallMushroom' : 'mushroom';
				return spec.name;
			}, {
				dw:dw, maxN:16,
				snap:(spec.name === 'glowMushroom' || spec.name === 'mushroom' || spec.name === 'lily') ? 'near' : null,
				dhFor:function(i, pp, hh){
					if(spec.name === 'mound') return Math.max(28, Math.min(hh, 48));
					if(spec.name === 'lily') return Math.max(36, Math.min(hh, 70));
					if(spec.name === 'glowMushroom') return Math.min(hh, 110 + hash(i) * 50);
					if(spec.name === 'carnivore') return Math.min(hh, 200 + hash(i) * 80);
					return Math.min(hh, Math.max(90, hh));
				}
			});
			return true;
		}
		const useW = Math.min(w, dest);
		const useH = Math.min(h, dest + 40);
		blitProp(ctx, spec.name, x + (w - useW) / 2, y + h - useH, useW, useH, hash(p.x) > 0.5);
		if(LIGHT_GLOW[spec.name]) glow(ctx, x + w / 2, y + h - useH * 0.45, Math.min(150, Math.max(useW, useH) * 0.5), LIGHT_GLOW[spec.name]);
		return true;
	}

	function drawWater(ctx,p,x,y,w,h){
		const t = now(), isFall = p.type.indexOf('Waterfall') >= 0;
		ctx.save();
		if(isFall){
			const g = ctx.createLinearGradient(x,y,x+w,y);
			g.addColorStop(0,'rgba(80,190,195,.08)'); g.addColorStop(.35,'rgba(125,235,220,.55)');
			g.addColorStop(.6,'rgba(220,255,225,.72)'); g.addColorStop(1,'rgba(50,145,165,.08)');
			ctx.fillStyle = g; ctx.globalAlpha = p.alpha == null ? .72 : p.alpha; ctx.fillRect(x,y,w,h);
			ctx.globalAlpha = .55;
			for(let i = 0; i < 7; i++){
				const xx = x + ((i * 61 + p.x) % w), off = Math.sin(t * 2 + i) * 15;
				ctx.fillStyle = 'rgba(220,255,240,.35)'; ctx.fillRect(xx + off, y, 3 + hash(i) * 7, h);
			}
			ctx.globalAlpha = 1;
			for(let i = 0; i < 12; i++) ellipse(ctx, x + hash(i + p.x) * w, y + h - 8 - hash(i + 8) * 30, 5 + hash(i) * 12, 3 + hash(i + 2) * 5, 'rgba(190,255,235,.65)');
		} else {
			const g = ctx.createLinearGradient(x,y,x,y+h);
			g.addColorStop(0,'rgba(85,190,155,.72)'); g.addColorStop(.35,'rgba(34,111,94,.72)'); g.addColorStop(1,'rgba(6,39,39,.9)');
			ctx.fillStyle = g; ctx.globalAlpha = .82; ctx.fillRect(x,y,w,h); ctx.globalAlpha = 1;
			ctx.strokeStyle = 'rgba(180,255,210,.42)'; ctx.lineWidth = 2;
			for(let i = 0; i < Math.max(4, w / 160); i++){
				const yy = y + 8 + (i % 3) * 12, xx = x + ((i * 137 + t * 22) % Math.max(1, w));
				ctx.beginPath(); ctx.moveTo(xx, yy); ctx.quadraticCurveTo(xx + 25, yy - 5, xx + 55, yy); ctx.stroke();
			}
		}
		ctx.restore();
	}

	function drawClue(ctx,p,x,y,w,h){
		ctx.save(); ctx.font = 'bold 18px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
		if(p.type.indexOf('Eyes') >= 0){
			glow(ctx, x+w/2, y+h/2, w*.7, 'rgba(220,240,80,.12)');
			ellipse(ctx, x+w*.38, y+h*.5, 7, 4, '#e9f56c'); ellipse(ctx, x+w*.62, y+h*.5, 7, 4, '#e9f56c');
		} else if(p.type.indexOf('Claw') >= 0 || p.type.indexOf('Tracks') >= 0){
			ctx.strokeStyle = 'rgba(201,218,155,.62)'; ctx.lineWidth = 5;
			for(let i = 0; i < 4; i++){ ctx.beginPath(); ctx.moveTo(x+i*34, y); ctx.lineTo(x+20+i*34, y+h); ctx.stroke(); }
		} else if(p.type.indexOf('BloomClue') >= 0){
			ctx.fillStyle = p.color || '#d9ed75';
			ctx.fillText('✦', x+w/2, y+h/2);
		} else if(p.type.indexOf('MechanismClue') >= 0 || p.states || (p.targets && p.labels)){
			stoneBlock(ctx, x, y, w, h, true);
			ctx.fillStyle = '#12180f'; ctx.fillRect(x+12, y+12, w-24, h-24);
			ctx.strokeStyle = '#c6e38a'; ctx.lineWidth = 2; ctx.strokeRect(x+18, y+18, w-36, h-36);
			ctx.fillStyle = '#e8f6b4';
			ctx.font = 'bold ' + Math.max(13, Math.min(18, w/24)) + 'px monospace';
			ctx.fillText('THE RIVER REMEMBERS THE WAY', x+w/2, y+h*.45);
			ctx.fillStyle = '#9dcc6a';
			ctx.font = '12px monospace';
			ctx.fillText('Watch how the water wants to run', x+w/2, y+h*.68);
		} else {
			ctx.fillStyle = 'rgba(210,235,160,.72)';
			ctx.fillText('⌁  ◇  ⌁', x+w/2, y+h/2);
		}
		ctx.restore();
	}

	function drawProp(ctx,p){
		if(!p || !visible(p)) return;
		const x = sx(p), y = sy(p), w = p.w || 220, h = p.h || 220, type = p.type || '';
		ctx.save();
		ctx.imageSmoothingEnabled = false;
		if(p.alpha != null) ctx.globalAlpha = p.alpha;

		if(type.indexOf('WaterDrips') >= 0){
			const t = now();
			ctx.save();
			ctx.strokeStyle = 'rgba(170,230,210,.4)';
			ctx.lineWidth = 2;
			for(let i = 0; i < 9; i++){
				const xx = x + ((i * 73 + p.x) % Math.max(8, w));
				const len = 18 + hash(i + 4) * 26;
				const oy = (t * 70 + hash(i) * 80) % Math.max(24, h);
				ctx.globalAlpha = 0.28 + hash(i + 2) * 0.35;
				ctx.beginPath();
				ctx.moveTo(xx, y + oy);
				ctx.lineTo(xx + Math.sin(t + i) * 2, y + oy + len);
				ctx.stroke();
			}
			ctx.restore();
		} else if(type === 'jgLightShaft' || type === 'jgSunBeam'){
			const g = ctx.createLinearGradient(x, y, x, y+h);
			g.addColorStop(0, 'rgba(239,255,190,.28)'); g.addColorStop(1, 'rgba(159,225,130,0)');
			ctx.fillStyle = g; ctx.beginPath();
			ctx.moveTo(x+w*.2, y); ctx.lineTo(x+w*.8, y); ctx.lineTo(x+w, y+h); ctx.lineTo(x, y+h); ctx.closePath(); ctx.fill();
		} else if(type.indexOf('Waterfall') >= 0 || type.indexOf('Stream') >= 0 || type.indexOf('Pool') >= 0 ||
			type.indexOf('WaterChannel') >= 0 || type.indexOf('Swamp') >= 0){
			const vfx = type.indexOf('Waterfall') >= 0;
			const fluidReady = typeof DungeonFluid !== 'undefined' && DungeonFluid.ready;
			if(vfx || !(p._fluidConsumed || fluidReady)) drawWater(ctx, p, x, y, w, h);
		} else if(type.indexOf('Clue') >= 0 || type.indexOf('Eyes') >= 0 || type.indexOf('Tracks') >= 0 ||
			type.indexOf('Marks') >= 0 || type.indexOf('Letters') >= 0){
			drawClue(ctx, p, x, y, w, h);
		} else if(type.indexOf('Mist') >= 0 || type.indexOf('Fog') >= 0){
			ctx.fillStyle = 'rgba(107,174,151,.10)';
			ctx.fillRect(x, y, w, h);
		} else if(type.indexOf('BiolumeField') >= 0){
			const t = now();
			ctx.fillStyle = '#c8ff9a';
			for(let i = 0; i < 18; i++){
				const px = x + ((hash(i + p.x) * w + t * (6 + i % 4) * 8) % w);
				const py = y + hash(i + p.y) * h + Math.sin(t * 1.4 + i) * 12;
				ctx.globalAlpha = 0.12 + hash(i + 3) * 0.22;
				ctx.beginPath(); ctx.arc(px, py, 2 + hash(i + 8) * 2.2, 0, Math.PI * 2); ctx.fill();
			}
			ctx.globalAlpha = 1;
		} else if(type.indexOf('Fireflies') >= 0 || type.indexOf('Butterflies') >= 0 || type.indexOf('BirdFlock') >= 0){
			const t = now();
			ctx.fillStyle = type.indexOf('Bird') >= 0 ? 'rgba(18,35,24,.65)' : '#e2ff81';
			for(let i = 0; i < 10; i++){
				const px = x + ((hash(i+p.x) * w + t * (8 + i%3) * 10) % w);
				const py = y + hash(i+p.y) * h + Math.sin(t * 1.7 + i) * 15;
				ctx.fillRect(px, py, 3, 3);
			}
		} else if(type.indexOf('MemoryEchoes') >= 0){
			const tt = now();
			ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
			ctx.font = 'bold 18px serif';
			for(let i = 0; i < 4; i++){
				const px = x + w * (.12 + hash(i+p.x) * .76);
				const py = y + h * (.18 + hash(i+p.y+31) * .64) + Math.sin(tt * .55 + i) * 6;
				ctx.globalAlpha = .14 + hash(i+17) * .12;
				ctx.fillStyle = i%2 ? '#d9ffc1' : '#88dca8';
				ctx.fillText(['⌘','◌','⌁','◇'][i%4], px, py);
			}
			ctx.globalAlpha = 1;
		} else if(type.indexOf('Treasure') >= 0 || type === 'jgGlow' || type.indexOf('CleanAir') >= 0){
			glow(ctx, x+w/2, y+h/2, Math.min(90, p.r || Math.max(w,h)*.35), type.indexOf('Treasure') >= 0 ? 'rgba(255,220,91,.28)' : 'rgba(111,255,187,.18)');
		} else {
			const spec = specFor(p);
			if(spec){
				drawFromSpec(ctx, p, spec);
				if(spec.tile && LIGHT_GLOW[spec.name]){
					glow(ctx, x + w / 2, y + h * 0.45, Math.min(160, Math.max(w, h) * 0.28), LIGHT_GLOW[spec.name]);
				}
			}
		}
		ctx.restore();
	}

	function drawHazard(ctx, h){
		const name = TRAP_CELLS[h.type];
		if(!name || !readySheet('traps')) return false;
		if(!visible(h, 220)) return true;
		const x = sx(h), y = sy(h), t = now();
		ctx.save();
		ctx.imageSmoothingEnabled = false;
		if(h.type === 'rootSnare'){
			const lift = h.hot ? -h.h * 0.35 : 0;
			blitProp(ctx, name, x, y + lift, h.w, h.h + (h.hot ? h.h * 0.4 : 0), false);
			if(h.warnOn && !h.hot){ ctx.fillStyle = 'rgba(222,183,76,.22)'; ctx.fillRect(x, y + h.h - 8, h.w, 8); }
		} else if(h.type === 'thornWall'){
			ctx.globalAlpha = h.hot ? 1 : (h.warnOn ? 0.7 : 0.55);
			const seg = 110;
			for(let yy = 0; yy < h.h; yy += seg){
				if(h.gapY && h.y + yy > h.gapY && h.y + yy < h.gapY + h.gapH) continue;
				blitProp(ctx, name, x, y + yy, h.w, Math.min(seg + 8, h.h - yy), false, 'raw');
			}
			ctx.globalAlpha = 1;
		} else if(h.type === 'poisonFlower'){
			const cx = x + h.w / 2, cy = y + h.h / 2, r = h.cloudR || 140;
			blitProp(ctx, name, x, y, h.w, h.h);
			if(h.hot){
				ctx.fillStyle = 'rgba(177,207,70,.28)';
				ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
			} else if(h.warnOn){
				ctx.strokeStyle = 'rgba(228,239,112,.72)'; ctx.lineWidth = 3;
				ctx.beginPath(); ctx.arc(cx, cy, 45 + Math.sin(t * 8) * 8, 0, Math.PI * 2); ctx.stroke();
			}
		} else if(h.type === 'fallingBranch'){
			const iy = h.impactY - cam().y;
			if(h.warnOn){
				ctx.fillStyle = 'rgba(5,10,5,.42)';
				ctx.beginPath(); ctx.ellipse(x + h.w / 2, iy, h.w * .48, 16, 0, 0, Math.PI * 2); ctx.fill();
			}
			const by = y + (h.impactY - h.y) * (h.fallP || 0);
			ctx.strokeStyle = '#2a2114'; ctx.lineWidth = 5; ctx.lineCap = 'round';
			ctx.beginPath(); ctx.moveTo(x + h.w * .5, y - 6); ctx.lineTo(x + h.w * .5, by + 4); ctx.stroke();
			blitProp(ctx, name, x, by, h.w, Math.max(h.h, 72), false, 'raw');
		} else if(h.type === 'swingingVine'){
			const bx = (h.bobX || h.x) - cam().x, by = (h.bobY || h.y) - cam().y;
			ctx.strokeStyle = '#4f8e3e'; ctx.lineWidth = 8;
			ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(bx, by); ctx.stroke();
			blitProp(ctx, name, bx - 36, by - 36, 72, 72, false, 'raw');
		} else if(h.type === 'carnivorousPlant'){
			const open = h.hot ? 1.12 : (h.warnOn ? 1.06 : 1);
			const dw = h.w * open, dh = h.h;
			blitProp(ctx, name, x + (h.w - dw) / 2, y + h.h - dh, dw, dh);
		} else if(h.type === 'sporePocket'){
			blitProp(ctx, name, x, y, h.w, h.h);
			ctx.fillStyle = h.hot ? 'rgba(184,211,91,.3)' : 'rgba(105,126,62,.12)';
			ctx.beginPath(); ctx.arc(x + h.w / 2, y + h.h / 2, h.hot ? 115 : 28, 0, Math.PI * 2); ctx.fill();
			if(h.hot){
				for(let i = 0; i < 8; i++){
					ctx.fillStyle = 'rgba(218,234,129,.6)';
					ctx.beginPath(); ctx.arc(x + h.w / 2 + Math.sin(t + i) * 40, y + h.h / 2 + Math.cos(t * 1.3 + i) * 35, 3, 0, Math.PI * 2); ctx.fill();
				}
			}
		} else if(h.type === 'sinkingMud'){
			const cols = Math.max(1, Math.round(h.w / 140));
			const dw = h.w / cols;
			for(let i = 0; i < cols; i++) blitProp(ctx, name, x + i * dw, y, dw, h.h);
			if(h.hot){
				ctx.fillStyle = 'rgba(31,28,15,.18)';
				ctx.fillRect(x, y, h.w, h.h);
			}
		} else if(h.type === 'rootCrusher'){
			ctx.globalAlpha = h.hot ? 1 : (h.warnOn ? 0.75 : 0.55);
			const len = Math.max(90, h.h * (h.extend || 0.12));
			blitProp(ctx, name, x, y, h.w, len, false, 'hang');
			ctx.globalAlpha = 1;
			if(h.warnOn && !h.hot){ ctx.fillStyle = 'rgba(218,186,91,.22)'; ctx.fillRect(x, y + h.h - 16, h.w, 16); }
		} else if(h.type === 'bounceMushroom'){
			const pulse = 1 + Math.sin(t * 5 + h.x) * 0.08;
			const dw = h.w * pulse, dh = h.h * pulse;
			const nm = h.flower ? 'giantFlower' : name;
			blitProp(ctx, nm, x + (h.w - dw) / 2, y + h.h - dh, dw, dh);
		} else {
			ctx.restore();
			return false;
		}
		ctx.restore();
		return true;
	}

	function drawRegionAtmosphere(ctx, section){
		const t = now();
		ctx.save();
		const cvs = view();
		if(section === 1){
			ctx.fillStyle = 'rgba(181,225,123,.035)'; ctx.fillRect(0,0,cvs.width,cvs.height);
		} else if(section === 2){
			ctx.fillStyle = 'rgba(20,77,49,.08)'; ctx.fillRect(0,0,cvs.width,cvs.height);
		} else if(section === 3){
			const g = ctx.createLinearGradient(0,0,0,cvs.height);
			g.addColorStop(0, 'rgba(98,183,183,.11)'); g.addColorStop(1, 'rgba(6,40,40,.05)');
			ctx.fillStyle = g; ctx.fillRect(0,0,cvs.width,cvs.height);
		} else if(section === 4){
			ctx.fillStyle = 'rgba(35,39,70,.09)'; ctx.fillRect(0,0,cvs.width,cvs.height);
		}
		const color = section === 4 ? 'rgba(117,255,207,.4)' : section === 3 ? 'rgba(185,245,225,.28)' : 'rgba(191,226,113,.25)';
		ctx.fillStyle = color;
		const motes = section === 4 ? 10 : 16;
		for(let i = 0; i < motes; i++){
			const px = ((hash(i*11+section) * cvs.width + t * (4+i%4) * 9) % cvs.width);
			const py = ((hash(i*17+section) * cvs.height - t * (3+i%3) * 5 + cvs.height) % cvs.height);
			ctx.globalAlpha = .25 + hash(i) * .55;
			ctx.beginPath(); ctx.arc(px, py, 1 + hash(i+8) * 2.4, 0, Math.PI*2); ctx.fill();
		}
		ctx.restore();
	}

	global.JungleProps = {
		draw: drawProp,
		drawHazard: drawHazard,
		drawRegionAtmosphere: drawRegionAtmosphere,
		specFor: specFor,
		describe: describe,
	};
})(typeof window !== 'undefined' ? window : globalThis);
