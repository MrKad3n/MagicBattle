/* =============================================================
   LoadingScreen — a simple full-screen loader shown from the first moment a page starts parsing, so there is never a
   blank screen while a mode loads. It hides itself once the page has finished loading and has drawn a couple of frames.
   It also covers the gap while leaving a page for another (menu → dungeon, dungeon → menu, etc.).
   ============================================================= */
(function(){
	if(window.LoadingScreen) return;
	var q; try { q = new URLSearchParams(location.search); } catch(e){ q = { get: function(){ return null; } }; }
	var page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();

	var TYPE_NAMES = { fire: 'The Infernal Depths', ice: 'The Glacial Reach', earth: 'The Sylvaris Wildes', jungle: 'The Sylvaris Wildes' };
	var TIPS = [
		'Reinforcement scales your melee damage up to +200%.',
		'Strength boosts melee damage and makes you a little faster.',
		'Exceeding Max Output costs Total Mana — plan your spells.',
		'Dash through danger: Shift is your friend.',
		'Parry with Q to turn enemy attacks around.',
		'Survival mode: bosses appear every 5 waves.',
		'Gems and variants can change how your gear behaves.'
	];
	function describe(url){
		var u; try { u = new URL(url, location.href); } catch(e){ return 'Loading'; }
		var p = (u.pathname.split('/').pop() || 'index.html').toLowerCase(), s = u.searchParams;
		if(p === 'dungeon.html'){
			var m = s.get('mode');
			if(s.get('coop') === '1' || m === 'coop') return 'Connecting to your party';
			if(m === 'survival') return 'Entering Survival';
			if(m === 'sandbox') return 'Loading the Sandbox';
			if(m === 'city') return 'Entering the city';
			if(m === 'pvp' || s.get('match')) return 'Joining the match';
			if(m === 'raid' || m === 'challenger') return 'Entering the raid';
			return 'Entering ' + (TYPE_NAMES[s.get('type') || 'fire'] || 'the dungeon');
		}
		if(p === 'inventory.html') return 'Opening your inventory';
		if(p === 'dungeons.html') return 'Loading dungeons';
		if(p === 'raids.html') return 'Loading raids';
		return 'Loading';
	}

	function themeOf(url){
		var u; try { u = new URL(url, location.href); } catch(e){ return 'menu'; }
		var p = (u.pathname.split('/').pop() || 'index.html').toLowerCase(), q2 = u.searchParams, m = q2.get('mode');
		if(p === 'dungeon.html'){
			if(m === 'survival') return 'arena';
			if(m === 'sandbox') return 'yard';
			if(m === 'city') return 'city';
			if(m === 'colosseum' || m === 'pvp' || q2.get('match')) return 'colosseum';
			if(m === 'raid' || m === 'challenger' || m === 'zenith') return 'arena';
			var t = q2.get('type') || 'fire';
			return t === 'ice' ? 'ice' : (t === 'earth' || t === 'jungle') ? 'jungle' : 'fire';
		}
		if(p === 'raids.html') return 'arena';
		if(p === 'dungeons.html') return 'fire';
		if(p === 'inventory.html') return 'forge';
		return 'menu';
	}

	/* ---------- painted scenes (generated, no image files) ---------- */
	var PAL = {
		fire:  { sky:['#1a0605','#4a1208','#c4400f'], far:'#2a0b07', mid:'#1c0705', near:'#0d0302', glow:'#ff7a1a', fx:'ember' },
		ice:   { sky:['#050b1f','#0e2750','#4d8fc4'], far:'#1d3b63', mid:'#142a4a', near:'#0a1830', glow:'#8fe6ff', fx:'snow' },
		jungle:{ sky:['#041208','#0b3a1c','#3f8f3a'], far:'#0d3a1d', mid:'#0a2a15', near:'#041108', glow:'#b6ff7a', fx:'firefly' },
		arena: { sky:['#07041a','#241250','#6b3fc4'], far:'#1b0f3f', mid:'#120a2c', near:'#07041a', glow:'#b79cff', fx:'star' },
		yard:  { sky:['#0b1220','#1c2f52','#4a7fb5'], far:'#1b2a44', mid:'#141f35', near:'#0a1020', glow:'#7fe9ff', fx:'mote' },
		city:  { sky:['#120a24','#4a2250','#e0804a'], far:'#2a1230', mid:'#1a0b22', near:'#0c0512', glow:'#ffd27a', fx:'ember' },
		colosseum:{ sky:['#1a0a06','#5a2a12','#d98a3a'], far:'#3a1a0c', mid:'#2a1208', near:'#120804', glow:'#ffc16a', fx:'dust' },
		forge: { sky:['#0b0818','#1d1245','#4b2d9a'], far:'#150e33', mid:'#0e0824', near:'#070414', glow:'#b79cff', fx:'mote' },
		menu:  { sky:['#0a0718','#1c1238','#4a2d8a'], far:'#150e30', mid:'#0e0a22', near:'#070514', glow:'#b79cff', fx:'star' }
	};
	function rngS(seed){ var a = seed >>> 0; return function(){ a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; }; }
	function ridge(g, W, H, base, amp, seed, col, rough){
		var r = rngS(seed), pts = [], n = 56, ph = [r() * 6, r() * 6, r() * 6];
		for(var i = 0; i <= n; i++){
			var x = i / n, y = Math.sin(x * 5 + ph[0]) * 0.5 + Math.sin(x * 11 + ph[1]) * 0.3 + Math.sin(x * 23 + ph[2]) * 0.2 * (rough || 1);
			pts.push([x * W, H * base - y * amp * H]);
		}
		g.fillStyle = col; g.beginPath(); g.moveTo(0, H);
		for(var k = 0; k < pts.length; k++) g.lineTo(pts[k][0], pts[k][1]);
		g.lineTo(W, H); g.closePath(); g.fill();
		return pts;
	}
	function paintScene(cv, theme){
		var P = PAL[theme] || PAL.menu, dpr = Math.min(window.devicePixelRatio || 1, 1.5);
		var W = cv.width = Math.max(320, Math.round(innerWidth * dpr)), H = cv.height = Math.max(240, Math.round(innerHeight * dpr));
		var g = cv.getContext('2d');
		var sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, P.sky[0]); sky.addColorStop(0.55, P.sky[1]); sky.addColorStop(1, P.sky[2]);
		g.fillStyle = sky; g.fillRect(0, 0, W, H);
		var r = rngS(theme.length * 977 + 13), i;
		// stars / aurora / sun
		if(theme !== 'jungle' && theme !== 'colosseum'){ g.fillStyle = 'rgba(255,255,255,0.7)'; for(i = 0; i < 90; i++){ g.globalAlpha = 0.2 + r() * 0.6; g.fillRect(r() * W, r() * H * 0.5, 1.4 * dpr, 1.4 * dpr); } g.globalAlpha = 1; }
		if(theme === 'ice'){ for(i = 0; i < 3; i++){ var ag = g.createLinearGradient(0, H * 0.1, 0, H * 0.55); ag.addColorStop(0, 'rgba(120,255,200,0)'); ag.addColorStop(0.5, 'rgba(120,255,210,' + (0.22 - i * 0.05) + ')'); ag.addColorStop(1, 'rgba(120,200,255,0)');
			g.fillStyle = ag; g.beginPath(); g.moveTo(0, H * 0.3); for(var x = 0; x <= W; x += W / 24) g.lineTo(x, H * (0.22 + i * 0.07) + Math.sin(x / W * 7 + i * 2) * H * 0.07); g.lineTo(W, H * 0.6); g.lineTo(0, H * 0.6); g.fill(); } }
		var sun = { fire: [0.72, 0.5, 0.22], city: [0.3, 0.55, 0.2], colosseum: [0.7, 0.45, 0.2], jungle: [0.35, 0.4, 0.16], arena: [0.5, 0.3, 0.14], ice: [0.8, 0.3, 0.07], yard: [0.25, 0.3, 0.09], forge: [0.5, 0.35, 0.18], menu: [0.5, 0.35, 0.16] }[theme] || [0.5, 0.4, 0.15];
		var sg = g.createRadialGradient(W * sun[0], H * sun[1], 0, W * sun[0], H * sun[1], H * sun[2] * 2.6);
		sg.addColorStop(0, P.glow); sg.addColorStop(0.18, P.glow + 'aa'); sg.addColorStop(1, 'rgba(0,0,0,0)');
		g.globalAlpha = 0.85; g.fillStyle = sg; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
		// mountain / structure layers
		ridge(g, W, H, 0.62, 0.22, 11, P.far, 1);
		if(theme === 'fire'){          // a volcano with a glowing crater and lava runs
			var vx = W * 0.72, vy = H * 0.44;
			g.fillStyle = P.mid; g.beginPath(); g.moveTo(vx - W * 0.3, H); g.lineTo(vx - W * 0.05, vy); g.lineTo(vx + W * 0.05, vy); g.lineTo(vx + W * 0.3, H); g.fill();
			var lg = g.createLinearGradient(0, vy, 0, H); lg.addColorStop(0, '#ffd27a'); lg.addColorStop(0.3, '#ff6a1a'); lg.addColorStop(1, 'rgba(255,60,0,0)');
			g.strokeStyle = lg; g.lineWidth = 5 * dpr; g.lineCap = 'round';
			for(i = 0; i < 4; i++){ g.beginPath(); g.moveTo(vx + (i - 1.5) * W * 0.012, vy + 2); var xx = vx + (i - 1.5) * W * 0.012; for(var y = vy; y < H; y += H * 0.05){ xx += (r() - 0.45) * W * 0.02 * (i % 2 ? 1 : -1); g.lineTo(xx, y); } g.stroke(); }
			var cg = g.createRadialGradient(vx, vy, 0, vx, vy, W * 0.12); cg.addColorStop(0, 'rgba(255,220,140,0.9)'); cg.addColorStop(1, 'rgba(255,90,10,0)'); g.fillStyle = cg; g.fillRect(vx - W * 0.15, vy - W * 0.15, W * 0.3, W * 0.3);
		}
		if(theme === 'city' || theme === 'colosseum'){          // a skyline / arches with lit windows
			var bx = 0; g.fillStyle = P.mid;
			while(bx < W){ var bw = (0.03 + r() * 0.05) * W, bh = (0.12 + r() * (theme === 'city' ? 0.28 : 0.1)) * H; g.fillRect(bx, H * 0.72 - bh, bw, bh + H * 0.3);
				if(theme === 'city'){ g.fillStyle = '#ffd27acc'; for(var wy = H * 0.72 - bh + 8; wy < H * 0.72; wy += 14 * dpr) for(var wx = bx + 6; wx < bx + bw - 6; wx += 12 * dpr) if(r() > 0.7) g.fillRect(wx, wy, 3 * dpr, 4 * dpr); g.fillStyle = P.mid; }
				bx += bw + 2; }
		}
		if(theme === 'arena' || theme === 'forge'){          // floating sanctum pillars
			g.fillStyle = P.mid; for(i = 0; i < 7; i++){ var px = W * (0.1 + i * 0.13), ph = H * (0.16 + r() * 0.16); g.fillRect(px, H * 0.74 - ph, W * 0.018, ph + H); g.fillRect(px - W * 0.006, H * 0.74 - ph - 6, W * 0.03, 8 * dpr); }
		}
		ridge(g, W, H, 0.76, 0.12, 29, P.mid, 1.2);
		if(theme === 'jungle'){ g.fillStyle = P.near; for(i = 0; i < 26; i++){ var tx = r() * W, th = H * (0.18 + r() * 0.3); g.fillRect(tx, H * 0.9 - th, 5 * dpr, th); g.beginPath(); g.ellipse(tx + 2, H * 0.9 - th, (30 + r() * 40) * dpr, (18 + r() * 22) * dpr, 0, 0, 6.3); g.fill(); } }
		var near = ridge(g, W, H, 0.9, 0.07, 53, P.near, 1.6);
		if(theme === 'fire'){ var fg = g.createLinearGradient(0, H * 0.86, 0, H); fg.addColorStop(0, 'rgba(255,90,10,0)'); fg.addColorStop(1, 'rgba(255,120,20,0.55)'); g.fillStyle = fg; g.fillRect(0, H * 0.86, W, H * 0.14); }
		// vignette
		var vg = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.95); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.65)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
	}
	/* drifting particles over the scene while it is up */
	var fxCv = null, fxRaf = 0, fxList = [], fxKind = 'star', fxCol = '#fff';
	function fxStart(theme){
		var P = PAL[theme] || PAL.menu; fxKind = P.fx; fxCol = P.glow;
		fxList = []; for(var i = 0; i < 70; i++) fxList.push({ x: Math.random(), y: Math.random(), v: 0.2 + Math.random(), s: 0.6 + Math.random() * 1.8, p: Math.random() * 6.3 });
		cancelAnimationFrame(fxRaf);
		(function loop(t){
			if(!fxCv || hidden) return;
			var g = fxCv.getContext('2d'), W = fxCv.width, H = fxCv.height; g.clearRect(0, 0, W, H);
			var tt = (t || 0) / 1000;
			for(var i = 0; i < fxList.length; i++){
				var f = fxList[i], k = fxKind;
				if(k === 'ember'){ f.y -= f.v * 0.0016; f.x += Math.sin(tt * 1.3 + f.p) * 0.0004; if(f.y < -0.02){ f.y = 1.02; f.x = Math.random(); } }
				else if(k === 'snow' || k === 'dust'){ f.y += f.v * 0.0014; f.x += Math.sin(tt + f.p) * 0.0005 + (k === 'dust' ? 0.0007 : 0); if(f.y > 1.02){ f.y = -0.02; f.x = Math.random(); } if(f.x > 1.02) f.x = -0.02; }
				else if(k === 'firefly'){ f.x += Math.sin(tt * 0.7 + f.p) * 0.0005; f.y += Math.cos(tt * 0.9 + f.p) * 0.0004; }
				else { f.y -= f.v * 0.0004; if(f.y < -0.02) f.y = 1.02; }
				var a = k === 'star' ? 0.3 + 0.5 * Math.abs(Math.sin(tt * f.v + f.p)) : k === 'firefly' ? 0.2 + 0.8 * Math.abs(Math.sin(tt * 1.4 + f.p)) : 0.75;
				g.globalAlpha = a; g.fillStyle = fxCol;
				g.beginPath(); g.arc(f.x * W, f.y * H, f.s * (W / 1280) * (k === 'snow' ? 1.3 : 1), 0, 6.3); g.fill();
			}
			g.globalAlpha = 1; fxRaf = requestAnimationFrame(loop);
		})(0);
	}
	function applyTheme(url){
		var th = themeOf(url);
		if(!el) return;
		var bg = el.querySelector('.ls-bg'), fx = el.querySelector('.ls-fx');
		if(bg){ try { paintScene(bg, th); } catch(e){} }
		if(fx){ fx.width = Math.max(320, innerWidth); fx.height = Math.max(240, innerHeight); fxCv = fx; fxStart(th); }
		el.setAttribute('data-theme', th); el.style.setProperty('--ls-glow', (PAL[th] || PAL.menu).glow);
	}

	var css = '#loadScr{position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;' +
		'background:#0b0718;color:#e9e2ff;font-family:Arial,sans-serif;opacity:1;overflow:hidden;will-change:opacity,transform}' +
		'#loadScr.in{animation:lsFadeIn .3s ease both}' +
		'#loadScr.out{opacity:0;transform:scale(1.07);pointer-events:none;transition:opacity .9s cubic-bezier(.4,0,.2,1),transform 1.1s cubic-bezier(.3,0,.2,1)}' +
		'#loadScr canvas{position:absolute;inset:0;width:100%;height:100%}' +
		'#loadScr .ls-ui{position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;gap:16px;transition:opacity .35s ease,transform .5s ease}' +
		'#loadScr.out .ls-ui,#loadScr.fading .ls-ui{opacity:0;transform:translateY(-10px)}' +
		'#loadScr .ls-title{font-size:34px;font-weight:bold;letter-spacing:4px;text-shadow:0 2px 14px #000,0 0 28px var(--ls-glow,#7a5cff)}' +
		'#loadScr .ls-msg{font-size:16px;color:#e4dcff;text-shadow:0 2px 8px #000}' +
		'#loadScr .ls-ring{width:48px;height:48px;border-radius:50%;border:4px solid rgba(255,255,255,.18);border-top-color:var(--ls-glow,#b79cff);animation:lsSpin .9s linear infinite}' +
		'#loadScr .ls-bar{width:min(380px,70vw);height:6px;border-radius:4px;background:rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.15);overflow:hidden}' +
		'#loadScr .ls-fill{height:100%;width:8%;background:linear-gradient(90deg,var(--ls-glow,#7a5cff),#fff3c8);border-radius:4px;transition:width .3s ease}' +
		'#loadScr .ls-tip{position:absolute;z-index:2;bottom:30px;font-size:13px;color:#d6cdf6;max-width:80vw;text-align:center;text-shadow:0 1px 6px #000;transition:opacity .35s ease}' +
		'#loadScr.out .ls-tip,#loadScr.fading .ls-tip{opacity:0}' +
		'html.ls-reveal body{animation:lsBodyIn 1s cubic-bezier(.4,0,.2,1) both}' +
		'@keyframes lsBodyIn{from{opacity:0}to{opacity:1}}' +
		'@keyframes lsFadeIn{from{opacity:0}to{opacity:1}}' +
		'@keyframes lsSpin{to{transform:rotate(360deg)}}';
	var el = null, started = Date.now(), prog = 8, timer = 0, hidden = false, firstHide = true;
	var GLOWS = { fire:'#ff7a1a', ice:'#8fe6ff', jungle:'#b6ff7a', arena:'#b79cff', yard:'#7fe9ff', city:'#ffd27a', colosseum:'#ffc16a', forge:'#b79cff', menu:'#b79cff' };

	function build(msg){
		if(el) return;
		var st = document.createElement('style'); st.id = 'loadScrCss'; st.textContent = css;
		el = document.createElement('div'); el.id = 'loadScr';
		el.innerHTML = '<canvas class="ls-bg"></canvas><canvas class="ls-fx"></canvas><div class="ls-ui"><div class="ls-title">MAGIC BATTLE</div><div class="ls-ring"></div><div class="ls-msg"></div><div class="ls-bar"><div class="ls-fill"></div></div></div><div class="ls-tip"></div>';
		el.querySelector('.ls-tip').textContent = 'Tip: ' + TIPS[Math.floor(Math.random() * TIPS.length)];
		var root = document.documentElement;
		root.appendChild(st); root.appendChild(el);
		setMsg(msg || describe(location.href));
		applyTheme(msg ? msgUrl : location.href);
	}
	var msgUrl = '';
	function setMsg(m){ if(el){ el.querySelector('.ls-msg').textContent = m + '…'; } }
	function setProg(p){ prog = Math.max(prog, Math.min(100, p)); if(el){ var f = el.querySelector('.ls-fill'); if(f) f.style.width = prog + '%'; } }
	function creep(){ clearInterval(timer); timer = setInterval(function(){ if(prog < 90) setProg(prog + (90 - prog) * 0.08); }, 200); }

	function show(msg, url){
		hidden = false; started = Date.now(); msgUrl = url || msgUrl || location.href;
		if(!el) build(msg);
		el.classList.remove('out', 'fading', 'in'); void el.offsetWidth; el.style.display = 'flex'; el.classList.add('in');
		if(msg) setMsg(msg);
		applyTheme(msgUrl);
		prog = 8; var f = el.querySelector('.ls-fill'); if(f) f.style.width = '8%'; creep();
	}
	function hide(){
		if(hidden || !el) return; hidden = true;
		var wait = Math.max(0, 900 - (Date.now() - started));       // long enough to read, never a flash
		setTimeout(function(){
			if(!el) return;
			setProg(100); clearInterval(timer);
			el.classList.add('fading');                              // 1) the bar fills, the text and tip fade away
			setTimeout(function(){
				if(!el) return;
				if(firstHide){ document.documentElement.classList.add('ls-reveal'); }          // 2) the game fades in underneath…
				el.classList.remove('in'); el.classList.add('out');                              // …while the scene fades and pushes in over it
				firstHide = false;
				setTimeout(function(){ if(el && hidden){ el.style.display = 'none'; cancelAnimationFrame(fxRaf); document.documentElement.classList.remove('ls-reveal'); } }, 1150);
			}, 380);
		}, wait);
	}

	function init(){ build(); creep(); }
	if(document.documentElement) init(); else document.addEventListener('DOMContentLoaded', init);

	var loaded = document.readyState === 'complete';
	function afterLoad(){
		// let the page draw a couple of frames (or call LoadingScreen.ready()) before revealing it
		var n = 0;
		(function f(){ if(++n >= 3) { setTimeout(function(){ if(!window.__loadHold) hide(); }, 80); } else requestAnimationFrame(f); })();
	}
	if(loaded) afterLoad(); else window.addEventListener('load', afterLoad);
	setTimeout(function(){ hide(); }, 20000);      // safety: never trap the player behind it

	/* leaving for another page: cover the gap */
	document.addEventListener('click', function(e){
		var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
		if(!a || e.defaultPrevented || e.button) return;
		var h = a.getAttribute('href') || '';
		if(!h || h.charAt(0) === '#' || /^(javascript|mailto|tel):/i.test(h) || a.target === '_blank' || e.ctrlKey || e.metaKey || e.shiftKey) return;
		show(describe(a.href), a.href);
	}, true);
	window.addEventListener('beforeunload', function(){ if(el && hidden) show(); });
	window.addEventListener('pageshow', function(e){ if(e.persisted) hide(); });

	window.LoadingScreen = { show: show, hide: hide, message: setMsg, progress: setProg, ready: function(){ window.__loadHold = false; hide(); }, hold: function(){ window.__loadHold = true; } };
})();
