/* Renders every mini-boss sprite sheet to images/minibosses/<boss>-<tier>.png
   Usage (from the Games folder, with Playwright installed):
     node tools/miniboss-art/build.js            → every boss, every tier
     node tools/miniboss-art/build.js knight     → one boss
   Each sheet: 8 columns × 8 rows of 216×216 frames (drawn at 288 and scaled down).
   Afterwards run  python3 tools/miniboss-art/shrink.py  to palette-compress them (about 400 KB each).
   Rows: 0 idle · 1 move · 2 attack A · 3 attack B · 4 cast · 5 special · 6 hurt · 7 death */
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, 'images', 'minibosses');
const FILES = ['art-core.js', 'knight.js', 'warden.js', 'raptor.js', 'treant.js'];
const TIERS = ['base', 'alpha', 'elder', 'tyrant'];

(async () => {
	const only = process.argv[2] ? process.argv[2].split(',') : null;
	const tierOnly = process.argv[3] ? process.argv[3].split(',') : null;
	fs.mkdirSync(OUT, { recursive: true });
	const b = await chromium.launch();
	const p = await b.newPage();
	const errs = []; p.on('pageerror', e => errs.push(e.message));
	await p.setContent('<html><body style="margin:0;background:#000"></body></html>');
	for(const f of FILES){ const fp = path.join(__dirname, f); if(fs.existsSync(fp)) await p.addScriptTag({ content: fs.readFileSync(fp, 'utf8') }); }
	const bosses = await p.evaluate(() => Object.keys(MBArt.bosses));
	for(const boss of bosses){
		if(only && !only.includes(boss)) continue;
		for(const tier of TIERS){
			if(tierOnly && !tierOnly.includes(tier)) continue;
			const data = await p.evaluate(([boss, tier]) => {
				const A = MBArt, B = A.bosses[boss], F = A.FRAME;
				const cv = document.createElement('canvas'); cv.width = F * A.COLS; cv.height = F * A.ROWS;
				const c = cv.getContext('2d');
				const rows = ['idle', 'move', 'attackA', 'attackB', 'cast', 'special', 'hurt', 'death'];
				const loop = { idle: 1, move: 1 };
				rows.forEach((r, ri) => {
					for(let i = 0; i < A.COLS; i++){
						const t = loop[r] ? i / A.COLS : i / (A.COLS - 1);
						const P = B.ANIMS[r](t);
						c.save();
						c.beginPath(); c.rect(i * F, ri * F, F, F); c.clip();
						c.translate(i * F + F / 2 + (B.offsetX || 0), ri * F + (B.flier ? F / 2 : B.footY));
						if(B.scale) c.scale(B.scale, B.scale);
						B.draw(c, P, tier, t, r);
						c.restore();
					}
				});
				// shrink to the size the game draws them at (216-px frames): smaller files, no visible loss
				const OUTF = 216, out = document.createElement('canvas'); out.width = OUTF * A.COLS; out.height = OUTF * A.ROWS;
				const o = out.getContext('2d'); o.imageSmoothingEnabled = true; o.imageSmoothingQuality = 'high';
				o.drawImage(cv, 0, 0, out.width, out.height);
				return out.toDataURL('image/png');
			}, [boss, tier]);
			const file = path.join(OUT, boss + '-' + tier + '.png');
			fs.writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));
			console.log('wrote', path.relative(ROOT, file), (fs.statSync(file).size / 1024 | 0) + ' KB');
		}
	}
	if(errs.length) console.log('page errors:', errs);
	await b.close();
})();
