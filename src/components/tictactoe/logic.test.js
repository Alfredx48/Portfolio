import { describe, expect, it } from 'vitest';
import {
	cellsFromMoves,
	chooseMove,
	emptyCells,
	evaluateMoves,
	getOutcome,
	getResult,
	isDeadDraw,
	LINES,
	linesFor,
	movesFromEvents,
	nextPlayer,
	other,
	perfectMoves,
	sizeOf,
	winLengthFor,
} from './logic';

const board = (s) => s.replace(/\s/g, '').split('').map((c) => (c === '.' ? '' : c));

describe('line generation', () => {
	it('keeps the classic 3×3 lines, in order', () => {
		expect(LINES).toEqual([
			[0, 1, 2], [3, 4, 5], [6, 7, 8],
			[0, 3, 6], [1, 4, 7], [2, 5, 8],
			[0, 4, 8], [2, 4, 6],
		]);
		expect(linesFor()).toBe(LINES);
	});

	it('needs four in a row on the bigger boards', () => {
		expect(winLengthFor(3)).toBe(3);
		expect(winLengthFor(4)).toBe(4);
		expect(winLengthFor(5)).toBe(4);
	});

	it('finds every line on 4×4 and 5×5', () => {
		// 4×4: 4 rows + 4 columns + 2 diagonals. 5×5: 2 windows per row/column + 2×2 per diagonal direction
		expect(linesFor(4)).toHaveLength(10);
		expect(linesFor(5)).toHaveLength(10 + 10 + 4 + 4);
		for (const size of [4, 5]) {
			for (const line of linesFor(size)) expect(line).toHaveLength(4);
		}
	});

	it('only makes straight lines that stay on the board', () => {
		for (const size of [3, 4, 5]) {
			for (const line of linesFor(size)) {
				const steps = line.slice(1).map((i, k) => i - line[k]);
				// right, down, down-right or down-left
				expect([1, size, size + 1, size - 1]).toContain(steps[0]);
				expect(new Set(steps).size).toBe(1);
				// A step of one must not wrap onto the next row, and diagonals must not wrap either
				const cols = line.map((i) => i % size);
				for (let k = 1; k < cols.length; k++) expect(Math.abs(cols[k] - cols[k - 1])).toBeLessThanOrEqual(1);
				expect(new Set(line).size).toBe(line.length);
			}
		}
	});

	it('lists a line from its first cell to its last', () => {
		expect(linesFor(5)).toContainEqual([1, 7, 13, 19]); // down-right
		expect(linesFor(5)).toContainEqual([8, 12, 16, 20]); // down-left
		expect(linesFor(4)).toContainEqual([3, 6, 9, 12]);
	});

	it('works out the size from the board', () => {
		expect(sizeOf(Array(9))).toBe(3);
		expect(sizeOf(Array(16))).toBe(4);
		expect(sizeOf(Array(25))).toBe(5);
	});
});

describe('wins on bigger boards', () => {
	it('needs four in a row, not three', () => {
		expect(getResult(board('XXX. .... .... ....'))).toBeNull();
		expect(getResult(board('XXXX ..OO O... ....'))).toEqual({ player: 'X', line: [0, 1, 2, 3] });
	});

	it('finds columns and both diagonals on 4×4', () => {
		expect(getResult(board('O... O... O... O...'))?.line).toEqual([0, 4, 8, 12]);
		expect(getResult(board('X... .X.. ..X. ...X'))?.line).toEqual([0, 5, 10, 15]);
		expect(getResult(board('...O ..O. .O.. O...'))?.line).toEqual([3, 6, 9, 12]);
	});

	it('finds a four that starts partway along a 5×5 row, column or diagonal', () => {
		expect(getResult(board('..... .XXXX ..... ..... .....'))?.line).toEqual([6, 7, 8, 9]);
		expect(getResult(board('..... ....O ....O ....O ....O'))?.line).toEqual([9, 14, 19, 24]);
		expect(getResult(board('..... .X... ..X.. ...X. ....X'))?.line).toEqual([6, 12, 18, 24]);
		expect(getResult(board('..... ...X. ..X.. .X... X....'))?.line).toEqual([8, 12, 16, 20]);
	});

	it('does not wrap a row onto the next one', () => {
		// X X at the end of one row and X X at the start of the next is not a line
		expect(getResult(board('..XX XX.. .... ....'))).toBeNull();
	});

	it('draws on a full board with no line', () => {
		const cells = board('XXOO OOXX XXOO OOXX');
		expect(getResult(cells)).toEqual({ player: null, line: [] });
	});
});

describe('early draws on bigger boards', () => {
	// X X O O / O O X X / X X O O / O O X .  Every line holds both marks
	it('calls a draw once every line holds both marks', () => {
		const cells = board('XXOO OOXX XXOO OOX.');
		expect(isDeadDraw(cells)).toBe(true);
		expect(getOutcome(cells)).toEqual({ player: null, line: [], early: true });
	});

	it('keeps playing while any line is still open for someone', () => {
		expect(isDeadDraw(board('.... .... .... ....'))).toBe(false);
		expect(isDeadDraw(board('XXOO OOXX XXOO O...'))).toBe(false); // the bottom row is open for O
		expect(isDeadDraw(Array(25).fill(''))).toBe(false);
	});

	it('is never a draw once someone has won', () => {
		expect(getOutcome(board('XXXX OO.. .... ....'))?.player).toBe('X');
	});

	it('is fast enough to run on every move', () => {
		const start = performance.now();
		for (let i = 0; i < 200; i++) isDeadDraw(Array(25).fill(''));
		expect(performance.now() - start).toBeLessThan(500);
	});
});

describe('evaluateMoves', () => {
	it('finds the winning cell and rates the rest', () => {
		// X to move with the top row nearly done: 2 wins at once
		const values = evaluateMoves(board('XX. OO. ...'));
		expect(values[2]).toBe('win');
		expect(values[0]).toBeNull();
		expect(values[4]).toBeNull();
		expect(values.filter((v) => v === 'win').length).toBeGreaterThanOrEqual(1);
	});

	it('shows the only move that avoids losing as a draw', () => {
		// O to move, X threatens the top row: blocking at 2 holds, anything else loses
		const values = evaluateMoves(board('XX. .O. ...'), 'O');
		expect(values[2]).toBe('draw');
		for (const i of [3, 5, 6, 7, 8]) expect(values[i]).toBe('loss');
	});

	it('rates every opening move on an empty board as a draw', () => {
		expect(evaluateMoves(board('.........'))).toEqual(Array(9).fill('draw'));
	});

	it('rates moves from the point of view of the player given', () => {
		// The counts say X to move, but pass O: O can finish the middle row
		const values = evaluateMoves(board('XX. OO. X..'), 'O');
		expect(values[5]).toBe('win');
	});

	it('marks every move as a loss when the opponent has a fork', () => {
		// X X . / X O . / . . .  O to move: X threatens the row (cell 2) and the column (cell 6).
		// Blocking one lets X take the other, so O can only lose, unless it wins first (it can't).
		const values = evaluateMoves(board('XX. XO. ...'), 'O');
		expect(values[2]).toBe('loss');
		expect(values[6]).toBe('loss');
		expect(values.filter((v) => v === 'win')).toHaveLength(0);
	});

	it('has nothing to say about a finished game or a bigger board', () => {
		expect(evaluateMoves(board('XXXOO....')).every((v) => v === null)).toBe(true);
		expect(evaluateMoves(Array(16).fill('')).every((v) => v === null)).toBe(true);
	});
});

describe('open threes on 5×5', () => {
	// A three with both ends free can't be stopped, so Hard has to see it coming a move earlier
	it('blocks the move that would make an open three', () => {
		// Hard as X; O has 16 and 17 on row 3 (cells 15-19). O at 18 would leave 15 and 19 both winning.
		const cells = board('..... ..... ..X.. .OO.. ..X..');
		expect(chooseMove(cells, 'impossible', () => 0, 'X')).toBe(18);
	});

	it('does the same for the anti-diagonal', () => {
		// O has 12 and 16. At 8 it would hold 8-12-16 with both 4 and 20 completing, so X has to take 8.
		const cells = board('..... ..... ..O.. .O... .....');
		cells[0] = 'X';
		cells[24] = 'X';
		expect(chooseMove(cells, 'impossible', () => 0, 'X')).toBe(8);
	});

	it('makes its own open three when it can', () => {
		// X has 6 and 7. At 8 it would hold 6-7-8 with both 5 and 9 completing, which wins by force.
		const cells = board('..... .XX.. ..... ..... .....');
		cells[20] = 'O';
		cells[24] = 'O';
		expect(chooseMove(cells, 'impossible', () => 0, 'X')).toBe(8);
	});

	it('never loses to Medium over many games', () => {
		let losses = 0;
		for (let game = 0; game < 12; game++) {
			const hardIsX = game % 2 === 0;
			const cells = Array(25).fill('');
			let mark = 'X';
			let result;
			while (!(result = getResult(cells))) {
				const hard = (mark === 'X') === hardIsX;
				cells[chooseMove(cells, hard ? 'impossible' : 'medium', Math.random, mark)] = mark;
				mark = other(mark);
			}
			if (result.player && (result.player === 'X') !== hardIsX) losses++;
		}
		expect(losses).toBe(0);
	});

	it('keeps each move quick', () => {
		const cells = Array(25).fill('');
		let mark = 'X';
		let slowest = 0;
		while (!getResult(cells)) {
			const start = performance.now();
			cells[chooseMove(cells, 'impossible', Math.random, mark)] = mark;
			slowest = Math.max(slowest, performance.now() - start);
			mark = other(mark);
		}
		expect(slowest).toBeLessThan(250);
	});
});

describe('the 3×3 search', () => {
	it('solves an empty board quickly', () => {
		const start = performance.now();
		perfectMoves(Array(9).fill(''), 'X');
		expect(performance.now() - start).toBeLessThan(500);
	});
});

describe('game history', () => {
	const place = (index, mark) => ({ type: 'place', index, mark });

	it('puts marks on the board in order', () => {
		expect(movesFromEvents([place(4, 'X'), place(0, 'O')])).toEqual([
			{ index: 4, mark: 'X' },
			{ index: 0, mark: 'O' },
		]);
	});

	it('removes the oldest mark on a clear', () => {
		const events = [place(4, 'X'), place(0, 'O'), place(8, 'X'), { type: 'clear' }];
		expect(movesFromEvents(events)).toEqual([
			{ index: 0, mark: 'O' },
			{ index: 8, mark: 'X' },
		]);
	});

	it('draws the marks on a board of any size', () => {
		const cells = cellsFromMoves([{ index: 24, mark: 'O' }], 5);
		expect(cells).toHaveLength(25);
		expect(cells[24]).toBe('O');
		expect(cellsFromMoves([])).toEqual(Array(9).fill(''));
	});
});

describe('the AI on bigger boards', () => {
	const sizes = [4, 5];

	it('only ever picks a free cell', () => {
		for (const size of sizes) {
			const cells = Array(size * size).fill('');
			cells[0] = 'X';
			cells[size + 1] = 'O';
			for (const level of ['easy', 'medium', 'impossible']) {
				for (let i = 0; i < 10; i++) expect(emptyCells(cells)).toContain(chooseMove(cells, level, Math.random, 'X'));
			}
		}
	});

	it('returns null when the game is over', () => {
		expect(chooseMove(board('XXXX OO.. .... ....'))).toBeNull();
	});

	it('takes a winning move on 5×5 on medium and impossible', () => {
		// O has three in the second row, X has two in the top row
		const cells = board('XX... .OOO. X.... ..... .....');
		for (const level of ['medium', 'impossible']) {
			expect([5, 9]).toContain(chooseMove(cells, level, Math.random, 'O'));
		}
		// X to move wins on the spot too: a column of three
		const column = board('X.... XO... X.O.. ..... .....');
		for (const level of ['medium', 'impossible']) expect(chooseMove(column, level, Math.random, 'X')).toBe(15);
	});

	it('blocks a line of three on 5×5 on medium and impossible', () => {
		// X has three in a column, the cell below is the only way to stop the fourth
		const cells = board('X.... X.O.. X.... ..... ..O..');
		// Above X is the board edge, so the only completion is cell 15
		for (const level of ['medium', 'impossible']) expect(chooseMove(cells, level, Math.random, 'O')).toBe(15);
	});

	it('blocks on 4×4 too', () => {
		const cells = board('XXX. .O.. ..O. ....');
		for (const level of ['medium', 'impossible']) expect(chooseMove(cells, level, Math.random, 'O')).toBe(3);
	});

	it('prefers its own win to blocking', () => {
		const cells = board('XXX. OOO. .... ....');
		expect(chooseMove(cells, 'impossible', Math.random, 'O')).toBe(7);
	});

	it('breaks up an open two on 5×5 before it can become a double threat', () => {
		// X X in the middle of a five-wide row: the cell at the end that both fours need is the key defence
		const cells = board('..... .XX.. ..... ..O.. .....');
		expect(chooseMove(cells, 'impossible', Math.random, 'O')).toBe(8);
	});

	it('plays the centre first on an empty board, on impossible', () => {
		const cells = Array(25).fill('');
		expect(chooseMove(cells, 'impossible', () => 0, 'X')).toBe(12);
	});

	it('is quick enough to play in the browser on 5×5', () => {
		const cells = Array(25).fill('');
		let me = 'X';
		let slowest = 0;
		// Plays itself out for a while, timing every move
		for (let n = 0; n < 12 && !getResult(cells); n++) {
			const start = performance.now();
			const move = chooseMove(cells, 'impossible', Math.random, me);
			slowest = Math.max(slowest, performance.now() - start);
			cells[move] = me;
			me = other(me);
		}
		// The brief allows ~150ms in the browser; this is generous for slow CI machines
		expect(slowest).toBeLessThan(400);
	});

	it('beats random play, so difficulty means something', () => {
		let losses = 0;
		for (let game = 0; game < 10; game++) {
			const cells = Array(25).fill('');
			let mark = 'X';
			let result;
			while (!(result = getResult(cells))) {
				const move = mark === 'O' ? chooseMove(cells, 'impossible', Math.random, 'O') : chooseMove(cells, 'easy', Math.random, 'X');
				cells[move] = mark;
				mark = other(mark);
			}
			if (result.player === 'X') losses++;
		}
		expect(losses).toBe(0);
	});

	it('knows whose turn it is on a bigger board', () => {
		expect(nextPlayer(Array(16).fill(''))).toBe('X');
	});
});
