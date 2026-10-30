global.window=global;const d=require('path').join(__dirname,'..')+'/';for(const f of ['magic-engine.js','magic-techniques.js','magic-vows.js','magic-domain.js'])require(d+f);
const count=[];const ME=MagicEngine;const W=ME.createWorld();
const caster={x:90,y:80,w:20,h:40,vx:0,vy:0,hp:100,maxHp:100,onGround:true};
const host={mouseWorld:()=>({x:400,y:100}),getEnemies:()=>[],isSolid:()=>false,inBounds:()=>true,damageEnemy(){}, isPlayer:e=>e===caster};
const owner={id:'p',entity:caster};
const prof=ME.deriveProfile({magicPower:40,magicControl:20,maxMana:5000});prof.techniquePoints=20;prof.allocations={spatial:6};prof.maxEnergy=1e6;
function sp(){const s=ME.blankSpell('po');const r=s.nodes[s.rootId];r.type='generate';r.params=Object.assign(ME.paramDefaults('generate'),{amount:30});
 const n=ME.makeNode('technique',r.id,'s',0,1,1);n.params=Object.assign(ME.paramDefaults('technique'),{technique:'spatial',power:5});s.nodes[n.id]=n;s.seq=2;return s;}
for(let i=0;i<7;i++){const r=W.cast(sp(),{profile:prof,owner,host});if(!r.ok)console.log('cast fail',r.error);for(let k=0;k<40;k++)W.update(1/60,host);
 const ports=W.bodies.filter(b=>b.alive&&b.spatial&&b.spatial.kind==='portal');count.push(ports.length);}

const ok=count[3]===4&&count.slice(4).every(n=>n===4);console.log((ok?'  ok   ':'  FAIL ')+'A caster keeps at most 4 portals — the 5th closes the oldest  [counts '+count.join(',')+']');process.exit(ok?0:1);
