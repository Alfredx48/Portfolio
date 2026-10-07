// Conversions come in bursts, so the pop sound is limited to 8 a second.
export const POP_INTERVAL = 125; // ms

// Returns a gate: `allow(now)` is true at most once every `interval` ms (`now` in ms, from any steady clock).
export function createThrottle(interval) {
	let last = -Infinity;
	return (now) => {
		if (now - last < interval) return false;
		last = now;
		return true;
	};
}
