// Sketched population curves and how well they matched the round. A curve is a list of
// POINTS values, each a type's share (0 to 1) of everything on the board at that fraction
// of the round, or null where nothing was drawn. Using fractions of the round and of the
// population means a prediction can be made before anyone knows how long the round will last.
export const POINTS = 60;
export const ORACLE_SCORE = 25; // out of 100, where 0 is no better than a flat guess

const clamp01 = (value) => Math.min(1, Math.max(0, value));

export const emptyCurve = (n = POINTS) => Array(n).fill(null);
export const hasSketch = (curve) => !!curve?.some((value) => value !== null);

// The bin at a position across the round (0 to 1).
export const binOf = (x, n = POINTS) => Math.round(clamp01(x) * (n - 1));

// A new curve with a straight line drawn from one pointer position to the next, each { x, y } in 0 to 1.
// Fast drags skip bins, so every bin in between is filled in.
export function paintCurve(curve, from, to) {
	const next = [...curve];
	const a = binOf(from.x, curve.length);
	const b = binOf(to.x, curve.length);
	const lo = Math.min(a, b);
	const hi = Math.max(a, b);
	for (let i = lo; i <= hi; i++) {
		const along = hi === lo ? 1 : (i - a) / (b - a);
		next[i] = clamp01(from.y + (to.y - from.y) * along);
	}
	return next;
}

// Joins up gaps in a sketch and holds the first and last drawn value out to the edges, or null when empty.
export function completeCurve(curve) {
	const drawn = curve.map((value, i) => (value === null ? -1 : i)).filter((i) => i >= 0);
	if (drawn.length === 0) return null;
	return curve.map((_, i) => {
		const before = drawn.findLast((d) => d <= i);
		const after = drawn.find((d) => d >= i);
		if (before === undefined) return curve[after];
		if (after === undefined || before === after) return curve[before];
		return curve[before] + ((curve[after] - curve[before]) * (i - before)) / (after - before);
	});
}

// Each type's real share of the population at n evenly spaced moments from the first sample to the last.
// `samples` is [{ t, [type]: count }] sorted by t. Null when the round has no length.
export function actualCurves(samples, types, n = POINTS) {
	const end = samples.at(-1)?.t ?? 0;
	if (samples.length < 2 || end <= 0) return null;

	const share = (sample, type) => {
		const total = types.reduce((sum, other) => sum + sample[other], 0);
		return total ? sample[type] / total : 0;
	};
	const curves = Object.fromEntries(types.map((type) => [type, []]));
	let j = 0;
	for (let i = 0; i < n; i++) {
		const t = (i / (n - 1)) * end;
		while (j < samples.length - 2 && samples[j + 1].t < t) j++;
		const a = samples[j];
		const b = samples[j + 1];
		const along = b.t === a.t ? 1 : clamp01((t - a.t) / (b.t - a.t));
		for (const type of types) curves[type].push(share(a, type) + (share(b, type) - share(a, type)) * along);
	}
	return curves;
}

// How a sketch did, or null when nothing was sketched or the round has no data.
//   score: 0 to 100, how much better than the lazy guess (every type flat at an equal share) the sketch was.
//          0 means no better, 100 a perfect match. Shares always add up to 1, so a plain accuracy figure
//          is high even for a bad guess and says little; this one has to be earned.
//   accuracy: 100 minus the average error in percentage points, across all types
//   errors: { type: mean absolute error as a fraction of the population }
// Types that weren't drawn count as the flat guess, so leaving them out can't dodge the comparison.
export function scorePrediction(prediction, samples, types, n = POINTS) {
	const actual = actualCurves(samples, types, n);
	if (!actual || !types.some((type) => hasSketch(prediction[type]))) return null;

	const flat = 1 / types.length;
	const meanError = (curve, type) => curve.reduce((sum, value, i) => sum + Math.abs(value - actual[type][i]), 0) / n;
	const errors = {};
	let flatError = 0;
	for (const type of types) {
		errors[type] = meanError(completeCurve(prediction[type] ?? []) ?? Array(n).fill(flat), type);
		flatError += meanError(Array(n).fill(flat), type);
	}
	const error = Object.values(errors).reduce((sum, e) => sum + e, 0) / types.length;
	flatError /= types.length;

	const skill = flatError > 0 ? 1 - error / flatError : 0;
	return {
		score: Math.min(100, Math.max(0, Math.round(skill * 100))),
		accuracy: Math.min(100, Math.max(0, Math.round(100 - error * 100))),
		errors,
		flatError,
	};
}

// Quick shapes for people who can't or would rather not drag: a curve from `start` (a share, 0 to 1)
// that heads for 1 (a win) or 0 (a loss), early or late, and stays there.
export const PRESETS = [
	{ value: 'wins-early', label: 'Wins early', target: 1, from: 0, to: 0.35 },
	{ value: 'wins-late', label: 'Wins late', target: 1, from: 0.5, to: 0.9 },
	{ value: 'loses-early', label: 'Loses early', target: 0, from: 0, to: 0.35 },
	{ value: 'loses-late', label: 'Loses late', target: 0, from: 0.5, to: 0.9 },
];

export function presetCurve(kind, start, n = POINTS) {
	const { target, from, to } = PRESETS.find((preset) => preset.value === kind) ?? PRESETS[0];
	return Array.from({ length: n }, (_, i) => {
		const x = i / (n - 1);
		if (x <= from) return start;
		if (x >= to) return target;
		return start + (target - start) * ((x - from) / (to - from));
	});
}
