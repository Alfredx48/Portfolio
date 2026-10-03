import { describe, expect, it } from 'vitest';
import { beats, clampToBounds, countTypes, createEntities, getWinner, RADIUS, step } from './simulation';

const W = 400;
const H = 300;

// Small deterministic PRNG so the tests don't depend on Math.random
function seeded(seed) {
	return () => {
		seed = (seed * 16807) % 2147483647;
		return (seed - 1) / 2147483646;
	};
}

const entity = (type, x, y, vx = 0, vy = 0) => ({ type, x, y, vx, vy });

describe('beats', () => {
	it('follows rock-paper-scissors rules', () => {
		expect(beats('rock', 'scissors')).toBe(true);
		expect(beats('scissors', 'paper')).toBe(true);
		expect(beats('paper', 'rock')).toBe(true);
		expect(beats('scissors', 'rock')).toBe(false);
		expect(beats('rock', 'rock')).toBe(false);
	});
});

describe('createEntities', () => {
	const entities = createEntities(50, W, H, seeded(42));

	it('creates the requested number of each type', () => {
		expect(countTypes(entities)).toEqual({ rock: 50, paper: 50, scissors: 50 });
	});

	it('places every entity fully inside the board', () => {
		for (const e of entities) {
			expect(e.x).toBeGreaterThanOrEqual(RADIUS);
			expect(e.x).toBeLessThanOrEqual(W - RADIUS);
			expect(e.y).toBeGreaterThanOrEqual(RADIUS);
			expect(e.y).toBeLessThanOrEqual(H - RADIUS);
		}
	});

	it('sends entities off in every direction, not just down and to the right', () => {
		expect(entities.some((e) => e.vx < 0)).toBe(true);
		expect(entities.some((e) => e.vx > 0)).toBe(true);
		expect(entities.some((e) => e.vy < 0)).toBe(true);
		expect(entities.some((e) => e.vy > 0)).toBe(true);
	});
});

describe('step', () => {
	it('converts the loser when two entities touch', () => {
		const entities = [entity('rock', 100, 100), entity('scissors', 110, 100)];
		step(entities, W, H, 0);
		expect(entities.map((e) => e.type)).toEqual(['rock', 'rock']);
	});

	it('leaves entities alone when they are apart', () => {
		const entities = [entity('rock', 100, 100), entity('scissors', 200, 100)];
		step(entities, W, H, 0);
		expect(entities.map((e) => e.type)).toEqual(['rock', 'scissors']);
	});

	it('pushes overlapping entities apart until they just touch', () => {
		const entities = [entity('rock', 100, 100), entity('rock', 110, 100)];
		step(entities, W, H, 0);
		expect(entities[1].x - entities[0].x).toBeCloseTo(RADIUS * 2);
	});

	it('bounces approaching entities off each other', () => {
		const entities = [entity('rock', 100, 100, 50, 0), entity('rock', 120, 100, -50, 0)];
		step(entities, W, H, 0);
		expect(entities[0].vx).toBe(-50);
		expect(entities[1].vx).toBe(50);
	});

	it('handles two entities on exactly the same spot without producing NaN', () => {
		const entities = [entity('paper', 100, 100, 10, 10), entity('rock', 100, 100, -10, 5)];
		step(entities, W, H, 0);
		for (const e of entities) {
			for (const value of [e.x, e.y, e.vx, e.vy]) expect(Number.isFinite(value)).toBe(true);
		}
		expect(entities[0].type).toBe('paper');
		expect(entities[1].type).toBe('paper');
	});

	it('bounces off the walls and stays inside', () => {
		const entities = [entity('rock', W - RADIUS - 1, 50, 100, 0)];
		step(entities, W, H, 0.1);
		expect(entities[0].x).toBe(W - RADIUS);
		expect(entities[0].vx).toBe(-100);
	});

	it('keeps everyone in bounds over a long run', () => {
		const entities = createEntities(30, W, H, seeded(7));
		for (let i = 0; i < 600; i++) step(entities, W, H, 1 / 60);
		for (const e of entities) {
			expect(e.x).toBeGreaterThanOrEqual(RADIUS);
			expect(e.x).toBeLessThanOrEqual(W - RADIUS);
			expect(e.y).toBeGreaterThanOrEqual(RADIUS);
			expect(e.y).toBeLessThanOrEqual(H - RADIUS);
		}
	});
});

describe('clampToBounds', () => {
	it('pulls entities back in after the board shrinks', () => {
		const entities = [entity('rock', 380, 280, 10, 10)];
		clampToBounds(entities, 200, 150);
		expect(entities[0]).toMatchObject({ x: 200 - RADIUS, y: 150 - RADIUS, vx: -10, vy: -10 });
	});
});

describe('getWinner', () => {
	it('returns the only type left', () => {
		expect(getWinner({ rock: 0, paper: 12, scissors: 0 })).toBe('paper');
	});

	it('returns null while more than one type remains', () => {
		expect(getWinner({ rock: 3, paper: 12, scissors: 0 })).toBeNull();
	});
});
