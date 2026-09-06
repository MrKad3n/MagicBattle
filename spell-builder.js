/* =============================================================
   NEW SPELL CRAFTER — silhouette doodles + three live panels
   ============================================================= */
(function(){
	if(window.parent && window.parent !== window) document.documentElement.classList.add('in-game-inv');
	let selectedPhase = 0;
	let unevenOpen = false;
	let doodleTime = 0;
	let doodleRAF = null;
	let hoverTip = null;
	let simRAF = null;
	let simT = 0;
	let simFx = null;

	const ADVANCED_FX = ['randomDelay','evenDelay','timedRelease','resetProjectiles','damageStore','damageRelease','ricochet','rotate','awayFromPlayer'];
	const FX_SECTIONS = [
		{ id:'overall', title:'Overall', keys:['solidify','solidObjectBreak','phaseThrough','dispel'] },
		{ id:'elemental', title:'Elemental', keys:['burn','freeze','poison','stun','lifesteal','shatter'] },
		{ id:'movement', title:'Forced Movement', keys:['knockback','pull','forceJump','gravityWell'] },
		{ id:'cc', title:'Crowd Control', keys:['blind','mark','sticky'] },
		{ id:'support', title:'Support', keys:['healSelf','shield','damageHeal'] },
		{ id:'advanced', title:'Advanced Control', keys:ADVANCED_FX },
	];
	const PHASE_LINKS = {
		onHit: { label:'On Hit', desc:'Next phase starts when this one hits.' },
		afterHitDelay: { label:'After Hit Delay', desc:'Waits at the hit point, then starts the next phase.' },
		afterDelay: { label:'After Delay', desc:'Starts the next phase after this one has run its duration.' },
		onExpire: { label:'On Expire', desc:'Starts the next phase when this one fades out.' },
		phaseFork: { label:'Phase Fork', desc:'Starts the next phase after a delay without ending this one. Both run together.' },
	};

	function ink(ph){ return ph && ph.color ? ph.color : '#c8d4ee'; }
	function builderManaOpts(){
		return (typeof inventoryManaOpts==='function')
			? inventoryManaOpts(editingSlot, builderSpell)
			: { stats: computeStats(), slot: editingSlot, isUltimate: editingSlot===9, mageClass: STATE.mageClass, mageClass2: STATE.mageClass2 };
	}
	function displayedCost(spell){
		if(typeof displayedSpellMana==='function') return displayedSpellMana(spell, builderManaOpts());
		const stats = computeStats();
		const base = calcSpellManaCost(spell);
		const controlDiscount = Math.max(0.3, 1 - stats.magicControl * 0.015);
		const vb = calcVowBoostsForSlot(editingSlot);
		const vowMana = Math.max(0.1, 1 - (vb.manaCost||0) * 0.05);
		const vowGlobal = Math.max(0.1, 1 - (vb.manaEfficiency||0) * 0.025);
		return Math.round(base * controlDiscount * vowMana * vowGlobal);
	}
	function phaseCtrl(ph){
		let r = Math.max(SHAPES[ph.shape]?.controlReq||0, BEHAVIORS[ph.behavior]?.controlReq||0);
		for(const fx of (ph.effects||[])) r = Math.max(r, EFFECTS[fx]?.controlReq||0);
		return r;
	}
	function phaseManaShare(spell, idx){
		if(typeof phaseManaShares==='function'){
			const shares = phaseManaShares(spell, builderManaOpts());
			return shares[idx] || 0;
		}
		if(!spell.phases[idx]) return 0;
		const one = { name:spell.name, phases:[JSON.parse(JSON.stringify(spell.phases[idx]))] };
		return displayedCost(one);
	}
	function cloneSpell(){ return JSON.parse(JSON.stringify(builderSpell)); }
	function shapeDmgMult(shape){
		if(shape==='beam') return 0.65;
		if(shape==='cone') return 0.35;
		if(shape==='meteor') return 0.75;
		return 1;
	}
	function behDmgMult(beh, idx){
		if(beh==='homing') return 0.5;
		if(beh==='lob') return 1.25;
		if(beh==='orbit') return 1.15;
		if(beh==='rain') return (idx==null || idx===0) ? 1.5 : 1;
		if(beh==='barrage') return (idx==null || idx===0) ? 1.35 : 1;
		if(beh==='ground') return 1.4;
		if(beh==='control') return 0.15;
		return 1;
	}
	function estimatePhaseDmg(ph, idx){
		if(!ph || ph.noHit || ph.shape==='allyOrb' || ph.shape==='summon') return { text:'—', per:0, hit:0, raw:0 };
		const shape = resolveShape(ph, idx||0);
		const count = Math.max(1, ph.behavior==='aroundSelf' ? (ph.aroundSelfCount||4) : (ph.count||1));
		const selfBonus = ph.behavior==='stationary' ? 2 : (ph.behavior==='selfCast'||ph.behavior==='underfoot'||ph.behavior==='aroundSelf' ? 1 : 0);
		const pwr = (ph.power||1)/count + 0.05 + selfBonus;
		let raw = pwr * 8 * shapeDmgMult(shape) * behDmgMult(ph.behavior, idx);
		if((ph.effects||[]).includes('phaseThrough')) raw *= 0.55;
		if((ph.effects||[]).includes('mark')) raw *= 0.25;
		if(shape==='nova') raw *= 0.75;
		const noSpread = ph.behavior==='stationary'||ph.behavior==='underfoot'||ph.behavior==='selfCast'||ph.behavior==='ground';
		if(!noSpread && (ph.spread||0)>0 && count>1) raw *= 1 + Math.min(0.8, (ph.spread/180)*0.8);
		let hit = raw;
		const fx = ph.effects||[];
		if(fx.includes('burn')) hit = raw * 0.85;
		else if(fx.includes('poison')) hit = raw * 0.90;
		const blast = shape==='explosion' ? pwr * 14 : 0;
		if(shape==='meteor'){
			const lo = Math.round(hit);
			const hi = Math.round(hit * 3);
			return { text: lo+'–'+hi, per:hit, hit, raw, range:true, lo, hi, blast, count };
		}
		return { text: String(Math.round(hit)), per:hit, hit, raw, blast, count };
	}
	function estimateShapeDmg(ph){
		return estimatePhaseDmg(ph);
	}
	function effectCombatNote(fx, ph, idx){
		const info = estimatePhaseDmg(Object.assign({}, ph, {effects: (ph.effects||[]).includes(fx) ? ph.effects : (ph.effects||[]).concat([fx])}), idx);
		const hit = Math.round(info.hit || 0);
		const raw = info.raw || 0;
		let line = '';
		if(fx==='burn') line = 'Hit '+hit+'  ·  Burn DoT '+Math.round(raw*0.15)+' over 5 ticks';
		else if(fx==='poison') line = 'Hit '+hit+'  ·  Poison DoT '+Math.round(raw*0.10)+' over 6 ticks';
		else if(fx==='freeze') line = 'Hit '+hit+'  ·  Slow 1.5s';
		else if(fx==='stun') line = 'Hit '+hit+'  ·  Stun ~0.3s';
		else if(fx==='knockback') line = 'Hit '+hit+'  ·  Launch '+((ph.power||1)*1.5).toFixed(1);
		else if(fx==='pull') line = 'Hit '+hit+'  ·  Pulls toward you';
		else if(fx==='lifesteal') line = 'Hit '+hit+'  ·  Heal '+Math.round(raw*0.20)+' (20% of raw)';
		else if(fx==='healSelf') line = 'Heal '+Math.round((ph.power||1)*5);
		else if(fx==='shield') line = 'Shield +'+Math.round((ph.power||1)*3);
		else if(fx==='blind') line = 'Blind '+(0.5*(ph.power||1)).toFixed(1)+'s';
		else if(fx==='mark') line = 'Hit '+hit+'  ·  Slow 3s (25% damage)';
		else if(fx==='forceJump') line = 'Launch up ~'+Math.round(40+(ph.power||1)*15)+'px';
		else if(fx==='randomDelay'){
			const n = Math.max(2, ph.behavior==='aroundSelf'?(ph.aroundSelfCount||4):(ph.count||1));
			line = n+' projectiles  ·  each waits 0–'+(Number(ph.randomDelayMax||0.5).toFixed(1))+'s';
		}
		else if(fx==='evenDelay'){
			const n = Math.max(2, ph.behavior==='aroundSelf'?(ph.aroundSelfCount||4):(ph.count||1));
			line = n+' projectiles spaced over '+(Number(ph.evenDelayDuration||0.5).toFixed(1))+'s';
		}
		else if(fx==='phaseThrough') line = 'Hit '+hit+' (–45%)  ·  passes through walls';
		else if(fx==='timedRelease') line = 'Triggers after '+(Number(ph.timedReleaseDelay||0.5).toFixed(1))+'s';
		else if(fx==='resetProjectiles') line = 'Next phase spawns fresh (no morph)';
		else if(fx==='damageStore') line = 'Stores '+Math.round((ph.damageStorePercent||0.5)*100)+'% of hit';
		else if(fx==='damageRelease') line = 'Consumes stored dmg for bonus hit/size';
		else if(fx==='damageHeal') line = 'Ally Orb heals 50% of stored dmg';
		else if(fx==='dispel') line = 'Destroys enemy projectiles on contact';
		else if(fx==='ricochet') line = 'Bounces off walls up to 5 times';
		else if(fx==='rotate') line = 'Spins while traveling';
		else if(fx==='solidify') line = 'Becomes a walkable platform';
		else if(fx==='awayFromPlayer') line = 'Fires away from you, not toward cursor';
		else if(fx==='solidObjectBreak') line = 'Shatters all solidify platforms';
		else if(fx==='sticky') line = 'Sticks targets / enables wall-walk';
		else if(fx==='gravityWell') line = 'Pull well  ·  radius scales with power '+(ph.power||1).toFixed(1);
		else if(fx==='shatter') line = 'Hit '+hit+'  ·  12 shards on hit';
		else if(info.blast>0) line = 'Hit '+hit+'  ·  Blast ~'+Math.round(info.blast)+' (falloff)';
		else if(hit>0) line = 'Hit '+hit+(info.count>1?' each':'');
		if(!line) return '';
		return '<div class="ht-row"><span>Combat</span><span>'+line+'</span></div>';
	}
	function fmtDelta(n, suffix){
		if(n === 0) return '<span class="flat">0'+suffix+'</span>';
		const cls = n > 0 ? 'up' : 'down';
		const sign = n > 0 ? '+' : '';
		return '<span class="'+cls+'">'+sign+n+suffix+'</span>';
	}
	function helpText(kind, key){
		if(kind==='shape'){
			const s = SHAPES[key]||{};
			const d = (typeof DICT_SHAPE_DETAILS!=='undefined' && DICT_SHAPE_DETAILS[key]) || {};
			return { title:(s.icon||'')+' '+(s.label||key), body:s.desc||'', extra:[d.phaseNote,d.extraNote,d.dmgNote||s.dmgNote].filter(Boolean).join(' ') };
		}
		if(kind==='behavior'){
			const s = BEHAVIORS[key]||{};
			const d = (typeof DICT_BEHAVIOR_DETAILS!=='undefined' && DICT_BEHAVIOR_DETAILS[key]) || {};
			return { title:s.label||key, body:s.desc||'', extra:[d.phaseNote,d.dmgMod,d.extraNote].filter(Boolean).join(' ') };
		}
		const s = EFFECTS[key]||{};
		const d = (typeof DICT_EFFECT_DETAILS!=='undefined' && DICT_EFFECT_DETAILS[key]) || {};
		return { title:(s.icon||'')+' '+(s.label||key), body:s.desc||'', extra:[d.phaseNote,d.extraNote,s.dmgNote].filter(Boolean).join(' ') };
	}

	/* ---------- doodles ---------- */
	function drawShape(ctx, x, y, s, shape, ang){
		ctx.save();
		ctx.translate(x,y);
		ctx.rotate(ang||0);
		ctx.beginPath();
		if(shape==='orb'||shape==='allyOrb'){ ctx.arc(0,0,s,0,Math.PI*2); }
		else if(shape==='missile'){ ctx.moveTo(s*1.6,0); ctx.lineTo(-s,-s*.7); ctx.lineTo(-s*.3,0); ctx.lineTo(-s,s*.7); ctx.closePath(); }
		else if(shape==='spike'){ ctx.moveTo(s*1.8,0); ctx.lineTo(-s,-s*.7); ctx.lineTo(-s*.2,0); ctx.lineTo(-s,s*.7); ctx.closePath(); }
		else if(shape==='blade'){ ctx.moveTo(s*1.4,0); ctx.lineTo(0,-s*.45); ctx.lineTo(-s*1.2,0); ctx.lineTo(0,s*.45); ctx.closePath(); }
		else if(shape==='slash'){ ctx.arc(0,0,s*1.4,-0.9,0.9); ctx.arc(s*0.2,0,s*0.9,0.9,-0.9,true); }
		else if(shape==='beam'){ ctx.rect(-s*2.4,-s*0.28,s*4.8,s*0.56); }
		else if(shape==='cone'){ ctx.moveTo(-s*0.4,0); ctx.lineTo(s*1.8,-s*1.1); ctx.lineTo(s*1.8,s*1.1); ctx.closePath(); }
		else if(shape==='wall'){ ctx.rect(-s*0.35,-s*1.5,s*0.7,s*3); }
		else if(shape==='ring'){ ctx.arc(0,0,s*1.3,0,Math.PI*2); }
		else if(shape==='nova'||shape==='explosion'){
			for(let i=0;i<8;i++){ const a=i*Math.PI/4; ctx.lineTo(Math.cos(a)*s*(i%2?1.5:0.7), Math.sin(a)*s*(i%2?1.5:0.7)); }
			ctx.closePath();
		}
		else if(shape==='polygon'){
			const n = 6;
			for(let i=0;i<=n;i++){ const a=i*Math.PI*2/n-Math.PI/2; ctx.lineTo(Math.cos(a)*s, Math.sin(a)*s); }
		}
		else if(shape==='meteor'){ ctx.arc(0,0,s*1.1,0,Math.PI*2); }
		else if(shape==='summon'){ ctx.arc(0,-s*0.3,s*0.55,0,Math.PI*2); ctx.rect(-s*0.7,s*0.1,s*1.4,s*1.1); }
		else if(shape==='chain'){ ctx.arc(-s*0.7,0,s*0.55,0,Math.PI*2); ctx.arc(s*0.7,0,s*0.55,0,Math.PI*2); }
		else { ctx.arc(0,0,s,0,Math.PI*2); }
		if(shape==='ring'){ ctx.stroke(); } else { ctx.fill(); }
		ctx.restore();
	}
	function drawActor(ctx, x, y, h, fill){
		ctx.fillStyle = fill;
		ctx.fillRect(x-4, y-h, 8, h);
		ctx.beginPath(); ctx.arc(x, y-h-3, 4, 0, Math.PI*2); ctx.fill();
	}
	function dashPath(ctx, pts){
		if(pts.length<2) return;
		ctx.setLineDash([4,4]);
		ctx.beginPath();
		ctx.moveTo(pts[0].x, pts[0].y);
		for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x, pts[i].y);
		ctx.stroke();
		ctx.setLineDash([]);
	}
	function pathFor(beh, W, H, t){
		const px = 22, py = H-16, ex = W-22, ey = H*0.42;
		const n = 18, pts = [];
		for(let i=0;i<=n;i++){
			const u = i/n;
			let x=px+(ex-px)*u, y=py+(ey-py)*u;
			if(beh==='lob') y = py - Math.sin(u*Math.PI)*(H*0.55);
			else if(beh==='homing'||beh==='control'){ y = py + (ey-py)*u - Math.sin(u*Math.PI)*18; }
			else if(beh==='boomerang'){ x = px + Math.sin(u*Math.PI)*(ex-px)*0.85; y = py-10 - Math.sin(u*Math.PI*2)*10; }
			else if(beh==='groundSurge'){ y = H-10; }
			else if(beh==='zigzag'){ y = py+(ey-py)*u + Math.sin(u*Math.PI*4)*10; }
			else if(beh==='spiral'){ x = px+(ex-px)*u + Math.cos(u*Math.PI*6)*7; y = py+(ey-py)*u + Math.sin(u*Math.PI*6)*7; }
			else if(beh==='teleport'){ x = px+(ex-px)*u; y = py+(ey-py)*u; }
			else if(beh==='rain'){ x = W*0.35 + u*W*0.2; y = 8 + (H-16)*u; }
			else if(beh==='orbit'){
				if(u<0.55){ const a=u/0.55*Math.PI*2; x=30+Math.cos(a)*16; y=H*0.55+Math.sin(a)*10; }
				else { const v=(u-0.55)/0.45; x=46+(ex-46)*v; y=H*0.55+(ey-H*0.55)*v; }
			}
			else if(beh==='aroundSelf'||beh==='selfCast'||beh==='underfoot'||beh==='stationary'){ x=30; y=H*0.62; }
			else if(beh==='ground'){ x=ex; y=H-8-(H*0.35)*u; }
			pts.push({x,y});
		}
		const u = (t%4)/4;
		const idx = Math.min(pts.length-1, Math.floor(u*(pts.length-1)));
		return { pts, at: pts[idx], showEnemy: /homing|control|ground|orbit/.test(beh) };
	}
	function resolveShape(ph, idx){
		if(ph.shape==='same' && builderSpell && idx>0) return builderSpell.phases[idx-1].shape;
		return ph.shape==='same' ? 'missile' : ph.shape;
	}
	function drawDummy(ctx, x, y, col){
		ctx.save();
		ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 1.4;
		ctx.beginPath(); ctx.arc(x, y-22, 5, 0, Math.PI*2); ctx.fill();
		ctx.beginPath(); ctx.moveTo(x-7,y-16); ctx.lineTo(x+7,y+2); ctx.moveTo(x+7,y-16); ctx.lineTo(x-7,y+2); ctx.stroke();
		ctx.fillRect(x-1, y-18, 2, 16);
		ctx.restore();
	}
	function drawDoodle(canvas, ph, t, idx){
		if(!canvas) return;
		const ctx = canvas.getContext('2d');
		const W = canvas.width, H = canvas.height;
		runCombatSim(ctx, W, H, ph, t, idx, null);
	}
	function hash01(i, salt){
		const x = Math.sin((i+1)*12.9898 + (salt||1)*78.233) * 43758.5453;
		return x - Math.floor(x);
	}
	function alongPts(pts, u){
		if(!pts || pts.length<2) return {x:0,y:0};
		u = Math.max(0, Math.min(1, u));
		const f = u*(pts.length-1);
		const i = Math.min(pts.length-2, Math.floor(f));
		const k = f-i;
		return {x: pts[i].x+(pts[i+1].x-pts[i].x)*k, y: pts[i].y+(pts[i+1].y-pts[i].y)*k};
	}
	function simProjCount(ph, fxList, focusFx, W){
		let n = ph.behavior==='aroundSelf' ? (ph.aroundSelfCount||4) : (ph.count||1);
		n = Math.max(1, n|0);
		const delayOn = focusFx==='randomDelay'||focusFx==='evenDelay'||(fxList&&(fxList.includes('randomDelay')||fxList.includes('evenDelay')));
		if(delayOn && n<4) n = 5;
		if(focusFx==='solidObjectBreak') n = 1;
		const cap = W>220 ? 10 : 7;
		return Math.min(n, cap);
	}
	function spawnDelaySec(ph, i, n, fx){
		if(fx.includes('evenDelay')){
			const dur = Math.max(0.1, Number(ph.evenDelayDuration)||0.5);
			return n<=1 ? 0 : i*dur/Math.max(1, n-1);
		}
		if(fx.includes('randomDelay')){
			const max = Math.max(0.1, Number(ph.randomDelayMax)||0.5);
			return hash01(i, 3)*max;
		}
		return 0;
	}
	function runCombatSim(ctx, W, H, ph, t, idx, extraFx){
		ctx.clearRect(0,0,W,H);
		ctx.fillStyle = '#0c0b14';
		ctx.fillRect(0,0,W,H);
		ctx.strokeStyle = 'rgba(255,255,255,.08)';
		ctx.beginPath(); ctx.moveTo(0,H-8); ctx.lineTo(W,H-8); ctx.stroke();
		const col = ink(ph);
		const shape = resolveShape(ph, idx||0);
		const fx = (ph.effects||[]).slice();
		if(extraFx && !fx.includes(extraFx)) fx.push(extraFx);
		const focus = extraFx || null;
		if(ph.behavior==='domain'){
			ctx.strokeStyle = col; ctx.globalAlpha = 0.5; ctx.setLineDash([5,4]);
			ctx.strokeRect(10, 8, W-20, H-18);
			ctx.setLineDash([]); ctx.globalAlpha = 1;
			drawActor(ctx, W*0.5, H-8, 16, col);
			ctx.globalAlpha = 0.9; ctx.fillStyle = col;
			const n = 5;
			for(let i=0;i<n;i++){
				const a = t*1.2 + i*Math.PI*2/n;
				drawShape(ctx, W*0.5+Math.cos(a)*(W*0.32), H*0.48+Math.sin(a)*(H*0.22), 5, shape, a);
			}
			ctx.font='bold 10px Arial'; ctx.fillStyle=col; ctx.textAlign='center';
			ctx.fillText('5 / wave  ·  6s', W/2, 16);
			ctx.globalAlpha = 1;
			return;
		}
		if(ph.behavior==='transformation'){
			drawActor(ctx, W*0.5, H-8, 18, col);
			ctx.strokeStyle = col;
			for(let i=0;i<3;i++){
				ctx.globalAlpha = 0.25 + ((t+i*0.3)%1)*0.35;
				ctx.beginPath(); ctx.arc(W*0.5, H-20, 10+i*8+(t%1)*4, 0, Math.PI*2); ctx.stroke();
			}
			ctx.globalAlpha = 1;
			return;
		}

		const simPh = Object.assign({}, ph, {effects:fx, shape:shape});
		const dmgInfo = estimatePhaseDmg(simPh, idx||0);
		const hitDmg = Math.round(dmgInfo.hit || 0);
		const rawDmg = dmgInfo.raw || 0;
		const n = simProjCount(ph, fx, focus, W);
		const demoInflated = (fx.includes('randomDelay')||fx.includes('evenDelay')||focus==='randomDelay'||focus==='evenDelay') && ((ph.behavior==='aroundSelf'?(ph.aroundSelfCount||4):(ph.count||1))<4);
		const sz = Math.max(3.0, 2.8 * (((ph.width||1)+(ph.height||1))/2) * (fx.includes('damageRelease')?1.35:1));
		const spdMul = Math.max(0.35, Math.min(2.6, (Number(ph.speed)||1)/3));
		const travelDur = 0.95 / spdMul;
		let maxDelay = 0;
		const delays = [];
		for(let i=0;i<n;i++){ const d=spawnDelaySec(ph,i,n,fx); delays.push(d); if(d>maxDelay) maxDelay=d; }
		if(fx.includes('timedRelease')) maxDelay = Math.max(maxDelay, Number(ph.timedReleaseDelay||0.5));
		const cycle = maxDelay + travelDur + 0.9;
		const ct = t % cycle;
		const parked = ph.behavior==='selfCast'||ph.behavior==='underfoot'||ph.behavior==='stationary'||ph.behavior==='aroundSelf';
		const away = fx.includes('awayFromPlayer') || focus==='awayFromPlayer';
		const path = pathFor(away ? 'straight' : ph.behavior, W, H, 0);
		let pts = path.pts.slice();
		if(away){
			pts = pts.map(p => ({x: 22-(p.x-22)*0.55, y: p.y}));
		}
		if(fx.includes('ricochet') || focus==='ricochet'){
			const wallX = W*0.55;
			pts = [
				{x:22,y:H-16},{x:wallX-2,y:H*0.38},
				{x:wallX+8,y:H*0.22},{x:W-24,y:H-10}
			];
		}
		if(fx.includes('phaseThrough') || focus==='phaseThrough'){
			/* keep default path through a wall drawn later */
		}

		const px = 18, py = H-8;
		let dummyX = parked ? (ph.behavior==='selfCast' ? px : W*0.58) : (away ? W*0.22 : W-22);
		let dummyY = H-8;
		const pow = Number(ph.power)||1;
		const kbDist = Math.min(W*0.32, 8+pow*5.2);
		const pullDist = Math.min(W*0.28, 10+pow*4);
		const jumpH = Math.min(H*0.5, 14+pow*7);

		/* earliest hit among spawned shots */
		let firstHit = 99, lastHit = 0, flyingAny=false, anyHit=false;
		const shots = [];
		for(let i=0;i<n;i++){
			const delay = delays[i];
			const local = ct - delay;
			const spawned = local >= 0;
			const u = spawned ? Math.min(1, local / travelDur) : 0;
			const hit = spawned && local >= travelDur;
			const hitAge = hit ? local - travelDur : 0;
			if(spawned && !hit) flyingAny = true;
			if(hit){ anyHit = true; firstHit = Math.min(firstHit, delay+travelDur); lastHit = Math.max(lastHit, delay+travelDur); }
			shots.push({i, delay, local, spawned, u, hit, hitAge});
		}
		const hitT = anyHit ? Math.max(0, ct - firstHit) : 0;
		if(anyHit && fx.includes('knockback')) dummyX += Math.min(kbDist, hitT*kbDist*2.2);
		if(anyHit && fx.includes('pull') && !fx.includes('gravityWell')) dummyX -= Math.min(pullDist, hitT*pullDist*2.4);
		if(anyHit && fx.includes('gravityWell')) dummyX -= Math.min(22, hitT*26);
		if(anyHit && fx.includes('forceJump')) dummyY -= Math.sin(Math.min(1, hitT*2.6)*Math.PI)*jumpH;
		if(fx.includes('sticky') && anyHit) dummyX += Math.sin(ct*6)*1.2;

		drawActor(ctx, px, py, 14, col);

		/* scenery per focus */
		if(fx.includes('phaseThrough') || focus==='phaseThrough'){
			ctx.fillStyle = 'rgba(180,180,200,.22)';
			ctx.fillRect(W*0.42, 8, 16, H-16);
			ctx.fillStyle = 'rgba(220,220,240,.12)';
			ctx.fillRect(W*0.42, 8, 3, H-16);
		}
		if(fx.includes('ricochet') || focus==='ricochet'){
			ctx.fillStyle = 'rgba(180,180,200,.28)';
			ctx.fillRect(W*0.52, 6, 10, H-14);
		}
		if(focus==='solidObjectBreak' || fx.includes('solidObjectBreak')){
			const broke = ct > 0.25;
			for(let i=0;i<3;i++){
				const bx = W*0.38+i*28, by = H-18;
				ctx.save();
				if(broke){ ctx.translate(bx, by-6); ctx.rotate((i-1)*0.4+ct*2); ctx.globalAlpha = Math.max(0, 1-ct*0.7); ctx.translate(-bx, -(by-6)); }
				ctx.fillStyle = '#44aa66';
				ctx.fillRect(bx-10, by-10, 20, 12);
				ctx.restore();
			}
		}
		if(focus==='dispel' || fx.includes('dispel')){
			const collideT = travelDur*0.55;
			const enemyAlive = ct < collideT;
			if(enemyAlive){
				const eu = Math.min(1, ct/collideT);
				ctx.fillStyle = '#ff5566';
				drawShape(ctx, W-20-(W-50)*eu, H*0.45, 5, 'missile', Math.PI);
			} else {
				ctx.globalAlpha = Math.max(0, 1-(ct-collideT)*3);
				ctx.fillStyle = '#ffcc66';
				ctx.font = 'bold 10px Arial'; ctx.textAlign='center';
				ctx.fillText('DISPEL', W*0.55, H*0.32);
				ctx.globalAlpha = 1;
			}
		}

		let dummyCol = col;
		if(anyHit && fx.includes('freeze')) dummyCol = '#88ddff';
		else if(anyHit && fx.includes('poison')) dummyCol = '#66cc66';
		else if(anyHit && fx.includes('burn')) dummyCol = '#ff8844';
		else if(anyHit && fx.includes('mark')) dummyCol = '#ff66aa';
		if(anyHit && fx.includes('blind')) ctx.globalAlpha = 0.28;
		if(ph.behavior!=='selfCast') drawDummy(ctx, away ? W-22 : dummyX, dummyY, dummyCol);
		ctx.globalAlpha = 1;
		if(anyHit && fx.includes('blind')){
			ctx.fillStyle = 'rgba(20,8,28,0.55)';
			ctx.fillRect(dummyX-16, dummyY-40, 32, 42);
		}
		if(anyHit && fx.includes('mark')){
			ctx.strokeStyle = '#ff44aa'; ctx.lineWidth = 1.2;
			ctx.beginPath(); ctx.arc(dummyX, dummyY-18, 9+Math.sin(t*6), 0, Math.PI*2); ctx.stroke();
			ctx.beginPath(); ctx.moveTo(dummyX-12, dummyY-18); ctx.lineTo(dummyX-6, dummyY-18); ctx.moveTo(dummyX+6, dummyY-18); ctx.lineTo(dummyX+12, dummyY-18); ctx.stroke();
		}
		if(fx.includes('shield') && (parked || anyHit)){
			ctx.strokeStyle = '#88bbff'; ctx.globalAlpha = 0.7;
			ctx.beginPath(); ctx.arc(px, py-10, 14, 0, Math.PI*2); ctx.stroke();
			ctx.globalAlpha = 1;
		}

		if(ph.behavior==='control'){
			ctx.strokeStyle = col; ctx.globalAlpha = 0.7;
			ctx.beginPath(); ctx.moveTo(W-28, 14); ctx.lineTo(W-18, 24); ctx.moveTo(W-18, 14); ctx.lineTo(W-28, 24); ctx.stroke();
			ctx.globalAlpha = 1;
		}

		ctx.fillStyle = col; ctx.strokeStyle = col;
		const spread = Number(ph.spread)||0;
		for(const sh of shots){
			if(!sh.spawned) continue;
			let pos, ang = 0;
			if(parked && ph.behavior==='aroundSelf'){
				const a = sh.i*Math.PI*2/n + t*spdMul*0.6;
				pos = {x:30+Math.cos(a)*18, y:H*0.58+Math.sin(a)*11};
				ang = a;
			} else if(parked){
				pos = {x:34, y:H*0.58};
			} else if(shape==='beam' && !fx.includes('ricochet')){
				const len = Math.max(18, (dummyX-28)*sh.u);
				if(!sh.hit){
					ctx.globalAlpha = 0.85;
					ctx.fillRect(22, (pts[0]&&pts[0].y||H*0.5)-Math.max(2,sz*0.22)+ (sh.i-(n-1)/2)*Math.min(7, 3+spread*0.03), len, Math.max(3,sz*0.45));
					ctx.globalAlpha = 1;
				}
				pos = {x:22+len, y:H*0.5};
				if(shape==='beam') continue;
			} else {
				pos = alongPts(pts, sh.u);
				const fan = (sh.i-(n-1)/2) * Math.min(12, 5+spread*0.05);
				if(ph.behavior==='barrage') pos = {x:pos.x, y:pos.y+fan};
				else if(ph.behavior==='rain') pos = {x:pos.x+fan*0.8, y:pos.y};
				else pos = {x:pos.x, y:pos.y+fan};
				if(pts.length>1){
					const nxt = alongPts(pts, Math.min(1, sh.u+0.04));
					ang = Math.atan2(nxt.y-pos.y, nxt.x-pos.x);
				}
			}
			if(fx.includes('rotate') || focus==='rotate') ang += t*4 + sh.i;
			if(fx.includes('solidify') && (sh.hit || parked)){
				ctx.globalAlpha = 0.9;
				ctx.fillStyle = '#3dba7a';
				ctx.fillRect(pos.x-sz*1.4, pos.y-4, sz*2.8, 8);
				ctx.fillStyle = col;
				ctx.globalAlpha = 1;
				continue;
			}
			if(sh.hit && !parked && !(fx.includes('phaseThrough')||focus==='phaseThrough')) continue;
			ctx.globalAlpha = (fx.includes('phaseThrough')?0.55:0.95);
			ctx.fillStyle = col; ctx.strokeStyle = col;
			drawShape(ctx, pos.x, pos.y, sz, shape, ang);
			ctx.globalAlpha = 1;
			if(fx.includes('sticky')){
				ctx.strokeStyle = '#aaff55'; ctx.globalAlpha = 0.5;
				ctx.beginPath(); ctx.arc(pos.x, pos.y, sz+3, 0, Math.PI*2); ctx.stroke();
				ctx.globalAlpha = 1;
			}
		}

		/* timed release burst */
		if(fx.includes('timedRelease')){
			const td = Number(ph.timedReleaseDelay||0.5);
			if(ct >= td && ct < td+0.45){
				const p = alongPts(pts, Math.min(1, td/Math.max(0.05,travelDur)));
				ctx.strokeStyle = col; ctx.globalAlpha = 0.7;
				ctx.beginPath(); ctx.arc(p.x, p.y, 6+(ct-td)*28, 0, Math.PI*2); ctx.stroke();
				ctx.globalAlpha = 1;
				ctx.fillStyle = '#ffe566'; ctx.font='bold 9px Arial'; ctx.textAlign='center';
				ctx.fillText('RELEASE', p.x, p.y-12);
			}
		}

		/* gravity well */
		if(fx.includes('gravityWell') && anyHit){
			const wellR = 14+pow*7;
			ctx.strokeStyle = '#bb88ff';
			for(let r=0;r<3;r++){
				ctx.globalAlpha = 0.45 - r*0.1;
				ctx.beginPath(); ctx.arc(dummyX, dummyY-16, wellR*(0.4+((t+r*0.3)%1)*0.6), 0, Math.PI*2); ctx.stroke();
			}
			ctx.globalAlpha = 1;
		}

		/* shatter shards */
		if(fx.includes('shatter') && anyHit){
			ctx.fillStyle = '#cceeff';
			const shards = 12;
			for(let s=0;s<shards;s++){
				const a = s*Math.PI*2/shards;
				const dist = Math.min(28, hitT*40);
				ctx.beginPath();
				ctx.arc(dummyX+Math.cos(a)*dist, dummyY-18+Math.sin(a)*dist, 1.6, 0, Math.PI*2);
				ctx.fill();
			}
		}

		/* reset projectiles: after hit, new volley */
		if(fx.includes('resetProjectiles') && anyHit){
			const age = hitT;
			if(age < 0.8){
				ctx.fillStyle = '#ffcc66';
				for(let i=0;i<n;i++){
					const u2 = Math.min(1, age/0.55);
					const p = alongPts(pts, u2);
					const fan = (i-(n-1)/2)*8;
					drawShape(ctx, p.x, p.y+fan, sz*0.75, shape, 0);
				}
				ctx.font='bold 9px Arial'; ctx.textAlign='center'; ctx.fillStyle='#ffcc66';
				ctx.fillText('FRESH', W*0.55, 14);
			}
		}

		/* damage store bar */
		if(fx.includes('damageStore')){
			const pct = Math.max(0.1, Number(ph.damageStorePercent)||0.5);
			const fill = anyHit ? Math.min(1, hitT*1.8)*pct : 0;
			ctx.fillStyle = 'rgba(255,255,255,.12)';
			ctx.fillRect(8, 8, 54, 6);
			ctx.fillStyle = '#ffcc44';
			ctx.fillRect(8, 8, 54*fill, 6);
			ctx.fillStyle = '#ffcc44'; ctx.font='8px Arial'; ctx.textAlign='left';
			ctx.fillText('STORE '+Math.round(pct*100)+'%', 8, 22);
		}

		function floatNum(x, y, age, text, color){
			const a = Math.max(0, 1-age*1.35);
			if(a<=0) return;
			ctx.globalAlpha = a;
			ctx.fillStyle = color;
			ctx.font = 'bold 11px Arial';
			ctx.textAlign = 'center';
			ctx.fillText(text, x, y-26-age*18);
			ctx.globalAlpha = 1;
		}

		if(ph.shape==='allyOrb' || fx.includes('healSelf') || fx.includes('damageHeal')){
			if(parked || anyHit) floatNum(px+10, py-6, parked? (t%1.2):hitT, '+'+Math.max(1, Math.round(pow*5)), '#44ff88');
		} else {
			for(const sh of shots){
				if(!sh.hit && !(parked && sh.spawned)) continue;
				const age = parked ? (t%1.3) : sh.hitAge;
				const ox = dummyX + (sh.i-(n-1)/2)*7;
				if(hitDmg>0) floatNum(ox, dummyY, age, String(hitDmg), '#fff');
			}
		}
		if(anyHit || parked){
			if(fx.includes('burn') && rawDmg>0){
				ctx.fillStyle='#ff6a00'; ctx.font='bold 9px Arial'; ctx.textAlign='center';
				ctx.fillText(Math.round(rawDmg*0.15)+' DoT', dummyX+20, dummyY-44-hitT*6);
			}
			if(fx.includes('poison') && rawDmg>0){
				ctx.fillStyle='#44dd44'; ctx.font='bold 9px Arial'; ctx.textAlign='center';
				ctx.fillText(Math.round(rawDmg*0.10)+' DoT', dummyX-20, dummyY-44-hitT*6);
			}
			if(fx.includes('stun')){ ctx.fillStyle='#ffff44'; ctx.font='bold 9px Arial'; ctx.textAlign='center'; ctx.fillText('STUN 0.3s', dummyX, dummyY-56); }
			if(fx.includes('lifesteal') && rawDmg>0) floatNum(px+8, py-8, hitT, '+'+Math.round(rawDmg*0.2), '#bb44ff');
			if(fx.includes('freeze')){ ctx.fillStyle='#88ddff'; ctx.font='bold 9px Arial'; ctx.textAlign='center'; ctx.fillText('SLOW 1.5s', dummyX, dummyY-8); }
			if(fx.includes('blind')){ ctx.fillStyle='#bb88ff'; ctx.font='bold 9px Arial'; ctx.textAlign='center'; ctx.fillText('BLIND '+(0.5*pow).toFixed(1)+'s', dummyX, dummyY+6); }
			if(fx.includes('knockback')){ ctx.fillStyle='#ff8800'; ctx.font='bold 9px Arial'; ctx.textAlign='center'; ctx.fillText('LAUNCH '+kbDist.toFixed(0)+'px', dummyX, 14); }
			if(fx.includes('shield')){ ctx.fillStyle='#88bbff'; ctx.font='bold 9px Arial'; ctx.textAlign='center'; ctx.fillText('+'+Math.round(pow*3)+' SHIELD', px+36, 18); }
			if(dmgInfo.blast>0){ ctx.fillStyle='#ff6600'; ctx.font='bold 9px Arial'; ctx.textAlign='center'; ctx.fillText('~'+Math.round(dmgInfo.blast)+' blast', dummyX, dummyY-16); }
		}

		if(demoInflated){
			ctx.fillStyle='rgba(200,210,255,.7)'; ctx.font='8px Arial'; ctx.textAlign='left';
			ctx.fillText('demo ×'+n, 6, H-4);
		}
		if(focus==='evenDelay' || focus==='randomDelay'){
			ctx.fillStyle='rgba(200,210,255,.75)'; ctx.font='8px Arial'; ctx.textAlign='right';
			ctx.fillText(focus==='evenDelay' ? ('even '+(Number(ph.evenDelayDuration||0.5).toFixed(1))+'s') : ('rand 0–'+(Number(ph.randomDelayMax||0.5).toFixed(1))+'s'), W-6, H-4);
		}
	}
	function sizeCanvas(c, cssH){
		const r = c.getBoundingClientRect();
		const w = Math.max(40, Math.round(r.width));
		const h = cssH || Math.max(40, Math.round(r.height));
		if(c.width !== w) c.width = w;
		if(c.height !== h) c.height = h;
	}
	function startDoodles(){
		stopDoodles();
		const tick = () => {
			doodleTime += 0.03;
			document.querySelectorAll('.nb-doodle').forEach(c => {
				const idx = +c.dataset.idx;
				if(builderSpell && builderSpell.phases[idx]) {
					sizeCanvas(c, c.classList.contains('nb-doodle-big') ? 220 : 78);
					drawDoodle(c, builderSpell.phases[idx], doodleTime, idx);
				}
			});
			doodleRAF = requestAnimationFrame(tick);
		};
		doodleRAF = requestAnimationFrame(tick);
	}
	function stopDoodles(){ if(doodleRAF){ cancelAnimationFrame(doodleRAF); doodleRAF=null; } }

	/* ---------- hover / help ---------- */
	function ensureTip(){
		if(hoverTip) return hoverTip;
		hoverTip = document.createElement('div');
		hoverTip.className = 'nb-hover-tip';
		hoverTip.style.display = 'none';
		document.body.appendChild(hoverTip);
		return hoverTip;
	}
	function showTip(html, ev){
		const el = ensureTip();
		el.classList.remove('nb-tip-fx');
		el.innerHTML = html;
		el.style.display = 'block';
		el.classList.remove('show');
		void el.offsetWidth;
		el.classList.add('show');
		moveTip(ev);
	}
	function placeTip(el, x, y){
		el.style.left = x+'px';
		el.style.top = y+'px';
		const r = el.getBoundingClientRect();
		if(r.right > window.innerWidth - 8) el.style.left = Math.max(8, window.innerWidth - r.width - 8)+'px';
		if(r.bottom > window.innerHeight - 8) el.style.top = Math.max(8, window.innerHeight - r.height - 8)+'px';
	}
	function moveTip(ev){
		if(!hoverTip || hoverTip.style.display==='none' || hoverTip.classList.contains('nb-tip-fx')) return;
		placeTip(hoverTip, ev.clientX+14, ev.clientY+14);
	}
	function hideTip(){
		stopSim();
		if(!hoverTip) return;
		hoverTip.classList.remove('show','nb-tip-fx');
		hoverTip.style.display = 'none';
		hoverTip.innerHTML = '';
	}
	function showCombatTip(html, chip, fx, ph, idx){
		const el = ensureTip();
		el.classList.add('nb-tip-fx');
		el.innerHTML = html + '<canvas class="nb-sim-pop" width="280" height="140"></canvas>';
		el.style.display = 'block';
		el.classList.remove('show');
		const r = chip.getBoundingClientRect();
		placeTip(el, r.right+10, r.top);
		void el.offsetWidth;
		el.classList.add('show');
		placeTip(el, r.right+10, r.top);
		startSim(el.querySelector('.nb-sim-pop'), fx, ph, idx);
	}
	function showEffectTip(html, chip, fx, ph){
		showCombatTip(html, chip, fx, ph, selectedPhase);
	}
	function openHelp(kind, key){
		const h = helpText(kind, key);
		const dictHtml = (typeof dictEntryHtml === 'function') ? dictEntryHtml(kind, key) : '';
		let box = document.getElementById('nbHelp');
		if(!box){
			box = document.createElement('div');
			box.id='nbHelp'; box.className='nb-help';
			box.innerHTML = '<div class="nb-help-card"><h3></h3><div class="nb-help-dict"></div><p class="nb-help-body"></p><p class="nb-help-extra"></p><button class="btn btn-primary" type="button">Got it</button></div>';
			document.body.appendChild(box);
			box.addEventListener('click', e => { if(e.target===box || e.target.tagName==='BUTTON') box.classList.remove('open'); });
		}
		const titleEl = box.querySelector('h3');
		const dictEl = box.querySelector('.nb-help-dict');
		const bodyEl = box.querySelector('.nb-help-body');
		const extraEl = box.querySelector('.nb-help-extra');
		if(dictHtml){
			titleEl.style.display = 'none';
			bodyEl.style.display = 'none';
			extraEl.style.display = 'none';
			dictEl.style.display = '';
			dictEl.innerHTML = dictHtml;
		} else {
			titleEl.style.display = '';
			bodyEl.style.display = '';
			extraEl.style.display = '';
			dictEl.style.display = 'none';
			dictEl.innerHTML = '';
			titleEl.textContent = h.title;
			bodyEl.textContent = h.body;
			extraEl.textContent = h.extra;
		}
		box.classList.add('open');
	}

	function optionMetrics(kind, key, idx){
		const base = cloneSpell();
		const alt = cloneSpell();
		if(kind==='shape') alt.phases[idx].shape = key;
		else if(kind==='behavior') alt.phases[idx].behavior = key;
		else {
			const list = alt.phases[idx].effects.slice();
			if(!list.includes(key)) list.push(key);
			alt.phases[idx].effects = list;
		}
		const dMana = displayedCost(alt) - displayedCost(base);
		const dCtrl = calcSpellControlReq(alt) - calcSpellControlReq(base);
		const bd = estimatePhaseDmg(base.phases[idx], idx);
		const ad = estimatePhaseDmg(alt.phases[idx], idx);
		let dmgLine = '';
		if(kind==='shape' && key==='meteor'){
			dmgLine = 'Damage <b>'+ad.lo+'–'+ad.hi+'</b> (low up close, high at max range)';
		} else if(ad.range){
			dmgLine = 'Damage <b>'+ad.lo+'–'+ad.hi+'</b>';
		} else {
			dmgLine = 'Damage '+fmtDelta(Math.round(ad.per-bd.per), '');
		}
		return '<div class="ht-name">'+(kind==='shape'?(SHAPES[key]||{}).label:kind==='behavior'?(BEHAVIORS[key]||{}).label:(EFFECTS[key]||{}).label)+'</div>'+
			'<div class="ht-row"><span>Mana</span>'+fmtDelta(dMana,'')+'</div>'+
			'<div class="ht-row"><span>Control</span>'+fmtDelta(dCtrl,'')+'</div>'+
			'<div class="ht-row"><span>Hit</span><span>'+dmgLine+'</span></div>';
	}

	function isolatedCosts(ph){
		const idx = (builderSpell && builderSpell.phases) ? builderSpell.phases.indexOf(ph) : 0;
		const current = displayedCost(builderSpell);
		function vs(mut){
			const alt = cloneSpell();
			if(!alt.phases[idx]) return 0;
			mut(alt.phases[idx]);
			return current - displayedCost(alt);
		}
		const countKey = ph.behavior==='aroundSelf' ? 'aroundSelfCount' : 'count';
		return {
			speed: Math.round(vs(p => { p.speed = 1; })),
			duration: Math.round(vs(p => { p.duration = 1; })),
			power: Math.round(vs(p => { p.power = 0; })),
			size: Math.round(vs(p => { p.width = 1; p.height = 1; })),
			count: Math.round(vs(p => { p[countKey] = 1; })),
		};
	}

	function phaseEffectiveCount(ph){
		if(!ph) return 1;
		if(ph.behavior==='aroundSelf') return Math.max(1, ph.aroundSelfCount||4);
		if(ph.shape==='same') return 1;
		return Math.max(1, ph.count||1);
	}
	function spellProjCap(){
		return editingSlot===9 ? 200 : 50;
	}
	function spellTotalProjectiles(exceptIdx){
		if(!builderSpell||!builderSpell.phases) return 1;
		return builderSpell.phases.reduce((prod, ph, i) => {
			if(i===exceptIdx) return prod;
			return prod * phaseEffectiveCount(ph);
		}, 1);
	}
	function necroSummonSizeCap(ph){
		const isUlt = editingSlot===9;
		const isNecro = (typeof STATE!=='undefined') && (STATE.mageClass==='necromancer' || STATE.mageClass2==='necromancer');
		if(ph && ph.shape==='summon' && isNecro && typeof necroSummonStatCaps==='function'){
			const t = ph.necroSummonType;
			const id = (t && t!=='random' && t!=='') ? t : 'imp';
			return necroSummonStatCaps(id, isUlt).sizeMax;
		}
		return 2;
	}

	function limits(idx){
		const ph = builderSpell.phases[idx];
		const isUlt = editingSlot===9;
		const isTransformLoadout = STATE.loadouts[STATE.activeLoadoutIdx]?.type==='transformation';
		const spellHasDomain = builderSpell.phases[0]?.behavior==='domain';
		const spellHasTransformation = builderSpell.phases[0]?.behavior==='transformation';
		const transEnhanced = (spellHasTransformation && idx>0) || isTransformLoadout;
		const isBig = ph.shape==='solidify'||ph.shape==='wall';
		const rankPowerCap = getRankMaxPower();
		const isNecro = (typeof STATE!=='undefined') && (STATE.mageClass==='necromancer' || STATE.mageClass2==='necromancer');
		const necroType = ph.shape==='summon' && isNecro ? (ph.necroSummonType||'imp') : '';
		const necroCaps = (ph.shape==='summon' && isNecro && typeof necroSummonStatCaps==='function')
			? necroSummonStatCaps((necroType && necroType!=='random' && necroType!=='') ? necroType : 'imp', isUlt)
			: null;
		const basePowerMax = necroCaps ? necroCaps.powerMax : ((spellHasDomain && idx>0) ? 10 : transEnhanced ? 15 : (isUlt?20:10));
		const sizeMax = ph.shape==='summon' ? (necroCaps ? necroCaps.sizeMax : 2) : (transEnhanced ? 5.5 : isBig?(isUlt?10:6):(isUlt?8:3));
		const durMax = ph.shape==='summon' ? (necroCaps ? necroCaps.durMax : (isUlt?90:60)) : ((spellHasDomain && idx>0) ? 6 : ((ph.behavior==='stationary'||ph.behavior==='selfCast'||ph.behavior==='ground'||ph.behavior==='control'||ph.shape==='beam'||(ph.effects||[]).includes('solidify'))?30:isUlt?10:5));
		const speedMax = necroCaps ? necroCaps.speedMax : 10;
		const others = spellTotalProjectiles(idx);
		const countMax = (spellHasDomain && idx>0) ? 5 : Math.max(1, Math.floor(spellProjCap() / Math.max(1, others)));
		const powerMax = necroCaps ? necroCaps.powerMax : Math.min(basePowerMax, rankPowerCap);
		return { powerMax, sizeMax, durMax, speedMax, countMax };
	}

	function lockInfo(kind, key, idx){
		const vowLockedEffects = new Set();
		const vowLockedShapes = new Set();
		for(const v of STATE.vows||[]){
			if(!v) continue;
			if(v.sacrifice==='effects') for(const fx of v.sacrificedEffects||[]) vowLockedEffects.add(fx);
			if(v.sacrifice==='shapes') for(const sh of v.sacrificedShapes||[]) vowLockedShapes.add(sh);
		}
		const isUlt = editingSlot===9;
		const isTransformLoadout = STATE.loadouts[STATE.activeLoadoutIdx]?.type==='transformation';
		if(kind==='shape'){
			const itemReq = SHAPE_ITEM_REQ[key];
			if(vowLockedShapes.has(key)) return 'Locked by vow';
			if(itemReq && !hasItemEquipped(itemReq)) return 'Requires '+(ITEM_DB[itemReq]?.name||itemReq);
			if(!isShapeUnlocked(key)) return 'Requires '+(MAGE_RANKS[SHAPE_RANK_REQ[key]]?.name||'higher rank');
		}
		if(kind==='behavior'){
			const v = BEHAVIORS[key];
			const itemReq = BEH_ITEM_REQ[key];
			if(itemReq && !hasItemEquipped(itemReq)) return 'Requires '+(ITEM_DB[itemReq]?.name||itemReq);
			if(!isBehaviorUnlocked(key)) return 'Requires '+(MAGE_RANKS[BEHAVIOR_RANK_REQ[key]]?.name||'higher rank');
			if(v && v.ultimateOnly && (!isUlt || idx>0)) return 'Ultimate phase 1 only';
			if(key==='transformation' && isTransformLoadout) return 'Not in a transformation loadout';
			if(builderSpell.phases[0]?.behavior==='domain' && idx>0 && key!=='homing') return 'Domain forces Homing';
		}
		if(kind==='effect'){
			const itemReq = EFFECT_ITEM_REQ[key];
			if(vowLockedEffects.has(key)) return 'Locked by vow';
			if(itemReq && !hasItemEquipped(itemReq)) return 'Requires '+(ITEM_DB[itemReq]?.name||itemReq);
			if(!isEffectUnlocked(key)) return 'Requires '+(MAGE_RANKS[EFFECT_RANK_REQ[key]]?.name||'higher rank');
		}
		return '';
	}

	/* ---------- render ---------- */
	function captureBuilderScroll(){
		const body = document.querySelector('#spellModal .modal-body');
		const editor = document.getElementById('nbEditor');
		return {
			winX: window.scrollX || 0,
			winY: window.scrollY || 0,
			body: body ? body.scrollTop : 0,
			editor: editor ? editor.scrollTop : 0,
			panels: Array.from(document.querySelectorAll('#nbEditor .nb-panel')).map(el => el.scrollTop)
		};
	}
	function restoreBuilderScroll(s){
		if(!s) return;
		const apply = () => {
			window.scrollTo(s.winX, s.winY);
			const body = document.querySelector('#spellModal .modal-body');
			if(body) body.scrollTop = s.body;
			const editor = document.getElementById('nbEditor');
			if(editor) editor.scrollTop = s.editor;
			document.querySelectorAll('#nbEditor .nb-panel').forEach((el, i) => {
				if(s.panels[i] != null) el.scrollTop = s.panels[i];
			});
		};
		apply();
		requestAnimationFrame(apply);
	}

	window.renderNewSpellBuilder = function(){
		if(!builderSpell) return;
		const savedScroll = captureBuilderScroll();
		if(selectedPhase >= builderSpell.phases.length) selectedPhase = 0;
		for(const v of STATE.vows||[]){
			if(!v) continue;
			if(v.sacrifice==='effects'){
				const locked = new Set(v.sacrificedEffects||[]);
				builderSpell.phases.forEach(ph => { ph.effects = (ph.effects||[]).filter(fx => !locked.has(fx)); });
			}
		}
		builderSpell.phases.forEach(ph => {
			if(ph.shape==='summon'){
				ph.behavior = 'straight';
				const sizeCap = necroSummonSizeCap(ph);
				if((ph.width||1) > sizeCap) ph.width = sizeCap;
				if((ph.height||1) > sizeCap) ph.height = sizeCap;
			}
			ph.effects = (ph.effects||[]).filter(fx => {
				if(fx==='phaseFork') return true;
				if(EFFECT_ITEM_REQ[fx] && !hasItemEquipped(EFFECT_ITEM_REQ[fx])) return false;
				return isEffectUnlocked(fx);
			});
		});
		const stats = computeStats();
		const cost = displayedCost(builderSpell);
		const req = calcSpellControlReq(builderSpell);
		const can = stats.magicControl >= req;
		const isUlt = editingSlot===9;
		const vb = calcVowBoostsForSlot(editingSlot);
		const maxPhases = builderSpell.phases[0]?.behavior==='domain' ? 2 : builderSpell.phases[0]?.behavior==='transformation' ? 4 : (isUlt?5:3)+(vb.phases||0);

		const meta = document.getElementById('spellMeta');
		if(meta){
			meta.className = 'nb-head-main';
			meta.innerHTML =
				'<div class="nb-slot-tag">'+(isUlt?'Ultimate  ·  Slot 0':'Slot '+(editingSlot+1))+'</div>'+
				'<input class="nb-title-input" id="spellNameInput" maxlength="30" value="'+escHtml(builderSpell.name)+'"/>'+
				'<div class="nb-cost-wrap">'+
					'<div class="nb-chip">Mana <b style="color:#6cb6ff">'+cost+(isUlt?'\u26A1':'')+'</b></div>'+
					'<div class="nb-chip">Control <b style="color:'+(can?'#2ecc71':'#e74c3c')+'">'+req+'</b> / '+stats.magicControl+'</div>'+
					'<div class="nb-chip">Phases <b>'+builderSpell.phases.length+'</b>/'+maxPhases+'</div>'+
					'<div class="nb-chip">Projectiles <b'+(spellTotalProjectiles()>spellProjCap()?' style="color:#e74c3c"':'')+'>'+spellTotalProjectiles()+'</b>/'+spellProjCap()+'</div>'+
				'</div>';
			const nameEl = document.getElementById('spellNameInput');
			if(nameEl) nameEl.addEventListener('input', e => { builderSpell.name = e.target.value || 'Unnamed'; });
		}
		const desc = document.getElementById('spellDesc');
		if(desc) desc.style.display = 'none';

		const strip = document.getElementById('nbPhaseStrip');
		if(!strip) return;
		strip.innerHTML = '';
		builderSpell.phases.forEach((ph, idx) => {
			if(idx>0){
				const link = document.createElement('div');
				link.className = 'nb-link';
				const prev = builderSpell.phases[idx-1];
				const trig = ((prev.effects||[]).includes('phaseFork')) ? 'phaseFork' : (prev.nextTrigger||'onHit');
				link.innerHTML = '<div class="nb-link-line"></div><button type="button" class="nb-link-btn" data-from="'+(idx-1)+'">'+(PHASE_LINKS[trig]?.label||trig)+'</button><div class="nb-link-line"></div>';
				link.querySelector('button').addEventListener('click', ev => { ev.stopPropagation(); openLinkPop(idx-1, ev.currentTarget); });
				strip.appendChild(link);
			}
			const box = document.createElement('div');
			box.className = 'nb-phase-box'+(idx===selectedPhase?' selected':'');
			box.innerHTML =
				'<div class="nb-phase-top"><strong>Phase '+(idx+1)+'</strong>'+
					(builderSpell.phases.length>1?'<button class="nb-phase-remove" data-idx="'+idx+'">\u2715</button>':'')+
				'</div>'+
				'<div class="nb-phase-metrics"><span>Mana '+phaseManaShare(builderSpell,idx)+'</span><span>Ctrl '+phaseCtrl(ph)+'</span></div>'+
				'<canvas class="nb-doodle" data-idx="'+idx+'"></canvas>';
			box.addEventListener('click', e => {
				if(e.target.closest('.nb-phase-remove')) return;
				selectedPhase = idx;
				renderNewSpellBuilder();
			});
			const rm = box.querySelector('.nb-phase-remove');
			if(rm) rm.addEventListener('click', e => {
				e.stopPropagation();
				builderSpell.phases.splice(idx,1);
				if(selectedPhase>=builderSpell.phases.length) selectedPhase = builderSpell.phases.length-1;
				renderNewSpellBuilder();
			});
			strip.appendChild(box);
		});
		const addBtn = document.getElementById('addPhaseBtn');
		if(addBtn) addBtn.style.display = builderSpell.phases.length>=maxPhases ? 'none' : '';

		renderEditor(selectedPhase);
		startDoodles();
		restoreBuilderScroll(savedScroll);
	};

	function setProp(idx, prop, val, rerender){
		const ph = builderSpell.phases[idx];
		if(!ph) return;
		if(prop.includes('.')){
			const [obj,key]=prop.split('.');
			if(!ph[obj]) ph[obj]={};
			ph[obj][key]=val;
		} else {
			ph[prop]=val;
			if(prop==='shape' && val==='summon'){
				ph.behavior='straight';
				const sizeCap = necroSummonSizeCap(ph);
				if((ph.width||1)>sizeCap) ph.width=sizeCap;
				if((ph.height||1)>sizeCap) ph.height=sizeCap;
			}
		}
		if(rerender) renderNewSpellBuilder();
		else {
			updateLiveReadouts(idx);
			const meta = document.getElementById('spellMeta');
			if(meta){
				const stats = computeStats();
				const cost = displayedCost(builderSpell);
				const req = calcSpellControlReq(builderSpell);
				const chips = meta.querySelectorAll('.nb-chip b');
				if(chips[0]) chips[0].textContent = cost+(editingSlot===9?'\u26A1':'');
				if(chips[1]){ chips[1].textContent = req; chips[1].style.color = stats.magicControl>=req?'#2ecc71':'#e74c3c'; }
				if(chips[3]){
					const tot = spellTotalProjectiles();
					chips[3].textContent = tot;
					chips[3].style.color = tot>spellProjCap()?'#e74c3c':'';
				}
			}
			document.querySelectorAll('.nb-phase-box').forEach((box, i) => {
				const ph = builderSpell.phases[i];
				if(!ph) return;
				const spans = box.querySelectorAll('.nb-phase-metrics span');
				if(spans[0]) spans[0].textContent = 'Mana '+phaseManaShare(builderSpell, i);
				if(spans[1]) spans[1].textContent = 'Ctrl '+phaseCtrl(ph);
			});
		}
	}

	function updateLiveReadouts(idx){
		const ph = builderSpell.phases[idx];
		const iso = isolatedCosts(ph);
		const dmg = estimatePhaseDmg(ph, idx);
		const shapeDmg = estimateShapeDmg(ph);
		document.querySelectorAll('[data-impact]').forEach(el => {
			const k = el.dataset.impact;
			if(k==='speed') el.textContent = iso.speed+' mana';
			if(k==='duration') el.textContent = iso.duration+' mana';
			if(k==='power') el.textContent = iso.power+' mana  ·  '+shapeDmg.text+' dmg/shot';
			if(k==='size') el.textContent = iso.size+' mana';
			if(k==='count') el.textContent = iso.count+' mana  ·  ctrl '+phaseCtrl(ph)+'  ·  '+dmg.text+' dmg';
		});
		document.querySelectorAll('[data-live]').forEach(el => {
			const p = el.dataset.live;
			const v = ph[p];
			el.textContent = typeof v==='number' ? (Number.isInteger(v)?v:v.toFixed(1)) : v;
		});
	}

	function catalogEntries(kind){
		const src = kind==='shape' ? SHAPES : BEHAVIORS;
		const rank = kind==='shape' ? SHAPE_RANK_REQ : BEHAVIOR_RANK_REQ;
		return Object.entries(src).sort((a,b)=>(rank[a[0]]??99)-(rank[b[0]]??99)||a[1].controlReq-b[1].controlReq)
			.map(([k,v])=>({key:k,icon:v.icon,label:v.label}));
	}
	function dropdown(kind, idx, current, entries){
		const wrap = document.createElement('div');
		wrap.className = 'nb-dd';
		const cur = entries.find(e=>e.key===current) || entries[0];
		wrap.innerHTML = '<button type="button" class="nb-dd-btn"><span>'+(cur?((cur.icon||'')+' '+cur.label):current)+'</span><span>▾</span></button><div class="nb-dd-panel"></div>';
		const panel = wrap.querySelector('.nb-dd-panel');
		entries.forEach(ent => {
			const lock = lockInfo(kind, ent.key, idx);
			const opt = document.createElement('div');
			opt.className = 'nb-dd-opt'+(ent.key===current?' selected':'')+(lock?' locked':'');
			opt.innerHTML = '<span>'+(ent.icon||'')+' '+ent.label+'</span>'+(lock?'<span style="font-size:10px;color:#f39c12">'+lock+'</span>':'')+'<button type="button" class="nb-q">?</button>';
			opt.addEventListener('mouseenter', ev => {
				const preview = Object.assign({}, builderSpell.phases[idx], kind==='shape' ? {shape:ent.key} : {behavior:ent.key});
				showCombatTip(optionMetrics(kind, ent.key, idx)+(lock?'<div class="ht-row">'+lock+'</div>':''), opt, null, preview, idx);
			});
			opt.addEventListener('mousemove', moveTip);
			opt.addEventListener('mouseleave', hideTip);
			opt.querySelector('.nb-q').addEventListener('click', ev => { ev.stopPropagation(); openHelp(kind, ent.key); });
			opt.addEventListener('click', ev => {
				ev.preventDefault();
				ev.stopPropagation();
				if(lock) return;
				if(kind==='shape') setProp(idx,'shape',ent.key,true);
				else setProp(idx,'behavior',ent.key,true);
			});
			panel.appendChild(opt);
		});
		wrap.querySelector('.nb-dd-btn').addEventListener('click', ev => {
			ev.stopPropagation();
			document.querySelectorAll('.nb-dd.open').forEach(d => { if(d!==wrap) d.classList.remove('open'); });
			wrap.classList.toggle('open');
		});
		return wrap;
	}
	function cosmeticDropdown(current, entries, onPick, hoverFn, helpKind){
		const wrap = document.createElement('div');
		wrap.className = 'nb-dd';
		const cur = entries.find(e=>e.key===current) || entries[0];
		wrap.innerHTML = '<button type="button" class="nb-dd-btn"><span>'+(cur?((cur.icon||'')+' '+cur.label):current)+'</span><span>▾</span></button><div class="nb-dd-panel"></div>';
		const panel = wrap.querySelector('.nb-dd-panel');
		entries.forEach(ent => {
			const opt = document.createElement('div');
			opt.className = 'nb-dd-opt'+(ent.key===current?' selected':'');
			opt.innerHTML = '<span>'+(ent.icon||'')+' '+ent.label+'</span>'+(helpKind?'<button type="button" class="nb-q">?</button>':'');
			opt.addEventListener('mouseenter', ev => showTip(hoverFn?hoverFn(ent):('<div class="ht-name">'+ent.label+'</div>'), ev));
			opt.addEventListener('mousemove', moveTip);
			opt.addEventListener('mouseleave', hideTip);
			const q = opt.querySelector('.nb-q');
			if(q) q.addEventListener('click', ev => { ev.stopPropagation(); openHelp(helpKind, ent.key); });
			opt.addEventListener('click', ev => { ev.preventDefault(); ev.stopPropagation(); onPick(ent.key); });
			panel.appendChild(opt);
		});
		wrap.querySelector('.nb-dd-btn').addEventListener('click', ev => {
			ev.stopPropagation();
			document.querySelectorAll('.nb-dd.open').forEach(d => { if(d!==wrap) d.classList.remove('open'); });
			wrap.classList.toggle('open');
		});
		return wrap;
	}
	function selectRow(label, value, options, onChange){
		const wrap = document.createElement('div');
		wrap.className = 'nb-section';
		const lbl = document.createElement('div');
		lbl.className = 'nb-section-lbl';
		lbl.textContent = label;
		wrap.appendChild(lbl);
		wrap.appendChild(cosmeticDropdown(
			String(value),
			options.map(o => ({ key:String(o.value), label:o.label, icon:o.icon||'' })),
			k => onChange(k)
		));
		return wrap;
	}

	function sliderRow(idx, prop, label, min, max, step, impactKey){
		const ph = builderSpell.phases[idx];
		const row = document.createElement('div');
		row.className = 'nb-slider';
		row.innerHTML = '<div class="nb-section-lbl">'+label+' <span data-live="'+prop+'">'+(typeof ph[prop]==='number'?ph[prop].toFixed(1):ph[prop])+'</span></div>'+
			'<div class="nb-slider-row"><input type="range" min="'+min+'" max="'+max+'" step="'+step+'" value="'+ph[prop]+'"/>'+
			'<span class="nb-impact" data-impact="'+impactKey+'"></span></div>';
		row.querySelector('input').addEventListener('input', e => {
			const v = parseFloat(e.target.value);
			setProp(idx, prop, v, false);
		});
		return row;
	}
	function numberRow(idx, prop, label, min, max, impactKey){
		const ph = builderSpell.phases[idx];
		const row = document.createElement('div');
		row.className = 'nb-slider';
		let cur = Math.round(ph[prop]||min);
		if(!Number.isFinite(cur)) cur = min;
		cur = Math.max(min, Math.min(max, cur));
		if(ph[prop]!==cur) ph[prop]=cur;
		row.innerHTML = '<div class="nb-section-lbl">'+label+' <span data-live="'+prop+'">'+cur+'</span><span class="nb-hint"> max '+max+'</span></div>'+
			'<div class="nb-slider-row"><input type="number" min="'+min+'" max="'+max+'" step="1" value="'+cur+'"/>'+
			'<span class="nb-impact" data-impact="'+impactKey+'"></span></div>';
		const inp = row.querySelector('input');
		const apply = () => {
			let v = Math.round(+inp.value);
			if(!Number.isFinite(v)) v = min;
			v = Math.max(min, Math.min(max, v));
			inp.value = String(v);
			const needFull = prop==='count' || prop==='aroundSelfCount';
			setProp(idx, prop, v, needFull);
			const live = row.querySelector('[data-live="'+prop+'"]');
			if(live) live.textContent = v;
		};
		inp.addEventListener('change', apply);
		inp.addEventListener('keydown', e => {
			if(e.key==='Enter'){ e.preventDefault(); apply(); inp.blur(); }
		});
		return row;
	}

	function specialShape(ph, idx, host){
		if(ph.shape==='chain'){
			host.appendChild(sliderRow(idx,'chainStunTime','Chain Stun',0,3,0.1,'duration'));
		}
		if(ph.shape==='polygon'){
			if(!ph.polygonSides) ph.polygonSides=6;
			host.appendChild(sliderRow(idx,'polygonSides','Sides',3,12,1,'size'));
		}
		if(ph.shape==='vortex'){
			if(ph.vortexDuration==null) ph.vortexDuration=1;
			host.appendChild(sliderRow(idx,'vortexDuration','Vortex Duration',0.5,4,0.5,'duration'));
		}
		if(ph.shape==='summon'){
			if(ph.summonRange==null) ph.summonRange=0;
			if(ph.necroSummonType==null) ph.necroSummonType='random';
			const isNecro = (typeof STATE!=='undefined') && (STATE.mageClass==='necromancer' || STATE.mageClass2==='necromancer');
			const isUltSlot = editingSlot===9;
			if(isNecro && typeof isUltOnlyNecroType==='function' && ph.necroSummonType && isUltOnlyNecroType(ph.necroSummonType) && !isUltSlot){
				ph.necroSummonType='random';
			}
			if(isNecro && typeof getSummonCatalog==='function'){
				const cat = getSummonCatalog().filter(e => isUltSlot || typeof isUltOnlyNecroType!=='function' || !isUltOnlyNecroType(e.id));
				host.appendChild(selectRow('Necro Summon', ph.necroSummonType==null?'random':ph.necroSummonType, [
					{value:'random',label:'Random Summon'},
					{value:'',label:'Choose on cast'},
					...cat.map(e => ({value:e.id, label:e.name+'  ('+e.points+' pt'+(e.points===1?'':'s')+')'}))
				], v => setProp(idx,'necroSummonType', v, true)));
				const hint = document.createElement('div');
				hint.className='nb-hint';
				const cap = (typeof NECRO_POINT_CAP==='number')?NECRO_POINT_CAP:15;
				const dcap = (typeof NECRO_DOMAIN_POINT_CAP==='number')?NECRO_DOMAIN_POINT_CAP:50;
				const picked = cat.find(e => e.id===ph.necroSummonType);
				let manaLine = '';
				if(picked && editingSlot!==9 && typeof necroRaiseManaCosts==='function'){
					const opts = Object.assign({}, builderManaOpts(), { spell: builderSpell });
					const costs = necroRaiseManaCosts(picked.id, opts);
					if(costs.total > 0) manaLine = '  ·  '+costs.total+' total mana';
				}
				hint.textContent = picked
					? picked.name+' costs '+picked.points+' / '+cap+' points ('+dcap+' in a Domain).'+manaLine
					: ph.necroSummonType===''
						? 'Choose a discovered foe when you cast. Raid/secret bosses only from the Ultimate slot.'
						: cat.length
							? 'Random Summon picks a discovered foe you can afford. Raid/secret bosses only from the Ultimate slot. Point cap '+cap+' (Domain '+dcap+').'
							: 'Defeat enemies to unlock necro summons. Random Summon and Choose on cast still work.';
				host.appendChild(hint);
			}
			host.appendChild(sliderRow(idx,'summonRange','+Range',0,10,1,'count'));
			const statHint = document.createElement('div');
			statHint.className='nb-hint';
			const hintType = (ph.necroSummonType && ph.necroSummonType!=='random') ? ph.necroSummonType : 'imp';
			const caps = (isNecro && typeof necroSummonStatCaps==='function')
				? necroSummonStatCaps(hintType, isUltSlot)
				: { sizeMax:2, durMax:isUltSlot?90:60 };
			statHint.textContent = isNecro
				? 'Speed moves the summon and slightly raises attack speed. Spell Power sets health and necro damage. Duration max '+caps.durMax+'s for every necro summon. Size scales the body and projectiles (max '+caps.sizeMax+'× here). Ultimate summons under 6 points can be buffed further; raid bosses stay at standard caps. Buff mana scales with point cost.'
				: 'Speed moves the summon. Spell Power sets health. Duration is lifetime in seconds. Size scales the body up to 2×.';
			host.appendChild(statHint);
			host.appendChild(selectRow('Approach', !!ph.summonClose, [
				{value:'false',label:'Stay at range'},
				{value:'true',label:'Follow enemy'},
			], v => setProp(idx,'summonClose', v==='true', true)));
			host.appendChild(selectRow('Orders', !!ph.summonSelfReliance, [
				{value:'false',label:'Follow cursor'},
				{value:'true',label:'Lock on to enemy'},
			], v => setProp(idx,'summonSelfReliance', v==='true', true)));
		}
	}
	function specialBeh(ph, idx, host){
		if(ph.behavior==='aroundSelf'){
			if(!ph.aroundSelfCount) ph.aroundSelfCount=4;
			host.appendChild(numberRow(idx,'aroundSelfCount','Around Self Count',1,limits(idx).countMax,'count'));
			host.appendChild(sliderRow(idx,'aroundSelfRadius','Around Self Radius',20,150,5,'size'));
		}
		if(ph.behavior==='rain'){
			if(!ph.rainHeight) ph.rainHeight=150;
			host.appendChild(sliderRow(idx,'rainHeight','Rain Height',50,800,10,'size'));
			const lab = document.createElement('label');
			lab.className='nb-toggle';
			lab.innerHTML = '<span>Stacked Rain (+50 mana)</span><input type="checkbox" '+(ph.stackedRain?'checked':'')+'/>';
			lab.querySelector('input').addEventListener('change', e => setProp(idx,'stackedRain',e.target.checked,true));
			host.appendChild(lab);
		}
		if(ph.behavior==='barrage'){
			if(!ph.barrageHeight) ph.barrageHeight=200;
			host.appendChild(sliderRow(idx,'barrageHeight','Barrage Spread',30,600,10,'size'));
		}
		if(ph.behavior==='orbit'){
			host.appendChild(sliderRow(idx,'orbitRadius','Orbit Radius',30,200,5,'size'));
			host.appendChild(sliderRow(idx,'orbitSpeed','Orbit Speed',0.5,8,0.5,'speed'));
			host.appendChild(sliderRow(idx,'orbitDuration','Orbit Duration',0.5,5,0.1,'duration'));
		}
		if(ph.behavior==='ground'){
			if(!ph.groundRadius) ph.groundRadius=200;
			host.appendChild(selectRow('Auto Lock-on', ph.groundAutoLock!==false, [
				{value:'true',label:'Yes — locks to nearest enemy'},
				{value:'false',label:'No — erupts at your feet'},
			], v => setProp(idx,'groundAutoLock', v==='true', true)));
			host.appendChild(sliderRow(idx,'groundRadius','Lock-on Radius',100,800,50,'size'));
		}
	}

	function appendDomainSettings(host, ph, idx){
		if(!ph.domainElement) ph.domainElement='burn';
		if(!ph.domainColor) ph.domainColor='#ff4400';
		if(!ph.domainPattern) ph.domainPattern='flames';
		const box = document.createElement('div');
		box.className='nb-special';
		box.innerHTML = '<div class="nb-special-title">Domain Expansion</div><div class="nb-section-lbl">Massive zone. Later phases fire from the edges with forced homing. Matching element spells gain +50% damage.</div>';
		box.appendChild(selectRow('Domain Element', ph.domainElement,
			DOMAIN_ELEMENTS.map(el=>({value:el,label:(EFFECTS[el]?.icon||'')+' '+(EFFECTS[el]?.label||el)})),
			v => setProp(idx,'domainElement',v,true)));
		const col = document.createElement('label');
		col.className='nb-toggle';
		col.innerHTML = '<span>Domain Color</span><input type="color" value="'+ph.domainColor+'"/>';
		col.querySelector('input').addEventListener('input', e => setProp(idx,'domainColor',e.target.value,false));
		box.appendChild(col);
		box.appendChild(selectRow('Visual Pattern', ph.domainPattern, [
			{value:'flames',label:'Flames'},{value:'crystals',label:'Crystals'},{value:'skulls',label:'Skulls'},
			{value:'lightning',label:'Lightning'},{value:'void',label:'Void'},{value:'stars',label:'Stars'},
		], v => setProp(idx,'domainPattern',v,true)));
		box.appendChild(sliderRow(idx,'duration','Duration',3,15,0.5,'duration'));
		host.appendChild(box);
	}
	function appendTransformSettings(host, ph, idx){
		if(!ph.transformAuraStyle) ph.transformAuraStyle='pulse';
		if(!ph.transformAuraColor) ph.transformAuraColor='#ff8800';
		if(!ph.transformAuraColor2) ph.transformAuraColor2='#ffffff';
		if(!ph.transformAuraStrength) ph.transformAuraStrength=1;
		if(!ph.transformBuffPoints) ph.transformBuffPoints={};
		if(!ph.transformLoadoutName) ph.transformLoadoutName='';
		const bp = ph.transformBuffPoints;
		const total=(bp.speed||0)+(bp.elemDmg||0)+(bp.tp?3:0)+(bp.health||0)+(bp.archmageElem?3:0)+(bp.summonAbsorb?5:0)+(bp.summonPower||0)+(bp.explosionImmunity?3:0)+(bp.elemImmunity?5:0);
		const rem=5-total;
		const box = document.createElement('div');
		box.className='nb-special';
		box.innerHTML = '<div class="nb-special-title">Transformation</div><div class="nb-section-lbl">Transforms for 60s and switches to a Transformation loadout (power 15, size 5.5, 4 phases).</div>';
		box.appendChild(selectRow('Aura Style', ph.transformAuraStyle, [
			{value:'pulse',label:'Pulse'},{value:'orbit',label:'Orbit'},{value:'spiral',label:'Spiral'},
			{value:'nova',label:'Nova'},{value:'veil',label:'Veil'},{value:'shatter',label:'Shatter'},
			{value:'corona',label:'Corona'},{value:'storm',label:'Storm'},
			{value:'powerleakage',label:'Power Leakage'},{value:'powersurge',label:'Power Surge'},
		], v => setProp(idx,'transformAuraStyle',v,true)));
		box.appendChild(sliderRow(idx,'transformAuraStrength','Aura Strength',1,10,1,'size'));
		const c1 = document.createElement('label'); c1.className='nb-toggle';
		c1.innerHTML = '<span>Aura Color</span><input type="color" value="'+ph.transformAuraColor+'"/>';
		c1.querySelector('input').addEventListener('input', e => setProp(idx,'transformAuraColor',e.target.value,false));
		const c2 = document.createElement('label'); c2.className='nb-toggle';
		c2.innerHTML = '<span>Secondary Color</span><input type="color" value="'+(ph.transformAuraColor2||'#ffffff')+'"/>';
		c2.querySelector('input').addEventListener('input', e => setProp(idx,'transformAuraColor2',e.target.value,false));
		box.appendChild(c1); box.appendChild(c2);
		const transLoadouts = (STATE.loadouts||[]).filter(l=>l.type==='transformation');
		box.appendChild(selectRow('Transformation Loadout', ph.transformLoadoutName||'',
			[{value:'',label:'— First found —'}].concat(transLoadouts.map(tl=>({value:tl.name,label:tl.name}))),
			v => setProp(idx,'transformLoadoutName',v,true)));
		const pts = document.createElement('div');
		pts.className='nb-section-lbl';
		pts.innerHTML = 'Buff Points: <b>'+rem+'</b> / 5 remaining'+(rem<0?' <span style="color:#e74c3c">Over budget</span>':'');
		box.appendChild(pts);
		const buffSlide = (key, label) => {
			const row = document.createElement('div');
			row.className='nb-slider';
			row.innerHTML = '<div class="nb-section-lbl">'+label+' <span>'+(bp[key]||0)+'</span></div>'+
				'<div class="nb-slider-row"><input type="range" min="0" max="5" step="1" value="'+(bp[key]||0)+'"/></div>';
			row.querySelector('input').addEventListener('input', e => setProp(idx,'transformBuffPoints.'+key, parseInt(e.target.value,10), true));
			box.appendChild(row);
		};
		buffSlide('speed','Speed (+15% / pt)');
		buffSlide('elemDmg','Elem Damage (+10% / pt)');
		if((bp.elemDmg||0)>0){
			box.appendChild(selectRow('Elem Type', bp.elemDmgType||'burn',
				['burn','freeze','poison','stun','lifesteal'].map(el=>({value:el,label:(EFFECTS[el]?.icon||'')+' '+(EFFECTS[el]?.label||el)})),
				v => setProp(idx,'transformBuffPoints.elemDmgType',v,true)));
		}
		const chk = (key, cost, label) => {
			const lab = document.createElement('label');
			lab.className='nb-toggle';
			lab.innerHTML = '<span>'+label+' ('+cost+' pts)</span><input type="checkbox" '+(bp[key]?'checked':'')+'/>';
			lab.querySelector('input').addEventListener('change', e => setProp(idx,'transformBuffPoints.'+key, e.target.checked, true));
			box.appendChild(lab);
		};
		chk('tp',3,'Ranger TP');
		buffSlide('health','Health (+15% / pt)');
		chk('archmageElem',3,'Archmage Elemental');
		chk('summonAbsorb',5,'Summon Absorb');
		buffSlide('summonPower','Summon Power (+10% / pt)');
		chk('explosionImmunity',3,'Explosion Immunity');
		chk('elemImmunity',5,'Elemental Immunity');
		host.appendChild(box);
	}
	function renderEditor(idx){
		const host = document.getElementById('nbEditor');
		if(!host) return;
		const ph = builderSpell.phases[idx];
		if(!ph){ host.innerHTML=''; return; }
		const isDomain = idx===0 && ph.behavior==='domain';
		const isTransform = idx===0 && ph.behavior==='transformation';
		const lim = limits(idx);
		if(ph.duration>lim.durMax) ph.duration=lim.durMax;
		if((ph.count||1)>lim.countMax) ph.count=lim.countMax;
		if((ph.aroundSelfCount||4)>lim.countMax) ph.aroundSelfCount=Math.min(ph.aroundSelfCount, lim.countMax);
		if((ph.speed||1)>lim.speedMax) ph.speed=lim.speedMax;
		if((ph.width||1)>lim.sizeMax) ph.width=lim.sizeMax;
		if((ph.height||1)>lim.sizeMax) ph.height=lim.sizeMax;
		if((ph.power||1)>lim.powerMax) ph.power=lim.powerMax;

		host.innerHTML = '';
		const fxPanel = document.createElement('div'); fxPanel.className='nb-panel';
		const rawPanel = document.createElement('div'); rawPanel.className='nb-panel';
		const doodlePanel = document.createElement('div'); doodlePanel.className='nb-panel';

		fxPanel.innerHTML = '<div class="nb-panel-title">Effects</div>';
		if(isDomain||isTransform){
			fxPanel.innerHTML += '<div class="nb-section-lbl">Effects are disabled on this phase.</div>';
		} else {
			FX_SECTIONS.forEach(sec => {
				const box = document.createElement('div');
				box.className='nb-fx-sec';
				box.innerHTML = '<h4>'+sec.title+'</h4><div class="nb-fx-grid"></div>';
				const grid = box.querySelector('.nb-fx-grid');
				sec.keys.forEach(k => {
					if(!EFFECTS[k]) return;
					const lock = lockInfo('effect', k, idx);
					const cat = EFFECTS[k].category;
					const exclusiveBlocked = !ph.effects.includes(k) && EFFECT_CATEGORIES[cat]?.exclusive && Object.entries(EFFECTS).some(([k2,v2])=>v2.category===cat && k2!==k && ph.effects.includes(k2));
					const solidifyBlocked = k==='solidify' && ['explosion','vortex','summon','allyOrb'].includes(ph.shape);
					const blocked = !!(lock || exclusiveBlocked || solidifyBlocked);
					const chip = document.createElement('div');
					chip.className='nb-fx'+(ph.effects.includes(k)?' active':'')+(blocked?' blocked':'');
					chip.innerHTML = (EFFECTS[k].icon||'')+' '+EFFECTS[k].label+' <button type="button" class="nb-q">?</button>';
					chip.addEventListener('mouseenter', () => {
						const preview = Object.assign({}, ph, { effects: ph.effects.includes(k) ? ph.effects : ph.effects.concat([k]) });
						showEffectTip(optionMetrics('effect', k, idx)+'<div class="ht-row"><span>Listed mana</span><span>+'+(EFFECTS[k].manaCost||0)+'</span></div>'+effectCombatNote(k, preview, idx), chip, k, ph);
					});
					chip.addEventListener('mouseleave', hideTip);
					chip.querySelector('.nb-q').addEventListener('click', ev => { ev.stopPropagation(); openHelp('effect', k); });
					chip.addEventListener('click', e => {
						if(e.target.closest('.nb-q') || blocked) return;
						const i = ph.effects.indexOf(k);
						if(i>=0) ph.effects.splice(i,1);
						else {
							if(EFFECT_CATEGORIES[cat]?.exclusive){
								for(const [k2,v2] of Object.entries(EFFECTS)){
									if(v2.category===cat && k2!==k){
										const j=ph.effects.indexOf(k2); if(j>=0) ph.effects.splice(j,1);
									}
								}
							}
							ph.effects.push(k);
						}
						renderNewSpellBuilder();
					});
					grid.appendChild(chip);
				});
				fxPanel.appendChild(box);
			});
			if(ph.effects.some(fx=>['burn','poison','freeze','stun'].includes(fx))){
				if(!ph.effectPower) ph.effectPower=1;
				if(!ph.effectDuration) ph.effectDuration=1;
				const onlyDot = ph.effects.filter(fx=>['burn','poison','freeze','stun'].includes(fx)).every(fx=>fx==='burn'||fx==='poison');
				if(!onlyDot) fxPanel.appendChild(sliderRow(idx,'effectPower','Effect Power',0.5,3,0.1,'power'));
				fxPanel.appendChild(sliderRow(idx,'effectDuration','Effect Duration',0.5,3,0.1,'duration'));
			}
			if(ph.effects.includes('damageStore')){
				if(ph.damageStorePercent==null) ph.damageStorePercent=0.5;
				fxPanel.appendChild(sliderRow(idx,'damageStorePercent','Store Percent',0.1,1,0.05,'power'));
			}
			if(ph.effects.includes('timedRelease')){
				if(ph.timedReleaseDelay==null) ph.timedReleaseDelay=0.5;
				fxPanel.appendChild(sliderRow(idx,'timedReleaseDelay','Timed Release Delay',0,4,0.1,'duration'));
			}
			if(ph.effects.includes('randomDelay')){
				if(ph.randomDelayMax==null) ph.randomDelayMax=0.5;
				fxPanel.appendChild(sliderRow(idx,'randomDelayMax','Max Delay',0.1,3,0.1,'duration'));
			}
			if(ph.effects.includes('evenDelay')){
				if(ph.evenDelayDuration==null) ph.evenDelayDuration=0.5;
				fxPanel.appendChild(sliderRow(idx,'evenDelayDuration','Even Delay Duration',0.1,3,0.1,'duration'));
			}
		}

		rawPanel.innerHTML = '<div class="nb-panel-title">Raw Stats</div>';
		const cos = document.createElement('div');
		cos.className='nb-section nb-cosmetic';
		cos.innerHTML = '<div class="nb-section-lbl">Cosmetic Changes</div>';
		const trailOpts = TRAILS.map(t=>({key:t,label:t[0].toUpperCase()+t.slice(1)}));
		const hitOpts = Object.entries(AFTER_HIT_EFFECTS).map(([k,v])=>({key:k,icon:v.icon,label:v.label}));
		const colorRow = document.createElement('div');
		colorRow.className='nb-toggle';
		colorRow.innerHTML = '<span>Color</span><input type="color" value="'+(ph.color||'#4488ff')+'"/>';
		colorRow.querySelector('input').addEventListener('input', e => setProp(idx,'color',e.target.value,false));
		cos.appendChild(colorRow);
		const trailLbl = document.createElement('div'); trailLbl.className='nb-section-lbl'; trailLbl.textContent='Trail';
		cos.appendChild(trailLbl);
		cos.appendChild(cosmeticDropdown(ph.trail||'sparkle', trailOpts, k => setProp(idx,'trail',k,true), ent =>
			'<div class="ht-name">'+ent.label+' trail</div><div>Cosmetic only — no mana, control, or damage change.</div>'));
		const hitLbl = document.createElement('div'); hitLbl.className='nb-section-lbl'; hitLbl.textContent='After-Hit';
		cos.appendChild(hitLbl);
		cos.appendChild(cosmeticDropdown(ph.afterHitEffect||'none', hitOpts, k => setProp(idx,'afterHitEffect',k,true), ent =>
			'<div class="ht-name">'+ent.label+'</div><div>'+(AFTER_HIT_EFFECTS[ent.key]?.desc||'Cosmetic burst on impact.')+'</div><div>No mana or damage change.</div>'));
		rawPanel.appendChild(cos);

		const sLbl = document.createElement('div'); sLbl.className='nb-section-lbl'; sLbl.textContent='Shape';
		rawPanel.appendChild(sLbl);
		rawPanel.appendChild(dropdown('shape', idx, ph.shape, catalogEntries('shape')));
		const sExtra = document.createElement('div');
		specialShape(ph, idx, sExtra);
		rawPanel.appendChild(sExtra);
		if(ph.shape!=='summon'){
			const bLbl = document.createElement('div'); bLbl.className='nb-section-lbl'; bLbl.style.marginTop='10px'; bLbl.textContent='Behavior';
			rawPanel.appendChild(bLbl);
			rawPanel.appendChild(dropdown('behavior', idx, ph.behavior, catalogEntries('behavior')));
			const bExtra = document.createElement('div');
			specialBeh(ph, idx, bExtra);
			rawPanel.appendChild(bExtra);
		}

		if(isDomain){
			appendDomainSettings(rawPanel, ph, idx);
		} else if(isTransform){
			appendTransformSettings(rawPanel, ph, idx);
		} else {
			if(Math.abs((ph.width||1)-(ph.height||1))>0.05) unevenOpen = true;
			const sizeBox = document.createElement('div');
			sizeBox.className='nb-size-wrap';
			const avg = ((ph.width||1)+(ph.height||1))/2;
			const sizeSl = document.createElement('div');
			sizeSl.className='nb-slider';
			sizeSl.innerHTML = '<div class="nb-section-lbl">Size <span data-live="width">'+avg.toFixed(1)+'</span></div>'+
				'<div class="nb-slider-row"><input type="range" min="0.3" max="'+lim.sizeMax+'" step="0.1" value="'+avg+'"/>'+
				'<span class="nb-impact" data-impact="size"></span></div>';
			sizeSl.querySelector('input').addEventListener('input', e => {
				const v=parseFloat(e.target.value);
				ph.width=v; ph.height=v;
				updateLiveReadouts(idx);
			});
			const tog = document.createElement('button');
			tog.type='button';
			tog.className='nb-uneven-toggle'+(unevenOpen?' on':'');
			tog.title='Uneven width / height';
			tog.textContent='\u2194';
			tog.addEventListener('click', () => { unevenOpen=!unevenOpen; renderNewSpellBuilder(); });
			sizeBox.appendChild(sizeSl);
			sizeBox.appendChild(tog);
			if(unevenOpen){
				const extra = document.createElement('div');
				extra.className='nb-uneven-box';
				extra.innerHTML = '<div class="nb-section-lbl">Width / Height</div>';
				extra.appendChild(sliderRow(idx,'width','Width',0.3,lim.sizeMax,0.1,'size'));
				extra.appendChild(sliderRow(idx,'height','Height',0.3,lim.sizeMax,0.1,'size'));
				sizeBox.appendChild(extra);
			}
			rawPanel.appendChild(sizeBox);
			rawPanel.appendChild(sliderRow(idx,'speed','Speed',0.3,lim.speedMax,0.1,'speed'));
			rawPanel.appendChild(sliderRow(idx,'duration','Duration',0.3,lim.durMax,0.1,'duration'));
			rawPanel.appendChild(sliderRow(idx,'power','Spell Power',0.5,lim.powerMax,0.1,'power'));

			rawPanel.appendChild(numberRow(idx,'count','Projectiles',1,lim.countMax,'count'));
			const totHint = document.createElement('div');
			totHint.className='nb-hint';
			const tot = spellTotalProjectiles();
			const cap = spellProjCap();
			totHint.textContent = 'Spell total '+tot+' / '+cap+' (phases multiply; '+cap+' max'+(editingSlot===9?' ultimate':'')+')';
			if(tot>cap) totHint.style.color='#e74c3c';
			rawPanel.appendChild(totHint);
			if((ph.count||1)>1){
				rawPanel.appendChild(sliderRow(idx,'spread','Spread',0,360,5,'count'));
			}

			const extra = document.createElement('div');
			extra.className='nb-extra';
			if(idx===0){
				extra.appendChild(selectRow('Hold to release', !!ph.holdDown, [
					{value:'false',label:'Off'},{value:'true',label:'On'},
				], v => setProp(idx,'holdDown', v==='true', true)));
			}
			extra.appendChild(selectRow('No Hit', !!ph.noHit, [
				{value:'false',label:'Deals damage'},{value:'true',label:'Harmless'},
			], v => setProp(idx,'noHit', v==='true', true)));
			rawPanel.appendChild(extra);
		}

		doodlePanel.innerHTML = '<div class="nb-panel-title">Doodle Depiction</div>';
		const big = document.createElement('canvas');
		big.className='nb-doodle nb-doodle-big';
		big.dataset.idx = String(idx);
		doodlePanel.appendChild(big);
		const cap = document.createElement('div');
		cap.className='nb-doodle-cap';
		const sh = SHAPES[ph.shape], beh=BEHAVIORS[ph.behavior];
		cap.textContent = (sh?sh.label:ph.shape)+' · '+(beh?beh.label:ph.behavior)+' — live projectile preview using this phase\'s power, count, size, and speed.';
		doodlePanel.appendChild(cap);

		host.appendChild(fxPanel);
		host.appendChild(rawPanel);
		host.appendChild(doodlePanel);
		updateLiveReadouts(idx);
	}

	function openLinkPop(fromIdx, anchor){
		document.querySelectorAll('.nb-link-pop').forEach(n=>n.remove());
		const ph = builderSpell.phases[fromIdx];
		const cur = (ph.effects||[]).includes('phaseFork') ? 'phaseFork' : (ph.nextTrigger||'onHit');
		const pop = document.createElement('div');
		pop.className='nb-link-pop';
		const r = anchor.getBoundingClientRect();
		pop.style.left = Math.min(window.innerWidth-300, r.left-80)+'px';
		pop.style.top = (r.bottom+6)+'px';
		pop.innerHTML = '<h4>How phase '+(fromIdx+2)+' starts</h4>';
		Object.entries(PHASE_LINKS).forEach(([k,v])=>{
			const b=document.createElement('button');
			b.type='button';
			b.className = k===cur?'on':'';
			b.textContent = v.label+' — '+v.desc;
			b.addEventListener('click', ()=>{
				if(k==='phaseFork'){
					if(!ph.effects.includes('phaseFork')) ph.effects.push('phaseFork');
				} else {
					const i=ph.effects.indexOf('phaseFork'); if(i>=0) ph.effects.splice(i,1);
					ph.nextTrigger = k;
				}
				document.querySelectorAll('.nb-link-pop').forEach(n=>n.remove());
				renderNewSpellBuilder();
				if(k==='phaseFork' || k==='afterHitDelay'){
					const btn = document.querySelector('.nb-link-btn[data-from="'+fromIdx+'"]');
					if(btn) openLinkPop(fromIdx, btn);
				}
			});
			pop.appendChild(b);
		});
		if(cur==='afterHitDelay' || cur==='phaseFork'){
			const wrap=document.createElement('div');
			wrap.style.marginTop='8px';
			if(cur==='afterHitDelay'){
				if(ph.nextTriggerDelay==null) ph.nextTriggerDelay=0.5;
				wrap.innerHTML='<div class="nb-section-lbl">Hit delay</div>';
				wrap.appendChild(sliderRow(fromIdx,'nextTriggerDelay','Delay',0.1,4,0.1,'duration'));
			} else {
				if(ph.phaseForkDelay==null) ph.phaseForkDelay=1;
				if(ph.phaseForkRepeats==null) ph.phaseForkRepeats=1;
				wrap.appendChild(sliderRow(fromIdx,'phaseForkDelay','Fork Delay',0,5,0.1,'duration'));
				wrap.appendChild(sliderRow(fromIdx,'phaseForkRepeats','Repeats',1,25,1,'count'));
				wrap.appendChild(selectRow('Cursor Tracking', !!ph.phaseForkCursorTrack, [
					{value:'false',label:'Off'},
					{value:'true',label:'On (\u221215% fork damage)'},
				], v => setProp(fromIdx,'phaseForkCursorTrack', v==='true', true)));
			}
			pop.appendChild(wrap);
		}
		document.body.appendChild(pop);
		const close = ev => { if(!pop.contains(ev.target) && ev.target!==anchor){ pop.remove(); document.removeEventListener('mousedown', close); } };
		setTimeout(()=>document.addEventListener('mousedown', close),0);
	}

	function startSim(canvas, fx, ph, idx){
		stopSim();
		if(!canvas) return;
		simFx = fx; simT = 0;
		const ctx = canvas.getContext('2d');
		const loop = () => {
			simT += 0.035;
			sizeCanvas(canvas, 140);
			const src = ph || (builderSpell && builderSpell.phases[selectedPhase]);
			if(src) runCombatSim(ctx, canvas.width, canvas.height, src, simT, idx!=null?idx:selectedPhase, fx);
			simRAF = requestAnimationFrame(loop);
		};
		simRAF = requestAnimationFrame(loop);
	}
	function stopSim(){ if(simRAF){ cancelAnimationFrame(simRAF); simRAF=null; } }

	document.addEventListener('click', e => {
		if(!e.target.closest('.nb-dd')) document.querySelectorAll('.nb-dd.open').forEach(d=>d.classList.remove('open'));
	});

	window.resetNewSpellBuilder = function(){ selectedPhase = 0; unevenOpen = false; stopDoodles(); stopSim(); hideTip(); };
	window.selectNewSpellPhase = function(i){ selectedPhase = Math.max(0, i|0); };
	window.stopNewSpellBuilder = function(){ stopDoodles(); stopSim(); hideTip(); };
})();
