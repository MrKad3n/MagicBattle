/* =============================================================
   SPELL SCROLLS — premade + blank + player-engraved
   Shared by inventory.html and dungeon.html
   ============================================================= */
(function(){
	function ph(o){
		return Object.assign({
			shape:'missile', behavior:'straight', width:1, height:1, speed:1,
			duration:1, power:1, count:1, spread:0, effects:[], color:'#4488ff',
			trail:'sparkle', nextTrigger:'onHit',
			orbitRadius:80, orbitSpeed:3, orbitDuration:1.5,
			spiralRadius:40, spiralFreq:0.12,
			timedReleaseDelay:0.5,
			phaseForkDelay:1, phaseForkRepeats:1,
			aroundSelfCount:4, aroundSelfRadius:50,
			chainStunTime:0,
			rainHeight:150,
			barrageHeight:200,
			groundRadius:200, groundAutoLock:true,
			summonRange:0, summonHealth:0, summonSpeed:0, summonClose:false, summonSelfReliance:false, necroSummonType:'random',
			effectPower:1, effectDuration:1,
			randomDelayMax:0.5,
			evenDelayDuration:0.5,
			afterHitEffect:'none', polygonSides:6,
			noHit:false, vortexDuration:1,
			holdDown:false,
			domainElement:'burn', domainColor:'#ff4400', domainPattern:'flames',
			transformAuraStyle:'pulse', transformAuraColor:'#ff8800', transformAuraColor2:'#ffffff', transformAuraStrength:1,
			transformBuffPoints:{}, transformLoadoutName:'',
		}, o || {});
	}
	function spell(name, phases){ return { name: name, phases: phases }; }

	const ITEMS = {
		blank_scroll: {
			name:'Blank Scroll', type:'scroll', icon:'📃', rarity:'common', stats:{},
			blank:true, price:30,
			desc:'An empty parchment. Engrave one of your spells onto it to create a pink player-made scroll. Does not disappear until engraved.',
		},
		scroll_spark: {
			name:'Scroll of Spark Bolt', type:'scroll', icon:'📜', rarity:'common', stats:{}, price:40,
			desc:'A basic missile. Use it to copy the spell into a slot. The scroll stays in your bag.',
			spell: spell('Spark Bolt', [ph({ color:'#88c8ff', speed:1.4 })]),
		},
		scroll_stone: {
			name:'Scroll of Stone Shot', type:'scroll', icon:'📜', rarity:'common', stats:{}, price:45,
			desc:'A heavier orb. Use it to copy the spell into a slot. The scroll stays in your bag.',
			spell: spell('Stone Shot', [ph({ shape:'orb', color:'#c4b49a', power:1.2, speed:0.85 })]),
		},
		scroll_ember: {
			name:'Scroll of Ember Dart', type:'scroll', icon:'📜', rarity:'uncommon', stats:{}, price:80,
			desc:'A burning missile. Use it to copy the spell into a slot. The scroll stays in your bag.',
			spell: spell('Ember Dart', [ph({ color:'#ff6a2a', effects:['burn'], trail:'flame', afterHitEffect:'flame_burst' })]),
		},
		scroll_frost: {
			name:'Scroll of Frost Needle', type:'scroll', icon:'📜', rarity:'uncommon', stats:{}, price:85,
			desc:'A freezing spike. Use it to copy the spell into a slot. The scroll stays in your bag.',
			spell: spell('Frost Needle', [ph({ shape:'spike', color:'#9ad8ff', effects:['freeze'], trail:'ice' })]),
		},
		scroll_mend: {
			name:'Scroll of Mend Pulse', type:'scroll', icon:'📜', rarity:'uncommon', stats:{}, price:90,
			desc:'A healing orb on yourself. Use it to copy the spell into a slot. The scroll stays in your bag.',
			spell: spell('Mend Pulse', [ph({ shape:'allyOrb', behavior:'selfCast', color:'#44ee88', duration:1.4 })]),
		},
		scroll_seeker: {
			name:'Scroll of Seeker Flame', type:'scroll', icon:'📜', rarity:'rare', stats:{}, price:150,
			desc:'A homing burning orb. Use it to copy the spell into a slot. The scroll stays in your bag.',
			spell: spell('Seeker Flame', [ph({ shape:'orb', behavior:'homing', color:'#ff5533', effects:['burn'], trail:'flame', power:1.3 })]),
		},
		scroll_quake: {
			name:'Scroll of Quake Spike', type:'scroll', icon:'📜', rarity:'rare', stats:{}, price:160,
			desc:'A spike that erupts from the ground. Use it to copy the spell into a slot. The scroll stays in your bag.',
			spell: spell('Quake Spike', [ph({ shape:'spike', behavior:'ground', color:'#d4a574', power:1.4, groundRadius:260 })]),
		},
		scroll_comet: {
			name:'Scroll of Comet Rain', type:'scroll', icon:'📜', rarity:'epic', stats:{}, price:280,
			desc:'Meteors falling from the sky. Use it to copy the spell into a slot. The scroll stays in your bag.',
			spell: spell('Comet Rain', [ph({ shape:'meteor', behavior:'rain', color:'#ff8844', count:4, spread:28, power:1.2, rainHeight:200 })]),
		},
		scroll_arc: {
			name:'Scroll of Arc Lash', type:'scroll', icon:'📜', rarity:'epic', stats:{}, price:300,
			desc:'A jumping chain that can stun. Use it to copy the spell into a slot. The scroll stays in your bag.',
			spell: spell('Arc Lash', [ph({ shape:'chain', behavior:'zigzag', color:'#c8b8ff', effects:['stun'], trail:'lightning', chainStunTime:0.2 })]),
		},
		scroll_tempest: {
			name:'Scroll of Tempest Wall', type:'scroll', icon:'📜', rarity:'legendary', stats:{}, price:520,
			desc:'A burning barrage of spikes. Use it to copy the spell into a slot. The scroll stays in your bag.',
			spell: spell('Tempest Wall', [ph({ shape:'spike', behavior:'barrage', color:'#ffaa33', count:6, spread:18, effects:['burn'], trail:'flame', power:1.3, barrageHeight:220 })]),
		},
		/* Mirror War — a 61-rune legion spell (tools/mirror-war.js builds it; mirror-war-spell.js carries the serialized tree).
		   Not sold: it is handed out by the inventory's 🪞 Mirror War button. */
		scroll_mirror_war: {
			name:'Scroll of Mirror War', type:'scroll', icon:'🪞', rarity:'legendary', stats:{}, price:2400, noShop:true,
			desc:'Mirror War — five families of projectiles from one cast: Harriers, Sweepers, Crossfire, Reserves and Executors, released in sequence and carrying five Binding Vows. Needs Energy Control 17 (61 runes). Use it to copy the spell into a slot. The scroll stays in your bag.',
			get spell(){ return window.MIRROR_WAR_SPELL || null; },
		},
		/* Authentic Mutual Love — Yuta's domain (tools/yuta-domain.js builds it; yuta-spell.js carries the serialized tree).
		   Not sold: it is handed out by the inventory's 💞 Mutual Love button. */
		scroll_yuta: {
			name:'Scroll of Authentic Mutual Love', type:'scroll', icon:'💞', rarity:'legendary', stats:{}, price:3200, noShop:true,
			desc:'Authentic Mutual Love — a sealed domain with no blow of its own. Every spell or attack made inside is copied, and the domain casts the copies back at its foes from its own energy, so they cannot miss. Needs Energy Control 6 and about 1170 mana. Use it to copy the spell into a slot. The scroll stays in your bag.',
			get spell(){ return window.YUTA_SPELL || null; },
		},
		player_scroll: {
			name:'Player Scroll', type:'scroll', icon:'📜', rarity:'pink', stats:{},
			playerMade:true,
			desc:'A player-engraved scroll. Pink rarity. Use it to copy the stored spell into a slot. Does not disappear.',
		},
	};

	window.SCROLL_ITEM_DB = ITEMS;
	window.SCROLL_SHOP_STOCK = [
		'blank_scroll', 'scroll_spark', 'scroll_stone',
		'scroll_ember', 'scroll_frost', 'scroll_mend',
		'scroll_seeker', 'scroll_quake',
		'scroll_comet', 'scroll_arc',
		'scroll_tempest',
	];
	window.SCROLL_STARTING_GOLD = 350;

	window.getScrollPrice = function(itemId){
		const it = ITEMS[itemId];
		return (it && it.price) || 50;
	};
	window.isScrollItem = function(item){
		return !!(item && item.type === 'scroll');
	};
	window.isBlankScroll = function(item, entry){
		return !!(item && item.blank) && !(entry && entry.spell);
	};
	window.resolveScrollSpell = function(entry, db){
		if(!entry) return null;
		if(entry.spell) return entry.spell;
		const it = (db || ITEMS)[entry.itemId];
		return (it && it.spell) ? it.spell : null;
	};
	window.scrollDisplayName = function(entry, db){
		if(entry && entry.scrollName) return entry.scrollName;
		const it = (db || ITEMS)[entry.itemId];
		return it ? it.name : 'Scroll';
	};
	window.cloneSpellData = function(spell){
		return JSON.parse(JSON.stringify(spell));
	};
	window.makePlayerScrollEntry = function(spell){
		const copy = window.cloneSpellData(spell);
		return {
			itemId: 'player_scroll',
			qty: 1,
			uid: 'ps_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8),
			scrollName: 'Scroll of ' + (copy.name || 'Unknown'),
			spell: copy,
		};
	};
	window.ensurePlayerGold = function(data){
		if(!data) return 0;
		if(data.gold == null || isNaN(data.gold)) data.gold = window.SCROLL_STARTING_GOLD;
		return data.gold;
	};
	/* the scroll for the inventory's 🪞 button (a fresh stack entry; scroll items are not consumed by use) */
	window.MIRROR_WAR_NEED_CONTROL = 17;
	window.YUTA_NEED_CONTROL = 6;
	window.mergeScrollItems = function(itemDb){
		if(!itemDb) return;
		for(const k of Object.keys(ITEMS)){
			if(!itemDb[k]) itemDb[k] = ITEMS[k];
		}
	};
})();
