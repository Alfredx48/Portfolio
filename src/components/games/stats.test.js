import { describe, expect, it } from 'vitest';
import { achievementProgress, dailyStatus, hasPrefix, memoryStats, readStats, rpcStats, tictactoeStats, ultimateStats } from './stats';

const TODAY = '2026-10-05';
const value = (stats, label) => stats.find((s) => s.label === label)?.value;

describe('tictactoeStats', () => {
	it('shows nothing for missing or malformed data', () => {
		for (const bad of [undefined, null, 'oops', 7, [], { 'ai-easy': 'x' }, { 'ai-easy': null }, { nonsense: { a: 1 } }]) {
			expect(tictactoeStats(bad)).toEqual([]);
		}
	});

	it('adds wins across every AI mode, size and rule set', () => {
		const stats = tictactoeStats({
			'ai-easy': { a: 5, b: 1, draws: 0 },
			'ai-medium-endless': { a: 2, b: 0, draws: 0 },
			'ai-easy-4x4': { a: 3, b: 0, draws: 1 },
			pvp: { a: 9, b: 9, draws: 9 },
		});
		expect(value(stats, 'Wins vs AI')).toBe('10');
		expect(value(stats, 'Hardest AI beaten')).toBe('Medium');
	});

	it('counts Impossible draws on 3×3 only', () => {
		const stats = tictactoeStats({ 'ai-impossible': { a: 0, b: 4, draws: 3 }, 'ai-impossible-4x4': { a: 0, b: 0, draws: 8 } });
		expect(value(stats, 'Impossible draws')).toBe('3');
		expect(value(stats, 'Hardest AI beaten')).toBe('—');
	});

	it('still reports someone who has only played a friend', () => {
		const stats = tictactoeStats({ pvp: { a: 1, b: 0, draws: 0 } });
		expect(value(stats, 'Wins vs AI')).toBe('0');
	});

	it('ignores negative, fractional and non-numeric counts', () => {
		const stats = tictactoeStats({ 'ai-easy': { a: -3, b: 'x', draws: 2.7 }, 'ai-medium': { a: 4, b: null } });
		expect(value(stats, 'Wins vs AI')).toBe('4');
	});

	it('skips difficulties it does not know about', () => {
		expect(tictactoeStats({ 'ai-godlike': { a: 3, b: 0, draws: 0 } })).toEqual([]);
	});
});

describe('ultimateStats', () => {
	it('shows nothing for missing data', () => {
		expect(ultimateStats(undefined)).toEqual([]);
		expect(ultimateStats({})).toEqual([]);
		expect(ultimateStats([1, 2])).toEqual([]);
	});

	it('reports wins, the hardest AI beaten and every game played', () => {
		const stats = ultimateStats({
			'ai-easy': { a: 2, b: 0, draws: 1 },
			'ai-hard': { a: 1, b: 3, draws: 0 },
			pvp: { a: 1, b: 1, draws: 0 },
		});
		expect(value(stats, 'Wins vs AI')).toBe('3');
		expect(value(stats, 'Hardest AI beaten')).toBe('Hard');
		expect(value(stats, 'Games played')).toBe('9');
	});
});

describe('dailyStatus', () => {
	it('is not done for missing or malformed records', () => {
		for (const bad of [null, undefined, 'x', 3, [], {}, { date: 5 }, { date: 'yesterday' }]) {
			expect(dailyStatus(bad, TODAY)).toMatchObject({ done: false, streak: 0 });
		}
	});

	it('is done when the record is from today', () => {
		expect(dailyStatus({ date: TODAY, moves: 18, time: 61000, stars: 3, streak: 4 }, TODAY)).toEqual({
			done: true,
			stars: 3,
			moves: 18,
			time: 61000,
			streak: 4,
		});
	});

	it('keeps a streak alive from yesterday but is not done', () => {
		expect(dailyStatus({ date: '2026-10-04', moves: 18, time: 1, stars: 2, streak: 6 }, TODAY)).toMatchObject({ done: false, streak: 6 });
	});

	it('drops the streak after a missed day', () => {
		expect(dailyStatus({ date: '2026-10-01', moves: 18, time: 1, stars: 2, streak: 6 }, TODAY)).toMatchObject({ done: false, streak: 0 });
	});

	it('clamps stars to 1-3', () => {
		expect(dailyStatus({ date: TODAY, stars: 99, streak: 1 }, TODAY).stars).toBe(3);
		expect(dailyStatus({ date: TODAY, stars: 'many', streak: 1 }, TODAY).stars).toBe(1);
	});
});

describe('memoryStats', () => {
	it('shows nothing when nothing is stored', () => {
		expect(memoryStats({ best: {}, daily: null, timeAttack: {} }, TODAY)).toEqual([]);
		expect(memoryStats({ best: 'x', daily: 4, timeAttack: [] }, TODAY)).toEqual([]);
		expect(memoryStats({}, TODAY)).toEqual([]);
	});

	it('shows today’s result, the streak and the best on the hardest level cleared', () => {
		const stats = memoryStats(
			{
				best: { easy: { moves: 9, time: 20000 }, hard: { moves: 24, time: 65000 } },
				daily: { date: TODAY, moves: 18, time: 61000, stars: 3, streak: 4 },
				timeAttack: { medium: 12000 },
			},
			TODAY,
		);
		expect(value(stats, 'Today’s daily')).toBe('Done ★★★');
		expect(value(stats, 'Daily streak')).toBe('4 days');
		expect(value(stats, 'Best Hard')).toBe('24 moves · 1:05');
		expect(value(stats, 'Time Attack Medium')).toBe('0:12 left');
	});

	it('says the daily is not done when the record is old', () => {
		const stats = memoryStats({ best: { easy: { moves: 1, time: 1000 } }, daily: { date: '2026-09-01', streak: 3 } }, TODAY);
		expect(value(stats, 'Today’s daily')).toBe('Not done yet');
		expect(value(stats, 'Daily streak')).toBe('—');
		expect(value(stats, 'Best Easy')).toBe('1 move · 0:01');
	});

	it('skips malformed level records and unknown levels', () => {
		const stats = memoryStats(
			{ best: { easy: { moves: 9, time: 20000 }, hard: { moves: 'x' }, medium: null, impossible: { moves: 1, time: 1 } }, daily: null, timeAttack: { hard: -4 } },
			TODAY,
		);
		expect(value(stats, 'Best Easy')).toBe('9 moves · 0:20');
		expect(stats.some((s) => s.label.startsWith('Time Attack'))).toBe(false);
	});
});

describe('rpcStats', () => {
	it('shows nothing when unplayed or malformed', () => {
		expect(rpcStats({})).toEqual([]);
		expect(rpcStats({ bestStreak: 'lots', rules: 5 })).toEqual([]);
		expect(rpcStats({ bestStreak: -2, rules: 'weird' })).toEqual([]);
	});

	it('shows the best streak and last ruleset', () => {
		const stats = rpcStats({ bestStreak: 5, rules: 'lizard-spock' });
		expect(value(stats, 'Best bet streak')).toBe('5 wins');
		expect(value(stats, 'Last ruleset')).toBe('Lizard-Spock');
	});

	it('uses a dash for a streak of zero', () => {
		expect(value(rpcStats({ bestStreak: 0, rules: 'classic' }), 'Best bet streak')).toBe('—');
		expect(value(rpcStats({ bestStreak: 1 }), 'Best bet streak')).toBe('1 win');
	});
});

describe('achievementProgress', () => {
	const achievements = [
		{ id: 'ttt-a', title: 'A', hint: 'Do A' },
		{ id: 'ttt-b', title: 'B', hint: 'Do B' },
		{ id: 'ttt-secret', title: 'Hidden', hint: 'Shh', secret: true },
		{ id: 'memory-a', title: 'M', hint: 'Do M' },
	];

	it('counts a prefix group and lists unlocked titles', () => {
		const progress = achievementProgress(achievements, new Set(['ttt-b', 'memory-a']), hasPrefix('ttt-'));
		expect(progress).toEqual({ earned: 1, total: 3, titles: ['B'], next: 'Do A' });
	});

	it('does not reveal a locked secret, but does once it is unlocked', () => {
		const locked = achievementProgress(achievements, new Set(['ttt-a', 'ttt-b']), hasPrefix('ttt-'));
		expect(locked.titles).not.toContain('Hidden');
		expect(locked.next).toBeNull();
		const found = achievementProgress(achievements, new Set(['ttt-secret']), hasPrefix('ttt-'));
		expect(found.titles).toEqual(['Hidden']);
	});

	it('handles a group with nothing in it', () => {
		expect(achievementProgress(achievements, new Set(), hasPrefix('nope-'))).toEqual({ earned: 0, total: 0, titles: [], next: null });
	});
});

describe('readStats', () => {
	it('falls back cleanly when storage has nothing', () => {
		const stats = readStats((_key, fallback) => fallback, TODAY);
		expect(stats).toMatchObject({ tictactoe: [], ultimate: [], memory: [], rpc: [] });
		expect(stats.daily.done).toBe(false);
	});

	it('survives storage returning nonsense for every key', () => {
		expect(() => readStats(() => 'garbage', TODAY)).not.toThrow();
		expect(() => readStats(() => null, TODAY)).not.toThrow();
	});

	it('reads each game from its own key', () => {
		const data = {
			'ttt-scores': { 'ai-easy': { a: 2, b: 0, draws: 0 } },
			'uttt-scores': { 'ai-medium': { a: 1, b: 0, draws: 0 } },
			'memory-daily': { date: TODAY, moves: 12, time: 30000, stars: 3, streak: 2 },
			'rpc-best-streak': 3,
		};
		const stats = readStats((key, fallback) => data[key] ?? fallback, TODAY);
		expect(value(stats.tictactoe, 'Wins vs AI')).toBe('2');
		expect(value(stats.ultimate, 'Hardest AI beaten')).toBe('Medium');
		expect(value(stats.memory, 'Daily streak')).toBe('2 days');
		expect(value(stats.rpc, 'Best bet streak')).toBe('3 wins');
		expect(stats.daily.done).toBe(true);
	});
});
