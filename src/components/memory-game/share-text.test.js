import { describe, expect, it } from 'vitest';
import { classicShareText, dailyShareText, timeAttackShareText } from './share-text';

const url = 'https://example.com/memory-game';

describe('dailyShareText', () => {
	it('has a summary line, the match/miss emoji and the link', () => {
		const text = dailyShareText({ date: '2026-10-05', stars: 2, moves: 18, time: 42_000, streak: 3, log: '1101' }, url);
		expect(text).toBe(`Memory Daily 2026-10-05 ⭐⭐☆ 18 moves · 0:42 🔥3\n🟩🟩⬛🟩\n${url}`);
	});

	it('wraps the emoji row at 10 per line', () => {
		const text = dailyShareText({ date: '2026-10-05', stars: 3, moves: 23, time: 1000, streak: 1, log: '1'.repeat(10) + '0'.repeat(10) + '101' }, url);
		const lines = text.split('\n');
		expect(lines).toEqual([
			'Memory Daily 2026-10-05 ⭐⭐⭐ 23 moves · 0:01 🔥1',
			'🟩'.repeat(10),
			'⬛'.repeat(10),
			'🟩⬛🟩',
			url,
		]);
	});
});

describe('classicShareText', () => {
	it('is short, with no streak', () => {
		expect(classicShareText({ label: 'Hard', stars: 1, moves: 40, time: 95_000 }, url)).toBe(`Memory Hard ⭐☆☆ 40 moves · 1:35\n${url}`);
	});
});

describe('timeAttackShareText', () => {
	it('shows the time left, rounded up like the clock', () => {
		expect(timeAttackShareText({ label: 'Easy', remaining: 11_200, moves: 9 }, url)).toBe(`Memory Time Attack Easy ⏱ 0:12 left · 9 moves\n${url}`);
	});
});
