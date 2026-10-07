import { cleanup, fireEvent, render, screen, within } from '@solidjs/testing-library';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetAchievements, unlocked } from '../../state/achievements';
import { shareResult } from '../../utils/share';
import { playSound } from '../../utils/sound';
import { toast } from '../../utils/toast';
import Rpc from './Rpc';

vi.mock('../../utils/sound', async (importOriginal) => ({ ...(await importOriginal()), playSound: vi.fn() }));
vi.mock('../../utils/share', () => ({ shareResult: vi.fn() }));
vi.mock('../../utils/toast', () => ({ toast: vi.fn() }));

describe('Rpc', () => {
	beforeEach(() => {
		localStorage.clear();
		resetAchievements();
		vi.clearAllMocks();
	});

	const board = () => screen.getByRole('img', { name: /^Simulation:/ });

	it('starts with 10 of each type on the board', () => {
		render(() => <Rpc />);
		expect(board()).toHaveAccessibleName('Simulation: 10 rocks, 10 papers, 10 scissors');
	});

	it('toggles between Start, Pause and Resume', () => {
		render(() => <Rpc />);
		fireEvent.click(screen.getByRole('button', { name: 'Start' }));
		expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
		expect(screen.getByLabelText('Count per type')).toBeDisabled();

		fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
		expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument();
	});

	it('changes the population when the count changes', () => {
		render(() => <Rpc />);
		fireEvent.change(screen.getByLabelText('Count per type'), { target: { value: '25' } });
		expect(board()).toHaveAccessibleName('Simulation: 25 rocks, 25 papers, 25 scissors');
	});

	it('caps the count at 100', () => {
		render(() => <Rpc />);
		const input = screen.getByLabelText('Count per type');
		fireEvent.change(input, { target: { value: '500' } });
		expect(input).toHaveValue(100);
		expect(board()).toHaveAccessibleName(/100 rocks/);
	});

	it('speeds up, slows down and resets the speed', () => {
		render(() => <Rpc />);
		fireEvent.click(screen.getByRole('button', { name: 'Increase speed' }));
		expect(screen.getByTitle('Reset speed')).toHaveTextContent('1.5×');

		fireEvent.click(screen.getByRole('button', { name: 'Decrease speed' }));
		fireEvent.click(screen.getByRole('button', { name: 'Decrease speed' }));
		expect(screen.getByTitle('Reset speed')).toHaveTextContent('0.67×');

		fireEvent.click(screen.getByTitle('Reset speed'));
		expect(screen.getByTitle('Reset speed')).toHaveTextContent('1×');
	});

	it('drops the selected piece where you click', () => {
		render(() => <Rpc />);
		fireEvent.click(screen.getByRole('radio', { name: 'Drop scissors' }));
		fireEvent.pointerDown(board(), { clientX: 100, clientY: 100 });
		fireEvent.pointerDown(board(), { clientX: 200, clientY: 120 });
		expect(board()).toHaveAccessibleName('Simulation: 10 rocks, 10 papers, 12 scissors');
	});

	it('renders the Simulate many panel', () => {
		render(() => <Rpc />);
		expect(screen.getByRole('heading', { name: 'Simulate many' })).toBeInTheDocument();
		expect(screen.getByLabelText('Simulations')).toHaveValue(20);
	});

	it('locks your bet while a round is running', () => {
		render(() => <Rpc />);
		const paper = screen.getByRole('radio', { name: /Paper/ });
		fireEvent.click(paper);
		expect(paper).toHaveAttribute('aria-checked', 'true');
		expect(screen.getByText(/🔥/)).toHaveTextContent('🔥 0');

		fireEvent.click(screen.getByRole('button', { name: 'Start' }));
		expect(paper).toBeDisabled();
	});

	describe('watching a batch', () => {
		let queue;
		const flush = (time) => {
			const callbacks = queue;
			queue = [];
			callbacks.forEach((cb) => cb(time));
		};

		beforeEach(() => {
			queue = [];
			vi.stubGlobal('requestAnimationFrame', (cb) => queue.push(cb));
			vi.stubGlobal('cancelAnimationFrame', () => (queue = []));
		});
		afterEach(() => vi.unstubAllGlobals());

		it('offers a Watch the games toggle with a speed once on', () => {
			render(() => <Rpc />);
			expect(screen.getByLabelText('Watch the games')).not.toBeChecked();
			expect(screen.queryByRole('radiogroup', { name: 'Watch speed' })).not.toBeInTheDocument();
			fireEvent.click(screen.getByLabelText('Watch the games'));
			expect(screen.getByRole('radiogroup', { name: 'Watch speed' })).toBeInTheDocument();
		});

		it('shows an overlay, locks the controls and restores them afterwards', () => {
			render(() => <Rpc />);
			fireEvent.click(screen.getByLabelText('Watch the games'));
			fireEvent.click(screen.getByRole('button', { name: 'Run' }));
			flush(0);
			flush(100);

			expect(screen.getByText(/^Simulation 1 \/ 20 · 🪨 \d+ 🧻 \d+ ✂️ \d+$/)).toBeInTheDocument();
			expect(screen.getByRole('img', { name: /^Simulation game 1 of 20:/ })).toBeInTheDocument();
			expect(screen.getByRole('button', { name: 'Start' })).toBeDisabled();
			expect(screen.getByLabelText('Count per type')).toBeDisabled();

			// Clicks on the board are ignored
			const batchBoard = screen.getByRole('img', { name: /^Simulation game/ });
			const label = batchBoard.getAttribute('aria-label');
			fireEvent.pointerDown(batchBoard, { clientX: 100, clientY: 100 });
			expect(batchBoard).toHaveAccessibleName(label);
			expect(label.match(/\d+/g).reduce((a, n) => a + +n, 0)).toBe(1 + 20 + 30);

			fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
			expect(screen.queryByText(/^Simulation 1 \//)).not.toBeInTheDocument();
			expect(board()).toHaveAccessibleName('Simulation: 10 rocks, 10 papers, 10 scissors');
			expect(screen.getByRole('button', { name: /Start|Resume/ })).toBeEnabled();
			expect(screen.getByLabelText('Count per type')).toBeEnabled();
		});
	});
	describe('rules', () => {
		it('offers Classic and Lizard-Spock, and starts on Classic', () => {
			render(() => <Rpc />);
			expect(screen.getByRole('radio', { name: 'Classic' })).toHaveAttribute('aria-checked', 'true');
			expect(screen.getByRole('radio', { name: 'Lizard-Spock' })).toHaveAttribute('aria-checked', 'false');
		});

		it('puts five types on the board, in the bets and in the brush', () => {
			render(() => <Rpc />);
			fireEvent.click(screen.getByRole('radio', { name: 'Lizard-Spock' }));
			expect(board()).toHaveAccessibleName('Simulation: 10 rocks, 10 papers, 10 scissors, 10 lizards, 10 Spocks');
			expect(screen.getByRole('radio', { name: 'Bet on lizard' })).toBeInTheDocument();
			expect(screen.getByRole('radio', { name: 'Bet on spock' })).toBeInTheDocument();
			expect(screen.getByLabelText('On the board')).toHaveTextContent(/Lizard 10.*Spock 10/);

			fireEvent.click(screen.getByRole('radio', { name: 'Drop spock' }));
			fireEvent.pointerDown(board(), { clientX: 100, clientY: 100 });
			expect(board()).toHaveAccessibleName(/10 lizards, 11 Spocks/);
		});

		it('resets the round when the rules change, and remembers them', () => {
			const { unmount } = render(() => <Rpc />);
			fireEvent.change(screen.getByLabelText('Count per type'), { target: { value: '4' } });
			fireEvent.click(screen.getByRole('button', { name: 'Start' }));
			fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
			expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument();

			fireEvent.click(screen.getByRole('radio', { name: 'Lizard-Spock' }));
			expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
			expect(board()).toHaveAccessibleName('Simulation: 4 rocks, 4 papers, 4 scissors, 4 lizards, 4 Spocks');

			unmount();
			render(() => <Rpc />);
			expect(screen.getByRole('radio', { name: 'Lizard-Spock' })).toHaveAttribute('aria-checked', 'true');
		});

		it('unlocks Bazinga when a Lizard-Spock round starts, not before or in Classic', () => {
			render(() => <Rpc />);
			fireEvent.click(screen.getByRole('button', { name: 'Start' }));
			fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
			expect(unlocked().has('rpc-lizard-spock')).toBe(false);

			fireEvent.click(screen.getByRole('radio', { name: 'Lizard-Spock' }));
			expect(unlocked().has('rpc-lizard-spock')).toBe(false);
			fireEvent.click(screen.getByRole('button', { name: 'Start' }));
			expect(unlocked().has('rpc-lizard-spock')).toBe(true);
		});

		it('locks the rules while a round is running', () => {
			render(() => <Rpc />);
			fireEvent.click(screen.getByRole('button', { name: 'Start' }));
			expect(screen.getByRole('radio', { name: 'Lizard-Spock' })).toBeDisabled();
		});
	});

	describe('sandbox', () => {
		const panel = () => document.getElementById('rpc-sandbox');
		const toggle = () => screen.getByRole('button', { name: 'Sandbox' });
		const slide = (name, value) => fireEvent.input(screen.getByLabelText(name), { target: { value } });

		it('is a collapsed Sandbox button by default, with no badge', () => {
			render(() => <Rpc />);
			expect(toggle()).toHaveAttribute('aria-expanded', 'false');
			expect(panel()).toHaveAttribute('hidden');
			expect(screen.queryByText('Custom rules')).not.toBeInTheDocument();
		});

		it('opens and closes the panel from the controls row', () => {
			render(() => <Rpc />);
			fireEvent.click(toggle());
			expect(toggle()).toHaveAttribute('aria-expanded', 'true');
			expect(panel()).not.toHaveAttribute('hidden');
			fireEvent.click(toggle());
			expect(panel()).toHaveAttribute('hidden');
		});

		it('has sliders for every type in play plus the interaction radius', () => {
			render(() => <Rpc />);
			for (const type of ['Rock', 'Paper', 'Scissors']) {
				expect(screen.getByLabelText(`${type} speed`)).toHaveValue('1');
				expect(screen.getByLabelText(`${type} starting count`)).toHaveValue('10');
			}
			expect(screen.queryByLabelText('Lizard speed')).not.toBeInTheDocument();
			expect(screen.getByLabelText('Interaction radius')).toHaveValue('1');
			expect(screen.getByLabelText('Rock speed')).toHaveAttribute('min', '0.25');
			expect(screen.getByLabelText('Rock speed')).toHaveAttribute('max', '3');
			expect(screen.getByLabelText('Interaction radius')).toHaveAttribute('min', '0.5');
			expect(screen.getByLabelText('Interaction radius')).toHaveAttribute('max', '2');

			fireEvent.click(screen.getByRole('radio', { name: 'Lizard-Spock' }));
			expect(screen.getByLabelText('Spock speed')).toBeInTheDocument();
		});

		it('shows a Custom rules badge once anything differs, and Reset to defaults clears it', () => {
			render(() => <Rpc />);
			fireEvent.click(toggle());
			const reset = screen.getByRole('button', { name: 'Reset to defaults' });
			expect(reset).toBeDisabled();

			slide('Paper speed', '2');
			expect(screen.getByText('Custom rules')).toBeInTheDocument();
			expect(reset).toBeEnabled();
			slide('Interaction radius', '1.5');
			slide('Scissors starting count', '3');

			fireEvent.click(reset);
			expect(screen.queryByText('Custom rules')).not.toBeInTheDocument();
			expect(screen.getByLabelText('Paper speed')).toHaveValue('1');
			expect(screen.getByLabelText('Interaction radius')).toHaveValue('1');
			expect(screen.getByLabelText('Scissors starting count')).toHaveValue('10');
			expect(board()).toHaveAccessibleName('Simulation: 10 rocks, 10 papers, 10 scissors');
		});

		it('sets a type\'s starting count for the next round', () => {
			render(() => <Rpc />);
			slide('Scissors starting count', '3');
			slide('Rock starting count', '25');
			expect(board()).toHaveAccessibleName('Simulation: 25 rocks, 10 papers, 3 scissors');
		});

		it('follows the Count per type control for types without their own count', () => {
			render(() => <Rpc />);
			slide('Scissors starting count', '3');
			fireEvent.change(screen.getByLabelText('Count per type'), { target: { value: '6' } });
			expect(board()).toHaveAccessibleName('Simulation: 6 rocks, 6 papers, 3 scissors');
			expect(screen.getByLabelText('Paper starting count')).toHaveValue('6');
		});

		it('keeps the speed and radius sliders live but locks the counts during a round', () => {
			render(() => <Rpc />);
			fireEvent.click(screen.getByRole('button', { name: 'Start' }));
			expect(screen.getByLabelText('Rock starting count')).toBeDisabled();
			expect(screen.getByLabelText('Rock speed')).toBeEnabled();
			expect(screen.getByLabelText('Interaction radius')).toBeEnabled();
		});

		it('remembers the settings', () => {
			const { unmount } = render(() => <Rpc />);
			slide('Paper speed', '2.5');
			slide('Rock starting count', '7');
			unmount();

			render(() => <Rpc />);
			expect(screen.getByLabelText('Paper speed')).toHaveValue('2.5');
			expect(board()).toHaveAccessibleName('Simulation: 7 rocks, 10 papers, 10 scissors');
			expect(screen.getByText('Custom rules')).toBeInTheDocument();
		});

		it('unlocks Mad Scientist when a round starts with changed settings', () => {
			render(() => <Rpc />);
			fireEvent.click(screen.getByRole('button', { name: 'Start' }));
			expect(unlocked().has('rpc-mad-scientist')).toBe(false);
			fireEvent.click(screen.getByRole('button', { name: 'Pause' }));

			slide('Interaction radius', '0.5');
			expect(unlocked().has('rpc-mad-scientist')).toBe(false);
			fireEvent.click(screen.getByRole('button', { name: /Start|Resume/ }));
			expect(unlocked().has('rpc-mad-scientist')).toBe(true);
		});
	});

	describe('playing a round', () => {
		let queue;
		let now;
		const flush = () => {
			const callbacks = queue;
			queue = [];
			now += 16;
			callbacks.forEach((cb) => cb(now));
		};
		// Runs frames until the round ends, returning how many it took
		const playOut = () => {
			let frames = 0;
			while (!screen.queryByRole('button', { name: 'New round' })) {
				if (++frames > 30000) throw new Error('The round never ended');
				flush();
			}
			return frames;
		};
		// A small, fast game so rounds end in a few hundred frames
		const quickSetup = () => {
			fireEvent.change(screen.getByLabelText('Count per type'), { target: { value: '3' } });
			fireEvent.input(screen.getByLabelText('Interaction radius'), { target: { value: '2' } });
			for (let i = 0; i < 6; i++) fireEvent.click(screen.getByRole('button', { name: 'Increase speed' }));
		};
		const winnerLabel = () => {
			const won = [...screen.getByText('Rounds won').parentElement.querySelectorAll('.rpc-count')].find((el) => /: 1$/.test(el.textContent));
			return won.textContent.replace(/: 1$/, '');
		};

		beforeEach(() => {
			queue = [];
			now = 0;
			vi.stubGlobal('requestAnimationFrame', (cb) => queue.push(cb));
			vi.stubGlobal('cancelAnimationFrame', () => (queue = []));
		});
		afterEach(() => vi.unstubAllGlobals());

		it('plays a win sound when the round ends with no bet', () => {
			render(() => <Rpc />);
			quickSetup();
			fireEvent.click(screen.getByRole('button', { name: 'Start' }));
			playOut();
			expect(playSound).toHaveBeenCalledWith('win');
			expect(playSound).not.toHaveBeenCalledWith('lose');
		});

		it('plays win or lose according to the bet', () => {
			render(() => <Rpc />);
			quickSetup();
			fireEvent.click(screen.getByRole('radio', { name: /Paper/ }));
			fireEvent.click(screen.getByRole('button', { name: 'Start' }));
			playOut();
			expect(playSound).toHaveBeenCalledWith(winnerLabel() === 'Paper' ? 'win' : 'lose');
			expect(playSound).not.toHaveBeenCalledWith(winnerLabel() === 'Paper' ? 'lose' : 'win');
		});

		it('pops on conversions, at most 8 times a second', () => {
			render(() => <Rpc />);
			quickSetup();
			fireEvent.click(screen.getByRole('button', { name: 'Start' }));
			const frames = playOut();
			const pops = playSound.mock.calls.filter(([name]) => name === 'pop').length;
			expect(pops).toBeGreaterThan(0);
			// 16ms frames, so no more than one pop per 125ms, plus the first
			expect(pops).toBeLessThanOrEqual(Math.floor((frames * 16) / 125) + 1);
			expect(pops).toBeLessThan(frames);
		});

		it('has a sound toggle in the action row', () => {
			render(() => <Rpc />);
			expect(screen.getByRole('button', { name: 'Sound' })).toBeInTheDocument();
		});

		it('offers Share only once the round is over, with the result and the page address', () => {
			render(() => <Rpc />);
			expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument();
			quickSetup();
			fireEvent.click(screen.getByRole('button', { name: 'Start' }));
			playOut();

			fireEvent.click(screen.getByRole('button', { name: 'Share' }));
			expect(shareResult).toHaveBeenCalledTimes(1);
			const text = shareResult.mock.calls[0][0];
			expect(text).toMatch(new RegExp(`^\\S+ ${winnerLabel()} won the RPC Simulator in \\d+:\\d\\d · custom rules\\n`));
			expect(text.endsWith(`${location.origin}/rpc-simulator`)).toBe(true);
		});

		it('says Lizard-Spock in the shared text', () => {
			render(() => <Rpc />);
			fireEvent.click(screen.getByRole('radio', { name: 'Lizard-Spock' }));
			quickSetup();
			fireEvent.click(screen.getByRole('button', { name: 'Start' }));
			playOut();
			fireEvent.click(screen.getByRole('button', { name: 'Share' }));
			expect(shareResult.mock.calls[0][0]).toMatch(/won the RPC Simulator in \d+:\d\d · Lizard-Spock rules/);
		});

		it('runs batches under the chosen rules and says so in the results', () => {
			render(() => <Rpc />);
			fireEvent.click(screen.getByRole('radio', { name: 'Lizard-Spock' }));
			fireEvent.input(screen.getByLabelText('Interaction radius'), { target: { value: '2' } });
			fireEvent.change(screen.getByLabelText('Simulations'), { target: { value: '1' } });
			fireEvent.click(screen.getByRole('button', { name: 'Run' }));
			for (let i = 0; i < 2000 && !screen.queryByText(/^Results from/); i++) flush();

			expect(screen.getByText('Played with Lizard-Spock rules and custom sandbox settings.')).toBeInTheDocument();
			const bars = within(screen.getByRole('list', { name: 'Win share' })).getAllByRole('listitem');
			expect(bars).toHaveLength(5);
			expect(bars[4]).toHaveTextContent('Spock');
		});

		it('keeps plain batch results free of rule notes', () => {
			render(() => <Rpc />);
			fireEvent.input(screen.getByLabelText('Interaction radius'), { target: { value: '2' } });
			fireEvent.input(screen.getByLabelText('Interaction radius'), { target: { value: '1' } });
			fireEvent.change(screen.getByLabelText('Simulations'), { target: { value: '1' } });
			fireEvent.click(screen.getByRole('button', { name: 'Run' }));
			for (let i = 0; i < 20000 && !screen.queryByText(/^Results from/); i++) flush();
			expect(screen.getByText(/^Results from/)).toBeInTheDocument();
			expect(screen.queryByText(/^Played with/)).not.toBeInTheDocument();
		});

		// The same random numbers each time, so a round can be replayed with a bet on its winner
		const seedRandom = (seed) => {
			vi.spyOn(Math, 'random').mockImplementation(() => {
				seed = (seed + 0x6d2b79f5) | 0;
				let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
				t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
				return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
			});
		};
		const winnerOfSeed = (seed) => {
			seedRandom(seed);
			render(() => <Rpc />);
			quickSetup();
			fireEvent.click(screen.getByRole('button', { name: 'Start' }));
			playOut();
			const winner = winnerLabel();
			cleanup();
			vi.mocked(Math.random).mockRestore();
			return winner;
		};
		const betOn = (label) => fireEvent.click(screen.getByRole('radio', { name: new RegExp(label) }));
		const streakText = () => screen.getByText(/🔥/).textContent;

		it('counts a bet that wins a normal round', () => {
			const winner = winnerOfSeed(7);
			seedRandom(7);
			render(() => <Rpc />);
			quickSetup();
			betOn(winner);
			fireEvent.click(screen.getByRole('button', { name: 'Start' }));
			playOut();
			expect(streakText()).toBe('🔥 1');
		});

		it('does not count a bet or a prediction once a finished board is revived', () => {
			const winner = winnerOfSeed(7);
			seedRandom(7);
			render(() => <Rpc />);
			quickSetup();
			betOn(winner);
			fireEvent.click(screen.getByRole('button', { name: 'Start' }));
			playOut();
			expect(streakText()).toBe('🔥 1');

			// Drop in a piece that isn't the winner, to bring the board back to life
			fireEvent.click(screen.getByRole('radio', { name: winner === 'Rock' ? 'Drop paper' : 'Drop rock' }));
			fireEvent.pointerDown(board(), { clientX: 100, clientY: 100 });
			expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument();
			// Predicting is shut until there's a new board
			expect(screen.queryByRole('button', { name: /Predict/ })).not.toBeInTheDocument();

			fireEvent.click(screen.getByRole('button', { name: 'Start' }));
			playOut();
			expect(streakText()).toBe('🔥 1');
			expect(toast).toHaveBeenCalledWith(expect.stringContaining("You meddled, so the bet doesn't count"), 'info');
			expect(screen.queryByText(/Prediction score/)).not.toBeInTheDocument();
		});

		it('offers Predict again on a new board after a revived round', () => {
			render(() => <Rpc />);
			quickSetup();
			fireEvent.click(screen.getByRole('button', { name: 'Start' }));
			playOut();
			fireEvent.click(screen.getByRole('radio', { name: winnerLabel() === 'Rock' ? 'Drop paper' : 'Drop rock' }));
			fireEvent.pointerDown(board(), { clientX: 100, clientY: 100 });
			fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
			expect(screen.getByRole('button', { name: /Predict/ })).toBeInTheDocument();
		});

		it('treats changing the sandbox mid-round as meddling with the bet', () => {
			const winner = winnerOfSeed(7);
			seedRandom(7);
			render(() => <Rpc />);
			quickSetup();
			betOn(winner);
			fireEvent.click(screen.getByRole('button', { name: 'Start' }));
			for (let i = 0; i < 5; i++) flush();
			fireEvent.input(screen.getByLabelText('Interaction radius'), { target: { value: '1.75' } });
			playOut();
			expect(streakText()).toBe('🔥 0');
			expect(toast).toHaveBeenCalledWith(expect.stringContaining('You meddled'), 'info');
		});

		it('locks the start counts once a round has started, even while paused', () => {
			render(() => <Rpc />);
			fireEvent.click(screen.getByRole('button', { name: 'Start' }));
			fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
			expect(screen.getByLabelText('Rock starting count')).toBeDisabled();
			expect(screen.getByLabelText('Rock speed')).toBeEnabled();
		});

		it('keeps the board and start counts when Reset to defaults is pressed mid-round', () => {
			render(() => <Rpc />);
			fireEvent.input(screen.getByLabelText('Scissors starting count'), { target: { value: '4' } });
			fireEvent.input(screen.getByLabelText('Rock speed'), { target: { value: '2' } });
			fireEvent.click(screen.getByRole('button', { name: 'Start' }));
			fireEvent.click(screen.getByRole('button', { name: 'Pause' }));

			fireEvent.click(screen.getByRole('button', { name: 'Sandbox' }));
			fireEvent.click(screen.getByRole('button', { name: 'Reset to defaults' }));
			expect(screen.getByLabelText('Rock speed')).toHaveValue('1');
			expect(screen.getByLabelText('Scissors starting count')).toHaveValue('4');
			expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument();
			expect(screen.getByRole('img', { name: /^Simulation:/ })).toHaveAccessibleName(/4 scissors/);

			// The counts are still the ones for the next board
			fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
			expect(screen.getByRole('img', { name: /^Simulation:/ })).toHaveAccessibleName('Simulation: 10 rocks, 10 papers, 4 scissors');
		});

		it('unlocks Mad Scientist for settings changed during the round', () => {
			render(() => <Rpc />);
			quickSetup();
			fireEvent.input(screen.getByLabelText('Interaction radius'), { target: { value: '1' } });
			fireEvent.change(screen.getByLabelText('Count per type'), { target: { value: '3' } });
			fireEvent.click(screen.getByRole('button', { name: 'Start' }));
			expect(unlocked().has('rpc-mad-scientist')).toBe(false);
			for (let i = 0; i < 3; i++) flush();
			fireEvent.input(screen.getByLabelText('Rock speed'), { target: { value: '2' } });
			playOut();
			expect(unlocked().has('rpc-mad-scientist')).toBe(true);
		});

		it('keeps a plain round from unlocking Mad Scientist', () => {
			render(() => <Rpc />);
			fireEvent.change(screen.getByLabelText('Count per type'), { target: { value: '3' } });
			for (let i = 0; i < 6; i++) fireEvent.click(screen.getByRole('button', { name: 'Increase speed' }));
			fireEvent.click(screen.getByRole('button', { name: 'Start' }));
			playOut();
			expect(unlocked().has('rpc-mad-scientist')).toBe(false);
		});

		it('locks the rules while a batch runs, and the watched batch shows its own five types', () => {
			render(() => <Rpc />);
			fireEvent.click(screen.getByRole('radio', { name: 'Lizard-Spock' }));
			fireEvent.click(screen.getByLabelText('Watch the games'));
			fireEvent.click(screen.getByRole('button', { name: 'Run' }));
			flush();
			flush();
			expect(screen.getByRole('radio', { name: 'Classic' })).toBeDisabled();
			expect(screen.getByText(/^Simulation 1 \/ 20 · 🪨 \d+ 🧻 \d+ ✂️ \d+ 🦎 \d+ 🖖 \d+$/)).toBeInTheDocument();
			expect(screen.getByRole('img', { name: /^Simulation game 1 of 20:.* \d+ lizards, \d+ Spocks$/ })).toBeInTheDocument();
			expect(screen.getByLabelText('On the board')).not.toHaveTextContent('undefined');

			fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
			expect(screen.getByRole('radio', { name: 'Classic' })).toBeEnabled();
		});

		it('locks the rules during a headless batch too', () => {
			render(() => <Rpc />);
			fireEvent.click(screen.getByRole('button', { name: 'Run' }));
			expect(screen.getByRole('radio', { name: 'Lizard-Spock' })).toBeDisabled();
			fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
			expect(screen.getByRole('radio', { name: 'Lizard-Spock' })).toBeEnabled();
		});

		it('moves on to a fresh round, hiding Share again', () => {
			render(() => <Rpc />);
			quickSetup();
			fireEvent.click(screen.getByRole('button', { name: 'Start' }));
			playOut();
			fireEvent.click(screen.getByRole('button', { name: 'New round' }));
			expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument();
		});
	});
});
