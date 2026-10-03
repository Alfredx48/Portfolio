export const TYPES = ['rock', 'paper', 'scissors'];
export const EMOJI = { rock: '🪨', paper: '🧻', scissors: '✂️' };
export const LABEL = { rock: 'Rock', paper: 'Paper', scissors: 'Scissors' };
// Series colours for the population chart, validated as a set on the dark board surface
export const COLOR = { rock: '#3987e5', paper: '#d95926', scissors: '#199e70' };
export const RADIUS = 14;
export const BASE_SPEED = 80; // px per second at 1× speed

const BEATS = { rock: 'scissors', paper: 'rock', scissors: 'paper' };

export const beats = (a, b) => BEATS[a] === b;

// One entity at (x, y), heading in a random direction.
export function createEntity(type, x, y, random = Math.random) {
	const angle = random() * 2 * Math.PI;
	const speed = BASE_SPEED * (0.6 + random() * 0.8);
	return { type, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed };
}

// `countPerType` of each type at random positions.
export function createEntities(countPerType, width, height, random = Math.random) {
	const entities = [];
	for (const type of TYPES) {
		for (let i = 0; i < countPerType; i++) {
			const x = RADIUS + random() * (width - 2 * RADIUS);
			const y = RADIUS + random() * (height - 2 * RADIUS);
			entities.push(createEntity(type, x, y, random));
		}
	}
	return entities;
}

// Keeps everything inside the walls, bouncing off any wall it was pushed past.
export function clampToBounds(entities, width, height) {
	for (const e of entities) {
		if (e.x < RADIUS) {
			e.x = RADIUS;
			e.vx = Math.abs(e.vx);
		} else if (e.x > width - RADIUS) {
			e.x = width - RADIUS;
			e.vx = -Math.abs(e.vx);
		}
		if (e.y < RADIUS) {
			e.y = RADIUS;
			e.vy = Math.abs(e.vy);
		} else if (e.y > height - RADIUS) {
			e.y = height - RADIUS;
			e.vy = -Math.abs(e.vy);
		}
	}
}

// Advances the simulation by `dt` seconds, mutating `entities` in place.
// Touching entities bounce apart, and the loser of a matchup becomes the winner's type.
export function step(entities, width, height, dt) {
	for (const e of entities) {
		e.x += e.vx * dt;
		e.y += e.vy * dt;
	}

	const minDist = RADIUS * 2;
	for (let i = 0; i < entities.length; i++) {
		const a = entities[i];
		for (let j = i + 1; j < entities.length; j++) {
			const b = entities[j];
			const dx = b.x - a.x;
			const dy = b.y - a.y;
			if (Math.abs(dx) >= minDist || Math.abs(dy) >= minDist) continue;

			const dist = Math.hypot(dx, dy);
			if (dist >= minDist) continue;

			// Coincident centres have no direction to separate along, so pick one
			const nx = dist === 0 ? 1 : dx / dist;
			const ny = dist === 0 ? 0 : dy / dist;

			// Push them apart until they're just touching
			const push = (minDist - dist) / 2;
			a.x -= nx * push;
			a.y -= ny * push;
			b.x += nx * push;
			b.y += ny * push;

			// Equal-mass elastic bounce: swap velocity along the normal, if they're approaching
			const approach = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
			if (approach < 0) {
				a.vx += approach * nx;
				a.vy += approach * ny;
				b.vx -= approach * nx;
				b.vy -= approach * ny;
			}

			if (beats(a.type, b.type)) b.type = a.type;
			else if (beats(b.type, a.type)) a.type = b.type;
		}
	}

	clampToBounds(entities, width, height);
}

export function countTypes(entities) {
	const counts = { rock: 0, paper: 0, scissors: 0 };
	for (const e of entities) counts[e.type]++;
	return counts;
}

// The surviving type once only one is left, otherwise null.
export function getWinner(counts) {
	const alive = TYPES.filter((type) => counts[type] > 0);
	return alive.length === 1 ? alive[0] : null;
}
