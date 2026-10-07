import { fireEvent, render, screen } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';
import SandboxPanel from './SandboxPanel';
import { defaultSandbox } from './sandbox';
import { CLASSIC, LIZARD_SPOCK } from './simulation';

describe('SandboxPanel', () => {
	const setup = (props = {}) => {
		const onChange = vi.fn();
		const onReset = vi.fn();
		render(() => (
			<SandboxPanel
				open={() => true}
				rules={() => CLASSIC}
				sandbox={defaultSandbox}
				count={() => 10}
				custom={() => false}
				lockCounts={() => false}
				onChange={onChange}
				onReset={onReset}
				{...props}
			/>
		));
		return { onChange, onReset };
	};

	it('is hidden until the page opens it, but stays in the page', () => {
		setup({ open: () => false });
		expect(screen.getByLabelText('Rock speed').closest('section')).toHaveAttribute('hidden');
	});

	it('is shown when open', () => {
		setup();
		expect(screen.getByLabelText('Rock speed').closest('section')).not.toHaveAttribute('hidden');
		expect(screen.getByRole('region', { name: 'Sandbox' })).toHaveAttribute('id', 'rpc-sandbox');
	});

	it('sends the whole new settings when a slider moves', () => {
		const { onChange } = setup();
		fireEvent.input(screen.getByLabelText('Paper speed'), { target: { value: '2.25' } });
		const next = onChange.mock.calls[0][0];
		expect(next.speed).toMatchObject({ rock: 1, paper: 2.25, scissors: 1 });
		expect(next.radius).toBe(1);

		fireEvent.input(screen.getByLabelText('Interaction radius'), { target: { value: '0.5' } });
		expect(onChange.mock.calls[1][0].radius).toBe(0.5);

		fireEvent.input(screen.getByLabelText('Scissors starting count'), { target: { value: '4' } });
		expect(onChange.mock.calls[2][0].counts).toMatchObject({ rock: null, scissors: 4 });
	});

	it('shows the current values', () => {
		const sandbox = defaultSandbox();
		sandbox.speed.rock = 0.25;
		sandbox.counts.paper = 40;
		setup({ sandbox: () => sandbox });
		expect(screen.getByLabelText('Rock speed').nextElementSibling).toHaveTextContent('0.25×');
		expect(screen.getByLabelText('Paper starting count').nextElementSibling).toHaveTextContent('40');
		expect(screen.getByLabelText('Rock starting count').nextElementSibling).toHaveTextContent('10');
	});

	it('lists all five types under Lizard-Spock', () => {
		setup({ rules: () => LIZARD_SPOCK });
		for (const type of ['Rock', 'Paper', 'Scissors', 'Lizard', 'Spock']) {
			expect(screen.getByLabelText(`${type} speed`)).toBeInTheDocument();
		}
	});

	it('can lock the starting counts', () => {
		setup({ lockCounts: () => true });
		expect(screen.getByLabelText('Rock starting count')).toBeDisabled();
		expect(screen.getByLabelText('Rock speed')).toBeEnabled();
	});

	it('has Reset to defaults disabled until something differs', () => {
		setup();
		expect(screen.getByRole('button', { name: 'Reset to defaults' })).toBeDisabled();
	});

	it('goes back to following the main count when a slider is put back on it', () => {
		const { onChange } = setup({ count: () => 12 });
		fireEvent.input(screen.getByLabelText('Rock starting count'), { target: { value: '12' } });
		expect(onChange.mock.calls[0][0].counts.rock).toBeNull();
		fireEvent.input(screen.getByLabelText('Rock starting count'), { target: { value: '13' } });
		expect(onChange.mock.calls[1][0].counts.rock).toBe(13);
	});

	it('resets to defaults', () => {
		const { onReset } = setup({ custom: () => true });
		fireEvent.click(screen.getByRole('button', { name: 'Reset to defaults' }));
		expect(onReset).toHaveBeenCalled();
	});
});
