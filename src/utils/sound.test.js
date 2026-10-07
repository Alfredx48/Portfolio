import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The module keeps its muted state and audio context at load time, so each test imports a fresh copy.
const fresh = () => import('./sound');

function fakeAudioContext() {
	const node = () => ({
		connect: (next) => next,
		start: vi.fn(),
		stop: vi.fn(),
		frequency: {},
		gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
	});
	const instances = [];
	class FakeAudioContext {
		constructor() {
			this.currentTime = 0;
			this.state = 'suspended';
			this.destination = {};
			this.resume = vi.fn();
			this.createOscillator = vi.fn(node);
			this.createGain = vi.fn(node);
			instances.push(this);
		}
	}
	vi.stubGlobal('AudioContext', FakeAudioContext);
	return instances;
}

beforeEach(() => {
	localStorage.clear();
	vi.resetModules();
});

afterEach(() => vi.unstubAllGlobals());

describe('mute state', () => {
	it('starts muted', async () => {
		const { muted } = await fresh();
		expect(muted()).toBe(true);
	});

	it('toggles and persists the choice', async () => {
		const sound = await fresh();
		sound.toggleMuted();
		expect(sound.muted()).toBe(false);
		expect(localStorage.getItem('alfred-portfolio:sound-muted')).toBe('false');

		vi.resetModules();
		expect((await fresh()).muted()).toBe(false);

		(await fresh()).toggleMuted();
		expect(localStorage.getItem('alfred-portfolio:sound-muted')).toBe('true');
	});
});

describe('playSound', () => {
	it('does nothing without AudioContext', async () => {
		const { playSound, toggleMuted } = await fresh();
		toggleMuted();
		expect(() => playSound('win')).not.toThrow();
	});

	it('stays silent, and never creates a context, while muted', async () => {
		const contexts = fakeAudioContext();
		const { playSound } = await fresh();
		playSound('place');
		expect(contexts).toHaveLength(0);
	});

	it('plays one oscillator per note and reuses a resumed context', async () => {
		const contexts = fakeAudioContext();
		const { playSound, toggleMuted } = await fresh();
		toggleMuted();
		playSound('match');
		playSound('place');
		expect(contexts).toHaveLength(1);
		expect(contexts[0].resume).toHaveBeenCalled();
		expect(contexts[0].createOscillator).toHaveBeenCalledTimes(3);
	});

	it('ignores unknown names', async () => {
		const contexts = fakeAudioContext();
		const { playSound, toggleMuted } = await fresh();
		toggleMuted();
		playSound('kaboom');
		expect(contexts).toHaveLength(0);
	});

	it('swallows errors from the audio API', async () => {
		vi.stubGlobal('AudioContext', function () {
			throw new Error('blocked');
		});
		const { playSound, toggleMuted } = await fresh();
		toggleMuted();
		expect(() => playSound('win')).not.toThrow();
	});

	it('every named sound plays', async () => {
		const contexts = fakeAudioContext();
		const { playSound, toggleMuted } = await fresh();
		toggleMuted();
		for (const name of ['place', 'flip', 'match', 'miss', 'win', 'lose', 'draw', 'pop', 'tick']) playSound(name);
		expect(contexts[0].createOscillator.mock.calls.length).toBeGreaterThanOrEqual(9);
	});
});
