import { createEffect, createSignal, For, Match, onCleanup, onMount, Show, Switch } from 'solid-js';
import { unlock } from '../../state/achievements';
import { confetti } from '../../utils/confetti';
import { shareResult } from '../../utils/share';
import { playSound } from '../../utils/sound';
import { load, save } from '../../utils/storage';
import Segmented from '../ui/Segmented';
import SoundToggle from '../ui/SoundToggle';
import Card from './Card';
import { dailyStreak, dateKey, recordDaily } from './daily';
import { createDeck, DAILY_LEVEL, dailyDeck, formatCountdown, formatTime, LEVELS, starsFor } from './deck';
import { classicShareText, dailyShareText, timeAttackShareText } from './share-text';
import './memory-game.css';

const FLIP_BACK_MS = 1000;
const PEEK_MS = 1000;
const COMBO_FLASH_MS = 900;
const FLOAT_MS = 900;
const COMBO_ACHIEVEMENT = 4;
const MATCH_BONUS_MS = 3000;
const MISS_PENALTY_MS = 1000;
const TICK_FROM = 5; // seconds left when the clock starts ticking
const LOSS_REVEAL_MS = 1800; // keep in step with the delay on .mg-overlay.lost
const REVEAL_SLACK_MS = 100; // the dialog turns visible just after its delay, and only then can take focus

const MODE_OPTIONS = [
	{ value: 'classic', label: 'Classic' },
	{ value: 'drift', label: 'Drift', title: 'Unmatched cards shift after every third miss' },
	{ value: 'daily', label: 'Daily', title: 'The same board for everyone today' },
	{ value: 'time', label: 'Time Attack', title: 'Beat the clock: matches add time, misses cost it' },
];
const MODES = MODE_OPTIONS.map((option) => option.value);
const LEVEL_OPTIONS = Object.entries(LEVELS).map(([value, level]) => ({ value, label: level.label }));
const LEVEL_ORDER = Object.keys(LEVELS);

// Shows the win count on the app icon when the site is installed as an app.
function setAppBadge(count) {
	navigator.setAppBadge?.(count)?.catch(() => {});
}

const resultText = (stars, moves, time) => `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)} ${moves} moves · ${formatTime(time)}`;

function MemoryGame() {
	const [mode, setMode] = createSignal(MODES.includes(load('memory-mode')) ? load('memory-mode') : 'classic');
	const [level, setLevel] = createSignal(LEVELS[load('memory-level')] ? load('memory-level') : 'medium');
	const [dailyDate, setDailyDate] = createSignal(dateKey());
	// Daily is always the same level, so its layout can be the same for everyone
	const activeLevel = () => (mode() === 'daily' ? DAILY_LEVEL : level());
	const pairs = () => LEVELS[activeLevel()].pairs;
	const makeDeck = () => (mode() === 'daily' ? dailyDeck(dailyDate()) : createDeck(pairs()));

	const [deck, setDeck] = createSignal(makeDeck());
	const [matched, setMatched] = createSignal(new Set()); // names of matched logos
	const [first, setFirst] = createSignal(null);
	const [second, setSecond] = createSignal(null);
	const [moves, setMoves] = createSignal(0);
	const [log, setLog] = createSignal(''); // one '1' (match) or '0' (miss) per move, for sharing
	const [combo, setCombo] = createSignal(0);
	const [misses, setMisses] = createSignal(0);
	const [drifts, setDrifts] = createSignal(0);
	const [comboFlash, setComboFlash] = createSignal(null);
	const [status, setStatus] = createSignal('ready'); // ready | playing | paused | won | lost
	const [startedAt, setStartedAt] = createSignal(0);
	const [now, setNow] = createSignal(0);
	const [finalTime, setFinalTime] = createSignal(0);
	const [bonus, setBonus] = createSignal(0); // Time Attack: net ms won from matches and lost to misses
	const [timeFloat, setTimeFloat] = createSignal(null);
	const [peeked, setPeeked] = createSignal(false);
	const [peeking, setPeeking] = createSignal(false);
	const [wins, setWins] = createSignal(0);
	const [best, setBest] = createSignal(load('memory-best', {}));
	const [bestRemaining, setBestRemaining] = createSignal(load('memory-time-attack', {}));
	const [daily, setDaily] = createSignal(load('memory-daily', null)); // { date, moves, time, stars, streak, log }
	const [lastGame, setLastGame] = createSignal(null);

	const recordKey = () => mode() === 'drift' ? `drift-${level()}` : level();
	const levelBest = () => best()[recordKey()];
	const dailyDone = () => daily()?.date === dailyDate();
	const streak = () => dailyStreak(daily(), dailyDate());
	const timeLimit = () => LEVELS[activeLevel()].timeLimit * 1000;
	const elapsed = () => (status() === 'won' ? finalTime() : status() === 'playing' || status() === 'paused' ? now() - startedAt() : 0);
	const remaining = () => {
		if (status() === 'ready') return timeLimit();
		if (status() === 'playing') return Math.max(0, timeLimit() + bonus() - (now() - startedAt()));
		return status() === 'won' ? (lastGame()?.remaining ?? 0) : 0;
	};

	let flipTimer;
	let flipDeadline = 0;
	let flipRemaining = 0;
	let pausedAt = 0;
	let pauseFocus;
	let flashTimer;
	let peekTimer;
	let floatTimer;
	let focusTimer;
	let board;
	let lastTick = Infinity;

	const tick = () => {
		if (status() !== 'playing') return;
		setNow(Date.now());
		if (mode() !== 'time') return;

		const left = remaining();
		if (left <= 0) return lose();
		const seconds = Math.ceil(left / 1000);
		if (seconds > TICK_FROM) lastTick = Infinity; // time was won back, so tick again next time
		else if (seconds !== lastTick) {
			lastTick = seconds;
			playSound('tick');
		}
	};
	const ticker = setInterval(tick, 100);
	onCleanup(() => {
		clearInterval(ticker);
		clearTimeout(flipTimer);
		clearTimeout(flashTimer);
		clearTimeout(peekTimer);
		clearTimeout(floatTimer);
		clearTimeout(focusTimer);
		document.removeEventListener('visibilitychange', onVisible);
		removeEventListener('focus', refreshDay);
		document.removeEventListener('keydown', pauseKey);
	});

	onMount(() => (document.title = 'Memory Game | Alfred Shaheen'));
	createEffect(() => {
		if (wins() > 0) document.title = `Memory Game · ${wins()} ${wins() === 1 ? 'win' : 'wins'}`;
	});

	// Daily boards belong to a date, so one left open overnight needs re-dealing before it's played.
	// Only an unstarted game is swapped, so a game in progress still finishes under the day it began.
	function refreshDay() {
		if (mode() !== 'daily' || status() !== 'ready' || dateKey() === dailyDate()) return false;
		newGame();
		return true;
	}
	const onVisible = () => {
		if (document.visibilityState === 'visible') refreshDay();
		else pause();
	};
	document.addEventListener('visibilitychange', onVisible);
	addEventListener('focus', refreshDay);

	const isFaceUp = (card) =>
		status() !== 'paused' && (card === first() || card === second() || matched().has(card.name) || peeking() || status() === 'lost');
	// Both cards of a pair that didn't match, until they flip back
	const isMiss = (card) => first() && second() && first().name !== second().name && (card === first() || card === second());

	const clearPicks = () => {
		const missed = first() && second() && first().name !== second().name;
		setFirst(null);
		setSecond(null);
		flipRemaining = 0;
		if (missed && mode() === 'drift' && misses() % 3 === 0) shiftCards();
	};

	const shiftCards = () => {
		const original = deck().filter(card => !matched().has(card.name));
		const pending = [...original];
		for (let i = pending.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pending[i], pending[j]] = [pending[j], pending[i]]; }
		if (pending.length > 1 && pending.every((card, i) => card.name === original[i].name)) pending.push(pending.shift());
		let at = 0;
		setDeck(previous => previous.map(card => matched().has(card.name) ? card : pending[at++]));
		setDrifts(value => value + 1);
		playSound('pop');
	};
	const canPause = () => mode() === 'classic' || mode() === 'drift';
	const pause = () => {
		if (!canPause() || status() !== 'playing') return;
		pausedAt = Date.now();
		pauseFocus = document.activeElement;
		setNow(pausedAt);
		if (second()) {
			flipRemaining = Math.max(0, flipDeadline - pausedAt);
			clearTimeout(flipTimer);
		}
		clearTimeout(peekTimer);
		clearTimeout(flashTimer);
		setPeeking(false);
		setComboFlash(null);
		setStatus('paused');
		queueMicrotask(() => { if (status() === 'paused') board?.querySelector('.mg-pause-overlay button')?.focus(); });
	};
	const resume = () => {
		if (status() !== 'paused') return;
		const time = Date.now();
		setStartedAt((value) => value + time - pausedAt);
		setNow(time);
		setStatus('playing');
		if (second()) {
			flipDeadline = time + flipRemaining;
			flipTimer = setTimeout(clearPicks, flipRemaining);
		}
		queueMicrotask(() => {
			if (status() !== 'playing') return;
			if (pauseFocus?.isConnected && pauseFocus.closest('.mg-grid')) pauseFocus.focus();
			else board?.querySelector('.mg-card')?.focus();
		});
	};
	const pauseKey = (event) => {
		if (!event.target.closest('.memory-game') || event.target.closest('input,textarea,select,[contenteditable="true"]') || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
		if (event.key.toLowerCase() !== 'p' || !canPause()) return;
		event.preventDefault();
		status() === 'paused' ? resume() : pause();
	};
	document.addEventListener('keydown', pauseKey);

	const newGame = () => {
		clearTimeout(flipTimer);
		clearTimeout(flashTimer);
		clearTimeout(peekTimer);
		clearTimeout(floatTimer);
		setFirst(null); setSecond(null); flipRemaining = 0;
		setMatched(new Set());
		setMoves(0);
		setMisses(0); setDrifts(0);
		setLog('');
		setCombo(0);
		setComboFlash(null);
		setBonus(0);
		setTimeFloat(null);
		setPeeked(false);
		setPeeking(false);
		setStatus('ready');
		setLastGame(null);
		clearTimeout(focusTimer);
		lastTick = Infinity;
		setDailyDate(dateKey()); // a game left open overnight gets the new day's board
		setDeck(makeDeck());
	};

	const changeLevel = (value) => {
		setLevel(value);
		save('memory-level', value);
		newGame();
	};

	const changeMode = (value) => {
		setMode(value);
		save('memory-mode', value);
		newGame();
	};

	// The clock and timer start on the first flip or peek, whichever comes first
	const begin = () => {
		if (status() !== 'ready') return;
		setStatus('playing');
		setStartedAt(Date.now());
		setNow(Date.now());
	};

	const adjustTime = (ms) => {
		setBonus((b) => b + ms);
		setNow(Date.now());
		setTimeFloat({ text: ms > 0 ? `+${ms / 1000}s` : `−${-ms / 1000}s`, good: ms > 0 }); // a new object replays the animation
		clearTimeout(floatTimer);
		floatTimer = setTimeout(() => setTimeFloat(null), FLOAT_MS);
	};

	const lose = () => {
		clearTimeout(flipTimer);
		clearPicks();
		setStatus('lost'); // face-up cards are derived from this, which reveals the rest of the board
		setLastGame({ lost: true, found: matched().size });
		playSound('lose');
	};

	const finishClassic = (time) => {
		// A peek is a clue, so peeked games don't compete for the records
		if (peeked()) return { newBestMoves: false, newBestTime: false };
		const previous = best()[recordKey()];
		const newBestMoves = !previous || moves() < previous.moves;
		const newBestTime = !previous || time < previous.time;
		setBest((all) => ({
			...all,
			[recordKey()]: {
				moves: newBestMoves ? moves() : previous.moves,
				time: newBestTime ? time : previous.time,
			},
		}));
		save('memory-best', best());
		return { newBestMoves, newBestTime };
	};

	const finishTimeAttack = (left) => {
		const previous = bestRemaining()[level()];
		const newBestRemaining = !previous || left > previous;
		if (newBestRemaining) {
			setBestRemaining((all) => ({ ...all, [level()]: left }));
			save('memory-time-attack', bestRemaining());
		}
		unlock('memory-time-attack');
		return { remaining: left, newBestRemaining };
	};

	const finishDaily = (time, stars) => {
		// Read storage again: another tab may have finished today's board since this one loaded
		const current = load('memory-daily', null);
		const record = recordDaily(current, { date: dailyDate(), moves: moves(), time, stars, log: log() });
		const counted = record !== current; // later runs on the same day don't change the result or streak
		setDaily(record);
		if (counted) {
			save('memory-daily', record);
			unlock('memory-daily');
		}
		return { counted };
	};

	const finish = () => {
		setNow(Date.now());
		const left = remaining(); // read while still playing
		const time = Date.now() - startedAt();
		setFinalTime(time);
		setStatus('won');
		setWins((w) => w + 1);
		setAppBadge(wins());

		const stars = Math.max(1, starsFor(moves(), pairs()) - (peeked() ? 1 : 0));
		const extra = mode() === 'time' ? finishTimeAttack(left) : mode() === 'daily' ? finishDaily(time, stars) : finishClassic(time);
		// Peeking costs a star but not the achievement
		if (activeLevel() === 'hard') unlock('memory-hard');
		setLastGame({ stars, time, moves: moves(), log: log(), peeked: peeked(), ...extra });
		playSound('win');
		confetti();
	};

	const flip = (card) => {
		// Ignore clicks after the game, during a peek, while two cards are showing, and on cards already face up
		if (status() === 'won' || status() === 'lost' || status() === 'paused' || peeking() || second() || isFaceUp(card)) return;

		if (refreshDay()) return; // the click that finds a stale board only re-deals it
		begin();
		playSound('flip');

		if (!first()) {
			setFirst(card);
			return;
		}

		setSecond(card);
		setMoves((m) => m + 1);

		if (first().name !== card.name) {
			setMisses(value => value + 1);
			setLog((l) => `${l}0`);
			setCombo(0);
			playSound('miss');
			flipDeadline = Date.now() + FLIP_BACK_MS;
			flipTimer = setTimeout(clearPicks, FLIP_BACK_MS);
			if (mode() === 'time') {
				adjustTime(-MISS_PENALTY_MS);
				if (remaining() <= 0) lose();
			}
			return;
		}

		setLog((l) => `${l}1`);
		setMatched((prev) => new Set(prev).add(card.name));
		clearPicks();
		setCombo((c) => c + 1);
		playSound('match');
		if (mode() === 'time') adjustTime(MATCH_BONUS_MS);
		if (combo() >= 2) {
			setComboFlash({ count: combo() }); // a new object, so the keyed <Show> replays its animation
			clearTimeout(flashTimer);
			flashTimer = setTimeout(() => setComboFlash(null), COMBO_FLASH_MS);
		}
		if (combo() >= COMBO_ACHIEVEMENT) unlock('memory-combo');

		if (matched().size === pairs()) finish();
	};

	const canPeek = () => mode() !== 'time' && !peeked() && !peeking() && (status() === 'ready' || status() === 'playing');

	const peek = () => {
		if (!canPeek() || refreshDay()) return;
		begin();
		setPeeked(true);
		setPeeking(true);
		playSound('flip');
		peekTimer = setTimeout(() => setPeeking(false), PEEK_MS);
	};

	const share = () => {
		const url = `${location.origin}/memory-game`;
		const game = lastGame();
		if (mode() === 'daily') shareResult(dailyShareText(daily(), url));
		else if (mode() === 'time') shareResult(timeAttackShareText({ label: LEVELS[level()].label, remaining: game.remaining, moves: game.moves }, url));
		else shareResult(classicShareText({ label: `${mode() === 'drift' ? 'Drift · ' : ''}${LEVELS[level()].label}`, stars: game.stars, moves: game.moves, time: game.time }, url));
	};

	const announcement = () => {
		const game = lastGame();
		if (!game) return '';
		if (game.lost) return `Time's up! ${game.found} of ${pairs()} pairs found.`;
		if (mode() === 'time') return `Board cleared with ${formatCountdown(game.remaining)} left.`;
		return `Board cleared in ${game.moves} moves, ${game.stars} out of 3 stars.`;
	};

	// Keyboard and screen reader users land on the result's first button. The lost dialog is
	// invisible (and so unfocusable) until its fade-in delay is over.
	createEffect(() => {
		const game = lastGame();
		clearTimeout(focusTimer);
		if (!game) return;
		const focusResult = () => board?.querySelector('.mg-result-actions button')?.focus();
		if (game.lost) focusTimer = setTimeout(focusResult, LOSS_REVEAL_MS + REVEAL_SLACK_MS);
		else focusResult();
	});

	const nextLevel = () => (mode() === 'daily' ? undefined : LEVEL_ORDER[LEVEL_ORDER.indexOf(level()) + 1]);

	return (
		<section class="page memory-game" classList={{ daily: mode() === 'daily' }}>
			<h1 class="page-title mg-title">Memory Game</h1>

			<div class="mg-toolbar">
				<Segmented label="Mode" options={MODE_OPTIONS} value={mode()} onChange={changeMode} />
				<Show
					when={mode() !== 'daily'}
					fallback={
						<div class="mg-daily">
							<p>
								<strong>Today's challenge</strong> · <time datetime={dailyDate()}>{dailyDate()}</time>
								<Show when={streak() > 0}>
									<span class="mg-streak" title="Days in a row">
										{' '}
										🔥{streak()}
									</span>
								</Show>
								<Show when={dailyDone() && !lastGame()}>
									<button class="btn btn-ghost mg-share-small" onClick={share}>
										Share
									</button>
								</Show>
							</p>
							{/* One line that is always there, so finishing doesn't resize the pill and shift the board */}
							<p class="mg-daily-sub">
								<Switch fallback="Same board for everyone today">
									<Match when={lastGame()}>
										<span aria-hidden="true">&nbsp;</span>
									</Match>
									<Match when={dailyDone()}>
										<strong>Come back tomorrow</strong> · {resultText(daily().stars, daily().moves, daily().time)}
									</Match>
								</Switch>
							</p>
						</div>
					}
				>
					<Segmented label="Difficulty" options={LEVEL_OPTIONS} value={level()} onChange={changeLevel} />
				</Show>
				<button class="btn" onClick={newGame}>
					{mode() === 'daily' ? 'Restart' : 'New game'}
				</button>
				<Show when={mode() !== 'time'}>
					<button
						class="btn btn-ghost mg-peek"
						disabled={!canPeek()}
						onClick={peek}
						aria-label="Peek, costs one star"
						title="Show every unmatched card for a second. Once per game, costs a star."
					>
						<span class="mg-peek-word">Peek</span>
						<span class="mg-peek-eye" aria-hidden="true">
							👁
						</span>{' '}
						<span class="mg-cost">−1★</span>
					</button>
				</Show>
				<Show when={canPause()}>
					<button class="btn btn-ghost" onClick={() => status() === 'paused' ? resume() : pause()} disabled={status() !== 'playing' && status() !== 'paused'}>{status() === 'paused' ? 'Resume' : 'Pause'}</button>
				</Show>
				<SoundToggle />
			</div>

			<p class="mg-sr" role="status" aria-live="polite">
				{announcement()}
			</p>

			<Show when={canPause()}>
				<p class="mg-pause-note" role="status">{status() === 'paused' ? 'Paused — cards are hidden and the clock is stopped.' : 'Press P to pause or resume. Classic and Drift games also pause when you switch tabs.'}</p>
			</Show>
			<Show when={mode() === 'drift'}><p class="mg-drift-note" role="status"><strong>↝ {drifts()} drifts</strong> · {3 - misses() % 3} misses until the next shuffle. Matched pairs stay anchored; other cards move. Drift has its own best scores.</p></Show>
			<dl class="mg-stats">
				<div>
					<dt>Moves</dt>
					<dd>{moves()}</dd>
				</div>
				<div>
					<dt>{mode() === 'time' ? 'Left' : 'Time'}</dt>
					<dd classList={{ hot: mode() === 'time' && status() === 'playing' && remaining() <= TICK_FROM * 1000 }}>
						{mode() === 'time' ? formatCountdown(remaining()) : formatTime(elapsed())}
					</dd>
					<Show when={timeFloat()} keyed>
						{(float) => (
							<span class="mg-float" classList={{ good: float.good }} aria-hidden="true">
								{float.text}
							</span>
						)}
					</Show>
				</div>
				<div>
					<dt>Combo</dt>
					<dd classList={{ hot: combo() >= 2 }}>×{combo()}</dd>
				</div>
				<div>
					<dt>{mode() === 'daily' ? 'Today' : 'Best'}</dt>
					<dd>
						<Show
							when={mode() === 'daily' ? dailyDone() && daily() : mode() === 'time' ? bestRemaining()[level()] : levelBest()}
							fallback="—"
						>
							{mode() === 'daily'
								? `${daily().moves} · ${formatTime(daily().time)}`
								: mode() === 'time'
									? formatCountdown(bestRemaining()[level()])
									: `${levelBest().moves} · ${formatTime(levelBest().time)}`}
						</Show>
					</dd>
				</div>
			</dl>

			<div
				class="mg-board"
				ref={board}
				classList={{ locked: status() === 'lost' }}
				style={{
					'--cols': LEVELS[activeLevel()].cols,
					'--cols-narrow': LEVELS[activeLevel()].colsNarrow,
					'--rows': (pairs() * 2) / LEVELS[activeLevel()].cols,
					'--rows-narrow': (pairs() * 2) / LEVELS[activeLevel()].colsNarrow,
				}}
			>
				<div class="mg-grid" classList={{ 'is-paused': status() === 'paused' }} aria-hidden={status() === 'paused'}>
					<For each={deck()}>
						{(card) => (
							<Card
								name={card.name}
								image={card.image}
								faceUp={isFaceUp(card)}
								matched={matched().has(card.name)}
								miss={isMiss(card)}
								disabled={status() === 'paused'}
								onFlip={() => flip(card)}
							/>
						)}
					</For>
				</div>

				<Show when={status() === 'paused'}>
					<div class="mg-overlay mg-pause-overlay" role="group" aria-label="Game paused">
						<div class="mg-result"><p class="mg-result-title">Take a break.</p><p>Your clock will wait.</p><button class="btn" onClick={resume}>Resume game</button></div>
					</div>
				</Show>

				<Show when={comboFlash()} keyed>
					{(flash) => (
						<p class="mg-combo" aria-live="polite">
							Combo ×{flash.count}!
						</p>
					)}
				</Show>

				<Show when={lastGame()}>
					{(game) => (
						<div class="mg-overlay" classList={{ lost: game().lost }} role="dialog" aria-label={game().lost ? "Time's up" : 'Board cleared'}>
							<div class="mg-result">
								<Show
									when={!game().lost}
									fallback={
										<>
											<p class="mg-result-title">Time's up!</p>
											<p>
												{game().found} of {pairs()} pairs found
											</p>
										</>
									}
								>
									<p class="mg-result-title">{mode() === 'daily' && !game().counted ? 'Practice cleared!' : 'Board cleared!'}</p>
									<Show
										when={mode() !== 'time'}
										fallback={
											<p>
												{formatCountdown(game().remaining)} left
												{game().newBestRemaining && <span class="mg-new-best">best!</span>} · {game().moves} moves
											</p>
										}
									>
										<p class="mg-stars" aria-label={`${game().stars} out of 3 stars`}>
											<For each={[1, 2, 3]}>{(n) => <span classList={{ lit: n <= game().stars }}>★</span>}</For>
										</p>
										<p>
											{game().moves} moves{game().newBestMoves && <span class="mg-new-best">best!</span>} ·{' '}
											{formatTime(game().time)}
											{game().newBestTime && <span class="mg-new-best">best!</span>}
										</p>
										<Show when={game().peeked}>
											<p class="mg-note">Peek used: −1★{canPause() && ', not eligible for best'}</p>
										</Show>
									</Show>
									<Show when={mode() === 'daily'}>
										<p class="mg-note">
											<strong>Come back tomorrow</strong> for a new board.
											{game().counted
												? ` 🔥${streak()} day${streak() === 1 ? '' : 's'} in a row`
												: ` Today's result stays: ${resultText(daily().stars, daily().moves, daily().time)}`}
										</p>
									</Show>
								</Show>
								<div class="mg-result-actions">
									<button class="btn" onClick={newGame}>
										{game().lost ? 'Try again' : mode() === 'daily' ? 'Practice again' : 'Play again'}
									</button>
									<Show when={!game().lost}>
										<button class="btn btn-ghost" onClick={share}>
											Share
										</button>
									</Show>
									<Show when={!game().lost && nextLevel()}>
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
