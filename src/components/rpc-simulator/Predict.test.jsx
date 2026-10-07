import { fireEvent, render, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetAchievements, unlocked } from '../../state/achievements';
import { shareResult } from '../../utils/share';
import Rpc from './Rpc';
import PredictControls from './PredictControls';
import { emptyCurve, scorePrediction } from './prediction';
import { CLASSIC } from './simulation';

vi.mock('../../utils/sound', async (importOriginal) => ({ ...(await importOriginal()), playSound: vi.fn() }));
vi.mock('../../utils/share', () => ({ shareResult: vi.fn() }));
// Real scoring unless a test says otherwise, so the wiring can be checked with a known accuracy
vi.mock('./prediction', async (importOriginal) => {
	const actual = await importOriginal();
	return { ...actual, scorePrediction: vi.fn(actual.scorePrediction) };
});

describe('PredictControls', () => {
	const setup = (props = {}) => {
		const handlers = { onType: vi.fn(), onToggle: vi.fn(), onClear: vi.fn(), onPreset: vi.fn() };
		render(() => (
			<PredictControls
				rules={() => CLASSIC}
				state={() => 'idle'}
				active={() => false}
				type={() => 'rock'}
				prediction={() => ({})}
				result={() => null}
				{...handlers}
				{...props}
			/>
		));
		return handlers;
	};

	it('offers Predict before a round and toggles drawing', () => {
		const { onToggle } = setup();
		expect(screen.queryByRole('radiogroup', { name: 'Line to draw' })).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', { name: /Predict/ }));
		expect(onToggle).toHaveBeenCalled();
	});

	it('lets you pick a type and clear its line while drawing', () => {
		const { onType, onClear, onToggle } = setup({ active: () => true, type: () => 'paper' });
		expect(screen.getByRole('radio', { name: 'Draw paper' })).toHaveAttribute('aria-checked', 'true');
		fireEvent.click(screen.getByRole('radio', { name: 'Draw scissors' }));
		expect(onType).toHaveBeenCalledWith('scissors');
		fireEvent.click(screen.getByRole('button', { name: 'Clear line' }));
		expect(onClear).toHaveBeenCalledWith('paper');
		fireEvent.click(screen.getByRole('button', { name: 'Done' }));
		expect(onToggle).toHaveBeenCalled();
	});

	it('ticks the types that have a line', () => {
		const curve = emptyCurve(5);
		curve[2] = 0.5;
		setup({ active: () => true, prediction: () => ({ rock: curve }) });
		expect(screen.getByRole('radio', { name: 'Draw rock' })).toHaveTextContent('✓');
		expect(screen.getByRole('radio', { name: 'Draw paper' })).not.toHaveTextContent('✓');
	});

	it('only notes the prediction once the round is on, with no way to edit it', () => {
		setup({ state: () => 'locked', prediction: () => ({ rock: [0.5] }) });
		expect(screen.getByText(/Prediction locked in/)).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /Predict/ })).not.toBeInTheDocument();
	});

	it('shows the score as the headline after the round, with the accuracy as small print', () => {
		const { onToggle } = setup({ state: () => 'done', result: () => ({ score: 41, accuracy: 77 }) });
		expect(screen.getByRole('status')).toHaveTextContent('Prediction score 41/100');
		expect(screen.getByRole('status')).toHaveTextContent('77% accurate');
		expect(screen.getByRole('status')).toHaveTextContent('0 = no better than a flat guess');
		fireEvent.click(screen.getByRole('button', { name: /Predict/ }));
		expect(onToggle).toHaveBeenCalled();
	});

	it('keeps the live region in the page all along, so the score is announced when it arrives', () => {
		const [state, setState] = createSignal('idle');
		const [result, setResult] = createSignal(null);
		setup({ state, result });
		const region = screen.getByRole('status');
		expect(region).toHaveAttribute('aria-live', 'polite');
		expect(region.textContent.trim()).toBe('');

		setState('done');
		setResult({ score: 30, accuracy: 70 });
		expect(screen.getByRole('status')).toBe(region);
		expect(region).toHaveTextContent('Prediction score 30/100');
	});

	it('offers quick shapes as an alternative to dragging', () => {
		const { onPreset } = setup({ active: () => true, type: () => 'scissors' });
		const shapes = screen.getByRole('combobox', { name: 'Quick shape for the Scissors line' });
		expect([...shapes.options].map((o) => o.textContent)).toEqual(['Quick shape…', 'Wins early', 'Wins late', 'Loses early', 'Loses late']);
		fireEvent.change(shapes, { target: { value: 'wins-late' } });
		expect(onPreset).toHaveBeenCalledWith('scissors', 'wins-late');
		expect(shapes).toHaveValue('');
	});

	it('does not show quick shapes outside drawing', () => {
		setup();
		expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
	});
});

describe('predicting a round', () => {
	let queue;
	let now;
	const flush = () => {
		const callbacks = queue;
		queue = [];
		now += 16;
		callbacks.forEach((cb) => cb(now));
	};
	const playOut = () => {
		for (let frames = 0; !screen.queryByRole('button', { name: 'New round' }); frames++) {
			if (frames > 30000) throw new Error('The round never ended');
			flush();
		}
	};
	const quickSetup = () => {
		fireEvent.change(screen.getByLabelText('Count per type'), { target: { value: '3' } });
		fireEvent.input(screen.getByLabelText('Interaction radius'), { target: { value: '2' } });
		for (let i = 0; i < 6; i++) fireEvent.click(screen.getByRole('button', { name: 'Increase speed' }));
	};
	const pad = () => screen.getByRole('img', { name: /^Drawing area/ });
	// Plot is 800 - 32 - 40 wide and 150 - 12 - 22 tall, in canvas pixels
	const drag = (from, to) => {
		fireEvent.pointerDown(pad(), { clientX: from[0], clientY: from[1], pointerId: 1 });
		fireEvent.pointerMove(pad(), { clientX: (from[0] + to[0]) / 2, clientY: (from[1] + to[1]) / 2, pointerId: 1 });
		fireEvent.pointerMove(pad(), { clientX: to[0], clientY: to[1], pointerId: 1 });
		fireEvent.pointerUp(pad(), { pointerId: 1 });
	};

	beforeEach(() => {
		localStorage.clear();
		resetAchievements();
		vi.clearAllMocks();
		queue = [];
		now = 0;
		vi.stubGlobal('requestAnimationFrame', (cb) => queue.push(cb));
		vi.stubGlobal('cancelAnimationFrame', () => (queue = []));
		vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
	});
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('turns the chart into a drawing area for the chosen type', () => {
		render(() => <Rpc />);
		expect(screen.queryByRole('img', { name: /^Drawing area/ })).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', { name: /Predict/ }));
		expect(pad()).toHaveAccessibleName(/^Drawing area for your predicted rock line\./);

		fireEvent.click(screen.getByRole('radio', { name: 'Draw scissors' }));
		expect(pad()).toHaveAccessibleName(/^Drawing area for your predicted scissors line\./);
	});

	it('records a line where the pointer is dragged, one type at a time', () => {
		render(() => <Rpc />);
		fireEvent.click(screen.getByRole('button', { name: /Predict/ }));
		expect(screen.getByRole('radio', { name: 'Draw rock' })).not.toHaveTextContent('✓');

		drag([40, 30], [700, 100]);
		expect(screen.getByRole('radio', { name: 'Draw rock' })).toHaveTextContent('✓');
		expect(screen.getByRole('radio', { name: 'Draw paper' })).not.toHaveTextContent('✓');

		fireEvent.click(screen.getByRole('button', { name: 'Clear line' }));
		expect(screen.getByRole('radio', { name: 'Draw rock' })).not.toHaveTextContent('✓');
	});

	it('ignores dragging when not drawing a prediction', () => {
		render(() => <Rpc />);
		const chart = screen.getByRole('img', { name: /^Line chart/ });
		fireEvent.pointerDown(chart, { clientX: 100, clientY: 50 });
		fireEvent.pointerMove(chart, { clientX: 300, clientY: 80 });
		expect(screen.queryByRole('radio', { name: 'Draw rock' })).not.toBeInTheDocument();
	});

	it('locks in the prediction when the round starts, then scores it', () => {
		render(() => <Rpc />);
		quickSetup();
		fireEvent.click(screen.getByRole('button', { name: /Predict/ }));
		drag([40, 30], [700, 100]);
		fireEvent.click(screen.getByRole('button', { name: 'Start' }));

		expect(screen.queryByRole('img', { name: /^Drawing area/ })).not.toBeInTheDocument();
		expect(screen.getByText(/Prediction locked in/)).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /Predict/ })).not.toBeInTheDocument();

		playOut();
		expect(scorePrediction).toHaveBeenCalledTimes(1);
		expect(screen.getByRole('status')).toHaveTextContent(/Prediction score \d+\/100/);
	});

	it('shows no score when nothing was drawn', () => {
		render(() => <Rpc />);
		quickSetup();
		fireEvent.click(screen.getByRole('button', { name: 'Start' }));
		playOut();
		expect(screen.getByRole('status').textContent.trim()).toBe('');
		expect(unlocked().has('rpc-oracle')).toBe(false);
	});

	it('works alongside a bet', () => {
		render(() => <Rpc />);
		quickSetup();
		fireEvent.click(screen.getByRole('radio', { name: /Scissors/ }));
		fireEvent.click(screen.getByRole('button', { name: /Predict/ }));
		drag([40, 30], [700, 100]);
		fireEvent.click(screen.getByRole('button', { name: 'Start' }));
		expect(screen.getByRole('radio', { name: /Scissors/ })).toBeDisabled();
		playOut();
		expect(screen.getByRole('status')).toHaveTextContent(/Prediction score/);
		expect(screen.getByText(/🔥/)).toBeInTheDocument();
	});

	it('unlocks Oracle at a score of 25 and not below', () => {
		render(() => <Rpc />);
		quickSetup();
		fireEvent.click(screen.getByRole('button', { name: /Predict/ }));
		drag([40, 30], [700, 100]);
		scorePrediction.mockReturnValueOnce({ score: 24, accuracy: 79, errors: {} });
		fireEvent.click(screen.getByRole('button', { name: 'Start' }));
		playOut();
		expect(unlocked().has('rpc-oracle')).toBe(false);

		// A fresh round, predicted again
		fireEvent.click(screen.getByRole('button', { name: /Predict/ }));
		drag([40, 30], [700, 100]);
		scorePrediction.mockReturnValueOnce({ score: 25, accuracy: 60, errors: {} });
		fireEvent.click(screen.getByRole('button', { name: 'Start' }));
		playOut();
		expect(screen.getByRole('status')).toHaveTextContent('Prediction score 25/100');
		expect(unlocked().has('rpc-oracle')).toBe(true);
	});

	it('puts the accuracy in the shared text', () => {
		render(() => <Rpc />);
		quickSetup();
		fireEvent.click(screen.getByRole('button', { name: /Predict/ }));
		drag([40, 30], [700, 100]);
		scorePrediction.mockReturnValueOnce({ score: 41, accuracy: 82, errors: {} });
		fireEvent.click(screen.getByRole('button', { name: 'Start' }));
		playOut();
		fireEvent.click(screen.getByRole('button', { name: 'Share' }));
		expect(shareResult.mock.calls[0][0]).toMatch(/ · 🔮 41\/100 prediction score\n/);
	});

	it('scores five types against five lines', () => {
		render(() => <Rpc />);
		fireEvent.click(screen.getByRole('radio', { name: 'Lizard-Spock' }));
		quickSetup();
		fireEvent.click(screen.getByRole('button', { name: /Predict/ }));
		for (const type of ['rock', 'lizard', 'spock']) {
			fireEvent.click(screen.getByRole('radio', { name: `Draw ${type}` }));
			drag([40, 30], [700, 100]);
		}
		fireEvent.click(screen.getByRole('button', { name: 'Start' }));
		playOut();
		const [, , types] = scorePrediction.mock.calls[0];
		expect(types).toEqual(['rock', 'paper', 'scissors', 'lizard', 'spock']);
		// Lines that weren't drawn count as a flat guess, so every type is scored
		expect(Object.keys(scorePrediction.mock.results[0].value.errors)).toEqual(['rock', 'paper', 'scissors', 'lizard', 'spock']);
	});

	it('starts a fresh board with a new prediction from the end of a round', () => {
		render(() => <Rpc />);
		quickSetup();
		fireEvent.click(screen.getByRole('button', { name: 'Start' }));
		playOut();
		fireEvent.click(screen.getByRole('button', { name: /Predict/ }));
		expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
		expect(pad()).toBeInTheDocument();
	});
	describe('Oracle needs more than a lazy guess', () => {
		// y position (px from the top of the canvas) for a share of the population
		const at = (share) => 12 + 116 * (1 - share);

		const finishWith = (lines) => {
			render(() => <Rpc />);
			quickSetup();
			fireEvent.click(screen.getByRole('button', { name: /Predict/ }));
			lines();
			fireEvent.click(screen.getByRole('button', { name: 'Start' }));
			playOut();
		};
		const scoreShown = () => Number(screen.getByRole('status').querySelector('strong').textContent);

		it('does not unlock for a flat line at an equal share on every type', () => {
			finishWith(() => {
				for (const type of ['rock', 'paper', 'scissors']) {
					fireEvent.click(screen.getByRole('radio', { name: `Draw ${type}` }));
					drag([32, at(1 / 3)], [760, at(1 / 3)]);
				}
			});
			expect(scoreShown()).toBeLessThan(25);
			expect(unlocked().has('rpc-oracle')).toBe(false);
		});

		it('does not unlock for lines along the baseline', () => {
			finishWith(() => {
				for (const type of ['rock', 'paper', 'scissors']) {
					fireEvent.click(screen.getByRole('radio', { name: `Draw ${type}` }));
					drag([32, at(0)], [760, at(0)]);
				}
			});
			expect(scoreShown()).toBe(0);
			expect(unlocked().has('rpc-oracle')).toBe(false);
		});

		it('does not unlock for drawing a single type', () => {
			finishWith(() => drag([32, at(0)], [760, at(0)]));
			expect(scoreShown()).toBeLessThan(25);
			expect(unlocked().has('rpc-oracle')).toBe(false);
		});

		it('does not unlock for a flat line in Lizard-Spock, either', () => {
			render(() => <Rpc />);
			fireEvent.click(screen.getByRole('radio', { name: 'Lizard-Spock' }));
			quickSetup();
			fireEvent.click(screen.getByRole('button', { name: /Predict/ }));
			for (const type of ['rock', 'paper', 'scissors', 'lizard', 'spock']) {
				fireEvent.click(screen.getByRole('radio', { name: `Draw ${type}` }));
				drag([32, at(0.2)], [760, at(0.2)]);
			}
			fireEvent.click(screen.getByRole('button', { name: 'Start' }));
			playOut();
			expect(scoreShown()).toBeLessThan(25);
			expect(unlocked().has('rpc-oracle')).toBe(false);
		});

		it('draws a quick shape for the chosen type without any dragging', () => {
			render(() => <Rpc />);
			fireEvent.click(screen.getByRole('button', { name: /Predict/ }));
			expect(screen.getByRole('radio', { name: 'Draw rock' })).not.toHaveTextContent('✓');
			fireEvent.change(screen.getByRole('combobox', { name: /Quick shape/ }), { target: { value: 'wins-early' } });
			expect(screen.getByRole('radio', { name: 'Draw rock' })).toHaveTextContent('✓');
			expect(screen.getByRole('radio', { name: 'Draw paper' })).not.toHaveTextContent('✓');
		});

		it('explains how to draw without a pointer', () => {
			render(() => <Rpc />);
			fireEvent.click(screen.getByRole('button', { name: /Predict/ }));
			expect(pad()).toHaveAccessibleName(/use Quick shape instead/);
		});
	});
});
