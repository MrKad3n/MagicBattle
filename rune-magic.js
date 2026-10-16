/*
 * Programmable magic. A spell is a directed rune tree. The thing that
 * moves along the tree is magical energy. Connections decide when the
 * next rune runs. Techniques are a framework only — none are defined here.
 *
 * Spell definitions are plain data. Casting clones one into a spell instance.
 * Enemy attacks do not go through this file.
 */
(function(root){
	'use strict';

	const MAX_RUNES = 100;
	const MAX_LIFE = 120;
	const MAX_ACTIVE = 12;
	const PROFILE_KEY = 'magicBattle_runeProfile';
	const ENERGY_KEY = 'magicBattle_runeEnergy';

	const DIRS = {
		n: { x: 0, y: -1 },
		e: { x: 1, y: 0 },
		s: { x: 0, y: 1 },
		w: { x: -1, y: 0 }
	};

	const CATEGORIES = [
		{ id: 'origin', label: 'Origin' },
		{ id: 'target', label: 'Targets' },
		{ id: 'generation', label: 'Generation' },
		{ id: 'manipulation', label: 'Manipulation' },
		{ id: 'split', label: 'Splitting' },
		{ id: 'compression', label: 'Compression' },
		{ id: 'expansion', label: 'Expansion' },
		{ id: 'power', label: 'Power' },
		{ id: 'movement', label: 'Movement' },
		{ id: 'shape', label: 'Shape' },
		{ id: 'technique', label: 'Technique' },
		{ id: 'reversal', label: 'Technique Reversal' },
		{ id: 'environment', label: 'Environment' },
		{ id: 'attachment', label: 'Attachment' },
		{ id: 'control', label: 'Control' }
	];

	let seq = 1;
	function uid(prefix){
		seq += 1;
		return prefix + seq.toString(36) + Math.floor(Math.random() * 1296).toString(36);
	}

	const TECHNIQUES = {};

	function defaultProfile(){
		return {
			maxEnergy: 120,
			maxOutput: 80,
			energyControl: 16,
			techniquePoints: 4,
			allocations: {},
			negativePowerUnlocked: false
		};
	}

	let memProfile = null;
	let memEnergy = null;
	let saveTimer = 0;

	function profile(){
		if(memProfile) return memProfile;
		let stored = null;
		try{
			if(typeof localStorage !== 'undefined') stored = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');
		}catch(e){}
		memProfile = defaultProfile();
		if(stored && typeof stored === 'object'){
			if(typeof stored.maxEnergy === 'number') memProfile.maxEnergy = stored.maxEnergy;
			if(typeof stored.maxOutput === 'number') memProfile.maxOutput = stored.maxOutput;
			if(typeof stored.energyControl === 'number') memProfile.energyControl = stored.energyControl;
			if(typeof stored.techniquePoints === 'number') memProfile.techniquePoints = stored.techniquePoints;
			if(stored.allocations && typeof stored.allocations === 'object') memProfile.allocations = stored.allocations;
			if(stored.negativePowerUnlocked) memProfile.negativePowerUnlocked = true;
		}
		memProfile.energyControl = clamp(memProfile.energyControl, 1, MAX_RUNES);
		memProfile.techniquePoints = clamp(memProfile.techniquePoints, 0, 99);
		return memProfile;
	}

	function energyNow(){
		if(memEnergy == null){
			let stored = null;
			try{
				if(typeof localStorage !== 'undefined') stored = JSON.parse(localStorage.getItem(ENERGY_KEY) || 'null');
			}catch(e){}
			memEnergy = (stored && typeof stored.energy === 'number') ? stored.energy : profile().maxEnergy;
		}
		memEnergy = clamp(memEnergy, 0, profile().maxEnergy);
		return memEnergy;
	}

	function setEnergy(v){
		memEnergy = clamp(v, 0, profile().maxEnergy);
		saveTimer = Math.max(saveTimer, 0.01);
	}

	function persist(force){
		if(typeof localStorage === 'undefined') return;
		try{
			localStorage.setItem(PROFILE_KEY, JSON.stringify(profile()));
			localStorage.setItem(ENERGY_KEY, JSON.stringify({ energy: energyNow() }));
		}catch(e){}
		if(force) saveTimer = 0;
	}

	function runeCapacity(p){
		p = p || profile();
		return clamp(Math.round(p.energyControl || 1), 1, MAX_RUNES);
	}

	function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

	function registerTechnique(def){
		if(!def || !def.id) return { ok: false, reason: 'Technique needs an id' };
		TECHNIQUES[def.id] = {
			id: def.id,
			name: def.name || def.id,
			efficiency: typeof def.efficiency === 'number' ? def.efficiency : 0.4,
			powerScaling: typeof def.powerScaling === 'function' ? def.powerScaling : function(points){
				return 1 + (1 - Math.exp(-0.45 * points));
			},
			conversionRules: def.conversionRules || {},
			interactionRules: def.interactionRules || {},
			reversalRules: def.reversalRules || {}
		};
		return { ok: true };
	}

	function efficiencyOf(id, p){
		p = p || profile();
		const pts = (p.allocations && p.allocations[id]) || 0;
		const def = TECHNIQUES[id];
		if(!def || pts <= 0) return 0;
		const base = clamp(def.efficiency, 0, 1);
		if(base >= 0.999) return 1;
		return 1 - (1 - base) * Math.exp(-0.95 * pts);
	}

	function powerScaleOf(id, p){
		p = p || profile();
		const pts = (p.allocations && p.allocations[id]) || 0;
		const def = TECHNIQUES[id];
		if(!def || pts <= 0) return 1;
		return def.powerScaling(pts);
	}

	function setAllocation(id, points){
		const p = profile();
		if(!TECHNIQUES[id]) return { ok: false, reason: 'Technique unavailable' };
		points = Math.max(0, Math.floor(Number(points) || 0));
		const next = Object.assign({}, p.allocations || {});
		if(points <= 0) delete next[id];
		else next[id] = points;
		const ids = Object.keys(next);
		if(ids.length > 4) return { ok: false, reason: 'Only four techniques can hold points' };
		const sum = ids.reduce(function(s, k){ return s + next[k]; }, 0);
		if(sum > p.techniquePoints) return { ok: false, reason: 'Not enough technique points' };
		p.allocations = next;
		persist(true);
		return { ok: true, allocations: next };
	}

	const CONDITIONS = {
		enemyNearby: {
			label: 'Enemy nearby',
			blurb: 'True when a hostile is within the distance.',
			fields: [{ key: 'distance', label: 'Distance', type: 'number', min: 40, max: 480, step: 10, default: 160 }],
			test: function(adapter, cond, energy){
				const dist = cond.distance || 160;
				const list = adapter.hostiles();
				for(let i = 0; i < list.length; i++){
					const h = list[i];
					if(!h.alive) continue;
					const hx = h.x + (h.w || 0) / 2;
					const hy = h.y + (h.h || 0) / 2;
					if(Math.hypot(hx - energy.x, hy - energy.y) <= dist) return true;
				}
				return false;
			}
		},
		targetAlive: {
			label: 'Target still standing',
			blurb: 'True when the energy\'s locked target is still alive.',
			fields: [],
			test: function(adapter, cond, energy){
				if(!energy.target) return false;
				const found = adapter.lookup(energy.target);
				return !!(found && found.alive);
			}
		},
		casterEnergyAbove: {
			label: 'Reserve above',
			blurb: 'True when the caster\'s energy reserve is above a value.',
			fields: [{ key: 'amount', label: 'Amount', type: 'number', min: 1, max: 120, step: 1, default: 20 }],
			test: function(adapter, cond){
				return energyNow() >= (cond.amount || 20);
			}
		},
		enemyHealthBelow: {
			label: 'Enemy health below',
			blurb: 'True when the locked enemy, or the nearest enemy, is under a percent.',
			fields: [{ key: 'percent', label: 'Percent', type: 'number', min: 5, max: 100, step: 5, default: 50 }],
			test: function(adapter, cond, energy){
				const pct = (cond.percent || 50) / 100;
				let h = energy.target ? adapter.lookup(energy.target) : null;
				if(!h || !h.alive){
					const list = adapter.hostiles().filter(function(x){ return x.alive; });
					h = list[0] || null;
				}
				if(!h || !h.maxHp) return false;
				return h.hp / h.maxHp <= pct;
			}
		},
		insideZone: {
			label: 'Inside a zone',
			blurb: 'True when this energy is inside any active zone.',
			fields: [],
			test: function(adapter, cond, energy){
				const spells = adapter.instances();
				for(let i = 0; i < spells.length; i++){
					const energies = spells[i].energies || [];
					for(let j = 0; j < energies.length; j++){
						const z = energies[j];
						if(!z.zone || z.dying) continue;
						if(Math.hypot(z.x - energy.x, z.y - energy.y) <= (z.radius || 80)) return true;
					}
				}
				return false;
			}
		}
	};

	function field(key, label, type, min, max, step, def, extra){
		const f = { key: key, label: label, type: type, min: min, max: max, step: step, default: def };
		if(extra) Object.assign(f, extra);
		return f;
	}

	const RUNES = {};
	function addRune(def){ RUNES[def.id] = def; return def; }

	addRune({
		id: 'magicBlast', name: 'Basic Magic Blast', category: 'origin', rootOnly: true, maxChildren: 1,
		blurb: 'Launches a stream of raw magical energy. This is always the root.',
		fields: [
			field('amount', 'Energy', 'number', 8, 120, 1, 28),
			field('power', 'Power', 'number', 1, 40, 0.5, 8)
		],
		summary: function(n){ return n.params.amount + ' energy · power ' + n.params.power; },
		simulate: function(packet, node){
			return {
				amount: num(node.params.amount, 28),
				power: num(node.params.power, 8),
				scale: 1,
				technique: null,
				reversed: false,
				modifiers: [],
				environmental: false,
				shape: 'unbound',
				targetKind: null
			};
		},
		apply: function(energy, node){
			energy.amount = num(node.params.amount, 28);
			energy.power = num(node.params.power, 8);
			energy.scale = 1;
			energy.shape = 'unbound';
			energy.harmful = true;
			const speed = 280;
			if(!energy.vx && !energy.vy){
				energy.vx = Math.cos(energy.aim || 0) * speed;
				energy.vy = Math.sin(energy.aim || 0) * speed;
			}
		}
	});

	addRune({
		id: 'target', name: 'Target', category: 'target', maxChildren: 1,
		blurb: 'Locks what this energy is acting on. The lock stays until another Target rune.',
		fields: [field('target', 'Target', 'select', 0, 0, 0, 'enemy', {
			options: [
				{ id: 'self', label: 'Self (the caster)' },
				{ id: 'enemy', label: 'Enemy' },
				{ id: 'ally', label: 'Ally' },
				{ id: 'surface', label: 'Surface' },
				{ id: 'environment', label: 'Environment' },
				{ id: 'projectile', label: 'Projectile' },
				{ id: 'spell', label: 'Active spell' }
			]
		})],
		summary: function(n){ return 'Lock ' + (n.params.target || 'enemy'); },
		simulate: function(packet, node){
			const t = node.params.target || 'enemy';
			const next = copyPacket(packet);
			next.targetKind = t;
			if(t === 'environment') next.environmental = true;
			if(t === 'self') next.harmful = false;
			return next;
		},
		apply: function(energy, node, inst, adapter){
			const t = node.params.target || 'enemy';
			const hit = resolveTarget(t, energy, inst, adapter);
			if(!hit){
				energy.dying = true;
				adapter.feedback(missText(t), energy.x, energy.y, '#ffb4b4');
				return;
			}
			energy.target = { kind: t, id: hit.id || null, x: hit.x, y: hit.y, spellId: hit.spellId || null, energyId: hit.energyId || null };
			if(t === 'environment'){
				energy.environmental = true;
				energy.harmful = false;
				energy.vx *= 0.25;
				energy.vy *= 0.25;
			}
			if(t === 'self') energy.harmful = false;
			if(t === 'spell' && hit.energyId) energy.handoff = { spellId: hit.spellId, energyId: hit.energyId };
			if(t === 'surface'){
				energy.vx = 0;
				energy.vy = 0;
				energy.x = hit.x;
				energy.y = hit.y;
			}
		}
	});

	addRune({
		id: 'generate', name: 'Generate Energy', category: 'generation', maxChildren: 1,
		blurb: 'Creates new magical energy. This is the operation that is allowed to add energy.',
		fields: [field('amount', 'Create', 'number', 4, 60, 1, 18)],
		summary: function(n){ return '+' + n.params.amount + ' energy'; },
		simulate: function(packet, node){
			const next = copyPacket(packet);
			next.amount += num(node.params.amount, 18);
			next.generated = (packet.generated || 0) + num(node.params.amount, 18);
			return next;
		},
		apply: function(energy, node){
			energy.amount += num(node.params.amount, 18);
		}
	});

	addRune({
		id: 'split', name: 'Split', category: 'split', maxChildren: 4,
		blurb: 'Divides the current energy across each branch. Nothing is copied.',
		fields: [],
		summary: function(n){ return (n.childIds ? n.childIds.length : 0) + ' ways'; },
		simulate: function(packet){ return copyPacket(packet); },
		apply: function(){}
	});

	addRune({
		id: 'expand', name: 'Expand', category: 'expansion', maxChildren: 1,
		blurb: 'Multiplies the energy\'s spread. Compress divides the same value.',
		fields: [field('factor', 'Factor', 'number', 1.25, 8, 0.25, 2)],
		summary: function(n){ return '×' + n.params.factor; },
		simulate: function(packet, node){
			const next = copyPacket(packet);
			if(!packet.locks || !packet.locks.scale) next.scale *= num(node.params.factor, 2);
			return next;
		},
		apply: function(energy, node){
			if(energy.locks && energy.locks.scale) return;
			energy.scale *= num(node.params.factor, 2);
			if(energy.zone) energy.radius = (energy.baseRadius || 120) * energy.scale;
		}
	});

	addRune({
		id: 'compress', name: 'Compress', category: 'compression', maxChildren: 1,
		blurb: 'Divides the energy\'s spread. It is the inverse of Expand.',
		fields: [field('factor', 'Factor', 'number', 1.25, 8, 0.25, 2)],
		summary: function(n){ return '÷' + n.params.factor; },
		simulate: function(packet, node){
			const next = copyPacket(packet);
			if(!packet.locks || !packet.locks.scale) next.scale /= num(node.params.factor, 2);
			return next;
		},
		apply: function(energy, node){
			if(energy.locks && energy.locks.scale) return;
			energy.scale /= num(node.params.factor, 2);
			if(energy.zone) energy.radius = (energy.baseRadius || 120) * energy.scale;
		}
	});

	addRune({
		id: 'power', name: 'Power', category: 'power', maxChildren: 1,
		blurb: 'Changes the magnitude of the energy being manipulated.',
		fields: [
			field('mode', 'Mode', 'select', 0, 0, 0, 'multiply', { options: [
				{ id: 'multiply', label: 'Multiply' },
				{ id: 'set', label: 'Set' }
			]}),
			field('value', 'Value', 'number', 0.25, 40, 0.05, 1.5)
		],
		summary: function(n){
			return n.params.mode === 'set' ? 'set ' + n.params.value : '×' + n.params.value;
		},
		simulate: function(packet, node, ctx){
			const next = copyPacket(packet);
			if(packet.locks && packet.locks.power) return next;
			const mode = node.params.mode || 'multiply';
			const value = num(node.params.value, 1.5);
			next.power = mode === 'set' ? value : packet.power * value;
			return next;
		},
		apply: function(energy, node, inst, adapter){
			if(energy.locks && energy.locks.power) return;
			const mode = node.params.mode || 'multiply';
			const value = num(node.params.value, 1.5);
			const next = mode === 'set' ? value : energy.power * value;
			energy.power = sanitizePower(next, adapter.profile());
		}
	});

	addRune({
		id: 'redirect', name: 'Redirect', category: 'movement', maxChildren: 1,
		blurb: 'Aims, stops, or reverses the energy\'s motion. Negative power reverses aim into a pull.',
		fields: [field('mode', 'Motion', 'select', 0, 0, 0, 'aim', { options: [
			{ id: 'aim', label: 'Aim' },
			{ id: 'stop', label: 'Stop' },
			{ id: 'reverse', label: 'Reverse' }
		]})],
		summary: function(n){ return n.params.mode || 'aim'; },
		simulate: function(packet){ return copyPacket(packet); },
		apply: function(energy, node, inst, adapter){
			if(energy.locks && energy.locks.velocity) return;
			const mode = node.params.mode || 'aim';
			if(mode === 'stop'){ energy.vx = 0; energy.vy = 0; return; }
			if(mode === 'reverse'){ energy.vx *= -1; energy.vy *= -1; return; }
			const aim = adapter.aim();
			let tx = aim.x, ty = aim.y;
			if(energy.target){
				const live = adapter.lookup(energy.target);
				if(live){ tx = live.x; ty = live.y; }
				else { tx = energy.target.x; ty = energy.target.y; }
			}
			const dx = tx - energy.x, dy = ty - energy.y;
			const d = Math.hypot(dx, dy) || 1;
			const sign = energy.power < 0 ? -1 : 1;
			const sp = 280;
			energy.vx = dx / d * sp * sign;
			energy.vy = dy / d * sp * sign;
		}
	});

	addRune({
		id: 'shape', name: 'Shape', category: 'shape', maxChildren: 1,
		blurb: 'Gives the energy a form. Raw magic stays an unbound current until this runs.',
		fields: [field('shape', 'Form', 'select', 0, 0, 0, 'stream', { options: [
			{ id: 'unbound', label: 'Unbound current' },
			{ id: 'stream', label: 'Stream' },
			{ id: 'ring', label: 'Ring' },
			{ id: 'wave', label: 'Wave' }
		]})],
		summary: function(n){ return n.params.shape || 'stream'; },
		simulate: function(packet, node){
			const next = copyPacket(packet);
			next.shape = node.params.shape || 'stream';
			return next;
		},
		apply: function(energy, node){
			energy.shape = node.params.shape || 'stream';
		}
	});

	addRune({
		id: 'technique', name: 'Technique', category: 'technique', maxChildren: 1,
		blurb: 'Converts the current energy into a technique the caster has trained. None are known yet.',
		fields: [field('techniqueId', 'Technique', 'technique', 0, 0, 0, '')],
		summary: function(n){ return n.params.techniqueId || 'Unchosen'; },
		simulate: function(packet, node, ctx){
			const next = copyPacket(packet);
			const id = node.params.techniqueId || '';
			const p = ctx.profile;
			if(!id || !TECHNIQUES[id] || !((p.allocations || {})[id] > 0)) return next;
			const eff = efficiencyOf(id, p);
			if(packet.technique && packet.technique.id === id) return next;
			if(!packet.technique){
				next.amount *= eff;
				next.technique = { id: id, reversed: !!packet.reversed };
				next.power *= powerScaleOf(id, p);
			} else {
				next.amount *= Math.max(eff, 0.05);
				next.modifiers = (packet.modifiers || []).concat([{ id: id, reversed: false }]);
			}
			return next;
		},
		apply: function(energy, node, inst, adapter){
			const id = node.params.techniqueId || '';
			const p = adapter.profile();
			if(!id || !TECHNIQUES[id] || !((p.allocations || {})[id] > 0)){
				energy.dying = true;
				adapter.feedback('Technique unavailable', energy.x, energy.y, '#ffb4b4');
				return;
			}
			if(energy.technique && energy.technique.id === id) return;
			const eff = efficiencyOf(id, p);
			if(!energy.technique){
				energy.amount *= eff;
				energy.technique = { id: id, reversed: !!energy.reversed };
				if(!(energy.locks && energy.locks.power)) energy.power = sanitizePower(energy.power * powerScaleOf(id, p), p);
			} else {
				energy.amount *= Math.max(eff, 0.05);
				energy.modifiers = (energy.modifiers || []).concat([{ id: id, reversed: false }]);
			}
		}
	});

	addRune({
		id: 'techniqueReverse', name: 'Reverse Technique', category: 'reversal', maxChildren: 1,
		blurb: 'Flips the current technique into its reversed state. This is its own transformation.',
		fields: [],
		summary: function(){ return 'Flip state'; },
		simulate: function(packet){
			const next = copyPacket(packet);
			if(packet.technique){
				next.technique = { id: packet.technique.id, reversed: !packet.technique.reversed };
				next.reversed = !packet.technique.reversed;
			}
			return next;
		},
		apply: function(energy, node, inst, adapter){
			if(!energy.technique){
				adapter.feedback('Nothing to reverse', energy.x, energy.y, '#ffb4b4');
				return;
			}
			energy.technique.reversed = !energy.technique.reversed;
			energy.reversed = energy.technique.reversed;
		}
	});

	addRune({
		id: 'createZone', name: 'Create Zone', category: 'environment', maxChildren: 1,
		blurb: 'Turns the current energy into a zone. Later runes modify that zone.',
		fields: [field('radius', 'Radius', 'number', 70, 240, 10, 120)],
		summary: function(n){ return 'radius ' + n.params.radius; },
		simulate: function(packet, node){
			const next = copyPacket(packet);
			next.zone = true;
			next.radius = num(node.params.radius, 120) * (packet.scale || 1);
			return next;
		},
		apply: function(energy, node, inst, adapter){
			energy.zone = true;
			energy.baseRadius = num(node.params.radius, 120);
			energy.radius = energy.baseRadius * (energy.scale || 1);
			energy.vx = 0;
			energy.vy = 0;
			adapter.feedback('Zone', energy.x, energy.y - 18, '#8dffe8');
		}
	});

	addRune({
		id: 'attach', name: 'Attach', category: 'attachment', maxChildren: 1,
		blurb: 'Binds the energy to its locked target.',
		fields: [],
		summary: function(){ return 'Bind to target'; },
		simulate: function(packet){
			const next = copyPacket(packet);
			next.attached = true;
			return next;
		},
		apply: function(energy){ energy.attached = true; }
	});

	addRune({
		id: 'anchor', name: 'Anchor', category: 'attachment', maxChildren: 1,
		blurb: 'Holds the energy at its target, or at this point if it has no target.',
		fields: [],
		summary: function(){ return 'Hold place'; },
		simulate: function(packet){
			const next = copyPacket(packet);
			next.anchored = true;
			return next;
		},
		apply: function(energy){
			energy.anchored = true;
			energy.anchor = { x: energy.x, y: energy.y };
			energy.vx = 0;
			energy.vy = 0;
		}
	});

	addRune({
		id: 'lock', name: 'Lock', category: 'control', maxChildren: 1,
		blurb: 'Freezes one property so later runes cannot change it.',
		fields: [field('property', 'Property', 'select', 0, 0, 0, 'power', { options: [
			{ id: 'power', label: 'Power' },
			{ id: 'scale', label: 'Spread' },
			{ id: 'velocity', label: 'Motion' }
		]})],
		summary: function(n){ return 'Lock ' + (n.params.property || 'power'); },
		simulate: function(packet, node){
			const next = copyPacket(packet);
			next.locks = Object.assign({}, packet.locks || {});
			next.locks[node.params.property || 'power'] = true;
			return next;
		},
		apply: function(energy, node){
			energy.locks = energy.locks || {};
			energy.locks[node.params.property || 'power'] = true;
		}
	});

	function num(v, fallback){
		const n = Number(v);
		return Number.isFinite(n) ? n : fallback;
	}

	function copyPacket(packet){
		return {
			amount: packet.amount,
			power: packet.power,
			scale: packet.scale,
			technique: packet.technique ? { id: packet.technique.id, reversed: !!packet.technique.reversed } : null,
			reversed: !!packet.reversed,
			modifiers: (packet.modifiers || []).map(function(m){ return { id: m.id, reversed: !!m.reversed }; }),
			environmental: !!packet.environmental,
			shape: packet.shape || 'unbound',
			targetKind: packet.targetKind || null,
			generated: packet.generated || 0,
			locks: Object.assign({}, packet.locks || {}),
			attached: !!packet.attached,
			anchored: !!packet.anchored,
			zone: !!packet.zone,
			radius: packet.radius || 0,
			harmful: packet.harmful !== false
		};
	}

	function emptyPacket(){
		return {
			amount: 0, power: 0, scale: 1, technique: null, reversed: false, modifiers: [],
			environmental: false, shape: 'unbound', targetKind: null, generated: 0, locks: {},
			attached: false, anchored: false, zone: false, radius: 0, harmful: true
		};
	}

	function sanitizePower(value, p){
		p = p || profile();
		if(!Number.isFinite(value)) value = 1;
		if(Math.abs(value) < 0.05) value = value < 0 ? -0.05 : 0.05;
		if(!p.negativePowerUnlocked && value < 0.2) value = 0.2;
		return value;
	}

	function nodeMap(spell){
		const map = {};
		(spell.nodes || []).forEach(function(n){ map[n.id] = n; });
		return map;
	}

	function ensureLayout(spell){
		if(!spell || !Array.isArray(spell.nodes) || !spell.rootId) return spell;
		const map = nodeMap(spell);
		const root = map[spell.rootId];
		if(!root) return spell;
		spell.nodes.forEach(function(node){
			if(!RUNES[node.type]){
				node.type = node.id === spell.rootId ? 'magicBlast' : 'expand';
				node.params = Object.assign(defaultsFor(node.type), node.params || {});
			}
			if(!Array.isArray(node.childIds)) node.childIds = [];
			if(!node.params) node.params = defaultsFor(node.type);
		});
		const cells = {};
		let broken = false;
		spell.nodes.forEach(function(node){
			if(typeof node.gx !== 'number' || typeof node.gy !== 'number' || !Number.isFinite(node.gx) || !Number.isFinite(node.gy)){
				broken = true;
				return;
			}
			const key = node.gx + ',' + node.gy;
			if(cells[key]) broken = true;
			cells[key] = true;
		});
		if(broken){
			const used = {};
			const order = ['e', 'n', 's', 'w'];
			function walk(node, gx, gy){
				node.gx = gx;
				node.gy = gy;
				used[gx + ',' + gy] = true;
				(node.childIds || []).forEach(function(cid, index){
					const child = map[cid];
					if(!child) return;
					let placed = false;
					for(let k = 0; k < 4; k++){
						const step = DIRS[order[(index + k) % 4]];
						const nx = gx + step.x;
						const ny = gy + step.y;
						if(!used[nx + ',' + ny]){
							walk(child, nx, ny);
							placed = true;
							break;
						}
					}
					if(!placed) walk(child, gx + 2, gy + index + 1);
				});
			}
			walk(root, 0, 0);
		}
		ensureConnections(spell);
		return spell;
	}

	function blankSpell(slot){
		const id = uid('n');
		const spell = {
			kind: 'rune',
			version: 1,
			name: slot === 9 ? 'Ultimate Tree' : 'Magic Blast',
			isUltimate: slot === 9,
			rootId: id,
			nodes: [{
				id: id,
				type: 'magicBlast',
				parentId: null,
				childIds: [],
				params: { amount: 28, power: 8 },
				gx: 0,
				gy: 0
			}],
			connections: []
		};
		const report = validate(spell);
		stamp(spell, report);
		return spell;
	}

	function stamp(spell, report){
		spell.kind = 'rune';
		spell.version = 1;
		spell.energyCost = report.energyCost;
		spell.outputUsed = report.outputUsed;
		spell.runeCount = report.runeCount;
		spell.valid = report.ok;
		return spell;
	}

	function defaultsFor(type){
		const rune = RUNES[type];
		const params = {};
		if(!rune) return params;
		(rune.fields || []).forEach(function(f){ params[f.key] = f.default; });
		return params;
	}

	function ensureConnections(spell){
		const keep = {};
		(spell.connections || []).forEach(function(c){ keep[c.parentId + '>' + c.childId] = c; });
		const next = [];
		(spell.nodes || []).forEach(function(n){
			(n.childIds || []).forEach(function(cid){
				const prev = keep[n.id + '>' + cid];
				if(prev && !prev.id) prev.id = uid('c');
				next.push(prev || {
					id: uid('c'),
					parentId: n.id,
					childId: cid,
					executionType: 'immediate',
					delay: 0,
					condition: null
				});
			});
		});
		spell.connections = next;
	}

	function connectionBetween(spell, parentId, childId){
		return (spell.connections || []).find(function(c){ return c.parentId === parentId && c.childId === childId; }) || null;
	}

	function occupied(spell, gx, gy, ignoreId){
		return (spell.nodes || []).find(function(n){ return n.gx === gx && n.gy === gy && n.id !== ignoreId; }) || null;
	}

	function subtreeIds(spell, id){
		const map = nodeMap(spell);
		const out = [];
		const stack = [id];
		const seen = {};
		while(stack.length){
			const cur = stack.pop();
			if(!cur || seen[cur]) continue;
			seen[cur] = true;
			out.push(cur);
			const node = map[cur];
			if(node) (node.childIds || []).forEach(function(cid){ stack.push(cid); });
		}
		return out;
	}

	function addChild(spell, parentId, dir, type, params){
		const parent = nodeMap(spell)[parentId];
		const step = DIRS[dir];
		if(!parent || !step) return { ok: false, reason: 'That side is not open' };
		const rune = RUNES[type];
		if(!rune || rune.rootOnly) return { ok: false, reason: 'That modification cannot be placed here' };
		const gx = parent.gx + step.x;
		const gy = parent.gy + step.y;
		if(occupied(spell, gx, gy)) return { ok: false, reason: 'A rune already occupies that cell' };
		const limit = runeLimit(parent);
		if((parent.childIds || []).length >= limit) return { ok: false, reason: limit > 1 ? 'Split is full' : 'This rune can only lead to one next rune. Use Split to branch.' };
		if((spell.nodes || []).length >= runeCapacity()) return { ok: false, reason: 'Rune capacity reached' };
		const node = {
			id: uid('n'),
			type: type,
			parentId: parent.id,
			childIds: [],
			params: Object.assign(defaultsFor(type), params || {}),
			gx: gx,
			gy: gy
		};
		spell.nodes.push(node);
		parent.childIds = parent.childIds || [];
		parent.childIds.push(node.id);
		ensureConnections(spell);
		return { ok: true, node: node };
	}

	function runeLimit(node){
		const rune = RUNES[node.type];
		if(!rune) return 1;
		return rune.maxChildren || 1;
	}

	function removeSubtree(spell, nodeId){
		if(nodeId === spell.rootId) return { ok: false, reason: 'The root blast stays' };
		const map = nodeMap(spell);
		const node = map[nodeId];
		if(!node) return { ok: false, reason: 'Missing rune' };
		const ids = subtreeIds(spell, nodeId);
		const drop = {};
		ids.forEach(function(id){ drop[id] = true; });
		if(node.parentId && map[node.parentId]){
			map[node.parentId].childIds = (map[node.parentId].childIds || []).filter(function(id){ return !drop[id]; });
		}
		spell.nodes = spell.nodes.filter(function(n){ return !drop[n.id]; });
		ensureConnections(spell);
		return { ok: true };
	}

	function moveSubtree(spell, nodeId, dgx, dgy){
		if(!dgx && !dgy) return { ok: true };
		const ids = subtreeIds(spell, nodeId);
		const moving = {};
		ids.forEach(function(id){ moving[id] = true; });
		const map = nodeMap(spell);
		for(let i = 0; i < ids.length; i++){
			const n = map[ids[i]];
			if(occupied(spell, n.gx + dgx, n.gy + dgy, null) && !moving[occupied(spell, n.gx + dgx, n.gy + dgy).id]){
				return { ok: false, reason: 'Those cells are occupied' };
			}
		}
		ids.forEach(function(id){
			map[id].gx += dgx;
			map[id].gy += dgy;
		});
		return { ok: true };
	}

	function setParam(spell, nodeId, key, value){
		const node = nodeMap(spell)[nodeId];
		if(!node) return { ok: false, reason: 'Missing rune' };
		node.params = node.params || {};
		node.params[key] = value;
		return { ok: true };
	}

	function setNodeType(spell, nodeId, type){
		const node = nodeMap(spell)[nodeId];
		const rune = RUNES[type];
		if(!node || !rune) return { ok: false, reason: 'Unknown modification' };
		if(nodeId === spell.rootId) return { ok: false, reason: 'The root is Basic Magic Blast' };
		if(rune.rootOnly) return { ok: false, reason: 'That rune can only be the root' };
		if((node.childIds || []).length > (rune.maxChildren || 1)) return { ok: false, reason: 'Remove branches before changing this rune' };
		node.type = type;
		node.params = defaultsFor(type);
		return { ok: true };
	}

	function setConnection(spell, parentId, childId, patch){
		ensureConnections(spell);
		const conn = connectionBetween(spell, parentId, childId);
		if(!conn) return { ok: false, reason: 'Missing connection' };
		if(patch.executionType) conn.executionType = patch.executionType;
		if(patch.delay != null) conn.delay = clamp(Number(patch.delay) || 0, 0, 20);
		if('condition' in patch) conn.condition = patch.condition;
		if(conn.executionType === 'immediate'){
			conn.delay = 0;
			conn.condition = null;
		}
		if(conn.executionType === 'delay') conn.condition = null;
		if(conn.executionType === 'condition' && !conn.condition){
			conn.condition = { type: 'enemyNearby', distance: 160 };
		}
		return { ok: true, connection: conn };
	}

	function ancestor(spell, nodeId, pred){
		const map = nodeMap(spell);
		let id = map[nodeId] ? map[nodeId].parentId : null;
		const seen = {};
		while(id && !seen[id]){
			seen[id] = true;
			const n = map[id];
			if(!n) break;
			if(pred(n)) return n;
			id = n.parentId;
		}
		return null;
	}

	function validate(spell, profileOverride){
		const p = Object.assign(defaultProfile(), profile(), profileOverride || {});
		const errors = [];
		const warnings = [];
		const cap = runeCapacity(p);
		if(!spell || !spell.nodes || !spell.rootId){
			return { ok: false, errors: [{ nodeId: null, code: 'missing', text: 'This spell has no root.' }], warnings: [], energyCost: 0, outputUsed: 0, runeCount: 0, capacity: cap, leaves: [] };
		}
		const map = nodeMap(spell);
		const root = map[spell.rootId];
		const runeCount = spell.nodes.length;
		if(!root) errors.push({ nodeId: null, code: 'missing', text: 'The root rune is missing.' });
		if(root && root.type !== 'magicBlast') errors.push({ nodeId: root.id, code: 'root', text: 'The spell must begin with Basic Magic Blast.' });
		if(runeCount > cap) errors.push({ nodeId: null, code: 'capacity', text: 'Rune capacity exceeded (' + runeCount + ' / ' + cap + ').' });
		if(runeCount > MAX_RUNES) errors.push({ nodeId: null, code: 'capacity', text: 'A spell can hold at most 100 runes.' });

		const parentCount = {};
		spell.nodes.forEach(function(n){
			if(!RUNES[n.type]) errors.push({ nodeId: n.id, code: 'rune', text: 'Unknown modification.' });
			(n.childIds || []).forEach(function(cid){
				parentCount[cid] = (parentCount[cid] || 0) + 1;
				if(!map[cid]) errors.push({ nodeId: n.id, code: 'connection', text: 'A connection leads to a missing rune.' });
			});
			if(n.id !== spell.rootId && !n.parentId) errors.push({ nodeId: n.id, code: 'tree', text: 'This rune is disconnected from the tree.' });
			if((n.childIds || []).length > 1 && n.type !== 'split'){
				errors.push({ nodeId: n.id, code: 'branch', text: 'Only Split can lead to more than one rune.' });
			}
			const limit = runeLimit(n);
			if((n.childIds || []).length > limit) errors.push({ nodeId: n.id, code: 'branch', text: 'Too many branches leave this rune.' });
		});
		Object.keys(parentCount).forEach(function(id){
			if(parentCount[id] > 1) errors.push({ nodeId: id, code: 'tree', text: 'A rune cannot have two parents.' });
		});

		const seen = {};
		function see(id, stack){
			if(!id || !map[id]) return;
			if(stack[id]){
				errors.push({ nodeId: id, code: 'cycle', text: 'The tree loops back on itself.' });
				return;
			}
			if(seen[id]){
				errors.push({ nodeId: id, code: 'tree', text: 'Two paths reach the same rune.' });
				return;
			}
			seen[id] = true;
			stack[id] = true;
			(map[id].childIds || []).forEach(function(cid){ see(cid, stack); });
			delete stack[id];
		}
		if(root) see(root.id, {});
		spell.nodes.forEach(function(n){
			if(!seen[n.id]) errors.push({ nodeId: n.id, code: 'tree', text: 'This rune is outside the spell tree.' });
		});

		(spell.connections || []).forEach(function(c){
			if(c.executionType === 'delay' && !(c.delay > 0)){
				errors.push({ nodeId: c.childId, code: 'connection', text: 'This delay needs a duration.' });
			}
			if(c.executionType === 'condition'){
				if(!c.condition || !CONDITIONS[c.condition.type]){
					errors.push({ nodeId: c.childId, code: 'connection', text: 'This connection needs one condition.' });
				}
			}
		});

		const leaves = [];
		let energyCost = 0;

		/* Parent packet is passed down. Cycles are already reported. */
		const walked = {};
		function flow(id, packet){
			const node = map[id];
			if(!node || !RUNES[node.type] || walked[id]) return;
			walked[id] = true;
			const rune = RUNES[node.type];
			checkParams(node, p, errors);
			if(node.type === 'attach' || node.type === 'anchor'){
				const prior = ancestor(spell, node.id, function(n){ return n.type === 'target'; });
				if(!prior && !(packet && packet.targetKind)){
					errors.push({ nodeId: node.id, code: 'target', text: 'This modification has no valid target. Place a Target rune before it.' });
				}
			}
			if(node.type === 'technique'){
				const tid = node.params.techniqueId || '';
				if(!tid || !TECHNIQUES[tid]){
					errors.push({ nodeId: node.id, code: 'technique', text: 'Technique unavailable. No technique is selected, or none are known yet.' });
				} else if(!((p.allocations || {})[tid] > 0)){
					errors.push({ nodeId: node.id, code: 'technique', text: 'Technique unavailable. You have no points in this technique.' });
				}
			}
			if(node.type === 'techniqueReverse' && !(packet && packet.technique)){
				errors.push({ nodeId: node.id, code: 'technique', text: 'Technique reversal has no technique on this energy yet.' });
			}
			if(node.type === 'split' && (node.childIds || []).length < 2){
				warnings.push({ nodeId: node.id, code: 'split', text: 'Split has fewer than two branches, so nothing is divided yet.' });
			}
			let next = packet;
			try{
				next = rune.simulate(packet, node, { profile: p, spell: spell }) || packet;
			}catch(err){
				errors.push({ nodeId: node.id, code: 'rune', text: 'This modification could not be read.' });
				next = packet;
			}
			if(node.type === 'magicBlast') energyCost += Math.max(0, next.amount);
			if(node.type === 'generate' && !(packet && packet.environmental)) energyCost += Math.max(0, num(node.params.amount, 0));
			if(node.type === 'power' || node.type === 'magicBlast' || (next.technique && rune.id === 'technique')){
				const pow = next.power;
				if(!Number.isFinite(pow) || Math.abs(pow) < 0.05){
					errors.push({ nodeId: node.id, code: 'power', text: 'Invalid power. Power cannot be zero.' });
				} else if(!p.negativePowerUnlocked && pow <= 0){
					errors.push({ nodeId: node.id, code: 'power', text: 'Invalid power. Negative power is not unlocked.' });
				}
			}
			const kids = node.childIds || [];
			if(!kids.length){
				leaves.push({ nodeId: node.id, amount: next.amount, power: next.power, scale: next.scale, technique: next.technique });
				return;
			}
			if(node.type === 'split' && kids.length > 1){
				kids.forEach(function(cid){
					const part = copyPacket(next);
					part.amount = next.amount / kids.length;
					flow(cid, part);
				});
			} else {
				flow(kids[0], next);
			}
		}
		if(root && RUNES[root.type]) flow(root.id, emptyPacket());

		let outputUsed = 0;
		leaves.forEach(function(leaf){ outputUsed += Math.abs(leaf.power || 0); });
		if(outputUsed - p.maxOutput > 0.01){
			errors.push({ nodeId: null, code: 'output', text: 'Max output exceeded (' + trimNum(outputUsed) + ' / ' + p.maxOutput + '). The whole tree shares one output budget.' });
		}
		if(energyCost - p.maxEnergy > 0.01){
			errors.push({ nodeId: null, code: 'energy', text: 'This spell needs ' + trimNum(energyCost) + ' energy, above the reserve of ' + p.maxEnergy + '.' });
		}

		return {
			ok: errors.length === 0,
			errors: errors,
			warnings: warnings,
			energyCost: Math.round(energyCost * 10) / 10,
			outputUsed: Math.round(outputUsed * 10) / 10,
			runeCount: runeCount,
			capacity: cap,
			leaves: leaves
		};
	}

	function checkParams(node, p, errors){
		const rune = RUNES[node.type];
		if(!rune) return;
		(rune.fields || []).forEach(function(f){
			if(f.type === 'technique' || f.type === 'select') return;
			const value = num(node.params && node.params[f.key], f.default);
			let min = f.min, max = f.max;
			if(node.type === 'power' && f.key === 'value' && p.negativePowerUnlocked && node.params.mode === 'set') min = -40;
			if(value < min || value > max){
				errors.push({ nodeId: node.id, code: 'param', text: 'Missing or invalid ' + f.label.toLowerCase() + ' on this rune.' });
			}
		});
	}

	function trimNum(n){
		return Math.round(n * 10) / 10;
	}

	function missText(kind){
		if(kind === 'enemy') return 'No enemy to lock';
		if(kind === 'ally') return 'No ally to lock';
		if(kind === 'projectile') return 'No projectile to lock';
		if(kind === 'spell') return 'No spell to lock';
		return 'Target failed';
	}

	function resolveTarget(kind, energy, inst, adapter){
		if(kind === 'self'){
			const c = adapter.caster();
			return { id: 'player', x: c.x, y: c.y };
		}
		if(kind === 'enemy'){
			const list = adapter.hostiles();
			let best = null, bestD = 1e9;
			for(let i = 0; i < list.length; i++){
				const h = list[i];
				const hx = h.x + (h.w || 0) / 2, hy = h.y + (h.h || 0) / 2;
				const d = Math.hypot(hx - energy.x, hy - energy.y);
				if(h.alive && d < bestD){ best = h; bestD = d; }
			}
			if(!best){
				for(let i = 0; i < list.length; i++){
					const h = list[i];
					const d = Math.hypot(h.x - energy.x, h.y - energy.y);
					if(d < bestD){ best = h; bestD = d; }
				}
			}
			if(!best) return null;
			return { id: best.id, x: best.x + best.w / 2, y: best.y + best.h / 2 };
		}
		if(kind === 'ally'){
			const list = adapter.allies();
			if(!list.length) return null;
			return { id: list[0].id, x: list[0].x, y: list[0].y };
		}
		if(kind === 'surface'){
			const g = adapter.groundAt(energy.x, energy.y);
			return { id: 'surface', x: g.x, y: g.y };
		}
		if(kind === 'environment'){
			return { id: 'environment', x: energy.x, y: energy.y };
		}
		if(kind === 'projectile'){
			const list = adapter.projectiles();
			let best = null, bestD = 1e9;
			for(let i = 0; i < list.length; i++){
				const p = list[i];
				const d = Math.hypot(p.x - energy.x, p.y - energy.y);
				if(d < bestD){ best = p; bestD = d; }
			}
			if(!best) return null;
			return { id: best.id, x: best.x, y: best.y };
		}
		if(kind === 'spell'){
			let best = null, bestD = 1e9;
			const spells = adapter.instances();
			for(let i = 0; i < spells.length; i++){
				const s = spells[i];
				if(!s.alive || s.id === inst.id) continue;
				for(let j = 0; j < s.energies.length; j++){
					const e = s.energies[j];
					if(e.dying) continue;
					const d = Math.hypot(e.x - energy.x, e.y - energy.y);
					if(d < bestD){ best = { spellId: s.id, energyId: e.id, x: e.x, y: e.y }; bestD = d; }
				}
			}
			return best;
		}
		return null;
	}

	function makeEnergy(inst, x, y, aim){
		return {
			id: uid('e'),
			spellId: inst.id,
			amount: 0,
			power: 1,
			scale: 1,
			technique: null,
			reversed: false,
			modifiers: [],
			x: x, y: y, vx: 0, vy: 0,
			aim: aim,
			shape: 'unbound',
			target: null,
			environmental: false,
			harmful: true,
			zone: false,
			radius: 0,
			baseRadius: 120,
			attached: false,
			anchored: false,
			anchor: null,
			locks: {},
			handoff: null,
			fade: 1,
			dying: false,
			waiting: false,
			trail: [],
			hitCd: {},
			born: 0
		};
	}

	function cloneEnergy(ownerSpell, energy, amount){
		return {
			id: uid('e'),
			spellId: ownerSpell.id,
			amount: amount,
			power: energy.power,
			scale: energy.scale,
			technique: energy.technique ? { id: energy.technique.id, reversed: !!energy.technique.reversed } : null,
			reversed: !!energy.reversed,
			modifiers: (energy.modifiers || []).map(function(m){ return { id: m.id, reversed: !!m.reversed }; }),
			x: energy.x, y: energy.y, vx: energy.vx, vy: energy.vy,
			aim: energy.aim,
			shape: energy.shape,
			target: energy.target ? Object.assign({}, energy.target) : null,
			environmental: energy.environmental,
			harmful: energy.harmful,
			zone: energy.zone,
			radius: energy.radius,
			baseRadius: energy.baseRadius,
			attached: energy.attached,
			anchored: energy.anchored,
			anchor: energy.anchor ? Object.assign({}, energy.anchor) : null,
			locks: Object.assign({}, energy.locks || {}),
			handoff: null,
			fade: 1,
			dying: false,
			waiting: false,
			trail: energy.trail ? energy.trail.slice(-6) : [],
			hitCd: {},
			born: energy.born || 0
		};
	}

	function findEnergy(adapter, spellId, energyId){
		const inst = adapter.instances().find(function(s){ return s.id === spellId; });
		if(!inst) return null;
		const energy = inst.energies.find(function(e){ return e.id === energyId; });
		return energy ? { inst: inst, energy: energy } : null;
	}

	function divideEnergy(adapter, energy, count){
		const owner = adapter.instances().find(function(s){ return s.id === energy.spellId; });
		if(!owner || count < 2) return [energy];
		const parts = [];
		for(let i = 0; i < count; i++){
			const part = cloneEnergy(owner, energy, energy.amount / count);
			const spread = (i - (count - 1) / 2) * 0.42;
			const ang = Math.atan2(energy.vy || 0, energy.vx || 1) + spread;
			const sp = Math.hypot(energy.vx || 0, energy.vy || 0) || 280;
			part.vx = Math.cos(ang) * sp;
			part.vy = Math.sin(ang) * sp;
			part.x += Math.cos(ang + Math.PI / 2) * (i - (count - 1) / 2) * 10;
			part.y += Math.sin(ang + Math.PI / 2) * (i - (count - 1) / 2) * 10;
			parts.push(part);
		}
		owner.energies = owner.energies.filter(function(e){ return e.id !== energy.id; });
		parts.forEach(function(p){ owner.energies.push(p); });
		return parts;
	}

	function cast(spell, slot, adapter){
		const report = validate(spell, adapter.profile());
		if(!report.ok){
			adapter.feedback(report.errors[0] ? report.errors[0].text : 'Invalid spell', null, null, '#ff9a9a');
			return null;
		}
		if(adapter.instances().filter(function(s){ return s.alive; }).length >= MAX_ACTIVE){
			adapter.feedback('Too many active spells', null, null, '#ffd39a');
			return null;
		}
		if(!adapter.preview && energyNow() + 0.001 < report.energyCost){
			adapter.feedback('Insufficient energy', null, null, '#ffd39a');
			return null;
		}
		if(!adapter.preview) setEnergy(energyNow() - report.energyCost);
		const caster = adapter.caster();
		const aimPt = adapter.aim();
		const aim = Math.atan2(aimPt.y - caster.y, aimPt.x - caster.x);
		const inst = {
			id: uid('s'),
			def: JSON.parse(JSON.stringify(spell)),
			slot: slot,
			ownerId: 'player',
			age: 0,
			life: MAX_LIFE,
			alive: true,
			energies: [],
			branches: [],
			outputUsed: report.outputUsed,
			energyCost: report.energyCost
		};
		const bolt = makeEnergy(inst, caster.x, caster.y, aim);
		inst.energies.push(bolt);
		inst.branches.push({
			id: uid('b'),
			nodeId: inst.def.rootId,
			energyId: bolt.id,
			foreignSpell: null,
			wait: 0,
			status: 'waiting',
			check: null
		});
		adapter.addInstance(inst);
		adapter.noteCast(spell, report);
		pump(inst, adapter);
		return inst;
	}

	function pump(inst, adapter){
		let guard = 0;
		while(guard++ < 140){
			const ready = inst.branches.filter(function(b){ return b.status === 'waiting' && b.wait <= 0; });
			if(!ready.length) break;
			ready.sort(function(a, b){ return a.id < b.id ? -1 : 1; });
			for(let i = 0; i < ready.length; i++) executeBranch(inst, ready[i], adapter);
		}
	}

	function branchEnergy(inst, branch, adapter){
		if(branch.foreignSpell){
			const found = findEnergy(adapter, branch.foreignSpell, branch.energyId);
			if(!found) return null;
			return { energy: found.energy, foreign: true, owner: found.inst };
		}
		const energy = inst.energies.find(function(e){ return e.id === branch.energyId; });
		if(!energy) return null;
		return { energy: energy, foreign: false, owner: inst };
	}

	function executeBranch(inst, branch, adapter){
		branch.status = 'done';
		const map = nodeMap(inst.def);
		const node = map[branch.nodeId];
		const resolved = branchEnergy(inst, branch, adapter);
		if(!node || !resolved || resolved.energy.dying){
			branch.status = 'ended';
			return;
		}
		if(branch.check){
			const cond = CONDITIONS[branch.check.type];
			const ok = cond ? cond.test(adapter, branch.check, resolved.energy) : false;
			adapter.feedback(ok ? 'Condition held' : 'Condition failed', resolved.energy.x, resolved.energy.y, ok ? '#b8f5c8' : '#ffb4b4');
			if(!ok){
				resolved.energy.dying = true;
				branch.status = 'ended';
				return;
			}
		}
		resolved.energy.waiting = false;
		const rune = RUNES[node.type];
		if(resolved.foreign){
			const key = inst.id + '->' + resolved.energy.spellId + ':' + node.type;
			adapter.pairs[key] = (adapter.pairs[key] || 0) + 1;
			if(adapter.pairs[key] > 2 || adapter.depth > 6){
				adapter.feedback('Interaction halted', resolved.energy.x, resolved.energy.y, '#ffd39a');
				branch.status = 'ended';
				return;
			}
			adapter.depth += 1;
			rune.apply(resolved.energy, node, inst, adapter);
			adapter.depth -= 1;
		} else {
			rune.apply(resolved.energy, node, inst, adapter);
		}
		inst.currentNodeId = node.id;
		scheduleChildren(inst, node, resolved.energy, adapter);
	}

	function scheduleChildren(inst, node, energy, adapter){
		let kids = (node.childIds || []).slice();
		let subject = energy;
		if(energy.handoff){
			const found = findEnergy(adapter, energy.handoff.spellId, energy.handoff.energyId);
			energy.handoff = null;
			if(!found){
				energy.dying = true;
				return;
			}
			energy.dying = true;
			subject = found.energy;
		} else if(energy.dying) return;
		if(!kids.length) return;
		let portions = [subject];
		if(node.type === 'split' && kids.length > 1) portions = divideEnergy(adapter, subject, kids.length);
		else if(kids.length > 1) kids = kids.slice(0, 1);
		for(let i = 0; i < kids.length; i++){
			const conn = connectionBetween(inst.def, node.id, kids[i]);
			const type = conn ? conn.executionType : 'immediate';
			const delay = conn ? Math.max(0, Number(conn.delay) || 0) : 0;
			const wait = type === 'immediate' ? 0 : delay;
			const portion = portions[Math.min(i, portions.length - 1)];
			portion.waiting = wait > 0;
			inst.branches.push({
				id: uid('b'),
				nodeId: kids[i],
				energyId: portion.id,
				foreignSpell: portion.spellId !== inst.id ? portion.spellId : null,
				wait: wait,
				status: 'waiting',
				check: type === 'condition' ? conn.condition : null
			});
		}
	}

	function tick(adapter, dt){
		dt = Math.max(0, Math.min(0.05, dt || 0));
		if(!adapter.preview){
			setEnergy(energyNow() + 16 * dt);
			saveTimer += dt;
			if(saveTimer > 2){ persist(false); saveTimer = 0; }
		}
		adapter.pairs = {};
		adapter.depth = 0;
		const list = adapter.instances().slice().sort(function(a, b){ return a.id < b.id ? -1 : 1; });
		for(let i = 0; i < list.length; i++){
			const inst = list[i];
			if(!inst.alive) continue;
			inst.age += dt;
			if(inst.age >= inst.life){
				endInstance(inst);
				continue;
			}
			for(let b = 0; b < inst.branches.length; b++){
				const br = inst.branches[b];
				if(br.status === 'waiting' && br.wait > 0) br.wait -= dt;
			}
			moveEnergies(inst, adapter, dt);
			pump(inst, adapter);
			cancelOpposites(adapter);
			if(!inst.energies.some(function(e){ return !e.dying && e.fade > 0.05; }) && inst.branches.every(function(b){ return b.status !== 'waiting'; })){
				endInstance(inst);
			}
		}
		adapter.instances().forEach(function(inst){
			if(!inst.alive) return;
			inst.energies = inst.energies.filter(function(e){ return e.fade > 0; });
		});
	}

	function endInstance(inst){
		inst.alive = false;
		inst.energies.forEach(function(e){ e.dying = true; e.fade = 0; });
	}

	function moveEnergies(inst, adapter, dt){
		for(let i = 0; i < inst.energies.length; i++){
			const e = inst.energies[i];
			if(e.fade <= 0) continue;
			if(e.dying){ e.fade -= dt * 1.8; continue; }
			if(e.target && e.target.kind !== 'environment'){
				const live = adapter.lookup(e.target);
				if(live){
					e.target.x = live.x + (live.w ? live.w / 2 : 0);
					e.target.y = live.y + (live.h ? live.h / 2 : 0);
				}
			}
			if(e.zone || e.anchored){
				if(e.anchored && e.target && e.attached){
					e.x = e.target.x;
					e.y = e.target.y;
				} else if(e.anchor && e.anchored && !e.attached){
					e.x = e.anchor.x;
					e.y = e.anchor.y;
				}
			} else if(e.attached && e.target){
				e.x += (e.target.x - e.x) * Math.min(1, dt * 6);
				e.y += (e.target.y - e.y) * Math.min(1, dt * 6);
			} else if(e.target && (e.target.kind === 'enemy' || e.target.kind === 'projectile' || e.target.kind === 'ally')){
				const dx = e.target.x - e.x, dy = e.target.y - e.y;
				const d = Math.hypot(dx, dy) || 1;
				const sign = e.power < 0 ? -1 : 1;
				e.vx = dx / d * 280 * sign;
				e.vy = dy / d * 280 * sign;
				e.x += e.vx * dt;
				e.y += e.vy * dt;
			} else if(e.target && e.target.kind === 'self'){
				const c = adapter.caster();
				const ang = inst.age * 2.2 + i;
				e.x = c.x + Math.cos(ang) * (28 + e.scale * 8);
				e.y = c.y + Math.sin(ang) * 16;
				e.harmful = false;
			} else {
				e.x += e.vx * dt;
				e.y += e.vy * dt;
			}
			if(!e.zone && !e.anchored && !e.attached && !e.waiting){
				e.flight = (e.flight || 0) + dt;
				if(e.flight > 3.6) e.dying = true;
			}
			e.trail.push({ x: e.x, y: e.y });
			if(e.trail.length > 22) e.trail.shift();
			if(e.harmful && e.power > 0 && !e.environmental) strike(e, adapter, dt);
			else if(e.power < 0 && e.target && e.target.kind === 'enemy') pull(e, adapter);
		}
	}

	function strike(energy, adapter, dt){
		const list = adapter.hostiles();
		const rad = energy.zone ? (energy.radius || 80) : Math.max(18, 14 * energy.scale + Math.sqrt(Math.max(energy.amount, 1)) * 1.4);
		for(let i = 0; i < list.length; i++){
			const h = list[i];
			if(!h.alive || !h.ref || h.ref === adapter.playerRef()) continue;
			if(h.id === 'player' || h.kind === 'player') continue;
			if(energy.target && energy.target.kind === 'enemy' && energy.target.id && energy.target.id !== h.id) continue;
			const hx = h.x + h.w / 2, hy = h.y + h.h / 2;
			const reach = rad + Math.max(h.w, h.h) * 0.35;
			if(Math.hypot(hx - energy.x, hy - energy.y) > reach) continue;
			const key = h.id;
			if((energy.hitCd[key] || 0) > 0) continue;
			energy.hitCd[key] = energy.zone ? 0.45 : 0.28;
			const dmg = Math.max(1, Math.abs(energy.power) * (energy.amount / 16) * (energy.zone ? 0.45 : 1));
			adapter.damage(h, dmg);
		}
		Object.keys(energy.hitCd).forEach(function(k){
			energy.hitCd[k] -= dt || 0;
		});
	}

	function pull(energy, adapter){
		const list = adapter.hostiles();
		for(let i = 0; i < list.length; i++){
			const h = list[i];
			if(!h.alive) continue;
			if(energy.target && energy.target.id && energy.target.id !== h.id) continue;
			const hx = h.x + h.w / 2, hy = h.y + h.h / 2;
			if(Math.hypot(hx - energy.x, hy - energy.y) > 90) continue;
			adapter.nudge(h, energy.x - hx, energy.y - hy, Math.abs(energy.power));
		}
	}

	function cancelOpposites(adapter){
		const all = [];
		adapter.instances().forEach(function(inst){
			if(!inst.alive) return;
			inst.energies.forEach(function(e){
				if(!e.dying && e.technique) all.push(e);
			});
		});
		all.sort(function(a, b){ return a.id < b.id ? -1 : 1; });
		const used = {};
		for(let i = 0; i < all.length; i++){
			for(let j = i + 1; j < all.length; j++){
				const a = all[i], b = all[j];
				if(used[a.id] || used[b.id]) continue;
				if(!a.technique || !b.technique) continue;
				if(a.technique.id !== b.technique.id) continue;
				if(!!a.technique.reversed === !!b.technique.reversed) continue;
				if(Math.hypot(a.x - b.x, a.y - b.y) > 70) continue;
				const magA = a.amount * Math.abs(a.power);
				const magB = b.amount * Math.abs(b.power);
				const cancel = Math.min(magA, magB);
				if(magA > 0) a.amount *= Math.max(0, 1 - cancel / magA);
				if(magB > 0) b.amount *= Math.max(0, 1 - cancel / magB);
				if(a.amount < 0.4) a.dying = true;
				if(b.amount < 0.4) b.dying = true;
				used[a.id] = true;
				used[b.id] = true;
			}
		}
	}

	/* ---------- drawing: flowing current, not dots ---------- */

	function paintEnergy(ctx, energy, time){
		if(!energy || energy.fade <= 0.02) return;
		const alpha = Math.max(0, Math.min(1, energy.fade));
		ctx.save();
		ctx.globalAlpha = alpha;
		ctx.globalCompositeOperation = 'lighter';
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		if(energy.zone) paintZone(ctx, energy, time);
		else if(energy.shape === 'ring') paintRingForm(ctx, energy, time);
		else paintCurrent(ctx, energy, time);
		ctx.restore();
	}

	function paintCurrent(ctx, energy, time){
		const pts = (energy.trail && energy.trail.length) ? energy.trail.map(function(p){ return { x: p.x, y: p.y }; }) : [];
		pts.push({ x: energy.x, y: energy.y });
		if(pts.length < 2){
			const ang = Math.atan2(energy.vy || 0.01, energy.vx || 1);
			pts.unshift({ x: energy.x - Math.cos(ang) * 36, y: energy.y - Math.sin(ang) * 36 });
		}
		const mass = (energy.shape === 'stream' ? 7 : 12) + Math.sqrt(Math.max(energy.amount, 1)) * 1.15 * Math.max(0.35, energy.scale || 1);
		const amp = energy.shape === 'wave' ? mass * 0.55 : mass * 0.22;
		ctx.shadowColor = 'rgba(170, 214, 255, 0.95)';
		ctx.shadowBlur = 16;
		strokeRibbon(ctx, pts, time, amp, mass * 1.55, 'rgba(86, 156, 255, 0.22)');
		ctx.shadowBlur = 8;
		strokeRibbon(ctx, pts, time * 1.15, amp * 0.65, Math.max(3.5, mass * 0.55), 'rgba(186, 230, 255, 0.72)');
		ctx.shadowBlur = 0;
		strokeRibbon(ctx, pts, time * 1.4, amp * 0.28, Math.max(1.6, mass * 0.16), 'rgba(255, 255, 255, 0.92)');
		const head = pts[pts.length - 1];
		const prev = pts[pts.length - 2];
		const ang = Math.atan2(head.y - prev.y, head.x - prev.x);
		ctx.save();
		ctx.translate(head.x, head.y);
		ctx.rotate(ang);
		const len = mass * (energy.shape === 'stream' ? 2.4 : 1.5);
		const grd = ctx.createLinearGradient(-len, 0, len * 0.8, 0);
		grd.addColorStop(0, 'rgba(120, 190, 255, 0)');
		grd.addColorStop(0.45, 'rgba(210, 236, 255, 0.35)');
		grd.addColorStop(0.78, 'rgba(255, 255, 255, 0.95)');
		grd.addColorStop(1, 'rgba(188, 160, 255, 0)');
		ctx.fillStyle = grd;
		ctx.beginPath();
		ctx.ellipse(0, 0, len, Math.max(4, mass * 0.42), 0, 0, Math.PI * 2);
		ctx.fill();
		ctx.restore();
	}

	function strokeRibbon(ctx, pts, time, amp, width, color){
		ctx.beginPath();
		const first = wobble(pts[0], pts[1], 0, time, amp);
		ctx.moveTo(first.x, first.y);
		for(let i = 1; i < pts.length - 1; i++){
			const a = wobble(pts[i - 1], pts[i], i, time, amp);
			const b = wobble(pts[i], pts[i + 1], i + 0.5, time, amp);
			ctx.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2);
		}
		const last = pts[pts.length - 1];
		ctx.lineTo(last.x, last.y);
		ctx.strokeStyle = color;
		ctx.lineWidth = width;
		ctx.stroke();
	}

	function wobble(a, b, i, time, amp){
		const dx = b.x - a.x, dy = b.y - a.y;
		const len = Math.hypot(dx, dy) || 1;
		const nx = -dy / len, ny = dx / len;
		const w = Math.sin(time * 3.1 + i * 0.9) * amp;
		return { x: a.x + nx * w, y: a.y + ny * w };
	}

	function paintRingForm(ctx, energy, time){
		const r = Math.max(16, 18 * (energy.scale || 1) + Math.sqrt(energy.amount) * 0.8);
		ctx.shadowColor = 'rgba(180, 220, 255, 0.9)';
		ctx.shadowBlur = 14;
		for(let i = 0; i < 3; i++){
			ctx.beginPath();
			const a0 = time * (1.4 + i * 0.2) + i * 2.1;
			ctx.arc(energy.x, energy.y, r * (0.72 + i * 0.16), a0, a0 + Math.PI * 1.15);
			ctx.strokeStyle = i === 2 ? 'rgba(255,255,255,0.9)' : 'rgba(150, 210, 255, 0.75)';
			ctx.lineWidth = i === 2 ? 2 : 5;
			ctx.stroke();
		}
	}

	function paintZone(ctx, energy, time){
		const r = energy.radius || 120;
		ctx.shadowColor = 'rgba(140, 255, 226, 0.8)';
		ctx.shadowBlur = 18;
		ctx.beginPath();
		ctx.arc(energy.x, energy.y, r, 0, Math.PI * 2);
		ctx.strokeStyle = 'rgba(150, 255, 230, 0.28)';
		ctx.lineWidth = 10;
		ctx.stroke();
		for(let i = 0; i < 4; i++){
			ctx.beginPath();
			const a0 = time * (0.8 + i * 0.15) * (i % 2 ? -1 : 1) + i;
			ctx.arc(energy.x, energy.y, r * (0.55 + i * 0.12), a0, a0 + 1.7);
			ctx.strokeStyle = i % 2 ? 'rgba(255,255,255,0.85)' : 'rgba(120, 255, 220, 0.7)';
			ctx.lineWidth = i % 2 ? 2 : 4;
			ctx.stroke();
		}
		ctx.shadowBlur = 0;
		ctx.beginPath();
		ctx.arc(energy.x, energy.y, r * 0.92, 0, Math.PI * 2);
		const g = ctx.createRadialGradient(energy.x, energy.y, r * 0.2, energy.x, energy.y, r);
		g.addColorStop(0, 'rgba(180, 255, 240, 0.05)');
		g.addColorStop(1, 'rgba(80, 140, 255, 0)');
		ctx.fillStyle = g;
		ctx.fill();
	}

	function paintAll(ctx, adapter, project, time){
		const spells = adapter.instances();
		for(let i = 0; i < spells.length; i++){
			const energies = spells[i].energies || [];
			for(let j = 0; j < energies.length; j++){
				const src = energies[j];
				const view = projectEnergy(src, project);
				paintEnergy(ctx, view, time);
			}
		}
	}

	function projectEnergy(energy, project){
		if(!project) return energy;
		const head = project(energy.x, energy.y);
		const copy = Object.assign({}, energy);
		copy.x = head.x;
		copy.y = head.y;
		copy.trail = (energy.trail || []).map(function(p){ return project(p.x, p.y); });
		return copy;
	}

	/* ---------- dungeon adapter ---------- */

	let debugOn = false;
	let lastTick = 0;

	function playerRef(){
		return (typeof player !== 'undefined') ? player : null;
	}

	function dungeonAdapter(){
		return {
			preview: false,
			pairs: {},
			depth: 0,
			profile: profile,
			playerRef: playerRef,
			trySpend: function(n){ return energyNow() >= n; },
			feedback: function(text, x, y, color){
				if(typeof dmgNumbers === 'undefined') return;
				const c = this.caster();
				dmgNumbers.push({ x: x == null ? c.x : x, y: y == null ? c.y - 30 : y, text: text, age: 0, color: color || '#c5e4ff' });
			},
			instances: function(){ return liveInstances; },
			addInstance: function(inst){ liveInstances.push(inst); },
			noteCast: function(spell, report){
				if(typeof player !== 'undefined'){
					player.castTimer = 12;
					player.castColor = '#b7dcff';
					player.hasCast = true;
				}
				if(typeof spellCooldowns !== 'undefined'){
					const frames = Math.round(40 + Math.min(50, report.outputUsed));
					spellCooldowns[activeSlot] = frames;
					spellMaxCooldowns[activeSlot] = frames;
				}
				this.feedback(spell.name || 'Spell', null, null, '#d7ecff');
				if(typeof renderHotbar === 'function') renderHotbar();
			},
			caster: function(){
				const p = playerRef();
				if(!p) return { id: 'player', x: 0, y: 0, w: 32, h: 48, alive: true };
				return { id: 'player', x: p.x + p.w / 2, y: p.y + p.h * 0.42, w: p.w, h: p.h, alive: typeof health === 'undefined' || health > 0 };
			},
			aim: function(){
				if(typeof mouseScreenX === 'number' && typeof camera !== 'undefined'){
					return { x: mouseScreenX + camera.x, y: mouseScreenY + camera.y };
				}
				const c = this.caster();
				return { x: c.x + 200, y: c.y };
			},
			hostiles: liveHostiles,
			allies: liveAllies,
			projectiles: liveProjectiles,
			groundAt: function(x){
				const gy = (typeof GROUND_Y === 'number') ? GROUND_Y : 0;
				return { x: x, y: gy - 6 };
			},
			lookup: function(target){
				if(!target) return null;
				if(target.kind === 'self' || target.id === 'player') return this.caster();
				const lists = liveHostiles().concat(liveAllies()).concat(liveProjectiles());
				for(let i = 0; i < lists.length; i++) if(lists[i].id === target.id) return lists[i];
				return null;
			},
			damage: function(h, amount){
				if(!h || !h.ref || h.ref === playerRef()) return;
				const dmg = Math.max(1, Math.round(amount));
				h.ref.hp -= dmg;
				h.ref.flash = 8;
				if(typeof dmgNumbers !== 'undefined') dmgNumbers.push({ x: h.x + (h.w || 0) / 2, y: h.y - 10, text: String(dmg), age: 0, color: '#d5ecff' });
			},
			nudge: function(h, dx, dy, mag){
				if(!h || !h.ref || h.ref === playerRef()) return;
				const d = Math.hypot(dx, dy) || 1;
				const kick = Math.min(3.2, mag * 0.05);
				h.ref.vx = (h.ref.vx || 0) + dx / d * kick;
				h.ref.vy = (h.ref.vy || 0) - Math.abs(kick) * 0.15;
			}
		};
	}

	const liveInstances = [];

	function liveHostiles(){
		const list = [];
		if(typeof enemies !== 'undefined' && enemies){
			for(let i = 0; i < enemies.length; i++){
				const en = enemies[i];
				if(!en) continue;
				if(!en._runeId) en._runeId = uid('en');
				list.push({
					id: en._runeId, kind: 'enemy', ref: en,
					x: en.x, y: en.y, w: en.w || 32, h: en.h || 48,
					hp: en.hp, maxHp: en.maxHp || en.hp || 1,
					alive: !en.dead && en.hp > 0
				});
			}
		}
		if(typeof dummies !== 'undefined' && dummies){
			for(let i = 0; i < dummies.length; i++){
				const d = dummies[i];
				if(!d) continue;
				if(!d._runeId) d._runeId = uid('dm');
				list.push({
					id: d._runeId, kind: 'dummy', ref: d,
					x: d.x, y: d.y, w: d.w || 28, h: d.h || 48,
					hp: d.hp, maxHp: d.maxHp || 10000,
					alive: !d.dead && d.hp > 0
				});
			}
		}
		return list;
	}

	function liveAllies(){
		const list = [];
		const raw = (typeof window !== 'undefined' && window.__coopAllies) || [];
		for(let i = 0; i < raw.length; i++){
			const a = raw[i];
			if(!a) continue;
			list.push({ id: a.id || ('ally' + i), kind: 'ally', x: a.x || 0, y: a.y || 0, w: a.w || 32, h: a.h || 48, hp: a.hp, maxHp: a.maxHp || a.hp || 1, alive: a.hp == null || a.hp > 0, ref: a });
		}
		return list;
	}

	function liveProjectiles(){
		const list = [];
		function take(arr){
			if(!arr) return;
			for(let i = 0; i < arr.length; i++){
				const p = arr[i];
				if(!p || p.hasHit) continue;
				if(!p._runeId) p._runeId = uid('pj');
				list.push({ id: p._runeId, kind: 'projectile', x: p.x, y: p.y, w: 12, h: 12, vx: p.vx || 0, vy: p.vy || 0, alive: true, ref: p });
			}
		}
		if(typeof projectiles !== 'undefined') take(projectiles);
		if(typeof enemyProjectiles !== 'undefined') take(enemyProjectiles);
		return list;
	}

	function tryCast(spell, slot){
		if(typeof MeleeMode !== 'undefined' && MeleeMode.blocksCast && MeleeMode.blocksCast()) return;
		if(typeof inventoryOpen !== 'undefined' && inventoryOpen) return;
		if(typeof dialogueActive !== 'undefined' && dialogueActive) return;
		if(typeof vowLockedSlots !== 'undefined' && vowLockedSlots && vowLockedSlots.has && vowLockedSlots.has(slot)) return;
		if(typeof spellCooldowns !== 'undefined' && spellCooldowns[slot] > 0) return;
		cast(spell, slot, dungeonAdapter());
	}

	function tickDugeon(){
		const now = (typeof performance !== 'undefined') ? performance.now() : Date.now();
		const dt = lastTick ? (now - lastTick) / 1000 : 1 / 60;
		lastTick = now;
		tick(dungeonAdapter(), dt);
		for(let i = liveInstances.length - 1; i >= 0; i--){
			if(!liveInstances[i].alive && liveInstances[i].energies.every(function(e){ return e.fade <= 0; })) liveInstances.splice(i, 1);
		}
		updateHud();
		if(debugOn) updateDebug();
	}

	function drawDungeon(){
		if(typeof ctx === 'undefined' || typeof camera === 'undefined') return;
		ctx.save();
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		const time = ((typeof performance !== 'undefined') ? performance.now() : Date.now()) / 1000;
		paintAll(ctx, dungeonAdapter(), function(x, y){ return { x: x - camera.x, y: y - camera.y }; }, time);
		if(debugOn) paintDebug(ctx, time);
		ctx.restore();
	}

	function ensureHud(){
		if(typeof document === 'undefined' || typeof canvas === 'undefined') return;
		if(document.getElementById('runeEnergyHud')) return;
		const d = document.createElement('div');
		d.id = 'runeEnergyHud';
		d.style.cssText = 'position:fixed;left:16px;bottom:78px;z-index:12;pointer-events:none;font:12px/1.35 Segoe UI,sans-serif;color:#d7ecff;background:rgba(8,12,22,.78);border:1px solid rgba(150,190,255,.35);border-radius:12px;padding:8px 12px;min-width:168px;';
		document.body.appendChild(d);
	}

	function updateHud(){
		const el = typeof document !== 'undefined' ? document.getElementById('runeEnergyHud') : null;
		if(!el) return;
		const p = profile();
		const e = energyNow();
		const pct = Math.max(0, Math.min(100, e / p.maxEnergy * 100));
		el.innerHTML = '<div style="letter-spacing:.16em;font-size:10px;color:#8eb6ff">ENERGY</div>'
			+ '<div style="font-weight:700;font-size:14px">' + Math.floor(e) + ' / ' + p.maxEnergy + '</div>'
			+ '<div style="height:5px;background:#182033;border-radius:5px;margin:5px 0 4px"><div style="height:5px;width:' + pct + '%;border-radius:5px;background:linear-gradient(90deg,#6ea8ff,#f4f8ff)"></div></div>'
			+ '<div style="color:#93a4bd">Output cap ' + p.maxOutput + ' · ' + runeCapacity() + ' runes</div>';
	}

	function updateDebug(){
		if(typeof document === 'undefined') return;
		let el = document.getElementById('runeDebug');
		if(!debugOn){ if(el) el.style.display = 'none'; return; }
		if(!el){
			el = document.createElement('div');
			el.id = 'runeDebug';
			el.style.cssText = 'position:fixed;top:12px;right:12px;z-index:40;width:320px;max-height:70vh;overflow:auto;background:rgba(6,8,14,.9);color:#d5e4ff;border:1px solid rgba(160,190,255,.35);border-radius:12px;padding:12px;font:12px/1.4 ui-monospace,monospace;pointer-events:auto';
			document.body.appendChild(el);
		}
		el.style.display = 'block';
		const p = profile();
		const lines = [];
		lines.push('<b>Rune debug</b> · F9');
		lines.push('Energy ' + Math.floor(energyNow()) + ' / ' + p.maxEnergy);
		lines.push('Max output ' + p.maxOutput + ' · Control ' + p.energyControl + ' · Cap ' + runeCapacity());
		lines.push('Technique points ' + p.techniquePoints + ' · Negative ' + (p.negativePowerUnlocked ? 'on' : 'off'));
		lines.push('Active spells ' + liveInstances.filter(function(s){ return s.alive; }).length);
		liveInstances.forEach(function(inst){
			if(!inst.alive && inst.energies.every(function(e){ return e.fade <= 0; })) return;
			lines.push('— ' + (inst.def.name || 'spell') + ' ' + trimNum(inst.life - inst.age) + 's');
			lines.push('  node ' + (inst.currentNodeId || ''));
			inst.energies.forEach(function(e){
				if(e.fade <= 0) return;
				lines.push('  ' + trimNum(e.amount) + 'e p' + trimNum(e.power) + ' ' + (e.technique ? e.technique.id + (e.technique.reversed ? ' rev' : '') : 'raw') + (e.zone ? ' zone' : '') + (e.waiting ? ' wait' : ''));
			});
		});
		el.innerHTML = lines.join('<br>');
		if(!el._wired){
			el._wired = true;
			const row = document.createElement('div');
			row.style.marginTop = '8px';
			row.innerHTML = '<button type="button" data-act="neg">Toggle negative power</button> <button type="button" data-act="cap">Control 100</button> <button type="button" data-act="clear">Dismiss spells</button>';
			row.querySelector('[data-act="neg"]').onclick = function(){
				profile().negativePowerUnlocked = !profile().negativePowerUnlocked;
				persist(true);
			};
			row.querySelector('[data-act="cap"]').onclick = function(){
				profile().energyControl = profile().energyControl >= 100 ? 16 : 100;
				persist(true);
			};
			row.querySelector('[data-act="clear"]').onclick = function(){
				liveInstances.forEach(endInstance);
			};
			el.appendChild(row);
		}
	}

	function paintDebug(ctx){
		ctx.save();
		ctx.font = '11px monospace';
		ctx.fillStyle = 'rgba(180,220,255,.85)';
		liveInstances.forEach(function(inst){
			inst.energies.forEach(function(e){
				if(e.fade <= 0) return;
				const x = e.x - camera.x, y = e.y - camera.y;
				ctx.fillText(trimNum(e.amount) + ' / ' + trimNum(e.power), x + 8, y - 8);
				if(e.target){
					ctx.strokeStyle = 'rgba(255,220,140,.7)';
					ctx.beginPath();
					ctx.moveTo(x, y);
					ctx.lineTo(e.target.x - camera.x, e.target.y - camera.y);
					ctx.stroke();
				}
			});
		});
		ctx.restore();
	}

	/* ---------- sandbox preview uses the same cast and tick ---------- */

	function createSandbox(){
		return {
			preview: true,
			time: 0,
			player: { id: 'player', x: 90, y: 120, w: 28, h: 46, alive: true, hp: 100, maxHp: 100 },
			hostile: { id: 'preview-enemy', kind: 'dummy', x: 460, y: 108, w: 30, h: 48, hp: 240, maxHp: 240, alive: true, vx: 0, vy: 0, ref: {} },
			instances: [],
			log: []
		};
	}

	function sandboxAdapter(box){
		box.hostile.ref = box.hostile;
		return {
			preview: true,
			pairs: {},
			depth: 0,
			profile: profile,
			playerRef: function(){ return null; },
			feedback: function(text){ box.log.unshift(text); box.log = box.log.slice(0, 6); },
			instances: function(){ return box.instances; },
			addInstance: function(inst){ box.instances.push(inst); },
			noteCast: function(spell, report){ box.log.unshift('Cast ' + (spell.name || 'spell') + ' · ' + report.energyCost + ' energy'); },
			caster: function(){ return { id: 'player', x: box.player.x, y: box.player.y, w: box.player.w, h: box.player.h, alive: true }; },
			aim: function(){ return { x: box.hostile.x, y: box.hostile.y }; },
			hostiles: function(){ return [box.hostile]; },
			allies: function(){ return []; },
			projectiles: function(){ return []; },
			groundAt: function(x, y){ return { x: x, y: (y || 120) + 36 }; },
			lookup: function(target){
				if(!target) return null;
				if(target.kind === 'self' || target.id === 'player') return this.caster();
				if(target.id === box.hostile.id) return box.hostile;
				return null;
			},
			damage: function(h, amount){
				if(!h || h.id === 'player') return;
				h.hp -= amount;
				if(h.hp < 0) h.hp = 0;
			},
			nudge: function(h, dx, dy, mag){
				if(!h) return;
				const d = Math.hypot(dx, dy) || 1;
				h.x += dx / d * Math.min(6, mag * 0.08);
			}
		};
	}

	function castSandbox(box, spell){
		return cast(spell, 0, sandboxAdapter(box));
	}

	function tickSandbox(box, dt){
		box.time += dt;
		tick(sandboxAdapter(box), dt);
		box.instances = box.instances.filter(function(inst){
			return inst.alive || inst.energies.some(function(e){ return e.fade > 0; });
		});
	}

	function paintSandbox(ctx, box, rect, time){
		ctx.save();
		ctx.beginPath();
		ctx.rect(rect.x, rect.y, rect.w, rect.h);
		ctx.clip();
		ctx.fillStyle = 'rgba(4, 8, 16, 0.55)';
		ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
		const scale = Math.max(0.6, Math.min(1.3, rect.w / 640));
		function project(x, y){
			return { x: rect.x + 24 + x * scale, y: rect.y + rect.h * 0.62 + (y - 120) * scale };
		}
		const ground = project(0, 150);
		ctx.strokeStyle = 'rgba(150, 180, 220, 0.35)';
		ctx.beginPath();
		ctx.moveTo(rect.x + 12, ground.y);
		ctx.lineTo(rect.x + rect.w - 12, ground.y);
		ctx.stroke();
		const caster = project(box.player.x, box.player.y);
		ctx.fillStyle = 'rgba(190, 220, 255, 0.9)';
		ctx.fillRect(caster.x - 8, caster.y - 22, 16, 28);
		const foe = project(box.hostile.x, box.hostile.y);
		ctx.fillStyle = box.hostile.hp > 0 ? 'rgba(255, 170, 150, 0.9)' : 'rgba(120,120,120,.6)';
		ctx.fillRect(foe.x - 10, foe.y - 24, 20, 32);
		paintAll(ctx, sandboxAdapter(box), project, time);
		ctx.restore();
	}

	function install(){
		if(typeof castSpell === 'function' && !castSpell._runeWrapped){
			const prev = castSpell;
			const wrapped = function(){
				const spell = (typeof playerData !== 'undefined' && playerData && playerData.spells) ? playerData.spells[activeSlot] : null;
				if(spell && spell.kind === 'rune'){
					tryCast(spell, activeSlot);
					return;
				}
				return prev.apply(this, arguments);
			};
			wrapped._runeWrapped = true;
			try{ castSpell = wrapped; }catch(e){ root.castSpell = wrapped; }
		}
		if(typeof update === 'function' && !update._runeWrapped){
			const prevU = update;
			const wrappedU = function(){ prevU(); tickDugeon(); };
			wrappedU._runeWrapped = true;
			try{ update = wrappedU; }catch(e){ root.update = wrappedU; }
		}
		if(typeof render === 'function' && !render._runeWrapped){
			const prevR = render;
			const wrappedR = function(){ prevR(); drawDungeon(); };
			wrappedR._runeWrapped = true;
			try{ render = wrappedR; }catch(e){ root.render = wrappedR; }
		}
		ensureHud();
		if(typeof renderHotbar === 'function'){
			try{ renderHotbar(); }catch(e){}
		}
		if(typeof window !== 'undefined' && !window.__runeKeys){
			window.__runeKeys = true;
			window.addEventListener('keydown', function(e){
				if(e.key === 'F9'){
					debugOn = !debugOn;
					updateDebug();
					e.preventDefault();
				}
			});
		}
	}

	function selfTest(){
		const failures = [];
		function check(name, cond){ if(!cond) failures.push(name); }
		const base = { maxEnergy: 200, maxOutput: 80, energyControl: 16, techniquePoints: 4, allocations: {}, negativePowerUnlocked: false };

		const chain = blankSpell(0);
		chain.nodes[0].params.amount = 100;
		chain.nodes[0].params.power = 10;
		let parent = chain.rootId;
		let r = addChild(chain, parent, 'e', 'expand', { factor: 2 });
		check('expand placed', r.ok);
		parent = r.node.id;
		r = addChild(chain, parent, 'e', 'compress', { factor: 5 });
		check('compress placed', r.ok);
		let report = validate(chain, base);
		check('expand then compress', report.ok && report.leaves.length === 1 && Math.abs(report.leaves[0].scale - 0.4) < 1e-9);

		const rev = blankSpell(0);
		rev.nodes[0].params.power = 10;
		r = addChild(rev, rev.rootId, 'e', 'power', { mode: 'set', value: 4 });
		check('set power', r.ok);
		r = addChild(rev, r.node.id, 'e', 'power', { mode: 'multiply', value: 2 });
		report = validate(rev, base);
		check('set then multiply', report.ok && Math.abs(report.leaves[0].power - 8) < 1e-9);

		const order = blankSpell(0);
		order.nodes[0].params.power = 10;
		r = addChild(order, order.rootId, 'e', 'power', { mode: 'multiply', value: 2 });
		r = addChild(order, r.node.id, 'e', 'power', { mode: 'set', value: 4 });
		report = validate(order, base);
		check('multiply then set differs', report.ok && Math.abs(report.leaves[0].power - 4) < 1e-9);

		const split = blankSpell(0);
		split.nodes[0].params.amount = 100;
		split.nodes[0].params.power = 20;
		r = addChild(split, split.rootId, 'e', 'split');
		check('split placed', r.ok);
		const sid = r.node.id;
		check('north', addChild(split, sid, 'n', 'expand', { factor: 2 }).ok);
		check('south', addChild(split, sid, 's', 'compress', { factor: 2 }).ok);
		report = validate(split, Object.assign({}, base, { maxOutput: 80 }));
		check('split conserves', report.ok && report.leaves.length === 2 && Math.abs(report.leaves[0].amount + report.leaves[1].amount - 100) < 1e-6);
		check('split output adds power', Math.abs(report.outputUsed - 40) < 1e-6);

		const blown = blankSpell(0);
		blown.nodes[0].params.power = 30;
		r = addChild(blown, blown.rootId, 'e', 'split');
		const dirs = ['n', 'e', 's'];
		for(let i = 0; i < 3; i++) check('branch ' + i, addChild(blown, r.node.id, dirs[i], 'power', { mode: 'set', value: 40 }).ok);
		report = validate(blown, Object.assign({}, base, { maxOutput: 80 }));
		check('branch output blocked', !report.ok && report.errors.some(function(e){ return e.code === 'output'; }));

		const zero = blankSpell(0);
		zero.nodes[0].params.power = 0;
		report = validate(zero, base);
		check('zero power rejected', !report.ok);

		const neg = blankSpell(0);
		r = addChild(neg, neg.rootId, 'e', 'power', { mode: 'set', value: -5 });
		report = validate(neg, base);
		check('negative locked', !report.ok);
		report = validate(neg, Object.assign({}, base, { negativePowerUnlocked: true, maxOutput: 80 }));
		check('negative allowed later', report.ok && report.leaves[0].power < 0);
		check('absolute output', report.outputUsed >= 5);

		let line = blankSpell(1);
		parent = line.rootId;
		for(let i = 0; i < 15; i++){
			r = addChild(line, parent, 'e', 'expand');
			if(!r.ok){ failures.push('line ' + i); break; }
			parent = r.node.id;
		}
		check('sixteenth rune fills cap', line.nodes.length === 16);
		check('past cap refused', !addChild(line, parent, 'e', 'expand').ok);

		const cyc = blankSpell(0);
		cyc.nodes[0].childIds = [cyc.rootId];
		cyc.nodes[0].parentId = cyc.rootId;
		report = validate(cyc, base);
		check('cycle rejected', !report.ok);

		const tech = blankSpell(0);
		r = addChild(tech, tech.rootId, 'e', 'technique', { techniqueId: '' });
		report = validate(tech, base);
		check('empty technique blocked', !report.ok && report.errors.some(function(e){ return e.code === 'technique'; }));

		registerTechnique({ id: 'test-technique', name: 'Test', efficiency: 0.4 });
		check('low efficiency loses more', efficiencyOf('test-technique', { allocations: { 'test-technique': 1 } }) < efficiencyOf('test-technique', { allocations: { 'test-technique': 4 } }));
		check('max efficiency near full', efficiencyOf('test-technique', { allocations: { 'test-technique': 4 } }) > 0.97);
		delete TECHNIQUES['test-technique'];

		const gen = blankSpell(0);
		gen.nodes[0].params.amount = 20;
		addChild(gen, gen.rootId, 'e', 'generate', { amount: 10 });
		report = validate(gen, base);
		check('generate costs reserve', Math.abs(report.energyCost - 30) < 1e-6);

		const env = blankSpell(0);
		env.nodes[0].params.amount = 20;
		r = addChild(env, env.rootId, 'e', 'target', { target: 'environment' });
		addChild(env, r.node.id, 'e', 'generate', { amount: 15 });
		report = validate(env, base);
		check('environment generate is not reserve', Math.abs(report.energyCost - 20) < 1e-6);

		check('delay is not a rune', !RUNES.delay);
		check('no named techniques', Object.keys(TECHNIQUES).length === 0);

		function stepBox(box, seconds){
			let left = seconds;
			while(left > 0){
				const dt = Math.min(0.05, left);
				tickSandbox(box, dt);
				left -= dt;
			}
		}
		const delayed = blankSpell(0);
		delayed.nodes[0].params.amount = 40;
		delayed.nodes[0].params.power = 6;
		let placed = addChild(delayed, delayed.rootId, 'e', 'expand', { factor: 2 });
		setConnection(delayed, delayed.rootId, placed.node.id, { executionType: 'delay', delay: 0.35 });
		let box = createSandbox();
		castSandbox(box, delayed);
		check('delay has not fired', box.instances[0] && Math.abs(box.instances[0].energies[0].scale - 1) < 1e-6);
		stepBox(box, 0.55);
		const afterDelay = box.instances[0].energies.filter(function(e){ return e.scale > 1.8; });
		check('delay then runs child', afterDelay.length === 1);

		const gated = blankSpell(0);
		placed = addChild(gated, gated.rootId, 'e', 'expand', { factor: 2 });
		setConnection(gated, gated.rootId, placed.node.id, { executionType: 'condition', delay: 0, condition: { type: 'enemyNearby', distance: 24 } });
		box = createSandbox();
		castSandbox(box, gated);
		check('false condition ends the branch', box.instances[0] && box.instances[0].energies.every(function(e){ return e.dying && e.scale < 1.2; }));
		stepBox(box, 0.4);
		check('failed branch does not keep running', !box.instances[0] || box.instances[0].energies.every(function(e){ return e.dying; }));

		const branched = blankSpell(0);
		branched.nodes[0].params.amount = 80;
		placed = addChild(branched, branched.rootId, 'e', 'split');
		addChild(branched, placed.node.id, 'n', 'shape', { shape: 'stream' });
		addChild(branched, placed.node.id, 's', 'shape', { shape: 'wave' });
		box = createSandbox();
		castSandbox(box, branched);
		const liveParts = box.instances[0].energies.filter(function(e){ return !e.dying; });
		const partSum = liveParts.reduce(function(sum, e){ return sum + e.amount; }, 0);
		check('runtime split keeps the energy', liveParts.length === 2 && Math.abs(partSum - 80) < 1e-6);

		return { ok: failures.length === 0, failures: failures };
	}

	const tested = selfTest();
	if(!tested.ok && typeof console !== 'undefined') console.warn('Rune magic self-test failed', tested.failures);

	const api = {
		MAX_RUNES: MAX_RUNES,
		MAX_LIFE: MAX_LIFE,
		categories: CATEGORIES,
		conditions: CONDITIONS,
		dirs: DIRS,
		blankSpell: blankSpell,
		ensureLayout: ensureLayout,
		validate: validate,
		stamp: function(spell){ return stamp(spell, validate(spell)); },
		addChild: addChild,
		removeSubtree: removeSubtree,
		moveSubtree: moveSubtree,
		setParam: setParam,
		setNodeType: setNodeType,
		setConnection: setConnection,
		connectionBetween: connectionBetween,
		rune: function(id){ return RUNES[id]; },
		runeList: function(){ return Object.keys(RUNES).map(function(id){ return RUNES[id]; }); },
		profile: profile,
		energyNow: energyNow,
		runeCapacity: runeCapacity,
		registerTechnique: registerTechnique,
		techniques: function(){ return Object.keys(TECHNIQUES).map(function(id){ return TECHNIQUES[id]; }); },
		efficiencyOf: efficiencyOf,
		setAllocation: setAllocation,
		tryCast: tryCast,
		instances: function(){ return liveInstances; },
		createSandbox: createSandbox,
		castSandbox: castSandbox,
		tickSandbox: tickSandbox,
		paintSandbox: paintSandbox,
		paintEnergy: paintEnergy,
		debug: function(on){ if(on != null) debugOn = !!on; return debugOn; },
		selfTest: selfTest,
		install: install
	};

	root.RuneMagic = api;
	install();

	if(typeof module !== 'undefined' && module.exports) module.exports = api;
	if(!tested.ok && typeof process !== 'undefined' && typeof window === 'undefined') process.exitCode = 1;
})(typeof window !== 'undefined' ? window : globalThis);
