const pad = (n) => String(n).padStart(2, '0');

// Local calendar date as YYYY-MM-DD, so "today" flips at the player's midnight
export function dateKey(date = new Date()) {
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function previousDay(key) {
	const [year, month, day] = key.split('-').map(Number);
	return dateKey(new Date(year, month - 1, day - 1));
}

// Consecutive days completed, counting back from today. It survives until a whole day is missed.
export function dailyStreak(stored, today) {
	if (!stored) return 0;
	return stored.date === today || stored.date === previousDay(today) ? stored.streak : 0;
}

// Only the first finish of a day counts; replays (and stale dates) leave the record untouched.
export function recordDaily(stored, { date, moves, time, stars, log }) {
	if (stored && stored.date >= date) return stored;
	const streak = stored?.date === previousDay(date) ? stored.streak + 1 : 1;
	return { date, moves, time, stars, streak, log };
}
