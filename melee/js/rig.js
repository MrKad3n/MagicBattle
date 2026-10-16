/**
 * 2D pose solver. Gameplay never reads pixels from here except the blade
 * segment, which the hitbox system uses so the swing matches the weapon.
 *
 * Angles are degrees. 0 points down. Positive angles swing toward the
 * character's facing direction. The pose is authored facing right.
 */

export const RIG = {
	hip: 34,
	torso: 20,
	head: 7.2,
	upperArm: 13,
	foreArm: 12,
	thigh: 15,
	shin: 15,
};

export function solveRig(player, pose, reach) {
	const f = player.facing >= 0 ? 1 : -1;
	const originX = player.x + player.w / 2;
	const originY = player.y + player.h;
	const hipX = originX + (pose.hipX || 0) * f;
	const hipY = originY - RIG.hip + (pose.hipY || 0) + (pose.squash || 0);

	const tr = (pose.torso || 0) * Math.PI / 180;
	const shoulder = {
		x: hipX + Math.sin(tr) * RIG.torso * f,
		y: hipY - Math.cos(tr) * RIG.torso,
	};
	const head = {
		x: shoulder.x + Math.sin(tr) * (RIG.head + 1) * f,
		y: shoulder.y - Math.cos(tr) * (RIG.head + 1),
	};

	const kneeB = joint(hipX - 2 * f, hipY, pose.legB || 0, RIG.thigh, f);
	const footB = joint(kneeB.x, kneeB.y, (pose.legB || 0) + (pose.kneeB || 0), RIG.shin, f);
	const kneeF = joint(hipX + 2 * f, hipY, pose.legF || 0, RIG.thigh, f);
	const footF = joint(kneeF.x, kneeF.y, (pose.legF || 0) + (pose.kneeF || 0), RIG.shin, f);

	const shB = { x: shoulder.x - 3.5 * f, y: shoulder.y + 3 };
	const shF = { x: shoulder.x + 2.5 * f, y: shoulder.y + 2 };
	const elbowB = joint(shB.x, shB.y, pose.armB || 0, RIG.upperArm, f);
	const handB = joint(elbowB.x, elbowB.y, (pose.armB || 0) + (pose.elbowB || 0), RIG.foreArm, f);
	const elbowF = joint(shF.x, shF.y, pose.armF || 0, RIG.upperArm, f);
	const handF = joint(elbowF.x, elbowF.y, (pose.armF || 0) + (pose.elbowF || 0), RIG.foreArm, f);

	const swordLen = reach || 58;
	const swordRot = ((pose.armF || 0) + (pose.elbowF || 0) + (pose.sword || 0)) * Math.PI / 180;
	const blade = {
		x1: handF.x,
		y1: handF.y,
		x2: handF.x + Math.sin(swordRot) * swordLen * f,
		y2: handF.y + Math.cos(swordRot) * swordLen,
	};

	return {
		facing: f,
		hipX, hipY, shoulder, head,
		kneeB, footB, kneeF, footF,
		shB, elbowB, handB,
		shF, elbowF, handF,
		blade,
		torsoRot: tr,
		feetY: originY,
		originX,
	};
}

function joint(x, y, rotDeg, len, facing) {
	const r = rotDeg * Math.PI / 180;
	return {
		x: x + Math.sin(r) * len * facing,
		y: y + Math.cos(r) * len,
	};
}

export function lerpPose(a, b, t) {
	const out = {};
	const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
	for (const k of keys) {
		const av = a[k] || 0;
		const bv = b[k] || 0;
		out[k] = av + (bv - av) * t;
	}
	return out;
}

export function sampleKeys(keys, t) {
	if (t <= keys[0].t) return keys[0].pose;
	for (let i = 0; i < keys.length - 1; i++) {
		const a = keys[i];
		const b = keys[i + 1];
		if (t <= b.t) {
			const u = (t - a.t) / Math.max(0.0001, b.t - a.t);
			const s = u * u * (3 - 2 * u);
			return lerpPose(a.pose, b.pose, s);
		}
	}
	return keys[keys.length - 1].pose;
}
