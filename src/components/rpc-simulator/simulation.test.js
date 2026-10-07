import { describe, expect, it } from 'vitest';
import {
	advance,
	beats,
	CLASSIC,
	clampToBounds,
	countTypes,
	createEntities,
	EMOJI,
	getRules,
	getWinner,
	LIZARD_SPOCK,
	BASE_SPEED,
	MAX_SUBSTEPS,
	preyOf,
	RADIUS,
	step,
	substepsFor,
	TYPES,
} from './simulation';

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

describe('rulesets', () => {
	it('keeps the classic exports', () => {
		expect(TYPES).toEqual(['rock', 'paper', 'scissors']);
		expect(CLASSIC.types).toEqual(TYPES);
		expect(getRules('nonsense')).toBe(CLASSIC);
		expect(getRules('lizard-spock')).toBe(LIZARD_SPOCK);
	});

	it('adds a lizard and a Spock', () => {
		expect(LIZARD_SPOCK.types).toEqual(['rock', 'paper', 'scissors', 'lizard', 'spock']);
		expect(EMOJI.lizard).toBe('🦎');
		expect(EMOJI.spock).toBe('🖖');
		expect(LIZARD_SPOCK.emoji.spock).toBe('🖖');
		expect(new Set(Object.values(LIZARD_SPOCK.color)).size).toBe(5);
	});
});

describe('Lizard-Spock beats', () => {
	const rules = LIZARD_SPOCK;
	// [winner, loser], straight from the rules
	const RELATIONS = [
		['scissors', 'paper'], // cuts
		['paper', 'rock'], // covers
		['rock', 'lizard'], // crushes
		['lizard', 'spock'], // poisons
		['spock', 'scissors'], // smashes
		['scissors', 'lizard'], // decapitates
		['lizard', 'paper'], // eats
		['paper', 'spock'], // disproves
		['spock', 'rock'], // vaporizes
		['rock', 'scissors'], // crushes
	];

	it.each(RELATIONS)('%s beats %s and not the other way round', (winner, loser) => {
		expect(beats(winner, loser, rules)).toBe(true);
		expect(beats(loser, winner, rules)).toBe(false);
	});

	it('has exactly those 10 relations', () => {
		const all = rules.types.flatMap((a) => rules.types.filter((b) => beats(a, b, rules)).map((b) => [a, b]));
		expect(all).toHaveLength(10);
		for (const pair of RELATIONS) expect(all).toContainEqual(pair);
	});

	it('has nothing beat itself, and every type beats two and loses to two', () => {
		for (const type of rules.types) {
			expect(beats(type, type, rules)).toBe(false);
			expect(preyOf(type, rules)).toHaveLength(2);
			expect(rules.types.filter((other) => beats(other, type, rules))).toHaveLength(2);
		}
	});

	it('leaves classic alone', () => {
		expect(beats('rock', 'lizard')).toBe(false);
		expect(beats('spock', 'rock')).toBe(false);
		expect(beats('rock', 'scissors', CLASSIC)).toBe(true);
	});
});

describe('five types', () => {
	it('creates and counts all five', () => {
		const entities = createEntities(4, W, H, seeded(3), LIZARD_SPOCK);
		expect(countTypes(entities, LIZARD_SPOCK)).toEqual({ rock: 4, paper: 4, scissors: 4, lizard: 4, spock: 4 });
	});

	it('takes a different count for each type', () => {
		const entities = createEntities({ rock: 1, paper: 2, scissors: 3, lizard: 0, spock: 5 }, W, H, seeded(3), LIZARD_SPOCK);
		expect(countTypes(entities, LIZARD_SPOCK)).toEqual({ rock: 1, paper: 2, scissors: 3, lizard: 0, spock: 5 });
	});

	it('converts by the Lizard-Spock rules', () => {
		const entities = [entity('lizard', 100, 100), entity('spock', 110, 100), entity('paper', 400, 400)];
		step(entities, 800, 800, 0, { rules: LIZARD_SPOCK });
		expect(entities.map((e) => e.type)).toEqual(['lizard', 'lizard', 'paper']);
	});

	it('runs to a single winner', () => {
		const entities = createEntities(6, W, H, seeded(11), LIZARD_SPOCK);
		for (let i = 0; i < 60000 && !getWinner(countTypes(entities, LIZARD_SPOCK)); i++) {
			step(entities, W, H, 1 / 30, { rules: LIZARD_SPOCK });
		}
		const counts = countTypes(entities, LIZARD_SPOCK);
		expect(LIZARD_SPOCK.types).toContain(getWinner(counts));
		expect(Object.values(counts).reduce((a, b) => a + b)).toBe(30);
	});
});

describe('sandbox settings', () => {
	it('reports how many pieces converted', () => {
		expect(step([entity('rock', 100, 100), entity('scissors', 110, 100)], W, H, 0)).toBe(1);
		expect(step([entity('rock', 100, 100), entity('scissors', 250, 100)], W, H, 0)).toBe(0);
	});

	it('makes no conversions with a radius of 0', () => {
		const entities = createEntities(10, W, H, seeded(5));
		let converted = 0;
		for (let i = 0; i < 600; i++) converted += step(entities, W, H, 1 / 30, { radius: 0 });
		expect(converted).toBe(0);
		expect(countTypes(entities)).toEqual({ rock: 10, paper: 10, scissors: 10 });
	});

	it('lets pieces pass through each other with a small radius, and fight only when deeply overlapping', () => {
		// 20px apart: touching in a normal game, but outside half the contact distance of 14
		const apart = [entity('rock', 100, 100), entity('scissors', 120, 100)];
		step(apart, W, H, 0, { radius: 0.5 });
		expect(apart.map((e) => e.type)).toEqual(['rock', 'scissors']);
		expect(apart[1].x - apart[0].x).toBeCloseTo(20); // not pushed apart either

		const close = [entity('rock', 100, 100), entity('scissors', 110, 100)];
		step(close, W, H, 0, { radius: 0.5 });
		expect(close.map((e) => e.type)).toEqual(['rock', 'rock']);
	});

	it('fights from further away with a large radius, without pushing apart', () => {
		const entities = [entity('rock', 100, 100), entity('scissors', 140, 100)];
		step(entities, W, H, 0, { radius: 2 });
		expect(entities.map((e) => e.type)).toEqual(['rock', 'rock']);
		expect(entities[1].x - entities[0].x).toBe(40);

		const normal = [entity('rock', 100, 100), entity('scissors', 140, 100)];
		step(normal, W, H, 0);
		expect(normal.map((e) => e.type)).toEqual(['rock', 'scissors']);
	});

	it('moves a type further with a higher speed multiplier', () => {
		const run = (speed) => {
			const e = entity('rock', 100, 100, 50, 0);
			step([e], W, H, 1, { speed });
			return e.x - 100;
		};
		expect(run(undefined)).toBe(50);
		expect(run({ rock: 2 })).toBe(100);
		expect(run({ rock: 0.5 })).toBe(25);
		expect(run({ paper: 3 })).toBe(50);
	});

	it('applies the multiplier of the type a piece is now, not the one it started as', () => {
		const entities = [entity('rock', 100, 100), entity('scissors', 110, 100, 10, 0)];
		step(entities, W, H, 0, {});
		const before = entities[1].x;
		step(entities, W, H, 1, { speed: { scissors: 5, rock: 1 } });
		// Scissors became rock, so the 5x no longer applies
		expect(entities[1].x - before).toBe(10);
	});
});

describe('substeps', () => {
	it('needs only one at normal speed', () => {
		expect(substepsFor(1 / 60)).toBe(1);
		expect(substepsFor(1 / 30)).toBe(1);
	});

	it('uses more as the time step, a speed multiplier or a small radius makes pieces move further', () => {
		expect(substepsFor(0.267)).toBeGreaterThan(1);
		expect(substepsFor(0.133, { speed: { rock: 3 } })).toBeGreaterThan(substepsFor(0.133));
		expect(substepsFor(0.1, { radius: 0.5 })).toBeGreaterThan(substepsFor(0.1));
	});

	it('keeps each substep under half the distance at which pieces touch', () => {
		const options = { speed: { rock: 3, paper: 1, scissors: 1 } };
		const n = substepsFor(0.133, options);
		expect((BASE_SPEED * 1.4 * 3 * 0.133) / n).toBeLessThanOrEqual(RADIUS);
	});

	it('is capped so a huge step stays affordable, and ignores a radius of 0', () => {
		expect(substepsFor(10, { speed: { rock: 3 }, radius: 0.5 })).toBe(MAX_SUBSTEPS);
		expect(substepsFor(10, { radius: 0 })).toBe(1);
	});

	it('does not let a fast piece jump over another at 8x speed', () => {
		// 8x at 30fps is a 0.267s step; a 3x rock covers 90px of its 112 px/s
		const fast = () => [entity('rock', 100, 100, 112, 0), entity('scissors', 160, 100)];
		const options = { speed: { rock: 3 } };

		const jumped = fast();
		step(jumped, 800, 400, 0.267, options);
		expect(jumped.map((e) => e.type)).toEqual(['rock', 'scissors']); // one big step skips straight past

		const entities = fast();
		expect(advance(entities, 800, 400, 0.267, options)).toBeGreaterThan(0);
		expect(entities.map((e) => e.type)).toEqual(['rock', 'rock']);
	});

	it('moves the same distance in total as a single step would', () => {
		const one = [entity('rock', 100, 100, 50, 20)];
		const many = [entity('rock', 100, 100, 50, 20)];
		step(one, 800, 400, 0.2);
		advance(many, 800, 400, 0.2, { speed: { rock: 3 } });
		step(one, 800, 400, 0.4);
		expect(many[0].x).toBeCloseTo(one[0].x, 5);
		expect(many[0].y).toBeCloseTo(one[0].y, 5);
	});
});
