globalThis.window=globalThis;
require('/home/claude/game/magic-engine.js');require('/home/claude/game/magic-techniques.js');require('/home/claude/game/magic-vows.js');
const plug=process.argv.slice(2).filter(a=>!a.startsWith('--'));for(const p of plug)require(require('path').resolve(p));
const ME=globalThis.MagicEngine;
const out=ME.devTests.run();const bad=out.filter(o=>!o.pass);
console.log(out.length+' checks, '+bad.length+' failing');for(const b of bad)console.log(' FAIL',b.name,'|',b.detail);
if(process.argv.includes('--dm'))for(const o of out.filter(o=>/^DM/.test(o.name)))console.log(o.pass?'ok':'FAIL',o.name.slice(0,60),'|',o.detail);
