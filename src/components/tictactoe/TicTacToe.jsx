import { createEffect, createMemo, createSignal, Index, Match, on, onCleanup, onMount, Show, Switch } from 'solid-js';
import { unlock } from '../../state/achievements';
import { confetti } from '../../utils/confetti';
import { load, save } from '../../utils/storage';
import Segmented from '../ui/Segmented';
import { chooseMove, getOutcome, nextPlayer, other } from './logic';
import './tictactoe.css';

const AI_DELAY_MS = 450; // long enough to feel like it's thinking
const emptyBoard = () => Array(9).fill('');
const emptyScore = { a: 0, b: 0, draws: 0 };

const MODES = [
	{ value: 'ai', label: 'vs AI' },
	{ value: 'pvp', label: '2 Players' },
];
const DIFFICULTIES = [
	{ value: 'easy', label: 'Easy' },
	{ value: 'medium', label: 'Medium' },
	{ value: 'impossible', label: 'Impossible' },
];
const MARKS = [
	{ value: 'X', label: 'Play X', title: 'X moves first' },
	{ value: 'O', label: 'Play O', title: 'The AI moves first' },
];

// Centre of each cell in the win-line overlay's 300×300 viewBox
const centre = (i) => [(i % 3) * 100 + 50, Math.floor(i / 3) * 100 + 50];

function TicTacToe() {
	const saved = load('ttt-settings', {});
	const [mode, setMode] = createSignal(saved.mode ?? 'ai');
	const [difficulty, setDifficulty] = createSignal(saved.difficulty ?? 'medium');
	const [human, setHuman] = createSignal(saved.human ?? 'X');
	const [scores, setScores] = createSignal(load('ttt-scores', {}));
	const [cells, setCells] = createSignal(emptyBoard());
	const [shake, setShake] = createSignal(false);
	let board;

	// The board is the only game state; whose turn it is and who won are derived from it.
	// Games end as a draw as soon as nobody can win, not only when the board is full.
	const turn = createMemo(() => nextPlayer(cells()));
	const result = createMemo(() => getOutcome(cells()));
	const vsAi = () => mode() === 'ai';
	const aiMark = () => other(human());
	const aiTurn = () => vsAi() && !result() && turn() === aiMark();
	const scoreKey = () => (vsAi() ? `ai-${difficulty()}` : 'pvp');
	const score = () => scores()[scoreKey()] ?? emptyScore;

	onMount(() => (document.title = 'TicTacToe | Alfred Shaheen'));

	createEffect(() => save('ttt-settings', { mode: mode(), difficulty: difficulty(), human: human() }));

	const place = (index) => setCells((prev) => prev.map((cell, i) => (i === index ? turn() : cell)));

	const play = (index) => {
		if (cells()[index] || result() || aiTurn()) return;
		place(index);
	};

	const newGame = () => setCells(emptyBoard());

	const changeSetting = (setter) => (value) => {
		setter(value);
		newGame();
	};

	// When it's the AI's turn, it moves after a short pause
	createEffect(() => {
		if (!aiTurn()) return;
		const snapshot = cells();
		const level = difficulty();
		const timer = setTimeout(() => {
			const move = chooseMove(snapshot, level);
			if (move !== null) place(move);
		}, AI_DELAY_MS + Math.random() * 250);
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

				const humanWon = r.player && (!vsAi() || r.player === human());
				if (humanWon) {
					const rect = board?.getBoundingClientRect();
					confetti(rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : {});
				}
				if (vsAi() && r.player === aiMark()) {
					setShake(true);
					setTimeout(() => setShake(false), 600);
				}
				if (vsAi() && humanWon && difficulty() !== 'easy') unlock('ttt-beat-medium');
				if (vsAi() && !r.player && difficulty() === 'impossible') unlock('ttt-draw-impossible');
			},
			{ defer: true },
		),
	);

	const resetScore = () => {
		setScores((all) => ({ ...all, [scoreKey()]: emptyScore }));
		save('ttt-scores', scores());
	};

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

	return (
		<section class="page ttt">
			<h1 class="page-title ttt-title">TicTacToe</h1>

			<div class="ttt-settings">
				<Segmented label="Opponent" options={MODES} value={mode()} onChange={changeSetting(setMode)} />
				<Show when={vsAi()}>
					<Segmented label="Your mark" options={MARKS} value={human()} onChange={changeSetting(setHuman)} />
					<Segmented label="Difficulty" options={DIFFICULTIES} value={difficulty()} onChange={changeSetting(setDifficulty)} />
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

			<p class="ttt-status" aria-live="polite">
				<Switch>
					<Match when={result()?.early}>Draw. Nobody can win from here.</Match>
					<Match when={result() && !result().player}>It's a draw!</Match>
					<Match when={result() && vsAi()}>{result().player === human() ? 'You win! 🎉' : 'The AI wins this one.'}</Match>
					<Match when={result()}>
						<span class={`mark-${result().player}`}>{result().player}</span> wins!
					</Match>
					<Match when={aiTurn()}>
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

			<div class="ttt-board-wrap" classList={{ shake: shake() }}>
				<div
					class="ttt-board"
					classList={{ 'dead-draw': Boolean(result()?.early) }}
					ref={board}
					role="group"
					aria-label="Game board"
					aria-busy={aiTurn()}
				>
					<Index each={cells()}>
						{(cell, index) => (
							<button
								class={`ttt-cell ${cell() ? `mark-${cell()}` : 'empty'}${result()?.line.includes(index) ? ' winning' : ''}`}
								onClick={() => play(index)}
								disabled={Boolean(cell() || result())}
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

			<div class="ttt-actions">
				<button class="btn" onClick={newGame}>
					{result() ? 'Play again' : 'Restart'}
				</button>
				<button class="btn btn-ghost" onClick={resetScore}>
					Reset score
				</button>
			</div>
		</section>
	);
}

export default TicTacToe;
