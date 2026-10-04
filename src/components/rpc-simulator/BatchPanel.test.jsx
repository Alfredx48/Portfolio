import { fireEvent, render, screen } from '@solidjs/testing-library';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetAchievements, unlocked } from '../../state/achievements';
import BatchPanel from './BatchPanel';

const state = vi.hoisted(() => ({ made: 0, delay: 0 }));

// Games finish after `state.delay` extra advances (none by default): rock wins unless it's the 3rd game, which scissors wins
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
		BATCH_DT: 1 / 30,
		createGame: vi.fn(() => {
			const winner = ++state.made % 3 === 0 ? 'scissors' : 'rock';
			const entities = [{ type: 'rock' }, { type: 'rock' }, { type: 'paper' }, { type: 'scissors' }];
			let calls = 0;
			return { entities, advance: () => (++calls > state.delay ? record(winner) : null) };
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

	const flush = (time = 0) => {
		const callbacks = queue;
		queue = [];
		callbacks.forEach((cb) => cb(time));
	};
	const setup = (props = {}) => {
		const onStart = vi.fn();
		const drawBoard = vi.fn();
		const onWatchChange = vi.fn();
		render(() => (
			<BatchPanel
				count={() => 7}
				boardSize={() => ({ width: 400, height: 300 })}
				onStart={onStart}
				drawBoard={drawBoard}
				onWatchChange={onWatchChange}
				{...props}
			/>
		));
		return { onStart, drawBoard, onWatchChange };
	};
	const watchBox = () => screen.getByLabelText('Watch the games');
	const runs = () => screen.getByLabelText('Simulations');

	beforeEach(() => {
		localStorage.clear();
		resetAchievements();
		createGame.mockClear();
		state.made = 0;
		state.delay = 0;
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

	describe('watching', () => {
		const lastState = (fn) => fn.mock.calls.at(-1)[0];

		it('is off by default and only shows the speed once watching', () => {
			setup();
			expect(watchBox()).not.toBeChecked();
			expect(screen.queryByRole('radiogroup', { name: 'Watch speed' })).not.toBeInTheDocument();

			fireEvent.click(watchBox());
			expect(screen.getByRole('radio', { name: '4×' })).toHaveAttribute('aria-checked', 'true');
			fireEvent.click(screen.getByRole('radio', { name: '16×' }));
			expect(screen.getByRole('radio', { name: '16×' })).toHaveAttribute('aria-checked', 'true');
		});

		it('does not draw or report when headless', () => {
			const { drawBoard, onWatchChange } = setup();
			fireEvent.click(screen.getByRole('button', { name: 'Run' }));
			flush(100);
			expect(drawBoard).not.toHaveBeenCalled();
			expect(onWatchChange).not.toHaveBeenCalled();
		});

		it('draws the game and reports its progress each frame', () => {
			state.delay = 2;
			const { drawBoard, onWatchChange } = setup();
			fireEvent.click(watchBox());
			fireEvent.change(runs(), { target: { value: '3' } });
			fireEvent.click(screen.getByRole('button', { name: 'Run' }));

			flush(0); // the first frame has no elapsed time
			expect(drawBoard).toHaveBeenCalledTimes(1);
			expect(drawBoard.mock.calls[0][0]).toBe(createGame.mock.results[0].value.entities);
			expect(lastState(onWatchChange)).toEqual({
				index: 1,
				total: 3,
				counts: { rock: 2, paper: 1, scissors: 1 },
				holding: false,
				lastWinner: null,
			});

			flush(100);
			expect(drawBoard).toHaveBeenCalledTimes(2);
			expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
		});

		it('advances by speed * elapsed / dt and carries the remainder', () => {
			const advance = vi.fn(() => null);
			createGame.mockReturnValueOnce({ entities: [], advance });
			setup();
			fireEvent.click(watchBox());
			fireEvent.click(screen.getByRole('radio', { name: '1×' }));
			fireEvent.click(screen.getByRole('button', { name: 'Run' }));

			flush(0);
			expect(advance).not.toHaveBeenCalled();
			flush(10); // 0.01s at 1x is 0.3 of a 1/30s step
			expect(advance).not.toHaveBeenCalled();
			flush(20);
			flush(30);
			flush(40); // 0.4 steps in total, then 0.7, 1.0
			expect(advance).toHaveBeenCalledTimes(1);
			expect(advance).toHaveBeenCalledWith(1);
			fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
		});

		it('caps long frames at 1/30s', () => {
			const advance = vi.fn(() => null);
			createGame.mockReturnValueOnce({ entities: [], advance });
			setup();
			fireEvent.click(watchBox());
			fireEvent.click(screen.getByRole('radio', { name: '16×' }));
			fireEvent.click(screen.getByRole('button', { name: 'Run' }));
			flush(0);
			flush(5000);
			expect(advance).toHaveBeenCalledWith(16);
			fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
		});

		it('holds the finished board between games at 4x, then moves on', () => {
			const { onWatchChange } = setup();
			fireEvent.click(watchBox());
			fireEvent.change(runs(), { target: { value: '2' } });
			fireEvent.click(screen.getByRole('button', { name: 'Run' }));
			flush(0);
			flush(100); // game 1 finishes
			expect(lastState(onWatchChange)).toMatchObject({ index: 1, holding: true, lastWinner: 'rock' });
			expect(createGame).toHaveBeenCalledTimes(1);

			flush(500);
			expect(lastState(onWatchChange)).toMatchObject({ index: 1, holding: true });
			flush(900); // 700ms hold is over
			expect(createGame).toHaveBeenCalledTimes(2);
			flush(1000);
			expect(lastState(onWatchChange)).toMatchObject({ index: 2, holding: true });

			flush(1800);
			expect(onWatchChange).toHaveBeenLastCalledWith(null);
			expect(screen.getByText('Results from 2 runs.')).toBeInTheDocument();
		});

		it('skips the hold above 4x', () => {
			setup();
			fireEvent.click(watchBox());
			fireEvent.click(screen.getByRole('radio', { name: '16×' }));
			fireEvent.change(runs(), { target: { value: '2' } });
			fireEvent.click(screen.getByRole('button', { name: 'Run' }));
			flush(0);
			flush(100);
			expect(createGame).toHaveBeenCalledTimes(2);
		});

		it('keeps going headless with the same games when watching is switched off mid-run', () => {
			state.delay = 1;
			const { drawBoard, onWatchChange } = setup();
			fireEvent.click(watchBox());
			fireEvent.change(runs(), { target: { value: '4' } });
			fireEvent.click(screen.getByRole('button', { name: 'Run' }));
			flush(0);
			flush(100);
			expect(drawBoard).toHaveBeenCalledTimes(2);
			expect(createGame).toHaveBeenCalledTimes(1);

			fireEvent.click(watchBox());
			flush(200); // game 1 is held; it's recorded straight away and the rest run at full speed
			expect(onWatchChange).toHaveBeenLastCalledWith(null);
			expect(drawBoard).toHaveBeenCalledTimes(2);
			expect(createGame).toHaveBeenCalledTimes(4);
			flush(300);
			expect(screen.getByText('Results from 4 runs.')).toBeInTheDocument();
			expect(drawBoard).toHaveBeenCalledTimes(2);
		});

		it('starts drawing the current game when watching is switched on mid-run', () => {
			state.delay = Infinity;
			const { drawBoard, onWatchChange } = setup();
			fireEvent.click(screen.getByRole('button', { name: 'Run' }));
			flush(0);
			expect(drawBoard).not.toHaveBeenCalled();

			fireEvent.click(watchBox());
			flush(100);
			expect(drawBoard).toHaveBeenCalledTimes(1);
			expect(lastState(onWatchChange)).toMatchObject({ index: 1, total: 20 });
			fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
		});

		it('reports null when cancelled', () => {
			state.delay = Infinity;
			const { onWatchChange } = setup();
			fireEvent.click(watchBox());
			fireEvent.click(screen.getByRole('button', { name: 'Run' }));
			flush(0);
			expect(lastState(onWatchChange)).not.toBeNull();

			fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
			expect(onWatchChange).toHaveBeenLastCalledWith(null);
		});
	});
});
