/* =============================================================
   BOSS VERSIONS OF BASIC ENEMIES  (window.EliteVariants)
   -------------------------------------------------------------
   Any basic enemy can be promoted to a boss version in three tiers:

     ★    Alpha   bigger, tougher, faster; larger, quicker, harder-hitting attacks; split shots
     ★★   Elder   + Echo (repeats each attack a moment later) and a shockwave Nova
     ★★★  Tyrant  + Enrage under half health (faster again, Nova twice as often, a ring of shards)

   Survival promotes some spawns, gradually more and stronger as the waves climb.

   How it reaches every enemy kit without editing them: while a boss version acts, `window.__eliteEn`
   points at it. The shared kit helpers (atkS / lAtkS / wAtkS / rosterAtkS for attack size, the
   kit *Spawn helpers, spawnEnemyProj and damagePlayer) read that scope, so its attacks come out
   larger, faster and harder. Kit effects that act later (clouds, rings, mines) call the kit *Hit and
   *Spawn helpers with their enemy, and those wrappers re-enter the scope for that call.
   ============================================================= */
(function(root){
	'use strict';
	if(typeof window === 'undefined') return;

	const TIERS = {
		1: { tier: 1, title: 'Alpha',  stars: '★',   size: 1.32, hp: 4.0,  move: 1.18, gcd: 0.72, cd: 0.8,  atk: 1.28, dmg: 1.25, spd: 1.12, split: true,  echo: false, nova: false, enrage: false, color: '#ffd36b', glow: '#ffcf5a' },
		2: { tier: 2, title: 'Elder',  stars: '★★',  size: 1.5,  hp: 7.0,  move: 1.26, gcd: 0.62, cd: 0.7,  atk: 1.42, dmg: 1.45, spd: 1.2,  split: true,  echo: true,  nova: true,  enrage: false, color: '#ffa04a', glow: '#ff9a3c' },
		3: { tier: 3, title: 'Tyrant', stars: '★★★', size: 1.68, hp: 11.0, move: 1.34, gcd: 0.52, cd: 0.6,  atk: 1.56, dmg: 1.7,  spd: 1.28, split: true,  echo: true,  nova: true,  enrage: true,  color: '#ff5470', glow: '#ff3d5e' },
	};
	const NOVA_R = 230, NOVA_SPEED = 7.5, NOVA_CHARGE = 46;

	const kitBusy = (en) => !!(en.fireKit || en.iceKit || en.earthKit || en.forgeKit || en.wildesKit || en.lateKit || en.rosterKit);
	const scopeE = () => { const en = root.__eliteEn; return (en && en._elite && !en.dead) ? en._elite : null; };
	const rnd = Math.random;

	function elementOf(en){
		const t = en.typeDef || {};
		try { if(root.EFX && EFX.elFromColor) return EFX.elFromColor(t.color2 || t.color || '#ff8844') || 'fire'; } catch(e){}
		return 'fire';
	}
	function pal(el){ try { return EFX.pal(el); } catch(e){ return { core: '#ffffff', mid: '#ffcc66', outer: '#ff6622', dark: '#331100' }; } }

	/* ------------------------------------------------------------------ promotion */
	function apply(en, tier, opts){
		opts = opts || {};
		if(en && root.MiniBossKit && MiniBossKit.owns(en)) return MiniBossKit.applyTier(en, tier, opts);      // mini-bosses have their own tiers (miniboss-kit.js)
		if(!en || en._elite || !TIERS[tier]) return en;
		const T = TIERS[tier];
		if(!opts.visualOnly){
			const cx = en.x + en.w / 2, feet = en.y + en.h, mid = en.y + en.h / 2;
			const flies = !!(en.typeDef && en.typeDef.flies);
			en.w = Math.round(en.w * T.size); en.h = Math.round(en.h * T.size);
			en.x = cx - en.w / 2;
			en.y = flies ? mid - en.h / 2 : feet - en.h;
			en.baseY = en.y - (en.flyOffset || 0);
			en.hp = en.maxHp = Math.round(en.maxHp * T.hp);
			en._stunResist = Math.max(en._stunResist || 0, 2 + tier);
		}
		en._elite = Object.assign({}, T, {
			el: elementOf(en), splitBudget: 2, splitT: 0, pendingSplit: [], echo: null,
			novaT: 200 + (rnd() * 140 | 0), novaCharge: 0, waves: [], enraged: false, intro: 70, age: 0, shardsDone: false,
		});
		en._eliteName = T.title + ' ' + ((en.typeDef && en.typeDef.name) || en.type);
		return en;
	}

	/* survival: how likely a spawn is promoted, and how far */
	const RUN = { seenTier: 0, aliveCap: 1 };
	function eliteChance(w){ return w < 5 ? 0 : Math.min(0.24, 0.05 + (w - 5) * 0.004); }
	function rollTier(w){
		const t3 = w >= 30 ? Math.min(0.45, 0.12 + (w - 30) * 0.006) : 0;
		const t2 = w >= 15 ? Math.min(0.6, 0.2 + (w - 15) * 0.008) : 0;
		const r = rnd();
		if(r < t3) return 3;
		if(r < t3 + t2 * (1 - t3)) return 2;
		return 1;
	}
	function aliveElites(){ let n = 0; if(typeof enemies !== 'undefined') for(const e of enemies) if(e && e._elite && !e.dead) n++; return n; }
	function maybePromote(en, w){
		if(!en || en._elite || (en.typeDef && (en.typeDef.isBoss || en.typeDef.isMiniBoss)) || en.isMiniBoss) return en;
		if(w < 5) return en;
		const cap = Math.min(5, 1 + Math.floor(w / 12));
		if(aliveElites() >= cap) return en;
		// the first boss version of each tier is guaranteed the first time its wave band is reached
		let tier = 0;
		const firstTier = w >= 30 ? 3 : w >= 15 ? 2 : 1;
		if(RUN.seenTier < firstTier) tier = firstTier;
		else if(rnd() < eliteChance(w)) tier = rollTier(w);
		if(!tier) return en;
		const fresh = tier > RUN.seenTier;
		RUN.seenTier = Math.max(RUN.seenTier, tier);
		apply(en, tier);
		if(fresh && root.SurvivalMode && SurvivalMode.banner){
			const T = TIERS[tier];
			SurvivalMode.banner(T.stars + ' ' + en._eliteName.toUpperCase(), tier === 1 ? 'Boss versions of enemies now roam the waves' : tier === 2 ? 'Elders repeat their attacks and unleash a shockwave' : 'Tyrants rage at half health', T.color, 200);
		}
		return en;
	}

	/* ------------------------------------------------------------------ per-frame (inside the enemy loop, in scope) */
	function tick(en){
		const E = en._elite; if(!E || en.dead || E.mb) return;
		E.age++;
		if(E.intro > 0){
			if(E.intro === 70 && root.EFX){
				const x = en.x + en.w / 2, y = en.y + en.h / 2;
				EFX.burst(x, y, E.el, 1.6);
				EFX.ring(x, en.y + en.h, 10, 120, E.el, 30, { flat: 0.3, width: 5 });
				if(typeof dmgNumbers !== 'undefined') dmgNumbers.push({ x, y: en.y - 30, text: E.stars + ' ' + en._eliteName, age: 0, color: E.color });
			}
			E.intro--;
		}
		// split-shot budget refills slowly so a burst attack doesn't triple in size
		if(++E.splitT >= 40){ E.splitT = 0; E.splitBudget = Math.min(2, E.splitBudget + 1); }
		flushSplits(en, E);
		// Echo: the same attack again, a beat later
		if(E.echo){
			if(--E.echo.t <= 0 && !kitBusy(en) && !en.stunTimer){
				const fn = E.echo.fn; E.echo = null;
				try { if(root.EFX) EFX.ring(en.x + en.w / 2, en.y + en.h / 2, 8, 70, E.el, 16, { width: 3 }); en._castTick = _simTick; fn(en); } catch(e){}
			} else if(E.echo && E.echo.t < -90) E.echo = null;
		}
		// Enrage (Tyrant)
		if(E.enrage && !E.enraged && en.hp < en.maxHp * 0.5){
			E.enraged = true;
			E.gcd *= 0.85; E.move *= 1.12;
			E.novaT = Math.min(E.novaT, 30);
			if(root.EFX){ EFX.burst(en.x + en.w / 2, en.y + en.h / 2, E.el, 2.2); EFX.ring(en.x + en.w / 2, en.y + en.h / 2, 20, 200, 'blood', 26, { width: 6 }); }
			if(typeof dmgNumbers !== 'undefined') dmgNumbers.push({ x: en.x + en.w / 2, y: en.y - 40, text: 'ENRAGED', age: 0, color: '#ff4a5e' });
			if(typeof shakeScreen === 'function') shakeScreen(6, 12);
			shardRing(en, E);
		}
		// Nova (Elder, Tyrant): charge, then a jumpable shockwave along the ground
		if(E.nova){
			if(E.novaCharge > 0){
				E.novaCharge--;
				if(E.novaCharge % 6 === 0 && root.EFX) EFX.charge(en.x + en.w / 2, en.y + en.h / 2, E.el, en.w * 0.9, 3, 18);
				if(E.novaCharge === 0) releaseNova(en, E);
			} else if(--E.novaT <= 0 && !kitBusy(en) && playerNear(en, 420)){
				E.novaCharge = NOVA_CHARGE;
				E.novaT = (E.enraged ? 200 : 380) + (rnd() * 120 | 0);
				if(typeof efxTelegraph === 'function') efxTelegraph(en.x + en.w / 2 - NOVA_R, en.y + en.h - 20, NOVA_R * 2, 40, NOVA_CHARGE, pal(E.el).mid, 'rect', '', E.el);
				if(root.EFX) EFX.alertFX(en.x + en.w / 2, en.y - 20, E.el, NOVA_CHARGE);
			}
		}
		for(let i = E.waves.length - 1; i >= 0; i--){
			const W = E.waves[i];
			W.r += NOVA_SPEED;
			if(!W.hit && player && !(player.iFrames > 0)){
				const px = player.x + player.w / 2, feet = player.y + player.h;
				const dx = Math.abs(px - W.x);
				const grounded = feet > W.y - 34;            // jump over it
				if(grounded && Math.abs(dx - W.r) < 20 && Math.abs(feet - W.y) < 90){
					W.hit = true;
					if(typeof damagePlayer === 'function') damagePlayer(Math.round(22 * 1.4 * ((typeof DIFF_DMG_MULT === 'number') ? DIFF_DMG_MULT : 1)), []);
					player.vx = (px >= W.x ? 1 : -1) * 9; player.vy = Math.min(player.vy || 0, -5);
					if(root.EFX) EFX.hit(px, player.y + player.h / 2, E.el, 30);
				}
			}
			if(root.EFX && (E.age & 3) === 0){ for(const sd of [-1, 1]) EFX.debris(E.el, W.x + sd * W.r, W.y - 4, 1, { speed: 4, floor: W.y, scale: 0.7 }); }
			if(W.r > NOVA_R) E.waves.splice(i, 1);
		}
	}
	function playerNear(en, d){ return typeof player !== 'undefined' && Math.hypot((player.x + player.w / 2) - (en.x + en.w / 2), (player.y + player.h / 2) - (en.y + en.h / 2)) < d; }
	function releaseNova(en, E){
		const fy = (typeof fireKitFloorY === 'function') ? fireKitFloorY(en.x + en.w / 2, en.y + en.h - 10) : en.y + en.h;
		const y = Math.min(fy, en.y + en.h + ((en.typeDef && en.typeDef.flies) ? 220 : 4));
		E.waves.push({ x: en.x + en.w / 2, y, r: 10, hit: false });
		if(root.EFX){ EFX.burst(en.x + en.w / 2, y - 10, E.el, 1.4); EFX.debris(E.el, en.x + en.w / 2, y - 4, 8, { speed: 6, floor: y }); }
		if(typeof shakeScreen === 'function') shakeScreen(5, 10);
	}
	// Tyrant's enrage: a ring of element shards
	function shardRing(en, E){
		if(typeof spawnEnemyProj !== 'function') return;
		const P = pal(E.el), x = en.x + en.w / 2, y = en.y + en.h / 2;
		for(let i = 0; i < 10; i++){
			const a = i / 10 * Math.PI * 2;
			const p = spawnEnemyProj(x, y, Math.cos(a) * 6, Math.sin(a) * 6, { color: P.mid, color2: P.core, power: 16, width: 18, height: 18, shape: 'circle', maxAge: 70, _noSplit: true });
			if(p) p._efxEl = E.el;
		}
	}

	/* split shots: copies of a fresh bolt, fanned ±0.2 rad, made one frame later so they carry the kit's style tags */
	function flushSplits(en, E){
		if(!E.pendingSplit.length || typeof enemyProjectiles === 'undefined') return;
		for(const p of E.pendingSplit){
			if(!p || p.hasHit || enemyProjectiles.indexOf(p) < 0) continue;
			for(const s of [-1, 1]){
				const a = s * 0.2, ca = Math.cos(a), sa = Math.sin(a);
				const q = Object.assign({}, p);
				delete q._efxH; delete q._efxF; delete q.hitTargets;
				q.vx = p.vx * ca - p.vy * sa; q.vy = p.vx * sa + p.vy * ca;
				q.x = p.x - p.vx; q.y = p.y - p.vy;
				q.power = Math.round(p.power * 0.55); q.width = p.width * 0.8; q.height = p.height * 0.8;
				q.age = Math.max(0, (p.age || 0) - 1); q._eliteCopy = true;
				enemyProjectiles.push(q);
				if(typeof CoopSync !== 'undefined' && CoopSync.queueProj) CoopSync.queueProj(q);
			}
		}
		E.pendingSplit.length = 0;
	}

	/* ------------------------------------------------------------------ hooks called from dungeon.html */
	const gcdK = (en) => (en && en._elite) ? en._elite.gcd : 1;
	const cdK = (en) => (en && en._elite) ? en._elite.cd : 1;
	const moveK = (en) => (en && en._elite) ? en._elite.move : 1;
	function onCast(en, fn){
		const E = en && en._elite;
		if(!E || E.mb || E.echo || typeof fn !== 'function') return;
		if(E.tier >= 2 || E.enraged) E.echo = { fn, t: 52 };
	}

	/* ------------------------------------------------------------------ wrappers on the shared kit helpers */
	// every helper is wrapped once, ever (a later script re-wrapping one must not get the boss scaling twice)
	const DONE = Object.create(null);
	function wrapScale(name, getK){
		const o = root[name]; if(typeof o !== 'function' || o._elite || DONE[name]) return; DONE[name] = 1;
		const w = function(n){ return o(n) * getK(); }; w._elite = true; root[name] = w;
	}
	function wrapScoped(name){
		const o = root[name]; if(typeof o !== 'function' || o._elite || DONE[name]) return; DONE[name] = 1;
		const w = function(en){
			if(en && en._elite && !en.dead && root.__eliteEn !== en){
				const prev = root.__eliteEn; root.__eliteEn = en;
				try { return o.apply(this, arguments); } finally { root.__eliteEn = prev; }
			}
			return o.apply(this, arguments);
		};
		w._elite = true; root[name] = w;
	}
	function install(){
		const atkK = () => { const E = scopeE(); return E ? E.atk : 1; };
		['atkS', 'lAtkS', 'wAtkS', 'rosterAtkS'].forEach(n => wrapScale(n, atkK));
		['fireKitHit', 'iceHit', 'earthHit', 'forgeHit', 'wHit', 'rosterHit', 'rosterLineHit', 'lHit',
		 'fireKitSpawn', 'iceSpawn', 'earthSpawn', 'forgeSpawn', 'wSpawn', 'rosterSpawn', 'lSpawn'].forEach(wrapScoped);
		// projectiles: bigger, faster, harder; and queued for a split shot
		const oSpawn = root.spawnEnemyProj;
		if(typeof oSpawn === 'function' && !oSpawn._elite && !DONE.spawnEnemyProj){ DONE.spawnEnemyProj = 1;
			const w = function(x, y, vx, vy, opts){
				const E = scopeE();
				if(!E || (typeof CoopSync !== 'undefined' && CoopSync.applying)) return oSpawn.apply(this, arguments);
				const o = Object.assign({}, opts || {});
				o.width = (o.width || 8) * E.atk; o.height = (o.height || 8) * E.atk;
				o.power = (o.power || 8) * E.dmg;
				if(o.aoeRadius) o.aoeRadius *= E.atk;
				const p = oSpawn.call(this, x, y, vx * E.spd, vy * E.spd, o);
				if(p){
					p._eliteTier = E.tier;
					if(E.split && !o._noSplit && E.splitBudget > 0 && Math.hypot(vx, vy) > 3 && !o.homing){ E.splitBudget--; E.pendingSplit.push(p); }
				}
				return p;
			};
			w._elite = true; root.spawnEnemyProj = w;
		}
		// direct hits made while a boss version acts (contact, beams, custom checks)
		const oDmg = root.damagePlayer;
		if(typeof oDmg === 'function' && !oDmg._elite && !DONE.damagePlayer){ DONE.damagePlayer = 1;
			const w = function(amount){
				const E = scopeE();
				if(E && typeof amount === 'number'){ const a = Array.prototype.slice.call(arguments); a[0] = amount * E.dmg; return oDmg.apply(this, a); }
				return oDmg.apply(this, arguments);
			};
			w._elite = true; root.damagePlayer = w;
		}
		// the scope never outlives the enemy loop
		const oUpd = root.updateEnemies;
		if(typeof oUpd === 'function' && !oUpd._elite && !DONE.updateEnemies){
			DONE.updateEnemies = 1;
			const w = function(){ try { return oUpd.apply(this, arguments); } finally { root.__eliteEn = null; } };
			w._elite = true; root.updateEnemies = w;
		}
		// richer drops
		const oDrops = root.rollEnemyDrops;
		if(typeof oDrops === 'function' && !oDrops._elite && !DONE.rollEnemyDrops){ DONE.rollEnemyDrops = 1;
			const w = function(en){
				const r = oDrops.apply(this, arguments);
				if(en && en._elite && !en._eliteDropped){ en._eliteDropped = true; for(let i = 0; i < en._elite.tier; i++){ try { oDrops.apply(this, arguments); } catch(e){} } }
				return r;
			};
			w._elite = true; root.rollEnemyDrops = w;
		}
		// drawing
		const oDraw = root.drawEnemy;
		if(typeof oDraw === 'function' && !oDraw._elite && !DONE.drawEnemy){ DONE.drawEnemy = 1;
			const w = function(en){
				if(en && en._elite && !en._elite.mb && !en.dead && !hidden(en)){ try { drawBack(en); } catch(e){} }
				const r = oDraw.apply(this, arguments);
				if(en && en._elite && !en._elite.mb && !en.dead && !hidden(en)){ try { drawFront(en); } catch(e){} }
				return r;
			};
			w._elite = true; root.drawEnemy = w;
		}
	}
	const hidden = (en) => !!(en._fireHidden || en._iceHidden || en._earthHidden || en._wildesHidden || en._lateHidden || en._rosterHidden || en._jungleHidden || en.isDormant);

	/* ------------------------------------------------------------------ drawing */
	let _glow = {};
	function glowSpr(hex){
		if(root.EFX && EFX.glowSprite) return EFX.glowSprite(hex);
		if(_glow[hex]) return _glow[hex];
		const c = document.createElement('canvas'); c.width = c.height = 64;
		const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
		gr.addColorStop(0, hex); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
		return (_glow[hex] = c);
	}
	function spriteRect(en){
		try { if(typeof getVisualHitRect === 'function') return getVisualHitRect(en); } catch(e){}
		return { x: en.x, y: en.y, w: en.w, h: en.h };
	}
	function drawBack(en){
		const E = en._elite, c = ctx, cam = camera, t = (E.age || 0);
		const P = pal(E.el), R = spriteRect(en);
		const cx = R.x + R.w / 2 - cam.x, feet = (en.typeDef && en.typeDef.flies) ? R.y + R.h - cam.y : en.y + en.h - cam.y;
		const pulse = 0.75 + 0.25 * Math.sin(t * 0.12);
		c.save();
		c.globalCompositeOperation = 'lighter';
		// body aura
		const aw = R.w * 1.25, ah = R.h * 1.1;
		c.globalAlpha = (E.enraged ? 0.55 : 0.35) * pulse;
		c.drawImage(glowSpr(E.enraged ? '#ff3d5e' : P.mid), cx - aw / 2, R.y + R.h / 2 - cam.y - ah / 2, aw, ah);
		// rune ring at the feet
		const rr = Math.max(26, R.w * 0.55);
		c.globalAlpha = 0.85;
		c.strokeStyle = E.color; c.lineWidth = 2;
		c.beginPath(); c.ellipse(cx, feet, rr, rr * 0.26, 0, 0, Math.PI * 2); c.stroke();
		c.strokeStyle = P.mid; c.lineWidth = 3;
		for(let k = 0; k < E.tier + 1; k++){
			const a0 = t * 0.04 + k * Math.PI * 2 / (E.tier + 1);
			c.beginPath(); c.ellipse(cx, feet, rr * 1.18, rr * 0.31, 0, a0, a0 + 0.9); c.stroke();
		}
		// nova charge: the ground glows
		if(E.novaCharge > 0){
			const k = 1 - E.novaCharge / NOVA_CHARGE;
			c.globalAlpha = 0.4 + 0.5 * k;
			c.drawImage(glowSpr(P.core), cx - rr * 2, feet - rr * 0.5, rr * 4, rr);
		}
		// shockwaves
		for(const W of E.waves){
			const wx = W.x - cam.x, wy = W.y - cam.y, a = Math.max(0, 1 - W.r / NOVA_R);
			c.globalAlpha = 0.9 * a;
			c.strokeStyle = P.core; c.lineWidth = 4;
			c.beginPath(); c.ellipse(wx, wy, W.r, W.r * 0.18, 0, 0, Math.PI * 2); c.stroke();
			c.strokeStyle = P.mid; c.lineWidth = 9; c.globalAlpha = 0.35 * a;
			c.beginPath(); c.ellipse(wx, wy, W.r, W.r * 0.18, 0, 0, Math.PI * 2); c.stroke();
			// the crest that hits you: a wall of light and rubble running along the ground both ways
			for(const s of [-1, 1]){
				const hx = wx + s * W.r, hh = 46 + 18 * a;
				c.globalAlpha = 0.85 * a;
				c.drawImage(glowSpr(P.outer), hx - 26, wy - hh, 52, hh + 8);
				c.drawImage(glowSpr(P.mid), hx - 15, wy - hh * 0.8, 30, hh * 0.85);
				c.drawImage(glowSpr(P.core), hx - 7, wy - hh * 0.5, 14, hh * 0.55);
			}
		}
		c.restore();
	}
	function drawFront(en){
		const E = en._elite, c = ctx, cam = camera, t = (E.age || 0);
		const P = pal(E.el), R = spriteRect(en);
		// sprite frames carry empty space above the body, so the crown sits on the body's own box
		const cx = R.x + R.w / 2 - cam.x, top = Math.max(R.y, en.y - en.h * 0.12) - cam.y;
		c.save();
		// crown of horns over the head
		const cw = Math.max(22, Math.min(54, R.w * 0.42)), ch = cw * 0.5, cy = top - 6 + Math.sin(t * 0.08) * 2;
		c.globalCompositeOperation = 'lighter';
		c.globalAlpha = 0.6; c.drawImage(glowSpr(E.color), cx - cw, cy - ch * 1.6, cw * 2, ch * 2.6);
		c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
		c.fillStyle = E.color; c.strokeStyle = 'rgba(40,20,0,0.85)'; c.lineWidth = 1.5;
		const spikes = 2 + E.tier;
		c.beginPath(); c.moveTo(cx - cw / 2, cy);
		for(let i = 0; i <= spikes; i++){
			const x = cx - cw / 2 + cw * i / spikes;
			const tall = (i === Math.floor(spikes / 2) || (spikes % 2 === 0 && i === spikes / 2)) ? 1.25 : 0.8;
			c.lineTo(x, cy - ch * tall);
			if(i < spikes) c.lineTo(x + cw / spikes / 2, cy - ch * 0.25);
		}
		c.lineTo(cx + cw / 2, cy); c.closePath(); c.fill(); c.stroke();
		c.fillStyle = P.core; c.beginPath(); c.arc(cx, cy - ch * 0.3, 2.5, 0, Math.PI * 2); c.fill();
		// name plate
		c.font = 'bold 12px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'bottom';
		const label = E.stars + ' ' + en._eliteName;
		c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,0.75)'; c.strokeText(label, cx, cy - ch * 1.35);
		c.fillStyle = E.enraged ? '#ff6b7d' : E.color; c.fillText(label, cx, cy - ch * 1.35);
		// embers drifting off it
		if(root.EFX && (t % 7 === 0)) EFX.mote(E.el, R.x + rnd() * R.w, R.y + R.h * (0.3 + rnd() * 0.6), 0, -1, 1.1);
		c.restore();
	}

	root.EliteVariants = { TIERS, apply, maybePromote, tick, onCast, gcdK, cdK, moveK, install, RUN };
	// kits load before this file; install now, and again after load in case a helper is defined late
	install();
	if(document.readyState !== 'complete') window.addEventListener('load', install);
})(window);
