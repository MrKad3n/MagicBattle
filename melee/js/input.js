/**
 * Input abstraction. Combat code asks for actions, never keys.
 * Actions: left, right, up, down, jump, attack, dash, parry, debug, reset
 */

const KEY_TO_ACTION = {
	a: 'left',
	arrowleft: 'left',
	d: 'right',
	arrowright: 'right',
	w: 'up',
	arrowup: 'up',
	s: 'down',
	arrowdown: 'down',
	' ': 'jump',
	j: 'attack',
	z: 'attack',
	k: 'dash',
	shift: 'dash',
	l: 'parry',
	f: 'parry',
	f3: 'debug',
	'`': 'debug',
	r: 'reset',
};

export function createVirtualInput() {
	const held = new Set();
	const edges = new Set();
	return {
		held(action) { return held.has(action); },
		pressed(action) { return edges.has(action); },
		axisX() {
			return (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);
		},
		axisY() {
			return (held.has('down') ? 1 : 0) - (held.has('up') ? 1 : 0);
		},
		set(action, value) {
			if (value) held.add(action);
			else held.delete(action);
		},
		tap(action) {
			held.add(action);
			edges.add(action);
		},
		clearEdges() { edges.clear(); },
		endFrame() { edges.clear(); },
		beginFrame() {},
	};
}

export function createInput(target = window) {
	const held = new Set();
	const edges = new Set();
	const padWas = new Set();

	function press(action) {
		if (!action || held.has(action)) return;
		held.add(action);
		edges.add(action);
	}
	function release(action) {
		if (action) held.delete(action);
	}

	function onKeyDown(e) {
		const action = KEY_TO_ACTION[e.key.toLowerCase()];
		if (!action) return;
		if (e.repeat) return;
		if (action === 'jump' || e.key.startsWith('Arrow') || action === 'down' || action === 'up') {
			e.preventDefault();
		}
		press(action);
	}
	function onKeyUp(e) {
		const action = KEY_TO_ACTION[e.key.toLowerCase()];
		if (action) release(action);
	}
	function onMouseDown(e) {
		if (e.button === 0) press('attack');
		if (e.button === 2) press('parry');
	}
	function onMouseUp(e) {
		if (e.button === 0) release('attack');
		if (e.button === 2) release('parry');
	}
	function onBlur() {
		held.clear();
	}

	target.addEventListener('keydown', onKeyDown);
	target.addEventListener('keyup', onKeyUp);
	target.addEventListener('mousedown', onMouseDown);
	target.addEventListener('mouseup', onMouseUp);
	target.addEventListener('blur', onBlur);
	target.addEventListener('contextmenu', (e) => e.preventDefault());

	function pollPad() {
		const pads = navigator.getGamepads ? navigator.getGamepads() : [];
		const gp = pads && pads[0];
		if (!gp) return;
		const dead = 0.32;
		const ax = gp.axes[0] || 0;
		const ay = gp.axes[1] || 0;
		setAxis('left', ax < -dead);
		setAxis('right', ax > dead);
		setAxis('up', ay < -dead);
		setAxis('down', ay > dead);
		const buttons = {
			jump: gp.buttons[0],
			dash: gp.buttons[1],
			attack: gp.buttons[2],
			parry: gp.buttons[5] || gp.buttons[3],
		};
		for (const [action, button] of Object.entries(buttons)) {
			const down = !!(button && button.pressed);
			if (down && !padWas.has(action)) press(action);
			if (!down && padWas.has(action)) release(action);
			if (down) padWas.add(action);
			else padWas.delete(action);
		}
	}

	const padOwned = new Set();
	function setAxis(action, down) {
		if (down) {
			padOwned.add(action);
			if (!held.has(action)) press(action);
		} else if (padOwned.has(action)) {
			padOwned.delete(action);
			release(action);
		}
	}

	return {
		held(action) { return held.has(action); },
		pressed(action) { return edges.has(action); },
		axisX() {
			return (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);
		},
		axisY() {
			return (held.has('down') ? 1 : 0) - (held.has('up') ? 1 : 0);
		},
		set(action, value) {
			if (value) press(action);
			else release(action);
		},
		tap(action) { press(action); },
		clearEdges() { edges.clear(); },
		endFrame() { edges.clear(); },
		beginFrame() { pollPad(); },
	};
}
