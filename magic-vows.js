/*
 * BINDING VOWS — a rune family for rune spells (c66).
 * -------------------------------------------------------------------------
 * One rune, "Binding Vow", holds a contract. Every contract has:
 *   condition   what must happen (travel 600 px, wait 2 s, hit three times in a row …)
 *   commitment  what the energy / you give up while it holds (no turning, no splitting, no melee …)
 *   reward      bonus ENERGY for the bound energy, or a STAT change for you
 *   failure     what breaking it costs (energy vows: lose the bonus / lose 35% of the energy / the energy is destroyed)
 *
 * Vows are FREE: the rune costs no mana, does not lengthen the cooldown, and the energy a vow grants never counts
 * against your Max Output (so it never triggers the Total-Mana overdrive cost either). See magic-engine.js:
 * Runes[id].free, outPow(b) and b.vowShare.
 *
 * Four families
 *   energy     bind the energy this branch holds (12 contracts — the original list)
 *   passive    bind yourself while the spell runs (12) — best inside a passive (∞) spell
 *   attribute  give up a way of fighting for Strength / Defense / Mana / Mana Control / Magic Power (15)
 *   exchange   trade one stat for another at uneven rates (6)
 *
 * Rules that keep vows honest
 *   • One contract, one payout. Energy split from a bound body carries the SAME contract; it pays once.
 *   • Bonuses add from the energy's own (un-vowed) part — they never multiply each other — and a body's total vow
 *     bonus is capped at +150% of its own energy (VB.stackCap).
 *   • Passive / attribute effects only exist while their spell runs (a passive spell re-casting keeps its progress
 *     for VB.grace seconds); stat changes are clamped (see clampMods).
 *   • The engine never special-cases a vow: it calls W._vowCast / _vowPre / _vowTick / _vowHit / _vowBody / _vowEnd /
 *     _vowDraw, installed below through MagicEngine.registerWorldHook.
 */
(function(root){
	'use strict';
	const ME = root.MagicEngine;
	if(!ME || !ME.registerWorldHook || !ME.defineRune) return;
	const { defineRune, CATEGORIES, CATEGORY_MAP, CONFIG, Runes, Techniques, bodyRadius, bodyPower, remember, memCount } = ME;
	const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
	const num = (v, d) => { v = Number(v); return isFinite(v) ? v : d; };
	const TAU = Math.PI * 2;

	if(!CATEGORY_MAP.vow){ const c = { id:'vow', label:'Binding Vow', color:'#ffd36b' }; CATEGORIES.push(c); CATEGORY_MAP.vow = c; }

	/* ---------------------------------------------------------------- balance */
	const VB = {
		stackCap: 1.5,                                    // a body's total vow bonus ≤ +150% of its own energy
		failMult: { lose: 1, drain: 1.15, destroy: 1.3 }, // a harsher failure clause makes the promise bigger
		drainLoss: 0.35,                                  // "drain": a broken vow takes this share of the energy
		grace: 2.5,                                       // s a player vow outlives its spell (a passive spell re-casting)
		suspendDefault: 6,
		lockTurn: 0.14,                                   // rad: a path vow breaks when the energy turns more than ~8°
		color: '#ffd36b', colorHot: '#fff2b8', colorBroken: '#ff5d6c'
	};
	const FAILURE = [
		{ value:'lose',    label:'Lose the bonus' },
		{ value:'drain',   label:'Lose 35% of its energy (+15% reward)' },
		{ value:'destroy', label:'The energy is destroyed (+30% reward)' }
	];
	const FAMILIES = [
		{ value:'energy',    label:'Energy vow — binds this energy' },
		{ value:'passive',   label:'Passive vow — binds you over time' },
		{ value:'attribute', label:'Attribute vow — a freedom for a stat' },
		{ value:'exchange',  label:'Exchange vow — one stat for another' }
	];
	const FAMILY_SHORT = { energy:'Energy', passive:'Passive', attribute:'Attribute', exchange:'Exchange' };
	function difficulty(pct){ return pct < 0.12 ? 'Trivial' : pct < 0.32 ? 'Moderate' : pct < 0.62 ? 'Hard' : pct < 0.95 ? 'Extreme' : 'Legendary'; }
	const pctS = (x) => (x >= 0 ? '+' : '') + Math.round(x * 100) + '%';
	const techOpts = () => Techniques.list().map(d => ({ value: d.id, label: d.name }));

	/* ---------------------------------------------------------------- registry */
	const VOWS = {}, ORDER = [];
	function defineVow(v){
		v.params = v.params || [];
		VOWS[v.key] = v; if(ORDER.indexOf(v.key) < 0) ORDER.push(v.key);
		return v;
	}
	/* a vow's own parameters live on the rune as  <vowKey>_<param>  (like technique parameters) */
	function P(p, V){
		const o = {};
		for(const d of V.params){ const v = p ? p[V.key + '_' + d.key] : undefined; o[d.key] = v === undefined ? d.default : v; }
		o.failure = (p && p.failure) || 'lose';
		return o;
	}

	/* =================================================================
	   ENERGY VOWS — the contract rides on the energy body
	   ================================================================= */
	defineVow({ key:'unerring', name:'Vow of the Unerring Path', family:'energy', group:'Trajectory',
		params:[ { key:'minDist', label:'Bonus starts after', type:'int', min:0, max:1500, step:25, default:300, unit:'px' } ],
		maxPct: () => 0.62,
		prog: (s) => s.launched ? s.d / 1500 : 0,
		cond: (q) => 'After it is launched it flies on without ever turning (no Redirect, Rotate, homing, gravity bend or portal).',
		commit: (q) => 'Any change of course breaks the vow.',
		reward: (q) => 'On a hit, after at least ' + q.minDist + ' px: +12% energy, rising to +62% at 1500 px of straight flight.',
		tick(C, b, s, q){
			const sp = Math.hypot(b.vx, b.vy);
			if(!s.launched){ if(sp > 1){ s.launched = true; s.dir = Math.atan2(b.vy, b.vx); s.d = 0; } return; }
			if(s.jumped) return brk(C, 'it was carried through space — its path changed');
			if(sp > 0.8){ const a = Math.abs(wrapA(Math.atan2(b.vy, b.vx) - s.dir)); if(a > VB.lockTurn) return brk(C, 'its path changed'); }
		},
		hit(C, b, e, s, q){
			if(!s.launched || s.d < q.minDist){ end(C, 'struck after only ' + Math.round(s.d) + ' px — no bonus'); return null; }
			return pay(C, b, clamp(0.12 + 0.5 * s.d / 1500, 0.12, 0.62), 'straight ' + Math.round(s.d) + ' px');
		}
	});
	defineVow({ key:'solitude', name:'Vow of Solitude', family:'energy', group:'Restriction',
		params:[ { key:'strict', label:'Forbidden', type:'select', options:[ { value:'body', label:'This energy splitting' }, { value:'spell', label:'Any splitting in the whole spell' } ], default:'body' } ],
		maxPct: (q) => q.strict === 'spell' ? 0.45 : 0.3,
		cond: (q) => 'It stays one single body until it strikes.',
		commit: (q) => q.strict === 'spell' ? 'Nothing in this spell may Split, Divide or be drawn apart after the vow.' : 'It may not Split, Divide or have energy drawn out of it.',
		reward: (q) => 'It leaks 40% less while bound, and gains ' + pctS(q.strict === 'spell' ? 0.45 : 0.3) + ' energy when it strikes.',
		start(C, b){ C.s.maxId = C.W.nextId; },
		tick(C, b, s, q, dt){
			// it holds together: part of what would leak is kept (free vow energy)
			const sp = Math.hypot(b.vx, b.vy);
			const leak = (b.anchored || b.attach ? CONFIG.leakAnchored : (sp > 0.3 ? CONFIG.leakMoving : CONFIG.leakIdle)) * CONFIG.leakScale;
			addFree(b, b.amount * leak * 0.4 * dt);
		},
		pre(C, q){
			// a new body carrying this contract (split / divided from it), or one drawn out of it, breaks it
			for(const o of C.W.bodies){
				if(!o.alive || o.id <= C.s.maxId) continue;
				if(q.strict === 'spell' ? (o.inst === C.inst && memCount(o, 'split') > 0) : ((o.vows && o.vows.indexOf(C) >= 0) || (o.drawnFrom && C._live.some(x => x.id === o.drawnFrom)))) return brk(C, 'the energy was split');
			}
			C.s.maxId = C.W.nextId;
		},
		hit(C, b, e, s, q){ return pay(C, b, q.strict === 'spell' ? 0.45 : 0.3, 'whole'); }
	});
	defineVow({ key:'journey', name:'Vow of the Long Journey', family:'energy', group:'Trajectory',
		params:[ { key:'distance', label:'Must travel', type:'int', min:100, max:3000, step:50, default:600, unit:'px' } ],
		maxPct: (q) => clamp(0.15 + 0.35 * q.distance / 1000, 0.2, 1),
		prog: (s, q) => s.d / q.distance,
		cond: (q) => 'It travels at least ' + q.distance + ' px before striking (portal / teleport jumps do not count).',
		commit: (q) => 'Striking an enemy before that breaks the vow.',
		reward: (q) => 'On a hit: ' + pctS(0.6 * clamp(0.15 + 0.35 * q.distance / 1000, 0.2, 1)) + ' at ' + q.distance + ' px, growing to ' + pctS(clamp(0.15 + 0.35 * q.distance / 1000, 0.2, 1)) + ' at ' + (q.distance * 2) + ' px.',
		hit(C, b, e, s, q){
			if(s.d < q.distance){ brk(C, 'it struck after ' + Math.round(s.d) + ' of ' + q.distance + ' px'); return null; }
			const mx = clamp(0.15 + 0.35 * q.distance / 1000, 0.2, 1);
			return pay(C, b, mx * clamp(0.6 + 0.4 * (s.d - q.distance) / q.distance, 0.6, 1), Math.round(s.d) + ' px');
		}
	});
	defineVow({ key:'patience', name:'Vow of Patience', family:'energy', group:'Execution',
		params:[
			{ key:'time', label:'Wait', type:'float', min:0.5, max:10, step:0.25, default:2, unit:'s' },
			{ key:'still', label:'While waiting', type:'select', options:[ { value:'free', label:'It may move' }, { value:'still', label:'It must hold still (first half)' } ], default:'free' }
		],
		maxPct: (q) => clamp((0.08 + 0.1 * q.time) * (q.still === 'still' ? 1.3 : 1), 0.1, 1),
		prog: (s, q) => s.t / q.time,
		cond: (q) => 'It survives ' + q.time + ' s before dealing any damage' + (q.still === 'still' ? ', holding still for the first ' + (q.time / 2) + ' s' : '') + '.',
		commit: (q) => 'Until then it passes through enemies harmlessly' + (q.still === 'still' ? '; moving too early breaks the vow' : '') + '.',
		reward: (q) => 'Its first hit after the wait: ' + pctS(clamp((0.08 + 0.1 * q.time) * (q.still === 'still' ? 1.3 : 1), 0.1, 1)) + ' energy.',
		tick(C, b, s, q){
			if(s.t >= q.time && C.state === 'active'){ C.state = 'ready'; fx(C, b, VB.colorHot, 'Vow of Patience ready'); }
			if(q.still === 'still' && s.t < q.time / 2 && Math.hypot(b.vx, b.vy) > 0.6) brk(C, 'it moved before its wait was over');
		},
		hit(C, b, e, s, q){
			if(s.t < q.time) return 'pass';
			return pay(C, b, clamp((0.08 + 0.1 * q.time) * (q.still === 'still' ? 1.3 : 1), 0.1, 1), q.time + ' s wait');
		}
	});
	defineVow({ key:'finalFragment', name:'Vow of the Final Fragment', family:'energy', group:'Execution',
		params:[],
		maxPct: (q, n) => clamp(0.15 + 0.06 * (n || 0), 0.15, 1),
		cond: (q) => 'Every other branch of this spell finishes its runes while this energy survives.',
		commit: (q) => 'It may not strike before the rest of the spell is done.',
		reward: (q, n) => 'The surviving energy gains +15%, +6% for every rune elsewhere in the spell' + (n != null ? ' (here ' + pctS(clamp(0.15 + 0.06 * n, 0.15, 1)) + ')' : '') + ', paid the moment the spell is done.',
		start(C, b, api, br){ C.s.others = othersCount(api.instance.def, C.nodeId); },
		pre(C, q){
			if(C.state !== 'active') return;
			const inst = C.instRef; if(!inst) return;
			for(const o of inst.branches){
				if(o.state === 'done') continue;
				if(o.ctx && ((o.ctx.body && o.ctx.body.vows && o.ctx.body.vows.indexOf(C) >= 0) || (o.ctx.group && o.ctx.group.some(m => m.body && m.body.vows && m.body.vows.indexOf(C) >= 0)))) continue;
				return;
			}
			const b = strongest(C); if(!b) return;
			pay(C, b, clamp(0.15 + 0.06 * C.s.others, 0.15, 1), 'the spell is complete');
		},
		hit(C, b, e, s, q){ if(C.state === 'active'){ brk(C, 'it struck before the rest of the spell was done'); } return null; }
	});
	defineVow({ key:'gauntlet', name:'Vow of the Gauntlet', family:'energy', group:'Trajectory',
		params:[ { key:'gates', label:'Gates to pass', type:'int', min:1, max:8, step:1, default:3 } ],
		maxPct: (q) => clamp(0.15 * q.gates, 0.15, 1.1),
		prog: (s, q) => (s.g || []).length / q.gates,
		cond: (q) => 'It passes through ' + q.gates + ' different gates of yours before striking: your zones, your constructs, or your own energy holding still / anchored.',
		commit: (q) => 'Portal shortcuts break it, and striking before all ' + q.gates + ' gates breaks it.',
		reward: (q) => '+15% energy per gate on the hit (here ' + pctS(clamp(0.15 * q.gates, 0.15, 1.1)) + ').',
		tick(C, b, s, q){
			if(s.jumped) return brk(C, 'it took a portal shortcut');
			const G = gatesFor(C.W, C.ownerId), r = bodyRadius(b);
			s.g = s.g || [];
			for(const g of G){
				if(g.ref === b || (g.ref && g.ref.vows && g.ref.vows.indexOf(C) >= 0) || s.g.indexOf(g.id) >= 0) continue;
				const dx = g.x - b.x, dy = g.y - b.y;
				if(dx * dx + dy * dy <= (g.r + r * 0.5) * (g.r + r * 0.5)){ s.g.push(g.id); C.prog = Math.min(1, s.g.length / q.gates); fx(C, b, VB.color, 'Gate ' + s.g.length + ' / ' + q.gates); }
			}
		},
		hit(C, b, e, s, q){
			const n = (s.g || []).length;
			if(n < q.gates){ brk(C, 'it struck after ' + n + ' of ' + q.gates + ' gates'); return null; }
			return pay(C, b, clamp(0.15 * q.gates, 0.15, 1.1), q.gates + ' gates');
		}
	});
	defineVow({ key:'namedPrey', name:'Vow of the Named Prey', family:'energy', group:'Target',
		params:[ { key:'others', label:'Other enemies', type:'select', options:[ { value:'cancel', label:'Striking one breaks the vow' }, { value:'pass', label:'It passes through them unharmed' } ], default:'cancel' } ],
		maxPct: (q) => q.others === 'pass' ? 0.8 : 0.6,
		cond: (q) => 'It strikes the enemy this branch is targeting when the vow is made.',
		commit: (q) => q.others === 'pass' ? 'It cannot harm anyone else on the way — it passes through other enemies.' : 'Striking any other enemy first breaks the vow.',
		reward: (q) => 'Hitting its sworn prey: ' + pctS(q.others === 'pass' ? 0.8 : 0.6) + ' energy.',
		analyze(q, a, node){ if(a.ctx.target !== 'enemy') a.error(node, 'VOW_PREY', 'Vow of the Named Prey needs an enemy target earlier in this branch (Target → Enemy)'); },
		start(C, b, api, br){
			const t = br.ctx.target;
			if(!t || t.kind !== 'enemy' || !t.ref) return 'No enemy to swear it on';
			C.s.prey = t.ref;
		},
		pre(C){ const e = C.s.prey; if(C.state === 'active' && (!e || e.dead || (e.hp != null && e.hp <= 0))) end(C, 'its prey is gone'); },
		hit(C, b, e, s, q){
			if(e === C.s.prey) return pay(C, b, q.others === 'pass' ? 0.8 : 0.6, 'sworn prey');
			if(q.others === 'pass') return 'pass';
			brk(C, 'it struck someone other than its sworn prey'); return null;
		}
	});
	defineVow({ key:'untouched', name:'Vow of the Untouched', family:'energy', group:'Restriction',
		params:[ { key:'time', label:'Survive', type:'float', min:1, max:10, step:0.5, default:3, unit:'s' } ],
		maxPct: (q) => clamp(0.15 + 0.1 * q.time, 0.2, 1),
		prog: (s, q) => s.t / q.time,
		cond: (q) => 'It survives ' + q.time + ' s untouched by hostile magic, then reaches its target.',
		commit: (q) => 'Breaks if it touches Anti-Magic, another caster\'s energy or projectiles, or an enemy\'s gravity / portal takes hold of it.',
		reward: (q) => 'Its hit after ' + q.time + ' s: ' + pctS(clamp(0.15 + 0.1 * q.time, 0.2, 1)) + ' energy (an earlier hit simply earns nothing).',
		start(C, b){ C.s.am = amCount(b); },
		tick(C, b, s, q){
			if(amCount(b) > C.s.am || b.hostile) return brk(C, b.hostile ? 'a hostile force took hold of it' : 'Anti-Magic touched it');
			if(touchedForeign(C.W, b)) return brk(C, 'another caster\'s magic touched it');
			if(s.t >= q.time && C.state === 'active'){ C.state = 'ready'; fx(C, b, VB.colorHot, 'Untouched — ready'); }
		},
		hit(C, b, e, s, q){
			if(C.state !== 'ready'){ end(C, 'struck before ' + q.time + ' s — no bonus'); return null; }
			return pay(C, b, clamp(0.15 + 0.1 * q.time, 0.2, 1), 'untouched ' + q.time + ' s');
		}
	});
	defineVow({ key:'sacrifice', name:'Vow of Sacrifice', family:'energy', group:'Resource',
		params:[
			{ key:'what', label:'Sacrifice', type:'select', options:[ { value:'spell', label:'Part of the rest of this spell' }, { value:'health', label:'Part of your health' } ], default:'spell' },
			{ key:'pct', label:'Portion', type:'int', min:10, max:60, step:5, default:30, unit:'%' }
		],
		maxPct: (q) => q.what === 'health' ? clamp(q.pct / 100 * 2, 0.2, 1.2) : 0.5,
		cond: (q) => q.what === 'health' ? 'You give up ' + q.pct + '% of your current health when the vow is made.' : 'The rest of this spell gives up ' + q.pct + '% of its energy (what is still unspent and every other piece of it).',
		commit: (q) => 'The sacrifice is permanent, even if the energy later dies.',
		reward: (q) => q.what === 'health' ? 'This energy gains ' + pctS(clamp(q.pct / 100 * 2, 0.2, 1.2)) + ' at once.' : 'This energy gains 1.6 × the energy given up, at once (up to +150%).',
		start(C, b, api, br){
			const q = C.q;
			if(q.what === 'health'){
				const got = C.W.host.vowSacrificeHealth ? num(C.W.host.vowSacrificeHealth(api.owner, q.pct / 100), 0) : (C.W.host.hurtCaster && api.owner.entity ? (C.W.host.hurtCaster(api.owner.entity, 1, {}), q.pct / 100) : 0);
				if(!(got > 0)) return 'No health to give';
				payAbs(C, b, b.amount * (1 - (b.vowShare || 0)) * clamp(q.pct / 100 * 2, 0.2, 1.2), 'blood');
				return;
			}
			const inst = api.instance, k = q.pct / 100;
			let taken = inst.budget > 0 ? inst.budget * k : 0;
			inst.budget -= taken;
			for(const o of C.W.bodies){
				if(!o.alive || o === b || o.inst !== inst.id || o.isZone || o.zoneBlob || (o.vows && o.vows.indexOf(C) >= 0)) continue;
				const t = o.amount * k; o.amount -= t; taken += t;
			}
			if(taken < 1) return 'Nothing else in the spell to sacrifice';
			payAbs(C, b, taken * 1.6, 'sacrificed ' + Math.round(taken) + ' E');
		}
	});
	defineVow({ key:'sequence', name:'Vow of the Perfect Sequence', family:'energy', group:'Execution',
		params:[
			{ key:'count', label:'Hits in sequence', type:'int', min:2, max:6, step:1, default:3 },
			{ key:'window', label:'Within', type:'float', min:0.5, max:5, step:0.25, default:2, unit:'s' },
			{ key:'same', label:'Target', type:'select', options:[ { value:'any', label:'Any enemies' }, { value:'same', label:'The same enemy' } ], default:'any' }
		],
		maxPct: (q) => clamp(0.12 + 0.17 * (q.count - 1) * (q.same === 'same' ? 1.15 : 1) * (2 / Math.max(1, q.window)) ** 0.25, 0.25, 1.1),
		cond: (q) => 'It is the last of ' + q.count + ' different pieces of this spell to strike ' + (q.same === 'same' ? 'the same enemy' : 'enemies') + ' within ' + q.window + ' s.',
		commit: (q) => 'If it strikes before the other ' + (q.count - 1) + ' have, the vow breaks.',
		reward: (q) => 'The finishing hit: ' + pctS(clamp(0.12 + 0.17 * (q.count - 1) * (q.same === 'same' ? 1.15 : 1) * (2 / Math.max(1, q.window)) ** 0.25, 0.25, 1.1)) + ' energy.',
		start(C){ const inst = C.instRef; if(inst) inst._vowSeq = true; },
		hit(C, b, e, s, q){
			const inst = C.instRef, H = (inst && inst._vowHits) || [], t = C.W.time, seen = new Set();
			for(const h of H) if(t - h.t <= q.window && h.bid !== b.id && (q.same !== 'same' || h.e === e)) seen.add(h.bid);
			if(seen.size + 1 < q.count){ brk(C, 'it struck as hit ' + (seen.size + 1) + ' of ' + q.count); return null; }
			return pay(C, b, clamp(0.12 + 0.17 * (q.count - 1) * (q.same === 'same' ? 1.15 : 1) * (2 / Math.max(1, q.window)) ** 0.25, 0.25, 1.1), q.count + '-hit sequence');
		}
	});
	defineVow({ key:'stillness', name:'Vow of Stillness', family:'energy', group:'Restriction',
		params:[
			{ key:'radius', label:'Stay within', type:'int', min:20, max:300, step:10, default:80, unit:'px' },
			{ key:'time', label:'For', type:'float', min:0.5, max:8, step:0.25, default:2, unit:'s' }
		],
		maxPct: (q) => clamp((0.1 + 0.12 * q.time) * (q.radius <= 50 ? 1.2 : 1), 0.15, 1),
		cond: (q) => 'You stay within ' + q.radius + ' px of where you made the vow for ' + q.time + ' s.',
		commit: (q) => 'Stepping out breaks it.',
		reward: (q) => 'When the time is up the bound energy gains ' + pctS(clamp((0.1 + 0.12 * q.time) * (q.radius <= 50 ? 1.2 : 1), 0.15, 1)) + ' at once.',
		start(C, b, api){ const c = api.casterPos(); C.s.ax = c.x; C.s.ay = c.y; C.s.t = 0; },
		pre(C, q, dt){
			if(C.state !== 'active') return;
			const inst = C.instRef, e = C.owner && C.owner.entity;
			if(e){ const cx = e.x + (e.w || 0) / 2, cy = e.y + (e.h || 0) / 2; if(Math.hypot(cx - C.s.ax, cy - C.s.ay) > q.radius) return brk(C, 'you moved'); }
			C.s.t += dt; C.prog = Math.min(1, C.s.t / q.time);
			if(C.s.t >= q.time){ const b = strongest(C); if(b) pay(C, b, clamp((0.1 + 0.12 * q.time) * (q.radius <= 50 ? 1.2 : 1), 0.15, 1), 'you held still'); }
		}
	});
	defineVow({ key:'compression', name:'Vow of Absolute Compression', family:'energy', group:'Restriction',
		params:[ { key:'level', label:'Compression', type:'int', min:5, max:40, step:1, default:15 } ],
		maxPct: (q) => clamp(0.1 + 0.022 * q.level, 0.15, 0.9) * 0.75,
		prog: (s, q, b) => s.reached ? 1 : (b.comp || 0) / q.level,
		cond: (q) => 'It reaches compression ' + q.level + ' (Compress rune) and keeps it until it strikes.',
		commit: (q) => 'Expanding it, or striking before it reaches ' + q.level + ', breaks the vow.',
		reward: (q) => 'On the hit: ' + pctS(clamp(0.1 + 0.022 * q.level, 0.15, 0.9) * 0.75) + ' (kept modest: compression already strengthens it).',
		tick(C, b, s, q){
			if(b.comp >= q.level){ if(!s.reached){ s.reached = true; C.state = 'ready'; fx(C, b, VB.colorHot, 'Compression held'); } }
			else if(s.reached && b.comp < q.level - 0.5) brk(C, 'its compression was undone');
		},
		hit(C, b, e, s, q){
			if(!s.reached){ brk(C, 'it struck before reaching compression ' + q.level); return null; }
			return pay(C, b, clamp(0.1 + 0.022 * q.level, 0.15, 0.9) * 0.75, 'compression ' + q.level);
		}
	});

	/* =================================================================
	   PLAYER VOWS — passive, attribute and exchange. They bind YOU while their spell runs.
	   mods(C, q, M) adds to the shared stat block M (see emptyMods); onCast / onMelee react to what you do.
	   ================================================================= */
	const STYLE_OPTS = [ { value:'melee', label:'Melee only (no active spells)' }, { value:'spells', label:'Spells only (no melee)' }, { value:'passive', label:'Passive magic only (no attacks)' } ];
	const SEAL_OPTS = () => [ { value:'anyTech', label:'Every technique' } ].concat(techOpts()).concat([
		{ value:'split', label:'Split and Divide' }, { value:'compress', label:'Compression' }, { value:'zone', label:'Zones (Create Zone, Draw Out, Domain)' }, { value:'reinforce', label:'Reinforcement' }, { value:'construction', label:'Constructs' } ]);
	function usesSealed(info, what){
		if(what === 'anyTech') return info.techs.size > 0;
		if(what === 'split') return info.types.has('split') || info.types.has('divide');
		if(what === 'compress') return info.types.has('compress');
		if(what === 'zone') return info.types.has('zone') || info.types.has('drawOut') || info.types.has('domain');
		if(what === 'reinforce') return info.types.has('reinforce');
		return info.techs.has(what);
	}
	function suspend(C, secs, why){ if(!(C.sus > 0)) note(C, 'suspended — ' + why); C.sus = Math.max(C.sus || 0, secs); C.s.ramp = 0; }
	const isAttack = (info) => !info.passive;      // any active cast counts as initiating an attack

	defineVow({ key:'stillMind', name:'Vow of the Still Mind', family:'passive', group:'Mana recovery',
		params:[
			{ key:'mode', label:'Reward', type:'select', options:[ { value:'regen', label:'Faster mana regeneration' }, { value:'reserve', label:'A charge for your next spell' } ], default:'regen' },
			{ key:'time', label:'Builds over', type:'float', min:2, max:20, step:0.5, default:6, unit:'s' }
		],
		cond: (q) => 'You cast no active spell.',
		commit: (q) => 'Casting resets what has built up.',
		reward: (q) => q.mode === 'reserve' ? 'Builds a charge of up to +40% energy for your next spell over ' + q.time + ' s.' : 'Mana regeneration rises to +150% over ' + q.time + ' s of quiet.',
		maxPct: () => 0.4,
		pre(C, q, dt){ C.s.quiet = (C.s.quiet || 0) + dt; C.prog = clamp(C.s.quiet / q.time, 0, 1); },
		mods(C, q, M){ if(q.mode !== 'reserve') M.regen *= 1 + 1.5 * C.prog; },
		onCast(C, q, info){ if(info.passive) return null; const r = q.mode === 'reserve' ? 0.4 * C.prog : 0; C.s.quiet = 0; C.prog = 0; return r > 0.01 ? { boost: r } : null; }
	});
	defineVow({ key:'immovable', name:'Vow of Immovable Resolve', family:'passive', group:'Defense',
		params:[
			{ key:'radius', label:'Hold within', type:'int', min:40, max:400, step:10, default:120, unit:'px' },
			{ key:'time', label:'Builds over', type:'float', min:1, max:10, step:0.5, default:4, unit:'s' }
		],
		cond: (q) => 'You stay within ' + q.radius + ' px of where you took your stand.',
		commit: (q) => 'Leaving ends the bonus; after 2 s you take a new stand where you are.',
		reward: (q) => 'Damage taken falls by up to ' + Math.round(40 * (q.radius < 80 ? 1.15 : 1)) + '% over ' + q.time + ' s.',
		pre(C, q, dt, Pl){
			if(!Pl) return;
			if(C.s.rec > 0){ C.s.rec -= dt; if(C.s.rec <= 0){ C.s.ax = Pl.x; C.s.ay = Pl.y; C.s.held = 0; } C.prog = 0; return; }
			if(C.s.ax == null){ C.s.ax = Pl.x; C.s.ay = Pl.y; C.s.held = 0; }
			if(Math.hypot(Pl.x - C.s.ax, Pl.y - C.s.ay) > q.radius){ C.s.rec = 2; C.s.held = 0; note(C, 'you left your stand'); C.prog = 0; return; }
			C.s.held += dt; C.prog = clamp(C.s.held / q.time, 0, 1);
		},
		mods(C, q, M){ M.def *= 1 - 0.4 * (q.radius < 80 ? 1.15 : 1) * C.prog; }
	});
	defineVow({ key:'dormant', name:'Vow of Dormant Power', family:'passive', group:'Stored potential',
		params:[ { key:'limit', label:'Keep spells under', type:'int', min:20, max:80, step:5, default:40, unit:'% of Max Output' } ],
		cond: (q) => 'Every spell you cast stays under ' + q.limit + '% of your Max Output.',
		commit: (q) => 'The first spell that goes over releases everything stored into itself.',
		reward: (q) => 'Stores up to ' + pctS(0.25 + 0.6 * (1 - q.limit / 100)) + ' energy over 20 s, unleashed by your next big spell.',
		pre(C, q, dt){ const cap = 0.25 + 0.6 * (1 - q.limit / 100); C.s.res = Math.min(cap, (C.s.res || 0) + cap / 20 * dt); C.prog = C.s.res / cap; },
		onCast(C, q, info){
			if(info.passive) return null;
			if(info.peak <= q.limit / 100 * info.max) return null;
			const r = C.s.res || 0; C.s.res = 0; C.prog = 0;
			if(r > 0.02) note(C, 'released ' + pctS(r));
			return r > 0.01 ? { boost: r } : null;
		}
	});
	defineVow({ key:'sealedHand', name:'Vow of the Sealed Hand', family:'passive', group:'Specialisation',
		params:[
			{ key:'seal', label:'Never use', type:'select', options: SEAL_OPTS, default:'anyTech' },
			{ key:'reward', label:'Reward', type:'select', options:[ { value:'power', label:'Magic Power' }, { value:'efficiency', label:'Cheaper spells' } ], default:'power' }
		],
		cond: (q) => 'None of your spells use: ' + ME.labelOf(SEAL_OPTS(), q.seal) + '.',
		commit: (q) => 'Casting one that does switches the vow off for 20 s.',
		reward: (q) => { const big = q.seal === 'anyTech'; return q.reward === 'efficiency' ? 'Your spells cost ' + (big ? 25 : 12) + '% less.' : 'Magic Power ' + pctS(big ? 0.3 : 0.15) + '.'; },
		onCast(C, q, info){ if(usesSealed(info, q.seal)) suspend(C, 20, 'you used ' + ME.labelOf(SEAL_OPTS(), q.seal)); return null; },
		mods(C, q, M){ const big = q.seal === 'anyTech'; if(q.reward === 'efficiency') M.cost *= big ? 0.75 : 0.88; else M.power *= 1 + (big ? 0.3 : 0.15); }
	});
	defineVow({ key:'singularPurpose', name:'Vow of Singular Purpose', family:'passive', group:'Specialisation',
		params:[ { key:'style', label:'You fight with', type:'select', options: STYLE_OPTS, default:'spells' } ],
		cond: (q) => ME.labelOf(STYLE_OPTS, q.style) + '.',
		commit: (q) => 'Using another style switches the vow off for 6 s.',
		reward: (q) => q.style === 'melee' ? 'Strength +30%.' : q.style === 'spells' ? 'Magic Power +20%, spells 10% cheaper.' : 'Damage taken −15%, mana regeneration +30%.',
		onCast(C, q, info){ if(!info.passive && q.style !== 'spells') suspend(C, 6, 'you cast an active spell'); return null; },
		onMelee(C, q){ if(q.style !== 'melee') suspend(C, 6, 'you attacked in melee'); },
		mods(C, q, M){ if(q.style === 'melee') M.str += 0.3; else if(q.style === 'spells'){ M.power *= 1.2; M.cost *= 0.9; } else { M.def *= 0.85; M.regen *= 1.3; } }
	});
	defineVow({ key:'unarmedSage', name:'Vow of the Unarmed Sage', family:'passive', group:'Melee and magic',
		params:[],
		cond: () => 'Your hands stay empty: no weapon and no magical item in the slot you are using.',
		commit: () => 'Holding one switches the vow off until 3 s after you put it away.',
		reward: () => 'Strength +40% for your bare-handed blows.',
		pre(C, q, dt, Pl){ if(Pl && Pl.weapon && Pl.weapon !== 'none') suspend(C, 3, 'you hold a weapon'); },
		mods(C, q, M){ M.str += 0.4; }
	});
	defineVow({ key:'firstSpark', name:'Vow of the First Spark', family:'passive', group:'Stored potential',
		params:[ { key:'time', label:'Silence before it', type:'float', min:2, max:12, step:0.5, default:5, unit:'s' } ],
		cond: (q) => 'You cast nothing for ' + q.time + ' s.',
		commit: (q) => 'Only the first spell after the silence is empowered; casting sooner earns nothing.',
		reward: (q) => 'That spell gains ' + pctS(clamp(0.1 + 0.04 * q.time, 0.15, 0.6)) + ' energy.',
		pre(C, q, dt){ C.s.quiet = (C.s.quiet || 0) + dt; C.prog = clamp(C.s.quiet / q.time, 0, 1); },
		onCast(C, q, info){ if(info.passive) return null; const ready = C.prog >= 1; C.s.quiet = 0; C.prog = 0; return ready ? { boost: clamp(0.1 + 0.04 * q.time, 0.15, 0.6) } : null; }
	});
	defineVow({ key:'conservation', name:'Vow of Conservation', family:'passive', group:'Efficiency',
		params:[ { key:'limit', label:'Never exceed', type:'int', min:20, max:90, step:5, default:50, unit:'% of Max Output' } ],
		cond: (q) => 'No spell you cast goes over ' + q.limit + '% of your Max Output.',
		commit: (q) => 'A bigger spell switches the vow off for 8 s.',
		reward: (q) => 'Spells cost ' + Math.round(100 * clamp(0.35 * (1 - q.limit / 100) + 0.05, 0.08, 0.32)) + '% less.',
		onCast(C, q, info){ if(!info.passive && info.peak > q.limit / 100 * info.max) suspend(C, 8, 'a spell went over ' + q.limit + '%'); return null; },
		mods(C, q, M){ M.cost *= 1 - clamp(0.35 * (1 - q.limit / 100) + 0.05, 0.08, 0.32); }
	});
	defineVow({ key:'loneStar', name:'Vow of the Lone Star', family:'passive', group:'Energy concentration',
		params:[ { key:'count', label:'At most', type:'int', min:1, max:6, step:1, default:2, unit:'bodies' } ],
		cond: (q) => 'You never have more than ' + q.count + ' of your energy bodies in the world at once.',
		commit: (q) => 'More than that switches the vow off until 2 s after you are back under.',
		reward: (q) => 'Magic Power ' + pctS(Math.max(0.04, 0.36 - 0.06 * q.count)) + '.',
		pre(C, q){ let n = 0; for(const o of C.W.bodies) if(o.alive && o.ownerId === C.ownerId && !o.isZone && !o.zoneBlob && !o.emitted && !o.drawing) n++; if(n > q.count) suspend(C, 2, n + ' energies at once'); },
		mods(C, q, M){ M.power *= 1 + Math.max(0.04, 0.36 - 0.06 * q.count); }
	});
	defineVow({ key:'patientGuardian', name:'Vow of the Patient Guardian', family:'passive', group:'Defense',
		params:[ { key:'time', label:'Builds over', type:'float', min:2, max:15, step:0.5, default:6, unit:'s' } ],
		cond: (q) => 'You start no attack — no active spell, no melee.',
		commit: (q) => 'Attacking resets it.',
		reward: (q) => 'Damage taken falls by up to 35% over ' + q.time + ' s.',
		pre(C, q, dt){ C.s.calm = (C.s.calm || 0) + dt; C.prog = clamp(C.s.calm / q.time, 0, 1); },
		onCast(C, q, info){ if(isAttack(info)){ C.s.calm = 0; C.prog = 0; } return null; },
		onMelee(C){ C.s.calm = 0; C.prog = 0; },
		mods(C, q, M){ M.def *= 1 - 0.35 * C.prog; }
	});
	defineVow({ key:'unbrokenThread', name:'Vow of the Unbroken Thread', family:'passive', group:'Efficiency',
		params:[],
		cond: () => 'The passive (∞) spell holding this vow keeps running.',
		commit: () => 'Turning it off ends the vow and loses what it built.',
		reward: () => 'That passive spell drains up to 30% less, reached over 20 s.',
		analyzeNote: 'Put it in a passive (∞) spell.',
		start(C){ if(!C.instRef || !C.instRef.passive) return 'The Unbroken Thread only binds a passive (∞) spell'; },
		pre(C, q, dt){ C.s.held = (C.s.held || 0) + dt; C.prog = clamp(C.s.held / 20, 0, 1); },
		passiveMult(C){ return 1 - 0.3 * C.prog; }
	});
	defineVow({ key:'narrowGate', name:'Vow of the Narrow Gate', family:'passive', group:'Efficiency',
		params:[
			{ key:'mode', label:'Limit', type:'select', options:[ { value:'techs', label:'Techniques per spell' }, { value:'branches', label:'Branch points per spell' } ], default:'techs' },
			{ key:'max', label:'At most', type:'int', min:0, max:4, step:1, default:1 }
		],
		cond: (q) => 'Your spells use at most ' + q.max + ' ' + (q.mode === 'techs' ? 'different technique' + (q.max === 1 ? '' : 's') : 'branch point' + (q.max === 1 ? '' : 's') + ' (a rune with 2+ children)') + '.',
		commit: (q) => 'Casting a wider spell switches the vow off for 6 s.',
		reward: (q) => 'Mana Control +3 and qualifying spells cost 15% less.',
		onCast(C, q, info){ if(!info.passive && (q.mode === 'techs' ? info.techs.size : info.branches) > q.max) suspend(C, 6, 'a wider spell'); return null; },
		mods(C, q, M){ M.ctrl += 3; },
		costFor(C, q, info){ return (q.mode === 'techs' ? info.techs.size : info.branches) <= q.max ? 0.85 : 1; }
	});

	/* ---- attribute vows ---- */
	const RANGED = (info) => info.types.has('redirect') || info.types.has('force');
	defineVow({ key:'ironFist', name:'Vow of the Iron Fist', family:'attribute', stat:'Strength', group:'Strength',
		params:[ { key:'strict', label:'Also give up', type:'select', options:[ { value:'no', label:'Nothing else' }, { value:'yes', label:'Ranged spells (Redirect / Force)' } ], default:'no' } ],
		cond: (q) => 'You use no magical weapon' + (q.strict === 'yes' ? ' and cast no spell that throws energy (Redirect / Force)' : '') + '.',
		commit: (q) => 'Breaking it switches the vow off for ' + (q.strict === 'yes' ? 8 : 4) + ' s.',
		reward: (q) => 'Strength ' + pctS(q.strict === 'yes' ? 0.45 : 0.25) + '.',
		pre(C, q, dt, Pl){ if(Pl && Pl.weapon === 'magic') suspend(C, 4, 'a magical weapon in hand'); },
		onCast(C, q, info){ if(q.strict === 'yes' && !info.passive && RANGED(info)) suspend(C, 8, 'a ranged spell'); return null; },
		mods(C, q, M){ M.str += q.strict === 'yes' ? 0.45 : 0.25; }
	});
	defineVow({ key:'duelist', name:'Vow of the Duelist', family:'attribute', stat:'Strength', group:'Strength',
		params:[
			{ key:'range', label:'Fight within', type:'int', min:60, max:400, step:10, default:180, unit:'px' },
			{ key:'sustain', label:'Sustained', type:'select', options:[ { value:'no', label:'No' }, { value:'yes', label:'Stronger after 4 s close' } ], default:'yes' }
		],
		cond: (q) => 'The nearest enemy is within ' + q.range + ' px, and you throw no energy at it.',
		commit: (q) => 'A spell that throws energy switches the vow off for 4 s.',
		reward: (q) => 'Strength +30% while close' + (q.sustain === 'yes' ? ', +50% after 4 s close' : '') + '.',
		pre(C, q, dt, Pl){
			const near = Pl && Pl.nearestEnemy != null ? Pl.nearestEnemy : Infinity;
			if(near <= q.range){ C.s.close = (C.s.close || 0) + dt; C.prog = q.sustain === 'yes' ? clamp(C.s.close / 4, 0, 1) : 1; }
			else { C.s.close = 0; C.prog = 0; }
		},
		onCast(C, q, info){ if(!info.passive && RANGED(info)) suspend(C, 4, 'you threw energy'); return null; },
		mods(C, q, M){ if(C.prog <= 0) return; M.str += 0.3 + (q.sustain === 'yes' && C.prog >= 1 ? 0.2 : 0); }
	});
	defineVow({ key:'physicalMastery', name:'Vow of Physical Mastery', family:'attribute', stat:'Strength', group:'Strength',
		params:[ { key:'give', label:'Give up reinforcing', type:'select', options:[ { value:'weapon', label:'Your weapon' }, { value:'arms', label:'Your arms' }, { value:'legs', label:'Your legs' }, { value:'self', label:'Yourself' } ], default:'weapon' } ],
		cond: (q) => 'You never reinforce ' + (q.give === 'self' ? 'yourself' : 'your ' + q.give) + '.',
		commit: (q) => 'While such a reinforcement holds, the vow is off.',
		reward: (q) => 'Strength +30% and your blows knock back 20% harder.',
		pre(C, q){ for(const st of C.W.reinf) if(st.ownerId === C.ownerId && !st.item && st.kind === q.give) return suspend(C, 1, 'you reinforced ' + q.give); },
		mods(C, q, M){ M.str += 0.3; M.kb *= 1.2; }
	});
	defineVow({ key:'unbrokenGuard', name:'Vow of the Unbroken Guard', family:'attribute', stat:'Defense', group:'Defense',
		params:[ { key:'hold', label:'Guarding', type:'select', options:[ { value:'free', label:'Anywhere' }, { value:'hold', label:'Holding a spot (150 px)' } ], default:'free' } ],
		cond: (q) => 'You start no attack' + (q.hold === 'hold' ? ' and hold your spot' : '') + '.',
		commit: (q) => 'Attacking switches the vow off for 4 s' + (q.hold === 'hold' ? '; leaving your spot resets it' : '') + '.',
		reward: (q) => 'Damage taken −' + (q.hold === 'hold' ? 45 : 30) + '% (builds over 3 s).',
		pre(C, q, dt, Pl){
			if(q.hold === 'hold' && Pl){ if(C.s.ax == null){ C.s.ax = Pl.x; C.s.ay = Pl.y; } if(Math.hypot(Pl.x - C.s.ax, Pl.y - C.s.ay) > 150){ C.s.ax = Pl.x; C.s.ay = Pl.y; C.s.ramp = 0; } }
			C.s.ramp = Math.min(3, (C.s.ramp || 0) + dt); C.prog = C.s.ramp / 3;
		},
		onCast(C, q, info){ if(isAttack(info)) suspend(C, 4, 'you attacked'); return null; },
		onMelee(C){ suspend(C, 4, 'you attacked'); },
		mods(C, q, M){ M.def *= 1 - (q.hold === 'hold' ? 0.45 : 0.3) * C.prog; }
	});
	defineVow({ key:'openGate', name:'Vow of the Open Gate', family:'attribute', stat:'Defense', group:'Defense',
		params:[],
		cond: () => 'You give up dashing.',
		commit: () => 'Your dash is sealed while the vow holds.',
		reward: () => 'Damage taken −25%.',
		mods(C, q, M){ M.def *= 0.75; M.noDash = true; }
	});
	defineVow({ key:'lastStand', name:'Vow of the Last Stand', family:'attribute', stat:'Defense', group:'Defense',
		params:[ { key:'threshold', label:'Full strength at', type:'int', min:10, max:60, step:5, default:30, unit:'% health' } ],
		cond: (q) => 'Your health falls toward ' + q.threshold + '%.',
		commit: (q) => 'At full health it gives nothing.',
		reward: (q) => 'Damage taken falls by up to ' + Math.round(100 * clamp(0.25 + 0.4 * (1 - q.threshold / 60), 0.25, 0.5)) + '%, at full strength at or under ' + q.threshold + '% health.',
		pre(C, q, dt, Pl){ const hp = Pl && Pl.hp != null ? Pl.hp : 1, th = q.threshold / 100; C.prog = clamp((1 - hp) / Math.max(0.05, 1 - th), 0, 1); },
		mods(C, q, M){ M.def *= 1 - clamp(0.25 + 0.4 * (1 - q.threshold / 60), 0.25, 0.5) * C.prog; }
	});
	defineVow({ key:'deepReservoir', name:'Vow of the Deep Reservoir', family:'attribute', stat:'Mana', group:'Mana',
		params:[ { key:'pct', label:'Seal away', type:'int', min:10, max:40, step:5, default:25, unit:'% of mana' } ],
		cond: (q) => q.pct + '% of your mana is sealed: you can never spend below it.',
		commit: (q) => 'The sealed part is never spendable — it is not a second pool.',
		reward: (q) => 'Maximum mana ' + pctS(1.8 * q.pct / 100) + '.',
		mods(C, q, M){ M.mana *= 1 + 1.8 * q.pct / 100; M.reserve = Math.max(M.reserve, q.pct / 100); }
	});
	defineVow({ key:'scarcity', name:'Vow of Scarcity', family:'attribute', stat:'Mana', group:'Mana',
		params:[ { key:'pct', label:'Give up', type:'int', min:10, max:50, step:5, default:25, unit:'% max mana' } ],
		cond: (q) => 'Your maximum mana is ' + q.pct + '% smaller.',
		commit: (q) => 'Fewer, more deliberate casts.',
		reward: (q) => 'Magic Power ' + pctS(0.8 * q.pct / 100) + ', mana regeneration ' + pctS(1.2 * q.pct / 100) + '.',
		mods(C, q, M){ const r = q.pct / 100; M.mana *= 1 - r; M.power *= 1 + 0.8 * r; M.regen *= 1 + 1.2 * r; }
	});
	defineVow({ key:'unspentCup', name:'Vow of the Unspent Cup', family:'attribute', stat:'Mana', group:'Mana',
		params:[ { key:'pct', label:'Always keep', type:'int', min:20, max:60, step:5, default:35, unit:'% of mana' } ],
		cond: (q) => 'You never spend below ' + q.pct + '% of your mana.',
		commit: (q) => 'A spell that would take you under it cannot be cast.',
		reward: (q) => 'Mana regeneration ' + pctS(1.5 * q.pct / 100) + ', Magic Power ' + pctS(0.4 * q.pct / 100) + '.',
		mods(C, q, M){ const f = q.pct / 100; M.reserve = Math.max(M.reserve, f); M.regen *= 1 + 1.5 * f; M.power *= 1 + 0.4 * f; }
	});
	defineVow({ key:'fewWords', name:'Vow of Few Words', family:'attribute', stat:'Mana Control', group:'Mana Control',
		params:[ { key:'runes', label:'Spells of at most', type:'int', min:3, max:15, step:1, default:6, unit:'runes' } ],
		cond: (q) => 'Spells of ' + q.runes + ' runes or fewer (vows do not count) are your qualifying spells.',
		commit: (q) => 'Longer spells get nothing.',
		reward: (q) => 'Qualifying spells cost ' + Math.round(100 * Math.min(0.4, 0.025 * (16 - q.runes))) + '% less.',
		costFor(C, q, info){ return info.runes <= q.runes ? 1 - Math.min(0.4, 0.025 * (16 - q.runes)) : 1; }
	});
	defineVow({ key:'precision', name:'Vow of Precision', family:'attribute', stat:'Mana Control', group:'Mana Control',
		params:[ { key:'branches', label:'Branch points at most', type:'int', min:0, max:4, step:1, default:1 } ],
		cond: (q) => 'Your spells have at most ' + q.branches + ' branch point' + (q.branches === 1 ? '' : 's') + '.',
		commit: (q) => 'Casting a more branched spell switches the vow off for 6 s.',
		reward: (q) => 'Mana Control +' + (2 + Math.max(0, 2 - q.branches)) + ', qualifying spells cost 15% less.',
		onCast(C, q, info){ if(!info.passive && info.branches > q.branches) suspend(C, 6, 'a spell with ' + info.branches + ' branch points'); return null; },
		mods(C, q, M){ M.ctrl += 2 + Math.max(0, 2 - q.branches); },
		costFor(C, q, info){ return info.branches <= q.branches ? 0.85 : 1; }
	});
	defineVow({ key:'closedCircuit', name:'Vow of the Closed Circuit', family:'attribute', stat:'Mana Control', group:'Mana Control',
		params:[ { key:'forbid', label:'Never use', type:'select', options:[ { value:'redirection', label:'Redirection (Redirect, Rotate, Force)' }, { value:'transformation', label:'Transformation (Technique, Compress)' }, { value:'division', label:'Division (Split, Divide)' } ], default:'division' } ],
		cond: (q) => 'None of your spells use ' + q.forbid + '.',
		commit: (q) => 'Using it switches the vow off for 10 s.',
		reward: (q) => 'Mana Control +' + (q.forbid === 'transformation' ? 5 : 4) + '.',
		onCast(C, q, info){
			const T = info.types, bad = q.forbid === 'redirection' ? (T.has('redirect') || T.has('rotate') || T.has('force')) : q.forbid === 'transformation' ? (T.has('technique') || T.has('compress')) : (T.has('split') || T.has('divide'));
			if(bad) suspend(C, 10, 'you used ' + q.forbid);
			return null;
		},
		mods(C, q, M){ M.ctrl += q.forbid === 'transformation' ? 5 : 4; }
	});
	defineVow({ key:'glassCannon', name:'Vow of the Glass Cannon', family:'attribute', stat:'Magic Power', group:'Magic Power',
		params:[ { key:'pct', label:'Take more damage', type:'int', min:10, max:60, step:5, default:25, unit:'%' } ],
		cond: (q) => 'You take ' + q.pct + '% more damage.',
		commit: (q) => 'Both sides are capped.',
		reward: (q) => 'Magic Power ' + pctS(1.2 * q.pct / 100) + '.',
		mods(C, q, M){ const x = q.pct / 100; M.def *= 1 + x; M.power *= 1 + 1.2 * x; }
	});
	defineVow({ key:'chargedHeart', name:'Vow of the Charged Heart', family:'attribute', stat:'Magic Power', group:'Magic Power',
		params:[ { key:'time', label:'Charge for', type:'float', min:1, max:8, step:0.5, default:3, unit:'s' } ],
		cond: (q) => 'You cast nothing for ' + q.time + ' s.',
		commit: (q) => 'Casting early wastes the charge.',
		reward: (q) => 'The next spell hits ' + pctS(clamp(0.1 + 0.08 * q.time, 0.15, 0.75)) + ' harder.',
		pre(C, q, dt){ C.s.c = (C.s.c || 0) + dt; C.prog = clamp(C.s.c / q.time, 0, 1); },
		onCast(C, q, info){ if(info.passive) return null; const ok = C.prog >= 1; C.s.c = 0; C.prog = 0; return ok ? { power: 1 + clamp(0.1 + 0.08 * q.time, 0.15, 0.75) } : null; }
	});
	defineVow({ key:'forbiddenTechnique', name:'Vow of the Forbidden Technique', family:'attribute', stat:'Magic Power', group:'Magic Power',
		params:[ { key:'tech', label:'Give up', type:'select', options: () => [ { value:'all', label:'Every technique (raw energy only)' } ].concat(techOpts()), default:'all' } ],
		cond: (q) => q.tech === 'all' ? 'Your spells use raw energy only.' : 'Your spells never use ' + ME.labelOf(techOpts(), q.tech) + '.',
		commit: (q) => 'Using it switches the vow off for 20 s.',
		reward: (q) => 'Magic Power ' + pctS(q.tech === 'all' ? 0.35 : 0.12) + '.',
		onCast(C, q, info){ if(q.tech === 'all' ? info.techs.size > 0 : info.techs.has(q.tech)) suspend(C, 20, 'you used a forbidden technique'); return null; },
		mods(C, q, M){ M.power *= 1 + (q.tech === 'all' ? 0.35 : 0.12); }
	});

	/* ---- exchange vows: one stat for another, at uneven rates ---- */
	const EX_P = [ { key:'pct', label:'Trade', type:'int', min:10, max:50, step:5, default:20, unit:'%' } ];
	const exch = (key, name, from, to, txt, fn) => defineVow({ key, name, family:'exchange', stat: from + ' → ' + to, group: from + ' → ' + to, params: EX_P,
		cond: (q) => txt(q.pct / 100), commit: () => 'Both sides hold while the vow does (clamped).', reward: (q) => txt(q.pct / 100), mods(C, q, M){ fn(q.pct / 100, M); } });
	exch('arcaneGlass', 'Vow of the Arcane Glass', 'Defense', 'Magic Power', (a) => 'Take ' + Math.round(a * 100) + '% more damage; Magic Power ' + pctS(0.75 * a) + '.', (a, M) => { M.def *= 1 + a; M.power *= 1 + 0.75 * a; });
	exch('ironVessel', 'Vow of the Iron Vessel', 'Magic Power', 'Defense', (a) => 'Magic Power −' + Math.round(a * 100) + '%; damage taken −' + Math.round(60 * a) + '%.', (a, M) => { M.power *= 1 - a; M.def *= 1 - 0.6 * a; });
	exch('emptyMind', 'Vow of the Empty Mind', 'Mana Control', 'Strength', (a) => 'Mana Control −' + Math.round(a * 12) + '; Strength ' + pctS(1.1 * a) + '.', (a, M) => { M.ctrl -= a * 12; M.str += 1.1 * a; });
	exch('overflowingMind', 'Vow of the Overflowing Mind', 'Strength', 'Mana Control', (a) => 'Strength −' + Math.round(a * 100) + '%; Mana Control +' + Math.round(a * 10) + '.', (a, M) => { M.str -= a; M.ctrl += a * 10; });
	exch('vastReservoir', 'Vow of the Vast Reservoir', 'Magic Power', 'Mana', (a) => 'Magic Power −' + Math.round(a * 100) + '%; maximum mana ' + pctS(1.3 * a) + '.', (a, M) => { M.power *= 1 - a; M.mana *= 1 + 1.3 * a; });
	exch('explosiveVessel', 'Vow of the Explosive Vessel', 'Mana', 'Magic Power', (a) => 'Maximum mana −' + Math.round(a * 100) + '%; Magic Power ' + pctS(0.85 * a) + '.', (a, M) => { M.mana *= 1 - a; M.power *= 1 + 0.85 * a; });

	/* =================================================================
	   CONTRACT RUNTIME
	   ================================================================= */
	function wrapA(a){ while(a > Math.PI) a -= TAU; while(a < -Math.PI) a += TAU; return a; }
	function amCount(b){ return memCount(b, 'antiMagicContact') + memCount(b, 'antiMagicConsumed') + memCount(b, 'antiMagicDisrupted'); }
	function othersCount(def, nodeId){
		// runes elsewhere in the spell: not this rune, not its ancestors, not what comes after it
		const nodes = def.nodes || {}, skip = new Set();
		let cur = nodes[nodeId]; while(cur){ skip.add(cur.id); cur = cur.parent ? nodes[cur.parent] : null; }
		const stack = [nodeId];
		while(stack.length){ const id = stack.pop(); skip.add(id); for(const k in nodes) if(nodes[k].parent === id && !skip.has(k)) stack.push(k); }
		let n = 0; for(const k in nodes){ const R = Runes[nodes[k].type]; if(!skip.has(k) && !(R && R.free)) n++; }
		return n;
	}
	function strongest(C){ let best = null; for(const b of C._live) if(!best || b.amount > best.amount) best = b; return best; }
	function touchedForeign(W, b){
		const r = bodyRadius(b);
		for(const o of W.bodies){ if(!o.alive || o.ownerId === b.ownerId || o.isZone || o.zoneBlob) continue; const dx = o.x - b.x, dy = o.y - b.y, rr = r + bodyRadius(o); if(dx * dx + dy * dy < rr * rr) return true; }
		const fl = W.host && W.host.getForeignProjectiles ? (W.host.getForeignProjectiles() || []) : [];
		for(let i = 0; i < fl.length; i++){ const f = fl[i]; if(f && Math.abs(f.x - b.x) < r + 12 && Math.abs(f.y - b.y) < r + 12) return true; }
		return false;
	}
	/* your gates for the Vow of the Gauntlet: zones, constructs and your own energy holding still — rebuilt once a frame */
	function gatesFor(W, ownerId){
		const V = W._vowS;
		if(V.gateFrame === W.frame && V.gates[ownerId]) return V.gates[ownerId];
		if(V.gateFrame !== W.frame){ V.gates = {}; V.gateFrame = W.frame; }
		const out = [];
		for(const o of W.bodies){
			if(!o.alive || o.ownerId !== ownerId || o.zoneBlob) continue;
			if(o.isZone) out.push({ id: 'z' + o.id, x: o.x, y: o.y, r: o.zoneRadius, ref: o });
			else if((o.anchored || Math.hypot(o.vx, o.vy) < 0.3) && !o.drawing) out.push({ id: 'b' + o.id, x: o.x, y: o.y, r: bodyRadius(o) + 12, ref: o });
		}
		for(const c of (W.constructs || [])) if(c.alive && c.ownerId === ownerId) out.push({ id: 'c' + c.id, x: c.x, y: c.y, r: (c.geo && c.geo.R) || 40, ref: null });
		V.gates[ownerId] = out;
		return out;
	}
	/* free energy: added to a body and marked as vow energy (never counts against Max Output) */
	function addFree(b, add){
		if(!(add > 0) || !b.alive) return 0;
		const share = b.vowShare || 0, base = b.amount * (1 - share), used = share / Math.max(1e-6, 1 - share);
		const room = Math.max(0, VB.stackCap - used) * base;
		add = Math.min(add, room);
		if(add <= 0) return 0;
		b.vowShare = (share * b.amount + add) / (b.amount + add);
		b.amount += add;
		return add;
	}
	function payAbs(C, b, add, why){
		if(C.state === 'paid' || C.state === 'broken' || C.state === 'ended') return null;
		const got = addFree(b, add * (VB.failMult[C.failure] || 1));
		C.state = 'paid'; C.paid = got; C.prog = 1;
		fx(C, b, VB.colorHot, (C.V.name.replace('Vow of the ', '').replace('Vow of ', '')) + ' fulfilled  +' + Math.round(got) + ' E');
		if(b.flash != null) b.flash = 1;
		remember(b, 'vowFulfilled');
		return 'paid';
	}
	function pay(C, b, pct, why){
		if(C.state === 'paid' || C.state === 'broken' || C.state === 'ended') return null;
		const base = b.amount * (1 - (b.vowShare || 0));
		return payAbs(C, b, base * pct, why);
	}
	function brk(C, why){
		if(C.state === 'broken' || C.state === 'paid' || C.state === 'ended') return;
		C.state = 'broken'; C.why = why;
		const W = C.W;
		for(const b of C._live.length ? C._live : liveOf(C)){
			if(!b.alive) continue;
			remember(b, 'vowBroken');
			if(C.failure === 'destroy') C.I.killBody(b, 'vow');
			else if(C.failure === 'drain') b.amount *= 1 - VB.drainLoss;
		}
		const b0 = C._live[0];
		fx(C, b0, VB.colorBroken, 'Vow broken — ' + why);
	}
	function end(C, why){ if(C.state === 'active' || C.state === 'ready'){ C.state = 'ended'; C.why = why; } }
	function note(C, why){ C.why = why; }
	function liveOf(C){ const out = []; for(const b of C.W.bodies) if(b.alive && b.vows && b.vows.indexOf(C) >= 0) out.push(b); return out; }
	function fx(C, b, color, text){
		const W = C.W;
		if(b && b.alive){
			W.rings.push({ x: b.x, y: b.y, r: bodyRadius(b), max: bodyRadius(b) * 2.4 + 26, age: 0, life: 22, color });
			for(let i = 0; i < 10; i++){ const a = i / 10 * TAU; C.I.spark(b.x, b.y, Math.cos(a) * 2.6, Math.sin(a) * 2.6, { tint: { core: '#fffbe6', mid: color, outer: color } }, 18); }
		}
		const at = b && b.alive ? { x: b.x, y: b.y } : null;
		if(W.host && W.host.vowText && C.ownerIsYou) W.host.vowText(at, text, color);
	}

	/* the per-body watch: distance flown (portal / teleport jumps excluded), time since the vow, launch direction */
	function bodyState(C, b){
		const m = b._vs || (b._vs = {});
		let s = m[C.id];
		if(!s){ s = m[C.id] = C.last ? Object.assign({}, C.last, { g: C.last.g ? C.last.g.slice() : null }) : { d: 0, t: 0, launched: false }; s.x = b.x; s.y = b.y; s.jumped = false; }
		return s;
	}

	/* what a cast looks like to a vow (techniques, runes, branches, output) */
	function defInfo(def, report, inst){
		const T = new Set(), types = new Set();
		let runes = 0, branches = 0;
		const kids = {};
		const nodes = (def && def.nodes) || {};
		for(const k in nodes){
			const n = nodes[k]; if(!n || !n.type) continue;
			const R = Runes[n.type];
			if(!(R && R.free)) runes++;
			types.add(n.type);
			if(n.type === 'technique' && n.params && n.params.technique) T.add(n.params.technique);
			if(n.parent) kids[n.parent] = (kids[n.parent] || 0) + 1;
		}
		for(const k in kids) if(kids[k] >= 2) branches++;
		return { techs: T, types, runes, branches, peak: report ? (report.peakOutput || 0) : 0, max: inst ? inst.maxOutput : 0, passive: !!(inst && inst.passive) };
	}

	/* the stat block every player vow writes into */
	function emptyMods(){ return { str: 0, def: 1, mana: 1, regen: 1, ctrl: 0, power: 1, cost: 1, reserve: 0, kb: 1, noDash: false, list: [] }; }
	function clampMods(M){
		M.str = clamp(M.str, -0.6, 1.2); M.def = clamp(M.def, 0.4, 1.8); M.mana = clamp(M.mana, 0.4, 2.2); M.regen = clamp(M.regen, 0.4, 3);
		M.ctrl = clamp(M.ctrl, -8, 12); M.power = clamp(M.power, 0.4, 2.2); M.cost = clamp(M.cost, 0.5, 1); M.reserve = clamp(M.reserve, 0, 0.6); M.kb = clamp(M.kb, 1, 1.5);
		return M;
	}

	ME.registerWorldHook({ init(W, I){
		const S = W._vowS = { list: [], hist: [], seq: 1, act: {}, gates: {}, gateFrame: -1, mods: {}, modsFrame: {} };      // hist: the last 64 contracts (tests, debugging)
		W.vows = S.list;
		const owned = (C) => C.ownerId === 'player';
		const act = (id) => S.act[id] || (S.act[id] = { castT: -1e9, meleeT: -1e9 });

		/* a cast: tell this caster's player vows, and hand the cast what they release (bonus energy / power) */
		W._vowCast = function(inst, castOpts, report){
			if(inst.emitKey) return;
			const ownerId = inst.owner && inst.owner.id;
			if(!S.list.length) return;
			let info = null, boost = 0, power = 1;
			for(const C of S.list){
				if(C.family === 'energy' || C.ownerId !== ownerId || C.state === 'ended' || !C.V.onCast) continue;
				info = info || defInfo(inst.def, report, inst);
				const was = C.sus > 0;
				const r = C.V.onCast(C, C.q, info);
				if(was) continue;      // a suspended vow still notices what you did, but releases nothing
				if(r && r.boost) boost += r.boost;
				if(r && r.power) power *= r.power;
			}
			if(!inst.passive) act(ownerId).castT = W.time;
			if(boost > 0){ inst._vowBoost = Math.min(VB.stackCap, boost); }
			if(power > 1) inst.vowPower = Math.min(2.5, power);
		};
		/* the cast's freshly generated energy takes the stored bonus (free energy, never output) */
		W._vowBody = function(inst, b){
			if(!(inst._vowBoost > 0) || b.vowShare > 0 || b.source !== 'generated' || !(b.amount > 0)) return;
			const add = b.amount * inst._vowBoost;
			b.vowShare = add / (b.amount + add); b.amount += add;
			if(!inst._vowBoostShown){ inst._vowBoostShown = true; if(W.host && W.host.vowText && inst.owner && inst.owner.id === 'player') W.host.vowText({ x: b.x, y: b.y }, 'Vow released  +' + Math.round(inst._vowBoost * 100) + '%', VB.colorHot); }
		};
		W.vowNote = function(ownerId, what){
			const A = act(ownerId);
			if(what === 'melee'){ A.meleeT = W.time; for(const C of S.list) if(C.ownerId === ownerId && C.state !== 'ended' && C.V.onMelee) C.V.onMelee(C, C.q); }
		};

		W._vowPre = function(dt){
			if(!S.list.length) return;
			// bodies carrying each contract this frame
			for(const C of S.list) C._live.length = 0;
			for(const b of W.bodies) if(b.alive && b.vows) for(const C of b.vows) if(C._live) C._live.push(b);
			const Pcache = {};
			for(const C of S.list){
				if(C.state === 'ended') continue;
				C.t += dt;
				C.instRef = C.instRef && !C.instRef.done ? C.instRef : I.instById(C.inst);
				if(C.family === 'energy'){
					if(C.V.pre && (C.state === 'active' || C.state === 'ready')) C.V.pre(C, C.q, dt);
					// a contract whose energy is all gone simply ends (a broken / paid one is kept a moment for the HUD)
					if(!C._live.length && C.t > 0.05){ if(C.state === 'active' || C.state === 'ready') C.state = 'ended'; C.gone = (C.gone || 0) + dt; }
					continue;
				}
				// player vows live while their spell does (a passive re-casting keeps them)
				if(!C.instRef){ C.gone = (C.gone || 0) + dt; if(C.gone > VB.grace){ C.state = 'ended'; continue; } }
				else C.gone = 0;
				if(C.sus > 0) C.sus = Math.max(0, C.sus - dt);
				const Pl = Pcache[C.ownerId] !== undefined ? Pcache[C.ownerId] : (Pcache[C.ownerId] = playerSnap(C));
				if(C.V.pre) C.V.pre(C, C.q, dt, Pl);
			}
			// tidy: ended contracts leave the list after a moment
			if(W.frame % 30 === 0) for(let i = S.list.length - 1; i >= 0; i--){ const C = S.list[i]; if((C.state === 'ended' && (C.family !== 'energy' || (C.gone || 0) > 1)) || ((C.state === 'paid' || C.state === 'broken') && !C._live.length && (C.gone || 0) > 1)) S.list.splice(i, 1); }
			// the Perfect Sequence: forget old hits
			if(W.frame % 20 === 0) for(const inst of W.instances) if(inst._vowHits && inst._vowHits.length) inst._vowHits = inst._vowHits.filter(h => W.time - h.t < 6);
		};
		function playerSnap(C){
			const H = W.host, e = C.owner && C.owner.entity;
			const snap = H && H.vowPlayer ? H.vowPlayer(C.owner) : null;
			if(snap) return snap;
			if(!e) return null;
			return { x: e.x + (e.w || 0) / 2, y: e.y + (e.h || 0) / 2, hp: e.hp != null ? e.hp / Math.max(1, e.maxHp || e.hp) : 1, weapon: 'none', nearestEnemy: Infinity };
		}

		W._vowTick = function(b, dt){
			for(let i = 0; i < b.vows.length; i++){
				const C = b.vows[i];
				if(C.state !== 'active' && C.state !== 'ready') continue;
				const s = bodyState(C, b);
				const dx = b.x - s.x, dy = b.y - s.y, step = Math.sqrt(dx * dx + dy * dy), sp = Math.hypot(b.vx, b.vy) * (dt * 60);
				if(step > Math.max(40, sp * 3 + 24)) s.jumped = true;      // carried through a portal / teleported
				else s.d += step;
				s.x = b.x; s.y = b.y; s.t += dt;
				if(C.V.tick) C.V.tick(C, b, s, C.q, dt);
				C.last = s;
				if(!b.alive) return;
				if(C.V.prog) C.prog = clamp(C.V.prog(s, C.q, b), 0, 1);
			}
		};
		W._vowHit = function(b, e){
			const inst = I.instById(b.inst);
			if(inst && inst._vowSeq){ (inst._vowHits || (inst._vowHits = [])).push({ bid: b.id, e, t: W.time }); }
			if(!b.vows) return null;
			let out = null;
			for(let i = 0; i < b.vows.length; i++){
				const C = b.vows[i];
				if((C.state !== 'active' && C.state !== 'ready') || !C.V.hit) continue;
				const r = C.V.hit(C, b, e, bodyState(C, b), C.q);
				if(r === 'pass') out = 'pass';
				if(!b.alive) return null;
			}
			return out;
		};
		W._vowEnd = function(inst){ /* player vows notice the spell is gone in _vowPre (grace for passive re-casts) */ };
		W._vowClear = function(){ S.list.length = 0; S.hist.length = 0; };
		W.vowHistory = function(){ return S.hist.slice(); };

		/* stat changes from every player vow of this caster (clamped), cached per frame */
		W.vowMods = function(ownerId){
			ownerId = ownerId || 'player';
			if(S.modsFrame[ownerId] === W.frame && S.mods[ownerId]) return S.mods[ownerId];
			const M = emptyMods();
			for(const C of S.list){
				if(C.ownerId !== ownerId || C.family === 'energy' || C.state === 'ended') continue;
				const on = !(C.sus > 0);
				if(on && C.V.mods) C.V.mods(C, C.q, M);
				M.list.push({ key: C.V.key, name: C.V.name, family: C.family, on, sus: C.sus || 0, prog: C.prog || 0, why: C.why || '', stat: C.V.stat || C.V.group || '' });
			}
			S.mods[ownerId] = clampMods(M); S.modsFrame[ownerId] = W.frame;
			return S.mods[ownerId];
		};
		/* how much cheaper this spell is under your vows (never above 1: a vow never makes a spell cost more) */
		W.vowCostMult = function(ownerId, def){
			let m = W.vowMods(ownerId).cost;
			let info = null;
			for(const C of S.list){
				if(C.ownerId !== ownerId || C.state === 'ended' || C.sus > 0 || !C.V.costFor) continue;
				info = info || defInfo(def, null, null);
				m *= C.V.costFor(C, C.q, info);
			}
			return clamp(m, 0.5, 1);
		};
		/* a passive spell's drain under the Unbroken Thread */
		W.vowPassiveMult = function(inst){
			let m = 1;
			for(const C of S.list) if(C.instRef === inst && C.state !== 'ended' && C.V.passiveMult) m *= C.V.passiveMult(C);
			return clamp(m, 0.5, 1);
		};
		W.vowList = function(ownerId){ return S.list.filter(C => !ownerId || C.ownerId === ownerId); };

		/* bound energy wears a thin golden band; ready = bright, broken = a red flash */
		W._vowDraw = function(ctx, vis, camX, camY, t){
			if(!S.list.length) return;
			ctx.globalCompositeOperation = 'lighter';
			ctx.lineWidth = 1.6;
			for(let i = 0; i < vis.length; i++){
				const b = vis[i];
				if(!b.vows || !b.alive) continue;
				let C = null; for(const c of b.vows) if(c.state === 'active' || c.state === 'ready'){ C = c; break; }
				if(!C) continue;
				const x = b.x - camX, y = b.y - camY, R = bodyRadius(b) * 1.55 + 6;
				const ready = C.state === 'ready';
				ctx.strokeStyle = ready ? VB.colorHot : VB.color;
				ctx.globalAlpha = ready ? 0.85 : 0.5;
				const a0 = t * 2.2 + b.id;
				// a broken ring of links (the vow binding it)
				for(let k = 0; k < 6; k++){ const a = a0 + k * TAU / 6; ctx.beginPath(); ctx.arc(x, y, R, a, a + 0.62); ctx.stroke(); }
				const pr = C.prog || 0;
				if(pr > 0 && !ready){ ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(x, y, R + 4, -Math.PI / 2, -Math.PI / 2 + TAU * pr); ctx.stroke(); }
			}
			ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
		};

		W._vowS.newContract = function(V, q, api, br, b, node){
			const inst = api.instance;
			const C = { id: S.seq++, V, q, key: V.key, family: V.family, failure: q.failure || 'lose', state: 'active', W, I,
				ownerId: inst.owner && inst.owner.id, owner: inst.owner, ownerIsYou: !!(inst.owner && inst.owner.id === 'player'),
				inst: inst.id, instRef: inst, nodeId: node ? node.id : null, t: 0, prog: 0, s: {}, _live: [], last: null, why: '' };
			return C;
		};
	} });

	/* ---------------------------------------------------------------- the rune */
	function vowOpts(p){ const fam = (p && p.family) || 'energy'; return ORDER.filter(k => VOWS[k].family === fam).map(k => ({ value: k, label: VOWS[k].name.replace(/^Vow of (the )?/, '') + ' · ' + (VOWS[k].stat || VOWS[k].group) })); }
	function vowOf(p){ const V = VOWS[p && p.vow]; return V && V.family === ((p && p.family) || 'energy') ? V : null; }
	const params = [
		{ key:'family', label:'Kind of vow', type:'select', options: FAMILIES, default:'energy' },
		{ key:'vow', label:'Vow', type:'select', options: vowOpts, default:'unerring' }
	];
	for(const k of ORDER){
		const V = VOWS[k];
		for(const d of V.params) params.push(Object.assign({}, d, { key: k + '_' + d.key, vowParam: d.key, show: (pp) => pp.vow === k && (pp.family || 'energy') === V.family }));
	}
	params.push({ key:'failure', label:'If it breaks', type:'select', options: FAILURE, default:'lose', show: (pp) => (pp.family || 'energy') === 'energy' });

	/* the full contract in words (the forge shows it on the rune) */
	function describe(p, others){
		const V = vowOf(p); if(!V) return null;
		const q = P(p, V);
		const out = { Vow: V.name, Kind: FAMILY_SHORT[V.family] + ' · ' + (V.group || '') };
		out.Condition = V.cond(q);
		out.Commitment = V.commit(q);
		out.Reward = V.reward(q, others) + (V.family === 'energy' && (VB.failMult[q.failure] || 1) > 1 ? ' ×' + VB.failMult[q.failure] + ' for its harsher failure clause.' : '');
		if(V.family === 'energy'){
			const mx = V.maxPct ? V.maxPct(q, others) * (VB.failMult[q.failure] || 1) : 0;
			out.Difficulty = difficulty(mx) + ' (up to ' + pctS(Math.min(VB.stackCap, mx)) + ' energy)';
			out['If broken'] = q.failure === 'destroy' ? 'the energy is destroyed' : q.failure === 'drain' ? 'it loses 35% of its energy' : 'it only loses the bonus';
			out['Applies to'] = 'this energy (and anything split from it — paid once)';
		} else {
			out['Applies to'] = 'you, while this spell runs' + (V.key === 'unbrokenThread' ? '' : ' (put it in a ∞ passive spell to keep it up)');
		}
		out.Price = 'free — no mana, no cooldown, never counts against Max Output';
		return out;
	}

	defineRune({
		id:'vow', name:'Binding Vow', glyph:'⛓', category:'vow', free:true,
		description:'Swears a binding vow. Pick a contract: a CONDITION to meet, a COMMITMENT you accept while it holds, and the REWARD it pays. Energy vows bind the energy in this branch (travel far without turning, wait before striking, strike only your sworn prey …) and pay bonus energy when fulfilled; passive, attribute and exchange vows bind you while this spell runs (best in a ∞ passive spell) and change your stats. Vows are free: no mana, no cooldown, and the energy they grant never counts against your Max Output. A broken vow pays nothing — and may cost the energy, if you swore it that way.',
		params,
		input:{ energy:'required', bodyless: (p) => !!(vowOf(p) && vowOf(p).family !== 'energy') },
		cost: () => 0,
		perBody: true,
		summary: (p) => { const V = vowOf(p); return V ? V.name.replace(/^Vow of (the )?/, '') + ' · ' + FAMILY_SHORT[V.family] : 'choose a vow'; },
		note: (p) => { const V = vowOf(p); return V ? (V.family === 'energy' ? 'Free: this vow costs no mana and adds no cooldown; its bonus energy never counts against Max Output.' : 'Free. Holds while this spell runs — in a ∞ passive spell it holds as long as the passive does.') : 'Pick the kind of vow, then the vow.'; },
		analyze(p, a, node){
			const V = vowOf(p);
			if(!V){ a.error(node, 'VOW_NONE', 'Choose a vow'); return; }
			const q = P(p, V);
			if(V.family === 'energy'){
				const b = a.ctx.body;
				if(b && b.foreign) a.error(node, 'VOW_FOREIGN', 'A vow binds your own energy — not another caster\'s projectile');
				else if(b && b.zone) a.error(node, 'VOW_ZONE', 'A zone cannot be bound by an energy vow — Draw Out first');
				if(V.analyze) V.analyze(q, a, node);
			}
			a.extra({ vow: describe(p) });
		},
		exec(api, br, p, node){
			const V = vowOf(p);
			if(!V) return api.fail('No vow chosen');
			const q = P(p, V);
			const W = api.world, S = W._vowS;
			if(!S) return api.fail('Vows are not available here');
			if(V.family !== 'energy'){
				// you are bound: one contract per vow rune (a passive re-casting picks its old contract back up)
				const sig = (api.owner && api.owner.id) + '|' + (api.instance.def.name || '') + '|' + (api.instance.def.rootId || '') + '|' + (node ? node.id : '');
				let C = S.list.find(c => c.sig === sig && c.state !== 'ended');
				if(C){ C.inst = api.instance.id; C.instRef = api.instance; C.q = q; C.gone = 0; return; }
				C = S.newContract(V, q, api, br, null, node); C.sig = sig;
				if(V.start){ const r = V.start(C, null, api, br); if(typeof r === 'string') return api.fail(r); }
				S.list.push(C); S.hist.push(C); if(S.hist.length > 64) S.hist.shift();
				if(C.ownerIsYou && W.host && W.host.vowText){ const c = api.casterPos(); W.host.vowText(c ? { x: c.x, y: c.y - 40 } : null, '⛓ ' + V.name, VB.color); }
				return;
			}
			const b = br.ctx.body;
			if(!api.bodyValid(b)) return api.fail('Energy is gone');
			if(b.foreign) return api.fail('A vow binds your own energy only');
			if(b.isZone) return api.fail('A zone cannot be bound — Draw Out first');
			if(b.vows && b.vows.some(c => c.key === V.key && (c.state === 'active' || c.state === 'ready'))) return api.note('Already bound by this vow');
			const C = S.newContract(V, q, api, br, b, node);
			b.vows = b.vows ? b.vows.concat([C]) : [C];
			C._live.push(b);
			const s = bodyState(C, b);
			if(V.start){ const r = V.start(C, b, api, br); if(typeof r === 'string'){ b.vows = b.vows.filter(x => x !== C); return api.fail(r); } }
			if(C.state === 'active' || C.state === 'ready' || C.state === 'paid') S.list.push(C);
			S.hist.push(C); if(S.hist.length > 64) S.hist.shift();
			W.rings.push({ x: b.x, y: b.y, r: bodyRadius(b), max: bodyRadius(b) * 2 + 18, age: 0, life: 18, color: VB.color });
			void s;
		}
	});
	ME.MEM_EVENTS.push({ value:'vowFulfilled', label:'Fulfilled a Binding Vow' }, { value:'vowBroken', label:'Broke a Binding Vow' });

	root.MagicVows = { VOWS, ORDER, FAMILIES, VB, describe, vowOf, params: P, difficulty, defInfo };
})(typeof window !== 'undefined' ? window : globalThis);
