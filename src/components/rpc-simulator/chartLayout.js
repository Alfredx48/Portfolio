// Vertical positions for labels that want to sit at `ys` but need `gap` between them and must stay within
// [min, max]. Pushes them apart from the top down, then back up from the bottom if that ran out of room.
export function spreadLabels(ys, gap, min, max) {
	const order = ys.map((y, i) => i).sort((a, b) => ys[a] - ys[b]);
	const placed = order.map((i) => Math.min(max, Math.max(min, ys[i])));
	for (let k = 1; k < placed.length; k++) placed[k] = Math.max(placed[k], placed[k - 1] + gap);
	if (placed.length && placed.at(-1) > max) {
		placed[placed.length - 1] = max;
		for (let k = placed.length - 2; k >= 0; k--) placed[k] = Math.min(placed[k], placed[k + 1] - gap);
	}
	const result = [];
	order.forEach((original, k) => (result[original] = placed[k]));
	return result;
}
