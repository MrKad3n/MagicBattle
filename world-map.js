/* Main-menu world map — jagged Voronoi territories (Story Mode 2 interaction style) */

const WorldMapVoronoi = (function () {
	let canvas = null;
	let ctx = null;
	let sites = [];
	let regions = null;
	let mapRect = { dx: 0, dy: 0, dw: 0, dh: 0 };
	let hoverId = null;
	let lockedFn = () => false;
	let crossedFn = () => false;

	function _hash(ix, iy) {
		const s = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453;
		return s - Math.floor(s);
	}

	function _vnoise(x, y) {
		const ix = Math.floor(x),
			iy = Math.floor(y),
			fx = x - ix,
			fy = y - iy;
		const a = _hash(ix, iy),
			b = _hash(ix + 1, iy),
			c = _hash(ix, iy + 1),
			d = _hash(ix + 1, iy + 1);
		const ux = fx * fx * (3 - 2 * fx),
			uy = fy * fy * (3 - 2 * fy);
		return a * (1 - ux) * (1 - uy) + b * ux * (1 - uy) + c * (1 - ux) * uy + d * ux * uy;
	}

	function mapPoint(mapX, mapY) {
		return {
			x: mapRect.dx + (mapX / 100) * mapRect.dw,
			y: mapRect.dy + (mapY / 100) * mapRect.dh,
		};
	}

	function updateMapRect() {
		if (!canvas) return;
		const w = canvas.width;
		const h = canvas.height;
		mapRect = { dx: 0, dy: 0, dw: w, dh: h };
	}

	function buildRegions() {
		const rect = mapRect;
		const cs = Math.max(7, Math.round(rect.dw / 150));
		const cols = Math.ceil(rect.dw / cs);
		const rows = Math.ceil(rect.dh / cs);
		const built = [];
		for (const s of sites) {
			if (typeof s.mapX !== 'number' || typeof s.mapY !== 'number') continue;
			built.push({
				id: s.id,
				x: rect.dx + (s.mapX / 100) * rect.dw,
				y: rect.dy + (s.mapY / 100) * rect.dh,
			});
		}
		const grid = new Int16Array(cols * rows);
		const A = cs * 4.5;
		const F = 0.02;
		for (let r = 0; r < rows; r++) {
			for (let c = 0; c < cols; c++) {
				const px = rect.dx + c * cs + cs / 2;
				const py = rect.dy + r * cs + cs / 2;
				const jx = px + (_vnoise(px * F, py * F) - 0.5) * A * 2;
				const jy = py + (_vnoise(px * F + 50, py * F + 50) - 0.5) * A * 2;
				let best = 0,
					bestD = Infinity;
				for (let i = 0; i < built.length; i++) {
					const dx = jx - built[i].x,
						dy = jy - built[i].y;
					const d = dx * dx + dy * dy;
					if (d < bestD) {
						bestD = d;
						best = i;
					}
				}
				grid[r * cols + c] = best;
			}
		}
		const borders = [];
		for (let r = 0; r < rows; r++) {
			for (let c = 0; c < cols; c++) {
				const a = grid[r * cols + c];
				const x0 = rect.dx + c * cs,
					y0 = rect.dy + r * cs;
				if (c + 1 < cols && grid[r * cols + c + 1] !== a) {
					borders.push({ x1: x0 + cs, y1: y0, x2: x0 + cs, y2: y0 + cs, a, b: grid[r * cols + c + 1] });
				}
				if (r + 1 < rows && grid[(r + 1) * cols + c] !== a) {
					borders.push({ x1: x0, y1: y0 + cs, x2: x0 + cs, y2: y0 + cs, a, b: grid[(r + 1) * cols + c] });
				}
			}
		}
		regions = { rect, cs, cols, rows, grid, sites: built, borders };
	}

	function ensureRegions() {
		if (!regions) buildRegions();
	}

	function siteIndexOf(id) {
		if (!regions) return -1;
		for (let i = 0; i < regions.sites.length; i++) if (regions.sites[i].id === id) return i;
		return -1;
	}

	function fillRegion(idx, color) {
		const R = regions;
		if (!R || idx < 0) return;
		ctx.fillStyle = color;
		for (let r = 0; r < R.rows; r++) {
			for (let c = 0; c < R.cols; c++) {
				if (R.grid[r * R.cols + c] === idx) {
					ctx.fillRect(R.rect.dx + c * R.cs, R.rect.dy + r * R.cs, R.cs + 0.6, R.cs + 0.6);
				}
			}
		}
	}

	function draw() {
		if (!ctx || !canvas) return;
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ensureRegions();
		const R = regions;
		const hoverIdx = siteIndexOf(hoverId);
		const t = Date.now() * 0.001;
		const pulse = 0.5 + Math.sin(t * 2.4) * 0.5;

		ctx.save();
		ctx.beginPath();
		ctx.rect(mapRect.dx, mapRect.dy, mapRect.dw, mapRect.dh);
		ctx.clip();

		if (hoverIdx >= 0) {
			const locked = lockedFn(hoverId);
			fillRegion(hoverIdx, locked ? 'rgba(180,80,80,0.22)' : `rgba(245,210,110,${0.22 + pulse * 0.06})`);
		}

		ctx.lineWidth = 1;
		ctx.strokeStyle = 'rgba(30,20,10,0.28)';
		ctx.beginPath();
		for (const s of R.borders) {
			ctx.moveTo(s.x1, s.y1);
			ctx.lineTo(s.x2, s.y2);
		}
		ctx.stroke();

		if (hoverIdx >= 0) {
			ctx.lineWidth = 2.2;
			ctx.strokeStyle = lockedFn(hoverId) ? 'rgba(255,120,120,0.9)' : 'rgba(255,225,120,0.95)';
			ctx.beginPath();
			for (const s of R.borders) {
				if (s.a === hoverIdx || s.b === hoverIdx) {
					ctx.moveTo(s.x1, s.y1);
					ctx.lineTo(s.x2, s.y2);
				}
			}
			ctx.stroke();
		}
		ctx.restore();

		for (const s of sites) {
			if (typeof s.mapX !== 'number') continue;
			const pt = mapPoint(s.mapX, s.mapY);
			const isHover = hoverId === s.id;
			const locked = lockedFn(s.id);
			const crossed = crossedFn(s.id);
			const r = isHover ? 6 : 4;
			ctx.save();
			ctx.beginPath();
			ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
			ctx.fillStyle = crossed ? 'rgba(120,120,120,0.7)' : locked ? 'rgba(200,180,180,0.85)' : isHover ? '#fff4d8' : 'rgba(245,236,210,0.88)';
			ctx.strokeStyle = '#2a1a0c';
			ctx.lineWidth = 1.4;
			ctx.fill();
			ctx.stroke();
			if (isHover || crossed) {
				const label = (s.icon ? s.icon + ' ' : '') + (s.name || s.id);
				ctx.font = 'bold 13px Georgia, serif';
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.lineWidth = 3.5;
				ctx.strokeStyle = 'rgba(252,246,230,0.95)';
				ctx.fillStyle = crossed ? '#555' : '#2a1808';
				ctx.strokeText(label, pt.x, pt.y - 14);
				ctx.fillText(label, pt.x, pt.y - 14);
				if (crossed) {
					const tw = ctx.measureText(label).width;
					ctx.strokeStyle = '#2a1808';
					ctx.lineWidth = 2;
					ctx.beginPath();
					ctx.moveTo(pt.x - tw / 2 - 2, pt.y - 14);
					ctx.lineTo(pt.x + tw / 2 + 2, pt.y - 14);
					ctx.stroke();
				}
			}
			ctx.restore();
		}
	}

	function hitTest(mx, my) {
		const R = regions;
		if (!R) return null;
		const rect = R.rect;
		if (mx < rect.dx || mx > rect.dx + rect.dw || my < rect.dy || my > rect.dy + rect.dh) return null;
		const c = Math.min(R.cols - 1, Math.max(0, Math.floor((mx - rect.dx) / R.cs)));
		const r = Math.min(R.rows - 1, Math.max(0, Math.floor((my - rect.dy) / R.cs)));
		const idx = R.grid[r * R.cols + c];
		const site = R.sites[idx];
		return site ? site.id : null;
	}

	function resize() {
		if (!canvas) return;
		const wrap = canvas.parentElement;
		if (!wrap) return;
		const rect = wrap.getBoundingClientRect();
		canvas.width = Math.floor(rect.width);
		canvas.height = Math.floor(rect.height);
		regions = null;
		updateMapRect();
		buildRegions();
		draw();
	}

	function init(cvs, siteList, options) {
		canvas = cvs;
		ctx = canvas.getContext('2d');
		sites = siteList || [];
		lockedFn = (options && options.isLocked) || (() => false);
		crossedFn = (options && options.isCrossed) || (() => false);
		hoverId = null;
		regions = null;

		canvas.addEventListener('mousemove', (e) => {
			const rect = canvas.getBoundingClientRect();
			const mx = ((e.clientX - rect.left) / rect.width) * canvas.width;
			const my = ((e.clientY - rect.top) / rect.height) * canvas.height;
			const hit = hitTest(mx, my);
			if (hit !== hoverId) {
				hoverId = hit;
				draw();
			}
			canvas.style.cursor = hit ? 'pointer' : 'default';
		});

		canvas.addEventListener('mouseleave', () => {
			hoverId = null;
			draw();
			canvas.style.cursor = 'default';
		});

		canvas.addEventListener('click', (e) => {
			const rect = canvas.getBoundingClientRect();
			const mx = ((e.clientX - rect.left) / rect.width) * canvas.width;
			const my = ((e.clientY - rect.top) / rect.height) * canvas.height;
			const hit = hitTest(mx, my);
			if (hit && options && typeof options.onSelect === 'function') options.onSelect(hit);
		});

		resize();
	}

	function setSites(siteList) {
		sites = siteList || [];
		regions = null;
		draw();
	}

	return { init, resize, draw, setSites, setHover(id) { hoverId = id; draw(); } };
})();
