import { getResult, LINES, other } from '../logic';

// The 81 cells are numbered board by board: cell `index` is cell `index % 9` of board `Math.floor(index / 9)`.
// Playing cell c sends the opponent to board c.
export const BOARD_NAMES = [
	'top-left', 'top-middle', 'top-right',
	'middle-left', 'centre', 'middle-right',
	'bottom-left', 'bottom-middle', 'bottom-right',
];

export const DIFFICULTIES = ['easy', 'medium', 'hard'];

// '' while a small board is open, X or O for the winner, 'D' once it's full with no winner
function claim(cells, board) {
	const result = getResult(cells.slice(board * 9, board * 9 + 9));
	return result ? (result.player ?? 'D') : '';
}

// The result on the big board: { player, line } for a win (line is three board numbers), { player: null, line: [] }
// for a draw, or null while the game goes on. A draw is called as soon as no line of boards can be completed
// any more, with `early: true` if some boards are still open.
export function bigResult(boards) {
	// A drawn board belongs to nobody, so it counts as empty here
	const marks = boards.map((b) => (b === 'X' || b === 'O' ? b : ''));
	const result = getResult(marks);
	if (result?.player) return result;
	if (result) return { player: null, line: [] };
	const possible = LINES.some((line) => ['X', 'O'].some((p) => line.every((i) => boards[i] === '' || boards[i] === p)));
	if (possible) return null;
	return boards.includes('') ? { player: null, line: [], early: true } : { player: null, line: [] };
}

// Builds the full game state from the marks alone, so positions can be set up directly (the tests do).
// `forced` is the board the player to move has to play in; it's dropped if that board is decided.
export function analyze(cells, turn, forced = null, last = null) {
	const boards = Array.from({ length: 9 }, (_, b) => claim(cells, b));
	return {
		cells,
		boards,
		turn,
		forced: forced !== null && boards[forced] === '' ? forced : null,
		last,
		result: bigResult(boards),
	};
}

export const createGame = () => ({ ...analyze(Array(81).fill(''), 'X'), wildcards: { X: 1, O: 1 } });

export function legalMoves(game) {
	if (game.result) return [];
	const moves = [];
	for (let board = 0; board < 9; board++) {
		if (game.boards[board] || (game.forced !== null && game.forced !== board)) continue;
		for (let c = 0; c < 9; c++) if (!game.cells[board * 9 + c]) moves.push(board * 9 + c);
	}
	return moves;
}

// Returns the game after the move, or the same game if the move isn't legal.
export function playMove(game, index, options = {}) {
	const wildcards = game.wildcards ?? { X: 1, O: 1 };
	const useWildcard = options.wildcard === true;
	if (useWildcard && !wildcards[game.turn]) return game;
	if (!legalMoves(useWildcard ? { ...game, forced: null } : game).includes(index)) return game;
	const cells = [...game.cells];
	cells[index] = game.turn;
	return { ...analyze(cells, other(game.turn), index % 9, index), wildcards: { ...wildcards, [game.turn]: wildcards[game.turn] - Number(useWildcard) } };
}

// The game as it stands after `moves` (cell numbers, X first). The moves are the only state worth keeping.
export const replay = (moves) => moves.reduce((game, move) => typeof move === 'number' ? playMove(game, move) : playMove(game, move.index, { wildcard: move.wildcard }), createGame());

// ---------------------------------------------------------------------------
// The AI
//
// The search works on a compact mutable position and a few lookup tables over every possible small board
// (3^9 of them), so that scoring a position doesn't have to look at individual cells.
// ---------------------------------------------------------------------------

const POW = [1, 3, 9, 27, 81, 243, 729, 2187, 6561];
const KEYS = POW[8] * 3;
const INFINITY = 1e9;
const MATE = 1e6;

// Small board states: 0 open, 1 X won, 2 O won, 3 full
let STATUS; // by board key
let WINS; // [, X, O]: bit c is set when that player completes a line by playing cell c
let LOCAL; // how good a board looks for X (negative: for O) from its lines and cells

function buildTables() {
	STATUS = new Uint8Array(KEYS);
	WINS = [null, new Uint16Array(KEYS), new Uint16Array(KEYS)];
	LOCAL = new Float32Array(KEYS);
	const v = Array(9);
	for (let key = 0; key < KEYS; key++) {
		for (let c = 0; c < 9; c++) v[c] = Math.floor(key / POW[c]) % 3;
		let status = 0;
		let local = 0;
		for (const [a, b, c] of LINES) {
			const line = [v[a], v[b], v[c]];
			const x = line.filter((m) => m === 1).length;
			const o = line.filter((m) => m === 2).length;
			if (x === 3) status = 1;
			else if (o === 3 && !status) status = 2;
			if (x === 2 && o === 0) WINS[1][key] |= 1 << [a, b, c][line.indexOf(0)];
			if (o === 2 && x === 0) WINS[2][key] |= 1 << [a, b, c][line.indexOf(0)];
			// A single mark is worth little, a threat (two in a line with the third free) much more
			if (o === 0) local += [0, 1, 5][x] ?? 0;
			if (x === 0) local -= [0, 1, 5][o] ?? 0;
		}
		if (!status && v.every(Boolean)) status = 3;
		STATUS[key] = status;
		// The centre cell and the corners are worth holding
		for (let c = 0; c < 9; c++) {
			const weight = c === 4 ? 1.5 : c % 2 === 0 ? 0.7 : 0;
			if (v[c] === 1) local += weight;
			else if (v[c] === 2) local -= weight;
		}
		LOCAL[key] = local;
	}
}

const BOARD_WEIGHT = [1.2, 1, 1.2, 1, 1.5, 1, 1.2, 1, 1.2];
const BOARD_WIN = 30;
const LINE_SCORE = [0, 8, 60]; // by how many boards of the line one side holds, if the other side has none there
const THREAT_SENT = 12; // the player to move can win the board they've been sent to
const FREE_CHOICE = 8; // the player to move may play anywhere

// Building the tables takes a few milliseconds, so the page does it up front rather than on the first move
export function warmUp() {
	if (!STATUS) buildTables();
}

function fromGame(game) {
	warmUp();
	const pos = {
		cells: new Int8Array(81),
		keys: new Int32Array(9),
		boards: new Int8Array(9),
		turn: game.turn === 'X' ? 1 : 2,
		forced: game.forced ?? -1,
		over: 0,
	};
	game.cells.forEach((mark, i) => {
		const v = mark === 'X' ? 1 : mark === 'O' ? 2 : 0;
		pos.cells[i] = v;
		pos.keys[Math.floor(i / 9)] += v * POW[i % 9];
	});
	for (let b = 0; b < 9; b++) pos.boards[b] = STATUS[pos.keys[b]];
	pos.over = overOf(pos.boards);
	return pos;
}

// 0 while going, 1 or 2 for a winner, 3 for a draw
function overOf(boards) {
	for (const [a, b, c] of LINES) {
		if (boards[a] && boards[a] < 3 && boards[a] === boards[b] && boards[a] === boards[c]) return boards[a];
	}
	for (const [a, b, c] of LINES) {
		for (const p of [1, 2]) {
			if ([a, b, c].every((i) => boards[i] === 0 || boards[i] === p)) return 0;
		}
	}
	return 3;
}

// Plays a cell for the side to move. Returns what undo needs to take it back.
function make(pos, index) {
	const b = Math.floor(index / 9);
	const c = index - b * 9;
	const p = pos.turn;
	const undo = pos.forced + 1 + (pos.boards[b] << 4) + (pos.over << 6);
	pos.cells[index] = p;
	pos.keys[b] += p * POW[c];
	const status = STATUS[pos.keys[b]];
	if (status) {
		pos.boards[b] = status;
		pos.over = overOf(pos.boards);
	}
	pos.forced = pos.boards[c] === 0 ? c : -1;
	pos.turn = 3 - p;
	return undo;
}

function unmake(pos, index, undo) {
	const b = Math.floor(index / 9);
	const c = index - b * 9;
	const p = 3 - pos.turn;
	pos.cells[index] = 0;
	pos.keys[b] -= p * POW[c];
	pos.boards[b] = (undo >> 4) & 3;
	pos.over = undo >> 6;
	pos.forced = (undo & 15) - 1;
	pos.turn = p;
}

function generate(pos) {
	const moves = [];
	for (let b = 0; b < 9; b++) {
		if (pos.boards[b] || (pos.forced >= 0 && pos.forced !== b)) continue;
		for (let c = 0; c < 9; c++) if (!pos.cells[b * 9 + c]) moves.push(b * 9 + c);
	}
	return moves;
}

// Scores the position for X
function evaluate(pos) {
	const { boards, keys } = pos;
	let score = 0;
	for (let b = 0; b < 9; b++) {
		if (boards[b] === 1) score += BOARD_WIN * BOARD_WEIGHT[b];
		else if (boards[b] === 2) score -= BOARD_WIN * BOARD_WEIGHT[b];
		else if (boards[b] === 0) score += LOCAL[keys[b]] * BOARD_WEIGHT[b] * 0.5;
	}
	for (const line of LINES) {
		let x = 0;
		let o = 0;
		let blocked = false;
		for (const i of line) {
			if (boards[i] === 1) x++;
			else if (boards[i] === 2) o++;
			else if (boards[i] === 3) blocked = true;
		}
		if (blocked) continue;
		if (o === 0) score += LINE_SCORE[x] ?? 0;
		else if (x === 0) score -= LINE_SCORE[o] ?? 0;
	}
	// Whoever has just been sent somewhere good gains, and so does whoever is let off the leash
	const sign = pos.turn === 1 ? 1 : -1;
	if (pos.forced < 0) score += sign * FREE_CHOICE;
	else if (WINS[pos.turn][keys[pos.forced]]) score += sign * THREAT_SENT;
	return score;
}

// Best-first ordering makes alpha-beta cut far more: small-board wins, then blocks, then moves that don't
// hand the opponent a board they can win or a free choice.
function ordered(pos, moves, first) {
	const me = pos.turn;
	const scores = moves.map((index) => {
		const b = Math.floor(index / 9);
		const c = index - b * 9;
		let s = c === 4 ? 2 : c % 2 === 0 ? 1 : 0;
		if ((WINS[me][pos.keys[b]] >> c) & 1) s += 50;
		else if ((WINS[3 - me][pos.keys[b]] >> c) & 1) s += 20;
		if (pos.boards[c] || (c === b && STATUS[pos.keys[b] + me * POW[c]])) s -= 6;
		else if (WINS[3 - me][pos.keys[c]]) s -= 15;
		return index === first ? s + 1000 : s;
	});
	return moves.map((index, i) => [index, scores[i]]).sort((a, b) => b[1] - a[1]).map(([index]) => index);
}

const ABORT = Symbol('out of time');

// Negamax with alpha-beta, scored for the side to move. Quicker wins score higher.
function search(pos, depth, alpha, beta, ply, clock) {
	if (pos.over) return pos.over === 3 ? 0 : -(MATE - ply);
	if (depth === 0) return (pos.turn === 1 ? 1 : -1) * evaluate(pos);
	if (clock && ++clock.nodes % 512 === 0 && (clock.nodes > clock.maxNodes || clock.now() > clock.deadline)) throw ABORT;

	let best = -INFINITY;
	for (const index of ordered(pos, generate(pos))) {
		const undo = make(pos, index);
		const score = -search(pos, depth - 1, -beta, -alpha, ply + 1, clock);
		unmake(pos, index, undo);
		if (score > best) best = score;
		if (score > alpha) alpha = score;
		if (alpha >= beta) break;
	}
	return best;
}

// Every root move within `tolerance` of the best, with its score, searched `depth` plies deep.
// Moves outside the window are only bounded, not scored exactly, which is fine: they aren't candidates.
function searchRoot(pos, moves, depth, tolerance, clock) {
	let best = -INFINITY;
	const scored = [];
	for (const index of moves) {
		const undo = make(pos, index);
		const floor = best === -INFINITY ? -INFINITY : best - tolerance - 1;
		const score = -search(pos, depth - 1, -INFINITY, -floor, 1, clock);
		unmake(pos, index, undo);
		if (score <= floor) continue;
		scored.push([index, score]);
		best = Math.max(best, score);
	}
	return scored.filter(([, score]) => score >= best - tolerance);
}

const pick = (options, random) => options[Math.floor(random() * options.length)];

// Whether `index` would win its small board for the player to move
const winsBoard = (game, index) => {
	const board = Math.floor(index / 9);
	const cells = game.cells.slice(board * 9, board * 9 + 9);
	cells[index % 9] = game.turn;
	return getResult(cells)?.player === game.turn;
};

const MEDIUM_DEPTH = 3;
// The node cap is a safety net for when the clock can't be trusted (it's frozen under fake timers in tests)
const HARD = { maxDepth: 12, budgetMs: 120, maxNodes: 3e5 };

// easy: random legal moves, but takes a small-board win half the time it can.
// medium: a fixed three-move look-ahead, picking at random between near-equal moves so it varies.
// hard: iterative deepening within a time budget, so a move stays well under the AI's thinking pause on slow
//   devices too. Always finishes at least the first couple of plies.
// `options` can override the hard limits ({ budgetMs, maxDepth, maxNodes, now }), mainly for tests.
export function chooseMove(game, difficulty = 'hard', random = Math.random, options = {}) {
	const legal = legalMoves(game);
	if (legal.length === 0) return null;

	if (difficulty === 'easy') {
		const wins = legal.filter((index) => winsBoard(game, index));
		return pick(wins.length && random() < 0.5 ? wins : legal, random);
	}

	const pos = fromGame(game);
	if (difficulty === 'medium') {
		return pick(searchRoot(pos, ordered(pos, legal), MEDIUM_DEPTH, 3, null), random)[0];
	}

	const { maxDepth = HARD.maxDepth, budgetMs = HARD.budgetMs, maxNodes = HARD.maxNodes, now = () => performance.now() } = options;
	const clock = { nodes: 0, maxNodes, now, deadline: now() + budgetMs };
	let moves = ordered(pos, legal);
	let best = moves.slice(0, 1).map((index) => [index, 0]);
	for (let depth = 1; depth <= maxDepth; depth++) {
		// Depths 1 and 2 are cheap and make sure there's always a sensible answer
		const timed = depth > 2 ? clock : null;
		let found;
		try {
			found = searchRoot(pos, moves, depth, 0, timed);
		} catch (error) {
			if (error !== ABORT) throw error;
			break;
		}
		best = found;
		// Winning (or losing) outright won't change with more depth
		if (Math.abs(found[0][1]) > MATE / 2) break;
		// Search the last depth's favourite first: it makes the next depth much faster
		moves = ordered(pos, legal, found[0][0]);
	}
	return pick(best, random)[0];
}

const SUMMARY = { X: '❌', O: '⭕', D: '➖', '': '⬜' };

// The small-board winners as a 3×3 grid of emoji, for sharing
export const summarize = (boards) =>
	[0, 3, 6].map((row) => boards.slice(row, row + 3).map((b) => SUMMARY[b]).join('')).join('\n');
