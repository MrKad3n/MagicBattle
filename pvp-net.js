/* =============================================================
   pvp-net.js  —  online PvP matchmaking + in-arena sync
   -------------------------------------------------------------
   Built on Supabase Realtime (no game server required — works on
   a static Netlify deploy). Two flows:

     • Casual 1v1  -> presence-based lobby auto-pairs two players.
     • Private     -> both players join the same 4-letter code.

   Once paired, both browsers navigate to:
       dungeon.html?mode=colosseum&match=<id>&side=<left|right>

   The player who announces the pairing resolves it LOCALLY (does
   not rely on receiving its own broadcast), so both host and guest
   always advance to the arena.
   ============================================================= */
(function (global) {
	function sb() {
		return (global.CloudSave && global.CloudSave.client && global.CloudSave.client()) || null;
	}
	function enabled() { return !!sb(); }

	function uid() {
		if (global.crypto && crypto.randomUUID) return crypto.randomUUID();
		return 'm-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
	}
	function code4() {
		const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
		let s = '';
		for (let i = 0; i < 4; i++) s += a[Math.floor(Math.random() * a.length)];
		return s;
	}
	function myId() {
		const u = global.CloudSave && global.CloudSave.user;
		if (u && u.id) return u.id;
		let g = sessionStorage.getItem('mb_guestId');
		if (!g) { g = 'guest-' + Math.random().toString(36).slice(2, 10); sessionStorage.setItem('mb_guestId', g); }
		return g;
	}

	// Remove any lingering channel with the same topic so re-entry never
	// throws "cannot add presence callbacks after subscribe()".
	function dropChannel(client, topic) {
		try {
			(client.getChannels() || []).forEach(c => {
				if (c && (c.topic === topic || c.topic === 'realtime:' + topic)) {
					try { client.removeChannel(c); } catch (e) {}
				}
			});
		} catch (e) {}
	}

	/* ---------------- CASUAL 1v1 (auto lobby) ---------------- */
	function findCasual(opts) {
		opts = opts || {};
		const client = sb();
		if (!client) { opts.onStatus && opts.onStatus('Online play is not configured.'); return { cancel() {} }; }

		const me = myId();
		const name = opts.name || (global.CloudSave && global.CloudSave.displayName) || 'Mage';
		let done = false;
		opts.onStatus && opts.onStatus('Searching for an opponent…');

		dropChannel(client, 'pvp-lobby');
		const ch = client.channel('pvp-lobby', { config: { broadcast: { self: true }, presence: { key: me } } });

		function finish(matchId, side) {
			if (done) return;
			done = true;
			try { ch.untrack(); } catch (e) {}
			try { ch.unsubscribe(); } catch (e) {}
			opts.onStatus && opts.onStatus('Opponent found!');
			opts.onMatched && opts.onMatched(matchId, side);
		}

		function tryMatchmake() {
			if (done) return;
			const state = ch.presenceState();
			const players = Object.keys(state).map(k => {
				const meta = state[k][0] || {};
				return { id: k, name: meta.name, t: meta.t || 0 };
			}).sort((a, b) => (a.t - b.t) || (a.id < b.id ? -1 : 1));
			if (players.length < 2) return;
			const matchmaker = players.slice().sort((a, b) => (a.id < b.id ? -1 : 1))[0];
			if (matchmaker.id !== me) return; // only one player announces
			const a = players[0], b = players[1];
			const matchId = uid();
			ch.send({ type: 'broadcast', event: 'match', payload: { matchId, a: a.id, b: b.id } });
			// Resolve our own side locally (don't depend on self-echo).
			finish(matchId, a.id === me ? 'left' : 'right');
		}

		ch.on('presence', { event: 'sync' }, () => setTimeout(tryMatchmake, 400));
		ch.on('broadcast', { event: 'match' }, ({ payload }) => {
			if (!payload) return;
			if (payload.a === me) finish(payload.matchId, 'left');
			else if (payload.b === me) finish(payload.matchId, 'right');
		});

		ch.subscribe(async (status) => {
			if (status === 'SUBSCRIBED') {
				await ch.track({ name, t: Date.now() });
				setTimeout(tryMatchmake, 600);
			}
		});

		return { cancel() { if (done) return; done = true; try { ch.untrack(); } catch (e) {} try { ch.unsubscribe(); } catch (e) {} } };
	}

	/* ---------------- PRIVATE MATCH (shared code) ---------------- */
	function joinPrivate(rawCode, opts) {
		opts = opts || {};
		const client = sb();
		if (!client) { opts.onStatus && opts.onStatus('Online play is not configured.'); return { cancel() {} }; }
		const codeStr = String(rawCode || '').trim().toUpperCase();
		if (codeStr.length < 3) { opts.onStatus && opts.onStatus('Enter a valid code.'); return { cancel() {} }; }

		const me = myId();
		const name = opts.name || (global.CloudSave && global.CloudSave.displayName) || 'Mage';
		let done = false;
		opts.onStatus && opts.onStatus('Waiting in room ' + codeStr + '…');

		dropChannel(client, 'pvp-room-' + codeStr);
		const ch = client.channel('pvp-room-' + codeStr, { config: { broadcast: { self: true }, presence: { key: me } } });

		function finish(matchId, side) {
			if (done) return;
			done = true;
			try { ch.untrack(); } catch (e) {}
			try { ch.unsubscribe(); } catch (e) {}
			opts.onStatus && opts.onStatus('Match starting!');
			opts.onMatched && opts.onMatched(matchId, side);
		}

		function tryStart() {
			if (done) return;
			const state = ch.presenceState();
			const players = Object.keys(state).map(k => ({ id: k, t: (state[k][0] || {}).t || 0 }))
				.sort((a, b) => (a.t - b.t) || (a.id < b.id ? -1 : 1));
			if (players.length < 2) return;
			if (players[0].id !== me) return; // host announces
			const matchId = 'room-' + codeStr;
			ch.send({ type: 'broadcast', event: 'start', payload: { matchId, host: players[0].id, guest: players[1].id } });
			finish(matchId, 'left'); // host -> left, resolve locally
		}

		ch.on('presence', { event: 'sync' }, () => setTimeout(tryStart, 400));
		ch.on('broadcast', { event: 'start' }, ({ payload }) => {
			if (!payload) return;
			if (payload.host === me) finish(payload.matchId, 'left');
			else if (payload.guest === me) finish(payload.matchId, 'right');
		});

		ch.subscribe(async (status) => {
			if (status === 'SUBSCRIBED') {
				await ch.track({ name, t: Date.now() });
				setTimeout(tryStart, 600);
			}
		});

		return { cancel() { if (done) return; done = true; try { ch.untrack(); } catch (e) {} try { ch.unsubscribe(); } catch (e) {} } };
	}

	/* ---------------- IN-ARENA SYNC ----------------
	   One channel per match. Everything travels as two broadcast events:
	     's' — the fighter's state (frequent, tiny array)
	     'e' — every other message, { k: kind, d: data }
	   ack is off (a broadcast never waits for the server to confirm) and the
	   socket is never throttled below 60 events/s. `local` (or ?local=1)
	   connects two tabs of the same browser with a BroadcastChannel instead,
	   for testing without the server. */
	function connectMatch(matchId, side, handlers) {
		handlers = handlers || {};
		const local = !!handlers.local || /[?&]local=1/.test((global.location && global.location.search) || '');
		if (local) return withP2P(side, handlers, (h) => connectLocal(matchId, side, h));
		const client = sb();
		const stub = { send() {}, sendState() {}, sendCast() {}, sendHit() {}, sendOver() {}, leave() {}, transport: () => 'none' };
		if (!client) return stub;
		return withP2P(side, handlers, (h) => connectRelay(client, matchId, side, h));
	}
	function connectRelay(client, matchId, side, handlers) {
		const me = myId();
		const topic = 'pvp-match-' + matchId;
		dropChannel(client, topic);
		try { if (client.realtime && client.realtime.params) client.realtime.params.eventsPerSecond = 60; if (client.realtime) client.realtime.eventsPerSecondLimitMs = 16; } catch (e) {}
		const ch = client.channel(topic, { config: { broadcast: { self: false, ack: false }, presence: { key: me } } });
		let subscribed = false;
		const deliver = (k, d) => { if (handlers.onEvent) handlers.onEvent(k, d); };

		ch.on('broadcast', { event: 's' }, ({ payload }) => { if (payload && payload.f !== me) deliver('s', payload.s); });
		ch.on('broadcast', { event: 'e' }, ({ payload }) => { if (payload && payload.f !== me) deliver(payload.k, payload.d); });
		ch.on('presence', { event: 'leave' }, () => {
			if (Object.keys(ch.presenceState()).length <= 1) handlers.onLeft && handlers.onLeft();
		});
		ch.on('presence', { event: 'join' }, () => {
			if (Object.keys(ch.presenceState()).length >= 2) handlers.onReady && handlers.onReady();
		});
		ch.subscribe(async (status) => {
			if (status === 'SUBSCRIBED') {
				subscribed = true;
				await ch.track({ side, t: Date.now() });
				handlers.onConnected && handlers.onConnected();
			}
		});
		function send(k, d) {
			if (!subscribed) return;      // never before the socket is ready (that would fall back to slow REST)
			if (k === 's') ch.send({ type: 'broadcast', event: 's', payload: { f: me, s: d } });
			else ch.send({ type: 'broadcast', event: 'e', payload: { f: me, k, d } });
		}
		return {
			send,
			sendState(s) { send('s', s); }, sendCast(c) { send('cast', c); }, sendHit(h) { send('hit', h); }, sendOver(o) { send('over', o); },
			leave() { try { ch.untrack(); } catch (e) {} try { ch.unsubscribe(); } catch (e) {} },
		};
	}
	/* ---------------- DIRECT LINK (WebRTC) ----------------
	   The relay (Supabase broadcast, or the local BroadcastChannel) carries the handshake; once a direct
	   peer-to-peer connection opens, everything travels over it instead:
	     state  — unordered, never retransmitted (a late snapshot is useless: the next one is 50 ms behind it)
	     events — ordered and reliable (casts, blows, round results must all arrive)
	   That halves the delay (no server hop) and removes the relay's rate limit. If the direct link can't open
	   (strict NAT / firewall) or drops, the relay keeps working as before. */
	const ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }, { urls: 'stun:stun.cloudflare.com:3478' }];
	function withP2P(side, handlers, makeBase) {
		const host = side !== 'right';
		const qs = (global.location && global.location.search) || '';
		if (/[?&]nop2p=1/.test(qs)) return makeBase(handlers);      // testing: relay only
		let pc = null, dcS = null, dcE = null, up = false, tries = 0, retryT = null, closed = false;
		const pendingCand = [];
		const deliver = (k, d) => { if (handlers.onEvent) handlers.onEvent(k, d); };
		const base = makeBase(Object.assign({}, handlers, {
			onEvent(k, d) {
				if (k === 'rtc') { onSignal(d); return; }
				deliver(k, d);
			},
			onReady() { if (host) startOffer(); if (handlers.onReady) handlers.onReady(); },
			onLeft() { teardown(); if (handlers.onLeft) handlers.onLeft(); }
		}));
		function teardown() {
			up = false;
			try { dcS && dcS.close(); } catch (e) {} try { dcE && dcE.close(); } catch (e) {} try { pc && pc.close(); } catch (e) {}
			pc = dcS = dcE = null;
		}
		function wire(dc) {
			dc.onmessage = (ev) => {
				let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
				if (m && m.k) deliver(m.k, m.d);
			};
			dc.onopen = check; dc.onclose = () => { if (up) { up = false; if (handlers.onTransport) handlers.onTransport('relay'); scheduleRetry(); } };
		}
		function check() {
			const ok = dcS && dcE && dcS.readyState === 'open' && dcE.readyState === 'open';
			if (ok && !up) { up = true; tries = 0; if (handlers.onTransport) handlers.onTransport('p2p'); }
		}
		function newPc() {
			teardown();
			if (typeof RTCPeerConnection === 'undefined') return null;
			pc = new RTCPeerConnection({ iceServers: ICE });
			pc.onicecandidate = (ev) => { if (ev.candidate) base.send('rtc', { c: ev.candidate.toJSON ? ev.candidate.toJSON() : ev.candidate }); };
			pc.onconnectionstatechange = () => { if (pc && (pc.connectionState === 'failed' || pc.connectionState === 'disconnected')) { if (up && handlers.onTransport) handlers.onTransport('relay'); up = false; scheduleRetry(); } };
			pc.ondatachannel = (ev) => { const dc = ev.channel; if (dc.label === 's') dcS = dc; else dcE = dc; wire(dc); };
			return pc;
		}
		function scheduleRetry() {
			if (!host || closed || retryT || tries >= 4) return;
			retryT = setTimeout(() => { retryT = null; if (!up) startOffer(); }, 3000 + tries * 2000);
		}
		async function startOffer() {
			if (closed || up) return;
			tries++;
			try {
				if (!newPc()) return;
				dcS = pc.createDataChannel('s', { ordered: false, maxRetransmits: 0 });
				dcE = pc.createDataChannel('e', { ordered: true });
				wire(dcS); wire(dcE);
				const off = await pc.createOffer();
				await pc.setLocalDescription(off);
				base.send('rtc', { o: { type: off.type, sdp: off.sdp } });
				scheduleRetry();
			} catch (e) { scheduleRetry(); }
		}
		async function onSignal(d) {
			if (!d || closed) return;
			try {
				if (d.o) {      // an offer (the guest answers; a fresh offer replaces any old connection)
					if (host) return;
					if (!newPc()) return;
					await pc.setRemoteDescription(d.o);
					const ans = await pc.createAnswer();
					await pc.setLocalDescription(ans);
					base.send('rtc', { a: { type: ans.type, sdp: ans.sdp } });
					while (pendingCand.length) { try { await pc.addIceCandidate(pendingCand.shift()); } catch (e) {} }
				} else if (d.a) {
					if (!host || !pc) return;
					await pc.setRemoteDescription(d.a);
					while (pendingCand.length) { try { await pc.addIceCandidate(pendingCand.shift()); } catch (e) {} }
				} else if (d.c) {
					if (pc && pc.remoteDescription) { try { await pc.addIceCandidate(d.c); } catch (e) {} }
					else pendingCand.push(d.c);
				}
			} catch (e) {}
		}
		function send(k, d) {
			if (up) {
				try {
					const dc = k === 's' ? dcS : dcE;
					if (dc.readyState === 'open' && (k !== 's' || dc.bufferedAmount < 16384)) { dc.send(JSON.stringify({ k, d })); return; }
					if (k === 's') return;      // a congested state channel drops the snapshot (a fresh one follows)
				} catch (e) {}
			}
			base.send(k, d);
		}
		return {
			send,
			sendState(s) { send('s', s); }, sendCast(c) { send('cast', c); }, sendHit(h) { send('hit', h); }, sendOver(o) { send('over', o); },
			transport: () => up ? 'p2p' : 'relay',
			leave() { closed = true; clearTimeout(retryT); teardown(); base.leave(); }
		};
	}

	/* two tabs of one browser, no server: a BroadcastChannel with a tiny hello / bye presence */
	function connectLocal(matchId, side, handlers) {
		const me = side + '-' + Math.random().toString(36).slice(2, 7);
		const bc = new BroadcastChannel('pvp-local-' + matchId);
		let peer = false;
		const post = (m) => { try { bc.postMessage(m); } catch (e) {} };
		// testing: ?lag=ms adds a one-way delay with jitter, like a real connection
		const lagM = /[?&]lag=(\d+)/.exec((global.location && global.location.search) || '');
		const lag = lagM ? +lagM[1] : 0;
		let lagAt = 0;
		bc.onmessage = (ev) => {
			if (lag) { const d = ev.data, t = performance.now(); lagAt = Math.max(lagAt, t + lag * (0.8 + Math.random() * 0.4)); setTimeout(() => handle(d), lagAt - t); return; }      // in order, like a socket
			handle(ev.data);
		};
		function handle(m) {
			if (!m || m.f === me) return;
			if (m.p === 'hi') { if (!peer) { peer = true; post({ f: me, p: 'hi' }); handlers.onReady && handlers.onReady(); } return; }
			if (m.p === 'bye') { peer = false; handlers.onLeft && handlers.onLeft(); return; }
			if (handlers.onEvent) handlers.onEvent(m.k, m.d);
		}
		setTimeout(() => { handlers.onConnected && handlers.onConnected(); post({ f: me, p: 'hi' }); }, 30);
		global.addEventListener && global.addEventListener('beforeunload', () => post({ f: me, p: 'bye' }));
		function send(k, d) { post({ f: me, k, d }); }
		return { send, sendState(s) { send('s', s); }, sendCast(c) { send('cast', c); }, sendHit(h) { send('hit', h); }, sendOver(o) { send('over', o); }, leave() { post({ f: me, p: 'bye' }); try { bc.close(); } catch (e) {} } };
	}

	global.PvPNet = {
		enabled, findCasual, joinPrivate, connectMatch, createPrivateCode: code4,
	};
})(window);
