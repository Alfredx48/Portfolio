import { fireEvent, render, screen } from '@solidjs/testing-library';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetAchievements, unlocked } from '../../state/achievements';
import BatchPanel from './BatchPanel';

const state = vi.hoisted(() => ({ made: 0 }));

// Games finish on the first advance: rock wins unless it's the 3rd game, which scissors wins
vi.mock('./batch', () => {
	const record = (winner) => ({
		winner,
		duration: 10,
		firstEliminated: 'scissors',
		leaderAtHalf: 'rock',
		leadChanges: 1,
		winnerMin: 4,
		lastAtHalf: null,
	});
	return {
		MAX_RUNS: 100,
		createGame: vi.fn(() => {
			const winner = ++state.made % 3 === 0 ? 'scissors' : 'rock';
			return { advance: () => record(winner) };
		}),
		summarize: (records) => {
			const wins = { rock: 0, paper: 0, scissors: 0 };
			for (const r of records) wins[r.winner]++;
			const rate = (n) => n / records.length;
			return {
				runs: records.length,
				decided: records.length,
				draws: 0,
				wins,
				winRate: { rock: rate(wins.rock), paper: rate(wins.paper), scissors: rate(wins.scissors) },
				leader: wins.rock > wins.scissors ? 'rock' : null,
				duration: { mean: 10, median: 10, min: 10, max: 10 },
				fastest: { index: 0, winner: records[0].winner, duration: 10 },
				slowest: { index: 0, winner: records[0].winner, duration: 10 },
				avgLeadChanges: 1,
				comebacks: 0,
			};
		},
		insights: (summary) => [`Fake insight over ${summary.runs} runs`],
	};
});

const { createGame } = await import('./batch');

describe('BatchPanel', () => {
	let queue;

	const flush = () => {
		const callbacks = queue;
		queue = [];
		callbacks.forEach((cb) => cb(0));
	};
	const setup = (props = {}) => {
		const onStart = vi.fn();
		render(() => <BatchPanel count={() => 7} boardSize={() => ({ width: 400, height: 300 })} onStart={onStart} {...props} />);
		return { onStart };
	};
	const runs = () => screen.getByLabelText('Simulations');

	beforeEach(() => {
		localStorage.clear();
		resetAchievements();
		createGame.mockClear();
		state.made = 0;
		queue = [];
		vi.stubGlobal('requestAnimationFrame', (cb) => queue.push(cb));
		vi.stubGlobal('cancelAnimationFrame', () => (queue = []));
	});
	afterEach(() => vi.unstubAllGlobals());

	it('starts with 20 simulations and no results', () => {
		setup();
		expect(runs()).toHaveValue(20);
		expect(screen.getByRole('heading', { name: 'Simulate many' })).toBeInTheDocument();
		expect(screen.queryByText('Insights')).not.toBeInTheDocument();
	});

	it('runs the batch and shows win counts, stats and insights', () => {
		const { onStart } = setup();
		fireEvent.change(runs(), { target: { value: '6' } });
		fireEvent.click(screen.getByRole('button', { name: 'Run' }));
		expect(onStart).toHaveBeenCalled();
		expect(createGame).toHaveBeenCalledWith({ countPerType: 7, width: 400, height: 300 });

		flush();
		expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
		expect(screen.getByText('Results from 6 runs.')).toBeInTheDocument();
		expect(screen.getByText('4 wins · 67%')).toBeInTheDocument();
		expect(screen.getByText('0 wins · 0%')).toBeInTheDocument();
		expect(screen.getByText('2 wins · 33%')).toBeInTheDocument();
		expect(screen.getByText('Fake insight over 6 runs')).toBeInTheDocument();
		expect(screen.getByText('Avg length')).toBeInTheDocument();
		expect(screen.queryByText('Draws')).not.toBeInTheDocument();
		expect(screen.getAllByRole('row')).toHaveLength(7); // header + 6 runs
	});

	it('clamps the number of simulations to 1-100', () => {
		setup();
		fireEvent.change(runs(), { target: { value: '500' } });
		expect(runs()).toHaveValue(100);
		fireEvent.change(runs(), { target: { value: '0' } });
		expect(runs()).toHaveValue(1);
	});

	it('shows progress and keeps partial results when cancelled', () => {
		vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(100).mockReturnValue(0);
		setup();
		fireEvent.change(runs(), { target: { value: '10' } });
		fireEvent.click(screen.getByRole('button', { name: 'Run' }));
		expect(runs()).toBeDisabled();

		// The time budget runs out after one game
		flush();
		const bar = screen.getByRole('progressbar');
		expect(bar).toHaveAttribute('aria-valuenow', '1');
		expect(screen.getByText('Simulating 1 / 10…')).toBeInTheDocument();

		fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
		expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
		expect(queue).toHaveLength(0);
		expect(screen.getByText(/Partial results: 1 run finished/)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Run' })).toBeInTheDocument();
		vi.restoreAllMocks();
	});

	it('shows no results when cancelled before any game finished', () => {
		setup();
		fireEvent.click(screen.getByRole('button', { name: 'Run' }));
		expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
		fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
		expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
		expect(screen.queryByText('Insights')).not.toBeInTheDocument();
	});

	it('unlocks Statistician after a full batch of 100', () => {
		setup();
		fireEvent.change(runs(), { target: { value: '99' } });
		fireEvent.click(screen.getByRole('button', { name: 'Run' }));
		flush();
		expect(unlocked().has('rpc-statistician')).toBe(false);

		fireEvent.change(runs(), { target: { value: '100' } });
		fireEvent.click(screen.getByRole('button', { name: 'Run' }));
		flush();
		expect(unlocked().has('rpc-statistician')).toBe(true);
	});
});
