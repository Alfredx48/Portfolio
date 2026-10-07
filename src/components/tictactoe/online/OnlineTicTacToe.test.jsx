import { createMemoryHistory, MemoryRouter, Route } from '@solidjs/router';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@solidjs/testing-library';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakePeer, network } from './fake-peer';
import OnlineTicTacToe from './OnlineTicTacToe';

vi.mock('peerjs', async () => {
	const { FakePeer } = await import('./fake-peer');
	return { Peer: FakePeer };
});

const sounds = vi.hoisted(() => vi.fn());
vi.mock('../../../utils/sound', () => ({ playSound: sounds, muted: () => true, toggleMuted: () => {} }));

// Loaded up front so that dynamic imports resolve without real I/O while fake timers are on
beforeAll(() => import('peerjs'));

const mount = (url = '/tictactoe/online') => {
	const history = createMemoryHistory();
	history.set({ value: url, scroll: false });
	const { container, unmount } = render(() => (
		<MemoryRouter history={history}>
			<Route path="/tictactoe/online" component={OnlineTicTacToe} />
		</MemoryRouter>
	));
	return { ui: within(container), container, history, unmount };
};

const roomOf = (link) => new URL(link).searchParams.get('room');

// A host and a guest in the same document, each queried inside its own container
async function startGame() {
	const host = mount();
	fireEvent.click(await host.ui.findByRole('button', { name: 'Create game' }));
	const link = (await host.ui.findByLabelText('Game link')).value;
	const guest = mount(`/tictactoe/online?room=${roomOf(link)}`);
	await host.ui.findByRole('group', { name: 'Game board' });
	await guest.ui.findByRole('group', { name: 'Game board' });
	return { host, guest, link };
}

// The same, for tests that run on fake timers, where nothing can wait on a real timeout
const settle = async () => {
	for (let i = 0; i < 6; i++) await vi.advanceTimersByTimeAsync(0);
};
async function startGameOnFakeTimers() {
	const host = mount();
	fireEvent.click(host.ui.getByRole('button', { name: 'Create game' }));
	await settle();
	const link = host.ui.getByLabelText('Game link').value;
	const guest = mount(`/tictactoe/online?room=${roomOf(link)}`);
	await settle();
	return { host, guest, link };
}

const cell = (side, index) => side.ui.getAllByRole('button', { name: /^Row \d, column \d/ })[index];
const click = (side, index) => fireEvent.click(cell(side, index));
const status = (side) => side.container.querySelector('.ttt-status').textContent;
const marks = (side) => side.ui.getAllByRole('button', { name: /^Row \d, column \d/ }).map((c) => c.textContent);
const scores = (side) => [...side.container.querySelectorAll('.ttt-score-value')].map((n) => Number(n.textContent));
const hostPeer = () => [...network.peers.values()].find((p) => p.id.startsWith('alfred-ttt-'));
const sentBy = (from, type) => network.sent.filter((m) => m.from === from && m.data.type === type);
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

// X (host) wins along the top row: X 0, O 3, X 1, O 4, X 2
function playTopRowWin({ host, guest }) {
	click(host, 0);
	click(guest, 3);
	click(host, 1);
	click(guest, 4);
	click(host, 2);
}

beforeEach(() => {
	network.reset();
	sounds.mockClear();
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

describe('hosting', () => {
	it('shows a share link and the room code', async () => {
		const host = mount();
		expect(host.ui.getByText('Play a friend online')).toBeInTheDocument();
		fireEvent.click(host.ui.getByRole('button', { name: 'Create game' }));

		const input = await host.ui.findByLabelText('Game link');
		expect(input.value).toMatch(new RegExp(`^${location.origin}/tictactoe/online\\?room=[a-hj-km-np-z2-9]{6}$`));
		const room = roomOf(input.value);
		expect(host.container.querySelector('.ttto-code')).toHaveTextContent(room);
		expect(network.peers.has(`alfred-ttt-${room}`)).toBe(true);
		expect(host.ui.getByText('Waiting for your friend to join…')).toBeInTheDocument();
		expect(host.ui.getByRole('button', { name: 'Copy link' })).toBeInTheDocument();
		expect(document.title).toBe('Online TicTacToe | Alfred Shaheen');
	});

	it('copies the link', async () => {
		const writeText = vi.fn().mockResolvedValue();
		Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
		const host = mount();
		fireEvent.click(host.ui.getByRole('button', { name: 'Create game' }));
		const input = await host.ui.findByLabelText('Game link');
		fireEvent.click(host.ui.getByRole('button', { name: 'Copy link' }));
		await waitFor(() => expect(writeText).toHaveBeenCalledWith(input.value));
	});

	it('picks another code when one is taken', async () => {
		network.unavailableIds = 2;
		const host = mount();
		fireEvent.click(host.ui.getByRole('button', { name: 'Create game' }));
		expect(await host.ui.findByLabelText('Game link')).toBeInTheDocument();
		expect(network.peers.size).toBe(1);
		// The clashing attempts were cleaned up rather than left open
		expect(network.sockets.size).toBe(1);
	});

	it('gives up with a way to retry if the broker keeps refusing', async () => {
		network.unavailableIds = 99;
		const host = mount();
		fireEvent.click(host.ui.getByRole('button', { name: 'Create game' }));
		expect(await host.ui.findByRole('alert')).toBeInTheDocument();
		network.unavailableIds = 0;
		fireEvent.click(host.ui.getByRole('button', { name: 'Try again' }));
		expect(await host.ui.findByLabelText('Game link')).toBeInTheDocument();
	});

	it('times out while setting up if the broker never answers', async () => {
		vi.useFakeTimers();
		network.hangOpen = true;
		const host = mount();
		fireEvent.click(host.ui.getByRole('button', { name: 'Create game' }));
		await vi.advanceTimersByTimeAsync(9000);
		expect(host.ui.getByText('Setting up your game…')).toBeInTheDocument();
		await vi.advanceTimersByTimeAsync(1500);
		expect(host.ui.getByRole('alert')).toHaveTextContent(/matchmaking server/);
		expect(host.ui.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
		// The peer that never opened was destroyed, not left trying
		expect(network.sockets.size).toBe(0);

		network.hangOpen = false;
		fireEvent.click(host.ui.getByRole('button', { name: 'Try again' }));
		await settle();
		expect(host.ui.getByLabelText('Game link')).toBeInTheDocument();
	});
});

describe('joining', () => {
	it('connects from the link and the host plays X', async () => {
		const { host, guest } = await startGame();
		expect(status(host)).toBe('Your turn');
		expect(host.container).toHaveTextContent('You play X');
		expect(status(guest)).toBe('Waiting for your friend…');
		expect(guest.container).toHaveTextContent('You play O');
		expect(sentBy('host', 'hello')).toHaveLength(1);
		expect(sentBy('guest', 'hello')).toHaveLength(1);
		expect(sentBy('host', 'hello')[0].data.state).toEqual({ moves: [], game: 0, scores: { you: 0, draws: 0, friend: 0 } });
		expect(guest.ui.getByRole('link', { name: '← TicTacToe vs AI' })).toHaveAttribute('href', '/tictactoe');
		expect(guest.ui.getByText(/free PeerJS server only introduces you/)).toBeInTheDocument();
	});

	it('sends plain JSON strings, not PeerJS-parsed objects', async () => {
		await startGame();
		expect(network.pairs[0].guest.serialization).toBe('raw');
		expect(network.sent.every((m) => typeof m.raw === 'string')).toBe(true);
	});

	it('shows Connecting while it works on it', async () => {
		network.hang = true;
		const guest = mount('/tictactoe/online?room=abc234');
		expect(await guest.ui.findByText('Connecting')).toBeInTheDocument();
	});

	it('explains when the host is not there, and offers a way out', async () => {
		const guest = mount('/tictactoe/online?room=abc234');
		expect(await guest.ui.findByText(/Couldn't find that game/)).toBeInTheDocument();
		expect(guest.ui.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
		expect(network.sockets.size).toBe(0);

		fireEvent.click(guest.ui.getByRole('button', { name: 'Create your own game' }));
		expect(await guest.ui.findByLabelText('Game link')).toBeInTheDocument();
		expect(guest.history.get()).not.toContain('room=');
	});

	it('retries the same game', async () => {
		const host = mount();
		fireEvent.click(await host.ui.findByRole('button', { name: 'Create game' }));
		const room = roomOf((await host.ui.findByLabelText('Game link')).value);

		network.missNext = true;
		const guest = mount(`/tictactoe/online?room=${room}`);
		await guest.ui.findByText(/Couldn't find that game/);
		fireEvent.click(guest.ui.getByRole('button', { name: 'Try again' }));
		expect(await guest.ui.findByRole('group', { name: 'Game board' })).toBeInTheDocument();
		expect(status(host)).toBe('Your turn');
	});

	it('times out after ten seconds', async () => {
		vi.useFakeTimers();
		network.hang = true;
		const guest = mount('/tictactoe/online?room=abc234');
		await vi.advanceTimersByTimeAsync(9000);
		expect(guest.ui.queryByRole('alert')).not.toBeInTheDocument();
		await vi.advanceTimersByTimeAsync(1500);
		expect(guest.ui.getByRole('alert')).toHaveTextContent(/Couldn't reach your friend/);
		expect(guest.ui.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
		expect(guest.ui.getByRole('button', { name: 'Create your own game' })).toBeInTheDocument();
		expect(network.sockets.size).toBe(0);
	});

	it('rejects a link that is not a room code', async () => {
		const guest = mount('/tictactoe/online?room=%3Cimg%20src=x%3E');
		expect(await guest.ui.findByText(/doesn't look right/)).toBeInTheDocument();
		expect(guest.container.querySelector('img')).toBeNull();
		expect(guest.ui.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
		expect(guest.ui.getByRole('button', { name: 'Create your own game' })).toBeInTheDocument();
		expect(network.peers.size).toBe(0);
	});
});

describe('joining with a code', () => {
	const type = (side, value) => fireEvent.input(side.ui.getByLabelText('Join with code'), { target: { value } });
	const submit = (side) => fireEvent.click(side.ui.getByRole('button', { name: 'Join' }));

	it('joins from the bare code, in any case', async () => {
		const host = mount();
		fireEvent.click(await host.ui.findByRole('button', { name: 'Create game' }));
		const room = roomOf((await host.ui.findByLabelText('Game link')).value);

		const guest = mount();
		type(guest, ` ${room.toUpperCase()} `);
		submit(guest);
		expect(await guest.ui.findByRole('group', { name: 'Game board' })).toBeInTheDocument();
		expect(guest.history.get()).toContain(`room=${room}`);
		expect(status(host)).toBe('Your turn');
	});

	it('joins from the full id', async () => {
		const host = mount();
		fireEvent.click(await host.ui.findByRole('button', { name: 'Create game' }));
		const room = roomOf((await host.ui.findByLabelText('Game link')).value);

		const guest = mount();
		type(guest, `Alfred-TTT-${room}`);
		fireEvent.submit(guest.ui.getByRole('button', { name: 'Join' }).closest('form'));
		expect(await guest.ui.findByRole('group', { name: 'Game board' })).toBeInTheDocument();
	});

	it('rejects anything that is not a code, without going anywhere', async () => {
		const guest = mount();
		for (const bad of ['', 'abc', 'abc2345', 'abc 234', 'a0o1l!', '<img src=x>', 'other-ttt-abc234']) {
			type(guest, bad);
			submit(guest);
			expect(guest.ui.getByRole('alert')).toHaveTextContent("That doesn't look like a game code");
		}
		expect(guest.ui.getByText('Play a friend online')).toBeInTheDocument();
		expect(guest.history.get()).not.toContain('room=');
		expect(network.peers.size).toBe(0);

		type(guest, 'abc234');
		submit(guest);
		expect(guest.ui.queryByRole('alert', { name: '' })?.textContent ?? '').not.toContain("doesn't look");
	});
});

describe('a full room', () => {
	it('tells a third player the game is full instead of timing out', async () => {
		const { host, guest, link } = await startGame();
		const third = mount(`/tictactoe/online?room=${roomOf(link)}`);
		expect(await third.ui.findByText(/This game already has two players/)).toBeInTheDocument();
		expect(third.ui.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
		expect(third.ui.getByRole('button', { name: 'Create your own game' })).toBeInTheDocument();
		expect(network.sent.some((m) => m.from === 'host' && m.data.type === 'full')).toBe(true);

		// The game in progress is untouched
		expect(status(host)).toBe('Your turn');
		click(host, 4);
		expect(marks(guest)[4]).toBe('X');
		await waitFor(() => expect(network.pairs[1].host.closed).toBe(true));
	});
});

describe('playing', () => {
	it('syncs moves both ways', async () => {
		const { host, guest } = await startGame();

		click(host, 4);
		expect(marks(host)[4]).toBe('X');
		expect(marks(guest)[4]).toBe('X');
		expect(status(host)).toBe('Waiting for your friend…');
		expect(status(guest)).toBe('Your turn');

		click(guest, 0);
		expect(marks(host)[0]).toBe('O');
		expect(marks(guest)).toEqual(marks(host));
		expect(status(host)).toBe('Your turn');
		expect(network.sent.filter((m) => m.data.type === 'move').map((m) => m.data)).toEqual([
			{ type: 'move', index: 4, seq: 0 },
			{ type: 'move', index: 0, seq: 1 },
		]);
		expect(sounds).toHaveBeenCalledWith('place');
	});

	it("won't let you play out of turn", async () => {
		const { host, guest } = await startGame();
		expect(cell(guest, 0)).toBeDisabled();
		fireEvent.click(cell(guest, 0));
		expect(marks(host)).toEqual(Array(9).fill(''));
		click(host, 4);
		expect(cell(host, 0)).toBeDisabled();
		expect(cell(host, 4)).toBeDisabled();
	});

	it('shows the mark once, in the note and not the status', async () => {
		const { host } = await startGame();
		expect(status(host)).not.toMatch(/\bX\b/);
		expect(host.container.querySelector('.ttto-note')).toHaveTextContent('You play X');
	});

	it('detects a win on both sides and keeps score', async () => {
		const pair = await startGame();
		playTopRowWin(pair);
		const { host, guest } = pair;
		expect(status(host)).toBe('You win! 🎉');
		expect(status(guest)).toBe('Your friend wins');
		expect(host.container.querySelector('.ttt-win-line')).toBeInTheDocument();
		expect(guest.container.querySelector('.ttt-win-line')).toBeInTheDocument();
		expect(host.container.querySelectorAll('.ttt-cell.winning')).toHaveLength(3);
		expect(scores(host)).toEqual([1, 0, 0]);
		expect(scores(guest)).toEqual([0, 0, 1]);
		expect(sounds).toHaveBeenCalledWith('win');
		expect(sounds).toHaveBeenCalledWith('lose');
		// No more moves, from anyone
		expect(cell(guest, 8)).toBeDisabled();
	});

	it('detects a draw, early or not', async () => {
		const { host, guest } = await startGame();
		// X O X / X O O / O X X  is a full-board draw
		for (const [side, index] of [[host, 0], [guest, 1], [host, 2], [guest, 4], [host, 3], [guest, 5], [host, 7], [guest, 6], [host, 8]]) click(side, index);
		expect(status(host)).toMatch(/draw/i);
		expect(status(guest)).toMatch(/draw/i);
		expect(scores(host)).toEqual([0, 1, 0]);
		expect(sounds).toHaveBeenCalledWith('draw');
	});
});

describe('untrusted messages', () => {
	// What the guest's browser could send to the host, whatever the guest's UI would allow, as a wire frame
	const toHost = (data) => network.pairs[0].host.emit('data', typeof data === 'string' ? data : JSON.stringify(data));
	const toGuest = (data) => network.pairs[0].guest.emit('data', typeof data === 'string' ? data : JSON.stringify(data));

	it('ignores malformed messages, however they arrive', async () => {
		const { host, guest } = await startGame();
		const bad = [null, undefined, 'move', 7, [], {}, { type: 'move' }, { type: 'nope' }, { type: 'move', index: '4', seq: 0 }, { type: 'move', index: 4.5, seq: 0 }, { type: 'move', index: -1, seq: 0 }, { type: 'move', index: 9, seq: 0 }];
		for (const data of bad) {
			// Both as the object itself (which PeerJS never gives us in raw mode) and as a JSON frame
			network.pairs[0].host.emit('data', data);
			network.pairs[0].guest.emit('data', data);
			if (data !== undefined) {
				toHost(data);
				toGuest(data);
			}
		}
		expect(marks(host)).toEqual(Array(9).fill(''));
		expect(marks(guest)).toEqual(Array(9).fill(''));
		expect(status(host)).toBe('Your turn');
	});

	it('survives frames that are not JSON, not strings or far too big', async () => {
		const { host, guest } = await startGame();
		const frames = ['', '{', '{"type":"bye"', 'undefined', "{'type':'bye'}", new ArrayBuffer(8), new Uint8Array([123, 125]), new Blob(['{"type":"bye"}']), '{"type":"bye","pad":"' + 'x'.repeat(5000) + '"}'];
		for (const frame of frames) {
			expect(() => network.pairs[0].host.emit('data', frame)).not.toThrow();
			expect(() => network.pairs[0].guest.emit('data', frame)).not.toThrow();
		}
		// None of them was taken for a goodbye
		expect(status(host)).toBe('Your turn');
		expect(host.ui.getByRole('group', { name: 'Game board' })).toBeInTheDocument();
		expect(guest.ui.getByRole('group', { name: 'Game board' })).toBeInTheDocument();
	});

	it('ignores moves out of turn, onto taken cells and with the wrong seq', async () => {
		const { host, guest } = await startGame();
		toHost({ type: 'move', index: 0, seq: 0 }); // the guest is O, but it is X's turn
		expect(marks(host)[0]).toBe('');

		click(host, 4);
		toHost({ type: 'move', index: 4, seq: 1 }); // taken
		toHost({ type: 'move', index: 0, seq: 0 }); // stale seq
		toHost({ type: 'move', index: 0, seq: 2 }); // skips ahead
		expect(marks(host)[0]).toBe('');
		expect(marks(host)[4]).toBe('X');

		toHost({ type: 'move', index: 0, seq: 1 }); // finally a good one
		expect(marks(host)[0]).toBe('O');
		toHost({ type: 'move', index: 1, seq: 1 }); // a replay of seq 1, now X's turn anyway
		expect(marks(host)[1]).toBe('');
		expect(marks(guest)[1]).toBe('');
	});

	it('ignores moves after the game has ended', async () => {
		const pair = await startGame();
		playTopRowWin(pair);
		toHost({ type: 'move', index: 8, seq: 5 });
		toGuest({ type: 'move', index: 8, seq: 5 });
		expect(marks(pair.host)[8]).toBe('');
		expect(marks(pair.guest)[8]).toBe('');
	});

	it('never renders what the other side sends as markup', async () => {
		const { host } = await startGame();
		const payload = '<img src=x onerror=alert(1)>';
		toHost({ type: 'hello', version: 1, name: payload });
		toHost({ type: 'move', index: payload, seq: 0 });
		toHost({ type: 'move', index: 1, seq: 0, html: payload, label: payload });
		click(host, 4);
		toHost({ type: 'move', index: 1, seq: 1, html: payload });
		expect(host.container.querySelector('img')).toBeNull();
		expect(host.container.innerHTML).not.toContain('onerror');
	});

	it('ignores an unsolicited rematch-accept and a rematch mid-game', async () => {
		const { host } = await startGame();
		click(host, 4);
		toHost({ type: 'rematch' });
		toHost({ type: 'rematch-accept' });
		expect(marks(host)[4]).toBe('X');
		expect(host.ui.queryByText('Your friend wants a rematch')).not.toBeInTheDocument();
	});

	it('does not start a game from an accept nobody asked for', async () => {
		const pair = await startGame();
		playTopRowWin(pair);
		toGuest({ type: 'rematch-accept' });
		expect(marks(pair.guest)[0]).toBe('X');
		expect(status(pair.guest)).toBe('Your friend wins');
	});

	it('cannot rewind or overwrite a game with a later hello', async () => {
		const { host, guest } = await startGame();
		click(host, 4);
		toGuest({ type: 'hello', version: 1, state: { moves: [], game: 0, scores: { you: 0, draws: 0, friend: 0 } } });
		toGuest({ type: 'hello', version: 1, state: { moves: [0, 1, 2, 3], game: 5, scores: { you: 0, draws: 0, friend: 0 } } });
		expect(marks(guest)[4]).toBe('X');
		expect(scores(guest)).toEqual([0, 0, 0]);
	});

	it('does not let a guest push its own game state onto the host', async () => {
		const { host } = await startGame();
		toHost({ type: 'hello', version: 1, state: { moves: [0, 3, 1, 4, 2], game: 0, scores: { you: 0, draws: 0, friend: 1 } } });
		expect(marks(host)).toEqual(Array(9).fill(''));
		expect(scores(host)).toEqual([0, 0, 0]);
	});

	it('turns away connections that are not using our wire format', async () => {
		const host = mount();
		fireEvent.click(await host.ui.findByRole('button', { name: 'Create game' }));
		const room = roomOf((await host.ui.findByLabelText('Game link')).value);

		const stranger = new FakePeer();
		await tick();
		for (const serialization of ['binary', 'binary-utf8', 'json', undefined]) {
			const attempt = stranger.connect(`alfred-ttt-${room}`, { serialization });
			await tick();
			expect(attempt.closed).toBe(true);
		}
		expect(host.ui.getByText('Waiting for your friend to join…')).toBeInTheDocument();

		// A real guest can still get in afterwards
		const guest = mount(`/tictactoe/online?room=${room}`);
		expect(await guest.ui.findByRole('group', { name: 'Game board' })).toBeInTheDocument();
	});
});

describe('rematch', () => {
	it('needs both players, and swaps who starts', async () => {
		const pair = await startGame();
		playTopRowWin(pair);
		const { host, guest } = pair;

		fireEvent.click(guest.ui.getByRole('button', { name: 'Rematch' }));
		expect(guest.ui.getByRole('button', { name: 'Waiting…' })).toBeDisabled();
		expect(guest.container).toHaveTextContent('Rematch requested…');
		// Nothing starts until the host agrees
		expect(marks(host)[0]).toBe('X');
		expect(host.container).toHaveTextContent('Your friend wants a rematch');

		fireEvent.click(host.ui.getByRole('button', { name: 'Accept' }));
		expect(marks(host)).toEqual(Array(9).fill(''));
		expect(marks(guest)).toEqual(Array(9).fill(''));
		// The old O is X now and moves first
		expect(status(guest)).toBe('Your turn');
		expect(guest.container).toHaveTextContent('You play X');
		expect(status(host)).toBe('Waiting for your friend…');
		expect(host.container).toHaveTextContent('You play O');
		// Scores carry over
		expect(scores(host)).toEqual([1, 0, 0]);

		click(guest, 4);
		expect(marks(host)[4]).toBe('X');
		click(host, 0);
		expect(marks(guest)[0]).toBe('O');
	});

	it('swaps back on the next rematch', async () => {
		const pair = await startGame();
		playTopRowWin(pair);
		const { host, guest } = pair;
		fireEvent.click(guest.ui.getByRole('button', { name: 'Rematch' }));
		fireEvent.click(host.ui.getByRole('button', { name: 'Accept' }));
		// Guest (X) wins on the left column: X 0, O 1, X 3, O 2, X 6
		for (const [side, index] of [[guest, 0], [host, 1], [guest, 3], [host, 2], [guest, 6]]) click(side, index);
		expect(status(guest)).toBe('You win! 🎉');
		fireEvent.click(host.ui.getByRole('button', { name: 'Rematch' }));
		fireEvent.click(guest.ui.getByRole('button', { name: 'Accept' }));
		expect(status(host)).toBe('Your turn');
		expect(status(guest)).toBe('Waiting for your friend…');
	});

	it('starts when both ask at the same time', async () => {
		const pair = await startGame();
		playTopRowWin(pair);
		const { host, guest } = pair;
		fireEvent.click(host.ui.getByRole('button', { name: 'Rematch' }));
		// The friend's own request is already on the wire, so it crosses ours
		fireEvent.click(guest.ui.getByRole('button', { name: 'Accept' }));
		expect(marks(host)).toEqual(Array(9).fill(''));
		expect(marks(guest)).toEqual(Array(9).fill(''));
		expect(status(guest)).toBe('Your turn');
	});

	it('only offers a rematch when the game is over', async () => {
		const { host } = await startGame();
		expect(host.ui.queryByRole('button', { name: 'Rematch' })).not.toBeInTheDocument();
	});
});

describe('when the friend goes', () => {
	it('keeps the room open for them when the connection closes', async () => {
		const { host, guest, link } = await startGame();
		click(host, 4);
		network.pairs[0].guest.close();
		expect(host.ui.getByRole('heading', { name: 'Your friend left' })).toBeInTheDocument();
		expect(host.ui.getByText('They can rejoin with the same link.')).toBeInTheDocument();
		expect(host.ui.getByLabelText('Game link').value).toBe(link);
		expect(host.ui.getByText('Waiting for your friend to join…')).toBeInTheDocument();
		// Nothing is left of the old connection, but the room is still on the broker
		expect(network.peers.size).toBe(1);
		expect(status(guest)).toBe('Your friend left');
	});

	it('does the same on an error or a goodbye', async () => {
		const { host } = await startGame();
		network.pairs[0].host.emit('error', new Error('boom'));
		expect(host.ui.getByRole('heading', { name: 'Your friend left' })).toBeInTheDocument();

		const again = await startGame();
		network.pairs.at(-1).host.emit('data', JSON.stringify({ type: 'bye' }));
		expect(again.host.ui.getAllByRole('heading', { name: 'Your friend left' }).length).toBeGreaterThan(0);
	});

	it('tells a guest that the host left', async () => {
		const { host, guest } = await startGame();
		host.unmount();
		expect(status(guest)).toBe('Your friend left');
		expect(guest.ui.getByRole('button', { name: 'Create a new game' })).toBeInTheDocument();
		expect(cell(guest, 0)).toBeDisabled();
		expect(sentBy('host', 'bye')).toHaveLength(1);
	});

	it('tells the guest when the host says bye', async () => {
		const { guest } = await startGame();
		network.pairs[0].guest.emit('data', JSON.stringify({ type: 'bye' }));
		expect(status(guest)).toBe('Your friend left');
	});

	it('starts a fresh game from the left screen', async () => {
		const { host, guest } = await startGame();
		host.unmount();
		fireEvent.click(guest.ui.getByRole('button', { name: 'Create a new game' }));
		expect(await guest.ui.findByLabelText('Game link')).toBeInTheDocument();
		expect(guest.ui.getByText('Waiting for your friend to join…')).toBeInTheDocument();
	});

	it('says goodbye and cleans up when the page is left', async () => {
		const { host, guest } = await startGame();
		host.unmount();
		expect([...network.peers.keys()].some((id) => id.startsWith('alfred-ttt-'))).toBe(false);
		expect(status(guest)).toBe('Your friend left');
	});
});

describe('reloading mid-game', () => {
	it('brings a returning friend up to date, scores included', async () => {
		const pair = await startGame();
		const { host, guest, link } = pair;
		playTopRowWin(pair);
		fireEvent.click(guest.ui.getByRole('button', { name: 'Rematch' }));
		fireEvent.click(host.ui.getByRole('button', { name: 'Accept' }));
		click(guest, 4); // game 2: the guest is X
		click(host, 0);
		guest.unmount();
		expect(host.ui.getByText('They can rejoin with the same link.')).toBeInTheDocument();

		const back = mount(link);
		await back.ui.findByRole('group', { name: 'Game board' });
		await host.ui.findByRole('group', { name: 'Game board' });
		expect(marks(back)).toEqual(marks(host));
		expect(marks(back)[4]).toBe('X');
		expect(marks(back)[0]).toBe('O');
		expect(scores(host)).toEqual([1, 0, 0]);
		expect(scores(back)).toEqual([0, 0, 1]);
		expect(status(back)).toBe('Your turn');
		expect(back.container).toHaveTextContent('You play X');
		expect(status(host)).toBe('Waiting for your friend…');

		// And it carries on from there
		click(back, 8);
		expect(marks(host)[8]).toBe('X');
		click(host, 2);
		expect(marks(back)[2]).toBe('O');
		expect(sounds.mock.calls.filter(([name]) => name === 'win' || name === 'lose')).toHaveLength(2);
	});

	it('does not score a finished game a second time', async () => {
		const pair = await startGame();
		const { host, guest, link } = pair;
		playTopRowWin(pair);
		guest.unmount();
		const back = mount(link);
		await back.ui.findByRole('group', { name: 'Game board' });
		expect(status(back)).toBe('Your friend wins');
		expect(scores(back)).toEqual([0, 0, 1]);
		expect(scores(host)).toEqual([1, 0, 0]);
		expect(sounds.mock.calls.filter(([name]) => name === 'lose')).toHaveLength(1);
		// The rematch still works
		fireEvent.click(back.ui.getByRole('button', { name: 'Rematch' }));
		fireEvent.click(host.ui.getByRole('button', { name: 'Accept' }));
		expect(status(back)).toBe('Your turn');
	});

	it('resets the rematch offer when the friend leaves', async () => {
		const pair = await startGame();
		const { host, guest, link } = pair;
		playTopRowWin(pair);
		fireEvent.click(guest.ui.getByRole('button', { name: 'Rematch' }));
		expect(host.container).toHaveTextContent('Your friend wants a rematch');
		guest.unmount();
		const back = mount(link);
		await back.ui.findByRole('group', { name: 'Game board' });
		expect(host.container).not.toHaveTextContent('Your friend wants a rematch');
		expect(host.ui.getByRole('button', { name: 'Rematch' })).toBeEnabled();
	});

	describe('trusting nobody about the saved game', () => {
		const good = { moves: [4, 0], game: 0, scores: { you: 0, draws: 0, friend: 0 } };

		// A stand-in host that says whatever it likes
		const imposter = async (hello) => {
			const fake = new FakePeer('alfred-ttt-abc234');
			fake.on('connection', (c) => c.on('open', () => c.send(typeof hello === 'string' ? hello : JSON.stringify(hello))));
			await tick();
			return fake;
		};

		it('accepts a consistent state', async () => {
			await imposter({ type: 'hello', version: 1, state: good });
			const guest = mount('/tictactoe/online?room=abc234');
			await guest.ui.findByRole('group', { name: 'Game board' });
			expect(marks(guest)[4]).toBe('X');
			expect(marks(guest)[0]).toBe('O');
			expect(status(guest)).toBe('Waiting for your friend…');
		});

		it('accepts a finished game and its score without counting it again', async () => {
			await imposter({ type: 'hello', version: 1, state: { moves: [0, 3, 1, 4, 2], game: 0, scores: { you: 1, draws: 0, friend: 0 } } });
			const guest = mount('/tictactoe/online?room=abc234');
			await guest.ui.findByRole('group', { name: 'Game board' });
			expect(status(guest)).toBe('Your friend wins');
			expect(scores(guest)).toEqual([0, 0, 1]);
			expect(sounds).not.toHaveBeenCalledWith('lose');
		});

		it('works out whose turn a later game is from the game number', async () => {
			await imposter({ type: 'hello', version: 1, state: { moves: [], game: 1, scores: { you: 1, draws: 0, friend: 0 } } });
			const guest = mount('/tictactoe/online?room=abc234');
			await guest.ui.findByRole('group', { name: 'Game board' });
			expect(status(guest)).toBe('Your turn');
		});

		const bad = {
			'repeats a cell': { ...good, moves: [4, 4] },
			'plays on after a win': { moves: [0, 3, 1, 4, 2, 5], game: 0, scores: { you: 1, draws: 0, friend: 0 } },
			'has too many moves': { moves: [0, 1, 2, 3, 4, 5, 6, 7, 8, 8], game: 0, scores: { you: 0, draws: 1, friend: 0 } },
			'has a move off the board': { ...good, moves: [4, 9] },
			'has a fractional move': { ...good, moves: [4, 0.5] },
			'has scores that do not add up': { ...good, scores: { you: 1, draws: 0, friend: 0 } },
			'forgets a finished game': { moves: [0, 3, 1, 4, 2], game: 0, scores: { you: 0, draws: 0, friend: 0 } },
			'has an impossible game number': { ...good, game: 3 },
			'has a negative score': { ...good, game: 1, scores: { you: -1, draws: 1, friend: 1 } },
			'has a text game number': { ...good, game: '0' },
			'has moves that are not a list': { ...good, moves: '40' },
			'has no scores': { moves: [], game: 0 },
		};
		for (const [name, state] of Object.entries(bad)) {
			it(`rejects a state that ${name}`, async () => {
				await imposter({ type: 'hello', version: 1, state });
				const guest = mount('/tictactoe/online?room=abc234');
				expect(await guest.ui.findByRole('alert')).toBeInTheDocument();
				expect(guest.ui.queryByRole('group', { name: 'Game board' })).not.toBeInTheDocument();
			});
		}

		it('rejects a host from another version', async () => {
			await imposter({ type: 'hello', version: 2, state: good });
			const guest = mount('/tictactoe/online?room=abc234');
			expect(await guest.ui.findByRole('alert')).toHaveTextContent(/different version/);
			expect(guest.ui.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
		});

		it('does not take moves or a rematch from a host that has not said hello', async () => {
			await imposter(JSON.stringify({ type: 'move', index: 0, seq: 0 }));
			const guest = mount('/tictactoe/online?room=abc234');
			await tick();
			await tick();
			expect(guest.ui.getByText('Connecting')).toBeInTheDocument();
			expect(guest.ui.queryByRole('group', { name: 'Game board' })).not.toBeInTheDocument();
		});
	});
});

describe('noticing a friend who vanished', () => {
	// Only the clock is faked, so everything else waits on real time as usual
	const fakeClock = () => vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });

	it('pings every five seconds and answers pings', async () => {
		fakeClock();
		await startGame();
		vi.advanceTimersByTime(5000);
		expect(sentBy('host', 'ping')).toHaveLength(1);
		expect(sentBy('guest', 'ping')).toHaveLength(1);
		expect(sentBy('host', 'pong')).toHaveLength(1);
		expect(sentBy('guest', 'pong')).toHaveLength(1);
		vi.advanceTimersByTime(5000);
		expect(sentBy('host', 'ping')).toHaveLength(2);
	});

	it('stays put while the pongs keep coming', async () => {
		fakeClock();
		const { host, guest } = await startGame();
		vi.advanceTimersByTime(120000);
		expect(host.ui.getByRole('group', { name: 'Game board' })).toBeInTheDocument();
		expect(status(guest)).toBe('Waiting for your friend…');
	});

	it('notices after fifteen seconds of silence, on both sides', async () => {
		fakeClock();
		const { host, guest } = await startGame();
		vi.advanceTimersByTime(10000);
		network.pairs[0].host.muted = true; // the guest's tab crashes, or the phone sleeps. No close, no bye.

		vi.advanceTimersByTime(10000);
		expect(host.ui.getByRole('group', { name: 'Game board' })).toBeInTheDocument();
		vi.advanceTimersByTime(10000);
		expect(host.ui.getByRole('heading', { name: 'Your friend left' })).toBeInTheDocument();
		expect(status(guest)).toBe('Your friend left');
	});

	it('clears its timers when the friend goes, and when the page is left', async () => {
		fakeClock();
		const { host, guest } = await startGame();
		expect(vi.getTimerCount()).toBe(2);
		guest.unmount();
		// The host is waiting again, so only waiting remains
		expect(vi.getTimerCount()).toBe(0);
		host.unmount();
		expect(vi.getTimerCount()).toBe(0);
	});

	it('ignores a ping or pong that arrives before there is a game, and never answers a flood with one', async () => {
		fakeClock();
		const { host } = await startGame();
		const before = network.sent.length;
		network.pairs[0].host.emit('data', JSON.stringify({ type: 'pong' }));
		expect(network.sent.length).toBe(before);
		expect(status(host)).toBe('Your turn');
	});
});

describe('no leaked broker sockets', () => {
	it('closes every socket after a few create and leave cycles', async () => {
		for (let i = 0; i < 4; i++) {
			const host = mount();
			fireEvent.click(await host.ui.findByRole('button', { name: 'Create game' }));
			await host.ui.findByLabelText('Game link');
			host.unmount();
		}
		await tick();
		await tick();
		expect(network.sockets.size).toBe(0);
		expect(network.peers.size).toBe(0);
	});

	it('closes them after a game, for both players', async () => {
		const { host, guest } = await startGame();
		click(host, 4);
		guest.unmount();
		host.unmount();
		await tick();
		await tick();
		expect(network.sockets.size).toBe(0);
		expect(network.peers.size).toBe(0);
	});

	it('closes them when leaving mid-setup', async () => {
		network.hangOpen = true;
		const host = mount();
		fireEvent.click(host.ui.getByRole('button', { name: 'Create game' }));
		await tick();
		host.unmount();
		await tick();
		expect(network.sockets.size).toBe(0);
	});

	it('closes them when a guest fails or is turned away', async () => {
		const lost = mount('/tictactoe/online?room=abc234');
		await lost.ui.findByText(/Couldn't find that game/);
		expect(network.sockets.size).toBe(0);

		const { host, guest, link } = await startGame();
		const third = mount(`/tictactoe/online?room=${roomOf(link)}`);
		await third.ui.findByText(/already has two players/);
		await tick();
		// The host and its first guest, and nothing from the third
		expect(network.sockets.size).toBe(2);
		third.unmount();
		host.unmount();
		guest.unmount();
		await tick();
		expect(network.sockets.size).toBe(0);
	});

	it('does not keep an abandoned room registered', async () => {
		const host = mount();
		fireEvent.click(await host.ui.findByRole('button', { name: 'Create game' }));
		const link = (await host.ui.findByLabelText('Game link')).value;
		host.unmount();
		await tick();

		// A friend opening the old link is told at once that it is gone, rather than waiting on a timeout
		const guest = mount(`/tictactoe/online?room=${roomOf(link)}`);
		expect(await guest.ui.findByText(/Couldn't find that game/)).toBeInTheDocument();
	});
});

describe('the matchmaking server dropping out', () => {
	it('reconnects a waiting host with the same link', async () => {
		vi.useFakeTimers();
		const host = mount();
		fireEvent.click(host.ui.getByRole('button', { name: 'Create game' }));
		await settle();
		const link = host.ui.getByLabelText('Game link').value;
		const peer = hostPeer();

		network.dropBroker(peer);
		expect(network.peers.size).toBe(0);
		// Still waiting, not failed
		expect(host.ui.getByLabelText('Game link').value).toBe(link);
		expect(host.ui.queryByRole('alert')).not.toBeInTheDocument();

		await vi.advanceTimersByTimeAsync(999);
		expect(network.peers.size).toBe(0);
		await vi.advanceTimersByTimeAsync(2);
		expect(network.peers.get(`alfred-ttt-${roomOf(link)}`)).toBe(peer);

		// The shared link works again
		const guest = mount(link);
		await settle();
		expect(guest.ui.getByRole('group', { name: 'Game board' })).toBeInTheDocument();
		expect(host.ui.getByRole('group', { name: 'Game board' })).toBeInTheDocument();
	});

	it('backs off 1s, 2s, then 4s and gives up after three tries', async () => {
		vi.useFakeTimers();
		const host = mount();
		fireEvent.click(host.ui.getByRole('button', { name: 'Create game' }));
		await settle();
		const peer = hostPeer();
		const reconnect = vi.spyOn(peer, 'reconnect');
		network.brokerDown = true;

		network.dropBroker(peer);
		await vi.advanceTimersByTimeAsync(1000);
		expect(reconnect).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(1900);
		expect(reconnect).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(200);
		expect(reconnect).toHaveBeenCalledTimes(2);
		await vi.advanceTimersByTimeAsync(3800);
		expect(reconnect).toHaveBeenCalledTimes(2);
		await vi.advanceTimersByTimeAsync(400);
		expect(reconnect).toHaveBeenCalledTimes(3);
		await settle();

		expect(host.ui.getByRole('alert')).toHaveTextContent(/matchmaking server/);
		expect(host.ui.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
		expect(network.sockets.size).toBe(0);
	});

	it('starts counting again once it is back', async () => {
		vi.useFakeTimers();
		const host = mount();
		fireEvent.click(host.ui.getByRole('button', { name: 'Create game' }));
		await settle();
		const peer = hostPeer();
		const reconnect = vi.spyOn(peer, 'reconnect');

		for (let drop = 0; drop < 5; drop++) {
			network.dropBroker(peer);
			await vi.advanceTimersByTimeAsync(1100);
			expect(network.peers.size).toBe(1);
		}
		expect(reconnect).toHaveBeenCalledTimes(5);
		expect(host.ui.queryByRole('alert')).not.toBeInTheDocument();
	});

	it('also copes when only the disconnect is reported', async () => {
		vi.useFakeTimers();
		const host = mount();
		fireEvent.click(host.ui.getByRole('button', { name: 'Create game' }));
		await settle();
		hostPeer().disconnect();
		await vi.advanceTimersByTimeAsync(1100);
		expect(network.peers.size).toBe(1);
	});

	it('does not matter once a friend is connected', async () => {
		vi.useFakeTimers();
		const { host, guest } = await startGameOnFakeTimers();
		const peer = hostPeer() ?? [...network.sockets].find((p) => p.requestedId);
		const reconnect = vi.spyOn(peer, 'reconnect');
		network.dropBroker(peer);
		network.dropBroker([...network.sockets].find((p) => !p.requestedId));
		await vi.advanceTimersByTimeAsync(10000);

		expect(reconnect).not.toHaveBeenCalled();
		expect(host.ui.queryByRole('alert')).not.toBeInTheDocument();
		click(host, 4);
		expect(marks(guest)[4]).toBe('X');
		click(guest, 0);
		expect(marks(host)[0]).toBe('O');
	});

	it('reconnects after a friend leaves if the broker went away meanwhile', async () => {
		vi.useFakeTimers();
		const { host, guest, link } = await startGameOnFakeTimers();
		const peer = [...network.sockets].find((p) => p.requestedId);
		network.dropBroker(peer);
		guest.unmount();
		await vi.advanceTimersByTimeAsync(1100);
		expect(network.peers.get(`alfred-ttt-${roomOf(link)}`)).toBe(peer);
		expect(host.ui.getByRole('heading', { name: 'Your friend left' })).toBeInTheDocument();
	});

	it('does not reconnect a peer that has been destroyed', async () => {
		vi.useFakeTimers();
		const host = mount();
		fireEvent.click(host.ui.getByRole('button', { name: 'Create game' }));
		await settle();
		const peer = hostPeer();
		const reconnect = vi.spyOn(peer, 'reconnect');
		host.unmount();
		await vi.advanceTimersByTimeAsync(10000);
		expect(reconnect).not.toHaveBeenCalled();
		expect(network.sockets.size).toBe(0);
	});

	it('fails a joining guest, rather than retrying, if the broker drops first', async () => {
		network.hang = true;
		const guest = mount('/tictactoe/online?room=abc234');
		await tick();
		await tick();
		const peer = [...network.sockets][0];
		network.dropBroker(peer);
		expect(await guest.ui.findByRole('alert')).toHaveTextContent(/matchmaking server/);
		expect(network.sockets.size).toBe(0);
	});
});
