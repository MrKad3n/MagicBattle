/* =============================================================
   Dungeon interactable props — sheet sprites + nearby-prop binding.
   Replaces the emoji boxes. If a themed decoration already sits on
   or next to an interactable, that decoration is the art.
   ============================================================= */
(function(global){
	'use strict';

	const VER = '5';
	const GRID = 4;

	function loadSheet(src){
		const el = new Image();
		el.src = src + '?v=' + VER;
		return el;
	}
	const sheets = {
		jungle: loadSheet('images/dungeon/jungle-interact-sheet.png'),
		fire: loadSheet('images/dungeon/fire-interact-sheet.png'),
		ice: loadSheet('images/dungeon/ice-interact-sheet.png')
	};
	const CELLS = {
		jungle: {
			sluice:[0,0], mirror:[1,0], statue:[2,0], growth:[3,0],
			mushroom:[0,1], flower:[1,1], lever:[2,1], shrine:[3,1],
			nest:[0,2], offering:[1,2], vineLift:[2,2], tablet:[3,2],
			heart:[0,3], bark:[1,3], rootSwitch:[2,3], egg:[3,3]
		},
		fire: {
			valve:[0,0], lever:[1,0], shrine:[2,0], furnace:[3,0],
			risk:[0,1], trial:[1,1], cool:[2,1], siphon:[3,1],
			rock:[0,2], destroy:[1,2], overload:[2,2], bell:[3,2],
			hiddenSiphon:[0,3], gauge:[1,3], plaque:[2,3], lantern:[3,3]
		},
		ice: {
			shrine:[0,0], hearth:[1,0], ring:[2,0], relic:[3,0],
			prison:[0,1], trial:[1,1], cracked:[2,1], warming:[3,1],
			lever:[0,2], tablet:[1,2], lantern:[2,2], idol:[3,2],
			valve:[0,3], memory:[1,3], offering:[2,3], brazier:[3,3]
		}
	};

	const SKIP = { banner:1, miniBossBanner:1, doorSign:1, secretWall:1 };

	const BIND_RULES = [
		{ kinds:{ statueNode:1 }, type:/GuardianStatue|jgStatue|Idol/, maxW:280, maxH:340 },
		{ kinds:{ mushroomNode:1, sporeHeart:1 }, type:/GlowMushroom/, maxW:340, maxH:180 },
		{ kinds:{ flowerNode:1, sporeFlower:1 }, type:/GiantFlower|DormantBloom|WiltedFlower/, maxW:280, maxH:280 },
		{ kinds:{ rootCore:1, rootStrand:1 }, type:/RootMass|SuspiciousRoot|RootDoor|SapCrystal/, maxW:320, maxH:400 },
		{ kinds:{ puzzleBoard:1, waterWheel:1 }, type:/WaterWheel|AncientMechanism/, maxW:280, maxH:280 },
		{ kinds:{ trackClue:1 }, type:/Claw|Tracks|Bones|Nest/, maxW:280, maxH:200 },
		{ kinds:{ jungleShrine:1 }, type:/GiantFlower|ForgottenShrine|Idol/, maxW:420, maxH:360 },
		{ kinds:{ predatorNest:1, spiderNest:1 }, type:/jgNest|EggSac/, maxW:520, maxH:220 },
		{ kinds:{ jungleTrap:1 }, type:/jgNest|EggSac|ForgottenShrine|GiantFlower/, maxW:480, maxH:240 },
		{ kinds:{ sacredOffering:1 }, type:/GiantFlower|ForgottenShrine/, maxW:260, maxH:260 },
		{ kinds:{ vineElevator:1, shortcutVine:1 }, type:/VineElevator/, maxW:280, maxH:430 },
		{ kinds:{ raptorEgg:1 }, type:/jgNest/, maxW:620, maxH:220 },
		{ kinds:{ rootSwitch:1, rootSeal:1 }, type:/SuspiciousRoot|RootDoor/, maxW:300, maxH:380 },
		{ kinds:{ crackedRock:1 }, type:/SuspiciousRoot/, maxW:300, maxH:280 },
		{ kinds:{ ecosystemNode:1 }, type:/WiltedFlower|RootDoor/, maxW:320, maxH:400 },
		{ kinds:{ shrine:1 }, type:/fireAltar|frozenAltar|ForgottenShrine/, maxW:220, maxH:220 },
		{ kinds:{ choice:1, core:1, magmaCoreSlot:1 }, type:/fireFurnace|fireAltar/, maxW:240, maxH:240 },
		{ kinds:{ risk:1 }, type:/fireAltar|fireBrazier|fireAnvil/, maxW:220, maxH:220 },
		{ kinds:{ trial:1 }, type:/fireBrazier|fireAltar|frozenAltar/, maxW:220, maxH:220 },
		{ kinds:{ valve:1, magmaSiphon:1, hiddenSiphon:1, channelLever:1 }, type:/fireVent|fireGate|fireValve/, maxW:220, maxH:220 },
		{ kinds:{ wardenStart:1 }, type:/fireBrazier|fireGate|fireAnvil/, maxW:220, maxH:220 },
		{ kinds:{ cool:1 }, type:/fireReservoir/, maxW:180, maxH:80 },
		{ kinds:{ hearth:1 }, type:/warmHearth|frozenCamp/, maxW:200, maxH:160 },
		{ kinds:{ relic:1 }, type:/crystalCluster/, maxW:180, maxH:220 },
		{ kinds:{ prison:1 }, type:/prisonBlock/, maxW:240, maxH:240 },
		{ kinds:{ crackedIce:1 }, type:/crackedPlate/, maxW:160, maxH:140 },
		{ kinds:{ iceMirror:1 }, type:/mirrorPlane/, maxW:220, maxH:240 },
		{ kinds:{ iceBarrier:1 }, type:/iceColumn|prisonBlock/, maxW:220, maxH:240 },
		{ kinds:{ iceReceiver:1, memoryNode:1 }, type:/crystalCluster|frozenStatue/, maxW:220, maxH:260 },
		{ kinds:{ iceInscription:1 }, type:/frozenBanner|crackedPlate/, maxW:200, maxH:160 }
	];

	const THEME_GLOW = {
		jungle: 'rgba(140,255,120,',
		fire: 'rgba(255,150,40,',
		ice: 'rgba(140,220,255,',
		earth: 'rgba(140,255,120,'
	};
	const KIND_GLOW = {
		waterWheel:'rgba(90,230,255,',
		sunMirror:'rgba(255,230,120,',
		statueNode:'rgba(180,210,90,',
		growthNode:'rgba(90,255,140,',
		mushroomNode:'rgba(160,255,90,',
		flowerNode:'rgba(255,210,80,',
		sporeFlower:'rgba(190,255,110,',
		puzzleBoard:'rgba(120,230,200,',
		trackClue:'rgba(240,220,90,',
		rootStrand:'rgba(180,140,60,',
		rootCore:'rgba(210,255,90,',
		sporeHeart:'rgba(200,255,80,',
		ecosystemNode:'rgba(120,255,160,',
		drainLever:'rgba(200,255,80,',
		jungleShrine:'rgba(150,255,170,',
		sacredOffering:'rgba(230,255,90,',
		jungleMemory:'rgba(180,255,150,',
		rootSeal:'rgba(130,255,140,',
		rootSwitch:'rgba(100,240,130,',
		raptorEgg:'rgba(255,230,90,',
		miniBossStart:'rgba(120,255,150,',
		jungleCache:'rgba(200,255,110,',
		jungleVault:'rgba(220,255,130,',
		channelLever:'rgba(255,150,40,',
		choice:'rgba(255,140,40,',
		valve:'rgba(255,120,35,',
		shrine:'rgba(255,190,80,',
		risk:'rgba(255,130,40,',
		trial:'rgba(255,170,70,',
		cool:'rgba(140,210,255,',
		wardenStart:'rgba(255,160,40,',
		core:'rgba(255,120,30,',
		hearth:'rgba(255,170,70,',
		ring:'rgba(150,220,255,',
		relic:'rgba(160,230,255,',
		prison:'rgba(150,220,255,',
		crackedIce:'rgba(180,230,255,',
		vault:'rgba(255,210,90,',
		cache:'rgba(255,200,90,',
		memory:'rgba(255,200,90,',
		iceMirror:'rgba(160,230,255,',
		iceBarrier:'rgba(140,210,240,',
		iceInscription:'rgba(180,230,255,',
		iceReceiver:'rgba(200,250,255,',
		memoryNode:'rgba(190,230,255,',
		iceBreak:'rgba(170,220,255,',
		icePad:'rgba(150,210,240,'
	};

	let boundFor = null;
	const trimCache = Object.create(null);
	let trimCanvas = null;

	function themeKey(){
		if(typeof DUNGEON_TYPE !== 'undefined' && DUNGEON_TYPE){
			if(DUNGEON_TYPE === 'earth') return 'jungle';
			return DUNGEON_TYPE;
		}
		const d = (typeof dungeon !== 'undefined' && dungeon) || global.dungeon;
		if(d && d._jungle) return 'jungle';
		if(d && d._theme === 'earth') return 'jungle';
		return (d && d._theme) || 'fire';
	}
	function now(){ return (typeof performance !== 'undefined' ? performance.now() : Date.now()) * 0.001; }
	function ready(sheet){
		const im = sheets[sheet];
		return !!(im && im.complete && im.naturalWidth > 8);
	}
	function cellPx(sheet){
		const im = sheets[sheet];
		return (im && im.naturalWidth > 8) ? (im.naturalWidth / GRID) : 80;
	}

	function spriteFor(it){
		const kind = it.kind || '';
		const th = themeKey();
		if(kind === 'ecosystemNode'){
			const step = it.step || '';
			if(step === 'flower') return { sheet:'jungle', name:'flower' };
			if(step === 'vine') return { sheet:'jungle', name:'vineLift' };
			if(step === 'door') return { sheet:'jungle', name:'rootSwitch' };
			return { sheet:'jungle', name:'growth' };
		}
		if(kind === 'jungleTrap'){
			if(it.trapKind === 'spiderNest' || /egg/i.test(it.name || '')) return { sheet:'jungle', name:'nest' };
			if(it.trapKind === 'wrongChoice') return { sheet:'jungle', name:'offering' };
			return { sheet:'jungle', name:'offering' };
		}
		if(kind === 'forgeChoice'){
			return { sheet:'fire', name: it._mode === 'overload' ? 'overload' : 'destroy' };
		}
		if(kind === 'crackedRock'){
			return th === 'fire' ? { sheet:'fire', name:'rock' } : { sheet:'jungle', name:'bark' };
		}
		if(kind === 'shrine'){
			if(th === 'ice') return { sheet:'ice', name:'shrine' };
			if(th === 'jungle') return { sheet:'jungle', name:'shrine' };
			return { sheet:'fire', name:'shrine' };
		}
		if(kind === 'trial'){
			return th === 'ice' ? { sheet:'ice', name:'trial' } : { sheet:'fire', name:'trial' };
		}
		if(kind === 'memory' || kind === 'jungleMemory'){
			if(th === 'ice') return { sheet:'ice', name:'memory' };
			if(kind === 'jungleMemory' || th === 'jungle') return { sheet:'jungle', name:'tablet' };
			return { sheet:'fire', name:'plaque' };
		}
		const map = {
			waterWheel:{ sheet:'jungle', name:'sluice' },
			sunMirror:{ sheet:'jungle', name:'mirror' },
			statueNode:{ sheet:'jungle', name:'statue' },
			growthNode:{ sheet:'jungle', name:'growth' },
			mushroomNode:{ sheet:'jungle', name:'mushroom' },
			flowerNode:{ sheet:'jungle', name:'flower' },
			drainLever:{ sheet:'jungle', name:'lever' },
			jungleShrine:{ sheet:'jungle', name:'shrine' },
			predatorNest:{ sheet:'jungle', name:'nest' },
			spiderNest:{ sheet:'jungle', name:'nest' },
			jungleChoice:{ sheet:'jungle', name:'heart' },
			sacredOffering:{ sheet:'jungle', name:'offering' },
			vineElevator:{ sheet:'jungle', name:'vineLift' },
			shortcutVine:{ sheet:'jungle', name:'vineLift' },
			rootSeal:{ sheet:'jungle', name:'rootSwitch' },
			rootSwitch:{ sheet:'jungle', name:'rootSwitch' },
			raptorEgg:{ sheet:'jungle', name:'egg' },
			miniBossStart:{ sheet:'jungle', name:'heart' },
			sporeFlower:{ sheet:'jungle', name:'flower' },
			puzzleBoard:{ sheet:'jungle', name:'sluice' },
			trackClue:{ sheet:'jungle', name:'tablet' },
			rootStrand:{ sheet:'jungle', name:'rootSwitch' },
			rootCore:{ sheet:'jungle', name:'growth' },
			sporeHeart:{ sheet:'jungle', name:'mushroom' },
			channelLever:{ sheet:'fire', name:'lever' },
			furnaceLever:{ sheet:'fire', name:'bell' },
			furnaceValve:{ sheet:'fire', name:'valve' },
			cluePlate:{ sheet:'fire', name:'plaque' },
			choice:{ sheet:'fire', name:'furnace' },
			valve:{ sheet:'fire', name:'valve' },
			risk:{ sheet:'fire', name:'risk' },
			cool:{ sheet:'fire', name:'cool' },
			magmaSiphon:{ sheet:'fire', name:'siphon' },
			hiddenSiphon:{ sheet:'fire', name:'hiddenSiphon' },
			wardenStart:{ sheet:'fire', name:'bell' },
			core:{ sheet:'fire', name:'furnace' },
			magmaCoreSlot:{ sheet:'fire', name:'furnace' },
			magmaCore:{ sheet:'fire', name:'furnace' },
			hearth:{ sheet:'ice', name:'hearth' },
			ring:{ sheet:'ice', name:'ring' },
			relic:{ sheet:'ice', name:'relic' },
			prison:{ sheet:'ice', name:'prison' },
			crackedIce:{ sheet:'ice', name:'cracked' },
			iceMirror:{ sheet:'ice', name:'idol' },
			iceBarrier:{ sheet:'ice', name:'prison' },
			iceInscription:{ sheet:'ice', name:'tablet' },
			iceReceiver:{ sheet:'ice', name:'relic' },
			memoryNode:{ sheet:'ice', name:'memory' },
			iceBreak:{ sheet:'ice', name:'cracked' },
			icePad:{ sheet:'ice', name:'warming' },
			memory:{ sheet:'ice', name:'memory' }
		};
		return map[kind] || null;
	}

	function skipDec(dec){
		if(!dec || !dec.type) return true;
		const t = dec.type;
		if(/LightShaft|SunBeam|Mist|Fog|Fireflies|Butterflies|BirdFlock|TreasureGlow|CleanAir|MemoryEchoes|Clue|Eyes|Tracks|Marks|Letters|Stream|Pool|WaterChannel|Swamp|Waterfall|Distant|Vista|Spectacle|StormCloud|SapGlow/.test(t)) return true;
		if((dec.w || 0) > 900 || (dec.h || 0) > 700) return true;
		return false;
	}

	function rectsNear(a, b, pad){
		const aw = a.w || 60, ah = a.h || 70;
		const bw = b.w || 80, bh = b.h || 80;
		return a.x - pad < b.x + bw && a.x + aw + pad > b.x &&
			a.y - pad < b.y + bh && a.y + ah + pad > b.y;
	}
	function centerDist(a, b){
		const ax = a.x + (a.w || 60) * 0.5, ay = a.y + (a.h || 70) * 0.5;
		const bx = b.x + (b.w || 80) * 0.5, by = b.y + (b.h || 80) * 0.5;
		const dx = ax - bx, dy = ay - by;
		return dx * dx + dy * dy;
	}

	function bindAll(d){
		const ints = d.interactables || [];
		const decs = d.decorations || [];
		for(let i = 0; i < ints.length; i++){
			const it = ints[i];
			if(!it || SKIP[it.kind] || it._bindDec) continue;
			if(global.ChestLoot && ChestLoot.isChest && ChestLoot.isChest(it)) continue;
			let rule = null;
			for(let r = 0; r < BIND_RULES.length; r++){
				if(BIND_RULES[r].kinds[it.kind]){ rule = BIND_RULES[r]; break; }
			}
			if(!rule) continue;
			let best = null, bestD = 1e15;
			for(let di = 0; di < decs.length; di++){
				const dec = decs[di];
				if(skipDec(dec) || dec._boundInteract) continue;
				if((dec.w || 0) > rule.maxW || (dec.h || 0) > rule.maxH) continue;
				if(!rule.type.test(dec.type || '')) continue;
				if(!rectsNear(it, dec, 90)) continue;
				const dist = centerDist(it, dec);
				if(dist < bestD){ bestD = dist; best = dec; }
			}
			if(!best) continue;
			it._bindDec = best;
			best._boundInteract = true;
		}
	}

	function ensureBound(){
		const d = (typeof dungeon !== 'undefined' && dungeon) || global.dungeon;
		if(!d) return;
		if(boundFor === d) return;
		boundFor = d;
		bindAll(d);
	}

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
				padB: (sh - 1 - maxy) / sh
			};
		}catch(e){
			trimCache[key] = fallback;
		}
		return trimCache[key];
	}

	function glowPrefix(it){
		if(it && KIND_GLOW[it.kind]) return KIND_GLOW[it.kind];
		const s = (it && it.kind) || '';
		let h = 0;
		for(let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) & 255;
		const th = themeKey();
		if(th === 'ice') return 'rgba(' + (90 + h % 70) + ',' + (170 + h % 60) + ',255,';
		if(th === 'fire') return 'rgba(255,' + (100 + h % 90) + ',' + (20 + h % 50) + ',';
		return 'rgba(' + (70 + h % 90) + ',255,' + (80 + h % 90) + ',';
	}
	function drawGlow(ctx, it, sx, sy){
		const W = it.w || 60, H = it.h || 70;
		const seed = (it.x || 0) * 0.018 + (it.y || 0) * 0.011 + (it.kind || '').length;
		const pulse = 0.74 + Math.sin(now() * 2.45 + seed) * 0.26;
		const used = !!it.used && it.kind !== 'vineElevator' && it.kind !== 'waterWheel' && it.kind !== 'sunMirror' && it.kind !== 'statueNode' && it.kind !== 'puzzleBoard';
		const prefix = glowPrefix(it);
		const r = Math.max(W, H) * (used ? 0.9 : 1.75);
		let cx = sx + W * 0.5, cy = sy + H * 0.42;
		if(it._bindDec){
			const d = it._bindDec;
			cx = (d.x + (d.w || W) * 0.5) - (it.x - sx);
			cy = (d.y + (d.h || H) * 0.4) - (it.y - sy);
		}
		const halo = ctx.createRadialGradient(cx, cy, 2, cx, cy, r * 1.35);
		halo.addColorStop(0, prefix + (used ? 0.06 : (0.16 * pulse)) + ')');
		halo.addColorStop(1, prefix + '0)');
		ctx.fillStyle = halo;
		ctx.fillRect(cx - r * 1.35, cy - r * 1.35, r * 2.7, r * 2.7);
		const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, r);
		g.addColorStop(0, prefix + (used ? 0.14 : (0.48 * pulse)) + ')');
		g.addColorStop(0.4, prefix + (used ? 0.06 : (0.2 * pulse)) + ')');
		g.addColorStop(1, prefix + '0)');
		ctx.fillStyle = g;
		ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
	}

	function blitSprite(ctx, it, sx, sy, spec){
		if(!ready(spec.sheet)) return false;
		const cell = CELLS[spec.sheet] && CELLS[spec.sheet][spec.name];
		if(!cell) return false;
		const im = sheets[spec.sheet];
		const src = cellPx(spec.sheet);
		const t = trimRect(im, cell[0] * src, cell[1] * src, src, src);
		const W = it.w || 60, H = it.h || 70;
		const ar = t.sw / Math.max(1, t.sh);
		let dh = Math.max(H * 1.15, 70);
		let dw = Math.max(W, dh * ar);
		if(dw > W * 1.8){ dw = W * 1.35; dh = dw / ar; }
		const dx = sx + (W - dw) * 0.5;
		const dy = sy + H - dh + t.padB * dh;
		ctx.save();
		ctx.imageSmoothingEnabled = false;
		if(it.used) ctx.globalAlpha = 0.48;
		else if(it._locked || it.disabled) ctx.globalAlpha = 0.7;
		ctx.drawImage(im, t.sx, t.sy, t.sw, t.sh, dx, dy, dw, dh);
		ctx.restore();
		return true;
	}

	function draw(ctx, it, sx, sy){
		if(!it || SKIP[it.kind]) return false;
		if(global.ChestLoot && ChestLoot.isChest && ChestLoot.isChest(it)) return false;
		ensureBound();
		const spec = spriteFor(it);
		if(!spec && !it._bindDec) return false;
		ctx.save();
		drawGlow(ctx, it, sx, sy);
		if(!it._bindDec && spec) blitSprite(ctx, it, sx, sy, spec);
		if(it.state != null){
			ctx.font = 'bold 12px monospace';
			ctx.textAlign = 'center';
			ctx.fillStyle = '#f4ffc8';
			ctx.strokeStyle = 'rgba(0,0,0,0.7)';
			ctx.lineWidth = 3;
			const label = String((it.state || 0) + 1);
			ctx.strokeText(label, sx + (it.w || 60) / 2, sy + 10);
			ctx.fillText(label, sx + (it.w || 60) / 2, sy + 10);
		}
		ctx.restore();
		return true;
	}

	global.DungeonInteractArt = {
		draw: draw,
		bindAll: bindAll,
		spriteFor: spriteFor
	};
})(typeof window !== 'undefined' ? window : globalThis);
