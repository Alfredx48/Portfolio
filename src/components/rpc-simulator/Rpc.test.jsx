import { fireEvent, render, screen } from '@solidjs/testing-library';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Rpc from './Rpc';

describe('Rpc', () => {
	beforeEach(() => localStorage.clear());

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
});
