import { describe, expect, it } from 'vitest';
import { BATCH_DT, createGame, insights, MAX_GAME_TIME, MAX_RUNS, simulateGame, summarize } from './batch';
import { TYPES } from './simulation';

const OPTIONS = { countPerType: 3, width: 300, height: 200 };

// Small deterministic PRNG so the tests don't depend on Math.random
function mulberry32(seed) {
	return () => {
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const record = (overrides = {}) => ({
	winner: 'rock',
	duration: 10,
	firstEliminated: 'paper',
	firstEliminationTime: 5,
	leaderAtHalf: 'rock',
	leadChanges: 0,
	winnerMin: 3,
	lastAtHalf: null,
	peak: { rock: 9, paper: 3, scissors: 3 },
	timeline: [],
	...overrides,
});

describe('constants', () => {
	it('exposes the contract values', () => {
		expect(MAX_RUNS).toBe(100);
		expect(BATCH_DT).toBeCloseTo(1 / 30);
		expect(MAX_GAME_TIME).toBe(600);
	});
});

describe('simulateGame', () => {
	const game = simulateGame({ ...OPTIONS, random: mulberry32(1) });

	it('finishes with a winner and consistent fields', () => {
		expect(TYPES).toContain(game.winner);
		expect(game.duration).toBeGreaterThan(0);
		expect(game.duration).toBeLessThan(MAX_GAME_TIME);
		expect(TYPES).toContain(game.firstEliminated);
		expect(game.firstEliminationTime).toBeGreaterThan(0);
		expect(game.firstEliminationTime).toBeLessThanOrEqual(game.duration);
		expect(game.firstEliminated).not.toBe(game.winner);
		expect(game.winnerMin).toBeGreaterThanOrEqual(1);
		expect(game.winnerMin).toBeLessThanOrEqual(3);
		expect(game.peak[game.winner]).toBeGreaterThanOrEqual(9);
		for (const type of TYPES) expect(game.peak[type]).toBeLessThanOrEqual(9);
		expect(game.leadChanges).toBeGreaterThanOrEqual(0);
		expect([null, ...TYPES]).toContain(game.lastAtHalf);
		if (game.lastAtHalf && game.leaderAtHalf) expect(game.lastAtHalf).not.toBe(game.leaderAtHalf);
	});

	it('samples the timeline from the start to the final state', () => {
		const { timeline } = game;
		expect(timeline[0]).toEqual({ t: 0, rock: 3, paper: 3, scissors: 3 });
		expect(timeline.map((s) => s.t)).toEqual([...timeline.map((s) => s.t)].sort((a, b) => a - b));
		const last = timeline[timeline.length - 1];
		expect(last.t).toBeCloseTo(game.duration);
		expect(last[game.winner]).toBe(9);
		for (const sample of timeline) expect(sample.rock + sample.paper + sample.scissors).toBe(9);
		expect(timeline.length).toBeGreaterThanOrEqual(Math.floor(game.duration) + 1);
	});

	it('is repeatable with the same seed', () => {
		expect(simulateGame({ ...OPTIONS, random: mulberry32(1) })).toEqual(game);
	});
});

describe('createGame', () => {
	it('advancing in chunks matches simulateGame with the same seed', () => {
		const expected = simulateGame({ ...OPTIONS, random: mulberry32(5) });
		const chunked = createGame({ ...OPTIONS, random: mulberry32(5) });
		let result = null;
		let calls = 0;
		while (!result) {
			result = chunked.advance(7);
			calls++;
		}
		expect(calls).toBeGreaterThan(1);
		expect(result).toEqual(expected);
	});

	it('keeps returning the same record once finished', () => {
		const finished = createGame({ ...OPTIONS, random: mulberry32(9) });
		let result = null;
		while (!result) result = finished.advance(500);
		expect(finished.advance(10)).toBe(result);
		expect(finished.advance(1)).toBe(result);
	});

	it('exposes the live entities, which change as the game advances', () => {
		const game = createGame({ ...OPTIONS, random: mulberry32(4) });
		expect(game.entities).toHaveLength(OPTIONS.countPerType * 3);
		const before = game.entities.map((e) => e.x);
		const same = game.entities;
		game.advance(5);
		expect(game.entities).toBe(same);
		expect(game.entities.map((e) => e.x)).not.toEqual(before);
	});

	it('returns null while the game is still running', () => {
		const game = createGame({ ...OPTIONS, random: mulberry32(2) });
		expect(game.advance(1)).toBeNull();
	});

	it('calls a game a draw when maxTime is reached', () => {
		const draw = simulateGame({ ...OPTIONS, maxTime: 0.5, random: mulberry32(3) });
		expect(draw.winner).toBeNull();
		expect(draw.duration).toBeCloseTo(0.5, 1);
		expect(draw.winnerMin).toBeNull();
		expect(draw.timeline[draw.timeline.length - 1].t).toBeCloseTo(draw.duration);
	});
});

describe('summarize', () => {
	const records = [
		record({ winner: 'rock', duration: 10, firstEliminated: 'paper', leaderAtHalf: 'rock', leadChanges: 2 }),
		record({ winner: 'rock', duration: 30, firstEliminated: 'rock', leaderAtHalf: 'paper', leadChanges: 0 }),
		record({ winner: 'rock', duration: 20, firstEliminated: 'rock', leaderAtHalf: null, leadChanges: 1 }),
		record({ winner: null, duration: 600, firstEliminated: null, leaderAtHalf: 'paper', leadChanges: 3, winnerMin: null }),
		record({ winner: 'paper', duration: 40, firstEliminated: 'scissors', leaderAtHalf: 'rock', winnerMin: 1, lastAtHalf: 'paper' }),
		record({ winner: 'scissors', duration: 50, firstEliminated: 'paper', leaderAtHalf: 'rock', winnerMin: 2, lastAtHalf: 'scissors' }),
	];
	const summary = summarize(records);

	it('counts wins, draws and rates over decided games', () => {
		expect(summary).toMatchObject({ runs: 6, decided: 5, draws: 1 });
		expect(summary.wins).toEqual({ rock: 3, paper: 1, scissors: 1 });
		expect(summary.winRate.rock).toBeCloseTo(0.6);
		expect(summary.winRate.paper).toBeCloseTo(0.2);
		expect(summary.leader).toBe('rock');
	});

	it('summarises durations over decided games only', () => {
		expect(summary.duration).toEqual({ mean: 30, median: 30, min: 10, max: 50 });
		expect(summary.durationByWinner).toEqual({ rock: 20, paper: 40, scissors: 50 });
		expect(summary.fastest).toEqual({ index: 0, winner: 'rock', duration: 10 });
		expect(summary.slowest).toEqual({ index: 5, winner: 'scissors', duration: 50 });
	});

	it('averages an even number of durations for the median', () => {
		const even = summarize([record({ duration: 10 }), record({ duration: 20 }), record({ duration: 40 }), record({ duration: 100 })]);
		expect(even.duration.median).toBe(30);
	});

	it('finds the longest streak in run order, with draws breaking it', () => {
		expect(summary.longestStreak).toEqual({ type: 'rock', length: 3 });
		const broken = summarize([record(), record(), record({ winner: null }), record(), record({ winner: 'paper' })]);
		expect(broken.longestStreak).toEqual({ type: 'rock', length: 2 });
	});

	it('checks the first-out rule: the type the first-eliminated one beat wins', () => {
		// paper out -> rock wins (holds), rock out -> scissors wins (rock games fail), scissors out -> paper wins (holds), paper out -> scissors wins (fails)
		expect(summary.firstOutRule).toEqual({ holds: 2, total: 5 });
	});

	it('counts halfway leaders and comebacks', () => {
		expect(summary.halfwayLeaderWon).toEqual({ count: 1, total: 4 });
		expect(summary.comebacks).toBe(2);
		expect(summary.biggestComeback).toEqual({ index: 4, winner: 'paper', winnerMin: 1 });
	});

	it('averages lead changes across every run', () => {
		expect(summary.avgLeadChanges).toBeCloseTo(1);
	});

	it('computes chi-square and p-value against equal odds', () => {
		// expected 5/3 each: (3-5/3)^2/(5/3) + 2 * (1-5/3)^2/(5/3) = 1.0667 + 0.5333 = 1.6
		expect(summary.fairness.chiSquare).toBeCloseTo(1.6);
		expect(summary.fairness.pValue).toBeCloseTo(Math.exp(-0.8));
	});

	it('reports a lopsided split as unfair', () => {
		const lopsided = summarize(Array.from({ length: 30 }, () => record()));
		expect(lopsided.fairness.chiSquare).toBeCloseTo(60);
		expect(lopsided.fairness.pValue).toBeLessThan(0.001);
	});

	it('has no leader when the top is tied', () => {
		expect(summarize([record({ winner: 'rock' }), record({ winner: 'paper' })]).leader).toBeNull();
	});

	it('handles empty and all-draw input without NaN', () => {
		for (const input of [[], [record({ winner: null, winnerMin: null }), record({ winner: null, winnerMin: null })]]) {
			const empty = summarize(input);
			expect(empty.decided).toBe(0);
			expect(empty.leader).toBeNull();
			expect(empty.winRate).toEqual({ rock: 0, paper: 0, scissors: 0 });
			expect(empty.durationByWinner).toEqual({ rock: null, paper: null, scissors: null });
			expect(empty.duration).toEqual({ mean: 0, median: 0, min: 0, max: 0 });
			expect(empty.fastest).toBeNull();
			expect(empty.slowest).toBeNull();
			expect(empty.longestStreak).toBeNull();
			expect(empty.biggestComeback).toBeNull();
			expect(empty.fairness).toEqual({ chiSquare: 0, pValue: 1 });
			expect(Number.isFinite(empty.avgLeadChanges)).toBe(true);
		}
	});
});

describe('insights', () => {
	const noNaN = (lines) => {
		expect(Array.isArray(lines)).toBe(true);
		for (const line of lines) {
			expect(typeof line).toBe('string');
			expect(line).not.toMatch(/NaN|undefined|Infinity/);
		}
	};

	it('copes with no records', () => {
		const lines = insights(summarize([]));
		expect(lines.length).toBeGreaterThan(0);
		noNaN(lines);
	});

	it('copes with all draws', () => {
		const lines = insights(summarize([record({ winner: null, winnerMin: null }), record({ winner: null, winnerMin: null })]));
		expect(lines).toHaveLength(1);
		expect(lines[0]).toMatch(/time limit/);
		noNaN(lines);
	});

	it('copes with a single run', () => {
		noNaN(insights(summarize([record()])));
	});

	it('copes with real games', () => {
		const games = Array.from({ length: 5 }, (_, i) => simulateGame({ ...OPTIONS, random: mulberry32(100 + i) }));
		const lines = insights(summarize(games));
		expect(lines.length).toBeGreaterThanOrEqual(3);
		expect(lines.length).toBeLessThanOrEqual(7);
		noNaN(lines);
	});

	it('calls an even split pure chance', () => {
		const wins = ['rock', 'paper', 'scissors'];
		const lines = insights(summarize(Array.from({ length: 30 }, (_, i) => record({ winner: wins[i % 3] }))));
		expect(lines.join(' ')).toMatch(/consistent with pure chance/);
	});

	it('calls a lopsided split a real edge and names the leader and margin', () => {
		const wins = ['rock', 'rock', 'rock', 'rock', 'rock', 'rock', 'rock', 'rock', 'paper', 'scissors'];
		const lines = insights(summarize(wins.map((winner) => record({ winner }))));
		expect(lines[0]).toMatch(/Rock won most: 8 of 10 games \(80%\), 7 wins ahead of/);
		expect(lines.join(' ')).toMatch(/real edge/);
	});

	it('reports the first-out rule', () => {
		const lines = insights(summarize(Array.from({ length: 4 }, () => record())));
		expect(lines.join(' ')).toMatch(/In 100% of games/);
	});
});
