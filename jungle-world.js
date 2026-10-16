/* =============================================================
   The Living Wilds — Jungle Dungeon runtime.

   Owns Living Growth, clue-driven secrets, environmental puzzles,
   jungle hazards, route choices, blessings, rare events, shortcuts,
   room pacing, and the two route-selected mini-boss encounters.
   ============================================================= */
(function(global){
	'use strict';
	function cam(){ return global.camera || { x:0, y:0 }; }
	const J = {
		ready:false,
		currentRoom:null,
		sequence:Object.create(null),
		ecosystem:Object.create(null),
		blessings:{
			verdantHeart:false,
			rooted:false,
			wildStep:false,
			bloomingFortune:false,
			predatorInstinct:false,
			canopyGrace:false,
		},
		choiceTarget:null,
		lastRegion:0,
		ambientPulse:0,
		miniBossSlain:false,
	};

	function dungeonOf(){
		const d=(typeof dungeon!=='undefined'&&dungeon)||global.dungeon;
		return d&&d._jungle?d:null;
	}
	function rooms(){const d=dungeonOf();return d&&d.rooms||[];}
	function hazards(){const d=dungeonOf();return d&&d.hazards||[];}
	function platforms(){const d=dungeonOf();return d&&d.platforms||[];}
	function interacts(){const d=dungeonOf();return d&&d.interactables||[];}
	function current(){return J.currentRoom||(global.DungeonEnv&&DungeonEnv.currentRoom)||null;}
	function pbox(){return {x:player.x,y:player.y,w:player.w,h:player.h};}
	function hitRect(a,b){return a.x+a.w>b.x&&a.x<b.x+b.w&&a.y+a.h>b.y&&a.y<b.y+b.h;}
	function inRect(x,y,w,h){return hitRect(pbox(),{x:x,y:y,w:w,h:h});}
	function centerIn(z){
		if(!z)return false;
		const x=player.x+player.w/2,y=player.y+player.h/2;
		return x>=z.x&&x<=z.x+z.w&&y>=z.y&&y<=z.y+z.h;
	}
	function roomEnemies(r){
		if(!r||typeof enemies==='undefined')return [];
		return enemies.filter(function(en){
			if(!en||en.dead||en.hp<=0||en.type==='earthColossus')return false;
			if(en._jungleDormant||en._packSleep)return false;
			const cx=en.x+(en.w||40)*0.5,cy=en.y+(en.h||40)*0.5;
			const inHere=cx>=r.x&&cx<=r.x+r.w&&cy>=r.y&&cy<=r.y+r.h;
			if(inHere)return true;
			return en.roomId===r.id&&!roomAtEnemy(en);
		});
	}
	function roomAtEnemy(en){
		const list=rooms();
		const cx=en.x+(en.w||40)*0.5,cy=en.y+(en.h||40)*0.5;
		for(let i=list.length-1;i>=0;i--){
			const room=list[i];
			if(cx>room.x&&cx<room.x+room.w&&cy>room.y&&cy<room.y+room.h)return room;
		}
		return null;
	}
	function banner(text){
		if(global.DungeonEnv&&DungeonEnv.showBanner)DungeonEnv.showBanner(text);
		else if(typeof notify==='function')notify(text);
	}
	function disturbance(n,label){
		if(global.DungeonEnv&&DungeonEnv.addHeat)DungeonEnv.addHeat(n,label||null);
	}
	function awareness(){return global.DungeonEnv&&DungeonEnv.getHeat?DungeonEnv.getHeat():0;}
	function effectScale(){return J.blessings.verdantHeart ? .58 : 1;}
	function movementScale(){return J.blessings.wildStep ? .42 : 1;}
	function floorY(r){return r?r.y+r.h:player.y+player.h;}
	function shake(a,t){if(typeof shakeScreen==='function')shakeScreen(a,t);}
	function particlesAt(x,y,color,n){
		if(typeof particles==='undefined')return;
		for(let i=0;i<(n||12);i++){
			const ang=Math.random()*Math.PI*2,s=1.5+Math.random()*4.5;
			particles.push({x:x+(Math.random()-.5)*24,y:y+(Math.random()-.5)*24,vx:Math.cos(ang)*s,vy:Math.sin(ang)*s-1.4,life:24+Math.random()*24,maxLife:48,r:2+Math.random()*3,color:color||{r:104,g:190,b:92}});
		}
	}
	function jungleDamage(base,effects,knockX){
		if(player.iFrames>0)return false;
		const mult=effectScale()*(typeof DIFF_DMG_MULT==='number'?DIFF_DMG_MULT:1);
		damagePlayer(Math.max(2,Math.round(base*mult)),effects||[]);
		if(knockX){
			const root=J.blessings.rooted ? .38 : 1;
			player.vx=knockX*root;
		}
		return true;
	}

	function hideGrowthPlatforms(){
		for(const p of platforms()){
			if(!p._jungleHidden||p._junglePrepared)continue;
			p._junglePrepared=true;
			if(global.DungeonEnv&&DungeonEnv.breakPlatform)DungeonEnv.breakPlatform(p);
			else p._gone=true;
		}
	}
	function activateGrowth(id,roomId){
		if(!id)return;
		let changed=false;
		for(const p of platforms()){
			if(p.growthId!==id||(roomId!=null&&p.roomId!==roomId))continue;
			if(!p._gone)continue;
			p._gone=false;p._stamped=true;p._growT=70;
			if(global.DungeonEnv&&DungeonEnv.stampTiles&&p.kind!=='move'){
				DungeonEnv.stampTiles(p.x,p.y,p.w,p.h,false);
			}
			changed=true;
			particlesAt(p.x+p.w/2,p.y,{r:113,g:225,b:103},18);
		}
		if(changed&&typeof computeTileEdges==='function')computeTileEdges();
		for(const d of (dungeonOf().decorations||[])){
			if(d.growthId===id)d._grown=true;
		}
	}
	function removeGrowth(id){
		for(const p of platforms()){
			if(p.growthId!==id||p._gone)continue;
			if(global.DungeonEnv&&DungeonEnv.breakPlatform)DungeonEnv.breakPlatform(p);
			else p._gone=true;
		}
	}
	function triggerGroup(group,frames){
		for(const h of hazards()){
			if(h.group===group){h._manual=Math.max(h._manual||0,frames||100);h.armed=true;}
		}
	}
	function solveRoom(r,message){
		if(!r||r._jungleSolved)return;
		r._jungleSolved=true;
		if(r.puzzle&&r.puzzle.growthId)activateGrowth(r.puzzle.growthId,r.id);
		for(const it of interacts()){
			if(it.roomId===r.id&&it.kind==='jungleVault')it.locked=false;
		}
		disturbance(-3,null);
		particlesAt(r.x+r.w/2,r.y+r.h*.65,{r:142,g:245,b:137},24);
		if(r.clearMode==='puzzle')clear(r,message||'The ancient mechanism yields.');
		else banner(message||'The living mechanism answers.');
	}

	const LOOT_COMMON=[
		{id:'mana_herb',chance:1,min:2,max:4},
		{id:'luminous_spore',chance:.72,min:1,max:3},
		{id:'thorned_vine',chance:.65,min:1,max:2},
		{id:'ancient_amber',chance:.42,min:1,max:2},
	];
	const LOOT_RARE=[
		{id:'root_heartwood',chance:1,min:1,max:2},
		{id:'enchanted_bark',chance:1,min:2,max:4},
		{id:'luminous_spore',chance:1,min:3,max:6},
		{id:'ancient_amber',chance:.85,min:2,max:4},
		{id:'wind_essence',chance:.55,min:1,max:2},
	];
	function grantLoot(rare,label){
		if(!global.DungeonEnv||!DungeonEnv.grantLoot)return;
		const old=DungeonEnv.lootMult;
		if(J.blessings.bloomingFortune)DungeonEnv.lootMult=(old||1)*1.28;
		DungeonEnv.grantLoot(rare?LOOT_RARE:LOOT_COMMON,label);
		DungeonEnv.lootMult=old;
		if(typeof playerData!=='undefined'&&playerData){
			playerData.gold=(playerData.gold||0)+(rare?100:40);
			try{localStorage.setItem('magicBattle_playerData',JSON.stringify(playerData));}catch(e){}
		}
	}

	function init(){
		const d=dungeonOf();
		if(!d)return;
		J.ready=true;
		J.currentRoom=null;
		J.sequence=Object.create(null);
		if(global.JunglePuzzles && JunglePuzzles.onRoomEnter){ /* rooms greet on enter */ }
		J.ecosystem=Object.create(null);
		hideGrowthPlatforms();
		for(const r of rooms()){
			if(r.puzzle){
				r._jungleSolved=false;
				if(r.puzzle.type==='sequence')J.sequence[r.id]=0;
				if(r.puzzle.type==='ecosystem')J.ecosystem[r.id]=0;
			}
		}
		for(const en of (typeof enemies!=='undefined'?enemies:[])){
			if(!en.isMiniBoss||(en.type!=='elderTreant'&&en.type!=='stormRaptor'))continue;
			if(!en._jungleScaled){
				const mult=en.type==='elderTreant'?1.85:1.7;
				en.hp=Math.round(en.hp*mult);en.maxHp=en.hp;
				en._jungleScaled=true;
			}
			en._jungleDormant=true;
			en._jungleHidden=true;
			en.stunTimer=999999;
			en.state='patrol';
			en.alertTimer=0;
		}
	}

	function roomEnter(r){
		if(!r)return;
		J.currentRoom=r;
		const regionNames=['','OVERGROWN RUINS','DEEP JUNGLE','THE CANOPY','THE ANCIENT GROVE'];
		if(r.section!==J.lastRegion){
			J.lastRegion=r.section;
			banner(regionNames[r.section]||'THE LIVING WILDS');
		}else if(r.spectacle){
			banner('THIS IS AN ENTIRE UNDERGROUND ECOSYSTEM');
		}else if(r.kind==='miniBoss'){
			banner(r.miniBossType==='stormRaptor'?'A STORM EGG RESTS IN THE NEST':'THE BATTLEFIELD IS WAKING');
		}else if(r.secret){
			banner('SECRET DISCOVERED — '+r.label);
		}else if(r.kind==='streamPuzzle'||(r.puzzle&&r.puzzle.mini==='sluiceFlow')){
			banner(r.label+' — water will take any path you give it.');
		}else if(r.objective){
			banner(r.label+' — '+r.objective.toLowerCase()+'.');
		}
		if(global.JunglePuzzles && JunglePuzzles.onRoomEnter) JunglePuzzles.onRoomEnter(r);

		let notice=Math.max(1,r.section);
		if(r.category==='combat'||r.category==='trap')notice+=2;
		if(r.secret||r.category==='shrine')notice=-2;
		disturbance(notice,null);

		if(awareness()>=65&&!r._awareAmp){
			r._awareAmp=true;
			for(const en of roomEnemies(r)){
				en.hp=Math.round(en.hp*1.12);en.maxHp=en.hp;
				en.moveSpeedBonus=(en.moveSpeedBonus||0)+.18;
			}
			if(r.category==='combat')banner('The jungle has learned your scent.');
		}

		if(r.eventType&&!r._eventStarted){
			r._eventStarted=true;
			for(const h of hazards())if(h.roomId===r.id&&(h.type==='stampede'||h.type==='rootMigration'||h.type==='jungleCollapse'))h.armed=true;
			if(r.eventType==='jungleStampede')banner('JUNGLE STAMPEDE — follow the gaps in the herd.');
			else if(r.eventType==='giantBloom'){
				banner('GIANT BLOOM — the room is changing.');
				r._bloomTimer=100;
			}else if(r.eventType==='ancientAwakening'){
				banner('ANCIENT AWAKENING — the statues remember war.');
				if(global.DungeonEnv&&DungeonEnv.spawnWave)DungeonEnv.spawnWave(r,3);
			}else if(r.eventType==='rootMigration')banner('ROOT MIGRATION — stay clear of the moving earth.');
			else if(r.eventType==='jungleCollapse')banner('JUNGLE COLLAPSE — watch the falling shadows.');
		}
	}

	function setArenaSeals(r,closed){
		if(!r||!r.arenaGates||!global.DungeonEnv||!DungeonEnv.sealGate)return;
		for(const g of r.arenaGates)DungeonEnv.sealGate(g,closed);
		r._arenaSealed=!!closed;
	}
	function clear(r,msg){
		if(!r||r.cleared)return;
		if(r.clearMode==='miniBoss')setArenaSeals(r,false);
		if(global.DungeonEnv&&DungeonEnv.clearRoom)DungeonEnv.clearRoom(r,msg);
	}
	function livingRoomEnemies(r){
		if(!r||typeof enemies==='undefined')return [];
		return enemies.filter(function(en){
			if(!en||en.dead||en.hp<=0)return false;
			if(en._jungleDormant && !(en.isMiniBoss && (en.type==='stormRaptor'||en.type==='elderTreant'))) return false;
			if(en.type==='earthColossus'||(en.typeDef&&en.typeDef.isBoss))return false;
			if(en.roomId!==r.id)return false;
			const eh=en.h||40;
			return en.y+eh>r.y-20&&en.y<r.y+r.h+80;
		});
	}
	function nearOutPath(r){
		if(centerIn(r.clearZone))return true;
		const gates=r.outGates||[];
		for(let i=0;i<gates.length;i++){
			const g=gates[i],pad=110;
			if(inRect(g.x-pad,g.y-pad,g.w+pad*2,g.h+pad*2))return true;
		}
		return false;
	}
	function tryClearRoom(r){
		if(!dungeonOf()||!r||r.cleared||r.clearMode==='boss')return;
		const visited=global.DungeonEnv&&DungeonEnv.visited&&DungeonEnv.visited[r.id];
		if(r.clearMode==='none'){
			if(r.outGates&&r.outGates.length){
				r.cleared=true;
				r.locked=false;
			}
			return;
		}
		if(r.clearMode==='combat'||r.clearMode==='miniBoss'){
			if(global.JungleSetpiece && JungleSetpiece.isKind(r) && !r._setpieceDone) return;
			if(visited&&livingRoomEnemies(r).length===0){
				if(r._nestReward){grantLoot(true,'The predator hoard is yours.');r._nestReward=false;}
				clear(r,r.clearMode==='miniBoss'?'The jungle guardian falls.':'The ecosystem releases the path.');
			}
		}else if(r.clearMode==='traverse'){
			if(visited&&nearOutPath(r))clear(r,'A living path opens behind you.');
		}else if(r.clearMode==='puzzle'){
			if(r._jungleSolved)clear(r,'The ancient mechanism yields.');
			else if(r.puzzle&&(r.puzzle.mini==='vineSwing'||r.puzzle.mini==='branchMemory')&&visited&&nearOutPath(r)){
				r._jungleSolved=true;clear(r,'The path holds. A new section of the dungeon opens.');
			}
		}else if(r.clearMode==='interact'){
			const done=interacts().some(function(it){
				return it.roomId===r.id&&it.used&&it.kind!=='miniBossBanner'&&it.kind!=='vineElevator';
			});
			if(done)clear(r,r.secret?'The hidden place gives up its secret.':'The grove accepts your decision.');
		}
	}
	function updateClears(){
		const list=rooms();
		for(let i=0;i<list.length;i++)tryClearRoom(list[i]);
	}
	function roomClear(r){
		if(r)tryClearRoom(r);
		else updateClears();
		return true;
	}

	function wakeMiniBoss(en,r,msg){
		if(!en||!en._jungleDormant)return;
		en._jungleDormant=false;
		en._jungleHidden=false;
		en._sr=null;
		if(r)setArenaSeals(r,true);
		en.stunTimer=0;
		en.state='alert';
		en.alertTimer=9999;
		if(en.typeDef&&en.typeDef.spells)en.spellCooldowns=en.typeDef.spells.map(function(){return 35;});
		banner(msg||(en.type==='elderTreant'?'ELDER TREANT — THE GROVE AWAKENS':'STORM RAPTOR — THE HUNT BEGINS'));
		shake(10,24);
		particlesAt(en.x+en.w/2,en.y+en.h/2,en.type==='elderTreant'?{r:92,g:170,b:70}:{r:108,g:150,b:240},34);
	}
	function wakeMiniBosses(){
		const r=current();
		for(const en of (typeof enemies!=='undefined'?enemies:[])){
			if(!en||en.dead||!en.isMiniBoss||(en.type!=='elderTreant'&&en.type!=='stormRaptor'))continue;
			if(en._jungleDormant){
				en.stunTimer=999999;
				en._jungleHidden=true;
				continue;
			}
			const room=rooms()[en.roomId];
			if(room){
				en.patrol=[room.x+100,room.x+room.w-100];
			}
		}
	}

	function update(){
		if(!J.ready||!dungeonOf())return;
		J.ambientPulse++;
		hideGrowthPlatforms();
		wakeMiniBosses();
		const r=current();
		if(r&&r._bloomTimer>0){
			r._bloomTimer--;
			if(r._bloomTimer===1){
				for(const p of platforms())if(p.roomId===r.id&&p._jungleHidden)activateGrowth(p.growthId,r.id);
				grantLoot(false,'The giant bloom scatters useful spores.');
				disturbance(-5,null);
			}
		}
		if(player._jungleSnared>0){
			player._jungleSnared--;
			player.vx*=.34;
			if(player._jungleSnared<8)player._jungleSnared=0;
		}
		if(J.blessings.rooted&&Math.abs(player.vx)>8)player.vx*=.82;
		if(J.blessings.canopyGrace&&!player.onGround&&player.vy<3){
			const up=typeof keys!=='undefined'&&(keys['w']||keys['arrowup']||keys[' ']);
			if(up)player.vy=Math.max(-13,player.vy-.09);
		}
		for(const p of platforms())if(p._growT>0)p._growT--;
		if(global.JunglePuzzles && JunglePuzzles.update) JunglePuzzles.update();
		if(global.JungleSetpiece && JungleSetpiece.update) JungleSetpiece.update();
		if(r&&r.puzzle&&!r.cleared){
			const live=liveObjective(r);
			if(live)r.objective=live;
		}
		if(r&&!r._ambushDone){
			for(const it of interacts()){
				if(it.used||it.roomId!==r.id||!it.touchTrigger)continue;
				if(it.kind!=='jungleTrap'&&it.kind!=='spiderNest')continue;
				if(!hitRect(pbox(),it))continue;
				it.used=true;
				markRoomTraps(r);
				beginAmbush(r,trapPack(it,r),{
					elite:!!it.elite,reward:it.reward!==false,
					disturb:10,banner:it.ambushBanner||'YOU BRUSHED THE SILK — the nest wakes.',
				});
				break;
			}
		}
		if(typeof enemies!=='undefined'){
			for(let i=0;i<enemies.length;i++){
				const en=enemies[i];
				if(!en||en.dead||en.roomId==null)continue;
				const room=rooms()[en.roomId];
				if(!room)continue;
				const pad=48;
				if(en.x<room.x+pad)en.x=room.x+pad;
				if(en.x+(en.w||40)>room.x+room.w-pad)en.x=room.x+room.w-(en.w||40)-pad;
				if(en.y<room.y+pad){en.y=room.y+pad;if(en.vy<0)en.vy=0;}
				if(en.y+(en.h||40)>room.y+room.h-8){en.y=room.y+room.h-(en.h||40)-8;if(en.vy>0)en.vy=0;}
			}
		}
	}

	function cycle(h,period){
		const speed=1+awareness()/260;
		h._t=(h._t==null?(h.phase||0):h._t)+speed;
		return h._t%(period||h.period||240);
	}
	function inCurrent(h){
		const r=current();
		return r&&h.roomId===r.id;
	}
	function updateHazards(){
		if(!J.ready)return;
		for(const h of hazards()){
			if(!inCurrent(h)&&h.type!=='water'&&h.type!=='flood')continue;
			if(h.type==='rootSnare'){
				if(h.manual&&!(h._manual>0)){h.warnOn=false;h.hot=false;continue;}
				const c=cycle(h,h.period||230);
				const manual=(h._manual||0)>0;
				if(manual)h._manual--;
				h.warnOn=manual?c<24:c>(h.period||230)-64;
				h.hot=manual?(h._manual>28&&h._manual<78):c>(h.period||230)-30;
				if(h.hot&&inRect(h.x,h.y-h.h*.65,h.w,h.h*1.65)){
					if(jungleDamage(12,['slow']))player._jungleSnared=J.blessings.wildStep?16:34;
				}
			}else if(h.type==='thornWall'){
				const c=cycle(h,h.period||220);
				h.warnOn=c>125&&c<160;h.hot=c>=160&&c<205;
				if(h.hot&&inRect(h.x,h.y,h.w,h.h)){
					const cy=player.y+player.h/2;
					if(cy<h.gapY||cy>h.gapY+h.gapH)jungleDamage(18,['horizontalLaunch'],player.x<h.x?-8:8);
				}
			}else if(h.type==='poisonFlower'){
				if(h.manual&&!(h._manual>0)){h.warnOn=false;h.hot=false;continue;}
				const c=cycle(h,h.period||260),manual=(h._manual||0)>0;
				if(manual)h._manual--;
				h.warnOn=manual||c>155&&c<195;
				h.hot=manual&&h._manual<72||c>=195&&c<245;
				const rr=h.cloudR||140,cx=h.x+h.w/2,cy=h.y+h.h/2;
				if(h.hot&&inRect(cx-rr,cy-rr,rr*2,rr*2))jungleDamage(9,[{type:'poison',dmg:2,interval:38,ticks:3,color:'#a6dc55'}]);
			}else if(h.type==='fallingBranch'){
				const period=h.period||280;
				const c=cycle(h,period);
				const warnAt=period*0.5, hotAt=period*0.72, hotEnd=period*0.92;
				h.warnOn=c>warnAt&&c<hotAt;h.hot=c>=hotAt&&c<hotEnd;
				h.fallP=h.hot?Math.min(1,(c-hotAt)/Math.max(8,hotEnd-hotAt)):0;
				if(h.hot){
					const yy=h.y+(h.impactY-h.y)*h.fallP;
					if(inRect(h.x,yy,h.w,h.h+24))jungleDamage(24,['stun','horizontalLaunch'],player.x<h.x+h.w/2?-7:7);
				}
			}else if(h.type==='swingingVine'){
				const a=(cycle(h,h.period||250)/(h.period||250))*Math.PI*2;
				const len=h.length||h.h||420;
				h.bobX=h.x+Math.sin(a)*len*.62;
				h.bobY=h.y+Math.abs(Math.cos(a))*len;
				if(global.JunglePuzzles && JunglePuzzles.tickVine && JunglePuzzles.tickVine(h)) continue;
				if(Math.hypot(player.x+player.w/2-h.bobX,player.y+player.h/2-h.bobY)<42){
					jungleDamage(14,['horizontalLaunch'],Math.cos(a)*10);
				}
			}else if(h.type==='carnivorousPlant'){
				const c=cycle(h,h.period||210);
				h.warnOn=c>105&&c<142;h.hot=c>=142&&c<182;
				if(h.hot&&inRect(h.x-20,h.y-40,h.w+40,h.h+60))jungleDamage(22,['stun'],player.x<h.x+h.w/2?-8:8);
			}else if(h.type==='sporePocket'){
				if(!h.triggered){
					const dx=player.x+player.w/2-(h.x+h.w/2),dy=player.y+player.h/2-(h.y+h.h/2);
					if(Math.hypot(dx,dy)<(h.triggerR||120)){h.triggered=true;h._t=0;banner('A disturbed spore pocket begins to swell.');}
				}else{
					h._t++;h.warnOn=h._t<38;h.hot=h._t>=38&&h._t<118;
					if(h.hot&&inRect(h.x-90,h.y-90,h.w+180,h.h+180))jungleDamage(8,[{type:'poison',dmg:2,interval:42,ticks:2,color:'#badc62'}]);
				}
			}else if(h.type==='sinkingMud'){
				if(inRect(h.x,h.y,h.w,h.h)){
					const cx=h.pullX||h.x+h.w/2,dx=cx-(player.x+player.w/2);
					player.vx*=1-.42*movementScale();
					player.x+=Math.sign(dx)*1.25*movementScale();
					if(Math.abs(dx)<42&&J.ambientPulse%42===0)jungleDamage(7,[]);
				}
			}else if(h.type==='rootCrusher'){
				if(h.manual&&!(h._manual>0)){h.warnOn=false;h.hot=false;h.extend=0;continue;}
				const c=cycle(h,h.period||260),manual=(h._manual||0)>0;
				if(manual)h._manual--;
				h.warnOn=manual||c>145&&c<190;h.hot=manual&&h._manual<68||c>=190&&c<224;
				h.extend=h.hot ? 1 : (h.warnOn ? .35 : 0);
				if(h.hot&&inRect(h.x,h.y,h.w,h.h))jungleDamage(26,['stun','horizontalLaunch'],player.x<h.x+h.w/2?-9:9);
			}else if(h.type==='bounceMushroom'){
				if(player.vy>=0&&inRect(h.x,h.y-18,h.w,h.h+30)){
					player.y=h.y-player.h-2;player.vy=-(h.lift||14);
					particlesAt(h.x+h.w/2,h.y,{r:172,g:236,b:112},10);
				}
			}else if(h.type==='water'||h.type==='waterfall'){
				if(inRect(h.x,h.y,h.w,h.h)){
					const step=movementScale();
					player.vx+=(h.current||h.force||0)*.08*step;
					player.vx*=1-.09*step;
					if(h.deep){
						const grav=typeof GRAVITY==='number'?GRAVITY:.55;
						player.vy-=grav*.52;
						if(player.vy>2.8)player.vy=2.8;
						if(typeof keys!=='undefined'&&(keys['w']||keys['arrowup']||keys[' ']))player.vy=-3.8;
					}
				}
			}else if(h.type==='flood'){
				if(!h._started&&inCurrent(h)){h._started=true;h.level=h.y0;}
				if(h._started&&!h.drained){
					h.level=Math.max(h.y1,h.level-(h.speed||.5));
					const r=rooms()[h.roomId],bottom=r?r.y+r.h:h.y0+300;
					if(inRect(h.x,h.level,h.w,bottom-h.level)){
						const grav=typeof GRAVITY==='number'?GRAVITY:.55;
						player.vy-=grav*.55;player.vx*=.92;
						if(player.vy>2.4)player.vy=2.4;
					}
				}
			}else if(h.type==='windGust'){
				const c=cycle(h,h.period||320);
				h.warnOn=c>180&&c<225;h.hot=c>=225&&c<275;
				if(h.hot&&inRect(h.x,h.y,h.w,h.h)){
					const root=J.blessings.rooted ? .45 : 1;
					player.vx+=(h.dir||1)*.52*root;
				}
			}else if(h.type==='stampede'&&h.armed){
				h._t=(h._t||0)+1;
				const waves=[90,180,285];
				h.herds=[];
				for(let i=0;i<waves.length;i++){
					const age=h._t-waves[i];
					if(age<-50||age>130)continue;
					const p=Math.max(0,Math.min(1,age/90));
					const x=(h.dir>0?h.x-240+p*(h.w+480):h.x+h.w+240-p*(h.w+480));
					const gap=(i*173+h.roomId*97)%Math.max(160,h.w-200);
					h.herds.push({x:x,gap:gap,active:age>=0});
					if(age>=0&&age<96){
						const strip={x:x-100,y:h.y,w:200,h:h.h};
						if(hitRect(pbox(),strip)){
							const py=player.y+player.h/2-h.y;
							const safeY=40+(gap%(Math.max(80,h.h-80)));
							if(Math.abs(py-safeY)>38)jungleDamage(20,['horizontalLaunch'],h.dir*11);
						}
					}
				}
				if(h._t>430){h.armed=false;banner('The stampede disappears into the deep jungle.');}
			}else if(h.type==='rootMigration'&&h.armed){
				h._t=(h._t||0)+1;
				h.warnOn=h._t<70||h._t%180<55;
				h.hot=h._t>=70&&h._t%180>=55&&h._t%180<115;
				h.shift=Math.sin(h._t*.025)*h.w*.28;
				if(h.hot&&inRect(h.x+h.shift,h.y,h.w*.3,h.h))jungleDamage(18,['horizontalLaunch'],Math.sign(h.shift||1)*8);
				if(h._t>520)h.armed=false;
			}else if(h.type==='jungleCollapse'&&h.armed){
				h._t=(h._t||0)+1;
				h.warnOn=h._t%120<70;h.hot=h._t%120>=70&&h._t%120<95;
				h.lane=(Math.floor(h._t/120)*137+h.roomId*71)%Math.max(160,h.w-180);
				if(h.hot&&inRect(h.x+h.lane,h.y,180,h.h))jungleDamage(21,['stun']);
				if(h._t>420)h.armed=false;
			}
		}
	}

	function puzzleRoom(it){return rooms()[it.roomId];}
	function resetSequence(r,group){
		J.sequence[r.id]=0;
		for(const node of interacts())if(node.roomId===r.id&&node.group===group)node.used=false;
		triggerGroup(r.puzzle&&r.puzzle.failHazard,110);
		disturbance(5,'+DISTURBANCE');
		banner('Wrong pattern — the clue resets as the roots strike.');
		shake(7,12);
	}
	function useSequence(it,r){
		const order=r.puzzle.order||[];
		const at=J.sequence[r.id]||0;
		if(it.idx!==order[at]){resetSequence(r,it.group);return;}
		it.used=true;J.sequence[r.id]=at+1;
		particlesAt(it.x+it.w/2,it.y+it.h/2,{r:142,g:229,b:104},12);
		if(J.sequence[r.id]>=order.length)solveRoom(r,'The sequence completes — living growth reshapes the path.');
		else banner('The pattern answers. '+J.sequence[r.id]+' / '+order.length);
	}
	function useState(it,r){
		it.state=((it.state||0)+1)%(it.states||4);
		it.used=false;
		particlesAt(it.x+it.w/2,it.y+it.h/2,{r:107,g:205,b:184},8);
		const group=r.puzzle.group, nodes=interacts().filter(function(n){return n.roomId===r.id&&n.group===group;});
		const targets=r.puzzle.targets||[];
		let good=nodes.length===targets.length;
		for(let i=0;i<nodes.length;i++)if((nodes[i].state||0)!==targets[nodes[i].idx])good=false;
		if(good)solveRoom(r,r.puzzle.growthId?'The sluices feed the roots — a living bridge grows.':'Water, stone, and sunlight align.');
		else{
			const cur=(it.state||0)+1;
			const need=targets[it.idx]!=null?targets[it.idx]+1:null;
			banner(it.name+' is at '+cur+' of '+(it.states||3)+(need!=null?' — the carving wants '+need+'.':'.'));
		}
	}
	function useEcosystem(it,r){
		const steps=r.puzzle.steps||[];
		const stage=J.ecosystem[r.id]||0;
		if(it.step!==steps[stage]){
			triggerGroup(r.puzzle.failHazard,120);
			disturbance(4,'+DISTURBANCE');
			banner('The chain breaks: '+steps[stage]+' must come next.');
			return;
		}
		it.used=true;J.ecosystem[r.id]=stage+1;
		if(it.step==='water')banner('Water reaches the sleeping flower.');
		else if(it.step==='flower')banner('The bloom opens and feeds the hanging vine.');
		else if(it.step==='vine'){activateGrowth(r.puzzle.growthId,r.id);banner('The vine grows toward the ancient door.');}
		else if(it.step==='door')banner('The root door recognizes the completed ecosystem.');
		if(J.ecosystem[r.id]>=steps.length)solveRoom(r,'ECOSYSTEM COMPLETE — the Worldroot opens the way.');
	}

	function nearestInteractable(){
		const px=player.x+player.w/2,py=player.y+player.h/2;
		let best=null,bd=145;
		for(const it of interacts()){
			if(!it||it.kind==='miniBossBanner')continue;
			if(it.used&&!['waterWheel','sunMirror','statueNode','vineElevator','puzzleBoard'].includes(it.kind))continue;
			const dx=px-(it.x+(it.w||60)/2),dy=py-(it.y+(it.h||60)/2),d=Math.hypot(dx,dy);
			if(d<bd){best=it;bd=d;}
		}
		return best;
	}
	function closeChoice(){
		J.choiceTarget=null;
		if(global.DungeonEnv){DungeonEnv.choiceOpen=false;DungeonEnv.choiceTarget=null;}
		const el=document.getElementById('dungeonChoice');if(el)el.style.display='none';
	}
	function openPanel(it,title,buttons){
		J.choiceTarget=it;
		if(global.DungeonEnv){DungeonEnv.choiceOpen=true;DungeonEnv.choiceTarget=it;}
		const el=document.getElementById('dungeonChoice');if(!el)return;
		el.style.display='flex';
		el.innerHTML='<div class="dch-panel"><h3>'+title+'</h3>'+buttons.map(function(b){
			return '<button data-pick="'+b.id+'"'+(b.cancel?' class="dch-cancel"':'')+'>'+b.name+'<small>'+b.body+'</small></button>';
		}).join('')+'</div>';
		el.querySelectorAll('button').forEach(function(btn){
			btn.onclick=function(){pickPanel(btn.getAttribute('data-pick'));};
		});
	}
	function openShrine(it){
		openPanel(it,it.name||'Living Shrine',[
			{id:'verdantHeart',name:'Verdant Heart',body:'Environmental jungle hazards deal substantially less damage.'},
			{id:'rooted',name:'Rooted',body:'Greatly resist knockback and forced movement.'},
			{id:'wildStep',name:'Wild Step',body:'Mud, currents, water, and snares impede you less.'},
			{id:'bloomingFortune',name:'Blooming Fortune',body:'Secret caches and exploration rewards grow richer.'},
			{id:'predatorInstinct',name:'Predator’s Instinct',body:'Your spells deal more damage for this run.'},
			{id:'canopyGrace',name:'Canopy Grace',body:'Gain better control and lift while airborne.'},
			{id:'cancel',name:'Leave the shrine',body:'Take nothing.',cancel:true},
		]);
	}
	function sealAmbush(r,closed){
		if(!r||!global.DungeonEnv||!DungeonEnv.sealGate)return;
		const gates=r.outGates||r.arenaGates||[];
		for(let i=0;i<gates.length;i++)DungeonEnv.sealGate(gates[i],!!closed);
		r.locked=!!closed;
	}
	function makeAmbushEnemy(r,type,x,y,elite){
		const t=typeof ENEMY_TYPES!=='undefined'?ENEMY_TYPES[type]:null;
		if(!t)return null;
		const ew=Math.round(t.w*((typeof DIFF_SIZE_MULT==='number')?DIFF_SIZE_MULT:1));
		const eh=Math.round(t.h*((typeof DIFF_SIZE_MULT==='number')?DIFF_SIZE_MULT:1));
		const hp=Math.round(t.hp*((typeof DIFF_HP_MULT==='number')?DIFF_HP_MULT:1)*(elite?1.28:1));
		return {
			type:type,typeDef:t,x:x,y:y,w:ew,h:eh,vx:0,vy:0,hp:hp,maxHp:hp,
			facing:1,patrol:[r.x+60,r.x+r.w-60],patrolDir:1,state:'alert',
			alertTimer:160,spellCooldowns:(t.spells||[]).map(function(){return 18;}),currentSpell:0,
			flash:0,dots:[],stunTimer:0,slowTimer:0,animTimer:0,attackAnimTimer:0,
			dead:false,deathTimer:0,baseY:y,flyOffset:0,charging:false,chargeVx:0,chargeVy:0,
			chargeTimer:0,chargeCastDone:false,bossPhase:1,_safeX:x,_safeY:y,
			puzzleSeg:r.section||r.depth,roomId:r.id,jungleElite:!!elite,
		};
	}
	function spawnAmbush(r,pack,opts){
		opts=opts||{};
		if(!r||!pack||!pack.length||typeof enemies==='undefined')return 0;
		const plats=(platforms()||[]).filter(function(p){
			return p.roomId===r.id&&!p._gone&&!p.vineRung&&p.w>=100;
		});
		let n=0;
		for(let i=0;i<pack.length;i++){
			const type=pack[i];
			const t=typeof ENEMY_TYPES!=='undefined'?ENEMY_TYPES[type]:null;
			if(!t)continue;
			const ew=Math.round(t.w*((typeof DIFF_SIZE_MULT==='number')?DIFF_SIZE_MULT:1));
			const eh=Math.round(t.h*((typeof DIFF_SIZE_MULT==='number')?DIFF_SIZE_MULT:1));
			const p=plats.length?plats[i%plats.length]:null;
			const x=p
				?Math.max(r.x+48,Math.min(r.x+r.w-ew-48,p.x+p.w/2-ew/2+(i%3-1)*36))
				:r.x+120+i*90;
			const y=t.flies
				?(r.y+160+(i%3)*90)
				:(p?p.y-eh-4:r.y+r.h-eh-20);
			const en=makeAmbushEnemy(r,type,x,y,!!opts.elite);
			if(!en)continue;
			enemies.push(en);
			if(typeof particlesAt==='function')particlesAt(x+ew/2,y+eh/2,{r:180,g:210,b:90},16);
			n++;
		}
		if(n&&typeof shakeScreen==='function')shakeScreen(8,16);
		return n;
	}
	function beginAmbush(r,pack,opts){
		opts=opts||{};
		if(!r||r._ambushDone)return false;
		r._ambushDone=true;
		r.clearMode='combat';
		r.cleared=false;
		r._nestReward=opts.reward!==false;
		sealAmbush(r,true);
		spawnAmbush(r,pack,opts);
		disturbance(opts.disturb!=null?opts.disturb:12,'+DISTURBANCE');
		banner(opts.banner||'AN AMBUSH — the room seals until they fall.');
		return true;
	}
	function markRoomTraps(r){
		if(!r)return;
		for(const it of interacts()){
			if(it.roomId===r.id&&(it.kind==='jungleTrap'||it.kind==='spiderNest'||it.kind==='predatorNest'))it.used=true;
		}
	}
	function trapPack(it,r){
		if(it&&it.pack&&it.pack.length)return it.pack;
		const section=(r&&(r.section||r.depth))||2;
		if(it&&it.trapKind==='spiderNest')return section>=3
			?['caveSpider','caveSpider','caveSpider','vineCrawler','stalactiteBat']
			:['caveSpider','caveSpider','caveSpider','vineCrawler'];
		if(section>=3)return ['thornWolf','mossWraith','windSylph','thornWolf'];
		return ['thornWolf','vineCrawler','caveSpider','mossWraith'];
	}
	function openTrap(it){
		const kind=it.trapKind||'spiderNest';
		if(kind==='wrongChoice'&&it.options&&it.options.length){
			openPanel(it,it.name||'A choice waits',[].concat(it.options,{id:'cancel',name:'Step back',body:'Decide later.',cancel:true}));
			return;
		}
		if(kind==='spiderNest'){
			openPanel(it,it.name||'Silk Nest',[
				{id:'breakSilk',name:'Break the silk',body:'Tear the eggs open. Whatever is inside will come out.'},
				{id:'leaveNest',name:'Leave them sleeping',body:'Pass without touching the sacs. The room stays quiet.'},
				{id:'cancel',name:'Back away',body:'Make no decision yet.',cancel:true},
			]);
			return;
		}
		openPanel(it,it.name||'Suspicious Cache',[
			{id:it.safe?'takeSafe':'takeTrap',name:it.takeName||'Take it',body:it.takeBody||(it.safe?'Old, dusty, and probably honest.':'It looks too inviting.')},
			{id:'leaveNest',name:'Leave it',body:'Walk away and keep the room quiet.'},
			{id:'cancel',name:'Back away',body:'Make no decision yet.',cancel:true},
		]);
	}
	function openNest(it){
		openPanel(it,it.name||'Predator Nest',[
			{id:'disturb',name:'Disturb the nest',body:'Awaken an elite encounter for a rare hoard.'},
			{id:'observe',name:'Study the tracks',body:'Lower Jungle Awareness and leave the nest untouched.'},
			{id:'cancel',name:'Back away',body:'Make no decision yet.',cancel:true},
		]);
	}
	function openHeart(it){
		openPanel(it,it.name||'The Root Heart',[
			{id:'nourish',name:'Nourish the Heart',body:'Spend 25 mana. Grow the permanent vine network and calm the jungle.'},
			{id:'cut',name:'Cut a living root',body:'Take valuable heartwood now, but destroy the vine shortcut and anger the grove.'},
			{id:'listen',name:'Listen to the pulse',body:'Gain Verdant Heart, but receive no immediate treasure.'},
			{id:'cancel',name:'Leave it untouched',body:'Decide later.',cancel:true},
		]);
	}
	function pickPanel(pick){
		const it=J.choiceTarget;
		closeChoice();
		if(!it||pick==='cancel')return;
		if(['verdantHeart','rooted','wildStep','bloomingFortune','predatorInstinct','canopyGrace'].includes(pick)){
			for(const k in J.blessings)J.blessings[k]=false;
			J.blessings[pick]=true;it.used=true;
			const names={verdantHeart:'Verdant Heart',rooted:'Rooted',wildStep:'Wild Step',bloomingFortune:'Blooming Fortune',predatorInstinct:'Predator’s Instinct',canopyGrace:'Canopy Grace'};
			banner(names[pick]+' — the jungle changes around you.');
			disturbance(-6,null);
			return;
		}
		if(pick==='disturb'){
			it.used=true;
			const r=rooms()[it.roomId];
			beginAmbush(r,trapPack(it,r)||['thornWolf','mossWraith','thornWolf','windSylph'],{
				elite:true,reward:true,disturb:16,
				banner:'The nest erupts — an elite pack returns for its hoard.',
			});
			return;
		}
		if(pick==='observe'){
			it.used=true;disturbance(-10,null);banner('You read the tracks and pass without being noticed.');return;
		}
		if(pick==='nourish'){
			if(typeof mana!=='undefined'&&mana<25){banner('The Heart needs 25 mana.');return;}
			if(typeof mana!=='undefined')mana-=25;
			it.used=true;
			for(const v of interacts())if(v.kind==='vineElevator'&&v.network==='worldroot_shortcut')v.active=true;
			activateGrowth('ecosystem_vine');
			disturbance(-18,null);
			banner('The Worldroot accepts your magic. Its vine network wakes.');
			return;
		}
		if(pick==='cut'){
			it.used=true;
			for(const v of interacts())if(v.kind==='vineElevator'&&v.network==='worldroot_shortcut'){v.disabled=true;v.active=false;}
			removeGrowth('ecosystem_vine');
			triggerGroup('heartAnger',160);
			grantLoot(true,'Fresh heartwood — taken at a cost.');
			disturbance(22,'+DISTURBANCE');
			banner('The severed root screams through the entire dungeon.');
			return;
		}
		if(pick==='listen'){
			it.used=true;J.blessings.verdantHeart=true;disturbance(-8,null);banner('You hear the civilization’s last mistake — and the Heart shields you.');return;
		}
		if(pick==='offering'){
			it.used=true;
			const r=rooms()[it.roomId];
			beginAmbush(r,['thornWolf','mossWraith','skyVine'],{
				elite:true,reward:true,disturb:12,
				banner:'The sacred offering was guarded.',
			});
			return;
		}
		if(pick==='breakSilk'||pick==='takeTrap'){
			const r=rooms()[it.roomId];
			it.used=true;
			markRoomTraps(r);
			beginAmbush(r,trapPack(it,r),{
				elite:!!it.elite,
				reward:it.reward!==false,
				disturb:it.disturb!=null?it.disturb:14,
				banner:it.ambushBanner||(pick==='breakSilk'
					?'THE NEST HATCHES — spiders pour from the silk.'
					:'THE OFFERING WAS BAIT — the room fills with predators.'),
			});
			return;
		}
		if(pick==='takeSafe'){
			it.used=true;
			markRoomTraps(rooms()[it.roomId]);
			if(!(global.ChestLoot&&ChestLoot.beginOpen(it,{better:!!it.rare,gold:it.rare?100:40,label:it.lootText||'The quiet chest was the honest one.'}))){
				grantLoot(!!it.rare,it.lootText||'The quiet cache was the honest one.');
			}
			disturbance(-4,null);
			banner('You took the humble offering. The jungle stays still.');
			return;
		}
		if(pick==='leaveNest'){
			it.used=true;
			markRoomTraps(rooms()[it.roomId]);
			disturbance(-8,null);
			banner(it.leaveText||'You leave it untouched. Nothing wakes.');
			return;
		}
		if(it&&it.options){
			for(let i=0;i<it.options.length;i++){
				const opt=it.options[i];
				if(opt.id!==pick)continue;
				it.used=true;
				const r=rooms()[it.roomId];
				if(opt.result==='ambush'){
					markRoomTraps(r);
					beginAmbush(r,opt.pack||trapPack(it,r),{
						elite:!!opt.elite,
						reward:opt.reward!==false,
						disturb:opt.disturb!=null?opt.disturb:16,
						banner:opt.banner||'WRONG CHOICE — an ambush closes the exits.',
					});
				}else if(opt.result==='loot'){
					markRoomTraps(r);
					it.rare=!!opt.rare;
					if(!(global.ChestLoot&&ChestLoot.beginOpen(it,{better:!!opt.rare,gold:opt.rare?100:40,label:opt.lootText||'You chose the honest chest.'}))){
						grantLoot(!!opt.rare,opt.lootText||'You chose the honest cache.');
					}
					disturbance(-5,null);
					banner(opt.banner||'The dusty offering was safe.');
				}else{
					disturbance(-6,null);
					banner(opt.banner||'You touch nothing. The room stays quiet.');
				}
				return;
			}
		}
	}

	function useElevator(it){
		if(it.disabled){banner('The vine network was severed at the Root Heart.');return;}
		if(!it.active){
			for(const v of interacts())if(v.kind==='vineElevator'&&v.network===it.network)v.active=true;
			banner('The ancient vine elevator wakes. Interact again to ride.');
			particlesAt(it.x+it.w/2,it.y,{r:104,g:225,b:118},24);
			return;
		}
		const dest=rooms()[it.destRoomId];
		if(!dest)return;
		banner('The Worldroot carries you through its living tunnels.');
		player.x=dest.x+180;player.y=dest.y+dest.h-320;player.vx=0;player.vy=0;
		shake(5,12);
	}

	function tryInteract(){
		if(!dungeonOf()||!J.ready)return false;
		if(global.JunglePuzzles && JunglePuzzles.tryInteract && JunglePuzzles.tryInteract()) return true;
		if(global.JungleSetpiece && JungleSetpiece.tryInteract){
			const it=nearestInteractable();
			if(it && JungleSetpiece.tryInteract(it)) return true;
		}
		const it=nearestInteractable();if(!it)return false;
		const r=puzzleRoom(it);
		if(it.kind==='waterWheel'||it.kind==='sunMirror'||it.kind==='statueNode'){
			if(r&&r.puzzle&&!r.puzzle.mini)useState(it,r);return true;
		}
		if(it.kind==='growthNode'&&it.group){
			if(r&&r.puzzle&&!r.puzzle.mini)useSequence(it,r);return true;
		}
		if(it.kind==='mushroomNode'||it.kind==='flowerNode'){
			if(r&&r.puzzle&&!r.puzzle.mini)useSequence(it,r);return true;
		}
		if(it.kind==='growthNode'){
			it.used=true;activateGrowth(it.growthId,it.roomId);banner('The watered vine grows into a permanent path.');return true;
		}
		if(it.kind==='ecosystemNode'){
			if(r&&r.puzzle)useEcosystem(it,r);return true;
		}
		if(it.kind==='drainLever'){
			it.used=true;
			for(const h of hazards())if(h.roomId===it.roomId&&h.type==='flood')h.drained=true;
			solveRoom(r,'The ancient drain opens before the flood reaches the canopy.');
			return true;
		}
		if(it.kind==='rootSeal'){
			it.used=true;
			const gate=dungeonOf()._gates&&dungeonOf()._gates[it.gateIndex];
			if(gate&&global.DungeonEnv&&DungeonEnv.sealGate)DungeonEnv.sealGate(gate,false);
			banner('The unusual roots peel away — your clue was correct.');
			disturbance(3,null);
			particlesAt(it.x+it.w/2,it.y+it.h/2,{r:126,g:210,b:83},20);
			return true;
		}
		if(it.kind==='jungleShrine'){openShrine(it);return true;}
		if(it.kind==='predatorNest'){openNest(it);return true;}
		if(it.kind==='jungleTrap'||it.kind==='spiderNest'){openTrap(it);return true;}
		if(it.kind==='jungleChoice'){openHeart(it);return true;}
		if(it.kind==='sacredOffering'){
			openPanel(it,it.name||'Sacred Offering',[
				{id:'offering',name:'Take the offering',body:'Wake its guardians, then claim an elite reward.'},
				{id:'cancel',name:'Respect the grove',body:'Leave it undisturbed.',cancel:true},
			]);return true;
		}
		if(it.kind==='vineElevator'){useElevator(it);return true;}
		if(it.kind==='shortcutVine'){
			it.used=true;
			for(const p of platforms())if(p.roomId===it.roomId&&p.vineLift){p.spd=(p.spd||1)*1.55;p.dist=(p.dist||200)+120;}
			banner('The vine elevator coils upward, creating a lasting shortcut.');
			return true;
		}
		if(it.kind==='jungleCache'){
			const chestRoom=rooms()[it.roomId]||r;
			const guards=chestRoom?roomEnemies(chestRoom):[];
			if((it.lockedByCombat||it._locked)&&guards.length){banner('The predators still guard this hoard.');return true;}
			if(it.lockedByCombat&&!guards.length){it.lockedByCombat=false;it._locked=false;}
			if(global.ChestLoot&&ChestLoot.beginOpen(it,{better:!!it.rare,gold:it.rare?100:40,label:it.rare?'A rare jungle chest.':'The hidden chest yields.'})) return true;
			it.used=true;grantLoot(!!it.rare,it.rare?'A rare jungle cache.':'The hidden cache yields.');return true;
		}
		if(it.kind==='jungleVault'){
			if(it.locked){banner('The guardian statues are not aligned.');return true;}
			if(global.ChestLoot&&ChestLoot.beginOpen(it,{better:true,gold:120,label:'The Worldroot Reliquary opens.'})){disturbance(7,'+DISTURBANCE');return true;}
			it.used=true;grantLoot(true,'The Worldroot Reliquary opens.');disturbance(7,'+DISTURBANCE');return true;
		}
		if(it.kind==='jungleMemory'){
			if(r&&r.puzzle&&r.puzzle.mini&&!r._jungleSolved) return false;
			it.used=true;
			banner(it.lore||'The roots preserve a memory of the consumed city.');
			if(it.rare)grantLoot(false,'The memory leaves an ancient token.');
			return true;
		}
		if(it.kind==='miniBossStart'){
			it.used=true;
			const room=rooms()[it.roomId];
			let woke=false;
			for(const en of (typeof enemies!=='undefined'?enemies:[])){
				if(!en||en.dead||!en.isMiniBoss||en.roomId!==it.roomId||!en._jungleDormant)continue;
				if(it.wake&&en.type!==it.wake)continue;
				wakeMiniBoss(en,room,en.type==='elderTreant'?'ELDER TREANT — THE GROVE AWAKENS':'STORM RAPTOR — THE HUNT BEGINS');
				woke=true;
			}
			if(!woke)banner('The grove is already awake.');
			return true;
		}
		if(it.kind==='raptorEgg'){
			it.used=true;
			const room=rooms()[it.roomId];
			let raptor=null;
			for(const en of (typeof enemies!=='undefined'?enemies:[])){
				if(en&&!en.dead&&en.type==='stormRaptor'&&en.roomId===it.roomId){raptor=en;break;}
			}
			if(raptor){
				if(room){
					raptor.x=room.x+room.w/2-(raptor.w||80)/2;
					raptor.y=it.y-140;
				}
				wakeMiniBoss(raptor,room,'STORM RAPTOR — THE EGG SPLITS. THE HUNT BEGINS');
			}else banner('The shell is already empty.');
			particlesAt(it.x+it.w/2,it.y+it.h/2,{r:255,g:230,b:110},28);
			shake(12,28);
			return true;
		}
		return false;
	}

	function liveObjective(r){
		if(!r||r.cleared)return '';
		if(global.JunglePuzzles && JunglePuzzles.objective && r.puzzle && r.puzzle.mini) return JunglePuzzles.objective(r);
		return r.objective||'';
	}

	function prompt(){
		if(global.JunglePuzzles && JunglePuzzles.prompt){
			const extra=JunglePuzzles.prompt();
			if(extra) return extra;
		}
		if(global.JungleSetpiece && JungleSetpiece.prompt){
			const it=nearestInteractable();
			const extra=it && JungleSetpiece.prompt(it);
			if(extra) return extra;
		}
		const it=nearestInteractable();if(!it)return null;
		const map={
			waterWheel:'E — Study the sluice',
			sunMirror:'E — Rotate the sunlight mirror',
			statueNode:'E — Rotate the guardian statue',
			growthNode:'E — Wake the living growth',
			mushroomNode:'E — Sound the mushroom cap',
			flowerNode:'E — Open the giant flower',
			sporeFlower:'E — Choose this bloom',
			puzzleBoard:'E — Study the living mechanism',
			trackClue:'E — Follow this sign',
			rootStrand:'E — Cut this root',
			rootCore:'E — Strike the glowing core',
			sporeHeart:'E — Destroy the spore heart',
			ecosystemNode:'E — '+(it.name||'Continue the ecosystem chain'),
			drainLever:'E — Release the ancient drain',
			rootSeal:'E — Investigate the unusual roots',
			jungleShrine:'E — Choose a Jungle blessing',
			predatorNest:'E — Decide whether to disturb the nest',
			spiderNest:'E — Inspect the silk nest',
			jungleTrap:it.trapKind==='spiderNest'?'E — Inspect the silk nest':it.trapKind==='wrongChoice'?'E — Choose an offering':'E — Inspect the suspicious cache',
			jungleChoice:'E — Touch the Root Heart',
			sacredOffering:'E — Inspect the sacred offering',
			vineElevator:it.disabled?'E — Inspect the severed vine':it.active?'E — Ride the Worldroot elevator':'E — Awaken the vine elevator',
			shortcutVine:'E — Activate the giant vine elevator',
			jungleCache:'E — Open the chest',
			jungleVault:it.locked?'E — Inspect the sealed reliquary':'E — Open the chest',
			jungleMemory:'E — Study the environmental clue',
			raptorEgg:'E — Break the storm egg',
			miniBossStart:'E — Wake the grove guardian',
		};
		return map[it.kind]||null;
	}

	function onEnemyDeath(en){
		if(global.JungleSetpiece && JungleSetpiece.onEnemyDeath) JungleSetpiece.onEnemyDeath(en);
		if(en&&en.roomId!=null)tryClearRoom(rooms()[en.roomId]);
		if(!en||!en.isMiniBoss||(en.type!=='elderTreant'&&en.type!=='stormRaptor'))return false;
		if(en._jungleRewarded)return true;
		en._jungleRewarded=true;J.miniBossSlain=true;
		disturbance(en.type==='elderTreant'?-8:6,null);
		if(typeof playerData!=='undefined'&&playerData){
			playerData.gold=(playerData.gold||0)+220;
			try{localStorage.setItem('magicBattle_playerData',JSON.stringify(playerData));}catch(e){}
		}
		const r=rooms()[en.roomId];
		if(r)clear(r,en.type==='elderTreant'?'The battlefield becomes still.':'The storm predator falls from the canopy.');
		banner(en.type==='elderTreant'?'ELDER TREANT DEFEATED — the roots release their hold.':'STORM RAPTOR DEFEATED — the sky path opens.');
		return true;
	}

	function meterHint(){
		const a=Math.round(awareness());
		if(a<25)return a+' — the ecosystem has barely noticed you';
		if(a<55)return a+' — predators are listening; secrets grow richer';
		if(a<80)return a+' — the jungle knows your scent and hazards quicken';
		return a+' — the entire ecosystem is awake';
	}
	function playerDmgMult(){return J.blessings.predatorInstinct?1.14:1;}

	function drawHazard(ctx,h){
		if(!inCurrent(h)&&h.type!=='flood'&&h.type!=='water')return;
		if(global.JungleProps&&JungleProps.drawHazard&&JungleProps.drawHazard(ctx,h))return;
		const x=h.x-cam().x,y=h.y-cam().y,t=(typeof performance!=='undefined'?performance.now():Date.now())*.001;
		ctx.save();
		if(h.type==='rootSnare'){
			ctx.strokeStyle=h.hot?'#b8ef71':h.warnOn?'rgba(207,174,82,.8)':'rgba(77,67,37,.45)';
			ctx.lineWidth=h.hot?7:3;
			for(let i=0;i<5;i++){ctx.beginPath();ctx.moveTo(x+i*h.w/4,y+h.h);ctx.lineTo(x+h.w*.5+(i-2)*8,y+(h.hot?-h.h*.65:h.h*.7));ctx.stroke();}
			if(h.warnOn&&!h.hot){ctx.fillStyle='rgba(222,183,76,.22)';ctx.fillRect(x,y+h.h-8,h.w,8);}
		}else if(h.type==='thornWall'){
			ctx.globalAlpha=h.hot ? 1 : (h.warnOn ? .55 : .22);
			ctx.strokeStyle=h.hot?'#9cdb54':'#456c35';ctx.lineWidth=6;
			for(let yy=0;yy<h.h;yy+=26){
				if(h.gapY&&h.y+yy>h.gapY&&h.y+yy<h.gapY+h.gapH)continue;
				ctx.beginPath();ctx.moveTo(x,y+yy);ctx.lineTo(x+h.w,y+yy+12);ctx.stroke();
				ctx.fillStyle='#d8ec83';ctx.beginPath();ctx.moveTo(x+h.w*.5,y+yy);ctx.lineTo(x+h.w*.5+9,y+yy-12);ctx.lineTo(x+h.w*.5+12,y+yy+8);ctx.fill();
			}
		}else if(h.type==='poisonFlower'){
			const cx=x+h.w/2,cy=y+h.h/2,r=h.cloudR||140;
			ctx.fillStyle=h.hot?'rgba(177,207,70,.32)':'rgba(87,129,48,.28)';
			ctx.beginPath();ctx.arc(cx,cy,h.hot?r:40,0,Math.PI*2);ctx.fill();
			if(h.warnOn&&!h.hot){ctx.strokeStyle='rgba(228,239,112,.72)';ctx.lineWidth=3;ctx.beginPath();ctx.arc(cx,cy,45+Math.sin(t*8)*8,0,Math.PI*2);ctx.stroke();}
		}else if(h.type==='fallingBranch'){
			const iy=h.impactY-cam().y;
			if(h.warnOn){ctx.fillStyle='rgba(5,10,5,.42)';ctx.beginPath();ctx.ellipse(x+h.w/2,iy,h.w*.48,16,0,0,Math.PI*2);ctx.fill();}
			const by=y+(h.impactY-h.y)*(h.fallP||0);
			ctx.strokeStyle='#2a2114';ctx.lineWidth=8;ctx.lineCap='round';
			ctx.beginPath();ctx.moveTo(x+h.w*.5,y-6);ctx.lineTo(x+h.w*.5,by+4);ctx.stroke();
			const bark=ctx.createLinearGradient(x,by,x,by+h.h);
			bark.addColorStop(0,'#8a6a3c');bark.addColorStop(.45,'#5a4224');bark.addColorStop(1,'#2f2416');
			ctx.fillStyle=bark;
			ctx.beginPath();
			ctx.moveTo(x+6,by+4);ctx.quadraticCurveTo(x+h.w*.5,by-8,x+h.w-6,by+6);
			ctx.lineTo(x+h.w-10,by+h.h);ctx.quadraticCurveTo(x+h.w*.5,by+h.h+8,x+10,by+h.h-2);
			ctx.closePath();ctx.fill();
			ctx.strokeStyle='rgba(196,158,88,.4)';ctx.lineWidth=2;
			ctx.beginPath();ctx.moveTo(x+18,by+8);ctx.quadraticCurveTo(x+h.w*.55,by+4,x+h.w-16,by+10);ctx.stroke();
			for(let i=0;i<5;i++){
				const tx=x+16+i*(h.w-32)/4, side=i%2?1:-1;
				ctx.strokeStyle='#4a3820';ctx.lineWidth=4;
				ctx.beginPath();ctx.moveTo(tx,by+8);ctx.quadraticCurveTo(tx+side*10,by-6,tx+side*18,by-14-(i%2)*6);ctx.stroke();
				ctx.fillStyle='#4f8a3a';ctx.beginPath();ctx.ellipse(tx+side*16,by-12,7,4,0,0,Math.PI*2);ctx.fill();
			}
		}else if(h.type==='swingingVine'){
			const bx=(h.bobX||h.x)-cam().x,by=(h.bobY||h.y)-cam().y;
			ctx.strokeStyle='#4f8e3e';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(bx,by);ctx.stroke();
			ctx.fillStyle='#6f5330';ctx.beginPath();ctx.arc(bx,by,30,0,Math.PI*2);ctx.fill();
			ctx.strokeStyle='#b4dd65';ctx.lineWidth=3;ctx.beginPath();ctx.arc(bx,by,34,0,Math.PI*2);ctx.stroke();
		}else if(h.type==='carnivorousPlant'){
			const open=h.hot ? 1 : (h.warnOn ? .65 : .15),cx=x+h.w/2,cy=y+h.h/2;
			ctx.fillStyle='#7aaa4d';
			ctx.beginPath();ctx.ellipse(cx-h.w*.18*open,cy,h.w*.28,h.h*.22,-.4,0,Math.PI*2);ctx.fill();
			ctx.beginPath();ctx.ellipse(cx+h.w*.18*open,cy,h.w*.28,h.h*.22,.4,0,Math.PI*2);ctx.fill();
			ctx.fillStyle='#f3e89b';for(let i=0;i<5;i++)ctx.fillRect(cx-30+i*15,cy-5,5,18);
		}else if(h.type==='sporePocket'){
			ctx.fillStyle=h.hot?'rgba(184,211,91,.3)':'rgba(105,126,62,.2)';
			ctx.beginPath();ctx.arc(x+h.w/2,y+h.h/2,h.hot?115:35,0,Math.PI*2);ctx.fill();
			for(let i=0;i<8;i++){ctx.fillStyle='rgba(218,234,129,.6)';ctx.beginPath();ctx.arc(x+h.w/2+Math.sin(t+i)*40,y+h.h/2+Math.cos(t*1.3+i)*35,3,0,Math.PI*2);ctx.fill();}
		}else if(h.type==='sinkingMud'){
			const g=ctx.createRadialGradient(x+h.w/2,y+h.h/2,8,x+h.w/2,y+h.h/2,h.w*.55);
			g.addColorStop(0,'rgba(31,28,15,.78)');g.addColorStop(.6,'rgba(87,73,34,.62)');g.addColorStop(1,'rgba(68,77,35,.08)');
			ctx.fillStyle=g;ctx.fillRect(x,y,h.w,h.h);
			ctx.strokeStyle='rgba(174,159,80,.35)';for(let i=0;i<4;i++){ctx.beginPath();ctx.arc(x+h.w/2,y+h.h/2,25+i*28+Math.sin(t*2+i)*4,0,Math.PI*2);ctx.stroke();}
		}else if(h.type==='rootCrusher'){
			ctx.globalAlpha=h.hot ? 1 : (h.warnOn ? .55 : .2);
			const len=h.h*(h.extend||.12);
			const g=ctx.createLinearGradient(x,y,x+h.w,y);
			g.addColorStop(0,'#2d2518');g.addColorStop(.5,'#82663a');g.addColorStop(1,'#302318');
			ctx.fillStyle=g;ctx.fillRect(x,y,h.w,len);
			if(h.warnOn&&!h.hot){ctx.fillStyle='rgba(218,186,91,.22)';ctx.fillRect(x,y+h.h-16,h.w,16);}
		}else if(h.type==='bounceMushroom'){
			const pulse=1+Math.sin(t*5+h.x)*.08;
			ctx.fillStyle=h.flower?'#e88aa9':'#88bd65';ctx.beginPath();ctx.ellipse(x+h.w/2,y+h.h*.35,h.w*.48*pulse,h.h*.34,0,0,Math.PI*2);ctx.fill();
			ctx.fillStyle='#d6d6a4';ctx.fillRect(x+h.w*.44,y+h.h*.35,h.w*.12,h.h*.65);
		}else if(h.type==='water'){
			if(h._fluidConsumed || (typeof DungeonFluid !== 'undefined' && DungeonFluid.ready)){ ctx.restore(); return; }
			const g=ctx.createLinearGradient(x,y,x,y+h.h);
			g.addColorStop(0,'rgba(70,190,170,.78)');
			g.addColorStop(.28,'rgba(22,96,92,.82)');
			g.addColorStop(1,'rgba(4,28,32,.94)');
			ctx.fillStyle=g;ctx.fillRect(x,y,h.w,h.h);
			ctx.fillStyle='rgba(210,255,230,.7)';ctx.fillRect(x,y,h.w,6);
			ctx.strokeStyle='rgba(180,255,220,.4)';ctx.lineWidth=2;
			for(let i=0;i<Math.max(3,h.w/140);i++){
				const xx=x+((i*131+t*40)%Math.max(1,h.w));
				ctx.beginPath();ctx.moveTo(xx,y+8);ctx.quadraticCurveTo(xx+28,y+2,xx+56,y+8);ctx.stroke();
			}
			ctx.fillStyle='rgba(160,230,210,.12)';
			for(let i=0;i<8;i++){
				const bx=x+((i*97+t*18)%h.w),by=y+20+(i%4)*h.h/5;
				ctx.beginPath();ctx.ellipse(bx,by,18,7,0,0,Math.PI*2);ctx.fill();
			}
		}else if(h.type==='waterfall'){
			const g=ctx.createLinearGradient(x,y,x+h.w,y);g.addColorStop(0,'rgba(100,210,205,.1)');g.addColorStop(.5,'rgba(204,255,230,.54)');g.addColorStop(1,'rgba(75,172,184,.1)');
			ctx.fillStyle=g;ctx.fillRect(x,y,h.w,h.h);
		}else if(h.type==='flood'&&h.level!=null&&!h.drained){
			if(h._fluidConsumed || (typeof DungeonFluid !== 'undefined' && DungeonFluid.ready)){ ctx.restore(); return; }
			const r=rooms()[h.roomId],bottom=r?r.y+r.h:h.y0+300,fy=h.level-cam().y;
			const g=ctx.createLinearGradient(0,fy,0,bottom-cam().y);g.addColorStop(0,'rgba(115,221,190,.6)');g.addColorStop(1,'rgba(8,55,61,.78)');
			ctx.fillStyle=g;ctx.fillRect(x,fy,h.w,bottom-h.level);ctx.fillStyle='rgba(222,255,230,.65)';ctx.fillRect(x,fy,h.w,5);
		}else if(h.type==='windGust'&&(h.warnOn||h.hot)){
			ctx.strokeStyle=h.hot?'rgba(190,238,238,.55)':'rgba(160,220,208,.25)';ctx.lineWidth=h.hot?4:2;
			for(let i=0;i<12;i++){const yy=y+(i+.5)*h.h/12,off=(t*120*(h.dir||1)+i*71)%h.w;ctx.beginPath();ctx.moveTo(x+off,yy);ctx.lineTo(x+off+(h.dir||1)*90,yy-8);ctx.stroke();}
		}else if(h.type==='stampede'&&h.armed){
			for(const herd of (h.herds||[])){
				const hx=herd.x-cam().x;ctx.fillStyle=herd.active?'rgba(38,45,24,.86)':'rgba(78,85,40,.3)';
				for(let i=0;i<7;i++){const yy=y+25+i*27;ctx.beginPath();ctx.ellipse(hx+(i%2)*24,yy,58,20,0,0,Math.PI*2);ctx.fill();}
			}
		}else if(h.type==='rootMigration'&&h.armed){
			ctx.globalAlpha=h.hot ? .9 : .35;ctx.fillStyle='#5d4929';ctx.fillRect(x+(h.shift||0),y,h.w*.3,h.h);
		}else if(h.type==='jungleCollapse'&&h.armed){
			const lx=x+(h.lane||0);
			if(h.warnOn){ctx.fillStyle='rgba(4,8,5,.45)';ctx.fillRect(lx,y+h.h-18,180,18);}
			if(h.hot){ctx.fillStyle='#40502c';ctx.fillRect(lx,y,180,h.h);}
		}else if(h.type==='growthGate'&&h.closed){
			ctx.fillStyle=h.secret?'rgba(38,69,32,.82)':'rgba(27,53,27,.9)';
			ctx.fillRect(x,y,h.w,h.h);
			ctx.strokeStyle=h.secret?'#9ad06a':'#679750';
			ctx.lineWidth=7;
			const vertical=h.h>=h.w;
			for(let i=0;i<6;i++){
				ctx.beginPath();
				if(vertical){
					const xx=x+(i+.5)*h.w/6;
					ctx.moveTo(xx,y);ctx.bezierCurveTo(xx+Math.sin(i)*18,y+h.h*.3,xx-Math.cos(i)*20,y+h.h*.7,xx,y+h.h);
				}else{
					const yy=y+(i+.5)*h.h/6;
					ctx.moveTo(x,yy);ctx.bezierCurveTo(x+h.w*.3,yy+Math.sin(i)*18,x+h.w*.7,yy-Math.cos(i)*20,x+h.w,yy);
				}
				ctx.stroke();
			}
			if(h.secret){
				ctx.fillStyle='rgba(199,237,112,.65)';ctx.beginPath();ctx.arc(x+h.w/2,y+h.h/2,8+Math.sin(t*4)*3,0,Math.PI*2);ctx.fill();
			}
		}
		ctx.restore();
	}

	function drawPlatform(ctx,p){
		if(p._gone||p._jungleHidden)return;
		const x=p.x-cam().x,y=p.y-cam().y;
		const vw=typeof canvas!=='undefined'&&canvas?canvas.width:2000;
		const vh=typeof canvas!=='undefined'&&canvas?canvas.height:1200;
		if(x+p.w<-24||x>vw+24||y+p.h<-24||y>vh+24)return;
		ctx.save();
		if(p._growT>0)ctx.globalAlpha=Math.max(.25,1-p._growT/90);
		const g=ctx.createLinearGradient(x,y,x,y+p.h);
		g.addColorStop(0,p.vineRung?'#7cab55':'#6f5731');g.addColorStop(1,p.vineRung?'#335c32':'#34271a');
		ctx.fillStyle=g;ctx.fillRect(x,y,p.w,p.h);
		ctx.fillStyle='rgba(137,202,86,.55)';ctx.fillRect(x,y,p.w,5);
		if(p.kind==='collapse'||p.crackLevel){
			ctx.strokeStyle=p._tick>40?'#e4c36d':'rgba(47,30,17,.75)';ctx.lineWidth=3;
			for(let i=1;i<Math.max(2,p.w/90);i++){ctx.beginPath();ctx.moveTo(x+i*83,y);ctx.lineTo(x+i*83-18,y+p.h);ctx.stroke();}
		}
		for(let i=0;i<p.w/80;i++){
			ctx.fillStyle='rgba(68,133,58,.65)';ctx.beginPath();ctx.arc(x+i*79+25,y+4,14,Math.PI,Math.PI*2);ctx.fill();
		}
		ctx.restore();
	}

	function drawInteractable(ctx,it,x,y){
		if(!dungeonOf())return false;
		if(it.kind==='miniBossBanner')return true;
		return false;
	}

	function drawWorld(ctx){
		const d=dungeonOf();if(!d)return;
		const r=current(),section=r?r.section:1;
		if(global.JungleProps&&JungleProps.drawRegionAtmosphere)JungleProps.drawRegionAtmosphere(ctx,section);
		/* Tiles are already in from the main pass. Do not stamp them again
		   after props — that buried every vine, statue, and carpet. */
		if(global.JungleProps&&JungleProps.draw){
			const list=d.decorations||[];
			for(let i=0;i<list.length;i++) JungleProps.draw(ctx,list[i]);
		}
		for(const h of hazards())drawHazard(ctx,h);
		if(global.JungleArt && JungleArt.drawStaticPlatforms) JungleArt.drawStaticPlatforms(ctx);
		else for(const p of platforms())drawPlatform(ctx,p);
		if(global.JungleArt && JungleArt.drawLivePlatforms) JungleArt.drawLivePlatforms(ctx);
		if(global.JunglePuzzles && JunglePuzzles.draw) JunglePuzzles.draw(ctx);
		if(global.JungleSetpiece && JungleSetpiece.draw) JungleSetpiece.draw(ctx);
		if(typeof global.drawVerdantColossusWorld==='function')global.drawVerdantColossusWorld(ctx);
		if(global.JunglePuzzles && JunglePuzzles.drawOverlay) JunglePuzzles.drawOverlay();
	}

	global.JungleWorld={
		init:init,
		update:update,
		updateHazards:updateHazards,
		roomEnter:roomEnter,
		roomClear:roomClear,
		updateClears:updateClears,
		tryInteract:tryInteract,
		prompt:prompt,
		liveObjective:liveObjective,
		onEnemyDeath:onEnemyDeath,
		drawWorld:drawWorld,
		drawInteractable:drawInteractable,
		meterHint:meterHint,
		playerDmgMult:playerDmgMult,
		activateGrowth:activateGrowth,
		state:J,
	};
})(typeof window!=='undefined'?window:globalThis);
