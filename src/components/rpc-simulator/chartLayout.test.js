import { describe, expect, it } from 'vitest';
import { spreadLabels } from './chartLayout';

describe('spreadLabels', () => {
	it('leaves labels that already have room alone', () => {
		expect(spreadLabels([20, 60, 100], 15, 10, 130)).toEqual([20, 60, 100]);
	});

	it('pushes crowded labels apart', () => {
		const ys = spreadLabels([50, 50, 52], 15, 10, 130);
		expect(ys).toEqual([50, 65, 80]);
	});

	it('keeps the order of the labels it was given', () => {
		const ys = spreadLabels([100, 20, 60], 15, 10, 130);
		expect(ys).toEqual([100, 20, 60]);
	});

	it('stays above the bottom edge by moving the others up instead', () => {
		const ys = spreadLabels([128, 128, 128, 128, 128], 15, 10, 130);
		expect(Math.max(...ys)).toBe(130);
		expect([...ys].sort((a, b) => a - b)).toEqual([70, 85, 100, 115, 130]);
	});

	it('keeps the gap and stays in range with five labels bunched at the baseline', () => {
		const ys = spreadLabels([116, 116, 116, 116, 116], 15, 12, 116).sort((a, b) => a - b);
		expect(ys[4]).toBe(116);
		for (let i = 1; i < 5; i++) expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(15);
		expect(ys[0]).toBeGreaterThanOrEqual(12);
	});

	it('handles none', () => {
		expect(spreadLabels([], 15, 0, 100)).toEqual([]);
	});
});
