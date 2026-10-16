/* =============================================================
   cloud-save.js  —  player accounts + cloud sync
   -------------------------------------------------------------
   - Email/password sign up + sign in via Supabase Auth.
   - On sign-in, pulls the player's saved blob and writes every
     magicBattle_* key into localStorage (spells, loadouts, stats,
     quests, keybinds, bestiary, etc.).
   - Auto-saves to the cloud whenever any magicBattle_* key changes
     (debounced) and on page hide / unload.
   - If Supabase is not configured, everything no-ops gracefully and
     the game keeps using local-only saves.
   - On a local server (localhost / 127.0.0.1 / file://) sign-in is
     optional; progress stays in localStorage unless the player signs in.
   ============================================================= */
(function (global) {
	const CFG = global.SUPABASE_CONFIG || {};
	const ENABLED = !!(CFG.url && CFG.anonKey &&
		CFG.url.indexOf('YOUR_') === -1 && CFG.anonKey.indexOf('YOUR_') === -1);
	const PREFIX = 'magicBattle_';

	function isLocalPlay() {
		if (typeof global.MB_LOCAL_PLAY === 'boolean') return global.MB_LOCAL_PLAY;
		try {
			const h = (location.hostname || '').toLowerCase();
			if (location.protocol === 'file:') return true;
			if (h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '::1') return true;
			if (h.indexOf('localhost') !== -1) return true;
		} catch (e) {}
		return false;
	}
	const LOCAL_PLAY = isLocalPlay();
	global.MB_LOCAL_PLAY = LOCAL_PLAY;

	let sb = null;
	let user = null;
	let ready = false;
	let pushTimer = null;
	let suppressAutoPush = false;
	const authListeners = [];

	/* Clamp saved spells to current rules (projectile caps, domain waves, ult flag)
	   before every cloud upload. Full helper lives in spell-cost.js when that
	   script is loaded; hub pages get a self-contained fallback here. */
	function installSpellRuleFallback() {
		if (typeof global.enforceSpellRulesOnData === 'function' &&
			typeof global.enforceSpellRulesInStorage === 'function') return;

		const NORMAL_CAP = 50;
		const ULT_CAP = 200;
		const DOMAIN_WAVE_CAP = 5;

		function phaseCount(ph) {
			if (!ph) return 1;
			if (ph.behavior === 'aroundSelf') return Math.max(1, ph.aroundSelfCount || 4);
			if (ph.shape === 'same') return 1;
			return Math.max(1, ph.count || 1);
		}
		function setCount(ph, n) {
			n = Math.max(1, n | 0);
			if (ph.behavior === 'aroundSelf') ph.aroundSelfCount = n;
			else ph.count = n;
		}
		function product(spell) {
			if (!spell || !Array.isArray(spell.phases) || !spell.phases.length) return 1;
			let t = 1;
			for (const ph of spell.phases) t *= phaseCount(ph);
			return t;
		}
		function enforceSpell(spell, slotIdx) {
			if (!spell || !Array.isArray(spell.phases) || !spell.phases.length) return false;
			let changed = false;
			const isUlt = slotIdx === 9;
			if (isUlt) {
				if (!spell.isUltimate) { spell.isUltimate = true; changed = true; }
			} else if (spell.isUltimate) {
				delete spell.isUltimate;
				changed = true;
			}
			const hasDomain = !!(spell.phases[0] && spell.phases[0].behavior === 'domain');
			for (let i = 0; i < spell.phases.length; i++) {
				const ph = spell.phases[i];
				if (!ph) continue;
				if (ph.shape === 'same' && (ph.count || 1) !== 1) {
					ph.count = 1;
					changed = true;
				}
				if (hasDomain && i > 0 && phaseCount(ph) > DOMAIN_WAVE_CAP) {
					setCount(ph, DOMAIN_WAVE_CAP);
					changed = true;
				}
			}
			const cap = isUlt ? ULT_CAP : NORMAL_CAP;
			while (product(spell) > cap) {
				let idx = -1;
				for (let i = spell.phases.length - 1; i >= 0; i--) {
					const ph = spell.phases[i];
					if (!ph || ph.shape === 'same') continue;
					if (phaseCount(ph) > 1) { idx = i; break; }
				}
				if (idx < 0) break;
				setCount(spell.phases[idx], phaseCount(spell.phases[idx]) - 1);
				changed = true;
			}
			return changed;
		}
		function enforceData(playerData) {
			if (!playerData || typeof playerData !== 'object') return false;
			let changed = false;
			const walk = arr => {
				if (!Array.isArray(arr)) return;
				for (let i = 0; i < arr.length; i++) {
					if (arr[i] && enforceSpell(arr[i], i)) changed = true;
				}
			};
			walk(playerData.spells);
			walk(playerData.transformSpells);
			if (Array.isArray(playerData.loadouts)) {
				for (const ld of playerData.loadouts) {
					if (ld) walk(ld.spells);
				}
			}
			return changed;
		}
		function enforceStorage() {
			try {
				const raw = localStorage.getItem(PREFIX + 'playerData');
				if (!raw) return false;
				const data = JSON.parse(raw);
				if (!enforceData(data)) return false;
				localStorage.setItem(PREFIX + 'playerData', JSON.stringify(data));
				return true;
			} catch (e) {
				console.warn('[cloud-save] spell rule migrate failed:', e);
				return false;
			}
		}
		if (typeof global.enforceSpellRulesOnData !== 'function') {
			global.enforceSpellRulesOnData = enforceData;
		}
		if (typeof global.enforceSpellRulesInStorage !== 'function') {
			global.enforceSpellRulesInStorage = enforceStorage;
		}
	}

	function migrateSpellsForCloud() {
		installSpellRuleFallback();
		if (typeof global.enforceSpellRulesInStorage !== 'function') return false;
		return !!global.enforceSpellRulesInStorage();
	}

	function emitAuth() {
		authListeners.forEach(fn => { try { fn(user); } catch (e) {} });
	}

	/* ---- gather / apply the full save blob ---- */
	function collectSave() {
		const data = {};
		for (let i = 0; i < localStorage.length; i++) {
			const k = localStorage.key(i);
			if (k && k.indexOf(PREFIX) === 0) data[k] = localStorage.getItem(k);
		}
		return data;
	}
	function applySave(data) {
		if (!data || typeof data !== 'object') return;
		Object.keys(data).forEach(k => {
			if (k.indexOf(PREFIX) === 0 && data[k] != null) {
				localStorage.setItem(k, data[k]);
			}
		});
	}

	/* ---- cloud push / pull ---- */
	async function push() {
		if (!ENABLED || !sb || !user) return;
		suppressAutoPush = true;
		try { migrateSpellsForCloud(); }
		finally { suppressAutoPush = false; }
		const payload = {
			id: user.id,
			email: user.email,
			save_data: collectSave(),
			updated_at: new Date().toISOString(),
		};
		const { error } = await sb.from('profiles').upsert(payload, { onConflict: 'id' });
		if (error) console.warn('[cloud-save] push failed:', error.message);
	}

	async function pull() {
		if (!ENABLED || !sb || !user) return false;
		const { data, error } = await sb
			.from('profiles').select('save_data').eq('id', user.id).maybeSingle();
		if (error) { console.warn('[cloud-save] pull failed:', error.message); return false; }
		if (data && data.save_data && Object.keys(data.save_data).length) {
			let migrated = false;
			suppressAutoPush = true;
			try {
				applySave(data.save_data);
				migrated = migrateSpellsForCloud();
			} finally { suppressAutoPush = false; }
			if (migrated) await push();
			return true;
		}
		// No cloud save yet -> seed it from whatever is local now.
		await push();
		return false;
	}

	function schedulePush() {
		if (!ENABLED || !user) return;
		clearTimeout(pushTimer);
		pushTimer = setTimeout(push, 2500);
	}

	/* ---- detect local save changes (wrap setItem) ---- */
	let autoWired = false;
	function wireAutoSave() {
		if (autoWired) return;
		autoWired = true;
		const orig = localStorage.setItem.bind(localStorage);
		localStorage.setItem = function (key, val) {
			orig(key, val);
			if (suppressAutoPush) return;
			if (typeof key === 'string' && key.indexOf(PREFIX) === 0) schedulePush();
		};
		// flush on tab hide / navigation
		const flush = () => { if (user) push(); };
		document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
		window.addEventListener('pagehide', flush);
		window.addEventListener('beforeunload', flush);
	}

	/* ---- auth actions ---- */
	async function signUp(email, password) {
		if (!ENABLED) throw new Error('Online accounts are not configured yet.');
		const { data, error } = await sb.auth.signUp({ email, password });
		if (error) throw error;
		// If email confirmation is off, a session is returned immediately.
		if (data.session) { user = data.session.user; await pull(); wireAutoSave(); emitAuth(); }
		return data;
	}

	async function signIn(email, password) {
		if (!ENABLED) throw new Error('Online accounts are not configured yet.');
		const { data, error } = await sb.auth.signInWithPassword({ email, password });
		if (error) throw error;
		user = data.user;
		await pull();
		wireAutoSave();
		emitAuth();
		return data;
	}

	async function signOut() {
		if (!ENABLED || !sb) return;
		await push();
		await sb.auth.signOut();
		user = null;
		emitAuth();
	}

	/* ---- init ---- */
	async function init() {
		if (!ENABLED) { ready = true; emitAuth(); return; }
		if (!global.supabase || !global.supabase.createClient) {
			console.warn('[cloud-save] Supabase JS not loaded — check the CDN <script> tag.');
			ready = true; return;
		}
		sb = global.supabase.createClient(CFG.url, CFG.anonKey, {
			realtime: { params: { eventsPerSecond: 60 } },      // PvP sends ~20 state packets a second plus events
			auth: { persistSession: true, autoRefreshToken: true },
		});
		const { data } = await sb.auth.getSession();
		user = data.session ? data.session.user : null;
		sb.auth.onAuthStateChange((_evt, session) => {
			user = session ? session.user : null;
			emitAuth();
		});
		if (user) { await pull(); wireAutoSave(); }
		ready = true;
		emitAuth();
	}

	function onAuthChange(fn) { authListeners.push(fn); if (ready) fn(user); }

	global.CloudSave = {
		init, signUp, signIn, signOut, push, pull, onAuthChange,
		client() { return sb; },
		get enabled() { return ENABLED; },
		get localPlay() { return LOCAL_PLAY; },
		get user() { return user; },
		get displayName() {
			if (!user) return LOCAL_PLAY ? 'Local' : null;
			return (user.email || 'Mage').split('@')[0];
		},
	};

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else { init(); }
})(window);
