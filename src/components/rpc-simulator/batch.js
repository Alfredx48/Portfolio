import { advance, CLASSIC, createEntities, LABEL, preyOf } from './simulation';

export const MAX_RUNS = 100;
export const BATCH_DT = 1 / 30; // fixed simulated seconds per step
export const MAX_GAME_TIME = 600; // simulated seconds before a game is called a draw

const EPS = 1e-9;
const round = (n) => Math.round(n * 1e6) / 1e6;

// The type with strictly the most pieces, or null on a tie for the top.
// `counts` is in the same order as `types`.
function strictLeader(counts, types) {
	let best = -1;
	let bestCount = -1;
	let tied = false;
	for (let i = 0; i < types.length; i++) {
		if (counts[i] > bestCount) {
			best = i;
			bestCount = counts[i];
			tied = false;
		} else if (counts[i] === bestCount) {
			tied = true;
		}
	}
	return tied ? null : types[best];
}

// The type still alive with strictly the fewest pieces, or null when tied or only one is left.
function strictLast(counts, types) {
	let worst = -1;
	let worstCount = Infinity;
	let alive = 0;
	let tied = false;
	for (let i = 0; i < types.length; i++) {
		if (counts[i] === 0) continue;
		alive++;
		if (counts[i] < worstCount) {
			worst = i;
			worstCount = counts[i];
			tied = false;
		} else if (counts[i] === worstCount) {
			tied = true;
		}
	}
	return alive < 2 || tied ? null : types[worst];
}

// A single game that can be advanced a few steps at a time, so the UI can spread the work across frames or draw it.
// `countPerType` is a number or { type: n }; `rules`, `radius` and `speed` are the sandbox settings (see `step`).
export function createGame({
	countPerType,
	width,
	height,
	dt = BATCH_DT,
	maxTime = MAX_GAME_TIME,
	random = Math.random,
	rules = CLASSIC,
	radius,
	speed,
}) {
	const { types } = rules;
	const options = { rules, radius, speed };
	const entities = createEntities(countPerType, width, height, random, rules);
	const counts = types.map((type) => (typeof countPerType === 'number' ? countPerType : (countPerType[type] ?? 0)));
	const min = [...counts];
	const peak = [...counts];
	const timeline = [];
	let steps = 0;
	let nextSample = 0;
	let lastLeader = null;
	let leadChanges = 0;
	let firstEliminated = null;
	let firstEliminationTime = null;
	let record = null;

	// Called once per simulated second and once at the end
	function sample(t) {
		timeline.push({ t, ...Object.fromEntries(types.map((type, i) => [type, counts[i]])) });

		const leader = strictLeader(counts, types);
		if (leader) {
			if (lastLeader && leader !== lastLeader) leadChanges++;
			lastLeader = leader;
		}
	}

	function finish(t, winnerIndex) {
		const duration = round(t);
		if (timeline[timeline.length - 1].t < duration - EPS) sample(duration);

		let leaderAtHalf = null;
		let nearest = Infinity;
		let halfSample = null;
		for (const point of timeline) {
			const gap = Math.abs(point.t - duration / 2);
			if (gap < nearest) {
				nearest = gap;
				halfSample = point;
			}
		}
		let lastAtHalf = null;
		if (halfSample) {
			const half = types.map((type) => halfSample[type]);
			leaderAtHalf = strictLeader(half, types);
			lastAtHalf = strictLast(half, types);
		}

		const won = winnerIndex !== -1;
		record = {
			winner: won ? types[winnerIndex] : null,
			duration,
			firstEliminated,
			firstEliminationTime,
			leaderAtHalf,
			lastAtHalf,
			leadChanges,
			winnerMin: won ? min[winnerIndex] : null,
			peak: Object.fromEntries(types.map((type, i) => [type, peak[i]])),
			timeline,
		};
		return record;
	}

	sample(0);
	nextSample = 1;

	return {
		entities, // live, mutated in place, so the UI can draw it
		advance(maxSteps) {
			if (record) return record;
			for (let n = 0; n < maxSteps; n++) {
				advance(entities, width, height, dt, options);
				steps++;
				const t = steps * dt;

				counts.fill(0);
				for (let i = 0; i < entities.length; i++) counts[types.indexOf(entities[i].type)]++;

				let alive = 0;
				let aliveIndex = -1;
				for (let i = 0; i < types.length; i++) {
					const c = counts[i];
					if (c < min[i]) min[i] = c;
					if (c > peak[i]) peak[i] = c;
					if (c > 0) {
						alive++;
						aliveIndex = i;
					} else if (!firstEliminated) {
						firstEliminated = types[i];
						firstEliminationTime = round(t);
					}
				}

				if (t + EPS >= nextSample) {
					sample(round(t));
					nextSample++;
				}

				if (alive === 1) return finish(t, aliveIndex);
				if (t + EPS >= maxTime) return finish(t, -1);
			}
			return null;
		},
	};
}

// Runs a whole game synchronously.
export function simulateGame(options) {
	const game = createGame(options);
	let record = null;
	while (!record) record = game.advance(2000);
	return record;
}

const sum = (list) => list.reduce((total, n) => total + n, 0);

function median(sorted) {
	if (sorted.length === 0) return 0;
	const mid = sorted.length >> 1;
	return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Aggregates an array of game records played under `rules`.
export function summarize(records, rules = CLASSIC) {
	const { types } = rules;
	const wins = Object.fromEntries(types.map((type) => [type, 0]));
	const winDurations = Object.fromEntries(types.map((type) => [type, []]));
	const durations = [];
	let fastest = null;
	let slowest = null;
	let longestStreak = null;
	let streak = null;
	let firstOutHolds = 0;
	let firstOutTotal = 0;
	let halfwayWon = 0;
	let halfwayTotal = 0;
	let comebacks = 0;
	let biggestComeback = null;

	records.forEach((record, index) => {
		const { winner } = record;
		if (!winner) {
			streak = null;
			return;
		}

		wins[winner]++;
		winDurations[winner].push(record.duration);
		durations.push(record.duration);
		if (!fastest || record.duration < fastest.duration) fastest = { index, winner, duration: record.duration };
		if (!slowest || record.duration > slowest.duration) slowest = { index, winner, duration: record.duration };

		if (streak && streak.type === winner) streak.length++;
		else streak = { type: winner, length: 1 };
		if (!longestStreak || streak.length > longestStreak.length) longestStreak = { ...streak };

		if (record.firstEliminated) {
			firstOutTotal++;
			if (preyOf(record.firstEliminated, rules).includes(winner)) firstOutHolds++;
		}

		if (record.leaderAtHalf) {
			halfwayTotal++;
			if (record.leaderAtHalf === winner) halfwayWon++;
		}

		if (winner && record.lastAtHalf === winner) {
			comebacks++;
			if (!biggestComeback || record.winnerMin < biggestComeback.winnerMin) {
				biggestComeback = { index, winner, winnerMin: record.winnerMin };
			}
		}
	});

	const runs = records.length;
	const decided = durations.length;
	const draws = runs - decided;

	const winRate = {};
	const durationByWinner = {};
	for (const type of types) {
		winRate[type] = decided ? wins[type] / decided : 0;
		durationByWinner[type] = winDurations[type].length ? sum(winDurations[type]) / winDurations[type].length : null;
	}

	const topWins = Math.max(...types.map((type) => wins[type]));
	const leaders = types.filter((type) => wins[type] === topWins);

	const sortedDurations = [...durations].sort((a, b) => a - b);
	const expected = decided / types.length;
	const chiSquare = decided ? sum(types.map((type) => (wins[type] - expected) ** 2 / expected)) : 0;

	return {
		rules,
		runs,
		decided,
		draws,
		wins,
		winRate,
		leader: leaders.length === 1 && topWins > 0 ? leaders[0] : null,
		duration: {
			mean: decided ? sum(durations) / decided : 0,
			median: median(sortedDurations),
			min: decided ? sortedDurations[0] : 0,
			max: decided ? sortedDurations[decided - 1] : 0,
		},
		durationByWinner,
		fastest,
		slowest,
		longestStreak,
		firstOutRule: { holds: firstOutHolds, total: firstOutTotal },
		halfwayLeaderWon: { count: halfwayWon, total: halfwayTotal },
		comebacks,
		biggestComeback,
		avgLeadChanges: runs ? sum(records.map((record) => record.leadChanges)) / runs : 0,
		fairness: { chiSquare, pValue: Math.exp(-chiSquare / 2) },
	};
}

const NUMBER_WORDS = { 3: 'three', 5: 'five' };
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const percent = (part, whole) => `${Math.round((part / whole) * 100)}%`;

function formatTime(seconds) {
	if (seconds < 60) return `${seconds.toFixed(1)}s`;
	const minutes = Math.floor(seconds / 60);
	return `${minutes}m ${String(Math.round(seconds - minutes * 60)).padStart(2, '0')}s`;
}

function formatP(p) {
	return p < 0.001 ? 'p < 0.001' : `p = ${p.toFixed(p < 0.01 ? 3 : 2)}`;
}

// Plain-English findings, most interesting first.
export function insights(summary) {
	const { runs, decided, draws, wins } = summary;
	const rules = summary.rules ?? CLASSIC;
	const { types } = rules;
	if (runs === 0) return ['Run some games to see what the numbers say.'];
	if (decided === 0) {
		return [`${draws === 1 ? 'The game' : `All ${runs} games`} hit the time limit without a winner, so there is nothing to compare yet.`];
	}

	const out = [];
	const ranked = [...types].sort((a, b) => wins[b] - wins[a]);
	const [first, second] = ranked;
	const top = LABEL[first];

	if (decided === 1) {
		out.push(`${top} won the only decided game.`);
	} else if (wins[first] === wins[second]) {
		const tied = ranked.filter((type) => wins[type] === wins[first]).map((type) => LABEL[type]);
		const names = tied.length > 1 ? `${tied.slice(0, -1).join(', ')} and ${tied.at(-1)}` : tied[0];
		out.push(`${names} tied on ${plural(wins[first], 'win')} each out of ${decided}.`);
	} else {
		const margin = wins[first] - wins[second];
		out.push(
			`${top} won most: ${wins[first]} of ${decided} games (${percent(wins[first], decided)}), ${plural(margin, 'win')} ahead of ${LABEL[second]}.`,
		);
	}

	if (draws > 0) {
		out.push(`${plural(draws, 'game')} ran out of time with no winner and ${draws === 1 ? 'was' : 'were'} left out of the stats.`);
	}

	if (decided >= 6) {
		const { pValue } = summary.fairness;
		if (pValue > 0.05) {
			out.push(`That split is consistent with pure chance (${formatP(pValue)}): the ${NUMBER_WORDS[types.length] ?? types.length} look evenly matched.`);
		} else {
			out.push(`That split is unlikely to be luck (${formatP(pValue)}): ${top} seems to have a real edge on this board.`);
		}
	} else if (decided > 1) {
		out.push('Too few decided games to tell luck from a real edge. Try more runs.');
	}

	const { holds, total } = summary.firstOutRule;
	if (total > 0) {
		const share = holds === total ? `In 100% of games` : `In ${percent(holds, total)} of games`;
		out.push(
			rules === CLASSIC
				? `${share}, the winner was the type whose predator vanished first. When rock is wiped out first, scissors have nothing left to fear and take over.`
				: `${share}, the winner was a type that the first one wiped out used to beat. With that predator gone, it has less to fear and takes over.`,
		);
	}

	const half = summary.halfwayLeaderWon;
	if (half.total > 0) {
		const rate = half.count / half.total;
		const verdict = rate >= 0.6 ? 'Being ahead at halftime is a strong sign' : rate < 1 / types.length ? "That's worse than a random pick: the biggest crowd feeds its predator" : 'Halftime leads are only a mild signal';
		out.push(`The halfway leader went on to win ${percent(half.count, half.total)} of the time (${half.count} of ${half.total}). ${verdict}.`);
	}

	if (summary.comebacks > 0) {
		const big = summary.biggestComeback;
		out.push(
			`${plural(summary.comebacks, 'game')} ${summary.comebacks === 1 ? 'was a comeback' : 'were comebacks'}, with the winner in last place at halftime. Wildest: ${LABEL[big.winner]} dropped to just ${plural(big.winnerMin, 'piece')} in game ${big.index + 1} and still won.`,
		);
	} else if (decided > 1) {
		out.push('No comebacks: no winner was in last place at halftime.');
	}

	if (decided === 1) {
		out.push(`The game lasted ${formatTime(summary.fastest.duration)}.`);
	} else if (summary.fastest.index !== summary.slowest.index) {
		const { fastest, slowest } = summary;
		out.push(
			`Fastest game: #${fastest.index + 1} in ${formatTime(fastest.duration)} (${LABEL[fastest.winner]}). Slowest: #${slowest.index + 1} in ${formatTime(slowest.duration)} (${LABEL[slowest.winner]}).`,
		);
	}

	const streak = summary.longestStreak;
	if (streak && streak.length >= 2) {
		out.push(`Longest streak: ${LABEL[streak.type]} won ${streak.length} games in a row.`);
	}

	return out.slice(0, 7);
}
