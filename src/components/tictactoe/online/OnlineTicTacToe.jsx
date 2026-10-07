import { A, useSearchParams } from '@solidjs/router';
import { batch, createEffect, createMemo, createSignal, For, Index, Match, on, onCleanup, onMount, Show, Switch } from 'solid-js';
import { confetti } from '../../../utils/confetti';
import { playSound } from '../../../utils/sound';
import { shareResult } from '../../../utils/share';
import SoundToggle from '../../ui/SoundToggle';
import { getOutcome, nextPlayer, other } from '../logic';
import '../tictactoe.css';
import './online.css';
import { cellsFrom, checkMove, checkState, decodeFrame, encodeFrame, flipScores, makeRoomCode, markFor, messages, parseRoomCode, peerId, PROTOCOL_VERSION, REACTIONS, ROOM_PREFIX, SERIALIZATION } from './protocol';

const CONNECT_TIMEOUT_MS = 10000;
const ID_RETRIES = 4;
const PING_MS = 5000;
// Three missed pings. A crashed tab or a sleeping phone never says goodbye, so silence is the only sign.
const SILENCE_MS = 15000;
const RECONNECT_ATTEMPTS = 3;
const RECONNECT_BASE_MS = 1000; // then 2s, then 4s
const FULL_CLOSE_DELAY_MS = 300; // lets the "full" message flush before the connection closes
const emptyScore = { you: 0, draws: 0, friend: 0 };
// Broker errors that PeerJS reports when the socket to the matchmaking server drops
const BROKER_ERRORS = new Set(['network', 'socket-closed', 'server-error', 'socket-error']);

const ERRORS = {
	badLink: "That link doesn't look right. Ask your friend to send it again.",
	notFound: "Couldn't find that game. Your friend may have closed it, or the link is wrong.",
	timeout: "Couldn't reach your friend. Some networks block direct connections, so try another network or ask them to try.",
	server: "Couldn't reach the free matchmaking server. Check your connection and try again.",
	browser: "This browser can't make peer-to-peer connections.",
	full: 'This game already has two players.',
	version: 'Your friend is running a different version of the game. Refresh the page and try again.',
	other: 'Something went wrong while connecting.',
};

const errorFor = (error) => {
	switch (error?.type) {
		case 'peer-unavailable':
			return ERRORS.notFound;
		case 'browser-incompatible':
			return ERRORS.browser;
		case 'network':
		case 'server-error':
		case 'socket-error':
		case 'socket-closed':
			return ERRORS.server;
		default:
			return ERRORS.other;
	}
};

// Centre of each cell in the win-line overlay's 300×300 viewBox
const centre = (i) => [(i % 3) * 100 + 50, Math.floor(i / 3) * 100 + 50];

const ignored = (reason) => {
	// Only worth seeing while developing
	if (import.meta.env.DEV && import.meta.env.MODE !== 'test') console.debug('[online] ignored message:', reason);
};

// PeerJS is only needed here, so it's loaded on demand to keep it out of every other page
async function loadPeer() {
	const module = await import('peerjs');
	return module.Peer ?? module.default;
}

// The host's connection to a second guest: say the room is full, then hang up
function turnAway(extra) {
	const tell = () => {
		try {
			extra.send(encodeFrame(messages.full()));
		} catch {}
		setTimeout(() => {
			try {
				extra.close();
			} catch {}
		}, FULL_CLOSE_DELAY_MS);
	};
	extra.on('error', () => {});
	if (extra.open) tell();
	else extra.on('open', tell);
}

function OnlineTicTacToe() {
	const [params, setParams] = useSearchParams();
	const [phase, setPhase] = createSignal('lobby'); // lobby | creating | waiting | connecting | playing | left | error
	const [role, setRole] = createSignal('host');
	const [code, setCode] = createSignal('');
	const [error, setError] = createSignal('');
	const [canRetry, setCanRetry] = createSignal(true);
	const [friendLeft, setFriendLeft] = createSignal(false);
	const [typedCode, setTypedCode] = createSignal('');
	const [badCode, setBadCode] = createSignal(false);
	const [scores, setScores] = createSignal(emptyScore);
	// Which game of this session it is. The sides swap on every rematch.
	const [game, setGame] = createSignal(0);
	// The cell indexes played so far, oldest first. Everything else is derived from this.
	const [moves, setMoves] = createSignal([]);
	const [askedRematch, setAskedRematch] = createSignal(false);
	const [friendAsked, setFriendAsked] = createSignal(false);
	const [friendReactions, setFriendReactions] = createSignal(false);
	const [reactionLog, setReactionLog] = createSignal([]);
	const [reactionCooling, setReactionCooling] = createSignal(false);
	let reactionTimer, lastReaction = -Infinity;
	onCleanup(() => clearTimeout(reactionTimer));
	let board;

	// Not signals: they're handles for the network, and nothing renders from them.
	// `session` changes whenever the connection is torn down or restarted, so late callbacks from an old one can be told apart.
	let peer = null;
	let pending = null; // a peer that hasn't reached the broker yet, so it can still be cleaned up
	let conn = null;
	let timer = 0;
	let heartbeat = 0;
	let lastHeard = 0;
	let reconnectTimer = 0;
	let reconnectAttempts = 0;
	let scored = -1; // the game number whose result is already in the scoreboard
	let session = 0;

	const myMark = createMemo(() => markFor(role(), game()));
	const cells = createMemo(() => cellsFrom(moves()));
	const turn = createMemo(() => nextPlayer(cells()));
	// Games are drawn as soon as nobody can win, like on the main page
	const result = createMemo(() => getOutcome(cells(), turn()));
	const myTurn = () => phase() === 'playing' && !result() && turn() === myMark();
	const link = () => `${location.origin}/tictactoe/online?room=${code()}`;

	onMount(() => (document.title = 'Online TicTacToe | Alfred Shaheen'));

	const send = (message) => {
		try {
			if (conn?.open) conn.send(encodeFrame(message));
		} catch {
			// The connection will report that it closed
		}
	};

	const showReaction = (kind, from) => {
		const reaction = REACTIONS.find(item => item.id === kind);
		if (reaction) setReactionLog(previous => [...previous, { ...reaction, from, token: Date.now() + Math.random() }].slice(-3));
	};
	const react = (kind) => {
		if (phase() !== 'playing' || !conn?.open || !friendReactions() || reactionCooling()) return;
		send(messages.reaction(kind, game()));
		showReaction(kind, 'You');
		setReactionCooling(true); clearTimeout(reactionTimer);
		reactionTimer = setTimeout(() => setReactionCooling(false), 1500);
	};
	const stopHeartbeat = () => {
		clearInterval(heartbeat);
		heartbeat = 0;
	};

	// Drops the friend's connection but keeps the peer, so a host can wait for somebody new
	const dropConn = () => {
		stopHeartbeat();
		const old = conn;
		conn = null;
		try {
			old?.close();
		} catch {}
	};

	// Closes everything that's open. Safe to call more than once.
	const release = () => {
		clearTimeout(timer);
		clearTimeout(reconnectTimer);
		reconnectTimer = reconnectAttempts = 0;
		const [oldPeer, oldPending] = [peer, pending];
		peer = pending = null;
		dropConn();
		for (const each of [oldPeer, oldPending]) {
			try {
				each?.destroy();
			} catch {}
		}
	};

	const begin = (nextRole, nextPhase) => {
		release();
		setRole(nextRole);
		setPhase(nextPhase);
		setError('');
		setCanRetry(true);
		setCode('');
		setFriendLeft(false);
		setFriendReactions(false);
		setScores(emptyScore);
		newGame(0);
		scored = -1;
		return ++session;
	};

	const fail = (id, message, retry = true) => {
		if (id !== session) return;
		release();
		session++; // so a peer that's still opening gets discarded
		setError(message);
		setCanRetry(retry);
		setPhase('error');
	};

	function newGame(n) {
		setGame(n);
		setMoves([]);
		setReactionLog([]); lastReaction = -Infinity;
		clearTimeout(reactionTimer); setReactionCooling(false);
		setAskedRematch(false);
		setFriendAsked(false);
	}

	// Brings a host's dropped broker connection back, with a growing pause between tries.
	// The same peer keeps its id, so the link that was shared stays good.
	const reconnect = (id, target) => {
		if (reconnectTimer || id !== session || target !== peer || target.destroyed || phase() !== 'waiting') return;
		if (reconnectAttempts >= RECONNECT_ATTEMPTS) return fail(id, ERRORS.server);
		reconnectTimer = setTimeout(
			() => {
				reconnectTimer = 0;
				if (id !== session || target !== peer || target.destroyed) return;
				try {
					target.reconnect();
				} catch {}
			},
			RECONNECT_BASE_MS * 2 ** reconnectAttempts++,
		);
	};

	// Once a friend is connected the broker is no longer needed, so losing it then is harmless
	const startHeartbeat = (id, from) => {
		stopHeartbeat();
		lastHeard = Date.now();
		heartbeat = setInterval(() => {
			if (id !== session || from !== conn) return stopHeartbeat();
			if (Date.now() - lastHeard > SILENCE_MS) return gone(id, from);
			send(messages.ping());
		}, PING_MS);
	};

	const connected = (id, from) => {
		if (id !== session || from !== conn) return;
		setFriendLeft(false);
		startHeartbeat(id, from);
		if (role() === 'host') {
			send(messages.hello({ features: ['reactions'], state: { moves: moves(), game: game(), scores: scores() } }));
			setPhase('playing');
		} else {
			// A guest waits for the host's hello, which says whether there's room and where the game is up to
			send(messages.hello({ features: ['reactions'] }));
		}
	};

	// The guest's side of the introduction. The host's game state is untrusted like everything else:
	// it's replayed from an empty board and rejected if any of it doesn't add up.
	const welcome = (id, message) => {
		if (message.version !== PROTOCOL_VERSION) return fail(id, ERRORS.version, false);
		// A state that was sent but is malformed comes through as null
		const state = message.state && checkState(message.state);
		if (message.state !== undefined && !state) {
			ignored('inconsistent game state');
			return fail(id, ERRORS.other);
		}
		clearTimeout(timer);
		setFriendReactions(Boolean(message.features?.includes('reactions')));
		batch(() => {
			if (state) {
				setMoves(state.moves);
				setGame(state.game);
				setScores(flipScores(state.scores));
				// Already counted in the scores we were just given
				scored = getOutcome(cellsFrom(state.moves)) ? state.game : -1;
			}
			setPhase('playing');
		});
	};

	// The friend is gone. A host keeps the room open for them to come back (say, after a reload).
	const friendGone = (id) => {
		if (role() === 'host') {
			dropConn();
			setAskedRematch(false);
			setFriendAsked(false);
			setFriendLeft(true);
			setPhase('waiting');
			if (peer?.disconnected) reconnect(id, peer);
		} else {
			release();
			setPhase('left');
		}
	};

	const gone = (id, from) => {
		if (id !== session || from !== conn) return;
		if (phase() === 'playing') friendGone(id);
		else if (phase() === 'connecting') fail(id, ERRORS.timeout);
		else dropConn(); // the host is still waiting, so another friend can try
	};

	const receive = (id, from, data) => {
		if (id !== session || from !== conn) return;
		const message = decodeFrame(data);
		if (!message) return ignored('malformed');
		lastHeard = Date.now();
		if (message.type === 'ping') return send(messages.pong());
		if (message.type === 'pong') return;
		if (phase() === 'connecting') {
			if (message.type === 'full') return fail(id, ERRORS.full, false);
			if (message.type === 'hello') return welcome(id, message);
			return ignored(`${message.type} before hello`);
		}
		if (phase() !== 'playing') return;
		switch (message.type) {
			case 'hello':
				if (message.version !== PROTOCOL_VERSION) return fail(id, ERRORS.version, false);
				setFriendReactions(Boolean(message.features?.includes('reactions')));
				break;
			case 'reaction':
				if (!friendReactions() || message.game !== game() || Date.now() - lastReaction < 1500) return;
				lastReaction = Date.now(); showReaction(message.kind, 'Friend');
				break;
			case 'move': {
				const check = checkMove(message, { cells: cells(), sender: other(myMark()), seq: moves().length });
				if (!check.ok) return ignored(check.reason);
				setMoves((prev) => [...prev, check.index]);
				playSound('place');
				break;
			}
			case 'rematch':
				if (!result()) return ignored('rematch before the game ended');
				// We both asked at once, so that's agreement
				if (askedRematch()) {
					send(messages.rematchAccept());
					newGame(game() + 1);
				} else {
					setFriendAsked(true);
				}
				break;
			case 'rematch-accept':
				if (!result() || !askedRematch()) return ignored('unexpected rematch-accept');
				newGame(game() + 1);
				break;
			case 'bye':
				friendGone(id);
				break;
			default:
				// Hellos and the like only mean something at the start
				ignored(`unexpected ${message.type}`);
		}
	};

	const attach = (id, from) => {
		conn = from;
		from.on('data', (data) => receive(id, from, data));
		from.on('close', () => gone(id, from));
		from.on('error', () => gone(id, from));
		if (from.open) connected(id, from);
		else from.on('open', () => connected(id, from));
	};

	const brokerFailed = (id, from, failure) => {
		if (id !== session || from !== peer) return;
		// A host's room is only findable while the broker knows about it, so retry before giving up
		if (role() === 'host' && phase() === 'waiting' && BROKER_ERRORS.has(failure?.type)) return reconnect(id, from);
		// Once a friend is connected the data channel is direct and doesn't need the broker
		if (phase() === 'connecting' || phase() === 'waiting') fail(id, errorFor(failure));
	};

	const brokerLost = (id, from) => {
		// destroy() emits this too, before it marks the peer destroyed, so check that we still want it
		if (id !== session || from !== peer || from.destroyed) return;
		if (role() === 'host' && phase() === 'waiting') reconnect(id, from);
	};

	const openPeer = (Peer, wantedId, id) =>
		new Promise((resolve, reject) => {
			const next = wantedId ? new Peer(wantedId) : new Peer();
			pending = next;
			let opened = false;
			next.on('open', () => {
				if (opened) {
					// Back from a reconnect
					if (id === session && next === peer) reconnectAttempts = 0;
					return;
				}
				opened = true;
				if (pending === next) pending = null;
				resolve(next);
			});
			next.on('error', (failure) => {
				if (opened) return brokerFailed(id, next, failure);
				if (pending === next) pending = null;
				next.destroy();
				reject(failure);
			});
			next.on('disconnected', () => opened && brokerLost(id, next));
		});

	async function host() {
		const id = begin('host', 'creating');
		timer = setTimeout(() => fail(id, ERRORS.server), CONNECT_TIMEOUT_MS);
		try {
			const Peer = await loadPeer();
			if (id !== session) return;
			let next;
			for (let attempt = 0; !next; attempt++) {
				const room = makeRoomCode();
				try {
					next = await openPeer(Peer, ROOM_PREFIX + room, id);
					setCode(room);
				} catch (failure) {
					// Somebody else has that id, so roll again
					if (failure?.type !== 'unavailable-id' || attempt >= ID_RETRIES) throw failure;
				}
				if (id !== session) {
					next?.destroy();
					return;
				}
			}
			clearTimeout(timer);
			peer = next;
			next.on('connection', (incoming) => {
				if (id !== session || incoming.serialization !== SERIALIZATION) return incoming.close();
				if (conn || phase() !== 'waiting') return turnAway(incoming);
				attach(id, incoming);
			});
			setPhase('waiting');
		} catch (failure) {
			fail(id, errorFor(failure));
		}
	}

	async function join(raw) {
		const id = begin('guest', 'connecting');
		const room = parseRoomCode(raw);
		if (!room) return fail(id, ERRORS.badLink, false);
		setCode(room);
		timer = setTimeout(() => fail(id, ERRORS.timeout), CONNECT_TIMEOUT_MS);
		try {
			const Peer = await loadPeer();
			if (id !== session) return;
			const next = await openPeer(Peer, undefined, id);
			if (id !== session) return next.destroy();
			peer = next;
			attach(id, next.connect(peerId(room), { reliable: true, serialization: SERIALIZATION }));
		} catch (failure) {
			fail(id, errorFor(failure));
		}
	}

	const createOwn = () => {
		setParams({ room: undefined }, { replace: true });
		host();
	};

	const joinWithCode = (event) => {
		event.preventDefault();
		const room = parseRoomCode(typedCode());
		setBadCode(!room);
		if (!room) return;
		if (params.room === room) join(room);
		else setParams({ room }, { replace: true });
	};

	const leave = () => {
		send(messages.bye());
		release();
		session++;
	};

	// A link with ?room= joins that game as soon as the page opens
	createEffect(
		on(
			() => params.room,
			(room) => {
				if (typeof room === 'string' && room) join(room);
			},
		),
	);

	const hangUp = () => send(messages.bye());
	onMount(() => window.addEventListener('pagehide', hangUp));
	onCleanup(() => {
		window.removeEventListener('pagehide', hangUp);
		leave();
	});

	const play = (index) => {
		if (!myTurn() || cells()[index]) return;
		send(messages.move(index, moves().length));
		setMoves((prev) => [...prev, index]);
		playSound('place');
	};

	const requestRematch = () => {
		if (!result()) return;
		setAskedRematch(true);
		send(messages.rematch());
	};

	const acceptRematch = () => {
		if (!result()) return;
		send(messages.rematchAccept());
		newGame(game() + 1);
	};

	// Score the game once it ends, with a sound to match
	createEffect(
		on(
			result,
			(r) => {
				if (!r || game() === scored) return;
				scored = game();
				const won = r.player === myMark();
				setScores((prev) => (!r.player ? { ...prev, draws: prev.draws + 1 } : won ? { ...prev, you: prev.you + 1 } : { ...prev, friend: prev.friend + 1 }));
				playSound(!r.player ? 'draw' : won ? 'win' : 'lose');
				if (won) {
					const rect = board?.getBoundingClientRect();
					confetti(rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : {});
				}
			},
			{ defer: true },
		),
	);

	const winLine = () => {
		const line = result()?.line;
		if (!line?.length) return null;
		const [x1, y1] = centre(line[0]);
		const [x2, y2] = centre(line[2]);
		// Run the stroke a little past the outer cells' centres
		const dx = (x2 - x1) * 0.18;
		const dy = (y2 - y1) * 0.18;
		return { x1: x1 - dx, y1: y1 - dy, x2: x2 + dx, y2: y2 + dy, mark: result().player };
	};

	const shareLabel = () => (navigator.share ? 'Share link' : 'Copy link');
	const retry = () => (role() === 'guest' ? join(params.room) : host());
	const inGame = () => phase() === 'playing' || phase() === 'left';

	return (
		<section class="page ttt ttto">
			<h1 class="page-title ttt-title">Online TicTacToe</h1>

			<Show
				when={inGame()}
				fallback={
					<div class="ttto-panel">
						<Switch>
							<Match when={phase() === 'lobby'}>
								<h2 class="ttto-heading">Play a friend online</h2>
								<p class="ttto-text">Create a game, send your friend the link, and play on separate devices.</p>
								<button class="btn" onClick={host}>
									Create game
								</button>
								<form class="ttto-join" onSubmit={joinWithCode} novalidate>
									<label class="ttto-code-label" for="ttto-join-code">
										Join with code
									</label>
									<div class="ttto-share">
										<input
											id="ttto-join-code"
											class="ttto-link ttto-join-input"
											value={typedCode()}
											onInput={(e) => setTypedCode(e.currentTarget.value)}
											maxlength="20"
											autocomplete="off"
											autocapitalize="none"
											spellcheck={false}
											placeholder="e.g. abc234"
											aria-invalid={badCode()}
											aria-describedby={badCode() ? 'ttto-join-error' : undefined}
										/>
										<button class="btn btn-ghost" type="submit">
											Join
										</button>
									</div>
									<Show when={badCode()}>
										<p class="ttto-join-error" id="ttto-join-error" role="alert">
											That doesn't look like a game code.
										</p>
									</Show>
								</form>
							</Match>
							<Match when={phase() === 'creating'}>
								<p class="ttto-text" role="status">
									Setting up your game…
								</p>
							</Match>
							<Match when={phase() === 'waiting'}>
								<h2 class="ttto-heading">{friendLeft() ? 'Your friend left' : 'Share this link'}</h2>
								<Show when={friendLeft()}>
									<p class="ttto-text" role="status">
										They can rejoin with the same link.
									</p>
								</Show>
								<div class="ttto-share">
									<input class="ttto-link" readonly value={link()} aria-label="Game link" onFocus={(e) => e.currentTarget.select()} />
									<button class="btn" onClick={() => shareResult(link())}>
										{shareLabel()}
									</button>
								</div>
								<p class="ttto-code-label">Or tell them the code</p>
								<p class="ttto-code">
									{code()}
								</p>
								<p class="ttt-status ttto-waiting" aria-live="polite">
									Waiting for your friend to join…
								</p>
							</Match>
							<Match when={phase() === 'connecting'}>
								<p class="ttt-status ttt-thinking" role="status">
									Connecting
								</p>
							</Match>
							<Match when={phase() === 'error'}>
								<h2 class="ttto-heading">Couldn't connect</h2>
								<p class="ttto-text" role="alert">
									{error()}
								</p>
								<div class="ttt-actions">
									<Show when={canRetry()}>
										<button class="btn" onClick={retry}>
											Try again
										</button>
									</Show>
									<Show when={role() === 'guest'}>
										<button class="btn btn-ghost" onClick={createOwn}>
											Create your own game
										</button>
									</Show>
								</div>
							</Match>
						</Switch>
					</div>
				}
			>
				<div class="ttt-scoreboard" aria-label="Score">
					<div classList={{ 'ttt-score': true, leading: scores().you > scores().friend }}>
						<span class="ttt-score-label">You</span>
						<span class="ttt-score-value">{scores().you}</span>
					</div>
					<div class="ttt-score">
						<span class="ttt-score-label">Draws</span>
						<span class="ttt-score-value">{scores().draws}</span>
					</div>
					<div classList={{ 'ttt-score': true, leading: scores().friend > scores().you }}>
						<span class="ttt-score-label">Friend</span>
						<span class="ttt-score-value">{scores().friend}</span>
					</div>
				</div>

				<p class="ttt-status" aria-live="polite">
					<Switch>
						<Match when={phase() === 'left'}>Your friend left</Match>
						<Match when={result()?.early}>Draw. Nobody can win from here.</Match>
						<Match when={result() && !result().player}>It's a draw!</Match>
						<Match when={result()}>{result().player === myMark() ? 'You win! 🎉' : 'Your friend wins'}</Match>
						<Match when={myTurn()}>Your turn</Match>
						<Match when={true}>Waiting for your friend…</Match>
					</Switch>
				</p>

				<p class="ttto-note" aria-live="polite">
					<Switch>
						<Match when={phase() === 'left'} />
						<Match when={friendAsked() && result()}>Your friend wants a rematch</Match>
						<Match when={askedRematch() && result()}>Rematch requested…</Match>
						<Match when={true}>
							You play <span class={`mark-${myMark()}`}>{myMark()}</span>
						</Match>
					</Switch>
				</p>

				<div class="ttt-board-wrap">
					<div class="ttt-board" classList={{ 'dead-draw': Boolean(result()?.early) }} ref={board} role="group" aria-label="Game board" aria-busy={phase() === 'playing' && !result() && !myTurn()}>
						<Index each={cells()}>
							{(cell, index) => (
								<button
									class={`ttt-cell ${cell() ? `mark-${cell()}` : 'empty'}${result()?.line.includes(index) ? ' winning' : ''}${moves().at(-1) === index ? ' ttto-latest' : ''}`}
									onClick={() => play(index)}
									disabled={Boolean(cell() || !myTurn())}
									aria-label={`Row ${Math.floor(index / 3) + 1}, column ${(index % 3) + 1}: ${cell() || 'empty'}`}
								>
									{cell()}
								</button>
							)}
						</Index>
					</div>
					<Show when={winLine()}>
						{(line) => (
							<svg class="ttt-win-line" viewBox="0 0 300 300" aria-hidden="true">
								<line class={`stroke-${line().mark}`} x1={line().x1} y1={line().y1} x2={line().x2} y2={line().y2} />
							</svg>
						)}
					</Show>
				</div>

				<div class="ttt-actions">
					<Switch>
						<Match when={phase() === 'left'}>
							<button class="btn" onClick={createOwn}>
								Create a new game
							</button>
						</Match>
						<Match when={result() && friendAsked()}>
							<button class="btn" onClick={acceptRematch}>
								Accept
							</button>
						</Match>
						<Match when={result()}>
							<button class="btn" onClick={requestRematch} disabled={askedRematch()}>
								{askedRematch() ? 'Waiting…' : 'Rematch'}
							</button>
						</Match>
					</Switch>
					<SoundToggle />
				</div>
				<div class="ttto-reactions"><p class="ttto-reaction-heading">A little table talk</p><div class="ttto-reaction-buttons" role="group" aria-label="Send a quick reaction"><For each={REACTIONS}>{reaction => <button class="btn btn-ghost" onClick={() => react(reaction.id)} disabled={phase() !== 'playing' || !friendReactions() || reactionCooling()} aria-label={`Send ${reaction.label}`} title={reaction.label}><span aria-hidden="true">{reaction.icon}</span><span>{reaction.label}</span></button>}</For></div><p class="ttto-reaction-status" role="status">{reactionLog().length ? `${reactionLog().at(-1).from}: ${reactionLog().at(-1).label}` : friendReactions() ? 'Send a hello, celebrate a move, or say good game.' : 'Reactions become available when both players use this version.'}</p><div class="ttto-reaction-bubbles" aria-hidden="true"><For each={reactionLog()}>{reaction => <span classList={{ mine: reaction.from === 'You' }}>{reaction.icon} {reaction.from}: {reaction.label}</span>}</For></div></div>
				<details class="ttto-move-log">
					<summary>Move log · {moves().length} moves</summary>
					<Show when={moves().length} fallback={<p>The first move will appear here.</p>}>
						<ol><For each={moves()}>{(index, step) => {
							const mark = () => step() % 2 === 0 ? 'X' : 'O';
							return <li classList={{ latest: step() === moves().length - 1 }}>
								<span class={`mark-${mark()}`}>{mark()}</span>
								<strong>{mark() === myMark() ? 'You' : 'Friend'}</strong>
								<span>Row {Math.floor(index / 3) + 1}, column {(index % 3) + 1}</span>
							</li>;
						}}</For></ol>
					</Show>
				</details>
			</Show>

			<A href="/tictactoe" class="back-link">
				← TicTacToe vs AI
			</A>
			<p class="ttto-privacy">Moves and reactions go directly between your browsers; a free PeerJS server only introduces you.</p>
		</section>
	);
}

export default OnlineTicTacToe;
