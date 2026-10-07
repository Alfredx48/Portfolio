import { fireEvent, render, screen } from '@solidjs/testing-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { muted, playSound, toggleMuted } from '../../utils/sound';
import SoundToggle from './SoundToggle';

vi.mock('../../utils/sound', async (importOriginal) => ({ ...(await importOriginal()), playSound: vi.fn() }));

describe('SoundToggle', () => {
	beforeEach(() => {
		localStorage.clear();
		vi.clearAllMocks();
		if (!muted()) toggleMuted();
	});

	it('starts muted', () => {
		render(() => <SoundToggle />);
		const button = screen.getByRole('button', { name: 'Sound' });
		expect(button).toHaveAttribute('aria-pressed', 'false');
		expect(button).toHaveAttribute('title', 'Sound off');
		expect(button).toHaveTextContent('🔇');
	});

	it('turns sound on with a confirming pop, and off again', () => {
		render(() => <SoundToggle />);
		const button = screen.getByRole('button', { name: 'Sound' });

		fireEvent.click(button);
		expect(button).toHaveAttribute('aria-pressed', 'true');
		expect(button).toHaveAttribute('title', 'Sound on');
		expect(button).toHaveTextContent('🔊');
		expect(playSound).toHaveBeenCalledWith('pop');
		expect(muted()).toBe(false);

		fireEvent.click(button);
		expect(button).toHaveAttribute('aria-pressed', 'false');
		expect(muted()).toBe(true);
	});
});
