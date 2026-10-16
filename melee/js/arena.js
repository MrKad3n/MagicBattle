export const GROUND_Y = 620;
export const WORLD_W = 9000;
export const SPAWN_X = 180;

export const ZONES = [
	{ x: 80, w: 1000, name: '1  Flat ground', hint: 'Run, stop, turn, jump' },
	{ x: 1100, w: 1200, name: '2  Platforms', hint: 'Coyote time, jump buffer, drop-through' },
	{ x: 2400, w: 800, name: '3  Small enemies', hint: 'Light hits launch and stagger' },
	{ x: 3300, w: 800, name: '4  Medium enemies', hint: 'They take a combo to stagger' },
	{ x: 4200, w: 800, name: '5  Large armored', hint: 'Resists light hits and launch' },
	{ x: 5100, w: 800, name: '6  Group', hint: 'Pass through them and hit several' },
	{ x: 6000, w: 900, name: '7  Aerial', hint: 'Jump, rising slash, plunge' },
	{ x: 7000, w: 800, name: '8  Walls and ledges', hint: 'Attacks and dashes stop at walls' },
	{ x: 7900, w: 1100, name: '9  Dash hall', hint: 'Dash, cancel into a swing' },
];

function solid(x, y, w, h, oneWay = false) {
	return { x, y, w, h, oneWay };
}

export function buildSolids() {
	const S = [];
	const floor = (x, w, y = GROUND_Y) => S.push(solid(x, y, w, 460));
	floor(0, 1180);
	floor(1180, 1100, 800);
	S.push(solid(1270, 500, 200, 14, true));
	S.push(solid(1560, 430, 180, 14, true));
	S.push(solid(1840, 510, 200, 14, true));
	S.push(solid(2060, 740, 90, 80));
	S.push(solid(2150, 680, 90, 140));
	S.push(solid(2240, 620, 160, 200));
	floor(2400, 6600);
	S.push(solid(6120, 500, 170, 14, true));
	S.push(solid(6380, 450, 150, 14, true));
	S.push(solid(6620, 510, 180, 14, true));
	S.push(solid(7088, 470, 28, 150));
	S.push(solid(7348, 430, 28, 190));
	S.push(solid(7520, 500, 150, 14, true));
	return S;
}

export function buildEnemies(createEnemy) {
	const feet = (h) => GROUND_Y - h;
	const list = [
		createEnemy({ tier: 'small', name: 'Skirmisher', x: 2580, y: feet(40) }),
		createEnemy({ tier: 'small', name: 'Skirmisher', x: 2780, y: feet(40) }),
		createEnemy({ tier: 'small', name: 'Skirmisher', x: 2980, y: feet(40) }),
		createEnemy({ tier: 'medium', name: 'Sentry', x: 3480, y: feet(56) }),
		createEnemy({ tier: 'medium', name: 'Sentry', x: 3760, y: feet(56) }),
		createEnemy({ tier: 'large', name: 'Armored Brute', x: 4520, y: feet(76) }),
		createEnemy({ tier: 'small', name: 'Skirmisher', x: 5220, y: feet(40) }),
		createEnemy({ tier: 'small', name: 'Skirmisher', x: 5340, y: feet(40) }),
		createEnemy({ tier: 'medium', name: 'Sentry', x: 5520, y: feet(56) }),
		createEnemy({ tier: 'flyer', name: 'Gale Wisp', x: 5680, y: 470 }),
		createEnemy({ tier: 'flyer', name: 'Gale Wisp', x: 6240, y: 430 }),
		createEnemy({ tier: 'flyer', name: 'Gale Wisp', x: 6500, y: 390 }),
		createEnemy({ tier: 'flyer', name: 'Gale Wisp', x: 6740, y: 450 }),
		createEnemy({ tier: 'small', name: 'Skirmisher', x: 7020, y: feet(40), facing: 1 }),
	];
	for (const e of list) {
		if (e.tier === 'flyer') {
			e.homeY = e.y;
		}
	}
	return list;
}

export function zoneAt(x) {
	for (let i = ZONES.length - 1; i >= 0; i--) {
		if (x >= ZONES[i].x) return ZONES[i];
	}
	return ZONES[0];
}
