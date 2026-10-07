import { A } from '@solidjs/router';
import { batch, createEffect, createMemo, createSignal, Index, Match, on, onCleanup, onMount, Show, Switch } from 'solid-js';
import { unlock } from '../../../state/achievements';
import { confetti } from '../../../utils/confetti';
import { shareResult } from '../../../utils/share';
import { playSound } from '../../../utils/sound';
import { load, save } from '../../../utils/storage';
import Segmented from '../../ui/Segmented';
import SoundToggle from '../../ui/SoundToggle';
import { other } from '../logic';
import '../tictactoe.css';
import { BOARD_NAMES, chooseMove, legalMoves, playMove, replay, summarize, warmUp } from './logic';
import './ultimate.css';

const AI_DELAY_MS = 450; // same pause as classic TicTacToe, long enough to feel like it's thinking
const emptyScore = { a: 0, b: 0, draws: 0 };
const NINE = Array(9).fill(0);

const MODES = [
	{ value: 'ai', label: 'vs AI' },
	{ value: 'pvp', label: '2 Players' },
];
const DIFFICULTIES = [
	{ value: 'easy', label: 'Easy', title: 'Plays at random, but grabs a small-board win half the time' },
	{ value: 'medium', label: 'Medium', title: 'Looks three moves ahead' },
	{ value: 'hard', label: 'Hard', title: 'Searches as deep as it can in a split second' },
];
const MARKS = [
	{ value: 'X', label: 'Play X', title: 'X moves first' },
	{ value: 'O', label: 'Play O', title: 'The AI moves first' },
];

// Saved data can be anything (hand-edited, or from an older version), so only trust what fits
const choose = (options, value, fallback) => (options.some((o) => o.value === value) ? value : fallback);
const object = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});
const isCount = (n) => Number.isInteger(n) && n >= 0;
const loadScores = () =>
	Object.fromEntries(
		Object.entries(object(load('uttt-scores', null))).filter(([, s]) => isCount(s?.a) && isCount(s?.b) && isCount(s?.draws)),
	);

// Centre of each small board in the win-line overlay's 300×300 viewBox
const centre = (i) => [(i % 3) * 100 + 50, Math.floor(i / 3) * 100 + 50];

function UltimateTicTacToe() {
	const saved = object(load('uttt-settings', null));
	const [mode, setMode] = createSignal(choose(MODES, saved.mode, 'ai'));
	const [difficulty, setDifficulty] = createSignal(choose(DIFFICULTIES, saved.difficulty, 'medium'));
	const [human, setHuman] = createSignal(choose(MARKS, saved.human, 'X'));
	const [scores, setScores] = createSignal(loadScores());
	// The cells played, in order. Everything else about the game is derived from this.
	const [moves, setMoves] = createSignal([]);
	const [shake, setShake] = createSignal(false);
	const [previewIndex, setPreviewIndex] = createSignal(null);
	const [wildcardArmed, setWildcardArmed] = createSignal(false);
	let board;
	let shakeTimer;
	// Whether the last cell was played from the keyboard, in which case focus follows the game (see below)
	let keyboard = false;
	let refocus = false;

	const game = createMemo(() => replay(moves()));
	const result = () => game().result;
	const legal = createMemo(() => new Set(legalMoves(wildcardArmed() ? { ...game(), forced: null } : game())));
	// The boards the player to move may play in
	const targets = createMemo(() => new Set([...legal()].map((i) => Math.floor(i / 9))));
	const vsAi = () => mode() === 'ai';
	const aiMark = () => other(human());
	const aiTurn = () => vsAi() && !result() && game().turn === aiMark();
	const scoreKey = () => (vsAi() ? `ai-${difficulty()}` : 'pvp');
	const score = () => scores()[scoreKey()] ?? emptyScore;

	onMount(() => {
		document.title = 'Ultimate TicTacToe | Alfred Shaheen';
		// The AI's lookup tables take a few milliseconds to build: do it while the page is idle, not on its first move
		const idle = window.requestIdleCallback
			? window.requestIdleCallback(warmUp)
			: setTimeout(warmUp, 200);
		onCleanup(() => (window.requestIdleCallback ? window.cancelIdleCallback(idle) : clearTimeout(idle)));
	});
	onCleanup(() => clearTimeout(shakeTimer));

	createEffect(() => save('uttt-settings', { mode: mode(), difficulty: difficulty(), human: human() }));

	const place = (index, wildcard = false) => {
		const before = game();
		const after = playMove(before, index, { wildcard });
		if (after === before) return;
		setPreviewIndex(null);
		setWildcardArmed(false);
		setMoves((prev) => [...prev, wildcard ? { index, wildcard: true } : index]);
		playSound('place');
		if (after.boards[Math.floor(index / 9)] === before.turn) playSound('match');
	};

	const play = (index) => {
		if (!legal().has(index) || aiTurn()) return;
		refocus = keyboard;
		place(index, wildcardArmed());
	};

	// Played cells become disabled, which drops keyboard focus. Put it back on the next cell to play,
	// once it's the human's turn, but only for keyboard players: a mouse click shouldn't move focus.
	createEffect(
		on(
			game,
			() => {
				if (!refocus || aiTurn()) return;
				refocus = false;
				board?.querySelector('.uttt-cell:not(:disabled)')?.focus();
			},
			{ defer: true },
		),
	);

	const newGame = () => {
		refocus = false;
		setPreviewIndex(null);
		setWildcardArmed(false);
		setMoves([]);
	};

	const changeSetting = (current, setter) => (value) => {
		if (value === current()) return;
		batch(() => {
			setter(value);
			newGame();
		});
	};

	// When it's the AI's turn, it moves after a short pause
	createEffect(() => {
		if (!aiTurn()) return;
		const snapshot = game();
		const level = difficulty();
		const timer = setTimeout(() => {
			let move = chooseMove(snapshot, level), wildcard = false;
			if (snapshot.forced !== null && snapshot.wildcards?.[snapshot.turn]) {
				const free = { ...snapshot, forced: null }, candidate = chooseMove(free, level);
				if (candidate !== null && !legalMoves(snapshot).includes(candidate)) {
					const after = playMove(snapshot, candidate, { wildcard: true });
					if (after.result?.player === snapshot.turn || after.boards[Math.floor(candidate / 9)] === snapshot.turn) { move = candidate; wildcard = true; }
				}
			}
			if (move !== null) place(move, wildcard);
		}, AI_DELAY_MS + Math.random() * 250);
		onCleanup(() => clearTimeout(timer));
	});

	// Score the game, celebrate, and hand out the achievement once it ends
	createEffect(
		on(
			result,
			(r) => {
				if (!r) return;
				const key = scoreKey();
				const prev = scores()[key] ?? emptyScore;
				const firstSide = vsAi() ? human() : 'X';
				const next = !r.player
					? { ...prev, draws: prev.draws + 1 }
					: r.player === firstSide
						? { ...prev, a: prev.a + 1 }
						: { ...prev, b: prev.b + 1 };
				setScores((all) => ({ ...all, [key]: next }));
				save('uttt-scores', scores());

				const humanWon = r.player && (!vsAi() || r.player === human());
				if (humanWon) {
					const rect = board?.getBoundingClientRect();
					confetti(rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : {});
				}
				if (vsAi() && r.player === aiMark()) {
					setShake(true);
					shakeTimer = setTimeout(() => setShake(false), 600);
				}
				playSound(!r.player ? 'draw' : humanWon ? 'win' : 'lose');
				if (vsAi() && humanWon) unlock('ttt-ultimate');
			},
			{ defer: true },
		),
	);

	const resetScore = () => {
		setScores((all) => ({ ...all, [scoreKey()]: emptyScore }));
		save('uttt-scores', scores());
	};

	const winLine = () => {
		const line = result()?.line;
		if (!line?.length) return null;
		const [x1, y1] = centre(line[0]);
		const [x2, y2] = centre(line[2]);
		// Run the stroke a little past the outer boards' centres
		const dx = (x2 - x1) * 0.18;
		const dy = (y2 - y1) * 0.18;
		return { x1: x1 - dx, y1: y1 - dy, x2: x2 + dx, y2: y2 + dy, mark: result().player };
	};

	const level = () => difficulty()[0].toUpperCase() + difficulty().slice(1);
	const share = () => {
		const r = result();
		const headline = !vsAi()
			? r.player
				? `${r.player} won a game of Ultimate TicTacToe 🎉`
				: 'Ended in a draw in Ultimate TicTacToe 🤝'
			: !r.player
				? `I drew with the ${level()} Ultimate TicTacToe AI 🤝`
				: r.player === human()
					? `I beat the ${level()} Ultimate TicTacToe AI ${difficulty() === 'hard' ? '🧠' : '🎉'}`
					: `The ${level()} Ultimate TicTacToe AI beat me 😤`;
		shareResult(`${headline}\n${summarize(game().boards)}\n${location.origin}/tictactoe/ultimate`);
	};

	// After the AI moves, the status says where it played, since it happens while you're not looking
	const aiMove = () => {
		if (!vsAi() || result() || game().turn !== human() || game().last === null) return null;
		const { last } = game();
		const c = last % 9;
		return `${BOARD_NAMES[Math.floor(last / 9)]} board, row ${Math.floor(c / 3) + 1}, column ${(c % 3) + 1}${typeof moves().at(-1) === 'object' ? ', using a wildcard' : ''}`;
	};

	const destination = createMemo(() => {
		const index = previewIndex();
		if (index === null || aiTurn() || !legal().has(index)) return null;
		const after = playMove(game(), index, { wildcard: wildcardArmed() });
		return { board: after.forced, ended: Boolean(after.result) };
	});
	const previewText = () => {
		const next = destination();
		if (!next) return 'Hover or focus a square to preview where it sends your opponent.';
		if (next.ended) return 'This move ends the game.';
		return next.board === null ? 'Your opponent may choose any open board.' : `Your opponent must play in the ${BOARD_NAMES[next.board]} board.`;
	};

	// Where the player to move has to play, in words
	const where = () => (wildcardArmed() || game().forced === null ? 'anywhere' : `in the ${BOARD_NAMES[game().forced]} board`);

	return (
		<section class="page ttt uttt">
			<h1 class="page-title ttt-title">Ultimate TicTacToe</h1>

			<div class="ttt-settings">
				<Segmented label="Opponent" options={MODES} value={mode()} onChange={changeSetting(mode, setMode)} />
				<Show when={vsAi()}>
					<Segmented label="Your mark" options={MARKS} value={human()} onChange={changeSetting(human, setHuman)} />
					<Segmented label="Difficulty" options={DIFFICULTIES} value={difficulty()} onChange={changeSetting(difficulty, setDifficulty)} />
				</Show>
			</div>

			<div class="ttt-scoreboard" aria-label="Score">
				<div classList={{ 'ttt-score': true, leading: score().a > score().b }}>
					<span class="ttt-score-label">{vsAi() ? `You (${human()})` : 'X'}</span>
					<span class="ttt-score-value">{score().a}</span>
				</div>
				<div class="ttt-score">
					<span class="ttt-score-label">Draws</span>
					<span class="ttt-score-value">{score().draws}</span>
				</div>
				<div classList={{ 'ttt-score': true, leading: score().b > score().a }}>
					<span class="ttt-score-label">{vsAi() ? `AI (${aiMark()})` : 'O'}</span>
					<span class="ttt-score-value">{score().b}</span>
				</div>
			</div>

			<p class="ttt-status uttt-status" aria-live="polite">
				<Switch>
					<Match when={result()?.early}>Draw. No line of boards is possible.</Match>
					<Match when={result() && !result().player}>It's a draw!</Match>
					<Match when={result() && vsAi()}>{result().player === human() ? 'You win! 🎉' : 'The AI wins this one.'}</Match>
					<Match when={result()}>
						<span class={`mark-${result().player}`}>{result().player}</span> wins!
					</Match>
					<Match when={aiTurn()}>
						<span class="ttt-thinking">AI is thinking</span>
					</Match>
					<Match when={vsAi()}>
						<Show when={aiMove()}>
							{/* Read out, but not shown: the highlighted cell already shows sighted players */}
							<span class="uttt-sr">AI played the {aiMove()}. </span>
						</Show>
						Your turn (<span class={`mark-${human()}`}>{human()}</span>): play {where()}
					</Match>
					<Match when={true}>
						<span class={`mark-${game().turn}`}>{game().turn}</span> {game().forced === null ? 'can play anywhere' : `to play ${where()}`}
					</Match>
				</Switch>
			</p>

			<div class="uttt-wildcard-tools"><button class="btn btn-ghost" aria-pressed={wildcardArmed()} onClick={() => { setPreviewIndex(null); setWildcardArmed(value => !value); }} disabled={Boolean(result()) || aiTurn() || !game().wildcards?.[game().turn] || game().forced === null}>{wildcardArmed() ? 'Cancel wildcard' : `✦ Wildcard · ${game().wildcards?.[game().turn] ?? 0} left`}</button><p role="status">{wildcardArmed() ? 'Wildcard armed: play in any open board. Your move still sends the opponent to its matching board.' : 'One wildcard per side: break the forced-board rule once. Choose your moment.'}</p></div>
			<p class="uttt-preview-note" role="status">{previewText()}</p>
			<div class="uttt-board-wrap ttt-board-wrap" classList={{ shake: shake() }}>
				<div
					class="uttt-board"
					onKeyDown={(e) => (keyboard = e.key === 'Enter' || e.key === ' ')}
					onPointerDown={() => (keyboard = false)}
					onPointerLeave={() => setPreviewIndex(null)}
					onFocusOut={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPreviewIndex(null); }}
					classList={{ over: Boolean(result()) }}
					ref={board}
					role="group"
					aria-label="Game board"
					aria-busy={aiTurn()}
				>
					<Index each={NINE}>
						{(_, b) => (
							<div
								classList={{
									'uttt-sub': true,
									active: targets().has(b),
									'preview-target': Boolean(destination() && !destination().ended && (destination().board === b || destination().board === null && !game().boards[b])),
									claimed: game().boards[b] === 'X' || game().boards[b] === 'O',
									'won-X': game().boards[b] === 'X',
									'won-O': game().boards[b] === 'O',
									drawn: game().boards[b] === 'D',
									winning: Boolean(result()?.line.includes(b)),
								}}
								role="group"
								aria-label={`${BOARD_NAMES[b]} board${game().boards[b] ? (game().boards[b] === 'D' ? ', drawn' : `, won by ${game().boards[b]}`) : ''}`}
							>
								<Index each={NINE}>
									{(__, c) => {
										const index = b * 9 + c;
										const mark = () => game().cells[index];
										return (
											<button
												class={`uttt-cell ${mark() ? `mark-${mark()}` : 'empty'}${game().last === index ? ' last' : ''}`}
												onPointerEnter={() => setPreviewIndex(index)}
												onFocus={() => setPreviewIndex(index)}
												onClick={() => play(index)}
												disabled={!legal().has(index)}
												aria-label={`${BOARD_NAMES[b]} board, row ${Math.floor(c / 3) + 1}, column ${(c % 3) + 1}: ${mark() || 'empty'}`}
											>
												{mark()}
											</button>
										);
									}}
								</Index>
								<Show when={game().boards[b]}>
									<span class={`uttt-claim ${game().boards[b] === 'D' ? 'uttt-draw' : `mark-${game().boards[b]}`}`} aria-hidden="true">
										{game().boards[b] === 'D' ? '–' : game().boards[b]}
									</span>
								</Show>
							</div>
						)}
					</Index>
				</div>
				<Show when={winLine()}>
					{(line) => (
						<svg class="ttt-win-line" viewBox="0 0 300 300" aria-hidden="true">
							<line
								class={`stroke-${line().mark}`}
								x1={line().x1}
								y1={line().y1}
								x2={line().x2}
								y2={line().y2}
							/>
						</svg>
					)}
				</Show>
			</div>

			<div class="ttt-actions uttt-actions">
				<button class="btn" onClick={newGame}>
					{result() ? 'Play again' : 'Restart'}
				</button>
				<Show when={result()}>
					<button class="btn btn-ghost" onClick={share}>
						Share
					</button>
				</Show>
				<button class="btn btn-ghost" onClick={resetScore}>
					Reset score
				</button>
				<SoundToggle />
			</div>

			<div class="uttt-foot">
				<A href="/tictactoe" class="back-link">
					← Classic TicTacToe
				</A>
				<details class="uttt-help">
					<summary>How to play</summary>
					<p>
						Each cell you play sends your opponent to the matching small board: play the top-right cell of any board and they must play
						in the top-right board. If that board is already decided, they may play anywhere. Win three small boards in a line to win the
						game. A drawn board counts for nobody.
					</p>
				</details>
			</div>
		</section>
	);
}

export default UltimateTicTacToe;
