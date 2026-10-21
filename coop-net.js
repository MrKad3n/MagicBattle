/* =============================================================
   coop-net.js  —  co-op matchmaking + in-game sync (up to 4 players)
   -------------------------------------------------------------
   Room-code pairing for dungeons and raid bosses. One player hosts a
   room and shares the code; up to three more join. The lobby reports
   every occupied slot so the UI can show who has arrived, and the host
   starts the run when everyone is ready.

   Slot 0 is always the host. The host owns enemy/boss simulation
   in-game; guests replay what the host broadcasts.
   ============================================================= */
(function (global) {
	const MAX_PLAYERS = 4;

	function sb() {
		return (global.CloudSave && global.CloudSave.client && global.CloudSave.client()) || null;
	}
	function enabled() { return !!sb(); }

	function myId() {
		const u = global.CloudSave && global.CloudSave.user;
		if (u && u.id) return u.id;
		let g = sessionStorage.getItem('mb_guestId');
		if (!g) { g = 'guest-' + Math.random().toString(36).slice(2, 10); sessionStorage.setItem('mb_guestId', g); }
		return g;
	}
	function code4() {
		const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
		let s = '';
		for (let i = 0; i < 4; i++) s += a[Math.floor(Math.random() * a.length)];
		return s;
	}
	function dropChannel(client, topic) {
		try {
			(client.getChannels() || []).forEach(c => {
				if (c && (c.topic === topic || c.topic === 'realtime:' + topic)) {
					try { client.removeChannel(c); } catch (e) {}
				}
			});
		} catch (e) {}
	}

	/* Deterministic slot order, derived identically on every client:
	   the room creator is always slot 0 (an explicit flag, not a timestamp,
	   so a skewed clock can't promote a guest to host), then earliest joiner
	   with the id as a final tiebreak. */
	function rosterFrom(presenceState) {
		return Object.keys(presenceState).map(k => {
			const meta = (presenceState[k] || [])[0] || {};
			return {
				id: k, name: meta.name || 'Mage', t: meta.t || 0,
				game: meta.game || null, isHost: !!meta.isHost,
			};
		}).sort((a, b) =>
			(b.isHost - a.isHost) || (a.t - b.t) || (a.id < b.id ? -1 : 1)
		).slice(0, MAX_PLAYERS);
	}

	function buildCoopUrl(game, matchId, slot) {
		const m = encodeURIComponent(matchId);
		const tail = '&coop=1&match=' + m + '&slot=' + slot + '&side=' + (slot === 0 ? 'left' : 'right');
		if (game && game.kind === 'dungeon') {
			return 'dungeon.html?type=' + encodeURIComponent(game.type) +
				'&diff=' + encodeURIComponent(game.diff || 'normal') + tail;
		}
		return 'dungeon.html?mode=' + encodeURIComponent((game && game.mode) || 'raid') + (game && game.sw > 1 ? '&sw=' + (game.sw | 0) : '') + tail;
	}

	/* ---------------- LOBBY (host + join share one implementation) ----------------
	   opts: { name, code, game, onStatus, onLobby(players, isHost, code), onMatched(matchId, slot, game, url) } */
	function openLobby(rawCode, gameSpec, opts, creator) {
		opts = opts || {};
		const client = sb();
		if (!client) { opts.onStatus && opts.onStatus('Online co-op is not configured.'); return { cancel() {}, start() {} }; }

		const codeStr = String(rawCode || '').trim().toUpperCase();
		if (codeStr.length < 3) { opts.onStatus && opts.onStatus('Enter a valid code.'); return { cancel() {}, start() {} }; }

		const me = myId();
		const name = opts.name || (global.CloudSave && global.CloudSave.displayName) || 'Mage';
		let done = false;
		let roster = [];
		let isHost = false;

		dropChannel(client, 'coop-room-' + codeStr);
		const ch = client.channel('coop-room-' + codeStr, {
			config: { broadcast: { self: true }, presence: { key: me } },
		});

		function finish(matchId, slot, game) {
			if (done) return;
			done = true;
			try { ch.untrack(); } catch (e) {}
			try { ch.unsubscribe(); } catch (e) {}
			opts.onStatus && opts.onStatus('Starting co-op!');
			opts.onMatched && opts.onMatched(matchId, slot, game, buildCoopUrl(game, matchId, slot));
		}

		function syncLobby() {
			if (done) return;
			roster = rosterFrom(ch.presenceState());
			isHost = roster.length > 0 && roster[0].id === me;
			if (!creator && roster.length === MAX_PLAYERS && !roster.some(p => p.id === me)) {
				opts.onStatus && opts.onStatus('That room is full (4 players).');
			}
			opts.onLobby && opts.onLobby(roster, isHost, codeStr);
		}

		ch.on('presence', { event: 'sync' }, () => setTimeout(syncLobby, 250));
		ch.on('presence', { event: 'join' }, () => setTimeout(syncLobby, 250));
		ch.on('presence', { event: 'leave' }, () => setTimeout(syncLobby, 250));

		ch.on('broadcast', { event: 'start' }, ({ payload }) => {
			if (!payload || !Array.isArray(payload.order)) return;
			const slot = payload.order.indexOf(me);
			if (slot < 0) return;
			finish(payload.matchId, slot, payload.game || gameSpec);
		});

		ch.subscribe(async (status) => {
			if (status === 'SUBSCRIBED') {
				await ch.track({ name, t: Date.now(), game: gameSpec || null, isHost: !!creator });
				setTimeout(syncLobby, 400);
			}
		});

		return {
			code: codeStr,
			isHost() { return isHost; },
			players() { return roster.slice(); },
			/* Host-only: lock in the current roster and send everyone in. */
			start() {
				if (done) return;
				roster = rosterFrom(ch.presenceState());
				if (roster.length === 0 || roster[0].id !== me) return;
				if (roster.length < 2) { opts.onStatus && opts.onStatus('Wait for at least one ally to join.'); return; }
				const game = gameSpec || roster[0].game || null;
				ch.send({
					type: 'broadcast', event: 'start',
					payload: { matchId: 'coop-' + codeStr, order: roster.map(p => p.id), game },
				});
				finish('coop-' + codeStr, 0, game);
			},
			cancel() {
				if (done) return;
				done = true;
				try { ch.untrack(); } catch (e) {}
				try { ch.unsubscribe(); } catch (e) {}
			},
		};
	}

	function hostRoom(gameSpec, opts) {
		opts = opts || {};
		return openLobby(opts.code || code4(), gameSpec, opts, true);
	}
	function joinRoom(rawCode, opts) {
		// Guests do not know the game yet; they inherit it from the host's start payload.
		return openLobby(rawCode, null, opts || {}, false);
	}

	/* ---------------- IN-GAME SYNC ---------------- */
	/* testing without a server: tabs of one browser talk over a BroadcastChannel (?local=1) */
	function connectCoopLocal(matchId, handlers) {
		const me = myId();
		const bc = new BroadcastChannel('coop-local-' + matchId);
		const peers = new Set();
		const post = (m) => { try { bc.postMessage(m); } catch (e) {} };
		const EV = { state: 'onState', cast: 'onCast', enemyDmg: 'onEnemyDmg', boss: 'onBoss', world: 'onWorld', projectiles: 'onProjectiles', event: 'onEvent' };
		bc.onmessage = (ev) => {
			const m = ev.data; if (!m || m.from === me) return;
			if (m.p === 'hi') {
				if (!peers.has(m.from)) { peers.add(m.from); post({ p: 'hi', from: me }); if (peers.size >= 1) handlers.onReady && handlers.onReady(); }
				return;
			}
			if (m.p === 'bye') { if (peers.delete(m.from)) handlers.onLeft && handlers.onLeft(m.from); return; }
			const h = EV[m.event]; if (h && handlers[h]) handlers[h](m.payload);
		};
		setTimeout(() => { handlers.onConnected && handlers.onConnected(); post({ p: 'hi', from: me }); }, 30);
		global.addEventListener && global.addEventListener('beforeunload', () => post({ p: 'bye', from: me }));
		const send = (event, payload) => post({ event, from: me, payload: Object.assign({ from: me }, payload) });
		return {
			id: me,
			sendState(s) { send('state', s); }, sendCast(c) { send('cast', c); }, sendEnemyDmg(d) { send('enemyDmg', d); }, sendBoss(b) { send('boss', b); },
			sendWorld(w) { send('world', w); }, sendProjectiles(p) { send('projectiles', p); }, sendEvent(e) { send('event', e); },
			leave() { post({ p: 'bye', from: me }); try { bc.close(); } catch (e) {} },
		};
	}
	function connectCoop(matchId, handlers) {
		handlers = handlers || {};
		if (/[?&]local=1/.test((global.location && global.location.search) || '')) return connectCoopLocal(matchId, handlers);
		const client = sb();
		if (!client) {
			return {
				id: 'offline',
				sendState() {}, sendCast() {}, sendEnemyDmg() {}, sendBoss() {},
				sendWorld() {}, sendProjectiles() {}, sendEvent() {}, leave() {},
			};
		}
		const me = myId();
		const topic = 'coop-match-' + matchId;
		dropChannel(client, topic);
		const ch = client.channel(topic, { config: { broadcast: { self: false }, presence: { key: me } } });
		let subscribed = false;

		function on(event, cb) {
			ch.on('broadcast', { event }, ({ payload }) => {
				if (payload && payload.from !== me) cb && cb(payload);
			});
		}
		on('state', p => handlers.onState && handlers.onState(p));
		on('cast', p => handlers.onCast && handlers.onCast(p));
		on('enemyDmg', p => handlers.onEnemyDmg && handlers.onEnemyDmg(p));
		on('boss', p => handlers.onBoss && handlers.onBoss(p));
		on('world', p => handlers.onWorld && handlers.onWorld(p));
		on('projectiles', p => handlers.onProjectiles && handlers.onProjectiles(p));
		on('event', p => handlers.onEvent && handlers.onEvent(p));

		// Supabase reports the departing player's presence key at the top level.
		ch.on('presence', { event: 'leave' }, ({ key }) => {
			if (key) handlers.onLeft && handlers.onLeft(key);
			handlers.onRoster && handlers.onRoster(rosterFrom(ch.presenceState()));
		});
		ch.on('presence', { event: 'join' }, () => {
			handlers.onRoster && handlers.onRoster(rosterFrom(ch.presenceState()));
			if (Object.keys(ch.presenceState()).length >= 2) handlers.onReady && handlers.onReady();
		});
		ch.on('presence', { event: 'sync' }, () => {
			handlers.onRoster && handlers.onRoster(rosterFrom(ch.presenceState()));
		});

		ch.subscribe(async (status) => {
			if (status === 'SUBSCRIBED') {
				subscribed = true;
				await ch.track({ t: Date.now() });
				handlers.onConnected && handlers.onConnected();
			}
		});

		function send(event, payload) {
			if (!subscribed) return;
			ch.send({ type: 'broadcast', event, payload: Object.assign({ from: me }, payload) });
		}
		return {
			id: me,
			sendState(s) { send('state', s); },
			sendCast(c) { send('cast', c); },
			sendEnemyDmg(d) { send('enemyDmg', d); },
			sendBoss(b) { send('boss', b); },
			sendWorld(w) { send('world', w); },
			sendProjectiles(p) { send('projectiles', p); },
			sendEvent(e) { send('event', e); },
			leave() { try { ch.untrack(); } catch (e) {} try { ch.unsubscribe(); } catch (e) {} },
		};
	}

	global.CoopNet = {
		MAX_PLAYERS,
		enabled, hostRoom, joinRoom, openLobby, connectCoop,
		createCode: code4, buildCoopUrl, myId,
	};
})(window);
