import { MemoryRouter, Route } from '@solidjs/router';
import { cleanup, fireEvent, render, screen, within } from '@solidjs/testing-library';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetAchievements, unlock } from '../../state/achievements';
import { dateKey } from '../memory-game/daily';
import GamesHub from './GamesHub';

const renderHub = () =>
	render(() => (
		<MemoryRouter>
			<Route path="/" component={GamesHub} />
		</MemoryRouter>
	));

const seed = (key, value) => localStorage.setItem(`alfred-portfolio:${key}`, JSON.stringify(value));
const card = (name) => screen.getByRole('heading', { level: 2, name }).closest('li');

describe('GamesHub', () => {
	beforeEach(() => {
		localStorage.clear();
		resetAchievements();
	});
	afterEach(cleanup);

	it('sets the page title', () => {
		renderHub();
		expect(document.title).toBe('Games | Alfred Shaheen');
	});

	it('has a card with a play link for every game', () => {
		renderHub();
		const links = {
			TicTacToe: '/tictactoe',
			'Ultimate TicTacToe': '/tictactoe/ultimate',
			'Online TicTacToe': '/tictactoe/online',
			'Memory Game': '/memory-game',
			'RPC Simulator': '/rpc-simulator',
		};
		for (const [name, href] of Object.entries(links)) {
			expect(within(card(name)).getByRole('link', { name: `Play ${name}` })).toHaveAttribute('href', href);
		}
	});

	it('invites a first game when nothing is stored, and never crashes', () => {
		renderHub();
		expect(within(card('TicTacToe')).getByText(/Not played yet/)).toBeInTheDocument();
		expect(within(card('Memory Game')).getByText(/Not played yet/)).toBeInTheDocument();
		expect(within(card('Online TicTacToe')).getByText(/Nothing to save here/)).toBeInTheDocument();
		expect(within(card('Memory Game')).getByText('0 / 4 achievements')).toBeInTheDocument();
	});

	it('copes with malformed saved data', () => {
		for (const key of ['ttt-scores', 'uttt-scores', 'memory-best', 'memory-daily', 'memory-time-attack', 'rpc-best-streak']) seed(key, 'garbage');
		expect(() => renderHub()).not.toThrow();
		expect(within(card('RPC Simulator')).getByText(/No bets yet/)).toBeInTheDocument();
	});

	it('shows saved stats on the cards', () => {
		seed('ttt-scores', { 'ai-medium': { a: 7, b: 2, draws: 1 } });
		seed('rpc-best-streak', 4);
		renderHub();
		const ttt = within(card('TicTacToe'));
		expect(ttt.getByText('Wins vs AI').nextSibling).toHaveTextContent('7');
		expect(ttt.getByText('Medium')).toBeInTheDocument();
		expect(within(card('RPC Simulator')).getByText('4 wins')).toBeInTheDocument();
	});

	it('shows achievement progress and only the titles that are unlocked', () => {
		unlock('ttt-beat-medium');
		unlock('ttt-ultimate');
		renderHub();
		const ttt = within(card('TicTacToe'));
		expect(ttt.getByText('1 / 5 achievements')).toBeInTheDocument();
		expect(ttt.getByText('Outsmarted')).toBeInTheDocument();
		expect(ttt.queryByText('Big Picture')).not.toBeInTheDocument();
		expect(within(card('Ultimate TicTacToe')).getByText('1 / 1 achievement')).toBeInTheDocument();
		expect(within(card('Ultimate TicTacToe')).getByText('Big Picture')).toBeInTheDocument();
	});

	it('calls out the daily challenge until it is done', () => {
		renderHub();
		expect(screen.getByRole('heading', { name: 'Today’s Memory challenge is waiting' })).toBeInTheDocument();
	});

	it('asks for the daily mode when you follow the callout', () => {
		renderHub();
		fireEvent.click(screen.getByRole('link', { name: /Play today’s/ }));
		expect(JSON.parse(localStorage.getItem('alfred-portfolio:memory-mode'))).toBe('daily');
	});

	it('shows a done state with the result once today’s daily is finished', () => {
		seed('memory-daily', { date: dateKey(), moves: 18, time: 61000, stars: 3, streak: 4 });
		renderHub();
		expect(screen.getByRole('heading', { name: 'Today’s Memory challenge is done' })).toBeInTheDocument();
		expect(screen.getByText(/18 moves in 1:01 · 4-day streak/)).toBeInTheDocument();
	});
});
