import css from '../../assets/memory-game-images/css.png';
import dart from '../../assets/memory-game-images/dart.png';
import firebase from '../../assets/memory-game-images/firebase.png';
import flutter from '../../assets/memory-game-images/flutter.png';
import go from '../../assets/memory-game-images/go.png';
import html5 from '../../assets/memory-game-images/html5.png';
import jquery from '../../assets/memory-game-images/jquery.png';
import js from '../../assets/memory-game-images/js.png';
import jsx from '../../assets/memory-game-images/jsx.png';
import next from '../../assets/memory-game-images/next.png';
import node from '../../assets/memory-game-images/node.png';
import python from '../../assets/memory-game-images/python.png';
import react from '../../assets/memory-game-images/react.png';
import rust from '../../assets/memory-game-images/rust.png';
import sql from '../../assets/memory-game-images/sql.png';

export const LOGOS = [
	{ name: 'CSS', image: css },
	{ name: 'Dart', image: dart },
	{ name: 'Firebase', image: firebase },
	{ name: 'Flutter', image: flutter },
	{ name: 'Go', image: go },
	{ name: 'HTML5', image: html5 },
	{ name: 'jQuery', image: jquery },
	{ name: 'JavaScript', image: js },
	{ name: 'JSX', image: jsx },
	{ name: 'Next.js', image: next },
	{ name: 'Node.js', image: node },
	{ name: 'Python', image: python },
	{ name: 'React', image: react },
	{ name: 'Rust', image: rust },
	{ name: 'SQL', image: sql },
];

// `cols`/`colsNarrow` are the grid columns on wide and narrow screens; `timeLimit` is the Time Attack
// start clock in seconds. Matches add time back, so it mostly has to cover the opening guesses.
export const LEVELS = {
	easy: { label: 'Easy', pairs: 6, cols: 4, colsNarrow: 3, timeLimit: 20 },
	medium: { label: 'Medium', pairs: 10, cols: 5, colsNarrow: 4, timeLimit: 30 },
	hard: { label: 'Hard', pairs: 15, cols: 6, colsNarrow: 5, timeLimit: 40 },
};

export const DAILY_LEVEL = 'medium';

// Fisher–Yates, returning a new array
function shuffle(items, random) {
	const result = [...items];
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
}

// FNV-1a: a small, well-spread 32-bit hash of a string, to seed the PRNG below
export function hashString(text) {
	let hash = 2166136261;
	for (let i = 0; i < text.length; i++) {
		hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
	}
	return hash >>> 0;
}

// mulberry32: a tiny seeded PRNG returning floats in [0, 1) like Math.random
export function seededRandom(seed) {
	let state = typeof seed === 'string' ? hashString(seed) : seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

// The same layout for everyone on a given date (YYYY-MM-DD)
export function dailyDeck(date) {
	return createDeck(LEVELS[DAILY_LEVEL].pairs, seededRandom(`memory-daily:${date}`));
}

// `pairs` random logos, two cards each with a unique id, shuffled.
export function createDeck(pairs = LOGOS.length, random = Math.random) {
	const logos = shuffle(LOGOS, random).slice(0, pairs);
	const deck = logos.flatMap((logo, i) => [
		{ id: i * 2, ...logo },
		{ id: i * 2 + 1, ...logo },
	]);
	return shuffle(deck, random);
}

// 3 stars for a near-perfect game, down to 1
export function starsFor(moves, pairs) {
	if (moves <= Math.ceil(pairs * 1.5)) return 3;
	if (moves <= pairs * 2) return 2;
	return 1;
}

export function formatTime(ms) {
	const seconds = Math.floor(ms / 1000);
	return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

// A countdown rounds up, so it only reads 0:00 once time has really run out
export function formatCountdown(ms) {
	return formatTime(Math.ceil(ms / 1000) * 1000);
}
