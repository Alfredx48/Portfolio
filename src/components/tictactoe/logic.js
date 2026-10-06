export const LINES = [
	[0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
	[0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
	[0, 4, 8], [2, 4, 6], // diagonals
];

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
	for (const line of LINES) {
		const [a, b, c] = line;
		if (cells[a] && cells[a] === cells[b] && cells[a] === cells[c]) {
			return { player: cells[a], line };
		}
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

// True when the game hasn't ended but nobody can win however it's played out,
// e.g. every line is blocked, or the only open line needs more moves than its owner gets.
// `toMove` only needs passing when marks have been cleared (endless mode), so the counts no longer tell.
export function isDeadDraw(cells, toMove = nextPlayer(cells)) {
	return !getResult(cells) && !winStillPossible([...cells], toMove);
}

// getResult plus early draws: { player: null, line: [], early: true } once a win is impossible.
// (Minimax keeps using getResult; running this search at every node would be wasted work.)
export function getOutcome(cells, toMove = nextPlayer(cells)) {
	return getResult(cells) ?? (isDeadDraw(cells, toMove) ? { player: null, line: [], early: true } : null);
}

// The cell that would complete a line for `player`, if there is one.
function completingMove(cells, player) {
	for (const line of LINES) {
		const marks = line.map((i) => cells[i]);
		if (marks.filter((m) => m === player).length === 2 && marks.includes('')) {
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

const pick = (options, random) => options[Math.floor(random() * options.length)];

export const DIFFICULTIES = ['easy', 'medium', 'impossible'];

// easy: any free cell.
// medium: wins when it can and blocks your wins, but otherwise plays loosely,
//   so it can be beaten with a fork.
// impossible: perfect play, picking randomly between equally good moves.
// `me` defaults to whoever's turn the mark counts say it is.
export function chooseMove(cells, difficulty = 'impossible', random = Math.random, me = nextPlayer(cells)) {
	const free = emptyCells(cells);
	if (free.length === 0 || getResult(cells)) return null;

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
