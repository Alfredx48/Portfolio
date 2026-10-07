import { cleanup, fireEvent, render, screen, within } from '@solidjs/testing-library';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { unlock } from '../../state/achievements';
import { shareResult } from '../../utils/share';
import { playSound } from '../../utils/sound';
import { load, save } from '../../utils/storage';
import { createDeck, dailyDeck, formatTime, LEVELS, LOGOS, seededRandom, starsFor } from './deck';
import MemoryGame from './MemoryGame';

vi.mock('../../state/achievements', () => ({ unlock: vi.fn() }));
vi.mock('../../utils/share', () => ({ shareResult: vi.fn() }));
vi.mock('../../utils/sound', async (importOriginal) => ({ ...(await importOriginal()), playSound: vi.fn() }));

describe('createDeck', () => {
	it('has two cards for every logo it uses', () => {
		const deck = createDeck(LOGOS.length);
		expect(deck).toHaveLength(LOGOS.length * 2);
		for (const logo of LOGOS) {
			expect(deck.filter((card) => card.name === logo.name)).toHaveLength(2);
		}
	});

	it('uses the requested number of pairs', () => {
		for (const { pairs } of Object.values(LEVELS)) {
			const deck = createDeck(pairs);
			expect(deck).toHaveLength(pairs * 2);
			expect(new Set(deck.map((card) => card.name)).size).toBe(pairs);
		}
	});

	it('gives every card a unique id', () => {
		const deck = createDeck();
		expect(new Set(deck.map((card) => card.id)).size).toBe(deck.length);
	});
});

describe('seeded decks', () => {
	const order = (deck) => deck.map((card) => `${card.name}:${card.id}`);

	it('gives the same deck for the same date', () => {
		expect(order(dailyDeck('2026-10-05'))).toEqual(order(dailyDeck('2026-10-05')));
	});

	it('gives different decks on different dates', () => {
		expect(order(dailyDeck('2026-10-05'))).not.toEqual(order(dailyDeck('2026-10-06')));
		expect(order(dailyDeck('2026-10-05'))).not.toEqual(order(dailyDeck('2027-10-05')));
	});

	it('is a normal deck: Medium sized, with a pair of each logo', () => {
		const deck = dailyDeck('2026-10-05');
		expect(deck).toHaveLength(LEVELS.medium.pairs * 2);
		expect(new Set(deck.map((card) => card.name)).size).toBe(LEVELS.medium.pairs);
	});

	it('uses a custom random function, and floats in [0, 1) from the seed', () => {
		const random = seededRandom('abc');
		const values = Array.from({ length: 100 }, random);
		expect(values.every((v) => v >= 0 && v < 1)).toBe(true);
		expect(values).toEqual(Array.from({ length: 100 }, seededRandom('abc')));
		expect(order(createDeck(6, seededRandom(1)))).toEqual(order(createDeck(6, seededRandom(1))));
	});
});

describe('starsFor', () => {
	it('rewards fewer moves', () => {
		expect(starsFor(6, 6)).toBe(3);
		expect(starsFor(12, 6)).toBe(2);
		expect(starsFor(20, 6)).toBe(1);
	});
});

describe('formatTime', () => {
	it('formats minutes and seconds', () => {
		expect(formatTime(0)).toBe('0:00');
		expect(formatTime(65_400)).toBe('1:05');
	});
});

describe('MemoryGame', () => {
	beforeEach(() => {
		localStorage.clear();
		vi.clearAllMocks();
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 9, 5, 12));
	});
	afterEach(() => vi.useRealTimers());

	// The deck is shuffled, so pairs are found by comparing the face images
	const renderCards = () => {
		const { container } = render(() => <MemoryGame />);
		return () => [...container.querySelectorAll('.mg-card')];
	};
	const face = (card) => card.querySelector('.mg-face').src;
	const stat = (label) => screen.getByText(label).nextElementSibling;

	it('keeps a matching pair face up and counts the move', () => {
		const all = renderCards()();
		const partner = all.find((card, i) => i !== 0 && face(card) === face(all[0]));
		fireEvent.click(all[0]);
		fireEvent.click(partner);
		const name = all[0].getAttribute('aria-label');

		vi.advanceTimersByTime(2000);
		expect(name).not.toBe('Hidden card');
		expect(all[0]).toHaveAttribute('aria-label', name);
		expect(partner).toHaveAttribute('aria-label', name);
		expect(stat('Moves')).toHaveTextContent('1');
	});

	it('flips a non-matching pair back over and breaks the combo', () => {
		const all = renderCards()();
		const other = all.find((card) => face(card) !== face(all[0]));

		fireEvent.click(all[0]);
		fireEvent.click(other);
		expect(all[0]).not.toHaveAttribute('aria-label', 'Hidden card');

		vi.advanceTimersByTime(1000);
		expect(all[0]).toHaveAttribute('aria-label', 'Hidden card');
		expect(other).toHaveAttribute('aria-label', 'Hidden card');
		expect(stat('Combo')).toHaveTextContent('×0');
	});

	it('does not count clicking the same card twice as a pair', () => {
		const all = renderCards()();
		fireEvent.click(all[0]);
		fireEvent.click(all[0]);
		expect(stat('Moves')).toHaveTextContent('0');
	});

	it('changes the number of cards with the difficulty', () => {
		const cards = renderCards();
		expect(cards()).toHaveLength(LEVELS.medium.pairs * 2);
		fireEvent.click(screen.getByRole('radio', { name: 'Easy' }));
		expect(cards()).toHaveLength(LEVELS.easy.pairs * 2);
		fireEvent.click(screen.getByRole('radio', { name: 'Hard' }));
		expect(cards()).toHaveLength(LEVELS.hard.pairs * 2);
	});

	it('clears a perfect board with three stars, a combo and a saved best', () => {
		const cards = renderCards();
		fireEvent.click(screen.getByRole('radio', { name: 'Easy' }));

		const remaining = cards();
		while (remaining.length) {
			const card = remaining.shift();
			const partner = remaining.splice(remaining.findIndex((c) => face(c) === face(card)), 1)[0];
			fireEvent.click(card);
			fireEvent.click(partner);
		}

		expect(screen.getByRole('dialog', { name: 'Board cleared' })).toBeInTheDocument();
		expect(screen.getByLabelText('3 out of 3 stars')).toBeInTheDocument();
		expect(stat('Combo')).toHaveTextContent(`×${LEVELS.easy.pairs}`);
		expect(stat('Best')).toHaveTextContent(`${LEVELS.easy.pairs} ·`);

		fireEvent.click(screen.getByRole('button', { name: 'Play again' }));
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		expect(stat('Moves')).toHaveTextContent('0');
	});

	// Matches every pair in turn
	const clearBoard = (cards) => {
		const remaining = cards();
		while (remaining.length) {
			const card = remaining.shift();
			const partner = remaining.splice(remaining.findIndex((c) => face(c) === face(card)), 1)[0];
			fireEvent.click(card);
			fireEvent.click(partner);
		}
	};
	const missOnce = (cards) => {
		const all = cards();
		fireEvent.click(all[0]);
		fireEvent.click(all.find((card) => face(card) !== face(all[0])));
	};
	const pickMode = (name) => fireEvent.click(screen.getByRole('radio', { name }));
	const sounds = () => playSound.mock.calls.map(([name]) => name);
	const stored = (key) => load(key, null);

	describe('daily challenge', () => {
		const nextDay = (day) => vi.setSystemTime(new Date(2026, 9, day, 12));
		const playDay = (cards) => {
			fireEvent.click(screen.getByRole('button', { name: 'Restart' }));
			clearBoard(cards);
		};

		const midnight = () => vi.setSystemTime(new Date(2026, 9, 6, 0, 5));

		it('re-deals a board left open overnight, swallowing the click that finds it stale', () => {
			const cards = renderCards();
			pickMode('Daily');
			const yesterday = cards().map(face).join();
			midnight();
			fireEvent.click(cards()[0]);

			expect(screen.getByText('2026-10-06')).toBeInTheDocument();
			expect(cards().map(face).join()).not.toBe(yesterday);
			expect(cards().every((card) => card.getAttribute('aria-label') === 'Hidden card')).toBe(true);
			expect(sounds()).not.toContain('flip');
			clearBoard(cards);
			expect(stored('memory-daily')).toMatchObject({ date: '2026-10-06', streak: 1 });
		});

		it('counts the new day, not practice, when yesterday was already completed', () => {
			const cards = renderCards();
			pickMode('Daily');
			clearBoard(cards);
			fireEvent.click(screen.getByRole('button', { name: 'Practice again' }));
			expect(screen.getByText('Come back tomorrow')).toBeInTheDocument();

			midnight();
			fireEvent.click(cards()[0]);
			expect(screen.queryByText('Come back tomorrow')).not.toBeInTheDocument();
			expect(stat('Moves')).toHaveTextContent('0');
			clearBoard(cards);

			const dialog = screen.getByRole('dialog', { name: 'Board cleared' });
			expect(dialog).toHaveTextContent('Board cleared!');
			expect(dialog).toHaveTextContent('🔥2');
			expect(stored('memory-daily')).toMatchObject({ date: '2026-10-06', streak: 2 });
			expect(unlock).toHaveBeenCalledWith('memory-daily');
		});

		it('swallows a stale Peek too', () => {
			renderCards();
			pickMode('Daily');
			midnight();
			fireEvent.click(screen.getByRole('button', { name: /Peek/ }));
			expect(screen.getByRole('button', { name: /Peek/ })).toBeEnabled();
			expect(screen.getByText('2026-10-06')).toBeInTheDocument();
		});

		it('refreshes an unstarted board when the window is focused or shown again', () => {
			renderCards();
			pickMode('Daily');
			midnight();
			fireEvent.focus(window);
			expect(screen.getByText('2026-10-06')).toBeInTheDocument();

			vi.setSystemTime(new Date(2026, 9, 7, 9));
			document.dispatchEvent(new Event('visibilitychange'));
			expect(screen.getByText('2026-10-07')).toBeInTheDocument();
		});

		it('leaves a game in progress on the day it started', () => {
			const cards = renderCards();
			pickMode('Daily');
			fireEvent.click(cards()[0]);
			midnight();
			fireEvent.focus(window);
			expect(screen.getByText('2026-10-05')).toBeInTheDocument();
			expect(cards()[0]).not.toHaveAttribute('aria-label', 'Hidden card');
		});

		it('labels New game as Restart, since it deals the same board', () => {
			renderCards();
			expect(screen.getByRole('button', { name: 'New game' })).toBeInTheDocument();
			pickMode('Daily');
			expect(screen.getByRole('button', { name: 'Restart' })).toBeInTheDocument();
			expect(screen.queryByRole('button', { name: 'New game' })).not.toBeInTheDocument();
		});

		it("doesn't overwrite a result another tab saved while this one was open", () => {
			const cards = renderCards();
			pickMode('Daily');
			const other = { date: '2026-10-05', moves: 11, time: 20_000, stars: 3, streak: 4, log: '1' };
			save('memory-daily', other);
			clearBoard(cards);

			expect(stored('memory-daily')).toEqual(other);
			expect(screen.getByRole('dialog')).toHaveTextContent('Practice cleared!');
			expect(unlock).not.toHaveBeenCalledWith('memory-daily');
		});

		it('shows the date and the fixed Medium board, and remembers the mode', () => {
			const cards = renderCards();
			pickMode('Daily');
			expect(screen.getByText("Today's challenge")).toBeInTheDocument();
			expect(screen.getByText('2026-10-05')).toBeInTheDocument();
			expect(cards()).toHaveLength(LEVELS.medium.pairs * 2);
			expect(screen.queryByRole('radiogroup', { name: 'Difficulty' })).not.toBeInTheDocument();
			expect(stored('memory-mode')).toBe('daily');
		});

		it('deals the same layout on every game of the day', () => {
			const cards = renderCards();
			pickMode('Daily');
			const layout = () => cards().map(face).join();
			const before = layout();
			fireEvent.click(screen.getByRole('button', { name: 'Restart' }));
			expect(layout()).toBe(before);
		});

		it('stores one result and unlocks the achievement, leaving the classic best alone', () => {
			const cards = renderCards();
			pickMode('Daily');
			clearBoard(cards);

			expect(stored('memory-daily')).toEqual({ date: '2026-10-05', moves: 10, time: 0, stars: 3, streak: 1, log: '1111111111' });
			expect(stored('memory-best')).toBeNull();
			expect(unlock).toHaveBeenCalledWith('memory-daily');
			expect(screen.getByRole('dialog', { name: 'Board cleared' })).toHaveTextContent('Come back tomorrow');
			expect(screen.getByLabelText('3 out of 3 stars')).toBeInTheDocument();
			// The pill hands over to the dialog instead of repeating it
			expect(screen.getAllByText('Come back tomorrow')).toHaveLength(1);
		});

		it('lets you replay without changing the result or the streak', () => {
			const cards = renderCards();
			pickMode('Daily');
			clearBoard(cards);
			const first = stored('memory-daily');
			vi.mocked(unlock).mockClear();

			fireEvent.click(screen.getByRole('button', { name: 'Practice again' }));
			expect(screen.getByText('Come back tomorrow')).toBeInTheDocument();
			missOnce(cards);
			vi.advanceTimersByTime(1000);
			clearBoard(cards);

			expect(screen.getByRole('dialog', { name: 'Board cleared' })).toHaveTextContent('Practice cleared!');
			expect(stored('memory-daily')).toEqual(first);
			expect(unlock).not.toHaveBeenCalledWith('memory-daily');
		});

		it('grows the streak on consecutive days and resets it after a gap', () => {
			const cards = renderCards();
			pickMode('Daily');
			clearBoard(cards);
			expect(stored('memory-daily').streak).toBe(1);

			nextDay(6);
			playDay(cards);
			expect(stored('memory-daily')).toMatchObject({ date: '2026-10-06', streak: 2 });
			nextDay(7);
			playDay(cards);
			expect(stored('memory-daily')).toMatchObject({ date: '2026-10-07', streak: 3 });
			expect(screen.getByRole('dialog')).toHaveTextContent('🔥3');

			nextDay(10); // two days skipped
			playDay(cards);
			expect(stored('memory-daily')).toMatchObject({ date: '2026-10-10', streak: 1 });
		});

		it('deals a new board on a new day', () => {
			const cards = renderCards();
			pickMode('Daily');
			const today = cards().map(face).join();
			nextDay(6);
			fireEvent.click(screen.getByRole('button', { name: 'Restart' }));
			expect(screen.getByText('2026-10-06')).toBeInTheDocument();
			expect(cards().map(face).join()).not.toBe(today);
		});

		it('shares the result with the emoji row and a link', () => {
			const cards = renderCards();
			pickMode('Daily');
			clearBoard(cards);
			fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Share' }));
			expect(shareResult).toHaveBeenCalledWith(
				`Memory Daily 2026-10-05 ⭐⭐⭐ 10 moves · 0:00 🔥1\n${'🟩'.repeat(10)}\n${location.origin}/memory-game`,
			);
		});

		it('keeps its result after a reload', () => {
			const cards = renderCards();
			pickMode('Daily');
			clearBoard(cards);
			cleanup();
			renderCards();
			expect(screen.getByText('Come back tomorrow')).toBeInTheDocument();
			expect(stat('Today')).toHaveTextContent('10 · 0:00');
		});
	});

	describe('peek', () => {
		it('flips every card for a second, ignores clicks meanwhile, then hides them', () => {
			const cards = renderCards();
			fireEvent.click(screen.getByRole('button', { name: /Peek/ }));
			expect(cards().every((card) => card.getAttribute('aria-label') !== 'Hidden card')).toBe(true);

			fireEvent.click(cards()[0]);
			fireEvent.click(cards().find((card, i) => i > 0 && face(card) === face(cards()[0])));
			expect(stat('Moves')).toHaveTextContent('0');

			vi.advanceTimersByTime(1000);
			expect(cards().every((card) => card.getAttribute('aria-label') === 'Hidden card')).toBe(true);
			fireEvent.click(cards()[0]);
			expect(cards()[0]).not.toHaveAttribute('aria-label', 'Hidden card');
		});

		it('can only be used once a game, and starts the clock', () => {
			renderCards();
			const button = screen.getByRole('button', { name: /Peek/ });
			expect(button).toHaveTextContent('−1★');
			fireEvent.click(button);
			expect(button).toBeDisabled();
			vi.advanceTimersByTime(3000);
			expect(stat('Time')).toHaveTextContent('0:03');

			fireEvent.click(screen.getByRole('button', { name: 'New game' }));
			expect(button).toBeEnabled();
		});

		it('costs a star, and says so', () => {
			const cards = renderCards();
			pickMode('Daily');
			fireEvent.click(screen.getByRole('button', { name: /Peek/ }));
			vi.advanceTimersByTime(1000);
			clearBoard(cards);

			expect(screen.getByLabelText('2 out of 3 stars')).toBeInTheDocument();
			expect(screen.getByRole('dialog')).toHaveTextContent('Peek used: −1★');
			expect(stored('memory-daily').stars).toBe(2);
		});

		it('never takes the last star, and still counts for Classic Hard', () => {
			const cards = renderCards();
			fireEvent.click(screen.getByRole('radio', { name: 'Easy' }));
			fireEvent.click(screen.getByRole('button', { name: /Peek/ }));
			vi.advanceTimersByTime(1000);
			// 7 misses make 13 moves, which is 1 star before the penalty
			for (let i = 0; i < 7; i++) {
				missOnce(cards);
				vi.advanceTimersByTime(1000);
			}
			clearBoard(cards);
			expect(screen.getByLabelText('1 out of 3 stars')).toBeInTheDocument();

			fireEvent.click(screen.getByRole('button', { name: 'Try Medium' }));
			fireEvent.click(screen.getByRole('radio', { name: 'Hard' }));
			fireEvent.click(screen.getByRole('button', { name: /Peek/ }));
			vi.advanceTimersByTime(1000);
			clearBoard(cards);
			expect(unlock).toHaveBeenCalledWith('memory-hard');
			expect(screen.getByLabelText('2 out of 3 stars')).toBeInTheDocument();
		});

		it('keeps peeked Classic games out of the best records', () => {
			const cards = renderCards();
			fireEvent.click(screen.getByRole('radio', { name: 'Easy' }));
			fireEvent.click(screen.getByRole('button', { name: /Peek/ }));
			vi.advanceTimersByTime(1000);
			clearBoard(cards);

			const dialog = screen.getByRole('dialog', { name: 'Board cleared' });
			expect(dialog).toHaveTextContent('Peek used: −1★, not eligible for best');
			expect(dialog).not.toHaveTextContent('best!');
			expect(stored('memory-best')).toBeNull();
			expect(stat('Best')).toHaveTextContent('—');
		});

		it('is not offered in Time Attack', () => {
			renderCards();
			pickMode('Time Attack');
			expect(screen.queryByRole('button', { name: /Peek/ })).not.toBeInTheDocument();
		});
	});

	describe('time attack', () => {
		const start = (level = 'Easy') => {
			const cards = renderCards();
			pickMode('Time Attack');
			fireEvent.click(screen.getByRole('radio', { name: level }));
			return cards;
		};

		it('counts down from the level limit once the first card is flipped', () => {
			const cards = start();
			expect(stat('Left')).toHaveTextContent('0:20');
			vi.advanceTimersByTime(5000);
			expect(stat('Left')).toHaveTextContent('0:20'); // not started yet
			fireEvent.click(cards()[0]);
			vi.advanceTimersByTime(3000);
			expect(stat('Left')).toHaveTextContent('0:17');
			expect(stored('memory-mode')).toBe('time');
		});

		it('adds 3 seconds for a match and takes 1 for a miss, with feedback', () => {
			const cards = start();
			const all = cards();
			const partner = all.find((card, i) => i !== 0 && face(card) === face(all[0]));
			fireEvent.click(all[0]);
			fireEvent.click(partner);
			expect(stat('Left')).toHaveTextContent('0:23');
			expect(screen.getByText('+3s')).toBeInTheDocument();

			const other = all.find((card) => face(card) !== face(all[0]));
			const another = all.find((card) => face(card) !== face(all[0]) && face(card) !== face(other));
			fireEvent.click(other);
			fireEvent.click(another);
			expect(stat('Left')).toHaveTextContent('0:22');
			expect(screen.getByText('−1s')).toBeInTheDocument();
			vi.advanceTimersByTime(1000);
			expect(screen.queryByText('−1s')).not.toBeInTheDocument();
		});

		it('ticks for each of the last five seconds', () => {
			const cards = start();
			fireEvent.click(cards()[0]);
			vi.advanceTimersByTime(14_000);
			expect(sounds()).not.toContain('tick');
			vi.advanceTimersByTime(5000);
			expect(sounds().filter((name) => name === 'tick')).toHaveLength(5);
		});

		it('loses at zero: locks the board, reveals the cards and says so', () => {
			const cards = start();
			fireEvent.click(cards()[0]);
			vi.advanceTimersByTime(20_000);

			expect(screen.getByRole('dialog', { name: "Time's up" })).toHaveTextContent("Time's up!");
			expect(stat('Left')).toHaveTextContent('0:00');
			expect(cards().every((card) => card.getAttribute('aria-label') !== 'Hidden card')).toBe(true);
			expect(sounds()).toContain('lose');
			expect(unlock).not.toHaveBeenCalled();

			fireEvent.click(cards()[1]);
			expect(stat('Moves')).toHaveTextContent('0');
			expect(stored('memory-time-attack')).toBeNull();

			fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
			expect(stat('Left')).toHaveTextContent('0:20');
			expect(cards().every((card) => card.getAttribute('aria-label') === 'Hidden card')).toBe(true);
		});

		it('loses when misses take the last second', () => {
			const cards = start();
			const all = cards();
			fireEvent.click(all[0]);
			vi.advanceTimersByTime(19_500);
			fireEvent.click(all.find((card) => face(card) !== face(all[0])));
			expect(screen.getByRole('dialog', { name: "Time's up" })).toBeInTheDocument();
		});

		it('wins by clearing the board, shows the time left and saves the best per level', () => {
			const cards = start();
			clearBoard(cards);

			expect(screen.getByRole('dialog', { name: 'Board cleared' })).toHaveTextContent('0:38 left');
			expect(stored('memory-time-attack')).toEqual({ easy: 38_000 });
			expect(stored('memory-best')).toBeNull();
			expect(unlock).toHaveBeenCalledWith('memory-time-attack');
			expect(sounds()).toContain('win');
			expect(stat('Best')).toHaveTextContent('0:38');
		});

		it('only replaces the best with a better time', () => {
			const cards = start();
			clearBoard(cards);
			fireEvent.click(screen.getByRole('button', { name: 'Play again' }));
			missOnce(cards);
			vi.advanceTimersByTime(1000);
			clearBoard(cards);
			expect(screen.getByRole('dialog')).not.toHaveTextContent('best!');
			expect(stored('memory-time-attack')).toEqual({ easy: 38_000 });
		});

		it('shares a short result without a streak', () => {
			const cards = start();
			clearBoard(cards);
			fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Share' }));
			expect(shareResult).toHaveBeenCalledWith(`Memory Time Attack Easy ⏱ 0:38 left · 6 moves\n${location.origin}/memory-game`);
		});
	});

	describe('classic extras', () => {
		it('shares a classic result and keeps the best', () => {
			const cards = renderCards();
			fireEvent.click(screen.getByRole('radio', { name: 'Easy' }));
			clearBoard(cards);
			fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Share' }));
			expect(shareResult).toHaveBeenCalledWith(`Memory Easy ⭐⭐⭐ 6 moves · 0:00\n${location.origin}/memory-game`);
			expect(stored('memory-best')).toEqual({ easy: { moves: 6, time: 0 } });
		});

		it('unlocks the combo achievement and the hard one for a Time Attack clear on Hard', () => {
			const cards = renderCards();
			pickMode('Time Attack');
			fireEvent.click(screen.getByRole('radio', { name: 'Hard' }));
			clearBoard(cards);
			expect(unlock).toHaveBeenCalledWith('memory-combo');
			expect(unlock).toHaveBeenCalledWith('memory-hard');
		});

		it('does not unlock the hard achievement below Hard', () => {
			const cards = renderCards();
			clearBoard(cards);
			expect(unlock).not.toHaveBeenCalledWith('memory-hard');
		});
	});

	describe('end screen accessibility', () => {
		it('focuses the first button and announces a win', () => {
			const cards = renderCards();
			fireEvent.click(screen.getByRole('radio', { name: 'Easy' }));
			clearBoard(cards);
			expect(screen.getByRole('button', { name: 'Play again' })).toHaveFocus();
			expect(screen.getByRole('status')).toHaveTextContent('Board cleared in 6 moves, 3 out of 3 stars.');
		});

		it('announces Time\'s up at once but focuses the dialog only once it has faded in', () => {
			const cards = renderCards();
			pickMode('Time Attack');
			fireEvent.click(screen.getByRole('radio', { name: 'Easy' }));
			fireEvent.click(cards()[0]);
			vi.advanceTimersByTime(20_000);

			expect(screen.getByRole('status')).toHaveTextContent("Time's up! 0 of 6 pairs found.");
			const retry = screen.getByRole('button', { name: 'Try again' });
			expect(retry).not.toHaveFocus();
			vi.advanceTimersByTime(1800);
			expect(retry).not.toHaveFocus();
			vi.advanceTimersByTime(100);
			expect(retry).toHaveFocus();
		});

		it('does not steal focus later if the game was restarted in the meantime', () => {
			const cards = renderCards();
			pickMode('Time Attack');
			fireEvent.click(cards()[0]);
			vi.advanceTimersByTime(30_000);
			fireEvent.click(screen.getByRole('button', { name: 'New game' }));
			vi.advanceTimersByTime(5000);
			expect(document.body).toHaveFocus();
			expect(screen.getByRole('status').textContent).toBe('');
		});
	});

	describe('sound', () => {
		it('plays flip, match, miss and win sounds', () => {
			const cards = renderCards();
			fireEvent.click(screen.getByRole('radio', { name: 'Easy' }));
			missOnce(cards);
			expect(sounds()).toEqual(['flip', 'flip', 'miss']);
			vi.advanceTimersByTime(1000);

			playSound.mockClear();
			clearBoard(cards);
			expect(sounds().filter((name) => name === 'match')).toHaveLength(LEVELS.easy.pairs);
			expect(sounds().filter((name) => name === 'flip')).toHaveLength(LEVELS.easy.pairs * 2);
			expect(sounds().at(-1)).toBe('win');
		});

		it('has a sound toggle', () => {
			renderCards();
			expect(screen.getByRole('button', { name: 'Sound' })).toBeInTheDocument();
		});
	});

	it('cleans up every timer when it unmounts', () => {
		const { unmount } = render(() => <MemoryGame />);
		pickMode('Time Attack');
		fireEvent.click(document.querySelector('.mg-card'));
		fireEvent.click(document.querySelectorAll('.mg-card')[1]);
		unmount();
		expect(vi.getTimerCount()).toBe(0);
	});
});
