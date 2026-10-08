import { SECTORS } from '../neon-ricochet/engine';
import { dailyStreak, dateKey } from '../memory-game/daily';
import { formatCountdown, formatTime, LEVELS } from '../memory-game/deck';

// Everything here reads data that came out of localStorage, which may be missing, from an older
// version of the games, or mangled by hand. Nothing throws; bad data just counts as "not played".

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const count = (value) => (Number.isFinite(value) && value > 0 ? Math.floor(value) : 0);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const capitalise = (text) => text.charAt(0).toUpperCase() + text.slice(1);

export const TTT_LEVELS = ['easy', 'medium', 'impossible'];
export const UTTT_LEVELS = ['easy', 'medium', 'hard'];

// Orbit uses a heuristic AI and separate records; it is excluded from classic AI difficulty summaries.
// Keys look like 'ai-medium', 'ai-impossible-endless', 'ai-easy-4x4' or 'pvp' (see TicTacToe.jsx's scoreKey)
const AI_KEY = /^ai-([a-z]+)(?:-endless)?(?:-(\d+)x\2)?$/;

// Wins ('a') and losses ('b') are from the human's side against the AI, and draws are draws.
function tallyAi(scores, levels) {
	const total = { wins: 0, losses: 0, draws: 0, friendGames: 0, beaten: new Set(), keys: [] };
	if (!isObject(scores)) return total;
	for (const [key, raw] of Object.entries(scores)) {
		if (!isObject(raw)) continue;
		const a = count(raw.a);
		const b = count(raw.b);
		const draws = count(raw.draws);
		if (key === 'pvp' || key.startsWith('pvp-')) {
			total.friendGames += a + b + draws;
			continue;
		}
		const match = AI_KEY.exec(key);
		if (!match || !levels.includes(match[1])) continue;
		total.wins += a;
		total.losses += b;
		total.draws += draws;
		if (a > 0) total.beaten.add(match[1]);
		total.keys.push({ key, level: match[1], draws });
	}
	return total;
}

const hardest = (levels, beaten) => levels.findLast((level) => beaten.has(level));

export function tictactoeStats(scores) {
	const tally = tallyAi(scores, TTT_LEVELS);
	const played = tally.wins + tally.losses + tally.draws + tally.friendGames;
	if (!played) return [];
	const top = hardest(TTT_LEVELS, tally.beaten);
	// The unbeatable AI on a 3×3 board, which is what the "Stalemate" achievement is about
	const stalemates = tally.keys.filter((k) => k.level === 'impossible' && !k.key.includes('x')).reduce((sum, k) => sum + k.draws, 0);
	return [
		{ label: 'Wins vs AI', value: String(tally.wins) },
		{ label: 'Hardest AI beaten', value: top ? capitalise(top) : '—' },
		{ label: 'Impossible draws', value: String(stalemates) },
	];
}

export function ultimateStats(scores) {
	const tally = tallyAi(scores, UTTT_LEVELS);
	const played = tally.wins + tally.losses + tally.draws + tally.friendGames;
	if (!played) return [];
	const top = hardest(UTTT_LEVELS, tally.beaten);
	return [
		{ label: 'Wins vs AI', value: String(tally.wins) },
		{ label: 'Hardest AI beaten', value: top ? capitalise(top) : '—' },
		{ label: 'Games played', value: String(played) },
	];
}

// Today's daily challenge, from the 'memory-daily' record { date, moves, time, stars, streak, log }
export function dailyStatus(daily, today = dateKey()) {
	const valid = isObject(daily) && typeof daily.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(daily.date);
	if (!valid) return { done: false, stars: 0, moves: 0, time: 0, streak: 0 };
	const streak = dailyStreak({ date: daily.date, streak: count(daily.streak) }, today);
	if (daily.date !== today) return { done: false, stars: 0, moves: 0, time: 0, streak };
	return {
		done: true,
		stars: Math.min(3, Math.max(1, count(daily.stars) || 1)),
		moves: count(daily.moves),
		time: count(daily.time),
		streak,
	};
}

export const starsText = (stars) => '★'.repeat(stars) + '☆'.repeat(3 - stars);

const LEVEL_ORDER = Object.keys(LEVELS);
const hardestLevel = (record, isValid) => LEVEL_ORDER.findLast((level) => LEVELS[level] && isValid(record[level]));

// `best` is { [level]: { moves, time } }, `timeAttack` is { [level]: best time left, in milliseconds }
export function memoryStats({ best, daily, timeAttack }, today = dateKey()) {
	const bestRecord = isObject(best) ? best : {};
	const attackRecord = isObject(timeAttack) ? timeAttack : {};
	const day = dailyStatus(daily, today);
	const bestLevel = hardestLevel(bestRecord, (r) => isObject(r) && count(r.moves) > 0 && Number.isFinite(r.time) && r.time >= 0);
	const attackLevel = hardestLevel(attackRecord, (left) => count(left) > 0);
	const hasDaily = isObject(daily) && typeof daily.date === 'string';
	if (!bestLevel && !attackLevel && !hasDaily) return [];

	const stats = [
		{ label: 'Today’s daily', value: day.done ? `Done ${starsText(day.stars)}` : 'Not done yet' },
		{ label: 'Daily streak', value: day.streak ? plural(day.streak, 'day') : '—' },
	];
	if (bestLevel) {
		const { moves, time } = bestRecord[bestLevel];
		stats.push({ label: `Best ${LEVELS[bestLevel].label}`, value: `${plural(count(moves), 'move')} · ${formatTime(time)}` });
	}
	if (attackLevel) {
		stats.push({ label: `Time Attack ${LEVELS[attackLevel].label}`, value: `${formatCountdown(count(attackRecord[attackLevel]))} left` });
	}
	return stats;
}

const RPC_RULESETS = { classic: 'Classic', 'lizard-spock': 'Lizard-Spock' };

export function rpcStats({ bestStreak, rules }) {
	const streak = count(bestStreak);
	const ruleset = typeof rules === 'string' ? RPC_RULESETS[rules] : undefined;
	if (!streak && !ruleset) return [];
	const stats = [{ label: 'Best bet streak', value: streak ? plural(streak, 'win') : '—' }];
	if (ruleset) stats.push({ label: 'Last ruleset', value: ruleset });
	return stats;
}

// How many of a game's achievements are unlocked. Secret ones count toward the total but only
// show their title once they're unlocked; for a locked one, `next` gives a hint for the first
// non-secret one to go for.
export function achievementProgress(achievements, unlockedIds, matches) {
	const group = achievements.filter(matches);
	const isUnlocked = (a) => unlockedIds.has(a.id);
	const done = group.filter(isUnlocked);
	const nextUp = group.find((a) => !isUnlocked(a) && !a.secret);
	return { earned: done.length, total: group.length, titles: done.map((a) => a.title), next: nextUp?.hint ?? null };
}

export const hasPrefix = (...prefixes) => (a) => prefixes.some((p) => a.id.startsWith(p));

// Everything the hub shows, keyed by game id. `read` is storage's load, injectable for tests.
export function readStats(read, today = dateKey()) {
	return {
		tictactoe: tictactoeStats(read('ttt-scores', {})),
		ultimate: ultimateStats(read('uttt-scores', {})),
		memory: memoryStats(
			{ best: read('memory-best', {}), daily: read('memory-daily', null), timeAttack: read('memory-time-attack', {}) },
			today,
		),
		ricochet: (() => {
			const best = read('ricochet-best', {}), rush = read('ricochet-bossrush-best', {});
			const stats = isObject(best) && count(best.score) ? [
				{ label: 'Best score', value: count(best.score).toLocaleString() },
				{ label: 'Farthest sector', value: `${Math.min(SECTORS, count(best.sector))}/${SECTORS}` },
				{ label: 'Best combo', value: `×${count(best.combo)}` },
			] : [];
			if (isObject(rush) && count(rush.score)) stats.push({ label: 'Boss Rush best', value: count(rush.score).toLocaleString() });
			return stats;
		})(),
		rpc: rpcStats({ bestStreak: read('rpc-best-streak', 0), rules: read('rpc-rules', null) }),
		daily: dailyStatus(read('memory-daily', null), today),
	};
}
