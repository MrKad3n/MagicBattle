/* =============================================================
   The Living Wilds — authored Jungle Dungeon room library.

   Every critical ledge, hazard, clue, puzzle fixture, and spawn is
   authored here. The assembler may choose and connect rooms, but it
   never invents mandatory traversal geometry.
   ============================================================= */
(function(global){
	'use strict';
	const T = 40;

	function A(x, y, w, h){ return { x:x, y:y, w:w, h:h }; }
	function M(x, y, w, h){ return { x:x, y:y, w:w, h:h }; }
	function P(kind, x, y, w, extra){
		return Object.assign({ kind:kind || 'static', x:x, y:y, w:w, h:T }, extra || {});
	}
	function E(x, y, type, extra){
		return Object.assign({ x:x, y:y, type:type || null }, extra || {});
	}
	function D(type, x, y, extra){
		return Object.assign({ type:type, x:x, y:y, _jungle:true }, extra || {});
	}
	function H(type, x, y, w, h, extra){
		return Object.assign({ type:type, x:x, y:y, w:w, h:h }, extra || {});
	}
	function I(kind, x, y, w, h, extra){
		return Object.assign({ kind:kind, x:x, y:y, w:w || 60, h:h || 70, used:false }, extra || {});
	}
	function R(id, kind, category, section, w, h, label, data){
		return Object.assign({
			id:id, kind:kind, category:category, section:section,
			w:w, h:h, label:label, objective:'',
			cells:[A(0, 0, w, h)], solids:[], ports:{},
			platforms:[], hazards:[], props:[], interactables:[], spawns:[],
			clearMode:'none',
		}, data || {});
	}

	const JUNGLE_ROOM_TEMPLATES = [
		/* ================= REGION 1 — OVERGROWN RUINS ================= */
		R('jg_overgrown_gate', 'start', 'start', [1], 1760, 920, 'The Overgrown Gate', {
			noCombat:true,
			cells:[A(0,260,1760,660), A(180,80,820,220)],
			solids:[M(0,760,280,160), M(1420,800,340,120)],
			ports:{right:{y:620,h:220}},
			platforms:[
				P('static',280,720,240), P('static',600,650,220), P('static',930,720,260),
			],
			props:[
				D('jgLightShaft',210,60,{w:260,h:650,alpha:0.2}),
				D('jgRuinArch',70,430,{w:300,h:330,broken:true}),
				D('jgStatue',470,570,{w:150,h:230,fallen:true}),
				D('jgRootMass',1400,360,{w:360,h:560,from:'right'}),
				D('jgVineCurtain',1480,80,{w:280,h:680}),
				D('jgMossCarpet',300,882,{w:1050,h:36}),
				D('jgButterflies',830,480,{w:360,h:180}),
			],
			interactables:[
				I('jungleMemory',520,650,60,70,{name:'Expedition Marker', lore:'The road did not vanish beneath the jungle. The roots lifted it apart.'}),
			],
		}),

		R('jg_overgrown_courtyard', 'combat', 'combat', [1], 2180, 1120, 'Overgrown Courtyard', {
			objective:'CLEAR THE RUINED COURTYARD', clearMode:'combat',
			cells:[A(0,300,2180,820), A(260,100,1500,240)],
			solids:[M(0,920,260,200), M(900,720,220,180), M(1900,880,280,240)],
			ports:{left:{y:780,h:260},right:{y:660,h:320},top:{x:1440,w:240}},
			platforms:[
				P('static',300,850,280), P('static',650,760,220), P('static',1190,820,300), P('static',1600,700,220),
			],
			hazards:[
				H('rootSnare',520,820,110,80,{period:230,phase:20}),
				H('rootSnare',1450,790,110,80,{period:230,phase:128}),
				H('fallingBranch',780,100,240,42,{impactY:820,period:260,phase:90}),
				H('sporePocket',1100,800,90,90,{triggerR:120}),
			],
			props:[
				D('jgRuinWall',0,460,{w:260,h:460}),
				D('jgRuinArch',900,440,{w:230,h:280,broken:true}),
				D('jgStatue',1480,620,{w:150,h:230,headless:true}),
				D('jgGiantTree',1540,400,{w:300,h:720}),
				D('jgHangingVines',260,100,{w:1500,h:240}),
				D('jgMossCarpet',260,1078,{w:1600,h:36}),
			],
			spawns:[E(420,820,'barkbackBeetle'),E(1060,650,'pollenMoth'),E(1650,660,'thornWolf'),E(780,740,'rootParasite')],
		}),

		R('jg_broken_statue_court', 'combat', 'combat', [1], 1960, 1040, 'Court of Broken Faces', {
			objective:'SURVIVE THE AMBUSH', clearMode:'combat',
			cells:[A(0,260,1960,780),A(360,80,1180,220)],
			solids:[M(0,870,200,170),M(1760,840,200,200),M(760,800,400,120)],
			ports:{left:{y:740,h:220},right:{y:720,h:220},bottom:{x:820,w:240}},
			platforms:[P('static',230,790,300),P('static',650,650,220),P('static',1160,650,220),P('static',1450,790,260)],
			hazards:[
				H('fallingBranch',480,80,240,42,{impactY:850,period:280,phase:40}),
				H('fallingBranch',1320,80,280,42,{impactY:850,period:280,phase:170}),
				H('rootSnare',700,780,110,80,{period:210,phase:60}),
				H('rootSnare',1280,780,110,80,{period:210,phase:160}),
			],
			props:[
				D('jgStatue',80,650,{w:130,h:220,fallen:true}),
				D('jgStatue',840,590,{w:170,h:250,broken:true}),
				D('jgRuinWall',1500,500,{w:250,h:340}),
				D('jgSuspiciousEyes',350,410,{w:120,h:50}),
				D('jgSuspiciousEyes',1450,450,{w:120,h:50}),
				D('jgHangingVines',180,80,{w:1550,h:720}),
			],
			spawns:[E(420,760,'vineCrawler'),E(990,760,'jungleChameleon'),E(1510,760,'thornWolf'),E(680,620,'rootParasite')],
		}),

		R('jg_giant_root_chamber', 'rootChamber', 'traversal', [1,2], 2240, 1420, 'Giant Root Chamber', {
			objective:'CLIMB THROUGH THE LIVING ROOTS', clearMode:'traverse',
			cells:[A(0,640,2240,780),A(280,260,1660,420),A(760,40,720,260)],
			solids:[M(0,1220,360,200),M(1880,1180,360,240),M(930,620,320,160)],
			ports:{left:{y:1120,h:220},right:{y:1060,h:220},top:{x:1000,w:240},bottom:{x:420,w:240}},
			platforms:[
				P('static',340,1110,300),P('static',720,970,260),P('static',1160,840,280),
				P('static',1540,680,260),P('static',1040,500,220),P('static',760,310,200),
			],
			hazards:[
				H('swingingVine',920,160,28,520,{length:480,period:260,phase:0}),
				H('swingingVine',1460,300,28,440,{length:400,period:230,phase:110}),
			],
			props:[
				D('jgRootMass',0,640,{w:420,h:780,from:'left'}),
				D('jgRootMass',1820,620,{w:420,h:800,from:'right'}),
				D('jgRootArch',720,40,{w:800,h:620,from:'ceiling'}),
				D('jgGlowMushrooms',340,1000,{w:300,h:130}),
				D('jgGlowMushrooms',1160,730,{w:280,h:120}),
			],
			clearZone:{x:920,y:80,w:400,h:220},
		}),

		R('jg_jungle_stream', 'streamPuzzle', 'puzzle', [1,2], 2200, 1160, 'Jungle Stream', {
			objective:'ROUTE BOTH SLUICES FROM SOURCE TO BASIN', clearMode:'puzzle',
			cells:[A(0,300,2200,860),A(260,120,1660,220)],
			solids:[M(0,880,360,280),M(1840,880,360,280)],
			ports:{left:{y:660,h:220},right:{y:660,h:220},top:{x:1020,w:240}},
			platforms:[
				P('static',40,880,300),P('static',720,820,220),
				P('growth',1020,850,520,{growthId:'stream_bridge',hidden:true}),
				P('static',1860,880,300),
			],
			hazards:[
				H('water',360,920,1480,240,{current:0.55,deep:true}),
			],
			props:[
				D('jgStream',360,920,{w:1480,h:240}),
				D('jgWaterWheel',450,700,{w:160,h:220}),
				D('jgWaterWheel',1580,700,{w:160,h:220}),
				D('jgWiltedVines',980,620,{w:600,h:280,growthId:'stream_bridge'}),
				D('jgMechanismClue',720,340,{states:[1,2],targets:[1,2],w:760,h:160,labels:['WEST SLUICE','EAST SLUICE']}),
				D('jgRuinWall',0,480,{w:280,h:480}),
				D('jgRuinWall',1920,500,{w:280,h:460}),
			],
			puzzle:{type:'mini',mini:'sluiceFlow',group:'stream',growthId:'stream_bridge',sides:true},
			interactables:[
				I('waterWheel',460,720,110,170,{group:'stream',idx:0,states:3,state:0,name:'West Sluice'}),
				I('waterWheel',1600,720,110,170,{group:'stream',idx:1,states:3,state:0,name:'East Sluice'}),
			],
		}),

		R('jg_flooded_ruins', 'floodedRuins', 'traversal', [1,2], 2380, 1280, 'Flooded Ruins', {
			objective:'READ THE CURRENT AND GUIDE THE SEED TO LIVING WATER', clearMode:'puzzle',
			cells:[A(0,340,2380,940),A(300,120,1700,240)],
			solids:[M(0,980,320,300),M(2060,980,320,300),M(930,900,480,160)],
			ports:{left:{y:760,h:220},right:{y:760,h:220},top:{x:1060,w:260},bottom:{x:420,w:260}},
			platforms:[
				P('static',20,980,280),P('static',620,840,220),P('static',990,780,340),
				P('static',1500,840,220),P('static',2080,980,260),
			],
			hazards:[
				H('water',320,1020,1740,260,{current:-0.9,deep:true}),
				H('sporePocket',760,820,90,90,{triggerR:130}),
				H('sporePocket',1580,820,90,90,{triggerR:130}),
				H('rootSnare',620,920,110,80,{period:220,phase:50}),
				H('fallingBranch',1100,120,280,42,{impactY:900,period:270,phase:80}),
			],
			props:[
				D('jgFloodedTemple',760,470,{w:820,h:510}),
				D('jgStream',320,1020,{w:1740,h:260}),
				D('jgLilyPads',400,955,{w:1500,h:70}),
				D('jgFlowClue',1850,900,{dir:1,w:180}),
				D('jgGlowMushrooms',980,840,{w:320,h:100}),
			],
			puzzle:{type:'mini',mini:'currentRead',growthId:null},
			interactables:[
				I('puzzleBoard',1860,900,100,90,{name:'Root Gates',group:'current'}),
				I('waterWheel',640,760,90,140,{group:'current',name:'West Gate'}),
				I('waterWheel',1520,760,90,140,{group:'current',name:'East Gate'}),
			],
			clearZone:{x:1940,y:830,w:300,h:320},
		}),

		R('jg_root_maze', 'rootMaze', 'puzzle', [1,2], 2400, 1260, 'Root Maze', {
			objective:'WATCH THE CAPS — REPEAT THE LIVING RHYTHM', clearMode:'puzzle',
			cells:[A(0,300,2400,960),A(300,120,1760,220)],
			solids:[
				M(480,520,120,560),M(930,380,120,520),M(1370,540,120,540),M(1810,400,120,520),
			],
			ports:{left:{y:960,h:220},right:{y:900,h:220},bottom:{x:1080,w:240}},
			platforms:[
				P('static',160,950,260),P('static',420,860,160),P('static',650,780,220),
				P('static',880,860,180),P('static',1110,940,220),P('static',1340,850,180),
				P('static',1550,760,220),P('static',1780,850,180),P('static',1990,940,250)
			],
			hazards:[
				H('rootSnare',610,980,90,70,{manual:true,group:'mazeFail'}),
				H('rootSnare',1500,980,90,70,{manual:true,group:'mazeFail'}),
			],
			props:[
				D('jgRootMaze',200,80,{w:2000,h:260}),
				D('jgBloomClue',180,820,{index:1,color:'#e8c45a'}),
				D('jgBloomClue',670,650,{index:2,color:'#86e67b'}),
				D('jgBloomClue',1130,810,{index:3,color:'#7bdbe6'}),
				D('jgBloomClue',1570,630,{index:4,color:'#c084ed'}),
				D('jgBloomClue',2010,810,{index:5,color:'#ef7b73'}),
			],
			puzzle:{type:'mini',mini:'rootRhythm',group:'mazeRoots',rounds:[3,4,5],failHazard:'mazeFail'},
			interactables:[
				I('mushroomNode',180,870,90,90,{group:'mazeRoots',idx:0,name:'Amber Cap'}),
				I('mushroomNode',670,700,90,90,{group:'mazeRoots',idx:1,name:'Verdant Cap'}),
				I('mushroomNode',1130,860,90,90,{group:'mazeRoots',idx:2,name:'Azure Cap'}),
				I('mushroomNode',1570,680,90,90,{group:'mazeRoots',idx:3,name:'Violet Cap'}),
				I('mushroomNode',2010,860,90,90,{group:'mazeRoots',idx:4,name:'Ember Cap'}),
			],
		}),

		R('jg_water_mechanism', 'waterMechanism', 'puzzle', [1,2], 2280, 1200, 'Ancient Water Mechanism', {
			objective:'ROUTE WATER FROM SOURCE TO BASIN', clearMode:'puzzle',
			cells:[A(0,300,2280,900),A(280,80,1680,260)],
			solids:[M(0,1000,240,200),M(2040,1000,240,200),M(920,760,440,180)],
			ports:{left:{y:860,h:220},right:{y:860,h:220},top:{x:1020,w:240}},
			platforms:[P('static',260,920,300),P('static',680,780,220),P('static',1400,780,220),P('static',1720,920,300)],
			hazards:[H('water',240,1000,1800,200,{current:0,depth:'shallow'})],
			props:[
				D('jgAncientMechanism',900,510,{w:480,h:330}),
				D('jgWaterChannel',230,940,{w:1820,h:160}),
				D('jgMechanismClue',620,540,{states:[2,0,1]}),
				D('jgRuinWall',40,480,{w:260,h:520}),D('jgRuinWall',1980,480,{w:260,h:520}),
			],
			puzzle:{type:'mini',mini:'sluiceFlow',group:'sluices',failHazard:'waterBurst'},
			interactables:[
				I('waterWheel',480,820,80,130,{group:'sluices',idx:0,states:3,state:0,name:'Sun Sluice'}),
				I('waterWheel',1050,690,80,130,{group:'sluices',idx:1,states:3,state:0,name:'Root Sluice'}),
				I('waterWheel',1700,820,80,130,{group:'sluices',idx:2,states:3,state:0,name:'Rain Sluice'}),
			],
		}),

		R('jg_ancient_memory', 'memory', 'event', [1,4], 1720, 900, 'Ancient Memory Chamber', {
			objective:'STUDY THE MURAL — BEND ITS LIGHT INTO THE CRYSTAL', clearMode:'puzzle', noCombat:true,
			cells:[A(0,260,1720,640),A(300,80,1120,220)],
			solids:[M(0,760,260,140),M(1460,760,260,140)],
			ports:{left:{y:610,h:220},right:{y:610,h:220},top:{x:740,w:240}},
			platforms:[P('static',280,720,260),P('static',670,640,380),P('static',1180,720,240)],
			props:[
				D('jgMemoryMural',570,330,{w:580,h:310}),
				D('jgStatue',300,560,{w:100,h:160,headless:true}),
				D('jgRootLetters',600,620,{w:520,h:80}),
				D('jgLightShaft',700,70,{w:300,h:540,alpha:0.14}),
			],
			puzzle:{type:'mini',mini:'sunMirror'},
			interactables:[
				I('jungleMemory',790,560,100,100,{name:'Rootbound Mural', rare:true, lore:'The city tried to command the Worldroot. The Worldroot learned the shape of its chains.'}),
			],
		}),

		R('jg_sunken_shrine', 'shrine', 'shrine', [1,2], 1800, 1040, 'Sunken Shrine', {
			objective:'OPTIONAL — ACCEPT A VERDANT BLESSING', clearMode:'interact', optional:true, noCombat:true,
			cells:[A(0,300,1800,740),A(360,100,1080,240)],
			solids:[M(0,880,260,160),M(1540,880,260,160)],
			ports:{left:{y:720,h:220},right:{y:720,h:220},top:{x:780,w:240}},
			platforms:[P('static',260,850,300),P('static',650,760,500),P('static',1250,850,280)],
			hazards:[H('water',240,900,1320,140,{current:0,depth:'shallow'})],
			props:[
				D('jgSunkenShrine',640,460,{w:520,h:310}),
				D('jgStream',240,890,{w:1320,h:150}),
				D('jgGiantFlower',820,590,{w:160,h:180,glow:true}),
				D('jgFireflies',420,300,{w:960,h:420}),
			],
			interactables:[I('jungleShrine',820,650,140,110,{name:'Shrine of Returning Rain'})],
		}),

		R('jg_buried_temple', 'secretTemple', 'secret', [1,4], 1760, 1000, 'Buried Temple', {
			objective:'CUT THE HEART ROOT BEFORE THE TANGLE GROWS BACK', clearMode:'puzzle', optional:true, secret:true,
			cells:[A(0,280,1760,720),A(260,80,1240,220)],
			solids:[M(0,820,240,180),M(1520,820,240,180),M(700,700,360,120)],
			ports:{left:{y:680,h:220}},
			platforms:[P('static',240,780,280),P('static',600,650,560),P('static',1240,780,260)],
			props:[
				D('jgBuriedFacade',360,300,{w:1040,h:480}),
				D('jgSuspiciousRoot',0,610,{w:260,h:240}),
				D('jgTreasureGlow',780,570,{r:170}),
				D('jgMural',650,400,{w:460,h:220}),
			],
			puzzle:{type:'mini',mini:'rootCut'},
			interactables:[
				I('rootStrand',640,420,80,180,{tier:'main',idx:0,name:'Heart Root'}),
				I('rootStrand',780,480,70,140,{tier:'sec',idx:1,name:'Branch Root'}),
				I('rootStrand',920,500,70,140,{tier:'sec',idx:2,name:'Branch Root'}),
				I('rootStrand',1060,540,60,110,{tier:'thin',idx:3,name:'Tendril'}),
				I('jungleCache',820,610,100,80,{name:'Temple Reliquary',rare:true,_locked:true,_lockTag:'main'}),
				I('jungleMemory',1130,620,80,80,{name:'Broken Tablet',lore:'They cut the first root. The forest answered by growing ten thousand more.'}),
			],
		}),

		/* ================= REGION 2 — DEEP JUNGLE ================= */
		R('jg_waterfall_crossing', 'waterfall', 'traversal', [2,3], 2460, 1500, 'Waterfall Crossing', {
			objective:'CROSS BEHIND THE WATERFALL', clearMode:'traverse',
			cells:[A(0,600,2460,900),A(240,260,1980,380),A(820,80,820,220)],
			solids:[M(0,1280,360,220),M(2100,1260,360,240),M(990,970,480,220)],
			ports:{left:{y:1160,h:220},right:{y:1120,h:220},top:{x:1120,w:240},bottom:{x:420,w:240}},
			platforms:[
				P('static',340,1170,280),P('static',720,1010,240),P('static',1080,850,300),
				P('growth',1480,1010,300,{growthId:'waterfall_vine',hidden:true}),P('static',1880,1170,240),
			],
			hazards:[
				H('waterfall',1030,120,420,1160,{force:1.8}),
				H('water',360,1240,1740,260,{current:1.2,deep:true}),
			],
			props:[
				D('jgWaterfall',1030,100,{w:420,h:1180}),
				D('jgDistantRuins',480,250,{w:1400,h:600,alpha:0.34}),
				D('jgHangingVines',200,340,{w:1900,h:380}),
				D('jgFlowClue',1470,930,{dir:1,w:280}),
			],
			interactables:[
				I('growthNode',740,930,90,90,{growthId:'waterfall_vine',name:'Rain-fed Vine'}),
			],
			clearZone:{x:2020,y:1030,w:320,h:350},
		}),

		R('jg_fungal_cavern', 'fungalPuzzle', 'puzzle', [2], 2240, 1380, 'Fungal Cavern', {
			objective:'WATCH THE CAPS — REPEAT THE LIVING RHYTHM', clearMode:'puzzle',
			cells:[A(0,560,2240,820),A(260,240,1700,360),A(760,60,720,220)],
			solids:[M(0,1190,320,190),M(1920,1170,320,210)],
			ports:{left:{y:1060,h:220},right:{y:1040,h:220},top:{x:980,w:260},bottom:{x:460,w:240}},
			platforms:[
				P('static',300,1080,260),P('static',700,940,240),P('static',1120,790,260),
				P('static',1520,940,240),P('static',1840,1080,240),
			],
			hazards:[
				H('bounceMushroom',520,1030,130,70,{lift:15}),
				H('bounceMushroom',980,880,130,70,{lift:16}),
				H('bounceMushroom',1500,1030,130,70,{lift:15}),
				H('sporePocket',820,900,80,80,{triggerR:100}),
				H('poisonFlower',690,970,120,100,{group:'fungalBurst',manual:true,cloudR:150}),
				H('poisonFlower',1390,900,120,100,{group:'fungalBurst',manual:true,cloudR:150}),
			],
			props:[
				D('jgMushroomForest',260,1250,{w:1700,h:130}),
				D('jgGlowMushrooms',320,970,{w:220,h:110,index:2}),
				D('jgGlowMushrooms',1120,680,{w:220,h:110,index:1}),
				D('jgGlowMushrooms',1530,830,{w:220,h:110,index:3}),
				D('jgCaveMist',260,1050,{w:1700,h:240}),
			],
			puzzle:{type:'mini',mini:'rootRhythm',group:'mushrooms',rounds:[3,4,5],failHazard:'fungalBurst'},
			interactables:[
				I('mushroomNode',380,980,100,100,{group:'mushrooms',idx:0,name:'Amber Cap'}),
				I('mushroomNode',1200,690,100,100,{group:'mushrooms',idx:1,name:'Moon Cap'}),
				I('mushroomNode',1590,840,100,100,{group:'mushrooms',idx:2,name:'Star Cap'}),
				I('mushroomNode',740,860,100,100,{group:'mushrooms',idx:3,name:'Violet Cap'}),
				I('mushroomNode',1880,980,100,100,{group:'mushrooms',idx:4,name:'Ember Cap'}),
			],
		}),

		R('jg_carnivorous_garden', 'carnivoreGarden', 'trap', [2,4], 2180, 1120, 'Carnivorous Garden', {
			objective:'TOUCH EACH GIANT FLOWER WHILE IT IS OPEN', clearMode:'puzzle',
			cells:[A(0,300,2180,820),A(300,100,1500,240)],
			solids:[M(0,930,220,190),M(1960,930,220,190)],
			ports:{left:{y:800,h:220},right:{y:800,h:220},bottom:{x:970,w:240}},
			platforms:[P('static',220,880,260),P('static',590,820,220),P('static',960,880,260),P('static',1350,800,220),P('static',1700,880,260)],
			hazards:[
				H('carnivorousPlant',500,740,170,180,{period:210,phase:0}),
				H('carnivorousPlant',980,790,180,190,{period:210,phase:70}),
				H('carnivorousPlant',1480,720,180,190,{period:210,phase:140}),
				H('poisonFlower',760,850,120,110,{period:260,phase:40}),
				H('poisonFlower',1270,820,120,110,{period:260,phase:170}),
			],
			props:[
				D('jgCarnivoreBed',240,650,{w:1720,h:330}),
				D('jgGiantFlower',680,700,{w:170,h:190}),
				D('jgGiantFlower',1220,680,{w:170,h:190}),
				D('jgWarningBones',430,890,{w:180,h:70}),
				D('jgWarningBones',1430,870,{w:180,h:70}),
			],
			puzzle:{type:'mini',mini:'flowerTiming',group:'flowers',failHazard:null},
			interactables:[
				I('flowerNode',250,800,90,90,{group:'flowers',idx:0,name:'Ember Bloom'}),
				I('flowerNode',620,740,90,90,{group:'flowers',idx:1,name:'Sun Bloom'}),
				I('flowerNode',990,800,90,90,{group:'flowers',idx:2,name:'Rain Bloom'}),
				I('flowerNode',1380,720,90,90,{group:'flowers',idx:3,name:'Moon Bloom'}),
				I('flowerNode',1730,800,90,90,{group:'flowers',idx:4,name:'Grove Bloom'}),
			],
			clearZone:{x:1820,y:750,w:300,h:300},
		}),

		R('jg_predators_grove', 'predatorGrove', 'event', [2], 2100, 1100, 'Predator’s Grove', {
			objective:'READ THE TRAIL BEFORE THE PACK SEES YOU', clearMode:'puzzle',
			cells:[A(0,300,2100,800),A(340,100,1420,240)],
			solids:[M(0,920,260,180),M(1840,920,260,180),M(820,780,420,140)],
			ports:{left:{y:790,h:220},right:{y:790,h:220},top:{x:930,w:240},bottom:{x:420,w:240}},
			platforms:[P('static',260,870,280),P('static',620,760,220),P('static',1240,760,220),P('static',1560,870,280)],
			props:[
				D('jgNest',860,690,{w:380,h:140,large:true}),
				D('jgClawMarks',340,620,{w:220,h:120}),
				D('jgClawMarks',1510,600,{w:220,h:120}),
				D('jgSuspiciousEyes',490,430,{w:150,h:60}),
				D('jgSuspiciousEyes',1450,410,{w:150,h:60}),
				D('jgQuietMist',260,780,{w:1580,h:200}),
			],
			puzzle:{type:'mini',mini:'predatorTrack'},
			interactables:[
				I('trackClue',300,800,70,70,{idx:0,name:'Footprint'}),
				I('trackClue',640,690,70,70,{idx:1,name:'Broken branch'}),
				I('trackClue',1280,690,70,70,{idx:2,name:'Bent grass'}),
				I('trackClue',1580,800,70,70,{idx:3,name:'Claw mark'}),
				I('predatorNest',930,690,240,120,{name:'Raptor Nest',reward:'predator'}),
			],
			clearZone:{x:1770,y:760,w:280,h:300},
		}),

		R('jg_spider_hatchery', 'spiderHatchery', 'event', [1,2,3], 2140, 1120, 'Silk Hatchery', {
			objective:'PASS THE NEST — OR TEAR THE SILK', clearMode:'traverse', noCombat:true,
			cells:[A(0,300,2140,820),A(280,80,1580,260)],
			solids:[M(0,940,260,180),M(1880,940,260,180),M(860,800,420,140)],
			ports:{left:{y:810,h:220},right:{y:810,h:220},top:{x:950,w:240},bottom:{x:950,w:240}},
			platforms:[P('static',240,880,280),P('static',580,760,240),P('static',1320,760,240),P('static',1620,880,280)],
			props:[
				D('jgWebCanopy',180,80,{w:1780,h:420}),
				D('jgEggSac',620,640,{w:160,h:150}),
				D('jgEggSac',1360,640,{w:160,h:150}),
				D('jgNest',860,690,{w:420,h:160,large:true}),
				D('jgWarningBones',400,860,{w:200,h:70}),
				D('jgWarningBones',1540,860,{w:200,h:70}),
				D('jgCaveMist',200,780,{w:1740,h:220}),
			],
			interactables:[
				I('jungleTrap',940,690,260,130,{
					name:'Silk Nest',trapKind:'spiderNest',
					pack:['caveSpider','caveSpider','caveSpider','vineCrawler'],
					ambushBanner:'THE NEST HATCHES — spiders pour from the silk.',
				}),
				I('jungleTrap',640,680,120,100,{
					name:'Egg Sac',trapKind:'spiderNest',touchTrigger:true,
					pack:['caveSpider','caveSpider','caveSpider'],
					ambushBanner:'YOU BRUSHED AN EGG SAC — the brood wakes.',
				}),
				I('jungleTrap',1380,680,120,100,{
					name:'Egg Sac',trapKind:'spiderNest',touchTrigger:true,
					pack:['caveSpider','caveSpider','vineCrawler'],
					ambushBanner:'THE SAC SPLITS — something was waiting inside.',
				}),
			],
			clearZone:{x:1800,y:760,w:280,h:300},
		}),

		R('jg_false_offerings', 'falseOfferings', 'event', [2,3,4], 2060, 1080, 'The Three Offerings', {
			objective:'FOLLOW THE TRAIL — THE HONEST GIFT LEAVES SIGNS', clearMode:'puzzle', noCombat:true,
			cells:[A(0,280,2060,800),A(300,80,1460,240)],
			solids:[M(0,900,240,180),M(1820,900,240,180)],
			ports:{left:{y:770,h:220},right:{y:770,h:220},top:{x:910,w:240},bottom:{x:910,w:240}},
			platforms:[P('static',220,850,280),P('static',620,760,240),P('static',910,700,240),P('static',1200,760,240),P('static',1560,850,280)],
			props:[
				D('jgOfferingAltar',360,620,{w:1340,h:280}),
				D('jgGiantFlower',430,680,{w:150,h:170,glow:true}),
				D('jgTreasureGlow',980,620,{r:160}),
				D('jgForgottenShrine',880,430,{w:300,h:220}),
				D('jgSuspiciousEyes',280,380,{w:140,h:60}),
				D('jgSuspiciousEyes',1640,380,{w:140,h:60}),
				D('jgQuietMist',220,760,{w:1620,h:200}),
			],
			puzzle:{type:'mini',mini:'predatorTrack'},
			interactables:[
				I('trackClue',250,780,70,70,{idx:0,name:'Footprint'}),
				I('trackClue',650,690,70,70,{idx:1,name:'Broken branch'}),
				I('trackClue',940,630,70,70,{idx:2,name:'Bent grass'}),
				I('trackClue',1230,690,70,70,{idx:3,name:'Fur'}),
				I('trackClue',1590,780,70,70,{idx:4,name:'Claw mark'}),
				I('jungleCache',980,620,110,80,{name:'Humble Cache',rare:true,_locked:true,_lockTag:'main'}),
			],
			clearZone:{x:1720,y:730,w:280,h:300},
		}),

		R('jg_blooming_chamber', 'flowerPuzzle', 'puzzle', [2,4], 2280, 1220, 'Blooming Chamber', {
			objective:'TOUCH EACH FLOWER WHILE IT IS OPEN', clearMode:'puzzle',
			cells:[A(0,340,2280,880),A(260,100,1760,280)],
			solids:[M(0,1020,260,200),M(2020,1020,260,200),M(940,820,400,180)],
			ports:{left:{y:880,h:220},right:{y:880,h:220},top:{x:1030,w:240},bottom:{x:420,w:240}},
			platforms:[
				P('static',260,950,260),P('static',650,830,240),P('static',1010,820,220),P('growth',1010,760,260,{growthId:'bloom_lift',hidden:true}),
				P('static',1390,830,240),P('static',1760,950,260),
			],
			hazards:[
				H('poisonFlower',510,850,120,100,{manual:true,group:'flowerFail'}),
				H('poisonFlower',1610,850,120,100,{manual:true,group:'flowerFail'}),
			],
			props:[
				D('jgGiantFlower',980,590,{w:320,h:260,glow:true}),
				D('jgFlowerField',260,880,{w:1760,h:200}),
				D('jgLightShaft',930,90,{w:420,h:570,alpha:0.2}),
			],
			puzzle:{type:'mini',mini:'flowerTiming',group:'flowers',failHazard:'flowerFail',growthId:'bloom_lift'},
			interactables:[
				I('flowerNode',430,850,100,100,{group:'flowers',idx:0,color:'#ef7b73',name:'Ember Bloom'}),
				I('flowerNode',790,760,100,100,{group:'flowers',idx:1,color:'#e8d75a',name:'Sun Bloom'}),
				I('flowerNode',1070,720,100,100,{group:'flowers',idx:2,color:'#86e67b',name:'Grove Bloom'}),
				I('flowerNode',1390,760,100,100,{group:'flowers',idx:3,color:'#71d6ef',name:'Rain Bloom'}),
				I('flowerNode',1750,850,100,100,{group:'flowers',idx:4,color:'#c084ed',name:'Moon Bloom'}),
			],
		}),

		R('jg_giant_flower_field', 'flowerField', 'combat', [2,4], 2380, 1260, 'Giant Flower Field', {
			objective:'DEFEAT THE BLOOM GUARDIANS — USE THE FLOWERS TO REPOSITION', clearMode:'combat',
			cells:[A(0,380,2380,880),A(300,100,1780,320)],
			solids:[M(0,1060,260,200),M(2120,1060,260,200)],
			ports:{left:{y:920,h:220},right:{y:920,h:220},top:{x:1060,w:260}},
			platforms:[P('static',260,980,240),P('static',860,810,200),P('static',1250,690,200),P('static',1620,840,200),P('static',1860,980,260)],
			hazards:[
				H('bounceMushroom',510,970,180,80,{lift:16,flower:true}),
				H('bounceMushroom',860,810,180,80,{lift:17,flower:true}),
				H('bounceMushroom',1250,690,180,80,{lift:17,flower:true}),
				H('bounceMushroom',1620,840,180,80,{lift:16,flower:true}),
				H('poisonFlower',1060,1000,130,100,{period:290,phase:80}),
			],
			props:[
				D('jgFlowerField',260,600,{w:1860,h:460,giant:true}),
				D('jgButterflies',400,280,{w:1500,h:500}),
				D('jgDistantTree',700,100,{w:980,h:800,alpha:0.42}),
			],
			spawns:[
				E(580,860,'glowBeetle'),
				E(1160,520,'willowWisp'),
				E(1760,830,'sporeFungus'),
			],
			puzzle:{type:'mini',mini:'flowerTiming',group:'fieldFlowers'},
			interactables:[
				I('flowerNode',280,880,90,90,{group:'fieldFlowers',idx:0,color:'#ef7b73',name:'Ember Bloom'}),
				I('flowerNode',900,720,90,90,{group:'fieldFlowers',idx:1,color:'#e8d75a',name:'Sun Bloom'}),
				I('flowerNode',1280,600,90,90,{group:'fieldFlowers',idx:2,color:'#71d6ef',name:'Rain Bloom'}),
				I('flowerNode',1640,750,90,90,{group:'fieldFlowers',idx:3,color:'#c084ed',name:'Moon Bloom'}),
				I('flowerNode',1900,880,90,90,{group:'fieldFlowers',idx:4,color:'#86e67b',name:'Grove Bloom'}),
				I('cache',1960,910,80,70,{name:'Bloom Cache',_mainCache:true,_locked:true,_lootTier:'challenge'}),
			],
			clearZone:{x:1960,y:870,w:300,h:340},
		}),

		R('jg_poisoned_garden', 'poisonGarden', 'combat', [2,4], 2260, 1140, 'Poisoned Garden', {
			objective:'WATCH THE SPORES — TOUCH THE SAFE BLOOMS', clearMode:'puzzle',
			cells:[A(0,320,2260,820),A(260,100,1740,260)],
			solids:[M(0,950,240,190),M(2020,950,240,190),M(920,820,420,130)],
			ports:{left:{y:820,h:220},right:{y:820,h:220},bottom:{x:1010,w:240}},
			platforms:[P('static',240,900,260),P('static',640,800,220),P('static',1020,760,220),P('static',1400,800,220),P('static',1760,900,260)],
			hazards:[
				H('poisonFlower',430,800,160,130,{period:260,phase:0,cloudR:180}),
				H('poisonFlower',920,720,160,130,{period:260,phase:86,cloudR:180}),
				H('poisonFlower',1430,760,160,130,{period:260,phase:172,cloudR:180}),
				H('poisonFlower',1810,850,140,110,{period:260,phase:215,cloudR:150}),
				H('rootSnare',720,860,110,80,{period:200,phase:40}),
				H('rootSnare',1540,860,110,80,{period:200,phase:140}),
				H('sporePocket',1100,820,90,90,{triggerR:130}),
			],
			props:[
				D('jgPoisonGarden',240,650,{w:1780,h:300}),
				D('jgCleanAir',620,690,{r:130}),D('jgCleanAir',1270,660,{r:130}),D('jgCleanAir',1900,790,{r:110}),
				D('jgWarningMask',1040,540,{w:160,h:120}),
			],
			spawns:[
				E(600,710,'vineCrawler'),
				E(1210,540,'mossWraith'),
				E(1780,720,'rockGolem'),
				E(900,780,'caveSpider'),
				E(1500,780,'thornWolf'),
			],
			puzzle:{type:'mini',mini:'sporeId',group:'spores',failHazard:null},
			interactables:[
				I('sporeFlower',280,820,80,80,{group:'spores',idx:0,_color:'blue',name:'Azure Bloom'}),
				I('sporeFlower',680,720,80,80,{group:'spores',idx:1,_color:'purple',name:'Violet Bloom'}),
				I('sporeFlower',1060,680,80,80,{group:'spores',idx:2,_color:'green',name:'Verdant Bloom'}),
				I('sporeFlower',1440,720,80,80,{group:'spores',idx:3,_color:'blue',name:'Rain Bloom'}),
				I('sporeFlower',1800,820,80,80,{group:'spores',idx:4,_color:'green',name:'Grove Bloom'}),
			],
			clearZone:{x:1900,y:790,w:300,h:300},
		}),

		R('jg_jungle_flood', 'floodTrap', 'trap', [2,4], 2260, 1500, 'The Jungle Flood', {
			objective:'READ THE CURRENT — GUIDE THE SEED WHILE THE WATER RISES', clearMode:'puzzle',
			cells:[A(0,640,2260,860),A(260,300,1740,380),A(760,80,740,260)],
			solids:[M(0,1300,300,200),M(1960,1300,300,200)],
			ports:{left:{y:1160,h:220},right:{y:1120,h:220},top:{x:1010,w:240}},
			platforms:[
				P('static',280,1180,260),P('static',650,1030,220),P('static',1040,870,220),
				P('static',1430,710,220),P('static',1740,1080,240),
			],
			hazards:[H('flood',260,1260,1740,220,{y0:1260,y1:520,speed:0.7,armed:true})],
			props:[
				D('jgFloodedTemple',650,470,{w:960,h:610}),
				D('jgWaterMarks',1660,560,{w:190,h:550}),
				D('jgDrainGate',960,300,{w:340,h:250}),
				D('jgHangingVines',300,260,{w:1600,h:320}),
			],
			puzzle:{type:'mini',mini:'currentRead'},
			interactables:[
				I('drainLever',1080,430,90,120,{name:'Ancient Drain',solves:true}),
				I('puzzleBoard',1740,1000,90,80,{name:'Root Gates'}),
				I('waterWheel',680,950,80,130,{name:'West Gate'}),
				I('waterWheel',1460,640,80,130,{name:'East Gate'}),
			],
		}),

		R('jg_hidden_root_cave', 'secretCave', 'secret', [2,4], 1740, 960, 'Hidden Root Cave', {
			objective:'CUT THE HEART ROOT BEFORE THE TANGLE GROWS BACK', clearMode:'puzzle', optional:true, secret:true,
			cells:[A(0,280,1740,680),A(280,80,1160,240)],
			solids:[M(0,800,220,160),M(1520,800,220,160)],
			ports:{left:{y:650,h:220}},
			platforms:[P('static',220,760,260),P('static',590,650,560),P('static',1260,760,250)],
			props:[
				D('jgRootHeartSmall',720,430,{w:300,h:240}),
				D('jgGlowMushrooms',330,690,{w:320,h:100}),
				D('jgGlowMushrooms',1090,680,{w:330,h:110}),
				D('jgTreasureGlow',760,560,{r:180}),
			],
			puzzle:{type:'mini',mini:'rootCut'},
			interactables:[
				I('rootStrand',700,520,80,180,{tier:'main',idx:0,name:'Heart Root'}),
				I('rootStrand',820,560,70,150,{tier:'sec',idx:1,name:'Branch Root'}),
				I('rootStrand',940,580,70,140,{tier:'sec',idx:2,name:'Branch Root'}),
				I('rootStrand',1060,620,60,110,{tier:'thin',idx:3,name:'Tendril'}),
				I('jungleCache',800,610,110,80,{name:'Root-hidden Cache',rare:true,_locked:true,_lockTag:'main'}),
			],
		}),

		R('jg_predator_nest', 'secretElite', 'secretElite', [2,3], 1980, 1080, 'Predator Nest', {
			objective:'DEFEAT THE NEST GUARDIANS', clearMode:'combat', optional:true, secret:true, elite:true,
			cells:[A(0,300,1980,780),A(300,100,1380,240)],
			solids:[M(0,900,240,180),M(1740,900,240,180)],
			ports:{left:{y:770,h:220}},
			platforms:[P('static',240,850,280),P('static',610,730,260),P('static',1080,730,260),P('static',1460,850,260)],
			hazards:[H('fallingBranch',760,270,320,42,{impactY:850,period:240,phase:70})],
			props:[
				D('jgNest',690,660,{w:600,h:180,large:true}),
				D('jgBones',300,790,{w:280,h:100}),D('jgBones',1390,790,{w:280,h:100}),
				D('jgTreasureGlow',920,630,{r:230}),
			],
			puzzle:{type:'mini',mini:'predatorTrack'},
			interactables:[
				I('trackClue',280,780,70,70,{idx:0,name:'Footprint'}),
				I('trackClue',640,660,70,70,{idx:1,name:'Broken branch'}),
				I('trackClue',1120,660,70,70,{idx:2,name:'Bent grass'}),
				I('trackClue',1500,780,70,70,{idx:3,name:'Claw mark'}),
				I('jungleCache',920,720,110,80,{name:'Predator Hoard',rare:true,lockedByCombat:true}),
			],
			spawns:[E(520,760,'thornWolf',{elite:true}),E(1000,700,'mossWraith',{elite:true}),E(1460,760,'thornWolf',{elite:true})],
		}),

		R('jg_ancient_vault', 'vault', 'vault', [2,4], 2040, 1120, 'Ancient Jungle Vault', {
			objective:'MAKE THE GUARDIAN BEAMS MEET THE LIVING SYMBOLS', clearMode:'puzzle', optional:true,
			cells:[A(0,300,2040,820),A(300,80,1440,260)],
			solids:[M(0,940,260,180),M(1780,940,260,180),M(820,770,400,170)],
			ports:{left:{y:810,h:220},right:{y:810,h:220},top:{x:900,w:240}},
			platforms:[P('static',260,880,280),P('static',650,760,240),P('static',1160,760,240),P('static',1500,880,280)],
			hazards:[
				H('rootCrusher',520,430,190,460,{period:250,phase:30}),
				H('rootCrusher',1330,430,190,460,{period:250,phase:155}),
			],
			props:[
				D('jgVaultDoor',800,440,{w:440,h:350}),
				D('jgGuardianStatue',420,650,{w:140,h:230}),D('jgGuardianStatue',1480,650,{w:140,h:230}),
				D('jgTreasureGlow',900,570,{r:220}),
			],
			puzzle:{type:'mini',mini:'statueGaze',nextMini:'rootGrid',group:'vaultStatues',needHits:3},
			interactables:[
				I('statueNode',320,680,120,170,{group:'vaultStatues',idx:0,states:5,state:0,name:'Jaguar Guardian'}),
				I('statueNode',700,680,120,170,{group:'vaultStatues',idx:1,states:5,state:0,name:'Ibis Guardian'}),
				I('statueNode',1220,680,120,170,{group:'vaultStatues',idx:2,states:5,state:0,name:'Serpent Guardian'}),
				I('statueNode',1580,680,120,170,{group:'vaultStatues',idx:3,states:5,state:0,name:'Root Guardian'}),
				I('puzzleBoard',940,620,90,80,{name:'Root Lattice',group:'vaultGrid'}),
				I('jungleVault',940,650,140,100,{name:'Worldroot Reliquary',locked:true}),
			],
		}),

		/* ================= REGION 3 — THE CANOPY ================= */
		R('jg_ancient_tree_interior', 'treeInterior', 'traversal', [3], 2240, 1720, 'Ancient Tree Interior', {
			objective:'CLIMB THE HOLLOW HEARTWOOD', clearMode:'traverse',
			cells:[A(420,0,1400,1720),A(0,1220,2240,500),A(180,700,1880,560)],
			solids:[M(0,1500,420,220),M(1820,1480,420,240),M(900,1180,440,160)],
			ports:{left:{y:1380,h:220},right:{y:1360,h:220},top:{x:1000,w:240},bottom:{x:1000,w:240}},
			platforms:[
				P('static',470,1450,300,{branch:true}),P('static',970,1290,280,{branch:true}),P('static',1420,1110,280,{branch:true}),
				P('static',910,920,260,{branch:true}),P('static',510,730,260,{branch:true}),P('static',1040,540,260,{branch:true}),
				P('static',1430,350,250,{branch:true}),P('static',980,180,260,{branch:true}),
			],
			hazards:[
				H('swingingVine',760,180,24,620,{length:580,period:240,phase:30}),
				H('swingingVine',1490,80,24,720,{length:660,period:290,phase:160}),
				H('bounceMushroom',870,860,140,70,{lift:16}),
			],
			props:[
				D('jgHeartwoodRings',770,440,{w:720,h:700}),
				D('jgGlowMushrooms',420,1390,{w:360,h:110}),
				D('jgGlowMushrooms',1390,1050,{w:330,h:110}),
				D('jgSapGlow',1050,180,{w:120,h:1120}),
			],
			clearZone:{x:870,y:40,w:500,h:240},
		}),

		R('jg_canopy_crossing', 'canopyCrossing', 'traversal', [3], 2400, 1420, 'Canopy Crossing', {
			objective:'CROSS THE HIGH BRANCHES', clearMode:'traverse',
			cells:[A(0,440,2400,980),A(280,180,1840,300)],
			solids:[M(0,1190,300,230),M(2100,1190,300,230)],
			ports:{left:{y:1060,h:220},right:{y:1040,h:220},top:{x:1080,w:240},bottom:{x:440,w:240}},
			platforms:[
				P('static',260,1110,360,{branch:true}),P('collapse',720,950,280,{life:110,branch:true}),
				P('static',1110,780,300,{branch:true}),P('collapse',1510,920,280,{life:100,branch:true}),
				P('static',1900,1090,260,{branch:true}),
			],
			hazards:[
				H('windGust',560,520,1320,680,{dir:1,period:300,phase:60}),
				H('fallingBranch',1040,300,300,42,{impactY:1080,period:310,phase:150}),
			],
			props:[
				D('jgCanopyVista',0,140,{w:2400,h:1180}),
				D('jgBranchNetwork',180,700,{w:2040,h:520}),
				D('jgDistantWaterfall',1760,0,{w:240,h:1100,alpha:0.42}),
				D('jgCanopyMist',0,940,{w:2400,h:480}),
				D('jgBirdFlock',700,250,{w:900,h:260}),
			],
			spawns:[E(650,640,'stalactiteBat'),E(1190,620,'pollenMoth'),E(1710,700,'jungleChameleon')],
			clearZone:{x:2070,y:980,w:280,h:340},
		}),

		R('jg_vine_bridge', 'vineBridge', 'traversal', [3], 2760, 1880, 'Vine Bridge', {
			objective:'GRAB, SWING, RELEASE — LAND ON THE FAR ROOT', clearMode:'puzzle',
			cells:[A(0,520,2760,1360),A(240,160,2280,400)],
			solids:[M(0,1640,380,240),M(2380,1640,380,240)],
			ports:{left:{y:1480,h:220},right:{y:1480,h:220},bottom:{x:1260,w:240}},
			platforms:[
				P('static',280,1480,240),
				P('collapse',560,1420,220,{life:70,vineBridge:true}),
				P('collapse',820,1360,220,{life:58,vineBridge:true}),
				P('collapse',1080,1300,220,{life:64,vineBridge:true}),
				P('collapse',1340,1240,220,{life:50,vineBridge:true}),
				P('collapse',1600,1300,220,{life:60,vineBridge:true}),
				P('collapse',1860,1360,220,{life:54,vineBridge:true}),
				P('collapse',2120,1420,220,{life:66,vineBridge:true}),
				P('static',2360,1480,240),
			],
			hazards:[
				H('swingingVine',640,200,24,720,{length:640,period:190,phase:10}),
				H('swingingVine',980,180,24,780,{length:700,period:210,phase:70}),
				H('swingingVine',1380,160,24,820,{length:740,period:180,phase:130}),
				H('swingingVine',1780,190,24,760,{length:680,period:200,phase:40}),
				H('swingingVine',2140,210,24,700,{length:620,period:220,phase:160}),
				H('fallingBranch',720,60,280,44,{impactY:1680,period:150,phase:0}),
				H('fallingBranch',1240,40,300,44,{impactY:1680,period:140,phase:50}),
				H('fallingBranch',1760,50,280,44,{impactY:1680,period:155,phase:95}),
				H('rootSnare',900,1600,120,80,{period:170,phase:20}),
				H('rootSnare',1500,1600,120,80,{period:170,phase:90}),
				H('rootSnare',2000,1600,120,80,{period:170,phase:140}),
			],
			props:[
				D('jgVineBridge',480,1220,{w:1800,h:180}),
				D('jgCanopyDrop',400,1520,{w:1960,h:360}),
				D('jgHangingVines',260,160,{w:2240,h:420}),
			],
			puzzle:{type:'mini',mini:'vineSwing'},
			spawns:[
				E(620,1560,'vineCrawler'),E(980,1560,'vineCrawler'),E(1340,1560,'vineCrawler'),
				E(1700,1560,'vineCrawler'),E(2060,1560,'vineCrawler'),
			],
			clearZone:{x:2380,y:1360,w:320,h:360},
		}),
		R('jg_falling_canopy', 'fallingCanopy', 'trap', [3], 2280, 1340, 'Falling Canopy', {
			objective:'WATCH THE LIVING BOUGHS — STAND ON THEM WHEN THE CANOPY FALLS', clearMode:'puzzle',
			cells:[A(0,420,2280,920),A(260,120,1760,340)],
			solids:[M(0,1120,260,220),M(2020,1120,260,220)],
			ports:{left:{y:980,h:220},right:{y:980,h:220},bottom:{x:1010,w:240}},
			platforms:[P('static',260,1050,280),P('static',650,930,250),P('static',1030,820,250),P('static',1410,930,250),P('static',1740,1050,280)],
			hazards:[
				H('fallingBranch',280,40,320,48,{impactY:1220,period:145,phase:0}),
				H('fallingBranch',680,50,340,48,{impactY:1220,period:135,phase:40}),
				H('fallingBranch',1100,30,320,48,{impactY:1220,period:150,phase:80}),
				H('fallingBranch',1520,45,360,48,{impactY:1220,period:140,phase:115}),
				H('fallingBranch',1880,35,300,48,{impactY:1220,period:155,phase:20}),
			],
			props:[
				D('jgCrackingCanopy',220,120,{w:1840,h:280}),
				D('jgBranchNetwork',220,720,{w:1840,h:430}),
				D('jgCanopyMist',0,980,{w:2280,h:360}),
			],
			puzzle:{type:'mini',mini:'branchMemory'},
			spawns:[
				E(1130,570,'skyVine'),
				E(1740,670,'windSylph'),
			],
			clearZone:{x:1890,y:920,w:320,h:340},
		}),

		R('jg_thorn_corridor', 'thornCorridor', 'trap', [3,4], 2140, 980, 'Thorn Corridor', {
			objective:'PASS THROUGH THE MOVING SAFE GAPS', clearMode:'traverse',
			cells:[A(0,260,2140,720),A(240,80,1660,220)],
			solids:[M(0,820,220,160),M(1920,820,220,160)],
			ports:{left:{y:680,h:220},right:{y:680,h:220}},
			platforms:[P('static',180,780,1780)],
			hazards:[
				H('thornWall',280,300,100,480,{period:200,phase:0,gapY:600,gapH:120}),
				H('thornWall',520,300,100,480,{period:200,phase:36,gapY:460,gapH:120}),
				H('thornWall',760,300,100,480,{period:200,phase:72,gapY:600,gapH:120}),
				H('thornWall',1000,300,100,480,{period:200,phase:108,gapY:460,gapH:120}),
				H('thornWall',1240,300,100,480,{period:200,phase:144,gapY:600,gapH:120}),
				H('thornWall',1480,300,100,480,{period:200,phase:180,gapY:460,gapH:120}),
				H('thornWall',1720,300,100,480,{period:200,phase:20,gapY:600,gapH:120}),
			],
			props:[
				D('jgThornTunnel',180,260,{w:1780,h:540}),
				D('jgSafeGapClue',260,240,{points:[600,460,600,460,600,460,600]}),
				D('jgWarningBones',960,730,{w:240,h:70}),
			],
			spawns:[
				E(400,700,'barkbackBeetle'),E(860,700,'pollenMoth'),
				E(1280,700,'rootParasite'),E(1640,700,'jungleChameleon'),
			],
			clearZone:{x:1810,y:630,w:280,h:300},
		}),

		R('jg_canopy_ruins', 'sunPuzzle', 'puzzle', [3], 2300, 1420, 'Canopy Ruins', {
			objective:'BEND SUNLIGHT INTO THE WAITING CRYSTAL', clearMode:'puzzle',
			cells:[A(0,480,2300,940),A(260,180,1780,340),A(820,40,660,180)],
			solids:[M(0,1190,280,230),M(2020,1170,280,250),M(930,950,440,180)],
			ports:{left:{y:1060,h:220},right:{y:1040,h:220},top:{x:1030,w:240},bottom:{x:420,w:240}},
			platforms:[
				P('static',260,1110,300),P('static',650,950,240),
				P('growth',1020,820,260,{growthId:'sun_path',hidden:true}),
				P('growth',1360,720,260,{growthId:'sun_path',hidden:true}),
				P('static',1740,1080,300),
			],
			props:[
				D('jgCanopyTemple',520,430,{w:1260,h:650}),
				D('jgSunBeam',1040,20,{w:220,h:1020,angle:0.12}),
				D('jgSunMirror',570,870,{w:110,h:150}),D('jgSunMirror',1090,760,{w:110,h:150}),D('jgSunMirror',1660,910,{w:110,h:150}),
				D('jgMirrorClue',860,470,{targets:[1,3,2]}),
			],
			puzzle:{type:'mini',mini:'sunMirror',group:'sunMirrors',growthId:'sun_path',mastery:true},
			interactables:[
				I('sunMirror',570,880,100,130,{group:'sunMirrors',idx:0,states:2,state:0,name:'Dawn Mirror'}),
				I('sunMirror',1090,770,100,130,{group:'sunMirrors',idx:1,states:2,state:0,name:'Zenith Mirror'}),
				I('sunMirror',1660,920,100,130,{group:'sunMirrors',idx:2,states:2,state:0,name:'Dusk Mirror'}),
				I('puzzleBoard',1080,700,90,80,{name:'Sun Table'}),
				I('jungleCache',1180,740,90,70,{name:'Sunlit Cache',rare:true,_sunlit:true,_locked:true,_lockTag:'sunlit'}),
			],
		}),

		R('jg_giant_tree_ascent', 'spectacle', 'spectacle', [3], 3100, 1960, 'The World Above the World', {
			objective:'ASCEND THE GIANT TREE', clearMode:'traverse', spectacle:true,
			cells:[A(0,1100,3100,860),A(280,620,2540,520),A(660,240,1780,420),A(1240,0,620,280)],
			solids:[M(0,1710,460,250),M(2640,1690,460,270),M(1320,1380,460,200)],
			ports:{left:{y:1580,h:240},right:{y:1540,h:240},top:{x:1430,w:260},bottom:{x:520,w:260}},
			platforms:[
				P('static',420,1600,340,{branch:true}),P('static',900,1430,300,{branch:true}),
				P('static',1480,1240,340,{branch:true}),P('static',2080,1420,300,{branch:true}),
				P('static',2460,1190,260,{branch:true}),P('static',1980,980,300,{branch:true}),
				P('static',1420,790,320,{branch:true}),P('static',820,620,300,{branch:true}),
				P('static',1280,430,260,{branch:true}),P('static',1380,300,280,{branch:true}),
				P('static',1460,160,240,{branch:true}),
				P('move',560,1260,300,{axis:'y',dist:220,spd:1.0,homeX:560,homeY:1260}),
			],
			hazards:[
				H('windGust',420,580,2200,980,{dir:-1,period:360,phase:90}),
				H('swingingVine',1080,170,26,850,{length:780,period:300,phase:30}),
				H('swingingVine',2230,330,26,720,{length:650,period:260,phase:150}),
				H('fallingBranch',1680,0,280,44,{impactY:820,period:280,phase:70}),
			],
			props:[
				D('jgSpectacleCavern',0,0,{w:3100,h:1960}),
				D('jgGiantTree',1110,-80,{w:900,h:1900,ancient:true}),
				D('jgDistantWaterfall',160,120,{w:340,h:1500,alpha:0.52}),
				D('jgDistantWaterfall',2720,300,{w:220,h:1250,alpha:0.3}),
				D('jgDistantRuins',260,780,{w:760,h:600,alpha:0.5}),
				D('jgDistantRuins',2160,630,{w:620,h:540,alpha:0.42}),
				D('jgHangingBridge',470,920,{w:720,h:120,alpha:0.45}),
				D('jgCanopyMist',0,1320,{w:3100,h:620}),
				D('jgBiolumeField',280,300,{w:2540,h:1200}),
				D('jgBirdFlock',400,240,{w:2200,h:500}),
			],
			interactables:[],
			spawns:[E(900,1380,'skyVine'),E(2100,1360,'stalactiteBat'),E(1500,740,'windSylph')],
			clearZone:{x:1300,y:20,w:500,h:260},
		}),

		R('jg_collapsing_root_bridge', 'rootBridge', 'traversal', [3,4], 2340, 1240, 'Collapsing Root Bridge', {
			objective:'READ THE CRACKS AND KEEP MOVING', clearMode:'traverse',
			cells:[A(0,380,2340,860),A(260,120,1820,300)],
			solids:[M(0,1000,380,240),M(1960,1000,380,240)],
			ports:{left:{y:880,h:220},right:{y:880,h:220}},
			platforms:[
				P('static',300,920,220,{rootBridge:true}),
				P('collapse',540,890,240,{life:125,rootBridge:true,crackLevel:1}),
				P('collapse',800,850,240,{life:90,rootBridge:true,crackLevel:3}),
				P('collapse',1060,830,240,{life:110,rootBridge:true,crackLevel:2}),
				P('collapse',1320,850,240,{life:80,rootBridge:true,crackLevel:3}),
				P('collapse',1580,890,240,{life:125,rootBridge:true,crackLevel:1}),
				P('static',1820,920,220,{rootBridge:true}),
			],
			props:[
				D('jgRootBridge',380,800,{w:1580,h:180,cracked:true}),
				D('jgCanopyDrop',360,950,{w:1620,h:290}),
				D('jgCrackClues',520,810,{levels:[1,3,2,3,1]}),
				D('jgHangingVines',300,140,{w:1740,h:330}),
			],
			clearZone:{x:1990,y:820,w:290,h:340},
		}),

		R('jg_root_chasm', 'rootChasm', 'traversal', [3,4], 2480, 1540, 'Root Chasm', {
			objective:'GRAB, SWING, RELEASE — THE LOWER ROUTE HIDES TREASURE', clearMode:'puzzle',
			cells:[A(0,620,2480,920),A(260,280,1960,380),A(860,80,760,240)],
			solids:[M(0,1300,420,240),M(2060,1280,420,260)],
			ports:{left:{y:1160,h:220},right:{y:1140,h:220},top:{x:1120,w:240},bottom:{x:1120,w:240}},
			platforms:[
				P('static',360,1190,280),P('static',720,990,220),P('static',1110,820,260),
				P('static',1530,990,220),P('static',1870,1190,250),
				P('collapse',830,1260,260,{life:150,lowerRoute:true}),P('collapse',1390,1280,260,{life:130,lowerRoute:true}),
			],
			hazards:[
				H('swingingVine',970,210,24,640,{length:580,period:240,phase:20}),
				H('swingingVine',1560,190,24,700,{length:640,period:280,phase:145}),
				H('windGust',620,540,1260,700,{dir:1,period:320,phase:70}),
			],
			props:[
				D('jgRootChasm',360,520,{w:1760,h:900}),
				D('jgDistantRuins',700,760,{w:1080,h:500,alpha:0.35}),
				D('jgTreasureGlow',1180,1200,{r:160}),
				D('jgCanopyMist',260,1140,{w:1960,h:400}),
			],
			puzzle:{type:'mini',mini:'vineSwing'},
			interactables:[I('jungleCache',1170,1240,110,80,{name:'Chasm Cache',rare:true})],
			clearZone:{x:2110,y:1080,w:300,h:370},
		}),

		R('jg_canopy_hideout', 'canopyHideout', 'secret', [3], 1720, 980, 'Canopy Hideout', {
			objective:'SEARCH THE ABANDONED HIDEOUT', clearMode:'interact', optional:true, secret:true,
			cells:[A(0,300,1720,680),A(300,80,1120,260)],
			solids:[M(0,820,240,160),M(1480,820,240,160)],
			ports:{left:{y:690,h:220},right:{y:690,h:220},bottom:{x:740,w:240}},
			platforms:[P('static',220,780,300),P('static',620,650,480),P('static',1210,780,280)],
			props:[
				D('jgCanopyHut',550,380,{w:620,h:300}),
				D('jgRopeBundles',340,700,{w:230,h:90}),
				D('jgDistantVista',180,230,{w:1350,h:520}),
				D('jgTreasureGlow',810,590,{r:160}),
			],
			interactables:[
				I('jungleCache',820,610,110,80,{name:'Explorer’s Stash',rare:true}),
				I('jungleMemory',1130,650,80,80,{name:'Weathered Journal',lore:'The canopy paths move after rain. Mark the trees, not the bridges.'}),
			],
		}),

		R('jg_secret_elite_arena', 'secretElite', 'secretElite', [3,4], 2080, 1160, 'Hidden Hunting Ground', {
			objective:'DEFEAT THE HIDDEN PREDATORS', clearMode:'combat', optional:true, secret:true, elite:true,
			cells:[A(0,340,2080,820),A(280,100,1520,280)],
			solids:[M(0,980,240,180),M(1840,980,240,180),M(830,820,420,160)],
			ports:{left:{y:840,h:220},right:{y:840,h:220},top:{x:900,w:240}},
			platforms:[P('static',240,920,280),P('static',620,780,260),P('static',1200,780,260),P('static',1560,920,280)],
			hazards:[
				H('rootSnare',520,850,110,80,{period:200,phase:30}),
				H('rootSnare',1450,850,110,80,{period:200,phase:130}),
				H('fallingBranch',900,250,300,44,{impactY:900,period:260,phase:90}),
			],
			props:[
				D('jgHuntingTotems',310,620,{w:1460,h:300}),
				D('jgWarningBones',760,850,{w:560,h:100}),
				D('jgTreasureGlow',980,720,{r:220}),
				D('jgSuspiciousEyes',410,430,{w:140,h:60}),D('jgSuspiciousEyes',1520,430,{w:140,h:60}),
			],
			interactables:[I('jungleCache',990,790,110,80,{name:'Hunter’s Tribute',rare:true,lockedByCombat:true})],
			spawns:[E(500,820,'thornWolf',{elite:true}),E(1000,720,'windSylph',{elite:true}),E(1510,820,'mossWraith',{elite:true})],
		}),

		/* ================= REGION 4 — THE ANCIENT GROVE ================= */
		R('jg_sacred_grove', 'sacredGrove', 'shrine', [4], 2140, 1200, 'Sacred Grove', {
			objective:'REST — OR WAKE THE GROVE’S GUARDIAN', clearMode:'interact', optional:true, noCombat:true,
			cells:[A(0,340,2140,860),A(280,100,1580,280)],
			solids:[M(0,1010,260,190),M(1880,1010,260,190)],
			ports:{left:{y:870,h:220},right:{y:870,h:220},top:{x:950,w:240},bottom:{x:950,w:240}},
			platforms:[P('static',260,950,300),P('static',650,820,840),P('static',1580,950,300)],
			props:[
				D('jgSacredTree',820,280,{w:500,h:550,glow:true}),
				D('jgGiantFlower',430,780,{w:180,h:180,glow:true}),
				D('jgGiantFlower',1530,780,{w:180,h:180,glow:true}),
				D('jgFireflies',280,300,{w:1580,h:600}),
			],
			interactables:[
				I('jungleShrine',980,750,160,120,{name:'Heartwood Shrine',rare:true}),
				I('sacredOffering',500,820,110,90,{name:'Untouched Offering',risk:true}),
			],
		}),

		R('jg_ancient_grove_mechanism', 'ecosystemPuzzle', 'puzzle', [4], 2500, 1500, 'Ancient Grove Mechanism', {
			objective:'ROUTE THE WATER, THEN WAKE THE ROOT LATTICE', clearMode:'puzzle',
			cells:[A(0,580,2500,920),A(260,260,1980,360),A(900,60,700,240)],
			solids:[M(0,1280,300,220),M(2200,1280,300,220),M(990,1040,520,190)],
			ports:{left:{y:1140,h:220},right:{y:1120,h:220},top:{x:1130,w:240},bottom:{x:480,w:240}},
			platforms:[
				P('static',300,1190,280),P('static',700,1040,230),
				P('growth',1050,870,400,{growthId:'ecosystem_vine',hidden:true}),
				P('growth',1560,720,300,{growthId:'ecosystem_vine',hidden:true}),
				P('static',1900,1140,300),
			],
			hazards:[
				H('water',300,1250,1900,250,{current:0.5,deep:true}),
				H('rootCrusher',1850,530,180,610,{manual:true,group:'ecosystemFail'}),
			],
			props:[
				D('jgAncientMechanism',940,500,{w:620,h:470,ancient:true}),
				D('jgWaterChannel',260,1170,{w:650,h:170}),
				D('jgWiltedFlower',850,930,{w:210,h:210,stage:1}),
				D('jgWiltedVines',1350,580,{w:600,h:420,growthId:'ecosystem_vine'}),
				D('jgRootDoor',2040,780,{w:240,h:360}),
				D('jgEcosystemClue',450,500,{steps:['water','flower','vine','door']}),
			],
			puzzle:{type:'mini',mini:'sluiceFlow',nextMini:'rootGrid',group:'groveChain',growthId:'ecosystem_vine',failHazard:'ecosystemFail',combat:true},
			interactables:[
				I('waterWheel',470,1080,100,120,{group:'groveChain',name:'Redirect Water'}),
				I('puzzleBoard',1050,900,100,90,{name:'Root Lattice'}),
				I('ecosystemNode',2080,900,120,150,{group:'groveChain',step:'door',name:'Release the Root Door'}),
			],
		}),

		R('jg_root_heart', 'rootHeart', 'event', [4], 2240, 1320, 'Root Heart', {
			objective:'DECIDE WHAT TO DO WITH THE LIVING HEART', clearMode:'interact',
			cells:[A(0,400,2240,920),A(300,120,1640,320)],
			solids:[M(0,1120,280,200),M(1960,1120,280,200),M(800,940,640,180)],
			ports:{left:{y:980,h:220},right:{y:980,h:220},top:{x:1000,w:240}},
			platforms:[P('static',280,1060,300),P('static',650,900,940),P('static',1660,1060,300)],
			hazards:[H('rootSnare',430,980,120,90,{manual:true,group:'heartAnger'}),H('rootSnare',1690,980,120,90,{manual:true,group:'heartAnger'})],
			props:[
				D('jgRootHeart',820,430,{w:600,h:500,pulse:true}),
				D('jgRootVeins',200,720,{w:1840,h:410}),
				D('jgBiolumeField',300,360,{w:1640,h:660}),
				D('jgMemoryEchoes',520,480,{w:1200,h:460}),
			],
			interactables:[I('jungleChoice',980,790,280,170,{name:'The Root Heart',choiceType:'heart'})],
		}),

		R('jg_forgotten_shrine', 'secretShrine', 'secretShrine', [4], 1760, 1040, 'Forgotten Shrine', {
			objective:'CLAIM THE FORGOTTEN BLESSING', clearMode:'interact', optional:true, secret:true, noCombat:true,
			cells:[A(0,300,1760,740),A(300,80,1160,260)],
			solids:[M(0,880,240,160),M(1520,880,240,160)],
			ports:{left:{y:740,h:220}},
			platforms:[P('static',240,830,280),P('static',600,700,560),P('static',1240,830,280)],
			props:[
				D('jgForgottenShrine',600,390,{w:560,h:320}),
				D('jgSuspiciousRoot',0,670,{w:260,h:220}),
				D('jgFireflies',280,280,{w:1200,h:520}),
				D('jgTreasureGlow',800,580,{r:190}),
			],
			interactables:[I('jungleShrine',810,620,140,110,{name:'Shrine of the First Seed',rare:true})],
		}),

		R('jg_secret_ancient_grove', 'secretGrove', 'secret', [4], 2100, 1240, 'Secret Ancient Grove', {
			objective:'CUT THE HEART ROOT BEFORE THE TANGLE GROWS BACK', clearMode:'puzzle', optional:true, secret:true, noCombat:true,
			cells:[A(0,360,2100,880),A(260,100,1580,300)],
			solids:[M(0,1040,260,200),M(1840,1040,260,200),M(820,880,460,160)],
			ports:{left:{y:900,h:220}},
			platforms:[P('static',260,980,300),P('static',660,850,780),P('static',1540,980,300)],
			hazards:[H('bounceMushroom',470,930,150,70,{lift:14}),H('bounceMushroom',1480,930,150,70,{lift:14})],
			props:[
				D('jgSecretGrove',220,260,{w:1660,h:780}),
				D('jgGiantFlower',850,560,{w:400,h:330,glow:true}),
				D('jgStillPool',600,930,{w:900,h:190}),
				D('jgBiolumeField',260,300,{w:1580,h:680}),
				D('jgButterflies',420,320,{w:1260,h:440}),
			],
			puzzle:{type:'mini',mini:'rootCut'},
			interactables:[
				I('rootStrand',720,520,90,200,{tier:'main',idx:0,name:'Heart Root'}),
				I('rootStrand',880,580,70,150,{tier:'sec',idx:1,name:'Branch Root'}),
				I('rootStrand',1040,600,70,140,{tier:'sec',idx:2,name:'Branch Root'}),
				I('rootStrand',1180,640,60,110,{tier:'thin',idx:3,name:'Tendril'}),
				I('jungleCache',980,760,120,90,{name:'First Seed Reliquary',rare:true,_locked:true,_lockTag:'main'}),
				I('jungleShrine',1270,800,130,100,{name:'Untouched Grove',rare:true}),
			],
		}),

		R('jg_elder_treant_arena', 'miniBoss', 'miniBoss', [3,4], 2600, 1500, 'Grove of the Elder Treant', {
			objective:'DEFEAT THE ELDER TREANT', clearMode:'miniBoss', miniBossType:'elderTreant',
			cells:[A(0,500,2600,1000),A(260,180,2080,360)],
			solids:[M(0,1280,300,220),M(2300,1280,300,220),M(980,1080,640,200)],
			ports:{left:{y:1140,h:240},right:{y:1120,h:240},top:{x:1160,w:260}},
			platforms:[
				P('static',300,1200,320),P('static',720,1040,280),P('static',1160,980,320),
				P('static',1640,1040,280),P('static',1980,1200,320),
			],
			hazards:[
				H('rootSnare',500,1110,120,90,{period:240,phase:20}),
				H('rootSnare',1980,1110,120,90,{period:240,phase:140}),
				H('rootCrusher',760,480,180,560,{period:300,phase:80}),
				H('rootCrusher',1660,480,180,560,{period:300,phase:230}),
			],
			props:[
				D('jgAncientGroveArena',0,220,{w:2600,h:1280}),
				D('jgSacredTree',980,230,{w:640,h:850,ancient:true}),
				D('jgRootVeins',200,920,{w:2200,h:370}),
				D('jgGuardianTotems',380,680,{w:1840,h:400}),
				D('jgFireflies',200,320,{w:2200,h:740}),
			],
			interactables:[I('miniBossStart',1260,870,120,110,{name:'Grove Heart',wake:'elderTreant'})],
			spawns:[E(1230,1040,'elderTreant',{isMiniBoss:true})],
		}),

		R('jg_storm_raptor_roost', 'miniBoss', 'miniBoss', [3,4], 2680, 1580, 'Storm Raptor Roost', {
			objective:'SURVIVE THE HUNT', clearMode:'miniBoss', miniBossType:'stormRaptor',
			cells:[A(0,520,2680,1060),A(260,180,2160,380)],
			solids:[M(0,1330,300,250),M(2380,1330,300,250)],
			ports:{left:{y:1190,h:240},right:{y:1170,h:240},bottom:{x:1210,w:260}},
			platforms:[
				P('static',300,1240,340,{branch:true}),P('static',760,1080,300,{branch:true}),
				P('static',1190,900,300,{branch:true}),P('static',1620,1080,300,{branch:true}),
				P('static',2040,1240,340,{branch:true}),
			],
			hazards:[],
			props:[
				D('jgStormRoost',0,200,{w:2680,h:1380}),
				D('jgNest',1050,780,{w:580,h:180,large:true}),
				D('jgStormClouds',220,120,{w:2240,h:600}),
				D('jgCanopyMist',0,1160,{w:2680,h:420}),
			],
			interactables:[I('raptorEgg',1290,790,140,110,{name:'Storm Egg'})],
			spawns:[E(1290,430,'stormRaptor',{isMiniBoss:true,flies:true})],
		}),

		R('jg_worldroot_approach', 'preboss', 'preboss', [4], 2200, 1080, 'Worldroot Approach', {
			objective:'ENTER THE HEART OF THE JUNGLE', clearMode:'none', noCombat:true,
			cells:[A(0,300,2200,780),A(300,80,1600,260)],
			solids:[M(0,900,260,180),M(1940,900,260,180),M(820,780,560,120)],
			ports:{left:{y:770,h:240},right:{y:750,h:240},top:{x:980,w:240}},
			platforms:[P('static',260,850,360),P('static',730,730,740),P('static',1580,850,360)],
			props:[
				D('jgWorldrootGate',710,340,{w:780,h:450}),
				D('jgRootLetters',760,690,{w:680,h:100}),
				D('jgBiolumeField',300,250,{w:1600,h:590}),
				D('jgMemoryEchoes',460,350,{w:1280,h:420}),
				D('jgQuietMist',260,780,{w:1680,h:220}),
			],
			interactables:[
				I('jungleMemory',1000,680,120,100,{name:'The Last Inscription',lore:'The heart was never sealed to keep us out. It was sealed to keep our hunger away from it.'}),
			],
		}),

		R('jg_heart_of_jungle', 'boss', 'boss', [4], 5600, 2680, 'Heartwood Chamber', {
			objective:'DEFEAT THE VERDANT COLOSSUS, HEART OF THE WORLDROOT', clearMode:'boss', noCombat:true, bossArena:true,
			cells:[A(80, 400, 5440, 2200)],
			solids:[
				M(0, 2600, 5600, 80),
				M(70, 2340, 520, 260), M(5010, 2340, 520, 260),
				M(70, 500, 420, 160), M(5110, 500, 420, 160),
				M(840, 1920, 160, 680),
				M(4440, 1920, 160, 680),
				M(2450, 2230, 700, 280),
				M(2065, 2180, 1470, 400),
			],
			ports:{left:{y:2260,h:260},top:{x:2570,w:260}},
			platforms:[],
			hazards:[
				H('bounceMushroom', 1225, 2520, 140, 80, {lift:14, flower:true}),
				H('bounceMushroom', 4130, 2520, 140, 80, {lift:14, flower:true}),
				H('bounceMushroom', 2660, 2500, 160, 80, {lift:12, flower:true}),
			],
			props:[
				D('jgAncientGroveArena', 0, 250, {w:5600, h:2430, boss:true}),
				D('jgWorldrootColumns', 280, 530, {w:5040, h:1540}),
				D('jgBiolumeField', 210, 450, {w:5180, h:1790}),
				D('jgHangGlowVines', 315, 500, {w:1085, h:670}),
				D('jgHangGlowVines', 4200, 500, {w:1085, h:670}),
				D('jgHangGlowVines', 2065, 450, {w:1470, h:340}),
				D('jgLightShaft', 700, 400, {w:420, h:900, alpha:0.32}),
				D('jgLightShaft', 2275, 380, {w:520, h:980, alpha:0.36}),
				D('jgLightShaft', 3500, 400, {w:420, h:900, alpha:0.32}),
				D('jgLightShaft', 4725, 420, {w:380, h:860, alpha:0.30}),
				D('jgTallBiolume', 542, 2100, {w:90, h:420}),
				D('jgTallBiolume', 4970, 2100, {w:90, h:420}),
				D('jgHeartwoodLamp', 962, 1880, {w:70, h:90}),
				D('jgHeartwoodLamp', 4550, 1880, {w:70, h:90}),
				D('jgCanopyLamp', 1645, 520, {w:80, h:70}),
				D('jgCanopyLamp', 3885, 520, {w:80, h:70}),
				D('jgGiantFlower', 350, 2290, {w:240, h:240, glow:true, boss:true}),
				D('jgGiantFlower', 4865, 2290, {w:240, h:240, glow:true, boss:true}),
				D('jgGiantFlower', 1540, 1900, {w:210, h:220, glow:true, boss:true}),
				D('jgGiantFlower', 3745, 1900, {w:210, h:220, glow:true, boss:true}),
				D('jgGiantFlower', 858, 2380, {w:180, h:190, glow:true, boss:true}),
				D('jgGiantFlower', 4585, 2380, {w:180, h:190, glow:true, boss:true}),
				D('jgGiantFlower', 2100, 2360, {w:200, h:210, glow:true, boss:true}),
				D('jgGiantFlower', 3325, 2360, {w:200, h:210, glow:true, boss:true}),
				D('jgGiantFlower', 2712, 1860, {w:230, h:240, glow:true, boss:true}),
				D('jgSapCrystal', 1015, 2430, {w:90, h:110}),
				D('jgSapCrystal', 4410, 2430, {w:90, h:110}),
				D('jgSapCrystal', 2730, 2430, {w:100, h:120}),
				D('jgStoneMarker', 630, 2400, {w:110, h:130}),
				D('jgStoneMarker', 4760, 2400, {w:110, h:130}),
				D('jgIdol', 245, 2340, {w:130, h:170}),
				D('jgIdol', 5128, 2340, {w:130, h:170}),
				D('jgConnectorRoots', 700, 2090, {w:560, h:500}),
				D('jgConnectorRoots', 4340, 2090, {w:560, h:500}),
				D('jgConnectorRoots', 2310, 2320, {w:980, h:280}),
				D('jgAltar', 2660, 2460, {w:160, h:90}),
			],
			spawns:[E(2565, 1260, 'earthColossus', {boss:true})],
		}),

		R('jg_overgrown_canopy_a', 'overgrownCanopy', 'optional', [2,3], 1280, 1760, 'Overgrown Canopy', {
			noCombat:true, objective:'GRAB, SWING, RELEASE — REACH THE CANOPY', clearMode:'puzzle', optional:true,
			ports:{ bottom:{ x:80, w:240 }, top:{ x:920, w:240 }, left:{ y:1520, h:180 } },
			platforms:[
				P('static', 40, 1640, 260), P('static', 420, 1460, 200), P('static', 80, 1240, 220),
				P('static', 560, 1060, 240), P('static', 180, 860, 200), P('static', 700, 660, 240),
				P('static', 240, 440, 220), P('static', 880, 220, 280),
			],
			hazards:[
				H('swingingVine', 360, 80, 24, 700, {length:640, period:240, phase:20}),
				H('swingingVine', 720, 40, 24, 780, {length:700, period:260, phase:130}),
			],
			props:[
				D('jgRootMass', 900, 400, { w:360, h:900, from:'right' }),
				D('jgVineCurtain', 40, 80, { w:220, h:600 }),
				D('jgLightShaft', 860, 40, { w:280, h:500, alpha:0.22 }),
				D('jgGlowBeetleHint', 300, 400, { w:80, h:80 }),
			],
			spawns:[
				E(460, 1400, 'thornWolf'), E(600, 1000, 'skyVine'), E(220, 800, 'stalactiteBat'),
				E(740, 600, 'windSylph'), E(280, 400, 'glowBeetle'),
			],
			clearZone:{ x:900, y:80, w:300, h:200 },
			puzzle:{type:'mini',mini:'vineSwing'},
			interactables:[
				I('crackedRock', 280, 380, 50, 70, { id:'treeHollow', name:'Strange Bark', lore:'Beetles cluster at a hollow.' }),
				I('cache', 280, 300, 70, 60, { name:'Canopy Cache', _revealWith:'treeHollow', _locked:true, _lootTier:'secret', rare:true }),
				I('cache', 940, 160, 70, 60, { name:'Canopy Cache', _mainCache:true, _lootTier:'challenge' }),
			],
		}),
		R('jg_overgrown_canopy_b', 'overgrownCanopy', 'optional', [3], 1200, 1680, 'Overgrown Canopy', {
			noCombat:true, objective:'GRAB, SWING, RELEASE — REACH THE CANOPY', clearMode:'puzzle', optional:true,
			ports:{ bottom:{ x:860, w:240 }, top:{ x:60, w:240 }, right:{ y:80, h:160 } },
			platforms:[
				P('static', 840, 1560, 280), P('static', 480, 1340, 220), P('static', 120, 1120, 240),
				P('static', 560, 900, 220), P('static', 160, 680, 200), P('static', 640, 460, 240),
				P('static', 40, 180, 280),
			],
			hazards:[
				H('swingingVine', 400, 80, 24, 720, {length:660, period:250, phase:40}),
				H('swingingVine', 780, 40, 24, 760, {length:700, period:270, phase:150}),
			],
			spawns:[ E(500, 1280, 'thornWolf'), E(200, 1060, 'windSylph'), E(600, 420, 'skyVine') ],
			clearZone:{ x:40, y:40, w:300, h:180 },
			puzzle:{type:'mini',mini:'vineSwing'},
			interactables:[ I('cache', 80, 120, 70, 60, { name:'Canopy Cache', _mainCache:true, _lootTier:'challenge' }) ],
		}),
		R('jg_spore_garden_a', 'sporeGarden', 'optional', [2,3], 1960, 1000, 'Spore Garden', {
			objective:'WATCH THE SPORES — TOUCH THE SAFE BLOOMS', clearMode:'puzzle', optional:true,
			ports:{ left:{ y:720, h:220 }, right:{ y:720, h:220 }, top:{ x:860, w:240 } },
			platforms:[
				P('static', 40, 880, 280), P('static', 420, 760, 220), P('static', 780, 680, 260),
				P('static', 1180, 760, 220), P('static', 1600, 880, 300),
			],
			props:[
				D('jgGiantFlower', 200, 700, { w:180, h:200, glow:true }),
				D('jgBiolumeField', 400, 200, { w:1200, h:600 }),
			],
			spawns:[ E(480, 700, 'sporeFungus'), E(900, 620, 'mossWraith'), E(1300, 700, 'vineCrawler'), E(1680, 820, 'thornWolf') ],
			puzzle:{type:'mini',mini:'sporeId',group:'spores'},
			interactables:[
				I('sporeFlower', 200, 800, 50, 70, { idx:0, _color:'green', name:'Ancient Flower', group:'spores' }),
				I('sporeFlower', 820, 600, 50, 70, { idx:1, _color:'blue', name:'Ancient Flower', group:'spores' }),
				I('sporeFlower', 1220, 680, 50, 70, { idx:2, _color:'purple', name:'Ancient Flower', group:'spores' }),
				I('sporeFlower', 1680, 800, 50, 70, { idx:3, _color:'green', name:'Ancient Flower', group:'spores' }),
				I('cache', 900, 620, 80, 70, { name:'Blooming Cache', _mainCache:true, _locked:true, _lootTier:'challenge' }),
				I('cache', 860, 760, 70, 60, { name:'Secret Bloom Cache', rare:true, _lockTag:'secret', _locked:true, _lootTier:'secret' }),
			],
		}),
		R('jg_spore_garden_b', 'sporeGarden', 'optional', [2,3], 1840, 940, 'Spore Garden', {
			objective:'WATCH THE SPORES — TOUCH THE SAFE BLOOMS', clearMode:'puzzle', optional:true,
			ports:{ left:{ y:680, h:200 }, top:{ x:800, w:240 } },
			platforms:[ P('static', 40, 820, 260), P('static', 520, 680, 280), P('static', 1040, 560, 260), P('static', 1480, 820, 280) ],
			spawns:[ E(560, 620, 'sporeFungus'), E(1100, 500, 'mossWraith'), E(1540, 760, 'vineCrawler') ],
			puzzle:{type:'mini',mini:'sporeId',group:'spores'},
			interactables:[
				I('sporeFlower', 160, 740, 50, 70, { idx:0, group:'spores', _color:'purple' }),
				I('sporeFlower', 600, 600, 50, 70, { idx:1, group:'spores', _color:'blue' }),
				I('sporeFlower', 1120, 480, 50, 70, { idx:2, group:'spores', _color:'green' }),
				I('cache', 1080, 500, 80, 70, { name:'Blooming Cache', _mainCache:true, _locked:true, _lootTier:'challenge' }),
			],
		}),
		R('jg_rootbound_ruins_a', 'rootboundRuins', 'optional', [2,3], 2200, 1120, 'Rootbound Ruins', {
			objective:'REACH THE HEART-TREE', clearMode:'none', optional:true,
			ports:{ left:{ y:840, h:220 }, right:{ y:840, h:220 }, top:{ x:980, w:240 } },
			platforms:[
				P('static', 40, 1000, 280), P('static', 400, 860, 220), P('static', 980, 720, 260),
				P('static', 1500, 860, 220), P('static', 1880, 1000, 280),
				P('static', 720, 500, 200), P('static', 1280, 420, 220),
			],
			props:[
				D('jgRuinArch', 900, 360, { w:280, h:360, broken:true }),
				D('jgRootMass', 0, 200, { w:300, h:700, from:'left' }),
				D('jgStatue', 1040, 860, { w:140, h:220, fallen:true }),
			],
			spawns:[
				E(420, 800, 'vineCrawler'), E(1540, 800, 'mossWraith'),
				E(760, 440, 'skyVine'), E(1040, 640, 'elderTreant', { isMiniBoss:true, _ruinsBoss:true, _jungleDormant:true }),
			],
			clearZone:{ x:980, y:600, w:280, h:200 },
			puzzle:{type:'mini',mini:'rootGrid',combat:true},
			interactables:[
				I('miniBossStart', 1010, 610, 120, 110, { name:'Heart-Tree Seal', wake:'elderTreant' }),
				I('crackedRock', 80, 920, 50, 70, { id:'rootGap', name:'Air through the roots', lore:'A draft moves the moss.' }),
				I('rootSwitch', 1280, 360, 60, 70, { name:'Root Latch', punch:{ x:1180, y:300, w:80, h:200 } }),
				I('puzzleBoard', 980, 680, 80, 70, { name:'Root Lattice' }),
				I('cache', 1040, 660, 80, 70, { name:'Rootbound Cache', _mainCache:true, _lootTier:'challenge' }),
				I('cache', 120, 840, 60, 50, { name:'Explorer Cache', _revealWith:'rootGap', _locked:true, _lootTier:'explore' }),
			],
		}),
		R('jg_rootbound_ruins_b', 'rootboundRuins', 'optional', [3], 2000, 1040, 'Rootbound Ruins', {
			objective:'REACH THE HEART-TREE', clearMode:'none', optional:true,
			ports:{ left:{ y:760, h:220 }, bottom:{ x:860, w:240 } },
			platforms:[ P('static', 40, 920, 260), P('static', 480, 760, 240), P('static', 900, 620, 280), P('static', 1500, 780, 260) ],
			spawns:[ E(520, 700, 'thornWolf'), E(940, 560, 'elderTreant', { isMiniBoss:true, _ruinsBoss:true }), E(1560, 720, 'sporeFungus') ],
			clearZone:{ x:880, y:500, w:280, h:180 },
			puzzle:{type:'mini',mini:'rootGrid'},
			interactables:[
				I('miniBossStart', 930, 510, 120, 110, { name:'Heart-Tree Seal', wake:'elderTreant' }),
				I('rootSwitch', 1500, 700, 60, 70, { name:'Root Latch', punch:{ x:1400, y:640, w:80, h:180 } }),
				I('puzzleBoard', 900, 560, 80, 70, { name:'Root Lattice' }),
				I('cache', 980, 560, 80, 70, { name:'Rootbound Cache', _mainCache:true, _lootTier:'challenge' }),
			],
		}),

		/* ================= MAJOR SET-PIECES — OFF-PATH CHAINS ================= */
		R('jg_predators_gauntlet', 'predatorsGauntlet', 'combat', [2,3], 2680, 1860, "Predator's Gauntlet", {
			objective:'SURVIVE THE THREE-HEIGHT HUNT', clearMode:'combat', authoredCombat:true,
			cells:[A(0,720,2680,1140),A(180,280,2320,480),A(520,40,1640,280)],
			solids:[M(0,1680,320,180),M(2360,1680,320,180),M(1080,1480,480,160)],
			ports:{left:{y:1480,h:220},right:{y:1480,h:220},top:{x:1220,w:240},bottom:{x:420,w:240}},
			platforms:[
				P('static',80,1640,360),P('static',520,1640,400),P('static',1080,1640,520),P('static',1760,1640,400),P('static',2240,1640,360),
				P('static',260,1260,280),P('static',720,1180,300),P('static',1180,1100,340),P('static',1680,1180,300),P('static',2140,1260,280),
				P('static',480,760,240,{branch:true}),P('static',980,640,280,{branch:true}),P('static',1480,580,280,{branch:true}),P('static',1980,700,240,{branch:true}),
				P('static',860,360,220,{branch:true}),P('static',1600,300,240,{branch:true}),
			],
			hazards:[
				H('rootSnare',640,1580,110,80,{period:240,phase:20}),
				H('rootSnare',1860,1580,110,80,{period:240,phase:150}),
				H('swingingVine',900,80,24,620,{length:560,period:260,phase:40}),
				H('swingingVine',1760,40,24,680,{length:620,period:280,phase:160}),
			],
			props:[
				D('jgRootMass',0,900,{w:360,h:780,from:'left'}),
				D('jgRootMass',2320,880,{w:360,h:800,from:'right'}),
				D('jgFallenLog',540,1588,{w:280,h:56}),
				D('jgFallenLog',1700,1588,{w:300,h:56}),
				D('jgStillPool',1180,1600,{w:360,h:80}),
				D('jgRuinWall',1040,1180,{w:200,h:300,broken:true}),
				D('jgHangingVines',400,40,{w:1880,h:420}),
				D('jgCanopyMist',0,1420,{w:2680,h:420}),
				D('jgSuspiciousEyes',520,500,{w:140,h:60}),
				D('jgSuspiciousEyes',1980,440,{w:140,h:60}),
				D('jgClawMarks',700,1500,{w:220,h:120}),
				D('jgNest',1240,1480,{w:280,h:120}),
			],
			spawns:[
				E(560,1570,'thornWolf'),E(1880,1570,'thornWolf'),E(1280,1570,'vineCrawler'),
				E(780,1110,'skyVine',{_phase:2}),E(1760,1110,'skyVine',{_phase:2}),E(1320,1030,'windSylph',{_phase:2}),
				E(920,280,'stalactiteBat',{_phase:3}),E(1680,220,'stalactiteBat',{_phase:3}),E(2040,620,'windSylph',{_phase:3}),
			],
			interactables:[I('jungleCache',1260,1560,110,80,{name:'Gauntlet Cache',_mainCache:true,lockedByCombat:true})],
			clearZone:{x:1180,y:1480,w:320,h:280},
		}),

		R('jg_living_fortress', 'livingFortress', 'combat', [2,3], 2680, 1860, 'The Living Fortress', {
			objective:'BREAK THREE ROOT CORES AND CLEAR THE COURTYARD', clearMode:'combat', authoredCombat:true,
			cells:[A(0,480,2680,1380),A(220,80,2240,440)],
			solids:[M(0,1680,280,180),M(2400,1680,280,180),M(1120,1500,440,140)],
			ports:{left:{y:1480,h:220},right:{y:1480,h:220},top:{x:1220,w:240},bottom:{x:420,w:240}},
			platforms:[
				P('static',60,1640,380),P('static',520,1640,520),P('static',1120,1640,480),P('static',1720,1640,480),P('static',2260,1640,360),
				P('static',200,1180,260),P('static',620,1080,240),P('static',1180,980,320),P('static',1760,1080,240),P('static',2180,1180,260),
				P('static',480,640,240),P('static',1180,560,300),P('static',1880,640,240),
				P('static',80,1480,180),P('static',2420,1480,180),
			],
			hazards:[
				H('rootSnare',780,1580,110,80,{period:230,phase:40}),
				H('rootSnare',1760,1580,110,80,{period:230,phase:140}),
				H('rootCrusher',980,620,160,480,{period:280,phase:60}),
			],
			props:[
				D('jgRuinArch',1180,860,{w:340,h:420,broken:true}),
				D('jgRuinWall',0,980,{w:280,h:680}),
				D('jgRuinWall',2400,980,{w:280,h:680}),
				D('jgGuardianStatue',420,1410,{w:140,h:230}),
				D('jgGuardianStatue',2100,1410,{w:140,h:230}),
				D('jgRootMass',700,200,{w:280,h:520,from:'left'}),
				D('jgRootMass',1680,160,{w:300,h:560,from:'right'}),
				D('jgStillPool',1220,1608,{w:280,h:70}),
				D('jgMossCarpet',520,1800,{w:1640,h:36}),
				D('jgHangingVines',260,40,{w:2160,h:360}),
				D('jgSapCrystal',260,1070,{w:80,h:110}),
				D('jgSapCrystal',2320,1070,{w:80,h:110}),
			],
			spawns:[
				E(900,1570,'mossWraith'),E(1700,1570,'mossWraith'),
				E(280,1570,'vineCrawler'),E(2280,1570,'vineCrawler'),
				E(640,1570,'thornWolf'),E(1960,1570,'thornWolf'),
				E(1300,1570,'sporeFungus'),
			],
			interactables:[
				I('rootCore',280,1070,90,110,{name:'West Root Core',hp:150}),
				I('rootCore',2280,1070,90,110,{name:'East Root Core',hp:150}),
				I('rootCore',560,530,90,110,{name:'North Root Core',hp:150}),
				I('rootCore',1880,530,90,110,{name:'High Root Core',hp:150}),
				I('jungleCache',1260,1560,120,80,{name:'Fortress Cache',_mainCache:true,lockedByCombat:true}),
			],
			clearZone:{x:1180,y:1480,w:340,h:280},
		}),

		R('jg_sporefall', 'sporefall', 'combat', [2,3], 2680, 1860, 'The Sporefall', {
			objective:'FIGHT BETWEEN THE BREATHING CAPS', clearMode:'combat', authoredCombat:true,
			cells:[A(0,560,2680,1300),A(200,80,2280,520)],
			solids:[M(0,1680,300,180),M(2380,1680,300,180)],
			ports:{left:{y:1480,h:220},right:{y:1480,h:220},top:{x:1220,w:240},bottom:{x:480,w:240}},
			platforms:[
				P('static',60,1640,400),P('static',560,1640,480),P('static',1160,1640,420),P('static',1720,1640,460),P('static',2260,1640,360),
				P('static',320,1280,260),P('static',860,1180,280),P('static',1480,1220,280),P('static',2060,1280,260),
				P('static',640,860,240),P('static',1220,760,300),P('static',1860,860,240),
				P('static',1080,1480,220),
			],
			hazards:[
				H('sporeBloom',360,1380,150,170,{period:230,phase:0,r:170}),
				H('sporeBloom',820,1280,150,170,{period:250,phase:50,r:170}),
				H('sporeBloom',1260,980,180,200,{period:280,phase:90,r:210}),
				H('sporeBloom',1760,1280,150,170,{period:240,phase:140,r:170}),
				H('sporeBloom',2200,1380,150,170,{period:260,phase:190,r:170}),
				H('sporeBloom',1080,1480,140,150,{period:270,phase:30,r:150}),
				H('bounceMushroom',600,1570,140,70,{lift:15}),
				H('bounceMushroom',1980,1570,140,70,{lift:15}),
			],
			props:[
				D('jgMushroomForest',200,1560,{w:2280,h:140}),
				D('jgGlowMushrooms',340,1520,{w:240,h:120}),
				D('jgGlowMushrooms',1220,1120,{w:280,h:130}),
				D('jgGlowMushrooms',2140,1520,{w:240,h:120}),
				D('jgCaveMist',80,1360,{w:2520,h:460}),
				D('jgRootMass',0,700,{w:300,h:900,from:'left'}),
				D('jgStillPool',1180,1604,{w:320,h:70}),
				D('jgFallenLog',700,1588,{w:260,h:52}),
			],
			spawns:[
				E(420,1570,'sporeFungus'),E(1280,1570,'sporeFungus'),E(2100,1570,'sporeFungus'),
				E(240,1210,'mossWraith'),E(2140,1210,'mossWraith'),
				E(900,1570,'vineCrawler'),E(1760,1570,'vineCrawler'),
				E(2320,1570,'thornWolf'),
			],
			interactables:[
				I('sporeHeart',840,1110,80,90,{name:'Spore Heart',hp:90}),
				I('sporeHeart',1500,1150,80,90,{name:'Spore Heart',hp:90}),
				I('sporeHeart',2080,1210,80,90,{name:'Spore Heart',hp:90}),
				I('jungleCache',1240,1560,110,80,{name:'Sporefall Cache',_mainCache:true,lockedByCombat:true}),
				I('jungleCache',1280,690,100,70,{name:'Spore Heart Cache',rare:true,_lockTag:'spore',_locked:true}),
			],
			clearZone:{x:1180,y:1480,w:320,h:280},
		}),

		R('jg_thorn_cathedral', 'thornCathedral', 'combat', [3], 2680, 1860, 'The Thorn Cathedral', {
			objective:'OUTLAST THE GROWING NAVE', clearMode:'combat', authoredCombat:true,
			cells:[A(0,480,2680,1380),A(260,40,2160,480)],
			solids:[M(0,1680,280,180),M(2400,1680,280,180),M(1180,1520,320,140)],
			ports:{left:{y:1480,h:220},right:{y:1480,h:220},top:{x:1220,w:240},bottom:{x:420,w:240}},
			platforms:[
				P('static',60,1640,400),P('static',540,1640,520),P('static',1160,1640,400),P('static',1680,1640,520),P('static',2260,1640,360),
				P('static',220,1200,280),P('static',720,1100,260),P('static',1220,1020,280),P('static',1720,1100,260),P('static',2180,1200,260),
				P('static',480,700,240),P('static',1180,600,320),P('static',1920,700,240),
				P('static',900,360,220,{branch:true}),P('static',1560,320,220,{branch:true}),
			],
			hazards:[
				H('thornGrow',640,980,46,660,{period:999,phase:0}),
				H('thornGrow',1320,860,50,720,{period:999,phase:0}),
				H('thornGrow',1980,980,46,660,{period:999,phase:0}),
				H('thornGrow',1160,420,70,520,{period:999,phase:0}),
				H('rootSnare',860,1580,110,80,{period:220,phase:30}),
				H('rootSnare',1760,1580,110,80,{period:220,phase:150}),
			],
			props:[
				D('jgRuinArch',1080,780,{w:520,h:520,broken:true}),
				D('jgGuardianStatue',360,1410,{w:150,h:230,headless:true}),
				D('jgGuardianStatue',2160,1410,{w:150,h:230,headless:true}),
				D('jgRuinWall',0,900,{w:260,h:760}),
				D('jgRuinWall',2420,900,{w:260,h:760}),
				D('jgHangingVines',300,20,{w:2080,h:380}),
				D('jgLightShaft',1180,20,{w:320,h:700,alpha:0.18}),
				D('jgMossCarpet',400,1800,{w:1880,h:36}),
				D('jgWarningBones',1240,1560,{w:220,h:70}),
			],
			spawns:[
				E(580,1570,'thornWolf'),E(1900,1570,'thornWolf'),
				E(780,1570,'vineCrawler'),E(1680,1570,'vineCrawler'),
				E(760,1030,'mossWraith'),E(1800,1030,'mossWraith'),E(1320,950,'sporeFungus'),
				E(540,620,'windSylph'),E(2000,620,'windSylph'),
				E(980,280,'skyVine'),E(1640,240,'skyVine'),
			],
			interactables:[I('jungleCache',1260,1440,120,80,{name:'Altar Cache',_mainCache:true,lockedByCombat:true})],
			clearZone:{x:1180,y:1360,w:320,h:280},
		}),

		R('jg_flooded_rootway', 'floodedRootway', 'combat', [2,3], 2680, 1860, 'The Flooded Rootway', {
			objective:'FIGHT THROUGH THE RISING ROOTWAY', clearMode:'combat', authoredCombat:true,
			cells:[A(0,640,2680,1220),A(160,200,2360,480)],
			solids:[M(0,1680,260,180),M(2420,1680,260,180)],
			ports:{left:{y:1480,h:220},right:{y:1480,h:220},top:{x:1220,w:240},bottom:{x:420,w:240}},
			platforms:[
				P('static',40,1640,300),P('static',420,1500,240),P('static',760,1640,280),
				P('static',1120,1420,260),P('static',1480,1560,240),P('static',1820,1420,260),
				P('static',2160,1280,240),P('static',2360,1640,280),
				P('static',520,1180,220),P('static',980,1080,240),P('static',1600,1120,240),P('static',2080,980,220),
				P('static',1240,720,280),
				P('static',200,1760,220),
			],
			hazards:[
				H('water',260,1580,2100,280,{current:0.7,deep:true}),
				H('rootSnare',780,1580,100,70,{period:230,phase:40}),
				H('swingingVine',1020,120,24,700,{length:640,period:250,phase:30}),
				H('swingingVine',1720,80,24,740,{length:680,period:270,phase:150}),
			],
			props:[
				D('jgStream',260,1580,{w:2100,h:280}),
				D('jgLilyPads',400,1540,{w:1600,h:70}),
				D('jgFlowClue',600,1480,{dir:1,w:180}),
				D('jgRuinWall',0,980,{w:240,h:680}),
				D('jgFloodedTemple',1180,780,{w:420,h:420}),
				D('jgRootMass',2320,700,{w:360,h:900,from:'right'}),
				D('jgHangingVines',200,40,{w:2280,h:360}),
				D('jgFallenLog',1080,1368,{w:240,h:52}),
			],
			spawns:[
				E(460,1430,'vineCrawler'),E(800,1570,'vineCrawler'),
				E(560,1110,'mossWraith'),E(1620,1050,'mossWraith'),
				E(1160,1350,'thornWolf'),E(1860,1350,'thornWolf'),
				E(1280,1330,'sporeFungus'),E(1540,1490,'sporeFungus'),E(2100,910,'skyVine'),
				E(2440,1570,'thornWolf'),E(2200,1570,'thornWolf'),E(1260,650,'mossWraith'),E(2140,900,'windSylph'),
			],
			interactables:[
				I('jungleCache',2440,1560,110,80,{name:'Rootway Cache',_mainCache:true,lockedByCombat:true}),
				I('jungleCache',220,1690,90,70,{name:'Flood Cache',rare:true,_lockTag:'flood',_locked:false}),
			],
			clearZone:{x:2320,y:1480,w:300,h:280},
		}),

		R('jg_ancient_hunting_grounds', 'ancientHunting', 'combat', [3], 2680, 1860, 'Ancient Hunting Grounds', {
			objective:'CHOOSE WHICH PACK TO WAKE', clearMode:'combat', authoredCombat:true,
			cells:[A(0,400,2680,1460),A(180,40,2320,400)],
			solids:[M(0,1680,280,180),M(2400,1680,280,180)],
			ports:{left:{y:1480,h:220},right:{y:1480,h:220},top:{x:1220,w:240},bottom:{x:480,w:240}},
			platforms:[
				P('static',40,1640,420),P('static',540,1640,560),P('static',1220,1640,520),P('static',1860,1640,420),P('static',2320,1640,300),
				P('static',280,1280,260),P('static',860,1180,300),P('static',1480,1100,320),P('static',2040,1220,280),
				P('static',620,780,240,{branch:true}),P('static',1240,680,280,{branch:true}),P('static',1880,760,240,{branch:true}),
				P('static',980,420,220,{branch:true}),P('static',1680,360,240,{branch:true}),
			],
			hazards:[
				H('rootSnare',700,1580,110,80,{period:250,phase:20}),
				H('fallingBranch',1180,40,280,44,{impactY:1600,period:320,phase:80}),
			],
			props:[
				D('jgDistantTree',200,200,{w:720,h:900,alpha:0.5}),
				D('jgDistantTree',1680,160,{w:780,h:940,alpha:0.46}),
				D('jgHuntingTotems',400,1280,{w:1880,h:280}),
				D('jgMossCarpet',200,1800,{w:2280,h:40}),
				D('jgFallenLog',560,1588,{w:320,h:56}),
				D('jgClawMarks',900,1500,{w:240,h:120}),
				D('jgClawMarks',1760,1480,{w:240,h:120}),
				D('jgSuspiciousEyes',480,620,{w:140,h:60}),
				D('jgSuspiciousEyes',1980,560,{w:140,h:60}),
				D('jgQuietMist',80,1500,{w:2520,h:280}),
				D('jgStillPool',1280,1600,{w:280,h:70}),
				D('jgRuinWall',1180,1280,{w:180,h:280,broken:true}),
			],
			spawns:[
				E(280,1570,'thornWolf',{pack:1}),E(520,1570,'thornWolf',{pack:1}),E(760,1570,'thornWolf',{pack:1}),
				E(1500,1030,'thornWolf',{pack:2}),E(1760,1030,'thornWolf',{pack:2}),E(1560,1030,'skyVine',{pack:2}),E(1680,600,'windSylph',{pack:2}),
				E(2140,1140,'stalactiteBat',{pack:3}),E(2320,1080,'stalactiteBat',{pack:3}),E(2100,1570,'thornWolf',{pack:3}),E(2360,1570,'thornWolf',{pack:3}),
			],
			interactables:[
				I('jungleCache',1320,1560,110,80,{name:'Ancient Hunting Cache',_mainCache:true,lockedByCombat:true}),
				I('jungleCache',1000,350,100,70,{name:'Quiet Tribute',rare:true,_lockTag:'tribute',_locked:true}),
			],
			clearZone:{x:1240,y:1480,w:320,h:280},
		}),

		R('jg_blooming_colosseum', 'bloomingColosseum', 'combat', [3], 2680, 1860, 'The Blooming Colosseum', {
			objective:'USE THE LIVING RING — DEFEAT THE ARENA', clearMode:'combat', authoredCombat:true,
			cells:[A(0,360,2680,1500),A(240,40,2200,360)],
			solids:[M(0,1680,260,180),M(2420,1680,260,180)],
			ports:{left:{y:1480,h:220},right:{y:1480,h:220},top:{x:1220,w:240},bottom:{x:420,w:240}},
			platforms:[
				P('static',80,1640,480),P('static',680,1640,1320),P('static',2140,1640,460),
				P('static',360,1280,240),P('static',2080,1280,240),
				P('static',720,1080,260),P('static',1700,1080,260),
				P('static',1180,860,320),
				P('static',1100,420,460,{branch:true}),
			],
			hazards:[
				H('colosseumFlower',360,1520,140,120,{flower:'bounce',period:170,phase:0}),
				H('colosseumFlower',720,1520,140,120,{flower:'thorn',period:180,phase:30}),
				H('colosseumFlower',1080,1520,140,120,{flower:'spore',period:190,phase:70}),
				H('colosseumFlower',1460,1520,140,120,{flower:'bloom',period:200,phase:110}),
				H('colosseumFlower',1820,1520,140,120,{flower:'bounce',period:170,phase:150}),
				H('colosseumFlower',2180,1520,140,120,{flower:'thorn',period:185,phase:40}),
				H('colosseumFlower',360,1160,130,110,{flower:'spore',period:210,phase:20}),
				H('colosseumFlower',2180,1160,130,110,{flower:'bloom',period:210,phase:90}),
				H('colosseumFlower',760,960,130,110,{flower:'thorn',period:175,phase:55}),
				H('colosseumFlower',1780,960,130,110,{flower:'bounce',period:175,phase:130}),
			],
			props:[
				D('jgFlowerField',200,1480,{w:2280,h:200,giant:true}),
				D('jgGiantFlower',1180,1320,{w:280,h:240,glow:true}),
				D('jgRuinWall',0,900,{w:240,h:760}),
				D('jgRuinWall',2440,900,{w:240,h:760}),
				D('jgButterflies',400,400,{w:1880,h:600}),
				D('jgLightShaft',1100,20,{w:480,h:720,alpha:0.2}),
				D('jgMossCarpet',200,1800,{w:2280,h:36}),
			],
			spawns:[
				E(750,1570,'thornWolf'),E(1900,1570,'thornWolf'),
				E(900,1570,'vineCrawler'),E(1600,1570,'vineCrawler'),
				E(420,1210,'windSylph'),E(2140,1210,'windSylph'),
			],
			interactables:[
				I('jungleCache',1260,1560,120,80,{name:'Colosseum Cache',_mainCache:true,lockedByCombat:true}),
				I('jungleCache',1280,350,100,70,{name:'High Bloom Cache',rare:true,_lockTag:'high',_locked:false}),
			],
			clearZone:{x:1180,y:1480,w:340,h:280},
		}),

		R('jg_root_collapse', 'rootCollapse', 'combat', [3,4], 2680, 1860, 'The Root Collapse', {
			objective:'REACH THE LAST STABLE FLOOR AND FINISH THE FIGHT', clearMode:'combat', authoredCombat:true,
			cells:[A(0,400,2680,1460),A(200,40,2280,400)],
			solids:[M(0,1680,280,180),M(2400,1680,280,180)],
			ports:{left:{y:1480,h:220},right:{y:1480,h:220},top:{x:1220,w:240},bottom:{x:420,w:240}},
			platforms:[
				P('static',40,1640,320),
				P('static',400,1580,360,{_section:1}),
				P('static',820,1500,340,{_section:2}),
				P('static',1220,1420,340,{_section:3}),
				P('static',1620,1280,300,{_section:4}),
				P('static',2000,1100,280),
				P('static',2320,980,280),
				P('static',220,1280,220),
				P('static',700,1120,240),
				P('static',1480,860,240,{branch:true}),
				P('static',1960,700,240,{branch:true}),
				P('static',1080,1780,240),
				P('collapse',1080,1680,280,{life:200,lowerRoute:true,_section:5}),
			],
			hazards:[
				H('rootSnare',860,1440,110,80,{period:230,phase:40}),
				H('fallingBranch',980,20,300,44,{impactY:1500,period:260,phase:70}),
			],
			props:[
				D('jgRuinArch',1180,980,{w:360,h:400,broken:true}),
				D('jgGuardianStatue',2100,750,{w:140,h:230}),
				D('jgRootMass',0,700,{w:320,h:900,from:'left'}),
				D('jgRootVeins',400,1200,{w:1800,h:360}),
				D('jgHangingVines',200,20,{w:2200,h:380}),
				D('jgCanopyDrop',380,1680,{w:1400,h:160}),
				D('jgCrackClues',420,1540,{levels:[1,2,3,3]}),
			],
			spawns:[
				E(480,1510,'thornWolf'),E(900,1430,'thornWolf'),
				E(860,1430,'vineCrawler'),E(1280,1350,'vineCrawler'),
				E(260,1210,'mossWraith'),E(740,1050,'mossWraith'),
			],
			interactables:[
				I('jungleCache',2400,900,110,80,{name:'Root Collapse Cache',_mainCache:true,lockedByCombat:true}),
				I('jungleCache',1160,1710,90,70,{name:'Collapsed Cache',rare:true,_lockTag:'secret',_locked:false}),
			],
			clearZone:{x:2280,y:860,w:320,h:280},
		}),
	];

	const byCategory = Object.create(null);
	const byKind = Object.create(null);
	const byId = Object.create(null);
	for(let i = 0; i < JUNGLE_ROOM_TEMPLATES.length; i++){
		const t = JUNGLE_ROOM_TEMPLATES[i];
		(byCategory[t.category] || (byCategory[t.category] = [])).push(t);
		(byKind[t.kind] || (byKind[t.kind] = [])).push(t);
		byId[t.id] = t;
	}

	global.JUNGLE_ROOM_TEMPLATES = JUNGLE_ROOM_TEMPLATES;
	global.JUNGLE_TEMPLATES_BY_CATEGORY = byCategory;
	global.JUNGLE_TEMPLATES_BY_KIND = byKind;
	global.JUNGLE_TEMPLATES_BY_ID = byId;
})(typeof window !== 'undefined' ? window : globalThis);
