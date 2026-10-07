import { describe, expect, it } from 'vitest';
import { formatDuration, shareText } from './shareText';
import { CLASSIC, LIZARD_SPOCK } from './simulation';

describe('formatDuration', () => {
	it('formats seconds as m:ss', () => {
		expect(formatDuration(37.2)).toBe('0:37');
		expect(formatDuration(5)).toBe('0:05');
		expect(formatDuration(125)).toBe('2:05');
	});
});

describe('shareText', () => {
	const base = { winner: 'scissors', seconds: 37, rules: CLASSIC };

	it('says who won and how long it took', () => {
		expect(shareText(base)).toBe('✂️ Scissors won the RPC Simulator in 0:37');
	});

	it('brags about a correct bet and a chart prediction', () => {
		expect(shareText({ ...base, called: true, score: 41 })).toBe(
			'✂️ Scissors won the RPC Simulator in 0:37 · I called it! · 🔮 41/100 prediction score',
		);
		expect(shareText({ ...base, score: 0 })).toBe('✂️ Scissors won the RPC Simulator in 0:37 · 🔮 0/100 prediction score');
		expect(shareText({ ...base, called: true })).toBe('✂️ Scissors won the RPC Simulator in 0:37 · I called it!');
	});

	it('mentions the Lizard-Spock rules and a custom sandbox', () => {
		expect(shareText({ ...base, winner: 'spock', rules: LIZARD_SPOCK, custom: true })).toBe(
			'🖖 Spock won the RPC Simulator in 0:37 · Lizard-Spock rules · custom rules',
		);
	});

	it('never nests brackets', () => {
		const text = shareText({ ...base, rules: LIZARD_SPOCK, custom: true, called: true, score: 30 });
		expect(text).not.toMatch(/[()]/);
		expect(text.split(' · ')).toHaveLength(5);
	});
});
