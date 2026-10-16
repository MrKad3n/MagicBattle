/* =============================================================
   The Living Wilds — mini-boss encounter kit.
   Verdant Colossus lives in verdant-colossus-kit.js.
   ============================================================= */

function isLivingWilds(){
	return typeof IS_DUNGEON!=='undefined'&&IS_DUNGEON&&typeof DUNGEON_TYPE!=='undefined'&&DUNGEON_TYPE==='earth'
		&&typeof dungeon!=='undefined'&&dungeon&&dungeon._jungle;
}
function jgRoom(en){
	if(typeof dungeon==='undefined'||!dungeon||!dungeon.rooms)return null;
	return dungeon.rooms[en.roomId]||dungeon.rooms.find(function(r){return r.kind==='boss';})||null;
}
function jgAim(){
	return {x:player.x+player.w/2,y:player.y+player.h/2,vx:player.vx||0,vy:player.vy||0};
}
function jgFloor(en){
	const r=jgRoom(en);
	return r?r.y+r.h-80:en.y+en.h;
}
function jgShake(a,t){if(typeof shakeScreen==='function')shakeScreen(a,t);}
function jgSpark(x,y,n,color){
	if(typeof particles==='undefined')return;
	for(let i=0;i<(n||14);i++){
		const a=Math.random()*Math.PI*2,s=2+Math.random()*5;
		particles.push({x:x+(Math.random()-.5)*24,y:y+(Math.random()-.5)*24,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1,life:22+Math.random()*24,maxLife:46,r:2+Math.random()*3,color:color||{r:104,g:207,b:97}});
	}
}
function jgProj(x,y,vx,vy,opts){
	opts=opts||{};
	opts.noZoneNerf=true;
	const p=spawnEnemyProj(x,y,vx,vy,opts);
	if(p)p._jungleBossStyle=opts._jungleBossStyle||'seed';
	return p;
}
function jgAlive(en){return en&&!en.dead&&en.hp>0;}
function jgTele(x,y,w,h,frames,color,label){
	spawnTelegraph(x,y,w,h,frames,color||'rgba(120,210,80,.32)','rect',label||'');
}

function updateJungleMiniBoss(en){
	if(!isLivingWilds()||!en||en.dead||!en.isMiniBoss)return false;
	if(en.type!=='elderTreant'&&en.type!=='stormRaptor')return false;
	if(en._jungleDormant)return false;
	en._jungleArenaT=(en._jungleArenaT||0)+1;
	const r=jgRoom(en);if(!r)return false;

	if(en.type==='elderTreant'){
		en._stunResist=Math.max(en._stunResist||0,2);
		if(!en._rootsAwake&&en.hp/en.maxHp<.56){
			en._rootsAwake=true;
			if(globalThis.DungeonEnv&&DungeonEnv.showBanner)DungeonEnv.showBanner('ANCIENT GROWTH — the battlefield itself wakes.');
			for(const h of (dungeon.hazards||[]))if(h.roomId===r.id&&(h.type==='rootSnare'||h.type==='rootCrusher'))h._manual=160;
			for(const p of (dungeon.platforms||[]))if(p.roomId===r.id&&p.growthId&&globalThis.JungleWorld)JungleWorld.activateGrowth(p.growthId,r.id);
			jgShake(9,20);
		}
		if(en._jungleArenaT%330===1){
			const floor=r.y+r.h-80;
			const aim=jgAim();
			for(let i=0;i<3;i++){
				const x=Math.max(r.x+120,Math.min(r.x+r.w-250,aim.x-240+i*240));
				jgTele(x,r.y+40,190,floor-r.y-40,60+i*10,'rgba(40,70,30,.22)',i===0?'FALLING BRANCHES — WATCH THE SHADOWS':'');
				setTimeout(function(){
					if(!jgAlive(en))return;
					jgProj(x,r.y+40,0,8.5,{color:'#604524',color2:'#90b856',power:32,width:190,height:36,shape:'missile',gravity:.08,maxAge:150,noWallCollide:true,_jungleBossStyle:'branch'});
				},570+i*110);
			}
		}
	}else if(en.type==='stormRaptor'){
		en._stunResist=Math.max(en._stunResist||0,1);
		return false;
	}
	return false;
}

function configureJungleCombat(){
	if(!isLivingWilds()||typeof ENEMY_TYPES==='undefined')return;
	const treant=ENEMY_TYPES.elderTreant;
	if(treant){
		treant.hp=Math.max(treant.hp,1900);treant.moveSpeed=.72;treant.detectRange=1700;treant.attackRange=1450;
		treant.name='Elder Treant';
	}
	const raptor=ENEMY_TYPES.stormRaptor;
	if(raptor){
		raptor.hp=Math.max(raptor.hp,1650);
		raptor.w=Math.max(raptor.w||0,128);
		raptor.h=Math.max(raptor.h||0,100);
		raptor.moveSpeed=Math.max(raptor.moveSpeed||0,5.5);
		raptor.name='Storm Raptor';
	}
}

configureJungleCombat();
