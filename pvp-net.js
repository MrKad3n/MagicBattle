/* =============================================================
   pvp-net.js  —  online PvP matchmaking + in-arena sync (up to 4 players)
   -------------------------------------------------------------
   Built on Supabase Realtime (no game server required — works on
   a static Netlify deploy).

   Matchmaking
     • Casual 1v1        -> presence lobby auto-pairs two players.
     • Casual free-for-all (up to 4) -> starts at 4, or at 2+ once the
       oldest player has waited 25 s.
     • Casual 2v2        -> starts when four players are queued.
     • Private room      -> up to 4 players share a code; the host (first
       in) picks 1v1 / free-for-all / 2v2 and presses Start.

   Every match is described by { slot, n, mode }: slot 0..n-1 (slot 0 is
   the host and referee), n players, mode 'duel' | 'ffa' | 'teams'
   (teams: slots 0 and 2 against 1 and 3). Both browsers navigate to
       dungeon.html?mode=colosseum&match=<id>&slot=<i>&n=<n>&pm=<mode>&side=<left|right>
   (side is kept for older code: slot 0 is left, everyone else right.)

   In the arena every message carries its sender's slot; a message may be
   addressed to one slot (`to`). Transport: the Supabase relay, upgraded
   to a WebRTC mesh (one direct link per pair of players; the lower slot
   offers). A message goes directly to every peer whose link is open and
   once through the relay for the rest (with the list of slots it already
   reached, so nobody receives it twice).
   ============================================================= */
(function (global) {
	function sb() {
		return (global.CloudSave && global.CloudSave.client && global.CloudSave.client()) || null;
	}
	function enabled() { return !!sb(); }

	const MAX_PLAYERS = 4;
	const FFA_WAIT_MS = 25000;      // a free-for-all starts with fewer than 4 once the oldest has waited this long

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

	/* the match URL for one player */
	function matchUrl(matchId, info) {
		const slot = info.slot | 0, n = info.n || 2, mode = info.mode || 'duel';
		return 'dungeon.html?mode=colosseum&match=' + encodeURIComponent(matchId) + '&slot=' + slot + '&n=' + n + '&pm=' + mode + '&side=' + (slot === 0 ? 'left' : 'right');
	}
	function rosterOf(ch) {
		const state = ch.presenceState();
		return Object.keys(state).map(k => {
			const meta = state[k][0] || {};
			return { id: k, name: meta.name || 'Mage', t: meta.t || 0 };
		}).sort((a, b) => (a.t - b.t) || (a.id < b.id ? -1 : 1));
	}
	const modeSize = (mode, count) => mode === 'duel' ? 2 : mode === 'teams' ? 4 : Math.min(MAX_PLAYERS, count);

	/* ---------------- CASUAL QUEUES (1v1, free-for-all, 2v2) ---------------- */
	function findQueue(opts) {
		opts = opts || {};
		const mode = opts.mode === 'ffa' || opts.mode === 'teams' ? opts.mode : 'duel';
		const client = sb();
		if (!client) { opts.onStatus && opts.onStatus('Online play is not configured.'); return { cancel() {} }; }
		const me = myId();
		const name = opts.name || (global.CloudSave && global.CloudSave.displayName) || 'Mage';
		let done = false, timer = null;
		const topic = mode === 'duel' ? 'pvp-lobby' : 'pvp-lobby-' + mode;
		const want = mode === 'duel' ? 'an opponent' : mode === 'teams' ? 'three more players (2v2)' : 'players (free-for-all, up to 4)';
		opts.onStatus && opts.onStatus('Searching for ' + want + '…');

		dropChannel(client, topic);
		const ch = client.channel(topic, { config: { broadcast: { self: true }, presence: { key: me } } });

		function finish(matchId, info) {
			if (done) return;
			done = true; clearInterval(timer);
			try { ch.untrack(); } catch (e) {}
			try { ch.unsubscribe(); } catch (e) {}
			opts.onStatus && opts.onStatus('Match found!');
			opts.onMatched && opts.onMatched(matchId, info);
		}
		function tryMatchmake() {
			if (done) return;
			const players = rosterOf(ch);
			if (mode !== 'duel') opts.onStatus && opts.onStatus(players.length + ' / ' + (mode === 'teams' ? 4 : MAX_PLAYERS) + ' in the queue…');
			const need = mode === 'duel' ? 2 : mode === 'teams' ? 4 : (players.length >= MAX_PLAYERS ? MAX_PLAYERS : (players.length >= 2 && players[0].t && Date.now() - players[0].t > FFA_WAIT_MS ? players.length : 99));
			if (players.length < need) return;
			const matchmaker = players.slice().sort((a, b) => (a.id < b.id ? -1 : 1))[0];
			if (matchmaker.id !== me) return;      // only one player announces
			const order = players.slice(0, need).map(p => p.id);
			const matchId = uid();
			ch.send({ type: 'broadcast', event: 'match', payload: { matchId, order, mode } });
			const slot = order.indexOf(me);
			if (slot >= 0) finish(matchId, { slot, n: order.length, mode });      // resolve locally (no self-echo needed)
		}
		ch.on('presence', { event: 'sync' }, () => setTimeout(tryMatchmake, 400));
		ch.on('broadcast', { event: 'match' }, ({ payload }) => {
			if (!payload) return;
			// older clients announce { a, b }
			const order = payload.order || [payload.a, payload.b];
			const slot = order.indexOf(me);
			if (slot >= 0) finish(payload.matchId, { slot, n: order.length, mode: payload.mode || 'duel' });
		});
		ch.subscribe(async (status) => {
			if (status === 'SUBSCRIBED') {
				await ch.track({ name, t: Date.now() });
				setTimeout(tryMatchmake, 600);
				if (mode === 'ffa') timer = setInterval(tryMatchmake, 2000);      // the waiting rule needs a clock
			}
		});
		return { cancel() { if (done) return; done = true; clearInterval(timer); try { ch.untrack(); } catch (e) {} try { ch.unsubscribe(); } catch (e) {} } };
	}
	const findCasual = (opts) => findQueue(Object.assign({}, opts, { mode: 'duel' }));

	/* ---------------- PRIVATE ROOM (shared code, up to 4) ----------------
	   opts.onRoster(players, hostId, me) is called whenever the room changes; the handle's start(mode) is for
	   the host. A fifth player is told the room is full. */
	function openRoom(rawCode, opts) {
		opts = opts || {};
		const client = sb();
		if (!client) { opts.onStatus && opts.onStatus('Online play is not configured.'); return { cancel() {}, start() {} }; }
		const codeStr = String(rawCode || '').trim().toUpperCase();
		if (codeStr.length < 3) { opts.onStatus && opts.onStatus('Enter a valid code.'); return { cancel() {}, start() {} }; }
		const me = myId();
		const name = opts.name || (global.CloudSave && global.CloudSave.displayName) || 'Mage';
		let done = false;
		opts.onStatus && opts.onStatus('Waiting in room ' + codeStr + '…');
		dropChannel(client, 'pvp-room-' + codeStr);
		const ch = client.channel('pvp-room-' + codeStr, { config: { broadcast: { self: true }, presence: { key: me } } });

		function finish(matchId, info) {
			if (done) return;
			done = true;
			try { ch.untrack(); } catch (e) {}
			try { ch.unsubscribe(); } catch (e) {}
			opts.onStatus && opts.onStatus('Match starting!');
			opts.onMatched && opts.onMatched(matchId, info);
		}
		function roster() { return rosterOf(ch); }
		function seated() { return roster().slice(0, MAX_PLAYERS); }
		function report() {
			if (done) return;
			const all = roster(), seats = all.slice(0, MAX_PLAYERS);
			const host = seats[0] ? seats[0].id : null;
			if (all.findIndex(p => p.id === me) >= MAX_PLAYERS) { opts.onStatus && opts.onStatus('Room ' + codeStr + ' is full (4 players).'); }
			opts.onRoster && opts.onRoster(seats, host, me);
		}
		function start(mode) {
			const seats = seated();
			if (!seats.length || seats[0].id !== me) return 'Only the host can start.';
			if (seats.length < 2) return 'Waiting for at least one more player.';
			mode = mode === 'teams' || mode === 'ffa' ? mode : 'duel';
			if (mode === 'teams' && seats.length !== 4) return '2v2 needs exactly four players.';
			if (mode === 'duel' && seats.length !== 2) return '1v1 needs exactly two players.';
			const order = seats.slice(0, modeSize(mode, seats.length)).map(p => p.id);
			const matchId = 'room-' + codeStr + '-' + Date.now().toString(36);
			ch.send({ type: 'broadcast', event: 'start', payload: { matchId, order, mode } });
			finish(matchId, { slot: 0, n: order.length, mode });
			return null;
		}
		ch.on('presence', { event: 'sync' }, () => setTimeout(report, 50));
		ch.on('broadcast', { event: 'start' }, ({ payload }) => {
			if (!payload) return;
			const order = payload.order || [payload.host, payload.guest];
			const slot = order.indexOf(me);
			if (slot >= 0) finish(payload.matchId, { slot, n: order.length, mode: payload.mode || 'duel' });
		});
		ch.subscribe(async (status) => {
			if (status === 'SUBSCRIBED') { await ch.track({ name, t: Date.now() }); setTimeout(report, 300); }
		});
		return {
			start, roster: seated, code: codeStr,
			cancel() { if (done) return; done = true; try { ch.untrack(); } catch (e) {} try { ch.unsubscribe(); } catch (e) {} }
		};
	}
	/* the old two-player private match: a room that starts by itself as soon as two are in */
	function joinPrivate(rawCode, opts) {
		opts = opts || {};
		let h = null;
		h = openRoom(rawCode, Object.assign({}, opts, {
			onRoster(seats, host, me) {
				if (opts.onRoster) opts.onRoster(seats, host, me);
				if (seats.length >= 2 && host === me && h) h.start('duel');
			}
		}));
		return h;
	}

	/* ---------------- IN-ARENA SYNC ----------------
	   connectMatch(matchId, cfg, handlers) — cfg: { slot, n } (or the legacy side string: left = slot 0).
	   handlers: onConnected(), onPeer(slot), onLeft(slot), onEvent(kind, data, fromSlot), onTransport(kind, slot).
	   send(kind, data, toSlot?) — kind 's' is the state (unordered, may be dropped), everything else is reliable. */
	function cfgOf(cfg) {
		if (typeof cfg === 'string') return { slot: cfg === 'right' ? 1 : 0, n: 2 };
		return { slot: (cfg && cfg.slot) | 0, n: (cfg && cfg.n) || 2 };
	}
	function connectMatch(matchId, cfg, handlers) {
		handlers = handlers || {};
		cfg = cfgOf(cfg);
		const local = !!handlers.local || /[?&]local=1/.test((global.location && global.location.search) || '');
		if (local) return withMesh(cfg, handlers, (h) => connectLocal(matchId, cfg, h));
		const client = sb();
		const stub = { send() {}, leave() {}, peers: () => [], transport: () => 'none' };
		if (!client) return stub;
		return withMesh(cfg, handlers, (h) => connectRelay(client, matchId, cfg, h));
	}
	function connectRelay(client, matchId, cfg, handlers) {
		const me = cfg.slot;
		const topic = 'pvp-match-' + matchId;
		const key = 'p' + me + '-' + myId();
		dropChannel(client, topic);
		try { if (client.realtime && client.realtime.params) client.realtime.params.eventsPerSecond = 60 + 20 * Math.max(0, cfg.n - 2); if (client.realtime) client.realtime.eventsPerSecondLimitMs = 12; } catch (e) {}
		const ch = client.channel(topic, { config: { broadcast: { self: false, ack: false }, presence: { key } } });
		let subscribed = false;
		const peers = new Set();
		const accept = (p) => p && p.f !== me && (p.to == null || p.to === me) && !(p.x && p.x.indexOf(me) >= 0);
		ch.on('broadcast', { event: 's' }, ({ payload }) => { if (accept(payload)) handlers.onEvent && handlers.onEvent('s', payload.s, payload.f); });
		ch.on('broadcast', { event: 'e' }, ({ payload }) => { if (accept(payload)) handlers.onEvent && handlers.onEvent(payload.k, payload.d, payload.f); });
		const slotsIn = (list) => (list || []).map(p => p && p.slot).filter(s => typeof s === 'number' && s !== me);
		ch.on('presence', { event: 'join' }, ({ newPresences }) => {
			for (const s of slotsIn(newPresences)) if (!peers.has(s)) { peers.add(s); handlers.onPeer && handlers.onPeer(s); }
		});
		ch.on('presence', { event: 'leave' }, ({ leftPresences }) => {
			const still = new Set(); const st = ch.presenceState();
			for (const k in st) for (const m of st[k]) if (typeof m.slot === 'number') still.add(m.slot);
			for (const s of slotsIn(leftPresences)) if (!still.has(s) && peers.has(s)) { peers.delete(s); handlers.onLeft && handlers.onLeft(s); }
		});
		ch.subscribe(async (status) => {
			if (status === 'SUBSCRIBED') {
				subscribed = true;
				await ch.track({ slot: me, t: Date.now() });
				handlers.onConnected && handlers.onConnected();
			}
		});
		function send(k, d, to, skip) {
			if (!subscribed) return;      // never before the socket is ready (that would fall back to slow REST)
			const p = { f: me };
			if (to != null) p.to = to;
			if (skip && skip.length) p.x = skip;
			if (k === 's') { p.s = d; ch.send({ type: 'broadcast', event: 's', payload: p }); }
			else { p.k = k; p.d = d; ch.send({ type: 'broadcast', event: 'e', payload: p }); }
		}
		return { send, peers: () => Array.from(peers), leave() { try { ch.untrack(); } catch (e) {} try { ch.unsubscribe(); } catch (e) {} } };
	}

	/* ---------------- DIRECT LINKS (a WebRTC mesh) ----------------
	   The relay (Supabase broadcast, or the local BroadcastChannel) carries the handshakes; each pair of players
	   gets its own direct connection with two data channels:
	     state  — unordered, never retransmitted (a late snapshot is useless: the next one is 50 ms behind it)
	     events — ordered and reliable (casts, blows, round results must all arrive)
	   For each pair the lower slot makes the offer. A link that can't open (strict NAT / firewall) or drops just
	   leaves that pair on the relay. */
	const ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }, { urls: 'stun:stun.cloudflare.com:3478' }];
	function withMesh(cfg, handlers, makeBase) {
		const me = cfg.slot;
		const qs = (global.location && global.location.search) || '';
		const noP2P = /[?&]nop2p=1/.test(qs) || typeof RTCPeerConnection === 'undefined';
		const links = new Map();      // slot -> { pc, dcS, dcE, up, tries, retryT, pending }
		let closed = false;
		const deliver = (k, d, from) => { if (handlers.onEvent) handlers.onEvent(k, d, from); };
		const base = makeBase(Object.assign({}, handlers, {
			onEvent(k, d, from) {
				if (k === 'rtc') { onSignal(from, d); return; }
				deliver(k, d, from);
			},
			onPeer(s) {
				if (!noP2P && me < s) startOffer(s);
				if (handlers.onPeer) handlers.onPeer(s);
			},
			onLeft(s) { teardown(s); links.delete(s); if (handlers.onLeft) handlers.onLeft(s); }
		}));
		function link(s) { let L = links.get(s); if (!L) { L = { pc: null, dcS: null, dcE: null, up: false, tries: 0, retryT: null, pending: [] }; links.set(s, L); } return L; }
		function teardown(s) {
			const L = links.get(s); if (!L) return;
			L.up = false; clearTimeout(L.retryT); L.retryT = null;
			try { L.dcS && L.dcS.close(); } catch (e) {} try { L.dcE && L.dcE.close(); } catch (e) {} try { L.pc && L.pc.close(); } catch (e) {}
			L.pc = L.dcS = L.dcE = null;
		}
		function wire(s, dc) {
			dc.onmessage = (ev) => {
				let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
				if (m && m.k) deliver(m.k, m.d, s);
			};
			dc.onopen = () => check(s);
			dc.onclose = () => { const L = links.get(s); if (L && L.up) { L.up = false; if (handlers.onTransport) handlers.onTransport('relay', s); scheduleRetry(s); } };
		}
		function check(s) {
			const L = links.get(s); if (!L) return;
			const ok = L.dcS && L.dcE && L.dcS.readyState === 'open' && L.dcE.readyState === 'open';
			if (ok && !L.up) { L.up = true; L.tries = 0; if (handlers.onTransport) handlers.onTransport('p2p', s); }
		}
		function newPc(s) {
			teardown(s);
			const L = link(s);
			L.pc = new RTCPeerConnection({ iceServers: ICE });
			L.pc.onicecandidate = (ev) => { if (ev.candidate) base.send('rtc', { c: ev.candidate.toJSON ? ev.candidate.toJSON() : ev.candidate }, s); };
			L.pc.onconnectionstatechange = () => { if (L.pc && (L.pc.connectionState === 'failed' || L.pc.connectionState === 'disconnected')) { if (L.up && handlers.onTransport) handlers.onTransport('relay', s); L.up = false; scheduleRetry(s); } };
			L.pc.ondatachannel = (ev) => { const dc = ev.channel; if (dc.label === 's') L.dcS = dc; else L.dcE = dc; wire(s, dc); };
			return L;
		}
		function scheduleRetry(s) {
			const L = links.get(s);
			if (!L || me > s || closed || L.retryT || L.tries >= 4) return;
			L.retryT = setTimeout(() => { L.retryT = null; if (!L.up) startOffer(s); }, 3000 + L.tries * 2000);
		}
		async function startOffer(s) {
			if (closed) return;
			const L0 = links.get(s); if (L0 && L0.up) return;
			try {
				const L = newPc(s);
				L.tries++;
				L.dcS = L.pc.createDataChannel('s', { ordered: false, maxRetransmits: 0 });
				L.dcE = L.pc.createDataChannel('e', { ordered: true });
				wire(s, L.dcS); wire(s, L.dcE);
				const off = await L.pc.createOffer();
				await L.pc.setLocalDescription(off);
				base.send('rtc', { o: { type: off.type, sdp: off.sdp } }, s);
				scheduleRetry(s);
			} catch (e) { scheduleRetry(s); }
		}
		async function onSignal(s, d) {
			if (!d || closed || noP2P || typeof s !== 'number') return;
			try {
				if (d.o) {      // an offer from a lower slot (a fresh one replaces any old connection with that player)
					if (me < s) return;
					const L = newPc(s);
					await L.pc.setRemoteDescription(d.o);
					const ans = await L.pc.createAnswer();
					await L.pc.setLocalDescription(ans);
					base.send('rtc', { a: { type: ans.type, sdp: ans.sdp } }, s);
					while (L.pending.length) { try { await L.pc.addIceCandidate(L.pending.shift()); } catch (e) {} }
				} else if (d.a) {
					const L = links.get(s); if (!L || !L.pc || me > s) return;
					await L.pc.setRemoteDescription(d.a);
					while (L.pending.length) { try { await L.pc.addIceCandidate(L.pending.shift()); } catch (e) {} }
				} else if (d.c) {
					const L = link(s);
					if (L.pc && L.pc.remoteDescription) { try { await L.pc.addIceCandidate(d.c); } catch (e) {} }
					else L.pending.push(d.c);
				}
			} catch (e) {}
		}
		function sendDirect(L, k, d) {
			try {
				const dc = k === 's' ? L.dcS : L.dcE;
				if (dc && dc.readyState === 'open' && (k !== 's' || dc.bufferedAmount < 16384)) { dc.send(JSON.stringify({ k, d })); return true; }
				if (k === 's') return 'drop';      // a congested state channel drops the snapshot (a fresh one follows)
			} catch (e) {}
			return false;
		}
		function send(k, d, to) {
			if (to != null) {
				const L = links.get(to);
				if (L && L.up) { const r = sendDirect(L, k, d); if (r) return; }
				base.send(k, d, to);
				return;
			}
			// broadcast: straight to every open link, and once through the relay for the others (skipping those)
			const reached = [];
			let others = 0;
			const known = new Set(base.peers ? base.peers() : []);
			for (const [s, L] of links) known.add(s);
			for (const s of known) {
				const L = links.get(s);
				if (L && L.up) { const r = sendDirect(L, k, d); if (r) { reached.push(s); continue; } }
				others++;
			}
			if (others > 0 || !known.size) base.send(k, d, null, reached);
		}
		return {
			send,
			sendState(s) { send('s', s); },
			peers: () => base.peers ? base.peers() : [],
			transport: (s) => {
				if (s != null) { const L = links.get(s); return L && L.up ? 'p2p' : 'relay'; }
				const ups = Array.from(links.values()).filter(L => L.up).length, n = (base.peers ? base.peers().length : 0);
				return n && ups === n ? 'p2p' : ups ? 'mixed' : 'relay';
			},
			leave() { closed = true; for (const s of links.keys()) teardown(s); base.leave(); }
		};
	}

	/* tabs of one browser, no server: a BroadcastChannel with a tiny hello / bye presence (any number of tabs) */
	function connectLocal(matchId, cfg, handlers) {
		const me = cfg.slot;
		const bc = new BroadcastChannel('pvp-local-' + matchId);
		const peers = new Set();
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
			if (m.p === 'hi') { if (!peers.has(m.f)) { peers.add(m.f); post({ f: me, p: 'hi' }); handlers.onPeer && handlers.onPeer(m.f); } return; }
			if (m.p === 'bye') { if (peers.has(m.f)) { peers.delete(m.f); handlers.onLeft && handlers.onLeft(m.f); } return; }
			if (m.to != null && m.to !== me) return;
			if (m.x && m.x.indexOf(me) >= 0) return;
			if (handlers.onEvent) handlers.onEvent(m.k, m.d, m.f);
		}
		setTimeout(() => { handlers.onConnected && handlers.onConnected(); post({ f: me, p: 'hi' }); }, 30);
		global.addEventListener && global.addEventListener('beforeunload', () => post({ f: me, p: 'bye' }));
		function send(k, d, to, skip) { const m = { f: me, k, d }; if (to != null) m.to = to; if (skip && skip.length) m.x = skip; post(m); }
		return { send, peers: () => Array.from(peers), leave() { post({ f: me, p: 'bye' }); try { bc.close(); } catch (e) {} } };
	}

	global.PvPNet = {
		enabled, findCasual, findQueue, openRoom, joinPrivate, connectMatch, matchUrl, createPrivateCode: code4, MAX_PLAYERS,
	};
})(window);
