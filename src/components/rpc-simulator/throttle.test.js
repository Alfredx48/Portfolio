import { describe, expect, it } from 'vitest';
import { createThrottle, POP_INTERVAL } from './throttle';

describe('createThrottle', () => {
	it('lets the first call through and blocks the ones right after it', () => {
		const allow = createThrottle(100);
		expect(allow(0)).toBe(true);
		expect(allow(1)).toBe(false);
		expect(allow(99)).toBe(false);
		expect(allow(100)).toBe(true);
	});

	it('measures from the last call that got through, not the last attempt', () => {
		const allow = createThrottle(100);
		allow(1000);
		expect(allow(1060)).toBe(false);
		expect(allow(1120)).toBe(true);
	});

	it('allows at most 8 pops in any second at the pop interval', () => {
		const allow = createThrottle(POP_INTERVAL);
		let allowed = 0;
		// A conversion every frame at 60fps
		for (let t = 0; t < 1000; t += 1000 / 60) if (allow(t)) allowed++;
		expect(allowed).toBeLessThanOrEqual(8);
		expect(allowed).toBeGreaterThanOrEqual(7);
	});
});
