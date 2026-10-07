import { describe, expect, it } from 'vitest';
import { cellsFrom, checkMove, checkState, decodeFrame, encodeFrame, flipScores, makeRoomCode, markFor, messages, parseMessage, parseRoomCode, peerId, PROTOCOL_VERSION } from './protocol';

const board = (s) => s.split('').map((c) => (c === '.' ? '' : c));

describe('room codes', () => {
	it('makes readable six character codes', () => {
		for (let i = 0; i < 50; i++) expect(makeRoomCode()).toMatch(/^[a-hj-km-np-z2-9]{6}$/);
	});

	it('uses the injected random source', () => {
		expect(makeRoomCode(() => 0)).toBe('aaaaaa');
	});

	it('accepts a code in any case with stray spaces', () => {
		expect(parseRoomCode(' AbC234 ')).toBe('abc234');
	});

	it('accepts the full peer id as well as the bare code', () => {
		expect(parseRoomCode('alfred-ttt-abc234')).toBe('abc234');
		expect(parseRoomCode(' Alfred-TTT-ABC234 ')).toBe('abc234');
		expect(parseRoomCode(peerId('abc234'))).toBe('abc234');
	});

	it('rejects anything that is not a code', () => {
		for (const bad of [undefined, null, 42, ['abc234'], '', 'abc23', 'abc2345', 'abc 23', 'abc0o1', 'a/../b2', '<img src=x>', 'alfred-ttt-', 'alfred-ttt-abc23', 'alfred-ttt-alfred-ttt-abc234', 'other-ttt-abc234', 'alfred-ttt-abc2340']) {
			expect(parseRoomCode(bad)).toBeNull();
		}
	});

	it('prefixes peer ids', () => {
		expect(peerId('abc234')).toBe('alfred-ttt-abc234');
	});
});

describe('markFor', () => {
	it('gives the host X first, then swaps every game', () => {
		expect([0, 1, 2, 3].map((g) => markFor('host', g))).toEqual(['X', 'O', 'X', 'O']);
		expect([0, 1, 2, 3].map((g) => markFor('guest', g))).toEqual(['O', 'X', 'O', 'X']);
	});
});

describe('cellsFrom', () => {
	it('alternates from X', () => {
		expect(cellsFrom([4, 0, 8])).toEqual(board('O...X...X'));
		expect(cellsFrom([])).toEqual(Array(9).fill(''));
	});
});

describe('parseMessage', () => {
	it('round-trips what we send', () => {
		expect(parseMessage(messages.hello())).toEqual({ type: 'hello', version: PROTOCOL_VERSION });
		expect(parseMessage(messages.hello({ name: 'Sam' }))).toEqual({ type: 'hello', name: 'Sam', version: PROTOCOL_VERSION });
		expect(parseMessage(messages.move(4, 2))).toEqual({ type: 'move', index: 4, seq: 2 });
		for (const type of ['rematch', 'rematchAccept', 'bye', 'full', 'ping', 'pong']) {
			const message = messages[type]();
			expect(parseMessage(message)).toEqual({ type: message.type });
		}
	});

	it('rejects non-objects and unknown types', () => {
		for (const bad of [null, undefined, 'move', 5, true, [], [{ type: 'bye' }], {}, { type: 'nope' }, { type: 7 }, { type: ['bye'] }]) {
			expect(parseMessage(bad)).toBeNull();
		}
	});

	it('rejects moves with bad indexes', () => {
		for (const index of [-1, 9, 1.5, NaN, Infinity, '4', null, undefined, [4], { valueOf: () => 4 }]) {
			expect(parseMessage({ type: 'move', index, seq: 0 })).toBeNull();
		}
	});

	it('rejects moves with bad seq values', () => {
		for (const seq of [-1, 1.5, NaN, '0', null, undefined]) {
			expect(parseMessage({ type: 'move', index: 0, seq })).toBeNull();
		}
	});

	it('rejects a hello with a bad version or name', () => {
		expect(parseMessage({ type: 'hello' })).toBeNull();
		expect(parseMessage({ type: 'hello', version: '1' })).toBeNull();
		expect(parseMessage({ type: 'hello', version: 0 })).toBeNull();
		expect(parseMessage({ type: 'hello', version: 1, name: 5 })).toBeNull();
	});

	it('cleans up names', () => {
		const message = parseMessage({ type: 'hello', version: 1, name: `  A\u0000l\nex${'x'.repeat(50)}` });
		expect(message.name).toHaveLength(24);
		expect(message.name.startsWith('Alexx')).toBe(true);
	});

	it('carries a game state in a hello', () => {
		const state = { moves: [4, 0], game: 2, scores: { you: 1, draws: 1, friend: 0 } };
		expect(parseMessage(messages.hello({ state }))).toEqual({ type: 'hello', version: PROTOCOL_VERSION, state });
	});

	it('marks a malformed state as null instead of trusting or dropping it', () => {
		const good = { moves: [4], game: 0, scores: { you: 0, draws: 0, friend: 0 } };
		const bad = [null, 'x', [], {}, { ...good, moves: '4' }, { ...good, moves: [9] }, { ...good, moves: [1.5] }, { ...good, moves: Array(10).fill(1) }, { ...good, game: -1 }, { ...good, game: 1000 }, { ...good, game: '0' }, { ...good, scores: null }, { ...good, scores: { you: 0, draws: 0 } }, { ...good, scores: { you: -1, draws: 0, friend: 0 } }, { ...good, scores: { you: 1.5, draws: 0, friend: 0 } }, { ...good, scores: { you: 0, draws: 0, friend: 5000 } }];
		for (const state of bad) expect(parseMessage({ type: 'hello', version: 1, state })).toEqual({ type: 'hello', version: 1, state: null });
	});

	it('copies a state rather than keeping the sender\'s object', () => {
		const state = { moves: [4], game: 0, scores: { you: 0, draws: 0, friend: 0, extra: 1 }, extra: 1 };
		const parsed = parseMessage({ type: 'hello', version: 1, state }).state;
		expect(parsed).toEqual({ moves: [4], game: 0, scores: { you: 0, draws: 0, friend: 0 } });
		expect(parsed.moves).not.toBe(state.moves);
	});

	it('drops fields it does not know about', () => {
		const message = parseMessage({ type: 'move', index: 1, seq: 0, html: '<img onerror=x>' });
		expect(message).toEqual({ type: 'move', index: 1, seq: 0 });
		expect(parseMessage({ type: 'bye', extra: 1 })).toEqual({ type: 'bye' });
	});
});

describe('checkMove', () => {
	const move = (index, seq) => ({ type: 'move', index, seq });

	it('accepts a legal move from the player whose turn it is', () => {
		expect(checkMove(move(4, 0), { cells: board('.........'), sender: 'X', seq: 0 })).toEqual({ ok: true, index: 4 });
		expect(checkMove(move(0, 1), { cells: board('....X....'), sender: 'O', seq: 1 })).toEqual({ ok: true, index: 0 });
	});

	it('rejects things that are not moves', () => {
		for (const bad of [null, undefined, { type: 'bye' }, 'move']) {
			expect(checkMove(bad, { cells: board('.........'), sender: 'X', seq: 0 }).ok).toBe(false);
		}
	});

	it('rejects bad indexes even if they skipped parseMessage', () => {
		for (const index of [-1, 9, 2.5, '1', undefined]) {
			expect(checkMove(move(index, 0), { cells: board('.........'), sender: 'X', seq: 0 })).toEqual({ ok: false, reason: 'bad index' });
		}
	});

	it('rejects moves out of turn', () => {
		expect(checkMove(move(0, 0), { cells: board('.........'), sender: 'O', seq: 0 })).toEqual({ ok: false, reason: 'not their turn' });
		expect(checkMove(move(0, 1), { cells: board('....X....'), sender: 'X', seq: 1 })).toEqual({ ok: false, reason: 'not their turn' });
	});

	it('rejects a filled cell', () => {
		expect(checkMove(move(4, 1), { cells: board('....X....'), sender: 'O', seq: 1 })).toEqual({ ok: false, reason: 'cell is taken' });
	});

	it('rejects the wrong seq, so replays and skips fail', () => {
		expect(checkMove(move(0, 0), { cells: board('....X....'), sender: 'O', seq: 1 })).toEqual({ ok: false, reason: 'wrong seq' });
		expect(checkMove(move(0, 2), { cells: board('....X....'), sender: 'O', seq: 1 })).toEqual({ ok: false, reason: 'wrong seq' });
	});

	it('rejects moves once the game is over', () => {
		// X has won on the top row
		expect(checkMove(move(8, 5), { cells: board('XXXOO....'), sender: 'O', seq: 5 })).toEqual({ ok: false, reason: 'game is over' });
		// A dead draw counts too
		expect(checkMove(move(8, 8), { cells: board('XOXXOOOX.'), sender: 'X', seq: 8 })).toEqual({ ok: false, reason: 'game is over' });
	});
});

describe('checkState', () => {
	const scores = { you: 0, draws: 0, friend: 0 };

	it('accepts a game replayed legally from the start', () => {
		expect(checkState({ moves: [], game: 0, scores })).not.toBeNull();
		expect(checkState({ moves: [4, 0, 8], game: 0, scores })).not.toBeNull();
		// X wins on the top row, and that win is in the scores
		expect(checkState({ moves: [0, 3, 1, 4, 2], game: 0, scores: { you: 1, draws: 0, friend: 0 } })).not.toBeNull();
		// Three games already scored, and a fourth just started
		expect(checkState({ moves: [4], game: 3, scores: { you: 1, draws: 1, friend: 1 } })).not.toBeNull();
	});

	it('rejects illegal sequences', () => {
		expect(checkState({ moves: [4, 4], game: 0, scores })).toBeNull();
		expect(checkState({ moves: [0, 3, 1, 4, 2, 5], game: 0, scores: { you: 1, draws: 0, friend: 0 } })).toBeNull();
		// Played on after a draw nobody can win (X O X / X O O / O X . is dead)
		expect(checkState({ moves: [0, 1, 2, 4, 3, 5, 7, 6, 8], game: 0, scores: { you: 0, draws: 1, friend: 0 } })).toBeNull();
	});

	it('rejects scores that do not match the games played', () => {
		expect(checkState({ moves: [4], game: 0, scores: { you: 1, draws: 0, friend: 0 } })).toBeNull();
		expect(checkState({ moves: [0, 3, 1, 4, 2], game: 0, scores })).toBeNull();
		expect(checkState({ moves: [], game: 2, scores: { you: 1, draws: 0, friend: 0 } })).toBeNull();
		expect(checkState({ moves: [], game: 2, scores: { you: 1, draws: 0, friend: 1 } })).not.toBeNull();
	});
});

describe('flipScores', () => {
	it('swaps you and friend', () => {
		expect(flipScores({ you: 3, draws: 1, friend: 2 })).toEqual({ you: 2, draws: 1, friend: 3 });
	});
});

describe('frames', () => {
	it('round-trips a message', () => {
		for (const message of [messages.move(3, 1), messages.ping(), messages.hello({ state: { moves: [1], game: 0, scores: { you: 0, draws: 0, friend: 0 } } })]) {
			expect(decodeFrame(encodeFrame(message))).toEqual(message);
		}
	});

	it('returns null for anything that is not a good frame, and never throws', () => {
		const frames = ['', ' ', '{', 'null', 'true', '42', '"bye"', '[]', '{}', '{"type":"nope"}', '{"type":"move","index":"1","seq":0}', undefined, null, 7, {}, { type: 'bye' }, new ArrayBuffer(4), new Uint8Array(2), '{"type":"bye","pad":"' + 'x'.repeat(3000) + '"}'];
		for (const frame of frames) expect(decodeFrame(frame)).toBeNull();
	});

	it('is not fooled by prototype tricks in the JSON', () => {
		expect(decodeFrame('{"__proto__":{"type":"bye"}}')).toBeNull();
		expect(decodeFrame('{"type":"bye","__proto__":{"polluted":true}}')).toEqual({ type: 'bye' });
		expect({}.polluted).toBeUndefined();
	});
});
