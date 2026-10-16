import { sampleKeys } from './rig.js';

/** Neutral stance. Other poses override fields they care about. */
export function pose(partial) {
	return {
		hipX: 0, hipY: 0, squash: 0,
		torso: 4, head: -4,
		armB: 18, elbowB: 16,
		armF: 22, elbowF: 18,
		legB: -6, kneeB: 8,
		legF: 8, kneeF: 8,
		sword: 8,
		...partial,
	};
}

const IDLE = pose({ torso: 2, armF: 16, elbowF: 22, sword: 14, legF: 4, legB: -4 });

const ATTACKS = {
	g1: [
		{ t: 0, pose: pose({ torso: -6, hipX: -2, armF: 130, elbowF: 16, sword: 6, armB: 20, legF: 8, kneeF: 12, legB: -12, head: 4 }) },
		{ t: 0.32, pose: pose({ torso: 8, hipX: 2, armF: 68, elbowF: 8, sword: 12, armB: 10, legF: 18, kneeF: 12, legB: -12, head: -2 }) },
		{ t: 0.5, pose: pose({ torso: 16, hipX: 5, armF: 52, elbowF: 6, sword: 10, armB: -6, legF: 26, kneeF: 10, legB: -8, head: -6 }) },
		{ t: 0.72, pose: pose({ torso: 12, hipX: 3, armF: 18, elbowF: 12, sword: 12, legF: 16, legB: 2, head: -4 }) },
		{ t: 1, pose: pose({ torso: 4, hipX: 1, armF: 20, elbowF: 16, sword: 10, legF: 6, legB: -2 }) },
	],
	g2: [
		{ t: 0, pose: pose({ torso: 10, hipX: 2, armF: 16, elbowF: 10, sword: 14, armB: -8, legF: 14, legB: -10, head: -4 }) },
		{ t: 0.32, pose: pose({ torso: 12, hipX: 3, armF: 58, elbowF: 8, sword: 12, legF: 20, kneeF: 12, legB: -10, head: -4 }) },
		{ t: 0.52, pose: pose({ torso: -8, hipX: 6, armF: 78, elbowF: 6, sword: 8, armB: 20, legF: 28, kneeF: 10, legB: -16, head: 6 }) },
		{ t: 0.72, pose: pose({ torso: -16, hipX: 4, armF: 132, elbowF: 10, sword: 4, legF: 12, legB: -4, head: 8 }) },
		{ t: 1, pose: pose({ torso: 2, armF: 40, elbowF: 16, sword: 10, legF: 6, legB: -2 }) },
	],
	g3: [
		{ t: 0, pose: pose({ torso: 4, hipY: 1, armF: 36, elbowF: 12, sword: 8, legF: 8, legB: -6 }) },
		{ t: 0.32, pose: pose({ torso: -30, hipX: -6, hipY: 5, armF: 168, elbowF: 8, sword: 0, armB: -30, legF: -8, kneeF: 26, legB: 6, kneeB: 16, head: 12 }) },
		{ t: 0.52, pose: pose({ torso: 30, hipX: 10, armF: 46, elbowF: 4, sword: 12, armB: 16, legF: 34, kneeF: 6, legB: -22, head: -14 }) },
		{ t: 0.72, pose: pose({ torso: 16, hipX: 5, armF: 16, elbowF: 14, sword: 14, legF: 18, legB: -4, head: -6 }) },
		{ t: 1, pose: pose({ torso: 6, hipX: 1, armF: 22, elbowF: 16, sword: 8, legF: 8, legB: -2 }) },
	],
	air1: [
		{ t: 0, pose: pose({ torso: -6, armF: 140, elbowF: 16, sword: 6, legF: -24, kneeF: 32, legB: 14, kneeB: 18 }) },
		{ t: 0.46, pose: pose({ torso: 16, armF: 64, elbowF: 6, sword: 10, legF: 8, kneeF: 18, legB: -22, kneeB: 12, head: -6 }) },
		{ t: 0.74, pose: pose({ torso: 8, armF: 24, elbowF: 14, sword: 12, legF: 4, kneeF: 12, legB: -6 }) },
		{ t: 1, pose: pose({ torso: 2, armF: 18, elbowF: 16, sword: 8, legF: -8, kneeF: 16, legB: 6, kneeB: 10 }) },
	],
	air2: [
		{ t: 0, pose: pose({ torso: 8, armF: 18, elbowF: 10, sword: 14, legF: -18, kneeF: 26, legB: 16, kneeB: 14 }) },
		{ t: 0.48, pose: pose({ torso: -14, armF: 130, elbowF: 8, sword: 4, legF: 12, kneeF: 16, legB: -26, kneeB: 10, head: 8 }) },
		{ t: 1, pose: pose({ torso: -4, armF: 150, elbowF: 12, sword: 6, legF: -4, kneeF: 14, legB: 8 }) },
	],
	upAir: [
		{ t: 0, pose: pose({ torso: 12, armF: 48, elbowF: 14, sword: 18, legF: -18, kneeF: 22, legB: 10, kneeB: 14 }) },
		{ t: 0.42, pose: pose({ torso: -8, armF: 120, elbowF: 6, sword: 8, legF: -28, kneeF: 16, legB: 6, head: 4 }) },
		{ t: 0.68, pose: pose({ torso: -20, armF: 172, elbowF: 4, sword: 2, legF: -8, kneeF: 12, legB: 18, head: 12 }) },
		{ t: 1, pose: pose({ torso: -6, armF: 150, elbowF: 12, sword: 6, legF: -6, kneeF: 12, legB: 6 }) },
	],
	launcher: [
		{ t: 0, pose: pose({ torso: 10, hipY: 2, armF: 36, elbowF: 16, sword: 20, legF: 16, kneeF: 20, legB: -12, kneeB: 10, head: -4 }) },
		{ t: 0.32, pose: pose({ torso: 18, hipY: 6, hipX: -3, armF: 58, elbowF: 8, sword: 16, legF: 26, kneeF: 28, legB: -6, head: -6 }) },
		{ t: 0.58, pose: pose({ torso: -24, hipX: 4, hipY: -2, armF: 170, elbowF: 4, sword: 4, armB: -16, legF: -4, kneeF: 8, legB: 16, head: 14 }) },
		{ t: 1, pose: pose({ torso: -8, armF: 146, elbowF: 12, sword: 8, legF: 4, legB: -2 }) },
	],
	down: [
		{ t: 0, pose: pose({ torso: -10, armF: 150, elbowF: 12, sword: 4, legF: -22, kneeF: 18, legB: 12, kneeB: 12, head: 6 }) },
		{ t: 0.34, pose: pose({ torso: 18, hipY: 1, armF: 70, elbowF: 6, sword: 10, legF: 12, kneeF: 10, legB: -8, head: -6 }) },
		{ t: 0.7, pose: pose({ torso: 32, hipY: 3, armF: 18, elbowF: 4, sword: 8, legF: 8, kneeF: 4, legB: 4, head: -12 }) },
		{ t: 1, pose: pose({ torso: 8, armF: 22, elbowF: 14, sword: 8, legF: 6, legB: -4 }) },
	],
};

export function locomotionPose(player, time) {
	const speed = Math.abs(player.vx);
	const airborne = !player.onGround;
	if (player.state === 'dash') {
		return pose({
			torso: 28, hipX: 4, head: -8,
			armF: -36, elbowF: 18, armB: -20, elbowB: 10, sword: 16,
			legF: 32, kneeF: 10, legB: -28, kneeB: 8,
		});
	}
	if (player.state === 'hit' || player.state === 'knockback' || player.state === 'stunned') {
		const lift = player.state === 'knockback' ? -6 : 0;
		return pose({
			torso: -22, hipX: -4, hipY: lift, head: 14,
			armF: -30, elbowF: 28, armB: -16, elbowB: 20, sword: 10,
			legF: 14, kneeF: 22, legB: -20, kneeB: 16,
		});
	}
	if (player.state === 'parry') {
		return pose({
			torso: -6, hipX: -2, head: 2,
			armF: -8, elbowF: 46, sword: -36,
			armB: 10, elbowB: 20,
			legF: 16, kneeF: 18, legB: -12, kneeB: 10,
		});
	}
	if (player.state === 'death') {
		return pose({
			torso: 78, hipY: 16, head: 20,
			armF: 40, elbowF: 10, armB: -20, sword: 20,
			legF: 70, kneeF: 8, legB: -40, kneeB: 6,
		});
	}
	if (airborne) {
		const rising = player.vy < -40;
		if (rising || player.state === 'jump') {
			return pose({
				torso: -8, hipY: -1, head: 4,
				armF: -46, elbowF: 22, armB: -30, elbowB: 16, sword: 6,
				legF: -22, kneeF: 34, legB: 16, kneeB: 22,
			});
		}
		return pose({
			torso: 8, head: -2,
			armF: 18, elbowF: 14, armB: -12, sword: 12,
			legF: 10, kneeF: 8, legB: -14, kneeB: 6,
		});
	}
	if (speed > 30) {
		const phase = player.runPhase || 0;
		const s = Math.sin(phase);
		const c = Math.cos(phase);
		return pose({
			torso: 8, hipY: Math.abs(s) * -2, hipX: 2, head: -3,
			armF: 10 + Math.sin(phase + Math.PI) * 28,
			elbowF: 16 + Math.max(0, c) * 10,
			armB: 12 + s * 26,
			elbowB: 14,
			sword: 12,
			legF: s * 32,
			kneeF: 8 + Math.max(0, s) * 28,
			legB: -s * 32,
			kneeB: 8 + Math.max(0, -s) * 28,
		});
	}
	const breathe = Math.sin(time * 2.2) * 1.2;
	return pose({
		...IDLE,
		hipY: breathe,
		torso: IDLE.torso + breathe * 0.4,
		head: IDLE.head - breathe * 0.3,
	});
}

export function attackPose(attackId, progress) {
	const keys = ATTACKS[attackId] || ATTACKS.g1;
	return sampleKeys(keys, Math.max(0, Math.min(1, progress)));
}

/**
 * Map gameplay time onto the authored swing so the contact pose lands
 * inside the active window, and the sword keeps moving through recovery.
 */
export function attackProgress(info, timer) {
	if (!info || info.end <= 0) return 0;
	const start = info.startup;
	const activeEnd = info.activeEnd;
	if (timer <= start) return (timer / Math.max(0.0001, start)) * 0.32;
	if (timer <= activeEnd) {
		const u = (timer - start) / Math.max(0.0001, activeEnd - start);
		return 0.32 + u * 0.4;
	}
	const u = (timer - activeEnd) / Math.max(0.0001, info.end - activeEnd);
	return 0.72 + Math.min(1, u) * 0.28;
}

export function poseForPlayer(player, time) {
	if ((player.state === 'attack' || player.state === 'airAttack') && player.combat.attack && player.combat.info) {
		const progress = attackProgress(player.combat.info, player.combat.timer);
		return attackPose(player.combat.attack.id, progress);
	}
	let poseNow = locomotionPose(player, time);
	if (player.squash > 0) {
		poseNow = { ...poseNow, hipY: (poseNow.hipY || 0) + player.squash * 6, squash: player.squash * 3 };
	}
	return poseNow;
}
