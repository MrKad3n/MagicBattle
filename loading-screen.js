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

	var css = '#loadScr{position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;' +
		'background:radial-gradient(ellipse at 50% 40%,#1c1238 0%,#0b0718 70%);color:#e9e2ff;font-family:Arial,sans-serif;opacity:1;transition:opacity .35s ease}' +
		'#loadScr.out{opacity:0;pointer-events:none}' +
		'#loadScr .ls-title{font-size:30px;font-weight:bold;letter-spacing:2px;text-shadow:0 0 18px #7a5cff}' +
		'#loadScr .ls-msg{font-size:16px;color:#b9abf0}' +
		'#loadScr .ls-ring{width:54px;height:54px;border-radius:50%;border:4px solid rgba(160,140,255,.22);border-top-color:#b79cff;animation:lsSpin .9s linear infinite}' +
		'#loadScr .ls-bar{width:min(360px,70vw);height:6px;border-radius:4px;background:rgba(255,255,255,.12);overflow:hidden}' +
		'#loadScr .ls-fill{height:100%;width:8%;background:linear-gradient(90deg,#7a5cff,#7fe9ff);border-radius:4px;transition:width .25s ease}' +
		'#loadScr .ls-tip{position:absolute;bottom:34px;font-size:13px;color:#8f81c8;max-width:80vw;text-align:center}' +
		'@keyframes lsSpin{to{transform:rotate(360deg)}}';
	var el = null, started = Date.now(), prog = 8, timer = 0, hidden = false;

	function build(msg){
		if(el) return;
		var st = document.createElement('style'); st.id = 'loadScrCss'; st.textContent = css;
		el = document.createElement('div'); el.id = 'loadScr';
		el.innerHTML = '<div class="ls-title">MAGIC BATTLE</div><div class="ls-ring"></div><div class="ls-msg"></div><div class="ls-bar"><div class="ls-fill"></div></div><div class="ls-tip"></div>';
		el.querySelector('.ls-tip').textContent = 'Tip: ' + TIPS[Math.floor(Math.random() * TIPS.length)];
		var root = document.documentElement;
		root.appendChild(st); root.appendChild(el);
		setMsg(msg || describe(location.href));
	}
	function setMsg(m){ if(el){ el.querySelector('.ls-msg').textContent = m + '…'; } }
	function setProg(p){ prog = Math.max(prog, Math.min(100, p)); if(el){ var f = el.querySelector('.ls-fill'); if(f) f.style.width = prog + '%'; } }
	function creep(){ timer = setInterval(function(){ if(prog < 90) setProg(prog + (90 - prog) * 0.08); }, 200); }

	function show(msg){
		hidden = false; started = Date.now();
		if(el){ el.classList.remove('out'); el.style.display = 'flex'; } else build(msg);
		if(msg) setMsg(msg);
		prog = 8; setProg(8); clearInterval(timer); creep();
	}
	function hide(){
		if(hidden || !el) return; hidden = true;
		var wait = Math.max(0, 450 - (Date.now() - started));       // never a flash
		setTimeout(function(){
			setProg(100); clearInterval(timer);
			setTimeout(function(){ if(!el) return; el.classList.add('out'); setTimeout(function(){ if(el && hidden) el.style.display = 'none'; }, 400); }, 120);
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
		show(describe(a.href));
	}, true);
	window.addEventListener('beforeunload', function(){ if(el && hidden) show(); });
	window.addEventListener('pageshow', function(e){ if(e.persisted) hide(); });

	window.LoadingScreen = { show: show, hide: hide, message: setMsg, progress: setProg, ready: function(){ window.__loadHold = false; hide(); }, hold: function(){ window.__loadHold = true; } };
})();
