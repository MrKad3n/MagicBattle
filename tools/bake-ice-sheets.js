/* Bake Glacial Reach tileset + prop sheets: 40px tiles, 80px props, no backdrop. */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'images', 'dungeon');

function crcTable(){
	const t = new Uint32Array(256);
	for(let n = 0; n < 256; n++){
		let c = n;
		for(let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
		t[n] = c >>> 0;
	}
	return t;
}
const CRC = crcTable();
function crc32(buf){
	let c = 0xffffffff;
	for(let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}
function u32(n){ const b = Buffer.alloc(4); b.writeUInt32BE(n >>> 0, 0); return b; }
function chunk(type, data){
	const t = Buffer.from(type);
	const body = Buffer.concat([t, data]);
	return Buffer.concat([u32(data.length), body, u32(crc32(body))]);
}
function writePng(file, w, h, rgba){
	const raw = Buffer.alloc((w * 4 + 1) * h);
	for(let y = 0; y < h; y++){
		const row = y * (w * 4 + 1);
		raw[row] = 0;
		rgba.copy(raw, row + 1, y * w * 4, (y + 1) * w * 4);
	}
	const png = Buffer.concat([
		Buffer.from([137,80,78,71,13,10,26,10]),
		chunk('IHDR', Buffer.concat([u32(w), u32(h), Buffer.from([8,6,0,0,0])])),
		chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
		chunk('IEND', Buffer.alloc(0))
	]);
	fs.writeFileSync(file, png);
}

function canvas(w, h){
	return { w, h, d: Buffer.alloc(w * h * 4) };
}
function set(c, x, y, col){
	if(x < 0 || y < 0 || x >= c.w || y >= c.h) return;
	const i = (y * c.w + x) * 4;
	c.d[i] = col[0]; c.d[i+1] = col[1]; c.d[i+2] = col[2]; c.d[i+3] = col[3] == null ? 255 : col[3];
}
function get(c, x, y){
	if(x < 0 || y < 0 || x >= c.w || y >= c.h) return [0,0,0,0];
	const i = (y * c.w + x) * 4;
	return [c.d[i], c.d[i+1], c.d[i+2], c.d[i+3]];
}
function fill(c, x, y, w, h, col){
	for(let yy = y; yy < y + h; yy++) for(let xx = x; xx < x + w; xx++) set(c, xx, yy, col);
}
function h2(x, y, s){
	let n = Math.imul((x + 0x9e3779b9) | 0, 0x85ebca6b) ^ Math.imul((y + 0x165667b1) | 0, 0xc2b2ae35) ^ Math.imul(s | 0, 0x27d4eb2f);
	n = Math.imul(n ^ (n >>> 15), 0x85ebca6b);
	return (n ^ (n >>> 16)) >>> 0;
}
function mix(a, b, t){
	return [(a[0]+(b[0]-a[0])*t)|0, (a[1]+(b[1]-a[1])*t)|0, (a[2]+(b[2]-a[2])*t)|0, 255];
}

const PAL = {
	deep:[8,20,36], mid:[28,72,108], ice:[84,163,201], lit:[154,212,236], snow:[230,245,255],
	white:[242,249,255], stone:[70,90,108], stoneD:[42,54,68], stoneL:[140,158,172],
	rim:[180,230,255], crack:[198,226,240], void:[4,10,18]
};

function paintWall(dst, ox, oy, kind, seed){
	const pal = {
		packed:[PAL.deep, PAL.mid, PAL.ice, PAL.lit],
		crack:[PAL.deep, PAL.mid, PAL.crack, PAL.white],
		snow:[PAL.mid, PAL.ice, PAL.lit, PAL.snow],
		deep:[PAL.void, PAL.deep, PAL.mid, PAL.ice]
	}[kind];
	for(let y = 0; y < 40; y++){
		for(let x = 0; x < 40; x++){
			const n = (h2(x + seed, y + seed * 3, seed) & 255) / 255;
			let c = n > 0.74 ? pal[3] : n > 0.42 ? pal[2] : n > 0.18 ? pal[1] : pal[0];
			if(((y + (seed & 7)) % 10) === 0) c = mix(c, pal[0], 0.35);
			if(kind === 'snow' && y < 7 && n > 0.35) c = PAL.snow;
			if(kind === 'crack' && ((x + y * 2 + seed) % 17) < 2) c = PAL.white;
			if(kind === 'snow' && y < 4) c = PAL.white;
			set(dst, ox + x, oy + y, c);
		}
	}
}
function paintFloor(dst, ox, oy, kind, seed){
	const pal = {
		snow:[PAL.lit, PAL.snow, PAL.ice, PAL.white],
		packed:[PAL.ice, PAL.lit, PAL.mid, PAL.snow],
		deep:[PAL.mid, PAL.ice, PAL.deep, PAL.lit],
		crack:[PAL.ice, PAL.crack, PAL.mid, PAL.white]
	}[kind];
	for(let y = 0; y < 40; y++){
		for(let x = 0; x < 40; x++){
			const n = (h2(x + seed * 2, y, seed + 9) & 255) / 255;
			let c = y < 6 ? pal[3] : (n > 0.7 ? pal[1] : n > 0.32 ? pal[0] : pal[2]);
			if(y < 3) c = PAL.white;
			if(kind === 'crack' && ((x * 3 + y) % 13) < 1) c = PAL.deep;
			set(dst, ox + x, oy + y, c);
		}
	}
}
function paintCeil(dst, ox, oy, seed, ice){
	for(let y = 0; y < 40; y++){
		for(let x = 0; x < 40; x++){
			const n = (h2(x, y + seed, seed) & 255) / 255;
			let c = n > 0.55 ? PAL.mid : PAL.deep;
			if(y > 30) c = mix(c, PAL.ice, 0.35);
			if(ice && ((x + y * 2) % 14) < 2 && y > 18) c = PAL.lit;
			set(dst, ox + x, oy + y, c);
		}
	}
}
function paintRamp(dst, ox, oy, dir, seed){
	for(let y = 0; y < 40; y++){
		for(let x = 0; x < 40; x++){
			const t = dir === 'L' ? (39 - x) / 39 : dir === 'R' ? x / 39 : 0.45;
			const cut = (1 - t) * 34 + 3;
			if(y < cut){ set(dst, ox + x, oy + y, [0,0,0,0]); continue; }
			const n = (h2(x + seed, y, seed) & 255) / 255;
			const c = y < cut + 4 ? PAL.white : (n > 0.5 ? PAL.lit : PAL.ice);
			set(dst, ox + x, oy + y, c);
		}
	}
}
function paintSide(dst, ox, oy, dir){
	for(let y = 0; y < 40; y++){
		for(let x = 0; x < 40; x++){
			const edge = dir === 'L' ? x < 8 : x > 31;
			const n = (h2(x, y, dir === 'L' ? 3 : 8) & 255) / 255;
			set(dst, ox + x, oy + y, edge ? PAL.lit : (n > 0.5 ? PAL.mid : PAL.deep));
		}
	}
}
function paintBeam(dst, ox, oy, part, seed){
	for(let y = 0; y < 40; y++){
		for(let x = 0; x < 40; x++){
			let a = 255;
			if(y < 6 || y > 33) { /* cap */ }
			else if(y < 10 || y > 29) { /* rim */ }
			let c = y < 10 || y > 30 ? PAL.lit : PAL.ice;
			if(part === 'L' && x < 8) c = PAL.snow;
			if(part === 'R' && x > 31) c = PAL.snow;
			if(part === 'T' && (x < 6 || x > 33)) a = 0;
			if(((x + y + seed) % 11) === 0) c = PAL.mid;
			if(y < 5) c = PAL.white;
			if(y > 36) c = PAL.deep;
			set(dst, ox + x, oy + y, [c[0], c[1], c[2], a]);
		}
	}
}

function bakeTileset(){
	const c = canvas(320, 240);
	const putW = (col, row, k, s) => paintWall(c, col*40, row*40, k, s);
	const putF = (col, row, k, s) => paintFloor(c, col*40, row*40, k, s);
	putW(0,0,'packed',1); putW(1,0,'packed',2); putW(2,0,'crack',3); putW(3,0,'crack',4);
	putW(4,0,'snow',5); putW(5,0,'snow',6); putW(6,0,'deep',7); putW(7,0,'deep',8);
	putF(0,1,'snow',11); putF(1,1,'snow',12); putF(2,1,'packed',13); putF(3,1,'packed',14);
	putF(4,1,'deep',15); putF(5,1,'deep',16); putF(6,1,'crack',17); putF(7,1,'crack',18);
	paintCeil(c, 0, 80, 21, false); paintCeil(c, 40, 80, 22, false);
	paintSide(c, 80, 80, 'L'); paintSide(c, 120, 80, 'R');
	paintRamp(c, 160, 80, 'L', 31); paintRamp(c, 200, 80, 'R', 32); paintRamp(c, 240, 80, 'M', 33);
	putF(7,2,'snow',19);
	paintBeam(c, 0, 120, 'L', 41); paintBeam(c, 40, 120, 'M', 42); paintBeam(c, 80, 120, 'R', 43); paintBeam(c, 120, 120, 'T', 44);
	putW(4,3,'packed',45); putW(5,3,'packed',46); putW(6,3,'deep',47); paintCeil(c, 280, 120, 23, true);
	putW(0,4,'packed',51); putW(1,4,'crack',52); putW(2,4,'snow',53); putW(3,4,'deep',54);
	putF(4,4,'snow',55); putF(5,4,'packed',56); putF(6,4,'snow',57); putF(7,4,'deep',58);
	putW(0,5,'snow',61); putW(1,5,'crack',62); putF(2,5,'snow',63); putF(3,5,'deep',64);
	paintCeil(c, 160, 200, 24, false); paintCeil(c, 200, 200, 25, true);
	paintRamp(c, 240, 200, 'L', 65); paintRamp(c, 280, 200, 'R', 66);
	writePng(path.join(OUT, 'ice-tileset.png'), 320, 240, c.d);
}

function cell(sheet, col, row, paint){
	const ox = col * 80, oy = row * 80;
	paint(sheet, ox, oy);
}

function iceBlock(c, x, y, w, h, top){
	fill(c, x, y, w, h, PAL.mid);
	fill(c, x+2, y+2, w-4, h-4, PAL.ice);
	fill(c, x, y, w, 4, top || PAL.snow);
	fill(c, x, y+h-3, w, 3, PAL.deep);
	for(let i = 0; i < w; i += 7) fill(c, x+i+3, y+6, 2, h-12, PAL.lit);
}

function bakeProps(){
	const s = canvas(320, 320);
	/* column */
	cell(s,0,0,(c,x,y)=>{
		iceBlock(c, x+22, y+8, 36, 64, PAL.white);
		fill(c, x+16, y+4, 48, 12, PAL.snow);
		fill(c, x+16, y+66, 48, 10, PAL.stoneD);
		fill(c, x+28, y+18, 8, 40, PAL.rim);
	});
	/* altar */
	cell(s,1,0,(c,x,y)=>{
		iceBlock(c, x+12, y+40, 56, 28, PAL.snow);
		fill(c, x+24, y+18, 32, 28, PAL.ice);
		fill(c, x+28, y+22, 24, 16, PAL.rim);
		fill(c, x+34, y+10, 12, 14, PAL.white);
	});
	/* gate */
	cell(s,2,0,(c,x,y)=>{
		fill(c, x+14, y+8, 52, 64, PAL.stoneD);
		fill(c, x+20, y+16, 40, 50, PAL.deep);
		fill(c, x+26, y+22, 28, 38, PAL.mid);
		fill(c, x+14, y+8, 52, 8, PAL.snow);
		fill(c, x+36, y+38, 6, 10, PAL.lit);
	});
	/* icicle hang */
	cell(s,3,0,(c,x,y)=>{
		fill(c, x+28, y+4, 24, 8, PAL.snow);
		fill(c, x+32, y+10, 16, 48, PAL.ice);
		fill(c, x+36, y+18, 8, 50, PAL.lit);
		fill(c, x+38, y+58, 4, 16, PAL.white);
	});
	/* mirror */
	cell(s,0,1,(c,x,y)=>{
		fill(c, x+24, y+8, 32, 64, PAL.stone);
		fill(c, x+28, y+14, 24, 52, PAL.rim);
		fill(c, x+32, y+18, 16, 44, [200,240,255,220]);
		fill(c, x+20, y+68, 40, 8, PAL.snow);
	});
	/* statue */
	cell(s,1,1,(c,x,y)=>{
		fill(c, x+20, y+56, 40, 16, PAL.stoneD);
		fill(c, x+28, y+24, 24, 36, PAL.stone);
		fill(c, x+30, y+8, 20, 20, PAL.stoneL);
		fill(c, x+34, y+14, 4, 4, PAL.deep);
		fill(c, x+40, y+14, 4, 4, PAL.deep);
		fill(c, x+18, y+64, 44, 8, PAL.snow);
	});
	/* crystal */
	cell(s,2,1,(c,x,y)=>{
		fill(c, x+34, y+8, 12, 56, PAL.rim);
		fill(c, x+22, y+28, 12, 36, PAL.ice);
		fill(c, x+46, y+24, 10, 40, PAL.lit);
		fill(c, x+36, y+12, 8, 20, PAL.white);
		fill(c, x+16, y+64, 48, 10, PAL.snow);
	});
	/* rings */
	cell(s,3,1,(c,x,y)=>{
		fill(c, x+16, y+16, 48, 48, PAL.mid);
		fill(c, x+24, y+24, 32, 32, PAL.deep);
		fill(c, x+30, y+30, 20, 20, PAL.ice);
		fill(c, x+36, y+36, 8, 8, PAL.white);
		fill(c, x+12, y+12, 8, 8, PAL.lit);
	});
	/* barrier colonnade */
	cell(s,0,2,(c,x,y)=>{
		iceBlock(c, x+10, y+16, 16, 52, PAL.snow);
		iceBlock(c, x+32, y+16, 16, 52, PAL.snow);
		iceBlock(c, x+54, y+16, 16, 52, PAL.snow);
		fill(c, x+8, y+12, 64, 8, PAL.white);
	});
	/* door */
	cell(s,1,2,(c,x,y)=>{
		fill(c, x+16, y+8, 48, 64, PAL.stone);
		fill(c, x+22, y+16, 36, 50, PAL.deep);
		fill(c, x+16, y+8, 48, 10, PAL.snow);
		fill(c, x+36, y+40, 6, 8, PAL.lit);
	});
	/* lantern */
	cell(s,2,2,(c,x,y)=>{
		fill(c, x+36, y+8, 8, 28, PAL.stoneD);
		fill(c, x+28, y+32, 24, 22, PAL.ice);
		fill(c, x+32, y+36, 16, 14, PAL.white);
		fill(c, x+24, y+54, 32, 10, PAL.snow);
	});
	/* mound */
	cell(s,3,2,(c,x,y)=>{
		fill(c, x+12, y+48, 56, 20, PAL.snow);
		fill(c, x+20, y+36, 40, 16, PAL.white);
		fill(c, x+28, y+28, 24, 12, PAL.lit);
	});
	/* fence */
	cell(s,0,3,(c,x,y)=>{
		for(let i = 0; i < 4; i++) fill(c, x+12+i*16, y+24, 6, 44, PAL.stone);
		fill(c, x+10, y+36, 62, 5, PAL.ice);
		fill(c, x+10, y+50, 62, 5, PAL.ice);
		fill(c, x+8, y+64, 64, 8, PAL.snow);
	});
	/* crack plate */
	cell(s,1,3,(c,x,y)=>{
		fill(c, x+12, y+40, 56, 24, PAL.ice);
		fill(c, x+16, y+44, 48, 16, PAL.lit);
		fill(c, x+20, y+40, 3, 24, PAL.deep);
		fill(c, x+40, y+44, 3, 16, PAL.deep);
		fill(c, x+54, y+42, 2, 18, PAL.deep);
	});
	/* banner */
	cell(s,2,3,(c,x,y)=>{
		fill(c, x+20, y+8, 40, 6, PAL.stone);
		fill(c, x+36, y+8, 8, 16, PAL.stoneD);
		fill(c, x+24, y+20, 32, 44, PAL.ice);
		fill(c, x+30, y+28, 20, 20, PAL.rim);
		fill(c, x+28, y+62, 24, 8, PAL.snow);
	});
	/* cache */
	cell(s,3,3,(c,x,y)=>{
		fill(c, x+16, y+36, 48, 32, PAL.stoneD);
		fill(c, x+20, y+40, 40, 22, PAL.stone);
		fill(c, x+16, y+32, 48, 8, PAL.ice);
		fill(c, x+36, y+48, 8, 8, PAL.lit);
	});
	writePng(path.join(OUT, 'ice-props-sheet.png'), 320, 320, s.d);
}

function bakeCrystal(){
	const s = canvas(320, 320);
	cell(s,0,0,(c,x,y)=>{ fill(c,x+30,y+6,20,60,PAL.rim); fill(c,x+34,y+10,12,24,PAL.white); fill(c,x+18,y+64,44,10,PAL.snow); });
	cell(s,1,0,(c,x,y)=>{ fill(c,x+18,y+20,16,48,PAL.ice); fill(c,x+36,y+8,14,60,PAL.lit); fill(c,x+52,y+28,10,40,PAL.rim); fill(c,x+14,y+66,54,8,PAL.snow); });
	cell(s,2,0,(c,x,y)=>{ fill(c,x+28,y+4,24,10,PAL.snow); fill(c,x+32,y+12,16,58,PAL.ice); fill(c,x+36,y+20,8,50,PAL.white); });
	cell(s,3,0,(c,x,y)=>{ fill(c,x+20,y+16,40,48,PAL.mid); fill(c,x+26,y+22,28,36,PAL.rim); fill(c,x+32,y+28,16,24,[210,240,255,230]); });
	cell(s,0,1,(c,x,y)=>{ iceBlock(c,x+28,y+10,24,60,PAL.white); fill(c,x+32,y+18,16,40,PAL.rim); });
	cell(s,1,1,(c,x,y)=>{ fill(c,x+16,y+20,48,48,PAL.ice); fill(c,x+24,y+28,32,32,PAL.deep); fill(c,x+32,y+36,16,16,PAL.white); });
	cell(s,2,1,(c,x,y)=>{ fill(c,x+10,y+50,60,18,PAL.lit); fill(c,x+18,y+40,44,14,PAL.ice); fill(c,x+28,y+32,24,12,PAL.white); });
	cell(s,3,1,(c,x,y)=>{ fill(c,x+24,y+8,32,64,PAL.stone); fill(c,x+28,y+16,24,48,PAL.deep); fill(c,x+34,y+24,12,32,PAL.rim); });
	cell(s,0,2,(c,x,y)=>{ fill(c,x+36,y+6,8,70,PAL.lit); fill(c,x+32,y+20,16,8,PAL.white); });
	cell(s,1,2,(c,x,y)=>{ fill(c,x+12,y+36,56,28,PAL.ice); fill(c,x+20,y+28,40,12,PAL.lit); fill(c,x+36,y+16,8,16,PAL.white); });
	cell(s,2,2,(c,x,y)=>{ fill(c,x+8,y+24,20,44,PAL.ice); fill(c,x+30,y+12,20,56,PAL.lit); fill(c,x+52,y+28,18,40,PAL.rim); });
	cell(s,3,2,(c,x,y)=>{ fill(c,x+20,y+40,40,24,PAL.mid); fill(c,x+28,y+20,24,28,PAL.ice); fill(c,x+34,y+8,12,16,PAL.white); });
	cell(s,0,3,(c,x,y)=>{ fill(c,x+16,y+16,48,48,PAL.deep); fill(c,x+24,y+24,32,32,PAL.ice); fill(c,x+36,y+36,8,8,PAL.white); });
	cell(s,1,3,(c,x,y)=>{ fill(c,x+10,y+48,60,20,PAL.snow); fill(c,x+22,y+36,36,16,PAL.white); });
	cell(s,2,3,(c,x,y)=>{ fill(c,x+28,y+8,24,64,PAL.ice); fill(c,x+32,y+16,16,48,PAL.white); fill(c,x+20,y+68,40,6,PAL.snow); });
	cell(s,3,3,(c,x,y)=>{ fill(c,x+18,y+18,44,44,PAL.rim); fill(c,x+26,y+26,28,28,PAL.white); fill(c,x+34,y+34,12,12,PAL.ice); });
	writePng(path.join(OUT, 'ice-crystal-sheet.png'), 320, 320, s.d);
}

function bakeLight(){
	const s = canvas(320, 320);
	cell(s,0,0,(c,x,y)=>{ fill(c,x+36,y+6,8,30,PAL.stoneD); fill(c,x+28,y+32,24,24,PAL.ice); fill(c,x+32,y+36,16,16,PAL.white); fill(c,x+24,y+56,32,12,PAL.snow); });
	cell(s,1,0,(c,x,y)=>{ fill(c,x+20,y+40,40,28,PAL.stone); fill(c,x+28,y+16,24,28,PAL.ice); fill(c,x+32,y+20,16,16,PAL.white); });
	cell(s,2,0,(c,x,y)=>{ fill(c,x+32,y+8,16,56,PAL.lit); fill(c,x+24,y+48,32,20,PAL.ice); fill(c,x+36,y+14,8,20,PAL.white); });
	cell(s,3,0,(c,x,y)=>{ fill(c,x+22,y+20,36,48,PAL.stoneD); fill(c,x+28,y+8,24,20,PAL.ice); fill(c,x+32,y+28,16,16,PAL.rim); });
	cell(s,0,1,(c,x,y)=>{ fill(c,x+16,y+24,48,40,PAL.mid); fill(c,x+24,y+12,32,20,PAL.lit); fill(c,x+32,y+32,16,16,PAL.white); });
	cell(s,1,1,(c,x,y)=>{ fill(c,x+28,y+8,24,16,PAL.stone); fill(c,x+24,y+22,32,40,PAL.ice); fill(c,x+30,y+28,20,20,PAL.white); });
	cell(s,2,1,(c,x,y)=>{ fill(c,x+20,y+16,40,48,PAL.deep); fill(c,x+28,y+24,24,32,PAL.rim); fill(c,x+34,y+30,12,12,PAL.white); });
	cell(s,3,1,(c,x,y)=>{ fill(c,x+12,y+48,56,20,PAL.snow); fill(c,x+30,y+16,20,36,PAL.lit); fill(c,x+34,y+20,12,16,PAL.white); });
	cell(s,0,2,(c,x,y)=>{ fill(c,x+36,y+4,8,72,PAL.stoneD); fill(c,x+28,y+20,24,18,PAL.ice); fill(c,x+32,y+24,16,10,PAL.white); });
	cell(s,1,2,(c,x,y)=>{ fill(c,x+18,y+28,44,36,PAL.ice); fill(c,x+26,y+16,28,20,PAL.white); fill(c,x+14,y+60,52,10,PAL.snow); });
	cell(s,2,2,(c,x,y)=>{ fill(c,x+24,y+8,32,56,PAL.mid); fill(c,x+30,y+16,20,28,PAL.rim); fill(c,x+20,y+62,40,10,PAL.snow); });
	cell(s,3,2,(c,x,y)=>{ fill(c,x+32,y+6,16,60,PAL.lit); fill(c,x+28,y+50,24,18,PAL.ice); });
	cell(s,0,3,(c,x,y)=>{ fill(c,x+16,y+20,48,44,PAL.deep); fill(c,x+24,y+28,32,28,PAL.ice); fill(c,x+36,y+36,8,8,PAL.white); });
	cell(s,1,3,(c,x,y)=>{ fill(c,x+20,y+36,40,28,PAL.stone); fill(c,x+28,y+16,24,24,PAL.white); fill(c,x+32,y+20,16,12,PAL.rim); });
	cell(s,2,3,(c,x,y)=>{ fill(c,x+12,y+44,56,24,PAL.ice); fill(c,x+24,y+20,32,28,PAL.lit); fill(c,x+32,y+8,16,16,PAL.white); });
	cell(s,3,3,(c,x,y)=>{ fill(c,x+28,y+8,24,56,PAL.ice); fill(c,x+32,y+16,16,28,PAL.white); fill(c,x+20,y+64,40,8,PAL.snow); });
	writePng(path.join(OUT, 'ice-light-sheet.png'), 320, 320, s.d);
}

function bakeRuin(){
	const s = canvas(320, 320);
	cell(s,0,0,(c,x,y)=>{ fill(c,x+12,y+8,56,64,PAL.stoneD); fill(c,x+18,y+16,44,48,PAL.stone); fill(c,x+12,y+8,56,8,PAL.snow); fill(c,x+34,y+36,12,8,PAL.lit); });
	cell(s,1,0,(c,x,y)=>{ fill(c,x+20,y+12,40,56,PAL.stone); fill(c,x+16,y+8,48,10,PAL.snow); fill(c,x+28,y+24,24,28,PAL.deep); });
	cell(s,2,0,(c,x,y)=>{ fill(c,x+16,y+20,48,48,PAL.stoneD); fill(c,x+24,y+28,32,32,PAL.mid); fill(c,x+12,y+64,56,8,PAL.snow); });
	cell(s,3,0,(c,x,y)=>{ fill(c,x+24,y+8,32,64,PAL.stone); fill(c,x+28,y+16,24,48,PAL.deep); fill(c,x+36,y+36,8,12,PAL.ice); });
	cell(s,0,1,(c,x,y)=>{ fill(c,x+10,y+48,60,20,PAL.stoneD); fill(c,x+18,y+20,16,40,PAL.stone); fill(c,x+46,y+28,16,32,PAL.stone); fill(c,x+8,y+64,64,8,PAL.snow); });
	cell(s,1,1,(c,x,y)=>{ fill(c,x+16,y+16,48,52,PAL.mid); fill(c,x+22,y+24,36,36,PAL.deep); fill(c,x+32,y+36,16,12,PAL.rim); });
	cell(s,2,1,(c,x,y)=>{ fill(c,x+20,y+8,40,6,PAL.stone); fill(c,x+24,y+12,32,52,PAL.ice); fill(c,x+30,y+20,20,24,PAL.rim); });
	cell(s,3,1,(c,x,y)=>{ fill(c,x+12,y+40,56,28,PAL.ice); fill(c,x+20,y+44,40,16,PAL.lit); fill(c,x+24,y+40,4,24,PAL.deep); fill(c,x+48,y+42,3,18,PAL.deep); });
	cell(s,0,2,(c,x,y)=>{ fill(c,x+28,y+8,24,60,PAL.stoneD); fill(c,x+20,y+56,40,16,PAL.stone); fill(c,x+16,y+68,48,6,PAL.snow); });
	cell(s,1,2,(c,x,y)=>{ fill(c,x+14,y+16,52,52,PAL.stone); fill(c,x+22,y+24,36,36,PAL.deep); fill(c,x+14,y+16,52,8,PAL.snow); });
	cell(s,2,2,(c,x,y)=>{ fill(c,x+18,y+36,44,32,PAL.stoneD); fill(c,x+26,y+16,28,28,PAL.stoneL); fill(c,x+32,y+22,6,6,PAL.deep); fill(c,x+40,y+22,6,6,PAL.deep); });
	cell(s,3,2,(c,x,y)=>{ fill(c,x+16,y+24,48,44,PAL.mid); fill(c,x+24,y+12,32,20,PAL.ice); fill(c,x+12,y+64,56,8,PAL.snow); });
	cell(s,0,3,(c,x,y)=>{ fill(c,x+8,y+20,20,48,PAL.stone); fill(c,x+32,y+12,16,56,PAL.stoneD); fill(c,x+52,y+24,18,44,PAL.stone); fill(c,x+6,y+64,68,8,PAL.snow); });
	cell(s,1,3,(c,x,y)=>{ fill(c,x+20,y+16,40,48,PAL.ice); fill(c,x+16,y+12,48,8,PAL.snow); fill(c,x+28,y+28,24,20,PAL.rim); });
	cell(s,2,3,(c,x,y)=>{ fill(c,x+12,y+32,56,36,PAL.stoneD); fill(c,x+20,y+16,40,24,PAL.stone); fill(c,x+28,y+40,24,12,PAL.deep); });
	cell(s,3,3,(c,x,y)=>{ fill(c,x+16,y+20,48,48,PAL.deep); fill(c,x+24,y+28,32,32,PAL.mid); fill(c,x+36,y+40,8,8,PAL.lit); fill(c,x+12,y+64,56,8,PAL.snow); });
	writePng(path.join(OUT, 'ice-ruin-sheet.png'), 320, 320, s.d);
}

bakeTileset();
bakeProps();
bakeCrystal();
bakeLight();
bakeRuin();
console.log('baked ice-tileset + ice-props/crystal/light/ruin sheets');
