/* Fire dungeon room dressing — side-view painted sprites. */
(function(global){
	const SRC = {
		column: 'images/dungeon/fire-column.png',
		rubble: 'images/dungeon/fire-rubble.png',
		torch: 'images/dungeon/fire-torch.png',
		crystal: 'images/dungeon/fire-crystal.png',
		stalactite: 'images/dungeon/fire-stalactite.png',
		stalagmite: 'images/dungeon/fire-stalagmite.png',
		pipe: 'images/dungeon/fire-pipe.png',
		crack: 'images/dungeon/fire-crack.png',
	};
	const imgs = {};
	for(const k in SRC){
		const im = new Image();
		im.src = SRC[k];
		imgs[k] = im;
	}

	function ready(img){
		return img && img.complete && img.naturalWidth > 0;
	}
	function cam(){
		return (typeof camera !== 'undefined' && camera) ? camera : { x:0, y:0 };
	}
	function blit(ctx, img, x, y, w, h, flip){
		if(!ready(img) || w < 4 || h < 4) return false;
		const c = cam();
		const sx = x - c.x, sy = y - c.y;
		if(sx + w < -40 || sx > ((typeof canvas !== 'undefined' && canvas) ? canvas.width : 2000) + 40) return true;
		if(sy + h < -40 || sy > ((typeof canvas !== 'undefined' && canvas) ? canvas.height : 1200) + 40) return true;
		ctx.save();
		if(flip){
			ctx.translate(sx + w, sy);
			ctx.scale(-1, 1);
			ctx.drawImage(img, 0, 0, w, h);
		} else {
			ctx.drawImage(img, sx, sy, w, h);
		}
		ctx.restore();
		return true;
	}

	function draw(ctx, dec){
		if(!dec || !ctx) return false;
		const x = dec.x, y = dec.y || 0;
		switch(dec.type){
		case 'column':{
			const h = dec.h || 160;
			return blit(ctx, imgs.column, x - 18, y - h, 56, h);
		}
		case 'rubble':{
			const w = Math.max(48, dec.w || 56);
			return blit(ctx, imgs.rubble, x, y - 34, w, 36);
		}
		case 'torch':{
			const flip = dec.side === 'right';
			const ok = blit(ctx, imgs.torch, x - 10, y - 28, 36, 52, flip);
			if(ok){
				const c = cam();
				const fx = x - c.x + (flip ? -4 : 8);
				const fy = y - c.y - 18 + Math.sin((typeof performance !== 'undefined' ? performance.now() : Date.now()) * 0.012 + x) * 2;
				ctx.save();
				ctx.globalAlpha = 0.16;
				const g = ctx.createRadialGradient(fx, fy, 2, fx, fy, 70);
				g.addColorStop(0, '#ffb040');
				g.addColorStop(1, 'rgba(255,80,0,0)');
				ctx.fillStyle = g;
				ctx.beginPath();
				ctx.arc(fx, fy, 70, 0, Math.PI * 2);
				ctx.fill();
				ctx.restore();
			}
			return ok;
		}
		case 'crystal':{
			const s = Math.max(22, dec.size || 28);
			return blit(ctx, imgs.crystal, x - 4, y - s, s, s);
		}
		case 'stalactite':{
			const h = dec.h || 36;
			return blit(ctx, imgs.stalactite, x - 6, y, 28, h + 8);
		}
		case 'stalagmite':{
			const h = dec.h || 32;
			return blit(ctx, imgs.stalagmite, x - 6, y - h, 28, h + 6);
		}
		case 'pipe':{
			const h = dec.h || 80;
			return blit(ctx, imgs.pipe, x - 4, y, 22, h);
		}
		case 'crack':
		case 'glowCrack':{
			const s = dec.size || 48;
			return blit(ctx, imgs.crack, x, y, Math.max(48, s * 1.4), Math.max(18, s * 0.45));
		}
		default:
			return false;
		}
	}

	global.FireProps = { draw:draw, images:imgs };
})(typeof window !== 'undefined' ? window : globalThis);
