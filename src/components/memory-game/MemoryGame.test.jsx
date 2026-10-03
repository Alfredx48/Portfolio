import { fireEvent, render, screen } from '@solidjs/testing-library';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDeck, formatTime, LEVELS, LOGOS, starsFor } from './deck';
import MemoryGame from './MemoryGame';

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
		vi.useFakeTimers();
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
});
