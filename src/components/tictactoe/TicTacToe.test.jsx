import { fireEvent, render, screen } from '@solidjs/testing-library';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chooseMove, emptyCells, getOutcome, getResult, isDeadDraw, LINES, nextPlayer, other } from './logic';
import TicTacToe from './TicTacToe';

const board = (s) => s.split('').map((c) => (c === '.' ? '' : c));

describe('getResult', () => {
	it('finds a win on any line', () => {
		expect(getResult(board('XXXOO....'))).toEqual({ player: 'X', line: [0, 1, 2] });
		expect(getResult(board('OX.OX.O..'))).toEqual({ player: 'O', line: [0, 3, 6] });
		expect(getResult(board('.OXOX.X..'))).toEqual({ player: 'X', line: [2, 4, 6] });
	});

	it('detects a draw', () => {
		expect(getResult(board('XOXXOOOXX'))).toEqual({ player: null, line: [] });
	});

	it('prefers a win on the last move over a draw', () => {
		expect(getResult(board('XOXOXOOXX'))?.player).toBe('X');
	});

	it('returns null while the game is in progress', () => {
		expect(getResult(board('X...O....'))).toBeNull();
	});
});

describe('early draws', () => {
	it('calls a draw when every line is blocked', () => {
		// X O X / X O O / O X .  (X to move, the last cell can't complete anything)
		expect(isDeadDraw(board('XOXXOOOX.'))).toBe(true);
	});

	it('calls a draw when the only open line needs more moves than its owner gets', () => {
		// X X O / O O X / X . .  (O to move; X needs both bottom cells but only gets one)
		expect(isDeadDraw(board('XXOOOXX..'))).toBe(true);
	});

	it('keeps playing while a win is still possible', () => {
		expect(isDeadDraw(board('.........'))).toBe(false);
		expect(isDeadDraw(board('XX.OO....'))).toBe(false);
		// X O . / X X O / O . .  (X to move): X can still complete the diagonal
		expect(isDeadDraw(board('XO.XXOO..'))).toBe(false);
	});

	it('flags early draws in getOutcome, but not full-board draws or wins', () => {
		expect(getOutcome(board('XXOOOXX..'))).toEqual({ player: null, line: [], early: true });
		expect(getOutcome(board('XOXXOOOXX'))).toEqual({ player: null, line: [] });
		expect(getOutcome(board('XXXOO....'))).toEqual({ player: 'X', line: [0, 1, 2] });
	});

	it('never calls a draw while the player to move can win on the spot, in any reachable position', () => {
		const seen = new Set();
		let earlyDraws = 0;
		const visit = (cells) => {
			const key = cells.join(',');
			if (seen.has(key) || getResult(cells)) return;
			seen.add(key);
			if (isDeadDraw(cells)) {
				earlyDraws++;
				const me = nextPlayer(cells);
				const canWinNow = LINES.some((line) => {
					const marks = line.map((i) => cells[i]);
					return marks.filter((m) => m === me).length === 2 && marks.includes('');
				});
				expect(canWinNow).toBe(false);
			}
			for (const i of emptyCells(cells)) visit(cells.map((c, j) => (j === i ? nextPlayer(cells) : c)));
		};
		visit(Array(9).fill(''));
		// Sanity check that the search actually finds early draws
		expect(earlyDraws).toBeGreaterThan(0);
	});
});

describe('nextPlayer', () => {
	it('alternates starting with X', () => {
		expect(nextPlayer(board('.........'))).toBe('X');
		expect(nextPlayer(board('X........'))).toBe('O');
		expect(nextPlayer(board('XO.......'))).toBe('X');
	});
});

describe('chooseMove', () => {
	it('only ever picks a free cell', () => {
		const cells = board('XO.XO.O.X');
		for (const level of ['easy', 'medium', 'impossible']) {
			for (let i = 0; i < 20; i++) expect(emptyCells(cells)).toContain(chooseMove(cells, level));
		}
	});

	it('returns null when the game is over', () => {
		expect(chooseMove(board('XXXOO....'))).toBeNull();
	});

	it('takes a winning move on medium and impossible', () => {
		// X to move, and X can finish the top row
		const cells = board('XX.OO....');
		expect(chooseMove(cells, 'medium')).toBe(2);
		expect(chooseMove(cells, 'impossible')).toBe(2);
	});

	it('blocks the opponent on medium', () => {
		// O to move; X threatens the top row
		expect(chooseMove(board('XX..O....'), 'medium')).toBe(2);
	});

	// Plays every possible game against the AI, branching on every human reply,
	// and checks the human never wins a single one.
	function assertNeverLoses(aiMark, random) {
		let games = 0;
		const explore = (cells) => {
			const result = getResult(cells);
			if (result) {
				games++;
				expect(result.player).not.toBe(other(aiMark));
				return;
			}
			if (nextPlayer(cells) === aiMark) {
				const move = chooseMove(cells, 'impossible', random);
				explore(cells.map((c, i) => (i === move ? aiMark : c)));
			} else {
				for (const i of emptyCells(cells)) explore(cells.map((c, j) => (j === i ? other(aiMark) : c)));
			}
		};
		explore(Array(9).fill(''));
		return games;
	}

	it('never loses on impossible, whichever side it plays', () => {
		for (const random of [() => 0, () => 0.999]) {
			expect(assertNeverLoses('X', random)).toBeGreaterThan(0);
			expect(assertNeverLoses('O', random)).toBeGreaterThan(0);
		}
	});
});

describe('TicTacToe', () => {
	beforeEach(() => localStorage.clear());
	afterEach(() => vi.useRealTimers());

	const cell = (row, col) => screen.getByRole('button', { name: new RegExp(`^Row ${row}, column ${col}:`) });

	describe('two players', () => {
		beforeEach(() => {
			render(() => <TicTacToe />);
			fireEvent.click(screen.getByRole('radio', { name: '2 Players' }));
		});

		it('plays a game to a win, locks the board and scores it', () => {
			// X takes the top row while O plays the middle row
			for (const [r, c] of [[1, 1], [2, 1], [1, 2], [2, 2], [1, 3]]) fireEvent.click(cell(r, c));

			expect(screen.getByText(/wins!/)).toHaveTextContent('X wins!');
			expect(cell(2, 3)).toBeDisabled();
			expect(screen.getByLabelText('Score')).toHaveTextContent(/X\s*1\s*Draws\s*0\s*O\s*0/);
		});

		it('ends the game as soon as nobody can win', () => {
			// Leaves X X O / O O X / X . . with O to move
			const all = () => screen.getAllByRole('button', { name: /^Row/ });
			for (const i of [0, 4, 1, 2, 6, 3, 5]) fireEvent.click(all()[i]);

			expect(screen.getByText(/Nobody can win/)).toBeInTheDocument();
			expect(all()[7]).toBeDisabled();
			expect(all()[8]).toBeDisabled();
			expect(screen.getByLabelText('Score')).toHaveTextContent(/Draws\s*1/);
		});

		it('ignores clicks on a taken cell', () => {
			fireEvent.click(cell(1, 1));
			fireEvent.click(cell(1, 1));
			expect(cell(1, 1)).toHaveTextContent('X');
			expect(screen.getByText(/Turn:/)).toHaveTextContent('Turn: O');
		});

		it('starts over', () => {
			fireEvent.click(cell(1, 1));
			fireEvent.click(screen.getByRole('button', { name: 'Restart' }));
			expect(cell(1, 1)).toHaveTextContent('');
		});
	});

	describe('against the AI', () => {
		it('answers your move after a short pause', () => {
			vi.useFakeTimers();
			render(() => <TicTacToe />);
			fireEvent.click(cell(2, 2));
			expect(screen.getByText(/AI is thinking/)).toBeInTheDocument();

			vi.advanceTimersByTime(1000);
			const marks = screen.getAllByRole('button', { name: /^Row/ }).map((b) => b.textContent);
			expect(marks.filter((m) => m === 'O')).toHaveLength(1);
			expect(screen.getByText(/Your turn/)).toBeInTheDocument();
		});

		it('moves first when you play O', () => {
			vi.useFakeTimers();
			render(() => <TicTacToe />);
			fireEvent.click(screen.getByRole('radio', { name: 'Play O' }));
			vi.advanceTimersByTime(1000);
			const marks = screen.getAllByRole('button', { name: /^Row/ }).map((b) => b.textContent);
			expect(marks.filter((m) => m === 'X')).toHaveLength(1);
		});

		it('remembers your settings', () => {
			const first = render(() => <TicTacToe />);
			fireEvent.click(screen.getByRole('radio', { name: 'Impossible' }));
			first.unmount();

			render(() => <TicTacToe />);
			expect(screen.getByRole('radio', { name: 'Impossible' })).toHaveAttribute('aria-checked', 'true');
		});
	});
});
