import { describe, expect, it } from 'vitest';
import {
	actualCurves,
	binOf,
	completeCurve,
	emptyCurve,
	hasSketch,
	ORACLE_SCORE,
	paintCurve,
	PRESETS,
	presetCurve,
	scorePrediction,
} from './prediction';

const TYPES = ['rock', 'paper', 'scissors'];

// Rock fades out while paper takes over, scissors steady at 10
const samples = Array.from({ length: 11 }, (_, i) => ({ t: i * 2, rock: 20 - 2 * i, paper: 2 * i, scissors: 10 }));
const clone = (curves) => Object.fromEntries(Object.entries(curves).map(([type, curve]) => [type, [...curve]]));

describe('paintCurve', () => {
	it('draws a line across the bins between two points', () => {
		const curve = paintCurve(emptyCurve(11), { x: 0, y: 0 }, { x: 1, y: 1 });
		expect(curve[0]).toBe(0);
		expect(curve[5]).toBeCloseTo(0.5);
		expect(curve[10]).toBe(1);
	});

	it('works in either direction and clamps to the chart', () => {
		const curve = paintCurve(emptyCurve(11), { x: 0.5, y: 2 }, { x: -1, y: -1 });
		expect(curve[5]).toBe(1);
		expect(curve[0]).toBe(0);
		expect(curve[10]).toBeNull();
	});

	it('sets a single bin for a tap and leaves the original alone', () => {
		const original = emptyCurve(11);
		const curve = paintCurve(original, { x: 0.3, y: 0.4 }, { x: 0.3, y: 0.4 });
		expect(curve.filter((v) => v !== null)).toEqual([0.4]);
		expect(hasSketch(original)).toBe(false);
		expect(hasSketch(curve)).toBe(true);
		expect(binOf(2, 11)).toBe(10);
	});
});

describe('completeCurve', () => {
	it('joins gaps and holds the ends', () => {
		const curve = emptyCurve(7);
		curve[2] = 0.2;
		curve[4] = 0.6;
		expect(completeCurve(curve)).toEqual([0.2, 0.2, 0.2, expect.closeTo(0.4), 0.6, 0.6, 0.6]);
	});

	it('is null for an empty sketch', () => {
		expect(completeCurve(emptyCurve(5))).toBeNull();
	});
});

describe('actualCurves', () => {
	it('resamples the shares over the round', () => {
		const curves = actualCurves(samples, TYPES, 5);
		expect(curves.rock[0]).toBeCloseTo(20 / 30);
		expect(curves.rock[4]).toBeCloseTo(0);
		expect(curves.paper[4]).toBeCloseTo(20 / 30);
		expect(curves.scissors[2]).toBeCloseTo(1 / 3);
	});

	it('has nothing to say about a round with no length', () => {
		expect(actualCurves([{ t: 0, rock: 1, paper: 1, scissors: 1 }], TYPES)).toBeNull();
	});
});

describe('scorePrediction', () => {
	const actual = actualCurves(samples, TYPES);
	const flat = (value) => Array(60).fill(value);
	const all = (curves) => Object.fromEntries(TYPES.map((type) => [type, curves(type)]));

	it('scores a perfect prediction at 100', () => {
		const result = scorePrediction(clone(actual), samples, TYPES);
		expect(result.score).toBe(100);
		expect(result.accuracy).toBe(100);
	});

	it('scores a flat guess at 0, however it is drawn', () => {
		expect(scorePrediction(all(() => flat(1 / 3)), samples, TYPES).score).toBe(0);
	});

	it('scores a line along the baseline at 0 or less, not a pass', () => {
		const result = scorePrediction(all(() => flat(0)), samples, TYPES);
		expect(result.score).toBe(0);
		// Plain accuracy would have called that decent, which is why it isn\'t the headline
		expect(result.accuracy).toBeGreaterThanOrEqual(60);
	});

	it('scores the opposite of the real curves at 0', () => {
		const opposite = all((type) => actual[type].map((v) => 1 - v));
		expect(scorePrediction(opposite, samples, TYPES).score).toBe(0);
	});

	it('counts types that were not drawn as the flat guess, so one line cannot score by itself', () => {
		const result = scorePrediction({ rock: [...actual.rock] }, samples, TYPES);
		expect(Object.keys(result.errors)).toEqual(TYPES);
		expect(result.errors.rock).toBe(0);
		expect(result.errors.paper).toBeCloseTo(scorePrediction({ paper: flat(1 / 3) }, samples, TYPES).errors.paper, 10);
		expect(result.score).toBeGreaterThan(0);
		expect(result.score).toBeLessThan(100);
	});

	it('scores a single drawn type at 0 when that line is no better than flat', () => {
		expect(scorePrediction({ paper: flat(1 / 3) }, samples, TYPES).score).toBe(0);
		expect(scorePrediction({ paper: flat(0) }, samples, TYPES).score).toBe(0);
	});

	it('rewards getting more of the lines right', () => {
		const one = scorePrediction({ rock: [...actual.rock] }, samples, TYPES).score;
		const two = scorePrediction({ rock: [...actual.rock], paper: [...actual.paper] }, samples, TYPES).score;
		expect(two).toBeGreaterThan(one);
	});

	it('is measured against the same round\'s flat guess', () => {
		// A round that stays at an equal split makes the flat guess perfect, so nothing can beat it
		const even = [{ t: 0, rock: 5, paper: 5, scissors: 5 }, { t: 9, rock: 5, paper: 5, scissors: 5 }];
		expect(scorePrediction(all(() => flat(1 / 3)), even, TYPES).score).toBe(0);
		expect(scorePrediction(all(() => flat(0.5)), even, TYPES).score).toBe(0);
	});

	it('stays within 0 and 100', () => {
		const wild = { rock: flat(1), paper: flat(0) };
		const { score, accuracy } = scorePrediction(wild, samples, TYPES);
		for (const value of [score, accuracy]) {
			expect(value).toBeGreaterThanOrEqual(0);
			expect(value).toBeLessThanOrEqual(100);
		}
	});

	it('is null when nothing was sketched', () => {
		expect(scorePrediction({}, samples, TYPES)).toBeNull();
		expect(scorePrediction({ rock: emptyCurve(60) }, samples, TYPES)).toBeNull();
	});

	it('handles five types, where a flat line is a fifth', () => {
		const five = ['rock', 'paper', 'scissors', 'lizard', 'spock'];
		const rows = [
			{ t: 0, rock: 4, paper: 4, scissors: 4, lizard: 4, spock: 4 },
			{ t: 10, rock: 20, paper: 0, scissors: 0, lizard: 0, spock: 0 },
		];
		const curves = actualCurves(rows, five);
		expect(curves.spock[0]).toBeCloseTo(0.2);
		expect(scorePrediction(curves, rows, five).score).toBe(100);
		expect(scorePrediction(Object.fromEntries(five.map((type) => [type, flat(0.2)])), rows, five).score).toBe(0);
		expect(scorePrediction({ rock: curves.rock }, rows, five).score).toBeGreaterThan(0);
	});

	it('makes a sensible guess score well and a lucky blind one poorly', () => {
		// Rock wins slowly: guess the winner with a rough shape, versus the wrong winner
		const round = Array.from({ length: 21 }, (_, i) => ({ t: i, rock: 10 + i, paper: 10 - i / 2, scissors: 10 - i / 2 }));
		const real = actualCurves(round, TYPES);
		const sensible = { rock: presetCurve('wins-early', 1 / 3), paper: presetCurve('loses-late', 1 / 3), scissors: presetCurve('loses-late', 1 / 3) };
		const wrong = { rock: presetCurve('loses-early', 1 / 3), paper: presetCurve('wins-early', 1 / 3), scissors: presetCurve('loses-early', 1 / 3) };
		expect(scorePrediction(sensible, round, TYPES).score).toBeGreaterThanOrEqual(ORACLE_SCORE);
		expect(scorePrediction(wrong, round, TYPES).score).toBe(0);
		expect(real.rock.at(-1)).toBeCloseTo(1, 5);
	});
});

describe('presetCurve', () => {
	it('stays at the starting share, then heads for a win or a loss and stays there', () => {
		const win = presetCurve('wins-early', 0.2, 21);
		expect(win[0]).toBe(0.2);
		expect(win[20]).toBe(1);
		expect(win.every((v, i) => i === 0 || v >= win[i - 1])).toBe(true);
		const loss = presetCurve('loses-late', 0.2, 21);
		expect(loss[0]).toBe(0.2);
		expect(loss[10]).toBe(0.2);
		expect(loss[20]).toBe(0);
	});

	it('reaches its target sooner when early', () => {
		const early = presetCurve('wins-early', 0.2, 21);
		const late = presetCurve('wins-late', 0.2, 21);
		expect(early[8]).toBeGreaterThan(late[8]);
		expect(PRESETS.map((p) => p.value)).toEqual(['wins-early', 'wins-late', 'loses-early', 'loses-late']);
	});
});
