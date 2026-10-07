import { formatCountdown, formatTime } from './deck';

const PER_LINE = 10;

const starsText = (stars) => '⭐'.repeat(stars) + '☆'.repeat(3 - stars);

// 🟩 for a match, ⬛ for a miss, in the order the pairs were tried
function emojiRows(log) {
	const squares = [...log].map((pick) => (pick === '1' ? '🟩' : '⬛'));
	const rows = [];
	for (let i = 0; i < squares.length; i += PER_LINE) rows.push(squares.slice(i, i + PER_LINE).join(''));
	return rows.join('\n');
}

export function dailyShareText({ date, stars, moves, time, streak, log }, url) {
	const summary = `Memory Daily ${date} ${starsText(stars)} ${moves} moves · ${formatTime(time)} 🔥${streak}`;
	return [summary, emojiRows(log), url].join('\n');
}

export function classicShareText({ label, stars, moves, time }, url) {
	return `Memory ${label} ${starsText(stars)} ${moves} moves · ${formatTime(time)}\n${url}`;
}

export function timeAttackShareText({ label, remaining, moves }, url) {
	return `Memory Time Attack ${label} ⏱ ${formatCountdown(remaining)} left · ${moves} moves\n${url}`;
}
