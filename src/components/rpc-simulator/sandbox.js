// The sandbox settings: how fast each type moves, how many of each start, and how close pieces
// must be to fight. They're kept for every type so switching rules doesn't lose them.
import { RULESETS } from './simulation';

export const SPEED_RANGE = { min: 0.25, max: 3, step: 0.25 };
export const RADIUS_RANGE = { min: 0.5, max: 2, step: 0.25 };
export const COUNT_RANGE = { min: 1, max: 100 };

const ALL_TYPES = [...new Set(RULESETS.flatMap((rules) => rules.types))];
const clamp = (value, { min, max }, fallback) => (Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback);

// `counts` is null for "same as the Count per type control".
export const defaultSandbox = () => ({
	speed: Object.fromEntries(ALL_TYPES.map((type) => [type, 1])),
	counts: Object.fromEntries(ALL_TYPES.map((type) => [type, null])),
	radius: 1,
});

// Anything read back from storage may be missing or mangled, so rebuild it from the defaults.
export function normalizeSandbox(raw) {
	const sandbox = defaultSandbox();
	if (!raw || typeof raw !== 'object') return sandbox;
	for (const type of ALL_TYPES) {
		sandbox.speed[type] = clamp(raw.speed?.[type], SPEED_RANGE, 1);
		const count = raw.counts?.[type];
		sandbox.counts[type] = Number.isFinite(count) ? Math.round(clamp(count, COUNT_RANGE, 1)) : null;
	}
	sandbox.radius = clamp(raw.radius, RADIUS_RANGE, 1);
	return sandbox;
}

// How many of each type start the round.
export function startCounts(sandbox, rules, defaultCount) {
	return Object.fromEntries(rules.types.map((type) => [type, sandbox.counts[type] ?? defaultCount]));
}

// True when anything about the active types differs from a plain game.
export function isCustom(sandbox, rules, defaultCount) {
	return (
		sandbox.radius !== 1 ||
		rules.types.some((type) => sandbox.speed[type] !== 1 || (sandbox.counts[type] ?? defaultCount) !== defaultCount)
	);
}

// The part of the sandbox that `step` and `createGame` take.
export const simOptions = (sandbox) => ({ radius: sandbox.radius, speed: sandbox.speed });
