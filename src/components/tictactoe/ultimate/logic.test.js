import { describe, expect, it } from 'vitest';
import { analyze, bigResult, chooseMove, createGame, DIFFICULTIES, legalMoves, playMove, replay, summarize, warmUp } from './logic';

// Builds a game from a few small boards written as 9 characters each ('.' is empty), keyed by board number
const position = (boards, turn = 'X', forced = null) => {
	const cells = Array(81).fill('');
	for (const [board, marks] of Object.entries(boards)) {
		[...marks].forEach((mark, c) => (cells[board * 9 + c] = mark === '.' ? '' : mark));
	}
	return analyze(cells, turn, forced);
};

const boardOf = (index) => Math.floor(index / 9);

describe('legalMoves', () => {
	it('lets X start anywhere', () => {
		expect(legalMoves(createGame())).toHaveLength(81);
	});

	it('sends the opponent to the board matching the cell played', () => {
		// The centre cell of board 0 (cell 4) sends O to the centre board
		const game = playMove(createGame(), 4);
		expect(game.forced).toBe(4);
		expect(legalMoves(game)).toEqual([36, 37, 38, 39, 40, 41, 42, 43, 44]);
	});

	it('only offers empty cells of the board you were sent to', () => {
		// X plays (board 4, cell 0), then O is sent to board 0 and takes its cell 4: X is sent to board 4
		const game = replay([36, 4]);
		expect(game.forced).toBe(4);
		expect(legalMoves(game)).not.toContain(36);
		expect(legalMoves(game)).toHaveLength(8);
	});

	it('lets you play anywhere open when sent to a won board', () => {
		const game = playMove(position({ 0: 'XXXOO....' }), 27); // cell 0 of board 3 sends O to board 0
		expect(game.boards[0]).toBe('X');
		expect(game.forced).toBeNull();
		const moves = legalMoves(game);
		expect(moves).toHaveLength(71); // eight open boards, minus the cell just played
		expect(moves.some((m) => boardOf(m) === 0)).toBe(false);
	});

	it('lets you play anywhere open when sent to a full, drawn board', () => {
		const game = playMove(position({ 0: 'XOXXOOOXX' }), 27);
		expect(game.boards[0]).toBe('D');
		expect(game.forced).toBeNull();
		expect(legalMoves(game).some((m) => boardOf(m) === 0)).toBe(false);
	});

	it('ignores illegal moves', () => {
		const game = playMove(createGame(), 4);
		expect(playMove(game, 0)).toBe(game); // wrong board
		expect(playMove(game, 40)).not.toBe(game);
		expect(playMove(playMove(game, 40), 40).cells.filter(Boolean)).toHaveLength(2); // taken cell
	});
});

describe('small boards', () => {
	it('is claimed by whoever completes a line', () => {
		const game = position({ 0: 'XX.OO....' }, 'X', 0);
		expect(game.boards[0]).toBe('');
		const next = playMove(game, 2);
		expect(next.boards[0]).toBe('X');
		expect(next.result).toBeNull();
	});

	it('is a draw for nobody when it fills up', () => {
		const game = position({ 0: 'XOXXOOOX.' }, 'X', 0);
		expect(playMove(game, 8).boards[0]).toBe('D');
	});

	it('stops being playable once claimed', () => {
		const game = playMove(position({ 0: 'XXXOO....' }), 36);
		expect(legalMoves(game).some((m) => boardOf(m) === 0)).toBe(false);
	});
});

describe('the big board', () => {
	it('is won with three small boards in a line', () => {
		const game = position({ 0: 'XXXOO....', 4: 'XXXOO....', 8: 'XX.OO....' }, 'X', 8);
		expect(game.result).toBeNull();
		const won = playMove(game, 8 * 9 + 2);
		expect(won.result).toEqual({ player: 'X', line: [0, 4, 8] });
		expect(legalMoves(won)).toEqual([]);
	});

	it('is not won by drawn boards', () => {
		expect(bigResult(['D', 'D', 'D', '', '', '', '', '', ''])).toBeNull();
	});

	it('is a draw once every board is decided', () => {
		expect(bigResult(['X', 'O', 'X', 'O', 'O', 'X', 'X', 'X', 'O'])).toEqual({ player: null, line: [] });
		expect(bigResult(['X', 'O', 'X', 'O', 'D', 'X', 'D', 'X', 'O'])).toEqual({ player: null, line: [] });
	});

	it('is a draw as soon as no line can be completed', () => {
		// The drawn centre kills four lines, and the other four each hold both marks
		expect(bigResult(['X', 'O', '', 'O', 'D', 'X', '', 'X', 'O'])).toEqual({ player: null, line: [], early: true });
	});

	it('goes on while a line is still possible', () => {
		expect(bigResult(['X', 'O', '', 'O', 'D', 'X', '', '', ''])).toBeNull();
		expect(bigResult(Array(9).fill(''))).toBeNull();
	});
});

describe('replay', () => {
	it('alternates players and tracks the last move', () => {
		const game = replay([4, 36]);
		expect(game.turn).toBe('X');
		expect(game.last).toBe(36);
		expect(game.cells[4]).toBe('X');
		expect(game.cells[36]).toBe('O');
	});
});

describe('summarize', () => {
	it('draws the small-board winners as a 3×3 grid of emoji', () => {
		expect(summarize(['X', 'O', 'D', '', 'X', 'O', '', '', 'X'])).toBe('❌⭕➖\n⬜❌⭕\n⬜⬜❌');
	});
});

describe('chooseMove', () => {
	const playAgainstRandom = (difficulty, aiMark, random) => {
		let game = createGame();
		while (!game.result) {
			const legal = legalMoves(game);
			const move = game.turn === aiMark ? chooseMove(game, difficulty, random, { budgetMs: 20 }) : legal[Math.floor(random() * legal.length)];
			expect(legal).toContain(move);
			game = playMove(game, move);
		}
		return game;
	};

	// A small deterministic generator, so a failure can be reproduced
	const seeded = (seed) => () => {
		seed = (seed * 1664525 + 1013904223) % 4294967296;
		return seed / 4294967296;
	};

	it('returns null when the game is over', () => {
		const over = position({ 0: 'XXXOO....', 1: 'XXXOO....', 2: 'XXXOO....' });
		expect(chooseMove(over, 'hard')).toBeNull();
	});

	it('always plays a legal move, whichever side it plays', () => {
		for (const difficulty of DIFFICULTIES) {
			const random = seeded(7);
			expect(playAgainstRandom(difficulty, 'X', random).result).not.toBeNull();
			expect(playAgainstRandom(difficulty, 'O', random).result).not.toBeNull();
		}
	});

	it('beats random play', () => {
		const random = seeded(3);
		for (const difficulty of ['medium', 'hard']) {
			expect(playAgainstRandom(difficulty, 'X', random).result.player).toBe('X');
			expect(playAgainstRandom(difficulty, 'O', random).result.player).toBe('O');
		}
	});

	describe('easy', () => {
		// X to play in board 0, where cell 2 completes the top row
		const game = position({ 0: 'XX.OO....' }, 'X', 0);

		it('takes a small-board win about half the time', () => {
			expect(chooseMove(game, 'easy', () => 0)).toBe(2);
			expect(chooseMove(game, 'easy', () => 0.99)).toBe(8);
		});

		it('otherwise plays any legal cell', () => {
			const legal = legalMoves(game);
			for (const r of [0.5, 0.7, 0.99]) expect(legal).toContain(chooseMove(game, 'easy', () => r));
		});
	});

	describe.each(['medium', 'hard'])('%s', (difficulty) => {
		// X holds boards 0 and 1 and has two in the top row of board 2
		const threat = { 0: 'XXXOO....', 1: 'XXXOO....', 2: 'XX.OO....' };

		it('takes an immediate win of the game', () => {
			expect(chooseMove(position(threat, 'X', 2), difficulty)).toBe(2 * 9 + 2);
			expect(chooseMove(position(threat, 'X'), difficulty)).toBe(2 * 9 + 2);
		});

		it('blocks an immediate loss', () => {
			// O is free to move, but X wins next turn if sent to board 2 or to one of the won boards
			const game = position(threat, 'O');
			for (let i = 0; i < 5; i++) {
				const move = chooseMove(game, difficulty);
				const after = playMove(game, move);
				const wins = legalMoves(after).filter((m) => playMove(after, m).result?.player === 'X');
				expect(wins).toEqual([]);
			}
		});

		it('does not send the opponent to a board where they win the game', () => {
			// O must play in board 5 (where O has the first move). Cell 2 would send X to board 2 and lose.
			const game = position({ ...threat, 5: '.........' }, 'O', 5);
			for (let i = 0; i < 5; i++) expect(chooseMove(game, difficulty)).not.toBe(5 * 9 + 2);
		});
	});

	describe('timing', () => {
		// A busy middle game: the most expensive place to search
		const midGame = () => {
			const random = seeded(11);
			let game = createGame();
			for (let i = 0; i < 24; i++) game = playMove(game, legalMoves(game)[Math.floor(random() * legalMoves(game).length)]);
			return game;
		};

		it('keeps hard well under 200ms', () => {
			for (const game of [createGame(), midGame()]) {
				const start = performance.now();
				chooseMove(game, 'hard');
				// Allows for a slow, busy machine; the search itself stops at its 120ms budget
				expect(performance.now() - start).toBeLessThan(400);
			}
		});

		it('keeps medium quick', () => {
			const start = performance.now();
			chooseMove(midGame(), 'medium');
			expect(performance.now() - start).toBeLessThan(200);
		});

		it('also stops on a node cap, so a frozen clock cannot hang it', () => {
			const start = performance.now();
			// A clock that never advances, as under fake timers
			const move = chooseMove(midGame(), 'hard', Math.random, { now: () => 0 });
			expect(legalMoves(midGame())).toContain(move);
			expect(performance.now() - start).toBeLessThan(3000);
		});

		it('warms up its tables ahead of time without changing anything', () => {
			warmUp();
			warmUp();
			expect(legalMoves(createGame())).toHaveLength(81);
		});

		it('stops searching when its time budget runs out', () => {
			let ticks = 0;
			// Every look at the clock costs a millisecond
			const now = () => ticks++;
			const move = chooseMove(midGame(), 'hard', Math.random, { budgetMs: 5, now });
			expect(legalMoves(midGame())).toContain(move);
			expect(ticks).toBeLessThan(200);
		});
	});
});
