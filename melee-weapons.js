/*
 * Melee weapon attack sets.
 * A weapon is an attack set. The player motor only asks for g1 / nair / up / down / special.
 * Differences are range, speed, movement, hitbox shape, knockback, recovery, and air control.
 */
(function(){
	'use strict';

	function pose(o){
		return {
			lean:o.lean||0, head:o.head||0, hat:o.hat||0,
			armF:o.armF||0, armB:o.armB||0,
			legF:o.legF||0, legB:o.legB||0,
			sword:o.sword||0, shift:o.shift||0, crouch:o.crouch||0
		};
	}
	function trio(w, s, f){ return { windup:pose(w), strike:pose(s), follow:pose(f) }; }

	const SLASH = trio(
		{lean:-0.32, head:-0.08, armF:-2.15, armB:0.4, legF:-0.25, legB:0.35, sword:-0.15, shift:-3, crouch:1},
		{lean:0.38, head:0.06, armF:1.2, armB:-0.2, legF:0.5, legB:-0.4, sword:0.15, shift:6, crouch:0},
		{lean:0.12, head:0.02, armF:1.85, armB:0.15, legF:0.2, legB:-0.1, sword:0.3, shift:2, crouch:0}
	);
	const CROSS = trio(
		{lean:0.24, head:0.12, armF:2.05, armB:0.9, legF:0.35, legB:-0.45, sword:0.4, shift:-2, crouch:2},
		{lean:-0.4, head:-0.1, armF:-0.95, armB:-0.7, legF:-0.4, legB:0.55, sword:-0.25, shift:6, crouch:0},
		{lean:-0.12, head:-0.02, armF:-1.7, armB:-0.2, legF:-0.15, legB:0.2, sword:-0.1, shift:3, crouch:0}
	);
	const HEAVY = trio(
		{lean:-0.62, head:-0.22, armF:-2.8, armB:-1.5, legF:-0.5, legB:0.65, sword:-0.55, shift:-6, crouch:4},
		{lean:0.7, head:0.2, armF:1.9, armB:0.9, legF:0.8, legB:-0.8, sword:0.5, shift:8, crouch:3},
		{lean:0.28, head:0.06, armF:2.3, armB:0.35, legF:0.3, legB:-0.3, sword:0.2, shift:2, crouch:3}
	);
	const THRUST = trio(
		{lean:-0.08, head:0.02, armF:0.35, armB:-0.8, legF:-0.15, legB:0.2, sword:0.15, shift:-2, crouch:1},
		{lean:0.55, head:0.12, armF:1.55, armB:-1.4, legF:0.85, legB:-0.7, sword:0.05, shift:8, crouch:0},
		{lean:0.28, head:0.04, armF:1.4, armB:-0.6, legF:0.4, legB:-0.25, sword:0, shift:3, crouch:0}
	);
	const UPPER = trio(
		{lean:0.22, head:0.12, armF:1.7, armB:0.5, legF:0.55, legB:-0.2, sword:0.45, shift:-2, crouch:5},
		{lean:-0.55, head:-0.24, armF:-2.4, armB:-1.3, legF:-0.75, legB:0.9, sword:-0.35, shift:2, crouch:0},
		{lean:-0.16, head:-0.06, armF:-1.45, armB:-0.35, legF:-0.2, legB:0.25, sword:-0.1, shift:0, crouch:0}
	);
	const DOWN = trio(
		{lean:-0.4, head:-0.12, armF:-2.3, armB:-1.15, legF:-0.2, legB:0.4, sword:-0.65, shift:0, crouch:0},
		{lean:0.62, head:0.22, armF:2.2, armB:1.15, legF:0.9, legB:-0.15, sword:0.75, shift:2, crouch:0},
		{lean:0.2, head:0.04, armF:1.35, armB:0.35, legF:0.25, legB:0.1, sword:0.15, shift:0, crouch:0}
	);
	const PUNCH = trio(
		{lean:-0.12, head:0.04, armF:-0.55, armB:0.85, legF:-0.15, legB:0.25, sword:0, shift:-1, crouch:1},
		{lean:0.42, head:0.1, armF:1.55, armB:-1.15, legF:0.45, legB:-0.35, sword:0.05, shift:5, crouch:0},
		{lean:0.12, head:0.02, armF:1.15, armB:-0.3, legF:0.15, legB:-0.05, sword:0, shift:1, crouch:0}
	);
	const COMPACT = trio(
		{lean:-0.16, head:-0.04, armF:-1.35, armB:0.7, legF:-0.2, legB:0.25, sword:-0.1, shift:-1, crouch:1},
		{lean:0.22, head:0.04, armF:0.85, armB:-0.55, legF:0.3, legB:-0.25, sword:0.1, shift:4, crouch:0},
		{lean:0.06, head:0, armF:1.15, armB:0.1, legF:0.1, legB:-0.05, sword:0.05, shift:1, crouch:0}
	);
	const BACKSTEP = trio(
		{lean:-0.35, head:-0.1, armF:-1.7, armB:1.1, legF:-0.55, legB:0.2, sword:-0.2, shift:-8, crouch:2},
		{lean:0.48, head:0.1, armF:1.35, armB:-0.4, legF:0.7, legB:-0.6, sword:0.15, shift:7, crouch:0},
		{lean:0.16, head:0.02, armF:1.6, armB:0.1, legF:0.2, legB:-0.15, sword:0.1, shift:2, crouch:0}
	);
	const SPIN = trio(
		{lean:-0.7, head:-0.16, armF:-2.4, armB:-1.6, legF:-0.4, legB:0.55, sword:-0.4, shift:-2, crouch:1},
		{lean:0.85, head:0.2, armF:2.1, armB:1.5, legF:0.65, legB:-0.7, sword:0.45, shift:4, crouch:0},
		{lean:0.2, head:0.04, armF:2.5, armB:0.4, legF:0.2, legB:-0.2, sword:0.15, shift:1, crouch:1}
	);
	const OVERHEAD = trio(
		{lean:-0.15, head:-0.3, armF:-2.95, armB:-1.8, legF:-0.2, legB:0.35, sword:-0.8, shift:0, crouch:2},
		{lean:0.85, head:0.28, armF:2.35, armB:1.3, legF:0.9, legB:-0.45, sword:0.7, shift:2, crouch:8},
		{lean:0.4, head:0.08, armF:1.7, armB:0.5, legF:0.3, legB:-0.1, sword:0.2, shift:0, crouch:5}
	);
	const VAULT = trio(
		{lean:0.35, head:0.1, armF:1.9, armB:0.4, legF:0.7, legB:-0.2, sword:0.6, shift:1, crouch:5},
		{lean:-0.65, head:-0.2, armF:-1.2, armB:-1.6, legF:-0.8, legB:0.9, sword:-0.4, shift:4, crouch:-4},
		{lean:-0.2, head:-0.06, armF:-0.4, armB:-0.5, legF:-0.2, legB:0.35, sword:-0.1, shift:2, crouch:-2}
	);
	const WIDE = trio(
		{lean:-0.45, head:-0.1, armF:-2.35, armB:-0.4, legF:-0.35, legB:0.45, sword:-0.25, shift:-3, crouch:1},
		{lean:0.55, head:0.12, armF:1.55, armB:0.7, legF:0.55, legB:-0.5, sword:0.3, shift:5, crouch:0},
		{lean:0.18, head:0.04, armF:2.15, armB:0.25, legF:0.2, legB:-0.15, sword:0.15, shift:2, crouch:0}
	);

	function A(o){
		const a = {
			id:o.id, name:o.name, next:o.next||null,
			ground:!!o.ground, aerial:!!o.aerial,
			attackType:o.type||'light', poiseDamage:o.poise||1,
			startup:o.su, active:o.ac, cancel:o.ca, recovery:o.re, missRecovery:o.miss==null?3:o.miss,
			damage:o.dmg, hitstop:o.stop==null?2:o.stop, hitstun:o.stun==null?8:o.stun,
			knockback:{x:o.kx==null?5:o.kx, y:o.ky==null?-1.2:o.ky, duration:o.kd==null?10:o.kd},
			windup:o.wind==null?-0.5:o.wind, lunge:o.lunge==null?3:o.lunge,
			canTurn:!!o.turn, canJumpCancel:o.jump!==false, canDashCancel:o.dash!==false, canAttackCancel:o.chain!==false,
			hitbox:{ox:o.ox, oy:o.oy||0, w:o.w, h:o.h},
			fx:o.fx||'arc',
			poses:o.poses||SLASH
		};
		if(o.plunge) a.plunge = o.plunge;
		if(o.hop) a.hop = o.hop;
		if(o.pull) a.pull = o.pull;
		if(o.pullPower) a.pullPower = o.pullPower;
		if(o.pulses){ a.pulses = o.pulses; a.pulseEvery = o.every||3; }
		if(o.steer!=null) a.steer = o.steer;
		if(o.chargeable) a.chargeable = true;
		if(o.interrupt) a.interrupt = true;
		if(o.bounce) a.bounce = true;
		if(o.motion) a.motion = o.motion;
		return a;
	}
	function weapon(o){
		return {
			id:o.id, name:o.name, type:o.id, style:o.style||o.id,
			reach:1, attackSpeed:1,
			airControl:o.air, attackSteer:o.steer,
			chargeSpecial:!!o.charge,
			fxColor:o.color,
			moves:o.moves,
			attacks:Object.keys(o.moves)
		};
	}

	const sword = weapon({
		id:'sword', name:'Apprentice Blade', style:'sword', air:0.82, steer:0.22, color:'#e7eef8',
		moves:{
			g1: A({id:'g1', name:'Quick Strike', next:'g2', ground:1, type:'light', poise:1, su:4, ac:5, ca:7, re:8, miss:4, dmg:34, stop:2, kx:5.5, ky:-1.2, wind:-1.15, lunge:4.4, turn:1, ox:30, oy:-4, w:50, h:30, fx:'arc', poses:SLASH}),
			g2: A({id:'g2', name:'Follow-Up', next:'g3', ground:1, type:'light', poise:2, su:5, ac:5, ca:7, re:9, miss:5, dmg:42, stop:3, stun:10, kx:8.5, ky:-2.4, kd:12, wind:-0.7, lunge:5.6, ox:34, oy:2, w:56, h:36, fx:'arc', poses:CROSS}),
			g3: A({id:'g3', name:'Finisher', ground:1, type:'heavy', poise:4, su:8, ac:6, ca:5, re:16, miss:6, dmg:58, stop:5, stun:14, kx:15, ky:-4.5, kd:16, wind:-1.6, lunge:7.4, jump:0, chain:0, ox:38, oy:-2, w:68, h:50, fx:'cleave', poses:HEAVY}),
			nair: A({id:'nair', name:'Air Slash', next:'nair2', aerial:1, type:'air', poise:1, su:4, ac:6, ca:6, re:8, dmg:32, kx:6, ky:-2, wind:-0.4, lunge:2.4, turn:1, ox:30, oy:-2, w:50, h:32, fx:'arc', poses:SLASH}),
			nair2: A({id:'nair2', name:'Air Follow', aerial:1, type:'air', poise:2, su:4, ac:5, ca:6, re:9, dmg:38, stop:3, stun:10, kx:7.5, ky:-1.2, wind:-0.5, lunge:2.8, chain:0, ox:28, oy:8, w:52, h:36, fx:'arc', poses:CROSS}),
			launcher: A({id:'launcher', name:'Uppercut', ground:1, type:'launcher', poise:2, su:6, ac:5, ca:7, re:11, miss:4, dmg:34, stop:4, stun:10, kx:3.2, ky:-16, kd:16, wind:-0.3, lunge:1.6, turn:1, chain:0, ox:18, oy:-30, w:40, h:48, fx:'upper', poses:UPPER}),
			up: A({id:'up', name:'Rising Slash', aerial:1, type:'launcher', poise:2, su:5, ac:5, ca:6, re:9, dmg:30, stop:3, kx:2.4, ky:-14, kd:14, wind:0, lunge:1.2, turn:1, jump:0, chain:0, ox:16, oy:-34, w:38, h:44, fx:'upper', poses:UPPER}),
			heavy: A({id:'heavy', name:'Overhead', ground:1, type:'heavy', poise:4, su:9, ac:5, ca:5, re:14, miss:5, dmg:52, stop:5, stun:14, kx:12, ky:3.5, kd:14, wind:-1.3, lunge:3.2, jump:0, chain:0, ox:32, oy:6, w:60, h:44, fx:'overhead', poses:OVERHEAD}),
			down: A({id:'down', name:'Plunge', aerial:1, type:'downward', poise:3, su:4, ac:8, ca:5, re:10, dmg:48, stop:4, stun:12, kx:2.2, ky:11, kd:12, wind:0.2, lunge:0.4, plunge:9.2, jump:0, chain:0, ox:6, oy:26, w:40, h:42, fx:'overhead', poses:DOWN}),
			special: A({id:'special', name:'Cleave', ground:1, type:'heavy', poise:4, su:7, ac:10, ca:5, re:14, miss:5, dmg:50, stop:6, stun:14, kx:16, ky:-4, kd:16, wind:-2, lunge:9, jump:0, chain:0, motion:'cleave', ox:20, oy:0, w:92, h:64, fx:'cleave', poses:HEAVY})
		}
	});

	const daggers = weapon({
		id:'daggers', name:'Twin Daggers', style:'daggers', air:1.28, steer:0.78, color:'#d8fbff',
		moves:{
			g1: A({id:'g1', name:'Quick Cut', next:'g2', ground:1, poise:1, su:2, ac:3, ca:5, re:4, miss:2, dmg:14, stop:1, stun:5, kx:3.2, ky:-0.4, wind:-0.2, lunge:5.2, turn:1, steer:0.9, ox:16, oy:-2, w:28, h:20, fx:'flurry', poses:COMPACT}),
			g2: A({id:'g2', name:'Cross Cut', next:'g3', ground:1, poise:1, su:2, ac:3, ca:5, re:5, miss:2, dmg:16, stop:1, stun:6, kx:4, ky:-0.8, wind:0.2, lunge:6.4, steer:0.9, ox:14, oy:0, w:40, h:26, fx:'flurry', poses:CROSS}),
			g3: A({id:'g3', name:'Backstep Strike', ground:1, poise:2, su:4, ac:4, ca:6, re:7, miss:3, dmg:22, stop:2, stun:8, kx:6, ky:-1.5, wind:-7.2, lunge:11, ox:18, oy:-2, w:34, h:24, fx:'arc', poses:BACKSTEP}),
			nair: A({id:'nair', name:'Forward Air Slash', next:'nair2', aerial:1, type:'air', poise:1, su:2, ac:4, ca:5, re:4, dmg:14, stop:1, kx:3.5, ky:-0.6, wind:0, lunge:3.2, turn:1, steer:1, ox:16, oy:-4, w:30, h:20, fx:'flurry', poses:COMPACT}),
			nair2: A({id:'nair2', name:'Backward Air Slash', aerial:1, type:'air', poise:1, su:2, ac:4, ca:5, re:5, dmg:14, stop:1, kx:-4.5, ky:-0.4, wind:0, lunge:1, steer:1, chain:0, ox:-22, oy:2, w:32, h:22, fx:'arc', poses:CROSS}),
			launcher: A({id:'launcher', name:'Rising Nick', ground:1, type:'launcher', poise:2, su:3, ac:4, ca:5, re:7, dmg:16, stop:2, kx:2, ky:-13, kd:14, wind:-0.2, lunge:2, turn:1, chain:0, ox:12, oy:-26, w:26, h:36, fx:'upper', poses:UPPER}),
			up: A({id:'up', name:'Air Rising Nick', aerial:1, type:'launcher', poise:2, su:2, ac:4, ca:5, re:6, dmg:14, stop:2, kx:1.5, ky:-12, wind:0, lunge:1, turn:1, jump:0, chain:0, ox:10, oy:-28, w:24, h:34, fx:'upper', poses:UPPER}),
			heavy: A({id:'heavy', name:'Low Cross', ground:1, poise:2, su:3, ac:3, ca:5, re:6, dmg:18, stop:2, kx:5, ky:1, wind:-0.4, lunge:4, ox:14, oy:10, w:36, h:18, fx:'arc', poses:COMPACT}),
			down: A({id:'down', name:'Downward Stab', aerial:1, type:'downward', poise:2, su:2, ac:6, ca:4, re:6, dmg:20, stop:2, kx:1, ky:8, plunge:7.4, jump:0, chain:0, ox:4, oy:18, w:18, h:36, fx:'thrust', poses:DOWN}),
			special: A({id:'special', name:'Flurry', ground:1, poise:1, su:2, ac:18, ca:3, re:18, miss:8, dmg:7, stop:1, stun:4, kx:3, ky:-0.4, wind:1, lunge:8, jump:0, dash:0, chain:0, pulses:7, every:2, steer:1, motion:'flurry', ox:12, oy:0, w:30, h:24, fx:'flurry', poses:CROSS})
		}
	});

	const spear = weapon({
		id:'spear', name:'Spear', style:'spear', air:0.58, steer:0.12, color:'#f3e2b0',
		moves:{
			g1: A({id:'g1', name:'Thrust', next:'g2', ground:1, poise:1, su:3, ac:4, ca:6, re:7, miss:3, dmg:26, stop:2, kx:7, ky:-0.4, wind:-0.3, lunge:2.2, turn:1, ox:52, oy:-2, w:78, h:12, fx:'thrust', poses:THRUST}),
			g2: A({id:'g2', name:'Sweep', next:'g3', ground:1, poise:2, su:6, ac:5, ca:6, re:9, dmg:24, stop:2, kx:8, ky:-1.5, wind:-0.8, lunge:2, ox:22, oy:2, w:54, h:34, fx:'arc', poses:WIDE}),
			g3: A({id:'g3', name:'Piercing Lunge', ground:1, type:'heavy', poise:3, su:7, ac:5, ca:5, re:13, miss:5, dmg:40, stop:4, stun:12, kx:12, ky:-2, kd:14, wind:-1, lunge:13, jump:0, chain:0, ox:58, oy:-2, w:92, h:14, fx:'thrust', poses:THRUST}),
			nair: A({id:'nair', name:'Aerial Thrust', next:'nair2', aerial:1, type:'air', poise:1, su:4, ac:5, ca:5, re:8, dmg:24, kx:7, ky:-0.6, wind:0, lunge:2, ox:48, oy:-4, w:74, h:12, fx:'thrust', poses:THRUST}),
			nair2: A({id:'nair2', name:'Air Follow Thrust', aerial:1, type:'air', poise:2, su:4, ac:4, ca:5, re:8, dmg:22, kx:6, wind:0, lunge:1.5, chain:0, ox:44, oy:6, w:64, h:12, fx:'thrust', poses:THRUST}),
			launcher: A({id:'launcher', name:'Upward Stab', ground:1, type:'launcher', poise:2, su:5, ac:4, ca:6, re:10, dmg:24, stop:3, kx:2, ky:-14, kd:14, wind:-0.2, lunge:0.6, chain:0, ox:10, oy:-40, w:16, h:52, fx:'upper', poses:UPPER}),
			up: A({id:'up', name:'Aerial Up Stab', aerial:1, type:'launcher', poise:2, su:4, ac:5, ca:5, re:8, dmg:22, stop:3, kx:1.4, ky:-13, wind:0, lunge:0.4, jump:0, chain:0, ox:8, oy:-42, w:16, h:50, fx:'upper', poses:UPPER}),
			heavy: A({id:'heavy', name:'Butt Strike', ground:1, poise:2, su:4, ac:4, ca:5, re:8, dmg:18, stop:2, kx:6, ky:-1, wind:-0.4, lunge:1, ox:14, oy:4, w:28, h:22, fx:'punch', poses:PUNCH}),
			down: A({id:'down', name:'Downward Stab', aerial:1, type:'downward', poise:3, su:3, ac:8, ca:4, re:9, dmg:36, stop:4, stun:11, kx:1.2, ky:10, plunge:10, jump:0, chain:0, ox:2, oy:28, w:16, h:56, fx:'thrust', poses:DOWN}),
			special: A({id:'special', name:'Vault', ground:1, type:'air', poise:1, su:5, ac:14, ca:6, re:8, dmg:16, stop:2, kx:8, ky:-6, wind:0, lunge:2, hop:{x:20, y:-8}, motion:'spearVault', ox:36, oy:0, w:64, h:20, fx:'vault', poses:VAULT})
		}
	});

	const greatsword = weapon({
		id:'greatsword', name:'Greatsword', style:'greatsword', air:0.34, steer:0.07, charge:1, color:'#ffe7b0',
		moves:{
			g1: A({id:'g1', name:'Heavy Slash', next:'g2', ground:1, type:'heavy', poise:3, su:10, ac:6, ca:6, re:14, miss:6, dmg:44, stop:5, stun:12, kx:12, ky:-3, kd:14, wind:-1.4, lunge:2.2, steer:0.05, ox:36, oy:-4, w:78, h:48, fx:'cleave', poses:HEAVY}),
			g2: A({id:'g2', name:'Rising Slash', next:'g3', ground:1, type:'launcher', poise:3, su:11, ac:6, ca:6, re:14, miss:6, dmg:40, stop:5, stun:12, kx:6, ky:-15, kd:16, wind:-1.1, lunge:1.2, steer:0.05, ox:24, oy:-28, w:70, h:58, fx:'upper', poses:UPPER}),
			g3: A({id:'g3', name:'Crushing Sweep', ground:1, type:'heavy', poise:5, su:13, ac:7, ca:5, re:18, miss:8, dmg:62, stop:7, stun:16, kx:18, ky:-5, kd:18, wind:-1.8, lunge:3, jump:0, dash:0, chain:0, steer:0.04, ox:30, oy:0, w:96, h:58, fx:'cleave', poses:HEAVY}),
			nair: A({id:'nair', name:'Air Sweep', next:'nair2', aerial:1, type:'air', poise:3, su:9, ac:6, ca:5, re:12, dmg:40, stop:4, kx:11, ky:2, wind:-0.6, lunge:3.5, steer:0.05, ox:28, oy:2, w:80, h:46, fx:'cleave', poses:WIDE}),
			nair2: A({id:'nair2', name:'Air Follow Sweep', aerial:1, type:'heavy', poise:3, su:10, ac:6, ca:4, re:13, dmg:46, stop:5, kx:13, ky:3, wind:-0.4, lunge:4, jump:0, chain:0, steer:0.04, ox:26, oy:8, w:84, h:50, fx:'cleave', poses:HEAVY}),
			launcher: A({id:'launcher', name:'Ground Rise', ground:1, type:'launcher', poise:3, su:10, ac:5, ca:5, re:13, dmg:38, stop:4, kx:4, ky:-16, kd:16, wind:-0.8, lunge:0.8, chain:0, steer:0.05, ox:20, oy:-32, w:64, h:54, fx:'upper', poses:UPPER}),
			up: A({id:'up', name:'Air Rise', aerial:1, type:'launcher', poise:3, su:8, ac:5, ca:5, re:11, dmg:36, stop:4, kx:3, ky:-13, wind:0, lunge:0.5, jump:0, chain:0, ox:16, oy:-30, w:60, h:50, fx:'upper', poses:UPPER}),
			heavy: A({id:'heavy', name:'Crushing Sweep', ground:1, type:'heavy', poise:5, su:12, ac:6, ca:5, re:16, miss:7, dmg:58, stop:6, stun:15, kx:16, ky:-4, kd:16, wind:-1.5, lunge:2.4, jump:0, chain:0, ox:32, oy:2, w:92, h:54, fx:'cleave', poses:HEAVY}),
			down: A({id:'down', name:'Downward Cleave', aerial:1, type:'downward', poise:4, su:8, ac:8, ca:4, re:12, dmg:54, stop:6, stun:14, kx:4, ky:12, plunge:11, jump:0, chain:0, ox:8, oy:22, w:70, h:52, fx:'overhead', poses:DOWN}),
			special: A({id:'special', name:'Charged Cleave', ground:1, type:'heavy', poise:6, su:8, ac:10, ca:4, re:18, miss:8, dmg:54, stop:8, stun:18, kx:20, ky:-5, kd:18, wind:0, lunge:1, jump:0, dash:0, chain:0, chargeable:1, motion:'chargeCleave', ox:24, oy:0, w:120, h:78, fx:'cleave', poses:HEAVY})
		}
	});

	const gauntlets = weapon({
		id:'gauntlets', name:'Gauntlets', style:'gauntlets', air:1.15, steer:0.86, color:'#ffe08a',
		moves:{
			g1: A({id:'g1', name:'Jab', next:'g2', ground:1, poise:2, su:2, ac:2, ca:3, re:3, miss:1, dmg:26, stop:1, stun:6, kx:3, ky:-0.2, wind:0, lunge:2.4, turn:1, steer:0.95, ox:14, oy:-4, w:20, h:16, fx:'punch', poses:PUNCH}),
			g2: A({id:'g2', name:'Cross', next:'g3', ground:1, poise:2, su:2, ac:3, ca:3, re:4, miss:1, dmg:34, stop:2, stun:8, kx:5, ky:-1, wind:0.2, lunge:4.6, steer:0.9, ox:16, oy:-2, w:24, h:18, fx:'punch', poses:PUNCH}),
			g3: A({id:'g3', name:'Heavy Strike', ground:1, type:'heavy', poise:5, su:4, ac:4, ca:4, re:8, miss:3, dmg:62, stop:4, stun:14, kx:9, ky:-2, kd:14, wind:-0.6, lunge:5, chain:0, ox:16, oy:-2, w:28, h:22, fx:'punch', poses:PUNCH}),
			nair: A({id:'nair', name:'Forward Punch', next:'nair2', aerial:1, type:'air', poise:2, su:2, ac:3, ca:3, re:4, dmg:28, stop:1, kx:4, ky:-0.4, wind:0, lunge:2.2, turn:1, steer:1, ox:14, oy:-2, w:22, h:16, fx:'punch', poses:PUNCH}),
			nair2: A({id:'nair2', name:'Air Cross', aerial:1, type:'air', poise:2, su:2, ac:3, ca:3, re:5, dmg:34, stop:2, kx:5, wind:0, lunge:2, steer:1, chain:0, ox:14, oy:4, w:24, h:18, fx:'punch', poses:PUNCH}),
			launcher: A({id:'launcher', name:'Rising Strike', ground:1, type:'launcher', poise:3, su:3, ac:4, ca:5, re:7, dmg:36, stop:3, kx:2, ky:-15, kd:14, wind:-0.2, lunge:1.5, turn:1, chain:0, ox:12, oy:-24, w:24, h:40, fx:'upper', poses:UPPER}),
			up: A({id:'up', name:'Rising Punch', aerial:1, type:'launcher', poise:3, su:3, ac:4, ca:4, re:6, dmg:32, stop:3, kx:1.5, ky:-13, wind:0, lunge:0.8, turn:1, jump:0, chain:0, ox:10, oy:-26, w:22, h:36, fx:'upper', poses:UPPER}),
			heavy: A({id:'heavy', name:'Heavy Strike', ground:1, type:'heavy', poise:5, su:4, ac:4, ca:4, re:8, dmg:58, stop:4, stun:13, kx:8, ky:-1.5, wind:-0.5, lunge:4.5, ox:16, oy:0, w:26, h:20, fx:'punch', poses:PUNCH}),
			down: A({id:'down', name:'Downward Strike', aerial:1, type:'downward', poise:3, su:3, ac:5, ca:4, re:6, dmg:44, stop:3, kx:2, ky:9, plunge:8, jump:0, chain:0, bounce:1, ox:6, oy:16, w:26, h:28, fx:'overhead', poses:DOWN}),
			special: A({id:'special', name:'Seize and Slam', ground:1, type:'heavy', poise:6, su:4, ac:70, ca:4, re:14, miss:12, dmg:30, stop:5, stun:20, kx:0, ky:0, wind:0, lunge:3, jump:0, dash:0, chain:0, motion:'grabSlam', ox:36, oy:-2, w:64, h:58, fx:'punch', poses:PUNCH})
		}
	});

	const hammer = weapon({
		id:'hammer', name:'War Hammer', style:'hammer', air:0.36, steer:0.08, color:'#ffb067',
		moves:{
			g1: A({id:'g1', name:'Hammer Swing', next:'g2', ground:1, type:'heavy', poise:4, su:9, ac:5, ca:6, re:13, miss:5, dmg:36, stop:5, stun:12, kx:14, ky:-2, kd:14, wind:-1.3, lunge:1.6, ox:30, oy:0, w:64, h:40, fx:'arc', poses:WIDE}),
			g2: A({id:'g2', name:'Rising Hammer', next:'g3', ground:1, type:'launcher', poise:4, su:10, ac:5, ca:5, re:13, dmg:34, stop:5, kx:5, ky:-16, kd:16, wind:-1, lunge:0.8, ox:18, oy:-26, w:52, h:50, fx:'upper', poses:UPPER}),
			g3: A({id:'g3', name:'Groundbreaker', ground:1, type:'heavy', poise:6, su:12, ac:6, ca:5, re:16, miss:7, dmg:46, stop:8, stun:16, kx:8, ky:4, kd:16, wind:-1.2, lunge:1, jump:0, dash:0, chain:0, ox:6, oy:18, w:86, h:26, fx:'smash', poses:OVERHEAD}),
			nair: A({id:'nair', name:'Air Hammer', aerial:1, type:'heavy', poise:3, su:8, ac:5, ca:4, re:12, dmg:32, stop:4, kx:10, ky:2, wind:-0.4, lunge:2, chain:0, ox:24, oy:4, w:58, h:36, fx:'arc', poses:WIDE}),
			nair2: A({id:'nair2', name:'Air Hammer Follow', aerial:1, type:'heavy', poise:3, su:8, ac:5, ca:4, re:12, dmg:30, stop:4, kx:9, ky:3, wind:-0.3, lunge:1.5, chain:0, ox:20, oy:8, w:54, h:34, fx:'arc', poses:HEAVY}),
			launcher: A({id:'launcher', name:'Rising Hammer', ground:1, type:'launcher', poise:4, su:9, ac:5, ca:5, re:12, dmg:32, stop:4, kx:4, ky:-16, wind:-0.8, lunge:0.6, chain:0, ox:16, oy:-24, w:48, h:48, fx:'upper', poses:UPPER}),
			up: A({id:'up', name:'Air Rising Hammer', aerial:1, type:'launcher', poise:3, su:7, ac:4, ca:4, re:10, dmg:26, stop:3, kx:2, ky:-11, wind:0, lunge:0.3, jump:0, chain:0, ox:12, oy:-22, w:40, h:40, fx:'upper', poses:UPPER}),
			heavy: A({id:'heavy', name:'Groundbreaker', ground:1, type:'heavy', poise:6, su:11, ac:5, ca:5, re:15, miss:6, dmg:44, stop:7, stun:15, kx:7, ky:5, wind:-1, lunge:0.8, jump:0, chain:0, ox:4, oy:18, w:82, h:24, fx:'smash', poses:OVERHEAD}),
			down: A({id:'down', name:'Downward Smash', aerial:1, type:'downward', poise:5, su:5, ac:7, ca:4, re:12, dmg:42, stop:6, stun:14, kx:3, ky:-12, plunge:13, jump:0, chain:0, bounce:1, ox:4, oy:20, w:48, h:36, fx:'overhead', poses:DOWN}),
			special: A({id:'special', name:'Overhead Smash', ground:1, type:'heavy', poise:9, su:16, ac:8, ca:4, re:20, miss:8, dmg:62, stop:9, stun:20, kx:8, ky:8, kd:16, wind:0, lunge:0, jump:0, dash:0, chain:0, interrupt:1, motion:'slam', ox:4, oy:16, w:70, h:36, fx:'overhead', poses:OVERHEAD})
		}
	});

	const scythe = weapon({
		id:'scythe', name:'Scythe', style:'scythe', air:0.72, steer:0.2, color:'#c6f0d4',
		moves:{
			g1: A({id:'g1', name:'Crescent', next:'g2', ground:1, poise:2, su:6, ac:6, ca:6, re:9, dmg:28, stop:3, kx:8, ky:-2, wind:-0.8, lunge:2.4, ox:24, oy:-2, w:78, h:40, fx:'arc', poses:WIDE}),
			g2: A({id:'g2', name:'Reverse Crescent', next:'g3', ground:1, poise:2, su:7, ac:6, ca:6, re:10, dmg:28, stop:3, kx:7, ky:-1.5, wind:-1, lunge:1, ox:-8, oy:0, w:108, h:40, fx:'arc', poses:SPIN}),
			g3: A({id:'g3', name:'Reaping Spin', ground:1, type:'heavy', poise:3, su:8, ac:12, ca:5, re:14, miss:5, dmg:26, stop:3, kx:9, ky:-2, wind:0.6, lunge:3.2, pulses:2, every:5, chain:0, ox:0, oy:0, w:120, h:64, fx:'spin', poses:SPIN}),
			nair: A({id:'nair', name:'Air Crescent', next:'nair2', aerial:1, type:'air', poise:2, su:5, ac:7, ca:5, re:8, dmg:24, kx:7, ky:-1, wind:0, lunge:1.6, ox:16, oy:-4, w:86, h:42, fx:'arc', poses:WIDE}),
			nair2: A({id:'nair2', name:'Air Reverse', aerial:1, type:'air', poise:2, su:5, ac:6, ca:5, re:8, dmg:24, kx:6, wind:0, lunge:1, chain:0, ox:-10, oy:4, w:100, h:40, fx:'spin', poses:SPIN}),
			launcher: A({id:'launcher', name:'Rising Crescent', ground:1, type:'launcher', poise:2, su:6, ac:5, ca:6, re:10, dmg:24, stop:3, kx:3, ky:-13, wind:-0.4, lunge:1, chain:0, ox:10, oy:-24, w:70, h:48, fx:'upper', poses:UPPER}),
			up: A({id:'up', name:'Air Rising Crescent', aerial:1, type:'launcher', poise:2, su:5, ac:5, ca:5, re:8, dmg:22, kx:2, ky:-12, wind:0, lunge:0.6, jump:0, chain:0, ox:8, oy:-26, w:72, h:46, fx:'upper', poses:UPPER}),
			heavy: A({id:'heavy', name:'Low Reap', ground:1, poise:2, su:7, ac:5, ca:5, re:11, dmg:26, stop:3, kx:8, ky:2, wind:-0.6, lunge:1.5, ox:8, oy:12, w:90, h:28, fx:'arc', poses:WIDE}),
			down: A({id:'down', name:'Falling Crescent', aerial:1, type:'downward', poise:2, su:5, ac:7, ca:4, re:9, dmg:30, stop:3, kx:4, ky:8, plunge:6, jump:0, chain:0, ox:0, oy:16, w:96, h:36, fx:'spin', poses:DOWN}),
			special: A({id:'special', name:'Hook', ground:1, poise:2, su:7, ac:8, ca:6, re:11, dmg:14, stop:3, kx:4, ky:-2, wind:-0.4, lunge:1, pull:'enemy', pullPower:18, motion:'hook', ox:48, oy:0, w:36, h:28, fx:'hook', poses:WIDE})
		}
	});

	const glaive = weapon({
		id:'glaive', name:'Glaive', style:'glaive', air:0.92, steer:0.4, color:'#b7f0e4',
		moves:{
			g1: A({id:'g1', name:'Forward Sweep', next:'g2', ground:1, poise:2, su:5, ac:5, ca:6, re:8, dmg:28, stop:2, kx:8, ky:-1.6, wind:-0.5, lunge:5, ox:28, oy:-2, w:70, h:36, fx:'arc', poses:WIDE}),
			g2: A({id:'g2', name:'Spinning Sweep', next:'g3', ground:1, poise:2, su:6, ac:8, ca:6, re:9, dmg:26, stop:2, kx:8, ky:-1.2, wind:1.2, lunge:4, ox:0, oy:0, w:100, h:48, fx:'spin', poses:SPIN}),
			g3: A({id:'g3', name:'Forward Cleave', ground:1, type:'heavy', poise:3, su:7, ac:5, ca:6, re:12, dmg:40, stop:4, kx:12, ky:-3, wind:-0.6, lunge:8, chain:0, ox:32, oy:-4, w:78, h:42, fx:'cleave', poses:HEAVY}),
			nair: A({id:'nair', name:'Air Sweep', next:'nair2', aerial:1, type:'air', poise:2, su:4, ac:6, ca:5, re:7, dmg:26, kx:7, ky:-1, wind:0, lunge:3, ox:22, oy:-2, w:78, h:34, fx:'arc', poses:WIDE}),
			nair2: A({id:'nair2', name:'Air Spin', aerial:1, type:'air', poise:2, su:5, ac:6, ca:5, re:8, dmg:24, kx:6, wind:0, lunge:2.4, chain:0, ox:0, oy:2, w:96, h:40, fx:'spin', poses:SPIN}),
			launcher: A({id:'launcher', name:'Rising Sweep', ground:1, type:'launcher', poise:2, su:6, ac:5, ca:6, re:9, dmg:24, stop:3, kx:4, ky:-13, wind:-0.3, lunge:2, chain:0, ox:16, oy:-22, w:64, h:44, fx:'upper', poses:UPPER}),
			up: A({id:'up', name:'Air Rising Sweep', aerial:1, type:'launcher', poise:2, su:5, ac:5, ca:5, re:8, dmg:22, kx:3, ky:-11, wind:0, lunge:1.5, jump:0, chain:0, ox:12, oy:-22, w:68, h:40, fx:'upper', poses:UPPER}),
			heavy: A({id:'heavy', name:'Low Sweep', ground:1, poise:2, su:6, ac:5, ca:5, re:10, dmg:26, kx:9, ky:1.5, wind:-0.4, lunge:4, ox:18, oy:12, w:76, h:24, fx:'arc', poses:WIDE}),
			down: A({id:'down', name:'Falling Sweep', aerial:1, type:'downward', poise:2, su:4, ac:6, ca:4, re:8, dmg:30, stop:3, kx:5, ky:7, plunge:6.5, jump:0, chain:0, ox:8, oy:14, w:80, h:32, fx:'cleave', poses:DOWN}),
			special: A({id:'special', name:'Spinning Advance', ground:1, type:'heavy', poise:3, su:4, ac:18, ca:4, re:12, miss:4, dmg:18, stop:2, kx:9, ky:-1, wind:4, lunge:11, pulses:4, every:4, chain:0, motion:'spin', ox:0, oy:0, w:120, h:70, fx:'spin', poses:SPIN})
		}
	});

	const whip = weapon({
		id:'whip', name:'Whip', style:'whip', air:0.78, steer:0.24, color:'#f0c27a',
		moves:{
			g1: A({id:'g1', name:'Forward Lash', next:'g2', ground:1, poise:1, su:5, ac:4, ca:7, re:8, dmg:16, stop:2, stun:10, kx:6, ky:-0.6, wind:-0.6, lunge:0.6, ox:62, oy:-4, w:96, h:16, fx:'whip', poses:THRUST}),
			g2: A({id:'g2', name:'Reverse Lash', next:'g3', ground:1, poise:1, su:6, ac:4, ca:6, re:8, dmg:14, stop:2, stun:9, kx:-6, ky:-0.4, wind:0.4, lunge:-1, ox:-48, oy:0, w:80, h:18, fx:'whip', poses:CROSS}),
			g3: A({id:'g3', name:'Circular Lash', ground:1, poise:2, su:8, ac:8, ca:5, re:12, dmg:18, stop:3, kx:7, ky:-1, wind:0.2, lunge:0.4, chain:0, ox:0, oy:0, w:140, h:70, fx:'spin', poses:SPIN}),
			nair: A({id:'nair', name:'Air Lash', next:'nair2', aerial:1, type:'air', poise:1, su:4, ac:5, ca:6, re:7, dmg:14, stun:9, kx:5, ky:-0.5, wind:0, lunge:0.4, ox:54, oy:-6, w:90, h:18, fx:'whip', poses:WIDE}),
			nair2: A({id:'nair2', name:'Air Reverse Lash', aerial:1, type:'air', poise:1, su:5, ac:4, ca:5, re:7, dmg:14, kx:-5, wind:0, lunge:0, chain:0, ox:-40, oy:4, w:84, h:20, fx:'whip', poses:CROSS}),
			launcher: A({id:'launcher', name:'Rising Lash', ground:1, type:'launcher', poise:2, su:6, ac:4, ca:6, re:9, dmg:14, stop:2, kx:2, ky:-12, wind:-0.3, lunge:0.3, chain:0, ox:20, oy:-30, w:70, h:36, fx:'upper', poses:UPPER}),
			up: A({id:'up', name:'Air Rising Lash', aerial:1, type:'launcher', poise:1, su:5, ac:4, ca:5, re:7, dmg:12, kx:1, ky:-11, wind:0, lunge:0.2, jump:0, chain:0, ox:10, oy:-32, w:64, h:34, fx:'upper', poses:UPPER}),
			heavy: A({id:'heavy', name:'Low Lash', ground:1, poise:1, su:6, ac:4, ca:5, re:9, dmg:14, kx:6, ky:1, wind:-0.4, lunge:0.4, ox:40, oy:12, w:100, h:16, fx:'whip', poses:WIDE}),
			down: A({id:'down', name:'Falling Lash', aerial:1, type:'downward', poise:1, su:4, ac:6, ca:4, re:8, dmg:16, kx:3, ky:6, plunge:4, jump:0, chain:0, ox:0, oy:18, w:110, h:28, fx:'whip', poses:DOWN}),
			special: A({id:'special', name:'Hook and Pull', ground:1, poise:1, su:6, ac:10, ca:6, re:11, dmg:8, stop:2, kx:3, ky:-1, wind:0, lunge:0.4, pull:'grapple', pullPower:16, motion:'whip', ox:78, oy:0, w:40, h:22, fx:'whip', poses:THRUST})
		}
	});

	const chain = weapon({
		id:'chain', name:'Chain Blade', style:'chain', air:0.7, steer:0.22, color:'#d5deea',
		moves:{
			g1: A({id:'g1', name:'Chain Slash', next:'g2', ground:1, poise:3, su:10, ac:7, ca:7, re:14, dmg:46, stop:4, stun:10, kx:11, ky:-1.4, wind:-0.7, lunge:1.2, ox:40, oy:-2, w:64, h:28, fx:'chain', poses:WIDE}),
			g2: A({id:'g2', name:'Extended Strike', next:'g3', ground:1, poise:3, su:11, ac:6, ca:7, re:15, dmg:52, stop:4, stun:12, kx:12, ky:-1, wind:-0.8, lunge:1, ox:62, oy:-2, w:78, h:20, fx:'chain', poses:THRUST}),
			g3: A({id:'g3', name:'Recoil Slash', ground:1, poise:3, su:10, ac:16, ca:6, re:18, miss:6, dmg:34, stop:3, kx:9, ky:-1, wind:0.4, lunge:0.6, pulses:2, every:5, chain:0, ox:28, oy:0, w:90, h:32, fx:'chain', poses:SPIN}),
			nair: A({id:'nair', name:'Air Chain', next:'nair2', aerial:1, type:'air', poise:3, su:8, ac:7, ca:6, re:11, dmg:38, stop:3, kx:9, ky:-1, wind:0, lunge:0.8, ox:36, oy:-4, w:66, h:24, fx:'chain', poses:WIDE}),
			nair2: A({id:'nair2', name:'Air Recoil', aerial:1, type:'air', poise:3, su:8, ac:13, ca:5, re:11, dmg:30, kx:8, wind:0, lunge:0.4, pulses:2, every:4, chain:0, ox:24, oy:4, w:80, h:28, fx:'chain', poses:SPIN}),
			launcher: A({id:'launcher', name:'Rising Chain', ground:1, type:'launcher', poise:3, su:9, ac:6, ca:6, re:13, dmg:34, stop:2, kx:2, ky:-12, wind:-0.3, lunge:0.4, chain:0, ox:18, oy:-22, w:50, h:40, fx:'upper', poses:UPPER}),
			up: A({id:'up', name:'Air Rising Chain', aerial:1, type:'launcher', poise:3, su:8, ac:6, ca:5, re:11, dmg:30, kx:1.5, ky:-11, wind:0, lunge:0.3, jump:0, chain:0, ox:12, oy:-24, w:48, h:36, fx:'upper', poses:UPPER}),
			heavy: A({id:'heavy', name:'Low Chain', ground:1, poise:3, su:9, ac:6, ca:6, re:14, dmg:40, stop:3, kx:7, ky:1, wind:-0.4, lunge:0.5, ox:30, oy:12, w:70, h:18, fx:'chain', poses:WIDE}),
			down: A({id:'down', name:'Falling Chain', aerial:1, type:'downward', poise:3, su:8, ac:7, ca:5, re:11, dmg:42, stop:4, kx:3, ky:6, plunge:5, jump:0, chain:0, ox:6, oy:16, w:64, h:30, fx:'chain', poses:DOWN}),
			special: A({id:'special', name:'Grapple', ground:1, poise:2, su:10, ac:12, ca:7, re:16, dmg:20, stun:12, stop:2, kx:3, ky:-1, wind:0, lunge:0.2, pull:'grapple', pullPower:14, motion:'grapple', ox:64, oy:0, w:36, h:24, fx:'chain', poses:THRUST})
		}
	});

	const staff = weapon({
		id:'staff', name:'Staff', style:'staff', air:0.88, steer:0.32, color:'#b9dcff',
		moves:{
			g1: A({id:'g1', name:'Staff Jab', next:'g2', ground:1, poise:1, su:3, ac:4, ca:6, re:6, dmg:20, stop:2, kx:6, ky:-0.6, wind:-0.3, lunge:2, turn:1, ox:28, oy:-4, w:40, h:16, fx:'thrust', poses:THRUST}),
			g2: A({id:'g2', name:'Sweep', next:'g3', ground:1, poise:2, su:5, ac:5, ca:6, re:8, dmg:22, stop:2, kx:9, ky:-1, wind:-0.5, lunge:1.5, ox:16, oy:10, w:64, h:22, fx:'arc', poses:WIDE}),
			g3: A({id:'g3', name:'Spinning Strike', ground:1, poise:3, su:7, ac:8, ca:6, re:11, dmg:28, stop:3, kx:11, ky:-2, wind:0.8, lunge:2, chain:0, ox:0, oy:0, w:88, h:48, fx:'spin', poses:SPIN}),
			nair: A({id:'nair', name:'Air Jab', next:'nair2', aerial:1, type:'air', poise:1, su:3, ac:4, ca:5, re:6, dmg:18, kx:5, ky:-0.5, wind:0, lunge:1.2, ox:26, oy:-4, w:42, h:16, fx:'thrust', poses:THRUST}),
			nair2: A({id:'nair2', name:'Air Sweep', aerial:1, type:'air', poise:2, su:4, ac:5, ca:5, re:7, dmg:20, kx:7, wind:0, lunge:1, chain:0, ox:8, oy:4, w:70, h:28, fx:'arc', poses:WIDE}),
			launcher: A({id:'launcher', name:'Rising Staff', ground:1, type:'launcher', poise:2, su:5, ac:4, ca:6, re:8, dmg:18, stop:2, kx:3, ky:-12, wind:-0.2, lunge:0.8, chain:0, ox:10, oy:-24, w:36, h:40, fx:'upper', poses:UPPER}),
			up: A({id:'up', name:'Air Rising Staff', aerial:1, type:'launcher', poise:2, su:4, ac:4, ca:5, re:7, dmg:16, kx:2, ky:-11, wind:0, lunge:0.5, jump:0, chain:0, ox:8, oy:-26, w:32, h:40, fx:'upper', poses:UPPER}),
			heavy: A({id:'heavy', name:'Brace', ground:1, type:'heavy', poise:4, su:5, ac:6, ca:7, re:8, dmg:16, stop:3, stun:12, kx:14, ky:-2, kd:12, wind:-0.2, lunge:0.2, interrupt:1, ox:12, oy:-2, w:36, h:32, fx:'punch', poses:PUNCH}),
			down: A({id:'down', name:'Staff Drop', aerial:1, type:'downward', poise:2, su:3, ac:6, ca:4, re:7, dmg:22, kx:3, ky:7, plunge:6, jump:0, chain:0, ox:4, oy:16, w:28, h:36, fx:'thrust', poses:DOWN}),
			special: A({id:'special', name:'Staff Vault', ground:1, type:'air', poise:1, su:8, ac:8, ca:7, re:8, dmg:12, stop:2, kx:4, ky:-4, wind:0, lunge:0, hop:{x:6, y:-18}, motion:'staffPlant', ox:8, oy:10, w:34, h:36, fx:'vault', poses:VAULT})
		}
	});

	const order = ['sword','daggers','spear','greatsword','gauntlets','hammer','scythe','glaive','whip','chain','staff'];
	window.MELEE_WEAPONS = {
		order: order,
		weapons: {
			sword:sword, daggers:daggers, spear:spear, greatsword:greatsword, gauntlets:gauntlets,
			hammer:hammer, scythe:scythe, glaive:glaive, whip:whip, chain:chain, staff:staff
		}
	};
})();
