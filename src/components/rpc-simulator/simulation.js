export const RADIUS = 14;
export const BASE_SPEED = 80; // px per second at 1× speed
const MAX_SPEED_JITTER = 1.4; // the fastest a piece can start out, as a multiple of BASE_SPEED

// Every piece the game knows about. A ruleset picks which of these are in play.
const PIECES = {
	rock: { emoji: '🪨', label: 'Rock', plural: 'rocks' },
	paper: { emoji: '🧻', label: 'Paper', plural: 'papers' },
	scissors: { emoji: '✂️', label: 'Scissors', plural: 'scissors' },
	lizard: { emoji: '🦎', label: 'Lizard', plural: 'lizards' },
	spock: { emoji: '🖖', label: 'Spock', plural: 'Spocks' },
};

// Series colours for the population chart, validated as a set on the dark board surface.
// Order is the series order: lizard and Spock were picked so each neighbour stays distinct
// under colour-blind simulation (violet and amber, against the existing blue, orange, green).
const COLORS = { rock: '#3987e5', paper: '#d95926', scissors: '#199e70', lizard: '#9085e9', spock: '#c98500' };

// What each type beats
const CLASSIC_BEATS = { rock: ['scissors'], paper: ['rock'], scissors: ['paper'] };
const LIZARD_SPOCK_BEATS = {
	rock: ['scissors', 'lizard'], // crushes both
	paper: ['rock', 'spock'], // covers rock, disproves Spock
	scissors: ['paper', 'lizard'], // cuts paper, decapitates lizard
	lizard: ['spock', 'paper'], // poisons Spock, eats paper
	spock: ['scissors', 'rock'], // smashes scissors, vaporizes rock
};

function makeRules(id, name, beatsTable) {
	const types = Object.keys(beatsTable);
	const pick = (key) => Object.fromEntries(types.map((type) => [type, PIECES[type][key]]));
	return {
		id,
		name,
		types,
		beats: beatsTable,
		emoji: pick('emoji'),
		label: pick('label'),
		plural: pick('plural'),
		color: Object.fromEntries(types.map((type) => [type, COLORS[type]])),
	};
}

export const CLASSIC = makeRules('classic', 'Classic', CLASSIC_BEATS);
export const LIZARD_SPOCK = makeRules('lizard-spock', 'Lizard-Spock', LIZARD_SPOCK_BEATS);
export const RULESETS = [CLASSIC, LIZARD_SPOCK];

export const getRules = (id) => RULESETS.find((rules) => rules.id === id) ?? CLASSIC;

// The classic exports, so nothing that only knows three types has to change. The lookup
// tables also cover lizard and Spock, so any type on the board can be drawn from them.
export const TYPES = CLASSIC.types;
export const EMOJI = Object.fromEntries(Object.entries(PIECES).map(([type, piece]) => [type, piece.emoji]));
export const LABEL = Object.fromEntries(Object.entries(PIECES).map(([type, piece]) => [type, piece.label]));
export const COLOR = COLORS;

export const beats = (a, b, rules = CLASSIC) => rules.beats[a]?.includes(b) ?? false;

// The types `type` beats.
export const preyOf = (type, rules = CLASSIC) => rules.beats[type] ?? [];

// One entity at (x, y), heading in a random direction.
export function createEntity(type, x, y, random = Math.random) {
	const angle = random() * 2 * Math.PI;
	const speed = BASE_SPEED * (0.6 + random() * 0.8);
	return { type, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed };
}

// `countPerType` of each type at random positions: one number for all, or { type: n } for each.
export function createEntities(countPerType, width, height, random = Math.random, rules = CLASSIC) {
	const entities = [];
	for (const type of rules.types) {
		const count = typeof countPerType === 'number' ? countPerType : (countPerType[type] ?? 0);
		for (let i = 0; i < count; i++) {
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

export const MAX_SUBSTEPS = 16;

// Pushes a and b apart if they overlap, and converts the loser if they're within `reach`. True if one converted.
function meet(a, b, reach, minDist, rules) {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	if (Math.abs(dx) >= reach || Math.abs(dy) >= reach) return false;

	const dist = Math.hypot(dx, dy);
	if (dist >= reach) return false;

	if (dist < minDist) {
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
	}

	if (beats(a.type, b.type, rules)) {
		b.type = a.type;
		return true;
	}
	if (beats(b.type, a.type, rules)) {
		a.type = b.type;
		return true;
	}
	return false;
}

// Advances the simulation by `dt` seconds, mutating `entities` in place, and returns how many converted.
// Touching entities bounce apart, and the loser of a matchup becomes the winner's type.
// `options` (all optional): `rules`, `radius` (a multiplier on the contact distance for fighting),
// and `speed` ({ type: multiplier } on how fast each type moves). Every pair is checked: a grid of cells to cut
// that down was tried, and was slower up to 500 pieces.
export function step(entities, width, height, dt, { rules = CLASSIC, radius = 1, speed } = {}) {
	for (const e of entities) {
		const factor = (speed?.[e.type] ?? 1) * dt;
		e.x += e.vx * factor;
		e.y += e.vy * factor;
	}

	// Pieces fight within `reach`, but a smaller reach also lets them overlap, or they could never get that close
	const reach = RADIUS * 2 * radius;
	const minDist = Math.min(RADIUS * 2, reach);
	let converted = 0;
	for (let i = 0; i < entities.length; i++) {
		for (let j = i + 1; j < entities.length; j++) {
			if (meet(entities[i], entities[j], reach, minDist, rules)) converted++;
		}
	}

	clampToBounds(entities, width, height);
	return converted;
}

// How many substeps keep the fastest piece from moving more than half the distance at which pieces
// touch in `dt` seconds, or it could jump right over another one (a big speed-up multiplies `dt`).
export function substepsFor(dt, { rules = CLASSIC, radius = 1, speed } = {}) {
	const touch = Math.min(RADIUS * 2, RADIUS * 2 * radius);
	if (touch <= 0) return 1;
	const fastest = BASE_SPEED * MAX_SPEED_JITTER * Math.max(...rules.types.map((type) => speed?.[type] ?? 1));
	return Math.min(MAX_SUBSTEPS, Math.max(1, Math.ceil((fastest * dt) / (touch / 2))));
}

// `step`, split into as many substeps as needed. Returns how many converted.
export function advance(entities, width, height, dt, options = {}) {
	const count = substepsFor(dt, options);
	let converted = 0;
	for (let i = 0; i < count; i++) converted += step(entities, width, height, dt / count, options);
	return converted;
}

export function countTypes(entities, rules = CLASSIC) {
	const counts = Object.fromEntries(rules.types.map((type) => [type, 0]));
	for (const e of entities) counts[e.type]++;
	return counts;
}

// The surviving type once only one is left, otherwise null.
export function getWinner(counts) {
	const alive = Object.keys(counts).filter((type) => counts[type] > 0);
	return alive.length === 1 ? alive[0] : null;
}
