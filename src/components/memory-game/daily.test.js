import { describe, expect, it } from 'vitest';
import { dailyStreak, dateKey, previousDay, recordDaily } from './daily';

const result = (date, extra) => ({ date, moves: 12, time: 30_000, stars: 3, log: '1111', ...extra });

describe('dateKey', () => {
	it('formats the local date as YYYY-MM-DD', () => {
		expect(dateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
		expect(dateKey(new Date(2026, 11, 31, 0, 0))).toBe('2026-12-31');
	});
});

describe('previousDay', () => {
	it('steps back across month and year boundaries', () => {
		expect(previousDay('2026-10-05')).toBe('2026-10-04');
		expect(previousDay('2026-03-01')).toBe('2026-02-28');
		expect(previousDay('2026-01-01')).toBe('2025-12-31');
	});
});

describe('recordDaily', () => {
	it('starts a streak of 1', () => {
		expect(recordDaily(null, result('2026-10-05'))).toMatchObject({ date: '2026-10-05', streak: 1 });
	});

	it('extends the streak on consecutive days', () => {
		const day1 = recordDaily(null, result('2026-10-05'));
		const day2 = recordDaily(day1, result('2026-10-06'));
		expect(day2.streak).toBe(2);
		expect(recordDaily(day2, result('2026-10-07')).streak).toBe(3);
	});

	it('restarts the streak after a missed day', () => {
		const day1 = recordDaily(null, result('2026-10-05'));
		expect(recordDaily(day1, result('2026-10-07')).streak).toBe(1);
	});

	it('keeps the first result of a day', () => {
		const first = recordDaily(null, result('2026-10-05', { moves: 20 }));
		expect(recordDaily(first, result('2026-10-05', { moves: 10 }))).toBe(first);
	});
});

describe('dailyStreak', () => {
	const stored = { date: '2026-10-05', streak: 4 };

	it('counts while today or yesterday is the last completed day', () => {
		expect(dailyStreak(stored, '2026-10-05')).toBe(4);
		expect(dailyStreak(stored, '2026-10-06')).toBe(4);
	});

	it('is 0 once a day has been missed, or with no results', () => {
		expect(dailyStreak(stored, '2026-10-07')).toBe(0);
		expect(dailyStreak(null, '2026-10-07')).toBe(0);
	});
});
