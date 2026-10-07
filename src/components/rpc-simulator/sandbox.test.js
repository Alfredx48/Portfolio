import { describe, expect, it } from 'vitest';
import { defaultSandbox, isCustom, normalizeSandbox, simOptions, startCounts } from './sandbox';
import { CLASSIC, LIZARD_SPOCK } from './simulation';

describe('sandbox settings', () => {
	it('starts at a plain game', () => {
		const sandbox = defaultSandbox();
		expect(isCustom(sandbox, CLASSIC, 10)).toBe(false);
		expect(isCustom(sandbox, LIZARD_SPOCK, 10)).toBe(false);
		expect(startCounts(sandbox, CLASSIC, 10)).toEqual({ rock: 10, paper: 10, scissors: 10 });
	});

	it.each([
		['a speed', (s) => (s.speed.paper = 1.5)],
		['a start count', (s) => (s.counts.scissors = 3)],
		['the radius', (s) => (s.radius = 0.5)],
	])('is custom when %s changes', (_, change) => {
		const sandbox = defaultSandbox();
		change(sandbox);
		expect(isCustom(sandbox, CLASSIC, 10)).toBe(true);
	});

	it('is not custom when a count matches the main count', () => {
		const sandbox = defaultSandbox();
		sandbox.counts.rock = 10;
		expect(isCustom(sandbox, CLASSIC, 10)).toBe(false);
		expect(isCustom(sandbox, CLASSIC, 12)).toBe(true);
	});

	it("ignores settings for types that aren't in play", () => {
		const sandbox = defaultSandbox();
		sandbox.speed.spock = 3;
		sandbox.counts.lizard = 50;
		expect(isCustom(sandbox, CLASSIC, 10)).toBe(false);
		expect(isCustom(sandbox, LIZARD_SPOCK, 10)).toBe(true);
	});

	it('uses a type\'s own count and falls back to the main count', () => {
		const sandbox = defaultSandbox();
		sandbox.counts.paper = 4;
		expect(startCounts(sandbox, LIZARD_SPOCK, 7)).toEqual({ rock: 7, paper: 4, scissors: 7, lizard: 7, spock: 7 });
	});

	it('passes the live settings to the simulation', () => {
		const sandbox = defaultSandbox();
		sandbox.radius = 1.5;
		sandbox.speed.rock = 2;
		expect(simOptions(sandbox)).toEqual({ radius: 1.5, speed: sandbox.speed });
	});

	it('repairs anything odd read back from storage', () => {
		expect(normalizeSandbox(null)).toEqual(defaultSandbox());
		expect(normalizeSandbox('nope')).toEqual(defaultSandbox());
		const fixed = normalizeSandbox({ radius: 99, speed: { rock: -4, paper: 'fast', scissors: 2 }, counts: { rock: 500, paper: 2.6, scissors: 'x' } });
		expect(fixed.radius).toBe(2);
		expect(fixed.speed).toMatchObject({ rock: 0.25, paper: 1, scissors: 2 });
		expect(fixed.counts).toMatchObject({ rock: 100, paper: 3, scissors: null });
	});
});
