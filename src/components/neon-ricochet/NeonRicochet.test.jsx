import { cleanup, fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import NeonRicochet from './NeonRicochet';
import { aim } from './engine';

vi.mock('./engine', async importOriginal => ({ ...(await importOriginal()), aim: vi.fn((await importOriginal()).aim) }));

vi.mock('@solidjs/router', () => ({ A: props => <a href={props.href}>{props.children}</a> }));
vi.mock('../../state/achievements', () => ({ unlock: vi.fn() }));
vi.mock('./music', () => ({ createNeonMusic: () => ({ update() {}, dispose() {}, resume() {}, setEnabled() { return true; } }) }));

beforeEach(() => {
	localStorage.clear();
	vi.clearAllMocks();
	vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} })));
	vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} });
	Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: false });
	Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null });
	document.body.style.overflow = 'auto';
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('mobile flight deck', () => {
	it('fills the screen without native fullscreen and restores scrolling and focus on Escape', async () => {
		const { container } = render(() => <NeonRicochet />);
		const enter = screen.getByRole('button', { name: 'Enter fullscreen' });
		enter.focus();
		fireEvent.click(enter);
		expect(container.querySelector('.nr-console')).toHaveClass('nr-immersive');
		expect(document.body.style.overflow).toBe('hidden');
		fireEvent.keyDown(window, { key: 'Escape' });
		expect(container.querySelector('.nr-console')).not.toHaveClass('nr-immersive');
		expect(document.body.style.overflow).toBe('auto');
		await waitFor(() => expect(enter).toHaveFocus());
	});

	it('keeps the screen-filling fallback when a browser rejects native fullscreen', async () => {
		Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: true });
		const { container } = render(() => <NeonRicochet />);
		const consoleElement = container.querySelector('.nr-console');
		consoleElement.requestFullscreen = vi.fn().mockRejectedValue(new Error('unsupported'));
		fireEvent.click(screen.getByRole('button', { name: 'Enter fullscreen' }));
		await waitFor(() => expect(consoleElement.requestFullscreen).toHaveBeenCalled());
		expect(consoleElement).toHaveClass('nr-immersive');
		fireEvent.click(screen.getByRole('button', { name: 'Exit fullscreen' }));
		expect(consoleElement).not.toHaveClass('nr-immersive');
	});

	it('tracks native fullscreen entry and exit', async () => {
		Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: true });
		const { container } = render(() => <NeonRicochet />);
		const consoleElement = container.querySelector('.nr-console');
		consoleElement.requestFullscreen = vi.fn(async () => {
			Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: consoleElement });
			fireEvent(document, new Event('fullscreenchange'));
		});
		fireEvent.click(screen.getByRole('button', { name: 'Enter fullscreen' }));
		await waitFor(() => expect(consoleElement.requestFullscreen).toHaveBeenCalled());
		expect(consoleElement).toHaveClass('nr-immersive');
		Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null });
		fireEvent(document, new Event('fullscreenchange'));
		expect(consoleElement).not.toHaveClass('nr-immersive');
		expect(document.body.style.overflow).toBe('auto');
	});

	it('maps steering pad touches to the full arena width', () => {
		vi.stubGlobal('PointerEvent', MouseEvent);
		const { container } = render(() => <NeonRicochet />);
		const pad = container.querySelector('.nr-steering-pad');
		pad.setPointerCapture = vi.fn();
		pad.getBoundingClientRect = () => ({ left: 50, width: 200 });
		fireEvent.pointerDown(pad, { clientX: 150, buttons: 1 });
		expect(aim).toHaveBeenLastCalledWith(expect.any(Object), 400);
		fireEvent.pointerMove(pad, { clientX: 200, buttons: 1 });
		expect(aim).toHaveBeenLastCalledWith(expect.any(Object), 600);
	});

	it('pauses on resize and saves the larger ball preference', () => {
		render(() => <NeonRicochet />);
		fireEvent.click(screen.getByRole('button', { name: /Launch ball/ }));
		fireEvent(window, new Event('resize'));
		expect(screen.getByRole('button', { name: /Resume transmission/ })).toBeInTheDocument();
		const settings = screen.getByText('Play settings').parentElement;
		settings.open = true;
		fireEvent(settings, new Event('toggle'));
		const ball = screen.getByRole('button', { name: /Larger, high contrast ball/ });
		fireEvent.click(ball);
		expect(ball).toHaveAttribute('aria-pressed', 'true');
		expect(localStorage.getItem('alfred-portfolio:ricochet-easy-view')).toBe('true');
	});
});
