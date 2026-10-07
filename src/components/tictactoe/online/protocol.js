import { getOutcome, nextPlayer } from '../logic';

// Bump when a change would make old and new clients disagree
export const PROTOCOL_VERSION = 1;
export const REACTIONS = [{ id: 'wave', icon: '👋', label: 'Hello!' }, { id: 'nice', icon: '✨', label: 'Nice move!' }, { id: 'ouch', icon: '😅', label: 'You got me!' }, { id: 'gg', icon: '🤝', label: 'Good game!' }];

// Peer ids are shared across everyone using the free broker, so ours carry a prefix.
// The code leaves out look-alike characters (0/o, 1/l/i) because people read it aloud.
export const ROOM_PREFIX = 'alfred-ttt-';
const ROOM_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const ROOM_LENGTH = 6;
const ROOM_PATTERN = new RegExp(`^[${ROOM_ALPHABET}]{${ROOM_LENGTH}}$`);
const MAX_NAME_LENGTH = 24;
// Frames are tiny (the biggest is a hello carrying a whole game), so anything bigger isn't ours
const MAX_FRAME_LENGTH = 2048;
const MAX_GAME = 999;

// PeerJS's 'raw' mode hands over exactly what was sent, so a hostile frame can't throw inside PeerJS's own parsing.
// We parse it ourselves, below.
export const SERIALIZATION = 'raw';

export function makeRoomCode(random = Math.random) {
	let code = '';
	for (let i = 0; i < ROOM_LENGTH; i++) code += ROOM_ALPHABET[Math.floor(random() * ROOM_ALPHABET.length)];
	return code;
}

// The code from a ?room= value or a typed one, bare or as the full id, or null when it isn't one of ours.
// Anything else in the link is dropped.
export function parseRoomCode(value) {
	if (typeof value !== 'string') return null;
	let code = value.trim().toLowerCase();
	if (code.startsWith(ROOM_PREFIX)) code = code.slice(ROOM_PREFIX.length);
	return ROOM_PATTERN.test(code) ? code : null;
}

export const peerId = (code) => ROOM_PREFIX + code;

// The host plays X in the first game, then the sides swap every rematch. X always moves first.
export function markFor(role, game) {
	return (role === 'host') === (game % 2 === 0) ? 'X' : 'O';
}

// The board after a list of cell indexes, alternating from X
export function cellsFrom(moves) {
	const cells = Array(9).fill('');
	moves.forEach((index, n) => (cells[index] = n % 2 === 0 ? 'X' : 'O'));
	return cells;
}

// `state` is the sender's game so far, which a host sends so a friend who reloads can pick up where they were.
// Scores are from the sender's point of view.
export const messages = {
	hello: ({ name, state, features } = {}) => ({ type: 'hello', version: PROTOCOL_VERSION, ...(name && { name }), ...(state && { state }), ...(features && { features }) }),
	reaction: (kind, game) => ({ type: 'reaction', kind, game }),
	move: (index, seq) => ({ type: 'move', index, seq }),
	rematch: () => ({ type: 'rematch' }),
	rematchAccept: () => ({ type: 'rematch-accept' }),
	bye: () => ({ type: 'bye' }),
	full: () => ({ type: 'full' }),
	ping: () => ({ type: 'ping' }),
	pong: () => ({ type: 'pong' }),
};

const isCell = (n) => Number.isInteger(n) && n >= 0 && n <= 8;
const isCount = (n) => Number.isInteger(n) && n >= 0 && n <= MAX_GAME + 1;

// Shape only: whether the moves are legal is checkState's job
function parseState(data) {
	if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
	const { moves, game, scores } = data;
	if (!Array.isArray(moves) || moves.length > 9 || !moves.every(isCell)) return null;
	if (!Number.isInteger(game) || game < 0 || game > MAX_GAME) return null;
	if (typeof scores !== 'object' || scores === null || ![scores.you, scores.draws, scores.friend].every(isCount)) return null;
	return { moves: [...moves], game, scores: { you: scores.you, draws: scores.draws, friend: scores.friend } };
}

// Everything from the other browser is untrusted. This returns a fresh object holding only the
// fields we know about, or null if the shape is wrong. It doesn't know about the game: see checkMove.
export function parseMessage(data) {
	if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
	switch (data.type) {
		case 'hello': {
			if (!Number.isInteger(data.version) || data.version < 1) return null;
			const message = { type: 'hello', version: data.version };
			if (Array.isArray(data.features) && data.features.includes('reactions')) message.features = ['reactions'];
			if (data.name !== undefined) {
				if (typeof data.name !== 'string') return null;
				// eslint-disable-next-line no-control-regex
				message.name = data.name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, MAX_NAME_LENGTH);
			}
			// A state that is there but malformed stays in the message as null, so the hello is still understood
			// as a hello (and refused) rather than silently dropped
			if (data.state !== undefined) message.state = parseState(data.state);
			return message;
		}
		case 'reaction':
			return REACTIONS.some(reaction => reaction.id === data.kind) && Number.isInteger(data.game) && data.game >= 0 && data.game <= MAX_GAME ? { type: 'reaction', kind: data.kind, game: data.game } : null;
		case 'move':
			return isCell(data.index) && Number.isInteger(data.seq) && data.seq >= 0 ? { type: 'move', index: data.index, seq: data.seq } : null;
		case 'rematch':
		case 'rematch-accept':
		case 'bye':
		case 'full':
		case 'ping':
		case 'pong':
			return { type: data.type };
		default:
			return null;
	}
}

// Whether `message` is a legal move for `sender` on this board. `seq` is the number of moves played so far,
// which a well-behaved peer sends as its move number, so duplicates and replays fail.
// Returns { ok: true, index } or { ok: false, reason }.
export function checkMove(message, { cells, sender, seq }) {
	if (message?.type !== 'move') return { ok: false, reason: 'not a move' };
	const { index } = message;
	if (!isCell(index)) return { ok: false, reason: 'bad index' };
	if (getOutcome(cells)) return { ok: false, reason: 'game is over' };
	if (nextPlayer(cells) !== sender) return { ok: false, reason: 'not their turn' };
	if (message.seq !== seq) return { ok: false, reason: 'wrong seq' };
	if (cells[index]) return { ok: false, reason: 'cell is taken' };
	return { ok: true, index };
}

// Replays a state a friend sent from an empty board, move by move, through the same checks as a live game.
// Returns the state if every move was legal and the scores add up to the games played, else null.
export function checkState(state) {
	const played = [];
	for (const index of state.moves) {
		const cells = cellsFrom(played);
		if (!checkMove(messages.move(index, played.length), { cells, sender: nextPlayer(cells), seq: played.length }).ok) return null;
		played.push(index);
	}
	const finished = getOutcome(cellsFrom(played)) ? 1 : 0;
	const { you, draws, friend } = state.scores;
	if (you + draws + friend !== state.game + finished) return null;
	return state;
}

// The same scores seen from the other side
export const flipScores = ({ you, draws, friend }) => ({ you: friend, draws, friend: you });

export const encodeFrame = (message) => JSON.stringify(message);

// A message from a raw frame, or null if it isn't a well-formed one of ours. Never throws.
export function decodeFrame(frame) {
	if (typeof frame !== 'string' || frame.length > MAX_FRAME_LENGTH) return null;
	try {
		return parseMessage(JSON.parse(frame));
	} catch {
		return null;
	}
}
