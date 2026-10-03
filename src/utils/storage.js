// localStorage can be missing or throw (private windows, blocked storage), so
// every read falls back to a default and every write is best-effort.
const PREFIX = 'alfred-portfolio:';

export function load(key, fallback) {
	try {
		const raw = localStorage.getItem(PREFIX + key);
		return raw === null ? fallback : JSON.parse(raw);
	} catch {
		return fallback;
	}
}

export function save(key, value) {
	try {
		localStorage.setItem(PREFIX + key, JSON.stringify(value));
	} catch {
		// Not being able to save a high score shouldn't break the game
	}
}
