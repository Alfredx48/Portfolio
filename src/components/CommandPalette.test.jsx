import { MemoryRouter, Route, useLocation } from '@solidjs/router';
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetAchievements } from '../state/achievements';
import { paletteOpen, setPaletteOpen } from '../state/ui';
import CommandPalette from './CommandPalette';

function Where() {
	const location = useLocation();
	return <p data-testid="path">{location.pathname}</p>;
}

const renderPalette = () =>
	render(() => (
		<MemoryRouter
			root={(props) => (
				<>
					<CommandPalette />
					{props.children}
				</>
			)}
		>
			<Route path="*" component={Where} />
		</MemoryRouter>
	));

const choose = (query, name) => {
	setPaletteOpen(true);
	fireEvent.input(screen.getByRole('combobox'), { target: { value: query } });
	fireEvent.click(screen.getByRole('option', { name: new RegExp(name) }));
};

describe('CommandPalette', () => {
	beforeEach(() => {
		// jsdom doesn't implement it, and the palette scrolls the highlighted option into view
		Element.prototype.scrollIntoView = () => {};
		localStorage.clear();
		resetAchievements();
	});
	afterEach(() => {
		setPaletteOpen(false);
		cleanup();
	});

	it.each([
		['ultimate', 'Ultimate TicTacToe', '/tictactoe/ultimate'],
		['friend', 'Play a friend online', '/tictactoe/online'],
		['daily', 'Memory daily challenge', '/memory-game'],
		['stats', 'Games & stats', '/games'],
	])('offers "%s" under Play and navigates', async (query, label, path) => {
		renderPalette();
		choose(query, label);
		expect(await screen.findByText(path, { selector: '[data-testid="path"]' })).toBeInTheDocument();
		expect(paletteOpen()).toBe(false);
	});

	it('opens the Memory Game on the daily board', () => {
		renderPalette();
		choose('daily', 'Memory daily challenge');
		expect(JSON.parse(localStorage.getItem('alfred-portfolio:memory-mode'))).toBe('daily');
	});
});
