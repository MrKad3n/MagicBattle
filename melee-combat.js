/*
 * Physical melee stance for Magic Battle.
 *
 * Melee and magic are one mode: a weapon lives in one of the ten spell slots.
 * With a weapon slot selected, click / J attacks and R is its special;
 * with a spell slot selected, click casts. Dash (Shift) and parry (Q) always work.
 * Press P for the training yard. F8 shows hitboxes.
 *
 * This file is the physical layer only. Spells, reinforcement, techniques,
 * mana, and runes are not applied here. Future magic should mutate attacks
 * through MeleeMode.attackModifiers and listen through MeleeMode.on / damageListeners.
 * Do not special-case the sword inside enemy code — enemies receive a DamageEvent.
 */
(function(){
	'use strict';

	const M = {
		groundAccel: 1.5,
		groundDecel: 2.15,
		maxGround: 7.15,
		airAccel: 0.82,
		airDecel: 0.48,
		maxAir: 6.55,
		turnAccel: 2.7,
		jumpCut: -5.4,
		coyote: 7,
		jumpBuffer: 8,
		fastFall: 0.58,
		attackSteer: 0.2,
		cancelSteer: 0.88,
		recoverySteer: 0.58,
		attackBuffer: 14,
		hitBufferBonus: 6,
		missBuffer: 5
	};

	const DASH = {
		speed: 19.2,
		duration: 11,
		cooldown: 24,
		invuln: 7,
		attackCancel: 4,
		vertical: 14
	};

	const PARRY = {
		startup: 3,
		active: 7,
		recovery: 10,
		cooldown: 16,
		riposte: 10
	};

	/* Times are frames at 60fps. Gameplay timing lives here, not in the rig. */
	const ATTACKS = {
		g1: {
			id:'g1', name:'Quick Strike', next:'g2', ground:true, aerial:false,
			attackType:'light', poiseDamage:1,
			startup:4, active:5, cancel:7, recovery:8, missRecovery:4,
			damage:34, hitstop:2, hitstun:8,
			knockback:{x:5.5, y:-1.2, duration:10},
			windup:-1.15, lunge:4.4,
			canTurn:true, canJumpCancel:true, canDashCancel:true, canAttackCancel:true,
			hitbox:{ox:30, oy:-4, w:50, h:30},
			poses:{
				windup:{lean:-0.28, head:-0.08, armF:-2.15, armB:0.4, legF:-0.25, legB:0.35, sword:-0.15, shift:-3, crouch:1},
				strike:{lean:0.32, head:0.06, armF:1.15, armB:-0.2, legF:0.45, legB:-0.35, sword:0.15, shift:5, crouch:0},
				follow:{lean:0.12, head:0.02, armF:1.85, armB:0.15, legF:0.2, legB:-0.1, sword:0.35, shift:2, crouch:0}
			}
		},
		g2: {
			id:'g2', name:'Follow-Up', next:'g3', ground:true, aerial:false,
			attackType:'light', poiseDamage:2,
			startup:5, active:5, cancel:7, recovery:9, missRecovery:5,
			damage:48, hitstop:3, hitstun:10,
			knockback:{x:8.5, y:-2.4, duration:12},
			windup:-0.7, lunge:5.6,
			canTurn:false, canJumpCancel:true, canDashCancel:true, canAttackCancel:true,
			hitbox:{ox:34, oy:2, w:56, h:36},
			poses:{
				windup:{lean:0.22, head:0.12, armF:2.05, armB:0.9, legF:0.35, legB:-0.45, sword:0.4, shift:-2, crouch:2},
				strike:{lean:-0.38, head:-0.1, armF:-0.95, armB:-0.7, legF:-0.4, legB:0.55, sword:-0.25, shift:6, crouch:0},
				follow:{lean:-0.12, head:-0.02, armF:-1.7, armB:-0.2, legF:-0.15, legB:0.2, sword:-0.1, shift:3, crouch:0}
			}
		},
		g3: {
			id:'g3', name:'Finisher', next:null, ground:true, aerial:false,
			attackType:'heavy', poiseDamage:4,
			startup:8, active:6, cancel:5, recovery:16, missRecovery:6,
			damage:72, hitstop:5, hitstun:14,
			knockback:{x:15, y:-4.5, duration:16},
			windup:-1.6, lunge:7.4,
			canTurn:false, canJumpCancel:false, canDashCancel:true, canAttackCancel:false,
			hitbox:{ox:38, oy:-2, w:68, h:50},
			poses:{
				windup:{lean:-0.55, head:-0.2, armF:-2.7, armB:-1.4, legF:-0.55, legB:0.7, sword:-0.5, shift:-6, crouch:4},
				strike:{lean:0.62, head:0.18, armF:1.65, armB:0.8, legF:0.7, legB:-0.85, sword:0.45, shift:8, crouch:2},
				follow:{lean:0.28, head:0.08, armF:2.35, armB:0.35, legF:0.35, legB:-0.4, sword:0.2, shift:3, crouch:3}
			}
		},
		nair1: {
			id:'nair1', name:'Air Slash', next:'nair2', ground:false, aerial:true,
			attackType:'air', poiseDamage:1,
			startup:4, active:6, cancel:6, recovery:8, missRecovery:3,
			damage:36, hitstop:2, hitstun:8,
			knockback:{x:6, y:-2, duration:10},
			windup:-0.4, lunge:2.4,
			canTurn:true, canJumpCancel:false, canDashCancel:true, canAttackCancel:true,
			hitbox:{ox:30, oy:-2, w:50, h:32},
			poses:{
				windup:{lean:-0.2, head:-0.05, armF:-1.9, armB:-0.6, legF:-0.45, legB:0.55, sword:-0.2, shift:-1, crouch:0},
				strike:{lean:0.25, head:0.05, armF:1.05, armB:-0.3, legF:0.35, legB:-0.25, sword:0.2, shift:3, crouch:0},
				follow:{lean:0.08, head:0, armF:1.7, armB:0.1, legF:0.15, legB:0.1, sword:0.15, shift:1, crouch:0}
			}
		},
		nair2: {
			id:'nair2', name:'Air Follow', next:null, ground:false, aerial:true,
			attackType:'air', poiseDamage:2,
			startup:4, active:5, cancel:6, recovery:9, missRecovery:3,
			damage:44, hitstop:3, hitstun:10,
			knockback:{x:7.5, y:-1.2, duration:11},
			windup:-0.5, lunge:2.8,
			canTurn:false, canJumpCancel:false, canDashCancel:true, canAttackCancel:false,
			hitbox:{ox:28, oy:8, w:52, h:36},
			poses:{
				windup:{lean:0.18, head:0.1, armF:1.9, armB:0.7, legF:0.4, legB:-0.5, sword:0.35, shift:-1, crouch:0},
				strike:{lean:-0.32, head:-0.08, armF:-0.85, armB:-0.55, legF:-0.35, legB:0.45, sword:-0.2, shift:3, crouch:0},
				follow:{lean:-0.1, head:0, armF:-1.55, armB:-0.15, legF:-0.1, legB:0.2, sword:0, shift:1, crouch:0}
			}
		},
		launcher: {
			id:'launcher', name:'Uppercut', next:null, ground:true, aerial:false,
			attackType:'launcher', poiseDamage:2,
			startup:6, active:5, cancel:7, recovery:11, missRecovery:4,
			damage:36, hitstop:4, hitstun:10,
			knockback:{x:3.2, y:-16, duration:16},
			windup:-0.3, lunge:1.6,
			canTurn:true, canJumpCancel:true, canDashCancel:true, canAttackCancel:false,
			hitbox:{ox:18, oy:-30, w:40, h:48},
			poses:{
				windup:{lean:0.2, head:0.12, armF:1.7, armB:0.5, legF:0.55, legB:-0.2, sword:0.5, shift:-2, crouch:5},
				strike:{lean:-0.48, head:-0.22, armF:-2.35, armB:-1.3, legF:-0.7, legB:0.85, sword:-0.35, shift:2, crouch:0},
				follow:{lean:-0.18, head:-0.08, armF:-1.5, armB:-0.4, legF:-0.2, legB:0.25, sword:-0.1, shift:0, crouch:0}
			}
		},
		upAir: {
			id:'upAir', name:'Rising Slash', next:null, ground:false, aerial:true,
			attackType:'launcher', poiseDamage:2,
			startup:5, active:5, cancel:6, recovery:9, missRecovery:3,
			damage:32, hitstop:3, hitstun:8,
			knockback:{x:2.4, y:-14, duration:14},
			windup:0, lunge:1.2,
			canTurn:true, canJumpCancel:false, canDashCancel:true, canAttackCancel:false,
			hitbox:{ox:16, oy:-34, w:38, h:44},
			poses:{
				windup:{lean:0.12, head:0.08, armF:1.2, armB:0.3, legF:0.3, legB:-0.4, sword:0.3, shift:0, crouch:0},
				strike:{lean:-0.4, head:-0.18, armF:-2.4, armB:-1.2, legF:-0.55, legB:0.4, sword:-0.3, shift:1, crouch:0},
				follow:{lean:-0.12, head:-0.04, armF:-1.4, armB:-0.3, legF:-0.15, legB:0.15, sword:0, shift:0, crouch:0}
			}
		},
		plunge: {
			id:'plunge', name:'Plunge', next:null, ground:false, aerial:true,
			attackType:'downward', poiseDamage:3,
			startup:4, active:8, cancel:5, recovery:10, missRecovery:3,
			damage:58, hitstop:4, hitstun:12,
			knockback:{x:2.2, y:11, duration:12},
			windup:0.2, lunge:0.4, plunge:9.2,
			canTurn:false, canJumpCancel:false, canDashCancel:true, canAttackCancel:false,
			hitbox:{ox:6, oy:26, w:40, h:42},
			poses:{
				windup:{lean:-0.35, head:-0.1, armF:-2.2, armB:-1.1, legF:-0.2, legB:0.35, sword:-0.6, shift:0, crouch:0},
				strike:{lean:0.55, head:0.2, armF:2.15, armB:1.1, legF:0.85, legB:-0.15, sword:0.7, shift:2, crouch:0},
				follow:{lean:0.2, head:0.05, armF:1.4, armB:0.4, legF:0.3, legB:0.1, sword:0.2, shift:0, crouch:0}
			}
		},
		heavy: {
			id:'heavy', name:'Overhead', next:null, ground:true, aerial:false,
			attackType:'heavy', poiseDamage:4,
			startup:9, active:5, cancel:5, recovery:14, missRecovery:5,
			damage:64, hitstop:5, hitstun:14,
			knockback:{x:12, y:3.5, duration:14},
			windup:-1.3, lunge:3.2,
			canTurn:false, canJumpCancel:false, canDashCancel:true, canAttackCancel:false,
			hitbox:{ox:32, oy:6, w:60, h:44},
			poses:{
				windup:{lean:-0.62, head:-0.25, armF:-2.85, armB:-1.6, legF:-0.4, legB:0.45, sword:-0.7, shift:-4, crouch:3},
				strike:{lean:0.7, head:0.22, armF:2.05, armB:1.05, legF:0.75, legB:-0.55, sword:0.55, shift:5, crouch:6},
				follow:{lean:0.3, head:0.06, armF:1.55, armB:0.4, legF:0.25, legB:-0.15, sword:0.15, shift:1, crouch:4}
			}
		}
	};

	const SWORD = {
		id:'sword',
		name:'Apprentice Blade',
		type:'sword',
		reach:1,
		attackSpeed:1,
		attacks:['g1','g2','g3','nair1','nair2','launcher','upAir','plunge','heavy']
	};

	const listeners = {};
	let attackSerial = 1;

	function on(name, fn){
		(listeners[name] || (listeners[name] = [])).push(fn);
		return fn;
	}
	function emit(name, payload){
		const list = listeners[name];
		if(!list) return;
		for(let i=0;i<list.length;i++){
			try{ list[i](payload || {}); }catch(err){ console.error(err); }
		}
	}

	const MeleeMode = {
		active:false,
		inDojo:false,
		debug:false,
		movement:M,
		dashConfig:DASH,
		parryConfig:PARRY,
		attacks:ATTACKS,
		weapons:{ sword:SWORD },
		weaponOrder:['sword'],
		weaponId:'sword',
		charge:0,
		/* Future reinforcement / techniques push (attackCopy) => void here. */
		attackModifiers:[],
		/* Future systems observe the generic damage event. */
		damageListeners:[],
		on:on,
		emit:emit,

		state:'idle',
		phase:'',
		atk:null,
		hitstop:0,
		hitstun:0,
		coyote:0,
		jumpBuffer:0,
		jumpCutArm:false,
		bonusJump:0,
		airStep:0,
		buffer:0,
		bufferKind:'combo',
		wasGround:true,
		landSquash:0,
		walkPhase:0,
		frame:-1,
		swordTip:null,
		trail:[],
		_lmb:false,
		_lmbWas:false,
		_jWas:false,
		_spaceWas:false,
		_upWas:false,
		_shiftWas:false,
		_qWas:false,
		_parryEdge:false,

		dash:{ t:0, cd:0, inv:0, vx:0, vy:0, elapsed:0 },
		parry:{ t:0, age:0, cd:0, success:false },
		solids:[],
		dummies:[],
		signs:[],
		origin:null,
		returnPos:null,
		safe:null,
		anim:{ pose:null, from:null, to:null, t:0 },

		setMeleeStature(on){
			if(typeof player==='undefined') return;
			const grow = 18;
			if(on){
				if(this._stature) return;
				this._stature = player.h;
				player.h += grow;
				player.y -= grow;
			}else if(this._stature){
				const d = player.h - this._stature;
				player.h = this._stature;
				player.y += d;
				this._stature = 0;
			}
		},

		/* the selected slot decides what the hands hold */
		armed:false,
		setSlot(sp){
			const w = sp && sp.kind === 'weapon' && this.weapons[sp.weaponId] ? sp.weaponId : null;
			const was = this.armed ? this.weaponId : null;
			if(w === was) return;
			if(this.atk) this.endAttack();
			this.charge = 0; this.buffer = 0; this.airStep = 0;
			this.armed = !!w;
			if(w) this.weaponId = w;
		},
		queueAttack(){ if(this.armed){ this.bufferKind = 'combo'; this.buffer = M.attackBuffer; } },

		toggle(){
			return;     // melee and magic are no longer separate modes
			if(this.active){
				if(this.inDojo) this.leaveDojo();
				this.active = false;
				this.setMeleeStature(false);
				this.clearAction();
				this.say('Magic');
			}else{
				this.active = true;
				this.setMeleeStature(true);
				this.say('Melee — click to swing');
			}
		},

		toggleDojo(){
			if(!this.active) this.active = true;
			if(this.inDojo) this.leaveDojo();
			else this.enterDojo();
		},

		toggleDebug(){ this.debug = !this.debug; },

		say(msg){
			if(typeof notify==='function') notify(msg);
			else if(typeof dmgNumbers!=='undefined' && typeof player!=='undefined'){
				dmgNumbers.push({x:player.x+player.w/2, y:player.y-28, text:msg, age:0, color:'#d6e4ff'});
			}
		},

		clearAction(){
			this.atk = null;
			this.phase = '';
			this.dash.t = 0;
			this.dash.inv = 0;
			this.parry.t = 0;
			this.hitstop = 0;
			this.buffer = 0;
			this.charge = 0;
		},

		cycleWeapon(dir){
			const order = this.weaponOrder || ['sword'];
			let i = order.indexOf(this.weaponId);
			if(i<0) i = 0;
			i = (i + (dir||1) + order.length) % order.length;
			this.weaponId = order[i];
			if(this.atk) this.endAttack();
			this.charge = 0;
			this.airStep = 0;
			this.buffer = 0;
			this.say(this.weapon().name);
		},

		blocksCast(){ return false; },

		ownsMovement(){
			if(!this.active || typeof player==='undefined') return false;
			if(player.stunTimer>0 || player.ultCharging) return false;
			if(typeof aiChatActive!=='undefined' && aiChatActive) return false;
			if(player.stickyMode && player.stickyMode!=='floor') return false;
			if((player._knockbackTimer||0)>0) return false;
			if(player.inWater) return false;
			return true;
		},

		uiBlocked(){
			return !!(typeof inventoryOpen!=='undefined' && inventoryOpen)
				|| !!(typeof dialogueActive!=='undefined' && dialogueActive)
				|| !!(typeof aiChatActive!=='undefined' && aiChatActive)
				|| !!(typeof necroSelectOpen!=='undefined' && necroSelectOpen)
				|| !!(typeof scrollShopOpen!=='undefined' && scrollShopOpen);
		},

		weapon(){ return this.weapons[this.weaponId] || SWORD; },

		/* ---- input / movement (called in place of the default floor motor) ---- */
		applyMovement(currentSpeed, jumpPow){
			this._jumpPow = jumpPow || player.jumpPow;
			this.beginFrame();
			if(typeof health!=='undefined' && health<=0){
				player.vx = 0;
				player.vy = 0;
				this.resolveState();
				return;
			}
			if(this.hitstop>0){
				player.vx = 0;
				player.vy = 0;
				this.resolveState();
				return;
			}
			if(this._holdVx!=null){
				player.vx = this._holdVx;
				player.vy = this._holdVy;
				this._holdVx = null;
				this._holdVy = null;
			}
			this.applyLocomotion(jumpPow, currentSpeed);
			this.resolveState();
		},

		beginFrame(){
			if(typeof _simTick!=='undefined' && this.frame===_simTick) return;
			this.frame = (typeof _simTick!=='undefined') ? _simTick : this.frame+1;
			this.tickTimers();
			this.readInput();
		},

		/* R art cooldowns (seconds), by how strong each weapon's special is */
		specialCooldownSec(id){
			const t = { spear:2, staff:2, gauntlets:6, daggers:4, whip:4, chain:4, scythe:5, sword:6, glaive:7, greatsword:9, hammer:10 };
			return t[id] || 5;
		},
		specialReady(){ return !((this.specialCd && this.specialCd[this.weaponId]) > 0); },

		tickTimers(){
			if(this.landSquash>0) this.landSquash = Math.max(0, this.landSquash-0.12);
			if(this.hitstop>0) return;
			if(this.specialCd){ for(const k in this.specialCd) if(this.specialCd[k]>0) this.specialCd[k]--; }
			if(this.dash.cd>0) this.dash.cd--;
			if(this.parry.cd>0) this.parry.cd--;
			if(this.buffer>0) this.buffer--;
			if(this.jumpBuffer>0) this.jumpBuffer--;
			if(this.hitstun>0) this.hitstun--;
			if(player.onGround) this.coyote = M.coyote;
			else if(this.coyote>0) this.coyote--;
			if(this.dash.t>0){
				this.dash.t--;
				this.dash.elapsed++;
				if(this.dash.inv>0) this.dash.inv--;
			}
			if(this.parry.t>0){
				const inWindow = this.parryWindow();
				this.parry.t--;
				this.parry.age++;
				if(inWindow && !this.parryWindow() && !this.parry.success) emit('parryFail', {});
			}
		},

		readInput(){
			if(this.uiBlocked()){
				this.captureButtons();
				return;
			}
			const up = !!(keys['w']||keys['arrowup']);
			const down = !!(keys['s']||keys['arrowdown']);
			const attackEdge = this.armed && ((this._lmb && !this._lmbWas) || (!!keys['j'] && !this._jWas));
			const spaceEdge = !!keys[' '] && !this._spaceWas;
			const upEdge = up && !this._upWas;
			const shiftEdge = !!keys['shift'] && !this._shiftWas;
			const parryEdge = this._parryEdge || (!!keys['q'] && !this._qWas);
			const rEdge = this.armed && !!keys['r'] && !this._rWas;
			const vEdge = !!keys['v'] && !this._vWas;
			/* weapons are chosen through the spell slots now */

			const wpn = this.weapon();
			if(!this.armed){ this.charge = 0; }
			else if(wpn.chargeSpecial){
				const holding = !!keys['r'] && this.specialReady() && this.hitstun<=0 && this.hitstop<=0 && !this.atk && this.parry.t<=0 && this.dash.t<=0;
				if(holding) this.charge = Math.min(22, (this.charge||0)+1);
				else if(this._rWas && this.charge>0 && this.hitstop<=0 && this.hitstun<=0){
					const stored = this.charge;
					this.charge = 0;
					this.beginAttack('special', {charge:stored});
				}else if(!keys['r']) this.charge = 0;
			}else if(rEdge && this.hitstun<=0){
				if(this.hitstop<=0 && (!this.atk || this.canChain('special'))){
					this.buffer = 0;
					this.beginAttack('special');
				}else{
					this.bufferKind = 'special';
					this.buffer = M.attackBuffer;
				}
			}

			if(attackEdge && this.hitstun<=0){
				let kind = 'combo';
				if(down) kind = 'down';
				else if(up && !keys[' ']) kind = 'up';
				this.bufferKind = kind;
				this.buffer = M.attackBuffer + (this.atk && this.atk.confirmed ? M.hitBufferBonus : 0);
				if(!this.atk || !this.atk.confirmed){
					if(this.atk && this.atk.missed) this.buffer = Math.min(this.buffer, M.missBuffer + 4);
				}
			}
			if(parryEdge && this.hitstop<=0) this.tryStartParry();
			if(shiftEdge && this.hitstop<=0) this.tryStartDash(up, down);

			const jumpEdge = spaceEdge || (upEdge && !(attackEdge && up && !keys[' ']));
			if(jumpEdge && this.hitstop<=0 && this.hitstun<=0){
				const canCancel = this.atk && this.phase==='cancel' && this.atk.def.canJumpCancel;
				if(canCancel) this.endAttack();
				if(!this.atk || this.phase==='cancel' || this.phase==='recovery'){
					if(!this.tryJump(this._jumpPow||player.jumpPow)){
						/* buffered in tryJump */
					}
				}else{
					this.jumpBuffer = M.jumpBuffer;
				}
			}
			if(this.buffer>0 && this.canChain(this.bufferKind) && this.hitstop<=0 && this.hitstun<=0 && this.parry.t<=0){
				const kind = this.bufferKind;
				this.buffer = 0;
				this.beginAttack(kind);
			}
			this.captureButtons();
		},

		captureButtons(){
			this._lmbWas = this._lmb;
			this._jWas = !!keys['j'];
			this._spaceWas = !!keys[' '];
			this._upWas = !!(keys['w']||keys['arrowup']);
			this._shiftWas = !!keys['shift'];
			this._qWas = !!keys['q'];
			this._rWas = !!keys['r'];
			this._vWas = !!keys['v'];
			this._parryEdge = false;
		},

		applySpecialMotion(def, aim){
			const f = player.facing||1;
			const ax = aim ? aim.x : f;
			const ay = aim ? aim.y : 0;
			const u = def.active<=1 ? 1 : Math.max(0, (this.atk.t - def.startup) / def.active);
			const motion = def.motion;
			if(motion==='flurry'){
				const p = this.atk.pulse||0;
				const last = def.pulses && p >= def.pulses-1;
				if(last){
					player.vx = -ax * 7;
					player.vy = -2;
				}else{
					player.vx = ax * (6 + (p%3)*3);
					player.vy = ay * 5 + ((p%3===1) ? -6 : 0);
					if(p%3===1) player.onGround = false;
				}
				return true;
			}
			if(motion==='spearVault'){
				if(this.phase==='startup'){
					player.vx = ax * 2;
					player.vy = Math.min(player.vy, 0.5);
					return true;
				}
				if(!this.atk.hopped){
					this.atk.hopped = true;
					player.vx = ax * 20;
					player.vy = -6 + Math.min(0, ay)*10;
					player.onGround = false;
				}
				return true;
			}
			if(motion==='staffPlant'){
				if(this.phase==='startup'){
					player.vx *= 0.2;
					if(player.onGround) player.vy = 0;
					return true;
				}
				if(!this.atk.hopped){
					this.atk.hopped = true;
					player.vx = ax * 7;
					player.vy = -18;
					player.onGround = false;
				}
				return true;
			}
			if(motion==='cleave'){
				player.vx = ax * (u<0.4 ? 10 : 2.4);
				return true;
			}
			if(motion==='chargeCleave'){
				player.vx *= 0.08;
				return true;
			}
			if(motion==='rise'){
				if(u<0.55){
					player.vy = -17;
					player.vx = ax * 3.2;
					player.onGround = false;
				}
				return true;
			}
			if(motion==='slam'){
				player.vx *= 0.12;
				if(!player.onGround) player.vy = Math.max(player.vy, 14);
				return true;
			}
			if(motion==='spin'){
				player.vx = ax * 10;
				player.vy = ay * 2.4;
				return true;
			}
			if(motion==='hook'){
				player.vx = ax * 1.2;
				return true;
			}
			if(motion==='grabSlam'){
				player.vx = this.atk.grab ? player.vx*0.2 : f * (this.phase==='startup' ? 4.5 : 1.5);
				return true;
			}
			if(motion==='whip'){
				player.vx = ax * 0.6;
				return true;
			}
			if(motion==='grapple'){
				player.vx = ax * 0.8;
				return true;
			}
			return false;
		},

		applyLocomotion(jumpPow, currentSpeed){
			if(jumpPow) this._jumpPow = jumpPow;
			const maxG = M.maxGround * (currentSpeed / (player.speed||7));
			const grounded = !!player.onGround;
			let mx = 0;
			if(keys['a']||keys['arrowleft']) mx -= 1;
			if(keys['d']||keys['arrowright']) mx += 1;

			if(this.dash.t>0){
				player.vx = this.dash.vx;
				player.vy = this.dash.vy;
				if(mx) player.facing = mx;
				if(player.launchVx){ player.vx += player.launchVx; player.launchVx *= 0.88; if(Math.abs(player.launchVx)<0.5) player.launchVx=0; }
				return;
			}

			const locked = this.atk && !(this.atk.def.canTurn && this.phase==='startup');
			if(!locked && mx){ player.facing = mx; player.hasMoved = true; }
			else if(!locked && !mx){
				const look = this.sampleAim();
				if(Math.abs(look.x)>0.42) player.facing = look.x>0 ? 1 : -1;
			}

			const wpn = this.weapon();
			let steer = 1;
			if(this.parry.t>0) steer = 0.15;
			else if(this.hitstun>0) steer = 0.35;
			else if(this.charge>0 && !this.atk) steer = 0.18;
			else if(this.atk){
				const authored = this.atk.def.steer!=null ? this.atk.def.steer : (wpn.attackSteer!=null ? wpn.attackSteer : M.attackSteer);
				if(this.phase==='startup' || this.phase==='active') steer = authored;
				else if(this.phase==='cancel') steer = M.cancelSteer;
				else steer = M.recoverySteer;
			}

			let max = grounded ? maxG : M.maxAir;
			if(this.charge>0 && !this.atk) max *= 0.12;
			const accelBase = grounded ? M.groundAccel : M.airAccel;
			const decel = grounded ? M.groundDecel : M.airDecel;
			const turning = mx && player.vx*mx < 0;
			let rate = (mx===0 ? decel : (turning ? M.turnAccel : accelBase)) * steer;
			if(!grounded) rate *= (wpn.airControl==null ? 1 : wpn.airControl);
			let vx = approach(player.vx, mx*max, rate);

			const hopping = this.atk && this.atk.def.hop && this.atk.hopped && !this.atk.def.motion;
			const special = this.atk && this.atk.def.motion && (this.phase==='startup' || this.phase==='active') && this.applySpecialMotion(this.atk.def, this.atk.aim);
			if(special){
				/* velocity is owned by the special */
			}else if(this.atk && this.atk.def.hop && this.phase==='active' && !this.atk.hopped){
				this.atk.hopped = true;
				player.vx = this.atk.def.hop.x * player.facing;
				player.vy = this.atk.def.hop.y;
				player.onGround = false;
			}else if(!hopping && this.atk && (this.phase==='startup' || this.phase==='active')){
				const lug = this.phase==='startup' ? this.atk.def.windup : this.atk.def.lunge;
				vx = lug * player.facing + mx * max * steer * 0.35;
				player.vx = vx;
				if(this.atk.def.plunge && this.phase==='active') player.vy = this.atk.def.plunge;
			}else if(!hopping){
				player.vx = vx;
			}
			if(player.launchVx){ player.vx += player.launchVx; player.launchVx *= 0.88; if(Math.abs(player.launchVx)<0.5) player.launchVx=0; }

			if(this.jumpBuffer>0 && (player.onGround || this.coyote>0) && this.hitstun<=0 && this.parry.t<=0){
				if(!this.atk || (this.phase==='cancel' && this.atk.def.canJumpCancel) || this.phase==='recovery' || this.phase===''){
					if(this.atk && this.phase!=='' && this.phase!=='recovery') this.endAttack();
					this.tryJump(jumpPow);
				}
			}
			const jumpHeld = !!(keys[' ']||keys['w']||keys['arrowup']);
			if(this.jumpCutArm && !jumpHeld && player.vy < M.jumpCut) player.vy = M.jumpCut;
			if(player.onGround) this.jumpCutArm = false;

			if(grounded && Math.abs(player.vx)>1.2){
				this.walkPhase += Math.abs(player.vx)*0.045;
			}
		},

		tryJump(pow){
			const grounded = player.onGround || this.coyote>0;
			if(!grounded){
				if(this.bonusJump>0) this.bonusJump--;
				else{ this.jumpBuffer = M.jumpBuffer; return false; }
			}
			player.vy = pow;
			player.onGround = false;
			this.coyote = 0;
			this.jumpBuffer = 0;
			this.jumpCutArm = true;
			player.hasJumped = true;
			return true;
		},

		tryStartDash(up, down){
			if(this.dash.cd>0 || this.dash.t>0 || this.hitstun>0) return;
			if(typeof window.vowNoDash === 'function' && window.vowNoDash()) return;      // Vow of the Open Gate: you gave up dashing
			if(this.parry.t>0 && this.parry.age < PARRY.startup+PARRY.active) return;
			if(this.atk){
				const ok = this.phase==='cancel' && this.atk.def.canDashCancel;
				const late = this.phase==='recovery' && this.atk.def.canDashCancel && this.atk.def.attackType==='light';
				if(!ok && !late) return;
				this.endAttack();
			}
			let mx = 0, my = 0;
			if(keys['a']||keys['arrowleft']) mx -= 1;
			if(keys['d']||keys['arrowright']) mx += 1;
			if(!mx) mx = player.facing || 1;
			if(up) my -= 1;
			if(down) my += 1;
			const len = Math.hypot(mx, my)||1;
			this.dash.vx = (mx/len) * DASH.speed;
			this.dash.vy = (my/len) * (my ? DASH.vertical : 0);
			if(!my) this.dash.vy = 0;
			this.dash.t = DASH.duration;
			this.dash.elapsed = 0;
			this.dash.inv = DASH.invuln;
			this.dash.cd = DASH.cooldown + DASH.duration;
			player.facing = mx>0 ? 1 : (mx<0 ? -1 : player.facing);
			emit('dash', { x:this.dash.vx, y:this.dash.vy });
		},

		tryStartParry(){
			if(this.parry.cd>0 || this.parry.t>0 || this.hitstun>0 || this.dash.t>0) return;
			if(this.atk && this.phase!=='cancel' && this.phase!=='recovery') return;
			if(this.atk) this.endAttack();
			this.parry.t = PARRY.startup + PARRY.active + PARRY.recovery;
			this.parry.age = 0;
			this.parry.success = false;
			this.parry.cd = this.parry.t + PARRY.cooldown;
			emit('parryStart', {});
		},

		parryWindow(){
			if(!this.active || this.parry.t<=0) return false;
			const age = this.parry.age;
			return age>=PARRY.startup && age<PARRY.startup+PARRY.active;
		},

		canChain(kind){
			if(this.dash.t>0 && this.dash.elapsed<DASH.attackCancel) return false;
			if(!this.atk) return true;
			const d = this.atk.def;
			const lateActive = this.phase==='active' && this.atk.t >= d.startup+d.active-2;
			const inCancel = this.phase==='cancel';
			if(!(lateActive || inCancel)) return false;
			if(kind==='special') return inCancel || (lateActive && d.canAttackCancel);
			if(!d.canAttackCancel && kind==='combo') return false;
			if(kind==='combo' && !d.next) return false;
			if((kind==='up' || kind==='down') && !inCancel && !lateActive) return false;
			return true;
		},

		beginAttack(kind, opts){
			if(this.dash.t>0){
				if(this.dash.elapsed<DASH.attackCancel) return;
				this.dash.t = 0;
				this.dash.inv = 0;
			}
			const moves = (this.weapon().moves) || null;
			if(!moves) return;
			const air = !player.onGround && this.coyote<=0;
			let key;
			if(kind==='special') key = (air && moves.specialAir) ? 'specialAir' : 'special';
			else if(kind==='up') key = air ? 'up' : 'launcher';
			else if(kind==='down') key = air ? 'down' : 'heavy';
			else if(this.atk && this.atk.def.next) key = this.atk.def.next;
			else if(air) key = this.airStep>=1 ? 'nair2' : 'nair';
			else key = 'g1';
			const base = moves[key];
			if(!base) return;
			const isArt = key==='special' || key==='specialAir';
			if(isArt){
				if(!this.specialReady()){
					const left = (this.specialCd[this.weaponId]||0) / 60;
					if(!this._cdNoteAt || performance.now()-this._cdNoteAt > 900){ this._cdNoteAt = performance.now(); if(typeof notify==='function') notify(base.name+' ready in '+left.toFixed(1)+'s'); }
					this.buffer = 0; this.bufferKind = 'combo'; this.charge = 0;
					return;
				}
				(this.specialCd || (this.specialCd = {}))[this.weaponId] = Math.round(this.specialCooldownSec(this.weaponId)*60);
				this.specialCdMax = this.specialCd[this.weaponId];
			}
			const def = this.modifyAttack(base);
			if(opts && opts.charge && def.chargeable){
				const u = Math.max(0.42, Math.min(1, opts.charge/22));
				def.damage = Math.round(def.damage * (0.55+0.9*u));
				def.hitbox.w = Math.round(def.hitbox.w * (0.72+0.5*u));
				def.hitbox.h = Math.round(def.hitbox.h * (0.82+0.32*u));
				def.hitstop = Math.max(def.hitstop, Math.round((def.hitstop||2) * (0.65+0.7*u)));
				def.knockback.x = def.knockback.x * (0.65+0.75*u);
				def._charge = u;
			}
			this.charge = 0;
			let aim = this.sampleAim();
			let cursor = null;
			if(this.weapon().style==='whip' || this.weapon().style==='chain'){
				cursor = this.whipCursor();
				const ox = player.x+player.w/2, oy = player.y+player.h*0.42;
				const L = Math.hypot(cursor.x-ox, cursor.y-oy) || 1;
				aim = { x:(cursor.x-ox)/L, y:(cursor.y-oy)/L };
			}
			if(Math.abs(aim.x)>0.16) player.facing = aim.x>0 ? 1 : -1;
			this.atk = {
				id: attackSerial++,
				def: def,
				t: 0,
				confirmed: false,
				missed: false,
				missExtra: 0,
				hit: new Set(),
				pulse: 0,
				hopped: false,
				cursor: cursor,
				aim: aim
			};
			this.phase = 'startup';
			if(key==='nair') this.airStep = 1;
			else if(key==='nair2') this.airStep = 2;
			else if(!def.aerial) this.airStep = 0;
			emit('attackStart', { attack:def, id:this.atk.id });
			this.resolveState();
		},

		modifyAttack(def){
			const a = Object.assign({}, def, {
				hitbox: Object.assign({}, def.hitbox),
				knockback: Object.assign({}, def.knockback),
				poses: def.poses
			});
			const speed = this.weapon().attackSpeed || 1;
			if(speed!==1){
				a.startup = Math.max(1, Math.round(a.startup/speed));
				a.active = Math.max(1, Math.round(a.active/speed));
				a.recovery = Math.max(1, Math.round(a.recovery/speed));
			}
			const reach = this.weapon().reach || 1;
			if(reach!==1){
				a.hitbox = Object.assign({}, a.hitbox, {
					ox: a.hitbox.ox * reach,
					w: a.hitbox.w * (0.65+0.35*reach)
				});
			}
			for(let i=0;i<this.attackModifiers.length;i++){
				try{ this.attackModifiers[i](a); }catch(err){ console.error(err); }
			}
			return a;
		},

		endAttack(){
			const atk = this.atk;
			if(atk && atk.grab) this.releaseGrab(atk);
			this.atk = null;
			this.phase = '';
			if(atk) emit('attackEnd', { attack:atk.def, confirmed:atk.confirmed, missed:atk.missed });
		},

		phaseFor(atk){
			const d = atk.def;
			const t = atk.t;
			const rec = d.recovery + (atk.missExtra||0);
			if(t < d.startup) return 'startup';
			if(t < d.startup+d.active) return 'active';
			if(t < d.startup+d.active+d.cancel) return 'cancel';
			if(t < d.startup+d.active+d.cancel+rec) return 'recovery';
			return 'done';
		},

		gravityScale(){
			if(!this.active) return 1;
			if(this.hitstop>0) return 0;
			if(this.dash.t>0) return this.dash.vy ? 0.35 : 0.12;
			if(this.atk && this.atk.def.plunge && this.phase==='active') return 0.25;
			return 1;
		},

		extraGravity(){
			if(!this.active || this.hitstop>0 || this.dash.t>0) return 0;
			if(this.atk && this.atk.def.plunge) return 0;
			if((keys['s']||keys['arrowdown']) && !player.onGround && player.vy>-2 && !(this.atk && this.phase==='startup')) return M.fastFall;
			return 0;
		},

		afterPhysics(){
			if(!this.active) return;
			if(player.onGround && !this.wasGround){
				this.airStep = 0;
				this.landSquash = 1;
				emit('land', {});
			}
			this.wasGround = !!player.onGround;
			if(this.inDojo && player.y > this.origin.y + 820){
				player.x = this.safe.x;
				player.y = this.safe.y;
				player.vx = 0;
				player.vy = 0;
				player.onGround = true;
			}
			if(this.inDojo && player.onGround) this.safe = { x:player.x, y:player.y };
		},

		hijackMove(ent){
			if(!this.inDojo || ent!==player) return false;
			this.integrate(ent);
			return true;
		},

		integrate(ent){
			const prevX = ent.x, prevY = ent.y;
			let rx = ent.vx||0, ry = ent.vy||0;
			const step = 8;
			ent.onGround = false;
			while(Math.abs(rx)>0.01){
				const st = Math.sign(rx)*Math.min(Math.abs(rx), step);
				const px = ent.x;
				ent.x += st;
				rx -= st;
				if(this.resolveX(ent, px)) break;
			}
			if(ent.flying){
				ent.y += ry;
				return;
			}
			while(Math.abs(ry)>0.01){
				const st = Math.sign(ry)*Math.min(Math.abs(ry), step);
				const py = ent.y;
				ent.y += st;
				ry -= st;
				this.resolveY(ent, py);
				if(ent.onGround && ry>0) break;
			}
			ent._prevX = prevX;
			ent._prevY = prevY;
		},

		resolveX(ent, prevX){
			for(let i=0;i<this.solids.length;i++){
				const s = this.solids[i];
				if(s.kind!=='solid') continue;
				if(!overlap(ent, s)) continue;
				if(prevX+ent.w <= s.x+0.8) ent.x = s.x-ent.w;
				else if(prevX >= s.x+s.w-0.8) ent.x = s.x+s.w;
				else ent.x = (ent.x+ent.w/2 < s.x+s.w/2) ? s.x-ent.w : s.x+s.w;
				ent.vx = 0;
				return true;
			}
			return false;
		},

		resolveY(ent, prevY){
			const prevFeet = prevY+ent.h;
			for(let i=0;i<this.solids.length;i++){
				const s = this.solids[i];
				if(!overlap(ent, s)) continue;
				if(s.kind==='solid'){
					if((ent.vy||0)>=0 && prevFeet <= s.y+8){
						ent.y = s.y-ent.h; ent.vy = 0; ent.onGround = true;
					}else if((ent.vy||0)<0 && prevY >= s.y+s.h-8){
						ent.y = s.y+s.h; ent.vy = 0;
					}
				}else if((ent.vy||0)>=0 && prevFeet <= s.y+10 && ent.y+ent.h >= s.y){
					ent.y = s.y-ent.h; ent.vy = 0; ent.onGround = true;
				}
			}
		},

		/* ---- combat resolution, after movement ---- */
		lateUpdate(){
			if(!this.active) return;
			this.beginFrame();
			if(typeof health!=='undefined' && health<=0){
				this.resolveState();
				this.tickDummies();
				return;
			}
			if(this.hitstop>0){
				this.hitstop--;
				this.resolveState();
				return;
			}
			if(this.atk && this.atk.grab) this.tickGrab();
			if(this.atk){
				if(this.atk.def.aerial && player.onGround && this.phase!=='startup'){
					this.hitscan();
					if(this.atk && this.atk.def.plunge){
						if(this.atk.confirmed){
							player.vy = -9.6;
							player.onGround = false;
							this.jumpCutArm = false;
							emit('plungeBounce', {});
						}
					}
					this.endAttack();
				}else{
					this.hitscan();
					this.advanceAttack();
				}
			}
			if(this.parry.t===0 && this.parry.age>0 && !this.parry.success && this.parry._failAge!==this.parry.age){
				/* failure is emitted once when the window closes without a hit */
			}
			this.tickDummies();
			this.resolveState();
			if(this.state==='run' && this.frame%16===0) emit('footstep', {});
		},

		advanceAttack(){
			const atk = this.atk;
			if(!atk) return;
			const prev = this.phase;
			atk.t++;
			const next = this.phaseFor(atk);
			if(prev==='active' && next!=='active' && !atk.confirmed){
				atk.missed = true;
				atk.missExtra = atk.def.missRecovery||0;
				if(this.buffer > M.missBuffer) this.buffer = M.missBuffer;
			}
			if(prev!=='active' && next==='active') emit('attackSwing', { attack:atk.def, id:atk.id });
			if(prev!=='cancel' && next==='cancel') emit('attackCancellable', { attack:atk.def });
			this.phase = next;
			if(next==='done'){
				const kind = this.bufferKind;
				const buffered = this.buffer>0;
				this.endAttack();
				if(buffered && kind==='combo'){
					this.buffer = 0;
					this.beginAttack('combo');
				}
			}
		},

		hitscan(){
			if(!this.atk || this.phase!=='active') return;
			const def = this.atk.def;
			if(def.noHit) return;           // e.g. a magical item's throw: the thrown item does the hitting
			if(def.pulses && def.pulseEvery){
				const pulse = Math.floor((this.atk.t - def.startup) / def.pulseEvery);
				if(pulse!==this.atk.pulse){
					this.atk.pulse = pulse;
					this.atk.hit = new Set();
				}
			}
			if(def.motion==='grabSlam'){
				if(this.atk.grab) return;
				if(this.atk.t - def.startup > 9){ this.atk.t = def.startup + def.active; return; }      // nothing seized: straight to recovery
			}
			const boxes = this.strikeBoxes(def);      // two pieces when the weapon is passing through a portal
			const list = this.targets();
			for(let i=0;i<list.length;i++){
				const en = list[i];
				if(!en || en.dead || this.atk.hit.has(en)) continue;
				let touch = false;
				for(let b=0;b<boxes.length;b++) if(overlap(boxes[b], en)){ touch = true; break; }
				if(!touch) continue;
				this.atk.hit.add(en);
				this.connect(en);
			}
		},

		/* where this attack actually hits: specials with their own shapes too, moved out through a Spatial portal */
		strikeBox(def, noPortal){
			let box = this.attackRect(def, true);
			if(def.motion==='slam'){
				const u = def.active<=1 ? 1 : Math.max(0, (this.atk.t-def.startup)/def.active);
				const w = 56 + u*150;
				const aim = this.atk.aim || {x:player.facing||1, y:0};
				const cx = player.x+player.w/2 + aim.x*16;
				box = { x:cx-w/2, y: player.y+player.h-30, w:w, h:36 };
			}else if(def.motion==='spin'){
				const w = 118;
				const h = 78;
				box = { x: player.x+player.w/2-w/2, y: player.y+player.h*0.15, w:w, h:h };
			}else if(def.motion==='flurry'){
				const aim = this.atk.aim || {x:player.facing||1, y:0};
				const flick = ((this.atk.pulse||0)%2===0) ? 0.35 : -0.55;
				const ox = aim.x*22 + (-aim.y)*flick*18;
				const oy = aim.y*22 + aim.x*flick*18;
				box = { x: player.x+player.w/2+ox-16, y: player.y+player.h*0.35+oy-16, w:32, h:32 };
			}
			const portal = !noPortal && this.portalStrike ? this.portalStrike() : null;
			if(portal){
				const s = this.portalShift(box, portal);
				box = { x: box.x + s.x, y: box.y + s.y, w: box.w, h: box.h };
			}
			return box;
		},
		/* how far an attack shape moves to come out of the portal: its centre lands on the exit */
		portalShift(box, portal){
			return { x: portal.x - (box.x + box.w/2), y: portal.y - (box.y + box.h/2) };
		},

		sampleAim(){
			const px = player.x + player.w/2;
			const py = player.y + player.h*0.42;
			const sx = (typeof mouseScreenX==='number') ? mouseScreenX : (px - (camera.x||0));
			const sy = (typeof mouseScreenY==='number') ? mouseScreenY : (py - (camera.y||0));
			let dx = (sx + (camera.x||0)) - px;
			let dy = (sy + (camera.y||0)) - py;
			if(typeof keys!=='undefined'){
				if(keys['w']||keys['arrowup']) dy -= 80;
				if(keys['s']||keys['arrowdown']) dy += 100;
			}
			const len = Math.hypot(dx, dy) || 1;
			if(len<18) return { x: player.facing||1, y: 0 };
			return { x: dx/len, y: dy/len };
		},

		aimArmAngle(aim){
			const a = aim || (this.atk && this.atk.aim) || this.sampleAim();
			const f = player.facing||1;
			return Math.atan2(a.x * f, a.y);
		},

		/* Same direction the hitbox uses, including cleave and sweep rotation. */
		hitAimVector(def){
			let aim;
			if(this.atk && this.atk.aim) aim = { x:this.atk.aim.x, y:this.atk.aim.y };
			else {
				const a = this.sampleAim();
				aim = { x:a.x, y:a.y };
			}
			const d = def || (this.atk && this.atk.def);
			if(this.atk && d && (d.sweep || d.motion==='cleave' || d.motion==='chargeCleave') && this.phase==='active'){
				const u = d.active<=1 ? 1 : (this.atk.t - d.startup)/d.active;
				const sweep = (u-0.45) * (d.motion==='chargeCleave' ? 1.7 : (d.sweep ? 1.9 : 1.25));
				const c = Math.cos(sweep), s = Math.sin(sweep);
				aim = { x: aim.x*c - aim.y*s, y: aim.x*s + aim.y*c };
			}
			return aim;
		},

		toArm(vec){
			const f = player.facing||1;
			const x = vec && vec.x ? vec.x : 0;
			const y = vec && vec.y ? vec.y : 0;
			return -Math.atan2(x * f, y);
		},

		holdsVertical(style){
			return style==='sword' || style==='hammer' || style==='greatsword' || style==='scythe' || style==='glaive';
		},

		gripAngle(style){
			if(style==='sword' || style==='greatsword' || style==='hammer' || style==='scythe' || style==='glaive') return -Math.PI;
			if(style==='gauntlets') return -0.42;
			if(style==='daggers') return -0.5;
			return -0.2;
		},

		/* Shaft weapons stay in line with the arm. Handled weapons cross the hand. */
		weaponRoll(style){
			if(style==='spear' || style==='staff' || style==='glaive' || style==='whip' || style==='chain' || style==='gauntlets') return 0;
			if(style==='daggers') return Math.PI/2;
			return -Math.PI/2;
		},

		/* Canvas arm angle. 0 is down, negative is forward. The middle of a swing sits on the hit. */
		weaponSwing(){
			const style = (this.weapon() && this.weapon().style) || 'sword';
			const contact = this.toArm(this.hitAimVector(this.atk && this.atk.def));
			const grip = this.gripAngle(style);
			const vertical = this.holdsVertical(style);
			if(!this.atk){
				let arm;
				if(style==='spear' || style==='staff' || style==='whip' || style==='chain') arm = contact;
				else if(style==='daggers') arm = grip*0.55 + contact*0.45;
				else if(style==='gauntlets') arm = grip*0.7 + contact*0.3;
				else arm = grip;
				if(this.charge>0) arm = -2.15;
				const roll = this.weaponRoll(style);
				const fore = arm - roll;
				return { arm:fore, armB:this.offHand(style, fore), ext:0, roll:roll };
			}
			const d = this.atk.def;
			const spec = this.swingSpec(style, d);
			let phase = this.phase;
			let u = 0;
			if(phase==='startup'){
				u = d.startup<=1 ? 1 : this.atk.t / d.startup;
			}else if(phase==='active'){
				u = d.active<=1 ? 1 : (this.atk.t - d.startup) / Math.max(1, d.active);
			}else{
				phase = 'recover';
				const span = Math.max(1, d.cancel + d.recovery + (this.atk.missExtra||0));
				u = Math.min(1, Math.max(0, (this.atk.t - d.startup - d.active) / span));
			}
			let dir = (d.hitbox && d.hitbox.ox<0) ? -1 : 1;
			if(spec.kind==='flick'){
				const pulse = (this.atk && this.atk.pulse) || 0;
				dir = (pulse%2) ? -1 : 1;
			}
			let arm = contact;
			let ext = 0;
			const poke = spec.ext || 0;
			const settle = vertical ? grip : contact;
			if(spec.kind==='plant'){
				arm = 0.1;
				ext = 6;
			}else if(spec.kind==='flick' && phase==='active'){
				const every = d.pulseEvery || 2;
				const local = ((this.atk.t - d.startup) % every) / every;
				arm = contact + dir*(spec.wind*(1-local) - spec.follow*local);
				ext = poke * Math.sin(Math.min(1, local)*Math.PI);
			}else if(spec.kind==='downcut' || spec.kind==='drop'){
				const high = contact - (spec.kind==='drop' ? 1.7 : 1.25);
				const low = contact + (spec.kind==='drop' ? 0.4 : 1.0);
				const approach = high + (contact-high)*0.3;
				if(phase==='startup') arm = high + (approach-high)*u;
				else if(phase==='active'){
					if(u<0.45) arm = approach + (contact-approach)*(u/0.45);
					else arm = contact + (low-contact)*((u-0.45)/0.55);
				}else arm = low + (settle-low)*u;
			}else if(spec.kind==='thrust' || spec.kind==='lash' || spec.kind==='punch'){
				const wind = spec.wind || 0.2;
				if(phase==='startup') arm = contact + wind*dir*(1-u);
				else if(phase==='active') arm = contact + wind*0.1*dir*(1-u);
				else arm = contact + (settle-contact)*u*0.35;
				if(phase==='startup') ext = poke*0.25*u;
				else if(phase==='active') ext = poke*(0.4+0.6*u);
				else ext = poke*(1-u);
			}else{
				const start = vertical ? grip : (contact + spec.wind*dir);
				const pre = contact + Math.min(0.5, spec.wind*0.4)*dir;
				const post = contact - Math.min(0.45, spec.follow*0.35)*dir;
				if(phase==='startup') arm = start + (pre-start)*u;
				else if(phase==='active'){
					if(u<0.45) arm = pre + (contact-pre)*(u/0.45);
					else arm = contact + (post-contact)*((u-0.45)/0.55);
				}else arm = post + (settle-post)*u;
				if(phase==='startup') ext = poke*0.25*u;
				else if(phase==='active') ext = poke*(0.45+0.55*u);
				else ext = poke*(1-u);
			}
			const roll = this.weaponRoll(style);
			const fore = arm - roll;
			return { arm:fore, armB:this.offHand(style, fore), ext:ext, roll:roll };
		},

		offHand(style, arm){
			if(style==='daggers') return -arm*0.8;
			if(style==='gauntlets') return -0.5;
			if(style==='spear' || style==='staff') return arm*0.32 + 0.42;
			if(style==='greatsword' || style==='hammer' || style==='glaive') return arm*0.62 + 0.18;
			if(style==='scythe') return arm*0.28 + 0.55;
			if(style==='whip' || style==='chain') return 0.65;
			return -arm*0.22;
		},

		swingSpec(style, d){
			const fx = d.fx || 'arc';
			const motion = d.motion || '';
			if(motion==='staffPlant' && this.phase==='startup') return { kind:'plant' };
			if(fx==='upper' || motion==='rise'){
				const big = style==='greatsword' || style==='hammer';
				return { kind:'rise', wind: big?1.2:0.65, follow: big?2.05:1.5, ease: big?'heavy':'snap', ext: style==='spear'?10:2 };
			}
			if(fx==='overhead' || fx==='smash' || motion==='slam'){
				const heavy = style==='hammer' || style==='greatsword';
				return { kind:'drop', high: heavy?-2.95:-2.4, low: heavy?0.15:-0.15, ease:'heavy', ext:0 };
			}
			if(style==='daggers' || fx==='flurry' || motion==='flurry'){
				return { kind:'flick', wind:0.48, follow:0.42, ease:'snap', ext:2 };
			}
			if(style==='gauntlets' || fx==='punch'){
				return { kind:'punch', wind:0.62, follow:0.02, ease:'snap', ext: style==='gauntlets'?8:3 };
			}
			if(style==='spear' && (fx==='thrust' || fx==='vault' || motion==='spearVault')){
				return { kind:'thrust', wind:0.16, follow:0.02, ease:'snap', ext: motion==='spearVault'?8:16 };
			}
			if(style==='spear') return { kind:'slash', wind:1.05, follow:0.8, ease:'snap', ext:5 };
			if(style==='staff'){
				if(fx==='arc' || motion==='spin') return { kind:'slash', wind:1.35, follow:1.2, ease:'snap', ext:4 };
				return { kind:'thrust', wind:0.3, follow:0.05, ease:'snap', ext:8 };
			}
			if(style==='whip'){
				if(d.sweep) return { kind:'slash', wind:1.75, follow:1.6, ease:'snap', ext:0 };
				return { kind:'lash', wind:0.2, follow:0.1, ease:'snap', ext:0 };
			}
			if(style==='chain'){
				if(d.sweep) return { kind:'slash', wind:1.4, follow:1.25, ease:'snap', ext:0 };
				return { kind:'lash', wind:0.72, follow:0.48, ease:'snap', ext:3 };
			}
			if(style==='scythe'){
				if(fx==='upper') return { kind:'rise', wind:0.9, follow:1.35, ease:'snap', ext:0 };
				return { kind:'downcut', wind:1.2, follow:0.9, ease:'snap', ext:0 };
			}
			if(style==='greatsword') return { kind:'slash', wind:2.3, follow:1.8, ease:'heavy', ext:0 };
			if(style==='hammer') return { kind:'slash', wind:1.8, follow:1.25, ease:'heavy', ext:0 };
			if(style==='glaive') return { kind:'slash', wind:1.9, follow:1.45, ease:'snap', ext:6 };
			const wide = fx==='cleave' || motion==='cleave' || motion==='chargeCleave';
			return { kind:'slash', wind: wide?2.1:1.4, follow: wide?1.65:1.02, ease: wide?'heavy':'snap', ext:0 };
		},

		/* Arm-local points on the far side of the whip or chain hit. */
		flexTips(){
			const idle = [{x:0, y:46}];
			const def = this.atk && this.atk.def;
			if(!def || typeof player==='undefined') return idle;
			const vis = Math.max(0.5, rigScale());
			const f = player.facing||1;
			const swing = this.weaponSwing();
			const armAng = swing.arm||0;
			const pose = this.visualPose();
			const lean = pose.lean||0;
			const sleeve = partSpan('body','sleeve');
			const handDrop = Math.max(6, sleeve.below*0.72*0.88) + (swing.ext||0);
			const rect = this.attackRect(def, true);
			const aim = this.hitAimVector(def);
			const tx = Math.abs(aim.x)>0.02 ? (rect.w*0.5)/Math.abs(aim.x) : 1e9;
			const ty = Math.abs(aim.y)>0.02 ? (rect.h*0.5)/Math.abs(aim.y) : 1e9;
			const reach = this.whipPoint() ? 0 : Math.min(tx, ty)*0.78;      // a whip's tip is the cursor point itself
			const cx = rect.x+rect.w/2, cy = rect.y+rect.h/2;
			const thick = Math.min(rect.w, rect.h)*(def.sweep ? 0.62 : 0);
			const count = def.sweep ? 5 : 1;
			const sideX = -aim.y, sideY = aim.x;
			const feetX = player.x+player.w/2;
			const feetY = player.y+player.h;
			const cl = Math.cos(lean), sl = Math.sin(lean);
			const ca = Math.cos(armAng), sa = Math.sin(armAng);
			const tips = [];
			for(let i=0;i<count;i++){
				const s = count===1 ? 0 : (i/(count-1)*2-1);
				const wx = cx + aim.x*reach + sideX*thick*s;
				const wy = cy + aim.y*reach + sideY*thick*s;
				const rx = (wx-feetX)/(f*vis) - (pose.shift||0);
				const ry = (wy-feetY)/vis - (pose.crouch||0) + 52;
				const ux = rx*cl + ry*sl;
				const uy = -rx*sl + ry*cl;
				const bx = ux-14, by = uy-12;
				tips.push({
					x: bx*ca + by*sa - 2,
					y: Math.max(18, -bx*sa + by*ca - handDrop)
				});
			}
			return tips;
		},

		attackRect(def, noPortal){
			const hb = def.hitbox || {ox:24, oy:0, w:36, h:24};
			const aim = this.hitAimVector(def);
			let reach = Math.max(12, Math.hypot(hb.ox||0, hb.oy||0));
			if(def.motion==='whip') reach *= 1.35;
			else if(def.motion==='hook' || def.motion==='grapple') reach *= 1.2;
			else if(def.motion==='spin' || def.motion==='slam') reach *= 0.35;
			const px = player.x+player.w/2;
			const py = player.y+player.h*0.42;
			let cx = px + aim.x * reach;
			let cy = py + aim.y * reach;
			// a Spatial-reinforced weapon strikes through a portal at the cursor
			const portal = !noPortal && this.portalStrike ? this.portalStrike() : null;
			if(portal){ cx = portal.x; cy = portal.y; }
			const whipAt = !portal ? this.whipPoint() : null;      // the whip lashes where the cursor is (within its reach)
			if(whipAt){ cx = whipAt.x; cy = whipAt.y; }
			let long = Math.max(18, hb.w||36);
			let thick = Math.max(14, hb.h||24);
			if(whipAt){
				long = Math.max(44, (hb.w||60)*0.7);
				thick = Math.max(26, (hb.h||20)*1.5);
			}else if(def.pin){
				long = Math.max(36, hb.w||64);
				thick = Math.max(28, hb.h||40);
			}else if(def.sweep){
				long = Math.max(long, hb.w||140);
				thick = Math.max(thick, hb.h||96);
			}
			const hw = Math.abs(aim.x)*long*0.5 + Math.abs(aim.y)*thick*0.5;
			const hh = Math.abs(aim.y)*long*0.5 + Math.abs(aim.x)*thick*0.5;
			return { x:cx-hw, y:cy-hh, w:Math.max(14, hw*2), h:Math.max(14, hh*2) };
		},

		hurtbox(){
			return {
				x: player.x+6,
				y: player.y+4,
				w: Math.max(8, player.w-12),
				h: Math.max(8, player.h-6)
			};
		},

		targets(){
			const out = [];
			const seen = new Set();
			function add(en){
				if(!en || seen.has(en)) return;
				seen.add(en);
				out.push(en);
			}
			if(typeof getAllTargets==='function'){
				const list = getAllTargets();
				for(let i=0;i<list.length;i++) add(list[i]);
			}else if(typeof enemies!=='undefined'){
				for(let i=0;i<enemies.length;i++) add(enemies[i]);
			}
			for(let i=0;i<this.dummies.length;i++) add(this.dummies[i]);
			return out;
		},

		connect(en){
			const atk = this.atk;
			const def = atk.def;
			if(typeof frostboundKnightDormant==='function' && frostboundKnightDormant(en)){
				en.flash = 4;
				if(typeof dmgNumbers!=='undefined') dmgNumbers.push({x:en.x+en.w/2,y:en.y-12,text:'IMMUNE',age:0,color:'#88ddff'});
				return;
			}
			const aim = atk.aim || {x: player.facing||1, y:0};
			let amount = def.damage;
			const ev = {
				source: player,
				target: en,
				amount: amount,
				direction: aim.x>=0 ? 1 : -1,
				knockback: {
					x: (def.knockback.x||0) * Math.max(0.35, Math.abs(aim.x)),
					y: (def.knockback.y||0) + aim.y * Math.abs(def.knockback.x||0) * 0.8,
					duration: def.knockback.duration
				},
				hitstun: def.hitstun,
				attackType: def.attackType,
				attackId: atk.id,
				weaponId: this.weapon().id,
				poiseDamage: def.poiseDamage,
				tags: ['physical','melee'],
				name: def.name,
				pull: def.pull||null,
				pullPower: def.pullPower||0,
				interrupt: !!def.interrupt,
				bounce: !!def.bounce
			};
			for(let i=0;i<this.damageListeners.length;i++){
				try{ this.damageListeners[i](ev); }catch(err){ console.error(err); }
			}
			amount = Math.max(0, ev.amount);
			const reaction = this.applyReaction(en, ev, amount);
			atk.confirmed = true;
			if(this.hitstop<=0 && def.hitstop>0){
				this._holdVx = player.vx;
				this._holdVy = player.vy;
			}
			this.hitstop = Math.max(this.hitstop, def.hitstop||0);
			en._meleeFreeze = Math.max(en._meleeFreeze||0, def.hitstop||0);
			if(def.attackType==='launcher' && reaction==='launch') this.bonusJump = 1;
			if(def.motion==='grabSlam') this.beginGrab(en, reaction);
			emit('attackHit', { event:ev, reaction:reaction, target:en });
			if(def.poiseDamage>=4 || def.attackType==='heavy') emit('heavyHit', { event:ev, target:en });
			if(reaction==='stagger') emit('enemyStagger', { target:en, event:ev });
			if(reaction==='launch') emit('enemyLaunch', { target:en, event:ev });
			emit('cameraImpulse', { strength: def.hitstop||2, kind: def.attackType });
		},

		poiseOf(en){
			if(en._meleePoise!=null) return en._meleePoise;
			if(en.typeDef && en.typeDef.isBoss) return 14;
			if(en.bossPhase && en.w>90) return 14;
			const area = (en.w||32)*(en.h||48);
			if(area<1400) return 1;
			if(area<3200) return 3;
			if(area<7000) return 6;
			return 9;
		},

		applyReaction(en, ev, amount){
			const poise = this.poiseOf(en);
			const power = ev.poiseDamage||1;
			const boss = poise>=12;
			let kind = 'light';
			if(ev.attackType==='parry') kind = 'stagger';
			else if(boss && power<6) kind = 'resist';
			else if(ev.bounce && poise<=4) kind = 'launch';
			else if(ev.attackType==='launcher' && poise<=4) kind = 'launch';
			else if(ev.attackType==='downward' && poise<=3) kind = 'knockdown';
			else if(!boss && power>=poise+1) kind = 'stagger';
			else if(ev.attackType==='heavy' && power+1>=poise) kind = 'heavy';
			else if(power*3<poise) kind = 'resist';
			if(amount>0) this.deal(en, amount, ev);
			const kb = ev.knockback||{x:0,y:0,duration:8};
			let scale = 1;
			if(kind==='resist') scale = boss ? 0.08 : 0.22;
			else if(boss) scale = 0.12;
			else scale = Math.min(1.15, (power+0.65)/Math.max(1, poise));
			if(kind==='launch') scale = Math.max(scale, 1);
			const dur = Math.max(6, Math.round((kb.duration||10) * (kind==='resist'?0.45:1)));
			const dir = ev.direction||1;
			en._kbVx = (kb.x||0) * dir * scale * (20/Math.max(8, dur));
			en._kbVy = (kb.y||0) * (kind==='launch' ? Math.max(scale, 0.85) : scale);
			if(ev.pull==='enemy' && !boss && poise<=4 && kind!=='resist'){
				const toward = Math.sign((player.x+player.w/2)-(en.x+en.w/2)) || -dir;
				en._kbVx = toward * (ev.pullPower||12) * (20/Math.max(8, dur));
				en._kbVy = Math.min(en._kbVy, -1.2);
			}
			if(ev.pull==='grapple' && !boss){
				if(poise<=3){
					const toward = Math.sign((player.x+player.w/2)-(en.x+en.w/2)) || -dir;
					en._kbVx = toward * (ev.pullPower||12) * (20/Math.max(8, dur));
					en._kbVy = -2;
				}else{
					const toward = Math.sign((en.x+en.w/2)-(player.x+player.w/2)) || dir;
					player.launchVx = (player.launchVx||0) + toward * 8;
					player.vy = Math.min(player.vy, -3.2);
					en._kbVx *= 0.25;
				}
			}
			if(ev.interrupt && !boss && ((en._swing>0) || (en.attackAnimTimer>0) || en.charging)){
				en.stunTimer = Math.max(en.stunTimer||0, 18);
				en._swing = 0;
				en.attackAnimTimer = 0;
			}
			if(kind==='knockdown') en._kbVy = Math.abs(kb.y||8)*scale;
			en._kbTimer = dur;
			en._meleeKind = kind;
			en._meleeTilt = dir * (kind==='resist'?0.08:0.28);
			if(kind==='stagger' || kind==='knockdown') en.stunTimer = Math.max(en.stunTimer||0, boss?8:(kind==='knockdown'?22:14));
			else if(kind==='launch') en.stunTimer = Math.max(en.stunTimer||0, 8);
			else if(kind==='heavy') en.stunTimer = Math.max(en.stunTimer||0, 8);
			else en.stunTimer = Math.max(en.stunTimer||0, 4);
			if(en._meleeDummy && (kind==='launch' || kind==='knockdown')) en.flying = false;
			en.flash = Math.max(en.flash||0, kind==='resist'?4:8);
			return kind;
		},

		deal(en, amount, ev){
			if(en && en.blockHit && en.blockHit(amount, { melee: true })) return;      // the Boundless boss: your blow stops short
			if(typeof IS_COOP!=='undefined' && IS_COOP && typeof COOP_GUEST!=='undefined' && COOP_GUEST){
				if(window.__coopNet && !en._meleeDummy){
					if(en._coopKey) window.__coopNet.sendEnemyDmg({ key:en._coopKey, dmg:Math.round(amount) });
					else if(typeof isCoopBoss==='function' && isCoopBoss(en)) window.__coopNet.sendEnemyDmg({ boss:true, dmg:Math.round(amount) });
				}
				return;
			}
			en.hp = (en.hp||0) - amount;
			if(en.hp<=0){
				en.hp = 0;
				if(en._meleeDummy){ en.dead = true; en._deadT = 0; }
			}
		},

		isInvulnerable(){
			return !!(this.active && this.dash.inv>0);
		},

		tryParry(){
			if(!this.parryWindow()) return false;
			if(this.spellGate && this.spellGate() === false) return false;      // a spell too strong for the weapon goes straight through the guard
			const first = !this.parry.success;
			this.parry.success = true;
			this.parry.t = Math.min(this.parry.t, 6);
			if(first){
				this.hitstop = Math.max(this.hitstop, 4);
				emit('parry', {});
				emit('cameraImpulse', { strength:4, kind:'parry' });
				this.staggerThreat();
			}
			return true;
		},

		staggerThreat(){
			const list = this.targets();
			let best = null, bd = 130;
			for(let i=0;i<list.length;i++){
				const en = list[i];
				if(!en || en.dead) continue;
				const dx = (en.x+en.w/2)-(player.x+player.w/2);
				if(dx*(player.facing||1) < -16) continue;
				const d = Math.abs(dx);
				const threat = (en._swing>0) || (en.attackAnimTimer>0) || en.charging || d<84;
				if(threat && d<bd){ bd = d; best = en; }
			}
			if(!best) return;
			const ev = {
				source: player, target: best, amount: PARRY.riposte, direction: player.facing||1,
				knockback:{x:8, y:-2.5, duration:12}, hitstun:16,
				attackType:'parry', attackId:-1, weaponId:this.weapon().id,
				poiseDamage:8, tags:['physical','parry'], name:'Parry'
			};
			this.applyReaction(best, ev, PARRY.riposte);
			best._meleeFreeze = Math.max(best._meleeFreeze||0, 4);
		},

		onPlayerHurt(dmg){
			if(!this.active) return;
			this.hitstun = Math.max(2, Math.round(12 * (this.hitstunScale ? this.hitstunScale() : 1)));     // reinforcement stability shortens it
			this.bonusJump = 0;
			if(this.atk && this.phase!=='active') this.endAttack();
			if(this.parry.t>0 && !this.parry.success){
				emit('parryFail', {});
				this.parry.t = Math.min(this.parry.t, 8);
			}
			emit('playerHit', { amount:dmg });
			this.resolveState();
		},

		resolveState(){
			let s = 'idle';
			if(typeof health!=='undefined' && health<=0) s = 'death';
			else if(this.hitstun>0) s = 'hit';
			else if(this.parry.t>0) s = 'parry';
			else if(this.dash.t>0) s = 'dash';
			else if(this.atk) s = this.atk.def.aerial ? 'airAttack' : 'attack';
			else if(!player.onGround) s = player.vy<0.35 ? 'jump' : 'fall';
			else if(Math.abs(player.vx)>0.55) s = 'run';
			if(s!==this.state){
				this.state = s;
				this.anim.t = 0;
			}else if(this.anim.t<1) this.anim.t = Math.min(1, this.anim.t+0.22);
		},

		/* ---- training dummies ---- */
		tickDummies(){
			for(let i=0;i<this.dummies.length;i++) this.tickDummy(this.dummies[i]);
		},

		tickDummy(d){
			if(d.dead){
				d._deadT = (d._deadT||0)+1;
				if(d._deadT>110){
					d.dead = false;
					d.hp = d.maxHp;
					d.x = d.spawnX;
					d.y = d.spawnY;
					d.vx = 0; d.vy = 0;
					d._kbTimer = 0;
					d.stunTimer = 0;
					d.flying = !!d.hover;
					d._deadT = 0;
				}
				return;
			}
			d.age = (d.age||0)+1;
			if((d._meleeFreeze||0)>0){ d._meleeFreeze--; return; }
			if(d.flash>0) d.flash--;
			if(d._meleeTilt) d._meleeTilt *= 0.86;
			if((d._kbTimer||0)>0){
				d._kbTimer--;
				const k = d._kbTimer/16;
				d.vx = (d._kbVx||0)*k;
				d.vy = (d._kbVy||0)*k;
			}else if((d.stunTimer||0)>0){
				d.stunTimer--;
				d.vx *= 0.8;
			}else if(d.flying){
				const goal = d.spawnY + Math.sin(d.age*0.045)*22;
				d.vy += (goal-d.y)*0.05;
				d.vy *= 0.86;
				const dir = Math.sign((player.x+player.w/2)-(d.x+d.w/2))||1;
				d.facing = dir;
				d.vx = approach(d.vx||0, dir*d.speed, 0.15);
				this.dummyAttack(d, 90);
			}else{
				d.vy = (d.vy||0)+0.55;
				if(d.vy>16) d.vy = 16;
				const dir = Math.sign((player.x+player.w/2)-(d.x+d.w/2))||1;
				d.facing = dir;
				const dist = Math.abs((player.x+player.w/2)-(d.x+d.w/2));
				const sameBand = Math.abs((player.y+player.h/2)-(d.y+d.h/2)) < 90;
				if(dist>46 && dist<280 && sameBand) d.vx = dir*d.speed;
				else d.vx = approach(d.vx||0, 0, 0.4);
				if(Math.abs(d.x-d.spawnX)>150) d.vx = Math.sign(d.spawnX-d.x)*d.speed;
				this.dummyAttack(d, 70);
			}
			if(d.hover && !d.flying && d.onGround && (d._kbTimer||0)<=0 && (d.stunTimer||0)<=0){
				d.flying = true;
				d.vy = -6;
			}
			this.integrate(d);
		},

		dummyAttack(d, reach){
			const dx = (player.x+player.w/2)-(d.x+d.w/2);
			const dy = (player.y+player.h/2)-(d.y+d.h/2);
			if((d._swing||0)>0){
				d._swing--;
				d.vx *= 0.55;
				const active = d._swing < d.swingActive && d._swing>2;
				if(active && !d._didHit){
					const box = {
						x: d.x+d.w/2 + d.facing*18 - 22,
						y: d.y+8,
						w: 44,
						h: Math.max(16, d.h-12)
					};
					if(overlap(box, this.hurtbox())){
						d._didHit = true;
						if(typeof damagePlayer==='function') damagePlayer(d.dmg);
					}
				}
				if(d._swing===0) d._didHit = false;
				return;
			}
			d._atkCd = (d._atkCd||0)-1;
			if(d._atkCd<=0 && Math.abs(dx)<reach && Math.abs(dy)<70){
				d._atkCd = d.period;
				d._swing = d.swingTime;
				d._didHit = false;
				d.facing = dx>=0?1:-1;
			}
		},

		/* ---- training yard ---- */
		enterDojo(){
			if(typeof player==='undefined') return;
			this.returnPos = { x:player.x, y:player.y, vx:player.vx, vy:player.vy };
			this.origin = { x:48000, y:320 };
			this.buildDojo();
			player.x = this.origin.x+90;
			player.y = this.origin.y+560-player.h;
			player.vx = 0; player.vy = 0;
			player.onGround = true;
			this.safe = { x:player.x, y:player.y };
			this.wasGround = true;
			this.inDojo = true;
			this.clearAction();
			this.say('Training yard — P returns');
		},

		leaveDojo(){
			this.inDojo = false;
			this.dummies.length = 0;
			this.solids.length = 0;
			if(this.returnPos && typeof player!=='undefined'){
				player.x = this.returnPos.x;
				player.y = this.returnPos.y;
				player.vx = 0;
				player.vy = 0;
			}
			this.returnPos = null;
			this.say('Left the training yard');
		},

		buildDojo(){
			const ox = this.origin.x, oy = this.origin.y;
			const solids = [];
			const signs = [];
			const add = (kind,x,y,w,h)=>solids.push({kind,x:ox+x,y:oy+y,w,h});
			const sign = (x,y,text)=>signs.push({x:ox+x,y:oy+y,text});
			const floor = (x,w)=>add('floor', x, 560, w, 70);
			floor(0, 740);
			sign(40, 500, '1  Movement');
			floor(800, 760);
			add('oneway', 900, 450, 150, 16);
			add('oneway', 1120, 360, 150, 16);
			add('oneway', 1320, 270, 160, 16);
			add('oneway', 1040, 200, 110, 16);
			sign(820, 500, '2  Platforms');
			floor(1620, 680);
			sign(1640, 500, '3  Small');
			floor(2360, 680);
			sign(2380, 500, '4  Medium');
			floor(3100, 700);
			sign(3120, 500, '5  Large');
			floor(3860, 900);
			sign(3880, 500, '6  Crowd');
			floor(4820, 820);
			add('oneway', 4960, 430, 180, 16);
			add('oneway', 5220, 330, 180, 16);
			add('oneway', 5480, 240, 140, 16);
			sign(4840, 500, '7  Aerial');
			floor(5700, 220);
			add('solid', 5960, 400, 36, 160);
			floor(6040, 180);
			add('solid', 6280, 340, 36, 220);
			add('oneway', 6360, 430, 120, 16);
			floor(6520, 200);
			sign(5720, 500, '8  Walls');
			floor(6780, 2000);
			sign(6820, 500, '9  Dash');
			add('solid', -20, 200, 28, 430);
			add('solid', 8760, 200, 28, 430);
			this.solids = solids;
			this.signs = signs;
			const d = [];
			const spawn = (kind, x, y)=>d.push(this.makeDummy(kind, ox+x, oy+y));
			spawn('small', 1760, 560-34);
			spawn('small', 1960, 560-34);
			spawn('medium', 2520, 560-54);
			spawn('large', 3280, 560-78);
			spawn('small', 3980, 560-34);
			spawn('small', 4140, 560-34);
			spawn('small', 4320, 560-34);
			spawn('medium', 4520, 560-54);
			spawn('air', 5080, 380);
			spawn('air', 5340, 280);
			this.dummies = d;
		},

		makeDummy(kind, x, y){
			const spec = {
				small:{ w:26, h:34, hp:90, speed:1.55, poise:1, dmg:8, period:120, swing:28, active:8, color:'#63c56a', name:'Small' },
				medium:{ w:40, h:54, hp:190, speed:1.2, poise:3, dmg:12, period:145, swing:34, active:9, color:'#5aa0e6', name:'Medium' },
				large:{ w:64, h:80, hp:360, speed:0.82, poise:8, dmg:16, period:170, swing:44, active:12, color:'#aeb6c2', name:'Large' },
				air:{ w:30, h:28, hp:80, speed:1.35, poise:1, dmg:9, period:100, swing:24, active:8, color:'#c084f5', name:'Aerial', hover:true }
			}[kind];
			return {
				_meleeDummy:true,
				kind:kind,
				name:spec.name,
				x:x, y:y-(kind==='air'?0:0),
				spawnX:x, spawnY:y,
				w:spec.w, h:spec.h,
				vx:0, vy:0,
				hp:spec.hp, maxHp:spec.hp,
				facing: -1,
				speed:spec.speed,
				_meleePoise:spec.poise,
				dmg:spec.dmg,
				period:spec.period,
				_atkCd:40+Math.random()*40,
				swingTime:spec.swing,
				swingActive:spec.active,
				_swing:0,
				color:spec.color,
				hover:!!spec.hover,
				flying:!!spec.hover,
				dead:false,
				flash:0,
				stunTimer:0,
				onGround:false,
				age:0
			};
		},

		/* ---- presentation ---- */
		drawPlayer(ctx, px, py){
			if(!this.active) return false;
			if(typeof PlayerRig !== 'undefined' && PlayerRig.isReady()){
				this.paintNewRig(ctx, px, py, player);
				return true;
			}
			this.paintRig(ctx, px, py, player, this.visualPose());
			return true;
		},

		/* how far the weapon's basic attack actually reaches from the body (world px) */
		weaponReachPx(){
			const w = this.weapon(); if(!w || !w.moves) return 0;
			if(w._reachPx) return w._reachPx;
			let best = 0;
			for(const k of ['g1','g2','g3']){
				const d = w.moves[k]; if(!d || !d.hitbox) continue;
				const hb = d.hitbox;
				const far = Math.hypot(hb.ox || 0, hb.oy || 0) + Math.max(18, hb.w || 36) * 0.5;
				best = Math.max(best, far);
			}
			best *= (w.reach || 1);       // a magical item's size sets how far it reaches
			w._reachPx = best;
			return best;
		},

		/* the skeletal rig (player-rig.js): same pose data, real joints */
		paintNewRig(ctx, px, py, who){
			const pose = this.visualPose();
			const style = this.armed ? ((this.weapon() && this.weapon().style) || 'sword') : null;
			const st = this.state;
			const authored = !!this.atk || st === 'hit' || st === 'parry' || st === 'death';
			const aimW = this.sampleAim();
			const f = who.facing || 1;
			const o = {
				state: (st === 'attack' || st === 'airAttack') ? (player.onGround ? 'idle' : 'fall') : st,
				grounded: !!player.onGround, vx: player.vx || 0, vy: player.vy || 0,
				walkPhase: this.walkPhase, frame: this.frame,
				weapon: style,
				swing: style && (this.atk || this.charge > 0) ? this.weaponSwing() : null,
				rest: !!style && !this.atk && !(this.charge > 0) && st !== 'parry' && st !== 'hit' && st !== 'death',
				spellHand: !style,
				castT: player.castTimer || 0, castColor: player.castColor,
				channel: !style && typeof mouseDown !== 'undefined' && mouseDown && !this.uiBlocked(),
				aim: { x: aimW.x * f, y: aimW.y },
				reachPx: style ? this.weaponReachPx() : 0,
				squash: this.landSquash || 0,
				angleLegs: authored, angleArms: authored,
				tint: clothHex()
			};
			if(this.weapon() && this.weapon().magicItem) o.hideWeapon = true;      // drawn by the magic, as the compressed energy itself
			const portal = !o.hideWeapon && style && style !== 'whip' && style !== 'chain' && style !== 'gauntlets' && this.portalStrike ? this.portalStrike() : null;
			if(portal && portal.active) o.portal = { x: portal.x - camera.x, y: portal.y - camera.y };
			else if(style && !o.hideWeapon && style !== 'gauntlets'){
				const cut = this.portalCut();
				if(cut) o.portalCut = { cx: cut.cx - camera.x, cy: cut.cy - camera.y, ex: cut.cx + cut.ox - camera.x, ey: cut.cy + cut.oy - camera.y };
			}
			if(style === 'whip' || style === 'chain'){
				const self = this;
				o.weaponDraw = function(c){ if(style === 'whip') self.drawWhip(c); else self.drawChain(c); };
			}
			if(!who.baseH) who.baseH = this._stature || 56;
			const res = PlayerRig.draw(ctx, px, py, who, pose, o);
			if(res){
				this._rigHand = res.hand;
				this._rigTip = style ? res.tip : null;
				this._rigPortalIn = res.portalIn || null;
				if(!res.tip && (style==='whip' || style==='chain') && this.atk && this._rigHand && this.atk.cursor){
					const ext = this.flexExtend().ext, hx = this._rigHand.x + camera.x, hy = this._rigHand.y + camera.y;
					this.rememberTip(hx + (this.atk.cursor.x-hx)*ext, hy + (this.atk.cursor.y-hy)*ext, this.phase==='active');
				} else if(res.tip){
					const hot = this.phase==='active' || this.phase==='startup' || this.phase==='cancel';
					const tp = res.portalTip || res.tip;
					if(!!res.portalTip !== !!this._trailPortal){ this.trail.length = 0; this._trailPortal = !!res.portalTip; }      // no streak between hand and portal
					this.rememberTip(tp.x + camera.x, tp.y + camera.y, hot);
				} else if(this.trail.length) this.trail.length = 0;
			}
		},

		postRender(ctx){
			if(!ctx) return;
			ctx.save();
			ctx.setTransform(1,0,0,1,0,0);
			if(this.inDojo) this.paintDojo(ctx);
			else{
			this.paintTrail(ctx);
			this.paintSpecialFx(ctx);
			if(this._slamRing){
				const r = this._slamRing; r.t++;
				if(r.t>18) this._slamRing = null;
				else{
					const u = r.t/18;
					ctx.save(); ctx.strokeStyle = 'rgba(255,214,140,'+(0.85*(1-u))+')'; ctx.lineWidth = 6*(1-u)+1;
					ctx.beginPath(); ctx.ellipse(r.x-camera.x, r.y-camera.y-4, r.r*u, r.r*u*0.28, 0, 0, Math.PI*2); ctx.stroke(); ctx.restore();
				}
			}
			if(this.active && this.debug) this.paintDebug(ctx);
			this.paintHud(ctx);
			}
			ctx.restore();
		},

		paintDojo(ctx){
			const w = canvas.width, h = canvas.height;
			const g = ctx.createLinearGradient(0,0,0,h);
			g.addColorStop(0, '#1a2140');
			g.addColorStop(0.45, '#2a3158');
			g.addColorStop(1, '#14101c');
			ctx.fillStyle = g;
			ctx.fillRect(0,0,w,h);
			ctx.fillStyle = 'rgba(255,244,210,0.85)';
			ctx.beginPath();
			ctx.arc(w*0.78, h*0.16, 18, 0, Math.PI*2);
			ctx.fill();
			ctx.strokeStyle = 'rgba(255,255,255,0.18)';
			ctx.lineWidth = 2;
			for(let i=0;i<5;i++){
				ctx.beginPath();
				ctx.arc(w*0.78, h*0.16, 28+i*10, 0.2, 1.1);
				ctx.stroke();
			}
			for(let i=0;i<this.solids.length;i++){
				const s = this.solids[i];
				const x = s.x-camera.x, y = s.y-camera.y;
				if(x>w+40 || x+s.w<-40) continue;
				ctx.fillStyle = s.kind==='solid' ? '#3a4158' : (s.kind==='oneway' ? '#6a5438' : '#3e4658');
				ctx.fillRect(x, y, s.w, s.h);
				ctx.fillStyle = s.kind==='oneway' ? '#e0c48a' : '#9aa4bc';
				ctx.fillRect(x, y, s.w, s.kind==='floor'?8:4);
			}
			ctx.fillStyle = '#d5def5';
			ctx.font = 'bold 14px Georgia, serif';
			ctx.textAlign = 'left';
			for(let i=0;i<this.signs.length;i++){
				const s = this.signs[i];
				ctx.fillText(s.text, s.x-camera.x, s.y-camera.y);
			}
			for(let i=0;i<this.dummies.length;i++) this.paintDummy(ctx, this.dummies[i]);
			if((player.iFrames<=0 || (player.iFrames%4<2))){
				this.paintRig(ctx, player.x-camera.x, player.y-camera.y, player, this.visualPose());
			}
			this.paintTrail(ctx);
			this.paintSpecialFx(ctx);
			if(this.debug) this.paintDebug(ctx);
			this.paintHud(ctx);
		},

		paintDummy(ctx, d){
			if(d.dead) return;
			const x = d.x-camera.x, y = d.y-camera.y;
			ctx.save();
			ctx.translate(x+d.w/2, y+d.h);
			ctx.rotate(d._meleeTilt||0);
			ctx.fillStyle = d.color;
			roundRect(ctx, -d.w/2, -d.h, d.w, d.h*0.72, 6);
			ctx.fill();
			if(d.flash>0){
				ctx.fillStyle = 'rgba(255,255,255,0.55)';
				roundRect(ctx, -d.w/2, -d.h, d.w, d.h*0.72, 6);
				ctx.fill();
			}
			ctx.fillStyle = '#2a241c';
			ctx.fillRect(-d.w/2+4, -d.h+6, d.w-8, 8);
			if(d.kind==='large'){
				ctx.fillStyle = '#7d8794';
				ctx.fillRect(-d.w/2-4, -d.h+18, 8, d.h*0.45);
			}
			if(d.kind==='air'){
				ctx.fillStyle = '#e9d5ff';
				ctx.beginPath();
				ctx.ellipse(-d.w/2-2, -d.h*0.55, 10, 5, -0.4, 0, Math.PI*2);
				ctx.ellipse(d.w/2+2, -d.h*0.55, 10, 5, 0.4, 0, Math.PI*2);
				ctx.fill();
			}
			ctx.fillStyle = '#1a120c';
			ctx.fillRect(-6, -8, d.w*0.28, 6);
			ctx.fillRect(2, -8, d.w*0.22, 6);
			if((d._swing||0)>0){
				ctx.strokeStyle = 'rgba(255,220,160,0.8)';
				ctx.lineWidth = 3;
				ctx.beginPath();
				ctx.arc(d.facing*10, -d.h*0.55, d.w*0.7, -1.2, 0.8, d.facing<0);
				ctx.stroke();
			}
			ctx.restore();
			const pct = Math.max(0, d.hp/d.maxHp);
			ctx.fillStyle = 'rgba(0,0,0,0.55)';
			ctx.fillRect(x-2, y-10, d.w+4, 4);
			ctx.fillStyle = pct>0.5?'#5dca7a':pct>0.25?'#e0a15a':'#e05a5a';
			ctx.fillRect(x-2, y-10, (d.w+4)*pct, 4);
			if((d._swing||0)>d.swingTime-10){
				ctx.fillStyle = '#ffd27a';
				ctx.font = '10px Arial';
				ctx.textAlign = 'center';
				ctx.fillText('!', x+d.w/2, y-14);
			}
		},

		visualPose(){
			const base = this.basePose();
			if(this.charge>0 && !this.atk){
				const sp = this.weapon().moves && this.weapon().moves.special;
				if(sp && sp.poses) return lerpPose(base, sp.poses.windup, Math.min(1, this.charge/18));
			}
			if(!this.atk) return base;
			const d = this.atk.def;
			const t = this.atk.t;
			const poses = d.poses;
			let pose;
			if(this.phase==='startup'){
				const u = d.startup<=1 ? 1 : t/d.startup;
				pose = lerpPose(base, poses.windup, easeOut(u));
			}else if(this.phase==='active'){
				const u = d.active<=1 ? 1 : (t-d.startup)/d.active;
				pose = lerpPose(poses.windup, poses.strike, easeIn(u));
			}else{
				const start = d.startup+d.active;
				const span = d.cancel+d.recovery+(this.atk.missExtra||0);
				const u = span<=1 ? 1 : (t-start)/span;
				pose = lerpPose(poses.strike, poses.follow, easeOut(Math.max(0, Math.min(1, u))));
			}
			return pose;
		},

		basePose(){
			const s = this.state;
			const idle = {lean:0.02, head:-0.02, hat:0, armF:0.42, armB:0.28, legF:0.04, legB:-0.04, sword:0, shift:0, crouch:0};
			if(s==='run'){
				const w = Math.sin(this.walkPhase);
				const bob = Math.abs(Math.sin(this.walkPhase*2));
				return {
					lean:0.12, head:0.02, hat:0.04,
					armF:-w*0.55, armB:w*0.55,
					legF:w*0.95, legB:-w*0.95,
					sword:0.1, shift:0, crouch:bob*2
				};
			}
			if(s==='jump') return {lean:-0.18, head:-0.08, hat:-0.08, armF:-0.9, armB:-0.7, legF:-0.45, legB:0.55, sword:-0.2, shift:0, crouch:-2};
			if(s==='fall') return {lean:0.16, head:0.06, hat:0.06, armF:-0.25, armB:-0.45, legF:0.35, legB:-0.2, sword:0.15, shift:0, crouch:0};
			if(s==='dash') return {lean:0.72, head:0.1, hat:0.12, armF:-0.35, armB:0.9, legF:1.05, legB:-0.7, sword:0.2, shift:3, crouch:2};
			if(s==='hit') return {lean:-0.5, head:0.28, hat:0.2, armF:0.95, armB:-1.3, legF:0.2, legB:-0.35, sword:0.4, shift:-4, crouch:2};
			if(s==='parry'){
				const wind = this.parry.age < PARRY.startup;
				return wind
					? {lean:-0.15, head:0, hat:0, armF:-0.4, armB:0.2, legF:0.15, legB:-0.1, sword:-0.2, shift:-2, crouch:1}
					: {lean:-0.22, head:-0.06, hat:-0.04, armF:-1.55, armB:-0.4, legF:-0.15, legB:0.35, sword:-0.85, shift:1, crouch:0};
			}
			if(s==='death') return {lean:1.35, head:0.4, hat:0.5, armF:1.2, armB:0.8, legF:1.4, legB:1.1, sword:0.8, shift:6, crouch:16};
			const b = Math.sin((this.frame||0)*0.08);
			idle.crouch = (1-b)*0.6;
			idle.armF = 0.42+b*0.04;
			return idle;
		},

		paintRig(ctx, px, py, who, pose){
			if(Parts.ready){
				this.paintRigArt(ctx, px, py, who, pose);
				return;
			}
			const pal = palette();
			const f = who.facing||1;
			const squash = 1 + (this.landSquash||0)*0.14;
			const stretch = 1 - (this.landSquash||0)*0.1;
			const vis = rigScale();
			const feetX = px + who.w/2;
			const feetY = py + who.h;
			ctx.save();
			ctx.translate(feetX, feetY);
			ctx.scale(f*squash*vis, stretch*vis);
			ctx.translate(pose.shift||0, pose.crouch||0);
			if(who.flash>0) ctx.globalAlpha = 0.92;

			limb(ctx, -5, -15, pose.legB||0, 13, 5, pal.robeDark);
			boot(ctx, -5, -15, pose.legB||0, pal.boot);
			limb(ctx, 5, -15, pose.legF||0, 13, 5.5, pal.robe);
			boot(ctx, 5, -15, pose.legF||0, pal.boot);

			ctx.save();
			ctx.translate(0, -16);
			ctx.rotate(pose.lean||0);

			ctx.fillStyle = pal.robeDark;
			ctx.beginPath();
			ctx.moveTo(-8, 2);
			ctx.quadraticCurveTo(-18, 10, -15, 18);
			ctx.lineTo(13, 18);
			ctx.quadraticCurveTo(16, 10, 9, 2);
			ctx.fill();
			ctx.fillStyle = pal.robe;
			roundRect(ctx, -11, -20, 22, 24, 5);
			ctx.fill();
			ctx.fillStyle = pal.robeLight;
			ctx.fillRect(-1.5, -16, 3, 18);
			ctx.fillStyle = pal.gold;
			ctx.beginPath();
			ctx.arc(0, -4, 2.4, 0, Math.PI*2);
			ctx.fill();

			arm(ctx, -8, -16, pose.armB||0, pal.robeDark, pal.skin);
			staff(ctx, -8, -16, (pose.armB||0)+0.2, pal);

			ctx.save();
			ctx.translate(1, -26);
			ctx.rotate(pose.head||0);
			ctx.fillStyle = pal.hair;
			ctx.beginPath();
			ctx.ellipse(-1, -1, 7, 6, 0, Math.PI, 0);
			ctx.fill();
			ctx.fillStyle = pal.skin;
			ctx.beginPath();
			ctx.arc(1, 1, 8.2, 0, Math.PI*2);
			ctx.fill();
			ctx.fillStyle = pal.skinShade;
			ctx.beginPath();
			ctx.arc(2, 3.2, 5.2, 0.15, Math.PI-0.15);
			ctx.fill();
			ctx.fillStyle = pal.eye;
			ctx.fillRect(4, -1, 2.3, 2.8);
			ctx.fillStyle = '#fff';
			ctx.fillRect(4.2, -0.7, 0.9, 0.9);
			ctx.fillStyle = '#c47a6a';
			ctx.fillRect(5, 3.4, 3.2, 1.1);
			ctx.save();
			ctx.rotate(pose.hat||0);
			ctx.fillStyle = pal.hat;
			ctx.beginPath();
			ctx.moveTo(-10, -1);
			ctx.lineTo(13, 0);
			ctx.lineTo(11, 4);
			ctx.lineTo(-11, 3.5);
			ctx.closePath();
			ctx.fill();
			ctx.beginPath();
			ctx.moveTo(-1.5, -1);
			ctx.lineTo(5, -1);
			ctx.lineTo(2.2, -20);
			ctx.closePath();
			ctx.fill();
			ctx.fillStyle = pal.gold;
			ctx.fillRect(-2.5, -5.5, 8, 2.2);
			ctx.restore();
			ctx.restore();

			const tip = armSword(ctx, 8, -15, pose.armF||0, pose.sword||0, pal);
			ctx.restore();
			ctx.restore();

			if(tip){
				const lean = pose.lean||0;
				const c = Math.cos(lean), s = Math.sin(lean);
				const shx = 8, shy = -15;
				const shoulderX = shx*c - shy*s;
				const shoulderY = -16 + (shx*s + shy*c);
				const armAng = (pose.armF||0) + (pose.sword||0);
				const dist = 36;
				const dx = Math.sin(armAng)*dist, dy = Math.cos(armAng)*dist;
				const lx = (pose.shift||0) + shoulderX + (dx*c - dy*s);
				const ly = (pose.crouch||0) + shoulderY + (dx*s + dy*c);
				const hot = this.phase==='active' || this.phase==='startup' || this.phase==='cancel';
				this.rememberTip(feetX + lx*f*squash*vis + camera.x, feetY + ly*stretch*vis + camera.y, hot);
			}
		},

		rememberTip(x, y, hot){
			if(hot && this.atk && this.atk.def.noHit) hot = false;      // a throw / beam cast: no slash trail
			if(this._tipFrame===this.frame) {
				this.swordTip = {x, y, hot};
				return;
			}
			this._tipFrame = this.frame;
			this.swordTip = {x, y, hot};
			if(hot){
				this.trail.push({x, y, life:1});
				if(this.trail.length>10) this.trail.shift();
			}else if(this.trail.length){
				this.trail.length = 0;
			}
		},

		paintTrail(ctx){
			const tr = this.trail;
			if(!tr || tr.length<2) return;
			ctx.save();
			ctx.lineCap = 'round';
			ctx.lineJoin = 'round';
			for(let i=1;i<tr.length;i++){
				const a = tr[i-1], b = tr[i];
				const t = i/tr.length;
				ctx.strokeStyle = 'rgba(236,244,255,'+(0.15+t*0.55)+')';
				ctx.lineWidth = 2+t*5;
				ctx.beginPath();
				ctx.moveTo(a.x-camera.x, a.y-camera.y);
				ctx.lineTo(b.x-camera.x, b.y-camera.y);
				ctx.stroke();
			}
			ctx.restore();
			for(let i=0;i<tr.length;i++) tr[i].life -= 0.08;
		},

		paintDebug(ctx){
			const hb = this.hurtbox();
			rect(ctx, {x:player.x, y:player.y, w:player.w, h:player.h}, 'rgba(80,220,255,0.9)');
			rect(ctx, hb, 'rgba(80,255,140,0.95)');
			if(this.atk && (this.phase==='active' || this.phase==='startup')){
				const box = this.strikeBox(this.atk.def);
				rect(ctx, box, this.phase==='active' ? 'rgba(255,70,70,0.95)' : 'rgba(255,190,80,0.7)');
			}
			for(let i=0;i<this.dummies.length;i++){
				const d = this.dummies[i];
				if(!d.dead) rect(ctx, d, 'rgba(255,120,220,0.8)');
			}
			const list = (typeof enemies!=='undefined') ? enemies : [];
			for(let i=0;i<list.length;i++){
				const en = list[i];
				if(en && !en.dead) rect(ctx, {x:en.x, y:en.y, w:en.w, h:en.h}, 'rgba(255,80,80,0.35)');
			}
			ctx.fillStyle = 'rgba(6,10,18,0.78)';
			ctx.fillRect(12, 86, 280, 132);
			ctx.fillStyle = '#d5ffe0';
			ctx.font = '12px Consolas, monospace';
			ctx.textAlign = 'left';
			const c = this;
			const lines = [
				'state '+c.state+'   facing '+(player.facing||1),
				'atk '+(c.atk?c.atk.def.name+' #'+c.atk.id:'—')+'  '+c.phase,
				'combo '+(c.atk?c.atk.def.id:'—')+'  t '+(c.atk?c.atk.t:0)+'  buf '+c.buffer,
				'cancel '+(c.phase==='cancel'?'OPEN':'closed')+'  hit '+(c.atk&&c.atk.confirmed?'yes':'no'),
				'hitstop '+c.hitstop+'  dash '+(c.dash.t>0?'go':'cd '+c.dash.cd)+' inv '+c.dash.inv,
				'vel '+player.vx.toFixed(2)+', '+player.vy.toFixed(2)+'  coyote '+c.coyote
			];
			for(let i=0;i<lines.length;i++) ctx.fillText(lines[i], 20, 106+i*18);
		},

		paintHud(ctx){
			if(typeof canvas==='undefined') return;
			const W = canvas.width, H = canvas.height;
			const rr = (x,y,w,h,r)=>{ ctx.beginPath(); if(ctx.roundRect) ctx.roundRect(x,y,w,h,r); else ctx.rect(x,y,w,h); };
			ctx.save();
			ctx.textAlign = 'left';
			const armed = this.armed;
			// bottom-right ability chips (sit under the status panel)
			const chip = (cx, key, name, frac, text, col, ready)=>{
				const cw = 118, chh = 28;
				ctx.fillStyle = 'rgba(10,12,22,0.62)'; rr(cx, H - chh - 14, cw, chh, 8); ctx.fill();
				ctx.save(); rr(cx, H - chh - 14, cw, chh, 8); ctx.clip();
				ctx.fillStyle = ready ? col : 'rgba(255,255,255,0.22)';
				ctx.globalAlpha = ready ? 0.34 : 0.5;
				ctx.fillRect(cx, H - chh - 14, cw * frac, chh);
				ctx.globalAlpha = 1; ctx.restore();
				ctx.strokeStyle = ready ? col : 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1.2;
				ctx.shadowColor = ready ? col : 'transparent'; ctx.shadowBlur = ready ? 8 : 0;
				rr(cx+.5, H - chh - 13.5, cw-1, chh-1, 8); ctx.stroke(); ctx.shadowBlur = 0;
				ctx.fillStyle = ready ? col : '#6c7794'; rr(cx+6, H - chh - 8, 18, 18, 4); ctx.fill();
				ctx.fillStyle = '#10131f'; ctx.font = 'bold 11px Arial'; ctx.textAlign = 'center';
				ctx.fillText(key, cx+15, H - chh + 5);
				ctx.textAlign = 'left'; ctx.font = 'bold 12px Arial';
				ctx.fillStyle = ready ? '#fff' : '#aeb7cf';
				ctx.fillText(name, cx+30, H - chh + 1);
				ctx.font = '10px Arial'; ctx.fillStyle = ready ? col : '#8f98b3';
				ctx.fillText(text, cx+30, H - chh + 12);
			};
			const dcd = Math.min(1, this.dash.cd / (DASH.cooldown+DASH.duration));
			let cx = W - 16 - 118;
			chip(cx, '⇧', 'Dash', 1 - dcd, dcd>0 ? 'recharging' : 'ready', '#8fd0ff', dcd<=0);
			if(armed){
				const left = (this.specialCd && this.specialCd[this.weaponId]) || 0, max = Math.max(1, Math.round(this.specialCooldownSec(this.weaponId)*60));
				chip(cx - 126, 'R', 'Special', 1 - Math.min(1, left/max), left>0 ? (left/60).toFixed(1)+'s' : 'ready', '#ffcf7a', left<=0);
			}
			ctx.restore();
		}
	};

	function approach(cur, target, step){
		if(cur<target) return Math.min(target, cur+step);
		if(cur>target) return Math.max(target, cur-step);
		return target;
	}
	function overlap(a, b){
		return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
	}
	function easeIn(t){ return t*t; }
	function easeOut(t){ return 1-(1-t)*(1-t); }
	function lerpPose(a, b, t){
		const o = {};
		const keysA = a||{};
		const keysB = b||{};
		const names = ['lean','head','hat','armF','armB','legF','legB','sword','shift','crouch'];
		for(let i=0;i<names.length;i++){
			const k = names[i];
			const av = keysA[k]||0, bv = keysB[k]||0;
			o[k] = av + (bv-av)*t;
		}
		return o;
	}
	function shade(hex, m){
		const n = parseInt(String(hex).replace('#',''), 16);
		if(!isFinite(n)) return hex;
		let r=(n>>16)&255, g=(n>>8)&255, b=n&255;
		r = Math.max(0, Math.min(255, r*m|0));
		g = Math.max(0, Math.min(255, g*m|0));
		b = Math.max(0, Math.min(255, b*m|0));
		return 'rgb('+r+','+g+','+b+')';
	}
	function rigScale(){
		const zoom = (typeof CAMERA_ZOOM==='number') ? CAMERA_ZOOM : 1;
		const bodyW = (typeof player!=='undefined' && player.w) ? player.w : 38;
		const bodyH = (typeof player!=='undefined' && player.h) ? player.h : 56;
		const fit = Math.min(bodyW/111.5, bodyH/93.25) * 2 * zoom;
		return Math.max(1, (93.25*fit) / 54);
	}
	function palette(){
		const hex = (typeof PLAYER_COLOR_HEX!=='undefined') ? PLAYER_COLOR_HEX[(typeof MY_COLOR_IDX!=='undefined'?MY_COLOR_IDX:0)%4] : '#4488ff';
		return {
			robe: hex,
			robeDark: shade(hex, 0.62),
			robeLight: shade(hex, 1.35),
			hat: shade(hex, 0.85),
			skin: '#f0c2a0',
			skinShade: '#d39a78',
			boot: '#5c3b2a',
			gold: '#e6c36a',
			hair: '#4a3428',
			eye: '#241c18',
			wood: '#7a5340',
			orb: '#9fd8ff',
			steel: '#e7eef6',
			steelDark: '#8ea0b4',
			grip: '#6b3e2a'
		};
	}
	function roundRect(ctx, x, y, w, h, r){
		ctx.beginPath();
		ctx.moveTo(x+r, y);
		ctx.arcTo(x+w, y, x+w, y+h, r);
		ctx.arcTo(x+w, y+h, x, y+h, r);
		ctx.arcTo(x, y+h, x, y, r);
		ctx.arcTo(x, y, x+w, y, r);
		ctx.closePath();
	}
	function limb(ctx, x, y, rot, len, thick, color){
		ctx.save();
		ctx.translate(x, y);
		ctx.rotate(rot);
		ctx.fillStyle = color;
		ctx.fillRect(-thick/2, 0, thick, len);
		ctx.restore();
	}
	function boot(ctx, x, y, rot, color){
		ctx.save();
		ctx.translate(x, y);
		ctx.rotate(rot);
		ctx.translate(0, 12);
		ctx.fillStyle = color;
		ctx.fillRect(-4, 0, 9, 6);
		ctx.restore();
	}
	function arm(ctx, x, y, rot, cloth, skin){
		ctx.save();
		ctx.translate(x, y);
		ctx.rotate(rot);
		ctx.fillStyle = cloth;
		ctx.fillRect(-3, 0, 6, 12);
		ctx.fillStyle = skin;
		ctx.beginPath();
		ctx.arc(0, 13, 3.2, 0, Math.PI*2);
		ctx.fill();
		ctx.restore();
	}
	function staff(ctx, x, y, rot, pal){
		ctx.save();
		ctx.translate(x, y);
		ctx.rotate(rot);
		ctx.strokeStyle = pal.wood;
		ctx.lineWidth = 2.5;
		ctx.beginPath();
		ctx.moveTo(0, 4);
		ctx.lineTo(0, 28);
		ctx.stroke();
		ctx.fillStyle = pal.orb;
		ctx.beginPath();
		ctx.arc(0, 2, 4.2, 0, Math.PI*2);
		ctx.fill();
		ctx.fillStyle = '#fff';
		ctx.globalAlpha = 0.8;
		ctx.beginPath();
		ctx.arc(-1, 1, 1.4, 0, Math.PI*2);
		ctx.fill();
		ctx.restore();
	}
	function armSword(ctx, x, y, rot, extra, pal){
		ctx.save();
		ctx.translate(x, y);
		ctx.rotate(rot);
		ctx.fillStyle = pal.robe;
		ctx.fillRect(-3.2, 0, 6.4, 11);
		ctx.fillStyle = pal.skin;
		ctx.beginPath();
		ctx.arc(0, 12, 3.3, 0, Math.PI*2);
		ctx.fill();
		ctx.translate(0, 12);
		ctx.rotate(extra);
		ctx.fillStyle = pal.grip;
		ctx.fillRect(-2, 0, 4, 5);
		ctx.fillStyle = pal.gold;
		ctx.fillRect(-6, 4, 12, 2.4);
		ctx.fillStyle = pal.steel;
		ctx.beginPath();
		ctx.moveTo(0, 6);
		ctx.lineTo(3.2, 10);
		ctx.lineTo(1.1, 28);
		ctx.lineTo(0, 31);
		ctx.lineTo(-1.1, 28);
		ctx.lineTo(-3.2, 10);
		ctx.closePath();
		ctx.fill();
		ctx.fillStyle = pal.steelDark;
		ctx.fillRect(-0.6, 8, 1.2, 20);
		const tip = { x: x+Math.sin(rot+extra)*30, y: y+Math.cos(rot+extra)*30 };
		ctx.restore();
		return tip;
	}
	function rect(ctx, r, color){
		ctx.save();
		ctx.strokeStyle = color;
		ctx.lineWidth = 1.5;
		ctx.strokeRect(r.x-camera.x, r.y-camera.y, r.w, r.h);
		ctx.restore();
	}

	function bootFX(){
		on('attackHit', function(p){
			const en = p.target, ev = p.event;
			if(typeof dmgNumbers!=='undefined'){
				dmgNumbers.push({x:en.x+en.w/2, y:en.y-12, text:Math.round(ev.amount)+'', age:0, color: ev.attackType==='heavy'?'#ffd27a':'#f4f7ff'});
			}
			if(typeof spawnImpact==='function') spawnImpact(en.x+en.w/2, en.y+en.h/2, '#dce7ff');
			burst(en.x+en.w/2, en.y+en.h/2, ev.attackType==='heavy'?14:8, '#e7eef8');
		});
		on('heavyHit', function(){});
		on('enemyLaunch', function(p){
			if(typeof dmgNumbers!=='undefined') dmgNumbers.push({x:p.target.x+p.target.w/2, y:p.target.y-26, text:'Launch', age:0, color:'#ffe08a'});
		});
		on('enemyStagger', function(p){
			if(typeof dmgNumbers!=='undefined') dmgNumbers.push({x:p.target.x+p.target.w/2, y:p.target.y-26, text:'Stagger', age:0, color:'#ffd0a8'});
		});
		on('parry', function(){
			if(typeof shakeScreen==='function') shakeScreen(5, 6);
			if(typeof dmgNumbers!=='undefined') dmgNumbers.push({x:player.x+player.w/2, y:player.y-30, text:'PARRY', age:0, color:'#fff1b0'});
			burst(player.x+player.w/2, player.y+player.h/2, 16, '#fff4c2');
		});
		on('parryFail', function(){
			if(typeof dmgNumbers!=='undefined') dmgNumbers.push({x:player.x+player.w/2, y:player.y-24, text:'Missed parry', age:0, color:'#ff8d8d'});
		});
		on('parryStart', function(){});
		on('playerHit', function(){ if(typeof shakeScreen==='function') shakeScreen(3, 5); });
		on('dash', function(){ burst(player.x+player.w/2, player.y+player.h*0.6, 8, '#c9d8ff'); });
		on('land', function(){ burst(player.x+player.w/2, player.y+player.h, 5, '#c8b8a0'); });
		on('cameraImpulse', function(p){
			if(p.kind==='parry') return;
			if((p.strength||0)>=4 && typeof shakeScreen==='function') shakeScreen(Math.min(6, p.strength), 6);
		});
		on('plungeBounce', function(){ if(typeof shakeScreen==='function') shakeScreen(3, 4); });
		on('attackStart', function(){});
		on('attackSwing', function(){});
		on('attackEnd', function(){});
		on('attackCancellable', function(){});
		on('footstep', function(){});
	}
	function burst(x, y, n, color){
		if(typeof particles==='undefined') return;
		for(let i=0;i<n;i++){
			const a = Math.random()*Math.PI*2;
			const s = 1+Math.random()*3.2;
			particles.push({x:x, y:y, vx:Math.cos(a)*s, vy:Math.sin(a)*s-1, life:12+Math.random()*10, color:color});
		}
	}

	function selfTest(){
		function phaseAt(d, t){
			if(t<d.startup) return 'startup';
			if(t<d.startup+d.active) return 'active';
			if(t<d.startup+d.active+d.cancel) return 'cancel';
			if(t<d.startup+d.active+d.cancel+d.recovery) return 'recovery';
			return 'done';
		}
		const need = ['g1','g2','g3','nair','nair2','launcher','up','heavy','down','special'];
		const ids = Object.keys(MeleeMode.weapons);
		if(!ids.length) throw new Error('weapon');
		for(let w=0;w<ids.length;w++){
			const weapon = MeleeMode.weapons[ids[w]];
			if(!weapon.moves) throw new Error(weapon.id+' moves');
			for(let k=0;k<need.length;k++){
				const d = weapon.moves[need[k]];
				const label = weapon.id+'.'+need[k];
				if(!d) throw new Error(label+' missing');
				if(d.startup<1) throw new Error(label+' startup');
				if(phaseAt(d, 0)!=='startup') throw new Error(label+' phase');
				if(phaseAt(d, d.startup)!=='active') throw new Error(label+' active');
				if(phaseAt(d, d.startup+d.active)!=='cancel') throw new Error(label+' cancel');
				if(phaseAt(d, d.startup+d.active+d.cancel+d.recovery)!=='done') throw new Error(label+' done');
				if(!d.hitbox || !(d.damage>0) || !d.poses || !d.poses.strike) throw new Error(label+' data');
				if(d.next && !weapon.moves[d.next]) throw new Error(label+' next');
			}
		}
	}

	const Parts = { ready:false, body:null, weapons:null, meta:null, tint:{} };
	const CLOTH = { hat:1, torso:1, skirt:1, sleeve:1, leg:1 };

	function loadParts(){
		const body = new Image();
		const weapons = new Image();
		body.onload = function(){ Parts.body = body; markParts(); };
		weapons.onload = function(){ Parts.weapons = weapons; markParts(); };
		body.src = 'images/melee/body.png?v=7';
		weapons.src = 'images/melee/weapons.png?v=3';
		if(typeof PlayerRig !== 'undefined' && PlayerRig.META){ Parts.meta = PlayerRig.META; markParts(); return; }
		if(typeof fetch==='function'){
			fetch('images/melee/parts.json?v=6').then(function(r){ return r.json(); }).then(function(m){
				Parts.meta = m;
				markParts();
			}).catch(function(){});
		}
	}
	function markParts(){
		Parts.ready = !!(Parts.body && Parts.weapons && Parts.meta && Parts.meta.body && Parts.meta.weapons);
	}
	function clothHex(){
		if(typeof MY_COLOR_IDX==='undefined' || MY_COLOR_IDX===0) return null;
		if(typeof PLAYER_COLOR_HEX==='undefined') return null;
		return PLAYER_COLOR_HEX[MY_COLOR_IDX % PLAYER_COLOR_HEX.length] || null;
	}
	function rgbToHsl(r, g, b){
		r /= 255; g /= 255; b /= 255;
		const max = Math.max(r,g,b), min = Math.min(r,g,b);
		let h = 0, s = 0;
		const l = (max+min)/2;
		const d = max-min;
		if(d){
			s = l>0.5 ? d/(2-max-min) : d/(max+min);
			if(max===r) h = ((g-b)/d)%6;
			else if(max===g) h = (b-r)/d+2;
			else h = (r-g)/d+4;
			h *= 60;
			if(h<0) h += 360;
		}
		return [h, s, l];
	}
	function hslToRgb(h, s, l){
		const c = (1-Math.abs(2*l-1))*s;
		const hp = h/60;
		const x = c*(1-Math.abs(hp%2-1));
		let r=0,g=0,b=0;
		if(hp<1){ r=c; g=x; }
		else if(hp<2){ r=x; g=c; }
		else if(hp<3){ g=c; b=x; }
		else if(hp<4){ g=x; b=c; }
		else if(hp<5){ r=x; b=c; }
		else { r=c; b=x; }
		const m = l-c/2;
		return [Math.round((r+m)*255), Math.round((g+m)*255), Math.round((b+m)*255)];
	}
	function hexToHsl(hex){
		const n = parseInt(String(hex).replace('#',''), 16);
		return rgbToHsl((n>>16)&255, (n>>8)&255, n&255);
	}
	function recolorPart(sheet, spec, hex){
		const key = hex+'|'+spec.sx+'|'+spec.sy+'|'+spec.sw;
		if(Parts.tint[key]) return Parts.tint[key];
		const c = document.createElement('canvas');
		c.width = spec.sw;
		c.height = spec.sh;
		const g = c.getContext('2d');
		g.drawImage(sheet, spec.sx, spec.sy, spec.sw, spec.sh, 0, 0, spec.sw, spec.sh);
		const target = hexToHsl(hex);
		const data = g.getImageData(0, 0, spec.sw, spec.sh);
		const p = data.data;
		for(let i=0;i<p.length;i+=4){
			if(p[i+3]<8) continue;
			const hsl = rgbToHsl(p[i], p[i+1], p[i+2]);
			if(hsl[1]<0.22 || hsl[0]<185 || hsl[0]>255) continue;
			const rgb = hslToRgb(target[0], Math.min(1, hsl[1]*0.75+target[1]*0.25), hsl[2]);
			p[i] = rgb[0]; p[i+1] = rgb[1]; p[i+2] = rgb[2];
		}
		g.putImageData(data, 0, 0);
		Parts.tint[key] = c;
		return c;
	}
	function partSpan(group, name){
		const spec = Parts.meta && Parts.meta[group] && Parts.meta[group][name];
		if(!spec) return { above:8, below:8, dh:16, dw:10 };
		const above = spec.dh * (spec.ay / Math.max(1, spec.sh));
		return { above: above, below: spec.dh - above, dh: spec.dh, dw: spec.dw };
	}

	function drawPart(ctx, group, name, tint){
		if(!Parts.ready) return;
		const spec = Parts.meta[group] && Parts.meta[group][name];
		if(!spec) return;
		const sheet = group==='body' ? Parts.body : Parts.weapons;
		const scx = spec.dw / spec.sw;
		const scy = spec.dh / spec.sh;
		const dx = -spec.ax * scx;
		const dy = -spec.ay * scy;
		if(tint){
			ctx.drawImage(recolorPart(sheet, spec, tint), dx, dy, spec.dw, spec.dh);
		}else{
			ctx.drawImage(sheet, spec.sx, spec.sy, spec.sw, spec.sh, dx, dy, spec.dw, spec.dh);
		}
	}

	MeleeMode.paintRigArt = function(ctx, px, py, who, pose){
		const f = who.facing||1;
		const squash = 1 + (this.landSquash||0)*0.14;
		const stretch = 1 - (this.landSquash||0)*0.1;
		const vis = rigScale();
		const feetX = px + who.w/2;
		const feetY = py + who.h;
		const style = (this.weapon() && this.weapon().style) || 'sword';
		const tint = clothHex();
		const shoulderY = -46;
		const headY = shoulderY + 1;
		const bootM = partSpan('body','boot');
		const legM = partSpan('body','leg');
		const hipY = -(legM.below * 0.82 + bootM.below);
		const torsoSX = 1;
		const torsoSY = 1;
		let poseUse = pose;
		this._armExt = 0;
		this._weaponRoll = 0;
		if(this.active){
			const swing = this.weaponSwing();
			this._armExt = swing.ext || 0;
			this._weaponRoll = swing.roll || 0;
			poseUse = Object.assign({}, pose, { armF: swing.arm, armB: swing.armB, sword: 0 });
		}
		ctx.save();
		ctx.translate(feetX, feetY);
		ctx.scale(f*squash*vis, stretch*vis);
		ctx.translate(poseUse.shift||0, poseUse.crouch||0);
		if(who.flash>0) ctx.globalAlpha = 0.92;

		this.drawArtLeg(ctx, -6, hipY, poseUse.legB||0, tint);
		this.drawArtLeg(ctx, 6, hipY, poseUse.legF||0, tint);

		ctx.save();
		ctx.translate(0, shoulderY);
		ctx.rotate(poseUse.lean||0);

		if(style!=='staff' && style!=='gauntlets' && !this.atk){
			ctx.save();
			ctx.translate(-7, 2);
			ctx.rotate(0.55);
			ctx.scale(0.38, 0.38);
			drawPart(ctx, 'weapons', 'staff', null);
			ctx.restore();
		}
		this.drawArtArm(ctx, -10, 7, poseUse.armB||0, style, true, tint, 0);

		ctx.save();
		ctx.scale(torsoSX, torsoSY);
		drawPart(ctx, 'body', 'torso', tint && CLOTH.torso ? tint : null);
		ctx.restore();
		const skirtM = partSpan('body','skirt');
		const skirtScaleX = 1.22;
		const skirtScaleY = 1.02;
		const hem = -(bootM.below * 0.55);
		const skirtTop = hem - skirtM.below * skirtScaleY;
		ctx.save();
		ctx.translate(0, skirtTop - shoulderY);
		ctx.scale(skirtScaleX, skirtScaleY);
		drawPart(ctx, 'body', 'skirt', tint);
		ctx.restore();

		ctx.save();
		ctx.translate(0, headY - shoulderY);
		ctx.rotate(poseUse.head||0);
		ctx.scale(1.02, 1.02);
		drawPart(ctx, 'body', 'head', null);
		ctx.rotate(poseUse.hat||0);
		ctx.translate(0, -14);
		drawPart(ctx, 'body', 'hat', tint);
		ctx.restore();

		this.drawArtArm(ctx, 10, 7, poseUse.armF||0, style, false, tint, poseUse.sword||0);
		ctx.restore();
		if(this.state==='run'){
			ctx.save();
			ctx.beginPath();
			ctx.rect(-30, hipY-2, 60, 11);
			ctx.clip();
			this.drawArtLeg(ctx, -6, hipY, poseUse.legB||0, tint);
			this.drawArtLeg(ctx, 6, hipY, poseUse.legF||0, tint);
			ctx.restore();
		}
		ctx.restore();

		const armAng = (poseUse.armF||0)+(poseUse.sword||0);
		const spec = Parts.meta.weapons[style] || Parts.meta.weapons.sword;
		const dist = style==='whip' || style==='chain' ? 40 : ((spec && spec.dh) ? spec.dh*0.72 : 30);
		const lean = poseUse.lean||0;
		const c = Math.cos(lean), s = Math.sin(lean);
		const shx = 7, shy = 0;
		const shoulderX = shx*c - shy*s;
		const shoulderWorld = shoulderY + (shx*s + shy*c);
		const dx = Math.sin(armAng)*dist, dy = Math.cos(armAng)*dist;
		const lx = (poseUse.shift||0) + shoulderX + (dx*c - dy*s);
		const ly = (poseUse.crouch||0) + shoulderWorld + (dx*s + dy*c);
		const hot = this.phase==='active' || this.phase==='startup' || this.phase==='cancel';
		this.rememberTip(feetX + lx*f*squash*vis + camera.x, feetY + ly*stretch*vis + camera.y, hot);
	};

	MeleeMode.drawArtLeg = function(ctx, x, y, rot, tint){
		const leg = partSpan('body','leg');
		ctx.save();
		ctx.translate(x, y);
		ctx.rotate(rot);
		drawPart(ctx, 'body', 'leg', tint);
		ctx.translate(0, Math.max(4, leg.below*0.82));
		drawPart(ctx, 'body', 'boot', null);
		ctx.restore();
	};

	MeleeMode.drawArtArm = function(ctx, x, y, rot, style, back, tint, extra){
		ctx.save();
		ctx.translate(x, y);
		ctx.rotate(rot);
		const armSX = 1.15;
		const armSY = 1;
		ctx.save();
		ctx.scale(armSX, armSY);
		drawPart(ctx, 'body', 'sleeve', tint);
		ctx.restore();
		const sleeve = partSpan('body','sleeve');
		ctx.save();
		ctx.translate(0, Math.max(6, sleeve.below*armSY*0.9));
		ctx.rotate(extra||0);
		ctx.save();
		ctx.scale(1.15, 1.15);
		if(style==='gauntlets') drawPart(ctx, 'weapons', 'gauntlet', null);
		else drawPart(ctx, 'body', 'hand', null);
		ctx.restore();
		if(!back && style!=='gauntlets'){
			ctx.translate(2, this._armExt||0);
			const roll = this._weaponRoll || 0;
			if(roll) ctx.rotate(roll);
			if(style==='spear') ctx.scale(0.55, 2.58);
			else if(style==='staff') ctx.scale(1.15, 1.74);
			else if(style==='hammer') ctx.scale(1.05, 2.04);
			else if(style==='scythe') ctx.scale(1.05, 1.86);
			else if(style==='greatsword') ctx.scale(1.2, 1.3);
			else if(style==='glaive') ctx.scale(1.05, 1.35);
			else if(style==='sword') ctx.scale(1.05, 1.2);
			else if(style==='dagger' || style==='daggers') ctx.scale(0.9, 0.9);
			if(style==='whip') this.drawWhip(ctx);
			else if(style==='chain') this.drawChain(ctx);
			else if(style==='daggers') drawPart(ctx, 'weapons', 'dagger', null);
			else drawPart(ctx, 'weapons', style, null);
		}else if(back && style==='daggers'){
			ctx.scale(0.85, 0.85);
			drawPart(ctx, 'weapons', 'dagger', null);
		}else if(back && style==='gauntlets'){
			/* already drew the gauntlet as the hand */
		}
		ctx.restore();
		ctx.restore();
	};


	/* ---------------- whip: lashes at the cursor, up to a maximum reach ---------------- */
	const WHIP_RANGE = 360, CHAIN_RANGE = 360, WHIP_MIN = 34;
	MeleeMode.whipCursor = function(){
		const mk = (this.frame||0) + ':' + (typeof mouseScreenX==='number' ? mouseScreenX : 0) + ':' + (typeof mouseScreenY==='number' ? mouseScreenY : 0) + ':' + (player.x|0) + ':' + (player.y|0) + ':' + (this.weapon() && this.weapon().style);
		if(this._wcKey === mk && this._wcVal) return this._wcVal;      // asked several times a frame: work it out once
		const px = player.x + player.w/2, py = player.y + player.h*0.42;
		const f = player.facing || 1;
		let mx = (typeof mouseScreenX==='number') ? mouseScreenX + camera.x : px + f*120;
		let my = (typeof mouseScreenY==='number') ? mouseScreenY + camera.y : py;
		let dx = mx - px, dy = my - py;
		let d = Math.hypot(dx, dy);
		if(d < 6){ dx = f; dy = 0; d = 1; }
		const reach = (this.weapon() && this.weapon().style==='chain') ? CHAIN_RANGE : WHIP_RANGE;
		const dd = Math.max(WHIP_MIN, Math.min(reach, d));
		let x = px + dx/d*dd, y = py + dy/d*dd;
		if(typeof projectilePointBlocked==='function'){          // stops at a wall instead of lashing through it
			for(let i=12; i>=0 && projectilePointBlocked(x, y); i--){ x = px + (x-px)*i/12; y = py + (y-py)*i/12; }
		}
		return (this._wcKey = mk, this._wcVal = { x:x, y:y, range:reach });
	};
	/* the point the current whip attack lands on (follows the cursor while winding up, then stays put) */
	MeleeMode.whipPoint = function(){
		const atk = this.atk;
		if(!atk || !this.armed || !atk.cursor) return null;
		if(this.phase==='startup'){
			atk.cursor = this.whipCursor();
			const ox = player.x+player.w/2, oy = player.y+player.h*0.42;
			const L = Math.hypot(atk.cursor.x-ox, atk.cursor.y-oy) || 1;
			atk.aim = { x:(atk.cursor.x-ox)/L, y:(atk.cursor.y-oy)/L };
		}
		return atk.cursor;
	};

	/* ---------------- portals: a swinging weapon goes through any portal its blade or hitbox touches ---------------- */
	MeleeMode.worldPortals = function(){
		const W = (typeof MAGIC_WORLD!=='undefined') ? MAGIC_WORLD : null;
		if(!W || !W.bodies || !W.bodies.length) return [];
		const t = W.time || 0, out = [];
		for(let i=0;i<W.bodies.length;i++){
			const b = W.bodies[i], sp = b && b.alive && b.spatial;
			if(!sp || sp.kind!=='portal' || sp.blocked || sp.masters || sp.home) continue;      // a one-way portal home is not a doorway for a weapon
			const k = Math.max(0, Math.min(1, (sp.end - t)/1.2)) * Math.max(0, Math.min(1, (t - sp.born)/0.25));
			if(k < 0.3) continue;
			const r = (sp.r || 20) * (0.4 + 0.6*k);
			out.push({ a:{x:b.x, y:b.y}, b:{x:sp.x1, y:sp.y1}, rx:r*0.62, ry:r });
		}
		return out;
	};
	function ellipseTouchesBox(e, c, box){
		const nx = Math.max(box.x, Math.min(c.x, box.x+box.w));
		const ny = Math.max(box.y, Math.min(c.y, box.y+box.h));
		const dx = (nx-c.x)/e.rx, dy = (ny-c.y)/e.ry;
		return dx*dx + dy*dy <= 1;
	}
	/* first t in [0,1] where the segment H→T enters the ellipse (0 if it starts inside); null if it never does */
	function segmentEntersEllipse(H, T, e, c){
		const hx = (H.x-c.x)/e.rx, hy = (H.y-c.y)/e.ry, dx = (T.x-H.x)/e.rx, dy = (T.y-H.y)/e.ry;
		const A = dx*dx+dy*dy;
		if(A < 1e-9) return null;
		if(hx*hx+hy*hy <= 1) return 0;
		const B = 2*(hx*dx+hy*dy), C = hx*hx+hy*hy-1, disc = B*B-4*A*C;
		if(disc < 0) return null;
		const t = (-B - Math.sqrt(disc)) / (2*A);
		return (t >= 0 && t <= 1) ? t : null;
	}
	/* where the swinging weapon crosses into a portal: {cx,cy} the cut point on the blade, {ox,oy} how far the far part is carried, {dx,dy} the blade direction */
	MeleeMode.portalCut = function(def){
		if(!this.armed || !this.atk || !this._rigHand) return null;
		if(this.phase!=='startup' && this.phase!=='active' && this.phase!=='cancel') return null;
		const portals = this.worldPortals();
		if(!portals.length) return null;
		if(this.portalStrike && this.portalStrike()) return null;      // a Spatial-reinforced weapon already strikes through its own portal
		def = def || this.atk.def;
		const H = { x:this._rigHand.x + camera.x, y:this._rigHand.y + camera.y };
		const box = this.strikeBox(def, true);
		let T;
		if(this._rigTip) T = { x:this._rigTip.x + camera.x, y:this._rigTip.y + camera.y };
		else T = { x:box.x + box.w/2, y:box.y + box.h/2 };
		const dx = T.x-H.x, dy = T.y-H.y, len = Math.hypot(dx, dy);
		if(len < 4) return null;
		let best = null;
		for(let i=0;i<portals.length;i++){
			const p = portals[i];
			for(let side=0; side<2; side++){
				const E = side ? p.b : p.a, X = side ? p.a : p.b;
				let t = segmentEntersEllipse(H, T, p, E);
				if(t == null){
					if(!ellipseTouchesBox(p, E, box)) continue;
					t = ((E.x-H.x)*dx + (E.y-H.y)*dy) / (len*len);      // the hitbox reaches it even though the blade line misses: cut where the portal is
				}
				t = Math.max(0.12, Math.min(0.98, t));
				if(!best || t < best.t) best = { t:t, cx:H.x + dx*t, cy:H.y + dy*t, ox:X.x-E.x, oy:X.y-E.y, dx:dx/len, dy:dy/len };
			}
		}
		return best;
	};
	/* the hit area, split where the weapon is passing through a portal: the near piece stays, the far piece comes out of the exit */
	MeleeMode.strikeBoxes = function(def){
		const base = this.strikeBox(def);
		const list = [base];
		if(this.phase==='active' && this.whipPoint()){      // the cord itself hits what it passes through
			const hx = player.x+player.w/2, hy = player.y+player.h*0.42, c = this.atk.cursor;
			const L = Math.hypot(c.x-hx, c.y-hy), n = Math.floor(L/34);
			for(let i=1;i<n;i++){ const u = i/n; list.push({ x:hx+(c.x-hx)*u-14, y:hy+(c.y-hy)*u-14, w:28, h:28 }); }
		}
		if(this.phase!=='active') return list;
		const cut = this.portalCut(def);
		if(!cut) return list;
		const res = [];
		for(const bx of list) this.splitBox(bx, cut, res);
		return res.length ? res : list;
	};
	MeleeMode.splitBox = function(base, cut, res){
		const poly = [{x:base.x,y:base.y},{x:base.x+base.w,y:base.y},{x:base.x+base.w,y:base.y+base.h},{x:base.x,y:base.y+base.h}];
		const side = (p) => (p.x-cut.cx)*cut.dx + (p.y-cut.cy)*cut.dy;
		const clip = (keepFar) => {
			const out = [];
			for(let i=0;i<poly.length;i++){
				const a = poly[i], b = poly[(i+1)%poly.length];
				const sa = side(a)*(keepFar?1:-1), sb = side(b)*(keepFar?1:-1);
				if(sa >= 0) out.push(a);
				if((sa >= 0) !== (sb >= 0)){ const u = sa/(sa-sb); out.push({ x:a.x+(b.x-a.x)*u, y:a.y+(b.y-a.y)*u }); }
			}
			if(out.length < 3) return null;
			let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
			for(const p of out){ x0=Math.min(x0,p.x); y0=Math.min(y0,p.y); x1=Math.max(x1,p.x); y1=Math.max(y1,p.y); }
			return (x1-x0 > 1 && y1-y0 > 1) ? { x:x0, y:y0, w:x1-x0, h:y1-y0 } : null;
		};
		const near = clip(false), far = clip(true);
		if(near) res.push(near);
		if(far) res.push({ x:far.x+cut.ox, y:far.y+cut.oy, w:far.w, h:far.h });
	};


	/* ---------------- Gauntlets R: seize an enemy, lift it, stun it, slam it into the ground ---------------- */
	const GRAB = { lift:14, hold:7, slamDmg:84, shockDmg:40, shockR:150, stun:90 };
	MeleeMode.beginGrab = function(en, reaction){
		const atk = this.atk; if(!atk || atk.grab) return;
		const big = this.poiseOf(en) >= 12;      // a boss cannot be lifted: it just eats the full slam where it stands
		if(big){
			this.slamDamage(en, GRAB.slamDmg*0.8, 'Seize and Slam');
			en.stunTimer = Math.max(en.stunTimer||0, 24);
			this.slamFx(en.x+en.w/2, en.y+en.h, 90);
			atk.t = atk.def.startup + atk.def.active;
			return;
		}
		en._kbTimer = 0; en._kbVx = 0; en._kbVy = 0; en.vx = 0; en.vy = 0;
		en.stunTimer = Math.max(en.stunTimer||0, 12);
		atk.grab = { en:en, t:0, phase:'lift', sx:en.x, sy:en.y, wasFlying: en.flying };
		atk.confirmed = true;
		if(typeof dmgNumbers!=='undefined') dmgNumbers.push({x:en.x+en.w/2,y:en.y-18,text:'SEIZED',age:0,color:'#ffd27a'});
	};
	MeleeMode.releaseGrab = function(atk){
		const g = atk && atk.grab; if(!g) return;
		atk.grab = null;
		const en = g.en; if(en){ en._meleeHeld = false; if(g.phase!=='done') en.stunTimer = Math.max(en.stunTimer||0, 20); }
	};
	MeleeMode.slamDamage = function(en, amount, name){
		const aim = (this.atk && this.atk.aim) || { x:player.facing||1, y:0 };
		const ev = { source:player, target:en, amount:amount, direction:player.facing||1, knockback:{x:0,y:0,duration:8}, attackType:'heavy', attackId:this.atk?this.atk.id:0,
			weaponId:this.weapon().id, poiseDamage:6, tags:['physical','melee'], name:name||'Slam', pull:null, pullPower:0, interrupt:false, bounce:false };
		for(let i=0;i<this.damageListeners.length;i++){ try{ this.damageListeners[i](ev); }catch(err){ console.error(err); } }
		this.deal(en, Math.max(0, ev.amount), ev);
		en.flash = Math.max(en.flash||0, 10);
		if(typeof dmgNumbers!=='undefined') dmgNumbers.push({x:en.x+en.w/2,y:en.y-10,text:String(Math.round(ev.amount)),age:0,color:'#ffcc66'});
	};
	MeleeMode.slamFx = function(x, y, size){
		if(typeof shakeScreen==='function') shakeScreen(Math.min(18, 8+size/14), 22);
		if(typeof particles!=='undefined'){
			for(let i=0;i<26;i++){
				const a = Math.PI + Math.random()*Math.PI, sp = 2+Math.random()*7;
				particles.push({ x:x+(Math.random()-0.5)*size, y:y-2, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp*0.8, life:26+Math.random()*18, maxLife:44, r:2+Math.random()*4, color:{ r:200, g:180, b:140 } });
			}
		}
		this._slamRing = { x:x, y:y, t:0, r:GRAB.shockR };
	};
	MeleeMode.tickGrab = function(){
		const atk = this.atk, g = atk && atk.grab; if(!g) return;
		const en = g.en, f = player.facing||1;
		if(!en || en.dead){ atk.grab = null; atk.t = atk.def.startup + atk.def.active; return; }
		g.t++;
		en._meleeHeld = true; en._kbTimer = 0; en.vx = 0; en.vy = 0;
		en.stunTimer = Math.max(en.stunTimer||0, 8);
		const cx = player.x + player.w/2;
		const feetY = player.y + player.h;
		const overhead = player.y - en.h - 10;
		if(g.phase==='lift'){
			const u = Math.min(1, g.t/GRAB.lift), e = 1-(1-u)*(1-u);
			const tx = cx + f*10 - en.w/2, ty = (g.sy)*(1-e) + overhead*e;
			en.x += (tx-en.x)*0.5; en.y += (ty-en.y)*0.5;
			if(g.t===1 && typeof dmgNumbers!=='undefined') dmgNumbers.push({x:en.x+en.w/2,y:en.y-30,text:'STUNNED',age:0,color:'#aef'});
			if(g.t>=GRAB.lift){ g.phase='hold'; g.t=0; }
		}else if(g.phase==='hold'){
			en.x += ((cx + f*6 - en.w/2) - en.x)*0.5; en.y += (overhead + Math.sin(g.t*1.6)*2 - en.y)*0.5;
			if(g.t>=GRAB.hold){ g.phase='slam'; g.t=0; g.vy=10; }
		}else if(g.phase==='slam'){
			g.vy = Math.min(46, g.vy + 7);
			const tx = cx + f*(player.w*0.5 + en.w*0.5 + 10) - en.w/2;
			en.x += (tx-en.x)*0.45;
			en.y += g.vy;
			if(en.y + en.h >= feetY || g.t>40){
				en.y = feetY - en.h;
				this.slamDamage(en, GRAB.slamDmg, 'Seize and Slam');
				en.stunTimer = Math.max(en.stunTimer||0, GRAB.stun);
				en._meleeKind = 'knockdown'; en._meleeTilt = f*0.4;
				const ex = en.x+en.w/2;
				const list = this.targets();
				for(let i=0;i<list.length;i++){
					const o = list[i]; if(!o || o.dead || o===en) continue;
					if(Math.hypot(o.x+o.w/2-ex, o.y+o.h-feetY) < GRAB.shockR){
						this.slamDamage(o, GRAB.shockDmg, 'Slam shock');
						if(this.poiseOf(o)<12){ o.stunTimer = Math.max(o.stunTimer||0, 40); o._kbVx = Math.sign(o.x+o.w/2-ex||1)*7; o._kbVy = -5; o._kbTimer = 14; }
					}
				}
				this.slamFx(ex, feetY, en.w);
				this.hitstop = Math.max(this.hitstop, 7);
				emit('cameraImpulse', { strength:10, kind:'heavy' });
				g.phase = 'done'; atk.grab = null; en._meleeHeld = false;
				atk.t = atk.def.startup + atk.def.active;      // into recovery
			}
		}
	};

	MeleeMode.flexExtend = function(){
		const ck = (this.frame||0) + ':' + (this.atk ? this.atk.id + ':' + this.atk.t : '-') + ':' + this.phase + ':' + (this._wcKey||'');
		if(this._feKey === ck && this._feVal) return this._feVal;      // drawn + tip tracking ask in the same frame
		const r = MeleeMode._flexExtend.call(this);
		this._feKey = ck; this._feVal = r;
		return r;
	};
	MeleeMode._flexExtend = function(){
		const def = this.atk && this.atk.def;
		let ext = 0.34;
		if(def && this.phase==='active') ext = 1;
		else if(def && this.phase==='startup'){
			const u = this.atk.t/Math.max(1, def.startup);
			ext = 0.28 + 0.72*Math.min(1, u);
		}else if(def && (this.phase==='cancel' || this.phase==='recovery')){
			ext = 0.72;
		}
		const raw = this.flexTips();
		const tips = raw.map(function(p){ return { x:p.x*ext, y:Math.max(16, p.y*ext) }; });
		return { tips:tips, ext:ext, sweeping: !!(def && def.sweep) };
	};

	/* the cord's shape: a wave that runs out along it as it is thrown, then dies down */
	MeleeMode.cordPoints = function(tip, n, wave){
		const pts = [];
		const len = Math.hypot(tip.x, 8 - tip.y) || 1;
		const nx = -(tip.y-8)/len, ny = (tip.x)/len;
		const t = (this.frame||0);
		for(let i=0;i<=n;i++){
			const u = i/n;
			const env = Math.sin(u*Math.PI) * wave;
			const off = env * Math.sin(u*7 - t*0.55) ;
			pts.push({ x: tip.x*u + nx*off, y: 8 + (tip.y-8)*u + ny*off });
		}
		return pts;
	};
	MeleeMode.drawWhip = function(ctx){
		drawPart(ctx, 'weapons', 'whip', null);
		const flex = this.flexExtend();
		const tips = flex.tips;
		const atk = this.atk, hot = this.phase==='active';
		const age = atk ? Math.max(0, atk.t - atk.def.startup) : 99;
		const wave = hot ? Math.max(1.5, 14 - age*2.4) : (this.phase==='startup' ? 20*(1-flex.ext+0.15) : (this.phase==='recovery' || this.phase==='cancel' ? 9 : 5));
		ctx.save();
		ctx.lineCap = 'round'; ctx.lineJoin = 'round';
		for(let i=0;i<tips.length;i++){
			const tip = tips[i];
			const n = Math.max(10, Math.min(26, Math.round(Math.hypot(tip.x, tip.y)/12)));
			const pts = this.cordPoints(tip, n, wave);
			if(hot){          // glow while it flies
				ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,214,140,0.32)'; ctx.lineWidth = 9;
				ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for(let k=1;k<pts.length;k++) ctx.lineTo(pts[k].x, pts[k].y); ctx.stroke(); ctx.restore();
			}
			for(let band=0; band<3; band++){          // tapered braid in three width bands (a few strokes instead of one per segment)
				const k0 = Math.floor(band*(pts.length-1)/3)+1, k1 = Math.floor((band+1)*(pts.length-1)/3);
				if(k1 < k0) continue;
				const u = (k0+k1)*0.5/pts.length;
				ctx.strokeStyle = band===1 ? '#a8692e' : '#7a4a20';
				ctx.lineWidth = 5.2 - 3.4*u;
				ctx.beginPath(); ctx.moveTo(pts[k0-1].x, pts[k0-1].y); for(let k=k0;k<=k1;k++) ctx.lineTo(pts[k].x, pts[k].y); ctx.stroke();
			}
			ctx.strokeStyle = 'rgba(255,236,190,0.75)'; ctx.lineWidth = 1.1;
			ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y-1); for(let k=1;k<pts.length;k++) ctx.lineTo(pts[k].x, pts[k].y-0.8); ctx.stroke();
			const e = pts[pts.length-1];
			ctx.fillStyle = '#3a2210'; ctx.beginPath(); ctx.arc(e.x, e.y, 3.2, 0, Math.PI*2); ctx.fill();          // the popper knot
			if(hot && age < 7){          // the crack: a flash, a ring and spokes where it lands
				const u = age/7, r = 10 + u*34;
				ctx.save(); ctx.globalCompositeOperation = 'lighter';
				ctx.globalAlpha = 1-u; ctx.strokeStyle = '#fff6d0'; ctx.lineWidth = 3*(1-u)+0.8;
				ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, Math.PI*2); ctx.stroke();
				for(let a=0;a<8;a++){ const ang = a*Math.PI/4 + 0.3; ctx.beginPath(); ctx.moveTo(e.x+Math.cos(ang)*r*0.5, e.y+Math.sin(ang)*r*0.5); ctx.lineTo(e.x+Math.cos(ang)*r*1.25, e.y+Math.sin(ang)*r*1.25); ctx.stroke(); }
				const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, 22); g.addColorStop(0, 'rgba(255,248,220,0.9)'); g.addColorStop(1, 'rgba(255,200,100,0)');
				ctx.fillStyle = g; ctx.beginPath(); ctx.arc(e.x, e.y, 22, 0, Math.PI*2); ctx.fill();
				ctx.restore();
			}
		}
		ctx.restore();
	};

	MeleeMode.drawChain = function(ctx){
		const flex = this.flexExtend();
		const tips = flex.sweeping ? [flex.tips[0], flex.tips[(flex.tips.length/2)|0], flex.tips[flex.tips.length-1]] : flex.tips;
		const atk = this.atk, hot = this.phase==='active';
		const age = atk ? Math.max(0, atk.t - atk.def.startup) : 99;
		const t = (this.frame||0);
		// heavy: the chain hangs and swings a lot while winding up, snaps taut as it lands, then slumps
		const sag = hot ? Math.max(2, 16 - age*2.2) : (this.phase==='startup' ? 22*(1-flex.ext+0.25) : 12 + Math.sin(t*0.4)*3);
		ctx.save();
		ctx.lineCap = 'round'; ctx.lineJoin = 'round';
		for(let f=0; f<tips.length; f++){
			const tip = tips[f];
			const len = Math.max(18, Math.hypot(tip.x, tip.y));
			const n = Math.max(8, Math.min(28, Math.round(len/13)));
			const pts = [];
			for(let i=0;i<=n;i++){
				const u = i/n;
				pts.push({ x: tip.x*u + Math.sin(u*Math.PI)*sag*(tip.y>0?1:-1)*0.6 + Math.sin(u*5 - t*0.4)*(hot?0.5:2.2)*Math.sin(u*Math.PI), y: 6 + (tip.y-6)*u + Math.sin(u*Math.PI)*sag*0.55 });
			}
			if(hot){
				ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(200,225,255,0.28)'; ctx.lineWidth = 11;
				ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for(let k=1;k<pts.length;k++) ctx.lineTo(pts[k].x, pts[k].y); ctx.stroke(); ctx.restore();
			}
			for(let pass=0; pass<2; pass++){          // alternating links: the flat ones, then the ones seen on edge — two fills, not one per link
				const flat = pass===0;
				ctx.fillStyle = flat ? '#cfd8e4' : '#8d99a8'; ctx.strokeStyle = '#47515f'; ctx.lineWidth = 1.2;
				ctx.beginPath();
				for(let k=1;k<pts.length;k++){
					if((k%2===0) !== flat) continue;
					const a = pts[k-1], b = pts[k], mx = (a.x+b.x)/2, my = (a.y+b.y)/2, ang = Math.atan2(b.y-a.y, b.x-a.x);
					ctx.moveTo(mx + Math.cos(ang)*8.6, my + Math.sin(ang)*8.6);
					ctx.ellipse(mx, my, 8.6, flat ? 4.8 : 2.2, ang, 0, Math.PI*2);
				}
				ctx.fill(); ctx.stroke();
			}
			ctx.fillStyle = '#4a5463'; ctx.beginPath();          // the dark hole of each flat link
			for(let k=2;k<pts.length;k+=2){
				const a = pts[k-1], b = pts[k], mx = (a.x+b.x)/2, my = (a.y+b.y)/2, ang = Math.atan2(b.y-a.y, b.x-a.x);
				ctx.moveTo(mx + Math.cos(ang)*4.3, my + Math.sin(ang)*4.3);
				ctx.ellipse(mx, my, 4.3, 2.16, ang, 0, Math.PI*2);
			}
			ctx.fill();
			const e = pts[pts.length-1], p0 = pts[pts.length-2], ang = Math.atan2(e.y-p0.y, e.x-p0.x);
			ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(ang);          // the blade head: a barbed spike
			const grd = ctx.createLinearGradient(0, -7, 0, 7); grd.addColorStop(0, '#f5f9ff'); grd.addColorStop(0.5, '#b9c6d6'); grd.addColorStop(1, '#6f7c8d');
			ctx.fillStyle = grd; ctx.strokeStyle = '#2f3846'; ctx.lineWidth = 1.4;
			ctx.beginPath(); ctx.moveTo(30, 0); ctx.lineTo(8, -8); ctx.lineTo(-4, -4); ctx.lineTo(-4, 4); ctx.lineTo(8, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
			ctx.beginPath(); ctx.moveTo(-2, -4); ctx.lineTo(-10, -12); ctx.lineTo(4, -6); ctx.moveTo(-2, 4); ctx.lineTo(-10, 12); ctx.lineTo(4, 6); ctx.stroke();
			ctx.restore();
			if(hot && age < 9){          // a heavy impact: a shock ring and dust at the head
				const u = age/9;
				ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1-u; ctx.strokeStyle = '#e6f2ff'; ctx.lineWidth = 4*(1-u)+1;
				ctx.beginPath(); ctx.arc(e.x, e.y, 14+u*44, 0, Math.PI*2); ctx.stroke();
				ctx.beginPath(); ctx.arc(e.x, e.y, 8+u*24, 0, Math.PI*2); ctx.stroke();
				ctx.restore();
			}
		}
		ctx.restore();
	};

	MeleeMode.paintSpecialFx = function(ctx){
		if(!this.active || typeof player==='undefined' || typeof camera==='undefined') return;
		if(this.atk && this.atk.def.noHit) return;      // a magical item's throw / beam draws its own effects
		const px = player.x - camera.x + player.w/2;
		const py = player.y - camera.y + player.h*0.42;
		const aim = (this.atk && this.atk.aim) ? this.atk.aim : (this.charge>0 ? this.sampleAim() : {x: player.facing||1, y:0});
		const col = (this.weapon() && this.weapon().fxColor) || '#e7eef8';
		const atk = this.atk;
		const motion = atk && atk.def.motion;
		const fx = atk ? (atk.def.fx||'arc') : '';
		ctx.save();
		ctx.translate(px, py);
		if(atk && this.portalStrike){
			const portal = this.portalStrike();
			if(portal && portal.active){ const s = this.portalShift(this.strikeBox(atk.def, true), portal); ctx.translate(s.x, s.y); }
		}
		ctx.lineCap = 'round';
		ctx.strokeStyle = col;
		ctx.fillStyle = col;
		function line(x0,y0,x1,y1,w,a){
			ctx.globalAlpha = a;
			ctx.lineWidth = w;
			ctx.beginPath();
			ctx.moveTo(x0,y0);
			ctx.lineTo(x1,y1);
			ctx.stroke();
		}
		if(this.charge>0){
			const u = Math.min(1, this.charge/22);
			ctx.globalAlpha = 0.45+u*0.5;
			ctx.lineWidth = 6+u*14;
			ctx.beginPath();
			ctx.arc(aim.x*20, aim.y*20, 18+u*56, Math.atan2(aim.y, aim.x)-1.5, Math.atan2(aim.y, aim.x)+1.5);
			ctx.stroke();
			ctx.globalAlpha = 0.25+u*0.4;
			ctx.beginPath();
			ctx.arc(0, 18, 16+u*28, 0, Math.PI*2);
			ctx.stroke();
		}
		const styleNow = (this.weapon() && this.weapon().style) || '';
		const flexWeapon = styleNow==='whip' || styleNow==='chain';
		if(atk && flexWeapon && (this.phase==='active' || this.phase==='startup' || this.phase==='cancel')){
			const rect = this.attackRect(atk.def);
			const lx = rect.x - camera.x - px;
			const ly = rect.y - camera.y - py;
			const hot = this.phase==='active';
			ctx.save();
			ctx.fillStyle = styleNow==='chain' ? '#d5deea' : '#f0c27a';
			ctx.strokeStyle = styleNow==='chain' ? '#f7fbff' : '#fff1c4';
			ctx.globalAlpha = hot ? 0.42 : 0.22;
			ctx.fillRect(lx, ly, rect.w, rect.h);
			ctx.globalAlpha = hot ? 0.95 : 0.55;
			ctx.lineWidth = hot ? 4 : 2.5;
			ctx.strokeRect(lx, ly, rect.w, rect.h);
			ctx.beginPath();
			ctx.arc(lx+rect.w/2, ly+rect.h/2, hot ? 10 : 6, 0, Math.PI*2);
			ctx.fill();
			ctx.restore();
		}
		if(atk && (this.phase==='active' || this.phase==='startup')){
			const u = this.phase==='startup'
				? atk.t/Math.max(1, atk.def.startup)
				: (atk.t-atk.def.startup)/Math.max(1, atk.def.active);
			if(motion==='flurry'){
				for(let i=0;i<6;i++){
					const flick = ((i+(atk.pulse||0))%2===0?1:-1);
					const ox = aim.x*(18+i*7) + (-aim.y)*flick*10;
					const oy = aim.y*(18+i*7) + aim.x*flick*10;
					line(ox-aim.x*8, oy-aim.y*8, ox+aim.x*14, oy+aim.y*14, 3, 0.35+ (i=== (atk.t%6) ? 0.6 : 0.15));
				}
			}else if(motion==='spearVault'){
				line(0, 8, aim.x*90, aim.y*28-18, 7, 0.35);
				line(-aim.y*6, 10, aim.x*110, aim.y*20-10, 3, 0.8);
				ctx.globalAlpha = 0.9;
				ctx.beginPath();
				ctx.arc(aim.x*100, aim.y*16-8, 7, 0, Math.PI*2);
				ctx.fill();
			}else if(motion==='staffPlant'){
				if(this.phase==='startup'){
					line(0, 6, 0, 36, 6, 0.85);
					ctx.globalAlpha = 0.9;
					ctx.beginPath();
					ctx.arc(0, 40, 8+u*6, 0, Math.PI*2);
					ctx.fill();
					ctx.globalAlpha = 0.35;
					ctx.beginPath();
					ctx.arc(0, 42, 16+u*18, 0, Math.PI*2);
					ctx.stroke();
				}else{
					line(0, 20, aim.x*16, -70, 5, 0.75);
					ctx.globalAlpha = 0.4;
					ctx.beginPath();
					ctx.arc(aim.x*10, -40, 22, 0, Math.PI*2);
					ctx.stroke();
				}
			}else if(motion==='cleave' || motion==='chargeCleave'){
				const reach = motion==='chargeCleave' ? 78+ (atk.def._charge||0.4)*40 : 64;
				const ang = Math.atan2(aim.y, aim.x);
				const sweep = (u-0.5)*(motion==='chargeCleave'?2.2:1.6);
				ctx.globalAlpha = 0.9;
				ctx.lineWidth = motion==='chargeCleave' ? 14 : 9;
				ctx.beginPath();
				ctx.arc(aim.x*10, aim.y*10, reach, ang-1.1+sweep, ang+1.1+sweep);
				ctx.stroke();
			}else if(motion==='rise'){
				line(aim.x*8, 10, aim.x*10, -78, 8, 0.85);
				ctx.globalAlpha = 0.45;
				ctx.lineWidth = 3;
				ctx.beginPath();
				ctx.moveTo(-10, 8-u*40);
				ctx.lineTo(0, -20-u*50);
				ctx.lineTo(10, 8-u*40);
				ctx.stroke();
			}else if(motion==='slam'){
				const rad = 18+u*70;
				ctx.globalAlpha = 0.8;
				ctx.lineWidth = 8;
				ctx.beginPath();
				ctx.ellipse(aim.x*12, 28, rad, rad*0.32, 0, 0, Math.PI*2);
				ctx.stroke();
				line(0, -40, aim.x*8, 26, 10, 0.7*(1-u*0.4));
			}else if(motion==='spin'){
				ctx.globalAlpha = 0.8;
				ctx.lineWidth = 7;
				ctx.beginPath();
				ctx.arc(0, 6, 46, atk.t*0.55, atk.t*0.55+4.2);
				ctx.stroke();
				ctx.globalAlpha = 0.35;
				ctx.beginPath();
				ctx.arc(aim.x*12, 6, 28, -atk.t*0.4, -atk.t*0.4+2);
				ctx.stroke();
			}else if(motion==='hook'){
				const reach = 70+u*30;
				ctx.globalAlpha = 0.9;
				ctx.lineWidth = 4;
				ctx.beginPath();
				ctx.moveTo(8*aim.x, 8*aim.y);
				ctx.quadraticCurveTo(aim.x*reach*0.6 + (-aim.y)*22, aim.y*reach*0.6 + aim.x*22, aim.x*reach, aim.y*reach);
				ctx.stroke();
				ctx.beginPath();
				ctx.arc(aim.x*reach, aim.y*reach, 8, 0, Math.PI*2);
				ctx.stroke();
			}else if(motion==='whip' && !flexWeapon){
				const reach = 40+u*110;
				ctx.globalAlpha = 0.95;
				ctx.lineWidth = 2.4;
				ctx.beginPath();
				ctx.moveTo(6*aim.x, 6*aim.y);
				ctx.quadraticCurveTo(aim.x*reach*0.5+(-aim.y)*14, aim.y*reach*0.45+10, aim.x*reach, aim.y*reach);
				ctx.stroke();
				line(aim.x*reach, aim.y*reach, aim.x*reach+(-aim.y)*10, aim.y*reach+aim.x*8, 2, 1);
			}else if(motion==='grapple' && !flexWeapon){
				const reach = 30+u*80;
				ctx.globalAlpha = 0.95;
				for(let i=1;i<=7;i++){
					const t = i/7;
					ctx.beginPath();
					ctx.arc(aim.x*reach*t, aim.y*reach*t, 4, 0, Math.PI*2);
					ctx.stroke();
				}
			}else if(fx==='thrust'){
				line(aim.x*16, aim.y*16, aim.x*(30+70*Math.min(1,u+0.2)), aim.y*(30+70*Math.min(1,u+0.2)), 4, 0.85);
			}else if(fx==='upper'){
				line(aim.x*8, 8, aim.x*12 + (-aim.y)*6, aim.y*20-50, 6, 0.8);
			}else if(fx==='punch'){
				const x = aim.x*(22+u*20), y = aim.y*(22+u*20);
				line(x-8, y, x+8, y, 4, 0.9);
				line(x, y-8, x, y+8, 4, 0.9);
			}else if(this.phase==='active' && !flexWeapon){
				const ang = Math.atan2(aim.y, aim.x);
				ctx.globalAlpha = 0.75;
				ctx.lineWidth = 4;
				ctx.beginPath();
				ctx.arc(aim.x*16, aim.y*16, 28+u*10, ang-1.1, ang+0.4);
				ctx.stroke();
			}
		}
		ctx.restore();
	};

	function widenBasicAttacks(weapons){
		const keys = ['g1','g2','g3','nair','nair2','launcher','up','heavy','down'];
		const ids = Object.keys(weapons);
		for(let i=0;i<ids.length;i++){
			const moves = weapons[ids[i]].moves;
			if(!moves) continue;
			for(let k=0;k<keys.length;k++){
				const d = moves[keys[k]];
				if(!d || !d.hitbox || d.hitbox._wide) continue;
				d.hitbox.ox *= 1.3;
				d.hitbox.oy *= 1.3;
				d.hitbox.w *= 1.3;
				d.hitbox.h *= 1.3;
				d.hitbox._wide = true;
			}
		}
	}

	function scaleReach(weapons, id, mult){
		const moves = weapons[id] && weapons[id].moves;
		if(!moves) return;
		const keys = Object.keys(moves);
		for(let i=0;i<keys.length;i++){
			const hb = moves[keys[i]] && moves[keys[i]].hitbox;
			if(!hb) continue;
			hb.ox *= mult;
			hb.oy *= mult;
			hb.w *= mult;
		}
	}
	function shapeLongFlex(weapons){
		const ids = ['whip','chain'];
		for(let n=0;n<ids.length;n++){
			const moves = weapons[ids[n]] && weapons[ids[n]].moves;
			if(!moves) continue;
			const keys = Object.keys(moves);
			for(let i=0;i<keys.length;i++){
				const d = moves[keys[i]];
				if(!d || !d.hitbox) continue;
				if(keys[i]==='special'){
					d.sweep = true;
					d.hitbox.ox = 340;
					d.hitbox.oy = 0;
					d.hitbox.w = 280;
					d.hitbox.h = 190;
				}else{
					d.pin = true;
					const sign = d.hitbox.ox < 0 ? -1 : 1;
					d.hitbox.ox = sign * 460;
					d.hitbox.oy = Math.max(-16, Math.min(16, d.hitbox.oy));
					d.hitbox.w = 86;
					d.hitbox.h = 52;
				}
			}
		}
	}

	if(window.MELEE_WEAPONS && window.MELEE_WEAPONS.weapons && window.MELEE_WEAPONS.weapons.sword){
		MeleeMode.weapons = window.MELEE_WEAPONS.weapons;
		MeleeMode.weaponOrder = window.MELEE_WEAPONS.order.slice();
		MeleeMode.weaponId = 'sword';
		widenBasicAttacks(MeleeMode.weapons);
		scaleReach(MeleeMode.weapons, 'spear', 2);
		scaleReach(MeleeMode.weapons, 'hammer', 2);
		scaleReach(MeleeMode.weapons, 'staff', 1.5);
		scaleReach(MeleeMode.weapons, 'scythe', 1.5);
		shapeLongFlex(MeleeMode.weapons);
		growAllAttacks(MeleeMode.weapons, 1.2);
	}

	function growAllAttacks(weapons, mult){
		const ids = Object.keys(weapons);
		for(let i=0;i<ids.length;i++){
			const moves = weapons[ids[i]] && weapons[ids[i]].moves;
			if(!moves) continue;
			const keys = Object.keys(moves);
			for(let k=0;k<keys.length;k++){
				const hb = moves[keys[k]] && moves[keys[k]].hitbox;
				if(!hb || hb._grown) continue;
				hb.ox *= mult;
				hb.oy *= mult;
				hb.w *= mult;
				hb.h *= mult;
				hb._grown = true;
			}
		}
	}

	selfTest();
	bootFX();
	loadParts();
	window.MeleeMode = MeleeMode;
	// one combined mode from the start
	MeleeMode.active = true;
	try {
		MeleeMode.setMeleeStature(true);
		if(typeof playerData !== 'undefined' && playerData && playerData.spells && typeof activeSlot !== 'undefined') MeleeMode.setSlot(playerData.spells[activeSlot]);
	} catch(e){}

	addEventListener('mousedown', function(e){
		if(e.button===0) MeleeMode._lmb = true;
		if(e.button===2 && MeleeMode.active){
			MeleeMode._parryEdge = true;
			e.preventDefault();
		}
	}, true);
	addEventListener('mouseup', function(e){
		if(e.button===0) MeleeMode._lmb = false;
	}, true);
	addEventListener('contextmenu', function(e){
		if(MeleeMode.active) e.preventDefault();
	}, true);
	addEventListener('blur', function(){ MeleeMode._lmb = false; });

	if(typeof render==='function'){
		const prevRender = render;
		render = function(){
			prevRender();
			MeleeMode.postRender(ctx);
		};
	}
})();
