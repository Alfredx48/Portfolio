import { createSignal } from 'solid-js';
import { load, save } from './storage';

// Muted until someone opts in, so the site never makes noise unprompted.
const [muted, setMuted] = createSignal(load('sound-muted', true) !== false);
export { muted };

export function toggleMuted() {
	const next = !muted();
	setMuted(next);
	save('sound-muted', next);
}

// [frequency Hz, start s, length s, peak gain, wave], kept quiet on purpose
const SOUNDS = {
	place: [[330, 0, 0.07, 0.05, 'triangle']],
	flip: [[520, 0, 0.05, 0.04, 'triangle'], [390, 0.04, 0.06, 0.03, 'triangle']],
	match: [[523, 0, 0.12, 0.06, 'sine'], [784, 0.1, 0.2, 0.06, 'sine']],
	miss: [[196, 0, 0.12, 0.04, 'sine']],
	win: [[523, 0, 0.14, 0.06, 'sine'], [659, 0.11, 0.14, 0.06, 'sine'], [784, 0.22, 0.14, 0.06, 'sine'], [1047, 0.33, 0.3, 0.06, 'sine']],
	lose: [[392, 0, 0.18, 0.05, 'triangle'], [294, 0.16, 0.18, 0.05, 'triangle'], [220, 0.32, 0.3, 0.05, 'triangle']],
	draw: [[440, 0, 0.14, 0.05, 'sine'], [440, 0.16, 0.2, 0.05, 'sine']],
	pop: [[700, 0, 0.05, 0.04, 'sine'], [450, 0.02, 0.06, 0.03, 'sine']],
	tick: [[1200, 0, 0.03, 0.015, 'square']],
};

let context;

// Browsers only allow audio after a gesture, so the context is made on the first unmuted play.
function getContext() {
	const AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext;
	if (!AudioContextClass) return null;
	context ??= new AudioContextClass();
	if (context.state === 'suspended') context.resume?.();
	return context;
}

export function playSound(name) {
	try {
		const notes = SOUNDS[name];
		if (muted() || !notes) return;
		const ctx = getContext();
		if (!ctx) return;

		const now = ctx.currentTime;
		for (const [frequency, start, length, peak, wave] of notes) {
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			osc.type = wave;
			osc.frequency.value = frequency;
			// A fast attack and an exponential fade avoid clicks at either end
			gain.gain.setValueAtTime(0.0001, now + start);
			gain.gain.exponentialRampToValueAtTime(peak, now + start + 0.01);
			gain.gain.exponentialRampToValueAtTime(0.0001, now + start + length);
			osc.connect(gain).connect(ctx.destination);
			osc.start(now + start);
			osc.stop(now + start + length + 0.02);
		}
	} catch {
		// Sound is a nicety, never worth breaking a game over
	}
}
