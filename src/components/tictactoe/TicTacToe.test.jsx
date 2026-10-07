import { MemoryRouter } from '@solidjs/router';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { unlock } from '../../state/achievements';
import { shareResult } from '../../utils/share';
import { playSound } from '../../utils/sound';
import { chooseMove, emptyCells, getOutcome, getResult, isDeadDraw, LINES, nextPlayer, other } from './logic';
import TicTacToe from './TicTacToe';

// The AI can be scripted in the component tests that need a particular game
const ai = vi.hoisted(() => ({ script: null }));

vi.mock('./logic', async (importOriginal) => {
	const actual = await importOriginal();
	return { ...actual, chooseMove: vi.fn((...args) => (ai.script ? ai.script(...args) : actual.chooseMove(...args))) };
});
vi.mock('../../state/achievements', () => ({ unlock: vi.fn() }));
vi.mock('../../utils/share', () => ({ shareResult: vi.fn() }));
vi.mock('../../utils/sound', async (importOriginal) => ({ ...(await importOriginal()), playSound: vi.fn() }));

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

	it('takes the player to move into account when the counts can’t tell', () => {
		// X O X / O O X / O X .  The counts say X to move, and X would win in the corner,
		// but in endless mode it can be O's turn, and then nobody can win.
		expect(isDeadDraw(board('XOXOOXOX.'))).toBe(false);
		expect(isDeadDraw(board('XOXOOXOX.'), 'O')).toBe(true);
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

	it('plays for the side it is told to', () => {
		// The counts say X to move, but it's O's turn: O should finish the middle row, not the top one
		const cells = board('XX.OO.X.O');
		expect(chooseMove(cells, 'medium', Math.random, 'O')).toBe(5);
		expect(chooseMove(cells, 'impossible', Math.random, 'O')).toBe(5);
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
	// The page links to its sibling games, so it needs a router around it
	const renderGame = () => render(() => <MemoryRouter root={TicTacToe} />);

	beforeEach(() => {
		localStorage.clear();
		vi.clearAllMocks();
	});
	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
		ai.script = null;
	});

	const cell = (row, col) => screen.getByRole('button', { name: new RegExp(`^Row ${row}, column ${col}:`) });

	describe('two players', () => {
		beforeEach(() => {
			renderGame();
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

		it('clears the oldest mark instead of drawing in endless mode', () => {
			vi.useFakeTimers();
			fireEvent.click(screen.getByRole('radio', { name: 'Endless' }));
			// Leaves X X O / O O X / X . . with O to move, which classic rules call a draw
			const all = () => screen.getAllByRole('button', { name: /^Row/ });
			for (const i of [0, 4, 1, 2, 6, 3, 5]) fireEvent.click(all()[i]);

			// No announcement: the oldest mark just fades while the status carries on as normal
			expect(screen.getByText(/Turn:/)).toHaveTextContent('Turn: O');
			expect(all()[0]).toHaveClass('vanishing');
			expect(all()[8]).toBeDisabled();
			// The board isn't hatched like a finished draw
			expect(screen.getByRole('group', { name: 'Game board' })).not.toHaveClass('dead-draw');

			vi.advanceTimersByTime(1000);
			// X's first mark is gone, and it's still O's turn
			expect(all()[0]).toHaveTextContent('');
			expect(screen.getByText(/Turn:/)).toHaveTextContent('Turn: O');
			expect(screen.getByLabelText('Score')).toHaveTextContent(/Cleared\s*1/);

			// O threatens the diagonal through the cleared cell; X plays elsewhere and O completes it
			fireEvent.click(all()[0]);
			fireEvent.click(all()[7]);
			fireEvent.click(all()[8]);
			expect(screen.getByText(/wins!/)).toHaveTextContent('O wins!');
			expect(screen.getByLabelText('Score')).toHaveTextContent(/X\s*0\s*Cleared\s*1\s*O\s*1/);
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
			renderGame();
			fireEvent.click(cell(2, 2));
			expect(screen.getByText(/AI is thinking/)).toBeInTheDocument();

			vi.advanceTimersByTime(1000);
			const marks = screen.getAllByRole('button', { name: /^Row/ }).map((b) => b.textContent);
			expect(marks.filter((m) => m === 'O')).toHaveLength(1);
			expect(screen.getByText(/Your turn/)).toBeInTheDocument();
		});

		it('moves first when you play O', () => {
			vi.useFakeTimers();
			renderGame();
			fireEvent.click(screen.getByRole('radio', { name: 'Play O' }));
			vi.advanceTimersByTime(1000);
			const marks = screen.getAllByRole('button', { name: /^Row/ }).map((b) => b.textContent);
			expect(marks.filter((m) => m === 'X')).toHaveLength(1);
		});

		it('remembers your settings', () => {
			const first = renderGame();
			fireEvent.click(screen.getByRole('radio', { name: 'Impossible' }));
			first.unmount();

			renderGame();
			expect(screen.getByRole('radio', { name: 'Impossible' })).toHaveAttribute('aria-checked', 'true');
		});
	});

	const all = () => screen.getAllByRole('button', { name: /^Row/ });
	const click = (...indices) => indices.forEach((i) => fireEvent.click(all()[i]));
	const choose = (name) => fireEvent.click(screen.getByRole('radio', { name }));
	const status = () => document.querySelector('.ttt-status');
	const scoreboard = () => screen.getByLabelText('Score');
	const startPvp = () => {
		renderGame();
		choose('2 Players');
	};
	// X takes the top row while O plays the middle row
	const xWinsTopRow = () => click(0, 3, 1, 4, 2);

	describe('hints', () => {
		beforeEach(startPvp);
		const hintsButton = () => screen.getByRole('button', { name: 'Hints' });

		it('is off until you ask for it', () => {
			expect(hintsButton()).toHaveAttribute('aria-pressed', 'false');
			expect(cell(1, 1)).toHaveAttribute('aria-label', 'Row 1, column 1: empty');
		});

		it('tints empty cells and says what they lead to', () => {
			fireEvent.click(hintsButton());
			expect(hintsButton()).toHaveAttribute('aria-pressed', 'true');
			// Perfect play draws from an empty board whatever X does first
			expect(cell(2, 2)).toHaveAttribute('aria-label', 'Row 2, column 2: empty, leads to a draw');
			expect(cell(2, 2)).toHaveClass('hint-draw');

			// X X . / . O . with O to move: only blocking at the end of the row holds
			click(0, 4, 1);
			expect(cell(1, 3)).toHaveAttribute('aria-label', 'Row 1, column 3: empty, leads to a draw');
			expect(cell(3, 3)).toHaveAttribute('aria-label', 'Row 3, column 3: empty, leads to a loss');
			expect(cell(3, 3)).toHaveClass('hint-loss');
			// Taken cells say nothing extra
			expect(cell(1, 1)).toHaveAttribute('aria-label', 'Row 1, column 1: X');
		});

		it('shows a winning move from the mover’s point of view', () => {
			fireEvent.click(hintsButton());
			// X X . / O O . with X to move
			click(0, 3, 1, 4);
			expect(cell(1, 3)).toHaveAttribute('aria-label', 'Row 1, column 3: empty, leads to a win');
			expect(cell(1, 3)).toHaveClass('hint-win');
		});

		it('hides the hints again when switched off', () => {
			fireEvent.click(hintsButton());
			fireEvent.click(hintsButton());
			expect(cell(2, 2)).not.toHaveClass('hint-draw');
			expect(cell(2, 2)).toHaveAttribute('aria-label', 'Row 2, column 2: empty');
		});

		it('goes away when the game ends', () => {
			fireEvent.click(hintsButton());
			xWinsTopRow();
			expect(document.querySelector('[class*="hint-"]')).toBeNull();
			// and the button makes way for Replay and Share
			expect(screen.queryByRole('button', { name: 'Hints' })).not.toBeInTheDocument();
		});

		it('only works on 3×3', () => {
			choose('4×4');
			expect(hintsButton()).toBeDisabled();
			fireEvent.click(hintsButton());
			expect(document.querySelector('[class*="hint-"]')).toBeNull();
		});

		it('switches off when the board size changes, rather than staying on unseen', () => {
			fireEvent.click(hintsButton());
			choose('4×4');
			choose('3×3');
			expect(hintsButton()).toHaveAttribute('aria-pressed', 'false');
			expect(cell(1, 1)).toHaveAttribute('aria-label', 'Row 1, column 1: empty');
		});

		it('marks losing moves with a glyph that isn’t an X', () => {
			fireEvent.click(hintsButton());
			click(0, 4, 1);
			// The glyph lives in CSS, so check the class it hangs off and that the board has no stray marks
			expect(cell(3, 3)).toHaveClass('hint-loss');
			expect(cell(3, 3)).toHaveTextContent('');
		});

		it('leaves out draws in endless mode, where there is no such thing', () => {
			choose('Endless');
			fireEvent.click(hintsButton());
			click(0, 4, 1);
			// Still a block that holds the position, but it's no promise of a draw
			expect(cell(1, 3)).not.toHaveClass('hint-draw');
			expect(cell(1, 3)).toHaveAttribute('aria-label', 'Row 1, column 3: empty');
			expect(cell(3, 3)).toHaveClass('hint-loss');
		});
	});

	describe('hints against the AI', () => {
		it('waits for your turn', () => {
			vi.useFakeTimers();
			renderGame();
			fireEvent.click(screen.getByRole('button', { name: 'Hints' }));
			expect(cell(1, 1)).toHaveAttribute('aria-label', expect.stringContaining('leads to'));

			fireEvent.click(cell(2, 2));
			// The AI is thinking, so nothing is on offer
			expect(screen.getByText(/AI is thinking/)).toBeInTheDocument();
			expect(document.querySelector('[class*="hint-"]')).toBeNull();

			vi.advanceTimersByTime(1000);
			expect(screen.getByText(/Your turn/)).toBeInTheDocument();
			expect(document.querySelector('[class*="hint-"]')).not.toBeNull();
		});
	});

	describe('undo', () => {
		it('is disabled until there is something to take back', () => {
			startPvp();
			expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
			click(4);
			expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
		});

		it('takes back one move with a friend', () => {
			startPvp();
			click(0, 4);
			fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
			expect(cell(2, 2)).toHaveTextContent('');
			expect(cell(1, 1)).toHaveTextContent('X');
			expect(screen.getByText(/Turn:/)).toHaveTextContent('Turn: O');
			fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
			expect(screen.getByText(/Turn:/)).toHaveTextContent('Turn: X');
			expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
		});

		it('is off once the game is over, and leaves the scores alone', () => {
			startPvp();
			xWinsTopRow();
			expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
			expect(scoreboard()).toHaveTextContent(/X\s*1\s*Draws\s*0\s*O\s*0/);
		});

		it('takes back your move and the AI’s reply against the AI', () => {
			vi.useFakeTimers();
			renderGame();
			click(4);
			vi.advanceTimersByTime(1000);
			expect(all().filter((b) => b.textContent === 'O')).toHaveLength(1);

			fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
			expect(all().every((b) => b.textContent === '')).toBe(true);
			expect(screen.getByText(/Your turn/)).toBeInTheDocument();
			expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();

			// The AI doesn't get a stray move in afterwards
			vi.advanceTimersByTime(2000);
			expect(all().every((b) => b.textContent === '')).toBe(true);
		});

		it('takes back your move while the AI is still thinking', () => {
			vi.useFakeTimers();
			renderGame();
			click(4);
			fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
			vi.advanceTimersByTime(2000);
			expect(all().every((b) => b.textContent === '')).toBe(true);
			expect(screen.getByText(/Your turn/)).toBeInTheDocument();
		});

		it('leaves the AI’s opening move when you play O', () => {
			vi.useFakeTimers();
			renderGame();
			choose('Play O');
			vi.advanceTimersByTime(1000);
			expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
			const opening = all().findIndex((b) => b.textContent === 'X');

			const free = all().findIndex((b) => !b.textContent);
			click(free);
			vi.advanceTimersByTime(1000);
			fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
			expect(all().map((b) => b.textContent).filter(Boolean)).toEqual(['X']);
			expect(all()[opening]).toHaveTextContent('X');
			expect(status()).toHaveTextContent("Your turn (O)");
		});

		it('puts a cleared mark back in endless mode', () => {
			vi.useFakeTimers();
			startPvp();
			choose('Endless');
			// Leaves X X O / O O X / X . . with O to move, which fades out the oldest mark
			click(0, 4, 1, 2, 6, 3);
			expect(all()[0]).toHaveTextContent('X');
			click(5);
			vi.advanceTimersByTime(1000);
			expect(all()[0]).toHaveTextContent('');
			expect(scoreboard()).toHaveTextContent(/Cleared\s*1/);

			fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
			// The last move is gone and so is the clear: the first X is back and it's X's turn again
			expect(all()[5]).toHaveTextContent('');
			expect(all()[0]).toHaveTextContent('X');
			expect(all().filter((b) => b.textContent)).toHaveLength(6);
			expect(screen.getByText(/Turn:/)).toHaveTextContent('Turn: X');
			expect(scoreboard()).toHaveTextContent(/Cleared\s*0/);

			// Nothing clears again by itself, and the game carries on as normal
			vi.advanceTimersByTime(2000);
			expect(all()[0]).toHaveTextContent('X');
			click(5);
			vi.advanceTimersByTime(1000);
			expect(all()[0]).toHaveTextContent('');
		});

		it('can take back several moves, across several clears', () => {
			vi.useFakeTimers();
			startPvp();
			choose('Endless');
			click(0, 4, 1, 2, 6, 3, 5);
			vi.advanceTimersByTime(1000);
			// Further moves in the cleared game, then undo them one by one
			click(0);
			const afterClear = all().map((b) => b.textContent);
			click(7);
			fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
			expect(all().map((b) => b.textContent)).toEqual(afterClear);
			fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
			fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
			expect(all()[0]).toHaveTextContent('X');
			expect(all()[5]).toHaveTextContent('');
		});
	});

	describe('replay', () => {
		const marks = () => all().map((b) => b.textContent);
		const replayButton = () => screen.getByRole('button', { name: 'Replay' });
		const step = () => screen.getByText(/^Step \d+ \/ \d+$/).textContent;
		const noStep = () => expect(screen.queryByText(/^Step \d+ \/ \d+$/)).not.toBeInTheDocument();

		it('is only offered once the game is over', () => {
			startPvp();
			click(0);
			expect(screen.queryByRole('button', { name: 'Replay' })).not.toBeInTheDocument();
			expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument();
		});

		it('plays the game back move by move from an empty board', () => {
			vi.useFakeTimers();
			startPvp();
			xWinsTopRow();
			fireEvent.click(replayButton());

			expect(marks().every((m) => !m)).toBe(true);
			expect(step()).toBe('Step 0 / 5');
			expect(screen.getByText('Replaying the game')).toBeInTheDocument();

			vi.advanceTimersByTime(500);
			expect(step()).toBe('Step 1 / 5');
			expect(marks().filter(Boolean)).toEqual(['X']);
			vi.advanceTimersByTime(1000);
			expect(step()).toBe('Step 3 / 5');
			expect(marks().filter(Boolean)).toEqual(['X', 'X', 'O']);

			// After the last move it holds for a beat, then shows the finished game again
			vi.advanceTimersByTime(1000);
			expect(step()).toBe('Step 5 / 5');
			vi.advanceTimersByTime(500);
			noStep();
			expect(screen.getByText(/wins!/)).toHaveTextContent('X wins!');
			expect(marks().filter(Boolean)).toHaveLength(5);
			expect(replayButton()).toBeInTheDocument();
		});

		it('is read-only and leaves the scores alone', () => {
			vi.useFakeTimers();
			startPvp();
			xWinsTopRow();
			fireEvent.click(replayButton());
			vi.advanceTimersByTime(500);

			for (const b of all()) expect(b).toBeDisabled();
			click(8);
			expect(marks()[8]).toBe('');
			vi.advanceTimersByTime(10000);
			expect(scoreboard()).toHaveTextContent(/X\s*1\s*Draws\s*0\s*O\s*0/);
			expect(JSON.parse(localStorage.getItem('alfred-portfolio:ttt-scores')).pvp.a).toBe(1);
		});

		it('can be paused and skipped to the end', () => {
			vi.useFakeTimers();
			startPvp();
			xWinsTopRow();
			fireEvent.click(replayButton());
			vi.advanceTimersByTime(1000);
			fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
			vi.advanceTimersByTime(5000);
			expect(step()).toBe('Step 2 / 5');
			fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
			vi.advanceTimersByTime(500);
			expect(step()).toBe('Step 3 / 5');

			fireEvent.click(screen.getByRole('button', { name: 'Skip to end' }));
			noStep();
			expect(marks().filter(Boolean)).toHaveLength(5);
			expect(screen.getByText(/wins!/)).toBeInTheDocument();
			// The replay doesn't carry on in the background
			vi.advanceTimersByTime(5000);
			noStep();
		});

		it('stops when a new game starts', () => {
			vi.useFakeTimers();
			startPvp();
			xWinsTopRow();
			fireEvent.click(replayButton());
			choose('Endless');
			noStep();
			expect(marks().every((m) => !m)).toBe(true);
		});

		it('replays the clears in endless mode too', () => {
			vi.useFakeTimers();
			startPvp();
			choose('Endless');
			click(0, 4, 1, 2, 6, 3, 5);
			vi.advanceTimersByTime(1000);
			// O threatens the diagonal through the cleared cell; X plays elsewhere and O completes it
			click(0, 7, 8);
			expect(screen.getByText(/wins!/)).toHaveTextContent('O wins!');

			fireEvent.click(replayButton());
			// Eleven events: seven moves, the clear, then three more moves
			expect(step()).toBe('Step 0 / 11');
			vi.advanceTimersByTime(500 * 7);
			expect(marks().filter(Boolean)).toHaveLength(7);
			expect(marks()[0]).toBe('X');
			vi.advanceTimersByTime(500);
			expect(step()).toBe('Step 8 / 11');
			expect(marks().filter(Boolean)).toHaveLength(6);
			expect(marks()[0]).toBe('');
			vi.advanceTimersByTime(500 * 4);
			noStep();
		});
	});

	describe('board sizes', () => {
		it('starts on 3×3', () => {
			renderGame();
			expect(all()).toHaveLength(9);
			expect(screen.getByRole('radio', { name: '3×3' })).toHaveAttribute('aria-checked', 'true');
		});

		it('switches to 4×4 and 5×5, labelling cells by row and column', () => {
			renderGame();
			choose('4×4');
			expect(all()).toHaveLength(16);
			expect(cell(4, 4)).toBeInTheDocument();
			choose('5×5');
			expect(all()).toHaveLength(25);
			expect(cell(5, 5)).toBeInTheDocument();
			expect(screen.getByRole('group', { name: 'Game board' }).parentElement.style.getPropertyValue('--ttt-n')).toBe('5');
		});

		it('starts a new game when the size changes', () => {
			startPvp();
			click(0, 1);
			choose('4×4');
			expect(all().every((b) => !b.textContent)).toBe(true);
			expect(screen.getByText(/Turn:/)).toHaveTextContent('Turn: X');
		});

		it('needs four in a row on 4×4 and 5×5', () => {
			startPvp();
			choose('4×4');
			// X takes three across the top, O two below: no win yet
			click(0, 4, 1, 5, 2);
			expect(screen.getByText(/Turn:/)).toHaveTextContent('Turn: O');
			click(10, 3);
			expect(screen.getByText(/wins!/)).toHaveTextContent('X wins!');
			expect(all()[3]).toHaveClass('winning');
			expect(all()[4]).not.toHaveClass('winning');
		});

		it('draws the win line to the size of the board', () => {
			startPvp();
			choose('5×5');
			// X takes cells 1-4 in the top row
			click(1, 5, 2, 6, 3, 7, 4);
			const svg = document.querySelector('.ttt-win-line');
			expect(svg).toHaveAttribute('viewBox', '0 0 500 500');
			const line = svg.querySelector('line');
			// Runs through the centres of cells 1 and 4 (x = 150 and 450), a little past each
			expect(Number(line.getAttribute('x1'))).toBeLessThan(150);
			expect(Number(line.getAttribute('x2'))).toBeGreaterThan(450);
			expect(Number(line.getAttribute('y1'))).toBe(50);
		});

		it('keeps separate scores for each size', () => {
			startPvp();
			xWinsTopRow();
			expect(scoreboard()).toHaveTextContent(/X\s*1\s*Draws\s*0\s*O\s*0/);
			choose('4×4');
			expect(scoreboard()).toHaveTextContent(/X\s*0\s*Draws\s*0\s*O\s*0/);
			click(0, 4, 1, 5, 2, 6, 3);
			expect(scoreboard()).toHaveTextContent(/X\s*1/);
			choose('3×3');
			expect(scoreboard()).toHaveTextContent(/X\s*1\s*Draws\s*0\s*O\s*0/);

			const saved = JSON.parse(localStorage.getItem('alfred-portfolio:ttt-scores'));
			// 3×3 keeps the key it always had
			expect(Object.keys(saved).sort()).toEqual(['pvp', 'pvp-4x4']);
		});

		it('remembers the size', () => {
			const first = renderGame();
			choose('5×5');
			first.unmount();

			renderGame();
			expect(screen.getByRole('radio', { name: '5×5' })).toHaveAttribute('aria-checked', 'true');
			expect(all()).toHaveLength(25);
		});

		it('calls the top level Hard instead of Impossible on bigger boards', () => {
			renderGame();
			expect(screen.getByRole('radio', { name: 'Impossible' })).toBeInTheDocument();
			choose('5×5');
			expect(screen.queryByRole('radio', { name: 'Impossible' })).not.toBeInTheDocument();
			expect(screen.getByRole('radio', { name: 'Hard' })).toBeInTheDocument();
		});

		it('plays against the AI on 5×5', () => {
			vi.useFakeTimers();
			renderGame();
			choose('5×5');
			click(12);
			vi.advanceTimersByTime(1000);
			expect(all().filter((b) => b.textContent === 'O')).toHaveLength(1);
			expect(screen.getByText(/Your turn/)).toBeInTheDocument();
		});

		it('keeps endless mode going on a big board', () => {
			vi.useFakeTimers();
			startPvp();
			choose('4×4');
			choose('Endless');
			// A full 4×4 board with no four in a row anywhere
			const layout = 'XXOO OOXX XXOO OOXX';
			const order = [...layout.replace(/ /g, '')].map((mark, i) => ({ mark, i }));
			const xs = order.filter((m) => m.mark === 'X').map((m) => m.i);
			const os = order.filter((m) => m.mark === 'O').map((m) => m.i);
			// X moves first, then they alternate
			const sequence = xs.flatMap((x, k) => [x, os[k]]);
			click(...sequence);
			// Nobody can win, but the game isn't over: the oldest mark fades and is cleared instead
			expect(all()[sequence[0]]).toHaveClass('vanishing');
			vi.advanceTimersByTime(1000);
			expect(all()[sequence[0]]).toHaveTextContent('');
			expect(scoreboard()).toHaveTextContent(/Cleared\s*1/);
			expect(screen.queryByText(/draw/i)).not.toBeInTheDocument();
		});

		it('calls a classic 4×4 draw as soon as every line is blocked', () => {
			startPvp();
			choose('4×4');
			// XXOO / OOXX / XXOO / OOX_ : every line holds both marks, so the last cell is pointless
			const layout = [...'XXOOOOXXXXOOOOX.'];
			const xs = layout.flatMap((m, i) => (m === 'X' ? [i] : []));
			const os = layout.flatMap((m, i) => (m === 'O' ? [i] : []));
			click(...xs.flatMap((x, k) => (os[k] === undefined ? [x] : [x, os[k]])));
			expect(status()).toHaveTextContent('Draw. Nobody can win from here.');
			expect(all()[15]).toBeDisabled();
			expect(scoreboard()).toHaveTextContent(/Draws\s*1/);
		});
	});

	describe('achievements', () => {
		// The human is X. The AI plays the cells in `script`, in order.
		const scriptAi = (...script) => {
			ai.script = () => script.shift();
		};
		const humanPlays = (...cells) => {
			for (const index of cells) {
				fireEvent.click(all()[index]);
				vi.advanceTimersByTime(1000);
			}
		};
		const setup = () => {
			vi.useFakeTimers();
			renderGame();
		};

		it('awards Blitz for a win in exactly three moves', () => {
			setup();
			scriptAi(0, 1);
			choose('Easy');
			humanPlays(4, 2, 6);
			expect(screen.getByText(/You win/)).toBeInTheDocument();
			expect(unlock).toHaveBeenCalledWith('ttt-quick-win');
			// Easy doesn't count as beating the AI
			expect(unlock).not.toHaveBeenCalledWith('ttt-beat-medium');
			expect(unlock).not.toHaveBeenCalledWith('ttt-endless-impossible');
		});

		it('awards nothing when undo was used', () => {
			setup();
			scriptAi(8, 7, 5);
			choose('Easy');
			// A detour to the middle that gets taken back, then the top row in three moves
			humanPlays(0, 1, 4);
			fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
			humanPlays(2);
			expect(screen.getByText(/You win/)).toBeInTheDocument();
			expect(unlock).not.toHaveBeenCalled();
		});

		it('counts the next game afresh after one where undo was used', () => {
			setup();
			scriptAi(8, 7, 5, 0, 1);
			choose('Easy');
			humanPlays(0, 1, 4);
			fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
			fireEvent.click(screen.getByRole('button', { name: 'Restart' }));
			humanPlays(4, 2, 6);
			expect(unlock).toHaveBeenCalledWith('ttt-quick-win');
		});

		it('doesn’t award Blitz for a four-move win', () => {
			setup();
			scriptAi(8, 7, 5);
			choose('Easy');
			humanPlays(0, 1, 3, 2);
			expect(screen.getByText(/You win/)).toBeInTheDocument();
			expect(unlock).not.toHaveBeenCalledWith('ttt-quick-win');
		});

		it('awards Never-Ending Story for beating Impossible in endless mode on 3×3', () => {
			setup();
			choose('Impossible');
			choose('Endless');
			scriptAi(0, 1);
			humanPlays(4, 2, 6);
			expect(unlock).toHaveBeenCalledWith('ttt-endless-impossible');
			expect(unlock).toHaveBeenCalledWith('ttt-beat-medium');
		});

		it('wants endless mode and Impossible for Never-Ending Story', () => {
			setup();
			choose('Impossible');
			scriptAi(0, 1);
			humanPlays(4, 2, 6);
			expect(unlock).not.toHaveBeenCalledWith('ttt-endless-impossible');
		});

		it('awards Room to Move for beating the AI on 5×5', () => {
			setup();
			choose('5×5');
			scriptAi(24, 23, 22);
			humanPlays(0, 1, 2, 3);
			expect(screen.getByText(/You win/)).toBeInTheDocument();
			expect(unlock).toHaveBeenCalledWith('ttt-big-board');
			expect(unlock).not.toHaveBeenCalledWith('ttt-quick-win');
		});

		it('doesn’t award Room to Move on easy, or on a smaller board', () => {
			setup();
			choose('5×5');
			choose('Easy');
			scriptAi(24, 23, 22);
			humanPlays(0, 1, 2, 3);
			expect(screen.getByText(/You win/)).toBeInTheDocument();
			expect(unlock).not.toHaveBeenCalledWith('ttt-big-board');

			choose('4×4');
			choose('Medium');
			scriptAi(15, 14, 13);
			humanPlays(0, 1, 2, 3);
			expect(screen.getByText(/You win/)).toBeInTheDocument();
			expect(unlock).not.toHaveBeenCalledWith('ttt-big-board');
			expect(unlock).toHaveBeenCalledWith('ttt-beat-medium');
		});

		it('awards nothing when hints were on', () => {
			setup();
			fireEvent.click(screen.getByRole('button', { name: 'Hints' }));
			scriptAi(0, 1);
			choose('Impossible');
			choose('Endless');
			humanPlays(4, 2, 6);
			expect(screen.getByText(/You win/)).toBeInTheDocument();
			expect(unlock).not.toHaveBeenCalled();
		});

		it('awards nothing if hints were on at any point in the game', () => {
			setup();
			scriptAi(0, 1);
			choose('Medium');
			humanPlays(4);
			fireEvent.click(screen.getByRole('button', { name: 'Hints' }));
			fireEvent.click(screen.getByRole('button', { name: 'Hints' }));
			humanPlays(2, 6);
			expect(screen.getByText(/You win/)).toBeInTheDocument();
			expect(unlock).not.toHaveBeenCalled();
		});

		it('counts the next game afresh once hints are switched off', () => {
			setup();
			scriptAi(0, 1, 0, 1);
			fireEvent.click(screen.getByRole('button', { name: 'Hints' }));
			humanPlays(4, 2, 6);
			expect(unlock).not.toHaveBeenCalled();

			fireEvent.click(screen.getByRole('button', { name: 'Play again' }));
			// Hints are still on, so this game doesn't count either
			humanPlays(4, 2, 6);
			expect(unlock).not.toHaveBeenCalled();
		});

		it('counts a game with hints switched off even after one that used them', () => {
			setup();
			scriptAi(0, 1);
			fireEvent.click(screen.getByRole('button', { name: 'Hints' }));
			fireEvent.click(screen.getByRole('button', { name: 'Hints' }));
			fireEvent.click(screen.getByRole('button', { name: 'Restart' }));
			humanPlays(4, 2, 6);
			expect(unlock).toHaveBeenCalledWith('ttt-quick-win');
			expect(unlock).toHaveBeenCalledWith('ttt-beat-medium');
		});

		it('never awards anything for two-player games', () => {
			startPvp();
			xWinsTopRow();
			expect(screen.getByText(/wins!/)).toBeInTheDocument();
			expect(unlock).not.toHaveBeenCalled();
		});

		it('still awards Stalemate for holding the Impossible AI to a draw', () => {
			setup();
			choose('Impossible');
			// X O X / X O O / O X X, played as X0 O1 X2 O4 X3 O5 X7 O6 X8
			scriptAi(1, 4, 5, 6);
			humanPlays(0, 2, 3, 7, 8);
			expect(status()).toHaveTextContent(/draw/i);
			expect(unlock).toHaveBeenCalledWith('ttt-draw-impossible');
			expect(unlock).not.toHaveBeenCalledWith('ttt-beat-medium');
		});

		it('keeps awarding Outsmarted for beating Medium', () => {
			setup();
			scriptAi(0, 1);
			humanPlays(4, 2, 6);
			expect(unlock).toHaveBeenCalledWith('ttt-beat-medium');
		});

		it('awards nothing for losing', () => {
			setup();
			scriptAi(0, 1, 2);
			humanPlays(8, 7, 5);
			expect(screen.getByText('The AI wins this one.')).toBeInTheDocument();
			expect(unlock).not.toHaveBeenCalled();
		});
	});

	describe('sound', () => {
		it('plays a sound for every mark placed', () => {
			startPvp();
			click(0, 4);
			expect(playSound.mock.calls.filter(([name]) => name === 'place')).toHaveLength(2);
		});

		it('plays one for the AI’s mark too', () => {
			vi.useFakeTimers();
			renderGame();
			click(4);
			vi.advanceTimersByTime(1000);
			expect(playSound.mock.calls.filter(([name]) => name === 'place')).toHaveLength(2);
		});

		it('plays win for any win with a friend', () => {
			startPvp();
			xWinsTopRow();
			expect(playSound).toHaveBeenLastCalledWith('win');
		});

		it('plays win, lose or draw from your point of view against the AI', () => {
			vi.useFakeTimers();
			renderGame();
			choose('Easy');
			// The AI takes the top row
			ai.script = ((moves) => () => moves.shift())([0, 1, 2]);
			for (const i of [8, 7, 5]) {
				fireEvent.click(all()[i]);
				vi.advanceTimersByTime(1000);
			}
			expect(playSound).toHaveBeenLastCalledWith('lose');

			fireEvent.click(screen.getByRole('button', { name: 'Play again' }));
			ai.script = ((moves) => () => moves.shift())([0, 1]);
			for (const i of [4, 2, 6]) {
				fireEvent.click(all()[i]);
				vi.advanceTimersByTime(1000);
			}
			expect(playSound).toHaveBeenLastCalledWith('win');

			fireEvent.click(screen.getByRole('button', { name: 'Play again' }));
			ai.script = ((moves) => () => moves.shift())([1, 4, 5, 6]);
			for (const i of [0, 2, 3, 7, 8]) {
				fireEvent.click(all()[i]);
				vi.advanceTimersByTime(1000);
			}
			expect(playSound).toHaveBeenLastCalledWith('draw');
		});

		it('plays pop when endless mode clears a mark', () => {
			vi.useFakeTimers();
			startPvp();
			choose('Endless');
			click(0, 4, 1, 2, 6, 3, 5);
			expect(playSound).not.toHaveBeenCalledWith('pop');
			vi.advanceTimersByTime(1000);
			expect(playSound).toHaveBeenCalledWith('pop');
		});

		it('has a sound toggle in the action row', () => {
			renderGame();
			expect(screen.getByRole('button', { name: 'Sound' })).toBeInTheDocument();
		});
	});

	describe('sharing', () => {
		it('only offers to share a finished game', () => {
			startPvp();
			click(0);
			expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument();
		});

		it('shares a short summary with the board and a link', () => {
			startPvp();
			xWinsTopRow();
			fireEvent.click(screen.getByRole('button', { name: 'Share' }));
			expect(shareResult).toHaveBeenCalledTimes(1);
			const text = shareResult.mock.calls[0][0];
			expect(text).toContain('X won');
			expect(text).toContain('❌❌❌\n⬜⭕⭕\n⬜⬜⬜'.replace('⬜⭕⭕', '⭕⭕⬜'));
			expect(text.endsWith(`${location.origin}/tictactoe`)).toBe(true);
		});

		it('says which AI you beat, and where', () => {
			vi.useFakeTimers();
			renderGame();
			choose('5×5');
			choose('Hard');
			choose('Endless');
			ai.script = ((moves) => () => moves.shift())([24, 23, 22]);
			for (const i of [0, 1, 2, 3]) {
				fireEvent.click(all()[i]);
				vi.advanceTimersByTime(1000);
			}
			fireEvent.click(screen.getByRole('button', { name: 'Share' }));
			const text = shareResult.mock.calls[0][0];
			expect(text).toContain('I beat the Hard TicTacToe AI in Endless mode ⭕❌ (5×5)');
			// The board is drawn at any size: five rows of five
			expect(text).toContain('❌❌❌❌⬜\n⬜⬜⬜⬜⬜');
		});
	});

	describe('the achievements note', () => {
		const note = () => document.querySelector('.ttt-note');

		it('is empty for an ordinary game', () => {
			renderGame();
			expect(note()).toHaveTextContent('');
		});

		it('stays up while hints are on, and says what was used afterwards', () => {
			renderGame();
			fireEvent.click(screen.getByRole('button', { name: 'Hints' }));
			expect(note()).toHaveTextContent("Hints on · this game won't earn achievements");
			fireEvent.click(screen.getByRole('button', { name: 'Hints' }));
			expect(note()).toHaveTextContent("Hints used · this game won't earn achievements");
			fireEvent.click(screen.getByRole('button', { name: 'Restart' }));
			expect(note()).toHaveTextContent('');
		});

		it('mentions undo too', () => {
			vi.useFakeTimers();
			renderGame();
			fireEvent.click(cell(2, 2));
			fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
			expect(note()).toHaveTextContent("Undo used · this game won't earn achievements");
			fireEvent.click(screen.getByRole('button', { name: 'Hints' }));
			expect(note()).toHaveTextContent("Hints on · Undo used · this game won't earn achievements");
		});

		it('says nothing with a friend, where nothing is at stake', () => {
			startPvp();
			fireEvent.click(screen.getByRole('button', { name: 'Hints' }));
			expect(note()).toHaveTextContent('');
		});
	});

	describe('more options', () => {
		const toggle = () => screen.getByRole('button', { name: /More options/ });

		it('starts collapsed with no summary', () => {
			renderGame();
			expect(toggle()).toHaveAttribute('aria-expanded', 'false');
			expect(toggle()).toHaveTextContent(/^More options/);
			expect(toggle().querySelector('.ttt-more-summary')).toBeNull();
			expect(toggle()).toHaveAttribute('aria-controls', 'ttt-more');
			expect(document.getElementById('ttt-more')).not.toHaveClass('open');
		});

		it('opens and closes the panel holding the less-used settings', () => {
			renderGame();
			const panel = document.getElementById('ttt-more');
			for (const name of ['Rules', 'Board size', 'Your mark']) expect(panel.querySelector(`[aria-label="${name}"]`)).not.toBeNull();
			expect(panel).toContainElement(screen.getByRole('button', { name: 'Reset score' }));
			fireEvent.click(toggle());
			expect(toggle()).toHaveAttribute('aria-expanded', 'true');
			expect(panel).toHaveClass('open');
			fireEvent.click(toggle());
			expect(panel).not.toHaveClass('open');
		});

		it('summarises the choices that aren’t the defaults', () => {
			renderGame();
			choose('5×5');
			expect(toggle()).toHaveTextContent('5×5');
			choose('Endless');
			choose('Play O');
			expect(toggle().querySelector('.ttt-more-summary')).toHaveTextContent('5×5 · Endless · Play O');
			choose('3×3');
			choose('Classic');
			choose('Play X');
			expect(toggle().querySelector('.ttt-more-summary')).toBeNull();
		});
	});

	describe('keyboard focus', () => {
		it('moves to Pause when a replay starts and back to Replay when it ends', () => {
			vi.useFakeTimers();
			startPvp();
			xWinsTopRow();
			fireEvent.click(screen.getByRole('button', { name: 'Replay' }));
			expect(screen.getByRole('button', { name: 'Pause' })).toHaveFocus();
			fireEvent.click(screen.getByRole('button', { name: 'Skip to end' }));
			expect(screen.getByRole('button', { name: 'Replay' })).toHaveFocus();
		});

		it('also returns to Replay when the replay finishes by itself', () => {
			vi.useFakeTimers();
			startPvp();
			xWinsTopRow();
			fireEvent.click(screen.getByRole('button', { name: 'Replay' }));
			vi.advanceTimersByTime(500 * 7);
			expect(screen.getByRole('button', { name: 'Replay' })).toHaveFocus();
		});

		it('shows the step count as plain text', () => {
			vi.useFakeTimers();
			startPvp();
			xWinsTopRow();
			fireEvent.click(screen.getByRole('button', { name: 'Replay' }));
			expect(screen.getByText('Step 0 / 5')).not.toHaveAttribute('aria-label');
		});
	});

	describe('links', () => {
		it('scopes its own styling to this page', () => {
			renderGame();
			expect(document.querySelector('section')).toHaveClass('ttt-classic');
		});

		it('points at the sibling games', () => {
			renderGame();
			expect(screen.getByRole('link', { name: /Ultimate TicTacToe/ })).toHaveAttribute('href', '/tictactoe/ultimate');
			expect(screen.getByRole('link', { name: /Play a friend online/ })).toHaveAttribute('href', '/tictactoe/online');
		});
	});
});
