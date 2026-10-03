import { fireEvent, render, screen } from '@solidjs/testing-library';
import { beforeEach, describe, expect, it } from 'vitest';
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

	it('locks your bet while a round is running', () => {
		render(() => <Rpc />);
		const paper = screen.getByRole('radio', { name: /Paper/ });
		fireEvent.click(paper);
		expect(paper).toHaveAttribute('aria-checked', 'true');
		expect(screen.getByText(/🔥/)).toHaveTextContent('🔥 0');

		fireEvent.click(screen.getByRole('button', { name: 'Start' }));
		expect(paper).toBeDisabled();
	});
});
