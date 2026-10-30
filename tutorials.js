/* =============================================================
   Tutorials (c57): the 🎓 Tutorials tab in the inventory.

   A library of short, illustrated guides to every part of the game, grouped by subject. Pick a topic on the
   left; the guide opens on the right with steps, key tables, tips and, where it helps, a small diagram.
   Read guides are ticked (kept in localStorage `magicBattle_tutorialsRead`). Open straight to a guide with
   inventory.html?tab=tutorials&t=<id>.

   Tutorials.mount(hostElement) builds the page; Tutorials.open(id) shows one guide.
   ============================================================= */
(function (global) {
	'use strict';

	const K = (k) => '<kbd>' + k + '</kbd>';

	/* ---------------------------------------------------------------- small diagrams (inline SVG) */
	const SVG = {
		tree: `<svg viewBox="0 0 520 170" class="tu-svg"><defs><marker id="tuA" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#c9a8ff"/></marker></defs>
			<g font-family="Arial" font-size="12" text-anchor="middle">
			<rect x="10" y="62" width="110" height="46" rx="10" fill="#2b1f4a" stroke="#c9a8ff"/><text x="65" y="82" fill="#fff">✦ Generate</text><text x="65" y="98" fill="#bba" font-size="10">40 E</text>
			<line x1="120" y1="85" x2="190" y2="85" stroke="#c9a8ff" stroke-width="2" marker-end="url(#tuA)"/><text x="155" y="77" fill="#9fd" font-size="10">Instant</text>
			<rect x="190" y="62" width="110" height="46" rx="10" fill="#2b1f4a" stroke="#c9a8ff"/><text x="245" y="82" fill="#fff">◈ Compress</text><text x="245" y="98" fill="#bba" font-size="10">×5, arrow</text>
			<line x1="300" y1="85" x2="370" y2="85" stroke="#c9a8ff" stroke-width="2" marker-end="url(#tuA)"/><text x="335" y="77" fill="#9fd" font-size="10">Instant</text>
			<rect x="370" y="62" width="140" height="46" rx="10" fill="#2b1f4a" stroke="#c9a8ff"/><text x="440" y="82" fill="#fff">➹ Redirect</text><text x="440" y="98" fill="#bba" font-size="10">toward the cursor</text>
			<text x="260" y="150" fill="#aab" font-size="11">Energy flows left → right. Each rune changes the energy its branch is holding.</text>
			</g></svg>`,
		conn: `<svg viewBox="0 0 520 120" class="tu-svg"><g font-family="Arial" font-size="12" text-anchor="middle">
			<rect x="10" y="10" width="160" height="100" rx="12" fill="#1d2b3a" stroke="#5dade2"/><text x="90" y="40" fill="#fff" font-weight="bold">⚡ Instant</text><text x="90" y="62" fill="#cde">runs straight away</text>
			<rect x="180" y="10" width="160" height="100" rx="12" fill="#2b2a1a" stroke="#f1c40f"/><text x="260" y="40" fill="#fff" font-weight="bold">⏱ Delay</text><text x="260" y="62" fill="#cde">waits a set time</text>
			<rect x="350" y="10" width="160" height="100" rx="12" fill="#2b1a22" stroke="#e67e22"/><text x="430" y="40" fill="#fff" font-weight="bold">❓ Condition</text><text x="430" y="62" fill="#cde">waits until something</text><text x="430" y="80" fill="#cde">happens</text>
			</g></svg>`,
		comp: `<svg viewBox="0 0 520 120" class="tu-svg"><g font-family="Arial" font-size="11" text-anchor="middle">
			<circle cx="60" cy="55" r="40" fill="rgba(160,120,255,.25)" stroke="#a78bfa"/><text x="60" y="112" fill="#ccd">Expand (−)</text>
			<circle cx="190" cy="55" r="24" fill="rgba(160,120,255,.5)" stroke="#a78bfa"/><text x="190" y="112" fill="#ccd">Raw</text>
			<circle cx="300" cy="55" r="14" fill="rgba(170,130,255,.8)" stroke="#d6c8ff"/><text x="300" y="112" fill="#ccd">Compressed (10)</text>
			<circle cx="430" cy="55" r="6" fill="#efe6ff" stroke="#fff"/><circle cx="430" cy="55" r="12" fill="none" stroke="rgba(239,230,255,.5)"/><text x="430" y="112" fill="#ccd">Over-compressed (50)</text>
			</g></svg>`,
		junction: `<svg viewBox="0 0 520 150" class="tu-svg"><g font-family="Arial" font-size="12" text-anchor="middle">
			<line x1="30" y1="110" x2="490" y2="110" stroke="#d9a35b" stroke-width="5"/><text x="120" y="135" fill="#ccd">road you walk</text>
			<line x1="300" y1="106" x2="300" y2="40" stroke="#6b4a2a" stroke-width="6"/>
			<path d="M300 46h90l14 12-14 12h-90z" fill="#8a6136" stroke="#3a2614"/><text x="350" y="63" fill="#fff" font-size="11">East →</text>
			<text x="300" y="25" fill="#ffe27a">Fingerpost: press L to turn</text>
			<text x="430" y="98" fill="#9fd">straight on: just keep walking</text>
			</g></svg>`
	};

	/* ---------------------------------------------------------------- the guides */
	const CATS = [
		{ id: 'start', name: 'Getting started', icon: '🌱' },
		{ id: 'magic', name: 'Rune magic', icon: '✦' },
		{ id: 'advanced', name: 'Advanced magic', icon: '🌀' },
		{ id: 'combat', name: 'Combat', icon: '⚔️' },
		{ id: 'character', name: 'Your mage', icon: '🧙' },
		{ id: 'world', name: 'The world', icon: '🗺️' },
		{ id: 'modes', name: 'Game modes', icon: '🏰' }
	];

	const T = [
		/* ============================== GETTING STARTED */
		{ id: 'welcome', lesson: 'basics', cat: 'start', icon: '👋', title: 'Welcome to Magic Battle',
			intro: 'You are a mage. You build your own spells out of runes, carry weapons in the same slots as your spells, and take them out into an open world, dungeons, raids and duels.',
			sections: [
				{ h: 'The main menu', list: [
					'<b>Sandbox</b> — a safe training ground. Try spells on dummies, or open the ⚔ Mage Arena to fight rune mages.',
					'<b>Inventory</b> — this page. Your spell slots, the Rune Forge, gear, crafting, the bestiary and these tutorials.',
					'<b>Dungeons</b> — the Inferno Depths, the Glacial Reach and the Living Wilds, solo or co-op.',
					'<b>PvP</b> — duel another player in one of five arenas.',
					'<b>Raid Bosses</b> — huge multi-phase bosses, alone or with friends.',
					'<b>Map</b> — the World Map (every place you can travel to) and the Grid Map of EmberFall\'s roads.'
				] },
				{ h: 'A good first hour', steps: [
					'Read <b>Controls</b> and <b>Your first rune spell</b> here.',
					'Build a spell in slot 1 and a weapon in slot 2 (see <b>Spell slots</b>).',
					'Go to the <b>Sandbox</b> and practise on the dummies.',
					'Walk into <b>EmberFall</b> from the World Map, talk to people and take on a task.',
					'When you feel ready, try a dungeon on its easiest difficulty.'
				] }
			],
			tip: 'Every guide has a ✓ when you have read it. Use the search box to find a topic fast.' },

		{ id: 'controls', lesson: 'basics', cat: 'start', icon: '⌨️', title: 'Controls',
			intro: 'The same keys work everywhere: in the open world, in dungeons, in the sandbox and in PvP.',
			sections: [
				{ h: 'Moving', keys: [
					['A / D or ← / →', 'Walk'], ['W, ↑ or Space', 'Jump (hold for a higher jump)'], ['S', 'Drop through thin platforms (hold); aim attacks down'],
					['Shift', 'Dash — a quick burst with a moment of invulnerability'], ['Q or right-click', 'Parry']
				] },
				{ h: 'Fighting and casting', keys: [
					['1 – 0', 'Pick a spell or weapon slot'], ['Click (or J)', 'Cast the spell / attack with the weapon'], ['R', 'Weapon special (on magical items: throw, beam or slash)'],
					['T', 'The trigger key — fires spells waiting for "You press the trigger key"'], ['O', 'Clear all your spells and passives (and dissolve your constructs)'],
					['P', 'Let go of the magical item you are holding'], ['F', 'Class ability (Ranger teleport, Warrior Spell Blade)']
				] },
				{ h: 'The world', keys: [
					['E', 'Talk, open doors, enter caves, read, search and loot'], ['L', 'Turn onto another road at a fingerpost'], ['N', 'Map: where you are on the world grid'],
					['M', 'Your inventory, in game'], ['Esc', 'Close menus and dialogue']
				] }
			],
			tip: 'You can bind a key to any spell slot: click the 🔑 next to a slot in the Spell Loadout panel.' },

		{ id: 'slots', cat: 'start', icon: '🎒', title: 'Spell slots and the inventory',
			intro: 'You have ten slots. Each one holds either a rune spell or a weapon, and you switch between them with 1–0 in game.',
			sections: [
				{ h: 'Filling a slot', steps: [
					'In the <b>Spell Loadout</b> panel on the right, click an empty slot.',
					'Choose <b>Rune spell</b> to open the Rune Forge, or pick a <b>weapon</b> to put it in the slot.',
					'A weapon slot can also <b>engrave</b> a spell into its special (see <b>Engraving and magical items</b>).',
					'Click a filled slot to edit it again. The 🔑 button sets a key for it.'
				] },
				{ h: 'The tabs', list: [
					'<b>📦 Inventory</b> — your items. Click one to inspect and equip it.',
					'<b>📖 Collection</b> — every gear piece you can find, by dungeon.',
					'<b>🔨 Crafting</b> — make gear from materials.',
					'<b>📖 Bestiary</b> — every creature you have met.',
					'<b>📚 Spell Dictionary</b> — a reference of spell parts.',
					'<b>🎓 Tutorials</b> — these guides.'
				] },
				{ h: 'Loadouts', p: 'The <b>📦 Loadouts</b> button saves your whole set of slots under a name so you can swap between builds — say, a dungeon set and a PvP set.' }
			] },

		{ id: 'stats', cat: 'start', icon: '📊', title: 'Stats, rank and XP',
			intro: 'Four stats shape how strong your magic is. Gear, your class and vows change them.',
			sections: [
				{ h: 'The four stats', keys: [
					['⚔️ Power', 'Rune damage, and your Max Output — the most energy one spell can move at once'],
					['🎯 Control', 'Rune capacity (how many runes a spell may have), the biggest zone you can open, and how stable over-compressed energy is'],
					['💧 Mana Regen', 'How fast your energy (mana) refills'],
					['🛡️ Defence', 'Less damage from enemy magic, and more max HP']
				] },
				{ h: 'Energy', p: 'Your energy bar is your mana: 500 E to start, growing toward 3000 E as your stats (everything except Strength) rise. Every rune spell costs energy when you cast it, and some things keep costing while they last (passives, reinforcement, magical items).' },
				{ h: 'Mage rank', p: 'You earn XP by defeating enemies and completing quests. Ranks go Novice → Apprentice → Adept → Mage → Archmage → Grand Sorcerer. Higher ranks unlock more of the world (the Storm Islands open at Mage).' }
			],
			tip: 'The stats panel on the left of the inventory shows your current rune damage, Max Output, rune capacity and largest zone.' },

		/* ============================== RUNE MAGIC */
		{ id: 'firstspell', lesson: 'firstspell', cat: 'magic', icon: '✦', title: 'Your first rune spell',
			intro: 'A rune spell is a little tree of runes. Energy is made at the start and flows along the branches; each rune does one thing to it.',
			diagram: 'tree',
			sections: [
				{ h: 'Build a fire-and-forget bolt', steps: [
					'Click an empty slot and choose <b>Rune spell</b>. The Rune Forge opens and asks for the first rune.',
					'Pick <b>✦ Generate Energy</b>. Set Energy to about 40.',
					'Click the + after it and add <b>◈ Compress / Shape</b>. Set power to 5 and the shape to <i>Arrow</i>.',
					'Add <b>➹ Redirect</b> and point it toward the cursor at a good speed.',
					'Check the right-hand panel: when it says <b>✓ No problems</b>, press <b>Ctrl+S</b> to save.',
					'In game, select the slot and click. The bolt flies at your cursor.'
				] },
				{ h: 'What each part did', list: [
					'<b>Generate</b> made raw energy from your reserve. More energy = more damage, more cost.',
					'<b>Compress</b> made it denser and smaller, so it hits harder.',
					'<b>Redirect</b> sent it moving. Without a Redirect, energy just sits where it was made.'
				] }
			],
			tip: 'Raw energy is slow (up to 9 px per frame). Kinetic energy is faster and Light is always very fast — see <b>Techniques</b>.' },

		{ id: 'forge', cat: 'magic', icon: '🛠️', title: 'The Rune Forge',
			intro: 'The forge is where you build and edit rune spells. The tree is in the middle, the selected rune\'s settings and the spell\'s report are on the right.',
			sections: [
				{ h: 'Editing', keys: [
					['Drag empty space', 'Pan'], ['Wheel', 'Zoom'], ['+ sockets', 'Eight around every rune (N, NE, E, SE, S, SW, W, NW): up to 8 runes can branch off one rune. Shift+arrows, or Shift+Home / PgUp / End / PgDn for the corners'], ['Drag a rune', 'Move its branch; drop on a rune to swap, on a connector to insert'],
					['Double-click', 'Change the rune'], ['Right-click', 'Menu'], ['Del / Shift+Del', 'Remove the branch / remove just this rune'],
					['Ctrl+Z / Ctrl+Y', 'Undo / redo'], ['Ctrl+S', 'Save'], ['F / C', 'Fit / centre the view'], ['R', 'Recast the preview']
				] },
				{ h: 'The report', list: [
					'<b>Runes</b> — how many you used against your capacity (Control raises it).',
					'<b>Energy cost</b> — what one cast takes from your energy.',
					'<b>Peak output</b> — the most energy the spell moves at once. It must stay under your Max Output (Power raises it).',
					'<b>Reads as</b> — the spell in plain words. Read it to check the spell does what you meant.',
					'<b>Problems</b> — anything that stops the spell from casting. Click one to jump to the rune.'
				] },
				{ h: 'Top bar', list: [
					'<b>⟲ Reset</b> starts the spell over (Ctrl+Z brings it back).',
					'<b>∞ Passive</b> makes it a passive spell (see <b>Passive spells</b>).',
					'<b>🧪 Tests</b> loads example spells to learn from.'
				] }
			] },

		{ id: 'runes', cat: 'magic', icon: '📜', title: 'Rune reference',
			intro: 'Every rune in one place. Each acts on the energy (or target) its branch is holding.',
			sections: [
				{ h: 'Making and moving energy', keys: [
					['✦ Generate Energy', 'Makes new raw energy (4–1000 E) at you, at a target or at other energy'],
					['➹ Redirect', 'Turns energy once: toward the cursor, a target, a direction — or into your inventory as a magical item'],
					['⇶ Force', 'Pushes the target away from the energy (negative: pulls). On yourself it is a launch'],
					['⟳ Rotate', 'Turns or spins the energy\'s facing, its path, or both'],
					['⑂ Split', 'Shares the energy between several branches'],
					['⁂ Divide', 'Cuts it into pieces that all continue down this branch together']
				] },
				{ h: 'Shaping', keys: [
					['◈ Compress / Shape', 'Denser (+) or wider (−), and sets the shape: sphere, sword, spear, arrow, fist, hammer, wall, your own drawings…'],
					['◐ Colour', 'Recolours the energy and everything made from it'],
					['🔒 Lock', 'Stops later runes changing one property'],
					['⚓ Anchor / State', 'Anchored, free, attached, guided or bound (tethered)'],
					['⛓ Attach', 'Makes the energy travel with the target']
				] },
				{ h: 'Targets and zones', keys: [
					['⌖ Target', 'Chooses what later runes work on — an enemy, you, an ally, a zone, other energy. It never moves energy itself'],
					['◎ Create Zone', 'Opens an empty zone (see <b>Zones and Draw Out</b>)'],
					['⇩ Draw Out', 'Pulls energy out of the target (or the environment) into your zone'],
					['⦿ Domain Expansion', 'Turns a full zone into a domain with its own rules']
				] },
				{ h: 'Logic', keys: [
					['❖ Conditional', 'A waiting rune: each of up to 8 branches starts only when its own condition occurs. Only the first can win, or each can fire again every time (see <b>Conditional and Loop</b>)'],
					['↻ Loop', 'Repeats part of the spell up to 10 times. Pull its ⟲ handle onto an earlier rune; each repeat costs the repeated runes\' mana × 1.5']
				] },
				{ h: 'Effects', keys: [
					['✸ Discharge', 'Releases the energy as a burst. Your own spells never hurt you'],
					['✚ Infuse', 'Pours energy into you or an ally as healing'],
					['✧ Technique', 'Gives the energy a magical law: Thermal, Kinetic, Spatial, Gravity, Light, Anti-Magic…'],
					['⛨ Reinforcement', 'Strengthens you, your legs, arms, weapon, an ally or another spell'],
					['⟲ Spell Memory', 'Lets the branch continue only if the energy went through something — a portal, a hit, a compression…'],
					['⛓ Binding Vow', 'Swears a contract: meet a condition, accept a commitment, earn bonus energy or stats. Free (see <b>Binding Vows</b>)']
				] }
			] },

		{ id: 'timing', lesson: 'mine', cat: 'magic', icon: '⏱️', title: 'Timing: connectors and conditions',
			intro: 'The little badge between two runes is a connector. It decides <i>when</i> the next rune runs.',
			diagram: 'conn',
			sections: [
				{ h: 'Using them', steps: [
					'Click a connector badge in the forge.',
					'Choose <b>Instant</b>, <b>Delay</b> (set the time) or <b>Condition</b>.',
					'For a condition, pick what to wait for — there are 35 of them.'
				] },
				{ h: 'Useful conditions', list: [
					'<b>Energy contacts a surface</b> / <b>This spell hits an enemy</b> — follow-ups on impact.',
					'<b>Target is nearby</b> / <b>Enemy is nearby</b> — mines and traps.',
					'<b>You press the trigger key (T)</b> — detonate when <i>you</i> decide.',
					'<b>Energy has stopped</b>, <b>Energy reaches its destination</b> — chain movements.',
					'<b>The rest of the spell is finished</b> — a clean final step.',
					'<b>Its energy remembers… (spell memory)</b> — react to what already happened to the energy.'
				] },
				{ h: 'Example: a mine', p: 'Generate → Compress → Anchor (anchored here) → <i>Condition: Enemy is nearby</i> → Discharge. Place it, walk away, and it bursts when something comes close.' }
			] },

		{ id: 'logic', cat: 'magic', icon: '↻', title: 'Conditional and Loop',
			intro: 'Two <b>Logic</b> runes. Conditional waits and chooses; Loop repeats. Every rune now has eight sockets, so up to 8 branches can leave one rune.',
			sections: [
				{ h: 'Conditional ❖', steps: [
					'Place it where the spell should wait. It hands its energy and target on unchanged.',
					'Add up to 8 branches. Each one is a <b>Wait until</b> connector (new branches under a Conditional start that way) — pick the condition for each.',
					'<b>Branches fire:</b> <i>each</i> starts a branch when its own condition occurs; <i>only the first</i> lets one win and cancels the rest (a switch); <i>every time</i> lets each branch fire again whenever its condition recurs, up to a limit, with a rest between firings.',
					'Example: enemy within 150 px → fire a bolt; you fall below 30% health → heal; you press T → detonate. One Conditional, three branches.'
				] },
				{ h: 'Loop ↻', steps: [
					'Place it at the end of the part you want repeated. Set <b>Repeats</b> (1–10) and the <b>pause between passes</b>.',
					'<b>Pull the ⟲ handle</b> on the Loop onto an EARLIER rune on its own branch. A dashed arrow shows where it returns; that rune and everything down to the Loop run again each pass.',
					'Click the <b>↻ badge</b> on the arrow to give the return branch a condition: <b>When it happens</b> waits for it before each repeat (and gives up after a while); <b>While still true</b> checks at that moment — the target is still alive, the energy is still there — and ends the loop the moment it is not.',
					'Runes after the Loop run once, when the repeats are done (or when the loop ends early).'
				] },
				{ h: 'What a Loop costs', list: [
					'Every repeat costs the repeated runes\' mana <b>× 1.5</b>, paid when the repeat starts. The spell\'s cost shows the whole loop (“+N ↻”).',
					'If you do not have the mana when a repeat starts, the loop ends there.',
					'A loop inside a split repeats only its own branch. One spell can make at most 300 repeats in all.',
					'Example: Generate → Redirect → Discharge → Loop ×4 back to Generate = five bolts, one after another.'
				] }
			] },

		{ id: 'compress', lesson: 'spear', cat: 'magic', icon: '◈', title: 'Compression and shapes',
			intro: 'Compress / Shape is the most important rune after Generate. It sets how dense the energy is and what shape it takes.',
			diagram: 'comp',
			sections: [
				{ h: 'Power from −10 to 50', list: [
					'<b>Negative</b> expands the energy: larger, weaker, wispier — good for clouds and zones.',
					'<b>0–10</b> compresses it: smaller, denser, harder hitting.',
					'<b>Past 10 it over-compresses</b>: much smaller, much stronger, pierces through enemies and lasts far longer — but it is a little unstable, and redirecting it can make it explode. Control makes it steadier.',
					'Each level needs a minimum amount of energy or it collapses (about 11 E at 10, 28 at 20, 127 at 50).'
				] },
				{ h: 'Shapes', list: [
					'Built in: sphere, sword, crescent blade, spear, spike, arrow, disc, ring, star, cube, wave, fist, hammer, point, line, arc, cone, wall, tether and spiral.',
					'<b>Draw your own</b>: choose the drawing option to open the shape editor — brush, eraser, mirror, and built-in shapes you can drag, stretch and turn. The outline becomes a real hit shape.',
					'<b>★ Save to library</b> keeps a drawing (up to 80) so you can pick it again in one click.'
				] }
			],
			tip: 'Compress before you apply Gravity — gravity energy itself cannot be compressed.' },

		{ id: 'techniques', lesson: 'firebolt', cat: 'magic', icon: '✧', title: 'Techniques',
			intro: 'A technique is a magical law you give to energy with the ✧ Technique rune. You unlock them by putting Technique Points into them in the forge\'s Techniques panel.',
			sections: [
				{ h: 'The six techniques', keys: [
					['🔥 Thermal', 'Burns on hit (reverse: chills and slows). Looks like flame or snowflakes'],
					['💨 Kinetic', 'Fast (8–15 speed), bounces off surfaces, hits hard. Into other energy it adds speed'],
					['🌀 Spatial', 'Makes a portal (reverse: a bounce surface). Portals carry energy through for free'],
					['⚫ Gravity', 'A small black hole that pulls (reverse: pushes). Bends spells and slows creatures; does no damage itself'],
					['☀️ Light', 'Always travels at 18 and passes through everything'],
					['🚫 Anti-Magic', 'Eats other magic by amount and suppresses techniques, zones and portals (reverse: restores magic)']
				] },
				{ h: 'Rules', list: [
					'Techniques <b>don\'t stack</b>: a different technique converts the energy; the same one adds; its reverse cancels it.',
					'<b>Technique → Remove</b> makes the energy raw again.',
					'More points in a technique make it stronger and cheaper, with diminishing returns.',
					'Two more exist for later: <b>Construction</b> and <b>Infinity</b> (see Advanced magic).'
				] }
			] },

		{ id: 'zones', lesson: 'zone', cat: 'magic', icon: '◎', title: 'Zones and Draw Out',
			intro: 'A zone is a space that stores energy. It is how big spells are fuelled without spending all of your own energy.',
			sections: [
				{ h: 'Filling a zone', steps: [
					'<b>◎ Create Zone</b> — opens an empty zone. A bigger zone holds more (Control sets your largest).',
					'<b>⌖ Target</b> the environment (or other energy).',
					'<b>⇩ Draw Out</b> — set an amount. The energy flows into the zone over the duration, and the branch now holds it.',
					'Shape it, give it a technique and send it, as with any energy.'
				] },
				{ h: 'Good to know', list: [
					'Drawing too much at once strains the draw: some spills, and pushed too far it backlashes.',
					'Zones fade once their spell is finished — unless a technique gave the zone a <b>zone law</b> (heat, light, gravity…), which lasts a full minute.',
					'<b>Target → Zone</b> picks an existing zone to work with.'
				] }
			] },

		{ id: 'passive', lesson: 'armour', cat: 'magic', icon: '∞', title: 'Passive spells and clearing',
			intro: 'Some spells should stay on — a reinforcement, an aura, an orbiting shield.',
			sections: [
				{ h: 'Passives', list: [
					'In the forge, press <b>∞ Passive</b>. The spell becomes a toggle.',
					'Cast it to switch it on; cast it again to switch it off.',
					'While on, it drains a little energy every second.'
				] },
				{ h: 'Clearing', p: 'Press ' + K('O') + ' to end all of your spells and passives at once and dissolve your constructs. Handy when a build goes wrong.' }
			] },

		/* ============================== ADVANCED */
		{ id: 'anchor', cat: 'advanced', icon: '⚓', title: 'Anchor / State and tethers',
			intro: 'The Anchor / State rune decides how energy holds its place.',
			sections: [
				{ h: 'States', keys: [
					['Anchored', 'Stays put — here, on the target, or on you'], ['Free', 'Drifts freely'], ['Attached', 'Rides along with something'],
					['Guided', 'Follows your aim'], ['Bound', 'Tied with a tether (1–8 cords)']
				] },
				{ h: 'Bound energy', list: [
					'Bind to the target, to you (it follows you or pulls you), or to your nearest other energy (the two are drawn together).',
					'<b>Strength 1–10</b> sets drag, hold and cost. Fast, strong energy crossing the cord snaps it.',
					'An ordinary cord strikes enemies that touch it.',
					'With <b>Kinetic</b>, the cord is solid: it catches enemy magic and flings it back, and creatures can stand on it or bounce off it like a trampoline.'
				] }
			] },

		{ id: 'reinforce', lesson: 'armour', cat: 'advanced', icon: '⛨', title: 'Reinforcement',
			intro: 'Reinforcement pours energy into something that already exists to make it stronger. It needs no Technique Points.',
			sections: [
				{ h: 'Targets', keys: [
					['Yourself', 'Mostly damage resistance, plus a little melee, run and jump'], ['Legs', 'Run faster and jump higher (costs energy while moving)'],
					['Arms', 'Melee damage (3 energy per attack)'], ['Weapon', 'Your weapon, shaped by the energy\'s technique (Thermal burns, Spatial strikes through a portal)'],
					['Ally', 'Strengthens a friend'], ['Spell / energy', 'Adds to another spell — see below'], ['Construct', 'Repairs it']
				] },
				{ h: 'Energy into energy', list: [
					'Same kind adds. A technique into its reverse cancels.',
					'Kinetic → more speed. Light → more energy. Thermal → burn or chill on hit. Gravity → heavy or floating.',
					'Spatial → swap positions. Anti-Magic → consumes it (reverse restores it).'
				] }
			] },

		{ id: 'domain', cat: 'advanced', icon: '⦿', title: 'Domain Expansion',
			intro: 'A domain turns a full zone into a space with its own rules, applied to every foe inside.',
			sections: [
				{ h: 'Opening one', steps: [
					'Fill a zone with 120 E or more (or let the domain pour in your own energy as it opens).',
					'Add <b>⦿ Domain Expansion</b> (needs Control 6+). Set 3–20 seconds.',
					'Every domain is exactly <b>1400 px</b> in radius, whatever zone it grew from, and costs <b>14 mana for every second it lasts</b> on top of its other costs.',
					'Every branch under it is a <b>rule</b>: Instant runs once as it opens, Delay repeats, Condition fires per foe whenever it is met.',
					'Choose closed (a barrier) or open, and optionally sure-hit.'
				] },
				{ h: 'Laws: rules that always hold', steps: [
					'Place a <b>§ Domain Law</b> directly under the domain. Read it as a sentence: <b>Who</b> (every foe / you), <b>When</b> (constantly, every few seconds, they attack, move, stand still, jump, are hurt, are low, carry marks…), <b>Then</b> (damage, stun, bind, seal casting, mark, copy a spell…).',
					'Laws are checked for every foe inside, all the time. Each one has a weight, and the total must fit what your Energy Control holds (a <b>Declared</b> vow holds more).',
					'<b>Marks</b> build a trial: mark each offence, then a law that fires at three marks hands down the sentence. <b>Copy</b> keeps the spells foes cast; <b>cast a copy</b> throws them back from the domain\'s own energy.'
				] },
				{ h: 'The opening and the look', list: [
					'<b>Opening: Full</b> — a breath gathers, the world freezes for a moment, then the domain bursts out. Quick and None are shorter.',
					'<b>🎨 Design the look</b> on the Domain rune opens the <b>Domain Designer</b>: a world of its own replaces the level inside your domain — a sky, a landmark on the horizon, a floor that meets the real ground, a sigil, two kinds of drifting particles, an edge, light, the burst and the title.',
					'Start from one of 25 presets or the <b>Ideas</b> tab, then change any layer. <b>🔒</b> locks a layer, <b>🎲</b> rolls one (or press R to roll every unlocked layer). Space plays the opening in the preview.',
					'<b>⇄ Code</b> copies the look as a short code you can share, or loads someone else\'s.',
					'From outside a sealed domain you cannot see what is inside it — the <b>Outside</b> tab picks what they see instead (a glowing shell, a black sphere, a mirror, a cocoon…).'
				] },
				{ h: 'Good to know', list: [
					'The energy you put into a domain is spent on it: it disappears from the world, cannot be targeted, drawn back out or claimed, and only the domain\'s own rules use it up. A longer domain burns more of it.',
					'<b>Overwhelm</b> (+30 cost) stuns everyone inside for a moment as it opens.',
					'Vows make it stronger: shared (rules can hit you) ×1.5, brief ×1.3, narrow ×1.3 (narrow squeezes the domain to 60% of its size).',
					'One domain at a time. Two domains clash and the more refined one wins.',
					'Afterwards you suffer <b>burnout</b>: Technique runes fail for a while.'
				] }
			] },

		{ id: 'bindingvows', cat: 'advanced', icon: '⛓', title: 'Binding Vows',
			intro: 'The ⛓ Binding Vow rune is a contract. You choose a condition to meet and a restriction to accept; keep the vow and it pays out. Vows are free: no mana, no extra cooldown, and the energy they grant never counts against your Max Output.',
			sections: [
				{ h: 'Every vow has', keys: [
					['Condition', 'What must happen: travel 600 px, wait 2 s, hit three times in a row…'],
					['Commitment', 'What it gives up while the vow holds: no turning, no splitting, no melee…'],
					['Reward', 'Bonus energy for the bound energy, or a stat change for you'],
					['If broken', 'Energy vows: lose the bonus, lose 35% of the energy (+15% reward) or have it destroyed (+30% reward)']
				] },
				{ h: 'Energy vows (bind the energy in the branch)', keys: [
					['Unerring Path', 'Flies straight after launch; the longer the straight flight, the bigger the hit'],
					['Solitude', 'Stays one body (no Split / Divide); it leaks less and hits harder'],
					['Long Journey', 'Must travel a set distance before striking'],
					['Patience', 'Passes through enemies harmlessly until the wait is over, then strikes hard'],
					['Final Fragment', 'Paid when every other branch of the spell has finished'],
					['Gauntlet', 'Must pass through your zones, constructs or still energy (gates) first'],
					['Named Prey', 'Swears it on the enemy you are targeting; others break it or are passed through'],
					['Untouched', 'Survives a while without hostile magic touching it'],
					['Sacrifice', 'Gives up part of the rest of the spell, or your health, for energy now'],
					['Perfect Sequence', 'Is the last of several pieces of the spell to strike in time'],
					['Stillness', 'You hold your ground for a while'],
					['Absolute Compression', 'Reaches a compression and keeps it until it strikes']
				] },
				{ h: 'Vows that bind you', list: [
					'<b>Passive</b> vows reward a way of playing over time: Still Mind (no casting → regen or a charge), Immovable Resolve, Dormant Power, Sealed Hand, Singular Purpose, Unarmed Sage, First Spark, Conservation, Lone Star, Patient Guardian, Unbroken Thread, Narrow Gate.',
					'<b>Attribute</b> vows give up a freedom for Strength, Defense, Mana, Mana Control or Magic Power: Iron Fist, Duelist, Physical Mastery, Unbroken Guard, Open Gate (no dash), Last Stand, Deep Reservoir, Scarcity, Unspent Cup, Few Words, Precision, Closed Circuit, Glass Cannon, Charged Heart, Forbidden Technique.',
					'<b>Exchange</b> vows trade one stat for another at uneven rates: Arcane Glass, Iron Vessel, Empty Mind, Overflowing Mind, Vast Reservoir, Explosive Vessel.',
					'They hold while their spell runs — put them in a <b>∞ passive</b> spell to keep them up. What you have sworn shows under your mana bars; breaking a rule switches a vow off for a few seconds.'
				] },
				{ h: 'A worked example: Mirror War', list: [
						'The <b>Scroll of Mirror War</b> (the 🪞 button in the inventory) holds a 61-rune spell: one Generate, a cascade of Splits and five families of projectiles — Harriers, Sweepers, Crossfire, Reserves, Executors — released one after another with Delay connectors. Open it in the forge to read it.',
						'It carries seven contracts of five kinds, each where its restriction is real: <b>Unerring Path</b> on two harriers, <b>Patience</b> on the wave that waits holding still, <b>Long Journey</b> on two crossfire arrows, <b>Absolute Compression</b> on one spear (sworn before it is compressed) and <b>Solitude</b> on another (after its last split).',
						'It needs Energy Control 17 for its 61 runes, and its output is far over an ordinary Max Output — you pay the rest in Total Mana. Nothing in it homes: every projectile is aimed once at your cursor when it is released.'
					] },
					{ h: 'Fair play', list: [
					'One contract pays once — energy split from a bound body shares its contract.',
					'Vow bonuses add from the energy\'s own part, never multiply each other, and stop at +150%.',
					'Stat vows are clamped, so stacking many cannot make you invulnerable or one-shot everything.',
					'The forge shows the whole contract (condition, commitment, reward, difficulty, what breaking it costs) when you select the rune.'
				] }
			] },

		{ id: 'construct', lesson: 'construct', cat: 'advanced', icon: '🧱', title: 'Construction',
			intro: 'The Construction technique turns energy into a solid object shaped by its Shape.',
			sections: [
				{ h: 'Constructs', list: [
					'Bigger with more energy, tougher with more compression.',
					'Real collision: stand on it, ride it, block walls of projectiles. Light is blocked by it.',
					'It cracks as it takes damage and shatters; it lasts 40–120 s. Up to 12 at once.',
					'Rotate turns it. Give it a Gravity core with reinforcement to make it heavy or floating, then target that energy to move it.',
					'Reverse Construction (after <i>Target → Construct</i>) takes yours apart back into raw energy.',
					'<b>Crushing:</b> a construct that falls on someone, or pins them against a wall or the ground, crushes them — you too. Your <b>Defence</b> and <b>reinforcing yourself</b> let you brace and hold it up instead.'
				] }
			] },

		{ id: 'infinity', cat: 'advanced', icon: '♾️', title: 'Infinity',
			intro: 'The deepest technique. Enough energy (450+ E) at Compression 20 or more becomes an Infinity source — a reservoir of its own kind of energy.',
			sections: [
				{ h: 'Using a source', list: [
					'<b>Draw Out</b> from it pulls that kind of energy out, without limit.',
					'Compression is its stability. Over-drawing, Anti-Magic or very powerful spells build stress — and then it explodes.',
					'Gravity drawn from a source pulls far harder; Spatial drawn from it and reinforced into you makes a distance layer that nothing quite reaches.',
					'Infinity Gravity or Spatial meeting its own reverse tears space (a rupture that swallows other magic — only Anti-Magic undoes it).'
				] }
			],
			tip: 'Aster Vael, the boss, is built entirely on Infinity. Watching him is the best lesson.' },

		/* ============================== COMBAT */
		{ id: 'melee', lesson: 'weapons', cat: 'combat', icon: '🗡️', title: 'Melee weapons',
			intro: 'Weapons live in your spell slots. Select a weapon slot and you fight with it; select a spell slot and you cast. Dash and parry always work.',
			sections: [
				{ h: 'Attacks', keys: [
					['Click / J', 'Combo: tap again on hit for the next strike'], ['W + attack', 'Launcher on the ground; rising strike in the air'],
					['S + attack', 'In the air: plunge'], ['Attack in the air', 'Air combo'], ['R', 'Special (some weapons charge while held)']
				] },
				{ h: 'Defence', keys: [
					['Q (or right-click)', 'Parry — time it as the hit lands to block it and open a riposte. It turns aside spells too (see below)'], ['Shift', 'Dash — a short burst with brief invulnerability; it can cancel attacks']
				] },
				{ h: 'Parrying spells', list: [
					'A parry can turn aside enemy projectiles and the energy of enemy casters — but only a spell the weapon can <b>bear</b>. A spell\'s strength is its damage plus a quarter of its energy; a stronger one goes straight through your guard ("Too strong to parry" shows both numbers).',
					'<b>Parry capacity</b>: the weapon\'s own power (its first strike), plus the reinforcement poured into it, plus your Strength (+2% a point), plus a heavy (Gravity) weapon. Reinforce the weapon with <b>Target → Weapon</b> and it parries far stronger spells.',
					'A weapon reinforced with <b>Anti-Magic</b> also <b>reflects</b> what it parries — the spell flies back at its caster, weaker and stripped of its element — and bears more against magic.',
					'Parrying strains the reinforcement: a bigger spell costs the weapon more of it, a reflection twice as much.'
				] },
				{ h: 'Weapons', p: 'Apprentice Blade, Twin Daggers, Spear, Greatsword, Gauntlets, War Hammer, Scythe, Glaive, Whip, Chain Blade and Staff. Each has its own speed, reach and combo. Try them in the Sandbox — press ' + K('P') + ' there for the training yard and ' + K('F8') + ' to see hitboxes.' }
			],
			tip: 'Reinforce your arms or weapon with a passive spell to make every swing stronger — and to parry stronger spells.' },

		{ id: 'items', cat: 'combat', icon: '💎', title: 'Engraving and magical items',
			intro: 'Two ways to mix weapons and magic.',
			sections: [
				{ h: 'Engraving', steps: [
					'Click a weapon slot and choose <b>✎ Engrave a spell</b>.',
					'Build the spell in the forge as usual.',
					'Now the spell casts every time the weapon\'s special strikes.'
				] },
				{ h: 'Magical items (made from your own energy)', steps: [
					'Put a <b>Magical item</b> in a slot.',
					'Build a spell that compresses energy to 20+ as a fist, sword, spear or hammer.',
					'Redirect it <b>Into your inventory</b>. The item now looks exactly like that energy.',
					'Feed it more of the same shape to make it stronger.'
				] },
				{ h: 'Using an item', list: [
					'Swing it like a weapon (3 energy each). It costs a little energy to keep while it sits in a slot.',
					'<b>R</b>: a throw that comes back (Kinetic throws harder, Thermal leaves flames), a Light beam (hold), or an Anti-Magic slash.',
					'Items last only for the run: they are gone when you reload or die. ' + K('P') + ' lets go of the one you hold.'
				] }
			] },

		{ id: 'enemies', cat: 'combat', icon: '👹', title: 'Enemy mages and bosses',
			intro: 'Some enemies use the same magic and weapons you do — and they play like a decent player.',
			sections: [
				{ h: 'Rune mages', list: [
					'<b>Vesk</b> (Kinetic + Light), <b>Morrow</b> (Construction + Gravity), <b>Sola</b> (Thermal + Spatial). Each has a trademark zone spell.',
					'They keep their distance, strafe and wind up before big spells — watch for the tell.'
				] },
				{ h: 'Melee fighters', list: [
					'<b>Kael</b> (gauntlets), <b>Brannoc</b> (hammer), <b>Sythe</b> (daggers, Rift Step). You can parry them just like any attack.'
				] },
				{ h: 'Aster Vael, the Boundless', p: 'A three-phase boss built on Infinity and Gravity, wrapped in a distance layer that drains as you hit him. Anti-Magic and sure-hit domains break through it.' }
			],
			tip: 'Fight them in Sandbox → ⚔ Mage Arena.' },

		/* ============================== CHARACTER */
		{ id: 'gear', cat: 'character', icon: '🛡️', title: 'Gear, collection and crafting',
			intro: 'Gear changes your stats and adds special effects that react to the spells you cast.',
			sections: [
				{ h: 'Equipping', steps: ['Open the <b>📦 Inventory</b> tab.', 'Click an item to inspect it, then press <b>Equip</b>.', 'It goes into its Equipment slot on the left (staff, robe, two relics). The ✕ there takes it off.'] },
				{ h: 'How gear reads your spells', list: [
					'Effects look at your runes: Thermal counts as fire, reverse Thermal as frost, Discharge as an explosion, Divide into 3+ as a barrage, Target → enemy as homing, and so on.',
					'Some gear grows your spells (more energy, wider zones), some trims costs or cooldowns.'
				] },
				{ h: 'Finding and making it', list: [
					'Dungeon chests and bosses drop gear and materials. The <b>📖 Collection</b> tab shows everything each dungeon can drop.',
					'The <b>🔨 Crafting</b> tab turns materials into gear.'
				] }
			] },

		{ id: 'vows', cat: 'character', icon: '📿', title: 'Vows, classes and loadouts',
			intro: 'Three ways to specialise your mage.',
			sections: [
				{ h: 'Vows', p: 'A vow trades something away — health, energy, a slot — for a boost to one spell slot (power, cost, cooldown, crit…). Click an empty vow (V1–V3) in the <b>Vows</b> panel under your spells to make one. A <b>Domain Vow</b> powers up your domains the same way.' },
				{ h: 'Classes', keys: [
					['Necromancer', 'Raises defeated foes'], ['Dominion Master', 'Bigger, stronger domains'], ['Ranger', 'Long range; F teleports'],
					['Warrior', 'Melee bonuses; F Spell Blade reflects projectiles'], ['Healer', 'Takes less damage; healing is stronger'], ['Archmage', '+5 Control; elemental spells hit harder']
				] },
				{ h: 'Loadouts', p: 'Save all ten slots as a loadout with <b>📦 Loadouts</b>, then swap builds in one click.' }
			] },

		{ id: 'bestiary', cat: 'character', icon: '📖', title: 'Bestiary and dictionary',
			intro: 'Two reference books in the inventory.',
			sections: [
				{ h: 'Bestiary', p: 'Every creature you have met, with its health, attacks and where it lives. Unknown creatures show as ❓ until you find them.' },
				{ h: 'Spell Dictionary', p: 'Shapes, behaviours, effects, domains and classes, explained one by one.' },
				{ h: 'Reading enemy attacks', p: 'Creatures warn you before a big attack. A glow gathering on them means a cast is coming. A coloured circle, line or box on the ground marks where it will land, and it fills in as the hit gets closer. Rings that shrink around you usually have a gap: get out through the gap before they close. A decoy can still burst when the real attack lands, so do not stand on any marked spot.' },
				{ h: 'Mini-bosses', p: 'The Frostbound Knight, Magma Warden, Storm Raptor and Elder Treant each fight with their own moveset, and every big attack is marked first: a filling warning shape on the ground or in the air. Ground waves can be jumped. After a heavy attack they need a moment to recover, which is your chance to strike. The Knight can raise his GUARD: strike him then and he counters.' },
				{ h: 'Mini-boss tiers', p: '★ Alpha versions chain attacks together and make bigger patterns. ★★ Elder versions look different and learn new attacks (ice sigils, eruption vents, storm clouds, spore bombs and more). ★★★ Tyrants are a different sight altogether (the Winter Tyrant, Molten Tyrant, Tempest Sovereign and Blighted Elder). They use every attack, reach a second phase under 55% health with an ultimate (Absolute Zero, Meltdown, Eye of the Storm, the World Tree), and are tougher than a dungeon boss. In Survival they climb tiers as the waves go on: Alpha from wave 15, Elder from 30, Tyrant from 45. You can spawn any tier from the Spawn Menu.' },
				{ h: 'Fair warning', p: 'Hazards that appear on top of you cannot hurt for about half a second, and show a warning ring while they are harmless. Rushes, leaps and strikes from range now charge up first, with a gathering glow and a ! over the enemy. Stand in a hazard after the ring fades and it still hits in full, and enemies already next to you strike without delay.' },
				{ h: 'Boss versions', p: 'In Survival, some enemies come as boss versions, from wave 5 on. You can tell them by the crown, the name plate and the glowing ring at their feet. They are bigger, tougher and faster, and their attacks are larger, quicker and hit harder, with split shots. <b>★ Alpha</b> (wave 5+) is the first step. <b>★★ Elder</b> (wave 15+) also repeats each attack a moment later and sends out a shockwave along the ground (jump over it when the ground glows). <b>★★★ Tyrant</b> (wave 30+) also becomes enraged at half health and bursts into a ring of shards. They show up more often as the waves climb, and they drop extra loot.' }
			] },

		/* ============================== WORLD */
		{ id: 'openworld', lesson: 'world', cat: 'world', icon: '🏞️', title: 'EmberFall and the open world',
			intro: 'EmberFall is a walled city on the frontier, with roads running west, north and into the frozen mountains. Everything is one continuous world.',
			sections: [
				{ h: 'Interacting', keys: [
					['E near a person', 'Talk. Some offer a shop, some a task'], ['E at a door', 'Go inside (some doors are locked until you find a key)'],
					['E at a cave mouth', 'Climb in; E again at the daylight to climb out'], ['E at a glint', 'Take loot, read a stone, pull a lever, push a rock']
				] },
				{ h: 'Tasks', steps: [
					'Talk to someone with a problem — a lost pack, a blocked road, a missing strongbox.',
					'Do what they ask. Their words change as you make progress.',
					'Talk to them again for the reward. Some rewards open new paths or reveal hidden caches.'
				] },
				{ h: 'Getting there', p: 'Open <b>Map → World Map</b> on the main menu and choose EmberFall, or pick a road on <b>Map → Grid Map</b> to start on it.' }
			],
			tip: 'Loot you haven\'t taken glints softly. Hidden caches only glint once someone tells you where to look.' },

		{ id: 'roads', cat: 'world', icon: '🧭', title: 'Roads, junctions and the N map',
			intro: 'The roads follow the lines of the world grid (columns A–S, rows 1–13). Where two roads meet there is a crossroads.',
			diagram: 'junction',
			sections: [
				{ h: 'Turning and going straight', list: [
					'<b>Straight on</b> — if the next road carries on in the same direction, just keep walking. There is no transition.',
					'<b>Turning</b> — at a fingerpost, press ' + K('L') + ' to turn onto the road it points to. You arrive at the same spot on the other road, at the same height and in the same weather.'
				] },
				{ h: 'The N map', list: [
					'Press ' + K('N') + ' anywhere to see the world map with its grid.',
					'In the open world the road you are on is highlighted, with a marker for how far along it you are.',
					'In a dungeon the marker shows the place it lies under, and how deep you are.',
					'N or Esc closes it. The game pauses while it is open (not in co-op).'
				] },
				{ h: 'The roads so far', keys: [
					['I6 – J6', 'The Western Approach'], ['J6 – K6', 'EmberFall City'], ['J6 – J5 – J4', 'The King\'s North Road, straight on into the Northwatch Pass'],
					['I6 – I5 – I4', 'The Upper Millstream, straight on into the Pineward Rise'], ['I5 – J5', 'The Frostline Causeway'], ['I4 – J4', 'The Highland Traverse']
				] }
			] },

		/* ============================== MODES */
		{ id: 'dungeons', cat: 'modes', icon: '🔥', title: 'Dungeons',
			intro: 'Three deep dungeons, each a long run of rooms that ends with a final boss.',
			sections: [
				{ h: 'The three', keys: [
					['🔥 The Inferno Depths', 'Lava, flame creatures, and a heat meter that rises the deeper you go'],
					['❄️ The Glacial Reach', 'Ice and blizzards. Frost builds up on you — warm yourself where you can'],
					['🌿 The Living Wilds', 'A vertical world of roots and ruins whose ecosystem notices you more the more you fight']
				] },
				{ h: 'Running one', steps: [
					'On the Dungeons page, click a dungeon to inspect it and choose a difficulty.',
					'Clear each room to move on. Rooms marked <b>OPTIONAL</b> hold puzzles, shrines, vaults and better loot.',
					'The minimap (top left) shows the rooms around you; <b>Full</b> opens the whole map.',
					'A mini boss waits partway; the final boss waits at the bottom.'
				] },
				{ h: 'Co-op', p: 'Choose <b>Create Room</b> and share the code, or <b>Join with Code</b>. Up to four mages per run.' }
			] },

		{ id: 'sandbox', cat: 'modes', icon: '🎯', title: 'Sandbox and the Mage Arena',
			intro: 'The place to experiment.',
			sections: [
				{ h: 'Sandbox', list: ['Training dummies to test damage.', 'No risk: try every spell and weapon.', 'Press P for the training yard, F8 for hitboxes.'] },
				{ h: '⚔ Mage Arena', p: 'A huge open floor where the rune mages and melee fighters are summoned in the middle. The best practice for PvP.' },
				{ h: '☰ Spawn Menu', p: 'In the Sandbox and the Mage Arena, the green Spawn Menu button opens a list of every enemy, mini-boss and boss (plus the rune mages). Pick a version (Alpha, Elder or Tyrant), add Nightmare mutations, choose how many, and click an entry. Passive makes them stand still and ∞ Training makes them unkillable, so you can test a spell on them. Clear spawned removes them again.' }
			] },

		{ id: 'pvp', cat: 'modes', icon: '🤺', title: 'PvP duels',
			intro: 'Duel another player with your full kit: rune spells, passives and weapons.',
			sections: [
				{ h: 'Starting a duel', steps: [
					'Choose <b>PvP</b> on the main menu: <b>Casual Play</b> puts you in the queue, <b>Create Private Match</b> makes a code for a friend, and <b>Join with Code</b> uses theirs.',
					'The host picks the arena: The Grand Colosseum, Glowroot Cavern, and the ember, frost and storm arenas.',
					'First to win the rounds takes the match; you can ask for a rematch.'
				] },
				{ h: 'Tips', list: ['Parry works against your opponent\'s weapon too.', 'Each arena has its own hazards — the Colosseum has none, the Cavern has rockfalls and darkness.', 'Practise in the Mage Arena first.'] }
			] },

		{ id: 'raids', cat: 'modes', icon: '👑', title: 'Raid bosses',
			intro: 'Huge bosses with tens of thousands of HP, several phases and attacks you have to learn.',
			sections: [
				{ h: 'The raids', keys: [
					['🌑 The Void Arbiter', '50,000 HP, 3 phases — sweeping lances, marching eruptions, mirror reflections, a sentence you share by stacking, a damage check and an encroaching void. In co-op he hunts a new player after every attack; he enrages after 7 minutes'],
					['⌛ The Chrono Tyrant', '60,000 HP, 3 phases — time vortices, chrono dashes and rewinds'],
					['✦ Zenith', 'Four stages; its seven Wills adapt to the way you play']
				] },
				{ h: 'Going in', p: 'Choose <b>Challenge Boss</b> to go alone or <b>Co-op Raid</b> to bring friends.' }
			] }
	];

	/* ---------------------------------------------------------------- state */
	const READ_KEY = 'magicBattle_tutorialsRead';
	function readSet() { try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) || '[]')); } catch (e) { return new Set(); } }
	function markRead(id) { const s = readSet(); s.add(id); try { localStorage.setItem(READ_KEY, JSON.stringify([...s])); } catch (e) {} }

	/* ---------------------------------------------------------------- rendering */
	const CSS = `
.tu-wrap{display:flex;gap:14px;min-height:0;flex:1;height:100%}
.tu-side{width:250px;flex-shrink:0;display:flex;flex-direction:column;gap:8px;min-height:0}
.tu-search{width:100%;box-sizing:border-box;padding:7px 10px;border-radius:8px;border:1px solid var(--border,#444);background:var(--panel2,#1b1b2b);color:var(--text,#eee);font-size:13px}
.tu-prog{font-size:11px;color:var(--muted,#999)}
.tu-prog i{display:block;height:5px;border-radius:3px;background:rgba(255,255,255,.08);margin-top:4px;overflow:hidden}
.tu-prog i b{display:block;height:100%;background:linear-gradient(90deg,#8e44ad,#c9a8ff)}
.tu-list{overflow-y:auto;flex:1;padding-right:4px}
.tu-cat{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted,#999);margin:10px 0 4px}
.tu-item{display:flex;align-items:center;gap:8px;width:100%;text-align:left;padding:6px 8px;margin:2px 0;border-radius:7px;border:1px solid transparent;background:none;color:var(--text,#eee);cursor:pointer;font-size:13px}
.tu-item:hover{background:rgba(255,255,255,.05)}
.tu-item.on{background:rgba(155,89,182,.18);border-color:rgba(201,168,255,.45)}
.tu-item .tu-ic{width:20px;text-align:center}
.tu-item .tu-ok{margin-left:auto;color:#2ecc71;font-size:12px}
.tu-main{flex:1;min-width:0;overflow-y:auto;padding:4px 10px 20px 4px}
.tu-h1{font-size:22px;margin:4px 0 6px;display:flex;align-items:center;gap:10px}
.tu-intro{color:var(--muted,#bbb);font-size:14px;line-height:1.55;margin-bottom:12px}
.tu-sec{background:var(--panel2,rgba(255,255,255,.03));border:1px solid var(--border,#333);border-radius:10px;padding:12px 14px;margin:10px 0}
.tu-sec h3{margin:0 0 8px;font-size:15px;color:#f3e6c4}
.tu-sec p,.tu-sec li{font-size:13px;line-height:1.6}
.tu-sec ul,.tu-sec ol{margin:0;padding-left:20px}
.tu-sec ol li::marker{color:#c9a8ff;font-weight:bold}
.tu-keys{display:grid;grid-template-columns:minmax(120px,max-content) 1fr;gap:5px 14px;font-size:13px}
.tu-keys .k{font-weight:bold;color:#ffe27a;white-space:nowrap}
.tu-tip{margin:12px 0;padding:10px 12px;border-left:3px solid #f1c40f;background:rgba(241,196,15,.08);border-radius:0 8px 8px 0;font-size:13px}
.tu-svg{width:100%;max-width:560px;display:block;margin:6px auto 4px;background:rgba(0,0,0,.25);border-radius:10px}
.tu-nav{display:flex;gap:8px;justify-content:space-between;margin-top:16px}
.tu-btn{padding:7px 14px;border-radius:8px;border:1px solid var(--border,#555);background:var(--panel2,#222);color:var(--text,#eee);cursor:pointer;font-size:13px}
.tu-btn.pri{background:rgba(155,89,182,.35);border-color:#c9a8ff}
.tu-cat-lesson{color:#ffe27a}
.tu-item.tu-lesson{background:rgba(255,226,122,.05)}
.tu-badge{font-size:12px;color:#2ecc71;border:1px solid #2ecc71;border-radius:10px;padding:1px 8px;margin-left:8px}
.tu-tryit{display:flex;align-items:center;gap:12px;justify-content:space-between;margin:14px 0;padding:12px 14px;border:1px dashed rgba(255,226,122,.5);border-radius:10px;font-size:13px}
.tu-wrap kbd{display:inline-block;padding:1px 6px;border-radius:4px;border:1px solid #777;border-bottom-width:2px;background:#2a2a3a;font:12px monospace;color:#fff}
@media (max-width:760px){.tu-wrap{flex-direction:column}.tu-side{width:auto;max-height:240px}}
`;
	let host = null, cur = null, query = '';
	function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
	function mount(h) {
		host = h;
		if (!document.getElementById('tu-css')) { const st = el('style'); st.id = 'tu-css'; st.textContent = CSS; document.head.appendChild(st); }
		host.innerHTML = '';
		const wrap = el('div', 'tu-wrap');
		const side = el('div', 'tu-side');
		const search = el('input', 'tu-search');
		search.placeholder = '🔍 Search tutorials…';
		search.addEventListener('input', () => { query = search.value.trim().toLowerCase(); renderList(); });
		side.appendChild(search);
		side.appendChild(el('div', 'tu-prog'));
		side.appendChild(el('div', 'tu-list'));
		wrap.appendChild(side);
		wrap.appendChild(el('div', 'tu-main'));
		host.appendChild(wrap);
		renderList();
		const C = global.TutorialCoach;
		open(cur || (C && C.lessons().length ? 'L:' + C.lessons()[0].id : T[0].id));
	}
	function matches(t) {
		if (!query) return true;
		const blob = (t.title + ' ' + t.intro + ' ' + JSON.stringify(t.sections)).toLowerCase();
		return query.split(/\s+/).every(w => blob.includes(w));
	}
	function renderList() {
		if (!host) return;
		const list = host.querySelector('.tu-list');
		const read = readSet();
		list.innerHTML = '';
		const C = global.TutorialCoach;
		if (C) {
			const ls = C.lessons().filter(l => !query || (l.title + ' ' + l.summary).toLowerCase().includes(query));
			if (ls.length) {
				list.appendChild(el('div', 'tu-cat tu-cat-lesson', '🎓 Guided lessons — learn by doing'));
				for (const l of ls) {
					const b = el('button', 'tu-item tu-lesson' + ('L:' + l.id === cur ? ' on' : ''), '<span class="tu-ic">' + l.icon + '</span><span>' + l.title + '</span>' + (l.done ? '<span class="tu-ok">✓</span>' : ''));
					b.addEventListener('click', () => open('L:' + l.id));
					list.appendChild(b);
				}
				list.appendChild(el('div', 'tu-cat', '📖 Reference guides'));
			}
		}
		for (const c of CATS) {
			const items = T.filter(t => t.cat === c.id && matches(t));
			if (!items.length) continue;
			list.appendChild(el('div', 'tu-cat', c.icon + ' ' + c.name));
			for (const t of items) {
				const b = el('button', 'tu-item' + (t.id === cur ? ' on' : ''), '<span class="tu-ic">' + t.icon + '</span><span>' + t.title + '</span>' + (read.has(t.id) ? '<span class="tu-ok">✓</span>' : ''));
				b.addEventListener('click', () => open(t.id));
				list.appendChild(b);
			}
		}
		if (!list.children.length) list.appendChild(el('div', 'tu-cat', 'No tutorial matches "' + query + '"'));
		const n = T.filter(t => read.has(t.id)).length;
		host.querySelector('.tu-prog').innerHTML = n + ' of ' + T.length + ' read<i><b style="width:' + Math.round(n / T.length * 100) + '%"></b></i>';
	}
	function secHtml(s) {
		let h = '<div class="tu-sec">' + (s.h ? '<h3>' + s.h + '</h3>' : '');
		if (s.p) h += '<p>' + s.p + '</p>';
		if (s.steps) h += '<ol>' + s.steps.map(x => '<li>' + x + '</li>').join('') + '</ol>';
		if (s.list) h += '<ul>' + s.list.map(x => '<li>' + x + '</li>').join('') + '</ul>';
		if (s.keys) h += '<div class="tu-keys">' + s.keys.map(([k, v]) => '<span class="k">' + k + '</span><span>' + v + '</span>').join('') + '</div>';
		return h + '</div>';
	}
	function openLesson(id) {
		const C = global.TutorialCoach; const l = C && C.lessons().find(x => x.id === id);
		if (!l || !host) return false;
		cur = 'L:' + id;
		const main = host.querySelector('.tu-main');
		const run = C.current();
		const busy = run && run.id === id;
		main.innerHTML = '<div class="tu-h1"><span>' + l.icon + '</span>' + l.title + (l.done ? ' <span class="tu-badge">✓ completed</span>' : '') + '</div>'
			+ '<div class="tu-intro">' + l.summary + '</div>'
			+ '<div class="tu-sec"><h3>How a guided lesson works</h3><ul>'
			+ '<li>A card at the bottom of the screen tells you what to do next.</li>'
			+ '<li>A <b style="color:#ffe27a">glowing ring and arrow</b> point at the exact button, rune or setting to use.</li>'
			+ '<li>Each step ticks itself off as soon as you have done it — no need to press "next".</li>'
			+ '<li>Spell lessons build a real spell in the Rune Forge (it is saved into an empty slot), then take you to the <b>Sandbox</b> to try it.</li>'
			+ '<li>You can <b>Skip step</b> or <b>Exit lesson</b> at any time.</li></ul></div>'
			+ '<div class="tu-sec"><h3>About this lesson</h3><div class="tu-keys"><span class="k">Where</span><span>' + l.where + '</span><span class="k">Steps</span><span>' + l.steps + '</span></div></div>'
			+ '<div class="tu-nav"><span></span><button class="tu-btn pri tu-start">' + (busy ? '▶ Resume lesson' : (l.done ? '↺ Do it again' : '▶ Start lesson')) + '</button></div>';
		main.querySelector('.tu-start').addEventListener('click', () => { if (busy) { C.stop(); } C.start(id); renderList(); });
		renderList();
		return true;
	}
	function open(id) {
		if (String(id).startsWith('L:')) { if (openLesson(String(id).slice(2))) return; id = T[0].id; }
		const t = T.find(x => x.id === id) || T[0];
		cur = t.id;
		if (!host) return;
		const main = host.querySelector('.tu-main');
		const i = T.indexOf(t);
		let h = '<div class="tu-h1"><span>' + t.icon + '</span>' + t.title + '</div><div class="tu-intro">' + t.intro + '</div>';
		if (t.diagram && SVG[t.diagram]) h += SVG[t.diagram];
		h += t.sections.map(secHtml).join('');
		if (t.tip) h += '<div class="tu-tip">💡 ' + t.tip + '</div>';
		if (t.lesson && global.TutorialCoach) h += '<div class="tu-tryit"><span>Rather learn it by doing?</span><button class="tu-btn pri" data-lesson="' + t.lesson + '">🎓 Start the guided lesson</button></div>';
		h += '<div class="tu-nav"><button class="tu-btn" data-go="-1"' + (i ? '' : ' disabled') + '>← ' + (i ? T[i - 1].title : '') + '</button>'
			+ '<button class="tu-btn pri" data-go="1">' + (i < T.length - 1 ? T[i + 1].title + ' →' : 'Done ✓') + '</button></div>';
		main.innerHTML = h;
		main.scrollTop = 0;
		const lb = main.querySelector('[data-lesson]'); if (lb) lb.addEventListener('click', () => open('L:' + lb.dataset.lesson));
		main.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => {
			markRead(t.id);
			const j = i + (+b.dataset.go);
			if (j >= 0 && j < T.length) open(T[j].id); else renderList();
		}));
		// reading a guide to the end (or opening it for a while) counts as read
		clearTimeout(open._t);
		open._t = setTimeout(() => { if (cur === t.id) { markRead(t.id); renderList(); } }, 6000);
		renderList();
	}

	global.Tutorials = { mount, open, refresh: () => { if (host) { renderList(); open(cur || T[0].id); } }, list: () => T.map(t => ({ id: t.id, title: t.title, cat: t.cat })) };
})(typeof window !== 'undefined' ? window : globalThis);
