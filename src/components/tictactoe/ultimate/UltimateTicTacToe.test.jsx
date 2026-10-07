import { Router } from '@solidjs/router';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { unlock } from '../../../state/achievements';
import { chooseMove } from './logic';
import UltimateTicTacToe from './UltimateTicTacToe';

vi.mock('../../../state/achievements', () => ({ unlock: vi.fn() }));
// The real AI by default; one test scripts it to lose
vi.mock('./logic', async (importOriginal) => {
	const actual = await importOriginal();
	return { ...actual, chooseMove: vi.fn(actual.chooseMove) };
});

// A complete game (cell numbers, X first) that X wins on the big board, found by random search
const X_WINS = [73, 12, 27, 6, 60, 62, 74, 23, 49, 41, 52, 65, 19, 17, 72, 5, 46, 11, 20, 26, 61, 71, 59, 29, 18];

const renderPage = () => render(() => <Router root={UltimateTicTacToe} />);
// Short games that O wins, and that end in a draw while including a drawn small board
const O_WINS = [1, 11, 21, 34, 68, 46, 13, 42, 58, 38, 22, 40, 50, 49, 48, 30, 32, 52, 66, 33, 57, 27];
const DRAWN = [
	19, 17, 79, 66, 31, 38, 18, 4, 41, 47, 22, 39, 33, 59, 52, 67, 42, 56, 25, 68, 45, 8, 73, 13, 40, 37, 15, 58, 36, 0, 77, 48, 29, 62, 74, 80,
	76, 44, 16, 43, 51, 53, 9, 50,
];

describe('UltimateTicTacToe', () => {
	beforeEach(() => {
		localStorage.clear();
		unlock.mockClear();
	});
	afterEach(() => vi.useRealTimers());

	// Cells are numbered board by board, like the game's own moves
	const cells = () => screen.getAllByRole('button', { name: /board, row \d, column \d:/ });
	const click = (...indexes) => indexes.forEach((i) => fireEvent.click(cells()[i]));
	const status = () => document.querySelector('.ttt-status');
	const playable = () => [...new Set(cells().flatMap((c, i) => (c.disabled ? [] : [Math.floor(i / 9)])))];

	describe('two players', () => {
		beforeEach(async () => {
			renderPage();
			fireEvent.click(await screen.findByRole('radio', { name: '2 Players' }));
		});

		it('lets X start anywhere', () => {
			expect(cells().filter((c) => !c.disabled)).toHaveLength(81);
			expect(status()).toHaveTextContent('X can play anywhere');
		});

		it('sends the next player to the board matching the cell played', () => {
			click(2); // top-right cell of the top-left board
			expect(playable()).toEqual([2]);
			expect(status()).toHaveTextContent('O to play in the top-right board');
			expect(cells()[2]).toHaveTextContent('X');
			// Cells in the other boards can't be played
			fireEvent.click(cells()[40]);
			expect(cells()[40]).toHaveTextContent('');
		});

		it('plays a game through to a small-board win and then sends the loser to the matching board', () => {
			// X takes the top row of the top-left board; O's replies are all aimed away from it
			click(40, 36, 0, 4, 37, 9, 1, 13, 38, 18, 2);

			expect(screen.getByRole('group', { name: 'top-left board, won by X' })).toHaveClass('claimed', 'won-X');
			// X's winning cell was the top-right one, so O has to play in the top-right board
			expect(playable()).toEqual([2]);
			expect(status()).toHaveTextContent('O to play in the top-right board');
			expect(screen.getByRole('group', { name: 'top-right board' })).toHaveClass('active');
			expect(screen.getByRole('group', { name: 'centre board' })).not.toHaveClass('active');
			// The won board is closed
			expect(cells()[5]).toBeDisabled();
			// And the last move is marked
			expect(cells()[2]).toHaveClass('last');
		});

		it('lets the next player go anywhere when sent to a decided board', () => {
			// X wins the top-left board, then play wanders until O plays cell 0 of the middle-left board,
			// which sends X to the top-left board: it's won, so X may play anywhere else
			click(40, 36, 0, 4, 37, 9, 1, 13, 38, 18, 2);
			click(21, 29, 22, 39, 27);
			expect(status()).toHaveTextContent('X can play anywhere');
			expect(playable()).toHaveLength(8); // every board but the closed top-left one
			expect(playable()).not.toContain(0);
		});

		it('ends the game on a big win, locks the board and scores it', () => {
			click(...X_WINS);
			expect(status()).toHaveTextContent('X wins!');
			expect(cells().every((c) => c.disabled)).toBe(true);
			expect(screen.getByLabelText('Score')).toHaveTextContent(/X\s*1\s*Draws\s*0\s*O\s*0/);
		});

		it('offers to share the result once the game is over', () => {
			const share = vi.fn().mockResolvedValue();
			Object.defineProperty(navigator, 'share', { value: share, configurable: true });
			expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument();
			click(...X_WINS);
			fireEvent.click(screen.getByRole('button', { name: 'Share' }));
			const text = share.mock.calls[0][0].text;
			expect(text).toMatch(/Ultimate TicTacToe/);
			expect(text).toMatch(/[❌⭕➖⬜]{3}\n[❌⭕➖⬜]{3}\n[❌⭕➖⬜]{3}/u);
			expect(text).toContain(`${location.origin}/tictactoe/ultimate`);
			delete navigator.share;
		});

		it('scores a draw', () => {
			click(...DRAWN);
			expect(status()).toHaveTextContent(/draw/i);
			expect(screen.getByLabelText('Score')).toHaveTextContent(/X\s*0\s*Draws\s*1\s*O\s*0/);
			expect(cells().every((c) => c.disabled)).toBe(true);
		});

		it('marks drawn small boards', () => {
			click(...DRAWN);
			const drawn = document.querySelectorAll('.uttt-sub.drawn');
			expect(drawn.length).toBeGreaterThan(0);
			expect(drawn[0].querySelector('.uttt-draw')).toBeInTheDocument();
		});

		it('keeps the scores, per mode, across visits', () => {
			click(...X_WINS);
			expect(JSON.parse(localStorage.getItem('alfred-portfolio:uttt-scores'))).toEqual({ pvp: { a: 1, b: 0, draws: 0 } });
		});

		it('does not unlock the achievement in a two-player game', () => {
			click(...X_WINS);
			expect(unlock).not.toHaveBeenCalled();
		});

		it('keeps the game when the chosen setting is already selected', () => {
			click(2);
			fireEvent.click(screen.getByRole('radio', { name: '2 Players' }));
			expect(cells()[2]).toHaveTextContent('X');
			fireEvent.click(screen.getByRole('radio', { name: 'vs AI' }));
			expect(cells()[2]).toHaveTextContent('');
		});

		describe('keyboard focus', () => {
			it('follows the game after a keyboard move, to the first cell of the board you are sent to', () => {
				cells()[2].focus();
				fireEvent.keyDown(cells()[2], { key: 'Enter' });
				fireEvent.click(cells()[2]);
				// Cell 2 sends O to the top-right board
				expect(document.activeElement).toBe(cells()[18]);
			});

			it('goes to the first legal cell anywhere when sent to a decided board', () => {
				click(40, 36, 0, 4, 37, 9, 1, 13, 38, 18);
				// X wins the top-left board from the keyboard, sending O to the top-right board
				fireEvent.keyDown(cells()[2], { key: ' ' });
				fireEvent.click(cells()[2]);
				expect(document.activeElement).toBe(cells()[19]);
			});

			it('leaves focus alone after a mouse click', () => {
				fireEvent.pointerDown(cells()[2]);
				fireEvent.click(cells()[2]);
				expect(document.activeElement).not.toBe(cells()[18]);
			});
		});

		it('starts over', () => {
			click(2);
			fireEvent.click(screen.getByRole('button', { name: 'Restart' }));
			expect(cells()[2]).toHaveTextContent('');
			expect(status()).toHaveTextContent('X can play anywhere');
		});

		it('links back to classic TicTacToe and explains the rules', () => {
			expect(screen.getByRole('link', { name: /Classic TicTacToe/ })).toHaveAttribute('href', '/tictactoe');
			expect(screen.getByText('How to play').closest('details')).not.toHaveAttribute('open');
			expect(document.title).toBe('Ultimate TicTacToe | Alfred Shaheen');
		});
	});

	describe('saved data', () => {
		const store = (key, value) => localStorage.setItem(`alfred-portfolio:${key}`, value);

		it('falls back to the defaults when settings and scores are null', async () => {
			store('uttt-settings', 'null');
			store('uttt-scores', 'null');
			renderPage();
			expect(await screen.findByRole('radio', { name: 'Medium' })).toHaveAttribute('aria-checked', 'true');
			expect(screen.getByRole('radio', { name: 'vs AI' })).toHaveAttribute('aria-checked', 'true');
			expect(screen.getByRole('radio', { name: 'Play X' })).toHaveAttribute('aria-checked', 'true');
			expect(screen.getByLabelText('Score')).toHaveTextContent(/You \(X\)\s*0\s*Draws\s*0\s*AI \(O\)\s*0/);
		});

		it('ignores settings that are not options, and scores that are not counts', async () => {
			store('uttt-settings', JSON.stringify({ mode: 'solo', difficulty: 'impossible', human: 'O' }));
			store('uttt-scores', JSON.stringify({ 'ai-medium': { a: 'lots', b: 1, draws: 0 }, 'ai-hard': { a: 3, b: 1, draws: 2 } }));
			renderPage();
			// The valid setting is kept, the invalid ones fall back
			expect(await screen.findByRole('radio', { name: 'Play O' })).toHaveAttribute('aria-checked', 'true');
			expect(screen.getByRole('radio', { name: 'Medium' })).toHaveAttribute('aria-checked', 'true');
			expect(screen.getByLabelText('Score')).toHaveTextContent(/AI \(X\)\s*0\s*Draws\s*0\s*You \(O\)\s*0|You \(O\)\s*0\s*Draws\s*0\s*AI \(X\)\s*0/);
			fireEvent.click(screen.getByRole('radio', { name: 'Hard' }));
			expect(screen.getByLabelText('Score')).toHaveTextContent(/3\s*Draws\s*2\s*AI \(X\)\s*1/);
		});

		it('survives settings that are not an object', async () => {
			store('uttt-settings', '"hard"');
			store('uttt-scores', '[1, 2]');
			renderPage();
			expect(await screen.findByRole('radio', { name: 'Medium' })).toHaveAttribute('aria-checked', 'true');
		});
	});

	describe('against the AI', () => {
		it('answers your move after a short pause, in the board you sent it to', async () => {
			vi.useFakeTimers();
			renderPage();
			await vi.advanceTimersByTimeAsync(0);
			click(4); // sends the AI to the centre board
			expect(screen.getByText(/AI is thinking/)).toBeInTheDocument();

			vi.advanceTimersByTime(1000);
			const marks = cells().map((c) => c.textContent);
			expect(marks.filter((m) => m === 'O')).toHaveLength(1);
			expect(marks.indexOf('O')).toBeGreaterThanOrEqual(36);
			expect(marks.indexOf('O')).toBeLessThan(45);
			expect(status()).toHaveTextContent('Your turn (X): play in the');
		});

		it('wins you the achievement and a share line when you beat it', async () => {
			vi.useFakeTimers();
			const share = vi.fn().mockResolvedValue();
			Object.defineProperty(navigator, 'share', { value: share, configurable: true });
			// The AI (O) plays the even-numbered moves of the scripted game, and loses
			const replies = X_WINS.filter((_, i) => i % 2 === 1);
			chooseMove.mockImplementation(() => replies.shift());
			renderPage();
			await vi.advanceTimersByTimeAsync(0);
			for (const move of X_WINS.filter((_, i) => i % 2 === 0)) {
				click(move);
				vi.advanceTimersByTime(1000);
			}
			expect(status()).toHaveTextContent('You win!');
			expect(unlock).toHaveBeenCalledWith('ttt-ultimate');
			fireEvent.click(screen.getByRole('button', { name: 'Share' }));
			expect(share.mock.calls[0][0].text).toMatch(/^I beat the Medium Ultimate TicTacToe AI/);
			delete navigator.share;
			chooseMove.mockReset();
		});

		it('does not unlock the achievement when you lose, and cleans up its timers', async () => {
			vi.useFakeTimers();
			// The AI (O) plays the odd-numbered moves of the scripted game, and wins
			const replies = O_WINS.filter((_, i) => i % 2 === 1);
			chooseMove.mockImplementation(() => replies.shift());
			const { unmount } = renderPage();
			await vi.advanceTimersByTimeAsync(0);
			for (const move of O_WINS.filter((_, i) => i % 2 === 0)) {
				click(move);
				vi.advanceTimersByTime(1000);
			}
			expect(status()).toHaveTextContent('The AI wins this one.');
			expect(screen.getByLabelText('Score')).toHaveTextContent(/You \(X\)\s*0\s*Draws\s*0\s*AI \(O\)\s*1/);
			expect(unlock).not.toHaveBeenCalled();
			// The shake ends 600ms after the loss; unmounting before then must not leave it behind
			unmount();
			expect(vi.getTimerCount()).toBe(0);
			chooseMove.mockReset();
		});

		it('announces where the AI played', async () => {
			vi.useFakeTimers();
			renderPage();
			await vi.advanceTimersByTimeAsync(0);
			expect(status()).not.toHaveTextContent('AI played');
			click(4);
			vi.advanceTimersByTime(1000);
			expect(status()).toHaveTextContent(/AI played the [\w-]+ board, row \d, column \d\. Your turn \(X\): play/);
		});

		it('drops the AI move when you restart while it is thinking', async () => {
			vi.useFakeTimers();
			renderPage();
			await vi.advanceTimersByTimeAsync(0);
			click(4);
			fireEvent.click(screen.getByRole('button', { name: 'Restart' }));
			vi.advanceTimersByTime(2000);
			expect(cells().filter((c) => c.textContent)).toHaveLength(0);
			expect(status()).toHaveTextContent('Your turn (X): play anywhere');
		});

		it('drops the AI move when you change a setting while it is thinking', async () => {
			vi.useFakeTimers();
			renderPage();
			await vi.advanceTimersByTimeAsync(0);
			click(4);
			fireEvent.click(screen.getByRole('radio', { name: 'Hard' }));
			vi.advanceTimersByTime(2000);
			// A new game, with nobody having moved: the AI isn't playing X
			expect(cells().filter((c) => c.textContent)).toHaveLength(0);
		});

		it('still replies on Hard when the clock is frozen', async () => {
			vi.useFakeTimers();
			renderPage();
			await vi.advanceTimersByTimeAsync(0);
			fireEvent.click(screen.getByRole('radio', { name: 'Hard' }));
			click(40);
			vi.advanceTimersByTime(1000);
			expect(cells().filter((c) => c.textContent === 'O')).toHaveLength(1);
		});

		it('ignores clicks while the AI is thinking', async () => {
			vi.useFakeTimers();
			renderPage();
			await vi.advanceTimersByTimeAsync(0);
			click(4);
			click(36);
			expect(cells().filter((c) => c.textContent === 'X')).toHaveLength(1);
		});

		it('moves first when you play O', async () => {
			vi.useFakeTimers();
			renderPage();
			await vi.advanceTimersByTimeAsync(0);
			fireEvent.click(screen.getByRole('radio', { name: 'Play O' }));
			vi.advanceTimersByTime(1000);
			expect(cells().filter((c) => c.textContent === 'X')).toHaveLength(1);
		});

		it('remembers your settings', async () => {
			const first = renderPage();
			fireEvent.click(await screen.findByRole('radio', { name: 'Hard' }));
			fireEvent.click(screen.getByRole('radio', { name: 'Play O' }));
			first.unmount();

			renderPage();
			expect(await screen.findByRole('radio', { name: 'Hard' })).toHaveAttribute('aria-checked', 'true');
			expect(screen.getByRole('radio', { name: 'Play O' })).toHaveAttribute('aria-checked', 'true');
		});
	});
});
