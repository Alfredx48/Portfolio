import { muted } from '../../utils/sound';

// An original procedural soundtrack. Everything is synthesized locally after
// an explicit gesture; no recordings, downloads, or automatic playback.
export function createNeonMusic() {
	let context, master, timer, enabled = false, disposed = false, audible = false;
	let nextNote = 0, beat = 0, state = { playing: false, sector: 1, boss: false };
	const scale = [0, 3, 7, 10, 12, 10, 7, 3];
	const bass = [0, 0, 7, 0, 3, 3, 10, 7];
	const frequency = midi => 440 * 2 ** ((midi - 69) / 12);
	const tone = (midi, when, length, volume, wave = 'triangle') => {
		const oscillator = context.createOscillator(), envelope = context.createGain();
		oscillator.type = wave; oscillator.frequency.setValueAtTime(frequency(midi), when);
		envelope.gain.setValueAtTime(0.0001, when);
		envelope.gain.exponentialRampToValueAtTime(volume, when + 0.008);
		envelope.gain.exponentialRampToValueAtTime(0.0001, when + length);
		oscillator.connect(envelope); envelope.connect(master);
		oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
		oscillator.start(when); oscillator.stop(when + length + 0.025);
	};
	const kick = when => {
		const oscillator = context.createOscillator(), envelope = context.createGain();
		oscillator.frequency.setValueAtTime(135, when);
		oscillator.frequency.exponentialRampToValueAtTime(42, when + 0.13);
		envelope.gain.setValueAtTime(0.11, when);
		envelope.gain.exponentialRampToValueAtTime(0.0001, when + 0.16);
		oscillator.connect(envelope); envelope.connect(master);
		oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
		oscillator.start(when); oscillator.stop(when + 0.18);
	};
	const syncGain = () => {
		const next = enabled && state.playing && !globalThis.document?.hidden && !muted() && !disposed;
		if (next === audible) return;
		audible = next;
		if (master && context) {
			master.gain.cancelScheduledValues(context.currentTime);
			master.gain.setTargetAtTime(audible ? 0.16 : 0, context.currentTime, 0.025);
		}
	};
	const schedule = () => {
		if (!context || disposed || !enabled) return;
		syncGain();
		if (!audible || context.state !== 'running') { nextNote = context.currentTime + 0.04; return; }
		// Never replay a queue of stale notes after a suspended/background tab.
		nextNote = Math.max(nextNote, context.currentTime + 0.01);
		const duration = 60 / (state.boss ? 132 : 112) / 4;
		const root = 45 + ((Math.max(1, state.sector) - 1) % 3) * 2;
		while (nextNote < context.currentTime + 0.14) {
			const step = beat % 16;
			if (step % 4 === 0) kick(nextNote);
			if (step % 2 === 0) tone(root + bass[(beat / 2) % 8], nextNote, duration * 1.5, 0.065, 'triangle');
			tone(root + 24 + scale[beat % scale.length], nextNote, duration * 0.7, state.boss ? 0.038 : 0.027, 'triangle');
			if (state.boss && step % 4 === 2) tone(root + 36, nextNote, 0.04, 0.012, 'square');
			beat++; nextNote += duration;
		}
	};
	const setEnabled = value => {
		if (disposed) return false;
		if (!value) {
			enabled = false; clearInterval(timer); timer = undefined; syncGain(); return true;
		}
		try {
			const AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext;
			if (!AudioContextClass) return false;
			if (!context) {
				context = new AudioContextClass(); master = context.createGain();
				master.gain.value = 0; master.connect(context.destination);
			}
			context.resume?.().catch(() => {});
			enabled = true; nextNote = context.currentTime + 0.04;
			clearInterval(timer); timer = setInterval(schedule, 80); syncGain(); return true;
		} catch { enabled = false; return false; }
	};
	return {
		setEnabled,
		resume() {
			if (!enabled || disposed || !context || context.state === 'running') return;
			try { context.resume?.().catch(() => {}); } catch { /* A closed audio device stays silent. */ }
		},
		update(next) { state = next; syncGain(); },
		dispose() {
			disposed = true; enabled = false; clearInterval(timer); syncGain();
			if (context) context.close?.().catch(() => {});
			context = master = undefined;
		},
	};
}
