export const SIZES = [3, 4, 5];

// 3×3 needs three in a row; the bigger boards need four, or 5×5 would be too easy to block and 4×4 too easy to win
export const winLengthFor = (size) => (size <= 3 ? 3 : 4);

// Boards are flat arrays, so the size follows from the length
export const sizeOf = (cells) => Math.round(Math.sqrt(cells.length));

const lineCache = new Map();

// Every line of `win` cells on a size×size board, each listed from its first cell to its last:
// rows, then columns, then the two diagonal directions.
export function linesFor(size = 3, win = winLengthFor(size)) {
	const key = `${size}:${win}`;
	if (!lineCache.has(key)) {
		const lines = [];
		for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
			for (let r = 0; r < size; r++) {
				for (let c = 0; c < size; c++) {
					const endR = r + dr * (win - 1);
					const endC = c + dc * (win - 1);
					if (endR >= size || endC < 0 || endC >= size) continue;
					lines.push(Array.from({ length: win }, (_, k) => (r + dr * k) * size + c + dc * k));
				}
			}
		}
		lineCache.set(key, lines);
	}
	return lineCache.get(key);
}

export const LINES = linesFor(3, 3);

// The 3×3 search calls this at every node, so skip the cache lookup for the common size
const linesOf = (cells) => (cells.length === 9 ? LINES : linesFor(sizeOf(cells)));

export const other = (player) => (player === 'X' ? 'O' : 'X');

// X always moves first, so the turn follows from how many cells are filled.
export function nextPlayer(cells) {
	return cells.filter(Boolean).length % 2 === 0 ? 'X' : 'O';
}

export function emptyCells(cells) {
	return cells.flatMap((cell, i) => (cell ? [] : [i]));
}

// Returns { player, line } for a win, { player: null, line: [] } for a draw,
// or null while the game is still going.
export function getResult(cells) {
	for (const line of linesOf(cells)) {
		const first = cells[line[0]];
		if (!first) continue;
		let k = 1;
		while (k < line.length && cells[line[k]] === first) k++;
		if (k === line.length) return { player: first, line };
	}
	return cells.every(Boolean) ? { player: null, line: [] } : null;
}

// Whether any sequence of legal moves from here, with `player` to move, ends in a win for either side.
// Mutates `cells` while searching but always restores it.
function winStillPossible(cells, player) {
	for (const i of emptyCells(cells)) {
		cells[i] = player;
		const result = getResult(cells);
		const possible = result ? Boolean(result.player) : winStillPossible(cells, other(player));
		cells[i] = '';
		if (possible) return true;
	}
	return false;
}

// The exhaustive search above is exponential, so bigger boards use a cheaper test instead:
// a draw is certain once every line holds both marks. It misses some dead positions
// (an open line that can't be finished in time), which just means those games play on.
function everyLineBlocked(cells) {
	return linesOf(cells).every((line) => line.some((i) => cells[i] === 'X') && line.some((i) => cells[i] === 'O'));
}

// True when the game hasn't ended but nobody can win however it's played out,
// e.g. every line is blocked, or the only open line needs more moves than its owner gets.
// `toMove` only needs passing when marks have been cleared (endless mode), so the counts no longer tell.
export function isDeadDraw(cells, toMove = nextPlayer(cells)) {
	if (getResult(cells)) return false;
	return cells.length === 9 ? !winStillPossible([...cells], toMove) : everyLineBlocked(cells);
}

// getResult plus early draws: { player: null, line: [], early: true } once a win is impossible.
// (Minimax keeps using getResult; running this search at every node would be wasted work.)
export function getOutcome(cells, toMove = nextPlayer(cells)) {
	return getResult(cells) ?? (isDeadDraw(cells, toMove) ? { player: null, line: [], early: true } : null);
}

// The cell that would complete a line for `player`, if there is one.
function completingMove(cells, player) {
	for (const line of linesOf(cells)) {
		const marks = line.map((i) => cells[i]);
		if (marks.filter((m) => m === player).length === line.length - 1 && marks.includes('')) {
			return line[marks.indexOf('')];
		}
	}
	return null;
}

// Minimax with alpha-beta pruning, scored from `me`'s point of view.
// Quicker wins score higher and slower losses score less badly, so the AI
// finishes games instead of toying with you, and drags out the ones it can't win.
function minimax(cells, me, toMove, depth, alpha, beta) {
	const result = getResult(cells);
	if (result) {
		if (!result.player) return 0;
		return result.player === me ? 10 - depth : depth - 10;
	}

	const maximizing = toMove === me;
	let best = maximizing ? -Infinity : Infinity;
	for (const i of emptyCells(cells)) {
		cells[i] = toMove;
		const score = minimax(cells, me, other(toMove), depth + 1, alpha, beta);
		cells[i] = '';
		if (maximizing) {
			best = Math.max(best, score);
			alpha = Math.max(alpha, score);
		} else {
			best = Math.min(best, score);
			beta = Math.min(beta, score);
		}
		if (beta <= alpha) break;
	}
	return best;
}

// Every move that minimax rates as best for `me`, the player whose turn it is.
export function perfectMoves(cells, me = nextPlayer(cells)) {
	const board = [...cells];
	let bestScore = -Infinity;
	let best = [];
	for (const i of emptyCells(board)) {
		board[i] = me;
		const score = minimax(board, me, other(me), 1, -Infinity, Infinity);
		board[i] = '';
		if (score > bestScore) {
			bestScore = score;
			best = [i];
		} else if (score === bestScore) {
			best.push(i);
		}
	}
	return best;
}

// What perfect play leads to if `me` (the player to move) takes each empty cell: 'win', 'draw' or 'loss'
// for `me`, and null for taken cells. Only 3×3 boards can be solved exactly, so others get all nulls.
// It always assumes standard rules, so in endless mode it describes the current board as if it were classic.
export function evaluateMoves(cells, me = nextPlayer(cells)) {
	const values = Array(cells.length).fill(null);
	if (cells.length !== 9 || getResult(cells)) return values;
	const board = [...cells];
	for (const i of emptyCells(board)) {
		board[i] = me;
		const score = minimax(board, me, other(me), 1, -Infinity, Infinity);
		board[i] = '';
		values[i] = score > 0 ? 'win' : score < 0 ? 'loss' : 'draw';
	}
	return values;
}

const pick = (options, random) => options[Math.floor(random() * options.length)];

export const DIFFICULTIES = ['easy', 'medium', 'impossible'];

// easy: any free cell.
// medium: wins when it can and blocks your wins, but otherwise plays loosely,
//   so it can be beaten with a fork.
// impossible: perfect play, picking randomly between equally good moves.
//   (On boards bigger than 3×3 it can't search everything, so it's a deep heuristic search instead.)
// `me` defaults to whoever's turn the mark counts say it is.
export function chooseMove(cells, difficulty = 'impossible', random = Math.random, me = nextPlayer(cells)) {
	const free = emptyCells(cells);
	if (free.length === 0 || getResult(cells)) return null;

	if (cells.length > 9) return chooseLargeMove(cells, difficulty, random, me);

	if (difficulty === 'easy') return pick(free, random);

	if (difficulty === 'medium') {
		const win = completingMove(cells, me);
		if (win !== null) return win;
		const block = completingMove(cells, other(me));
		if (block !== null) return block;
		return random() < 0.35 ? pick(perfectMoves(cells, me), random) : pick(free, random);
	}

	return pick(perfectMoves(cells, me), random);
}

// ---------- Bigger boards ----------
// Full minimax is far too slow here, so the AI wins and blocks on the spot, then runs an
// alpha-beta search a few moves deep and judges the position by how many marks each open line holds.

const WIN_SCORE = 100000;
// Heuristic value of a line holding 0, 1, 2, 3... marks of one colour and none of the other
const LINE_VALUE = [0, 1, 8, 64, 1000];
const NODE_BUDGET = 12000; // keeps a move to a few tens of milliseconds, whatever the board
const MAX_DEPTH = 8;
const SEARCH_WIDTH = 10; // candidate moves tried per node, best-ordered first

const geometryCache = new Map();

// Per-size lookup tables: lines through each cell, each cell's neighbours, and how central it is
function geometryFor(size) {
	if (!geometryCache.has(size)) {
		const lines = linesFor(size);
		const through = Array.from({ length: size * size }, () => []);
		for (const line of lines) for (const i of line) through[i].push(line);
		const neighbours = through.map((_, i) => {
			const r = Math.floor(i / size);
			const c = i % size;
			const near = [];
			for (let dr = -1; dr <= 1; dr++) {
				for (let dc = -1; dc <= 1; dc++) {
					const nr = r + dr;
					const nc = c + dc;
					if ((dr || dc) && nr >= 0 && nr < size && nc >= 0 && nc < size) near.push(nr * size + nc);
				}
			}
			return near;
		});
		const centre = through.map((_, i) => size - (Math.abs(2 * Math.floor(i / size) - (size - 1)) + Math.abs(2 * (i % size) - (size - 1))) / 2);
		geometryCache.set(size, { lines, through, neighbours, centre });
	}
	return geometryCache.get(size);
}

// How good the position is for `me`, who is about to move: open lines they're building minus open lines
// the opponent is. A line one mark short of winning is a threat, and what matters is how many different
// cells would finish one: me having any wins on the spot, while the opponent having two (an "open three")
// can't be stopped, so both score close to a win rather than as ordinary line counts.
function evaluate(cells, me, lines) {
	let total = 0;
	let theirFinish = -1;
	for (const line of lines) {
		let mine = 0;
		let theirs = 0;
		let gap = -1;
		for (const i of line) {
			if (cells[i] === me) mine++;
			else if (cells[i]) theirs++;
			else gap = i;
		}
		if (mine && !theirs) {
			if (mine === line.length - 1) return WIN_SCORE - 100;
			total += LINE_VALUE[mine];
		} else if (theirs && !mine) {
			if (theirs === line.length - 1) {
				if (theirFinish >= 0 && theirFinish !== gap) return 100 - WIN_SCORE;
				theirFinish = gap;
			}
			total -= LINE_VALUE[theirs];
		}
	}
	return total;
}

// How much taking this cell helps `me` or hurts the opponent: the value of the lines it builds or breaks
function cellValue(cells, i, me, geometry) {
	let total = geometry.centre[i] * 0.1;
	for (const line of geometry.through[i]) {
		let mine = 0;
		let theirs = 0;
		for (const j of line) {
			if (cells[j] === me) mine++;
			else if (cells[j]) theirs++;
		}
		if (!theirs) total += LINE_VALUE[mine + 1];
		if (!mine) total += LINE_VALUE[theirs + 1];
	}
	return total;
}

// Free cells next to existing marks (any free cell on an empty board), most useful for `me` first.
// Near the leaves the cheap measure (how crowded the cell is, how central) is good enough and much faster.
function nearbyMoves(cells, geometry, me, precise) {
	const free = [];
	for (let i = 0; i < cells.length; i++) {
		if (cells[i]) continue;
		let touching = 0;
		for (const n of geometry.neighbours[i]) if (cells[n]) touching++;
		free.push({ i, touching });
	}
	const touched = free.filter((move) => move.touching);
	return (touched.length ? touched : free)
		.map((move) => ({
			i: move.i,
			score: precise ? cellValue(cells, move.i, me, geometry) : move.touching * 2 + geometry.centre[move.i],
		}))
		.sort((a, b) => b.score - a.score)
		.map((move) => move.i);
}

// The cells where `player` would end up with two different ways to finish a line, which can't both be blocked
export function forkMoves(cells, player, geometry = geometryFor(sizeOf(cells))) {
	const forks = [];
	for (let i = 0; i < cells.length; i++) {
		if (cells[i]) continue;
		cells[i] = player;
		const finishers = new Set();
		for (const line of geometry.through[i]) {
			let mine = 0;
			let gap = -1;
			for (const j of line) {
				if (cells[j] === player) mine++;
				else if (cells[j]) {
					mine = -1;
					break;
				} else gap = j;
			}
			if (mine === line.length - 1) finishers.add(gap);
		}
		cells[i] = '';
		if (finishers.size >= 2) forks.push(i);
	}
	return forks;
}

class OutOfBudget extends Error {}

function negamax(search, cells, toMove, depth, alpha, beta, ply) {
	if (++search.nodes > NODE_BUDGET) throw new OutOfBudget();
	if (depth === 0) return evaluate(cells, toMove, search.geometry.lines);
	const moves = nearbyMoves(cells, search.geometry, toMove, depth > 1).slice(0, SEARCH_WIDTH);
	if (!moves.length) return 0; // board full
	let best = -Infinity;
	for (const i of moves) {
		cells[i] = toMove;
		const won = search.geometry.through[i].some((line) => line.every((j) => cells[j] === toMove));
		const score = won ? WIN_SCORE - ply : -negamax(search, cells, other(toMove), depth - 1, -beta, -alpha, ply + 1);
		cells[i] = '';
		if (score > best) best = score;
		if (best > alpha) alpha = best;
		if (alpha >= beta) break;
	}
	return best;
}

// Iterative deepening: each pass searches a move deeper until the node budget runs out,
// and the last pass that finished decides. `random` only breaks ties between the first moves tried.
// `only` limits the first move to those cells.
function searchMove(cells, me, random, only) {
	const geometry = geometryFor(sizeOf(cells));
	const board = [...cells];
	const search = { geometry, nodes: 0 };
	const roots = (only ?? emptyCells(board))
		.map((i) => [i, cellValue(board, i, me, geometry) + random() * 2])
		.sort((a, b) => b[1] - a[1])
		.slice(0, SEARCH_WIDTH + 4)
		.map(([i]) => i);
	let best = roots[0];
	try {
		for (let depth = 1; depth <= MAX_DEPTH; depth++) {
			let bestScore = -Infinity;
			let bestMove = roots[0];
			for (const i of roots) {
				board[i] = me;
				const won = geometry.through[i].some((line) => line.every((j) => board[j] === me));
				const score = won ? WIN_SCORE : -negamax(search, board, other(me), depth - 1, -Infinity, -bestScore, 1);
				board[i] = '';
				if (score > bestScore) {
					bestScore = score;
					bestMove = i;
				}
			}
			best = bestMove;
			// Try the best move first next time, which prunes far more
			roots.splice(roots.indexOf(best), 1);
			roots.unshift(best);
			if (Math.abs(bestScore) >= WIN_SCORE - MAX_DEPTH) break; // the result is forced, deeper won't change it
		}
	} catch (error) {
		if (!(error instanceof OutOfBudget)) throw error;
	}
	return best;
}

// The cells that would leave `player` with two different forks, which no single move can stop
function doubleForkMoves(cells, player, geometry) {
	const doubles = [];
	for (let i = 0; i < cells.length; i++) {
		if (cells[i]) continue;
		cells[i] = player;
		if (forkMoves(cells, player, geometry).length >= 2) doubles.push(i);
		cells[i] = '';
	}
	return doubles;
}

function chooseLargeMove(cells, difficulty, random, me) {
	const free = emptyCells(cells);
	if (difficulty === 'easy') return pick(free, random);

	const win = completingMove(cells, me);
	if (win !== null) return win;
	const block = completingMove(cells, other(me));
	if (block !== null) return block;

	if (difficulty === 'medium') {
		// Plays a sensible-looking move half the time and a random one near the action otherwise,
		// and never looks ahead, so it falls for any double threat
		const geometry = geometryFor(sizeOf(cells));
		if (random() < 0.5) {
			const values = free.map((i) => cellValue(cells, i, me, geometry));
			const top = Math.max(...values);
			return pick(free.filter((_, k) => values[k] === top), random);
		}
		return pick(nearbyMoves(cells, geometry), random);
	}

	// Hard also looks for threats the search is too shallow to be sure about. A move that leaves two ways
	// to finish a line wins by force, so take it, and stop the opponent's before it exists. The same goes
	// one step earlier: a move that creates two such forks can't be answered, since each needs its own block.
	const geometry = geometryFor(sizeOf(cells));
	const board = [...cells];
	const myForks = forkMoves(board, me, geometry);
	if (myForks.length) return pick(myForks, random);
	const theirForks = forkMoves(board, other(me), geometry);
	if (theirForks.length === 1) return theirForks[0];
	if (theirForks.length) return searchMove(cells, me, random, theirForks);
	const myDoubles = doubleForkMoves(board, me, geometry);
	if (myDoubles.length) return pick(myDoubles, random);
	const theirDoubles = doubleForkMoves(board, other(me), geometry);
	if (theirDoubles.length === 1) return theirDoubles[0];
	if (theirDoubles.length) return searchMove(cells, me, random, theirDoubles);
	return searchMove(cells, me, random);
}

// ---------- Game history ----------
// A game is a list of events: { type: 'place', index, mark } and, in endless mode, { type: 'clear' },
// which removes the oldest mark. Keeping the clears is what lets undo and replay put cleared marks back.

// The marks on the board, oldest first
export function movesFromEvents(events) {
	const moves = [];
	for (const event of events) {
		if (event.type === 'place') moves.push({ index: event.index, mark: event.mark });
		else if (event.type === 'clear') moves.shift();
		else if (event.type === 'orbit') {
			const n = event.size, ring = [];
			for (let c = 0; c < n; c++) ring.push(c);
			for (let r = 1; r < n; r++) ring.push(r * n + n - 1);
			for (let c = n - 2; c >= 0; c--) ring.push((n - 1) * n + c);
			for (let r = n - 2; r > 0; r--) ring.push(r * n);
			for (const move of moves) { const at = ring.indexOf(move.index); if (at >= 0) move.index = ring[(at + 1) % ring.length]; }
		}
	}
	return moves;
}

export function cellsFromMoves(moves, size = 3) {
	const cells = Array(size * size).fill('');
	for (const { index, mark } of moves) cells[index] = mark;
	return cells;
}
