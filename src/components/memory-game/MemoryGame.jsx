import { createEffect, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { unlock } from '../../state/achievements';
import { confetti } from '../../utils/confetti';
import { load, save } from '../../utils/storage';
import Segmented from '../ui/Segmented';
import Card from './Card';
import { createDeck, formatTime, LEVELS, starsFor } from './deck';
import './memory-game.css';

const FLIP_BACK_MS = 1000;
const COMBO_FLASH_MS = 900;
const COMBO_ACHIEVEMENT = 4;

const LEVEL_OPTIONS = Object.entries(LEVELS).map(([value, level]) => ({ value, label: level.label }));
const LEVEL_ORDER = Object.keys(LEVELS);

// Shows the win count on the app icon when the site is installed as an app.
function setAppBadge(count) {
	navigator.setAppBadge?.(count)?.catch(() => {});
}

function MemoryGame() {
	const [level, setLevel] = createSignal(LEVELS[load('memory-level')] ? load('memory-level') : 'medium');
	const [deck, setDeck] = createSignal(createDeck(LEVELS[level()].pairs));
	const [matched, setMatched] = createSignal(new Set()); // names of matched logos
	const [first, setFirst] = createSignal(null);
	const [second, setSecond] = createSignal(null);
	const [moves, setMoves] = createSignal(0);
	const [combo, setCombo] = createSignal(0);
	const [comboFlash, setComboFlash] = createSignal(null);
	const [status, setStatus] = createSignal('ready'); // ready | playing | won
	const [startedAt, setStartedAt] = createSignal(0);
	const [now, setNow] = createSignal(0);
	const [finalTime, setFinalTime] = createSignal(0);
	const [wins, setWins] = createSignal(0);
	const [best, setBest] = createSignal(load('memory-best', {}));
	const [lastGame, setLastGame] = createSignal(null);

	const pairs = () => LEVELS[level()].pairs;
	const elapsed = () => (status() === 'won' ? finalTime() : status() === 'playing' ? now() - startedAt() : 0);
	const levelBest = () => best()[level()];

	let flipTimer;
	let flashTimer;
	const ticker = setInterval(() => status() === 'playing' && setNow(Date.now()), 250);
	onCleanup(() => {
		clearInterval(ticker);
		clearTimeout(flipTimer);
		clearTimeout(flashTimer);
	});

	onMount(() => (document.title = 'Memory Game | Alfred Shaheen'));
	createEffect(() => {
		if (wins() > 0) document.title = `Memory Game · ${wins()} ${wins() === 1 ? 'win' : 'wins'}`;
	});

	const isFaceUp = (card) => card === first() || card === second() || matched().has(card.name);

	const clearPicks = () => {
		setFirst(null);
		setSecond(null);
	};

	const newGame = () => {
		clearTimeout(flipTimer);
		clearPicks();
		setMatched(new Set());
		setMoves(0);
		setCombo(0);
		setComboFlash(null);
		setStatus('ready');
		setLastGame(null);
		setDeck(createDeck(pairs()));
	};

	const changeLevel = (value) => {
		setLevel(value);
		save('memory-level', value);
		newGame();
	};

	const finish = () => {
		const time = Date.now() - startedAt();
		setFinalTime(time);
		setStatus('won');
		setWins((w) => w + 1);
		setAppBadge(wins());

		const previous = best()[level()];
		const newBestMoves = !previous || moves() < previous.moves;
		const newBestTime = !previous || time < previous.time;
		setBest((all) => ({
			...all,
			[level()]: {
				moves: newBestMoves ? moves() : previous.moves,
				time: newBestTime ? time : previous.time,
			},
		}));
		save('memory-best', best());

		setLastGame({ stars: starsFor(moves(), pairs()), time, newBestMoves, newBestTime });
		confetti();
		if (level() === 'hard') unlock('memory-hard');
	};

	const flip = (card) => {
		// Ignore clicks after the game, while two cards are showing, and on cards already face up
		if (status() === 'won' || second() || isFaceUp(card)) return;

		if (status() === 'ready') {
			setStatus('playing');
			setStartedAt(Date.now());
			setNow(Date.now());
		}

		if (!first()) {
			setFirst(card);
			return;
		}

		setSecond(card);
		setMoves((m) => m + 1);

		if (first().name !== card.name) {
			setCombo(0);
			flipTimer = setTimeout(clearPicks, FLIP_BACK_MS);
			return;
		}

		setMatched((prev) => new Set(prev).add(card.name));
		clearPicks();
		setCombo((c) => c + 1);
		if (combo() >= 2) {
			setComboFlash({ count: combo() }); // a new object, so the keyed <Show> replays its animation
			clearTimeout(flashTimer);
			flashTimer = setTimeout(() => setComboFlash(null), COMBO_FLASH_MS);
		}
		if (combo() >= COMBO_ACHIEVEMENT) unlock('memory-combo');

		if (matched().size === pairs()) finish();
	};

	const nextLevel = () => LEVEL_ORDER[LEVEL_ORDER.indexOf(level()) + 1];

	return (
		<section class="page memory-game">
			<h1 class="page-title mg-title">Memory Game</h1>

			<div class="mg-toolbar">
				<Segmented label="Difficulty" options={LEVEL_OPTIONS} value={level()} onChange={changeLevel} />
				<button class="btn" onClick={newGame}>
					New game
				</button>
			</div>

			<dl class="mg-stats">
				<div>
					<dt>Moves</dt>
					<dd>{moves()}</dd>
				</div>
				<div>
					<dt>Time</dt>
					<dd>{formatTime(elapsed())}</dd>
				</div>
				<div>
					<dt>Combo</dt>
					<dd classList={{ hot: combo() >= 2 }}>×{combo()}</dd>
				</div>
				<div>
					<dt>Best</dt>
					<dd>{levelBest() ? `${levelBest().moves} · ${formatTime(levelBest().time)}` : '—'}</dd>
				</div>
			</dl>

			<div
				class="mg-board"
				style={{
					'--cols': LEVELS[level()].cols,
					'--cols-narrow': LEVELS[level()].colsNarrow,
					'--rows': (pairs() * 2) / LEVELS[level()].cols,
				}}
			>
				<div class="mg-grid">
					<For each={deck()}>
						{(card) => (
							<Card
								name={card.name}
								image={card.image}
								faceUp={isFaceUp(card)}
								matched={matched().has(card.name)}
								onFlip={() => flip(card)}
							/>
						)}
					</For>
				</div>

				<Show when={comboFlash()} keyed>
					{(flash) => (
						<p class="mg-combo" aria-live="polite">
							Combo ×{flash.count}!
						</p>
					)}
				</Show>

				<Show when={lastGame()}>
					{(game) => (
						<div class="mg-overlay" role="dialog" aria-label="Board cleared">
							<div class="mg-result">
								<p class="mg-result-title">Board cleared!</p>
								<p class="mg-stars" aria-label={`${game().stars} out of 3 stars`}>
									<For each={[1, 2, 3]}>{(n) => <span classList={{ lit: n <= game().stars }}>★</span>}</For>
								</p>
								<p>
									{moves()} moves{game().newBestMoves && <span class="mg-new-best">best!</span>} ·{' '}
									{formatTime(game().time)}
									{game().newBestTime && <span class="mg-new-best">best!</span>}
								</p>
								<div class="mg-result-actions">
									<button class="btn" onClick={newGame}>
										Play again
									</button>
									<Show when={nextLevel()}>
										<button class="btn btn-ghost" onClick={() => changeLevel(nextLevel())}>
											Try {LEVELS[nextLevel()].label}
										</button>
									</Show>
								</div>
							</div>
						</div>
					)}
				</Show>
			</div>
		</section>
	);
}

export default MemoryGame;
