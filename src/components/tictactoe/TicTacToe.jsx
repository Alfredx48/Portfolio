import { A } from '@solidjs/router';
import { batch, createEffect, createMemo, createSignal, Index, Match, on, onCleanup, onMount, Show, Switch } from 'solid-js';
import { unlock } from '../../state/achievements';
import { confetti } from '../../utils/confetti';
import { shareResult } from '../../utils/share';
import { playSound } from '../../utils/sound';
import { load, save } from '../../utils/storage';
import Segmented from '../ui/Segmented';
import SoundToggle from '../ui/SoundToggle';
import { cellsFromMoves, chooseMove, evaluateMoves, getOutcome, getResult, movesFromEvents, other, SIZES } from './logic';
import { difficultyLabel, resultText } from './shareText';
import { chooseOrbitMove, orbitOutcome } from './orbit';
import './tictactoe.css';

const AI_DELAY_MS = 450; // long enough to feel like it's thinking
const CLEAR_DELAY_MS = 350; // matches the fade-out on the mark being cleared
const REPLAY_STEP_MS = 500;
const emptyScore = { a: 0, b: 0, draws: 0 };

const MODES = [
	{ value: 'ai', label: 'vs AI' },
	{ value: 'pvp', label: '2 Players' },
];
// Only 3×3 can be solved, so on the bigger boards the top level is honestly just "Hard"
const difficulties = (size, orbit = false) =>
	['easy', 'medium', 'impossible'].map((value) => ({ value, label: orbit && value === 'impossible' ? 'Hard' : difficultyLabel(value, size) }));
const BOARDS = SIZES.map((size) => ({
	value: size,
	label: `${size}×${size}`,
	title: size === 3 ? 'Three in a row' : 'Four in a row',
}));
const RULES = [
	{ value: 'classic', label: 'Classic', title: 'Draws end the game' },
	{ value: 'orbit', label: 'Orbit', title: 'The outer ring shifts clockwise after every two moves' },
	{ value: 'endless', label: 'Endless', title: 'Instead of a draw, the oldest mark is cleared until someone wins' },
];
const MARKS = [
	{ value: 'X', label: 'Play X', title: 'X moves first' },
	{ value: 'O', label: 'Play O', title: 'The AI moves first' },
];

// The win-line overlay's viewBox is 100 units per cell; this is the centre of cell i
const centre = (i, size) => [(i % size) * 100 + 50, Math.floor(i / size) * 100 + 50];

function TicTacToe() {
	const saved = load('ttt-settings', {});
	const [mode, setMode] = createSignal(saved.mode ?? 'ai');
	const [difficulty, setDifficulty] = createSignal(saved.difficulty ?? 'medium');
	const [human, setHuman] = createSignal(saved.human ?? 'X');
	const [rules, setRules] = createSignal(saved.rules ?? 'classic');
	const [size, setSize] = createSignal(SIZES.includes(saved.size) ? saved.size : 3);
	const [scores, setScores] = createSignal(load('ttt-scores', {}));
	// Everything that has happened this game: marks placed and (endless mode) marks cleared.
	// Everything else about the game is derived from this, which is what makes undo and replay exact.
	const [events, setEvents] = createSignal([]);
	// null, or the replay of a finished game: how many events are on show, and whether it's paused
	const [replay, setReplay] = createSignal(null);
	const [hints, setHints] = createSignal(false);
	// Hints make the game too easy to count for achievements. Reset along with the game.
	const [hintsUsed, setHintsUsed] = createSignal(false);
	// Taking back moves is an assist too, so it also keeps a game from earning achievements
	const [undoUsed, setUndoUsed] = createSignal(false);
	const [moreOpen, setMoreOpen] = createSignal(false);
	const [game, setGame] = createSignal(0);
	const [shake, setShake] = createSignal(false);
	const [matchGoal, setMatchGoal] = createSignal(0);
	const [matchScore, setMatchScore] = createSignal({ ...emptyScore });
	const matchWinner = () => !matchGoal() ? null : matchScore().a >= matchGoal() ? 'a' : matchScore().b >= matchGoal() ? 'b' : null;
	let board;
	let pauseButton;
	let replayButton;

	// Turns alternate from X. Endless mode clears marks, so the mark counts can't tell whose turn it is,
	// but the newest mark always survives, so it can.
	// The marks on the board, oldest first
	const moves = createMemo(() => movesFromEvents(events()));
	const cleared = createMemo(() => events().filter((event) => event.type === 'clear').length);
	const turn = createMemo(() => (moves().length ? other(moves().at(-1).mark) : 'X'));
	const cells = createMemo(() => cellsFromMoves(moves(), size()));
	// Games are drawn as soon as nobody can win, not only when the board is full.
	const orbit = () => rules() === 'orbit';
	const placements = () => events().filter(event => event.type === 'place').length;
	const rotations = () => events().filter(event => event.type === 'orbit').length;
	const outcome = createMemo(() => orbit() ? orbitOutcome(cells()) : getOutcome(cells(), turn()));
	const endless = () => rules() === 'endless';
	// In endless mode a draw doesn't end the game: the oldest mark is cleared instead (repeatedly, if need be).
	const clearing = () => endless() && outcome() && !outcome().player;
	const result = createMemo(() => (clearing() ? null : outcome()));
	const vsAi = () => mode() === 'ai';
	const aiMark = () => other(human());
	const aiNext = () => vsAi() && !result() && turn() === aiMark();
	// Unlike aiNext, false while endless mode is clearing a mark
	const aiTurn = () => aiNext() && !outcome();
	// 3×3 keeps its original keys, so scores from before the bigger boards existed are still there
	const scoreKey = () =>
		`${vsAi() ? `ai-${difficulty()}` : 'pvp'}${endless() ? '-endless' : orbit() ? '-orbit' : ''}${size() === 3 ? '' : `-${size()}x${size()}`}`;
	const score = () => scores()[scoreKey()] ?? emptyScore;

	// What's drawn on the board: the real game, or a replay of it
	const shown = createMemo(() =>
		replay() ? cellsFromMoves(movesFromEvents(events().slice(0, replay().step)), size()) : cells(),
	);

	// Hints show what perfect play leads to for whoever is about to move, so they only make sense on a
	// 3×3 board, on a human's turn. They always assume classic rules: in endless mode they describe the
	// current board as if the game ended in a draw, ignoring that a mark might be cleared later.
	const hintsShown = () => hints() && !orbit() && size() === 3 && !replay() && !outcome() && !aiNext();
	// Endless mode never ends in a draw (marks are cleared until someone wins), so "draw" would be a
	// misleading thing to promise: only wins and losses are shown there.
	const hintValues = createMemo(() => {
		if (!hintsShown()) return [];
		const values = evaluateMoves(cells(), turn());
		return endless() ? values.map((value) => (value === 'draw' ? null : value)) : values;
	});
	createEffect(() => {
		game(); // a new game on a board that's already showing hints still counts
		if (hintValues().length) setHintsUsed(true);
	});

	onMount(() => (document.title = 'TicTacToe | Alfred Shaheen'));

	createEffect(() =>
		save('ttt-settings', { mode: mode(), difficulty: difficulty(), human: human(), rules: rules(), size: size() }),
	);

	const place = (index) => {
		const mark = turn();
		playSound('place');
		batch(() => {
			setEvents((prev) => [...prev, { type: 'place', index, mark }]);
			if (orbit() && placements() % 2 === 0 && !getResult(cells())?.player) {
				setEvents((prev) => [...prev, { type: 'orbit', size: size() }]);
				playSound('pop');
			}
		});
	};

	const play = (index) => {
		if (cells()[index] || outcome() || aiTurn() || replay()) return;
		place(index);
	};

	const newGame = () =>
		batch(() => {
			setEvents([]);
			setReplay(null);
			setHintsUsed(false);
			setUndoUsed(false);
			setGame((n) => n + 1);
		});

	// Batched, so the board never briefly holds marks from the old size
	const changeSetting = (setter) => (value) =>
		batch(() => {
			setter(value);
			if (value === 'orbit') setHints(false);
			setMatchScore({ ...emptyScore });
			newGame();
		});

	// Hints only exist on 3×3, so leaving the size turns them off rather than leaving them on unseen
	const changeSize = (value) =>
		batch(() => {
			setHints(false);
			changeSetting(setSize)(value);
		});

	// Against the AI, undo takes back your last move and everything after it (the AI's reply, and any
	// marks endless mode cleared), so it's your turn again. With a friend it takes back one move.
	// Taking back the events puts cleared marks back too, because the board is just the events replayed.
	const undoable = (event) => event.type === 'place' && (!vsAi() || event.mark === human());
	const canUndo = () => !matchGoal() && !replay() && !result() && events().some(undoable);
	const undo = () => {
		if (!canUndo()) return;
		setUndoUsed(true);
		setEvents((prev) => prev.slice(0, prev.findLastIndex(undoable)));
	};

	// Replaying swaps the action row, so keep keyboard focus on a control that exists
	createEffect(
		on(
			() => Boolean(replay()),
			(active) => (active ? pauseButton : replayButton)?.focus(),
			{ defer: true },
		),
	);

	// What the player needs to know about why a game won't earn achievements
	const assistNote = () => {
		if (!vsAi()) return '';
		const parts = [hints() ? 'Hints on' : hintsUsed() && 'Hints used', undoUsed() && 'Undo used'].filter(Boolean);
		return parts.length ? `${parts.join(' · ')} · this game won't earn achievements` : '';
	};
	// The settings that aren't at their defaults, for the collapsed "More options" button
	const optionsSummary = () =>
		[size() !== 3 && `${size()}×${size()}`, endless() && 'Endless', orbit() && 'Orbit', vsAi() && human() === 'O' && 'Play O'].filter(Boolean).join(' · ');

	// When it's the AI's turn, it moves after a short pause
	createEffect(() => {
		if (!aiTurn()) return;
		const snapshot = cells();
		const level = difficulty();
		const me = turn();
		const timer = setTimeout(() => {
			const move = orbit() ? chooseOrbitMove(snapshot, me, level, (placements() + 1) % 2 === 0) : chooseMove(snapshot, level, Math.random, me);
			if (move !== null) place(move);
		}, AI_DELAY_MS + Math.random() * 250);
		onCleanup(() => clearTimeout(timer));
	});

	// Endless mode: fade out the oldest mark, then clear it. If it's still a draw, this runs again.
	createEffect(() => {
		if (!clearing()) return;
		moves(); // rerun after each clear, even though `clearing` stays true
		const timer = setTimeout(() => {
			playSound('pop');
			setEvents((prev) => [...prev, { type: 'clear' }]);
		}, CLEAR_DELAY_MS);
		onCleanup(() => clearTimeout(timer));
	});
	const vanishing = () => (clearing() ? moves()[0]?.index : null);

	// Replays the finished game from an empty board, one event at a time, then closes on the final position
	createEffect(() => {
		const current = replay();
		if (!current || current.paused) return;
		const timer = setTimeout(() => {
			const event = events()[current.step];
			if (!event) return setReplay(null);
			playSound(event.type !== 'place' ? 'pop' : 'place');
			setReplay({ ...current, step: current.step + 1 });
		}, REPLAY_STEP_MS);
		onCleanup(() => clearTimeout(timer));
	});

	// Score the game, celebrate, and hand out achievements once it ends
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
				save('ttt-scores', scores());
				if (matchGoal()) setMatchScore((previous) => !r.player
					? { ...previous, draws: previous.draws + 1 }
					: r.player === firstSide ? { ...previous, a: previous.a + 1 } : { ...previous, b: previous.b + 1 });

				const humanWon = r.player && (!vsAi() || r.player === human());
				playSound(!r.player ? 'draw' : vsAi() && r.player === aiMark() ? 'lose' : 'win');
				if (humanWon) {
					const rect = board?.getBoundingClientRect();
					confetti(rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : {});
				}
				if (vsAi() && r.player === aiMark()) {
					setShake(true);
					setTimeout(() => setShake(false), 600);
				}
				// Only fair fights count: against the AI, and without hints or undo
				if (!vsAi() || orbit() || hintsUsed() || undoUsed()) return;
				const level = difficulty();
				if (humanWon && level !== 'easy') unlock('ttt-beat-medium');
				// "Impossible" is only literally true on 3×3
				if (!r.player && level === 'impossible' && size() === 3) unlock('ttt-draw-impossible');
				if (humanWon) {
					const placed = events().filter((event) => event.type === 'place' && event.mark === human()).length;
					if (placed === 3) unlock('ttt-quick-win');
					if (endless() && level === 'impossible' && size() === 3) unlock('ttt-endless-impossible');
					if (size() === 5 && level !== 'easy') unlock('ttt-big-board');
				}
			},
			{ defer: true },
		),
	);

	const changeMatch = (event) => batch(() => {
		setMatchGoal(Number(event.currentTarget.value));
		setMatchScore({ ...emptyScore });
		setHints(false);
		newGame();
	});
	const nextRound = () => batch(() => {
		if (matchWinner()) setMatchScore({ ...emptyScore });
		newGame();
	});

	const resetScore = () => {
		setScores((all) => ({ ...all, [scoreKey()]: emptyScore }));
		save('ttt-scores', scores());
	};

	const share = () =>
		shareResult(
			resultText({
				result: result(),
				vsAi: vsAi(),
				human: human(),
				difficulty: orbit() && difficulty() === 'impossible' ? 'hard' : difficulty(),
				rules: rules(),
				size: size(),
				cells: cells(),
				url: `${location.origin}/tictactoe`,
			}),
		);

	const winLine = () => {
		const line = result()?.line;
		if (!line?.length || replay()) return null;
		const [x1, y1] = centre(line[0], size());
		const [x2, y2] = centre(line.at(-1), size());
		// Run the stroke a little past the outer cells' centres: a third of a cell, whatever the line's length
		const length = Math.hypot(x2 - x1, y2 - y1);
		const dx = ((x2 - x1) / length) * 36;
		const dy = ((y2 - y1) / length) * 36;
		return { x1: x1 - dx, y1: y1 - dy, x2: x2 + dx, y2: y2 + dy, mark: result().player };
	};

	return (
		<section class="page ttt ttt-classic" classList={{ 'orbit-mode': orbit() }}>
			<h1 class="page-title ttt-title">TicTacToe</h1>

			<div class="ttt-settings">
				<Segmented label="Opponent" options={MODES} value={mode()} onChange={changeSetting(setMode)} />
				<button
					type="button"
					class="ttt-more-toggle"
					aria-expanded={moreOpen()}
					aria-controls="ttt-more"
					aria-label={`More options${optionsSummary() ? `: ${optionsSummary()}` : ''}`}
					onClick={() => setMoreOpen((open) => !open)}
				>
					<span class="ttt-more-label">More options</span>
					<Show when={optionsSummary()}>
						<span class="ttt-more-summary">{optionsSummary()}</span>
					</Show>
					<span aria-hidden="true">{moreOpen() ? '▴' : '▾'}</span>
				</button>
				<Show when={vsAi()}>
					<div class="ttt-difficulty">
						<Segmented label="Difficulty" options={difficulties(size(), orbit())} value={difficulty()} onChange={changeSetting(setDifficulty)} />
					</div>
				</Show>
				{/* On wide screens these sit in the row with the rest; on phones they fold away */}
				<div id="ttt-more" class="ttt-more" classList={{ open: moreOpen() }}>
					<Segmented label="Rules" options={RULES} value={rules()} onChange={changeSetting(setRules)} />
					<Segmented label="Board size" options={BOARDS} value={size()} onChange={changeSize} />
					<Show when={vsAi()}>
						<Segmented label="Your mark" options={MARKS} value={human()} onChange={changeSetting(setHuman)} />
					</Show>
					<button class="ttt-reset" onClick={resetScore}>
						Reset score
					</button>
				</div>
			</div>

			<Show when={orbit()}><p class="ttt-orbit-note" role="status"><strong>↻ Orbit {rotations()}</strong> · The outer ring shifts after every second move. {placements() % 2 ? 'Next move triggers the shift.' : 'Two moves until the next shift.'} Wins are checked before and after the shift. Hard AI plays heuristically.</p></Show>
			<div class="ttt-match-tools">
				<label>Match length <select value={matchGoal()} onChange={changeMatch}>
					<option value="0">Free play</option><option value="3">First to 3 wins</option><option value="5">First to 5 wins</option>
				</select></label>
				<Show when={matchGoal()}>
					<p class="ttt-match-progress" role="status">{vsAi() ? 'You' : 'X'} {matchScore().a} : {matchScore().b} {vsAi() ? 'AI' : 'O'} · {matchScore().draws} draws
						<Show when={matchWinner()}> · {matchWinner() === 'a' ? (vsAi() ? 'You win the match!' : 'X wins the match!') : (vsAi() ? 'The AI wins the match.' : 'O wins the match!')}</Show>
					</p>
					<p class="ttt-match-note">Saved totals below. Hints and undo are off during a match; changing settings starts a new series.</p>
				</Show>
			</div>

			<div class="ttt-scoreboard" aria-label="Score">
				<div classList={{ 'ttt-score': true, leading: score().a > score().b }}>
					<span class="ttt-score-label">{vsAi() ? `You (${human()})` : 'X'}</span>
					<span class="ttt-score-value">{score().a}</span>
				</div>
				<Show
					when={endless()}
					fallback={
						<div class="ttt-score">
							<span class="ttt-score-label">Draws</span>
							<span class="ttt-score-value">{score().draws}</span>
						</div>
					}
				>
					<div class="ttt-score" title="Marks cleared this game to avoid a draw">
						<span class="ttt-score-label">Cleared</span>
						<span class="ttt-score-value">{cleared()}</span>
					</div>
				</Show>
				<div classList={{ 'ttt-score': true, leading: score().b > score().a }}>
					<span class="ttt-score-label">{vsAi() ? `AI (${aiMark()})` : 'O'}</span>
					<span class="ttt-score-value">{score().b}</span>
				</div>
			</div>

			<p class="ttt-status" aria-live="polite">
				<Switch>
					<Match when={replay()}>Replaying the game</Match>
					<Match when={result()?.early}>Draw. Nobody can win from here.</Match>
					<Match when={result() && !result().player}>It's a draw!</Match>
					<Match when={result() && vsAi()}>{result().player === human() ? 'You win! 🎉' : 'The AI wins this one.'}</Match>
					<Match when={result()}>
						<span class={`mark-${result().player}`}>{result().player}</span> wins!
					</Match>
					<Match when={aiNext()}>
						<span class="ttt-thinking">AI is thinking</span>
					</Match>
					<Match when={vsAi()}>
						Your turn (<span class={`mark-${human()}`}>{human()}</span>)
					</Match>
					<Match when={true}>
						Turn: <span class={`mark-${turn()}`}>{turn()}</span>
					</Match>
				</Switch>
			</p>

			<p class="ttt-note" aria-live="polite">
				{assistNote()}
			</p>

			<div class="ttt-board-wrap" classList={{ shake: shake() }} style={{ '--ttt-n': size() }}>
				<div
					class="ttt-board"
					classList={{ 'dead-draw': Boolean(result()?.early) && !replay() }}
					ref={board}
					role="group"
					aria-label="Game board"
					aria-busy={aiTurn()}
				>
					<Index each={shown()}>
						{(cell, index) => (
							<button
								class={`ttt-cell ${cell() ? `mark-${cell()}` : 'empty'}${!replay() && result()?.line.includes(index) ? ' winning' : ''}${vanishing() === index ? ' vanishing' : ''}${hintValues()[index] ? ` hint-${hintValues()[index]}` : ''}`}
								onClick={() => play(index)}
								disabled={Boolean(cell() || outcome() || replay())}
								aria-label={`Row ${Math.floor(index / size()) + 1}, column ${(index % size()) + 1}: ${cell() || 'empty'}${hintValues()[index] ? `, leads to a ${hintValues()[index]}` : ''}`}
							>
								{cell()}
							</button>
						)}
					</Index>
				</div>
				<Show when={winLine()}>
					{(line) => (
						<svg class="ttt-win-line" viewBox={`0 0 ${size() * 100} ${size() * 100}`} aria-hidden="true">
							<line
								class={`stroke-${line().mark}`}
								style={{ 'stroke-width': `${(size() * 10) / 3}px` }}
								pathLength="1"
								x1={line().x1}
								y1={line().y1}
								x2={line().x2}
								y2={line().y2}
							/>
						</svg>
					)}
				</Show>
			</div>

			<div class="ttt-actions">
				<Show
					when={replay()}
					fallback={
						<>
							<button class="btn" onClick={nextRound}>
								{matchWinner() ? 'New match' : result() ? (matchGoal() ? 'Next round' : 'Play again') : 'Restart'}
							</button>
							{/* On narrow phones these three show an icon instead of a label, to fit one row */}
							<button class="btn btn-ghost" onClick={undo} disabled={!canUndo()} aria-label="Undo" title="Take back your last move. Games with undo don’t count for achievements.">
								<span class="ttt-icon" aria-hidden="true">↶</span>
								<span class="ttt-label">Undo</span>
							</button>
							<Show
								when={result()}
								fallback={
									<button
										class="btn btn-ghost"
										aria-pressed={hints()}
										disabled={size() !== 3 || Boolean(matchGoal()) || orbit()}
										title={orbit() ? 'Classic hints cannot predict a moving Orbit board.' : matchGoal() ? 'Hints are off during match series.' : size() === 3 ? 'Show what perfect play leads to. Games with hints don’t count for achievements.' : 'Hints are only available on 3×3'}
										onClick={() => setHints((on) => !on)}
									>
										Hints
									</button>
								}
							>
								<button
									class="btn btn-ghost"
									ref={(el) => (replayButton = el)}
									onClick={() => setReplay({ step: 0, paused: false })}
									aria-label="Replay"
								>
									<span class="ttt-icon" aria-hidden="true">▶</span>
									<span class="ttt-label">Replay</span>
								</button>
								<button class="btn btn-ghost" onClick={share} aria-label="Share">
									<span class="ttt-icon" aria-hidden="true">↗</span>
									<span class="ttt-label">Share</span>
								</button>
							</Show>
							<SoundToggle />
						</>
					}
				>
					<span class="ttt-replay-step">
						Step {replay().step} / {events().length}
					</span>
					<button
						class="btn btn-ghost"
						ref={(el) => (pauseButton = el)}
						onClick={() => setReplay((r) => ({ ...r, paused: !r.paused }))}
					>
						{replay().paused ? 'Resume' : 'Pause'}
					</button>
					<button class="btn btn-ghost" onClick={() => setReplay(null)}>
						Skip to end
					</button>
				</Show>
			</div>

			<div class="ttt-links">
				<A href="/tictactoe/ultimate">Ultimate TicTacToe →</A>
				<A href="/tictactoe/online">Play a friend online →</A>
			</div>
		</section>
	);
}

export default TicTacToe;
