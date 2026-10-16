import { zoneAt } from './arena.js';
import { createInput } from './input.js';
import { createSim, step } from './game.js';
import { render } from './render.js';

const canvas = document.getElementById('view');
const input = createInput(window);
const sim = createSim();
window.__MELEE__ = sim;
window.__MELEE_INPUT__ = input;

const hpFill = document.getElementById('hpFill');
const hpText = document.getElementById('hpText');
const zoneEl = document.getElementById('zoneName');
const hintEl = document.getElementById('zoneHint');
const combatEl = document.getElementById('combatReadout');
const dashEl = document.getElementById('dashPip');
const debugBtn = document.getElementById('debugBtn');

debugBtn.addEventListener('click', () => {
	sim.debug = !sim.debug;
	debugBtn.classList.toggle('on', sim.debug);
});

let last = performance.now();
let acc = 0;
const STEP = 1 / 60;

function frame(now) {
	const dt = Math.min(0.05, (now - last) / 1000);
	last = now;
	acc += dt;
	input.beginFrame();
	let guard = 0;
	while (acc >= STEP && guard < 5) {
		step(sim, input, STEP);
		input.clearEdges();
		acc -= STEP;
		guard++;
	}
	render(sim, canvas);
	updateHud();
	requestAnimationFrame(frame);
}

function updateHud() {
	const p = sim.player;
	const pct = Math.max(0, p.hp / p.maxHp);
	hpFill.style.width = `${pct * 100}%`;
	hpText.textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`;
	const zone = zoneAt(p.x);
	zoneEl.textContent = zone.name;
	hintEl.textContent = zone.hint;
	const atk = p.combat.attack;
	const phase = p.combat.phase ? ` · ${p.combat.phase}` : '';
	const combo = p.combat.combo > 0 ? ` · combo ${p.combat.combo}` : '';
	combatEl.textContent = `${p.state}${atk ? ` · ${atk.name}${phase}` : ''}${combo}`;
	dashEl.classList.toggle('ready', p.dashCooldown <= 0 && p.state !== 'dash');
	dashEl.classList.toggle('active', p.state === 'dash');
	debugBtn.classList.toggle('on', sim.debug);
}

requestAnimationFrame(frame);
