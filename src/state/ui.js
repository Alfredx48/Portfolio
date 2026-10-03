import { createSignal } from 'solid-js';
import { confetti } from '../utils/confetti';

// App-wide UI state shared by the command palette, trophy panel and party mode.
export const [paletteOpen, setPaletteOpen] = createSignal(false);
export const [trophiesOpen, setTrophiesOpen] = createSignal(false);
export const [partyMode, setPartyModeSignal] = createSignal(false);

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export const shortcutLabel = isMac ? '⌘K' : 'Ctrl K';

export function togglePartyMode() {
	const on = !partyMode();
	setPartyModeSignal(on);
	document.documentElement.classList.toggle('party', on);
	if (on) {
		confetti({ x: window.innerWidth * 0.2, y: window.innerHeight * 0.6, count: 120, power: 1.2 });
		confetti({ x: window.innerWidth * 0.8, y: window.innerHeight * 0.6, count: 120, power: 1.2 });
	}
	return on;
}
