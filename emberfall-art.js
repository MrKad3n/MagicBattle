/* EmberFall art: texture/sprite loading and the architecture painter.
   Every building is painted once from the painted textures in images/emberfall/tex (plaster, stone, roof tiles,
   timber, planks) with shading for a sun in the upper left, then cached as its own canvas.
   Painter results: { cv, ox, oy, w, h, plats:[local rects], door:{x,w,h} } — (ox, oy) is the body's
   bottom-left (ground line) inside the canvas, so a building is drawn at (worldX - ox, groundY - oy). */
(function (global) {
	'use strict';

	const V = 'v=3';
	const IMG = {};
	function img(path) {
		if (!IMG[path]) {
			const i = new Image();
			i.src = path;
			IMG[path] = i;
		}
		return IMG[path];
	}
	function ok(i) { return !!(i && i.complete && i.naturalWidth > 0); }

	const TEX = {
		plaster: ['images/emberfall/tex/plaster.jpg', 0.42],
		stone: ['images/emberfall/tex/stone-brick.jpg', 0.36],
		stoneBig: ['images/emberfall/tex/stone-brick.jpg', 0.55],
		roofRed: ['images/emberfall/tex/roof-red.jpg', 0.2],
		roofSlate: ['images/emberfall/tex/roof-slate.jpg', 0.19],
		thatch: ['images/emberfall/tex/roof-thatch.jpg', 0.26],
		timber: ['images/emberfall/tex/timber.jpg', 0.5],
		wood: ['images/emberfall/tex/wood-floor.jpg', 0.36],
		cobble: ['images/emberfall/tex/cobblestone.jpg', 0.32],
		grassTop: ['images/emberfall/tex/grass-dirt.jpg', 0.4],
		soil: ['images/emberfall/soil.png', 1],
		cliff: ['images/emberfall/cliff.png', 1],
		rockface: ['images/emberfall/rockface.png', 1.5],
		rockfaceCold: ['images/emberfall/rockface-cold.png', 1.5],
		deeprock: ['images/emberfall/deeprock.png', 1]
	};
	const SPRITES = {
		grassMeadow: 'images/emberfall/grass-meadow.png',
		grassTown: 'images/emberfall/grass-town.png',
		grassDry: 'images/emberfall/grass-dry.png',
		grassCold: 'images/emberfall/grass-cold.png',
		grassFrost: 'images/emberfall/grass-frost.png',
		grassSnow: 'images/emberfall/grass-snow.png',
		moss: 'images/emberfall/moss.png'
	};
	const ROAD = ['wagon', 'cart', 'wheel', 'fence', 'bush', 'sign', 'hay', 'pine', 'shrine', 'tent', 'tower', 'gate', 'bridge', 'crates', 'banner', 'sacks'];
	let floraMeta = null;
	const flora = {};
	function loadAll() {
		for (const k in TEX) img(TEX[k][0] + '?' + V);
		for (const k in SPRITES) img(SPRITES[k] + '?' + V);
		ROAD.forEach(n => img('images/props/road-' + n + '.png?v=2'));
		if (!floraMeta && typeof fetch === 'function') {
			floraMeta = {};
			fetch('images/emberfall/flora/flora.json?' + V).then(r => r.json()).then(j => {
				floraMeta = j;
				for (const k in j) flora[k] = img('images/emberfall/flora/' + k + '.png?' + V);
			}).catch(() => {});
		}
	}
	function texReady() {
		for (const k in TEX) if (!ok(IMG[TEX[k][0] + '?' + V])) return false;
		return true;
	}
	function sprite(name) { return IMG[SPRITES[name] + '?' + V]; }
	function road(name) { return IMG['images/props/road-' + name + '.png?v=2']; }
	function floraImg(name) { return flora[name]; }
	function floraInfo(name) { return floraMeta && floraMeta[name]; }

	/* ------------------------------------------------------------------ canvas + patterns */
	function canvas(w, h) {
		const c = document.createElement('canvas');
		c.width = Math.max(1, Math.ceil(w));
		c.height = Math.max(1, Math.ceil(h));
		return c;
	}
	const PAT = {};
	const PAT_SRC = {};
	function patSource(name) {
		if (PAT_SRC[name]) return PAT_SRC[name];
		const t = TEX[name];
		const i = IMG[t[0] + '?' + V];
		if (!ok(i)) return null;
		const c = canvas(i.naturalWidth * t[1], i.naturalHeight * t[1]);
		const g = c.getContext('2d');
		g.imageSmoothingQuality = 'high';
		g.drawImage(i, 0, 0, c.width, c.height);
		PAT_SRC[name] = c;
		return c;
	}
	function pattern(g, name, ox, oy, sx, sy, rot) {
		const key = name;
		let p = PAT[key];
		if (!p) {
			const src = patSource(name);
			if (!src) return '#777';
			p = g.createPattern(src, 'repeat');
			PAT[key] = p;
		}
		if (p.setTransform && typeof DOMMatrix !== 'undefined') {
			let m = new DOMMatrix().translate(ox || 0, oy || 0);
			if (rot) m = m.rotate(rot);
			if (sx || sy) m = m.scale(sx || 1, sy || 1);
			p.setTransform(m);
		}
		return p;
	}
	function rnd(seed) {
		let s = (seed | 0) || 1;
		return function () {
			s = Math.imul(s ^ (s >>> 15), 2246822507);
			s = Math.imul(s ^ (s >>> 13), 3266489909);
			s ^= s >>> 16;
			return (s >>> 0) / 4294967296;
		};
	}
	function hexA(hex, a) {
		const n = parseInt(hex.slice(1), 16);
		return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
	}
	function shade(hex, k) {
		const n = parseInt(hex.slice(1), 16);
		const f = v => Math.max(0, Math.min(255, Math.round(v * k)));
		return 'rgb(' + f(n >> 16 & 255) + ',' + f(n >> 8 & 255) + ',' + f(n & 255) + ')';
	}

	/* ------------------------------------------------------------------ shared details */
	function texRect(g, name, x, y, w, h, tint, ox, oy) {
		g.save();
		g.fillStyle = pattern(g, name, ox == null ? 0 : ox, oy == null ? 0 : oy);
		g.fillRect(x, y, w, h);
		if (tint) {
			g.fillStyle = tint;
			g.fillRect(x, y, w, h);
		}
		g.restore();
	}
	function sideLight(g, x, y, w, h, a) {
		const gr = g.createLinearGradient(x, 0, x + w, 0);
		gr.addColorStop(0, 'rgba(255,240,210,' + (a * 0.55) + ')');
		gr.addColorStop(0.35, 'rgba(255,240,210,0)');
		gr.addColorStop(0.7, 'rgba(10,8,20,0)');
		gr.addColorStop(1, 'rgba(10,8,20,' + a + ')');
		g.fillStyle = gr;
		g.fillRect(x, y, w, h);
	}
	function groundAO(g, x, y, w, h) {
		const gr = g.createLinearGradient(0, y + h - 46, 0, y + h);
		gr.addColorStop(0, 'rgba(20,14,8,0)');
		gr.addColorStop(1, 'rgba(20,14,8,0.42)');
		g.fillStyle = gr;
		g.fillRect(x, y + h - 46, w, 46);
	}
	function eaveShadow(g, x, y, w, depth) {
		const gr = g.createLinearGradient(0, y, 0, y + depth);
		gr.addColorStop(0, 'rgba(15,10,6,0.55)');
		gr.addColorStop(1, 'rgba(15,10,6,0)');
		g.fillStyle = gr;
		g.fillRect(x, y, w, depth);
	}
	function beam(g, x, y, w, h, base) {
		g.save();
		g.fillStyle = pattern(g, 'timber', x * 0.7, y * 0.3);
		g.fillRect(x, y, w, h);
		g.fillStyle = hexA(base || '#2b1d12', 0.62);
		g.fillRect(x, y, w, h);
		g.fillStyle = 'rgba(255,220,170,0.14)';
		if (w > h) g.fillRect(x, y, w, Math.max(1, h * 0.25));
		else g.fillRect(x, y, Math.max(1, w * 0.25), h);
		g.fillStyle = 'rgba(0,0,0,0.25)';
		if (w > h) g.fillRect(x, y + h - Math.max(1, h * 0.2), w, Math.max(1, h * 0.2));
		else g.fillRect(x + w - Math.max(1, w * 0.2), y, Math.max(1, w * 0.2), h);
		g.restore();
	}
	function diagBeam(g, x0, y0, x1, y1, t, base) {
		const a = Math.atan2(y1 - y0, x1 - x0);
		const L = Math.hypot(x1 - x0, y1 - y0);
		g.save();
		g.translate(x0, y0);
		g.rotate(a);
		beam(g, 0, -t / 2, L, t, base);
		g.restore();
	}

	function windowAt(g, x, y, w, h, o) {
		o = o || {};
		const lit = !!o.lit;
		const arch = !!o.arch;
		const fr = o.frame || '#3a2818';
		g.save();
		// recess / frame
		g.fillStyle = 'rgba(0,0,0,0.35)';
		g.fillRect(x - 6, y - 6, w + 12, h + 12);
		const path = () => {
			g.beginPath();
			if (arch) {
				g.moveTo(x, y + h);
				g.lineTo(x, y + w / 2);
				g.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0);
				g.lineTo(x + w, y + h);
				g.closePath();
			} else g.rect(x, y, w, h);
		};
		// frame
		g.fillStyle = fr;
		g.save();
		g.translate(0, 0);
		g.beginPath();
		if (arch) {
			g.moveTo(x - 5, y + h + 4);
			g.lineTo(x - 5, y + w / 2);
			g.arc(x + w / 2, y + w / 2, w / 2 + 5, Math.PI, 0);
			g.lineTo(x + w + 5, y + h + 4);
			g.closePath();
		} else g.rect(x - 5, y - 5, w + 10, h + 9);
		g.fill();
		g.restore();
		// glass
		path();
		const gl = g.createLinearGradient(x, y, x + w * 0.4, y + h);
		if (lit) {
			gl.addColorStop(0, '#ffe7a6');
			gl.addColorStop(0.5, '#f7b955');
			gl.addColorStop(1, '#c46a26');
		} else {
			gl.addColorStop(0, o.sky || '#8fb3c9');
			gl.addColorStop(0.45, '#40566b');
			gl.addColorStop(1, '#1f2a36');
		}
		g.fillStyle = gl;
		g.fill();
		if (!lit) {
			// reflection streak
			g.save();
			path();
			g.clip();
			g.fillStyle = 'rgba(255,255,255,0.22)';
			g.beginPath();
			g.moveTo(x + w * 0.15, y + h);
			g.lineTo(x + w * 0.45, y);
			g.lineTo(x + w * 0.62, y);
			g.lineTo(x + w * 0.32, y + h);
			g.fill();
			g.restore();
		}
		// mullions
		g.fillStyle = fr;
		const mw = Math.max(3, w * 0.08);
		g.fillRect(x + w / 2 - mw / 2, y + (arch ? w * 0.15 : 0), mw, h - (arch ? w * 0.15 : 0));
		g.fillRect(x, y + h * (arch ? 0.55 : 0.48) - mw / 2, w, mw);
		if (o.panes && !arch) {
			g.fillRect(x + w / 4 - 1, y, 2, h);
			g.fillRect(x + w * 3 / 4 - 1, y, 2, h);
		}
		// sill
		g.fillStyle = o.sill || '#5a4a3a';
		g.fillRect(x - 9, y + h + 3, w + 18, 7);
		g.fillStyle = 'rgba(255,240,200,0.25)';
		g.fillRect(x - 9, y + h + 3, w + 18, 2);
		if (o.shutters) {
			const sw = w * 0.5;
			for (const side of [-1, 1]) {
				const sx = side < 0 ? x - 6 - sw : x + w + 6;
				g.fillStyle = o.shutters;
				g.fillRect(sx, y - 2, sw, h + 4);
				g.fillStyle = 'rgba(0,0,0,0.25)';
				for (let k = 1; k < 4; k++) g.fillRect(sx + sw * k / 4 - 1, y - 2, 1.5, h + 4);
				g.fillStyle = 'rgba(255,255,255,0.12)';
				g.fillRect(sx, y - 2, sw, 3);
				g.fillStyle = 'rgba(0,0,0,0.3)';
				g.fillRect(sx, y + h * 0.3, sw, 3);
				g.fillRect(sx, y + h * 0.7, sw, 3);
			}
		}
		if (o.flowers) flowerBox(g, x - 8, y + h + 9, w + 16, o.flowers);
		g.restore();
	}
	function flowerBox(g, x, y, w, cols) {
		const r = rnd(Math.round(x * 13 + y * 7));
		g.fillStyle = '#4a321e';
		g.fillRect(x, y, w, 14);
		g.fillStyle = 'rgba(255,220,170,0.18)';
		g.fillRect(x, y, w, 3);
		for (let i = 0; i < w / 5; i++) {
			const fx = x + r() * w;
			const fy = y - r() * 14;
			g.fillStyle = r() < 0.5 ? '#3d6a24' : '#2c5019';
			g.beginPath();
			g.ellipse(fx, fy + 6, 6, 4, r() * 3, 0, Math.PI * 2);
			g.fill();
		}
		for (let i = 0; i < w / 7; i++) {
			const fx = x + 3 + r() * (w - 6);
			const fy = y - 2 - r() * 12;
			g.fillStyle = cols[Math.floor(r() * cols.length)];
			g.beginPath();
			g.arc(fx, fy, 2.6 + r() * 1.6, 0, Math.PI * 2);
			g.fill();
		}
	}
	function door(g, x, y, w, h, o) {
		o = o || {};
		const arch = o.arch !== false;
		g.save();
		// frame stones / casing
		g.fillStyle = o.frame || '#2e2116';
		g.beginPath();
		if (arch) {
			g.moveTo(x - 8, y + h);
			g.lineTo(x - 8, y + w / 2);
			g.arc(x + w / 2, y + w / 2, w / 2 + 8, Math.PI, 0);
			g.lineTo(x + w + 8, y + h);
		} else g.rect(x - 8, y - 8, w + 16, h + 8);
		g.fill();
		g.beginPath();
		if (arch) {
			g.moveTo(x, y + h);
			g.lineTo(x, y + w / 2);
			g.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0);
			g.lineTo(x + w, y + h);
			g.closePath();
		} else g.rect(x, y, w, h);
		g.save();
		g.clip();
		if (o.open) {
			g.fillStyle = '#120c08';
			g.fillRect(x, y, w, h);
			const lg = g.createRadialGradient(x + w / 2, y + h * 0.7, 4, x + w / 2, y + h * 0.7, h);
			lg.addColorStop(0, 'rgba(255,170,70,0.55)');
			lg.addColorStop(1, 'rgba(255,170,70,0)');
			g.fillStyle = lg;
			g.fillRect(x, y, w, h);
		} else {
			g.fillStyle = pattern(g, 'wood', x, y, 1, 1, 90);
			g.fillRect(x, y, w, h);
			g.fillStyle = hexA(o.color || '#5a3a20', 0.45);
			g.fillRect(x, y, w, h);
			g.fillStyle = 'rgba(0,0,0,0.3)';
			const planks = Math.max(3, Math.round(w / 14));
			for (let i = 1; i < planks; i++) g.fillRect(x + w * i / planks - 1, y, 2, h);
			// iron straps
			g.fillStyle = '#2b2a2a';
			g.fillRect(x, y + h * 0.28, w * 0.8, 5);
			g.fillRect(x, y + h * 0.72, w * 0.8, 5);
			g.fillStyle = '#9a8a60';
			g.beginPath();
			g.arc(x + w * 0.78, y + h * 0.55, 4, 0, Math.PI * 2);
			g.fill();
		}
		sideLight(g, x, y, w, h, 0.35);
		g.restore();
		// step
		g.fillStyle = '#6b6258';
		g.fillRect(x - 12, y + h - 6, w + 24, 8);
		g.fillStyle = 'rgba(255,240,210,0.25)';
		g.fillRect(x - 12, y + h - 6, w + 24, 2);
		g.restore();
	}
	function lantern(g, x, y) {
		g.save();
		g.fillStyle = '#1e1a16';
		g.fillRect(x - 2, y - 26, 4, 14);
		g.fillRect(x - 16, y - 28, 18, 3);
		const lg = g.createRadialGradient(x, y, 2, x, y, 38);
		lg.addColorStop(0, 'rgba(255,200,110,0.55)');
		lg.addColorStop(1, 'rgba(255,200,110,0)');
		g.fillStyle = lg;
		g.fillRect(x - 40, y - 40, 80, 80);
		g.fillStyle = '#2a2420';
		g.fillRect(x - 8, y - 13, 16, 24);
		g.fillStyle = '#ffd27a';
		g.fillRect(x - 5, y - 9, 10, 16);
		g.fillStyle = '#2a2420';
		g.beginPath();
		g.moveTo(x - 10, y - 13);
		g.lineTo(x, y - 21);
		g.lineTo(x + 10, y - 13);
		g.fill();
		g.restore();
	}
	const SIGN_ICON = {
		mug(g, x, y, s) {
			g.fillStyle = '#e8c45a';
			g.fillRect(x - s * 0.35, y - s * 0.35, s * 0.55, s * 0.7);
			g.strokeStyle = '#e8c45a';
			g.lineWidth = s * 0.1;
			g.beginPath();
			g.arc(x + s * 0.24, y, s * 0.18, -1.3, 1.3);
			g.stroke();
			g.fillStyle = '#fff6dc';
			g.fillRect(x - s * 0.38, y - s * 0.42, s * 0.61, s * 0.14);
		},
		anvil(g, x, y, s) {
			g.fillStyle = '#c9c4b8';
			g.beginPath();
			g.moveTo(x - s * 0.45, y - s * 0.2);
			g.lineTo(x + s * 0.45, y - s * 0.2);
			g.lineTo(x + s * 0.2, y);
			g.lineTo(x + s * 0.15, y + s * 0.25);
			g.lineTo(x + s * 0.3, y + s * 0.35);
			g.lineTo(x - s * 0.3, y + s * 0.35);
			g.lineTo(x - s * 0.15, y + s * 0.25);
			g.lineTo(x - s * 0.2, y);
			g.closePath();
			g.fill();
		},
		potion(g, x, y, s) {
			g.fillStyle = '#7fd37a';
			g.beginPath();
			g.arc(x, y + s * 0.12, s * 0.3, 0, Math.PI * 2);
			g.fill();
			g.fillStyle = '#d9e8f0';
			g.fillRect(x - s * 0.08, y - s * 0.38, s * 0.16, s * 0.25);
		},
		scroll(g, x, y, s) {
			g.fillStyle = '#f0e2b8';
			g.fillRect(x - s * 0.35, y - s * 0.25, s * 0.7, s * 0.5);
			g.fillStyle = '#c9a85a';
			g.fillRect(x - s * 0.42, y - s * 0.3, s * 0.12, s * 0.6);
			g.fillRect(x + s * 0.3, y - s * 0.3, s * 0.12, s * 0.6);
		},
		gem(g, x, y, s) {
			g.fillStyle = '#c46ad0';
			g.beginPath();
			g.moveTo(x, y + s * 0.38);
			g.lineTo(x - s * 0.36, y - s * 0.05);
			g.lineTo(x - s * 0.18, y - s * 0.3);
			g.lineTo(x + s * 0.18, y - s * 0.3);
			g.lineTo(x + s * 0.36, y - s * 0.05);
			g.closePath();
			g.fill();
			g.fillStyle = 'rgba(255,255,255,0.45)';
			g.fillRect(x - s * 0.15, y - s * 0.24, s * 0.12, s * 0.16);
		},
		wheat(g, x, y, s) {
			g.strokeStyle = '#e3c25a';
			g.lineWidth = s * 0.07;
			for (let i = -1; i <= 1; i++) {
				g.beginPath();
				g.moveTo(x + i * s * 0.12, y + s * 0.38);
				g.lineTo(x + i * s * 0.2, y - s * 0.3);
				g.stroke();
				for (let k = 0; k < 4; k++) {
					g.beginPath();
					g.ellipse(x + i * s * 0.18, y - s * 0.28 + k * s * 0.13, s * 0.06, s * 0.1, i * 0.4, 0, Math.PI * 2);
					g.fillStyle = '#e3c25a';
					g.fill();
				}
			}
		},
		key(g, x, y, s) {
			g.strokeStyle = '#e8c45a';
			g.lineWidth = s * 0.11;
			g.beginPath();
			g.arc(x - s * 0.18, y, s * 0.16, 0, Math.PI * 2);
			g.moveTo(x - s * 0.02, y);
			g.lineTo(x + s * 0.4, y);
			g.moveTo(x + s * 0.3, y);
			g.lineTo(x + s * 0.3, y + s * 0.15);
			g.moveTo(x + s * 0.2, y);
			g.lineTo(x + s * 0.2, y + s * 0.12);
			g.stroke();
		},
		map(g, x, y, s) {
			g.fillStyle = '#e9dcb0';
			g.fillRect(x - s * 0.36, y - s * 0.28, s * 0.72, s * 0.56);
			g.strokeStyle = '#8a5a2a';
			g.lineWidth = s * 0.05;
			g.beginPath();
			g.moveTo(x - s * 0.28, y + s * 0.12);
			g.bezierCurveTo(x - s * 0.1, y - s * 0.2, x + s * 0.05, y + s * 0.2, x + s * 0.26, y - s * 0.14);
			g.stroke();
			g.fillStyle = '#c0392b';
			g.beginPath();
			g.arc(x + s * 0.26, y - s * 0.14, s * 0.06, 0, 7);
			g.fill();
		},
		sword(g, x, y, s) {
			g.fillStyle = '#d8dde2';
			g.fillRect(x - s * 0.04, y - s * 0.42, s * 0.08, s * 0.6);
			g.fillStyle = '#c9a85a';
			g.fillRect(x - s * 0.2, y + s * 0.16, s * 0.4, s * 0.07);
			g.fillRect(x - s * 0.04, y + s * 0.22, s * 0.08, s * 0.18);
		},
		star(g, x, y, s) {
			g.fillStyle = '#9fc3ff';
			g.beginPath();
			for (let i = 0; i < 10; i++) {
				const r = i % 2 ? s * 0.16 : s * 0.4;
				const a = -Math.PI / 2 + i * Math.PI / 5;
				g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
			}
			g.fill();
		},
		basket(g, x, y, s) {
			g.fillStyle = '#c99a5a';
			g.beginPath();
			g.moveTo(x - s * 0.36, y - s * 0.05);
			g.lineTo(x + s * 0.36, y - s * 0.05);
			g.lineTo(x + s * 0.26, y + s * 0.34);
			g.lineTo(x - s * 0.26, y + s * 0.34);
			g.fill();
			g.fillStyle = '#d9542a';
			g.beginPath();
			g.arc(x - s * 0.12, y - s * 0.12, s * 0.12, 0, 7);
			g.arc(x + s * 0.12, y - s * 0.14, s * 0.12, 0, 7);
			g.fill();
		},
		book(g, x, y, s) {
			g.fillStyle = '#7a2a2a';
			g.fillRect(x - s * 0.32, y - s * 0.26, s * 0.64, s * 0.52);
			g.fillStyle = '#e8c45a';
			g.fillRect(x - s * 0.32, y - s * 0.26, s * 0.08, s * 0.52);
		},
		eye(g, x, y, s) {
			g.fillStyle = '#e9dcb0';
			g.beginPath();
			g.ellipse(x, y, s * 0.38, s * 0.2, 0, 0, 7);
			g.fill();
			g.fillStyle = '#5a3a7a';
			g.beginPath();
			g.arc(x, y, s * 0.12, 0, 7);
			g.fill();
		}
	};
	function hangingSign(g, x, y, dir, icon, col) {
		const s = 46;
		g.save();
		g.fillStyle = '#1f1a16';
		g.fillRect(x, y - 3, dir * 64, 5);
		g.fillRect(x, y - 3, 5, 26);
		g.beginPath();
		g.moveTo(x, y + 22);
		g.lineTo(x + dir * 40, y);
		g.lineWidth = 3;
		g.strokeStyle = '#1f1a16';
		g.stroke();
		const bx = x + dir * 44 - s / 2;
		g.fillStyle = '#3a3633';
		g.fillRect(bx + 6, y, 2, 10);
		g.fillRect(bx + s - 8, y, 2, 10);
		g.fillStyle = col || '#5a3a22';
		g.fillRect(bx, y + 9, s, s);
		g.fillStyle = 'rgba(0,0,0,0.3)';
		g.fillRect(bx + s - 5, y + 9, 5, s);
		g.strokeStyle = '#c9a85a';
		g.lineWidth = 2;
		g.strokeRect(bx + 3, y + 12, s - 6, s - 6);
		if (SIGN_ICON[icon]) SIGN_ICON[icon](g, bx + s / 2, y + 9 + s / 2, s * 0.8);
		g.restore();
	}
	function awning(g, x, y, w, depth, cols) {
		g.save();
		const n = Math.max(4, Math.round(w / 22));
		const sw = w / n;
		for (let i = 0; i < n; i++) {
			g.fillStyle = cols[i % cols.length];
			g.beginPath();
			g.moveTo(x + i * sw, y);
			g.lineTo(x + (i + 1) * sw, y);
			g.lineTo(x + (i + 1) * sw + 6, y + depth);
			g.lineTo(x + i * sw + 6, y + depth);
			g.fill();
			// scallop
			g.beginPath();
			g.arc(x + i * sw + sw / 2 + 6, y + depth, sw / 2, 0, Math.PI);
			g.fill();
		}
		const sh = g.createLinearGradient(0, y, 0, y + depth + sw / 2);
		sh.addColorStop(0, 'rgba(255,255,255,0.18)');
		sh.addColorStop(1, 'rgba(0,0,0,0.25)');
		g.fillStyle = sh;
		g.fillRect(x, y, w + 6, depth + sw / 2);
		// shadow under
		const sd = g.createLinearGradient(0, y + depth, 0, y + depth + 40);
		sd.addColorStop(0, 'rgba(10,6,4,0.35)');
		sd.addColorStop(1, 'rgba(10,6,4,0)');
		g.fillStyle = sd;
		g.fillRect(x + 4, y + depth + sw / 2, w, 40);
		g.restore();
	}

	/* ------------------------------------------------------------------ roofs */
	function roofPlane(g, xL, xR, yEave, yRidge, inset, kind, seed) {
		/* A roof seen from the front: a trapezoid of tiles with a ridge cap. */
		const tex = kind === 'slate' ? 'roofSlate' : kind === 'thatch' ? 'thatch' : 'roofRed';
		g.save();
		g.beginPath();
		g.moveTo(xL, yEave);
		g.lineTo(xL + inset, yRidge);
		g.lineTo(xR - inset, yRidge);
		g.lineTo(xR, yEave);
		g.closePath();
		g.fillStyle = pattern(g, tex, xL * 0.37, yRidge);
		g.fill();
		g.clip();
		// light: upper part brighter, eave darker, left lit
		const vg = g.createLinearGradient(0, yRidge, 0, yEave);
		vg.addColorStop(0, 'rgba(255,235,200,0.16)');
		vg.addColorStop(0.7, 'rgba(0,0,0,0)');
		vg.addColorStop(1, 'rgba(0,0,0,0.25)');
		g.fillStyle = vg;
		g.fillRect(xL, yRidge, xR - xL, yEave - yRidge);
		sideLight(g, xL, yRidge, xR - xL, yEave - yRidge, 0.28);
		// moss / weathering streaks
		const r = rnd(seed || 7);
		for (let i = 0; i < (xR - xL) / 60; i++) {
			const mx = xL + r() * (xR - xL);
			const my = yRidge + r() * (yEave - yRidge);
			const mg = g.createRadialGradient(mx, my, 1, mx, my, 18 + r() * 30);
			mg.addColorStop(0, kind === 'thatch' ? 'rgba(70,60,30,0.25)' : 'rgba(60,80,40,0.22)');
			mg.addColorStop(1, 'rgba(60,80,40,0)');
			g.fillStyle = mg;
			g.fillRect(mx - 50, my - 50, 100, 100);
		}
		g.restore();
		// ridge cap and eave edge
		g.fillStyle = kind === 'slate' ? '#2c3440' : kind === 'thatch' ? '#7a5e2a' : '#6e2a1a';
		g.fillRect(xL + inset - 4, yRidge - 6, xR - xL - inset * 2 + 8, 10);
		g.fillStyle = 'rgba(255,230,190,0.25)';
		g.fillRect(xL + inset - 4, yRidge - 6, xR - xL - inset * 2 + 8, 3);
		g.fillStyle = 'rgba(0,0,0,0.35)';
		g.fillRect(xL - 2, yEave - 2, xR - xL + 4, 6);
		// verge boards along the sloped sides
		g.strokeStyle = kind === 'thatch' ? '#5a4420' : '#3a281a';
		g.lineWidth = 7;
		g.beginPath();
		g.moveTo(xL, yEave);
		g.lineTo(xL + inset, yRidge);
		g.moveTo(xR, yEave);
		g.lineTo(xR - inset, yRidge);
		g.stroke();
	}
	function gableEnd(g, xL, xR, yEave, yRidge, wallTex, frame, kind) {
		/* A gable facing us: triangle of wall with the roof edge along the slopes. */
		const cx = (xL + xR) / 2;
		g.save();
		g.beginPath();
		g.moveTo(xL + 14, yEave);
		g.lineTo(cx, yRidge + 14);
		g.lineTo(xR - 14, yEave);
		g.closePath();
		g.fillStyle = pattern(g, wallTex, 0, 0);
		g.fill();
		g.clip();
		if (frame) {
			beam(g, cx - 6, yRidge, 12, yEave - yRidge, frame);
			diagBeam(g, xL + 30, yEave, cx, yRidge + 40, 10, frame);
			diagBeam(g, xR - 30, yEave, cx, yRidge + 40, 10, frame);
		}
		sideLight(g, xL, yRidge, xR - xL, yEave - yRidge, 0.3);
		g.restore();
		// roof edges: a thick band of tiles following the two slopes
		const tex = kind === 'slate' ? 'roofSlate' : kind === 'thatch' ? 'thatch' : 'roofRed';
		const th = kind === 'thatch' ? 40 : 28;
		g.save();
		g.lineJoin = 'miter';
		g.lineCap = 'butt';
		g.beginPath();
		g.moveTo(xL - 6, yEave + th * 0.35);
		g.lineTo(cx, yRidge - th * 0.1);
		g.lineTo(xR + 6, yEave + th * 0.35);
		g.lineWidth = th;
		g.strokeStyle = pattern(g, tex, 0, 0);
		g.stroke();
		g.lineWidth = th;
		g.strokeStyle = 'rgba(0,0,0,0.12)';
		g.stroke();
		g.beginPath();
		g.moveTo(xL - 6, yEave + th * 0.85);
		g.lineTo(cx, yRidge + th * 0.4);
		g.lineTo(xR + 6, yEave + th * 0.85);
		g.lineWidth = 4;
		g.strokeStyle = 'rgba(0,0,0,0.35)';
		g.stroke();
		g.restore();
	}
	function chimney(g, x, yBase, h, w) {
		g.save();
		texRect(g, 'stone', x, yBase - h, w, h + 8);
		sideLight(g, x, yBase - h, w, h, 0.45);
		g.fillStyle = '#4a4440';
		g.fillRect(x - 5, yBase - h - 8, w + 10, 10);
		g.fillStyle = 'rgba(255,240,210,0.3)';
		g.fillRect(x - 5, yBase - h - 8, w + 10, 3);
		g.fillStyle = '#1a1512';
		g.fillRect(x + 5, yBase - h - 12, w - 10, 5);
		g.restore();
	}

	/* ------------------------------------------------------------------ house */
	const WALL = { plaster: 'plaster', stone: 'stone', wood: 'wood', brick: 'stone', logs: 'timber' };
	function house(s) {
		const W = s.w;
		const floors = s.floors || 2;
		const fh = s.fh || 150;
		const plinth = s.plinth == null ? 30 : s.plinth;
		const jet = s.jetty ? 12 : 0;
		const topW = W + jet * 2 * (floors - 1);
		const ov = s.overhang == null ? 22 : s.overhang;
		const roofKind = s.roof || 'red';
		const gable = s.gable;
		const roofH = s.roofH || (gable ? Math.round((topW + ov * 2) * 0.55) : Math.round(fh * 0.95 + topW * 0.08));
		const bodyH = plinth + floors * fh;
		const padX = Math.max(ov, 40) + jet * floors + 70;
		const padTop = roofH + (s.chimney ? 70 : 20) + 30;
		const CW = W + padX * 2;
		const CH = bodyH + padTop + 16;
		const cv = canvas(CW, CH);
		const g = cv.getContext('2d');
		const bx = padX;
		const gy = CH - 10;
		const r = rnd(s.seed || W * 7 + floors);
		const wallTex = WALL[s.wall || 'plaster'];
		const frame = s.frame === false ? null : (s.frame || (s.wall === 'plaster' || !s.wall ? '#2b1d12' : null));
		const tint = s.tint || null;
		const plats = [];
		// plinth
		if (plinth > 0) {
			texRect(g, 'stone', bx - 4, gy - plinth, W + 8, plinth);
			g.fillStyle = 'rgba(0,0,0,0.15)';
			g.fillRect(bx - 4, gy - plinth, W + 8, plinth);
			g.fillStyle = 'rgba(255,240,210,0.25)';
			g.fillRect(bx - 6, gy - plinth - 4, W + 12, 5);
		}
		const floorRects = [];
		for (let f = 0; f < floors; f++) {
			const x = bx - jet * f;
			const w = W + jet * 2 * f;
			const y = gy - plinth - (f + 1) * fh;
			floorRects.push({ x, y, w, h: fh });
			texRect(g, wallTex, x, y, w, fh, tint);
			if (s.wall === 'logs') {
				// round log courses: each log lit on top, shadowed underneath, with a dark seam of chinking
				for (let k = y; k < y + fh; k += 22) {
					const lg = g.createLinearGradient(0, k, 0, k + 22);
					lg.addColorStop(0, 'rgba(150,104,62,0.55)');
					lg.addColorStop(0.35, 'rgba(176,128,80,0.35)');
					lg.addColorStop(0.8, 'rgba(40,24,12,0.35)');
					lg.addColorStop(1, 'rgba(20,12,6,0.75)');
					g.fillStyle = lg;
					g.fillRect(x, k, w, 22);
				}
			}
			if (s.wall === 'wood') {
				g.fillStyle = 'rgba(0,0,0,0.18)';
				for (let k = y; k < y + fh; k += 24) g.fillRect(x, k, w, 2);
			}
		}
		// windows / door positions
		const doorW = s.doorW || 58;
		const doorH = s.doorH || 104;
		const doorX = s.door != null ? bx + s.door * W - doorW / 2 : (s.noDoor ? null : bx + W / 2 - doorW / 2);
		const lit = s.lit == null ? 0.35 : s.lit;
		for (let f = 0; f < floors; f++) {
			const R = floorRects[f];
			const n = s.win ? s.win[f] != null ? s.win[f] : s.win[s.win.length - 1] : Math.max(1, Math.floor(R.w / 120));
			const ww = s.winW || 44;
			const wh = Math.min(fh - 62, s.winH || 64);
			const wy = R.y + (fh - wh) * 0.42;
			for (let i = 0; i < n; i++) {
				const wx = R.x + R.w * (i + 0.5) / n - ww / 2;
				if (f === 0 && doorX != null && wx + ww > doorX - 26 && wx < doorX + doorW + 26) continue;
				if (frame) {
					beam(g, wx - 16, R.y + 10, 9, fh - 20, frame);
					beam(g, wx + ww + 7, R.y + 10, 9, fh - 20, frame);
				}
				windowAt(g, wx, wy, ww, wh, { lit: r() < lit, shutters: s.shutters, flowers: s.flowers && r() < 0.7 ? s.flowers : null, arch: s.archWin, panes: s.panes });
			}
			if (frame) {
				// framing: corner posts, floor beams and braces in the wide panels
				beam(g, R.x, R.y, 14, fh, frame);
				beam(g, R.x + R.w - 14, R.y, 14, fh, frame);
				beam(g, R.x - 4, R.y, R.w + 8, 14, frame);
				if (f === 0) beam(g, R.x, R.y + fh - 12, R.w, 12, frame);
				if (s.braces !== false && R.w > 160) {
					diagBeam(g, R.x + 14, R.y + fh - 12, R.x + 60, R.y + 14, 9, frame);
					diagBeam(g, R.x + R.w - 14, R.y + fh - 12, R.x + R.w - 60, R.y + 14, 9, frame);
				}
			}
			if (f > 0 && jet) {
				// jetty: beam ends and brackets under the overhang
				for (let k = 0; k < 2; k++) {
					const ex = k ? R.x + R.w - 18 : R.x + 4;
					beam(g, ex, R.y + fh - 6, 14, 22, frame || '#3a281a');
				}
				eaveShadow(g, floorRects[f - 1].x, floorRects[f - 1].y, floorRects[f - 1].w, 26);
			}
			if (s.wall === 'stone') {
				// stone quoins
				for (let k = R.y; k < R.y + fh; k += 36) {
					g.fillStyle = 'rgba(255,245,225,0.14)';
					g.fillRect(R.x, k, 22, 16);
					g.fillRect(R.x + R.w - 22, k + 18, 22, 16);
				}
				g.fillStyle = 'rgba(0,0,0,0.2)';
				g.fillRect(R.x - 4, R.y, R.w + 8, 8);
			}
		}
		// door
		if (doorX != null) door(g, doorX, gy - doorH - 2, doorW, doorH, { arch: s.archDoor !== false, open: s.openDoor, color: s.doorColor });
		// lighting over the walls
		const top = floorRects[floors - 1];
		const wallTop = top.y;
		g.save();
		g.beginPath();
		for (const R of floorRects) g.rect(R.x, R.y, R.w, R.h);
		g.rect(bx - 4, gy - plinth, W + 8, plinth);
		g.clip();
		sideLight(g, bx - jet * floors, wallTop, W + jet * 2 * floors, bodyH, 0.32);
		groundAO(g, bx - 10, wallTop, W + 20, bodyH);
		const dirt = g.createLinearGradient(0, gy - 120, 0, gy);
		dirt.addColorStop(0, 'rgba(60,45,30,0)');
		dirt.addColorStop(1, 'rgba(60,45,30,0.25)');
		g.fillStyle = dirt;
		g.fillRect(bx - 10, gy - 120, W + 20, 120);
		g.restore();
		// roof
		const xL = top.x - ov;
		const xR = top.x + top.w + ov;
		eaveShadow(g, top.x, wallTop, top.w, 34);
		if (gable) {
			gableEnd(g, xL, xR, wallTop + 4, wallTop - roofH, wallTex, frame, roofKind);
		} else {
			roofPlane(g, xL, xR, wallTop + 6, wallTop - roofH, Math.min(roofH * 0.55, (xR - xL) * 0.22), roofKind, s.seed || W);
			if (s.dormer) {
				const dw = Math.min(110, (xR - xL) * 0.28);
				const dx = (xL + xR) / 2 - dw / 2 + (s.dormer === 'l' ? -topW * 0.2 : s.dormer === 'r' ? topW * 0.2 : 0);
				const dyb = wallTop - roofH * 0.25;
				texRect(g, wallTex, dx, dyb - 64, dw, 64);
				windowAt(g, dx + dw / 2 - 18, dyb - 54, 36, 40, { lit: r() < 0.4 });
				sideLight(g, dx, dyb - 64, dw, 64, 0.3);
				const tri = dw + 28;
				roofPlane(g, dx - 14, dx + dw + 14, dyb - 60, dyb - 60 - 46, tri * 0.42, roofKind, 3);
			}
		}
		if (s.chimney) {
			const cxs = Array.isArray(s.chimney) ? s.chimney : [0.72];
			for (const c of cxs) {
				const cx = top.x + top.w * c;
				const t = Math.abs(cx - (xL + xR) / 2) / ((xR - xL) / 2);
				const roofAt = gable ? wallTop - roofH * (1 - t) : wallTop - roofH * Math.min(1, (1 - t) * 1.6);
				chimney(g, cx - 18, roofAt + 10, Math.max(60, wallTop - roofH - roofAt + 70), 36);
			}
		}
		if (s.sign) hangingSign(g, s.sign.side > 0 ? bx + W - 4 : bx + 4, gy - plinth - fh - 30, s.sign.side > 0 ? 1 : -1, s.sign.icon, s.sign.color);
		if (s.awning) awning(g, (doorX != null ? doorX : bx + W / 2) - 70, gy - plinth - fh + 6, doorW + 140, 34, s.awning);
		if (s.lanterns) {
			if (doorX != null) {
				lantern(g, doorX - 26, gy - doorH + 10);
				lantern(g, doorX + doorW + 26, gy - doorH + 10);
			}
		}
		if (s.balcony) {
			const f = s.balcony;
			const R = floorRects[Math.min(floors - 1, f)];
			const by = R.y + fh - 8;
			const bw = Math.min(R.w * 0.7, 260);
			const bxx = R.x + (R.w - bw) / 2;
			g.fillStyle = '#3a281a';
			g.fillRect(bxx - 20, by, bw + 40, 12);
			for (let k = 0; k <= bw + 40; k += 16) g.fillRect(bxx - 20 + k, by - 46, 5, 46);
			g.fillRect(bxx - 20, by - 50, bw + 40, 7);
			g.fillStyle = 'rgba(255,220,170,0.2)';
			g.fillRect(bxx - 20, by - 50, bw + 40, 2);
			for (let k = 0; k < 3; k++) beam(g, bxx - 10 + k * (bw + 20) / 2, by + 12, 10, 26, '#3a281a');
			plats.push({ x: bxx - 20 - bx, y: by - gy, w: bw + 40, h: 12, thin: true });
		}
		// crisp outline around walls
		g.strokeStyle = 'rgba(20,14,8,0.6)';
		g.lineWidth = 2;
		for (const R of floorRects) g.strokeRect(R.x, R.y, R.w, R.h);
		return {
			cv, ox: bx, oy: gy, w: W, h: bodyH + roofH, plats,
			door: doorX != null ? { x: doorX - bx, w: doorW, h: doorH } : null,
			roofTop: gy - (wallTop - roofH), wallTop: gy - wallTop
		};
	}

	/* ------------------------------------------------------------------ fortification pieces */
	function crenels(g, x, y, w, merlon, gap, h, tex) {
		for (let k = x; k < x + w - 4; k += merlon + gap) {
			const mw = Math.min(merlon, x + w - k);
			texRect(g, tex || 'stone', k, y - h, mw, h + 2);
			sideLight(g, k, y - h, mw, h, 0.3);
			g.fillStyle = 'rgba(255,240,210,0.28)';
			g.fillRect(k, y - h, mw, 3);
			g.fillStyle = 'rgba(0,0,0,0.35)';
			g.fillRect(k + mw - 3, y - h, 3, h);
		}
	}
	function arrowSlit(g, x, y, h) {
		g.fillStyle = 'rgba(0,0,0,0.35)';
		g.fillRect(x - 7, y - 4, 14, h + 8);
		g.fillStyle = '#0d0b0a';
		g.fillRect(x - 3, y, 6, h);
		g.fillRect(x - 9, y + h * 0.45, 18, 5);
	}
	function banner(g, x, y, w, h, col, emblem) {
		g.save();
		g.fillStyle = '#3a2a1a';
		g.fillRect(x - 6, y - 6, w + 12, 7);
		g.beginPath();
		g.moveTo(x, y);
		g.lineTo(x + w, y);
		g.lineTo(x + w, y + h);
		g.lineTo(x + w / 2, y + h - w * 0.4);
		g.lineTo(x, y + h);
		g.closePath();
		const bg = g.createLinearGradient(x, 0, x + w, 0);
		bg.addColorStop(0, shade(col, 1.15));
		bg.addColorStop(0.5, col);
		bg.addColorStop(1, shade(col, 0.6));
		g.fillStyle = bg;
		g.fill();
		g.strokeStyle = '#d7b450';
		g.lineWidth = 3;
		g.stroke();
		g.fillStyle = '#e3c25a';
		if (emblem !== false) {
			const cx = x + w / 2;
			const cy = y + h * 0.38;
			g.beginPath();
			g.moveTo(cx, cy - w * 0.3);
			g.quadraticCurveTo(cx + w * 0.28, cy - w * 0.05, cx, cy + w * 0.32);
			g.quadraticCurveTo(cx - w * 0.28, cy - w * 0.05, cx, cy - w * 0.3);
			g.fill();
			g.fillStyle = shade(col, 0.7);
			g.beginPath();
			g.arc(cx, cy, w * 0.08, 0, 7);
			g.fill();
		}
		// folds
		g.globalAlpha = 0.18;
		g.fillStyle = '#000';
		g.fillRect(x + w * 0.3, y, 3, h * 0.8);
		g.fillRect(x + w * 0.68, y, 3, h * 0.8);
		g.restore();
	}
	function tower(s) {
		/* Round-ish tower: cylinder shading, stone, cone or crenellated top. */
		const W = s.w || 200;
		const H = s.h || 600;
		const roofH = s.roof === 'cone' ? (s.roofH || W * 1.3) : s.roof === 'crenel' ? 46 : 0;
		const ov = s.roof === 'cone' ? 18 : 10;
		const CW = W + 120;
		const CH = H + roofH + 80;
		const cv = canvas(CW, CH);
		const g = cv.getContext('2d');
		const bx = 60;
		const gy = CH - 10;
		const r = rnd(s.seed || W + H);
		texRect(g, s.tex || 'stone', bx, gy - H, W, H, s.tint, bx * 0.3, 0);
		// string courses
		for (let y = gy - H + 90; y < gy - 60; y += 170) {
			g.fillStyle = 'rgba(30,26,22,0.45)';
			g.fillRect(bx - 6, y, W + 12, 10);
			g.fillStyle = 'rgba(255,240,210,0.22)';
			g.fillRect(bx - 6, y, W + 12, 3);
		}
		// windows and slits
		const n = Math.floor((H - 160) / 170);
		for (let i = 0; i < n; i++) {
			const y = gy - 140 - i * 170;
			if (s.windows !== false && i % 2 === 1 && W > 150) windowAt(g, bx + W / 2 - 20, y - 70, 40, 66, { arch: true, lit: r() < 0.5, frame: '#2a2420', sill: '#6a6258' });
			else arrowSlit(g, bx + W / 2, y - 60, 48);
		}
		if (s.door) door(g, bx + W / 2 - 34, gy - 116, 68, 112, { arch: true, open: s.door === 'open' });
		if (s.banner) banner(g, bx + W / 2 - 32, gy - H + 70, 64, 150, s.banner);
		// cylinder shading
		const cg = g.createLinearGradient(bx, 0, bx + W, 0);
		cg.addColorStop(0, 'rgba(255,240,210,0.22)');
		cg.addColorStop(0.25, 'rgba(255,240,210,0.08)');
		cg.addColorStop(0.55, 'rgba(0,0,0,0)');
		cg.addColorStop(1, 'rgba(10,8,18,0.55)');
		g.fillStyle = cg;
		g.fillRect(bx, gy - H, W, H);
		groundAO(g, bx, gy - H, W, H);
		const top = gy - H;
		if (s.roof === 'cone') {
			// corbelled ring then cone
			texRect(g, s.tex || 'stone', bx - ov, top - 22, W + ov * 2, 24);
			g.fillStyle = 'rgba(0,0,0,0.3)';
			g.fillRect(bx - ov, top, W + ov * 2, 6);
			for (let k = bx - ov; k < bx + W + ov; k += 22) {
				g.fillStyle = 'rgba(0,0,0,0.35)';
				g.fillRect(k, top + 2, 14, 12);
			}
			g.save();
			g.beginPath();
			g.moveTo(bx - ov - 8, top - 20);
			g.quadraticCurveTo(bx + W / 2, top - 40, bx + W + ov + 8, top - 20);
			g.lineTo(bx + W / 2, top - 20 - roofH);
			g.closePath();
			g.fillStyle = pattern(g, s.roofTex || 'roofSlate', 0, 0);
			g.fill();
			g.clip();
			const rg = g.createLinearGradient(bx - ov, 0, bx + W + ov, 0);
			rg.addColorStop(0, 'rgba(255,240,220,0.25)');
			rg.addColorStop(0.4, 'rgba(0,0,0,0)');
			rg.addColorStop(1, 'rgba(0,0,10,0.55)');
			g.fillStyle = rg;
			g.fillRect(bx - ov - 10, top - 30 - roofH, W + ov * 2 + 20, roofH + 30);
			g.restore();
			// finial + pennant
			g.fillStyle = '#c9a85a';
			g.fillRect(bx + W / 2 - 2, top - 20 - roofH - 40, 4, 44);
			if (s.pennant !== false) {
				g.fillStyle = s.pennant || '#a8261c';
				g.beginPath();
				g.moveTo(bx + W / 2 + 2, top - 20 - roofH - 40);
				g.lineTo(bx + W / 2 + 46, top - 20 - roofH - 30);
				g.lineTo(bx + W / 2 + 2, top - 20 - roofH - 20);
				g.fill();
			}
		} else if (s.roof === 'crenel') {
			texRect(g, s.tex || 'stone', bx - ov, top - 4, W + ov * 2, 26);
			g.fillStyle = 'rgba(0,0,0,0.35)';
			g.fillRect(bx - ov, top + 20, W + ov * 2, 6);
			crenels(g, bx - ov, top - 4, W + ov * 2, 30, 20, 40, s.tex);
		}
		return { cv, ox: bx, oy: gy, w: W, h: H + roofH, plats: [], door: s.door ? { x: W / 2 - 34, w: 68, h: 112 } : null, topY: H };
	}

	function wall(s) {
		/* Curtain wall: stone, crenellated, walkway on top. */
		const W = s.w;
		const H = s.h;
		const CW = W + 40;
		const CH = H + 70;
		const cv = canvas(CW, CH);
		const g = cv.getContext('2d');
		const bx = 20;
		const gy = CH - 10;
		texRect(g, s.tex || 'stoneBig', bx, gy - H, W, H, s.tint, 0, 0);
		g.fillStyle = 'rgba(0,0,0,0.12)';
		g.fillRect(bx, gy - H, W, H);
		if (s.buttress) {
			for (let x = bx + 60; x < bx + W - 60; x += s.buttress) {
				texRect(g, 'stone', x, gy - H * 0.7, 46, H * 0.7);
				sideLight(g, x, gy - H * 0.7, 46, H * 0.7, 0.5);
			}
		}
		if (s.slits) for (let x = bx + 80; x < bx + W - 40; x += s.slits) arrowSlit(g, x, gy - H + 70, 54);
		// walkway lip
		g.fillStyle = '#4a4440';
		g.fillRect(bx - 6, gy - H - 2, W + 12, 14);
		g.fillStyle = 'rgba(255,240,210,0.25)';
		g.fillRect(bx - 6, gy - H - 2, W + 12, 3);
		if (s.crenel !== false) crenels(g, bx - 6, gy - H, W + 12, 30, 22, 42, s.tex === 'cliff' ? 'stone' : 'stone');
		sideLight(g, bx, gy - H, W, H, 0.2);
		groundAO(g, bx, gy - H, W, H);
		if (s.moss) {
			const m = img(SPRITES.moss + '?' + V);
			if (ok(m)) for (let x = bx; x < bx + W; x += m.naturalWidth) g.drawImage(m, x, gy - H - 4);
		}
		return { cv, ox: bx, oy: gy, w: W, h: H, plats: [] };
	}

	function gatehouse(s) {
		/* Two towers framing a gate arch with a raised portcullis and a battlemented bridge between them. */
		const W = s.w || 760;
		const H = s.h || 640;
		const tw = s.tw || 220;
		const archW = s.archW || 220;
		const archH = s.archH || 300;
		const CW = W + 200;
		const CH = H + 340;
		const cv = canvas(CW, CH);
		const g = cv.getContext('2d');
		const bx = 100;
		const gy = CH - 10;
		// central block
		const mx = bx + tw - 20;
		const mw = W - tw * 2 + 40;
		const mh = H * 0.78;
		texRect(g, 'stoneBig', mx, gy - mh, mw, mh, null, 0, 0);
		g.fillStyle = 'rgba(0,0,0,0.1)';
		g.fillRect(mx, gy - mh, mw, mh);
		// arch passage
		const ax = bx + W / 2 - archW / 2;
		g.save();
		g.beginPath();
		g.moveTo(ax, gy);
		g.lineTo(ax, gy - archH + archW / 2);
		g.arc(ax + archW / 2, gy - archH + archW / 2, archW / 2, Math.PI, 0);
		g.lineTo(ax + archW, gy);
		g.closePath();
		const pg = g.createLinearGradient(0, gy - archH, 0, gy);
		pg.addColorStop(0, '#0c0a09');
		pg.addColorStop(1, '#2a241e');
		g.fillStyle = pg;
		g.fill();
		g.clip();
		// light at the far end of the passage
		const lg = g.createRadialGradient(ax + archW / 2, gy - 40, 10, ax + archW / 2, gy - 40, archW * 0.8);
		lg.addColorStop(0, 'rgba(255,230,180,0.5)');
		lg.addColorStop(1, 'rgba(255,230,180,0)');
		g.fillStyle = lg;
		g.fillRect(ax, gy - archH, archW, archH);
		// portcullis: raised (open road) or lowered (closed gate)
		const pf = s.closed ? 1 : 0.32;
		g.fillStyle = '#1b1816';
		for (let k = ax + 10; k < ax + archW; k += 22) g.fillRect(k, gy - archH, 6, archH * pf);
		for (let k = gy - archH + 14; k < gy - archH + archH * pf; k += 24) g.fillRect(ax, k, archW, 6);
		g.fillStyle = '#6a6258';
		if (!s.closed) for (let k = ax + 10; k < ax + archW; k += 22) g.fillRect(k, gy - archH * 0.68, 6, 18);
		g.restore();
		// voussoirs around the arch
		g.save();
		g.lineWidth = 26;
		g.strokeStyle = '#7a7268';
		g.beginPath();
		g.moveTo(ax - 13, gy);
		g.lineTo(ax - 13, gy - archH + archW / 2);
		g.arc(ax + archW / 2, gy - archH + archW / 2, archW / 2 + 13, Math.PI, 0);
		g.lineTo(ax + archW + 13, gy);
		g.stroke();
		g.lineWidth = 2;
		g.strokeStyle = 'rgba(30,26,22,0.6)';
		for (let a = Math.PI; a <= Math.PI * 2 + 0.01; a += Math.PI / 9) {
			const cx = ax + archW / 2;
			const cy = gy - archH + archW / 2;
			g.beginPath();
			g.moveTo(cx + Math.cos(a) * (archW / 2), cy + Math.sin(a) * (archW / 2));
			g.lineTo(cx + Math.cos(a) * (archW / 2 + 26), cy + Math.sin(a) * (archW / 2 + 26));
			g.stroke();
		}
		g.restore();
		// battlements over the block + machicolations
		g.fillStyle = 'rgba(0,0,0,0.35)';
		for (let k = mx; k < mx + mw; k += 26) g.fillRect(k + 4, gy - mh + 6, 16, 18);
		texRect(g, 'stone', mx - 8, gy - mh - 16, mw + 16, 22);
		crenels(g, mx - 8, gy - mh - 16, mw + 16, 30, 22, 40);
		if (s.banner) {
			banner(g, ax - 80, gy - mh + 60, 56, 150, s.banner);
			banner(g, ax + archW + 24, gy - mh + 60, 56, 150, s.banner);
		}
		sideLight(g, mx, gy - mh, mw, mh, 0.25);
		groundAO(g, mx, gy - mh, mw, mh);
		// towers
		for (const side of [0, 1]) {
			const t = tower({ w: tw, h: H, roof: s.towerRoof || 'cone', roofH: tw * 1.15, seed: side * 31 + W, banner: null, pennant: s.pennant });
			const tx = side ? bx + W - tw : bx;
			g.drawImage(t.cv, tx - t.ox, gy - t.oy);
		}
		return {
			cv, ox: bx, oy: gy, w: W, h: H,
			arch: { x: ax - bx, w: archW, h: archH },
			plats: [],
			walkTop: mh + 16
		};
	}

	/* ------------------------------------------------------------------ other buildings */
	function stall(s) {
		const W = s.w || 220;
		const CW = W + 60;
		const CH = 260;
		const cv = canvas(CW, CH);
		const g = cv.getContext('2d');
		const bx = 30;
		const gy = CH - 6;
		const cols = s.cols || ['#b8322a', '#efe4cf'];
		// back cloth
		g.fillStyle = shade(cols[0], 0.55);
		g.fillRect(bx + 10, gy - 170, W - 20, 120);
		// posts
		for (const px of [bx + 4, bx + W - 14]) beam(g, px, gy - 200, 10, 200, '#3a281a');
		// counter
		texRect(g, 'wood', bx - 6, gy - 70, W + 12, 70);
		g.fillStyle = 'rgba(0,0,0,0.25)';
		g.fillRect(bx - 6, gy - 70, W + 12, 70);
		g.fillStyle = '#5a3c24';
		g.fillRect(bx - 12, gy - 76, W + 24, 10);
		g.fillStyle = 'rgba(255,220,170,0.3)';
		g.fillRect(bx - 12, gy - 76, W + 24, 3);
		// goods
		const r = rnd(s.seed || W);
		const goods = s.goods || ['#d9542a', '#f2c53a', '#7fb03a', '#8a4a9a'];
		for (let i = 0; i < W / 18; i++) {
			const gx = bx + 6 + r() * (W - 12);
			const c = goods[Math.floor(r() * goods.length)];
			g.fillStyle = c;
			g.beginPath();
			g.arc(gx, gy - 82 - r() * 10, 7 + r() * 4, 0, 7);
			g.fill();
			g.fillStyle = 'rgba(255,255,255,0.35)';
			g.beginPath();
			g.arc(gx - 3, gy - 86 - r() * 8, 2.5, 0, 7);
			g.fill();
		}
		// baskets
		for (let i = 0; i < 2; i++) {
			const kx = bx + 20 + i * (W - 80);
			g.fillStyle = '#a8783e';
			g.beginPath();
			g.moveTo(kx, gy - 40);
			g.lineTo(kx + 46, gy - 40);
			g.lineTo(kx + 40, gy);
			g.lineTo(kx + 6, gy);
			g.fill();
			g.fillStyle = 'rgba(0,0,0,0.2)';
			for (let k = 0; k < 4; k++) g.fillRect(kx + 4, gy - 34 + k * 9, 40, 2);
		}
		// canopy
		awning(g, bx - 18, gy - 214, W + 24, 46, cols);
		g.fillStyle = shade(cols[0], 0.8);
		g.beginPath();
		g.moveTo(bx - 20, gy - 214);
		g.lineTo(bx + W / 2, gy - 244);
		g.lineTo(bx + W + 8, gy - 214);
		g.fill();
		return { cv, ox: bx, oy: gy, w: W, h: 244, plats: [{ x: -18, y: -214, w: W + 24, h: 12, thin: true }] };
	}

	function windmillBody(s) {
		const W = s.w || 240;
		const H = s.h || 520;
		const CW = W + 160;
		const CH = H + 220;
		const cv = canvas(CW, CH);
		const g = cv.getContext('2d');
		const bx = 80;
		const gy = CH - 10;
		// tapered stone tower
		g.save();
		g.beginPath();
		g.moveTo(bx, gy);
		g.lineTo(bx + W * 0.16, gy - H);
		g.lineTo(bx + W * 0.84, gy - H);
		g.lineTo(bx + W, gy);
		g.closePath();
		g.fillStyle = pattern(g, 'plaster', 0, 0);
		g.fill();
		g.clip();
		const cg = g.createLinearGradient(bx, 0, bx + W, 0);
		cg.addColorStop(0, 'rgba(255,240,210,0.2)');
		cg.addColorStop(0.5, 'rgba(0,0,0,0)');
		cg.addColorStop(1, 'rgba(20,14,10,0.5)');
		g.fillStyle = cg;
		g.fillRect(bx, gy - H, W, H);
		groundAO(g, bx, gy - H, W, H);
		g.restore();
		windowAt(g, bx + W / 2 - 18, gy - H * 0.62, 36, 48, { arch: true });
		door(g, bx + W / 2 - 30, gy - 100, 60, 96, { arch: true });
		// cap
		g.save();
		g.beginPath();
		g.moveTo(bx + W * 0.08, gy - H + 6);
		g.quadraticCurveTo(bx + W / 2, gy - H - W * 0.75, bx + W * 0.92, gy - H + 6);
		g.closePath();
		g.fillStyle = pattern(g, 'thatch', 0, 0);
		g.fill();
		g.clip();
		const rg = g.createLinearGradient(bx, 0, bx + W, 0);
		rg.addColorStop(0, 'rgba(255,240,220,0.2)');
		rg.addColorStop(1, 'rgba(0,0,0,0.45)');
		g.fillStyle = rg;
		g.fillRect(bx, gy - H - W, W, W);
		g.restore();
		return { cv, ox: bx, oy: gy, w: W, h: H + W * 0.6, hub: { x: W / 2, y: H - 40 } };
	}

	function bridge(s) {
		/* Stone arch bridge (side view). deck y = 0 at its top; spans w with n arches of depth d. */
		const W = s.w;
		const D = s.d || 260;
		const n = s.arches || Math.max(1, Math.round(W / 420));
		const CW = W + 40;
		const CH = D + 90;
		const cv = canvas(CW, CH);
		const g = cv.getContext('2d');
		const bx = 20;
		const top = 60;
		g.save();
		g.beginPath();
		g.rect(bx, top, W, D);
		const aw = W / n;
		for (let i = 0; i < n; i++) {
			const ax = bx + i * aw + aw * 0.12;
			const awi = aw * 0.76;
			const ah = D * 0.78;
			g.moveTo(ax, top + D);
			g.lineTo(ax, top + D - ah + awi / 2);
			g.arc(ax + awi / 2, top + D - ah + awi / 2, awi / 2, Math.PI, 0, false);
			g.lineTo(ax + awi, top + D);
			g.closePath();
		}
		g.fillStyle = pattern(g, 'stoneBig', 0, 0);
		g.fill('evenodd');
		g.clip('evenodd');
		const vg = g.createLinearGradient(0, top, 0, top + D);
		vg.addColorStop(0, 'rgba(255,240,210,0.15)');
		vg.addColorStop(1, 'rgba(0,0,0,0.45)');
		g.fillStyle = vg;
		g.fillRect(bx, top, W, D);
		g.restore();
		// arch rings
		g.lineWidth = 18;
		g.strokeStyle = 'rgba(120,112,100,0.95)';
		for (let i = 0; i < n; i++) {
			const ax = bx + i * aw + aw * 0.12;
			const awi = aw * 0.76;
			const ah = D * 0.78;
			g.beginPath();
			g.arc(ax + awi / 2, top + D - ah + awi / 2, awi / 2 + 9, Math.PI, 0, false);
			g.stroke();
		}
		// deck + parapet
		texRect(g, 'stone', bx - 10, top - 50, W + 20, 56);
		g.fillStyle = 'rgba(255,240,210,0.25)';
		g.fillRect(bx - 10, top - 50, W + 20, 4);
		g.fillStyle = 'rgba(0,0,0,0.35)';
		g.fillRect(bx - 10, top + 2, W + 20, 6);
		if (s.moss) {
			const m = img(SPRITES.moss + '?' + V);
			if (ok(m)) for (let x = bx; x < bx + W; x += m.naturalWidth) g.drawImage(m, x, top - 4);
		}
		return { cv, ox: bx, oy: top, w: W, h: D };
	}

	/* A whole castle keep: big hall block, corner towers, tall windows, buttresses, central spire tower. */
	function keep(s) {
		const W = s.w || 2600;
		const H = s.h || 900;
		const CW = W + 600;
		const CH = H + 900;
		const cv = canvas(CW, CH);
		const g = cv.getContext('2d');
		const bx = 300;
		const gy = CH - 10;
		const r = rnd(s.seed || 99);
		const parts = s.parts || [
			{ x: 0.0, w: 0.16, h: 1.25, roof: 'cone' },
			{ x: 0.14, w: 0.3, h: 0.85, roof: 'hall' },
			{ x: 0.42, w: 0.18, h: 1.55, roof: 'cone', big: true },
			{ x: 0.58, w: 0.28, h: 0.92, roof: 'hall' },
			{ x: 0.84, w: 0.16, h: 1.2, roof: 'cone' }
		];
		// draw halls first, towers over them
		const order = parts.slice().sort((a, b) => (a.roof === 'hall' ? 0 : 1) - (b.roof === 'hall' ? 0 : 1));
		for (const p of order) {
			const px = bx + p.x * W;
			const pw = p.w * W;
			const ph = p.h * H;
			if (p.roof === 'hall') {
				texRect(g, 'stoneBig', px, gy - ph, pw, ph, 'rgba(40,30,20,0.05)', 0, 0);
				// buttresses
				for (let k = px + 40; k < px + pw - 40; k += 180) {
					texRect(g, 'stone', k, gy - ph * 0.82, 40, ph * 0.82);
					sideLight(g, k, gy - ph * 0.82, 40, ph * 0.82, 0.55);
					g.fillStyle = '#5a544c';
					g.beginPath();
					g.moveTo(k - 4, gy - ph * 0.82);
					g.lineTo(k + 20, gy - ph * 0.82 - 40);
					g.lineTo(k + 44, gy - ph * 0.82);
					g.fill();
				}
				// tall gothic windows between buttresses (two rows)
				for (let k = px + 130; k < px + pw - 80; k += 180) {
					windowAt(g, k - 28, gy - ph * 0.72, 56, ph * 0.3, { arch: true, lit: r() < 0.6, frame: '#2a2420', sill: '#6a6258' });
					windowAt(g, k - 22, gy - ph * 0.3, 44, 90, { arch: true, lit: r() < 0.4, frame: '#2a2420', sill: '#6a6258' });
				}
				// roof
				roofPlane(g, px - 26, px + pw + 26, gy - ph + 8, gy - ph - ph * 0.42, ph * 0.2, 'slate', p.x * 1000);
				// crenellated parapet in front of the roof
				texRect(g, 'stone', px - 10, gy - ph - 8, pw + 20, 26);
				crenels(g, px - 10, gy - ph - 8, pw + 20, 30, 22, 36);
				sideLight(g, px, gy - ph, pw, ph, 0.25);
				groundAO(g, px, gy - ph, pw, ph);
				if (p.banners) for (let k = 0; k < p.banners; k++) banner(g, px + pw * (k + 0.5) / p.banners - 30, gy - ph + 40, 60, 170, s.banner || '#9a2222');
			} else {
				const t = tower({ w: pw, h: ph, roof: p.roof, roofH: pw * (p.big ? 1.45 : 1.25), seed: Math.round(p.x * 1000), banner: p.big ? (s.banner || '#9a2222') : null, pennant: s.pennant, windows: true });
				g.drawImage(t.cv, px - t.ox, gy - t.oy);
			}
		}
		// grand door in the big tower
		const big = parts.find(p => p.big);
		if (big && s.door !== false) {
			const dx = bx + (big.x + big.w / 2) * W;
			door(g, dx - 70, gy - 200, 140, 196, { arch: true, color: '#4a2a18' });
			lantern(g, dx - 96, gy - 150);
			lantern(g, dx + 96, gy - 150);
		}
		return { cv, ox: bx, oy: gy, w: W, h: H * 1.6, door: big ? { x: (big.x + big.w / 2) * W - 70, w: 140, h: 196 } : null };
	}

	/* ------------------------------------------------------------------ cache with lazy paint + eviction */
	const CACHE = new Map();
	let paintBudget = 0;
	function get(key, make) {
		let e = CACHE.get(key);
		if (e) {
			e.t = performance.now();
			return e.r;
		}
		if (!texReady()) return null;
		if (paintBudget <= 0) return null;   // spread heavy painting over frames
		paintBudget--;
		const r = make();
		CACHE.set(key, { r, t: performance.now() });
		return r;
	}
	function frame() {
		paintBudget = 3;
		if (CACHE.size > 90) {
			const now = performance.now();
			const old = [...CACHE.entries()].sort((a, b) => a[1].t - b[1].t);
			for (let i = 0; i < old.length - 70; i++) if (now - old[i][1].t > 4000) CACHE.delete(old[i][0]);
		}
	}
	function warm(n) { paintBudget = n; }

	/* A hazed, cooler copy of a painted building for background rows. */
	function hazed(r, color, amount) {
		const c = canvas(r.cv.width, r.cv.height);
		const g = c.getContext('2d');
		g.drawImage(r.cv, 0, 0);
		g.globalCompositeOperation = 'source-atop';
		g.fillStyle = hexA(color, amount);
		g.fillRect(0, 0, c.width, c.height);
		return Object.assign({}, r, { cv: c });
	}

	global.EmberfallArt = {
		loadAll, texReady, img, ok, sprite, road, floraImg, floraInfo, pattern, canvas, rnd, hexA, shade,
		house, tower, wall, gatehouse, stall, windmillBody, bridge, keep, hazed, banner, lantern, windowAt, door,
		texRect, sideLight, groundAO, beam, diagBeam, crenels, roofPlane, awning, flowerBox, chimney, hangingSign,
		get, frame, warm, CACHE
	};
})(typeof window !== 'undefined' ? window : globalThis);
