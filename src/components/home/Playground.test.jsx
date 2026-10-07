import { MemoryRouter, Route } from '@solidjs/router';
import { cleanup, render, screen } from '@solidjs/testing-library';
import { afterEach, describe, expect, it } from 'vitest';
import playgroundData from '../../data/playgroundData';
import Playground from './Playground';

const renderPlayground = () =>
	render(() => (
		<MemoryRouter>
			<Route path="/" component={Playground} />
		</MemoryRouter>
	));

describe('Playground', () => {
	afterEach(cleanup);

	it('links to every game in the list, including Ultimate and Online', () => {
		renderPlayground();
		// Names overlap ("Tic-Tac-Toe" is in three of them), so match on the whole name
		for (const game of playgroundData) {
			const link = screen.getByText(game.name, { selector: '.card-title' }).closest('a');
			expect(link).toHaveAttribute('href', game.href);
		}
		expect(playgroundData.map((g) => g.href)).toEqual(expect.arrayContaining(['/tictactoe/ultimate', '/tictactoe/online']));
	});

	it('links to the games hub', () => {
		renderPlayground();
		expect(screen.getByRole('link', { name: /All games & stats/ })).toHaveAttribute('href', '/games');
	});
});
